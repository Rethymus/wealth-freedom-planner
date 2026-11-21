# P6 实施规范：交互维度扩展（静水账房 · 因果呈现 · 键盘与读数）

| 项 | 值 |
| --- | --- |
| 文档性质 | 第六轮实施规范：在 P5 设计语言定案之上做**交互维度扩展**——L2 因果反馈补全 + L3 结构反馈低成本开箱；零新依赖、零新功能（巧思=视觉与交互层，不改任何计算公式与数据流） |
| 证据来源 | `docs/research-ui-trends.md`（§1 代码库 15 段 + §2 视觉候选 C1–C10 + §3 反采纳）与 `docs/research-interaction-patterns.md`（§0 成熟度模型 + §5 巧思目录 15 项 + §6 片段）；仓库现状全部为本会话命令实测（行号随文标注，可逐条复现） |
| 与宪法关系 | 北极星与 12 签名元素零推翻（§0）；新交互签名元素 S16–S26 逐项按 `docs/design-language.md` §5.1 准入五要素登记（§2）；视觉级调整单列 §3 走同一准入流程，不混入交互项 |
| 铁律 | ① 不引入新依赖；② 不做新功能（不改 `src/services/**` 计算公式与数据流）；③ 全局 CSS 变更集中 `src/styles/global.css` 新增 P6 分区；④ TS strict（`npm run build` 内含 `tsc --noEmit`）；⑤ 文档零禁词（13 词面，附录 A 自检） |
| 读者 | P6 实施会话（材质方=global.css，动效方=TSX/hooks）；验收会话 |

---

## §0 概念延续声明

1. **北极星零推翻**：「静水账房——每个数字都被认真对待，庆祝只发生一次，且小到几乎只剩一次呼吸」（design-language.md §0）本轮原样延续。本轮 11 项交互巧思（§2 S16–S26）全部服务于其语气关键词：**安静（hover 均为表面色/静态强调）、精密（读数窗隐喻延伸到图表 hover）、诚实（因果闪亮只指向真实落定值）、从容（键盘路径不改变导航结构）**。
2. **12 签名元素零推翻**：宪法 §2 登记的 S1–S7、S9–S11、S14–S15 十二项签名元素本轮一概不改语义、不改触发时机；逐项不回退锚点见 §5。编号 S8/S12 在宪法为「让位预算（P5.1 备选）」、S13 为「诚实进度尺」已登记资产（design-language.md §2 注记）——本轮**不复活、不占用、不重复施工**；新元素从 S16 起编号，避免歧义。
3. **本轮定位 = 交互维度扩展**：交互成熟度模型（research-interaction-patterns §0）自评 L1 基本齐备、L2 有骨架——本轮主攻「L2 的补全（因果可见）与 L3 的低成本开箱（组件库未启用动画属性）」；L4 仪式感**不新增**（S2 是全站唯一 expressive 时刻的收敛纪律不破，见 §2 不采纳清单 #4；修订轮补充归类：S22 全屏圆形揭示为**状态迁移过渡**，非 expressive——宪法 §2 与 §2 S22 已显式登记）。
4. **视觉级调整单列**：趋势研究提出的配色/字族类建议（research-ui-trends §2 候选 C1/C4/C5）不混入 §2 交互项，逐项单列于 §3 并按宪法 §5.1 走准入五要素（视觉描述/触发时机/降级方案/双主题值/尺寸增量估算）；C2/C3/C6/C7/C8/C9/C10 的取舍与理由同节列明。
5. **禁止事项沿用**：本仓门禁为 dist 原始字节硬限（p5-spec §10 口径），P5 回收后余量约 54KB；本轮巧思合计估算 ≈4.95KB（§8，P1–P10 吸收增量后口径），无需触碰门禁数值。`vite.config.ts` / `sw.ts` / manifest 本轮禁触（p5-spec §9 R6 延续）。
6. **三步准入第二步已完成（修订轮）**：S16–S26 已按五要素回填宪法 `design-language.md` §2（签名元素主表新增 11 行 + 「P6 立项五要素登记」表 11 行——视觉描述/触发时机/降级方案/双主题值/尺寸增量逐项在位，S22 显式归类为非 expressive 的状态迁移过渡），§5.5 版本记录已追加 P6 立项条目——宪法 §5.1「research 立项 → 回填本文 §2 → 落 p*spec」三者齐备，可施工。

---

## §1 现状诊断（交互缺口；行号均为本会话实测）

> 成熟度对标：L1 状态反馈基本齐备（`.wf-pressable` global.css:376-390；焦点环 :388）；L2 因果反馈仅基础模式 hero 一处成体系；L3 结构反馈与键盘路径有低成本未开箱空间。以下 11 条缺口按「控件无反馈 / 数据变化无因果呈现」两类归组。

**A 类：数据变化无因果呈现（L2 缺口，本轮主攻）**

- **A1 图表 hover 读数全缺**：全仓 5 个 recharts 图容器——龙卷风 `BasicCalculator.tsx:210-253`（`.wf-sens-chart`）、蒙特卡洛主线 `MonteCarloPanel.tsx:863`、序列图 `MonteCarloPanel.tsx:690`、收租瀑布 `RentalPanel.tsx:643`（`.wf-waterfall-chart`）、积累折线 `AccumulationPanel.tsx:532`（`.wf-acc-chart`）——`grep -n "<Tooltip\|cursor=" src/components/` 实测 **2 命中**（fields.tsx:169 FieldTip 组件内部实现、ReversePanel.tsx:176 单值说明 Tooltip），均为字段级/数值说明，**不存在图表读数类 Tooltip**。图形上的数据形完全不可探，读数只能靠图下明细行。
- **A2 高级面板 6 处防抖主数瞬跳**：`useAnimatedNumber` 全仓仅 `BasicCalculator.tsx:578` 一处消费（grep 实证）；`ReversePanel.tsx:170`（可持续月开销）、`LoanPanel.tsx:147`（月供）、`RentalPanel.tsx:613`（年净现金流）、`PensionPanel.tsx:175`（月养老金）、`MonteCarloPanel.tsx:820`（终值中位）、`AccumulationPanel.tsx:414-420`（反推月存，`wf-big-number` 20px 档）六处主数在防抖落定帧**瞬时换值**——与基础模式 hero 的渐近滚动不一致，改输入→数字跳变无因果过渡。
- **A3 输出卡换值无「哪里变了」高亮**：防抖落定后构成明细表（`BasicCalculator.tsx:829-843`）与汇总/乘数行（:753-798）静默换值；现有反馈只有 hero 数字滚动（:724）与段位 Tag 涨色（:786-796）两点。
- **A4 敏感性图与数值行、输入字段无指向关系**：SensitivitySection 内龙卷风条（:246-250）与 ±数值行（:271-296）各自独立，S4 行级 hover（global.css:1227-1235）仅背景着色；月开销输入字段与敏感性区块（同源数据，:920-929 ↔ :852-864）零联动——「改月开销→哪些条变了」不可见。
- **A5 情景保存后无进场反馈**：情景 Tag 列与对比表行静默出现（`ScenarioPanel.tsx:230-311`），保存成功仅靠既有 Message；「刚保存的那条」在列表中无一次性强调。

**B 类：控件无反馈 / 结构无方向感（L1/L3 缺口，低成本开箱）**

- **B1 输出卡 hover 无状态**：`.wf-output-card` 仅有静置 shadow-2 ⇄ 吸附 shadow-3 两态（global.css:206-219），hover 无状态层；且既有 box-shadow 过渡为 base 240ms（:214），按四级反馈①档应为 fast 120ms（research-interaction-patterns §2.1/5.7 修正点）。
- **B2 Tabs 切换无方向感**：`AdvancedPanel.tsx:139-145` 未传 `animation` 属性——`es/Tabs/interface.d.ts:24` 存在 `animation` 声明而未启用（research-interaction-patterns 任务 B 全库 grep `animation=` 0 命中实证）；指示条瞬移、面板硬切。
- **B3 分组切换无键盘路径**：groupId 仅由 Radio onChange 驱动（`AdvancedPanel.tsx:84,119-126`）；键盘用户须 Tab 至分段控件逐项试——已有方向键漫游（:93-115）但仅作用于组内标签，**组间**无快捷键。
- **B4 主题切换无空间线索**：`App.tsx:296` onClick 直调 toggleTheme，令牌直换全屏同变；这是全站频率最低、感知最强的状态迁移，无任何方向性呈现（research-ui-trends §0.3 S1 判据采纳项）。
- **B5 字段错误态单通道**：越界错误仅行内文字 + `aria-invalid`（`fields.tsx:141-151`）+ 组件库红框；无位置/形状冗余通道（S10 ▲▼ 同构思路未覆盖错误态；WCAG 1.4.1 形状冗余口径）。
- **B6 编辑帧反馈缺位（记录不施工）**：InputNumber 编辑中无限域位置指示（`fields.tsx:126-140`）。处置裁定：**不补**——常驻位置条与「数字是主角」争夺注意力，且错误态冗余通道由 §2 S24 承担；留档供后续轮复议。

---

## §2 交互巧思清单（11 项采纳，S16–S26）

> 来源：research-interaction-patterns §5 目录（5.1/5.2/5.3/5.7/5.8/5.9/5.11/5.13/5.14/5.15）与 research-ui-trends §1 代码库（S1/S6/S13）+ §2 视觉候选（C6/C9）合并取舍，适配处逐项注明（含 2 处**落点修正**：S17 映射口径、S18 推广落点）。每项格式：名称｜落点｜实现方式｜动效参数｜reduced-motion 降级｜体积估算（gzip 口径，research-ui-trends 附录 B 实测法：esbuild minify + node:zlib gzip-9 单段独立实测）｜性能影响；末行按宪法 §5.1 登记五要素。全部动效时长/曲线只引用既有令牌（`--wf-dur-fast/base/slow`、`--wf-ease-standard/asymptotic/emphasis`，global.css:101-106），**零新增时长键**。

### S16 输出卡因果闪亮（源：interaction 5.1 + 片段 6.1）

- **落点（修订轮收窄）**：`src/components/BasicCalculator.tsx` 输出卡内两处，**分开承载、重挂范围最小化**——① 重挂路径：仅汇总与乘数两条 `.wf-output-line`（:753-798，无状态、无可聚焦元素）外包 `key={flashEpoch}` 容器；② 类路径：构成明细 `.wf-output-breakdown`（:802-844）**禁止重挂**——其上方 <768 展开开关按钮（:805-812）重挂即丢键盘焦点，且与 S23② 进场类同落点（重挂会令 `@starting-style` 重播），改由 `flashOn` 布尔挂类承载。**硬约束：严禁包裹 `.wf-output-hero`**（:718-743，FreedomGauge 内部 `useState` popTick/reached/pulseOn :337-343 重挂即清位，破坏 S1/S2 闩锁回归）与明细展开开关。
- **实现方式**：`src/components/hooks.ts` 追加 `useFlashOnChange(value): number`（research 片段 6.1，~18 行；首值不闪、值变递增 epoch）；BasicCalculator 以 `useFlashOnChange(data?.criticalValue ?? 0)` 取 epoch——epoch 仅驱动①两行重挂；②明细区由同一 epoch 经 effect 置 `flashOn`、`setTimeout(MOTION_DURATIONS.slow)` 摘类（卸载清理；摘类先例=S1 popTick，`BasicCalculator.tsx:376-380`）；CSS 新增 `.wf-flash`（重挂承载）与 `.wf-flash-single`（类承载），共用 `@keyframes wf-flash-bg`（0% → `var(--wf-bg-tint)`，100% → transparent）。
- **动效参数**：`animation: wf-flash-bg var(--wf-dur-slow) var(--wf-ease-standard) 1`（360ms 标准曲线，单次；与段位闪色同构）。
- **降级**：reduced-motion 由兜底块全停（global.css:644-652）；信息路径=数值滚动本身不变；静息态与变化前逐像素一致。
- **体积估算**：TSX ≈0.52KB + CSS ≈0.18KB ≈ **0.70KB**（修订轮双路径接线 +0.07）。
- **性能影响**：复用既有落定帧一次 setState（epoch 重挂仅触发子树重渲染，无新计算路径）；防抖调用次数不变（§6 红线 4）。
- **五要素登记**：视觉描述=受本次输入影响的汇总/乘数行与明细区一次性主色 8% 底淡出｜触发时机=防抖结果落定且 `criticalValue` 变化（首值与 resetEpoch 清位后重挂不闪）｜降级方案=无动画（CSS 兜底），信息由数值滚动承载｜双主题值=`--wf-bg-tint`（既有主题组令牌，两主题各自 8% 主色底，无新键）｜尺寸增量=+0.70KB。
- **与 S23② 的同落点裁定（修订轮 P5）**：明细区不走重挂——`.wf-row-enter` 仅在展开插入帧播放一次，flash 经类承载不引发重播、不触碰展开开关焦点（验收 #12 承载断言）。

