/**
 * 懒加载 WASM 计算核心适配层。
 *
 * - 模块本身是静态导入（wasm-pack --target web 的 JS 胶水层很小），
 *   但二进制初始化（init()）推迟到首次调用前才执行；
 * - 所有调用 try/catch，任何失败都向上返回 FinanceResult（ok: false），
 *   UI 层据此显示「计算核心未就绪 / 加载失败」Alert，页面其余部分不受影响；
 * - 输出契约以 src/wasm/bridge.ts 为单一事实来源，这里只做轻量形状校验
 *   （不信任 JSON 解析结果），error 字段非空按业务错误处理。
 */
import init, {
  amortize as wasmAmortize,
  calculate_baseline as wasmCalculateBaseline,
  estimate_pension as wasmEstimatePension,
  estimate_tax as wasmEstimateTax,
  rental_analysis as wasmRentalAnalysis,
  reverse_estimate as wasmReverseEstimate,
  run_monte_carlo as wasmRunMonteCarlo,
  run_monte_carlo_bootstrap as wasmRunMonteCarloBootstrap,
  simulate_accumulation as wasmSimulateAccumulation,
  simulate_sequence as wasmSimulateSequence,
  solve_required_saving as wasmSolveRequiredSaving,
} from "../wasm/pkg/finance_core.js";
import { WASM_NOT_BUILT } from "../wasm/bridge";
import type {
  AccumulationInput,
  AccumulationOutput,
  AmortizeInput,
  AmortizeOutput,
  AmortizeRow,
  BaselineInput,
  BaselineOutput,
  EstimateTaxInput,
  EstimateTaxOutput,
  MonteCarloBootstrapInput,
  MonteCarloInput,
  MonteCarloOutput,
  PensionInput,
  PensionOutput,
  RentalAnalysisInput,
  RentalAnalysisOutput,
  RequiredSavingInput,
  RequiredSavingOutput,
  ReverseEstimateInput,
  ReverseEstimateOutput,
  SequenceDirection,
  SequenceSimInput,
  SequenceSimOutput,
  WasmFn,
} from "../wasm/bridge";
import type { PensionInputs } from "../data/pensionParams";

/** 统一结果类型：所有 service 调用都返回该形状，永不抛出 */
export type FinanceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; notReady: boolean };

// ---------------------------------------------------------------------------
// init（懒加载：首次调用前 await）
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  const existing = initPromise;
  if (!existing) {
    // init 的原生返回值为 Promise<InitOutput>，统一规整为 Promise<void>
    const pending: Promise<void> = init().then(
      () => undefined,
      (e: unknown) => {
        // 失败后重置，允许后续（如产物就位后的热更新）重试
        initPromise = null;
        throw e;
      },
    );
    initPromise = pending;
    return pending;
  }
  return existing;
}

function describeError(e: unknown): { error: string; notReady: boolean } {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes(WASM_NOT_BUILT)) {
    return {
      error: "计算核心未就绪：wasm 模块尚未构建（WASM_NOT_BUILT），等待 wasm-pack 产物就位后即可计算。",
      notReady: true,
    };
  }
  return { error: `计算核心加载失败：${msg}`, notReady: false };
}

// ---------------------------------------------------------------------------
// 输出形状轻量校验（JSON.parse 结果不直接信任）
// ---------------------------------------------------------------------------

