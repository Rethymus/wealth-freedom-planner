# WF-03 高级区重构施工台账（九面板→四任务迁移 · 令牌准入 · 深链接兼容）

| 项 | 值 |
| --- | --- |
| 文档性质 | WF-03 施工前台账：面板归属、令牌准入施工清单（含对比度全矩阵实算回填）、深链接兼容映射、i18n 键预算、S1–S26 回归标记——只登记与实算，不写实现代码，src/ 零写入 |
| 输入物 | `docs/design-atlas-brief.md` §一（四任务 IA 与硬约束）/§七（发布阻断门）；`docs/atlas-tokens-evolution.md`（预审 20 项 + 零变更断言 3 项，§0 验算纪律）；`docs/research-ds-comparison.md`（ADR D-B1…D-C 裁定）；`docs/research-atlas-prototype.md` §1–§6（四任务页容器规格）；`docs/design-language.md` §2/§2.1（S 项状态与落点）；仓库源码实测（行号见各表，本会话直读） |
| 红线 | 九高级功能全部有可访问新入口 + 专业模式直达（brief §一/§七）；share v4+ 兼容、resetEpoch 回落延续；S1–S26 零回退；本台账不放宽任何 CI/门禁 |
| 实算口径 | WCAG 2.1 相对亮度法（tokens 表 §0.1 同式）：正文 4.5、大字与非文本 3.0；node 脚本实算（脚本存于仓库外 `F:\ZCodeData\.wf03-tmp\contrast.mjs`，命令与结论见 §6） |

---

## §1 九面板→四任务归属表

现挂载锚点 = `src/components/AdvancedPanel.tsx:48-76` 的 GROUPS（组 id：plan/housing/analysis；组内 key 与历史折叠版一致，分享链接/情景库不引用面板 key——AdvancedPanel.tsx:32 注释）。新归属按 brief §一 表 + 原型 §1–§4。

| # | 面板（key） | 现挂载锚点 | 新归属（任务页） | 组件本体动壳？ | 参数状态切片（share v4 / store） |
| --- | --- | --- | --- | --- | --- |
| 1 | 反向估算（reverse） | GROUPS plan 组首项：AdvancedPanel.tsx:53 | 自由刻度·右栏 L3 交叉工具卡（原型 §1.1） | 否——整面板迁挂，表单/结果零改 | `reverse`（share.ts:141-144 → store reverseInputs） |
| 2 | 打工模拟（accumulation） | plan 组：AdvancedPanel.tsx:54 | 人生轨迹·积累组（原型 §2.1 五组之一） | 否——迁挂组内标签，hidden 非卸载沿用 | `accumulation`（share.ts:233-236，v4 含 sustainYears） |
| 3 | 社保养老金（pension） | plan 组：AdvancedPanel.tsx:55 | 人生轨迹·养老组 | 否——同上 | `pension`（share.ts:238-241，v4 含 targetRetireAge） |
| 4 | 贷款计算（loan） | housing 组：AdvancedPanel.tsx:62 | 人生轨迹·负债组 | 否——同上 | `loan`（share.ts:145-149，method 枚举 share.ts:247） |
| 5 | 买房收租（rental） | housing 组：AdvancedPanel.tsx:63 | 人生轨迹·收租组 | 否——同上 | `rental`（share.ts:150-153） |
| 6 | 蒙特卡洛模拟（monte-carlo） | analysis 组：AdvancedPanel.tsx:70 | 风险实验室·主模拟+支取策略（原型 §3.1） | 壳重构·本体零改——字段拆落 L2 参数区、图落 L3；store 切片/WASM 调用/键零改 | `monteCarlo`（9 键+strategy/threshold/percent，share.ts:154-227）+ `monteCarloReturnMode`/`monteCarloSeriesId`（share.ts:228-229,248-249） |
| 7 | 税务估算（tax） | analysis 组：AdvancedPanel.tsx:71 | 人生轨迹·税务组 | 否——迁挂 | `tax`（share.ts:230-232；bands 逐项校验 share.ts:250-258） |
| 8 | 多情景对比（scenario） | analysis 组：AdvancedPanel.tsx:72 | 风险实验室·情景库落 L2 左栏、对比表落 L3（原型 §3.1） | 壳重构·本体零改——载入路径 applyShareState 零改 | 无专属载荷切片——经情景库存档（scenarios.ts），载入复用 store.applyShareState（useCalculatorStore.ts:272-295）；ShareState 十一键无 scenario 键（share.ts:52-65 对照） |
| 9 | 公式原理（insights） | analysis 组：AdvancedPanel.tsx:73 | 原理档案·主阅读页（原型 §4.1）；其在风险实验室的「洞察」指 mc 策略口径注（已内嵌蒙特卡洛面板），**非本面板搬迁** | 壳重构——小节重排为 L1–L4 阅读流；insights.ts 数据源与键零改 | 无业务切片（纯展示，InsightsPanel.tsx:2-3 头注） |

