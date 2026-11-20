# 无障碍专项研究（research-a11y）

> 版本：v1.0（2026-11-20）
> 范围：本应用「财富自由规划工具」全部界面——顶栏 / 基础计算（输出卡 + 敏感性）/ 高级面板九件套 / 六张图表 / 表格 / 提示与弹层。
> 核心立场：**无障碍不是验收前的补丁清单，而是与既有设计令牌体系同源的结构性约束**——焦点环用 `--wf-focus-ring` 令牌、对比度用设计规范 5.3 的同一套公式、实时播报复用防抖口径的「只在落定值发声」。
> 门禁声明：外部规范一律以中性来源标签标注（源 A、源 B），表述为「业界无障碍规范」，不出现平台 / 公司 / 产品品牌名；组件库口径以本仓 `node_modules` 源码实证（源 C），比官方文档更贴近本仓锁定版本。抓取时间 2026-11-20，原始 URL 因门禁「全程中性表达」未收录，来源对应关系见 §10。
> 本会话已执行的核查：规范条款研读（源 A 全文抓取）、组件库源码核查（源 C 逐文件 grep / 通读）、业务代码盘点（源 E）、对比度公式 Node 复测（§6.4 实测表）。**未执行**：真实读屏走查、axe 类自动化扫描、真实浏览器 Tab 遍历——三者列为 §8 各采纳项落地后的验证方法。

---

## 0. 摘要

1. **键盘可达**：组件库原生能力超出预期——折叠头自带 `role="button"` + `aria-expanded` + `tabIndex=0` + Enter 触发（源 C 折叠 item 源码），开关是原生 `button[role="switch"]`，数字输入是 `role="spinbutton"` + `aria-valuenow/min/max`，下拉选项有 `role="option"` + 方向键热区，Popconfirm 自带 Esc 关闭 + 焦点锁 + 归还焦点。**需补的只有五件**：跳过链接与地标缺失（布局组件渲染为 `section`，无 banner/main/contentinfo）、折叠头无令牌化焦点环、字段提示图标 hover-only 键盘不可达、Radio 组缺 `name` 属性（方向键组内循环依赖它）、吸附条对聚焦元素的遮挡需按新条款 2.4.11 核查（§2）。
2. **语义与 aria**：顶栏 aria-label 全覆盖（含组件库白名单绕行的补写机制）；**面板内缺口集中在四处**——两处无名称开关、场景名称输入仅占位符、数字字段错误提示与输入无 `aria-describedby` / `aria-invalid` 关联。`role` 适用表见 §3.2，全部命中组件库原生或一处补写（§3）。
3. **实时区域**：业界口径（源 B）`aria-live="polite"` + `aria-busy` 防中间值；本项目防抖架构天然满足「防抖期间不播报中间值」——结果只在 300ms 防抖后落定进 state，rAF 数值滚动的中间帧**不落 store**。口径：live 节点只绑落定值（绑 `data.criticalValue` 而非 `animatedCritical`），手动运行型面板补「计算完成」播报；维持设计规范 5.4「大数字不引入 aria-live」的**修订版口径**并说明差异（§4）。
4. **图表文本替代**：六张图表全部已有 `role="img"` + 摘要句 aria-label，且五张有可见数据表（Descriptions / 数值行）作长描述——50 条蒙特卡洛路径**不进**替代文本，替代口径为「摘要统计 + 分位数 + 中位终值」，与业界「摘要 + 可行处提供数据表」口径一致（源 A 1.1.1 示例原文）。结论：现状达标，仅登记口径为文档（§5）。
5. **对比度**：设计规范 5.3 已给出双主题双口径（常态合成底 + 最不利透底）全表与浅色语义色显式豁免；本会话以 WCAG 相对亮度公式 Node 复测 14 组令牌对，**数值全部复现**（§6.4）。给出可执行的审计脚本口径：相对亮度公式 + rgba 合成底公式 + 浏览器 computed-style 走查脚本（字号 / 字重自动判 4.5:1 或 3:1 阈值）（§6.3）。
6. **触控与运动**：44px 触控目标与 prefers-reduced-motion 双通道降级均为现状已达标；ask 点名的「Canvas 导出按钮」「PWA 更新提示」**实证不存在**（grep + package.json 核查），无遗漏项；登记一条观察项（Message 提示 3s 自动消失时序）（§7）。
7. **采纳清单**：§8 共 12 条（10 条代码 / 样式改动 + 2 条文档 / 观察项），每条含主题 → 具体改动 → 涉及文件 → 验证方法 → 规范依据。

---

## 1. 现状盘点（代码实证）

### 1.1 已达标项（无需改动，列出作为基线）

