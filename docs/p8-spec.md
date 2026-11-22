# P8 实现规范：统一生命周期现金流引擎——既有模块编排 · 人生轨迹读数卡 · 零随机确定性时间线

| 项目 | 说明 |
|---|---|
| 文档性质 | 实施规范：P8 轮（统一生命周期引擎，p7-spec §0.2 排除项落地）。文件级、可勾选；每处变更加「现状（实测引用）→ 目标」与验收锚点 |
| 规范输入 | `docs/research-p8-cases.md`（6 条算例清单，独立手算口径）＋ `docs/research-p8-contract.md`（契约草案与编排面盘点）——本文按其 §2/§4 采纳并修正三处（pensionStart 行号差一、算例④ 耗尽行位、算例③变体 B 一处数值笔误，逐处见 §3.7 偏差登记）；`docs/design-language.md`（宪法，S1–S26 回归基线）；`docs/p7-spec.md` §2.2（两段式独立派生流裁定与可复现性三不变——P8 不可触碰前提） |
| 宪法关系 | 北极星「静水账房」与签名元素 S1–S26 零回退；新读数卡零新视觉令牌、零新签名元素（design-language §5.1 准入：本轮零申请）；Atlas 时间透镜可视化不在本轮（归 WF-04） |
| 基线实测 | 起草会话实跑：`cargo test`（src/wasm）**15 单元 + 60 集成 = 75 项全绿**（`running 15 tests…15 passed` / `running 60 tests…60 passed`）；`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1941`、`WASM_MAX_KB=379`（dist 原始字节合计 **1,987,322** / wasm **387,792**；门禁 `TOTAL_LIMIT_BYTES = 2_000_000`、`WASM_LIMIT_BYTES = 800_000`——check-size.mjs:29-30 实读，dist 余量 **12,678 B**、wasm 余量 412,208 B） |
| 测试装置现状 | Rust 侧 `cargo test` 可用；前端**无**测试装置（package.json scripts 仅 dev/build/preview/check:size/check:currency/check:share/check:data/check:a11y，无 *.test.* 文件，本会话已核实）——P8 新增 `scripts/check-lifecycle.mjs` 走 check-share.mjs 同款零依赖路径（esbuild 在依赖树内 + node:assert；真实 wasm 经 `init(bytes)` 注入） |

---

## §0 范围裁定（本轮做什么 / 明确不做什么）

### 0.1 本轮范围（四项，全部采纳）

- [ ] **A. 引擎编排服务（零 Rust 改动）**：`src/services/finance.ts` 新增 `calcLifecycle`——编排既有 `estimate_pension`（养老金金额 / 桥接两字段）与 `simulate_accumulation`（存续双指标引用）＋ TS 侧纯确定性年度行装配（新增 Rust 导出面 = **0**，`src/wasm/src/*.rs` 与 `bridge.ts` 逐字节不动）。
- [ ] **B. 契约定稿（59 字段）**：LifecycleInput 41 ＋ YearRow 8 ＋ LifecycleOutput summary 10（§1）；全部字段为既有 store 切片 / bridge.ts 既有类型的引用，**新增必填用户输入 = 0、新增 store 切片 = 0、share 载荷键增量 = 0**。
- [ ] **C. 人生轨迹读数卡（最小面）**：`src/components/LifeTrajectoryCard.tsx`（新）——纯读数卡（D9 同构：无输入控件），挂入 LifeTaskPage 分段第一组；图表 / 时间透镜可视化不在本轮（WF-04）。
- [ ] **D. 测试脚本与算例**：`scripts/check-lifecycle.mjs`（新）承载 §3 六条算例断言 ＋ 存续双指标同 seed 逐位一致断言；既有 75 项测试**零变化锁定**（§3.8）。

### 0.2 明确排除（留待 WF-04 / 演进，本轮禁做）

- **时间透镜可视化**：路径图、时间轴图、逐年交互透镜——全部归 WF-04（Atlas brief §六衔接注记）；本轮读数卡仅数字 ＋ 标记轴（research-p8-contract §5 口径）。
- **事件化施工**：`homePurchase`（房价时间化，brief §五）/ `childBirth` / `healthPhase`（医疗预留生命周期化）——标签 schema 形状只读预留（§1.2 `LifecycleEventTag`），施工归 WF-04+；本轮一次性预留沿用既有口径承载（`base.majorInvestment` / `base.healthReserve` / `childCount × costPerChild`，单次计入段 2——pension.rs:290-294 R5 归属裁定不动）。
- **养老金待遇逐年上调**：pension.rs:9-11 简化口径明示不考虑——领取段养老金恒额。
- **税档年度指数化 / 年度收入税负折算**：`taxInputs` 不进递推（工作段储蓄沿用税后月收入口径，accumulation.rs:77 同款）；bands 为静态输入（tax.rs:35-44）。
- **收入增长列**：月储蓄基流仅随通胀上行（accumulation.rs:280 年储蓄 × cum_infl 同式），不做实际增长假设。
- **事件自定义编辑器**：事件 schema 预留位只读派生；编辑器归 WF-04。
- **蒙特卡洛 threshold / percent 数值路径**：withdrawal.rs:161-188 / :227-264 逐行不动（§5 红线）。
- **share 载荷键增量**：SHARE_LINK_VERSION 保持 4、键清单零变化（引擎输入全部来自既有切片，随 v4 自动携带——§4.2 核对项）。
- **life 页深链接入**：WF-03 深链仅覆盖专业模式（`?task=pro&panel=<key>`）；life 容器查询归 WF-04（TaskPages.tsx:2-3 既有注释口径）。
- **随机模式性能重测**：60 年 × 5,000 路径时长属既有 accumulation 实现、P8 零改动——不设断言（research-p8-cases §5 性能建议中的随机项如实登记为不在本轮验收范围；确定性引擎 50 ms 预算保留，见 §3 算例⑤）。

---

## §1 契约定稿（字段级；类型与编排落点 = `src/services/finance.ts`，bridge.ts 零改动）

> 定稿说明：类型定义落 `finance.ts`（runSequenceRolling 编排区同层先例，finance.ts:420-534），**不进 bridge.ts**——LifecycleInput/YearRow/LifecycleOutput 不跨越 wasm 边界（TS 侧编排类型），进 bridge.ts 会制造「wasm 契约」的假增量；全部字段类型引用 bridge.ts / pensionParams.ts 既有定义。

### 1.1 LifecycleInput（41 字段 = base 7 ＋ accum 12 ＋ pension 8 ＋ loan 4 ＋ rental 10）

```ts
import type { BaselineInput, AccumulationInput, AmortizeInput, RentalAnalysisInput } from "../wasm/bridge";
import type { PensionInputs } from "../data/pensionParams";

/** 全部字段由 useCalculatorStore 既有切片派生，不新定义字段形状（research-p8-contract §2.1 定稿） */
export interface LifecycleInput {
  base: BaselineInput;            // 7 字段 ← store.baselineInputs（bridge.ts:53-64 原样引用）
                                  //   消费点：estimate_pension（乘数 / 养老金金额 / 桥接两字段）
  accum: AccumulationInput;       // 12 字段 ← store.accumulationInputs（bridge.ts:472-500 原样引用）
                                  //   消费点：均值参数（r_mean / i_mean）→ 时间线递推；
                                  //   σ / paths / seed → 仅透传 simulate_accumulation（双指标引用），
                                  //   引擎自身递推零随机消费（§2.1）；monthlyExpense 同时是
                                  //   时间线生活费基流（§2.4 双参数族注记）
  pension: PensionInputs;         // 8 字段 ← store.pensionInputs（pensionParams.ts:57-77 原样引用）；
                                  //   monthsDivisor 经 effectiveMonthsDivisor 联动口径入链
                                  //   （useCalculatorStore.ts:314 同源函数，禁两处内联重推——§4.2）
  loan: AmortizeInput;            // 4 字段 ← store.loanInputs（bridge.ts:127-136）；
                                  //   本轮仅类型承载：不调用、不校验、不进递推（WF-04 homePurchase
                                  //   事件年供款原子预留）
  rental: RentalAnalysisInput;    // 10 字段 ← store.rentalInputs（bridge.ts:173-196）；
                                  //   本轮仅类型承载：同上（WF-04+ 持有成本对照预留）
}
```

### 1.2 YearRow（8 字段）

```ts
/** 事件标记 schema（形状预留；本轮 events 恒空数组，唯一施工标记走 pensionStart 布尔） */
export type LifecycleEventTag =
  | { kind: "pensionStart"; year: number }                 // 形状预留——本轮由 pensionStart 布尔承载
  | { kind: "homePurchase"; year: number }                 // WF-04+：房价时间化（brief §五）
  | { kind: "childBirth"; year: number }                   // WF-04+：育儿成本按年分摊
  | { kind: "healthPhase"; year: number; phase: string };  // WF-04+：医疗预留生命周期化

export interface YearRow {
  year: number;            // 相对年序 t，1..=horizon（1 起计，accumulation/montecarlo 同例）
  age: number;             // 行首年龄 = pension.currentAge + year − 1（行覆盖年龄 [行首, 行首+1)）
  openingAssets: number;   // 期初资产（元，round2 展示）＝上一年 closingAssets；第 1 年 = accum.currentAssets
  contribution: number;    // 当年投入（名义元，round2 展示）：工作段 =
                           //   (monthlyIncome − monthlyExpense)×12×(1+i_mean)^t
                           //   （accumulation.rs:279-280 年储蓄随通胀上行同式，含当年通胀；可为负）；
                           //   停工后恒 0；耗尽次年起恒 0（§2.3 耗尽行语义）
  withdrawal: number;      // 当年支取（名义元，round2 展示，**净额口径**）：
                           //   桥接段 = monthlyExpense×12×(1+i_mean)^t（pension.rs:290-303 纯生活费口径）；
                           //   领取段 = max(0, 生活费 − pensionMonthly×12)（pension.rs:263-271 调整后口径
                           //   同式——养老金隐式耗用于生活费、不再作为流入二次入账：净支取与
                           //   「全额支取 + 流入」两写法代数恒等，§3 算例① 复核即证）；
                           //   工作段恒 0；耗尽次年起恒 0
  events: LifecycleEventTag[];  // 本轮恒空数组（形状预留，见上）
  pensionStart: boolean;   // 当年是否养老金起领 =（t == retireAge − currentAge + 1）
                           //   ——行首年龄恰等于起领年龄的首行（research-p8-cases §0.1 行号约定；
                           //   修正 research-p8-contract §2.2 注释的差一行笔误，§3.7 偏差 D1）
  closingAssets: number;   // 期末资产（名义元，round2 展示）：
                           //   closing = opening×(1+r_eff) + contribution − withdrawal；
                           //   耗尽当年 closing 钳 0、其后行全字段恒 0（§2.3 耗尽行语义；
                           //   sequence.rs:133-141 break + :154-159 补零同款）
}
```

