# WF-04 时间透镜交互规格（research-wf04-lens）

> 性质：WF-04 交付物——时间透镜（刻度轨＋逐年读数面板）嵌入人生轨迹读数卡的**可施工交互规格**，数值逐项；供实施直接消费，本文零代码改动。
> 输入物（本会话全读／直读）：`docs/research-atlas-prototype.md` §0.4/§0.5/§2.1/§5.1（透镜原型规格 :191-196）；`docs/p8-spec.md` §1.2 YearRow（:67-100）/ §2.3 行语义（:191-203）/ §4.1–§4.4（读数卡与调用点）/ §6.3（回收令）/ 收口记录 C/D-3/F-4；`src/components/LifeTrajectoryCard.tsx`（177 行全读）；`src/components/TaskPages.tsx`（77 行全读）；`src/services/finance.ts:594-617`（YearRow 现实现）/ `:824-874`（calcLifecycle 装配）；`src/styles/global.css` 令牌区（行号逐条见文内）；`src/components/hooks.ts:31-35`（useFinanceCall）/ `:150-153`（compactXInterval）/ `:164-175`（usePrefersReducedMotion）；`docs/design-language.md:63`/`:118`（S21 定义与落地）。
> 范围红线：本轮只覆盖**刻度轨＋读数面板**；生命周期路径图、跟手检视浮层、十字虚线、事件编辑器、homePurchase/childBirth/healthPhase 事件化施工均不在本文（p8-spec §0.2 移交清单承接，登记为「路径图轮启用项」）。零新视觉令牌、零新签名元素；透镜禁改 calcLifecycle 调用点数（p8-spec §4.4 收口值 9 处）。
> 铁律：零禁词（任务书 13 词面不在此复写；扫描记录见 §5）。

---

## §1 透镜交互规格

### 1.1 拖动载体裁定：自研刻度轨（否决原生 range input）

选择自研轨（`div role="slider"` + `tabIndex=0`），理由三条，逐条可核：

1. **键盘步进值须钉死**：原型要求 ←/→ 1 岁、PgUp/PgDn 5 岁、Home/End 首尾（research-atlas-prototype §5.1 :193）。原生 range 的 PgUp/PgDn 步长跨浏览器不一致（部分实现取 (max−min)/10），无法钉死 5 岁；自研 onKeyDown 逐键显式处理才可验收。
2. **里程碑标记须渲染在轨上**：pensionStart 圆点 / FI 首达空心点 / 耗尽年竖线（§1.5）是轨的一部分；原生 range 无刻度标记承载面。
3. **aria-valuetext 逐行中文读法**（「34 岁，期末 3,687,209 元」）由组件显式写入；原生 range 对 valuetext 动态更新支持不稳。

否决原生 range 不等于放弃其语义：自研轨**完整复刻** slider 语义（role、aria-valuemin/max/now、aria-valuetext、键盘），§1.5 全表。

**几何（逐项）**：

| 项 | 值 | 出处／理由 |
| --- | --- | --- |
| 控件命中区高 | 44px（`min-height: 44`，含触屏与鼠标档一律生效） | 原型 §0.4 工程目标 44×44；不新增机制，同 global.css:871-883 `.wf-touch-target`「padding 扩命中、负 margin 抵消」思路，本轨直接以整轨高度作命中区 |
| 轨道视觉线 | 高 2px、水平贯穿、颜色 `--wf-hairline-card`（发丝线，global.css 材质区既有键） | 视觉降噪；刻度与 thumb 才是信息层 |
| thumb | 24×24 圆形、`--wf-radius-full`、底 `--wf-primary`、白描边 2px | global.css:34-37 圆角令牌；24px 本体落 44px 命中区中央 |
| 轨两端内距 | 16px（`--wf-space-4`） | 首末刻度（t=1 / t=len）可命中、thumb 不裁切（global.css:25-31 间距令牌） |
| 主刻度标签 | ≤5 个、caption 12px（`--wf-text-caption`）、`--wf-text-tertiary` | research-responsive D5「<640 X 轴刻度 ≤5」全档适用；复用 `compactXInterval(totalTicks)` 同式（hooks.ts:150-153，返回 interval 使刻度 ≤5） |
| thumb 定位 | `left: calc((t−1)/(len−1) × 100%)` 纯 CSS 百分比；`len===1` 时写死 `left:0`（除零防御） | 零测量设计——零 getBoundingClientRect、零 ResizeObserver（§3 cleanup 纪律的承载前提） |

