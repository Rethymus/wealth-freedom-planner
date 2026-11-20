//! 公共工具：Decimal 舍入、单位换算、输入范围校验、防御性上限。
//!
//! 精度纪律（契约见 src/wasm/bridge.ts 与 lib.rs 模块注释）：
//! - 金额/百分比运算一律 `rust_decimal::Decimal`；
//! - 输入 JSON 数字经 serde_json `arbitrary_precision` 按字面量精确解析为
//!   Decimal（`#[serde(with = "rust_decimal::serde::arbitrary_precision")]`），
//!   全程不经 f64 中转；
//! - 输出金额统一舍入到 2 位小数（四舍五入 MidpointAwayFromZero）；
//! - 唯一例外是蒙特卡洛模拟内部按 rand/rand_distr 约定使用 f64（统计抽样，
//!   非金额精确运算），见 montecarlo.rs 注释。

use rust_decimal::{prelude::*, Decimal, RoundingStrategy};

/// 金额输出统一两位小数（四舍五入，远离零方向）。
pub fn round2(d: Decimal) -> Decimal {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

/// 百分点 → 小数（4.5 → 0.045）。Decimal 除以 100 是精确的十进制移位。
pub fn pct_to_frac(p: Decimal) -> Decimal {
    p / Decimal::from(100)
}

/// 校验辅助：条件不满足时返回中文错误。
pub fn ensure(cond: bool, msg: &str) -> Result<(), String> {
    if cond {
        Ok(())
    } else {
        Err(msg.to_string())
    }
}

/// 防御性上限：任何金额输入 ≤ 1e15（元），防止 Decimal 乘法溢出 panic。
/// 正常业务量级远低于此。
pub fn money_cap() -> Decimal {
    Decimal::from(1_000_000_000_000_000u64)
}

/// 百分比输入的绝对值上限（百分点）。名义回报率等允许为负（亏损）。
pub fn pct_cap() -> Decimal {
    Decimal::from(1000u32)
}

/// 贷款期数上限（月），同时约束 (1+i)^n 的规模，保证 rust_finprim 的
/// Decimal 幂运算不会溢出。
pub const MAX_MONTHS: u32 = 1200;

/// 年利率上限（百分点）。24% 已远高于一般信贷上限，仅为防溢出的防御值。
pub fn max_rate_pct() -> Decimal {
    Decimal::from(24u32)
}

/// 非负金额校验：0 ≤ v ≤ 1e15。
pub fn check_nonneg_money(name: &str, v: Decimal) -> Result<(), String> {
    ensure(
        v >= Decimal::ZERO && v <= money_cap(),
        &format!("{name} 须为不小于 0 且不超过 1e15 的数值"),
    )
}

/// 带符号百分比校验：|v| ≤ 1000 百分点。
pub fn check_pct_signed(name: &str, v: Decimal) -> Result<(), String> {
    ensure(
        v.abs() <= pct_cap(),
        &format!("{name} 的绝对值须不超过 1000（百分点）"),
    )
}

/// 区间百分比校验（如首付比例 [0, 100]）。
pub fn check_pct_range(name: &str, v: Decimal, lo: Decimal, hi: Decimal) -> Result<(), String> {
    ensure(
        v >= lo && v <= hi,
        &format!("{name} 须在 [{lo}, {hi}]（百分点）范围内"),
    )
}

/// 校验「整数」（以 Decimal 承接，容忍 JS 侧 30.0 这类字面量），并限定范围，
/// 返回 u32。`what` 描述的是已经过单位换算后的量（如「贷款月数」）。
pub fn to_u32_int(what: &str, v: Decimal, min: u32, max: u32) -> Result<u32, String> {
    ensure(
        v >= Decimal::ZERO && v % Decimal::ONE == Decimal::ZERO,
        &format!("{what} 须为非负整数"),
    )?;
    let n = v.to_u32().ok_or_else(|| format!("{what} 超出可表示范围"))?;
    ensure(n >= min && n <= max, &format!("{what} 须在 {min} 到 {max} 之间"))?;
    Ok(n)
}

/// 校验「非负整数」并转为 u64（用于随机种子）。
pub fn to_u64_int(what: &str, v: Decimal) -> Result<u64, String> {
    ensure(
        v >= Decimal::ZERO && v % Decimal::ONE == Decimal::ZERO,
        &format!("{what} 须为非负整数"),
    )?;
    v.to_u64().ok_or_else(|| format!("{what} 超出可表示范围"))
}

/// f64 金额两位小数舍入（仅用于蒙特卡洛统计输出）。
/// 非有限值原样返回（调用方已另行防御）；-0.0 归一为 0.0。
pub fn round2_f64(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let r = (x * 100.0).round() / 100.0;
    if !r.is_finite() {
        return x;
    }
    if r == 0.0 {
        0.0
    } else {
        r
    }
}

/// f64 概率 6 位小数舍入（仅用于蒙特卡洛耗尽概率输出）。
pub fn round6_f64(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let r = (x * 1_000_000.0).round() / 1_000_000.0;
    if !r.is_finite() {
        return x;
    }
    if r == 0.0 {
        0.0
    } else {
        r
    }
}

/// 分位数：升序序列上的线性插值（type-7 线性插值法，与 run_monte_carlo 既有口径一致）。
/// pos = q × (n − 1)，在 floor(pos) 与 ceil(pos) 两邻位之间按小数部分线性插值。
/// 空序列返回 0.0；单元素返回该元素。仅用于蒙特卡洛类 f64 统计输出。
pub fn quantile_f64(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0];
    }
    let pos = q * (sorted.len() - 1) as f64;
    let lo = pos.floor() as usize;
    let hi = pos.ceil() as usize;
    let frac = pos - lo as f64;
    sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round2_uses_half_up_away_from_zero() {
        // 1.255 -> 1.26（远离零）；-1.255 -> -1.26；1.254 -> 1.25
        assert_eq!(round2(Decimal::new(1255, 3)), Decimal::new(126, 2));
        assert_eq!(round2(Decimal::new(-1255, 3)), Decimal::new(-126, 2));
        assert_eq!(round2(Decimal::new(1254, 3)), Decimal::new(125, 2));
        // 已为两位小数的值原样保留
        assert_eq!(round2(Decimal::new(125, 2)), Decimal::new(125, 2));
    }

    #[test]
    fn u32_int_accepts_fractional_zero_scale() {
        let v = Decimal::from_str("30.0").unwrap();
        assert_eq!(to_u32_int("月数", v * Decimal::from(12), 1, 1200).unwrap(), 360);
        let bad = Decimal::from_str("2.37").unwrap();
        assert!(to_u32_int("月数", bad * Decimal::from(12), 1, 1200).is_err());
    }
}
