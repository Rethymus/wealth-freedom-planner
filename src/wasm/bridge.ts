/**
 * ============================================================================
 * WASM 计算核心 —— TypeScript 接口契约（单一事实来源）
 * ============================================================================
 *
 * 并行开发的各方（Rust 计算核心 / UI / 数据层）均以本文件为准。
 *
 * 约定：
 * 1. 所有 Rust 导出函数签名为 `(input: string) => string`：
 *    JSON 序列化进（serde）、JSON 序列化出（serde_json）。
 * 2. 单位约定：
 *    - 金额：数值「元」，币种换算由上层（数据层/UI）完成，核心不做汇率处理；
 *    - 百分比：数值「百分点」，如 4.5 表示 4.5%；
 *    - 例外：税率/税档 rate 采用小数形式，0.03 表示 3%（见 TaxBand / estimate_tax）。
 * 3. 错误约定：输出中的 `error` 字段 —— 空字符串 "" 表示成功；
 *    非空为人可读的中文错误说明，此时其余数值字段取各函数说明中的安全值。
 * 4. Rust 侧须对输入做校验（范围 / 非有限数等），错误通过 error 返回，不得 panic。
 *
 * src/wasm/pkg/ 为 wasm-pack build 的真实产物（wasm-pack build src/wasm
 * --target web --out-dir pkg --release 再生成）。在产物缺失或 init 失败时，
 * service 层（src/services/finance.ts）以 WASM_NOT_BUILT 标记识别
 * 「计算核心未就绪」并向上返回可读错误，页面其余部分不受影响。
 */

/** 与 Rust 侧约定的统一导出签名：JSON 进 JSON 出 */
export type WasmFn = (input: string) => string;

/** 占位 stub 抛出的错误标记（src/wasm/pkg），用于 UI 识别「核心未构建」 */
export const WASM_NOT_BUILT = "WASM_NOT_BUILT";

/** wasm-pack --target web 产出的模块形状（stub finance_core.d.ts 与之一致） */
export interface FinanceWasmModule {
  /** 初始化并加载 wasm 二进制；input 为二进制来源（inline 或 URL），缺省按 wasm-pack 约定定位同目录 .wasm */
  default: (input?: string | URL) => Promise<void>;
  calculate_baseline: WasmFn;
  amortize: WasmFn;
  rental_analysis: WasmFn;
  reverse_estimate: WasmFn;
  run_monte_carlo: WasmFn;
  simulate_accumulation: WasmFn;
  estimate_tax: WasmFn;
  run_monte_carlo_bootstrap: WasmFn;
  estimate_pension: WasmFn;
  simulate_sequence: WasmFn;
  solve_required_saving: WasmFn;
}

// ---------------------------------------------------------------------------
// a. calculate_baseline —— 480 法则基线
// ---------------------------------------------------------------------------

/** 480 法则基线输入 */
export interface BaselineInput {
  /** 月开销（元/月） */
  monthlyExpense: number;
  /** 子女数量（人） */
  childCount: number;
  /** 每孩总抚养成本（元/孩，0–18 岁累计口径由数据层定义） */
  costPerChild: number;
  /** 健康预留（元，一次性） */
  healthReserve: number;
  /** 重大投入（元，一次性，如购房首付、大额教育支出等） */
  majorInvestment: number;
  /** 名义年化回报率（百分点） */
  nominalReturnPct: number;
  /** 年通胀率（百分点） */
  inflationPct: number;
}

/** 480 法则基线输出 */
export interface BaselineOutput {
  /** 实际回报率（百分点）= nominalReturnPct − inflationPct（可为 ≤ 0） */
  realReturnPct: number;
  /**
   * 480 法则乘数 = 12 ÷ 实际回报率（小数形式），等价于 1200 ÷ 实际回报率（百分点）。
   * 默认参数 4.5 − 2.0 = 2.5% → 乘数 480（「480 法则」由此得名）。
   */
  multiplier: number;
  /**
   * 目标本金（元）= monthlyExpense × multiplier
   *   + childCount × costPerChild + healthReserve + majorInvestment。
   */
  criticalValue: number;
  /** 回显输入的月开销（元/月） */
  monthlyExpense: number;
  /** "" 表示成功；实际回报率 ≤ 0 时为非空中文错误 */
  error: string;
}

// calculate_baseline 语义（Rust 侧实现遵循）：
// - realReturnPct = nominalReturnPct − inflationPct；
// - multiplier = 12 ÷ (realReturnPct / 100)；
// - criticalValue = monthlyExpense × multiplier
//     + childCount × costPerChild + healthReserve + majorInvestment；
// - 实际回报率 ≤ 0：error 非空，multiplier = 0，criticalValue = 0；
//   realReturnPct 仍返回计算值，monthlyExpense 回显输入。

// ---------------------------------------------------------------------------
// b. amortize —— 还款计划（等额本息 / 等额本金）
// ---------------------------------------------------------------------------

