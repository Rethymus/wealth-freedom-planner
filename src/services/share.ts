/**
 * 场景分享链接：业务输入切片 ⇄ URL hash 的编解码（编解码为纯函数；
 * 末尾两个 DOM 辅助服务于复制动作）。
 *
 * - 切片范围：基础 / 反向 / 贷款 / 收租 / 蒙特卡洛（含收益模式与序列 id）/ 打工 /
 *   税务 / 进度环 / 养老金；不含主题 / 语言 / 色盲 / 币种等界面偏好（契约见
 *   docs/p1-spec.md §6.0）。
 * - 编码：{ v: 版本号, ...切片 } → JSON 字符串 → base64url（+/ → -_、去填充 =）。
 *   JSON 值全部为数值与 ASCII 枚举（不含中文），btoa/atob 安全；若未来引入
 *   非 ASCII 值，必须先改造为 TextEncoder 编码，不得直接沿用本实现。
 * - 解码：任何形状不符 / 版本不符 / 超长 / base64 或 JSON 解析失败 → 返回 null
 *   （调用方静默忽略并提示）；数值字段要求有限数，枚举字段要求成员命中；
 *   不做部分恢复——半套参数比默认值更危险。
 * - 往返一致：decode(encode(x)) 对合法 x 恒等（验收见 docs/p1-spec.md §6.4）。
 */
import type {
  AccumulationInput,
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  PercentStrategyParams,
  RentalAnalysisInput,
  ReverseEstimateInput,
  ThresholdStrategyParams,
  WithdrawalStrategy,
} from "../wasm/bridge";
import type { PensionInputs } from "../data/pensionParams";
import type { IndexId, MonteCarloReturnMode } from "../data/indexSeries";

/** 分享链接版本（切片形状或字段语义变更时递增；解码端仅接受当前版本）。
 * v3：monteCarlo 切片新增 strategy / threshold / percent 字段（P2 支取策略，docs/p2-spec.md §4.1）；
 * v2 及更早链接按既有「损坏回落默认 + 提示」口径处理（发布影响：v3 上线后全部存量 v2 及更早
 * 链接一次性失效，需重新生成分享链接——延续 v1 → v2 升级的既有决策，见本注释先例）；
 * v2：pension.monthsDivisor 编码值改为「联动态取面板所见表值」（effectiveMonthsDivisor
 * 口径），发送方所见与接收方所得一致；v1 链接按损坏处理（静默回落默认 + 提示） */
export const SHARE_LINK_VERSION = 3;

/** hash 前缀（#s=<payload>） */
const HASH_PREFIX = "#s=";

/** 载荷长度上限（防滥用；超出按损坏处理） */
const MAX_PAYLOAD_CHARS = 8192;

/** 分享切片（与 store 各业务切片一一对应） */
export interface ShareState {
  baseline: BaselineInput;
  reverse: ReverseEstimateInput;
  loan: AmortizeInput;
  rental: RentalAnalysisInput;
  monteCarlo: MonteCarloInput;
  monteCarloReturnMode: MonteCarloReturnMode;
  monteCarloSeriesId: IndexId;
  tax: EstimateTaxInput;
  accumulation: AccumulationInput;
  /** 进度环输入（切片仅此一个数值） */
  progressCurrentAssets: number;
  pension: PensionInputs;
}

interface SharePayload extends ShareState {
  /** 版本号 */
  v: number;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string | null {
  try {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  } catch {
    return null;
  }
}

/** 取 payload 中的切片对象（须为普通对象）；不符返回 null */
function sliceOf(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = obj[key];
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/** 逐键校验数值切片：keys 全部为有限数才返回键值表，否则 null */
function numSlice(obj: Record<string, unknown>, keys: string[]): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = obj[k];
    if (!isNum(v)) return null;
    out[k] = v;
  }
  return out;
}

/** 编码分享切片 → base64url 载荷（不含 #s= 前缀） */
export function encodeShareState(state: ShareState): string {
  const payload: SharePayload = { v: SHARE_LINK_VERSION, ...state };
  return toBase64Url(JSON.stringify(payload));
}

