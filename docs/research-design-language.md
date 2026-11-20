# 设计语言与巧思研究（人格 · 克制的庆祝 · 北极星）

| 项 | 值 |
| --- | --- |
| 文档性质 | 第三轮设计研究：回答「设计差了点意思、平铺直叙」——人格表达证据、巧思目录（15 项）、北极星候选与支撑参数 |
| 研究方法 | 本会话原文抓取两套国际体系的人格/价值观章节与三套体系的基础参数章节（引用随行标注）；理财类庆祝手法取行业文章一篇原文 + 四轮检索汇总；本仓库现状全部为本会话命令实测（命令与行号随行标注） |
| 中性约定 | 延续 `docs/design-spec.md` 文首口径：国际体系以「设计体系 A/B/C/D」代称、行业来源以「行业文章 P、行业文章 Q、行业调研 R/S/T」代称，不出现来源品牌名与 URL（按「文档名 + 章节名」引用）；组件库包导入名豁免 |
| 与既有文档关系 | 前两轮：`docs/design-research.md`（令牌/对比度）、`docs/research-design-v2.md`（图形/空态）。本轮聚焦人格与巧思；#1–#14 编号与 `docs/design-language.md` §2 签名元素 S* 引用对齐，#15 为该文档 S15 引用所缺的补登项。所有新巧思落地前须先回填 design-spec 对应章节再施工 |
| 读者 | design-spec 6.1 定义的材质方（§3 表）与动效方（§1 巧思执行者） |

**来源对照表（标注 = 本会话实际读取方式）**

| 代称 | 文档与章节 | 读取方式 |
| --- | --- | --- |
| 设计体系 A | 《设计价值观》章（自然 / 确定性 / 意义感 / 生长性） | 官网文档页原文抓取 |
| 设计体系 B | 《Principles》章（四原则 + 逐条自检问句） | 官网文档页原文抓取 |
| 设计体系 C | 《Motion》《Spacing》《Typography》《Color → Guidelines(tokens)》四章 | 官网文档页原文抓取 |
| 设计体系 D | 《Motion(easing and duration)》《Typography(type scale)》《Elevation》《Shape(corner radius)》 | SPA 页无法直读，数值经官方页引文检索核对（检索汇总口径） |
| 行业文章 P | 《The Rise of Gamification in Fintech and Digital Banking》 | 全文抓取 |
| 行业文章 Q | 数字滚动 / 统计卡动效实践口径（时长、tabular-nums、何时停用） | 检索汇总 |
| 行业调研 R | FIRE 工具里程碑分段（Coast / Lean / Full / Fat）与 FI% 刻度 | 检索汇总 |
| 行业调研 S | 空态人格化口径（插图定调、不抢注意力） | 检索汇总 |
| 行业调研 T | 交易类 App 庆祝不对称性批判（涨庆跌淡 = 操纵信号） | 检索汇总 |

---

## §0 北极星候选（三选一，推荐候选一）

### 候选一「静水账房」（推荐）

- **一句话概念**：把界面做成一间安静而精密的私人账房——每个数字都被认真对待，庆祝只发生一次，且小到几乎只剩一次呼吸。
- **视觉隐喻**：刻度尺 + 发丝线分组 + 读数窗（进度环 = 量具刻度，大数字 = 读数）。
- **语气关键词**：安静、精密、诚实、从容。
- **签名元素（3）**：①四档里程碑刻度环（巧思 #1）；②达成一次脉冲——全站唯一庆祝动效（巧思 #2）；③度量字排 tabular-nums（巧思 #3）。
- **适配理由**：与既有三层材质 / 发丝线 / 三档时长两族曲线令牌体系零架构冲突（global.css:93-98、147-175 原样保留），属延续性升级；语气与体系 B「Have we removed everything gratuitous?」「Are we doing more with less?」、体系 A「保持克制：能做，但想清楚了不做」双口径互证；巧思目录 15 项中 7 项 CSS-only，尺寸门禁压力最小（本会话实测余量见 §2）。
- **风险**：账房感偏冷——需空态人格化（巧思 #6）与文案温度补偿对冲；深色下刻度点等新细节须双主题同轮验收。

### 候选二「度量仪器」