### S17 敏感性行↔龙卷风条双向高亮（源：interaction 5.2；**落点修正**）

- **修正说明**：interaction 5.2 假设「输入字段↔条目存在 key 映射」，实测龙卷风六档**全部**由月开销单一字段派生（`BasicCalculator.tsx:636-651` 只改 monthlyExpense）——按字段一一映射不成立。修正为两层真实映射：① ±数值行（`wf-sens-row`，key=`row.pct`）↔ 同 `pct` 龙卷风 `Cell`（:246-250 的 `row.pct` 天然对应）；② 月开销输入字段 ↔ 整个 `.wf-sens-chart` 容器。
- **落点**：`src/components/BasicCalculator.tsx` SensitivitySection（:108-306）+ 月开销字段包装（:920-929）。
- **实现方式**：SensitivitySection 内 `hoveredPct: number | null` 本地 state；`Cell` 按命中加 `stroke={tokens.primary} strokeWidth={1.5}`；数值行 onMouseEnter/Leave 置位。月开销字段侧：外层包装 div 用 `onFocusCapture`/`onMouseEnter` 置位、**`onBlurCapture`/`onMouseLeave` 清除**（置位/清除成对必写——键盘 Tab 走后描边必须复位，修订轮 P10），`.wf-sens-chart` 按布尔挂 `.wf-linked`（CSS：`outline: 1px solid var(--wf-primary)`，静态描边——research §1.3「不需动画」纪律）。
- **动效参数**：无动画，纯状态切换（静态强调，fast 过渡仅作用于描边色 120ms）。
- **降级**：触屏无 hover 不触发（信息仍由数值行/明细行承载）；reduced-motion 无动画参与、无需处理。
- **体积估算**：≈**0.50KB**。
- **性能影响**：一个数字/布尔 state，SVG class 与容器描边更新，**不触发任何计算**。
- **五要素登记**：视觉描述=对应条目主色描边 + 图容器着色描边｜触发时机=指针悬停/键盘聚焦（onFocusCapture 使 Tab 聚焦字段同样联动）｜降级方案=无 hover 环境不渲染强调，静态｜双主题值=描边取 `tokens.primary`（resolveThemeTokens 双主题输出）｜尺寸增量=+0.50KB。

### S18 高级面板主数渐近滚动（源：interaction 5.3；**落点修正：推广而非下探**）

- **修正说明**：interaction 5.3 原案把 count-up 下探到基础卡构成明细行——实测该表 5 行中 4 行是**输入回显**（expense/childTotal/health/major，`BasicCalculator.tsx:815-841` 直取 baseline 输入），滚动回显=延迟呈现用户刚键入的值，违背输入反馈即时性；唯一计算行 total 与 hero 同值已滚动。故推广到**高级面板 6 处防抖主数**（§1 A2 实测清单），这才是 5.3 的本意「L2 补全」。
- **落点**：`ReversePanel.tsx:170`、`LoanPanel.tsx:147`、`RentalPanel.tsx:613`、`PensionPanel.tsx:175`、`MonteCarloPanel.tsx:820`、`AccumulationPanel.tsx:414-420`——各面板 `money(useAnimatedNumber(data.X))`；调用点零逐站点新代码（复用 `hooks.ts:198`，含首值纪律/墙钟兜底/结束帧精确落值）。**hook 本体增补可见性闸（修订轮 P6）**：宿主面板 `display:none`（方案 B 常驻+hidden，`AdvancedPanel.tsx:127-135` 实读——hidden 不停 rAF，旧「单面板可见保证 ≤2 条」推断不成立，已废除）或视口外时 rAF 循环当帧暂停不再调度，恢复可见时从当前显示值续播（墙钟已过时长则直接落定值）；实现=IntersectionObserver（宿主元素级，卸载 disconnect；display:none 与视口外均表现为 not-intersecting）驱动暂停/恢复（§6 红线 2 硬性要求）。
- **动效参数**：慢档 360ms 渐近曲线 easeOutCubic（hook 内建，与 `--wf-ease-asymptotic` 同族）；连续变更以最新显示值为起点重启。
- **降级**：hook 三重短路（reduced-motion / 非有限数 / 首值直接落值，`hooks.ts:214-220`）。
- **体积估算**：≈**0.45KB**（hook 可见性闸 +0.10；6 处调用点包装不变——修订轮 P6）。
- **性能影响**：每处一条独立 rAF 路径且**必须带可见性闸**（修订轮 P6 改正——原「同屏至多 1 个面板可见 → ≤2 条并行」的可见性推断不成立，已废除）：宿主 hidden 或视口外暂停循环，批量落定窗口内仅可见面板推进 rAF；**rAF 中间帧只进显示值、永不进 store**（§6 红线 2；hero 既有同构先例 `BasicCalculator.tsx:578,724` 注释口径）。硬约束：aria live 区只绑落定值不绑动画值（§5 R13 锚点）；仅 `data` 就绪后挂 hook（未就绪显示「—」与 hero 同口径）。
- **五要素登记**：视觉描述=面板级主数从旧值渐近收敛到新值（数字是主角的读数窗行为推广，hook 带可见性闸）｜触发时机=该面板防抖结果落定（宿主隐藏或视口外时可见性闸暂停，恢复续播或落定）｜降级方案=hook 内建三重短路直接落值｜双主题值=数值无色变（不适用色值）｜尺寸增量=+0.45KB。

### S19 输出卡克制悬浮（源：interaction 5.7）

- **落点**：`src/styles/global.css` `.wf-output-card`（:206-219）。
- **实现方式（修订轮补命中安全）**：先补 `.wf-output-card { position: relative; }` 作定位上下文（现状卡体无定位上下文，global.css:206-215 实读）；新增 `.wf-output-card:hover:not(.wf-is-stuck)` 规则组——`transform: translateY(-1px)` + `::after` 覆盖层 `background: var(--wf-bg-tint)`（①档 8% 口径）**且 `::after` 必须写 `pointer-events: none`**——伪元素属宿主元素参与命中测试，缺失该行会让非吸附态卡内预设/分享/明细开关/敏感性开关全部点击失效（修订轮 P2）。**层序裁定（修订轮 P2 补）**：`::after` 不设 z-index，按绘制顺序盖于卡面内容之上形成整卡着色底（纯视觉半档着色，不遮信息）；`pointer-events: none` 使其完全不参与命中测试，指针事件穿透至其下按钮；吸附态命中链不受影响（既有穿透链 global.css:227-241：包裹层 none / 卡面 auto / stuck none 原样）。再把既有 box-shadow 过渡时长 base 修正为 fast（:214，research §2.1 ①档 100–120ms 交叉验证结论）。
- **动效参数**：`transition: transform/box-shadow/background var(--wf-dur-fast) var(--wf-ease-standard)`（120ms）；按压态仍由 `.wf-pressable` ②档承载（global.css:382），不叠加。
- **降级**：reduced-motion 兜底全停（信息无损：hover 反馈本就是纯增益）；触屏无 hover 不触发。
- **体积估算**：≈**0.25KB**。
- **性能影响**：transform/box-shadow 合成层，一次过渡；吸附态 `.wf-is-stuck` 恒 `pointer-events: none`（global.css:235-241）天然不触发 hover，穿透链不受影响（§5 R8 锚点）。
- **五要素登记**：视觉描述=悬浮卡上浮 1px + 着色底半档（表面色变化，不用海拔动画——宪法 §3.2 口径）｜触发时机=指针悬停于非吸附态输出卡｜降级方案=reduced-motion 停用；触屏无此态｜双主题值=着色底挂 `--wf-bg-tint` 既有双主题令牌｜尺寸增量=+0.25KB。

### S20 Tabs 指示条滑动（源：interaction 5.9；组件库开箱属性启用）

- **落点**：`src/components/AdvancedPanel.tsx:139-145` `<Tabs>` 追加 `animation={{ inkBar: true, tabPane: true }}`（一行属性）。
- **实现方式**：组件库内建动画（源码实证 `es/Tabs/interface.d.ts:24` + `es/style/animation/fade.less:12,21` fade=duration-3+standard，research §2.3）；R1 常驻+hidden 语义不受影响（动画只做透明度/位移过渡，不改挂载）。
- **动效参数**：组件库 duration-3（300ms）+ standard——落在本仓 base 240ms 与 slow 360ms 之间，**不新增时长键、不为对齐改组件库变量**（research §2.3 裁定「差异可接受」）。
- **降级**：组件库动画同样被全局兜底块压停（0.01ms，global.css:644-652 命中组件库 transition），终态一致。
- **体积估算**：≈**0.05KB**。
- **性能影响**：组件库 CSS transition，无新渲染路径。
- **五要素登记**：视觉描述=组内切换时指示条滑动 + 面板淡入｜触发时机=Tabs 标签切换｜降级方案=reduced-motion 压停即时切换｜双主题值=指示条色随组件库主色变量（已双主题对齐，无新键）｜尺寸增量=+0.05KB。

### S21 数字键切高级分组（源：interaction 5.11；**合规修正：焦点域内生效**）

- **合规说明（修订轮 P1 改正）**：字符键 1/2/3 属 WCAG 2.1.4 字符键快捷键，合规取「仅组件聚焦时生效」路径。**原稿「焦点不在本区（含输入框内）即不派发」论断错误，删除**：容器内含全部面板的 InputNumber，而组件库 InputNumber 仅对 ↑/↓ 做了 stopPropagation（`node_modules/@arco-design/web-react/es/InputNumber/index.js:188-199` 本会话实读——`onKeyDown` 仅 ArrowDown（:190-192）/ArrowUp（:194-196）两分支调用，字符键经 :199 原样冒泡），数字键会从输入框冒泡到容器处理器（`AdvancedPanel.tsx:137` 容器 onKeyDown 实读）：若无豁免，在任意输入框键入「1」即 setGroupId 切组、当前组 wrapper 置 hidden（`AdvancedPanel.tsx:135`）→ 输入中途焦点丢失、输入上下文被摧毁——恰为 WCAG 2.1.4 禁止行为且与验收 #10 矛盾。因此**显式输入豁免必写**（research-interaction-patterns §6.3 口径，:218-223 typing 判定实读）：`e.target` 为 `INPUT/TEXTAREA/SELECT` 或 `isContentEditable` 时直接 return；处理器仍挂容器 onKeyDown（零新增 window 监听器不变）。
- **落点**：`src/components/AdvancedPanel.tsx:93-115` `makeTabsKeyDown` 扩展 + `:136` aria-label 值更新。
- **实现方式**：`makeTabsKeyDown` 增加 `"1"/"2"/"3"` 分支，**分支前置输入豁免守卫**（research 片段 6.3 的 typing 判定：target 为 input/textarea/select/contenteditable 直接 return——对容器内全部 InputNumber 生效）；键位序 → `setGroupId(GROUPS[i].id)`（i = 键位序，越界忽略）；`t("advanced.tabsKbdHint")` 值改为「左右方向键切换标签；数字键 1/2/3 切换分组（输入框内不生效）」——**改值不增键**（P5 §11 先例口径），三语同步。
- **动效参数**：无（分组切换由分段控件选中态承载）。
- **降级**：不适用（无动画；键盘路径为纯增益）。
- **体积估算**：≈**0.25KB**（修订轮 +0.05：豁免守卫）。
- **性能影响**：复用既有 keydown 冒泡分支，零新增监听器（§6 红线 3 自动满足）。
- **五要素登记**：视觉描述=无新增视觉（切组反馈由 Radio 分段控件选中态与 S20 承载）｜触发时机=高级面板区聚焦且焦点不在输入控件内时按 1/2/3（显式输入豁免）｜降级方案=不适用｜双主题值=不适用（无色值）｜尺寸增量=+0.25KB。

### S22 主题切换圆形扩散（源：interaction 5.8 + trends §1 S1；research 片段 6.6 双降级版）

