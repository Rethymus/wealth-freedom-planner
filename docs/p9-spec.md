# P9 实现规范：人生事件显式化施工 · 收入增长 · 购买力指标 · share v5 · 前端消费

| 项目 | 说明 |
|---|---|
| 文档性质 | 实施规范：P9 轮（p8-spec §0.2 排除项落地：homePurchase / childBirth / healthPhase 事件化施工 ＋ 收入增长列 ＋ 购买力达标口径 ＋ share v5）。文件级、可勾选；每处变更加「现状（实测引用）→ 目标」与验收锚点 |
| 规范输入 | `docs/research-p9-cases.md`（7 条算例清单①–⑦，独立手算口径：递推/闭式双路，附录 A 登记最大差 ≤ 9.3×10⁻⁹）＋ `docs/research-p9-events.md`（契约草案与前端/share 消费面盘点）——本文逐条采纳并**修正九处两文档互斥或未钉死项**（§4.3 偏差登记 E1–E9，逐处给出数值/语义证据）；`docs/p8-spec.md`（引擎契约 59 字段与 L1–L6 断言基线）；`src/services/finance.ts`（calcLifecycle / assembleTimeline / deriveTimelineSummary 全文实读，:540-895）；`src/store/useCalculatorStore.ts`（切片与 buildShareState 全文实读）；`src/services/share.ts`（v4 编解码全文实读） |
| 宪法关系 | 零随机流新消费（p8-spec §2.1 定稿延续——accum.seed / paths 仍仅透传双指标调用，finance.ts:830-833 现状不改）；`src/wasm/src/*.rs` 与 `src/wasm/bridge.ts` 逐字节不动（wasm 零触面）；S1–S26 零回退；事件**显式增删改、零自动播种**（wf06-report.md:103 初用者 F5 教训机制化）；公式与数据流不碰——P9 只做三处内聚增量（事件注入 withdrawal / 储蓄增长分支 / 派生字段追加），递推式、三阶段划分、FI 判定、耗尽语义、错误聚合逐字不动 |
| 基线实测 | 起草会话实跑（本会话取证，非转抄）：`cd src/wasm && cargo test` → **15 单元 ＋ 60 集成 = 75 passed / 0 failed**（`running 15 tests…15 passed` ＋ `running 60 tests…60 passed`）；`npm run check:lifecycle` → **L1–L6 全部通过**（性能实测 30.00 ms ≤ 50 ms 预算）；`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1939`、`WASM_MAX_KB=349`、**门禁通过**；dist 原始字节合计实读 **1,984,528 B**（find + stat 递归求和）、wasm **356,864 B**——对门禁 2,000,000 B 余量 **15,472 B**、对 800,000 B 余量 443,136 B。注：wasm 较 p8-spec 收口记录（379 KB）下降为 349 KB，系 d680c3f 提交把 optimize-wasm 固化进 build 链的回收成果，本规范以当前实测为准 |
| 期望纪律 | 同 p7/p8：全部期望值以研究算例独立手算推导为真值口径（不以任何实现输出为真值）；本会话 node 抽样复算 11 个锚点值**全部命中**（附 A-3）；本规范对研究草案的修正（E1–E9）逐处给出独立推导证据——只许语义有意变更，禁静默改动 |

---

## §0 范围裁定（本轮做什么 / 明确不做什么）

### 0.1 本轮范围（五项，全部采纳）

- [ ] **A. 事件化施工（零 Rust 改动）**：三类事件（购房 / 育儿 / 医疗）经 `withdrawal` 注入时间线（§1）；`LifecycleEventTag` 预留形状施工化（finance.ts:582-586 现状 → §1.2 定稿）；行级标记 `events[]` 同循环填充。
- [ ] **B. 收入增长 salaryGrowthPct（可选、缺省 0 = 现状逐位一致）**：`LifecycleOpts` 子块（§2）；只进工作段储蓄基流。
- [ ] **C. 购买力指标（3 汇总字段 ＋ 1 行字段）**：`realWithdrawal` ＋ `purchasingPower{withdrawalYears, metShare, cumulativeGap}`（§3）。
- [ ] **D. share v5**：`lifeEvents` 入载荷、版本 4 → 5、label 存而不传（§6）。
- [ ] **E. 前端消费（逐文件 §5）**：事件编辑器（life 页新组）＋ 透镜标记 ≤3 新形状 ＋ 读数卡购买力读数与事件轴扩展 ＋ 情景对比基准列（wf06 F4）。
- [ ] **F. 测试**：`check-lifecycle.mjs` 扩展 L7–L13（算例①–⑦ 一一对应）；`check-share.mjs` 扩展 v5 断言组；既有 75 项与 L1–L6 **零变化锁定**（§4.2）。

### 0.2 明确排除（本轮禁做）

- **购房贷款分期**：`LifecycleInput.loan` 维持仅类型承载（finance.ts:571-575 现状口径不动；research-p9-cases §0.6 同裁定）。
- **教育/医疗专项通胀双因子**：一切事件流出与生活费/储蓄同一通胀因子（cases §0.2 统一口径）；双通胀族登记为已知简化不进本轮（cases §8.1）。
- **事件 × 领取段交叠变体（⑦-b）**：cases §7 已登记为备用变体，不在本轮断言。
- **事件编辑器拖拽排序 / 时间轴拖放**：列表增删改最小面（§5.1）；排序交互不在本轮。
- **事件「不在窗口内」提示 UI**：越界事件存而不用（§1.4），编辑器照常显示列表项、不加窗口标记（登记为不做——避免新增 i18n 键与判定面）。
- **随机面任何新消费**：pass1/pass2 不消费 salaryGrowthPct 与事件（§2.4 / §7 红线 5）；survival 双指标与时间线在 g > 0 时必然分叉，以口径注明示而非重算。
- **TextEncoder 编码改造**：btoa 链不动，label 存而不传（§6.3-2）。

---

## §1 事件契约定稿（字段级；类型落 `src/services/finance.ts`，bridge.ts 零改动）

> 定稿说明（延续 p8-spec §1 定稿说明）：事件类型不进 bridge.ts（不制造「wasm 契约」假增量）；事件输入切片落 store、事件消费落 finance.ts 纯函数层。

### 1.1 现状（实测引用）

- `LifecycleEventTag` 四成员形状预留（finance.ts:582-586）：homePurchase / childBirth 只有 `year` 无金额，healthPhase 携 `phase: string`；`events` 字段**恒空数组**——`assembleTimeline` 三处硬编码 `events: []`（finance.ts:740 / :764 / :769），全仓零生产者、零消费者。
- 一次性预留的既有承载不动：`base.majorInvestment / base.healthReserve / childCount × costPerChild` 只进 calculate_baseline 乘数族（bridge.ts:53-64 输入、pension.rs 乘数链），单次计入——与事件族**两族独立、互不迁移、互不抵扣**（§1.5 双轨口径）。
- store 无 `lifeEvents` 切片（useCalculatorStore.ts:74-151 全文实读，CalculatorState 十三数据字段逐一核对）；`businessDefaults()` 工厂（:156-174）无事件种子。

### 1.2 事件输入契约（store 切片 `lifeEvents: LifeEventInput[]`）

```ts
/** P9 事件输入（research-p9-events.md §1.2 采纳；年龄锚存储——用户改 currentAge 后
 *  「37 岁买房」语义不漂移，t 在引擎入口重推：t = age − currentAge + 1）。
 *  id 生成复用 scenarios.ts:96 先例：`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` */
export type LifeEventInput =
  | { id: string; kind: "homePurchase"; age: number; amount: number }
  | { id: string; kind: "childBirth"; age: number }                     // 出生锚；年成本 = base.costPerChild ÷ 18（§1.3，事件体不存金额）
  | { id: string; kind: "healthPhase"; age: number; endAge: number;
      annualAmount: number; label?: string };                           // label 仅 UI 本地态：存而不传（§6.3-2）、不入引擎
```

**字段级语义（六必载字段 ＋ 一本地态字段）**：

| 字段 | 域 / 校验 | 语义 |
|---|---|---|
| `id` | 非空 string | 事件行键（update/remove 定位）；decode 端校验非空 string，无独立长度上限（MAX_PAYLOAD_CHARS 全局门禁兜底） |
| `kind` | 三枚举成员 | 事件族；UI 三选、decode 端枚举命中否则整体 null |
| `age` | 整数 [16, 120]（新增 `LIMITS.lifeEventAge`，同 `targetRetireAge` 整数档形态 defaults.ts:76） | 事件锚年龄（购房付款年 / 孩子出生年 / 医疗起点；行首年龄语义，与 YearRow.age 同族）。与 pension currentAge 上限 70 **不同域、有意放宽**（research-p9-events.md §2.3 登记） |
| `endAge` | 整数 [age, 120]；`endAge ≥ age` 由 UI 校验拒绝、decode 同判 | 仅 healthPhase；`endAge = age` 合法（恰一行区间） |
| `amount` | 既有 `LIMITS.amount`（整数元、min 0，defaults.ts:50） | 仅 homePurchase；**基期名义**（「今天的钱」） |
| `annualAmount` | 同 `LIMITS.amount` | 仅 healthPhase；**基期名义**年额 |
| `label` | 可选 string | 仅 UI 本地态：store 保留、编码端剥除、解码端置缺省空串；不入 share 载荷、不入引擎（「存而不传」字段，逐字登记） |

### 1.3 行级标记契约（`LifecycleEventTag` 施工化替换）

```ts
/** 现状（finance.ts:582-586）→ 定稿：homePurchase 加 amount、childBirth 加 annualCost、
 *  healthPhase 弃 phase: string 改数值化（形状变更裁定依据：events[] 零消费者、P8 预留
 *  注释即声明施工归后续轮（finance.ts:578-581），形状定稿权在施工轮；不触碰任何既有
 *  输出字段——偏差登记 E3） */
export type LifecycleEventTag =
  | { kind: "pensionStart"; year: number }
  | { kind: "homePurchase"; year: number; amount: number }
  | { kind: "childBirth"; year: number; annualCost: number }
  | { kind: "healthPhase"; year: number; annualCost: number };
```

