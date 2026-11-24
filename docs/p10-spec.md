# P10 实现规范：五任务页零滚动切换树 · 100dvh 骨架 · 预设联动矩阵 · MC 均值单源化 · P9 遗留必修

| 项 | 值 |
| --- | --- |
| 文档性质 | 实施规范（施工蓝图；本文档轮次零施工，不写实现代码） |
| 输入物（起草会话全读） | `docs/research-p10-layout.md`（树结构与高度预算锁定）、`docs/research-p10-linkage.md`（联动/单源化/V-F-1/S 迁移审计）、宪法 `docs/design-language.md`（§1 五原则 + §2 签名元素 + §5.2 退役规则）、`src/App.tsx`、`src/components/TaskPages.tsx`、`src/components/BasicCalculator.tsx`（三源码实读）；佐证补读 `src/store/useCalculatorStore.ts`、`src/services/share.ts`、`src/data/presets.ts`、`src/components/AdvancedPanel.tsx`、`src/components/TaskSwitcher.tsx`、`src/components/advanced/{InsightsPanel,MonteCarloPanel,ScenarioPanel}.tsx`、`src/components/hooks.ts`、`src/styles/global.css`、`src/i18n/locales/zh-CN.ts`、`scripts/check-size.mjs` |
| 范围红线 | ①不装新依赖（package.json 零变化）；②公式与数据流不碰——`calc*` 调用面与 wasm 导出面零改动，单源化为 UI 层派生锁定，`monteCarloInputs` 两均值字段的默认值与数值语义不变（本轮唯一 store 增量 = 一个布尔口径标志，见 §4）；③宪法 §5.2：退役只删实现，信息路径须先迁移（§2-T 表逐行登记） |
| 验收底稿 | §1 各加总表 = §9-A1 零滚动门禁的静态预算底稿；研究文档自检已声明：高度预算为静态推算，未做浏览器渲染实测，A1 即把静态预算变为可执行检查的路径。**例外：principles@320（含两视口槽内静态可达性）为已登记偏差，见 §10-10——静态底稿对该页不提供 ✓，A1 实测为唯一裁决** |

---

## §1 五页零滚动切换树定稿（30 节点）

### §1.0 术语与判据（承接 research-p10-layout §0，验收口径写死）

- **零滚动**：任一任务页任一「叶」在参考视口（320×720、1440×900）内同时可见的全部节点高度加总 ≤ 内容栈预算；内容区禁止滚动兜底（含页内 `overflow-y:auto` 内滚）。
- **切换树**：根（页）→ 切换节点（tab / 步骤 / 分段 / 条目 / 槽切换条）→ 叶或槽。
- **槽（slot）**：高度恒定的区域，内部内容切换时**等高互换**（替换不加高）——与现状加性 Collapse 的本质差异；折叠节点按**闭合态**计预算，展开内容只能占据既有的某个槽。叶内固定分区（如读数窗）不是切换节点，但参与预算加总。
- **内容栈预算**：320×720 → 720−56−48−16 = **600px**；1440×900 → 900−56−56−32 = **756px**（有 dock 的页先扣 56+`env(safe-area-inset-bottom)`）。

### §1.0a 公共骨架 chrome（3 节点，两视口通用）

| # | 节点 | 承载组件 | 内容来源 | 320×720 | 1440×900 | 依据 |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 顶栏 | `Header`（App.tsx:401-468） | brand + 币种/色盲/语言/主题四控件 | 56 | 56 | `--wf-topbar-h:56px`（global.css:107） |
| C2 | 任务切换条 | `TaskSwitcher`（5 项 tablist） | `atlas.nav.*` 既有键；desc <768 转 `title`/aria（单行 48），≥768 双行 56 | 48 | 56 | TaskSwitcher.tsx:74-77（title 已在位）；44px 命中保留 |
| C3 | 页内底部 dock 行 | `.wf-action-dock` / `.wf-mc-dock-run` 改 flex 静态行 | 分享复制（BasicCalculator.tsx:1186-1190）/ MC 运行 | 56+env | 不渲染 | 现状 global.css:1461-1478 sticky 迁移（§2-T5/T6） |

安全区吸收规则：`env > 0` 的机型由**主槽**让渡（图槽下限 200px 硬底线；低于 200 = 该机型登记为不支持零滚动，回退滚动并明示，不静默裁切）。回退路径的验收口径：「明示」横幅可见性与回退后页行为不可脚本化断言（`env()` 无法程序化覆写），登记为 **A1 人工走查登记项①**（§9-A1；红线 9 同源）。

### §1.1 自由刻度 freedom（10 节点 F0–F9；<1200 双叶，≥1200 双栏同屏）

| # | 节点 | 承载组件 | 内容来源 | 320 预算 | 1440 预算 |
| --- | --- | --- | --- | --- | --- |
| F0 | 叶切换条（页级，2 段） | 「计算结果 ⇄ 输入参数」分段（Radio.Group 语义，与 K1 同形）；双叶形态恒驻、双栏同屏（≥1200，同 F7 退役条件）退役 | 复用 `basic.outputTitle` / `basic.inputTitle` 既有键（§7 零新键）；<1200 兼承载两卡头退役的标题（信息迁移见下方卡壳规则） | 40 | —（双栏退役） |
| F1 | 读数窗区（叶A 固定） | 输出卡 hero：display 大数字 + `FreedomGauge` 环 56/72 + 进度说明行；`basic.liveUpdate` 文案并入进度说明 caption（卡头 <1200 退役迁移） | `data.criticalValue`（wasm 防抖落定）、`progressInputs.currentAssets`、`gaugePct` 派生（BasicCalculator.tsx:808-842）；S1/S2/S6/S11 宿主 | 74 | 120（含卡头 46） |
| F2 | 关键读数两行（叶A 固定） | 摘要行 + 乘数行（S16 重挂域、S14 Tag 随行） | `data.multiplier`、`summarySuffix` 动态括注（:734-744）、`multSegment`（:652-664） | 48 | 48 |
| F3 | 槽切换条（叶A，2 段） | 「明细 ⇄ 敏感性」分段按钮（等高互换） | 复用 `basic.breakdownTitle` / `sensitivity.title` 键 | 40 | 40 |
| F4 | 叶A 主槽 | 明细 `BreakdownTable`（Descriptions ≤7 行×34）⇄ 龙卷风图 240（D5 档） | 明细 = :899-951 全量数据；敏感性 = `SENS_STEPS` 六档防抖复算（:708-728）+ tornado 派生（:138-156） | 240 | 240 |
| F5 | 卡壳（两卡卡体 padding；卡头 <1200 退役并入 F0，≥1200 保留） | 输出卡体 padding 16×2 + 输入卡体 padding 16×2（卡头另计：min-height 46，≥1200 计入 F1/左列） | —（组件库 token：Card/style/token.less:11 `card-size-default-height-title`=46、:17 `padding-vertical-body`=`@spacing-7`=16） | 32+32（叶A/叶B 各一卡体） | 46×2+32×2 |
| F6 | 预设画像行（叶B 固定） | 4 画像按钮 + 自定义 Tag（44 命中；其后 `.wf-preset-bar` margin-bottom 12，global.css:1239） | `PRESET_PROFILES` ×3 预填、`activePresetId`（:978-1005） | 44（+12） | 44（+12） |
| F7 | 步骤条（叶B，2 步分页） | ①欲望 ②假设与资产 | 新键 `basic.stepDesire` / `basic.stepAssumption`（§7）；≥1200 退役（左列全量字段） | 32 | —（左列改全量） |
| F8 | 叶B 主槽（280 恒高，三态等高互换） | 步骤内容 ⇄ 反向卡（双态）⇄ 核心假设展开 | ①`baselineInputs` 月开销/育儿开关/孩数/每孩成本 + 消费构成 Tag 行（:1007-1025，预设生效时渲染）②医疗/重大投入/已有资产（:1083-1115）⇄ **反向卡（读数 ⇄ 编辑双态，恒高 228 ≤ 280，证伪与规格见下方卡壳规则段）** ⇄ 核心参数展开（:1121-1162） | 280 | 左列字段区 384 + 假设展开 140 |
| F9 | 假设折叠(闭) + 公式解构行 | 核心参数折叠头闭合态 + `FormulaAnatomyRow` | 两行 44×2；展开走 F8 槽；解构行纯展示态零 store 写入（:1170-1175） | 88 | 解构行 44 |
| — | **加总** | 叶A（含 F0）= 40+74+48+40+240+32 = **474**；叶B（含 F0）= 40+44+12+32+280+88+32 = **528** | +dock56 → 530/584 ≤ 600 ✓ 余 70/16 | — | 左列 = 卡头 46+卡体 32+F6 56+字段区 384+假设展开 140+解构行 44+分享行 40 = **742**；右列 = F1 120+F2 48+F3 40+F4 240+F5 32+卡间距 16+反向卡 228 = **742**；页栈 max = 742 ≤ 756 ✓ 余 14 |

卡壳预算规则（复核修订增补，逐行量化取值）：Arco 卡头 min-height **46**（token `card-size-default-height-title`=46px，Card/style/token.less:11；global.css:1355 放开为 auto+min-height 46）；卡体 padding **16×2=32**（`@spacing-7`=16px，theme/global.less:102；与 p3-spec.md:738 在册实测一致）；输入卡间距 **16**（BasicCalculator.tsx:976 marginTop）；反向卡间距 **16**（global.css:659-660）；分享行 **40** = Button small 28（`@size-small`=`@size-7`=28，Button/style/token.less:8 + theme/global.less:89/:43）+ margin-top 12（global.css:1266；<768 该行隐藏、由 C3 dock 承载，global.css:1460）。**卡头 <1200 退役的信息迁移登记（宪法 §5.2）**：输出卡 title → F0 分段标签（复用 `basic.outputTitle`）、extra「实时更新」（`basic.liveUpdate`）→ F1 进度说明 caption；输入卡 title → F0 分段标签（复用 `basic.inputTitle`）——键值零改动，信息路径先迁移后删卡头。~~反向卡 244 为含壳断言值~~（**复核修订轮二勘误，经 ReversePanel.tsx:83-197 全读证伪**：面板实有 6 字段 + 算例行 + 同步钮 + Descriptions 3 项 + note，整卡实高 ≈540（<768 单列）/≈558（桌面全量，字段全宽单列）——F8 槽 280 与右列均不可容整卡，原断言未经验读）。**修正：反向卡改卡内双态「估算结果 ⇄ 编辑参数」，恒高 228 = 卡体 padding 16 + 双态切换条 36 + 内容区 176**——结果态 = Descriptions（<768 纵排 3 组 144 + note 18 = 162；桌面横排 34 + 18 = 52）；编辑态 = 字段分页（<768 3 页×2 字段、桌面 2 页×3 字段，页满载 2×52+4 = 108，末页 + 算例行 32 + 同步钮 28 + 行距 8 = 176）。新键 `reverse.viewResult` / `reverse.editParams`（§7 → 19 键 ×3 语 = 57 条）；右列加总随 244→228 改为 742。信息路径零丢失：读数/编辑/算例/同步全量可达（一次卡内切换），S18 宿主随卡容器重挂（§6-S18）。原表「左列 696 / 右列 732」为未计卡壳的断言值，本行按行项拆解修正为 742/742（复核修订登记，右列随修订对照轮二反向卡 228 再修正；research-p10-layout §1.1/§3.2 同表保留修订前数值，以本节为准）。

