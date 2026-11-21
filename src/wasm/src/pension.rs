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
//! - 桥接期（P7/P0-1，时间口径）：养老金自 retire_age 起才进入现金流——停工 → 起领
//!   之间为无工资且无养老金的桥接段。bridgeYears = max(0, retireAge −
//!   max(targetRetireAge, currentAge))；bridgeFundingNeeded = bridgeYears > 0 时
//!   round2(monthlyExpense × 乘数)——纯生活费口径；一次性附加项（育儿/健康/重大投入）
//!   单次计入「领取后」adjustedCriticalValue（修订轮二 R5 归属裁定），两段相加 = 停工后
//!   真实总需。targetRetireAge 缺省（None）取 retire_age → bridgeYears = 0，现状口径
//!   与 P-A 锚点零漂移。有限年限支取本可用年金因子，保留乘数口径对桥接段偏保守
//!   （多备），取舍随 bridge.ts §i 与面板口径注明示。
//!
//! 实际回报率 ≤ 0 分支：与 calculate_baseline 同文案同分支形状 —— error =
//! 「通胀率需低于名义回报率」，金额/乘数类字段全部 0；yearsToRetire 仍返回
//! 计算值（对应 baseline 分支回显 monthlyExpense 的同形处理）；bridgeYears 同为
//! 时间字段、照回显先例返回计算值，bridgeFundingNeeded 依赖乘数 → 0。
//!
//! 校验顺序（docs/p1-spec.md §3.3）：… current_age → retire_age（含 > current_age）→
//! target_retire_age（存在时 16–75 整数，缺省不触发）→ contrib_years → …（插入位在
//! 「退休年龄」与「缴费年限」之间，P7 落点）。
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
    /// 想停止工作的年龄（16–75，整数；缺省 = retire_age → 桥接期 0，现状口径零漂移）。
    /// 时间口径字段：仅驱动 bridge_years / bridge_funding_needed，不影响任何养老金金额
    /// （金额仍全部由 retire_age 经计发月数联动承载——金额与时间解耦，P7/P0-1）。
    #[serde(default, with = "rust_decimal::serde::arbitrary_precision_option")]
    target_retire_age: Option<Decimal>,
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
    /// 停工 → 起领的桥接期年数 = max(0, retireAge − max(targetRetireAge, currentAge))（整数；
    /// 解析/校验失败安全值 0；业务错误（实际回报 ≤ 0）仍返回计算值，同 years_to_retire 回显先例）
    bridge_years: u32,
    /// 桥接期需备资金（元，两位小数）＝ bridge_years > 0 时 round2(monthlyExpense × multiplier)
    /// ——纯生活费口径；一次性附加项（育儿/健康/重大投入）单次计入段 2
    /// adjustedCriticalValue，不在桥接段重复计入（修订轮二 R5 归属裁定）；两段相加 = 真实总需。
    /// bridge_years = 0 或实际回报 ≤ 0 时 = 0；解析/校验失败安全值 0
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    bridge_funding_needed: Decimal,
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

/// 错误/异常时的安全输出形状：years_to_retire: 0、bridge 两字段 0、其余数值字段全部 0。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&PensionOutput {
        years_to_retire: 0,
        bridge_years: 0,
        bridge_funding_needed: Decimal::ZERO,
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
        "{\"yearsToRetire\":0,\"bridgeYears\":0,\"bridgeFundingNeeded\":0,\"basicPensionMonthly\":0,\"accountPensionMonthly\":0,\"pensionMonthly\":0,\"coverageRatio\":0,\"adjustedMonthlyExpense\":0,\"adjustedCriticalValue\":0,\"multiplier\":0,\"error\":\"内部错误\"}"
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
    // 停止工作年龄（P7/P0-1）：插在「退休年龄须大于当前年龄」与「缴费年限」之间
    // （docs/p1-spec.md §3.3 校验顺序同步）；缺省（None）不触发该校验、取 retire_age
    let target_retire_age = match inp.target_retire_age {
        Some(v) => Some(to_u32_int("停止工作年龄", v, 16, 75)?),
        None => None,
    };
    let contrib_years = to_u32_int("缴费年限", inp.contrib_years, 0, 50)?;
    ensure(
        inp.contrib_index >= Decimal::ZERO && inp.contrib_index <= Decimal::from(10),
        "缴费基数指数须在 [0, 10]（小数形式，1.0 = 按社平工资 100% 缴费）",
    )?;
    check_nonneg_money("个人账户余额估计", inp.account_balance)?;
    check_nonneg_money("计发口径社会平均工资", inp.avg_monthly_wage)?;
    let months_divisor = to_u32_int("计发月数", inp.months_divisor, 1, 600)?;

    let years_to_retire = retire_age - current_age;

    // 桥接期时间口径（P7/P0-1）：bridge_years = max(0, retire_age − max(target, current_age))。
    // saturating 语义已由 u32 减法承载：target ≤ current_age（已停工）→ 桥接 = years_to_retire；
    // target ≥ retire_age → 桥接 = 0（缺省 target = retire_age 同式得 0，现状口径零漂移）。
    // 不与 retire_age 做大小约束（停工晚于退休即无桥接期，不是输入错误）。
    let bridge_years = retire_age.saturating_sub(
        target_retire_age.unwrap_or(retire_age).max(current_age),
    );

    // 实际回报率与乘数：与 calculate_baseline 逐字同口径（先 round2 再参与后续乘法）
    let real = inp.nominal_return_pct - inp.inflation_pct;
    if real <= Decimal::ZERO {
        return Ok(PensionOutput {
            years_to_retire,
            // 时间字段与金额无关：业务错误分支仍返回计算值（years_to_retire 回显同例）；
            // 桥接备资依赖乘数（乘数为 0）→ 安全值 0
            bridge_years,
            bridge_funding_needed: Decimal::ZERO,
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

    // 桥接期备资（段 1，纯生活费口径）：round2(monthlyExpense × multiplier)，附加项
    // 不重复计入——育儿/健康/重大投入单次计入段 2 adjustedCriticalValue（修订轮二 R5
    // 归属裁定：附加项与起领时点无关、天然属于「停工后总备资」的一次性项）；段 1 沿用
    // 同一 480 乘数口径（对桥接段偏保守/多备，有限年限支取本可用年金因子，取舍随
    // bridge.ts §i 口径注明示）。bridge_years = 0（含缺省 target = retire_age）→ 0。
    let bridge_funding_needed = if bridge_years > 0 {
        round2(
            inp.monthly_expense
                .checked_mul(multiplier)
                .ok_or("数值溢出：请检查月开销与乘数规模")?,
        )
    } else {
        Decimal::ZERO
    };

    Ok(PensionOutput {
        years_to_retire,
        bridge_years,
        bridge_funding_needed,
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
