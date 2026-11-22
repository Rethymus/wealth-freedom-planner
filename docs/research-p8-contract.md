# P8·统一生命周期现金流引擎契约草案（research-p8-contract）

> 定位：brief §六 衔接注记——原 P8（统一生命周期引擎）为 WF-04 前置。本文只做**现状盘点与契约设计**，零施工。
> 依据源码：`src/wasm/src/*.rs`（9 个点名模块）＋ `src/wasm/bridge.ts` ＋ `src/services/finance.ts` ＋ `src/store/useCalculatorStore.ts`，全部逐行精读于本会话。
> 文件名映射登记：任务清单中 `loan.rs` 在仓内实际为 `src/wasm/src/amort.rs`（还款计划模块，amort.rs:1）；点名清单未含 `bootstrap.rs`/`reverse.rs`，本文按 bridge.ts 既有契约登记其编排面，不展开内部实现。

---

## §1 现状编排面盘点

### 1.1 随机消费面（蒙特卡洛域，f64 统计域）

| 模块（导出名） | 输入 | 输出 | 随机流消费位置 |
| --- | --- | --- | --- |
| **accumulation.rs** `simulate_accumulation` | `AccumulationInput` 12 字段（accumulation.rs:72-111；含可选 `sustain_years` :109-110） | `AccumulationOutput` 11 键（:126-151）：fiProbability、sustainedProbability、年限五分位、neverReachedShare、finalAssetPercentiles、samplePaths、error | 主流 `StdRng::seed_from_u64(seed)`（:245）；pass1 每路径固定消费 2×years 样本、先回报后通胀、全程不提前终止（:267-276）；pass2 仅达标路径、独立派生流 `seed ^ ((p+1)×0x9E37_79B9_7F4A_7C15)`（:336-338），自首触快照续推支取（:344-366） |
| **montecarlo.rs** `run_monte_carlo` | `MonteCarloInput` 12 键（montecarlo.rs:62-96；strategy/threshold/percent 三可选 :91-95） | `MonteCarloOutput` 12 键（:100-125）：depletionProb、期末五分位、samplePaths、sampleWithdrawalPaths、末年支取三分位、error | 主流（:216）；每年先回报后通胀（:233-241）；耗尽路径终止递推、样本补零（:291-305）；支取策略层委托 withdrawal.rs（:249-263），策略层零随机 |
| **bootstrap.rs** `run_monte_carlo_bootstrap` | `MonteCarloBootstrapInput` = MonteCarloInput & {series}（bridge.ts:588-598） | 与 MonteCarloOutput 同型（bridge.ts:600-604） | 主流（bootstrap.rs:229）；抽样顺序「先抽序列元素索引（有放回均匀）、再抽通胀正态样本」（:10-13、:33） |
| **withdrawal.rs**（策略层，非导出） | strategy/threshold/percent 三输入结构（withdrawal.rs:63-98） | 纯函数返回当年支取额 | **零随机消费**（:9-13 明文纪律）；`resolve_strategy`（:107-155）——fixed/inflation_uplift 同映射 `Strategy::Fixed`（:118）、threshold、percent；`next_spend_threshold`（:165-192）降支→升支→冻结→通胀上调四规则依序判定；`annuitize`（:196-217）＋`percent_cap_base`（:222-224）请求级缓存上限基数；`next_spend_percent`（:231-268）摊还→名义化→上限→地板→可用资产钳制 |

**accumulation pass1/pass2 派生流字节兼容锁（:215-267）**：seed 解析（:215）→ 分布构造（:218-227）→ 抽样索引（:236-243）→ 主流构造（:245）→ 首触快照簿记（:249-253，纯簿记不消费随机流）→ 初始判定与逐年递推开头（:254-267）。该区间是「可复现性三不变」的锁区（bridge.ts:565-577）：(a) pass1 流序不变；(b) sustainYears 缺省/0 不进 pass2、输出与现状逐字节一致；(c) sustainYears>0 时既有字段同 seed 逐字节一致。**P8 引擎契约以该锁区为不可触碰前提**（§4）。

