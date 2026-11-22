# WF-03 高级区重构施工规范（九面板→四任务迁移 · 令牌准入施工 · 任务路由）

| 项 | 值 |
| --- | --- |
| 文档性质 | WF-03 实施规范（p*spec 形态）：§0 发布阻断条件→§9 验收 checklist 全链可勾选；消费两份研究交付物（`research-wf03-migration.md` / `research-wf03-routing.md`）+ WF-02 四件（对照研究 / 原型规格 / ADR-001 / 令牌演进预审）+ 宪法 §5.1 |
| 输入物 | `docs/design-atlas-brief.md` §一（IA 硬约束）/§四（响应式）/§七（发布阻断九条）/§八（衔接）；`docs/design-language.md` §2/§2.1/§3/§5（宪法与 S1–S26 状态）；`docs/research-wf03-migration.md` §1–§5（迁移表/令牌实算/深链映射/i18n 预算/S 标记）；`docs/research-wf03-routing.md` §1–§5（入口裁定/键盘语义/深链格式/容器查询/wf-route）；`docs/research-atlas-prototype.md` §0–§4（页容器规格）；`docs/atlas-adr-001-component-strategy.md`（组件裁定 9 子项零新依赖）；`docs/atlas-tokens-evolution.md` §1–§5（预审值）；仓库源码本会话直读（锚点见各表） |
| 红线 | 九高级功能全部有可访问新入口＋专业模式直达；share v4+ 兼容、resetEpoch 回落延续；S1–S26 零回退；公式与数据流零触碰（store 业务切片 / share 编解码 / WASM 调用签名不动）；不放宽任何 CI/门禁 |
| 铁律 | 不装新依赖（package.json 运行时 7 件现状冻结，ADR-001 §5.1）；TS strict（`npm run build` 含 `tsc --noEmit` 实测通过）；文档零禁词（13 词面，扫描记录 §10）；src/ 落地名过 check-naming |
| 施工顺序 | §1 迁移表先行 → §2 IA 骨架 → §3 令牌准入（逐键）→ §4 逐文件改造 → §5 性能红线随附 → §6 i18n → §7 门禁复测 → §8/§9 回归验收 |

---

## §0 发布阻断条件（brief §七 九条 → 本轮验收映射）

| # | brief §七 条件 | 本轮兑现口径 | 验收落点 |
| --- | --- | --- | --- |
| 0-1 | 完整功能：九个高级功能全部有可访问新入口 | 迁移表（§1）逐行落实；pro 页承载现行三组九面板整壳（AdvancedPanel 本体零改） | §9 A1–A9 |
| 0-2 | 计算正确性：关键财务模型与独立参考算例一致 | 公式与数据流零触碰：九面板本体、`useCalculatorStore` 业务切片、`share.ts` 编解码、WASM 调用签名全部不在改造清单（§4 白名单）；迁移后 `npm run check:data` / `check:share` 必须零改动通过 | §9 E4 |
| 0-3 | 视觉一致性：同一套 Token | 全部新视觉取值走 §3 清单（既有令牌优先；新键逐键过宪法 §5.1 三步准入 + check:a11y 扩对复验零违规才准出）；组件取色一律经 `resolveThemeTokens`（App.tsx:136 唯一入口），禁直写色值 | §9 C1–C2 |
| 0-4 | 响应式：320px 至宽屏无关键内容裁切 | 五档视口 375/640/768/1024/1440 与 768 唯一硬断点不变（routing §4）；容器查询回退与容器值逐条等值（§2.5） | §9 B4 |
| 0-5 | 可访问性：WCAG 2.2 AA；图表有非视觉替代 | 切换条完整 tab 语义＋roving tabindex＋数字键分域（§2.4）；S21 输入豁免守卫逐字沿用；图表明细行/aria 播报链路随迁不改（§8） | §9 B1–B3、D1–D3 |
| 0-6 | 交互行为：参数变化可取消、可重置、状态一致 | 切换不卸载（hidden 非卸载先例 AdvancedPanel.tsx:145-153 沿用到任务页切换）；resetEpoch 路由层零触碰（不读/不写/不递增，routing §3.2） | §9 D4–D5 |
| 0-7 | 性能：无阻塞长计算；交互流畅度可验证 | §5 四条红线（防抖口径 / rAF 可见性闸 / 监听器 cleanup / 因果高亮不级联）全部延续 P6 裁定 | §9 E1–E3 |
| 0-8 | 数据可靠性：每项外部预设可定位来源、口径、日期 | 本轮零数据改动：defaults.ts 预设值、来源注释、presets、insights.ts 数据源全部不在改造清单；WF-01 校准终态原样延续 | §9 E5 |
| 0-9 | 工程安全：不放宽 CI/门禁；不用快照更新掩盖回归；不强推主分支 | 六项门禁（build / check:size / check:a11y / check:share / check:data / check-naming）全量复测零放宽；禁词扫描零命中；本规范对现有限额（2,000,000 B / 800,000 B wasm / 23 组对）无任何回调提案 | §9 E6–E8 |

---

## §1 迁移对照表（九面板 × 新归属 × 参数切片 × 深链接键 × 壳动/本体不动）

现挂载锚点＝`src/components/AdvancedPanel.tsx:48-76` GROUPS（组 id plan/housing/analysis；组内 key 与历史折叠版一致，分享链接/情景库不引用面板 key——AdvancedPanel.tsx:32 注释）。新归属照 brief §一 表＋原型 §1–§4；深链接键照 routing §3.1（query 通道，hash 由分享载荷独占）。**每行锚点为本会话 grep/sed 逐行复验**（§10 自检 5）。

| # | 面板（key） | 现挂载锚点（复验） | 新归属（任务页） | 壳动/本体不动 | 参数切片锚点（share.ts） | 深链接键 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 反向估算（reverse） | AdvancedPanel.tsx:53 | 自由刻度·右栏 L3 交叉工具卡（原型 §1.1） | 壳不动·本体不动（整面板迁挂） | `reverse`（share.ts:141-144） | `?task=freedom`（默认落点）；pro 直达 `?task=pro&panel=reverse` |
| 2 | 打工模拟（accumulation） | AdvancedPanel.tsx:54 | 人生轨迹·积累组（原型 §2.1 五组之一） | 壳不动·本体不动（组内标签 hidden 非卸载沿用） | `accumulation`（share.ts:233-236，v4 含 sustainYears） | `?task=life`；pro `?task=pro&panel=accumulation` |
| 3 | 社保养老金（pension） | AdvancedPanel.tsx:55 | 人生轨迹·养老组 | 同上 | `pension`（share.ts:238-241，v4 含 targetRetireAge） | `?task=life`；pro `?task=pro&panel=pension` |
| 4 | 贷款计算（loan） | AdvancedPanel.tsx:62 | 人生轨迹·负债组 | 同上 | `loan`（share.ts:145-149；method 枚举 :149） | `?task=life`；pro `?task=pro&panel=loan` |
| 5 | 买房收租（rental） | AdvancedPanel.tsx:63 | 人生轨迹·收租组 | 同上 | `rental`（share.ts:150-153，10 键） | `?task=life`；pro `?task=pro&panel=rental` |
| 6 | 蒙特卡洛模拟（monte-carlo） | AdvancedPanel.tsx:70 | 风险实验室·主模拟＋支取策略（原型 §3.1） | **壳重构·本体零改**：字段拆落 L2 参数区、图落 L3；store 切片/WASM 调用/组件内键零改 | `monteCarlo`（share.ts:154-227）＋`monteCarloReturnMode`/`monteCarloSeriesId`（:228-229） | `?task=risk`；pro `?task=pro&panel=monte-carlo` |
| 7 | 税务估算（tax） | AdvancedPanel.tsx:71 | 人生轨迹·税务组 | 壳不动·本体不动 | `tax`（share.ts:230-232；bands 校验 :232 起） | `?task=life`；pro `?task=pro&panel=tax` |
| 8 | 多情景对比（scenario） | AdvancedPanel.tsx:72 | 风险实验室·情景库落 L2 左栏、对比表落 L3（原型 §3.1） | **壳重构·本体零改**：载入路径 `applyShareState` 零改（ScenarioPanel.tsx:152） | 无专属载荷切片——经情景库存档（scenarios.ts），ShareState 十一键无 scenario 键（share.ts:52-64 对照） | `?task=risk`；pro `?task=pro&panel=scenario` |
| 9 | 公式原理（insights） | AdvancedPanel.tsx:73 | 原理档案·主阅读页（原型 §4.1）；风险实验室的「洞察」指 mc 策略口径注（已内嵌蒙特卡洛面板），**非本面板搬迁** | **壳重构**：小节重排为 L1–L4 阅读流；insights.ts 数据源与键零改 | 无业务切片（纯展示，InsightsPanel.tsx:2-3 头注） | `?task=principles`；pro `?task=pro&panel=insights` |
| ★ | 基础公式（BasicCalculator，非九面板） | App.tsx:399-401（wf-workbench 左列挂载） | 自由刻度 L1/L2 主体（原型 §1.1） | 壳随任务容器改造·公式与数据流零改 | `baseline`（share.ts:137-140）＋`progressCurrentAssets`（:237） | 默认落点（task=freedom 无参即默认） |

