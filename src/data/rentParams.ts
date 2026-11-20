/**
 * 城市租售参数（买房收租面板的城市预设）。
 *
 * 口径约定（与 src/wasm/bridge.ts RentalAnalysisInput 对齐）：
 * - rentYieldRangePct：毛租金收益率（年租金 ÷ 房价）典型区间，百分点；
 *   主来源 Numbeo 城市房产页（市中心 / 非市中心两个点值，取整后加少量余量构成区间）；
 * - holdingCostDefaults：持有成本默认值，多数为「市场惯例/当地税政」整理值（note 中注明），
 *   金额字段按当地货币、以典型中等户型（约 70–90 ㎡ / 1–2 房公寓）为基准；
 * - propertyFeeMonthly / otherAnnualCost / maintenanceAnnualRatePct 的拆分习惯因城市而异
 *   （如房产税并入其他成本或维护费率），均在 note 中说明。
 *
 * year 均记 2025（本数据集的基准年）；Numbeo 为滚动 18 个月窗口、2026-11 读取，
 * 实际数据窗口约覆盖 2025-05 至 2026-11，已在各 note 注明。
 */
import type { CityRentParams } from "./types";

const NUMBEO_NOTE =
  "收益率取 Numbeo 城市房产页（numbeo.com，滚动 18 个月窗口，2026-11 读取）";

