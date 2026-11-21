# 交互模式研究：成熟产品怎么响应人

调研日期 2026-11-21。方法：13 组网络检索 + 2 次页面直读（Kowalski 动效文章、Stripe Apps Tooltip 文档）核对来源（URL 随文内注，检索/直读记录见文末附）+ 直接读取 `node_modules/@arco-design/web-react` 源文件（任务 B，路径随文内注行号）+ 本仓库源码逐条核对落点（`src/...:行号`）。本文为任务 A/B/C/D 交付：§0 成熟度模型、§1 因果联动、§2 反馈分层、§3 键盘快捷键、§4 图表交互、§5 巧思目录（16 项）、§6 可复用片段。

---

## §0 交互成熟度模型

五级自评标尺（用于判断「下一个交互改进值不值得做」）：

| 级别 | 定义 | 典型特征 |
| --- | --- | --- |
| L0 无反馈 | 动作与结果之间无桥 | 点了没动静，靠用户自己找变化 |
| L1 状态反馈 | 控件自身状态可见 | hover/按下变色、焦点描边（本项目多数控件已达） |
| L2 因果反馈 | 改了什么 → 什么变了可见 | 变更处闪亮、数字滚动（部分输出卡已达，见 §5） |
| L3 结构反馈 | 层级/过渡有方向感 | Tabs 指示条滑动、面板进出方向感 |
| L4 仪式感 | 关键成就有专属时刻 | 达成段位的刻度环脉冲、分享成功变身 |

本项目现状：L1 基本齐备（`.wf-pressable` `src/styles/global.css:376`）、L2 已有骨架（防抖落定→store→`useAnimatedNumber` 数值滚动 `src/components/hooks.ts:198`、段位闪色 `src/components/BasicCalculator.tsx:587-594`、刻度环 tick pop `src/styles/global.css:1257`）、L3/L4 有零星未收口空间。**下一步最高杠杆在 L2 的补全（因果可见）与 L3 的低成本开箱（Arco 未启用动画属性，§5.9）**。

---

## §1 因果联动模式

**1.1 flash-on-change（闪亮后淡出）**：值变化处叠一次性背景高亮，动画从亮色回到透明；按方向分色（涨绿/跌红）是交易网格的行业惯例（来源：RevoGrid 官方文档 "Flashing Cells" https://rv-grid.com 与其 GitHub README 内建 Cell Flash 特性 https://github.com/revolist/revogrid ，本会话检索核实）。实现要点：变化时给元素换 key 重挂或重加 class 触发一次性 `animation`，`animationend` 后回到静息态；推荐时长 400–600ms（一个本仓库慢档 360ms 起步即可）。金融产品对「哪里变了」的响应几乎都收敛到这一式——比弹气泡更克制、比文字提醒更快被扫读。

**1.2 图表区间联动**：仪表盘改日期区间/筛选的通行做法是**轴系锚定、只动数据形**——十字线吸附最近数据点、tooltip 浮值更新，图表尺寸与刻度不随筛选闪跳（crosshair + tooltip 吸附与跨面板同步为 Grafana/MUI X 等仪表盘内建行为，来源：Grafana Shared Crosshair/Shared Tooltip 文档 https://grafana.com/docs/grafana/latest/dashboards/dashboard-settings/ ，本会话检索核实；Stripe Apps 官方 Tooltip 组件文档 https://docs.stripe.com/stripe-apps/components/tooltip 本会话直读核实，其口径为「tooltip 承载元素的上下文补充信息」）。对单页工具的启示：**重算时保持 Y 轴刻度与图尺寸不变**（本项目已按断点固定 chartHeight，`src/components/hooks.ts:139-147`），变化只发生在数据形上。