### 1.3 LifecycleOutput（timeline 行数组 ＋ summary 10 字段）

```ts
export interface LifecycleOutput {
  timeline: YearRow[];           // horizon 行，逐年装配
  summary: {                     // 10 字段（6 标量 + survival 3 子字段 + error）
    horizon: number;             // 实际模拟行数 = max(accum.years, retireAge − currentAge + 1)，
                                 //   上限 200（accumulation.rs:65 MAX_YEARS 同值；yearsToRetire ≤ 59
                                 //   → +1 = 60 ≤ 200，上限溢出在输入域内不可能）
    fiFirstYear: number;         // FI 首达年（相对年序；−1 = 未达成，accumulation 年限哨兵同款）；
                                 //   判定 closing_t ≥ targetValue×(1+i_mean)^t，含 t=0 初始判定
                                 //   （currentAssets ≥ targetValue → 0；accumulation.rs:260、:289-297
                                 //   同式）；首触即记录、此后不回写（accumulation.rs:289 if none 同构）
    bridgeYears: number;         // 引用 estimate_pension bridgeYears（pension.rs:203-205 同式，不重算）
    bridgeFundingNeeded: number; // 引用同上（pension.rs:295-303 纯生活费口径，不重算）
    pensionMonthly: number;      // 引用 estimate_pension pensionMonthly（领取段恒额来源；
                                 //   错误分支安全值 0 → 净支取退化为全额生活费）
    depletedYear: number;        // 确定性路径耗尽年（1 起计；−1 = 存活——sequence.rs depletedYear
                                 //   同款哨兵）；判定字面 = 全精度 closing ≤ 0（§2.3，本规范以
                                 //   f64 实测钉死与展示层的差一行现象，§3 算例④）
    survival: {                  // 存续口径——引用双指标，引擎不重算（§2.1 裁定）
      fiProbability: number;         // ← simulate_accumulation fiProbability（pass1 口径，逐位引用）
      sustainedProbability: number;  // ← simulate_accumulation sustainedProbability（pass2 口径，逐位引用）
      sustainYears: number;          // 输入回显；0 = 未度量哨兵（bridge.ts:515-519 既有口径）
    };
    error: string;               // bridge.ts 全局错误约定（"" 成功 / 非空中文安全值）；聚合规则见 §1.4
  };
}
```

服务层形状：`calcLifecycle(input: LifecycleInput): Promise<FinanceResult<LifecycleOutput>>`（finance.ts:53-55 统一结果类型；`invoke` 包装 finance.ts:133-148 永不抛出纪律照抄）；输出轻量校验沿用 `num` / `numArray` / `numMatrix` 解析器先例（finance.ts:103-125）。

**纯函数测试缝（SampleProvider）**：时间线装配拆为两个导出纯函数（无 wasm 依赖、无随机）——

```ts
/** 单年样本（小数）；生产路径恒用均值 provider，测试缝可注入任意序列（§3 算例②⑥） */
export interface YearSamples { r: number; infl: number; }
export type SampleProvider = (year: number) => YearSamples;
export function assembleTimeline(args: TimelineArgs, provider?: SampleProvider): YearRow[];
export function deriveTimelineSummary(rows: YearRow[], args: TimelineArgs): {
  horizon: number; fiFirstYear: number; depletedYear: number;
};
```

生产路径 `provider` 缺省 = 每年 `{ r: r_mean/100, infl: i_mean/100 }`（确定性）；算例② / 算例⑥ 的样本替换断言经该缝注入（§3），未来 WF-04 情景透镜演进同缝（research-p8-contract §4.3「消费 samplePaths」之外的序列注入口，仍零新随机消费）。

### 1.4 校验规则与错误口径

**校验总则：编排层零新校验。** 全部字段以各既有模块既有校验为准，逐条登记（行号为本会话实测）：

| 分组 | 校验来源（既有函数原文） | 域 |
|---|---|---|
| base | pension.rs:174-195（经 estimate_pension 代理） | monthlyExpense/childCount/costPerChild/healthReserve/majorInvestment ≥ 0（check_nonneg_money + 非负整数）；nominalReturnPct/inflationPct 有符号百分比 \|v\| ≤ 1000（common.rs:62-68 check_pct_signed） |
| accum | accumulation.rs:190-216 | 四金额 ≥ 0；均值可负但 \|v\| ≤ 1000；σ > 0（两处 ensure，:197-204）；years 1–200；paths 1–MAX_PATHS；sustainYears 0–200；seed u64 |
| pension | pension.rs:174-195 | currentAge 16–70；retireAge 40–75 且 > currentAge；targetRetireAge 16–75（缺省 = retireAge）；contribYears 0–50；contribIndex 0–10；monthsDivisor 1–600 |
| loan / rental | 本轮不调用、不校验（仅类型承载） | — |
| 引擎 TS 递推 | 仅内置防御（非校验） | (a) closing ≤ 0 或 NaN → 钳 0（accumulation.rs:282-284 / sequence.rs:136-139 同款）；(b) 正溢出钳 f64::MAX（accumulation.rs:285-287 同款）；(c) 有效增长率/通胀因子下限钳 −0.99（r_eff = max(r_mean/100, −0.99)、i_eff 同式——与随机样本防御 accumulation.rs:269-276 同源；均值域由 wasm 校验前置，TS 层不另立口径） |

**错误聚合口径（钉死）**：`summary.error` = 固定次序首个非空——先 `estimate_pension` 的业务错误、后 `simulate_accumulation` 的业务错误、皆空则 `""`。各子块字段按各自既有错误分支降级，互不牵连：

- pension 错误（含 base 实际回报 ≤ 0 的乘数族分支 bridge.ts:103-104 口径）→ `pensionMonthly = 0`、`bridgeFundingNeeded = 0`、**`bridgeYears` 保留计算值**（pension.rs:209-225 回显先例），时间线继续装配（领取段净支取退化为全额生活费）。
- accumulation 错误（含 σ ≤ 0 经分享链注入的情形）→ `survival.fiProbability / sustainedProbability = 0`、`survival.sustainYears` 照常回显，时间线不受影响（确定性递推不消费 σ）。
- 解析 / wasm 层异常（`ok: false`）→ FinanceResult 错误通道（invoke 包装），UI 走既有 Alert 分支。

**两族分水岭（算例④ 裁定，写入 caliberTooltip）**：实际回报 ≤ 0 是「乘数族」输出与「行族」输出的分水岭——乘数族（480/费雪/桥接备资）走契约错误分支（0 + 中文 error，禁 Infinity/NaN/负乘数/panic）；行族（年度时间线）在 r_mean = i_mean 下数学上完全良态（支取退化为 40 年线性实耗、积累退化为储蓄定速实际积累）。引擎**不得以乘数族错误静默吞掉可算的行**（research-p8-cases §4 断言①、§7 边界结论 2 定稿）。

---

## §2 编排语义定稿

### 2.1 选择：**纯确定性复算（零随机消费）**，否决「引用 pass1 快照机制」

（采纳 research-p8-contract §4 裁定，本文定稿并补足字节兼容影响分析。）

1. **确定性口径**：引擎时间线全部消费均值口径参数（`nominalReturnMeanPct` / `inflationMeanPct`），递推为编排层纯函数——与 `solve_required_saving` 的确定性均值口径严格同族（bridge.ts:830-833 契约原文：「第 t 年末入金 = 该值 × 12 × (1+i)^t、资产按 (1+r) 复利、目标按 (1+i)^T 上行」），并沿用 `simulate_sequence` 的「不构造随机源、不引入 rand」范式（sequence.rs:1-6、:108-113）。同输入恒同输出；`accum.seed` / `accum.paths` 仅透传既有双指标调用，**无 seed 进入引擎递推**。
2. **随机面不重算**：FI 概率与存续概率以**引用**口径指向 `simulate_accumulation` 既有输出（`summary.survival` 双字段 = parseAccumulation 输出的逐位透传，finance.ts:317-344 解析器先例）。理由：(a) pass1/pass2 字节兼容锁区（accumulation.rs:215-267）与可复现性三不变（bridge.ts:565-577，p7-spec §2.2 裁定）是不可触碰前提，引擎任何新随机消费都会触碰锁区；(b) 双指标的统计语义（跨路径占比、分位）与引擎的单条确定性时间线**正交**——引擎回答「一条均值路径上何时达 FI / 何时耗尽」，双指标回答「跨路径分布」，二者由读数卡并行展示而非相互替代（research-p8-cases §7 边界结论 3：三者缺一都会误报）。
3. **否决「引用 pass1 快照机制」的理由**：首触快照 A*/cumInfl* 是 Rust 内部簿记（accumulation.rs:249-253），无 JSON 出口；导出它需要改 Rust 契约并重验锁区三不变，回归代价与收益不成比例；且引擎需要**逐行时间线**（每行投入/支取/标记），pass1 快照只提供单点（资产、通胀因子），信息量不足以装配 YearRow。
4. **样本注入缝的定位**：`SampleProvider`（§1.3）是纯函数测试缝——生产路径恒用均值 provider；算例② / ⑥ 的序列断言经该缝注入；WF-04 若需「随机路径透镜」，正确演进是消费既有 `samplePaths`（50 条按索引公式确定性导出，accumulation.rs:395-398）或经本缝注入历史序列（sequence.rs 范式），**两条路都零新随机消费**。