要点：敏感性从加性折叠改 F3/F4 槽互换后，展开不再产生滚动；F0 叶切换条补齐双叶形态的叶间节点（对照 risk K1 先例）；分享/dock 信息路径不变（C3 承载，自然可达区 [0.66H,1.0H] 结论沿用 research-responsive §7）。

### §1.2 人生轨迹 life（5 节点 L1–L5；组数 7 → 5 为本轮有意变更登记）

组→组迁移映射（信息路径先迁移，宪法 §5.2）：`trajectory→轨迹`、`events→事件`、`accumulation+pension→规划`（组内 2 标签）、`loan+rental→资产`（组内 2 标签）、`tax→税务`；hidden 非卸载与首展挂载语义原样保留（TaskPages.tsx:51-62 `visited` 集合不动）；同屏独立选项 ≤5 纪律（research-responsive §8.4；现状 7 组为 wf03/P8/P9 有意变更登记链，本轮再登记收敛）。

| # | 节点 | 承载组件 | 内容来源 | 320 预算 | 1440 预算 |
| --- | --- | --- | --- | --- | --- |
| L1 | 组分段条 | `Radio.Group`（`.wf-adv-seg`）5 组；<480 短形态标签 | `life.trajectoryTitle` / `life.eventsTitle` / 新键 `atlas.lifeGroupPlan` / `atlas.lifeGroupAsset` / `advanced.taxTitle` | 44 | 48 |
| L2 | 组内标签条 | 仅 规划/资产 两组渲染（其余组 0） | `advanced.accumulationTitle`/`advanced.pensionTitle`、`advanced.loanTitle`/`advanced.rentalTitle` | 36（命中组） | —（双栏左列承载） |
| L3 | 组读数槽 | 各组固定读数区：轨迹 = LifeTrajectoryCard Descriptions 前 5 行 + 透镜读数行；其余组 = 面板主数行（S18 宿主） | `life.*` 读数卡零 store 写入口径不变；面板主数 = 各面板防抖落定值 | 160 | 200 |
| L4 | 组槽切换条 | 2 段：「图/逐年明细 ⇄ 参数步骤」 | 复用 `atlas.slotChart` / `atlas.slotParams`（§7） | 36 | — |
| L5 | 组主槽 | 图（轨迹逐年明细 / 积累模拟 / 收租现金流，D5 240 档——收租图 280 并入 240 档为有意变更登记）⇄ 参数步骤内容（240） | 各面板 chartHeight 与控件；透镜刻度轨 44px 命中与 role="slider" 语义、S21 豁免扩展原样（LifeLensTrack.tsx:3） | 240 | 图 320（D5 宽档）+ 透镜 88 |
| — | **加总** | 最重组（规划）44+36+160+36+240 = **516** ≤ 600 ✓（无 dock） | — | 页栈 48+max(左 640, 右 608) = 688 ≤ 756 ✓（左 640 为上限断言「40+600」，非行项加总，口径见 §1.6） |

### §1.3 风险实验室 risk（4 节点 K1–K4；页级 2 叶：模拟 | 情景，桌面双栏同屏）

| # | 节点 | 承载组件 | 内容来源 | 320 预算 | 1440 预算 |
| --- | --- | --- | --- | --- | --- |
| K1 | 叶切换条 | 模拟 ⇄ 情景（2 段；桌面保持 2 叶不并栏——两卡均超半栏预算） | `advanced.mcTitle` / `advanced.scenarioTitle` | 40 | 44 |
| K2 | 读数槽 | 模拟 = 耗尽概率/持续成功率双指标行（P7 双指标）；情景 = 叠影状态/差异摘要行 | MC 落定结果双指标；叠影状态与差异摘要（WF-04 T3 既有派生） | 160 | 160 |
| K3 | 槽切换条 | 图 ⇄ 参数步骤（模拟）；叠影图 ⇄ 对比表（情景） | 复用 `atlas.slotChart` / `atlas.slotParams` | 36 | 36（仅情景组） |
| K4 | 主槽 | 图 240（D5）⇄ 步骤内容；对比表槽 ≤9 行×32（超行走分页） | MC 17 控件 / 双图（:783/:975 D5）；叠影图；对比表 ≤12 列 D7 横滚 + 年支出基期行（WF-06） | 240 | 320（D5 宽档）/ 表 288 |
| — | **加总** | 40+160+36+240+dock56 = **532** ≤ 600 ✓ | — | 页栈 44+max(左 640, 右 516) = 684 ≤ 756 ✓（左 640 为上限断言「40+600」，非行项加总，口径见 §1.6） |

要点：运行按钮落 C3 dock（§2-T6）；对比表首列 sticky 属**水平维度**，不在本轮退役清单（§2-T10 另册登记）。

### §1.4 原理档案 principles（3 节点 P1–P3；条目切换 + 条目内分节，全页零滚动）

**条目化：8 节 → 5 条目（≤5 纪律），条目内 ≤2 分节**（InsightsPanel.tsx:81-146 现状 8 节实测）。**逐分节槽分解（复核修订增补）**：P2/P3 两行对两分节给出**不同**内容槽上限——P2 = 节头 32 + **分节1槽 ≤280** = 312；P3 = 节头 32 + **分节2槽 ≤196** + 节间 16 = 244；据此把原「每条目单一最大内容槽」拆为两分节各自槽值回填（分节构成按 InsightsPanel.tsx / insights.ts 实读行数推算）：

| 条目 | 含分节（→现节，InsightsPanel.tsx 实读） | 分节1槽(320 静态估算) | 分节2槽(320 静态估算) | 构成依据 |
| --- | --- | --- | --- | --- |
| E1 公式与口径 | 公式推导(:81-88) + 严格/宽松口径(:137-139) | ≈30（副行 1 行 + FieldTip 内联零高）✓ | ≈230（strictBody 67 字符→4 行 + looseBody 77→5 行 × 25.6，阅读档 16px/1.6，global.css:773-776 实读）**✗ > 196**（复核修订轮二勘误：原标 ✓ 系对照 280 上限误读，见修订对照⑨） | 196 上限超限（同登记偏差） |
| E2 假设链条 | 推导链(:90-92) + 直观锚点(:94-102) | **≈820–1390（EntryRows ×10）✗** | ≈120（anchorNote + 4 锚点行）✓ | chain 10 行 ×（主体 21 + 来源折行 36–90 + 行内距 16）+ gap 10×9 |
| E3 数据与来源 | 市场平均(:104-106) + 育儿成本(:108-128) | **≈290–330（2 EntryRows + marketNote）✗** | **≈250–270（4 地区行 ×3 带勘误注 + childShort）✗** | 双分节均超上限（E3 贴线不成立） |
| E4 医疗与证据 | 医疗预留(:130-135) + 证据说明(:142-146) | **≈330–430（3 EntryRows + healthShort）✗** | ≈52 ✓ | health 来源串长、折行多 |
| E5 声明 | 免责 + 隐私（自 Footer 迁入，`app.footerDisclaimer` / `app.footerPrivacy` 键复用不改名） | ≈90（单节，120 槽内）✓ | —（单节，P3 不渲染并入 P2） | 单节让渡前提随之失效（§10-10） |

静态估算基准（A1 实测裁决）：Content padding 8 + principles-body padding 16（global.css:650-657）→ 行内文本宽 ≈244px；来源行 caption 12px/18px（global.css:1297）、阅读段 16px/1.6（global.css:773-776）、行内距 8/12 + 列表 gap 10（global.css:1280-1288）。

| # | 节点 | 承载组件 | 内容来源 | 320 预算 | 1440 预算 |
| --- | --- | --- | --- | --- | --- |
| P1 | 条目切换条 | 5 条目；≥1200 为左轨 200px 竖排，高度不变 | 新键 `insights.entryFormula` / `entryChain` / `entryData` / `entryEvidence` / `entryNotice`（§7） | 44 | 44 |
| P2 | 条目内容区·分节 1 | 节头（T7 左标线 32）+ 分节1内容槽（≤280） | insights.ts 数据源零改动；FieldTip 全文下沉、核证 Tag 三色、S4 行 hover 原样 | 312 | 328 |
| P3 | 条目内容区·分节 2 | 节头 + 分节2内容槽（≤196）+ 节间 16 | 同上；E5 单节，P3 不渲染（并入 P2） | 244 | 328 |
| — | **加总** | 44+312+244 = **600** 的框架成立前提 = 每条目两分节槽均落入 280/196 上限；逐分节静态估算 **E1 strict / E2 chain / E3 market / E3 child / E4 health 均超上限**——**principles@320 静态可达性不成立，登记偏差（§10-10）** | ✗ 待方案修订 | 44+328+328 = 700 ≤ 756 的框架成立；桌面分节槽受同一超限约束（chain 在 688 阅读列仍 ≈840 > 槽 296），**同登记偏差** | ✗ 待方案修订 |

要点：纯阅读页无 dock、无输入；FieldTip 悬浮层不占布局高度；每条目两节以**分节栈**同屏（不切分节）——该形态在「insights.ts 数据源零改动 + 现渲染」前提下静态不可达，实施轮必须按 §10-10 两条路线之一（渲染压缩 / 条目化方案修订）落地并过 A1 实测，方可恢复 ✓。

### §1.5 专业模式 pro（5 节点 R1–R5；分段+标签两层树原样保留，叶内容槽化）

`?task=pro&panel=<key>` 深链落位（AdvancedPanel.tsx:84-95）、S20/S21 键盘语义、每组记忆标签为**发布阻断保全项**，全部不动。pro 的零滚动问题不在导航层，在叶内容整页长表单——9 面板叶采用与 §1.2 相同槽契约（读数槽 160 + 槽条 36 + 主槽 240/320），逐面板把「图表区固定、参数区步骤化」；反向/税务等纯表单小叶整叶单步（步骤条 0）。

| # | 节点 | 承载组件 | 内容来源 | 320 预算 | 1440 预算 |
| --- | --- | --- | --- | --- | --- |
| R1 | 分段条（3 组） | 现方案 B 分段原样（`.wf-adv-seg`） | `advanced.groupPlan` / `groupHousing` / `groupAnalysis` | 44 | 48 |
| R2 | 组内标签条 | 组内 Tabs（S20 动画 / S21 键盘不动） | 9 面板 title/desc 键原样 | 40 | 40 |
| R3 | 读数槽 | 各面板主数/双指标行（S18 渐近滚动宿主重挂，§6-S18） | 各面板防抖落定值 | 160 | 160 |
| R4 | 槽切换条 | 图 ⇄ 参数步骤 | 复用 `atlas.slotChart` / `atlas.slotParams` | 36 | 36（参数入左列时退役） |
| R5 | 主槽 | 图 240（D5）⇄ 步骤内容 ⇄ 明细表 | 各面板图与控件；9 面板字段级步骤切分 = §9-A9 施工清单 | 240 | 320 |
| — | **加总** | 44+40+160+36+240+dock56 = **576** ≤ 600 ✓ | — | 页栈 48+40+max(左 640, 右 516) = 728 ≤ 756 ✓（左 640 为上限断言「40+600」，非行项加总，口径见 §1.6） |

Esc 返回（App.tsx:216-220）、数字键 5 分域（App.tsx:222-228）、返回按钮（App.tsx:612-616）全部不动。

### §1.6 树节点计数与页级加总总表