**标记金额语义裁定（研究未钉死，本规范定稿）**：tag 的 `amount` / `annualCost` / `annualCost` 恒为**行内名义流出值**（基期 × 该行 cumInfl_t）——与逐年读数面板「当年支取」同域（当年名义），aria 文案与 Tag 展示直接可用。行级 tag 为标记字段，不参与递推（递推消费的行内流出在 withdrawal 合成）。

**行内 tag 装配规则（钉死）**：该行发生现金流消费的事件逐条入 `events[]`（育儿成本区间**逐行**一条 childBirth tag、医疗区间**逐行**一条 healthPhase tag、购房付款行一条 homePurchase tag）；行内 `events[]` 按 `kind` 字典序**稳定排序**（childBirth ＜ healthPhase ＜ homePurchase；同 kind 多条保持输入数组序）——排列不变性由此在标记层逐字节成立（偏差登记 E6：算例⑥ 断言③ 的承载裁定）；耗尽当行事件照常记值与标记；恒零尾行 `events` 恒 `[]`（无消费即无标记——与 finance.ts:734-743 补零行形状同构）。

### 1.4 引擎消费口径（递推点、派生规则与统一通胀因子）

**事件流出统一口径（cases §0.2 钉死，全部三族同一式）**：一切事件金额按基期名义理解，行内流出 = 金额 × cumInfl_t（与生活费/储蓄**同一通胀因子同行取值**，finance.ts:749 既有链）。备选「事件年名义支付」口径被否决（制造两套钱；全部既有金额输入族均为基期名义——月开销、育儿 53.8 万 2024 价 insights.ts:150、医疗 2024 价 insights.ts:160-177）。

| 事件 | 行定位（引擎入口重推） | 行区间 | 现金流消费（assembleTimeline 同一循环内） |
|---|---|---|---|
| 购房 | t = age − currentAge + 1 | 单行 | t ∈ [1, horizon] 时该行 `withdrawal += amount × cumInfl_t`；t 越界 → **存而不用**（不钳位、不挪行、行级不可见——偏差登记 E8）；tag `{kind, year: t, amount: amount × cumInfl_t}` |
| 育儿 | t₀ = age − currentAge + 1（出生行） | [t₀, t₀ + 17]，CHILD_COST_YEARS = 18（与 bridge.ts:58-59「0–18 岁累计口径由数据层定义」同源；孩子年龄 = t − t₀，出生行 0 岁） | 区间 ∩ [1, horizon] 内各行 `withdrawal += (base.costPerChild ÷ 18) × cumInfl_t`；**区间与行域求交截断**（t₀ + 17 > horizon 后截断——窗口外成本不入账，cases §0.4；t₀ < 1 前截断为同构延伸，偏差登记 E7）；单一事实来源 = base.costPerChild，事件体不存金额（改抚养成本全局联动——偏差登记 E1） |
| 医疗 | t₁ = age − currentAge + 1、t₂ = endAge − currentAge + 1 | 闭区间 [t₁, t₂]（endAge < age 上游已拒，引擎域内恒 t₁ ≤ t₂） | 区间 ∩ [1, horizon] 内各行 `withdrawal += annualAmount × cumInfl_t`；区间外零影响；多段并列合法（区间按条独立累加） |

- **金额与阶段正交**：事件金额加在既有 withdrawal 之上，递推式不变（`closing = opening×(1+r_t) + contribution − withdrawal`，finance.ts:761 逐字不动）；三阶段划分不变（finance.ts:754-759）；耗尽行/耗尽后恒零语义原样生效（finance.ts:762-767）。工作段不再恒 0（净额口径扩展：事件可落在工作段）。
- **行内流出与标记同一循环**：事件行定位、流出累加、tag 填充、`realWithdrawal` 派生（§3）都在 `assembleTimeline` 现有 for 循环内完成（finance.ts:730-771 骨架不动），**不另立第二遍历、不建第二套 cumInfl**。
- **线性叠加裁定（cases §0.7）**：同一年多事件流出线性叠加（相加进 withdrawal；无交互项、无上限、无次序依赖）。加法交换 ⇒ 行数值对登记顺序不变；总差分 = 各事件单独差分之和。耗尽判定（全精度 closing ≤ 0）在叠加后净行上照常执行。
- **事件不改目标族与养老金**：targetValue 仍生活费口径（育儿不进月开销）；pensionMonthly / bridgeYears 与事件无关（finance.ts:830-833 双调用零改动）。流出 ≥ 0 ⇒ 有事件路径 closing 逐行 ≤ 基线 ⇒ fiFirstYear 只能推迟或不变（可推出 horizon 外 = −1）。FI 判定本身不动（finance.ts:789-795 已是实口径，算例⑤ 钉死其正确性，§3.3）。
- **确定性保持**：事件是纯数据输入，同输入恒同输出；`SampleProvider` 测试缝（finance.ts:665-666）原样可用；**零随机流新消费**。

### 1.5 校验与错误口径（分三层钉死）

**编排层零新校验的边界在哪里（如实登记为新校验面）**：p8-spec §1.4「编排层零新校验」的前提是全部字段经既有 wasm 校验代理；`lifeEvents` 与 `opts` 是 TS 侧新输入、无 wasm 代理，**P9 自建校验**（不是违反，是边界延展，逐条登记）。引擎层对事件/opts **不加运行时守卫**（域由 UI/decode 前置——与 p8-spec §1.4(c)「均值域由 wasm 校验前置，TS 层不另立口径」同款纪律）：

1. **UI 层（编辑器表单）**：age/endAge 走 `LIMITS.lifeEventAge` 钳制（InputNumber min/max）；`endAge ≥ age` 校验不过 → 添加/保存按钮禁用 ＋ 表单内错误文案（`life.eventEndAgeError`，不弹全局 Alert）；amount/annualAmount 走 `LIMITS.amount`；条数上限 20（第 21 条添加禁用 ＋ 计数提示 `life.eventCount`）。
2. **decode 层（share v5，§6.3-3）**：任何违反 → **整体 null**（禁止部分恢复，share.ts:12-13 纪律逐字延续）：kind 非三枚举之一、数值非有限数（isNum 同款 share.ts:72-74）、`amount/annualAmount < 0`（负值载荷按损坏——`rate < 0` 先例 share.ts:256）、age 非整数或出 [16,120]、`endAge ∉ [age,120]`、`events.length > 20`、id 非非空 string。
3. **引擎层（无新错误通道）**：越界事件存而不用（无 error、无日志面）；区间截断口径明示（§1.4）；`summary.error` 聚合规则 P8 定稿**逐字不动**（先 estimate_pension、后 simulate_accumulation、皆空 ""，finance.ts:875-885）；事件校验错误不进 summary.error。

**零自动播种铁律（红线，F5 教训机制化）**：store 新增动作恰三个——`addLifeEvent / updateLifeEvent(id, patch) / removeLifeEvent(id)`；写入 `lifeEvents` 的代码路径**白名单恰五处**：三动作 ＋ `applyShareState`（v5 载荷事件键）＋ reset 回落（`businessDefaults()` 恒空数组）。**`applyPreset` / `clearPreset` 不触碰事件**（useCalculatorStore.ts:195-228 两动作现状不新增任何事件写入）；无示例事件、无演示数据、无「帮你填一条」；空态指路文案（§10 `life.eventsEmpty`），不代填。resetAll / resetBusinessInputs 语义：事件属业务输入切片 → 回落空数组（useCalculatorStore.ts:322-333 既有二分口径原样覆盖新切片）。

---

## §2 收入增长 salaryGrowthPct 定稿（可选 · 缺省 0 = 现状逐位一致）

### 2.1 落点（不进 AccumulationInput）

```ts
/** P9 引擎选项（LifecycleInput 第 6/7 子块之 opts；research-p9-events.md §2.1 采纳）。
 *  不进 AccumulationInput：bridge.ts:472-500 属锁区邻接面，加字段即触碰 bridge.ts——红线禁 */
export interface LifecycleOpts {
  /** 年收入实际增长（百分点）；缺省/0 = 现状（储蓄只随通胀上行） */
  salaryGrowthPct?: number;
  /** 最低生活线（基期名义元/年）；缺省 = accum.monthlyExpense × 12（§3.2） */
  minLivingAnnual?: number;
}
```

`LIMITS.salaryGrowthPct = { min: -100, max: 100, step: 0.1, precision: 1 }`——对称域先例 = `strategyRealReturnPct`（defaults.ts:74 min −100 同形；`LIMITS.percent` min 0.01 禁负无法承载）。缺省/0 逐位退化为现状；−100 = 停薪（g 钳 0，语义见下）。

### 2.2 复算口径（定稿，实施逐字采纳——对 research-p9-events.md §2.2 修正，偏差登记 E5）

1. **收入增长只作用于收入，支出不联动**（cases §4 语义为定稿）：
   - 增长因子：`g = salaryGrowthPct 缺省 ? 1 : max(1 + salaryGrowthPct/100, 0)`（下限 0：g = 0 即收入归零；g 是确定性参数，语义是「增长后收入非负」——不照抄 −0.99 样本防御值 finance.ts:543，那是随机样本下限）。
   - **关闭分支（g === 1，即缺省或 0）**：`contribution = savingBase × cumInfl`（finance.ts:751 现状式，**同一代码路径、逐字节一致**——「缺省 = 现状」是结构性保证，非数值巧合）。
   - **开启分支（g ≠ 1）**：`income_t = monthlyIncome × 12 × cumInfl_t × gPow_t`（gPow 连乘：gPow_t = gPow_{t−1} × g，与 cumInfl 重复乘法同序、禁 pow）；`contribution = income_t − expense_t`（expense_t = expenseBase × cumInfl_t 既有量，finance.ts:752 不动）。g = 0 → income_t = 0 → contribution = −expense_t（**负储蓄**：停薪但生活费照旧，资产侧照常扣减——「contribution 可为负」是既有合法域 finance.ts:601 注释明载，偏差登记 E5-b：events §2.2「g = 0 ⇒ 储蓄归零」被否决，g 因子乘整段 savingBase 的语义使生活费在模型外隐式融资，与「支出不联动」自相矛盾）。
   - 两分支在 g → 1 边界代数恒等（(a×c − b×c) ≡ (a−b)×c），f64 位序不同——边界**不设逐位断言**（±0.01 容差域内）。
   - g=4% 数值分叉证据（E5 定稿依据，node 实算）：定稿式行 1 = 96,000×1.0608 − 35,880×1.02 = **65,239.20**；被否式（savingBase×cumInfl×g）行 1 = 60,120×1.0608 = **63,775.30**，差 1,463.90——cases §4 全表期望值只与定稿式相容。