- 基础公式（BasicCalculator，非九面板）迁挂自由刻度 L1/L2：`baseline`（share.ts:137-140）与 `progressCurrentAssets`（share.ts:237）切片随迁。
- 组件壳退役面：AdvancedPanel.tsx:135-176 的 Card+Radio+Tabs 壳在默认视图由四任务导航取代；其「分段+组内标签 hidden 非卸载」模式在人生轨迹页内复用（原型 §2.1，ADR D-B3），专业模式入口保留原壳（brief §一 硬约束）。
- ADR 约束（research-ds-comparison.md §四）：不新增运行时依赖；折叠不得销毁 DOM（B3）；分步引导为渐进披露非强制流程（D-B1）。

---

## §2 令牌施工清单（tokens 表全表逐项 + 对比度全矩阵实算回填）

### 2.1 实算与复核方法

- 命令：`node F:/ZCodeData/.wf03-tmp/contrast.mjs`（WCAG 2.1 线性化亮度 + CR；合成底按 rgba 叠加现值实算：浅 tint 合成 `#EAECED`、深材质最不利合成 `#353536`、深 tooltip 材质 `#626467`、深 mint 合成 `#0F323C`，输出见 §6）。底值出处：浅四底 global.css:59-62、深三表面 :323-325、深材质 :338-350。
- 现值门禁基线：`npm run check:a11y` → 「23 组令牌对，白名单外违规 0 处」（本会话实跑；提案值不在其覆盖内，实施轮须扩对复验）。
- 预审表声明值复核：P1–P24 + 防混用值共 34 项全部复算，**逐项吻合（偏差 ≤0.005），零更正**——预审表 §1.2 数值可直接作为施工依据。

### 2.2 新色 × 既有浅色四底（实算回填；✓=过 4.5 正文，图形=仅过 3.0）

| 前景（用途） | →sunken `#F8F7F3` | →inset `#F2F3F5` | →surface `#FFFFFF` | →tint合成 `#EAECED` | 结论 |
| --- | --- | --- | --- | --- | --- |
| Ink Navy `#102331`（文字） | 14.99 ✓ | 14.47 ✓ | 16.07 ✓ | 13.56 ✓ | 通过 |
| Teal `#087F78`（强调） | 4.54 ✓ 贴线 | 4.38 ✗ | 4.86 ✓ | 4.10 ✗ | 需约束 |
| Copper 原值 `#A56C32`（图形） | 4.09 图形 | 3.95 图形 | 4.38 图形 | 3.70 图形 | 需调值 |
| Copper 提字 `#966028`（文字） | 4.90 ✓ | 4.73 ✓ | 5.25 ✓ | 4.43 ✗ | 提字成立·着色底禁文字 |
| Slate 原值 `#8195A3`（图形） | 2.90 ✗ | 2.80 ✗ | 3.11 图形 | 2.62 ✗ | 需调值 |
| Slate 提字 `#5E7484`（文字） | 4.55 ✓ | 4.39 ✗ | 4.88 ✓ | 4.11 ✗ | 提字成立·凹面着色底禁文字 |
| Teal 深候选 `#26AFA6`（防浅用） | 2.52 ✗ | 2.44 ✗ | 2.70 ✗ | 2.28 ✗ | 禁浅用 |
| Copper 深候选 `#C48A4F`（防浅用） | 2.76 ✗ | 2.67 ✗ | 2.96 ✗ | 2.50 ✗ | 禁浅用 |

