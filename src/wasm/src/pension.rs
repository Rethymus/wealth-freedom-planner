//! estimate_pension —— 社保养老金估算（简化两层公式）。契约见 src/wasm/bridge.ts
//! PensionInput/PensionOutput。
//!
//! 公式口径（docs/p1-spec.md §3.0 逐字，施工不得偏离）：
//! - 基础养老金 ≈（社平工资 + 社平工资 × 缴费基数指数）÷ 2 × 缴费年限 × 1%；
//! - 个人账户养老金 = 个人账户余额估计 ÷ 计发月数；
//! - 预计月养老金 = 基础 + 个人账户。
//! - 大胆简化（诚实标注，面板内固定免责文案）：社平工资与缴费指数不做逐年增长
//!   假设（按用户填入值直接代入）；账户余额按当前估计值直接除以计发月数（不做
//!   未来增值假设）；不考虑过渡性养老金、视同缴费年限折算、省级计发基数差异与
//!   每年待遇上调。
//! - 调整后参考线：调整后月开销 = max(0, 月开销 − 预计月养老金)；
//!   调整后参考线 = 调整后月开销 × 乘数 + 育儿 + 健康 + 重大投入（乘数与
//!   calculate_baseline 同口径：round2(12 ÷ 实际回报率小数)，先舍入后相乘）。
//!   恒等式 adjustedCriticalValue == calculate_baseline(同附加项,
//!   monthlyExpense = adjustedMonthlyExpense).criticalValue 由集成测试锁定。
//!
//! 实际回报率 ≤ 0 分支：与 calculate_baseline 同文案同分支形状 —— error =
//! 「通胀率需低于名义回报率」，金额/乘数类字段全部 0；yearsToRetire 仍返回
//! 计算值（对应 baseline 分支回显 monthlyExpense 的同形处理）。
//!
//! 精度声明：本函数为纯金额精确运算（无随机抽样），全程 rust_decimal；
//! 输出金额统一 round2（四舍五入 MidpointAwayFromZero）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PensionInput {
    // BaselineInput 全字段（与 baseline.rs 逐字段同法）
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
    // 养老金专属字段（bridge.ts PensionInput）
    /// 当前年龄（16–70，整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    current_age: Decimal,
    /// 预期退休年龄（40–75，整数，须大于当前年龄）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    retire_age: Decimal,
    /// 预期截至退休的累计缴费年限（0–50，整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    contrib_years: Decimal,
    /// 平均缴费基数指数（小数形式，[0, 10]）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    contrib_index: Decimal,
    /// 个人账户余额估计（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    account_balance: Decimal,
    /// 计发口径社会平均工资（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    avg_monthly_wage: Decimal,
    /// 计发月数（1–600，整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    months_divisor: Decimal,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PensionOutput {
    /// 距退休年限 = retireAge − currentAge（整数）
    years_to_retire: u32,
    /// 基础养老金（元/月，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    basic_pension_monthly: Decimal,
    /// 个人账户养老金（元/月，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    account_pension_monthly: Decimal,
    /// 预计月养老金（元/月，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pension_monthly: Decimal,
    /// 养老金覆盖率（两位小数，可 > 1 不封顶；月开销 0 时为 0）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    coverage_ratio: Decimal,
    /// 调整后月开销（元/月，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    adjusted_monthly_expense: Decimal,
    /// 调整后财富自由参考线（元，两位小数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    adjusted_critical_value: Decimal,
    /// 480 法则乘数（与 calculate_baseline 同口径两位小数回显）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    multiplier: Decimal,
    /// "" 表示成功
    error: String,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状：years_to_retire: 0、其余数值字段全部 0。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&PensionOutput {
        years_to_retire: 0,
        basic_pension_monthly: Decimal::ZERO,
        account_pension_monthly: Decimal::ZERO,
        pension_monthly: Decimal::ZERO,
        coverage_ratio: Decimal::ZERO,
        adjusted_monthly_expense: Decimal::ZERO,
        adjusted_critical_value: Decimal::ZERO,
        multiplier: Decimal::ZERO,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"yearsToRetire\":0,\"basicPensionMonthly\":0,\"accountPensionMonthly\":0,\"pensionMonthly\":0,\"coverageRatio\":0,\"adjustedMonthlyExpense\":0,\"adjustedCriticalValue\":0,\"multiplier\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<PensionOutput, String> {
    let inp: PensionInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;

    // 校验顺序固定（docs/p1-spec.md §3.3，实现顺序即校验顺序）
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
    let current_age = to_u32_int("当前年龄", inp.current_age, 16, 70)?;
    let retire_age = to_u32_int("退休年龄", inp.retire_age, 40, 75)?;
    ensure(retire_age > current_age, "退休年龄须大于当前年龄")?;
    let contrib_years = to_u32_int("缴费年限", inp.contrib_years, 0, 50)?;
    ensure(
        inp.contrib_index >= Decimal::ZERO && inp.contrib_index <= Decimal::from(10),
        "缴费基数指数须在 [0, 10]（小数形式，1.0 = 按社平工资 100% 缴费）",
    )?;
    check_nonneg_money("个人账户余额估计", inp.account_balance)?;
    check_nonneg_money("计发口径社会平均工资", inp.avg_monthly_wage)?;
    let months_divisor = to_u32_int("计发月数", inp.months_divisor, 1, 600)?;

    let years_to_retire = retire_age - current_age;

    // 实际回报率与乘数：与 calculate_baseline 逐字同口径（先 round2 再参与后续乘法）
    let real = inp.nominal_return_pct - inp.inflation_pct;
    if real <= Decimal::ZERO {
        return Ok(PensionOutput {
            years_to_retire,
            basic_pension_monthly: Decimal::ZERO,
            account_pension_monthly: Decimal::ZERO,
            pension_monthly: Decimal::ZERO,
            coverage_ratio: Decimal::ZERO,
            adjusted_monthly_expense: Decimal::ZERO,
            adjusted_critical_value: Decimal::ZERO,
            multiplier: Decimal::ZERO,
            error: "通胀率需低于名义回报率".to_string(),
        });
    }
    let multiplier = round2(
        Decimal::from(12)
            .checked_div(pct_to_frac(real))
            .ok_or("实际回报率过小，无法计算 480 法则乘数")?,
    );

    // 基础养老金 =（社平 + 社平×指数）÷ 2 × 年限 ÷ 100
    let indexed = inp
        .avg_monthly_wage
        .checked_mul(inp.contrib_index)
        .ok_or("数值溢出：请检查社会平均工资与缴费基数指数规模")?;
    let basic = round2(
        inp.avg_monthly_wage
            .checked_add(indexed)
            .ok_or("数值溢出")?
            .checked_div(Decimal::from(2))
            .ok_or("数值溢出")?
            .checked_mul(Decimal::from(contrib_years))
            .ok_or("数值溢出")?
            .checked_div(Decimal::from(100))
            .ok_or("数值溢出")?,
    );

    // 个人账户养老金 = 余额 ÷ 计发月数；预计月养老金 = 基础 + 个人账户
    let account = round2(
        inp.account_balance
            .checked_div(Decimal::from(months_divisor))
            .ok_or("计发月数异常")?,
    );
    let pension_monthly = round2(basic.checked_add(account).ok_or("数值溢出")?);

    // 覆盖率（月开销 0 → 0；不封顶）；调整后月开销（下限钳 0）
    let coverage = if inp.monthly_expense > Decimal::ZERO {
        round2(pension_monthly.checked_div(inp.monthly_expense).ok_or("数值溢出")?)
    } else {
        Decimal::ZERO
    };
    let adjusted_expense = if inp.monthly_expense > pension_monthly {
        round2(
            inp.monthly_expense
                .checked_sub(pension_monthly)
                .ok_or("数值溢出")?,
        )
    } else {
        Decimal::ZERO
    };

    // 调整后参考线：与 calculate_baseline 逐字同构（舍入后乘数 × 调整后月开销 + 附加项）
    let base = adjusted_expense
        .checked_mul(multiplier)
        .ok_or("数值溢出：请检查月开销与乘数规模")?;
    let children = inp
        .child_count
        .checked_mul(inp.cost_per_child)
        .ok_or("数值溢出：请检查子女抚养成本规模")?;
    let adjusted_critical = round2(
        base.checked_add(children)
            .ok_or("数值溢出")?
            .checked_add(inp.health_reserve)
            .ok_or("数值溢出")?
            .checked_add(inp.major_investment)
            .ok_or("数值溢出")?,
    );

    Ok(PensionOutput {
        years_to_retire,
        basic_pension_monthly: basic,
        account_pension_monthly: account,
        pension_monthly,
        coverage_ratio: coverage,
        adjusted_monthly_expense: adjusted_expense,
        adjusted_critical_value: adjusted_critical,
        multiplier,
        error: String::new(),
    })
}