### 1.2 确定性金额面（Decimal 精确域，零随机）

| 模块（导出名） | 输入 | 输出 | P8 可复用原子 |
| --- | --- | --- | --- |
| **baseline.rs** `calculate_baseline` | `BaselineInput` 7 字段（baseline.rs:25-47） | 7 键（:50-74）：realReturnPct、multiplier、multiplierExact（费雪口径 :139-146）、criticalValue、criticalValueExact、monthlyExpense、error | FI 目标双口径基线；乘数先 round2 后相乘（:130-134、:148-158） |
| **pension.rs** `estimate_pension` | `PensionInput` = BaselineInput 全字段＋8 养老金字段（pension.rs:45-95） | 11 键（:99-134） | **桥接期时间口径**：`bridge_years = max(0, retire_age − max(target, current_age))`（:199-205）；`bridgeFundingNeeded = round2(monthlyExpense × multiplier)` 纯生活费口径（:290-303）；一次性附加项归段 2（R5 归属裁定 :290-294）；简化口径明示「不考虑待遇逐年上调」（:9-11）——P8 领取段养老金恒额的契约依据 |
| **amort.rs** `amortize` | `AmortizeInput` 4 字段（amort.rs:36-48） | monthlyPayment/totalInterest/rows（:69-82） | 购房事件年供款原子：月供 `tvm::pmt`（:147-156）＋两位小数台账 `build_schedule`（:136-210），rental.rs:167 同款复用先例 |
| **rental.rs** `rental_analysis` | `RentalInput` 10 字段（rental.rs:29-60） | 4 键＋breakdown 11 键（:62-105） | 购房年持有成本对照（年净现金流 :184、回本年限 :186-194）；本轮登记不进递推（§3.3） |
| **tax.rs** `estimate_tax` | `EstimateTaxInput` 3 键（tax.rs:35-44，bands 结构 :24-31） | 4 键（:46-63） | 税负原子（分段累进 :117-129）；本轮登记不进递推（§2.4 不施工清单） |
| **sequence.rs** `simulate_sequence` | `SequenceSimInput` 6 键（sequence.rs:26-43） | 5 键（:47-58）：assetPath、terminalAssets、depletedYear、terminalMultiple、error | **确定性范式**：「不构造随机源、不引入 rand；回报样本 = series[t−1]/100」（:108-113）；支取口径耗尽判（:133-141）；积累口径钳 0 继续（:143-149） |
| lib.rs 逆推/闭式解 | `reverse_estimate`（lib.rs:80）、`solve_required_saving`（lib.rs:122） | 见 bridge.ts §d/§k | `solve_required_saving` 均值口径递推契约（bridge.ts:830-833）：「第 t 年末入金 = 该值 × 12 × (1+i)^t、资产按 (1+r) 复利、目标按 (1+i)^T 上行」——**P8 确定性时间线的同族口径先例** |

### 1.3 编排先例（TS 侧，核心零随机）

finance.ts 已有「TS 编排层＋确定性核心」先例：`runSequenceRolling`（:466-500，切片/循环调 calcSequence、窗口装配）、`selectFateWindows`（:436-454，最好/中位/最差选取）、`runSequenceReorder`（:506-534，三序对照）。统一结果类型 `FinanceResult<T>`（:53-55）＋`invoke` 包装永不抛出（:133-148）。**P8 引擎沿用同构**：新增 service 编排函数，金额原子复用 §1.2 WASM 纯函数，新增 Rust 导出面 = 0。

### 1.4 Store 切片清单（引擎输入的唯一来源）

