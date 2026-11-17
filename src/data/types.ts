/**
 * 数据层类型契约（类型先行，值后补：值见 defaults.ts / taxTables.ts / rentParams.ts）。
 * 与 WASM 计算相关的输入形状以 src/wasm/bridge.ts 为单一事实来源，本文件只定义
 * 数据文件自身的导出形状。
 */
import type { TaxBand } from "../wasm/bridge";

// ---------------------------------------------------------------------------
// 输入限额
// ---------------------------------------------------------------------------

/** 数值输入限额（供表单校验与 Arco InputNumber 参数共用） */
export interface NumberInputLimit {
  /** 允许的最小值 */
  min: number;
  /** 允许的最大值 */
  max: number;
  /** 步进 */
  step: number;
  /** 保留小数位数（0 = 整数） */
  precision: number;
  /** 默认值（可选） */
  default?: number;
}

/** 输入限额分组（值见 defaults.ts 的 LIMITS） */
export interface InputLimits {
  /** 金额类输入（元） */
  amount: NumberInputLimit;
  /** 百分比类输入（百分点） */
  percent: NumberInputLimit;
  /** 蒙特卡洛路径数 */
  paths: NumberInputLimit;
}

// ---------------------------------------------------------------------------
// 页面固定文案
// ---------------------------------------------------------------------------

/** 固定文案形状（值见 defaults.ts 的 APP_COPY） */
export interface AppCopy {
  /** 免责声明全文 */
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// 币种与离线汇率快照
// ---------------------------------------------------------------------------

/** 币种条目（ISO 4217） */
export interface Currency {
  /** 币种代码，如 "CNY" */
  code: string;
  /** 中文名称 */
  name: string;
  /** 符号 */
  symbol: string;
}

/**
 * 离线汇率快照（本地静态数据；应用运行时不发起任何外部请求）。
 * 换算语义：1 单位 base = rates[target] 单位 target。
 */
export interface FxRateSnapshot {
  /** 基准币种代码，如 "CNY" */
  base: string;
  /** 目标币种代码 → 汇率 */
  rates: Record<string, number>;
  /** 汇率数据的时间戳标注（ISO 8601；空字符串表示尚未填充） */
  ratesUpdatedAt: string;
  /** 本快照生成时间（ISO 8601；空字符串表示尚未填充） */
  snapshotAt: string;
  /** 数据来源说明 */
  source: string;
  /** 备注 */
  note?: string;
}

// ---------------------------------------------------------------------------
// 税表
// ---------------------------------------------------------------------------

/** 税表（某国家/地区某年度的个人所得税超额累进结构） */
export interface TaxTable {
  /** ISO 3166-1 alpha-2 国家/地区代码，如 "CN" */
  countryCode: string;
  /** 税制名称，如「中国综合所得税率（年度）」 */
  name: string;
  /** 适用年度 */
  year: number;
  /** 标准扣除额（当地货币/年） */
  standardDeduction: number;
  /** 超额累进税档（lower 升序；rate 为小数形式，0.03 表示 3%） */
  bands: TaxBand[];
  /** 口径与来源备注 */
  note: string;
}

// ---------------------------------------------------------------------------
// 城市租售参数
// ---------------------------------------------------------------------------

/** 城市持有成本默认参数（字段与 rental_analysis 输入对齐，便于面板预填） */
export interface HoldingCostDefaults {
  /** 空置率（百分点） */
  vacancyRatePct: number;
  /** 维护成本年费率（百分点，按房价计） */
  maintenanceAnnualRatePct: number;
  /** 物业费（当地货币/月） */
  propertyFeeMonthly: number;
  /** 其他年化持有成本（当地货币/年） */
  otherAnnualCost: number;
  /** 租金税负（百分点，按有效租金计） */
  rentTaxRatePct: number;
}

/** 城市租售参数（买房收租面板的城市预设） */
export interface CityRentParams {
  /** 城市名，如 "北京" */
  city: string;
  /** 国家/地区 */
  country: string;
  /** 该城市房价/租金的计价币种（ISO 4217） */
  currency: string;
  /** 租金收益率典型区间 [下限, 上限]（百分点，如 [1.5, 2.2]） */
  rentYieldRangePct: [number, number];
  /** 持有成本默认值 */
  holdingCostDefaults: HoldingCostDefaults;
  /** 数据来源说明 */
  source: string;
  /** 数据年度 */
  year: number;
  /** 备注 */
  note?: string;
}

// ---------------------------------------------------------------------------
// 区域校验参考
// ---------------------------------------------------------------------------

/** 区域校验参考（用于对默认值与用户输入做合理性校验的统计口径） */
export interface RegionalBenchmark {
  /** 区域名称，如「中国城镇」 */
  region: string;
  /** 关联国家/地区代码（ISO 3166-1 alpha-2，可选） */
  countryCode?: string;
  /** 人均 GDP（PPP 口径，美元） */
  gdpPerCapitaPppUsd: number;
  /** 居民消费率（百分点，居民消费/GDP） */
  consumptionRatePct: number;
  /** 恩格尔系数典型区间 [下限, 上限]（0–1） */
  engelCoeffRange: [number, number];
  /** 统计年度 */
  year: number;
  /** 数据来源说明 */
  source?: string;
  /** 备注 */
  note?: string;
}

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

/** 主题色令牌（值见 defaults.ts 的 THEME） */
export interface ThemeTokens {
  /** 主色 */
  primary: string;
  /** 正文深灰 */
  textPrimary: string;
  /** 上涨语义色（默认绿涨） */
  rise: string;
  /** 下跌语义色（默认红跌） */
  fall: string;
  /** 色盲友好模式下的上涨替代色 */
  riseColorBlind: string;
  /** 色盲友好模式下的下跌替代色 */
  fallColorBlind: string;
}