**切换树节点数 = 30**：chrome 3（C1–C3）+ freedom 10（F0–F9，复核修订增补叶切换条 F0）+ life 5（L1–L5）+ risk 4（K1–K4）+ principles 3（P1–P3）+ pro 5（R1–R5）；其中切换节点 15（C2、F0、F3、F4、F7、F8、L1、L2、L4、K1、K3、P1、R1、R2、R4）、固定分区/槽 15（加总行与迁移注记不计）。

| 页 | 320×720 最重组/叶 | vs 600(544) | 1440×900 页栈 | vs 756 |
| --- | --- | --- | --- | --- |
| freedom | 叶A（含 F0）474 / 叶B（含 F0）528（+dock 530/584） | ✓ 余 70/16 | max(左 742, 右 742) = 742 | ✓ 余 14 |
| life | 516 | ✓ 余 84 | 688 | ✓ 余 68 |
| risk | 532 | ✓ 余 68 | 684 | ✓ 余 72 |
| principles | 600（框架值） | ✗ 偏差登记（分节槽静态超限，§10-10） | 700（框架值，同偏差） | ✗ 待方案修订 |
| pro | 576 | ✓ 余 24 | 728 | ✓ 余 28 |

左列常量口径（复核修订登记）：life/risk/pro 的 1440 左列 640 = 「40 + 600」断言——40 为左列内导航/标签行预算、600 为**左列参数区预算上限**（复用 320 档内容栈常量）；两者均为**上限断言值、非行项加总**，各页 40 的行项归属（组内标签条 / 卡壳内标签行）在施工时按实际宿主登记；行项分解（卡壳 46+32、字段行数×行高、组内距）归 §9-A9 施工清单逐面板回填，超限即返工，A1 实测为裁决。freedom 左列已按行项拆解为 742（§1.1 加总行）。

---

## §2 骨架与迁移（100dvh 锁定 · D9 退役登记 · 信息路径迁移）

### §2.1 骨架定稿

```text
<Layout style minHeight:"100vh" → 改 height:"100vh" 再覆写 height:"100dvh"   /* App.tsx:395 */
  Header        flex:none; height:56        /* sticky 退役（§2-T1） */
  切换条区       flex:none; 高 48/56         /* 恒驻；desc <768 转 title/aria（信息不丢） */
  Content       flex:1; min-height:0; padding 8/16; overflow:hidden   /* App.tsx:477-483 padding 收窄；maxWidth 1112 保留 */
    └ .atlas-page(×5)  height:100%; overflow:hidden; display:flex; column
  （Footer 元素退役 → 声明迁移 E5，§2-T11）
```

- `min-height:0` 是关键：使 flex 子区可被真实测高，页内槽预算才成立；dvh 防移动端地址栏伸缩导致 720 基准失真。回退顺序 `height:100vh` → `height:100dvh` 直接覆写（旧浏览器忽略后值即得 vh 值），`@supports` 不需要。
- 任务切换反馈（App.tsx:190-196）：`scrollIntoView` 滚动复位**退役**（无滚动可复位），保留 `focus({ preventScroll: true })` 焦点迁移——信息路径（切换后焦点落新页根）先迁移后删滚动。
- 迁移提示 Alert（App.tsx:516-524）→ Message 气泡（覆盖层，零布局高度）；换算提示 Alert（App.tsx:495-508）→ 顶栏币种 Select 旁 info 触发器，tooltip 承载汇率+时点全文（非 CNY 才渲染）。
- wasm 引导失败 Alert（App.tsx:486-491）**保留**：异常态横幅，登记为例外路径——A1 零滚动断言以引导成功为前提（非内容裁切）。
- 键盘避让：本方案无覆盖层参数面板；dvh 自动跟随可视视口，输入法弹起时内容栈实时收缩 → 页内仍不得出现滚动，超收缩由步骤分页消化（A1 补 IME 态断言）。

### §2.2 既有 sticky / 吸附机制退役与迁移登记（宪法 §5.2，design-language.md:177）

| # | 机制 | 现状落点（本会话实读） | 处置 | 信息路径迁移去向 |
| --- | --- | --- | --- | --- |
| T1 | 顶栏 sticky md+ | global.css:186-199 | 退役（静态 flex 行） | 无损：顶栏内容与 44/48 命中原样（App.tsx:427-466） |
| T2 | 输出卡吸附 `.wf-output-sticky` + 锚点 + `wf-is-stuck` | global.css:212-224,242-268；BasicCalculator.tsx:686-699,772-784 | 退役：输出卡为叶 A 恒驻区，「恒可见」由 flex 槽保证 | 可见性路径 1:1 迁移（读数常开 = L1 纪律） |
| T3 | **D9 吸附态紧凑减法（退役登记）** | global.css:1495-1501（`.wf-is-stuck` **五**选择器 display:none——:1496-1500 实读恰 5 个：.wf-output-line / .wf-breakdown-toggle / .wf-sens-toggle / .wf-output-breakdown / .wf-sens-block） | **退役（吸附态不复存在）**；D9 本体的 <640 环 56（BasicCalculator.tsx:553 `isCompact`）**保留** | 其承载（吸附时保留大数字+进度说明）由 F1/F2 恒驻兑现 |
| T4 | 吸附穿透三层 pointer-events | global.css:242-268 | 退役（无覆盖即无穿透） | 无损：卡内交互全时直达（验收 Q3-1 语义自动满足） |
| T5 | 底部分享 dock sticky | global.css:1461-1469；BasicCalculator.tsx:1186-1190 | **迁移**为 flex 静态底行（C3），`safe-area-inset-bottom` 内边距保留 | 自然可达区路径不变（页满视口 ⇒ dock 恒在 [0.66H,1.0H]）；primary 全宽例外登记（宪法 §5.4 第 6 条）延续 |
| T6 | MC 运行 dock sticky | global.css:1470-1478 | 同 T5 迁移（risk/pro 的 C3 行） | 运行入口恒在 |
| T7 | 双栏左列 sticky + 内滚 | global.css:686-695,727-734 | 迁移：左列改 flex 静态列；`max-height`+`overflow-y:auto` **退役**（禁内滚兜底） | 参数路径由 §1.1 F8 槽（移动）/左列全量（桌面）承载 |
| T8 | 切换条锚点 scroll-margin | global.css:506-510；App.tsx:190-196 | 退役（scrollIntoView 退役） | 焦点迁移路径保留（preventScroll） |
| T9 | 通用锚点 scroll-margin | global.css:837-838 | 随 T8 退役 | 同上 |
| T10 | D7 表格首列 sticky <768 | global.css:1421-1427 | **保留**（水平维度正交；横向滚动另册处置） | 表行标识恒可见路径不变 |
| T11 | Footer 声明两行 | App.tsx:622-629 | 元素退役 | **先迁移**：E5 条目（§1.4）承载免责+隐私全文（键不改名） |
| T12 | S19 非吸附态悬浮条件 | global.css:1675-1679 `:not(.wf-is-stuck)` | 条件退役（选择器简化为 `.wf-output-card:hover`） | S19 触发时机语义收窄（全状态可悬浮），视觉/降级零变化——按宪法 §5 流程登记注记，非新元素 |

红线复核：退役清单不含任何签名元素的本体（S19 仅去条件分支；S9 呼吸 / S16 闪亮宿主输出卡恒驻后触发语义不变）；「同屏呼吸 ≤1」纪律不受影响。

### §2.3 机制前提：槽等高互换契约

零滚动成立的机制前提是**槽等高互换**：现状 4 处加性折叠/展开（<768 明细拆解 toggle :900-929、敏感性 toggle :209-336、核心参数 Collapse :1118-1162、life 组内折叠）全部改槽化或按闭合态计预算。槽切换条按钮沿用既有按钮/Radio 语义（零新交互词汇），键盘漫游沿用 TaskSwitcher / AdvancedPanel 先例（方向键 + 显式输入豁免）。

---

## §3 联动矩阵定稿（预设 × 参数可见性 + 实现口径）

### §3.1 现状事实（本会话实读核对）

- 预设数据层 `PRESET_PROFILES` 恒覆盖 5 字段：monthlyExpense / childCount / costPerChild / healthReserve / majorInvestment（presets.ts:27-68；:28-37 为 `PresetProfile` 接口区、数据体 :39-68——复核修订勘误，原引 :36-66 已漂移）；**回报率/通胀不在预设范围**（presets.ts:27 注释原文）；四预设 childCount：single_renter=0、couple_no_kids=0、family_one_kid=1、zen_frugal=0；**costPerChild 四预设均为 580000**（单价口径，仅 childCount>0 时被消费）。
- 应用/取消均为整体写入语义：applyPreset 5 字段覆盖 + bump resetEpoch（store:208-220）；clearPreset 5 字段回落 BASELINE_DEFAULTS（store:229-241）；任何字段级 onChange 写入即切「custom」（store:203-207）。
- UI 联动现状：`planChildren = baseline.childCount > 0`（BasicCalculator.tsx:564）→ 计划育儿开关常驻（:1038-1055），孩数 + 每孩成本两字段条件渲染（:1056-1082）；明细「子女预留」行 childCount>0 才出（:523-525）；摘要括注按实际预留动态生成（:734-744）。
- 预设不触碰其他切片：applyPreset 只写 baselineInputs / activePresetId / resetEpoch（store:208-220）——MC / 打工模拟 / 反向估算切片零联动（「不引入静默联动」纪律先例：MonteCarloPanel.tsx:100-102 注释）。

### §3.2 联动矩阵（4 预设行 × 7 参数列）

| 预设（childCount） | 月开销 | 计划育儿开关 | 孩数＋每孩成本 | 健康预留 | 重大投入 | 核心回报率/通胀 | MC 回报均值/通胀均值 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| single_renter（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 15 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§4） |
| couple_no_kids（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 20 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§4） |
| family_one_kid（1） | 预填可见·可改 | 开（预填） | 展开预填·可改 | 预填 20 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§4） |
| zen_frugal（0） | 预填可见·可改 | 关（预填） | **折叠「未启用（预设）」** | 预填 15 万·可改 | 0·可改 | 不入预设·常驻 | 锁定派生（§4） |

折叠态按 `childCount === 0` 谓词统一生效（三预设同态），非按预设 id 逐一特判。

### §3.3 裁定：UI 折叠（childCount=0 谓词），数值不清零

四条理由（全部有读码依据，承 research-p10-linkage §1.3）：

1. **语义上 childCount=0 已是「数值关闸」**：wasm 基线只按 childCount 计子女预留（明细行条件 :523-525、摘要括注 :734-744）；costPerChild 是单价，0 孩时不参与任何计算——清零它不改变任何输出，属伪修复。
2. **清零会破坏「再启用」路径**：预设刻意让 costPerChild 恒 58 万（presets.ts 四处）；从 single_renter 手动打开开关 → setBaselineInputs 切 custom（store:203-207）→ 字段带 58 万单价回场，开箱即算。若此前被清零，回场值 0 直接产出错误临界值。
3. **与 clearPreset 整体覆盖语义对称**（store:229-241 注释 ①②③）：若联动层再叠「清零」，数值真实来源出现第三处写入者，违反单一事实来源。
4. **「未启用（预设）」态补现状缺口**：现状折叠是静默的（:1056 无占位）；显式声明归因（预设），状态诚实（宪法 §1 原则 4）。

### §3.4 「未启用（预设）」折叠态实现口径