### 2.3 新色 × 既有深色三表面＋材质（实算回填）

| 前景（用途） | →sunken `#17171A` | →inset `#1C1C1F` | →surface `#232324` | →材质合成 `#353536` | 结论 |
| --- | --- | --- | --- | --- | --- |
| Teal 深候选 `#26AFA6`（文字） | 6.61 ✓ | 6.29 ✓ | 5.81 ✓ | 4.53 ✓ 贴线 | 通过·材质面复验 |
| Copper 深候选 `#C48A4F`（文字） | 6.04 ✓ | 5.74 ✓ | 5.31 ✓ | 4.14 ✗ | 需约束·材质面限大字/图形 |
| Slate `#8195A3`（文字） | 5.76 ✓ | 5.47 ✓ | 5.06 ✓ | 3.94 ✗ | 需约束·材质面限大字/图形 |
| Teal 浅值 `#087F78`（误用警示） | 3.68 ✗ | 3.50 ✗ | 3.23 ✗ | 2.52 ✗ | 禁混用（双向） |

### 2.4 增补实算（预审矩阵未列，本轮补）

| 组合 | 实算 | 结论 |
| --- | --- | --- |
| 现次级文字 `#646E7A` → Soft Mint `#DCEEE8` | 4.30 ✗ 正文 | **C-6 新约束**：区间底上的现次级文字跌破正文，元信息须改用正文/三级色（现三级 `#4E5969` → Soft Mint 5.90 ✓） |
| 现深正文/次级/三级 → 深mint合成 `#0F323C` | 12.27 / 6.24 / 4.52 ✓（三级贴线） | C-6 深合成底对现深文字三档全过；三级贴线实施轮复验 |
| Copper 深候选 → tooltip 材质 `#626467` | 2.01 ✗（Teal 深候选 2.19 ✗） | tooltip 材质为白字专有体系，提案色不落位（与预审口径一致） |
| 现浅正文/次级/三级 → Paper `#F6F8F7` | 15.12 / 4.86 / 6.66 全 ✓ | C-2 提案画布不伤现浅文字体系 |

### 2.5 逐项施工结论（tokens 表 20 项 + 零变更断言 3 项）