function asRecord(raw: unknown, fnLabel: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${fnLabel} 返回格式异常（非对象）`);
  }
  return raw as Record<string, unknown>;
}

function num(obj: Record<string, unknown>, key: string, fnLabel: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`${fnLabel} 返回的 ${key} 字段异常`);
  }
  return v;
}

function numArray(obj: Record<string, unknown>, key: string, fnLabel: string): number[] {
  const v = obj[key];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "number" && Number.isFinite(x))) {
    throw new Error(`${fnLabel} 返回的 ${key} 字段异常`);
  }
  return v;
}

function numMatrix(obj: Record<string, unknown>, key: string, fnLabel: string): number[][] {
  const v = obj[key];
  if (!Array.isArray(v) || !v.every((row) => Array.isArray(row) && row.every((x) => typeof x === "number" && Number.isFinite(x)))) {
    throw new Error(`${fnLabel} 返回的 ${key} 字段异常`);
  }
  return v;
}

/** 契约约定：error 字段为空字符串表示成功，非空为可读中文错误 */
function businessError(obj: Record<string, unknown>): string | null {
  const e = obj["error"];
  return typeof e === "string" && e !== "" ? e : null;
}

async function invoke<T>(
  fnLabel: string,
  wasmFn: WasmFn,
  input: unknown,
  parse: (obj: Record<string, unknown>) => FinanceResult<T>,
): Promise<FinanceResult<T>> {
  try {
    await ensureInit();
    const raw = wasmFn(JSON.stringify(input));
    const parsed: unknown = JSON.parse(raw);
    return parse(asRecord(parsed, fnLabel));
  } catch (e) {
    const { error, notReady } = describeError(e);
    return { ok: false, error, notReady };
  }
}

// ---------------------------------------------------------------------------
// 各函数的输出解析
// ---------------------------------------------------------------------------

function parseBaseline(obj: Record<string, unknown>): FinanceResult<BaselineOutput> {
  const err = businessError(obj);
  const data: BaselineOutput = {
    realReturnPct: num(obj, "realReturnPct", "calculate_baseline"),
    multiplier: num(obj, "multiplier", "calculate_baseline"),
    criticalValue: num(obj, "criticalValue", "calculate_baseline"),
      // P7/E 费雪双口径（并行展示；480 教学口径仍为主输出）
      multiplierExact: num(obj, "multiplierExact", "calculate_baseline"),
      criticalValueExact: num(obj, "criticalValueExact", "calculate_baseline"),
    monthlyExpense: num(obj, "monthlyExpense", "calculate_baseline"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

function parseAmortize(obj: Record<string, unknown>): FinanceResult<AmortizeOutput> {
  const rowsRaw = obj["rows"];
  if (!Array.isArray(rowsRaw)) throw new Error("amortize 返回的 rows 字段异常");
  const rows: AmortizeRow[] = rowsRaw.map((row, i) => {
    const rec = asRecord(row, `amortize.rows[${i}]`);
    return {
      month: num(rec, "month", `amortize.rows[${i}]`),
      payment: num(rec, "payment", `amortize.rows[${i}]`),
      principalPart: num(rec, "principalPart", `amortize.rows[${i}]`),
      interestPart: num(rec, "interestPart", `amortize.rows[${i}]`),
      remaining: num(rec, "remaining", `amortize.rows[${i}]`),
    };
  });
  return {
    ok: true,
    data: {
      monthlyPayment: num(obj, "monthlyPayment", "amortize"),
      totalInterest: num(obj, "totalInterest", "amortize"),
      rows,
    },
  };
}

function parseRental(obj: Record<string, unknown>): FinanceResult<RentalAnalysisOutput> {
  const breakdownRaw = obj["breakdown"];
  if (typeof breakdownRaw !== "object" || breakdownRaw === null || Array.isArray(breakdownRaw)) {
    throw new Error("rental_analysis 返回的 breakdown 字段异常");
  }
  const breakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(breakdownRaw as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`rental_analysis 返回的 breakdown.${k} 字段异常`);
    }
    breakdown[k] = v;
  }
  return {
    ok: true,
    data: {
      monthlyPayment: num(obj, "monthlyPayment", "rental_analysis"),
      annualNetCashFlow: num(obj, "annualNetCashFlow", "rental_analysis"),
      paybackYears: num(obj, "paybackYears", "rental_analysis"),
      breakdown,
    },
  };
}

function parseReverse(obj: Record<string, unknown>): FinanceResult<ReverseEstimateOutput> {
  const err = businessError(obj);
  const data: ReverseEstimateOutput = {
    investableAssets: num(obj, "investableAssets", "reverse_estimate"),
    sustainableMonthly: num(obj, "sustainableMonthly", "reverse_estimate"),
    yearsSupported: num(obj, "yearsSupported", "reverse_estimate"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

function parseMonteCarlo(
  obj: Record<string, unknown>,
  fnLabel: string = "run_monte_carlo",
): FinanceResult<MonteCarloOutput> {
  return {
    ok: true,
    data: {
      depletionProb: num(obj, "depletionProb", fnLabel),
      medianTerminal: num(obj, "medianTerminal", fnLabel),
      p5: num(obj, "p5", fnLabel),
      p25: num(obj, "p25", fnLabel),
      p75: num(obj, "p75", fnLabel),
      p95: num(obj, "p95", fnLabel),
      samplePaths: numMatrix(obj, "samplePaths", fnLabel),
      // P2 新增输出字段（docs/p2-spec.md §2.1 / §2.4 services 行）
      sampleWithdrawalPaths: numMatrix(obj, "sampleWithdrawalPaths", fnLabel),
      withdrawalP5: num(obj, "withdrawalP5", fnLabel),
      withdrawalMedian: num(obj, "withdrawalMedian", fnLabel),
      withdrawalP95: num(obj, "withdrawalP95", fnLabel),
    },
  };
}

function parseSequence(obj: Record<string, unknown>): FinanceResult<SequenceSimOutput> {
  const err = businessError(obj);
  const data: SequenceSimOutput = {
    assetPath: numArray(obj, "assetPath", "simulate_sequence"),
    terminalAssets: num(obj, "terminalAssets", "simulate_sequence"),
    depletedYear: num(obj, "depletedYear", "simulate_sequence"),
    terminalMultiple: num(obj, "terminalMultiple", "simulate_sequence"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

function parseRequiredSaving(obj: Record<string, unknown>): FinanceResult<RequiredSavingOutput> {
  const err = businessError(obj);
  const data: RequiredSavingOutput = {
    requiredMonthlySaving: num(obj, "requiredMonthlySaving", "solve_required_saving"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

function parseTax(obj: Record<string, unknown>): FinanceResult<EstimateTaxOutput> {
  return {
    ok: true,
    data: {
      taxableIncome: num(obj, "taxableIncome", "estimate_tax"),
      tax: num(obj, "tax", "estimate_tax"),
      netIncome: num(obj, "netIncome", "estimate_tax"),
      effectiveRatePct: num(obj, "effectiveRatePct", "estimate_tax"),
    },
  };
}

// ---------------------------------------------------------------------------
// 对 UI 暴露的服务函数（永不抛出）
// ---------------------------------------------------------------------------

/** 480 法则基线（契约 calculate_baseline） */
export function calcBaseline(input: BaselineInput): Promise<FinanceResult<BaselineOutput>> {
  return invoke("calculate_baseline", wasmCalculateBaseline, input, parseBaseline);
}

/** 还款计划（契约 amortize） */
export function calcAmortize(input: AmortizeInput): Promise<FinanceResult<AmortizeOutput>> {
  return invoke("amortize", wasmAmortize, input, parseAmortize);
}

/** 买房收租分析（契约 rental_analysis） */
export function calcRental(input: RentalAnalysisInput): Promise<FinanceResult<RentalAnalysisOutput>> {
  return invoke("rental_analysis", wasmRentalAnalysis, input, parseRental);
}

/** 反向估算（契约 reverse_estimate） */
export function calcReverse(input: ReverseEstimateInput): Promise<FinanceResult<ReverseEstimateOutput>> {
  return invoke("reverse_estimate", wasmReverseEstimate, input, parseReverse);
}

/** 蒙特卡洛模拟（契约 run_monte_carlo） */
export function calcMonteCarlo(input: MonteCarloInput): Promise<FinanceResult<MonteCarloOutput>> {
  return invoke("run_monte_carlo", wasmRunMonteCarlo, input, parseMonteCarlo);
}

/** 税务估算（契约 estimate_tax） */
export function calcTax(input: EstimateTaxInput): Promise<FinanceResult<EstimateTaxOutput>> {
  return invoke("estimate_tax", wasmEstimateTax, input, parseTax);
}

function parseAccumulation(obj: Record<string, unknown>): FinanceResult<AccumulationOutput> {
  const err = businessError(obj);
  const finalRaw = obj["finalAssetPercentiles"];
  if (typeof finalRaw !== "object" || finalRaw === null || Array.isArray(finalRaw)) {
    throw new Error("simulate_accumulation 返回的 finalAssetPercentiles 字段异常");
  }
  const finalRec = finalRaw as Record<string, unknown>;
  const data: AccumulationOutput = {
    fiProbability: num(obj, "fiProbability", "simulate_accumulation"),
      // P7/P0-2 双指标：首触口径不动；存续口径新字段（sustainYears = 0 时恒 0.0 哨兵）
      sustainedProbability: num(obj, "sustainedProbability", "simulate_accumulation"),
    yearsP5: num(obj, "yearsP5", "simulate_accumulation"),
    yearsP25: num(obj, "yearsP25", "simulate_accumulation"),
    yearsMedian: num(obj, "yearsMedian", "simulate_accumulation"),
    yearsP75: num(obj, "yearsP75", "simulate_accumulation"),
    yearsP95: num(obj, "yearsP95", "simulate_accumulation"),
    neverReachedShare: num(obj, "neverReachedShare", "simulate_accumulation"),
    finalAssetPercentiles: {
      p5: num(finalRec, "p5", "simulate_accumulation.finalAssetPercentiles"),
      p25: num(finalRec, "p25", "simulate_accumulation.finalAssetPercentiles"),
      p50: num(finalRec, "p50", "simulate_accumulation.finalAssetPercentiles"),
      p75: num(finalRec, "p75", "simulate_accumulation.finalAssetPercentiles"),
      p95: num(finalRec, "p95", "simulate_accumulation.finalAssetPercentiles"),
    },
    samplePaths: numMatrix(obj, "samplePaths", "simulate_accumulation"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

/** 打工积累模拟（契约 simulate_accumulation） */
export function calcAccumulation(
  input: AccumulationInput,
): Promise<FinanceResult<AccumulationOutput>> {
  return invoke("simulate_accumulation", wasmSimulateAccumulation, input, parseAccumulation);
}

function parsePension(obj: Record<string, unknown>): FinanceResult<PensionOutput> {
  const err = businessError(obj);
  const data: PensionOutput = {
    yearsToRetire: num(obj, "yearsToRetire", "estimate_pension"),
      // P7/P0-1 桥接两字段（时间口径；纯生活费口径附加项归段 2——bridge.ts §i）
      bridgeYears: num(obj, "bridgeYears", "estimate_pension"),
      bridgeFundingNeeded: num(obj, "bridgeFundingNeeded", "estimate_pension"),
    basicPensionMonthly: num(obj, "basicPensionMonthly", "estimate_pension"),
    accountPensionMonthly: num(obj, "accountPensionMonthly", "estimate_pension"),
    pensionMonthly: num(obj, "pensionMonthly", "estimate_pension"),
    coverageRatio: num(obj, "coverageRatio", "estimate_pension"),
    adjustedMonthlyExpense: num(obj, "adjustedMonthlyExpense", "estimate_pension"),
    adjustedCriticalValue: num(obj, "adjustedCriticalValue", "estimate_pension"),
    multiplier: num(obj, "multiplier", "estimate_pension"),
    error: err ?? "",
  };
  if (err) return { ok: false, error: err, notReady: false };
  return { ok: true, data };
}

/** 社保养老金估算（契约 estimate_pension） */
export function calcPension(input: PensionInput): Promise<FinanceResult<PensionOutput>> {
  return invoke("estimate_pension", wasmEstimatePension, input, parsePension);
}

/** 蒙特卡洛历史自助抽样（契约 run_monte_carlo_bootstrap） */
export function calcMonteCarloBootstrap(
  input: MonteCarloBootstrapInput,
): Promise<FinanceResult<MonteCarloOutput>> {
  return invoke("run_monte_carlo_bootstrap", wasmRunMonteCarloBootstrap, input, (o) =>
    parseMonteCarlo(o, "run_monte_carlo_bootstrap"),
  );
}

/** 确定性序列模拟（契约 simulate_sequence，docs/p2-spec.md §3.1；无随机） */
export function calcSequence(input: SequenceSimInput): Promise<FinanceResult<SequenceSimOutput>> {
  return invoke("simulate_sequence", wasmSimulateSequence, input, parseSequence);
}

/** 目标日期反推所需月储蓄（契约 solve_required_saving，docs/p2-spec.md §5.1；闭式解） */
export function calcRequiredSaving(
  input: RequiredSavingInput,
): Promise<FinanceResult<RequiredSavingOutput>> {
  return invoke("solve_required_saving", wasmSolveRequiredSaving, input, parseRequiredSaving);
}

// ---------------------------------------------------------------------------
// P2 序列风险编排（docs/p2-spec.md §3.2；切片/重排由 TS 侧完成，核心零随机）
// ---------------------------------------------------------------------------

/** 单个滚动窗口的命运（起点年 / 期末倍数 / 耗尽年 / 逐年资产路径） */
export interface FateWindow {
  startYear: number;
  terminalMultiple: number;
  depletedYear: number;
  assetPath: number[];
}

/** 起点滚动结果：每窗口期末倍数 / 耗尽年 / 逐年资产路径 + 最好 / 中位 / 最差窗口下标 */
export interface SequenceRollingResult {
  windows: FateWindow[];
  /** 终值降序后最好 / 中位 / 最差窗口在 windows 数组中的下标 */
  bestIndex: number;
  medianIndex: number;
  worstIndex: number;
}

/**
 * 命运窗口选取（§3.2 中位口径的单一实现）：按 terminalMultiple 升序排序后取
 * 最好（最大）/ 最差（最小）/ 中位窗口——窗口数为偶数时取中间两位中 terminal
 * 较差者（取整数下标，保证「中位」窗口有 assetPath 可画）。
 * 平局裁定：terminalMultiple 为两位小数输出，相邻窗口常四舍五入到同值（如 sp500
 * H=10 中间两位 2,616,862.11 与 2,624,988.68 同为 2.62×），此时以 assetPath 末元素
 * （期末资产，两位小数 = 元级全精度）比较「较差者」；耗尽窗口路径全零，相互平局按
 * 原窗口顺序（稳定排序）。
 * runSequenceRolling 与 UI 侧积累口径滚动（§3.2 契约仅定义支取口径签名，
 * 验收 #7 要求两模式 × 两方向，积累口径滚动由面板循环 calcSequence 后复用本函数选取）共用。
 */
export function selectFateWindows(windows: FateWindow[]): {
  bestIndex: number;
  medianIndex: number;
  worstIndex: number;
} {
  const n = windows.length;
  // 字典序比较：先比两位小数倍数，平局再比 assetPath 末元素（期末资产，元级全精度）
  const cmp = (a: FateWindow, b: FateWindow): number => {
    if (a.terminalMultiple !== b.terminalMultiple) return a.terminalMultiple - b.terminalMultiple;
    const ta = a.assetPath.length > 0 ? a.assetPath[a.assetPath.length - 1] : 0;
    const tb = b.assetPath.length > 0 ? b.assetPath[b.assetPath.length - 1] : 0;
    return ta - tb;
  };
  const order = windows.map((_, i) => i).sort((x, y) => cmp(windows[x], windows[y]));
  const worstIndex = order[0];
  const bestIndex = order[n - 1];
  const medianIndex = n % 2 === 1 ? order[(n - 1) / 2] : order[n / 2 - 1];
  return { bestIndex, medianIndex, worstIndex };
}

/**
 * 起点滚动：对 series 逐年滑动窗长 H 的窗口（起点数 = N − H + 1），每起点调用一次
 * calcSequence（支取口径）；按 terminalMultiple 升序取中位窗口（窗口数为偶数时取
 * 中间两位中 terminal 较差者——取整数下标，保证「中位」窗口有 assetPath 可画）、
 * 最好与最差窗口。任一窗口调用失败即整体返回失败。
 *
 * 中位口径注：支取研究文档 §5.4-B 的中位数值（sp500 2.621×、csi300 1.387×）为
 * type-7 线性插值口径（中间两位的均值）；本契约取「较差者」以获得整数窗口下标，
 * 两口径差异 0.3%–8%（见 §3.3-B 注）。§3.3 锚点与 §9.2 断言一律按较差者口径。
 */
export async function runSequenceRolling(
  series: number[],
  firstYear: number,
  windowYears: number,
  currentAssets: number,
  annualSpend: number,
): Promise<FinanceResult<SequenceRollingResult>> {
  if (series.length < 1 || windowYears < 1 || windowYears > series.length) {
    return {
      ok: false,
      error: `起点滚动窗口数不足：序列长度 ${series.length} 不足以支撑窗长 ${windowYears} 年的滚动（窗长须在 1 ~ 序列长度之间）。`,
      notReady: false,
    };
  }
  const windows: FateWindow[] = [];
  for (let start = 0; start + windowYears <= series.length; start += 1) {
    const slice = series.slice(start, start + windowYears);
    const r = await calcSequence({
      series: slice,
      years: windowYears,
      direction: "withdrawal",
      currentAssets,
      annualSpend,
      annualSaving: 0,
    });
    if (!r.ok) return r;
    windows.push({
      startYear: firstYear + start,
      terminalMultiple: r.data.terminalMultiple,
      depletedYear: r.data.depletedYear,
      assetPath: r.data.assetPath,
    });
  }
  return { ok: true, data: { windows, ...selectFateWindows(windows) } };
}

/**
 * 三序对照：同一 series 的原始 / 升序 / 降序三个排列各跑一次 calcSequence；
 * direction = "withdrawal" 用 annualSpend，"accumulation" 用 annualSaving。
 */
export async function runSequenceReorder(
  series: number[],
  direction: SequenceDirection,
  currentAssets: number,
  annualSpend: number,
  annualSaving: number,
): Promise<FinanceResult<{ original: SequenceSimOutput; ascending: SequenceSimOutput; descending: SequenceSimOutput }>> {
  const run = (permuted: number[]): Promise<FinanceResult<SequenceSimOutput>> =>
    calcSequence({
      series: permuted,
      years: permuted.length,
      direction,
      currentAssets,
      annualSpend: direction === "withdrawal" ? annualSpend : 0,
      annualSaving: direction === "accumulation" ? annualSaving : 0,
    });
  const [original, ascending, descending] = await Promise.all([
    run(series),
    run([...series].sort((a, b) => a - b)),
    run([...series].sort((a, b) => b - a)),
  ]);
  if (!original.ok) return original;
  if (!ascending.ok) return ascending;
  if (!descending.ok) return descending;
  return {
    ok: true,
    data: { original: original.data, ascending: ascending.data, descending: descending.data },
  };
}

// ---------------------------------------------------------------------------
// P8 统一生命周期现金流引擎（docs/p8-spec.md §1/§2；TS 侧编排——零 Rust 导出面增量，
// src/wasm/src/*.rs 与 bridge.ts 逐字节不动，pass1/pass2 锁区零触碰）
// ---------------------------------------------------------------------------

/** 引擎递推防御下限（§1.4(c)；与随机样本防御 accumulation.rs:269-276 同源） */
const LIFECYCLE_SAMPLE_FLOOR = -0.99;
/** 时间线行数上限（§1.3；accumulation.rs:65 MAX_YEARS 同值） */
const LIFECYCLE_MAX_YEARS = 200;
/** estimate_pension 乘数族业务错误文案（pension.rs:223 / bridge.ts §i 契约定字；
 *  引擎错误分支据此区分「业务错误 → bridgeYears 保留计算值」与「校验失败 → 安全值 0」） */
const PENSION_REAL_RETURN_ERROR = "通胀率需低于名义回报率";
/** describeError 专属前缀（finance.ts:81-90）——wasm 层异常与业务错误的分界字面 */
const WASM_LAYER_ERROR_PREFIX = "计算核心";

/**
 * P8 统一生命周期输入（docs/p8-spec.md §1.1；41 字段 = base 7 + accum 12 + pension 8 +
 * loan 4 + rental 10）。全部字段为既有 store 切片 / bridge.ts 既有类型的原样引用——
 * 新增必填用户输入 = 0、新增 store 切片 = 0、share 载荷键增量 = 0（随 v4 自动携带）。
 * 类型落 finance.ts 而非 bridge.ts：LifecycleInput 不跨越 wasm 边界（TS 侧编排类型），
 * 进 bridge.ts 会制造「wasm 契约」的假增量（§1 定稿说明）。
 * pension.monthsDivisor 须由调用方经 effectiveMonthsDivisor 联动口径传入
 * （useCalculatorStore.ts:314 同源函数，禁两处内联重推）。
 */
export interface LifecycleInput {
  /** 7 字段 ← store.baselineInputs（bridge.ts:53-64 原样引用）；消费点 estimate_pension */
  base: BaselineInput;
  /** 12 字段 ← store.accumulationInputs（bridge.ts:472-500 原样引用）；均值参数
   *  （r_mean / i_mean）→ 时间线递推；σ / paths / seed 仅透传 simulate_accumulation
   *  （双指标引用），引擎自身递推零随机消费（§2.1）；monthlyExpense 同时是时间线
   *  生活费基流（§2.4 双参数族注记） */
  accum: AccumulationInput;
  /** 8 字段 ← store.pensionInputs（pensionParams.ts:57-77 原样引用） */
  pension: PensionInputs;
  /** 4 字段 ← store.loanInputs（bridge.ts:127-136）；本轮仅类型承载：不调用、不校验、
   *  不进递推（WF-04 homePurchase 事件年供款原子预留） */
  loan: AmortizeInput;
  /** 10 字段 ← store.rentalInputs（bridge.ts:173-196）；本轮仅类型承载（WF-04+ 持有成本对照预留） */
  rental: RentalAnalysisInput;
}

/**
 * 事件标记 schema（docs/p8-spec.md §1.2；形状预留——本轮 events 恒空数组，唯一施工
 * 标记走 YearRow.pensionStart 布尔；homePurchase / childBirth / healthPhase 施工归 WF-04+）
 */
export type LifecycleEventTag =
  | { kind: "pensionStart"; year: number }
  | { kind: "homePurchase"; year: number }
  | { kind: "childBirth"; year: number }
  | { kind: "healthPhase"; year: number; phase: string };

/**
 * 年度行（docs/p8-spec.md §1.2；8 字段）。精度口径（§2.3「递推链在舍入之前」，
 * accumulation.rs:301 先例）：各金额字段持有 f64 全精度递推值，round2 在展示层完成——
 * 耗尽判定层须全精度（§3.7 D2 修正：r=i 算例第 40 行 f64 残差 > 0、判定落第 41 行、
 * 展示层 round2 = 0.00，「480 个月 ÷ 12 = 40 年线性实耗」的教学闭合在展示层成立）。
 */
export interface YearRow {
  /** 相对年序 t，1..=horizon（1 起计，accumulation/montecarlo 同例） */
  year: number;
  /** 行首年龄 = pension.currentAge + year − 1（行覆盖年龄 [行首, 行首+1)） */
  age: number;
  /** 期初资产（元，round2 展示）＝上一年 closingAssets；第 1 年 = accum.currentAssets */
  openingAssets: number;
  /** 当年投入（名义元，round2 展示）：工作段 = (monthlyIncome − monthlyExpense)×12×(1+i)^t
   *  （accumulation.rs:279-280 年储蓄随通胀上行同式，含当年通胀；可为负）；停工后恒 0；
   *  耗尽次年起恒 0（§2.3 耗尽行语义） */
  contribution: number;
  /** 当年支取（名义元，round2 展示，净额口径）：桥接段 = 生活费全额；领取段 =
   *  max(0, 生活费 − pensionMonthly×12)（养老金隐式耗用于生活费、不再作为流入二次
   *  入账——净支取与「全额支取 + 流入」两写法代数恒等）；工作段恒 0；耗尽次年起恒 0 */
  withdrawal: number;
  /** 事件标记（本轮恒空数组，形状预留） */
  events: LifecycleEventTag[];
  /** 当年是否养老金起领 =（t == yearsToRetire + 1）——行首年龄恰等于起领年龄的首行
   *  （§3.7 D1 修正口径） */
  pensionStart: boolean;
  /** 期末资产（名义元，round2 展示）：closing = opening×(1+r_eff) + contribution −
   *  withdrawal；耗尽当年钳 0、其后行全字段恒 0（sequence.rs:133-141/:154-159 同款） */
  closingAssets: number;
}

/** 存续双指标（引用口径——引擎不重算，§2.1；sustainYears 输入回显，0 = 未度量哨兵
 *  bridge.ts:515-519，Rust 不引入 −1 特判） */
export interface LifecycleSurvival {
  /** ← simulate_accumulation fiProbability（pass1 口径，逐位引用） */
  fiProbability: number;
  /** ← simulate_accumulation sustainedProbability（pass2 口径，逐位引用） */
  sustainedProbability: number;
  /** 输入回显；0 = 未度量哨兵 */
  sustainYears: number;
}

/** 汇总（docs/p8-spec.md §1.3；10 字段 = 6 标量 + survival 3 子字段 + error） */
export interface LifecycleSummary {
  /** 实际模拟行数 = max(accum.years, yearsToRetire + 1)，上限 200 */
  horizon: number;
  /** FI 首达年（相对年序；−1 = 未达成，accumulation 年限哨兵同款）；判定
   *  closing_t ≥ targetValue×(1+i)^t，含 t = 0 初始判定；首触即记录、不回写 */
  fiFirstYear: number;
  /** 引用 estimate_pension bridgeYears（pension.rs:203-205 同式，不重算） */
  bridgeYears: number;
  /** 引用同上（pension.rs:290-303 纯生活费口径，不重算） */
  bridgeFundingNeeded: number;
  /** 引用 estimate_pension pensionMonthly（领取段恒额来源；错误分支安全值 0 →
   *  净支取退化为全额生活费） */
  pensionMonthly: number;
  /** 确定性路径耗尽年（1 起计；−1 = 存活——sequence.rs depletedYear 同款哨兵）；
   *  判定字面 = 全精度 closing ≤ 0（§2.3，D2 差一行现象的承载） */
  depletedYear: number;
  /** 存续口径——引用双指标，引擎不重算（§2.1 裁定） */
  survival: LifecycleSurvival;
  /** bridge.ts 全局错误约定（"" 成功 / 非空中文安全值）；聚合规则见 §1.4 */
  error: string;
}

/** P8 引擎输出（timeline 行数组 + summary；docs/p8-spec.md §1.3） */
export interface LifecycleOutput {
  timeline: YearRow[];
  summary: LifecycleSummary;
}

/** 单年样本（小数）；生产路径恒用均值 provider，测试缝可注入任意序列（§1.3 算例②⑥） */
export interface YearSamples {
  r: number;
  infl: number;
}

/** 样本注入缝：生产缺省 = 均值确定性口径；算例② / ⑥ 的序列断言经该缝注入 */
export type SampleProvider = (year: number) => YearSamples;

/**
 * 时间线装配参数（全部由 LifecycleInput 纯算术派生，与 wasm 无关——纯函数测试缝的
 * 承载面；WF-04 情景透镜演进同缝注入序列，仍零新随机消费，§2.1.4）。
 */
export interface TimelineArgs {
  /** 期初资产（元）＝ accum.currentAssets */
  currentAssets: number;
  /** 税后月收入（打工积累均值参数族，§2.4） */
  monthlyIncome: number;
  /** 月支出——时间线生活费基流（accum.monthlyExpense） */
  monthlyExpense: number;
  /** FI 目标值（基期名义；判定随通胀上行） */
  targetValue: number;
  /** 名义回报率均值（百分点） */
  rMeanPct: number;
  /** 通胀率均值（百分点） */
  iMeanPct: number;
  /** 工作段结束相对年 = max(0, targetRetireAge − currentAge)（pension.rs:200-202
   *  saturating 同口径；target < current = 已停工 → 0） */
  workEnd: number;
  /** 距养老金起领 = retireAge − currentAge（起领行 t = yearsToRetire + 1，D1 口径） */
  yearsToRetire: number;
  /** 领取段年养老金 = pensionMonthly × 12（0 = pension 错误分支退化 → 净支取 = 全额生活费） */
  pensionAnnual: number;
  /** 行首年龄原点（pension.currentAge） */
  currentAge: number;
  /** 行数 = max(accum.years, yearsToRetire + 1)，上限 200 */
  horizon: number;
}

/**
 * 时间线装配（纯函数、无 wasm 依赖、零随机——docs/p8-spec.md §1.3 测试缝）。
 * 生产路径 provider 缺省 = 每年 { r: r_eff, infl: i_eff }（均值确定性口径，同输入恒
 * 同输出）；递推 closing = opening×(1+r_t) + contribution − withdrawal，防御与既有
 * 模块逐字同源（§1.4）：
 *  (a) closing NaN / ≤ 0 → 耗尽：该行 closing 钳 0（当行投入/支取仍按公式记值——支出
 *      把资产打到零是真实发生的事）、其后行全字段恒 0（sequence.rs:133-141 break +
 *      :154-159 补零同款；NaN 同判）；
 *  (b) 正溢出钳 Number.MAX_VALUE（accumulation.rs:285-287 同款）；
 *  (c) 有效增长率 / 通胀因子下限钳 −0.99（accumulation.rs:269-276 同源；均值域由 wasm
 *      校验前置，TS 层不另立口径）。
 * 三阶段行语义（§2.3）：工作段（t ≤ workEnd）contribution = 月储蓄×12×(1+i)^t、
 * withdrawal = 0；桥接段（workEnd < t ≤ yearsToRetire）支取生活费全额；领取段
 * （t > yearsToRetire）支取 max(0, 生活费 − 养老金年额)。停工晚于起领（workEnd >
 * yearsToRetire，合法输入域 bridge.ts §i「不与 retireAge 做大小约束」）时两现金流
 * 独立入行（储蓄随停工、养老金随起领）——「养老金自起领年进入现金流」（cases §0.3）
 * 与「工作段储蓄至停工」两口径正交，重叠年份两字段并存。
 * 累计通胀用重复乘法（与 deriveTimelineSummary 的判定重构逐位同序）。
 */
export function assembleTimeline(args: TimelineArgs, provider?: SampleProvider): YearRow[] {
  const sample: SampleProvider =
    provider ??
    ((year: number) => ({
      r: Math.max(args.rMeanPct / 100, LIFECYCLE_SAMPLE_FLOOR),
      infl: Math.max(args.iMeanPct / 100, LIFECYCLE_SAMPLE_FLOOR),
    }));
  const savingBase = (args.monthlyIncome - args.monthlyExpense) * 12;
  const expenseBase = args.monthlyExpense * 12;
  const rows: YearRow[] = [];
  let opening = args.currentAssets;
  let cumInfl = 1;
  let depleted = false;
  for (let t = 1; t <= args.horizon; t += 1) {
    const age = args.currentAge + t - 1;
    if (depleted) {
      // 耗尽次年起全字段恒 0（sequence.rs:154-159 补零同款）
      rows.push({
        year: t,
        age,
        openingAssets: 0,
        contribution: 0,
        withdrawal: 0,
        events: [],
        pensionStart: false,
        closingAssets: 0,
      });
      continue;
    }
    const s = sample(t);
    const r = Math.max(s.r, LIFECYCLE_SAMPLE_FLOOR);
    const infl = Math.max(s.infl, LIFECYCLE_SAMPLE_FLOOR);
    cumInfl *= 1 + infl;
    // 工作段储蓄基流随通胀上行（accumulation.rs:280 年储蓄 × cum_infl 同式，含当年通胀；可为负）
    const contribution = t <= args.workEnd ? savingBase * cumInfl : 0;
    const living = expenseBase * cumInfl;
    // 净额口径：−max(0, C−P) ≡ −C + P（养老金隐式耗用于生活费，算例① 第 31 行复核即证）
    const withdrawal =
      t > args.yearsToRetire
        ? Math.max(0, living - args.pensionAnnual)
        : t > args.workEnd
          ? living
          : 0;
    const pensionStart = t === args.yearsToRetire + 1;
    let closing = opening * (1 + r) + contribution - withdrawal;
    if (Number.isNaN(closing) || closing <= 0) {
      // 耗尽行：当行投入/支取仍按公式记值、closing 钳 0、递推终止（sequence.rs:136-139 字面同款）
      rows.push({ year: t, age, openingAssets: opening, contribution, withdrawal, events: [], pensionStart, closingAssets: 0 });
      depleted = true;
      continue;
    }
    if (!Number.isFinite(closing)) closing = Number.MAX_VALUE;
    rows.push({ year: t, age, openingAssets: opening, contribution, withdrawal, events: [], pensionStart, closingAssets: closing });
    opening = closing;
  }
  return rows;
}

/**
 * 时间线汇总派生（纯函数）：FI 首达年 / 耗尽年 / 行数（docs/p8-spec.md §1.3）。
 * FI 判定 closing_t ≥ targetValue×∏(1+i_eff)（目标随通胀水涨，accumulation.rs:290-292
 * 同式），含 t = 0 初始判定（accumulation.rs:260 同构）；首触即记录、不回写
 * （accumulation.rs:289 if none 同构）。目标通胀因子按重复乘法重构（与装配层
 * cumInfl 逐位同序——pow 与连乘在 f64 下可差 ULP，判定层禁两套口径）。
 * 耗尽判定 = 任一行全精度 closing ≤ 0（装配层已把耗尽行钳 0——首个 ≤ 0 行即耗尽年；
 * sequence.rs depletedYear 哨兵同款：−1 = 存活）。D2 口径：判定用全精度行值，
 * 展示层 round2 不参与判定（否决「round2 后判定」新口径——会另立审计面）。
 */
export function deriveTimelineSummary(
  rows: YearRow[],
  args: TimelineArgs,
): { horizon: number; fiFirstYear: number; depletedYear: number } {
  let fiFirstYear = args.currentAssets >= args.targetValue ? 0 : -1;
  let inflFactor = 1;
  for (let t = 1; t <= rows.length; t += 1) {
    inflFactor *= 1 + Math.max(args.iMeanPct / 100, LIFECYCLE_SAMPLE_FLOOR);
    const closing = rows[t - 1].closingAssets;
    if (fiFirstYear < 0 && closing >= args.targetValue * inflFactor) fiFirstYear = t;
  }
  const depletedIndex = rows.findIndex((row) => row.closingAssets <= 0);
  return { horizon: rows.length, fiFirstYear, depletedYear: depletedIndex < 0 ? -1 : depletedIndex + 1 };
}

/**
 * 统一生命周期现金流（docs/p8-spec.md §1.3/§2；TS 侧编排，永不抛出纪律照抄）：
 * calcPension（养老金金额 / 桥接两字段）与 calcAccumulation（存续双指标引用）并行 →
 * 纯确定性年度行装配（均值口径 provider，引擎递推零随机消费——accum.seed / paths 仅
 * 透传既有双指标调用，无 seed 进入引擎递推，§2.1）→ 汇总。
 *
 * 错误聚合口径（§1.4 钉死）：summary.error = 固定次序首个非空——先 estimate_pension
 * 业务错误、后 simulate_accumulation 业务错误、皆空则 ""。各子块按既有错误分支降级、
 * 互不牵连：
 *  - pension 业务错误（含 base 实际回报 ≤ 0 的乘数族分支 bridge.ts:103-104 口径）→
 *    pensionMonthly = 0、bridgeFundingNeeded = 0、bridgeYears 保留计算值（pension.rs:
 *    209-225 回显先例）；parsePension 在业务错误分支丢弃数据载荷（finance.ts parsePension
 *    `if (err) return { ok: false, … }`），故此处以 pension.rs:203-205 逐字同式本地重推
 *    bridgeYears（仅限错误文案恰为乘数族契约定字时；其余错误 = 解析/校验失败 → 安全值 0，
 *    bridge.ts §i 错误分支形状），时间线继续装配（领取段净支取退化为全额生活费）；
 *  - accumulation 业务错误（含 σ ≤ 0 经分享链注入的情形）→ survival 双 0、sustainYears
 *    照常回显，时间线不受影响（确定性递推不消费 σ）；
 *  - 解析 / wasm 层异常（error 以 describeError 专属前缀「计算核心」开头）→
 *    FinanceResult 错误通道，UI 走既有 Alert 分支。
 * 两族分水岭（§1.4）：实际回报 ≤ 0 是「乘数族」输出与「行族」输出的分水岭——乘数族走
 * 契约错误分支（0 + 中文 error，禁 Infinity/NaN/负乘数/panic），行族（年度时间线）在
 * r_mean = i_mean 下数学良态（支取退化为 40 年线性实耗、积累退化为储蓄定速实际积累），
 * 不得以乘数族错误静默吞掉可算的行（research-p8-cases §4 断言①、§7 边界结论 2）。
 */
export async function calcLifecycle(input: LifecycleInput): Promise<FinanceResult<LifecycleOutput>> {
  try {
    const yearsToRetire = input.pension.retireAge - input.pension.currentAge;
    const targetRetire = input.pension.targetRetireAge ?? input.pension.retireAge;
    const workEnd = Math.max(0, targetRetire - input.pension.currentAge);
    const horizon = Math.min(LIFECYCLE_MAX_YEARS, Math.max(input.accum.years, yearsToRetire + 1));
    const [pensionRes, accumRes] = await Promise.all([
      calcPension({ ...input.base, ...input.pension }),
      calcAccumulation(input.accum),
    ]);
    // wasm 层失败（describeError 专属前缀）→ 统一错误通道（pension 优先，永不抛出）
    for (const res of [pensionRes, accumRes]) {
      if (!res.ok && res.error.startsWith(WASM_LAYER_ERROR_PREFIX)) {
        return { ok: false, error: res.error, notReady: res.notReady };
      }
    }
    // ---- pension 子块（业务错误降级，§1.4）----
    const pensionOk = pensionRes.ok ? pensionRes.data : null;
    const pensionError = pensionRes.ok ? "" : pensionRes.error;
    const bridgeYears = pensionOk
      ? pensionOk.bridgeYears
      : pensionError === PENSION_REAL_RETURN_ERROR
        ? // 乘数族业务错误分支：bridgeYears 保留计算值（pension.rs:203-205 逐字同式——
          // saturating 语义：target ≤ current → 桥接 = yearsToRetire；target ≥ retire → 0）
          Math.max(0, input.pension.retireAge - Math.max(targetRetire, input.pension.currentAge))
        : 0; // 解析/校验失败 → 安全值 0（bridge.ts §i 错误分支形状）
    const bridgeFundingNeeded = pensionOk ? pensionOk.bridgeFundingNeeded : 0;
    const pensionMonthly = pensionOk ? pensionOk.pensionMonthly : 0;
    // ---- accumulation 子块（survival 引用口径——逐位透传，引擎不重算，§2.1）----
    const accumOk = accumRes.ok ? accumRes.data : null;
    const survival: LifecycleSurvival = {
      fiProbability: accumOk ? accumOk.fiProbability : 0,
      sustainedProbability: accumOk ? accumOk.sustainedProbability : 0,
      sustainYears: input.accum.sustainYears ?? 0,
    };
    // ---- 确定性时间线装配（§2.3 三阶段行语义）----
    const args: TimelineArgs = {
      currentAssets: input.accum.currentAssets,
      monthlyIncome: input.accum.monthlyIncome,
      monthlyExpense: input.accum.monthlyExpense,
      targetValue: input.accum.targetValue,
      rMeanPct: input.accum.nominalReturnMeanPct,
      iMeanPct: input.accum.inflationMeanPct,
      workEnd,
      yearsToRetire,
      pensionAnnual: pensionMonthly * 12,
      currentAge: input.pension.currentAge,
      horizon,
    };
    const timeline = assembleTimeline(args);
    const derived = deriveTimelineSummary(timeline, args);
    // 错误聚合固定次序：先 pension、后 accumulation、皆空 ""（§1.4）
    const accumError = accumRes.ok ? "" : accumRes.error;
    const summary: LifecycleSummary = {
      horizon: derived.horizon,
      fiFirstYear: derived.fiFirstYear,
      bridgeYears,
      bridgeFundingNeeded,
      pensionMonthly,
      depletedYear: derived.depletedYear,
      survival,
      error: pensionError !== "" ? pensionError : accumError,
    };
    return { ok: true, data: { timeline, summary } };
  } catch (e) {
    return {
      ok: false,
      error: `生命周期引擎调用失败：${e instanceof Error ? e.message : String(e)}`,
      notReady: false,
    };
  }
}