### 2.2 字节兼容影响（逐条登记）

| 锁 | 影响分析 | 结论 |
|---|---|---|
| pass1 流序（accumulation.rs:215-267，样本 2×years×paths 路径外层/年份内层/先回报后通胀） | 引擎零随机消费、零 Rust 改动——锁区字面不动 | **逐字节保持**（结构性保证，非测试侥幸） |
| 三不变 (a)(b)(c)（bridge.ts:565-577） | 同上；`accumulation_sustained_invariant_same_seed`（真实量级 σ，p7-spec §3.8）保持绿 | **逐字节保持** |
| 可复现性铁律（bridge.ts:404-406，同 seed 同输入逐字节一致） | 同上 | **逐字节保持** |
| 引擎自身确定性 | 纯函数 + 均值 provider，无时间 / 随机源输入 | 同输入恒同输出（结构性） |
| 既有 75 项测试 | §3.8 清单 | **零变化锁定** |

### 2.3 三阶段派生与行语义（1 起计行号；research-p8-contract §3.1 定稿 + 修正）

| 阶段 | 相对年序区间 | 派生式 | 现金流行 |
|---|---|---|---|
| A 工作段 | t = 1 .. workEnd | `workEnd = max(0, targetRetireAge − currentAge)`（缺省 target = retireAge；target < current = 已停工 → 0，pension.rs:200-202 saturating 同口径） | contribution = 月储蓄×12×(1+i_mean)^t（可为负）、withdrawal = 0 |
| B 桥接段 | t = workEnd+1 .. yearsToRetire（`bridgeYears > 0` 时存在；行数 = yearsToRetire − workEnd = estimate_pension bridgeYears） | `bridgeYears = max(0, retireAge − max(target, currentAge))`（pension.rs:203-205 逐字同式） | contribution = 0、withdrawal = 生活费全额 |
| C 领取段 | t = yearsToRetire+1 .. horizon（`pensionStart` 标记挂在 t = yearsToRetire+1 首行） | pensionMonthly 经 estimate_pension 单次调用 | contribution = 0、withdrawal = max(0, 生活费 − pensionMonthly×12) |

- horizon = `max(accum.years, yearsToRetire + 1)`（上限 200；§1.3）。
- 递推：`closing = opening×(1+r_eff) + contribution − withdrawal`（§1.4 防御 (a)(b)(c)）。
- **耗尽行语义（钉死）**：任一行全精度 `closing ≤ 0` → `depletedYear = t`、该行 closing 钳 0（当行支出/投入仍按公式记值——支出把资产打到零是真实发生的事），**其后行全字段恒 0**（递推终止；sequence.rs:133-141 break + :154-159 补零先例）。**展示层与判定层的差一行现象如实登记**：f64 全精度递推下 r = i 算例的 A_40 残差 = +2.328306e-10 > 0（本会话 node 实测），严格 `≤ 0` 判定字面（sequence.rs:136 同源）落位**第 41 行**；第 40 行展示 round2 = 0.00——「480 个月 ÷ 12 = 40 年线性实耗」的教学闭合在**展示层**成立、判定层差一行（§3 算例④ 修正登记 D2）。
- FI 判定：`closing_t ≥ targetValue×(1+i_eff)^t`，含 t = 0 初始判定；首触即记录、不回写（accumulation.rs:260/:289-297 同构）。判定发生在贡献计入之后（与 accumulation.rs:280-292 同序——先加储蓄后判定）。
- 精度：全精度递推、行值 round2 展示（accumulation.rs:301 先例：递推链在舍入之前）；算例断言容差 ±0.01 元（±0.005 用于恰零行）。

### 2.4 双参数族口径注记（写入 caliberTooltip，随卡片展示）

时间线生活费 / 储蓄基流 / 增长率取**打工积累面板**均值参数（`accum.*`）；乘数、养老金金额、桥接备资取**基础参数卡与养老面板**各自口径（`base.*` 经 estimate_pension）。两族在默认 store 状态下同源（月开销均为 2,990），用户分面板修改后各自生效——编排既有模块的必然形状，须口径注明示而非静默（research-p8-contract §2.1 字段注释定稿口径）。

---

## §3 测试算例（6 条；期望值全部由起草会话按公式独立推导并用 node 复算，未以任何实现输出为真值——期望纪律同 p7-spec §3）

**登记格式**：每条 = 输入 → 期望值（独立推导）→ 受影响测试。断言容差 ±0.01 元（恰零行 ±0.005）。`check-lifecycle.mjs` 断言编号 L1–L6 与算例一一对应。

### 3.1 算例①（L1）：提前退休未领养老金——两段年度行连续性

- **输入**：pensionInputs = PENSION_DEFAULTS 但 `targetRetireAge: 30`（30 岁 / 60 起领 / 缴 30 年 / 指数 0.6 / 余额 50,000 / 社平 10,343 / 计发 139）；base = BASELINE_DEFAULTS（月开销 2,990 / 健康 200,000 / 回报 4.5 / 通胀 2.0）；accum = ACCUMULATION_DEFAULTS 但 `currentAssets: 1,706,225.60`（= 桥接备资 1,435,200.00 ＋ 领取后参考线 271,025.60，README.md:86 两段相加锚点；一次性预留含在期初、单次计入）、`years: 60`。
- **手算（月养老金，pension.rs:232-255 公式）**：基础 = (10,343 ＋ 10,343×0.6)÷2×30÷100 = **2,482.32**；账户 = 50,000÷139 = **359.71**；月养老金 = **2,842.03**；年额 = **34,104.36**。
- **期望（node 全精度递推 ＋ 闭式双路复核，本会话实跑命中）**：bridgeYears = 30、bridgeFundingNeeded = 1,435,200.00、pensionMonthly = 2,842.03、horizon = 60、depletedYear = −1、**fiFirstYear = 0**（期初 1,706,225.60 ≥ 目标 1,635,200 → t=0 判定）。

| 行 t | 行首年龄 | 期初 | 生活费 35,880×1.02^t | 净支取 | 期末 |
|---|---|---|---|---|---|
| 1 | 30 | 1,706,225.60 | 36,597.60 | 36,597.60 | **1,746,408.15** |
| 2 | 31 | 1,746,408.15 | 37,329.55 | 37,329.55 | 1,787,666.97 |
| 30 | 59 | 3,468,155.60 | 64,991.65 | 64,991.65 | **3,559,230.95**（桥接末行） |
| 31 | 60 | 3,559,230.95 | 66,291.49 | **32,187.13** | **3,687,209.22**（养老金首行） |
| 32 | 61 | 3,687,209.22 | 67,617.32 | 33,512.96 | 3,819,620.68 |
| 60 | 89 | 9,920,080.50 | 117,723.38 | 83,619.02 | **10,282,865.09** |

- **独立推导**：桥接段闭式 `A_t = A_0×1.045^t − 35,880×S_t`（`S_t = 1.045^t·q(1−q^t)/(1−q)`，q = 1.02/1.045）→ A_30 = **3,559,230.95**（闭式 = 递推双路一致）；增长永续下限 PV = 36,597.60÷0.025 = **1,463,904** < A_0 → 桥接段永不击穿；终值闭式 `A_0×1.045⁶⁰ − 35,880×Σ_{k=1..60}1.02^k·1.045^{60−k} + 34,104.36×(1.045³⁰−1)/0.045` = **10,282,865.09**（＝递推）。全 60 行 `minA = 1,706,225.60`、逐年最小增量 `minGrow = 40,182.55`（node 全表复核）。**净支取口径复核**：第 31 行 `3,559,230.95×1.045 − 32,187.13 = 3,687,209.21`（四舍五入链）≈ 全精度 **3,687,209.22**（差 0.01 容差内）——净支取写法与「全额支取 + 养老金流入」写法代数恒等（`−max(0, C−P) ≡ −C + P`），本表即证。
- **断言口径（L1）**：① bridgeYears 恰 = 30 = estimate_pension 口径（60 − max(30,30)）；② 跨段连续：第 30 行期末 = 第 31 行期初，无重置、无一次性预留二次计入；③ 行 1–30 contribution = 0 且支取 = 生活费全额；行 31 起支取 = max(0, 生活费 − 34,104.36) 且 pensionStart 恰挂在第 31 行；④ 全 60 行 closing > 0 且逐年增量 ≥ 40,182.55；⑤ A_60 = 10,282,865.09 ± 0.01；⑥ fiFirstYear = 0。
- **受影响测试**：`check-lifecycle.mjs` L1；既有 75 项零变化。

### 3.2 算例②（L2）：达标后暴跌——首触不回写、暴跌行可见

- **输入（纯函数缝注入，非生产均值路径——§2.1 裁定的测试面）**：currentAssets 500,000、monthlyIncome 8,000、monthlyExpense 2,990（年储蓄 60,120 恒定）、target 1,635,200 恒定、workEnd ≥ 20（targetRetireAge = 60）、horizon 20；provider 序列 = [+4.5%×11, **−40%×1**（第 12 行）, +4.5%…]、「达标年次日跌」在年度粒度落位为**达标次年**整年 −40%（audit §2「−40% 级回落」确定性化，p7-spec §1.2）；通胀样本恒 0（名义 = 实际）。
- **期望（node 全精度递推，本会话实跑命中）**：

