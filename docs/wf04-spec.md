# WF-04 实施规范：三巧思施工（时间透镜 · 公式解构 · 情景叠影）

> 性质：WF-04 交付实施规范——三巧思逐项「交互描述／落点文件／实现方式／动效参数／prefers-reduced-motion 降级／尺寸估算／i18n 键」七段式；性能红线逐条落；施工条目文件级可勾选。
> 输入物（本会话全读／直读）：`docs/research-wf04-lens.md`（180 行全读）；`docs/research-wf04-anatomy-overlay.md`（168 行全读）；`docs/design-language.md`（193 行全读，宪法）；`src/components/LifeTrajectoryCard.tsx`（177 行全读）；`src/components/BasicCalculator.tsx`（1153 行全读）；`src/components/advanced/ScenarioPanel.tsx`（316 行全读）；`src/components/TaskPages.tsx`（78 行全读）；`src/components/hooks.ts`（:25-79 直读 + grep）；`src/components/AdvancedPanel.tsx`（:95-110 与 :150-185 直读）；`src/App.tsx`（:198-227 直读 + grep）；`src/styles/global.css`（令牌区 :25-115 / :331-387、:869-885、:952-968、:1652-1666 直读）；`src/data/defaults.ts`（:231 与 bgMint 两行 grep）；`scripts/check-size.mjs`（:1-40 直读）；`docs/p8-spec.md`（§4.4 / §6.3 直读）。
> 铁律：不装新依赖（package.json dependencies 现状 6 项零增量）；公式与数据流不碰（finance.ts 计算区、bridge.ts、Rust 导出面零改动）；TS strict（build 脚本已含 `tsc --noEmit`，package.json:9）；文档零禁词（任务书 13 词面不在本文复写，扫描记录见 §7）。

---

## §0 范围

### 0.1 本轮施工 = 三巧思

| # | 巧思 | 一句话 | 落点 |
| --- | --- | --- | --- |
| T1 | 时间透镜 | 刻度轨＋逐年读数面板嵌人生轨迹读数卡 | life 任务页 trajectory 组 |
| T2 | 公式解构 | 480 法则公式行变量 token → 输入字段静态高亮 | 自由刻度任务页输入卡 |
| T3 | 情景叠影 | 基准 vs 情景资产路径双线同图 | 专业模式 scenario 组 |

三巧思的交互规格与共存裁定以两份研究文档为准，本文承接为可勾选施工清单（§1）并补齐共存（§2）、性能（§3）、回归（§4）、预算（§5）、验收（§6）五层。

### 0.2 引擎只读消费（grep 反证：零 wasm 触面变化）

- **基线反证（本会话实跑）**：`git status --short` → 仅 2 个未跟踪研究文档、零源码改动；`git diff --stat HEAD -- src/wasm/ src/services/finance.ts src/services/bridge.ts` → **空输出**（零改动）。
- **消费形态**：三巧思全部消费**在库**引擎输出——透镜读 `result.data.timeline` 内存数组（零调用）；叠影调在库 `calcLifecycle`（finance.ts:824，本会话 grep 实证唯一非测试消费点为 LifeTrajectoryCard.tsx:42）×2；解构读 store 既有字段（零调用）。Rust 导出面 `estimate_pension` / `simulate_accumulation`（finance.ts:14/:20，grep 实证）零变化；**实施后同三条 git diff 命令必须仍为空输出**（§6 条 1）。
- **零新依赖**：recharts 已在 dependencies（package.json:24）；叠影所需 `Area` 组件在 vendor_charts 既有 chunk 内（`grep -o "AreaChart" dist/assets/vendor_charts-LmRWq4RN.js` 命中，本会话实证）——预期零新 chunk，登记为实施首验项（§6 条 2）。

### 0.3 事件化施工仍留演进

- `YearRow.events` 恒空口径延续（research-wf04-lens §1.3 引 finance.ts:610 注记）：homePurchase / childBirth / healthPhase 事件化（事件编辑器、事件标记渲染）不在本轮。
- 路径图轮启用项照抄登记：生命周期路径图、跟手检视浮层、十字虚线（research-wf04-lens 范围红线）；叠影的 `--wf-surface-overlay-*` 浮层材质本轮零消费（透镜固定面板口径，research-wf04-lens §1.4）。

---

## §1 三巧思施工清单（逐项七段式；子条目文件级可勾选）

### T1 时间透镜（research-wf04-lens §1 承接）

- **交互描述**：刻度轨（自研 `div role="slider"` + `tabIndex=0`，44px 命中高）＋常驻逐年读数面板。指针 `pointerdown` 吸附最近年 + `setPointerCapture`、`pointermove` 跟手更新；键盘 ←/→ 1 岁、PgUp/PgDn 5 岁、Home/End 首尾、钳 [1, len]；数字键不消费原样冒泡（App 端豁免，§2-S21）。读数七字段全读 `timeline[t−1]`：age（title 20px 主读数）/ openingAssets / contribution（可负）/ withdrawal / events＋pensionStart（本轮仅 pensionStart Tag，复用 `life.pensionStartMark`）/ closingAssets（bold；t > depletedYear 恒 0＋状态行）/ pensionStart 行加注。轨上里程碑标记：pensionStart 实心点 8px、FI 首达空心点 8px、耗尽年竖线 2×20px 挂 `--wf-fall`（形状通道独立于颜色，S10 同构）。
- **落点文件**：新文件 `src/components/lens/LifeLensTrack.tsx`（轨＋面板一体）；接线 `src/components/LifeTrajectoryCard.tsx`（Descriptions 之后、标记轴 aria 行之前，落位次序照 research-wf04-lens §2.1）；豁免扩展 `src/App.tsx`；样式 `src/styles/global.css`（轨＋面板类）；i18n 三语文件 ×3。
- **实现方式**：props 复用 LifeTrajectoryCard 持有的同一 `result.data.timeline` 数组引用（LifeTrajectoryCard.tsx:53-57）与 `summary.fiFirstYear` / `depletedYear` 派生字段——**零新增调用、零 store 触碰**。thumb 定位 `left: calc((t−1)/(len−1) × 100%)` 纯 CSS 百分比、`len===1` 写死 `left:0`（除零防御）；零测量设计（零 getBoundingClientRect / ResizeObserver）。主刻度标签 ≤5 个复用 `compactXInterval(totalTicks)`（hooks.ts:152）。面板表面 `--wf-bg-surface` 实底＋`--wf-radius-m`＋`--wf-hairline-card` 描边＋内距 `--wf-space-3`；未就绪/服务错误/timeline 空整块不渲染不占位；防抖窗口旧数据在则轨不禁用、容器随 Descriptions 同步 `opacity 0.45`（LifeTrajectoryCard.tsx:84 同源）、落定后 t 钳制不重置。
- **动效参数（时长＋缓动走既有令牌）**：**零自设动效**——面板常驻无显隐过渡、thumb 位移为 pointer 直接操纵非动画、数值即时替换、拖动反馈自始静态高亮（选中＝thumb 实底＋里程碑点描边强调，静态）。0 处 CSS 过渡、0 处 JS 动画（research-wf04-lens §3.1 盘点照抄）。
- **prefers-reduced-motion 降级**：两模式行为一致、**零降级分支**；`usePrefersReducedMotion` 不引入（零多余 matchMedia）；CSS 兜底块（global.css:954-960）无目标可命中。任务书「拖动反馈改静态高亮」的兑现＝高亮通道自始静态，无需降级开关（research-wf04-lens §3.1 如实登记口径）。
- **尺寸估算**：+2.2 ~ +3.2 KB（i18n ≈0.7 ＋ JSX 1.2~2.0 ＋ CSS 0.3~0.5 ＋ wasm 0；research-wf04-lens §4.2 原样承接）；i18n 并合 9→7 后 +2.05 ~ +3.05 KB。
- **i18n 键（9 键 ×3 语；并合预案 7 键）**：`life.lensLabel`／`life.lensHint`／`life.lensYearNo`／`life.lensOpening`／`life.lensContribution`／`life.lensWithdrawal`／`life.lensClosing`／`life.lensAfterDepleted`／`life.lensValueText`（简体基准值逐字照 research-wf04-lens §4.1）。复用：`life.pensionStartMark`／`life.pensionStartAt`／`life.timelineLabel`（零新增）。并合预案：`lensHint` 并入 `lensLabel` aria 拼接、`lensYearNo` 由 `lensValueText` 模板承载（−0.15 KB）。