**1.3 输入 ↔ 图形双向高亮**：Wise 汇率计算器输入任意一侧，另一侧结果即时呈现、结果区以一次性强调标示「刚被改出来的部分」（来源：Wise 换算器即时转换的产品行为 https://wise.com/us/currency-converter ，本会话检索核实产品页存在；**未检索到官方动效规格文档，具体实现为社区观察归纳，非官方出处**）。双向高亮的成本最低实现：hover/聚焦输入字段 ↔ 图形对应条目加静态强调（描边/不透明度），不需动画（本项目龙卷风图条目与输入字段存在天然 key 映射，见 §5.2）。

**1.4 阈值达成反馈**：跨过关键阈值（段位/目标）时给一次**单发**强调——本项目已有两处实例可作模板：段位 Tag 变更时递增 flash 序号重挂触发单次涨色（effect `src/components/BasicCalculator.tsx:587-594`、Tag 以 key 重挂 `:786-796`），刻度环 tick 点亮时 pop 动画（`src/components/BasicCalculator.tsx:427`、`src/styles/global.css:1261`）。成熟产品的一致做法：达成反馈只在「状态翻转的那一帧」播放一次，绝不循环。

---

## §2 反馈四级分层（含标准数值）

**2.1 四级反馈的差异化标准值**（综合 Material Design 3 状态层规范 https://m3.material.io/foundations/interaction/states/state-layers 与 Emil Kowalski 动效实践 https://emilkowal.ski/ui/7-practical-animation-tips ）：

| 级别 | 触发 | 位移 | 透明度/覆盖 | 时长 | 缓动 | 频次纪律 |
| --- | --- | --- | --- | --- | --- | --- |
| ① 悬停 | pointer enter | 0–1px | 覆盖层 8% 不透明度（M3 hover-state-layer） | 100ms | standard | 高频动作可完全免动画（Kowalski：每日上百次触发的反馈应取消） |
| ② 按压 | pointer down | scale 0.98（本项目取值，`global.css:383`；Kowalski 同类建议 0.97） | 覆盖层 12%（M3 pressed-state-layer） | 100ms | standard | 离手即回弹，不等待落定 |
| ③ 落定 | 值提交 | 数字滚动/闪亮，位移 0 | 高亮 100%→0 | 240–600ms | 渐近（末端趋零） | 只播一次；连续变更以最新值为起点重启 |
| ④ 达成 | 状态翻转 | 元素内 pop（tick 放大 ~1.15） | 语义色单次涨色 | 360ms | 带少量过冲 | 每次翻转仅一发，禁循环 |

**2.2 时长标尺**（两个独立权威交叉验证）：
- Nielsen 三限：0.1s 内 = 感觉即时；1s 内 = 思维流不断；10s = 注意力上限（ https://www.nngroup.com/articles/response-times-3-important-limits ）。
- Kowalski（本会话直读原文核对）：UI 动效总则 **<300ms**；下拉示例 180ms 比 400ms 更跟手；tooltip 过渡 125ms ease-out（初始 0.97 缩放）且**显示前加延迟防误触**；进场/退场一律 ease-out（ease-in「不是为 UI 动效而生的」）；按压 scale 0.97；进场不从 scale(0) 起（用 0.9+）；**每日出现数十上百次的反馈应整体砍掉动画**（ https://emilkowal.ski/ui/7-practical-animation-tips ）。原文未给进场/退场两档时长拆分，此前草稿的「进场 ~150ms/退场 ~100ms」无出处，已删除。
- 对齐结论：本仓库令牌 fast=120ms（①②级）/ base=240ms（③级常规）/ slow=360ms（③级大数字、④级达成）与上述标尺**完全同轨**（`src/styles/global.css:101-103`、`src/data/defaults.ts:211`），无需新增时长档。