- **一句话概念**：财务规划是一台精密仪器，人格来自仪器本身的确定性——读数体验即是品牌。
- **视觉隐喻**：仪表盘 / 校准标记 / 刻度盘。
- **语气关键词**：精密、克制、可靠。
- **签名元素（3）**：①行级 hover 读数（巧思 #4）；②诚实进度尺（巧思 #13，已具备）；③方向冗余编码 ▲▼（巧思 #10）。
- **适配理由**：全部巧思落在读数与输入，零叙事负担，与非文本指示 ≥3:1 及色盲友好档天然兼容。
- **风险**：与候选一同质化且更冷；没有达成仪式，正面反馈缺位——行业文章 P「A milestone creates a sense of movement even when the long-term financial outcome is still far away」的口径丢失。

### 候选三「时间的朋友」

- **一句话概念**：以时间为主隐喻，把复利可视化为时间的推进，进度环即钟面。
- **视觉隐喻**：钟面刻度 = 年份里程碑；乘数 = 摆幅。
- **语气关键词**：长远、从容、生长。
- **签名元素（3）**：①环刻度 = 年份刻度；②乘数摆幅标注；③达成年份标注。
- **适配理由**：FIRE 社群心智（Coast FI 概念本身就是时间概念，行业调研 R）与产品语义贴合。
- **风险（高）**：里程碑 = 年份需要 WASM 输出契约新增时间轴字段（`calcBaseline` 现无此口径，数据流改造违反铁律）；「倒计时」语气易从从容滑向催促；体系 C《Motion》「Do not use easing curves that suggest bounce, stretch, or sudden stops」下钟摆类常驻动效难合规。若采纳候选一，可吸收其「环刻度」思想但改用百分比档（25/50/75/100），零数据层改动。

**人格表达方法论（本轮研究归纳）**：三体系各给了一条把人格装进界面的路径——体系 A 靠价值观宣言约束动作（四价值观，每条落到「设计者应当做什么/不做什么」）；体系 B 靠自检问句（其中「If you covered up our logo or name, would you identify an execution as being designed by IBM?」给出了签名元素的可测判据：**遮住 logo 仍能认出**）；体系 C 靠成对的风格词汇（productive/expressive）把「什么时候允许抒情」写进规范。本产品的对应物：原则层（design-language.md §1 五条）+ 签名元素清单（S*）+ 双风格豁免条款（#2 为全站唯一 expressive 时刻）。

---

## §1 巧思目录（15 项；落点 = 顶栏 / 结果区 / 第九面板）

> 成本分档：**CSS-only**（global.css + 既有类）／**少量 TSX**（≤1 组件改动 + i18n 键）／**需动效令牌**（新增 THEME 键，本轮尽量为零）。
> 降级统一挂既有双闸：`usePrefersReducedMotion`（src/components/hooks.ts:141-151）+ global.css 通配兜底块（global.css:615-623，`animation-iteration-count: 1 !important` 等）。
> 顶栏落点刻意只保留零项：顶栏三层材质已满载（global.css:147-175），不新增动效。