| 项 | 验算结论 | WF-03 施工动作 |
| --- | --- | --- |
| C-1 Ink Navy | **通过**：浅四底文字全过（§2.2）；深色作画布时现深文字三档全过（14.47/7.36/5.34） | 可入 §5.1 三步准入；配套深色表面三档提题族**实施前验算**（预审已标） |
| C-2 Paper | **通过**：现浅文字三档全过（§2.4） | 可入准入；改值键，与 C-1 成对评审 |
| C-3 Signal Teal | **需调值（按底约束）**：浅色文字限 sunken/surface 底（inset 4.38、tint 4.10 跌破）；深色用提亮 `#26AFA6`（四面过、材质 4.53 贴线）；深值禁浅用（Paper 2.54） | 准入时把「文字限画布/卡底」写进组件取值处；扩对复验 |
| C-4 Copper | **需调值**：浅原值仅达图形口径（四底 3.70–4.38）→ 文字用途改 `#966028`；深候选材质面 4.14 限大字/图形 | 提字值随准入入对；材质面用途约束回写五要素 |
| C-5 Slate | **需调值**：浅原值仅白卡图形 3.11，其余底全禁 → 文字改 `#5E7484`；深色原值可直用（材质 3.94 限大字/图形） | 同上 |
| C-6 Soft Mint | **需调值（约束增补）**：浅值作底时现次级文字 4.30 跌破（§2.4 新实算）；深合成底全过但三级贴线 | 区间底约束入五要素；深合成 `rgba(8,127,120,0.16)` 随定稿底复验 |
| T-1…T-6 | 排版静态层复用既有文字/表面色对（P4/P5/P16–P18 已复算达标），无新增验算对 | 按原型 §0.5：准入前一律现四级值；新键候选各 +0.05KB 级，实施轮过 check:size |
| S-1…S-3 表面 | **通过（零新增键）**：三层全部映射既有令牌（sunken/surface/hairline/shadow/材质挂点） | 仅命名/语义对齐；S-3 边界收敛条款（密集数字恒实底）入 spec |
| M-1…M-5 动效 | 带内断言：现三档 120/240/360 落 brief 三类带内（360 仅 S18 沿用）；无色值不涉对比度 | 零新增时长键零改值；M-4/M-5 为候选纪律，立项另走 §5.1 |
| 零变更断言 3 项 | 间距 4/8/…/48 ＝现值；tabular-nums＝S3 常驻；阅读宽 640–760＝非令牌 | 零施工，实施轮零动作 |

**总结论**：六色无一可浅/深同值全场景直用——C-1/C-2/C-6（表面类）以「浅文字/底＋深底」分工成立；C-3/C-4/C-5（前景类）必须按主题拆双值并按 §2.2–§2.4 的底约束取用。**全部键实施轮以 check:a11y 扩对复验零违规才准出**（预审 §5 清单第 3 项 + S17 前置第 7 项一并执行）。

---

## §3 深链接与分享兼容映射（share v4 × 新 IA）

### 3.1 现行解析链路（迁移不动点）

`App.tsx:109-126` handleHash（首挂载 + hashchange）→ `store.applyShareState`（useCalculatorStore.ts:272-295）一次写入 11 切片 → 各面板经 store 读值。**该链路与导航解耦**：切片写入不依赖面板挂载位置，四任务化零改动。share 切片不含面板位置信息（AdvancedPanel.tsx:32 注释），GROUPS 属组件本地 useState（AdvancedPanel.tsx:85-87），不入 URL。

### 3.2 v4 字段 × 新 IA 回落映射

| v4 载荷字段（校验键出处） | 消费面板 | 新 IA 归属 | 增强态深链（query 通道，见 §3.3） |
| --- | --- | --- | --- |
| `baseline`（share.ts:137-140，7 键） | BasicCalculator 基础参数 | 自由刻度 L2 | 默认落点，零路由 |
| `progressCurrentAssets`（share.ts:237,246） | 进度环（BasicCalculator） | 自由刻度 L1 | 默认落点，零路由 |
| `reverse`（share.ts:141-144，6 键） | ReversePanel | 自由刻度 L3 | 默认落点，零路由 |
| `loan`（share.ts:145-149 + method :247） | LoanPanel | 人生轨迹·负债 | `?task=life` |
| `rental`（share.ts:150-153，10 键） | RentalPanel | 人生轨迹·收租 | `?task=life` |
| `monteCarlo`（share.ts:154-227）+ `monteCarloReturnMode`/`monteCarloSeriesId`（:228-229,248-249） | MonteCarloPanel | 风险实验室 | `?task=risk` |
| `tax`（share.ts:230-232 + bands :250-258） | TaxPanel | 人生轨迹·税务 | `?task=life` |
| `accumulation`（share.ts:233-236，v4 12 键缺一即整体 null） | AccumulationPanel | 人生轨迹·积累 | `?task=life` |
| `pension`（share.ts:238-241，v4 8 键） | PensionPanel | 人生轨迹·养老 | `?task=life` |
| （无字段）情景库存档载荷 | ScenarioPanel | 风险实验室 L2 | 载入复用 applyShareState（ScenarioPanel.tsx:152），路径零改 |

