# 设计体系升级规范（深浅色双主题版）

| 项 | 值 |
| --- | --- |
| 文档性质 | 可直接施工的设计体系规范（令牌 / 组件 / 动效 / 无障碍 / 双主题 / 实施计划） |
| 适用范围 | 本仓库前端界面（React 18 + TS strict，组件库为项目既有依赖，图表为 recharts） |
| 版本说明 | 本版在既有材质/动效体系（v1，已落地，见 §0）基础上整体升级：新增**深浅色双主题**（§2.11）、顶栏主题切换按钮（§3.7）、主题状态与持久化（§6.2）、图表主题取色（§8）。章节编号与 v1 保持一致，代码注释中对「设计规范 2.x / 第 4 节 / 第 8 节」的既有引用继续有效 |
| 命名约定 | 全部**新增**类名 `wf-` 前缀、CSS 变量 `--wf-` 前缀；文档与代码注释措辞保持中性。**豁免口径**：为覆写组件库所必需的既有标识符——类名（`.arco-*`）、组件库 CSS 变量（`--color-bg-popup` / `--primary-N` / `--border-radius-*` / `--color-bg-N` / `--color-text-N` / `--color-fill-N` / `--arcoblue-N` 等组件库样式表既有变量）、组件库深色机制的 DOM 属性名（`arco-theme`）、包导入名（`@arco-design/web-react` / `recharts` / `zustand`）及其导出标识符（如 `ConfigProvider`、`IconSunFill` / `IconMoonFill`）——不属新增标识符，不在中立性审计范围内；但散文叙述一律用「组件库」中性措辞，不出现来源品牌名、人名、版本号、机制俗称 |
| 读者 | 两个施工角色：**材质方**（令牌、表面材质、应用骨架、主题状态与联动）与**动效方**（组件动效与交互反馈），分工见 6.1 |

---

## 0. 现状基线（规范贴合的既有事实）

以下均为本仓库当前实现或本会话实测（命令/文件随行标注），规范在其上升级而非另起炉灶：

**已落地的 v1 体系（本次保持，不改架构）**

| 现状 | 位置 |
| --- | --- |
| 令牌区/材质区/动效区三区结构的 global.css；`:root` 静态默认值与 `THEME` 初始值一致防首帧闪变 | `src/styles/global.css:15-78`（令牌）、`126-219`（材质）、`221-376`（动效） |
| 动态层注入：App 在 `useEffect` 内将 `THEME` 全部令牌逐键写入 `document.documentElement.style`（弹层挂 body 下亦生效） | `src/App.tsx:44-77` |
| `MOTION_DURATIONS = { fast: 120, base: 240, slow: 360 }`；`THEME` 含材质/发丝线/阴影/曲线/焦点环令牌 | `src/data/defaults.ts:131-171` |
| `usePrefersReducedMotion` + `useAnimatedNumber`（rAF 渐近滚动、首值落值、reduced 直接落值）**均已实现** | `src/components/hooks.ts:100-180` |
| 输出卡 sticky 锚点 + IntersectionObserver 切 `.wf-is-stuck` | `src/components/BasicCalculator.tsx:50-68` |
| 图表入场动画已按慢档令牌启用（`isAnimationActive: !reducedMotion`、`animationDuration: MOTION_DURATIONS.slow`、`animationEasing: "ease-out"`） | `src/components/advanced/MonteCarloPanel.tsx:61-68` |
| 顶栏材质 `.wf-surface-topbar`、md+ sticky、`.wf-touch-target(-sm)` 点击区扩展、`.wf-pressable` 按压反馈、reduced-motion 兜底全停 | `src/styles/global.css:132-152, 226-356`、`src/App.tsx:99, 123`、`src/components/BasicCalculator.tsx:68, 151-157` |

**本次升级的出发点（缺口清单）**

| 缺口 | 位置 / 实测 |
| --- | --- |
| 全应用无主题状态、无 `data-theme` 属性、无深色令牌组：store 接口仅含计算输入与 `colorBlindFriendly` | `src/store/useCalculatorStore.ts:31-58`；`grep -rn "data-theme" src/` 0 命中（本会话实测） |
| 图表颜色硬编码浅色值：网格线 `#E5E6EB`、刻度 `#4E5969`、路径线 `THEME.primary` | `MonteCarloPanel.tsx:234, 238, 242, 57` |
| Select 选项示例文字硬编码 `#86909C`（弹层内，深色下不可读） | `src/components/advanced/RentalPanel.tsx:184, 204` |
| 大数字与语义色经 JS 直取 `THEME`（浅色常量），深色下不会切换 | `BasicCalculator.tsx:44-45, 86`；`RentalPanel.tsx:79` |
| `@supports not (backdrop-filter)` 实底回退硬编码浅色 | `src/styles/global.css:206-219` |
| `.wf-realtime` 底色引用 `rgb(var(--primary-1))`（浅蓝），深色下保持浅底、与深色正文字色冲突 | `src/styles/global.css:496-505` |
| 组件库深色机制：样式表深色规则**全部**挂在 `body[arco-theme='dark']`（74 处选择器实测）；深色语义变量 `--color-bg-1: #17171a` / `--color-bg-2: #232324` / `--color-bg-3..5: #2a2a2b / #313132 / #373739`、`--color-text-1..4: rgba(255,255,255,0.9/0.7/0.5/0.3)`、`--color-fill-1..4: rgba(255,255,255,0.04/0.08/0.12/0.16)`（组件库样式表 540-588 行实测） | 组件库样式表 |
| **关键冲突**：深色块内组件库把 `--primary-*` 重定义为自有默认蓝（`--primary-6: var(--arcoblue-6)`，样式表 376 行）；本仓库品牌色阶写在普通 `body` 选择器上（特异性 0,0,1），会被 `body[arco-theme='dark']`（特异性 0,1,1）**遮蔽**——不处理则深色下主按钮等主色控件变成组件库默认蓝 | `src/styles/global.css:86-101` vs 组件库样式表 376 行 |
| `ConfigProvider` 的 `theme` 属性类型为 `Record<string, any>`（令牌覆写记录），**不是明暗切换开关**；组件库 React 版的深色载体是 body 属性 | 组件库 `es/ConfigProvider/interface.d.ts:70, 176` 实测 |
| 图标可用性：组件库图标集含 `IconSunFill` 与 `IconMoonFill`（`icon/react-icon/` 目录实测）；small 圆形图标按钮本体 **28×28px** | 组件库样式表 2903-2912 行 |
| `theme-color` meta 已存在（浅色值） | `index.html:6` |
| 语言资源三份各 **260 键、键集完全一致**（本会话 Node 脚本比对）；`app.*` 组现有 8 键 | `src/i18n/locales/*.ts` |
| `colorBlindFriendly` 不持久化（每次访问从 false 起） | `src/store/useCalculatorStore.ts:69` |

---

## 1. 设计原则

1. **克制**：动效只服务「状态变化被感知」，不做纯装饰。任何新增动效必须能回答「用户不看它会损失什么信息」；同屏同时进行的动效不超过 2 个，入场动效只在首次出现时播放，不循环。主题切换的全局颜色过渡是唯一的「全局性」动效（§4 #15），其余动效均为局部。
2. **内容优先**：数字与结论是唯一主角。材质永远不能降低文字对比度——浅深两主题的所有承载文字的表面都须满足 5.3 的数值口径（深色以**常态合成底 ≥4.5:1、最不利透底 ≥3:1** 双口径验收，见 5.3）；装饰性元素（50 条抽样路径线）透明度上限维持现状 0.12。
3. **清晰的视觉层级**：三层表面材质（顶栏 → 悬浮输出卡 → 浮层）在**两套主题内**都以「模糊半径、不透明度、阴影层级」三个维度同时拉开，任一层单独截图仍可辨认其所处层级；普通内容卡片保持实底不参与材质。深色下层级主要靠**表面明度差 + 阴影加重**辨认（深色下阴影感知更弱，故阴影档差比浅色更大，见 2.11）。
4. **一致且可预期**：同类交互只有一种反馈（按压 = 缩放 + 透明度；聚焦 = 焦点环；悬浮 = 阴影升档）；同名令牌值在同一主题内全站唯一，禁止在组件里写裸时长/曲线/颜色字面量（§9 #4 的扫描口径）。深浅两主题共享同一套**令牌名**，只换**值**——组件代码不感知主题（JS 取色一律经解析函数，见 8）。