| 能力 | 现状证据 |
| --- | --- |
| 顶栏控件可访问名称 | 币种 / 语言 Select 经 id 定位补写 aria-label（`src/App.tsx:158-161`，绕过组件库 select-view 白名单过滤）；色盲开关 aria-label 直写（`src/App.tsx:249`）；主题按钮 aria-label + title 随状态切换目标主题（`src/App.tsx:272-273`） |
| 折叠组件键盘 | 折叠头渲染 `role="button"` + `aria-disabled` + `aria-expanded` + `tabIndex: 0` + Enter 触发（组件库 `node_modules/@arco-design/web-react/es/Collapse/item.js:57-67` 与 `es/_util/hooks/useKeyboardEvent.js:4-28`） |
| 开关语义 | 原生 `button` + `role="switch"` + `aria-checked`（`es/Switch/index.js:92`） |
| 数字输入语义 | `role="spinbutton"` + `aria-valuemax/aria-valuemin/aria-valuenum`（`es/InputNumber/index.js:234`） |
| 下拉语义 | 选项 `role="option"` + `aria-selected`（`es/Select/option.js:54-55`）；弹层与视图带方向键热区（`es/Select/select.js:517,555`） |
| 单选语义 | 原生 `input[type=radio]` 包在 `label` 内（`es/Radio/radio.js:55-97`） |
| 确认弹层 | Popconfirm 自带 `escToClose` + `focusLock`（锁定焦点 + 关闭后归还）（`es/Popconfirm/index.js:62,114`） |
| 错误 / 提示播报 | Alert 渲染 `role="alert"`（`es/Alert/index.js:90`）；Message 通知渲染 `role="alert"`（`es/_class/Notice.js:139,149`）——错误提示与成功提示读屏可即时感知 |
| 图表替代 | 六张图表 `role="img"` + 摘要句（§5.2 逐张盘点） |
| 展开控件状态 | 敏感性 / 明细拆解展开按钮带 `aria-expanded`（`src/components/BasicCalculator.tsx:166,523`）；预设按钮带 `aria-pressed`（`src/App.tsx` 无、`src/components/BasicCalculator.tsx:590`） |
| 装饰元素 | sticky 锚点 `aria-hidden`（`src/components/BasicCalculator.tsx:452`） |
| 焦点环 | `:focus-visible` 才出环，令牌 `--wf-focus-ring` / 顶栏 `-dark` 变体（`src/styles/global.css:374-387`） |
| 触控目标 | 44px 档：按钮 / 输入框 / 顶栏下拉 / 开关（`src/styles/global.css:399-420`）+ 点击区扩展包装（`:422-436`）+ P3 D6 补齐预设按钮与折叠头（`:884-889`） |
| 减弱动效 | CSS 通配全停 + 逐选择器清单（`src/styles/global.css:507-535`）；JS 通道 `usePrefersReducedMotion` 短路 rAF 与图表动画（`src/components/hooks.ts:138-148`、`src/components/hooks.ts:189-196`） |
| 表单错误文本 | 越界值不落库 + 保留显示 + 文本错误提示（`src/components/fields.tsx:63-76,102-110`），符合「错误以文本描述」要求 |
| 对比度口径 | 双主题双口径全表 + 浅色语义色显式豁免登记（`docs/design-spec.md` §5.3） |

### 1.2 缺口清单（§8 采纳清单的来源）

| # | 缺口 | 证据 |
| --- | --- | --- |
| G1 | 无地标：布局组件渲染为 `section`，无 banner / main / contentinfo | 组件库 `es/Layout/index.js:68`（`createElement("section", …)`，`rest` 透传任意属性） |
| G2 | 无跳过链接 | 全仓无 skip link（grep 实证）；顶栏 5 个可交互控件 + 两条 Alert 先于主内容 |
| G3 | 折叠头无令牌化焦点环 | `src/styles/global.css:391-397` 仅定义按压过渡；`:focus-visible` 环只挂 `.wf-pressable` 与输入框 |
| G4 | 字段提示图标 hover-only，键盘不可达 | `.wf-field-tip` 为非聚焦 `span`（`src/components/fields.tsx:85-88` 等 5 处），组件库 Tooltip 支持 `trigger: 'focus'`（`es/Trigger/interface.d.ts:97`）但未启用 |
| G5 | 数字字段错误 / 提示无程序关联 | `src/components/fields.tsx:91-110`：InputNumber 未传 `aria-invalid` / `aria-describedby`，错误文本节点无 id |
| G6 | 两处开关无可访问名称 | 「计划要孩子」开关（`src/components/BasicCalculator.tsx:643-648`）、阈值冻结开关（`src/components/advanced/MonteCarloPanel.tsx:418-421`）均无 aria-label，相邻文字未程序关联 |
| G7 | 场景名称输入仅占位符 | `src/components/advanced/ScenarioPanel.tsx:170-177`：`placeholder` 兼作唯一名称来源 |
| G8 | Radio 组缺 `name` | 六处 `Radio.Group` 均未传 `name`（`LoanPanel:117` / `AccumulationPanel:216` / `MonteCarloPanel:317,346,568,577`）；组件库仅在有 `name` 时透传（`es/Radio/radio.js:96`），原生方向键组内循环依赖同组同名 |
| G9 | 计算结果无实时区域 | 设计规范 5.4 显式「大数字不引入 aria-live」（`docs/design-spec.md` §5.4）；手动运行型（蒙特卡洛 / 序列）完成态无播报节点 |

---

## 2. 主题一：键盘可达

### 2.1 业界规范口径（源 A：业界无障碍规范 WCAG 2.2 及官方理解文档，2026-11-20 抓取）

| 条款 | 等级 | 口径要点 |
| --- | --- | --- |
| 2.1.1 键盘可用 | A | 全部功能可经键盘完成（本项目全 DOM 顺序聚焦，无拖拽必需交互——2.5.7 拖拽条款自动满足） |
| 2.4.1 绕过重复内容块 | A | 充分技术 G1「页首直达主内容区链接」/ ARIA11「ARIA 地标」；官方理解文档明确：跳过链接 + 地标是两种可并用机制 |
| 2.4.3 焦点顺序 | A | 焦点顺序须保持含义与可操作性——DOM 顺序即 Tab 序 |
| 2.4.7 焦点可见 | AA | 焦点指示器可见；1.4.11 补充：作者定制的焦点指示器对相邻底色须 ≥3:1 |
| **2.4.11 焦点不被遮挡（最低）** | **AA（2.2 新增）** | 「组件获得键盘焦点时不因作者内容而整体被遮挡」——官方示例点名 sticky 页脚 / 横幅场景；用户主动打开的内容遮挡不算 |
| 2.4.13 焦点外观 | AAA（建议项） | 指示器面积 ≥ 组件 2px 周长、聚焦 / 未聚焦同像素对比 ≥3:1——本仓 4px 环宽已超其建议尺寸，可作自评基准 |
| 2.5.8 目标尺寸（最低） | AA（2.2 新增） | 24×24 CSS px 或间距豁免——本仓 44px 档**高于**规范下限，维持现状即达标 |
| 1.4.13 悬停内容 | AA | 悬停触发的内容须可关闭（Esc）、可悬停进入、持久显示；且内容本身须键盘可达 |