- 触发谓词：`childCount === 0`（与 `planChildren` 互斥，沿用 :564 单一派生，不新增第二派生源）；activePresetId 为预设或 custom 均可进入（custom 下手动关开关同样收起，态文案改「未启用」不带「（预设）」后缀——键集见 §7）。
- 形态（叶B F8 步骤①内）：开关行保留；原两字段位置渲染一行 caption 态文字「子女预留未启用（预设）」＋「启用」文字按钮（= 置开开关，`setBaseline({ childCount: 1 })`，回场即 costPerChild 现值——预设下为 58 万）；aria 用同一文案，禁 title-only。
- 不做的事：不清 costPerChild、不写死 disabled、不改 applyPreset / clearPreset 写入集（5 字段不变）。

---

## §4 名义回报率/通胀率单源化定稿（派生锁定 + 解锁持久化）

### §4.1 现状多源清单（同名参数今日独立无联动）

| 源 | 字段 | 默认值 | 落点 |
| --- | --- | --- | --- |
| 核心参数（单源锚点） | baselineInputs.nominalReturnPct / inflationPct | 4.5 / 2.0 | defaults.ts:38-39；UI 核心 Params 折叠 BasicCalculator:1121-1136 |
| MC 面板（本轮范围） | monteCarloInputs.nominalReturnMeanPct / inflationMeanPct | 4.5 / 2 | defaults.ts:123,:125；UI MonteCarloPanel:597-624（normal 模式） |
| 打工模拟（不动，另行立项） | accumulationInputs 同名 | 4.5 / 2 | defaults.ts:194-197；UI AccumulationPanel:336-382 |
| 反向估算（不动） | reverseInputs 同名 | 4.5 / 2.0 | defaults.ts:93-94 |
| 支取策略余额比例（不动） | percent.realReturnAssumpPct | 2.5（编译期派生） | defaults.ts:135-137（明文「无运行时联动」） |

危害实证（同族 wf06 F1）：核心参数改 6.0/3.0 后，MC 仍按 4.5/2 抽样——结论静默过期。

### §4.2 裁定：默认「跟随核心参数」派生锁定；显式解锁可覆盖；拒绝静默同步与删字段

- 拒绝「静默单向同步」（baseline 变更即写 monteCarloInputs）：违反既有纪律——F1 修复明确「仅提示与显式动作，不引入静默联动」（MonteCarloPanel.tsx:100-102、AccumulationPanel.tsx:215-217 注释），且会静默覆盖用户已解锁的自定义值。
- 拒绝「删字段」：MC 均值独立化是高级用户合法需求（压力测试/情景假设）；wf06 教训是「分歧静默」，不是「独立非法」。
- 采纳「派生锁定 + 解锁」：锁态显示派生值＋锁标（状态诚实，宪法 §1 原则 4），先例完整——`accumulationTargetSynced`（store:94-95/:256；AccumulationPanel:321-334 手改解除、:426-436 一键恢复）与 `pensionMonthsSynced`（store:109-111/:268）同形，零新交互词汇。
- **数据流铁律兑现**：锁态不写 `monteCarloInputs` 两字段——显示层取 `baseline.nominalReturnPct / inflationPct` 派生直显；两字段默认值、分享载荷形状（数值键原样保留）、wasm 入参契约全部不变。本轮唯一 store 增量 = 布尔口径标志 `mcMeansSynced`（非数值语义）。

### §4.3 状态机与数据流规格

- 新 store 布尔 `mcMeansSynced`（默认 true，入 `businessDefaults` 清单 store:167-187，resetAll / resetBusinessInputs 共用回落）。
- **锁态不写 monteCarloInputs**：显示层取 baseline 两值派生直显；运行提交帧解析 `calcMonteCarlo({ …inputs, nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct })`——与 AccumulationPanel run() 的 effectiveTarget 同帧提交先例（:150-156 注释「同一值、同一帧」）完全同构。
- 字段形态（normal 模式）：locked → PercentField disabled，value = 派生值，尾部锁形图标（aria-label「跟随核心参数，点击解锁」，锁标即解锁触发点）＋ hint 一句话；unlocked → 现字段原样可编。解锁点击 = 显式动作：**同时把当刻核心值落入面板切片**（消除解锁即见旧值的错位），此后与核心参数无关联。
- bootstrap 分支：回报均值/标准差本就隐藏（MonteCarloPanel:593-616 注释「分布由所选序列决定」）；通胀均值在两模式下均参与正态抽样（:595-597）→ 通胀均值锁标两模式都生效，回报均值锁标仅 normal。
- 一键恢复（可选，同 AccumulationPanel「恢复联动」:426-436 形态）：置回 locked 并 bump 字段 key 重挂载回填派生显示（InputNumber 受控回写缺陷先例：store:216-218、AccumulationPanel:105-111）。

### §4.4 解锁态持久化口径

- `mcMeansSynced` 是业务口径标志，随业务切片走：
  1. 跨面板/跨页由 store 天然携带；
  2. 入 ShareState：v5 → **v6**（新增 1 布尔键 `mcMeansSynced`；share.ts:53 版本常量 + :159 单点闸，既有「形状变更即递增、无迁移代码」纪律，v1→v5 五次先例）。不入载荷则接收方会在锁态显示下看到 payload 里的旧均值——发送方所见 ≠ 接收方所得，违反 share.ts 纪律。`applyShareState` 恢复该键（store:294-320 同点扩一行）；情景库存档经 buildShareState 自动携带（零新代码）；decode 端布尔校验（严格 true/false，否则整体 null）。
  3. resetAll / resetBusinessInputs 回 true（businessDefaults 共用清单）；
  4. **不入 localStorage**——业务输入不落盘纪律（defaults.ts:246-247 注释原文），解锁态跨会话仅经分享链接/情景存档携带，与 accumulationTargetSynced 现状口径一致。
- **前置依赖（必须同轮修）**：ScenarioPanel 对比列 deps 缺三切片缺口（§5，V-F-1）——否则锁态派生变化不刷新基准列，叠加出新失真。

---

## §5 P9 遗留必修项：ScenarioPanel 对比列 deps 缺三切片（V-F-1）

- 失真链（读码实证）：基准列「当前参数」= 伪条目走 computeColumn 全管线（ScenarioPanel.tsx:174-192），但重算 effect deps（**:192**）`[entries, money, moneyFixed, t, baseline, accumulation, pension, monthsSynced, loan, rental, lifeEvents]` 缺 reverseInputs / taxInputs / monteCarloInputs 三切片；而 computeColumn 恰好消费三者：`calcReverse(shared.reverse)`（:102）、`calcTax(shared.tax)`（:101）、档案行 `shared.monteCarlo.annualSpend`（:111/:127）。→ 手动改反向估算/税务/MC 输入后，基准列八项指标与档案行**静默停在旧值**。p9-spec §5.6 只扩了七切片，属 P9 遗留缺口；「V-F-1」编号为任务书给定，仓库内无既有登记（grep 无命中，如实声明）。
- **修复规格（行级）**：ScenarioPanel.tsx:148 后加三个原子选择器
  `const reverse = useCalculatorStore((s) => s.reverseInputs);`（taxInputs / monteCarloInputs 同式），
  :192 deps 追加 `reverse, taxInputs, monteCarloInputs`。成本 = 三切片各一次 ≤12 列毫秒级重算（p9-spec §5.6「毫秒级 × ≤12」预算口径内）。
- 叠影 effect deps（**:260**）**不动**：calcLifecycle 只消费 baseline/accum/pension/loan/rental/lifeEvents 六切片（:226-243），三切片不进入其计算面，扩了只会无谓重算（§2.3-① 纪律）。
- 验收门：见 §9-A2；`npx tsc --noEmit` 过。

---

## §6 S1–S26 迁移登记表（26 行；标记 ∈ 不动 / 迁移落点 / 退役登记）

> 判据 = 各 S 元素的**触发条件对页面滚动的依赖**（非视觉样式本身）：依赖滚动/sticky 的迁或退；宿主随卡片落位的记落点；依赖 Tabs/分段控件的随宿主迁移；已退役项登记。登记源 design-language.md §2/§2.1；现落点为本会话直读（与 linkage 审计一致，个别行号漂移已复核）。

| S | 名称 | 现落点（本会话直读） | 标记 | 零滚动骨架下说明 |
| --- | --- | --- | --- | --- |
| S1 | 四档里程碑刻度环 | BasicCalculator:63-77,361-481 | 不动 | 防抖落定驱动、几何内嵌环 SVG，与滚动无关；随输出卡居 F1 恒驻顶区 |
| S2 | 达成一次脉冲 | BasicCalculator:75-77,392-403,434 | 不动 | 闩锁/滞回为数值谓词（ratio≥1），无滚动依赖；resetEpoch 清位链不变 |
| S3 | 度量字排 | global.css tabular-nums ×8 | 不动 | 全局排印规则，骨架无关 |
| S4 | 行级 hover 读数 | global.css:1540,:1545（.wf-sens-row hover） | 不动 | CSS 悬停；行宿主随敏感性块入 F4 槽 |
| S5 | 轻确认「已复制」 | BasicCalculator:592-599,749-761,1180-1190 | 不动 | 按钮域状态；吸附条分支随 T5 迁移后主按钮路径保留即为完整 |
| S6 | 空态人格化 | EmptyRulerArt 五宿主（BasicCalculator:829-831、MC:770/:1030、Accum:708、Scenario:478） | 不动 | 图形随宿主卡片落位；空态语义（缺什么→下一步）在骨架下更前置 |
| S7 | 分组左标线 | BasicCalculator:932；Insights/TaxPanel（design-language §2.1） | 不动 | 常驻结构线，随所属卡片；principles 分节节头沿用 |
| S8 | —（编号空缺：#8 让位预算，design-language:41） | — | 编号空缺 | 非元素，无迁移对象 |
| S9 | 输出卡计算徽标 | BasicCalculator:577-588,773-786；global.css 呼吸规则 | 不动 | 防抖窗口谓词驱动；输出卡恒驻后触发语义不变 |
| S10 | 方向冗余编码 ▲▼ | BasicCalculator:305,320,1141-1146；RentalPanel:610-612 | 不动 | 常驻字形 |
| S11 | 深色环线抬升 | global.css:86/:361 令牌；BasicCalculator:437 halo 环 | 不动 | 主题常驻规则 |
| S12 | —（编号空缺：#12 让位预算，design-language:41） | — | 编号空缺 | 非元素，无迁移对象 |
| S13 | —（#13 诚实进度尺：已登记资产不再重复施工，design-language:41） | — | 资产登记 | 非迁移对象 |
| S14 | 乘数段位徽标 | BasicCalculator:604-671,880-890 | 不动 | 落定值派生段位；随乘数行在 F2 顶区 |
| S15 | 目标线叙事标注 | AccumulationPanel:103,150-156,648-659,694-698 | 不动 | submittedTarget 同帧快照语义随图容器；图收进 L5 槽后叙事行**须随图不随页**（落点约束） |
| S16 | 输出卡因果闪亮 | BasicCalculator:640-647,846,912,:931；global.css:967 登记块 | 不动 | 防抖落定驱动；key 重挂域两行 + 明细类闸在卡内自洽 |
| S17 | 敏感性双向高亮 | 无代码落点（P6 门禁降档第 3 项，design-language:114） | 退役登记 | 维持退役；敏感性为 F4 槽内容，hover 联动价值更低，复活须过宪法 §5.1 准入+门禁 |
| S18 | 面板主数渐近滚动 | hooks.ts:205 useAnimatedNumber + 可见性闸；宿主 MC:89/:301、Accum:59-60/:239、ReversePanel:46/:68 等 | **迁移落点** | 闸宿主 ref 须重挂到骨架卡容器（含反向卡双态容器）；零滚动下 IntersectionObserver 退化为恒可见（闸保留作子区滚动兜底，hook 不删） |
| S19 | 输出卡克制悬浮 | global.css `.wf-output-card:hover:not(.wf-is-stuck)`（:1675-1679 现行） | 不动 | 骨架恒非吸附态 → hover 规则常生效；选择器条件随 T12 简化（宪法 §5 登记注记）；sticky 三件套（BasicCalculator:686-699 + global.css:196-264）为死路径工程清理项，非 S 退役 |
| S20 | 标签指示条滑动 | AdvancedPanel.tsx:179 animation | **迁移落点** | 随组内 Tabs 宿主落位；R2 树原样保留，指示条随最终 Tabs 实例迁挂 |
| S21 | 数字键切组 | AdvancedPanel.tsx:116-150 makeTabsKeyDown | **迁移落点** | 键盘宿主随分段控件迁移；「显式输入豁免」守卫必须随迁（含 role="slider" 豁免扩展，App.tsx:209-214 同款） |
| S22 | 主题圆形揭示 | App.tsx:45 revealTheme；global.css:1390 起 | 不动 | App 级、坐标驱动，与滚动无关 |
| S23 | 新增行进场 | 无代码落点（P6 门禁降档第 2 项，design-language:120） | 退役登记 | 维持退役；骨架「常驻可见」弱化进场语义，不复活 |
| S24 | 字段错误左标线 | global.css `.wf-field:has(…)` 左标线（design-language:121） | 不动 | 表单态 CSS，随字段宿主 |
| S25 | 图表 hover 读数 | BasicCalculator:169-187；MC:341-383；Accum:243-267；global.css .wf-chart-tip | 不动 | 图域内气泡 + 明细行兜底；触屏兜底行在 F4/L5/K4/R5 槽内仍卡内可达 |
| S26 | 分享磁吸微行程 | 无代码落点（P6 门禁降档第 1 项，design-language:123） | 退役登记 | 维持退役；dock 静态恒驻进一步降低磁吸价值 |

