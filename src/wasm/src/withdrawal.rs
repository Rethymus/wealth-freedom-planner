//! 支取策略层 —— 蒙特卡洛退休耗尽模拟的三类支取规则（F1 动态支取策略）。
//!
//! 契约与语义：src/wasm/bridge.ts「run_monte_carlo 支取策略语义」（§2.2 逐字）。
//!
//! 结构（bridge.ts §2.3）：
//! - 本模块是 f64 策略层，属蒙特卡洛统计域；与 common.rs 的 Decimal 域分离。
//!   策略参数经 serde arbitrary_precision 精确解析为 Decimal 后转 f64
//!   （金额入参精确解析、统计抽样 f64 的既有纪律）。
//! - `next_spend_threshold` / `next_spend_percent` 为纯函数，被 montecarlo.rs
//!   （正态抽样）与 bootstrap.rs（序列重抽）共用——两模式抽样来源不同，支取规则一致。
//! - 随机流纪律：策略层不消耗任何随机数；抽样顺序（路径外层、年份内层、先回报后
//!   通胀；bootstrap 先抽序列索引再抽通胀）不得因策略层引入而改变——fixed 策略下
//!   同 seed 同输入输出必须与 P1 现状逐字节一致（可复现性铁律）。
//!
//! 关于 `next_spend_percent` 的 `cap_base` 参数：bridge.ts §2.3 的签名草图未给出口径
//! 「上限基数 = 首年实际摊还支出，第 1 年计算后全程缓存」（§2.2）的传参槽位——上限
//! 步骤必须在函数内部、地板之前完成（顺序：摊还 → 名义化 → 上限 → 地板 → 可用资产
//! 钳制），而 cap_base 是请求级常量（assets_0 × r × (1+r)^years / ((1+r)^years − 1)），
//! 在第 2 年起无法由函数入参重推（assets_prev 已被支取消耗）。故调用方在请求级计算
//! cap_base 并经额外参数传入；§2.3 草图中的 `annual_spend` 形参在 percent 语义中无
//! 消费点（§2.2 明示上限基数与基期年支出无关），按草图保留、显式弃用。

use rust_decimal::{prelude::*, Decimal};
use serde::Deserialize;

use crate::common::*;

/// 阈值带参数（小数形式；百分点 ÷ 100 后传入）
#[derive(Debug)]
pub(crate) struct ThresholdParams {
    pub exceed: f64,
    pub cut: f64,
    pub fall: f64,
    pub raise: f64,
    pub no_cut_last_years: u32,
    pub freeze_on_loss: bool,
}

/// 余额比例参数（r 为小数；floor/cap 为小数形式百分比，0 = 关）
#[derive(Debug)]
pub(crate) struct PercentParams {
    pub r: f64,
    pub floor: f64,
    pub cap: f64,
}

/// 解析后的支取策略（输入 JSON 的 strategy/threshold/percent 三字段经校验后的产物）
#[derive(Debug)]
pub(crate) enum Strategy {
    /// 通胀上调（正名 inflation_uplift；历史别名 fixed——语义 = 按通胀样本逐年上行、
    /// 即等价固定实际购买力支出，**非名义恒定支出**；缺省口径；不消费
    /// threshold/percent 任何新字段。P7/P0-3 正名裁定见 bridge.ts §e）
    Fixed,
    Threshold(ThresholdParams),
    Percent(PercentParams),
}

// ---------------------------------------------------------------------------
// 输入参数结构（serde；montecarlo.rs / bootstrap.rs 共用）
// ---------------------------------------------------------------------------

/// 阈值带调整型参数输入（strategy = "threshold" 时必填；全部字段必填）
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ThresholdParamsInput {
    /// 超带阈值（百分点）[0, 100]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub exceed_pct: Decimal,
    /// 降支幅度（百分点）[0, 100]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub cut_pct: Decimal,
    /// 低于带阈值（百分点）[0, 100]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub fall_pct: Decimal,
    /// 升支幅度（百分点）[0, 100]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub raise_pct: Decimal,
    /// 末段不降支年数 [0, 200] 整数
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub no_cut_last_years: Decimal,
    /// 负收益年冻结
    pub freeze_on_loss: bool,
}