| 行 | 回报 | 期末资产 | 判定 |
|---|---|---|---|
| 10 | +4.5% | 1,515,251.86 | 未达标 |
| 11 | +4.5% | **1,643,558.19** | **首触（11 年，富余 8,358.19；A_10 < 目标 → 首触唯一）** |
| 12 | **−40%** | **1,046,254.92** | 跌破目标（全精度回撤 **−597,303.28**，含储蓄垫回 −36.34%） |
| 13 | +4.5% | 1,153,456.39 | 未达标 |
| 14 | +4.5% | 1,265,481.92 | 未达标 |
| 15 | +4.5% | 1,382,548.61 | 未达标 |
| 16 | +4.5% | 1,504,883.30 | 未达标 |
| 17 | +4.5% | 1,632,723.05 | 未达标（差 2,476.95） |
| 18 | +4.5% | 1,766,315.58 | 再触（fiFirstYear **仍 = 11**——首触口径不回写） |

- **独立推导**：达标前闭式 `A_t = 500,000×1.045^t + 60,120×(1.045^t−1)/0.045`；A_12 = 1,643,558.19×0.6 + 60,120。研究草案回撤记 −597,303.27 为舍入值相减，全精度 = −597,303.28（差 0.01 容差内，登记 §3.7 D3）。
- **断言口径（L2）**：① fiFirstYear = 11 且不因第 12 行暴跌改写；② 第 10–18 行序列与上表逐行一致（±0.01）；③ 第 11 行 closing ≥ 目标 且 第 10 行 < 目标；④ **口径边界（写进 caliberTooltip，键值断言）**：「存续 ≠ 未跌破目标」——存续判定按资产 ≤ 0 口径，本路径资产恒正时任意 N 恒「存续」，即使中途跌破目标（research-p8-cases §2 断言④）；⑤ 暴跌年份的 −40% 样本不触发防御钳制（钳制线 −0.99，accumulation.rs:270-271）。
- **生产面呈现（§7 断言④）**：读数卡并存「均值路径 FI 首达年」与「存续双指标」，均值时间线不展示随机暴跌、暴跌可见性由双指标（fiProbability vs sustainedProbability 差值）与蒙特卡洛面板承载——口径注明示三者正交（research-p8-cases §7 边界结论 3）。
- **受影响测试**：`check-lifecycle.mjs` L2；P7 `accumulation_sustained_at_most_fi` / `accumulation_sustained_fail_overdraw` 保持绿（零变化）。

### 3.3 算例③（L3）：连续低回报（名义 1% < 通胀 3%——实际负增长）

- **输入（生产均值路径，合法输入）**：accum = ACCUMULATION_DEFAULTS 但 `nominalReturnMeanPct: 1`、`inflationMeanPct: 3`（σ 保持 12/1——双指标调用校验需要；时间线不消费 σ）、currentAssets 500,000、years ≥ 30；base / pension = 各自默认。
- **期望（node 全精度递推，本会话实跑命中）**：实际回报 = 1.01/1.03 − 1 = **−1.9417%/年**；首达年限 = **30**（实口径富余 19,331.87）。

| 行 | 名义期末 A_t | 实口径 R_t = A_t/1.03^t | 实口径目标 1,635,200×1.03^t | 判定 |
|---|---|---|---|---|
| 1 | 566,923.60 | 550,411.26 | 1,684,256.00 | 未达标 |
| 10 | 1,293,209.15 | 962,269.06 | 2,197,572.06 | 未达标 |
| 20 | 2,424,212.50 | 1,342,227.69 | 2,953,353.09 | 未达标 |
| 29 | 3,831,738.71 | 1,625,984.38 | 3,853,455.92 | 未达标（差 9,215.62） |
| 30 | 4,015,983.12 | **1,654,531.87** | 3,969,059.59 | **首触（30 年）** |

- **独立推导**：实口径闭式 `R_t = 3,096,180 − 2,596,180×(1.01/1.03)^t`（R_0 = 500,000；稳态 R* = 60,120×1.03/0.02 = 3,096,180）——名义递推与实口径闭式双路一致。
- **变体 B（实资产负增长本体）**：monthlyIncome = monthlyExpense = 2,990（月储蓄 0，合法输入）→ `R_t = 500,000×(1.01/1.03)^t` 单调衰减：R_1 = 490,291.26、R_10 = 410,971.30、R_20 = 337,794.82（node 复核）；名义资产仍增长但目标名义值涨得更快 → **永不触达** → fiFirstYear = −1。
- **断言口径（L3）**：① 首达年限 = 30（两路推导一致）；② 年度行名义值与实口径换算逐行自洽（A_t = R_t×1.03^t，±0.01）；③ 变体 B fiFirstYear = −1（引擎输出哨兵）；④ **引擎对「名义回报均值 < 通胀均值」不得报错**（accumulation.rs:195-196 仅校验 σ > 0 与有界性；check_pct_signed 允许负均值——L3 断言 summary.error = ""）；⑤ 实际回报 −1.9417%/年须在行级可复算（行 t 有效样本 = 0.01 − 0.03）。
- **受影响测试**：`check-lifecycle.mjs` L3；既有 `accumulation_negative_real_growth_never_reaches_inflating_target`（integration.rs:889）保持绿（零变化）。

### 3.4 算例④（L4）：通胀超回报（实际 ≤ 0——乘数族 / 行族分水岭）

- **输入 A（支取序列，生产均值路径）**：accum：currentAssets 1,435,200（= 2,990×480 桥接备资）、monthlyIncome 0、monthlyExpense 2,990、`nominalReturnMeanPct: 2`、`inflationMeanPct: 2`（实际 = 0）、years 60、targetRetireAge 30 / retireAge 60；base：回报 2.0 / 通胀 2.0（**乘数族实际 = 0 → 错误分支**）。
- **期望（node f64 实测，含差一行修正）**：pension 调用输出 error「通胀率需低于名义回报率」、pensionMonthly = 0、multiplier = 0（bridge.ts:103-104 既有契约）→ 时间线领取段净支取退化为全额生活费；实口径 `R_t = A_t/1.02^t = 1,435,200 − 35,880×t`（每行实减恒 35,880）。

| 行 | 期末资产 A_t（round2） | f64 残差 / 判定 |
|---|---|---|
| 1 | 1,427,306.40 | 实口径 1,399,320.00 |
| 39 | **77,671.04** | 实口径恰剩一年实支出 35,880.00 |
| 40 | **0.00** | f64 残差 **+2.328306e-10 > 0** → 展示零、判定不触发 |
| 41 | 0.00（钳） | 全精度 −80,808.95 → **depletedYear = 41**；第 41–60 行全字段恒 0 |

- **输入 B（积累序列，生产均值路径）**：currentAssets 500,000、monthlyIncome 8,000、monthlyExpense 2,990、r_mean = i_mean = 2.0、target 1,635,200、targetRetireAge 60 → 实口径 `R_t = 500,000 + 60,120×t`：R_18 = 1,582,160 < 实目标 1,635,200；R_19 = **1,642,280** ≥ → **fiFirstYear = 19**。
- **断言口径（L4）**：① 两输入的 summary.error = 「通胀率需低于名义回报率」（乘数族分支；base 实际 = 0 与实际 < 0 两变体同形——**不得**输出 Infinity、NaN、负乘数；时间线族不受该错误影响、继续装配）；② 输入 B 行口径 r = i 全程可递推、无除零路径；③ 输入 A：第 39 行 = 77,671.04、第 40 行 round2 = 0.00（\|残差\| ≤ 0.005）、**depletedYear = 41**（差一行修正见 §2.3 / §3.7 D2）、第 41 行起全字段恒 0；④ 输入 B fiFirstYear = 19；⑤ 口径注（caliberTooltip 键值断言）明示「r = i 时 480 乘数不可用、支取退化为 40 年线性实耗（展示层）」——引擎输出明确口径而非静默错误值。
- **受影响测试**：`check-lifecycle.mjs` L4；既有 `pension_error_when_real_return_not_positive` / `baseline_error_when_real_return_not_positive` 保持绿（零变化）。

### 3.5 算例⑤（L5）：长寿命（60 行行数边界与确定性性能预算）

- **输入 A（含养老金）**：同 L1（60 行，30 岁 → 90 岁）→ 终值 10,282,865.09（复用 L1）。
- **输入 B（无养老金单段支取）**：L1 同参但 pension：`contribYears: 0`、`accountBalance: 0`（合法输入域，pension.rs 校验 0 合法）→ pensionMonthly = 0 → 全程净支取 = 生活费全额；currentAssets 1,435,200、r 4.5% / π 2%、years 60。
- **期望（node 全精度 ＋ 闭式双路，本会话实跑命中）**：实口径 `R_t = R_{t−1}×(1.045/1.02) − 35,880`，实增长因子 1.024510 > 1 → 稳态 R* = 35,880/0.024510 = 1,463,904 为**不稳定**平衡点；R_0 = 1,435,200 < R* → 实口径单调缓降：`R_t = 1,463,904 − 28,704×1.024510^t`，R_60 = **1,341,185.64** > 0（60 行内不耗尽，理论耗尽点 t > 162.4 年）；A_60 = R_60×1.02⁶⁰ = **4,400,471.38**。
- **行数边界**：60 行 = 30 岁人群到 90 岁的整寿命覆盖；既有上限参照——Rust 侧 MAX_YEARS = 200（accumulation.rs:65）、UI 侧 LIMITS.simYears max = 100（defaults.ts:62「同时控制图表规模」）→ 60 行在界内、为图表规模压力的合理代理上界。
- **断言口径（L5）**：① 两输入 rows.length 恰 = 60，行号 1..60 无缺行、无重复，末行行首年龄 = 89；② 输入 B 终值 = 4,400,471.38 ± 0.01 且 depletedYear = −1（闭式与递推双路一致）；③ **确定性性能预算**：`check-lifecycle.mjs` 以 `performance.now()` 实测 calcLifecycle 单次完整调用（含两次 wasm 调用与 60 行装配）≤ **50 ms**（release 产物、实测值写入验收记录）；④ 随机模式 60 年 × 5,000 路径时长**不在本轮断言**（§0.2 如实登记）。
- **受影响测试**：`check-lifecycle.mjs` L5；既有 75 项零变化。

