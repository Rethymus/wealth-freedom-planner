# 设计系统对照研究：原则层 / 组件层 / 令牌层（WF-02 交付物输入）

| 项 | 值 |
| --- | --- |
| 文档性质 | 组件级对照矩阵 + 选型 ADR 草案（research 层）：只依据官方文档与本仓实测下结论，不确定处显式标注 |
| 对照对象 | 四家来源：HIG 官方指南四篇（原则层）、TDesign、Ant 系（antd 5.29.3 / ProComponents / antd-mobile）、Semi Design；Arco 2.66.18 为本仓在库基线 |
| 依赖边界 | 不新增运行时依赖——各家均为只读对照（design-atlas-brief.md §八.1）；迁移仅在 ADR 论证收益后渐进 |
| 引用纪律 | 厂商可写库名；含禁词子串的来源域名与术语一律以「文档章节名 / 自然描述」替代（如某动态光学材质机制名不落字面）；HIG 域名字面含禁词，仅引用篇目章节名 |
| 宪法衔接 | 本文任何采纳须走 design-language.md §5.1 三步准入；签名元素 S1–S26 零回退为红线；默认裁定保守（保留 Arco 现状优先） |
| 实测口径 | 本仓行号为本会话 grep/sed 实测；node_modules 为 `@arco-design/web-react@2.66.18`（package.json 依赖 `^2`）；官方文档为本会话抓取（2026-11-21） |

---

## 0. 关键结论（速览）

1. **卸载语义：本仓现状已是对照后的最优解，零迁移。** 三家 Steps 均为纯导航指示器、不承载内容面板，「卸载行为」由应用层决定；Semi Collapsible 默认折叠即销毁 DOM（keepDOM 默认 false）的教训，在本仓两处承载（Tabs `lazyload` 无 `destroyOnHide` + 组间 `hidden` 包裹，AdvancedPanel.tsx:150-171；核心参数 Collapse 未传销毁属性，BasicCalculator.tsx:1089-1090）均已规避。
2. **参数侧栏非模态能力四家齐备，Arco 现状库配置即可满足，无需引入 Semi SideSheet。** Arco Drawer `mask?: boolean` 默认 true 可关（2.66.18 interface.d.ts:95-101 实测）；TDesign `showOverlay`、antd `mask`、Semi `mask` 同理可关；「推开内容」语义仅 TDesign `mode=push` / antd `push` 有，而本仓 ≥1200 双栏并排（BasicCalculator.tsx:501-508）使该语义无刚需。
3. **令牌层不迁移：antd v5 算法化深色与本仓 CSS 变量三源对账是两套不相容架构。** antd 以 CSS-in-JS 运行时从 Seed Token 派生 Map/Alias Token（darkAlgorithm 组合可插拔）；本仓是静态 CSS 变量 + 三源五点对账（design-language.md §5.4）+ 字节门禁硬限。迁移收益（主题自动派生）对「仅两主题、静态产物、尺寸门禁」的本仓为负。

---

## 一、原则层：HIG 四篇 ↔ 本仓宪法映射（A）

> HIG 引用篇目：《Layout》《Disclosure controls》《Materials》《Motion》（官方指南，本会话经其文档数据接口抓取正文；各行为该篇章节要点直译）。本仓锚点为 design-language.md（以下简称宪法）章节与实测行号。