---

## 2. 设计令牌

### 2.1 令牌组织（静态层 + 动态层 + 主题组）

- **静态层**：纯设计常量（间距、圆角、字阶、动效时长与曲线、顶栏几何），定义在 global.css `:root`，与主题无关，两主题共用，清单见 2.10。
- **动态层（主题组）**：随主题切换的令牌（页面底色、文字分级色、三层材质底色、发丝线、阴影、焦点环、语义色、图表网格线/刻度色、着色底）。**同一组键名两份值**：`THEME`（浅色，即现状对象扩展）与 `THEME_DARK`（深色镜像，同一 `ThemeTokens` 接口），收敛在 `defaults.ts`（6.2）。
- **注入机制不变**：App 在 `useEffect` 内按「当前主题 + 色盲友好开关」经 `resolveThemeTokens(theme, colorBlindFriendly)` 取组，逐键 `setProperty` 写 `documentElement`（弹层挂 body 下亦生效，机制现状保留）。
- **CSS 分组镜像**：global.css 以 `:root`（浅色静态默认值）+ `[data-theme="dark"]`（深色覆盖组）两块变量组承载**同一份数据**，用于首帧（React 注水前的 stylesheet 即时生效）。三者一致性纪律：`:root` 块 ≡ `THEME`、`[data-theme="dark"]` 块 ≡ `THEME_DARK`（与 v1「:root 与 THEME 初始值一致」同一防闪变纪律，验收 §9 #8）。
- `[data-theme="dark"]` 属性挂在 `documentElement` 上，取值 `"light" | "dark"`，**两值恒置**（显式可查，浅色规则不依赖该值，深色块靠属性命中）。

### 2.2 色彩令牌（浅色沿用现状，不变更任何值）

| 令牌 | 浅色值 | 说明 |
| --- | --- | --- |
| `--wf-primary` | `#4A6FA5` | `THEME.primary`；**深色组取提亮变体 `#7B9FD1`**（2.11），按钮底色不受影响（组件库色阶恒定，见 2.11 末条） |
| `--wf-text` | `#1D2129` | 正文；禁用纯黑；深色组 `#F2F3F5`（禁用纯白） |
| `--wf-rise` / `--wf-fall` | `#00B42A` / `#F53F3F` | 浅色语义色，不变；深色组 2.11 |
| `--wf-rise` / `--wf-fall`（色盲友好档） | `#0072B2` / `#E69F00` | 浅色色盲友好替代色板（蓝/橙），不变；深色组 2.11 |
| 页面底色 `--wf-bg-page`（新增） | `#f7f8fa` | 现状 `global.css:121` 的硬编码提为令牌；深色组 `#17171A`（与组件库深色 `--color-bg-1` 同值，实底表面层叠口径一致） |
| 次级文字 `--wf-text-secondary` | `#646E7A` | 字段提示等；**浅色改值登记（2026-11-19，依据 design-research §2.2 差距 A1）**：原值 `#86909C` 对白实测 3.24:1，承载 12px 正文级文本不达 4.5 口径，改值后白 5.18:1 / 卡合成 5.10:1 / 实时区着色底 4.66:1，全场景 ≥4.5（同冷灰蓝色相）；改值前后数值登记见 5.3。深色组 `#A9AEB8` 不动 |
| 三级文字 `--wf-text-tertiary` | `#4E5969` | 图表刻度等（同上转入主题组）；深色组 `#8F95A0` |
| 组件库主色阶 | body 上 `--primary-1..10` 同构覆盖 | 现状机制保留；深色下**必须在 `[data-theme="dark"] body` 重声明同值色阶**（2.11 关键冲突条），主按钮白字对比 5.11:1（本会话实测）两主题恒定 |

### 2.3 间距尺度（8pt 网格，两主题共用，现状不变）

```css
:root {
  --wf-space-1: 4px;   /* 半档：密集表单标签与控件的行距 */
  --wf-space-2: 8px;   --wf-space-3: 12px; --wf-space-4: 16px;
  --wf-space-5: 24px;  --wf-space-6: 32px; --wf-space-7: 48px;
}
```

存量 6px / 10px 间距默认不动；新增样式必须取自该尺度（v1 口径照旧）。

### 2.4 圆角尺度（两主题共用，现状不变）

```css
:root {
  --wf-radius-s: 6px; --wf-radius-m: 10px; --wf-radius-l: 14px; --wf-radius-full: 9999px;
}
```

组件库控件圆角经 `body { --border-radius-small/medium/large }` 对齐（现状保留，不受主题影响——组件库深色块未重定义这三个变量，样式表实测）。

### 2.5 字阶（两主题共用，现状不变）

```css
:root {
  --wf-text-xs: 12px; --wf-text-sm: 13px; --wf-text-md: 14px; --wf-text-lg: 16px; --wf-text-num: 32px;
}
@media (min-width: 768px) { :root { --wf-text-num: 40px; } }
```

### 2.6 三层表面材质（浅色现状 + 深色调校）

材质构成四要素固定：**半透明底色 → backdrop-filter（模糊 + 提饱和）→ 1px 发丝线描边 → 阴影令牌**。模糊半径是层级语义，**两主题取值一致**；半透明底色、发丝线、阴影按主题调校。**底色透明度不是自由参数**：先过 5.3 对比度口径再定值。

| 层 | 浅色（现状，不变） | 深色（本次定值） |
| --- | --- | --- |
| L1 顶栏 | `rgba(74,111,165,0.95)`，`saturate(1.6) blur(16px)`，底边发丝线 `rgba(255,255,255,0.16)`，无阴影 | `rgba(23,23,26,0.88)`，`saturate(1.6) blur(16px)`，底边发丝线 `rgba(255,255,255,0.12)`，无阴影 |
| L2 悬浮输出卡 | `rgba(255,255,255,0.72)`，`saturate(1.4) blur(20px)`，四边 `rgba(29,33,41,0.08)`，`--wf-shadow-2`（stuck 时 3） | **`rgba(35,35,36,0.92)`**，`saturate(1.4) blur(20px)`，四边 `rgba(255,255,255,0.10)`，`--wf-shadow-2`（stuck 时 3） |
| L3 浮层 | `rgba(255,255,255,0.86)`，`saturate(1.4) blur(24px)`，四边 `rgba(29,33,41,0.10)`，`--wf-shadow-3` | `rgba(35,35,36,0.95)`，`saturate(1.4) blur(24px)`，四边 `rgba(255,255,255,0.14)`，`--wf-shadow-3` |
| 即时提示 | `rgba(29,33,41,0.88)`，`blur(8px)`，四边 `rgba(255,255,255,0.12)`，`--wf-shadow-1` | `rgba(84,86,90,0.92)`，`blur(8px)`，四边 `rgba(255,255,255,0.12)`，`--wf-shadow-1`（比底色提亮一档，保持「提示浮于一切」的反转层级） |

深色定值依据（全部本会话 WCAG 实测，公式与完整数值见 5.3）：

- **L2 深色 0.92**：深色半透明材质必须按「最不利透底 = 纯白内容滚过卡下」定透明度。0.92 时最不利合成色 `rgb(53,53,54)`，正文 `#F2F3F5` 上 11.10:1；常态合成 `rgb(34,34,35)` 上 14.31:1。低透明度档（如 0.72）最不利合成会亮到 `rgb(97,97,97)` 一带，浅色文字跌破 4.5:1——**深色透明度按最不利口径锁定 0.92，禁止为通透感回调**。
- **L1 深色 0.88**：纯白文字最不利合成 `rgb(51,51,53)` 上 12.63:1，余量充足。
- 即时提示底色比页面/浮层**提亮**而非压暗：深色下再叠暗层会失去「浮于一切」的层级信号，与浅色下「深色提示浮于浅色页面」的同一语义对偶。

实底回退（`@supports not ((backdrop-filter) or (-webkit-backdrop-filter))`）补深色分支：L1 → `#17171A`、L2/L3 → `#232324`、即时提示 → `#54565A`（浅色分支现状值不变）。回退后只失去通透感，层级语义（描边 + 阴影）仍在。

### 2.7 阴影层级（浅色现状不变，深色加重）

