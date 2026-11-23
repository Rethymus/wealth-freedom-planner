#!/usr/bin/env node
/**
 * ============================================================================
 * P8 生命周期引擎算例断言 L1–L6（docs/p8-spec.md §3/§3.8；验收 ①②⑤⑥⑦ 计时）
 * ＋ P9 事件算例断言 L7–L13（docs/p9-spec.md §4；算例①–⑦ 一一对应）
 * 零新依赖——esbuild 随 vite 在依赖树内（check-share.mjs 同款路径）+ node:assert。
 * ============================================================================
 *
 * 结构：
 *  - 纯函数断言（L2 / L6-a / L6-b）直接调用 finance.ts 导出纯函数
 *    assembleTimeline / deriveTimelineSummary（§1.3 测试缝，无 wasm 依赖）；
 *  - wasm 断言（L1 / L3 / L4 / L5 / L6-c / L7–L13）以 init(await readFile(
 *    "src/wasm/pkg/finance_core_bg.wasm")) 注入真实二进制后调用 service
 *    （§3.8：桩只能证明管道、不能证明字节——禁静默降级为桩替身）；
 *    esbuild 仅打包 finance.ts（glue 以 external 保留相对导入 → 与脚本直接
 *    import 的 glue 为同一模块实例，先 init 后调用即完成注入）。
 *  - 期望值全部为独立推导（docs/p8-spec.md §3 + §3.7 修订对照 D1–D5；
 *    docs/p9-spec.md §4 + docs/research-p9-cases.md §1–§7 手算口径），
 *    不以实现输出为真值；断言容差 ±0.01 元（恰零行 ±0.005）。
 *  - P9 红线：L1–L6 六组断言区段零 diff（g = 0 逐位回归的承载——L1–L6 全部输入均为
 *    缺省 opts / 无事件，重跑逐字节零变化即「缺省 = 现状」的硬验收，p9-spec §4.2）。
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

  // =========================================================================
  // P9 L7（算例①）：购房第 5 年付 120 万（docs/p9-spec.md §4.1 / research-p9-cases §1）
  // 独立推导：P₅ = 1,200,000×1.02⁵ = 1,324,896.96（基期名义 × 行通胀因子，非原值）；
  // 基线闭式 A_t = 1,000,000×1.045^t ＋ 60,120×S_t（S_t = Σ 1.02^k·1.045^{t−k}）；
  // 事件路径差分闭式 Δ_t = −P₅×1.045^{t−5}（t ≥ 5，付款后差分只按回报复利）；
  // 基线首达 7（1,881,307.89 ≥ 目标 1,878,330.80、行 6 1,734,209.48 ＜ 1,841,500.79）；
  // 事件首达 23（2,708,967.47 ≥ 2,578,545.68、行 22 2,501,592.61 ＜ 2,527,985.96）——
  // 推迟 16 行。变体 B（默认 50 万基座）：行 5 全精度 closing = 866,289.89×1.045 ＋
  // 66,377.34 − 1,324,896.96 = −353,246.69 ≤ 0 → 耗尽落第 5 行、行 6–40 恒 0、fi = −1。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const mkInput = (events) => ({
      base: { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1000000 },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      ...(events ? { lifeEvents: events } : {}),
    });
    const P5 = 1200000 * Math.pow(1.02, 5); // = 1,324,896.96384
    const resBase = await calcLifecycle(mkInput());
    assert.equal(resBase.ok, true, "L7 前置：基线 calcLifecycle 应成功");
    const resEv = await calcLifecycle(mkInput([{ id: "p9-l7-home", kind: "homePurchase", age: 34, amount: 1200000 }]));
    assert.equal(resEv.ok, true, `L7 前置：事件 calcLifecycle 应成功（${resEv.ok ? "" : resEv.error}）`);
    const { timeline: rowsB, summary: sumB } = resBase.data;
    const { timeline: rowsE, summary: sumE } = resEv.data;
    // ① 行 5 withdrawal 恰 = P₅（基期名义 × 行通胀因子，非 120 万原值）
    near(rowsE[4].withdrawal, 1324896.96, 0.01, "L7① 行 5 withdrawal = P₅ = 1,324,896.96");
    ok(rowsE[4].events.length === 1 && rowsE[4].events[0].kind === "homePurchase", "L7⑤ 行 5 tag 恰一条 homePurchase");
    near(rowsE[4].events[0].amount, 1324896.96, 0.01, "L7⑤ tag amount = 行内名义流出值（§1.3 裁定）");
    // ② 行 1–4 两路径逐行相等（无事件 ⇒ 逐字节同）；行 5 起 Δ 逐行 = −P₅×1.045^{t−5}
    for (let t = 1; t <= 4; t++) {
      assert.equal(rowsE[t - 1].closingAssets, rowsB[t - 1].closingAssets, `L7② 行 ${t} 两路径逐字节相等`);
    }
    for (let t = 5; t <= 40; t++) {
      near(rowsE[t - 1].closingAssets - rowsB[t - 1].closingAssets, -P5 * Math.pow(1.045, t - 5), 0.01, `L7② 行 ${t} Δ = −P₅×1.045^{t−5}`);
    }
    near(rowsE[39].closingAssets - rowsB[39].closingAssets, -6183754.94, 0.01, "L7② 行 40 Δ 锚 = −6,183,754.94");
    // ③ fiFirstYear 基线 7 → 事件 23（首触不提前，research §0.9）
    assert.equal(sumB.fiFirstYear, 7, "L7③ 基线 fiFirstYear 应 = 7");
    assert.equal(sumE.fiFirstYear, 23, "L7③ 事件 fiFirstYear 应 = 23（推迟 16 行）");
    // ⑤ pensionStart 仍在行 31（事件不触碰养老金族）
    ok(rowsE[30].pensionStart && !rowsE.slice(0, 30).some((r) => r.pensionStart), "L7⑤ pensionStart 仍在行 31");
    // ④ 变体 B（默认 50 万基座）：耗尽落第 5 行、当行投入/支取仍记值、行 6–40 恒 0
    const resB = await calcLifecycle({
      base: { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      lifeEvents: [{ id: "p9-l7b-home", kind: "homePurchase", age: 34, amount: 1200000 }],
    });
    assert.equal(resB.ok, true, "L7④ 变体 B 前置：calcLifecycle 应成功");
    const { timeline: rowsVB, summary: sumVB } = resB.data;
    assert.equal(sumVB.depletedYear, 5, "L7④ 变体 B depletedYear 应 = 5");
    assert.equal(sumVB.fiFirstYear, -1, "L7④ 变体 B fiFirstYear 应 = −1");
    near(rowsVB[4].contribution, 66377.34, 0.01, "L7④ 行 5 投入仍按公式记值 66,377.34");
    near(rowsVB[4].withdrawal, 1324896.96, 0.01, "L7④ 行 5 支取仍按公式记值 1,324,896.96");
    near(rowsVB[4].realWithdrawal, 1324896.96 / Math.pow(1.02, 5), 0.01, "L7④ 行 5 realWithdrawal = 支取 ÷ cumInfl");
    for (let t = 6; t <= 40; t++) {
      const r = rowsVB[t - 1];
      ok(r.openingAssets === 0 && r.contribution === 0 && r.withdrawal === 0 && r.closingAssets === 0 && r.events.length === 0 && r.realWithdrawal === 0, `L7④ 变体 B 行 ${t} 全字段恒 0`);
    }
    ok(rowsE.every((r) => Number.isFinite(r.realWithdrawal)), "L7 realWithdrawal 全程有限数（cumInfl ＞ 0 无除零路径）");
    const t7 = performance.now();
    console.log(`[check-lifecycle] L7 通过：P₅=1,324,896.96（非原值）、Δ 闭式逐行、fi 7→23、变体 B 耗尽行 5 语义（装配计时 ${(performance.now() - t7).toFixed(1)} ms）`);
  }

  // =========================================================================
  // P9 L8（算例②）：育儿第 3 年出生（docs/p9-spec.md §4.1 / research-p9-cases §2）
  // 独立推导：出生行 t₀ = 3（行首 32 岁 = 孩子 0 岁）→ 成本行 [3, 20]（0–17 岁恰 18 行，
  // CHILD_COST_YEARS = 18）；base.costPerChild 覆写 540,000（E1：事件体不存金额——单一
  // 事实来源）→ 年成本 = 540,000÷18 = 30,000（基期）；成本行 withdrawal = 30,000×1.02^t
  // （行 3 = 31,836.24、行 20 = 44,578.42 末行闭区间）；行 21 起 Δ 增量 = Δ₂₀×0.045
  // （止后只按回报复利）。基线首达 14 → 事件 20（18 行成本恰横跨首触前最后一段）。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const mkInput = (events) => ({
      base: { ...BASELINE_DEFAULTS, costPerChild: 540000 },
      accum: { ...ACCUMULATION_DEFAULTS },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      ...(events ? { lifeEvents: events } : {}),
    });
    const resBase = await calcLifecycle(mkInput());
    assert.equal(resBase.ok, true, "L8 前置：基线 calcLifecycle 应成功");
    const resEv = await calcLifecycle(mkInput([{ id: "p9-l8-child", kind: "childBirth", age: 32 }]));
    assert.equal(resEv.ok, true, "L8 前置：事件 calcLifecycle 应成功");
    const { timeline: rowsB, summary: sumB } = resBase.data;
    const { timeline: rowsE, summary: sumE } = resEv.data;
    // ① 成本行数恰 18、withdrawal = 30,000×1.02^t 逐行、行 2/21 = 0
    const costRows = rowsE.filter((r) => r.events.some((e) => e.kind === "childBirth"));
    assert.equal(costRows.length, 18, "L8① 成本行数恰 18（CHILD_COST_YEARS）");
    ok(rowsE[1].withdrawal === 0 && rowsE[20].withdrawal === 0, "L8① 行 2/行 21 支取 = 0（起止年推算落位）");
    for (let t = 3; t <= 20; t++) {
      near(rowsE[t - 1].withdrawal, 30000 * Math.pow(1.02, t), 0.01, `L8① 行 ${t} 支取 = 30,000×1.02^${t}`);
    }
    // ② 行 20 是成本末行且当行仍计成本（闭区间口径）
    near(rowsE[19].withdrawal, 44578.42, 0.01, "L8② 行 20 末行 44,578.42（闭区间含入）");
    ok(rowsE[19].events.length === 1 && rowsE[19].events[0].kind === "childBirth", "L8② 行 20 tag = childBirth");
    near(rowsE[19].events[0].annualCost, 44578.42, 0.01, "L8② tag annualCost = 行内名义值");
    // ③ fiFirstYear 基线 14 → 事件 20
    assert.equal(sumB.fiFirstYear, 14, "L8③ 基线 fiFirstYear 应 = 14");
    assert.equal(sumE.fiFirstYear, 20, "L8③ 事件 fiFirstYear 应 = 20");
    // ④ 行 21 Δ 增量 = Δ₂₀×0.045（成本止后差分只按回报复利，无新流出）
    const d20 = rowsE[19].closingAssets - rowsB[19].closingAssets;
    const d21 = rowsE[20].closingAssets - rowsB[20].closingAssets;
    near(d21 - d20 * 1.045, 0, 0.01, "L8④ 行 21 Δ 增量 = Δ₂₀×0.045");
    // ⑤ 孩子年龄映射：行 3 → 0 岁、行 20 → 17 岁、行 21 → 18 岁（不入账）
    assert.equal(rowsE[2].age, 32, "L8⑤ 行 3 行首年龄 32 = 孩子 0 岁");
    assert.equal(rowsE[19].age, 49, "L8⑤ 行 20 行首年龄 49 = 孩子 17 岁");
    assert.equal(rowsE[20].withdrawal, 0, "L8⑤ 行 21（孩子 18 岁）不入账");
    console.log("[check-lifecycle] L8 通过：成本行 [3,20] 恰 18 行、行 3 = 31,836.24 / 行 20 = 44,578.42 闭区间、fi 14→20");
  }

  // =========================================================================
  // P9 L9（算例③）：医疗阶段 10–15 年每年 +3 万（docs/p9-spec.md §4.1 / cases §3）
  // 独立推导：t₁ = 39−30+1 = 10、t₂ = 44−30+1 = 15（闭区间 [10,15] 恰 6 行，端点含入）；
  // 每行附加 30,000×1.02^t（行 10 = 36,569.83、行 15 = 40,376.05）；行 16 Δ 增量 =
  // Δ₁₅×0.045（区间外无新流出）；基线首达 14 → 事件 16（医疗段恰横跨基线首触年 14）。
  // A₀ = 500,000 全程 closing ＞ 0（min = 583,822.40 行 1——不触发耗尽）。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const mkInput = (events) => ({
      base: { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      ...(events ? { lifeEvents: events } : {}),
    });
    const mkHealth = (withLabel) => ({
      id: "p9-l9-health",
      kind: "healthPhase",
      age: 39,
      endAge: 44,
      annualAmount: 30000,
      ...(withLabel ? { label: "治疗期（本地备注）" } : {}),
    });
    const resBase = await calcLifecycle(mkInput());
    assert.equal(resBase.ok, true, "L9 前置：基线 calcLifecycle 应成功");
    const resEv = await calcLifecycle(mkInput([mkHealth(false)]));
    assert.equal(resEv.ok, true, "L9 前置：事件 calcLifecycle 应成功");
    const { timeline: rowsB, summary: sumB } = resBase.data;
    const { timeline: rowsE, summary: sumE } = resEv.data;
    // ① 区间界精确落位（端点含入）：行 9/16 = 0、行 10–15 = 30,000×1.02^t
    ok(rowsE[8].withdrawal === 0 && rowsE[15].withdrawal === 0, "L9① 行 9/行 16 支取 = 0（区间外零影响）");
    for (let t = 10; t <= 15; t++) {
      near(rowsE[t - 1].withdrawal, 30000 * Math.pow(1.02, t), 0.01, `L9① 行 ${t} 支取 = 30,000×1.02^${t}`);
      ok(rowsE[t - 1].events.length === 1 && rowsE[t - 1].events[0].kind === "healthPhase", `L9① 行 ${t} tag = healthPhase`);
    }
    near(rowsE[9].withdrawal, 36569.83, 0.01, "L9① 行 10 = 36,569.83");
    near(rowsE[14].withdrawal, 40376.05, 0.01, "L9① 行 15 = 40,376.05（末行）");
    // ② Δ 行 16 增量恰 = Δ₁₅×0.045（区间外无新流出）
    const d15 = rowsE[14].closingAssets - rowsB[14].closingAssets;
    const d16 = rowsE[15].closingAssets - rowsB[15].closingAssets;
    near(d16 - d15 * 1.045, 0, 0.01, "L9② 行 16 Δ 增量 = Δ₁₅×0.045");
    // ③ fiFirstYear 基线 14 → 事件 16
    assert.equal(sumB.fiFirstYear, 14, "L9③ 基线 fiFirstYear 应 = 14");
    assert.equal(sumE.fiFirstYear, 16, "L9③ 事件 fiFirstYear 应 = 16");
    // ④ phase 串不存在于契约（E3 重界）：label 不入引擎——有/无 label 时间线逐字节一致
    const resLabeled = await calcLifecycle(mkInput([mkHealth(true)]));
    assert.equal(resLabeled.ok, true, "L9④ 带 label 输入应成功");
    assert.equal(
      JSON.stringify(resLabeled.data.timeline),
      JSON.stringify(resEv.data.timeline),
      "L9④/E3 label 不入引擎：有/无 label 时间线逐字节一致",
    );
    // ⑤ 全程 closing ＞ 0（min = 583,822.40 行 1——事件流出自行 10 起，不触发耗尽）
    ok(rowsE.every((r) => r.closingAssets > 0), "L9⑤ 全程 closing ＞ 0");
    near(Math.min(...rowsE.map((r) => r.closingAssets)), 583822.4, 0.01, "L9⑤ min closing = 583,822.40（行 1）");
    console.log("[check-lifecycle] L9 通过：区间 [10,15] 端点含入、fi 14→16、label 存而不传不入引擎、全程不耗尽");
  }

  // =========================================================================
  // P9 L10（算例④）：收入增长 4% vs 0%（docs/p9-spec.md §4.1 / cases §4；E5 定稿式）
  // 独立推导：g=0 关闭分支 = 60,120×1.02^t（行 1 恰 61,322.40，P8 现状锚）；g=4% 开启
  // 分支 = 96,000×1.0608^t − 35,880×1.02^t（收入单独随 (1+i)(1+g) 上行、支出只随 i——
  // 「支出不联动」；行 1 = 101,836.80 − 36,597.60 = 65,239.20）。行 30 期末 6,616,453.35
  // vs 12,767,892.35（差恰 6,151,439.00）；fi 14 → 11（提前 3 行）；行 31+ 两路恒 0
  // （停工即止）；目标族与 g 无关（只改到达速度，不改购买力底线）。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const mkInput = (opts) => ({
      base: { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      ...(opts ? { opts } : {}),
    });
    const resG0 = await calcLifecycle(mkInput({ salaryGrowthPct: 0 }));
    const resG4 = await calcLifecycle(mkInput({ salaryGrowthPct: 4 }));
    assert.equal(resG0.ok, true, "L10 前置：g=0 calcLifecycle 应成功");
    assert.equal(resG4.ok, true, "L10 前置：g=4% calcLifecycle 应成功");
    const { timeline: rows0, summary: sum0 } = resG0.data;
    const { timeline: rows4, summary: sum4 } = resG4.data;
    // ① 储蓄行两式逐行（±0.01）：g=0 = 60,120×1.02^t；g=4% = 96,000×1.0608^t − 35,880×1.02^t
    for (let t = 1; t <= 30; t++) {
      near(rows0[t - 1].contribution, 60120 * Math.pow(1.02, t), 0.01, `L10① g=0 行 ${t} 储蓄 = 60,120×1.02^${t}`);
      near(rows4[t - 1].contribution, 96000 * Math.pow(1.0608, t) - 35880 * Math.pow(1.02, t), 0.01, `L10① g=4% 行 ${t} 储蓄闭式`);
    }
    near(rows0[0].contribution, 61322.4, 0.01, "L10① g=0 行 1 恰 61,322.40（P8 现状锚）");
    near(rows4[0].contribution, 65239.2, 0.01, "L10① g=4% 行 1 恰 65,239.20");
    // ② 行 30 期末两路 ＋ 差值恰锚
    near(rows0[29].closingAssets, 6616453.35, 0.01, "L10② g=0 行 30 期末 6,616,453.35");
    near(rows4[29].closingAssets, 12767892.35, 0.01, "L10② g=4% 行 30 期末 12,767,892.35");
    near(rows4[29].closingAssets - rows0[29].closingAssets, 6151439.0, 0.01, "L10② 两路差恰 6,151,439.00");
    // ③ fiFirstYear 14 → 11（g 增大只提前或不推迟——contribution 随 g 单调增）
    assert.equal(sum0.fiFirstYear, 14, "L10③ g=0 fiFirstYear 应 = 14");
    assert.equal(sum4.fiFirstYear, 11, "L10③ g=4% fiFirstYear 应 = 11（提前 3 行）");
    // ④ 行 31 起两路 contribution 恒 0（停工即止）
    ok(rows0.slice(30).every((r) => r.contribution === 0) && rows4.slice(30).every((r) => r.contribution === 0), "L10④ 行 31+ 两路储蓄恒 0");
    // ⑤ 目标族逐行相同（target×1.02^t 与 g 无关）——两路 targetValue 同源、判定只受
    //    closing 影响；g=0 行首触 14 恰为基线值即证（本行 + ③）
    // ⑥ g=0 关闭分支逐字节回归（§2.2-1 结构性承载）：缺省 opts 与显式 0 全输出一致
    const resDefault = await calcLifecycle(mkInput());
    assert.equal(resDefault.ok, true, "L10⑥ 前置：缺省 opts 应成功");
    assert.equal(
      JSON.stringify(resDefault.data),
      JSON.stringify(resG0.data),
      "L10⑥ 缺省 opts 与显式 salaryGrowthPct: 0 输出逐字节一致（关闭分支同一路径）",
    );
    console.log("[check-lifecycle] L10 通过：g=4% 储蓄闭式全链（65,239.20 / 12,767,892.35 / fi 14→11 / 停工即止）、g=0 逐字节回归");
  }

  // =========================================================================
  // P9 L11（算例⑤）：购买力底线口径 ＋ derivePurchasingPower（docs/p9-spec.md §4.1/§3.3）
  // A（FI 判定实口径）：r = i = 2 → R_t = 500,000 ＋ 60,120t 精确线性（工作段行 1–30）；
  //   fiFirstYear = 19（行 19 名义 2,392,491.85 ≥ 上行目标 2,382,177.63）；行 13 名义
  //   1,657,834.51 ≥ 基期名义目标 1,635,200 但判定必须未达标（名义错觉反例硬断言——
  //   实际购买力 1,281,560 仅达底线 78.4%，误用将提前 6 行误报）。
  //   注：行 31–40 为领取段净支取（34,104.36/1.02^t 实口径递减）→ 线性断言域限于
  //   工作段 t ≤ workEnd = 30（research §5 表断言行均 ≤ 19，同域）。
  // B（实口径恒值域）：p8 §3.4 输入 A 同形（A₀ 1,435,200 / 月收入 0 / r = i = 2 /
  //   targetRetireAge 30 → base 2.0/2.0 乘数族错误分支 → pensionMonthly 0 → 支取 =
  //   生活费全额）→ realWithdrawal = 35,880 恒值；minLiving 缺省 35,880 →
  //   withdrawalYears = 40、metShare = 1、gap = 0；minLiving = 40,000 → metShare = 0、
  //   gap = 40×(40,000−35,880) = 164,800。
  // C（域空哨兵）：targetRetireAge 75 → workEnd 45 ＞ horizon 40 → 全行 t ≤ workEnd
  //   → 支取域空 → withdrawalYears = 0、metShare = −1、gap = 0。
  // 变体 i = 0：cumInfl ≡ 1、实 = 名、底线退化为名义恒值（合法输入无除零）。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const baseRi2 = { ...BASELINE_DEFAULTS, nominalReturnPct: 2.0, inflationPct: 2.0 };
    const mkInput = (p = {}) => ({
      base: p.base ?? { ...BASELINE_DEFAULTS },
      accum: { ...ACCUMULATION_DEFAULTS, ...(p.accum ?? {}) },
      pension: { ...PENSION_DEFAULTS, ...(p.pension ?? {}) },
      loan,
      rental,
      ...(p.opts ? { opts: p.opts } : {}),
    });
    // ---- A：FI 判定实口径 ----
    const resA = await calcLifecycle(mkInput({ accum: { nominalReturnMeanPct: 2 } }));
    assert.equal(resA.ok, true, "L11-A 前置：calcLifecycle 应成功");
    const { timeline: rowsA, summary: sumA } = resA.data;
    assert.equal(sumA.fiFirstYear, 19, "L11① A fiFirstYear 应 = 19（实口径底线）");
    // ② R_t 精确线性（工作段 t ≤ 30；判定域与 research §5 同域）
    {
      let f = 1;
      for (let t = 1; t <= 30; t++) {
        f *= 1.02; // 与引擎同序的重复乘法（pow 与连乘可差 ULP，判定层禁两套口径）
        near(rowsA[t - 1].closingAssets / f, 500000 + 60120 * t, 0.01, `L11② A 行 ${t} R_t = 500,000 ＋ 60,120t`);
      }
    }
    // ③ 行 13 名义 ≥ 基期名义目标但判定必须未达标（错觉反例硬断言）
    near(rowsA[12].closingAssets, 1657834.51, 0.01, "L11③ 行 13 名义 1,657,834.51");
    ok(rowsA[12].closingAssets >= 1635200, "L11③ 行 13 名义 ≥ 基期名义目标 1,635,200（错觉前提成立）");
    ok(sumA.fiFirstYear !== 13 && sumA.fiFirstYear > 13, "L11③ 判定未在行 13 达标（禁用名义错觉判定）");
    near(rowsA[12].closingAssets / Math.pow(1.02, 13), 1281560.0, 0.01, "L11③ 行 13 实口径 R₁₃ = 1,281,560.00（仅达底线 78.4%）");
    // ④ 行 19 三锚（名义 / 实口径 / 上行目标）
    near(rowsA[18].closingAssets, 2392491.85, 0.01, "L11④ 行 19 名义 2,392,491.85");
    near(rowsA[18].closingAssets / Math.pow(1.02, 19), 1642280.0, 0.01, "L11④ 行 19 实口径 R₁₉ = 1,642,280.00");
    near(1635200 * Math.pow(1.02, 19), 2382177.63, 0.01, "L11④ 上行目标 2,382,177.63");
    ok(rowsA[18].closingAssets >= 1635200 * Math.pow(1.02, 19), "L11④ 行 19 达标（两等价判定同域）");
    // ---- B：实口径恒值域（乘数族错误分支 → pensionMonthly 0 → 支取 = 生活费全额）----
    const resB = await calcLifecycle(mkInput({
      base: baseRi2,
      accum: { currentAssets: 1435200, monthlyIncome: 0, nominalReturnMeanPct: 2, years: 40 },
      pension: { targetRetireAge: 30 },
    }));
    assert.equal(resB.ok, true, "L11-B 前置：calcLifecycle 应成功");
    assert.equal(resB.data.summary.pensionMonthly, 0, "L11-B 前置：乘数族错误分支 pensionMonthly = 0");
    const ppB = resB.data.summary.purchasingPower;
    for (let t = 1; t <= 40; t++) {
      near(resB.data.timeline[t - 1].realWithdrawal, 35880, 0.01, `L11④-B 行 ${t} realWithdrawal 恒值 35,880`);
    }
    assert.equal(ppB.withdrawalYears, 40, "L11④-B withdrawalYears 应 = 40");
    assert.equal(ppB.metShare, 1, "L11④-B metShare 应 = 1（恒值 ≥ 缺省最低生活线）");
    near(ppB.cumulativeGap, 0, 0.01, "L11④-B 缺省最低生活线 gap = 0");
    const resB40k = await calcLifecycle(mkInput({
      base: baseRi2,
      accum: { currentAssets: 1435200, monthlyIncome: 0, nominalReturnMeanPct: 2, years: 40 },
      pension: { targetRetireAge: 30 },
      opts: { minLivingAnnual: 40000 },
    }));
    assert.equal(resB40k.ok, true, "L11-B 变体前置：minLiving 40,000 应成功");
    const ppB40k = resB40k.data.summary.purchasingPower;
    assert.equal(ppB40k.withdrawalYears, 40, "L11④-B 变体 withdrawalYears 应 = 40");
    assert.equal(ppB40k.metShare, 0, "L11④-B 变体 metShare 应 = 0");
    near(ppB40k.cumulativeGap, 164800, 0.01, "L11④-B 变体 gap = 40×4,120 = 164,800");
    // ---- C：域空哨兵 ----
    const resC = await calcLifecycle(mkInput({ pension: { targetRetireAge: 75 } }));
    assert.equal(resC.ok, true, "L11-C 前置：calcLifecycle 应成功");
    const ppC = resC.data.summary.purchasingPower;
    assert.equal(ppC.withdrawalYears, 0, "L11⑤-C withdrawalYears 应 = 0（workEnd 45 ＞ horizon 40）");
    assert.equal(ppC.metShare, -1, "L11⑤-C metShare 应 = −1（域空未度量哨兵）");
    assert.equal(ppC.cumulativeGap, 0, "L11⑤-C 域空 gap = 0");
    // ---- 变体 i = 0：cumInfl ≡ 1、实 = 名 ----
    const resI0 = await calcLifecycle(mkInput({ accum: { inflationMeanPct: 0 } }));
    assert.equal(resI0.ok, true, "L11⑥ 前置：i = 0 应成功");
    ok(resI0.data.timeline.every((r) => r.realWithdrawal === r.withdrawal), "L11⑥ i=0 cumInfl ≡ 1、实 = 名（无除零路径）");
    console.log("[check-lifecycle] L11 通过：fi 19 ＋ 行 13 名义错觉反例、R_t 工作段线性、恒值域 metShare 1/0 ＋ gap 164,800、域空哨兵 −1、i=0 实=名");
  }

  // =========================================================================
  // P9 L12（算例⑥）：多事件重叠年叠加（docs/p9-spec.md §4.1 / cases §6；E1/E6 承载）
  // 独立推导：行 5 = (30,000＋1,200,000)×1.02⁵ = 1,358,019.39（合并闭式）；行 10–15 =
  // 60,000×1.02^t（行 10 = 73,139.67、行 15 = 80,752.10）；行 5 低谷 168,021.64 ＞ 0 →
  // fiFirstYear = −1 且 depletedYear = −1（不耗尽但永不达标，两哨兵并存）。
  // E1：childBirth 事件体不存金额——base.costPerChild 覆写 540,000（年成本 30,000）。
  // E6：行 5 = 两枚 tag（childBirth ＋ homePurchase）；行内 events[] 按 kind 字典序
  // 稳定排列（childBirth ＜ healthPhase ＜ homePurchase）——排列不变性在标记层逐字节
  // 成立（实现按 kind 固定序分组求和与装配 ⇒ f64 结合序固定）。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const evChild = { id: "p9-l12-child", kind: "childBirth", age: 32 };
    const evHome = { id: "p9-l12-home", kind: "homePurchase", age: 34, amount: 1200000 };
    const evHealth = { id: "p9-l12-health", kind: "healthPhase", age: 39, endAge: 44, annualAmount: 30000 };
    const mkInput = (events) => ({
      base: { ...BASELINE_DEFAULTS, costPerChild: 540000 },
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1000000 },
      pension: { ...PENSION_DEFAULTS },
      loan,
      rental,
      ...(events ? { lifeEvents: events } : {}),
    });
    const resBase = await calcLifecycle(mkInput());
    assert.equal(resBase.ok, true, "L12 前置：基线 calcLifecycle 应成功");
    const t12 = performance.now();
    const resAll = await calcLifecycle(mkInput([evChild, evHome, evHealth]));
    assert.equal(resAll.ok, true, "L12 前置：三事件 calcLifecycle 应成功");
    const perfAll = performance.now() - t12;
    const { timeline: rowsB } = resBase.data;
    const { timeline: rowsAll, summary: sumAll } = resAll.data;
    // ① 重叠行 withdrawal 恰合并闭式
    near(rowsAll[4].withdrawal, 1358019.39, 0.01, "L12① 行 5 = 1,230,000×1.02⁵ = 1,358,019.39");
    near(rowsAll[9].withdrawal, 73139.67, 0.01, "L12① 行 10 = 60,000×1.02^10 = 73,139.67");
    near(rowsAll[14].withdrawal, 80752.1, 0.01, "L12① 行 15 = 60,000×1.02^15 = 80,752.10");
    near(rowsAll[4].closingAssets, 168021.64, 0.01, "L12④ 行 5 低谷 168,021.64 ＞ 0");
    // ④ fiFirstYear = −1 且 depletedYear = −1（两哨兵并存）
    assert.equal(sumAll.fiFirstYear, -1, "L12④ fiFirstYear 应 = −1（永不达标）");
    assert.equal(sumAll.depletedYear, -1, "L12④ depletedYear 应 = −1（不耗尽）");
    // ② Δ 组合 = Δ房＋Δ育＋Δ医 逐行（叠加线性；research 实测最大差 3.7×10⁻⁹）
    const soloHome = (await calcLifecycle(mkInput([evHome]))).data.timeline;
    const soloChild = (await calcLifecycle(mkInput([evChild]))).data.timeline;
    const soloHealth = (await calcLifecycle(mkInput([evHealth]))).data.timeline;
    for (let t = 1; t <= 40; t++) {
      const combined = rowsAll[t - 1].closingAssets - rowsB[t - 1].closingAssets;
      const sum = (soloHome[t - 1].closingAssets - rowsB[t - 1].closingAssets)
        + (soloChild[t - 1].closingAssets - rowsB[t - 1].closingAssets)
        + (soloHealth[t - 1].closingAssets - rowsB[t - 1].closingAssets);
      near(combined, sum, 0.01, `L12② 行 ${t} Δ 组合 = Δ房＋Δ育＋Δ医`);
    }
    // ③ 三登记顺序 timeline 逐字节相等（含 events[] 标记层——kind 字典序稳定排列，E6）
    const canon = JSON.stringify(rowsAll);
    const permA = JSON.stringify((await calcLifecycle(mkInput([evHome, evChild, evHealth]))).data.timeline);
    const permB = JSON.stringify((await calcLifecycle(mkInput([evHealth, evHome, evChild]))).data.timeline);
    assert.equal(permA, canon, "L12③ 排列 (房,育,医) 与 (育,房,医) 逐字节相等");
    assert.equal(permB, canon, "L12③ 排列 (医,房,育) 与 (育,房,医) 逐字节相等");
    // ⑤ 行级 tag 计数全枚举（E6：行 5 两枚 child＋home）
    const kinds = (r) => r.events.map((e) => e.kind).join("+");
    assert.equal(kinds(rowsAll[2]), "childBirth", "L12⑤ 行 3 tag");
    assert.equal(kinds(rowsAll[3]), "childBirth", "L12⑤ 行 4 tag");
    assert.equal(kinds(rowsAll[4]), "childBirth+homePurchase", "L12⑤ 行 5 恰两枚（child＋home，E6）");
    for (let t = 6; t <= 9; t++) assert.equal(kinds(rowsAll[t - 1]), "childBirth", `L12⑤ 行 ${t} tag`);
    for (let t = 10; t <= 15; t++) assert.equal(kinds(rowsAll[t - 1]), "childBirth+healthPhase", `L12⑤ 行 ${t} 恰两枚（child＋health）`);
    for (let t = 16; t <= 20; t++) assert.equal(kinds(rowsAll[t - 1]), "childBirth", `L12⑤ 行 ${t} tag`);
    for (const t of [1, 2, 21, 30]) assert.equal(rowsAll[t - 1].events.length, 0, `L12⑤ 行 ${t} 无 tag`);
    ok(rowsAll.every((r) => Number.isFinite(r.realWithdrawal)), "L12 realWithdrawal 全程有限数");
    console.log(`[check-lifecycle] L12 通过：行 5 合并闭式 1,358,019.39、Δ 叠加线性、三序逐字节相等（E6）、两哨兵并存（含事件装配 ${perfAll.toFixed(1)} ms ≤ 50 ms 预算内实测值）`);
    ok(perfAll <= 50, `L12 含事件装配性能实测 ${perfAll.toFixed(1)} ms ≤ 50 ms（§9② 验收记录）`);
  }

  // =========================================================================
  // P9 L13（算例⑦）：P8 桥接组合 × 育儿（docs/p9-spec.md §4.1 / cases §7）
  // 独立推导（基线 = research-p8-cases §1 算例①手算表，跨文档对表）：A₀ = 1,706,225.60、
  // targetRetireAge 30 → workEnd 0、horizon 60；基线五行 1,746,408.15 / 1,787,666.97 /
  // 3,559,230.95 / 3,687,209.22 / 10,282,865.09。组合行 3–20 withdrawal = 65,880×1.02^t
  // （行 3 = 69,912.38、行 20 = 97,894.21——生活费 35,880＋育儿 30,000 同一通胀因子）；
  // 行 21–30 回基线支取式；行 31+ = max(0, 生活费 − 34,104.36)。ΔA₆₀ = −5,779,062.96
  // （10,282,865.09 → 4,503,802.13）。E1：base.costPerChild 覆写 540,000。
  // =========================================================================
  {
    const loan = { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" };
    const rental = { price: 1500000, downPaymentPct: 30, loanAnnualRatePct: 3.9, loanYears: 30, monthlyRent: 4000, vacancyRatePct: 5, maintenanceAnnualRatePct: 1, propertyFeeMonthly: 300, otherAnnualCost: 0, rentTaxRatePct: 5 };
    const mkInput = (events) => ({
      base: { ...BASELINE_DEFAULTS, costPerChild: 540000 },
      accum: { ...ACCUMULATION_DEFAULTS, currentAssets: 1706225.6, years: 60 },
      pension: { ...PENSION_DEFAULTS, targetRetireAge: 30 },
      loan,
      rental,
      ...(events ? { lifeEvents: events } : {}),
    });
    const resBase = await calcLifecycle(mkInput());
    assert.equal(resBase.ok, true, "L13 前置：基线 calcLifecycle 应成功");
    const resEv = await calcLifecycle(mkInput([{ id: "p9-l13-child", kind: "childBirth", age: 32 }]));
    assert.equal(resEv.ok, true, "L13 前置：组合 calcLifecycle 应成功");
    const { timeline: rowsB, summary: sumB } = resBase.data;
    const { timeline: rowsE, summary: sumE } = resEv.data;
    // ① bridgeYears 恒 30、pensionStart 恒行 31、pensionMonthly 恒 2,842.03（事件不触碰养老金族）
    assert.equal(sumE.bridgeYears, 30, "L13① bridgeYears 恒 30");
    assert.equal(sumE.pensionMonthly, 2842.03, "L13① pensionMonthly 恒 2,842.03");
    ok(rowsE[30].pensionStart, "L13① pensionStart 恒行 31");
    near(sumE.pensionMonthly, 2842.03, 0.01, "L13① pensionMonthly ±0.01");
    // ② 基线五行逐值 = P8 §1 表 ±0.01（跨文档手算对表）
    near(rowsB[0].closingAssets, 1746408.15, 0.01, "L13② 基线行 1 = 1,746,408.15");
    near(rowsB[1].closingAssets, 1787666.97, 0.01, "L13② 基线行 2 = 1,787,666.97");
    near(rowsB[29].closingAssets, 3559230.95, 0.01, "L13② 基线行 30 = 3,559,230.95");
    near(rowsB[30].closingAssets, 3687209.22, 0.01, "L13② 基线行 31 = 3,687,209.22");
    near(rowsB[59].closingAssets, 10282865.09, 0.01, "L13② 基线行 60 = 10,282,865.09");
    // ③ 行 3–20 withdrawal = 65,880×1.02^t、行 21 起回基线支取式
    for (let t = 3; t <= 20; t++) {
      near(rowsE[t - 1].withdrawal, 65880 * Math.pow(1.02, t), 0.01, `L13③ 行 ${t} 支取 = 65,880×1.02^${t}（生活费＋育儿同一因子）`);
    }
    for (let t = 21; t <= 60; t++) {
      const living = 35880 * Math.pow(1.02, t);
      near(rowsE[t - 1].withdrawal, t >= 31 ? Math.max(0, living - 34104.36) : living, 0.01, `L13③ 行 ${t} 回基线支取式`);
    }
    near(rowsE[2].withdrawal, 69912.38, 0.01, "L13③ 行 3 = 69,912.38");
    near(rowsE[19].withdrawal, 97894.21, 0.01, "L13③ 行 20 = 97,894.21（成本末行）");
    // ④ ΔA₆₀ 恰锚
    near(rowsE[59].closingAssets, 4503802.13, 0.01, "L13④ 组合 A₆₀ = 4,503,802.13");
    near(rowsE[59].closingAssets - rowsB[59].closingAssets, -5779062.96, 0.01, "L13④ ΔA₆₀ = −5,779,062.96");
    // ⑤ 全 60 行 closing ＞ 0 且 fiFirstYear = 0（期初已达标，事件不回写）
    ok(rowsE.every((r) => r.closingAssets > 0), "L13⑤ 全 60 行 closing ＞ 0");
    assert.equal(sumE.fiFirstYear, 0, "L13⑤ fiFirstYear = 0（t=0 判定，事件不回写）");
    console.log("[check-lifecycle] L13 通过：基线五行 = P8 §1 跨文档对表、行 3–20 = 65,880×1.02^t、ΔA₆₀ = −5,779,062.96、养老金族零触碰");
  }

  console.log(`[check-lifecycle] L1–L13 全部通过（断言 ${passed} 项 + 逐行断言若干）。`);
} finally {
  rmSync(BUNDLE_TMP, { force: true });
}
