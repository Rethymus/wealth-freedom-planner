/**
 * 占位 stub 的类型声明 —— 形状与真实 wasm-pack（--target web）产物对齐；
 * 产物覆盖本目录时以 wasm-bindgen 生成的版本为准。
 * 函数与语义契约见 src/wasm/bridge.ts。
 */

/** 初始化 WASM 模块；input 为二进制来源（inline 或 URL），缺省按 wasm-pack 约定定位同目录 .wasm */
export default function init(input?: string | URL): Promise<void>;

/** 480 法则基线：JSON（BaselineInput）→ JSON（BaselineOutput） */
export function calculate_baseline(input: string): string;

/** 还款计划：JSON（AmortizeInput）→ JSON（AmortizeOutput） */
export function amortize(input: string): string;

/** 买房收租分析：JSON（RentalAnalysisInput）→ JSON（RentalAnalysisOutput） */
export function rental_analysis(input: string): string;

/** 反向估算：JSON（ReverseEstimateInput）→ JSON（ReverseEstimateOutput） */
export function reverse_estimate(input: string): string;

/** 蒙特卡洛模拟：JSON（MonteCarloInput）→ JSON（MonteCarloOutput） */
export function run_monte_carlo(input: string): string;

/** 税务估算：JSON（EstimateTaxInput）→ JSON（EstimateTaxOutput） */
export function estimate_tax(input: string): string;
