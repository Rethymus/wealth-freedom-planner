# P9 研究纪要：人生事件契约——显式事件化施工 · 收入增长 · 购买力指标 · share 裁定 · 前端消费

| 项目 | 说明 |
|---|---|
| 文档性质 | 研究纪要：P9 轮（人生事件化施工，p8-spec §0.2 排除项落地）的契约草案与裁定建议。供实施规范（p9-spec）逐条采纳；每处结论附「现状实测引用」 |
| 实证输入 | `src/services/finance.ts`（calcLifecycle 编排 + assembleTimeline / deriveTimelineSummary 纯函数，本会话全文精读）；`docs/p8-spec.md`（§0.2 排除清单、§1 契约 59 字段、§2.1 零随机裁定）；`src/store/useCalculatorStore.ts`（切片与 buildShareState）；`src/services/share.ts`（v4 编解码全文）；`src/components/LifeTrajectoryCard.tsx` / `lens/LifeLensTrack.tsx` / `advanced/ScenarioPanel.tsx`；`docs/wf06-report.md`（F4/F5/F6 findings）；`src/wasm/bridge.ts` / `src/data/defaults.ts`（字段域实测） |
| 实测补充 | 本会话 node 实跑载荷尺寸测量（§4）：默认态 base64url 载荷 **1,844 字符** / 门禁 8,192（share.ts:49）→ 余量 6,348；全键编码单事件均摊 ≈64 字符、空数组开销 16 字符、20 条最坏 payload ≈ 3,140 字符 |
| 宪法关系 | 零随机流新消费（p8-spec §2.1 定稿延续）；bridge.ts 与 `src/wasm/src/*.rs` 逐字节不动（p8-spec §5 红线 6）；S1–S26 零回退；事件**显式增删改、零自动播种**（wf06 F5 教训成文，§1.4） |

---

## §1 事件 schema：三事件族 · 年龄锚 · 显式增删改 · 零自动播种

### 1.1 现状（实测引用）

- P8 只做形状预留：`LifecycleEventTag` 四成员（finance.ts:582-586），`events` 字段**恒空数组**——`assembleTimeline` 每行硬编码 `events: []`（finance.ts:740/:764/:769），全仓零生产者、零消费者；唯一施工标记走 `YearRow.pensionStart` 布尔（finance.ts:760）。
- 一次性预留的既有承载：`base.majorInvestment / base.healthReserve / childCount × costPerChild`（bridge.ts:53-68）只进 calculate_baseline 乘数族（bridge.ts:111-114 criticalValue 公式），**单次计入**，与时间线无关（p8-spec §0.2 原口径）。
- P9 开工即把「恒空」变「有值」：`LifecycleEventTag` 是全仓唯一既定形状锚，但 homePurchase/childBirth/healthPhase 三成员只有 year 无金额/区间（finance.ts:583-586），不足以承载「购房（年+金额）/ 育儿（出生年→成本起止年）/ 医疗（起止年+金额）」。

### 1.2 目标 schema（P9 契约草案）

事件输入以**年龄锚**存储（非相对年序 t）：用户改 `currentAge` 后「37 岁买房」语义不漂移，t 在引擎入口重推。`id` 生成复用 scenarios.ts:96 先例（`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`）。

```ts
/** 事件输入切片（store 新增 lifeEvents: LifeEventInput[]；P9 新契约，不进 bridge.ts） */
export type LifeEventInput =
  | { id: string; kind: "homePurchase"; age: number; amount: number }
  | { id: string; kind: "childBirth"; age: number }                     // 出生锚；成本起止年派生（§1.3）
  | { id: string; kind: "healthPhase"; age: number; endAge: number;
      annualAmount: number; label?: string };                           // label 仅 UI 本地态，不入 share（§4.3）

/** 时间线行内标记（YearRow.events 元素；finance.ts:582-586 预留形状的施工化替换） */
export type LifecycleEventTag =
  | { kind: "pensionStart"; year: number }
  | { kind: "homePurchase"; year: number; amount: number }              // 预留形状 +amount（零消费者，无迁移面）
  | { kind: "childBirth"; year: number; annualCost: number }
  | { kind: "healthPhase"; year: number; annualCost: number };          // 行级展开：逐年一条，起止由行序承载
```

