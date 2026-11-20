# P5 实施规范：设计语言落地（静水账房 · 令牌升级 · 巧思 · 冗长治理）

| 项 | 值 |
| --- | --- |
| 文档性质 | 本轮实施规范（文件级、可勾选）；宪法层见 `docs/design-language.md` |
| 研究依据 | `docs/research-design-language.md`（巧思目录 14 项 + 参数表）、`docs/research-fintech-ui.md`（数字质感 / 内容经济学） |
| 铁律 | 不引入新依赖（package.json:15-35 依赖集冻结）；不做新功能（不改任何计算公式与数据流，巧思只动视觉与交互层）；全局 CSS 变更集中在 `src/styles/global.css`；TS strict（`npm run build` 含 `tsc --noEmit`）；文档零禁词（交付前扫描记录见文末） |
| 三源对账纪律 | 新主题组令牌五点同步：`src/data/types.ts` ThemeTokens 接口 + `src/data/defaults.ts` THEME（226-270）与 THEME_DARK（276-319）+ `src/App.tsx` 注入数组（80-127）+ `global.css` :root 浅色块（21-99）与深色块（293-337），键与值逐一对账 |

---

## §0 概念映射（北极星 → 本项目的每个视觉面）

北极星「静水账房」一句话：安静而精密的私人账房——数字被认真对待，庆祝只发生一次。签名元素编号 S* 见 design-language.md §2，实施项见本规范 §3。