### 2.2 本项目对照

- **Tab 序与自然决策流一致性：达标**。DOM 顺序 = 输出卡（置顶）→ 输入卡（预设 → 字段 → 核心参数折叠 → 分享），与视觉与决策顺序一致（`src/components/BasicCalculator.tsx:449-762`）；高级面板九个折叠头按业务序排列（`src/components/AdvancedPanel.tsx:26-53`）。无 `tabIndex` 正数（grep 全仓 0 命中），无自定义焦点劫持。
- **折叠 / 下拉 / 开关**：组件库原生能力已覆盖（§1.1 表），**无需补键盘逻辑**；唯一缺的是折叠头的**可见焦点环**（G3）：浏览器默认 outline 在半透明卡面与浅色页底上对比不稳，且与令牌体系不一致。
- **跳过链接与地标**：单页应用也存在「重复块先于主内容」的 Tab 成本——顶栏 5 个控件（2 Select × 下拉多选项、2 开关、1 按钮）+ 2 条 Alert；ARIA11 地标 + G1 跳链并用（G1/G2）。
- **2.4.11 焦点遮挡**：三处吸附内容需走查——顶栏（md+ sticky，`global.css:163-168`）、悬浮输出卡（sticky + 吸附态，`global.css:186-233`）、底部操作条（<768 sticky，`global.css:960-991`）。键盘 Tab 向下滚动时浏览器会把聚焦元素滚入视口，但**滚入后仍可能被底部吸附条覆盖**——规范只要求「不整体被遮挡」（部分可见即过），实测口径见 A9。
- **1.4.13 悬停内容**：字段提示 Tooltip（G4）违反「键盘可达」——提示内容对键盘用户不可触发。

### 2.3 结论

组件库原生键盘能力 + 现有 DOM 顺序已满足 2.1.1 / 2.4.3 / 2.5.8 / 2.5.7；补 A1（地标 + 跳链）、A5（Tooltip 键盘触发）、A6（折叠头焦点环）、A7（Radio name）、A9（2.4.11 走查）五项即覆盖本主题全部缺口。

---

## 3. 主题二：语义与 aria

### 3.1 既有 aria-label 覆盖盘点

| 区域 | 控件 | 名称来源 | 状态 |
| --- | --- | --- | --- |
| 顶栏 | 币种 Select | id 补写 aria-label（`App.tsx:159`），随语言重跑 | ✅ |
| 顶栏 | 语言 Select | 同上（`App.tsx:160`） | ✅ |
| 顶栏 | 色盲友好开关 | aria-label 直写（`App.tsx:249`，组件库 Switch 透传 aria） | ✅ |
| 顶栏 | 主题按钮 | aria-label + title 随状态给**目标主题**（`App.tsx:272-273`） | ✅ |
| 输出卡 | 敏感性展开按钮 | 文字按钮自带名称 + `aria-expanded`（`BasicCalculator.tsx:162-170`） | ✅ |
| 输出卡 | 明细拆解按钮（<768） | 同上（`BasicCalculator.tsx:519-527`） | ✅ |
| 输出卡 | 进度环 SVG | `role="img"` + aria-label（`BasicCalculator.tsx:293-297`，环面文字为装饰重复） | ✅ |
| 输入卡 | 「计划要孩子」开关 | **无名称**（G6） | ❌ |
| 高级面板 | 阈值冻结开关 | **无名称**（G6） | ❌ |
| 场景面板 | 名称输入 | 仅 `placeholder`（G7） | ❌ |
| 全部数字字段 | InputNumber | 组件库 `role="spinbutton"` 就位，但**无 label 关联 / 无 aria-invalid / 无 aria-describedby**（G5） | ⚠️ |

### 3.2 role 适用表（本项目全部控件类型 × 应有语义 × 现状）

| 控件 | 应有 role / 状态 | 现状载体 | 需补 |
| --- | --- | --- | --- |
| 折叠面板头 | `button` + `aria-expanded` | 组件库原生（源 C） | 仅焦点环样式（A6） |
| 折叠内容区 | （无强要求；`aria-controls` 为增强项） | 未设 | 不补（现状展开状态已可感知） |
| 开关 | `switch` + `aria-checked` + 可访问名称 | 组件库原生前两者 | 两处补 aria-label（A3） |
| 下拉选择 | combobox → listbox/option | 组件库原生 + id 补写名称 | 无 |
| 数字输入 | `spinbutton` + `aria-valuenow/min/max` + `aria-invalid` + `aria-describedby` | 组件库原生前三者 | 关联三件套（A2） |
| 单选组 | 原生 radio 组（`name` 同组）+ 组名 | 原生 input 就位 | 补 `name`（A7）；组名经相邻文字或 `aria-label` 为增强项 |
| 图表 | `img` + 名称（+ 长描述） | 已全量（§5） | 无 |
| 进度环 | `img` + 名称 | 已有（§3.1） | 无 |
| 错误 Alert | `alert`（隐含 live 区域 assertive） | 组件库原生 | 无 |
| 成功 Message | `alert` | 组件库原生 | 无（时序观察项 A12） |
| 页面区域 | `banner` / `main` / `contentinfo` | `section`（无语义） | A1 |
| 布局组件属性透传 | —— | `rest` 直落 `section`（源 C 实证） | `role` 属性可直传，无需换组件 |