```css
/* 浅色（现状值不变） */
--wf-shadow-1: 0 1px 2px rgba(29,33,41,0.06);
--wf-shadow-2: 0 2px 6px rgba(29,33,41,0.08), 0 8px 24px rgba(29,33,41,0.08);
--wf-shadow-3: 0 4px 12px rgba(29,33,41,0.10), 0 16px 40px rgba(29,33,41,0.12);
/* 深色：黑基阴影、档差加大（深色下阴影感知更弱，是层级的主要载体之一） */
--wf-shadow-1: 0 1px 2px rgba(0,0,0,0.40);
--wf-shadow-2: 0 2px 6px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.45);
--wf-shadow-3: 0 4px 12px rgba(0,0,0,0.50), 0 16px 40px rgba(0,0,0,0.60);
```

### 2.8 焦点环（按表面二选一，深色组反转）

```css
/* 浅色（现状值不变） */
--wf-focus-ring:      0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px var(--wf-primary, #4A6FA5);
--wf-focus-ring-dark: 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(29,33,41,0.9);
/* 深色：内圈改深色晕、外圈改提亮主色（页面底实测 6.58:1 ≥ 3:1 非文本指示器口径） */
--wf-focus-ring:      0 0 0 2px rgba(23,23,26,0.9), 0 0 0 4px var(--wf-primary, #7B9FD1);
--wf-focus-ring-dark: 同 --wf-focus-ring（深色顶栏已是暗色半透明材质，不再有「主色表面」场景，两变体同值）
```

用法口径不变：`:focus-visible` 才出环；L1 顶栏内控件用 `-dark` 变体，其余表面用默认环（深色下两变体同值，规则照写，保持结构对偶）。

### 2.9 动效令牌（两主题共用，现状不变）

```css
:root {
  --wf-dur-fast: 120ms;  --wf-dur-base: 240ms;  --wf-dur-slow: 360ms;
  --wf-ease-standard:   cubic-bezier(0.2, 0, 0, 1);        /* 标准：默认，一切常规过渡 */
  --wf-ease-emphasis:   cubic-bezier(0.34, 1.26, 0.44, 1); /* 强调：轻微过冲后收敛，仅位移/缩放入场 */
  --wf-ease-asymptotic: cubic-bezier(0.16, 1, 0.3, 1);     /* 数值渐近：数值滚动与图表入场 */
}
```

JS 侧数值常量 `MOTION_DURATIONS = { fast: 120, base: 240, slow: 360 }` 现状保留（`defaults.ts:132`）。适用面与禁止项见第 4 节。

### 2.10 `:root` 静态默认值全量清单（浅色 ≡ `THEME`，施工可直接粘贴）

```css
:root {
  /* —— 间距（8pt） —— */
  --wf-space-1: 4px;  --wf-space-2: 8px;  --wf-space-3: 12px;
  --wf-space-4: 16px; --wf-space-5: 24px; --wf-space-6: 32px; --wf-space-7: 48px;

  /* —— 圆角 —— */
  --wf-radius-s: 6px; --wf-radius-m: 10px; --wf-radius-l: 14px; --wf-radius-full: 9999px;

  /* —— 字阶 —— */
  --wf-text-xs: 12px; --wf-text-sm: 13px; --wf-text-md: 14px; --wf-text-lg: 16px; --wf-text-num: 32px;

  /* —— 文字色（主题组） —— */
  --wf-text: #1D2129;
  --wf-text-secondary: #646E7A;
  --wf-text-tertiary: #4E5969;

  /* —— 色彩（主题组） —— */
  --wf-primary: #4A6FA5;
  --wf-rise: #00B42A;  --wf-fall: #F53F3F;

  /* —— 页面底色 / 着色底（主题组，新增令牌） —— */
  --wf-bg-page: #f7f8fa;                    /* body 背景改挂此变量（现硬编码于 global.css:121） */
  --wf-tint-bg: rgba(74,111,165,0.08);      /* 实时区着色底（替换 .wf-realtime 对 --primary-1 的依赖） */

  /* —— 图表（主题组，新增令牌） —— */
  --wf-chart-grid: #E5E6EB;                 /* 蒙特卡洛网格线（现硬编码于 MonteCarloPanel.tsx:234） */
  --wf-chart-tick: #4E5969;                 /* 蒙特卡洛刻度文字（现硬编码于同文件 238/242 行；与三级文字同值但令牌解耦） */

  /* —— 发丝线：主题组三键（现状值不变，经 ThemeTokens 注入） —— */
  --wf-hairline-card: rgba(29,33,41,0.08);
  --wf-hairline-overlay: rgba(29,33,41,0.10);
  --wf-hairline-topbar: rgba(255,255,255,0.16);
  /* —— 发丝线：静态承载两键（不入主题对账，口径见 §9 #8） —— */
  --wf-hairline-dark: rgba(29,33,41,0.06);       /* 预留令牌：全仓零使用（评审实测，仅定义于 global.css:43）；启用时须按主题组流程同步扩 ThemeTokens */
  --wf-hairline-tooltip: rgba(255,255,255,0.12); /* 两主题同值（2.6），静态承载 */

  /* —— 材质（主题组，现状值不变） —— */
  --wf-surface-topbar-bg: rgba(74,111,165,0.95);
  --wf-surface-topbar-blur: saturate(1.6) blur(16px);
  --wf-surface-card-bg: rgba(255,255,255,0.72);
  --wf-surface-card-blur: saturate(1.4) blur(20px);
  --wf-surface-overlay-bg: rgba(255,255,255,0.86);
  --wf-surface-overlay-blur: saturate(1.4) blur(24px);
  --wf-surface-tooltip-bg: rgba(29,33,41,0.88);
  --wf-surface-tooltip-blur: blur(8px);

  /* —— 顶栏几何（静态） —— */
  --wf-topbar-h: 56px;

  /* —— 阴影 / 焦点环（主题组，现状值不变） —— */
  --wf-shadow-1: 0 1px 2px rgba(29,33,41,0.06);
  --wf-shadow-2: 0 2px 6px rgba(29,33,41,0.08), 0 8px 24px rgba(29,33,41,0.08);
  --wf-shadow-3: 0 4px 12px rgba(29,33,41,0.10), 0 16px 40px rgba(29,33,41,0.12);
  --wf-focus-ring: 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px var(--wf-primary, #4A6FA5);
  --wf-focus-ring-dark: 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(29,33,41,0.9);

  /* —— 动效（静态，现状值不变） —— */
  --wf-dur-fast: 120ms; --wf-dur-base: 240ms; --wf-dur-slow: 360ms;
  --wf-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --wf-ease-emphasis: cubic-bezier(0.34, 1.26, 0.44, 1);
  --wf-ease-asymptotic: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 2.11 双主题组织与深色令牌全量清单（`[data-theme="dark"]` ≡ `THEME_DARK`，施工可直接粘贴）

**机制**（三件事，缺一不可）：

1. **CSS 分组**：global.css 新增深色覆盖区——`:root[data-theme="dark"]`（特异性 0,2,0，压过 `:root` 的 0,1,0）承载下表全部 `--wf-*` 深色值；**首帧即生效**（React 注水前的守卫脚本已置属性，见 6.2 #6）。
2. **运行时注入**：App effect 按 `resolveThemeTokens(theme, colorBlindFriendly)` 把当前组的同键值写入 `documentElement` 内联样式（与浅色机制同一条管线；内联样式优先级高于任何样式表规则，注水前后值一致，无二次闪变）。
3. **组件库联动**：`document.body` 上设置/更新 `arco-theme` 属性（`"light" / "dark"` 恒置）——组件库样式表全部深色规则挂 `body[arco-theme='dark']`（样式表 540-588 行等 74 处实测），这是组件库 React 版深色的**唯一官方载体**；`ConfigProvider` 不参与明暗切换（其 `theme` 属性是令牌覆写记录类型，实测非切换开关）。

**`documentElement` 上的深色令牌组**（`:root[data-theme="dark"]`；键名与 `THEME_DARK` 一一对应）：

```css
:root[data-theme="dark"] {
  /* —— 文字分级（实测：常态合成卡底 / 最不利透底） —— */
  --wf-text: #F2F3F5;            /* 14.31:1 / 11.10:1 */
  --wf-text-secondary: #A9AEB8;  /* 7.14:1 / 5.54:1 */
  --wf-text-tertiary: #8F95A0;   /* 卡底 5.28:1（刻度文字位于卡面，无透底场景） */

  /* —— 色彩 —— */
  --wf-primary: #7B9FD1;         /* 提亮主色：卡底 5.84:1、最不利 4.53:1（大数字/焦点环/悬浮反馈用） */

  /* —— 语义色（深色版，常态 ≥4.5、最不利 ≥4.5 全达标；色盲友好档深色值见块后注） —— */
  --wf-rise: #27C346;            /* 6.79:1 / 5.27:1 */
  --wf-fall: #F98D86;            /* 6.95:1 / 5.39:1（浅色 #F53F3F 对白 3.71:1，现状冻结、显式豁免 4.5 口径，见 5.3） */

  /* —— 页面底色 / 着色底 —— */
  --wf-bg-page: #17171A;                      /* 与组件库深色 --color-bg-1 同值 */
  --wf-tint-bg: rgba(123,159,209,0.12);       /* 合成 rgb(45,49,56)：正文 11.77:1、涨色 5.59:1、跌色 5.71:1 */

  /* —— 图表 —— */
  --wf-chart-grid: #3D3F46;      /* 与合成卡底 1.51:1（浅色网格 1.23:1，深色略提以保证可感知） */
  --wf-chart-tick: #8F95A0;

  /* —— 发丝线（主题组三键；hairline-dark 为零使用预留、hairline-tooltip 两主题同值，
        两键均静态承载、不入深色块与对账，口径见 §9 #8） —— */
  --wf-hairline-card: rgba(255,255,255,0.10);
  --wf-hairline-overlay: rgba(255,255,255,0.14);
  --wf-hairline-topbar: rgba(255,255,255,0.12);

  /* —— 材质（2.6 定值依据） —— */
  --wf-surface-topbar-bg: rgba(23,23,26,0.88);
  --wf-surface-topbar-blur: saturate(1.6) blur(16px);
  --wf-surface-card-bg: rgba(35,35,36,0.92);
  --wf-surface-card-blur: saturate(1.4) blur(20px);
  --wf-surface-overlay-bg: rgba(35,35,36,0.95);
  --wf-surface-overlay-blur: saturate(1.4) blur(24px);
  --wf-surface-tooltip-bg: rgba(84,86,90,0.92);
  --wf-surface-tooltip-blur: blur(8px);

  /* —— 阴影（2.7 深色组） —— */
  --wf-shadow-1: 0 1px 2px rgba(0,0,0,0.40);
  --wf-shadow-2: 0 2px 6px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.45);
  --wf-shadow-3: 0 4px 12px rgba(0,0,0,0.50), 0 16px 40px rgba(0,0,0,0.60);

  /* —— 焦点环（2.8 深色组） —— */
  --wf-focus-ring: 0 0 0 2px rgba(23,23,26,0.9), 0 0 0 4px #7B9FD1;
  --wf-focus-ring-dark: 0 0 0 2px rgba(23,23,26,0.9), 0 0 0 4px #7B9FD1;
}
```

> 注：色盲友好替代色板（蓝/橙）的深色值为 `#56B4E9`（涨，实测 6.88:1 / 最不利 5.34:1）与 `#E69F00`（跌，实测 7.05:1 / 最不利 5.47:1，与浅色同值）。它们**不设独立 CSS 变量名**：实现中即 `THEME_DARK.riseColorBlind / fallColorBlind`，经注入复用 `--wf-rise / --wf-fall` 键位按开关取值（与浅色机制同构）。