### §6.2 计数与附带工程项

- **迁移 3 项**（S18/S20/S21）：共同特征 = 触发器挂在 DOM 宿主（IntersectionObserver 宿主 ref / Tabs 实例 / 键盘容器）上，宿主在骨架重组中会换位；语义均保留，落点随新宿主。
- 退役登记 3 项（S17/S23/S26，既有维持，本轮**零新增退役**）；不动 17 项；编号空缺/资产 3 项（S8/S12/S13）；合计 26 行。
- 附带工程项（非 S 退役）：零滚动下 sticky 三件套（`.wf-sticky-anchor` / `.wf-output-sticky` 阈值分支 / `isStuck` 观察器，BasicCalculator:686-699 + global.css:196-264）与 <768 吸附条显隐规则成为死路径，随 §2-T 表清理并复测 S19/S5 两条回归（hover 生效域、复制确认主按钮路径）。

---

## §7 i18n 三语键预算（新键 19 ×3 语 = 57 条；既有键值变更 0）

| 键域 | 新键（数） | 用途 | 承载节点 |
| --- | --- | --- | --- |
| presets.* | childFoldedPreset / childFolded / childEnable（3） | 子女预留折叠态文案（预设归因 / custom 态）与「启用」按钮 | §3.4；F8 步骤① |
| mc.* | meanSyncLockAria / meanSyncHint / meanSyncRestore（3） | 锁标 aria「跟随核心参数，点击解锁」/ hint 一句话 / 恢复联动按钮 | §4.3 |
| atlas.* | lifeGroupPlan / lifeGroupAsset（2） | life 页 5 组新分段标签（规划 / 资产） | §1.2 L1 |
| insights.* | entryFormula / entryChain / entryData / entryEvidence / entryNotice（5） | 原理档案 5 条目标签（E1–E5） | §1.4 P1 |
| basic.* | stepDesire / stepAssumption（2） | freedom 叶B 步骤条两步标签 | §1.1 F7 |
| atlas.* | slotChart / slotParams（2） | 槽切换条通用两段标签（图 / 参数，跨 L4/K3/R4/F3 复用；F3 改用既有 breakdownTitle/sensitivity.title 亦可，实施时二选一并登记） | §1.2 L4、§1.3 K3、§1.5 R4 |
| reverse.* | viewResult / editParams（2，修订对照轮二新增） | 反向卡双态切换「估算结果 ⇄ 编辑参数」 | §1.1 F8 / 桌面右列 |

- 复用既有键零改名：`app.footerDisclaimer` / `app.footerPrivacy`（E5 迁入仅改渲染位置）、`life.trajectoryTitle` / `life.eventsTitle` / `advanced.taxTitle`（组标签沿用）、`basic.outputTitle` / `basic.inputTitle`（F0 叶切换条两段标签，<1200 兼承载退役卡头标题——复核修订增补，零新键）、C2 desc 键原样（<768 改 title/aria 承载，键值不动）。
- 三语键集一致性由 `npm run check:data`（locales 三语模块加载与内容断言）承载；新增键三语在位以逐键 grep 复核登记；语言切换往返无残留（折叠态/锁态文案随语言更新）入 A13。

---

## §8 尺寸预算（≤30KB；原始字节；门禁数值不放宽——P5 既定裁定）

### §8.1 基线实测（起草会话实跑，非转抄）

- `node scripts/check-size.mjs` → `DIST_TOTAL_KB=1950`、`WASM_MAX_KB=349`、**门禁通过**。
- dist 原始字节合计（`find dist -type f -not -path "*/.git/*"` + stat 求和，排除部署快照仓内部对象——check-size.mjs walk() 同款跳过规则）＝ **1,996,781 B**（15 文件），对门禁 2,000,000 B 余量 **3,219 B，紧张**；wasm 实测 **356,870 B**（对 800,000 B 余量 443,130 B）。

### §8.2 本轮预算

| 项 | 预算 | 说明 |
| --- | --- | --- |
| wasm 增量 | **+0（硬线）** | 工具链波动缓冲 +30,720 B（≤ 387,590 B 不触发）；任何 wasm 增量出现即返工重审 |
| 本轮净增记账上限 | **≤ 30,720 B（≤30KB）** | 全部改动（骨架 CSS/JSX + 联动 + 单源化 + i18n 57 条）合计 |
| dist 绝对门禁 | ≤ 2,000,000 B | `npm run build && npm run check:size` exit 0，不放宽、不特批 |

- **两约束的关系（诚实声明）**：当前余量仅 3,219 B ⇒ 门禁内可承载净增 = 3,219 B + 实际回收量；30,720 B 记账上限只有在回收 ≥ 27,501 B 时才可全额使用。回收主体 = §2-T 退役实现（T1–T4/T7–T9/T11–T12 的 sticky 区块、穿透层、D9 吸附分支、scroll-margin 双处、Footer JSX、isStuck 观察器 JS；global.css :186-268/:506-510/:686-695/:727-734/:837-838/:1457-1509/:1675-1679 邻域）——静态估算为 2–6 KB 量级，**不足以覆盖 27,501 B**。
- 因此**实际施工预算 = min(30,720 B, 3,219 B + 实测回收)**；实施轮逐项实测回收并回填本节。若净增需求超出门禁可承载量，按 §8.3 降档顺序执行。

### §8.3 回收与降档顺序（门禁不放宽、不特批）

1. §2-T 退役 CSS/JS 全量删除（先回收后施工，逐块 diff 登记）；
2. i18n 并合：新键去文案化候选（`atlas.slotChart`/`slotParams` 改纯图标 + aria，省 2 键 ×3 语；`basic.stepDesire`/`stepAssumption` 并合为「第 1/2 步」通用键省 1 键 ×3 语）；
3. 裁展示项（候选序：principles 桌面左轨 200px 竖排形态（P1 ≥1200）延后为纯 CSS 溢出守恒 → E3 分节内容槽收容（FieldTip 下沉扩围）→ 对比表槽分页控件简化）；
4. 以上仍不足 → 缩本轮施工面（先行 §2 骨架 + §5 必修，§3/§4 拆下一轮），登记为偏差，不硬塞。

---

## §9 验收断言（16 条；全过才收口）

- [ ] **A1 零滚动程序化断言（第一断言）**：经 GUI 自动化通道执行（仓库零新依赖）。
  **前置遍历**：`visitedTasks` 门控下未访问页内容不挂载（App.tsx:539 / :563 / :575 / :596 / :617），对空页断言恒真——断言前先经任务切换**逐页遍历 5 页完成首展挂载**，再逐页断言。
  **20 组 = 5 任务页 × 2 参考视口（320×720、1440×900） × 2 主题（light、dark）**，每组三重判定：
  ① 活动页根（`.atlas-page:not([hidden])`）`scrollHeight ≤ clientHeight`；
  ② **页根全部后代可滚动元素枚举**——任一后代存在 `scrollHeight > clientHeight` 且 `getComputedStyle().overflowY ∈ {auto, scroll}` 即挂（复核修订扩围：仅判 ①③ 时，§2-T7 漏删残留——global.css:686-695 / :727-734 的 `max-height`+`overflow-y:auto`——或任何后代容器内滚兜底照样全过）；
  ③ `Content`（#wf-main）`getComputedStyle().overflowY ∈ {visible, hidden}`（非 auto/scroll，禁内滚兜底）。
  任一组任一判定失败即返工；逐组读数登记。
  **IME 收缩态自动化口径**：以视口收缩模拟 dvh 跟随输入法收缩（375×667 → 高度收缩约 40% 至 ≈375×420），对 freedom 叶B（超收缩由步骤分页消化路径）跑 ①②③ 同款断言；**真机 IME 弹起降级为人工走查登记项②**（不阻断 A1 自动化收口，单独登记）。
  **人工走查登记项（A1 附带，逐项登记，不阻断自动化收口）**：① **env>0 回退路径**（§1.0a / 红线 9）：真机或设备模拟器走查——「不支持零滚动」明示横幅可见、回退后页根允许滚动（例外登记）、无静默裁切、主槽让渡不低于 200px 硬底线；② 真机 IME 弹起（375×667 键盘弹起）页内零滚动复测。
