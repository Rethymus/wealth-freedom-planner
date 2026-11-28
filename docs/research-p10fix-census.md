# P10fix 共享参数普查与单源机制研究（research-p10fix-census）

> 依据：源码实读（file:line 锚点均可 grep 复核）+ 本会话浏览器实测（vite preview @ HEAD c18c59f，dist 构建时间 2026-11-25 15:41，1440×900）。
> 已知缺口：E3 联动未覆盖专业面板 / E4 反向估算回报·通胀重复 / E5 分析工具四标签空白卡（三者均在本会话实读或实测中复核）。

## §1 共享参数普查表

核心参数定义：freedom 输入卡的 baseline 切片七字段（`defaults.ts:37-47`：月开销 / 子女数 / 单孩成本 / 健康预留 / 重大投入 / 名义回报率 4.5 / 通胀率 2.0）+ 自由刻度已有资产（`defaults.ts:177-182`）。普查粒度 = **面板组件 × 字段**（同一组件多宿主——pro/life、pro/risk、pro/freedom 共用同一 store 切片，只计一行，宿主在行内登记）。

无重复字段的面板（grep 实证零命中， census 排除）：LoanPanel / RentalPanel（利率、年限、租金等属独立域，`grep monthlyExpense|nominalReturn|inflation|healthReserve|…` 零命中）；TaxPanel（税前年收入为税域字段）；InsightsPanel（纯展示零输入）；LifeLensTrack / LifeEventEditor / LifeTrajectoryCard（只读消费 store，无核心参数输入）。PensionPanel 消费 baseline 为只读组合调用（`PensionPanel.tsx:63-67`），无重复输入。

| # | 面板（宿主） | 重复字段 | 输入落点 file:line | 默认值来源 | 当前联动方式 |
|---|---|---|---|---|---|
| 1 | 反向估算 ReverseFields（pro 人生规划 `ReversePanel.tsx:170`；freedom 叶B F8 `BasicCalculator.tsx:1283` + 桌面右列 `:1359` 经 ReverseCard `:331`） | 子女预留 childReserve（派生=子女数×单孩成本） | `ReversePanel.tsx:71-81` | `REVERSE_ESTIMATE_DEFAULTS.childReserve=580000`（`defaults.ts:97`） | 手动同步按钮（`syncFromBaseline` `ReversePanel.tsx:156-164` / `ReverseCard.tsx:277-285`）——**E3 缺口** |
| 2 | 同上 | 健康预留 healthReserve | `ReversePanel.tsx:82-92` | `200000`（`defaults.ts:98`） | 手动同步按钮（同 #1） |
| 3 | 同上 | 重大投入 majorInvestment | `ReversePanel.tsx:93-103` | `0`（`defaults.ts:99`） | 手动同步按钮（同 #1） |
| 4 | 同上 | 名义回报率 nominalReturnPct | `ReversePanel.tsx:104-112` | `4.5`（`defaults.ts:100`） | 手动同步按钮（同 #1）——**E4 缺口** |
| 5 | 同上 | 通胀率 inflationPct | `ReversePanel.tsx:113-121` | `2.0`（`defaults.ts:101`） | 手动同步按钮（同 #1）——**E4 缺口** |
| 6 | 打工积累 AccumulationPanel（pro 人生规划 `AdvancedPanel.tsx:54`；life 规划组 `TaskPages.tsx:51`） | 月开销 monthlyExpense | `AccumulationPanel.tsx:345-358` | `2990`（`defaults.ts:204`） | 无自动：不一致 hint（`:353-357`）+ 显式同步钮（`:485-493`） |
| 7 | 同上 | 目标值 targetValue（对照基础临界值） | `AccumulationPanel.tsx:359-372` | `1,635,200`（`defaults.ts:205`，= 默认临界值，check:data B 组在案） | **自动**：`accumulationTargetSynced` 默认 true（`store:186`），手动改即解除（`:364-367`），恢复钮（`:475-484`） |
| 8 | 同上 | 名义回报均值 nominalReturnMeanPct | `AccumulationPanel.tsx:379-404` | `4.5`（`defaults.ts:206`） | **无**（无按钮无锁定） |
| 9 | 同上 | 通胀均值 inflationMeanPct | `AccumulationPanel.tsx:406-413` | `2.0`（`defaults.ts:208`） | **无** |
| 10 | 蒙特卡洛 MonteCarloPanel（pro 分析组 `AdvancedPanel.tsx:70`；risk 模拟叶 `RiskPage.tsx:50`） | 年支出 annualSpend（派生=月开销×12） | `MonteCarloPanel.tsx:662-675` | `35880=2990×12`（`defaults.ts:129`） | 无自动：不一致 hint（`:670-674`）+ 显式同步钮（`:765-773`） |
| 11 | 同上 | 名义回报均值 nominalReturnMeanPct | `MonteCarloPanel.tsx:683-694` | `4.5`（`defaults.ts:130`） | **自动**：`mcMeansSynced` 默认 true（`store:193`），锁态派生直显（`:106-108,:688`）+ 运行提交帧覆盖（`:282-294`）+ 恢复钮（`:777-781`）——P10 §4 已收口，为推广模板 |
| 12 | 同上 | 通胀均值 inflationMeanPct | `MonteCarloPanel.tsx:705-714` | `2.0`（`defaults.ts:132`） | **自动**（同 #11，`:709`） |
| 13 | 同上 | 当前资产 currentAssets（对照自由刻度已有资产） | `MonteCarloPanel.tsx:653-661` | `500000`（`defaults.ts:128`） | **无**（语义注：模拟初始资产 vs 自由刻度展示资产，默认值恰好同值） |
| 14 | 打工积累 AccumulationPanel（宿主同 #6） | 当前资产 currentAssets（同上） | `AccumulationPanel.tsx:324-332` | `500000`（`defaults.ts:202`） | **无** |