useCalculatorStore.ts 业务切片：`baselineInputs`/`progressInputs`/`reverseInputs`/`loanInputs`/`rentalInputs`/`monteCarloInputs`/`taxInputs`/`accumulationInputs`/`pensionInputs`（:74-96）；默认值工厂 `businessDefaults()`（:156-174）；联动态装配先例 `buildShareState`（:299-321）——其中 pension `monthsDivisor` 以 `effectiveMonthsDivisor` 联动表值入链（:313-319），P8 输入派生沿用同一函数、禁止两处内联重推。

---

## §2 年度现金流引擎契约

### 2.1 LifecycleInput（41 字段，全部既有 store 键引用；**新增必填用户输入 = 0**）

```ts
/** 全部字段由 useCalculatorStore 既有切片派生，类型引用 bridge.ts 既有契约，不新定义字段形状 */
interface LifecycleInput {
  base: BaselineInput;            // 7 字段 ← store.baselineInputs（bridge.ts §a 原样引用）
  accum: {                        // 12 字段 ← store.accumulationInputs
    currentAssets: number;        // 期初资产
    monthlyIncome: number;        // 税后月收入（工作段储蓄基流分子）
    monthlyExpense: number;       // 月支出（基期名义；工作段储蓄与桥接/领取段生活费共用）
    targetValue: number;          // FI 目标值（基期名义；判定随通胀水涨，accumulation.rs:290-292 同式）
    nominalReturnMeanPct: number; // 确定性递推的回报率（均值口径）
    nominalReturnStdPct: number;  // 仅透传 simulate_accumulation（引擎自身不消费 σ）
    inflationMeanPct: number;     // 确定性递推的通胀率（均值口径）
    inflationStdPct: number;      // 仅透传，引擎自身不消费
    years: number;                // 工作段模拟年数上限（horizon 下界素材）
    paths: number;                // 仅透传既有双指标调用
    seed: number;                 // 仅透传既有双指标调用；引擎递推禁触（§4）
    sustainYears?: number;        // 存续口径 N；缺省/0 = 未度量哨兵（bridge.ts:515-519）
  };
  pension: {                      // 8 字段 ← store.pensionInputs
    currentAge: number;           // 年龄轴原点
    retireAge: number;            // 养老金起领年（相对年序 = retireAge − currentAge）
    targetRetireAge?: number;     // 停工年；缺省 = retireAge → 桥接 0（pension.rs:203-205 同式）
    contribYears: number;
    contribIndex: number;
    accountBalance: number;
    avgMonthlyWage: number;
    monthsDivisor: number;        // 联动态经 effectiveMonthsDivisor（store :313-319 同口径）
  };
  loan: AmortizeInput;            // 4 字段 ← store.loanInputs（购房年供款原子输入）
  rental: RentalAnalysisInput;    // 10 字段 ← store.rentalInputs（购房持有成本对照，本轮仅登记）
}
```

字段计数：base 7 ＋ accum 12 ＋ pension 8 ＋ loan 4 ＋ rental 10 ＝ **41**。校验委托既有契约原文（金额非负/σ>0/年龄域等，各模块 §校验段），编排层不另立校验口径。

**「不施工」清单（可选演进参数，本轮契约不接受任何一项）**：

| 演进参数 | 不施工理由（契约依据） |
| --- | --- |
| 收入增长列 `incomeGrowthSeries` | 月储蓄基流仅随通胀上行（accumulation.rs:280 年储蓄 × cum_infl 口径；required_saving 均值口径同族 bridge.ts:830-833），不做实际增长假设 |
| 房价时间化 `buyYear/sellYear` | brief §五「房价一次性计入目标→新模型按事件发生时间计支付」处置归 WF-04；本轮以 `base.majorInvestment` 一次性口径承载 |
| 医疗预留生命周期化 `healthPhase[]` | brief §五「保留为情景输入」；本轮以 `base.healthReserve` 一次性附加承载 |
| 养老金待遇逐年上调 `pensionIndexation` | pension.rs:9-11 简化口径明示不考虑；领取段养老金恒额 |
| 税档年度指数化 `taxBandIndexing` | tax bands 为静态输入（tax.rs:35-44）；税负本轮不进递推 |
| 年度收入税负折算 | `taxInputs` 仅登记；工作段储蓄沿用税后月收入口径（accumulation.rs:77） |
| 事件自定义编辑 | 事件 schema 预留位只读派生（§3.2）；编辑器归 WF-04 |