### 3.3 表单错误提示的 aria 关联口径（G5 详述）

业界口径（源 A，3.3.1 错误识别官方理解文档）：错误须以文本识别并描述（**现状已满足**——`fields.tsx:102-110` 的 `field.errorRange` 文案含 min/max）；官方理解文档同时指出「程序化错误状态与错误信息的关联由 4.1.2 与 1.3.1 承载」——这正是现状缺口。补法：

1. `useId()` 生成 `labelId` / `hintId` / `errorId` 三个稳定 id；
2. 标签 `Text` 挂 `id={labelId}`；提示 / 错误节点恒渲染容器并挂对应 id（错误与提示互斥渲染，`aria-describedby` 指向当前可见者）；
3. InputNumber 传 `aria-labelledby={[labelId, instanceId]}` 或 `aria-label={label}` + `aria-describedby={invalid ? errorId : hintId}` + `aria-invalid={invalid}`（InputNumber 把 `rest` 透传给内部 Input，源 C `es/InputNumber/index.js:234`，aria 属性可直达 DOM）；
4. 前缀 / 后缀（币种符号、单位）信息已由 `aria-label` 文案吸收（`suffix` 文案并入标签名），避免 spinbutton 名称缺单位。

---

## 4. 主题三：实时区域

### 4.1 业界口径（源 B：ARIA 实时区域属性参考文档，2026-11-20 抓取）

- `aria-live="polite"`：更新在**当前任务的自然停顿处**播报（「如读完当前句、用户停止键入时」）——官方原文明确把「用户键入停顿」列为 polite 的播报时机，与本项目防抖语义同构；
- `aria-busy`：多段更新进行中置 true，完成后置 false 再落值——「防止更新仍在进行时播报」的规范机制；
- `assertive` 会清空播报队列打断当前任务，官方警告「除非迫不得已不得使用」——本项目全部采用 polite；
- 常见错误模式：把**动画中间帧**写进 live 节点（每帧一次播报）——live 节点必须只承载终值。

### 4.2 本项目播报口径推导

| 数据流 | 时序事实（源 E） | 口径 |
| --- | --- | --- |
| 逐键防抖结果（临界值 / 进度环 / 龙卷风 / 敏感性） | `useFinanceCall` 防抖 300ms 后才 `setState`（`hooks.ts:36-67`）；rAF 数值滚动中间帧只存在于 `useAnimatedNumber` 本地 state，**不进 store、不触发防抖链路**（`hooks.ts:174-239`） | live 节点绑定**落定值**（`data.criticalValue`，非 `animatedCritical`）→ 防抖窗口内 live 节点内容不变（中间值从未进 DOM），键入期间零播报；落定后 polite 播报一次。**「防抖期间不播报中间值」由架构天然保证，无需新增防抖逻辑** |
| 进度环百分比 | 与临界值同源同帧落定（`BasicCalculator.tsx:379-383`） | 并入同一条播报句，不单设节点 |
| 手动运行型（蒙特卡洛 / 序列对照 / 打工模拟） | 点击 → `running=true` → 计算 → 结果一次性落 state（`MonteCarloPanel.tsx:216-233`） | run 按钮区挂 `aria-live="polite"` 节点：进行中不播报（loading 文字已有 Spin + 文本），**完成时播报一句汇总**（耗尽概率 + 中位终值）；错误已由 `role="alert"` 的 Alert 承载，无需 live |
| 主题切换 / 币种切换 | 视觉偏好 | 维持设计规范 5.5「不广播」口径（`docs/design-spec.md` §5.5） |

### 4.3 与设计规范 5.4「大数字不引入 aria-live」的关系

设计规范 5.4 的现状口径针对的是「**大数字视觉元素**不作 live 源」——rAF 中间帧与频繁抖动是当时担心的噪声源，判断正确且保留：`wf-big-number` 元素本身**不加** live 属性。本次修订的是**补充而非推翻**：另设一个视觉隐藏（sr-only）live 节点承载落定值，与视觉层解耦。防噪三规则成文：

1. **只播落定值**：live 节点数据源为防抖 / 运行完成后的最终值，动画帧与防抖窗口内值不进节点；
2. **polite + `aria-atomic="true"`**：整句播报、不打断；
3. **节点常驻、内容替换**：live 区域须在页面加载时即存在（源 B：动态插入的 live 节点可能不被监听），更新时替换其文本内容而非插入节点。

---

## 5. 主题四：图表文本替代

### 5.1 业界口径（源 A：1.1.1 非文本内容官方理解文档）

数据图的替代口径原文：「短标签说明图表类型，更长描述给出与图表可比拟的高层摘要、趋势与含义；**可行且实用处提供实际数据表**」。等价性以「用途」为准，不要求逐点复刻——蒙特卡洛 50 条路径逐条成表不可读也无用途，**摘要统计 + 分位数表**即等价替代。

### 5.2 六图逐张盘点（现状全部达标）