施工条目（文件级）：

- [ ] **L1** 新文件 `src/components/lens/LifeLensTrack.tsx`（轨＋面板＋状态分支，props：`timeline` / `fiFirstYear` / `depletedYear` / `money`；全部键盘与 pointer 语义按上）
- [ ] **L2** `src/components/LifeTrajectoryCard.tsx` 接线（Descriptions 后插入；props 传同一 timeline 引用）
- [ ] **L3** `src/App.tsx` 豁免集合扩展（:201-207 判定加 `target?.getAttribute("role") === "slider"`；§2-S21 裁定 a）
- [ ] **L4** `src/styles/global.css` 轨/面板类 3~5 个（全部引用既有令牌，零新令牌键）
- [ ] **L5** i18n 三语 9 键（并合预案启用时 7 键；`check:share` 键集断言自动覆盖）

### T2 公式解构（research-wf04-anatomy-overlay §1 承接）

- **交互描述**：输入卡内公式行「A = 480X + KN + M + H」（caption 档）——A 为结果锚不可点击；X/K/N/M/H 为可点击 token（`<button>`）：Tab 按书写序漫游、hover 300ms 预览、Enter 锁定/解锁切换、Esc 清除锁定并把焦点还回原锁定 token、触屏 tap 直锁。点击 token → 目标字段**静态**高亮（1px 描边类＋label 加粗；置位/清除事件成对）；行尾同步「当前解构：{{name}}」aria 冗余行。K/N 在 Switch 关时 token 禁用态（aria-disabled＋tooltip 开启路径说明），公式形状恒完整。
- **落点文件**：新文件 `src/components/FormulaAnatomyRow.tsx`；接线 `src/components/BasicCalculator.tsx`（:1133 `</Collapse>` 之后、:1137 `.wf-share-row` 之前——本会话实读锚点，与 research §1.1 一致）；样式 `src/styles/global.css`；i18n 三语文件 ×3。
- **实现方式**：映射表 6 行照 research §1.2（X→AmountField :1003-1012、K→:1042-1053、N→IntField :1033-1041、M→:1066-1076、H→:1056-1065、A→输出大数字 :784-791 仅展示）；高亮类 `box-shadow: var(--wf-focus-ring)`（既有双环现值 global.css:115/:386，主题联动零新键）＋label bold 既有通道；tooltip「变量语义＋边际影响句」复用组件库 Tooltip 既有覆盖档；token 挂 `.wf-pressable` 既有按压反馈类（全站既有行为，非新增动效）。字段高亮为纯展示态（组件局部 state），**零 store 写入、零参数修改**。
- **动效参数（时长＋缓动走既有令牌）**：解构强调**无动画**（纯静态描边＋加粗）；tooltip 进出场沿用组件库既有覆盖档（非本轮自设参数）；无任何自设时长/曲线。
- **prefers-reduced-motion 降级**：解构强调本就无动画、零 JS 动画消费点（hooks.ts `usePrefersReducedMotion` 本项零消费——如实登记）；tooltip 内建过渡由 CSS 兜底块（global.css:954-960）压停；触屏/无 hover 无预览、tap 直锁（research §1.5 全量采纳）。
- **尺寸估算**：并合后 ≈+2.6 ~ +3.3 KB（research §4.2 批 1 口径：i18n 8→4 键 ≈1.1 ＋ 组件 1.2~1.8 ＋ CSS ≈0.2）。
- **i18n 键（8 键 ×3 语；并合预案 4 键）**：`basic.formulaRow`／`anatomy.varX`／`anatomy.varK`／`anatomy.varN`／`anatomy.varM`／`anatomy.varH`／`anatomy.escHint`／`anatomy.lockedAria`（用途照 research §4.1）。复用：`basic.monthlyExpense`／`basic.childCost`／`basic.childCount`／`basic.majorInvestment`／`basic.healthReserve` 5 个字段名键（零新增）。并合预案：5 个 var 键并 1 模板键 `anatomy.varNote`（「{{sym}}＝{{name}}：该项贡献 {{term}}」）→ −4 键。

施工条目（文件级）：

- [ ] **A1** 新文件 `src/components/FormulaAnatomyRow.tsx`（token 行＋tooltip＋aria 冗余行＋锁定态）
- [ ] **A2** `src/components/BasicCalculator.tsx` 接线（:1133 后插入；字段锚点 id/寻址按 §1.2 映射表；高亮置位/清除成对）
- [ ] **A3** `src/styles/global.css` 解构类 2~3 个（`.wf-anatomy-*`；高亮类挂 `--wf-focus-ring` 现值，零新令牌键）
- [ ] **A4** i18n 三语 8 键（并合预案启用时 4 键）

### T3 情景叠影（research-wf04-anatomy-overlay §2 承接）