**2.3 组件库动效令牌对照**（任务 B，读 `es/style/theme/default.less:20-36`）：
- 时长：`@transition-duration-1..5` = 0.1/0.2/0.3/0.4/0.5s，`loading` = 1s。本项目三档（120/240/360）落在其 1/2/3 档之间偏紧——**兼容性无冲突**：Arco 组件动画走自己的 less 变量，本项目覆盖用 `--wf-*`。
- 缓动（default.less:28-36）：linear `cubic-bezier(0,0,1,1)`；standard `cubic-bezier(0.34,0.69,0.1,1)`；overshoot `cubic-bezier(0.3,1.3,0.3,1)`；decelerate `cubic-bezier(0.4,0.8,0.74,1)`；accelerate `cubic-bezier(0.26,0,0.6,0.2)`。
- 原生动画规格（`es/style/animation/*.less`）：fadeInStandard 进出 = duration-3 + standard（fade.less:12,21）；fadeIn 快态 = duration-1 + linear（fade.less:32,41）；slide 位移类 = duration-2 + standard（slide.less:17-34）——**「进出 200–300ms、位移类 200ms」与本仓库 base 档一致**；本项目缓动令牌 `--wf-ease-standard cubic-bezier(0.2,0,0,1)`（global.css:104）与 Arco standard 不同曲但同用途，差异可接受，不必为对齐而改。

---

## §3 键盘与快捷键

**3.1 成熟模式盘点**：
- `?` 帮助浮层：Linear 按 `?` 打开可搜索的快捷键帮助（官方变更日志 https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help ）；GitHub 的 `?` 打开**当前页面相关**的快捷键清单（ https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts ）——要点是「帮助浮层必须可搜索/分上下文」，一屏全列的长表等于没有。
- 修饰键渐进确认：Linear 在快捷键提示里高亮用户已按下的修饰键，让多键组合有「进度感」（来源：shortcuts.design 收录的 Linear 细节 https://shortcuts.design/tools/toolspage-linear ）。
- 全局召唤与单命令热键：Raycast 支持全局热键 + 每命令独立热键（ https://manual.raycast.com/command-aliases-and-hotkeys ）；Notion 以 `/` 行内命令 + `Cmd/Ctrl+K` 搜索为入口（ https://www.notion.com/help/keyboard-shortcuts ）。对单页工具：一个 `?` 足够，全局热键不适用。
- Esc 作通用「退出一层」：Linear 以 Esc 逐层退出（关浮层→清命令→退焦输入框），而非一次全关（ https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help 及其社区讨论归纳）。**逐层 Esc 需要层级栈（§6.4）**。

**3.2 无障碍边界**（硬约束，非风格）：
- WCAG 2.1.4 字符键快捷键：**纯字符键**（含数字 1/2/3、`?`）触发的快捷键必须满足其一：可关闭 / 可改绑为带修饰键 / 仅在组件聚焦时生效（ https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html ）。实现上最省力的是第三条+输入豁免：焦点在 `input/textarea/select/contenteditable` 时不派发（§6.3）。
- 数字键切面板属字符键快捷键 → 必须走 §6.3 的输入豁免，且在 `?` 浮层内明示这些键的含义。
- 焦点管理：Tab 头方向键漫游本项目已实现（roving tabindex，`src/components/AdvancedPanel.tsx:93-115`）；帮助浮层需焦点困住 + Esc 退出 + 关闭后焦点归还触发元素（WAI-ARIA dialog 惯例）。

---

## §4 图表交互

**4.1 crosshair 十字线**：recharts `Tooltip` 的 `cursor` prop 三档用法——`false` 关闭 / 对象形态给描边虚线 / 传自定义 SVG 元素（竖线 `<Line>` 或热区 `<Rect>`）（官方 API https://recharts.github.io/en-US/api/Tooltip ；自定义 cursor 组件实现范例 recharts issue #1816 https://github.com/recharts/recharts/issues/1816 ，本会话检索核实）。成本：对象形态为零成本属性；自定义元素约 10 行。实现注意：cursor 元素与图形层/activeDot 的叠放次序需在目标图上实测（层级表现未在官方文档明示），以直读 DOM 层序为准，不引未核实的 issue 编号。