2. **只影响工作段储蓄基流**：停工后（t > workEnd）两分支 contribution 恒 0（收入事件停工即止，cases §0.3）。
3. **不影响的量（逐项登记）**：生活费基流 expenseBase（不引入生活方式联动）；三段划分与 withdrawal；FI 目标与判定（实口径，§3.3）；养老金与桥接（estimate_pension 全链）；480 乘数族；随机面（pass1/pass2 不消费 salaryGrowthPct——σ/seed/流序锁区不动）。
4. **survival 分叉口径注**：g > 0 时 `survival` 双指标（静态储蓄口径）与时间线（含增长口径）**必然分叉**——caliberTooltip 增句「存续双指标为静态储蓄口径，不含收入增长」（双参数族注记先例 p8-spec §2.4 同款：正交并行展示、不以一者静默替代另一者）。
5. 生产路径 `provider` 缺省不变；`TimelineArgs` 新增 3 字段：`salaryGrowthPct: number`（缺省 0）、`childAnnualCost: number`（= base.costPerChild ÷ 18，调用方派生）、`lifeEvents: readonly LifeEventInput[]`（原样传入，行定位装配内派生）——纯函数签名向后兼容（可选/缺省字段）。

---

## §3 购买力指标定稿（行级实口径 ＋ 最低生活线 ＋ 支取域统计）

### 3.1 现状

YearRow 八字段全是名义元（finance.ts:594-617）；通胀只在递推链上行（cumInfl，finance.ts:749），无实口径读数。既有实口径只存在于算例推导层（p8-spec §3.4 R_t = A_t/1.02^t），未落输出契约。

### 3.2 契约定稿

1. **行级 `realWithdrawal`（基期购买力元）** = `withdrawal ÷ cumInfl_t`，在 assembleTimeline 同一 cumInfl 链内计算（**禁第二遍历/第二套 cumInfl**——D2 教训：判定层两套口径会另立审计面；SampleProvider 注入序列下派生自动同源）。耗尽后零行恒 0（withdrawal 已恒 0）。YearRow 8 → **9 字段**。
2. **最低生活线** `opts.minLivingAnnual`（基期名义元/年），缺省 = `accum.monthlyExpense × 12`（双参数族归属 = 打工积累面板 monthlyExpense，p8-spec §2.4 注记同源，写进 caliberTooltip）。逐年比较在**基期域**：达标行 ⇔ `realWithdrawal_t ≥ minLivingAnnual`（两量同为基期元，无通胀折算歧义）。
3. **统计域（钉死）**：停工后支取行 = `t > workEnd` 且不在耗尽尾行（耗尽判定域界 = 首个 `closingAssets ≤ 0` 的行索引之后——与 `deriveTimelineSummary` 的 findIndex 语义**同一字面**（finance.ts:796），禁第二套耗尽判定；耗尽当行本身计入域，其 withdrawal 记值 ＞ 0）；工作段零支取行不计。重叠年份（workEnd > yearsToRetire 的合法域边缘，finance.ts:711-714）t ∈ (yearsToRetire, workEnd] 行**不计入**域（「停工后」定义字面，偏差登记 E9）。域空（域大小 0，如从未停工）→ 哨兵 −1（「未度量」，yearsP5 = −1 同款哨兵家族）。
4. **汇总 `purchasingPower`（3 字段，summary 10 → 13）**：

```ts
purchasingPower: {
  /** 支取统计域行数；0 = 无支取域 */
  withdrawalYears: number;
  /** 达标率 = 达标行 ÷ withdrawalYears；哨兵 −1 = 域空未度量 */
  metShare: number;
  /** 累计缺口（基期元）= Σ_max(0, minLiving − realWithdrawal_t)，仅支取域内；域空 = 0 */
  cumulativeGap: number;
}
```

5. **派生落点**：新纯函数 `derivePurchasingPower(rows, minLivingAnnual, workEnd)`（零 wasm 依赖、与 `deriveTimelineSummary` 同层测试缝，finance.ts:785-798 先例）；展示层金额经 money() 币种换算（LifeTrajectoryCard.tsx:35 既有绑定）。

### 3.3 FI 判定的实口径确认（零改动、硬断言锁定）

现有 FI 判定 `closing_t ≥ targetValue × cumInfl_t`（finance.ts:794）**已是实口径底线**：`closing_t ≥ targetValue×cumInfl_t ⟺ closing_t ÷ cumInfl_t ≥ targetValue`。cumInfl_t ≥ 0.99^t ＞ 0（LIFECYCLE_SAMPLE_FLOOR = −0.99 防御，finance.ts:543/:747-748 同源）——实口径换算**无除零路径**；i = 0 ⇒ cumInfl ≡ 1、实 = 名。**禁用「名义资产 ≥ 基期名义目标」错觉判定**（算例⑤ 行 13 反例硬断言：A₁₃ = 1,657,834.51 ≥ 1,635,200 但判定必须未达标——实际购买力 1,281,560 仅达底线 78.4%，误用将提前 6 行误报）。本节零代码改动，以 L11 断言组锁定。

---

## §4 测试算例（7 条；期望纪律同 P7/P8——研究独立手算为真值口径，本会话 11 锚点抽样复算全命中）

### 4.1 算例表（L7–L13 与算例①–⑦ 一一对应）

**记法约定（偏差登记 E10）**：research-p9-cases 的 `year` 记法 = 相对行号 t；契约输入为年龄锚 `age = currentAge + t − 1`（默认 currentAge 30：t=3 ⇔ age 32、t=5 ⇔ age 34、t=10 ⇔ age 39、t=15 ⇔ age 44）。断言一律落在行号 t。完整逐行期望值表以 research-p9-cases.md 各节表格为准（本表录关键锚）；断言容差 ±0.01 元。