形状变更裁定：`homePurchase` 预留形状加 `amount`、`healthPhase` 弃 `phase: string` 改数值化——依据是 events[] 当前**零消费者**（finance.ts:740/:764/:769 硬编码空数组），P8 预留即声明「施工归 WF-04+」（finance.ts:578-581 注释），形状定稿权在施工轮；此举不触碰任何既有输出字段，share v4 载荷本就零事件键（§4.1）。

### 1.3 引擎消费口径（递推点与派生规则）

| 事件 | 输入 → 行定位 | 现金流消费点（assembleTimeline 内） |
|---|---|---|
| 购房 | `age` → t = age − currentAge + 1（钳 [1, horizon]；越界事件**存而不用**，行级不可见） | 该行 `withdrawal += amount`（一次性支取，全款口径；`loan` 年供款口径维持 LifecycleInput.loan 类型承载预留 finance.ts:572-575，不在本轮启用） |
| 育儿 | 出生锚 `age` → 成本起止行 [t, t+CHILD_COST_YEARS−1]；`CHILD_COST_YEARS = 18` 与 bridge.ts:58-59「0–18 岁累计口径由数据层定义」同源（0–17 岁行首覆盖 18 行）；逐年成本 = `base.costPerChild ÷ 18` | 区间内各行 `withdrawal += annualCost`；单一事实来源 = base.costPerChild，事件体不存金额（改抚养成本全局联动） |
| 医疗 | `age..endAge` → 行区间（endAge < age 的输入在 UI 校验拒绝，LIMITS 新增域见 §2.3 同族） | 区间内各行 `withdrawal += annualAmount`（名义恒额，随通胀**不上调**——与养老金恒额口径 p8-spec §0.2 同族，如实登记） |

- 消费语义与三阶段正交：事件金额**加在**既有 withdrawal 之上（递推式不变：closing = opening×(1+r_t) + contribution − withdrawal，finance.ts:761），不改变工作段/桥接段/领取段划分（finance.ts:754-759）；耗尽行/耗尽后恒零语义原样生效（finance.ts:732-744/:762-767）。
- 购买力派生（§3）与事件行标记（YearRow.events 填充：该行被消费的事件逐条入 `events`，形状即 §1.2 行级标记）都在 `assembleTimeline` **同一循环**内完成，不另立第二遍历。
- 确定性保持：事件是纯数据输入，同输入恒同输出；`SampleProvider` 测试缝（finance.ts:665-666）原样可用，事件断言可经缝注入序列复算——**零随机流新消费**（p8-spec §2.1 裁定延续，accum.seed/paths 仍仅透传双指标调用 finance.ts:830-833）。

### 1.4 显式增删改 · 零自动播种（F5 教训成文）

- store 新增切片 `lifeEvents: LifeEventInput[]` 与三动作 `addLifeEvent / updateLifeEvent(id, patch) / removeLifeEvent(id)`；**初始值恒空数组**，不入 `businessDefaults()` 工厂外的任何播种路径（useCalculatorStore.ts:156-174 工厂清单不新增种子条目）。
- **零自动播种铁律**（wf06-report.md:103 初用者 F5「示例情景播种困惑」的机制化）：预设（applyPreset）、画像取消（clearPreset）、分享恢复（applyShareState 走 v5 载荷事件键，§4.2）、损坏回落（resetBusinessInputs → 空数组）之外的任何代码路径**禁止**写入事件；无示例事件、无演示数据、无「帮你填一条」——空态文案指路（「添加第一条人生事件」），不代填。
- resetAll / resetBusinessInputs 语义：事件属业务输入切片 → 回落空数组（useCalculatorStore.ts:322-333 既有二分口径）。
- 事件与 `base` 一次性预留**两族独立、互不迁移**：购房事件不抵扣 `base.majorInvestment`、育儿事件不联动 `base.childCount`——两族各进各的公式（乘数族 bridge.ts:111-114 vs 时间线 §1.3），口径注必须写明双轨（wf06-report.md:57-58 初用者 F6 教训：固定文案让人误以为已预留——隐式口径是误读根因，显式声明是 P9 的纪律）。

---

