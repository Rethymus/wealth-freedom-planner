/**
 * 面板⑨「公式原理与数据依据」数据层（docs/p3-spec.md §2；查证记录见 docs/research-video-data.md）。
 * 纪律：
 * - 核证等级三级——official=官方核证（官方原文页面已直读）、media=媒体核证（官方发布数字经
 *   两家及以上独立媒体转载核对）、video=视频口径（仅见于原视频或分析假设，未独立查证，
 *   不参与本工具计算，仅供理解假设来源）；
 * - value / source / year / scope 为简中数据口径（不入 i18n，同 presets.note 惯例），
 *   链条环节标签走 insights.chain* i18n 键（labelKey 静态映射，禁用模板串拼键）；
 * - 本文件全部为展示数据，不参与任何计算；不得被 src/wasm/** 引用。
 */

/** 核证等级（与研究文档标注体系一一对应） */
export type InsightVerification = "official" | "media" | "video";

/** 单条数据依据（展示行） */
export interface InsightEntry {
  /** 数值（展示字符串，含单位） */
  value: string;
  /** 来源（机构与文件名，简中） */
  source: string;
  /** 数据年份或区间 */
  year: string;
  /** 口径说明（简中） */
  scope: string;
  /** 核证等级 */
  verification: InsightVerification;
}

/** 假设链条环节 */
export interface InsightChainStep extends InsightEntry {
  /** 环节标签 i18n 键（insights.chain* 键空间） */
  labelKey: string;
}

/** 育儿成本地区条目 */
export interface InsightChildCostRegion {
  /** 地区标签（简中；数据层惯例同 rentParams.city，不入 i18n） */
  region: string;
  /** 0–17 岁平均养育成本（万元） */
  costWan: number;
  /** 口径备注（简中，可选） */
  note?: string;
}

/** 假设链条：从存款利率到乘数 480（顺序即展示顺序；研究采纳清单 #1–#4） */
export const INSIGHT_CHAIN_STEPS: InsightChainStep[] = [
  {
    labelKey: "insights.chainDeposit1y",
    value: "0.95%",
    source: "主要全国性商业银行人民币存款挂牌利率（同花顺财经 / 证券日报报道核对）",
    year: "2025-05-20 生效",
    scope: "整存整取一年期挂牌利率，本次调整后首次降至 1% 以下；挂牌为大型国有银行口径，中小银行与大额存单实际利率可能更高",
    verification: "media",
  },
  {
    labelKey: "insights.chainDeposit5y",
    value: "1.30%",
    source: "主要全国性商业银行人民币存款挂牌利率（同花顺财经 / 证券日报报道核对）",
    year: "2025-05-20 生效",
    scope: "整存整取五年期挂牌利率",
    verification: "media",
  },
  {
    labelKey: "insights.chainCoreInflation",
    value: "1.2%（视频口径 1.0%）",
    source: "国家统计局 2025 年 12 月 CPI 发布（2026-01-09）",
    year: "2025-12",
    scope: "扣除食品和能源的核心 CPI 同比；视频口径 1.0% 与发布值 1.2% 不一致，按发布值展示",
    verification: "media",
  },
  {
    labelKey: "insights.chainSsf",
    value: "7.39%",
    source: "全国社会保障基金理事会《全国社会保障基金 2024 年度报告》（官网 2025-09-30 发布，原文已直读）",
    year: "2000–2024",
    scope: "基金自成立以来至 2024 年末年均投资收益率（累计投资收益额 19,009.98 亿元）；机构组合层面历史平均值，不代表个人账户实际可得收益。2025 年报更新口径：成立以来年均 7.62%（截至 2025 年末，2026-09-01 发布）",
    verification: "official",
  },
  {
    labelKey: "insights.chainAnnuity",
    value: "6.17%",
    source: "人社部社会保险基金监管局《2024 年度全国企业年金基金业务数据摘要》（2025-03 发布，经东方财富 / 财经网转载核对）",
    year: "2007–2024",
    scope: "自 2007 年市场化投资运营以来 18 年平均年化收益率；另经人社部 2022 年度口径（16 年 6.58%）代入复算 ≈6.18% 吻合",
    verification: "media",
  },
  {
    labelKey: "insights.chainFeeDrag",
    value: "2–3 个百分点（显性费率锚 1.4pp）",
    source: "原视频估计；显性部分锚定证监会 2023 年公募基金费率改革（主动权益类管理费 ≤1.2% + 托管费 ≤0.2%，央广网 / 新浪财经报道核对）",
    year: "2023 政策口径 / 视频口径",
    scope: "合计含申赎费用、交易损耗与投资者申赎择时行为损耗，为宽口径估计，未经独立研究证实；显性费率 1.4pp 为政策上限口径",
    verification: "video",
  },
  {
    labelKey: "insights.chainNominal",
    value: "4%–4.5%（本工具默认 4.5%）",
    source: "规划假设（原视频）",
    year: "—",
    scope: "无单一权威来源的分析性假设；量级与多资产组合长期历史收益的一般区间一致",
    verification: "video",
  },
  {
    labelKey: "insights.chainInflation",
    value: "2%（本工具默认 2.0%）",
    source: "规划假设（原视频）；已核证实际值：国家统计局历年 CPI（2022 +2.0%、2023 +0.2%、2024 +0.2%、2025 全年持平）",
    year: "2022–2025",
    scope: "四年算术均值 ≈0.6%；视频的「约 2%」高于近年实际，作为长期规划假设属偏保守（稳健方向）",
    verification: "video",
  },
  {
    labelKey: "insights.chainReal",
    value: "2%–2.5%",
    source: "由上两环按费雪近似复算",
    year: "—",
    scope: "(1+4%)/(1+2%)−1 ≈ 1.96%、(1+4.5%)/(1+2%)−1 ≈ 2.45%，取整为 2%–2.5%（算术自洽）",
    verification: "video",
  },
  {
    labelKey: "insights.chainMultiplier",
    value: "480（= 12 ÷ 2.5%）",
    source: "由上一环复算；「480 法则」由此得名",
    year: "—",
    scope: "12 ÷ 0.025 = 480；乘数含义：每 480 元本金支撑 1 元/月的终身开销",
    verification: "video",
  },
];