| 组 | 算例（研究出处） | 输入（契约记法） | 关键期望锚（独立手算，node 抽样复核 ✓） | 断言口径摘要 |
|---|---|---|---|---|
| L7 | ①购房第 5 年付 120 万（cases §1） | ACCUMULATION_DEFAULTS 但 `currentAssets: 1,000,000`；`homePurchase { age: 34, amount: 1,200,000 }` | 行 5 withdrawal = **1,324,896.96**（= 120 万×1.02⁵）；Δ_t = −P₅×1.045^{t−5}（行 5 −1,324,896.96 → 行 40 −6,183,754.94）；fiFirstYear 基线 **7** → 事件 **23**（推迟 16 行）；pensionStart 仍在行 31 | ①行 5 withdrawal 恰值（非 120 万原值）；②行 1–4 两路径逐行相等、行 5 起 Δ 逐行闭式；③fiFirstYear 7→23（首触不提前）；④**变体 B**（currentAssets 500,000）：depletedYear = 5、行 5 投入/支取仍记值（66,377.34 / 1,324,896.96）、行 6–40 全字段恒 0、fiFirstYear = −1；⑤行 5 tag 恰一条 homePurchase（amount = 行内名义 1,324,896.96，§1.3 裁定） |
| L8 | ②育儿第 3 年出生（cases §2） | ACCUMULATION_DEFAULTS 原样 ＋ `base.costPerChild: 540,000`（覆写，纯为手算可复算——偏差登记 E1）；`childBirth { age: 32 }` | 成本行 [3, 20] 恰 18 行；年成本 = 540,000÷18 = **30,000**（基期）；行 3 withdrawal = **31,836.24**、行 20 = **44,578.42**（末行）、行 21 起 0；fiFirstYear 基线 **14** → 事件 **20** | ①成本行数恰 18、withdrawal = 30,000×1.02^t 逐行、行 2/21 = 0；②行 20 末行当行仍计成本（闭区间）；③fiFirstYear 14→20；④行 21 Δ 增量 = Δ₂₀×0.045（止后只按回报复利）；⑤孩子年龄映射行 3→0 岁 / 行 20→17 岁 / 行 21→18 岁（不入账） |
| L9 | ③医疗阶段 10–15 年每年 +3 万（cases §3） | ACCUMULATION_DEFAULTS 原样；`healthPhase { age: 39, endAge: 44, annualAmount: 30,000 }` | 区间 [10, 15] 恰 6 行；行 10 withdrawal = **36,569.83**、行 15 = **40,376.05**、行 9/16 = 0；fiFirstYear 基线 14 → **16** | ①区间界精确落位（端点含入）；②Δ 行 16 增量恰 = Δ₁₅×0.045；③fiFirstYear 14→16；④**phase 串不存在于契约**（E3 重界：cases 原断言「两 phase 值输出一致」→ 定稿断言 `label` 不入引擎——有 label / 无 label 两输入时间线逐字节一致）；⑤A₀ = 500,000 全程 closing ＞ 0（min = 583,822.40 行 1——不触发耗尽） |
| L10 | ④收入增长 4% vs 0%（cases §4） | ACCUMULATION_DEFAULTS 原样；`opts.salaryGrowthPct: 4` vs 缺省/0 | 储蓄式：g=0 = 60,120×1.02^t（行 1 恰 61,322.40，P8 现状锚）；g=4% = 96,000×1.0608^t − 35,880×1.02^t（行 1 恰 **65,239.20**）；行 30 期末 6,616,453.35 vs **12,767,892.35**（差恰 6,151,439.00）；fiFirstYear 14 → **11**（提前 3 行） | ①储蓄行两式逐行 ±0.01；②行 30 期末两路 ＋ 差值恰锚；③fiFirstYear 14→11（g 增大只提前或不推迟——contribution 随 g 单调增）；④行 31 起两路 contribution 恒 0（停工即止）；⑤目标族逐行相同（g 不改购买力底线，只改到达速度）；⑥**g=0 关闭分支逐字节回归**（§2.2-1 结构性承载，另见 §4.2） |
| L11 | ⑤购买力底线口径（cases §5）＋ derivePurchasingPower（events §6.2 锚 4） | **A**（FI 判定）：ACCUMULATION_DEFAULTS 但 `nominalReturnMeanPct: 2`（r = i = 2，σ 12/1 维持供双指标调用校验）；**B**（实口径恒值域）：p8-spec §3.4 输入 A 同形（A₀ 1,435,200 / monthlyIncome 0 / r = i = 2 / targetRetireAge 30 → pension 错误分支 → 支取 = 生活费全额）；**C**（域空哨兵）：targetRetireAge 75 → workEnd 45 > horizon 40 | A：R_t = 500,000 ＋ 60,120t **精确线性**（至 10⁻¹⁰）；fiFirstYear = **19**（行 19 名义 2,392,491.85 ≥ 上行目标 2,382,177.63；**行 13 名义 1,657,834.51 ≥ 基期名义目标 1,635,200 但判定必须未达标**——错觉反例硬断言）；B：realWithdrawal = 35,880 恒值；minLiving 缺省 35,880 → withdrawalYears = 40、metShare = 1、gap = 0；minLiving = 40,000 → metShare = 0、gap = **164,800**；C：withdrawalYears = 0、metShare = **−1**、gap = 0 | ①A fiFirstYear = 19（两种等价判定同域，cumInfl ＞ 0 无除零）；②A R_t 线性；③A 行 13 名义 ≥ 基期名义目标但未达标（错觉反例）；④B realWithdrawal 恒值 ＋ metShare/gap 两变体闭式；⑤C 域空哨兵；⑥A 变体 i = 0：cumInfl ≡ 1、实 = 名、底线退化为名义恒值（合法输入无除零） |
| L12 | ⑥多事件重叠年叠加（cases §6） | ACCUMULATION_DEFAULTS 但 `currentAssets: 1,000,000`；`childBirth { age: 32 }` ＋ `homePurchase { age: 34, amount: 1,200,000 }` ＋ `healthPhase { age: 39, endAge: 44, annualAmount: 30,000 }` | 行 5 withdrawal = **1,358,019.39**（(30,000＋1,200,000)×1.02⁵ 合并闭式）；行 10–15 = 60,000×1.02^t（行 10 = **73,139.67**、行 15 = **80,752.10**）；行 5 低谷 168,021.64 ＞ 0；fiFirstYear = **−1** 且 depletedYear = **−1**（不耗尽但永不达标，两哨兵并存） | ①重叠行 withdrawal 恰合并闭式；②Δ 组合 = Δ房＋Δ育＋Δ医 逐行（叠加线性；研究实测最大差 3.7×10⁻⁹）；③**三登记顺序 timeline 逐字节相等**（含 round2 与 events[] 标记层——由 §1.3 kind 字典序稳定排序承载，E6）；④fiFirstYear = −1 且 depletedYear = −1；⑤行级 tag 计数全枚举：行 3–4 一枚（child）、**行 5 两枚（child＋home，E6 精化）**、行 6–9 一枚（child）、行 10–15 两枚（child＋health）、行 16–20 一枚（child）、其余 0 |
| L13 | ⑦P8 桥接组合（cases §7） | research-p8-cases §1 算例①原样（A₀ = 1,706,225.60 / targetRetireAge 30 → workEnd 0 / horizon 60）＋ `base.costPerChild: 540,000` ＋ `childBirth { age: 32 }` | 基线五行 = P8 §1 表逐值（1,746,408.15 / 1,787,666.97 / 3,559,230.95 / 3,687,209.22 / 10,282,865.09）；组合行 3–20 withdrawal = 65,880×1.02^t（行 3 = **69,912.38**、行 20 = **97,894.21**）；ΔA₆₀ = **−5,779,062.96**（10,282,865.09 → 4,503,802.13）；fiFirstYear = 0 | ①bridgeYears 恒 30、pensionStart 恒行 31、pensionMonthly 恒 2,842.03（事件不触碰养老金族）；②基线五行逐值 = P8 §1 表 ±0.01（跨文档手算对表）；③行 3–20 withdrawal = 65,880×1.02^t、行 21 起回基线支取式；④ΔA₆₀ 恰锚；⑤全 60 行 closing ＞ 0 且 fiFirstYear = 0（t=0 判定，事件不回写） |

### 4.2 既有测试零变化锁定（本会话实跑取证）

- [ ] **Rust 75 项零变化**：`cd src/wasm && cargo test` → `running 15 tests…15 passed; 0 failed` ＋ `running 60 tests…60 passed; 0 failed` = **75 全绿**（本会话实跑）。P9 零 Rust 改动 → 零新增 Rust 测试、既有断言值/名/输入**不得改动**；`accumulation_sustained_invariant_same_seed` 等锁定测试保持绿。
- [ ] **L1–L6 零变化**：`npm run check:lifecycle` → L1–L6 全部通过（本会话实跑，性能 30.00 ms）。既有六组断言区段**零 diff**（`scripts/check-lifecycle.mjs` 仅追加 L7–L13）；L1 的「events 恒空」断言（check-lifecycle.mjs:150）在无事件输入下保持成立（P9 不改该语义）。
- [ ] **g = 0 逐位回归的承载方式（钉死）**：L1–L6 全部输入均为缺省 opts / 无事件——P9 重跑 L1–L6 **逐字节零变化**即「缺省 = 现状」的硬验收（§2.2-1 关闭分支为同一代码路径的结构性保证）；不另设快照文件。
- [ ] **新增脚本断言**：`check-lifecycle.mjs` 追加 L7–L13 七组；`check-share.mjs` 追加 v5 断言组（§6.4）。不引入新依赖（esbuild ＋ node:assert 既有路径）。

### 4.3 研究草案修正登记（E1–E9；两份研究文档互斥项的裁定与独立推导证据）

| # | 研究草案原文 | 本规范定稿 | 证据 / 影响 |
|---|---|---|---|
| E1 | cases §2/§6 记法 `childBirth { year: 3, costPerChild: 540,000 }`（事件携带金额） | 事件体**不存金额**（events §1.3 单一事实来源裁定为准）；cases 记法解读为 **base.costPerChild 覆写 540,000**（年成本 540,000÷18 = 30,000 与 cases 全表数值自洽） | 数值无变化；输入落点修正（改抚养成本全局联动语义成立） |
| E2 | cases §3 记法 `annualExtra: 30,000` / `{ s: 10, e: 15 }` 简写 | 契约字段名 `annualAmount` / `age + endAge`（events §1.2 schema 为准）；cases 简写为草案记法 | 数值无变化；字段名定稿 |
| E3 | cases §3 `phase: "treatment"`（healthPhase 携相别串）；p8 预留形状 finance.ts:586 | **phase 串弃用**（events §1.2 数值化裁定为准）；cases 断言④「两 phase 值输出一致」重界为「label 不入引擎——有/无 label 时间线逐字节一致」 | 形状定稿权在施工轮（finance.ts:578-581 注释先例）；零消费者无迁移面 |
| E4 | events §1.3 医疗「名义恒额，随通胀**不上调**」 | **否决**：医疗流出 = annualAmount × cumInfl_t（cases §0.5 统一口径与全表数值承载——行 10 = 36,569.83 ≠ 30,000，若不上调则 cases §3 全表不成立） | 两研究文档互斥以 cases 真值口径裁定；「与养老金恒额同族」注记随之不成立（养老金年额确不乘 cumInfl，事件确乘——两族不同构，如实登记） |
| E5 | events §2.2-1 `contribution = savingBase × cumInfl × g^t`（增长因子乘整段储蓄）＋「g = 0 即停薪，储蓄归零」 | **否决**，定稿 = cases §4 语义：income 单独随 (1+i)(1+g) 上行、支出只随 i 上行（「支出不联动」自洽）；g = 0（salaryGrowthPct = −100）→ income = 0 → contribution = −expense_t（负储蓄，既有合法域 finance.ts:601） | node 实算分叉：定稿式行 1 = 65,239.20 vs 被否式 63,775.30（差 1,463.90）——cases §4 全表只与定稿式相容；关闭分支（g = 1）两式退化同形，现状逐字节路径保留（§2.2-1） |
| E6 | cases §6 断言⑤「行 3/5 各挂一枚」；断言③「timeline 逐字节相等」未给标记层排序规则 | 行 5 = **两枚**（homePurchase ＋ childBirth——child 成本区间逐行挂 tag，行 10–15 两枚的存在已证逐行语义）；行内 `events[]` 按 kind 字典序**稳定排序**，排列不变性在标记层逐字节成立 | 由 §1.3 装配规则独立推导；withdrawal 数值断言不受影响（tag 为标记字段） |
| E7 | cases §0.4 仅登记后截断（t₀＋17 ＞ horizon） | 区间与行域 [1, horizon] **求交截断**（前截断 t₀ ＜ 1 为同构延伸——孩子已出生、成本行日历锚定，年成本式不变） | 研究未单列；独立推导登记 |
| E8 | events §1.3 购房「钳 [1, horizon]」与「越界存而不用」并陈（措辞自相斥） | **存而不用**为准：t ∉ [1, horizon] 不钳位、不挪行、行级不可见（钳位会把付款挪到行 1/horizon，制造虚假现金流） | 语义裁定；越界事件在编辑器列表照常可见（不做窗口提示，§0.2） |
| E9 | events §3.2-3 统计域「t > workEnd 且全精度未耗尽」未覆盖重叠年份 | 重叠年份（workEnd > yearsToRetire 的 t ∈ (yearsToRetire, workEnd]，finance.ts:711-714 合法域）**不计入**支取域（「停工后」定义字面） | 边缘域裁定；不另立分支、不设断言（登记即可） |
| E10 | cases 全文 `year` 记法 vs events §1.2 年龄锚 schema | cases 记法 = 行号 t（手算便利）；契约输入 = 年龄锚 age = currentAge ＋ t − 1，引擎入口重推（events §1.2/§1.3 为准） | 记法映射；断言域不变 |