- **交互描述**：scenario 组对比表上方追加图卡；图卡头置叠影开关（Switch＋`.wf-touch-target` 44 命中）。恒两线：基准实线挂 `resolveThemeTokens().primary`、情景虚线（strokeDasharray "6 4"）按差异方向挂 rise/fall；逐年龄差值区间 Area 填充挂 bgMint（C-6 已准入键，defaults.ts:273 浅 #DCEEE8 / :338 深合成，本会话 grep 实证）；▲/▼ 字形冗余写入图例与差异表（S10）。X 轴＝YearRow.age，以 age 对齐、短序列尾部 null 不连线（connectNulls 缺省 false）；情景耗尽后线落 0 水平延续；Y 轴刻度与图尺寸恒定只动数据形；图高按 D5 三档 240/280/320px。图下逐年差异兜底表（年份/基准/情景/差值四列）＋`life.depletedAt` 复用标注。
- **落点文件**：新文件 `src/components/advanced/ScenarioOverlayChart.tsx`；接线 `src/components/advanced/ScenarioPanel.tsx`（对比表块 :272-273 之前插入图卡）；样式 `src/styles/global.css`（图例类）；i18n 三语文件 ×3。
- **实现方式**：数据源两裁定——基准＝`calcLifecycle`（当前 store 六切片，与 LifeTrajectoryCard.tsx:42-48 同构入参）；情景＝`calcLifecycle`（`decodeShareState(entry.payload).state` 切片映射，ShareState 已含全部切片零载荷变更；解码失败不进候选，ScenarioPanel.tsx:237 既有 valid 判定复用）。**不写 store**：情景切片只读解码进组件局部态（与「载入」applyShareState 语义互斥并存）。重算形态＝敏感性 effect 同款（BasicCalculator.tsx:697-717 先例）：`window.setTimeout(DEBOUNCE_MS)` ＋ stale 布尔 ＋ `clearTimeout` cleanup；触发源＝开关置位/情景选中变更/基准参数落定帧；开关未置位零调用。恒两线裁定（多情景仍由对比表 ≤12 列承载，research §2.4）。
- **动效参数（时长＋缓动走既有令牌）**：数据落定线插值 base 240ms（`MOTION_DURATIONS.base`，defaults.ts:231 本会话实读）＋`animationEasing: "ease-out"`（BasicCalculator.tsx:157-161 既有 barAnimationProps 同参数，非新曲线）；`isAnimationActive={!reducedMotion}`；Tooltip cursor 静态（textTertiary＋"3 3"，BasicCalculator.tsx:169 同参数）。
- **prefers-reduced-motion 降级**：hook 短路为**唯一闸**（图表内建动画 CSS 兜底管不住，global.css:953 注释口径；research §2.4 同口径）；S20 tabPane 淡入同帧被同一兜底块压停、终态一致（§2-S20）。
- **尺寸估算**：并合后 ≈+4.3 ~ +5.3 KB（research §4.2 批 2 口径：i18n 8→6 键 ≈1.7 ＋ 组件 2.5~3.5 ＋ CSS ≈0.2）；Area 已在 vendor chunk（§0.2）→ 预期零 chunk 增量（实施首验）。
- **i18n 键（8 键 ×3 语；并合预案 6 键）**：`scenario.overlaySwitch`／`scenario.overlayLegendBase`／`scenario.overlayLegendScenario`／`scenario.overlayChartAria`／`scenario.diffTableTitle`／`scenario.diffColYear`／`scenario.diffColDelta`／`scenario.overlayEmpty`（用途照 research §4.1）。复用：`life.depletedAt`（零新增）。并合预案：`diffTableTitle` 与两列头并 1 键 → −2 键。

施工条目（文件级）：

- [ ] **O1** 新文件 `src/components/advanced/ScenarioOverlayChart.tsx`（开关＋双线＋Area 差异区＋图例＋差异表）
- [ ] **O2** `src/components/advanced/ScenarioPanel.tsx` 接线（对比表前插入；解码映射＋300ms 防抖＋stale 丢弃＋2 处直接 calcLifecycle）
- [ ] **O3** `src/styles/global.css` 图例类 1~2 个（零新令牌键）
- [ ] **O4** i18n 三语 8 键（并合预案启用时 6 键）

### 施工序（批次即回收手段）

批 1＝T1 时间透镜（+2.05~3.05，最小增量先行）→ 批 2＝T2 公式解构 → 批 3＝T3 情景叠影（最大增量殿后）。**每批写码前第一步执行 p8-spec §6.3 回收盘点**（i18n 并合复审 → CSS 复用审计 → dist 资产排查），每批收口跑 `npm run build && npm run check:size` 复测登记后方可开下一批。

---

## §2 与既有 S 项共存裁定（逐项）

### S16 输出卡因果闪亮（design-language §2.1：hooks.ts:302 / global.css:1652-1666，本会话实读两处）

| # | 裁定 | 内容 |
|---|---|---|
| ① | 落点互斥 | 公式行挂 :1133-:1137 区（输入卡尾部），在 BasicCalculator.tsx:822 `key={flashEpoch}` 重挂域之外（不同 DOM 子树）——落定重挂不得扰动 token 焦点与锁定态（research §1.4 三条款原样承接） |
| ② | 分域共存 | S16 主色 8% 底淡出落输出卡；解构静态描边落输入区字段——两域无叠加竞态、不设互斥闸 |
| ③ | 时机错峰 | S16 由 300ms 防抖落定驱动（:629 flashEpoch），解构由用户点击驱动且纯静态；slow 360ms 单发窗口（:630-636）内新落定不重播＝epoch 单调递增既有语义，零机制新增 |
| ④ | 叠影/透镜与 S16 | 无交集：ScenarioPanel 与 LifeTrajectoryCard 均无 `useFlashOnChange` 消费点（两文件全读实证），不同组件树 |

### S21 数字键切组（design-language §2.1：AdvancedPanel.tsx:99 makeTabsKeyDown；App 容器 App.tsx:198-224，本会话直读）

- **裁定 a（豁免扩展，透镜硬前置）**：App.tsx:201-207 既有豁免集合仅覆盖 INPUT/TEXTAREA/SELECT/contenteditable——**本会话实证缺口**：`role="slider"[tabIndex=0]` 的 target.tagName 为 DIV、不在集合内，焦点落于刻度轨按 1–5 会触发 selectTask（App.tsx:218-223 数字分派；life 页非 pro、:217 早退不生效）。L3 条目把 `target?.getAttribute("role") === "slider"` 计入判定。pro 模式 makeTabsKeyDown 判定原文（App.tsx:199 注释引 :100-107）**同款不联动**——透镜不在 pro 页零改动；未来 slider 落 pro 页须同款扩展（登记注记）。
- **裁定 b（轨侧键位）**：轨 onKeyDown 对 ←/→/PgUp/PgDn/Home/End `stopPropagation`（防容器级键位误触）；数字键不消费、不 stopPropagation（豁免由 App 端判定，与「显式输入豁免」语义同构——design-language §2 S21 定义）。
- **保活语义**：life 页六组 hidden 非卸载（TaskPages.tsx:70-74，本会话实读）——拖动中切组不丢选中 t 与组件状态；切组后焦点回落属浏览器 hidden 既有行为，非本轮引入（登记为走查项，§6 条 9）。

### S25 图表 hover 读数（design-language §2.1：5 图 Tooltip 现状；BasicCalculator.tsx:169 本会话实读）

