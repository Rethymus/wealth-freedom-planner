# WF-03 路由与状态设计（research-wf03-routing）

> 性质：WF-03 交付物「任务路由与状态设计」——四任务入口形态、专业模式直达路径、深链接格式与兼容回落、Container Queries 渐进启用清单、路由状态持久化五节，供 WF-03 实施直接消费；不写实现代码。
> 输入物（本会话全读／直读）：`docs/research-atlas-prototype.md` §0–§6（原型规格）；`docs/design-language.md` §1/§2/§2.1/§3/§5（宪法与 S1–S26 实施状态）；`docs/design-atlas-brief.md` §一/§四/§六/§七/§八（IA 硬约束与响应式带）；`docs/research-advanced-nav.md` §0/§2/§3/§6（导航语义与键盘实证）；`docs/atlas-adr-001-component-strategy.md` §3.2/§4（D-B2 与单运行时）；`src/App.tsx`；`src/components/AdvancedPanel.tsx`；`src/store/useCalculatorStore.ts`；`src/services/share.ts`；`src/i18n/index.ts`；`src/data/defaults.ts`；`src/components/hooks.ts`；`src/styles/global.css`（grep 实测）。
> 范围红线：本文只产设计。不改任何令牌现值、不动 AdvancedPanel 内部导航语义（S1–S26 零回退红线，brief §一）；任务页内部布局归原型 §1–§4，本文只裁定「入口—路由—持久化」三层。
> 铁律：本文零禁词（任务书 13 词面，词面不在本文复写以免自污染，同原型 §7 口径；扫描记录见 §6）。

---

## §0 现状基线（本会话直读，路由设计的约束源）

| 事实 | 落点 | 对本文的约束 |
| --- | --- | --- |
| 单页应用，无路由库；骨架＝Header／Content／Footer，Content maxWidth 1112 | App.tsx:282-417（:367 宽度） | 路由层＝「页内状态 + URL 同步」，不引入路由依赖（ADR §4 单运行时纪律） |
| 顶栏已载 5 控件：币种 / 色盲开关 / 语言 / 主题 | App.tsx:303-354 | 顶栏无导航位；窄档双形态标签机制（App.tsx:231-272）已满载 |
| 高级区＝分段（3 组）+ 组内 Tabs（hidden 非卸载、组记忆末激活） | AdvancedPanel.tsx:137-175（:145-148 hidden 语义） | 方案 B 现行实现是专业模式的直接载体，内部零改动 |
| 分享走 hash `#s=`（v4）；损坏回落＋一次性警示 | share.ts:46/:278、App.tsx:109-126 | 深链接必须避开 hash 通道（锚点改写 hash 的冲突先例：research-advanced-nav §0#1） |
| 偏好持久化三键 wf-lang / wf-theme / wf-prefs；仅显式动作写盘、失败静默 | i18n/index.ts:15、defaults.ts:238/:242、useCalculatorStore.ts:43-64 | wf-route 命名与写入纪律同族（§5） |
| resetEpoch：外部整体写入 / 业务重置递增 → resetKey 重挂 | useCalculatorStore.ts:186/:202-227/:333、BasicCalculator.tsx:548 | 路由层零触碰该纪元（§3.2） |
| 五档视口 375/640/768/1024/1440，768 唯一硬断点，min-width 移动优先 | research-responsive §1.3/D1 | 回退断点不变（§4） |
| 视口钩：窄档 / 紧凑档 / 减弱动效 | hooks.ts:85/:100/:164 | 与容器查询双轨并存（§4） |

---

## §1 四任务入口形态（三选一裁定）

### 1.1 裁定：分段入口（内容区顶部任务切换条）

| 候选 | 判定 | 依据 |
| --- | --- | --- |
| 顶栏任务切换 | 否 | ① 顶栏 5 控件已满载（App.tsx:303-354），再加 4 项触发窄档收纳连锁改造；② 壳层纪律＝顶栏 / 页脚 / Content 1112 不随容器带变化（原型 §0.1），任务属页面 IA 层不属壳层；③ banner 地标内嵌主 tablist 偏离地标语义——A1 跳转链接之后的首个内容锚应是 main（App.tsx:285-287/:360-364）；④ 移动顶栏几何 56px（global.css:91）无扩展空间 |
| 左侧 rail | 否 | ① 原型平板带已显式注销常驻侧栏（原型 §0.1 平板带兑现口径；ADR §3.2 D-B2「备而不用」）；② Content 1112 内 rail 挤占工作台（自由刻度左栏已 400px sticky，原型 §1.1）；③ 移动 320–767 无 rail 几何，须再养一套收纳形态＝双形态维护成本，违克制原则（design-language §1） |
| **分段入口（推荐）** | **是** | ① 语义＝平级任务收纳，与既有组件语义判定同构（research-advanced-nav §2）；② 样式先例 `.wf-adv-seg`（AdvancedPanel.tsx:138、global.css:432）零新机制；③ 平板带「图上方横向分段条」已是原型裁定（原型 §2.1/§3.1），分段是全带一致性最高的形态；④ 恰 5 项（4 任务＋专业模式）合同屏独立选项 ≤5 纪律（原型 §0.6） |