/** 还款方式 */
export type AmortizationMethod = "equal_payment" | "equal_principal";

/** 还款计划输入 */
export interface AmortizeInput {
  /** 贷款本金（元） */
  principal: number;
  /** 年利率（百分点，如 3.9 表示 3.9%） */
  annualRatePct: number;
  /** 贷款年限（年） */
  years: number;
  /** 还款方式 */
  method: AmortizationMethod;
}

/** 单期还款明细 */
export interface AmortizeRow {
  /** 期次，从 1 开始 */
  month: number;
  /** 当月还款总额（元） */
  payment: number;
  /** 当月偿还本金（元） */
  principalPart: number;
  /** 当月利息（元） */
  interestPart: number;
  /** 当月还款后的剩余本金（元） */
  remaining: number;
}

/** 还款计划输出 */
export interface AmortizeOutput {
  /** 月供：等额本息为固定值；等额本金为首月还款额（此后逐月递减） */
  monthlyPayment: number;
  /** 全周期利息合计（元） */
  totalInterest: number;
  /** 全部期次明细，长度 = years × 12，month 从 1 开始 */
  rows: AmortizeRow[];
}

// amortize 语义（Rust 侧实现遵循）：
// - 月利率 r = annualRatePct / 100 / 12，期数 n = years × 12；
// - 等额本息（equal_payment）：月供 = principal × r / (1 − (1+r)^−n)，r = 0 时月供 = principal / n；
// - 等额本金（equal_principal）：每月偿还本金 = principal / n，利息按当期剩余本金计算；
// - remaining 为该期还款后的剩余本金，末期应为 0。

// ---------------------------------------------------------------------------
// c. rental_analysis —— 买房收租分析
// ---------------------------------------------------------------------------

/** 买房收租分析输入 */
export interface RentalAnalysisInput {
  /** 房屋总价（元） */
  price: number;
  /** 首付比例（百分点） */
  downPaymentPct: number;
  /** 贷款年利率（百分点） */
  loanAnnualRatePct: number;
  /** 贷款年限（年） */
  loanYears: number;
  /** 月租金（元/月，市场口径） */
  monthlyRent: number;
  /** 空置率（百分点，按年租金折算损失） */
  vacancyRatePct: number;
  /** 维护成本年费率（百分点，按房价计） */
  maintenanceAnnualRatePct: number;
  /** 物业费（元/月） */
  propertyFeeMonthly: number;
  /** 其他年化持有成本（元/年，如保险、装修摊销等） */
  otherAnnualCost: number;
  /** 租金税负（百分点，按有效租金计） */
  rentTaxRatePct: number;
}

/** breakdown 的固定键集（运行时为 Record<string, number>，键以本接口为准） */
export interface RentalBreakdown {
  /** 贷款金额 = price × (1 − downPaymentPct/100) */
  loanAmount: number;
  /** 首付 = price × downPaymentPct/100 */
  downPayment: number;
  /** 年毛租金 = monthlyRent × 12 */
  annualGrossRent: number;
  /** 年空置损失 = annualGrossRent × vacancyRatePct/100 */
  annualVacancyLoss: number;
  /** 年有效租金 = annualGrossRent − annualVacancyLoss */
  annualEffectiveRent: number;
  /** 年租金税负 = annualEffectiveRent × rentTaxRatePct/100 */
  annualRentTax: number;
  /** 年维护成本 = price × maintenanceAnnualRatePct/100 */
  annualMaintenance: number;
  /** 年物业费 = propertyFeeMonthly × 12 */
  annualPropertyFee: number;
  /** 其他年化持有成本（原样） */
  annualOtherCost: number;
  /** 年供款 = monthlyPayment × 12 */
  annualLoanPayment: number;
}