| 视觉面 | 现状载体 | 落入的签名元素 | 概念转译 |
| --- | --- | --- | --- |
| 顶栏（L1 材质） | App.tsx:230-297 | 无新增（S9 已移至输出卡卡头，见修订对照 R4） | 账房门楣：既有三层材质原样承载 |
| 输出卡 hero（L2 材质） | BasicCalculator.tsx:466-613 | S1 刻度环 + S2 达成脉冲 + S3 度量字排 + S9 计算徽标 + S14 段位徽标 | 读数窗 + 量具刻度：大数字是读数，环是刻度尺，100% 只呼吸一次；计算窗口期卡头明示「算着呢」 |
| 基础参数卡 | BasicCalculator.tsx:616-810 | S5 轻确认 + S10 方向字形 | 输入区的数字同样受账房排印纪律约束 |
| 高级导航（分段 + 标签） | AdvancedPanel.tsx:117-158 | S7 分组左标线（组内小节延续） | 账房的栏线分组 |
| 第九面板（九个模拟/分析面板） | advanced/*.tsx | S4 行级读数 + S6 情景库空态 + S10 | 每一行都是账房里的一笔账，hover 即拾起看 |
| 图表（四处宿主） | BasicCalculator / MonteCarloPanel / RentalPanel / AccumulationPanel | §6 统一质感 + S15 叙事标注 | 刻度尺化的轴与网格，结论一句话 |
| 浮层（下拉 / tooltip） | global.css:236-252 | 无新增（既有材质即账房栏外浮签） | 保持 |
| 空态 | MonteCarloPanel.tsx:676,905；AccumulationPanel.tsx:575；ScenarioPanel.tsx:282-285 | S6 人格化图形 + §5 空态文案口径 | 账房未开张：缺什么 + 下一步 |

---

## §1 现状诊断（令牌缺口 + 组件用法缺口 + 冗长重灾区，行号均为本会话实测）

### 1.1 字阶缺口
- 五个字阶令牌（global.css:38-42,103）与四级定案错位：`--wf-text-xs`（:38）与 `--wf-text-lg`（:41）**零消费**（全仓 grep 仅定义行命中）；`--wf-text-sm`（:39）仅 1 处消费（global.css:179 顶栏标签）；`--wf-text-md`（:40）仅 1 处消费（global.css:465 跳链）；`--wf-text-num`（:42,:103）2 处消费（BasicCalculator.tsx:496、AccumulationPanel.tsx:409）。
- 裸字面量绕过令牌：`grep -nE 'font-size: 1[0-9]px|font-size: [0-9]px' src/styles/global.css` 实测 **7 行**（修订 #3 校正，此前漏 2 处且 1 处行号有误）——global.css:775（.wf-field-hint 12px）、:801（.wf-panel-note 12px）、:916（.wf-sens-legend-row 12px）、:942（.wf-insight-source 12px）、:943（.wf-insight-note 12px）、:1011（.wf-header-brand .arco-typography 14px，<640 档）、:1091（.wf-swipe-hint 12px）。
- **双 hero 违例**：AccumulationPanel.tsx:404-414 反推大数用 `var(--wf-text-num)`，宽屏 40px 与左栏输出卡 hero 竞争焦点，违反「一屏一重点」（research-fintech-ui.md §4）。
- `var(--wf-text-num)` 经 inline style 注入（BasicCalculator.tsx:496、AccumulationPanel.tsx:409），改档无需动组件库。

### 1.2 数字质感缺口（research-fintech-ui.md §0 六条对照）
- tabular-nums 现覆盖仅 5 组类（global.css:722-733 big-number/amortize-table/realtime、:908 sens-rows、:915 sens-legend、:931 insight-row）；**缺口**：图表轴 tick（MonteCarloPanel.tsx:696,701,865,870；AccumulationPanel XAxis/YAxis；RentalPanel.tsx:622-629；BasicCalculator.tsx:206,210）、≥768 的 Descriptions 值列（global.css:1024-1026 仅 <640 生效）、ScenarioPanel 对比表数值列（global.css:1065-1069 只有 nowrap，无右对齐无等宽）。
- 数值列右对齐仅 <640 生效（global.css:1024-1026），桌面 Descriptions/表格无视觉右边缘。

### 1.3 表面与硬编码缺口
- 凹面区（.wf-adv-tabs 内容容器，global.css:419-425）错用页面底令牌 `--wf-bg-page` 当表面——语义混淆，且凹面与页面底无层次差。
- 实底表面无令牌：实底回退块硬编码 `#ffffff`（global.css:263）与 `#232324`（:279）；表格 sticky 首列与渐隐用 `var(--color-bg-2, #fff)`（:1080,:1099）——组件库变量承载本项目表面语义，脱离三源对账。

### 1.4 冗长重灾区（awk `length>=140` 实测 8 条，141–238 字符/行）
| 键 | zh-CN.ts 行 | 长度 | 现渲染处 |
| --- | --- | --- | --- |
| insights.formulaBody | 133-134 | 228 | InsightsPanel 正文 |
| insights.childNote | 162-163 | 151 | InsightsPanel 正文 |
| insights.childVideoNote | 164-165 | 172 | InsightsPanel 正文 |
| insights.healthNote | 167-168 | 147 | InsightsPanel 正文 |
| insights.evidenceNote | 174-175 | 143 | InsightsPanel 正文 |
| tiers.gradingNote | 344-345 | 238 | RentalPanel 城市分级注 |
| mc.strategyNote | 458-459 | 172 | MonteCarloPanel.tsx:844-846 |
| seq.note | 519（seq 节 499 起） | 147 | MonteCarloPanel.tsx:776-778 |
- note 数量超限：MonteCarloPanel `wf-panel-note` **6 处**（571,622,754,776,844,895 实测；前轮研究记 10 处，以本次 grep 为准）→ 上限 2；PensionPanel 4 处（152,226,229,236）→ 上限 2。
- 输出卡明细为插值长句（BasicCalculator.tsx:563-575 与 578-590 两分支重复同一 `t("basic.breakdown")` 段落墙，zh-CN.ts:48-49），应结构化为键值表。
- 反冗长三问判据（research-fintech-ui.md §6）未成文落地：hint 通道自由长度（fields.tsx:38），FieldTip（fields.tsx:167-175）已是标准件但未承接「全文下沉」。

---

## §2 令牌升级表（变量名 + 亮色值 + 深色值 + 迁移映射）

### 2.1 字阶（静态层，两主题同值）——global.css:37-42 与 :101-105 重写

| 新变量 | 亮色值（=深色值） | 旧名（迁移映射） | 消费点迁移清单（grep 实测全量） |
| --- | --- | --- | --- |
| `--wf-text-display` | 32px；`@media (min-width:768px)` 40px | `--wf-text-num` → 改名 | BasicCalculator.tsx:496；AccumulationPanel.tsx:409（改指 `--wf-text-title`，见 §4）；global.css:42,:103 定义行 |
| `--wf-text-title` | 20px | `--wf-text-lg` → 改名并改值 16→20 | 旧值零消费，改名零风险 |
| `--wf-text-body` | 14px | `--wf-text-md` → 改名 | global.css:465（.wf-skip-link）；另收编 14px 字面量 1 处：global.css:1011（.wf-header-brand，<640 档，同值改挂零视觉变更） |
| `--wf-text-caption` | 12px | `--wf-text-xs` → 改名 | 旧名零消费；另收编 6 处 12px 字面量：global.css:775,:801,:916,:942,:943,:1091 |
| ~~`--wf-text-sm`~~ | （废除） | → `--wf-text-body` | global.css:179（.wf-header-label 13→14px，视觉变更登记 §12） |

### 2.2 间距阶（静态层，保持）

| 变量 | 值 | 迁移 |
| --- | --- | --- |
| `--wf-space-1..7` | 4/8/12/16/24/32/48px | **名称与值全部保持**（design-spec 2.3 现状不变；研究 §3.3 缺口 20/40/64/80 低频不补） |

### 2.3 表面阶（主题组，入三源对账）——分层背景变量

| 新变量 | 亮色值 | 深色值 | 旧名（迁移映射） | 消费点迁移清单 |
| --- | --- | --- | --- | --- |
| `--wf-bg-sunken` | `#F7F8FA` | `#17171A` | `--wf-bg-page` → 改名（值不变） | global.css:55,:305 定义；:142 body 回退；:1115,:1124 dock 底；App.tsx:89 注入行（JS 键名 `bgPage` 不动）；THEME.bgPage / THEME_DARK.bgPage 注释补 CSS 名 |
| `--wf-bg-surface` | `#FFFFFF`（新增） | `#232324`（新增） | （无旧名；实底回退与组件库变量承载转正） | 替换硬编码：global.css:263（浅色回退）、:279（深色回退）、:1080 sticky 首列、:1099 渐隐；TYPES + THEME + THEME_DARK + App.tsx 数组五点新增 |
| `--wf-bg-inset` | `#F2F3F5`（新增） | `#1C1C1F`（新增） | （无旧名） | global.css:422（.wf-adv-tabs 内容容器由 `--wf-bg-page` 改挂）；五点新增。正文对 inset 对比度：浅色 #1D2129 对 #F2F3F5 ≈13.4:1、深色 #F2F3F5 对 #1C1C1F ≈14:1（估算值，施工后跑 `npm run check:a11y` 实测） |
| `--wf-bg-tint` | `rgba(74,111,165,0.08)` | `rgba(123,159,209,0.12)` | `--wf-tint-bg` → 改名（值不变） | global.css:56,:306 定义；:788 实时区、:929 insight-row、:780 注释行（修订 #7：§2.7 门禁 grep 不区分注释，注释随改名一并更新）；App.tsx:90 注入行（JS 键名 `tintBg` 不动） |
| 材质四层 `--wf-surface-topbar/card/overlay/tooltip-bg/blur` | 不变 | 不变 | **保持**（三层材质是设计语言既有骨架） | 无 |

### 2.4 阴影阶（主题组，保持）

| 变量 | 亮色值 | 深色值 | 迁移 |
| --- | --- | --- | --- |
| `--wf-shadow-1` | `0 1px 2px rgba(29,33,41,0.06)` | `0 1px 2px rgba(0,0,0,0.40)` | 名称与值保持（global.css:84,:329） |
| `--wf-shadow-2` | `0 2px 6px …0.08, 0 8px 24px …0.08` | `…rgba(0,0,0,0.45)×2` | 保持（:85,:330） |
| `--wf-shadow-3` | `0 4px 12px …0.10, 0 16px 40px …0.12` | `…rgba(0,0,0,0.50), …0.60` | 保持（:86,:331） |

### 2.5 圆角阶（静态层，保持）

| 变量 | 值 | 迁移 |
| --- | --- | --- |
| `--wf-radius-s/m/l/full` | 6/10/14/9999px | 全部保持（global.css:32-35；design-spec 2.4 现状不变；落在体系 C 斜率上） |

### 2.6 动效阶（静态层，保持 + 派生口径）

| 变量 | 值 | 迁移 |
| --- | --- | --- |
| `--wf-dur-fast/base/slow` | 120/240/360ms | 保持（global.css:93-95；与 MOTION_DURATIONS 派生链不动） |
| `--wf-ease-standard/emphasis/asymptotic` | 三族曲线 | 保持（:96-98）；三族曲线不膨胀纪律维持 |
| 循环周期（S9 呼吸） | `calc(var(--wf-dur-slow) * 2)` = 720ms | **不新增时长键**：研究巧思 #9 的 600ms 周期以慢档二倍派生，单一事实来源不变（偏差登记 §12） |
| S2 脉冲 | `--wf-dur-base` + `--wf-ease-emphasis` + `animation-iteration-count: 1` | 复用既有档，零新增 |

### 2.7 孤儿检查（迁移完成后的门禁命令，实施者必须跑）

```bash
grep -rnE 'wf-text-(xs|sm|md|lg|num)|wf-bg-page|wf-tint-bg' src/ --include='*.css' --include='*.tsx' --include='*.ts'
# 预期输出：0 行（本文档 docs/ 不在 src/ 内不计）。非零即存在孤儿，禁止收口。
```
本会话已跑迁移前基线：`grep -rnE 'wf-text-(xs|sm|md|lg|num)|wf-bg-page|wf-tint-bg' src/ --include='*.css' --include='*.tsx' --include='*.ts'` 实测 **23 行 = 消费 12（TSX 4 + CSS 8）+ 定义 10（global.css 浅/深两块）+ 注释 1（global.css:780）**（修订 #7 校正口径）；§2.1/§2.3 清单即 23 行全量，含注释行——门禁 grep 不区分注释，注释必须一并改名。迁移后复查**未执行**（本轮不施工），列为 §8 验收项 #3。

---

## §3 巧思实施清单（12 项；研究 §1 选 11 项 + 叙事标注 1 项）

> 全部动效项的降级双闸：`usePrefersReducedMotion`（src/components/hooks.ts:141-151）短路 JS 动画 + global.css:615-643 兜底块停 CSS 动画。体积列为压缩后原始字节估算（门禁口径），汇总核算见 §10。

- [ ] **T1 = S1 四档里程碑刻度环**（研究 #1；修订 #2：几何出界修正）
  - 落点：`src/components/BasicCalculator.tsx:296-334`（FreedomGauge 内；几何常量 :59-61 `RING_RADIUS = 30`，:303 `viewBox="0 0 72 72"`）
  - 实现：TSX——**viewBox 由 `0 0 72 72` 扩为 `0 0 80 80`**（圆心 36→40）；刻度点 4 个 `<circle r={1.2}>` 落 **r = 38**（显式数值、与 viewBox 联动：38 + 1.2 = 39.2 < 40，出界安全余量 0.8px）；环本体几何不变（r=30、stroke 8，带域 [26,34]，刻度点在带外沿无重叠）。原规范 r = RING_RADIUS + 8 = 38 > 72 盒半径 36，四点全部落在 viewBox 外被裁剪（复核实证）——几何细节以此处为准。width/height 仍取 size（72/56），环在原框内等比缩小 ≈10%（视觉变更登记 §12）。跨档判定 = `Math.floor(pct/25)` 变化，纯展示层派生，无数据流改动
  - 动效参数：跨档单次放大回落 `transform: scale(1→1.5→1)`，`var(--wf-dur-base)` + `--wf-ease-emphasis`，iteration 1（transform-origin 设 `40px 40px` 匹配新圆心）
  - reduced-motion：放大停用，变色保留（CSS 兜底块天然覆盖；TSX 侧不挂动画类）
  - 体积：TSX ≈0.7KB + CSS ≈0.15KB ≈ **0.85KB**
- [ ] **T2 = S2 达成一次脉冲**（研究 #2）
  - 落点：BasicCalculator.tsx:296-334（环线）+ 环心文字
  - 实现：CSS keyframes（scale 1→1.04→1，`--wf-ease-emphasis`，`var(--wf-dur-base)`，`animation-iteration-count: 1` 硬约束）+ TSX **已达成闩锁**（修订 #8：一次性语义机制）——`useRef(false)` 记录「已达成」，`gaugeRatio >= 1 && !闩锁` 时置位并挂类一次；`gaugeRatio < 1 || !gaugeVisible || resetEpoch 递增` 时清闩锁（回落 / 重置后才可再次庆祝）。比率在阈值附近来回（1→0.99→1）不重放
  - reduced-motion：脉冲停用，环心文字涨色保留（信息由颜色 + 既有 aria 播报链路承载）
  - 体积：CSS ≈0.35KB + TSX ≈0.25KB ≈ **0.6KB**
- [ ] **T3 = S3 度量字排**（研究 #3）
  - 落点：global.css（数值宿主统一规则）+ §1.2 三缺口收编
  - 实现：CSS-only——`.wf-num` 语义类（tabular-nums + bold）挂输出卡乘数行；图表轴 tick 经 `.wf-mc-chart/.wf-acc-chart/.wf-sens-chart/.wf-waterfall-chart .recharts-text` 选择器挂 tabular-nums；≥768 Descriptions 值列右对齐 + 等宽（global.css:1024-1026 规则升为全宽度生效）
  - 动效：无（纯静态排印）
  - 体积：CSS ≈0.25KB ≈ **0.25KB**
- [ ] **T4 = S4 行级 hover 读数**（研究 #4）
  - 落点：global.css（.wf-sens-row / .wf-insight-row）
  - 实现：CSS-only——`background: var(--wf-bg-tint)` + 值文字 bold，`transition: background-color var(--wf-dur-fast) var(--wf-ease-standard)`（表面色变化，不用阴影）
  - reduced-motion：无动画（纯状态）
  - 体积：CSS ≈0.2KB ≈ **0.2KB**
- [ ] **T5 = S5 轻确认已复制**（研究 #5）
  - 落点：BasicCalculator.tsx:449-455（handleCopyShare）
  - 实现：TSX——局部 `copied` 状态，`MOTION_DURATIONS.base` 计时后还原；按钮文案切换 + 对勾字形；既有 Message.success 保留为兜底
  - 动效参数：`var(--wf-dur-fast)` 文案换场，无位移
  - reduced-motion：即时换文案无过渡
  - 体积：TSX ≈0.3KB + i18n 1 键 ≈ **0.4KB**
- [ ] **T6 = S6 空态人格化**（研究 #6）
  - 落点（4 处 + 进度环缺席位，修订 #5 扩围）：① BasicCalculator.tsx 进度环缺席位（`gaugeVisible === false && !localInvalid && progressInputs.currentAssets === 0` 时渲染占位）；② ScenarioPanel.tsx:282-285（Empty icon）；③ MonteCarloPanel.tsx:676（seq Empty）与 :905-910（mc Empty，placeholder / placeholderBootstrap 两键）；④ AccumulationPanel.tsx:575（Empty icon）。同一内联 SVG 组件经组件库 Empty `icon?: ReactNode`（.d.ts 实测口径，见研究 §2）注入
  - 实现：TSX（内联 SVG，未上弦刻度尺造型，`currentColor`/主题解析色，禁硬编码浅色）+ i18n 引导句；四处 Empty 经 `icon` 参数注入 + 进度环缺席位渲染分支（修订 #5 扩围后的注入点接线计入口径）
  - 动效：无（静态图形）
  - 体积：SVG ≈0.5KB + TSX ≈0.35KB + i18n ≈0.6KB ≈ **1.45KB**（修订 #5 扩围后注入点由 1 处变 5 处，TSX 0.2→0.35KB；§10 账本同口径）
- [ ] **T7 = S7 分组左标线**（研究 #7）
  - 落点：BasicCalculator.tsx 输出明细区（breakdown 结构化后的小节头）+ AdvancedPanel.tsx 组内标签下小节
  - 实现：组件库 Divider `orientation="left"`（已装，.d.ts 实测口径）承载小节名；CSS 类统一线色 `--wf-hairline-card` / 文字 `--wf-text-caption`
  - 动效：无
  - 体积：TSX ≈0.15KB + CSS ≈0.1KB ≈ **0.25KB**
- [ ] **T9 = S9 输出卡计算徽标**（研究 #9；修订 #4：落点由顶栏改输出卡卡头——顶栏品牌区只存在于 App.tsx:239 `.wf-header-brand`，BasicCalculator 全文 grep `品牌|brand` 零命中，原主方案无锚点不可施工；宪法层 S9 行已同步回填 design-language §2 并记入版本记录）
  - 落点：BasicCalculator.tsx:466-471（输出卡卡头 title/extra 区；Card className 与既有 `isStuck` 三元并列追加 `wf-computing`）
  - 实现：TSX pending 状态位——诚实反馈的真缺口是**防抖静默窗口**（useFinanceCall 的 loading 在防抖计时后才置位，hooks.ts:45-46，窗口期卡头 extra 仍显示「实时更新」文案）：业务输入变更置位 pending、`loading === true` 或结果落定清位；pending 时卡挂 `.wf-computing`，CSS 对卡头 extra 文案呼吸。计算开始由既有 Spin 接管（:470），呼吸与 Spin 不并存
  - 动效参数：`animation: wf-computing-breathe calc(var(--wf-dur-slow) * 2) var(--wf-ease-standard) infinite alternate`（opacity 0.75→1）；清位即移除类停循环
  - reduced-motion：兜底块把 animation-duration 压到 0.01ms；JS 侧 `reducedMotion` 命中直接不挂类
  - R8 影响：extra 区非交互元素，不触碰吸附态穿透豁免清单（global.css:213-233）
  - 体积：CSS ≈0.25KB + TSX ≈0.2KB ≈ **0.45KB**
- [ ] **T10 = S10 方向冗余编码**（研究 #10）
  - 落点：BasicCalculator.tsx:773-792（实时区涨跌行）、:252-270（敏感性数值行）、RentalPanel 净现金流行（grep `formatMoney(` 命中处）
  - 实现：TSX 涨跌值前缀 `▲/▼` 字形（span + `--wf-text-caption` 字号），色盲友好档开关联动由 `resolveThemeTokens` 现有机制天然覆盖
  - 动效：无
  - 体积：TSX ≈0.2KB ≈ **0.2KB**
- [ ] **T11 = S11 深色环线抬升**（研究 #11；修订 #9：提亮色转正为主题令牌 + 体积账计入 TSX）
  - 落点：BasicCalculator.tsx FreedomGauge（新增 1 个 `<circle>` 描边环：r = 34 = 环带外沿，strokeWidth 1，类名 `wf-ring-halo`）+ global.css 深色块（:293-337）+ 三源对账五点
  - 实现：新主题组令牌 **`--wf-ring-halo`**——修订取 THEME 新键而非 color-mix()：后者无实底回退纪律对应且引入新 CSS 特性依赖。ThemeTokens 接口（src/data/types.ts）新增 `ringHalo: string`；THEME 值 `#4A6FA5`（对偶占位，浅色不渲染）、THEME_DARK 值 `#A6C0E4`（#7B9FD1 同族提亮；装饰性描边与网格同族，不设 4.5 口径，施工后双主题目测）；App.tsx 注入数组 + global.css 双块同步。浅色隐藏由 CSS 承载：`.wf-progress-ring .wf-ring-halo { display:none }` / `[data-theme="dark"] .wf-progress-ring .wf-ring-halo { display:block }`（TSX 恒渲染、CSS 控显隐，两主题结构对偶）
  - 动效：无
  - 体积：TSX ≈0.15KB + CSS ≈0.1KB + 注入 ≈0.05KB ≈ **0.3KB**
- [ ] **T14 = S14 乘数段位徽标**（研究 #14）
  - 落点：BasicCalculator.tsx:539-547（乘数行）
  - 实现：TSX——段位判定 `Math.floor(multiplier)` 变化时行尾追加组件库 Tag（已装，纯展示）文案「省下 N 个月的量」；跨档涨色 `var(--wf-dur-base)` 单次
  - reduced-motion：涨色停用，Tag 常驻
  - 体积：TSX ≈0.45KB + i18n ≈0.4KB ≈ **0.85KB**
- [ ] **T15 = S15 目标线叙事标注**（吸收研究候选三环刻度思想的图表面，新编号；修订 #1 P0：目标变量改绑 run 时实际提交值）
  - 落点：AccumulationPanel.tsx（forward 模式 LineChart，:520-528 一带）+ 图下 caption
  - 依据（P0 修正）：模拟实际消费的是 **`effectiveTarget`**（AccumulationPanel.tsx:84-86：`synced && baselinePreview.result?.ok` 时取基础模式临界值，否则取面板输入），`run()` :138-141 提交 `targetValue: effectiveTarget`；store 默认 `accumulationTargetSynced: true`（useCalculatorStore.ts:162）。直接绑 `inputs.targetValue` 时，默认联动路径下改任一基础输入后目标线位置与模拟真值脱钩，且与叙事行（data.yearsMedian 按 effectiveTarget 计算）互相矛盾——违反设计原则 4「状态诚实」与 S15「同源字段」要求
  - 实现：TSX——`run()` 提交帧同步快照 `setSubmittedTarget(effectiveTarget)`（与 calcAccumulation 入参同一值、同一帧）；图表内 `<ReferenceLine y={submittedTarget}>` + label「目标」；**渲染门槛与图表同闸**：`data && chartData.length > 0 && submittedTarget !== null` 同分支，无快照不渲染线与叙事行；叙事行「中位预计第 {{years}} 年达成」复用 `data.yearsMedian`（AccumulationPanel.tsx:481 同源值，同一 submittedTarget 下算出）。纯展示层快照，零数据流改动（wasm 契约不动）
  - 体积：TSX ≈0.35KB（ReferenceLine + 快照 state + 叙事行）+ i18n 2 键 ≈0.25KB ≈ **0.6KB**（二轮补记，原清单漏本项体积；§10 合计 6.4KB 以此闭合）

**不采纳登记**（研究 §1 其余项）：#8 分段切换呼吸（与 T9 呼吸类同屏互斥，砍）；#12 图↔行联动 hover（P5.1 备选，预算让位）；#13 已落地资产（MonteCarloPanel.tsx:802-810 Progress 真实百分比）不重复施工。反采纳八条全盘维持（研究 §4：Statistic/Skeleton/Badge/copyable/图标旋转动画/汇率徽标收纳/撒花/常驻呼吸）。

---

## §4 组件改造清单（逐文件「现状 → 目标」；轮子 = Typography / Tag / Empty / Divider / Descriptions，均已在 main.tsx:23-42 样式引入，边际体积 0）

- [ ] **src/App.tsx**
  - 现状：顶栏品牌图标静态（:239-244）；注入数组 34 键（:80-115）
  - 目标：挂 S9 呼吸类切换；注入数组追加 `--wf-bg-surface` / `--wf-bg-inset` 两键并更名 bg-page/tint 两行（§2.3）；其余零改动
- [ ] **src/components/BasicCalculator.tsx**
  - 现状：hero inline fontSize（:496）；明细两分支重复插值长句（:550-591）；乘数行纯文本（:539-547）；进度环无刻度（:296-334）；分享按钮 Message 反馈（:449-455）
  - 目标：明细改组件库 **Descriptions** `column={{ xs: 1, md: 2 }}` 两列键值表（label=构成项名，value=金额，i18n 键拆分见 §11）——研究 §2 认定的「输出卡明细长句 → 结构化 2 列」真升级；**合并的只是表格定义（单份 data 数组），分支行为原样保留（修订 #6）**：<768 仍走既有 toggle（BasicCalculator.tsx:551-576，默认收起 + aria-expanded 切换按钮）+ 条件渲染，≥768 常驻；外层 `.wf-output-breakdown` 类名不变（吸附态 D9 隐藏规则 global.css:1139-1145 依赖它）。hero 保持 display 档唯一占用；T1/T2/T5/T7/T9/T10/T14 全部落点
- [ ] **src/components/AdvancedPanel.tsx**
  - 现状：分段 + 组内标签 + 方向键漫游 + 常驻保活（:47-158）——方案 B 结构**原样保留**
  - 目标：仅 T7 组内小节标线（面板内部自改，本文件本身最多加一个 CSS 类名）；导航逻辑零触碰
- [ ] **src/components/fields.tsx**
  - 现状：FieldTip 标准件（:167-175）；hint 自由长度（:38）
  - 目标：hint 双通道——调用方超 60 字符的说明移入既有 `tooltip` 通道；FieldTip 组件本体零改动（不另造机制，research-fintech-ui.md §6）
- [ ] **src/components/advanced/MonteCarloPanel.tsx**
  - 现状：6 处 wf-panel-note（571,622,754,776,844,895）；图表网格双向虚线（:691）；轴默认 tick/axis 线（:693-703）
  - 目标：note 收敛到 2（结果摘要 1 + 口径 1：留 :776 或 :754 择一 + :844 短句化，其余删或并入 Descriptions label）；§6 统一图表参数；两处 Empty（:676、:905-910）挂 T6 同族图形（修订 #5）
- [ ] **src/components/advanced/PensionPanel.tsx**
  - 现状：来源行整段（:152-154）+ 3 注（:226,:229,:236）；结果 Descriptions（:165-218）
  - 目标：来源改「一句话出处 + FieldTip 全文」（L4 口径）；coverageHint+resultNote 合并 1 行（:226-231）；disclaimer 压 ≤1 行（:236-238，合规文案保留不删）；Descriptions 值列右对齐等宽（§6/T3 全局规则自动生效）
- [ ] **src/components/advanced/RentalPanel.tsx**
  - 现状：分级注整段（tiers.gradingNote，zh-CN.ts:344-345）；瀑布图网格已 vertical=false 但虚线（:621）；连接线 Customized（:654）保留
  - 目标：注改一句话 + FieldTip 全文；§6 参数统一；净现金流行加 ▲▼（T10）
- [ ] **src/components/advanced/AccumulationPanel.tsx**
  - 现状：反推大数用 display 档（:404-414）；图表（:520-528）双向虚线网格
  - 目标：反推大数改 `--wf-text-title`（20px bold，视觉降档登记 §12）；T15 叙事标注；§6 参数统一；空态 Empty 挂 T6 同族图形（:575，修订 #5 扩围）
- [ ] **src/components/advanced/InsightsPanel.tsx**
  - 现状：5 条长串正文（zh-CN.ts:133-175）平铺
  - 目标：每条改「小节标题（T7 左标线）+ 一句话副行 + info 图标」，全文下沉 FieldTip（复用既有键，见 §11）；数据行挂 T4 hover
- [ ] **src/components/advanced/LoanPanel.tsx / TaxPanel.tsx**
  - 现状：Descriptions 键值表已结构化；TaxPanel 已用 Divider（:217）
  - 目标：仅吃全局规则（值列右对齐等宽、caption 令牌化）；TaxPanel 分节线挂 T7 同族类；零结构改动
- [ ] **src/components/advanced/ScenarioPanel.tsx**
  - 现状：空态 Empty（:282-285）文案 `scenario.listEmpty`；对比表（:293-299）
  - 目标：空态文案改「缺什么——下一步」句式（键改写非新增）；T6 同族图形经 icon 参数；对比表数值列右对齐等宽（§6/§1.2 缺口收编）
- [ ] **src/components/advanced/CurrencySection.tsx**
  - 现状：汇率 Descriptions + 离线 Tag（既有）
  - 目标：仅吃全局规则；零结构改动
- [ ] **轮子边界**：Typography 继续全站骨干；Tag 承载 T14；Empty 承载 T6；Divider 承载 T7；Descriptions 承载明细结构化。**Statistic / Skeleton / Badge 不引入**（研究 §2 体积实证：边际 +9.5KB/+1.7KB/+3.3KB 原始 JS，反采纳 §4 维持）。

---

## §5 冗长治理清单（逐面板；目标：解释性文字 ≤2 行、无文字墙；被压缩的新文案全部走 i18n 三语键）

判据（research-fintech-ui.md §6 三问）：必需→内联一行；口径/假设→FieldTip；出处/推演→一句话内联 + 全文 FieldTip。

- [ ] **输出卡（BasicCalculator）**：删插值长句 `basic.breakdown`（zh-CN.ts:48-49）→ Descriptions 6 键值行（§4）；文案键拆分三语同步（§11）
- [ ] **InsightsPanel（重灾区）**：5 条长串（zh-CN.ts:133-175 实测 143–228 字符）逐条压为「标题 + ≤1 行副行」；childVideoNote（164-165）为勘误性质 → 内联零文字、全文仅存 tooltip；其余 4 条全文键保留作 tooltip 内容（字节近似守恒，见 §10 补偿账）
- [ ] **MonteCarloPanel**：6 note → 2（:776 seq.note 与 :844 strategyNote 二选一保留短句 + 一条结果摘要；:754 窗口数并入三联数行 Descriptions label 已有信息；:571/:622/:895 删或并入）。mc.strategyNote（172 字符，zh-CN.ts:459 实测）压 ≤1 行 + 全文进 FieldTip
- [ ] **PensionPanel**：来源行（:152-154）→「一句话出处（≤20 字）+ FieldTip 全文」；coverageHint+resultNote（:226-231）合并 1 行；disclaimer（:236-238）保留但 ≤1 行
- [ ] **RentalPanel**：tiers.gradingNote（zh-CN.ts:344-345）→ 一句话（「城市按一线~四线与国际口径分档，可手动微调」量级）+ FieldTip 全文
- [ ] **ScenarioPanel**：空态 `scenario.listEmpty` 改写为 `[缺的状态]——[下一步]` 一句式（禁排比、禁责备式、形容词 ≤1，research-fintech-ui.md §5）
- [ ] **空态句式统一（修订 #5 扩围）**：`seq.placeholder`（MonteCarloPanel.tsx:676）、`mc.placeholder` / `mc.placeholderBootstrap`（:905-910）、`accumulation.placeholder`（AccumulationPanel.tsx:575）同口径改写为「缺什么——下一步」句式——改值不增键（§11）；四处空态与进度环缺席位同挂 T6 图形
- [ ] **fields.tsx 通道纪律**：新增/改写 hint ≤60 字符，超出移 tooltip（现有 hint 逐条复核，仅改写超限者）
- [ ] **量化验收口径**：① 每面板正文连续说明段 ≤2 行；② zh-CN ≥140 字符的界面串从 8 条降到 0（`awk 'length>=140'` 复扫，数据层来源注释不入 i18n 不计）；③ 每面板 note ≤2；④ 三语同步以 zh-CN 为源（zh-Hant 文件头声明由 gen-zhtw.mjs 生成，但 **scripts/ 全目录与仓库根 find 实测无此脚本**——本轮手工三语同步并登记 §12，脚本补建列为 P5.1 建议）
- [ ] **en 容差**：压缩按信息密度判定，en 允许 +30% 字符（research-fintech-ui.md §6）

---

## §6 图表质感（recharts 统一改造 + 叙事标注）

宿主实测 4 处：BasicCalculator.tsx（龙卷风）、MonteCarloPanel.tsx:689-729,858-894、RentalPanel.tsx:616-655（瀑布）、AccumulationPanel.tsx:520-528。全仓无 `<Legend>`、无 recharts `<Tooltip>`（grep 实证 0）——直接标注靠既有 Descriptions 数据表替代口径，**维持**。

- [ ] **网格**：`CartesianGrid` 统一 `stroke={tokens.chartGrid}`（1px 实线，去 `strokeDasharray="3 3"`）+ 水平图 `vertical={false}`（MonteCarloPanel.tsx:691,860、AccumulationPanel.tsx:522 三处补 vertical={false}；RentalPanel.tsx:621 去虚线；BasicCalculator.tsx:201 横向条形图保持 `horizontal={false}`）
- [ ] **轴**：全部 XAxis/YAxis 补 `tickLine={false} axisLine={false}`——**10 处**（修订 #10 校正：`grep -c '<XAxis\|<YAxis'` 实测 BasicCalculator 2 + MonteCarloPanel 4 + RentalPanel 2 + AccumulationPanel 2）；tick 12px + chartTick 令牌现状保持
- [ ] **刻度等宽**：global.css 追加 `.wf-mc-chart .recharts-text, .wf-acc-chart .recharts-text, .wf-sens-chart .recharts-text, .wf-waterfall-chart .recharts-text { font-variant-numeric: tabular-nums; }`（SVG text 支持该特性；不支持的字体无害）
- [ ] **语义色**：涨/跌语义只落在差额与曲线差段（现状已合规：龙卷风 Cell BasicCalculator.tsx:229、瀑布 Cell RentalPanel.tsx:640-652 均走 tokens.rise/fall）；中性线 median = 主色；同一图语义色只表达一个维度——保持，零改动
- [ ] **叙事标注**：T15（§3）——目标线 label「目标」+ 图下「中位预计第 N 年达成」叙事行；标注只准引用已算出的结果字段（yearsMedian / targetValue），发现需新计算字段即停止并登记
- [ ] **tooltip 材质**：现状无图内 tooltip；后续若引入，底色必须复用 `.arco-tooltip-content` 材质（global.css:246-252），禁自绘

---

## §7 深浅主题对照表（每个新令牌两套值；深色「越高越亮」）

| 令牌 | 亮色 | 深色 | 层级关系（深色自检） |
| --- | --- | --- | --- |
| `--wf-bg-sunken` | #F7F8FA | #17171A | 最暗底（画布） |
| `--wf-bg-inset` | #F2F3F5 | #1C1C1F | 比卡底暗、比画布亮（凹面） |
| `--wf-bg-surface` | #FFFFFF | #232324 | 平面卡底 |
| `--wf-bg-tint` | rgba(74,111,165,0.08) | rgba(123,159,209,0.12) | 着色底（叠于卡底上） |
| `--wf-surface-card-bg`（材质） | rgba(255,255,255,0.72) | rgba(35,35,36,0.92) | 半透明卡（不变） |
| `--wf-surface-overlay-bg`（材质） | rgba(255,255,255,0.86) | rgba(35,35,36,0.95) | 最亮浮层（不变） |
| `--wf-text-display/title/body/caption` | 两主题同值 | 同左 | 静态层不入对账 |
| 深色环线内描边（T11） | 无此规则 | 环线色 +1px 提亮描边 | 表面明度差口径（体系 C 深色章节） |
| S1/S2/S14 状态色 | tokens.primary/rise/fall | 提亮变体（既有 resolveThemeTokens 自动） | 色盲友好档同样自动 |

对账自检：新增 `--wf-bg-surface` / `--wf-bg-inset` 完成后，`grep -c` 三源（global.css 浅块/深块、defaults.ts THEME/THEME_DARK、App.tsx 数组）各命中 2/2/2；深色块键集与 THEME_DARK 逐键一致（既有验收纪律延续）。

---

## §8 视觉验收 checklist（22 条，全过才收口；#22 为二轮新增）

- [ ] 1. 字阶四级全站生效：`grep -rnE 'font-size: 1[0-9]px|font-size: [0-9]px' src/styles/global.css` 命中 0（全部改挂令牌）
- [ ] 2. `--wf-text-display` 40px 全站唯一：仅输出卡 hero（BasicCalculator.tsx:496）；AccumulationPanel 反推数为 20px title 档
- [ ] 3. 孤儿检查（§2.7 命令）输出 0 行
- [ ] 4. 表面层级深色成立：深色下 sunken < inset < surface < overlay 逐级提亮（目测 + 代码值核对）
- [ ] 5. 凹面区（.wf-adv-tabs 内容）挂 `--wf-bg-inset` 且与页面底有可感知层次差（双主题目测）
- [ ] 6. S1 刻度环四档可见（双主题）；跨档变色 + 单次放大实测一次
- [ ] 7. S2 达成脉冲仅出现一次且不循环（`animation-iteration-count: 1` 样式层核对；闩锁语义：比率 1→0.99→1 来回不重放，回落清位后可再次触发——修订 #8）
- [ ] 8. S3 数值行滚动无抖动（快速键入观察乘数行/主数行；轴刻度同为等宽）
- [ ] 9. S4 hover 半档着色无阴影（敏感性行 + 公式原理行）
- [ ] 10. S5 复制轻确认还原（1s 后按钮文案复原；Message 兜底仍在）
- [ ] 11. S6 空态四处同族图形（进度环缺席位 / 情景库 / 蒙特卡洛与序列 / 打工模拟）主题色渲染，切深色不残留浅色硬编码；文案均为「缺什么——下一步」一句式（修订 #5）
- [ ] 12. S9 呼吸只在计算窗口期出现、落定即停（同屏无第二个循环动效）
- [ ] 13. S10 ▲▼ 与语义色并存；开色盲友好档后字形仍在（形状通道独立）
- [ ] 14. S11 深色环线可感知（浅色无此描边）
- [ ] 15. S14 段位 Tag 跨档出现；reduced-motion 下无涨色但 Tag 常驻
- [ ] 16. S15 目标线与叙事行同源：ReferenceLine y = run 时提交的 submittedTarget 快照——联动默认态下改基础输入不重跑时，线与图保持同一真值不漂移，重跑后同步；叙事行数值与 Descriptions yearsMedian 一致（修订 #1 P0）
- [ ] 17. 微动效克制：任一时刻同屏 ≤2 个动效；透明度全走标准曲线、强调曲线只用于位移/缩放（代码核对）
- [ ] 18. reduced-motion 生效：系统开启后 S1 放大/S2 脉冲/S9 呼吸全停，信息路径（变色/Tag/Spin）保留（CSS 兜底块 + JS hook 双闸各测一次）
- [ ] 19. 无文字墙：zh-CN ≥140 字符界面串 0 条（awk 复扫）；每面板 note ≤2；正文连续说明 ≤2 行
- [ ] 20. 深浅对照三秒印象：双主题各截图自查——三秒内读出「我的临界值是多少、离 100% 多远」；一屏一重点（左栏唯一 hero）
- [ ] 21. 门禁：`npm run build && node scripts/check-size.mjs` 通过——**门禁数值不放宽**（既定纪律，§13 回收先行；本会话实测基线 exit 0、DIST_TOTAL_KB=1963、合计 2,009,957 B / 工作树限 2,010,000 B 余 43 B）
- [ ] 22. 尺寸回收落地（§13 案 A）：purge 后 `node scripts/check-size.mjs` 复跑通过且回收量 ≥25KB；删类选择器在渲染 DOM 中零出现（DevTools 检索 `.arco-*-rtl` / `.arco-tag-checkable` / `.arco-textarea` / `.arco-pagination` 全站无命中）；三档断点（375/768/1024）双主题冒烟无样式回归，`npm run check:a11y` 通过

---

## §9 回归保护清单（不得破坏；每条含验证锚点）

- [ ] R1 方案 B 导航保活：跨组切换不卸载面板（AdvancedPanel.tsx:127-156 常驻 + hidden 机制），蒙特卡洛运行结果与表单输入保留——切组往返实测
- [ ] R2 方向键漫游：←/→ 循环切换并移动焦点（AdvancedPanel.tsx:90-115），roving tabindex 行为不变
- [ ] R3 分享回落 resetEpoch：损坏/版本不符 hash 回落默认 + 一次提示（App.tsx:49-71）；基础字段 key 重挂载机制（BasicCalculator.tsx:349-351,668）不被 T5/T14 改动波及
- [ ] R4 币种换算：convertRate 链路（fields.tsx:73-117 换算模式 + 越界按 CNY 域判定）、图表同源换算（BasicCalculator.tsx:363-364 convert）、rate null 符号-only 回退——T10 前缀字形不改数值路径
- [ ] R5 预设取消：再次点击已激活画像回落默认 + Message（BasicCalculator.tsx:627-636）；「自定义」Tag 语义不变
- [ ] R6 PWA：vite-plugin-pwa 产物与预缓存不变（本会话构建实测 sw.js 生成、precache 12 entries）；本轮禁触 vite.config / sw.ts / manifest
- [ ] R7 色盲友好收纳：D2 视觉隐藏（global.css:973-978）+ 双形态 Select（:985-992）+ resolveThemeTokens 涨跌替换（defaults.ts:356-359）三机制零触碰
- [ ] R8 吸附与穿透：sticky 偏移派生（global.css:162-195）、吸附态 pointer-events 穿透链（:213-233）、D8 dock（:1107-1136）、D9 紧凑模式（:1139-1145）——输出卡改造（T7/T14/T5）不得新增卡内可交互元素破坏穿透豁免清单，若新增须同步补 `.wf-is-stuck` 豁免规则
- [ ] R9 reduced-motion 双闸：hooks.ts:141-151 与 global.css:615-643 不删不改；新增动画类全部登记进逐选择器清单（:626-643 文档性冗余惯例）
- [ ] R10 三源对账：THEME/THEME_DARK/global.css/App.tsx 四处键值一致（defaults.ts:224-319 注释口径）；`npm run check:a11y` 与 `npm run check:currency` 复跑通过（脚本在册 package.json:12-13）
- [ ] R11 组件库样式按需引入纪律：本轮只用已装组件，main.tsx:23-42 零新增 import 行
- [ ] R12 D9 明细折叠回归（对应评审 R6）：<768 明细默认收起 + aria-expanded 切换按钮行为不变（BasicCalculator.tsx:548-576）；表格定义合并后窄屏不得变常驻表；吸附态 `.wf-is-stuck .wf-output-breakdown` 隐藏仍生效（global.css:1139-1145）——375 档实测
- [ ] R13 aria 结构回归（对应评审 R6，二轮补齐）：① 视觉隐藏播报节点 `.wf-sr-only[aria-live="polite"][aria-atomic="true"]`（BasicCalculator.tsx:476）在 T7 明细结构化 / T9 卡头改造后仍常驻 DOM、内容替换式更新，播报链路零变化；② 图表 role/aria-label 回归不受 T3/T15 影响：六处 role="img" + aria-label 逐一核对（BasicCalculator.tsx:197 敏感性图与 :304-305 进度环、MonteCarloPanel.tsx:683-684 序列图与 :850-851 蒙特卡洛图、RentalPanel.tsx:614 瀑布图、AccumulationPanel.tsx:513-514 折线图，grep 实测口径）——ReferenceLine 插入不得移除宿主容器 aria 属性，T15 目标线 label 自带可读文案

---

## §10 尺寸预算估算（压缩后原始字节；门禁 = dist 原始字节总和）

**先修正前提（必须读）**：ask 所述「现余量约 47KB」与本会话实测不符。实测链：`npm run build && node scripts/check-size.mjs`（本会话运行，exit 0）→ 14 文件合计 **2,009,957 字节**，工作区门禁 `TOTAL_LIMIT_BYTES = 2_010_000`（scripts/check-size.mjs:29）→ **真实余量 43 字节**。研究文档「DIST_TOTAL_KB=1963 / 限 2010 → 余量 47KB」是把字节限额误读为 KiB（2,010,000 B ≈ 1,962.9 KiB，非 2,010 KiB）。另：2,010,000 特批行为**未提交**工作区改动（git diff 实证，HEAD 仍为 2,000,000——按 HEAD 门禁当前已超 9,957 字节）。

**增量账本（§3 各项估算合计）**

| 侧 | 项 | 估算 |
| --- | --- | --- |
| 增 | T1+T2+T3+T4+T5+T6+T7+T9+T10+T11+T14+T15 项小计 | ≈ +6.4KB（明细见 §3 各行；修订 #5/#9 后 T6 1.3→1.45KB、T11 0.15→0.3KB） |
| 增 | §2 令牌改名/新增（CSS 定义 + App.tsx 注入 `--wf-bg-surface` / `--wf-bg-inset` / `--wf-ring-halo` 三键） | ≈ +0.2KB |
| 增 | §6 图表参数（tickLine/axisLine/vertical 属性 ×10 处） | ≈ +0.2KB |
| 减 | §5 冗长治理净删（MonteCarlo note 收敛 + Pension 合并 + Insights 勘误条内联清零；全文下沉 tooltip 的键字节守恒不计减） | ≈ −1.6KB |
| 减 | 输出卡明细重复 JSX 合并为单份表格定义（编译产物；分支行为保留，修订 #6） | ≈ −0.25KB |
| **净** | **合计** | **≈ +4.95KB** |

**裁定（二轮修订：撤回放宽门禁诉求，改走「回收先行」——既定纪律：门禁数值不放宽，新增巧思前必须先回收尺寸）**：
1. **案 A（裁定执行）**：先落地 §13 尺寸回收计划——对 index.css 319,788B 做保守 denylist purge，首期四类死规则实测 86,217B（保底下限 79,567B），回收后 dist 合计 ≤1,930,390B、余量 ≥79.5KB，完整覆盖 §10 净增 ≈+4.95KB，巧思 12 项全保、不降档；回收后合计预计 ≤1,935KB < 2,000,000（HEAD 门禁）——顺带兑现 scripts/check-size.mjs:25-28 注释既定回滚条件（「vendor 瘦身落地后回调 2,000,000」），门禁从头到尾不动。
2. **案 B（成文备挡，本轮不触发）**：仅当 purge 实测回收 <25KB（上述 grep 证据不成立的极端情形）才触发：§3 降档为 CSS-only 子集（保留 T3/T4/T7，其余缓行），并按 design-language.md §5.1 准入流程回写宪法层 §2 签名元素状态（缓行元素标注「缓行（P5 尺寸回收不足）」）+ 版本记录追加。两案必居其一，本轮裁定 = 案 A，触发条件与降档清单成文于 §13，不许含糊。
3. **超线先砍采纳项**的原则在案 A 失败时自动接管：砍单顺序 T6 → T15 → T14 → T2 → T5（每砍一项在本节回写实测值）——但在案 A 证据成立的前提下不启用。实施顺序相应改为：**purge（§13）→ 令牌升级 → 巧思 → 冗长治理 → 验收收口**（附：施工顺序同步）。

---

## §11 i18n 键增量预估（zh-CN / zh-Hant / en 三语同步；zh-CN 为基准键表）

| 类别 | 键 | 数量 |
| --- | --- | --- |
| 巧思文案 | T5 复制确认 1；T14 段位 Tag 2（文案 + aria）；T15 叙事行 + 目标 label 2；T6 引导句 1（空态图形） | 6 |
| 压缩新文案 | Descriptions 明细拆分 +6 −旧键 1（basic.breakdown）；Insights 副行短句 +3（formula / child / health，全文键复用既有）；**evidence 小节 +2（evidenceTitle + evidenceShort——InsightsPanel.tsx:105 实测 evidenceNote 独立渲染、无既有标题键，修订 #10 补漏）**；mc.strategyNote 短句 +1；seq.note 短句 +1；pension 合并行 +1 −2；rental 分级短句 +1 | 净 +12（新增 15、删 3；二轮校算：原记 +13 与分项和不符，修订 #10 二次校正） |
| 空态文案 | scenario.listEmpty / seq.placeholder / mc.placeholder / mc.placeholderBootstrap / accumulation.placeholder 五键改写句式（改值不增键，修订 #5） | 0 |
| **合计** | **新增 ≈21，删除 ≈3，净增 ≈18 键 × 三语**（巧思 6 + 压缩新增 15 = 21、删 basic.breakdown + pension 2 = 3；初版与一轮修订的 22/3/19 均与分项和差 1，二轮校算闭合） | |
- 占位符纪律：{{xxx}} 三语一致；禁模板串拼键（既有静态映射惯例，BasicCalculator.tsx:42-57 同款）。
- 数据层来源注释不入 i18n 的既有纪律维持（zh-CN.ts:7-9 文件头口径）。
- zh-Hant 同步：文件头声明依赖 gen-zhtw.mjs，**该脚本在仓库不存在**（find 实证）——本轮手工同步并在 §12 登记；脚本补建为 P5.1 建议。
- 键集一致性自检命令（实施者收口前跑）：`grep -cE '^\s*[A-Za-z0-9_]+:' src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts` 两值相等（本会话基线均 525）；zh-Hant 用 `grep -cE '^\s*"[A-Za-z0-9_]+":'`（基线 525，双引号键风格）。

---

## §12 偏差登记（与本 ask / 既有文档不一致处，全量如实列出）

1. **尺寸前提修正**：ask「现余量约 47KB」→ 实测 43 字节（§10，含命令与误读溯源）。
2. **门禁特批诉求撤回（二轮修订）**：一轮修订曾列「首选 2,010,000→2,016,000」需裁定项；二轮按既定纪律（门禁数值不放宽、新增巧思前先回收尺寸）撤回该诉求，改走 §13 案 A 回收先行——门禁自始至终保持工作树 2,010,000 / HEAD 2,000,000 不动，回收后自然回调 2,000,000（兑现 scripts/check-size.mjs:25-28 既定回滚条件）。
3. **S9 呼吸周期**：研究巧思 #9 定 600ms，与「时长三档」纪律冲突——取 `calc(var(--wf-dur-slow)*2)`=720ms 派生口径（§2.6）。
4. **AccumulationPanel 大数降档**：32/40px → 20px title 档（§1.1 双 hero 违例的修正，视觉变更显式登记）。
5. **顶栏标签 13→14px**：--wf-text-sm 废除的连带视觉变更（§2.1）。
6. **MonteCarloPanel note 数**：前轮研究记 10 处，本会话 grep 实测 6 处（§1.4），以实测为准。
7. **gen-zhtw.mjs 缺失**：zh-Hant 文件头声明的生成脚本不在仓库（§11），本轮手工三语同步。
8. **S9 落点变更**：顶栏→输出卡卡头（原主方案锚点不可施工，修订 #4；design-language §2 已按 §5.1 流程同步回填）。
9. **孤儿检查为基线口径**：§2.7 的 grep 在本会话跑的是迁移前基线；迁移后 0 行判定须由实施者收口时执行（本轮不施工）。
10. **修订轮**：独立复核 REJECT 的 10 条 finding（R1–R10）全部吸收，逐条改动位置与验证证据见文末「修订对照」。
11. **SIZE_FACT 勘误与回收裁定（二轮新增）**：尺寸事实所述「index.css = 组件库全量样式表、主路径为按需化」与本仓现状不符——main.tsx:27-49 实测组件库样式**已是按需引入**（20 组件逐一 `style/css.js`，全量 arco.css ≈581KB 从未进包），319,788B 是按需产物；真实最大回收杠杆是**对按需产物做保守 denylist purge**（§13 实测 ≥79.5KB）。§10 一轮裁定（放宽门禁）随之废止。

---

## §13 尺寸回收计划（二轮新增；先回收后巧思，门禁数值不放宽）

**前提勘误（必须读）**：ask 尺寸事实称 index.css 319,788B 为「组件库全量样式表（最大回收杠杆）」，与本仓现状不符——`src/main.tsx:27-49` 实测组件库样式**早已按需引入**：20 个组件逐一 `import ".../es/<组件>/style/css.js"`（Alert/Button/Card/Collapse/ConfigProvider/Descriptions/Divider/Grid/InputNumber/Layout/Message/Progress/Radio/Select/Spin/Switch/Table/Tag/Tooltip/Typography），其内注释明载「全量 dist/css/arco.css 约 581KB，按需引入使 dist 总量降至尺寸门禁限额内」。因此「样式表按需化」不可重复执行，真实杠杆是**对按需产物做保守 denylist purge（规则级删除）**。本节以二轮实测数据定案，替代 ask 的 SIZE_FACT 表述（偏差登记 §12.11）。

**实测底数（本会话实跑，命令与输出见文末修订对照「二轮补记」#4）**：`npm run build`（exit 0）→ `node scripts/check-size.mjs`（exit 0）：dist 14 文件合计 **2,009,957 B**，工作树限 2,010,000（scripts/check-size.mjs:29，P4 特批未提交），HEAD 限 2,000,000（`git show HEAD:scripts/check-size.mjs` :25 实测）→ **真实余量 43 B**；index.css 319,788 B 为第三大件（vendor_arco 592,213 / wasm 372,534 / vendor_charts 367,726 之后）。

**规则级扫描（按 `}` 块切分 dist CSS，统计选择器命中规则的字节和）**：

| 删类（denylist） | 规则数 | 字节 | 死代码证据（grep 实测） |
| --- | --- | --- | --- |
| `.arco-*-rtl`（全部 RTL 变体） | 800 | **62,351** | `grep -rn 'rtl' src/` 零业务命中（仅 i18n 值与注释内无 rtl）；`grep -n 'dir=' dist/index.html src/index.html` 零命中；ConfigProvider 只传 locale（main.tsx:58-62），无 direction prop；global.css 引用的 28 个 `.arco-*` 选择器清单无一含 `-rtl` |
| `.arco-tag-checkable` / `.arco-tag-checked` | 97 | **13,667** | `grep -rn 'checkable' src/` 零命中——Tag 仅作静态标签（§4 边界），checkable 变体从未渲染 |
| `.arco-textarea` | 28 | **3,549** | `grep -rn 'Textarea\|textArea' src/` 零命中；Input 组件在用但 TextArea 变体不用 |
| `.arco-pagination` | 57 | **6,650** | Table 三处用法实测：LoanPanel.tsx:158 `pagination={false}`、ScenarioPanel.tsx:293 无 pagination prop → 组件库内部分页器不渲染（样式级联引入但 DOM 恒缺位）；以运行时 DevTools 复核为放行闸 |
| **首期四类合计** | 982 | **86,217** | 保底下限 = 前三类 **79,567**（pagination 以运行时验证为闸） |
| （不入首期）`.arco-*{-size-(mini|small|middle|large)}` 变体 | 185 | 20,918 | 部分组件可能传 size prop，逐个 grep 前不删——保守优先 |
| （不动）`.arco-col`（栅格 79,931B）、`.arco-icon`（9,214B）、CSS 变量调色板块（15,378B）、keyframes（340B） | — | — | 业务在用 / 库基座，保留 |

**保留范围三要素（与 ask 保守 purge 口径一致）**：① global.css 引用的组件库选择器全保留（grep -oE '\.arco-[a-z0-9-]+' src/styles/global.css 实测 28 个：.arco-btn/.arco-card-header/.arco-col/.arco-collapse*/.arco-descriptions-item-*/.arco-empty-description/.arco-input-inner-wrapper/.arco-input-number/.arco-radio-mask/.arco-select*/.arco-switch/.arco-table-content-*/.arco-tabs-content/.arco-tag*/.arco-tooltip-content/.arco-typography 等——无一落在删类）；② 已用组件类及其内部依赖全保留（20 个已引入组件 + 级联 Trigger/Empty/Checkbox/Space/InputTag/Pagination 等——Pagination 样式仅以「分页器不渲染」实证为放行闸，证据不成立即回补）；③ 库基座（normalize / CSS 变量 / 图标 / 动画基类）不动。

