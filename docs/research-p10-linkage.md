# P10 联动与回归审计研究（预设联动矩阵 · 参数单源化 · P9 遗留必修 · S1–S26 迁移标记）

> 方法与证据：本审计为读码级（未运行应用、未跑 GUI 走查）。全部行号为 2026-11-23 本会话直读：
> src/data/presets.ts、src/components/BasicCalculator.tsx、src/components/advanced/{MonteCarloPanel,AccumulationPanel,ScenarioPanel}.tsx、
> src/store/useCalculatorStore.ts、src/data/defaults.ts、src/services/share.ts、src/App.tsx、src/components/AdvancedPanel.tsx、
> src/i18n/locales/zh-CN.ts、docs/design-language.md（§2 签名元素清单 + §2.1 收口实测）、docs/p9-spec.md（§5.6）。
> 两项前提由任务书给定、仓库内无既有登记（如实声明）：①「V-F-1 实证失真」编号在本仓库 grep 无命中，
> 本文按任务书命名登记，失真机制以读码实证；②「零滚动骨架」尚无 p10-spec/骨架定义文件，§4 以
> 任务书给定的骨架目标为前提，从各 S 元素触发条件对滚动的依赖逐项推导标记。
> 局限：联动矩阵与单源化状态机为设计裁定（未实施）；§4 迁移落点为标记建议，实施须过宪法 §5.1 准入与门禁复测。

## §1 预设联动矩阵（四预设 × 参数可见性）

### 1.1 现状事实

- 预设数据层 `PRESET_PROFILES` 恒覆盖 5 字段：monthlyExpense / childCount / costPerChild / healthReserve /
  majorInvestment（presets.ts:28-37）；**回报率/通胀不在预设范围**（presets.ts:27 注释原文）。四预设 childCount：
  single_renter=0（:43）、couple_no_kids=0（:50）、family_one_kid=1（:57）、zen_frugal=0（:64）；
  **costPerChild 四预设均为 580000**（:43/:50/:57/:64）——单价口径，仅 childCount>0 时被消费。
- 应用/取消均为整体写入语义：applyPreset 5 字段覆盖 + bump resetEpoch（store:208-220）；clearPreset 5 字段
  回落 BASELINE_DEFAULTS（store:229-241）；任何字段级 onChange 写入即切回「custom」（store:203-207）。
- UI 联动现状：`planChildren = baseline.childCount > 0`（BasicCalculator:564）→ 计划育儿开关常驻（:1038-1055），
  孩数 + 每孩成本两字段 **条件渲染**（:1056-1082 `{planChildren ? … : null}`）；明细拆解「子女预留」行
  childCount>0 才出（:523-525）；摘要括注按实际预留动态生成（F6 修复，:733-744）。
- 预设不触碰其他切片：applyPreset 只写 baselineInputs/activePresetId/resetEpoch（store:208-220）——
  MC / 打工模拟 / 反向估算切片零联动（「不引入静默联动」纪律先例：MonteCarloPanel:100-102 注释）。

### 1.2 联动矩阵（4 预设行 × 参数列；「未启用（预设）」为本审计新裁定态，见 §1.4）

| 预设（childCount） | 月开销 | 计划育儿开关 | 孩数＋每孩成本 | 健康预留 | 重大投入 | 核心回报率/通胀 | MC 回报均值/通胀均值 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| single_renter（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 15 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§2） |
| couple_no_kids（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 20 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§2） |
| family_one_kid（1） | 预填可见·可改 | 开（预填） | 展开预填·可改 | 预填 20 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§2） |
| zen_frugal（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 15 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§2） |

矩阵行为 4（四预设）；列 7（六参数组 + MC 均值联动预告）。注：任务书点名 single_renter/couple_no_kids，
但 zen_frugal 同为 childCount=0，折叠态按 childCount 谓词统一生效（三预设同态），非按预设 id 逐一特判。

### 1.3 裁定：UI 折叠 vs 数值清零 —— **裁定 UI 折叠（childCount=0 谓词），数值不清零**

理由（全部有读码依据）：

1. **语义上 childCount=0 已经是「数值关闸」**：wasm 基线只按 childCount 计子女预留（明细行条件
   BasicCalculator:523-525、摘要括注 :733-744）；costPerChild 是单价，0孩时不参与任何计算。清零它
   不改变任何输出，属伪修复。
2. **清零会破坏「再启用」路径**：预设刻意让 costPerChild 恒 58 万（presets.ts 四处），用户从
   single_renter 手动打开育儿开关 → setBaselineInputs 切 custom（store:203-207）→ 字段带 58 万单价
   回场，开箱即算。若此前被清零，回场值 0 直接产出错误临界值——正是「残留/静默失真」类问题。
