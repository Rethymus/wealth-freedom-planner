# 金融界面研究：数字质感与内容经济学

> 研究方式：WebSearch 主题检索（fintech dashboard 设计系统 / 金融计算器 UI 模式 / 数字格式化与数值对齐 / 金融图表减法 / 渐进披露 / tooltip 边界 / 空态文案，2026-11 执行）+ 本仓代码取证。
> 来源引用格式：《文档名》· 章节（域名）。跳转类与公司类 URL 一律以「文档名 + 章节名」替代，不留原始链接。
> 自检记录见文末：行数预算 ≤300、交付禁词清单零命中。

---

## §0 一页结论（六条最锋利参数）

1. **tabular-nums 覆盖面 = 「会变的数字」**：结果卡主数、差额行、表格数值列、图表轴刻度、实时区全挂等宽数字；纯静态散文不挂。本仓仅 5 个类挂上（global.css:723,732,908,915,931），轴 tick 与 ≥640 宽度的 Descriptions 值列是缺口（后者仅 <639.9px 生效，global.css:1025）。
2. **主数 : 辅助数 ≈ 2.3 : 1**：主数 28–32px / weight 600（hero 档 40px 全站唯一，--wf-text-num 32→40，global.css:42,103）；差额与注释 13–14px（--wf-text-sm=13px，:39）；数字字号下限 13px，禁止对数字加字距。
3. **结果卡四层**：主数（不染色）→ 差额副数（全卡唯一语义色处）→ 口径注释 ≤1 行 → 来源标注一句话 + 全文进 tooltip。
4. **图表三减**：减网格（仅水平 hairline，--wf-chart-grid 已立 global.css:59,309）、减轴框（`tickLine={false} axisLine={false}`——全仓 grep 零命中，即 recharts 默认轴框与刻度短线全部还挂着，这是最大单点缺口）、减图例（≤2 序列直接标注线端/条端）。
5. **密度契约**：卡片 padding 20–24px（高级面板内容区现状 16px，global.css:420-425，≥768 提到 24px）、行距 1.5、数值列右对齐 + 等宽数字、组间 ≥24px（D10 已立 global.css:1147-1153，保持）。
6. **解释性文字 ≤2 行**：超出部分进 FieldTip；zh-CN.ts 实测 ≥140 字符说明串 8 条（awk 取证）→ 降为 ≤1 行内联 + tooltip 全文，这是唯一可测的「可感下降」指标。

---

## §1 数字排版

**tabular-nums 适用面**（依据：GOV.UK《Font override classes》·tabular numbers 节、Fuselab《Dashboard Design System guide》·typography tokens 节）
- 覆盖：结果卡主数、差额行、KPI 行、表格数值列、图表轴刻度、实时区、输入框内数值。
- 排除：纯静态说明文字、标题。
- 现状取证：`.wf-big-number`（global.css:723）、`.wf-amortize-table` / `.wf-realtime`（:732）、`.wf-sens-rows`（:908）、`.wf-sens-legend`（:915）、`.wf-insight-row`（:931）；Descriptions 值列仅 `@media (max-width: 639.9px)` 挂右对齐 + 等宽（:1025）。**缺口**：图表轴 tick、≥640 的 Descriptions、ScenarioPanel 对比表（Arco `Table`，ScenarioPanel.tsx:293，不在 Descriptions 规则射程内）。

**主数与辅助数比例**
- 主数 28–32px、weight 600–700；差额/口径注释 13–14px、weight 400；比值 2.2–2.9:1。
- 本仓字阶：--wf-text-num 32px（窄屏）/40px（宽屏）＝ hero 档（global.css:42,103）；40px 仅限输出卡一处，其余面板主数取 28–32px。
- 金额与数字下限 13px（--wf-text-sm 恰好达标，global.css:39）；禁止 letter-spacing 作用于数字。

**货币 / 千分位 / 量级缩写**
- 千分位与小数位统一走 `Intl.NumberFormat`：format.ts:19-22（locale 化）与 formatMoneyFixed（:34-40，minimum=maximum 保证同一列内精度一致，防尾零裁剪抖动）是正确范式，禁止各面板手写 toFixed。
- 货币符号贴数（无空格或窄空格，二选一全站统一）；多列同币种时列头/卡头声明一次币种，行内只留数字。
- 量级缩写口径：**轴与次级数字缩写，主数保精确**。轴已用 Intl compact（format.ts:55-58，zh 走万进制、en 走 K/M）——保持；建议补 `formatMoneyCompact`（≥1e8 → 亿、≥1e4 → 万）用于摘要行与差额行，精确值由主数与 tooltip 承载。
- 缩写只允许「数量级一位小数」，避免 12.34 万这类伪精度；表格内一律不缩写。

