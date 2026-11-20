/**
 * 本地场景库存储（docs/p2-spec.md §4.2 契约逐字）：
 * - 业务输入经 encodeShareState 的 base64url 载荷整包保存（版本随 SHARE_LINK_VERSION），
 *   载入复用 store.applyShareState 的既有解码口径（decodeShareState 支持裸载荷）；
 * - localStorage 仅在显式保存 / 删除动作读写，读取失败静默（列表返回空 / 单条剔除），
 *   与主题 / 偏好存储的容错口径一致。
 */

/** 本地场景库存储键（localStorage） */
export const SCENARIO_STORAGE_KEY = "wf-scenarios";
/** 场景库容量上限（超出后保存被拒，提示先删除） */
export const SCENARIO_MAX_COUNT = 12;
/** 情景名称最大字符数（输入框 maxlength 同值） */
export const SCENARIO_NAME_MAX_CHARS = 30;

/** 单条情景：payload 为 encodeShareState 的 base64url 输出（版本随 SHARE_LINK_VERSION） */
export interface ScenarioEntry {
  id: string;
  name: string;
  payload: string;
  /** 保存时间戳（ms） */
  createdAt: number;
}

export type SaveScenarioResult = { ok: true } | { ok: false; reason: "full" | "storage" };

/** 载荷层损坏判定第一步：base64url 逆变换（与 decodeShareState 的 fromBase64Url 同实现，
 * 场景库只允许复刻这两步——不得用 decodeShareState 的返回值做剔除，见 listScenarios 注释） */
function payloadFromBase64Url(s: string): string | null {
  try {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  } catch {
    return null;
  }
}

/** 载荷层损坏判定第二步：JSON.parse（与 decodeShareState 相同）。
 * 仅这两步失败才算「存储层损坏」静默剔除；版本不符 / 业务形状校验失败的载荷
 * （decodeShareState 返回 null）必须在列表中保留，由 UI 层标记 scenario.versionMismatch。 */
function isPayloadCorrupt(payload: string): boolean {
  const json = payloadFromBase64Url(payload);
  if (json === null) return true;
  try {
    JSON.parse(json);
    return false;
  } catch {
    return true;
  }
}

/** 读取原始条目数组：存储不可用 / JSON 损坏 / 非数组一律返回 [] */
function readRawEntries(): unknown[] {
  try {
    const raw = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** 列出全部情景（存储不可用返回 []；单条损坏静默剔除，不影响其余条目）。
 * 损坏判定仅限载荷层两步：base64url 逆变换失败 / JSON.parse 失败（与 decodeShareState
 * 的前两步相同）；不得用 decodeShareState 的返回值做剔除——其 null 还涵盖
 * 版本不符与业务形状校验失败，版本不符的存量情景必须在列表中保留、由 UI 层
 * 标记 scenario.versionMismatch，否则该标记沦为死代码且用户数据无提示丢失。 */
export function listScenarios(): ScenarioEntry[] {
  const raw = readRawEntries();
  const out: ScenarioEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id = rec["id"];
    const payload = rec["payload"];
    if (typeof id !== "string" || id === "" || typeof payload !== "string" || payload === "") continue;
    if (isPayloadCorrupt(payload)) continue; // 载荷层两步损坏：静默剔除
    const name = typeof rec["name"] === "string" ? rec["name"] : id;
    const createdAt = typeof rec["createdAt"] === "number" && Number.isFinite(rec["createdAt"]) ? rec["createdAt"] : 0;
    out.push({ id, name, payload, createdAt });
  }
  return out;
}

/** 保存情景：id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`；
 * name 按字符数截断到 SCENARIO_NAME_MAX_CHARS；超出容量 → { ok:false, reason:"full" }；
 * localStorage 写入抛异常（隐私模式 / 配额满）→ { ok:false, reason:"storage" }。
 * 同名不拦截（允许同名情景并存）。 */
export function saveScenario(name: string, payload: string): SaveScenarioResult {
  const existing = listScenarios();
  if (existing.length >= SCENARIO_MAX_COUNT) {
    return { ok: false, reason: "full" };
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: ScenarioEntry = {
    id,
    name: Array.from(name.trim())
      .slice(0, SCENARIO_NAME_MAX_CHARS)
      .join(""),
    payload,
    createdAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify([...existing, entry]));
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage" };
  }
}

/** 删除情景（id 不存在时静默）；存储不可用静默 */
export function deleteScenario(id: string): void {
  const existing = listScenarios();
  const next = existing.filter((e) => e.id !== id);
  if (next.length === existing.length) return; // id 不存在：静默
  try {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 存储不可用：静默（删除在下次读取时按既有数据呈现） */
  }
}