### 1.2 键盘与 S21 式输入豁免

| 键 | 行为 | 步进值 |
| --- | --- | --- |
| ← / → | t ∓/＋1，钳 [1, len] | 1 年 |
| PgUp / PgDn | t ∓/＋5，钳 [1, len] | 5 年 |
| Home / End | t=1 / t=len | 首尾 |
| 0–9 数字键 | **刻度轨不消费、原样冒泡** | — |
| Tab | 按文档流进出刻度轨（不漫游劫持） | — |

- 焦点环：`:focus-visible` 挂 `--wf-focus-ring` 双环现值（global.css:115），零新焦点样式。
- **S21 式输入豁免（登记为实施核对项，非本文施工）**：S21＝数字键切组且「显式输入豁免」（design-language.md:63 定义、:118 落地于 AdvancedPanel `makeTabsKeyDown`）。刻度轨属交互输入控件同类，豁免语义两条：(a) 焦点落于刻度轨时，App 容器数字键任务分域（1–4）**不得**触发任务跳转——防止拖动调年过程中误离本页；现有豁免集合若只覆盖 input/textarea，实施轮须把 `role="slider"[tabindex]` 计入（落点＝App 数字键分域监听处，实施首验项）。(b) 反向：刻度轨 onKeyDown 对 ←/→/PgUp/PgDn/Home/End `stopPropagation`，防冒泡触发任何容器级键位；对数字键不 stopPropagation（保冒泡，豁免由消费端判定）。

### 1.3 拖动读数联动字段（全部读 timeline 内存数组，零 wasm 调用）

数据源：`result.data.timeline: YearRow[]`（finance.ts:594-617 现实现）—— LifeTrajectoryCard 已持有一份（:53-57），透镜经 props 复用**同一数组引用**。选中 t 的读数 = `timeline[t−1]` 纯索引，**零 wasm 调用、零新增 calcLifecycle 调用点**（p8-spec §4.4 收口 9 处不增——本规格硬约束）。

| 面板字段 | YearRow 字段 | 展示规则 |
| --- | --- | --- |
| 年龄（主读数） | `age` | title 20px（`--wf-text-title`）＋ tabular-nums；旁注「第 {{year}} 年」caption |
| 期初资产 | `openingAssets` | body 14 tabular-nums，`money()` 币种换算（同卡面 LifeTrajectoryCard.tsx:98 口径） |
| 当年投入 | `contribution` | 同上；**可为负**（工作段负储蓄年，finance.ts:603-604 注记）——负值文本原样带负号展示，不引入语义色维度 |
| 当年支取 | `withdrawal` | 同上；净额口径（p8-spec §1.2 :85-90），桥接段＝生活费全额、领取段＝max(0, 生活费−养老金×12) |
| 事件标记 | `events[]` + `pensionStart` | 本轮 `events` 恒空（finance.ts:610 注记）；仅 `pensionStart=true` 渲染 Tag，文案复用既有键 `life.pensionStartMark` |
| 期末资产 | `closingAssets` | body 14 bold（卡面 :123 同档）；`t > depletedYear` 行恒 0（§2 状态表） |
| 养老金起领 | `pensionStart` | 起领行加注既有键 `life.pensionStartAt`（{{year}}/{{age}} 插值，卡面 :111 同键复用） |

### 1.4 读数面板布局（宪法字阶／表面令牌）

```text
LifeTrajectoryCard 内、Descriptions 之后：
├─ 刻度轨区（44px 命中高 + 刻度标签行 caption 12px，共 ≈64px）
├─ 读数面板（常驻块，非浮层——见下「适配登记」）
│  ├─ 主读数行：{{age}} 岁（title 20px）＋ 第 {{year}} 年（caption 12px）
│  ├─ 七字段区：2 列（容器 ≥768）/ 1 列（<768）——body 14 tabular-nums（S3）；
│  │   标签 caption 12px --wf-text-tertiary
│  └─ 状态行（仅耗尽后行）：life.lensAfterDepleted（caption 12px）
└─ 既有 Tag 标记轴 aria 行 + 口径注 tooltip（卡面 :153-174 原样保留）
```