- 「旧格式链接在新导航下仍回落正确面板」的兑现口径：**兼容态＝裸 `#s=` 恢复全部切片 + 落自由刻度默认**——载荷不含面板位置信息（AdvancedPanel.tsx:32 注释；现状也无自动跳转），参数全量写入 store 后经新导航到归属面板即可见（切换不丢输入，hidden 非卸载先例 AdvancedPanel.tsx:145-148）；自动跳转属增强态，须 URL 显式携带 `?task=`，不按载荷内容启发式推导。

### 3.3 面板 key → 路由键映射（对齐路由交付物）

路由通道裁定沿用同轮姊妹交付物 `docs/research-wf03-routing.md` §3.1：**query 参数（`?task=<id>[&panel=<key>]`），hash 通道由分享载荷独占**（`#s=`，share.ts:46/:278；锚点改写 hash 冲突先例 research-advanced-nav §0#1）——两者同 URL 并存（`?task=risk#s=...`）互不触碰。本台账原稿「hash 内追加 task 段」提案据此**作废**（会侵占 hash 独占通道）。路由 id 取值 freedom | life | risk | principles | pro；`panel=` 仅在 task=pro 消费且取值＝九面板现行 key 原文（routing §2.2#3「面板 key 不变」）。9 个旧 key × 两通道映射：

| 旧 key（AdvancedPanel.tsx:53-73） | task=pro 深链 | 新 IA 归属任务（task=） |
| --- | --- | --- |
| reverse | ?task=pro&panel=reverse | freedom |
| accumulation | ?task=pro&panel=accumulation | life |
| pension | ?task=pro&panel=pension | life |
| loan | ?task=pro&panel=loan | life |
| rental | ?task=pro&panel=rental | life |
| monte-carlo | ?task=pro&panel=monte-carlo | risk |
| tax | ?task=pro&panel=tax | life |
| scenario | ?task=pro&panel=scenario | risk |
| insights | ?task=pro&panel=insights | principles |

- 非法值回落沿用 routing §3.2 分级：路由越界静默归 freedom / pro 首面板（不弹提示——路由无数据损失，与分享损坏警示 App.tsx:115-118 分级）；resetEpoch 链路（useCalculatorStore.ts:333 → BasicCalculator.tsx:373-380,548）路由层零触碰。

### 3.4 损坏/旧版本回落与 resetEpoch（延续，零改动）

- 版本门：`obj.v !== 4` → null（share.ts:135）；v1–v3 存量链接延续既有「一次性失效、重新生成」决策（share.ts:31-42 注释先例）。
- 损坏回落：App.tsx:115-118 resetBusinessInputs + 一次提示；resetEpoch 递增（useCalculatorStore.ts:333）→ FreedomGauge 清档位与闩锁（BasicCalculator.tsx:373-380）→ 字段重挂载（store:202-205 注释口径）。四任务化不触及。
- 正名规范化：`inflation_uplift` → `fixed`（share.ts:165-173）+ strategyLegacyNotice 瞬态标志（store:292）——面板无关，迁移零影响。
- 「链接恢复后联动态解绑」：accumulationTargetSynced=false / pensionMonthsSynced=false（store:288,291）——新 IA 下参数面板归属变了，解绑语义不变。

---

## §4 i18n 键预算（净增估算，三语）

基准：advanced 块现 22 键（zh-CN.ts:117-141：cardTitle + 3 组 label + tabsKbdHint + 9×(title+desc)）；键结构三语同构为既有契约（zh-CN.ts:2-7）。

| 新增块 | 键 | 数量 |
| --- | --- | --- |
| atlas.nav | freedom/life/risk/principles 各 label+desc（镜像 panel title+desc 模式；label 兼作切换条 role=tab 的可见名） | 8 |
| atlas.pro | 专业模式入口 label + desc + 返回新导航 label（Esc 退出口径，routing §1.3） | 3 |
| atlas.migrate | 一次性迁移说明（默认视图换导航的提示，含关闭动作文案） | 1 |
| **合计** | | **12 键 × 3 语 = 36 条** |