### 1.2 形态参数（移动端单任务结构照原型移动带）

- 挂点：Content 内、任务页根之前（main 首元素区），不进 Header（§1.1 否决理由）；壳层零改动。
- ≥768：单行分段条 5 项；四任务主行样式＋专业模式次级样式（发丝线分隔，Divider 既有载体 S7，design-language §2）。
- 480–767：同一分段条；单行容纳不下时换行（换行规则由容器查询承载，§4 atlas-switch）。
- 320–479：任务四项 2×2 网格＋专业模式整行次行；**任务页体结构照原型移动带原样**（原型 §1.2/§2.2/§3.2：单列＋底部参数面板＋底部 dock；brief §八.1 单任务移动结构同口径）。任务切换不进 dock——dock 职责已被 D8 锁定（复制分享 / 参数唤出 / 运行重算，原型 §1.2#5、§2.2#3）。
- 切换反馈：新面板淡入 base 240ms 标准曲线透明度-only（结构变化档映射，原型 §0.5；design-language §3.5 退场比进入快——旧页即时移除）；减弱动效经既有 CSS 兜底块瞬时（global.css:654-662）。
- 切换后滚动复位至切换条下缘、焦点移至新面板根（§1.3）；业务参数在 store 常驻，切换不丢输入 / 已运行结果（hidden 非卸载先例：AdvancedPanel.tsx:145-148）。

### 1.3 键盘可达与 aria 语义（沿用 S21 输入豁免先例）

- 语义骨架：切换条 `role="tablist"` ＋ aria-label（三语新键）；每项 `role="tab"` ＋ `aria-selected` ＋ `aria-controls="atlas-<task>"`（id 对齐原型容器命名 freedom/life/risk/principles，原型 §0.2；专业模式 id `atlas-pro`）；页根 `role="tabpanel"` ＋ `aria-labelledby` ＋ `tabIndex={0}`（面板可聚焦先例：组件库 tab-content.js:27，research-advanced-nav §3.1）。
- 自补键盘（组件库页签无方向键、全部 tabIndex=0，research-advanced-nav §3.1）：roving tabindex（活动项 0 余 −1）；←/→ 在 5 项间循环移动焦点；Enter/Space 激活——手动激活（任务页为重内容，自动激活条件不满足：research-advanced-nav §3.2）。
- 数字键分域裁定：1–4 → 四任务（激活域＝任务页根聚焦且焦点不在输入控件内）；5 → 专业模式。豁免守卫逐字沿用 S21 实现（INPUT/TEXTAREA/SELECT/contenteditable 不派发，AdvancedPanel.tsx:100-107；S21 登记于 design-language §2）。**冲突消解：task=pro 时任务键整组不绑定**——pro 内 1/2/3 仍归 S21 组切换（AdvancedPanel.tsx:99-111 原样）、5 为当前页无操作、4 无绑定，既有用户键盘习惯零变化（发布阻断级口径，§2.2#2）。
- Esc 键位：仅在 pro 页消费——返回最近一次所在任务（无历史则回 freedom），给纯键盘用户一条非 Tab 退出路径；四任务页不绑 Esc。
- 键盘路径：A1 跳转链接（App.tsx:285-287）→ main → 切换条为首组停留点；Tab 自活动页签进入面板内容（roving 单停留点惯例）。

---

## §2 专业模式入口（发布阻断级：九面板直达与既有效率保全）

### 2.1 入口形态

- 位置：任务切换条第 5 项（§1.1 已裁定并入同一条）；`role="tab"` 同语义——tablist 恒有一选中项，避免空选中态；视觉次级降档＋发丝线分隔，保住「四任务为主、专业模式为直达通道」的层级阅读。
- 直达路径三件：① 深链 `?task=pro&panel=<key>`（§3）；② 切换器数字键 5（§1.3）；③ Esc 回退（§1.3，反向通道）。
- 页内二级入口：自由刻度 L4「推导与来源→原理档案」跳链（原型 §1.1）落 principles 任务（非 pro）；跨任务跳链统一走深链格式（§3.1）。