**组件库联动专项**（global.css 深色覆盖区内、`[data-theme="dark"] body` 选择器）：

```css
[data-theme="dark"] body {
  /* 品牌主色阶重声明：与浅色 body 块同值（品牌色两主题恒定）。
     必须重声明的实测依据：组件库深色块把 --primary-* 重定义为自有默认蓝
     （样式表 376 行），特异性 0,1,1 压过浅色覆盖块所在的普通 body（0,0,1）；
     本选择器同为 0,1,1 且导入在后（main.tsx:19-20 顺序现状），级联胜出。
     效果：主按钮白字对比 5.11:1 两主题恒定。 */
  --primary-1: 240, 243, 248;  /* …至… */ --primary-10: 29, 44, 68;
}
```

`--color-bg-popup` 深色解析：本仓库浅色块已把它指向 `var(--wf-surface-overlay-bg)`（global.css:109）；组件库深色块**未**重定义该变量（540-588 行实测无此键），该引用随注入自动切换为深色浮层底——**无需**深色重声明，但列入验收 §9 #8 逐项核对。普通卡片/折叠面板/表格等实底组件底色走组件库 `--color-bg-*` 变量（如卡片 `background: var(--color-bg-2)`，样式表 3563 行实测），深色属性生效后自动切换，无需本仓库规则。

**主题状态与持久化**（规范定夺，见 6.2 #7 的完整状态设计）：

- 存储键 `wf-theme`（localStorage），值 `"light" | "dark"`。
- **两态 + 系统初始值**：store 状态为已解析结果态 `theme: "light" | "dark"`；初始值 = 存储值 → 无存储时取 `matchMedia("(prefers-color-scheme: dark)")` 一次。**取舍写明**：不做 `"system"` 三态，代价是应用运行期间操作系统级主题切换不跟随（无监听）；收益是解析态恒定（图表取色、按钮图标、aria 标签全部单值判定）、按钮语义二元无歧义。首次访问「跟随系统」，用户**显式切换过一次**后存储值优先于系统（此后不再跟随）。
- 只有显式切换动作写 localStorage；系统推导出的初始值**不落盘**——未做选择前每次访问仍跟随系统。

**切换过渡**（§4 #15）：主题切换时由 App effect 给 `documentElement` 挂 `.wf-theme-switching` 类、`MOTION_DURATIONS.base` 后移除；样式见动效区（6.2 #1）。减弱动效偏好下瞬时切换——由既有 reduced-motion 兜底块强制（切换规则**故意不写 `!important`**，使兜底块的 `transition-duration: 0.01ms !important` 能压过它，5.1 有详述）。

---

## 3. 组件规范

### 3.1 顶栏（L1 材质，双主题）

- 结构、md+ sticky、窄屏换行、44px 触控目标、纯白文字规则：**全部现状保留**（v1 已落地）。顶栏文字两主题一律纯白 `#FFFFFF`（浅色实测 4.64:1、深色最不利 12.63:1，均达标）。
- 深色顶栏为暗色半透明材质（`rgba(23,23,26,0.88)`）而非主色底：与深色页面同层融入，品牌主色只保留在浅色顶栏与两主题的强调元素上（克制）。品牌区图标与标题的 `color: #fff` 内联值两主题通用（`App.tsx:107-108` 现状，不改）。
- 新增主题切换按钮：见 3.7。

### 3.2 悬浮输出卡（L2 材质 + 悬浮行为，双主题）

- 载体、stuck 升档、锚点检测、窄屏行为：现状保留。
- 深色材质按 2.6：底色 `rgba(35,35,36,0.92)`、发丝线 `rgba(255,255,255,0.10)`、阴影档不变（值走深色组）。
- 卡内大数字颜色：现状 `style={{ color: THEME.primary }}` 为浅色常量（`BasicCalculator.tsx:86`）——改经主题解析取值（6.2 #9），深色下用提亮主色 `#7B9FD1`（5.84:1），浅色不变。

### 3.3 普通卡片（实底，双主题自动适配）

- 实底、`--wf-radius-m`、可选发丝线、无阴影、无材质：不变。底色由组件库 `--color-bg-2` 承载（浅 `#fff` / 深 `#232324` 自动），**本仓库零规则**；页面底色从 `#f7f8fa` 硬编码改挂 `--wf-bg-page`（6.2 #1）。深色下层叠对比 1.14:1（卡 vs 页），与浅色的 1.13:1 同级的「安静分层」。

### 3.4 输入控件与交互反馈（按压 / 聚焦 / 触控目标，现状保留）

统一反馈语义、`.wf-pressable`、焦点环双变体、折叠头按压全局选择器、触控目标媒体查询、`.wf-touch-target(-sm)`：全部现状保留（`global.css:226-311`）。深色下焦点环取深色组值（2.8），规则零改动。