- 零新增复用：四任务页内面板标题/描述沿用既有 advanced.*Title/Desc 18 键（不搬块不改名）；损坏链接/正名提示沿用 share.restoreIgnored / share.strategyLegacyNotice（zh-CN.ts:679-680）；分享恢复成功沿用 share.restored（App.tsx:113）——深链接定位**不新增提示**（routing §3.2 分级裁定：路由无数据损失不弹提示）。
- 不删键：advanced.groupPlan/groupHousing/groupAnalysis（zh-CN.ts:119-121）在专业模式 GROUPS 内仍被引用（AdvancedPanel.tsx:51,59,67），保留。
- 字节估算：12 键中位约 45 B/串（zh 串均长参照 advanced 块现状）→ 三语 raw ≈1.6KB、gzip ≈0.8KB（**估算值**，实施轮以 check:size 实测为准，超限走既有降档顺序纪律）。

---

## §5 S1–S26 受迁移影响标记表

状态列：✅=已落地、⛔=P6 门禁降档未落地（design-language.md §2.1）、－=P5 前让位未立项。影响=是 指宿主组件/挂载层级在本次重构中移动或承载容器变化，须按回归锚点验收。

| # | 状态 | 宿主/现锚点 | 影响 | 回归锚点（影响项） |
| --- | --- | --- | --- | --- |
| S1 | ✅ | 进度环（BasicCalculator）→自由刻度 L1 | 是 | BasicCalculator.tsx:327-354,382,422；global.css:1244 |
| S2 | ✅ | 达成脉冲（同宿主） | 是 | BasicCalculator.tsx:339-362,404,437；global.css:1262-1269 |
| S3 | ✅ | 常驻排印规则（global.css 8 处） | 否 | 随类走，迁移零触及（回归抽查 tabular-nums 计数） |
| S4 | ✅ | 行级 hover 读数 | 是 | global.css:1220-1230（敏感性/洞察行迁自由刻度 L3/原理档案） |
| S5 | ✅ | 复制确认（分享按钮） | 是 | BasicCalculator.tsx:554,663-665,1056,1063（按钮入口位随页布局） |
| S6 | ✅ | 空态图形 4+1 处 | 是 | MonteCarloPanel.tsx:676,917；AccumulationPanel.tsx:614；ScenarioPanel.tsx:287；BasicCalculator.tsx:740 |
| S7 | ✅ | 分组左标线 | 是 | BasicCalculator.tsx:830；InsightsPanel.tsx:44-50；TaxPanel.tsx:231 |
| S8 | － | 让位预算未立项 | 否 | 不适用 |
| S9 | ✅ | 输出卡计算徽标 | 是 | BasicCalculator.tsx:538,690；global.css:1292-1296 |
| S10 | ✅ | ▲/▼ 方向冗余 | 是 | BasicCalculator.tsx:275-276,290-291,1029-1032；RentalPanel.tsx:610-612 |
| S11 | ✅ | 深色环线抬升 | 是 | BasicCalculator.tsx:407；global.css:68,324,1280-1285 |
| S12 | － | 让位预算未立项 | 否 | 不适用 |
| S13 | ✅ | 诚实进度尺（进度环真实百分比，P5 前已落地资产） | 是 | BasicCalculator.tsx:359-380（FreedomGauge）；zh progress.caption（zh-CN.ts:113） |
| S14 | ✅ | 乘数段位徽标 | 是 | BasicCalculator.tsx:563-583,777-778 |
| S15 | ✅ | 目标线叙事标注（打工模拟→人生轨迹） | 是 | AccumulationPanel.tsx:91-93,555 |
| S16 | ✅ | 输出卡因果闪亮 | 是 | hooks.ts:302；BasicCalculator.tsx:621,624-628；global.css:1354-1366 |
| S17 | ⛔ | 未落地；原型两处挂载点（自由刻度敏感性 §1.1、公式解构 §5.2） | 是·前置 | design-language.md:109（⛔状态）；WF-03 施工前须过 §5.1 三步准入+复测门禁，未准入走描边/文字加粗通道（tokens 表 §5 第 7 项） |
| S18 | ✅ | 六面板主数渐近滚动 | 是 | hooks.ts:205,218-219；ReversePanel.tsx:68；LoanPanel.tsx:52；RentalPanel.tsx:264；PensionPanel.tsx:67；MonteCarloPanel.tsx:292；AccumulationPanel.tsx:232 |
| S19 | ✅ | 输出卡克制悬浮 | 是 | global.css:1377-1384 |
| S20 | ✅ | 标签指示条滑动（Tabs 动画） | 是 | AdvancedPanel.tsx:162（默认导航被四任务取代；专业模式保留须回归） |
| S21 | ✅ | 数字键切组 1/2/3 | 是 | AdvancedPanel.tsx:99,154（同上；人生轨迹五组复用时键位序=新组序须复验） |
| S22 | ✅ | 主题圆形揭示（App 顶栏） | 否 | App.tsx:45-64,90-96——IA 迁移不触及顶栏 |
| S23 | ⛔ | 未落地（ScenarioPanel.tsx:109 降档注释） | 否 | 零行为面；注释随文件迁移，立项时按新挂载点走 §5.1 |
| S24 | ✅ | 字段错误左标线（全局 CSS） | 否 | global.css:1421——类承载，与挂载位置无关 |
| S25 | ✅ | 图表 hover 读数（5 图） | 是 | BasicCalculator.tsx:168；MonteCarloPanel.tsx:327,351,752,927；RentalPanel.tsx:349；AccumulationPanel.tsx:237；global.css:1435 起 |
| S26 | ⛔ | 未落地（hooks.ts:7 降档注释） | 否 | 零行为面；若随新分享入口立项另走 §5.1 |

