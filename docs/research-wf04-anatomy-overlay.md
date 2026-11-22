# WF-04 研究文档：公式解构与情景叠影（research-wf04-anatomy-overlay）

> 性质：WF-04 前置研究——「公式解构」（480 公式可点击变量→输入字段高亮）与「情景叠影」（基准 vs 情景资产路径同图）的可施工交互规格；与既有 S 项共存裁定逐条写。
> 输入物（本会话全读/直读）：`docs/research-atlas-prototype.md` §1.1/§5.2/§5.3/§6/§7；`docs/p8-spec.md` §1/§3.5/§6/收口记录；`docs/design-language.md` §2（S16/S17/S20/S25 行）；`src/components/BasicCalculator.tsx`（1152 行全读）；`src/components/advanced/ScenarioPanel.tsx`（315 行全读）；`src/components/AdvancedPanel.tsx` :150-185；`src/services/finance.ts` :820-880；`src/services/share.ts` :52-64；`src/components/hooks.ts` :150-170/:296-316；`src/data/defaults.ts` :231/:268-273/:332-339；`docs/atlas-tokens-evolution.md` :36；`scripts/check-size.mjs` :29。
> 范围红线：本文只产规格与裁定，零代码写入；不改令牌现值（global.css 本会话零写入）；S17 为 P6 门禁降档未落地元素（design-language.md:109 ⛔），强调一律走非 S17 通道（§1.2）。
> 铁律：本文零禁词（13 词面不在本文复写，扫描记录见 §5）。

---

## §1 公式解构 Formula Anatomy

### 1.1 落点与现状

- 落点（任务书钉死）：自由刻度 L4 公式行——原型 §1.1 左栏树「L4 经典简化模式行 A = 480X + KN + M + H（caption 12px）＋变量 tooltip＋推导跳链」（research-atlas-prototype.md:81；§5.2:198 同参数复用）。本轮兑现为 BasicCalculator（自由刻度默认视图本体）输入卡内、核心参数 Collapse 之后、分享行之前的行级新块（BasicCalculator.tsx:1133 之后、:1137 之前），caption 档（`--wf-text-caption`）。
- 现状无此行：480 法则仅以 ruleOrigin 提示句存在于核心参数折叠内（BasicCalculator.tsx:1123-1130），变量不可交互；公式各分量在输出卡明细表有既算展示（childTotal = childCount × costPerChild，BasicCalculator.tsx:895）。
- 不破坏参数顺序锁定（原型 :63）：公式行是 L4 依据层追加块，不动 §0.6 字段顺序。

### 1.2 映射表（变量 × 字段锚点；表计 6 行＝可点击 5 行＋非交互结果锚 1 行）

| # | 变量 | 含义（i18n 复用键） | 高亮目标字段锚点（BasicCalculator.tsx） | 条件渲染 | 交互 |
|---|---|---|---|---|---|
| 1 | A | 临界值（结果，非变量） | 输出卡大数字 :784-791 | 恒在 | 不可点击 |
| 2 | X | 月开销（`basic.monthlyExpense`） | AmountField :1003-1012 | 恒在 | 可点击 token |
| 3 | K | 单孩成本（`basic.childCost`） | AmountField :1042-1053 | 仅 planChildren 开（Switch :1013-1030） | 可点击 token |
| 4 | N | 孩子数（`basic.childCount`） | IntField :1033-1041 | 仅 planChildren 开 | 可点击 token |
| 5 | M | 大额投资（`basic.majorInvestment`） | AmountField :1066-1076 | 恒在 | 可点击 token |
| 6 | H | 健康预留（`basic.healthReserve`） | AmountField :1056-1065 | 恒在 | 可点击 token |

