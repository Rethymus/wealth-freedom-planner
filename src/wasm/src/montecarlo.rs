//! run_monte_carlo —— 蒙特卡洛模拟。契约见 src/wasm/bridge.ts MonteCarloInput/Output。
//!
//! 口径（与 bridge.ts「Rust 侧实现遵循」一致）：
//! - 随机数：`StdRng::seed_from_u64(seed)` 固定种子（rand 0.8；wasm32 目标由
//!   Cargo.toml target 段的 getrandom "js" feature 保证可编译）。抽样顺序固定：
//!   路径外层、年份内层，每年先抽名义回报样本、再抽通胀样本，保证同 seed 同输入
//!   输出逐字节一致。
//! - 分布：名义回报 ~ Normal(均值/100, 标准差/100)、通胀 ~ Normal(均值/100, 标准差/100)
//!   （rand_distr，f64）。σ ≤ 0 按任务要求视为异常参数，返回 error。
//! - 逐年递推（第 t 年，名义口径，与 bridge.ts 契约文字一致）：
//!     年末资产 = 上年末 × (1 + r_nominal_t) − 当年支出；
//!     当年支出 spend_t = spend_{t−1} × (1 + inflation_t)，即年支出按当年通胀上行，
//!     第 1 年即含第 1 年通胀样本（bridge.ts「当年支出 = annualSpend × ∏(1+通胀样本)，
//!     自第 1 年起随通胀上行」；输入 annualSpend 为上行前基期支出）。
//!     注意：资产侧不得再做 (1+r)/(1+i)−1 的「实际增长」换算——该换算已剔除通胀，
//!     与支出按通胀上行并用会对通胀双重扣减（回归测试
//!     monte_carlo_nominal_recurrence_known_value 以闭式解锁定本口径）。
//! - 耗尽：任一年末资产 ≤ 0 即判定该路径耗尽，终止递推；耗尽当年及其后各年
//!   年末资产记 0，期末资产记 0，计入 depletionProb。
//! - 防御钳制（正常参数下触发概率≈0，仅防病态输入）：回报/通胀样本 < −0.99 时
//!   钳制为 −0.99（价格/资产不能为负的物理意义）；年末资产非有限（溢出）时
//!   NaN 或 ≤0 记耗尽、正溢出钳制为 f64::MAX。
//! - 统计：耗尽概率 = 耗尽路径数 ÷ 路径数（输出舍入到 6 位小数）；
//!   期末值 5/25/50/75/95 分位数采用「升序排序 + 线性插值」（type-7，
//!   NumPy `numpy.quantile` 默认方法）：pos = q × (n − 1)，取 floor/ceil 邻位
//!   按小数部分线性插值；输出金额两位小数。
//! - samplePaths：按索引均匀抽取 50 条（含首尾）：idx_k = round(k × (paths−1) / 49)，
//!   k = 0..49；路径数 < 50 时按公式重复抽取（bridge.ts 固定 50 条口径）。
//!   每条为逐年年末资产，长度 = years，耗尽当年及以后为 0。
//!
//! 精度说明：本函数的统计抽样与递推按 rand/rand_distr 约定使用 f64（蒙特卡洛是
//! 统计估计，f64 为该领域的标准做法；rust_decimal 无正态分布抽样且运算慢 2 个
//! 数量级以上）。金额入参仍按 arbitrary_precision 精确解析后转 f64，输出统一舍入。
//!
//! 支取策略（P2/F1）：strategy/threshold/percent 三可选字段经 withdrawal.rs 解析，
//! 缺省 fixed = 上述现状口径（零行为变化、逐字节兼容）。策略层为纯函数、不消耗
//! 随机数，抽样顺序（路径外层、年份内层、先回报后通胀）不变——可复现性铁律见
//! bridge.ts §1 与 withdrawal.rs 模块注释。percent 策略耗尽判定窗口为第 1..years−1
//! 年末（终点年归零/残值不计耗尽）；输出增补 sampleWithdrawalPaths 与末年支取额
//! 三分位（fixed 策略下同样输出，语义见 bridge.ts §2.2）。

use rand::rngs::StdRng;
use rand::{SeedableRng};
use rand_distr::{Distribution, Normal};
use rust_decimal::{prelude::*, Decimal};
use serde::{Deserialize, Serialize};

use crate::common::*;
use crate::withdrawal::{
    next_spend_percent, next_spend_threshold, percent_cap_base, resolve_strategy,
    PercentParamsInput, Strategy, ThresholdParamsInput,
};

