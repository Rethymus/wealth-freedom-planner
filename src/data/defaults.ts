/**
 * 数据层默认值（类型先行、值后补：类型见 src/data/types.ts 与 src/wasm/bridge.ts）。
 * 数值口径与来源以注释为准；标注「占位」的数值待数据研究员复核后调整。
 */
import type {
  AccumulationInput,
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  PercentStrategyParams,
  RentalAnalysisInput,
  ReverseEstimateInput,
  ThresholdStrategyParams,
} from "../wasm/bridge";
import {
  PENSION_AVG_WAGE_ANCHOR_CNY,
  PENSION_MONTHS_TABLE,
} from "./pensionParams";
import { TAX_TABLES } from "./taxTables";
import type { PensionInputs } from "./pensionParams";
import type {
  AppCopy,
  Currency,
  FxRateSnapshot,
  InputLimits,
  ThemeTokens,
} from "./types";

/** 基础计算（480 法则）默认输入 */
export const BASELINE_DEFAULTS: BaselineInput = {
  // 月开销 2990 元/月：按国家统计局城镇居民人均消费支出口径整理
  monthlyExpense: 2990,
  // 默认不计划要孩子：首屏临界值 = 2990 × 480 + 200,000 = 1,635,200 元（与验收口径一致）
  childCount: 0,
  costPerChild: 580000, // 每孩总抚养成本（元）：视频口径示例值 58 万（非《中国生育成本报告 2024 版》原文值——原文 0–17 岁全国平均 53.8 万，见面板⑨）；保留为可编辑示例
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
  /** 整数字段默认宽松上限（防误输入；业务范围校验以计算核心为准） */
  int: { min: 0, max: 999_999_999, step: 1, precision: 0 },
  /** 贷款年限（年） */
  loanYears: { min: 1, max: 50, step: 1, precision: 0 },
  /** 蒙特卡洛模拟年限（年，同时控制图表规模） */
  simYears: { min: 1, max: 100, step: 1, precision: 0 },
  /** 「其他」地区手工简化有效税率（百分点） */
  manualRate: { min: 0, max: 100, step: 0.1, precision: 2 },
  /** 恩格尔系数（0–1，选填字段） */
  engel: { min: 0, max: 1, step: 0.01, precision: 2 },
  /** 缴费基数指数（小数：0.6 ≈ 社平 60% 口径） */
  contribIndex: { min: 0, max: 10, step: 0.05, precision: 2 },
  /** 支取策略带参数（百分点，契约 [0,100]；四个带参数 + 支出地板共用） */
  strategyPct: { min: 0, max: 100, step: 1, precision: 0 },
  /** 支取策略支出上限（百分点，契约 [0,1000]） */
  strategyCapPct: { min: 0, max: 1000, step: 1, precision: 0 },
  /** 支取策略实际回报假设（百分点）：对称防误输入域，min = −100 的输入由核心侧
   *  「> −100」校验报错兜底（现有 LIMITS.percent 的 min = 0.01 禁止负值，无法承载
   *  契约允许的 (−100, …] 域） */
  strategyRealReturnPct: { min: -100, max: 100, step: 0.1, precision: 1 },
  /** 想停止工作的年龄（P7/P0-1 桥接口径；契约 [16, 75] 整数） */
  targetRetireAge: { min: 16, max: 75, step: 1, precision: 0 },
  /** 存续验证年数（P7/P0-2；契约 [0, 200] 整数，0 = 关闭） */
  sustainYears: { min: 0, max: 200, step: 1, precision: 0 },
  /** P9 人生事件锚年龄（整数 [16, 120]——与 pension currentAge 上限 70 不同域、有意放宽，
   *  docs/p9-spec.md §1.2 登记） */
  lifeEventAge: { min: 16, max: 120, step: 1, precision: 0 },
  /** P9 收入增长（百分点对称域；先例 strategyRealReturnPct min −100 同形——LIMITS.percent
   *  min 0.01 禁负无法承载） */
  salaryGrowthPct: { min: -100, max: 100, step: 0.1, precision: 1 },
};