**4.2 联动高亮（多图同步）**：多张图共用 `syncId` 即获得 hover 联动（十字线与 tooltip 跨图同步），v2 起 `syncMethod="index"|"value"|fn` 控制对齐口径（recharts 官方 API，本会话检索核实；注意 `syncId`/`syncMethod` 是**图表级 props** 而非 Tooltip 属性）。成本：加一个属性；风险：数据列长度不一致时 index 同步会错位，需 `value` 或函数对齐。

**4.3 hover 数值气泡**：成熟仪表盘惯例是「共享气泡」——十字线处一并列出所有系列值而非每系列一个泡（Grafana 的 Shared Crosshair / Shared Tooltip 两档语义即此模式的官方实现：前者跨面板画线、后者再叠加跨面板数值气泡，来源 https://grafana.com/docs/grafana/latest/dashboards/dashboard-settings/ ，本会话检索核实）。recharts 实现：自定义 `content` 渲染分组值列表。**气泡必须有延迟/防抖**（Kowalski 原文直读核实：tooltip 显示前加初始延迟防扫过误触）。

**4.4 click-to-filter**：点击图元过滤数据是仪表盘大模式，但成本高：需要把点击映射回数据键 → 写入筛选状态 → 全部下游重算。对本项目：龙卷风图的条目本身已是「敏感度排序」结果，点击过滤反而破坏语义；**不推荐引入**，保留 hover 强调即可。

**4.5 成本评估**（recharts v2，本项目已用图：龙卷风 BarChart `src/components/BasicCalculator.tsx:213`、蒙特卡洛 LineChart ×2 `src/components/advanced/MonteCarloPanel.tsx:690,863`、复利路径 LineChart `src/components/advanced/AccumulationPanel.tsx:532`、收租 BarChart `src/components/advanced/RentalPanel.tsx:643`——全为 `<XxxChart>` 起点，本会话 grep 核实）：
- `cursor` 对象形态 / `activeDot` 属性：纯渲染属性，无状态，成本 ≈ 0。
- 自定义 `content` 气泡：每次 hover 触发一次重渲染（仅气泡子树），可控。
- `syncId`：无状态；多图同 hover 时各图各重渲染一次 tooltip 子树。
- 手写 crosshair（mousemove + ref 定位）：新增高频 mousemove 重渲染路径，**不采用**，全部走 recharts 内建。

---

## §5 交互巧思目录（16 项）

> 格式：描述 → 落点 → 成本 → 性能 → 降级。状态标注：✅已实现 / ▲补全 / ★新增。所有项在 `prefers-reduced-motion: reduce` 下的全局兜底为 `src/styles/global.css:644-649`（transition/animation 强制 0.01ms）；JS 驱动动画必须过 `usePrefersReducedMotion`（`src/components/hooks.ts:162`）。

**5.1 输出卡因果闪亮 ▲**｜描述：输入落定→受影响的输出卡一次背景高亮后淡回（§1.1），与已有段位闪色同构。｜落点：`src/components/BasicCalculator.tsx:683-694`（输出卡 className 拼接处）+ 新 `.wf-flash` 样式。｜成本：少量 TSX（epoch 递增重挂，先例 `:587-594`）+ CSS。｜性能：纯 CSS animation 合成；不加渲染路径（复用落定帧）。｜降级：全局兜底后即无动画；保证静息态样式与变化前一致即可读。

**5.2 输入 ↔ 龙卷风条双向高亮 ▲**｜描述：hover/聚焦某输入字段 → 同名敏感度条加静态描边强调；反向同理。｜落点：`src/components/fields.tsx:126`（NumberField 容器 onFocus）↔ `src/components/BasicCalculator.tsx:213`（BarChart）与 `:246-248`（Cell 按 row.name 映射）。｜成本：少量 TSX（一个 hoveredKey state + key 映射表）。｜性能：一个字符串 state，SVG class 更新，不触发计算。｜降级：强调用静态描边/色，无动画参与。

