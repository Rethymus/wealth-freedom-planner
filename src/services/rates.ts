/**
 * 汇率服务：实时汇率优先，离线快照兜底。
 *
 * - 数据源：open.er-api.com 免费开放接口（无需任何密钥）；
 * - 8 秒 AbortController 超时；失败 / 超时 / 响应异常时回退到
 *   src/data/defaults.ts 的 FX_RATE_SNAPSHOT 并标注「离线快照」；
 * - 请求前按安全约束校验 URL（仅 http/https、拒绝 localhost/环回/私有/保留地址）；
 * - 换算语义与 FxRateSnapshot 一致：1 单位 base = rates[target] 单位 target。
 */
import { FX_RATE_SNAPSHOT } from "../data/defaults";

/** 固定数据源：免费开放接口，不涉及任何密钥 */
const RATES_URL = "https://open.er-api.com/v6/latest/CNY";
/** 请求超时（毫秒） */
const TIMEOUT_MS = 8000;

/** 汇率获取结果（UI 展示用） */
export interface RatesResult {
  /** 基准币种（快照/接口 base，如 "CNY"） */
  base: string;
  /** 1 单位 base = rates[target] 单位 target */
  rates: Record<string, number>;
  /** 汇率数据自身的时间戳标注（接口返回或快照记录；可能为空） */
  ratesUpdatedAt: string;
  /** 本地获取时间（ISO 8601） */
  fetchedAt: string;
  /** true = 当前展示的是离线快照而非实时数据 */
  offline: boolean;
  /** 数据来源说明 */
  source: string;
  /** 备注（离线原因 / 快照说明等） */
  note?: string;
}

// ---------------------------------------------------------------------------
// URL 安全校验：仅允许 http/https 的公网地址
// ---------------------------------------------------------------------------

const IPV4_PART_PATTERN = /^\d{1,3}$/;
const IPV4_HOST_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/** 判断 IPv4 是否属于私有 / 保留网段（传入前须为标准点分十进制、无前导 0 段） */
function isPrivateOrReservedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => IPV4_PART_PATTERN.test(p))) return true;
  const octets = parts.map((p) => Number.parseInt(p, 10));
  if (octets.some((n) => Number.isNaN(n) || n > 255)) return true; // 非法即拒绝
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // 0/8、10/8、环回
  if (a === 169 && b === 254) return true; // 链路本地 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // 基准测试保留
  if (a === 192 && b === 0) return true; // 192.0.0/24、192.0.2/24
  if (a === 198 && b === 51) return true; // 198.51.100/24
  if (a === 203 && b === 0) return true; // 203.0.113/24
  if (a === 255 && b === 255 && octets[2] === 255 && octets[3] === 255) return true;
  if (a >= 224) return true; // 组播 / 保留
  return false;
}

/** 判断 IPv6（已去方括号）是否为环回 / 链路本地 / 唯一本地 / IPv4 映射等保留地址 */
function isPrivateOrReservedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 唯一本地
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // fe80::/10
  if (h.startsWith("::ffff:")) {
    return isPrivateOrReservedIpv4(h.slice("::ffff:".length));
  }
  return false;
}

/** 请求前校验：仅 http/https 公网地址；非法返回 false（调用方按失败处理） */
function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (IPV4_HOST_PATTERN.test(host)) {
    // 非标准点分写法（含前导 0 段，如 0177.0.0.1）可能被浏览器按八进制解析到环回/私网，一律拒绝
    if (!host.split(".").every((p) => p === "0" || /^[1-9]\d{0,2}$/.test(p))) return false;
    return !isPrivateOrReservedIpv4(host);
  }
  if (host.includes(":")) return !isPrivateOrReservedIpv6(host.replace(/^\[|\]$/g, ""));
  // 普通域名：拒绝可被浏览器解析为 IP 字面量的非常规形式 —— 全部标签均为数字的
  // 主机（如整数形式 2130706433、混合形式 127.1）与含 0x 前缀的标签（如 0x7f.0.0.1）
  const labels = host.split(".");
  if (labels.every((p) => /^\d+$/.test(p))) return false;
  if (labels.some((p) => /^0[xX]/.test(p))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 接口响应解析
// ---------------------------------------------------------------------------

interface ErApiPayload {
  result?: unknown;
  base_code?: unknown;
  time_last_update_utc?: unknown;
  rates?: unknown;
}

function pickFiniteRates(raw: Record<string, unknown>): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [code, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      rates[code] = v;
    }
  }
  return rates;
}