| 图表 | 短标签（role="img" + aria-label 摘要句） | 长描述 / 数据表 | 证据 |
| --- | --- | --- | --- |
| 蒙特卡洛路径图 | 「{{paths}} 条路径模拟 {{years}} 年，耗尽概率 {{prob}}%、中位终值 {{median}}」——统计三要素齐全 | 可见 Descriptions：中位终值 / p5–p95 分位 / 路径数 × 年数 / 初始支取率 / 末年支取三分位 | `MonteCarloPanel.tsx:819-829`、`:779-814`；locale `mc.chartAria` |
| 序列命运曲线图 | 「最好、中位、最差三条逐年路径，{{count}} 窗口 × {{years}} 年」 | Descriptions 三联行（各窗口起点年 + 期末倍数 + 耗尽年） | `MonteCarloPanel.tsx:653-704`、`:707-727` |
| 龙卷风图 | 「六档月开销对应的参考线，按偏离幅度降序，虚线为基准」 | 图下分组数值行（六档临界值逐行） | `BasicCalculator.tsx:187-261` |
| 瀑布图 | 「从年毛租金逐项扣减到年净现金流」 | 图上方 Descriptions 年度明细（窄屏下信息无损兜底） | `RentalPanel.tsx:594-641` |
| 打工积累模拟图 | 「{{paths}} 条路径模拟 {{years}} 年，达成概率 {{prob}}%」 | Descriptions 统计行 | `AccumulationPanel.tsx:498-540` |
| 自由刻度进度环 | 「已有资产约为参考线的 {{pct}}%」+ 图旁可见 caption 同文 | ——（单值图形，摘要即全部信息） | `BasicCalculator.tsx:286-324`、`:486-490` |

**50 条路径不进替代文本**的口径已由现状隐含（aria 摘要句只含统计量），本次将其显式成文（A11）：替代三件套 = 摘要句（类型 + 样本量 + 关键统计量）+ 可见数据表（分位数 / 关键行）+ 图注（读图说明）；逐路径数据不提供文本替代（等价性由统计量承载）。

---

## 6. 主题五：对比度与自动审计方法

### 6.1 业界口径（源 A：1.4.3 对比度（最低）与 1.4.11 非文本对比官方理解文档）

- 正文与图像文字 ≥ **4.5:1**；大字（≥24px，或 ≥18.5px 粗体——官方换算 14pt ≈ 18.5px / 18pt ≈ 24px）≥ **3:1**；
- 用户界面组件的识别性视觉信息（含边框、选中态、**焦点指示器**）与图形对象 ≥ **3:1**（1.4.11）；
- 两条款均明确「阈值为下限，**不得四舍五入**（4.499:1 不达标）」——审计脚本判定用 `>=` 且保留三位以上小数；
- 半透明底按「与实际透底合成后的颜色」计算——本仓设计规范 5.3 的「常态合成底 + 最不利透底」双口径与业界口径同构（源 D）。

### 6.2 公式（审计脚本的数学口径）

相对亮度（sRGB → 线性化）：

```text
L = 0.2126·R + 0.7152·G + 0.0722·B
R,G,B = c/255，当 c/255 ≤ 0.03928 取 c/12.92，否则 ((c/255+0.055)/1.055)^2.4
对比度 = (L亮 + 0.05) / (L暗 + 0.05)
```

rgba 合成（半透明层叠不透明底）：`out = α·fg + (1−α)·bg`（逐通道）。

### 6.3 浏览器 computed-style 走查脚本口径（自动审计）

在目标页面控制台执行（口径与 §6.2 一致；中性实现，无外部依赖）：

```js
(() => {
  // 相对亮度（§6.2 公式）
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => (s.match(/[\d.]+/g) ?? ["255", "255", "255", "1"]).map(Number);
  // rgba 合成：fg 叠在 bg 之上（逐通道），结果恒不透明
  const over = (fg, bg) => {
    const a = fg[3] ?? 1;
    return [0, 1, 2].map((i) => a * fg[i] + (1 - a) * bg[i]).concat([1]);
  };
  // 元素底色：自元素沿祖先逐层合成到不透明（半透明卡面底按最不利透底实算）
  const bgOf = (el) => {
    let acc = [255, 255, 255, 1]; // 兜底白（页面底）
    let node = el;
    while (node) {
      acc = over(parse(getComputedStyle(node).backgroundColor), acc);
      if (acc[3] >= 1) break;
      node = node.parentElement;
    }
    return acc;
  };
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.getClientRects().length === 0) continue; // 视觉隐藏（含 sr-only）跳过
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const bg = bgOf(el);
    const fg = over(parse(cs.color), bg); // 文字色含透明度时先合成到其底
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = px >= 24 || (px >= 18.5 && bold) ? 3 : 4.5; // 大字口径（源 A 换算：14pt≈18.5px / 18pt≈24px）
    const l1 = lum(fg[0], fg[1], fg[2]);
    const l2 = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < need - 1e-9) bad.push({ el, text: el.textContent.trim().slice(0, 24), ratio: ratio.toFixed(3), need }); // 阈值不四舍五入（源 A 原文口径）
  }
  console.table(bad);
  return bad;
})();
```

> 注：本会话已对上述实现做两项核查——① `node --check` 语法通过；② 合成路径功能复测：着色底 `rgba(74,111,165,0.08)` 叠白合成得 `rgb(241,243,248)`，次级文字对之 4.68:1（设计规范 5.3 登记值 4.66:1，差 0.02 来自登记侧合成基数取整口径，方向一致）；深色跌色对深色卡合成底 6.87:1 与 §6.4 静态复测同值。输入格式注意：`parse()` 只认 computed-style 的 `rgb()/rgba()` 串，不认十六进制——A10 静态档脚本须另加十六进制解析。已知口径边界：`.wf-tint-bg` 等着色底经 `background-color` 参与 `bgOf` 合成，无遗漏；`box-shadow` 内嵌焦点环、图表 SVG 刻度文字等非常规底场景归 1.4.11 非文本口径，另行按令牌对静态核查（A10 静态档覆盖）。

### 6.4 本会话实测复测（已执行）

以 §6.2 公式对令牌静态值 Node 复测（命令：`node -e` 内联公式脚本，输出如下）：

