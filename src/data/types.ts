/**
 * 数据层类型契约（类型先行，值后补：值见 defaults.ts / taxTables.ts / rentParams.ts）。
 * 与 WASM 计算相关的输入形状以 src/wasm/bridge.ts 为单一事实来源，本文件只定义
 * 数据文件自身的导出形状。
 */
import type { TaxBand } from "../wasm/bridge";

// ---------------------------------------------------------------------------
// 输入限额
// ---------------------------------------------------------------------------

/** 数值输入限额（供表单校验与组件库 InputNumber 参数共用） */
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
  /** 整数字段的默认宽松上限（防误输入） */
  int: NumberInputLimit;
  /** 贷款年限（年） */
  loanYears: NumberInputLimit;
  /** 蒙特卡洛模拟年限（年） */
  simYears: NumberInputLimit;
  /** 「其他」地区手工有效税率（百分点） */
  manualRate: NumberInputLimit;
  /** 恩格尔系数（0–1） */
  engel: NumberInputLimit;
  /** 缴费基数指数（小数形式，0–10） */
  contribIndex: NumberInputLimit;
  /** 支取策略带参数（百分点，0–100；四个带参数 + 支出地板共用） */
  strategyPct: NumberInputLimit;
  /** 支取策略支出上限（百分点，0–1000） */
  strategyCapPct: NumberInputLimit;
  /** 支取策略实际回报假设（百分点，−100–100 对称防误输入域） */
  strategyRealReturnPct: NumberInputLimit;
  /** 想停止工作的年龄（P7/P0-1 桥接口径） */
  targetRetireAge: NumberInputLimit;
  /** 存续验证年数（P7/P0-2 双指标；0 = 关闭） */
  sustainYears: NumberInputLimit;
  /** P9 人生事件锚年龄（整数 [16, 120]，与 pension currentAge 上限不同域、有意放宽） */
  lifeEventAge: NumberInputLimit;
  /** P9 收入增长（百分点对称域 −100–100） */
  salaryGrowthPct: NumberInputLimit;
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
  /** note 已含税表固定声明（TAX_TABLE_DISCLAIMER）时为 true，UI 据此去重显示 */
  disclaimerIncluded?: boolean;
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

/**
 * 城市分组（买房收租面板下拉按「中国城市 / 国际城市」两个分区展示，选项右侧附示例城市）：
 * - 中国城市（cn-tier1 ~ cn-tier4）：按一线 ~ 四线分档，参照第一财经·新一线城市研究所
 *   历年榜单与通行口径整理——国内城市生活成本与税制口径一致，可类比；
 * - 国际城市（intl-global / intl-regional）：国情与税制不同，不套用国内四档，
 *   按 GaWC（全球化与世界城市研究网络）2024 年分级归组——
 *   Alpha++ 与 Alpha+ → 「全球金融中心」，Alpha 及以下 / 未入榜 → 「区域中心」。
 */
export type CityGroup =
  | "cn-tier1"
  | "cn-tier2"
  | "cn-tier3"
  | "cn-tier4"
  | "intl-global"
  | "intl-regional";

/** 城市名全集（与 rentParams.CITY_RENT_PARAMS 的 city 字段、三语资源 city.* i18n 键一一对应；禁用模板串拼键，展示走 RentalPanel 的 CITY_NAME_KEY 静态映射） */
export type CityName =
  | "北京"
  | "上海"
  | "深圳"
  | "广州"
  | "成都"
  | "武汉"
  | "东京"
  | "纽约"
  | "伦敦"
  | "新加坡"
  | "迪拜"
  | "珠海"
  | "海口"
  | "吉隆坡"
  | "桂林"
  | "清迈";