约束条（随表生效）：
- 组件壳退役面：AdvancedPanel.tsx:135-176 的 Card＋Radio＋Tabs 壳在默认视图由四任务导航取代；「分段＋组内标签 hidden 非卸载」模式在人生轨迹页内复用（原型 §2.1，ADR D-B3）；**专业模式入口保留原壳原语义**（brief §一 硬约束，§4.2）。
- ADR 约束（atlas-adr-001 §3/§4）：不新增运行时依赖；折叠不得销毁 DOM（D-B3）；分步引导为渐进披露非强制流程（D-B1）；本表 9 行迁移全部落在「保留 Arco 现状 / 自研分段切换条」结论域内，零跨库。
- 迁移即交付物：本表按 brief §一「迁移对照表＋深链接兼容为 WF-03 交付物」登记，随实施轮收口归档。

---

## §2 IA 骨架施工设计

### 2.1 入口形态（routing §1.1 裁定沿用：分段入口）

- 内容区顶部任务切换条，恰 5 项：四任务（freedom/life/risk/principles）主行样式＋专业模式次级样式（发丝线分隔）。否决顶栏位（App.tsx:303-354 五控件满载＋移动顶栏 56px 无扩展空间，global.css:91 `--wf-topbar-h: 56px`）与左侧 rail（平板带常驻侧栏已显式注销，原型 §0.1）。
- 挂点：Content 内、任务页根之前（App.tsx:360-370 的 `<Content role="main" id="wf-main">` 内首元素区）；壳层（Header/Footer/Content maxWidth 1112，App.tsx:367）零改动。
- 带形态：≥768 单行 5 项；480–767 同条可换行；320–479 任务四项 2×2 网格＋专业模式整行次行（routing §1.2）；任务切换不进 dock（D8 职责锁定）。
- 切换反馈：新面板淡入 `--wf-dur-base`（240ms）标准曲线透明度-only；减弱动效经既有兜底块（global.css:654-662 通配＋:669-690 逐类）瞬时；退场比进入快（宪法 §3.5）。
- 切换后滚动复位至切换条下缘、焦点移至新面板根；业务参数在 store 常驻，切换不丢输入/已运行结果（hidden 非卸载先例：AdvancedPanel.tsx:145-153）。

### 2.2 App.tsx 任务容器

- `wf-workbench` 现为「基础计算＋高级区」双栏（App.tsx:399-406；global.css:467-490 `@media (min-width: 1200px)` 400px＋minmax(0,1fr)）。改造后结构：任务切换条 → 活动任务页容器（四页各自根节点，`id="atlas-<task>"`，对齐原型 §0.2 命名）→ 页内布局归原型 §1–§4。
- 活动任务为受控状态（§2.3/§2.4 持久化＋路由同步）；非活动任务页**不卸载**（同 hidden 非卸载先例——已运行模拟结果保留）。
- App.tsx 现有职责全部保留：hash 分享处理（:104-126）、动态令牌注入（:135-185）、S22 揭示（:45-64）、aria 补写（:222-225）。任务路由逻辑**新增不侵入**：分享 hash 与 query 路由两条通道互不触碰（§4.3）。

### 2.3 路由状态持久化 wf-route（routing §5 裁定沿用）

- 键名 `wf-route`，并入偏好键族：wf-lang（src/i18n/index.ts:15）/ wf-theme（defaults.ts:238）/ wf-prefs（defaults.ts:242），单一 localStorage 域。
- 值形状 JSON `{"task":"<id>","panel":"<key>"}`；panel 仅 task=pro 时写入；**仅此二键**——组内末激活标签记忆维持会话级 useState 不入盘（现状行为，AdvancedPanel.tsx:87）。
- 读：useState 初始化器同步读（先渲染后不补读，防任务闪变；readInitialTheme 先例 defaults.ts:356）。写：仅显式切换动作（点选/键盘激活）；**深链落地不写**（URL 是事实来源）；try/catch 静默（persistTheme/persistLanguage 同口径）。
- 不入盘项：瞬态 UI、模拟运行态；路由值不入 share 载荷、不入情景库存档、不触碰 resetEpoch。
- 过期兼容：值不可解析/键越界 → 视同无存储静默回落（§4.3 回落链）；版本字段暂不设，未来加键仿 share v4 递增先例（share.ts:30-42）补 version。

### 2.4 aria tab 语义＋S21 式输入豁免（routing §1.3 裁定沿用）

- 语义骨架：切换条 `role="tablist"`＋aria-label（§6 新键）；每项 `role="tab"`＋`aria-selected`＋`aria-controls="atlas-<task>"`（pro 页 id `atlas-pro`）；页根 `role="tabpanel"`＋`aria-labelledby`＋`tabIndex={0}`。
- 键盘：roving tabindex（活动项 0 余 −1）；←/→ 在 5 项间循环移动焦点；Enter/Space 手动激活（重内容页不满足自动激活条件）。Tab 自活动页签进入面板内容。
- 数字键分域：1–4 → 四任务；5 → 专业模式。豁免守卫**逐字沿用 S21 实现**（INPUT/TEXTAREA/SELECT/contenteditable 不派发，AdvancedPanel.tsx:100-107；S21 登记于宪法 §2）。**冲突消解：task=pro 时任务键整组不绑定**——pro 内 1/2/3 仍归 S21 组切换（AdvancedPanel.tsx:99-111 原样）、5 为当前页无操作、4 无绑定，既有键盘习惯零变化。
- Esc：仅 pro 页消费——返回最近一次所在任务（无历史回 freedom）；四任务页不绑 Esc。
- 数字键激活域＝任务页根聚焦且焦点不在输入控件内（与 S21 同构判定）。

### 2.5 Container Queries 渐进启用（routing §4 裁定沿用）

| 容器 | container-name | 本轮批次 | 回退形态（视口断点不变） |
| --- | --- | --- | --- |
| 任务切换条 | atlas-switch | 首批（新标记零存量风险） | ≤767.9 换行 2×2＋次行（等值视口 MQ） |
| 自由刻度页根 | freedom | 首批 | 现状 wf-workbench 等值视口 MQ（global.css:467-490）——回退即现状布局 |
| 原理档案页根 | principles | 第二批 | 单列视口堆叠（纯阅读页零状态风险） |
| 人生轨迹页根 | life | WF-04 起（本轮单列聚合承载，brief §六衔接注记） | 单列 |
| 风险实验室页根 | risk | WF-04 起（同上） | 单列 |
| pro 区 | 不启用 | — | 维持现行视口断点与布局（S1–S26 零回退红线） |

