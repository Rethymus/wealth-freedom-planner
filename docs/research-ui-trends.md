# UI 趋势研究 2025–26：配色 / 排版 / 动效 + 可复用代码库（第五轮·P6 裁定对照版）

| 项 | 值 |
| --- | --- |
| 文档性质 | 第五轮设计研究（本文件为对既有 420 行草稿的全面换证重写）：§0 趋势总览（配色/排版/动效三表 + 基线速查）、§1 可落地代码库（16 段，逐段标注 P6 裁定状态）、§2 视觉巧思候选、§3 反采纳清单 |
| 研究方法 | 本会话 WebSearch 检索 13 组（查询词全列附录 A）；MDN 官方 BCD 数据接口 19 键实跑核验（基线速查全部为官方数据非检索摘要，时间戳 2026-11-21T00:01Z）；代码段体积 esbuild 0.25.12 + gzip-9 逐段实测；仓库现状与 `docs/p6-spec.md` 裁定表逐项 grep 实读核对（附录 B） |
| 中性约定 | 本轮任务指定口径：站点与产品名直写（Linear / Vercel / Wise / godly.website 等）；产品术语若含禁词子串一律改写自然描述；本文 §1 段编号 Sn 与宪法签名元素 S1–S26 无关，每段标注其 P6 承接项 |
| 与宪法关系 | 全部是候选：落地先过 design-language.md §5.1 准入五要素；§1 是「可复制候选」非「已采纳」；已被 P6 采纳的段落以 p6-spec 登记版为准（本文件提供实测与出处） |
| 读者 | P6 实施/验收会话与后续轮次规范作者 |

---

## §0 趋势总览

> 每行口径：趋势 + 代表 + 「静水账房」适配判据 + 取舍。判据锚定宪法五原则（design-language.md §1）。

### 0.1 配色

| 趋势 | 代表 | 适配判据 | 取舍 |
| --- | --- | --- | --- |
| 史上最浅年度色与深色对冲：Cloud Dancer（PANTONE 11-4201，官方定位「最浅最中性、安静的象征」）× Transformative Teal（另一机构年度色 092-37-14，检索口径） | Pantone 2026 COTY 官方公告；adobe.com/express/learn/blog/color-of-year-trends | 浅色画布只做「色温微偏一档」的校准吸收；teal 强色相与冷感账房既有主色冲突不入 | 已落地：V2 暖白 `#F8F7F3`（p6-spec §3，本会话门禁实跑通过） |
| 暖中性底盘 + 大地点缀 | Vistaprint Color Trends 2026（vistaprint.com/hub/color-trends） | 只取色温不取色相：点缀色相不入，表面一律既有中性令牌 | 取温舍相（V2 即全量吸收） |
| 深色技术精密风：近黑底 + 单一低饱和点缀 + mono 注记 | Linear（#08090a 近黑 + 薰衣草紫点缀 + Berkeley Mono，open-design.ai / designmd.dev 分析）；Raycast 红橙点缀同族 | 与本仓「深色越高越亮 + 发丝线」同构；可吸收增量=次级文字冷暖微偏 + mono 刻度 | 已落地：V1 mono 刻度注记、V3 深色次级冷灰 `#A6B0C3`（p6-spec §3） |
| 高饱和多巴胺回潮 / Y2K 复古 | Vistaprint「Neon Shock / Tangerine Disco」；2026 趋势综述「dopamine design」（figma.com/resource-library/web-design-trends 同列 vibrant palettes） | 语义色域外任何高饱和均违「数字是主角」；庆祝全站仅一次（宪法 S2） | 反采纳（§3 A4） |
| 深色莫迪暗调盘（Dark Royal / Plum Noir 等） | ColorHunt 2026 热门盘（colorhunt.co/palettes/popular） | 整盘迁移推翻「越高越亮」明度差体系；工程量与回归风险不可承受 | 反采纳（§3 A13） |
| 低饱和粉彩 / neo-mint | 2026 转化向配色综述（检索汇总） | 取「低饱和」不取「粉彩」：粉彩的暖软气质与账房冷感相抵 | 观望，无施工 |

### 0.2 排版

