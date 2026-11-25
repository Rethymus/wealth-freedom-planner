#!/usr/bin/env node
/**
 * ============================================================================
 * 数据层校准断言（wf01-spec.md §4；校准清单 8 项中 ①②③⑥ 的机读镜像。
 * 零新依赖——esbuild 随 vite 在依赖树内，先例 scripts/check-share.mjs:33-40 /
 * scripts/check-currency.mjs；人读台账镜像 docs/data-dictionary.md，两处键一一映射）
 * ============================================================================
 *
 * 经 esbuild 转译后在 Node 内以 node:assert 断言九组：
 *  A 消费口径——面板两环 2,456/29,476 与 2,989/35,869 在位、默认 2,990 取整口径注在位、
 *    三语 marketNote 同步、README 双语 2025 年口径落位（34,557/2,880 清零）；
 *  B 480 与首屏临界——12 ÷ 0.025 = 480 严格相等；2990×480+200,000 = 1,635,200 且
 *    与 ACCUMULATION_DEFAULTS.targetValue 全等；
 *  C MC 年支出——MONTE_CARLO_DEFAULTS.annualSpend = 2990×12 = 35,880；
 *  D 费雪双口径——近似 480（容差断言，见下偏差注）、精确 489.6、精确临界 1,663,904、
 *    realReturnAssumpPct = 4.5 − 2.0 = 2.5；
 *  E 预设自洽——四画像 breakdown 五项和 === monthlyExpense（4500/8000/11000/2000）、
 *    四画像 costPerChild === 580000；
 *  F 育儿双口径标注——defaults.ts costPerChild 行 ±2 行含「视频口径」、presets 一孩
 *    note 含 53.8 对照、展示层全国 53.8、三语 tooltip/hint 统一 0–17 且全键无 0–18 残留、
 *    README 默认值免责行含 53.8；
 *  G 社保环锚定——chainSsf value "7.39%" 与 official 同源、scope 含「至 2024 年末」
 *    与 7.62 更新口径、不含「最新」、insights 全文零收益承诺式命中；
 *  H 算例 B 更正——480 法则直除复算 10,000；三语 exampleBNote 差异注在位；
 *  I 假设区间标注——chainNominal 为 video 假设口径（禁「研究表明/历史平均」）、
 *    nominalReturnPct = 4.5、三语折叠头含 4.5%。
 *
 * 独立推导纪律：全部数值期望在注释中写明算式（不许「魔法期望数」），可运行处直接运行。
 *
 * 与 wf01-spec §4 表的三处实施偏差（如实登记，台账 data-dictionary.md 同步）：
 *  1. 组 D 近似式：spec 写 `12/(0.045-0.02)===480` 严格相等，IEEE-754 实测为
 *     480.00000000000006（本会话 node -e 复算），严格相等不成立——按表内「（近似口径）」
 *     语义落 1e-9 容差断言；
 *  2. 组 A marketNote：en 文案为英文（"rounded from the urban figure"），断言按
 *     en 含 "rounded" 落锁（zh-CN/zh-Hant 仍断「取整」汉字）；
 *  3. 组 H exampleBNote：zh-Hant 为逐词繁体（「萬」非「万」），按 locale 分别断言。
 *
 * 用法：node scripts/check-data.mjs（或 npm run check:data）
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { transformSync } from "esbuild";

// ---------------------------------------------------------------------------
// 1) 转译加载（纯数据模块零运行时依赖路径；deps：随主模块一并转译进同一临时目录的
//    运行时依赖。Node ESM 要求显式扩展名——defaults.ts 转译后保留的说明符
//    "./pensionParams" 按同相对路径改写为 "./pensionParams.mjs" 再落盘）
// ---------------------------------------------------------------------------
const tmpDirs = [];

async function loadModule(rel, name, deps = []) {
  const dir = mkdtempSync(join(tmpdir(), `wf-check-data-${name}-`));
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
    // 骨架修复轮（F6）：taxTables 依赖说明符同步补 .mjs 扩展（Node ESM 显式扩展名）
    code = code.replace(/from "\.\/taxTables"/g, 'from "./taxTables.mjs"');
  }
  const outFile = join(dir, `${name}.mjs`);
  writeFileSync(outFile, code, "utf8");
  return { mod: await import(pathToFileURL(outFile).href), dir };
}

function cleanup() {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v, path));
    else out[path] = String(v);
  }
  return out;
}

try {
  // ---------------------------------------------------------------------------
  // 2) 夹具与源码文本（README / 源码注释类断言只锚定文本落位，不执行）
  // ---------------------------------------------------------------------------
  const { mod: defaults } = await loadModule("../src/data/defaults.ts", "defaults", [
    { rel: "../src/data/pensionParams.ts", name: "pensionParams" },
    // 骨架修复轮（F6）：defaults 播种中国税表——taxTables 入 deps（defaults.ts 新增
    // `from "./taxTables"` 导入；转译产物为 ESM，须同目录携带该依赖）
    { rel: "../src/data/taxTables.ts", name: "taxTables" },
  ]);
  const { mod: presets } = await loadModule("../src/data/presets.ts", "presets");
  const { mod: insights } = await loadModule("../src/data/insights.ts", "insights");

  const {
    BASELINE_DEFAULTS,
    MONTE_CARLO_DEFAULTS,
    MONTE_CARLO_STRATEGY_DEFAULTS,
    ACCUMULATION_DEFAULTS,
  } = defaults;
  const { PRESET_PROFILES } = presets;
  const {
    INSIGHT_CHAIN_STEPS,
    INSIGHT_MARKET_ENTRIES,
    INSIGHT_CHILD_COST_REGIONS,
    INSIGHT_HEALTH_ENTRIES,
  } = insights;

  const flats = {};
  for (const [locale, rel] of [
    ["zh-CN", "../src/i18n/locales/zh-CN.ts"],
    ["zh-Hant", "../src/i18n/locales/zh-Hant.ts"],
    ["en", "../src/i18n/locales/en.ts"],
  ]) {
    const { mod, dir } = await loadModule(rel, `i18n-${locale}`);
    flats[locale] = flatten(mod.default);
    rmSync(dir, { recursive: true, force: true });
  }

  const defaultsSource = readFileSync(new URL("../src/data/defaults.ts", import.meta.url), "utf8");
  const insightsSource = readFileSync(new URL("../src/data/insights.ts", import.meta.url), "utf8");
  const readmeZh = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const readmeEn = readFileSync(new URL("../README.en.md", import.meta.url), "utf8");

  // ---- 组 A 消费口径 -------------------------------------------------------
  // 独立推导：官方仅发布年值，折月 = 年值 ÷ 12 的派生算术（不得写成官方月度数据）。
  // 29,476 ÷ 12 = 2,456.333… → 面板展示 2,456 元/月
  // 35,869 ÷ 12 = 2,989.083… → 面板展示 2,989 元/月；默认 2,990 = 2,989 取整到十位
  assert.ok(Math.abs(29476 / 12 - 2456.3333) < 0.001, "断言 A0 失败：29476/12 应 ≈ 2456.33");
  assert.ok(Math.abs(35869 / 12 - 2989.0833) < 0.001, "断言 A0 失败：35869/12 应 ≈ 2989.08");
  const marketNat = INSIGHT_MARKET_ENTRIES[0];
  const marketUrb = INSIGHT_MARKET_ENTRIES[1];
  assert.ok(
    marketNat.value.includes("2,456") && marketNat.value.includes("29,476"),
    "断言 A1 失败：市场参考[0] 应含全国年值 29,476 与折月 2,456",
  );
  assert.ok(
    marketUrb.value.includes("2,989") && marketUrb.value.includes("35,869"),
    "断言 A2 失败：市场参考[1] 应含城镇年值 35,869 与折月 2,989",
  );
  assert.ok(
    marketUrb.scope.includes("2,990") && marketUrb.scope.includes("取整"),
    "断言 A3 失败：市场参考[1] scope 应注明默认 2,990 取整口径",
  );
  for (const locale of ["zh-CN", "zh-Hant"]) {
    const note = flats[locale]["insights.marketNote"];
    assert.ok(
      note.includes("2,990") && note.includes("取整"),
      `断言 A4 失败：${locale} marketNote 应含 2,990 与「取整」`,
    );
  }
  // 偏差注 2：en 文案为英文，"取整" 对应 "rounded"
  assert.ok(
    flats.en["insights.marketNote"].includes("2,990") &&
      flats.en["insights.marketNote"].includes("rounded"),
    "断言 A4 失败：en marketNote 应含 2,990 与 rounded",
  );
  for (const [tag, text] of [["zh", readmeZh], ["en", readmeEn]]) {
    assert.ok(
      text.includes("35,869"),
      `断言 A5 失败：README.${tag === "zh" ? "md" : "en.md"} 应含 2025 年城镇口径 35,869`,
    );
    assert.ok(
      !text.includes("34,557") && !text.includes("2,880"),
      `断言 A6 失败：README ${tag} 来源表 2024 年口径（34,557 / 2,880）应清零`,
    );
  }

  // ---- 组 B 480 与首屏临界 -------------------------------------------------
  // 独立推导：12 ÷ 0.025 = 480；2990 × 480 = 1,435,200；+200,000 = 1,635,200
  assert.equal(12 / 0.025, 480, "断言 B1 失败：12 ÷ 0.025 应严格等于 480");
  assert.equal(
    BASELINE_DEFAULTS.monthlyExpense * 480 + BASELINE_DEFAULTS.healthReserve,
    1_635_200,
    "断言 B2 失败：2990×480+200000 应 = 1,635,200",
  );
  assert.equal(
    ACCUMULATION_DEFAULTS.targetValue,
    BASELINE_DEFAULTS.monthlyExpense * 480 + BASELINE_DEFAULTS.healthReserve,
    "断言 B3 失败：ACCUMULATION targetValue 应与首屏临界值全等（1,635,200）",
  );

  // ---- 组 C MC 年支出 ------------------------------------------------------
  // 独立推导：2990 × 12 = 35,880（年支出基期值）
  assert.equal(
    MONTE_CARLO_DEFAULTS.annualSpend,
    2990 * 12,
    "断言 C1 失败：MC annualSpend 应 = 2990 × 12",
  );
  assert.equal(MONTE_CARLO_DEFAULTS.annualSpend, 35_880, "断言 C2 失败：MC annualSpend 应 = 35,880");

  // ---- 组 D 费雪双口径 -----------------------------------------------------
  // 独立推导：近似式 r ≈ n − i → 12 ÷ 0.025 = 480；精确式 (1+n)/(1+i) − 1 =
  // 1.045/1.02 − 1 ≈ 2.4509804%，12 ÷ 之 ≈ 489.6（实测 489.6000000000017）；
  // 精确临界 2990 × 489.6 + 200,000 ≈ 1,663,904（实测 1,663,904.0000000051，README:55 面板锚）。
  // 偏差注 1：IEEE-754 下 12/(0.045-0.02) = 480.00000000000006，严格相等不成立 → 1e-9 容差。
  assert.ok(
    Math.abs(12 / (0.045 - 0.02) - 480) < 1e-9,
    "断言 D1 失败：近似费雪乘数应 ≈ 480（容差 1e-9）",
  );
  assert.ok(
    Math.abs(12 / (1.045 / 1.02 - 1) - 489.6) < 0.01,
    "断言 D2 失败：精确费雪乘数应 ≈ 489.6",
  );
  assert.ok(
    Math.abs(2990 * (12 / (1.045 / 1.02 - 1)) + 200_000 - 1_663_904) < 1,
    "断言 D3 失败：精确口径临界值应 ≈ 1,663,904（README:55 面板锚）",
  );
  assert.equal(
    MONTE_CARLO_STRATEGY_DEFAULTS.percent.realReturnAssumpPct,
    BASELINE_DEFAULTS.nominalReturnPct - BASELINE_DEFAULTS.inflationPct,
    "断言 D4 失败：realReturnAssumpPct 应 = 4.5 − 2.0 = 2.5",
  );
  assert.equal(
    MONTE_CARLO_STRATEGY_DEFAULTS.percent.realReturnAssumpPct,
    2.5,
    "断言 D5 失败：realReturnAssumpPct 应 = 2.5",
  );

  // ---- 组 E 预设自洽 -------------------------------------------------------
  // 独立推导（presets.ts 注释和式）：
  //   1500+2000+400+100+500 = 4500；2800+3500+700+200+800 = 8000；
  //   4000+4500+800+250+1450 = 11000；900+600+150+50+300 = 2000
  const expectedExpense = [4500, 8000, 11000, 2000];
  PRESET_PROFILES.forEach((profile, i) => {
    const sum =
      profile.breakdown.food +
      profile.breakdown.housing +
      profile.breakdown.transport +
      profile.breakdown.communication +
      profile.breakdown.other;
    assert.equal(
      sum,
      profile.baseline.monthlyExpense,
      `断言 E1 失败：画像 ${profile.id} 消费构成五项和应 === monthlyExpense`,
    );
    assert.equal(
      profile.baseline.monthlyExpense,
      expectedExpense[i],
      `断言 E2 失败：画像 ${profile.id} monthlyExpense 应为 ${expectedExpense[i]}`,
    );
    assert.equal(
      profile.baseline.costPerChild,
      580_000,
      `断言 E3 失败：画像 ${profile.id} costPerChild 应保持示例值 580000`,
    );
  });

  // ---- 组 F 育儿双口径标注 -------------------------------------------------
  // 口径边界：报告 0–17 岁 = 抚养到刚年满 18 岁前（research-source-evidence §2）。
  const dLines = defaultsSource.split(/\r?\n/);
  const costIdx = dLines.findIndex((line) => line.includes("costPerChild: 580000"));
  assert.ok(costIdx !== -1, "断言 F1 失败：defaults.ts 应含 costPerChild: 580000 行");
  const costWindow = dLines.slice(Math.max(0, costIdx - 2), costIdx + 3).join("\n");
  assert.ok(
    costWindow.includes("视频口径"),
    "断言 F1 失败：defaults.ts costPerChild 行 ±2 行应含「视频口径示例值」标注",
  );
  const familyNote = PRESET_PROFILES.find((p) => p.id === "family_one_kid").note;
  assert.ok(
    familyNote.includes("53.8"),
    "断言 F2 失败：presets 一孩家庭 note 应含报告原文 53.8 万对照",
  );
  const natChild = INSIGHT_CHILD_COST_REGIONS.find((r) => r.region.includes("全国"));
  assert.equal(natChild.costWan, 53.8, "断言 F3 失败：展示层全国 0–17 岁平均应为 53.8 万");
  for (const [locale, flat] of Object.entries(flats)) {
    for (const key of ["basic.childCostTooltip", "basic.childCountHint"]) {
      assert.ok(
        flat[key].includes("0–17") && !flat[key].includes("0–18"),
        `断言 F4 失败：${locale}.${key} 应统一为 0–17 岁口径`,
      );
    }
    // 偏差注 3：zh-Hant 用「萬」，zh-CN 用「万」；en 用阿拉伯数字（见组 H 断言 H3）
    if (locale !== "en") {
      const wan = locale === "zh-Hant" ? "萬" : "万";
      assert.ok(
        flat["reverse.exampleBNote"].includes(`1.0 ${wan}`) &&
          flat["reverse.exampleBNote"].includes(`0.9 ${wan}`),
        `断言 H2 失败：${locale} exampleBNote 应含 1.0 与 0.9 差异注`,
      );
    }
    assert.ok(
      flat["basic.coreParams"].includes("4.5%"),
      `断言 I5 失败：${locale} coreParams 折叠头应含 4.5%`,
    );
    const joined = Object.values(flat).join("\n");
    assert.ok(
      !joined.includes("0–18"),
      `断言 F5 失败：${locale} 全键扁平扫描不应残留 0–18 口径句`,
    );
  }
  const readmeLines = readmeZh.split(/\r?\n/);
  const disclaimerIdx = readmeLines.findIndex((line) => line.includes("所有默认值"));
  assert.ok(disclaimerIdx !== -1, "断言 F6 失败：README.md 应含默认值免责行");
  assert.ok(
    readmeLines[disclaimerIdx].includes("53.8"),
    "断言 F6 失败：README.md 默认值免责行应含 53.8 报告原文对照",
  );

  // ---- 组 G 社保环锚定 -----------------------------------------------------
  // value 与 source 必须同源（2024 年报 → 7.39%）；更新口径 7.62%（2025 年报）另注，
  // 引用「最新」时用 7.62%——该写作指引落 data-dictionary.md，不入界面文案。
  const ssf = INSIGHT_CHAIN_STEPS.find((s) => s.labelKey === "insights.chainSsf");
  assert.equal(ssf.value, "7.39%", "断言 G1 失败：chainSsf value 应保持 7.39%（与 2024 年报同源）");
  assert.equal(ssf.verification, "official", "断言 G2 失败：chainSsf 核证等级应为 official");
  assert.ok(ssf.source.includes("2024"), "断言 G3 失败：chainSsf source 应为 2024 年度报告");
  assert.ok(
    ssf.scope.includes("至 2024 年末"),
    "断言 G4 失败：chainSsf scope 应补「至 2024 年末」时间边界",
  );
  assert.ok(ssf.scope.includes("7.62"), "断言 G5 失败：chainSsf scope 应含 2025 年报更新口径 7.62%");
  assert.ok(!ssf.scope.includes("最新"), "断言 G6 失败：chainSsf scope 不得出现「最新」（防与 7.39 并置过时表述）");
  // 负向正则：收益承诺式文案零命中（换行折叠为空格后全文扫描）
  const insightsJoined = insightsSource.replace(/\s+/g, " ");
  assert.ok(
    !/预期收益.*7\.39/.test(insightsJoined) &&
      !/7\.39.*你的/.test(insightsJoined) &&
      !insightsJoined.includes("帮你赚到"),
    "断言 G7 失败：insights 全文不得把 7.39% 与个人可得收益/收益承诺并置",
  );

  // ---- 组 H 算例 B 更正 ----------------------------------------------------
  // 独立推导（480 法则直除）：6,000,000 − 1,200,000 = 4,800,000；4,800,000 ÷ 480 = 10,000
  assert.equal((6_000_000 - 1_200_000) / 480, 10_000, "断言 H1 失败：算例 B 直除应为 10,000 元/月");
  // 三语差异注见组 F 循环内断言 H2（zh-CN「万」/ zh-Hant「萬」）；en 用阿拉伯数字：
  assert.ok(
    flats.en["reverse.exampleBNote"].includes("10,000") &&
      flats.en["reverse.exampleBNote"].includes("9,000"),
    "断言 H3 失败：en exampleBNote 应含 10,000 与 9,000 差异注",
  );

  // ---- 组 I 假设区间标注 ---------------------------------------------------
  // 4%–4.5% 是本工具保守假设区间、非文献结论（不得写「研究表明/历史平均」）；
  // 文献背景（句式 4）：美股长期实际 ~6.5%–7%、A 股 2005–2025 实际 ~8.1%。
  const nominal = INSIGHT_CHAIN_STEPS.find((s) => s.labelKey === "insights.chainNominal");
  assert.equal(nominal.verification, "video", "断言 I1 失败：chainNominal 应为 video 假设口径");
  assert.ok(nominal.source.includes("假设"), "断言 I2 失败：chainNominal source 应标「假设」");
  assert.ok(
    !nominal.scope.includes("研究表明") && !nominal.scope.includes("历史平均"),
    "断言 I3 失败：chainNominal scope 不得写「研究表明/历史平均」",
  );
  assert.equal(BASELINE_DEFAULTS.nominalReturnPct, 4.5, "断言 I4 失败：nominalReturnPct 应保持 4.5");
  // 断言 I5（三语 coreParams 含 4.5%）在组 F 循环内。

  // ===========================================================================
  // P11 扩展（docs/p11-spec.md §5）：组 J 序列溯源 + 组 K @data-meta 元数据。
  // A–I 组期望值零变化锁定；J/K 为纯新增，沿既有 esbuild 转译管道（零新依赖）。
  // ===========================================================================

  // ---- 组 J 序列溯源（三联：锚值 + 年份 + 来源；research-p11-series §4 同源） ----
  const { mod: indexSeries } = await loadModule("../src/data/indexSeries.ts", "indexSeries");
  const { INDEX_ORDER, INDEX_SERIES, seriesRange } = indexSeries;
  const indexSeriesSource = readFileSync(new URL("../src/data/indexSeries.ts", import.meta.url), "utf8");
  const shareSource = readFileSync(new URL("../src/services/share.ts", import.meta.url), "utf8");

  // J0 结构前置（防扩展半成品）
  const seriesIds = Object.keys(INDEX_SERIES);
  assert.deepEqual(
    INDEX_ORDER,
    seriesIds,
    "断言 J0-1 失败：INDEX_ORDER 应与 Object.keys(INDEX_SERIES) 全等（孤儿序列=静默死数据）",
  );
  for (const id of seriesIds) {
    // 白名单硬同步（share.ts 解码端唯一硬同步点；遗漏即携带该 id 的分享链接静默失效）
    assert.ok(
      shareSource.includes(`"${id}"`),
      `断言 J0-2 失败：share.ts 白名单应含 "${id}" 字面量（分享载荷硬同步）`,
    );
  }
  // 三语 flats 含每序列 nameKey/kindKey 指向的键（防裸键；静态键随数据字段走）
  for (const [locale, flat] of Object.entries(flats)) {
    for (const id of seriesIds) {
      const s = INDEX_SERIES[id];
      assert.ok(
        typeof flat[s.nameKey] === "string" && flat[s.nameKey].length > 0,
        `断言 J0-3 失败：${locale} 应含序列显示名键 ${s.nameKey}`,
      );
      assert.ok(
        typeof flat[s.kindKey] === "string" && flat[s.kindKey].length > 0,
        `断言 J0-4 失败：${locale} 应含序列口径键 ${s.kindKey}`,
      );
    }
  }
  // 有意偏差锁定（docs/p11-spec.md §2 登记项 8）：indexSeries 不放 @data-meta 注释块，
  // 时效机读走结构化字段 fetchedAt/sourceUrl（单一真源）——防后续误加注释块形成双写漂移
  assert.ok(
    !indexSeriesSource.includes("@data-meta"),
    "断言 J0-5 失败：indexSeries.ts 有意不放 @data-meta 注释块（规范 §2 有意偏差；双写必漂移）",
  );

  // J1 锚值（录入轮官方复算登记，禁占位；算式见各行注——「禁魔法期望数」纪律）
  //  csi300 2025 = 年末收盘 4,629.94 ÷ 上年末 3,934.91 − 1 = +17.66（行情历史接口，
  //    2026-11-25 复算；与 Wind 年末收盘口径转述 +17.66% 一致）
  //  csi300tr = 中证官网 H00300 年末收盘逐对比复算（2005 = 923.45 ÷ 1,000 − 1；2017 =
  //    4,918.52 ÷ 3,958.53 − 1 = +24.25；2024 = 5,642.60 ÷ 4,772.18 − 1 = +18.24；
  //    2025 = 6,826.62 ÷ 5,642.60 − 1 = +20.98——2017–2025 与 GuruFocus 年度表逐值一致）
  //  cba00101 = 中债官方查询平台 CBA00101 财富指标年末值复算（2002 = 103.577 ÷ 100 − 1 =
  //    +3.58；2008 = 128.3216 ÷ 116.1804 − 1 = +10.45；2013 = 142.3383 ÷ 142.7568 − 1 =
  //    −0.29；2024 = 247.3856 ÷ 229.9023 − 1 = +7.60；2025 = 248.9888 ÷ 247.3856 − 1 = +0.65）
  //  sp500long（C3）本轮缓置（§7.3-3 闸门裁决）：录入轮已完成 Damodaran 表实读
  //    （1972 = +18.76、2025 = +17.78，54 值；2025 与库内 sp500 17.88 差 0.10pp 为
  //    股息估计 vintage 差异，不调和）——落库轮直接按本注释锚值登记，禁占位。
  const PER_SERIES_ANCHORS = {
    csi300: [[2005, -7.66], [2008, -65.95], [2015, 5.58], [2024, 14.68], [2025, 17.66]],
    sp500: [[2005, 4.91], [2008, -37.0], [2020, 18.4], [2025, 17.88]],
    csi300tr: [[2005, -7.66], [2017, 24.25], [2024, 18.24], [2025, 20.98]],
    cba00101: [[2002, 3.58], [2008, 10.45], [2013, -0.29], [2024, 7.6], [2025, 0.65]],
  };
  for (const [id, anchors] of Object.entries(PER_SERIES_ANCHORS)) {
    const s = INDEX_SERIES[id];
    for (const [year, value] of anchors) {
      assert.equal(
        s.annualReturnsPct[year - s.firstYear],
        value,
        `断言 J1 失败：${id} ${year} 年锚值应为 ${value}（arr[year − firstYear] 严格相等）`,
      );
    }
  }

  // J2 年份（区间单一真源自证 + 样本数 + 2026 禁入 + 物理域）
  // 期望样本数（P11 实施轮终点态，C3 sp500long 缓置后四序列）：csi300=21（X1 2025 补录
  // 落地）、sp500=21、csi300tr=21、cba00101=24；sp500long=54 待落库轮补登（录入轮实读值
  // 见 J1 注）
  const COUNTS = { csi300: 21, sp500: 21, csi300tr: 21, cba00101: 24 };
  for (const id of seriesIds) {
    const s = INDEX_SERIES[id];
    const r = seriesRange(s);
    // seriesRange 三值与派生式恒等（单一真源自证；冗余落盘字段若引入即漂移暴露）
    assert.equal(r.start, s.firstYear, `断言 J2-1 失败：${id} range.start 应 = firstYear`);
    assert.equal(
      r.end,
      s.firstYear + s.annualReturnsPct.length - 1,
      `断言 J2-1 失败：${id} range.end 应 = firstYear + len − 1（end/count 永不落盘）`,
    );
    assert.equal(r.count, s.annualReturnsPct.length, `断言 J2-1 失败：${id} range.count 应 = len`);
    assert.equal(r.count, COUNTS[id], `断言 J2-2 失败：${id} 样本数应 = ${COUNTS[id]}`);
    assert.ok(
      r.end <= 2025,
      `断言 J2-3 失败：${id} 序列 end=${r.end} 应 ≤ 2025（2026 不完整年度禁入，indexSeries.ts:4 纪律）`,
    );
    for (const [year] of PER_SERIES_ANCHORS[id]) {
      assert.ok(
        year >= r.start && year <= r.end,
        `断言 J2-4 失败：${id} 锚年 ${year} 应 ∈ [${r.start}, ${r.end}]`,
      );
    }
    for (const v of s.annualReturnsPct) {
      assert.ok(
        Number.isFinite(v) && v > -100 && v < 1000,
        `断言 J2-5 失败：${id} 年度收益 ${v} 超出物理域 (−100, 1000)`,
      );
    }
  }

  // J3 来源（机构关键字 + 拉取日期 + kind 语义 + 溯源域名白名单）
  const SOURCE_KEYWORDS = {
    csi300: "行情历史",
    sp500: "Slickcharts",
    csi300tr: "中证指数",
    cba00101: "中国债券",
  };
  // 域名白名单（research-p11-series §4 J3 + 实施轮扩注：csi300 溯源走仓库原方法
  // 行情历史接口（indexSeries.ts 既有注释先例来源），故补 push2his.eastmoney.com——
  // 白名单扩注已在实施报告登记为对规范 §5 J3 表的偏差补充）
  const SOURCE_URL_HOSTS = [
    "csindex.com.cn",
    "chinabond.com.cn",
    "stern.nyu.edu",
    "gurufocus.cn",
    "slickcharts",
    "push2his.eastmoney.com",
  ];
  const buildDayIso = new Date().toISOString().slice(0, 10);
  for (const id of seriesIds) {
    const s = INDEX_SERIES[id];
    assert.ok(
      s.source.includes(SOURCE_KEYWORDS[id]),
      `断言 J3-1 失败：${id} source 应含机构关键字「${SOURCE_KEYWORDS[id]}」`,
    );
    assert.ok(
      /^\d{4}-\d{2}-\d{2}$/.test(s.fetchedAt),
      `断言 J3-2 失败：${id} fetchedAt="${s.fetchedAt}" 应匹配 YYYY-MM-DD`,
    );
    assert.ok(
      s.fetchedAt <= buildDayIso,
      `断言 J3-2 失败：${id} fetchedAt=${s.fetchedAt} 不应晚于构建日 ${buildDayIso}（防占位未来日期）`,
    );
    if (s.kind === "price") {
      assert.ok(s.note.includes("不含股息"), `断言 J3-3 失败：${id} kind=price ⇒ note 应含「不含股息」`);
    }
    if (s.kind === "total") {
      assert.ok(
        s.note.includes("含股息") || s.note.includes("含票息"),
        `断言 J3-3 失败：${id} kind=total ⇒ note 应含「含股息」或「含票息」（股债两族语义）`,
      );
    }
    if (s.sourceUrl !== undefined) {
      assert.ok(s.sourceUrl.includes("http"), `断言 J3-4 失败：${id} sourceUrl 应含 http`);
      assert.ok(
        SOURCE_URL_HOSTS.some((h) => s.sourceUrl.includes(h)),
        `断言 J3-4 失败：${id} sourceUrl 域名应命中白名单（${s.sourceUrl}）`,
      );
    }
  }

  // ---- 组 K @data-meta 元数据机读（承 research-p11-data-audit §4；正则读源文本，
  //      不经转译；types.ts 零数据项与 indexSeries.ts 字段路径不参与 K1/K4/K5） ----
  const META_FILES = ["defaults", "presets", "pensionParams", "insights", "regional", "rentParams", "taxTables"];
  const metaSources = {};
  for (const f of META_FILES) {
    metaSources[f] = readFileSync(new URL(`../src/data/${f}.ts`, import.meta.url), "utf8");
  }

  // K1：七文件源文本含 @data-meta 头块，必填键齐备（YEAR 可省略于混合文件；
  // CHECKED_AT / SOURCE_TYPE / EXPIRY 必填；NEXT_DUE 仅 EXPIRY 含 L1/L3 的文件必填）
  for (const f of META_FILES) {
    const src = metaSources[f];
    assert.ok(src.includes("@data-meta"), `断言 K1-1 失败：${f}.ts 应含 @data-meta 头块`);
    const headStart = src.indexOf("@data-meta");
    const headEnd = src.indexOf("*/", headStart);
    const head = src.slice(headStart, headEnd === -1 ? src.length : headEnd);
    assert.ok(/CHECKED_AT\s*[:=]/.test(head), `断言 K1-2 失败：${f}.ts 头块应含 CHECKED_AT`);
    assert.ok(/SOURCE_TYPE\s*[:=]/.test(head), `断言 K1-2 失败：${f}.ts 头块应含 SOURCE_TYPE`);
    assert.ok(/EXPIRY\s*[:=]/.test(head), `断言 K1-2 失败：${f}.ts 头块应含 EXPIRY`);
    const expiryLine = head.split(/\r?\n/).find((l) => /EXPIRY\s*[:=]/.test(l)) ?? "";
    if (/L1|L3/.test(expiryLine)) {
      assert.ok(
        /NEXT_DUE\s*[:=]/.test(head),
        `断言 K1-3 失败：${f}.ts EXPIRY 含 L1/L3，头块应含 NEXT_DUE（仅 L1/L3 必填）`,
      );
    }
  }

  // K2：逐个 CHECKED_AT 匹配 YYYY-MM 或 YYYY-MM-DD 且 ≤ 构建日（防占位未来日期）。
  // 偏差注（实施轮登记）：税表 T6/T7/T8/T9 在案查证轮仅月精度（2026-11，审计复核受限、
  // 不虚刷到日）——规范 §2 登记值本身即月精度，本断言按「月精度可、日精度须 ≤ 当日」执行。
  const checkedAtLines = [];
  for (const f of META_FILES) {
    for (const line of metaSources[f].split(/\r?\n/)) {
      if (!line.includes("CHECKED_AT")) continue;
      // 直接跟随 CHECKED_AT 键的日期（同行 NEXT_DUE 等其余键的日期不属 K2 管辖）
      const direct = [...line.matchAll(/CHECKED_AT[:=]\s*(\d{4}-\d{2}(?:-\d{2})?)/g)];
      if (direct.length > 0) {
        for (const m of direct) checkedAtLines.push([f, m[1]]);
      } else {
        // 聚合行（如 taxTables 头块「CHECKED_AT: T1–T5=2026-11-24；…」）：
        // 先剔除 NEXT_DUE 等键的日期再扫描，避免把发布窗口日期误当复核日期
        const cleaned = line.replace(/NEXT_DUE[:=]\s*\S+/g, "");
        for (const m of cleaned.matchAll(/(\d{4}-\d{2}(?:-\d{2})?)/g)) {
          checkedAtLines.push([f, m[1]]);
        }
      }
    }
  }
  assert.ok(checkedAtLines.length >= 7, "断言 K2-0 失败：七文件应至少各含一处 CHECKED_AT 日期");
  const buildNow = new Date();
  const buildDayNum = buildNow.getFullYear() * 10000 + (buildNow.getMonth() + 1) * 100 + buildNow.getDate();
  const buildMonthNum = buildNow.getFullYear() * 100 + (buildNow.getMonth() + 1);
  for (const [f, iso] of checkedAtLines) {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    assert.ok(
      full || /^\d{4}-\d{2}$/.test(iso),
      `断言 K2-1 失败：${f}.ts CHECKED_AT=${iso} 应为 YYYY-MM 或 YYYY-MM-DD`,
    );
    const [y, m, d] = iso.split("-").map(Number);
    const v = full ? y * 10000 + m * 100 + d : y * 100 + m;
    assert.ok(
      v <= (full ? buildDayNum : buildMonthNum),
      `断言 K2-2 失败：${f}.ts CHECKED_AT=${iso} 不应晚于构建日 ${buildDayIso}`,
    );
  }

  // K3：L2 税表——内联 YEAR === 结构化 year 字段（转译加载对齐，逐表按出现顺序配对）；
  // 且 T1–T9 year ≥ 当前适用年度 − 1（US/DE 表升 2026 后既有边界即过）
  const { mod: taxTablesMod } = await loadModule("../src/data/taxTables.ts", "taxTablesMeta");
  const taxTablesSource = metaSources.taxTables;
  const inlineYears = [];
  for (const line of taxTablesSource.split(/\r?\n/)) {
    const m = line.match(/@data-meta.*?\bYEAR=(\d{4})\b/);
    if (m) inlineYears.push(Number(m[1]));
  }
  assert.equal(
    inlineYears.length,
    taxTablesMod.TAX_TABLES.length,
    `断言 K3-0 失败：税表内联 @data-meta YEAR 条数（${inlineYears.length}）应与表数（${taxTablesMod.TAX_TABLES.length}）一致`,
  );
  taxTablesMod.TAX_TABLES.forEach((tbl, i) => {
    assert.equal(
      inlineYears[i],
      tbl.year,
      `断言 K3-1 失败：${tbl.countryCode} 表内联 YEAR=${inlineYears[i]} 应与结构化 year=${tbl.year} 一致（L2 机读一致）`,
    );
  });
  const currentYear = buildNow.getFullYear();
  for (const tbl of taxTablesMod.TAX_TABLES) {
    assert.ok(
      tbl.year >= currentYear - 1,
      `断言 K3-2 失败：${tbl.countryCode} 表 year=${tbl.year} 应 ≥ 当前适用年度−1（${currentYear - 1}）`,
    );
  }

  // K4：L1/L3 类 CHECKED_AT 未超 §3 soft 阈值（超期即红——发布窗口管理机读化）。
  // 阈值表（research-p11-data-audit §3-L1/L3 逐项登记）：工资 >18 个月 / 年金 >15 个月 /
  // NBS 收支 >14 个月 / 世行 WDI 年度窗口 12 个月 / L3 滚动 >6 个月 / 快照豁免 hard（仍受 6 个月 soft）。
  // insights 头块 CHECKED_AT 取最紧 L1 阈值（年金 15 个月）；条目级窗口见各内联 NEXT_DUE。
  function monthsBetween(iso, now) {
    const [y, m, d] = iso.split("-").map(Number);
    return (now.getFullYear() * 12 + now.getMonth() + 1 + (now.getDate() - 1) / 31) - (y * 12 + m + ((d ?? 1) - 1) / 31);
  }
  const K4_RULES = [
    { file: "pensionParams", label: "工资锚点（NBS 年度工资）", months: 18 },
    { file: "insights", label: "年金摘要（最紧 L1 阈值）", months: 15 },
    { file: "regional", label: "世行 WDI 年度窗口", months: 12 },
    { file: "rentParams", label: "Numbeo 滚动窗口（L3）", months: 6 },
  ];
  for (const rule of K4_RULES) {
    const m = metaSources[rule.file].match(/CHECKED_AT[:=]\s*(\d{4}-\d{2}-\d{2})/);
    assert.ok(m, `断言 K4-0 失败：${rule.file}.ts 应含日精度 CHECKED_AT`);
    const age = monthsBetween(m[1], buildNow);
    assert.ok(
      age <= rule.months,
      `断言 K4 失败：${rule.file}.ts CHECKED_AT=${m[1]}（${rule.label}）距构建日 ${age.toFixed(1)} 个月，超过 ${rule.classLabel ?? ""}soft 阈值 ${rule.months} 个月`,
    );
  }
  // 快照豁免：defaults FX 内联（SOURCE_TYPE=snapshot，L3 快照类豁免 hard）仍受 6 个月 soft
  const fxMetaLine = metaSources.defaults
    .split(/\r?\n/)
    .find((l) => l.includes("@data-meta") && l.includes("SOURCE_TYPE=snapshot"));
  assert.ok(fxMetaLine, "断言 K4-1 失败：defaults.ts 应含 FX 快照内联 @data-meta");
  const fxFetched = fxMetaLine.match(/CHECKED_AT=(\d{4}-\d{2}-\d{2})/);
  assert.ok(fxFetched, "断言 K4-1 失败：FX 快照内联应含日精度 CHECKED_AT");
  assert.ok(
    monthsBetween(fxFetched[1], buildNow) <= 6,
    `断言 K4-1 失败：FX 快照 CHECKED_AT=${fxFetched[1]} 距今超 6 个月（L3 快照 soft 阈值）`,
  );

  // K5：NEXT_DUE 已过窗口且 CHECKED_AT 未刷新 → console.warn 提醒（非阻断，exit 0；
  // 与 K4 阻断档分级——当前全部 NEXT_DUE 均在窗口内，零告警）
  let k5Warnings = 0;
  for (const f of META_FILES) {
    const nd = metaSources[f].match(/NEXT_DUE[:=]\s*(\d{4}-\d{2})/);
    if (!nd) continue;
    const [ny, nm] = nd[1].split("-").map(Number);
    const dueEnd = new Date(ny, nm, 1); // 窗口月末次月 1 日 0 点 = 过窗
    if (buildNow >= dueEnd) {
      const chk = metaSources[f].match(/CHECKED_AT[:=]\s*(\d{4})-(\d{2})/);
      if (chk && Number(chk[1]) * 12 + Number(chk[2]) < ny * 12 + nm) {
        console.warn(
          `[check-data][K5] ${f}.ts @data-meta NEXT_DUE=${nd[1]} 已过窗口且 CHECKED_AT 未刷新——请复核官方新发布并采值（非阻断提醒）`,
        );
        k5Warnings += 1;
      }
    }
  }
  void k5Warnings; // 告警仅打印，不改变 exit code（K5 分级纪律）

  // K6：insights 内联 EXPIRY 与既有 verification 映射一致（official/media→L1、video→L4）；
  // YEAR 对齐仅在既有 year 字段为纯年份数字时断言（区间串「2007–2024」等跳过）。
  // 内联（EXPIRY= 等号式）与头块（EXPIRY: 冒号式）可区分——扫描行级等号式按出现顺序与
  // 条目数组（chain 10 → market 2 → child 4 → health 3，即文件声明序）逐一对齐。
  const inlineMetas = [];
  for (const line of insightsSource.split(/\r?\n/)) {
    const m = line.match(/@data-meta.*?\bEXPIRY=(L\d)/);
    if (m) {
      const y = line.match(/\bYEAR=(\d{4})\b/);
      inlineMetas.push({ expiry: m[1], year: y ? Number(y[1]) : null });
    }
  }
  const insightEntries = [
    ...INSIGHT_CHAIN_STEPS,
    ...INSIGHT_MARKET_ENTRIES,
    ...INSIGHT_CHILD_COST_REGIONS,
    ...INSIGHT_HEALTH_ENTRIES,
  ];
  assert.equal(
    inlineMetas.length,
    insightEntries.length,
    `断言 K6-0 失败：insights 内联 @data-meta 条数（${inlineMetas.length}）应与条目总数（${insightEntries.length}）一致`,
  );
  insightEntries.forEach((entry, i) => {
    const expected = entry.verification === "video" ? "L4" : "L1";
    assert.equal(
      inlineMetas[i].expiry,
      expected,
      `断言 K6-1 失败：insights 条目 ${i}（${entry.labelKey ?? entry.value}）EXPIRY=${inlineMetas[i].expiry} 应为 ${expected}（verification=${entry.verification ?? "child-cost(按 media 判 L1)"}）`,
    );
    if (/^\d{4}$/.test(entry.year ?? "")) {
      assert.equal(
        inlineMetas[i].year,
        Number(entry.year),
        `断言 K6-2 失败：insights 条目 ${i} 内联 YEAR 应与结构化 year（${entry.year}）对齐`,
      );
    }
  });

  cleanup();
  console.log(
    "[check-data] 十一组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间 + 序列溯源（J：结构/锚值/年份/来源）+ 元数据（K：头块/日期/税表年度/阈值/条目映射）",
  );
} catch (e) {
  cleanup();
  throw e;
}