- **落点**：`src/App.tsx:296` 主题按钮 onClick 接 `revealTheme`；实现入 `App.tsx` 顶部工具函数（~16 行，research 片段 6.6 原样）；CSS 入 global.css P6 分区。
- **实现方式（修订轮 P1 改正）**：`document.startViewTransition(apply)` 包住既有 `toggleTheme`，**apply 必须以 `flushSync`（react-dom）包裹后再传入**——React 18 的 setState 在 startViewTransition 回调内非同步提交 DOM，不包 flushSync 则浏览器快照「新状态」时 DOM 仍是旧主题，圆形揭示揭示的是旧皮随后硬切（对齐 research-ui-trends §1 S2 片段 :113-124 对同 API 用 `flushSync` 的先例，:123 `startViewTransition(() => flushSync(update))` 附缘由注释「同步提交防 React 批处理漏帧」；react ^18.3.1 为 package.json:18 实证）；`vt.ready` 后对 `documentElement` 做一次 `clipPath: circle(0→r)` 动画（r = 触发点到最远角的距离）；**键盘激活坐标回退**：`e.detail === 0`（Enter/Space 触发、无指针坐标）时取按钮几何中心（`currentTarget.getBoundingClientRect()` 中心）为揭示原点；CSS 接管默认动画 `::view-transition-old/new(root) { animation: none; mix-blend-mode: normal; }`。**reduced-motion 显式停用规则必须落**：通配兜底块（`*` 选择器）不命中伪元素动画，须另写 `@media (prefers-reduced-motion: reduce) { ::view-transition-group(root), ::view-transition-old(root), ::view-transition-new(root) { animation: none !important; } }`（research 片段 6.6 CSS 原样）。
- **动效参数**：360ms（= `--wf-dur-slow` 量级）+ `cubic-bezier(0.2,0,0,1)`（与 `--wf-ease-standard` 同曲，View Transitions 内联动画不走 CSS 令牌，实施时以字面值对齐令牌并注释来源）。
- **降级**：双降级链——无 `startViewTransition` API 或 reduced-motion → 直接 apply()（=现状令牌直换）；`vt.ready` 被拒即静默放弃（换肤已完成，无视觉残留）。
- **体积估算**：≈**0.75KB**（修订轮 +0.05：flushSync+坐标回退）。
- **性能影响**：一次性快照成本，无持续开销；主题切换为低频动作（合规纪律：不得高频触发）。
- **五要素登记**：视觉描述=新主题自按钮点击坐标圆形揭示铺满全屏｜触发时机=主题切换按钮点击｜降级方案=双链直切（API 缺失/减动效）+ ready 失败静默｜双主题值=无色值（clip-path 几何；新旧主题快照由浏览器承载）｜尺寸增量=+0.75KB。
- **附带裁定**：按钮 aria-label/title **保持既有功能描述**（`app.themeToDark/themeToLight`），不做叙事化改写——理由见 §3 不采纳 C2。
- **expressive 归类（修订轮 P7）**：本项为**状态迁移过渡，非 expressive**——唯一触发点为主题切换按钮的低频状态迁移、单次不可循环，与 S2 庆祝语义无交集；宪法 design-language.md §2 已按此归类登记（§0.3 同步口径）。

### S23 结果行与展开容器进场（源：trends §1 S6 `@starting-style`）

- **落点**：① `ScenarioPanel.tsx` 已保存情景 Tag 列表项（:232-259 `Tag` 外层）——**仅新增条目播进场**；② `BasicCalculator.tsx` <768 明细展开容器 `.wf-output-breakdown`（:815）每次展开插入播一次（≥768 常驻分支不挂类）。
- **实现方式**：CSS 主体——`.wf-row-enter { transition: opacity var(--wf-dur-base) var(--wf-ease-standard), transform var(--wf-dur-base) var(--wf-ease-standard); }` + `@starting-style { .wf-row-enter { opacity: 0; transform: translateY(4px); } }`。**① 的新增限定（修订轮 P10）**：`@starting-style` 在元素每次**插入**时播放——面板 lazyload 首挂载会让既有条目整列播一遍，与登记触发时机不符；故 ScenarioPanel 以 `mounted` 布尔闸承载类名（首挂载后经 rAF 置位再加类：既有条目仅重渲染、DOM 不重插 → 不重播；之后新增 entry 首次插入 → 播放），零 store 改动（R14）。**② 触发机制如实登记**：展开即插入 → 每次展开播一次（展开进场语义，非「仅首渲染」——原登记口径已改正）；与 S16② 类路径并存不冲突（S16 不重挂明细区）。
- **动效参数**：240ms base 标准曲线；进场比退场长符合「退场一律比进入快」宪法 §3.5 口径（本项只做进场，消失为瞬时即退场 0ms）。
- **降级**：无 `@starting-style` 支持 → 无初始帧直接显示（=现状）；reduced-motion → transition 关闭（兜底块）。
- **体积估算**：≈**0.25KB**（修订轮 +0.05：mounted 闸）。
- **性能影响**：零监听；mounted 闸一次 rAF 置位。
- **五要素登记**：视觉描述=新增条目/展开内容一次性淡入并上移归位｜触发时机=情景新增条目首次插入（面板首挂载既有条目不播）；<768 每次展开明细插入时一次（展开进场语义）｜降级方案=不支持即现状；减动效即瞬时｜双主题值=无色值（透明度+位移）｜尺寸增量=+0.25KB。

### S24 字段错误态左标线（源：trends §2 C9；**落点修正：组级改字段级**）

- **修正说明**：C9 原案 `.wf-field-group:has(.arco-input-error)` 联动组左标线——实测全仓无 `.wf-field-group` 容器，`.wf-group-line`（S7 分组左标线，global.css:1239-1246）与小节头共存而非与字段组共存（`BasicCalculator.tsx:830` 明细分组线内无字段）。修正为**字段级**左缘标线：错误通道加位置冗余，语义与 S10 ▲▼（形状通道）同构。
- **落点**：`src/styles/global.css`（纯 CSS，`fields.tsx` 零改动——`.wf-field` 容器类已存在 :783）。
- **实现方式**：`.wf-field:has(.arco-input-error)::before { content: ""; position: absolute; left: -8px; top: 10%; height: 80%; width: 2px; background: var(--wf-fall); border-radius: 1px; }`（`.wf-field` 需补 `position: relative`）。**实施前置校验**：`.arco-input-error` 为 research 引组件库源码的错误态类名（interaction 任务 B），实施时以 DevTools 实证一次（验收 §9 #11）。
- **动效参数**：无过渡，纯状态切换（错误出现即标线在，消失即无——诚实反馈不延时）。
- **降级**：无 `:has()` 支持 → 规则整体不生效；错误信息仍由行内文字（`fields.tsx:141-151`）+ `aria-invalid` + 组件库红框三通道承载，信息零丢失。
- **体积估算**：≈**0.15KB**。
- **性能影响**：静态选择器匹配，零 JS。
- **五要素登记**：视觉描述=错误字段左缘 2px 语义跌色条（位置+颜色双通道冗余）｜触发时机=InputNumber 进入错误态（越界保留显示）｜降级方案=无 `:has()` 不渲染，三既有通道兜底｜双主题值=`--wf-fall` 主题组令牌（浅 #F53F3F / 深 #F98D86 与色盲替换均经既有解析链）｜尺寸增量=+0.15KB。

### S25 图表 hover 读数增强（源：interaction §4.1/4.2/4.3 + trends §2 C6；recharts 内建，零手写监听）

- **落点**：5 图——`BasicCalculator.tsx:213`（龙卷风）、`MonteCarloPanel.tsx:690` 与 `:863`（两 LineChart，加同一 `syncId`）、`RentalPanel.tsx:643`、`AccumulationPanel.tsx:532`；`.wf-chart-tip` 样式入 global.css P6 分区。
- **实现方式**：各图新增 recharts `<Tooltip>`（§1 A1 实证当前全缺）：`cursor={{ stroke: "var(--wf-text-tertiary)", strokeDasharray: "3 3" }}` + 自定义共享 `content`（research 片段 6.5 形态：label + 全系列值列表，金额经各面板既有 `money` 同源换算）。系列名**复用既有 i18n 键**（蒙特卡洛 p5/p25/p75/p95/medianTerminal 键已存在于 Descriptions 用法 `MonteCarloPanel.tsx:820-824`；龙卷风复用 `sensitivity.legendHigher/Lower` 口径；实施时逐图核对，缺键即以图例既有键顶替——目标零新增键，§7）。蒙特卡洛两图 `syncId="wf-mc"`：两图数据列均为年份轴且长度一致（同一 years 输出），实施时以 `value` 对齐口径核对联动正确性（验收 §9 #12）。
- **动效参数**：气泡出现即时（recharts 无内建延迟，不加 JS 延迟——Kowalski 防闪烁纪律以「cursor 虚线轻量、气泡无位移动画」替代，**偏差登记**：无显示延迟，靠轻量视觉降噪）；`font-variant-numeric: tabular-nums` 于气泡数值（S3 口径）。
- **降级**：触屏无 hover → 无气泡（指针设备专属增强），数值信息另有各面板 Descriptions 明细行承载（research 片段 6.5 降级口径）；读屏用户由既有图表 `role="img"` + `aria-label` 六处链路承载（§5 R13，不重复播报）。
- **体积估算**：≈**0.80KB**（5 处 Tooltip JSX + 1 段 CSS）。
- **性能影响**：hover 触发 tooltip 子树重渲染（research §4.5 口径「仅气泡子树，可控」）；**严禁手写 mousemove 监听**（research §4.5 红线：新增高频渲染路径不采用）；cursor/气泡色全部走令牌。
- **五要素登记**：视觉描述=十字虚线 + 跟随读数气泡（读数窗隐喻从卡面延伸到图形）｜触发时机=指针悬停图表绘图区｜降级方案=触屏/读屏无气泡，明细行兜底｜双主题值=cursor 挂 `--wf-text-tertiary`、气泡底挂 `--wf-bg-surface` + 发丝线卡线（均既有双主题令牌）｜尺寸增量=+0.80KB。

### S26 分享按钮磁吸微行程（源：trends §1 S13；微行程 ≤4px 收敛版）

- **落点**：`src/components/BasicCalculator.tsx:1054-1059` 桌面分享按钮（`wf-share-row` 内）；**dock 主按钮（:1061-1065）不加**——P5.1 V6 登记的不对称例外只涉及权重，不引入动效。
- **实现方式（修订轮 P3 改 CSS 变量方案）**：`src/components/hooks.ts` 追加 `useMagnetic(max = 4)`（~24 行）：`pointermove` 只写 CSS 变量 `el.style.setProperty("--wf-magnet-x", …)` / `--wf-magnet-y`（无 setState、无 rAF、**无 inline transform**），`pointerleave` 复位归零（变量回 0px）；`hover: hover` 媒体查询 + `usePrefersReducedMotion()` 双闸不命中即不挂监听、变量恒缺省。**为什么不能 inline transform 直写按钮本体**：分享按钮自带 `.wf-pressable`（`BasicCalculator.tsx:1055` 实读），其 `:active:not(:disabled) { transform: scale(0.98); opacity: 0.9 }`（global.css:382-385 实读）会被内联样式覆盖（内联样式优先级高于任何样式表规则）——直写本体即静默杀死既有②档按压反馈（悬停恰是按压的前置态，必然命中）。**CSS 变量共存裁定（修订轮 P3）**：位移由样式表承载——新增 `.wf-magnet { transform: translate(var(--wf-magnet-x, 0px), var(--wf-magnet-y, 0px)); }`（分享按钮追加该类），既有 `.wf-pressable:active` 规则扩展为 `transform: translate(var(--wf-magnet-x, 0px), var(--wf-magnet-y, 0px)) scale(0.98)`——var 缺省 0px 对未挂磁吸的 pressable 元素为恒等变换（逐像素不变），磁吸按钮按压时位移与缩放同一声明合成、按压反馈完整保留；登记见「巧思冲突与共存裁定清单」P3 行。
- **动效参数**：位移上限 4px（微行程收敛口径）；过渡复用既有 `.wf-pressable` 的 transform fast 档（120ms，global.css:377-379 实读，零新增 transition 声明）；复位即离手回弹（变量归零）。
- **降级**：reduced-motion 或无 hover 环境 → hook 直接不挂监听，CSS 变量恒缺省（位移为 0px）。
- **体积估算**：≈**0.50KB**（CSS 变量方案含 `.wf-magnet` 规则与 `:active` var 合成扩展——修订轮 P3）。
- **性能影响**：单元素 pointermove 下 CSS 变量写入（样式重算→合成层，不重渲染、不 setState）；监听器 useEffect cleanup 强制（§6 红线 3）。
- **五要素登记**：视觉描述=按钮向指针方向 ≤4px 微吸引（低频主操作的克制款待；CSS 变量承载位移，与按压反馈共存）｜触发时机=桌面指针悬停分享按钮｜降级方案=触屏/减动效零挂载｜双主题值=无色值（仅位移）｜尺寸增量=+0.50KB。