### 2.2 YearRow 年度行 schema（8 字段）

```ts
interface YearRow {
  year: number;            // 相对年序 t，1..=horizon（递推序与 accumulation/montecarlo 同例，1 起计）
  age: number;             // pension.currentAge + year − 1（年龄轴）
  openingAssets: number;   // 期初资产（元，两位小数）＝上一年 closingAssets；第 1 年 = accum.currentAssets
  contribution: number;    // 当年投入（名义元，两位小数）：工作段 = (月收入 − 月支出)×12×(1+i_mean)^t
                           //   （accumulation.rs:280 年储蓄随通胀上行同式）；停工后恒 0
  withdrawal: number;      // 当年支取（名义元，两位小数）：桥接段 = 月支出×12×(1+i_mean)^t（pension.rs
                           //   桥接纯生活费口径 :290-303）；领取段 = max(0, 生活费 − pensionMonthly×12)；
                           //   工作段恒 0
  events: LifecycleEventTag[];  // 事件标记（§3.2 预留位；本轮除派生标记外恒空数组）
  pensionStart: boolean;   // 当年是否养老金起领（t = retireAge − currentAge 时为 true；由既有输入派生）
  closingAssets: number;   // 期末资产（名义元，两位小数）：opening×(1+r_mean) + contribution − withdrawal；
                           //   耗尽当年及以后恒 0（montecarlo.rs:269-277 / sequence.rs:133-141 耗尽语义同款）
}
```

### 2.3 LifecycleOutput（timeline 行数组＋summary 10 字段）

```ts
interface LifecycleOutput {
  timeline: YearRow[];           // horizon 行，逐年装配
  summary: {                     // 10 字段
    horizon: number;             // 实际模拟年数
    fiFirstYear: number;         // FI 首达年（相对年序；-1 = 未达成——accumulation 年限分位 -1 哨兵同款）；
                                 //   判定 closing_t ≥ targetValue×(1+i_mean)^t，含 t=0 初始判定
                                 //   （accumulation.rs:260、:289-297 同式）
    bridgeYears: number;         // 引用 estimate_pension bridgeYears 口径（pension.rs:199-205 同式，不重算）
    bridgeFundingNeeded: number; // 引用同上（pension.rs:290-303 同式，纯生活费口径）
    pensionMonthly: number;      // 引用 estimate_pension pensionMonthly（领取段恒额来源）
    depletedYear: number;        // 确定性路径耗尽年（1 起计；-1 = 存活——sequence.rs depletedYear 同款哨兵）
    survival: {                  // 存续口径——**引用双指标，引擎不重算**（§4）
      fiProbability: number;         // ← simulate_accumulation fiProbability（pass1 口径）
      sustainedProbability: number;  // ← simulate_accumulation sustainedProbability（pass2 口径）
      sustainYears: number;          // 输入回显；0 = 未度量哨兵（bridge.ts:515-519）
    };
    error: string;               // bridge.ts 全局错误约定（"" 成功 / 非空中文安全值）
  };
}
```

服务层形状：编排函数返回 `FinanceResult<LifecycleOutput>`（finance.ts:53-55 统一结果类型；`invoke` 包装 :133-148 永不抛出纪律照抄）。输出轻量校验沿用 finance.ts `num`/`numArray` 解析器先例（:103-117）。

---

## §3 编排语义：事件时间线

### 3.1 三阶段派生（全部由既有输入派生，无新事件输入）

