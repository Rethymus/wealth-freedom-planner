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
import type { LifeEventInput } from "./finance";

/** P9 事件条数上限（与 UI LIMITS 同值；防滥用思想同 MAX_PAYLOAD_CHARS，docs/p9-spec.md §6.3-3） */
const MAX_LIFE_EVENTS = 20;

/** 分享链接版本（切片形状或字段语义变更时递增；解码端仅接受当前版本）。
 * v6：ShareState 新增第 13 键 mcMeansSynced（P10 §4 MC 回报均值/通胀均值「跟随核心参数」
 *   口径标志——布尔，业务输入切片的一部分；不入载荷则接收方会在锁态显示下看到 payload
 *   里的旧均值，发送方所见 ≠ 接收方所得，违反本文件纪律）。解码端严格布尔校验：
 *   缺键 / 非 true|false → 整体 null（禁止部分恢复）；v5 及更早链接与情景库存档一次性
 *   失效，需重新生成/重存——延续 v1→v2→v3→v4→v5 既有决策（形状变更即递增、版本单点闸
 *   自动承载、无迁移代码）；
 * v5：ShareState 新增第 12 键 lifeEvents（P9 人生事件切片入载荷——事件是业务输入切片，
 *   不入载荷则分享/情景库发送方与接收方轨迹静默失真，违反「发送方所见 = 接收方所得」；
 *   必填键、缺键 → 整体 null，空事件 = []；healthPhase 的 label 为 UI 本地态「存而不传」
 *   字段：编码端剥除（btoa 非 Latin1 抛异常，P9 不启动 TextEncoder 改造）、解码端置
 *   缺省空串）；v4 链接与情景库存档一次性失效，需重新生成/重存——延续 v1→v2→v3→v4
 *   既有决策（ShareState 形状变更即递增，版本单点闸自动承载、无迁移代码）；
 * v4：pension 切片新增 targetRetireAge、accumulation 切片新增 sustainYears
 *   （P7/P0-1 / P0-2 修复）；v3 及更早链接与情景库存档一次性失效，需重新生成/
 *   重存——延续 v1→v2、v2→v3 既有决策（见下文先例）；另：解码端把外来/未来载荷的
 *   "inflation_uplift"（P0-3 支取策略正名）规范化为 "fixed"（语义相同、并入即可，
 *   DecodeResult.strategyNormalizedFromLegacy 携带一次性提示信号——映射而非拒绝，
 *   避免恢复后 store 持有 UI 枚举外值）；
 * v3：monteCarlo 切片新增 strategy / threshold / percent 字段（P2 支取策略，docs/p2-spec.md §4.1）；
 * v2 及更早链接按既有「损坏回落默认 + 提示」口径处理（发布影响：v3 上线后全部存量 v2 及更早
 * 链接一次性失效，需重新生成分享链接——延续 v1 → v2 升级的既有决策，见本注释先例）；
 * v2：pension.monthsDivisor 编码值改为「联动态取面板所见表值」（effectiveMonthsDivisor
 * 口径），发送方所见与接收方所得一致；v1 链接按损坏处理（静默回落默认 + 提示） */
export const SHARE_LINK_VERSION = 6;

/** hash 前缀（#s=<payload>） */
const HASH_PREFIX = "#s=";

/** 载荷长度上限（防滥用；超出按损坏处理） */
const MAX_PAYLOAD_CHARS = 8192;

/** 分享切片（与 store 各业务切片一一对应；v5 新增第 12 键 lifeEvents） */
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
  /** P9 人生事件切片（v5；必填键——缺键 → 整体 null 禁止部分恢复；空事件 = []。
   *  healthPhase 的 label 仅 UI 本地态：编码端剥除、解码端置缺省空串，不入载荷） */
  lifeEvents: LifeEventInput[];
  /** P10 §4 MC 均值口径标志（v6 新增第 13 键；必填，严格布尔——缺键/非布尔 → 整体 null） */
  mcMeansSynced: boolean;
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

/** 编码分享切片 → base64url 载荷（不含 #s= 前缀）。
 * P9（§6.3-2 硬红线）：healthPhase 的 label 在编码端剥除——btoa 对非 Latin1 字符抛异常，
 * 中文 label 一旦入载荷即破 btoa 链；「存而不传」字段逐字登记（store 保留、编码端剥除、
 * 解码端置缺省空串）。事件数组其余键全键编码，不引入短键映射层。 */
export function encodeShareState(state: ShareState): string {
  const payload: SharePayload = {
    v: SHARE_LINK_VERSION,
    ...state,
    lifeEvents: state.lifeEvents.map((ev) => {
      if (ev.kind !== "healthPhase") return ev;
      const { label: _stripped, ...rest } = ev;
      return rest;
    }),
  };
  return toBase64Url(JSON.stringify(payload));
}

/** 解析完整 hash（或裸载荷）→ 分享切片；任何不符返回 null */
/** decodeShareState 的返回：state = 恢复切片；strategyNormalizedFromLegacy =
 * 「载荷携带了历史/未来的支取策略名 inflation_uplift、已并入固定实际支出」
 * 一次性提示信号（不入 share 载荷、不入情景存档、resetEpoch 语义不变） */
