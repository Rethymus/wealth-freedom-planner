# P10fix 实现规范：矮视口零滚动收口 · 提示条层叠修复 · 共享参数单源化 · 空白面板修复 · 语言维入矩阵

| 项 | 值 |
| --- | --- |
| 文档性质 | 实施规范（施工蓝图；本文档轮次零施工，不写实现代码；行号锚点均为起草会话 grep/Read 实测） |
| 输入物（起草会话全读） | `docs/research-p10fix-census.md`（普查/单源机制/E5 根因）、`docs/research-p10fix-layout.md`（三形态预算/层叠修复/语言预算）、`docs/p10-spec.md`（P10 终态含收口登记 R-1–R-6）；源码实读：`src/App.tsx`、`src/store/useCalculatorStore.ts`、`src/services/share.ts`、`src/data/{defaults,presets}.ts`、`src/components/{hooks,BasicCalculator,AdvancedPanel,TaskSwitcher}.tsx/.ts`、`src/components/advanced/{ReversePanel,AccumulationPanel,MonteCarloPanel}.tsx`、`src/styles/global.css`（关键区段）、`scripts/{zero-scroll-check,check-share,check-data}.mjs`、`src/i18n/index.ts`；佐证实读：`node_modules/@arco-design/web-react/es/Tabs/{tab-content.js,tab-pane.js}` |
| 用户诉求（验收锚定） | U1 全站零滚动：任何内容一屏可见，至多页面切换，**原理档案不留例外**；U2 预设与全部参数联动：任何页面/任何面板不得残留与预设矛盾的参数；U3 核心参数单源：名义回报率、通胀率等只有一个真源，无独立副本；U4 四任务导航 + 副行描述零改动（`TaskSwitcher.tsx` diff 为空） |
| 缺口清单（E1–E6） | E1 矮视口零滚动破功（1366×768 / 1366×650 / 1280×720 回退横幅 + 右列内滚 + `.wf-slot` 裁切 84–110px）；E2 迁移提示条覆盖任务切换栏；E3 联动未覆盖专业面板（子女预留 ¥580000.00 残留）；E4 反向估算回报/通胀独立副本；E5 专业模式分析工具四标签空白卡；E6 语言维未入验收与门禁矩阵 |
| 硬性下限（任务书给定） | 可用视口高度 ≥580 CSS px（任意宽度 ≥320）内，任何页面/面板/内层标签不得出现回退横幅、滚动容器或裁切；低于下限属物理极限：仅允许**单行、不遮挡**提示，如实登记 |
| 范围红线 | ①不装新依赖（package.json dependencies/devDependencies 零变化，仅 scripts 块新增两条 npm script）；②公式与数据流不碰——`calc*` 调用面与 wasm 导出面零改动，三个面板切片（reverseInputs / monteCarloInputs / accumulationInputs）默认值与数值语义零变化，本轮 store 增量 = 4 个布尔口径标志；③U4 四任务导航与副行描述零改动；④槽等高互换契约延续（p10-spec §2.3），禁止滚动与裁切兜底 |

---

## §1 逐缺口修复方案（E1–E6：根因 → 改法 → 回归风险）

### §1.1 E1 矮视口零滚动破功

- **根因**：双栏形态激活纯宽度判定——`WORKBENCH_MEDIA_QUERY = "(min-width: 1200px)"`（`src/components/hooks.ts:119`），无高度维条件。双栏左列输入全量区静态预算 **742px**（p10-spec §1.1 加总在册）、右列 **≈628px**（research-p10fix-layout §1.1：卡头 46＋卡体 32＋hero 74＋读数两行 50＋F3 44＋F4 图 200＋卡距 12＋反向卡矮档 170），而 1366×768 可用页高 A=768−124=644 < 742（差 98）、1366×650 A=526 < 628（差 102）、1280×720 A=596 < 628（差 32）——静态互证与实测「裁切 84–110px、右列内滚、回退横幅」同源（research-p10fix-layout §1.1 静态推算，A1 实测为终审）。溢出检出后由 A1 守卫（`App.tsx:111-154`）挂 `wf-fallback-scroll`（global.css:634-636）放行滚动 + 渲染横幅（`App.tsx:560-562`），右列反向卡被 `.wf-slot` overflow:hidden（global.css:856-862）裁切。
- **改法（高度驱动形态降级）**：`hooks.ts:119` 查询串扩为 `"(min-width: 1200px) and (min-height: 880px)"`。880 = max(左列 742, 右列 628) ＋ chrome 124（§2.1）＋ slack 14。落点唯一：该 hook 是双栏形态的唯一激活路径（`.wf-freedom-split` 无 CSS media query 副本，由 `BasicCalculator.tsx:1326/:1354` 的 `isWorkbench` 分支单点渲染）。视口归属：1440×900 / 1920×1080（≥880）保持双栏；1536×864（864<880）**降为叶树**（静态余量 −2 落在逐值 ±8px 容差带内不构成保证，降级换预算内确定性，登记为有意变更）；1366×768 / 1366×650 / 1366×620 / 1280×720 / 1200×800 全部落叶树（1024×768 宽度档本就 <1200，恒为叶树不受影响）——叶树逐节点预算见 §2.3/§2.4，580 下限内全过，E1 三视口的溢出源（双栏双列 742/628）整体消除。
- **连带登记**：`useIsWorkbenchViewport` 三处消费点（`BasicCalculator.tsx:522` BreakdownTable 键值行形态、`:575` 树形态、`ReversePanel.tsx:147` 反向读数 Descriptions 列数）随查询串一并获得高度维——H<880 时取窄形态分支，与宽度降级同向、信息零丢失；`useShortViewport`（H<850，`hooks.ts:137`）在叶树形态继续生效（龙卷风图 180 档 `BasicCalculator.tsx:261`、环 56 `:1108`、反向卡 170 `ReversePanel.tsx:250,:288`），「双栏 ∧ 矮档」组合成为空集，其注释级理由（`hooks.ts:135`、`BasicCalculator.tsx:590-592`）随本轮勘误（矮档值以代码为准：反向卡 228/170，`ReversePanel.tsx:246,:250`）。
- **回归风险**：①1536×864 与 1200×800 用户从双栏转叶树——信息全量可达、多一次叶切换，零滚动由 §2 预算＋A1 矩阵保证；②双栏专用样式（`.wf-freedom-split` global.css:738-747）在 H<880 成惰性代码，本轮不删（回滚通道保留），登记死代码窗口；③矮档大数字 40px 规则（global.css:786-792 media＋container 双条件）在叶树形态继续命中，§2.3 叶A hero 预算按 60 计已覆盖。

### §1.2 E2 提示条遮挡任务切换栏

- **根因（两处同族）**：①迁移提示 `Message.info(t("atlas.migrate.notice"))`（`App.tsx:296-300`）走组件库默认 `position:'top'`（`es/Message/index.js:45` 实读；`interface.d.ts:58-60` 提供 `position?: 'top'|'bottom'`），顶部覆盖层压在 C2 切换条上（1440×900 与 1366×768 均现，遮住「风险实验室」「原理档案」标签名）；②A1 回退横幅 `.wf-fallback-banner`（`global.css:638-645`：`.wf-main` 内 `absolute top:8 z-120`）渲染位置在 `.atlas-region` 之前（`App.tsx:560-562`），同样压住切换条与页首行。
- **改法**：①改配置对象调用 `Message.info({ content: t("atlas.migrate.notice"), position: "bottom", duration: 4.5 })`——组件库既有 API，零新依赖；底部气泡与顶部 chrome（C1+C2）空间正交，任何视口不遮挡切换条。②回退横幅改**常规流承载**：渲染位置从 `.wf-main` 顶层（`App.tsx:560-562`）移入 `.atlas-region`、置于 `.atlas-switch-anchor`（`App.tsx:575-577`）之后作 `flex:none` 行；`global.css:638-645` 去 absolute/z-index/pointer-events、改宽度 100% 单行（<480 允两行）；`global.css:590-591` 定位上下文注释同步删除。回退态页根已放行滚动（global.css:634-636），横幅占的是**已回退页面的可滚高度**——零滚动页永不渲染横幅，§2 全部预算不受影响；低于 580 的物理极限场景由文档流天然满足「单行、不遮挡」。
- **回归风险**：①底部气泡瞬态（4.5s）可能与 C3 dock 行视觉相邻——覆盖层零布局高度、不拦截 dock 命中（气泡关闭钮自域命中），A4 程序化断言兜底；②横幅入流后回退页首屏内容下移横幅高（≈38px），仅发生在已登记的例外路径（回退页），零滚动组不触发。

### §1.3 E3 联动未覆盖专业面板 ＋ E4 回报/通胀独立副本（同根因，机制落 §3）

- **根因**：反向估算切片五个字段（childReserve / healthReserve / majorInvestment / nominalReturnPct / inflationPct）为独立输入：落点 `ReversePanel.tsx:74-77/:85-88/:96-99/:109/:118`（ReverseFields，pro 人生规划 `ReversePanel.tsx:170`、freedom 叶B/右列 `ReverseCard` `BasicCalculator.tsx:1283/:1359` 双宿主），默认值来自 `REVERSE_ESTIMATE_DEFAULTS`（`defaults.ts:95-102`：childReserve 580000 `:97`、回报 4.5 `:100`、通胀 2.0 `:101`）；与 baseline 的唯一通道是手动同步钮（`syncFromBaseline` `ReversePanel.tsx:156-164`、`ReverseCard.tsx:277-285`）。`applyPreset/clearPreset` 只整体覆盖 baseline 五字段（`store:217-250`）→ 选「单身租房」（childCount=0，`presets.ts:50`）后，专业模式/人生规划、life 规划组、freedom 反向卡仍显示「子女预留 ¥580000.00」——与预设矛盾的参数残留（E3）；回报 4.5/通胀 2.0 在反向面板是无联动的独立副本（E4）。同族缺口：打工模拟月开销/两均值（`AccumulationPanel.tsx:346-349/:383-384/:410-411`，无联动行 #8/#9）、MC 年支出（`MonteCarloPanel.tsx:662-675`，手动同步钮 #10）——全量普查与逐字段锚点见 §3.1（14 字段）。
- **改法**：统一同步机制（§3.2）——四个组级布尔（`reverseSynced` / `mcSpendSynced` / `accExpenseSynced` / `accMeansSynced`）全部默认 true 入 `businessDefaults()`（`store:175-196`），锁态显示层取核心参数派生直显、运行提交帧同帧解析覆盖，**零面板切片写入**；复制 P10 `mcMeansSynced` 五要素模板（`store:115-122`、`MonteCarloPanel.tsx:106-113` 锁态派生与解锁、`:285-294` 提交帧覆盖）。E3（子女预留=子女数×单孩成本派生）、E4（回报/通胀直取 baseline）同轮闭合。
- **回归风险**：①解锁用户当刻自定义值在解锁瞬间落切片（§3.2-③），无旧值错位；②share v6→v7（§3.4），v6 存量链接与情景库存档一次性失效（既有纪律，非回归）；③`check-share.mjs:147` 版本常量断言期望值 6→7（版本闸机械承载，§8 红线 4 唯一登记例外）。

