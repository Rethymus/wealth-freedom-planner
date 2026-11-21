//! finance-core 集成测试（cargo test，宿主目标直接调用 wasm-bindgen 导出函数）。
//!
//! 覆盖任务要求的全部用例：
//! - baseline 已知值（2990/4.5/2.0 → 乘数 480、临界值 1,635,200）与 error 分支；
//! - 摊销交叉验证（f64 浮点公式复算 vs rust_finprim/Decimal 实现，月供相对误差 < 0.1%，
//!   首期利息 = 本金 × 月利率）、等额本金首末期、零利率、台账自洽；
//! - rental_analysis 明细与回本（含无法回本、全额首付）；
//! - reverse_estimate 基础与退化口径；
//! - 蒙特卡洛确定性（同 seed 逐字节一致）与方向合理性（高回报低波动 vs 低回报高波动）；
//! - 税档边界（恰好压线）、多档累进、rust_finprim progressive_tax 交叉验证、校验错误。

use finance_core::{
    amortize, calculate_baseline, estimate_pension, estimate_tax, rental_analysis,
    reverse_estimate, run_monte_carlo, run_monte_carlo_bootstrap, simulate_accumulation,
    simulate_sequence, solve_required_saving,
};
use rust_decimal::{prelude::*, Decimal};
use rust_finprim::amort_dep_tax::progressive_tax;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

fn jv(s: &str) -> serde_json::Value {
    serde_json::from_str(s).unwrap_or_else(|e| panic!("输出不是合法 JSON：{e}\n{s}"))
}

fn num(v: &serde_json::Value, k: &str) -> f64 {
    v.get(k)
        .and_then(|x| x.as_f64())
        .unwrap_or_else(|| panic!("缺少数值字段 {k}：{v}"))
}

fn txt(v: &serde_json::Value, k: &str) -> String {
    v.get(k)
        .and_then(|x| x.as_str())
        .map(|x| x.to_string())
        .unwrap_or_else(|| panic!("缺少字符串字段 {k}：{v}"))
}

fn assert_close(a: f64, b: f64, eps: f64, ctx: &str) {
    assert!(
        (a - b).abs() <= eps,
        "{ctx}：期望 ≈ {b}，实际 {a}（容差 {eps}）"
    );
}

/// 中国综合所得年度税率表（速算扣除数已在数据侧换算为等效分段，lower 升序）
const CNY_LOWER: [i64; 7] = [0, 36000, 144000, 300000, 420000, 660000, 960000];
const CNY_RATE: [&str; 7] = ["0.03", "0.1", "0.2", "0.25", "0.3", "0.35", "0.45"];

