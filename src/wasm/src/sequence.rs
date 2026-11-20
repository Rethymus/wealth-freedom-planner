//! simulate_sequence —— 确定性序列模拟（序列风险对照，无随机）。契约见
//! src/wasm/bridge.ts SequenceSimInput/Output（§3.1 逐字）。
//!
//! 口径（与 bridge.ts「simulate_sequence 语义」一致）：
//! - 确定性：不构造随机源、不引入 rand；回报样本 = series[t−1] / 100（第 t 年取第
//!   t−1 个元素），沿用既有防御：样本 < −0.99 钳为 −0.99；
//! - 通胀置 0（名义 = 实际）：序列风险对照专用确定性口径，不含通胀上行；
//! - 支取口径：assets_t = assets_{t−1} × (1 + r_t) − annualSpend；任一年末资产 ≤ 0
//!   判耗尽（含终点年），终止递推，当年及以后路径记 0、terminalAssets 记 0、
//!   depletedYear = t；
//! - 积累口径：assets_t = assets_{t−1} × (1 + r_t) + annualSaving；资产下限钳 0
//!   （与 simulate_accumulation 同语义，钳后继续、不提前终止）；depletedYear 恒为 −1；
//! - 校验顺序固定：series 非空且逐元素（|v| ≤ 1000 且 v > −100）→ years 整数且
//!   1 ≤ years ≤ series.length → 金额字段非负（0 ≤ v ≤ 1e15）→ direction 枚举；
//!   direction = "withdrawal" 时 annualSpend 参与、annualSaving 忽略；反之亦然；
//! - 全程 f64（对照模拟属统计演示口径，与蒙特卡洛域一致；输入按 arbitrary_precision
//!   精确解析后转 f64），输出金额两位小数、倍数两位小数。

use rust_decimal::{prelude::*, Decimal};
use serde::{Deserialize, Serialize};

