//! estimate_tax —— 税务估算（分段累进）。契约见 src/wasm/bridge.ts EstimateTaxInput/Output。
//!
//! 口径（以 bridge.ts 为准）：
//! - taxableIncome = max(0, grossAnnualIncome − standardDeduction)，精确输出不做舍入；
//! - 超额累进：税档 bands 按 lower 升序给定，第 i 档覆盖 [lower_i, lower_{i+1})，
//!   末档到 +∞；tax = Σ_i (min(taxable, lower_{i+1}) − lower_i)⁺ × rate_i；
//! - 中国个税的「速算扣除数」已在 TS 数据侧换算为等效的分段下限（lower 升序），
//!   Rust 侧只实现分段累进，不做速算扣除处理；
//! - 净收入 = gross − tax（tax 为舍入后的两位小数税额）；
//! - 有效税率（百分点）= tax ÷ gross × 100（两位小数；gross = 0 时返回 0）；
//! - 校验：bands 非空、lower ≥ 0 且非降序、rate ∈ [0, 1] 且单调不降（累进结构，
//!   小数形式，0.03 = 3%；税率回退的税档在入口报错，不静默出数）。
//!
//! 交叉验证：rust_finprim 0.5.1 `amort_dep_tax::progressive_tax`（(上限, 税率) 表格式，
//! 末档须为 Decimal::MAX）在测试中用作独立参照实现，见 tests/integration.rs。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBandIn {
    /// 该档起征下限（应纳税所得额）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    lower: Decimal,
    /// 该档税率（小数形式，0.03 表示 3%）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    rate: Decimal,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimateTaxInput {
    /// 年度税前总收入
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    gross_annual_income: Decimal,
    /// 标准扣除额
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    standard_deduction: Decimal,
    /// 超额累进税档（lower 升序）
    bands: Vec<TaxBandIn>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimateTaxOutput {
    /// 应纳税所得额 = max(0, 税前 − 标准扣除)，精确输出
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    taxable_income: Decimal,
    /// 年度税额（分段累进，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    tax: Decimal,
    /// 税后收入 = 税前 − 税
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    net_income: Decimal,
    /// 有效税率（百分点，两位小数；税前为 0 时返回 0）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    effective_rate_pct: Decimal,
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
    serde_json::to_string(&EstimateTaxOutput {
        taxable_income: Decimal::ZERO,
        tax: Decimal::ZERO,
        net_income: Decimal::ZERO,
        effective_rate_pct: Decimal::ZERO,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"taxableIncome\":0,\"tax\":0,\"netIncome\":0,\"effectiveRatePct\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<EstimateTaxOutput, String> {
    let inp: EstimateTaxInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("税前收入", inp.gross_annual_income)?;
    check_nonneg_money("标准扣除额", inp.standard_deduction)?;
    ensure(!inp.bands.is_empty(), "税档表不能为空")?;
    for (idx, b) in inp.bands.iter().enumerate() {
        ensure(
            b.lower >= Decimal::ZERO && b.lower <= money_cap(),
            &format!("第 {} 档下限须为不小于 0 且不超过 1e15 的数值", idx + 1),
        )?;
        ensure(
            b.rate >= Decimal::ZERO && b.rate <= Decimal::ONE,
            &format!("第 {} 档税率须为 [0, 1] 的小数", idx + 1),
        )?;
        if idx > 0 {
            ensure(
                b.lower >= inp.bands[idx - 1].lower,
                "税档下限须按升序排列",
            )?;
            ensure(
                b.rate >= inp.bands[idx - 1].rate,
                "税档税率须单调不降（累进结构）",
            )?;
        }
    }

    // 应纳税所得额 = max(0, 税前 − 标准扣除)
    let taxable = (inp.gross_annual_income - inp.standard_deduction).max(Decimal::ZERO);

    // 分段累进：第 i 档覆盖 [lower_i, lower_{i+1})，末档到 +∞
    let mut tax = Decimal::ZERO;
    for (idx, b) in inp.bands.iter().enumerate() {
        let upper = inp
            .bands
            .get(idx + 1)
            .map(|x| x.lower)
            .unwrap_or(Decimal::MAX);
        let in_band = (taxable.min(upper) - b.lower).max(Decimal::ZERO);
        if in_band > Decimal::ZERO {
            tax += in_band * b.rate;
        }
    }
    let tax = round2(tax);

    let net = inp.gross_annual_income - tax;
    let effective = if inp.gross_annual_income > Decimal::ZERO {
        round2(
            tax.checked_div(inp.gross_annual_income)
                .ok_or("有效税率计算失败")?
                * Decimal::from(100),
        )
    } else {
        Decimal::ZERO
    };

    Ok(EstimateTaxOutput {
        taxable_income: taxable,
        tax,
        net_income: net,
        effective_rate_pct: effective,
        error: String::new(),
    })
}