**实施载体与流水线（零新依赖，不违反铁律）**：purge 以 **vite 插件**实现（新增 `scripts/plugins/purgeArcoCss.ts`，在 vite-plugin-pwa **之前**注册，于 `generateBundle` 阶段改写 CSS bundle 内容）——不用构建后脚本直改 dist：vite-plugin-pwa 的 precache manifest 与文件内容 hash 必须同源于 purge 后内容，否则 sw.js 预缓存指向失配（§9 R6 PWA 回归红线）。实现口径：块级解析（非行级正则整文件替换），一条规则仅当其**全部**选择器命中 denylist 类才整条删除；@media 内规则同口径；denylist 清单成文于脚本头部注释（本表为准）。构建链不变：`npm run build && node scripts/check-size.mjs`（check-size 本就在 build 之后跑，量的是 purge 后真实产物）。

**回收账（压缩后字节近似 1:1 减少，minified CSS 删规则即减字节）**：
- 保底（前三类）：2,009,957 − 79,567 = **1,930,390 B**（较 HEAD 门禁余 69,610B；较工作树特批余 79,610B）；
- 全四类：2,009,957 − 86,217 = **1,923,740 B**；
- 再计 §10 净增 ≈+4.95KB：约 1,928,690 B，仍 < 2,000,000 —— **巧思 12 项全保，无需降档**；
- 兑现 scripts/check-size.mjs:25-28 既定回滚条件（「vendor 瘦身落地后回调 2,000,000」）：回收落地后即可提交门禁回调行，P4 特批归档。