/** 反向估算面板默认输入（占位：childReserve 沿用 1 孩成本，即视频口径示例值 58 万——报告原文 0–17 岁平均 53.8 万，见面板⑨；totalAssets 为示例值） */
export const REVERSE_ESTIMATE_DEFAULTS: ReverseEstimateInput = {
  totalAssets: 2_000_000,
  childReserve: 580000, // 视频口径示例值 58 万（报告原文 0–17 岁平均 53.8 万，见面板⑨）
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

/** 蒙特卡洛面板默认输入（年支出基期值 = 默认月开销 2990 × 12 = 35880，自第 1 年起按通胀上行） */
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

/**
 * 蒙特卡洛支取策略默认参数（值 = 研究默认，docs/p2-spec.md §2.4）。
 * - threshold：文献最优阈值带参数（更小的阈值或更大的降支幅度不再改善成功率）；
 * - percent.realReturnAssumpPct 默认 = MONTE_CARLO_DEFAULTS.nominalReturnMeanPct
 *   − inflationMeanPct = 4.5 − 2.0 = 2.5，为初始回显值：用户可改、无运行时联动机制
 *   （不引入 accumulationTargetSynced 式第二套联动）。
 */
export const MONTE_CARLO_STRATEGY_DEFAULTS: {
  threshold: ThresholdStrategyParams;
  percent: PercentStrategyParams;
} = {
  threshold: {
    exceedPct: 20,
    cutPct: 10,
    fallPct: 20,
    raisePct: 10,
    noCutLastYears: 15,
    freezeOnLoss: true,
  },
  percent: {
    realReturnAssumpPct: 2.5,
    floorPctOfLastYear: 0,
    capPctOfInitialReal: 0,
  },
};

/** 税务估算面板默认输入（F6 修复轮：默认税表 = 税表数据层中国表——面板默认选中 CN，
 *  对比列/情景存档/分享载荷的税切片与面板同源；此前 bands 空仅供联调，致对比列
 *  税后收入恒 ¥0。taxTables.ts 仅依赖 ./types，无循环导入） */
const CN_TAX_TABLE = TAX_TABLES.find((tbl) => tbl.countryCode === "CN") ?? null;

export const TAX_ESTIMATE_DEFAULTS: EstimateTaxInput = {
  grossAnnualIncome: 200000,
  // 中国个税年减除费用口径（与 CN 税表 standardDeduction 同源；表缺失时回落占位值）
  standardDeduction: CN_TAX_TABLE ? CN_TAX_TABLE.standardDeduction : 60000,
  bands: CN_TAX_TABLE ? CN_TAX_TABLE.bands : [],
};

/** 自由刻度输入类型与默认值（currentAssets = 0 视为未填写 → 进度环隐藏） */
export interface ProgressInputs {
  currentAssets: number;
}

export const PROGRESS_DEFAULTS: ProgressInputs = { currentAssets: 0 };

/** 社保养老金面板默认输入（计发月数默认按退休年龄联动对照表，手动修改即解除联动，
 * 见 store pensionMonthsSynced；avgMonthlyWage 默认 = 数据层全国口径锚点） */
export const PENSION_DEFAULTS: PensionInputs = {
  currentAge: 30,
  retireAge: 60,
  // 想停止工作的年龄（P7/P0-1）：缺省 = retireAge → 默认视图 bridgeYears = 0，
  // README.md:41/86 锚点视图不漂移；停工早于退休时面板出现桥接块（两段口径）
  targetRetireAge: 60,
  contribYears: 30,
  contribIndex: 0.6, // 多数省份缴费基数下限口径（≈ 按社平 60% 缴费）
  accountBalance: 50000,
  avgMonthlyWage: PENSION_AVG_WAGE_ANCHOR_CNY,
  monthsDivisor: PENSION_MONTHS_TABLE[60],
};

/** 打工积累模拟面板默认输入（目标值基期默认 = 基础模式默认临界值 1,635,200；
 * 默认与基础模式临界值实时联动，手动修改后解除联动，见 store accumulationTargetSynced） */
export const ACCUMULATION_DEFAULTS: AccumulationInput = {
  currentAssets: 500000,
  monthlyIncome: 8000,
  monthlyExpense: 2990,
  targetValue: 1_635_200,
  nominalReturnMeanPct: 4.5,
  nominalReturnStdPct: 12,
  inflationMeanPct: 2,
  inflationStdPct: 1,
  years: 40,
  paths: 5000,
  seed: 42,
  // 存续验证年数（P7/P0-2）：默认 0 = 关闭（fiProbability 口径与现状逐字节一致，
  // 零默认行为变化；> 0 时面板并列展示持续成功率）
  sustainYears: 0,
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
  // 离线快照真值（P7/F 工程快赢）：open.er-api.com 公开端点实拉核验，
  // 接口数据时点 2026-11-20（time_last_update_utc: Fri, 20 Nov 2026 00:02:32 +0000），
  // 本会话（实施日 2026-11-21）重拉核对；仅收录 CURRENCIES 六币种
  rates: {
    CNY: 1,
    USD: 0.149433,
    EUR: 0.136198,
    GBP: 0.113982,
    JPY: 23.877343,
    HKD: 1.172212,
  },
  ratesUpdatedAt: "Fri, 20 Nov 2026 00:02:32 +0000",
  snapshotAt: "2026-11-21",
  source: "open.er-api.com",
  note: "离线快照：实时获取失败或超时时回退使用；数值随实施时点冻结，刷新汇率可获取实时值。",
};

/** 动效时长数值表（ms）。THEME / THEME_DARK 中 CSS 字符串值由此派生，禁止两处手工各写一份 */
export const MOTION_DURATIONS = { fast: 120, base: 240, slow: 360 } as const;

/** 主题模式（两态已解析结果值；不做 "system" 三态的取舍见设计规范 2.11：解析态恒定，图表取色、
 * 按钮图标与 aria 标签全部单值判定，代价是运行期间不监听操作系统级主题切换） */
export type ThemeMode = "light" | "dark";

/** 主题持久化存储键（localStorage）。仅显式切换动作写入；系统推导出的初始值不落盘 */
export const THEME_STORAGE_KEY = "wf-theme";

/** 界面偏好持久化存储键（localStorage）：展示币种 + 色盲友好开关（JSON）。
 * 与主题同口径——仅显式选择动作写入，业务输入不落盘（跨会话携带走分享链接） */
export const PREFS_STORAGE_KEY = "wf-prefs";

/** 主题常量·浅色组（动态层令牌：CSS 字符串值经 App.tsx 注入 documentElement，覆盖 global.css :root
 * 静态默认值，两处初始值必须一致防首帧闪变；深色镜像组见 THEME_DARK，同一 ThemeTokens 接口） */
export const THEME: ThemeTokens = {
  primary: "#4A6FA5", // 主色
  // WF-03 C-1（宪法 §5.1 准入）：正文换 Ink Navy #102331（浅色四底 13.56–16.07 全过，
  // check:a11y 扩对在册）；深色画布用途挂起（配套深色表面三档提档族未定，另行准入）
  textPrimary: "#102331", // 正文墨蓝（对画布 15.07 / 凹面 14.47 / 卡底 16.07）
  textSecondary: "#646E7A", // 次级文字（对新画布 4.86:1 ≥ 4.5；改值依据 design-research A1，登记于 design-spec 5.3）
  textTertiary: "#4E5969", // 三级文字（图表刻度文字等；对新画布 6.66:1）
  rise: "#00B42A", // 绿涨语义色
  fall: "#F53F3F", // 红跌语义色
  // 色盲友好替代色板（蓝/橙）：开启「色盲友好模式」时替换涨跌语义色
  riseColorBlind: "#0072B2",
  fallColorBlind: "#E69F00",
  // —— Atlas 强调色三族（WF-03 C-3/C-4/C-5 准入值；底约束见 types.ts 字段注） ——
  accentTeal: "#087F78", // 青绿强调：文字限画布/卡底（4.56 贴线 / 4.86）；凹面 4.38、着色底 4.13 禁文字
  accentCopper: "#966028", // 陶土橙棕文字提字：4.92 / 4.73 / 5.25；着色底合成 4.45 禁文字
  accentCopperGraphic: "#A56C32", // 陶土橙棕图形原值：仅 ≥3.0 图形口径（白卡 4.38 / 画布 4.11）
  accentSlate: "#5E7484", // 灰蓝文字提字：4.57 / 4.88；凹面 4.39、着色底 4.14 禁文字
  accentSlateGraphic: "#8195A3", // 灰蓝图形原值：仅白卡图形 3.11，其余底全禁
  // —— 表面阶（body 背景与实时区底色改挂令牌，解除硬编码与组件库色阶依赖；
  //    CSS 名映射：bgPage→--wf-bg-sunken / bgInset→--wf-bg-inset / bgSurface→--wf-bg-surface / tintBg→--wf-bg-tint）
  //    WF-03 C-2（宪法 §5.1 准入，与 C-1 成对评审）：画布改 Paper #F6F8F7——
  //    现浅文字三档对新画布 15.07 / 4.86 / 6.66 全过（check:a11y 扩对在册） ——
  bgPage: "#F6F8F7",
  bgInset: "#F2F3F5",
  bgSurface: "#FFFFFF",
  tintBg: "rgba(74,111,165,0.08)",
  // 区间底（WF-03 C-6）：淡青薄荷 #DCEEE8——底上元信息禁次级色（4.30 < 4.5），用正文/三级色
  bgMint: "#DCEEE8",
  // —— 图表（蒙特卡洛网格线 / 刻度文字，废除组件内硬编码浅色值） ——
  chartGrid: "#E5E6EB",
  chartTick: "#4E5969",
  // 进度环外沿提亮描边（S11）：浅色对偶占位不渲染，显隐由 CSS [data-theme] 分支承载
  ringHalo: "#4A6FA5",
  // —— 三层表面材质（半透明底色 + 背景滤镜；透明度按对比度口径定值，见设计规范 5.3，不是自由参数） ——
  surfaceTopbarBg: "rgba(74,111,165,0.95)",
  surfaceTopbarBlur: "saturate(1.6) blur(16px)",
  surfaceCardBg: "rgba(255,255,255,0.72)",
  surfaceCardBlur: "saturate(1.4) blur(20px)",
  surfaceOverlayBg: "rgba(255,255,255,0.86)",
  surfaceOverlayBlur: "saturate(1.4) blur(24px)",
  surfaceTooltipBg: "rgba(29,33,41,0.88)",
  surfaceTooltipBlur: "blur(8px)",
  // —— 发丝线 ——
  hairlineTopbar: "rgba(255,255,255,0.16)",
  hairlineCard: "rgba(29,33,41,0.08)",
  hairlineOverlay: "rgba(29,33,41,0.10)",
  // —— 阴影层级 ——
  shadow1: "0 1px 2px rgba(29,33,41,0.06)",
  shadow2: "0 2px 6px rgba(29,33,41,0.08), 0 8px 24px rgba(29,33,41,0.08)",
  shadow3: "0 4px 12px rgba(29,33,41,0.10), 0 16px 40px rgba(29,33,41,0.12)",
  // —— 动效时长（CSS 字符串由 MOTION_DURATIONS 派生，单一事实来源；两主题共用同值） ——
  durationFast: `${MOTION_DURATIONS.fast}ms`,
  durationBase: `${MOTION_DURATIONS.base}ms`,
  durationSlow: `${MOTION_DURATIONS.slow}ms`,
  // —— 曲线族（两主题共用同值） ——
  easeStandard: "cubic-bezier(0.2, 0, 0, 1)",
  easeEmphasis: "cubic-bezier(0.34, 1.26, 0.44, 1)",
  easeAsymptotic: "cubic-bezier(0.16, 1, 0.3, 1)",
  // —— 焦点环（浅色表面默认 / 主色表面深色变体，见设计规范 2.8） ——
  focusRing: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px var(--wf-primary, #4A6FA5)",
  focusRingDark: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(29,33,41,0.9)",
};

/** 主题常量·深色组（THEME 的同键镜像，同一 ThemeTokens 接口；与 global.css 的
 * :root[data-theme="dark"] 覆盖块逐键一致。全部对比度数值为「常态合成底 / 最不利透底」双口径
 * 实测，见设计规范 5.3；深色材质透明度按「最不利透底」口径锁定（L2=0.92、L1=0.88），
 * 禁止为通透感回调。语义色深色版常态与最不利双口径均 ≥4.5:1，不沿用浅色的现状豁免。 */
export const THEME_DARK: ThemeTokens = {
  primary: "#7B9FD1", // 提亮主色：卡底 5.84:1、最不利 4.53:1（大数字 / 焦点环 / 悬浮反馈用）
  textPrimary: "#F2F3F5", // 正文：常态 14.31:1 / 最不利 11.10:1
  textSecondary: "#A6B0C3", // 次级文字：常态 7.28:1 / 最不利 5.65:1（V3 冷偏微提亮，p6-spec §3）
  textTertiary: "#8F95A0", // 三级文字：卡底 5.28:1（刻度仅存在于卡面，无透底场景）
  rise: "#27C346", // 涨色：常态 6.79:1 / 最不利 5.27:1
  fall: "#F98D86", // 跌色：常态 6.95:1 / 最不利 5.39:1
  // 色盲友好替代色板深色值（涨实测 6.88:1 / 最不利 5.34:1；跌 7.05:1 / 5.47:1，与浅色同值）
  riseColorBlind: "#56B4E9",
  fallColorBlind: "#E69F00",
  // —— Atlas 强调色三族深色值（WF-03 C-3/C-4/C-5 准入值；与浅色值禁混用，双向在册） ——
  accentTeal: "#26AFA6", // 提亮青绿：深色四面文字全过（6.61/6.29/5.81/材质合成 4.56 贴线）
  accentCopper: "#C48A4F", // 提亮陶土：实底三面文字全过（6.04/5.74/5.31）；材质面限大字/图形（4.17 ≥3.0）
  accentCopperGraphic: "#C48A4F", // 深色单值：与文字用途同值
  accentSlate: "#8195A3", // 原值直用：深色三面文字全过（5.76/5.47/5.06）；材质面限大字/图形（3.97 ≥3.0）
  accentSlateGraphic: "#8195A3", // 深色单值：与文字用途同值
  // —— 表面阶（深色「越高越亮」：sunken 最暗画布 < inset 凹面 < surface 平面卡底 < 材质浮层；
  //    页面底与组件库深色一级底同值，实底表面层叠口径一致） ——
  bgPage: "#17171A",
  bgInset: "#1C1C1F",
  bgSurface: "#232324",
  tintBg: "rgba(123,159,209,0.12)", // 合成底：正文 11.77:1、涨色 5.59:1、跌色 5.71:1
  // 区间底（WF-03 C-6 深值）：半透明合成底（叠在役深底后在役正文/次级 12.17/6.19 最不利口径全过；
  // 三级文字在最不利合成底 4.49 跌破 → 元信息禁三级色，用正文/次级，check:a11y 在册）。
  // 合成值随最终深色画布定稿复验（C-1 深画布用途挂起中，定稿后重算）
  bgMint: "rgba(8,127,120,0.16)",
  // —— 图表（网格线为装饰层，不设 4.5 口径；刻度文字对合成卡底 5.28:1） ——
  chartGrid: "#3D3F46",
  chartTick: "#8F95A0",
  // 进度环外沿提亮描边（S11 深色环线抬升）：#7B9FD1 同族提亮；装饰性描边与网格同族，不设 4.5 口径
  ringHalo: "#A6C0E4",
  // —— 三层表面材质（模糊半径两主题一致；底色 / 发丝线按深色调校） ——
  surfaceTopbarBg: "rgba(23,23,26,0.88)",
  surfaceTopbarBlur: "saturate(1.6) blur(16px)",
  surfaceCardBg: "rgba(35,35,36,0.92)",
  surfaceCardBlur: "saturate(1.4) blur(20px)",
  surfaceOverlayBg: "rgba(35,35,36,0.95)",
  surfaceOverlayBlur: "saturate(1.4) blur(24px)",
  surfaceTooltipBg: "rgba(84,86,90,0.92)", // 比页面底提亮一档：保持「提示浮于一切」的反转层级
  surfaceTooltipBlur: "blur(8px)",
  // —— 发丝线（深色改白色系透底） ——
  hairlineTopbar: "rgba(255,255,255,0.12)",
  hairlineCard: "rgba(255,255,255,0.10)",
  hairlineOverlay: "rgba(255,255,255,0.14)",
  // —— 阴影（黑基阴影、档差加大：深色下阴影感知更弱，是层级的主要载体之一） ——
  shadow1: "0 1px 2px rgba(0,0,0,0.40)",
  shadow2: "0 2px 6px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.45)",
  shadow3: "0 4px 12px rgba(0,0,0,0.50), 0 16px 40px rgba(0,0,0,0.60)",
  // —— 动效时长 / 曲线族：静态层，两主题共用同值（结构对偶保持同键完整） ——
  durationFast: `${MOTION_DURATIONS.fast}ms`,
  durationBase: `${MOTION_DURATIONS.base}ms`,
  durationSlow: `${MOTION_DURATIONS.slow}ms`,
  easeStandard: "cubic-bezier(0.2, 0, 0, 1)",
  easeEmphasis: "cubic-bezier(0.34, 1.26, 0.44, 1)",
  easeAsymptotic: "cubic-bezier(0.16, 1, 0.3, 1)",
  // —— 焦点环：内圈改深色晕、外圈改提亮主色（两变体同值，规则照写保持结构对偶，见设计规范 2.8） ——
  focusRing: "0 0 0 2px rgba(23,23,26,0.9), 0 0 0 4px #7B9FD1",
  focusRingDark: "0 0 0 2px rgba(23,23,26,0.9), 0 0 0 4px #7B9FD1",
};

/** 初始主题：存储值命中即用，未命中（含无存储 / 值非法）按系统偏好推导一次——
 * 判定顺序与 index.html 首帧守卫脚本保持同步（设计规范 6.2 #2/#6）。 */
export function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* 存储不可用（隐私模式等）：走系统偏好推导 */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 界面偏好（展示币种 + 色盲友好开关）初始值：存储命中且合法即用，否则静默回落默认。
 * 只在 store 创建时调用一次（与 readInitialTheme 同时机）；存储不可用 / JSON 损坏 /
 * 字段非法（币种不在 CURRENCIES 内、开关非布尔）一律走默认，不影响首帧渲染。 */
export function readInitialPrefs(): { display: string; colorBlindFriendly: boolean } {
  const fallback = { display: "CNY", colorBlindFriendly: false };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<{ display: string; colorBlindFriendly: boolean }>;
    return {
      display:
        typeof saved.display === "string" && CURRENCIES.some((c) => c.code === saved.display)
          ? saved.display
          : fallback.display,
      colorBlindFriendly: saved.colorBlindFriendly === true,
    };
  } catch {
    return fallback;
  }
}

/** 全应用唯一的主题取色函数（App 注入与组件取色统一入口，设计规范 6.2 #2）：
 * 按主题选组 + 涨跌语义色按「色盲友好」开关替换。其余令牌不随该开关变化。 */
export function resolveThemeTokens(theme: ThemeMode, colorBlindFriendly: boolean): ThemeTokens {
  const group: ThemeTokens = theme === "dark" ? THEME_DARK : THEME;
  return colorBlindFriendly ? { ...group, rise: group.riseColorBlind, fall: group.fallColorBlind } : group;
}