/// 余额比例型参数输入（strategy = "percent" 时必填；全部字段必填）
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PercentParamsInput {
    /// 长期实际回报假设（百分点，> −100）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub real_return_assump_pct: Decimal,
    /// 名义支出地板（上年支取额的百分比，0 = 关闭）[0, 100]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub floor_pct_of_last_year: Decimal,
    /// 支出上限（首年实际摊还支出的百分比，0 = 关闭）[0, 1000]
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    pub cap_pct_of_initial_real: Decimal,
}

// ---------------------------------------------------------------------------
// 策略解析与校验（bridge.ts §2.2「策略参数校验」逐字）
// ---------------------------------------------------------------------------

/// 由输入三字段解析支取策略；任一校验失败返回中文错误（调用方转 error 输出）。
/// `current_assets` / `annual_spend` 为已通过非负金额校验的 Decimal 原值
/// （threshold 策略额外要求两者 > 0，wr0 才可定义）。
pub(crate) fn resolve_strategy(
    strategy: &Option<String>,
    threshold: Option<ThresholdParamsInput>,
    percent: Option<PercentParamsInput>,
    current_assets: Decimal,
    annual_spend: Decimal,
) -> Result<Strategy, String> {
    match strategy {
        None => Ok(Strategy::Fixed),
        // "fixed" 保留为兼容别名（输入等价 → Strategy::Fixed，数值路径零改动）；
        // "inflation_uplift" 为正名（P7/P0-3）——同一 Strategy::Fixed，等价输入
        Some(s) if s == "fixed" || s == "inflation_uplift" => Ok(Strategy::Fixed),
        Some(s) if s == "threshold" => {
            let tp = threshold.ok_or("strategy = threshold 时 threshold 参数必填")?;
            check_pct_range("超带阈值", tp.exceed_pct, Decimal::ZERO, Decimal::from(100))?;
            check_pct_range("降支幅度", tp.cut_pct, Decimal::ZERO, Decimal::from(100))?;
            check_pct_range("低于带阈值", tp.fall_pct, Decimal::ZERO, Decimal::from(100))?;
            check_pct_range("升支幅度", tp.raise_pct, Decimal::ZERO, Decimal::from(100))?;
            let no_cut = to_u32_int("末段不降支年数", tp.no_cut_last_years, 0, 200)?;
            ensure(
                current_assets > Decimal::ZERO && annual_spend > Decimal::ZERO,
                "阈值带策略要求当前资产与年支出均大于 0",
            )?;
            Ok(Strategy::Threshold(ThresholdParams {
                exceed: tp.exceed_pct.to_f64().unwrap_or(0.0) / 100.0,
                cut: tp.cut_pct.to_f64().unwrap_or(0.0) / 100.0,
                fall: tp.fall_pct.to_f64().unwrap_or(0.0) / 100.0,
                raise: tp.raise_pct.to_f64().unwrap_or(0.0) / 100.0,
                no_cut_last_years: no_cut,
                freeze_on_loss: tp.freeze_on_loss,
            }))
        }
        Some(s) if s == "percent" => {
            let pp = percent.ok_or("strategy = percent 时 percent 参数必填")?;
            ensure(
                pp.real_return_assump_pct > Decimal::from(-100),
                "实际回报假设须大于 -100（百分点，(1+r) 须为正）",
            )?;
            check_pct_range("支出地板", pp.floor_pct_of_last_year, Decimal::ZERO, Decimal::from(100))?;
            check_pct_range("支出上限", pp.cap_pct_of_initial_real, Decimal::ZERO, Decimal::from(1000))?;
            Ok(Strategy::Percent(PercentParams {
                r: pp.real_return_assump_pct.to_f64().unwrap_or(0.0) / 100.0,
                floor: pp.floor_pct_of_last_year.to_f64().unwrap_or(0.0) / 100.0,
                cap: pp.cap_pct_of_initial_real.to_f64().unwrap_or(0.0) / 100.0,
            }))
        }
        Some(_) => Err("支取策略须为 fixed / inflation_uplift / threshold / percent 之一".to_string()),
    }
}

// ---------------------------------------------------------------------------
// 策略层纯函数（f64 统计域）
// ---------------------------------------------------------------------------