**风险点与验证方式**：① 误删运行时类——验证 = `npm run check:a11y`（对比度门禁）+ §8 #22（DevTools 检索删类零命中 + 三档断点双主题冒烟）+ §9 全回归（重点 R6 PWA / R12 D9）；② 组件库升级引入新变体类——denylist 清单随 main.tsx 组件引入清单同步复核（收口 grep 固化为脚本内注释）；③ 未来启用 RTL / checkable Tag / 分页 / TextArea——须先从 denylist 摘除再施工（写入脚本头注释）；④ lightningcss 压缩形态下的解析稳健性——以块级 `}` 切分 + 删除前 dry-run 输出删类清单供人工复核（脚本留 `--dry-run` 模式）。

**辅案：global.css 死样式清理（量级 <1KB，列辅助不进承诺）**：`--wf-text-xs`（:38）与 `--wf-text-lg`（:41）零消费——§2.1 改名即除；:178/:463 两处 `color: #ffffff` 硬编码随表面令牌化顺带清理；`grep -nE 'font-size: 1[0-9]px|font-size: [0-9]px'` 七行字面量收编后归零（§8 #1）。此项不承担 ≥25KB 指标。

**两案裁定（必居其一，成文于 §10）**：**案 A = 本节 purge 回收（裁定执行）**，证据充分（保底 79,567B ≥ 目标 25KB 的 3.18 倍）；**案 B = 巧思降档为 CSS-only 子集（保留 T3/T4/T7，S1/S2/S5/S6/S9/S10/S11/S14/S15 缓行并按 design-language.md §5.1 回写宪法层 §2 签名元素状态）**——仅当 purge 实测回收 <25KB 时触发。本轮裁定案 A，案 B 触发条件与降档清单已成文，不含糊。