3. **与 clearPreset 整体覆盖语义对称**（store:229-241 注释 ①②③）：预设写入=5 字段覆盖，取消=5 字段
   回退；若联动层再叠一层「清零」，数值真实来源出现第三处写入者，违反单一事实来源。
4. **「未启用（预设）」态补的正是现状缺口**：现状折叠是静默的（字段直接消失，:1056 无占位），用户无从
   区分「被预设有意收起」与「字段丢了」。折叠态显式声明归因（预设），状态诚实（宪法 §1 #4）。

### 1.4 「未启用（预设）」折叠态规格

- 触发谓词：`childCount === 0`（与 planChildren 互斥，沿用 :564 单一派生）；activePresetId 为预设或
  custom 均可进入（custom 下手动关开关同样收起，态文案改「未启用」不带「（预设）」后缀）。
- 形态：开关行保留；原两字段位置渲染一行 caption 态文字「子女预留未启用（预设）」＋「启用」文字按钮
  （= 置开开关，回场带预设/默认单价 58 万）；aria 用同一文案，禁 title-only。
- i18n：presets.* 键空间新增 3 键（zh-CN.ts:97 起既有块内）：`childFolded`/`childFoldedPreset`/
  `childEnable`；三语键集一致性由既有门禁承载。
- 不做的事：不清 costPerChild、不写死 disabled、不改 applyPreset/clearPreset 写入集（5 字段不变）。

## §2 名义回报率/通胀率单源化（MC 均值 →「跟随核心参数」派生锁定）

### 2.1 现状多源清单（同名参数今日独立无联动）

| 源 | 字段 | 默认值 | 落点 |
| --- | --- | --- | --- |
| 核心参数（单源锚点） | baselineInputs.nominalReturnPct / inflationPct | 4.5 / 2.0 | defaults.ts:38-39；UI 核心 Params 折叠 BasicCalculator:1121-1136 |
| MC 面板 | monteCarloInputs.nominalReturnMeanPct / inflationMeanPct | 4.5 / 2 | defaults.ts:123,:125；UI MonteCarloPanel:597-624（normal 模式） |
| 打工模拟 | accumulationInputs 同名 | 4.5 / 2 | defaults.ts:194-197；UI AccumulationPanel:336-382 |
| 反向估算 | reverseInputs.nominalReturnPct / inflationPct | 4.5 / 2.0 | defaults.ts:93-94 |
| 支取策略余额比例 | percent.realReturnAssumpPct | 2.5（=4.5−2 编译期派生） | defaults.ts:135-137（明文「无运行时联动」，不动） |

危害实证（同族 wf06 F1）：核心参数改 6.0/3.0 后，MC/打工模拟仍按 4.5/2 抽样——结论静默过期；
本任务书范围 = MC 两均值；打工/反向为同模式后续候选（§2.4 登记，不在本轮实施面）。

### 2.2 裁定：**默认「跟随核心参数」派生锁定；显式解锁可覆盖；拒绝静默同步与删字段**

- 拒绝「静默单向同步」（baseline 变更即写 monteCarloInputs）：直接违反既有纪律——F1 修复明确
  「仅提示与显式动作，不引入静默联动」（MonteCarloPanel:100-102、AccumulationPanel:215-217 注释），
  且会静默覆盖用户已解锁的自定义值。
- 拒绝「删字段、只留核心参数」：MC 均值独立化是高级用户合法需求（压力测试/情景假设）；
  wf06 教训是「分歧静默」，不是「独立非法」。保留出口才不逼用户绕去改核心参数再改回来。
- 采纳「派生锁定 + 解锁」：锁态显示派生值＋锁标（状态诚实，宪法 §1 #4），解锁即独立，先例完整——
  accumulationTargetSynced（store:94-95/:256；AccumulationPanel:321-334 手改解除、:426-436 一键恢复）
  与 pensionMonthsSynced（store:109-111/:268）同形，零新交互词汇。

### 2.3 状态机与数据流规格

- 新 store 布尔 `mcMeansSynced`（默认 true，入 businessDefaults）；**锁态不写 monteCarloInputs 两字段**：
  显示层取 `baseline.nominalReturnPct / baseline.inflationPct` 派生直显，运行提交帧解析
  `calcMonteCarlo({ …inputs, nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct })`
  ——与 AccumulationPanel run() 的 effectiveTarget 同帧提交先例（:150-156 注释「同一值、同一帧」）完全同构。