| 趋势 | 代表 | 适配判据 | 取舍 |
| --- | --- | --- | --- |
| 单字族主导： admired 站点约 60% 只用一个字族 | Muz.li《Font pairings 2026》（2026-10-21，2,190 站 × 24 画廊，muz.li/blog/font-pairings-2026） | 本仓系统字体栈零自托管即该趋势的最稳实现 | 维持现状（外部佐证） |
| mono 第三点缀：三字族系统的首选第三字体 | 同 Muz.li 研究；Linear（Berkeley Mono）/ Vercel / Raycast 的 mono 标签风 | 与宪法 S3 度量字排同构，扩展到图表刻度等非数值精密位 | 已落地：V1 `--wf-font-mono`（p6-spec §3） |
| serif 标题 × 账本式数字（「读起来像财务文件」） | Tubik《7 UI Design Trends of 2026》（tubikstudio.com/blog/ui-design-trends-2026） | 与账房人格同构；但与 mono 同轮引入=双新字族稀释冷感单一字族纪律 | 不采纳（p6-spec §3 已裁定；C3 复议需 mono 稳定一季后） |
| 超大标题 / 超大数字 | Figma《Web design trends 2026》bold typography（figma.com/resource-library/web-design-trends） | 宪法 §3.1 读数窗单处纪律即该趋势的克制版；四级字阶不膨胀 | 维持现状 |
| 可变字体普及：88% 站点用 web 字体，可变字体 39.4% 桌面 / 41.3% 移动 | Web Almanac 2025 Fonts 章（2026-01-15 发布，almanac.httparchive.org/en/2025/fonts） | 自托管字体文件=门禁不可承受；字重过渡动画违「数字永不抖动」 | 反采纳（§3 A6） |
| 排版质量基线：`text-wrap: balance`（全主流）/ `pretty`（Firefox 尚未支持） | MDN BCD 实测（§0.4） | 零体积排版质量提升；不支持即声明无效，渐进无害 | 候选（§1 S14，留置未裁定） |

### 0.3 动效

| 趋势 | 代表 | 适配判据 | 取舍 |
| --- | --- | --- | --- |
| 原生 CSS 动效替代 JS 动画库：2026-06 综述称 91.7% 移动页用 CSS transitions、仅 18.4% 载 JS 动画库（检索摘要口径） | Frontend Horizon《View Transitions API & Scroll-Driven Animations: The Browser Wins of 2026》（2026-04，frontendhorizon.com） | 与零依赖纪律共振；密度纪律（productive 为主、S2 唯一 expressive）不因能力增强而放松 | 采纳方向（§1 全 16 段零依赖） |
| scroll-driven animations 三内核齐 | BCD 实测：Chrome 115 / Firefox 159 / Safari 26（§0.4） | 只用于「进度、入场」两类；P6 裁定其「随滚动映射、可逆重放」与频次纪律冲突 | 大部分不采纳（§1 S3/S4/S5 留档复议；S5 另有 recharts 入场叠加冲突） |
| 同文档 View Transitions 全主流 | BCD 实测：Chrome 111 / Firefox 144 / Safari 18（§0.4） | 低频落点仅主题切换一处（P6 S22 定案：flushSync + 键盘坐标回退 + 显式伪元素停用） | 已落地：S22（§1 S1）；读数换票裁定不采纳（p6-spec §2 #6） |
| 元素级过渡 `view-transition-name: match-element` | BCD 实测：Chrome 137 / Firefox 144 / Safari 18.4（新特性） | 情景 Tag 列增删的逐项位移过渡（ScenarioPanel.tsx:232-259 Tag 列实测存在）；低频、单次 | 新候选（§1 S16 + §2 C11） |
| 进出场原生化：`@starting-style` + `transition-behavior: allow-discrete` | BCD 实测：117/129/17.5 与 117/129/17.4 | 行级与浮层进场，时长挂既有令牌；需 mounted 闸防首挂载整列重播（p6-spec S23 修订轮 F10） | 已落地：S23（§1 S6）；浮层版候选（§1 S8） |
| 原生手风琴：`::details-content` + `interpolate-size` | BCD 实测：131/143/18.4；interpolate-size 仅 Chromium 129 | 明细折叠在仓内走 Button+条件渲染（`<details>` 0 命中），改结构触回归 | 不采纳（p6-spec §2 #8；§1 S9 留档） |
| 磁吸 hover 微行程化 | Framer 趋势清单微交互侧（检索汇总） | 大行程不采纳；≤4px 微行程只给桌面低频主按钮、hover:hover 才挂监听 | 已落地：S26（§1 S12） |
| 数字动画纪律化（<1s、进场一次、tabular、屏读只报终值） | 行业文章 Q 口径（P5 收编，research-design-language.md §1 #3） | 既有 `useAnimatedNumber`（hooks.ts:198）全部合规；CSS 变体 Safari 渲染未验证 | 已采纳主路径；CSS 变体不采纳（p6-spec §2 #9；§1 S11 留档） |

### 0.4 基线速查（MDN BCD 官方数据接口实测 @ 2026-11-21，bcd.developer.mozilla.org v0）