### 3.6 算例⑥（L6）：同资料双口径一致性（引擎 ↔ 既有模块同构互证，同 seed 逐位）

- **输入（ACCUMULATION_DEFAULTS 原样）**：currentAssets 500,000、monthlyIncome 8,000、monthlyExpense 2,990、target 1,635,200、4.5%±12%、2%±1%、years 40、paths 5,000、**seed 42**；变体 sustainYears = 10。
- **结构恒等式（本会话手算小例，样本假设值 r=[+10%, −5%]、π=[+2%, +2%]，非 seed 42 真值——演示三口径同一性）**：
  - **L6-a 积累递推同构**：provider 注入该样本 → 装配行 closing：A_1 = 500,000×1.10 + 60,120×1.02 = **611,322.40**；A_2 = 611,322.40×0.95 + 60,120×1.02² = **643,305.13**（与 accumulation.rs:280 公式同构——同公式给同样本必得同值）。
  - **L6-b 支取递推同构**：同样本驱动桥接段（workEnd = 0、生活费基流 35,880）→ 第 1 行 = 500,000×1.10 − 35,880×1.02 = **513,402.40**；第 2 行 = 513,402.40×0.95 − 37,329.55 = **450,402.73**（与 accumulation.rs:344-355 pass2 支取公式同构：支取基流 `12×monthlyExpense×cumInfl*` 在 cumInfl* = 1 时即桥接基流——**支取段第 1 年支出 = 积累段末年支出口径的通胀接续，无跳变**）。
  - **L6-c 同 seed 逐位（真实 wasm 实跑）**：calcLifecycle 与直接 calcAccumulation 各跑一次（seed 42、同输入）→ `survival.fiProbability` / `survival.sustainedProbability` / `survival.sustainYears` 与 accumulation 输出**逐字节相等**（引用口径恒等 + 管道断言；sustainYears = 10 变体另跑一组）。
  - **L6-d 三不变外推**：sustainYears 增删不改既有字段——由 P7 锁定测试 `accumulation_sustained_invariant_same_seed` 保持绿承载（零变化）。
- **偏差登记（§3.7 D4）**：research-p8-cases §6 断言①「P8 行值 == samplePaths 行值（逐字节）」与断言②「行派生首达年 = 输出年限分位」以「引擎消费同一随机流」为前提；本文 §2.1 定稿为**零随机均值引擎**，均值路径与随机路径在语义上正交（引擎 = 单条均值线、samplePaths = 跨路径分布），行级逐位相等在该设计下**不成立也不应成立**——断言重界为 L6-a/L6-b（公式层同构：同公式给同样本必得同值）＋ L6-c（引用层逐位：同 seed 双指标逐字节相等）＋ L6-d（锁区零触碰）。若 WF-04 需要行级随机透镜，按 §2.1.4 演进（消费 samplePaths / SampleProvider 注入历史序列，零新随机流）。
- **受影响测试**：`check-lifecycle.mjs` L6（a/b/c 三组断言）；P7 `accumulation_sustained_invariant_same_seed` 保持绿（零变化）。

### 3.7 研究草案修正登记（起草会话独立推导发现；与 p7-spec §3.4 对 audit 笔误的处置同法）

| # | 研究草案原文 | 本规范定稿 | 影响 |
|---|---|---|---|
| D1 | research-p8-contract §2.2：pensionStart「t = retireAge − currentAge 时为 true」 | **t = yearsToRetire + 1**（行首年龄恰为起领年龄的首行；与 cases §0.1 行号约定及算例① 第 31 行表格自洽） | 标记行号差一修正；无数值影响 |
| D2 | research-p8-cases §4 断言③「depletedYear = 40、逐字节精确零」 | **depletedYear = 41**：f64 全精度 A_40 = +2.328306e-10 > 0（node 实测），严格 `≤ 0` 判定字面（sequence.rs:136 同源）后移一行；第 40 行 round2 = 0.00、「40 年线性实耗」教学闭合在展示层成立 | 耗尽行位修正；判定口径保持与既有模块同源（否决「round2 后判定」新口径——会另立审计面） |
| D3 | research-p8-cases §2「名义回撤 597,303.27」 | 全精度 = **−597,303.28**（草案值为舍入行值相减；差 0.01 容差内） | 推导值精化；断言仍按行值 ±0.01 |
| D4 | research-p8-cases §6 断言①②（行值 == samplePaths、首达年 = 年限分位） | **重界为 L6-a/b/c/d**（§3.6）——随机流行级相等与 §2.1 零随机裁定互斥；引用层逐位 + 公式层同构 + 锁区零触碰三重承载 | 断言口径重界；语义正交性登记 |
| D5 | research-p8-cases §3 变体 B 括注「A_10 = 552,320.38」 | node 全精度 = **552,311.06**（500,000×1.01¹⁰） | 数值笔误修正；「永不触达」结论不变 |

### 3.8 保留 / 新增清单（既有 75 项零变化锁定）

- [ ] **既有 75 项零变化锁定**：60 项集成（勾稽 = p7-spec §3.12 保留 48 + 更新 5 + 新增 7 = 60，逐项归属以 p7-spec §3.12 三表与 integration.rs 全名单为准，本会话 `cargo test` 实测 60 passed）＋ 15 项单元（common 2 / reverse 2 / sequence 3 / withdrawal 8，`grep -c "#\[test\]" src/wasm/src/{common,reverse,sequence,withdrawal}.rs` 同法可复算）——**任何断言值、测试名、输入都不得改动**；本会话基线实测 15 + 60 = 75 全绿（`cargo test`）。P8 无 Rust 改动 → 零新增 Rust 测试、零改动既有测试。
- [ ] **新增 1 个脚本**：`scripts/check-lifecycle.mjs`（L1–L6 断言 + 性能计时 + 同 seed 逐位实跑）；package.json 增 `check:lifecycle`。实现方式（不引入新依赖）：esbuild（随 vite 在依赖树内，check-share.mjs 同款先例）把 finance.ts 转译进临时目录；纯函数断言（L2 / L6-a/b）直接调用导出纯函数；wasm 断言（L1 / L3 / L4 / L5 / L6-c）以 `init(await readFile("src/wasm/pkg/finance_core_bg.wasm"))` 注入真实二进制后调用 service——若 Node 装载在实施时失败，属**实施阻塞须登记**，不得静默降级为桩替身（桩只能证明管道、不能证明字节）。
- [ ] **三语键集一致性**：由既有 `check:share` 断言 5（check-share.mjs:207-239 全键集交叉校验）自动覆盖新增 `life.*` 键，零脚本改动。
- 收口预期：`cargo test` 75 全绿（数值不变）；`npm run check:lifecycle` exit 0；`npm run check:share` / `check:currency` / `check:data` / `check:a11y` 全部 exit 0。

---

## §4 前端消费（人生轨迹读数卡最小面）

### 4.1 读数卡字段清单（7 读数 + 口径注 + 标记轴；全部映射 summary/timeline 既有字段，无新计算）

| # | 读数 | 字段 | 哨兵 / 展示规则 |
|---|---|---|---|
| 1 | FI 首达年（＋对应年龄） | `summary.fiFirstYear` ＋ 对应行 `age` | −1 → 展示「未达成」；0 = 期初已达标 |
| 2 | 桥接年数 | `summary.bridgeYears` | 0 = 无桥接段（target ≥ retireAge 或缺省） |
| 3 | 桥接期需备资金 | `summary.bridgeFundingNeeded` | 0 = 无桥接段；口径注「纯生活费」 |
| 4 | 预计月养老金（＋起领行） | `summary.pensionMonthly` ＋ pensionStart 行 `year`/`age` | pension 错误分支安全值 0 |
| 5 | 确定性期末资产 / 耗尽年 | timeline 末行 `closingAssets` ＋ `summary.depletedYear` | −1 = 存活（展示「未耗尽」） |
| 6 | 存续双指标 | `summary.survival.fiProbability`；`sustainedProbability` | 仅 `sustainYears > 0` 展示存续项（bridge.ts:515-519 哨兵；Rust 不引入 −1 特判）——**标签复用既有键** `accumulation.fiLabel` / `accumulation.sustainedLabel` |
| 7 | 事件标记轴 | 行 `pensionStart`（本轮唯一施工标记）＋ `events[]`（恒空） | 非视觉替代文本（aria，brief §七验收门）；时间透镜可视化归 WF-04 |

- 卡片形态约束（宪法）：纯读数卡、无输入控件（D9 同构，P5.1 V1 裁定口径）；数值行等宽字排（S3 既有规则，global.css tabular-nums）；金额全部经 `useMoney().money()` 币种换算（先例 PensionPanel.tsx:35-36）；不引入新视觉令牌、不申请新签名元素（design-language §5.1 零申请）；复用组件库 Descriptions / Tag / Divider 基础件（已装轮子边界，design-language §4）。

### 4.2 落点文件（现状 → 目标；行号为起草会话实测）