### §2 附前：巧思冲突与共存裁定清单（修订轮新增登记）

> 巧思彼此之间、巧思与既有机制共用同一落点或同一属性通道时的裁定登记表——每项裁定同时写进对应巧思的实现方式；后续轮新增巧思共用落点时**先在此登记再施工**（P3 指出的「冲突清单漏登记」即本表建立动因）。

| 裁定 | 冲突双方（实证锚点） | 裁定内容 |
| --- | --- | --- |
| P1 | S21 数字键 × Arco InputNumber 仅 ↑/↓ stopPropagation（es/InputNumber/index.js:188-199 字符键冒泡；处理器挂分组容器 `AdvancedPanel.tsx:137`） | 1/2/3 分支前置显式输入豁免（INPUT/TEXTAREA/SELECT/isContentEditable 直接 return，research §6.3 判定），容器内全部输入框受保护；键盘焦点与输入上下文不被切组摧毁 |
| P2 | S19 ::after 覆盖层 × 卡内按钮命中测试（global.css:206-215 卡体无定位上下文；:227-241 既有穿透链） | ::after 必写 `pointer-events: none`；不设 z-index，绘制层序盖于卡面内容之上形成着色底，命中始终落在其下按钮；吸附态穿透链不受影响 |
| P3 | S26 磁吸 × `.wf-pressable:active`（global.css:382-385 `scale(0.98)`；`BasicCalculator.tsx:1055` 分享按钮带 pressable） | 磁吸改 CSS 变量承载（`--wf-magnet-x/y`），`:active` 规则扩展 var 引用使位移与缩放同一声明合成共存；**禁止 inline transform 直写按钮本体**（内联优先级压死按压反馈） |
| P5 | S16 flash 重挂 × S23② `@starting-style` 同落点 `.wf-output-breakdown`（`BasicCalculator.tsx:805-815` 开关按钮+明细容器） | 明细区禁重挂——flash 走 `flashOn` 类承载，进场仅在展开插入帧播一次；展开开关不进重挂范围（键盘焦点不丢）；hero 严禁包裹 |
| P7 | S22 伪元素动画 × reduced-motion 通配兜底（global.css:644-652 兜底块为 `*, *::before, *::after`——常规伪元素已覆盖；**不被压停的是 `::view-transition-old/new(root)` 等 UA 自定义伪元素**，`*::before` 不匹配它们） | 显式 `@media (prefers-reduced-motion: reduce)` 停用规则（research 片段 6.6 CSS 原样），逐选择器清单同步登记 |

### §2 附：不采纳清单（12 项，全部给因）

| # | 项（来源） | 不采纳理由（可复议条件） |
| --- | --- | --- |
| 1 | 构成明细行 count-up（interaction 5.3 原案） | 4/5 行为输入回显，滚动=延迟呈现键入值；计算行与 hero 重复动画。已由 S18 推广落点替代其本意 |
| 2 | `?` 帮助浮层（interaction 5.10） | ① 新增成段 UI 文案违反 §7 零净增守恒（帮助内容本身即新内容面，无法折叠承载）；② S21 焦点域化后 WCAG 2.1.4 合规动机消失；③ 数字键语义已在 tabsKbdHint 承载。可复议条件：后续轮出现 ≥3 个需文档化快捷键时再立项 |
| 3 | Esc 层级栈 hook（interaction 5.12/6.4） | 全仓浮层仅组件库 Tooltip/Popconfirm/Select 弹层，Esc 行为均内建（interaction §5.12 自述「现有组件库 Esc 行为内建不受影响」）——无消费者的 hook 是死代码 |
| 4 | 空态弓弦绷直（interaction 5.15） | 与宪法收敛纪律冲突：S2 是全站唯一 expressive 时刻（design-language.md §2 末注）；资产 0→有翻转属「达成类」时刻，第二 expressive 动效破纪律。EmptyRuler.tsx:24-25 弓弦保持静息隐喻 |
| 5 | 输入即时帧位置条（interaction 5.14） | 常驻位置条与「数字是主角」争夺注意力（§1 B6 同口径）；错误态冗余已由 S24 承担 |
| 6 | 结果落定交叉淡化（trends §1 S2/C8） | hero 数字已有 useAnimatedNumber 渐近滚动（BasicCalculator.tsx:578）——View Transition 换票=双重动效叠加；且防抖 300ms 高频触发快照成本不成比例。因果呈现由 S16 承担 |
| 7 | 龙卷风条形生长（trends §1 S5） | 与 recharts 既有入场动画叠加冲突（`barAnimationProps` BasicCalculator.tsx:155-159）；双重 transform 动画互相覆盖 |
| 8 | 明细折叠 `::details-content` 动画（trends §1 S10） | 全仓 `grep "<details"` **0 命中**（本会话实证）——明细折叠走 Button+条件渲染（R12 保护对象），Collapse 组件自带动画；改造 `<details>` 触 R12/R13 结构回归，收益为零 |
| 9 | 整数徽标 CSS 数字滚动（trends §1 S12） | Safari `counter(var())` 渲染未验证（trends 附录 C.3 自标「采纳前须实机复核」）；且唯一整数徽标（段位 Tag）已有 S14 单次涨色 |
| 10 | 面板滚动进场淡入（trends §1 S4） | scroll() / view() 时间线动画**随滚动映射、可逆重放**（与 trends 自述「不可逆」不符——回滚即重播），违反动效频次纪律与 P5 验收 #17 同屏 ≤2 动效的可控性；面板多在首屏，增益边际 |
| 11 | 顶栏滚动进度细条（trends §1 S3） | 与已登记资产「诚实进度尺」（宪法 §2 注记 S13：已落地登记为资产不再重复施工）触发时机重叠——重复施工禁令；且无 `@supports` 降级为「常显装饰线」违反克制 |
| 12 | `linear()` 按压曲线（trends §1 S11） | `.wf-pressable` 已承载②档按压（scale 0.98 + 120ms，global.css:376-390）——双按压体系重复；0.985 与 0.98 差异不可感知 |

---

## §3 现代视觉微调（3 项采纳走准入；4 项不采纳给因）

> 依 §0 第 4 条单列。三项采纳均为**既有键改值/既有规则扩展**，不新增令牌键；V2/V3 属主题组令牌改值，须按宪法 §5.4 三源对账五点同步（`types.ts` 接口不变、`defaults.ts` THEME/THEME_DARK、`App.tsx` 注入数组键已有无需扩、`global.css` 双块），外加**第四源**：审计脚本 `scripts/check-a11y-contrast.mjs` 内置对值同步。

### V1 mono 刻度注记（源：trends §2 C1；登记为宪法 S3「度量字排」的扩展变更）

- **准入五要素**：视觉描述=图表轴刻度文字改系统 mono 字族（与 S3 tabular-nums 同位的「非数值精密位」延伸）｜触发时机=常驻排印规则｜降级方案=纯 font-family 声明，不支持系统 mono 栈的字体回退 sans-serif 无害｜双主题值=静态层字族两主题同值不入对账（宪法 §5.4 静态层口径）｜尺寸增量=+0.15KB（1 条静态令牌 + 既有选择器组追加一行）。
- **落点（确凿）**：`global.css` 静态层追加 `--wf-font-mono: ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace;`，并在既有 S3 图表刻度选择器组（global.css:1211-1216，覆盖 `.wf-mc-chart/.wf-acc-chart/.wf-sens-chart/.wf-waterfall-chart` 四容器 `.recharts-text`）追加 `font-family: var(--wf-font-mono)`。
- **落点（实施时确认）**：输入单位后缀——Arco InputNumber 后缀容器类名实施时以 DevTools 确认后追加一条 font-family 规则；**口径注 prose（note/tooltip 正文）明确不纳入**（mono 不利于长句可读性——对 C1「三处非数值位」的诚实收窄，偏差已登记）。

### V2 浅色画布暖白微偏（源：trends §2 C4；「取色温不取色相」收敛）

- **准入五要素**：视觉描述=浅色页面画布自冷灰蓝白向暖白偏移一档（年度色校准参考式全量吸收，不新增色板）｜触发时机=常驻｜降级方案=纯令牌改值，无降级概念（回滚即恢复）｜双主题值=仅浅色 `--wf-bg-sunken` 改值，深色画布不动（C4 原案即浅色画布单侧）｜尺寸增量=≈+0.05KB。
- **改值**：`--wf-bg-sunken` 浅色 `#f7f8fa` → **`#F8F7F3`**。**对比度验算（本会话实跑 node 脚本，WCAG 公式）**：次级文字 #646E7A 对新画布 **4.83:1**（原 4.88:1，≥4.5 达标）；三级 #4E5969 对新画布 6.63:1；正文 #1D2129 对新画布 15.05:1——全部达标。**第四源同步（修订轮 P8 补全，三处）**：`scripts/check-a11y-contrast.mjs` ——`:102` `LIGHT_PAGE = "#f7f8fa"` → `#F8F7F3`（`:104` 卡底合成经 LIGHT_PAGE 引用自动跟随）；`:125` 该审计对的 **bg 字面值 `"#F7F8FA"` → `"#F8F7F3"` 一并改值**（实读确认该行 bg 为独立字面值、不引用 LIGHT_PAGE，只改常量会让该对按旧画布计算或 ref 失配；该审计对 name 串内联的画布色「页底 #F7F8FA」随行改写，避免审计输出名实不符）**及 ref 值 4.88 → 4.83**（脚本口径「阈值不得四舍五入」仍满足）。验收含 `npm run check:a11y` 重跑（§9 #19）且 #20 的 diff 范围含此 bg 字面值。

### V3 深色次级文字冷暖倾向（源：trends §2 C5；须对比度复检——已复检）

- **准入五要素**：视觉描述=深色次级文字自中性灰向冷灰蓝微偏（深色技术精密风的两处增量之一）｜触发时机=常驻｜降级方案=纯令牌改值｜双主题值=仅深色 `textSecondary` 改值，浅色不动｜尺寸增量=≈+0.05KB。
- **改值**：`THEME_DARK.textSecondary`（defaults.ts:284）`#A9AEB8` → **`#A6B0C3`**；`global.css` 深色块对应键同值。**对比度验算（本会话实跑）**：对深色卡合成底 #232324 **7.19:1**（原 7.05:1，**提升**）、对凹面 #1C1C1F 7.79:1、对页底 #17171A 8.19:1——冷偏同时提亮，最不利口径余量扩大。**第四源同步（四处，与 §4 表对齐）**：`check-a11y-contrast.mjs` 深色次级文字对——`:130` fg 硬编码字面值 `"#A9AEB8"` → `"#A6B0C3"`（该行 name 串内联的 `#A9AEB8` 随行改写，避免名实不符）**及 ref 值同步更新**；ref 回填以**脚本 rgba 合成底口径实测值**为准（实测 ≈7.27，非纯色理论口径 7.19；脚本 ±0.1 容差 ：156-158 容纳），防止名义值失真。验收含 `npm run check:a11y` 重跑（§9 #19）。

### 不采纳（4 项，给因）

| 项（来源） | 理由 |
| --- | --- |
| C2 主题按钮 aria 叙事化（「开账/打烊」） | 读屏语境下隐喻降低可预期性，WCAG 4.1.2 可访问名称应描述功能目标状态；叙事由 S22 动效本体承载 |
| C3 serif 小节头一档 | 同时引入 mono（V1）与 serif 两个新字族稀释冷感单一字族纪律；trends 自标「须评审冷感兼容」——账房人格的「精密感」已由 V1 mono 承担，serif 收益边际、评审风险实 |
| C7 进度尺发丝刻度纹理 | 叠加对象是 S6 空态「未上弦刻度尺」占位图形——空态的静默本身就是隐喻，装饰纹理与「缺什么」的诚实表达冲突 |
| C6/C8/C9/C10 图表十字线读数窗／落定换票／警示左标线／选中塌缩 | 非独立视觉项：C6 并入 S25、C8 不采纳（§2 附 #6）、C9 修正并入 S24、C10 无落点（情景库为 Tag+对比表结构，`ScenarioPanel.tsx:230-311` 实测无卡片单选形态，trends 片段类名 `.wf-scenario-card/.arco-radio-checked` 全仓 0 命中） |