| 特性 | Chrome | Firefox | Safari | Baseline 判定 |
| --- | --- | --- | --- | --- |
| `:has()` | 105 | 121 | 15.4 | Widely available（2023-12 三内核齐） |
| `@starting-style` | 117 | 129 | 17.5 | Newly available（2024） |
| `transition-behavior: allow-discrete` | 117 | 129 | 17.4 | Newly available |
| Popover API（`popover` 属性） | 114 | 125 | 17 | Newly available |
| `document.startViewTransition`（同文档） | 111 | **144** | 18 | Newly available（Firefox 144 补齐，2025-10 量级） |
| `view-transition-name: match-element` | 137 | 144 | 18.4 | Newly available（2026） |
| `animation-timeline: scroll()/view()` | 115 | **159** | 26 | Newly available（2026，Firefox 159 默认开启） |
| `@property` | 85 | 128 | 16.4 | Newly available（2024-07） |
| `linear()` 缓动 | 113 | 112 | 17.2 | Widely available（2023-12 三内核齐） |
| `light-dark()` | 123 | 120 | 17.5 | Newly available |
| `text-wrap: balance` | 114 | 121 | 17.5 | Widely available 临界（2024-06 齐） |
| `text-wrap: pretty` | 117 | 未支持 | 26 | Newly available（Firefox 缺位） |
| `::details-content` | 131 | 143 | 18.4 | Newly available（2025） |
| `interpolate-size` | 129 | 未支持 | preview | Limited（渐进增强） |
| `oklch()` | 111 | 113 | 15.4 | Widely available（2025 下半年齐 30 月） |
| `font-variant-numeric` | 52 | 34 | 9.1 | Widely available（远古） |
| `field-sizing: content` | 123 | 152 | 26.2 | Newly available（2026） |

> 当前内核坐标（同一 BCD 数据）：Chrome current 158/159（2026-11）。参考产品时效：Arc 已于 2025-05 停止功能开发转投 Dia（browsercompany.substack.com/p/letter-to-arc-members-2025）——趋势引用不依赖 Arc。

---

## §1 可复用代码库（16 段，全部可直接复制）

> 统一约定：①类名 `wf-` 前缀；时长/曲线只引用既有令牌 `--wf-dur-fast/base/slow`、`--wf-ease-standard/asymptotic/emphasis`（global.css:101-106 实测），零新增时长键；②前提双闸：`usePrefersReducedMotion`（hooks.ts:162）+ global.css:644/:657 兜底块，每段仍单独写降级；③状态列 = p6-spec 裁定（已采纳项以 p6-spec 登记版为准实施）；④体积 = 本会话 esbuild minify + gzip-9 单段独立实测（附录 B），合计 16 段 4,241B，合并入 global.css 共享压缩字典实际更低；当前门禁 DIST_TOTAL_KB=1946 / 限 2,010（本会话 `node scripts/check-size.mjs` 实跑通过），余量约 64KB；⑤`grep -rn "startViewTransition|animation-timeline|starting-style|view-transition|interpolate-size|details-content" src/` 实测 0 命中 → 16 段全部净新增。

### S1 主题切换圆形揭示（View Transitions）——状态：✅ P6 已采纳 = S22

```tsx
// 落点：App.tsx 主题按钮 onClick（P6 S22 定案版：flushSync + 键盘坐标回退 + 双降级）
import { flushSync } from 'react-dom';
function revealTheme(e: React.MouseEvent<HTMLButtonElement>, apply: () => void, reduced: boolean) {
  if (reduced || typeof document.startViewTransition !== 'function') { apply(); return; }
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.detail === 0 ? rect.left + rect.width / 2 : e.clientX; // 键盘激活（Enter/Space）回退几何中心
  const y = e.detail === 0 ? rect.top + rect.height / 2 : e.clientY;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(() => flushSync(apply)); // 不包 flushSync 则快照旧 DOM
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 360, easing: 'cubic-bezier(0.2,0,0,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {}); // ready 拒绝即静默放弃，换肤已完成无残留
}
```

```css
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
/* 通配兜底块不命中伪元素动画：减动效必须显式停用（p6-spec R9） */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(root), ::view-transition-old(root), ::view-transition-new(root) { animation: none !important; }
}
```

> 落点：主题切换 ｜ 基线：111/144/18（BCD 实测，Newly available）｜ 体积：gzip 528B ｜ 降级：无 API 或减动效 → 直接 apply()；ready 失败静默。

### S2 View Transition 通用包装 hook——状态：◐ 留置（读数换票裁定不采纳 #6，本段保留给低频迁移复用）

```tsx
import { flushSync } from 'react-dom';
import { useCallback } from 'react';
import { usePrefersReducedMotion } from './hooks';
export function useViewTransition(update: () => void) {
  const reduced = usePrefersReducedMotion();
  return useCallback(() => {
    if (typeof document.startViewTransition !== 'function' || reduced) { update(); return; }
    document.startViewTransition(() => flushSync(update)); // 同步提交防 React 批处理漏帧
  }, [update, reduced]);
}
```