/// 蒙特卡洛防御性规模上限
const MAX_YEARS: u32 = 200;
const MAX_PATHS: u32 = 100_000;
/// 样本路径条数（bridge.ts 固定口径）
const SAMPLE_COUNT: usize = 50;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloInput {
    /// 当前资产（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    current_assets: Decimal,
    /// 年支出基期值（元/年）——上行前基期支出，第 1 年支出 = 该值 × (1 + 第1年通胀样本)
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_spend: Decimal,
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
    /// 支取策略（缺省 = "fixed" 现状口径；三枚举之一，见 withdrawal.rs）
    strategy: Option<String>,
    /// 阈值带调整型参数（strategy = "threshold" 时必填）
    threshold: Option<ThresholdParamsInput>,
    /// 余额比例型参数（strategy = "percent" 时必填）
    percent: Option<PercentParamsInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloOutput {
    /// 资产耗尽概率（0–1，6 位小数）
    depletion_prob: f64,
    /// 期末资产中位数（元，耗尽路径记 0）
    median_terminal: f64,
    /// 期末资产第 5 百分位（元）
    p5: f64,
    /// 期末资产第 25 百分位（元）
    p25: f64,
    /// 期末资产第 75 百分位（元）
    p75: f64,
    /// 期末资产第 95 百分位（元）
    p95: f64,
    /// 50 条代表性路径的逐年年末值（每条长度 = years）
    sample_paths: Vec<Vec<f64>>,
    /// 50 条代表性路径的逐年当年支取额（名义元，两位小数；耗尽当年及以后记 0）
    sample_withdrawal_paths: Vec<Vec<f64>>,
    /// 末年支取额第 5 百分位（元，全部路径，type-7，两位小数；耗尽路径记 0）
    withdrawal_p5: f64,
    /// 末年支取额中位数（元）
    withdrawal_median: f64,
    /// 末年支取额第 95 百分位（元）
    withdrawal_p95: f64,
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
    serde_json::to_string(&MonteCarloOutput {
        depletion_prob: 0.0,
        median_terminal: 0.0,
        p5: 0.0,
        p25: 0.0,
        p75: 0.0,
        p95: 0.0,
        sample_paths: Vec::new(),
        sample_withdrawal_paths: Vec::new(),
        withdrawal_p5: 0.0,
        withdrawal_median: 0.0,
        withdrawal_p95: 0.0,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"depletionProb\":0,\"medianTerminal\":0,\"p5\":0,\"p25\":0,\"p75\":0,\"p95\":0,\"samplePaths\":[],\"sampleWithdrawalPaths\":[],\"withdrawalP5\":0,\"withdrawalMedian\":0,\"withdrawalP95\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<MonteCarloOutput, String> {
    let inp: MonteCarloInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;
    check_nonneg_money("当前资产", inp.current_assets)?;
    check_nonneg_money("年支出", inp.annual_spend)?;
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

    // 金额入参：精确解析（Decimal）后转 f64（蒙特卡洛统计域既有惯例）
    let assets0 = inp.current_assets.to_f64().unwrap_or(0.0);
    let spend0 = inp.annual_spend.to_f64().unwrap_or(0.0);

    // 支取策略解析与校验（bridge.ts §2.2「策略参数校验」；缺省 fixed，零行为变化）
    let strategy = resolve_strategy(
        &inp.strategy, inp.threshold, inp.percent, inp.current_assets, inp.annual_spend,
    )?;
    // threshold：初始支取率 wr0 = annualSpend ÷ currentAssets（resolve 已保证两者 > 0）；
    // percent：上限基数 cap_base = 首年实际摊还支出（请求级常量，全程缓存——bridge.ts §2.2）
    let (wr0, cap_base) = match &strategy {
        Strategy::Threshold(_) => (spend0 / assets0, 0.0),
        Strategy::Percent(pp) => (0.0, percent_cap_base(assets0, pp.r, years)),
        Strategy::Fixed => (0.0, 0.0),
    };

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

    // samplePaths 抽样索引：均匀 50 条、含首尾；paths < 50 时按公式重复抽取
    let sample_idx: Vec<usize> = (0..SAMPLE_COUNT)
        .map(|k| {
            ((k as f64) * ((paths - 1) as f64) / ((SAMPLE_COUNT - 1) as f64)).round() as usize
        })
        .collect();
    let sample_flags: Vec<bool> = (0..paths).map(|p| sample_idx.contains(&(p as usize))).collect();
    let mut sampled: Vec<Option<Vec<f64>>> = (0..paths).map(|_| None).collect();
    let mut sampled_withdrawal: Vec<Option<Vec<f64>>> = (0..paths).map(|_| None).collect();

    let mut rng = StdRng::seed_from_u64(seed);
    let mut terminals = Vec::with_capacity(paths as usize);
    let mut final_withdrawals = Vec::with_capacity(paths as usize);
    let mut depleted_count: u64 = 0;

    for p in 0..paths {
        let want_sample = sample_flags[p as usize];
        let mut yearly: Vec<f64> = Vec::with_capacity(if want_sample { years as usize } else { 0 });
        let mut yearly_withdrawal: Vec<f64> =
            Vec::with_capacity(if want_sample { years as usize } else { 0 });
        let mut assets = assets0;
        let mut spend = spend0;
        let mut cum_infl = 1.0_f64; // 累计通胀因子（percent 摊还口径用；累计本身不消耗随机流）
        let mut r_prev = 0.0_f64; // 上一年名义回报样本（threshold 冻结规则用；第 1 年无语义）
        let mut depleted = false;

        for year in 1..=years {
            // 抽样顺序固定：先名义回报、后通胀（决定可复现性；策略层不得改变本顺序）
            let mut r = nd.sample(&mut rng);
            if r < -0.99 {
                r = -0.99; // 防御：回报率样本 < −99% 无物理意义，正常参数下概率≈0
            }
            let mut infl = nid.sample(&mut rng);
            if infl < -0.99 {
                infl = -0.99; // 防御：通胀样本 < −99%（价格不能为负）
            }
            let cum_prev = cum_infl;
            cum_infl *= 1.0 + infl; // cum_infl_t = ∏(1 + 通胀样本)（含当年；纯簿记，不触随机流）

            // 当年支取额按策略分支（bridge.ts §2.2）：
            // - fixed（缺省）：保持 P1 逐字节口径——年支出按当年通胀上行；
            //   不得再换算「实际增长」(1+r)/(1+i)−1（与支出上行并用会双重计通胀）
            match &strategy {
                Strategy::Fixed => {
                    spend *= 1.0 + infl;
                }
                Strategy::Threshold(tp) => {
                    // 阈值带规则：assets 此刻仍为年初资产（assets_{t−1}）
                    spend = next_spend_threshold(spend, assets, wr0, infl, r_prev, year, years, tp);
                }
                Strategy::Percent(pp) => {
                    // 余额比例规则：实际口径摊还 → 名义化 → 上限 → 地板 → 可用资产钳制
                    spend = next_spend_percent(
                        assets, cum_prev, cum_infl, r, spend, year, years, spend0, cap_base, pp,
                    );
                }
            }
            r_prev = r; // 记录本年回报样本，供下一年 threshold 冻结规则判定

            // 名义口径递推（bridge.ts 契约）：资产按名义样本增长
            assets = assets * (1.0 + r) - spend; // 年末资产

            if assets.is_nan() || assets <= 0.0 {
                // 资产 ≤ 0 记为耗尽并终止该路径；耗尽当年及以后各年记 0。
                // percent 策略例外（bridge.ts §2.2）：耗尽判定窗口为第 1..years−1 年末，
                // 终点年资产恰为 0（或剩余残值）不计入耗尽
                assets = 0.0;
                let percent_final_year = matches!(strategy, Strategy::Percent(_)) && year == years;
                if !percent_final_year {
                    depleted = true;
                }
            } else if !assets.is_finite() {
                assets = f64::MAX; // 防御：正溢出钳制（正常参数不会触发）
            }
            if want_sample {
                yearly.push(round2_f64(assets));
                // 逐年当年支取额（名义元，两位小数）：耗尽当年及以后记 0；
                // percent 终点年（非耗尽）记实付支取额
                if depleted {
                    yearly_withdrawal.push(0.0);
                } else {
                    yearly_withdrawal.push(round2_f64(spend));
                }
            }
            if depleted {
                break;
            }
        }

        if depleted {
            depleted_count += 1;
            if want_sample {
                while yearly.len() < years as usize {
                    yearly.push(0.0);
                }
                while yearly_withdrawal.len() < years as usize {
                    yearly_withdrawal.push(0.0);
                }
            }
            terminals.push(0.0);
            final_withdrawals.push(0.0); // 耗尽路径末年支取额记 0（bridge.ts §2.2）
        } else {
            terminals.push(assets);
            // 末年（第 years 年）实付支取额：spend 保有终点年支取额（percent 终点年为
            // 可用资产钳制后的实付值），统计口径统一两位小数
            final_withdrawals.push(round2_f64(spend));
        }
        if want_sample {
            sampled[p as usize] = Some(yearly);
            sampled_withdrawal[p as usize] = Some(yearly_withdrawal);
        }
    }

    // 耗尽概率（6 位小数）
    let depletion_prob = round6_f64(depleted_count as f64 / paths as f64);

    // 期末值分位数：升序排序 + 线性插值（type-7，NumPy 默认方法），金额两位小数
    terminals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let q = |qv: f64| round2_f64(quantile_f64(&terminals, qv));

    // 末年支取额分位数：全部路径、升序 + type-7、两位小数（耗尽路径记 0）
    final_withdrawals
        .sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let wq = |qv: f64| round2_f64(quantile_f64(&final_withdrawals, qv));

    let sample_paths: Vec<Vec<f64>> = sample_idx
        .iter()
        .map(|&i| sampled[i].clone().unwrap_or_default())
        .collect();
    let sample_withdrawal_paths: Vec<Vec<f64>> = sample_idx
        .iter()
        .map(|&i| sampled_withdrawal[i].clone().unwrap_or_default())
        .collect();

    Ok(MonteCarloOutput {
        depletion_prob,
        median_terminal: q(0.5),
        p5: q(0.05),
        p25: q(0.25),
        p75: q(0.75),
        p95: q(0.95),
        sample_paths,
        sample_withdrawal_paths,
        withdrawal_p5: wq(0.05),
        withdrawal_median: wq(0.5),
        withdrawal_p95: wq(0.95),
        error: String::new(),
    })
}