**5.3 构成明细 count-up 扩展 ▲**｜描述：把现有 `useAnimatedNumber` 从临界值大数字推广到构成明细关键行（≤6 行，防帧内 setState 放大）。｜落点：`src/components/BasicCalculator.tsx:578` 模式 → Descriptions 行值。｜成本：需状态（复用 `src/components/hooks.ts:198`，零新代码）。｜性能：rAF 每帧 setState——每行一条独立动画路径，行数上限 6 以内可控。｜降级：hook 内建减弱动效直接落值（`hooks.ts:214-220`）。

**5.4 刻度环达成脉冲 ✅**｜描述：全档达成时 halo 单次脉冲（§1.4 的现成实现，列入目录防止被误删/退化）。｜落点：`src/components/BasicCalculator.tsx:404-407`、`src/styles/global.css:1269-1290`。｜成本：已实现。｜性能：一次性 animation。｜降级：全局兜底，环仍以终态呈现。

**5.5 防抖静默窗口微指示 ✅**｜描述：300ms 防抖窗口内卡头显示「实时更新中」待定态，落定清位（loading 翻转前不可见问题已有注释级修正）。｜落点：`src/components/BasicCalculator.tsx:540-550`（computingPending 置位/清位 effect）、`:690`（挂 .wf-computing）、`src/styles/global.css:1297-1304`（呼吸动画）。｜成本：已实现。｜性能：一个布尔位。｜降级：JS 侧不挂类 + CSS 兜底双闸（实现见 `:540` 注释）。

**5.6 控件按压反馈 ✅**｜描述：`.wf-pressable` 按 2.1 表②档（scale 0.98 + 120ms）。｜落点：`src/styles/global.css:376-397`。｜成本：已实现。｜性能：transform 合成层。｜降级：全局兜底。

**5.7 卡片克制悬浮 ▲**｜描述：输出卡 hover 上浮 1px + 阴影加深 + 覆盖层 8%，无过渡时长加倍（①档纪律）。｜落点：`src/styles/global.css` 输出卡类（现有 box-shadow 过渡 `:214` 已是 240ms——按①档应压到 120ms，顺带修正）。｜成本：CSS-only。｜性能：transform/box-shadow 合成，一次过渡。｜降级：仅阴影变化，取消位移。

**5.8 主题切换圆形扩散 ★**｜描述：`document.startViewTransition` 包住主题翻转，从切换按钮坐标做 clip-path 圆形揭示；不支持直接切换（降级链见片段 §6.6）。｜落点：`src/App.tsx:41`（toggleTheme 调用处）。｜成本：少量 TSX（~20 行）+ 一段 CSS。｜性能：一次性快照成本，无持续开销。｜降级：不支持 API→即时切换；减弱动效→跳过 startViewTransition（注意：全局 0.01ms 兜底不命中伪元素动画，需显式规则，见 §6.6）。

**5.9 Tabs 指示条滑动 ▲**｜描述：开箱启用 Arco Tabs `animation={{ inkBar: true, tabPane: true }}`（属性未启用，源码确认 `node_modules/@arco-design/web-react/es/Tabs/interface.d.ts:24`；当前 `src/components/AdvancedPanel.tsx:139-145` 未传）。｜落点：`src/components/AdvancedPanel.tsx:139`。｜成本：属性-only（一行）。｜性能：组件库 CSS transition，无新渲染路径。｜降级：组件库动画同样被全局兜底压停（0.01ms），终态一致。

**5.10 `?` 帮助浮层 ★**｜描述：全局 `?` 打开分组可搜索快捷键清单（数字键切分组、Esc 层级、方向键漫游 tab），含「焦点在输入框内时这些键不生效」的明示。｜落点：新组件挂 `src/App.tsx`；快捷键逻辑用 §6.3。｜成本：需状态（一个 open 布尔 + 静态内容）。｜性能：仅打开时渲染一次，无监听成本（单全局 keydown 已含在 §6.3）。｜降级：无动画版本（淡入由全局兜底压停）。