/// 阈值带规则：给定上年末支取额 / 年初资产 / 初始支取率 / 当年通胀样本 / 上一年回报样本 /
/// 当前年序（1 起计）/ 总年数，返回当年支取额（spend_t）。
/// 规则顺序（bridge.ts §2.2）：第 1 年恒为 spend_{t−1} × (1+π)；第 t ≥ 2 年按
/// 降支 → 升支 → 负收益年冻结 → 常规通胀上调 依序判定。
pub(crate) fn next_spend_threshold(
    spend_prev: f64, assets_prev: f64, wr0: f64, infl: f64, r_prev: f64,
    year: u32, years: u32, p: &ThresholdParams,
) -> f64 {
    // 第 1 年：无上一年回报样本（规则 3 不触发）；wr_1 = wr0 恒在带内（规则 1/2 不触发）
    if year <= 1 {
        return spend_prev * (1.0 + infl);
    }
    // 年初资产非正（正常递推下已被耗尽判定终止；防御分支退化为常规通胀上调）
    if !assets_prev.is_finite() || assets_prev <= 0.0 || !wr0.is_finite() || wr0 <= 0.0 {
        return spend_prev * (1.0 + infl);
    }
    let wr = spend_prev / assets_prev; // 当前支取率（年初资产口径）
    // 1) 超带降支（距终点 ≤ no_cut_last_years 年时不降支：契约要求严格大于）
    if wr > wr0 * (1.0 + p.exceed) && (years - year) > p.no_cut_last_years {
        return spend_prev * (1.0 - p.cut) * (1.0 + infl);
    }
    // 2) 低于带升支
    if wr < wr0 * (1.0 - p.fall) {
        return spend_prev * (1.0 + p.raise) * (1.0 + infl);
    }
    // 3) 负收益年冻结（带内、上年亏损、当前支取率高于初始 → 名义冻结一年）
    if p.freeze_on_loss && r_prev < 0.0 && wr > wr0 {
        return spend_prev;
    }
    // 4) 常规：随通胀上行
    spend_prev * (1.0 + infl)
}

/// 摊还年金化（实际口径）：balance × r × (1+r)^n / ((1+r)^n − 1)；r = 0 退化为 balance ÷ n。
/// 幂用循环乘（n ≤ 200，bridge.ts §2.3；f64 域内无溢出风险，仍对非有限值防御）。
pub(crate) fn annuitize(balance: f64, r: f64, n: u32) -> f64 {
    if n == 0 || !balance.is_finite() {
        return 0.0;
    }
    if r == 0.0 {
        return balance / n as f64;
    }
    let nf = n as f64;
    // (1+r)^n 循环乘
    let mut f = 1.0_f64;
    for _ in 0..n {
        f *= 1.0 + r;
    }
    if !f.is_finite() {
        return f;
    }
    // 分母 (1+r)^n − 1 在 r 极小且 n 有限时可能舍入为 0，退化为线性摊还
    if f - 1.0 == 0.0 {
        return balance / nf;
    }
    balance * r * f / (f - 1.0)
}

/// percent 策略的上限基数 cap_base = 首年实际摊还支出（bridge.ts §2.2）：
/// assets_0 × r × (1+r)^years / ((1+r)^years − 1)（r = 0 时 = assets_0 ÷ years）。
/// 请求级常量：调用方计算一次、全程传入（见模块注释「cap_base 参数」）。
pub(crate) fn percent_cap_base(assets0: f64, r: f64, years: u32) -> f64 {
    annuitize(assets0, r, years)
}

