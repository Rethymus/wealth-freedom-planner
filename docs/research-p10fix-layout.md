# P10fix 布局研究：矮视口 580 下限三形态预算 · E1/E2/E6 修复方向（research-p10fix-layout）

| 项 | 值 |
| --- | --- |
| 文档性质 | 信息架构研究（只产规格与预算，零施工） |
| 任务缺口 | E1：1366×768 / 1366×650 / 1280×720 自由刻度页触发回退横幅＋右列内滚＋`wf-slot` 裁切 84–110px（1440×900 / 1536×864 / 1920×1080 五页零滚动成立）；E2：`atlas.migrate.notice` 提示条覆盖任务切换栏（1440×900 与 1366×768 均现）；E6：语言维度未入验收矩阵，en 自由刻度页曾在 1440×900 溢出 92px（§10-11 在册） |
| 硬性下限（任务书给定） | 可用视口高度 ≥580 CSS px（任意宽度 ≥320）内，任何页面/面板/内层标签不得出现回退横幅、滚动容器或裁切；低于下限属物理极限，仅允许单行不遮挡提示，如实登记 |
| 输入物（本会话全读） | `docs/p10-spec.md`（§1 树/§9-A1/§10-10/§10-11）、`docs/research-p10-layout.md`、宪法 `docs/design-language.md`、`src/App.tsx`、`src/components/TaskPages.tsx`、`src/components/BasicCalculator.tsx`、`src/components/AdvancedPanel.tsx`、`src/styles/global.css`（全 2551 行）；佐证实读：`src/components/{hooks,slots,TaskSwitcher,RiskPage}.tsx`、`src/components/advanced/ReversePanel.tsx`、`node_modules/@arco-design/web-react/es/Message/{interface.d.ts,index.js}` |
| 范围红线 | 零新依赖（§10 红线 6 延续）；零滚动硬性下限 580 为本 spec 前提；本档不写实现代码；高度预算为静态推算（承 p10-spec 自检口径），A1 实测为唯一裁决 |

---

## §0 判据与口径

- **可用页高 A**：`A = 视口高 H − chrome`；chrome 三件 = 顶栏 C1＋任务切换条 C2＋内容区垂直 padding＋页根 margin-top（`global.css:569-627`：`.wf-layout` 100dvh flex 列、`.wf-main` overflow:hidden、`.atlas-page` margin-top 8）。浏览器 chrome 已由 100dvh 扣除（`global.css:570-571`）。
- **超预算处置唯一通道**：内容改由**页面/标签/槽切换承载**（叶切换、步骤分页、槽内分页——`slots.tsx` SegBar/SlotBox/SlotPager 既有词汇），禁止回退滚动与 overflow 裁切兜底（`global.css:630-636` 回退类与 `.wf-slot` overflow:hidden 均不得作为预算消化器）。
- **深矮档（height size class）**：`H < 850`（复用既有 `useShortViewport` 判定 `hooks.ts:137`；CSS 载体 `(max-height: 849.9px)` 先例 `global.css:2542`）。E1 三个破功视口（650/720/768）全部落入深矮档。
- **预算性质声明**：节点高度为静态推算（源码常量＋组件库 token＋R-4 实测锚点），逐值 ±8px；加总以「≤ A 且留 ≥8px slack」为准绳，实施后以 `scripts/zero-scroll-check.mjs` 判定②′（槽裁切显式拦截）为准。

## §1 三形态逐节点预算（下限 580）

### §1.0 chrome 常数（实测锚点 + 推算上限）

| chrome | 双栏 ≥1200 | 中栏 768–1199 | 单列 <768 | 依据 |
| --- | --- | --- | --- | --- |
| C1 顶栏 | 32 | 32 | 73 | 73 与 29 为 R-4 实测（<768 两行折行 / 768 收纳档）；≥790 完整态单行无实测，按控件高推算 ≤30 → **预算 32**（A1 复核项） |
| C2 切换条 | 52 | 52 | 44 | 44 为 R-4 实测（<768 desc 转 title 单行）；≥768 双行 = pad 8＋label 21＋gap 2＋desc 18 ≈ 49 → **预算 52**（未实测，A1 复核项） |
| 内容区 padding＋页距 | 32＋8 | 32＋8 | 16＋8 | `.wf-main` padding 8/16 与 ≥768 16（`global.css:589,594-598`）；`.atlas-page` margin-top 8（`global.css:618`） |
| **chrome 合计** | **124** | **124** | **141** | |
| **可用页高 A@580** | **456** | **456** | **439** | 580−124 / 580−141 |

