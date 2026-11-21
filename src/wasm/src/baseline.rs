//! calculate_baseline —— 480 法则基线（契约见 src/wasm/bridge.ts BaselineInput/Output）。
//!
//! 口径：
//! - realReturnPct = nominalReturnPct − inflationPct（百分点相减，原样精确输出）；
//! - multiplier = 12 ÷ (realReturnPct / 100) = 1200 ÷ realReturnPct（百分点），
//!   按任务要求保留两位小数（四舍五入）；「480 法则」即实际回报率 2.5% 时乘数恰为 480；
//! - criticalValue = monthlyExpense × multiplier（使用上一步舍入后的乘数，与输出字段一致）
//!     + childCount × costPerChild + healthReserve + majorInvestment；
//! - multiplierExact（P7/E 费雪双口径）：round2(12 × (1 + inflationPct/100)
//!   ÷ ((nominalReturnPct − inflationPct)/100))，代数恒等于 12 ÷ ((1+r)/(1+i) − 1)
//!   （Decimal 域无中间舍入；计算一律用精确式，近似式仅作教学口径注，
//!   docs/research-retirement-models.md §4.2——并行展示，不做选项切换）；
//! - criticalValueExact = round2(monthlyExpense × multiplierExact + 附加项)
//!   （先舍入后相乘，与 480 口径同形；480 教学口径全部字段不动、仍为主输出）；
//! - 实际回报率 ≤ 0：error = 「通胀率需低于名义回报率」，multiplier / multiplierExact = 0，
//!   criticalValue / criticalValueExact = 0，realReturnPct 仍返回计算值，monthlyExpense 回显输入。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaselineInput {
    /// 月开销（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_expense: Decimal,
    /// 子女数量（人，非负整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    child_count: Decimal,
    /// 每孩总抚养成本（元/孩）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    cost_per_child: Decimal,
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
pub struct BaselineOutput {
    /// 实际回报率（百分点），精确输出不做舍入
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    real_return_pct: Decimal,
    /// 480 法则乘数（两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    multiplier: Decimal,
    /// 精确乘数（P7/E 费雪口径，两位小数）＝ round2(12 × (1 + 通胀/100)
    /// ÷ (实际回报率/100))，代数恒等于 12 ÷ ((1+r)/(1+i) − 1)；实际回报 ≤ 0 → 0
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    multiplier_exact: Decimal,
    /// 目标本金（元，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    critical_value: Decimal,
    /// 精确口径目标本金（元，两位小数）＝ round2(monthlyExpense × multiplierExact
    /// + 附加项)（先舍入后相乘，与 480 口径同形）；实际回报 ≤ 0 → 0
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    critical_value_exact: Decimal,
    /// 回显输入的月开销（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_expense: Decimal,
    /// "" 表示成功
    error: String,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状（数值字段取安全值 0）。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&BaselineOutput {
        real_return_pct: Decimal::ZERO,
        multiplier: Decimal::ZERO,
        multiplier_exact: Decimal::ZERO,
        critical_value: Decimal::ZERO,
        critical_value_exact: Decimal::ZERO,
        monthly_expense: Decimal::ZERO,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"realReturnPct\":0,\"multiplier\":0,\"multiplierExact\":0,\"criticalValue\":0,\"criticalValueExact\":0,\"monthlyExpense\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<BaselineOutput, String> {
    let inp: BaselineInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("月开销", inp.monthly_expense)?;
    ensure(
        inp.child_count >= Decimal::ZERO && inp.child_count % Decimal::ONE == Decimal::ZERO,
        "子女数量须为非负整数",
    )?;
    check_nonneg_money("每孩抚养成本", inp.cost_per_child)?;
    check_nonneg_money("健康预留", inp.health_reserve)?;
    check_nonneg_money("重大投入", inp.major_investment)?;
    check_pct_signed("名义回报率", inp.nominal_return_pct)?;
    check_pct_signed("通胀率", inp.inflation_pct)?;

    // 实际回报率（百分点）= 名义 − 通胀（精确相减）
    let real = inp.nominal_return_pct - inp.inflation_pct;
    if real <= Decimal::ZERO {
        return Ok(BaselineOutput {
            real_return_pct: real,
            multiplier: Decimal::ZERO,
            multiplier_exact: Decimal::ZERO,
            critical_value: Decimal::ZERO,
            critical_value_exact: Decimal::ZERO,
            monthly_expense: inp.monthly_expense,
            error: "通胀率需低于名义回报率".to_string(),
        });
    }

    // 乘数 = 12 ÷ (实际回报率/100) = 1200 ÷ 实际回报率（百分点），两位小数。
    // checked_div 防御：实际回报率为极小正数时除法结果可能超出 Decimal 表示范围。
    let multiplier = round2(
        Decimal::from(12)
            .checked_div(pct_to_frac(real))
            .ok_or("实际回报率过小，无法计算 480 法则乘数")?,
    );

    // 精确乘数（费雪口径，P7/E）：12 × (1 + 通胀/100) ÷ (实际回报率/100)
    // ——代数恒等于 12 ÷ ((1+r)/(1+i) − 1)，Decimal 域无中间舍入（先算后 round2）；
    // 教学近似式 r≈r_nom−π 仅作口径注（research §4.2，并行展示、不做选项切换）
    let one_plus_infl = Decimal::ONE + pct_to_frac(inp.inflation_pct);
    let multiplier_exact = round2(
        Decimal::from(12)
            .checked_mul(one_plus_infl)
            .ok_or("数值溢出：请检查通胀率规模")?
            .checked_div(pct_to_frac(real))
            .ok_or("实际回报率过小，无法计算费雪精确乘数")?,
    );

    // 临界值 = 月开销 × 乘数（舍入后的乘数，与输出字段一致）
    //   + 孩数 × 单孩成本 + 健康预留 + 重大投入
    let base = inp
        .monthly_expense
        .checked_mul(multiplier)
        .ok_or("数值溢出：请检查月开销与乘数规模")?;
    let children = inp
        .child_count
        .checked_mul(inp.cost_per_child)
        .ok_or("数值溢出：请检查子女抚养成本规模")?;
    let critical = round2(base + children + inp.health_reserve + inp.major_investment);

    // 精确口径临界值 = 月开销 × 精确乘数（先舍入后相乘，与 480 口径同形）+ 同一组附加项；
    // 附加项聚合逻辑复用上方 children 等原值，不复制进 UI（单一事实来源，audit §3.3）
    let base_exact = inp
        .monthly_expense
        .checked_mul(multiplier_exact)
        .ok_or("数值溢出：请检查月开销与精确乘数规模")?;
    let critical_exact = round2(
        base_exact
            .checked_add(children)
            .ok_or("数值溢出")?
            .checked_add(inp.health_reserve)
            .ok_or("数值溢出")?
            .checked_add(inp.major_investment)
            .ok_or("数值溢出")?,
    );

    Ok(BaselineOutput {
        real_return_pct: real,
        multiplier,
        multiplier_exact,
        critical_value: critical,
        critical_value_exact: critical_exact,
        monthly_expense: inp.monthly_expense,
        error: String::new(),
    })
}