/// 余额比例规则：给定上年末名义资产 / 上年末累计通胀因子 / 当年累计通胀因子 /
/// 当年名义回报样本 / 上年名义支取额 / 当前年序 / 总年数 / 基期年支出 / 上限基数，
/// 返回当年支取额（内部完成实际口径摊还 → 名义化 → 上限 → 地板 → 可用资产钳制，
/// 见 bridge.ts §2.2；`annual_spend` 形参按签名草图保留但 percent 语义无消费点，
/// `cap_base` 为请求级缓存的首年实际摊还支出——见模块注释）。
pub(crate) fn next_spend_percent(
    assets_prev: f64, cum_infl_prev: f64, cum_infl_t: f64, r_nom: f64,
    spend_prev: f64, year: u32, years: u32, annual_spend: f64, cap_base: f64,
    p: &PercentParams,
) -> f64 {
    // percent 语义不消费基期年支出（上限基数与 annualSpend 无关，bridge.ts §2.2）
    let _ = annual_spend;
    // 剩余年数（含当年）；year ≤ years 由调用方递推保证
    let n = years.saturating_sub(year - 1);
    // 实际口径资产（cum_infl_0 = 1；防御非正/非有限累计因子）
    let real_assets = if cum_infl_prev.is_finite() && cum_infl_prev > 0.0 {
        assets_prev / cum_infl_prev
    } else {
        assets_prev
    };
    // 1) 实际口径摊还 → 2) 名义化
    let mut spend = annuitize(real_assets, p.r, n) * cum_infl_t;
    // 3) 上限（cap > 0 时启用；基数 = cap_base × cum_infl_t）
    if p.cap > 0.0 && cap_base.is_finite() {
        let cap = cap_base * cum_infl_t * p.cap;
        if cap.is_finite() && spend > cap {
            spend = cap;
        }
    }
    // 4) 地板（floor > 0 且自第 2 年起生效）
    if p.floor > 0.0 && year >= 2 {
        let floor = spend_prev * p.floor;
        if floor.is_finite() && spend < floor {
            spend = floor;
        }
    }
    // 5) 可用资产钳制（恒启用；余额比例型构造上不把资产抽为负）
    let available = assets_prev * (1.0 + r_nom);
    if available.is_finite() && spend > available {
        spend = available;
    }
    spend
}