### §1.1 双栏形态（≥1200，A=456）——整体不可达，改为高度驱动降级

| 节点 | 现值（本会话读码） | 580 预算 | 判定 |
| --- | --- | --- | --- |
| 右列输出卡固定区 | 卡头 46（`BasicCalculator.tsx:1065` ≥1200 渲染 title/extra）＋卡体 32＋hero 74（`global.css:1628-1636` hero≈74，`hooks.ts:135` 矮档 56 环）＋读数两行 50＋F3 44＋卡距 12（`global.css:754`） | 0＋24＋60＋46＋38＋12 | ✗ |
| F4 图槽 | ≥200（`BasicCalculator.tsx:102` 硬底线） | 200 | ✓ |
| 右列反向卡 | 228 / 矮档 **170**（`ReversePanel.tsx:246,250` 实读；`hooks.ts:135` 注释「228→190」为陈旧值，登记勘误） | 0（并入叶B F8 槽态） | ✗ |
| 左列输入全量区 | **742**（p10-spec §1.1 加总在册） | 0（整体退役） | ✗ |
| 右列加总 | 46＋32＋74＋50＋44＋200＋12＋170 = **628** | ≤456 | ✗ 超 172 |

**裁定（E1 根因）**：双栏右列 628 / 左列 742 > 456，580 下双栏形态**无解**；1366×650（A=526）右列差 628−526=**102**、1366×768（A=644）左列差 742−644=**98**——与缺口观察「裁切 84–110px」逐视口吻合（静态互证）。**修复 = 高度驱动形态降级**：双栏激活条件从 `min-width:1200`（`hooks.ts:119`）扩为 `min-width:1200 且 H≥880`（880 = max(742,628)＋124 chrome＋14 slack；1440×900 A=776≥628/742 ✓ 保持双栏，1200×800/1366×768/1280×720/1366×650 全部落叶树）。E1 三视口由此整体消除双栏溢出源。

### §1.2 中栏形态（768–1199 与降级后的 ≥1200 叶树，A=456；叶树同 §1.3 结构，控件取 pointer-fine 档）

> 下表为深矮档值；850≤H<880 的标准档中栏不加压缩亦成立（叶A 44＋32＋64＋50＋44＋200 = 434 ≤456；叶B 同式加总 456 贴线，slack 0 → 实施时叶B 沿用 margin 2 档，登记注记）。

| 页/叶 | 节点预算（深矮档值，加总 ≤456） | 加总 | slack |
| --- | --- | --- | --- |
| freedom 叶A | F0 38＋卡壳 24＋hero 60＋读数两行 46＋F3 38＋F4 200（进度说明行并入 F4 槽首行） | 406 | 50 |
| freedom 叶B | F0 38＋壳 24＋F7 38＋F8 200＋core 行 32＋anatomy 36＋share 行 40（中栏叶B 现无 share 宿主——`global.css:2046,2049` dock 仅 <768 放行，缺口登记） | 408 | 48 |
| life 最重组 | L1 38＋L2 38＋L3 120（轨迹组 120/面板组 68 分档）＋L4 38＋L5 200 | 434 | 22 |
| risk | K1 38＋K2 120＋K3 38＋K4 200（运行钮落 K1 复合行） | 396 | 60 |
| principles | P1 38＋P2 ≤190（节头 32＋槽 ≤158）＋P3 ≤163（节头 32＋槽 ≤115＋节间 16） | 391 | 65 |
| pro | R1 38＋R2 40＋R3 120＋R4 38＋R5 200 | 436 | 20 |

### §1.3 单列形态（<768，A=439；触屏 44 命中恒定，A11 清单不回退）