| # | HIG 原则（篇目·章节） | 本仓已有纪律（锚点） | 裁定：已覆盖 / 增量 |
| - | --- | --- | --- |
| A1 | Layout·Visual hierarchy：按重要性排序，最重要内容置顶并靠起始侧 | 宪法原则 1「数字是主角」；全站唯一读数窗每屏一处（§3.1）；四级信息结构 Level 1–4（atlas §一） | 已覆盖 |
| A2 | Layout·Visual hierarchy：对齐便于扫读，缩进表达从属层级 | 发丝线分组承载层级不靠阴影堆砌（宪法 §0）；分组左标线 S7 | 已覆盖 |
| A3 | Layout·Visual hierarchy：相关项分组（留白/容器/分隔线） | 组间 ≥24px 硬规则（§3.3）；`orientation="left"` 带文字分割线 | 已覆盖 |
| A4 | Layout·Visual hierarchy：用渐进披露让界面更干净易交互 | 四级披露纪律（atlas §一 硬约束）；核心参数折叠（BasicCalculator.tsx:1089-1090） | 已覆盖；增量=披露密度验收线（见 A7） |
| A5 | Layout·Visual hierarchy：区分控件与内容（控件层用其光学材质+滚动边缘效果，不铺实底） | hover/pressed 用表面色变化不用海拔动画；「hover 升档到浮层海拔」全站禁止（§3.2） | 已覆盖且更严；控件层光学材质路线不采纳（§五 E8） |
| A6 | Layout·Adaptability：跨尺寸/朝向/多任务优雅一致地适配；字号变化不裁切；尊重安全区 | 响应式五档规格（atlas §四）；<768 折叠与 dock 既有验收；V6 动作权重不对称已登记（§5.6） | 部分覆盖；增量=200%–400% 缩放无裁切的矩阵验证排期在 WF-05（atlas §四 已列明） |
| A7 | Disclosure controls·Best practices：细节延迟到相关时才展示；最常用控件常驻披露层级顶层 | 三组九面板认知分组（AdvancedPanel.tsx:48-76 组序为产品口径）；每组记忆最后激活标签 | 已覆盖；增量=「单视图披露控件密度」可作为 B1/B3 折叠验收线写入 p*-spec |
| A8 | Disclosure controls·Disclosure triangles：披露控件须带描述性标签（如「高级选项」） | Tabs 标题带描述副行悬停提示（AdvancedPanel.tsx:15-16,166 `title={t(p.descKey)}`） | 已覆盖 |
| A9 | Disclosure controls·Disclosure buttons：披露按钮紧邻其展示内容；单视图至多一个（多个徒增困惑） | 核心参数折叠头与折叠内容同卡相邻（BasicCalculator.tsx:1089-1090） | 已覆盖；「至多一个」转 A7 验收线 |
| A10 | Materials：其动态光学材质不进内容层（内容层用标准材质）；须节制；按语义选择而非按颜色观感 | 三层材质只限顶栏/悬浮输出卡/浮层，普通卡片恒实底四档（§3.2）；密集数字表格与图表恒稳定不透明底（atlas §2.1）；语义色只在比较语境每图一维（§3.6） | 已覆盖且更严（本仓材质边界更小） |
| A11 | Materials：材质上叠加保证可读性的文字色；深浅两态都要成立 | 双主题同格：每元素亮深两套值同轮验收（宪法原则 5）；「越高越亮」表面明度差（§3.2） | 已覆盖 |
| A12 | Motion·Best practices：动效要有目的、不得喧宾夺主；漫无目的的动画令人不适 | 宪法原则 2「克制庆祝」；S2 全站唯一 expressive；「最好的动效常不被注意」退役规则（§5.2） | 已覆盖 |
| A13 | Motion：动效可选（optional），不得作为传达重要信息的唯一通道 | reduced-motion 双闸：CSS 通配兜底块 + JS hook，缺一不可（§3.5）；各签名元素降级方案信息不丢（§2 表） | 已覆盖 |
| A14 | Motion：反馈动效简短精准；高频交互避免动效；尽量让人可以打断动效而不必等它播完 | 时长三档快 120/基 240/慢 360；循环动效仅限「状态窗口期」落定即停（§3.5）；S19 悬浮、S26 磁吸按高频豁免纪律未落地/降档 | 部分覆盖；增量=「动效可打断不排队」未成文，建议作为 §3.5 修订候选走 §5.1 |

**原则层小结**：无原则级冲突。增量 3 项——A6 缩放无裁切验证（已排期 WF-05）、A7/A9 披露密度验收线（可入 p*-spec）、A14 动效可打断成文（宪法 §3.5 修订候选，须 §5.1 准入）。