/** 买房收租分析输出 */
export interface RentalAnalysisOutput {
  /** 月供（按等额本息，见 amortize） */
  monthlyPayment: number;
  /**
   * 年净现金流（元/年）= annualEffectiveRent − annualRentTax − annualMaintenance
   *   − annualPropertyFee − annualOtherCost − monthlyPayment × 12。
   */
  annualNetCashFlow: number;
  /**
   * 静态回本年限（年）= 首付 ÷ annualNetCashFlow；
   * annualNetCashFlow ≤ 0 时返回 -1（JSON 无法表达 Infinity）。
   */
  paybackYears: number;
  /** 明细拆解，键集见 RentalBreakdown */
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// d. reverse_estimate —— 反向估算
// ---------------------------------------------------------------------------

/** 反向估算输入 */
export interface ReverseEstimateInput {
  /** 总资产（元） */
  totalAssets: number;
  /** 子女预留（元，一次性） */
  childReserve: number;
  /** 健康预留（元，一次性） */
  healthReserve: number;
  /** 重大投入（元，一次性） */
  majorInvestment: number;
  /** 名义年化回报率（百分点） */
  nominalReturnPct: number;
  /** 年通胀率（百分点） */
  inflationPct: number;
}

/** 反向估算输出 */
export interface ReverseEstimateOutput {
  /** 可投资资产（元）= max(0, totalAssets − childReserve − healthReserve − majorInvestment) */
  investableAssets: number;
  /** 可持续月开销（元/月）= investableAssets × 实际回报率（小数）÷ 12（永续提取口径） */
  sustainableMonthly: number;
  /** 可支撑年限（年）= 12 ÷ 实际回报率（百分点），即 480 乘数 ÷ 100 */
  yearsSupported: number;
  /** "" 表示成功；实际回报率 ≤ 0 时为非空中文错误 */
  error: string;
}

// reverse_estimate 语义（Rust 侧实现遵循）：
// - 实际回报率 = nominalReturnPct − inflationPct；
// - 实际回报率 ≤ 0：error 非空，sustainableMonthly = 0，yearsSupported = 0，
//   investableAssets 仍返回扣除后的值。

// ---------------------------------------------------------------------------
// e. run_monte_carlo —— 蒙特卡洛模拟
// ---------------------------------------------------------------------------

/** 蒙特卡洛支取策略（退休耗尽模拟的支取规则；缺省 "fixed" = 既有口径，向后逐字节兼容） */
export type WithdrawalStrategy = "fixed" | "threshold" | "percent";

/** 阈值带调整型参数（strategy = "threshold" 时必填；全部字段必填，无隐式缺省） */
export interface ThresholdStrategyParams {
  /** 超带阈值（百分点）：当前支取率 > 初始支取率 × (1 + exceedPct/100) 触发降支；[0, 100] */
  exceedPct: number;
  /** 降支幅度（百分点）：触发当年支出 = 上年支出 × (1 − cutPct/100) × (1 + 当年通胀样本)；[0, 100] */
  cutPct: number;
  /** 低于带阈值（百分点）：当前支取率 < 初始支取率 × (1 − fallPct/100) 触发升支；[0, 100] */
  fallPct: number;
  /** 升支幅度（百分点）：触发当年支出 = 上年支出 × (1 + raisePct/100) × (1 + 当年通胀样本)；[0, 100] */
  raisePct: number;
  /** 末段不降支年数：距模拟终点 ≤ 该年数时不再降支；[0, 200] 整数 */
  noCutLastYears: number;
  /** 负收益年冻结：上一年回报样本 < 0 且当前支取率 > 初始支取率时，当年不进行通胀上调 */
  freezeOnLoss: boolean;
}

/** 余额比例型参数（strategy = "percent" 时必填；全部字段必填，无隐式缺省） */
export interface PercentStrategyParams {
  /** 长期实际回报假设（百分点，> −100）：摊还年金化的利率 r */
  realReturnAssumpPct: number;
  /** 名义支出地板（上年支取额的百分比，0 = 关闭；[0, 100]；自第 2 年起生效） */
  floorPctOfLastYear: number;
  /** 支出上限（首年实际摊还支出的该百分比、随通胀上行，0 = 关闭；[0, 1000]。
   *  「首年实际摊还支出」= currentAssets × r × (1+r)^years / ((1+r)^years − 1)，
   *  即 percent 策略第 1 年按实际口径算出的摊还值——与基期年支出 annualSpend 无关
   *  （两值可差 20%+，以本注释为准） */
  capPctOfInitialReal: number;
}

/** 蒙特卡洛模拟输入 */
export interface MonteCarloInput {
  /** 当前资产（元） */
  currentAssets: number;
  /** 年支出基期值（元/年）：第 1 年支出 = 该值 × (1 + 第 1 年通胀样本)，其后逐年随通胀上行 */
  annualSpend: number;
  /** 名义回报率均值（百分点） */
  nominalReturnMeanPct: number;
  /** 名义回报率标准差（百分点） */
  nominalReturnStdPct: number;
  /** 通胀率均值（百分点） */
  inflationMeanPct: number;
  /** 通胀率标准差（百分点） */
  inflationStdPct: number;
  /** 模拟年数 */
  years: number;
  /** 模拟路径数 */
  paths: number;
  /** 随机种子（同 seed 同输入 → 输出完全可复现） */
  seed: number;
  /** 支取策略（缺省 = "fixed" 现状口径；出现但非三枚举之一 → 报错） */
  strategy?: WithdrawalStrategy;
  /** 阈值带调整型参数（strategy = "threshold" 时必填） */
  threshold?: ThresholdStrategyParams;
  /** 余额比例型参数（strategy = "percent" 时必填） */
  percent?: PercentStrategyParams;
}

/** 蒙特卡洛模拟输出 */
export interface MonteCarloOutput {
  /** 资产耗尽概率（0–1）：任一年末资产 ≤ 0 的路径占比 */
  depletionProb: number;
  /** 期末资产中位数（元，耗尽路径记 0） */
  medianTerminal: number;
  /** 期末资产第 5 百分位（元） */
  p5: number;
  /** 期末资产第 25 百分位（元） */
  p25: number;
  /** 期末资产第 75 百分位（元） */
  p75: number;
  /** 期末资产第 95 百分位（元） */
  p95: number;
  /** 50 条代表性路径的逐年年末值；每条长度 = years（第 1..years 年末） */
  samplePaths: number[][];
  /** 50 条代表性路径的逐年当年支取额（名义元，两位小数；与 samplePaths 同 50 条索引、
   *  同 years 长度；耗尽当年及以后记 0） */
  sampleWithdrawalPaths: number[][];
  /** 末年（第 years 年）支取额第 5 百分位（元，全部路径，type-7 线性插值，两位小数） */
  withdrawalP5: number;
  /** 末年支取额中位数（元） */
  withdrawalMedian: number;
  /** 末年支取额第 95 百分位（元） */
  withdrawalP95: number;
}

// run_monte_carlo 语义（Rust 侧实现遵循）：
// - 逐年模拟：年末值 = 上年末值 × (1 + 当年名义回报样本) − 当年支出，
//   当年支出 = annualSpend × ∏(1 + 通胀样本)，即自第 1 年起随通胀上行；
// - 名义回报 ~ N(mean, std)、通胀 ~ N(mean, std)，均按百分点输入、小数使用；
// - 任一年末值 ≤ 0 即判定该路径耗尽：其后保持 0，计入 depletionProb；
// - 各分位数基于全部路径的期末值（耗尽路径记 0）；
// - 随机数使用 rand 0.8 + rand_distr（wasm32 目标须开启 getrandom "js" feature，
//   见 src/wasm/Cargo.toml），seed 经 StdRng::seed_from_u64 保证可复现。

// run_monte_carlo 支取策略语义（Rust 侧实现遵循）：
// - 记 cum_infl_t = ∏(1 + 通胀样本)（第 t 年含当年），wr0 = annualSpend ÷ currentAssets；
// - fixed（缺省）：spend_t = annualSpend × cum_infl_t（现状口径，不变；不校验 strategy
//   之外的任何新字段）；
// - threshold：
//     spend_1 = annualSpend × (1 + π_1)；
//     第 t ≥ 2 年先算当前支取率 wr_t = spend_{t−1} ÷ assets_{t−1}（年初资产），按序判定：
//       1) wr_t > wr0 × (1 + exceedPct/100) 且 (years − t) > noCutLastYears：
//            spend_t = spend_{t−1} × (1 − cutPct/100) × (1 + π_t)      // 降支并接当年通胀
//       2) 否则若 wr_t < wr0 × (1 − fallPct/100)：
//            spend_t = spend_{t−1} × (1 + raisePct/100) × (1 + π_t)    // 升支并接当年通胀
//       3) 否则若 freezeOnLoss 且 r_{t−1} < 0 且 wr_t > wr0：
//            spend_t = spend_{t−1}                                      // 名义冻结一年
//       4) 否则：spend_t = spend_{t−1} × (1 + π_t)
//     （第 1 年无上一年回报样本，规则 3 不触发；r_{t−1} 为上一年名义回报样本；阈值带
//       语义注释：文献最优解 exceedPct=20 / cutPct=10 / fallPct=20 / raisePct=10 /
//       noCutLastYears=15，更小的阈值或更大的降支幅度不再改善成功率；文献在资本保全
//       规则生效后弃用的「通胀上调封顶 6%」规则不实现；无绝对名义地板/天花板层）
// - percent（全部在实际口径摊还、名义口径支付；固定年限摊空口径，不含长寿保护）：
//     R_{t−1} = assets_{t−1} ÷ cum_infl_{t−1}（实际口径资产，cum_infl_0 = 1）；
//     n_t = years − t + 1（剩余年限，含当年）；
//     摊还支出（实际口径）= R_{t−1} × r × (1+r)^n / ((1+r)^n − 1)，
//       其中 r = realReturnAssumpPct / 100；r = 0 时退化为 R_{t−1} ÷ n；
//     spend_t = 摊还支出 × cum_infl_t（名义化）；
//     上限（capPctOfInitialReal > 0）：spend_t = min(spend_t, cap_base × cum_infl_t × cap/100)，
//       其中 cap_base = 首年实际摊还支出 = assets_0 × r × (1+r)^years / ((1+r)^years − 1)
//       （r = 0 时 = assets_0 ÷ years；第 1 年计算后全程缓存）——上限基数为 percent
//       策略自身的首年摊还值，与 annualSpend 无关；
//     地板（floorPctOfLastYear > 0 且 t ≥ 2）：spend_t = max(spend_t, spend_{t−1} × floor/100)；
//     可用资产钳制（恒启用）：spend_t = min(spend_t, assets_{t−1} × (1 + r_t))——
//       余额比例型构造上不把资产抽为负（文献口径：纯比例型破产概率恒为 0）；
//     耗尽判定窗口为第 1..years−1 年末：摊还计划的数学终点是第 years 年末归零，终点年
//       资产恰为 0（或剩余残值）不计入耗尽；终点年前资产 ≤ 0（实际上仅「地板垫高支出」
//       或极端回报样本可触发）仍计入耗尽并终止该路径，其后支取记 0；
//     floorPctOfLastYear > 0 时重新可能出现中途耗尽（地板垫高早期支取），与研究口径一致。
// - 策略参数校验（任一失败 → error + 全字段安全值）：
//     strategy 字段缺省按 "fixed"；出现但非三枚举之一 → 报错；
//     strategy = "threshold"：threshold 必填；exceedPct/cutPct/fallPct/raisePct ∈ [0,100]，
//       noCutLastYears ∈ [0,200] 整数；currentAssets > 0 且 annualSpend > 0
//       （wr0 无法定义时报错「阈值带策略要求当前资产与年支出均大于 0」）；
//     strategy = "percent"：percent 必填；realReturnAssumpPct > −100，floorPct ∈ [0,100]，
//       capPct ∈ [0,1000]（不隐式回退均值差——前端显式传值）；
// - sampleWithdrawalPaths：与 samplePaths 同索引（idx_k = round(k × (paths−1)/49)）的
//   逐年当年支出额（名义元，两位小数）；耗尽当年及以后记 0；fixed 策略下同样输出
//   （= annualSpend × cum_infl 的各路径值）；
// - withdrawalP5/Median/P95：全部路径「末年支取额」的 type-7 分位（升序排序 + 线性插值，
//   两位小数）；耗尽路径末年支取额记 0；
// - 其余（递推 assets_t = assets_{t−1} × (1 + r_t) − spend_t、耗尽 ≤ 0 判定、防御钳制、
//   统计舍入、samplePaths 索引公式）与 P1 现状完全一致。

// 可复现性铁律：蒙特卡洛抽样顺序（路径外层、年份内层、先回报后通胀；bootstrap 先抽
// 序列索引再抽通胀）不得因策略层引入而改变——fixed 策略下同 seed 同输入输出必须与
// P1 现状逐字节一致（§9.2 锁定）。

// ---------------------------------------------------------------------------
// f. estimate_tax —— 税务估算
// ---------------------------------------------------------------------------

/** 超额累进税档（lower 升序；rate 为小数形式，0.03 表示 3%） */
export interface TaxBand {
  /** 该档起征下限（应纳税所得额） */
  lower: number;
  /** 该档税率（小数形式） */
  rate: number;
}

/** 税务估算输入（通常由数据层 TaxTable 的对应字段展开而来） */
export interface EstimateTaxInput {
  /** 年度税前总收入 */
  grossAnnualIncome: number;
  /** 标准扣除额 */
  standardDeduction: number;
  /** 超额累进税档（lower 升序） */
  bands: TaxBand[];
}

/** 税务估算输出 */
export interface EstimateTaxOutput {
  /** 应纳税所得额 = max(0, grossAnnualIncome − standardDeduction) */
  taxableIncome: number;
  /** 年度税额（超额累进：第 i 档覆盖 [lower_i, lower_{i+1})，末档到 +∞） */
  tax: number;
  /** 税后收入 = grossAnnualIncome − tax */
  netIncome: number;
  /** 有效税率（百分点）= tax ÷ grossAnnualIncome × 100（gross 为 0 时返回 0） */
  effectiveRatePct: number;
}

// ---------------------------------------------------------------------------
// g. simulate_accumulation —— 打工积累模拟
// ---------------------------------------------------------------------------

/** 打工积累模拟输入 */
export interface AccumulationInput {
  /** 当前资产（元） */
  currentAssets: number;
  /** 税后月收入（元/月） */
  monthlyIncome: number;
  /** 月支出（元/月，基期名义值） */
  monthlyExpense: number;
  /** 财富自由目标值（元，基期名义值；判定时按通胀逐年上调） */
  targetValue: number;
  /** 名义回报率均值（百分点） */
  nominalReturnMeanPct: number;
  /** 名义回报率标准差（百分点，须 > 0） */
  nominalReturnStdPct: number;
  /** 通胀率均值（百分点） */
  inflationMeanPct: number;
  /** 通胀率标准差（百分点，须 > 0） */
  inflationStdPct: number;
  /** 模拟年数（1–200） */
  years: number;
  /** 模拟路径数（1–100000） */
  paths: number;
  /** 随机种子（同 seed 同输入 → 输出完全可复现） */
  seed: number;
}

/** 期末资产分位数（元，全部路径，type-7 线性插值） */
export interface AccumulationFinalPercentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

/** 打工积累模拟输出 */
export interface AccumulationOutput {
  /** 达成财富自由的路径占比（0–1，6 位小数） */
  fiProbability: number;
  /** 首达年限第 5 百分位（年，仅在达成样本内取；无达成样本 = -1） */
  yearsP5: number;
  /** 首达年限第 25 百分位（年；无达成样本 = -1） */
  yearsP25: number;
  /** 首达年限中位数（年；无达成样本 = -1） */
  yearsMedian: number;
  /** 首达年限第 75 百分位（年；无达成样本 = -1） */
  yearsP75: number;
  /** 首达年限第 95 百分位（年；无达成样本 = -1） */
  yearsP95: number;
  /** 未达成路径占比（0–1，6 位小数；与 fiProbability 独立重算） */
  neverReachedShare: number;
  /** 期末资产分位数（元，全部路径） */
  finalAssetPercentiles: AccumulationFinalPercentiles;
  /** 50 条代表性路径的逐年年末资产；每条长度 = years（第 1..years 年末） */
  samplePaths: number[][];
  /** "" 表示成功 */
  error: string;
}

// simulate_accumulation 语义（Rust 侧实现遵循）：
// - 月储蓄 = monthlyIncome − monthlyExpense（可为负）；
// - 年储蓄_t = 月储蓄 × 12 × ∏(1 + 通胀样本)，自第 1 年起随通胀上行
//   （与 run_monte_carlo 的支出上行同口径）；
// - 资产递推（名义口径，与 run_monte_carlo 一致）：
//     assets_t = assets_{t−1} × (1 + 名义回报样本) + 年储蓄_t，资产下限钳 0；
// - 财富自由判定：assets_t ≥ targetValue × ∏(1 + 通胀样本)（目标随通胀水涨）；
//   初始（t = 0）即判定：currentAssets ≥ targetValue 记首达年限 0；
//   首达即记录年限（整数年），之后继续模拟至 years 结束（路径图需要全程曲线）；
// - fiProbability = 达成路径占比（6 位小数）；
// - 年限分位（type-7 线性插值、两位小数）只在达成样本内取；无达成样本五个分位均为 -1；
// - σ ≤ 0 或 years ≤ 0 返回 error；
// - 抽样顺序与种子确定性与 run_monte_carlo 完全一致：路径外层、年份内层，
//   每年先抽名义回报样本、再抽通胀样本，同 seed 同输入输出逐字节一致。

// ---------------------------------------------------------------------------
// h. run_monte_carlo_bootstrap —— 蒙特卡洛历史自助抽样
// ---------------------------------------------------------------------------

/** 历史自助抽样蒙特卡洛输入：字段与 MonteCarloInput 完全一致 + 收益序列 */
export type MonteCarloBootstrapInput = MonteCarloInput & {
  /**
   * 历史年度回报序列（百分点，如 14.68 表示 +14.68%；小数形式由核心侧 /100）。
   * 每年从该序列中**有放回均匀重抽** 1 个元素作为当年名义回报样本（i.i.d.，
   * 忽略年份顺序与序列相关性）；至少 1 个元素，每个元素为有限数值且
   * > −100 且 |元素| ≤ 1000（百分点）。
   * nominalReturnMeanPct / nominalReturnStdPct 在本模式下**仅校验、不参与计算**
   * （分布由序列决定）；通胀仍按其均值/标准差的正态分布抽样。
   */
  series: number[];
};

// 输出结构与 MonteCarloOutput 完全一致（复用该类型，无新输出类型）。
// MonteCarloBootstrapInput = MonteCarloInput & { series: number[] }，类型层面自动获得
// strategy / threshold / percent 同组字段；正态与自助抽样两模式共用同一策略层
// （正态模式回报样本来自正态抽样，自助模式来自序列重抽；freezeOnLoss 的
// 「上一年回报样本」在两模式下分别为抽样值与所抽序列元素）。

// run_monte_carlo_bootstrap 语义（Rust 侧实现遵循）：
// - 随机数 StdRng::seed_from_u64(seed)；抽样顺序固定：路径外层、年份内层，
//   每年先抽「序列元素索引」（均匀有放回）、再抽通胀正态样本；
//   耗尽 break 语义与 run_monte_carlo 相同（任一年末资产 ≤ 0 即终止该路径）；
//   同 seed 同输入 → 输出逐字节一致（§7 测试锁定）。
// - 回报样本 = 所抽元素 ÷ 100，随后沿用既有防御：< −0.99 钳为 −0.99；
// - 通胀样本与递推、耗尽判定、统计（depletionProb 6 位小数、期末分位 type-7
//   两位小数、samplePaths 50 条索引公式）与 run_monte_carlo 完全一致；
// - σ ≤ 0 / years ≤ 0 / 序列为空 / 序列元素越界 → error；
// - 错误安全形状与 run_monte_carlo 相同（数值 0、samplePaths 空数组）。

// ---------------------------------------------------------------------------
// i. estimate_pension —— 社保养老金估算（简化两层公式）
// ---------------------------------------------------------------------------

/** 社保养老金估算输入：BaselineInput 全字段 + 养老金专属字段 */
export interface PensionInput extends BaselineInput {
  /** 当前年龄（16–70，整数） */
  currentAge: number;
  /** 预期退休年龄（40–75，整数，须大于当前年龄） */
  retireAge: number;
  /** 预期截至退休的累计缴费年限（0–50，整数） */
  contribYears: number;
  /** 平均缴费基数指数（小数形式，[0, 10]；1.0 = 按社平工资 100% 缴费） */
  contribIndex: number;
  /** 个人账户余额估计（元） */
  accountBalance: number;
  /** 计发口径社会平均工资（元/月） */
  avgMonthlyWage: number;
  /** 计发月数（1–600，整数） */
  monthsDivisor: number;
}

/** 社保养老金估算输出（全部金额两位小数） */
export interface PensionOutput {
  /** 距退休年限 = retireAge − currentAge（整数） */
  yearsToRetire: number;
  /** 基础养老金（元/月）=（社平工资 + 社平工资 × 缴费基数指数）÷ 2 × 缴费年限 × 1% */
  basicPensionMonthly: number;
  /** 个人账户养老金（元/月）= 个人账户余额估计 ÷ 计发月数 */
  accountPensionMonthly: number;
  /** 预计月养老金（元/月）= 基础 + 个人账户 */
  pensionMonthly: number;
  /** 养老金覆盖率 = pensionMonthly ÷ monthlyExpense（两位小数，可 > 1 不封顶；月开销 0 时为 0） */
  coverageRatio: number;
  /** 调整后月开销（元/月）= max(0, monthlyExpense − pensionMonthly) */
  adjustedMonthlyExpense: number;
  /**
   * 调整后财富自由参考线（元）= adjustedMonthlyExpense × multiplier
   *   + childCount × costPerChild + healthReserve + majorInvestment
   * （乘数与 calculate_baseline 同口径：先 round2 再相乘；实际回报率 ≤ 0 时为 0）
   */
  adjustedCriticalValue: number;
  /** 480 法则乘数（与 calculate_baseline 同口径两位小数回显，便于前端复算） */
  multiplier: number;
  /** "" 表示成功；实际回报率 ≤ 0 时为非空中文错误，此时金额/乘数类字段全部为 0 */
  error: string;
}

// estimate_pension 语义（Rust 侧实现遵循）：
// - 校验顺序固定（见 §3.3）；任一校验失败 → error + 全字段安全值 0；
// - 实际回报率 = nominalReturnPct − inflationPct；≤ 0 → error
//   「通胀率需低于名义回报率」（与 calculate_baseline 同文案同分支形状：
//   multiplier = 0、adjustedCriticalValue = 0、其余金额 0）；
// - multiplier = round2(12 ÷ (实际回报率/100))（checked_div 防御，同 baseline）；
// - basic = round2(((社平 + 社平×指数) ÷ 2) × 缴费年限 ÷ 100)；
// - account = round2(账户余额 ÷ 计发月数)；
// - pensionMonthly = round2(basic + account)；
// - coverageRatio = round2(pensionMonthly ÷ monthlyExpense)，月开销为 0 时 = 0；
// - adjustedMonthlyExpense = round2(max(0, monthlyExpense − pensionMonthly))；
// - adjustedCriticalValue = round2(adjustedMonthlyExpense × multiplier
//     + childCount × costPerChild + healthReserve + majorInvestment)——
//   恒等式 adjustedCriticalValue == calculate_baseline(同附加项,
//   monthlyExpense = adjustedMonthlyExpense).criticalValue 由测试锁定；
// - 本函数为纯金额精确运算（无随机抽样），全程 rust_decimal。

// ---------------------------------------------------------------------------
// j. simulate_sequence —— 确定性序列模拟（序列风险对照，无随机）
// ---------------------------------------------------------------------------

/** 确定性序列模拟的现金流方向 */
export type SequenceDirection = "withdrawal" | "accumulation";

/** 确定性序列模拟输入（起点滚动与三序对照由调用方切片/重排 series 后调用，核心无随机） */
export interface SequenceSimInput {
  /**
   * 按序逐年名义回报序列（百分点，如 14.68 表示 +14.68%；核心侧 /100）。
   * 按数组顺序逐年取值，禁随机；至少 1 个元素；每元素有限且 > −100 且 |元素| ≤ 1000。
   */
  series: number[];
  /** 模拟年数（1 ≤ years ≤ series.length，整数） */
  years: number;
  /** 现金流方向 */
  direction: SequenceDirection;
  /** 期初资产（元） */
  currentAssets: number;
  /**
   * direction = "withdrawal" 时生效：年支出（元，固定名义，全年不变；
   * UI 侧由「初始支取率 %」换算 = currentAssets × rate/100 后传入）
   */
  annualSpend: number;
  /** direction = "accumulation" 时生效：年末入金的年储蓄（元，固定名义） */
  annualSaving: number;
}

/** 确定性序列模拟输出 */
export interface SequenceSimOutput {
  /** 逐年年末资产（元，两位小数，长度 = years；支取口径耗尽当年及以后记 0） */
  assetPath: number[];
  /** 期末资产（元，两位小数；支取口径耗尽记 0；积累口径下限钳 0） */
  terminalAssets: number;
  /** 耗尽年（1 起计；−1 = 存活 / 积累口径不适用） */
  depletedYear: number;
  /** 期末倍数 = terminalAssets ÷ currentAssets（两位小数；currentAssets ≤ 0 时为 0） */
  terminalMultiple: number;
  /** "" 表示成功 */
  error: string;
}

// simulate_sequence 语义（Rust 侧实现遵循）：
// - 确定性：不构造随机源、不引入 rand；回报样本 = series[t−1] / 100（第 t 年取第 t−1 个
//   元素），沿用既有防御：样本 < −0.99 钳为 −0.99；
// - 通胀置 0（名义 = 实际）：本函数为序列风险对照专用确定性口径，不含通胀上行，
//   上层口径注必须写明（研究采纳项 9）；
// - 支取口径：assets_t = assets_{t−1} × (1 + r_t) − annualSpend；任一年末资产 ≤ 0 判耗尽，
//   终止递推，当年及以后路径记 0、terminalAssets 记 0、depletedYear = t；
// - 积累口径：assets_t = assets_{t−1} × (1 + r_t) + annualSaving；资产下限钳 0
//   （与 simulate_accumulation 同语义，钳后继续、不提前终止）；depletedYear 恒为 −1；
// - 两口径与既有 run_monte_carlo / simulate_accumulation 的递推完全一致
//   （现金流出 − 支出 / 现金流入 + 储蓄），仅把随机样本替换为按序取用的序列元素；
// - 校验：series 非空且逐元素（|v| ≤ 1000 且 v > −100）→ years 整数且
//   1 ≤ years ≤ series.length → 金额字段非负（0 ≤ v ≤ 1e15）→ direction 枚举；
//   direction = "withdrawal" 时 annualSpend 参与、annualSaving 忽略；反之亦然；
// - 全程 f64（对照模拟属统计演示口径，与蒙特卡洛域一致；输入按 arbitrary_precision
//   精确解析后转 f64），输出金额两位小数、倍数两位小数。

// ---------------------------------------------------------------------------
// k. solve_required_saving —— 目标日期反推所需月储蓄（闭式解，确定性）
// ---------------------------------------------------------------------------

/** 目标日期反推输入 */
export interface RequiredSavingInput {
  /** 当前资产（元） */
  currentAssets: number;
  /** 财富自由目标值（基期名义值） */
  targetValue: number;
  /** 目标年限（1–200 整数） */
  years: number;
  /** 名义回报率均值（百分点） */
  nominalReturnMeanPct: number;
  /** 通胀率均值（百分点） */
  inflationMeanPct: number;
}

/** 目标日期反推输出 */
export interface RequiredSavingOutput {
  /** 所需月储蓄（元/月，两位小数；可为负 = 无需储蓄即可达成，差额为达成后可提前消费额） */
  requiredMonthlySaving: number;
  /** "" 表示成功 */
  error: string;
}

// solve_required_saving 语义（Rust 侧实现遵循，全程 rust_decimal，幂用循环 checked_mul）：
// - r = nominalReturnMeanPct/100，i = inflationMeanPct/100；校验在 check_pct_signed 之上
//   追加硬约束：nominalReturnMeanPct > −100 且 inflationMeanPct > −100（百分点）——
//   check_pct_signed 的 |v| ≤ 1000 上限不足以保证 (1+r) > 0、(1+i) > 0，而闭式解要求
//   两者均为正（否则幂运算变号、F 可能 ≤ 0），违反即 error「回报率与通胀率不得低于
//   −100%」（与蒙特卡洛回报样本 −0.99 防御钳制同一物理口径）；
// - q = (1+i) ÷ (1+r)（Decimal 精确除；i = r 时精确得 1）；
// - 年储蓄终值因子 F = Σ_{t=1..T} (1+i)^t (1+r)^{T−t}：
//     q == 1（即 i == r）：F = T × (1+r)^T（每项恰为 (1+r)^T）；
//     q ≠ 1：F = (1+r)^T × q × (q^T − 1) ÷ (q − 1)；
// - requiredMonthlySaving = (targetValue × (1+i)^T − currentAssets × (1+r)^T) ÷ (12 × F)；
//   F 恒 > 0（每项为正），无除零分支；结果可为负（资产已超前于随通胀上行的目标）；
// - 与 simulate_accumulation 的确定性均值口径严格对应：第 t 年末入金 = 该值 × 12 × (1+i)^t、
//   资产按 (1+r) 复利、目标按 (1+i)^T 上行——第 years 年末资产恰等于目标（§9.4 锁定）；
// - 校验：金额非负（0 ≤ v ≤ 1e15）→ years ∈ [1,200] 整数 → 均值两字段 check_pct_signed；
//   任一失败 → error + requiredMonthlySaving = 0。