| 文件 | 现状 | 目标 |
|---|---|---|
| `src/services/finance.ts` | 编排区 :420-534（runSequenceRolling / selectFateWindows / runSequenceReorder 先例） | 追加 LifecycleInput / YearRow / LifecycleOutput / LifecycleEventTag / YearSamples / SampleProvider 类型 ＋ `assembleTimeline` / `deriveTimelineSummary` 纯函数 ＋ `calcLifecycle` 编排（calcPension + calcAccumulation 并行 → 装配 → 汇总；§1.4 错误聚合） |
| `src/components/LifeTrajectoryCard.tsx` | （新文件） | 读数卡组件：`useFinanceCall(() => calcLifecycle(inputs), [baselineInputs, accumulationInputs, pensionInputs, pensionMonthsSynced, loanInputs, rentalInputs])`；monthsDivisor 经 `effectiveMonthsDivisor(pensionInputs.retireAge, pensionInputs.monthsDivisor, pensionMonthsSynced)` 入链（store :314 同源函数调用，禁两处内联重推） |
| `src/components/TaskPages.tsx` | LIFE_GROUPS 5 组（:30-36：accumulation/pension/loan/rental/tax） | 组数 5 → **6**：首组插入 `{ id: "trajectory", labelKey: "life.trajectoryTitle", node: <LifeTrajectoryCard /> }`（分段控件 Radio.Group 语义、hidden 非卸载、首展挂载语义全部不动） |
| `src/i18n/locales/zh-CN.ts` / `zh-Hant.ts` / `en.ts` | 无 `life` 组 | 新增 `life` 组 14+2 键 ×3 语（§4.3 + 偏差登记 P8.1#2：`fiAtStart` 哨兵展示键与 `caliberTooltip` 全文拆分键为净增两项，`sameSeedRef` 并合抵消一项） |
| `scripts/check-lifecycle.mjs` | （新文件） | §3 八条算例断言 + 计时（§3.8） |
| `package.json` | scripts 8 条（:7-16） | + `"check:lifecycle": "node scripts/check-lifecycle.mjs"` |
| **不动清单** | — | `src/wasm/src/*.rs`（全部）、`src/wasm/bridge.ts`、`src/store/useCalculatorStore.ts`、`src/data/defaults.ts`、`src/data/pensionParams.ts`、share.ts（v4 键清单零变化——引擎输入全部来自既有切片、随 v4 载荷自动携带）、scenarios.ts、既有 9 面板本体 |

### 4.3 i18n 键（三语；新键 14 ×3 ≈ +2.4 KB 原始字节，在 §6 预算内；插值走 i18next 既有先例 accumulation.medianNarrative 同款 `{{var}}`）

| 键 | 简体值（定稿基准） | 说明 |
|---|---|---|
| `life.trajectoryTitle` | 「轨迹总览」 | 组标签 |
| `life.fiFirstYear` | 「FI 首达年（均值路径）」 | 读数 1 |
| `life.fiNotReached` | 「未达成」 | 哨兵 −1 |
| `life.bridgeYears` | 「桥接年数」 | 读数 2 |
| `life.bridgeFunding` | 「桥接期需备资金」 | 读数 3 |
| `life.pensionMonthly` | 「预计月养老金」 | 读数 4 |
| `life.pensionStartAt` | 「第 {{year}} 年起领（{{age}} 岁）」 | 读数 4 附注 |
| `life.finalAssets` | 「确定性期末资产」 | 读数 5 |
| `life.depletedAt` | 「第 {{year}} 年耗尽」 | 哨兵 ≥ 1 |
| `life.survived` | 「未耗尽」 | 哨兵 −1 |
| `life.survivalFi` | 「同 seed 引用：{{label}}」 | 读数 6 复用 `accumulation.fiLabel` 值作 {{label}} |
| `life.survivalSustained` | 「同 seed 引用：{{label}}」 | 复用 `accumulation.sustainedLabel` |
| `life.caliberNote` | 「时间线为打工积累均值参数下的一条确定性路径；存续双指标引用蒙特卡洛同 seed 结果——首触 ≠ 持续，存续 ≠ 未跌破目标。」（≤2 行，反冗长） | 口径注正文 |
| `life.caliberTooltip` | 全文口径：双参数族拆分（§2.4）＋ 桥接纯生活费 / 一次性预留单次计入 ＋ r = i 边界（480 乘数不可用、支取退化 40 年线性实耗——展示层）＋ 乘数族/行族分水岭 ＋ 存续口径（资产 ≤ 0） | tooltip 全文 |
| `life.timelineLabel` | 「事件标记」 | 标记轴标题 |
| `life.pensionStartMark` | 「养老金起领」 | 标记文案（Tag / aria） |

（表计 16 行 = 14 新键 + 2 复用登记；新键上限 14，实施时能并尽并——如 `survivalFi`/`survivalSustained` 可并为 `life.sameSeedRef` 一键。）

### 4.4 useFinanceCall 调用点登记（起草会话 grep 实测；行号相对 p7-spec §5.5 已漂移，以本表为准）

- **现状**：hook 调用 8 处——BasicCalculator.tsx:569、PensionPanel.tsx:62、AccumulationPanel.tsx:88 与 :132、RentalPanel.tsx:255、TaxPanel.tsx:107、LoanPanel.tsx:40、ReversePanel.tsx:55；直接 calc* 调用 11 处——BasicCalculator.tsx:704（敏感性逐档）、AccumulationPanel.tsx:134 / :155 / :168、MonteCarloPanel.tsx:182 与 :241、ScenarioPanel.tsx:75-79 五处。
- **P8 增量 = +1**：LifeTrajectoryCard.tsx 的 `useFinanceCall(() => calcLifecycle(inputs), [六切片], { debounceMs: DEBOUNCE_MS })`——**P8 +1 hook（口径精确化：原「唯一新增」自 WF-04 起更新为「P8 +1 hook / WF-04 +2 直接调用」，见下行登记）**（有意变更，理由：新消费面）；既有 19 处零变化。防抖口径与既有面板一致（300 ms 默认）。
- **WF-04 增量 = +2 直接 `calcLifecycle`（非 hook，wf04-spec §4 条 5 登记回写）**：ScenarioPanel.tsx 叠影重算 300ms 防抖 effect 内 `Promise.all` 并行两调用（基准六切片 + decodeShareState 情景切片映射）——直接 calcLifecycle 消费 1 → 3 处、直接 calc* 调用 11 → 13 处；hook 调用维持 **9 处零变化**（grep 实证见 wf04-spec §6 条 3）。

---

## §5 回归红线（违反即返工）

1. **S1–S26 零回退**（design-language.md §2 锚点；抽查基线同 p7-spec §5.1——S2 BasicCalculator.tsx:339-362 + global.css:1262-1269、S16 hooks.ts:302、S18 hooks.ts:205 可见性闸、S22 App.tsx:45、S24 global.css:1421、S25 五图 Tooltip、S6 四处空态 + 缺席位）：P8 只增新卡片与新服务，不改任何签名元素实现；新卡片零新动效、零新令牌、零新签名元素（§5.1 准入零申请）。
2. **D9 纯读数卡同构**：读数卡无输入控件（P5.1 V1「输出卡纯读数」口径延伸）；进度环 / 刻度环等既有庆祝链路零触碰（S2 全站唯一 expressive 不变）。
3. **aria 零回退**：`check:a11y` 对清单 63 组零回退（WF-03 收口值）；新卡片标记轴必须携带非视觉替代文本（aria-label 汇总标记，§4.1 读数 7）；金额读数经 money() 后的 aria 文案与既有面板同构。
4. **分享 v4 零变化**：SHARE_LINK_VERSION 保持 4、键清单零增量、`check:share` exit 0——引擎输入全部来自既有切片，v4 载荷自动携带（§4.2 不动清单核对项）；strategyLegacyNotice / resetEpoch 链路零触碰。
5. **方案 B 导航零回退**：专业模式三组九面板整壳零改动（AdvancedPanel 本体不动、`?task=pro&panel=<key>` 深链不动）；life 页组数 5 → 6 为**本轮有意变更**（登记：TaskPages.tsx LIFE_GROUPS 首组插入）——分段控件语义、hidden 非卸载、首展挂载、跨组保活（TaskPages.tsx:5-7 先例）零变化；App 数字键分域（1–4 任务 / 5 专业）不动，life 页不绑数字键（TaskPages.tsx:10-11 既有口径）。
6. **pass1/pass2 字节兼容锁重申**：`src/wasm/src/*.rs` 与 bridge.ts 逐字节不动（§4.2 不动清单）；三不变 (a)(b)(c) 与可复现性铁律（bridge.ts:404-406、:565-577）结构性保持（§2.2）；`accumulation_sustained_invariant_same_seed` 等锁定测试保持绿。
7. **threshold / percent 语义零变化**：withdrawal.rs:161-188 / :227-264 逐行不动；T8 锚点全绿（668,802.18 等，p7-spec §3.8）。
8. **禁词零命中**：`apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid` 在本文档与全部新增 / 改动文件零命中（起草会话对本文档已扫描，附 A-6）。

---

## §6 尺寸预算（原始字节；门禁数值不放宽——P5 既定裁定）

### 6.1 现状实测（起草会话 `node scripts/check-size.mjs` 实跑）

| 项 | 实测 | 门禁（check-size.mjs:29-30） | 余量 |
|---|---|---|---|
| wasm 单文件 | **387,792 B**（`WASM_MAX_KB=379`） | 800,000 B | 412,208 B |
| dist 全部文件总和 | **1,987,322 B**（`DIST_TOTAL_KB=1941`） | 2,000,000 B | **12,678 B，紧张** |

> 与 p7-spec §6.1 所记（1,999,865 B / 372,534 B）相比，现状为 WF-03 收口后的值（design-language §5 WF-03 收口条目「尺寸净增 ≈12.9KB（余量 12,678 B）」与本会话实测一致）；以实测为准。

### 6.2 增量估算（§4 改动面推导）

| 来源 | 估算（原始字节，压缩后） | 说明 |
|---|---|---|
| wasm | **预期 +0** | 零 Rust 改动（§0.1 A）；预算按下方 wasm 行单独给缓冲 |
| i18n 三语（§4.3） | +1.8 ~ +2.6 KB | 新键 14 ×3；实施时能并尽并（§4.3 注） |
| LifeTrajectoryCard JSX（§4.2） | +1.5 ~ +2.5 KB | 纯读数卡，复用 Descriptions/Tag |
| finance.ts 引擎（§1） | +1.5 ~ +2.5 KB | 类型 + 纯函数 + 编排 |
| CSS / 其他 | +0.2 ~ +0.4 KB | 标记轴类（复用既有令牌，零新键） |
| **合计** | **+5.0 ~ +8.0 KB（按上限 +8 KB 计盘）** | 算术闭合：2.6+2.5+2.5+0.4 = 8.0——余量 12,678 B 按上限计仍余 ≈4.7 KB，但无二次容错，回收令照挂 |