---

## 二、组件层：逐任务场景对照矩阵（B）

> 本仓基线 = Arco 2.66.18；四家对照均为官方文档实证。TDesign 站点为纯前端渲染，其 Drawer API 以官方仓库类型定义文件实证（网页与类型一致性未逐字比对，见 §六）。

### B1 分步引导（人生轨迹规划分步 / 自由刻度首引导）

| 库 | 内容承载 | 卸载/保留语义 | 关键 API（官方文档实证） | 对本仓适配 |
| --- | --- | --- | --- | --- |
| TDesign Steps | 无——纯步骤指示器 | 不承载内容，无卸载问题 | Steps：`current`/`defaultCurrent`（受控+非受控）、`layout` horizontal/vertical、`readOnly`、`separator` line/dashed/arrow、`theme` default/dot、`onChange`；StepItem：`status` default/process/finish/error、`extra` 操作槽、`value` 自定义标识 | 指示条+上下步按钮需应用自组；`extra` 槽可放下一步按钮 |
| antd Steps | 无——items 只配元数据 | 同上，内容切换应用自理 | `items`、`type` default/navigation/inline、`direction`、`current` 0 起、`initial`、`status` wait/process/finish/error、`percent`（process 步内进度显示）、`responsive` 默认 true（<532px 自动垂直）、`labelPlacement`、`onChange` | `percent` 可表达「本步计算中」语义，与本仓「算着呢」反馈同构 |
| Semi Steps | 无——官方「处理进度」示例即应用自理内容切换 | 同上 | `current`、`direction`、`hasLine`、`initial`、`status` wait/process/finish/error/warning、`size`、`type` fill/basic/nav（nav 型官方注明不支持交互）、`onChange`；Step 的 `status`/`icon`/`onClick`；当前步内建 `aria-current="step"` | nav 型形态与本仓分段控件最接近；status 含 warning 与本仓风险语义对齐 |
| 本仓现状 | Radio 分段（3 组）+ 组内 Tabs（AdvancedPanel.tsx:48-76,150-171） | `lazyload` 首展挂载 + `destroyOnHide` 默认 false → 切换不卸载（:7-9 注释口径；tabs.js:76 `lazyload: true` 默认实测）；组间 `hidden` div 驻留（:150-153） | S20 指示条滑动 + S21 数字键切组已落地（design-language §2.1） | 「人生规划分步」实为渐进披露（A4），非强制流程——见 §四 D-B1 |

**B1 结论**：三家 Steps 均不改变卸载语义（内容在应用层），引入只增导航噪音、不换能力；「keepDOM/卸载」问题在 Steps 维度不存在，真正决定保留语义的是 B3 的承载层。

### B2 参数侧栏（无模态遮罩能力）

| 库 | 遮罩开关（默认值） | 非模态附加条件 | 推开/停靠语义 | DOM 保留 |
| --- | --- | --- | --- | --- |
| TDesign Drawer | `showOverlay` 默认 true，可置 false | `preventScrollThrough` 默认 true（防滚动穿透，非模态时应一并关） | `mode` overlay/push——push「推开内容区域」独有 | `destroyOnClose` 默认 false；`lazy` 默认 false；`forceRender` 预渲染；`sizeDraggable` 可拖宽 |
| Semi SideSheet | `mask` 默认 true；官方明示 `mask={false}` 时「允许对外部区域进行操作」 | 必须配 `disableScroll={false}`，否则渲染于 body 时自动锁 body 滚动（官方注意项） | 无推开语义 | `keepDOM` 默认 false（关闭即销毁内部组件）；`getPopupContainer` 可内嵌容器；`motion` 可关 |
| antd Drawer | `mask` boolean 默认 true | 无附加锁滚条款（遮罩关闭即不拦截） | `push` {distance:180} 为多层抽屉推动 | `destroyOnClose` 默认 false；`forceRender`；`getContainer=false` 原地渲染 |
| Arco Drawer（基线 2.66.18） | `mask?: boolean` 默认 true（interface.d.ts:95-101） | 无锁滚条款 | 无推开语义 | 无 destroy 类默认销毁；`closable`/`visible`/`maskClosable`（:105-123）；`placement` 四向（:75）；`width`/`height` 分轴向（:77-84）；无挂载重定向参数，声明处渲染 |

