#!/usr/bin/env node
/**
 * ============================================================================
 * P8 生命周期引擎算例断言 L1–L6（docs/p8-spec.md §3/§3.8；验收 ①②⑤⑥⑦ 计时）
 * 零新依赖——esbuild 随 vite 在依赖树内（check-share.mjs 同款路径）+ node:assert。
 * ============================================================================
 *
 * 结构：
 *  - 纯函数断言（L2 / L6-a / L6-b）直接调用 finance.ts 导出纯函数
 *    assembleTimeline / deriveTimelineSummary（§1.3 测试缝，无 wasm 依赖）；
 *  - wasm 断言（L1 / L3 / L4 / L5 / L6-c）以 init(await readFile(
 *    "src/wasm/pkg/finance_core_bg.wasm")) 注入真实二进制后调用 service
 *    （§3.8：桩只能证明管道、不能证明字节——禁静默降级为桩替身）；
 *    esbuild 仅打包 finance.ts（glue 以 external 保留相对导入 → 与脚本直接
 *    import 的 glue 为同一模块实例，先 init 后调用即完成注入）。
 *  - 期望值全部为独立推导（docs/p8-spec.md §3 + §3.7 修订对照 D1–D5），
 *    不以实现输出为真值；断言容差 ±0.01 元（恰零行 ±0.005）。
 *
 * 用法：node scripts/check-lifecycle.mjs（或 npm run check:lifecycle）
 */
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BUNDLE_TMP = join(ROOT, "src", "services", ".tmp-check-lifecycle-finance.mjs");