fn cny_bands_json() -> String {
    let parts: Vec<String> = (0..7)
        .map(|i| format!(r#"{{"lower":{},"rate":{}}}"#, CNY_LOWER[i], CNY_RATE[i]))
        .collect();
    format!("[{}]", parts.join(","))
}

fn tax_input(gross: f64, deduction: i64) -> String {
    format!(
        r#"{{"grossAnnualIncome":{},"standardDeduction":{},"bands":{}}}"#,
        gross,
        deduction,
        cny_bands_json()
    )
}

// ---------------------------------------------------------------------------
// 1. calculate_baseline
// ---------------------------------------------------------------------------

#[test]
fn baseline_known_values_480_rule() {
    // 月开销 2990、名义 4.5、通胀 2.0 → 实际回报率 2.5%、乘数 480；
    // 1 孩 × 200,000，无预留外项 → 临界值 = 480×2990 + 200000 = 1,635,200。
    // P7/T7 费雪双口径（期望值独立推导，node 复算登记 docs/p7-spec.md §3.7）：
    //   精确乘数 = 12×(1.02)/0.025 = 489.6（精确）；
    //   精确临界值 = 2990×489.6 + 200000 = 1,663,904.00（比 480 口径高 28,704.00）
    let out = calculate_baseline(
        r#"{"monthlyExpense":2990,"childCount":1,"costPerChild":200000,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "realReturnPct"), 2.5, 1e-12, "realReturnPct");
    assert_close(num(&v, "multiplier"), 480.0, 1e-12, "multiplier");
    assert_close(num(&v, "criticalValue"), 1_635_200.0, 1e-9, "criticalValue");
    assert_close(num(&v, "monthlyExpense"), 2990.0, 1e-12, "monthlyExpense 回显");
    // 精确口径并行（480 教学口径仍为主输出，上四条锚点零漂移）
    assert_close(num(&v, "multiplierExact"), 489.6, 1e-9, "精确乘数 = 12×1.02/0.025");
    assert_close(
        num(&v, "criticalValueExact"),
        1_663_904.00,
        1e-6,
        "精确临界值 = 2990×489.6 + 200000",
    );
}

#[test]
fn baseline_fractional_multiplier_rounds_and_feeds_critical_value() {
    // 实际回报率 5.0 − 2.35 = 2.65 → 1200/2.65 = 452.8301… → 乘数 452.83（两位小数）；
    // 临界值 = 2990×452.83 + 1×100000 + 5000 + 20000 = 1,353,961.70 + 125,000 = 1,478,961.70
    let out = calculate_baseline(
        r#"{"monthlyExpense":2990,"childCount":1,"costPerChild":100000,"healthReserve":5000,"majorInvestment":20000,"nominalReturnPct":5.0,"inflationPct":2.35}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "multiplier"), 452.83, 1e-12, "乘数两位小数");
    assert_close(num(&v, "criticalValue"), 1_478_961.70, 1e-6, "临界值使用舍入后乘数");
}

#[test]
fn baseline_error_when_real_return_not_positive() {
    // 名义 2.0 < 通胀 4.5：error 分支
    let out = calculate_baseline(
        r#"{"monthlyExpense":2990,"childCount":0,"costPerChild":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":2.0,"inflationPct":4.5}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "通胀率需低于名义回报率");
    assert_close(num(&v, "realReturnPct"), -2.5, 1e-12, "realReturnPct 仍返回计算值");
    assert_eq!(num(&v, "multiplier"), 0.0);
    assert_eq!(num(&v, "criticalValue"), 0.0);
    // P7/E：费雪精确口径两新字段在错误分支同为安全值 0（与 multiplier/criticalValue 同形）
    assert_eq!(num(&v, "multiplierExact"), 0.0, "错误分支精确乘数 = 0");
    assert_eq!(num(&v, "criticalValueExact"), 0.0, "错误分支精确临界值 = 0");
    assert_close(num(&v, "monthlyExpense"), 2990.0, 1e-12, "月开销回显");

    // 恰好为 0（名义 = 通胀）同样进入 error 分支
    let out0 = calculate_baseline(
        r#"{"monthlyExpense":1000,"childCount":0,"costPerChild":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":3.0,"inflationPct":3.0}"#,
    );
    let v0 = jv(&out0);
    assert_eq!(txt(&v0, "error"), "通胀率需低于名义回报率");
    assert_eq!(num(&v0, "multiplier"), 0.0);
}

#[test]
fn baseline_validation_and_parse_errors() {
    // 非法 JSON
    let out = calculate_baseline("not-json");
    let v = jv(&out);
    assert!(txt(&v, "error").starts_with("输入解析失败"), "error = {}", txt(&v, "error"));
    assert_eq!(num(&v, "multiplier"), 0.0);
    assert_eq!(num(&v, "criticalValue"), 0.0);

    // 负月开销
    let neg = calculate_baseline(
        r#"{"monthlyExpense":-1,"childCount":0,"costPerChild":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    assert!(txt(&jv(&neg), "error").contains("月开销"));

    // 非整数孩数
    let frac = calculate_baseline(
        r#"{"monthlyExpense":1000,"childCount":1.5,"costPerChild":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    assert!(txt(&jv(&frac), "error").contains("子女数量"));
}

// ---------------------------------------------------------------------------
// 2. amortize —— 等额本息
// ---------------------------------------------------------------------------

#[test]
fn amortize_equal_payment_cross_validated_by_f64_formula() {
    let out = amortize(
        r#"{"principal":1000000,"annualRatePct":3.9,"years":30,"method":"equal_payment"}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");

    let rows = v.get("rows").and_then(|x| x.as_array()).unwrap();
    assert_eq!(rows.len(), 360, "行数 = 30×12");

    // 独立复算：P·i·(1+i)^n / ((1+i)^n − 1)
    let p = 1_000_000.0f64;
    let i = 0.039f64 / 12.0;
    let n = 360.0f64;
    let pmt_f64 = p * i * (1.0 + i).powf(n) / ((1.0 + i).powf(n) - 1.0);
    let mine = num(&v, "monthlyPayment");
    assert!(
        (mine - pmt_f64).abs() / pmt_f64 < 0.001,
        "月供相对误差须 < 0.1%：mine={mine}，f64={pmt_f64}"
    );

    // 首期利息 = 本金 × 月利率（1,000,000 × 0.039/12 = 3250，恰为整值）
    let first_interest = num(&rows[0], "interestPart");
    assert_close(first_interest, 3250.0, 1e-9, "首期利息已知值");
    assert!(
        (first_interest - p * i).abs() <= 0.005,
        "首期利息 = 本金×月利率（±分位舍入）：{} vs {}",
        first_interest,
        p * i
    );

    // 台账自洽：月次、payment = principal + interest、余额递减且 ≥ 0、末期清零
    let mut sum_principal = 0.0f64;
    let mut sum_interest = 0.0f64;
    let mut prev_remaining = p;
    for (idx, r) in rows.iter().enumerate() {
        assert_eq!(num(r, "month") as usize, idx + 1, "月次从 1 开始");
        let pay = num(r, "payment");
        let pr = num(r, "principalPart");
        let ir = num(r, "interestPart");
        let rem = num(r, "remaining");
        assert_close(pay, pr + ir, 1e-9, "payment = principal + interest");
        assert!(pr >= 0.0, "本金不为负");
        assert!(rem >= 0.0, "余额不为负");
        assert!(rem <= prev_remaining + 1e-9, "余额单调递减");
        assert!((rem - (prev_remaining - pr)).abs() <= 1e-9, "余额递推一致");
        prev_remaining = rem;
        sum_principal += pr;
        sum_interest += ir;
    }
    assert_close(sum_principal, 1_000_000.0, 0.001, "本金合计 = 贷款额");
    assert_close(num(&v, "totalInterest"), sum_interest, 0.001, "总利息 = 逐期利息合计");
    assert_eq!(num(rows.last().unwrap(), "remaining"), 0.0, "末期余额为 0");
    // 非末期月供恒定
    assert_close(num(&rows[0], "payment"), mine, 1e-9, "首期月供 = 月供字段");
    assert_close(num(&rows[100], "payment"), mine, 1e-9, "中期月供 = 月供字段");
}

#[test]
fn amortize_equal_payment_zero_rate() {
    // bridge.ts：r = 0 时月供 = P/n
    let out = amortize(r#"{"principal":120000,"annualRatePct":0,"years":5,"method":"equal_payment"}"#);
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "monthlyPayment"), 2000.0, 1e-9, "零利率月供 = P/n");
    assert_eq!(num(&v, "totalInterest"), 0.0);
    let rows = v.get("rows").unwrap().as_array().unwrap();
    assert_eq!(rows.len(), 60);
    for r in rows {
        assert_eq!(num(r, "interestPart"), 0.0);
        assert_close(num(r, "principalPart"), 2000.0, 1e-9, "每期本金");
    }
    assert_eq!(num(rows.last().unwrap(), "remaining"), 0.0);
}

// ---------------------------------------------------------------------------
// 3. amortize —— 等额本金（首末期）
// ---------------------------------------------------------------------------

#[test]
fn amortize_equal_principal_first_and_last_rows() {
    // P = 240,000、4%、2 年（24 期）：每期本金 10,000；
    // 首期利息 = 240,000×0.04/12 = 800，末期利息 = 10,000×0.04/12 ≈ 33.33
    let out = amortize(
        r#"{"principal":240000,"annualRatePct":4.0,"years":2,"method":"equal_principal"}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    let rows = v.get("rows").unwrap().as_array().unwrap();
    assert_eq!(rows.len(), 24);

    let first = &rows[0];
    assert_close(num(first, "principalPart"), 10_000.0, 1e-9, "首期本金");
    assert_close(num(first, "interestPart"), 800.0, 0.005, "首期利息 = 本金×月利率");
    assert_close(num(first, "payment"), 10_800.0, 0.005, "首期月供");
    assert_close(num(first, "remaining"), 230_000.0, 1e-9, "首期后余额");
    // monthlyPayment = 首月还款额（bridge.ts 口径）
    assert_close(num(&v, "monthlyPayment"), 10_800.0, 0.005, "等额本金月供 = 首月还款额");

    let last = rows.last().unwrap();
    assert_close(num(last, "principalPart"), 10_000.0, 1e-9, "末期本金（吸收余数）");
    assert_close(num(last, "interestPart"), 33.33, 0.005, "末期利息 = 10,000×月利率");
    assert_close(num(last, "payment"), 10_033.33, 0.005, "末期月供");
    assert_eq!(num(last, "remaining"), 0.0, "末期余额为 0");

    // 每期本金恒为 10,000（本例 P/n 恰为整数）；余额逐期 -10,000
    for (idx, r) in rows.iter().enumerate() {
        assert_close(num(r, "principalPart"), 10_000.0, 1e-9, "每期本金");
        assert_close(num(r, "remaining"), (23 - idx) as f64 * 10_000.0, 1e-9, "余额递减");
    }
    // 总利息 ≈ P × i × (n+1)/2 = 800 × 12.5 = 10,000（逐期舍入误差在本例恰好抵消）
    assert_close(num(&v, "totalInterest"), 10_000.0, 0.01, "等额本金总利息");
    let sum_interest: f64 = rows.iter().map(|r| num(r, "interestPart")).sum();
    assert_close(num(&v, "totalInterest"), sum_interest, 0.001, "总利息 = 逐期利息合计");
}

// ---------------------------------------------------------------------------
// 4. amortize —— 校验与解析
// ---------------------------------------------------------------------------

#[test]
fn amortize_validation_errors() {
    for (input, keyword) in [
        (r#"{"principal":0,"annualRatePct":3.9,"years":30,"method":"equal_payment"}"#, "本金"),
        (r#"{"principal":-5,"annualRatePct":3.9,"years":30,"method":"equal_payment"}"#, "本金"),
        (r#"{"principal":100000,"annualRatePct":30,"years":30,"method":"equal_payment"}"#, "年利率"),
        (r#"{"principal":100000,"annualRatePct":-1,"years":30,"method":"equal_payment"}"#, "年利率"),
        (r#"{"principal":100000,"annualRatePct":3.9,"years":2.37,"method":"equal_payment"}"#, "整数"),
        (r#"{"principal":100000,"annualRatePct":3.9,"years":0,"method":"equal_payment"}"#, "月数"),
        (r#"{"principal":100000,"annualRatePct":3.9,"years":30,"method":"foobar"}"#, "解析失败"),
        (r#"{"principal":100000,"annualRatePct":3.9,"years":150,"method":"equal_payment"}"#, "月数"),
    ] {
        let out = amortize(input);
        let v = jv(&out);
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert!(v.get("rows").unwrap().as_array().unwrap().is_empty(), "错误时 rows 为空");
        assert_eq!(num(&v, "monthlyPayment"), 0.0);
    }
}

// ---------------------------------------------------------------------------
// 5. rental_analysis
// ---------------------------------------------------------------------------

fn rental_json(price: f64, dp: f64, rate: f64, years: f64, rent: f64, vac: f64, maint: f64, fee: f64, other: f64, tax: f64) -> String {
    format!(
        r#"{{"price":{},"downPaymentPct":{},"loanAnnualRatePct":{},"loanYears":{},"monthlyRent":{},"vacancyRatePct":{},"maintenanceAnnualRatePct":{},"propertyFeeMonthly":{},"otherAnnualCost":{},"rentTaxRatePct":{}}}"#,
        price, dp, rate, years, rent, vac, maint, fee, other, tax
    )
}

#[test]
fn rental_analysis_positive_cash_flow() {
    // 房价 1,500,000、首付 60%（贷 600,000、3.9%、20 年）、月租 7,000、
    // 空置 5%、维护 1%、物业费 800/月、其他 2,000/年、租金税 5%
    let out = rental_analysis(&rental_json(1_500_000.0, 60.0, 3.9, 20.0, 7_000.0, 5.0, 1.0, 800.0, 2_000.0, 5.0));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    let b = v.get("breakdown").unwrap();

    assert_close(num(b, "loanAmount"), 600_000.0, 0.005, "贷款额");
    assert_close(num(b, "downPayment"), 900_000.0, 0.005, "首付");
    assert_close(num(b, "annualGrossRent"), 84_000.0, 0.005, "年毛租金");
    assert_close(num(b, "annualVacancyLoss"), 4_200.0, 0.005, "年空置损失");
    assert_close(num(b, "annualEffectiveRent"), 79_800.0, 0.005, "年有效租金");
    assert_close(num(b, "annualRentTax"), 3_990.0, 0.005, "年租金税（按有效租金）");
    assert_close(num(b, "annualMaintenance"), 15_000.0, 0.005, "年维护");
    assert_close(num(b, "annualPropertyFee"), 9_600.0, 0.005, "年物业费");
    assert_close(num(b, "annualOtherCost"), 2_000.0, 0.005, "其他年成本");

    // 月供与 amortize 输出完全一致（复用同一实现）
    let loan_out = amortize(r#"{"principal":600000,"annualRatePct":3.9,"years":20,"method":"equal_payment"}"#);
    let loan_v = jv(&loan_out);
    let monthly = num(&v, "monthlyPayment");
    assert_close(monthly, num(&loan_v, "monthlyPayment"), 1e-12, "月供复用 amortize");
    assert_close(num(b, "annualLoanPayment"), monthly * 12.0, 0.005, "年供款 = 月供×12");

    // 年净现金流 = 79,800 − 3,990 − 15,000 − 9,600 − 2,000 − 年供款
    let alp = num(b, "annualLoanPayment");
    let expected_net = 79_800.0 - 3_990.0 - 15_000.0 - 9_600.0 - 2_000.0 - alp;
    assert_close(num(&v, "annualNetCashFlow"), expected_net, 0.005, "年净现金流");
    assert!(num(&v, "annualNetCashFlow") > 0.0, "本例现金流应为正");

    // 回本年限 = 首付 ÷ 年净现金流
    let payback = num(&v, "paybackYears");
    assert!(payback > 0.0, "现金流为正时回本年限为正");
    assert_close(payback, (900_000.0 / num(&v, "annualNetCashFlow") * 100.0).round() / 100.0, 0.01, "回本年限");
    assert_eq!(num(b, "paybackImpossible"), 0.0, "正常回本标注");
}

#[test]
fn rental_analysis_unable_to_payback_and_full_down_payment() {
    // 月租 2,000：现金流为负 → paybackYears = -1 且 paybackImpossible = 1
    let out = rental_analysis(&rental_json(1_500_000.0, 60.0, 3.9, 20.0, 2_000.0, 5.0, 1.0, 800.0, 2_000.0, 5.0));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert!(num(&v, "annualNetCashFlow") < 0.0, "本例现金流应为负");
    assert_eq!(num(&v, "paybackYears"), -1.0, "无法回本时 paybackYears = -1");
    assert_eq!(num(v.get("breakdown").unwrap(), "paybackImpossible"), 1.0, "breakdown 注明无法回本");

    // 首付 100%：贷款为 0，月供 0，现金流 = 租金流 − 持有成本，回本年限为正
    let out_full = rental_analysis(&rental_json(1_500_000.0, 100.0, 3.9, 20.0, 7_000.0, 5.0, 1.0, 800.0, 2_000.0, 5.0));
    let v_full = jv(&out_full);
    assert_eq!(txt(&v_full, "error"), "");
    assert_eq!(num(&v_full, "monthlyPayment"), 0.0, "全额首付无月供");
    let b = v_full.get("breakdown").unwrap();
    assert_close(num(b, "loanAmount"), 0.0, 1e-12, "贷款为 0");
    let net = num(&v_full, "annualNetCashFlow");
    assert_close(net, 79_800.0 - 3_990.0 - 15_000.0 - 9_600.0 - 2_000.0, 0.005, "无贷款现金流");
    assert_close(num(&v_full, "paybackYears"), (1_500_000.0 / net * 100.0).round() / 100.0, 0.01, "回本年限");
}

#[test]
fn rental_analysis_validation_errors() {
    for (input, keyword) in [
        (rental_json(0.0, 60.0, 3.9, 20.0, 7000.0, 5.0, 1.0, 800.0, 2000.0, 5.0), "房屋总价"),
        (rental_json(1_500_000.0, 150.0, 3.9, 20.0, 7000.0, 5.0, 1.0, 800.0, 2000.0, 5.0), "首付比例"),
        (rental_json(1_500_000.0, 60.0, 3.9, 2.37, 7000.0, 5.0, 1.0, 800.0, 2000.0, 5.0), "整数"),
        (rental_json(1_500_000.0, 60.0, 3.9, 20.0, 7000.0, 150.0, 1.0, 800.0, 2000.0, 5.0), "空置率"),
        (rental_json(1_500_000.0, 60.0, 3.9, 20.0, 7000.0, 5.0, 1.0, 800.0, 2000.0, 150.0), "租金税负"),
    ] {
        let v = jv(&rental_analysis(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
    }
}

// ---------------------------------------------------------------------------
// 6. reverse_estimate
// ---------------------------------------------------------------------------

#[test]
fn reverse_estimate_basic() {
    // 总资产 1,000,000、无预留、名义 4.5、通胀 2.0：
    // 可投资产 1,000,000；可持续月支出 = 1,000,000×0.025/12 = 2,083.33；
    // 可支撑年限 = 12 ÷ 2.5 = 4.8
    let out = reverse_estimate(
        r#"{"totalAssets":1000000,"childReserve":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "investableAssets"), 1_000_000.0, 1e-12, "可投资产");
    assert_close(num(&v, "sustainableMonthly"), 2_083.33, 1e-9, "可持续月支出（永续口径）");
    assert_close(num(&v, "yearsSupported"), 4.8, 1e-12, "可支撑年限 = 乘数/100");

    // 含预留：可投资产 = 1,000,000 − 300,000 − 50,000 − 100,000 = 550,000
    // 可持续月支出 = 550,000 × 0.025 ÷ 12 = 1,145.83
    let out2 = reverse_estimate(
        r#"{"totalAssets":1000000,"childReserve":300000,"healthReserve":50000,"majorInvestment":100000,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    let v2 = jv(&out2);
    assert_eq!(txt(&v2, "error"), "");
    assert_close(num(&v2, "investableAssets"), 550_000.0, 1e-12, "扣除三项预留");
    assert_close(num(&v2, "sustainableMonthly"), 1_145.83, 1e-9, "可持续月支出");
    assert_close(num(&v2, "yearsSupported"), 4.8, 1e-12, "可支撑年限只随回报率变化");
}

#[test]
fn reverse_estimate_degenerate_conventions() {
    // 实际回报率 = 0（名义 = 通胀）：error、月支出/年限为 0、可投资产仍返回
    let out = reverse_estimate(
        r#"{"totalAssets":1000000,"childReserve":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":2.0,"inflationPct":2.0}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "通胀率需低于名义回报率");
    assert_close(num(&v, "investableAssets"), 1_000_000.0, 1e-12, "可投资产仍返回");
    assert_eq!(num(&v, "sustainableMonthly"), 0.0);
    assert_eq!(num(&v, "yearsSupported"), 0.0);

    // 实际回报率 < 0：同样退化
    let out2 = reverse_estimate(
        r#"{"totalAssets":800000,"childReserve":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":1.0,"inflationPct":3.0}"#,
    );
    let v2 = jv(&out2);
    assert_eq!(txt(&v2, "error"), "通胀率需低于名义回报率");
    assert_eq!(num(&v2, "sustainableMonthly"), 0.0);
    assert_eq!(num(&v2, "yearsSupported"), 0.0);

    // 预留超过总资产：可投资产钳制为 0（回报率正常，error 为空）
    let out3 = reverse_estimate(
        r#"{"totalAssets":500000,"childReserve":600000,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
    );
    let v3 = jv(&out3);
    assert_eq!(txt(&v3, "error"), "");
    assert_eq!(num(&v3, "investableAssets"), 0.0);
    assert_eq!(num(&v3, "sustainableMonthly"), 0.0);
}

// ---------------------------------------------------------------------------
// 7. run_monte_carlo
// ---------------------------------------------------------------------------

fn mc_input(seed: u64, mean_r: f64, std_r: f64, mean_i: f64, std_i: f64, years: f64, paths: f64) -> String {
    format!(
        r#"{{"currentAssets":1000000,"annualSpend":40000,"nominalReturnMeanPct":{},"nominalReturnStdPct":{},"inflationMeanPct":{},"inflationStdPct":{},"years":{},"paths":{},"seed":{}}}"#,
        mean_r, std_r, mean_i, std_i, years, paths, seed
    )
}

fn acc_input(
    current_assets: f64,
    income: f64,
    expense: f64,
    target: f64,
    mean_r: f64,
    std_r: f64,
    mean_i: f64,
    std_i: f64,
    years: f64,
    paths: f64,
    seed: u64,
) -> String {
    format!(
        r#"{{"currentAssets":{},"monthlyIncome":{},"monthlyExpense":{},"targetValue":{},"nominalReturnMeanPct":{},"nominalReturnStdPct":{},"inflationMeanPct":{},"inflationStdPct":{},"years":{},"paths":{},"seed":{}}}"#,
        current_assets, income, expense, target, mean_r, std_r, mean_i, std_i, years, paths, seed
    )
}

#[test]
fn monte_carlo_is_deterministic_for_same_seed() {
    let inp = mc_input(42, 6.0, 10.0, 2.0, 2.0, 30.0, 300.0);
    let a = run_monte_carlo(&inp);
    let b = run_monte_carlo(&inp);
    assert_eq!(a, b, "同 seed 同输入必须逐字节一致");

    // 不同 seed 应产生不同结果（统计路径几乎必然不同）
    let c = run_monte_carlo(&mc_input(43, 6.0, 10.0, 2.0, 2.0, 30.0, 300.0));
    assert_ne!(a, c, "不同 seed 输出应不同");

    let v = jv(&a);
    assert_eq!(txt(&v, "error"), "");
    // 字段齐备且概率在 [0, 1]
    for k in ["depletionProb", "medianTerminal", "p5", "p25", "p75", "p95"] {
        let x = num(&v, k);
        if k == "depletionProb" {
            assert!((0.0..=1.0).contains(&x), "耗尽概率须在 [0,1]：{x}");
        }
    }
}

#[test]
fn monte_carlo_direction_high_return_low_vol_beats_low_return_high_vol() {
    // 高回报低波动（实际增长约 5.9%、低波动） vs 低回报高波动（实际约 −2.9%、高波动）
    let good = jv(&run_monte_carlo(&mc_input(7, 8.0, 3.0, 2.0, 1.0, 30.0, 300.0)));
    let bad = jv(&run_monte_carlo(&mc_input(7, 2.0, 15.0, 5.0, 8.0, 30.0, 300.0)));

    let pg = num(&good, "depletionProb");
    let pb = num(&bad, "depletionProb");
    // 观测值（--nocapture 可见）：用于校准阈值
    eprintln!("MC 方向观测：好情形耗尽概率 = {pg}，中位数 = {}", num(&good, "medianTerminal"));
    eprintln!("MC 方向观测：坏情形耗尽概率 = {pb}，中位数 = {}", num(&bad, "medianTerminal"));
    assert!(pg < 0.30, "高回报低波动耗尽概率应低（实际 {pg}）");
    assert!(pb > 0.85, "低回报高波动耗尽概率应高（实际 {pb}）");
    assert!(pb - pg > 0.5, "两者差异应显著：{pb} − {pg}");

    // 中位数方向：好情形中位数应显著高于初始资产，坏情形应耗尽为 0
    assert!(num(&good, "medianTerminal") > 1_000_000.0, "好情形中位数应增长");
    assert_eq!(num(&bad, "medianTerminal"), 0.0, "坏情形中位数耗尽为 0");

    // 分位数单调；samplePaths 形状（50 条 × years）
    let (p5, p25, p50, p75, p95) = (
        num(&good, "p5"),
        num(&good, "p25"),
        num(&good, "medianTerminal"),
        num(&good, "p75"),
        num(&good, "p95"),
    );
    assert!(p5 <= p25 && p25 <= p50 && p50 <= p75 && p75 <= p95, "分位数须单调：{p5},{p25},{p50},{p75},{p95}");
    let paths = good.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50, "固定抽取 50 条");
    for path in paths {
        assert_eq!(path.as_array().unwrap().len(), 30, "每条长度 = years");
    }
}

#[test]
fn monte_carlo_nominal_recurrence_known_value() {
    // 口径锁定：名义回报增长 + 支出随通胀上行（bridge.ts 契约），不得对通胀双重计提。
    // σ 取极小值使路径近似确定，期末值可与闭式解手算对照：
    //   A_t = A_0·g^t − s·Σ_{k=1..t} i^k·g^(t−k)，g = 1 + r_nom、i = 1 + infl
    //       = A_0·g^t − s·i·(g^t − i^t)/(g − i)
    // 输入 A_0 = 1,000,000、s = 50,000、r = 5%、i = 2%、t = 20：
    //   契约名义口径 A_20 = 668,802.18；
    //   若实现误用「实际增长 (1+r)/(1+i)−1 × 支出按通胀上行」的混合口径则为 161,887.09。
    let out = run_monte_carlo(
        r#"{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":2,"inflationStdPct":1e-9,"years":20,"paths":20,"seed":7}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "depletionProb"), 0.0, "该参数下不应耗尽");
    let expected = 668_802.18;
    for k in ["medianTerminal", "p5", "p25", "p75", "p95"] {
        let x = num(&v, k);
        assert!(
            (x - expected).abs() < 0.05,
            "{k} 应为名义口径闭式解 {expected}（实际 {x}）"
        );
    }
}

#[test]
fn monte_carlo_no_spend_never_depletes_and_sample_covers_first_last() {
    // 零支出 + 正回报 → 永不耗尽
    let out = run_monte_carlo(
        r#"{"currentAssets":1000000,"annualSpend":0,"nominalReturnMeanPct":5,"nominalReturnStdPct":5,"inflationMeanPct":2,"inflationStdPct":1,"years":20,"paths":100,"seed":9}"#,
    );
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "depletionProb"), 0.0, "零支出不会耗尽");
    assert!(num(&v, "p5") > 0.0, "全部期末值 > 0");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50);
    // 每条逐年值均 > 0（无耗尽）
    for path in paths {
        for x in path.as_array().unwrap() {
            assert!(x.as_f64().unwrap() > 0.0);
        }
    }

    // paths = 1、years = 1：仍输出 50 条（索引公式退化为全 0，含首尾）
    let tiny = jv(&run_monte_carlo(&mc_input(11, 5.0, 5.0, 2.0, 1.0, 1.0, 1.0)));
    let tp = tiny.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(tp.len(), 50, "paths < 50 时按索引公式重复抽取至 50 条");
    assert_eq!(tp[0].as_array().unwrap().len(), 1);
}

#[test]
fn monte_carlo_validation_errors() {
    // σ ≤ 0 → error（任务明确要求）
    for (input, keyword) in [
        (mc_input(1, 5.0, 0.0, 2.0, 1.0, 10.0, 10.0), "标准差"),
        (mc_input(1, 5.0, -1.0, 2.0, 1.0, 10.0, 10.0), "标准差"),
        (mc_input(1, 5.0, 5.0, 2.0, 0.0, 10.0, 10.0), "标准差"),
        (mc_input(1, 5.0, 5.0, 2.0, 1.0, 0.0, 10.0), "年数"),
        (mc_input(1, 5.0, 5.0, 2.0, 1.0, 10.0, 0.0), "路径数"),
        (mc_input(1, 5.0, 5.0, 2.0, 1.0, 0.5, 10.0), "整数"),
        // 负资产
        (
            r#"{"currentAssets":-1,"annualSpend":40000,"nominalReturnMeanPct":5,"nominalReturnStdPct":5,"inflationMeanPct":2,"inflationStdPct":1,"years":10,"paths":10,"seed":1}"#.to_string(),
            "当前资产",
        ),
    ] {
        let v = jv(&run_monte_carlo(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert!(v.get("samplePaths").unwrap().as_array().unwrap().is_empty());
    }
}

// ---------------------------------------------------------------------------
// 8. estimate_tax
// ---------------------------------------------------------------------------

#[test]
fn tax_band_boundary_exact_threshold() {
    // 恰好压线：taxable = 36,000 → 全额落第 1 档，tax = 36,000×0.03 = 1,080
    let v = jv(&estimate_tax(&tax_input(96_000.0, 60_000)));
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "taxableIncome"), 36_000.0, 1e-9, "应纳税所得额");
    assert_close(num(&v, "tax"), 1_080.0, 1e-9, "压线税额");
    assert_close(num(&v, "netIncome"), 96_000.0 - 1_080.0, 1e-9, "税后收入");
    // 有效税率 = 1080/96000×100 = 1.125 → 两位小数 1.13（四舍五入远离零）
    assert_close(num(&v, "effectiveRatePct"), 1.13, 1e-9, "有效税率");

    // 恰好压线：taxable = 144,000 → 1080 + 108000×0.1 = 11,880
    let v2 = jv(&estimate_tax(&tax_input(204_000.0, 60_000)));
    assert_close(num(&v2, "taxableIncome"), 144_000.0, 1e-9, "应纳税所得额");
    assert_close(num(&v2, "tax"), 11_880.0, 1e-9, "压线税额（下一段为 0）");

    // 越线 1 元：taxable = 144,001 → 11,880 + 1×0.2 = 11,880.20
    let v3 = jv(&estimate_tax(&tax_input(204_001.0, 60_000)));
    assert_close(num(&v3, "taxableIncome"), 144_001.0, 1e-9, "应纳税所得额");
    assert_close(num(&v3, "tax"), 11_880.2, 1e-9, "越线 1 元");
}

#[test]
fn tax_multi_band_progression() {
    // taxable = 500,000（gross 560,000）：
    // 36,000×0.03 + 108,000×0.1 + 156,000×0.2 + 120,000×0.25 + 80,000×0.3 = 97,080
    let v = jv(&estimate_tax(&tax_input(560_000.0, 60_000)));
    assert_close(num(&v, "taxableIncome"), 500_000.0, 1e-9, "应纳税所得额");
    assert_close(num(&v, "tax"), 97_080.0, 1e-9, "多档累进税额");
    assert_close(num(&v, "netIncome"), 462_920.0, 1e-9, "税后收入");
    // 有效税率 = 97080/560000×100 = 17.3357… → 17.34
    assert_close(num(&v, "effectiveRatePct"), 17.34, 1e-9, "有效税率两位小数");

    // 顶层档：taxable = 1,440,000（gross 1,500,000）：
    // 1,080 + 10,800 + 31,200 + 30,000 + 72,000 + 105,000 + 480,000×0.45 = 466,080
    let v2 = jv(&estimate_tax(&tax_input(1_500_000.0, 60_000)));
    assert_close(num(&v2, "tax"), 466_080.0, 1e-9, "触及最高档");
}

#[test]
fn tax_cross_validated_against_rust_finprim_progressive_tax() {
    // 独立参照：rust_finprim 的 progressive_tax（(上限, 税率) 表，末档 = Decimal::MAX）
    let table: Vec<(Decimal, Decimal)> = (0..7)
        .map(|i| {
            let upper = if i == 6 {
                Decimal::MAX
            } else {
                Decimal::from(CNY_LOWER[i + 1])
            };
            (upper, Decimal::from_str(CNY_RATE[i]).unwrap())
        })
        .collect();

    for gross in [96_000.0f64, 120_000.0, 204_000.0, 204_001.0, 400_000.0, 560_000.0, 1_500_000.0] {
        let v = jv(&estimate_tax(&tax_input(gross, 60_000)));
        let mine = Decimal::from_f64(num(&v, "tax")).unwrap();
        let theirs = progressive_tax(
            Decimal::from_f64(gross).unwrap(),
            Decimal::from(60_000u64),
            &table,
        )
        .unwrap_or_else(|| panic!("rust_finprim 参照实现应返回有效值"));
        let diff = (mine - theirs).abs();
        assert!(
            diff <= Decimal::new(5, 3), // 0.005：本实现按分位舍入
            "gross={gross}：mine={mine}，rust_finprim={theirs}"
        );
    }
}

#[test]
fn tax_zero_and_below_deduction() {
    // gross = 0 → 全 0 且无错误
    let v = jv(&estimate_tax(&tax_input(0.0, 60_000)));
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "taxableIncome"), 0.0);
    assert_eq!(num(&v, "tax"), 0.0);
    assert_eq!(num(&v, "effectiveRatePct"), 0.0, "gross = 0 时有效税率返回 0");

    // 收入低于扣除额 → taxable = 0
    let v2 = jv(&estimate_tax(&tax_input(50_000.0, 60_000)));
    assert_eq!(txt(&v2, "error"), "");
    assert_eq!(num(&v2, "taxableIncome"), 0.0);
    assert_eq!(num(&v2, "tax"), 0.0);
}

#[test]
fn tax_single_band_and_validation_errors() {
    // 单档 [0 @ 0.1]：taxable 1,000 → 100
    let v = jv(&estimate_tax(
        r#"{"grossAnnualIncome":1000,"standardDeduction":0,"bands":[{"lower":0,"rate":0.1}]}"#,
    ));
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "tax"), 100.0, 1e-9, "单档税率");

    for (input, keyword) in [
        // 空税档
        (r#"{"grossAnnualIncome":1000,"standardDeduction":0,"bands":[]}"#.to_string(), "税档表"),
        // 下限降序
        (
            r#"{"grossAnnualIncome":1000,"standardDeduction":0,"bands":[{"lower":100,"rate":0.1},{"lower":50,"rate":0.2}]}"#.to_string(),
            "升序",
        ),
        // 税率回退（非单调不降）：0.3 → 0.1 属非法累进结构
        (
            r#"{"grossAnnualIncome":1000,"standardDeduction":0,"bands":[{"lower":0,"rate":0.3},{"lower":100,"rate":0.1}]}"#.to_string(),
            "单调",
        ),
        // 税率超 1
        (r#"{"grossAnnualIncome":1000,"standardDeduction":0,"bands":[{"lower":0,"rate":1.5}]}"#.to_string(), "税率"),
        // 负收入
        (r#"{"grossAnnualIncome":-100,"standardDeduction":0,"bands":[{"lower":0,"rate":0.1}]}"#.to_string(), "税前收入"),
    ] {
        let v = jv(&estimate_tax(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(num(&v, "tax"), 0.0);
    }
}

// ---------------------------------------------------------------------------
// 9. panic 兜底与全局错误约定
// ---------------------------------------------------------------------------

#[test]
fn all_outputs_carry_error_field_convention() {
    // 成功输出的 error 为空字符串
    for out in [
        calculate_baseline(
            r#"{"monthlyExpense":2990,"childCount":0,"costPerChild":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
        ),
        amortize(r#"{"principal":100000,"annualRatePct":3.9,"years":10,"method":"equal_payment"}"#),
        rental_analysis(&rental_json(1_000_000.0, 50.0, 3.9, 20.0, 5_000.0, 5.0, 1.0, 800.0, 0.0, 5.0)),
        reverse_estimate(
            r#"{"totalAssets":1000000,"childReserve":0,"healthReserve":0,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}"#,
        ),
        run_monte_carlo(&mc_input(1, 5.0, 5.0, 2.0, 1.0, 5.0, 20.0)),
        estimate_tax(&tax_input(100_000.0, 60_000)),
    ] {
        let v = jv(&out);
        assert!(v.get("error").is_some(), "每个输出都应带 error 字段");
        assert_eq!(txt(&v, "error"), "");
    }

    // 错误输出的 error 非空且为合法 JSON（安全值）
    let bad = jv(&amortize("garbage"));
    assert!(!txt(&bad, "error").is_empty());
    assert_eq!(num(&bad, "monthlyPayment"), 0.0);
}

// ---------------------------------------------------------------------------
// 10. simulate_accumulation
// ---------------------------------------------------------------------------

#[test]
fn accumulation_same_seed_is_deterministic() {
    let inp = acc_input(500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 200.0, 42);
    let a = simulate_accumulation(&inp);
    let b = simulate_accumulation(&inp);
    assert_eq!(a, b, "同 seed 同输入必须逐字节一致");

    let c = simulate_accumulation(&acc_input(
        500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 200.0, 43,
    ));
    assert_ne!(a, c, "不同 seed 输出应不同");

    let v = jv(&a);
    assert_eq!(txt(&v, "error"), "");
    let fi = num(&v, "fiProbability");
    assert!((0.0..=1.0).contains(&fi), "达成概率须在 [0,1]：{fi}");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50, "固定抽取 50 条");
    for path in paths {
        assert_eq!(path.as_array().unwrap().len(), 40, "每条长度 = years");
    }
}

#[test]
fn accumulation_zero_volatility_closed_form_known_value() {
    // 闭式解与锚点见 docs/p0-spec.md §4.7：
    // A0 = 500,000、月收入 6,000、月支出 3,000（月储蓄 3,000 → S = 36,000）、
    // r = 5%、i = 2%、目标 1,635,200：B_17 = 1,597,970.22 < 目标 ≤ B_18 = 1,680,969.34
    // → 全部路径首达年限 = 18；A_40 = 9,434,299.99（期末分位锚点）。
    // 容差 5 元覆盖 σ=1e-9 抽样抖动的复利影响（相对约 5e-7）。
    let out = simulate_accumulation(&acc_input(
        500000.0, 6000.0, 3000.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 40.0, 40.0, 7,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-9, "全部路径达成");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_close(num(&v, k), 18.0, 1e-9, "零波动下首达年限全为 18");
    }
    assert_close(num(&v, "neverReachedShare"), 0.0, 1e-9, "无未达成路径");

    let fp = v.get("finalAssetPercentiles").unwrap();
    for k in ["p5", "p25", "p50", "p75", "p95"] {
        let x = num(fp, k);
        assert!(
            (x - 9_434_299.99).abs() <= 5.0,
            "{k} 应为闭式解 A_40 ≈ 9,434,299.99（实际 {x}）"
        );
    }

    // paths = 40 < 50：按索引公式重复抽取至 50 条（契约口径）
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50);
    let p0 = paths[0].as_array().unwrap();
    let a17 = p0[16].as_f64().unwrap();
    let a18 = p0[17].as_f64().unwrap();
    assert!(
        a17 / 1.02f64.powi(17) < 1_635_200.0,
        "第 17 年末实际项未达标：{}",
        a17 / 1.02f64.powi(17)
    );
    assert!(
        a18 / 1.02f64.powi(18) >= 1_635_200.0,
        "第 18 年末实际项达标"
    );
    assert!(
        (a18 - 2_400_838.15).abs() <= 5.0,
        "第 18 年末名义资产 ≈ 2,400,838.15（实际 {a18}）"
    );
}

#[test]
fn accumulation_negative_saving_never_reaches() {
    // 月收入 3,000 < 月支出 6,000：月储蓄 −3,000，起点 0 → 每年下限钳 0，永不达标
    let out = simulate_accumulation(&acc_input(
        0.0, 3000.0, 6000.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 30.0, 10.0, 1,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 0.0, 1e-12, "负储蓄永不达标");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_eq!(num(&v, k), -1.0, "{k} 无达成样本应为 -1");
    }
    assert_close(num(&v, "neverReachedShare"), 1.0, 1e-12, "未达成占比 1");
    let fp = v.get("finalAssetPercentiles").unwrap();
    for k in ["p5", "p25", "p50", "p75", "p95"] {
        assert_eq!(num(fp, k), 0.0, "资产下限钳 0：期末 {k} = 0");
    }
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    for row in paths {
        for x in row.as_array().unwrap() {
            assert_eq!(x.as_f64().unwrap(), 0.0, "钳 0 后逐年年末值均为 0");
        }
    }
}

#[test]
fn accumulation_reaches_at_year_zero() {
    // 初始资产 2,000,000 ≥ 目标 1,635,200 → 首达年限 0（t = 0 即判定）
    let out = simulate_accumulation(&acc_input(
        2000000.0, 0.0, 0.0, 1635200.0, 5.0, 1e-9, 2.0, 1e-9, 10.0, 5.0, 3,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-12, "初始即达标");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_close(num(&v, k), 0.0, 1e-12, &format!("{k} = 0（初始即达标）"));
    }
    assert_close(num(&v, "neverReachedShare"), 0.0, 1e-12, "无未达成路径");
}

#[test]
fn accumulation_target_inflates_with_inflation() {
    // 口径断言：判定目标随通胀上行（t 年目标 = 目标值 × ∏(1+通胀样本)）。
    // r = 0%、i = 2%、A0 = 500,000、月储蓄 5,000（S = 60,000）、目标 1,000,000：
    // B_t = 3,060,000 − 2,560,000·1.02^−t ≥ 1,000,000 ⇔ 1.02^t ≥ 1.2427 → t* = 11；
    // 若误用「固定目标」口径则 t* = 8 —— 断言 11 锁定上行口径。
    let out = simulate_accumulation(&acc_input(
        500000.0, 5000.0, 0.0, 1000000.0, 0.0, 1e-9, 2.0, 1e-9, 30.0, 20.0, 7,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "yearsMedian"), 11.0, 1e-9, "目标随通胀上行时首达中位 11 年");
    assert!(num(&v, "yearsMedian") > 8.0, "不得退化为固定目标口径（= 8 年）");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-9, "30 年内全部达成");
}

#[test]
fn accumulation_negative_real_growth_never_reaches_inflating_target() {
    // r = −1%、i = 5%、A0 = 500,000、月储蓄 3,000（S = 36,000）、目标 1,000,000：
    // 实际项上界 B∞ = 36,000 ÷ (1 − 0.99/1.05) = 630,000 < 1,000,000 → 永不达标；
    // 名义资产终将累积超过固定目标，故本断言同时从反面锁定「目标上行」口径。
    let out = simulate_accumulation(&acc_input(
        500000.0, 3000.0, 0.0, 1000000.0, -1.0, 1e-9, 5.0, 1e-9, 60.0, 20.0, 5,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 0.0, 1e-12, "负实际增长 + 目标上行 → 永不达标");
    assert_eq!(num(&v, "yearsMedian"), -1.0);
}

#[test]
fn accumulation_validation_errors() {
    for (input, keyword) in [
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 0.0, 2.0, 1.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, -1.0, 2.0, 1.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 0.0, 40.0, 10.0, 1), "标准差"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 0.0, 10.0, 1), "模拟年数"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 0.5, 10.0, 1), "整数"),
        (acc_input(0.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 0.0, 1), "模拟路径数"),
        (acc_input(-1.0, 6000.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 10.0, 1), "当前资产"),
        (acc_input(0.0, -100.0, 3000.0, 1635200.0, 5.0, 12.0, 2.0, 1.0, 40.0, 10.0, 1), "月收入"),
    ] {
        let v = jv(&simulate_accumulation(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(num(&v, "yearsMedian"), -1.0, "错误安全值：年限分位 = -1");
        assert!(v.get("samplePaths").unwrap().as_array().unwrap().is_empty());
    }
}

// ---------------------------------------------------------------------------
// 10b. P7/P0-2 存续验证（sustainYears / sustainedProbability；docs/p7-spec.md §3.4–§3.10。
//     期望值全部由公式独立推导并经 node 复算登记，未以实现输出为真值）
// ---------------------------------------------------------------------------

/// 在 acc_input 基础上追加 sustainYears 键（acc_input 载荷无嵌套对象，尾花括号唯一）
fn acc_input_s(base: String, sustain_years: u64) -> String {
    let mut s = base;
    assert!(s.ends_with('}'));
    s.pop();
    s.push_str(&format!(r#","sustainYears":{}}}"#, sustain_years));
    s
}

/// T4（新增 `accumulation_sustained_fail_overdraw`，修订轮 P2-8 改名）：
/// 名实口径——σ = 1e-9 下无任何暴跌样本，本用例覆盖「首触达标但支取率超高」的
/// 确定性超额支取耗尽机制；真 σ 的「达标后回落」叙事由 T4-b 与 T8 承载。
/// 独立推导（node 复算，docs/p7-spec.md §3.4）：月储蓄 0 → 第 1 年末 110,000 ≥ 105,000
/// （i = 0 目标恒定）→ 首达年 1，A* = 110,000、cumInfl* ≈ 1；支取年支 24,000
/// （支取率 24,000/110,000 ≈ 21.8% ≫ r = 10%）：W1 97,000 → W2 82,700 → W3 66,970
/// → W4 49,667 → W5 30,633.70 → W6 9,697.07 → W7 = −13,333.22 ≤ 0 → 第 7 个支取年
/// 耗尽 ≤ N = 10 → 全体路径不存续 → sustainedProbability = 0.0。
/// （登记：audit §4 T4 行「r=2% 推导」与其声明输入 r 10±1e-9% 矛盾，系笔误；
/// 本实现按声明输入 r = 10% 推导为唯一登记口径。）
#[test]
fn accumulation_sustained_fail_overdraw() {
    let base = acc_input(100000.0, 2000.0, 2000.0, 105000.0, 10.0, 1e-9, 0.0, 1e-9, 2.0, 20.0, 7);
    let v = jv(&simulate_accumulation(&acc_input_s(base, 10)));
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-12, "全部路径第 1 年首触达标");
    for k in ["yearsP5", "yearsP25", "yearsMedian", "yearsP75", "yearsP95"] {
        assert_close(num(&v, k), 1.0, 1e-12, "{k} = 1（首达年恒 1）");
    }
    assert_close(num(&v, "sustainedProbability"), 0.0, 1e-12, "21.8% 支取率第 7 支取年确定性耗尽");
}

/// T4-b（新增 `accumulation_sustained_at_most_fi`，修订轮 F8 增 / 修订轮二 R8 定型）：
/// 真 σ「达标后遭遇负收益序列」压力口径——月支出 12,000 → 达标时首年支取率
/// ≈ 144,000 ÷ 1,635,200 ≈ 8.8% 名义 ≫ r 均值 4.5%，真实波动 σ = 12% 下负收益序列
/// 与高支取率叠加，使大量达标路径在 N = 10 内耗尽（crash-after-FI 机制真实驱动）。
/// 真 σ 下正态样本无界、无法构造与实现无关的必然耗尽/必然存续数值锚点，故断言取
/// 逻辑必然关系式：sustainedProbability 的分子（达标且存续路径数）是 fiProbability
/// 分子（达标路径数）的子集——「未达标路径一律不计存续」，与 seed/实现输出无关。
#[test]
fn accumulation_sustained_at_most_fi() {
    let base = acc_input(500000.0, 20000.0, 12000.0, 1635200.0, 4.5, 12.0, 2.0, 1.0, 40.0, 200.0, 42);
    let v = jv(&simulate_accumulation(&acc_input_s(base, 10)));
    assert_eq!(txt(&v, "error"), "");
    let fi = num(&v, "fiProbability");
    let sus = num(&v, "sustainedProbability");
    assert!((0.0..=1.0).contains(&fi), "fi ∈ [0,1]：{fi}");
    assert!((0.0..=1.0).contains(&sus), "sustained ∈ [0,1]：{sus}");
    assert!(sus <= fi, "存续数 ≤ 达成数（子集关系，逻辑必然）：{sus} ≤ {fi}");
}

/// T5（新增 `accumulation_sustained_horizon_30_vs_40`）：
/// 独立推导（node 复算 + 闭式）：t = 0 达标（1,000,000 ≥ 500,000）→ fi = 1.0、
/// A* = 1,000,000、cumInfl* = 1；支取自 A₀ = 1,000,000、年支 60,000、r = 5%：
/// 闭式 A_k = 1,200,000 − 200,000×1.05^k；A₃₆ = +41,636.77 > 0、A₃₇ = −16,281.39 ≤ 0
/// → 第 37 个支取年耗尽 → N = 30 全存续（A₃₀ = 335,611.52）、N = 40 全不存续。
#[test]
fn accumulation_sustained_horizon_30_vs_40() {
    let base = acc_input(1000000.0, 5000.0, 5000.0, 500000.0, 5.0, 1e-9, 0.0, 1e-9, 1.0, 20.0, 3);
    let v30 = jv(&simulate_accumulation(&acc_input_s(base.clone(), 30)));
    assert_eq!(txt(&v30, "error"), "");
    assert_close(num(&v30, "fiProbability"), 1.0, 1e-12, "t=0 即达标");
    assert_close(num(&v30, "sustainedProbability"), 1.0, 1e-12, "第 37 支取年才耗尽 → 30 年全存续");
    let v40 = jv(&simulate_accumulation(&acc_input_s(base, 40)));
    assert_eq!(txt(&v40, "error"), "");
    assert_close(num(&v40, "fiProbability"), 1.0, 1e-12, "fi 与 N 无关");
    assert_close(num(&v40, "sustainedProbability"), 0.0, 1e-12, "40 > 37 → 全不存续");
}

/// T8 新增不变量（新增 `accumulation_sustained_invariant_same_seed`，修订轮二 R1 的
/// 锁定测试）：同输入同 seed，sustainYears > 0 时既有输出字段（fiProbability /
/// 年限分位 / 期末分位 / samplePaths / neverReachedShare）与 sustainYears = 0 逐字节
/// 一致——两段式独立派生流拓扑下 pass1 与 N 无条件解耦。输入必须真实量级 σ
/// （r 4.5±12% / i 2±1% / 40 年 / 200 路径 / seed 42）：若实施为逐路径交错拓扑
/// （支取样本插入两路径之间），路径 ≥1 的积累样本整体后移、真实 σ 下统计必然漂移，
/// 本测试即失败——σ = 1e-9 退化输入下交错拓扑也平凡通过，不可作锁定测试。
#[test]
fn accumulation_sustained_invariant_same_seed() {
    let off = jv(&simulate_accumulation(&acc_input(
        500000.0, 8000.0, 2990.0, 1635200.0, 4.5, 12.0, 2.0, 1.0, 40.0, 200.0, 42,
    )));
    let on = jv(&simulate_accumulation(&acc_input_s(
        acc_input(500000.0, 8000.0, 2990.0, 1635200.0, 4.5, 12.0, 2.0, 1.0, 40.0, 200.0, 42),
        10,
    )));
    assert_eq!(txt(&off, "error"), "");
    assert_eq!(txt(&on, "error"), "");
    // 非 0 哨兵 sanity：sustainYears = 10 下 sustainedProbability 必须被真实度量
    // （0.0 合法——该输入支取率 35,880×cumInfl*/A* 极低，存续率高；此处仅断言字段
    // 参与比较前的哨兵语义区分：=0 运行恒 0.0）
    assert_close(num(&off, "sustainedProbability"), 0.0, 0.0, "sustainYears = 0 → 哨兵 0.0");
    // 既有字段逐字节一致：除 sustainedProbability 外整对象深相等（删除哨兵键后比较）
    let mut a = off.clone();
    let mut b = on.clone();
    assert!(a.as_object_mut().unwrap().remove("sustainedProbability").is_some());
    assert!(b.as_object_mut().unwrap().remove("sustainedProbability").is_some());
    assert_eq!(a, b, "sustainYears > 0 不得扰动任何既有字段（R1 拓扑锁定）");
    // 真 σ 下 fi 非平凡（0 < fi < 1 的通道概率极高且非本测试断言对象——保留
    // fiProbability 自身既有回归，不在此处锁数值）
}

/// T10（新增 `accumulation_sustained_survive_realistic`）：
/// 独立推导（node 复算）：t = 0 达标（2,000,000 ≥ 1,635,200）→ fi = 1.0、
/// yearsMedian = 0（integration.rs:858 同型先例）；首年支取率 = 35,880×1.02
/// ÷ 2,000,000 = 1.83% 名义 ≪ 4.5% 名义回报（spend₁ = 36,597.60 < 年度回报 90,000）
/// → 资产单调增长；30 年末 ≈ 4,659,509.54、全程最低 2,053,402.40 > 0 → 全存续。
#[test]
fn accumulation_sustained_survive_realistic() {
    let base = acc_input(2000000.0, 8000.0, 2990.0, 1635200.0, 4.5, 1e-9, 2.0, 1e-9, 5.0, 20.0, 5);
    let v = jv(&simulate_accumulation(&acc_input_s(base, 30)));
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "fiProbability"), 1.0, 1e-12, "t=0 即达标");
    assert_close(num(&v, "yearsMedian"), 0.0, 1e-12, "首达年限 0");
    assert_close(num(&v, "sustainedProbability"), 1.0, 1e-12, "1.83% 支取率 30 年全存续");
}

// ---------------------------------------------------------------------------
// 11. estimate_pension
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
fn pension_input(
    wage: f64, idx: f64, years: f64, balance: f64, months: f64,
    expense: f64, children: f64, cost: f64, health: f64, major: f64,
    nominal: f64, inflation: f64, current_age: f64, retire_age: f64,
) -> String {
    pension_input_t(None, wage, idx, years, balance, months, expense, children, cost, health, major, nominal, inflation, current_age, retire_age)
}

/// 带 targetRetireAge（P7/P0-1）的构造器：target = None 时省略键（serde 缺省路径），
/// Some(v) 时携带该键；其余字段与 pension_input 逐字一致。
#[allow(clippy::too_many_arguments)]
fn pension_input_t(
    target: Option<f64>,
    wage: f64, idx: f64, years: f64, balance: f64, months: f64,
    expense: f64, children: f64, cost: f64, health: f64, major: f64,
    nominal: f64, inflation: f64, current_age: f64, retire_age: f64,
) -> String {
    let target_field = match target {
        Some(t) => format!(r#""targetRetireAge":{t},"#),
        None => String::new(),
    };
    format!(
        r#"{{"monthlyExpense":{expense},"childCount":{children},"costPerChild":{cost},"healthReserve":{health},"majorInvestment":{major},"nominalReturnPct":{nominal},"inflationPct":{inflation},"currentAge":{current_age},"retireAge":{retire_age},{target_field}"contribYears":{years},"contribIndex":{idx},"accountBalance":{balance},"avgMonthlyWage":{wage},"monthsDivisor":{months}}}"#
    )
}

#[test]
fn pension_known_values_default_caliber() {
    // 锚点见本节 P-A（docs/p1-spec.md §7 表）
    let out = estimate_pension(&pension_input(
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 60.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "yearsToRetire"), 30.0, "距退休年限");
    assert_close(num(&v, "basicPensionMonthly"), 2_482.32, 1e-9, "基础养老金");
    assert_close(num(&v, "accountPensionMonthly"), 359.71, 1e-9, "个人账户养老金");
    assert_close(num(&v, "pensionMonthly"), 2_842.03, 1e-9, "预计月养老金");
    assert_close(num(&v, "coverageRatio"), 0.95, 1e-9, "覆盖率两位小数");
    assert_close(num(&v, "adjustedMonthlyExpense"), 147.97, 1e-9, "调整后月开销");
    assert_close(num(&v, "multiplier"), 480.0, 1e-12, "乘数与 baseline 同口径");
    assert_close(num(&v, "adjustedCriticalValue"), 271_025.60, 1e-6, "调整后参考线");
    // P7/T2 缺省分支：输入不携带 targetRetireAge（serde Option 缺省 None）→
    // bridgeYears = 0、bridgeFundingNeeded = 0（现状口径零漂移，P-A 锚点视图不变）
    assert_eq!(num(&v, "bridgeYears"), 0.0, "缺省 targetRetireAge → 桥接 0 年");
    assert_eq!(num(&v, "bridgeFundingNeeded"), 0.0, "缺省 targetRetireAge → 桥接备资 0");
    // 养老金乘数恒 480 教学口径：pension 不在本轮加费雪精确字段（p7-spec §3.7 末行）
    assert!(v.get("multiplierExact").is_none(), "pension 输出无精确乘数字段");
}

#[test]
fn pension_adjusted_critical_matches_baseline() {
    // 恒等式：adjustedCriticalValue == calculate_baseline(monthlyExpense = adjustedMonthlyExpense)
    let out = estimate_pension(&pension_input(
        10343.0, 1.0, 35.0, 120000.0, 139.0, 8000.0, 1.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 65.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    let adjusted = num(&v, "adjustedMonthlyExpense");
    let adjusted_critical = num(&v, "adjustedCriticalValue");
    assert_close(adjusted, 3_516.64, 1e-9, "调整后月开销（P-B）");
    assert_close(adjusted_critical, 2_467_987.20, 1e-6, "调整后参考线（P-B）");

    let base = calculate_baseline(&format!(
        r#"{{"monthlyExpense":{adjusted},"childCount":1,"costPerChild":580000,"healthReserve":200000,"majorInvestment":0,"nominalReturnPct":4.5,"inflationPct":2.0}}"#
    ));
    let bv = jv(&base);
    assert_eq!(txt(&bv, "error"), "");
    assert_close(
        num(&bv, "criticalValue"),
        adjusted_critical,
        1e-6,
        "两函数在相同乘数与附加项下必须逐值一致",
    );
}

#[test]
fn pension_coverage_above_one_not_capped() {
    // 锚点 P-C：覆盖率 2.79 不封顶；调整后月开销钳 0；参考线只剩附加预留
    let out = estimate_pension(&pension_input(
        10343.0, 1.0, 40.0, 200000.0, 139.0, 2000.0, 0.0, 580000.0, 100000.0, 0.0,
        4.5, 2.0, 30.0, 70.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "pensionMonthly"), 5_576.05, 1e-9, "预计月养老金");
    assert_close(num(&v, "coverageRatio"), 2.79, 1e-9, "覆盖率不封顶");
    assert_eq!(num(&v, "adjustedMonthlyExpense"), 0.0, "月开销 < 养老金 → 钳 0");
    assert_close(num(&v, "adjustedCriticalValue"), 100_000.00, 1e-9, "仅剩健康预留");
}

#[test]
fn pension_error_when_real_return_not_positive() {
    // T3（P7）：同 T1 输入但 nominal 2.0 / inflation 4.5 + targetRetireAge 30 →
    // 业务错误分支：yearsToRetire 30、bridgeYears 30 保留（时间字段照回显先例），
    // bridgeFundingNeeded 0（依赖乘数），金额/乘数全 0
    let out = estimate_pension(&pension_input_t(
        Some(30.0),
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        2.0, 4.5, 30.0, 60.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "通胀率需低于名义回报率");
    assert_eq!(num(&v, "multiplier"), 0.0);
    assert_eq!(num(&v, "pensionMonthly"), 0.0);
    assert_eq!(num(&v, "adjustedCriticalValue"), 0.0);
    // 独立推导（docs/p7-spec.md §3.3）：real = 2.0 − 4.5 = −2.5 ≤ 0 → 错误分支；
    // bridgeYears 与金额无关（时间字段）→ 按回显先例保留计算值 60 − max(30, 30) = 30
    assert_eq!(num(&v, "yearsToRetire"), 30.0, "yearsToRetire 回显");
    assert_eq!(num(&v, "bridgeYears"), 30.0, "bridgeYears 时间字段保留（回显先例）");
    assert_eq!(num(&v, "bridgeFundingNeeded"), 0.0, "业务错误分支桥接备资 = 0");
}

#[test]
fn pension_validation_errors() {
    for (input, keyword) in [
        // 退休年龄 ≤ 当前年龄
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 60.0, 60.0), "退休年龄"),
        // 计发月数 0
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 0.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "计发月数"),
        // 缴费基数指数越界
        (pension_input(10343.0, 12.0, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "缴费基数指数"),
        // 账户余额为负
        (pension_input(10343.0, 0.6, 30.0, -1.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "个人账户余额估计"),
        // 缴费年限越界
        (pension_input(10343.0, 0.6, 51.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "缴费年限"),
        // 当前年龄越界
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 15.0, 60.0), "当前年龄"),
        // 月开销为负
        (pension_input(10343.0, 0.6, 30.0, 50000.0, 139.0, -100.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "月开销"),
        // P7/P0-1：targetRetireAge 越界（< 16 / > 75 / 非整数）→「停止工作年龄」
        (pension_input_t(Some(15.0), 10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "停止工作年龄"),
        (pension_input_t(Some(76.0), 10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "停止工作年龄"),
        (pension_input_t(Some(30.5), 10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0, 4.5, 2.0, 30.0, 60.0), "停止工作年龄"),
    ] {
        let v = jv(&estimate_pension(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(num(&v, "pensionMonthly"), 0.0, "错误安全值");
    }
}

// P7/P0-1 桥接期（T1/T2，docs/p7-spec.md §3.1/§3.2；期望值独立推导 + node 复算）
#[test]
fn pension_bridge_period_fields() {
    // —— T1 提前退休桥接 ——
    // 输入 = README.md:86 面板 ⑦ 默认 + targetRetireAge 30（推导登记 §3.1）：
    //   乘数 = round2(12 ÷ 0.025) = 480（P-A 锚点视图）；
    //   基础养老金 = round2(10343×1.6÷2×30÷100) = 2,482.32；
    //   个人账户 = round2(50000÷139) = 359.71；月养老金 = 2,842.03；
    //   覆盖率 = round2(2842.03÷2990) = 0.95；调整后月开销 = 2990 − 2842.03 = 147.97；
    //   调整后参考线 = 147.97×480 + 200000 = 271,025.60（P-A 锚点零漂移）；
    //   bridgeYears = 60 − max(30, 30) = 30；
    //   bridgeFundingNeeded = round2(2990×480) = 1,435,200.00（纯生活费口径——
    //   附加项单次计入段 2，修订轮二 R5 归属裁定）；
    //   两段相加 = 1,435,200.00 + 271,025.60 = 1,706,225.60 = 停工后真实总需
    //   （健康预留 200,000 单次计入段 2；锁定断言 = bridgeFundingNeeded ==
    //   round2(monthlyExpense × multiplier)，同一 pension 输出乘数）
    let out = estimate_pension(&pension_input_t(
        Some(30.0),
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 60.0,
    ));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    // 金额/覆盖率锚点（P-A）零漂移：养老金金额与停工年龄解耦
    assert_eq!(num(&v, "yearsToRetire"), 30.0, "yearsToRetire");
    assert_close(num(&v, "basicPensionMonthly"), 2_482.32, 1e-9, "基础养老金（P-A）");
    assert_close(num(&v, "accountPensionMonthly"), 359.71, 1e-9, "个人账户（P-A）");
    assert_close(num(&v, "pensionMonthly"), 2_842.03, 1e-9, "月养老金（P-A）");
    assert_close(num(&v, "coverageRatio"), 0.95, 1e-9, "覆盖率（P-A）");
    assert_close(num(&v, "adjustedMonthlyExpense"), 147.97, 1e-9, "调整后月开销（P-A）");
    assert_close(num(&v, "adjustedCriticalValue"), 271_025.60, 1e-6, "调整后参考线（P-A，段 2）");
    assert_close(num(&v, "multiplier"), 480.0, 1e-12, "乘数（P-A）");
    // 桥接两字段（时间口径）
    assert_eq!(num(&v, "bridgeYears"), 30.0, "桥接年数 = 60 − max(30, 30)");
    assert_close(
        num(&v, "bridgeFundingNeeded"),
        1_435_200.00,
        1e-6,
        "桥接备资 = round2(2990×480)，纯生活费口径（附加项归段 2）",
    );
    // 锁定断言：bridgeFundingNeeded == round2(monthlyExpense × multiplier)（§2.1 新恒等式）
    let m = num(&v, "multiplier"); // 输出乘数即 480.0
    let expect = ((2990.0 * m * 100.0).round()) / 100.0; // round2 半分远离零（正数域等价）
    assert_close(num(&v, "bridgeFundingNeeded"), expect, 1e-6, "恒等式 round2(expense×multiplier)");
    // 两段相加 = 真实总需（R5：附加项单次计入）
    let total = num(&v, "bridgeFundingNeeded") + num(&v, "adjustedCriticalValue");
    assert_close(total, 1_706_225.60, 1e-6, "段 1 + 段 2 = 停工后真实总需");

    // —— T2 无桥接（同输入只改 targetRetireAge 60）——
    // 独立推导：停工年龄 ≥ 起领年龄 → 桥接期不存在；验收锚点 ①：只改 targetRetireAge
    // 30 → 60 时，六字段（basic/account/pensionMonthly/coverage/adjusted/adjustedCritical）
    // 逐字节不变（养老金金额与停工年龄解耦）
    let out2 = estimate_pension(&pension_input_t(
        Some(60.0),
        10343.0, 0.6, 30.0, 50000.0, 139.0, 2990.0, 0.0, 580000.0, 200000.0, 0.0,
        4.5, 2.0, 30.0, 60.0,
    ));
    let v2 = jv(&out2);
    assert_eq!(txt(&v2, "error"), "");
    assert_eq!(num(&v2, "bridgeYears"), 0.0, "target ≥ retire → 桥接 0 年");
    assert_eq!(num(&v2, "bridgeFundingNeeded"), 0.0, "无桥接 → 备资 0");
    for k in [
        "yearsToRetire",
        "basicPensionMonthly",
        "accountPensionMonthly",
        "pensionMonthly",
        "coverageRatio",
        "adjustedMonthlyExpense",
        "adjustedCriticalValue",
        "multiplier",
    ] {
        assert_eq!(num(&v, k), num(&v2, k), "只改 targetRetireAge → {k} 不变（解耦验收①）");
    }
}

// ---------------------------------------------------------------------------
// 12. run_monte_carlo_bootstrap
// ---------------------------------------------------------------------------

fn boot_input(seed: u64, mean_i: f64, std_i: f64, years: f64, paths: f64, series: &[f64]) -> String {
    // nominalReturnMeanPct/nominalReturnStdPct 合法但被忽略（bootstrap 模式仅校验不参与）
    let series_json = series
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(",");
    format!(
        r#"{{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":{mean_i},"inflationStdPct":{std_i},"years":{years},"paths":{paths},"seed":{seed},"series":[{series_json}]}}"#
    )
}

#[test]
fn bootstrap_same_seed_is_deterministic() {
    let inp = boot_input(42, 2.0, 1.0, 30.0, 200.0, &[14.68, -65.95, 121.02, 5.58]);
    let a = run_monte_carlo_bootstrap(&inp);
    let b = run_monte_carlo_bootstrap(&inp);
    assert_eq!(a, b, "同 seed 同输入必须逐字节一致");

    let c = run_monte_carlo_bootstrap(&boot_input(43, 2.0, 1.0, 30.0, 200.0, &[14.68, -65.95, 121.02, 5.58]));
    assert_ne!(a, c, "不同 seed 输出应不同");

    let v = jv(&a);
    assert_eq!(txt(&v, "error"), "");
    let depletion = num(&v, "depletionProb");
    assert!((0.0..=1.0).contains(&depletion), "耗尽概率须在 [0,1]：{depletion}");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50, "固定抽取 50 条");
    for path in paths {
        assert_eq!(path.as_array().unwrap().len(), 30, "每条长度 = years");
    }
}

#[test]
fn bootstrap_single_element_matches_nominal_closed_form() {
    // 锚点 B-D：单元素序列 [5] → 每年回报恒 5%，与既有名义口径闭式解同式
    // （A_20 = 668,802.18，同 monte_carlo_nominal_recurrence_known_value 的口径与容差）
    let out = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1e-9, 20.0, 20.0, &[5.0]));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "depletionProb"), 0.0, "该参数下不应耗尽");
    let expected = 668_802.18;
    for k in ["medianTerminal", "p5", "p25", "p75", "p95"] {
        let x = num(&v, k);
        assert!(
            (x - expected).abs() < 0.05,
            "{k} 应为名义口径闭式解 {expected}（实际 {x}）"
        );
    }
}

#[test]
fn bootstrap_zero_return_series_with_inflation_depletes() {
    // 锚点 B-E：回报恒 0、通胀 2% 精确上行 → 第 17 年耗尽；
    // 通胀路径必须来自正态机制（σ=1e-9 近似确定），序列元素只供回报
    let out = run_monte_carlo_bootstrap(&boot_input(9, 2.0, 1e-9, 20.0, 20.0, &[0.0]));
    let v = jv(&out);
    assert_eq!(txt(&v, "error"), "");
    assert_close(num(&v, "depletionProb"), 1.0, 1e-12, "回报 0 + 支出通胀上行 → 全部耗尽");
    assert_eq!(num(&v, "medianTerminal"), 0.0, "耗尽路径期末为 0");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    let p0 = paths[0].as_array().unwrap();
    assert!(p0[15].as_f64().unwrap() > 0.0, "第 16 年末仍为正（实际 {}）", p0[15]);
    assert_eq!(p0[16].as_f64().unwrap(), 0.0, "第 17 年末耗尽记 0");
    for k in ["p5", "p25", "p75", "p95"] {
        assert_eq!(num(&v, k), 0.0, "{k} 全部耗尽为 0");
    }
}

#[test]
fn bootstrap_different_series_differ() {
    let a = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1.0, 30.0, 100.0, &[8.0]));
    let b = run_monte_carlo_bootstrap(&boot_input(7, 2.0, 1.0, 30.0, 100.0, &[-3.0]));
    assert_ne!(a, b, "不同序列（同 seed）输出应不同");
}

#[test]
fn bootstrap_validation_errors() {
    for (input, keyword) in [
        // 空序列
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[]), "收益序列"),
        // 元素 ≤ −100（回报率不得低于 −100%）
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[-100.0]), "收益序列元素"),
        // 元素超出百分点上限
        (boot_input(1, 2.0, 1.0, 30.0, 10.0, &[1001.0]), "1000"),
        // 通胀 σ ≤ 0（沿用既有校验语义）
        (boot_input(1, 2.0, 0.0, 30.0, 10.0, &[5.0]), "标准差"),
        // 模拟年数 0
        (boot_input(1, 2.0, 1.0, 0.0, 10.0, &[5.0]), "模拟年数"),
    ] {
        let v = jv(&run_monte_carlo_bootstrap(&input));
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{input}");
        assert!(err.contains(keyword), "错误信息应含「{keyword}」：{err}");
        assert!(v.get("samplePaths").unwrap().as_array().unwrap().is_empty(), "错误安全值：路径为空");
    }
}

// ---------------------------------------------------------------------------
// 13. P2/F1 支取策略（run_monte_carlo / run_monte_carlo_bootstrap 的 strategy 层）
// ---------------------------------------------------------------------------

/// P1 默认参数（src/data/defaults.ts MONTE_CARLO_DEFAULTS）的输入 JSON
fn mc_default_input(strategy_suffix: &str) -> String {
    format!(
        r#"{{"currentAssets":500000,"annualSpend":35880,"nominalReturnMeanPct":4.5,"nominalReturnStdPct":12,"inflationMeanPct":2,"inflationStdPct":1,"years":30,"paths":5000,"seed":42{strategy_suffix}}}"#
    )
}

/// 阈值带默认参数（研究最优解 ±20% / ±10% / 末段 15 年 / 冻结开）
const THRESHOLD_DEFAULTS: &str =
    r#","threshold":{"exceedPct":20,"cutPct":10,"fallPct":20,"raisePct":10,"noCutLastYears":15,"freezeOnLoss":true}"#;
/// 余额比例默认参数（实际回报假设 2.5%、地板关、上限关）
const PERCENT_DEFAULTS: &str =
    r#","percent":{"realReturnAssumpPct":2.5,"floorPctOfLastYear":0,"capPctOfInitialReal":0}"#;

#[test]
fn mc_strategy_absent_is_byte_compatible() {
    // 可复现性铁律（bridge.ts §1）：strategy 缺省 + P1 默认参数 + seed 42 的输出与
    // P1 现状逐字段一致。基线值在 P2 改动前的未改动实现上捕获登记（捕获命令：
    // cargo test --test p2_capture_tmp -- --nocapture，临时文件不入库）。
    let v = jv(&run_monte_carlo(&mc_default_input("")));
    assert_eq!(txt(&v, "error"), "");
    assert_eq!(num(&v, "depletionProb"), 0.9444, "P1 基线耗尽概率");
    assert_eq!(num(&v, "medianTerminal"), 0.0, "P1 基线中位终值");
    assert_eq!(num(&v, "p5"), 0.0, "P1 基线 p5");
    assert_eq!(num(&v, "p25"), 0.0, "P1 基线 p25");
    assert_eq!(num(&v, "p75"), 0.0, "P1 基线 p75");
    assert_eq!(num(&v, "p95"), 64_936.61, "P1 基线 p95");

    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    assert_eq!(paths.len(), 50);
    let flat_sum: f64 = paths
        .iter()
        .flat_map(|p| p.as_array().unwrap().iter())
        .map(|x| x.as_f64().unwrap())
        .sum();
    assert!(
        (flat_sum - 283_869_122.52).abs() <= 0.5,
        "P1 基线全部样本值合计（实际 {flat_sum}）"
    );
    // 首条与末条路径逐字节一致（抽样流任何变动都会位移首条路径）
    let path0: Vec<f64> = paths[0].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
    let path0_expect = [
        490020.38, 490215.78, 435240.65, 425673.95, 338791.78, 388391.56, 346346.2, 321704.66,
        256050.42, 203039.74, 187013.47, 151982.07, 104046.01, 70414.73, 26417.38, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    ];
    assert_eq!(path0.as_slice(), &path0_expect[..], "P1 基线首条路径");
    let path49: Vec<f64> = paths[49].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
    let path49_expect = [
        524322.26, 568505.3, 528252.02, 577129.35, 576769.88, 577689.64, 562820.53, 450540.01,
        473910.67, 494379.95, 537683.22, 579432.28, 423773.73, 404075.18, 387492.28, 326698.24,
        317149.78, 272272.5, 291995.58, 275292.49, 291520.76, 293176.24, 237974.06, 194083.71,
        132347.43, 73496.18, 32098.32, 0.0, 0.0, 0.0,
    ];
    assert_eq!(path49.as_slice(), &path49_expect[..], "P1 基线末条路径");

    // fixed 策略显式传参与缺省同样逐字节一致（同 seed 同输入）
    let fixed = run_monte_carlo(&mc_default_input(r#","strategy":"fixed""#));
    assert_eq!(
        run_monte_carlo(&mc_default_input("")),
        fixed,
        "缺省 strategy 与显式 fixed 输出逐字节一致"
    );
}

#[test]
fn mc_fixed_strategy_params_ignored() {
    // 可复现性铁律配套：strategy 缺省但挂载完整 threshold / percent 参数对象 →
    // 与 strategy: "fixed"（挂载同样对象）同 seed 同输入输出逐字节一致
    // （缺省策略不消费新参数、不消耗额外随机流）。
    let mounted = format!("{THRESHOLD_DEFAULTS}{PERCENT_DEFAULTS}");
    let absent = run_monte_carlo(&mc_default_input(&mounted));
    let explicit = run_monte_carlo(&mc_default_input(&format!(
        r#","strategy":"fixed"{THRESHOLD_DEFAULTS}{PERCENT_DEFAULTS}"#
    )));
    assert_eq!(absent, explicit, "缺省策略不消费挂载参数（全 JSON 逐字节一致）");

    // 且与不挂载参数的 fixed 一致（挂载本身零影响）
    let bare = run_monte_carlo(&mc_default_input(r#","strategy":"fixed""#));
    assert_eq!(absent, bare, "挂载未消费参数不改变输出");
}

#[test]
fn mc_threshold_directional() {
    // 聚合统计断言（明示统计性质）：seeds {1..20} × P1 默认参数 × 5,000 路径，
    // 聚合耗尽路径总数 Σdepleted(threshold) ≤ Σdepleted(fixed)（文献结论是统计成功率
    // 提升，非逐 seed 恒等式，故不得写逐 seed 单调断言）。
    // depletionProb 输出 6 位小数；count/5000 至多 4 位小数 → round6 精确保真，
    // prob × 5000 还原为精确整数计数。
    let mut sum_fixed = 0_u64;
    let mut sum_threshold = 0_u64;
    for seed in 1..=20_u64 {
        let base = format!(
            r#"{{"currentAssets":500000,"annualSpend":35880,"nominalReturnMeanPct":4.5,"nominalReturnStdPct":12,"inflationMeanPct":2,"inflationStdPct":1,"years":30,"paths":5000,"seed":{seed}}}"#
        );
        let fixed = jv(&run_monte_carlo(&base));
        let thr = jv(&run_monte_carlo(&format!(
            r#"{{"currentAssets":500000,"annualSpend":35880,"nominalReturnMeanPct":4.5,"nominalReturnStdPct":12,"inflationMeanPct":2,"inflationStdPct":1,"years":30,"paths":5000,"seed":{seed},"strategy":"threshold"{THRESHOLD_DEFAULTS}}}"#
        )));
        assert_eq!(txt(&fixed, "error"), "");
        assert_eq!(txt(&thr, "error"), "");
        sum_fixed += (num(&fixed, "depletionProb") * 5000.0).round() as u64;
        sum_threshold += (num(&thr, "depletionProb") * 5000.0).round() as u64;
    }
    eprintln!(
        "P2 聚合观测（100,000 路径）：fixed 耗尽 {sum_fixed}，threshold 耗尽 {sum_threshold}"
    );
    assert!(
        sum_threshold <= sum_fixed,
        "聚合耗尽路径总数 threshold（{sum_threshold}）≤ fixed（{sum_fixed}）"
    );

    // 确定性校验分支（与统计断言分离）：threshold 缺参 → error
    let missing = jv(&run_monte_carlo(&mc_default_input(r#","strategy":"threshold""#)));
    assert!(
        txt(&missing, "error").contains("threshold"),
        "threshold 缺参：{}",
        txt(&missing, "error")
    );
    // currentAssets = 0 → wr0 无法定义 → 专属错误文案
    let zero_assets = jv(&run_monte_carlo(&format!(
        r#"{{"currentAssets":0,"annualSpend":35880,"nominalReturnMeanPct":4.5,"nominalReturnStdPct":12,"inflationMeanPct":2,"inflationStdPct":1,"years":30,"paths":10,"seed":1,"strategy":"threshold"{THRESHOLD_DEFAULTS}}}"#
    )));
    assert!(
        txt(&zero_assets, "error").contains("阈值带策略要求当前资产与年支出均大于 0"),
        "资产 0：{}",
        txt(&zero_assets, "error")
    );
    // 枚举外 → error
    let bad_enum = jv(&run_monte_carlo(&mc_default_input(r#","strategy":"other""#)));
    assert!(
        // P7/P0-3 正名：错误文案四枚举化（fixed / inflation_uplift / threshold / percent）；
        // 文案变更随枚举别名落地（修订登记：上版「该文案无测试断言」实测有此子串断言，
        // 期望随文案更新——见 mc_fixed_semantics_after_rename 推导注）
        txt(&bad_enum, "error")
            .contains("fixed / inflation_uplift / threshold / percent"),
        "枚举外：{}",
        txt(&bad_enum, "error")
    );
}

#[test]
fn mc_percent_never_depletes() {
    // 构造性不破产（bridge.ts §2.2：可用资产钳制恒启用 → 纯比例型破产概率恒 0）。
    // 单元素序列 [-90]（每年回报恒 −90%，未触 −0.99 钳制）、通胀 σ = 1e-9 ≈ 0、
    // r_assump = −90（与实际回报恒同）：摊还年金化与真实衰减完全同步，第 1..29 年
    // 支取额 ≈ 0、资产恒 > 0；终点年（第 30 年）n = 1、摊还 = R × 0.1 恰等于可用资产
    // → 资产钳至 0 —— 终点年不计耗尽（depletionProb == 0，同时锁定「耗尽判定窗口为
    // 第 1..years−1 年末」的 percent 特例）。
    for seed in 1..=5_u64 {
        let v = jv(&run_monte_carlo_bootstrap(&format!(
            r#"{{"currentAssets":1000000,"annualSpend":40000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":0,"inflationStdPct":1e-9,"years":30,"paths":50,"seed":{seed},"series":[-90.0],"strategy":"percent","percent":{{"realReturnAssumpPct":-90,"floorPctOfLastYear":0,"capPctOfInitialReal":0}}}}"#
        )));
        assert_eq!(txt(&v, "error"), "");
        assert_eq!(
            num(&v, "depletionProb"),
            0.0,
            "seed {seed}：floor=0 构造性不破产（含终点年归零不计耗尽）"
        );
        for k in ["medianTerminal", "p5", "p25", "p75", "p95"] {
            assert!(num(&v, k) >= 0.0, "seed {seed}：{k} ≥ 0");
        }
    }

    // floor = 95 构造垫高输入：地板垫高早期支取 → 中途耗尽重新出现（研究口径一致）。
    // 推演（通胀 ≈ 0、r_assump = 0 → 摊还 = R ÷ n）：第 1 年摊还 33,333，资产余 66,667；
    // 第 2 年摊还 66,667/29 ≈ 2,299 但地板 = 0.95×33,333 ≈ 31,667 > 可用
    // 66,667×0.1 = 6,667 → 支出钳至 6,667 → 资产恰为 0（第 2 年 < 30）→ 判耗尽。
    let v = jv(&run_monte_carlo_bootstrap(
        r#"{"currentAssets":1000000,"annualSpend":40000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":0,"inflationStdPct":1e-9,"years":30,"paths":50,"seed":7,"series":[-90.0],"strategy":"percent","percent":{"realReturnAssumpPct":0,"floorPctOfLastYear":95,"capPctOfInitialReal":0}}"#,
    ));
    assert_eq!(txt(&v, "error"), "");
    assert!(
        num(&v, "depletionProb") > 0.0,
        "floor=95 垫高 → 出现耗尽路径（实际 {}）",
        num(&v, "depletionProb")
    );
}

#[test]
fn mc_withdrawal_output_shape() {
    // 形状与口径：sampleWithdrawalPaths 恒 50 条、长度 = years、与 samplePaths 索引对齐；
    // 耗尽路径支取记 0；withdrawalP5 ≤ withdrawalMedian ≤ withdrawalP95；
    // fixed 策略下 sampleWithdrawalPaths[i][t] == round2(annualSpend × cum_infl_t)
    // （通胀 σ = 1e-9 → cum_infl_t ≈ (1+均值)^t，容差 0.05 覆盖两位小数舍入）。
    let depleting = jv(&run_monte_carlo(&mc_input(1, 2.0, 15.0, 5.0, 8.0, 30.0, 300.0)));
    assert_eq!(txt(&depleting, "error"), "");
    let assets_rows = depleting.get("samplePaths").unwrap().as_array().unwrap();
    let wd_rows = depleting
        .get("sampleWithdrawalPaths")
        .unwrap()
        .as_array()
        .unwrap();
    assert_eq!(assets_rows.len(), 50);
    assert_eq!(wd_rows.len(), 50, "sampleWithdrawalPaths 恒 50 条");
    let mut saw_depleted = false;
    for (a, w) in assets_rows.iter().zip(wd_rows.iter()) {
        let a = a.as_array().unwrap();
        let w = w.as_array().unwrap();
        assert_eq!(a.len(), 30, "与 samplePaths 同 years 长度");
        assert_eq!(w.len(), 30);
        // 耗尽年 = 资产路径首个 0；当年及以后支取记 0，此前支取恒正
        let dep = a.iter().position(|x| x.as_f64().unwrap() == 0.0);
        if let Some(t) = dep {
            saw_depleted = true;
            for (j, x) in w.iter().enumerate() {
                let v = x.as_f64().unwrap();
                if j >= t {
                    assert_eq!(v, 0.0, "耗尽当年及以后支取记 0：索引 {t} 之后的 {j}");
                } else {
                    assert!(v > 0.0, "耗尽前支取恒正：{v}");
                }
            }
        }
    }
    assert!(saw_depleted, "该参数下样本中应存在耗尽路径");
    let (wp5, wmed, wp95) = (
        num(&depleting, "withdrawalP5"),
        num(&depleting, "withdrawalMedian"),
        num(&depleting, "withdrawalP95"),
    );
    assert!(wp5 <= wmed && wmed <= wp95, "末年支取额分位单调：{wp5},{wmed},{wp95}");

    // fixed 策略 cum_infl 口径：通胀 σ = 1e-9 → 支取额 ≈ annualSpend × (1+0.02)^t
    let steady = jv(&run_monte_carlo(&mc_input(3, 5.0, 5.0, 2.0, 1e-9, 20.0, 50.0)));
    let wd = steady.get("sampleWithdrawalPaths").unwrap().as_array().unwrap();
    assert_eq!(wd.len(), 50);
    for row in wd {
        for (t, x) in row.as_array().unwrap().iter().enumerate() {
            let expected = 40_000.0 * 1.02f64.powi(t as i32 + 1);
            let got = x.as_f64().unwrap();
            assert!(
                (got - expected).abs() <= 0.05,
                "fixed 支取额 = annualSpend × cum_infl（第 {} 年：{got} vs {expected}）",
                t + 1
            );
        }
    }
}

/// T6（新增 `mc_fixed_semantics_after_rename`，P7/P0-3）：
/// 三次调用（strategy 缺省 / "fixed" / "inflation_uplift"）输出逐字节一致——
/// 解析层把正名与历史别名映射到同一 Strategy::Fixed，数值路径零改动。
/// 独立推导（node 复算，docs/p7-spec.md §3.6）：spend₁ = 50,000×1.02 = 51,000；
/// A₁ = 1,050,000 − 51,000 = 999,000；spend₂ = 52,020；A₂ = 999,000×1.05 − 52,020
/// = 996,930。反面锁定：若语义是「名义恒定支出」（spend 恒 50,000）则
/// A₁ = 1,000,000 ≠ 999,000——首年值即排除该误读（audit 原反例 A₂ = 998,950 系
/// 「首年已上调、次年冻结」的混合口径，登记为推导修正；结论同为 ≠ 断言值）。
#[test]
fn mc_fixed_semantics_after_rename() {
    let base = r#"{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":2,"inflationStdPct":1e-9,"years":2,"paths":1,"seed":11}"#;
    let absent = run_monte_carlo(base);
    let fixed = run_monte_carlo(
        r#"{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":2,"inflationStdPct":1e-9,"years":2,"paths":1,"seed":11,"strategy":"fixed"}"#,
    );
    let uplift = run_monte_carlo(
        r#"{"currentAssets":1000000,"annualSpend":50000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":2,"inflationStdPct":1e-9,"years":2,"paths":1,"seed":11,"strategy":"inflation_uplift"}"#,
    );
    assert_eq!(absent, fixed, "缺省与显式 fixed 逐字节一致");
    assert_eq!(absent, uplift, "正名 inflation_uplift 与 fixed 逐字节一致（别名等价）");

    let v = jv(&absent);
    assert_eq!(txt(&v, "error"), "");
    let paths = v.get("samplePaths").unwrap().as_array().unwrap();
    let row0: Vec<f64> = paths[0].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
    assert_eq!(row0.as_slice(), &[999_000.00, 996_930.00], "通胀上行口径 A₁/A₂ 闭式锁定");
    let wds = v.get("sampleWithdrawalPaths").unwrap().as_array().unwrap();
    let w0: Vec<f64> = wds[0].as_array().unwrap().iter().map(|x| x.as_f64().unwrap()).collect();
    assert_eq!(w0.as_slice(), &[51_000.00, 52_020.00], "spend_t = annualSpend × cum_infl_t");
}

#[test]
fn mc_bootstrap_strategy_shared() {
    // bootstrap 模式与正态模式共用同一策略层（bridge.ts §2.1）：常值序列 [10.0]、
    // currentAssets = 1,000,000、annualSpend = 40,000（wr0 = 4%）、years = 30、seed = 42。
    // 资产按 10% 增长而通胀样本恒 ≈ 2% 方向时，wr_t 随资产增长逐年下移、必然跌破
    // 0.8×wr0 = 3.2% 触发升支（确定性分化推理见 docs/p2-spec.md §9.2），threshold 与
    // fixed 的 sampleWithdrawalPaths 存在差异；percent 下 depletionProb == 0。
    let base = |strategy: &str| {
        format!(
            r#"{{"currentAssets":1000000,"annualSpend":40000,"nominalReturnMeanPct":5,"nominalReturnStdPct":1e-9,"inflationMeanPct":2,"inflationStdPct":1e-9,"years":30,"paths":200,"seed":42,"series":[10.0]{strategy}}}"#
        )
    };
    let fixed = jv(&run_monte_carlo_bootstrap(&base(r#","strategy":"fixed""#)));
    let thr = jv(&run_monte_carlo_bootstrap(&base(&format!(
        r#","strategy":"threshold"{THRESHOLD_DEFAULTS}"#
    ))));
    assert_eq!(txt(&fixed, "error"), "");
    assert_eq!(txt(&thr, "error"), "");
    let fw = fixed.get("sampleWithdrawalPaths").unwrap().as_array().unwrap();
    let tw = thr.get("sampleWithdrawalPaths").unwrap().as_array().unwrap();
    let differs = fw
        .iter()
        .zip(tw.iter())
        .any(|(a, b)| a.as_array().unwrap() != b.as_array().unwrap());
    assert!(differs, "bootstrap 模式下 threshold 与 fixed 支取路径必然分化");

    // percent（floor=0、cap=0）在 bootstrap 模式下同样构造性不破产
    let pct = jv(&run_monte_carlo_bootstrap(&base(&format!(
        r#","strategy":"percent"{PERCENT_DEFAULTS}"#
    ))));
    assert_eq!(txt(&pct, "error"), "");
    assert_eq!(
        num(&pct, "depletionProb"),
        0.0,
        "bootstrap percent：纯比例型破产概率恒 0"
    );
}

// ---------------------------------------------------------------------------
// 14. P2/F2 simulate_sequence —— 序列风险对照（确定性）
// ---------------------------------------------------------------------------

/// 沪深300 年度收益序列（百分点，2005–2024；与 src/data/indexSeries.ts 逐值一致）
const CSI300_SERIES: [f64; 20] = [
    -7.66, 121.02, 161.55, -65.95, 96.71, -12.51, -25.01, 7.55, -7.65, 51.66, 5.58, -11.28,
    21.78, -25.31, 36.07, 27.21, -5.20, -21.63, -11.38, 14.68,
];
/// 标普500 年度总回报序列（百分点，2005–2025；与 src/data/indexSeries.ts 逐值一致）
const SP500_SERIES: [f64; 21] = [
    4.91, 15.79, 5.49, -37.00, 26.46, 15.06, 2.11, 16.00, 32.39, 13.69, 1.38, 11.96, 21.83,
    -4.38, 31.49, 18.40, 28.71, -18.11, 26.29, 25.02, 17.88,
];

fn seq_input(
    series: &[f64],
    years: usize,
    direction: &str,
    assets: f64,
    spend: f64,
    saving: f64,
) -> String {
    let s = series
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(",");
    format!(
        r#"{{"series":[{s}],"years":{years},"direction":"{direction}","currentAssets":{assets},"annualSpend":{spend},"annualSaving":{saving}}}"#
    )
}

fn seq_run(
    series: &[f64],
    direction: &str,
    assets: f64,
    spend: f64,
    saving: f64,
) -> (f64, i64, f64) {
    let v = jv(&simulate_sequence(&seq_input(
        series,
        series.len(),
        direction,
        assets,
        spend,
        saving,
    )));
    assert_eq!(txt(&v, "error"), "");
    (
        num(&v, "terminalAssets"),
        v.get("depletedYear").and_then(|x| x.as_i64()).unwrap(),
        num(&v, "terminalMultiple"),
    )
}

#[test]
fn sequence_reorder_anchors() {
    // §3.3-A 支取期三序对照全表（12 数值；终值 ±1 元 / 耗尽年精确）。
    // 统一口径：assets = 1,000,000、年末固定名义支取 = assets × rate。
    for (name, series, rate, orig, asc, asc_dy, desc) in [
        ("csi300 4%", &CSI300_SERIES[..], 4.0, 2_827_018.44, 0.0, 5, 3_698_652.66),
        ("csi300 5%", &CSI300_SERIES[..], 5.0, 2_550_118.19, 0.0, 5, 3_639_660.97),
        ("sp500 4%", &SP500_SERIES[..], 4.0, 4_689_900.55, 775_249.83, -1, 7_092_097.91),
        ("sp500 5%", &SP500_SERIES[..], 5.0, 3_748_130.32, 0.0, 13, 6_750_877.02),
    ] {
        let spend = 1_000_000.0 * rate / 100.0;
        let mut s: Vec<f64> = series.to_vec();
        let (t, dy, _) = seq_run(&s, "withdrawal", 1_000_000.0, spend, 0.0);
        assert!((t - orig).abs() <= 1.0, "{name} 原始顺序终值：{t} vs {orig}");
        assert_eq!(dy, -1, "{name} 原始顺序存活");
        s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let (t, dy_a, _) = seq_run(&s, "withdrawal", 1_000_000.0, spend, 0.0);
        assert!((t - asc).abs() <= 1.0, "{name} 升序终值：{t} vs {asc}");
        assert_eq!(dy_a, asc_dy, "{name} 升序耗尽年：{dy_a} vs {asc_dy}");
        s.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        let (t, _, _) = seq_run(&s, "withdrawal", 1_000_000.0, spend, 0.0);
        assert!((t - desc).abs() <= 1.0, "{name} 降序终值：{t} vs {desc}");
    }
    // 倍数口径抽查（bridge.ts：terminalMultiple = round2(terminal ÷ currentAssets)）
    let (_, _, m) = seq_run(&CSI300_SERIES, "withdrawal", 1_000_000.0, 40_000.0, 0.0);
    assert!((m - 2.83).abs() <= 0.005, "csi300 4% 原始顺序倍数 2.83（实际 {m}）");
}

#[test]
fn sequence_rolling_anchors() {
    // §3.3-B 起点滚动（4% 支取）：测试内逐窗切片调用 simulate_sequence 复算；
    // 中位按「中间两位中较差者」口径（docs/p2-spec.md §3.2）。
    let run_windows = |series: &[f64], h: usize| -> Vec<(usize, f64, i64)> {
        let mut out = Vec::new();
        for start in 0..=(series.len() - h) {
            let v = jv(&simulate_sequence(&seq_input(
                &series[start..start + h],
                h,
                "withdrawal",
                1_000_000.0,
                40_000.0,
                0.0,
            )));
            assert_eq!(txt(&v, "error"), "");
            out.push((
                start,
                num(&v, "terminalAssets"),
                v.get("depletedYear").and_then(|x| x.as_i64()).unwrap(),
            ));
        }
        out
    };
    let median_index = |n: usize| -> usize {
        // 升序后取中位：奇数取正中；偶数取中间两位中较差者（下标 n/2 − 1）
        if n % 2 == 1 {
            (n - 1) / 2
        } else {
            n / 2 - 1
        }
    };

    // csi300 H=10：11 窗；min 190,359.34（起点 2008）、中位 1,112,813.05（起点 2014，
    // 奇数窗正中）、max 3,498,434.62（起点 2006）
    let c10 = run_windows(&CSI300_SERIES, 10);
    assert_eq!(c10.len(), 11, "起点数 = N − H + 1");
    let mut sorted = c10.clone();
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let idx = median_index(sorted.len());
    assert!(idx < sorted.len(), "medianIndex 为整数且在窗口范围内");
    assert!((sorted[0].1 - 190_359.34).abs() <= 1.0, "csi300 H10 min：{}", sorted[0].1);
    assert_eq!(2005 + sorted[0].0, 2008, "csi300 H10 min 起点");
    assert!(
        (sorted[idx].1 - 1_112_813.05).abs() <= 1.0,
        "csi300 H10 中位：{}",
        sorted[idx].1
    );
    assert_eq!(2005 + sorted[idx].0, 2014, "csi300 H10 中位起点");
    assert!(
        (sorted[sorted.len() - 1].1 - 3_498_434.62).abs() <= 1.0,
        "csi300 H10 max：{}",
        sorted[sorted.len() - 1].1
    );
    assert_eq!(2005 + sorted[sorted.len() - 1].0, 2006, "csi300 H10 max 起点");

    // sp500 H=10：12 窗；min 1,261,347.35（2007）、中位（较差者）2,616,862.11（起点 2015；
    // 中间两位 2,616,862.11 / 2,624,988.68）、max 3,732,908.68（2012）
    let s10 = run_windows(&SP500_SERIES, 10);
    assert_eq!(s10.len(), 12, "起点数 = N − H + 1");
    let mut sorted = s10.clone();
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let idx = median_index(sorted.len());
    assert!(idx < sorted.len());
    assert!((sorted[0].1 - 1_261_347.35).abs() <= 1.0, "sp500 H10 min：{}", sorted[0].1);
    assert_eq!(2005 + sorted[0].0, 2007, "sp500 H10 min 起点");
    assert!(
        (sorted[idx].1 - 2_616_862.11).abs() <= 1.0,
        "sp500 H10 中位（较差者）：{}",
        sorted[idx].1
    );
    assert_eq!(2005 + sorted[idx].0, 2015, "sp500 H10 中位起点");
    assert!(
        (sorted[idx + 1].1 - 2_624_988.68).abs() <= 1.0,
        "sp500 H10 中位另一位：{}",
        sorted[idx + 1].1
    );
    assert!(
        (sorted[sorted.len() - 1].1 - 3_732_908.68).abs() <= 1.0,
        "sp500 H10 max：{}",
        sorted[sorted.len() - 1].1
    );
    assert_eq!(2005 + sorted[sorted.len() - 1].0, 2012, "sp500 H10 max 起点");

    // csi300 H=15：6 窗；min 0（起点 2008，第 15 年耗尽精确）、中位（较差者）
    // 1,273,794.71（起点 2009；中间两位 1,273,794.71 / 1,499,572.93）、max 4,611,906.31（2006）
    let c15 = run_windows(&CSI300_SERIES, 15);
    assert_eq!(c15.len(), 6, "起点数 = N − H + 1");
    let mut sorted = c15.clone();
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let idx = median_index(sorted.len());
    assert!(idx < sorted.len());
    assert_eq!(sorted[0].1, 0.0, "csi300 H15 min 终值记 0");
    assert_eq!(2005 + sorted[0].0, 2008, "csi300 H15 min 起点");
    assert_eq!(sorted[0].2, 15, "csi300 H15 起点 2008 第 15 年耗尽（精确）");
    assert!(
        (sorted[idx].1 - 1_273_794.71).abs() <= 1.0,
        "csi300 H15 中位（较差者）：{}",
        sorted[idx].1
    );
    assert_eq!(2005 + sorted[idx].0, 2009, "csi300 H15 中位起点");
    assert!(
        (sorted[idx + 1].1 - 1_499_572.93).abs() <= 1.0,
        "csi300 H15 中位另一位：{}",
        sorted[idx + 1].1
    );
    assert!(
        (sorted[sorted.len() - 1].1 - 4_611_906.31).abs() <= 1.0,
        "csi300 H15 max：{}",
        sorted[sorted.len() - 1].1
    );
    assert_eq!(2005 + sorted[sorted.len() - 1].0, 2006, "csi300 H15 max 起点");
}

#[test]
fn sequence_geometric_mean_invariance() {
    // 三序重排后几何年化不变（乘积交换律）：csi300 7.089%、sp500 10.701%（登记值为
    // 三位小数舍入；重排间相等断言容差 ±1e-6 百分点，登记值比对容差 ±1e-3 百分点）
    let geo = |series: &[f64]| -> f64 {
        let g = series
            .iter()
            .fold(1.0_f64, |acc, x| acc * (1.0 + x / 100.0));
        (g.powf(1.0 / series.len() as f64) - 1.0) * 100.0
    };
    for (name, series, anchor) in [
        ("csi300", &CSI300_SERIES[..], 7.089_f64),
        ("sp500", &SP500_SERIES[..], 10.701_f64),
    ] {
        let mut asc = series.to_vec();
        asc.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let mut desc = series.to_vec();
        desc.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        let g0 = geo(series);
        let g1 = geo(&asc);
        let g2 = geo(&desc);
        assert!(
            (g0 - g1).abs() <= 1e-6 && (g1 - g2).abs() <= 1e-6,
            "{name} 重排几何年化不变"
        );
        assert!(
            (g0 - anchor).abs() <= 1e-3,
            "{name} 几何年化 ≈ {anchor}（实际 {g0}）"
        );
    }
}

#[test]
fn sequence_accumulation_anchors() {
    // §3.3-C 积累期三序对照（annualSaving = 120,000、期初 0；±1 元）
    for (name, series, orig, asc, desc) in [
        ("csi300", &CSI300_SERIES[..], 3_322_802.95, 62_900_285.01, 707_900.29),
        ("sp500", &SP500_SERIES[..], 11_301_242.73, 23_045_194.88, 4_094_650.65),
    ] {
        let mut s: Vec<f64> = series.to_vec();
        let (t, dy, m) = seq_run(&s, "accumulation", 0.0, 0.0, 120_000.0);
        assert_eq!(dy, -1, "{name} 积累口径耗尽年恒 −1");
        assert_eq!(m, 0.0, "{name} 期初资产 0 → 倍数 0");
        assert!((t - orig).abs() <= 1.0, "{name} 原始顺序终值：{t} vs {orig}");
        s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let (t, _, _) = seq_run(&s, "accumulation", 0.0, 0.0, 120_000.0);
        assert!((t - asc).abs() <= 1.0, "{name} 升序终值：{t} vs {asc}");
        s.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        let (t, _, _) = seq_run(&s, "accumulation", 0.0, 0.0, 120_000.0);
        assert!((t - desc).abs() <= 1.0, "{name} 降序终值：{t} vs {desc}");
    }
}

// ---------------------------------------------------------------------------
// 15. P2/F4 solve_required_saving —— 目标日期反推闭式解
// ---------------------------------------------------------------------------

#[test]
fn required_saving_closed_form() {
    // §5.1 锚点表（±0.01 元；q=1 分支断言精确值 4,730.00）
    let run = |assets: f64, target: f64, years: u32, r: f64, i: f64| {
        let inp = format!(
            r#"{{"currentAssets":{assets},"targetValue":{target},"years":{years},"nominalReturnMeanPct":{r},"inflationMeanPct":{i}}}"#
        );
        jv(&solve_required_saving(&inp))
    };
    let cases: [(f64, f64, u32, f64, f64, f64); 5] = [
        (0.0, 1_635_200.0, 30, 4.5, 2.0, 3_128.15),
        (500_000.0, 1_635_200.0, 30, 4.5, 2.0, 1_150.41),
        (500_000.0, 1_635_200.0, 40, 4.5, 2.0, 397.59),
        (500_000.0, 1_635_200.0, 20, 2.5, 2.5, 4_730.00), // q = 1 分支
        (2_000_000.0, 1_635_200.0, 30, 4.5, 2.0, -4_782.83), // 负值分支
    ];
    for (assets, target, years, r, i, expect) in cases {
        let v = run(assets, target, years, r, i);
        assert_eq!(txt(&v, "error"), "", "assets={assets} T={years}");
        let got = num(&v, "requiredMonthlySaving");
        if years == 20 {
            // q = 1 分支：F = T × (1+r)^T，(1+r)^T 精确相消 → (target−assets)/(12×T)
            assert!(
                (got - expect).abs() < 1e-9,
                "q=1 分支精确值 {expect}（实际 {got}）"
            );
        } else {
            assert!(
                (got - expect).abs() <= 0.01,
                "assets={assets} T={years} r={r} i={i}：期望 {expect}（实际 {got}）"
            );
        }
    }
}

#[test]
fn required_saving_validation() {
    let run = |inp: String| jv(&solve_required_saving(&inp));
    let cases: Vec<(String, String)> = vec![
        // years = 0 / 201 → error
        (
            r#"{"currentAssets":0,"targetValue":1635200,"years":0,"nominalReturnMeanPct":4.5,"inflationMeanPct":2}"#.into(),
            "目标年限".into(),
        ),
        (
            r#"{"currentAssets":0,"targetValue":1635200,"years":201,"nominalReturnMeanPct":4.5,"inflationMeanPct":2}"#.into(),
            "目标年限".into(),
        ),
        // 金额越界（负值 / 超过 1e15）→ error
        (
            r#"{"currentAssets":-1,"targetValue":1635200,"years":30,"nominalReturnMeanPct":4.5,"inflationMeanPct":2}"#.into(),
            "当前资产".into(),
        ),
        (
            r#"{"currentAssets":0,"targetValue":1000000000000001,"years":30,"nominalReturnMeanPct":4.5,"inflationMeanPct":2}"#.into(),
            "财富自由目标值".into(),
        ),
        // 均值越界（|v| > 1000）→ error
        (
            r#"{"currentAssets":0,"targetValue":1635200,"years":30,"nominalReturnMeanPct":1500,"inflationMeanPct":2}"#.into(),
            "1000".into(),
        ),
        // (1+r) ≤ 0 硬约束（≤ −100）→ error
        (
            r#"{"currentAssets":0,"targetValue":1635200,"years":30,"nominalReturnMeanPct":-150,"inflationMeanPct":2}"#.into(),
            "不得低于".into(),
        ),
        (
            r#"{"currentAssets":0,"targetValue":1635200,"years":30,"nominalReturnMeanPct":4.5,"inflationMeanPct":-100}"#.into(),
            "不得低于".into(),
        ),
    ];
    for (inp, keyword) in cases {
        let v = run(inp.clone());
        let err = txt(&v, "error");
        assert!(!err.is_empty(), "应返回错误：{inp}");
        assert!(err.contains(&keyword), "错误信息应含「{keyword}」：{err}");
        assert_eq!(
            num(&v, "requiredMonthlySaving"),
            0.0,
            "错误安全值：requiredMonthlySaving = 0"
        );
    }
}
