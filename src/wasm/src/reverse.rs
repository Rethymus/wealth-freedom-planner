//! reverse_estimate —— 反向估算。契约见 src/wasm/bridge.ts ReverseEstimateInput/Output。
//!
//! 口径（以 bridge.ts 为准）：
//! - investableAssets = max(0, totalAssets − childReserve − healthReserve − majorInvestment)，
//!   精确输出不做舍入；
//! - sustainableMonthly = investableAssets × 实际回报率（小数）÷ 12（永续提取口径）。
//!   恒等于「可投资产 ÷ 480 乘数」：乘数 = 12 ÷ 实际回报率（小数），
//!   故 investableAssets ÷ 乘数 = investableAssets × 实际回报率 ÷ 12，两种表述一致；
//! - yearsSupported = 12 ÷ 实际回报率（百分点）= 480 乘数 ÷ 100（bridge.ts 明确口径）。
//!   注：任务描述中「年金公式/逐年递推」的可维持年限口径在本输入集下不可实现 ——
//!   月支出恰为永续提取额（= 可投资产 × 月实际回报率）时，资产永不耗尽（年限为无穷，
//!   JSON 无法表达），故按 bridge.ts 的显式公式实现；
//! - 实际回报率 ≤ 0：error 非空（同 baseline 的「通胀率需低于名义回报率」），
//!   sustainableMonthly = 0，yearsSupported = 0，investableAssets 仍返回扣除后的值。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReverseInput {
    /// 总资产（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    total_assets: Decimal,
    /// 子女预留（元，一次性）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    child_reserve: Decimal,
    /// 健康预留（元，一次性）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    health_reserve: Decimal,
    /// 重大投入（元，一次性）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    major_investment: Decimal,
    /// 名义年化回报率（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    nominal_return_pct: Decimal,
    /// 年通胀率（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    inflation_pct: Decimal,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReverseOutput {
    /// 可投资资产（元）= max(0, 总资产 − 三项预留)
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    investable_assets: Decimal,
    /// 可持续月开销（元/月，永续提取口径，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    sustainable_monthly: Decimal,
    /// 可支撑年限（年）= 12 ÷ 实际回报率（百分点），两位小数
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    years_supported: Decimal,
    /// "" 表示成功
    error: String,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&ReverseOutput {
        investable_assets: Decimal::ZERO,
        sustainable_monthly: Decimal::ZERO,
        years_supported: Decimal::ZERO,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"investableAssets\":0,\"sustainableMonthly\":0,\"yearsSupported\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<ReverseOutput, String> {
    let inp: ReverseInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("总资产", inp.total_assets)?;
    check_nonneg_money("子女预留", inp.child_reserve)?;
    check_nonneg_money("健康预留", inp.health_reserve)?;
    check_nonneg_money("重大投入", inp.major_investment)?;
    check_pct_signed("名义回报率", inp.nominal_return_pct)?;
    check_pct_signed("通胀率", inp.inflation_pct)?;

    // 可投资产 = 总资产 − 三项预留，不足则取 0
    let investable =
        (inp.total_assets - inp.child_reserve - inp.health_reserve - inp.major_investment)
            .max(Decimal::ZERO);

    // 实际回报率（百分点）= 名义 − 通胀（精确相减）
    let real = inp.nominal_return_pct - inp.inflation_pct;
    if real <= Decimal::ZERO {
        return Ok(ReverseOutput {
            investable_assets: investable,
            sustainable_monthly: Decimal::ZERO,
            years_supported: Decimal::ZERO,
            error: "通胀率需低于名义回报率".to_string(),
        });
    }

    // 永续提取口径：可持续月支出 = 可投资产 × 实际回报率（小数）÷ 12
    let annual_real_frac = pct_to_frac(real);
    let sustainable = round2(
        investable
            .checked_mul(annual_real_frac)
            .ok_or("数值溢出：请检查可投资产规模")?
            .checked_div(Decimal::from(12))
            .ok_or("可持续月支出计算失败")?,
    );
    // 可支撑年限 = 12 ÷ 实际回报率（百分点）= 480 乘数 ÷ 100（bridge.ts 口径）
    let years = round2(
        Decimal::from(12)
            .checked_div(real)
            .ok_or("实际回报率过小，无法计算可支撑年限")?,
    );

    Ok(ReverseOutput {
        investable_assets: investable,
        sustainable_monthly: sustainable,
        years_supported: years,
        error: String::new(),
    })
}