- [ ] **A2 V-F-1 三例**：改 reverse「可持续月支取」→ 基准列可持续行即时变；改税务年收入 → 净收入行变；改 MC 年支出 → 首行档案值变；三例存档列均不变（对照成立）。
- [ ] **A3 预设联动四态**：family_one_kid 应用 → 孩数/每孩成本展开且预填（1 孩/58 万）；single_renter 应用 → 两字段折叠为「子女预留未启用（预设）」+「启用」按钮在位；点击启用 → childCount=1、单价 58 万回场、Tag 切「自定义」；zen_frugal/couple_no_kids 同折叠态（谓词统一）。
- [ ] **A4 联动不越界**：applyPreset / clearPreset 前后 store 快照对比——monteCarloInputs / reverseInputs / taxInputs / accumulationInputs 四切片零变化（字节级等值）。
- [ ] **A5 单源化锁态**：默认 `mcMeansSynced=true`；改核心回报率 6.0 → MC 锁字段显示 6.0 同帧变、run 后耗尽概率随之变；运行提交帧两均值取 baseline 现值（结果与手算对照一致）。
- [ ] **A6 解锁独立**：解锁（显式点击）改 4.9 → 再改核心参数不影响 MC 显示与 run；`mcMeansSynced=false`；解锁瞬间切片值 = 当刻核心值（无旧值错位）。
- [ ] **A7 分享 v6 往返**：解锁 + 自定义值 → 生成链接 → 恢复 → 解锁态与自定义值不变；v5 存量链接一次性失效并提示（既有版本闸语义，非回归）；情景存档保存/恢复携带该标志。
- [ ] **A8 复位与不落盘**：resetAll / resetBusinessInputs → 回锁态派生显示；解锁态不入 localStorage（清存储刷新后回锁态）。
- [ ] **A9 切换树信息路径**：freedom **F0 叶A⇄叶B 切换**与 F3 明细⇄敏感性、F8 反向卡读数⇄编辑各切换前后页栈高度差 = 0（等高互换）；life 5 组分段、规划/资产组内 2 标签、hidden 非卸载（组间往返表单态零丢失）；pro 9 面板 + `?task=pro&panel=<key>` 深链落位不变；principles 5 条目含 E5 声明全文。
- [ ] **A10 键盘与焦点**：S21 数字键 1/2/3 + 显式输入豁免（含 role="slider" 豁免扩展）；**F0/K1 叶切换条方向键漫游（显式输入豁免同款，复核修订增补）**；任务数字键 1–4/5 分域；Esc 返回；任务切换焦点落新页根（preventScroll，无滚动复位残留）。
- [ ] **A11 触控 44px 命中清单**：切换条 chips、**叶切换条（F0/K1，复核修订增补）**、分段条（L1/R1）、槽切换条（F3/L4/K3/R4）、步骤条（F7）、折叠头（F9）、dock 按钮（C3）、透镜轨逐一 ≥44px。
- [ ] **A12 S 抽查（7 项）**：S1 跨档变色、S2 单次脉冲（iteration 1）、S16 落定闪亮（首值/清位不闪）、S18 渐近滚动（宿主重挂后可见性闸仍生效）、S20 指示条、S19 hover（选择器简化后全状态生效）、S6 五宿主空态在位。
- [ ] **A13 i18n**：新增 19 键 ×3 语逐键 grep 在位；`npm run check:data` exit 0；语言切换往返无残留（折叠态/锁态/反向卡双态文案随语言更新）。
- [ ] **A14 回归门禁**：`cd src/wasm && cargo test`（75 零变化）、`npm run check:lifecycle`（L1–L6）、`npm run check:a11y`（63 组零回退）、`npm run check:share` / `check:currency` / `check:data` exit 0、`npx tsc --noEmit` 过、`git diff --stat -- src/wasm` 全空（含 bridge.ts）。
- [ ] **A15 尺寸**：`npm run build && npm run check:size` exit 0；dist ≤ 2,000,000 B；wasm ≤ 387,590 B（§8.2 缓冲线）且预期 +0；净增记账 ≤ 30,720 B（§8.1 基线回测差值）且回收/降档执行记录在位。
- [ ] **A16 色盲友好档**：开关开启下 A1 的 20 组不重复全跑，但抽查 freedom/life 两页 dark+色盲组合零滚动成立，且 S1 刻度、S25 气泡、▲▼ 语义色随档替换正常。

---

## §10 回归红线（违反即返工）

1. **公式与数据流不碰**：`calcBaseline` / `calcMonteCarlo` / `calcLifecycle` / `calcTax` / `calcReverse` 调用面与 wasm 导出面零改动（`git diff --stat -- src/wasm` 全空）；`monteCarloInputs` 两均值字段默认值与数值语义零变化；本轮唯一 store 增量 = `mcMeansSynced` 布尔口径标志（§4.2）。
2. **S1–S26 零回退**：退役登记仅 S17/S23/S26 既有维持，本轮零新增退役；迁移 3 项（S18/S20/S21）语义保留、宿主随迁；不动 17 项逐项在位（A12 抽查 + 收口全量复核）。
3. **签名元素与令牌**：零新签名元素（宪法 §5.1 本轮零申请）、零新视觉令牌、零新动效通道；令牌现值不改；「同屏呼吸 ≤1」与「S2 全站唯一 expressive」纪律不变。
4. **交互词汇零新增**：槽切换/步骤分页复用既有控件语义（按钮 / Radio.Group / Tabs）；锁标交互复用 accumulationTargetSynced / pensionMonthsSynced 同形，零新交互模式。
5. **路由与分享通道**：`?task=pro&panel=<key>` 深链、wf-route 写盘、数字键分域、Esc 返回全部不动；分享 hash 通道与 query 路由互不触碰（App.tsx §2.2 口径）；share v6 升级按「无迁移代码、旧版一次性失效」既有纪律。
6. **依赖锁定**：package.json 依赖零变化（不装新依赖）；零滚动断言经既有 GUI 自动化通道，不引入测试框架。
7. **挂载语义**：App `visitedTasks` / TaskPages `visited` 首展挂载 + hidden 非卸载语义原样保留（切走不卸载，已运行模拟结果/表单输入零丢失）。
8. **可达性**：`check:a11y` 63 组零回退；折叠态/锁标 aria 与可见文案同源，禁 title-only；44px 命中清单全保留（A11）。
9. **诚实性**：折叠态显式归因（预设/custom 两文案）；锁态显示派生值不静默同步（§4.2 拒绝项）；不支持零滚动的机型回退滚动并明示，不静默裁切（§1.0a；回退路径验收 = **A1 人工走查登记项①**——`env()` 不可脚本注入，不作自动化断言）。
10. **零滚动偏差登记（复核修订改写，原「唯一贴线例外」失据；修订对照轮二扩 E1 strict）**：principles@320（600/600 slack 0、E5 单节让渡为其前提）经逐分节静态估算**不成立**——E1 strict ≈230、E2 chain ≈820–1390、E3 market ≈290–330 / child ≈250–270、E4 health ≈330–430 均超分节槽上限 280/196（构成与估算基准见 §1.4 表），桌面 688 阅读列同超（chain ≈840 > 槽 296）。实施轮必须二者择一落地并过 A1 实测方可收口：**(a) 渲染压缩**（EntryRows 来源行/勘误注 <1024 FieldTip 全文下沉 + 紧凑行距 + strict/loose 正文降 caption 档 12px/18px——8 行×18 = 144 ≤ 196，口径说明类内容、P5 反冗长 caption 口径先例；数据层零改动，与 §8.3-3 裁展示项衔接）；**(b) 条目化方案修订**（<1024 条目内两级切换 / chain 步骤化；节点数/键预算/A9 随之变更并重新登记）。方案落定前 principles@320 与 @1440 槽内静态可达性不提供 ✓；E5 条目在其单节让渡前提重建前同样不得挂新内容；`env>0` 机型主槽让渡以图槽 ≥200px 硬底线为界。
11. **EN@1440 零滚动破功登记（素材重制轮发现，2026-11-24；语言维度未入验收矩阵与门禁矩阵）**：§9-A1 六视口×五页×两主题矩阵与 `scripts/zero-scroll-check.mjs` 均不含语言维度——en@1440×900 light 的 freedom 页实测 `.atlas-page` scrollHeight − clientHeight = **92**（隐藏回退横幅后仍 92，纯内容溢出），触发 A1 显式回退横幅（红线 9 的「明示回退」按设计工作，但发布态 EN 首屏即回退不可接受）。根因 = EN 文案超宽族：`basic.formulaRow` "480 rule formula breakdown" 把 44px 解构行撑为三行（wf-anatomy 65px + live 行 18px），叠加字段标签（nominalReturn / inflation / majorInvestment / assetsLabel）与 `ruleOrigin` 段落换行；另有两处横向呈现缺陷同轮发现：构成明细表宽 667 > 卡体内容宽（右缘 ¥200,000 / ¥1,663,904 裁切）、预设画像行四 chip 文本硬裁切。**修复（仅 en.ts 文案缩短，zh / zh-Hant 零改动）**：formulaRow → "480 formula anatomy"（解构行回到 43px 单行）、nominalReturn → "Nominal return (annual)"、inflation → "Inflation (annual)"、majorInvestment → "Major one-time outlay"、assetsLabel → "Existing assets"（optional 语义迁入 tooltip）、ruleOrigin 压缩、presets.names 四画像缩为单词 chip（Single / No kids / One kid / Frugal）、明细表键缩短（rowMultiplier "Expense × mult."、rowChildren "Child reserve ({{children}})"、rowHealth "Health"、rowTotal "Total (ref.)"、multiplierExactLabel "Exact (Fisher)"、criticalExactLabel "Exact line"）。**复验（逐值）**：en@1440×900 light over = 92 → **0**、回退横幅不再出现；明细表宽 667 → 640 且右缘完整（目测核验）；预设四 chip 无裁切；zh@1440×900 light 复测 over = 0 未受影响；`npm run build`（含 `tsc --noEmit`）修复轮全部通过。**跟进（本轮不施工）**：A1 矩阵与 zero-scroll-check.mjs 补语言维度（zh-CN / en / zh-Hant × 视口 × 页 × 主题），登记为验证轮既定跟进项。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令 | 结果 |
| --- | --- | --- | --- |
| A-1 | 尺寸基线 | `node scripts/check-size.mjs` | `DIST_TOTAL_KB=1950`、`WASM_MAX_KB=349`、门禁通过；find+stat（排除 dist/.git）= **1,996,781 B**、wasm **356,870 B**（§8.1） |
| A-2 | 禁词零命中 | `grep -inE` 对任务书给定禁词清单（13 词：4 个来源品牌词 + 9 个材质/动效词，词表本身不入本文）逐词扫描全文 | 0 命中（起草后复跑） |
| A-3 | 关键行号实测 | 本会话 Read/grep | store（:94-95/:109-111/:167-187/:203-241/:256/:268/:294-347）、share.ts（:53/:159）、presets.ts（:27-68，数据体 :39-68——复核修订勘误，原引 :36-66 漂移）、ScenarioPanel（:148/:192/:260）、MonteCarloPanel（:100-102/:593-624）、global.css（:107/:186-199/:212-268/:506-510/:837-838/:686-695/:727-734/:1421-1427/:1461-1478/:1495-1501/:1675-1679）、hooks.ts（:78-124）、AdvancedPanel（:48-76/:96-150/:179）、TaskSwitcher（:74-77）、InsightsPanel（:81-146）、i18n zh-CN（:23-24 footer 键/:97 presets 块/:151 atlas 块/:445 mc 块）逐一实读核对 |
| A-4 | 局限声明 | — | 高度预算为静态推算（承 research-p10-layout 自检），未做浏览器渲染实测；A1 门禁为把预算变为可执行检查的路径。联动矩阵与单源化状态机为设计裁定（未实施）；§5 修复为行级规格（未施工）。 |
| A-5 | 复核修订轮登记（2026-11-23） | 7 条复核结论逐条吸收（P0×1 / P1×3 / P2×3），修订仅落本文，代码零施工 | ① **P0**：§1.1 增补叶切换条 F0（复用 `basic.outputTitle`/`basic.inputTitle`，新键预算 17 不变），44px 命中/键盘漫游入 A11/A10，A9 增等高互换断言，§1.6 节点 29→30、切换节点 14→15（枚举含 F0），freedom 加总按卡壳规则重算（叶A 530 / 叶B 584 ≤600；页栈 742 ≤756）；② **P1**：§1.4 逐分节槽分解回填（P2 = 32+分节1槽≤280、P3 = 32+分节2槽≤196+16），静态估算 E2 chain / E3 market / E3 child / E4 health 超上限 → principles 偏差登记（红线 10 改写、§1.6 表改 ✗、文档头验收底稿行标注例外）；③ **P1**：freedom 左列 696 按行项拆解为 742（卡壳取值：卡头 46 = token.less:11+global.css:1355、卡体 16×2 = `@spacing-7`、分享行 28+12、卡间距 16 = BasicCalculator.tsx:976），life/risk/pro 左列 600 常量明示为上限断言（行项归 A9 回填）；④ **P1**：A1 扩为「页根 + 后代可滚动元素枚举」三重判定、写明 visitedTasks 前置遍历（App.tsx:539/:563/:575/:596/:617），IME 给出视口收缩模拟自动化口径并降级真机项为人工走查②；⑤ **P2**：T3 「六选择器」改「五选择器」（global.css:1496-1500 实读 5 个）；⑥ **P2**：presets.ts 区间 :36-66 → :27-68（:28-37 接口区 / 数据体 :39-68；§3.1 与本表两处）；⑦ **P2**：env>0 回退路径登记 A1 人工走查项①（§1.0a 与红线 9 联动）。research-p10-layout / research-p10-linkage 保留起草时点原文（其 §3.2 总表、presets.ts:28-37 引用、A-3 自检为修订前值），以本文为准。**修订对照轮二连带修正（⑧⑨，非七条 findings 直指，由 P0 重算与源码补读牵出）**：⑧ 反向卡 244/280 整卡断言经 ReversePanel.tsx:83-197 全读证伪（实高 ≈540/558：6 字段+算例行+同步钮+Descriptions 3 项+note，F8 槽与右列均不可容整卡）→ 改卡内双态「估算结果 ⇄ 编辑参数」恒高 228（§1.1 卡壳规则段、F8 行、右列 740→742、§1.6 表同步），新键 `reverse.viewResult`/`reverse.editParams` → §7 = 19 键 ×3 语 = 57 条（A13/§8.2 同步）、A9 增双态等高互换、S18 增卡容器宿主；⑨ §1.4 原表 E1 分节2 标 ✓ 系对照 280 上限误读（≈230 > 分节2 槽 196）→ E1 strict 并入偏差清单，路线 (a) 增补 strict/loose 降 caption 档扩展项（12px/18px → 144 ≤ 196），i18n 实测长度（strictBody 67/looseBody 77/chainIntro 68/anchorNote 57/marketNote 59/childShort 50 字符）随本会话脚本测量登记 |