---

## §14 实施结果（收口核验；本节数据为收口会话实跑，非转抄实施记录）

**改动文件数**：工作树相对 HEAD 共 **25 个代码文件** = 修改 21（`git diff --stat` 实测 +1008/−298：src/components 下 11 个（BasicCalculator + 9 个 advanced 面板 + hooks.ts）、src/i18n/locales 3 份、src/data/defaults.ts 与 types.ts、src/styles/global.css、src/main.tsx、src/App.tsx、vite.config.ts、scripts/check-size.mjs）+ 新增 4（`git status` 未跟踪实测：src/components/EmptyRuler.tsx、scripts/plugins/purgeArcoCss.ts、scripts/check-a11y-contrast.mjs、scripts/check-currency.mjs）。文档与素材不计入本数（design-language.md / p5-spec.md / research-* 两份与 docs/assets 工作台素材 4 件另算）。

**尺寸回收实绩**（收口会话实跑）：
- purge 实删 **873 条规则 / 73,380 B**（`PURGE_CSS_DRY_RUN=1 npm run build` 实测：`.arco-*-rtl` 833 条 68,440 B + `.arco-textarea` 24 条 3,202 B + `.arco-tag-checkable` 16 条 1,738 B）；
- index.css 369,011 B（同次 dry-run 产物实测，未 purge）→ **295,631 B**（正式构建产物实测）——差值 73,380 B 与 dry-run 报告逐字节一致；较实施前 319,788 B 净 −24,157 B（purge 回收被 P5 新增样式回填约 49 KB）；
- dist 总量 2,009,957 B（§13 实施前底数）→ **1,992,631 B**（`node scripts/check-size.mjs` 实测 14 文件）——净 −17,326 B，低于 HEAD 门禁 2,000,000 达 7,369 B；
- **门禁回调落地**：scripts/check-size.mjs:28 `TOTAL_LIMIT_BYTES = 2_000_000`（P4 特批 2,010,000 归档，兑现 :25-27 注释既定回滚条件）；wasm 372,534 B ≤ 800,000 不变；
- **与 §13 删类计划的两处偏差（实施修订，收口已逐条核证源码）**：① `.arco-tag-checked` 不入删类——组件库 Tag 非交互态恒挂 checked 类（node_modules/@arco-design/web-react/es/Tag/index.js:105 `_checked = checkable ? mergedChecked : true`、:111 挂类实测），删除将破坏全部彩色 Tag 样式；② `.arco-pagination` 不入首期——ScenarioPanel 的 Table 未传 pagination prop（undefined ≠ false），有数据时内部分页器照渲染（同包 es/Table/table.js:718 实测），§13 的放行闸前提不成立。§13 计划保底 79,567 B（四类 86,217 B）→ 实收 73,380 B（三类），仍 ≥ 案 B 触发线 25 KB 的 2.9 倍——**巧思 12 项全保、无降档，案 B 未触发**。