- KN 组合语义＝明细表 childTotal 同式（:895）；K/N 分别指向各自字段、不合并高亮。K/N 未激活（Switch 关）时 token 渲染禁用态（aria-disabled＋tooltip 说明开启路径），公式形状恒完整、不静默缺项。
- 高亮机制（非 S17 通道）：目标字段外包 div 加 1px 描边类（色值挂既有焦点环口径）＋字段 label 文字加粗；纯静态、置位/清除事件成对（S17 纪律），无动画。S17 若后续走 §5.1 三步准入（design-language.md:109/:114），升级为着色底半档 `--wf-bg-tint`（原型 §5.2:201），本表锚点不变。
- tooltip＝「变量语义＋边际影响句」（原型 §5.2:201，「X＝月开销：该项贡献 480X」句式）；进出场沿用组件库既有覆盖档。

### 1.3 键盘与指针交互（原型 §5.2:200 全量采纳，补施工细节）

- token 为 `<button>`：Tab 在 5 个 token 间自然漫游（序＝公式书写序 X→K→N→M→H）；hover 预览延迟 300ms（原型推导值，research-atlas-prototype.md:200/:233）；Enter＝锁定/解锁切换；Esc＝清除锁定并把焦点还回原锁定 token（逐层退出语义）；触屏 tap 切换锁定。
- 可访问性：token aria-describedby 指向解释块；公式行尾同步渲染「当前解构：{{name}}」行（非视觉通道冗余，原型 §5.2:202）。
- 焦点保护：公式行不得进入任何 key 重挂容器（§1.4 裁定①）——落定重渲染不丢焦点、不丢锁定态。

### 1.4 与 S16 因果闪亮的共存裁定（三条款）

S16 现状锚点（本会话实读）：定义 design-language.md:58/:74；实现 hooks.ts:302 `useFlashOnChange`（epoch 递增、首值不闪）＋BasicCalculator.tsx:629（flashEpoch）、:630-636（明细区 flashOn 摘类 effect，slow 档 360ms＝defaults.ts:231）、:822（`key={flashEpoch}` 重挂容器，仅包汇总/乘数两行）、:888/:907（wf-flash-single 类承载）；样式 global.css:1652-1661。

| # | 裁定 | 内容 |
|---|---|---|
| ① | 落点互斥 | 公式行挂 :822 重挂容器之外（输入卡尾部 vs 输出卡重挂域，不同 DOM 子树）——落定重挂不得扰动 token 焦点与锁定态（P5「明细区禁重挂」同构裁定，BasicCalculator.tsx:873 注释口径） |
| ② | 分域共存 | S16 强调（主色 8% 底淡出）落输出卡；解构强调（静态描边＋加粗）落输入区字段——两域无叠加竞态，不设互斥闸 |
| ③ | 触发时机错峰（登记而非机制） | S16 由防抖落定驱动（300ms 防抖＋计算，BasicCalculator.tsx:38/hooks.ts:302）、解构由用户点击驱动且纯静态（无动画窗口）——同秒并发时静态强调不参与动画排队，天然错峰；S16 slow 360ms 单发窗口（:634）内新落定不重播（epoch 单调递增既有语义） |

- 用户点击 token 对应字段修改 → 300ms 防抖 → 落定 → S16 照常播（该链路零改动）；解构锁定不抑制 S16、S16 不清解构锁定。

### 1.5 降级（原型 §5.2:202 全量采纳＋本落点差分）

- prefers-reduced-motion：tooltip 过渡被 CSS 兜底块压停；解构强调本就无动画、无 JS 动画消费点（hooks.ts:165 本节零消费——如实登记）。
- 触屏/无 hover：无预览，tap 直锁；读屏按 §1.3 aria 链路。
- K/N 字段在核心参数/条件区不可见时：描边不可见但锁定态仍在，tooltip 出口照常（token 本体在公式行，不在折叠内）。

---

## §2 情景叠影 Scenario Overlay

### 2.1 现状对比表（ScenarioPanel.tsx 本会话全读）

