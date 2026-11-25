/**
 * @data-meta
 *   YEAR: 2025               // GDP 列 = 世界银行 2025 年值；消费率列仍为 2024 年值（见下）
 *   CHECKED_AT: 2026-11-24   // 世行 API 采值轮（GDP 列 8 国逐值核对）
 *   NEXT_DUE: 2027-07        // 世行 WDI 年度更新窗口
 *   SOURCE_TYPE: official
 *   EXPIRY: L1
 *   SOURCE:
 *     - 世界银行 API NY.GDP.PCAP.PP.CD（快照 lastupdated 2026-11-11，api.worldbank.org 实查）
 *     - 国家统计局《2025年居民收入和消费支出情况》（2026-01-19 发布；R1 消费锚点）
 */
/**
 * 区域校验参考（用于对默认值与用户输入做合理性校验的统计口径）。
 *
 * 口径约定：
 * - gdpPerCapitaPppUsd：人均 GDP（PPP，当前国际元），取世界银行
 *   NY.GDP.PCAP.PP.CD 指标 2025 年值（API lastupdated 2026-11-11，2026-11 经
 *   api.worldbank.org 查证），四舍五入到百位；
 * - consumptionRatePct：居民（住户+NPISH）最终消费支出占 GDP 百分比，取世界银行
 *   NE.CON.PRVT.ZS 指标 2024 年值（该指标最新仍为 2024，各 note 注明「消费率为 2024 年值」），
 *   同一 API 快照，四舍五入到一位小数；
 * - engelCoeffRange：食品（烟酒）支出占消费支出比重的典型区间（0–1）。各国官方口径差异大
 *   （中国为「食品烟酒」八大类口径；日本为总务省家计调查二人以上世带；美/英为国民
 *   家计调查口径；德/澳/加为 Our World in Data 整理的 USDA 口径），仅作参考，不可直接横比；
 * - year：GDP 列对应 2025 年；恩格尔系数与消费率的自身年份在各 note 中注明。
 *
 * 「月开销偏离提示」用法建议：以中国城镇人均消费支出（2025 年 35,869 元/年，约 2,989 元/月，
 * 国家统计局）为锚，其他国家条目仅提供经济体量与消费率的相对参考，不做汇率换算结论。
 */
import type { RegionalBenchmark } from "./types";

/** 月开销偏离检测阈值：月开销低于锚点 low 倍或高于锚点 high 倍视为「显著偏离」（CurrencySection 使用） */
export const MONTHLY_EXPENSE_DEVIATION_THRESHOLDS = { low: 0.5, high: 2 } as const;

export const REGIONAL_BENCHMARKS: RegionalBenchmark[] = [
  {
    region: "中国城镇",
    countryCode: "CN",
    gdpPerCapitaPppUsd: 29300,
    consumptionRatePct: 40,
    engelCoeffRange: [0.26, 0.31],
    year: 2025,
    // 月开销偏离检测锚点（机器可读）：城镇人均消费支出 35,869 元/年 ÷ 12 ≈ 2,989 元/月
    monthlyConsumptionAnchorCny: 2989,
    source:
      "国家统计局《2025年居民收入和消费支出情况》（2026-01-19 发布）；世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）",
    note:
      "城镇居民人均消费支出 35,869 元/年（约 2,989 元/月，名义增长 3.8%），与默认月开销 2,990 元/月同口径（2025 年度）；" +
      "人均 GDP(PPP) 为 2025 年值、全国口径（城镇实际高于全国均值），用于跨经济体量参考；消费率为 2024 年值。",
  },
  {
    region: "美国",
    countryCode: "US",
    gdpPerCapitaPppUsd: 90000,
    consumptionRatePct: 67.9,
    engelCoeffRange: [0.11, 0.14],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；美国劳工统计局（BLS）Consumer Expenditure Survey 2023",
    note:
      "恩格尔区间依据 BLS CE 2023：食品（含外食）占总支出 12.9%；Our World in Data/USDA 口径仅约 6.8%（仅食品杂货类），口径差异大，横比时须注明。消费率为 2024 年值。",
  },
  {
    region: "德国",
    countryCode: "DE",
    gdpPerCapitaPppUsd: 75400,
    consumptionRatePct: 52.7,
    engelCoeffRange: [0.1, 0.13],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；Our World in Data「Share of consumer expenditure spent on food」（USDA 口径，2023）",
    note: "恩格尔区间依据 USDA 口径 2023 年值 11.6%（区间 ±1pp）；与德国联邦统计局官方「食品/饮料/烟草」口径（约 13%）大体相当。消费率为 2024 年值。",
  },
  {
    region: "英国",
    countryCode: "GB",
    gdpPerCapitaPppUsd: 64600,
    consumptionRatePct: 60.8,
    engelCoeffRange: [0.1, 0.12],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；GOV.UK「Family Food」（Defra）FYE 2024 / FYE 2025",
    note: "恩格尔区间依据 Defra Family Food：食品与非酒精饮料占支出 FYE2024 为 11.3%、FYE2025 为 10.9%。消费率为 2024 年值。",
  },
  {
    region: "日本",
    countryCode: "JP",
    gdpPerCapitaPppUsd: 55400,
    consumptionRatePct: 53.1,
    engelCoeffRange: [0.26, 0.29],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；日本总务省统计局「家計調査（家計収支編）」",
    note:
      "恩格尔区间依据总务省家计调查（二人以上世带）2024 年 28.3%（43 年来高位，2025 年约 28.6%）；单身世带约 35%，" +
      "Our World in Data/USDA 口径约 15.8%——日本官方口径显著偏高为已知口径差异，横比时须注明。消费率为 2024 年值。",
  },
  {
    region: "新加坡",
    countryCode: "SG",
    gdpPerCapitaPppUsd: 163400,
    consumptionRatePct: 30.7,
    engelCoeffRange: [0.15, 0.22],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；新加坡统计局（SingStat）2023 年 Household Expenditure Survey 摘要",
    note:
      "HES 2023：住房+食品+交通合计约 62% 月度家庭支出（食品与饮料服务月均 966 新元），食品单独占比未在本次检索中确证，" +
      "故恩格尔区间为宽幅参考值，精度低于其他条目。消费率为 2024 年值。",
  },
  {
    region: "澳大利亚",
    countryCode: "AU",
    gdpPerCapitaPppUsd: 71900,
    consumptionRatePct: 51.4,
    engelCoeffRange: [0.09, 0.12],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；Our World in Data「Share of consumer expenditure spent on food」（USDA 口径，2023）",
    note: "恩格尔区间依据 USDA 口径 2023 年值 9.9%（区间 ±1pp）。消费率为 2024 年值。",
  },
  {
    region: "加拿大",
    countryCode: "CA",
    gdpPerCapitaPppUsd: 66700,
    consumptionRatePct: 55.6,
    engelCoeffRange: [0.09, 0.12],
    year: 2025,
    source:
      "世界银行 NY.GDP.PCAP.PP.CD（2025）/ NE.CON.PRVT.ZS（2024）；Our World in Data「Share of consumer expenditure spent on food」（USDA 口径，2023）",
    note: "恩格尔区间依据 USDA 口径 2023 年值 9.7%（区间 ±1pp）。消费率为 2024 年值。",
  },
];