| 阶段 | 相对年序区间 | 派生式 | 现金流行 |
| --- | --- | --- | --- |
| A 工作段 | t = 1 .. workEnd | `workEnd = targetRetireAge − currentAge`（缺省 target = retireAge） | contribution>0、withdrawal=0 |
| B 桥接段 | t = workEnd+1 .. retireAge−currentAge（`bridgeYears>0` 时存在） | `bridgeYears = max(0, retireAge − max(target, currentAge))`（pension.rs:199-205 逐字同式） | contribution=0、withdrawal=生活费全额 |
| C 领取段 | t = retireAge−currentAge+1 .. horizon | 起领年 `t_start = retireAge − currentAge`；pensionMonthly 经 estimate_pension 单次调用 | withdrawal = max(0, 生活费 − 养老金×12) |

horizon 取 `max(accum.years, retireAge − currentAge + 1)`，上限沿用 MAX_YEARS=200 防御规模（accumulation.rs:65 同值）。递推公式：`closing = opening×(1+r_mean) + contribution − withdrawal`；`closing ≤ 0` → `depletedYear = t`、其后行恒 0（§2.2 耗尽语义）。

### 3.2 事件 schema 预留位（本轮定义形状、仅 pensionStart 施工）

```ts
type LifecycleEventTag =
  | { kind: "pensionStart"; year: number }                 // 本轮已施工——由 pension.retireAge 派生
  | { kind: "homePurchase"; year: number }                 // WF-04+：房价时间化（brief §五）
  | { kind: "childBirth"; year: number }                   // WF-04+：育儿成本按年分摊（brief §五）
  | { kind: "healthPhase"; year: number; phase: string };  // WF-04+：医疗预留生命周期化（brief §五）
```

### 3.3 事件 → 既有一次性口径承载对照

| brief §五口径 | 本轮承载（零新口径） | 事件化施工 |
| --- | --- | --- |
| 房价一次性计入目标 | `base.majorInvestment` 单次计入（baseline.rs:148-158 附加项；pension.rs:290-294 R5 归属裁定——附加项与起领时点无关、单次计入停工后总备资） | `homePurchase` tag 形状预留，归 WF-04+ |
| 终身医疗预留 15–60 万 | `base.healthReserve` 情景输入单次附加（同上归属裁定） | `healthPhase` tag 形状预留，归 WF-04+ |
| 育儿成本 | `childCount × costPerChild` 单次附加（baseline.rs:154-158） | `childBirth` tag 形状预留，归 WF-04+ |
| 养老金领取时间 | 桥接两字段已施工于 estimate_pension（P7/P0-1）；引擎派生 `pensionStart` 标记＋领取段折流 | **本轮完成** |

YearRow.events 本轮除引擎派生的只读标记外恒空数组；一次性预留口径的金额不拆行、只在 summary 附加项中单次呈现——保持与 P-A 锚点/恒等式测试兼容（bridge.ts:704-731 锁定语义不动）。

---

## §4 随机流纪律：引擎时间线确定性口径

**选择：编排既有确定性路径函数（零随机消费），否决「引用 pass1 快照机制」。**