| 维度 | 现状 | 叠影目标（本节设计） |
|---|---|---|
| 数据源 | 每情景 decodeShareState → 5 个确定性 wasm 调用（:74-82）→ 8 项标量指标（:85-95） | 每次重算 2 个 calcLifecycle 调用（基准＋情景切片）→ 资产路径（finance.ts:824/:863-877） |
| 时间维度 | 无（单点指标） | 逐年 YearRow.closingAssets（p8-spec.md:77-99） |
| 呈现 | 对比表：行＝指标、列＝情景 ≤12 列横滚（:192-210）；位图导出（:166-187） | 叠影图：恒两线（基准＋单选情景）＋逐年差异兜底表；对比表保留不动 |
| 与基准关系 | 载入＝applyShareState 整体覆盖 store（:151-155）——「快照列」，基准不并存 | 情景切片只读解码、不写 store——基准与情景同图并存 |
| 落点 | 专业模式 scenario 组（AdvancedPanel.tsx:72） | 同面板对比表上方追加图卡；开关置图卡头（Switch＋wf-touch-target 44 命中） |

### 2.2 叠加视图设计（原型 §5.3 参数全量采纳，钉死实现口径）

- 双线：recharts Line ×2——基准实线挂 resolveThemeTokens().primary；情景虚线（strokeDasharray="6 4"，同 BasicCalculator.tsx:260 参考线口径）按差异方向挂 rise/fall（语义色仅此一维，原型 §5.3:207）；线型差异独立于颜色通道，取色经 resolveThemeTokens（ScenarioPanel.tsx:106 同源），色盲友好档自动替换。
- 差异强调：两线逐年龄差值区间 Area 填充挂 C-6 区间底 bgMint（defaults.ts:272-273 浅 #DCEEE8 / :335-339 深合成；准入登记 atlas-tokens-evolution.md:36「区间高亮落位时（如情景叠影差异区）」——本节即该落位）；差异方向 ▲/▼ 字形冗余（S10）写入图例与差异表。
- 坐标纪律：Y 轴刻度与图尺寸恒定、只动数据形（原型 §5.3:207）；X 轴＝YearRow.age；图高按 D5 三档 240/280/320px（原型 :65）。
- 对齐裁定：基准与情景 horizon 可能不同（accum.years 切片差异）→ 以 age 对齐各成序列，短序列尾部 null 不连线（recharts connectNulls 缺省 false）——无假延伸。
- 耗尽呈现：情景路径耗尽后 YearRow 全字段恒 0（p8-spec.md:95-99）→ 线落 0 水平延续到 horizon 末；depletedYear ≥1 时气泡与差异表复用 `life.depletedAt` 键（p8-spec.md:369），不新增键。
- 图例恒 2 项（caption 12px）；数据落定插值 base 240ms（原型 §5.3:207），isAnimationActive 经 usePrefersReducedMotion 短路（hooks.ts:165；先例 BasicCalculator.tsx:157-161）。

### 2.3 数据源裁定（任务书钉死：引擎 timeline 两次调用）

| # | 裁定项 | 内容 |
|---|---|---|
| ① | 基准路径 | calcLifecycle(当前 store 六切片)——与 LifeTrajectoryCard 同构入参（p8-spec.md:350：baseline/accumulation/pension/loan/rental＋effectiveMonthsDivisor 联动） |
| ② | 情景路径 | calcLifecycle(decodeShareState(entry.payload).state 切片映射)——ShareState 已含全部五切片（share.ts:52-64），零载荷格式变更；解码失败不进候选（ScenarioPanel.tsx:237 既有 valid 判定复用） |
| ③ | 可叠性基础 | calcLifecycle 纯确定性、同输入恒同输出（p8-spec.md:176/:186-188）；生产恒均值 provider（finance.ts:717-718）零随机注入——两路径同图可比有确定性保证 |
| ④ | 并行与预算 | 两调用 Promise.all；单调用实测 32.67ms、预算 ≤50ms（p8-spec.md:480/:296）→ 两调用保守合计 ≤100ms；每调用内部各含 2 个 wasm 调用（finance.ts:829-833）共 4 个互不串行 |
| ⑤ | 防抖口径 | 叠影重算独立 300ms 防抖（DEBOUNCE_MS 先例 BasicCalculator.tsx:38）——不与读数卡 useFinanceCall 共用实例；触发源＝叠影开关置位/情景选中变更/基准参数落定帧 |
| ⑥ | 过期丢弃 | stale 布尔闭包丢弃过期结果（ScenarioPanel.tsx:120-131 既有先例同款） |
| ⑦ | 重算收窄 | 仅叠影开关置位且候选 ≥1 时发起两调用；开关未置位零调用（零基线开销）；调用点增量＝+2 处直接 calcLifecycle（ScenarioPanel.tsx:75-79 直接调用先例同层）；p8-spec.md:383「+1 唯一新增」口径自此更新为 +3（登记性变更，实施轮回写） |
| ⑧ | 不写 store | 情景切片只读解码进组件局部态；叠影不触碰 applyShareState（与「载入」语义互斥并存） |