### §1.4 E5 专业面板空白卡

- **根因（起草会话双重复核：源码 + 组件库编译产物）**：Arco Tabs 轮播的内联偏移作用在项目强改为纵向列布局的容器上——`tab-content.js:20` 对 `.arco-tabs-content-inner` 写内联 `style.marginLeft = -activeIndex × 100%`（期望横向 flex 行逐列滑动），而项目侧 `global.css:1105-1109` 把 `.wf-adv-tabs .arco-tabs-content/-content-inner` 覆写为 `flex-direction: column`（P10 零滚动骨架让 `.wf-slot` 吃剩余高度）→ 列布局下整叠内容左移 index×容器宽，再被 `.wf-main` 的 overflow:hidden（`global.css:584`）裁掉 → **index≥1 的标签全部空白**（分析组税务/多情景/公式原理、人生规划组打工模拟/社保养老金同病——research-p10fix-census §3.2 实测 innerX −850/−1897/−2943 并经运行时注入 `margin-left:0` 因果验证）。次因：死选择器——`global.css:1122/:1128/:1138` 目标 `.arco-tabs-tabpane`，组件库实际类名为 `.arco-tabs-pane`（`tab-pane.js:33` `prefixCls + "-pane"`；编译产物 `es/Tabs/style/index.css` 中 `tabpane` 0 处、`pane` 1 处，本会话 grep 复核）→ 面板根 flex 填充链断在 pane 层。
- **改法**：①`global.css` 增一行 `.wf-adv-tabs .arco-tabs-content-inner { margin-left: 0 !important; }`——中性化列布局与轮播偏移的冲突（列布局下非活动 item 已 height:0，轮播 margin 无存在必要）；`AdvancedPanel.tsx:182` 的 `animation` prop 由 `{ inkBar: true, tabPane: true }` 改 `{ inkBar: true }`（tabPane 滑入动画随偏移退役，配置诚实——animation 语义变更登记）。②三处死选择器 `.arco-tabs-tabpane` → `.arco-tabs-pane`（global.css:1122/:1128/:1138），恢复面板根填充链。
- **回归风险**：①tabPane 滑入动画退役（S20 墨条指示动画不受影响——inkBar 在 header 域，§7 登记）；②偏移中性化是容器级规则，pro 三组所有标签一并修复，零逐面板补丁；③`!important` 为既有先例口径（global.css:782 同款内联压制）。

### §1.5 E6 语言维未入矩阵

- **根因**：验收矩阵与 `scripts/zero-scroll-check.mjs` 均无语言维（`zero-scroll-check.mjs:27-38` 仅 VIEWPORTS/TASKS/THEMES）；单行承载文案三语长度无门禁——起草会话实测（esbuild 转译三语 locale 后逐键计数，脚本在临时目录、未入仓库）：`atlas.pro.desc` en 41 字符、`basic.outputTitle` en 52、`basic.summaryPrefix` en 76、`sensitivity.title` en 27、`advanced.mcTitle` en 22、`advanced.scenarioTitle` en 25、`basic.stepAssumption` en 20、`insights.entryEvidence` en 17——均超各单行槽位上限（§11 表）。
- **改法**：①`scripts/check-i18n-budget.mjs`（§6.2）落地单行关键文案三语长度预算；②`zero-scroll-check.mjs` 扩维：`LANGS = ["zh-CN","zh-Hant","en"]` 导出 + driver 增 `setLang(lang)`（写 `localStorage["wf-lang"]`——持久化键 `src/i18n/index.ts:15` 实读，与 `setTheme` 同构）+ VIEWPORTS 换为 §10-A1 十档在册视口 + ④判定（E5 回归：pro 活动面板根在视口内）；③文案缩短：en.ts 8 处（§11.1 处置列，§10-11 先例）＋ summaryPrefix zh-CN/zh-Hant 各 1 处微缩（唯一非 en 键值变更，§11.1 行 4 判据）。
- **回归风险**：①文案缩短只动字符串字面量，键集零变化，且 `check:data`/`check:lifecycle`/`check:a11y` 对上述 8 键值零断言（起草会话 grep 三脚本零命中）→ 既有门禁不受影响；②README 双语素材中 en 标签随缩短过期——素材复核登记归素材轮，不入本规范门禁；③语言注入若失效会产出假阳性全过组——沿用 p10-spec R-4 教训：逐组回读 `document.documentElement.lang` 确认注入生效，失效组作废重跑（写入 A1 执行口径）。

---

## §2 矮视口切换树定稿（三形态 × 580 下限预算表）

> 判据承 research-p10fix-layout §0：**可用页高 A = 视口高 H − chrome**；超预算唯一处置通道 = 页面/标签/槽切换承载，禁止回退滚动与裁切兜底；深矮档 = H<850（`hooks.ts:137` 既有判定）；逐值 ±8px 静态推算，`scripts/zero-scroll-check.mjs` 实测为终审。**本章全部预算按 H=580（下限）计算**——H≥580 的任何视口 A 只增不减，预算即覆盖全档。

### §2.1 chrome 常数与 A@580（逐节点加总）

| chrome | 双栏 ≥1200 宽 | 中栏 768–1199 | 单列 <768 | 依据 |
| --- | --- | --- | --- | --- |
| C1 顶栏 | 32 | 32 | 73 | 73/29 实测（p10-spec R-4）；≥790 完整态推算 ≤30 → 预算 32（A1 复核项） |
| C2 切换条 | 52 | 52 | 44 | 44 实测（<768 desc 转 title 单行）；≥768 双行 ≈49 → 预算 52（A1 复核项） |
| 内容区 padding＋页距 | 32＋8 | 32＋8 | 16＋8 | global.css:589/:594-598/:618 |
| **chrome 合计** | **124** | **124** | **141** | |
| **A@580** | **456** | **456** | **439** | 580−124 / 580−141 |

### §2.2 双栏形态 @580：整体不可达 → 高度驱动降级（E1 修复判据）

| 节点 | 现值 | 580 预算 | 判定 |
| --- | --- | --- | --- |
| 右列输出卡固定区 | 卡头 46＋卡体 32＋hero 74＋读数两行 50＋F3 44＋卡距 12 | 0＋24＋60＋46＋38＋12 | ✗ |
| F4 图槽 | ≥200（`BasicCalculator.tsx:102` 硬底线） | 200 | ✓ |
| 右列反向卡 | 228 / 矮档 170（`ReversePanel.tsx:246/:250` 实读） | 0（并入叶B F8 槽态） | ✗ |
| 左列输入全量区 | 742（p10-spec §1.1 行项拆解在册） | 0（整体退役） | ✗ |
| **右列加总** | 46＋32＋74＋50＋44＋200＋12＋170 = **628** | ≤456 | ✗ 超 172 |

**裁定**：双栏 @580 无解（左 742 / 右 628 > 456）；修复 = §1.1 高度降级（阈值 880），降级后双栏不占 580 预算域。1440×900/1920×1080 双栏页栈 742 ≤ A(900−124=776)/A(1080−124=956) 维持现状预算（p10-spec §1.6 在册，本轮零改动）。

### §2.3 中栏形态（768–1199 与降级后 ≥1200 叶树）逐页预算（深矮档值，加总 ≤456）

> 850≤H<880 的标准档中栏不加压缩亦成立（叶A 44＋32＋64＋50＋44＋200 = 434 ≤456；叶B 456 贴线 slack 0 → 实施时叶B 沿用 margin 2 档，登记注记）。≥1200 降级叶树同构，控件取 pointer-fine 档。

| 页/叶 | 节点预算（逐节点） | 加总 | slack |
| --- | --- | --- | --- |
| freedom 叶A | F0 38＋卡壳 24＋hero 60＋读数两行 46＋F3 38＋F4 200（进度说明行并入 F4 槽首行） | **406** | 50 |
| freedom 叶B | F0 38＋壳 24＋F7 38＋F8 200＋core 行 32＋anatomy 36＋share 复合行 40（中栏叶B share 缺宿主缺口以复合行补齐） | **408** | 48 |
| life 最重组 | L1 38＋L2 38＋L3 120（轨迹组 120/面板组 68 分档）＋L4 38＋L5 200 | **434** | 22 |
| risk | K1 38＋K2 120＋K3 38＋K4 200（运行钮落 K1 复合行） | **396** | 60 |
| principles | P1 38＋P2 ≤190（节头 32＋槽 ≤158）＋P3 ≤163（节头 32＋槽 ≤115＋节间 16） | **391** | 65 |
| pro | R1 38＋R2 40＋R3 120＋R4 38＋R5 200 | **436** | 20 |

### §2.4 单列形态（<768）逐页预算（深矮档值，A=439；44px 命中恒定不回退）

