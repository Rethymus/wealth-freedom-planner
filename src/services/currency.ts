/**
 * 币种展示换算（纯函数，无 React 依赖、无副作用；p4-spec §3.2）：
 * store 金额恒为 CNY 规范值；展示层按 rate（1 CNY = rate 单位展示币种）换算。
 * rate 缺失（接口未含该币种 / 获取失败 / 非有限正数）时调用方回退符号-only 模式。
 * 核心公式（wasm）零改动：换算全部在 TS 展示层完成。
 */

/** CNY 规范值 → 展示币种值（浮点乘法，保留符号与精度；展示格式化交给 format 层） */
export function cnyToDisplay(cny: number, rate: number): number {
  return cny * rate;
}

/** 展示币种输入值 → CNY 规范值：四舍五入到整数（规范口径为整数元，LIMITS.amount
 *  precision 0；取整把往返漂移限制在 ≤0.5 CNY）。负数按 Math.round 语义（向 +∞ 取整），
 *  输入字段金额域为非负，实际不触发。 */
export function displayToCny(displayValue: number, rate: number): number {
  return Math.round(displayValue / rate);
}

/** 从汇率表取指定币种汇率：CNY 恒 1；缺失 / 非有限 / ≤0 → null（符号-only 模式信号） */
export function pickRate(rates: Record<string, number>, code: string): number | null {
  if (code === "CNY") return 1;
  const r = rates[code];
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null;
}