## §2 收入增长 salaryGrowthPct：可选 · 默认 0 · 只进储蓄基流

### 2.1 现状与落点

- 现状：月储蓄基流仅随通胀上行——`contribution = savingBase × cumInfl`（finance.ts:750-751，accumulation.rs:280 同式），无实际增长假设（p8-spec §0.2 明确排除「收入增长列」留待演进）。
- 落点裁定：**不进 `AccumulationInput`**（bridge.ts:472-500 属锁区邻接面，加字段即触碰 bridge.ts——p8-spec §5 红线 6 禁）。新字段挂 `LifecycleInput` 新增可选子对象：

```ts
/** P9 引擎选项（LifecycleInput 第 6 子块；全部可选、缺省 = 现状口径逐位一致） */
export interface LifecycleOpts {
  /** 年收入实际增长（百分点）；缺省/0 = 现状（储蓄只随通胀上行） */
  salaryGrowthPct?: number;
  /** 最低生活线（基期名义元/年）；缺省 = accum.monthlyExpense × 12（§3.2） */
  minLivingAnnual?: number;
}
// LifecycleInput：base 7 + accum 12 + pension 8 + loan 4 + rental 10 + events 1 + opts 1 = 43
```

### 2.2 复算口径（钉死，实施规范逐字采纳）

1. **只影响工作段储蓄基流**：`contribution_t = savingBase × cumInfl_t × g^t`，其中 `g = max(1 + salaryGrowthPct/100, 0)`（增长因子下限 0：g = 0 即停薪，储蓄归零；不照抄 −0.99 样本防御值——那是随机样本下限 finance.ts:542-543，g 是确定性参数，语义是「增长后收入非负」）。`t` 次幂与 cumInfl 同序（含当年，同 finance.ts:749-751 乘法序）。
2. **不影响的量（逐项登记）**：生活费基流 `expenseBase`（finance.ts:752，不引入生活方式联动）；三段划分与 withdrawal；FI 目标与判定（finance.ts:785-798）；养老金与桥接（estimate_pension 全链）；480 乘数族（bridge.ts:107-117 全不动）。
3. **随机面零触碰**：`simulate_accumulation` 的 pass1/pass2 不消费 salaryGrowthPct（σ/seed/流序锁区 accumulation.rs:215-267，p8-spec §2.2 表）——因此 `survival` 双指标（静态储蓄口径）与时间线（含增长口径）在 g > 0 时**必然分叉**，这必须写进 caliberTooltip：「存续双指标为静态储蓄口径，不含收入增长」（同 §2.4 双参数族注记先例 p8-spec:205-207，正交并行展示、不以一者静默替代另一者）。
4. 生产路径 `provider` 缺省不变（均值口径 finance.ts:718-723）；g 进入 `TimelineArgs` 新增字段 `salaryGrowthPct`（默认 0）——纯函数签名变更向后兼容（可选字段）。

### 2.3 输入域与校验（P9 新增校验面登记——打破「编排层零新校验」的边界在哪）

p8-spec §1.4「编排层零新校验」的前提是全部字段经既有 wasm 校验代理；`opts` 与 `lifeEvents` 是 TS 侧新输入、无 wasm 代理，**P9 必须自建校验**（如实登记为新校验面，不是违反）：

- `LIMITS.salaryGrowthPct = { min: -100, max: 100, step: 0.1, precision: 1 }`——对称域先例 = `strategyRealReturnPct`（defaults.ts:75-79 min −100；`LIMITS.percent` min 0.01 禁负无法承载）；负 100 = 停薪，引擎 g 钳 0。
- 事件域：`age/endAge` 走整数域新 LIMITS（[16, 120]，与 pension currentAge 上限 70 不同域、如实放宽并登记）；`amount/annualAmount` 走既有 `LIMITS.amount`（整数元，defaults.ts:47）；`endAge ≥ age` 由 UI 校验拒绝（decode 端同判，§4.3）。

---

## §3 购买力指标：退休期支取的基期购买力 · 达标率 · 累计缺口

### 3.1 现状

YearRow 八字段全是名义元（finance.ts:594-617）；通胀只在递推里上行（cumInfl，finance.ts:749），无任何实口径读数。既有实口径只存在于算例推导层（p8-spec §3.4 R_t = A_t/1.02^t），未落输出契约。