### 3.5 浮层（L3 材质，双主题）

- 材质挂载点与过渡类覆盖：现状保留。深色浮层底 `rgba(35,35,36,0.95)`、发丝线 `rgba(255,255,255,0.14)`。
- 即时提示深色版：底 `rgba(84,86,90,0.92)`（比深色页面提亮一档的反转层级），白字最不利 5.97:1。
- 弹层底色变量解析与主色阶深色重声明：见 2.11 组件库联动专项。

### 3.6 窄屏适配（现状保留）

单列输入、卡片头部换行、摊销表横向滚动、Descriptions 纵向堆叠、44px 触控目标、大数字窄屏档 32px：全部不变。双主题不引入任何新的响应式规则；深色材质性能降档预案沿用 v1 口径（模糊可降、透明度不可降）。

**高级面板桌面档维持单列（裁定，验收 S3-4）**：高级面板各字段未显式传 `md={12}`（fields.tsx 默认 24 单列），1024 档实测字段单列纵排（各列 912px）——与响应研究 §10 矩阵「768+ 两列 md=12 生效」的记载不符，属研究记述与实现不一致，非规范违反。裁定**维持单列**：字段数 11–21 的面板单列纵向扫读路径与「决策流」字段顺序一致（p3-spec D10），两列化属产品级视觉变更、收益未经实测验证，不随本轮实施；后续若做两列化需重新走桌面档验收矩阵（research-responsive.md §10 已同步修正记述）。

### 3.7 主题切换按钮（新增）

- **位置**：顶栏工具组末尾（语言切换之后），与既有工具组间距一致（10px gap 现状）。
- **形态**：组件库 `Button`，`size="small"` + `shape="circle"` + 图标态（无文字）——本体实测 28×28px（样式表 2903-2912 行）。
- **图标语义（亮→暗对偶）**：当前深色时显示日形图标（`IconSunFill`，点击转浅色）；当前浅色时显示月形图标（`IconMoonFill`，点击转深色）。图标即「点击后到达的状态」。两图标均存在于组件库图标集（`icon/react-icon/` 实测）。图标切换**不做动画**（原则 1：不增加无信息动效；状态语义由图标形状承载）。
- **可达性**：`aria-label` 随状态切换（`app.themeToDark / app.themeToLight`，第 7 节）；同时把同一键用于 `title` 属性作悬停提示——不新增文案键。图标颜色 `#FFFFFF`（顶栏纯白规则一致）。
- **触控目标**：外包 `span.wf-touch-target`（既有点击区扩展：28px 本体 + 20px = 48px ≥ 44px）。**本体几何保护（评审修订）**：既有触控媒体查询（`global.css:264` 的 `.arco-btn { min-height: 44px }`）会压过组件库圆形按钮的 `height: 28px`（min-height 优先于 height）——触屏/窄屏上按钮将呈 28×44 椭圆。材质方须在该媒体查询内补豁免选择器：`.arco-btn-shape-circle.arco-btn-icon-only { min-height: 0; }`（特异性 0,2,0 压过 0,1,0；全仓现状无其他圆形按钮，评审实测 `grep shape="circle"` 0 命中），本体两主题、两端保持 28×28 圆形，命中区由包装层承担。
- **行为**：`onClick={toggleTheme}`（store 动作，6.2 #7）；按钮**挂 `.wf-pressable`**（按压反馈与焦点环规则的挂载点，6.2 #4）；键盘可达（原生 button 语义 + `:focus-visible` 焦点环走顶栏 `-dark` 变体，现状规则已覆盖 `.wf-header .wf-pressable:focus-visible`）。

---

## 4. 动效清单（逐元素）

时长/曲线只引用令牌；「触发」列全部为状态变化事件，无定时循环动效。#1–#14 为现状已落地项（登记以维持第 4 节编号引用有效），#15 为本次新增。

| # | 元素 | 动效属性 | 时长 | 曲线 | 触发 | 实现位置 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 临界值大数字（含同行「万」换算值） | 数值渐近滚动（JS rAF，文本插值） | `MOTION_DURATIONS.slow`（360ms） | 数值渐近（`1-(1-t)^3` 解析式） | 防抖重算结果更新 | `useAnimatedNumber`（已落地）+ `BasicCalculator.tsx` |
| 2 | 输出卡阴影 | `--wf-shadow-2` ⇄ `--wf-shadow-3` | `--wf-dur-base` | 标准 | sticky 激活/解除 | `BasicCalculator.tsx` + global.css |
| 3 | 折叠面板展开/收起 | height | `--wf-dur-base` | 标准 | 点击面板头 | global.css |
| 4 | 下拉面板入场 | 透明度 + translateY + scale | `--wf-dur-base` | 强调（位移/缩放）+ 标准（透明度） | 打开下拉 | global.css |
| 5 | 下拉退场 | 透明度 + transform 还原 | `--wf-dur-fast` | 标准 | 关闭下拉 | global.css |
| 6 | 按钮/开关/触发器按压（含主题切换按钮） | scale 0.98 + opacity 0.9 | `--wf-dur-fast` | 标准 | `:active` | global.css + 挂类 |
| 7 | 折叠面板头部按压 | opacity 0.85 | `--wf-dur-fast` | 标准 | `:active` | global.css |
| 8 | 键盘聚焦 | 焦点环出现（按表面选变体） | `--wf-dur-fast` | 标准 | `:focus-visible` | global.css |
| 9 | 输入框聚焦 | 描边聚焦态 + 外环 | `--wf-dur-base` | 标准 | 聚焦 | global.css |
| 10 | 单选圆点选中 | scale | `--wf-dur-fast` | 标准 | 选中切换 | global.css |
| 11 | 蒙特卡洛折线图入场 | 折线绘制 | `MOTION_DURATIONS.slow`（360ms） | 渐近族最近预设 `ease-out` | 「运行模拟」结果返回 | `MonteCarloPanel.tsx`（已落地） |
| 12 | 提示条进出场 | 透明度 + scale | `--wf-dur-base` / `--wf-dur-fast` | 标准 | 显隐切换 | global.css |
| 13 | 字段提示图标悬停 | 颜色 | `--wf-dur-base` | 标准 | hover | global.css |
| 14 | 实时区底色 | background-color | `--wf-dur-base` | 标准 | 输入变化 | global.css |
| 15 | **主题切换全局颜色过渡（本次新增）** | background-color / border-color / color / fill / stroke | `--wf-dur-base`（240ms，≤240ms 口径即取标准档） | 标准 | store `theme` 变更（App effect 挂 `.wf-theme-switching` 类，`MOTION_DURATIONS.base` 后移除；首挂载不触发） | global.css（样式）+ `App.tsx`（类与属性） |

**#15 样式（材质方，动效区）**——只声明颜色类属性的过渡。**行为边界（既定取舍）**：`transition-property` 是替换而非叠加——240ms 窗口内 `transform / opacity / box-shadow` 等其余属性（含 `.wf-pressable` 按压过渡、输出卡阴影升档过渡）会被本规则**临时替换为瞬时切换**，窗口结束即恢复；影响窗仅 240ms 且主题切换不与按压同帧发生，可接受，不做属性并集（复杂度不值）：

```css
.wf-theme-switching,
.wf-theme-switching *,
.wf-theme-switching *::before,
.wf-theme-switching *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: var(--wf-dur-base);
  transition-timing-function: var(--wf-ease-standard);
}
```

**禁止项**（原则 1 负面清单）：无循环/无限动画；数值文本不用强调曲线；颜色与透明度不用强调曲线；同一交互不叠加两种曲线；主题切换按钮图标切换不做动画（3.7）；主题过渡窗口内 transform/box-shadow 等非颜色属性为瞬时切换（#15 行为边界的既定取舍，不试图叠加过渡）。

---

## 5. 无障碍与降级

### 5.1 `prefers-reduced-motion` 全量降级（CSS + JS 双通道，现状保留并覆盖新增项）

