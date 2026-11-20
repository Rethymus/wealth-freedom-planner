//! finance-core —— 财富自由规划工具的计算核心（Rust → WASM）。
//!
//! 契约与语义：`src/wasm/bridge.ts`（单一事实来源）。所有导出函数签名为
//! `(input: string) => string`：JSON 进、JSON 出（serde_json）。
//!
//! 精度纪律：
//! - 金额与百分比运算一律 `rust_decimal::Decimal`；
//! - 输入 JSON 数字按字面量精确解析为 Decimal（serde_json `arbitrary_precision`
//!   + rust_decimal serde 助手），不经 f64 中转；输出 Decimal 亦按字面量数字
//!   精确序列化；
//! - 唯一例外：蒙特卡洛模拟内部按 rand/rand_distr 约定使用 f64（统计抽样，
//!   非金额精确运算），见 montecarlo.rs 注释；
//! - 输出金额统一舍入到 2 位小数（四舍五入 MidpointAwayFromZero）。
//!
//! 健壮性约定（bridge.ts 第 4 条）：任何输入路径不得 panic —— 算术使用
//! checked 运算并对输入做范围校验，导出层再以 catch_unwind 兜底，
//! panic 一律转换为对应函数的错误输出 JSON。
//!
//! 错误约定（bridge.ts 第 3 条）：输出 JSON 中 `error` = "" 表示成功；
//! 非空为人可读的中文错误说明，此时其余数值字段取安全值（0 / -1 / 空数组等）。
//! baseline 与 reverse_estimate 的 TS 接口声明了 error 字段；其余四个函数的
//! TS 接口未声明，本实现仍输出 error 字段以统一遵循全局错误约定（增量兼容）。

pub mod accumulation;
pub mod amort;
pub mod baseline;
pub mod bootstrap;
pub mod common;
pub mod montecarlo;
pub mod pension;
pub mod rental;
pub mod reverse;
pub mod sequence;
pub mod tax;
pub mod withdrawal;

use wasm_bindgen::prelude::*;

/// 统一执行入口：拦截 panic 并转换为对应函数的错误输出。
fn run_safe<F, E>(f: F, error_output: E) -> String
where
    F: FnOnce() -> String,
    E: FnOnce(&str) -> String,
{
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        Ok(json) => json,
        Err(payload) => {
            let msg = if let Some(s) = payload.downcast_ref::<&str>() {
                (*s).to_string()
            } else if let Some(s) = payload.downcast_ref::<String>() {
                s.clone()
            } else {
                "未知内部异常".to_string()
            };
            error_output(&format!("内部计算异常（已拦截）：{msg}"))
        }
    }
}

/// 480 法则基线：JSON（BaselineInput）→ JSON（BaselineOutput）
#[wasm_bindgen]
pub fn calculate_baseline(input: &str) -> String {
    run_safe(|| baseline::handle(input), baseline::error_output)
}

/// 还款计划：JSON（AmortizeInput）→ JSON（AmortizeOutput）
#[wasm_bindgen]
pub fn amortize(input: &str) -> String {
    run_safe(|| amort::handle(input), amort::error_output)
}

/// 买房收租分析：JSON（RentalAnalysisInput）→ JSON（RentalAnalysisOutput）
#[wasm_bindgen]
pub fn rental_analysis(input: &str) -> String {
    run_safe(|| rental::handle(input), rental::error_output)
}

/// 反向估算：JSON（ReverseEstimateInput）→ JSON（ReverseEstimateOutput）
#[wasm_bindgen]
pub fn reverse_estimate(input: &str) -> String {
    run_safe(|| reverse::handle(input), reverse::error_output)
}

/// 蒙特卡洛模拟：JSON（MonteCarloInput）→ JSON（MonteCarloOutput）
#[wasm_bindgen]
pub fn run_monte_carlo(input: &str) -> String {
    run_safe(|| montecarlo::handle(input), montecarlo::error_output)
}

/// 税务估算：JSON（EstimateTaxInput）→ JSON（EstimateTaxOutput）
#[wasm_bindgen]
pub fn estimate_tax(input: &str) -> String {
    run_safe(|| tax::handle(input), tax::error_output)
}

/// 打工积累模拟：JSON（AccumulationInput）→ JSON（AccumulationOutput）
#[wasm_bindgen]
pub fn simulate_accumulation(input: &str) -> String {
    run_safe(|| accumulation::handle(input), accumulation::error_output)
}

/// 蒙特卡洛历史自助抽样：JSON（MonteCarloBootstrapInput）→ JSON（MonteCarloOutput）
#[wasm_bindgen]
pub fn run_monte_carlo_bootstrap(input: &str) -> String {
    run_safe(|| bootstrap::handle(input), bootstrap::error_output)
}

/// 社保养老金估算：JSON（PensionInput）→ JSON（PensionOutput）
#[wasm_bindgen]
pub fn estimate_pension(input: &str) -> String {
    run_safe(|| pension::handle(input), pension::error_output)
}

/// 确定性序列模拟（序列风险对照）：JSON（SequenceSimInput）→ JSON（SequenceSimOutput）
#[wasm_bindgen]
pub fn simulate_sequence(input: &str) -> String {
    run_safe(|| sequence::handle(input), sequence::error_output)
}

/// 目标日期反推所需月储蓄（闭式解）：JSON（RequiredSavingInput）→ JSON（RequiredSavingOutput）
#[wasm_bindgen]
pub fn solve_required_saving(input: &str) -> String {
    run_safe(
        || reverse::handle_required_saving(input),
        reverse::error_output_required_saving,
    )
}
