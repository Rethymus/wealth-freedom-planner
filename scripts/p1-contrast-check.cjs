/* P1 验收：WCAG 对比度复算脚本（输入为 defaults.ts 登记的令牌值；输出各登记口径对比度） */
function hex2rgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function parse(c) {
  if (Array.isArray(c)) return { rgb: c, a: 1 };
  if (c.startsWith("#")) return { rgb: hex2rgb(c), a: 1 };
  const m = c.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(",").map((s) => parseFloat(s.trim()));
  return { rgb: [p[0], p[1], p[2]], a: p.length === 4 ? p[3] : 1 };
}
function over(fg, bg) {
  const f = parse(fg), b = parse(bg);
  return f.rgb.map((v, i) => Math.round(v * f.a + b.rgb[i] * b.a * (1 - f.a)));
}
function lum(c) {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
const white = [255, 255, 255];
const sec = hex2rgb("646E7A");
const cardLight = over("rgba(255,255,255,0.72)", "#f7f8fa");
const tintWhite = over("rgba(74,111,165,0.08)", "#ffffff");
const tintCard = over("rgba(74,111,165,0.08)", cardLight);
const topbar = over("rgba(74,111,165,0.95)", "#f7f8fa");
console.log("== 浅色 ==");
console.log("次级 #646E7A vs 白:", ratio(sec, white).toFixed(2), "(登记 5.18)");
console.log("次级 #646E7A vs 卡合成(0.72白叠f7f8fa):", ratio(sec, cardLight).toFixed(2), "(登记 5.10)");
console.log("次级 #646E7A vs 着色叠白:", ratio(sec, tintWhite).toFixed(2), "(登记 4.66)");
console.log("次级 #646E7A vs 着色叠卡(最不利):", ratio(sec, tintCard).toFixed(2), "(登记 ≈4.6)");
console.log("顶栏白字 vs topbar合成:", ratio(white, topbar).toFixed(2), "(登记 4.63)");
console.log("主色 #4A6FA5 vs 卡合成:", ratio(hex2rgb("4A6FA5"), cardLight).toFixed(2), "(登记 5.11)");
console.log("正文 #1D2129 vs 白:", ratio(hex2rgb("1D2129"), white).toFixed(2));
console.log("三级 #4E5969 vs 白:", ratio(hex2rgb("4E5969"), white).toFixed(2), "(登记 7.10)");
console.log("share-btn #4E5969 vs #F2F3F5:", ratio(hex2rgb("4E5969"), hex2rgb("F2F3F5")).toFixed(2));
const secD = hex2rgb("A9AEB8");
const cardD = over("rgba(35,35,36,0.92)", "#17171A");
const worstD = over("rgba(35,35,36,0.92)", "#ffffff");
console.log("== 深色 ==");
console.log("次级 #A9AEB8 vs 卡合成(0.92叠17171A):", ratio(secD, cardD).toFixed(2), "(登记 7.14)");
console.log("次级 #A9AEB8 vs 最不利透底(纯白):", ratio(secD, worstD).toFixed(2), "(登记 5.54)");
console.log("深色卡 vs 页 层叠:", ratio(cardD, hex2rgb("17171A")).toFixed(2), "(登记 1.14)");