| 页/叶 | 节点预算（逐节点） | 加总 | slack |
| --- | --- | --- | --- |
| freedom 叶A | F0 46＋卡壳 24＋hero 52（环 48）＋读数两行 46＋F3 46＋F4 200 | **414** | 25 |
| freedom 叶B | F0 46（复合行：两段叶条＋右端 share 图标位 44）＋壳 24＋F7 46＋F8 200＋core 行 48＋anatomy 32（dock 行退役一档） | **396** | 43 |
| life | 轨迹组 46＋L3 120＋L4 46＋L5 200 = 412；规划组 46＋46＋68＋46＋200 = 406 | **412** | 27 |
| risk | K1 46（复合行含运行钮）＋K2 120＋K3 46＋K4 200 | **412** | 27 |
| principles | P1 46＋P2 ≤190＋P3 ≤163 | **399** | 40 |
| pro | R1 46＋R2 40＋R3 96＋R4 46＋R5 200 | **428** | 11 |

### §2.5 深矮档压缩清单（H<850 统一生效；数值档依据 research-p10fix-layout §2 四体系交集：密度是档位不是自由值、披露代替滚动、高度独立建档、信息不删只减可见量）

1. 分段/槽条 margin-bottom 8→2（global.css:1228-1231 ≤480 档既有值扩为深矮档全档）；
2. 卡体 padding 16→12（global.css:1234-1237 ≤480 档值扩档）；
3. 进度环 72→48 新档（size 已参数化 `BasicCalculator.tsx:1108`；56/48 双档由 isCompact‖isShort 扩为 isCompact‖isShort‖深矮档同值收敛——56 与 48 并档实施时取一登记），hero 行单列 52 / 中栏 60（§2.3/§2.4 两表分档取值）；
4. 进度说明行/空态引导行并入 F4 槽内容（槽内首行 caption，省 22）；
5. <768 dock 行（global.css:2050-2059）上收为叶条/分段条右端复合图标位（44 命中不变、share/运行入口恒在且更靠上）；≥768 中栏叶B share 缺口同步以复合行补齐；
6. anatomy 行 margin 16→8、core 行 margin 8→4（global.css:2469/:939）；
7. 读数槽分档：K2/R3 160→120、R3 pro 单列 96、life L3 轨迹组 120/面板组 68（主数行 32＋双指标 2×28 实容）；
8. principles 分节槽 ≤158/≤115（caption 12/18 档 = global.css:1018-1022 既有降档）：E1 strict 8 行 144 ≤158 ✓；E3 market 9 行 153 ≤158 ✓（勘误注下沉 FieldTip）；E3 child/E4 loose ≤6 行 ≤115 ✓（同下沉）；E4 health 8 行 >115 → 与证据节互换分节序（内容零删，节序为有意变更登记）；**E2 chain（EntryRows ≈820–1390）槽内不可容 → 走 p10-spec 红线 10 路线 (b)：条目内二级切换（概览摘要 1 行 | 分步 3 页×3 行 ≤158）**——U1「原理档案不留例外」由本项兑现，principles@580 无回退横幅、无滚动、无裁切。

### §2.6 超预算节点汇总（现值 > 580 预算，共 **14** 个）与三形态结论

- 双栏（4）：左列全量区 742、右列卡头 46、右列 hero 非矮档 74、右列反向卡 228——处置 = §2.2 降级判据。
- 中栏（4）：freedom 进度说明行 22（并槽）、叶B share 无宿主（补复合行 40）、pro 读数槽 160→120、principles 分节槽超限（→§2.5-8）。
- 单列（6）：freedom dock 行 52–60→复合行、进度说明行并槽、anatomy 行 44–65→32、risk dock 行→K1 复合行、K2/R3 读数槽 160→120/96、life L3 160→68–120 分档。
- **结论**：双栏 @580 降级后不占预算；中栏五页加总 391–436 ≤456 全过；单列五页加总 396–428 ≤439 全过。低于 580 属物理极限：仅允许回退横幅以单行、不遮挡呈现（§1.2-② 修复后横幅在文档流中不覆盖切换条），如实登记为 A1 人工走查项。

---

## §3 共享参数单源化定稿（全量普查表 + 统一同步机制 + 解锁持久化 + share 版本处置）

### §3.1 全量普查表（14 重复字段；逐字段有锚点，行号为起草会话 grep/Read 实测）

核心参数定义：freedom 输入卡 baseline 切片七字段（`defaults.ts:37-47`：月开销 `:39` 2990 / 子女数 `:41` / 单孩成本 `:42` 580000 / 健康预留 `:43` / 重大投入 `:44` / 名义回报率 `:45` 4.5 / 通胀率 `:46` 2.0）＋自由刻度已有资产（`defaults.ts:177-182`，0=未填写哨兵）。普查粒度 = 面板组件 × 字段（同一组件多宿主计一行，宿主行内登记）。排除面板（grep 零命中实证）：LoanPanel/RentalPanel（独立域）、TaxPanel（税域字段）、InsightsPanel（纯展示）、LifeLensTrack/LifeEventEditor/LifeTrajectoryCard（只读消费）、PensionPanel（baseline 只读组合调用 `PensionPanel.tsx:31/:64-65`）。

| # | 面板（宿主） | 重复字段 | 输入落点 | 默认值来源 | 当前联动 |
| --- | --- | --- | --- | --- | --- |
| 1 | 反向估算 ReverseFields（pro 人生规划 `ReversePanel.tsx:170`；freedom 叶B `BasicCalculator.tsx:1283` + 桌面右列 `:1359`） | 子女预留 childReserve | `ReversePanel.tsx:74-77`（ReverseCard 同构字段 `:331` 经分页承载） | `defaults.ts:97` 580000 | 手动同步钮（`ReversePanel.tsx:156-164`）——E3 |
| 2 | 同上 | 健康预留 healthReserve | `ReversePanel.tsx:85-88` | `defaults.ts:98` 200000 | 手动同步钮——E3 |
| 3 | 同上 | 重大投入 majorInvestment | `ReversePanel.tsx:96-99` | `defaults.ts:99` 0 | 手动同步钮——E3 |
| 4 | 同上 | 名义回报率 nominalReturnPct | `ReversePanel.tsx:109` | `defaults.ts:100` 4.5 | 手动同步钮——E4 |
| 5 | 同上 | 通胀率 inflationPct | `ReversePanel.tsx:118` | `defaults.ts:101` 2.0 | 手动同步钮——E4 |
| 6 | 打工积累 AccumulationPanel（pro 人生规划 `AdvancedPanel.tsx:54`；life 规划组 `TaskPages.tsx:51`） | 月开销 monthlyExpense | `AccumulationPanel.tsx:346-349` | `defaults.ts:204` 2990 | 无自动：不一致 hint（`:353-357`）＋显式同步钮（`:474-493` 邻域） |
| 7 | 同上 | 目标值 targetValue | `AccumulationPanel.tsx:360-365` | `defaults.ts:205` 1,635,200 | **自动**：`accumulationTargetSynced` 默认 true（`store:186`），手改解除（`:364-367`），恢复钮（`:474-484` 邻域）——不迁移零变化 |
| 8 | 同上 | 名义回报均值 nominalReturnMeanPct | `AccumulationPanel.tsx:383-384/:401-402`（正推/反推两分支） | `defaults.ts:206` 4.5 | **无** |
| 9 | 同上 | 通胀均值 inflationMeanPct | `AccumulationPanel.tsx:410-411` | `defaults.ts:208` 2.0 | **无** |
| 10 | 蒙特卡洛 MonteCarloPanel（pro 分析组 `AdvancedPanel.tsx:70`；risk 模拟叶 `RiskPage.tsx:50`） | 年支出 annualSpend | `MonteCarloPanel.tsx:662-675` | `defaults.ts:129` 35880（=2990×12 编译期积） | 无自动：不一致 hint（`:670-674`）＋显式同步钮（`:765-773` 邻域） |
| 11 | 同上 | 名义回报均值 nominalReturnMeanPct | `MonteCarloPanel.tsx:683-694` | `defaults.ts:130` 4.5 | **自动**：`mcMeansSynced` 默认 true（`store:193`），锁态派生直显（`:106-108,:688`）＋提交帧覆盖（`:285-294`）＋恢复钮（`:775-781` 邻域）——P10 §4 已收口，推广模板 |
| 12 | 同上 | 通胀均值 inflationMeanPct | `MonteCarloPanel.tsx:705-714` | `defaults.ts:132` 2.0 | **自动**（同 #11，`:709`） |
| 13 | 蒙特卡洛（宿主同 #10） | 当前资产 currentAssets | `MonteCarloPanel.tsx:654-661` | `defaults.ts:128` 500000 | **无**——裁定不联动（语义异名，见下） |
| 14 | 打工积累（宿主同 #6） | 当前资产 currentAssets | `AccumulationPanel.tsx:324-332` | `defaults.ts:202` 500000 | **无**——同上 |

**计数结论**：重复字段总数 = **14**（#1–#14）。按联动方式：自动 3（#7/#11/#12）＋手动同步钮 7（#1–#6/#10）＋完全无联动 4（#8/#9/#13/#14）= 3＋7＋4 = 14 对账。既有同形联动 `pensionMonthsSynced`（`store:190/:277`）属面板自有参数联动，不计入本表。普查表与预设的关系：四画像 childCount = 0/0/1/0（`presets.ts:50/:58/:66/:74`），costPerChild 四画像恒 580000（同四处）——**起草会话勘误：research-p10fix-census §1 引 presets.ts:54/:66/:78/:90 已漂移，以本表 ：50/:58/:66/:74 为准**。

### §3.2 统一同步机制（mcMeansSynced 五要素模板推广；四个新组级布尔）