- 面板表面：`--wf-bg-surface` 实底（密集数字恒稳定不透明底，research-atlas-prototype §4.1 :176 口径）＋ `--wf-radius-m`（10px）＋ `--wf-hairline-card` 描边 ＋ 内距 `--wf-space-3`（12px）；面板与轨区间距 `--wf-space-4`（16px）。
- **适配登记（对原型 §5.1 的有意差异）**：原型的悬浮检视器（Surface 2 材质 `--wf-surface-overlay-bg/blur`、跟手、240ms 显隐、十字虚线）为**路径图形态**启用项——本轮无图可挂、无跟手浮层场景；固定面板天然消除手指遮挡（原型 §5.1 移动差分的动机 :195），故两模式拖动中均即时更新（跟手优先），`--wf-surface-overlay-*` 本轮零消费。

### 1.5 指针／触控与轨上标记

- 指针：`pointerdown` 吸附最近年（`round(offsetX/trackWidth×(len−1))+1`，钳 [1, len]）＋ `setPointerCapture`；`pointermove` 跟手更新选中 t；`pointerup`/`pointercancel` 同分支落定（数值已即时更新，落定无额外动作）。位移 <8px 的 down-up 序列＝点按跳变，由吸附逻辑自然达成、无特判分支。
- 触屏：整轨 44px 高命中承载 thumb 拖动；无拖动结束落位差分（§1.4 登记理由）。
- 轨上里程碑标记（形状通道独立于颜色，S10 同构纪律）：

| 标记 | 形状 | 颜色 | aria |
| --- | --- | --- | --- |
| 养老金起领行 | 实心圆点 8px | `--wf-primary` | `aria-hidden`（读法由轨 valuetext＋既有标记轴 aria 行承载） |
| FI 首达行（`summary.fiFirstYear ≥ 1`） | 空心圆点 8px（描边 `--wf-primary`） | 同上 | 同上 |
| 耗尽年（`summary.depletedYear ≥ 1`） | 竖线 2×20px | `--wf-fall`（global.css:68） | 同上；行读法经 valuetext |

- 轨 slider 语义：`role="slider"`、`aria-label=t("life.lensLabel")`、`aria-valuemin=1`、`aria-valuemax=len`、`aria-valuenow=t`、`aria-valuetext=t("life.lensValueText",{age,value})`（value＝该行期末 money() 文案）。

---

## §2 与读数卡共存

### 2.1 嵌入裁定：嵌入 LifeTrajectoryCard（否决并列新组件）

- **选择**：嵌入。新子组件文件（建议 `src/components/lens/LifeLensTrack.tsx`，轨＋面板一体），由 LifeTrajectoryCard 渲染于 Descriptions 之后，props 传 `timeline` 与 summary 派生字段（fiFirstYear/depletedYear）。
- **理由**：(a) calcLifecycle 调用点必须保持 p8-spec §4.4 收口值——并列组件要么自带第二次调用（打破「9 处／唯一新增」登记与「同资料单次」验收 ①），要么把 result 提升重排卡结构；嵌入则调用点、防抖 300ms（hooks.ts:31-35 默认）、六切片依赖数组（卡面 :40-51）全部零变化。(b) 同一 `result.data.timeline` 内存引用零 wasm 重复调用（本规格硬约束，§1.3）。(c) TaskPages.tsx 六组结构（:35-42）与 hidden 非卸载（:70-74）零触碰——透镜只活在 trajectory 组内，切组即随壳隐藏（hidden 非卸载保活，回来还在）。
- 落位次序：Descriptions → 刻度轨区 → 读数面板 → 既有 Tag 标记轴 aria 行（保留，红线 3）→ 口径注 tooltip（卡尾 :170-174 原样）。

### 2.2 状态表现（逐态）