---

## §4 组件改造清单（逐文件「现状 → 目标」；共 17 个文件）

| 文件 | 现状 | 目标（本轮改动） |
| --- | --- | --- |
| `src/components/BasicCalculator.tsx` | 输出卡无因果高亮（§1 A3）；敏感性行与图无联动（A4）；龙卷风图无 Tooltip（A1）；<768 展开无进场（A5）；分享按钮无微交互 | S16：`useFlashOnChange(data?.criticalValue)`——汇总/乘数两行外包 `key={flashEpoch}` 重挂 + 明细区 `flashOn` 挂类（严禁包裹 hero 与明细展开开关；明细区非重挂承载）；S17：SensitivitySection `hoveredPct` state + Cell 描边 + 行 hover 接线；月开销字段包装 onFocusCapture/onMouseEnter + `.wf-sens-chart` 挂 `.wf-linked`；S23②：`.wf-output-breakdown` <768 分支挂 `.wf-row-enter`；S25：龙卷风图加 Tooltip（cursor+共享 content）；S26：分享按钮追加 `wf-magnet` 类接 `useMagnetic()`（CSS 变量方案）。**禁改**：FreedomGauge（S1/S2/S11）、防抖链（:533）、resetEpoch 机制（:345-352,509-512）、sr-only live 区（:702-708） |
| `src/components/hooks.ts` | 仅 `useAnimatedNumber`/媒体查询/useMoney 族 | 追加 `useFlashOnChange`（片段 6.1）与 `useMagnetic`（trends S13，CSS 变量方案——只写 `--wf-magnet-x/y`，不写 inline transform）；`useAnimatedNumber` 增补**可见性闸**（§6 红线 2：IntersectionObserver，hidden/视口外暂停 rAF、恢复续播——hero 同受益行为不变）；新增监听均 useEffect cleanup/disconnect；R9：hooks.ts:162 `usePrefersReducedMotion` 不删不改 |
| `src/components/AdvancedPanel.tsx` | Tabs 无动画（B2）；组间无键盘路径（B3） | S20：`animation={{ inkBar: true, tabPane: true }}`；S21：`makeTabsKeyDown` 扩展 1/2/3 分支（作用域=既有容器 onKeyDown，:131-138）；tabsKbdHint aria 值更新。**禁改**：常驻+hidden 结构（:127-156，R1）、roving tabindex（:90-115，R2） |
| `src/App.tsx` | 主题切换直调（B4） | S22：`revealTheme(x, y, apply, reduced)` 工具函数 + 按钮 onClick 携带坐标接入；reduced 判定复用 `usePrefersReducedMotion` 迁移口径（App.tsx 现未引该 hook，经 `matchMedia` 局部判定或引既有 hook——以 hooks.ts:162 为唯一来源）。**禁改**：令牌注入数组键集（:82-118，键已有不加）、分享 hash 链路（:49-71，R3）、meta theme-color 逻辑 |
| `src/components/advanced/ReversePanel.tsx` | 主数瞬跳（A2） | S18：`money(useAnimatedNumber(data.sustainableMonthly))`（:170） |
| `src/components/advanced/LoanPanel.tsx` | 主数瞬跳（A2） | S18：`moneyFixed(useAnimatedNumber(data.monthlyPayment))`（:147） |
| `src/components/advanced/RentalPanel.tsx` | 主数瞬跳（A2）；瀑布图无 Tooltip（A1） | S18：`money(useAnimatedNumber(netCashFlow))`（:613）；S25：BarChart 加 Tooltip |
| `src/components/advanced/PensionPanel.tsx` | 主数瞬跳（A2） | S18：`money(useAnimatedNumber(data.pensionMonthly))`（:175） |
| `src/components/advanced/MonteCarloPanel.tsx` | 两图无 Tooltip、无联动（A1）；主数瞬跳（A2） | S18：`money(useAnimatedNumber(data.medianTerminal))`（:820）；S25：两 LineChart 加 Tooltip + `syncId="wf-mc"`（实施核对对齐口径）。**禁改**：运行闩锁/序列两态逻辑、aria（R13 :683-684/:850-851） |
| `src/components/advanced/AccumulationPanel.tsx` | 反推数瞬跳（A2）；折线图无 Tooltip（A1） | S18：`wf-big-number` 值接 `useAnimatedNumber`（:414-420）；S25：LineChart 加 Tooltip。**禁改**：`submittedTarget` 同帧快照（S15 锚点） |
| `src/components/advanced/ScenarioPanel.tsx` | 保存后无进场（A5） | S23①：情景 Tag 外层挂 `.wf-row-enter`（`mounted` 闸限定仅新增条目播进场）。**禁改**：D6 触控扩展、Popconfirm 链路 |
| `src/components/fields.tsx` | 错误态单通道（B5） | **零 TSX 改动**（S24 纯 CSS 命中既有 `.wf-field`/`.arco-input-error`）；S17 字段联动经调用方包装（不改通用组件）。**禁改**：受控显示值/越界保留机制（:104-117，R4） |
| `src/styles/global.css` | P5 签名元素区（:1200-1300） | 末尾新增 **「P6 交互巧思区」**分区：S16 `.wf-flash`+keyframes、S17 `.wf-sens-chart.wf-linked`、S19 hover 规则组+shadow 过渡时长修正（:214）、S22 view-transition 规则组+减动效显式停用、S23 `.wf-row-enter`+`@starting-style`、S24 `.wf-field` relative+`:has` 标线、S25 `.wf-chart-tip`、S26 `.wf-magnet` 规则+既有 `.wf-pressable:active` var 合成扩展（非磁吸按钮 var 缺省 0px 恒等变换）、V1 `--wf-font-mono`+S3 刻度组扩展；reduced-motion 逐选择器清单（:657-679）按 R9 惯例登记新增类 |
| `src/data/defaults.ts` | THEME/THEME_DARK 现值 | V2：THEME.bgPage `#f7f8fa`→`#F8F7F3`（:238）；V3：THEME_DARK.textSecondary `#A9AEB8`→`#A6B0C3`（:284）——**只改值不增键**，types.ts 零改动；注释中对比度口径数字同步更新 |
| `src/data/types.ts` | ThemeTokens 接口 | **零改动**（无新键；本行证明无接口变更） |
| `scripts/check-a11y-contrast.mjs` | 内置 23 组对比对 | V2：`LIGHT_PAGE`（:102）与 ：125 对 ref 同步；V3：深色次级文字对 fg 与 ref 同步 |
| `src/i18n/locales/{zh-CN,zh-Hant,en}.ts` | 现有三语键表 | 仅 `advanced.tabsKbdHint` 一键改值 ×3（S21）；**零新增键、零删键**（§7） |

### 组件库未启用交互属性启用点裁定（research 任务 B 清单逐项收口）

| 属性（源码实证位置） | 裁定 |
| --- | --- |
| `Tabs.animation`（es/Tabs/interface.d.ts:24） | **启用**（S20）——本轮唯一启用点 |
| `Card.hoverable`（es/Card/interface.d.ts:26） | 不启用：固定 hover 提升样式与材质卡（半透明底+发丝线）叠加行为未验证，且吸附态排除/1px 上浮需自定义——S19 自制规则更精确 |
| `InputNumber.mode/formatter/hideControl`（es/InputNumber/interface.d.ts:74-130） | 不启用：formatter 与受控显示值机制（`fields.tsx:92-100` inputEpoch 重挂）冲突风险；hideControl 移除步进钮损害可达性 |
| `Slider.formatTooltip/marks`（es/Slider/interface.d.ts:14-19） | 不涉及：Slider 未引入（滑杆诉求由 InputNumber 承担），本轮不引入新组件 |
| `Progress.animation`（es/Progress/interface.d.ts:19-24） | 不涉及：进度环为自绘 SVG（FreedomGauge），非 Progress 组件 |
| `Tooltip.mini`（es/Tooltip/interface.d.ts:26-42） | 不启用：FieldTip 默认尺寸保持可读（A5 无障碍口径） |
| `Collapse.triggerRegion`（es/Collapse/interface.d.ts:56） | 不启用：header 可点已足够，扩大命中区需再走 a11y 评估，本轮无收益 |

---

## §5 回归保护（不得破坏；每条含验证锚点）

### 5.1 P5 签名元素 S1–S15 逐项不回退（锚点=宪法 §2.1 收口实测 + 本会话复核）

- [ ] **S1 四档里程碑刻度环**：`BasicCalculator.tsx:63-71`（几何常量）、:354-360（跨档判定）、:422-436（刻度点渲染）；global.css:1251-1264——S16/S17/S18/S25 **不得触碰 FreedomGauge 子树**（S16 容器禁包 hero 为硬约束）；跨档变色+单次放大实测一次。
- [ ] **S2 达成一次脉冲**：闩锁+滞回 `BasicCalculator.tsx:72-74,339-373`；global.css:1274-1283（iteration 1）——resetEpoch 清位行为不变（§5.2 R3）；`animation-iteration-count: 1` 样式层核对。
- [ ] **S3 度量字排**：global.css:1205-1209 `.wf-num` + :1211-1216 图表刻度——V1 仅在既有选择器组**追加** font-family，不删 tabular-nums；数值行滚动无抖动复测。
- [ ] **S4 行级 hover 读数**：global.css:1227-1235——S17 在同一落点加描边强调，不改既有背景着色规则；hover 无阴影纪律保持。
- [ ] **S5 轻确认已复制**：`BasicCalculator.tsx:554-565,663-671,1056,1063`——S26 磁吸只挂 transform，不干扰 copied 文案切换计时。
- [ ] **S6 空态人格化**：EmptyRuler.tsx + 四处 Empty icon 注入（`MonteCarloPanel.tsx:676,917`、`AccumulationPanel.tsx:614`、`ScenarioPanel.tsx:287`）——本轮零触碰；S23 挂 Tag 外层不经 Empty。
- [ ] **S7 分组左标线**：global.css:1239-1246 + `BasicCalculator.tsx:830`——S24 为字段级 ::before，与组线选择器无交集。
- [ ] **S9 输出卡计算徽标**：`BasicCalculator.tsx:540-550,688-696` + global.css:1294-1302——S19 hover 规则与呼吸动画不同属性不冲突；防抖 pending 清位逻辑零改动。
- [ ] **S10 方向冗余编码**：`BasicCalculator.tsx:275-276,290-291,1029-1032`、`RentalPanel.tsx:607-612`——S18 包装 RentalPanel 净现金流时 ▲▼ 字形与语义色路径原样保留。
- [ ] **S11 深色环线抬升**：halo 环 `BasicCalculator.tsx:407` + global.css:1286-1291——零触碰。
- [ ] **S13（资产）诚实进度尺**：宪法 §2 注记登记——本轮不重复施工（§2 附 #11 即其执行）。
- [ ] **S14 乘数段位徽标**：`BasicCalculator.tsx:566-594,779-796`——S16 flash 与段位涨色并存时同屏动效 ≤2（验收 #27 抽查——修订轮 P9 改指）。
- [ ] **S15 目标线叙事标注**：`AccumulationPanel.tsx:91-93,555`——S18/S25 零触碰 `submittedTarget` 同帧快照与 ReferenceLine。

### 5.2 既有红线（p5-spec §9 R1–R13 延续，本轮新增触点逐条对账）

