#!/usr/bin/env node
/**
 * ============================================================================
 * 对比度审计脚本·静态档（p4-spec §7 A10；零第三方依赖，Node >= 18）
 * ============================================================================
 *
 * 口径（research-a11y §6.2 公式）：
 *   相对亮度  L = 0.2126·R + 0.7152·G + 0.0722·B
 *   R,G,B = c/255，当 c/255 ≤ 0.03928 取 c/12.92，否则 ((c/255+0.055)/1.055)^2.4
 *   对比度 = (L亮 + 0.05) / (L暗 + 0.05)
 *   rgba 合成（半透明层叠不透明底）：out = α·fg + (1−α)·bg（逐通道）
 *
 * 判定（research-a11y §6.1）：正文 ≥ 4.5:1；非文本指示器（焦点环 / 主色面）≥ 3:1；
 * 阈值为下限、不得四舍五入——比较用 >= 且保留三位以上小数。
 *
 * 浅色语义色豁免白名单（显式内置；登记于设计规范 5.3——语义色现状冻结，
 * 色盲友好开关提供达标替代组）：浅色 rise #00B42A / fall #F53F3F 对白底。
 * 深色组无豁免（双口径强制 ≥4.5）。
 *
 * 23 组对（research-a11y §6.4 实测值逐一复现；卡底为 rgba 材质底对页底精确合成，
 * 消除研究静态复测用近似卡底的 ≤0.09 口径差）：
 *   浅色：正文 / 次 / 三级 对 白；涨 / 跌 对 白（豁免）；白 对 主色（主按钮文字）；
 *         色盲友好涨（蓝）对 白；色盲友好涨（蓝）对浅色卡合成底；
 *         来源标签深字对三色染底（验收 T2-4 增补）；
 *         描述标签 / 空态说明次级令牌对页底（T3-1 / T3-2 增补）；
 *         离线快照橙 Tag 加深字色（T3-3 增补）。
 *   深色：正文 / 次 / 三级 对 深色卡合成底；提亮主色对页底（≥3 焦点环口径）；
 *         涨 / 跌 对 卡合成底；色盲友好涨 / 跌 对 卡合成底；
 *         文字按钮提亮主色 / 跳链底色白字（验收 T2-2 / T2-3 增补）。
 *
 * 浏览器档（computed-style 走查口径，research-a11y §6.3 原文——在 dev 页控制台执行）：
 *   (() => {
 *     const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
 *     const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
 *     const parse = (s) => (s.match(/[\d.]+/g) ?? ["255", "255", "255", "1"]).map(Number);
 *     const over = (fg, bg) => { const a = fg[3] ?? 1; return [0,1,2].map((i) => a*fg[i]+(1-a)*bg[i]).concat([1]); };
 *     const bgOf = (el) => { let acc=[255,255,255,1]; let n=el; while(n){acc=over(parse(getComputedStyle(n).backgroundColor),acc); if(acc[3]>=1)break; n=n.parentElement;} return acc; };
 *     const bad=[];
 *     for (const el of document.querySelectorAll("body *")) {
 *       const cs=getComputedStyle(el);
 *       if(cs.visibility==="hidden"||cs.display==="none")continue;
 *       if(el.getClientRects().length===0)continue;
 *       const hasText=[...el.childNodes].some((n)=>n.nodeType===3&&n.textContent.trim());
 *       if(!hasText)continue;
 *       const bg=bgOf(el); const fg=over(parse(cs.color),bg);
 *       const px=parseFloat(cs.fontSize); const bold=parseInt(cs.fontWeight,10)>=700;
 *       const need=px>=24||(px>=18.5&&bold)?3:4.5;
 *       const l1=lum(fg[0],fg[1],fg[2]),l2=lum(bg[0],bg[1],bg[2]);
 *       const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
 *       if(ratio<need-1e-9)bad.push({el,text:el.textContent.trim().slice(0,24),ratio:ratio.toFixed(3),need});
 *     }
 *     console.table(bad); return bad;
 *   })();
 *
 * 用法：node scripts/check-a11y-contrast.mjs（或 npm run check:a11y）。
 * 本脚本进验收、不进构建门禁（p4-spec §7 A10）。
 */