| 态 | 判定 | 透镜表现 |
| --- | --- | --- |
| 未就绪（loading 且无 result） | `result?.ok !== true` 且 loading（卡面 :53） | 轨区＋面板**不渲染不占位**（原型 §5.1 降级条款「数据未就绪整轨不渲染」:196 同口径）；Descriptions 现状兜底不变 |
| 服务错误 | `result.ok === false`（卡面 :54、:78 Alert） | 同上不渲染；口径注仍在 |
| timeline 空 | `timeline.length === 0` | 防御分支不渲染（结构性不触发：horizon ≥ 1，finance.ts:873 装配保证；防御仅登记） |
| 重算防抖中（已有旧 result） | `loading === true` 且旧 data 在 | **轨不禁用**：旧 timeline 是完整内存数组，拖动照常零 wasm；轨容器随 Descriptions 同步 `opacity 0.45`（卡面 :84 同源视觉降档）；落定后 selected t 钳到新 [1, len] **不重置**（原型 §0.4「参数变化后焦点不得被不必要重置」:49），行值静默换新（零过渡） |
| 耗尽（`depletedYear ≥ 1`） | summary | 轨上 `--wf-fall` 竖线标记；拖入 `t > depletedYear` 行：七字段按恒 0 渲染＋状态行 `life.lensAfterDepleted`——**恒零行如实展示不隐藏**（sequence.rs:154-159 补零语义，p8-spec §2.3 :201 教学闭合口径） |
| pension 错误分支 | `pensionMonthly = 0`（p8-spec §1.4 :162） | 轨不受影响（timeline 照常装配）；pensionStart 圆点照常；无额外态 |

---

## §3 reduced-motion 降级与监听器 cleanup 纪律

### 3.1 动效面盘点（零动效设计即降级）

| 动效候选 | 本设计处置 |
| --- | --- |
| 面板显隐过渡（原型 240ms 透明度） | **不存在**——面板常驻（timeline 有效即在），零显隐切换 |
| thumb 位移 | pointer 直接操作驱动，非动画——reduced-motion 不约束直接操纵 |
| 数值刷新 | 即时文本替换，无过渡 |
| 拖动反馈 | **本就是静态高亮**：选中态＝thumb 实底＋选中里程碑点描边强调（`--wf-primary` 描边，静态）——两模式行为一致，reduced 下零差异、零降级分支 |

- 结论：本组件 **0 处 CSS 过渡、0 处 JS 动画** → CSS 兜底块（global.css:954-960 通配全停）无目标可命中；`usePrefersReducedMotion`（hooks.ts:164-175）**不引入**——零多余 matchMedia 监听。如实登记：任务书「拖动反馈改静态高亮」在本设计中的兑现＝高亮通道自始静态，无需降级开关。
- 路径图轮启用原型 §5.1 浮层时（240ms 显隐），届时**双闸补齐**：CSS 兜底自动命中＋浮层显隐若走 JS 须 hook 显式短路（hooks.ts:169 注释口径：CSS 管不住的 JS 动画由动效方短路）；浮层禁挂 transform 过渡（原型 §5.1 :196）。

### 3.2 监听器 cleanup 纪律（硬约束）

1. **零手动全局监听**：pointer 事件全走 React 合成事件（onPointerDown/Move/Up/Cancel）＋ `setPointerCapture`——capture 保证拖出轨区后 move/up 仍派发到 thumb 元素，无 window 级临时监听的必要场景。
2. **pointercancel 与 pointerup 同分支**（释放 capture＋落定），不得只处理 up。
3. 卸载回收：合成事件随 React 卸载自动回收；元素移除时浏览器释放残留 capture——无需手写 removeEventListener。
4. **偏离登记**：实施中若引入 `addEventListener`／`matchMedia`／`ResizeObserver`／`getBoundingClientRect` 任意一项＝偏离本规格，须回零监听形态，或按 hooks.ts:172-173 配对 cleanup 模式改规格并复检——实施自检项。
5. thumb 定位纯 CSS 百分比（§1.1），零测量零观察器；`len===1` 除零分支写死 `left:0`。

---

## §4 i18n 键预算与尺寸估算

### 4.1 新键清单（9 键 ×3 语；复用键不计预算）