### 3.2 契约草案

1. **行级**：YearRow 新增 `realWithdrawal`（基期购买力元）＝ `withdrawal ÷ cumInfl_t`，在 assembleTimeline 同一 cumInfl 链内计算（**禁第二遍历/第二套 cumInfl**——D2 教训：判定层两套口径会另立审计面，p8-spec §3.7 D2；SampleProvider 注入序列下派生自动同源）。耗尽后零行恒 0（withdrawal 已恒 0，finance.ts:736-743）。YearRow 8 → **9 字段**。
2. **最低生活线**：`opts.minLivingAnnual`（基期名义元/年），缺省 = `accum.monthlyExpense × 12`（ask 指定「当前月开销 × 12」；当前月开销的双参数族归属=打工积累面板 monthlyExpense，p8-spec §2.4 注记同源，写进 caliberTooltip）。逐年比较在**基期域**进行：达标行 ⇔ `realWithdrawal_t ≥ minLivingAnnual`（两量同为基期元，无通胀折算歧义）。
3. **统计域**：停工后支取行——`t > workEnd` 且全精度未耗尽的行（耗尽后恒零行不计入分母）；工作段零支取行不计。域空（horizon ≤ workEnd，即从未停工）→ 哨兵 −1（「未度量」，yearsP5 = −1 同款哨兵家族 bridge.ts:521-530）。
4. **汇总**：summary 新增子对象（3 字段）：

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

   派生落点：新纯函数 `derivePurchasingPower(rows, minLivingAnnual, workEnd)`（零 wasm 依赖、与 deriveTimelineSummary 同层测试缝，finance.ts:785-798 先例）；展示层金额经 money() 币种换算（LifeTrajectoryCard.tsx:35 既有绑定）。summary 10 → **13 字段**。

---

## §4 share 裁定：事件数组**入 share v5 载荷**；label 不入载荷

### 4.1 现状与实测

- v4 键清单零事件键（share.ts:52-65 ShareState 十一键；p8-spec §5 红线 4「v4 零变化」在 P8 已兑现）。
- 本会话 node 实测（复刻 buildShareState 默认态 + defaults.ts 全部默认值）：base64url 载荷 **1,844 字符**，门禁 8,192（share.ts:49）→ 余量 **6,348**。事件编码实测（JSON → base64url 4/3 放大）：homePurchase 66 / childBirth 40 / healthPhase 86，均摊 ≈64 字符/条；`"events":[]` 空数组开销 16 字符；20 条混合事件最坏 payload ≈ **3,140 字符**，仍余 ≈5,052——**容量不是否决项**。

### 4.2 裁定：入载荷、v4 → v5、events 必填数组键

- **入**的理由：事件是业务输入切片（用户显式输入、改变计算结果），不入载荷则分享/情景库（payload 整包保存，scenarios.ts:4-5）发送方与接收方轨迹**静默失真**——违反「发送方所见 = 接收方所得」既有口径（useCalculatorStore.ts:297-298 验收 Q3-3 注释）。
- **版本 bump v4 → v5**（SHARE_LINK_VERSION share.ts:43）：ShareState 形状变更即递增（share.ts:31-32 定义）；存量 v4 链接与情景库一次性失效，延续 v1→v2→v3→v4 既有决策（share.ts:38-43 先例链）；`decodeShareState` 的 `obj["v"] !== SHARE_LINK_VERSION` 单点版本闸（share.ts:135）自动承载，无迁移代码。
- **events 为必填键**：缺键 → 整体 null（禁止部分恢复，share.ts:13 纪律；v4 增 sustainYears 同款「缺任一键 → 整体 null」share.ts:235 注释）。空事件 = `[]`（2 字符 + 键名），默认态成本 16 字符（实测 §4.1）。
- 否决「可选键缺省补 []」：`strategy` 缺省 "fixed" 先例（share.ts:166）是**枚举值缺省**，不是切片级缺省；给新切片开「缺键容忍」口子会瓦解「半套参数比默认值更危险」的解码总纪律（share.ts:12-13）。

### 4.3 编码与校验（逐条）

