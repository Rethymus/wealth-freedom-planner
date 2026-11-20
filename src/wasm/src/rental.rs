//! rental_analysis —— 买房收租分析。契约见 src/wasm/bridge.ts RentalAnalysisInput/Output。
//!
//! 口径（与 bridge.ts RentalBreakdown 逐键一致）：
//! - loanAmount = price × (1 − downPaymentPct/100)；downPayment = price × downPaymentPct/100；
//! - 年毛租金 = monthlyRent × 12；年空置损失 = 毛租金 × vacancyRatePct/100；
//!   年有效租金 = 毛租金 − 空置损失（即任务描述中「月租 × 12 × (1 − 空置率)」的
//!   「年租金净收入」口径 —— 扣除空置后的净租金收入）；
//! - 年租金税负 = 年有效租金 × rentTaxRatePct/100（计税基数为扣除空置后的有效租金，
//!   与 bridge.ts RentalBreakdown.annualRentTax 注释一致；非按净利润计税）；
//! - 年维护成本 = price × maintenanceAnnualRatePct/100；年物业费 = propertyFeeMonthly × 12；
//!   其他年化持有成本原样；
//! - 年供款 = 月供 × 12，月供按等额本息复用 amort::build_schedule（首付 100% 时贷款为 0，
//!   月供记 0，不进入摊销流程）；
//! - 年净现金流 = 有效租金 − 租金税 − 维护 − 物业费 − 其他 − 年供款。
//!   为保证 breakdown 各分项相加与净现金流自洽，各分项先按分（两位小数）舍入，
//!   再以舍入后的分项求和；
//! - 回本年限 = 首付 ÷ 年净现金流（两位小数）；年净现金流 ≤ 0 时 paybackYears = -1
//!   （JSON 无法表达 Infinity），并在 breakdown 中以 paybackImpossible = 1 标注
//!   「无法回本」（正常回本时为 0）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::amort::{build_schedule, Method};
use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RentalInput {
    /// 房屋总价（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    price: Decimal,
    /// 首付比例（百分点，[0, 100]）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    down_payment_pct: Decimal,
    /// 贷款年利率（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    loan_annual_rate_pct: Decimal,
    /// 贷款年限（年）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    loan_years: Decimal,
    /// 月租金（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_rent: Decimal,
    /// 空置率（百分点，[0, 100]）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    vacancy_rate_pct: Decimal,
    /// 维护成本年费率（百分点，按房价计）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    maintenance_annual_rate_pct: Decimal,
    /// 物业费（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    property_fee_monthly: Decimal,
    /// 其他年化持有成本（元/年）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    other_annual_cost: Decimal,
    /// 租金税负（百分点，按有效租金计）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    rent_tax_rate_pct: Decimal,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RentalBreakdownOut {
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    loan_amount: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    down_payment: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_gross_rent: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_vacancy_loss: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_effective_rent: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_rent_tax: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_maintenance: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_property_fee: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_other_cost: Decimal,
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_loan_payment: Decimal,
    /// 1 = 现金流 ≤ 0「无法回本」；0 = 正常
    payback_impossible: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RentalOutput {
    /// 月供（等额本息）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_payment: Decimal,
    /// 年净现金流（元/年）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_net_cash_flow: Decimal,
    /// 静态回本年限（年）；现金流 ≤ 0 时为 -1
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    payback_years: Decimal,
    /// 明细拆解（键集见 RentalBreakdownOut / bridge.ts RentalBreakdown）
    breakdown: RentalBreakdownOut,
    /// "" 表示成功（bridge.ts 全局错误约定的增量兼容字段）
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
    let breakdown = RentalBreakdownOut {
        loan_amount: Decimal::ZERO,
        down_payment: Decimal::ZERO,
        annual_gross_rent: Decimal::ZERO,
        annual_vacancy_loss: Decimal::ZERO,
        annual_effective_rent: Decimal::ZERO,
        annual_rent_tax: Decimal::ZERO,
        annual_maintenance: Decimal::ZERO,
        annual_property_fee: Decimal::ZERO,
        annual_other_cost: Decimal::ZERO,
        annual_loan_payment: Decimal::ZERO,
        payback_impossible: 0,
    };
    serde_json::to_string(&RentalOutput {
        monthly_payment: Decimal::ZERO,
        annual_net_cash_flow: Decimal::ZERO,
        payback_years: Decimal::ZERO,
        breakdown,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| "{\"monthlyPayment\":0,\"annualNetCashFlow\":0,\"paybackYears\":0,\"breakdown\":{},\"error\":\"内部错误\"}".to_string())
}

fn compute(input: &str) -> Result<RentalOutput, String> {
    let inp: RentalInput = serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("房屋总价", inp.price)?;
    ensure(inp.price > Decimal::ZERO, "房屋总价须大于 0")?;
    check_pct_range("首付比例", inp.down_payment_pct, Decimal::ZERO, Decimal::from(100))?;
    ensure(
        inp.loan_annual_rate_pct >= Decimal::ZERO && inp.loan_annual_rate_pct <= max_rate_pct(),
        "贷款年利率须在 [0, 24]（百分点）范围内",
    )?;
    let months = to_u32_int(
        "贷款月数（年限×12）",
        inp.loan_years * Decimal::from(12),
        1,
        MAX_MONTHS,
    )?;
    check_nonneg_money("月租金", inp.monthly_rent)?;
    check_pct_range("空置率", inp.vacancy_rate_pct, Decimal::ZERO, Decimal::from(100))?;
    check_pct_range("维护成本年费率", inp.maintenance_annual_rate_pct, Decimal::ZERO, Decimal::from(100))?;
    check_nonneg_money("物业费", inp.property_fee_monthly)?;
    check_nonneg_money("其他年化持有成本", inp.other_annual_cost)?;
    check_pct_range("租金税负", inp.rent_tax_rate_pct, Decimal::ZERO, Decimal::from(100))?;

    // 贷款与首付
    let down = round2(inp.price * inp.down_payment_pct / Decimal::from(100));
    let loan = round2(inp.price - down);

    // 月供（等额本息）；全额首付时贷款为 0，月供记 0，不进入摊销
    let monthly = if loan > Decimal::ZERO {
        build_schedule(loan, inp.loan_annual_rate_pct, months, Method::EqualPayment)?
            .monthly_payment
    } else {
        Decimal::ZERO
    };
    let annual_loan_payment = round2(monthly * Decimal::from(12));

    // 租金侧（各分项先舍入到分，再求和，保证 breakdown 自洽）
    let gross = round2(inp.monthly_rent * Decimal::from(12));
    let vacancy_loss = round2(gross * inp.vacancy_rate_pct / Decimal::from(100));
    let effective = gross - vacancy_loss;
    // 计税基数 = 年有效租金（扣除空置后的净租金收入）
    let rent_tax = round2(effective * inp.rent_tax_rate_pct / Decimal::from(100));
    let maintenance = round2(inp.price * inp.maintenance_annual_rate_pct / Decimal::from(100));
    let property_fee = round2(inp.property_fee_monthly * Decimal::from(12));
    let other = round2(inp.other_annual_cost);

    let net = effective - rent_tax - maintenance - property_fee - other - annual_loan_payment;

    // 回本年限 = 首付 ÷ 年净现金流；现金流 ≤ 0 时 -1（JSON 无法表达 Infinity）
    let (payback, impossible) = if net > Decimal::ZERO {
        (
            round2(down.checked_div(net).ok_or("回本年限计算溢出")?),
            0u8,
        )
    } else {
        (Decimal::from(-1), 1u8)
    };

    let breakdown = RentalBreakdownOut {
        loan_amount: loan,
        down_payment: down,
        annual_gross_rent: gross,
        annual_vacancy_loss: vacancy_loss,
        annual_effective_rent: effective,
        annual_rent_tax: rent_tax,
        annual_maintenance: maintenance,
        annual_property_fee: property_fee,
        annual_other_cost: other,
        annual_loan_payment,
        payback_impossible: impossible,
    };

    Ok(RentalOutput {
        monthly_payment: monthly,
        annual_net_cash_flow: net,
        payback_years: payback,
        breakdown,
        error: String::new(),
    })
}