纪律：inline-size 命名容器挂任务页根；带内样式一律 min-width 书写；`@supports not (container-type: inline-size)` 回退等值视口媒体查询；容器单位（cqw 等）不引入；嵌套仅一层；壳层永不容器化；hooks.ts 视口钩（hooks.ts:85/:100）继续服务组件库 layout 逻辑，双轨并存；减弱动效钩（hooks.ts:164）口径不变。

---

## §3 令牌施工清单（tokens 预审 20 项＋零变更断言 3 项，逐项准入）

实算口径：WCAG 2.1 相对亮度法，正文 4.5 / 大字与非文本 3.0。**本会话独立复算 18 组关键对全部吻合（偏差 ≤0.005，§10 自检 4）**；矩阵全量值源 `research-wf03-migration.md` §2.2–§2.4（其会话 34 项声明值复核零更正）。现值门禁基线：`npm run check:a11y` → 23 组令牌对、白名单外违规 0 处（本会话实跑）；**提案值不在其覆盖内，每键施工后必须扩对复验零违规才准出**（宪法 §5.1 第 3 步）。

| 项 | 验算结论（实算值） | WF-03 施工动作 | 回填演进表 |
| --- | --- | --- | --- |
| C-1 Ink Navy `#102331` | **通过**：浅四底文字全过（14.99/14.47/16.07/13.56）；现深文字三档对 Ink Navy 14.47/7.36/5.34 全过 | 浅色文字用途（替换 `--wf-text` 值）走三步准入施工；**深色画布用途挂起**——配套深色表面三档提档族未定（预审标「实施前验算」），定稿后另键施工 | C-1 行五要素＋本行施工范围注记 |
| C-2 Paper `#F6F8F7` | **通过**：现浅文字三档全过（15.12/4.86/6.66，本会话复算正文档 ✓） | 画布改值键（`--wf-bg-sunken` 浅值），与 C-1 成对评审施工；改值后全量既有浅色文字对比度随 check:a11y 扩对复验 | C-2 行 |
| C-3 Signal Teal | **需调值（按底约束）**：浅文字 `#087F78` 限 sunken/surface 底（4.54 贴线/4.86）；inset 4.38、tint 合成 4.10 跌破禁文字；深提亮 `#26AFA6` 四面过、材质 4.53 贴线；深值禁浅用（Paper 2.54） | 新增键两主题双值＋**「文字限画布/卡底」约束写入组件取值处**；扩对复验含贴线值 4.54/4.53 | C-3 行底色约束回写 |
| C-4 Copper | **需调值**：浅原值 `#A56C32` 仅图形口径（四底 3.70–4.38）→ 文字改提字 `#966028`（4.90/4.73/5.25；tint 合成 4.43 禁文字）；深候选 `#C48A4F` 三面过、材质 4.14 限大字/图形 | 新增键：浅双值（图形原值＋文字提字）＋深单值；材质面用途约束回写五要素；扩对复验 | C-4 行 |
| C-5 Slate | **需调值**：浅原值 `#8195A3` 仅白卡图形 3.11，其余底全禁 → 文字改提字 `#5E7484`（4.55/4.88；inset 4.39、tint 合成 4.11 禁文字）；深原值可直用（5.76/5.47/5.06；材质 3.94 限大字/图形） | 同 C-4 模式：浅双值＋深单值＋约束 | C-5 行 |
| C-6 Soft Mint `#DCEEE8` | **需调值（约束增补）**：浅值作底时现次级文字 4.30 跌破（本会话复算 ✓）；三级 `#4E5969` 5.90 过；深合成底（rgba(8,127,120,0.16) 叠深底）对现深文字 12.27/6.24/4.52 全过、三级贴线 | 新增区间底键＋**区间底约束入五要素（底上元信息改用正文/三级色）**；深合成值随定稿底复验后才施工深值 | C-6 行 |
| T-1 数字主标题 48px 候选键 | 排版静态层，复用既有文字/表面色对（P4/P5/P16–P18 已验算达标），无新增验算对 | 施工（新键，≥1024 宽档 L1 读数；每屏仍至多一处）——过 check:size 后落码 | T-1 行 |
| T-2 正文 16px 候选键 | 同上 | 施工（新键，原理档案阅读列） | T-2 行 |
| T-3 页面标题 32px 候选键 | 同上 | 施工（新键，四任务页头） | T-3 行 |
| T-4 区域标题 24px | 现值 20px 已在 brief 带内（20–24） | **不施工**：默认现值；密度实测后另行追加 | T-4 行登记 |
| T-5 元信息 14px | 现值 12px 在带内（12–14） | **不施工**：默认现值 | T-5 行登记 |
| T-6 卡片圆角 20px 档 | 静态层 | **不施工**：默认现值三档一全；大卡/图卡启用时再走准入 | T-6 行登记 |
| S-1 Surface 0 Canvas | **零新增键**：映射现 `--wf-bg-sunken`（global.css:59/323） | 仅命名/语义对齐；画布替换候选归 C-2 | S-1 行 |
| S-2 Surface 1 Instrument | **零新增键**：映射 `--wf-bg-surface`＋`--wf-hairline-card`＋`--wf-shadow-1`（global.css:61/73/94） | 同上 | S-2 行 |
| S-3 Surface 2 Overlay | **零新增键**：映射既有三层材质挂点（global.css:81-88/343-350） | 命名对齐＋**边界收敛条款入 spec：检视器/透镜复用此挂点，普通卡恒实底、密集数字表格与图表恒稳定不透明底** | S-3 行 |
| M-1/M-2/M-3 动效三带 | 带内断言：现 120/240/360 落 brief 三类带内（360 仅 S18 沿用）；无色值不涉对比度 | **零新增时长键、零改值** | M-1–M-3 行 |
| M-4 事件因果强调 | 候选行为纪律，依赖 WF-04 引擎输出 | **不施工**（WF-04 立项另走 §5.1） | M-4 行 |
| M-5 低性能自动降载 | 候选纪律 | **不施工**（§5.1 修订候选评审） | M-5 行 |
| 零变更断言 ×3 | 间距 4/8/…/48＝现值（global.css:25-31）；tabular-nums＝S3 常驻（本会话 grep 计数 10 处）；阅读宽 640–760＝非令牌 | 零施工零动作 | 预审 §2.2 |

准入纪律（逐键执行，宪法 §5.1 + 预审 §5）：三步准入（预审表 → 本 spec → 宪法 §2/§5 回填）齐备才施工；C-3/C-4/C-5/C-6 等主题组新键三源五点同步（types.ts ThemeTokens 接口＋defaults THEME/THEME_DARK＋App.tsx 注入数组（App.tsx:137-173 现清单扩位）＋global.css 双块）；每键施工后 `npm run check:a11y` 扩对复验零违规才准出；src/ 落地名过 check-naming。

---

## §4 组件改造逐文件清单（壳动本体不动；文件级可勾选）

### 4.1 壳动文件（改造落点）