| 新标志 | 覆盖普查行 | 派生口径 |
| --- | --- | --- |
| `reverseSynced` | #1–#5（reverse 切片 5 字段 = 现手动同步钮集合） | childReserve = childCount × costPerChild（childCount=0 → 0，字段恒在不隐藏）；其余四字段直取 baseline 同名值 |
| `mcSpendSynced` | #10（monteCarlo.annualSpend） | annualSpend = monthlyExpense × 12（现 `MonteCarloPanel.tsx:363-364` 派生式收编） |
| `accExpenseSynced` | #6（accumulation.monthlyExpense） | 直取 baseline.monthlyExpense |
| `accMeansSynced` | #8/#9（accumulation 两均值） | 同 #11/#12 机制 |

五要素（逐条对应既有实现）：① 锁态（true）显示层派生直显（disabled＋锁标，`MonteCarloPanel.tsx:688/:709` 模板）——零面板切片写入；② 运行提交帧同帧解析覆盖（`MonteCarloPanel.tsx:285-294` / 先例 `AccumulationPanel.tsx:94-97→:138-143/:157`「同一值、同一帧」）；③ 解锁 = 显式动作，同时把当刻核心值落入切片（`unlockMeans` `MonteCarloPanel.tsx:110-113` 模板，消除「解锁即见旧值」错位）；④ 口径标志随分享载荷携带（§3.4）；⑤ 不入 localStorage（业务输入不落盘纪律，`store:115-119` 注释原文）。四标志写入 `businessDefaults()`（`store:175-196`）默认全 true；setter 同形 `setXxxSynced(v)`（`store:265/:277/:280` 先例）。

**派生单源化落点**：新增 `src/store/effectiveInputs.ts` 纯函数模块（零 React/zustand/DOM 依赖，Node 可直载——这是确定性检查的前置）：`effectiveReverse(reverse, baseline, reverseSynced)`、`effectiveMonteCarlo(mc, baseline, { means, spend })`（收编 `MonteCarloPanel.tsx:106-108` 内联式）、`effectiveAccumulationSim(acc, baseline, { expense, means })`。三面板显示层与计算调用点统一消费该模块：`calcReverse` 调用处 `ReversePanel.tsx:140`、`ReverseCard` 读数与提交（`:262` 邻域）；`calcMonteCarlo` 提交帧 `MonteCarloPanel.tsx:285-294`；`calcAccumulation` `AccumulationPanel.tsx:157`。字段 UI 形态复制 #11/#12 的 disabled＋锁标＋恢复钮（`lockButton` `MonteCarloPanel.tsx:115-124` 邻域模板），锁 UI 三语键共用 §11 的 `common.paramSync*` 三键。

**currentAssets（#13/#14）裁定不联动**：自由刻度已有资产带 `0=未填写` 哨兵语义（`defaults.ts:177-182`、进度环隐藏口径 `BasicCalculator.tsx:710`），联动会把哨兵 0 传入模拟初始资产；登记为语义异名不属重复（实施时 i18n label 区分「已有资产（展示）」与「模拟初始资产」——复用既有键微调 en 表述或新增说明 tooltip，入 §11 附加注记、零数值改动）。既有 `accumulationTargetSynced`（#7）与 `pensionMonthsSynced` 不迁移，零行为变化。

### §3.3 预设对子女类字段的联动口径（U2 兑现判据）

`applyPreset/clearPreset`（`store:217-250`）只整体覆盖 baseline 五字段，本轮写入集零变化。口径：`reverseSynced` 锁态下反向卡/反向面板 childReserve 显示层**即时跟随派生值**（预设一孩 1×580000=58 万 → 反向卡显示 58 万；单身租房 childCount=0 → 显示 0）——预设应用后任何页面（pro 人生规划/life 规划组/freedom 叶B 与右列）不再出现与预设矛盾的「子女预留 ¥580000.00」残留；零 `reverseInputs` 写入、零 resetEpoch 参与。解锁态预设不触碰 reverse 切片（与「预设不触碰其他切片」现状一致，`store:230-237` 注释原文）。四画像 costPerChild 恒 580000 保证「再启用」路径回场值正确（p10-spec §3.3 四理由沿用）。

### §3.4 解锁持久化与 share 版本处置（6→7）

- ShareState 新增第 14–17 键：`reverseSynced` / `mcSpendSynced` / `accExpenseSynced` / `accMeansSynced`（全布尔）→ `SHARE_LINK_VERSION` **6→7**（`share.ts:59`；形状变更即递增、版本单点闸 `share.ts:167`、无迁移代码——v1→v6 既有决策链）。v6 及更早链接与情景库存档一次性失效。
- 编码端：`buildShareState` 四键随载荷（`store:347` mcMeansSynced 先例）；锁态派生值不单独入载荷——随 baseline 切片入链，发送方所见=接收方所得。解码端：四键逐键严格布尔校验，缺键/非 true|false → 整体 null（`share.ts:313-316` mcMeansSynced 同款）；`applyShareState` 恢复标志本身（`store:320` 先例）。情景库存档经 buildShareState 自动携带（零新代码）。
- **现状偏差登记**：`applyShareState` 对 `accumulationTargetSynced/pensionMonthsSynced` 恢复为 false（`store:323/:329`）与新四键「随载荷恢复」口径不同——历史两套口径并存，本轮不动旧两键（零行为变化），登记待后续统一。
- resetAll / resetBusinessInputs 回 true（`businessDefaults()` 共用清单 `store:362-373`）；解锁态不入 localStorage，跨会话仅经分享链接/情景存档携带。

---

## §4 提示条层叠修复（E2 终态）

1. **迁移提示 Message**：`App.tsx:297` 改 `Message.info({ content: t("atlas.migrate.notice"), position: "bottom", duration: 4.5 })`——`position` 为组件库既有 API（`es/Message/interface.d.ts:58-60` 实读），底部气泡与顶部 chrome 空间正交；文案键值零改动（zh 23 / en 94 字符，底部气泡 ≤2 行预算内，§11.3）。
2. **A1 回退横幅常规流化**：渲染位置 `App.tsx:560-562` → `.atlas-region` 内 `.atlas-switch-anchor` 之后（`flex:none` 行）；`global.css:638-645` 去 absolute/top/left/right/z-index/pointer-events，改 `width:100%` 单行（<480 允两行、文档流保证不遮挡）；`global.css:590-591` 定位上下文注释删除。回退横幅只渲染于回退页（零滚动页恒不渲染），§2 预算零影响。
3. **wasm 引导失败 Alert**（`App.tsx:563-570`）保留常规流原位：异常态例外路径（p10-spec §2.1 已登记），零滚动判定以引导成功为前提。
4. **验收扩展（入 A4）**：程序化断言——活动 Message 容器 rect 与 `.atlas-switch` rect 不相交、`.wf-fallback-banner` rect 与 `.atlas-switch` rect 不相交；深矮档下 `wf-fallback-scroll` 恒不出现（A1 十视口组内断言）。

---

## §5 空白面板修复（E5 终态）

1. `global.css` 新增 `.wf-adv-tabs .arco-tabs-content-inner { margin-left: 0 !important; }`（紧随 ：1105-1109 覆写块之后）——列布局下中性化 Arco 轮播偏移（`tab-content.js:20` 实读）；非活动 item 既有 height:0 门控（组件库 item CSS）继续承担互斥显隐，轮播滑动失去意义即退役。
2. `AdvancedPanel.tsx:182` `animation={{ inkBar: true, tabPane: true }}` → `animation={{ inkBar: true }}`——tabPane 滑入动画配置随载体退役（配置诚实，避免死配置）；S20 墨条指示动画不受影响。
3. 三处死选择器改名：`global.css:1122` / `:1128` / `:1138` 的 `.arco-tabs-tabpane` → `.arco-tabs-pane`（`tab-pane.js:33` 实读；编译产物 grep `tabpane` 0 处）——恢复「pane → pane 根 div → 面板根」flex 填充链，消除「上半截内容＋下半截空白」观感。
4. **回归闸**：§6.1 机制 C（CSS 静态断言）＋ `zero-scroll-check.mjs` 增 ④判定——每个 `.wf-adv-tabs-wrap:not([hidden])` 的活动面板根（`.arco-tabs-content-item-active .arco-tabs-pane` 首个）`getBoundingClientRect()` 与视口相交且 `left ≥ 0`；pro 三组全部标签经贪心遍历逐态过④。

---

## §6 确定性检查（两脚本设计；期望值独立推导写注释；零新依赖）

### §6.1 `scripts/check-param-sync.mjs`（npm run check:paramsync——同步态下各面板有效输入 = 核心参数）

- **转译加载**：沿用 esbuild `transformSync` + 临时目录落盘 + Node ESM import 既有幂（`scripts/check-data.mjs:45-67` loadModule、`check-share.mjs:32-42`；esbuild 在 vite 依赖树内，package.json 零变化）。加载 `src/store/effectiveInputs.ts` ＋依赖 `src/data/defaults.ts`（其运行时依赖 `src/data/pensionParams.ts` 随 deps 一并转译——check-data 同款扩展名改写）。不载 zustand store（顶层 `readInitialPrefs()` 触碰 `window`（`store:202`），Node 内不可挂载——纯模块独立可测正是抽 `effectiveInputs.ts` 的动机）。
- **机制 A（行为断言，裁决路径）六组**（期望值全部由注释内算式独立推导，禁魔法数）：
  ① `effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, BASELINE_DEFAULTS, true)` 深相等 `{ childReserve: 0×580000=0, healthReserve: 200000, majorInvestment: 0, nominalReturnPct: 4.5, inflationPct: 2.0 }`（`defaults.ts:41-46/:97-101` 在册值代入）；② 预设夹具 family_one_kid（`presets.ts:66`：childCount 1×costPerChild 580000）→ childReserve 派生 = 580000；③ `effectiveMonteCarlo(MONTE_CARLO_DEFAULTS, BASELINE_DEFAULTS, { means:true, spend:true })` → annualSpend = 2990×12 = 35880、均值 4.5/2.0；④ `effectiveAccumulationSim(ACCUMULATION_DEFAULTS, BASELINE_DEFAULTS, { expense:true, means:true })` → 2990/4.5/2.0；⑤ 解锁语义：标志 false → 有效输入 ≡ 面板切片原值（改 baseline 不漂移）；⑥ 解锁快照函数返回当刻核心值（unlockMeans 语义同构断言）。