- 叠影图＝S25 **第 6 个消费图**：cursor 描边挂 textTertiary＋虚线 "3 3"（:169 同参数）、气泡复用 `.wf-chart-tip`（global.css:1733，grep 实证）、气泡三行＝基准值/情景值/差值（▲▼ 冗余，S10 同构）。
- 单图不挂 syncId（多图联动机制无联动对象，design-language §2.1 S25 深色行口径）；`恒两线`裁定保住气泡可读（>2 线气泡超载，research §2.4）。
- 触屏/读屏降级同构：无 hover 无气泡 → 逐年差异表兜底（S25 既有降级语义）。

### S20 标签指示条滑动（design-language §2.1：AdvancedPanel.tsx:179，本会话 sed 实证 :179 `animation={{ inkBar: true, tabPane: true }}`）

- 叠影图挂 scenario Tabs pane 内——hidden 非卸载承载（AdvancedPanel.tsx:168-175 注释口径，本会话直读）：切组/切 Tab 不卸载、不重算、不重播入场；防抖不被 Tab 切换触发。
- 首次显示同帧叠加裁定：tabPane 淡入（组件库开箱）与线插值 base 240ms 同帧发生——**不设互斥闸**：不同元素、不同通道、均 ≤360ms，reduced-motion 下 CSS 兜底块同停两者、终态一致（S20 降级语义同构）。
- 返回已显示 Tab 不重播：数据未变则 recharts 不再播入场——组件库行为依赖，登记为实施走查项（§6 条 16）。

### 其他触面（零机制新增）

| 项 | 裁定 |
|---|---|
| S3 度量字排 | 透镜数值行/叠影差异表挂既有 `tabular-nums` 规则与 `.wf-num`/bold 通道，零新代码 |
| S10 方向冗余编码 | 差异表与气泡 ▲▼ 字形（形状通道独立于颜色）；透镜里程碑形状通道同构 |
| S18 渐近滚动 | 透镜数值行**有意不消费**（拖动跟手优先，即时替换与渐近收敛语义冲突）——登记性不消费；本轮零新增 S18 接入点 |
| S2 / S6 / S19 / S22 / S24 | 零交集：三巧思零庆祝动效（S2 全站唯一 expressive 不变）、零空态新增、零悬浮卡、零主题揭示、零错误标线触面 |

---

## §3 性能红线（违反即返工）

1. **透镜拖动零 wasm 调用——纯内存数组索引**：读数 = `timeline[t−1]` 纯索引（props 同引用，LifeTrajectoryCard.tsx:53-57 持有）；里程碑标记 = summary 字段静态派生。拖动全程零 `calc*` 调用、零 wasm 触发；`useFinanceCall` 调用点 9 处不增（§4 条 5）。防抖窗口（loading 且旧 data 在）轨照常可拖——旧 timeline 是完整内存数组（research-wf04-lens §2.2 口径）。
2. **叠影双路径重算防抖落定口径**：独立 300ms 防抖（`DEBOUNCE_MS` 先例 BasicCalculator.tsx:38），**不与读数卡 useFinanceCall 共用实例**；触发源仅三种（开关置位/情景选中变更/基准参数落定帧），开关未置位**零调用**（零基线开销）；形态 = setTimeout＋stale 布尔＋clearTimeout（BasicCalculator.tsx:697-717 / ScenarioPanel.tsx:120-131 双先例同款）；两调用 `Promise.all` 并行、过期结果丢弃；预算 ≤100ms（单调用实测 32.67ms ×2，research §2.3-④ 引 p8-spec :480/:296）。防抖窗口内旧图保持、禁闪烁（敏感性既有口径同构）。
3. **监听器 cleanup**：透镜**零手动全局监听**——pointer 全走 React 合成事件＋`setPointerCapture`（capture 保证拖出轨区后 move/up 仍派发）；`pointercancel` 与 `pointerup` 同分支（释放 capture＋落定），不得只处理 up；卸载随 React 自动回收。**偏离登记条款**：实施中引入 `addEventListener` / `matchMedia` / `ResizeObserver` / `getBoundingClientRect` 任意一项＝偏离规格，须回零监听形态或改规格并复检。叠影防抖 timer cleanup 成对（return 内 clearTimeout），stale 布尔闭包丢弃过期结果。
4. **rAF 闸**：透镜零 rAF、零动画、零 `usePrefersReducedMotion`（零多余 matchMedia）；叠影唯一动画通道是 recharts 插值，reduced 短路为唯一闸（CSS 兜底块管不住图表内建动画，global.css:953 注释口径）；本轮任何 rAF 数值滚动**仅可**经 `useAnimatedNumber`（hooks.ts:205，内部 reducedMotion 消费 hooks.ts:207 本会话 grep 实证；可见性闸 design-language §2.1 S18）——透镜有意不接入（§2-S18）。

---

## §4 回归红线（违反即返工）

1. **S1–S26 零回退**：抽查锚点——S2 BasicCalculator.tsx:339-362＋global.css:1262-1269、S16 hooks.ts:302＋global.css:1652-1666、S18 hooks.ts:205、S22 App.tsx:45、S25 五图（BasicCalculator.tsx:169 实证其一）、S6 四空态＋缺席位（ScenarioPanel.tsx:287 实证其一）——全部本会话实读/grep 在位。
2. **九功能可达**：专业模式三组九面板整壳零改动（AdvancedPanel 组定义、Tabs pane key 零变化——叠影挂 pane **内**，不增 pane 不改 key）；九面板逐一可达零回退。
3. **深链接**：`?task=` 四任务 + `?task=pro&panel=<key>`（App.tsx:598 注释实证）+ wf-route 持久化零变化；透镜选中 t 为**瞬态不入盘不入 URL**（App.tsx:227「瞬态 UI 不入盘」wf-route §2.3 同口径）。
4. **三语**：全部新键三语齐全；`npm run check:share` exit 0（键集一致性断言自动覆盖，p8-spec §3.8 同款零脚本改动）。
5. **useFinanceCall 调用点变化登记**：hook 调用 **9 处零变化**（本会话 grep 实证清单：BasicCalculator:569、LifeTrajectoryCard:40、RentalPanel:255、PensionPanel:62、AccumulationPanel:88 与 :132、LoanPanel:40、TaxPanel:107、ReversePanel:55——与 p8-spec.md:474 收口值一致）。**叠影新增 = +2 处直接 `calcLifecycle`（非 hook）**：直接 calcLifecycle 消费 1 → 3 处、直接 calc* 调用 11 → 13 处（p8-spec.md:381 现状口径）；p8-spec.md:383「唯一新增」口径更新为「P8 +1 hook / WF-04 +2 直接调用」——**登记性变更，实施轮回写**。透镜与解构零新增调用。
6. **wasm 触面**：零 Rust 改动——实施后 `git diff --stat HEAD -- src/wasm/ src/services/bridge.ts` 必须仍为空；`WASM_MAX_KB=379` 零增量；pass1/pass2 锁区与锁定测试零触碰（p8-spec §5-6 照抄）。
7. **share v4 零变化**：SHARE_LINK_VERSION 保持 4、键清单零增量；叠影只读消费 `decodeShareState`、不触碰 `applyShareState`（ScenarioPanel.tsx:151-155「载入」语义互斥并存）。
8. **公式与数据流不碰**：finance.ts 计算公式区、bridge.ts、store 切片集、YearRow 输出契约零变化（events 恒空口径延续，§0.3）；解构高亮为组件局部展示态、零 store 写入。
9. **TS strict**：`npm run build` 含 `tsc --noEmit`（package.json:9）必须 exit 0；新组件 props 显式类型、禁 any。
10. **D9 口径精确化登记（有意差异）**：读数卡既有注释「纯读数卡：无输入控件」（LifeTrajectoryCard.tsx:3-4）——透镜 slider 是**只读检视控件**（零 store 写入、零参数修改，仅选择读数行），「无参数输入控件」语义不被打破，「无控件」字面失准；登记为口径精确化，理由：透镜是时间维度的读数选择器（图表 hover 的键盘等价物）。实施轮随 L2 更新该注释。