- [ ] `src/App.tsx`：①Content 内新增任务切换条＋任务页容器（§2.2 结构；现 `wf-workbench` 双栏改造为任务容器结构，其 ≥1200 双栏语义移入自由刻度页内 per 原型 §1.1，回退等值 MQ per §2.5）；②route state（useState 初始化器同步读 wf-route＋query 解析，首渲染前完成）；③数字键 1–4/5 分域监听（挂切换条，豁免守卫 §2.4）；④Esc 仅 pro 消费。**不动**：hash 分享处理（:104-126）、令牌注入（:135-185）、S22（:45-64）、aria 补写（:222-225）、偏好键族。
- [ ] `src/services/share.ts`（或同域新文件 `src/services/routeState.ts`，URL 处理单一归属先例 share.ts:278）：新增 encodeRouteState/decodeRouteState 纯函数对——query 通道 `?task=<id>[&panel=<key>]`；task ∈ freedom|life|risk|principles|pro；panel 仅 task=pro 消费且取值＝九面板现行 key 原文；序列化只写非默认值（task=freedom 且无 panel 清参数）；canonical 顺序 task→panel。**不动**：v4 编解码、HASH_PREFIX（:46）、版本门（:135）、buildShareUrl（:278）。
- [ ] `src/components/AdvancedPanel.tsx`：**整体保留为专业模式（pro）页本体**——三组九面板、组分段、横滚标签、lazyload＋hidden 非卸载、S20/S21、组记忆全部原样（:137-175）；仅外层接受受控初始组/面板（供 `?task=pro&panel=<key>` 落位，非受控改受控最小面）；本文件 GROUPS 表（:48-76）与键盘逻辑（:99-133）零语义改动。
- [ ] 新建 `src/components/TaskSwitcher.tsx`（自研分段切换条，ADR D-B1「自研抽象」结论域）：5 项 role=tab 语义＋roving tabindex＋数字键分域＋发丝线分隔次级样式；样式挂既有令牌（`.wf-adv-seg` 语义先例 global.css:432），禁直写色值。
- [ ] `src/styles/global.css`：①atlas-switch 容器定义＋切换条样式＋≤767.9 等值回退 MQ；②atlas-freedom/principles 容器（首批/第二批 per §2.5）；③任务切换淡入 240ms 透明度-only 规则（走 `--wf-dur-base`/`--wf-ease-standard` 既有令牌，禁裸字面量）；④§3 准入键的 global.css 双块行。**不动**：材质区、reduced-motion 兜底块、既有 S 项规则区（§8 锚点行号随新增行漂移属正常，语义锚点以类名为准）。
- [ ] `src/i18n/locales/zh-CN.ts`：新增 atlas 块 12 键（§6）；**不删键**（advanced.groupPlan/groupHousing/groupAnalysis 在 pro 页仍被引用，AdvancedPanel.tsx:51,59,67）；`src/i18n/locales/en.ts`、`src/i18n/locales/zh-Hant.ts` 同步（§6 口径）。

### 4.2 本体不动白名单（零触碰声明，验收时 grep 反证）

- [ ] 九面板组件本体：`src/components/advanced/`（ReversePanel/LoanPanel/RentalPanel/MonteCarloPanel/TaxPanel/AccumulationPanel/PensionPanel/ScenarioPanel/InsightsPanel）——迁移仅为挂载点变化，内部签名元素落点不触碰（S18 六面板、S25 图表气泡、S6 空态、S7/S15/S10 等全保持）。例外：monte-carlo/scenario/insights 三面板允许**壳级布局拆分**（§1 表「壳重构·本体零改」行），字段/图/store 调用/键零改，改造前须在本文件追记逐文件差异。
- [ ] `src/store/useCalculatorStore.ts`：业务切片、applyShareState（:272-295）、resetEpoch（:186/:205/:227/:333）、联动标志、persistPrefs 零触碰。
- [ ] `src/components/hooks.ts`：useAnimatedNumber（:205，含 :218-219 IntersectionObserver 可见性闸）、useFlashOnChange（:302）、usePrefersReducedMotion（:164）、视口双钩（:85/:100）零触碰。
- [ ] `src/components/BasicCalculator.tsx`：公式、resetEpoch 消费（:373-380 清档位闩锁、:548 resetKey 重挂）、D9 吸附（:546-550/:675-677/:753）、aria 播报（:768-772）零触碰；仅当任务容器要求挂载位置变化时整体迁挂。
- [ ] `src/data/`（defaults.ts 预设与来源注释、types.ts 除外——C 类新键按 §3 五点同步扩 ThemeTokens 接口）、`src/wasm/`、`src/services/scenarios.ts` 零触碰。

### 4.3 专业模式入口与深链接解析

- 入口三件：①深链 `?task=pro&panel=<key>`（九 key 映射见 §1 表深链接键列）；②切换器数字键 5；③Esc 反向回退。pro 页 tablist 恒有一选中项（第 5 项 role=tab），避免空选中态。
- 解析链路（routing §3.1/§3.2 裁定）：**首渲染前解析**（useState 初始化器，禁 effect 后解析）；切换即 `history.replaceState` 同文档改写、不 pushState；URL 显式参数 > wf-route > 默认 freedom；task 越界静默归 freedom 并 replaceState 规范化，panel 越界静默落 pro 首面板，**不弹提示**（路由无数据损失，与分享损坏一次性警示 App.tsx:114-118 分级）。
- 通道正交：`?task=risk#s=...` 同 URL 并存互不触碰；分享 hash 恢复失败 → resetBusinessInputs（store:333）→ resetKey 重挂（BasicCalculator:548）链路原样；路由层不读不写 resetEpoch。
- 「旧格式链接在新导航下仍回落正确面板」兑现口径：兼容态＝裸 `#s=` 恢复全部切片＋落自由刻度默认（载荷不含面板位置信息，AdvancedPanel.tsx:32 注释；现状无自动跳转）；自动跳转属增强态须 URL 显式携带 `?task=`，**不按载荷内容启发式推导**。

---

## §5 性能红线（P6 裁定全部延续）

1. **防抖口径**：既有防抖计算链路（输入变更→静默窗口→落定帧）零触碰；S9 计算徽标呼吸（防抖静默窗口期，BasicCalculator.tsx:754-756＋global.css:1312-1318）与 S16 因果闪亮（落定帧触发）的触发时机不改；本轮新增交互（任务切换/深链解析）一律不新增独立防抖实例——切换为纯 UI 状态不进计算路径。
2. **rAF 可见性闸**：S18 `useAnimatedNumber` 宿主 ref＋IntersectionObserver 闸（hooks.ts:205/:218-219）随迁不改；面板迁移后闸的宿主 ref 跟随新挂载点，hidden 非卸载语义下闸继续生效（隐藏面板暂停、恢复续播或落定）。
3. **监听器 cleanup**：新增监听（任务键盘、hashchange 既有 :124-125 配对先例）一律 useEffect 内 add/remove 成对＋依赖数组完备；matchMedia 钩 cleanup 模式（hooks.ts:85-100 现状）沿用；切换条卸载（不存在——恒挂载）之外任何临时监听须在 effect return 清理。
4. **因果高亮不级联**：S16 `useFlashOnChange` 仅消费落定值差、不进 store 不触发计算（hooks.ts:300-304 红线注释）；任务页装配不得把 flash/闪亮挂到 store 或计算链；切换任务不重放闪亮（跨页纯状态切换非输入变更）。
5. **切换不卸载**：四任务页间切换沿用 hidden 非卸载（DOM 与组件状态保留），已运行模拟结果/表单输入零丢失；lazyload 仅限首次展现挂载（Tabs lazyload 先例 AdvancedPanel.tsx:161）。

---

## §6 i18n 键清单（12 键 × 3 语 = 36 条）

基准：advanced 块现 22 键（zh-CN.ts:117-141 本会话直读）；键结构三语同构为既有契约。**零新增复用**：四任务页内面板标题/描述沿用既有 advanced.*Title/Desc 18 键（不搬块不改名）；损坏/正名提示沿用 share.restoreIgnored / share.strategyLegacyNotice（zh-CN.ts:679-680）；恢复成功沿用 share.restored；深链接定位不新增提示（routing §3.2 分级）。**不删键**：advanced 三组 label 在 pro 页仍被引用。

| 键 | zh-CN | zh-Hant（逐词字形） | en |
| --- | --- | --- | --- |
| atlas.nav.freedom | 自由刻度 | 自由刻度 | Freedom target |
| atlas.nav.freedomDesc | 我需要多少钱 | 我需要多少錢 | How much do I need? |
| atlas.nav.life | 人生轨迹 | 人生軌跡 | Life timeline |
| atlas.nav.lifeDesc | 我何时有机会退休 | 我何時有機會退休 | When can I afford to retire? |
| atlas.nav.risk | 风险实验室 | 風險實驗室 | Risk lab |
| atlas.nav.riskDesc | 我的计划承受得住变化吗 | 我的計劃承受得住變化嗎 | Can my plan survive change? |
| atlas.nav.principles | 原理档案 | 原理檔案 | Rationale archive |
| atlas.nav.principlesDesc | 为什么这样计算 | 為什麼這樣計算 | Why is it calculated this way? |
| atlas.pro.label | 专业模式 | 專業模式 | Pro mode |
| atlas.pro.desc | 原九面板工具直达入口 | 原九面板工具直達入口 | Direct access to the original nine panels |
| atlas.pro.backLabel | 返回任务导航 | 返回任務導航 | Back to task navigation |
| atlas.migrate.notice | 默认视图已换为四任务导航，原九面板收入专业模式 | 默認視圖已換為四任務導航，原九面板收入專業模式 | The default view now uses the four-task navigation; the original nine panels live in Pro mode. |