| # | 名称 | 描述（视觉/交互） | 落点 | 成本 | prefers-reduced-motion 降级 |
| --- | --- | --- | --- | --- | --- |
| 1 | **四档里程碑刻度环** | FreedomGauge 环面外沿加 25/50/75/100 四个 2px 刻度点（chartGrid 色）；进度跨档时刻度点变主色并单次放大回落（150ms，iteration 1）。行业调研 R：FI 工具以百分比档位作里程碑刻度（Lean/Full/Fat 即 25× 倍数档） | 结果区（`FreedomGauge`，BasicCalculator.tsx:296-334；挂载 :501） | 少量 TSX（SVG 几何）+ CSS | 变色保留（信息不丢），放大停用 |
| 2 | **达成一次脉冲** | ratio ≥ 1 时环线以 `--wf-ease-emphasis` 单次 scale 1→1.04→1 + 环心文字涨色；`animation-iteration-count: 1` 硬约束。依据体系 C《Motion》「Reserve expressive motion for occasional, important moments」——达成 100% 即全站唯一 expressive 时刻 | 结果区 | CSS-only + TSX 状态位 | 脉冲停用，保留文字涨色（aria 播报链路不变） |
| 3 | **度量字排** | 全部数值行 `font-variant-numeric: tabular-nums` 防抖动；乘数/百分数加粗。行业文章 Q：动画数字必须配 tabular 数字避免数位跳动；「don't let screen readers announce every frame」（本项目 useAnimatedNumber 首值不滚、结束帧精确等于目标值，hooks.ts:187-199、215-218 已合规） | 结果区大数字与乘数行；第九面板数值行 | CSS-only | 静态，无降级 |
| 4 | **行级 hover 读数** | 数据行 hover 背景升 `--wf-tint-bg` 半档 + 值转粗——不用阴影。实证：体系 C《Color(tokens)》hover 即表面色变化（`$layer-hover-01 #e8e8e8`、`$background-hover rgba(141,141,141,0.12)`） | 结果区敏感性行；第九面板数据行 | CSS-only | 无动画，纯状态切换 |
| 5 | **轻确认「已复制」** | 分享按钮点击后按钮内文案 150ms 换「已复制」+ 对勾，快档后还原。时长对照体系 C fast-02 110ms 与「微交互 90–120ms」清单 | 结果区分享行（`handleCopyShare`，BasicCalculator.tsx:449） | 少量 TSX | 即时换文案，无过渡（Message.success 兜底仍在） |
| 6 | **空态人格化** | 资产未填时进度环缺席位渲染「未上弦的刻度尺」内联 SVG + 一句引导；四处空态同族图形经 Empty 的 `icon` 参数注入（Empty/interface.d.ts:17 实测 `icon?: ReactNode`）。行业调研 S：「插图是定调，不是装饰——有个性但不抢注意力」 | 结果区（进度环缺席位）；第九面板空态（MonteCarloPanel.tsx:676,905、AccumulationPanel.tsx:575、ScenarioPanel.tsx:282） | 少量 TSX + i18n | 静态图形 |
| 7 | **分组左标线** | 明细/说明块前加 `orientation="left"` 带文字分割线承载小节名（Divider/interface.d.ts:20 实测）；第九面板组内小节延续同族发丝线。体系 C《Spacing》「Space can also be used to denote groups」的线版实现 | 结果区明细区；第九面板 | CSS-only（现成 Divider） | 无动画 |
| 8 | **面板切换「就位」淡入** | 第九面板切换分组/标签时标题行单次 fade-in（`--wf-dur-base` 240ms，iteration 1）。体系 C productive 档「subtle and out of the way」 | 第九面板（AdvancedPanel.tsx:139-147 Tabs） | CSS-only | 停用，内容直接呈现 |
| 9 | **输出卡计算徽标** | 防抖静默窗口期输出卡卡头亮度呼吸（opacity 0.75→1 循环），落定即停。行业文章 P：「Progress indicators… create the feeling that the user is moving forward rather than getting stuck inside bureaucracy」——300ms 防抖静默窗正是「stuck」感的缺口 | 结果区卡头 extra 区（顶栏不动） | CSS-only + TSX 类切换 | 呼吸停用（计算时 Spin 反馈仍在，信息不丢） |
| 10 | **方向冗余编码** | 涨跌数值前置 ▲/▼ 字形——形状通道独立于颜色通道（WCAG 1.4.1）。行业调研 T 反例：交易类「涨庆祝跌淡化」的不对称强调即操纵信号，故语义色之外必须有形状冗余 | 结果区实时区；第九面板收租净现金流行 | CSS-only + i18n | 无动画 |
| 11 | **深色环线抬升** | 深色主题下环带外沿加 1px 提亮描边（入三源对账新令牌）。依据体系 D《Elevation》深色口径：海拔用色调表面（tonal surfaces）表达而非遮罩叠加（检索汇总口径） | 结果区（进度环）；可推广蒙特卡洛路径线 | CSS-only | 无动画 |
| 12 | **图↔行联动 hover** | 龙卷风图 Bar hover 时对应数值行高亮（同 tint 半档），双向对应显性化；recharts `onMouseEnter` 现成回调 | 结果区（敏感性） | 少量 TSX | 无 hover（触屏天然退化，行/图各自可读） |
| 13 | **诚实进度尺**（已具备） | 蒙特卡洛运行期 Progress 显示真实百分比（MonteCarloPanel.tsx:804 实测在位）。行业文章 P：可见前进感是理财场景刚需；体系 C《Motion》收尾问句「always a way to communicate similar messages statically」 | 第九面板 | 已落地（登记为资产，不重复施工） | 现状 |
| 14 | **乘数段位徽标** | 乘数跨段位（×2 / ×3.33）时行尾追加段位 Tag（「省下 N 个月的量」），跨档单次涨色 240ms。行业文章 P：「people enjoy recognition and visible progress」 | 结果区（乘数行） | 少量 TSX + i18n | Tag 常驻，涨色停用 |
| 15 | **目标线叙事标注** | 打工模拟图目标线标注「目标」字样 + 图下一句「中位预计第 N 年达成」（复用既有 Descriptions 同源字段，零数据流改动）。行业调研 R：Coast FI 属「比完全达成更早的软里程碑」，叙事行即软里程碑文案 | 第九面板（蒙特卡洛宿主图） | 少量 TSX + i18n | 无动画；无目标值时整行不渲染 |