**B2 结论**：非模态是四家通用能力，差异在附带行为——Semi 需显式关 body 锁滚（多一个坑），TDesign 需关防穿透；Arco 现状库 `mask={false}` + `placement`/`width` 即成非模态检视器，且声明处渲染贴合双栏并排布局。「推开内容」仅 TDesign/antd 有，本仓双栏布局下无刚需。

### B3 折叠承载（keepDOM 教训 vs 本仓现状）

| 库/现状 | 折叠时 DOM 行为 | 关键事实（官方文档实证） |
| --- | --- | --- |
| Semi Collapsible | **默认销毁**：`keepDOM` 默认 false——「是否保留隐藏的面板 DOM 树，默认销毁」 | `lazyRender` 须配合 keepDOM 使用；官方 FAQ：父级 `display:none` 时拿不到节点高度、无法展开；`collapseHeight`/`collapseHeightAdaptive`/`duration` 250/`fade`/`reCalcKey` |
| Arco Collapse（基线） | 与 Tabs 同族契约：`lazyload`/`destroyOnHide` 经 CollapseContext 透传（collapse.d.ts:4；item.js:37） | 本仓用法未传 `destroyOnHide`（BasicCalculator.tsx:1089-1090）→ 收起不清 DOM |
| 本仓现状（Tabs+hidden） | 切换标签/分组均不卸载：`hidden` div 驻留 + Tabs `lazyload` 无 `destroyOnHide`（AdvancedPanel.tsx:150-171） | 已运行的模拟结果与表单输入天然保留（:8-9 注释口径）；分享/情景库回填状态不受切换影响（useCalculatorStore.ts:288,297 入链口径） |

**B3 结论**：atlas §八.1 预警的「Semi Collapse 卸载 DOM 的 keepDOM 教训 → 本仓 Tabs hidden 非卸载模式已符合」经本会话逐条实证成立。另注意 Semi FAQ 的反向坑：父级隐藏导致测高失败——本仓 Arco Tabs 的窗格显隐不经高度测量，无此风险。裁定：不迁移，并把「折叠不得销毁 DOM（含表单值/滚动/焦点状态）」写为实施约束。

### B4 时间轴 / 锚点（人生轨迹 / 原理档案）

| 组件 | 能力（官方文档实证） | 对 Atlas 人生轨迹适配度 |
| --- | --- | --- |
| Semi Timeline | `mode` left/right/center/alternate；`dataSource` 数组；Item：`time`/`dot`/`color`/`extra`/`position`/`type` default/ongoing/success/warning/error/`onClick`；官方 ARIA 节注明连线与时间点均 `aria-hidden`（读屏不可达，仅整体 `aria-label` 可达） | 低——人生轨迹核心交互是「拖动年龄刻度同步检视」（atlas §三 时间透镜），是连续输入控件；Timeline 是只读事件列表且节点对读屏不可达（违 atlas §四 图表须非视觉替代口径），承载不动 |
| Semi Anchor | 滚动位置驱动高亮；`getContainer` 默认 window、`targetOffset`/`offsetTop`、`autoCollapse`、`railTheme` primary/tertiary/muted、`scrollMotion` 默认 false、`showTooltip`、`maxHeight` 750px/`maxWidth` 200px；Link `href`/`title`/`disabled` | 原理档案长文侧导航适配良好；但 Arco 同名组件在库在位（es/Anchor 目录实测），等价能力无须跨库 |
| Arco Anchor（基线在位） | 组件包在位（node_modules es/Anchor）；本仓未使用 | 若原理档案需要锚点导航走「Arco 配置启用」（§四 D-B4） |