纪律：zh-Hant 为 zh-CN 逐词字形转换（为→為、险→險、轨→軌、迹→跡、验→驗、时→時、机→機、划→劃、档→檔、专→專、业→業、达→達、达→達、导→導、览→覽、观→觀…）；**禁用「喫」**——转换遇「吃」一律作「吃」（本轮 12 键原文不含「吃」，转换脚本若产出「喫」即判失败重做）；键名过 check-naming；三语键结构同构、无插值占位符（纯字面量）；字节估算 raw ≈1.6KB / gzip ≈0.8KB（估算值，实施轮以 check:size 实测为准）。

---

## §7 尺寸预算与降档顺序

**实测基线（本会话 2026-11-22 实跑，§10 自检 2）**：`npm run build` 通过 → `node scripts/check-size.mjs` → **dist 全部文件原始字节总和 1,974,146 B**（14 文件，不含部署快照 .git），门禁 2,000,000 B，**实测余量 25,854 B ≈ 25.2KB**（wasm 单项 387,792 B ≤ 800,000 B ✓）。

> ⚠ **前提勘误（如实登记）**：任务书前提「现余量 ~72KB」与本会话实测不符——实测余量 25,854 B。任务书「净增预算 ≤60KB」按实测余量必然触门禁（60KB > 25.85KB）。本规范按**实测余量**设本轮净增预算，预算裁决权归收口会话；本条不构成对门禁数值的任何放宽（0-9）。

- **本轮净增预算：≤ 25KB**（硬余量 25,854 B 内再留 ≥800 B 门禁解析浮差与 purge 波动）；单项参照：§3 新键（C×6 双主题块＋T-1/T-2/T-3 静态键）≈ +1.5–2.0KB 级、§6 三语 12 键 ≈ +0.8KB gzip 级、TaskSwitcher＋容器查询＋任务容器改造为余下主要增量——合计预估 ≤ 20KB，留 ≥5KB 余量。
- 门禁纪律不变：`DIST_TOTAL_KB` 解析口、`npm run check:size` 超标 exit 1、KB 向上取整（scripts/check-size.mjs:29-30/:80 语义）。
- **降档顺序**（超限时按序砍，逐档复测 check:size；发布阻断级不可降档项除外）：
  1. T-1/T-2/T-3 新键退回现四级值（准入前一律现值为既定降级方案，原型 §0.5）；
  2. atlas.migrate.notice 不渲染（键保留，提示改由 pro.desc 承载）;
  3. 切换条 desc 副行降为 title 悬停提示（A8 披露语义不丢）；
  4. principles 容器查询第二批退回等值视口 MQ；
  5. atlas-freedom 容器退回现状 wf-workbench 等值视口 MQ（回退即现状布局，零功能损失）。
- **不可降档**：九面板可达（0-1）、pro 直达、share v4 兼容（0-2）、S1–S26 语义（§8）、§5 四红线、§6 三语键结构。降档不得以删除验收项为代价，只降表现层。

---

## §8 回归红线

### 8.1 S1–S26 锚点表（●＝本会话 grep/sed 复验；未标＝转引宪法 §2.1 P6 收口实测，行号已按本会话漂移校正的标▲）

| # | 状态 | 宿主/现锚点 | 本轮影响 | 回归锚点（影响项） |
| --- | --- | --- | --- | --- |
| S1 | ✅ | 进度环刻度：BasicCalculator.tsx:327-354,382,422；global.css:1266-1280 ● | 是→自由刻度 L1 | 跨档变色/单次放大回落；reduced-motion 只停放大 |
| S2 | ✅ | 达成脉冲：BasicCalculator.tsx:339-362,404,437；global.css:1284-1292 ● | 是→同上 | iteration 1 硬约束；aria 播报不变 |
| S3 | ✅ | tabular-nums 常驻：global.css 10 处（本会话 grep -c ●） | 否 | 迁移后计数不减少（新增数字行须挂） |
| S4 | ✅ | 行级 hover 读数：global.css:1242-1250 ● | 是（敏感性/洞察行迁自由刻度 L3/原理档案） | hover→`--wf-bg-tint` 半档，fast 档只作用背景色 |
| S5 | ✅ | 轻确认：BasicCalculator.tsx:588-594 ●（copied 态）；渲染位▲:1056/:1063 转引 | 是（分享按钮入口位随页布局） | 150ms 级换文案＋对勾；Message.success 兜底 |
| S6 | ✅ | 空态 4+1：BasicCalculator.tsx:806 ●；MonteCarloPanel.tsx:743/:1005 ●；AccumulationPanel.tsx:687 ●；ScenarioPanel.tsx:289-291 ● | 是 | 经 Empty icon 注入；EmptyRuler 静态无动画 |
| S7 | ✅ | 分组左标线：BasicCalculator.tsx:908 ●；InsightsPanel.tsx:48 ●；TaxPanel.tsx:231 ● | 是 | `orientation="left"`＋`.wf-group-line` 发丝线令牌 |
| S8 | － | 未立项（让位预算） | 否 | 不适用 |
| S9 | ✅ | 计算徽标：BasicCalculator.tsx:754-756 ●；global.css:1312-1318 ● | 是 | 呼吸周期 `calc(var(--wf-dur-slow)*2)`；与 Spin 不并存 |
| S10 | ✅ | 方向冗余：BasicCalculator.tsx:303-304/:318-319 ●；RentalPanel.tsx:639-641 ● | 是 | ▲/▼ 形状通道独立于颜色（WCAG 1.4.1） |
| S11 | ✅ | 深色环线抬升：BasicCalculator.tsx:407 转引；global.css:68/:334/:1301-1305 ● | 是 | `--wf-ring-halo` 三源对账；深色常驻 |
| S12 | － | 未立项 | 否 | 不适用 |
| S13 | ✅ | 诚实进度尺：BasicCalculator.tsx:359-380 转引（FreedomGauge）；zh progress.caption | 是→自由刻度 L1 | 真实百分比；无假进度 |
| S14 | ✅ | 乘数段位徽标：BasicCalculator.tsx:859-864 ● | 是 | 跨段位 Tag＋单次涨色；降级 Tag 常驻 |
| S15 | ✅ | 目标线叙事：AccumulationPanel.tsx:103/:624-628 ●（submittedTarget 同帧快照） | 是→人生轨迹 | ReferenceLine 目标线；叙事行引用已算出字段 |
| S16 | ✅ | 因果闪亮：hooks.ts:302 ●；BasicCalculator.tsx:621,624-628 转引；global.css:1354-1366 ● | 是 | 防抖落定帧触发；明细区禁重挂；不级联（§5.4） |
| S17 | ⛔ | 未落地（宪法 §2.1 :109） | 是·前置 | 公式解构/敏感性双向高亮若施工：先走 §5.1 三步准入＋复测门禁；**未准入走描边/文字加粗通道或降级静态标签**（原型 §5.2 降级口径） |
| S18 | ✅ | hooks.ts:205 ●（:218-219 IO 闸转引）；六面板：Reverse:68 ● / Loan:52 ● / Rental:264 ● / Pension:71 ▲ / MonteCarlo:298 ▲ / Accumulation:236 ▲ | 是 | 闸随迁不改；rAF 中间帧永不进 store |
| S19 | ✅ | global.css:1377-1384 ●（`:hover:not(.wf-is-stuck)`） | 是→自由刻度 | 上浮 1px＋着色底半档；::after pointer-events:none |
| S20 | ✅ | AdvancedPanel.tsx:162 ● | 是（pro 页保留须回归） | inkBar＋tabPane 开箱动画；兜底块压停终态一致 |
| S21 | ✅ | AdvancedPanel.tsx:99-111/:154 ●（豁免守卫 :100-107 ●） | 是（同上） | 1/2/3 切组；输入豁免逐字保持；pro 外任务键分域互斥（§2.4） |
| S22 | ✅ | App.tsx:45-64/:90-96 ●；global.css:1389-1401 ● | 否（IA 迁移不触及顶栏） | ::view-transition 显式停用规则（通配兜底不命中 UA 伪元素） |
| S23 | ⛔ | 未落地；降档注释 ScenarioPanel.tsx:112 ▲ | 否 | 零行为面；注释随文件迁移；立项另走 §5.1 |
| S24 | ✅ | global.css:1417-1433 ●（`.wf-field:has(.arco-input-error)::before`） | 否（类承载与挂载位置无关） | 2px `--wf-fall` 左标线；无 :has() 三通道兜底 |
| S25 | ✅ | 5 图 Tooltip：BasicCalculator.tsx:168 ●；MonteCarloPanel.tsx:333/:357 ▲（共享气泡）＋:757-758 ▲（syncId="wf-mc"）；RentalPanel.tsx:349 ●；AccumulationPanel.tsx:241 ▲；global.css:1435-1455 ● | 是 | 十字虚线挂三级文字色；触屏/读屏明细行兜底 |
| S26 | ⛔ | 未落地；降档注释 hooks.ts:7 ● | 否 | 零行为面；随新分享入口立项另走 §5.1 |