---

## §5 前端消费（逐文件；现状行号为本会话实读）

### 5.1 `src/store/useCalculatorStore.ts`

- CalculatorState 新增 `lifeEvents: LifeEventInput[]` ＋ 三动作 `addLifeEvent / updateLifeEvent(id, patch) / removeLifeEvent(id)`；`businessDefaults()` 工厂清单新增 `lifeEvents: []`（恒空数组——初始态 / resetAll / resetBusinessInputs 三处共用同一份清单防漂移，useCalculatorStore.ts:156-174 既有形态）。
- `applyShareState`（:272-295）set 对象新增 `lifeEvents: decoded.state.lifeEvents`（v5 载荷；decode null 时整体返回 false 不动任何切片，:275-276 既有口径）。
- `buildShareState`（:299-321）返回对象新增 `lifeEvents: s.lifeEvents`。
- **禁止新增任何其他写入路径**（§1.5 零自动播种白名单）。

### 5.2 `src/components/LifeEventEditor.tsx`（新文件）

- 事件列表 ＋ 三动作直写 store；每条事件行 = kind Tag ＋ 年龄/金额读数（金额经 money()）＋ 编辑/删除；添加表单 = kind 三选 ＋ age ＋（endAge/annualAmount/amount 按 kind 显隐）；空态 = 「添加第一条人生事件」指路文案（零播种）。
- **零新 calc\* 调用**：事件列表是纯输入面，引擎读数仍由 LifeTrajectoryCard 唯一 hook 消费（finance.ts 调用面不增——见 §5.4）。
- 校验：§1.5-1（endAge ≥ age 拒绝、20 条上限、LIMITS 钳制）。

### 5.3 `src/components/TaskPages.tsx`

- LIFE_GROUPS 6 → **7 组**（现状 :35-42 实读：trajectory/accumulation/pension/loan/rental/tax）：首组后插 `{ id: "events", labelKey: "life.eventsTitle", node: <LifeEventEditor /> }`（第 2 位）——**有意变更登记**（理由：新输入面）；分段控件 Radio.Group 语义、hidden 非卸载、首展挂载（:44-58 visited 集）、跨组保活全部不动。

### 5.4 `src/components/LifeTrajectoryCard.tsx`

- `useFinanceCall` deps 数组加 `lifeEvents` 一项（:51 现状六项 → 七项；LifeEventEditor 写 store 即触发重算，**hook 调用数 9 处不变、无新 calc\* 调用**）。
- Descriptions 新增两行购买力读数（插在「确定性期末资产」行之后、存续双指标行之前）：达标率行 label = `life.ppMetLabel`（插值 withdrawalYears）、值 = metShare ≥ 0 百分比 / metShare = −1 时 `life.ppNotMeasured`；缺口行 = money(cumulativeGap)，域空时同显 `life.ppNotMeasured`（哨兵统一呈现——呈现裁定：域空缺口 0 以「未度量」文案承载，不以 ¥0.00 冒充无缺口）。
- 事件标记轴 aria 汇总行扩展（:173-184 现状仅 pensionStart）：新增一容器 role="img"，aria-label 遍历 `timeline[].events` 生成逐事件文案（`life.eventMark*` 模板：kind ＋ year；金额不进 aria 汇总行——逐年面板 withdrawal 读数已承载，避免 aria 冗长）；pensionStart 既有块不动。
- caliberTooltip（:188-192 既有 tooltip）内容键值增句：事件双轨口径（§1.5 口径注）＋ survival 分叉句（§2.2-4）——**既有键值有意变更**（非新键），见 §10。

### 5.5 `src/components/lens/LifeLensTrack.tsx`

- 透镜轨标记扩展（现状三件套 :120-140：养老金实心点 / FI 空心点 / 耗尽 fall 色竖线）：homePurchase = 实心菱形（单年）、childBirth = 区间带（出生 → ＋17 行）、healthPhase = 区间带（起 → 止，第二纹理/双高变体区分）——**新增形状 ≤3**，全部 aria-hidden，形状通道独立于颜色（S10 同构纪律延续）；区间带 = 对 timeline 按 kind 提取连续段（段断裂即分段渲染）。
- 事件密度防线：区间带数量受 `events.length ≤ 20` 上限自然受限；重叠区间（多孩/多医疗段）纵向错位不裁剪——若实现发现重叠视觉不可辨，**降级为「区间带合并 ＋ Tag 计数」并如实登记**，不得引入新动效。
- 逐年读数面板加事件 Tag 行：选中行 `row.events[]` 渲染小 Tag（`life.eventMark*` 文案；pensionStart Tag 先例 :176）。

### 5.6 `src/components/advanced/ScenarioPanel.tsx`

- **情景对比基准列（wf06 初用者 F4：对比表缺「当前参数」基准列，wf06-report.md:102）＝ 伪情景列最小侵入**：对比表列首插入「当前参数」列——构造 `pseudoEntry = { id: "__base__", name: t("scenario.baseColName"), payload: encodeShareState(buildShareState()) }` 走**既有 computeColumn 全管线**（decode → 五确定性调用 → 八指标，ScenarioPanel.tsx:81-124）——零新计算路径、零新 calc\* 调用（computeColumn 内五调用不变）；失败列「—」语义同源（:100-109）。
- 重算触发：对比表 effect（:162-173 现状 deps `[entries, money, moneyFixed, t]`）扩入七切片 `baseline, accumulation, pension, monthsSynced, loan, rental, lifeEvents`（基准 payload 在 compute 时刻自 store.getState().buildShareState() 现取——伪条目不入 entries、不入情景库 localStorage）；基准列与其他列同表同步刷新；P9 额外成本 = 每次重算多一列的 5 个毫秒级确定性调用（「毫秒级 × ≤12」预算口径内，ScenarioPanel.tsx:5-6）。
- 导出位图自动携带基准列（buildScenarioTableBitmap 消费 cols，:274-295）——导出与屏显逐字符一致纪律不破。
- v5 联动：基准列 payload 经 buildShareState 携带当前事件 → 「含事件的当前参数 vs 存档情景」合法对比，不再静默丢事件；叠影图（:182-239）deps 同步扩 `lifeEvents`（叠加基准路径随事件重算），**叠影恒两线裁定不动**（:392-394 注释口径）。

### 5.7 i18n 三 locale（§10）＋ `src/data/defaults.ts`

- defaults.ts LIMITS 新增 `lifeEventAge: { min: 16, max: 120, step: 1, precision: 0 }` ＋ `salaryGrowthPct: { min: -100, max: 100, step: 0.1, precision: 1 }`（§1.2 / §2.1）；不动任何既有 LIMITS 条目。

---

## §6 share 裁定兑现（v4 → v5）

### 6.1 现状（实测引用）

- `SHARE_LINK_VERSION = 4`（share.ts:43）；ShareState 十一键零事件键（share.ts:52-65）；版本单点闸 `obj["v"] !== SHARE_LINK_VERSION`（share.ts:135）；载荷门禁 `MAX_PAYLOAD_CHARS = 8192`（share.ts:49）；「不做部分恢复——半套参数比默认值更危险」纪律（share.ts:12-13）；v4 增 sustainYears 同款「缺任一键 → 整体 null」（share.ts:235 注释）。
- 载荷实测（research-p9-events.md §4.1，node 实跑）：默认态 base64url 载荷 **1,844 字符** → 余量 6,348；事件编码均摊 ≈64 字符/条、空数组开销 16 字符、20 条最坏 payload ≈ **3,140 字符** 仍余 ≈5,052——**容量不是否决项**。

### 6.2 裁定（入载荷、版本 bump、events 必填键）

- **入载荷**：事件是业务输入切片（用户显式输入、改变计算结果）——不入载荷则分享/情景库发送方与接收方轨迹**静默失真**，违反「发送方所见 = 接收方所得」（useCalculatorStore.ts:297-298 注释口径）。
- **版本 bump v4 → v5**（share.ts:43）：ShareState 形状变更即递增（share.ts:31-43 定义与先例链）；存量 v4 链接与情景库**一次性失效**，延续 v1→v2→v3→v4 既有决策；版本单点闸自动承载，无迁移代码。
- **events 为必填键**：ShareState 新增第 12 键 `lifeEvents: LifeEventInput[]`；缺键 → 整体 null（禁止部分恢复）；空事件 = `[]`（默认态成本 16 字符）。**否决「可选键缺省补 []」**：strategy 缺省 "fixed"（share.ts:166）是枚举值缺省、不是切片级缺省——开「缺键容忍」口子会瓦解码总纪律。

### 6.3 编码与校验（逐条）

1. **全键编码**：`{"kind":"homePurchase","age":34,"amount":1200000}` 式全字段名——不引入短键映射层（映射层 = 新增编解码两端口径，违往返一致审计面）。
2. **label 不入载荷（硬红线）**：`btoa` 对非 Latin1 字符抛异常，share.ts:8-10 明文要求非 ASCII 值须先改造 TextEncoder——P9 **不启动改造**；label 定位 UI 本地态：store 切片保留、编码端剥除、解码端置缺省空串（「存而不传」字段，逐字登记）。
3. **decode 校验（P9 新增解码面）**：kind 三枚举命中否则 null（枚举校验同款 share.ts:247-249）；数值全 isNum（share.ts:72-74）；`amount/annualAmount ≥ 0`（负值损坏——`rate < 0` 先例 share.ts:256）；age 整数 ∈ [16, 120]；`endAge ∈ [age, 120]`；`events.length ≤ 20`（与 UI LIMITS 同值；防滥用思想同 MAX_PAYLOAD_CHARS）；id 非空 string；违反任一 → 整体 null。
4. **情景库自动兼容**：payload 整包保存/载入（scenarios.ts 契约）→ v5 事件随情景存档携带、载入经 applyShareState 整体恢复——**零新存储代码**；对比列/叠影的 calcLifecycle 入参自动携带事件（ ScenarioPanel 叠影情景入参由 decode 切片映射，:215-222）。

### 6.4 check-share 扩展断言组（新增，不改动既有六组）