### B5 表单联动

| 方案 | 语义域 | 关键事实（官方文档实证） |
| --- | --- | --- |
| antd Form `dependencies` | 同一 Form 实例内的字段级校验/重渲联动 | Form.Item `dependencies: NamePath[]`——依赖字段更新自动触发本字段重校验（官方确认密码示例）；`shouldUpdate: boolean \| (prev,cur)=>bool` 控制重渲，官方明示两者不应同用；`validateTrigger` 默认 onChange；跨表单联动经 `Form.Provider` onFormChange/onFormFinish |
| 本仓 store 联动 | 跨面板数据同步 + 分享入链 | zustand 单 store（useCalculatorStore.ts:2）；联动=显式同步标志+action：目标值与基础模式临界值实时联动、手动修改即解绑（:93）；计发月数与退休年龄对照表联动（:98）；联动态以「所见即所得」口径入分享链（:145,288,297） |

**B5 结论**：两者语义不同构（字段校验联动 vs 跨面板数值同步+入链可复现），迁移等于重新发明且丢掉入链一致性；保留现状。同面板内若未来校验联动密度上升，可局部用 Arco 自身 Form 体系，不涉跨库。

### B6 工作台模式

| 组件 | 能力（官方文档实证） | 对本仓适配 |
| --- | --- | --- |
| ProComponents ProCard | `split` vertical/horizontal 分栏、`colSpan` 24 栅格+断点对象响应式、`ghost` 取消内边距与底色、`headerBordered`、`gutter`、`direction` column/row（嵌套子卡）、`wrap`、内建 `tabs` 配置、`variant` outlined/borderless | 分栏布局语义与本仓 ≥1200 双栏（BasicCalculator.tsx:501-508）等价，仅作命名/断点表达参照 |
| StatisticCard | `chart`/`statistic`（内层 antd Statistic，默认 layout=vertical）/`chartPlacement` left|right|bottom/`footer`；Group/Divider/Operation 静态子组件 | 不适配——Statistic 曾因 countUp 无减弱动效参数反采纳（design-language §4）；本仓数字纪律（S3 等宽字排、S18 渐近滚动带可见性闸）已自建且可测 |
| StepsForm（ProForm 分步） | 每步独立 Form 实例、值缓存合并、末步 `onFinish` 返回 true → 重置步数并清空全部表单（官方注释「返回 true 会重置步数，并且清空表单」）；`current`/`stepsProps`/`onCurrentChange`/`allowStepSelect` 默认 false（点击切换且不触发校验）/`stepsRender`/`stepFormRender`/`stepsFormRender`/`layoutRender`/`formRef`/`stepsFormRef`/`formMapRef` | 不适配——「流程强制+末步清态」与「参数改动即时重算、状态全程可逆」（atlas §七 参数变化可取消可重置）语义相斥 |
| 本仓现状 | 双栏左 hero 右面板、输出卡 D9 紧凑模式（<768 折叠）、Grid 栅格（BasicCalculator.tsx:483-508,870-874） | 保留（§四 D-B6） |

### B7 移动结构