| 页/叶 | 节点预算（深矮档值，加总 ≤439） | 加总 | slack |
| --- | --- | --- | --- |
| freedom 叶A | F0 46＋卡壳 24＋hero 52（环 48）＋读数两行 46＋F3 46＋F4 200 | 414 | 25 |
| freedom 叶B | F0 46（复合行：两段叶条＋右端 share 图标位 44）＋壳 24＋F7 46＋F8 200＋core 行 48＋anatomy 32（**dock 行退役一档**） | 396 | 43 |
| life | 轨迹组 46＋L3 120＋L4 46＋L5 200 = 412；规划组 46＋46＋68＋46＋200 = 406 | 412 | 27 |
| risk | K1 46（复合行含运行钮）＋K2 120＋K3 46＋K4 200 | 412 | 27 |
| principles | P1 46＋P2 ≤190＋P3 ≤163 | 399 | 40 |
| pro | R1 46＋R2 40＋R3 96＋R4 46＋R5 200 | 428 | 11 |

### §1.4 深矮档压缩清单（H<850 统一生效；数值依据 §2 四体系紧凑档）

1. 分段/槽条 margin-bottom 8→2（`global.css:1228-1231` ≤480 档既有值扩为深矮档全档）；
2. 卡体 padding 16→12（`global.css:1234-1237` ≤480 档值扩档）；
3. 进度环 72→48 新档（`FreedomGauge` size 已参数化 `BasicCalculator.tsx:1108`），hero 行 52；
4. 进度说明行/空态引导行并入 F4 槽内容（槽内首行 caption，省 22）；
5. <768 dock 行（share/MC 运行钮，`global.css:2050-2059`）上收为叶条/分段条**右端复合图标位**（44 命中不变、信息路径零丢失——share/运行入口恒在且更靠上）；≥768 中栏叶B share 缺口同步以复合行补齐；
6. anatomy 行 margin 16→8、core 行 margin 8→4（`global.css:2469,939`）；
7. 读数槽分档：K2/R3 160→120、R3 pro 单列 96、life L3 轨迹组 120/面板组 68（主数行 32＋双指标 2×28 实容）；
8. principles 分节槽 ≤158/≤115（caption 12/18 档 = `global.css:1018-1022` 路线 (a) 既有降档）：E1 strict 8 行 144 ≤158 ✓；E3 market 9 行 153 ≤158 ✓（勘误注下沉 FieldTip）；E3 child/E4 loose ≤6 行 ≤115 ✓（同下沉）；E4 health 8 行 >115 → 与证据节互换到分节1；**E2 chain（EntryRows ≈820–1390）槽内不可容 → 走 p10-spec 红线 10 路线 (b) 条目内二级切换（概览摘要 1 行 | 分步 3 页×3 行 ≤158）**。

### §1.5 超预算节点汇总（现值 > 580 预算，需改承载/压缩；共 **14** 个）

- 双栏（4）：①左列输入全量区（742）②右列卡头（46）③右列 hero（非矮档 74：≥1024 容器数字主标题 48px 档，`global.css:780-784`）④右列反向卡（228；矮档 170 仍超右列余量）——处置 = §1.1 降级判据。
- 中栏（4）：①freedom 进度说明行（22，仅未填资产态）②freedom 中栏叶B share 无宿主（补复合行 40）③pro 读数槽 160（→120）④principles 分节槽超限（E1 strict/E2 chain/E3/E4，→§1.4-8）。
- 单列（6）：①freedom dock 行 52–60（→复合行）②freedom 进度说明行（同①并槽）③anatomy 行 44–65（→32，§4 单行上限保单行）④risk dock 行（→K1 复合行）⑤risk K2/pro R3 读数槽 160（→120/96）⑥life L3 读数槽 160（→68–120 分档）。

**三形态结论**：双栏 @580 整体超预算（降级后不占预算）；中栏五页加总 391–436 ≤456 全过；单列五页加总 396–428 ≤439 全过。低于 580 属物理极限：仅允许回退横幅以**单行、不遮挡**呈现（§3-2 修复后横幅不覆盖切换条），如实登记为 A1 人工走查项。

## §2 四体系紧凑密度可用做法（设计原则，零新依赖）