### 6.3 预算硬线与回收强制令（实施顺序前置）

- [ ] **wasm 硬线**：本轮 wasm 增量预算 ≤ **+30 KB 缓冲**（即 wasm ≤ 379 + 30 = **409 KB**、418,934 B）——预期增量 0（零 Rust 改动裁定）；实施中若任何 wasm 增量出现（含工具链波动重打包），超 30 KB 缓冲即返工重审 §2.1 裁定，**门禁 800,000 B 本身不放宽**。
- [ ] **dist 硬线**：`npm run build && npm run check:size` exit 0（≤ 2,000,000 B）。
- [ ] **实施第一步（写码前）执行回收盘点**（p7-spec §6.3 同款顺序）：(a) i18n 键并合复审（§4.3 上限 14、能并尽并）；(b) CSS 复用审计（零新令牌、零新主题组键）；(c) dist 资产清单可压缩项排查。
- [ ] **回收不足时的处置顺序**：i18n 并合 → 裁展示项（候选序：存续双指标行并入口径注 tooltip → 桥接备资行并入桥接年数行 → 标记轴降级为纯 aria 文本），**门禁数值与 wasm 门禁不放宽、不特批**（P4 特批先例已归档，不再开）。

---

## §7 验收条件（可操作断言；全过才收口）

- [ ] **① 同资料单次全周期预测**：L1 输入一次 `calcLifecycle` 调用返回 horizon = 60 行 timeline + summary 全 10 字段（fiFirstYear = 0 / bridgeYears = 30 / bridgeFundingNeeded = 1,435,200.00 / pensionMonthly = 2,842.03 / depletedYear = −1 / A_60 = 10,282,865.09 ± 0.01）；无第二类调用、无面板间手工拼数（「同资料单次」= 一次服务调用覆盖全周期）。
- [ ] **② 引擎年度行与既有口径同构、同 seed 逐位一致（三重承载；D4 重界登记见 §3.6）**：(a) **引用层逐位**——L6-c：同 seed 42 同输入，`survival` 三值与直接 `calcAccumulation` 输出逐字节相等（真实 wasm 实跑断言）；(b) **公式层同构**——L6-a/b：provider 注入样本 [+10%, −5%]/[+2%, +2%] 后，装配行 = 手算 611,322.40 / 643,305.13 / 513,402.40 / 450,402.73（±0.01）——同公式给同样本必得同值，与 accumulation.rs:280 / :344-355 递推族锁定；(c) **锁区零触碰**——pass1/pass2 锁区字面不动 + 75 项既有测试零变化全绿（含 `accumulation_sustained_invariant_same_seed`）。行级「引擎行 == samplePaths 行」断言在本设计下不成立也不应成立（均值路径 ≠ 随机路径，§2.1.2 正交性）——如实登记，不得为实现该断言引入随机流消费。
- [ ] **③ 桥接年正确呈现**：L1——bridgeYears = 30、行 1–30 支取 = 生活费全额、行 31 起净支取、第 30↔31 行跨段连续、pensionStart 恰挂第 31 行；同输入改 `targetRetireAge: 60` → bridgeYears = 0、bridgeFundingNeeded = 0（p7-spec §7 断言① 的 P8 延续）；面板「停工 → 起领」语义与 PensionPanel 桥接块一致（两处数字同源于 estimate_pension）。
- [ ] **④ 达标后暴跌可见且不计存续**：L2 自动断言——fiFirstYear = 11 不回写、暴跌行 1,046,254.92 在装配行序列可见（±0.01）；存续口径断言——`survival.sustainedProbability` 语义保持「资产 ≤ 0 存续判定」（P7 T4/T4-b 保持绿：fiProbability = 1.0 时 sustainedProbability 可为 0）；**口径注在位**——`life.caliberNote` / `life.caliberTooltip` 三语键值含「首触 ≠ 持续，存续 ≠ 未跌破目标」句；读数卡并行呈现均值路径读数与双指标（§3.2 生产面）。
- [ ] **⑤ threshold / percent 不变**：withdrawal.rs:161-264 grep 逐行零 diff（实施前后对比登记）；T8 锚点 668,802.18 / mc_threshold_directional / mc_percent_never_depletes 保持绿。
- [ ] **⑥ cargo 全绿含新算例**：`cd src/wasm && cargo test` → 15 + 60 = 75 全绿且**与基线同名同值**（零变化）；`npm run check:lifecycle` exit 0（L1–L6 全过 + 50 ms 计时达标，实测值写入验收记录）。
- [ ] **⑦ 读数卡 UI 与引擎输出一致**：手工走查 `npx vite preview`——读数卡 7 行读数逐一等于 calcLifecycle 输出（同屏对比 DepositsDescriptions 值与 console 输出）；金额经 money() 币种换算（切展示币种后读数卡与源面板同步换算）；调用点登记核对——新增调用恰 1 处（§4.4）。
- [ ] **⑧ 三语零裸键**：三 locale 键集一致（既有 `check:share` 断言 5 自动覆盖新键）；界面无 `life.fiFirstYear` 式裸键渲染（人工走查三语各一遍）；新增键值非机翻占位。
- [ ] **⑨ 尺寸与门禁**：`npm run build && npm run check:size` exit 0；wasm ≤ 409 KB（379 + 30 缓冲，§6.3）；dist ≤ 2,000,000 B；`check:a11y` / `check:currency` / `check:data` exit 0。
- [ ] **⑩ 禁词零命中**：`grep -rniE "apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid"` 对本文档 + 全部新增/改动文件 → 排除模式字面量自身后零命中。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令 / 方法 | 结果 |
|---|---|---|---|
| A-1 | Rust 基线 | `cd src/wasm && cargo test`（首跑 tail 截断后复跑取计数） | `running 15 tests…15 passed; 0 failed` + `running 60 tests…60 passed; 0 failed` = **75 全绿** |
| A-2 | 尺寸门禁 | `node scripts/check-size.mjs` | dist 15 文件、wasm 387,792 B、`DIST_TOTAL_KB=1941`、`WASM_MAX_KB=379`、门禁通过；原始字节合计 1,987,322（§6.1） |
| A-3 | 算例独立推导 | `node -e`（§3 全部期望值：递推 + 闭式双路；修正复跑记录见 §3.7 D2/D3/D5——首跑曾把净支取与养老金流入双重计入、②回报序列错位一行、③变体 B 多除一次通胀因子，均已在修正跑中收敛） | L1–L6 期望值逐项命中（D2 耗尽行位 / D3 回撤精度 / D5 笔误修正为规范定稿值） |
| A-4 | 调用点枚举 | `grep -rn "useFinanceCall(" src/components` + 直接 calc* 调用 grep | 8 处 hook + 11 处直接调用（§4.4 清单）；P8 增量 = +1 |
| A-5 | 禁词扫描 | `grep -rniE "apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid" docs/p8-spec.md` | 命中仅本行与 §5.8 / §7⑩ 的模式字面量自身；排除后复扫零命中（新增/改动文件收口时同法复扫） |
| A-6 | 源码锚点复核 | pension.rs:199-205 / :290-303（桥接公式）、accumulation.rs:190-216（校验）、:236-313（pass1）、:65/:68（MAX_YEARS/SAMPLE_COUNT）、sequence.rs:100-159（确定性范式 + 耗尽语义）、bridge.ts:472-577（accumulation 契约与三不变注释）、:53-64（BaselineInput）、:127-136（AmortizeInput）、:173-196（RentalAnalysisInput）、finance.ts:53-148（FinanceResult/invoke）、:291-401（service 面）、useCalculatorStore.ts:74-174（切片）/ :299-321（buildShareState/effectiveMonthsDivisor）、defaults.ts:30-79（LIMITS）/ :168-198（PENSION/ACCUMULATION_DEFAULTS）、TaskPages.tsx（life 页壳）、pensionParams.ts:57-77（PensionInputs） | 全部与本规范引用一致 |
| A-7 | 未跑项如实声明 | — | `check-lifecycle.mjs` 未在本会话编写/执行（规范起草阶段无代码变更）；Node 侧 wasm `init(bytes)` 装载可行性未实测（§3.8 已登记为实施首验项 + 失败须登记的处置）；随机模式性能未测（§0.2 排除登记）；三语走查未做（实施轮动作） |
| A-8 | 契约字段数勾稽 | LifecycleInput 7+12+8+4+10 = 41；YearRow 8；summary 6+3+1 = 10 | **59**（与 research-p8-contract 附录一致） |

---

## 实施结果与收口记录（文档收口会话复测登记，2026-11-22）

> 登记性质：p7-spec「实施结果与收口记录」同款结构——实施落地入库后由文档收口会话**独立复跑门禁**后登记。本节数字全部为本会话实跑/实读取证（命令与读数随条目给出），不转抄实施会话自述；无法在本会话验证的事实（人工走查类）如实登记为未跑，不虚报。

### A. 改动文件清单（`git status --porcelain` ＋ `git diff --numstat` 实录）