/** 解析完整 hash（或裸载荷）→ 分享切片；任何不符返回 null */
export function decodeShareState(hash: string): ShareState | null {
  const raw = hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash;
  if (raw === "" || raw.length > MAX_PAYLOAD_CHARS) return null;
  const json = fromBase64Url(raw);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj["v"] !== SHARE_LINK_VERSION) return null;

  const baseline = numSlice(
    sliceOf(obj, "baseline") ?? {},
    ["monthlyExpense", "childCount", "costPerChild", "healthReserve", "majorInvestment", "nominalReturnPct", "inflationPct"],
  );
  const reverse = numSlice(
    sliceOf(obj, "reverse") ?? {},
    ["totalAssets", "childReserve", "healthReserve", "majorInvestment", "nominalReturnPct", "inflationPct"],
  );
  const loanObj = sliceOf(obj, "loan");
  const loanNums = loanObj
    ? numSlice(loanObj, ["principal", "annualRatePct", "years"])
    : null;
  const method = loanObj?.["method"];
  const rental = numSlice(
    sliceOf(obj, "rental") ?? {},
    ["price", "downPaymentPct", "loanAnnualRatePct", "loanYears", "monthlyRent", "vacancyRatePct", "maintenanceAnnualRatePct", "propertyFeeMonthly", "otherAnnualCost", "rentTaxRatePct"],
  );
  const mcObj = sliceOf(obj, "monteCarlo") ?? {};
  const monteCarloNums = numSlice(
    mcObj,
    ["currentAssets", "annualSpend", "nominalReturnMeanPct", "nominalReturnStdPct", "inflationMeanPct", "inflationStdPct", "years", "paths", "seed"],
  );
  // 支取策略（v3 新增）：缺省按 "fixed"；非三枚举之一 → 整体损坏返回 null（§4.1 逐字）
  const strategyRaw = mcObj["strategy"];
  const strategy: WithdrawalStrategy = strategyRaw === undefined ? "fixed" : (strategyRaw as WithdrawalStrategy);
  if (strategy !== "fixed" && strategy !== "threshold" && strategy !== "percent") {
    return null;
  }
  let threshold: ThresholdStrategyParams | undefined;
  let percent: PercentStrategyParams | undefined;
  if (strategy === "threshold") {
    // threshold 必须为对象且五个数值字段全为有限数、freezeOnLoss 严格为布尔，否则 null
    const tRaw = mcObj["threshold"];
    if (typeof tRaw !== "object" || tRaw === null || Array.isArray(tRaw)) return null;
    const tRec = tRaw as Record<string, unknown>;
    const tNums = numSlice(tRec, ["exceedPct", "cutPct", "fallPct", "raisePct", "noCutLastYears"]);
    if (!tNums) return null;
    const freeze = tRec["freezeOnLoss"];
    if (freeze !== true && freeze !== false) return null;
    threshold = {
      exceedPct: tNums["exceedPct"],
      cutPct: tNums["cutPct"],
      fallPct: tNums["fallPct"],
      raisePct: tNums["raisePct"],
      noCutLastYears: tNums["noCutLastYears"],
      freezeOnLoss: freeze,
    };
  }
  if (strategy === "percent") {
    // percent 必须为对象且三个数值字段全为有限数，否则 null
    const pRaw = mcObj["percent"];
    if (typeof pRaw !== "object" || pRaw === null || Array.isArray(pRaw)) return null;
    const pNums = numSlice(pRaw as Record<string, unknown>, [
      "realReturnAssumpPct",
      "floorPctOfLastYear",
      "capPctOfInitialReal",
    ]);
    if (!pNums) return null;
    percent = {
      realReturnAssumpPct: pNums["realReturnAssumpPct"],
      floorPctOfLastYear: pNums["floorPctOfLastYear"],
      capPctOfInitialReal: pNums["capPctOfInitialReal"],
    };
  }
  // strategy = "fixed" 时两嵌套对象可缺省可忽略：不写入解码结果（缺省策略不消费新参数）
  const monteCarlo: MonteCarloInput = {
    ...(monteCarloNums as unknown as Pick<
      MonteCarloInput,
      | "currentAssets"
      | "annualSpend"
      | "nominalReturnMeanPct"
      | "nominalReturnStdPct"
      | "inflationMeanPct"
      | "inflationStdPct"
      | "years"
      | "paths"
      | "seed"
    >),
    strategy,
    ...(threshold !== undefined ? { threshold } : {}),
    ...(percent !== undefined ? { percent } : {}),
  };
  const returnMode = obj["monteCarloReturnMode"];
  const seriesId = obj["monteCarloSeriesId"];
  const taxObj = sliceOf(obj, "tax");
  const taxNums = taxObj ? numSlice(taxObj, ["grossAnnualIncome", "standardDeduction"]) : null;
  const bandsRaw = taxObj?.["bands"];
  const accumulation = numSlice(
    sliceOf(obj, "accumulation") ?? {},
    ["currentAssets", "monthlyIncome", "monthlyExpense", "targetValue", "nominalReturnMeanPct", "nominalReturnStdPct", "inflationMeanPct", "inflationStdPct", "years", "paths", "seed"],
  );
  const progress = obj["progressCurrentAssets"];
  const pension = numSlice(
    sliceOf(obj, "pension") ?? {},
    ["currentAge", "retireAge", "contribYears", "contribIndex", "accountBalance", "avgMonthlyWage", "monthsDivisor"],
  );

  if (!baseline || !reverse || !loanNums || !rental || !monteCarloNums || !taxNums || !accumulation || !pension) {
    return null;
  }
  if (!isNum(progress)) return null;
  if (method !== "equal_payment" && method !== "equal_principal") return null;
  if (returnMode !== "normal" && returnMode !== "bootstrap") return null;
  if (seriesId !== "csi300" && seriesId !== "sp500") return null;
  if (!Array.isArray(bandsRaw)) return null;
  const bands: { lower: number; rate: number }[] = [];
  for (const b of bandsRaw) {
    if (typeof b !== "object" || b === null || Array.isArray(b)) return null;
    const lower = (b as Record<string, unknown>)["lower"];
    const rate = (b as Record<string, unknown>)["rate"];
    if (!isNum(lower) || !isNum(rate) || rate < 0) return null;
    bands.push({ lower, rate });
  }

  return {
    baseline: baseline as unknown as BaselineInput,
    reverse: reverse as unknown as ReverseEstimateInput,
    loan: { ...(loanNums as unknown as { principal: number; annualRatePct: number; years: number }), method },
    rental: rental as unknown as RentalAnalysisInput,
    monteCarlo,
    monteCarloReturnMode: returnMode,
    monteCarloSeriesId: seriesId,
    tax: { ...(taxNums as unknown as { grossAnnualIncome: number; standardDeduction: number }), bands },
    accumulation: accumulation as unknown as AccumulationInput,
    progressCurrentAssets: progress,
    pension: pension as unknown as PensionInputs,
  };
}

/** 由载荷构造完整分享 URL */
export function buildShareUrl(payload: string): string {
  return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${payload}`;
}

/** 复制到剪贴板：Clipboard API 优先，失败回退 execCommand（file:// 等非安全上下文） */
export async function copyShareUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