- **机制 B（接线存在性，可 grep 复核）**：正则断言面板源码——`calcReverse(effectiveReverse(`（`ReversePanel.tsx:140` 与 ReverseCard 两调用点）、`calcMonteCarlo(effectiveInputs)`（`MonteCarloPanel.tsx:285-294` 提交帧）、`value={reverseSynced ?` 锁态派生直显在位；`value={mcMeansSynced ?`（既有 #11/#12 回归锚）；每条断言附 file:line 注释。
- **机制 C（E5 回归）**：读 `global.css` 文本断言 `margin-left: 0 !important` 规则在 `.wf-adv-tabs .arco-tabs-content-inner` 选择器块内、全文零 `.arco-tabs-tabpane` 残留。
- **通过判据**：`node scripts/check-param-sync.mjs` 退出码 0，输出 **14 行 PASS 表**（= §3.1 普查行逐行对账：#1–#5 → effectiveReverse、#6 → accExpense、#7 → 既有 targetSynced 回归锚、#8/#9 → accMeans、#10 → mcSpend、#11/#12 → 既有 mcMeans 回归锚、#13/#14 → 不联动裁定锚（断言两字段不在任何 effective 函数输出耦合集内））；GUI 通道另跑 zero-scroll ④判定。

### §6.2 `scripts/check-i18n-budget.mjs`（npm run check:i18n——单行关键文案三语长度预算）

- **加载**：esbuild 转译三语 locale 模块（`scripts/check-data.mjs:121-123` 既有三语加载先例），逐键取字符串计字符数（`[...str].length`，CJK 计 1）。
- **预算表**：上限即 §11.1 表逐键值；每条断言注释写明推导式（槽内宽 ÷ 字宽：CJK ≈ 字号 px，EN ≈ 7px/字符 body、6px caption；槽内宽按最窄基准 320 视口推算——推导全文见 research-p10fix-layout §4，本脚本注释逐键复制该式与槽位出处；唯一例外 = F2 行按 ⌊(264−21)/7⌋=34 复制，插值数字占位 W=21px，算式见 §11.1 该行）。
- **判级**：FAIL 输出 `键 / 语言 / 实测字符数 / 上限 / 超出量`，退出码非 0；`scrollFallback` 与 `migrate.notice` 不入硬门禁（前者为回退例外路径可换行、后者底部气泡 ≤2 行——两键登记为软预算行，输出 INFO 不判挂）。
- **通过判据**：`node scripts/check-i18n-budget.mjs` 退出码 0；en.ts 缩短后逐键实测（起草会话已预跑测量通道验证可行：29 键 ×3 语全部取到值）。

### §6.3 npm scripts 与门禁接线

- `package.json` scripts 块新增两行：`"check:i18n": "node scripts/check-i18n-budget.mjs"`、`"check:paramsync": "node scripts/check-param-sync.mjs"`——dependencies/devDependencies 零变化（红线 ①）。
- 收口门禁全量：`npm run check:data && npm run check:share && npm run check:currency && npm run check:a11y && npm run check:lifecycle && npm run check:i18n && npm run check:paramsync`，逐条 exit 0（A14）。

---

## §7 S1–S26 与 D9 等迁移登记（P10fix 轮增量；基线 = p10-spec §6 终态）

| 项 | P10 终态（p10-spec §6） | P10fix 处置 | 说明 |
| --- | --- | --- | --- |
| S1 刻度环 | 不动 | **档位扩展** | §2.5-3 环 48 新档（72/56/48 阶梯）；参数化落点 `BasicCalculator.tsx:1108`，跨档变色/命中语义不变 |
| S2 脉冲 | 不动 | 不动 | 数值谓词驱动，零滚动无关 |
| S3 度量字排 | 不动 | 不动 | 全局排印规则 |
| S4 行级 hover | 不动 | 不动 | 宿主随敏感性块入 F4 槽（现状已在位） |
| S5 轻确认 | 不动 | 不动 | share 复合行迁移后主按钮路径保留（§2.5-5） |
| S6 空态人格化 | 不动 | 不动 | 引导行并入 F4 槽首行时图形宿主随迁（§2.5-4，视觉档位压缩非退役） |
| S7 左标线 | 不动 | 不动 | principles 分节节头沿用 |
| S8/S12/S13 | 空缺/资产 | 同左 | 非迁移对象 |
| S9 计算徽标 | 不动 | 不动 | 防抖窗口谓词 |
| S10 ▲▼ | 不动 | 不动 | 常驻字形 |
| S11 深色环线 | 不动 | 不动 | 主题常驻 |
| S14 段位徽标 | 不动 | 不动 | F2 顶区随行 |
| S15 目标线叙事 | 不动 | 不动 | 叙事行随图容器（已收口） |
| S16 因果闪亮 | 不动 | 不动 | 防抖落定驱动 |
| S17/S23/S26 | 退役登记（维持） | 同左 | 零新增退役、零复活 |
| S18 渐近滚动 | 迁移落点（已完成） | **不动** | effectiveInputs 为显示层派生，宿主 ref 零重挂；反向卡双态容器宿主现状已覆盖 |
| S19 克制悬浮 | 不动 | 不动 | hover 规则全状态生效（T12 简化已收口） |
| S20 指示条滑动 | 迁移落点（已完成） | **动画语义收窄** | 墨条 inkBar 动画保留；tabPane 滑入随 E5 修复退役（§5-2，`AdvancedPanel.tsx:182`）——animation 语义变更登记，非元素退役 |
| S21 数字键切组 | 迁移落点（已完成） | 不动 | 显式输入豁免守卫原样（`AdvancedPanel.tsx:116-150`） |
| S22 主题揭示 | 不动 | 不动 | App 级 |
| S24 错误左标线 | 不动 | 不动 | 表单态 CSS |
| S25 图表 hover | 不动 | 不动 | 槽内兜底行现状在位 |
| D9 吸附紧凑减法 | 退役（T3；<640 环 56 保留） | **环档阶梯扩展** | 48 档为 D9 家族档位压缩的延续登记（§2.5-3），非本体复活；「双栏 ∧ 矮档」空集化后 `hooks.ts:135` 注释勘误（§1.1 连带登记） |
| 附带工程项 | sticky 三件套死路径清理（已收口） | **死选择器清理** | `.arco-tabs-tabpane` 三处改名（§5-3）；`.wf-freedom-split` H<880 惰性代码窗口登记（§1.1，本轮不删） |

计数对账：迁移 0 项、退役 0 项新增（维持 S17/S23/S26 3 项）、动画语义收窄 1 项（S20）、档位扩展 2 项（S1/D9）、不动 18 项（S2–S7/S9–S11/S14–S16/S18–S19/S21–S22/S24–S25）、空缺/资产 3 项（S8/S12/S13）、附带清理 2 项——S1–S26 共 26 项＋D9＋附带全覆盖。

---

## §8 回归红线（违反即返工）

1. **公式与数据流不碰**：`calcBaseline` / `calcMonteCarlo` / `calcLifecycle` / `calcTax` / `calcReverse` 调用面与 wasm 导出面零改动（`git diff --stat -- src/wasm` 全空）；`reverseInputs` / `monteCarloInputs` / `accumulationInputs` 三切片默认值对象逐字节零变化（`defaults.ts:95-102/:127-134/:201-216`）；本轮 store 增量 = 恰 4 个布尔口径标志（§3.2 表）＋对应 setter；`effectiveInputs.ts` 为纯函数模块（零 React/zustand/DOM/存储依赖），单源化全部是 UI 显示层派生锁定。
2. **方案 B 导航语义零变化**：`AdvancedPanel.tsx` GROUPS 表、Radio 分段＋Tabs 两层树、`?task=pro&panel=<key>` 深链落位（`:83-95`）、S20/S21 键盘语义、每组记忆标签（`:100-104`）、hidden 非卸载（`:169-184`）——E5 修复仅 CSS 层＋animation prop，导航零触碰；Esc 返回/数字键分域/返回按钮（`App.tsx:268-291/:637-641`）不动。
3. **分享回落语义**：v7 上线后 v6 及更早链接/存档一次性失效，走既有「损坏回落默认＋一次提示」通道（`App.tsx:188-205`）；无迁移代码；`wf-route`/hash 双通道互不触碰（p10-spec 红线 5 沿用）。
4. **既有断言零变化**：`check:data` 九组、`check:a11y` 63 组、`check:lifecycle` L1–L13（89 项）、`check:currency` 五组、`cargo test` 75 通过——期望值逐条零变化；**唯一登记例外** = `check-share.mjs:147` 版本常量断言 `SHARE_LINK_VERSION` 6→7（该断言即版本 bump 的机械承载，`:145` 注释原文）＋ v6 载荷样本断言随 v7 样本升级（断言结构与其余七组语义零变化）；新增断言仅 §6 两脚本与 zero-scroll 扩维。
5. **U4 四任务导航零改动**：`TaskSwitcher.tsx` `git diff` 为空——5 项 tablist、label/desc 副行、roving tabindex、数字键分域（App 层）逐项在位；C2 chrome 尺寸变化仅来自 §2.5 深矮档 CSS 档位，组件零改动。
6. **依赖锁定**：package.json dependencies/devDependencies 零变化；零滚动/联动断言经既有 GUI 自动化通道与 esbuild 既有幂，不引入测试框架。
7. **挂载与可达性**：`visitedTasks`/`visited` 首展挂载＋hidden 非卸载原样；`check:a11y` 63 组零回退；锁标 aria 与可见 hint 同源（禁 title-only）；44px 命中清单全保留（复合行/dock/切换条逐项）。
8. **诚实性**：锁态显示派生值不静默同步（§3.2-①）；不支持零滚动的高度回退滚动并明示（守卫 `App.tsx:111-154` 不动），不静默裁切；低于 580 仅单行不遮挡提示并如实登记。
9. **零滚动硬性下限**：580/320 为本规范前提；任何「压缩档」不得引入滚动容器、裁切或遮挡；槽等高互换契约（p10-spec §2.3）延续，禁止加性展开兜底。