export const CITY_RENT_PARAMS: CityRentParams[] = [
  {
    city: "北京",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier1",
    example: true,
    representative: true,
    currency: "CNY",
    rentYieldRangePct: [1.8, 2.0],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 280,
      otherAnnualCost: 3600,
      rentTaxRatePct: 2.5,
    },
    source: `${NUMBEO_NOTE}；个人出租住房综合征收率见地方税务公告`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 1.90%、非市中心 1.89%（区间 ±0.1pp 余量）。" +
      "持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 2–3 元/㎡/月；空置按约 1 个月/年；" +
      "其他年化成本含中介费摊销与装修摊销。租金税：北京个人出租住宅月租 ≤10 万元按 2.5% 综合征收率（地方税务公告，2025 年报道口径）。" +
      "本表不构成投资建议。",
  },
  {
    city: "上海",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier1",
    example: true,
    currency: "CNY",
    rentYieldRangePct: [1.9, 2.1],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 280,
      otherAnnualCost: 3600,
      rentTaxRatePct: 2.5,
    },
    source: `${NUMBEO_NOTE}；个人出租住房综合征收率见地方税务公告`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.04%、非市中心 2.04%（区间 ±0.1pp 余量）。" +
      "持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 2–3 元/㎡/月；空置按约 1 个月/年。" +
      "租金税：上海个人出租住宅月租 ≤10 万元按 2.5% 综合征收率（地方税务公告，2025 年报道口径）。" +
      "本表不构成投资建议。",
  },
  {
    city: "深圳",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier1",
    currency: "CNY",
    rentYieldRangePct: [1.4, 1.7],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 300,
      otherAnnualCost: 3600,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}；综合征收率未逐一确证，取广州 4% 口径的保守值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 1.43%、非市中心 1.56%（为 11 城中最低，房价相对租金偏高）。" +
      "持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 2.5–3.5 元/㎡/月；空置按约 1 个月/年。" +
      "租金税：深圳个人出租住宅核定综合征收率未在本次检索中确证，取京沪 2.5% 与广州 4% 之间的保守值 4%。" +
      "本表不构成投资建议。",
  },
  {
    city: "广州",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier1",
    currency: "CNY",
    rentYieldRangePct: [1.5, 1.7],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 240,
      otherAnnualCost: 3600,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}；个人出租住房综合征收率见地方税务公告`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 1.52%、非市中心 1.62%（区间 ±0.1pp 余量）。" +
      "持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 2–3 元/㎡/月；空置按约 1 个月/年。" +
      "租金税：广州个人出租自有住房月租 2,000–30,000 元按 4% 综合征收率（地方税务公告，2025 年报道口径）。" +
      "本表不构成投资建议。",
  },
  {
    city: "成都",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier2",
    example: true,
    representative: true,
    currency: "CNY",
    rentYieldRangePct: [2.5, 2.9],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 180,
      otherAnnualCost: 2400,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}；综合征收率未逐一确证，取 4% 保守值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.58%、非市中心 2.79%（新一线城市典型 2.3%–2.9%）。" +
      "持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 1.5–2.5 元/㎡/月；空置按约 1 个月/年。" +
      "租金税：成都个人出租住宅亦有核定综合征收率优惠但未在本次检索中确证，取 4% 保守值。" +
      "本表不构成投资建议。",
  },
  {
    city: "武汉",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier2",
    currency: "CNY",
    rentYieldRangePct: [2.3, 2.8],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 180,
      otherAnnualCost: 2400,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}；综合征收率未逐一确证，取 4% 保守值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.31%、非市中心 2.74%。持有成本为市场惯例整理值（约 90㎡ 户型）：物业费约 1.5–2.5 元/㎡/月；空置按约 1 个月/年。" +
      "租金税：武汉个人出租住宅核定综合征收率未在本次检索中确证，取 4% 保守值。" +
      "本表不构成投资建议。",
  },
  {
    city: "东京",
    country: "日本",
    countryCode: "JP",
    group: "intl-global",
    example: true,
    currency: "JPY",
    rentYieldRangePct: [2.7, 3.0],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.8,
      propertyFeeMonthly: 10000,
      otherAnnualCost: 500000,
      rentTaxRatePct: 25,
    },
    source: `${NUMBEO_NOTE}；持有成本为日本租赁管理惯例整理值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.71%、非市中心 2.95%；注意日本房产中介常引用的「表面利回り」（满租假设）为 4%–6%，" +
      "与本口径（已隐含平均空置）不可直接比较，Numbeo 口径更接近实际。持有成本（约 5,000 万日元公寓）：管理費约 1 万日元/月；" +
      "修缮积立金约 0.8 万日元/月并入维护费率；其他年化成本含固定资产税+都市计划税约 42 万日元/年" +
      "（评估值约为市值 50–60% × 1.4% + 0.3%）与修缮积立金约 8 万日元/年，合计约 50 万日元/年。租金税：" +
      "租赁净所得按综合课税（所得税 5%–45% 累进 + 住民税约 10%），默认取 25% 的近似值。本表不构成投资建议。",
  },
  {
    city: "纽约",
    country: "美国",
    countryCode: "US",
    group: "intl-global",
    example: true,
    representative: true,
    currency: "USD",
    rentYieldRangePct: [4.0, 6.0],
    holdingCostDefaults: {
      vacancyRatePct: 6,
      maintenanceAnnualRatePct: 1.0,
      propertyFeeMonthly: 600,
      otherAnnualCost: 6000,
      rentTaxRatePct: 30,
    },
    source: `${NUMBEO_NOTE}；房产税有效税率见 NYU Furman Center《State of the City 2025》`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 5.78%、非市中心 9.81%（后者受外围行政区低价房源拉动，属上界）；" +
      "曼哈顿整体毛收益率约 4.7%（按 NY County 中位房价与年租金推算，2025–26 年市场报道），区间取 4%–6% 覆盖主流城区。" +
      "持有成本（约 85 万美元公寓）：HOA/共管公寓公共维护费约 600 美元/月；维护与保险约 1%/年；" +
      "其他年化成本主要为房产税：NYC 共管公寓（Class 2）有效税率约 0.7% 市值（NYU Furman Center 2025），约 6,000 美元/年。" +
      "租金税：联邦 22%–24% 边际 + 纽约州约 6.5% + 市约 3.9%（对净租金），未扣折旧；默认取 30% 简化，折旧扣除后有效更低。" +
      "本表不构成投资建议。",
  },
  {
    city: "伦敦",
    country: "英国",
    countryCode: "GB",
    group: "intl-global",
    currency: "GBP",
    rentYieldRangePct: [3.7, 5.7],
    holdingCostDefaults: {
      vacancyRatePct: 6,
      maintenanceAnnualRatePct: 1.0,
      propertyFeeMonthly: 200,
      otherAnnualCost: 2400,
      rentTaxRatePct: 25,
    },
    source: `${NUMBEO_NOTE}；持有成本为英国租赁代理市场惯例整理值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 3.66%、非市中心 5.72%（伦敦内/外差异大，区间直接取两点值）。" +
      "持有成本（典型 1–2 房 leasehold 公寓）：服务费（service charge）约 200 英镑/月；维护与保险约 1%/年；" +
      "其他年化成本含中介托管费（约年租金 10%）与保险，约 2,400 英镑/年；council tax 通常由租客承担，未计入房东成本。" +
      "租金税：租赁净利并入个人所得税（20%/40%/45%），且按揭利息只能抵 20%（Section 24）；默认取 25% 近似。" +
      "本表不构成投资建议。",
  },
  {
    city: "新加坡",
    country: "新加坡",
    countryCode: "SG",
    group: "intl-global",
    example: true,
    currency: "SGD",
    rentYieldRangePct: [3.0, 3.3],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 1.5,
      propertyFeeMonthly: 350,
      otherAnnualCost: 1500,
      rentTaxRatePct: 20,
    },
    source: `${NUMBEO_NOTE}；非自住房产税税率见 IRAS`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 3.12%、非市中心 3.08%（区间 ±0.1pp 余量）。" +
      "持有成本（典型私人公寓）：公寓维护+Sinking fund 约 350 新元/月；维护年费率 1.5% = 维护约 0.5% +" +
      "非自住房产税约 1%（按年值 AV 累进 11.6%–36% 折算到市值的经验近似，IRAS 口径）；保险及杂项约 1,500 新元/年。" +
      "租金税：租赁净所得并入综合所得税（0%–24% 累进），典型约 15%–20%，默认取 20%。" +
      "注意：外国买家另有 ABSD 额外买方印花税（60%）等交易成本，未含。本表不构成投资建议。",
  },
  {
    city: "迪拜",
    country: "阿联酋",
    countryCode: "AE",
    group: "intl-global",
    currency: "AED",
    rentYieldRangePct: [7.8, 8.4],
    holdingCostDefaults: {
      vacancyRatePct: 10,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 1300,
      otherAnnualCost: 2000,
      rentTaxRatePct: 0,
    },
    source: `${NUMBEO_NOTE}；service charge 为迪拜社区物业惯例区间整理值`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 8.32%、非市中心 7.88%（11 城中最高；迪拜房价与租金波动较大，区间外年份可能出现）。" +
      "持有成本（约 1,000–1,200 平方英尺公寓）：service charge 约 AED 12–18/平方英尺/年，约 AED 1,300/月；" +
      "维护约 0.5%/年；保险杂项约 2,000 迪拉姆/年。" +
      "租金税：阿联酋无个人所得税，个人租金收入税率为 0%；迪拜市政住房费（年租金 5%）由租客承担。" +
      "本表不构成投资建议。",
  },
  {
    city: "珠海",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier3",
    example: true,
    representative: true,
    currency: "CNY",
    rentYieldRangePct: [2.2, 2.5],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 200,
      otherAnnualCost: 3000,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.25%、非市中心 2.44%（2026-11 读取）。" +
      "持有成本（约 90 平方米户型）为市场惯例整理值：物业费约 2 元/平方米/月；空置约 1 个月/年；" +
      "其他年化成本含中介费摊销与装修摊销。租金税：个人出租住房综合征收率约 4%（三四线城市常见口径，整理值）。" +
      "本表不构成投资建议。",
  },
  {
    city: "海口",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier3",
    currency: "CNY",
    rentYieldRangePct: [2.3, 2.7],
    holdingCostDefaults: {
      vacancyRatePct: 12,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 200,
      otherAnnualCost: 3000,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 2.38%、非市中心 2.67%（2026-11 读取）。" +
      "持有成本（约 90 平方米户型）为市场惯例整理值：物业费约 2 元/平方米/月；" +
      "海口为旅居/度假型市场，空置率按 12% 保守取值（高于内地同档城市）；" +
      "租金税：个人出租住房综合征收率约 4%（整理值）。本表不构成投资建议。",
  },
  {
    city: "吉隆坡",
    country: "马来西亚",
    countryCode: "MY",
    group: "intl-regional",
    example: true,
    representative: true,
    currency: "MYR",
    rentYieldRangePct: [4.0, 4.7],
    holdingCostDefaults: {
      vacancyRatePct: 8,
      maintenanceAnnualRatePct: 1,
      propertyFeeMonthly: 400,
      otherAnnualCost: 2500,
      rentTaxRatePct: 10,
    },
    source: `${NUMBEO_NOTE}`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 4.03%、非市中心 4.71%（2026-11 读取）。" +
      "持有成本（约 90 平方米公寓）为整理值：condo service charge 约 RM 400/月；" +
      "维护约 1%/年；保险杂项约 RM 2,500/年。租金税：马来西亚个人租金收入按累进税率征收，" +
      "此处按 10% 简化估算（整理口径，请按实际税务处理）。本表不构成投资建议。",
  },
  {
    city: "桂林",
    country: "中国",
    countryCode: "CN",
    group: "cn-tier4",
    example: true,
    representative: true,
    currency: "CNY",
    rentYieldRangePct: [4.0, 5.0],
    holdingCostDefaults: {
      vacancyRatePct: 12,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 180,
      otherAnnualCost: 2400,
      rentTaxRatePct: 4,
    },
    source: `${NUMBEO_NOTE}`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 4.00%、非市中心 5.06%（2026-11 读取；低房价带来相对高收益率）。" +
      "持有成本（约 90 平方米户型）为市场惯例整理值：物业费约 1.8 元/平方米/月；" +
      "桂林为旅游城市，空置率按 12% 保守取值；" +
      "租金税：个人出租住房综合征收率约 4%（整理值）。本表不构成投资建议。",
  },
  {
    city: "清迈",
    country: "泰国",
    countryCode: "TH",
    group: "intl-regional",
    example: true,
    currency: "THB",
    rentYieldRangePct: [4.5, 4.8],
    holdingCostDefaults: {
      vacancyRatePct: 10,
      maintenanceAnnualRatePct: 0.5,
      propertyFeeMonthly: 2500,
      otherAnnualCost: 6000,
      rentTaxRatePct: 10,
    },
    source: `${NUMBEO_NOTE}`,
    year: 2025,
    note:
      "Numbeo 毛租金收益率：市中心 4.81%、非市中心 4.54%（2026-11 读取）。" +
      "持有成本（约 70–90 平方米公寓）为整理值：condo common fee 约 ฿2,500/月；" +
      "维护约 0.5%/年；保险杂项约 ฿6,000/年。租金税：泰国个人租金收入按累进税率征收，" +
      "此处按 10% 简化估算（整理口径，请按实际税务处理）。本表不构成投资建议。",
  },
];