> 落点：低频状态迁移通用包装（当前唯一消费者=S22；高频防抖链路禁用——快照成本与 300ms 防抖不成比例，p6-spec §2 #6）｜ 基线：同 S1 ｜ 体积：gzip 207B ｜ 降级：直更（现状）。

### S3 顶栏滚动进度细条（scroll() 时间线）——状态：✖ P6 不采纳 #11（与「诚实进度尺」资产重复施工 + 常显降级违反克制）；留档复议

```css
.wf-progress-line { height: 2px; background: var(--wf-primary); transform-origin: 0 50%; }
@supports (animation-timeline: scroll()) {
  .wf-progress-line { transform: scaleX(0); animation: wf-progress-grow linear both; animation-timeline: scroll(root); }
  @keyframes wf-progress-grow { to { transform: scaleX(1); } }
}
@media (prefers-reduced-motion: reduce) { .wf-progress-line { animation: none; transform: none; } }
```

> 落点：顶栏底部 2px 条（复议前提：出现真正长页滚动场景）｜ 基线：115/159/26 ｜ 体积：gzip 222B ｜ 降级：无 `@supports` → 常显装饰线（即 P6 拒因之一）；减动效 → 常显全宽。

### S4 面板进入视口淡入（view() 时间线）——状态：✖ P6 不采纳 #10（随滚动映射、可逆重放违反频次纪律）；留档

```css
@supports (animation-timeline: view()) {
  .wf-panel-enter { animation: wf-panel-in linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
  @keyframes wf-panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
}
@media (prefers-reduced-motion: reduce) { .wf-panel-enter { animation: none; opacity: 1; transform: none; } }
```

> 落点：第九面板分组卡 ｜ 基线：115/159/26 ｜ 体积：gzip 200B ｜ 降级：无支持/减动效 → 直接呈现。

### S5 图表条形生长（view() 时间线）——状态：✖ P6 不采纳 #7（与 recharts `barAnimationProps` 入场动画双重 transform 互相覆盖）；留档

```css
@supports (animation-timeline: view()) {
  .wf-bar-grow { transform: scaleX(0); transform-origin: left center; animation: wf-bar-in linear both; animation-timeline: view(); animation-range: entry 10% entry 90%; }
  @keyframes wf-bar-in { to { transform: scaleX(1); } }
}
@media (prefers-reduced-motion: reduce) { .wf-bar-grow { animation: none; transform: none; } }
```

> 落点：龙卷风图（复议前提：先关 recharts 入场动画）｜ 基线：115/159/26 ｜ 体积：gzip 203B ｜ 降级：柱体常显。

### S6 结果行进场（@starting-style）——状态：✅ P6 已采纳 = S23（mounted 闸限定仅新增条目播）

```css
.wf-row-enter { transition: opacity var(--wf-dur-base) var(--wf-ease-standard), transform var(--wf-dur-base) var(--wf-ease-standard); }
@starting-style { .wf-row-enter { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .wf-row-enter { transition: none; } }
```

> 落点：情景 Tag 新增项、<768 明细展开容器（`@starting-style` 在每次 DOM 插入时播——面板首挂载须 mounted 布尔闸挡既有条目，见 p6-spec S23）｜ 基线：117/129/17.5 ｜ 体积：gzip 165B ｜ 降级：无 `@starting-style` → 无初始帧即现状；减动效 → transition 关闭。

### S7 字段错误左标线（:has()）——状态：✅ P6 已采纳 = S24（组级版废案：`.wf-field-group` 容器全仓 0 命中，改字段级）

```css
.wf-field { position: relative; }
.wf-field:has(.arco-input-error)::before {
  content: ""; position: absolute; left: -8px; top: 10%; height: 80%; width: 2px;
  background: var(--wf-fall); border-radius: 1px; /* 位置+颜色双通道冗余（WCAG 1.4.1） */
}
```

> 落点：`fields.tsx` 字段容器（`.wf-field` 存在于 global.css:392，纯 CSS 零 TSX）｜ 基线：`:has()` Widely ｜ 体积：gzip 160B ｜ 降级：无 `:has()` → 不渲染，行内文字 + aria-invalid + 红框三通道兜底。实施前置：`.arco-input-error` 类名 DevTools 实证一次（p6-spec 验收 #11）。

### S8 口径注气泡（Popover API + @starting-style）——状态：◐ 留置（P6 未裁定；反冗长原则「口径归 tooltip」的新载体候选）

```tsx
// 落点：结果卡口径注「ⓘ」（可作既有 Tooltip 的原生替代，自带轻关闭语义）
<button className="wf-gloss-btn" popovertarget="wf-gloss-leverage">口径</button>
<div id="wf-gloss-leverage" popover="auto" className="wf-gloss">乘数按滚动收益率口径计算……</div>
```