- **CSS 通道**：既有兜底式全停块（`global.css:348-376`）不变，天然覆盖本次新增的 `.wf-theme-switching` 过渡（其规则**故意不写 `!important`**，兜底块的 `transition-duration: 0.01ms !important` 依级联压过它）——主题切换在减弱动效偏好下瞬时完成，无需任何 JS 判断。
- **JS 通道**：`usePrefersReducedMotion` 已落地；`useAnimatedNumber` 命中即直接落值；图表 `isAnimationActive: !reducedMotion`（现状）。本次新增动效（#15）无 JS 通道依赖。
- 验收口径：开启系统「减弱动态效果」后，切换主题颜色瞬时换装；滚动 + 连续输入无任何肉眼可见插值。

### 5.2 焦点可见性

现状规则保留（`:focus-visible` 才出环、按表面选变体）。深色下默认环外圈为提亮主色（页面底实测 6.58:1 ≥ 3:1 非文本指示器口径），顶栏内控件环与浅色同规则自动切换。

### 5.3 对比度（数值口径，双主题）

一律按 WCAG 相对亮度公式，以**半透明底与最不利透底（浅色取页面底与深墨、深色取页面底与纯白）的合成色**计算。以下全部为本会话 Node 脚本实测值：

**浅色（现状值，全部复测确认）**：顶栏白字（0.95 档合成）4.64:1（叠白最不利 4.62:1）；输出卡正文（0.72 档合成 `rgb(253,253,254)`）15.86:1；最不利透底（深墨滚过卡下合成 `rgb(192,193,195)`）8.94:1。

**浅色语义色显式豁免**（数值为本会话同公式复测；现状冻结，本次不动）：涨 `#00B42A` 对白 2.78:1、对输出卡合成底 2.73:1；跌 `#F53F3F` 对白 3.71:1、对卡合成底 3.64:1；色盲友好涨 `#0072B2` 对白 5.19:1（达标）、跌 `#E69F00` 对白 2.25:1。四处均以正文级文字出现（如 `BasicCalculator.tsx:221` 实时区粗体）却低于 4.5 口径——属现状冻结范围（色彩沿用为原始升级约束），按「现状豁免」显式登记而非假性达标；**深色组不豁免**（4.5 双口径强制，见下表）。

**浅色次级文字改值登记**（2026-11-19，依据 design-research §2.2 差距 A1/A5；改值属「显式登记改值」先例，非静默变更）：次级文字改值前 `#86909C` 对白 3.24:1（不达标，承载 12px 正文级文本）→ 改值后 `#646E7A`：白 5.18:1 / 卡合成 5.10:1 / 实时区着色底 4.66:1（达标），口径为「常态合成底 + 最不利透底」双口径。着色底对比度的合成基注明：载值 4.66:1 的合成基为「着色层叠纯白」（`rgba(74,111,165,0.08)` 叠 `#FFFFFF`）；按最不利口径「着色层叠卡合成底」（卡材质 0.72 白叠 `#f7f8fa`）复算 ≈ 4.6:1——两种口径均 ≥ 4.5，消除第三种复算歧义。深色值 `#A9AEB8`（常态 7.14:1 / 最不利 5.54:1）不动。仓库内旧值字面量共 3 处（`defaults.ts` THEME.textSecondary、`global.css` :root 静态默认值、`global.css` `.wf-field-tip` fallback）同批改值，两处初始值一致防首帧闪变。

**深色（本次定值全部实测）**：

| 项目 | 常态合成底 | 最不利透底 | 口径 |
| --- | --- | --- | --- |
| 正文 `#F2F3F5`（L2@0.92） | 14.31:1 | 11.10:1 | 正文 ≥4.5（常态与最不利双口径） |
| 次级文字 `#A9AEB8` | 7.14:1 | 5.54:1 | ≥4.5 双口径 |
| 三级文字/刻度 `#8F95A0` | 5.28:1（卡底） | —（刻度仅存在于卡面） | ≥4.5 常态 |
| 顶栏白字（L1@0.88） | ≥12.63:1 | — | ≥4.5 |
| 涨色 `#27C346` | 6.79:1 | 5.27:1 | ≥4.5 双口径（实时区着色底上 5.59:1） |
| 跌色 `#F98D86` | 6.95:1 | 5.39:1 | ≥4.5 双口径（着色底上 5.71:1；浅色跌色 #F53F3F 对白 3.71:1，现状冻结豁免） |
| 色盲友好涨 `#56B4E9` | 6.88:1 | 5.34:1 | ≥4.5 双口径 |
| 色盲友好跌 `#E69F00` | 7.05:1 | 5.47:1 | ≥4.5 双口径 |
| 提亮主色 `#7B9FD1`（大数字） | 5.84:1 | 4.53:1 | 大数字为 32/40px 大文本（≥3 即达标），按 ≥4.5 从严 |
| 即时提示白字 | 5.97:1（最不利透底） | — | ≥4.5 |
| 主按钮白字（主色阶恒定） | 5.11:1（两主题同值） | — | ≥4.5 |

正文文字禁止直接落在顶栏材质上（顶栏只放纯白文字）：两主题同规则。

### 5.4 读屏策略

- 大数字不引入 `aria-live`（现状口径不变）。
- sticky 锚点、材质层等纯视觉元素一律 `aria-hidden`（现状）。
- 主题切换按钮：`aria-label` 随状态给出**目标主题**（第 7 节两键）；`data-theme` 属性挂 documentElement，供读屏/测试环境探测当前主题。

### 5.5 主题切换的可达性（新增）

- 按钮为原生 button 语义，键盘 Tab 序位于工具组末位；Enter/Space 即切换（原生行为）。
- 切换后的状态变化不广播（无 `aria-live`）：主题是视觉偏好，读屏用户不依赖颜色感知内容，广播只会造成噪音；`aria-label` 已在切换前后正确描述目标态。

---

## 6. 实施计划

### 6.1 角色与文件所有权分界