/** 城市租售参数（买房收租面板的城市预设） */
export interface CityRentParams {
  /** 城市名（CityName 全集之一，如 "北京"） */
  city: CityName;
  /** 国家/地区 */
  country: string;
  /** 国家/地区代码（ISO 3166-1 alpha-2，用于界面文案的多语言映射） */
  countryCode: string;
  /** 城市分组（中国按一线~四线分档；国际按 GaWC 分组，不套用国内四档） */
  group: CityGroup;
  /** 是否作为该分组下拉选项的示例城市（选项右侧小字标注） */
  example?: boolean;
  /** 是否为该分组的代表城市（选中分组后填充其持有成本默认值） */
  representative?: boolean;
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
  /** 月开销偏离检测锚点：该区域人均消费支出月度值（仅中国条目提供，单位元/月） */
  monthlyConsumptionAnchorCny?: number;
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
  /** 次级文字（字段提示、下拉选项示例文字等；随主题切换，设计规范 2.10） */
  textSecondary: string;
  /** 三级文字（图表刻度文字等；随主题切换） */
  textTertiary: string;
  /** 上涨语义色（默认绿涨） */
  rise: string;
  /** 下跌语义色（默认红跌） */
  fall: string;
  /** 色盲友好模式下的上涨替代色 */
  riseColorBlind: string;
  /** 色盲友好模式下的下跌替代色 */
  fallColorBlind: string;
  /** 强调青绿（交互与核心数据强调；WF-03 C-3 准入值。底约束：浅色文字限画布/卡底——
   *  凹面与着色合成底禁作文字色（凹面 4.38、着色底合成 4.13 < 4.5，见 check:a11y 在册）；
   *  深浅两值禁混用（浅值对深卡 3.23、深值对浅画布 2.55 级，双向禁用） */
  accentTeal: string;
  /** 陶土橙棕·文字用途（假设标注与提醒；WF-03 C-4 提字值。着色合成底禁文字 4.45 < 4.5） */
  accentCopper: string;
  /** 陶土橙棕·图形用途（描边/图形 ≥3.0 口径；WF-03 C-4 原值。文字用途必须改用 accentCopper） */
  accentCopperGraphic: string;
  /** 灰蓝·文字用途（辅助数据注记；WF-03 C-5 提字值。凹面与着色合成底禁文字 4.39/4.14 < 4.5） */
  accentSlate: string;
  /** 灰蓝·图形用途（限白卡图形 3.11 ≥3.0，其余底禁用；WF-03 C-5 原值。文字用途必须改用 accentSlate） */
  accentSlateGraphic: string;
  /** 页面底色（body 背景与浏览器地址栏 theme-color 的浅色值挂此令牌；深色组与组件库深色一级底同值；CSS 名 --wf-bg-sunken） */
  bgPage: string;
  /** 面板凹面区底色（比卡底暗、比画布亮；CSS 名 --wf-bg-inset，docs/design-language.md §3.2 表面阶） */
  bgInset: string;
  /** 平面卡底色（实底卡与表格承载底；CSS 名 --wf-bg-surface，深色按「越高越亮」排在 inset 之上） */
  bgSurface: string;
  /** 着色底（核心参数实时区底色；替代对组件库主色阶 --primary-1 的浅色依赖；CSS 名 --wf-bg-tint） */
  tintBg: string;
  /** 区间底·淡青薄荷（区间填充/差异年段高亮；WF-03 C-6。底约束：底上元信息文字改用
   *  正文/三级色——浅值上次级文字 4.30 < 4.5（禁用）；深色为合成底（随底下画布联动），
   *  三级文字在最不利合成底 4.49 贴线跌破，元信息同样改用正文/次级色（check:a11y 在册） */
  bgMint: string;
  /** 图表网格线色（蒙特卡洛图；装饰层，不设文本对比度口径） */
  chartGrid: string;
  /** 图表刻度文字色（与三级文字同值但令牌解耦，便于独立调校） */
  chartTick: string;
  /** 进度环外沿提亮描边（S11 深色环线抬升：浅色为对偶占位不渲染，显隐由 CSS 承载；CSS 名 --wf-ring-halo） */
  ringHalo: string;
  /** 顶栏材质底色（半透明；透明度按对比度口径定值，见设计规范 5.3） */
  surfaceTopbarBg: string;
  /** 顶栏材质背景滤镜值（模糊 + 提饱和） */
  surfaceTopbarBlur: string;
  /** 悬浮输出卡材质底色（半透明） */
  surfaceCardBg: string;
  /** 悬浮输出卡背景滤镜值 */
  surfaceCardBlur: string;
  /** 浮层材质底色（半透明） */
  surfaceOverlayBg: string;
  /** 浮层背景滤镜值 */
  surfaceOverlayBlur: string;
  /** 深色即时提示材质底色（半透明） */
  surfaceTooltipBg: string;
  /** 深色即时提示背景滤镜值 */
  surfaceTooltipBlur: string;
  /** 顶栏底边发丝线（亮色） */
  hairlineTopbar: string;
  /** 悬浮输出卡描边发丝线 */
  hairlineCard: string;
  /** 浮层描边发丝线 */
  hairlineOverlay: string;
  /** 阴影第一档（深色即时提示） */
  shadow1: string;
  /** 阴影第二档（悬浮输出卡静置态） */
  shadow2: string;
  /** 阴影第三档（浮层与悬浮输出卡吸附态） */
  shadow3: string;
  /** 动效时长快档（CSS 字符串；数值源为 MOTION_DURATIONS.fast） */
  durationFast: string;
  /** 动效时长标准档（CSS 字符串；数值源为 MOTION_DURATIONS.base） */
  durationBase: string;
  /** 动效时长慢档（CSS 字符串；仅信息承载动效可用，数值源为 MOTION_DURATIONS.slow） */
  durationSlow: string;
  /** 标准曲线（默认：透明度、颜色、阴影、位移的常规过渡） */
  easeStandard: string;
  /** 强调曲线（仅位移与缩放类强调入场） */
  easeEmphasis: string;
  /** 数值渐近曲线（数值滚动与图表入场同族参考） */
  easeAsymptotic: string;
  /** 焦点环：浅色表面变体 */
  focusRing: string;
  /** 焦点环：主色表面变体（深色外环，避免环与底同色） */
  focusRingDark: string;
}
