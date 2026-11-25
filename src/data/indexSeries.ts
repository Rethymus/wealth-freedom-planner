/**
 * 指数年度收益序列数据层（蒙特卡洛历史自助抽样的抽样源）。
 * 数值口径与来源以注释为准（数据口径不入 i18n，界面显示名走 i18n mc.index* 键）；
 * 查证记录见 docs/p1-spec.md §0。2026 年为不完整年度，一律不录入。
 *
 * P11 时效机读说明：本文件有意不放时效元数据注释块（规范 §2 登记的有意偏差）——
 * 时效元数据走下方 IndexSeries 结构化字段 fetchedAt / sourceUrl（单一真源；
 * 注释块 + 字段双写必漂移），由 check:data 组 J3 机读断言。年度序列类过期判据 L3：
 * 上年收宫后 Q1 未补录年度值即 soft。
 */

/** 指数标识（中性代码；界面显示名经 i18n mc.index* 键）。
 * 只增不改：旧 id 是分享链接载荷组成部分（share.ts 编码/解码白名单），改名即断链。
 * sp500long（C3 标普500 长历史）本轮缓置（docs/p11-spec.md §7.3-3 闸门裁决：Phase A/B
 * 实测后余量 < 2,200B 直落条件不成立，回收盘点后仍不足 → 缓置登记下轮评估；
 * 录入轮已完成 Damodaran 全表实读（1972=+18.76…2025=+17.78，54 值），落库数据可在
 * 下轮余量回收后直接登记——见实施报告与 docs/data-dictionary.md 台账行） */
export type IndexId = "csi300" | "sp500" | "csi300tr" | "cba00101";

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
  /** 收益口径说明（简中；「价格指数」不含股息、「总回报/财富口径」含股息或票息再投资） */
  kind: "price" | "total";
  /** 口径备注（简中） */
  note: string;
  // —— P11 新增四字段（区间/溯源元数据；end/count 永不落盘，经 seriesRange() 派生）——
  /** 显示名 i18n 键（收编面板硬编码映射；选择器 options 由本字段派生） */
  nameKey: string;
  /** 口径说明 i18n 键（price→不含股息 / total→含股息再投资 / 债类财富口径→含票息） */
  kindKey: string;
  /** 拉取/读取日期（ISO 8601 YYYY-MM-DD；机读，check:data 组 J3 断言锚） */
  fetchedAt: string;
  /** 溯源 URL（机读；不入 UI 文案——口径句已属长文案） */
  sourceUrl?: string;
}

/** 区间三件套单一派生（end/count 永不落盘——冗余落盘必漂移，组 J2 兜底断言单一真源） */
export function seriesRange(s: IndexSeries): { start: number; end: number; count: number } {
  return {
    start: s.firstYear,
    end: s.firstYear + s.annualReturnsPct.length - 1,
    count: s.annualReturnsPct.length,
  };
}

export const INDEX_SERIES: Record<IndexId, IndexSeries> = {
  csi300: {
    id: "csi300",
    firstYear: 2005,
    // 沪深300（000300）年度价格涨跌幅：经行情历史接口按年末收盘价独立复算
    // （2026-11-18 拉取，与公开整理逐值一致）。价格指数口径，不含股息（约 2%/年），
    // 作为抽样源会略低估总回报——见 note。2025 年值（X1 尾部追加格）：年末收盘
    // 4,629.94 ÷ 上年末 3,934.91 − 1 = +17.66%（2026-11-25 行情接口复算；与 Wind
    // 年末收盘口径转述 +17.66% 一致，上年末基准值与既有 2024 格复算链同源）。
    annualReturnsPct: [
      -7.66, // 2005（基日 2004-12-31 = 1000 点，年末收盘 923.45 推得）
      121.02, 161.55, -65.95, 96.71, -12.51, -25.01, 7.55, -7.65, 51.66,
      5.58, -11.28, 21.78, -25.31, 36.07, 27.21, -5.20, -21.63, -11.38, 14.68,
      17.66, // 2025（4,629.94 ÷ 3,934.91 − 1，2026-11-25 复算追加）
    ],
    source: "沪深300（000300）年末收盘复算（行情历史接口，2026-11-18 拉取）",
    kind: "price",
    note: "价格指数口径（不含股息，约 2%/年），抽样结果略低估总回报。",
    nameKey: "mc.indexCsi300",
    kindKey: "mc.seriesPriceOnly",
    fetchedAt: "2026-11-25",
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
    nameKey: "mc.indexSp500",
    kindKey: "mc.seriesTotalReturn",
    fetchedAt: "2026-11-18",
  },
  csi300tr: {
    id: "csi300tr",
    firstYear: 2005,
    // 沪深300全收益（中证 H00300）年度涨跌幅：中证指数官网历史行情按年末收盘价独立
    // 复算（csindex.com.cn 指数表现接口逐年末值；2026-11-25 拉取）。2017–2025 与
    // GuruFocus H00300 年度表逐值一致（2026-11-24 二手交叉验证通过）；2005 年值
    // 与价格指数同值（官方接口早期序列重建口径，与价格指数重合，如实登记）。
    // 并列新增、不替换 csi300（旧 id 已入分享载荷）；2026 不完整年度不录入。
    annualReturnsPct: [
      -7.66, // 2005（基日 2004-12-31 = 1000；官方接口 2005 年末 923.45）
      125.23, 163.28, -65.31, 95.95, -12.98, -22.46, 9.8, -5.33, 55.85,
      7.22, -9.26, 24.25, -23.64, 39.19, 29.89, -3.52, -19.84, -9.14, 18.24,
      20.98, // 2025
    ],
    source: "沪深300全收益（H00300）年末收盘复算（中证指数官网）",
    kind: "total",
    note: "全收益口径（含股息再投资）。",
    nameKey: "mc.indexCsi300Tr",
    kindKey: "mc.seriesTotalReturn",
    fetchedAt: "2026-11-25",
    sourceUrl: "https://www.csindex.com.cn",
  },
  cba00101: {
    id: "cba00101",
    firstYear: 2002,
    // 中债-新综合财富指数（CBA00101）年度涨跌幅：中国债券信息网官方查询平台
    // （yield.chinabond.com.cn 单指数查询，财富指标总值）按年末财富指标值独立
    // 复算相邻年末比值（2026-11-25 实读取值）。基日 2001-12-31 = 100，2002 年起算。
    annualReturnsPct: [
      3.58, // 2002（年末 103.577 ÷ 基日 100）
      1.7, 0.44, 7.18, 2.42, 0.03, 10.45, 0.14, 1.96, 5.1,
      3.67, -0.29, 10.34, 8.18, 1.83, 0.26, 8.21, 4.59, 2.97, 5.09,
      3.3, 4.77, 7.6, 0.65, // 2025
    ],
    source: "中债-新综合财富指数（CBA00101）年末财富指标复算（中国债券信息网官方平台）",
    kind: "total",
    note: "财富口径（含票息按月再投资）。",
    nameKey: "mc.indexCba00101",
    kindKey: "mc.seriesTotalCoupon",
    fetchedAt: "2026-11-25",
    sourceUrl: "https://yield.chinabond.com.cn",
  },
};

/** 下拉展示顺序（与 Record 键序解耦，保证 UI 稳定；新序列追加尾部，既有顺序不变） */
export const INDEX_ORDER: IndexId[] = ["csi300", "sp500", "csi300tr", "cba00101"];