**门禁终态**（收口会话全量实跑，全部 exit 0）：

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 构建含类型检查 | `npm run build` | exit 0（tsc --noEmit + vite build；precache 12 entries 正常生成） |
| 尺寸 | `node scripts/check-size.mjs` | exit 0：14 文件合计 1,992,631 B ≤ 2,000,000；最大 .wasm 372,534 B ≤ 800,000 |
| 对比度 | `node scripts/check-a11y-contrast.mjs` | exit 0：23 组令牌对全过，白名单外违规 0（浅色涨跌语义色为显式登记豁免） |
| 币种样本 | `node scripts/check-currency.mjs` | exit 0：五组样本断言全过 |
| 孤儿检查（§2.7 迁移后口径，§12.9 偏差项闭合） | `grep -rnE 'wf-text-(xs\|sm\|md\|lg\|num)\|wf-bg-page\|wf-tint-bg' src/` | **0 行** |
| 删类零命中（§8 #22 静态半） | `grep -o '<删类>' dist/assets/index-*.css` | `arco-rtl` / `arco-textarea` 0 命中；`arco-tag-checkable` 余 14 处仅存于混合选择器规则（保守口径整条保留，运行时无此 DOM）；`arco-pagination` 按偏差①②口径保留 |
| purge 复核 | `PURGE_CSS_DRY_RUN=1 npm run build` | 删类清单（873 条 / 73,380 B）与正式产物差值逐字节一致 |