---

## §2 结果卡信息层级（四层模型）

依据：Material《Data tables (M2)》·numeric alignment 节；GOV.UK《Table component》·"align numbers to the right" 节；本仓输出卡现状。

| 层 | 内容 | 规格 | 强调 |
|---|---|---|---|
| L1 主数 | 本面板一句话结论的那个数 | 28–32px（hero 40px），右对齐或左对齐全站统一 | 正文字色，**不染色** |
| L2 差额副数 | 与目标/基线/上一情景的差 | 13–14px，带 ± 方向 | 唯一允许语义色处 |
| L3 口径注释 | 假设与折算口径 | 12px 次级灰，≤1 行 | 无 |
| L4 来源标注 | 数据/研究出处 | 12px 三级灰，一句话 | 全文进 tooltip |

**强调色克制**：每张卡语义色出现 ≤1 次（只在 L2）；涨跌色 --wf-rise/--wf-fall 双主题已对账（浅 #00B42A/#F53F3F global.css:51-52；深 #27C346/#F98D86 且注释带对比率 :301-302），只在「比较语境」出现，装饰性使用为零。涨跌方向不允许只靠颜色——补 ▲▼ 或 +/− 符号（WCAG 1.4.1 Use of Color）。色盲友好开关（App.tsx resolveThemeTokens）继续作为兜底路径。

**现状取证与缺口**：
- 输出卡 hero 结构（.wf-output-hero，global.css:889）方向正确；
- **L4 超重**：zh-CN.ts 实测 8 条 ≥140 字符串（awk `length>=140`：行 134:228 / 163:151 / 165:172 / 168:147 / 175:143 / 345:238 / 459:172 / 519:147），多为来源原文与口径长文 → 改「一句话出处（≤20 字）+ 原文全文进 FieldTip」；
- 各面板 `wf-panel-note` 现为段落（全仓 17 处，grep -o 逐文件计数：MonteCarlo 6 / Pension 4 / Reverse 3 / Rental 2 / Loan 1 / Accumulation 1）→ 按 L3 口径压到每面板 ≤2 处。

---

## §3 图表质感

依据：《Gridlines are gratuitous》（storytellingwithdata.com）、CFPB Design System ·数据可视化节（序列 ≤5）、《Color palettes and accessibility for data visualization》（medium.com/carbondesign）。

**网格与轴**
- 仅水平网格线：1px 实线挂 --wf-chart-grid（浅 #E5E6EB :59 / 深 #3D3F46 :309，注释明示「网格为装饰层不设 4.5 口径」）；垂直网格删除。
- X/Y 轴 `tickLine={false} axisLine={false}`：去轴框、去刻度短线。**取证：grep -rn "tickLine\|axisLine" src/components/ 零命中**，即全部图表仍是 recharts 默认轴——逐图补齐；刻度文字挂 --wf-chart-tick（浅 #4E5969 :60 / 深 #8F95A0 :310，注释 5.28:1）、12px、tabular-nums。
- 图表容器无边框、无背景盒。

**直接标注替代图例**
- ≤2 序列：线端/条端直接标注系列名，不渲染 Legend；
- ≥3 序列或需开关显隐：保留图例但缩为单行小点 + 12px；
- 数值标注仅标「首末点 + 关键拐点」，全序列标数值即文字墙的图表版；
- 蒙特卡洛阈值带等复杂图保留交互 tooltip 补值。
- 本仓 recharts 宿主（grep -rln 取证）：BasicCalculator、MonteCarloPanel、RentalPanel、AccumulationPanel、hooks.ts。

**语义色三键 + 深色适配**
- 正 = --wf-rise、负 = --wf-fall、中性 = 主色/灰阶；同一张图语义色只表达「涨跌/达标」一个维度。
- 深色不是反色：语义色提高亮度一档（本仓已做：#00B42A→#27C346，global.css:301）、网格与刻度换暗主题令牌（:309-310）；图形对象对比按 WCAG 1.4.11 ≥3:1。Carbon 数据可视化指南：颜色不能承载全部信息，必须配直接标注/箭头。

---

## §4 密度与留白

依据：GOV.UK《Table component》·numeric alignment 节；Material《Data tables (M2)》·scannability 节；Carbon《Data table》·alignment 节（Carbon 默认左对齐属社区长期争议的例外，不采纳）。