1. **全键编码**：`{"kind":"homePurchase","age":37,"amount":1500000}` 式全字段名——与载荷其余切片风格一致，不引入短键映射层（映射层 = 新增编解码两端口径，违往返一致审计面）。
2. **label 不入载荷（硬红线）**：`btoa` 对非 Latin1 字符抛 InvalidCharacterError，share.ts:8-10 明文「JSON 值全部为数值与 ASCII 枚举……若未来引入非 ASCII 值，必须先改造为 TextEncoder 编码」。中文 label 一旦入载荷即破 btoa 链——P9 **不启动 TextEncoder 改造**（收益不成比例），label 定位 UI 本地态：store 切片保留、编码端剥除、解码端置缺省空串。属「存而不传」字段，逐字登记。
3. 解码校验（P9 新增解码面）：kind 三枚举成员命中否则 null（share.ts:247-249 枚举校验同款）；数值全 isNum（share.ts:72-74）；`endAge ≥ age`、`events.length ≤ 20` 违反 → null（上限 20 与 UI LIMITS 同值；防滥用思想同 MAX_PAYLOAD_CHARS share.ts:48-49）。
4. 情景库自动兼容：payload 整包保存/载入（scenarios.ts:4-5）→ v5 事件随情景存档携带、载入经 applyShareState 整体恢复（useCalculatorStore.ts:272-295）——**零新存储代码**；对比列/叠影的 calcLifecycle 情景入参（ScenarioPanel.tsx:215-221）自动携带事件，零改动。

---

## §5 前端消费：事件列表 UI · 透镜轨标记扩展 · 情景对比基准列（F4）

### 5.1 人生轨迹事件列表 UI（显式增删改面）

- **落点 = life 页新组**，不是读数卡内：LifeTrajectoryCard 是 D9 纯读数卡、无输入控件（p8-spec §5 红线 2；P8.1 V-F1 后卡内仅剩 caption 触发器，LifeTrajectoryCard.tsx:74-75/:188-192）——增删改按钮进读数卡即破宪法。TaskPages LIFE_GROUPS 6 → 7 组（首组后插 `events` 组；分段控件语义、hidden 非卸载、首展挂载全部不动，p8-spec §4.2 同款有意变更登记）。
- 新组件 `LifeEventEditor.tsx`：列表 + 三动作（add/update/remove 直写 store）；每条事件行 = kind Tag + 年龄/金额读数 + 编辑/删除；金额经 money()；空态 =「添加第一条人生事件」指路文案（零播种，§1.4）。调用面：**零新 calc\* 调用**——事件列表是纯输入面，引擎读数仍由 LifeTrajectoryCard 唯一 hook 消费（finance.ts 调用面不增，LifeTrajectoryCard.tsx:42-53 deps 数组加 `lifeEvents` 一项即触发重算）。
- 口径注增量（caliberTooltip 尾句）：「人生事件只作用于下方时间线；基础参数卡的一次性预留只作用于 480 临界值，两者独立、不自动抵扣」（§1.4 双轨显式化，F6 教训）。

### 5.2 透镜轨事件标记扩展

- 现状标记三件套：养老金实心点 / FI 空心点 / 耗尽 fall 色竖线（LifeLensTrack.tsx:120-140），形状通道独立于颜色（S10 同构，LifeLensTrack.tsx:118-119 注释）。
- P9 扩展（形状通道续纪律）：homePurchase = 实心菱形（单年）；childBirth = 区间带（出生→+17 行）；healthPhase = 区间带（起→止，第二纹理/双高变体区分）——**新增形状 ≤3**，全部 aria-hidden、读法由轨 aria-valuetext（LifeLensTrack.tsx:57-60）+ 事件标记轴 aria 汇总行承载（LifeTrajectoryCard.tsx:173-184 同构扩展：汇总行遍历 `timeline[].events` 生成逐事件文案）。
- 逐年读数面板加事件 Tag 行：选中行 `row.events[]` 渲染（YearRow.events 自 P9 起非空，§1.3；面板既有 pensionStart Tag 先例 LifeLensTrack.tsx:176）。
- 事件密度防线：区间带渲染按 `events.length ≤ 20` 上限自然受限（§4.3-3）；重叠区间（多孩/多医疗段）纵向错位不裁剪——若实现发现重叠视觉不可辨，降级为「区间带合并 + Tag 计数」并如实登记，不得引入新动效。