**5.11 数字键切高级分组 ★**｜描述：1/2/3 → 人生规划/购房金融/分析工具（§3.2 输入豁免）。｜落点：`src/components/AdvancedPanel.tsx:84`（groupId state）。｜成本：需状态（复用 §6.3 hook 一行）。｜性能：一个 state 写。｜降级：无动画依赖。

**5.12 Esc 层级栈 ★**｜描述：浮层/帮助/未来弹层按注册顺序逐层关闭，不一次全关（§3.1）。｜落点：新 `useEscLayer`（§6.4）供帮助浮层与后续弹层使用；现有组件库 Tooltip Esc 行为内建不受影响。｜成本：需状态（~22 行 hook）。｜性能：栈为模块级数组，监听仅在 active 时挂。｜降级：不适用（无动画）。

**5.13 分享复制成功变身 ▲**｜描述：复制成功后按钮从「复制文案」变身「已复制 ✓」（已有）再加一次 240ms 主色描边脉冲，转化既有文字反馈为仪式感（L4）。｜落点：`src/components/BasicCalculator.tsx:1055-1064`（copied 分支两处按钮）。｜成本：少量 TSX（copied 时挂一次 class，`animationend` 清除）+ CSS。｜性能：单元素单次 animation。｜降级：兜底压停后保留 ✓ 文案语义。

**5.14 输入即时帧反馈（不破防抖）★**｜描述：InputNumber 聚焦编辑中，字段左侧 2px 色条按值在限域内的位置着色（位置即时、着色即时），落定才触发 §5.1 的下游闪亮——编辑帧反馈与落定反馈分离。｜落点：`src/components/fields.tsx:126`（本地编辑态已有 pendingInvalid 先例 `:77`）。｜成本：少量 TSX（本地 state，不经 store）。｜性能：编辑帧本地 state 不触 store/计算；色条为静态元素换色。｜降级：色条保留（无动画参与），纯静态强调。

**5.15 空态弓弦绷直 ★**｜描述：资产从 0 到有（完成度翻转）时，空态刻度尺的虚线弓弦做一次绷直过渡，此后不再动画（达成反馈纪律：只在翻转帧一发）。｜落点：`src/components/EmptyRuler.tsx:25-33`（弓弦 path）+ 显示判定 `src/components/BasicCalculator.tsx:603`（gaugeVisible：资产已填 + 结果就绪 + 参数合法）。｜成本：需状态（完成度布尔 + `stroke-dashoffset` 过渡）。｜性能：单 path 属性过渡一次。｜降级：兜底后弓弦瞬切终态，文案承载信息不变（EmptyRuler 设计约束「静态图形」，实现时保持 aria-hidden 不变）。

**5.16 图表 hover 十字线联动 ★**｜描述：四张既有图启用 recharts `Tooltip`（cursor 对象形态虚线 + 自定义 content 共享气泡，§4.1/§4.3），蒙特卡洛正态图与复利路径图同屏时加同一 `syncId` 联动（§4.2，`syncMethod="value"` 防数据长度错位）。｜落点：`src/components/advanced/MonteCarloPanel.tsx:690,863`、`src/components/advanced/AccumulationPanel.tsx:532`、`src/components/advanced/RentalPanel.tsx:643`（全库 grep 确认现无任何 recharts Tooltip，命中均为字段提示）。｜成本：属性 + 自定义 content 组件（§6.5 直接可用）。｜性能：hover 仅 tooltip 子树重渲染；syncId 无状态；不新增 mousemove 监听路径（§4.5）。｜降级：触屏无 hover——数值由图下明细行/数值标签承载；cursor 为静态描边，无动画参与。

---

## §6 可复用代码片段

### 6.1 因果高亮（变化→一次闪亮）