- **卡片 padding 20–24px**：输出卡取 24px（--wf-space-5，global.css:27）；高级面板内容区现状 16px（:420-425）→ ≥768 提到 24px，<768 维持 16px。
- **行距 1.5–1.6**：说明段与 note 显式 line-height 1.5；字段 hint（:774-778 附近 12px）≈1.5，达标。
- **数值右对齐**：所有表格/Descriptions 数值列 `text-align: right` + tabular-nums——右对齐使个位对齐，同列量级一眼可比（GOV.UK/Material/ONS 一致口径）。现状仅 <639.9px 生效（:1025）→ 改为全宽度生效；ScenarioPanel 对比表逐列核对。
- **组块边界**：组间 ≥24px（D10，global.css:1147-1153）、标签与控件 4px、字段间 10–12px——保持。
- **一屏一重点**：双栏工作台左栏 sticky 常驻唯一主结果，右栏一次只渲染一个面板（分段控件+组内标签页，global.css:408-425）——结构已符合，禁止在左栏追加第二个大数。

---

## §5 状态完备（空态 / 加载 / 错误一句话）

依据：《Designing Empty States in Complex Applications》（nngroup.com）、《Top 10 Examples and Guidelines for Empty States》（uxwritinghub.com）、《Empty State Design: A Practical Guide》（uxplanet.org）。

- **空态 = 1 句「缺什么」 + 1 个动作**：`[缺的状态]——[下一步]`。示例口径：「还没有对比场景——选两个情景开始比较」。空态是微型 onboarding，不是死胡同；禁止排比、禁止责备式开头、形容词 ≤1 个。ScenarioPanel 已用 Arco `Empty`（ScenarioPanel.tsx:11）——改文案即可，不换组件。
- **加载态**：骨架形状镜像最终布局，骨架不加文字噪音；运行中进度文案 ≤1 行 + 百分比。加载与空态必须视觉可区分，否则新用户把「加载中」读成「没有数据」。
- **错误态**：字段级拒绝式校验已是正确范式——越界不落库、保留显示值、报「哪里错 + 合法区间」（fields.tsx:104-117）。全局错误同构：原因一句 + 出路一句。
- **写法判据**：状态文案 1 行放得下；有语气但不啰嗦——动词开头优于名词堆叠；禁用感叹号连用。

---

## §6 内容经济学：渐进披露与文案压缩（专治文字墙）

依据：《Progressive Disclosure》（nngroup.com）·defer rarely used 节；《Tooltip Guidelines》（nngroup.com）·"don't use tooltips for information vital to task completion" 节；《Why So Many Info Tips Are Bad》（nngroup.com，2026）；《Tooltip》·When to use 节（designsystem.digital.gov，USWDS）。

**tooltip vs 内联的三问判据**
1. 看不到它，任务会做错或做不下去？→ **必需**，内联（或 hint 一行）。
2. 只是回答「为什么是这个数 / 口径是什么」？→ **tooltip**（FieldTip）。
3. 是出处、引用、推演过程？→ **一句话出处内联 + 全文 tooltip**（或折叠区）。
反判据（三源一致）：任务必需信息不许藏进 tooltip（NN/g；USWDS）；约束、限制、法律条款不许藏（NN/g info-tips）；内容一行放得下就直接放；tooltip 内容自身 ≤2 句；触发图标必须紧邻目标。隐藏内容的代价是「被忽略」，NN/g 渐进披露原文同时警告：只有确实降低认知负荷时才折叠。

**「标题 + 一句话副行」模式**
- 成段说明一律压成：标题（16px，名词短语）+ 副行（13px，≤1 行，回答「为什么/怎么算」）+ info icon；其余进折叠区或面板底部 L4。
- 本仓 FieldTip（fields.tsx:167-175）已是标准件：hover+focus 触发、tabIndex 0、aria-label 直读——扩展它，不另造机制。

**量化目标（可测，替代「可感下降」的主观表述）**
1. 解释性文字 ≤2 行：每个面板正文内连续说明段 ≤2 行，超出必须折叠；
2. 长文案串清零：zh-CN.ts ≥140 字符串 8 条（§2 所列行号，awk 取证）→ 全部降为 ≤1 行内联 + tooltip 全文；
3. 每面板 note ≤2 处：MonteCarlo 6→2（摘要 1 + 口径 1）、Pension 4→2、Reverse 3→2、Rental 2→1；
4. hint ≤60 字符：超出的解释移入 tooltip（fields.tsx hint 通道现为自由长度）。
- 三语言（zh-CN / zh-Hant / en）同步压缩，以信息密度判定而非字符数（en 允许 +30% 字符）。