**计数结论**：重复字段总数 = **14**（#1–#14）。按联动方式：自动 3（#7/#11/#12）、手动同步按钮 7（#1–#6/#10）、完全无联动 4（#8/#9/#13/#14）。既有同形联动先例还有 pensionMonthsSynced（计发月数，`store:190/:277`，PensionPanel `:296-316`）——属面板自有参数联动，不计入核心参数重复表。

## §2 单源机制设计（mcMeansSynced 模式推广）

### 2.1 推广模板（P10 §4 既有实现，五要素）

`mcMeansSynced`（`store:115-122`）已验证的单源五要素：① 锁态（true）显示层取核心参数派生直显（disabled+锁标，`MonteCarloPanel.tsx:683-714`），**零面板切片写入**；② 运行提交帧同帧解析覆盖（`effectiveInputs` `:106-108` → `run()` `:282-294`，先例 AccumulationPanel `effectiveTarget` `:94-97` → `run()` `:152-163`）；③ 解锁 = 显式动作，同时把当刻核心值落入切片（`unlockMeans` `:110-113`，消除「解锁即见旧值」错位）；④ 口径标志随分享载荷携带（v6 第 13 键，`share.ts:84-86/:315-316/:347`；`store:320/:347`——发送方所见=接收方所得）；⑤ 不入 localStorage（业务输入不落盘纪律，`store:116-119`）。

### 2.2 统一 store 形态（新增 4 个组级布尔，全部默认 true、入 businessDefaults）

| 新标志 | 覆盖字段（普查行） | 派生口径 |
|---|---|---|
| `reverseSynced` | #1–#5（reverse 切片 5 字段 = 现手动同步钮集合） | childReserve=childCount×costPerChild（childCount=0 → 0，字段恒在不隐藏）；其余四字段直取 baseline 同名值 |
| `mcSpendSynced` | #10（monteCarlo.annualSpend） | annualSpend=monthlyExpense×12（现 `:363-364` 派生式收编） |
| `accExpenseSynced` | #6（accumulation.monthlyExpense） | 直取 baseline.monthlyExpense |
| `accMeansSynced` | #8/#9（accumulation 两均值） | 同 #11/#12 机制 |

既有 `accumulationTargetSynced`（#7）、`pensionMonthsSynced` 不迁移，零行为变化。四标志写入 `businessDefaults()`（`store:175-196`）；写入路径同形：`setXxxSynced(v)`（`store:265/:277/:280` 先例）。**currentAssets（#13/#14）裁定不联动**：自由刻度已有资产带 `0=未填写` 哨兵语义（`defaults.ts:177-182`、进度环隐藏口径 `BasicCalculator.tsx:710`），联动会把哨兵 0 传入模拟初始资产；登记为语义异名不属重复（建议 i18n label 区分「已有资产（展示）」与「模拟初始资产」）。