> 落点覆盖核对：顶栏 0 项（刻意）；结果区 #1–#7、#9–#12、#14；第九面板 #4、#6、#7、#8、#10、#13、#15。三处职责各有署名。
> 收敛纪律：呼吸类（#9）同屏至多一个在动；#2 为全站唯一 expressive 时刻；新增签名元素先过 design-language.md §5 准入流程。

---

## §2 已装轮子采纳清单（组件库八组件；.d.ts 逐个读 + 体积本会话实测）

**量测方法（本会话实跑）**：esbuild（node_modules 自带）stdin 入口逐组件打包 minify（ESM/browser），node:zlib 计 gzip；「边际」= 在项目现用 20 组件全集 bundle（raw 557,034 B / gzip 162,457 B）上追加单组件的增量——真实增量，排除共享依赖膨胀。CSS 增量为各组件 `style/` 目录编译后 CSS 原始字节实测（wc -c）。门禁现状：`node scripts/check-size.mjs` 实跑通过，DIST_TOTAL_KB=1963 / 限 2,010（脚本硬限 2,010,000 字节，scripts/check-size.mjs:32），wasm 364 / 限 800；余量约 47KB。组件库样式按需引入纪律（src/main.tsx:23-41，19 项 style/css.js）——新增组件须同步补样式引入。

| 组件 | API 摘要（.d.ts 实测） | 本项目落点 | 压缩体积（本会话实测） | 深色适配注意 |
| --- | --- | --- | --- | --- |
| **Typography**（已用） | `Title heading 1-6`（interface.d.ts:99）；`Text/Paragraph` 共有 `type 5 种/bold/disabled/mark/underline/delete/code`（:56-88）；`copyable`（:17-23）与 `editable`（:29-35）；`ellipsis` 已标注 deprecated 宜用 `Typography.Ellipsis`（:37-40）；`Paragraph spacing close`（:118） | 全站文字骨干（顶栏 Title heading 5，App.tsx:241；大数字 Text） | 边际 0（已用） | `type="secondary"` 经组件库深色令牌自动切换（既有机制） |
| **Tag**（已用） | `color/bordered/size 4 档`（interface.d.ts:24）；`visible/closable/checkable/checked/icon/onClose/onCheck/fill`（:29-70） | 画像徽标、消费构成行；巧思 #14 段位徽标复用 | 边际 0（已用） | `color="gray"` 与语义 color 在深色下底/字对比按 design-spec 5.3 复核 |
| **Empty**（已用） | 仅三参数：`description/icon/imgSrc`（interface.d.ts:12-22），icon 为 ReactNode 可塞自定义 SVG | 四处空态（§1 #6 实测行号）；巧思 #6 人格化图形经 `icon` 注入 | 边际 0（已用） | 自定义 SVG 一律 `currentColor` 或主题解析色，禁硬编码浅色 |
| **Divider**（已用） | `type horizontal/vertical`（:14）；`orientation left/right/center` 带文字分割线（:20） | 收租面板既有分节；巧思 #7 分组左标线 | 边际 0（已用） | 线色走组件库 border 令牌（深色自动）；文字色用 `--wf-text-secondary` |
| **Descriptions**（已用） | `data(label/value/span)`；`column` 支持响应式对象 `{xs,md,…}`（interface.d.ts:37-45）；`colon/border/layout 4 种/size 5 档/tableLayout fixed`（:66-78） | 贷款/税务等键值表；输出卡明细拆解长句 → 结构化 2 列（`column={{xs:1,md:2}}`，p5-spec 既有项） | 边际 0（已用） | `labelStyle/valueStyle` 直写颜色违反「组件不感知主题」纪律（design-spec 6.2 #9），改挂 CSS 类用令牌 |
| **Statistic**（未用→不建议） | `value/precision/groupSeparator/prefix/suffix/extra/countUp/countFrom(默认0)/countDuration(默认2000ms)/renderFormat/loading`（interface.d.ts:59-88）；子组件 `Countdown`（:93-139，含 `onFinish/start/now`） | 无落点（主输出已有自研数值滚动） | 边际 +21,473 B raw / +7,258 B gzip；CSS +884 B raw | 若强行启用 `styleValue` 取色须经 resolveThemeTokens；countUp 无 reduced-motion 参数（.d.ts 无该字段），降级不可控 |
| **Skeleton**（未用→不建议） | `animation/loading/image(shape circle-square、size 3 档、position left-right)/text(rows/width)`（interface.d.ts:5-50） | 无落点（计算毫秒级 + 300ms 防抖，前轮研究结论骨架屏不适用） | 边际 +1,759 B raw / +552 B gzip；CSS +1,399 B raw | 组件库深色令牌可覆盖其 fill 变量，但无落点即不引入 |
| **Badge**（未用→不建议） | `count/maxCount(默认99)/dot/text/offset/dotStyle/dotClassName`（interface.d.ts:14-45）；`color 12 内置色`（:50）；`status 5 种`（:55） | 无落点（巧思 #9 呼吸徽标用 CSS-only 点实现） | 边际 +3,351 B raw / +834 B gzip；CSS +3,331 B raw | `status` 五色为固定语义色，不随色盲友好档联动；CSS 点 + 语义令牌更合规 |