统计：受影响 19 项（含 S17 前置）；不受影响 5 项（S3/S22/S23/S24/S26）；不适用 2 项（S8/S12）。全部影响项 reduced-motion 双闸（CSS 兜底 global.css:654-662/:669-690 ＋ JS hook hooks.ts:164）随迁不改——逐项验证降级态与落地态同轮通过。

### 8.2 D9 吸附态

- 响应式档位：BasicCalculator.tsx:546-550 ●（D9 注释：<640 环 56px、<768 明细折叠）；isStuck 状态：BasicCalculator.tsx:675-677 ●/:753 ●；吸附位移：global.css:201-205 ●（<767.9 top 8px）；吸附态样式：global.css:226-248 ●；S19 与吸附互斥：global.css:1377-1381 ●（`:hover:not(.wf-is-stuck)`）；双栏下吸附退化静态：global.css:486-489 ●。
- 回归口径：迁移后输出卡吸附/紧凑档/双栏退化三态全部保持；任务页装配若移动吸附几何（原型 §1.2 L1 置顶吸附沿用 top 8px 档），仅允许复用既有类与令牌。

### 8.3 aria 播报链路

- 基础读数播报：BasicCalculator.tsx:768-772 ●（`.wf-sr-only` aria-live="polite" aria-atomic="true"，resultAnnouncement/resultAnnouncementAssets 两键）；蒙特卡洛：MonteCarloPanel.tsx:661 ●/:868 ●。迁移零触碰；新增切换条不新增播报（路由无数据损失不播报，§4.3 分级），但 aria-selected/aria-controls 状态更新即时可测。
- 图表非视觉替代（0-5）：各图 role="img"＋aria 汇总句、明细行兜底随迁保持（AccumulationPanel.tsx:9 头注先例）。

### 8.4 share v4 兼容

- 版本门：`obj.v !== SHARE_LINK_VERSION` → null（share.ts:135 ●）；hash 前缀 `#s=`（share.ts:46 ●）；URL 构造（share.ts:278-280 ●）；App 解析链（App.tsx:104-126 ●）；store 写入 11 切片（useCalculatorStore.ts:272-295 ●）；损坏回落 resetEpoch 递增（store:333 ●）→ 清档位闩锁（BasicCalculator.tsx:373-380 ●）→ resetKey 重挂（:548 ●）；正名规范化 inflation_uplift→fixed＋strategyLegacyNotice（share.ts:167-174 ●＋store:292 ●）；联动解绑 accumulationTargetSynced/pensionMonthsSynced=false（store:288/:291 ●）。
- 回归口径：迁移后 v4 链接恢复、损坏回落、正名提示、联动解绑四路径行为零变化（§9 E4 以 check:share 六组断言＋手工深链实测双证）。

### 8.5 方案 B 用户裁决升级说明

brief §一硬约束：**方案 B 导航（分段＋组内标签）由 Atlas IA 用户裁决升级取代**，迁移对照表＋深链接兼容处理为 WF-03 交付物——即本文件 §1 与 §4.3。执行口径：①方案 B 的组件语义（分段＋Tabs＋hidden 非卸载＋S20/S21）不删除，整体保留为 pro 页本体（§4.2）；②默认视图换四任务导航＋一次性迁移说明（atlas.migrate.notice）；③既有高级用户效率保全清单按 routing §2.2 五条逐条验收（九面板完整可达／S20/S21 键盘零变化／面板 key 不变／S1–S26 零回退／本对照表交付）；④任何对方案 B→四任务映射的变更须回写本文件 §1 表并重走验收，不得静默偏离。

---

## §9 验收 checklist（31 条；实施轮逐条勾选并附证据）

**A. 九功能可达（0-1；每项＝从默认视图 ≤3 步内到达且功能可用）**

- [ ] A1 反向估算：默认视图 → 切换条「自由刻度」→ 右栏交叉工具卡可达；输入资产即出结果
- [ ] A2 打工模拟：切换条「人生轨迹」→ 积累组标签可达；运行结果保留（切换往返不丢）
- [ ] A3 社保养老金：人生轨迹·养老组可达；计发月数联动行为不变
- [ ] A4 贷款计算：人生轨迹·负债组可达；摊销表渲染完整
- [ ] A5 买房收租：人生轨迹·收租组可达；净现金流 ▲▼ 字形在位（S10）
- [ ] A6 蒙特卡洛：切换条「风险实验室」→ 参数区字段＋图可达；运行结果保留
- [ ] A7 税务估算：人生轨迹·税务组可达；bands 口径输出不变
- [ ] A8 多情景对比：风险实验室 L2 情景库＋L3 对比表可达；载入复用 applyShareState 行为不变
- [ ] A9 公式原理：切换条「原理档案」→ 阅读页可达；insights 数据源零改动

**B. 直达与导航（brief §一硬约束＋0-4/0-5）**

- [ ] B1 专业模式直达：`?task=pro` 直达原三组九面板整壳；`?task=pro&panel=<9 key 逐一>` 九条深链各自落位正确面板
- [ ] B2 四任务直达：`?task=freedom|life|risk|principles` 四条深链各自落位；非法 task 静默归 freedom 且 URL 规范化、无提示弹层
- [ ] B3 键盘：Tab→切换条 roving（←/→ 循环）；Enter/Space 激活；数字键 1–4/5 分域；焦点在输入框内按数字不切任务（S21 式豁免）；pro 内 1/2/3 仍切组、任务键不绑定；Esc 仅 pro 退出
- [ ] B4 响应式：375/768/1024/1440 四档截图走查无裁切；≤767.9 切换条 2×2＋次行；@supports 回退路径与容器路径等值（禁用容器查询特性对比验证）

**C. 令牌（0-3；§3 逐键）**

- [ ] C1 check:a11y 扩对复验：C-1…C-6 每键施工后对清单含「新值×当轮在役底」全部组合，白名单外违规 0 处（贴线值 4.54/4.53/4.14/3.94 逐一在列）
- [ ] C2 深浅两态同轮验收：六色＋T-1/T-2/T-3 在浅/深两主题下截图对照；C-3/C-4/C-5 底约束（文字限画布/卡底、材质面限大字图形、区间底禁次级文字）在组件取值处抽查可证

