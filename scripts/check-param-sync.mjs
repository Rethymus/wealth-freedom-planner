#!/usr/bin/env node
/**
 * ============================================================================
 * 共享参数单源化确定性检查（p10fix-spec.md §6.1；npm run check:paramsync。
 * 零新依赖——esbuild 随 vite 在依赖树内，先例 scripts/check-data.mjs:45-67 loadModule /
 * scripts/check-share.mjs:32-42）
 * ============================================================================
 *
 * 同步态（四组级布尔默认 true）下各面板有效输入 = 核心参数派生。三机制：
 *  机制 A（行为断言，裁决路径）六组——期望值全部由注释内算式独立推导（禁魔法数，
 *    check-data 纪律）：
 *    ① effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, BASELINE_DEFAULTS, true) 深相等
 *      { childReserve = 0×580000 = 0, healthReserve = 200000, majorInvestment = 0,
 *        nominalReturnPct = 4.5, inflationPct = 2.0 }（defaults.ts 在册值代入）；
 *    ② 预设夹具：family_one_kid（presets.ts：childCount 1 × costPerChild 580000）
 *      → childReserve 派生 = 580000；single_renter（childCount 0）→ 0；
 *    ③ effectiveMonteCarlo(MONTE_CARLO_DEFAULTS, BASELINE_DEFAULTS, {means,spend}) →
 *      annualSpend = 2990×12 = 35880、均值 4.5 / 2.0（currentAssets 不耦合直通）；
 *    ④ effectiveAccumulationSim(ACCUMULATION_DEFAULTS, BASELINE_DEFAULTS, {…}) →
 *      2990 / 4.5 / 2.0（targetValue / currentAssets 不耦合直通）；
 *    ⑤ 解锁语义：标志 false → 有效输入 ≡ 面板切片原值（改 baseline 不漂移）；
 *    ⑥ 解锁快照函数返回当刻核心值（unlockMeans 语义同构断言）。
 *  机制 B（接线存在性，可 grep 复核）——正则断言面板源码（每条附 file:line 注）：
 *    calcReverse(effectiveReverse(  两调用点、calcMonteCarlo(effectiveInputs) 提交帧、
 *    value={reverseSynced ? / value={mcMeansSynced ? / value={mcSpendSynced ? /
 *    value={accExpenseSynced ? / value={accMeansSynced ? 锁态派生直显在位。
 *  机制 C（E5 回归）——读 global.css 文本：margin-left: 0 !important 规则在
 *    .wf-adv-tabs .arco-tabs-content-inner 选择器块内、全文零 .arco-tabs-tabpane 残留。
 *
 * 通过判据：exit 0，输出 14 行 PASS 表（= p10fix-spec §3.1 普查行逐行对账）。
 * 不载 zustand store（顶层 readInitialPrefs() 触碰 window，Node 内不可挂载——纯模块
 * 独立可测正是抽 effectiveInputs.ts 的动机）。
 *
 * 用法：node scripts/check-param-sync.mjs（或 npm run check:paramsync）
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { transformSync } from "esbuild";

// ---------------------------------------------------------------------------
// 1) 转译加载（effectiveInputs.ts 为纯函数模块——import type 全部类型层，转译后零
//    运行时依赖；defaults.ts 运行时依赖 pensionParams / taxTables 随 deps 一并转译，
//    Node ESM 显式扩展名按 check-data 同款改写）
// ---------------------------------------------------------------------------
const tmpDirs = [];

async function loadModule(rel, name, deps = []) {
  const dir = mkdtempSync(join(tmpdir(), `wf-check-paramsync-${name}-`));
  tmpDirs.push(dir);
  for (const dep of deps) {
    const depSource = readFileSync(new URL(dep.rel, import.meta.url), "utf8");
    const { code: depCode } = transformSync(depSource, {
      loader: "ts",
      format: "esm",
      target: "es2020",
    });
    writeFileSync(join(dir, `${dep.name}.mjs`), depCode, "utf8");
  }
  const source = readFileSync(new URL(rel, import.meta.url), "utf8");
  let { code } = transformSync(source, { loader: "ts", format: "esm", target: "es2020" });
  if (deps.length > 0) {
    code = code.replace(/from "\.\/pensionParams"/g, 'from "./pensionParams.mjs"');
    code = code.replace(/from "\.\/taxTables"/g, 'from "./taxTables.mjs"');
  }
  const outFile = join(dir, `${name}.mjs`);
  writeFileSync(outFile, code, "utf8");
  return { mod: await import(pathToFileURL(outFile).href), dir };
}

function cleanup() {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
}

function readSrc(rel) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

/** 14 行 PASS 表（§3.1 普查行逐行对账；打印前按普查行号升序对账） */
const passRows = [];
function pass(row, detail) {
  passRows.push([Number(row), `  PASS #${row}  ${detail}`]);
}