### 2.2 既有用户效率保全清单（逐条验收口径）

| # | 保全项 | 口径 | 依据 |
| --- | --- | --- | --- |
| 1 | 九面板完整可达 | pro 页＝现行三组＋组内 Tabs 整体保留：组分段、横滚标签、lazyload＋hidden 非卸载全部不动 | AdvancedPanel.tsx:137-175；brief §一硬约束 |
| 2 | S20/S21 键盘零变化 | pro 内 1/2/3 组切换、←/→ 漫游、每组记忆末激活原样；任务键在 pro 不绑定（§1.3） | AdvancedPanel.tsx:87/:99-133；design-language §2.1 S20/S21 均 ✅ |
| 3 | 面板 key 不变 | 深链 panel= 直接消费现行 key 集（reverse/accumulation/pension/loan/rental/monte-carlo/tax/scenario/insights），key 与分享 / 情景库无耦合、无兼容负担 | AdvancedPanel.tsx:32-33 注释、:48-76 |
| 4 | S1–S26 零回退 | 面板组件为挂载点迁移，内部签名元素落点不触碰（S18 六面板、S25 图表气泡等） | design-language §2.1 落点表；brief §一红线 |
| 5 | 迁移对照表 | 面板→任务映射归 brief §一表；本文补齐 URL / 键盘 / 入口三层对照（§1.3/§2.1/§3） | brief §一「迁移对照表＋深链接兼容为 WF-03 交付物」 |

---

## §3 深链接格式与兼容回落

### 3.1 格式定义

- 载体：**query 参数（非 hash）**——hash 通道已被分享载荷独占（`#s=`，share.ts:46/:278），锚点改写 hash 的冲突先例（research-advanced-nav §0#1）反证 query 是无冲突通道；两者可在同一 URL 并存（`?task=risk#s=...`），互不触碰。
- 格式：`?task=<id>[&panel=<key>]`。task ∈ freedom | life | risk | principles | pro（前四对齐原型容器名，原型 §0.2）；panel 仅在 task=pro 消费，取值＝九面板现行 key（§2.2#3）；其余任务下 panel 参数保留不消费（WF-04 页内锚位预留，如公式解构变量）。
- 解析与写入：纯函数对（编码 / 解码）与 share.ts 同域（URL 处理单一归属，share.ts:278 先例）；**首渲染前解析**（useState 初始化器，禁 effect 后解析——防任务闪变；读初始主题先例 defaults.ts:356）；切换即 `history.replaceState` 同文档改写、不 pushState（不伪造浏览器历史，Back 语义保留给分享流）。
- 序列化纪律：只写非默认值——task=freedom 且无 panel 时清除参数（URL 恒净）；canonical 顺序 task→panel。

### 3.2 旧格式兼容回落（resetEpoch 语义延续）

- 存量链接盘点：现行 URL 只有两种形态——裸 pathname、pathname`#s=`...（深链是 research-advanced-nav §6.5#2 候选未实施；面板 key 无 URL 消费者，AdvancedPanel.tsx:32）。两者均无 task/panel 参数 → 解析落默认任务 freedom（或经既有 handleHash 恢复业务参数后仍落 freedom），**零破坏、零迁移**。
- 优先级：URL 显式参数 > wf-route（§5） > 默认 freedom——显式指定恒胜出（「显式选择持久化、推导值不落盘」同源哲学：useCalculatorStore.ts:43-44）。
- 非法值回落：task 越界 → 静默归 freedom 并 replaceState 规范化；panel 越界（pro 下）→ 静默落 pro 首面板。**不弹提示**——路由是纯导航无数据损失，与分享损坏的一次性警示（App.tsx:114-118）分级；提示违反反冗长原则（design-language §1#3）。
- resetEpoch 语义延续：路由层零触碰 resetEpoch——不读、不写、不递增；分享 hash 恢复失败 → resetBusinessInputs 递增（useCalculatorStore.ts:333）→ resetKey 重挂（BasicCalculator.tsx:548）链路原样。路由参数与分享载荷是两条正交 URL 通道，互不触发对方回落。

---

## §4 Container Queries 渐进启用清单