use crate::common::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceSimInput {
    /// 按序逐年名义回报序列（百分点；plain 字段，按字面量精确解析）
    series: Vec<Decimal>,
    /// 模拟年数（1 ≤ years ≤ series.length，整数）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    years: Decimal,
    /// 现金流方向（"withdrawal" | "accumulation"）
    direction: String,
    /// 期初资产（元）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    current_assets: Decimal,
    /// 年支出（元，固定名义；withdrawal 口径参与、accumulation 口径忽略）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_spend: Decimal,
    /// 年储蓄（元，固定名义；accumulation 口径参与、withdrawal 口径忽略）
    #[serde(with = "rust_decimal::serde::arbitrary_precision")]
    annual_saving: Decimal,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceSimOutput {
    /// 逐年年末资产（元，两位小数，长度 = years；支取口径耗尽当年及以后记 0）
    asset_path: Vec<f64>,
    /// 期末资产（元，两位小数；支取口径耗尽记 0；积累口径下限钳 0）
    terminal_assets: f64,
    /// 耗尽年（1 起计；−1 = 存活 / 积累口径不适用）
    depleted_year: i64,
    /// 期末倍数 = terminalAssets ÷ currentAssets（两位小数；currentAssets ≤ 0 时为 0）
    terminal_multiple: f64,
    /// "" 表示成功
    error: String,
}

pub fn handle(input: &str) -> String {
    match compute(input) {
        Ok(out) => serde_json::to_string(&out).unwrap_or_else(|_| error_output("输出序列化失败")),
        Err(e) => error_output(&e),
    }
}

/// 错误/异常时的安全输出形状（空路径、terminal 0、耗尽年 −1、倍数 0）。
pub fn error_output(msg: &str) -> String {
    serde_json::to_string(&SequenceSimOutput {
        asset_path: Vec::new(),
        terminal_assets: 0.0,
        depleted_year: -1,
        terminal_multiple: 0.0,
        error: msg.to_string(),
    })
    .unwrap_or_else(|_| {
        "{\"assetPath\":[],\"terminalAssets\":0,\"depletedYear\":-1,\"terminalMultiple\":0,\"error\":\"内部错误\"}"
            .to_string()
    })
}

fn compute(input: &str) -> Result<SequenceSimOutput, String> {
    let inp: SequenceSimInput =
        serde_json::from_str(input).map_err(|e| format!("输入解析失败：{e}"))?;

    // 校验顺序固定（bridge.ts 契约）：series → years → 金额 → direction
    ensure(
        !inp.series.is_empty(),
        "收益序列须为至少 1 个元素的数值数组",
    )?;
    for v in &inp.series {
        check_pct_signed("收益序列元素", *v)?;
        ensure(
            *v > Decimal::from(-100),
            "收益序列元素须大于 -100（百分点，回报率不得低于 -100%）",
        )?;
    }
    let n = inp.series.len() as u32;
    let years = to_u32_int("模拟年数", inp.years, 1, n)?;
    check_nonneg_money("期初资产", inp.current_assets)?;
    check_nonneg_money("年支出", inp.annual_spend)?;
    check_nonneg_money("年储蓄", inp.annual_saving)?;
    ensure(
        inp.direction == "withdrawal" || inp.direction == "accumulation",
        "现金流方向须为 withdrawal / accumulation 之一",
    )?;

    // 序列预转换（一次性）：百分点 → 小数；按序取用、禁随机
    let series_f: Vec<f64> = inp
        .series
        .iter()
        .map(|d| d.to_f64().unwrap_or(0.0) / 100.0)
        .collect();
    let assets0 = inp.current_assets.to_f64().unwrap_or(0.0);
    let withdrawal = inp.direction == "withdrawal";
    // 未参与口径的金额字段忽略（校验仍覆盖，见上）；参与字段精确解析后转 f64
    let flow = if withdrawal {
        inp.annual_spend.to_f64().unwrap_or(0.0)
    } else {
        inp.annual_saving.to_f64().unwrap_or(0.0)
    };

    let mut asset_path: Vec<f64> = Vec::with_capacity(years as usize);
    let mut assets = assets0;
    let mut depleted_year: i64 = -1;

    for t in 1..=years {
        // 第 t 年取第 t−1 个元素；防御：样本 < −0.99 钳为 −0.99（与蒙特卡洛同口径）
        let mut r = series_f[(t - 1) as usize];
        if r < -0.99 {
            r = -0.99;
        }
        if withdrawal {
            // 支取口径：现金流出；任一年末资产 ≤ 0 判耗尽（含终点年），终止递推
            assets = assets * (1.0 + r) - flow;
            if assets.is_nan() || assets <= 0.0 {
                depleted_year = t as i64;
                assets = 0.0;
                asset_path.push(0.0);
                break;
            }
        } else {
            // 积累口径：现金流入；资产下限钳 0（钳后继续、不提前终止）
            assets = assets * (1.0 + r) + flow;
            if assets.is_nan() || assets <= 0.0 {
                assets = 0.0;
            } else if !assets.is_finite() {
                assets = f64::MAX; // 防御：正溢出钳制（正常输入不会触发）
            }
        }
        asset_path.push(round2_f64(assets));
    }

    // 支取口径耗尽：当年及以后路径记 0、terminalAssets 记 0
    if depleted_year > 0 {
        while asset_path.len() < years as usize {
            asset_path.push(0.0);
        }
        assets = 0.0;
    }
    let terminal = round2_f64(assets);
    let multiple = if assets0 > 0.0 {
        round2_f64(assets / assets0)
    } else {
        0.0
    };

    Ok(SequenceSimOutput {
        asset_path,
        terminal_assets: terminal,
        depleted_year,
        terminal_multiple: multiple,
        error: String::new(),
    })
}

// ---------------------------------------------------------------------------
// 单元测试（bridge.ts §9.1 sequence.rs 测试清单逐条）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn input_json(series: &[f64], years: u32, direction: &str, assets: f64, spend: f64, saving: f64) -> String {
        let s = series
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",");
        format!(
            r#"{{"series":[{s}],"years":{years},"direction":"{direction}","currentAssets":{assets},"annualSpend":{spend},"annualSaving":{saving}}}"#
        )
    }

    fn parse(out: &str) -> (Vec<f64>, f64, i64, f64, String) {
        let v: serde_json::Value = serde_json::from_str(out).unwrap();
        let path = v
            .get("assetPath")
            .and_then(|x| x.as_array())
            .map(|a| a.iter().map(|x| x.as_f64().unwrap()).collect::<Vec<_>>())
            .unwrap();
        (
            path,
            v.get("terminalAssets").and_then(|x| x.as_f64()).unwrap(),
            v.get("depletedYear").and_then(|x| x.as_i64()).unwrap(),
            v.get("terminalMultiple").and_then(|x| x.as_f64()).unwrap(),
            v.get("error").and_then(|x| x.as_str()).unwrap().to_string(),
        )
    }

    #[test]
    fn sequence_withdrawal_hand_example() {
        // §3.3-D 手工小例（逐项可手算）：series = [10, −5, 20]、assets 1,000,000、
        // spend 40,000 → 路径 [1,060,000.00, 967,000.00, 1,120,400.00]、
        // terminal 1,120,400.00、multiple 1.12（精确值 1.1204 经两位小数舍入）、dy −1
        let out = handle(&input_json(&[10.0, -5.0, 20.0], 3, "withdrawal", 1_000_000.0, 40_000.0, 0.0));
        let (path, terminal, dy, multiple, err) = parse(&out);
        assert_eq!(err, "");
        assert_eq!(path, vec![1_060_000.0, 967_000.0, 1_120_400.0]);
        assert!((terminal - 1_120_400.0).abs() <= 0.005, "terminal：{terminal}");
        assert_eq!(dy, -1, "存活 → 耗尽年 −1");
        assert!((multiple - 1.12).abs() <= 0.005, "multiple = round2(1.1204) = 1.12：{multiple}");
    }

    #[test]
    fn sequence_accumulation_hand_example() {
        // §3.3-D 积累小例：annualSaving = 12,000、期初 0 → 路径 [12,000.00, 23,400.00, 40,080.00]；
        // 资产下限钳 0：构造大负样本年（−99.9 → 钳 −0.99）、期初 0 与储蓄 0 →
        // 逐年资产恰为 0（钳 0 后继续、不提前终止，路径长度仍 = years、dy 恒 −1）
        let out = handle(&input_json(&[10.0, -5.0, 20.0], 3, "accumulation", 0.0, 0.0, 12_000.0));
        let (path, terminal, dy, multiple, err) = parse(&out);
        assert_eq!(err, "");
        assert_eq!(path, vec![12_000.0, 23_400.0, 40_080.0]);
        assert!((terminal - 40_080.0).abs() <= 0.005);
        assert_eq!(dy, -1, "积累口径耗尽年恒 −1");
        assert_eq!(multiple, 0.0, "期初资产 0 → 倍数恒 0");

        // 钳 0 后继续：−99.9% 样本被钳为 −0.99，资产 ≤ 0 钳 0 且递推继续到终点
        let out2 = handle(&input_json(&[10.0, -99.9, 20.0], 3, "accumulation", 0.0, 0.0, 0.0));
        let (path2, terminal2, dy2, _, err2) = parse(&out2);
        assert_eq!(err2, "");
        assert_eq!(path2.len(), 3, "钳 0 后继续、不提前终止（路径长度 = years）");
        assert!(path2.iter().all(|x| *x == 0.0), "钳 0 后逐年资产为 0");
        assert!((terminal2 - 0.0).abs() < 1e-9);
        assert_eq!(dy2, -1, "积累口径不判耗尽");
    }

    #[test]
    fn sequence_validation() {
        // years > series.length → error
        let out = handle(&input_json(&[10.0, -5.0], 3, "withdrawal", 1_000_000.0, 40_000.0, 0.0));
        let (_, _, _, _, err) = parse(&out);
        assert!(err.contains("模拟年数"), "years 超序列长度：{err}");
        // 元素越界（≤ −100 / |v| > 1000）/ 空序列 → error
        for bad in [
            vec![-100.0_f64, 5.0],
            vec![1001.0],
            vec![],
        ] {
            let out = handle(&input_json(&bad, 1, "withdrawal", 1_000_000.0, 40_000.0, 0.0));
            let (path, _, _, _, err) = parse(&out);
            assert!(!err.is_empty(), "非法序列应报错：{bad:?}");
            assert!(path.is_empty(), "错误安全值：路径为空");
        }
        // direction 枚举外 → error
        let out = handle(&input_json(&[10.0], 1, "foobar", 1_000_000.0, 40_000.0, 0.0));
        let (_, _, _, _, err) = parse(&out);
        assert!(err.contains("withdrawal / accumulation"), "direction 枚举外：{err}");
        // 负金额 → error
        let out = handle(&input_json(&[10.0], 1, "withdrawal", -1.0, 40_000.0, 0.0));
        let (_, _, _, _, err) = parse(&out);
        assert!(err.contains("期初资产"), "负金额：{err}");
    }
}