| 方案 | 能力（官方文档实证） | 对本仓适配 |
| --- | --- | --- |
| antd-mobile 结构件 | NavBar：「为页面提供全局性的导航功能」，`back`/`backIcon`/`left`/`right`/`onBack`，`--height:45px`；TabBar/SafeArea/FloatingPanel/SideBar 官方文档均在位（仓库 src/components/*/index.zh.md 实证） | 单任务布局（顶导航+内容+底部主操作）的本仓等价物已存在 |
| 本仓 dock 现状 | `wf-action-dock` <768 常驻自然可达区（BasicCalculator.tsx:1143-1144）；「复制分享」为主按钮全宽——跨形态不对称例外已登记（design-language §5.6 V6） | 结构同构，无须引入；TabBar 语义在四任务 IA（atlas §一）下无对应需求（四任务是区域不是平级 Tab 页） |

---

## 三、令牌层：antd v5 算法化深色 vs 本仓三源对账（C）

| 维度 | antd v5（官方《定制主题》文档实证） | 本仓（宪法 §5.4 + 实测） |
| --- | --- | --- |
| 架构 | CSS-in-JS 运行时；`ConfigProvider.theme` 注入 | 静态 CSS 变量；`resolveThemeTokens` 输出（defaults.ts:387）+ `App.tsx` 注入数组（App.tsx:131-134） |
| 派生机制 | Seed Token →（algorithm 展开）→ Map Token → Alias Token 三层派生 | 无派生——双主题各值显式列举，三源五点对账（types.ts ThemeTokens + defaults THEME/THEME_DARK + App 注入 + global.css 双块）防漂移 |
| 暗色实现 | `theme.darkAlgorithm` 预置算法，可与 `compactAlgorithm` 组合（如 `[darkAlgorithm, compactAlgorithm]`）；多主题可并存 | Arco 侧以 body `arco-theme` 属性挂官方变量组（App.tsx:179 实测，为其样式表深色规则唯一挂点）；本仓变量 `:root[data-theme="dark"]` 双块（App.tsx:131 注释） |
| 组件级定制 | `theme.components` 按组件覆盖；组件级 algorithm 默认 false（只覆盖不派生），5.8.0+ 可传自定义算法 | 组件不感知主题：取色一律经 `resolveThemeTokens`，样式挂类用令牌，禁直写（宪法 §4） |
| 消费方式 | `useToken` hook / `getDesignToken` 静态方法 | CSS 变量直读 + tokens 对象 |
| 迁移成本 | — | 引入 CSS-in-JS 运行时与「单运行时 + 字节门禁硬限」冲突（p6 实测 2,001,800 B 超 2,000,000 B 即降档的先例）；主题值需重新入三源对账=两套事实来源并存；动态派生对「仅两主题」是冗余能力 |
| 迁移收益 | 新增语义色自动成梯度、多主题并存 | 本仓新增令牌频率低，五点同步已清单化流程化；atlas §2 令牌演进提案本就走宪法 §5.1 准入，不依赖派生引擎 |

**C 结论**：不迁移（ADR D-C）。antd 的 Seed/Map/Alias 分层与「组件级只覆盖不派生」思想仅作语义参照；令牌演进按宪法 §5.1 以六色提案逐对验证对比度后增量落地（atlas §2.1 色彩纪律）。

---

## 四、选型 ADR 草案（D）

> 三选一口径：保留 Arco 现状 / Arco 配置启用 / 少量自研抽象。默认保守；每条给重审条件，避免一次裁定终身化。

| 场景 | 建议 | 理由 | 重审条件 |
| --- | --- | --- | --- |
| D-B1 分步引导 | 少量自研抽象 | 人生轨迹「分步」实为渐进披露（A4/A7）：现有 Radio 分段+Tabs 已承载且带 S20/S21；三家 Steps 均无内容承载，引入只增导航噪音。自研件=分段控件+进度指示，挂既有令牌与 S1/S2 语义 | 出现真正的强制流程（如分享导入向导、多步数据接入）时重评 |
| D-B2 参数侧栏 | Arco 配置启用 | Drawer `mask={false}`+`placement`/`width` 即成非模态检视器（interface.d.ts:95-101 实测）；声明处渲染贴合双栏；跨库引入 Semi SideSheet 反而背上 body 锁滚显式关（B2 表） | 需要「推开内容」动效（TDesign mode=push 独有）或抽屉可拖宽（sizeDraggable）时重评 |
| D-B3 折叠承载 | 保留 Arco 现状 | hidden 非卸载已是既定且验收过的形态（B3 表）；Semi keepDOM 默认销毁是反向教训；「折叠不销毁 DOM」写入实施约束 | 某折叠内容首挂成本被实测证明过高时，用 Arco Tabs 内建 `lazyload`（首展挂载）而非跨库 |
| D-B4 时间轴/锚点 | 拆分裁定 | 原理档案锚点导航=Arco 配置启用（Anchor 在库未用）；人生轨迹=少量自研（时间透镜是连续刻度交互，Timeline 只读且节点读屏不可达） | 时间透镜若改为「事件卡片流」展示形态，重评 Timeline 语义（仍优先 Arco Timeline 同类能力） |
| D-B5 表单联动 | 保留 Arco 现状 | store 显式同步标志覆盖跨面板联动且入链可复现（useCalculatorStore.ts:93,98,145）；dependencies 语义域不同（B5 表） | 同面板字段校验联动密度显著上升时，局部启用 Arco Form 体系声明式校验 |
| D-B6 工作台 | 保留 Arco 现状 | 双栏+Card 与 ProCard 分栏语义等价；StatisticCard 与本仓 Statistic 反采纳先例+数字纪律冲突；StepsForm 与实时重算相斥 | WF-03 后工作台密度不足时，先试 Grid/容器查询，再谈组件层 |
| D-B7 移动结构 | 保留 Arco 现状 | dock 已覆盖 NavBar+底部主操作语义且例外已登记（§5.6 V6）；TabBar 无对应 IA 需求 | 出现平级多任务切换需求（当前四任务 IA 不存在）时重评 |
| D-C 令牌架构 | 保留 Arco 现状 | 见 §三 C 结论 | 若未来主题数 >2 或需要运行时主题热切换能力，重评派生引擎 |

---

## 五、反采纳清单（E）

| # | 不采纳项 | 理由（证据锚点） |
| --- | --- | --- |
| E1 | Semi Collapsible 的默认销毁行为（keepDOM=false 折叠即销毁） | 折叠丢表单值/滚动/焦点；本仓承载全为非卸载（B3 表）；官方 FAQ 另有父级隐藏测高失败坑 |
| E2 | antd v5 运行时主题引擎（CSS-in-JS 派生）整体迁移 | §三 成本收益裁定；门禁硬限与两套事实来源风险 |
| E3 | ProComponents 整包引入（ProCard/StatisticCard/StepsForm） | 运行时依赖红线（atlas §八.1）；三者仅作模式参照（D-B6） |
| E4 | antd-mobile 结构件引入（NavBar/TabBar 等） | dock 等价且宪法例外已登记（B7 表；§5.6 V6） |
| E5 | 三家 Steps 组件引入 | 均无内容承载、与本仓分段+Tabs 能力重叠（B1 表）；Semi nav 型只读、TDesign dot 型仅形态差异 |
| E6 | Semi Timeline 承载人生轨迹 | 只读展示+节点读屏不可达，与时间透镜连续交互及无障碍口径相斥（B4 表） |
| E7 | antd Form `dependencies` 迁移为全局联动机制 | 语义域是单表单字段校验联动，非跨面板数据同步（B5 表） |
| E8 | HIG 动态光学材质路线（控件层大面积光学材质） | 宪法三层材质边界更严：材质只限顶栏/悬浮卡/浮层，密集数字恒稳定不透明底（A5/A10；atlas §2.1） |
| E9 | Semi SideSheet 引入 | 非模态能力 Arco Drawer 同样具备（B2 表），引入无增益且多锁滚副作用 |
| E10 | TDesign Drawer 的 push 模式追随 | 「推开内容」在双栏并排布局下无刚需（B2 表）；仅登记为 D-B2 重审条件 |
| E11 | 组件库整体替换（Arco 单库更换为任一家或多家并存）（评审复核轮补登） | 运行时依赖红线（atlas §八.1）＋尺寸门禁硬限（跨库引入直接侵蚀 p6 收口后 135 B 量级余量）＋三源五点对账与既有七面板全量回归的重建成本；本表 E1–E10 逐项封禁的是单点组件/机制引入，未覆盖「换库本体」这一最强诱惑项，故补登总括项。三家对照（§二/§三）的结论均为「本仓现状等价或更优」，不构成换库依据 |

---

## 六、证据来源与未核验项

**官方文档（本会话 2026-11-21 抓取）**

- HIG 官方指南四篇（经其文档站数据接口取正文；域名字面含禁词故不落 URL，仅记篇目）：《Layout》——章节 Visual hierarchy / Adaptability / Size classes（2026-09-09 更新版）；《Disclosure controls》——Best practices / Disclosure triangles / Disclosure buttons / Platform considerations；《Materials》——材质两分（动态光学材质章按本仓命名纪律以自然描述代称）/ Standard materials；《Motion》——Best practices / Providing feedback。
- TDesign 官方站《Steps 步骤条》Steps Props / StepItem Props 表；《Drawer 抽屉》API 以官方仓库 `packages/components/drawer/type.ts` 实证（`showOverlay`/`mode`/`destroyOnClose`/`lazy`/`sizeDraggable` 等逐项注释默认值）。
- Semi Design 官方站：《Steps 步骤》《SideSheet 滑动侧边栏》《Collapsible 折叠》《Timeline 时间轴》《Anchor 锚点》——各篇 API 参考 + 代码演示 + FAQ 节。
- Ant 系：antd 官方仓库 5.29.3 标签 zh-CN 文档（components/drawer、components/steps、components/form、docs/react/customize-theme）；ProComponents 官方仓库 `src/card/typing.ts`、`src/card/components/StatisticCard/index.tsx`、`src/form/layouts/StepsForm/index.tsx`（types 文件与组件实现）；antd-mobile 官方仓库 `src/components/nav-bar/index.zh.md` 及 tab-bar/safe-area/floating-panel/side-bar 组件目录。
- 本仓：`package.json`（依赖 `^2`）；node_modules `@arco-design/web-react@2.66.18`（Drawer interface.d.ts:95-101、Tabs interface.d.ts:114-120 与 tabs.js:76、Collapse collapse.d.ts:4 与 item.js:37、ConfigProvider interface.d.ts:70,176、es 样式表 arco-theme 选择器）；src/components/AdvancedPanel.tsx:7-9,48-76,150-171；src/components/BasicCalculator.tsx:5,35,483-508,870-874,1089-1090,1143-1144；src/store/useCalculatorStore.ts:2,93,98,145,288,297；src/App.tsx:131-134,179；src/data/defaults.ts:387；docs/design-language.md §3/§4/§5.4/§5.6；docs/design-atlas-brief.md §一/§三/§四/§八。

**未核验 / 局限（如实声明）**

- TDesign Drawer 官方网页版 API 表未逐字比对（站点纯前端渲染，本次以官方仓库类型定义文件实证，二者由同一脚本生成、口径一致性未独立复核）。
- antd 主分支（v6 线）`mask` 已变对象形态、`destroyOnClose`/`maskClosable` 标记弃用——仅记录为前瞻信号，本文裁定全部基于 v5 5.29.3。
- HIG 各篇为英文原文直译要点；平台细则（visionOS/watchOS 章）与本仓 Web 形态无关，未纳入矩阵。
- ProComponents 站点网页未抓成（前端渲染 + 抓取服务当时不可用），API 以官方仓库源码/类型文件实证；两者若出现差异以站点发布版为准。

---

## 七、修订说明（评审复核轮，2026-11-22）

评审结论逐条处置（编号按评审单顺序）：

| 结论 | 处置 | 落点与依据 |
| --- | --- | --- |
| 结论 1（反采纳缺「整库迁移」项） | **吸收（来源侧补登）** | §五 补登 E11「组件库整体替换」为总括禁入项，与 ADR-001 §4 E11 逐字对应（ADR 为正式登记、本文为研究层来源）；E1–E10 原条目零改动 |
| 结论 2 / 3 / 4 / 5 / 6 | 不涉本文 | 分别落在令牌演进表、原型规格、ADR D-B2、令牌演进表（数值与行号），见各自文末修订说明 |