```css
.wf-gloss { inset: auto; position: fixed; max-width: 280px; padding: 8px 12px; border: 1px solid var(--wf-border); background: var(--wf-bg-surface); box-shadow: var(--wf-shadow-3); opacity: 0; transform: translateY(2px); transition: opacity var(--wf-dur-fast) var(--wf-ease-standard), transform var(--wf-dur-fast) var(--wf-ease-standard), display var(--wf-dur-fast) allow-discrete, overlay var(--wf-dur-fast) allow-discrete; }
.wf-gloss:popover-open { opacity: 1; transform: none; }
.wf-gloss::backdrop { background: transparent; }
@starting-style { .wf-gloss:popover-open { opacity: 0; transform: translateY(2px); } }
@media (prefers-reduced-motion: reduce) { .wf-gloss { transition: none; } }
```

> 落点：口径注气泡 ｜ 基线：Popover 114/125/17 + `@starting-style` 全主流 ｜ 体积：gzip 466B（tsx 161B 为源文直压，esbuild 无法解析 JSX 片段属预期）｜ 降级：无 popover 属性 → 不弹，按钮回退既有 Tooltip；减动效 → 直接显隐。

### S9 明细折叠动画（::details-content + interpolate-size）——状态：✖ P6 不采纳 #8（`<details>` 全仓 0 命中，结构改造触 R12/R13 回归）；留档给未来新页面

```css
:root { interpolate-size: allow-keywords; } /* 仅 Chromium 129+ 生效 */
details.wf-fold > summary { cursor: pointer; }
details.wf-fold::details-content { height: 0; overflow-y: clip; transition: height var(--wf-dur-base) var(--wf-ease-standard), content-visibility var(--wf-dur-base) allow-discrete; }
details.wf-fold[open]::details-content { height: auto; }
@media (prefers-reduced-motion: reduce) { details.wf-fold::details-content { transition: none; } }
```

> 落点：未来新增的原生折叠区 ｜ 基线：`::details-content` 131/143/18.4；interpolate-size Limited ｜ 体积：gzip 223B ｜ 降级：三层——无伪元素/无 interpolate-size/减动效均直接开合。

### S10 linear() 按压收敛曲线——状态：✖ P6 不采纳 #12（`.wf-pressable` 已承载按压档，双体系重复）；留档给新主按钮

```css
:root { --wf-ease-settle: linear(0, 0.468 8.6%, 0.822 18.5%, 0.942 26.4%, 0.987 34.9%, 1 48.6%, 1); }
.wf-press-main { transition: transform var(--wf-dur-fast) cubic-bezier(0.2, 0, 0, 1); } /* 先声明兜底曲线 */
@supports (transition-timing-function: linear(0, 1)) { .wf-press-main { transition-timing-function: var(--wf-ease-settle); } }
.wf-press-main:active { transform: scale(0.985); } /* 位移只给按压态；hover 仍走表面色纪律 */
@media (prefers-reduced-motion: reduce) { .wf-press-main { transition: none; } }
```

> 落点：移动端 dock 主按钮等新按压位 ｜ 基线：`linear()` Widely（113/112/17.2）｜ 体积：gzip 247B ｜ 降级：@supports 前置声明 cubic-bezier 兜底；减动效 → transition 关闭。

### S11 整数徽标 CSS 数字滚动（@property）——状态：✖ P6 不采纳 #9（Safari `counter(var())` 未验证 + 段位 Tag 已有 S14）；留档

```css
@property --wf-n { syntax: '<integer>'; inherits: false; initial-value: 0; }
.wf-count { transition: --wf-n var(--wf-dur-slow) var(--wf-ease-asymptotic); counter-reset: wf-n var(--wf-n); }
.wf-count::after { content: counter(wf-n); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .wf-count { transition: none; } }
```

```tsx
const supported = typeof CSS !== 'undefined' && 'registerProperty' in CSS;
const reduced = usePrefersReducedMotion();
return supported && !reduced
  ? <span className="wf-count" style={{ '--wf-n': saved } as React.CSSProperties} aria-label={saved + ' 笔'} />
  : <span className="wf-count" aria-label={saved + ' 笔'}>{saved}</span>;
```

> 落点：「已保存 N 笔」类整数徽标（金额主路径仍是 useAnimatedNumber）｜ 基线：`@property` 85/128/16.4；Safari counter 渲染未验证 ｜ 体积：gzip 417B ｜ 降级：无 `@property` → 直接渲染终值。

### S12 磁吸 hover 微行程（≤4px，hook）——状态：✅ P6 已采纳 = S26