| 键 | 简体值（定稿基准） | 用途 |
| --- | --- | --- |
| `life.lensLabel` | 「时间透镜」 | 区块 caption 标题＋轨 aria-label |
| `life.lensHint` | 「拖动或按方向键查看逐年明细」 | 操作提示（caption；键盘可达性提示） |
| `life.lensYearNo` | 「第 {{year}} 年」 | 面板主读数旁注 |
| `life.lensOpening` | 「期初资产」 | 字段标签 |
| `life.lensContribution` | 「当年投入」 | 字段标签 |
| `life.lensWithdrawal` | 「当年支取」 | 字段标签 |
| `life.lensClosing` | 「期末资产」 | 字段标签 |
| `life.lensAfterDepleted` | 「已耗尽——此后各年恒为 0」 | 耗尽后行状态 |
| `life.lensValueText` | 「{{age}} 岁，期末 {{value}}」 | aria-valuetext |

- 复用：`life.timelineLabel`／`life.pensionStartMark`／`life.pensionStartAt`（既有 16 键内，zh-CN.ts:705-723 实读）。i18n 现状：`life` 组 16 键已在三语（zh-CN.ts:705-723 / zh-Hant.ts:645-663 / en.ts:785-803，本会话 grep 定位）。
- 三语键集一致性由既有 `check:share` 断言自动覆盖（p8-spec §3.8 同款，零脚本改动）。

### 4.2 尺寸估算（原始字节）与余量现实

| 来源 | 估算 | 依据 |
| --- | --- | --- |
| i18n 9 键 ×3 | ≈ +0.7 KB（zh ≈220B ＋ 繁 ≈230B ＋ en ≈260B） | 值均短句；插值模板 ×2 |
| LifeLensTrack JSX | +1.2 ~ +2.0 KB | 轨＋面板＋状态分支；面板复用卡内 Descriptions 写法 |
| CSS 新类 3–5 个 | +0.3 ~ +0.5 KB | 全部引用既有令牌零新键（--wf-* 逐条 §1.1/§1.4）；仅类选择器增量 |
| wasm | **+0** | 零 Rust 改动，纯前端读内存数组 |
| **合计** | **+2.2 ~ +3.2 KB** | — |

- **现状余量（本会话实跑）**：`node scripts/check-size.mjs` → `DIST_TOTAL_KB=1951`、`WASM_MAX_KB=379`、门禁通过；p8-spec 收口记录 C 表 raw **1,997,245 B**、对 2,000,000 B 余量 **2,755 B**（D-3「无二次容错」:499）。
- **结论：按上限 +3.2 KB 计盘超余量 → 回收盘点是硬前置**（p8-spec §6.3 顺序照抄执行，写码前第一步）：
  1. i18n 并合 9 → 7（候选：`lensHint` 并入 `lensLabel` aria 拼接；`lensYearNo` 由 `lensValueText` 模板承载）≈ −0.15 KB；
  2. 仍不足时裁展示项（本文新增候选序：`lensOpening`/`lensContribution` 两行并入口径 tooltip → 面板 2 列改 1 列省无布局字节则跳过）——**门禁 2,000,000 B 不放宽、不特批**（p8-spec §6.3 既有裁定）；
  3. 回收后净增预算硬线 = 回收后实测余量；实施轮以 `npm run build && npm run check:size` 复测登记。

---

## §5 自检记录（成稿会话实跑，2026-11-23）

1. 行数预算：`wc -l docs/research-wf04-lens.md` → **180 行**（≤280 通过）。
2. 禁词扫描：`grep -rniE "apple|bytedance|tencent|cupertino|毛玻璃|液态玻璃|玻璃|阻尼|弹簧|spring|damp|glass|liquid" docs/research-wf04-lens.md` → **exit 1 零命中**。
3. 令牌纪律：全文视觉参数仅引用 global.css 既有令牌现值（逐条带行号或区名）；零新令牌、零提案色值绑定；global.css 本会话零写入。
4. 独有推导值登记（非引用）：tap 位移阈值 8px；里程碑点 8px／竖线 2×20px；轨道线 2px；thumb 24px；键盘步进 1/5；`len===1` 除零分支；重算后 t 钳制不重置；i18n 9 键、增量 +2.2~3.2 KB、耗尽行恒 0 如实展示。
5. 未跑项如实声明：本规格为研究文档，未实施组件、未跑构建门禁复测（§4.2 尺寸门禁为现状实跑，非增量验证）；S21 豁免的 App 分域现状判定集合未直读 App.tsx（登记为实施首验项，§1.2）。