**统计**：受影响 19 项（含 S17 前置）；不受影响 5 项（S3/S22/S23/S24/S26）；不适用 2 项（S8/S12）。全部影响项的降级链（reduced-motion 双闸）随迁不改——回归时逐项验证降级态与落地态同轮通过。

---

## §6 自检记录（本会话实跑，2026-11-22）

1. 对比度实算：`node F:/ZCodeData/.wf03-tmp/contrast.mjs`（脚本在仓库外；输出 §2.2–§2.4 全部数值与合成底 `#EAECED`/`#353536`/`#626467`/`#0F323C`）。声明值复核：34 项（P1–P24+防混用）逐项吻合偏差 ≤0.005，零更正；矩阵 20 组合与预审 §1.2 逐值吻合；增补 4 组新实算（§2.4）。
2. 现值门禁：`npm run check:a11y` → 「静态档对比度审计通过：23 组令牌对，白名单外违规 0 处」。
3. 锚点核验：AdvancedPanel GROUPS 九面板行号、share.ts v4 校验键行号、store applyShareState/buildShareState 行号、App.tsx hash 处理行号均为本会话直读；S 项锚点录自 design-language.md §2.1 收口实测（未逐条重跑 grep，如实声明）。
4. 同轮交付物对齐：§3 深链通道对齐 `docs/research-wf03-routing.md` §3.1（query 非 hash；本稿原 hash 追加提案作废，避免侵占 `#s=` 独占通道）；§4 键预算剔除「定位提示」键（对齐 routing §3.2 路由不弹提示分级）。两文档冲突点仅此两处，已收敛。
5. 行数与禁词：`wc -l` 与 13 词面不区分大小写全文扫描（正则按任务书原词表，不在本文复写）结果见提交说明；零施工声明：src/ 本会话零写入。