try {
  const { mod: eff, dir: dirEff } = await loadModule("../src/store/effectiveInputs.ts", "effectiveInputs");
  const { mod: defaults, dir: dirDefaults } = await loadModule("../src/data/defaults.ts", "defaults", [
    { rel: "../src/data/pensionParams.ts", name: "pensionParams" },
    { rel: "../src/data/taxTables.ts", name: "taxTables" },
  ]);
  const { mod: presets } = await loadModule("../src/data/presets.ts", "presets");

  const {
    BASELINE_DEFAULTS,
    MONTE_CARLO_DEFAULTS,
    ACCUMULATION_DEFAULTS,
    REVERSE_ESTIMATE_DEFAULTS,
  } = defaults;
  const { PRESET_PROFILES } = presets;
  const {
    effectiveReverse,
    effectiveMonteCarlo,
    effectiveAccumulationSim,
    reverseUnlockPatch,
  } = eff;

  // ---------------------------------------------------------------------------
  // 机制 A ①：effectiveReverse 默认值深相等（算式：childReserve = childCount(0) ×
  // costPerChild(580000) = 0；其余四字段直取 baseline 同名值——defaults.ts :41-46/:97-101）
  // ---------------------------------------------------------------------------
  {
    const eff1 = effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, BASELINE_DEFAULTS, true);
    const expected = {
      totalAssets: REVERSE_ESTIMATE_DEFAULTS.totalAssets, // 非重复字段直通
      childReserve: BASELINE_DEFAULTS.childCount * BASELINE_DEFAULTS.costPerChild, // 0×580000 = 0
      healthReserve: BASELINE_DEFAULTS.healthReserve, // 200000
      majorInvestment: BASELINE_DEFAULTS.majorInvestment, // 0
      nominalReturnPct: BASELINE_DEFAULTS.nominalReturnPct, // 4.5
      inflationPct: BASELINE_DEFAULTS.inflationPct, // 2.0
    };
    assert.deepEqual(eff1, expected, "A① 失败：effectiveReverse 默认锁态深相等");
    // 逐行对账 #1–#5
    pass("1", `reverse.childReserve 派生 = childCount×costPerChild = ${BASELINE_DEFAULTS.childCount}×${BASELINE_DEFAULTS.costPerChild} = ${expected.childReserve}`);
    pass("2", `reverse.healthReserve 直取 baseline = ${expected.healthReserve}`);
    pass("3", `reverse.majorInvestment 直取 baseline = ${expected.majorInvestment}`);
    pass("4", `reverse.nominalReturnPct 直取 baseline = ${expected.nominalReturnPct}`);
    pass("5", `reverse.inflationPct 直取 baseline = ${expected.inflationPct}`);
  }

  // ---------------------------------------------------------------------------
  // 机制 A ②：预设夹具联动（U2 判据——预设后无与预设矛盾的参数残留）
  //   family_one_kid：childCount 1 × costPerChild 580000 → 派生 580000（presets.ts :66）
  //   single_renter：childCount 0 → 派生 0（presets.ts :50）
  // ---------------------------------------------------------------------------
  {
    const familyOneKid = PRESET_PROFILES.find((p) => p.id === "family_one_kid");
    const singleRenter = PRESET_PROFILES.find((p) => p.id === "single_renter");
    assert.ok(familyOneKid && singleRenter, "A② 失败：预设夹具缺失");
    assert.equal(
      familyOneKid.baseline.childCount * familyOneKid.baseline.costPerChild,
      580000,
      "A② 失败：family_one_kid 派生算式 1×580000 = 580000",
    );
    const effFamily = effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, { ...BASELINE_DEFAULTS, ...familyOneKid.baseline }, true);
    assert.equal(effFamily.childReserve, 580000, "A② 失败：一孩派生应 = 580000");
    const effSingle = effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, { ...BASELINE_DEFAULTS, ...singleRenter.baseline }, true);
    assert.equal(effSingle.childReserve, 0, "A② 失败：零孩派生应 = 0（childCount=0 → 0，字段恒在不隐藏）");
    assert.equal(effSingle.totalAssets, REVERSE_ESTIMATE_DEFAULTS.totalAssets, "A② 失败：totalAssets 恒直通");
  }

  // ---------------------------------------------------------------------------
  // 机制 A ③：effectiveMonteCarlo（算式：annualSpend = monthlyExpense(2990) × 12 =
  // 35880；均值 = baseline 4.5 / 2.0；currentAssets 不在耦合集——普查 #13 裁定不联动）
  // ---------------------------------------------------------------------------
  {
    const effMc = effectiveMonteCarlo(MONTE_CARLO_DEFAULTS, BASELINE_DEFAULTS, { means: true, spend: true });
    assert.equal(effMc.annualSpend, BASELINE_DEFAULTS.monthlyExpense * 12, "A③ 失败：annualSpend = 2990×12 = 35880");
    assert.equal(effMc.annualSpend, 35880, "A③ 失败：annualSpend 在册值 35880");
    assert.equal(effMc.nominalReturnMeanPct, BASELINE_DEFAULTS.nominalReturnPct, "A③ 失败：回报均值直取 baseline");
    assert.equal(effMc.inflationMeanPct, BASELINE_DEFAULTS.inflationPct, "A③ 失败：通胀均值直取 baseline");
    assert.equal(effMc.currentAssets, MONTE_CARLO_DEFAULTS.currentAssets, "A③ 失败：currentAssets 不耦合直通（#13）");
    assert.equal(effMc.nominalReturnStdPct, MONTE_CARLO_DEFAULTS.nominalReturnStdPct, "A③ 失败：非耦合键直通");
    pass("10", `monteCarlo.annualSpend = monthlyExpense×12 = ${BASELINE_DEFAULTS.monthlyExpense}×12 = ${effMc.annualSpend}`);
    pass("11", `monteCarlo.nominalReturnMeanPct 直取 baseline = ${effMc.nominalReturnMeanPct}（mcMeansSynced 既有机制回归锚）`);
    pass("12", `monteCarlo.inflationMeanPct 直取 baseline = ${effMc.inflationMeanPct}（同上）`);
    pass("13", `monteCarlo.currentAssets 不联动裁定锚 = ${effMc.currentAssets}（切片原值直通）`);
  }

  // ---------------------------------------------------------------------------
  // 机制 A ④：effectiveAccumulationSim（算式：monthlyExpense 直取 2990、两均值 4.5/2.0；
  // targetValue / currentAssets 不在耦合集——普查 #7 不迁移、#14 裁定不联动）
  // ---------------------------------------------------------------------------
  {
    const effAcc = effectiveAccumulationSim(ACCUMULATION_DEFAULTS, BASELINE_DEFAULTS, { expense: true, means: true });
    assert.equal(effAcc.monthlyExpense, BASELINE_DEFAULTS.monthlyExpense, "A④ 失败：monthlyExpense 直取 baseline = 2990");
    assert.equal(effAcc.nominalReturnMeanPct, BASELINE_DEFAULTS.nominalReturnPct, "A④ 失败：回报均值直取 baseline");
    assert.equal(effAcc.inflationMeanPct, BASELINE_DEFAULTS.inflationPct, "A④ 失败：通胀均值直取 baseline");
    assert.equal(effAcc.targetValue, ACCUMULATION_DEFAULTS.targetValue, "A④ 失败：targetValue 不迁移（#7 accumulationTargetSynced 既有联动零变化）");
    assert.equal(effAcc.currentAssets, ACCUMULATION_DEFAULTS.currentAssets, "A④ 失败：currentAssets 不联动直通（#14）");
    pass("6", `accumulation.monthlyExpense 直取 baseline = ${effAcc.monthlyExpense}`);
    pass("8", `accumulation.nominalReturnMeanPct 直取 baseline = ${effAcc.nominalReturnMeanPct}`);
    pass("9", `accumulation.inflationMeanPct 直取 baseline = ${effAcc.inflationMeanPct}`);
    pass("7", `accumulation.targetValue 不迁移回归锚 = ${effAcc.targetValue}（accumulationTargetSynced 既有机制零变化）`);
    pass("14", `accumulation.currentAssets 不联动裁定锚 = ${effAcc.currentAssets}（切片原值直通）`);
  }

  // ---------------------------------------------------------------------------
  // 机制 A ⑤：解锁语义——标志 false → 有效输入 ≡ 面板切片原值（改 baseline 不漂移）；
  // 混合态（部分锁定）只覆盖锁定键
  // ---------------------------------------------------------------------------
  {
    const slicedReverse = { ...REVERSE_ESTIMATE_DEFAULTS, childReserve: 123, nominalReturnPct: 9.9 };
    const unlockedBaseline = { ...BASELINE_DEFAULTS, nominalReturnPct: 8.8 };
    const effUnlocked = effectiveReverse(slicedReverse, unlockedBaseline, false);
    assert.deepEqual(effUnlocked, slicedReverse, "A⑤ 失败：解锁态有效输入 ≡ 切片原值");
    const effMixed = effectiveMonteCarlo(
      { ...MONTE_CARLO_DEFAULTS, nominalReturnMeanPct: 7.7 },
      unlockedBaseline,
      { means: false, spend: true },
    );
    assert.equal(effMixed.nominalReturnMeanPct, 7.7, "A⑤ 失败：解锁键不受 baseline 影响");
    assert.equal(effMixed.annualSpend, unlockedBaseline.monthlyExpense * 12, "A⑤ 失败：锁定键仍派生");
  }

  // ---------------------------------------------------------------------------
  // 机制 A ⑥：解锁快照函数返回当刻核心值（unlockMeans 语义同构——解锁动作同时把当刻
  // 核心值落入切片，消除「解锁即见旧值」错位。P10fix 降档：模块仅保留
  // reverseUnlockPatch（五字段派生算式唯一处）；MC/Acc 快照内联于面板 handler，
  // 由下方机制 B「解锁快照接线」断言承载）
  // ---------------------------------------------------------------------------
  {
    const snapBaseline = { ...BASELINE_DEFAULTS, nominalReturnPct: 6.0, inflationPct: 3.0, monthlyExpense: 4200 };
    assert.deepEqual(
      reverseUnlockPatch(snapBaseline),
      {
        childReserve: snapBaseline.childCount * snapBaseline.costPerChild,
        healthReserve: snapBaseline.healthReserve,
        majorInvestment: snapBaseline.majorInvestment,
        nominalReturnPct: 6.0,
        inflationPct: 3.0,
      },
      "A⑥ 失败：reverseUnlockPatch 应返回当刻核心值",
    );
  }

  rmSync(dirEff, { recursive: true, force: true });
  rmSync(dirDefaults, { recursive: true, force: true });

  // ---------------------------------------------------------------------------
  // 机制 B：接线存在性（正则断言面板源码；每条附 file:line 注释。
  // P10fix 施工形态：字段 value 直读「显示对象」（disp / effectiveInputs / effAcc，
  // = effectiveX(src, baseline, flags) 的返回值——锁态派生值、解锁态切片原值），
  // disabled 由组级布尔承载）
  // ---------------------------------------------------------------------------
  const reversePanelSrc = readSrc("../src/components/advanced/ReversePanel.tsx");
  const mcPanelSrc = readSrc("../src/components/advanced/MonteCarloPanel.tsx");
  const accPanelSrc = readSrc("../src/components/advanced/AccumulationPanel.tsx");

  // calcReverse(effectiveReverse( 两调用点（ReversePanel useFinanceCall + ReverseCard useFinanceCall，
  // runner 内取当刻 baseline 现值——「同一值、同一帧」）
  assert.ok(
    (reversePanelSrc.match(/calcReverse\(effectiveReverse\(/g) ?? []).length >= 2,
    "B 失败：calcReverse(effectiveReverse( 应恰有 ReversePanel/ReverseCard 两调用点（ReversePanel.tsx useFinanceCall ×2）",
  );
  // calcMonteCarlo(effectiveInputs) 提交帧（MonteCarloPanel run()，先例同构）
  assert.ok(
    mcPanelSrc.includes("calcMonteCarlo(effectiveInputs)"),
    "B 失败：calcMonteCarlo(effectiveInputs) 提交帧应在位（MonteCarloPanel.tsx run()）",
  );
  // 锁态派生直显：字段 value 直读显示对象（锁态五字段 = baseline 派生）
  assert.ok(
    reversePanelSrc.includes("const disp = effectiveReverse(") && (reversePanelSrc.match(/value=\{disp\./g) ?? []).length >= 5,
    "B 失败：ReverseFields 五字段 value={disp.*} 直读显示对象应在位（ReversePanel.tsx ReverseFields，普查 #1–#5）",
  );
  assert.ok(
    reversePanelSrc.includes("import { effectiveReverse, reverseUnlockPatch }"),
    "B 失败：ReversePanel 应消费 effectiveInputs.ts 派生模块（effectiveReverse + reverseUnlockPatch 快照）",
  );
  assert.ok(
    (mcPanelSrc.match(/value=\{effectiveInputs\./g) ?? []).length >= 3,
    "B 失败：value={effectiveInputs.*} 直读应在位（两均值 + 年支出，普查 #10/#11/#12）",
  );
  assert.ok(
    (accPanelSrc.match(/value=\{effAcc\./g) ?? []).length >= 4,
    "B 失败：value={effAcc.*} 直读应在位（月开销 + 两均值正推/反推，普查 #6/#8/#9）",
  );
  // disabled 锁定承载（组级布尔逐面板在位）
  assert.ok(
    reversePanelSrc.includes("disabled={reverseSynced}") &&
      mcPanelSrc.includes("disabled={mcSpendSynced}") &&
      (mcPanelSrc.match(/disabled=\{mcMeansSynced\}/g) ?? []).length >= 2 &&
      accPanelSrc.includes("disabled={accExpenseSynced}") &&
      (accPanelSrc.match(/disabled=\{accMeansSynced\}/g) ?? []).length >= 3,
    "B 失败：五处组级布尔 disabled 锁定承载应在位（reverse ×5 / mcSpend / mcMeans ×2 / accExpense / accMeans ×3）",
  );
  assert.ok(
    accPanelSrc.includes("effectiveAccumulationSim(inputs, baseline"),
    "B 失败：AccumulationPanel 有效输入经 effectiveAccumulationSim 派生（显示/运行同源）",
  );
  assert.ok(
    accPanelSrc.includes("accumulationTargetSynced"),
    "B 失败：#7 accumulationTargetSynced 既有联动接线保持（回归锚，不迁移零变化）",
  );
  // 机制 B 补充：解锁快照接线（unlockMeans 语义同构——解锁动作同时把当刻核心值落入切片。
  // P10fix 降档登记：MC/Acc 快照为面板内联当刻核心值字面量、reverse 经模块
  // reverseUnlockPatch——派生算式唯一处）
  assert.ok(
    mcPanelSrc.includes("setInputs({ nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct })") &&
      mcPanelSrc.includes("setInputs({ annualSpend: baseline.monthlyExpense * 12 })") &&
      accPanelSrc.includes("setInputs({ monthlyExpense: baseline.monthlyExpense })") &&
      accPanelSrc.includes("setInputs({ nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct })") &&
      reversePanelSrc.includes("setInputs(reverseUnlockPatch(baseline))"),
    "B 失败：五处解锁快照（当刻核心值落切片）应在位（消除解锁即见旧值错位）",
  );
  // 机制 A ⑥ 补充：reverseUnlockPatch 快照函数返回当刻核心值（unlockMeans 语义同构；
  // MC/Acc 快照内联于面板 handler，由上方机制 B 断言承载）
  {
    const snapBaseline = { ...BASELINE_DEFAULTS, nominalReturnPct: 6.0, inflationPct: 3.0 };
    assert.deepEqual(
      eff.reverseUnlockPatch(snapBaseline),
      {
        childReserve: snapBaseline.childCount * snapBaseline.costPerChild,
        healthReserve: snapBaseline.healthReserve,
        majorInvestment: snapBaseline.majorInvestment,
        nominalReturnPct: 6.0,
        inflationPct: 3.0,
      },
      "A⑥ 失败：reverseUnlockPatch 应返回当刻核心值",
    );
  }

  // ---------------------------------------------------------------------------
  // 机制 C：E5 回归（global.css 静态断言）
  // ---------------------------------------------------------------------------
  const cssSrc = readSrc("../src/styles/global.css");
  // margin-left: 0 !important 规则在 .wf-adv-tabs .arco-tabs-content-inner 选择器块内
  const neutralBlock = cssSrc.match(
    /\.wf-adv-tabs \.arco-tabs-content-inner \{[^}]*margin-left: 0 !important;[^}]*\}/,
  );
  assert.ok(
    neutralBlock !== null,
    "C 失败：.wf-adv-tabs .arco-tabs-content-inner { margin-left: 0 !important } 中性化规则应在位（global.css，E5 主因修复）",
  );
  // 全文零 .arco-tabs-tabpane 死选择器残留（E5 次因：组件库实际类名 .arco-tabs-pane；
  // 剥离 /* */ 注释后检查——登记注记行内的历史名不计数）
  const cssCode = cssSrc.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(
    !cssCode.includes(".arco-tabs-tabpane"),
    "C 失败：global.css 应零 .arco-tabs-tabpane 死选择器残留（组件库实际类名为 .arco-tabs-pane，tab-pane.js:33）",
  );

  cleanup();
  passRows.sort((a, b) => a[0] - b[0]);
  assert.equal(passRows.length, 14, "对账失败：PASS 表应为 14 行（§3.1 普查 #1–#14 逐行）");
  console.log("[check-param-sync] 机制 A 行为断言六组 + 机制 B 接线存在性 + 机制 C E5 回归全部通过；");
  console.log("[check-param-sync] 14 行普查对账表（p10fix-spec §3.1 逐行）：");
  for (const row of passRows) console.log(row[1]);
} catch (e) {
  cleanup();
  throw e;
}