---

## §5 尺寸预算（≤40 KB）与降档顺序

### 5.1 预算（并合后口径；原始字节）

| 批 | 内容 | 估算 | 出处 |
|---|---|---|---|
| 批 1 | T1 时间透镜 | +2.05 ~ +3.05 KB | research-wf04-lens §4.2（并合 −0.15 含内） |
| 批 2 | T2 公式解构 | +2.6 ~ +3.3 KB | research-wf04-anatomy-overlay §4.2 批 1 |
| 批 3 | T3 情景叠影 | +4.3 ~ +5.3 KB | research-wf04-anatomy-overlay §4.2 批 2 |
| 随批 1 | L3 App.tsx 豁免扩展 | +0.05 ~ +0.1 KB | 4 行判定增量 |
| **合计** | **三巧思全量** | **+9.0 ~ +11.8 KB** | ≤ 40 KB 预算上限（余量 ≈28 KB）✓ |

- **两条独立约束，不得混淆**：40 KB 是本轮任务书**预算上限**（放行额度）；`TOTAL_LIMIT_BYTES = 2,000,000`（scripts/check-size.mjs:29，本会话实读）是**门禁硬线**。预算达标≠门禁达标：本会话实跑 `node scripts/check-size.mjs` → `DIST_TOTAL_KB=1951`、`WASM_MAX_KB=379`、门禁通过；字节级余量两研究文档当日实测 2,755 B / 2,816 B（同日两会话差 61 B，以实施轮首跑实测为准）——**对 +9.0~11.8 KB 增量必然超限，回收令强制**。
- wasm 增量预算 **+0 硬线**：任何 wasm 增量（含工具链波动）出现即返工重审 §0.2 裁定；wasm 门禁 800,000 B 不放宽（p8-spec §6.3 既有裁定照抄）。

### 5.2 降档顺序（门禁数值不放宽、不特批——p8-spec §6.3 既有裁定）

- **D1 i18n 并合**（预案照抄两研究文档）：透镜 9→7、解构 8→4、叠影 8→6，合计省 ≈1.7 KB。
- **D2 裁展示项**（候选序）：① 透镜 `lensOpening`/`lensContribution` 两行并入口径 tooltip；② 解构 `escHint` 并入 `lockedAria`；③ 叠影差异表裁撤、降为 aria 摘要行（兜底由气泡＋▲▼图例承担，S25 降级语义不变）；④ 叠影差异区间 Area 填充裁撤（双线＋▲▼＋气泡保住，S25 不受损）。
- **D3 dist 资产排查**：check-size 逐文件输出比对可压缩项。
- **D4 批次顺延**：批 3（情景叠影）整批延后至回收完成——顺序调整非功能裁撤；批 1/批 2 不动。
- S17/S23/S26 维持 P6 降档未落地状态，本轮不复活、不施工（design-language §2.1）。

### 5.3 尺寸特批裁定与回收收口（WF-04 工作流升级裁决，2026-11-23）

- **实测事实（实施轮首跑）**：基线 dist 1,997,184 B（余量 2,816 B，与 §5.1 记录一致）；批 1 时间透镜按 D1 并合（9→7 键）落地后实测增量 **+6,374 B**（index js +4,231 / index css +2,143）→ 2,003,558 B，`node scripts/check-size.mjs` exit 1——本文 §1-T1 预算 +2.05~3.05 KB 与 minified 实测差 ≈2-3 倍，批 1 自身即不可容于 2,816 B 余量。
- **回收阶梯核算**：D1 用尽（三批并合预案自批 1 起全程启用：透镜 9→7、解构 8→4、叠影 8→6）；D2 逐项执行：① 透镜 lensOpening/lensContribution 两字段+两键裁撤（批 1 内）、② 解构 escHint 并入 idle 行（批 2 内）、③ 叠影逐年差异表裁撤、④ 叠影差异区间 Area 裁撤（批 3 内，S25 兜底由气泡三行 + ▲▼图例 + `life.depletedAt` 复用标注承担）；D3 dist 资产排查已审——唯一可压项为 PWA 图标 PNG（4,215 B + 2,056 B，已高度优化，零新依赖铁律下无可行回收）。
- **第一次升级裁决（特批 2,010,000）**：批 1 破线（2,003,558）不可回正 → 裁定一次性特批上调至 2,010,000 B（P4 先例数值）+ 强制回收义务 + 回滚触发器；红线五门禁零宽容、wasm 800,000 B 不动。批 2 落地后累计 2,006,051 B；批 3 全量首建 2,024,438 B（**§6-4 首验推翻 §0.2 前提：recharts `Area` 组件树并未在 vendor_charts 既有 chunk 内**，grep "AreaChart" 符号命中不足凭据，vendor_charts +10,472 B）→ D2③④ 裁撤后 2,011,765 B，仍超 1,765 B。
- **第二次升级裁决（裁决 C：真实回收买回批 3）**：不开第二次特批；启用 wasm-opt。实测：元数据路线（`wasm-opt = true`）使 wasm-pack 构建整败（binaryen v117 特性集校验 "error validating input"，与 Cargo.toml 在档原因一致，再实测复现）→ **正典回收 = 同一 binaryen 二进制手动后处理 + 显式特性允许标志**：`wasm-opt.exe <pkg>/finance_core_bg.wasm -o <pkg>/finance_core_bg.wasm -O --enable-bulk-memory --enable-nontrapping-float-to-int`，**387,792 → 356,983 B（−30,809 B）**；命令登记于 src/wasm/Cargo.toml 注释（元数据保持 false）。验证网全绿：cargo test **60 passed / 0 failed**（裁定预估 75 项，套件实际 60 项，如实登记）+ check:lifecycle L1–L6 全过（32 项断言，对优化后 wasm 逐分等价）+ check:data 九组 / check:currency 五组 / check:share 六组 / check:a11y 白名单外 0；`git status -- src/wasm/src/` 零改动（仅 Cargo.toml 注释变更，构建配置元数据非 Rust 源码）。
- **回滚触发器达成（特批全额归档）**：含批 3 全量后 dist 总量 **1,980,908 B ≤ 2,000,000 B**，触发器条件「wasm-opt 回收使 dist ≤ 2,000,000（含批 3 全量）」当场达成——门禁线**恢复 2,000,000 原值**（scripts/check-size.mjs 已回写）、本轮 2,010,000 特批全额归档。批 3 增量终值：js +5,805 → 榨干后 +5,431（342,097 对批 2 收口 336,666）、css +283、i18n 三语 5 键；区补偿后总增量（三巧思全量 vs 基线）= 1,980,908 + 30,809 − 1,997,184 = **+14,533 B**（原始字节，含 i18n 并合与 D2①—④ 降档）。后续轮提交信息须含「尺寸特批 2,010,000（WF-04 裁决，附回滚触发器）+wasm-opt 回收启动——已回本归档」字样供追溯。

