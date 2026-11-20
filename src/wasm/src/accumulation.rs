//! simulate_accumulation —— 打工积累模拟。契约见 src/wasm/bridge.ts
//! AccumulationInput/AccumulationOutput。
//!
//! 口径（与 bridge.ts「Rust 侧实现遵循」一致）：
//! - 随机数：`StdRng::seed_from_u64(seed)` 固定种子（rand 0.8；wasm32 目标由
//!   Cargo.toml target 段的 getrandom "js" feature 保证可编译）。抽样顺序固定：
//!   路径外层、年份内层，每年先抽名义回报样本、再抽通胀样本；每路径固定消费
//!   2 × years 个样本（无提前 break），保证同 seed 同输入输出逐字节一致。
//! - 分布：名义回报 ~ Normal(均值/100, 标准差/100)、通胀 ~ Normal(均值/100,
//!   标准差/100)（rand_distr，f64），与 run_monte_carlo 完全一致。σ ≤ 0 视为
//!   异常参数，返回 error。
//! - 逐年递推（第 t 年 = 1..=years，全程不提前终止，名义口径）：
//!     cum_infl *= 1 + 通胀样本（含当年）；
//!     年末资产 = 上年末 × (1 + 名义回报样本) + 月储蓄 × 12 × cum_infl；
//!     年储蓄自第 1 年起随通胀上行（与 run_monte_carlo 的支出上行同口径）。
//! - 月储蓄 = 税后月收入 − 月支出，可为负（负储蓄是合法输入）；资产下限钳 0
//!   （与 run_monte_carlo 的耗尽语义不同：钳后继续模拟，不提前终止）。
//! - 财富自由判定：第 t 年目标 = 目标值 × cum_infl（目标随通胀水涨）；初始
//!   （t = 0）即判定：当前资产 ≥ 目标值记首达年限 0；首达即记录整数年，
//!   之后继续模拟至年限结束（路径图需要全程曲线）。
//! - 防御钳制（正常参数下触发概率≈0，仅防病态输入）：回报/通胀样本 < −0.99 时
//!   钳制为 −0.99；资产 NaN 或 ≤ 0 钳 0（钳后继续）、正溢出钳制为 f64::MAX。
//! - 统计：fiProbability = 达成路径数 ÷ 路径数（6 位小数）；neverReachedShare
//!   = (路径数 − 达成路径数) ÷ 路径数（独立重算，非 1 − fi 的二次舍入）；
//!   首达年限分位只在达成样本内取（type-7 线性插值、两位小数），无达成样本
//!   五个分位一律 -1.0；期末资产分位基于全部路径（下限钳 0 保证非负）。
//! - samplePaths：按索引均匀抽取 50 条（含首尾）：idx_k = round(k × (paths−1) / 49)，
//!   k = 0..49；路径数 < 50 时按公式重复抽取（bridge.ts 固定 50 条口径）。
//!   每条为逐年年末资产，长度 = years。
//!
//! 精度声明：金额入参按 arbitrary_precision 精确解析后转 f64；模拟与统计按
//! rand/rand_distr 惯例使用 f64（蒙特卡洛类统计抽样，rust_decimal 无正态分布
//! 抽样且运算慢 2 个数量级以上）；输出统一舍入（金额 2 位、概率 6 位、年限
//! 分位 2 位）。

use rand::rngs::StdRng;
use rand::SeedableRng;
use rand_distr::{Distribution, Normal};
use rust_decimal::{prelude::*, Decimal};
use serde::{Deserialize, Serialize};

use crate::common::*;

/// 打工积累模拟防御性规模上限（与 montecarlo.rs 同值；刻意不跨模块共享，
/// 避免改动既有模块）
const MAX_YEARS: u32 = 200;
const MAX_PATHS: u32 = 100_000;
/// 样本路径条数（bridge.ts 固定口径）
const SAMPLE_COUNT: usize = 50;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccumulationInput {
    /// 当前资产（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    current_assets: Decimal,
    /// 税后月收入（元/月）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_income: Decimal,
    /// 月支出（元/月，基期名义值）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    monthly_expense: Decimal,
    /// 财富自由目标值（元，基期名义值；判定时按通胀逐年上调）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    target_value: Decimal,
    /// 名义回报率均值（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    nominal_return_mean_pct: Decimal,
    /// 名义回报率标准差（百分点，须 > 0）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    nominal_return_std_pct: Decimal,
    /// 通胀率均值（百分点）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    inflation_mean_pct: Decimal,
    /// 通胀率标准差（百分点，须 > 0）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    inflation_std_pct: Decimal,
    /// 模拟年数（1–200）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    years: Decimal,
    /// 模拟路径数（1–100000）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    paths: Decimal,
    /// 随机种子
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    seed: Decimal,
}