```tsx
// useFlashOnChange：值变化返回递增 epoch；宿主以 key={epoch} 重挂触发 CSS 一次性动画。
// 与既有 multFlashEpoch（src/components/BasicCalculator.tsx:587-594）同构，可替换其手写逻辑。
import { useEffect, useRef, useState } from "react";

export function useFlashOnChange(value: number): number {
  const [epoch, setEpoch] = useState(0);
  const prev = useRef(value);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {          // 首值不闪（与 useAnimatedNumber 首值纪律一致）
      mounted.current = true;
      prev.current = value;
      return;
    }
    if (value !== prev.current) {
      prev.current = value;
      setEpoch((e) => e + 1);        // 重挂 = 最可靠的 animation 重触发，无 reflow hack
    }
  }, [value]);
  return epoch;
}
```

```css
/* 用法：<div key={epoch} className="wf-flash">…</div>；.cleanup 不需要（动画只跑一次） */
.wf-flash {
  animation: wf-flash-bg var(--wf-dur-slow) var(--wf-ease-standard) 1;
}
@keyframes wf-flash-bg {
  0%   { background-color: var(--wf-bg-tint); }          /* global.css:60 已有 8% 主色底 */
  100% { background-color: transparent; }
}
```

### 6.2 count-up hook（渐近滚动通用版）

```tsx
// useCountUp：目标值变化时 rAF 渐近收敛（easeOutCubic = 1-(1-t)^3，与令牌
// --wf-ease-asymptotic 同族）。生产路径请直接复用 hooks.ts 的 useAnimatedNumber
// （src/components/hooks.ts:198，多墙钟兜底与首值纪律）；本版为可独立摘走的最小实现。
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../components/hooks"; // hooks.ts:162

export function useCountUp(target: number, durationMs = 360): number {
  const [display, setDisplay] = useState(target);
  const cur = useRef(target);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    // 降级：减弱动效/非法值/无变化 → 直接落值，不播帧不残留
    if (reduced || !Number.isFinite(target) || cur.current === target) {
      cur.current = target;
      setDisplay(target);
      return;
    }
    const from = cur.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3)); // 末端速度趋零
      cur.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else { cur.current = target; setDisplay(target); } // 结束帧精确=目标，防舍入残留
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf); // cleanup：卸载/目标变更取消未完成帧
  }, [target, durationMs, reduced]);
  return display;
}
```

### 6.3 快捷键注册（含 WCAG 2.1.4 输入豁免）

```tsx
// useShortcut：全局 keydown + 输入焦点豁免。match/handler 需引用稳定（调用方 useCallback），
// 或接受 effect 随引用变化重挂（清理函数保证不泄漏）。
import { useEffect } from "react";

export function useShortcut(
  match: (e: KeyboardEvent) => boolean,
  handler: () => void,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" ||
        t?.tagName === "SELECT" || t?.isContentEditable === true;
      if (typing) return;              // WCAG 2.1.4：字符键快捷键不在输入焦点内派发
      if (match(e)) { e.preventDefault(); handler(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey); // cleanup 必做
  }, [match, handler]);
}
// 用法：useShortcut((e) => e.key === "?" , openHelp);
//       useShortcut((e) => e.key === "1", () => setGroupId("plan"));
```

### 6.4 Esc 层级栈（逐层关闭）

```tsx
// useEscLayer：模块级栈，后注册者先关；非栈顶监听不响应（避免一次全关）。
import { useEffect } from "react";

const stack: Array<() => void> = [];

export function useEscLayer(active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack[stack.length - 1] !== close) return;   // 只让栈顶响应
      e.preventDefault();
      close();
    };
    stack.push(close);
    window.addEventListener("keydown", onKey);
    return () => {
      const i = stack.indexOf(close);                  // cleanup：摘栈 + 摘监听
      if (i >= 0) stack.splice(i, 1);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, close]);
}
// close 需引用稳定（useCallback），否则 effect 反复摘挂。
```