**采纳结论**：五项已用组件继续用（Descriptions 承接输出卡明细结构化这一处真升级）；三项未用组件全部不引入，理由归并 §4（合计若强上：+26,583 B raw JS / +8,644 B gzip JS + 5,614 B raw CSS——门禁余量 47KB 内虽放得下，但能力与既有实现重叠或可用更轻手段替代，门禁纪律下不做「以防万一」的引入）。

---

## §3 支撑参数表（国际体系官方数值，作为巧思落地刻度对照）

### 3.1 字阶（体系 C《Typography》原文 + 体系 D《Typography》检索核对）

| 用途 | 体系 C（Plex 刻度） | 体系 D（15 token） | 本项目对照 |
| --- | --- | --- | --- |
| 刻度构成 | 单一公式 y0=12px 步进：12/14/16/18/20/24/28/32/36/42/48/54/60/68/76/84/92 | display 57/45/36；headline 32/28/24；title 22/16/14；body 16/14/12；label 14/12/11 | `--wf-text-xs 12 / sm 13 / md 14 / lg 16 / num 32→40`（global.css:38-42,103） |
| 字重 | Light/Regular/Semibold 三档；「Semibold 适合节标题，长文本不用」 | 仅 400/500/700 | 正文 400 / 数字与标题 700（bold） |
| 风格分集 | productive（紧凑、聚焦任务）/ expressive（编辑与营销，产品内勿用） | — | 全站取 productive 档精神：紧凑、少字阶数量 |
| 文字用色 | 「running text 保持中性色，品牌色只给主行动」 | — | 正文一律 `--wf-text*` 令牌；主色只给主数与主按钮 |

### 3.2 表面海拔（体系 C《Color(tokens)》层模型原文 + 体系 D《Elevation》检索核对）

| 档 | 体系 C 层模型（浅色实测值） | 体系 D | 本项目对照 |
| --- | --- | --- | --- |
| 画布 | `$background` White #ffffff（页面底） | Level 0（0dp） | `--wf-bg-page` |
| 一层 | `$layer-01` Gray 10 #f4f4f4（容器在画布上） | Level 1（1dp） | 输出卡/输入卡实底 |
| 二层 | `$layer-02` White（容器在一层上，往复交替） | Level 2（3dp） | 凹面区/嵌套块（p5-spec 指出的错用项改归位） |
| 浮层 | 配阴影；深色「海拔越高表面越亮」（明度差替代阴影） | Level 3-5（6/8/12dp）；深色用色调表面 | `--wf-surface-overlay-*` / `--wf-shadow-3`（三层材质区原样保留，global.css:147-285） |
| hover | **表面色变化**：`$layer-hover-01 #e8e8e8` / `$background-hover rgba(141,141,141,0.12)` | — | 巧思 #4/#12 依据：hover 用 tint 半档，不用海拔动画 |