| 令牌对 | 实测 | 设计规范 5.3 登记值 | 判定 |
| --- | --- | --- | --- |
| 正文 `#1D2129` / 白 | 16.13:1 | ——（浅色正文区） | ≥4.5 ✅ |
| 次级文字 `#646E7A` / 白 | 5.18:1 | 5.18:1 | ≥4.5 ✅（复现） |
| 三级文字 `#4E5969` / 白 | 7.10:1 | —— | ≥4.5 ✅ |
| 涨 `#00B42A` / 白 | 2.78:1 | 2.78:1 | <4.5——**显式豁免登记**（语义色现状冻结，源 D §5.3） |
| 跌 `#F53F3F` / 白 | 3.71:1 | 3.71:1 | <4.5——同上 |
| 白 / 主色 `#4A6FA5`（主按钮文字） | 5.11:1 | 5.11:1 | ≥4.5 ✅（复现） |
| 深色正文 `#F2F3F5` / 页底 `#17171A` | 16.11:1 | 14.31:1（对 0.92 合成卡底） | ✅（口径差：此处对纯页底，登记值对合成卡底，两者同方向达标） |
| 深色次级 `#A9AEB8` / 卡底 `#232324` | 7.05:1 | 7.14:1（对 0.92 合成底） | ✅（合成基数差异，同方向） |
| 深色三级 / 刻度 `#8F95A0` / 卡底 | 5.22:1 | 5.28:1 | ≥4.5 ✅（合成基数差异） |
| 深色提亮主色 `#7B9FD1` / 页底 | 6.58:1 | 6.58:1（焦点环口径） | ≥3:1 ✅（复现） |
| 深色涨 `#27C346` / 卡底 | 6.72:1 | 6.79:1 | ✅ |
| 深色跌 `#F98D86` / 卡底 | 6.87:1 | 6.95:1 | ✅ |

结论：公式与登记口径互证成立；小数位差异（≤0.09）全部来自「合成卡底（α 叠加）vs 静态近似卡底」的口径差，方向一致。**浅色涨跌语义色豁免**是全仓唯一低于 4.5 的正文级用色，已按「显式登记豁免」流程登记（源 D §5.3），色盲友好开关提供达标替代组（浅色档蓝 `#0072B2` 5.19:1 达标）。深色组无豁免（4.5 双口径强制，源 D）。

---

## 7. 主题六：触控与运动核对

### 7.1 44px 触控目标（ask：P3 已达标 → 核对遗漏）

- 档位生效口径：`@media (pointer: coarse), (max-width: 767.9px)`（`global.css:399-420, 884-889`）；点击区扩展包装两档（24→44、16→44、28→48）（`global.css:422-436`）；圆形按钮本体几何豁免 + 包装层承担命中（`global.css:405-411`）。业界下限为 24×24（2.5.8），本仓 44px 档高于下限，**维持现状即达标，无遗漏控件**。
- 逐类核对：按钮 ✅（`.arco-btn min-height:44` + 预设按钮 D6）；输入框 ✅；顶栏下拉 ✅；开关经包装 ✅（三处全包装，含场景标签 mini 按钮 D6）；折叠头 ✅（D6 min-height）。

### 7.2 prefers-reduced-motion（ask：已降级 → 核对遗漏）

- CSS 通道：通配 `transition-duration/animation-duration: 0.01ms !important` + 逐选择器清单（`global.css:507-535`）——覆盖未来新增动画；主题切换过渡规则故意不写 `!important` 以让位兜底块（`global.css:490-503`）。
- JS 通道：rAF 数值滚动命中即直落（`hooks.ts:189-196`）；图表 `isAnimationActive: !reducedMotion`（`MonteCarloPanel.tsx:112-118`、`BasicCalculator.tsx:132-137`）；JS 驱动动画 CSS 管不住的点已显式短路——双通道齐备。
- 弹层（Select 下拉 / Popconfirm / Message）动画均为 CSS transition，被通配块覆盖 ✅。

### 7.3 ask 点名两处「可能遗漏」的实证结论

| 项 | 核查命令 / 证据 | 结论 |
| --- | --- | --- |
| Canvas 导出按钮 | `grep -rn "toBlob\|toDataURL\|canvas\|导出\|截图\|下载" src/ scripts/ index.html` → 0 处 UI 导出功能命中（命中均为注释 / 数据层「导出形状」语义） | **不存在该功能**，无遗漏可补 |
| PWA 更新提示 | `package.json` 无 PWA 插件依赖；`grep -rn "serviceWorker\|registerSW\|vite-plugin-pwa" src/ vite.config.ts` → 0 命中；`index.html` 无 SW 注册脚本 | **非 PWA 应用**，无更新提示可做 |

### 7.4 观察项（登记不采纳 / 低优先）

- Message 成功提示约 3s 自动消失：`role="alert"` 已即时播报（§1.1），读屏用户错过即无回溯；业界 2.2.1（时序可调）为 A 级条款且提示非「时限任务」。**登记为观察项**（A12）：后续若用户反馈错过提示，经 `Message.config({ duration })` 延长即可，无需现在改。
- 大数字 `font-variant-numeric: tabular-nums`（`global.css:614-617`）已避免等宽抖动，对读屏无影响，登记现状即可。
- 组件库 Select（锁定版本）在顶栏渲染「可聚焦包装容器 + 内部输入框」各为一个顺序焦点停留点（币种与语言两下拉合计 4 停留点而非惯例的 2）：偏离单停留点惯例但可达性无实质损失（逐站仍可操作），**登记为组件库锁定版本上游观察项**；应用侧收敛（对包装容器或内部输入框置 `tabindex="-1"`)需回归验证下拉键盘开合不受影响，验收环境真实键盘事件注入不可达（本轮程序化遍历取证），暂不执行。
- 浅色涨 / 跌语义色的**实际上下文实测值**低于 §6.4 登记口径值（白底 2.78 / 3.71）——验收复测：涨色 #00B42A 于 Alert 着色底 rgb(233,237,243) 实测 2.365:1；跌色 #F53F3F 于页面底 #F7F8FA 实测 3.488:1（均 14px 加粗正文）。属**已登记豁免的补充取证**而非新违规（§5.3 / design-spec 5.3 显式登记豁免 + 色盲友好档达标替代组蓝 #0072B2 5.19:1）；**豁免与替代方案维持不动**，后续若收敛豁免口径，优先在着色底语境（Alert 内涨跌值）局部改用加深语义变体或加大字号走大字 3:1 口径。