### 5.3 情景对比基准列（wf06 初用者 F4：对比表缺「当前参数」基准列，wf06-report.md:102）

- **最小侵入方案 = 伪情景列**：对比表列首插入「当前参数」列——构造 `pseudoEntry = { id: "__base__", name: t("scenario.baseColName"), payload: encodeShareState(buildShareState()) }` 走**既有 computeColumn 全管线**（decode → 五确定性调用 → 八指标，ScenarioPanel.tsx:81-124）——零新计算路径、失败列「—」语义同源（ScenarioPanel.tsx:100-109）。
- 重算触发：六切片（含 lifeEvents）变更 + entries/语言/换算率变化（既有对比表 effect deps ScenarioPanel.tsx:161-173 同族扩一项）——基准列与其他列同表同步刷新；P9 额外成本 = 每次重算多一列的 5 个毫秒级确定性调用（ScenarioPanel.tsx:5-6 既有「毫秒级 × ≤12」预算口径内）。
- 导出位图自动携带基准列（buildScenarioTableBitmap 消费 cols，ScenarioPanel.tsx:274-290）——导出与屏显逐字符一致纪律不破。
- v5 联动：基准列 payload 经 buildShareState 携带当前事件（§4.2）→ 对比「含事件的当前参数 vs 存档情景」成为合法对比，不再静默丢事件。
- 不做（登记）：基准列不并入叠影图（恒两线裁定，ScenarioPanel.tsx:391-394 注释口径）；F4 修复属 UI 面增量，不要求引擎改动。

---

## §6 契约字段数勾稽与验收锚点（供 p9-spec 逐条采纳）

### 6.1 字段数

| 块 | P8 | P9 | 增量明细 |
|---|---|---|---|
| LifecycleInput | 41 | **43** | +events 1、+opts 1（salaryGrowthPct / minLivingAnnual 二字段合一子块） |
| YearRow | 8 | **9** | +realWithdrawal 1（装配层同链派生） |
| summary | 10 | **13** | +purchasingPower 3（withdrawalYears / metShare / cumulativeGap） |
| **主契约合计** | 59 | **65** | 净增 +6 |
| LifeEventInput（事件子契约，按条） | — | **6** | 公共 id/kind/age 3 + homePurchase amount 1 + healthPhase endAge/annualAmount 2（label 可选、不入载荷另计） |

### 6.2 验收锚点（草案，p9-spec 定稿用）

1. 零播种断言：冷启动 + applyPreset + clearPreset + resetAll 四路径后 `lifeEvents` 恒 `[]`（§1.4）。
2. 确定性断言：同输入（含事件）双跑 timeline 逐字节一致；SampleProvider 注入序列下事件行可手算闭合（§1.3）。
3. g = 0 逐位回归：缺省 opts 下全部输出与 P8 现状逐字节一致（「缺省 = 现状」的硬验收）。
4. 退休期购买力：手算算例（ withdrawal 全额生活费行 realWithdrawal = 35,880 恒值，r=i 算例 §3.4 同输入可复用）。
5. share v5：v4 载荷解码 null；v5 往返恒等；label 剥除断言；20 条上限；`check:share` 键集断言扩 events。
6. UI：事件组增删改走查、透镜轨 ≤3 新形状、基准列与手动计算同值（F4 复验路径 wf06-report.md:102）。

### 附：本纪要自身实证声明

- 全部代码引用为本会话 Read 直读（finance.ts 895 行 / share.ts 301 行 / useCalculatorStore.ts 334 行 / p8-spec.md 520 行 / LifeTrajectoryCard.tsx / LifeLensTrack.tsx / ScenarioPanel.tsx / bridge.ts 关键段 / defaults.ts 关键段 / scenarios.ts 关键段 / wf06-report.md 146 行）。
- 载荷尺寸为本会话 node 实跑两次（§4.1 数字即输出）；`cargo test` / `check:*` 门禁本轮未跑（研究轮无代码变更，如实登记——实施轮以 p9-spec 验收为准）。