### 3.3 间距刻度（体系 C《Spacing》原文 token 表，2 的倍数族）

token 全表：2 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 160 px（rem 对应 0.125–10）。用法分档：**小 2–8**（图标与文字间隙、紧凑内边距）；**中 12–24**（按钮内边距、卡片纵向节奏）；**大 32–160**（区块间距、页面留白）；并给了同刻度例外跳步口径（断点处可跳一档）。本项目 8pt 刻度（4/8/12/16/24/32/48）完全落在同族内；缺口 40/64/80/96/160 均低频，暂不补。

### 3.4 动效时长与缓动（体系 C《Motion》原文 + 体系 D《Motion》检索核对）

| 维度 | 体系 C | 体系 D | 本项目对照 |
| --- | --- | --- | --- |
| 交互档 | fast-01 **70ms**（按钮/开关）/ fast-02 **110ms**（淡入淡出）；自检清单「微交互 90–120ms」 | short 组 50–200ms | `--wf-dur-fast: 120ms` ✓（defaults.ts:211） |
| 过渡档 | moderate-01 **150ms**（小展开）/ moderate-02 **240ms**（展开/系统通信/toast） | medium 组 250–400ms | `--wf-dur-base: 240ms` ✓ |
| 大面积 | slow-01 **400ms**（大展开）/ slow-02 **700ms**（背景压暗） | long 450–600 / extra-long 700–1000 | `--wf-dur-slow: 360ms` ✓（低于 400） |
| 标准曲线 | productive `(0.2, 0, 0.38, 0.9)`；expressive `(0.4, 0.14, 0.3, 1)` | standard `(0.4,0,0.2,1)`；emphasized `(0.2, 0, 0, 1)` | `--wf-ease-standard (0.2,0,0,1)` ✓ |
| 进入曲线 | productive `(0, 0, 0.38, 0.9)`；expressive `(0, 0, 0.3, 1)` | — | `--wf-ease-asymptotic (0.16,1,0.3,1)` 同族 |
| 退场曲线 | productive `(0.2, 0, 1, 0.9)`；expressive `(0.4, 0.14, 1, 1)`；「退场比进入快」 | — | 现状无独立退场曲线，维持三族曲线不膨胀纪律 |
| 硬约束 | 「Do not use easing curves that suggest bounce, stretch, or sudden stops」；「The best interface motion may go unnoticed… 若常被普通用户注意到就移除或减弱」；「reduced motion：always provide alternatives… communicate similar messages statically」 | emphasized 减速曲线 `cubic-bezier(0.05, 0.7, 0.1, 1)` 类（检索口径） | `--wf-ease-emphasis (0.34,1.26,0.44,1)` 带轻过冲，仅限 #2 单次脉冲豁免使用；与「禁 bounce/stretch」的张力以「单次 + 300ms 级 + 降级停用」三重约束收口 |

体系 C 双风格条款直接约束巧思目录：**「Productive motion… subtle and out of the way（按钮态/下拉/表格渲染皆属此类）；Expressive motion… Reserve for occasional, important moments, to better capture the user's attention and offer a rhythmic break」**——巧思 #2 是全站唯一 expressive 时刻，其余全部 productive。

### 3.5 圆角分级（体系 D《Shape》官方页引文检索核对；体系 C 半径 token 为检索口径）

| token | 体系 D corner radius scale | 本项目对照 |
| --- | --- | --- |
| none / extra-small | 0 / **4px** | 表内细件（刻度点、表格内图） |
| small / medium | **8px** / **12px** | 控件（输入/按钮，经组件库 `--border-radius-*` 三变量对齐，global.css:125-127） |
| large / large increased | **16px** / 20px | 卡片 |
| extra-large / extra-extra-large | **28px** / 40px | 模态/大容器（本项目暂无消费） |
| full | 完全圆角（pill/圆） | `--wf-radius-full: 9999px`（global.css:35） |

本项目 6/10/14px 三档（global.css:32-34）落在 small–large 同一斜率上，不迁移；体系 C 侧半径 token（2px 基档 + sm/md/lg/xl + max 全圆，检索口径）与此同构，互相印证。焦点环口径（design-spec 2.8 双环实现）维持不动。