```tsx
import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from './hooks';
export function useMagnetic<T extends HTMLElement>(max = 4) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !matchMedia('(hover: hover)').matches) return; // 触屏/减动效零挂载监听
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / r.width));
      const dy = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / r.height));
      el.style.transform = `translate(${dx * max}px, ${dy * max}px)`;
    };
    const reset = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset); };
  }, [max, reduced]);
  return ref;
}
```

```css
.wf-magnetic { transition: transform var(--wf-dur-fast) var(--wf-ease-standard); }
@media (prefers-reduced-motion: reduce) { .wf-magnetic { transition: none; } }
```

> 落点：顶栏分享按钮（低频主操作）｜ 基线：Pointer Events Widely，无新特性 ｜ 体积：gzip 499B ｜ 降级：减动效或无 hover 环境 → hook 不挂监听，transform 恒空。

### S13 图表十字读数（recharts 内建 Tooltip 共享气泡）——状态：✅ P6 已采纳 = S25（裁定走内建不手写 mousemove，interaction §4.5）

```tsx
import { Tooltip } from 'recharts';
export function chartTip(money: (v: number) => string) {
  return (
    <Tooltip
      cursor={{ stroke: 'var(--wf-text-tertiary)', strokeDasharray: '3 3' }}
      content={({ active, payload, label }) =>
        active && payload?.length ? (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{label}</div>
            {payload.map((p) => (
              <div key={String(p.dataKey)} className="wf-chart-tip-row">
                <span>{p.name}</span>
                <span className="wf-num">{money(Number(p.value))}</span> {/* 读数窗隐喻：等宽字排 */}
              </div>
            ))}
          </div>
        ) : null
      }
    />
  );
}
```

> 落点：五处 recharts 图（龙卷风/两蒙特卡洛/收租/积累）｜ 基线：无新特性依赖 ｜ 体积：gzip 295B（CSS 气泡样式另计 ≈0.1KB）｜ 降级：触屏无 hover——数值信息由明细行兜底；减动效无需处理（纯状态）。

### S14 排版质量基线（text-wrap + tabular 统一入口）——状态：◐ 留置（P6 未裁定；零体积、渐进无害）

```css
.wf-card-title { text-wrap: balance; }  /* 标题折行均衡；balance 全主流 Widely */
.wf-body-copy { text-wrap: pretty; }    /* 孤字治理；Firefox 未支持=自动无效，渐进无害 */
.wf-num { font-variant-numeric: tabular-nums; } /* S3 度量字排的类级入口 */
```

> 落点：结果卡标题、反冗长说明行、数值行 ｜ 基线：balance Widely；pretty 117/未/26 ｜ 体积：gzip 102B ｜ 降级：不支持 → 默认折行，信息不变。非动效段无需减动效处理。

### S15 滑杆已填充轨道——状态：◐ 留置（Slider 组件未引入，诉求由 InputNumber 承担；引入时的预置段）

```css
.wf-range { accent-color: var(--wf-primary); } /* 原生已填充观感基线 */
@supports (background: linear-gradient(#fff 0 0)) {
  .wf-range { appearance: none; height: 4px; border-radius: 9999px; background: linear-gradient(to right, var(--wf-primary) var(--wf-fill, 50%), var(--wf-border) var(--wf-fill, 50%)); }
  .wf-range::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--wf-primary); }
  .wf-range::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--wf-primary); }
}
```

> 落点：高级面板滑杆（预置）｜ 基线：`accent-color` Widely；双 thumb 伪元素全主流 ｜ 体积：gzip 234B ｜ 降级：无 @supports → 原生 accent-color 观感。`--wf-fill` 由 onInput 三行 `style.setProperty` 写入；无动画参与，减动效无需处理。

### S16 列表增删元素级位移（view-transition-name: match-element）——状态：★ 新候选（2026 新特性，未裁定）

```css
.wf-scenario-tag { view-transition-name: match-element; }
```

> 落点：情景 Tag 列增删（配合 S2 hook 包一次 startViewTransition；低频单次）｜ 基线：137/144/18.4（BCD 实测）｜ 体积：gzip 73B ｜ 降级：无 API/不支持 match-element → 直接重排；减动效 → 显式停用规则同 S1 CSS。注意：须挂显式停用规则（同 S1），否则减动效用户看到不受控动画。

---

## §2 视觉侧巧思候选目录（落地一律先走 design-language.md §5.1 准入五要素）

