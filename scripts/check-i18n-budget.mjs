#!/usr/bin/env node
/**
 * ============================================================================
 * 单行关键文案三语长度预算（p10fix-spec.md §6.2 / §11.1；npm run check:i18n。
 * 零新依赖——esbuild 随 vite 在依赖树内，先例 scripts/check-data.mjs:121-123 三语加载）
 * ============================================================================
 *
 * 逐键取字符串计字符数（[...str].length，CJK 计 1、代理对计 1）后对照 §11.1 预算表。
 * 上限推导式（§11.1 表头）：上限 = ⌊槽内宽 ÷ 字宽⌋，槽内宽按最窄基准 320 视口；
 * CJK 字宽 ≈ 字号 px（12px caption / 14px body），EN ≈ 7px/字符 body、6px caption。
 * 唯一例外算式：F2 摘要行 en 34 = ⌊(264−21)/7⌋——插值数字占位 W=21px（约定占位常量，
 * ≈3 字符位；域核对 W≤26px：264−26=238=34×7；本门禁 34 只约束 prefix 自身宽度，
 * 单位后缀原子块的同行严限 ⌊(264−4−91)/7⌋=24 不作门禁值，残余折行归 A1 实测终审）。
 *
 * 判级：FAIL 输出「键 / 语言 / 实测字符数 / 上限 / 超出量」，退出码非 0。
 * 软预算行（scrollFallback 回退例外路径可换行、migrate.notice 底部气泡 ≤2 行，
 * §11.1 行 3 F0 叶条与行 9 L1/R1 分段条沿用既有单行省略＋aria 全文机制）只输出
 * INFO 不判挂。en.ts 缩短 8 处后本脚本为逐键硬门禁（§1.5-③）。
 *
 * 用法：node scripts/check-i18n-budget.mjs（或 npm run check:i18n）
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const tmpDirs = [];

async function loadLocale(rel, name) {
  const dir = mkdtempSync(join(tmpdir(), `wf-check-i18n-${name}-`));
  tmpDirs.push(dir);
  const source = readFileSync(new URL(rel, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "esm", target: "es2020" });
  const outFile = join(dir, `${name}.mjs`);
  writeFileSync(outFile, code, "utf8");
  return { mod: await import(pathToFileURL(outFile).href), dir };
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

function charLen(s) {
  return [...s].length;
}

// ---------------------------------------------------------------------------
// 预算表（§11.1 逐键；hard = 硬门禁（超限 FAIL 退出非 0），soft = 软预算行（INFO 不判挂）。
// 每条 limits 内注释写明推导式：[zh-CN, zh-Hant, en]）
// ---------------------------------------------------------------------------
const BUDGET = [
  // §11.1 行 1：C2 tab label <480 短形态键（5 键；槽内宽 ≈42px，CJK ≤3 = ⌊42/14⌋、
  // EN ≤6 = ⌊42/7⌋；短形态键自身 ≤3/≤6 为硬门禁对象。§9.2 降档序④：五键整组随渲染
  // 接线下一轮补齐——门禁行随键一同登记，补键轮扩回本表；本轮 <480 由既有单行
  // 省略＋aria 全文兜底机制承载）
  // §11.1 行 2：C2 tab desc（≥768 双行；槽内宽 ≈248px @1366，CJK ≤17 = ⌊248/14⌋、
  // EN ≤35 = ⌊248/7⌋）
  { key: "atlas.pro.desc", limits: [17, 17, 35], hard: true, why: "行2 desc ⌊248/14⌋=17 / ⌊248/7⌋=35" },
  // §11.1 行 3：F0 叶切换条两段（软预算行——zh/zh-Hant 触屏档单行省略＋aria 全文机制
  // 在册；en 已缩短 "Results" 按软行 INFO 登记）
  { key: "basic.outputTitle", limits: [8, 8, 16], hard: false, why: "行3 F0 叶条（软）⌊120/14⌋=8 / ⌊120/7⌋=16" },
  { key: "basic.inputTitle", limits: [8, 8, 16], hard: false, why: "行3 F0 叶条（软）" },
  // §11.1 行 4：F3/F7/K1/L4/R4 槽条段（硬门禁；CJK ≤8 = ⌊120/14⌋、EN ≤16 = ⌊120/7⌋。
  // 现值超标键 = 行内四键（sensitivity.title/mcTitle/scenarioTitle/stepAssumption，
  // 键值变更③④⑤⑥）；reverseTitle en 18 为既有省略＋aria 机制承载、不在缩短清单，
  // 归软行不判挂——§11 前言「既有键值变更恰 8 键」红线）
  { key: "sensitivity.title", limits: [8, 8, 16], hard: true, why: "行4 槽条段 ⌊120/14⌋=8 / ⌊120/7⌋=16" },
  { key: "advanced.mcTitle", limits: [8, 8, 16], hard: true, why: "行4 槽条段" },
  { key: "advanced.scenarioTitle", limits: [8, 8, 16], hard: true, why: "行4 槽条段" },
  { key: "basic.stepAssumption", limits: [8, 8, 16], hard: true, why: "行4 槽条段（F7 段）" },
  { key: "advanced.reverseTitle", limits: [8, 8, 16], hard: false, why: "行4 同槽位段（软——不在缩短清单，既有省略＋aria 承载）" },
  // §11.1 行 5：预设 chips（4 格栅格 ≈56px；CJK ≤4 = ⌊56/14⌋、EN ≤7 = ⌊56/7⌋。
  // 处置列「保持 ≤7」为 EN 守成硬档；CJK 现值 5（佛系低欲望）以既有单行省略承载归软）
  { key: "presets.names.singleRenter", limits: [4, 4, 7], hard: [false, false, true], why: "行5 预设 chips：EN ≤7 守成硬 / CJK 软（省略在册）" },
  { key: "presets.names.coupleNoKids", limits: [4, 4, 7], hard: [false, false, true], why: "行5 预设 chips" },
  { key: "presets.names.familyOneKid", limits: [4, 4, 7], hard: [false, false, true], why: "行5 预设 chips" },
  { key: "presets.names.zenFrugal", limits: [4, 4, 7], hard: [false, false, true], why: "行5 预设 chips" },
  // §11.1 行 6：F2 摘要行 <768（≈264px；CJK ≤16 = ⌊264/16⌋？——zh 14px body ⌊264/16⌋
  // 非整数口径：CJK 上限 16 为表值；en 34 = ⌊(264−21)/7⌋ 插值占位 W=21px，唯一例外算式）
  { key: "basic.summaryPrefix", limits: [16, 16, 34], hard: true, why: "行6 F2 en 34=⌊(264−21)/7⌋（W=21px 约定占位常量）/ CJK 16 表值" },
  // §11.1 行 7：公式解构行（≈264px；CJK ≤22、EN ≤40；守成行）
  { key: "basic.formulaRow", limits: [22, 22, 40], hard: true, why: "行7 公式行 ⌊264/12⌋=22 / ⌊264/6⌋=40（caption 12px）" },
  // §11.1 行 8：P1 条目标签（≈120px；CJK ≤8、EN ≤16；其余四条目 en ≤16 守成）
  { key: "insights.entryFormula", limits: [8, 8, 16], hard: true, why: "行8 P1 条目 ⌊120/14⌋=8 / ⌊120/7⌋=16" },
  { key: "insights.entryChain", limits: [8, 8, 16], hard: true, why: "行8 P1 条目" },
  { key: "insights.entryData", limits: [8, 8, 16], hard: true, why: "行8 P1 条目" },
  { key: "insights.entryEvidence", limits: [8, 8, 16], hard: true, why: "行8 P1 条目（en 已缩短 Evidence）" },
  { key: "insights.entryNotice", limits: [8, 8, 16], hard: true, why: "行8 P1 条目" },
  // §11.1 行 9：L1/R1 分段条 <480 五段（软预算行——既有单行省略＋aria 全文兜底，
  // 非导航段豁免；五组/三分组短键按软行 INFO 登记）
  { key: "atlas.lifeGroupPlan", limits: [3, 3, 6], hard: false, why: "行9 L1/R1 分段（软）⌊42/14⌋=3 / ⌊42/7⌋=6" },
  { key: "atlas.lifeGroupAsset", limits: [3, 3, 6], hard: false, why: "行9 L1/R1 分段（软）" },
  { key: "advanced.groupPlan", limits: [3, 3, 6], hard: false, why: "行9 R1 分段（软）" },
  { key: "advanced.groupHousing", limits: [3, 3, 6], hard: false, why: "行9 R1 分段（软）" },
  { key: "advanced.groupAnalysis", limits: [3, 3, 6], hard: false, why: "行9 R1 分段（软）" },
  // §11.1 行 10：scrollFallback 横幅（软预算行——回退例外路径可换行，§1.2-② 文档流不遮挡）
  { key: "atlas.scrollFallback", limits: [19, 19, 51], hard: false, why: "行10 回退横幅（软，可换行）" },
  // §11.1 行 11：migrate notice 底部气泡 ≤2 行（软预算行，不判挂；≈264px×2）
  { key: "atlas.migrate.notice", limits: [50, 50, 120], hard: false, why: "行11 底部气泡 ≤2 行（软）2×⌊264/12⌋=50 / 2×⌊264/6⌋=120" },
];

const LANGS = ["zh-CN", "zh-Hant", "en"];
const LOCALE_FILES = {
  "zh-CN": "../src/i18n/locales/zh-CN.ts",
  "zh-Hant": "../src/i18n/locales/zh-Hant.ts",
  en: "../src/i18n/locales/en.ts",
};

try {
  const flats = {};
  for (const lang of LANGS) {
    const { mod, dir } = await loadLocale(LOCALE_FILES[lang], lang);
    flats[lang] = flatten(mod.default);
    rmSync(dir, { recursive: true, force: true });
  }

  const fails = [];
  const infos = [];
  let checked = 0;
  for (const item of BUDGET) {
    for (let i = 0; i < LANGS.length; i += 1) {
      const lang = LANGS[i];
      const limit = item.limits[i];
      const value = flats[lang][item.key];
      if (value === undefined) {
        fails.push([item.key, lang, "（键缺失）", limit, "—"]);
        continue;
      }
      checked += 1;
      const n = charLen(value);
      const row = [item.key, lang, String(n), String(limit), String(Math.max(0, n - limit))];
      // hardness 可按语言分档（布尔 = 全语种同档；数组 = 逐语言布尔）
      const hardLang = Array.isArray(item.hard) ? item.hard[i] : item.hard;
      if (n > limit && hardLang) {
        fails.push(row);
      } else if (!hardLang || n > limit) {
        infos.push(row);
      }
    }
  }

  console.log(`[check-i18n] 预算键 ${BUDGET.length} ×3 语逐键实测（${checked} 值取到；推导式见脚本 BUDGET 注释）。`);
  for (const [key, lang, n, limit, over] of infos) {
    console.log(`  INFO（软预算行）${key} / ${lang} / 实测 ${n} / 上限 ${limit} / 超出 ${over}`);
  }
  if (fails.length > 0) {
    console.error("[check-i18n] FAIL——超限键清单（键 / 语言 / 实测字符数 / 上限 / 超出量）：");
    for (const [key, lang, n, limit, over] of fails) {
      console.error(`  FAIL ${key} / ${lang} / ${n} / ${limit} / +${over}`);
    }
    process.exitCode = 1;
  } else {
    console.log("[check-i18n] 硬门禁键全部达标；软预算行仅 INFO 不判挂。");
  }
} finally {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
}
