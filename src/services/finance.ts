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