| # | 巧思 | 描述与落点 | 成本 | 状态与出处 |
| --- | --- | --- | --- | --- |
| C1 | mono 刻度注记 | 图表刻度改系统 mono 字族（`ui-monospace, "Cascadia Mono", Menlo, Consolas` 栈） | CSS-only | ✅ P6 V1 已采纳（口径注 prose 明确不纳入——mono 不利长句） |
| C2 | 主题切换叙事化（「开账/打烊」aria） | 切换按钮 aria-label 叙事化 | 零 | ✖ P6 裁定不采纳：WCAG 4.1.2 名称应描述功能目标状态 |
| C3 | serif 小节头一档 | 系统 serif 栈进小节头 | CSS-only | ✖ P6 裁定不采纳：与 mono 双新字族稀释冷感单一字族纪律 |
| C4 | 浅色画布暖白微偏 | `--wf-bg-sunken` `#f7f8fa` → `#F8F7F3`（Cloud Dancer 式校准） | 令牌改值 | ✅ P6 V2 已采纳（对比度验算 4.83:1 达标） |
| C5 | 深色次级文字冷暖微偏 | `THEME_DARK.textSecondary` `#A9AEB8` → `#A6B0C3` | 令牌改值 | ✅ P6 V3 已采纳（对比度 7.19:1，较原值提升） |
| C6 | 图表十字线读数窗 | 悬浮读数即读数窗隐喻延伸 | 少量 TSX | ✅ 并入 P6 S25（§1 S13） |
| C7 | 进度尺发丝刻度纹理 | 诚实进度尺叠 1px 刻度纹理 | CSS-only | ✖ P6 裁定不采纳：空态静默本身就是隐喻 |
| C8 | 结果落定换票 | VT 交叉淡化读数窗 | 少量 TSX | ✖ P6 裁定不采纳（§1 S2 状态） |
| C9 | 警示左标线 | 错误态左缘 2px 跌色条 | CSS-only | ✅ 并入 P6 S24（组级改字段级，§1 S7） |
| C10 | 选中塌缩对比 | 情景卡选中其余降透明 | CSS-only | ✖ P6 裁定不采纳：情景库为 Tag+对比表结构，无卡片单选形态（全仓类名 0 命中） |
| C11 | Tag 列增删位移 | `match-element` + S2 hook 给情景 Tag 列增删一次逐项位移（§1 S16） | CSS 1 行 + hook | ★ 新候选（本轮新增，待 P7 立项） |

---

## §3 反采纳清单

| # | 项 | 代表 | 拒因 |
| --- | --- | --- | --- |
| A1 | 3D / 空间化沉浸 hero | Figma 2026 趋势「3D and immersive」；Tubik「soft spatial UI」 | 体积不可承受（余量约 64KB）+ 与「界面是账房」静感冲突 |
| A2 | AI 对话化界面改造 | Tubik 2026「AI collaboration interfaces」；Fuselab「AI 可检查可覆盖」 | 无对应功能语义：本工具是计算器不是对话体；AI 透明度原则不等于要加对话框 |
| A3 | 实验性导航 | Figma 2026「experimental navigation」 | 可用性倒退；财务工具要确定性（原则 4） |
| A4 | 高饱和多巴胺 / Y2K 复古色 | Vistaprint Neon Shock 系 | 语义色域外高饱和违「数字是主角」；庆祝全站仅一次 |
| A5 | 全屏背景模糊半透明材质层 / 系统级半透明材质语言 | 2026 系统级新材质风格；Revolut 深色半透明面板（检索汇总口径） | 性能成本 + 顶栏三层材质已满载（global.css:147-285）+ 宪法「普通内容卡一律实底」 |
| A6 | 自托管可变字体 / 定制 display 字体 | Wise Sans 式定制字体姿态；Web Almanac 88% web 字体大盘 | 字体文件=门禁不可承受；字重动画违「数字不抖」（宪法原则 1） |
| A7 | mesh gradient / 大彩渐变 | Stripe 营销页手法 | 与冷感人格冲突；渐变只保留既有材质层克制品 |
| A8 | 超大字 kinetic 排版 / 跑马灯 | 2026 趋势营销化侧 | 读数窗单处纪律；循环动效仅限状态窗口期（S9 口径） |
| A9 | 大行程磁吸 / 自定义光标 / 大范围视差 | Framer 磁吸强版 | 克制纪律 + 触屏无意义；微行程版见 §1 S12 |
| A10 | 撒花 / 粒子庆祝 | 行业文章 P 批判口径 | P5 已反采纳（research-design-language.md §4 #5），本轮趋势侧再确认不翻案 |
| A11 | 跨文档 View Transitions | Chromium MPA 特性 | 本项目 SPA 无 MPA 导航，无落点 |
| A12 | scroll hijacking / 全页叙事滚动 | agency 站风 | 与「每个数字都被认真对待」的确定性相抵触 |
| A13 | 深色高饱和盘整体迁移 | ColorHunt Plum Noir 系 / Revolut dark-first | 「越高越亮」明度差体系推倒重来，回归风险不可承受 |