- 字段形态（normal 模式）：locked → PercentField disabled，value=派生值，尾部锁形图标（aria-label
  「跟随核心参数，点击解锁」，锁标即解锁触发点）＋ hint 一句话；unlocked → 现字段原样可编。
  解锁点击 = 显式动作：**同时把当刻核心值落入面板切片**（消除解锁即见旧值的错位），此后与核心参数无关联。
- bootstrap 分支：回报均值/标准差本就隐藏（MonteCarloPanel:595-616 注释「分布由所选序列决定」）；
  通胀均值在两模式下均参与正态抽样（:595-597）→ 锁标在两模式都对 inflationMean 生效，回报均值锁标仅 normal。
- 一键恢复（可选，同 AccumulationPanel「恢复联动」按钮 :426-436 形态）：置回 locked 并 bump 字段 key
  重挂载回填派生显示（InputNumber 受控回写缺陷先例：store:216-218、AccumulationPanel:105-111）。
- **解锁态持久化**（显式口径）：`mcMeansSynced` 是业务口径标志，随业务切片走——
  ① 跨面板/跨页由 store 天然携带；② 入 ShareState（v5 → **v6**：新增 1 布尔键 mcMeansSynced；
  share.ts:53 版本常量 + :159 单点闸，既有「形状变更即递增、无迁移代码」纪律，v1→v5 五次先例；
  不入载荷则接收方会在锁态显示下看到 payload 里的旧均值——发送方所见≠接收方所得，违反 share.ts 纪律）；
  applyShareState 恢复该键（store:294-320 同点扩一行）；情景库存档经 buildShareState 自动携带（零新代码）；
  ③ resetAll / resetBusinessInputs 回 true（businessDefaults 共用清单 store:167-187）；
  ④ **不入 localStorage**——业务输入不落盘纪律（defaults.ts:246-247 注释原文），解锁态跨会话仅经
  分享链接/情景存档携带，与 accumulationTargetSynced 现状口径一致。

### 2.4 影响面与回归门

- 改动面：store（+1 布尔 +businessDefaults +applyShareState/buildShareState 各一行）、MonteCarloPanel
  （两字段区改锁态渲染）、share.ts（v6 +1 键校验）、i18n 6 键（锁标 aria/hint/恢复按钮 ×3 语）。
- 回归门：①默认态改核心回报率 → MC 锁显值同帧变、run 出的耗尽概率随之变；②解锁改 4.9 → 改核心不再
  影响 MC；③v6 链接往返后解锁态与自定义值不变；v5 存量链接一次性失效（既有版本闸语义，非回归）；
  ④resetAll 后回锁态；⑤情景对比首行「年支出」档案行不受本轮影响（§3 的 monteCarloInputs deps 缺口
  **必须先修或同轮修**——否则锁态派生变化不刷新基准列，叠加出新失真）。
- 不动项：reverse 两字段、打工模拟两均值（同模式候选，另行立项）、percent.realReturnAssumpPct
  （defaults.ts:135-137 明文无运行时联动，维持）。

## §3 P9 遗留必修：ScenarioPanel 对比列 deps 缺三切片（任务书编号 V-F-1）

- 失真链（读码实证）：基准列「当前参数」= 伪条目走 computeColumn 全管线（ScenarioPanel:174-192），
  但重算 effect deps（**:192** `[entries, money, moneyFixed, t, baseline, accumulation, pension,
  monthsSynced, loan, rental, lifeEvents]`）缺 reverseInputs / taxInputs / monteCarloInputs 三切片；
  而 computeColumn 恰好消费三者：`calcReverse(shared.reverse)`（:102）、`calcTax(shared.tax)`（:101）、
  档案行 `shared.monteCarlo.annualSpend`（:111/:127）。→ 手动改反向估算/税务/MC 输入后，基准列八项
  指标与档案行**静默停在旧值**（存档列与基准列对比失真；这正是「当前参数」列的存在意义被破坏）。
  p9-spec §5.6（:256）只扩了七切片，属 P9 遗留缺口；「V-F-1」编号为任务书给定，仓库内无既有登记。
- 修复规格（行级）：ScenarioPanel.tsx:146 后加三个原子选择器
  `const reverse = useCalculatorStore((s) => s.reverseInputs);`（taxInputs / monteCarloInputs 同式），
  :192 deps 追加 `reverse, taxInputs, monteCarloInputs`。成本 = 三切片各一次 ≤12 列毫秒级重算
  （p9-spec §5.6「毫秒级 × ≤12」预算口径内）。
- 叠影 effect deps（:260）**不动**：calcLifecycle 只消费 baseline/accum/pension/loan/rental/lifeEvents
  六切片（:226-243），三切片不进入其计算面，扩了只会无谓重算（§2.3-① 纪律）。