| 体系 | 可用做法（出处章节＋本会话取证方式） | 映射到本仓 |
| --- | --- | --- |
| HIG《Layout》布局指南（官方文档数据接口 JSON 抓取） | ① 渐进披露：「Use progressive disclosure to make layouts cleaner and easier to interact with.」（Visual hierarchy 节，HIG JSON API 原文抓取）→ 超预算内容进切换树即其实现；② 尺寸类两维独立：「compact or regular … horizontal and vertical」（Adaptability > Size classes）→ 高度维独立建档（height media query），不绑定宽度档；③「Keep functionality the same as size classes change … change the amount of functionality that's visible onscreen」→ 深矮档只减可见量、信息路径不删；④ Dynamic Type：「table rows … may need to grow in height so that text isn't cropped or doesn't overlap other content」→ 禁裁切，增高改为槽内分页 | §0 深矮档、§1.4-4/5/8 |
| TDesign《全局样式》尺寸/间距（官方仓库令牌源） | 组件高度档 `--td-comp-size-*` = 20/24/28/32/36/40、margin 档 `--td-comp-margin-*` = 2/4/8/12/16…（令牌源 `tdesign-common/style/web/theme/_size.less` 本会话 curl 实测）→ 存在 20–28 紧凑控件档与 2/4 margin 刻度 | §1.4-1/2/3 数值档依据（margin 2、控件 28 级） |
| Ant Design《定制主题》→ 配置主题 → 使用预设算法 | `theme.compactAlgorithm` 与 `[darkAlgorithm, compactAlgorithm]` 组合启用（docs/react/customize-theme.zh-CN.md 本会话 GitHub raw 实读）；compact 实现 = `controlHeight = controlHeight − 4`（`components/theme/themes/compact/index.ts` 实读）→ 控件高整档 −4px | §1.4-1/6（−4px 级外距收敛）、控件 44 命中保留不缩 |
| Semi Design Design Token「尺寸→高度」「间距」 | 控件高 small/default/large = 24/32/40；间距档 0/2/4/8/12/16/20/24/32/40（`packages/semi-theme-default/scss/variables.scss` 本会话 curl 实测；章节名经 semi.design/zh-CN/basic/tokens 页实读）→ 2/4/8 紧凑档 | §1.4-1/2（卡体 12＝8＋4、行距 4→2） |

原则提炼（四体系交集）：**密度是档位不是自由值**（控件高 24/28/32、间距 2/4/8 刻度）；**披露代替滚动**；**高度是独立维度**；**信息不删只减可见量**。组件高度选择器（size prop）与间距令牌全部为仓内既有值，零新依赖。

## §3 提示条与导航层叠修复（E2：提示条不得覆盖任务切换栏）

1. **迁移提示 Message**（`App.tsx:296-300` 现为 `Message.info(t("atlas.migrate.notice"))`）：Arco Message 默认 `position:'top'`（`es/Message/index.js:45` 实读）→ 顶部气泡压在 C2 切换条上（E2 1440×900/1366×768 均现的根因）。**修复**：改配置对象 `Message.info({ content: t("atlas.migrate.notice"), position: "bottom", duration: 4.5 })`——`position?: 'top'|'bottom'` 为组件库既有 API（`es/Message/interface.d.ts:58-60` 实读），零新依赖；底部气泡与顶部 chrome 空间正交，任何视口不遮挡切换条。
2. **A1 回退横幅**（`.wf-fallback-banner` `global.css:638-645`：`.wf-main` 内 absolute top:8 z-120——`.wf-main` 首子即 `.atlas-region > .atlas-switch-anchor`，横幅压住切换条与页首行）：**修复** = 改**常规流承载**——渲染位置从 `App.tsx:560-562`（`.wf-main` 顶层）移入 `.atlas-region`、置于 `.atlas-switch-anchor` 之后（flex:none 行）；回退态页根已放行滚动（`.wf-fallback-scroll` `global.css:634-636`），横幅占的是**已回退页面的可滚高度**，零滚动页永不渲染横幅 → 零滚动预算不受影响；去 absolute/z-index/pointer-events，宽度 100% 单行（≥480 单行，<480 允两行但不遮切换条——不遮挡由文档流天然保证）。低于 580 的物理极限场景亦满足任务书「单行不遮挡提示」。
3. **wasm 引导失败 Alert**（`App.tsx:563-570`）保留常规流原位：异常态例外路径（p10-spec §2.1 已登记），A1 判定以引导成功为前提。
4. **验收扩展（入 A1）**：①「提示不遮挡」程序化断言——活动 Message 容器 rect 与 `.atlas-switch` rect 不相交、`.wf-fallback-banner` rect 与 `.atlas-switch` rect 不相交；②A1 矩阵补 `1366×768 / 1366×650 / 1280×720` 三视口 × 语言维（§4），并断言深矮档下 `wf-fallback-scroll` 恒不出现。