### 2.4 边界与降级

- 恒两线裁定（对原型 §5.3「选中 ≥2 情景」收窄）：多情景仍以对比表承载（≤12 列），叠影图取当前选中一条——保证 S25 气泡与差异区间可读。
- 未就绪：wasm 未就绪/任一调用 ok:false → 图卡走既有 Alert 分支（finance.ts 永不抛出纪律）；差异表仅两路径齐备时渲染。
- 读屏：图挂 role="img"＋aria-label；图下逐年差异兜底表（年份/基准/情景/差值四列，原型 §5.3:209）——触屏与读屏共用兜底。
- reduced-motion：线插值 hook 短路瞬时重绘；图表内建动画 CSS 兜底管不到，hook 为唯一闸（research-atlas-prototype.md:209 同口径）。

---

## §3 与既有 S 项共存（S25 图表 hover 读数 / S20 Tabs 动画）

### 3.1 S25（design-language.md:67/:83/:122）

- 叠影图为 S25 第 6 个消费图：Tooltip cursor 描边挂 textTertiary＋虚线 "3 3"（先例 BasicCalculator.tsx:169），气泡复用 `.wf-chart-tip`（global.css:1733）；气泡三行＝基准值/情景值/差值（▲▼ 冗余）。
- 单图不挂 syncId（syncId 为多图联动机制，先例 MonteCarloPanel，design-language.md:122；叠影单图无联动对象）。
- 与 §2.4 恒两线裁定互为前提：>2 线会使气泡超载——收窄裁定保住 S25 可读性。

### 3.2 S20（design-language.md:62/:78；本会话实测落点漂移为 AdvancedPanel.tsx:179 `animation={{ inkBar: true, tabPane: true }}`）

- 叠影图挂 scenario Tabs pane 内（hidden 非卸载承载，AdvancedPanel.tsx:170 注释口径）——切组/切 Tab 不卸载、不重算、不重播入场；§2.3-⑤ 防抖不被 Tab 切换触发。
- 首次显示同帧叠加裁定：tabPane 淡入（组件库开箱）与线插值 240ms 同帧发生——不设互斥闸：不同元素、不同通道，均 ≤360ms，且 reduced-motion 双闸（CSS 兜底块＋hook 短路）同时压停两者，终态一致（S20 降级语义同构，design-language.md:62）。
- 返回已显示 Tab 不重播：数据未变则 recharts 不再播入场动画——登记为组件库行为依赖，实施时走查复核。

### 3.3 S16（引 §1.4）

公式解构与 S16 按「落点互斥＋分域共存＋时机错峰」三条款共存（§1.4）；情景叠影与 S16 无交集（ScenarioPanel 不含 S16 消费点，不同组件树）。

---

## §4 i18n 键预算与尺寸估算

### 4.1 新键清单（16 键 ×3 语；复用键不计预算）

| 组 | 键 | 用途 |
|---|---|---|
| anatomy（8） | `basic.formulaRow` | 公式行标签＋aria |
| | `anatomy.varX/varK/varN/varM/varH`（5） | 变量 tooltip 全句（语义＋边际影响句） |
| | `anatomy.escHint` | Esc 清除提示 |
| | `anatomy.lockedAria` | 「当前解构：{{name}}」 |
| overlay（8） | `scenario.overlaySwitch` | 叠影开关标签＋aria |
| | `scenario.overlayLegendBase` / `overlayLegendScenario` | 图例两项 |
| | `scenario.overlayChartAria` | 图 aria-label |
| | `scenario.diffTableTitle` | 差异表标题 |
| | `scenario.diffColYear` / `diffColDelta` | 差异表列头（基准/情景列头复用图例键） |
| | `scenario.overlayEmpty` | 空态文案 |
| 复用登记 | `life.depletedAt`（p8-spec.md:369）；字段名 6 键（§1.2 含义列） | 零新增 |