| 角色 | 独占文件 | 职责 |
| --- | --- | --- |
| **材质方** | `src/styles/global.css`（令牌区/材质区/动效区/**新增深色覆盖区**）、`src/data/defaults.ts`、`src/data/types.ts`（`ThemeTokens` 扩展）、`src/App.tsx`（注入分组、主题属性联动、切换按钮、过渡类调度）、`src/main.tsx`（核查，预期零改动）、`index.html`（首帧守卫脚本）、**`src/store/useCalculatorStore.ts` 的主题状态与持久化**（按本规范分工划入材质方；该文件其余计算输入状态双方都不触碰） | 令牌双组、三层材质双主题、焦点环、按压/聚焦样式与全局过渡覆盖、主题状态定义、localStorage 持久化、`data-theme` / `arco-theme` 属性联动、组件库主色阶深色重声明、`.wf-theme-switching` 调度 |
| **动效方** | `src/components/hooks.ts`、`src/components/BasicCalculator.tsx`、`src/components/fields.tsx`、`src/components/advanced/*.tsx` | 组件内主题取色改造（经解析函数）、图表颜色令牌化、既有动效挂类的回归保持（本次预期以零新增挂类为主） |

- **共享契约**：令牌键名、类名、主题解析函数签名以第 2、3、4 节为准。材质方定义全部样式与状态；动效方只消费：`resolveThemeTokens`（取色）、`MOTION_DURATIONS`（时长）。**动效方不触碰 `.arco-*` 覆写、任何材质规则、主题状态与属性联动；材质方不触碰 `src/components/**` 的动效挂类结构（本次 v1 挂类已就位，动效方仅按 6.2 做取色行内改动）。**
- 双方都不改：`src/services/**`、`src/wasm/**`、`src/data` 其余文件、语言资源三份（第 7 节清单键除外）。

### 6.2 逐文件改动点

**材质方**

1. `src/styles/global.css` —— 四区结构（令牌区 / 材质区 / 深色覆盖区 / 动效区 + 既有布局修复区）：
   - **令牌区**：2.10 全量清单（新增 `--wf-bg-page / --wf-tint-bg / --wf-chart-grid / --wf-chart-tick`；`--wf-text / --wf-primary / --wf-rise / --wf-fall` 提升为主题组键）；`body` 背景改 `var(--wf-bg-page, #f7f8fa)`（现硬编码 `global.css:121`）；`.wf-realtime` 底色改 `var(--wf-tint-bg, rgba(74,111,165,0.08))`（解除对 `--primary-1` 的浅色依赖，现 `global.css:502`）；
   - **材质区**：三层材质规则零结构改动（值经令牌自动切换）；`@supports not` 回退块补深色分支（2.6 末条四色）；
   - **深色覆盖区（新增）**：2.11 全量深色块 + `[data-theme="dark"] body` 主色阶重声明 + 回退深色分支；深色块键集与 `THEME_DARK` 完全一致（验收 §9 #8）；
   - **动效区**：新增 `.wf-theme-switching` 过渡（§4 #15，不写 `!important`）；触控媒体查询内补圆形图标按钮 `min-height` 豁免（§3.7 本体几何保护）；其余现状保留。
2. `src/data/defaults.ts` ——
   - `THEME`（浅色组）扩展 6 个新键：`bgPage / textSecondary / textTertiary / tintBg / chartGrid / chartTick`（值即 2.10 对应行）；新增 `THEME_DARK: ThemeTokens`（深色组，值即 2.11 对应行；`MOTION_DURATIONS` 两主题共用不进组）；
   - 新增 `export const THEME_STORAGE_KEY = "wf-theme"`；
   - 新增 `readInitialTheme(): ThemeMode`（读 `localStorage[THEME_STORAGE_KEY]`，命中 `"light"/"dark"` 即用；否则 `matchMedia("(prefers-color-scheme: dark)")` 一次——与 index.html 守卫脚本同一判定顺序，两处保持同步，验收 §9 #8）；
   - 新增 `resolveThemeTokens(theme: ThemeMode, colorBlindFriendly: boolean): ThemeTokens`（选组 + 语义色按色盲友好开关替换；App 注入与组件取色统一入口，**全应用唯一的主题取色函数**）。
3. `src/data/types.ts` —— `ThemeTokens` 接口补上述 6 个新字段（TS strict 必要配套；该文件不在本次点名清单内，沿 v1 先例列入材质方）。
4. `src/App.tsx` —— 五处改动：
   - 注入 effect 改为按 `resolveThemeTokens(theme, colorBlindFriendly)` 取组注入（变量清单加入 6 个新键；依赖数组 `[theme, colorBlindFriendly]`）；
   - 同 effect 内联动属性：`documentElement.setAttribute("data-theme", theme)`、`document.body.setAttribute("arco-theme", theme)`（组件库深色载体，2.11）；
   - 同 effect 内更新 `theme-color` meta（`index.html:6` 已有浅色值）：深色时置 `THEME_DARK.bgPage`（`#17171A`），浅色恢复 `THEME.primary`（`#4A6FA5` 现状）；
   - `.wf-theme-switching` 调度：以 ref 记录是否首挂载（首挂载跳过）；主题变更帧先挂类、`window.setTimeout(() => 移除, MOTION_DURATIONS.base)`，timer 存 ref、重跑与卸载时清理；减弱动效偏好无需 JS 判断（5.1）；
   - 工具组末尾新增主题切换按钮（3.7：`Button size="small" shape="circle"` + `IconSunFill/IconMoonFill` 按状态、**挂 `.wf-pressable`**（按压反馈与 `.wf-header` 焦点环规则的挂载点）、`aria-label`/`title` 用 `t("app.themeToDark"/"app.themeToLight")`、外包 `span.wf-touch-target`、图标 `color: "#fff"`）。
5. `src/main.tsx` —— **预期零代码改动**；职责是核查与说明：`ConfigProvider` 仅承载语言包（现状），组件库深色联动由 body `arco-theme` 属性承载（2.11 的实测依据写在此处核查项）；导入顺序（组件库样式先于 global.css，`main.tsx:19-20`）复核，出问题归材质方处置。
6. `index.html` —— `body` 起始处、`#root` 之前插入**首帧守卫脚本**（防主题闪变；材质方自有文件）：

   ```html
   <script>
     (function () {
       try {
         var saved = localStorage.getItem("wf-theme");
         var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
         document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
         document.body.setAttribute("arco-theme", dark ? "dark" : "light");
       } catch (e) { /* 存储不可用时按浅色渲染，React 注水后由 App effect 兜底 */ }
     })();
   </script>
   ```

   判定顺序必须与 `readInitialTheme` 一致；脚本置于 body 内保证 `document.body` 已存在（`arco-theme` 属性挂 body）。
7. `src/store/useCalculatorStore.ts` —— 新增主题状态（材质方辖区，**不动任何计算输入状态**）：

   ```ts
   export type ThemeMode = "light" | "dark";
   // state:
   theme: readInitialTheme(),          // 两态 + 系统初始值（2.11 定夺；运行中不监听系统切换）
   setTheme: (theme: ThemeMode) => void,   // set + localStorage.setItem(THEME_STORAGE_KEY, theme)
   toggleTheme: () => void,            // 翻转 + 同上持久化
   ```

   **`resetAll` 不触碰 `theme`**（主题是 UI 偏好，不属于计算输入）。**事实澄清（评审修订）**：现状 `resetAll` **会**重置 `colorBlindFriendly: false`（`useCalculatorStore.ts:96` 实测）——本次仅明确 theme 豁免 `resetAll`；colorBlind 是否随之豁免属产品决策、不在本规范范围，施工者不得顺手改动现状行为。

**动效方**

8. `src/components/hooks.ts` —— **零改动**：`usePrefersReducedMotion` 与 `useAnimatedNumber` 已落地（`hooks.ts:100-180` 实测，含首值落值、reduced 短路、结束帧精确落值），本次仅登记为既有契约。
9. `src/components/BasicCalculator.tsx` —— 主题取色改造（结构/动效挂类/sticky 锚点全部现状保留）：
   - `THEME.primary` 直取（`:86` 大数字）与 `semanticRise/semanticFall`（`:44-45, :221`）改为 `resolveThemeTokens(theme, colorBlindFriendly)` 的对应字段（`theme` 从 store 取）；
   - 「万」换算行、乘数行、breakdown 无颜色直取，不动。
10. `src/components/fields.tsx` —— **零改动**：无颜色直取；错误态、聚焦外环均由样式层/组件库变量承载，深色自动适配。
11. `src/components/advanced/MonteCarloPanel.tsx` —— 图表颜色令牌化（动画 props 现状保留，§8）：
    - `CartesianGrid stroke`（`:234`）、两处 `XAxis/YAxis tick fill`（`:238, :242`）、路径线 `stroke`（`:57`）、中位数线/进度条颜色（`:58-59, :207`）全部改为 `resolveThemeTokens(theme, colorBlindFriendly)` 的 `chartGrid / chartTick / primary / rise|riseColorBlind / fall|fallColorBlind`；
    - 头部注释补一句主题取色口径（中性措辞），动画表述维持指向规范第 4 节 #11 与第 8 节。
12. `src/components/advanced/RentalPanel.tsx` —— Select 选项示例文字 `#86909C` 直取（`:184, :204`）改 `var(--wf-text-secondary)`（DOM 内联色用 CSS 变量引用，随主题自动切换；图表 SVG 属性才走解析函数，见 §8 口径）。
13. `src/components/advanced/ReversePanel.tsx`、`LoanPanel.tsx`、`TaxPanel.tsx`、`CurrencySection.tsx`、`src/components/AdvancedPanel.tsx` —— **零改动**（无颜色直取；`grep -rnE "#[0-9A-Fa-f]{6}"` 全组件树实测仅上述四处 + 顶栏两处纯白，本会话执行）。

### 6.3 施工顺序

1. 材质方：defaults.ts/types.ts（令牌双组 + 解析函数）→ global.css（令牌区/深色覆盖区/材质回退/动效区）→ index.html（守卫）→ store（主题状态）→ App.tsx（注入分组 + 属性联动 + 切换按钮 + 过渡调度）→ main.tsx 核查。此阶段完成即双主题端到端可用（组件库联动 + 图表除外）。
2. 动效方：BasicCalculator / RentalPanel / MonteCarloPanel 取色改造（顺序无关，可并行）。
3. 双方回归：第 9 节验收清单全项（深色下逐面板逐图表人工过一遍为 #8 的执行口径）。

---

## 7. 新增用户可见文案键清单

**仅 2 个新增键**（主题切换按钮 aria-label / title，两态各一）。三份语言资源 `260 → 262` 键，三份同步增加同一键，其余键**不增不删不改值**（`zh-Hant.ts` 头注声明的生成约定维持）。新增位置：`app` 组内、`colorBlindLabel` 与 `languageLabel` 之间。