---

## §9 尺寸预算

### §9.1 基线（p10-spec R-3 收口实测转抄，收口轮复跑校准）

- dist 合计 **1,994,561 B**（门禁 2,000,000 B，余量 **5,439 B**）；wasm **356,870 B**（缓冲线 387,590 B）；`npm run build && npm run check:size` exit 0。本轮收口时先复跑 `node scripts/check-size.mjs` 与 find+stat 求和校准基线，再按本节记账。

### §9.2 本轮预算

| 项 | 预算 | 说明 |
| --- | --- | --- |
| wasm 增量 | **+0（硬线）** | 任何 wasm 增量出现即返工重审 |
| 本轮净增记账上限 | **≤ 12,288 B（≤12KB）** | 构成估算：effectiveInputs.ts ≈0.5–1KB（压缩后）、store 4 布尔＋setter ≈0.3KB、share 编解码 4 键 ≈0.4KB、CSS 增量（margin-left 规则＋深矮档块＋横幅改流）≈1KB、i18n 8 新键×3 语 ≈0.6KB、勾选逻辑/锁 UI 模板 ≈1–2KB；合计 ≈4–6KB |
| dist 绝对门禁 | ≤ 2,000,000 B | 不放宽、不特批 |

- **两约束关系（诚实声明）**：门禁内可承载净增 = 5,439 B（收口校准值）＋实测回收；12KB 记账上限只有在回收 ≥ 6,849 B 时才可全额使用。回收主体 = en.ts 8 处文案缩短（负增量 ≈0.2–0.4KB）＋死选择器改名（零）＋双栏矮档注释勘误（零）。
- **实际施工预算 = min(12,288 B, 5,439 B ＋ 实测回收)**；实施轮逐项实测并回填本节。
- **降档顺序（门禁不放宽）**：① i18n 并合——`common.paramSync*` 三键并合为 hint 单键（恢复钮复用各面板既有同步钮文案键：`reverse.syncButton` 等，省 2 键×3 语）；② <480 短形态导航键先只补超限最重两键（freedom/principles），其余三键下一轮（<480 档以单行省略＋aria 全文兜底，登记降档）；③ 深矮档 CSS 块合并进既有 ≤480 媒体块（选择器复用）；④ 仍不足 → 缩施工面（先行 §1.1/§1.2/§5 三修复，§3 单源化拆下一轮），登记偏差，不硬塞。

---

## §10 验收矩阵与断言清单

### §10.1 零滚动验收矩阵（显式枚举四维）

| 维度 | 枚举值 |
| --- | --- |
| 视口（在册 10 档，全部 ≥580 高） | 1366×768、1366×650、1366×620、1280×720、1536×864、1440×900、1024×768、768×1024、375×812、375×667 |
| 视口（低于下限档，另列） | 320×568（H=568 < 580：物理极限档） |
| 语言 | zh-CN、zh-Hant、en |
| 主题 | 浅（light）、深（dark） |
| 页面 × 全部内层标签 | freedom＝叶A（明细｜敏感性｜敏感性图⇄兜底行分页）＋叶B（步骤①欲望｜步骤②假设与资产｜反向卡｜反向卡内「估算结果⇄编辑参数」双态｜核心参数展开）；life＝轨迹｜事件｜规划（打工模拟｜社保养老金）｜资产（贷款计算｜买房收租）｜税务 共 5 组 7 内层标签；risk＝模拟｜情景 2 叶；principles＝E1 公式与口径｜E2 假设链条｜E3 数据与来源｜E4 医疗与证据｜E5 声明 5 条目（U1：**不留例外**）；pro＝人生规划（反向估算｜打工模拟｜社保养老金）＋购房金融（贷款计算｜买房收租）＋分析工具（蒙特卡洛｜税务估算｜多情景对比｜公式原理）**九面板逐面板** |

- **在册档组合数 = 10 视口 × 3 语言 × 2 主题 × 5 页 = 300 组**；每组内由贪心遍历覆盖上表全部内层标签/槽态/九面板（`zero-scroll-check.mjs` pageStepFn 协议沿用＋④判定扩展）。判定 = A1 三重（①页根溢出 ②后代内滚枚举 ③ `#wf-main` overflowY）＋ ②′ 槽裁切显式拦截＋ ④ pro 活动面板根在视口内（§5-4）。任一组任一判定失败即返工，逐组读数登记；语言注入逐组回读 `document.documentElement.lang` 确认生效，失效组作废重跑。
- **边界降级档 1200×800（不单列矩阵组）**：该档为 §1.1 E1 点名的形态翻转视口（H=800<880，双栏→叶树），不在上表 10 档——其零滚动面已被 §2 预算覆盖（预算按 H=580 计，对一切 H≥580 的 A 只增不减，1200×800 的 A=676 ≥456），矩阵组基数维持 300（不开 330 组）；形态翻转与裁切风险由 A3 补位断言（叶树在 DOM、split 不在、零回退横幅、零 `.wf-slot` 裁切）。
- **低于下限档（320×568）**：预期回退横幅出现属登记例外；断言收窄为——横幅在 `.atlas-switch-anchor` 之后的文档流中（rect 不与切换条相交）、页根放行滚动无静默裁切、横幅单行（≥320 宽可两行但不遮挡）；不进零滚动 PASS 计数，单独登记。

### §10.2 断言清单（A1–A18，共 **18** 条；全过才收口）

- [ ] **A1 零滚动矩阵**：§10.1 在册 300 组全过（①②②′③④ 五判定），承载 = `zero-scroll-check.mjs` 扩维后 GUI 通道注入执行；逐组读数登记。
- [ ] **A2 低于下限档**：320×568 行为 = 单行不遮挡提示＋放行滚动＋无静默裁切（§10.1 末行口径），登记不走 PASS 计数。
- [ ] **A3 矮视口双栏降级**：1366×768 / 1366×650 / 1366×620 / 1280×720 / 1536×864 / **1200×800** 下 freedom 页为叶树形态（`.wf-freedom-tree` 在 DOM、`.wf-freedom-split` 不在）、零回退横幅、零 `.wf-slot` 裁切（②′）；1440×900 / 1920×1080 仍双栏（`.wf-freedom-split` 在 DOM）且零滚动。1200×800 为 §1.1 点名的边界降级档（H=800<880，1200 宽档中唯一发生双栏→叶树翻转者），断言集与同组其余降级档一致（修订对照 #3）。
- [ ] **A4 提示不遮挡**：挂载后 1s 内活动 Message 容器 rect 与 `.atlas-switch` rect 不相交（position:bottom 生效）；构造回退态（视口 320×568）下 `.wf-fallback-banner` rect 与 `.atlas-switch` rect 不相交。
- [ ] **A5 E5 空白面板**：pro 分析组四标签逐个激活后活动面板根 `getBoundingClientRect().left ≥ 0`、rect 与视口相交、innerText 非空（>0）——税务/多情景/公式原理三标签的 42/376/84 字符内容全部进入视口（起草会话实测 innerX −850/−1897/−2943 态不复现；MC index0 的 65 字符为设计态空态，不作阈值）；人生规划组 index≥1 两标签同判；运行时无 `margin-left` 负偏移（`check-param-sync` 机制 C 静态断言＋④判定动态兜底）。
- [ ] **A6 预设全参数联动（U2）**：应用 single_renter → pro 人生规划反向面板「子女预留」有效输入显示 0（=0×580000，锁态派生）、freedom 反向卡同值；应用 family_one_kid → 两处显示 580000；`applyPreset/clearPreset` 前后 store 快照——reverse/monteCarlo/accumulation/tax 四切片零变化（字节级）；子女字段不隐藏恒显示派生值。
- [ ] **A7 单源锁态（U3）**：默认四标志全 true；改核心回报率 6.0 → 反向面板回报字段、MC 均值字段、打工均值字段同帧显示 6.0；改月开销 → MC 年支出显示 ×12 派生值、打工月开销显示同值；run 提交帧取 baseline 现值（结果与手算对照一致）。
- [ ] **A8 解锁独立**：逐一解锁四标志 → 解锁瞬间切片值 = 当刻核心值（无旧值错位）；此后改核心参数不影响各面板显示与 run；四标志在 store 为 false；恢复钮置回锁态并回填派生显示。
- [ ] **A9 分享 v7 往返**：解锁＋自定义值 → 生成链接 → 恢复 → 四标志与切片值不变；v6 存量链接一次性失效并提示（既有通道）；情景存档保存/恢复携带四标志；`check-share` 断言 0 = 7。
- [ ] **A10 复位与不落盘**：resetAll / resetBusinessInputs → 四标志回 true 锁态派生显示；清 localStorage 刷新后回锁态（不入盘）。
- [ ] **A11 确定性检查**：`npm run check:paramsync` exit 0 且 14 行 PASS 表逐行与 §3.1 普查行对账；`npm run check:i18n` exit 0（§11.1 预算表逐键）。
- [ ] **A12 i18n 三语**：新增 8 键 ×3 语逐键 grep 在位；`check:data` exit 0；语言切换往返无残留（锁态/派生显示/短形态标签随语言更新）。
- [ ] **A13 回归门禁**：`cd src/wasm && cargo test`（75 零变化）、`check:lifecycle`（L1–L13）、`check:a11y`（63 组）、`check:share`（v7 八组）、`check:currency`、`check:data` exit 0、`npx tsc --noEmit` 过、`git diff --stat -- src/wasm` 全空。
- [ ] **A14 尺寸**：`npm run build && npm run check:size` exit 0；dist ≤ 2,000,000 B；wasm ≤ 387,590 B 且 +0；净增 ≤ min(12,288, 校准余量＋实测回收) 且回填 §9.2。
- [ ] **A15 U4 导航零改动**：`git diff --stat -- src/components/TaskSwitcher.tsx` 为空；5 项 tablist/副行 desc/roving tabindex/数字键 1–4/5 分域/Esc 返回逐项在位；44px 命中清单（切换条 chips、叶条/分段条/槽条、复合图标位、dock）逐一 ≥44px。
- [ ] **A16 方案 B 与深链**：`?task=pro&panel=<key>` 九键逐键落位不变；S21 数字键 1/2/3 切组＋显式输入豁免；组间往返已运行模拟结果与表单输入零丢失；S20 墨条动画在位（tabPane 滑入退役不影响墨条）。
- [ ] **A17 S 抽查（七项）**：S1 环 48 档跨档变色、S2 单次脉冲（iteration 1）、S16 落定闪亮、S18 可见性闸（effectiveInputs 重渲染后闸仍生效）、S20 墨条动画在位、S19 hover 全状态生效、S6 五宿主空态在位——零回退。
- [ ] **A18 键盘与焦点**：任务数字键分域、F0/K1 叶条方向键漫游（p10-spec A10 语义延续）、焦点迁移 preventScroll 无滚动复位残留；A1 矩阵随 keyboard-interactive 状态抽查 2 组（freedom 叶B＋pro 分析组）无滚动焦点陷阱。