- [ ] **R1 方案 B 导航保活**：跨组切换不卸载面板（`AdvancedPanel.tsx:127-156` 常驻+hidden）——S20 动画属性不改挂载、S21 只扩 keydown 分支；蒙特卡洛运行结果切组往返保留。
- [ ] **R2 方向键漫游**：roving tabindex（`AdvancedPanel.tsx:90-115`）不变——S21 与 ←/→ 分支共存于同一处理器。
- [ ] **R3 分享回落 resetEpoch**：损坏 hash 回落默认+一次提示（`App.tsx:49-71`）；resetEpoch 清 S1/S2 状态（`BasicCalculator.tsx:345-352`）——S16 epoch 挂在落定值上，回落帧值变会闪一次属可接受（信息为真）；resetKey 重挂机制（:509-512,668）不被波及。
- [ ] **R4 币种换算**：convertRate 链路（`fields.tsx:73-117`）、图表同源换算（`BasicCalculator.tsx:525` convert）——S18 滚动 CNY 规范值、格式化处逐帧换算（hero 同构）；S25 气泡金额经各面板既有 `money` 同源；rate null 符号-only 回退不破。
- [ ] **R5 预设取消**：toggle 语义（`BasicCalculator.tsx:880-889`）零触碰；S16 闪亮不覆盖 Message 反馈。
- [ ] **R6 PWA**：`vite.config.ts`/`sw.ts`/manifest 禁触；构建产物 precache 机制不变。
- [ ] **R7 色盲友好收纳**：D2 视觉隐藏+双形态 Select+resolveThemeTokens 涨跌替换（`defaults.ts:356-359`）三机制零触碰——S24 用的 `--wf-fall` 经同一解析链自动随色盲档替换。
- [ ] **R8 吸附与穿透**：sticky 偏移派生（global.css:162-195）、穿透链（:224-241）、D8 dock（:1147-1159/:1199）、D9 吸附态明细隐藏（:1189）——S19 hover 必须带 `:not(.wf-is-stuck)`；吸附态下不得新增卡内可交互元素（S16 容器/S23 类为纯视觉，不增交互元素）。
- [ ] **R9 reduced-motion 双闸**：`hooks.ts:162-172` 与 global.css:644-679 不删不改；本轮新增动画类（`.wf-flash`/`.wf-row-enter`/`.wf-ring-*` 无新增/S22 伪元素/S26 `.wf-magnet`——后者过渡复用 `.wf-pressable` 既有登记项，自身零新增动画/过渡声明）全部登记进逐选择器清单；S22 伪元素须**显式**停用规则（通配兜底 `*, *::before, *::after` 不命中 `::view-transition-*` UA 自定义伪元素）。
- [ ] **R10 三源对账**：V2/V3 改值后 THEME/THEME_DARK/global.css 双块/App.tsx 注入四处逐键一致（App.tsx 注入数组键已有无需扩，值经 tokens 流动）；`npm run check:a11y`、`npm run check:currency` 复跑通过。
- [ ] **R11 组件库按需引入**：本轮零新增 import 行（S20/S21/S25 全部用已装组件与既有 recharts 导出——`Tooltip` 需在用图文件内自 recharts 追加具名导入，属既有包内导出非新依赖，与 R11「main.tsx:23-42 零新增样式 import」口径不冲突）；`main.tsx` 禁触。
- [ ] **R12 D9 明细折叠**：<768 默认收起+aria-expanded 切换（`BasicCalculator.tsx:803-827`）——S23② 只加进场类不改折叠结构；吸附态 `.wf-is-stuck .wf-output-breakdown` 隐藏仍生效（global.css:1189）。
- [ ] **R13 aria 结构**：sr-only live 区（`BasicCalculator.tsx:702-708`）常驻且只绑落定值——S18 动画中间值禁入 live 区；六处图表 role="img"+aria-label（`BasicCalculator.tsx:210,394-401`、`MonteCarloPanel.tsx:683-684,850-851`、`RentalPanel.tsx:614` 邻近容器、`AccumulationPanel.tsx:513-514`）——S25 Tooltip 插入不得移除宿主容器 aria 属性。
- [ ] **R14 计算公式与数据流（本轮铁律显式化）**：`src/services/**`、`src/store/useCalculatorStore.ts`、`src/data/presets.ts` 零改动；`useFinanceCall` 调用点数量不变（本会话 grep 实证 **8 处**：BasicCalculator 1 + 六面板 7，其中 AccumulationPanel 双调用 :80/:124）；WASM 输出契约零变化。

---

## §6 性能红线（实施期逐条对照，违反即返工）

1. **防抖落定 → store 口径不变**：全部巧思只读落定结果（`useFinanceCall` 返回值或 store 现值）；`useFinanceCall` 调用点 8 处数量与依赖数组零改动——**单次输入变更 ≤1 次防抖计算**为硬验收（S16/S17/S25 的 hover/闪亮路径零计算触发）。
2. **禁止每帧 setState 入 store + 动画 hook 必须带可见性闸（修订轮 P6 改写，原「同屏 ≤2 条可见性保证」与「有界短时可接受」两版口径均废止）**：rAF 中间帧只进动画显示值（`useAnimatedNumber` display 通道，hero 先例口径）与 CSS 变量写（`useMagnetic` 的 `--wf-magnet-x/y`，零 setState）；store 只接收防抖落定的既有 onChange 写入。**可见性闸为硬性要求**：R1 方案 B 面板常驻+hidden（`AdvancedPanel.tsx:127-135` 实读 `hidden` 属性切换），hidden 不停 rAF 也不停 setState——旧「单面板可见保证 ≤2 条」推断在架构上不成立（预设/情景载入等批量写入可令六面板 data 同窗口落定）。**S18 六处 count-up（复用 `useAnimatedNumber`）与一切动画类 hook 必须带可见性闸**：宿主 `display:none` 或视口外时 rAF 循环当帧暂停、不再调度下一帧，恢复可见时从当前显示值续播（墙钟已过时长则直接落终值）——批量落定窗口内只有可见面板推进 rAF；实现=IntersectionObserver（宿主元素级，卸载 disconnect；display:none 与视口外均表现为 not-intersecting）驱动暂停/恢复。hero（常驻可见）同样挂闸、行为不变。推广禁令保留：S18 每面板至多 2 处，推广到面板内多行/批量元素须沿用同一闸并走本节修订与 §8 复算。
3. **事件监听器一律 useEffect cleanup**：本轮新增监听为 `useMagnetic`（pointermove/pointerleave）与 S18 可见性闸的 IntersectionObserver（宿主元素级，修订轮 P6 新增）——cleanup 摘除/disconnect 强制；S21 复用容器 onKeyDown 冒泡（零 window 监听）；S25 走 recharts 内建（零手写 mousemove，research §4.5 红线）；全局 keydown 数量净增 0。
4. **因果高亮不得触发级联重计算**：S16 epoch 由落定值派生（一次 setState 触发子树重渲染）；S17 为本地布尔/数字 state；两者均不得放进 effect 依赖去驱动任何 `useFinanceCall`/store 写入。
5. **渲染规模约束**：S25 hover 重渲染限于 tooltip 子树；S22 为一次性快照（主题切换低频，不得用于高频动作）；S19/S24 为 CSS 静态规则零 JS；S20/S23 为组件库/CSS 过渡零 JS。
6. **主题注入性能**：V2/V3 改值不增加注入键数量（App.tsx:82-118 数组长度不变）；首帧闪变防线（global.css :root 静态默认值与 THEME 同步改值——V2 的 :root 块 `--wf-bg-sunken` 与 defaults.ts THEME.bgPage 必须同轮同值，宪法三源对账纪律）。

---

## §7 冗长守恒（反冗长原则 3 的可测指标）

| 类别 | 键 | 增量 |
| --- | --- | --- |
| 新增 UI 文案 | 无 | **0 键** |
| 改值（不增键） | `advanced.tabsKbdHint`（S21 键盘提示扩展句）×zh-CN/zh-Hant/en 三语 | 0 键（3 处值变更） |
| 复用承载 | S25 气泡系列名/标签=既有 Descriptions 与图例键（`mc.p5/p25/p75/p95/medianTerminal`、`sensitivity.*` 等）；S26 无文案；S16/S17/S19/S20/S22/S23/S24 零文案 | 0 键 |
| **合计** | | **净增 0 键 × 三语**（唯一文案面=1 键改值） |

- 既有 ≥140 字符界面串 0 条纪律复扫（§9 #23）；新巧思**零 tooltip 文字、零说明行**——反冗长「口径与出处归 tooltip」本轮无新增债务。
- 键集一致性验收：三 locale 展开键集 diff = 0（node 展开比对脚本口径，§9 #22）。

---

## §8 尺寸预算（压缩后原始字节；门禁=dist 原始字节总和，数值不放宽）

**前提**：P5 purge 回收后余量 ≈54KB（p5-spec §14 案 A 收口口径）；估算口径=research-ui-trends 附录 B 实测法（esbuild minify + gzip-9 单段独立实测），合并入 global.css 后共享压缩字典，实际增量低于表列值。

| 项 | 侧 | 估算（gzip） |
| --- | --- | --- |
| S16 因果闪亮 | 增 | 0.70KB |
| S17 双向高亮 | 增 | 0.50KB |
| S18 主数渐近滚动 | 增 | 0.45KB |
| S19 卡片克制悬浮 | 增 | 0.25KB |
| S20 Tabs 动画属性 | 增 | 0.05KB |
| S21 数字键切组 | 增 | 0.25KB |
| S22 主题圆形扩散 | 增 | 0.75KB |
| S23 进场（两落点） | 增 | 0.25KB |
| S24 错误左标线 | 增 | 0.15KB |
| S25 图表 hover 读数 | 增 | 0.80KB |
| S26 磁吸微行程 | 增 | 0.50KB |
| V1 mono 刻度注记 | 增 | 0.15KB |
| V2/V3 令牌改值（无新键，字面值等长级） | 增 | ≈0.10KB |
| i18n tabsKbdHint 改值 ×3 | 增 | ≈0.05KB |
| **合计** | | **≈ 4.95KB**（≤ 25KB 上限，余量 54KB → ≈49.05KB；修订轮 P1–P10 吸收后 node 复算闭合，见附 A） |

**超限降档顺序（预定义；仅当收口实测 >25KB 时按序执行并回写实测值）**：
1. 先砍 TSX 项：S26（0.50）→ S23（0.25）→ S17（0.50）→ S21（0.25）→ S16（0.70）——S18/S25 因承载 A1/A2 主缺口最后动；
2. 再砍低价值 CSS 项：V1（0.15）→ S19（0.25）→ S24（0.15）→ S22（0.75）——S22 有独立降级链可整体撤除（撤除后主题切换回现状直切）；
3. 每砍一项在 §8 回写实测值并同步 §9 验收编号；砍至 ≤25KB 即停，不反向放宽。

**实施轮实测回写（P6 实施会话，node scripts/check-size.mjs 逐步实测）**：§8 前提「余量 ≈54KB」为 gzip 口径；门禁 raw 口径实测 HEAD 基线 ≈1,992.7KB（DIST_TOTAL_KB=1946），**raw 实余仅 ≈7.3KB**。11 项全量构建实测 dist 总和 **2,001,800 bytes，超限 1,800B**（TSX+CSS minified 净增 9,187B：index.js +6,945 / index.css +2,242，vendor 块零变化）——触发降档并按序执行：
- 砍 S26（磁吸微行程整体：useMagnetic + .wf-magnet + :active var 合成回退）→ 实测 2,000,925B（−875B），仍超 925B；
- 砍 S23（进场整体：mounted 闸 + .wf-row-enter + @starting-style）→ 实测 2,000,505B（−420B），仍超 505B；
- 砍 S17（双向高亮整体：hoveredPct/linked + .wf-linked/.wf-sens-link-zone）→ 实测 **1,999,865B，门禁通过**（余量 135B），即停。
落地 = S16/S18/S19/S20/S21/S22/S24/S25/V1/V2/V3 共 8 巧思 + 3 视觉项；§9 受影响验收项：#6（S17）、#12（S23 部分）、#15（S26）不适用，#25/#27 抽查清单同步剔除三者的类目。

---

## §9 验收 checklist（26 条，全过才收口）

**构建与门禁**

- [ ] 1. `npm run build` 通过（内含 `tsc --noEmit`——TS strict 铁律的执行口径）
- [ ] 2. `npm run build && node scripts/check-size.mjs` 通过且增量 ≤6KB（§8 修订后估算 4.95KB 的实测回填）；门禁数值不放宽
- [ ] 3. `grep -n "useFinanceCall(" src/components/BasicCalculator.tsx src/components/advanced/*.tsx` 调用点合计 = 8（BasicCalculator 1 + 六面板 7，AccumulationPanel :80/:124 双调用）——R14 数据流零改动实证
- [ ] 4. `grep -rn "from \"recharts\"" src/components | grep Tooltip` 仅出现在 **4 个用图文件**（5 张图分布于 BasicCalculator/AccumulationPanel/MonteCarloPanel/RentalPanel——`grep -rln "from \"recharts\"" src/components` 本会话实测 4）且均为既有包内导出；`package.json` dependencies 零变化（零新依赖铁律）