---

## §4 反采纳清单（八条，含组件库与手法）

| # | 项 | 理由（证据） |
| --- | --- | --- |
| 1 | **组件库 Statistic（含 countUp/Countdown）** | 能力与自研 `useAnimatedNumber` 重叠（hooks.ts:177-242 已含渐近滚动/首值落值/减弱动效短路/rAF 停摆兜底）；countUp 无 reduced-motion 参数（.d.ts 无该字段）；本会话实测边际 +21.5KB raw / +7.3KB gzip（八组件中最大）；Countdown「倒计时」语气与财富自由主题冲突（催促感，北极星候选三落选同理） |
| 2 | **组件库 Skeleton** | 计算毫秒级 + 300ms 防抖即时输出，骨架屏无等待窗口可承载；边际 +1.8KB raw JS + 1.4KB raw CSS 换零收益 |
| 3 | **组件库 Badge** | `status` 五色固定不随色盲友好档联动（.d.ts:55）——硬伤；巧思 #9 状态点用 CSS 伪元素 + 语义令牌即可；实测边际 +3.4KB raw JS + 3.3KB raw CSS |
| 4 | **Typography copyable/editable** | 分享已有专用按钮 + Message 链路（BasicCalculator.tsx:449、799、806）；无行内编辑场景；ellipsis 属性已 deprecated（interface.d.ts:37-40），旧用法迁移 `Typography.Ellipsis` 即可，不构成引入理由 |
| 5 | **撒花/粒子类庆祝** | 行业文章 P：「若 onboarding 过于玩闹或视觉上咄咄逼人，用户会开始质疑产品本身的严肃性」；行业调研 T：庆祝的不对称即操纵信号；体系 C「禁 bounce/stretch 类曲线」；粒子库还有体积与动效令牌成本 |
| 6 | **常驻循环呼吸/shimmer** | 体系 C《Motion》「最好的动效常不被注意；若常被普通用户注意到，就该移除或减弱」；呼吸只允许出现在状态窗口期（#9 防抖窗口）且落定即停 |
| 7 | **数字滚动超 1s / 逐帧播报** | 行业文章 Q：「durations short（<1s）、animate once on entry、密集表格跳过动画、screen reader 只播终值」——本项目 360ms 慢档 + 首值不滚已合规，放宽即倒退 |
| 8 | **hover 海拔/阴影过渡动画** | 体系 C token 实证 hover = 表面色变化（`$layer-hover-01` 系）；小面积 UI 阴影难以感知（p5-spec 1.3 既有结论）；巧思 #4/#12 均按表面色实现 |

---

## 附：与既有规范的衔接 + 交付校验记录

1. 巧思 #1/#2/#14/#15 引入「跨档/达成」状态位，落地前须在 design-spec 第 4 节动效清单补登记（触发条件、时长档位、降级口径三要素）。
2. CSS-only 项（#3/#4/#7/#8/#10/#11）落 global.css 对应小节，类名沿用 `wf-` 前缀纪律；#11 新令牌须走三源对账五点同步（types.ts ThemeTokens + defaults.ts 两主题 + App.tsx 注入数组 + global.css 两块）。
3. i18n 涉及键的组件（#5/#6/#10/#14/#15）须三语键集人工对账后施工（package.json scripts 无 i18n 专项脚本，仅 check:size / check:currency / check:a11y 三个检查命令，本会话实测 package.json:11-13）。
4. §3 全表为参考刻度不强制迁移；存量 6px/10px 间距豁免与三族曲线不膨胀纪律（design-spec §9）维持。
5. 尺寸预算：巧思全目录预估新增原始字节 < 8KB（CSS ~3KB + i18n 键 ~2KB + TSX 编译产物 ~3KB），门禁实测余量约 47KB（1,963/2,010）内可完成候选一全部签名元素。
6. 交付校验（本会话实跑）：`node scripts/check-size.mjs` → DIST_TOTAL_KB=1963 / WASM_MAX_KB=364，门禁通过。
7. 交付校验（本会话实跑）：`wc -l docs/research-design-language.md` → 184 行（≤450 ✓）；禁词正则（任务指定的 13 词不区分大小写全文扫描）→ 零命中（grep exit 1，实跑时间 2026-11-21，扫描命令含全部禁词本词，结果未在文档内回显以免自污染）。