---

## §11 i18n 键预算（新键 8 ×3 语 = 24 条；既有键值变更 8 键 10 处——en.ts 8 处＋summaryPrefix zh-CN/zh-Hant 各 1 处微缩）

### §11.1 单行关键文案三语长度预算表（`check-i18n-budget.mjs` 门禁值；推导式：上限 = ⌊槽内宽 ÷ 字宽⌋，CJK 字宽 ≈ 字号，EN ≈ 7px/字符 body、6px caption；槽内宽按最窄基准 320 视口；唯一例外 = F2 行预留插值数字占位 W，算式见该行——逐键推导全文承 research-p10fix-layout §4）

| 单行槽位 | 最窄内宽 | CJK 上限 | EN 上限 | 现值超标键（起草会话实测 字符数 zh/zh-Hant/en） | 处置 |
| --- | --- | --- | --- | --- | --- |
| C2 tab label（<480） | ≈42px | 3 | 6 | freedom 4/4/14、principles 4/4/17、life 4/4/13、risk 5/5/8、pro 4/4/8（zh 4–5 字与 en 全数超 3/6） | <480 档切换为短形态键渲染（新键 5 个 §11.2，短形态键自身 ≤3/≤6 为硬门禁对象）；≥480 全形态键放行（85px 段宽容 7 CJK）；label 降 12px（CSS） |
| C2 tab desc（≥768 双行） | ≈248px（@1366） | 17 | 35 | proDesc en 41 | en ≤35（缩短，键值变更①） |
| F0 叶切换条两段 | ≈120px | 8 | 16 | outputTitle 17/17/52（zh 实值「财富自由参考线（480 法则基线）」） | **软预算行**：zh/zh-Hant 沿用既有触屏档单行省略＋aria 全文机制（global.css:806-809 在册、A1 zh@320 已过）；en 缩短 "Results"(7) 使标签全显（键值变更②，仅 en.ts） |
| F3/F7/K1/L4/R4 槽条段 | ≈120px | 8 | 16 | sensitivity.title en 27、mcTitle en 22、scenarioTitle en 25、stepAssumption en 20（zh 6/6/5/5 全达标） | en："Sensitivity"(11) / "Monte Carlo"(11) / "Scenarios"(9) / "Assumptions"(11)（键值变更③④⑤⑥，硬门禁行） |
| 预设 chips（4 格栅格） | ≈56px | 4 | 7 | en 单词化已修（§10-11 在册） | 保持 ≤7（守成行） |
| F2 摘要行（<768） | ≈264px | 16 | 34 | summaryPrefix 17/17/76 | **完整算式：34 = ⌊(264−21)/7⌋**——插值数字占位 W=21px ＝ **约定占位常量**（≈3 字符位，典型短形态「1.6」量级；修订对照 #2 勘误：初版注为「数值节点最短实值形态『0.0』」，经 node Intl 实证 `formatNumber` 尾零裁剪后 0 值实出形态为「0」1 字符——`format.ts:18-22` 注释「整数不带小数点」＋实跑 zh/en `format(0)` 均返回 "0"，「0.0」非其输出形态）；数值节点 `wf-nowrap` 禁内断原子折行，渲染于 `BasicCalculator.tsx:1136-1153`；域核对：W≤26px（264−26=238=34×7）即得 34，W=21px 为域内取值；研究档原列值 36 = 1 字符占位乐观界（⌊257/7⌋=36）已随修订统一为 34（修订对照 #2）。**口径边界**：原子块含单位后缀（`en.ts:36` wanUnit="million CNY" 实读 → en 最短原子块 "0 million CNY" 13 字符 ≈91px、典型 "1.635 million CNY" 17 字符 ≈119px），本门禁 34 只约束 prefix 自身宽度；prefix＋原子块同行单行承载严限 ⌊(264−4−91)/7⌋=24 不作门禁值——残余折行行高由 §2 ±8px 静态口径与 A1 实测终审吸收。三语压缩句式：zh「按当前参数，财富自由参考线约为」(15)、zh-Hant 对应微缩 (15)、en "Freedom line at current inputs ≈"(32 ≤34)（键值变更⑦；插值占位符集不变；**zh/zh-Hant 各 1 处微缩为唯一非 en 键值变更**，research-p10fix-layout §4 同判——不缩则换行破 F2 两行预算 46） |
| 公式解构行 | ≈264px | 22 | 40 | formulaRow 10/10/19（已修） | 保持 ≤22/≤40（守成行） |
| P1 条目标签 | ≈120px | 8 | 16 | entryEvidence en 17 | en "Evidence"(8)（键值变更⑧）；其余四条目 en ≤16 守成 |
| L1/R1 分段条（<480 五段） | ≈42px | 3 | 6 | groupAnalysis en 14 等 | 既有单行省略＋aria 全文兜底（global.css:806-809 在册机制，非导航段豁免行）——不入硬门禁，软预算行 |
| scrollFallback 横幅 | — | — | — | 19/19/51 | 回退例外路径可换行（§1.2-② 文档流不遮挡）——软预算行 |
| migrate notice（底部气泡 ≤2 行） | ≈264px×2 | 50 | 120 | 23/23/94 | 达标（软预算行，不判挂） |

### §11.2 新键（8 ×3 语 = 24 条）

| 键域 | 新键（数） | 用途 | 承载 |
| --- | --- | --- | --- |
| common.* | paramSyncLockAria / paramSyncHint / paramSyncRestore（3） | 四新标志共用锁标 aria「跟随核心参数，点击解锁」/ hint 一句话 / 恢复联动按钮 | §3.2；MC 既有 `mc.meanSync*` 三键维持原样不迁移（登记待后续统一） |
| atlas.nav.* | freedomShort / lifeShort / riskShort / principlesShort / proShort（5） | <480 短形态标签（zh-CN：刻度/轨迹/风险/原理/专业；zh-Hant：刻度/軌跡/風險/原理/專業；en ≤6：Scale/Life/Risk/Learn/Pro） | §11.1 行 1；先例 = 币种/语言 Select 双形态（`App.tsx:411-452`）与 L1 短形态（p10-spec §1.2） |

- 复用既有键零改名：`reverse.syncButton` 等同步钮文案（恢复钮降档复用候选）、`atlas.scrollFallback`（横幅复用）、`atlas.migrate.notice`（position 改造键值零改）。
- 三语键集一致性由 `check:data` 承载；新增键三语在位逐键 grep 登记（A12）；语言切换往返无残留入 A12。

---

## 附 A：本规范自身合规自检（起草会话实跑记录）

| # | 检查 | 命令/方式 | 结果 |
| --- | --- | --- | --- |
| A-1 | E5 根因双重复核 | `grep -n "marginLeft" node_modules/@arco-design/web-react/es/Tabs/tab-content.js` → :20 内联偏移；`grep -c arco-tabs-tabpane / arco-tabs-pane es/Tabs/style/index.css` → 0 / 1；`grep -n className es/Tabs/tab-pane.js` → :33 `prefixCls + "-pane"` | 三条全数证实 §1.4 根因 |
| A-2 | 三语键长度实测 | 临时脚本（esbuild 转译三语 locale 后逐键计数，29 键 ×3 语；脚本在 `%TEMP%/p10fix-spec-scratch/`，未入仓库） | §11.1「现值」列全部数值出自该输出（proDesc en 41、outputTitle en 52、summaryPrefix en 76、sensitivity.title en 27、mcTitle en 22、scenarioTitle en 25、stepAssumption en 20、entryEvidence en 17 等） |
| A-3 | 语言持久化键 | `grep -n "wf-lang" src/i18n/index.ts` → :15 `STORAGE_KEY = "wf-lang"` | driver.setLang 依据成立（§1.5-②） |
| A-4 | 版本闸与断言现状 | `grep -n "SHARE_LINK_VERSION" scripts/check-share.mjs` → :147 `assert.equal(SHARE_LINK_VERSION, 6, …)`；`src/services/share.ts:59` = 6 | §8 红线 4 唯一例外登记依据 |
| A-5 | 行号锚点实测 | Read/grep：`App.tsx:296-300/:560-570/:575-577`、`hooks.ts:119/:135-137`、`global.css:581-592/:634-645/:856-862/:1058-1142/:1228-1237/:2044-2059/:2469/:939`、`store:115-122/:175-196/:186/:190/:193/:217-250/:265/:277/:280/:306-333/:320/:323/:329/:337-361/:347`、`share.ts:59/:167/:313-316/:347`、`defaults.ts:37-47/:95-102/:127-134/:177-182/:201-216`、`presets.ts:50/:58/:66/:74`、`BasicCalculator.tsx:522/:575/:590-592/:1108/:1283/:1326-1362`、`ReversePanel.tsx:74-121/:140/:156-164/:170/:246/:250/:272-288`、`AccumulationPanel.tsx:64/:94-97/:138-143/:157/:324-332/:346-349/:360-365/:383-384/:410-411`、`MonteCarloPanel.tsx:106-113/:285-294/:363-364/:654-661/:662-675/:683-694/:705-714`、`AdvancedPanel.tsx:48-76/:83-95/:116-150/:169-195`、`TaskPages.tsx:51`、`RiskPage.tsx:50`、`PensionPanel.tsx:31/:64-65`、`zero-scroll-check.mjs:27-38`、`check-data.mjs:45-67/:121-123`、`check-share.mjs:32-42/:145-147` | 全文引用行号逐一实测；research-p10fix-census 的 presets 锚点（:54/:66/:78/:90）经复核漂移，本文以 :50/:58/:66/:74 为准（§3.1 勘误行） |
| A-6 | 禁词扫描 | `grep -inE` 对任务书给定禁词清单（13 词：4 个来源品牌词＋9 个材质/动效词；词表本身不入本文，先例 p10-spec 附 A A-2）逐词扫描；修订轮扩为**组内双档同扫**——本文＋配套输入档 research-p10fix-layout.md 同一命令 | 本文 0 命中（起草轮实跑两次：初稿与修订后各一次，均无匹配；A-6 行自身亦不得含词表——本行即按此约束改写）；输入档修订前 4 处命中（§2 表三行体系名带厂商名＋自检第 5 条来源域名），已去品牌化改写（修订对照 #1），修订后两档同命令复跑均 0 命中，已提交全部文档同命令计数 0 复核成立 |
| A-7 | 局限声明 | — | ①chrome C1=32/C2=52（≥768）与双栏右列 628 为静态推算（±8px，实测锚点仅有 <768 73/44 与 ≥768 收纳档 29，承 p10-spec R-4）；②§2 各页加总未做浏览器渲染实测，A1 矩阵实测为终审；③§3 机制、§5/§6 两脚本为设计稿未施工未执行；④E1 三个破功视口的 84–110px 裁切读数转引任务书实测描述，本文静态互证（628−526=102 / 742−644=98）与之同源但不等值（±8px 容差带）；⑤`ReverseCard.tsx` 行号以 ReversePanel.tsx 同文件内组件区段（`:246-331`）实测为锚，ReverseCard 内部行随施工复核。 |