**验收轮次与残留 findings（如实）**：
- **轮次**：①规范修订轮（评审 R1–R10 逐条吸收，见文末「修订对照」）→ ②二轮补记（5 条，见上节）→ ③实施轮（本节：门禁全量实跑 + 签名元素 12 项逐项落点核验，逐项状态与行号见 design-language.md §2.1 实施状态）。实施会话的逐条验收日志未在仓库留档；本节以其可在仓库复核的产物为准（门禁脚本输出、purge 插件头注释、全部行号可 grep 复现）。
- **残留 findings**：① scripts/check-size.mjs:24-26 注释曾记 purge 回收「67,291 B」，与收口实测 73,380 B 不符（疑为实施中途测量）——收口已更正该注释；② §8 视觉目测类条目（#1/#4–#21 中需交互与双主题目测者）收口未在浏览器逐条复演，本节不对其做「已验收」声明——已证者为命令可证项与素材截图（docs/assets/demo-workbench* 为实施后界面实拍）；③ `arco-tag-checkable` 混合选择器残留 14 处为保守口径的已知残留，无样式风险；④ PWA 预缓存同源性由注册顺序约束保证（vite.config.ts:67 purge 插件先于 VitePWA），构建产物核验通过，运行时离线行为未做浏览器级复验。

---

## 附：施工顺序（研究 §7 建议采纳；二轮修订：purge 提至最前）

1. §13 尺寸回收落地（purge 插件 + dry-run 复核 + 门禁复跑，先行——所有后续工作在回收后的余量内进行）→
2. 令牌升级 + 全局规则（global.css + App.tsx 注入 + defaults/types，一处改动全站收益）→
3. 巧思 CSS-only 批（T3/T4/T7）→ 巧思 TSX 批（T1/T2/T5/T9/T10/T11/T14/T15/T6）→
4. 逐面板冗长治理（MonteCarlo → Pension → Insights → 其余）→
5. §8/§9 验收 + 孤儿检查 + 键集对账 + 门禁复跑收口。

---

## 修订对照（评审 finding 逐条吸收记录；finding id R1–R10 ↔ 本清单序号）

> 10 条 finding 全部吸收，无拒绝项。每条 = finding id → 改动位置 → 证据（命令 / 行号）；行号均本会话实测，非转抄。文末另有「二轮补记」收二轮复查新增改动。