---

## §6 验收 checklist（20 条；全过才收口）

- [ ] **1** `npm run build && npm run check:size` exit 0（≤ 2,000,000 B；build 含 `tsc --noEmit`——TS strict 同闸）；三批各自收口复跑。
- [ ] **2** `WASM_MAX_KB=379` 零增量；`git diff --stat HEAD -- src/wasm/ src/services/bridge.ts` 空输出（§0.2 反证三条命令复跑为空）。
- [ ] **3** `grep -rn "useFinanceCall(" src/components`（排除 hooks.ts）→ **恰 9 处**零变化；`grep -rn "calcLifecycle" src` → 定义 1 + LifeTrajectoryCard 1 + 叠影 2 = 4 行命中（§4 条 5 登记值）。
- [ ] **4** Area 增量首验：build 后 vendor chunk 是否新增（对比 chunk 文件名与字节数）——预期零新增 chunk，有则按 §5.2 D2/D3 处置。
- [ ] **5** 透镜拖动零 wasm：DevTools Network/Performance 面板拖动全程零 `calc*` 调用（读数卡单次调用仅落定帧）。
- [ ] **6** 透镜键盘：←/→ 1 岁、PgUp/PgDn 5 岁、Home/End 首尾、钳 [1, len]；`aria-valuetext` 逐行中文读法（「{{age}} 岁，期末 {{value}}」）。
- [ ] **7** 透镜 S21 豁免：焦点在轨按 1–5 不跳任务（L3 生效）；input/textarea 既有豁免不回退；pro 页数字键语义零变化。
- [ ] **8** 透镜 reduced-motion：系统开启后拖动/读数行为与关闭**逐项一致**（零降级分支断言，§1-T1）。
- [ ] **9** 透镜保活与 cleanup：拖动中切任务/切组 → 无报错、回来选中 t 保留；`pointercancel`（触屏中断）与 pointerup 行为一致；无 window 级监听残留。
- [ ] **10** 解构交互：Tab 按书写序漫游 5 token、Enter 锁定/解锁、Esc 清除且焦点还回原 token、tap 直锁、hover 300ms 预览（无 hover 环境跳过预览断言）。
- [ ] **11** 解构高亮：点击 token → 目标字段静态描边＋label 加粗、置位/清除成对；K/N 关 Switch 时 token 禁用态＋tooltip 开启路径说明、公式形状恒完整。
- [ ] **12** 解构 × S16：锁定态下改参数 → 落定 → S16 照播、锁定不丢、token 焦点不丢（:822 重挂域外断言，§2-S16①）。
- [ ] **13** 叠影收窄：开关未置位时零 `calc*` 增量调用；置位后每次重算恰 2 个 calcLifecycle 调用（Network 断言，§3-2）。
- [ ] **14** 叠影图：恒两线、age 对齐短序列尾部不连线、情景耗尽后线落 0 延续、Y 轴刻度与图尺寸恒定；差异表 ▲▼ 冗余在位。
- [ ] **15** 叠影 S25：hover 气泡三行（基准/情景/差值）；触屏与读屏走差异表兜底；单图无 syncId。
- [ ] **16** 叠影 × S20：切 Tab/切组不卸载不重算不重播；返回已显示 Tab 不重播入场（组件库行为走查）；防抖不被 Tab 切换触发。
- [ ] **17** 叠影 reduced-motion：线插值瞬时重绘（hook 短路）；S20 tabPane 淡入同帧被压停、终态一致。
- [ ] **18** 回归抽查：§4 条 1 六锚点逐一在位；`npm run check:a11y` 白名单外违规 0；`npm run check:lifecycle` 全绿。
- [ ] **19** 九功能可达＋深链：`?task=` 四任务逐一落位、`?task=pro&panel=<key>` 九面板逐一落位、wf-route 回放正确；透镜 t 不入 URL 不入盘。
- [ ] **20** 三语：`npm run check:share` exit 0；三语界面人工走查三巧思文案零缺键零回落；禁词扫描（§7 词面）对本文档＋全部改动文件零命中。

---

## §7 自检记录（成稿会话实跑，2026-11-23）

1. 输入物全读：两份研究文档、design-language.md、三个目标组件全文直读（行数见文首输入物表）。
2. 反证实跑：`git status --short` → 仅 2 个未跟踪研究文档；`git diff --stat HEAD -- src/wasm/ src/services/finance.ts src/services/bridge.ts` → 空输出；`grep -rn "useFinanceCall(" src/components`（排除 hooks.ts）→ 9 处；`grep -rn "calcLifecycle" src` → 4 行命中；`node scripts/check-size.mjs` → DIST_TOTAL_KB=1951 / WASM_MAX_KB=379 / 门禁通过。
3. 锚点实证：App.tsx:201-207 豁免集合（S21 缺口实证）、AdvancedPanel.tsx:179 S20、global.css:1733 `.wf-chart-tip`、defaults.ts:273/:338 bgMint、hooks.ts:302/:207、scripts/check-size.mjs:29、vendor_charts 含 `AreaChart`/`isAnimationActive` 符号。
4. 未跑项如实声明：本文档为实施规范，未施工任何代码、未跑实施后门禁（§6 各条为实施轮断言）；Area 在 bundle 内的「零新 chunk」结论基于符号 grep，非构建级实测（已登记 §6 条 4 首验）；字节级余量沿用两研究文档当日记录（差 61 B），实施轮首跑校准。
5. 禁词扫描：对本文档执行任务书 13 词面正则（词面不在本文复写）→ 命中 0（结果见 final 回执）。

---

## 实施结果与收口记录（文档收口会话独立复测登记，2026-11-23）

> 登记性质：wf03-spec「实施结果与收口记录」同款结构——三巧思实施入库后由文档收口会话**独立复跑门禁**后登记。本节数字全部为本会话实跑/实读取证（命令与读数随条目给出），不转抄实施会话自述；无法在本会话验证的事实（浏览器侧手工走查项）如实登记为未逐条复跑，不虚报、不代勾（§四）。

### 一、改动文件清单（实施轮 14 文件 + 素材 4 件；收口轮补记 5 处文档）