- 验收门：改 reverse「可持续月支取」→ 基准列 metricSustainable 行即时变；改税务年收入 → metricNetIncome
  变；改 MC 年支出 → 首行档案值变；三例存档列均不变（对照成立）。`npx tsc --noEmit` 过。

## §4 S1–S26 迁移标记表（零滚动骨架）

### 4.0 前提与判据

- 「零滚动骨架」为任务书给定的 P10 目标（仓库尚无骨架定义文件）：每任务页主内容一屏内呈现、
  页级滚动退化为页内子区滚动。判据 = 各 S 元素的**触发条件对页面滚动的依赖**（非视觉样式本身）：
  依赖滚动/sticky 的迁或退；宿主随卡片落位的记落点；依赖 Tabs/分段控件的随宿主迁移；已退役项登记。
- 现骨架事实：Atlas 五任务页 hidden 非卸载（App.tsx:514-619）；输出卡 sticky + isStuck 机制
  （BasicCalculator:686-699 + global.css:196/:212/:242/:1496-1500）与 <768 吸附条（:1457-1509）
  是骨架下主要死路径候选；S 清单与收口落点以 design-language.md §2/§2.1 为登记源（行号为收口时点值，
  §4 表内现落点为本会话直读，个别已漂移——如 S6 四空态现落在 MonteCarloPanel:770/:1030、
  AccumulationPanel:708、ScenarioPanel:478）。

### 4.1 标记表（26 行；标记 ∈ 不动 / 迁移落点 / 退役登记）

| S | 名称 | 现落点（本会话直读） | 标记 | 零滚动骨架下说明 |
| --- | --- | --- | --- | --- |
| S1 | 四档里程碑刻度环 | BasicCalculator:63-77,361-481,414-466 | 不动 | 防抖落定驱动、几何内嵌环 SVG，与滚动无关；随输出卡居「恒可见顶区」 |
| S2 | 达成一次脉冲 | BasicCalculator:75-77,392-403,434 | 不动 | 闩锁/滞回为数值谓词（ratio≥1），无滚动依赖；resetEpoch 清位链不变 |
| S3 | 度量字排 | global.css tabular-nums ×8（:1072/:1081/:1263 等） | 不动 | 全局排印规则，骨架无关 |
| S4 | 行级 hover 读数 | global.css:1540/:1545（.wf-sens-row hover） | 不动 | CSS 悬停，行宿主随敏感性折叠块在输出卡内 |
| S5 | 轻确认「已复制」 | BasicCalculator:592-599,749-761,1180-1189 | 不动 | 按钮域状态；吸附条分支若骨架裁撤，主按钮路径保留即为完整 |
| S6 | 空态人格化 | EmptyRulerArt 五宿主：BasicCalculator:829-831、MC:770/:1030、Accum:708、Scenario:478 | 不动 | 图形随宿主卡片落位；空态语义（缺什么→下一步）在骨架下更前置 |
| S7 | 分组左标线 | BasicCalculator:932；登记另含 Insights/TaxPanel（design-language §2.1） | 不动 | 常驻结构线，随所属卡片 |
| S8 | —（编号空缺：#8 让位预算，design-language:41） | — | 编号空缺 | 非元素，无迁移对象 |
| S9 | 输出卡计算徽标 | BasicCalculator:577-588,773-786；global.css 呼吸规则 | 不动 | 防抖窗口谓词驱动；骨架不改变防抖链 |
| S10 | 方向冗余编码 ▲▼ | BasicCalculator:305,320,1141-1146；RentalPanel:610-612（登记值） | 不动 | 常驻字形 |
| S11 | 深色环线抬升 | global.css:86/:361 令牌；BasicCalculator:437 halo 环 | 不动 | 主题常驻规则 |
| S12 | —（编号空缺：#12 让位预算，design-language:41） | — | 编号空缺 | 非元素，无迁移对象 |
| S13 | —（#13 诚实进度尺：已登记资产不再重复施工，design-language:41） | — | 资产登记 | 非迁移对象 |
| S14 | 乘数段位徽标 | BasicCalculator:604-671,880-890 | 不动 | 落定值派生段位；随乘数行在顶区 |
| S15 | 目标线叙事标注 | AccumulationPanel:103,150-156,648-659,694-698 | 不动 | submittedTarget 同帧快照语义随图容器；骨架若把图收进子区滚动，叙事行**须随图不随页**（落点约束） |
| S16 | 输出卡因果闪亮 | BasicCalculator:640-647,846,912/:931；global.css:967 登记块 | 不动 | 防抖落定驱动；key 重挂域两行 + 明细类闸在卡内自洽 |
| S17 | 敏感性双向高亮 | 无代码落点（P6 门禁降档第 3 项，design-language:114） | 退役登记 | 维持退役；骨架下敏感性为折叠块，hover 联动价值更低，复活须过 §5.1 准入+门禁 |
| S18 | 面板主数渐近滚动 | hooks.ts:205 useAnimatedNumber + 可见性闸；宿主 MC:89/:301、Accum:59-60/:239 等 | **迁移落点** | 闸宿主 ref 须重挂到骨架卡容器；零滚动下 IntersectionObserver 退化为恒可见（闸保留作子区滚动兜底，hook 不删） |
| S19 | 输出卡克制悬浮 | global.css `.wf-output-card:hover:not(.wf-is-stuck)` 规则组（design-language:116；:242-264 现行） | 不动 | 骨架恒非吸附态 → hover 规则常生效；sticky 机制（.wf-sticky-anchor/isStuck，BasicCalculator:686-699）在零滚动下成死路径，属骨架工程清理项，非 S 退役 |
| S20 | 标签指示条滑动 | AdvancedPanel:179 animation；登记 global.css | **迁移落点** | 随组内 Tabs 宿主落位；若骨架将 pro 九面板并入任务页分栏，指示条随最终 Tabs 实例迁挂 |
| S21 | 数字键切组 | AdvancedPanel:116-150 makeTabsKeyDown | **迁移落点** | 键盘宿主随分段控件迁移；「显式输入豁免」守卫必须随迁（骨架下输入面更大，豁免不可丢） |
| S22 | 主题圆形揭示 | App.tsx:45 revealTheme；global.css:1390 起 | 不动 | App 级、坐标驱动，与滚动无关 |
| S23 | 新增行进场 | 无代码落点（P6 门禁降档第 2 项，design-language:120） | 退役登记 | 维持退役；骨架「常驻可见」弱化进场语义，不复活 |
| S24 | 字段错误左标线 | global.css `.wf-field:has(…)` 左标线（design-language:121） | 不动 | 表单态 CSS，随字段宿主 |
| S25 | 图表 hover 读数 | BasicCalculator:169-187；MC:341-383；Accum:243-267；global.css .wf-chart-tip | 不动 | 图域内气泡 + 明细行兜底；触屏兜底行在骨架下仍卡内可达 |
| S26 | 分享磁吸微行程 | 无代码落点（P6 门禁降档第 1 项，design-language:123） | 退役登记 | 维持退役；骨架常驻可达区进一步降低磁吸价值 |