**D. 状态与可访问性（0-5/0-6/0-7）**

- [ ] D1 tab 语义：切换条 role=tablist＋5×role=tab＋aria-selected 联动＋aria-controls 对 `atlas-<task>`；页根 role=tabpanel 可聚焦
- [ ] D2 aria 播报链路：基础读数/MC 两处 aria-live 播报在迁移后照常触发（BasicCalculator:768-772 / MonteCarlo:661,868 锚点在位）
- [ ] D3 reduced-motion：切换淡入/切换条动效/受影响 S 项在系统「减弱动效」下全部瞬时（CSS 兜底＋JS hook 双闸各验一次）
- [ ] D4 切换不丢状态：每面板填入参数→切走切回→输入与已运行结果保留（hidden 非卸载）
- [ ] D5 resetEpoch 零触碰：损坏 `#s=` 链接回落默认＋一次提示＋字段重挂链路照旧；路由操作不触发 resetEpoch（代码层 grep 反证）

**E. 门禁与工程安全（0-2/0-7/0-8/0-9）**

- [ ] E1 `npm run check:size` 通过且本轮净增 ≤25KB（对比本规范基线 1,974,146 B 记录增量）
- [ ] E2 `npm run check:a11y` 通过（23 组对基线不回退＋扩对新对全过）
- [ ] E3 `npm run build` 通过（tsc strict 零错误）；package.json 运行时依赖仍 7 件（grep 反证零新增）
- [ ] E4 `npm run check:share` 与 `npm run check:data` 零改动通过；v4 旧链接手工实测恢复全部切片
- [ ] E5 数据层零改动：`git diff --stat src/data/ src/wasm/ src/services/scenarios.ts` 仅 types.ts 允许出现（§3 五点同步）；defaults 预设值与来源注释逐字节未动
- [ ] E6 check-naming：src/ 零禁词命中（新增令牌名/键名/类名在内）
- [ ] E7 本文件与实施 diff 的 13 词面禁词扫描零命中（§10 口径）
- [ ] E8 不用快照更新掩盖回归：本轮验收证据为实跑命令输出＋实测截图，不含任何「以现状快照替换预期」的断言改写

**F. 三语与持久化**

- [ ] F1 三语走查：切换条/pro 入口/迁移说明在 zh-CN/zh-Hant/en 三语下文案完整；zh-Hant 逐词字形（為/險/軌跡/專業）且无「喫」；键结构三份一致（grep 键数相等）
- [ ] F2 wf-route 持久化：显式切换→刷新→停留原任务；深链落地不写盘（localStorage 检查）；越界值静默回落 freedom
- [ ] F3 深色海拔：深色主题下任务页三层表面（画布/卡底/材质挂点）明度差排布保持「越高越亮」（截图对照 global.css:322-326 现值族）

---

## §10 自检记录（本规范成稿会话实跑，2026-11-22）

1. **构建与门禁**：`npm run build` → tsc strict＋vite build 通过（1388 modules，purge 130,418 B）；`node scripts/check-size.mjs` → DIST_TOTAL_KB=1928、wasm 379KB、门禁通过；独立字节合计脚本（含 .git 排除）→ TOTAL_BYTES=1,974,146、MARGIN_BYTES=25,854。`npm run check:a11y` → 「静态档对比度审计通过：23 组令牌对，白名单外违规 0 处」。
2. **对比度独立复算**：node 内联脚本（WCAG 2.1 线性化亮度＋CR）对研究表 18 组关键对复算 → 18/18 吻合（偏差 ≤0.005）：InkNavy×四底、Teal 浅值×四底（4.54/4.38/4.86/4.10）、Copper 提字 4.90/4.43、Slate 提字 4.55/4.39、Teal 深候选 5.81/4.53、Copper 深候选 4.14、Slate 3.94、Teal 浅误用深底 3.68、次级×SoftMint 4.30、三级×SoftMint 5.90、现正文×Paper 15.12。全矩阵值以 `research-wf03-migration.md` §2.2–§2.4 为准（其会话 34 项复核零更正）。
3. **迁移表锚点复验**：AdvancedPanel.tsx GROUPS 九行（:53/:54/:55/:62/:63/:70/:71/:72/:73）、hidden 语义（:145-153）、S20（:162）、S21（:99-111/:100-107/:154）；share.ts 切片锚点（:52-64/:135-136/:137-141/:141-144/:145-149/:150-153/:154-227/:228-229/:230-232/:233-236/:237/:238-241/:167-174/:46/:278）——全部 grep/sed 本会话命中；store（:272-295/:288/:291/:292/:333/:186/:87 系 AdvancedPanel）、BasicCalculator（:373-380/:546-550/:548/:675-677/:753-756/:768-772/:806/:859-864/:908/:303-318/:588-594/:168）、hooks（:7/:85/:100/:164/:205/:302）、i18n（index.ts:15；zh-CN advanced 块 ：117-141；三语 share 键 :679-682）、defaults（:238/:242/:356）、ScenarioPanel（:152/:289-291/:112）、global.css（令牌区 :25-108/:111-115、深色块 :310-361、材质 :81-88/:343-350、wf-adv-seg :432、workbench :467-490、触控 :547-583、reduced-motion :654-690、S 项区 :1240-1455、top8px :201-205、stuck :226-248）。
4. **行号漂移更正登记**（相对研究/宪法 P6 收口引用）：S10 BC :275→:303-318；S14 :563-583→:859-864；S15 Accumulation :91-93/:555→:103/:624-628；S18 Pension :67→:71、MonteCarlo :292→:298、Accumulation :232→:236；S6 BC :740→:806、MC :676/:917→:743/:1005、Accumulation :614→:687、Scenario :287→:289-291；S7 BC :830→:908、Insights :44-50→:48；S9 BC :538/:690→:754-756；S23 注释 Scenario :109→:112；S5 注释区 ：554→:588-594；global.css S 区整体下移（S4 :1220→:1242、S1 :1244→:1266、S2 :1262→:1284、S9 :1292→:1312、S19 :1377 不变、S22 :1390→:1389、S24 :1421→:1417）。语义锚点以类名/标识符为准，行号为快照。
5. **禁词扫描**：任务书 13 词面（三家厂商名／材质隐喻与材质统称／运动学隐喻及其英文对应词）正则不区分大小写全文扫描本文件 → 零命中（grep exit 1）；正则词面不在本文复写以免自污染（姊妹研究文档同口径）。
6. **行数**：`wc -l docs/wf03-spec.md` → 326 行（自设预算 ≤400 行满足）；checkbox 计 42 处（§4 文件级 11 ＋ §9 验收 31）。
7. **零施工声明**：本规范为实施前规范；本会话对 src/、global.css 零写入（工作区仅新增本文件）；唯一产出物为本文件。（该口径仅限本规范成稿会话——实施发生在其后会话，见下节登记。）

---

## 实施结果与收口记录（WF-03 实施运行 + 文档收口会话补记，2026-11-22；除注明者外，命令与数值均为收口会话当场复跑/实读）

### 一、改动文件清单（实施轮 16 文件 + 素材 4 件；收口轮补记 5 处文档）

