/**
 * 数据层默认值（类型先行、值后补：类型见 src/data/types.ts 与 src/wasm/bridge.ts）。
 * 数值口径与来源以注释为准；标注「占位」的数值待数据研究员复核后调整。
 */
import type {
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  RentalAnalysisInput,
  ReverseEstimateInput,
} from "../wasm/bridge";
import type {
  AppCopy,
  Currency,
  FxRateSnapshot,
  InputLimits,
  RegionalBenchmark,
  ThemeTokens,
} from "./types";

/** 基础计算（480 法则）默认输入 */
export const BASELINE_DEFAULTS: BaselineInput = {
  // 月开销 2990 元/月：按国家统计局城镇居民人均消费支出口径整理
  monthlyExpense: 2990,
  childCount: 1, // 占位：默认按 1 孩
  costPerChild: 580000, // 每孩总抚养成本（元）
  healthReserve: 200000, // 健康预留（元）
  majorInvestment: 0, // 重大投入（元）
  nominalReturnPct: 4.5,
  inflationPct: 2.0,
};

/** 页面固定文案（免责声明全文，与 README 保持一致） */
export const APP_COPY: AppCopy = {
  disclaimer: "本工具基于公开统计与简化假设，仅为规划参考，不构成投资建议。",
};

/** 输入限额（表单校验共用） */
export const LIMITS: InputLimits = {
  /** 金额类：元，整数 */
  amount: { min: 0, max: 1_000_000_000, step: 100, precision: 0 },
  /** 百分比类：百分点，两位小数 */
  percent: { min: 0.01, max: 30, step: 0.01, precision: 2 },
  /** 蒙特卡洛路径数（step 为占位值，规格未指定） */
  paths: { min: 1000, max: 20000, step: 500, precision: 0, default: 5000 },
};

/** 反向估算面板默认输入（占位：childReserve 沿用 1 孩成本，totalAssets 为示例值） */
export const REVERSE_ESTIMATE_DEFAULTS: ReverseEstimateInput = {
  totalAssets: 2_000_000,
  childReserve: 580000,
  healthReserve: 200000,
  majorInvestment: 0,
  nominalReturnPct: 4.5,
  inflationPct: 2.0,
};

/** 贷款测算面板默认输入（占位：利率/年限为常见房贷参考，待数据研究员校准） */
export const LOAN_DEFAULTS: AmortizeInput = {
  principal: 1_000_000,
  annualRatePct: 3.9,
  years: 30,
  method: "equal_payment",
};

/** 买房收租面板默认输入（占位：待接入 rentParams.ts 的城市参数后由用户选择覆盖） */
export const RENTAL_DEFAULTS: RentalAnalysisInput = {
  price: 1_500_000,
  downPaymentPct: 30,
  loanAnnualRatePct: 3.9,
  loanYears: 30,
  monthlyRent: 4000,
  vacancyRatePct: 5,
  maintenanceAnnualRatePct: 1,
  propertyFeeMonthly: 300,
  otherAnnualCost: 0,
  rentTaxRatePct: 5,
};

/** 蒙特卡洛面板默认输入（年支出 = 默认月开销 2990 × 12 = 35880） */
export const MONTE_CARLO_DEFAULTS: MonteCarloInput = {
  currentAssets: 500000,
  annualSpend: 2990 * 12,
  nominalReturnMeanPct: 4.5,
  nominalReturnStdPct: 12,
  inflationMeanPct: 2,
  inflationStdPct: 1,
  years: 30,
  paths: 5000,
  seed: 42,
};

/** 税务估算面板默认输入（bands 待接 taxTables.ts 的 TAX_TABLES，当前为空 → 仅供联调） */
export const TAX_ESTIMATE_DEFAULTS: EstimateTaxInput = {
  grossAnnualIncome: 200000,
  standardDeduction: 60000, // 占位：按中国个税年减除费用口径，待税表确认
  bands: [],
};

/** 币种列表（ISO 4217，占位最小集合，待数据研究员确认扩充） */
export const CURRENCIES: Currency[] = [
  { code: "CNY", name: "人民币", symbol: "¥" },
  { code: "USD", name: "美元", symbol: "$" },
  { code: "EUR", name: "欧元", symbol: "€" },
  { code: "GBP", name: "英镑", symbol: "£" },
  { code: "JPY", name: "日元", symbol: "JP¥" },
  { code: "HKD", name: "港币", symbol: "HK$" },
];

/** 离线汇率快照（占位：仅含基准币种自身；真实快照由数据研究员填充） */
export const FX_RATE_SNAPSHOT: FxRateSnapshot = {
  base: "CNY",
  rates: { CNY: 1 },
  ratesUpdatedAt: "", // 空 = 尚未填充真实汇率数据
  snapshotAt: "", // 空 = 尚未生成快照
  source: "pending", // 待数据研究员填充来源
  note: "占位快照：除 CNY 外汇率待填充；填充后须同步更新 ratesUpdatedAt / snapshotAt。",
};

/** 区域校验参考（占位空数组：人均 GDP PPP、消费率、恩格尔系数由数据研究员填充） */
export const REGIONAL_BENCHMARKS: RegionalBenchmark[] = [];

/** 主题常量 */
export const THEME: ThemeTokens = {
  primary: "#4A6FA5", // 主色
  textPrimary: "#1D2129", // 正文深灰
  rise: "#00B42A", // 绿涨（Arco green-6）
  fall: "#F53F3F", // 红跌（Arco red-6）
  // 色盲友好替代色板（Okabe–Ito 蓝/橙）：开启「色盲友好模式」时替换涨跌语义色
  riseColorBlind: "#0072B2",
  fallColorBlind: "#E69F00",
};