// ---------------------------------------------------------------------------
// solve_required_saving —— 目标日期反推所需月储蓄（闭式解，确定性，F4）
// ---------------------------------------------------------------------------
//
// 契约见 src/wasm/bridge.ts RequiredSavingInput/Output（§5.1 逐字）：
// - 全程 rust_decimal，幂用循环 checked_mul（T ≤ 200）；
// - 校验在 check_pct_signed 之上追加硬约束：均值两字段 > −100（百分点）——
//   (1+r) > 0、(1+i) > 0 是闭式解幂运算不变号的前提；
// - q = (1+i) ÷ (1+r)；F = Σ_{t=1..T} (1+i)^t (1+r)^{T−t}：
//     q == 1：F = T × (1+r)^T；q ≠ 1：F = (1+r)^T × q × (q^T − 1) ÷ (q − 1)；
// - requiredMonthlySaving = (targetValue × (1+i)^T − currentAssets × (1+r)^T) ÷ (12 × F)；
//   F 恒 > 0，无除零分支；结果可为负（资产已超前于随通胀上行的目标）。

/// 目标日期反推输入
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredSavingInput {
    /// 当前资产（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    current_assets: Decimal,
    /// 财富自由目标值（基期名义值）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    target_value: Decimal,
    /// 目标年限（1–200 整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    years: Decimal,
    /// 名义回报率均值（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    nominal_return_mean_pct: Decimal,
    /// 通胀率均值（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    inflation_mean_pct: Decimal,
}

/// 目标日期反推输出
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredSavingOutput {
    /// 所需月储蓄（元/月，两位小数；可为负 = 无需储蓄即可达成）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    required_monthly_saving: Decimal,
    /// "" 表示成功
    error: String,
}

/// 目标日期反推：JSON（RequiredSavingInput）→ JSON（RequiredSavingOutput）
pub fn handle_required_saving(input: &str) -> String {
    match compute_required_saving(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output_required_saving("输出序列化失败")),
        Err(e) => error_output_required_saving(&e),
    }
}