- **新建 6**：`docs/research-wf03-migration.md`（施工台账：迁移表/令牌全矩阵实算/深链映射/i18n 预算/S 标记）、`docs/research-wf03-routing.md`（入口—路由—持久化裁定）、本规范、`src/services/routeState.ts`（142 行：ATLAS_TASK_IDS/ATLAS_PANEL_KEYS 常量 + resolveInitialRoute/persistRoute/replaceUrlRoute 纯函数对；query 通道单一归属、hash 透传不改写、resetEpoch 零触碰）、`src/components/TaskSwitcher.tsx`（83 行：role=tablist 恰 5 项 + roving tabindex + ←/→ 循环移焦；数字键不在此绑定）、`src/components/TaskPages.tsx`（71 行：人生轨迹页壳——Radio 分段沿用 `.wf-adv-seg` + hidden 非卸载 + 首展挂载集合）。
- **改造 10**：`src/App.tsx`（任务容器五 tabpanel + selectTask 路由动作（仅显式切换写 wf-route 与 replaceState）+ 数字键 1–4/5 分域与 Esc（S21 式豁免逐字沿用）+ 迁移说明会话级瞬态 + 令牌注入数组 +6 键；hash 分享处理/S22 零语义改动）、`src/components/AdvancedPanel.tsx`（仅新增 `initialPanelKey` 受控初始落位；GROUPS 表与键盘逻辑零改动）、`src/styles/global.css`（+324 行：atlas-switch/freedom/principles 三容器 + `@supports not` 等值回退 + 切换条/工具卡/页样式 + atlas-page-in 淡入走 `--wf-dur-base` 透明度-only）、`src/data/types.ts`（ThemeTokens +6 字段含底约束字段注）、`src/data/defaults.ts`（THEME/THEME_DARK 令牌组扩位；预设值与来源注释零触碰）、`src/i18n/locales/`（zh-CN/zh-Hant/en 三份 atlas 块 13 键）、`scripts/check-a11y-contrast.mjs`（基线 23 组对维持 + WF-03 扩对 40 组）、`docs/atlas-tokens-evolution.md`（§8 施工回填）。
- **素材 4**（构建产物实拍重制，文件名口径未变）：`docs/assets/demo-workbench.png`、`demo-workbench-flow.gif`（212 帧）、`docs/assets/en/demo-workbench.png`、`docs/assets/en/demo-workbench-flow.gif`。
- **收口轮补记 5**：本节（本文件）、`docs/design-language.md` §5.5 版本记录、`docs/design-atlas-brief.md` §六 WF-03 行交付登记、双语 README（素材区两图注 + 功能描述导航段 + 项目结构树）。

### 二、令牌回填数（演进表 §8 口径 + 收口会话代码实读复核）

预审 20 项处置：**施工 9 项**（C-1…C-6 + T-1/T-2/T-3）；不施工默认现值 3 项（T-4/T-5/T-6）；零新增键命名对齐 3 项（S-1/S-2/S-3）；零新增时长零改值 3 项（M-1/M-2/M-3）；候选不施工 2 项（M-4/M-5）；零变更断言 ×3 零动作。
落码键数 **11**：改值键 2（`--wf-text` #1D2129→#102331、`--wf-bg-sunken` #F8F7F3→#F6F8F7）+ 动态新键 6（`--wf-accent-teal`/`--wf-accent-copper`/`--wf-accent-copper-graphic`/`--wf-accent-slate`/`--wf-accent-slate-graphic`/`--wf-bg-mint`，浅深双块）+ 静态新键 3（`--wf-text-num-display:48px`/`--wf-text-reading:16px`/`--wf-text-page-title:32px`，不入对账）。五点同步实读齐备：types.ts 接口 +6 字段 → defaults.ts 双组 +6 键 → App.tsx 注入数组 +6 行 → global.css 浅深双块。`check:a11y` 对清单 **23 → 63 组**（扩对 40 组，白名单外违规 0——贴线值 4.56/4.86/4.56/4.17/3.97/4.49 等全在册）；`check-naming` src/ 零命中。挂起 2 项验算义务随迁：①C-1 深色画布用途（配套深色表面三档提档族未定稿）；②C-6 深合成终值（现值已按在役底复验过，定稿底后重算）。

### 三、门禁终态（六道 + 禁词，收口会话逐条复跑）

| 门禁 | 命令 | 终态（exit 0 全绿） |
| --- | --- | --- |
| build | `npm run build` | tsc strict + vite build：1391 modules、purge 130,418 B（1206 规则）、PWA precache 12 entries |
| size | `node scripts/check-size.mjs` | DIST_TOTAL_KB=1941、WASM_MAX_KB=379，通过 |
| a11y | `node scripts/check-a11y-contrast.mjs` | 63 组令牌对全过、白名单外违规 0 |
| share | `node scripts/check-share.mjs` | 六组断言通过（v4 往返/v3 失效/正名规范化/三语键集一致） |
| data | `node scripts/check-data.mjs` | 九组断言通过 |
| naming | `node scripts/check-naming.mjs "<13 词面正则>"`（词面不在本文复写） | src/ 零禁词命中 |
| 禁词 docs | `grep -rniE "<13 词面正则>"` 于本文件/两研究/演进表/brief/宪法/双语 README | 零命中（grep exit 1） |

- **尺寸实测**（独立字节合计脚本，口径同 §10.1）：14 文件 **1,987,322 B**（含 sw.js、不含 dist/.git），门禁 2,000,000 B 余量 **12,678 B**；wasm 387,792 B ≤ 800,000。对比 §10.1 基线 1,974,146 B **净增 +13,176 B ≈ 12.9KB** < §7 预算 25KB，未触发降档顺序。演进表 §8 记 1,987,045 B（余量 12,955）与本复测差 277 B，为构建产物逐字节波动级，两口径同过门禁。
- **E5 数据层反证**：`git diff --stat src/data/ src/wasm/ src/services/scenarios.ts src/store/ src/components/hooks.ts src/components/BasicCalculator.tsx src/services/share.ts` → 仅 defaults.ts(+31)/types.ts(+16)（§3 五点同步允许域），store/hooks/BasicCalculator/share.ts/wasm/scenarios 零出现。依赖冻结：package.json 运行时 7 件不变（直读复核）。

### 四、验收轮次与残留

轮次（可考记录）：①研究段两交付物成稿；②规范段成稿 + §10 七项自检；③实施段——九面板→四任务迁移、令牌逐键准入施工、路由/i18n 落码、演进表 §8 回填、双语素材四件重制成功（素材结论由收口任务书给到）；收口会话对 GIF 逐帧抽样取证（212 帧，每约 25 帧取 1）：自由刻度（月开销 2,990→5,000 → 参考线 ¥2,600,000、进度环 115.4%）→ 人生轨迹（五组分段表单）→ 原理档案（阅读页）→ 风险实验室（种子 42：耗尽概率 94.4%、第 95 百分位 ¥64,936.61、初始支取率 7.18%、末年支取额中位数 ¥60,227.97）→ 回自由刻度输入读数保留——A6/D4「切换不丢状态」素材可见（en 版 GIF 另含专业模式三组整壳帧）；④收口段——六道门禁复跑全绿 + 三文档登记 + README 双语同步 + 禁词终扫。
残留（登记不阻断）：①C-1 深色画布用途、C-6 深合成终值两挂起项（§二）；②life/risk 容器查询未启用（本轮单列聚合承载，WF-04 起——brief §六衔接注记兑现；principles 容器按 §2.5 第二批已随本轮落地，三容器 + `@supports` 回退实装）；③T-4/T-5/T-6/M-4/M-5 不施工（预审裁定维持）；④§9 checklist 浏览器侧手工走查项（B1–B4/C2/D3–D5/F2–F3）**收口会话未逐条复跑**——实施运行的逐条勾选记录不在收口会话可见范围，本节不作代勾，素材四件为部分视觉佐证；可复跑项（C1/E1–E8/F1）已在本节复验。

### 五、与规范偏差登记（不构成放宽）

| # | 规范原文 | 实施终态 | 性质 |
| --- | --- | --- | --- |
| 1 | §6 i18n 12 键 | atlas 块 **13 键** ×3 语（+atlas.nav.label，tablist aria-label 三语键） | 键数增补；三文件键集逐键比对一致（node 抽取全等 + zh-Hant 块直读），逐词字形、无「喫」 |
| 2 | §2.5 principles 容器「第二批」 | 已随本轮落地 | 提前；回退等值 `@supports` 同批 |
| 3 | §7 预算（勘误后余量 25,854 B） | 实测净增 13,176 B / 余量 12,678 B | 预算内，未触降档 |
| 4 | §4.1 AdvancedPanel「受控初始组/面板」 | 仅 `initialPanelKey` 单 prop 受控初始，运行时语义零改 | 最小面兑现 |