| key | 简体中文（zh-CN） | 繁體中文（zh-Hant） | English |
| --- | --- | --- | --- |
| `app.themeToDark` | 切换到深色主题 | 切換到深色主題 | Switch to dark theme |
| `app.themeToLight` | 切换到浅色主题 | 切換到淺色主題 | Switch to light theme |

- 两键同时用于按钮的 `aria-label` 与 `title`（同一键复用，不产生额外键）；状态判定：当前浅色 → `themeToDark`，当前深色 → `themeToLight`（与 3.7 图标语义一致）。
- **繁体产出路径（评审澄清）**：`zh-Hant.ts` 头注引用的生成脚本 `gen-zhtw.mjs` **现不存在于仓库**（`scripts/` 实测仅 `check-size.mjs` 与 `deploy.sh`）。本次以**手工三份同步**执行：三份逐键补齐后，以键集一致性比对（§9 #3 口径，Node 脚本展平三份对象键集全等比对）作为施工后自检；若后续补交生成脚本，以 `zh-CN.ts` 为基准重跑覆盖繁体文件。
- 其余本次全部变化均为非文本 affordance（材质、令牌、属性联动、持久化），无其他新键；若施工中发现确需新键：三份同步 + 先回填本节再实施（v1 口径照旧）。

---

## 8. 蒙特卡洛图表：入场动画与主题取色

**入场动画（现状已落地，本次维持）**：`isAnimationActive` 按新动效令牌启用，入场约 360ms——`isAnimationActive: !reducedMotion`、`animationDuration: MOTION_DURATIONS.slow`（360ms）、`animationEasing: "ease-out"`（渐近曲线族的组件库最近预设；组件库 `animationEasing` 只接受 `'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'` 预设，不接受 CSS 贝塞尔串）。

**与旧约束的关系（结论不变，登记在案）**：现状关闭动画的历史原因是旧约束「动画/过渡一律 ≤200ms、无过冲」的一刀切口径。新体系**取代而非沿用**它：时长从单值上限升级为三档令牌，曲线从禁过冲升级为三族曲线 + 各自适用面。360ms 属慢档**显式放开**，只授予两个信息承载动效（图表入场、数值渐近滚动）；交互反馈仍是 120/240ms。图表用无过冲的渐近族，旧约束规避的过冲噪音不会出现；reduced-motion 下回到关闭状态，降级路径严格不劣于旧方案。

**主题取色（本次新增口径）**：图表颜色必须改从主题令牌取值，硬编码浅色值（网格 `#E5E6EB`、刻度 `#4E5969`、路径 `THEME.primary`）全部废除：

- **图表 SVG 属性（stroke / tick fill）经 `resolveThemeTokens` 取解析值**（store `theme` → `THEME_LIGHT/THEME_DARK` 组），不传 CSS `var()` 字符串——SVG 属性链路的解析行为不在本规范的验收可控面内，JS 解析值是确定性实现；主题切换即重渲染换色，入场动画不因颜色 prop 变化重放（动画由数据变化驱动）。
- **DOM 内联色（非 SVG）用 CSS 变量引用**（`var(--wf-text-secondary)` 等），随注入自动切换（RentalPanel 示例文字即此类）。
- 深色图表可读性定值（实测）：网格线 `#3D3F46` 对合成卡底 1.51:1（浅色 1.23:1，深色略提保证可感知；网格为装饰层，不设 4.5 口径）；刻度 `#8F95A0` 对卡底 5.28:1；中位数线/进度条走语义色深色组（5.3 表）。
- 50 条抽样路径线 `strokeOpacity` 维持 0.12（装饰层，原则 2），深色下不提透明度（提了会喧宾夺主，中位数线才是信息层）。

---

## 9. 验收清单

| # | 验收项 | 口径 |
| --- | --- | --- |
| 1 | 类型与构建 | `npm run build` 通过（含 tsc strict） |
| 2 | 命名审计 | 全部**新增**标识符 `wf-` / `--wf-` 前缀且中性；豁免口径见文首约定（`.arco-*` 类名、组件库 CSS 变量、`arco-theme` 属性名、包导入名）；文档与新增注释无来源品牌名/人名/机制俗称。**开工前置（评审新增）**：核对工作流命名门禁的词表与本文豁免条款**逐字一致**——新增代码必然原样包含既有机制标识符：`document.body.setAttribute("arco-theme", theme)`（App.tsx 与 index.html 守卫两处）、`[data-theme="dark"] body` 的 `--primary-1..10` 重声明、`IconSunFill / IconMoonFill` 导入（组件库深色的唯一官方载体，样式表 `body[arco-theme='dark']` 74 行命中、`--primary-6` 于 376 行被深色块重定义，无法改名绕开）；不一致先扩门禁白名单，不得由施工者改名适配 |
| 3 | 语言键 | 三份语言资源键集 262 键且完全一致；新增仅 `app.themeToDark / app.themeToLight` 且三份齐备 |
| 4 | 令牌一致性 | `grep -rnE '[0-9]+ms|cubic-bezier\(|#[0-9A-Fa-f]{3,8}' src/components` 施工后预期零命中（图表色全部改经解析函数、时长一律 `MOTION_DURATIONS`；顶栏纯白 `#fff` 在 App.tsx 不在扫描范围；本会话以现状树执行同命令验证模式有效——命中现状四处硬编码，见 §0 缺口清单） |
| 5 | reduced-motion | 开启后：CSS 过渡全停 + 数值不滚动 + 图表直接成图 + **主题切换瞬时完成**（双通道分别验证） |
| 6 | 触控目标 | 主题切换按钮命中区 48px ≥44（28px 本体 + `.wf-touch-target`；**触屏/窄屏下本体经豁免保持 28×28 圆形、不呈椭圆**，§3.7 几何保护）；既有触控项回归不变 |
| 7 | 窄屏回归 | 375px 无横向溢出；浅深两主题各过一遍现状行为（顶栏换行、卡片头部换行、摊销表横滚、Descriptions 堆叠） |
| 8 | 双主题一致性（三源对账） | **对账口径（键集范围，评审定稿）**：对账范围 = `ThemeTokens` 接口字段所映射的 CSS 变量——`:root` 中的主题组键 ≡ `THEME`、`[data-theme="dark"]` 中的同键 ≡ `THEME_DARK`、App 注入清单 = 同一键集；`:root` 另承载的**静态键不参与对账**：间距 7 键、圆角 4 键、字阶 5 键、`--wf-topbar-h`、`--wf-hairline-dark`（零使用预留）、`--wf-hairline-tooltip`（两主题同值静态承载）；守卫脚本判定顺序 ≡ `readInitialTheme`。深色下逐面板人工核查：三层材质、普通卡/折叠/表格/输入控件（组件库联动）、弹层材质与 `--color-bg-popup` 解析、Alert/Tooltip、摊销表——**深色可读性为本项的通过标准**（5.3 表逐行复核） |
| 9 | 主题持久化与优先级 | 无存储首访跟随系统（模拟系统深色 → 首屏深）；显式切换后刷新仍为所选（`wf-theme` 落盘）；系统再切换不再影响（优先级）；`resetAll` 不影响主题 |
| 10 | 主题切换过渡 | 切换全局颜色 240ms 标准曲线平滑换装（含图表线条 stroke 与组件库表面）；顶栏/按钮点击无 transform 类扰动；首挂载无过渡 |
| 11 | 组件库主色联动 | 深色下主按钮、Switch/Radio 选中态、Progress 等主色控件仍为本应用主色（非组件库默认蓝）；主按钮白字 5.11:1 |
| 12 | 图表双主题 | 浅深两主题下：网格线/刻度/路径/中位数/进度条全部随主题取值；入场动画 360ms 渐近、reduced 下关闭；50 条路径 `strokeOpacity` 0.12 不变 |
| 13 | 对比度复核 | 深色表（5.3）逐行按同公式复测（合成色口径）全部 ≥ 表中口径；浅色语义色按 5.3 豁免口径核对——数值如实登记、不作达标判定（若产品决定加深浅色语义色至 ≥4.5，须先回填 5.3 再实施） |
| 14 | 布局零回归 | v1 全部现状行为不变（sticky、锚点、按压、折叠反馈一致性） |
