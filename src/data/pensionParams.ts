/**
 * 社保养老金参数数据层（中国城镇职工基本养老保险口径，简化估算）。
 * 数值口径与来源以注释为准；查证记录见 docs/p1-spec.md §0。
 * 界面文案在 i18n pension.* 键空间；本文件注释为数据口径（不入 i18n）。
 */

/** 计发月数对照表（键 = 退休年龄整数，值 = 月数）。
 * 国发〔2005〕38号附表口径：60 岁 139 / 55 岁 170 / 50 岁 195。
 * 查证状态：60 岁 139 经人社部公开解读报道独立印证（2015-03-08/2012-06-15 稿）；
 * 50/55 岁为通行表值，待数据研究员对照法规原文复核。仅收录面板可选的三档。 */
export const PENSION_MONTHS_TABLE: Record<number, number> = {
  50: 195,
  55: 170,
  60: 139,
};

/** 计发月数生效值：联动中按退休年龄查对照表，对照表未收录或已解除联动时用用户手填值。
 * 唯一口径函数——面板显示 / wasm 提交 / 分享链接编码三处必须取同一值
 * （分享链接联动态须携带面板所见表值，发送/接收两侧所见一致），禁止各处内联重推 */
export function effectiveMonthsDivisor(
  monthsDivisor: number,
  retireAge: number,
  monthsSynced: boolean,
): number {
  const tableMonths = PENSION_MONTHS_TABLE[retireAge];
  return monthsSynced && tableMonths ? tableMonths : monthsDivisor;
}

/** 计发口径社会平均工资锚点（元/月）。
 * 来源：国家统计局 2025-05-16 发布「2024 年全国城镇非私营单位就业人员年平均工资
 * 124,110 元」（名义增长 2.8%）；124,110 ÷ 12 = 10,342.5 → 取整 10,343。
 * 私营单位口径为 69,476 元/年（约 5,790 元/月），显著更低——用户应按所在省市
 * 养老金计发基数自行修改。2026-11-18 查证。 */
export const PENSION_AVG_WAGE_ANCHOR_CNY = 10343;

/** 数据口径说明（简中，页面上以只读提示展示） */
export const PENSION_WAGE_SOURCE_NOTE =
  "国家统计局：2024 年全国城镇非私营单位就业人员年平均工资 124,110 元（2025-05-16 发布）；" +
  "各省市养老金计发基数不同，请按当地人社部门公布值修改。基础养老金公式为通行制度口径" +
  "（法规原文链接待补录）；简化估算，不构成社保咨询。";

/** 社保养老金面板输入（业务切片，分享链接可携带；乘数与附加预留取自基础参数卡当前值） */
export interface PensionInputs {
  /** 当前年龄（16–70，整数） */
  currentAge: number;
  /** 预期退休年龄（40–75，整数；计发月数默认按对照表联动） */
  retireAge: number;
  /** 预期截至退休的累计缴费年限（0–50，整数；含已缴，不含视同缴费折算） */
  contribYears: number;
  /** 平均缴费基数指数（小数形式：0.6 ≈ 按社平工资 60% 缴费，1.0 = 恰好等于社平） */
  contribIndex: number;
  /** 个人账户余额估计（元；可在电子社保卡/当地社保 App 查询） */
  accountBalance: number;
  /** 计发口径社会平均工资（元/月；默认取 PENSION_AVG_WAGE_ANCHOR_CNY） */
  avgMonthlyWage: number;
  /** 计发月数（默认按 PENSION_MONTHS_TABLE 随退休年龄联动，手动修改即解除） */
  monthsDivisor: number;
}
