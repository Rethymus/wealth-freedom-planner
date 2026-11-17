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
 * 占位 stub（src/wasm/pkg/finance_core.js）在真实 wasm-pack 产物就位前：
 * 同步导出被调用会抛出 Error("WASM_NOT_BUILT")；init 返回以该错误拒绝的 Promise。
 * UI 层可据此提示「计算核心未就绪」。
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
  estimate_tax: WasmFn;
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

/** 蒙特卡洛模拟输入 */
export interface MonteCarloInput {
  /** 当前资产（元） */
  currentAssets: number;
  /** 首年年支出（元/年） */
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
}

// run_monte_carlo 语义（Rust 侧实现遵循）：
// - 逐年模拟：年末值 = 上年末值 × (1 + 当年名义回报样本) − 当年支出，
//   当年支出 = annualSpend × ∏(1 + 通胀样本)，即自第 1 年起随通胀上行；
// - 名义回报 ~ N(mean, std)、通胀 ~ N(mean, std)，均按百分点输入、小数使用；
// - 任一年末值 ≤ 0 即判定该路径耗尽：其后保持 0，计入 depletionProb；
// - 各分位数基于全部路径的期末值（耗尽路径记 0）；
// - 随机数使用 rand 0.8 + rand_distr（wasm32 目标须开启 getrandom "js" feature，
//   见 src/wasm/Cargo.toml），seed 经 StdRng::seed_from_u64 保证可复现。

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