- **新建 5**：`src/components/lens/LifeLensTrack.tsx`（180 行：T1 刻度轨 role="slider"＋常驻读数面板一体；读数 = `timeline[y−1]` 纯内存索引，thumb/刻度/里程碑纯 CSS 百分比＋端内距 16px 同一坐标系，len===1 写死 frac 0 除零防御；零 getBoundingClientRect / ResizeObserver / addEventListener / matchMedia——§3 红线 3 偏离登记条款零命中）、`src/components/FormulaAnatomyRow.tsx`（110 行：T2 公式行 A = 480X + K N + M + H，5 token `<button>` Tab 按书写序、hover 300ms 预览计时器 useEffect 卸载清理、Esc 还焦原 token、K/N 育儿关时 aria-disabled＋tooltip）、`src/components/advanced/ScenarioOverlayChart.tsx`（156 行：T3 恒两线——基准实线挂 primary、情景虚线 "6 4" 按末段差值方向挂 rise/fall；age 对齐短序列尾部 null 不连线；气泡三行▲▼冗余；`isAnimationActive={!reducedMotion}`＋base 240ms＋ease-out）、`scripts/optimize-wasm.mjs`（89 行：裁决 C 正典回收接线——build 内对 pkg wasm 跑同一 binaryen 手动 `-O`＋显式特性允许标志）、本规范。
- **改造 9**：`src/App.tsx`（+6 行：S21 豁免集合扩展 `target?.getAttribute("role") === "slider"`（§2-S21 裁定 a）；makeTabsKeyDown 不联动注记随注释在位）、`src/components/BasicCalculator.tsx`（+29 行：T2 接线——锁定/预览纯展示态 state＋`anatomyActive = preview ?? locked`；5 字段经 `highlighted` prop 成对置位/清除；公式行落 `</Collapse>` 之后、`.wf-share-row` 之前 = `key={flashEpoch}` 重挂域外）、`src/components/LifeTrajectoryCard.tsx`（+23 行：T1 接线——Descriptions 后嵌 `LifeLensTrack`，props 传同一 timeline 引用；防抖窗口 `opacity 0.45` 同源；D9 注释口径精确化落实（§4 条 10 兑现））、`src/components/advanced/ScenarioPanel.tsx`（+149 行：T3 接线——开关＋情景 Select＋图卡挂对比表上方 pane 内；独立 300ms 防抖 effect（`OVERLAY_DEBOUNCE_MS`）＋stale 布尔＋clearTimeout cleanup；`Promise.all` 恰 2 个 `calcLifecycle`（基准六切片含 effectiveMonthsDivisor 联动 + `decodeShareState` 切片映射，只读不触碰 applyShareState）；开关未置位零调用）、`src/components/fields.tsx`（+12 行：`NumberField` 可选 `highlighted` prop——`wf-anatomy-target` 类＋label bold；缺省 false 既有行为零变化）、`src/styles/global.css`（+173 行：WF-04 区块 ：1763–1935——`.wf-lens-*` 轨/面板族、`.wf-anatomy-*` token/高亮族（`.wf-anatomy-on`/`.wf-anatomy-target` 共挂 `--wf-focus-ring` 现值）、`.wf-ov-*` 图例族；全部引用既有令牌零新键）、`src/i18n/locales/` 三语（zh-CN / en 各 +16 行、zh-Hant +20 行（该文件键名带引号风格）：**14 新键**——`basic.formulaRow` 1＋`anatomy.*` 3＋`scenario.overlay*` 5＋`life.lens*` 5；键集一致性经 `check:share` 断言通过）、`package.json`（build 脚本接线 optimize-wasm.mjs）、`scripts/check-size.mjs`（门禁线 2,000,000 恢复注释登记——§5.3 特批归档回写）。
- **配置登记性变更 1**：`src/wasm/Cargo.toml`（+17/−7：wasm-opt 注释区——元数据路线保持 false 的原因、裁决 C 手动命令全文登记；**Rust 源码与导出面零改动**，`git diff --stat HEAD -- src/services/ src/store/ src/data/ src/components/hooks.ts` → 空输出，本会话实跑）。
- **素材 4**（构建产物实拍重制成功，文件名口径未变；重制结论由收口任务书给到）：`docs/assets/demo-workbench.png`、`demo-workbench-flow.gif`（288 帧）、`docs/assets/en/demo-workbench.png`、`docs/assets/en/demo-workbench-flow.gif`（288 帧）。
- **收口轮补记 5**：本节（本文件）、`docs/design-language.md` §5.5 版本记录、`docs/design-atlas-brief.md` §六 WF-04 行交付登记、双语 README（操作流图注重写＋功能特性 3 行＋导航段一句＋项目结构树）。
- 另有验收走查录屏 3 件存 `.verify-wf04/`（lens-drag.webm 267,815 B／rec-zh-final.webm 4,881,084 B／rec-en.webm 5,663,846 B）——实施验收段产物，不入库登记在此备考。

### 二、落地形态与 i18n 键数（并合＋D2 降档全执行终态）

- **D1 i18n 并合全启用**：解构 5 var 键并 `anatomy.varNote` 模板（「{{sym}}＝{{name}}：该项贡献 {{term}}」）；透镜 `lensYearNo` 并入 `lensValueText` 模板；叠影 escHint 与 lockedAria 两态共用行尾冗余行（aria-live polite）。
- **D2 降档全执行**（§5.3 升级裁决强制）：①透镜 `lensOpening`/`lensContribution` 两字段两键裁撤（读数面板终态 4 项：主读数行＋支取＋期末＋耗尽状态行/pensionStart Tag）；②解构 `escHint` 并入空闲行尾提示；③叠影逐年差异表裁撤（S25 触屏/读屏兜底改由气泡三行＋▲▼图例＋`life.depletedAt` 复用标注承担）；④叠影差异区间 Area 填充裁撤（§6 条 4 首验实证 Area 组件树不在 vendor_charts 既有 chunk 内——+10,472 B，裁撤后 vendor_charts 哈希与基线同为 `LmRWq4RN` 零新 chunk，本会话 check-size 明细复核）。
- **i18n 终态 14 键 ×3 语**（对 §1 原始 25 键：并合 −7、D2① −2、D2③ −2）：`life.lensLabel`／`life.lensValueText`／`life.lensWithdrawal`／`life.lensClosing`／`life.lensAfterDepleted`／`basic.formulaRow`／`anatomy.varNote`／`anatomy.escHint`／`anatomy.lockedAria`／`scenario.overlaySwitch`／`scenario.overlayLegendBase`／`scenario.overlayLegendScenario`／`scenario.overlayChartAria`／`scenario.overlayEmpty`。复用零新增：`basic.monthlyExpense` 等 5 字段名键、`basic.planChildrenHint`（K/N 禁用 tooltip）、`life.pensionStartMark`／`life.depletedAt`。

### 三、门禁终态（收口会话逐条复跑，exit 0 全绿）