- 并合预案（尺寸回收时启用）：5 个 var 键并 1 模板键 `anatomy.varNote`（「{{sym}}＝{{name}}：该项贡献 {{term}}」，传既有字段名键）→ −4 键；diffTableTitle 与两列头并 1 键 → −2 键；下限 10 键。

### 4.2 字节与尺寸估算（原始字节口径；门禁 scripts/check-size.mjs:29 `TOTAL_LIMIT_BYTES = 2,000,000`）

- 估算基线（本会话实跑 `node scripts/check-size.mjs` → DIST_TOTAL_KB=1951、门禁通过）：dist 15 文件递归求和 **1,997,184 B、余量 2,816 B**（p8-spec.md:492 收口值 1,997,245/2,755 之后的今日在库态）；单键三语实测 ≈286 B（life 组 16 键：zh-CN 1,440 B＋zh-Hant 1,483 B＋en 1,649 B ≈ 4,572 B）。

| 来源 | 估算（原始字节） | 说明 |
|---|---|---|
| i18n 16 键 ×3 | +4.6 KB（并合后 +2.9 KB） | 按 life 组实测单键单价推算 |
| FormulaAnatomyRow 组件 | +1.2 ~ +1.8 KB | token 行＋tooltip＋aria，复用组件库基础件 |
| 叠影图组件＋ScenarioPanel 接线 | +2.5 ~ +3.5 KB | 解码映射＋防抖＋recharts Line/Area/Tooltip |
| CSS（描边强调类＋图例） | +0.3 ~ +0.5 KB | 复用既有令牌，零新令牌键 |
| wasm | +0 | 零 Rust 改动（复用在库 calcLifecycle，finance.ts:824） |
| **合计** | **+8.6 ~ +10.3 KB**（并合后 +6.9 ~ +8.6 KB） | recharts Area 是否已随 vendor_charts（367,734 B）在 bundle 内未实测——若需新增 chunk 另计，登记为实施首验项 |

- **超限事实（如实登记）**：任何口径都超当日余量 2,816 B——全量施工前必须按 p8-spec.md:424-427 回收令处置顺序回收（i18n 并合 → 裁展示项 → dist 资产排查），门禁数值不放宽；建议拆两批（批 1＝公式解构 ≈+2.6~3.3 KB 并合后；批 2＝情景叠影 ≈+4.3~5.3 KB 并合后），每批施工前重跑 check:size 并先完成该批对应回收。

### 4.3 门禁联动

- calcLifecycle 直接调用 +2（§2.3-⑦）；check:share 三语键集断言自动覆盖新键（check-share.mjs 断言 5 先例，p8-spec.md:324）；check:a11y 无需扩对（描边色复用焦点环现值口径，无新令牌键）。

---

## §5 自检记录（成稿会话实跑，2026-11-23）

1. 行数预算：`wc -l docs/research-wf04-anatomy-overlay.md` → 168 行（≤280 通过）。
2. 禁词扫描：`grep -ciE "…"（13 词面，正则以任务书词表为准，不在本文复写）docs/research-wf04-anatomy-overlay.md` → 命中 0（exit 1）。
3. 尺寸基线复核：`node scripts/check-size.mjs` → DIST_TOTAL_KB=1951、WASM_MAX_KB=379、门禁通过；递归求和 1,997,184 B / 余量 2,816 B（§4.2）。
4. 独有推导值登记：叠影防抖 300ms（同 DEBOUNCE_MS 既有值）；两调用保守预算 ≤100ms（2×50ms）；恒两线裁定；差异区间填充挂 bgMint（C-6 已准入键，非新提案）；单键三语单价 ≈286 B（实测）。
