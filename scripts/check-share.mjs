#!/usr/bin/env node
/**
 * ============================================================================
 * 分享链接 v4 往返断言 + 三语键集一致性（P7 T9 / p7-spec.md §3.9；验收断言 ⑧⑨。
 * 零新依赖——esbuild 随 vite 在依赖树内，先例 scripts/check-currency.mjs）
 * ============================================================================
 *
 * 经 esbuild 转译后在 Node 内以 node:assert 断言五组：
 *  1. decode(encode(x))：对三 UI 枚举值 strategy ∈ {"fixed","threshold","percent"}
 *     输入——解码产物为合法枚举 + 其余数值字段与 x 深相等（修订轮二 R4 断言口径：
 *     往返锁定「合法枚举 + 数值深相等」，而非无差别全对象深相等）；
 *  2. 载荷缺任一 v4 新键（pension.targetRetireAge / accumulation.sustainYears）→ null
 *     （禁止部分恢复；share.ts numSlice 缺键即 null）；
 *  3. 同内容 v:3 历史载荷 → null（版本闸，SHARE_LINK_VERSION = 4）；
 *  4. strategy: "inflation_uplift" 载荷 decode 成功且 state.strategy === "fixed"、
 *     strategyNormalizedFromLegacy === true（解码端映射裁定，非 null、非原样保留）；
 *     编码端 store 永不产出该值（Radio value 恒 "fixed"），合法往返不受影响；
 *  5. 三语 locale 文件键集一致（zh-CN / zh-Hant / en；含 P7 全部新增键与改写键）。
 *
 * 用法：node scripts/check-share.mjs（或 npm run check:share）
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { transformSync } from "esbuild";

// ---------------------------------------------------------------------------
// 1) 转译 share.ts（纯函数模块；import type 全部为类型层，转译后零运行时依赖；
//    btoa/atob Node ≥ 16 全局可用）
// ---------------------------------------------------------------------------
async function loadModule(rel, name) {
  const source = readFileSync(new URL(rel, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "esm", target: "es2020" });
  const dir = mkdtempSync(join(tmpdir(), `wf-check-share-${name}-`));
  const outFile = join(dir, `${name}.mjs`);
  writeFileSync(outFile, code, "utf8");
  return { mod: await import(pathToFileURL(outFile).href), dir };
}

const { mod: share, dir: dirShare } = await loadModule("../src/services/share.ts", "share");
const {
  SHARE_LINK_VERSION,
  encodeShareState,
  decodeShareState,
} = share;

// ---------------------------------------------------------------------------
// 2) 完整合法 ShareState 夹具（与 store 各业务切片一一对应；数值全为有限数）
// ---------------------------------------------------------------------------
const BASE_STATE = {
  baseline: {
    monthlyExpense: 2990,
    childCount: 1,
    costPerChild: 580000,
    healthReserve: 200000,
    majorInvestment: 0,
    nominalReturnPct: 4.5,
    inflationPct: 2.0,
  },
  reverse: {
    totalAssets: 2000000,
    childReserve: 580000,
    healthReserve: 200000,
    majorInvestment: 0,
    nominalReturnPct: 4.5,
    inflationPct: 2.0,
  },
  loan: { principal: 1000000, annualRatePct: 3.9, years: 30, method: "equal_payment" },
  rental: {
    price: 1500000,
    downPaymentPct: 30,
    loanAnnualRatePct: 3.9,
    loanYears: 30,
    monthlyRent: 4000,
    vacancyRatePct: 5,
    maintenanceAnnualRatePct: 1,
    propertyFeeMonthly: 300,
    otherAnnualCost: 0,
    rentTaxRatePct: 5,
  },
  monteCarlo: {
    currentAssets: 500000,
    annualSpend: 35880,
    nominalReturnMeanPct: 4.5,
    nominalReturnStdPct: 12,
    inflationMeanPct: 2,
    inflationStdPct: 1,
    years: 30,
    paths: 5000,
    seed: 42,
    strategy: "fixed",
  },
  monteCarloReturnMode: "normal",
  monteCarloSeriesId: "csi300",
  tax: { grossAnnualIncome: 200000, standardDeduction: 60000, bands: [{ lower: 0, rate: 0.03 }] },
  accumulation: {
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
    sustainYears: 30,
  },
  progressCurrentAssets: 100000,
  pension: {
    currentAge: 30,
    retireAge: 60,
    targetRetireAge: 55,
    contribYears: 30,
    contribIndex: 0.6,
    accountBalance: 50000,
    avgMonthlyWage: 10343,
    monthsDivisor: 139,
  },
};

function base64urlDecode(payload) {
  const t = payload.replace(/-/g, "+").replace(/_/g, "/");
  return atob(t + "=".repeat((4 - (t.length % 4)) % 4));
}

try {
  // ---- 断言 0：版本闸常量 ----
  assert.equal(SHARE_LINK_VERSION, 4, "断言 0 失败：SHARE_LINK_VERSION 应为 4");

  // ---- 断言 1：三 UI 枚举值往返（合法枚举 + 数值深相等）----
  for (const strategy of ["fixed", "threshold", "percent"]) {
    const state = structuredClone(BASE_STATE);
    state.monteCarlo.strategy = strategy;
    if (strategy === "threshold") {
      state.monteCarlo.threshold = {
        exceedPct: 20, cutPct: 10, fallPct: 20, raisePct: 10,
        noCutLastYears: 15, freezeOnLoss: true,
      };
    }
    if (strategy === "percent") {
      state.monteCarlo.percent = { realReturnAssumpPct: 2.5, floorPctOfLastYear: 0, capPctOfInitialReal: 0 };
    }
    const decoded = decodeShareState(encodeShareState(state));
    assert.ok(decoded !== null, `断言 1 失败：strategy=${strategy} 往返应成功`);
    assert.ok(
      ["fixed", "threshold", "percent"].includes(decoded.state.monteCarlo.strategy),
      `断言 1 失败：${strategy} 往返后应为合法 UI 枚举`,
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(decoded.state)),
      JSON.parse(JSON.stringify(state)),
      `断言 1 失败：strategy=${strategy} 往返数值深相等`,
    );
    assert.equal(
      decoded.strategyNormalizedFromLegacy,
      false,
      `断言 1 失败：${strategy} 为合法枚举，规范化信号应为 false`,
    );
  }

  // ---- 断言 2：缺任一 v4 新键 → null（禁止部分恢复）----
  for (const [slice, key] of [["pension", "targetRetireAge"], ["accumulation", "sustainYears"]]) {
    const state = structuredClone(BASE_STATE);
    delete state[slice][key];
    const json = JSON.parse(base64urlDecode(encodeShareState(state)));
    delete json[slice][key];
    const tampered = btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    assert.equal(
      decodeShareState(tampered),
      null,
      `断言 2 失败：缺 ${slice}.${key} 应整体 null`,
    );
  }

  // ---- 断言 3：v:3 历史载荷 → null（版本闸）----
  {
    const json = JSON.parse(base64urlDecode(encodeShareState(BASE_STATE)));
    json.v = 3;
    const v3payload = btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    assert.equal(decodeShareState(v3payload), null, "断言 3 失败：v3 载荷应被版本闸拒绝");
  }

  // ---- 断言 4：inflation_uplift 载荷 → 映射 fixed + 规范化信号 true ----
  {
    const json = JSON.parse(base64urlDecode(encodeShareState(BASE_STATE)));
    json.monteCarlo.strategy = "inflation_uplift";
    const payload = btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const decoded = decodeShareState(payload);
    assert.ok(decoded !== null, "断言 4 失败：inflation_uplift 载荷应 decode 成功（映射而非拒绝）");
    assert.equal(decoded.state.monteCarlo.strategy, "fixed", "断言 4 失败：应规范化为 fixed");
    assert.equal(
      decoded.strategyNormalizedFromLegacy,
      true,
      "断言 4 失败：规范化信号应为 true",
    );
    // 枚举外仍拒绝
    const bad = JSON.parse(base64urlDecode(encodeShareState(BASE_STATE)));
    bad.monteCarlo.strategy = "other";
    const badPayload = btoa(JSON.stringify(bad)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    assert.equal(decodeShareState(badPayload), null, "断言 4b 失败：枚举外应整体 null");
  }

  // ---- 断言 5：三语键集一致（含 P7 全部新增键）----
  const expectedNewKeys = [
    "pension.targetRetireAge", "pension.targetRetireAgeTooltip", "pension.bridgeTitle",
    "pension.bridgeYearsLabel", "pension.bridgeFundingLabel", "pension.bridgeNote",
    "accumulation.sustainYears", "accumulation.sustainYearsTooltip",
    "accumulation.sustainedLabel", "accumulation.sustainedHint",
    "basic.multiplierExactLabel", "basic.criticalExactLabel", "basic.fisherNote",
    "reverse.perpetuityWarning", "share.strategyLegacyNotice",
  ];
  const keySets = {};
  for (const [locale, rel] of [
    ["zh-CN", "../src/i18n/locales/zh-CN.ts"],
    ["zh-Hant", "../src/i18n/locales/zh-Hant.ts"],
    ["en", "../src/i18n/locales/en.ts"],
  ]) {
    const { mod, dir } = await loadModule(rel, `i18n-${locale}`);
    const flat = (obj, prefix = "") => {
      const out = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") out.push(...flat(v, path));
        else out.push(path);
      }
      return out;
    };
    keySets[locale] = new Set(flat(mod.default));
    rmSync(dir, { recursive: true, force: true });
    for (const k of expectedNewKeys) {
      assert.ok(keySets[locale].has(k), `断言 5 失败：${locale} 缺新键 ${k}`);
    }
  }
  for (const k of keySets["zh-CN"]) {
    assert.ok(keySets["zh-Hant"].has(k), `断言 5 失败：zh-Hant 缺键 ${k}`);
    assert.ok(keySets.en.has(k), `断言 5 失败：en 缺键 ${k}`);
  }
  for (const k of keySets["zh-Hant"]) {
    assert.ok(keySets["zh-CN"].has(k), `断言 5 失败：zh-CN 多出 zh-Hant 独有键 ${k}`);
  }
  for (const k of keySets.en) {
    assert.ok(keySets["zh-CN"].has(k), `断言 5 失败：zh-CN 多出 en 独有键 ${k}`);
  }

  // ---- 断言 6：改写键新值在位（正名 + 提示 + 警示锚点抽查）----
  const zh = keySets["zh-CN"];
  assert.ok(zh.has("mc.strategyFixed"), "断言 6 失败：mc.strategyFixed 键缺失");

  rmSync(dirShare, { recursive: true, force: true });
  console.log("[check-share] v4 往返 + v3 失效 + inflation_uplift 规范化 + 三语键集一致：六组断言全部通过。");
} catch (e) {
  rmSync(dirShare, { recursive: true, force: true });
  throw e;
}