原则（原型 §0.2 五条全盘沿用）：inline-size 命名容器挂任务页根；带内样式一律 min-width 书写；`@supports not (container-type: inline-size)` 回退**等值**视口媒体查询；容器单位（cqw 等）不引入；嵌套仅一层。

| 容器 | container-name | 启用批次 | 回退形态（视口断点不变） |
| --- | --- | --- | --- |
| 任务切换条 | atlas-switch | WF-03 首批（新标记零存量风险；换行规则消费者） | ≤767.9 换行 2×2＋次行（等值视口 MQ） |
| 自由刻度页根 | freedom | WF-03 首批 | 现状 wf-workbench 等值视口 MQ（global.css:470）——回退即现状布局 |
| 原理档案页根 | principles | WF-03 第二批 | 单列视口堆叠（纯阅读页零状态风险，原型 §4.2） |
| 人生轨迹页根 | life | WF-04 起 | 单列（引擎未接入前以 pro 面板聚合承载，brief §六衔接注记） |
| 风险实验室页根 | risk | WF-04 起 | 单列（同上；叠影数据契约归 WF-04，原型 §6） |
| pro 区 | 不启用 | — | 维持现行视口断点与布局（S1–S26 零回退红线；research-advanced-nav §6.3 断点矩阵不动） |

- 回退纪律：视口五档 375/640/768/1024/1440 与 768 唯一硬断点**不变**（research-responsive §1.3/D1）；@supports 回退值与容器查询值逐条等值（原型 §0.2#3）。
- 壳层（顶栏 / 页脚 / Content 1112，App.tsx:367）永不容器化（原型 §0.1 双轨纪律）；浮动检视器挂 body 弹层用视口 MQ 兜底（原型 §0.2#5）。
- hooks.ts 视口钩（hooks.ts:85/:100）继续服务组件库 layout 逻辑，不因容器查询停用——双轨并存，判定域不同（组件布局 vs 容器样式）；减弱动效钩（hooks.ts:164）口径不变。

---

## §5 路由状态持久化（wf-route）

- 键名：`wf-route`——并入既有偏好键族 wf-lang（i18n/index.ts:15）/ wf-theme（defaults.ts:238）/ wf-prefs（defaults.ts:242），单一 localStorage 域。
- 值形状：JSON `{"task":"<id>","panel":"<key>"}`；panel 仅 task=pro 时写入；**仅此二键**——每组末激活标签记忆维持会话级 useState 不入盘（现状行为，AdvancedPanel.tsx:87，跨会话记忆非本层职责）。
- 读：初始化时同步读（useState 初始化器 / 建 store 时），先渲染后不补读（防任务闪变；readInitialTheme 先例 defaults.ts:356）。
- 写：仅显式切换动作（点选 / 键盘激活）；**深链落地不写**——URL 是事实来源，写盘会与 §3.2 优先级打架；try/catch 静默（persistTheme :45-51 / persistLanguage i18n/index.ts:49-52 同口径：存储不可用仅影响下次访问）。
- 不入盘项：瞬态 UI（参数面板开合、tooltip 锁定、模拟运行态）——瞬态不入持久层先例＝strategyLegacyNotice（useCalculatorStore.ts:111-115）；路由值不入 share 载荷、不入情景库存档、不触碰 resetEpoch（同一条纪律原文口径）。
- 与语言 / 主题切换正交：changeLanguage 只重渲染文案并补写 aria（App.tsx:222-225 先例）、主题切换只走令牌注入（App.tsx:135-185）——两者均不读 / 写 wf-route；路由状态独立于界面偏好演化。
- 过期兼容：值不可解析 / 键越界 → 视同无存储（静默），回落链走 §3.2。版本字段暂不设——二键扁平结构无演进分叉；未来加键时仿 share v4 递增先例（share.ts:30-42）补 version。

---

## §6 自检记录（成稿会话实跑，2026-11-22）

1. 行数预算：`wc -l docs/research-wf03-routing.md` → 128 行（≤300 通过）。
2. 禁词扫描：`grep -Ein '<任务书13词面正则>' docs/research-wf03-routing.md` → 零命中（grep exit 1；正则原词表不在本文复写，防自污染）。
3. 令牌纪律：全文零令牌赋值、global.css 零写入；引用均带行号（本会话 grep 实测）。
4. 独有裁定值登记（非引用）：任务键 1–4/5 分域且 pro 内不绑任务键；Esc 仅 pro 消费；切换淡入 base 240ms 透明度-only；深链用 query 不用 hash；wf-route 仅二键、深链落地不写盘。