---

## 修订对照（文末登记：上轮复核 REJECT 七条逐条吸收 + 连带修正；明细证据见附 A A-5）

| # | 级别 | finding 摘要 | 处置 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | P0 | freedom <768「双叶」无叶间切换节点：两叶同屏 ≈1060 > 600 违反 §1.0 判据且 A1 在 freedom@320 必挂；若分叶切换，则切换条无节点行/无键/无 44px 命中行/无键盘语义 | 增补 F0 叶切换条节点（复用 basic.outputTitle / basic.inputTitle 零新键）；§1.6 节点 29→30、切换节点 14→15；freedom 加总按卡壳规则重算（叶A 530 / 叶B 584；页栈 742）；44px 命中入 A11、方向键漫游入 A10、A9 增叶切换断言 | §1.0a、§1.1、§1.6、§7、§9-A9/A10/A11 |
| 2 | P1 | principles@320 加总不可由条目表推导：分节2槽 196 无来源；两分节各按 280 计则 684 > 600，贴线登记失据 | 逐分节槽分解回填（P2 = 32+分节1槽≤280、P3 = 32+分节2槽≤196+16）+ 逐条目静态估算——E1 strict / E2 chain / E3 market / E3 child / E4 health 五处超限 → principles@320 与 @1440 槽内静态可达性**登记偏差**（红线 10 改写：路线 (a) 渲染压缩含 strict/loose 降 caption 档扩展项 / (b) 条目化方案修订，A1 实测裁决）；文档头验收底稿行同步标注例外 | §1.4、§10-10、文档头验收底稿行 |
| 3 | P1 | 桌面左列 696/640 与 600 常量为断言值非行项加总；Card 头/卡体 padding/卡间距不入任何节点行 | freedom 左列按行项拆解 742（卡壳取值全部引在册值：卡头 46 = Card/style/token.less:11 + global.css:1355、卡体 16×2 = @spacing-7、分享行 28+12 = global.css:1266、卡距 16 = BasicCalculator.tsx:976）；卡头 <1200 退役走宪法 §5.2 信息迁移登记（title→F0 分段标签、liveUpdate→F1 caption）；life/risk/pro 左列 600 明示为上限断言，行项回填归 A9 施工清单、超限返工 | §1.1 卡壳规则段、§1.6 左列常量口径段 |
| 4 | P1 | A1 仅采样两元素、检不出后代内滚（§2-T7 漏删即漏检）；缺 visitedTasks 前置遍历（空页断言恒真）；IME 态无程序化口径 | A1 扩三重判定（页根 scrollHeight/clientHeight + querySelectorAll('*') 后代可滚动元素枚举 + Content overflowY）+ 前置逐页遍历（App.tsx:539/:563/:575/:596/:617）；IME = 视口收缩模拟自动化口径 + 真机弹起降级人工走查登记项② | §9-A1 |
| 5 | P2 | 「.wf-is-stuck 六选择器」实为五个 | T3 改「五选择器」并列名（global.css:1496-1500 本会话 sed 实读恰 5 个） | §2-T3 |
| 6 | P2 | presets.ts 行号漂移：spec 引 :36-66，实为接口区 :28-37 + 数据体 :39-68 | 改 :27-68 并分区分注（:27 注释 / :28-37 接口区 / :39-68 数据体；sed 实读复核 :43/:50/:57/:64 值行一致） | §3.1、附 A-3 |
| 7 | P2 | env>0 回退路径（明示横幅 + 回退后页行为）无任何验收断言，红线 9 落空 | env() 不可脚本注入 → 登记 A1 人工走查登记项①（明示横幅可见 + 页根允许滚动例外 + 主槽 200px 硬底线 + 无静默裁切）；红线 9 同步引用 | §1.0a、§9-A1、§10-9 |
| 8 | 连带（非 findings 直指；P0 重算 + ReversePanel.tsx:83-197 全读牵出） | F8 第三态「反向估算卡」与桌面右列反向卡 244 均为未验证断言：整卡实高 ≈540（<768 单列）/≈558（桌面全量，字段全宽单列）——280 槽与右列均不可容整卡，与前轮 principles 同类缺口 | 反向卡改卡内双态「估算结果 ⇄ 编辑参数」恒高 228 = 卡体 16 + 双态切换条 36 + 内容区 176（结果态 162/52；编辑态分页 3 页×2 字段或 2 页×3 字段，末页含算例行+同步钮 = 176）；新键 reverse.viewResult / reverse.editParams → §7 = 19 键 ×3 语 = 57 条（A13/§8.2 同步）；右列 740→742（页栈 max 742 不变）；信息路径零丢失（读数/编辑/算例/同步全量可达），A9 增双态等高互换断言，S18 增卡容器宿主 | §1.1 F8 行与卡壳规则段、§1.6、§6-S18、§7、§8.2、§9-A9/A13 |
| 9 | 连带勘误（修订对照轮二） | 原表 E1 分节2 标 ✓ 系对照 280 上限误读：≈230 > 分节2 槽上限 196（strictBody 67→4 行 + looseBody 77→5 行 × 25.6，阅读档 16px/1.6） | E1 strict 并入偏差清单（finding 2 落点同步修正）；路线 (a) 增补 strict/loose 降 caption 档扩展项（8 行×18 = 144 ≤ 196）；i18n 关键长度本会话脚本实测登记（strictBody 67 / looseBody 77 / chainIntro 68 / anchorNote 57 / marketNote 59 / childShort 50 / healthShort 44 / evidenceShort 43 字符） | §1.4、§10-10、附 A-5 |

---

## 实施结果与收口记录（2026-11-24 收口登记）

> 性质：P10 实施与验收收口登记。**本节全部命令与读数均为收口会话（本文档轮）实跑实测，非转抄**；运行通道 = `npm run build` 后 `npm run preview`（vite preview, 127.0.0.1:4173）＋ GUI 自动化通道（browser-use IAB Chromium）注入 `scripts/zero-scroll-check.mjs` 的 `pageStepFn` 贪心遍历（红线 6：零新依赖、不引入测试框架）。零滚动矩阵在本轮**扩测语言维度**（§10-11 既定跟进项的实测补数）：zh-CN 显式固定写入 `wf-lang` / en 为该环境存量值，逐组回读 `document.documentElement.lang` 与 `wf-theme` 确认注入生效（首轮注入失效组已作废重跑，见 R-4 末）。

### R-1 改动文件清单（`git status` 实测；32 修改 + 6 新增 + 4 素材重制）

- **修改（32）**：`src/App.tsx`、`src/main.tsx`、`src/styles/global.css`、`src/components/{BasicCalculator,TaskPages,AdvancedPanel,LifeTrajectoryCard,fields,hooks}.tsx/.ts`、`src/components/advanced/{AccumulationPanel,CurrencySection,InsightsPanel,LoanPanel,MonteCarloPanel,PensionPanel,RentalPanel,ReversePanel,ScenarioPanel,TaxPanel}.tsx`、`src/data/defaults.ts`、`src/store/useCalculatorStore.ts`、`src/services/share.ts`、`src/i18n/locales/{zh-CN,en,zh-Hant}.ts`、`scripts/{check-data,check-share}.mjs`、`scripts/plugins/purgeArcoCss.ts`。
- **新增（6）**：`src/components/slots.tsx`（SegBar/SlotBox 槽套件）、`src/components/RiskPage.tsx`（risk 页 2 叶）、`scripts/zero-scroll-check.mjs`（A1 机读承载）、`docs/p10-spec.md`、`docs/research-p10-layout.md`、`docs/research-p10-linkage.md`。
- **素材重制（4，素材重制轮）**：`docs/assets/{,en/}demo-workbench.png`、`docs/assets/{,en/}demo-workbench-flow.gif`（GIF 288 帧 → 382/383 帧，本文档轮以 git show + sharp 实测帧数）。
- 规模（`git diff --stat`）：32 文件 +3,705/−1,930 行；`src/wasm` 零变化（R-3）。

### R-2 分轮登记（轮名以代码注释与文档在册为准）

