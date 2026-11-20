/**
 * 展示格式化工具（纯函数，无副作用）。
 * 所有计算与币种无关，这里只负责把数值变成界面文案。
 */
import i18next from "i18next";
import { CURRENCIES } from "../data/defaults";

/** UI 语言 → Intl locale（zh 双语种共用 zh-CN 数字习惯；en → en；未知回落 zh-CN） */
function uiLocale(): string {
  return i18next.language === "en" ? "en" : "zh-CN";
}

/** 币种符号（未收录的币种直接显示代码） */
export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** 千分位数值（最多 digits 位小数，整数不带小数点） */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(uiLocale(), { maximumFractionDigits: digits }).format(value);
}

/** 金额（符号 + 千分位） */
export function formatMoney(value: number, symbol: string, digits = 2): string {
  return `${symbol}${formatNumber(value, digits)}`;
}

/**
 * 金额（符号 + 千分位，固定 digits 位小数）。
 * 表格/并列金额使用：maximumFractionDigits 会裁剪尾零（¥3,250 / ¥991,128.1），
 * 导致同一列内精度参差；此处 minimum = maximum = digits 保证列内一致。
 */
export function formatMoneyFixed(value: number, symbol: string, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${symbol}${new Intl.NumberFormat(uiLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}`;
}

/** 元 → 万元 */
export function toWan(value: number): number {
  return value / 10_000;
}

/** 万元展示（value 单位为元） */
export function formatWan(value: number, digits = 1): string {
  return `${formatNumber(toWan(value), digits)} 万`;
}

/** 图表轴紧凑数值（p4-spec §3.5）：按 UI 语言走 Intl compact（zh → 万进制「16万」；
 *  en → 「160K」），与币种无关，替换既有 `${Math.round(v / 10000)}${t("units.wan")}`
 *  写法——「万」是 CNY 量词，换算后失义；换算后的数值以紧凑口径成轴。 */
export function formatCompactAxis(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(uiLocale(), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * 480 乘数展示：整数直接显示，非整数最多保留 2 位小数。
 * 与计算核心一致（baseline 以两位小数乘数计算临界值），保证「月开销 × 乘数」可复算临界值。
 */
export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return formatNumber(value, 2);
}

/** 百分点展示（value 为百分点数值，如 4.5 → "4.5%"） */
export function formatPercent(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}%`;
}

/** 本地时间展示（ISO 字符串 → 本地可读时间；空值返回调用点传入的 i18n 占位文案，非法原样返回） */
export function formatTimestamp(iso: string, emptyText: string): string {
  if (!iso) return emptyText;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString(uiLocale(), { hour12: false });
}