| 门禁 | 命令 | 终态（本会话实跑） |
| --- | --- | --- |
| build | `npm run build` | tsc strict + optimize-wasm.mjs（356,864 → 356,864 B 幂等）+ vite build：**1395 modules**、purge 1206 条规则 / 130,418 B、PWA precache 12 entries |
| size | `npm run check:size` | DIST_TOTAL_KB=1935 / WASM_MAX_KB=349；**14 文件 1,980,789 B ≤ 2,000,000（余量 19,211 B）**；wasm 356,864 B ≤ 800,000 |
| share | `npm run check:share` | 六组断言全部通过（v4 往返 / v3 失效 / inflation_uplift 规范化 / **三语键集一致**） |
| data | `npm run check:data` | 九组断言全部通过 |
| currency | `npm run check:currency` | 五组样本断言全部通过 |
| a11y | `npm run check:a11y` | 63 组令牌对、白名单外违规 0 |
| lifecycle | `npm run check:lifecycle` | L1–L6 全部通过（断言 32 项＋逐行断言若干；L5 性能实测 27.59 ms ≤ 预算 50 ms） |
| cargo test | `cargo test`（src/wasm） | 单元 15 passed＋集成 **60 passed / 0 failed**（对优化后 wasm 逐分等价兜底） |

- **尺寸账（原始字节）**：对比 §5.1 基线 1,997,184 B——现建 dist 1,980,789 B＋wasm 回收 30,928 B（387,792 → 356,864），**三巧思全量净增 = +14,533 B**（与 §5.3 实施轮登记值逐位一致）。收口复跑与实施轮的 −119 B 差（1,980,908 → 1,980,789）全部来自 wasm-opt 重跑输出（356,983 → 356,864）与 index js 逐字节波动（342,097 → 342,049），工具链波动级，两口径同过门禁。
- **引擎与数据流反证（§6 条 2/3 复验）**：`grep -rn "useFinanceCall(" src/components`（排除 hooks.ts）→ **恰 9 处**零变化；`grep -rn "calcLifecycle" src` → 定义 1（finance.ts:824）＋LifeTrajectoryCard 1（:45）＋叠影 2（ScenarioPanel.tsx:197/:204）＝ 4 行命中；`git diff --stat HEAD -- src/services/ src/store/ src/data/ src/components/hooks.ts` → **空输出**（finance.ts 计算区、bridge.ts、store 切片集、YearRow 契约、主题令牌组零触碰）；`git diff --stat HEAD -- src/wasm/` → 仅 Cargo.toml 注释（§5.3 既有裁定：构建配置元数据非 Rust 源码）；package.json dependencies 7 件零增量（零新依赖铁律兑现）。

### 四、验收轮次与残留

轮次（可考记录）：①研究段两交付物成稿（research-wf04-lens 180 行 / research-wf04-anatomy-overlay 168 行）；②规范段成稿＋§7 五项自检；③实施段——批 1 透镜 / 批 2 解构 / 批 3 叠影逐批收口，§5.3 两次升级裁决与裁决 C wasm-opt 回收（回滚触发器当场达成、特批全额归档）；④验收段——`.verify-wf04/` 三件走查录屏（透镜拖动、中英终态）＋素材四件重制成功（结论由收口任务书给到）；⑤收口段（本会话）——九道门禁复跑全绿＋双语 GIF 逐帧抽样取证＋三文档登记＋README 双语同步＋禁词终扫。

- **GIF 逐帧抽样取证（本会话实跑，sharp 逐帧解码）**：双 GIF 各 288 帧，zh 抽 0/25/50/75/100/125/150/175/200/225/250/275/287、en 抽 0/40/80/120/160/200/240/260/287——**T1 透镜**（刻度轨＋里程碑：FI 空心点、养老金起领实心点、thumb 实底；拖至第 35 年 64 岁：期末 ¥8,055,075.9 / 当年支取 ¥37,651.68 / 养老金起领第 31 年（60 岁）Tag；en 版捕获 year 1 → 35 拖动全程）、**T2 解构行**（「480 法则公式解构：A = 480 X + K N + M + H」token 行＋行尾提示，自由刻度输入卡尾部）、**T3 叠影**（专业模式多情景对比开关置位：基准实线 vs 情景虚线同图、图例「第 3 年耗尽 / Depleted in year 3」复用标注）、回「自由刻度」输入读数原样保留（跨任务 hidden 非卸载）——三巧思与状态保留素材可见。
- **§6 checklist 勾选口径**：可复跑项（条 1/2/3/4/18 门禁与 grep 侧、条 20 的 check:share 与禁词侧）已在本节/§7 复验为过；**浏览器侧手工走查项（条 5–17 大部）收口会话未逐条复跑**——实施验收段走查录屏与 GIF 为部分视觉佐证，逐条 checkbox 本节不作代勾，如实维持未勾选状态。
- **残留（登记不阻断）**：①事件化施工（homePurchase/childBirth/healthPhase 事件位、事件标记渲染）与事件编辑器仍不在本轮（§0.3 红线维持，brief §六 既列归本 WF 后续批次）；②life/risk 容器查询（wf03 残留移交项）未随本轮启用；③S17/S23/S26 维持 P6 降档未落地，本轮不复活；④透镜 S18 渐近滚动为**登记性不消费**（§2 维持）；⑤pro 页 makeTabsKeyDown 对 slider 不联动（App.tsx 注释在位——未来 slider 落 pro 页须同款扩展）；⑥D2①—④ 降档为终态，恢复须按 §5.2 反向走门禁复测。

### 五、与规范偏差登记（不构成放宽）

| # | 规范原文 | 实施终态 | 性质 |
| --- | --- | --- | --- |
| 1 | §1-T1/T2/T3 i18n 9/8/8 键（并合 7/4/6） | **5/4/5 键**（并合全启用＋D2①③ 再裁） | 降档登记；§5.3 升级裁决在案 |
| 2 | §1-T2 落点文件未列 fields.tsx | 高亮锚以 `NumberField` 可选 `highlighted` prop 承载（组件注释自登记「在册扩展」；外包 div 会破坏 FieldRow 栅格） | 落点 +1 文件，最小面兑现 |
| 3 | §3 红线 3「pointercancel 与 pointerup 同分支」 | **未显式监听两事件**：`setPointerCapture` 释放由浏览器保证（up/cancel 自动），拖动更新走 pointermove＋`buttons` 位掩码滤无按键 hover；零手动全局监听红线满足 | 字面偏差登记，cleanup 语义不弱化 |
| 4 | §6 条 2「diff 空输出」 | Cargo.toml 注释＋package.json build 接线＋optimize-wasm.mjs 新文件为本轮登记性变更；Rust 源码 / bridge.ts / finance.ts 零改动（§三 反证复跑） | 登记性变更（§5.3 既有裁定） |
| 5 | §5.3 wasm 优化值 356,983 B | 收口复跑 356,864 B（同一命令重跑，−119 B 工具链波动级） | 波动登记，门禁两线均过 |
| 6 | §4 条 10 D9 注释口径精确化 | 已随 L2 落实（LifeTrajectoryCard.tsx:3-6「无参数输入控件」） | 按计划兑现，非偏差 |