**新巧思呈现与交互手感**

- [ ] 5. S16：改月开销→汇总/乘数两行一次淡出 + 明细区类路径一次淡出；**hero 区与明细展开开关均不重挂**（Tab 焦点保持、进度环档位/S1/S2 状态保持——回落 resetEpoch 才清位）
- [ ] 6. S17：悬停 ±数值行→对应龙卷风条描边；Tab 聚焦月开销字段→图容器描边；**指针离开与键盘 Tab 离开均复位**（描边无残留）；触屏无残留强调
- [ ] 7. S18：六面板逐一改输入→主数渐近收敛（非瞬跳）；`data` 未就绪显示「—」；reduced-motion 直接落值；**hidden 面板批量落定不推进 rAF（显示值停驻旧值）、切回可见续播或直接落终值**（可见性闸断言——修订轮 P6 专项：代码审查 IO 挂载/disconnect + DevTools 帧计数抽查）
- [ ] 8. S19：非吸附态 hover 上浮+着色底；**非吸附态卡内按钮（预设/分享/明细开关/敏感性开关）点击命中直达**（`::after` pointer-events:none 断言——修订轮 P2 专项）；**吸附态 hover 无效果**且点击穿透链不受影响（R8 复测：滚动后 elementsFromPoint 命中直达预设按钮）
- [ ] 9. S20：切标签指示条滑动+面板淡入；切组往返后蒙特卡洛结果保留（R1）
- [ ] 10. S21：焦点在高级面板非输入区按 1/2/3 切组；**焦点在 InputNumber 内键入 1/2/3 仅改数值、不切组、焦点不丢失**（输入豁免守卫断言——修订轮 P1 专项）；`aria-label`（tabsKbdHint）新值随语言更新
- [ ] 11. S22：主题按钮点击→圆形揭示且**揭示呈现的即目标主题**（flushSync 快照断言——修订轮 P4 专项）；键盘 Enter 触发→坐标回退按钮几何中心仍正常揭示；reduced-motion 下**直接切换无动画**（伪元素显式停用规则代码核对——通配兜底不命中伪元素）；无 API 环境（如旧内核）直切
- [ ] 12. S23：保存情景→**仅新增** Tag 淡入（面板首挂载既有条目整列不播）；<768 展开明细→容器淡入；**S16 flash 落定时明细区不重播、不重挂**（类承载断言——修订轮 P5 专项）；≥768 常驻分支无进场类
- [ ] 13. S24：越界值→字段左缘 2px 跌色条（DevTools 实证 `.arco-input-error` 类名成立）+ 行内文字并存；恢复合法即消失；开色盲友好档后条色随 `--wf-fall` 替换
- [ ] 14. S25：五图 hover→十字虚线+共享气泡；金额与面板 Descriptions 同源一致（币种换算同步）；蒙特卡洛两图联动对齐正确（同一 hover 两图气泡同点）；触屏无气泡
- [ ] 15. S26：桌面悬停分享按钮 ≤4px 微移、离手复位；**reduced-motion/触屏下零监听挂载**（代码审查 + DevTools getEventListeners 抽查）；dock 按钮无磁吸；**按压时 scale(0.98) 与磁吸位移共存不互杀**（`:active` var 合成断言——修订轮 P3 专项：按压帧 computed transform 含 translate+scale 两者）

**红线与回归**

- [ ] 16. P5 S1–S15 抽查不回退（§5.1 十三项锚点逐项过；重点：S2 脉冲不循环、S9 呼吸仅窗口期、S14 跨档 Tag、S15 目标线同源）
- [ ] 17. R3：损坏 hash 回落默认+提示一次；resetEpoch 后 S1/S2/S16 状态清位重置
- [ ] 18. R4：切 USD→S18 滚动值与 S25 气泡均为换算口径；离线 rate null→符号-only 回退；`npm run check:currency` 通过
- [ ] 19. R5/R7：预设取消 toggle + 色盲友好档三机制零触碰（涨跌色/左标线/图表语义色随档替换）
- [ ] 20. R10：V2/V3 四源一致（defaults.ts THEME:238/THEME_DARK:284、global.css 双块、check-a11y 脚本 **:102 `LIGHT_PAGE` + :104 卡底合成（经 LIGHT_PAGE 自动跟随）+ :125 bg 字面值与 ref**、深色对）逐键 diff=0（diff 范围含 :125 bg 字面值——修订轮 P8）；`npm run check:a11y` 通过（4.83 / 7.19 实测口径回填）
- [ ] 21. R13：sr-only live 区常驻且只报落定值（动画期间听屏无逐帧播报）；六处图表 aria 零缺失

**守恒与文档**

- [ ] 22. 三语键集 diff=0（node 展开三 locale 键集比对）且界面零裸键（键名直出 0 处）
- [ ] 23. `advanced.tabsKbdHint` 为唯一文案变更：i18n 键总数三轮前差=0；zh-CN ≥140 字符界面串复扫 0 条
- [ ] 24. 全局 CSS 变更集中于 global.css P6 分区（`grep -rn "font-family\|transition\|animation" src/components/*.tsx` 零内联样式新增——既有内联风格表达式除外）；事件监听 cleanup 全覆盖（代码审查：新增 addEventListener 仅为 useMagnetic 且带 cleanup）
- [ ] 25. 禁词扫描：对本文件以 13 词面（清单见任务口径，词面不回显进文档以免自污染——沿用 research-ui-trends 附录 B 惯例）不区分大小写正则全文扫描，输出 0 行
- [ ] 26. 深浅对照截图自查（375/768/1024 三档 × 双主题）：三秒印象保持「我的临界值是多少、离 100% 多远」；新巧思双主题均可感知（S24 左标线/S25 气泡/S16 闪亮逐项截图）；一屏一重点不破（左栏唯一 40px hero）
- [ ] 27. 同屏动效频次抽查：任一时刻在播动效 ≤2（S16 闪亮 × S14 段位涨色并存组合、S9 呼吸窗口期、S18 滚动、S19 悬浮逐项抽查；S22 为低频状态迁移过渡不计入常驻计数——修订轮 P9 新增）

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

1. 证据链：两份研究文档与宪法、p5-spec §8/§9 全文已读；`src/styles/global.css` 令牌区（:1-140）与签名元素区（:1200-1300）、动效兜底区（:615-679）、输出卡区（:206-241）实测引用；`ls src/components` 确认 **ChartCard.tsx 不存在**（ask 预设的图表卡为散布于各面板的 recharts 用法，§1 A1 已按实测 5 图落点收录）；`BasicCalculator.tsx`（1069 行）/`App.tsx`（364 行）/`AdvancedPanel.tsx`（159 行）全文已读；`fields.tsx`/`hooks.ts`/`ScenarioPanel.tsx` 按巧思落点需要已读。
2. 对比度验算：node 脚本实跑（WCAG 相对亮度公式），V2 新画布对次级文字 4.83:1、V3 新深色次级文字对卡合成底 7.19:1——均 ≥4.5 达标，数值回填 §3。
3. 禁词扫描：本文件成稿后执行附录自检命令（§9 #25 同款），结果记录于收口说明——起草时点扫描 **0 命中**。
4. 未验证清单（诚实声明）：① `.arco-input-error` 类名取自 research 引组件库源码口径，未在本会话 DevTools 实证（无浏览器环境），已列为 S24 实施前置校验与验收 #13；② recharts Tooltip cursor 在 Firefox 对 `layout="vertical"` 龙卷风图的渲染方向未实测，验收 #14 覆盖；③ 体积估算为静态估算非构建实测（构建实测归收口会话，§9 #2）；④ 蒙特卡洛两图 syncId 对齐口径按「同年份轴等长」推断，实施时核对数据形状。
5. 修订轮（独立评审 REJECT 吸收）：10 条 finding（P1–P10）逐条吸收完毕（明细与证据见文末「修订对照」）；宪法 design-language.md §2（S16–S26 三要素行 + P6 立项五要素登记表）/§5.5（P6 立项条目）已同轮回填；修订后禁词复扫两文档 0 命中（本会话 node 实跑）、§8 分项加总 node 复算闭合（修订后 ≈4.95KB ≤ 25KB）、§9 与 §2 逐项对齐核对完成。

---

## 修订对照（修订轮：独立评审 REJECT 判定 10 条 finding 逐条吸收记录）

> 每条 finding 先经修订会话实读/实跑复核再吸收，「证据」栏为修订会话实跑/实读记录（行号为该会话实测）。**10 条全部吸收、0 条驳回**；S22 expressive 归类与 S23 机制不符两处灰区分别在 P7/P10 内处置完毕；P3/P6 两处的处置方案以评审修复口径为准（P6 由「有界短时可接受」改为可见性闸硬性要求，P3 由外层包装方案改为 CSS 变量方案）。

