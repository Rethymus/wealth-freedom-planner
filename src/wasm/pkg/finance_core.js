/**
 * 占位 stub —— 真实 wasm-pack 产物（`wasm-pack build --target web --out-dir src/wasm/pkg`）
 * 就位后会整体覆盖本目录；本 stub 保留入库，用于在核心未构建时提供可导入、
 * 可类型提示的占位实现。
 *
 * 契约与语义见 src/wasm/bridge.ts：所有函数 JSON 进 JSON 出，签名 (input: string) => string。
 * 本 stub 的同步导出被调用一律抛出 Error("WASM_NOT_BUILT")。
 */

function notBuilt() {
  throw new Error("WASM_NOT_BUILT");
}

/** 480 法则基线（契约：bridge.ts BaselineInput → BaselineOutput） */
export function calculate_baseline(input) {
  void input;
  notBuilt();
}

/** 还款计划（契约：bridge.ts AmortizeInput → AmortizeOutput） */
export function amortize(input) {
  void input;
  notBuilt();
}

/** 买房收租分析（契约：bridge.ts RentalAnalysisInput → RentalAnalysisOutput） */
export function rental_analysis(input) {
  void input;
  notBuilt();
}

/** 反向估算（契约：bridge.ts ReverseEstimateInput → ReverseEstimateOutput） */
export function reverse_estimate(input) {
  void input;
  notBuilt();
}

/** 蒙特卡洛模拟（契约：bridge.ts MonteCarloInput → MonteCarloOutput） */
export function run_monte_carlo(input) {
  void input;
  notBuilt();
}

/** 税务估算（契约：bridge.ts EstimateTaxInput → EstimateTaxOutput） */
export function estimate_tax(input) {
  void input;
  notBuilt();
}

/**
 * 初始化 WASM 模块（wasm-pack --target web 约定的默认导出）。
 * stub 阶段返回以 WASM_NOT_BUILT 拒绝的 Promise。
 */
export default function init(input) {
  void input;
  return Promise.reject(new Error("WASM_NOT_BUILT"));
}