1. **R1 · P0 · T15 目标变量绑错** — **吸收**。验证：`sed -n '78,92p;130,150p' src/components/advanced/AccumulationPanel.tsx` 实测 `effectiveTarget` 定义（:84-86，联动且预览就绪取基础模式临界值）与 `run()` :138-141 提交 `targetValue: effectiveTarget`；`grep -n accumulationTargetSynced src/store/useCalculatorStore.ts` 实测默认 `true`（:162）。修订：§3 T15 改绑 run 时提交的 `submittedTarget` 快照（与 calcAccumulation 同帧同值），ReferenceLine 与叙事行同闸渲染（`data && chartData.length > 0 && submittedTarget !== null`）；§8 #16 同步改写验收口径。
2. **R2 · P1 · T1 刻度点几何出界** — **吸收**。验证：`RING_RADIUS = 30`（BasicCalculator.tsx:60）、`viewBox="0 0 72 72"`（:303）、环 stroke 8（:307）——r=38 > 盒半径 36，四点必被裁剪。修订：§3 T1 改 viewBox `0 0 80 80`（圆心 40），刻度点显式 r=38（38+1.2=39.2<40），环体几何不变，transform-origin 40px 40px；等比缩小 ≈10% 登记 §12.4。
3. **R3 · P1 · px 字面量漏收编 + 行号误** — **吸收**。验证：`grep -nE 'font-size: 1[0-9]px|font-size: [0-9]px' src/styles/global.css` 实测 7 行（775/801/916/942/943/1011/1091）；原规范写 :776 实为 :775、漏 :943 与 :1011。修订：§1.1 更正为 7 行实测清单；§2.1 caption 收编 6 处 12px（含 :943）、body 收编 :1011（14px 同值改挂零视觉变更）；§8 #1 门禁命令不变、清单对齐后可过。
4. **R4 · P1 · T9 主落点锚点不存在** — **吸收**。验证：BasicCalculator.tsx 全文 grep `品牌|brand|wf-computing` 零命中，品牌区仅 App.tsx:239（.wf-header-brand）。修订：§3 T9 主落点改输出卡卡头 title/extra 区（BasicCalculator.tsx:466-471，与 `isStuck` 并列挂 `wf-computing`），并补诚实反馈的真缺口论证（loading 在防抖后才置位，hooks.ts:45-46）；design-language.md §2 S9 行已按其 §5.1 准入流程回填（名称改「输出卡计算徽标」）并记入 §5.5 版本记录；p5-spec §0 映射表同步。原「降级预案」§12.8 更正为落点变更登记。
5. **R5 · P1 · S6 空态覆盖自相矛盾** — **吸收（取扩围方案）**。验证：四处空态实测在位（MonteCarloPanel.tsx:676,905-910；AccumulationPanel.tsx:575；ScenarioPanel.tsx:282-285）。修订：§3 T6 落点扩为 4 处 + 进度环缺席位（同一 SVG 组件经 Empty icon 注入）；§4 MonteCarloPanel / AccumulationPanel 两行同步；§5 增「空态句式统一」任务行（五键改写不增键）；§8 #11 扩为四处验收；§0 映射与本节一致。冷感对冲（design-language §0）兑现完整。
6. **R6 · P1 · 明细合并静默删除 D9 行为** — **吸收**。验证：narrow 分支承载 toggle + aria-expanded（BasicCalculator.tsx:551-576，grep 实测 breakdownOpen :357、aria-expanded :557）；吸附态隐藏依赖 `.wf-output-breakdown`（global.css:1139-1145，实测含 `.wf-breakdown-toggle` 穿透豁免）。修订：§4 BasicCalculator 明确「合并的只是表格定义，分支行为原样保留」，外层类名不变；§9 新增 R12（D9 折叠，375 档实测）**与 R13（aria 回归：aria-live 播报节点 :476 + 六处图表 role="img"/aria-label——grep 实测 BasicCalculator.tsx:197,304-305、MonteCarloPanel.tsx:683-684,850-851、RentalPanel.tsx:614、AccumulationPanel.tsx:513-514）**；§10 减项口径改为「表格定义合并」。（二轮补记：一轮漏补 R13 的 aria-live 与图表 aria 两项，本条已闭合。）
7. **R7 · P2 · 注释行孤儿 + 基线计数** — **吸收**。验证：global.css:780 注释含 `--wf-tint-bg`；`grep -rnE 'wf-text-(xs|sm|md|lg|num)|wf-bg-page|wf-tint-bg' src/ …` 实测 23 行 = 消费 12 + 定义 10 + 注释 1（与复核口径一致）。修订：§2.3 tint 迁移清单加 :780（注释随改名更新）；§2.7 基线计数改 12/10/1=23 并注明门禁 grep 不区分注释。
8. **R8 · P2 · T2 一次性语义无机制** — **吸收**。修订：§3 T2 补已达成闩锁机制（ref 置位一次、ratio<1 / 环隐藏 / resetEpoch 递增清位）；§8 #7 验收口径同步（1→0.99→1 不重放）。
9. **R9 · P2 · T11 体积账与 TSX 事实不符** — **吸收（取 THEME 新键）**。理由：color-mix() 无实底回退纪律对应且引入新 CSS 特性依赖；新令牌走三源对账五点同步（types.ts ThemeTokens + THEME `#4A6FA5` 对偶占位 + THEME_DARK `#A6C0E4` + App.tsx 注入 + global.css 双块），浅色显隐由 CSS 承载。体积账 0.15→0.3KB（TSX circle + CSS + 注入），§10 账本同步；design-language §2 S11 行补令牌名。
10. **R10 · P2 · 三处计数小错** — **吸收**。验证：① `grep -c '<XAxis\|<YAxis'` 四宿主实测 2+4+2+2=10（§6 「8 处」→10 处）；② `awk 'NR==345||NR==459 {print NR": "length}'` 实测 345=238、459=172——§1.4 表 gradingNote/strategyNote 长度已对调校正；③ InsightsPanel.tsx 全文实读确认 :105 evidenceNote 独立渲染无既有标题键——§11 增 evidence 小节 +2 键（evidenceTitle + evidenceShort）。**另自查发现并校正**：初版 §11 合计行算术有误（原「新增 17 / 净增 14」）；一轮修正为「新增 ≈22，删除 ≈3，净增 ≈19」但与分项和仍差 1——**二轮按分项逐行重算闭合：巧思 6 + 压缩新增 15 = 21、删 3、净增 ≈18**（§11 已改）；§10 净增随 #5/#9 同步 4.6→4.95KB，且一轮所附「特批档 2,016,000」已随门禁特批撤回（§10 裁定、§12.2）废止。

### 二轮补记（本轮复查在吸收 R1–R10 基础上新增的改动）

1. **R6 二轮闭合**：一轮已补 §9 R12（D9），漏补 R13 的 aria-live 与图表 aria 两项——本轮补 §9 R13（改动位置：§9；证据：grep aria-live/aria-expanded 精确行号 :476/:557 与六处图表 role="img"/aria-label 行号，见上条 #6）。
2. **§11 算术二次校算**：改动位置 §11 表两行 + 本节 #10；证据 = 分项逐行加总（巧思 6、压缩新增 15、删 3）。
3. **T6/T15 体积账闭合**：§10 账本引 T6 1.45KB 而 §3 T6 行仍记 1.3KB、T15 无体积行——本轮补记 T6 体积 1.45KB（扩围后注入点 5 处）与 T15 体积 0.6KB；证据 = §3 各项加总恰为 §10 所引 6.4KB（0.85+0.6+0.25+0.2+0.4+1.45+0.25+0.45+0.2+0.3+0.85+0.6）。
4. **§10 裁定改写 + §13 新增**：撤回「门禁 2,010,000→2,016,000」首选路径（改动位置 §10 裁定、§12.2、附：施工顺序步骤 1），新增 §13 尺寸回收计划与 §8 #22（改动位置 §8/§13）；证据 = 本会话实跑 `npm run build`（exit 0）+ `node scripts/check-size.mjs`（exit 0，14 文件 2,009,957B）+ `git show HEAD:scripts/check-size.mjs`（:25 = 2_000_000）+ dist CSS 规则级扫描（`.arco-*-rtl` 800 条 62,351B、`.arco-tag-checkable/checked` 97 条 13,667B、`.arco-textarea` 28 条 3,549B、`.arco-pagination` 57 条 6,650B；业务侧 grep rtl/checkable/Textarea/pagination 均零命中）+ main.tsx:27-49 按需引入实证。
5. **验收清单条数**：§8 标题 21→22 条（#22 二轮新增）。

未执行项（如实声明）：§8 视觉目测类验收（#1/#4-#21 中需交互与双主题目测的条目）、迁移后孤儿 0 行判定、§13 purge 本体施工——本轮只修订两份文档不动 src/，均列为实施者收口时执行；本会话实跑的验证覆盖文档断言与静态核对（grep/awk/sed/git diff/node 扫描/完整 build+check-size），其中 build 与 check-size 为本轮实跑，非转抄。

---

## P5.1 残留收口（视觉验收第 3 轮残留 6 项 + 部署核验，主会话直接实施）

1. **V1 · 移动端吸附卡内容减法（medium）** — D9 吸附态扩为纯读数卡：hero + 进度说明常驻，两行长解释句（.wf-output-line ×2，含乘数段位 Tag 行）与明细/敏感性展开开关及其内容区吸附中一并隐藏。附带消解既有缺陷：内容区被 1182/1183 隐藏后开关仍可点击（1185 穿透豁免），是无反馈死控件——随本修订收除开关、删除死豁免。改动：global.css D9 块改写（:1180 区）。证据：吸附态四规则实读（.wf-output-breakdown/.wf-sens-block 隐藏 + .wf-breakdown-toggle 豁免并存）。
2. **V2 · 合计行折行（low）** — label 缩短「合计（财富自由参考线）」→「合计（参考线）」，÷100 等完整口径由卡头标题承载；三语同步（zh-Hant 逐词字形、en 对应缩短）。改动：zh-CN.ts:52 / zh-Hant.ts:46 / en.ts:57；BreakdownTable 注释的「合计行 182px」失效引用同步删除（BasicCalculator.tsx:472 区）。
3. **V5 · 688 档表头折行（low）** — reverse.leverageYears 去括注「（乘数 ÷ 100）」，推导完整保留于 leverageTooltip（值悬停）与 note（面板注）双通道，信息零损失。改动：zh-CN.ts:258 / zh-Hant.ts:231 / en.ts:290；渲染点 ReversePanel.tsx:174 实证有 Tooltip 兜底。
4. **V3 · 宪法层幽灵键（low）** — design-language.md §3.2「实底四档」更正为「三档 + 材质浮层」：--wf-bg-overlay 全仓 grep 零定义零消费（评审员实证 + 主会话复核），浮层由 --wf-surface-overlay-* 材质层承担；走 §5.1 修订记录 + §5.5 版本记录。
5. **V4 · 行号引用（low）** — 当前 design-language.md §2 头注已写 hooks.ts:162，与 hooks.ts:162（usePrefersReducedMotion 定义行）一致——判定评审残留为中间态，已解决，无需改动。
6. **V6 · 动作权重不对称（low）** — 移动端 dock 主按钮 / 桌面次按钮的断点差登记为有意例外（design-language §5 新增第 6 条「例外登记」条款），非缺陷。
7. **部署核验** — workflow 内三连 curl 退出码 35 为 Pages 传播期瞬时 TLS 故障：主会话复核三资源 200 + gh-pages 182ac23（Pages 构建 2026-11-20 23:28:19 UTC）确认部署落地；哈希级比对因本机到 github.io 网络抖动暂缓，不阻塞。