---

## 8. 采纳清单（主题 → 具体改动 → 涉及文件 → 验证方法）

| 编号 | 主题 | 具体改动 | 涉及文件 | 验证方法 | 规范依据 |
| --- | --- | --- | --- | --- | --- |
| A1 | 键盘可达 | 布局三区域补地标：Header 传 `role="banner"`、Content 传 `role="main"`、Footer 传 `role="contentinfo"`（布局组件 `rest` 直透 `section`，已实证可行）；`<Content>` 内首个元素前加跳过链接——`<a class="wf-skip-link" href="#wf-main">`，目标 Content 挂 `id="wf-main"` + `tabIndex={-1}`；新增 i18n 键 `a11y.skipToContent` 三语 | `src/App.tsx`、`src/styles/global.css`、`src/i18n/locales/{zh-CN,zh-Hant,en}.ts` | Tab 首键 skip link 可见且获焦环（令牌色）；Enter 后焦点落主内容；读屏地标列表出现三地标 | 2.4.1（G1 / ARIA11）、2.4.3 |
| A2 | 语义 aria | `NumberField` 补程序关联：`useId` 生成 label / hint / error 三 id；标签挂 `id`；InputNumber 传 `aria-label`（含前后缀单位文案）+ `aria-describedby={invalid ? errorId : hintId}` + `aria-invalid={invalid}`；提示容器恒渲染挂 id | `src/components/fields.tsx` | DevTools 无障碍树：spinbutton 名称含单位、描述指向当前提示；越界时 `aria-invalid=true` 且描述=错误文本；axe 类扫描该组件 0 critical | 3.3.1、1.3.1、4.1.2 |
| A3 | 语义 aria | 两处开关补可访问名称：「计划要孩子」复用 `basic.planChildren` 文案作 aria-label；阈值冻结复用 `mc.thresholdFreeze` | `src/components/BasicCalculator.tsx`、`src/components/advanced/MonteCarloPanel.tsx` | 无障碍树中两 switch 名称非空；读屏聚焦念出名称 + 开/关状态 | 4.1.2、1.1.1（控件须有名称） |
| A4 | 语义 aria | 场景名称输入补 aria-label（新增键 `scenario.nameLabel` 三语，或复用占位符文案）；占位符保留作视觉提示 | `src/components/advanced/ScenarioPanel.tsx`、三份 locale | 无障碍树 textbox 名称非空；axe「placeholder 兼标签」检查通过 | 3.3.2、4.1.2 |
| A5 | 键盘可达 | 字段提示图标键盘可达：`.wf-field-tip` 统一加 `tabIndex={0}` + `aria-label`（「说明」+ 字段名）+ `role="button"` 或改语义化按钮；Tooltip 启用 `trigger={["hover","focus"]}`；建议抽公共 `FieldTip` 组件替换 5 处内联（`fields.tsx`、`MonteCarloPanel` 3 处、`AccumulationPanel` 如有） | `src/components/fields.tsx`、`src/components/advanced/MonteCarloPanel.tsx` | Tab 可聚焦提示图标并弹出 Tooltip；Esc 可收起；悬停可移入 Tooltip 内容（1.4.13 三条件）；无障碍树图标有名称 | 2.1.1、1.4.13、4.1.2 |
| A6 | 键盘可达 | 折叠头焦点环令牌化：`global.css` 增 `.arco-collapse-item-header:focus-visible { box-shadow: var(--wf-focus-ring); outline: none; }`（`outline:none` 仅在 box-shadow 环成立时；顶栏内无折叠头，不需 `-dark` 变体分支） | `src/styles/global.css` | 键盘 Tab 依次过 2 + 9 个折叠头，环可见；环外圈对相邻底 ≥3:1（浅色主色 5.11:1 对白 / 深色 6.58:1 对页底，§6.4 实测） | 2.4.7、1.4.11 |
| A7 | 键盘可达 | 六处 `Radio.Group` 补 `name`（每组唯一名，如 `loan-mode` / `acc-mode` / `mc-return-mode` / `mc-strategy` / `seq-mode` / `seq-direction`） | `src/components/advanced/{LoanPanel,AccumulationPanel,MonteCarloPanel}.tsx` | 键盘方向键在组内循环切换且不越组；DOM 中同组 input `name` 一致（DevTools 实查） | 2.1.1（原生分组行为） |
| A8 | 实时区域 | ① `global.css` 增 `.wf-sr-only` 视觉隐藏类（clip-path 口径，与既有收纳档隐藏写法同构）；② 基础输出卡加 `<span class="wf-sr-only" aria-live="polite" aria-atomic="true">` 节点，内容绑**落定值**：`data.criticalValue` 汇总句（新增键 `a11y.resultAnnouncement`：『参考线已更新：{{value}}，已有资产约为参考线的 {{pct}}%』；数据未就绪不写内容）；③ 蒙特卡洛 / 序列完成播报节点（新增键 `mc.doneAria` / `seq.doneAria`，绑 result 落定帧）；④ 防噪三规则（§4.3）写入注释与设计规范 | `src/styles/global.css`、`src/components/BasicCalculator.tsx`、`src/components/advanced/MonteCarloPanel.tsx`、三份 locale、`docs/design-spec.md` §5.4 | 连续键入时读屏无逐键播报（防抖窗口 live 内容不变）；停手 300ms 后 polite 播报一次终值；rAF 滚动完成帧与播报值一致；减弱动效下（直落）同样只播一次 | aria-live polite / aria-busy 口径（源 B）、设计规范 5.4 修订版 |
| A9 | 键盘可达 | 2.4.11 焦点遮挡走查 + 备案修正：Tab 全页遍历（两主题 × 两档视口），聚焦元素被顶栏 / 吸附输出卡 / 底部操作条遮挡处，经 `scroll-margin-top/bottom`（对应 `--wf-topbar-h` 派生值 / dock 高度）修正 | `src/styles/global.css`（视走查结果） | Tab 遍历录屏核对：任何聚焦控件至少部分可见；底部 dock 场景聚焦控件不被整遮 | 2.4.11（2.2 新增 AA） |
| A10 | 对比度 | 落地审计脚本 `scripts/check-a11y-contrast.mjs`：静态档=令牌两两配对（§6.2 公式，含 rgba 合成），输出违规表并纳入 size 门禁同级流程（可先独立 `npm run check:a11y`）；浏览器档=§6.3 computed-style 走查口径附于脚本注释；浅色语义色豁免维持显式登记并在脚本中作白名单 | `scripts/check-a11y-contrast.mjs`（新增）、`package.json`（脚本挂载） | 本会话已完成公式复测（§6.4，14 组令牌对复现登记值）；脚本落地后：跑两主题令牌组输出 0 处**新增**违规（豁免白名单除外）；浏览器档在 dev 页跑一遍 0 处正文级违规 | 1.4.3、1.4.11 |
| A11 | 图表替代（文档） | 把 §5.2 口径（摘要句三要素 + 可见数据表 + 图注；50 条路径不进替代文本）增补进设计规范 §5.4 读屏策略 | `docs/design-spec.md` | 评审确认；后续新增图表按该三件套清单自检 | 1.1.1 |
| A12 | 触控与运动（观察项） | Message 提示 3s 自动消失的读屏回溯性：登记现状（`role="alert"` 已即时播报，非时限任务），若后续反馈错过经 `Message.config({ duration })` 延长 | ——（登记于本文档与设计规范偏差区即可） | ——（观察项，暂不执行） | 2.2.1（观察） |

