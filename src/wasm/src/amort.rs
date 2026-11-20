//! amortize —— 还款计划（等额本息 / 等额本金）。契约见 src/wasm/bridge.ts AmortizeInput/Output。
//!
//! 口径（与 bridge.ts「Rust 侧实现遵循」一致）：
//! - 月利率 i = annualRatePct / 100 / 12，期数 n = years × 12（须为整数月）；
//! - 等额本息（equal_payment）：月供 = P·i·(1+i)^n / ((1+i)^n − 1)，
//!   由 rust_finprim 0.5.1 `tvm::pmt`（rust_decimal 特性）以 Decimal 全程计算，
//!   其返回值按 Excel 约定为负（现金流出），取负号转为正的月供；
//!   i = 0 时退化为月供 = P/n（bridge.ts 明确口径）。
//! - 等额本金（equal_principal）：每期偿还本金 = round2(P/n)（末期吸收舍入余数），
//!   利息 = round2(当期期初余额 × i)；monthlyPayment 输出为首月还款额（bridge.ts 口径）。
//! - 还款明细表为本 crate 自建的「两位小数台账」：每期利息 = round2(期初余额 × i)，
//!   本金 = 月供 − 利息（等额本息）或固定本金（等额本金），余额逐期扣减，
//!   末期本金 = 期初余额，remaining 精确清零。
//!   未使用 rust_finprim 的 `amort_schedule`：其舍入模式下本金/利息各自独立舍入，
//!   会导致每期 payment ≠ principalPart + interestPart，无法保证台账自洽
//!   （已记入交付 deviations；月供公式本身仍复用其 `tvm::pmt`）。
//! - 全部金额输出为两位小数（四舍五入）；末期 remaining = 0。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::common::*;

/// 还款方式
#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Method {
    /// 等额本息
    EqualPayment,
    /// 等额本金
    EqualPrincipal,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmortizeInput {
    /// 贷款本金（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    principal: Decimal,
    /// 年利率（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_rate_pct: Decimal,
    /// 贷款年限（年；×12 须为整数月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    years: Decimal,
    /// 还款方式：equal_payment | equal_principal
    method: Method,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmortizeRowOut {
    /// 期次，从 1 开始
    month: u32,
    /// 当月还款总额（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    payment: Decimal,
    /// 当月偿还本金（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    principal_part: Decimal,
    /// 当月利息（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    interest_part: Decimal,
    /// 当月还款后的剩余本金（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    remaining: Decimal,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmortizeOutput {
    /// 月供：等额本息为固定值；等额本金为首月还款额
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_payment: Decimal,
    /// 全周期利息合计（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    total_interest: Decimal,
    /// 全部期次明细，长度 = years × 12
    rows: Vec<AmortizeRowOut>,
    /// "" 表示成功（bridge.ts 全局错误约定的增量兼容字段）
    error: String,
}

/// 台账构建结果（供 rental_analysis 复用）。
pub(crate) struct Schedule {
    pub monthly_payment: Decimal,
    pub total_interest: Decimal,
    pub rows: Vec<AmortizeRowOut>,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&AmortizeOutput {
        monthly_payment: Decimal::ZERO,
        total_interest: Decimal::ZERO,
        rows: Vec::new(),
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"monthlyPayment\":0,\"totalInterest\":0,\"rows\":[],\"error\":\"内部错误\"}".to_string()
    })
}

fn compute(input: &str) -> Result<AmortizeOutput, String> {
    let inp: AmortizeInput = serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("贷款本金", inp.principal)?;
    ensure(inp.principal > Decimal::ZERO, "贷款本金须大于 0")?;
    ensure(
        inp.annual_rate_pct >= Decimal::ZERO && inp.annual_rate_pct <= max_rate_pct(),
        "年利率须在 [0, 24]（百分点）范围内",
    )?;
    let months = to_u32_int(
        "贷款月数（年限×12）",
        inp.years * Decimal::from(12),
        1,
        MAX_MONTHS,
    )?;

    let sched = build_schedule(inp.principal, inp.annual_rate_pct, months, inp.method)?;
    Ok(AmortizeOutput {
        monthly_payment: sched.monthly_payment,
        total_interest: sched.total_interest,
        rows: sched.rows,
        error: String::new(),
    })
}

/// 构建两位小数台账的还款计划。输入参数假定已通过校验（rental 复用时同样先校验）。
pub(crate) fn build_schedule(
    principal: Decimal,
    annual_rate_pct: Decimal,
    months: u32,
    method: Method,
) -> Result<Schedule, String> {
    let n = Decimal::from(months);
    // 月利率 i = 年率/100/12
    let i = pct_to_frac(annual_rate_pct) / Decimal::from(12);

    // 等额本息固定月供
    let monthly_fixed = match method {
        Method::EqualPayment => {
            if i.is_zero() {
                round2(principal / n) // bridge.ts：r = 0 时月供 = P/n
            } else {
                // rust_finprim tvm::pmt 按 Excel 约定对正本金返回负值，取负转正
                round2(-rust_finprim::tvm::pmt(i, n, principal, None, None))
            }
        }
        Method::EqualPrincipal => Decimal::ZERO, // 首月还款额在循环后确定
    };
    // 等额本金每期固定本金（两位小数，末期吸收余数）
    let per_principal = match method {
        Method::EqualPrincipal => round2(principal / n),
        Method::EqualPayment => Decimal::ZERO,
    };

    let mut rows = Vec::with_capacity(months as usize);
    let mut bal = principal;
    let mut total_interest = Decimal::ZERO;

    for k in 1..=months {
        // 当期利息 = round2(期初余额 × 月利率)
        let interest_r = round2(bal * i);
        let principal_r = if k == months {
            // 末期本金 = 期初余额，吸收全部舍入余数，余额精确清零
            bal
        } else {
            let p = match method {
                Method::EqualPayment => monthly_fixed - interest_r,
                Method::EqualPrincipal => per_principal,
            };
            // 防御：极病态参数（如超长期的小额贷款）下理论上可能出现 -0.01 级别的
            // 负本金，钳制为 0；正常输入不会触发。
            if p < Decimal::ZERO {
                Decimal::ZERO
            } else {
                p
            }
        };
        let payment = principal_r + interest_r; // 台账自洽：payment = principal + interest
        bal -= principal_r;
        total_interest += interest_r;
        rows.push(AmortizeRowOut {
            month: k,
            payment,
            principal_part: principal_r,
            interest_part: interest_r,
            remaining: bal,
        });
    }

    let monthly_payment = match method {
        Method::EqualPayment => monthly_fixed,
        // bridge.ts：等额本金的 monthlyPayment 为首月还款额
        Method::EqualPrincipal => rows[0].payment,
    };

    Ok(Schedule {
        monthly_payment,
        total_interest,
        rows,
    })
}