**一屏一重点的既有结构**：高级区分段控件 + 组内标签页（global.css:408-425）每次只渲染一个面板——保持；面板内部遵守「结论先行」：结果摘要 1 行 → 输入区 → 明细折叠。

---

## §7 落地映射（对应 src/ 文件）

| 文件 | 动作 |
|---|---|
| src/styles/global.css | Descriptions 值列右对齐+等宽从 <640 扩为全宽度（:1025）；补轴 tick 全局规则；高级面板内容区 ≥768 padding 24px（:420-425） |
| src/services/format.ts | 新增 formatMoneyCompact（亿/万档，一位小数）；formatMoneyFixed 范式推广到差额行 |
| src/components/fields.tsx | FieldTip 扩展为「hint ≤60 字符 + tooltip 全文」双通道 |
| src/components/BasicCalculator.tsx | 输出卡按 §2 四层复核；40px hero 全站唯一；图表去 Legend 改直接标注、补 tickLine/axisLine=false |
| src/components/advanced/MonteCarloPanel.tsx | note 6→2；轴 tick 挂令牌与 tabular-nums；补轴框关闭 |
| src/components/advanced/PensionPanel.tsx | 4 处 note 与长来源串（zh-CN.ts 134/165 等）改「一句话出处 + FieldTip 全文」 |
| src/components/advanced/RentalPanel.tsx / AccumulationPanel.tsx / ReversePanel.tsx | note 压缩（2→1、1、3→2）；年度明细数值列右对齐；补轴框关闭 |
| src/components/advanced/ScenarioPanel.tsx | 空态改「一句话 + 动作」（复用 Arco Empty，:11）；Arco Table 对比表值列右对齐 + 等宽数字（:293） |
| src/i18n/locales/{zh-CN,zh-Hant,en}.ts | §6 量化目标 2/3/4 三语同步执行（8 条长串清零） |
| src/App.tsx | 输出卡 hero 保持单一主数；不给左栏追加第二个大数 |

**执行顺序**：先全局规则（global.css + format.ts，一处改动全站收益）→ 轴框/tick 三减逐图补齐 → 逐面板（MonteCarlo → Pension → 其余）→ 最后 i18n 三语清理。

---

## 来源索引

- GOV.UK Design System：《Table component》《Font override classes》（design-system.service.gov.uk）；ONS Service Manual《Table》；Government Analysis Function《Data visualisation: tables》
- Material Design：《Data tables (M2)》·numeric alignment（m2.material.io）
- Carbon Design System：《Data table》·alignment 节（carbondesignsystem.com）；《Color palettes and accessibility for data visualization》（medium.com/carbondesign）
- 《Gridlines are gratuitous》（storytellingwithdata.com）；CFPB Design System ·数据可视化节（cfpb.github.io）
- Nielsen Norman Group：《Progressive Disclosure》《Tooltip Guidelines》《Why So Many Info Tips Are Bad》《Designing Empty States in Complex Applications》（nngroup.com，章节见正文）
- USWDS：《Tooltip》·When to use 节（designsystem.digital.gov）
- UX Writing Hub《Top 10 Examples and Guidelines for Empty States》；UX Planet《Empty State Design: A Practical Guide》（uxplanet.org）
- WCAG 2.1：1.4.1 Use of Color、1.4.11 Non-text Contrast（w3.org）
- Fuselab《Dashboard Design System guide》（fuselabcreative.com）
- 开源参照：algo365/FIRE-Simulator（React+recharts+Tailwind，github.com）、jamesmontemagno/app-fire-calculator（离线优先 FIRE 计算器，github.com）、cFIREsim（历史抽样模拟，cfiresim.com）

## 自检记录

- 行数预算：`wc -l docs/research-fintech-ui.md`（要求 ≤300），结果见交付说明。
- 禁词扫描：按仓库 12 词禁词清单逐词 `grep -Ein` 全文扫描（词面不在此复述），要求零命中；扫描时不含本行。
- 代码取证命令：`find src -type f`、`grep -n tabular src/styles/global.css`、`sed -n` 定点核对 42/51-52/59-60/103/301-302/309-310/408-425/420-425/889/1025/1147-1153、`awk 'length>=140 {print NR": "length}' src/i18n/locales/zh-CN.ts`（8 条）、`grep -o wf-panel-note … | wc -l`（逐面板 6/4/3/2/1/1）、`grep -rln recharts src/components/`、`grep -rn "tickLine\|axisLine" src/components/`（零命中）、`grep -n "Table\|Empty" src/components/advanced/ScenarioPanel.tsx`。