- [ ] v4 载荷解码 → null（版本闸）；v5 往返恒等（encode→decode 逐键相等，含事件数组）；label 剥离断言（带 label 编码 → 载荷不含 label → 解码 label = ""）；20 条上限（21 条 → null）；`endAge < age` → null；负金额 → null；缺 events 键 → null；三语键集断言自动覆盖新键（既有断言 5 机制 check-share.mjs:207-242）。

---

## §7 回归红线（违反即返工）

1. **S1–S26 零回退**（design-language.md §2 锚点；抽查基线同 p7/p8 口径）：P9 只增新组件与新输入面，不改任何签名元素实现；新组件零新动效、零新视觉令牌、零新签名元素（design-language §5.1 本轮零申请）。
2. **D9 纯读数卡同构**：LifeTrajectoryCard 仍无输入控件（事件编辑器落在 events 组**新组件**，不入读数卡——p8-spec §5 红线 2 延伸；读数卡新增购买力读数为纯展示）；进度环/刻度环既有庆祝链路零触碰。
3. **aria 零回退**：`check:a11y` 对清单 63 组零回退（WF-06 收口值）；透镜 ≤3 新形状全部 aria-hidden、读法由轨 aria-valuetext（LifeLensTrack.tsx:57-60）＋ 事件轴 aria 汇总行承载（§5.4）；新读数经 money() 后 aria 文案与既有面板同构。
4. **方案 B 导航零回退**：专业模式三组九面板整壳零改动；life 页组数 6 → 7 为**本轮有意变更**（登记：TaskPages.tsx LIFE_GROUPS 首组后插 events 组）——分段控件语义、hidden 非卸载、首展挂载、跨组保活零变化；数字键分域不动（1–4 任务 / 5 专业），events 组不绑数字键。
5. **字节锁（wasm 零触面）**：`src/wasm/src/*.rs` 与 `src/wasm/bridge.ts` **逐字节不动**（收口时 `git diff --stat -- src/wasm` 须全空）；pass1/pass2 流序锁区、三不变 (a)(b)(c)、可复现性铁律结构性保持；`accum.seed / paths` 仍仅透传双指标调用（零随机流新消费）；**既有 75 项测试零变化**（§4.2）。
6. **threshold / percent 语义零变化**：withdrawal.rs:161-188 / :227-264 逐行不动；T8 锚点全绿（668,802.18 等）。
7. **公式与数据流不碰**：递推式（finance.ts:761）、三阶段划分（:754-759）、FI 判定（:789-795）、耗尽语义（:762-767）、错误聚合（:875-885）逐字不动——P9 增量恰三处内聚：事件流入 withdrawal 累加、储蓄 g 分支（§2.2-1 关闭分支 = 原路径）、派生字段（realWithdrawal ＋ purchasingPower）。
8. **零自动播种红线**：`lifeEvents` 写入路径白名单恰五处（§1.5）；grep 全仓无白名单外写入；无示例事件、无演示数据。
9. **不装新依赖**：package.json dependencies / devDependencies 零增量（esbuild / node:assert / 既有组件库复用）。
10. **禁词零命中**：`apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid` 在本文档与全部新增/改动文件零命中（排除模式字面量自身；本会话对本文档已扫描，附 A-5）。

---

## §8 尺寸预算（原始字节；门禁数值不放宽——P5 既定裁定）

### 8.1 现状实测（本会话实跑）

| 项 | 实测 | 门禁（check-size.mjs） | 余量 |
|---|---|---|---|
| wasm 单文件 | **356,864 B**（`WASM_MAX_KB=349`） | 800,000 B | 443,136 B |
| dist 全部文件总和 | **1,984,528 B**（`DIST_TOTAL_KB=1939`） | 2,000,000 B | **15,472 B，紧张** |

> wasm 较 p8-spec 收口记录（387,792 B）下降系 d680c3f optimize-wasm 固化进 build 链的回收成果；本规范以当前实测为准。**余量 15,472 B ＜ 本轮预算上限 25 KB → 回收令为实施第一步（§8.3），先回收后写码。**

### 8.2 增量估算（§5 改动面推导；wasm 零触面）

| 来源 | 估算（原始字节，上限计盘） | 说明 |
|---|---|---|
| wasm | **+0** | 零 Rust 改动（§7 红线 5）；缓冲行见 §8.3 |
| finance.ts 引擎（事件装配 ＋ g 分支 ＋ realWithdrawal ＋ derivePurchasingPower ＋ 类型扩展） | +4.0 KB | 内聚增量，不复制既有逻辑 |
| share.ts v5（events 编解码 ＋ 校验面） | +2.5 KB | §6.3 |
| store 切片 ＋ 三动作 ＋ share 接线 | +1.5 KB | §5.1 |
| LifeEventEditor.tsx（新） | +4.5 KB | 列表 ＋ 表单 ＋ 校验 |
| LifeTrajectoryCard（购买力两行 ＋ 事件轴 aria） | +1.5 KB | §5.4 |
| LifeLensTrack（≤3 形状 ＋ Tag 行） | +1.5 KB | §5.5 |
| ScenarioPanel（基准列 ＋ deps 扩展） | +1.2 KB | §5.6 |
| TaskPages ＋ defaults.ts LIMITS ＋ 其他 | +0.6 KB | 组插入 ＋ 两 LIMITS 条目 |
| CSS（菱形/区间带/双高变体类，复用既有令牌零新主题组键） | +1.0 KB | §5.5 |
| i18n 三语（§10） | +5.5 KB | 新键 22 ×3 ＋ caliberTooltip 增句 ×3 |
| **合计** | **≤ 25 KB（上限计盘 ≈ +23.8 KB）** | 算术闭合：4.0+2.5+1.5+4.5+1.5+1.5+1.2+0.6+1.0+5.5 = 23.8——上限 25 KB 内留 1.2 KB 二次容错 |

### 8.3 预算硬线与回收强制令（实施顺序前置）

- [ ] **wasm 硬线**：本轮 wasm 预期增量 **+0**；任何 wasm 增量出现（含工具链波动重打包）超 +30 KB 缓冲（356,864 ＋ 30,720 ＝ 387,584 B 以内不触发）即返工重审，**门禁 800,000 B 不放宽**。
- [ ] **dist 硬线**：`npm run build && npm run check:size` exit 0（≤ 2,000,000 B）。
- [ ] **实施第一步（写码前）执行回收盘点**（p7/p8 §6.3 同款顺序）：(a) i18n 键并合复审（§10 上限 22、能并尽并）；(b) CSS 复用审计（零新令牌、零新主题组键）；(c) dist 资产清单可压缩项排查。
- [ ] **回收不足时的处置顺序**：i18n 并合（`life.eventEdit`/`life.eventDelete` 优先并合为图标按钮去文案化候选）→ 裁展示项（候选序：购买力缺口行并入达标率行副文案 → 事件轴 Tag 行降级为纯 aria 文本 → 区间带第二纹理变体合并为单纹理），**门禁数值与 wasm 门禁不放宽、不特批**。

---

## §9 验收条件（可操作断言；全过才收口）

- [ ] **① 既有零变化基线**：`cd src/wasm && cargo test` → 15 ＋ 60 = 75 全绿同名同值；`npm run check:lifecycle` → L1–L6 全过且六组断言区段零 diff（g = 0 逐位回归的承载，§4.2）。
- [ ] **② 新算例全绿**：`npm run check:lifecycle` → L7–L13 七组全过（§4.1 关键锚逐项断言，容差 ±0.01；性能预算 50 ms 维持——单次 calcLifecycle 含事件装配实测值写入验收记录）。
- [ ] **③ 收入增长分叉与回归**：L10 断言 g=4% 全链（储蓄式/期末/fiFirstYear 14→11/停工即止/目标族不变）；关闭分支（缺省 opts）输出与 L1–L6 基线逐字节一致；`life.caliberTooltip` 三语键值含「存续双指标为静态储蓄口径，不含收入增长」句。
- [ ] **④ 购买力指标**：L11 断言组全过——fiFirstYear = 19 与行 13 名义错觉硬断言；derivePurchasingPower 三变体（恒值域 metShare 1/0 ＋ gap 164,800 ＋ 域空哨兵 −1）；读数卡走查两行购买力读数与引擎输出一致（同屏对比 console）。
- [ ] **⑤ share v5**：§6.4 扩展断言组全过（v4 null / v5 往返恒等 / label 剥离 / 20 上限 / endAge ≥ age / 负金额 null / 缺键 null）；`npm run check:share` exit 0。
- [ ] **⑥ 零播种**：grep 全仓 `lifeEvents` 写入路径恰五处白名单（§1.5）；UI 四路径走查（冷启动 / applyPreset / clearPreset / resetAll）后事件列表恒空；空态指路文案在位、无代填。
- [ ] **⑦ 事件编辑器 UI 走查**：增删改走查（三 kind 各一条 → 改 age/amount → 删除）；endAge < age 被拒；21 条被拒；金额经 money() 币种换算（切展示币种后同步）。
- [ ] **⑧ 透镜与读数面板走查**：≤3 新形状渲染、全部 aria-hidden；逐年面板选中行事件 Tag 在位；重叠区间渲染或降级（降级须登记）；事件轴 aria 汇总行逐事件文案可听读。
- [ ] **⑨ 基准列（F4 复验）**：对比表列首「当前参数」列与手动修改参数同值刷新；导出位图含基准列且与屏显逐字符一致；伪条目不入情景库 localStorage。
- [ ] **⑩ 三语零裸键**：三 locale 键集一致（check:share 断言 5 自动覆盖新键）；三语各走查一遍无裸键渲染；新键值非机翻占位。
- [ ] **⑪ aria 与对比度门禁**：`npm run check:a11y` exit 0（63 组零回退）。
- [ ] **⑫ 尺寸与门禁**：`npm run build && npm run check:size` exit 0；wasm ≤ 387,584 B（§8.3 缓冲线）且预期 +0；dist ≤ 2,000,000 B；净增 ≤ 25 KB 且回收盘点执行记录在位（净增 ＞ 实施时余量时回收差额的登记）。
- [ ] **⑬ 字节锁与调用面**：`git diff --stat -- src/wasm` 全空（含 bridge.ts）；calc\* 调用面零新增（hook 9 处、直接调用处数以 WF-06 收口值为基线零变化，grep 核对登记）；`check:currency` / `check:data` exit 0。
- [ ] **⑭ 禁词零命中**：§7-10 模式对本文档 ＋ 全部新增/改动文件 ＋ 三 locale 复扫 → 排除模式字面量自身后零命中。