function offlineSnapshot(reason: string): RatesResult {
  return {
    base: FX_RATE_SNAPSHOT.base,
    rates: pickFiniteRates(FX_RATE_SNAPSHOT.rates),
    ratesUpdatedAt: FX_RATE_SNAPSHOT.ratesUpdatedAt,
    fetchedAt: new Date().toISOString(),
    offline: true,
    source: FX_RATE_SNAPSHOT.source,
    note: `${reason}${FX_RATE_SNAPSHOT.note ? `；${FX_RATE_SNAPSHOT.note}` : ""}`,
  };
}

async function fetchOnce(): Promise<RatesResult> {
  if (!isPublicHttpUrl(RATES_URL)) {
    throw new Error("汇率接口地址未通过安全校验，已拒绝请求");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // redirect: "error" —— 拒绝跟随重定向（重定向目标不再经过发请求前的 URL 校验）；
    // 接口实测直连 200 无重定向（2026-11 验证），如未来出现重定向将按失败回退离线快照
    const res = await fetch(RATES_URL, { signal: controller.signal, redirect: "error" });
    if (!res.ok) {
      throw new Error(`汇率接口返回 HTTP ${res.status}`);
    }
    // 防御复查：最终响应 URL 仍须与请求同主机且为公网地址（安全约束覆盖到收到的响应）
    if (res.url !== RATES_URL && !isPublicHttpUrl(res.url)) {
      throw new Error("汇率接口响应来源未通过安全校验，已拒绝响应");
    }
    const payload = (await res.json()) as unknown;
    if (typeof payload !== "object" || payload === null) {
      throw new Error("汇率接口响应格式异常");
    }
    const data = payload as ErApiPayload;
    if (data.result !== "success" || typeof data.rates !== "object" || data.rates === null) {
      throw new Error("汇率接口未返回成功结果");
    }
    const rates = pickFiniteRates(data.rates as Record<string, unknown>);
    if (Object.keys(rates).length === 0) {
      throw new Error("汇率接口未返回有效汇率");
    }
    return {
      base: typeof data.base_code === "string" ? data.base_code : FX_RATE_SNAPSHOT.base,
      rates,
      ratesUpdatedAt: typeof data.time_last_update_utc === "string" ? data.time_last_update_utc : "",
      fetchedAt: new Date().toISOString(),
      offline: false,
      source: "open.er-api.com",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted")) {
      throw new Error(`汇率请求超时（${TIMEOUT_MS / 1000} 秒）`);
    }
    throw e instanceof Error ? e : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 对外 API（模块级缓存，避免重复请求）
// ---------------------------------------------------------------------------

let cached: RatesResult | null = null;
let inflight: Promise<RatesResult> | null = null;

/**
 * 获取汇率：成功走实时接口；失败/超时回退离线快照（offline: true）。
 * 默认使用缓存；force = true 时强制重新请求。
 */
export function getRates(force = false): Promise<RatesResult> {
  if (!force && cached) return Promise.resolve(cached);
  if (!force && inflight) return inflight;
  const task = fetchOnce()
    .then((r) => {
      cached = r;
      return r;
    })
    .catch((e: unknown) => {
      const reason = e instanceof Error ? e.message : String(e);
      const snapshot = offlineSnapshot(reason);
      cached = snapshot;
      return snapshot;
    })
    .finally(() => {
      inflight = null;
    });
  inflight = task;
  return task;
}