import assert from "node:assert/strict";

/** 颜色解析：#RGB / #RRGGBB / rgb() / rgba() → [r, g, b, a] */
function parseColor(s) {
  const str = s.trim();
  if (str.startsWith("#")) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return [0, 1, 2].map((i) => Number.parseInt(hex[i] + hex[i], 16)).concat([1]);
    }
    return [0, 1, 2]
      .map((i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16))
      .concat([1]);
  }
  const nums = str.match(/[\d.]+/g);
  assert.ok(nums && nums.length >= 3, `无法解析颜色：${s}`);
  return nums.slice(0, 3).map(Number).concat(nums[3] !== undefined ? Number(nums[3]) : 1);
}

/** rgba 合成：fg 叠在 bg 之上（逐通道），结果恒不透明 */
function over(fg, bg) {
  const a = fg[3] ?? 1;
  return [0, 1, 2].map((i) => a * fg[i] + (1 - a) * bg[i]).concat([1]);
}

function luminance(rgb) {
  const [r, g, b] = rgb;
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------------------------------------------------------------------------
// 令牌静态值（与 src/data/defaults.ts THEME / THEME_DARK、global.css :root 双块对账；
// 改令牌须同步本清单——静态档审计以「登记值」为对象）
// ---------------------------------------------------------------------------
const LIGHT_PAGE = "#F8F7F3"; // V2（p6-spec §3）：画布暖白微偏，与 defaults.ts THEME.bgPage / global.css :root 同步
const DARK_PAGE = "#17171A";
const LIGHT_CARD_COMPOSITE = over(parseColor("rgba(255,255,255,0.72)"), parseColor(LIGHT_PAGE));
const DARK_CARD_COMPOSITE = over(parseColor("rgba(35,35,36,0.92)"), parseColor(DARK_PAGE));

const rgb = (c) => parseColor(c).slice(0, 3).join(",");

/** 审计对：fg / bg（bg 传合成结果或静态值）、阈值、豁免白名单、研究 §6.4 实测参考值 */
const PAIRS = [
  // —— 浅色主题（11 组）——
  { name: "浅 正文 #1D2129 / 白", fg: "#1D2129", bg: [255, 255, 255, 1], need: 4.5, ref: 16.13 },
  { name: "浅 次级 #646E7A / 白", fg: "#646E7A", bg: [255, 255, 255, 1], need: 4.5, ref: 5.18 },
  { name: "浅 三级 #4E5969 / 白", fg: "#4E5969", bg: [255, 255, 255, 1], need: 4.5, ref: 7.1 },
  { name: "浅 涨 #00B42A / 白（豁免白名单）", fg: "#00B42A", bg: [255, 255, 255, 1], need: 4.5, ref: 2.78, exempt: true },
  { name: "浅 跌 #F53F3F / 白（豁免白名单）", fg: "#F53F3F", bg: [255, 255, 255, 1], need: 4.5, ref: 3.71, exempt: true },
  { name: "浅 白 / 主色 #4A6FA5（主按钮文字）", fg: "#FFFFFF", bg: "#4A6FA5", need: 4.5, ref: 5.11 },
  { name: "浅 色盲涨蓝 #0072B2 / 白", fg: "#0072B2", bg: [255, 255, 255, 1], need: 4.5, ref: 5.19 },
  { name: "浅 色盲涨蓝 #0072B2 / 卡合成底", fg: "#0072B2", bg: LIGHT_CARD_COMPOSITE, need: 4.5, ref: null },
  // —— 验收 T2-4 增补：来源标签文字改深色（global.css 覆盖规则）后的三组实色对 ——
  { name: "浅 来源标签 #1D2129 / 蓝染底 #E8F7FF", fg: "#1D2129", bg: "#E8F7FF", need: 4.5, ref: 14.73 },
  { name: "浅 来源标签 #1D2129 / 绿染底 #E8FFEA", fg: "#1D2129", bg: "#E8FFEA", need: 4.5, ref: 15.3 },
  { name: "浅 来源标签 #1D2129 / 橙染底 #FFF7E8", fg: "#1D2129", bg: "#FFF7E8", need: 4.5, ref: 15.15 },
  // —— 验收 T3-1 / T3-2 增补：Descriptions 标签与空态说明改次级令牌后的页底实色对 ——
  // V2（p6-spec §3）：页底改 #F8F7F3，ref 以脚本 rgba 合成底口径实测值回填 4.83
  { name: "浅 描述标签/空态说明 #646E7A / 页底 #F8F7F3", fg: "#646E7A", bg: "#F8F7F3", need: 4.5, ref: 4.83 },
  // —— 验收 T3-3 增补：离线快照橙 Tag 文字加深（orange-8）后的实色对 ——
  { name: "浅 离线快照 #AD4E00 / 橙染底 #FFF7E8", fg: "#AD4E00", bg: "#FFF7E8", need: 4.5, ref: 5.1 },
  // —— 深色主题（10 组，无豁免）——
  { name: "深 正文 #F2F3F5 / 卡合成底", fg: "#F2F3F5", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 14.31 },
  // V3（p6-spec §3）：深色次级文字 #A6B0C3（冷偏微提亮），ref 以脚本 rgba 合成底口径实测值回填 7.28
  { name: "深 次级 #A6B0C3 / 卡合成底", fg: "#A6B0C3", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 7.28 },
  { name: "深 三级 #8F95A0 / 卡合成底", fg: "#8F95A0", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 5.28 },
  { name: "深 提亮主色 #7B9FD1 / 页底（焦点环 ≥3 非文本口径）", fg: "#7B9FD1", bg: DARK_PAGE, need: 3, ref: 6.58 },
  { name: "深 涨 #27C346 / 卡合成底", fg: "#27C346", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 6.79 },
  { name: "深 跌 #F98D86 / 卡合成底", fg: "#F98D86", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 6.95 },
  { name: "深 色盲涨 #56B4E9 / 卡合成底", fg: "#56B4E9", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 6.88 },
  { name: "深 色盲跌 #E69F00 / 卡合成底", fg: "#E69F00", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 7.05 },
  // —— 验收 T2-2 / T2-3 增补：深色文字按钮提亮主色、跳链底色固定浅色品牌主色 ——
  { name: "深 文字按钮提亮主色 #7B9FD1 / 卡合成底", fg: "#7B9FD1", bg: DARK_CARD_COMPOSITE, need: 4.5, ref: 5.84 },
  { name: "深 白 / 跳链底 #4A6FA5", fg: "#FFFFFF", bg: "#4A6FA5", need: 4.5, ref: 5.11 },
];

let violations = 0;
const rows = [];
for (const pair of PAIRS) {
  const fg = parseColor(pair.fg);
  const bg = typeof pair.bg === "string" ? parseColor(pair.bg) : pair.bg;
  const ratio = contrast(fg, bg);
  const pass = ratio >= pair.need - 1e-9;
  if (!pass && !pair.exempt) violations += 1;
  rows.push(
    `${pass || pair.exempt ? "✅" : "❌"} ${pair.name}  实测 ${ratio.toFixed(2)}:1` +
      (pair.ref ? `（研究登记 ${pair.ref}:1）` : "") +
      (pass ? "" : pair.exempt ? "  → 白名单豁免" : `  → 违规（阈值 ${pair.need}:1）`),
  );
  // 复现核对：有登记值的对与登记值方向一致（同一静态值差异应 < 0.1，材质合成口径差上限）
  if (pair.ref !== null) {
    assert.ok(
      Math.abs(ratio - pair.ref) < 0.1,
      `${pair.name} 与研究登记值偏离过大：实测 ${ratio.toFixed(3)} vs 登记 ${pair.ref}`,
    );
  }
}

for (const row of rows) console.log(row);

if (violations > 0) {
  console.error(`\n[check-a11y] 静态档对比度审计未通过：白名单外违规 ${violations} 处。`);
  process.exit(1);
}
console.log(
  `\n[check-a11y] 静态档对比度审计通过：${PAIRS.length} 组令牌对，白名单外违规 0 处` +
    `（浅色涨跌语义色为显式登记豁免；卡底为 rgba 材质对页底精确合成）。`,
);