/// 期末资产分位数（元，全部路径，type-7 线性插值）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccumulationFinalPercentiles {
    p5: f64,
    p25: f64,
    p50: f64,
    p75: f64,
    p95: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccumulationOutput {
    /// 达成财富自由的路径占比（0–1，6 位小数）
    fi_probability: f64,
    /// 首达年限第 5 百分位（年，仅在达成样本内取；无达成样本 = -1）
    years_p5: f64,
    /// 首达年限第 25 百分位（年；无达成样本 = -1）
    years_p25: f64,
    /// 首达年限中位数（年；无达成样本 = -1）
    years_median: f64,
    /// 首达年限第 75 百分位（年；无达成样本 = -1）
    years_p75: f64,
    /// 首达年限第 95 百分位（年；无达成样本 = -1）
    years_p95: f64,
    /// 未达成路径占比（0–1，6 位小数；与 fiProbability 独立重算）
    never_reached_share: f64,
    /// 期末资产分位数（元，全部路径）
    final_asset_percentiles: AccumulationFinalPercentiles,
    /// 50 条代表性路径的逐年年末资产（每条长度 = years）
    sample_paths: Vec<Vec<f64>>,
    /// "" 表示成功（bridge.ts 全局错误约定）
    error: String,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状：全部数值 0.0、年限分位 -1.0、样本路径为空。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&AccumulationOutput {
        fi_probability: 0.0,
        years_p5: -1.0,
        years_p25: -1.0,
        years_median: -1.0,
        years_p75: -1.0,
        years_p95: -1.0,
        never_reached_share: 0.0,
        final_asset_percentiles: AccumulationFinalPercentiles {
            p5: 0.0,
            p25: 0.0,
            p50: 0.0,
            p75: 0.0,
            p95: 0.0,
        },
        sample_paths: Vec::new(),
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"fiProbability\":0,\"yearsP5\":-1,\"yearsP25\":-1,\"yearsMedian\":-1,\"yearsP75\":-1,\"yearsP95\":-1,\"neverReachedShare\":0,\"finalAssetPercentiles\":{\"p5\":0,\"p25\":0,\"p50\":0,\"p75\":0,\"p95\":0},\"samplePaths\":[],\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<AccumulationOutput, String> {
    let inp: AccumulationInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("当前资产", inp.current_assets)?;
    check_nonneg_money("税后月收入", inp.monthly_income)?;
    check_nonneg_money("月支出", inp.monthly_expense)?;
    check_nonneg_money("财富自由目标值", inp.target_value)?;
    // 回报率均值允许为负（亏损组合）；σ ≤ 0 按任务要求视为异常参数
    check_pct_signed("名义回报率均值", inp.nominal_return_mean_pct)?;
    check_pct_signed("通胀率均值", inp.inflation_mean_pct)?;
    ensure(
        inp.nominal_return_std_pct > Decimal::ZERO,
        "名义回报率标准差须大于 0（σ ≤ 0 视为异常参数）",
    )?;
    ensure(
        inp.inflation_std_pct > Decimal::ZERO,
        "通胀率标准差须大于 0（σ ≤ 0 视为异常参数）",
    )?;
    check_pct_signed("名义回报率标准差", inp.nominal_return_std_pct)?;
    check_pct_signed("通胀率标准差", inp.inflation_std_pct)?;
    let years = to_u32_int("模拟年数", inp.years, 1, MAX_YEARS)?;
    let paths = to_u32_int("模拟路径数", inp.paths, 1, MAX_PATHS)?;
    let seed = to_u64_int("随机种子", inp.seed)?;

    // 分布参数：百分点 → 小数；σ > 0 已校验，rand_distr 构造失败属内部异常
    let nd = Normal::new(
        inp.nominal_return_mean_pct.to_f64().unwrap_or(0.0) / 100.0,
        inp.nominal_return_std_pct.to_f64().unwrap_or(0.0) / 100.0,
    )
    .map_err(|e| format!("名义回报率正态分布构造失败：{e}"))?;
    let nid = Normal::new(
        inp.inflation_mean_pct.to_f64().unwrap_or(0.0) / 100.0,
        inp.inflation_std_pct.to_f64().unwrap_or(0.0) / 100.0,
    )
    .map_err(|e| format!("通胀率正态分布构造失败：{e}"))?;

    let assets0 = inp.current_assets.to_f64().unwrap_or(0.0);
    let target0 = inp.target_value.to_f64().unwrap_or(0.0);
    // 月储蓄（可为负，不校验符号）：金额入参精确解析后转 f64
    let annual_saving_base = (inp.monthly_income.to_f64().unwrap_or(0.0)
        - inp.monthly_expense.to_f64().unwrap_or(0.0))
        * 12.0;

    // samplePaths 抽样索引：均匀 50 条、含首尾；paths < 50 时按公式重复抽取
    let sample_idx: Vec<usize> = (0..SAMPLE_COUNT)
        .map(|k| {
            ((k as f64) * ((paths - 1) as f64) / ((SAMPLE_COUNT - 1) as f64)).round() as usize
        })
        .collect();
    let sample_flags: Vec<bool> = (0..paths).map(|p| sample_idx.contains(&(p as usize))).collect();
    let mut sampled: Vec<Option<Vec<f64>>> = (0..paths).map(|_| None).collect();

    let mut rng = StdRng::seed_from_u64(seed);
    let mut terminals = Vec::with_capacity(paths as usize);
    let mut hit_years: Vec<f64> = Vec::new();
    let mut reached_count: u64 = 0;

    for p in 0..paths {
        let want_sample = sample_flags[p as usize];
        let mut yearly: Vec<f64> = Vec::with_capacity(if want_sample { years as usize } else { 0 });
        let mut assets = assets0;
        let mut cum_infl = 1.0_f64;
        // 初始判定（t = 0）：当前资产 ≥ 基期目标 → 首达年限 0
        let mut hit_year: Option<u64> = if assets >= target0 { Some(0) } else { None };

        // 逐年递推，全程不提前终止（路径图需要全程曲线）
        for t in 1..=years {
            // 抽样顺序固定：先名义回报、后通胀（决定可复现性）
            let mut r = nd.sample(&mut rng);
            if r < -0.99 {
                r = -0.99; // 防御：回报率样本 < −99% 无物理意义，正常参数下概率≈0
            }
            let mut infl = nid.sample(&mut rng);
            if infl < -0.99 {
                infl = -0.99; // 防御：通胀样本 < −99%（价格不能为负）
            }

            // 累计通胀因子（含当年）；年储蓄随通胀上行；资产按名义样本增长
            cum_infl *= 1.0 + infl;
            assets = assets * (1.0 + r) + annual_saving_base * cum_infl;

            if assets.is_nan() || assets <= 0.0 {
                // 资产下限钳 0（与耗尽语义不同：钳后继续模拟）
                assets = 0.0;
            } else if !assets.is_finite() {
                assets = f64::MAX; // 防御：正溢出钳制（正常参数不会触发）
            }

            if hit_year.is_none() {
                // 财富自由判定：目标随通胀水涨（第 t 年目标 = 目标值 × 累计通胀因子）
                let target_t = target0 * cum_infl;
                if assets >= target_t {
                    hit_year = Some(t as u64);
                }
            }

            if want_sample {
                yearly.push(round2_f64(assets));
            }
        }

        if let Some(y) = hit_year {
            reached_count += 1;
            hit_years.push(y as f64);
        }
        terminals.push(assets);
        if want_sample {
            sampled[p as usize] = Some(yearly);
        }
    }

    // 达成概率与未达成占比（6 位小数，后者独立重算，非 1 − fi 的二次舍入）
    let fi_probability = round6_f64(reached_count as f64 / paths as f64);
    let never_reached_share = round6_f64((u64::from(paths) - reached_count) as f64 / paths as f64);

    // 首达年限分位：仅达成样本（升序 + type-7 线性插值 + 两位小数）；
    // 无达成样本五个分位一律 -1.0
    let (years_p5, years_p25, years_median, years_p75, years_p95) = if hit_years.is_empty() {
        (-1.0, -1.0, -1.0, -1.0, -1.0)
    } else {
        hit_years.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        (
            round2_f64(quantile_f64(&hit_years, 0.05)),
            round2_f64(quantile_f64(&hit_years, 0.25)),
            round2_f64(quantile_f64(&hit_years, 0.50)),
            round2_f64(quantile_f64(&hit_years, 0.75)),
            round2_f64(quantile_f64(&hit_years, 0.95)),
        )
    };

    // 期末资产分位：全部路径（下限钳 0 保证非负），升序排序 + type-7 + 两位小数
    terminals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let fq = |qv: f64| round2_f64(quantile_f64(&terminals, qv));

    let sample_paths: Vec<Vec<f64>> = sample_idx
        .iter()
        .map(|&i| sampled[i].clone().unwrap_or_default())
        .collect();

    Ok(AccumulationOutput {
        fi_probability,
        years_p5,
        years_p25,
        years_median,
        years_p75,
        years_p95,
        never_reached_share,
        final_asset_percentiles: AccumulationFinalPercentiles {
            p5: fq(0.05),
            p25: fq(0.25),
            p50: fq(0.50),
            p75: fq(0.75),
            p95: fq(0.95),
        },
        sample_paths,
        error: String::new(),
    })
}