---

## §10 i18n 三语键预算（新键 22 ×3 语；既有键值有意变更 1 键 ×3 语）

| # | 键 | 简体值（定稿基准） | 说明 |
|---|---|---|---|
| 1 | `life.eventsTitle` | 「人生事件」 | events 组标签（TaskPages 分段） |
| 2 | `life.eventsEmpty` | 「还没有人生事件——添加第一条，购房、育儿或医疗阶段将在时间线中生效」 | 空态指路（零播种，不代填） |
| 3 | `life.eventAdd` | 「添加事件」 | 添加按钮 |
| 4 | `life.eventCount` | 「{{count}} / 20」 | 条数计数 |
| 5 | `life.eventKindHome` | 「购房」 | kind 标签/选项 |
| 6 | `life.eventKindChild` | 「育儿」 | 同上 |
| 7 | `life.eventKindHealth` | 「医疗阶段」 | 同上 |
| 8 | `life.eventAge` | 「发生年龄」 | 表单标签 |
| 9 | `life.eventEndAge` | 「结束年龄」 | 表单标签（仅医疗） |
| 10 | `life.eventAmount` | 「金额（按当前物价）」 | 表单标签（仅购房）——基期名义白话化 |
| 11 | `life.eventAnnualAmount` | 「每年金额（按当前物价）」 | 表单标签（仅医疗） |
| 12 | `life.eventEndAgeError` | 「结束年龄不能早于发生年龄」 | 表单校验文案 |
| 13 | `life.eventEdit` | 「编辑」 | 行操作 |
| 14 | `life.eventDelete` | 「删除」 | 行操作 |
| 15 | `life.eventMarkHome` | 「第 {{year}} 年购房」 | 行级 Tag / aria 文案 |
| 16 | `life.eventMarkChild` | 「第 {{year}} 年 · 育儿支出」 | 同上 |
| 17 | `life.eventMarkHealth` | 「第 {{year}} 年 · 医疗支出」 | 同上 |
| 18 | `life.ppMetLabel` | 「购买力达标率（{{count}} 个支取年）」 | 读数卡新行（插值 withdrawalYears） |
| 19 | `life.ppGapLabel` | 「购买力累计缺口（按当前物价）」 | 读数卡新行 |
| 20 | `life.ppNotMeasured` | 「未度量」 | 哨兵 −1 呈现（两行共用） |
| 21 | `scenario.baseColName` | 「当前参数」 | 对比表基准列列名（F4） |
| 22 | `life.eventsAxisLabel` | 「人生事件标记」 | 事件轴 aria 容器标题 |

**既有键值有意变更（非新键，登记）**：`life.caliberTooltip` ×3 语尾部增两句——「人生事件只作用于下方时间线，基础参数卡的一次性预留只作用于 480 临界值，两者独立、不自动抵扣；存续双指标为静态储蓄口径，不含收入增长。」（≈ +120 字 ×3 ≈ +0.8 KB，已计入 §8.2 i18n 行）。`life.caliberNote`（≤2 行卡尾 caption）**不动**。

**字节预算**：22 新键 ×3 语 ≈ +4.5 KB（键名平均 ~22 B ＋ 值平均 ~40 B，en 略长）＋ caliberTooltip 增句 ≈ +0.8 KB ≈ **+5.3 KB**（§8.2 按 +5.5 KB 计盘）；插值走 i18next 既有 `{{var}}` 先例（life.pensionStartAt 同款）。键集一致性由 check:share 断言 5 自动覆盖（check-share.mjs:207-242 机制）。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令 / 方法 | 结果 |
|---|---|---|---|
| A-1 | Rust 基线 | `cd src/wasm && cargo test` | `running 15 tests…15 passed; 0 failed` ＋ `running 60 tests…60 passed; 0 failed` = **75 全绿**（§4.2 基线） |
| A-2 | 引擎断言基线 | `npm run check:lifecycle` | **L1–L6 全部通过**（性能实测 30.00 ms ≤ 50 ms） |
| A-3 | 算例锚点独立复算 | `node -e`（11 锚点：①P₅、②行 3、③行 10/15、④g=4% 行 1 两式、⑤R₁₉/A₁₹/gap 变体、⑥行 5/行 10、⑦行 3/行 20） | **11/11 命中**（①1,324,896.96 / ②31,836.24 / ③36,569.83·40,376.05 / ④65,239.20·被否式 63,775.30 / ⑤R₁₉ 1,642,280·A₁₉ 2,392,491.85·gap 164,800 / ⑥1,358,019.39·73,139.67 / ⑦69,912.38·97,894.21）；全行级期望仍以 research-p9-cases 附录 A 双路推导为真值口径（最大差 ≤ 9.3×10⁻⁹），本会话抽样不复算全表 |
| A-4 | 尺寸门禁 | `node scripts/check-size.mjs` ＋ find/stat 递归求和 | `DIST_TOTAL_KB=1939`、`WASM_MAX_KB=349`、门禁通过；dist **1,984,528 B**（余量 15,472 B）、wasm **356,864 B**（§8.1） |
| A-5 | 禁词扫描 | `grep -rniE "apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid" docs/p9-spec.md` | 命中仅 §7-10 的模式字面量自身；排除后零命中 |
| A-6 | 源码锚点复核 | 本会话 Read 直读 | finance.ts:540-895（契约/纯函数/编排）、share.ts 全文（v4 编解码）、useCalculatorStore.ts 全文（切片/buildShareState/applyShareState/reset）、LifeTrajectoryCard.tsx、lens/LifeLensTrack.tsx、advanced/ScenarioPanel.tsx、TaskPages.tsx:35-58、defaults.ts:30-208（LIMITS/DEFAULTS）、insights.ts:146-177（育儿 53.8 万/医疗 2024 价）、scenarios.ts:96（id 生成）、check-lifecycle.mjs（L1–L6）、check-share.mjs:207-242（键集断言）、bridge.ts:53-64（BaselineInput）、wf06-report.md:102-104（F4/F5/F6）——全部与本规范引用一致 |
| A-7 | 未跑项如实声明 | — | check 脚本扩展（L7–L13 / v5 组）未在本会话编写/执行（规范起草阶段无代码变更）；UI 走查、三语走查未做（实施轮动作）；research-p9-cases 附录 A 的排列不变性/闭式双路复算未在本会话重跑（以研究文档登记为准，本会话仅抽样 11 锚） |
| A-8 | 契约字段数勾稽 | §1.2/§1.3/§2.1/§3.2 逐块累计 | LifecycleInput 41 → **43**（＋lifeEvents 1 ＋ opts 1）；YearRow 8 → **9**（＋realWithdrawal）；summary 10 → **13**（＋purchasingPower 3）；**主契约 59 → 65，净增 ＋6**。子契约另计：LifeEventInput 每条必载 **6** 字段（id/kind/age 公共 3 ＋ homePurchase.amount 1 ＋ healthPhase.endAge/annualAmount 2；label 可选不入载荷另计）；LifecycleOpts 子块 **2** 字段；TimelineArgs 11 → **14**（＋salaryGrowthPct/childAnnualCost/lifeEvents） |

---

## 实施结果与收口记录（文档收口会话复测登记，2026-11-23）

> 登记性质：p7/p8-spec「实施结果与收口记录」同款结构——实施落地入库后由文档收口会话**独立复跑门禁**后登记。本节数字全部为本会话实跑/实读取证（命令与读数随条目给出），不转抄实施会话自述；无法在本会话验证的事实（人工走查类）如实登记为未跑，不虚报。

### A. 改动文件清单（`git diff --numstat` ＋ `git status --porcelain` 实录；15 改 ＋ 4 新）