/** 市场平均消费参考（研究采纳清单 #7） */
export const INSIGHT_MARKET_ENTRIES: InsightEntry[] = [
  {
    value: "2,456 元/月（29,476 元/年）",
    source: "国家统计局《2025 年居民收入和消费支出情况》（2026-01-19 发布，官方原文已直读）",
    year: "2025",
    scope: "全国居民人均消费支出；口径含居住、医疗保健、教育文化娱乐",
    verification: "official",
  },
  {
    value: "2,989 元/月（35,869 元/年）",
    source: "国家统计局《2025 年居民收入和消费支出情况》（2026-01-19 发布，官方原文已直读）",
    year: "2025",
    scope: "城镇居民口径；本工具默认月开销 2,990 元/月即参考此口径取整",
    verification: "official",
  },
];

/** 分城市育儿成本参考（研究采纳清单 #5：以《中国生育成本报告（2024 版）》原文为准） */
export const INSIGHT_CHILD_COST_REGIONS: InsightChildCostRegion[] = [
  { region: "全国（0–17 岁平均）", costWan: 53.8 },
  { region: "上海", costWan: 101, note: "视频口径 108 万与报告原文不符" },
  { region: "北京", costWan: 93.6, note: "视频口径 100 万与报告原文不符" },
  { region: "最低省份：西藏", costWan: 34.9, note: "视频称贵州 43 万最低，未能复核，不采纳" },
];

/** 医疗支出参考（研究采纳清单 #6） */
export const INSIGHT_HEALTH_ENTRIES: InsightEntry[] = [
  {
    value: "6,454.4 元/年",
    source: "国家卫生健康委《2024 年我国卫生健康事业发展统计公报》（2025-12 发布，官方解读页访问受限，数字经媒体转载核对）",
    year: "2024",
    scope: "全国人均卫生总费用（年口径）；9.09 万亿总量 ÷ 人口 ≈ 6,454 元，算术一致",
    verification: "media",
  },
  {
    value: "约 20 万（保守区间 15–50 万）",
    source: "原视频估算",
    year: "2024 年价格水平",
    scope: "终身口径估算，无官方终身支出口径；等额不折现上限参考：6,454.4 元/年 × 80 年 ≈ 51.6 万，实际就医强度随年龄后移，中青年起点可明显低于上限",
    verification: "video",
  },
  {
    value: "二线 15–30 万；一线 30–60 万",
    source: "原视频估算",
    year: "—",
    scope: "终身口径估算，未独立查证；可作为健康预留的可编辑预设参考",
    verification: "video",
  },
];