### 4.2 计数与汇总

- **迁移 3 项**（S18/S20/S21）：共同特征 = 触发器挂在 DOM 宿主（IntersectionObserver 宿主 ref /
  Tabs 实例 / 键盘容器）上，宿主在骨架重组中会换位；语义均保留，落点随新宿主。
- 退役登记 3 项（S17/S23/S26，既有维持，本轮零新增退役）；不动 17 项；编号空缺/资产 3 项（S8/S12/S13）。
- 附带工程项（非 S 退役）：零滚动下 sticky 三件套（.wf-sticky-anchor / wf-output-sticky 阈值分支 /
  isStuck 观察器，BasicCalculator:686-699 + global.css:196-264）与 <768 吸附条显隐规则将成为死路径，
  建议在骨架实施轮清理并复测 S19/S5 两条回归（hover 生效域、复制确认主按钮路径）。

---

### 审计结论一览

| 交付项 | 结果 |
| --- | --- |
| 联动矩阵 | 4 预设行 × 7 参数列（§1.2）；折叠裁定 = UI 折叠（childCount=0 谓词）+「未启用（预设）」态，数值不清零（§1.3 四条理由） |
| 单源化裁定 | MC 回报均值/通胀均值默认「跟随核心参数」派生锁定（锁态显示层派生 + 运行提交帧解析，零静默写 store），显式解锁覆盖并把当刻核心值落入切片；解锁态经 ShareState v6 新键 mcMeansSynced 持久化，不入 localStorage（§2.2-§2.3） |
| P9 遗留必修 | ScenarioPanel.tsx:192 deps 补 reverse/taxInputs/monteCarloInputs 三切片（V-F-1 实证失真，§3），叠影 deps 不动 |
| S 迁移标记 | S1–S26 逐项 26 行：不动 17 / 迁移落点 3（S18/S20/S21）/ 退役登记 3（S17/S23/S26）/ 编号空缺 3（S8/S12/S13） |