- **引擎**：`src/services/finance.ts`（+218 −27——`LifeEventInput`（:561）/`LifecycleOpts`（:571）/`PurchasingPowerSummary`（:682）类型 ＋ `CHILD_COST_YEARS = 18`（:548）＋ YearRow 增 `realWithdrawal`（:666）＋ summary 增 `purchasingPower`（:712）＋ `derivePurchasingPower` 纯函数（:956）＋ `assembleTimeline` 事件装配与储蓄 g 分支内聚增量——§1/§2/§3 契约全数在位；递推式/三阶段/FI 判定/耗尽语义/错误聚合逐字不动（§7 红线 7）。
- **share v5**：`src/services/share.ts`（+65 −5——`SHARE_LINK_VERSION = 5`（:53）、`lifeEvents` 必填键编解码（:128 编码含 label 剥离 :130、:272-296 decode 校验面））。
- **store**：`src/store/useCalculatorStore.ts`（+26 −0——`lifeEvents` 切片 ＋ 三动作（:265-272）＋ `applyShareState`/`buildShareState` 接线（:313/:337））。
- **组件**：`src/components/LifeEventEditor.tsx`（**新文件**，205 行——事件列表 ＋ 表单 ＋ 校验（`LIMITS.lifeEventAge`/`LIMITS.amount`、`endAge ≥ age` 拒绝、20 条上限），零新 calc\* 调用）；`LifeTrajectoryCard.tsx`（+63 −3——deps 六 → 七切片、购买力两行读数、事件轴 aria 汇总行）；`TaskPages.tsx`（+10 −6——LIFE_GROUPS 6 → **7**，events 组第 2 位；分段语义/hidden 非卸载/首展挂载不动）；`lens/LifeLensTrack.tsx`（+53 −0——事件三形状：实心菱形 ＋ 育儿/医疗区间带（`bandSegs` 连续段提取），全部 aria-hidden）；`advanced/ScenarioPanel.tsx`（+41 −15——「当前参数」基准伪列（`__base__` 走 computeColumn 既有全管线、不入情景库）＋ effect deps 扩七切片 ＋ 叠影 deps 同步）。
- **数据/类型/样式**：`src/data/defaults.ts`（+6——LIMITS 增 `lifeEventAge`/`salaryGrowthPct` 两条件目，既有条目零改动）；`src/data/types.ts`（+4——`InputLimits` 接口同步声明，见 D-1）；`src/styles/global.css`（+26——`.wf-lens-diamond` ＋ 区间带双高变体类，全部引用既有令牌（`var(--wf-accent-teal)` 等）、零新令牌键、零动效）。
- **i18n**：`src/i18n/locales/{zh-CN,zh-Hant,en}.ts`（各 **22 新键** = life 组 21 ＋ scenario 组 `baseColName` 1；`life.caliberTooltip` ×3 语尾部增两句——三语键集一致性由门禁 3 承载，增句三语在位已逐一 grep 复核）。
- **工程与测试**：`scripts/check-lifecycle.mjs`（+461 −3——L7–L13 七组；−3 行为文件头注释两行 ＋ 汇总 console.log 一行，**L1–L6 断言区段零 diff**）；`scripts/check-share.mjs`（+114 −9——第 7 组 v5 事件断言组纯新增；−9 行见 D-4）；**package.json 零改动**（check 脚本沿用 P7/P8 既有接线，零新依赖——红线 9 兑现）。
- **规范输入三件随轮入库（本轮新增未跟踪文件）**：本文件 ＋ `docs/research-p9-cases.md` ＋ `docs/research-p9-events.md`。
- **不动清单实证（§7 红线 5）**：`git status --porcelain -- src/wasm` → 空、`git diff --stat -- src/wasm` → 空（**build 后复核仍空**）——`src/wasm/src/*.rs` 与 `bridge.ts` 逐字节未动。
- **调用面复核（§9⑬）**：`grep -rn "useFinanceCall(" src/components`（排除 hooks）→ **9 处 / 8 文件**（BasicCalculator 1、LifeTrajectoryCard 1、AccumulationPanel 2、Loan/Pension/Rental/Reverse/Tax 各 1）——与 P8 收口值一致，零新增。
- **零播种白名单复核（§1.5 / §9⑥）**：`lifeEvents` 写入路径恰五处——三动作（useCalculatorStore.ts:265-272）＋ `applyShareState`（:313）＋ `businessDefaults`（:180，恒空数组）；`applyPreset`（:208-220）/`clearPreset`（:229-241）函数体 Read 直读**零事件写入**。

### B. 新增测试登记

- **Rust 零新增零改动（§4.2 锁定兑现）**：`cd src/wasm && cargo test` 实跑 `running 15 tests…15 passed; 0 failed` ＋ `running 60 tests…60 passed; 0 failed`（doc-tests 0）= **75 全绿、同名同值**。
- **check-lifecycle.mjs：L7–L13 七组新增**——静态新增断言点 **127 处**（对 diff 新增行 grep 实数：`assert.*` 60 ＋ `ok()` 辅助 18 ＋ `near()` 数值断言 49，无重叠）；运行时 `ok()` 计数器自报「**断言 89 项 ＋ 逐行断言若干**」（L1–L6 基线 32 项 → **+57**）；循环逐行断言运行时另展开（L7② 两路径行 1–4/6–40 逐行、L7④ 变体 B 35 行全字段恒 0、L8① 成本 18 行支取式逐行等）。
- **check-share.mjs：第 7 组 v5 事件断言组纯新增**——静态新增断言点 **20 处**：v4 载荷 null（版本闸）/ v5 往返恒等（含事件数组逐键）/ label 剥离 / 21 条 null / `endAge < age` null / 负金额 null / 缺键 null；三语键集断言自动覆盖 22 新键。
- **性能预算实测（§9②）**：L5 基线 **29.66 ms ≤ 50 ms**；L12 含事件装配 **21.7 ms**（脚本计时输出）。

### C. 门禁终态（本会话实跑，全部 exit 0）

| # | 门禁 | 命令 | 实跑结果 |
|---|---|---|---|
| 1 | Rust 套件 | `cd src/wasm && cargo test` | **15 单元 + 60 集成 = 75 passed / 0 failed**（零变化锁定兑现） |
| 2 | 生命周期算例 | `npm run check:lifecycle` | **L1–L13 全部通过**（自报断言 89 项 ＋ 逐行展开；性能 29.66 ms / 事件装配 21.7 ms） |
| 3 | 分享契约 | `npm run check:share` | **七组断言全部通过**（v5 往返含事件数组 ＋ v4/v3 失效 ＋ label 剥离 ＋ 事件校验面 ＋ 三语键集一致） |
| 4 | 币种 | `npm run check:currency` | 五组样本断言全过 |
| 5 | 数据 | `npm run check:data` | 九组断言全过 |
| 6 | 对比度 | `npm run check:a11y` | **63 组令牌对，白名单外违规 0 处**（红线 3 兑现） |
| 7 | 尺寸 | `npm run build && npm run check:size` | `DIST_TOTAL_KB=1950`、`WASM_MAX_KB=349`、门禁通过（`tsc --noEmit` 含在 build 内先过）；dist 14 文件合计 **1,996,779 B**（排除部署快照 .git，check-size.mjs:38 同规则）、对 2,000,000 B 余量 **3,221 B**；wasm **356,873 B**、对 800,000 B 余量 443,127 B（§8.3 缓冲线 387,584 B 未触发，见 D-2） |
| 8 | 禁词（§7⑩ 同式） | `grep -rniE` 禁词模式对 docs/ ＋ README 双语 ＋ 全部新增/改动文件 ＋ 三 locale 复扫 | 命中仅 p7/p8/p9-spec 与 research-wf04-lens 各自登记行的模式字面量自身；**代码、locale、README、三件研究/规范文档正文零命中** |

### D. 实施偏差登记（对 §0/§5/§6.4/§8 的勘误与跟随；p8-spec D 同法如实登记）

1. **`src/data/types.ts` +4（§5.7 未单列）**：`InputLimits` 接口同步声明 `lifeEventAge`/`salaryGrowthPct`——与 defaults.ts 两条件目为同一改动的接口侧必要伴随，非语义偏差。
2. **wasm 较起草记录 +9 B**：356,864 B（§8.1 起草实测）→ **356,873 B**（本会话 build 后 dist 实测）；pkg wasm 为本地构建产物（不入库），Rust 源零 diff（红线 5 git 双空）为「零 Rust 改动」的结构证据；§8.3 缓冲线（387,584 B）未触发、门禁 800,000 B 不变。
3. **dist 净增 +15,990 B ≤ §8.2 预算 25 KB**：对 WF-04 收口基线 1,980,789 B（design-atlas-brief §六）实测 1,996,779 B；**余量收紧至 3,221 B（无二次容错）**——下一轮任何新增字面前须先按 §8.3 处置顺序回收。实施轮未触发差额回收（门禁绿）。
4. **check-share 断言 0 期望值 4 → 5（§6.4「不改动既有六组」的字面跟随）**：版本闸随 §6.2 v4 → v5 bump 事实性更新（「版本常量 = 当前版本」语义不变）；另两处 −diff 为夹具注释与汇总行注释性文字——**v4 往返 / v3 失效 / inflation_uplift / 三语键集四组断言本体零改动**。

### E. 验收轮次

1. **规范轮**：起草会话完成附 A 自检（A-1~A-8 在库，含 11 锚点抽样复算全命中与 E1–E10 修正登记）；独立复核轮次无在库留痕，不虚报。
2. **实施轮**：实施落地在库（§A 清单即证据）；实施会话自身的门禁执行无在库记录——**本节 C 表为本会话独立复跑的终态证据**，以复跑为准。
3. **文档收口轮（本节）**：§9 可自动断言项 **①②③⑤⑪⑫⑬⑭** 经 C 表门禁 1–8 覆盖全绿（⑬ 的 wasm 字节锁以 `git status/diff -- src/wasm` 双空承载、含 build 后复核；③ 的三语增句逐一 grep 在位）；**④⑥ 部分覆盖**（L11 引擎断言与零播种白名单 grep 已过，运行时走查未跑）；**④⑥⑦⑧⑨⑩ 的运行时 UI 走查部分未跑**（见 F）。

### F. 残留（收口后仍存在的事实，如实登记）

1. **§9⑦ 事件编辑器 UI 手工走查未跑**：增删改走查（三 kind 各一条 → 改参 → 删除）、`endAge < age` 拒绝、21 条被拒、切币种同步——无运行时浏览器取证；代码层佐证在位（LifeEventEditor.tsx:11-13 校验面、:173 `LIMITS.lifeEventAge`、:68-70/:121-122/:145 三动作接线）。**留待下一验收轮或 WF-05 全矩阵验证**。
2. **§9⑧ 透镜与逐年面板人工走查未跑**：代码层佐证（LifeLensTrack 事件形状全部 aria-hidden、区间带双高变体 12px/5px；读数卡事件轴 aria 汇总行在位）——运行时目检移交同上。
3. **§9④「读数卡同屏 console 对比」与 §9⑨ 基准列运行时复验未跑**：购买力读数引擎侧锚已由 L11 断言组承载（metShare 1/0/−1、gap 164,800 全过）；基准列代码在位（ScenarioPanel `__base__` 伪条目走 computeColumn 全管线），屏显/导出一致性属运行时目检，移交同上。
4. **§9⑥ 后半「UI 四路径走查」与 §9⑩「三语无裸键渲染」目检未跑**：三语键集一致性由门禁 3 承载（过）；目检移交同上。
5. **尺寸余量 3,221 B（紧张）**：见 D-3——§8.3 处置顺序在位，未触发（门禁绿）。
6. **§0.2 排除项按裁定顺延**：购房贷款分期（`loan` 维持仅类型承载）、教育/医疗双通胀族、⑦-b 交叠变体、编辑器拖拽排序、越界窗口提示 UI、随机面新消费、TextEncoder 编码改造——全部不在本轮、无回填。
7. **实施会话双验收循环的轮次/finding 计数**：属工作流运行时状态、仓库无留痕，不虚报（p8-spec F-5 同口径）。