派生单源化落点：新增 `src/store/effectiveInputs.ts` 纯函数模块（零 React/zustand/DOM 依赖）：`effectiveReverse(reverse, baseline, reverseSynced)`、`effectiveMonteCarlo(mc, baseline, {means, spend})`（收编现 `:106-108` 内联式）、`effectiveAccumulationSim(acc, baseline, {expense, means})`；三面板的显示层与计算调用点统一改为消费该模块（`calcReverse` 调用处 `ReversePanel.tsx:140`、`ReverseCard.tsx:262`；`calcMonteCarlo*` `MonteCarloPanel.tsx:282-294`；`calcAccumulation` `AccumulationPanel.tsx:157`）。字段 UI 形态复制 #11/#12 的 disabled+锁标+恢复钮（`lockButton` `MonteCarloPanel.tsx:115-124`）。

### 2.3 share 载荷与版本处置

- ShareState 新增第 14–17 键：`reverseSynced` / `mcSpendSynced` / `accExpenseSynced` / `accMeansSynced`（全布尔）→ `SHARE_LINK_VERSION` **6→7**（形状变更即递增、版本单点闸、无迁移代码——v1→v6 既有决策链 `share.ts:35-59`）；v6 及更早链接与情景库存档一次性失效。
- 解码端：四键逐键严格布尔校验，缺键 / 非 true|false → 整体 null（`mcMeansSynced` 同款 `share.ts:313-316`）；`applyShareState` 恢复标志本身（`store:320` 先例）。锁态派生值不单独入载荷——随 baseline 切片入链，两处一致（v6 论证 `store:347`）。
- 现状偏差登记：`applyShareState` 对 `accumulationTargetSynced/pensionMonthsSynced` 恢复为 false（`store:323/:329`）与新四键「随载荷恢复」口径不同——属历史两套口径并存，本轮不动旧两键（零行为变化），登记待后续统一。

### 2.4 预设对子女类字段的联动口径

`applyPreset/clearPreset`（`store:217-250`）只整体覆盖 baseline 五字段。口径：`reverseSynced` 锁态下反向卡 childReserve 显示层即时跟随派生值（预设一孩 58 万 → 反向卡 58 万；childCount=0 → 0），零 `reverseInputs` 写入、零 resetEpoch 参与；解锁态预设不触碰 reverse 切片（与「预设不触碰其他切片」现状一致，`clearPreset` 注 `store:230-237`）。四画像 `costPerChild` 恒 580000（`presets.ts:54/:66/:78/:90`），check:data E 组已在案。

## §3 E5 空白面板根因（file:line 级）与修复方案

### 3.1 根因（主因 + 次因）

**主因：Arco Tabs 横向轮播的内联偏移作用在项目 CSS 强改为纵向列布局的容器上。**
- 机制侧：TabContent 对 `.arco-tabs-content-inner` 写内联 `style.marginLeft = -activeIndex×100%`，靠横向 flex 行（每 item `width:100%`）滑动选中第 N 列（`node_modules/@arco-design/web-react/es/Tabs/tab-content.js:20`；item CSS `es/Tabs/style/index.less:626-636`：非活动 `height:0`、活动 `height:auto`）。
- 项目侧：`src/styles/global.css:1105-1109` 把 `.wf-adv-tabs .arco-tabs-content/-content-inner` 覆写为 `flex-direction: column`（`:1108`；P10 零滚动骨架让 `.wf-slot` 吃到剩余高度）→ 列布局下 item 纵向堆叠，`marginLeft:-index×100%` 不再选列，而是把**整叠内容左移 index×容器宽**；再被 `.wf-main` 的 `overflow:hidden`（`global.css:581-584`）裁掉 → **index≥1 的标签全部呈现空白卡**。AdvancedPanel 三组 Tabs 恒挂载、非活动组经 wrapper `hidden` 隐藏（`AdvancedPanel.tsx:169-184`），四标签均在同组内，故组内切换全部命中。

**次因（加重「空白卡」观感）：死选择器。** `global.css:1122/:1128/:1138` 目标 `.arco-tabs-tabpane`，而 Arco 实际类名为 `.arco-tabs-pane`（`es/Tabs/tab-pane.js:33`；编译产物 `es/Tabs/style/index.css` 仅 1 处 `arco-tabs-pane`、零 `tabpane`）→ 面板根的 flex 填充链断在 pane 层（实测 MC pane 高 292 悬在 634 高内容盒顶部，底部大片空白）。

### 3.2 本会话实测复现与因果验证（dist@HEAD，非源码推演）