// ---------------------------------------------------------------------------
// 1) esbuild 打包 finance.ts（glue external → 相对导入保留，运行时与直接 import
//    的 pkg 模块为同一实例；bridge.ts 的 WASM_NOT_BUILT 常量为值导入，随包内联）
// ---------------------------------------------------------------------------
await build({
  entryPoints: [join(ROOT, "src", "services", "finance.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  external: ["../wasm/pkg/finance_core.js"],
  legalComments: "none",
  logLevel: "silent",
  outfile: BUNDLE_TMP,
});

const engine = await import(pathToFileURL(BUNDLE_TMP).href);
const glue = await import(pathToFileURL(join(ROOT, "src", "wasm", "pkg", "finance_core.js")).href);

// 真实 wasm 二进制注入（§3.8 实施首验项：Node 装载失败 = 实施阻塞，禁桩替身）。
// 本 wasm-bindgen 版本 glue 以 default 导出异步 init（finance.ts:11 `import init` 即取
// default）；先注入后调用 service → ensureInit 的 init() 命中已初始化单例直接返回。
const wasmBytes = readFileSync(join(ROOT, "src", "wasm", "pkg", "finance_core_bg.wasm"));
await glue.default({ module_or_path: new Uint8Array(wasmBytes) });

const {
  calcLifecycle,
  calcPension,
  calcAccumulation,
  assembleTimeline,
  deriveTimelineSummary,
} = engine;

// ---------------------------------------------------------------------------
// 2) 夹具（defaults.ts:30-40 / 168-179 / 183-198 原样；数值与 store 默认值一致）
// ---------------------------------------------------------------------------
const BASELINE_DEFAULTS = {
  monthlyExpense: 2990,
  childCount: 0,
  costPerChild: 580000,
  healthReserve: 200000,
  majorInvestment: 0,
  nominalReturnPct: 4.5,
  inflationPct: 2.0,
};
const ACCUMULATION_DEFAULTS = {
  currentAssets: 500000,
  monthlyIncome: 8000,
  monthlyExpense: 2990,
  targetValue: 1635200,
  nominalReturnMeanPct: 4.5,
  nominalReturnStdPct: 12,
  inflationMeanPct: 2,
  inflationStdPct: 1,
  years: 40,
  paths: 5000,
  seed: 42,
  sustainYears: 0,
};
const PENSION_DEFAULTS = {
  currentAge: 30,
  retireAge: 60,
  targetRetireAge: 60,
  contribYears: 30,
  contribIndex: 0.6,
  accountBalance: 50000,
  avgMonthlyWage: 10343,
  monthsDivisor: 139,
};
const round2 = (x) => Math.round(x * 100) / 100;
const near = (actual, expected, tol = 0.01, label = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label} 期望 ${expected}（±${tol}），实际 ${actual}`,
  );

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

try {
  // =========================================================================
  // L1（算例①）：提前退休未领养老金——两段年度行连续性（§3.1）
  // 独立推导：基础 = (10343+10343×0.6)÷2×30÷100 = 2482.32；账户 = 50000÷139 =
  // 359.71；月养老金 = 2842.03、年额 = 34104.36；期初 = 两段真实总需 1,706,225.60
  // （README.md:86 锚点：桥接 1,435,200.00 + 领取后 271,025.60，一次性预留含在期初、
  // 单次计入）；桥接闭式 A_30 = 3,559,230.95；终值闭式 = 10,282,865.09（双路一致）。
  // =========================================================================
  {
    const input = {
      base: { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1706225.6, years: 60 },
      pension: { ...PENSION_DEFAULTS, targetRetireAge: 30 },
      loan: { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" },
      rental: {
        price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30,
        monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1,
        propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5,
      },
    };
    const t0 = performance.now();
    const res = await calcLifecycle(input);
    assert.equal(res.ok, true, `L1 前置：calcLifecycle 应成功（${res.ok ? "" : res.error}）`);
    const { timeline: rows, summary } = res.data;
    // ① bridgeYears 恰 = 30 = estimate_pension 口径（60 − max(30,30)）；桥接备资纯生活费
    assert.equal(summary.bridgeYears, 30, "L1① bridgeYears 应 = 30");
    near(summary.bridgeFundingNeeded, 1435200.0, 0.01, "L1① bridgeFundingNeeded");
    near(summary.pensionMonthly, 2842.03, 0.01, "L1① pensionMonthly");
    assert.equal(summary.error, "", "L1① summary.error 应为空");
    assert.equal(summary.horizon, 60, "L1 horizon 应 = 60");
    assert.equal(rows.length, 60, "L1 timeline 应为 60 行");
    assert.equal(summary.depletedYear, -1, "L1 depletedYear 应 = −1（存活）");
    // ⑥ fiFirstYear = 0（期初 1,706,225.60 ≥ 目标 1,635,200 → t=0 判定）
    assert.equal(summary.fiFirstYear, 0, "L1⑥ fiFirstYear 应 = 0（期初已达标）");
    // ③ 行 1–30 contribution = 0 且支取 = 生活费全额；行 31 起净支取且 pensionStart 恰挂第 31 行
    for (let t = 1; t <= 60; t++) {
      const row = rows[t - 1];
      assert.equal(row.contribution, 0, `L1③ 第 ${t} 行 contribution 应 = 0（停工 30 岁）`);
      assert.equal(row.events.length, 0, `L1 第 ${t} 行 events 恒空`);
      assert.equal(row.age, 29 + t, `L1 行首年龄 = currentAge + t − 1（第 ${t} 行）`);
      const living = 35880 * Math.pow(1.02, t);
      near(row.withdrawal, t >= 31 ? living - 34104.36 : living, 0.01, `L1③ 第 ${t} 行${t >= 31 ? "净支取 = 生活费 − 年养老金" : "生活费全额支取"}`);
    }
    ok(!rows.slice(0, 30).some((r) => r.pensionStart), "L1③ 行 1–30 pensionStart 恒 false");
    ok(rows[30].pensionStart, "L1③ pensionStart 恰挂第 31 行");
    ok(!rows.slice(31).some((r) => r.pensionStart), "L1③ pensionStart 仅第 31 行");
    // 跨段连续：第 30 行期末 = 第 31 行期初（全精度恒等——无重置、无一次性预留二次计入）
    assert.equal(rows[30].openingAssets, rows[29].closingAssets, "L1② 第 30↔31 行跨段连续");
    near(rows[29].closingAssets, 3559230.95, 0.01, "L2 表 桥接末行 A_30");
    near(rows[30].withdrawal, 66291.49 - 34104.36, 0.01, "L1③ 第 31 行净支取 = 生活费 − 年养老金");
    near(rows[30].closingAssets, 3687209.22, 0.01, "L1 表 养老金首行 A_31");
    // ④ 全 60 行 closing > 0 且逐年增量 ≥ 40,182.55（含期初→第 1 年段）
    ok(rows.every((r) => r.closingAssets > 0), "L1④ 全 60 行 closing > 0");
    let minGrow = rows[0].closingAssets - input.accum.currentAssets;
    for (let i = 1; i < rows.length; i++) {
      minGrow = Math.min(minGrow, rows[i].closingAssets - rows[i - 1].closingAssets);
    }
    ok(minGrow >= 40182.55 - 0.01, `L1④ 逐年最小增量 ≥ 40,182.55（实测 ${minGrow.toFixed(2)}）`);
    // ⑤ A_60 = 10,282,865.09 ± 0.01（递推 = 闭式双路一致）
    near(rows[59].closingAssets, 10282865.09, 0.01, "L1⑤ 终值 A_60");
    console.log(
      `[check-lifecycle] L1 通过：bridgeYears=30、A_30=3,559,230.95、A_60=10,282,865.09、fiFirstYear=0、pensionStart@31（${(performance.now() - t0).toFixed(1)} ms）`,
    );
  }

  // =========================================================================
  // L2（算例②）：达标后暴跌——首触不回写、暴跌行可见（§3.2，纯函数缝注入）
  // provider 序列 = [+4.5%×11, −40%×1（第 12 行）, +4.5%…]；通胀样本恒 0（名义=实际）。
  // 期望：fiFirstYear = 11 且不回写；A_12 = 1,046,254.92（全精度回撤 −597,303.28，
  // §3.7 D3：草案 −597,303.27 为舍入值相减）。
  // =========================================================================
  {
    const args = {
      currentAssets: 500000,
      monthlyIncome: 8000,
      monthlyExpense: 2990,
      targetValue: 1635200,
      rMeanPct: 4.5,
      iMeanPct: 0, // 通胀样本恒 0 → 名义 = 实际、年储蓄 60,120 恒定
      workEnd: 30, // targetRetireAge = 60、currentAge = 30
      yearsToRetire: 30,
      pensionAnnual: 0,
      currentAge: 30,
      horizon: 20,
    };
    const provider = (year) => ({ r: year === 12 ? -0.4 : 0.045, infl: 0 });
    const rows = assembleTimeline(args, provider);
    const derived = deriveTimelineSummary(rows, args);
    // ① 首达年限 = 11 且不因第 12 行暴跌改写（首触口径，accumulation.rs:289-298 现状语义）
    assert.equal(derived.fiFirstYear, 11, "L2① fiFirstYear 应 = 11 且不回写");
    // ② 第 10–18 行序列与算例表逐行一致（±0.01）
    const expect = {
      10: 1515251.86, 11: 1643558.19, 12: 1046254.92, 13: 1153456.39,
      14: 1265481.92, 15: 1382548.61, 16: 1504883.3, 17: 1632723.05, 18: 1766315.58,
    };
    for (const [t, v] of Object.entries(expect)) {
      near(rows[Number(t) - 1].closingAssets, v, 0.01, `L2② 第 ${t} 行期末资产`);
    }
    // ③ 第 11 行 ≥ 目标 且 第 10 行 < 目标（首触唯一性）
    ok(rows[10].closingAssets >= 1635200 && rows[9].closingAssets < 1635200, "L2③ 首触唯一：A_10 < 目标 ≤ A_11");
    // 全精度回撤（D3 定稿值）
    near(rows[11].closingAssets - rows[10].closingAssets, -597303.28, 0.01, "L2/D3 全精度回撤 A_12 − A_11");
    // ④ 口径边界：「存续 ≠ 未跌破目标」——存续判定按资产 ≤ 0 口径，本路径资产恒正
    //    （min = 582,620.00 > 0）时任意 N 恒「存续」，即使中途跌破目标（cases §2 断言④）
    const minClose = Math.min(...rows.map((r) => r.closingAssets));
    ok(minClose > 0, `L2④ 资产恒正（min = ${minClose.toFixed(2)}）→ 存续恒成立、与跌破目标正交`);
    ok(Math.min(...rows.filter((_, i) => i >= 11).map((r) => r.closingAssets)) < 1635200,
      "L2④ 暴跌后第 12 行起确实跌破目标（存续仍成立——口径边界成立的前提）");
    // ⑤ −40% 样本不触发防御钳制（钳制线 −0.99，accumulation.rs:270-271）——
    //    行值精确按 ×0.6 递推即证（A_12 = A_11×0.6 + 60,120）
    near(rows[11].closingAssets, 1643558.19 * 0.6 + 60120, 0.01, "L2⑤ A_12 = A_11×0.6 + 60,120（−40% 未被钳制）");
    // 工作段行语义：contribution = 60,120 恒定（通胀 0）、withdrawal 恒 0
    for (const row of rows) {
      near(row.contribution, 60120, 0.01, `L2 第 ${row.year} 行年储蓄恒定`);
      assert.equal(row.withdrawal, 0, `L2 第 ${row.year} 行工作段支取恒 0`);
    }
    console.log("[check-lifecycle] L2 通过：fiFirstYear=11 不回写、暴跌行 1,046,254.92 可见、存续口径边界断言成立");
  }

  // =========================================================================
  // L3（算例③）：连续低回报（名义 1% < 通胀 3%——实际负增长）（§3.3，生产均值路径）
  // 实际回报 = 1.01/1.03 − 1 = −1.9417%/年；实口径闭式 R_t = 3,096,180 − 2,596,180×
  // (1.01/1.03)^t；首达 30 年（实口径富余 19,331.87）；变体 B 永不触达 → −1。
  // =========================================================================
  {
    const accum = { ...ACCUMULATION_DEFAULTS, nominalReturnMeanPct: 1, inflationMeanPct: 3 };
    const input = {
      base: { ...BASELINE_DEFAULTS },
      accum,
      pension: { ...PENSION_DEFAULTS },
      loan: { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" },
      rental: { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 },
    };
    const res = await calcLifecycle(input);
    assert.equal(res.ok, true, `L3 前置：calcLifecycle 应成功（${res.ok ? "" : res.error}）`);
    const { timeline: rows, summary } = res.data;
    // ④ 引擎对「名义回报均值 < 通胀均值」不得报错（accumulation.rs:195-196 仅校验 σ>0
    //    与有界性；check_pct_signed 允许负均值）
    assert.equal(summary.error, "", "L3④ summary.error 应为空（负实际均值合法）");
    // ① 首达年限 = 30（两路推导一致：名义递推与实口径闭式）
    assert.equal(summary.fiFirstYear, 30, "L3① fiFirstYear 应 = 30");
    // ② 年度行名义值与实口径换算逐行自洽（A_t = R_t×1.03^t，±0.01）
    const expectReal = { 1: 550411.26, 10: 962269.06, 20: 1342227.69, 29: 1625984.38, 30: 1654531.87 };
    for (const [t, v] of Object.entries(expectReal)) {
      const nominal = rows[Number(t) - 1].closingAssets;
      near(nominal, { 1: 566923.6, 10: 1293209.15, 20: 2424212.5, 29: 3831738.71, 30: 4015983.12 }[Number(t)], 0.01, `L3 表 第 ${t} 行名义期末`);
      near(nominal / Math.pow(1.03, Number(t)), v, 0.01, `L3② 第 ${t} 行实口径 R_t`);
    }
    // 实口径富余
    near(rows[29].closingAssets / Math.pow(1.03, 30) - 1635200, 19331.87, 0.01, "L3① 实口径富余 19,331.87");
    // ⑤ 实际回报 −1.9417%/年须在行级可复算（行 t 有效样本 = 0.01 − 0.03）
    near(1.01 / 1.03 - 1, -0.019417475728155353, 1e-12, "L3⑤ 实际回报 −1.9417%/年");
    // ③ 变体 B：月储蓄 0（合法输入）→ 永不触达 → fiFirstYear = −1（引擎输出哨兵）
    const resB = await calcLifecycle({
      ...input,
      accum: { ...accum, monthlyIncome: 2990, monthlyExpense: 2990 },
    });
    assert.equal(resB.ok, true, "L3③ 变体 B 前置：calcLifecycle 应成功");
    assert.equal(resB.data.summary.fiFirstYear, -1, "L3③ 变体 B fiFirstYear 应 = −1（永不触达哨兵）");
    near(resB.data.timeline[9].closingAssets / Math.pow(1.03, 10), 410971.3, 0.01, "L3③ 变体 B R_10 = 410,971.30");
    near(resB.data.timeline[19].closingAssets / Math.pow(1.03, 20), 337794.82, 0.01, "L3③ 变体 B R_20 = 337,794.82");
    // D5 笔误修正锚：名义 A_10 = 500,000×1.01^10 = 552,311.06（草案 552,320.38 系笔误）
    near(resB.data.timeline[9].closingAssets, 552311.06, 0.01, "L3/D5 变体 B 名义 A_10 = 552,311.06");
    console.log("[check-lifecycle] L3 通过：首达 30 年（实口径富余 19,331.87）、负实际均值零报错、变体 B 哨兵 −1");
  }

  // =========================================================================
  // L4（算例④）：通胀超回报（实际 ≤ 0——乘数族 / 行族分水岭）（§3.4）
  // 输入 A：base 2.0/2.0 → 乘数族错误分支；时间线 r=i=2% 支取退化为线性实耗，
  // D2 修正：f64 残差 > 0 → 判定第 41 行、展示 round2 = 0.00（差一行）。
  // 输入 B：积累序列 r=i → 首触 19。
  // =========================================================================
  {
    const base = { ...BASELINE_DEFAULTS, nominalReturnPct: 2.0, inflationPct: 2.0 };
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    // ---- 输入 A（支取序列）----
    const resA = await calcLifecycle({
      base,
      accum: {
        currentAssets: 1435200, monthlyIncome: 0, monthlyExpense: 2990, targetValue: 1635200,
        nominalReturnMeanPct: 2, nominalReturnStdPct: 12, inflationMeanPct: 2, inflationStdPct: 1,
        years: 60, paths: 5000, seed: 42, sustainYears: 0,
      },
      pension: { ...PENSION_DEFAULTS, targetRetireAge: 30 },
      loan,
      rental,
    });
    assert.equal(resA.ok, true, `L4-A 前置：calcLifecycle 应成功（${resA.ok ? "" : resA.error}）`);
    const { timeline: rowsA, summary: sumA } = resA.data;
    // ① 乘数族分支：非空中文 error、pensionMonthly = 0、bridgeFundingNeeded = 0——
    //    禁 Infinity / NaN / 负乘数；时间线族不受该错误影响、继续装配
    assert.equal(sumA.error, "通胀率需低于名义回报率", "L4① summary.error 应为乘数族契约定字");
    assert.equal(sumA.pensionMonthly, 0, "L4① 错误分支 pensionMonthly 安全值 0");
    assert.equal(sumA.bridgeFundingNeeded, 0, "L4① 错误分支 bridgeFundingNeeded 安全值 0");
    assert.equal(sumA.bridgeYears, 30, "L4① 错误分支 bridgeYears 保留计算值（pension.rs:209-225 回显先例）");
    ok(Number.isFinite(sumA.pensionMonthly) && Number.isFinite(sumA.bridgeFundingNeeded), "L4① 无 Infinity/NaN");
    assert.equal(rowsA.length, 60, "L4① 行族继续装配：60 行在位");
    // ③ 支取序列：第 1 行 = 1,427,306.40；第 39 行 = 77,671.04（实口径恰剩一年实支出
    //    35,880.00）；第 40 行 round2 = 0.00（|残差| ≤ 0.005）且全精度 > 0；depletedYear = 41
    //    （§3.7 D2 差一行修正）；第 41–60 行全字段恒 0
    near(rowsA[0].closingAssets, 1427306.4, 0.01, "L4③ 第 1 行期末资产");
    near(rowsA[0].closingAssets / 1.02, 1399320.0, 0.01, "L4③ 第 1 行实口径 1,399,320.00");
    near(rowsA[38].closingAssets, 77671.04, 0.01, "L4③ 第 39 行期末资产");
    near(rowsA[38].closingAssets / Math.pow(1.02, 39), 35880.0, 0.01, "L4③ 第 39 行实口径恰剩一年实支出");
    ok(rowsA[39].closingAssets > 0, `L4③/D2 第 40 行全精度残差应为正（实测 ${rowsA[39].closingAssets}）`);
    ok(Math.abs(rowsA[39].closingAssets) <= 0.005, `L4③ 第 40 行 |残差| ≤ 0.005（实测 ${rowsA[39].closingAssets}）`);
    assert.equal(round2(rowsA[39].closingAssets), 0, "L4③ 第 40 行 round2 = 0.00（展示层教学闭合）");
    assert.equal(sumA.depletedYear, 41, "L4③/D2 depletedYear 应 = 41（判定层差一行）");
    // 耗尽行行语义（§2.3 语义定稿钉死）：该行 closing 钳 0、当行支出仍按公式记值
    // （支出把资产打到零是真实发生的事——全精度 −80,808.95 即 §3.4 表注来源）；
    // 其后行（42 起）全字段恒 0
    const depRow = rowsA[40];
    assert.equal(depRow.closingAssets, 0, "L4③ 第 41 行（耗尽行）closing 钳 0");
    assert.equal(depRow.pensionStart, false, "L4③ 第 41 行 pensionStart false");
    near(depRow.withdrawal, 80808.95, 0.01, "L4③/§2.3 第 41 行记值支出（真实发生）");
    near(depRow.openingAssets, 1.4551915228366852e-10, 0.005, "L4③ 第 41 行期初 = 第 40 行全精度残差");
    for (let t = 42; t <= 60; t++) {
      const row = rowsA[t - 1];
      ok(
        row.openingAssets === 0 && row.contribution === 0 && row.withdrawal === 0 && row.closingAssets === 0 && !row.pensionStart && row.events.length === 0,
        `L4③ 第 ${t} 行全字段恒 0`,
      );
    }
    // ⑤ 口径注键值（caliberNote/caliberTooltip）在 L4 断言由 UI 键集承载（check:share
    //    断言 5 覆盖三语键集）；此处断言引擎输出的口径明确性：r=i 支取每行实减恒 35,880
    for (let t = 1; t <= 39; t++) {
      near(rowsA[t - 1].closingAssets / Math.pow(1.02, t), 1435200 - 35880 * t, 0.01, `L4⑤ 第 ${t} 行实口径线性实耗`);
    }
    // ---- 输入 B（积累序列）----
    const resB = await calcLifecycle({
      base,
      accum: { ...ACCUMULATION_DEFAULTS, nominalReturnMeanPct: 2, inflationMeanPct: 2 },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
    });
    assert.equal(resB.ok, true, "L4-B 前置：calcLifecycle 应成功");
    const { timeline: rowsB, summary: sumB } = resB.data;
    assert.equal(sumB.error, "通胀率需低于名义回报率", "L4① 两输入 summary.error 同形");
    // ④ 行口径 r = i 全程可递推、无除零路径；fiFirstYear = 19（R_19 = 1,642,280 ≥ 实目标）
    ok(rowsB.every((r) => Number.isFinite(r.closingAssets)), "L4② 行口径全程有限数值（无除零路径）");
    assert.equal(sumB.fiFirstYear, 19, "L4④ 输入 B fiFirstYear 应 = 19");
    console.log("[check-lifecycle] L4 通过：乘数族错误分支安全值 + 行族良态续算、D2 差一行（depletedYear=41）、积累首触 19");
  }

  // =========================================================================
  // L5（算例⑤）：长寿命（60 行行数边界与确定性性能预算）（§3.5）
  // 输入 A = L1 同参（复用期望 10,282,865.09）；输入 B 无养老金单段支取：
  // 闭式 R_60 = 1,463,904 − 28,704×1.024510^60 = 1,341,185.64 → A_60 = 4,400,471.38。
  // =========================================================================
  {
    const base = { ...BASELINE_DEFAULTS };
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const inputA = {
      base,
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1706225.6, years: 60 },
      pension: { ...PENSION_DEFAULTS, targetRetireAge: 30 },
      loan,
      rental,
    };
    const resA = await calcLifecycle(inputA);
    assert.equal(resA.ok, true, "L5-A 前置：calcLifecycle 应成功");
    // ① 两输入 rows.length 恰 = 60，行号 1..60 无缺行、无重复，末行行首年龄 = 89
    assert.equal(resA.data.timeline.length, 60, "L5① 输入 A 60 行");
    assert.equal(resA.data.timeline[59].age, 89, "L5① 末行行首年龄 89");
    near(resA.data.timeline[59].closingAssets, 10282865.09, 0.01, "L5① 输入 A 终值（复用 L1）");
    // 输入 B：pension contribYears = 0、accountBalance = 0（合法输入域）→ pensionMonthly = 0
    const inputB = {
      base,
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1435200, years: 60 },
      pension: { ...PENSION_DEFAULTS, targetRetireAge: 30, contribYears: 0, accountBalance: 0 },
      loan,
      rental,
    };
    const resB = await calcLifecycle(inputB);
    assert.equal(resB.ok, true, `L5-B 前置：calcLifecycle 应成功（${resB.ok ? "" : resB.error}）`);
    const { timeline: rowsB, summary: sumB } = resB.data;
    assert.equal(sumB.error, "", "L5-B summary.error 应为空（contribYears 0 合法）");
    assert.equal(sumB.pensionMonthly, 0, "L5-B pensionMonthly = 0 → 全程净支取 = 生活费全额");
    assert.equal(rowsB.length, 60, "L5① 输入 B 60 行");
    for (let t = 1; t <= 60; t++) {
      near(rowsB[t - 1].withdrawal, 35880 * Math.pow(1.02, t), 0.01, `L5-B 第 ${t} 行支取 = 生活费全额`);
    }
    // ② 终值 = 4,400,471.38 ± 0.01 且 depletedYear = −1（闭式与递推双路一致）
    near(rowsB[59].closingAssets, 4400471.38, 0.01, "L5② 输入 B 终值 A_60");
    near(rowsB[59].closingAssets / Math.pow(1.02, 60), 1341185.64, 0.01, "L5② 实口径 R_60 单调缓降");
    const g = 1.045 / 1.02;
    near((1463904 - 28704 * Math.pow(g, 60)) * Math.pow(1.02, 60), 4400471.38, 0.01, "L5② 闭式双路复核");
    assert.equal(sumB.depletedYear, -1, "L5② 60 行内不耗尽（理论耗尽点 t > 162.4 年）");
    // ③ 确定性性能预算：calcLifecycle 单次完整调用（含两次 wasm 调用与 60 行装配）≤ 50 ms
    //    （release 产物；首调用已预热懒加载编译，5 次取最优避免调度噪声）
    await calcLifecycle(inputB);
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = await calcLifecycle(inputB);
      best = Math.min(best, performance.now() - t0);
      assert.equal(r.ok, true, "L5③ 计时调用应成功");
    }
    ok(best <= 50, `L5③ 确定性性能预算 ≤ 50 ms（实测最优 ${best.toFixed(2)} ms）`);
    console.log(`[check-lifecycle] L5 通过：60 行边界 + 无养老金终值 4,400,471.38 + 性能实测 ${best.toFixed(2)} ms（预算 50 ms）`);
    // ④ 随机模式 60 年 × 5,000 路径时长不在本轮断言（§0.2 排除登记）——不测。
  }

  // =========================================================================
  // L6（算例⑥）：同资料双口径一致性（§3.6；D4 重界为 a/b/c/d 三重承载）
  // a/b 公式层同构（provider 注入样本 [+10%, −5%] / [+2%, +2%]——手算小例，非 seed 42
  // 真值）：A_1 = 611,322.40、A_2 = 643,305.13、S_1 = 513,402.40、S_2 = 450,402.73。
  // c 引用层逐位（真实 wasm 实跑）：同 seed 42 同输入，survival 三值与直接
  // calcAccumulation 输出逐字节相等。d 三不变外推由 cargo 锁定测试承载（零变化）。
  // =========================================================================
  {
    // ---- L6-a 积累递推同构（workEnd = 2：两年储蓄均入行）----
    const samples = (year) => ({ r: year === 1 ? 0.1 : -0.05, infl: 0.02 });
    const argsA = {
      currentAssets: 500000, monthlyIncome: 8000, monthlyExpense: 2990, targetValue: 500000,
      rMeanPct: 4.5, iMeanPct: 2, workEnd: 2, yearsToRetire: 30, pensionAnnual: 0,
      currentAge: 30, horizon: 2,
    };
    const rowsA = assembleTimeline(argsA, samples);
    near(rowsA[0].closingAssets, 611322.4, 0.01, "L6-a A_1 = 500,000×1.10 + 60,120×1.02");
    near(rowsA[1].closingAssets, 643305.13, 0.01, "L6-a A_2 = A_1×0.95 + 60,120×1.02²");
    // ---- L6-b 支取递推同构（workEnd = 0：生活费基流 35,880）——支取段第 1 年支出 =
    //      积累段末年支出口径的通胀接续，无跳变（accumulation.rs:344-355 pass2 同构）----
    const argsB = { ...argsA, workEnd: 0 };
    const rowsB = assembleTimeline(argsB, samples);
    near(rowsB[0].closingAssets, 513402.4, 0.01, "L6-b S_1 = 500,000×1.10 − 35,880×1.02");
    near(rowsB[1].closingAssets, 450402.73, 0.01, "L6-b S_2 = S_1×0.95 − 35,880×1.02²");
    // ---- L6-c 同 seed 逐位（真实 wasm 实跑；sustainYears = 0 与 = 10 两组）----
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const shell = (accum) => ({
      base: { ...BASELINE_DEFAULTS },
      accum,
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
    });
    for (const sustainYears of [0, 10]) {
      const accum = { ...ACCUMULATION_DEFAULTS, sustainYears };
      const direct = await calcAccumulation(accum);
      assert.equal(direct.ok, true, `L6-c 前置：calcAccumulation 应成功（sustainYears=${sustainYears}）`);
      const viaLifecycle = await calcLifecycle(shell(accum));
      assert.equal(viaLifecycle.ok, true, `L6-c 前置：calcLifecycle 应成功（sustainYears=${sustainYears}）`);
      const s = viaLifecycle.data.summary.survival;
      // 引用层逐位：同 seed 42 同输入 → survival 三值与 accumulation 输出逐字节相等
      assert.equal(
        s.fiProbability, direct.data.fiProbability,
        `L6-c fiProbability 逐字节相等（sustainYears=${sustainYears}）`,
      );
      assert.equal(
        s.sustainedProbability, direct.data.sustainedProbability,
        `L6-c sustainedProbability 逐字节相等（sustainYears=${sustainYears}）`,
      );
      assert.equal(s.sustainYears, sustainYears, `L6-c sustainYears 输入回显（${sustainYears}）`);
    }
    // 三不变 (c) 引用层印证：sustainYears 增删不改既有字段（同 seed 逐位）
    const fi0 = (await calcAccumulation({ ...ACCUMULATION_DEFAULTS, sustainYears: 0 })).data.fiProbability;
    const fi10 = (await calcAccumulation({ ...ACCUMULATION_DEFAULTS, sustainYears: 10 })).data.fiProbability;
    assert.equal(fi0, fi10, "L6-d 引用层印证：pass1 与 N 解耦（同 seed 逐位）");
    console.log("[check-lifecycle] L6 通过：公式层同构（a/b）+ 引用层同 seed 逐位（c，sustain 0/10 两组）+ 三不变引用印证（d）");
  }

  console.log(`[check-lifecycle] L1–L6 全部通过（断言 ${passed} 项 + 逐行断言若干）。`);
} finally {
  rmSync(BUNDLE_TMP, { force: true });
}