| # | 级别 | 问题要点 | 吸收方式（落点） | 证据（修订会话实读/实跑） |
| --- | --- | --- | --- | --- |
| P1 | P0 | S21 键盘快捷键摧毁输入上下文：keydown 处理器挂分组容器（含全部面板 InputNumber），而 Arco InputNumber 仅对 ↑/↓ stopPropagation——字符键 1/2/3 从输入框冒泡到容器，键入「1」即切组、当前组 wrapper 置 hidden、输入中途焦点丢失（违反 WCAG 2.1.4，与验收 #10 矛盾） | §2 S21 合规说明全文改写（删除「焦点不在本区即不派发」错误论断、写明冒泡事实）+ 实现方式前置显式输入豁免（research-interaction-patterns §6.3 typing 判定：INPUT/TEXTAREA/SELECT/isContentEditable 直接 return）；tabsKbdHint 改值「输入框内不生效」；验收 #10 改可执行断言；冲突裁定清单 P1 行登记 | `node_modules/@arco-design/web-react/es/InputNumber/index.js:188-199` 实读：onKeyDown 仅 ArrowDown（:190-192）/ArrowUp（:194-196）两分支调 stopPropagation，字符键经 :199 冒泡；`AdvancedPanel.tsx:137`（容器 onKeyDown）/ :135（hidden）实读；`docs/research-interaction-patterns.md:206-233` §6.3 typing 豁免判定实读 |
| P2 | P1 | S19 着色底 ::after 覆盖层未写定位上下文与 pointer-events:none——按「覆盖层」字面实现后命中测试落在覆盖层，非吸附态输出卡整卡点击失效；§9 只查吸附态、此路径无验收覆盖 | §2 S19 实现方式补 `.wf-output-card { position: relative }` 与 `::after { pointer-events: none }` 必写条款 + **层序裁定**（::after 不设 z-index、绘制层序盖于卡面内容之上形成着色底，命中穿透至其下按钮；吸附态既有穿透链不受影响）；验收 #8 增「非吸附态卡内四类按钮点击直达」断言；冲突裁定清单 P2 行登记 | `global.css:206-215` 实读（卡体无 position 定位上下文、box-shadow 过渡 base :214）；`:227-241` 穿透链实读（包裹层 none / 卡面 auto / stuck none） |
| P3 | P1 | S26 磁吸 pointermove 直写 `el.style.transform`，inline 样式优先级压死 `.wf-pressable:active { transform: scale(0.98) }`——分享按钮按压反馈被静默杀死；冲突清单漏登记 | §2 S26 改 **CSS 变量方案**：hook 只写 `--wf-magnet-x/y`（无 inline transform）；新增 `.wf-magnet` 位移规则，既有 `.wf-pressable:active` 规则扩展 var 引用使位移与 scale(0.98) 同一声明合成共存（var 缺省 0px 对其他 pressable 恒等变换逐像素不变）；登记进新增「巧思冲突与共存裁定清单」P3 行；验收 #15 增按压共存断言 | `BasicCalculator.tsx:1055` 实读（分享按钮带 `wf-pressable`）；`global.css:376-385` 实读（`.wf-pressable` transition transform fast :377-379、`:active:not(:disabled) { transform: scale(0.98); opacity: 0.9 }` :382-385） |
| P4 | P1 | S22 apply=React 18 setState 在 startViewTransition 回调内非同步提交 → 快照「新状态」时 DOM 仍旧主题，揭示旧皮后硬切；片段 6.6 与 §1 S2 对同 API 写法不一致（后者用 flushSync 并写明缘由） | §2 S22 实现方式明确 **apply 经 `flushSync`（react-dom）包裹后传入**（对齐 research-ui-trends §1 S2 片段先例及其缘由「同步提交防 React 批处理漏帧」）+ 键盘激活坐标回退（`e.detail===0` → 按钮几何中心）；验收 #11 改「揭示呈现的即目标主题」断言 | `docs/research-interaction-patterns.md:289-299` 实读（片段 6.6 直传 apply、无 flushSync）与 `docs/research-ui-trends.md:113-124` 实读（§1 S2 hook，:123 `startViewTransition(() => flushSync(update))` + 缘由注释）；`package.json:18` react ^18.3.1 实读 |
| P5 | P1 | S16 重挂容器与 S23② `@starting-style` 同落点：flash 每次防抖落定重挂=明细每次落定重播 240ms 进场（与「重复展开不重播」冲突）；重挂含开关按钮时键盘聚焦被替换 DOM 丢失；两巧思同落点零裁定 | §2 S16 重挂收窄为两条 `.wf-output-line`（无状态、无可聚焦元素）；明细区改 `flashOn` 挂类承载（slow 档摘类，摘类先例 `BasicCalculator.tsx:376-380`）；严禁包裹 hero 与展开开关；§4 行、验收 #5/#12 同步断言；冲突裁定清单 P5 行登记 | `BasicCalculator.tsx:805-812`（明细展开开关按钮）/ `:815`（明细容器）/ `:753-798`（两条 `.wf-output-line`）/ `:718-743`（hero）/ `:376-380`（摘类 setTimeout 先例）实读 |
| P6 | P1 | 「六处 rAF 同屏 ≤2（单面板可见性保证）」架构不成立：方案 B 常驻+hidden，hidden 不停 rAF 也不停 setState——多面板 data 同窗口落定时 7 条 rAF 并行刷新隐藏子树，工程师会据此不做可见性闸 | §6 红线 2 改写为「**动画 hook 必须带可见性闸**」：宿主 display:none 或视口外（IntersectionObserver not-intersecting 覆盖两情形）暂停 rAF 循环、恢复续播或落终值；S18 实现方式/性能影响/五要素同步（废除「≤2 条并行」推断）；hooks.ts 落点登记 hook 增补闸；§6 红线 3 监听清单补 IntersectionObserver（cleanup 强制）；验收 #7 增闸断言 | `AdvancedPanel.tsx:127-135` 实读（`hidden={g.id !== groupId}` 常驻不卸载）；`hooks.ts:198-249` 实读（`useAnimatedNumber` rAF 逐帧 setState :236-248，现状无可见性闸） |
| P7 | P1 | 宪法三步准入第二步未走（宪法 §2 无 S16–S26、§5.5 止于 P5.1）——按宪法口径不得施工；§0.3 引用「不采纳清单 #5」实为 #4；S22 全屏 360ms 圆形揭示未归类 expressive 与否 | 本轮回填：`design-language.md` §2 主表已含 S16–S26 三要素行（编号接续 S15）+ 新增「P6 立项五要素登记」表（S16–S26 × 视觉描述/触发时机/降级方案/双主题值/尺寸增量）；§5.5 追加「P6 立项轮」条目；S22 显式归类「状态迁移过渡，非 expressive」（p6-spec §0.3、§2 S22 与宪法 §2 S22 行同口径）；p6-spec §0.3 引用更正为 #4；§0 新增第 6 条声明三步齐备 | `docs/design-language.md` §2 表与 §5.5 实读核对（回填后 S16–S26 行、五要素表、P6 条目在位）；p6-spec §0.3 现文引用 #4 实读 |
| P8 | P2 | V2 第四源只列 :102 与 :125 的 ref 值，但 :125 的 bg 是硬编码 `"#F7F8FA"` 并非引用 LIGHT_PAGE——只改两处会让该对比度对继续按旧画布计算或 ref 失配 | §3 V2 第四源清单补全为三处（`:102 LIGHT_PAGE`、`:125 bg 字面值`——连带该审计对 name 串内联画布色、`ref 值 4.88→4.83`）；:104 卡底合成经 LIGHT_PAGE 引用自动跟随；验收 #20 diff 范围显式含 :125 字面值 | `scripts/check-a11y-contrast.mjs:102`（`LIGHT_PAGE = "#f7f8fa"`）/ `:104`（`LIGHT_CARD_COMPOSITE` 引用 LIGHT_PAGE）/ `:125`（`bg: "#F7F8FA"` 硬编码 + `ref: 4.88`）实读 |
| P9 | P2 | 验收 #4「仅出现在 5 个用图文件」与 grep 实测矛盾（recharts 引入为 4 个文件、5 图分布 4 文件）——按字面执行永远过不了；§5.1 S14 锚点误指 #15（实为 S26 磁吸）；S16 闪亮与 S14 段位涨色并存计数无验收条目承载 | #4 改「4 个用图文件（5 张图分布于 4 文件）」；§5.1 S14 锚点改指 #27（并存计数承载条目）；验收 #27「同屏动效 ≤2 计数」专门条目（S16×S14 并存组合在列，S22 不计入常驻计数） | `grep -rln 'from "recharts"' src/components` 实跑返回 4 文件（BasicCalculator / RentalPanel / MonteCarloPanel / AccumulationPanel） |
| P10 | P2 | S17 只写置位路径缺清除路径——键盘 Tab 聚焦后图容器描边永久残留；S23① `@starting-style` 首挂载整列淡入与登记触发时机「保存新情景」不符 | §2 S17 补 `onBlurCapture`/`onMouseLeave` 清除（置位/清除成对必写）+ 验收 #6 增「键盘 Tab 离开复位」断言；§2 S23① 改 `mounted` 闸（首挂载后 rAF 置位再加类——既有条目仅重渲染、DOM 不重插不重播，新增 entry 首次插入才播，零 store 改动守 R14）；S23② 触发时机如实改「每次展开播一次」 | `ScenarioPanel.tsx:232-263` 实读（keyed Tag 列表 `key={entry.id}`：既有条目重渲染不重插、面板首挂载整列插入）；store 零改动约束=§5.2 R14 |

---

## 实施结果与收口记录（P6 实施运行；本节由文档收口会话补记，引用命令与数值均为该会话当场复跑/实读，另注明者除外）

### 一、落地范围与改动文件

- **巧思落地 8 / 11**：S16/S18/S19/S20/S21/S22/S24/S25 落地；**S17/S23/S26 降档裁撤**（触发与顺序见 §8 实测回写）；视觉项 V1/V2/V3 全部落地。`src/data/types.ts`、`src/services/**`、`src/store/**`、`vite.config.ts`、`sw.ts`、manifest 零改动（`git status` 实测未出现，R14/R6 口径）。
- **改动文件 17 个（源码/配置，`git status` 实测）**：`src/App.tsx`（S22）；`src/components/AdvancedPanel.tsx`（S20/S21）；`src/components/BasicCalculator.tsx`（S16/S25）；`src/components/hooks.ts`（`useFlashOnChange` + `useAnimatedNumber` 可见性闸；S26 裁撤留档注释）；`src/components/advanced/{Reverse,Loan,Rental,Pension,MonteCarlo,Accumulation}Panel.tsx`（S18 ×6 + S25 ×3）；`src/components/advanced/ScenarioPanel.tsx`（S23 裁撤留档注释）；`src/data/defaults.ts`（V2/V3 改值）；`src/i18n/locales/{zh-CN,zh-Hant,en}.ts`（`advanced.tabsKbdHint` 一键改值 ×3）；`src/styles/global.css`（P6 交互巧思区 ：1332-1462 + V1 mono 令牌 + 既有区三处锚点注释）；`scripts/check-a11y-contrast.mjs`（V2/V3 第四源同步）。
- **文档与素材**：`docs/p6-spec.md`（本文，新建）、`docs/design-language.md`（§2 偏差标注 / §2.1 P6 收口核验 / §5.5 实施状态回填）、`docs/research-ui-trends.md` 与 `docs/research-interaction-patterns.md`（研究段新建）；双语 README 功能特性区各补一句交互升级描述；`docs/assets/` 双语工作台素材重制 4 件（`demo-workbench.png` / `demo-workbench-flow.gif` 与 `en/` 同名两件，文件名口径未变，README 演示区文件名无需替换）。

### 二、尺寸实绩与门禁终态

- **实施轮实测**（§8 已回写）：HEAD 基线 `DIST_TOTAL_KB=1946`（≈1,992.7 KB raw）；全量 11 项实测 2,001,800 B，超限 1,800 B；按降档顺序砍 S26（−875 B）→ S23（−420 B）→ S17（−640 B）后 **1,999,865 B（余量 135 B）** 收口。
- **收口复测**（文档收口会话实跑）：`npm run build` 通过（`tsc --noEmit` + vite build，PWA precache 12 entries）；`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1953`、`WASM_MAX_KB=364`，尺寸门禁通过（与上项收口值 1,999,865 B ≈ 1953 KiB 一致）；`node scripts/check-a11y-contrast.mjs` → 23 组令牌对全过、白名单外违规 0；`node scripts/check-currency.mjs` → 五组样本断言全过；`cargo test --manifest-path src/wasm/Cargo.toml` → **53 passed / 0 failed**。七道门禁循环由实施运行门禁段执行（工作流在门禁未绿时中断，运行已推进至文档段即其佐证）；wasm-pack 构建一道本节未复跑。

### 三、验收轮次

1. **规范段**：v1 规范两轮独立评审 REJECT（10 条 P1–P10，逐条实跑取证）→ 修订吸收 + 宪法回填（S16–S26 五要素入 design-language.md §2）→ **定向确认 REJECT（5 处低危文档残留）** → 主会话逐处收口（记录见下）→ 终审定案。
2. **实施段**：七道门禁循环（命名审计 / cargo test / wasm-pack 构建 / tsc+vite 构建 / 尺寸 / 对比度 / 币种）全绿；fresh 视觉交互验收循环按「交互真伪与手感 / 反冗长与克制 / 参数与回归」三把尺执行（工作流协议 ≤3 轮，FAIL 即返工），双语素材重制成功侧证浏览器验收环境可用；最终轮次与逐条 findings 明细由实施运行结果流承载，本节不复述无法在本会话复现的数字。文档级终检（禁词扫描、素材文件名与图注一致性、宪法—规范口径互证）由本收口会话执行，结果见本节与附录 A。

### 四、收口记录（主会话逐处收口的 5 处残留；定向确认 REJECT 逐条，均为文档记账级、零源码影响）

| # | 残留（定向确认指出） | 收口方式（改前 → 改后，主会话实改） |
| --- | --- | --- |
| 1 | §0.5 合计旧值 | §0 第 5 条估算合计仍为修订前口径：「≈4.6KB（§8…」→「≈4.95KB（§8，P1–P10 吸收增量后口径…」，与 §8 分项加总对齐 |
| 2 | 降档清单 S22 括号值 | §8 超限降档顺序第 2 步 S22 括号值 0.70 → **0.75**，与 §8 分项表（修订 P7 后口径）一致 |
| 3 | A1 grep 证据表述 | §1 A1 的 Tooltip 现状证据由「**0 命中**（本会话实证，仅命中表单 FieldTip）」改为精确口径：「`grep -n "<Tooltip\|cursor=" src/components/` 实测 **2 命中**（fields.tsx:169 FieldTip 组件内部实现、ReversePanel.tsx:176 单值说明 Tooltip），均为字段级/数值说明，**不存在图表读数类 Tooltip**」 |
| 4 | V3 第四源漏 fg 字面值 | §3 V3 第四源同步由仅「ref 值同步更新」扩为**四处**：补 `:130` fg 硬编码字面值 `"#A9AEB8"` → `"#A6B0C3"`（该行 name 串内联色随行改写，避免名实不符）及 ref 以脚本 rgba 合成底口径实测值回填 |
| 5 | P7 通配兜底表述不精确 | 冲突裁定清单 P7 行「`*` 选择器不命中伪元素」改为精确表述：兜底块为 `*, *::before, *::after`（常规伪元素已覆盖）；**不被压停的是 `::view-transition-old/new(root)` 等 UA 自定义伪元素**，`*::before` 不匹配它们 |

五处收口后定向确认口径全部落实；本文「修订对照」与本节即 P6 规范终审定案口径，实施状态与收口核验已同步回填宪法 design-language.md §2.1 / §5.5。
