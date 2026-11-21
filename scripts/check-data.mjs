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

  cleanup();
  console.log(
    "[check-data] 九组断言全部通过：消费口径/480/年支出/费雪/预设/育儿标注/社保环/算例B/假设区间",
  );
} catch (e) {
  cleanup();
  throw e;
}