1. **确定性口径**：引擎时间线全部消费均值口径参数（`nominalReturnMeanPct`/`inflationMeanPct`），递推为编排层纯函数——与 `solve_required_saving` 的确定性均值口径严格同族（bridge.ts:830-833 契约原文：「第 t 年末入金 = 该值 × 12 × (1+i)^t、资产按 (1+r) 复利、目标按 (1+i)^T 上行」），并沿用 `simulate_sequence` 的「不构造随机源、不引入 rand」范式（sequence.rs:1-6、:108-113）。同输入恒同输出，无 seed 进入引擎递推（`accum.seed`/`accum.paths` 仅透传既有双指标调用）。
2. **随机面不重算**：FI 概率与存续概率以**引用**口径指向 `simulate_accumulation` 既有输出（summary.survival 双指标）。理由：(a) pass1/pass2 字节兼容锁区（accumulation.rs:215-267）与可复现性三不变（bridge.ts:565-577）是不可触碰前提，引擎任何新随机消费都会触碰 §g 不变量审计面；(b) 双指标的统计语义（路径占比、分位）与引擎的单条确定性时间线正交——引擎回答「一条均值路径上何时达 FI/何时耗尽」，双指标回答「跨路径分布」，二者由 UI 并行展示而非相互替代。
3. **否决「引用 pass1 快照机制」的理由**：首触快照 A*/cumInfl* 是 Rust 内部簿记（accumulation.rs:249-253），无 JSON 出口；导出它需要改 Rust 契约并重验锁区三不变，回归代价与收益不成比例；且引擎需要的是**逐行时间线**（每行投入/支取/事件标记），pass1 快照只提供单点（资产、通胀因子），信息量不足以装配 YearRow。若 WF-04 后需要「随机路径透镜」，正确演进是消费既有 `samplePaths`（50 条确定性导出的样本路径，accumulation.rs:395-398 按索引公式可复现），仍零新随机消费。

---

## §5 前端消费面：人生轨迹读数卡（最小面）

新读数卡字段清单（全部映射 summary/timeline 既有字段，无新计算；透镜可视化留 WF-04）：

| # | 读数 | 字段 | 哨兵/展示规则 |
| --- | --- | --- | --- |
| 1 | FI 首达年（＋对应年龄） | `summary.fiFirstYear` ＋ 对应行 `age` | −1 = 未达成 → 展示「未达成」 |
| 2 | 桥接年数 | `summary.bridgeYears` | 0 = 无桥接段（target ≥ retireAge 或缺省） |
| 3 | 桥接期需备资金 | `summary.bridgeFundingNeeded` | 0 = 无桥接段；口径注「纯生活费」 |
| 4 | 预计月养老金（＋起领年） | `summary.pensionMonthly` ＋ `t_start = retireAge − currentAge` | 随 pension error 分支安全值 0 |
| 5 | 确定性路径期末资产 / 耗尽年 | timeline 末行 `closingAssets` ＋ `summary.depletedYear` | −1 = 存活 |
| 6 | 存续双指标 | `summary.survival.fiProbability`；`sustainedProbability` | 仅 `sustainYears > 0` 展示存续项（bridge.ts:515-519 哨兵口径；Rust 不引入 −1 特判） |
| 7 | 事件标记时间轴 | 行 `pensionStart` ＋ `events[]`（本轮仅 pensionStart 激活） | 非视觉替代文本（a11y，brief §七验收门） |

图表复用既有面板组件资产（路径图读 samplePaths 先例），读数卡仅数字＋标记轴；不引入新视觉令牌（令牌演进经 design-language §5.1 准入，本轮零申请）。

---

## 附：字段计数与验证状态

- **契约字段数 = 59**：LifecycleInput 41（全为既有 store 键类型引用，新增必填用户输入 0）＋ YearRow 8 ＋ LifecycleOutput summary 10（timeline 为行数组容器）。
- **新增 Rust 导出面 = 0**；新增 store 切片 = 0；新增必填用户输入 = 0；新视觉令牌 = 0。
- 本会话已运行验证：`ls src/wasm/src/`（确认 loan.rs 不存在、amort.rs 为实际文件）；`wc -l` 全部点名文件（4540 行总量）；grep 核对 bootstrap.rs 抽样顺序（:10-13、:33）与 lib.rs 11 个导出名（:61-122）。grep 断言 `房价时间化|生命周期化` 命中 brief §五（design-atlas-brief.md:113-114）。
- 未运行（草案阶段不适用）：Rust 测试套件、前端构建、禁词门禁的 CI 侧复跑——本文为契约设计物，施工轮以各既有锁定测试（bridge.ts §9）为回归前提。
