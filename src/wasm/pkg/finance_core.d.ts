/* tslint:disable */
/* eslint-disable */

/**
 * 还款计划：JSON（AmortizeInput）→ JSON（AmortizeOutput）
 */
export function amortize(input: string): string;

/**
 * 480 法则基线：JSON（BaselineInput）→ JSON（BaselineOutput）
 */
export function calculate_baseline(input: string): string;

/**
 * 社保养老金估算：JSON（PensionInput）→ JSON（PensionOutput）
 */
export function estimate_pension(input: string): string;

/**
 * 税务估算：JSON（EstimateTaxInput）→ JSON（EstimateTaxOutput）
 */
export function estimate_tax(input: string): string;

/**
 * 买房收租分析：JSON（RentalAnalysisInput）→ JSON（RentalAnalysisOutput）
 */
export function rental_analysis(input: string): string;

/**
 * 反向估算：JSON（ReverseEstimateInput）→ JSON（ReverseEstimateOutput）
 */
export function reverse_estimate(input: string): string;

/**
 * 蒙特卡洛模拟：JSON（MonteCarloInput）→ JSON（MonteCarloOutput）
 */
export function run_monte_carlo(input: string): string;

/**
 * 蒙特卡洛历史自助抽样：JSON（MonteCarloBootstrapInput）→ JSON（MonteCarloOutput）
 */
export function run_monte_carlo_bootstrap(input: string): string;

/**
 * 打工积累模拟：JSON（AccumulationInput）→ JSON（AccumulationOutput）
 */
export function simulate_accumulation(input: string): string;

/**
 * 确定性序列模拟（序列风险对照）：JSON（SequenceSimInput）→ JSON（SequenceSimOutput）
 */
export function simulate_sequence(input: string): string;

/**
 * 目标日期反推所需月储蓄（闭式解）：JSON（RequiredSavingInput）→ JSON（RequiredSavingOutput）
 */
export function solve_required_saving(input: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly amortize: (a: number, b: number, c: number) => void;
    readonly calculate_baseline: (a: number, b: number, c: number) => void;
    readonly estimate_pension: (a: number, b: number, c: number) => void;
    readonly estimate_tax: (a: number, b: number, c: number) => void;
    readonly rental_analysis: (a: number, b: number, c: number) => void;
    readonly reverse_estimate: (a: number, b: number, c: number) => void;
    readonly run_monte_carlo: (a: number, b: number, c: number) => void;
    readonly run_monte_carlo_bootstrap: (a: number, b: number, c: number) => void;
    readonly simulate_accumulation: (a: number, b: number, c: number) => void;
    readonly simulate_sequence: (a: number, b: number, c: number) => void;
    readonly solve_required_saving: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