// ---------------------------------------------------------------------------
// 单元测试（bridge.ts §9.1 withdrawal.rs 测试清单逐条）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// 阈值带默认参数（研究最优解 ±20% / ±10% / 末段 15 年 / 冻结关——各用例按需开关冻结）
    fn tp(freeze: bool) -> ThresholdParams {
        ThresholdParams {
            exceed: 0.20,
            cut: 0.10,
            fall: 0.20,
            raise: 0.10,
            no_cut_last_years: 15,
            freeze_on_loss: freeze,
        }
    }

    /// wr0 = 0.5（assets 2e6、spend 1e6——0.5、0.6、0.4 在 f64 均可精确表示，
    /// 使带界相等比较无 ulp 抖动）
    const WR0_ASSETS: f64 = 2_000_000.0;

    #[test]
    fn threshold_band_boundaries() {
        // wr0 = 0.5；超带界 = 0.5×1.2 = 0.6、低于带界 = 0.5×0.8 = 0.4（均精确）
        let wr0 = 0.5_f64;
        let infl = 0.02;
        // 恰等于超带界 0.6 → 带内（规则 4，不降支）
        let spend = 0.6 * WR0_ASSETS; // 1,200,000
        let got = next_spend_threshold(spend, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - spend * 1.02).abs() < 1e-9, "带内不降支：{got}");
        // 超带界之上（0.60000012）→ 降支
        let above = 0.60000012 * WR0_ASSETS;
        let got = next_spend_threshold(above, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - above * 0.9 * 1.02).abs() < 1e-6, "超带降支：{got}");
        // 恰等于低于带界 0.4 → 带内（规则 4，不升支）
        let spend = 0.4 * WR0_ASSETS; // 800,000
        let got = next_spend_threshold(spend, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - spend * 1.02).abs() < 1e-9, "带内不升支：{got}");
        // 低于带界之下（0.39999994）→ 升支
        let below = 0.39999994 * WR0_ASSETS;
        let got = next_spend_threshold(below, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - below * 1.1 * 1.02).abs() < 1e-6, "低于带升支：{got}");
    }

    #[test]
    fn threshold_nocut_boundary() {
        // 契约为严格大于：(years − t) == noCutLastYears → 不降支；== noCut+1 → 降支。
        // 支取率须先超带（0.60000012 > 0.6），使规则 1 的第二条件成为判定焦点
        let wr0 = 0.5_f64;
        let above = 0.60000012 * WR0_ASSETS;
        let years = 20_u32;
        // years − t = 15 == noCut(15) → 规则 1 第二条件不成立 → 落规则 4（不降支）
        let got = next_spend_threshold(above, WR0_ASSETS, wr0, 0.02, 0.05, 5, years, &tp(false));
        assert!((got - above * 1.02).abs() < 1e-6, "距终点恰 15 年不降支：{got}");
        // years − t = 16 > noCut → 降支
        let got = next_spend_threshold(above, WR0_ASSETS, wr0, 0.02, 0.05, 4, years, &tp(false));
        assert!((got - above * 0.9 * 1.02).abs() < 1e-6, "距终点 16 年降支：{got}");
    }

    #[test]
    fn threshold_freeze_rule() {
        let wr0 = 0.5_f64;
        // 带内且 wr_t > wr0（wr = 0.55 ∈ (0.5, 0.6)）、上年亏损 → 名义冻结（无通胀上调）
        let spend = 0.55 * WR0_ASSETS;
        let got = next_spend_threshold(spend, WR0_ASSETS, wr0, 0.02, -0.05, 3, 30, &tp(true));
        assert_eq!(got, spend, "负收益年带内冻结：spend_t == spend_prev");
        // 上年亏损但 wr_t ≤ wr0（wr = 0.45，带内）→ 正常通胀上调
        let spend = 0.45 * WR0_ASSETS;
        let got = next_spend_threshold(spend, WR0_ASSETS, wr0, 0.02, -0.05, 3, 30, &tp(true));
        assert!((got - spend * 1.02).abs() < 1e-9, "亏损年但 wr_t ≤ wr0 → 正常上调：{got}");
        // 上年盈利 + 带内（wr = 0.55 > wr0）→ 正常上调（冻结不触发）
        let spend = 0.55 * WR0_ASSETS;
        let got = next_spend_threshold(spend, WR0_ASSETS, wr0, 0.02, 0.05, 3, 30, &tp(true));
        assert!((got - spend * 1.02).abs() < 1e-9, "上年盈利 → 正常上调：{got}");
        // 第 1 年：规则 3 不触发（无上一年回报样本），即便 r_prev < 0
        let got = next_spend_threshold(1_000_000.0, WR0_ASSETS, wr0, 0.02, -0.05, 1, 30, &tp(true));
        assert!((got - 1_000_000.0 * 1.02).abs() < 1e-9, "第 1 年恒通胀上调：{got}");
    }

    #[test]
    fn threshold_inflation_attached_to_cut_and_raise() {
        // 降支 / 升支当年支出均乘 (1 + π_t)（区别于冻结规则的名义冻结）
        let wr0 = 0.5_f64;
        let infl = 0.03;
        // 降支（超带）：spend = spend_prev × (1 − 0.10) × 1.03
        let above = 0.60000012 * WR0_ASSETS;
        let got = next_spend_threshold(above, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - above * 0.9 * 1.03).abs() < 1e-6, "降支接通胀：{got}");
        // 升支（低于带）：spend = spend_prev × (1 + 0.10) × 1.03
        let below = 0.39999994 * WR0_ASSETS;
        let got = next_spend_threshold(below, WR0_ASSETS, wr0, infl, 0.05, 2, 30, &tp(false));
        assert!((got - below * 1.1 * 1.03).abs() < 1e-6, "升支接通胀：{got}");
    }

    #[test]
    fn percent_pmt_closed_form() {
        // 摊还因子闭式对照（每 100 元本金、n = 30）：r=4.3% → 5.9955；r=2.5% → 4.7778；
        // r=0 → 3.3333（= 100/30）；年金因子 (1 − (1+r)^−n)/r 倒数交叉验证一致（容差 1e-3）
        let call = |r: f64| {
            next_spend_percent(
                100.0, 1.0, 1.0, 0.0, 0.0, 1, 30, 0.0, 0.0,
                &PercentParams { r, floor: 0.0, cap: 0.0 },
            )
        };
        assert!((call(0.043) - 5.9955).abs() < 1e-3, "r=4.3%：{}", call(0.043));
        assert!((call(0.025) - 4.7778).abs() < 1e-3, "r=2.5%：{}", call(0.025));
        assert!((call(0.0) - 100.0 / 30.0).abs() < 1e-9, "r=0 → 100/30：{}", call(0.0));
        // 年金因子倒数交叉验证（独立公式路径：powf）
        for r in [0.043_f64, 0.025] {
            let af = (1.0 - (1.0 + r).powf(-30.0)) / r;
            let cross = 100.0 / af;
            assert!(
                (call(r) - cross).abs() < 1e-3,
                "r={r}：实现 {} vs 年金因子倒数 {cross}",
                call(r)
            );
        }
    }

    #[test]
    fn percent_real_nominal_consistency() {
        // 通胀恒 2% 时，「实际口径摊还 × cum_infl 名义化」与直接名义递推逐年年相等：
        // 名义：A_t = A_{t−1}×(1+r_nom) − spend_nom_t；
        // 实际独立递推：R_t = R_{t−1}×(1+r_real) − 摊还(R_{t−1})，
        // 其中 r_real = (1+r_nom)/(1+π) − 1、摊还用独立公式路径（powf 闭式）；
        // 恒等式 A_t ÷ cum_infl_t == R_t 逐年成立（代数上精确，浮点余差 ≤ 相对 1e-9/年）。
        let r_nom = 0.05_f64;
        let pi = 0.02_f64;
        let r_real = (1.0 + r_nom) / (1.0 + pi) - 1.0;
        let p = PercentParams { r: r_real, floor: 0.0, cap: 0.0 };
        let years = 30_u32;
        let mut assets = 1_000_000.0_f64;
        let mut real_assets = 1_000_000.0_f64; // R_0 = assets_0（cum_infl_0 = 1）
        let mut cum_infl = 1.0_f64;
        let mut spend_prev = 0.0_f64;
        for t in 1..=years {
            let cum_prev = cum_infl;
            cum_infl *= 1.0 + pi;
            let spend_nom = next_spend_percent(
                assets, cum_prev, cum_infl, r_nom, spend_prev, t, years, 0.0, 0.0, &p,
            );
            // 名义递推
            assets = assets * (1.0 + r_nom) - spend_nom;
            // 实际口径独立递推（摊还支出 = 摊还(R_{t−1})，独立 powf 闭式计算）
            let n = years - t + 1;
            let f = (1.0 + r_real).powf(n as f64);
            let amort_real = real_assets * r_real * f / (f - 1.0);
            real_assets = real_assets * (1.0 + r_real) - amort_real;
            let got = assets / cum_infl;
            assert!(
                (got - real_assets).abs() <= 1e-6 * real_assets.abs().max(1.0),
                "第 {t} 年实际口径一致：名义换算 {got} vs 实际递推 {real_assets}"
            );
            spend_prev = spend_nom;
        }
    }

    #[test]
    fn percent_floor_cap_clamp() {
        // cap_base（首年实际摊还支出）：assets_0 = 1e6、r = 2.5%、n = 30 → 47,777.64
        let cap_base = percent_cap_base(1_000_000.0, 0.025, 30);
        assert!((cap_base - 47_777.64).abs() < 0.01, "cap_base 锚点：{cap_base}");
        let cap_limit = cap_base * 1.2; // cap = 120%
        assert!((cap_limit - 57_333.17).abs() < 0.01, "上限锚点：{cap_limit}");

        // cap = 120 生效分支：实际资产涨至 1.5e6（R = 1.5e6 > cap_base）→ 摊还 71,666 > 上限
        let p = PercentParams { r: 0.025, floor: 0.0, cap: 1.2 };
        let got = next_spend_percent(
            1_500_000.0, 1.0, 1.0, 0.0, 0.0, 1, 30, 0.0, cap_base, &p,
        );
        assert!((got - cap_limit).abs() < 0.01, "cap 生效（钳到上限）：{got}");
        assert!(got <= cap_base * 1.0 * 1.2 + 1e-6, "spend ≤ cap_base × cum_infl × 1.2");

        // cap 不生效分支：R = cap_base 时摊还恰等于基数 < 上限
        let got = next_spend_percent(
            1_000_000.0, 1.0, 1.0, 0.0, 0.0, 1, 30, 0.0, cap_base, &p,
        );
        assert!((got - cap_base).abs() < 0.01, "cap 不生效（= 摊还值）：{got}");

        // floor = 95 生效分支（第 2 年起）：spend ≥ 0.95 × spend_prev
        let spend_prev = 900_000.0_f64;
        let p = PercentParams { r: 0.025, floor: 0.95, cap: 0.0 };
        let got = next_spend_percent(
            1_000_000.0, 1.0, 1.02, 0.0, spend_prev, 2, 30, 0.0, cap_base, &p,
        );
        let floor = spend_prev * 0.95;
        assert!((got - floor).abs() < 1e-6, "floor 生效（垫高到地板）：{got}");
        assert!(got >= floor - 1e-6, "spend ≥ 0.95 × spend_prev");

        // floor 不生效分支：摊还值已高于地板（第 2 年 → n = 29，摊还 = 独立闭式值）
        let spend_prev = 100.0_f64;
        let got = next_spend_percent(
            1_000_000.0, 1.0, 1.0, 0.0, spend_prev, 2, 30, 0.0, cap_base, &p,
        );
        let expected = annuitize(1_000_000.0, 0.025, 29);
        assert!((got - expected).abs() < 0.01, "floor 不生效（= 摊还值 {expected}）：{got}");
        assert!(got > spend_prev * 0.95, "摊还值高于地板 → floor 分支不触发");

        // 可用资产钳制恒成立：spend ≤ assets_prev × (1 + r_nom)（地板垫高 + 负回报样本）
        let spend_prev = 60_000.0_f64;
        let p = PercentParams { r: 0.025, floor: 0.95, cap: 0.0 };
        let got = next_spend_percent(
            1_000.0, 1.0, 1.0, -0.5, spend_prev, 2, 30, 0.0, cap_base, &p,
        );
        let available = 1_000.0 * (1.0 - 0.5);
        assert!((got - available).abs() < 1e-9, "可用资产钳制：{got} ≤ {available}");
    }

    #[test]
    fn strategy_resolution_and_validation() {
        use rust_decimal::Decimal;
        let a = Decimal::from(1_000_000);
        let s = Decimal::from(40_000);
        // 缺省 → fixed；fixed 不消费挂载参数
        let m = resolve_strategy(&None, None, None, a, s).unwrap();
        assert!(matches!(m, Strategy::Fixed));
        let mounted = Some(ThresholdParamsInput {
            exceed_pct: Decimal::from(20), cut_pct: Decimal::from(10),
            fall_pct: Decimal::from(20), raise_pct: Decimal::from(10),
            no_cut_last_years: Decimal::from(15), freeze_on_loss: true,
        });
        let m = resolve_strategy(&Some("fixed".into()), mounted.clone(), None, a, s).unwrap();
        assert!(matches!(m, Strategy::Fixed), "fixed 不消费 threshold 参数");
        // P7/P0-3 正名：inflation_uplift 与 fixed 等价映射同一 Strategy::Fixed
        // （输入等价 → 数值路径零改动；缺省与两别名三次调用输出逐字节一致由
        // 集成 mc_fixed_semantics_after_rename 锁定）
        let m = resolve_strategy(&Some("inflation_uplift".into()), mounted.clone(), None, a, s).unwrap();
        assert!(
            matches!(m, Strategy::Fixed),
            "inflation_uplift（正名）→ Strategy::Fixed"
        );
        // 枚举外 → 报错
        assert!(resolve_strategy(&Some("other".into()), None, None, a, s).is_err());
        // threshold：缺参 / 资产或支出为 0 → 报错
        assert!(resolve_strategy(&Some("threshold".into()), None, None, a, s).is_err());
        assert!(
            resolve_strategy(&Some("threshold".into()), mounted, None, Decimal::ZERO, s)
                .unwrap_err()
                .contains("阈值带策略要求当前资产与年支出均大于 0")
        );
        // percent：缺参 / 回报假设 ≤ −100 → 报错
        assert!(resolve_strategy(&Some("percent".into()), None, None, a, s).is_err());
        let bad_real = Some(PercentParamsInput {
            real_return_assump_pct: Decimal::from(-150),
            floor_pct_of_last_year: Decimal::ZERO,
            cap_pct_of_initial_real: Decimal::ZERO,
        });
        assert!(resolve_strategy(&Some("percent".into()), None, bad_real, a, s).is_err());
        // percent 合法解析（floor/cap 关闭）
        let ok = resolve_strategy(
            &Some("percent".into()),
            None,
            Some(PercentParamsInput {
                real_return_assump_pct: Decimal::new(25, 1), // 2.5
                floor_pct_of_last_year: Decimal::ZERO,
                cap_pct_of_initial_real: Decimal::ZERO,
            }),
            a, s,
        )
        .unwrap();
        match ok {
            Strategy::Percent(pp) => {
                assert!((pp.r - 0.025).abs() < 1e-12);
                assert_eq!(pp.floor, 0.0);
                assert_eq!(pp.cap, 0.0);
            }
            _ => panic!("应为 Percent"),
        }
    }
}