### 6.5 图表 crosshair（recharts 内建，零手写监听）

```tsx
// 直线/柱图通用：cursor 对象形态 + 共享气泡；不新增任何 mousemove 渲染路径（§4.5）。
<Tooltip
  cursor={{ stroke: "var(--wf-text-tertiary)", strokeDasharray: "3 3" }}
  content={({ active, payload, label }) =>
    active && payload?.length ? (
      <div className="wf-chart-tip">
        <div className="wf-chart-tip-label">{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} className="wf-chart-tip-row">
            <span>{p.name}</span>
            <span>{money(Number(p.value))}</span>
          </div>
        ))}
      </div>
    ) : null
  }
/>
// 多图联动：各图加同一 syncId（syncMethod="value" 按值对齐，防长度错位，§4.2）。
// 降级：触屏无 hover——气泡仅指针设备出现，数值信息另有明细行承载。
```

### 6.6 主题切换圆形扩散（带双降级）

```tsx
// revealTheme：从点击坐标圆形揭示；API 不支持→直接切；减弱动效→直接切。
function revealTheme(x: number, y: number, apply: () => void, reduced: boolean): void {
  if (reduced || typeof document.startViewTransition !== "function") { apply(); return; }
  const t = document.startViewTransition(apply);
  void t.ready.then(() => {
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 360, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => { /* ready 不决时静默放弃，主题已切换，无视觉残留 */ });
}
```

```css
/* 弱动效双保险：全局 0.01ms 兜底（global.css:644-649 的 * 选择器）不命中伪元素动画，
   必须显式停掉 view-transition 分组动画；否则减弱动效用户会看到不受控的揭示动画。 */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(root),
  ::view-transition-old(root),
  ::view-transition-new(root) { animation: none !important; }
}
```

---

## 附：引用与核对记录

- Web 检索（本会话 13 组）：Nielsen 三限、M3 状态层（hover 8%/pressed 12% 交叉核实于 material-web 令牌源码）、Kowalski 动效实践、Linear/GitHub/Notion/Raycast 快捷键、Wise 换算器、RevoGrid Cell Flash、Grafana Shared Crosshair/Tooltip、recharts cursor/syncId、WCAG 2.1.4——URL 已随文内注；另有 2 次页面直读：emilkowal.ski/ui/7-practical-animation-tips（原文数值口径，§2.2 已按原文修正）、docs.stripe.com/stripe-apps/components/tooltip（确认存在，§1.2 归属已收窄）。
- 组件库源读（本会话逐文件核对）：`es/style/theme/default.less:20-36`、`es/style/animation/{fade,slide}.less`、`es/Tabs/interface.d.ts:24`（animation）、`es/InputNumber/interface.d.ts:74-130`（mode 74 / formatter 95 / hideControl 130）、`es/Card/interface.d.ts:26`（hoverable）、`es/Progress/interface.d.ts:22-24`（animation，仅 type=line 生效）、`es/Tooltip/interface.d.ts:40-42`（mini）、`es/Collapse/interface.d.ts:56`（triggerRegion）、`es/Slider/interface.d.ts:105`（formatTooltip）与 `:60`（marks）。
- 仓库核对：文内所有 `src/...:行号` 均在本会话读取/检索确认；「未启用交互属性」以全库 grep（`hoverable`、`animation=`、`formatTooltip`、`formatter=`、`hideControl`、`mode=`、`triggerRegion` 零命中；`mini` 命中均为 Button size="mini" 非 Tooltip.mini）为准——Tabs.animation、Card.hoverable、InputNumber.mode/formatter/hideControl、Progress.animation、Tooltip.mini、Collapse.triggerRegion 均未启用；Slider 组件未引入（滑杆诉求现由 InputNumber 承担，若后续引入可用 `formatTooltip`/`marks`，行号见上）。