## §4 语言维度预算（E6 根因：单行承载文案三语长度上限）

**上限公式**（本会话实测三语长度 + 槽几何推算）：CJK 字宽 ≈ 字号（12px caption/14px body）；EN ≈ 7px/字符（body）、6px（caption）。单行 CJK 上限 = ⌊槽内宽/字号⌋，EN 上限 = ⌊槽内宽/6或7⌋。槽内宽按最窄基准（320 视口）计算。

| 单行槽位 | 最窄内宽 | CJK 上限 | EN 上限 | 现值超标键（本会话脚本实测字符数 zh/zh-Hant/en） | 处置 |
| --- | --- | --- | --- | --- | --- |
| C2 tab label（<480） | ≈42px | 3（12px 档） | 6 | freedom 4/4/14、principles 4/4/17 | <480 短形态标签 2 字（刻度/轨迹/风险/原理/专业；与 L1 <480 短形态先例同构）＋label 降 12px |
| C2 tab desc（≥768 双行） | ≈248px（@1366） | 17 | 35 | proDesc en 41 | en desc ≤35 |
| F0 叶切换条两段 | ≈120px | 8 | 16 | outputTitle 17/17/52 | zh ≤8 字 / en ≤16（"Results"/"Inputs"） |
| F3/F7/K1/L4/R4 槽条段 | ≈120px | 8 | 16 | sensitivity.title en 27、mcTitle en 22、stepAssumption en 20 | en 段标签 ≤16（"Sensitivity"、"Monte Carlo"→"Simulation"） |
| L1/R1 分段条（<480 五段） | ≈42px | 3 | 6 | groupAnalysis en 14 等 | <480 短形态（先例在册：p10-spec §1.2 L1） |
| 预设 chips（4 格栅格） | ≈56px | 4 | 7 | en 6–7 边界 | 单行省略既有规则（`global.css:1806`）＋en 单词化（§10-11 已修，保持） |
| F2 摘要行（<768） | ≈264px | 16 | 34 | summaryPrefix 17/17/**76** | zh ≤16 字 / en ≤34 chars（压缩句式；**en 上限 34 = ⌊(264−21)/7⌋**：预留插值数字占位 W=21px＝**约定占位常量** ≈3 字符位（典型短形态「1.6」量级）——勘误：初版注「最短实值形态『0.0』3 字符」，node Intl 实证 formatNumber 尾零裁剪后 0 值实出形态为「0」1 字符（zh/en `format(0)` 均为 "0"；「整数不带小数点」注释＋实现 `format.ts:18-22`），「0.0」非其输出形态；数值节点 `wf-nowrap` 禁内断原子折行（`BasicCalculator.tsx:1136-1153`），原子块含单位后缀（en wanUnit="million CNY"，`en.ts:36` → en 最短原子块 "0 million CNY" 13 字符 ≈91px），prefix＋原子块同行单行严限 ⌊(264−4−91)/7⌋=24 不作门禁值、本门禁 34 只约束 prefix 自身宽度、残余折行归 A1 实测终审；修订前本列记 36 系 1 字符占位乐观界（⌊257/7⌋=36），与规范 §11.1 门禁 34 不一致，修订统一取 34）；否则换行破 §1 预算 46 |
| 公式解构行 | ≈264px | 22 | 40 | formulaRow 10/10/19（§10-11 已修） | 保持 ≤22/≤40（守成） |
| scrollFallback 横幅单行 | ≈264px | 19 | 43 | scrollFallback 19/19/**51** | en ≤43（"Viewport too short — switched to scroll view."） |
| migrate notice（改底部气泡 ≤2 行） | ≈0.9vw | 50（2×25） | 120（2×60） | migrateNotice 23/23/94 | zh ✓；en 94 ≤120 改底部后达标，不必缩 |
| P1 条目/步骤标签 | ≈120px | 8 | 16 | entryEvidence en 17 | en ≤16（"Evidence"） |

**规则与门禁**：①超标处置三级序——a) <480 短形态键（键值零改、新增短键走 §7 型预算）；b) 单行省略＋radio aria 全文（`global.css:820-826` 既有机制，仅限非导航装饰段）；c) 禁止换行加高（破预算即改承载）。②en 专项沿用 §10-11 先例（仅 en.ts 缩短，zh/zh-Hant 零改动）。③门禁落地：`check:data` 扩「三语键长度上限断言」（上限值即本表）；`scripts/zero-scroll-check.mjs` 与 A1 矩阵补语言维（zh-CN/en/zh-Hant）——§10-11 既定跟进项的实现路径。④语言切换往返文案随语言更新（A13 口径不变）。

---

## 自检记录（本会话实跑）

1. 行数：`wc -l docs/research-p10fix-layout.md` = 本文档行数 ≤320（收口前复跑登记于下表）。
2. 三语长度：`node %TEMP%/p10fix-scratch/measure.mjs`（本会话实跑，54 键 ×3 语）——§4 表全部数值出自该输出；脚本读 `src/i18n/locales/{zh-CN,zh-Hant,en}.ts`（注释剥离后 eval 对象字面量）。
3. 反向卡矮档值：`grep -n REVERSE_CARD_HEIGHT src/components/advanced/ReversePanel.tsx` → 246 行 228 / 250 行 **170**；`hooks.ts:135` 注释「228→190」与之相悖，登记勘误（以代码为准）。
4. Arco Message position：grep `node_modules/@arco-design/web-react/es/Message/interface.d.ts` → `position?: 'top' | 'bottom'`（:60）；`index.js:45` 默认 `'top'`。
5. 四体系出处取证方式：HIG《Layout》经官方文档数据接口抓取引文（JSON 端点路径 tutorials/data/design/human-interface-guidelines/layout.json；站点域名字面含禁词不落 URL，引用纪律同 research-ds-comparison.md 引用纪律行——厂商可写库名、含禁词子串的域名以自然描述替代）；TDesign `_size.less`、Semi `variables.scss`、Ant `customize-theme.zh-CN.md`/`compact/index.ts` 均 GitHub raw curl/gh 本会话实读；Ant seed controlHeight=32 为公开 token 表值，本会话未逐值复验 seed 文件（如实声明）。
6. 局限声明：①≥768 顶栏 32 与切换条 52 为推算预算（收纳档 29 实测、完整态无实测）；②节点高度静态推算未做浏览器实测；③双栏降级阈值 880、principles 槽值 158/115、pro R3 96 等待 A1 实测裁决；④未读 MonteCarloPanel/ScenarioPanel 全文，risk 页 K2 槽现值 160 取自 p10-spec §1.3 在册值。全部静态推算以 `scripts/zero-scroll-check.mjs` 实测为终审。
7. 修订轮登记（2026-11-25，复核 REJECT 后）：①禁词去品牌化改写四处（§2 表三行体系名＋本条前身来源域名——域名字面含禁词不落，纪律同 research-ds-comparison.md 引用纪律行），改后 `grep -inE` 13 词清单（词表见 p10fix-spec 附 A A-6 口径）复跑本文全文 0 命中（修订前 4 处，复核会话实测）；②§4 F2 行 EN 上限 36→34 与 p10fix-spec §11.1 门禁统一（34 = ⌊(264−21)/7⌋，W=21px 约定占位常量），同款勘误：「0.0」非 formatNumber 输出形态（node Intl 实证 0 值裁尾零得「0」1 字符），原子块含单位后缀的口径边界一并登记。
