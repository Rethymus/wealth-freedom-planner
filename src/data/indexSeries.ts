/**
 * 指数年度收益序列数据层（蒙特卡洛历史自助抽样的抽样源）。
 * 数值口径与来源以注释为准（数据口径不入 i18n，界面显示名走 i18n mc.index* 键）；
 * 查证记录见 docs/p1-spec.md §0。2026 年为不完整年度，一律不录入。
 */

/** 指数标识（中性代码；界面显示名经 i18n mc.indexCsi300 / mc.indexSp500） */
export type IndexId = "csi300" | "sp500";

/** 蒙特卡洛收益模式（业务口径选择，随分享链接携带） */
export type MonteCarloReturnMode = "normal" | "bootstrap";

/** 指数年度收益序列 */
export interface IndexSeries {
  id: IndexId;
  /** 序列首个年度（annualReturnsPct[0] 对应该年度） */
  firstYear: number;
  /** 年度收益序列（百分点，如 14.68 表示 +14.68%），按年份升序 */
  annualReturnsPct: number[];
  /** 数据来源说明（简中，页面上以只读提示展示） */
  source: string;
  /** 收益口径说明（简中；「价格指数」不含股息、「总回报」含股息再投资） */
  kind: "price" | "total";
  /** 口径备注（简中） */
  note: string;
}

export const INDEX_SERIES: Record<IndexId, IndexSeries> = {
  csi300: {
    id: "csi300",
    firstYear: 2005,
    // 沪深300（000300）年度价格涨跌幅：经行情历史接口按年末收盘价独立复算
    // （2026-11-18 拉取，与公开整理逐值一致）。价格指数口径，不含股息（约 2%/年），
    // 作为抽样源会略低估总回报——见 note。
    annualReturnsPct: [
      -7.66, // 2005（基日 2004-12-31 = 1000 点，年末收盘 923.45 推得）
      121.02, 161.55, -65.95, 96.71, -12.51, -25.01, 7.55, -7.65, 51.66,
      5.58, -11.28, 21.78, -25.31, 36.07, 27.21, -5.20, -21.63, -11.38, 14.68,
    ],
    source: "沪深300（000300）年末收盘价复算（行情历史数据接口，2026-11-18 拉取）",
    kind: "price",
    note: "价格指数口径（不含股息，约 2%/年），抽样结果略低估总回报；20 个年度样本（2005–2024）。",
  },
  sp500: {
    id: "sp500",
    firstYear: 2005,
    // 标普500 年度总回报（含股息再投资）：Slickcharts「S&P 500 Total Returns by
    // Year」全表（2026-11-18 读取）。
    annualReturnsPct: [
      4.91, 15.79, 5.49, -37.00, 26.46, 15.06, 2.11, 16.00, 32.39, 13.69,
      1.38, 11.96, 21.83, -4.38, 31.49, 18.40, 28.71, -18.11, 26.29, 25.02,
      17.88, // 2025
    ],
    source: "标普500 年度总回报表（Slickcharts，2026-11-18 读取）",
    kind: "total",
    note: "总回报口径（含股息再投资）；21 个年度样本（2005–2025）。",
  },
};

/** 下拉展示顺序（与 Record 键序解耦，保证 UI 稳定） */
export const INDEX_ORDER: IndexId[] = ["csi300", "sp500"];