---

## 附录 A 检索与数据来源（本会话实跑）

**WebSearch 13 组查询词**：2026 UI design trends web interfaces；2026 color trends web design palettes；typography trends 2026 web design oversized numerals monospace；Linear app design analysis dark theme monospace typography 2025；Pantone color of the year 2026 Cloud Dancer Transformative Teal；godly.website Land-book UI inspiration gallery minimal dashboards 2026；motion design trends 2026 web native CSS animations view transitions；Wise Revolut fintech app UI design 2025 dashboard dark；font pairing study 2190 websites monospace grotesk third accent font；serif headlines trend 2026 UI ledger numerals fintech；Web Almanac 2025 fonts chapter variable fonts usage；Arc browser development paused Dia Browser Company 2025；"State of Web Animation" 2026 CSS transitions percentage JS animation library。

**MDN BCD 官方数据接口**（`bcd.developer.mozilla.org/bcd/api/v0/current/{key}.json`，响应时间戳 2026-11-21T00:01:47Z，版本 8.1.10）：19 键——startViewTransition（Document/Element）、animation-timeline、starting-style、has、transition-behavior、interpolate-size、details-content、property、popover、text-wrap、font-variant-numeric、view-transition-name、oklch、animation-range、field-sizing、ScrollTimeline、easing-function（linear-function）、light-dark、transition-timing-function。

**主要引用源**：tubikstudio.com/blog/ui-design-trends-2026；muz.li/blog/font-pairings-2026；almanac.httparchive.org/en/2025/fonts；figma.com/resource-library/web-design-trends；vistaprint.com/hub/color-trends；adobe.com/express/learn/blog/color-of-year-trends；frontendhorizon.com（2026-04/06 两篇）；open-design.ai 与 designmd.dev（Linear 分析）；colorhunt.co/palettes/popular；godly.website / land-book.com（检索确认在役，未整页直读见附录 C）；browsercompany.substack.com/p/letter-to-arc-members-2025。

## 附录 B 校验记录（本会话实跑）

1. 基线核对：`node .tmp-research2/bcd-check.mjs`（19 键，脚本与逐键输出见会话记录；§0.4 全表数据出自此实跑）。
2. 体积实测：`node .tmp-research2/measure.mjs`（esbuild 0.25.12 minify + node:zlib gzip-9；19 文件逐段实测，合计 gzip 4,241B；逐段数值已回填 §1 各段规格行；仅 s8_tsx 段因 JSX 片段无法独立解析回退源文直压，已在段内标注）。
3. 门禁：`node scripts/check-size.mjs` → DIST_TOTAL_KB=1946 / WASM_MAX_KB=364，门禁通过（余量 ≈64KB）。
4. 仓库核对：`grep -n "wf-dur|wf-ease" src/styles/global.css`（令牌 :101-106）、`grep -n "prefers-reduced-motion"`（兜底块 :644/:657）、`grep -n "usePrefersReducedMotion|useAnimatedNumber" src/components/hooks.ts`（:162/:198）、`grep -rn "startViewTransition|animation-timeline|starting-style|view-transition|interpolate-size|details-content" src/`（0 命中=净新增）、`grep -n "wf-fall" src/styles/global.css`（:53/:310 双主题在位）。
5. P6 裁定核对：`docs/p6-spec.md` §2 附不采纳清单 12 项与 §3 视觉微调 7 项逐项实读；§1 各段状态列与 §2 状态列出此。
6. 行数与禁词：`wc -l docs/research-ui-trends.md` 与 13 禁词正则全文扫描在本会话交付前实跑，结果随工作流交付说明回传（不在本文回显数值以免自污染）。

## 附录 C 未验证清单（诚实声明）

1. godly.website / Land-book / Mobbin 站内样本未整页直读（Mobbin 需登录）；本轮以检索确认站点在役与定位，站点级趋势结论引用强度为检索口径。
2. Frontend Horizon 2026-06 统计（91.7% / 18.4%）为检索摘要口径，未读原文；仅用于趋势方向佐证，不用于精确论证。
3. §1 S11 的 Safari `counter(var())` 渲染未实机验证（P6 拒因 #9 自标同源）；S5 的 Firefox 159 SVG 元素 CSS transform 未实测。
4. S8 tsx 段（JSX 片段）esbuild 无法独立解析，体积为源文直压 gzip（minify 后会更低）；S16 仅 1 行 CSS，共享字典后增量趋近于零。
5. 各段合并入 global.css 后的实际增量未实测（共享压缩字典，只会低于逐段之和）。
6. 本文档为对既有 420 行草稿的换证重写：旧稿「Firefox 133+/159 检索口径」等版本号已按 BCD 实测修正（144/159），旧稿若干未验证项已收敛。