**优先级建议**：A1 / A2 / A3 / A8 为第一批（覆盖缺口最集中的地标、表单关联、开关名称、结果播报）；A5 / A6 / A7 / A9 第二批；A4 / A10 第三批；A11 / A12 随文档例行更新。

---

## 9. 偏差与未尽事项

1. **真实读屏 / 自动化扫描未执行**：本会话无浏览器接入本项目运行页（研究任务边界为文档产出）。§8 各验证方法均为落地后执行步骤；本会话已执行并报告的是：规范全文研读、组件库源码核查、业务代码盘点、对比度公式 Node 复测、四处存在性 grep。
2. **「Canvas 导出按钮 / PWA 更新提示」与 ask 前提不符**：两者经实证不存在（§7.3），故对应「核对遗漏」的产出为核查结论本身，无采纳条目。
3. **组件库官方无障碍文档页为动态渲染页**，抓取仅返回页面标题、正文不可得；组件库能力口径全部改以本仓 `node_modules` 源码实证（源 C），且更贴近本仓锁定的安装版本——该替代口径更严格而非更宽松。
4. **aria-controls / aria-labelledby 组名的增强项未列入采纳清单**（折叠头→内容区关联、Radio 组名），现状已满足规范最低要求；如后续引入 axe 扫描并出现相关提示，可再增补。
5. **对比度复测的合成基数**：静态复测用近似卡底（深色 `#232324`）替代「α 叠加合成卡底」，与设计规范登记值存在 ≤0.09 的小数差（方向一致）；A10 落地脚本将实现精确合成路径消除该口径差。
6. **门禁遵从**：全文中性表达；外部规范以「业界无障碍规范」表述，未收录原始 URL（来源对应见 §10）。

---

## 10. 来源对应表

| 标签 | 来源类型 | 本研究所用章节 | 抓取方式 |
| --- | --- | --- | --- |
| 源 A | 业界无障碍规范（WCAG 2.2 正文条款 + 官方理解文档） | 1.4.3 对比度（最低）、1.4.11 非文本对比、1.4.13 悬停内容、2.1.1 键盘、2.4.1 绕过重复块（G1 / ARIA11）、2.4.3 / 2.4.7、2.4.11 焦点不被遮挡（2.2 新增）、2.4.13 焦点外观（AAA）、2.5.7 / 2.5.8（2.2 新增）、3.3.1 错误识别、1.1.1 非文本内容（含数据图替代示例原文） | 2026-11-20 全文抓取（新条款清单页 + 五个理解文档页） |
| 源 B | ARIA 实时区域属性参考文档（aria-live 值语义、aria-busy、polite 播报时机、assertive 警告、动态插入 live 节点注意事项） | §4.1 | 2026-11-20 全文抓取 |
| 源 C | 本仓组件库源码（`node_modules/@arco-design/web-react/es/**`） | §1.1、§2.2、§3.2、§7.2、§9.3 | 本地 grep / 通读（Collapse item.js、Switch index.js、Select select.js + option.js、InputNumber index.js、Radio radio.js、Popconfirm index.js、Alert index.js、Message index.js + _class/Notice.js、Layout index.js、Trigger interface.d.ts、_util/hooks/useKeyboardEvent.js） |
| 源 D | 本仓设计规范 | §1.1、§4.3、§6.1（5.3 对比度口径与豁免）、§4（焦点环令牌）、§5.4 / §5.5（读屏现状口径） | 本地读取 |
| 源 E | 本仓业务代码 | §1、§3.1、§5.2 全部行号引用 | 本地读取 / grep |