① 分析工具组四标签 active item：MC（index0）innerText=**65 字符**（与缺口描述逐字吻合，内容为设计态空态：槽条+Empty 占位+运行钮）、税务估算 innerText=42 而 `innerX=-850`、多情景对比 376/-1897、公式原理 84/-2943——三者内容完好渲染但整体左移出视口；② 人生规划组打工模拟 `-100%`/-850、社保养老金 `-200%`/-1897 同病（缺口清单只列分析组四标签，实测组内 index≥1 普遍命中）；③ 因果验证：对公式原理 pane 内联 `setProperty("margin-left","0","important")` 后 activeX -2943→197、inViewport false→true。

### 3.3 修复方案

1. `global.css` 增一行：`.wf-adv-tabs .arco-tabs-content-inner { margin-left: 0 !important; }`（中性化 `:1108` 列布局与轮播偏移的冲突）——列布局下非活动 item 已 `height:0`，轮播 margin 无存在必要；tabPane 滑入动画随之失效，登记退役（animation 语义变更注记）。
2. 死选择器改名：`global.css:1122/:1128/:1138` 三处 `.arco-tabs-tabpane` → `.arco-tabs-pane`，恢复面板根填充链（槽高真实到位，消除「上半截内容+下半截空白」观感）。
3. 回归闸：§4 机制 C + `scripts/zero-scroll-check.mjs` 扩展「pro 三组全部标签 active item inViewport」断言。

## §4 确定性测试设计（同步态下每面板有效输入 = 核心参数）

落点 `scripts/check-linkage.mjs`（`npm run check:linkage`），沿用 esbuild 转译 + node:assert 既有幂（`scripts/check-data.mjs:45-67` loadModule、`check-share.mjs:32-42`；esbuild 在 vite 依赖树内零新依赖）。

- **机制 A（行为断言，裁决路径）**：esbuild `transformSync` 转译 §2.2 的 `src/store/effectiveInputs.ts` + `src/data/defaults.ts` 后在 Node 内 import（直接断言纯模块而非 zustand store——store 顶层 `readInitialPrefs()` 触碰 `window`（`store:202`），Node 内不可挂载；这正是派生逻辑抽纯模块的动机）。断言组：① `effectiveReverse(REVERSE_ESTIMATE_DEFAULTS, BASELINE_DEFAULTS, true)` 深相等 `{childReserve:0×580000=0, healthReserve:200000, majorInvestment:0, nominalReturnPct:4.5, inflationPct:2.0}`（算式入注释，禁魔法期望数——check-data 纪律）；② 预设夹具 family_one_kid → childReserve 派生 = 1×580000=580000；③ `effectiveMonteCarlo(MONTE_CARLO_DEFAULTS, BASELINE_DEFAULTS, {means:true,spend:true})` → annualSpend=2990×12=35880、均值 4.5/2.0；④ `effectiveAccumulationSim(…, {expense:true,means:true})` → 2990/4.5/2.0；⑤ 解锁语义：标志 false → 有效输入 ≡ 面板切片原值（改 baseline 不漂移）；⑥ 解锁快照函数返回当刻核心值（unlockMeans 语义）。
- **机制 B（接线存在性，可 grep 复核）**：正则断言面板源码——`calcReverse(effectiveReverse(`（ReversePanel/ReverseCard 两调用点）、`calcMonteCarlo(effectiveInputs)`（MonteCarloPanel run）、`value={reverseSynced ?` 等锁态派生直显在位；每条断言附 file:line 注释。
- **机制 C（E5 回归）**：读 `global.css` 断言 `margin-left: 0 !important` 规则在位且零 `.arco-tabs-tabpane` 残留。
- 通过判据：`node scripts/check-linkage.mjs` 退出码 0，输出 14 行 PASS 表（= §1 普查行逐行对账）；GUI 通道另跑 zero-scroll 扩展断言。

## 收口登记

- 本研究会话实测通道：vite preview（127.0.0.1:4173，服务 dist@HEAD c18c59f，bundle `index-BkofBj3k.js` 与磁盘一致已核）+ 内置浏览器坐标点击 + DOM 测量；E5 因果验证为运行时注入样式，未改动任何仓库文件。
- 未跑：修复方案零施工（本文档只研究不实施）；§4 脚本未编写未执行（设计稿）；三语 i18n 新键（锁标 hint/恢复钮）未盘点，实施轮按 `mc.meanSyncHint`/`mc.meanSyncRestore`（`MonteCarloPanel.tsx:691/:778`）同形补齐。