1. **实施轮**：§2.1 骨架（Layout 100vh→100dvh 覆写、Content flex:1+min-height:0+overflow:hidden、任务切换反馈 scrollIntoView 退役保留 preventScroll 焦点迁移、迁移/换算 Alert 改覆盖层、Footer 元素退役声明迁 E5）；§2-T1–T12 退役与迁移（T1 顶栏 sticky、T2 输出卡吸附三件套、T3 D9 吸附态紧凑减法——`<640` 环 56 保留、T4 穿透层、T5/T6 底 dock 改 flex 静态行、T7 左列 sticky+内滚、T8/T9 scroll-margin、T11 Footer、T12 S19 选择器条件简化）；槽套件 `slots.tsx`（SegBar 复用 Radio.Group 语义、SlotBox 等高互换）＋ `RiskPage.tsx`（K1–K4）＋ 五页切换树落位（freedom F0–F9 / life L1–L5 组收敛 7→5 / principles 条目化＋E5 迁入 / pro 槽化）；§3 预设联动（`childCount===0` 谓词折叠「未启用（预设）」）＋ §4 单源化（store 布尔 `mcMeansSynced`、锁态派生直显、share v6 第 13 键严格布尔闸 share.ts:313-316、`applyShareState`/`buildShareState` 随链恢复 store:320/:347）＋ §5 V-F-1 修复（ScenarioPanel 基准列 deps 补 reverseInputs/taxInputs/monteCarloInputs 三切片）＋ i18n 新键 19 ×3 语 ＋ **A1 显式回退守卫**（App.tsx:103-153 轮询页根溢出 → `wf-fallback-scroll` 放行滚动 + `App.tsx:561` 警示横幅，`atlas.scrollFallback` 三语键）。
2. **骨架修复轮**（代码注释在册：slots.tsx:38、App.tsx:103、BasicCalculator.tsx:100/:142/:310/:523/:591/:1120/:1196）：槽本体从固定高改 `flex:1 1 0` 填充页内剩余空间＋`min-height` 下限；`≤480` 紧档龙卷风图 240→200；`<768` 明细 7 行改**行分页**（F1/F9 收口：7 行明细 ≈459 超槽）；hero 行 72→56（双栏右列页栈回 756 预算内）；紧档进度说明去重与口径注沉降 FieldTip；A1 回退守卫随轮新增。
3. **素材重制轮**（2026-11-24，§10-11 在册）：EN 文案缩短修复 en@1440×900 light freedom over 92→0、明细表 667→640、预设 chip 裁切清零；README 截图与操作流 GIF 双语重制（288 → 382/383 帧）。
4. **本文档收口轮**（2026-11-24）：§R-3 门禁全量复跑 ＋ §R-4 零滚动 71 组实测（语言维度扩测）＋ 本节登记。文档轮零施工。

### R-3 门禁终态（本文档轮实跑，逐道）

| 门禁 | 命令 | 终态 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | 过（0 错误；`npm run build` 内含同检亦过） |
| 数据口径 | `npm run check:data` | 九组断言全部通过 |
| 分享契约 | `npm run check:share` | 八组断言全部通过（v6 往返含 `mcMeansSynced` 布尔闸 + v5/v4/v3 一次性失效 + 三语键集一致） |
| 币种 | `npm run check:currency` | 五组样本断言全部通过 |
| 对比度 | `npm run check:a11y` | 63 组令牌对，白名单外违规 0 |
| 生命周期 | `npm run check:lifecycle` | L1–L13 全部通过（断言 89 项；脚本现至 L13，超出本文 §9-A14 记载的 L1–L6——P9 后扩容，登记） |
| wasm | `cd src/wasm && cargo test` | 15 + 60 = **75 通过 0 失败**（对 §10-1「75 零变化」锚定） |
| wasm 面 | `git diff --stat -- src/wasm` | 全空（含 bridge，红线 1） |
| 尺寸 | `npm run build && npm run check:size` | `DIST_TOTAL_KB=1948`、`WASM_MAX_KB=349`、**门禁通过**；find+stat 实测 dist 合计 **1,994,561 B**（门禁 2,000,000 B 余量 5,439 B；wasm ≤ 387,590 B 缓冲线） |

尺寸记账（§8）：§8.1 基线 1,996,781 B → 实测 1,994,561 B = **净 −2,220 B**（负增长；回收来自 §2-T 退役块超过新增。30,720 B 记账上限未用满，§8.3 降档顺序未触发）。

### R-4 零滚动断言终态（A1；71 组实测，语言维度为本轮扩测）

**判据承载**：`scripts/zero-scroll-check.mjs` = §9-A1 三重判定（①页根 `scrollHeight ≤ clientHeight` ②后代可滚动元素枚举 ③ `#wf-main` overflowY）**＋ ②′ 槽裁切显式拦截**（`.wf-slot`/`.wf-reverse-card`/`.wf-risk-leaf` 任一 `scrollHeight > clientHeight` 即挂——②′ 比 A1 三重更严：overflow:hidden 槽静默裁切 ② 探测不到，必须显式判挂）。

**矩阵**：6 视口（320×720 / 375×667 / 414×896 / 768×1024 / 1180×820 / 1440×900）× 5 任务页 × {zh-CN 亮色全量、zh-CN 深色@320/1440、en 亮色@320/375/1180/1440、en 深色@320/1440} = **70 组 ＋ IME 收缩代理 1 组（375×420）**。每组先经 `?task=` 深链首展挂载，贪心遍历 SegBar 单选钮 / SlotPager 前进钮 / 组内 Tabs 并逐态断言，末态再等 2s 回读（覆盖 wasm 数据落定后的回退判定窗口）。

**zh-CN：40 组实测、39 过 / 1 挂**。六视口亮色 30 组中 29 过（页根 sh=ch 实测：320→566、375→527、414→755、768→900、1180→707、1440→787，过组无溢出、无回退）；深色 @320/1440 共 10 组全过（读数与亮色逐值一致）。唯一挂组 = **risk@375×667**：②′ 槽裁切 `<wf-slot>` **313>279、321>299**（overflow:hidden 槽静默裁切 34px/22px，无滚动、无内滚）。**红线 10 的 principles@320 偏差在 zh 口径已闭合**（路线 (a) 渲染压缩已实施：InsightsPanel `.wf-entry-reading` 阅读段降 caption 档；zh@320 实测 sh=ch=566 过、@1440 sh=ch=787 过）。

**en：30 组实测、15 过 / 15 挂**（亮深同值同构）：

| 组 | 判定 | 读数 | 定位 |
| --- | --- | --- | --- |
| freedom@320×720 | A1① | P1 溢出 **593>579**（+14px） | 页级滚动溢出 |
| freedom@375×667 | A1① | P1 溢出 **571>527**（+44px） | 同上 |
| principles@320×720 | A1① | P1 溢出 **661>579**（+82px） | 页级滚动溢出（EN 长文分节栈超槽） |
| principles@375×667 | A1① | P1 溢出 **577>527**（+50px） | 同上 |
| life@320×720 | ②′ | 槽裁切 **251>242**（9px） | overflow:hidden 槽静默裁切 |
| life@375×667 | ②′ | 槽裁切 **212>200**（12px） | 同上 |
| risk@320×720 | ②′ | **401>332**（69px）、357>351、399>351 | 参数/图槽（贪心深遍态） |
| risk@375×667 | ②′ | **379>279**（100px）、357>299、360>299 | 同上 |
| risk@1180×820 | ②′ | **627>525**（102px） | 槽内容超槽高 |
| risk@1440×900 | ②′ | **627>605**（22px） | 情景叶「Key metric comparison」对比表槽（本会话逐槽定位实读） |

en@1440 freedom/life/principles/pro 全过（freedom over=0）= **§10-11 复验结论复现**。pro 页 zh/en 全视口全过（含 en@320/375，24/23 态贪心遍历零挂）。

**A1 严格口径 vs ②′口径（登记区分）**：按 §9-A1 三重（①②③）口径，挂组 = en freedom/principles@320/375 共 **8 组**（页级滚动溢出）；life/risk 各组**仅在 ②′ 下判挂**（无滚动、无内滚容器，但槽内容被静默裁切——正是 §9-A1② 扩围要拦的失效形态）。

**明示回退机制（红线 9）实测生效**：溢出持续约 2–4s 后页根挂 `wf-fallback-scroll`（overflowY auto）并渲染警示横幅（zh「视口高度不足，本页已回退为可滚动视图。」/ en「Viewport too short — switched to a scrollable view.」，`atlas.scrollFallback` 三语键 grep 在位）——freedom@320/375（en）与 IME 代理组均实测。附带登记：回退横幅自身占内容预算（320 档 ≈61px），回退态为 §1.0a 已登记例外路径（页根放行滚动，A1 判定①②按例外解释，不静默裁切）。

**IME 收缩代理**（375×420，zh-CN，freedom 叶B 路径）：零滚动**不成立**（sh 505 vs ch 279），由明示回退兜底生效、横幅中文在位——§2.1「超收缩由步骤分页消化」口径未达成，登记残留（真机 IME 走查项②维持开放）。

**chrome 实测 vs §1 静态预算偏差（登记）**：`<768` 顶栏实测 **73px**（§1.0a C1 预算 56）、任务切换条 **44px**（预算 48）、页根可用高 320×720 实测 **566（zh）/579（en）** vs 预算 600；`≥768` 顶栏收纳档实测 29px。§1 各加总表按 600/756 常量推算为**修订前静态底稿值**——zh 全过说明现内容在实测 chrome 内成立；en 超限叠加 EN 文案宽度因素（§10-11 同族根因）。§1 预算表以本节实测为准校准，归下一规范轮。

**未跑组（如实声明）**：zh 深色 @375/414/768/1180（20 组）未跑；en @414/768 在注入修正后未重跑（首轮 60 组矩阵在该两视口 10 组全过，但首轮主题/语言注入失效——按环境存量主题（亮色系）与存量 en 运行，主题维度对该两视口未按矩阵验证）；色盲友好档组合（A16）未跑；A1 人工走查项①（env>0 真机）②（真机 IME）未跑（无真机设备）。

### R-5 验收断言 A1–A16 执行状态（本文档轮）

- **A1** = R-4（71 组实测；脚本与 §9-A1 矩阵的语言维度仍未入代码——§10-11 跟进项维持，本轮为数据补测）。
- **A13（部分）**：新增 19 键 ×3 语逐键 grep **全部在位**（本文档轮实跑：presets.childFoldedPreset/childFolded/childEnable、mc.meanSyncLockAria/meanSyncHint/meanSyncRestore、atlas.lifeGroupPlan/lifeGroupAsset/slotChart/slotParams、insights.entryFormula/entryChain/entryData/entryEvidence/entryNotice、basic.stepDesire/stepAssumption、reverse.viewResult/editParams）；`check:data` 过；语言切换往返人工项未跑。
- **A14**：全过（R-3；cargo 75 零变化锁定、`check:lifecycle` L1–L13、`check:a11y` 63 组、share/currency/data、tsc、`git diff --stat -- src/wasm` 全空）。
- **A15**：过（R-3；净增 −2,220 B；§8.3 回收/降档未触发，无降档记录需要登记）。
- **A2–A12、A16**：行为级断言（预设联动四态操作链、单源化锁态/解锁操作链、分享 v6 UI 往返、复位链、切换树等高互换逐读数、键盘漫游与 44px 命中清单、S 抽查七项、色盲档抽查）**本会话未逐条执行**——登记为后续验证轮；其中 v6 数据层往返与 `mcMeansSynced` 布尔闸已由 `check:share` 第八组脚本级覆盖（share.ts:313-316 严格布尔校验 + 往返断言）。

### R-6 残留清单（收口后开放项）

1. **零滚动残留 16 组（en 15 ＋ zh 1，R-4 明细）**：en 组修复路径沿用 §10-11 先例（en 文案缩短）或对比表槽分页（§8.3-3 候选）；zh risk@375×667 槽裁切（313>279、321>299，②′）需槽高补偿或步骤分页复核；本轮均不施工。
2. **语言维度未入 A1 矩阵与 `zero-scroll-check.mjs`**：§10-11 既定跟进项维持；本轮已补 71 组实测数据（zh 40/40 过、en 16 组挂），脚本扩维归下一工程轮。
3. **IME 超收缩由回退兜底而非步骤分页消化**（§2.1 口径未达成）；人工走查项①（env>0 真机回退路径）②（真机 IME）维持开放。
4. **§1 静态预算表与实测 chrome 偏差**（顶栏 73 vs 56、切换条 44 vs 48、可用高 566/579 vs 600）——预算表校准归下一规范轮。
5. **A2–A12、A16 行为断言未逐条执行**（R-5）——归后续验证轮。