/// 错误/异常时的安全输出形状（requiredMonthlySaving = 0）。
pub fn error_output_required_saving(msg: &str) -> String {
    serde_json::to_string(&RequiredSavingOutput {
        required_monthly_saving: Decimal::ZERO,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| "{\"requiredMonthlySaving\":0,\"error\":\"内部错误\"}".to_string())
}

/// Decimal 幂（循环 checked_mul；指数 ≤ 200，bridge.ts 契约口径）。
/// 溢出（如病态高利率长期限）转为中文错误，不 panic。
fn pow_dec(base: Decimal, exp: u32) -> Result<Decimal, String> {
    let mut acc = Decimal::ONE;
    for _ in 0..exp {
        acc = acc
            .checked_mul(base)
            .ok_or("数值溢出：幂运算超出可表示范围，请检查回报率与年限")?;
    }
    Ok(acc)
}

fn compute_required_saving(input: &str) -> Result<RequiredSavingOutput, String> {
    let inp: RequiredSavingInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    // 校验顺序固定（bridge.ts 契约）：金额非负 → years ∈ [1,200] 整数 → 均值两字段
    // check_pct_signed → 硬约束 > −100（(1+r) > 0、(1+i) > 0）
    check_nonneg_money("当前资产", inp.current_assets)?;
    check_nonneg_money("财富自由目标值", inp.target_value)?;
    let years = to_u32_int("目标年限", inp.years, 1, 200)?;
    check_pct_signed("名义回报率均值", inp.nominal_return_mean_pct)?;
    check_pct_signed("通胀率均值", inp.inflation_mean_pct)?;
    ensure(
        inp.nominal_return_mean_pct > Decimal::from(-100)
            && inp.inflation_mean_pct > Decimal::from(-100),
        "回报率与通胀率不得低于 −100%",
    )?;

    let r = pct_to_frac(inp.nominal_return_mean_pct);
    let i = pct_to_frac(inp.inflation_mean_pct);
    let one_plus_r = Decimal::ONE + r; // > 0（硬约束已保证）
    let one_plus_i = Decimal::ONE + i; // > 0（硬约束已保证）
    let t = years;

    let g_r = pow_dec(one_plus_r, t)?;
    let g_i = pow_dec(one_plus_i, t)?;

    // q = (1+i) ÷ (1+r)（Decimal 精确除；i = r 时精确得 1）
    let q = one_plus_i
        .checked_div(one_plus_r)
        .ok_or("数值溢出：比率计算超出可表示范围")?;

    // 年储蓄终值因子 F = Σ_{t=1..T} (1+i)^t (1+r)^{T−t}
    let f = if q == Decimal::ONE {
        // i == r：每项恰为 (1+r)^T → F = T × (1+r)^T
        Decimal::from(t)
            .checked_mul(g_r)
            .ok_or("数值溢出：终值因子计算超出可表示范围")?
    } else {
        // q ≠ 1：F = (1+r)^T × q × (q^T − 1) ÷ (q − 1)
        let q_t = pow_dec(q, t)?;
        let numer = g_r
            .checked_mul(q)
            .ok_or("数值溢出：终值因子计算超出可表示范围")?
            .checked_mul(q_t.checked_sub(Decimal::ONE).ok_or("终值因子计算失败")?)
            .ok_or("数值溢出：终值因子计算超出可表示范围")?;
        let denom = q.checked_sub(Decimal::ONE).ok_or("终值因子计算失败")?;
        // q ≠ 1 → denom ≠ 0；F 恒 > 0（每项为正），无除零分支
        numer
            .checked_div(denom)
            .ok_or("数值溢出：终值因子计算超出可表示范围")?
    };

    // requiredMonthlySaving = (targetValue × (1+i)^T − currentAssets × (1+r)^T) ÷ (12 × F)
    let twelve_f = Decimal::from(12)
        .checked_mul(f)
        .ok_or("数值溢出：终值因子计算超出可表示范围")?;
    let numer = inp
        .target_value
        .checked_mul(g_i)
        .ok_or("数值溢出：目标终值超出可表示范围")?
        .checked_sub(
            inp.current_assets
                .checked_mul(g_r)
                .ok_or("数值溢出：资产终值超出可表示范围")?,
        )
        .ok_or("终值差额计算失败")?;
    let required = numer
        .checked_div(twelve_f)
        .ok_or("数值溢出：月储蓄计算超出可表示范围")?;

    Ok(RequiredSavingOutput {
        required_monthly_saving: round2(required),
        error: String::new(),
    })
}

// ---------------------------------------------------------------------------
// 单元测试（bridge.ts §9.2 required_saving 两测试的确定性分支在集成测试覆盖；
// 此处补闭式解代数恒等式的快速单元验证）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn required_saving_q_equals_one_branch_exact() {
        // q = 1（i == r）：required = (target − assets) ÷ (12 × T)——(1+r)^T 精确相消。
        // assets 500,000、target 1,635,200、T = 20、r = i = 2.5% → 1,135,200 ÷ 240 = 4,730.00（精确）
        let out = handle_required_saving(
            r#"{"currentAssets":500000,"targetValue":1635200,"years":20,"nominalReturnMeanPct":2.5,"inflationMeanPct":2.5}"#,
        );
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v.get("error").and_then(|x| x.as_str()).unwrap(), "");
        let got = v.get("requiredMonthlySaving").and_then(|x| x.as_f64()).unwrap();
        assert!((got - 4_730.0).abs() < 1e-9, "q=1 分支精确值 4,730.00（实际 {got}）");
    }

    #[test]
    fn required_saving_forward_identity_holds() {
        // §5.1 口径对应：以反解值 S 做确定性正推（第 t 年末入金 S × 12 × (1+i)^t、
        // 资产按 (1+r) 复利），第 T 年末资产恰等于 targetValue × (1+i)^T。
        // ① wasm S 与独立 f64 闭式（研究复算脚本同式）一致（±0.01，含输出两位小数舍入）；
        // ② 用未舍入的闭式 S 正推，恒等式在浮点噪声内成立（相对 1e-9）。
        let (assets0, target, t, r_pct, i_pct) = (500_000.0_f64, 1_635_200.0_f64, 30_u32, 4.5_f64, 2.0_f64);
        let out = handle_required_saving(&format!(
            r#"{{"currentAssets":{assets0},"targetValue":{target},"years":{t},"nominalReturnMeanPct":{r_pct},"inflationMeanPct":{i_pct}}}"#
        ));
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v.get("error").and_then(|x| x.as_str()).unwrap(), "");
        let s_wasm = v.get("requiredMonthlySaving").and_then(|x| x.as_f64()).unwrap();

        let r = r_pct / 100.0;
        let i = i_pct / 100.0;
        let q = (1.0 + i) / (1.0 + r);
        let f = if (q - 1.0).abs() < 1e-15 {
            t as f64 * (1.0 + r).powi(t as i32)
        } else {
            (1.0 + r).powi(t as i32) * q * (q.powi(t as i32) - 1.0) / (q - 1.0)
        };
        let s_exact =
            (target * (1.0 + i).powi(t as i32) - assets0 * (1.0 + r).powi(t as i32)) / (12.0 * f);
        assert!(
            (s_wasm - s_exact).abs() <= 0.01,
            "wasm S {s_wasm} 与独立闭式 {s_exact} 一致（±0.01）"
        );

        // 用未舍入闭式 S 正推（恒等式检验；输出值经两位小数舍入后恒等式余差
        // 为舍入位移 ≈ 0.005 × 12 × F，由锚点测试 ±0.01 单独覆盖）
        let mut assets = assets0;
        for year in 1..=t {
            assets = assets * (1.0 + r) + s_exact * 12.0 * (1.0 + i).powi(year as i32);
        }
        let expected = target * (1.0 + i).powi(t as i32);
        assert!(
            (assets - expected).abs() <= 1e-6 * expected,
            "第 {t} 年末资产 {assets} 应恰等于随通胀上行的目标 {expected}"
        );
    }
}