- **服务层（引擎）**：`src/services/finance.ts`（+361 行 0 删——LifecycleInput / YearRow / LifecycleSummary / LifecycleSurvival / LifecycleEventTag / YearSamples / SampleProvider 类型 ＋ `assembleTimeline` / `deriveTimelineSummary` 纯函数 ＋ `calcLifecycle` 编排；§1 契约 59 字段全数在位）。
- **组件（读数卡）**：`src/components/LifeTrajectoryCard.tsx`（**新文件**，176 行——纯读数卡 D9 同构：7 行读数 + 事件标记轴 role="img" aria 汇总 + caliberNote/caliberTooltip；`useFinanceCall(() => calcLifecycle(...), [六切片], { debounceMs: 300 })` 唯一新增调用点）。
- **页面**：`src/components/TaskPages.tsx`（+11 −5——LIFE_GROUPS 组数 5 → **6**，首组 `trajectory` 有意变更，分段控件语义 / hidden 非卸载 / 首展挂载不动）。
- **i18n**：`src/i18n/locales/{zh-CN,zh-Hant,en}.ts`（各 +20 行 0 列——`life` 组 **16 键** ×3 语）。
- **工程与测试**：`package.json`（+2 −1——仅 +1 行 `"check:lifecycle"` script）；`scripts/check-lifecycle.mjs`（**新文件**，480 行，L1–L6 断言）。
- **规范输入三件随轮入库**：本文件 ＋ `docs/research-p8-cases.md` ＋ `docs/research-p8-contract.md`（本轮新增未跟踪文件）。
- **不动清单实证（§4.2 / §5 红线 6、7）**：`git status --porcelain -- src/wasm` → 空、`git diff --stat -- src/wasm` → 空——`src/wasm/src/*.rs` 全部（含 withdrawal.rs threshold/percent 区段）与 `bridge.ts` 逐字节未动；`src/store/useCalculatorStore.ts`、`src/data/*`、`share.ts`、既有 9 面板本体、`global.css` 均不在改动清单——**S1–S26 零回退、零新令牌、零新签名元素（§5.1 零申请）**。
- **调用点复核（§4.4）**：`grep -rn "useFinanceCall(" src/components`（排除 hooks.ts）→ **9 处 / 8 文件**（BasicCalculator 1、AccumulationPanel 2、Pension/Pension、Rental、Tax、Loan、Reverse 各 1、LifeTrajectoryCard 1）——与 §4.4「8 → 9、唯一新增」一致。

### B. 新增测试登记

- **Rust 零新增零改动（§3.8 锁定兑现）**：`cargo test`（src/wasm）实跑 `running 15 tests…15 passed; 0 failed` ＋ `running 60 tests…60 passed; 0 failed`（doc-tests 0）= **75 全绿、同名同值**，与起草基线一致。
- **新增 1 个断言脚本**：`scripts/check-lifecycle.mjs`——L1–L6 六组算例；静态断言点 **96 处**（grep 实数：`assert.equal|assert.ok` 48 ＋ `ok()` 辅助 14 ＋ `near()` 数值断言 34；循环内逐行断言运行时展开，脚本自计输出「断言 32 项 ＋ 逐行断言若干」）；**真实 wasm `init(bytes)` 注入成功**（§3.8 实施首验项通过——esbuild 打包 finance.ts、glue 以 external 保留相对导入成同一模块实例，无桩降级）。
- **性能预算实测（§3.5 断言③）**：calcLifecycle 单次完整调用 5 次取最优 **32.67 ms ≤ 50 ms**（L1 首调用 46.6 ms 含懒加载编译预热）；随机模式性能按 §0.2 裁定不测。

### C. 门禁终态（本会话实跑，全部 exit 0）

| # | 门禁 | 命令 | 实跑结果 |
|---|---|---|---|
| 1 | Rust 套件 | `cd src/wasm && cargo test` | **15 单元 + 60 集成 = 75 passed / 0 failed**（零变化锁定兑现） |
| 2 | 生命周期算例 | `npm run check:lifecycle` | **L1–L6 全过**（含 D1–D5 修正锚、同 seed 逐位、性能 32.67 ms） |
| 3 | 分享契约 | `npm run check:share` | 六组断言全过（v4 往返 + v3 失效 + inflation_uplift 规范化 + **三语键集一致**——新 life 键自动覆盖，§3.8 断言兑现） |
| 4 | 币种 | `npm run check:currency` | 五组样本断言全过 |
| 5 | 数据 | `npm run check:data` | 九组断言全过 |
| 6 | 对比度 | `npm run check:a11y` | **63 组令牌对，白名单外违规 0 处**（红线 3 兑现） |
| 7 | 尺寸 | `npm run build && npm run check:size` | `DIST_TOTAL_KB=1951`、`WASM_MAX_KB=379`、门禁通过；递归实读（排除部署快照 .git，check-size.mjs:38 同规则）dist 14 文件合计 **1,997,245 B**、对 2,000,000 B 余量 **2,755 B**；wasm **387,792 B（较 WF-03 基线 +0，逐字节同值）**、对 800,000 B 余量 412,208 B |
| 8 | 禁词（§7⑩ 同式） | 按 §7⑩ 模式对本文件 + 全部新增/改动文件 + 三 locale 复扫 | 命中仅本文件 §5.8 / §7⑩ / 附 A-5 三处的模式字面量自身（既有豁免行）；**代码、locale、研究文档、本节零命中** |

### D. 实施偏差登记（对 §4 的修正；p7-spec B 同法如实登记）

1. **i18n 键数 16（§4.3 表计 14 新键）**：`survivalFi`/`survivalSustained` 并合为 `life.sameSeedRef`（§4.3 注明的并合选项兑现）＋ 新增 `life.fiAtStart`（§4.1 读数 1「0 = 期初已达标」有展示规则但表中无键，实施补齐）——三语各 16 键（zh-CN.ts:705-723 / zh-Hant.ts:645-663 / en.ts:785-803），键集一致性由门禁 3 承载。
2. **§4.2 monthsDivisor 入链注记参数序换位（规范笔误）**：`effectiveMonthsDivisor` 实签名为 `(monthsDivisor, retireAge, monthsSynced)`（pensionParams.ts:35-39）；实施 LifeTrajectoryCard.tsx:37 与 store:314 同序正确传参——本行对 §4.2 注记勘误。
3. **dist 净增 +9,923 B 超 §6.2 上限估算（+8.0 KB）约 1.9 KB**：实测 1,987,322 → 1,997,245 B，门禁内余量收紧至 **2,755 B（无二次容错）**；wasm 零增量（§6.3 +30 KB 缓冲未动用）。登记偏差不阻塞收口；后续任何轮新增字面前须先按 §6.3 处置顺序回收。

### E. 验收轮次

1. **规范轮**：起草会话完成附 A 自检（A-1~A-8 在库，含期望值独立推导与 D1–D5 修正）；独立复核轮次无在库留痕，不虚报。
2. **实施轮**：实施落地在库（§A 清单即证据）；实施会话自身的门禁执行无在库记录——**本节 C 表为本会话独立复跑的终态证据**，以复跑为准。
3. **文档收口轮（本节）**：§7 可自动断言项 ①②③④⑤⑥⑨⑩ 经 C 表门禁 1–8 覆盖全绿（⑤ 以 `git diff --stat -- src/wasm` 全空承载，强于逐行 grep 对比）；⑦⑧ 人工走查项未跑（见 F）。

### F. 残留（收口后仍存在的事实，如实登记）

1. **§7⑦ 读数卡 UI 手工走查未跑**：`npx vite preview` 逐行对比 7 读数、币种切换同步、三语渲染走查无本会话执行记录（无运行时浏览器取证）；代码层佐证：卡面 7 行读数与 summary/timeline 字段一一对应（LifeTrajectoryCard.tsx:87-149），金额全部经 `money()` 换算（:98/:105/:122）——**留待下一验收轮或 WF-05 全矩阵验证**。
2. **§7⑧ 前半已覆盖、人工走查未跑**：三语键集一致性由 check:share 断言承载（过）；「无裸键渲染」的界面目检未执行（同上移交）。
3. **尺寸余量 2,755 B（紧张）**：见 D-3——回收令与 §6.3 处置顺序在位，未触发（门禁绿）。
4. **§0.2 排除项按裁定移交 WF-04**：时间透镜可视化、事件化施工（homePurchase / childBirth / healthPhase）、事件编辑器、life 容器查询；`loan`/`rental` 维持仅类型承载；随机模式性能维持不设断言。
5. **实施会话双验收循环的轮次/finding 计数**：属工作流运行时状态、仓库无留痕，不虚报（p7-spec D-4 同口径）。

### G. P8.1 残留收口（双验收第 1 轮 4 条 low，主会话收口；全部 verified）

1. **V-F1 口径注重复 + 字阶双档**——卡头 `Text secondary`（14px body 档）与卡尾 `.wf-panel-note`（12px caption 档）渲染同一句 `caliberNote`，违宪法 §3.1（口径注归 caption 档）与 §1.3（反冗长）。修法：删卡头重复份，卡尾 12px 触发器（tooltip 挂全文 `caliberTooltip`）为唯一承载。改动：LifeTrajectoryCard.tsx 卡头行删除（其余字阶/间距/表面验收员实测全部合规）。
2. **M-F1/V-F2 life 键 16 vs spec 14**——登记偏差：`fiAtStart`（§4.1 行 1 哨兵「期初已达标」的必需展示文案，§4.3 键表漏列）与 `caliberTooltip`（口径全文拆分为 tooltip，反冗长拆分）为净增两项，`sameSeedRef` 并合（survivalFi/survivalSustained 二合一，§4.3 注记允许）抵消一项；三语键集 check:share 断言通过；尺寸实测 1,951KB/2,000（余量 ~49KB），≈+120B 三语在 §6 预算内。**§4.3 表行已同步 14+2**。
3. **M-F2 输入粒度 .60 差异（判定非缺陷）**——`LIMITS.amount precision:0`（P4 既有整数元口径）使算例① 输入 1,706,225.60 blur 圆整为 1,706,226 落 store；以 store 实际值重跑引擎得 A_60=10,282,870.71，与读数卡逐分一致——**断言⑦（读数卡=引擎输出）不受影响**。差异全部源自 spec 算例① 锚点取 README 两段相加（含 .60 分量）在整数元 UI 不可精确键入；输入粒度调整属产品变更非本轮范围，登记口径不改行为。