---

## 修订对照（复核 findings 逐条吸收登记）

> 登记格式沿用 p10-spec 文末表（# / 级别 / finding 摘要 / 处置 / 落点）。起草轮无登记项；复核轮 findings 3 条（P0×1、P2×2），**3 条全吸收、零保留项**。本节文字自身亦受禁词纪律约束（词表不落字面）。

| # | 级别 | finding 摘要 | 处置 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | P0 | 禁词扫描不满足（REJECT 项）：输入档 research-p10fix-layout.md 4 处命中——§2 表三行体系名带厂商名（:91/:92/:94）＋自检第 5 条来源域名再现（:133）；本文与 census 均 0 命中、已提交全部文档计数均 0。本文 §2.5 数值档依据恰出自该输入档，附 A A-6 自报 0 命中仅覆盖本文——两文档成组交付时禁词纪律被输入物击穿 | **吸收**。输入档四处去品牌化改写：厂商名不落字面、保留库名作体系代称（HIG《Layout》布局指南 / TDesign / Semi Design），出处改「官方文档数据接口」＋去域路径；引用纪律注明同 research-ds-comparison.md 引用纪律行先例（厂商可写库名、含禁词子串的域名以自然描述替代）。改后修订轮实跑同条 grep（13 词、-inE）复核：输入档 0 命中（修订前 4→0）、本文 0 命中不变；A-6 扩为组内双档同扫并登记修订前后结果 | research-p10fix-layout.md:91/:92/:94/:133；本文附 A A-6 |
| 2 | P2 | check-i18n-budget 期望值 F2 EN 上限 34 与自述推导式不可复算（⌊264÷7⌋=37≠34）；输入档 §4 同行 EN 上限列又记 36（处置列 ≤34）——两文档两值互不一致，脚本注释复制该式将得出与门禁值不同的结果（C2/F2-CJK 等其余抽验键复算成立） | **吸收**。§11.1 F2 行补出完整算式 **34 = ⌊(264−21)/7⌋**：插值数字占位 W=21px，并给域核对 W≤26px（264−26=238=34×7）；输入档 36 的由来判明为 1 字符占位乐观界（⌊257/7⌋=36），统一取 34（两档处置列本一致 ≤34）；§11.1 表头与 §6.2 脚本注释口径同步注记该例外式，门禁值维持 34 零变化。**本修订轮勘误（吸收文本自证修正）**：初版把 W 注为「数值节点最短实值形态『0.0』3 字符」——node Intl 实证 `formatNumber`（`format.ts:18-22`，maximumFractionDigits、注释「整数不带小数点」）0 值实出形态为「0」1 字符（zh/en `format(0)` 均返回 "0"；典型首屏 "1.635"/"163.5" 5 字符），「0.0」非其输出形态；W=21px 改记为**约定占位常量**（≈3 字符位），并在 §11.1 F2 行补原子块口径边界（单位后缀入块：en wanUnit="million CNY" `en.ts:36` → en 最短原子块 "0 million CNY" 13 字符 ≈91px，prefix＋原子块同行严限 ⌊(264−4−91)/7⌋=24 不作门禁、残余折行归 A1 终审）；门禁值 34 与两档一致性不变 | 本文 §11.1 表头与 F2 行、§6.2；research-p10fix-layout.md §4 F2 行（36→34＋同款勘误） |
| 3 | P2 | E1 修复自身点名的边界视口 1200×800（§1.1「全部落叶树」，H=800<880 由双栏转叶树）不在 §10.1 在册 10 档、也不在 A3 断言清单——被点名发生形态翻转却零验收覆盖的唯一档位 | **吸收**（两案中取 A3 补档案，不扩矩阵）。A3 降级清单补 1200×800，断言与同组一致：`.wf-freedom-tree` 在 DOM、`.wf-freedom-split` 不在、零回退横幅、零 `.wf-slot` 裁切（②′）；§10.1 增补该档不单列矩阵组的理由——零滚动面已被 §2 预算覆盖（预算按 H=580 计，对一切 H≥580 的 A 只增不减，该档 A=676 ≥456），矩阵组基数维持 300（不开 330 组），边界档的独特风险恰为形态翻转、由 A3 直接断言 | 本文 §10.1（新增边界降级档行）、§10.2 A3 |

---

## P10-F 残留裁决（双验收未通过后的主会话处置，2026-11-28）

> 验收 3 轮（9→11→7 条，发现递减），第 3 轮 7 条 findings 的主会话逐条裁决与
> 处置如下。修复工程师在运行终止前已落盘 ZS-01/ZS-03/ZS-04/ZS-05 的修复
> （en.ts 概览句与行标签缩短、App.tsx belowFloorNow 重算、App.tsx:629
> ErrorBoundary 外接），主会话在**当前构建**逐条浏览器复测后收口。

| # | finding | 裁决 | 处置与证据 |
| --- | --- | --- | --- |
| ZS-01 | EN 375×667 pro 公式原理 条目竖向裁切（Assumption chain 43px / Formula & terms 19px） | **已修** | 修复工程师已将公式原理重构为条目内子标签（公式与口径/假设链条/数据与来源/医疗与证据/声明）+ 分页（1/2）；主会话当前构建复测：pane 零内容裁切、pageΔ=0、假设链条节存在 ✅ |
| ZS-02 | EN 1366×620 反向估算基线行横溢（1063>1047） | **已修** | 当前构建复测 worst row over=−17（行 1055 ≤ 容器 1080）✅ |
| ZS-03 | 回退守卫粘滞（belowFloorViewport 一次性冻结 → 放大后横幅卡死） | **已修** | 修复落点 App.tsx belowFloorNow 逐检查重算（注释「第 3 轮验收复现修复」）；主会话复测 320×568 加载 → 放大 1366×768：横幅撤销、docΔ=0、fallbackClass 撤销 ✅ |
| ZS-04 | SPA 切换整页白屏（一次观测未复现） | **已修** | App.tsx:629 渲染树外接 ErrorBoundary（降级 UI + reload 按钮 + console 堆栈留证）；不可复现项以边界兜底收口 |
| ZS-05 | EN 月开销输入框截断（56<65，「2990.00」尾切 + 后缀拥挤） | **已修（主会话）** | 根因 units.yuanPerMonth EN 值过长；缩短为 "/mo"（金融 UI 惯用），一次修 5 个 CNY 输入后缀消费点；复测 w=113=scrollW、clipped=false、后缀 "/mo" ✅ |
| ZS-06 | 解锁覆盖刷新后不保持，与任务书 D「刷新后保持」字面冲突 | **裁决维持不持久化** | store:118「业务输入不落盘」为隐私纪律级既定裁定（业务输入只经分享链接/情景存档携带）；任务书 D 系规范内部冲突（§4 与 §3.2-⑤ 打架），以 §3.2-⑤ 为准；如需跨会话保留，走「载入情景存档」既有路径，登记为产品决策项非缺陷 |
| ZS-07 | 留白观感 3 项（principles 内容列 ~45% 宽、risk/life 槽空态留白、EN 后缀两行观感） | **登记缓议** | 无裁切/拥挤/错位；后缀两行观感已随 ZS-05 "/mo" 缩短缓解；布局级留白重排属设计轮议题，登记 design-atlas-brief 候选 |

### 收口终态

- 十二项门禁全绿（含新增 check-param-sync 14 行普查对账、check-i18n-budget 三语长度预算）；
- 主会话当前构建复测：ZS-01/02/03/05 全 ✅，ZS-04 边界兜底在位，ZS-06/07 登记处置；
- 双验收（验收员 3 轮累计 28 条 + 独立复测员）未到 PASS 即预算终止——**本轮以
  「主会话逐条复测当前构建」替代第 4 轮矩阵走查**；如需完整第 4 轮矩阵走查，另起验证轮。