export interface DecodeResult {
  state: ShareState;
  strategyNormalizedFromLegacy: boolean;
}

export function decodeShareState(hash: string): DecodeResult | null {
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
  // 支取策略（v3 起新增）：缺省按 "fixed"；P7/P0-3 解码端规范化——外来/未来载荷的
  // "inflation_uplift"（正名）映射为 "fixed"（语义相同、并入即可；映射而非拒绝、
  // 非原样保留：避免恢复后 store 持有 UI 枚举外值——Radio 无选中态、策略注按错误
  // 分支渲染）。编码端 store 永不产出该值（Radio value 恒 "fixed"），合法往返
  // 不受影响；规范化发生时经 DecodeResult.strategyNormalizedFromLegacy 上报一次性提示。
  const strategyRaw = mcObj["strategy"];
  let strategy: WithdrawalStrategy = strategyRaw === undefined ? "fixed" : (strategyRaw as WithdrawalStrategy);
  let strategyNormalizedFromLegacy = false;
  if (strategy === "inflation_uplift") {
    strategy = "fixed";
    strategyNormalizedFromLegacy = true;
  } else if (strategy !== "fixed" && strategy !== "threshold" && strategy !== "percent") {
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
    ["currentAssets", "monthlyIncome", "monthlyExpense", "targetValue", "nominalReturnMeanPct", "nominalReturnStdPct", "inflationMeanPct", "inflationStdPct", "years", "paths", "seed", "sustainYears"], // v4：+sustainYears（缺任一键 → 整体 null，禁止部分恢复）
  );
  const progress = obj["progressCurrentAssets"];
  const pension = numSlice(
    sliceOf(obj, "pension") ?? {},
    ["currentAge", "retireAge", "targetRetireAge", "contribYears", "contribIndex", "accountBalance", "avgMonthlyWage", "monthsDivisor"], // v4：+targetRetireAge（同上）
  );
  // ---- P9 v5：lifeEvents 必填键解码（§6.3-3）----
  // 缺键 / 非数组 / 条数 > 20 → 整体 null；逐条校验（违反任一 → 整体 null，禁止部分恢复）：
  // kind 非三枚举之一（枚举校验同款 ：247-249）、数值全 isNum（:72-74）、amount/annualAmount < 0
  // （负值损坏——rate < 0 先例 ：256）、age 非整数或出 [16, 120]、endAge ∉ [age, 120]、
  // id 非非空 string；healthPhase 解码端置 label 缺省空串（「存而不传」，§6.3-2）。
  const eventsRaw = obj["lifeEvents"];
  let lifeEvents: LifeEventInput[] | null = null;
  if (Array.isArray(eventsRaw) && eventsRaw.length <= MAX_LIFE_EVENTS) {
    lifeEvents = [];
    for (const e of eventsRaw) {
      if (typeof e !== "object" || e === null || Array.isArray(e)) { lifeEvents = null; break; }
      const rec = e as Record<string, unknown>;
      const id = rec["id"];
      const age = rec["age"];
      const kind = rec["kind"];
      if (typeof id !== "string" || id === "") { lifeEvents = null; break; }
      if (!isNum(age) || !Number.isInteger(age) || age < 16 || age > 120) { lifeEvents = null; break; }
      if (kind === "homePurchase") {
        const amount = rec["amount"];
        if (!isNum(amount) || amount < 0) { lifeEvents = null; break; }
        lifeEvents.push({ id, kind, age, amount });
      } else if (kind === "childBirth") {
        lifeEvents.push({ id, kind, age });
      } else if (kind === "healthPhase") {
        const endAge = rec["endAge"];
        const annualAmount = rec["annualAmount"];
        if (!isNum(endAge) || !Number.isInteger(endAge) || endAge < age || endAge > 120) { lifeEvents = null; break; }
        if (!isNum(annualAmount) || annualAmount < 0) { lifeEvents = null; break; }
        lifeEvents.push({ id, kind, age, endAge, annualAmount, label: "" });
      } else {
        lifeEvents = null;
        break;
      }
    }
  }

  if (!baseline || !reverse || !loanNums || !rental || !monteCarloNums || !taxNums || !accumulation || !pension || !lifeEvents) {
    return null;
  }
  // ---- P10 v6：mcMeansSynced 必填键严格布尔校验（缺键 / 非 true|false → 整体 null，
  //      禁止部分恢复；与 freezeOnLoss 同款布尔口径）----
  const mcMeansSynced = obj["mcMeansSynced"];
  if (mcMeansSynced !== true && mcMeansSynced !== false) return null;
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

  const state: ShareState = {
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
    lifeEvents, // v5：事件切片（校验已完成，label 已置缺省空串）
    mcMeansSynced, // v6：MC 均值口径标志（严格布尔校验已完成）
  };
  return { state, strategyNormalizedFromLegacy };
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
