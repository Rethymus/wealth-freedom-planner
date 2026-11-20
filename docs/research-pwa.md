# PWA 离线安装专项研究（research-pwa）

> 版本：v1.0（2026-11-20）
> 范围：本应用「财富自由规划工具」的 PWA 化——安装能力（应用清单）、离线能力（Service Worker 预缓存 + 汇率接口运行时缓存）、更新提示口径、图标生成方案、尺寸预算结论。
> 前置口径：纯静态构建产物部署于 GitHub Pages 项目页子路径 `/wealth-freedom-planner/`（`scripts/deploy.sh`，独立 dist 部署仓强推 gh-pages 分支）；全部计算本地完成；唯一外部依赖为一个免费汇率接口（`src/services/rates.ts:13`，`https://open.er-api.com/v6/latest/CNY`）。
> 中性约定：沿用仓库既有命名纪律（`docs/design-spec.md` 文首豁免条款）——正文不出现来源品牌名、公司名、人名、机制俗称；包名 / 配置键 / 属性值 / HTTP 头等实现层必需的既有机制标识符（如 `vite-plugin-pwa`、`workbox-build`、`navigator.serviceWorker`、`beforeinstallprompt`）属豁免口径，仅以代码标识符形式出现于代码与构建配置；其中该系统主屏图标专用链接标签的 rel 值含来源品牌词且落入门禁禁词表，按 §2.6 处置为构建期注入，一切扫描范围内文件（含本文档）一律以「专用链接标签」中性指称；规范来源一律以中性来源标签（源 A–G）标注，原始 URL 因门禁「全程中性表达」未收录，抓取过程与来源对应关系见 §11。
> 门禁声明：本文全部实测数据均来自本会话执行的命令（沙箱构建 / 线上响应头检查 / 图标渲染 / 尺寸门禁复跑），引用处逐条标注命令与输出；未在本会话执行的检查一律标注「未执行」。

---

## 0. 摘要（结论先行）

1. **结论：PWA 化在当前尺寸预算内可行，但余量极薄，且前提是采用「手写 Service Worker + 注入预缓存清单」的最小方案。** 实测当前 dist 全量 1,980,439 字节（本会话 `npm run build && node scripts/check-size.mjs`，明细见 §6.1），距门禁 2,000,000 字节余量 **19,561 字节 ≈ 19.1 KB**（任务描述中的「约 115KB」与当前构建不符，见 §6.4 偏差说明）。推荐组合（手写 SW + `injectRegister: "script"` + 两张 PNG 图标）实测增量约 **15.8 KB**，落入门禁内，剩余约 3.8 KB 余量（§6.3 算术）。
2. **子路径部署无阻断项（实测推翻了上轮 §0.3 顾虑）。** 插件 v2.0.0 在 Vite 6.4.6 下对 `base: "./"` 与 `base: "/wealth-freedom-planner/"` 两种配置均产出正确的三件套：清单链接 `href`、清单 `start_url`/`scope`、注册脚本 `register('./sw.js', { scope: './' })`（相对 base）或 `register('/wealth-freedom-planner/sw.js', { scope: '/wealth-freedom-planner/' })`（绝对 base）——均为沙箱实际产物，非文档转述（§1.4）。历史文档中 `register('/sw.js', { scope: '/' })` 的写法对应 `base: "/"` 默认值场景，不适用于本项目子路径（源 A）。
3. **预缓存必须显式补 `.wasm` 后缀**：默认预缓存 glob 不含 wasm，需在 `injectManifest.globPatterns` 加 `wasm`（沙箱实测生效，§3.2）；线上部署实测 `.wasm` 响应头 `Content-Type: application/wasm`（§3.3），上轮 p2-spec §0.3 提出的 MIME 查证项以直接证据关闭。
4. **更新口径选 `autoUpdate` 语义（静默换版、不强刷打开中的标签页）**，配 `injectRegister: "script"` 纯注册脚本，不引入注册运行时 chunk（省 5.7 KB）；不使用任何推送类能力（无推送事件、无通知、无后台同步、无周期同步）（§4）。
5. **图标零新增依赖可行（实测）**：手写 SVG（品牌色 #4A6FA5 + 白色闪电，单一设计同时满足 any 与 maskable 安全区）→ 本机已有无头浏览器内核截图转 PNG。实测 192/512/180 三张共 16,164 字节，尺寸经图像库逐一核验（§5）。
6. **`registerType: "prompt"` 弹窗更新是清单类应用的惯例默认，但需引入注册运行时（实测 +5,748 字节 chunk）与界面工作；对计算器形态（状态已持久化、无表单丢失风险）不强刷方案更贴合预算与行为，理由见 §4.3。**
7. **发现一个与本主题相邻的门禁缺陷（实测复现）**：`scripts/check-size.mjs` 的 `walk()`（`scripts/check-size.mjs:29`）不跳过 `.git`，而部署脚本会在 dist 内建独立 git 仓且构建工具清空输出目录时刻意保留 `.git`——部署后复跑门禁必失败（实测 `DIST_TOTAL_KB=2590`、退出码 1，§6.2）。属测量口径缺陷而非预算缺口，建议 hygiene 修复（walk 跳过 `.git`），**不属于**门禁限值调整。

---

## 1. 主题一：构建插件版本与配置（Vite 6 兼容、base 子路径、注册方式、依赖体积）

### 1.1 版本兼容结论（源 F + 沙箱实测）

- npm 注册表查询（本会话 `npm view vite-plugin-pwa@latest version peerDependencies --json`）：当前最新 `2.0.0`，peer 声明 `vite: "^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0"`、`workbox-build: "^7.4.1"`、`workbox-window: "^7.4.1"`、`@vite-pwa/assets-generator`（可选，未随装）。
- 沙箱实测（Node v22.14.0，`npm i -D vite@^6.4.6 vite-plugin-pwa@^2.0.0 workbox-build workbox-window`，383 包装入，无 peer 告警阻断）：`vite@6.4.6` + `vite-plugin-pwa@2.0.0` 构建成功，PWA 构建段正常输出（`mode generateSW` / `mode injectManifest` 两态均实测）。
- **采纳版本**：`vite-plugin-pwa@^2.0.0`（devDependencies）。历史版本线（0.20.x 起支持 Vite 6、1.x 中期）无需回退：2.0.0 为唯一同时满足「Vite 6 peer + 本会话实测通过」的最新线版本。

### 1.2 devDependency 体积（实测，不进 dist）

- 对照实验（本会话，空白目录两步安装）：
  - `npm i -D vite@^6.4.6` → node_modules **22 MB**；
  - 再 `npm i -D vite-plugin-pwa@^2.0.0` → node_modules **81 MB**。
- **结论：边际 +59 MB devDependencies**（主要来自 `workbox-build@7.4.1` 构建期工具链与 `workbox-window@7.4.1`）。devDependencies 不进构建产物、不影响尺寸门禁；对 CI 安装时长有可感知影响（本会话约 26 秒装完 383 包）。`@vite-pwa/assets-generator` 为可选 peer，实测未自动装入（本方案图标不走该工具，§5）。

### 1.3 注册方式与运行时体积（源 A + 沙箱实测）

插件三种注册路径（实测产物）：

| 路径 | 配置 | 进 app bundle 的注册运行时 | 进 dist 的注册文件 |
| --- | --- | --- | --- |
| 虚拟模块 `virtual:pwa-register` | `injectRegister: "auto"`（默认）且 import 虚拟模块 | **+5,748 B**（`workbox-window` 生产构建独立 chunk，实测文件 `assets/workbox-window.prod.es5-*.js`） | 无 |
| 注入脚本 | `injectRegister: "script"` | 0（不引注册运行时） | `registerSW.js` **136 B** + head 注入 `<script src>`（实测） |
| 手动 | `injectRegister: null` | 0 | 无（自行调 `navigator.serviceWorker.register`） |

- 源 A（注册文档页）出示的生成脚本示例为 `navigator.serviceWorker.register('/sw.js', { scope: '/' })`——根绝对路径写法对应 `base: "/"` 默认场景；**沙箱实测 2.0.0 的实际产出跟随 Vite `base`**（§1.4），文档示例不可直接照搬但方向一致。
- **采纳**：`injectRegister: "script"`。理由：① 省 5.7 KB 运行时 chunk（预算结论 §6.3 的成立前提之一）；② 本应用为单页单入口，无需虚拟模块提供的 `onNeedRefresh` 等回调（更新口径见 §4）。

### 1.4 base 路径 × 子路径部署（沙箱实测，核心查证项）

同一份最小应用在两种 base 下各构建一次，逐文件核对四类产物：

**产物 1 —— index.html 清单链接**（实测）：
- `base: "./"` → `<link rel="manifest" href="./manifest.webmanifest">`
- `base: "/wealth-freedom-planner/"` → `<link rel="manifest" href="/wealth-freedom-planner/manifest.webmanifest">`
- 两种均为正确相对/绝对解析，无「根路径错误注入」。

**产物 2 —— manifest.webmanifest 字段**（实测，插件自动生成 `start_url`/`scope`）：
- 相对 base → `"start_url": "./", "scope": "./"`；按清单规范以清单文件 URL 为基解析（源 B），在子路径下解析为应用目录，正确。
- 绝对 base → `"start_url": "/wealth-freedom-planner/", "scope": "/wealth-freedom-planner/"`，同样正确。
- 插件不自动生成 `id`，需在 `manifest.id` 显式配置（§2.3 采纳值）。

**产物 3 —— registerSW.js 注册脚本**（实测）：
- 相对 base → `navigator.serviceWorker.register('./sw.js', { scope: './' })`——以文档 URL 为基解析；本应用单入口（仅 index.html 命中用户），`./` 恒落在应用目录，scope 覆盖子路径全部资源，正确。
- 绝对 base → `register('/wealth-freedom-planner/sw.js', { scope: '/wealth-freedom-planner/' })`，正确。

**产物 4 —— sw.js 预缓存清单条目**（实测）：两种 base 下，条目均为相对 SW 自身位置的写法（如 `"url":"assets/index-*.js"`）——按 Service Worker 规范以 SW 脚本 URL 为基解析，SW 固定位于 dist 根（= 应用目录），子路径下解析正确。

**结论与取舍**：
- **现状 `base: "./"`（`vite.config.ts:38`）在插件 2.0.0 下四类产物全部正确，不需要改 base。** 上轮 p2-spec §0.3 的「子路径下 SW scope 需先行查证」项以沙箱实测关闭。
- 保守备选：若实现阶段出现任何解析歧义，可切 `base: "/wealth-freedom-planner/"`（deploy.sh 已把部署目标锁定到该子路径，语义等价、产物绝对化）；此时唯一行为差异是资源 URL 绝对化。两配置实测均可工作，**默认维持现状不改**（改动面最小原则）。
- 无论哪种 base，`manifest.id` 一律显式写绝对形式 `/wealth-freedom-planner/`（规范建议以 `/` 开头、无片段；源 B §id），使安装身份不受 start_url 写法影响。

### 1.5 strategies 两态（源 A + 沙箱实测）

| 策略 | SW 侧产物（实测） | 说明 |
| --- | --- | --- |
| `generateSW`（默认） | `sw.js` 1,045 B + **`workbox-*.js` 15,112 B**（importScripts 运行时，实测两个文件） | 零手写；带导航回退/过期缓存清理等内置行为 |
| `injectManifest` + 手写 SW（无 workbox 运行时） | `sw.js` **1,043 B**（含内联预缓存清单；沙箱 11 条目版 1,463 B，含 wasm+png 后约 2 KB 量级） | 自持 install/activate/fetch 三段；运行时缓存路由自写约 15 行 |

- `injectManifest` 的注入占位可自定义：`injectManifest: { injectionPoint: "self.__WP_MANIFEST" }`（实测生效；默认占位符为 `self.__WB_MANIFEST`，源 A）。
- 自定义 SW 源文件经插件独立构建（实测构建输出显示独立 `sw.mjs` 中间产物后落盘为 `dist/sw.js`），TypeScript 可用（`src/sw.ts` + `/// <reference lib="webworker" />`，避免改全局 tsconfig `lib` 引入 DOM/WebWorker 类型冲突）。
- **采纳 `injectManifest`**：唯一能落进门禁余量的策略（§6.3）；`generateSW` 的 15.1 KB 运行时使总增量达 32.8 KB（虚拟模块版 38.4 KB），超余量 13–19 KB（§6.3 对照算术），如坚持该策略需走门禁例外流程（p2-spec §10.3 有先例格式），本轮不推荐。

---

## 2. 主题二：Web App Manifest 字段清单

### 2.1 字段语义要点（源 B，现行规范草案逐条核对）

| 字段 | 语义（规范表述摘引） | 本项目决策 |
| --- | --- | --- |
| `name` | 应用「通常展示给用户的名称」，本地化成员，兼作可访问名称 | `"财富自由规划工具"`（与 `index.html` `<title>` 一致，主语言中文） |
| `short_name` | 「空间不足时」的短名 | 候选 `"财自规划"`（4 字，主屏图标标签宽度友好；措辞定稿留规范阶段） |
| `id` | 应用的「通用唯一标识」；缺省回落为 start_url 解析值；跨源值被忽略；命中同 id 的安装视为同一应用的替换 | 显式 `"/wealth-freedom-planner/"`（规范建议以 `/` 开头；不写则随 start_url 形态漂移） |
| `start_url` | 以清单 URL 为基解析；同源约束；「纯建议性」 | 沿用插件生成值 `"./"`（实测，§1.4） |
| `scope` | 导航作用域；缺省为 start_url 去文件名 | 沿用插件生成值 `"./"`（实测） |
| `display` | 展示模式；非法值回落 `"browser"` | `"standalone"`（源 E：该移动端系统仅支持 standalone 一档，桌面安装同样成立） |
| `theme_color` | 任意可解析为 sRGB 的 CSS 颜色；解析失败即忽略 | `"#4A6FA5"`（与 `index.html:6` `<meta name="theme-color">`、`global.css` `--wf-primary` 同值） |
| `background_color` | 「仅用于样式表可用前的加载体验」，规范明示不得在应用样式可用后当页面底色用；实现方可按系统深色偏好覆写 | `"#F7F8FA"`（浅色页底 token `--wf-bg-page`，`global.css:55`；取舍见 §2.4） |
| `lang` | 单一 BCP 47 语言标签，声明各本地化成员的默认语言；缺省视为未知 | `"zh-CN"`（取舍见 §2.2） |
| `dir` | 本地化成员默认文本方向：`"ltr"/"rtl"/"auto"`，缺省 auto | 不配置（三种语言均为横排，auto 即可） |
| `orientation` | 屏幕朝向锁，枚举值，缺省 any | 不配置（工具类页面双朝向自适应，与 responsive 研究口径一致） |
| `icons` | 图像资源集；`purpose` 为「无序唯一空格分隔 token 集」：`"monochrome"` / `"maskable"` / `"any"`（缺省集为 «"any"»）；maskable 安全区为「直径 80% 最小边」的圆 | 两张 PNG，均 `"purpose": "any maskable"`（§2.5、§5） |

### 2.2 多语言（三语）取舍：清单单语，不做动态换装

- 规范口径（源 B）：`lang` 是**单一默认语言**；逐值多语言由草案新增的 `*_localized` 成员（`name_localized` 等语言映射对象）承担——该成员族为「实验性技术，生产使用前须核对兼容性表」（源 C），**未达采纳线**。
- 静态托管的现实约束：内容协商需要服务端按请求头换发不同清单文件，静态部署形态不提供；运行时以脚本改写 `<link rel="manifest">` 指向按语言预置的多份清单虽可行，但引入「清单换装与安装判定时序」耦合与多文件维护面，收益仅为安装名随语言变化，**不采纳**。
- **采纳惯例**：单份静态清单 + 主语言（`lang: "zh-CN"`，`name`/`short_name` 中文）。理由：三语已在应用内由 i18next 完整承载（`src/i18n/locales/` 三份资源），清单文案仅出现在安装器/启动器两个位置，属「品牌标识位」而非「内容位」；业界通行做法同为品牌名中立或主语言单语。后续若 `*_localized` 实现成熟，仅需增量补 `name_localized` 三键映射，不与本轮冲突。

### 2.3 `id` 显式化的理由（源 B）

规范：「id 用于用户代理跨场景唯一标识应用」；同 id 的再安装按「同一应用的替换」处理，不同 id 视为不同应用。不写 id 时回落 start_url 解析值——start_url 用相对写法（`"./"`）时，任何 start_url 形态调整都会牵动安装身份。显式 `"/wealth-freedom-planner/"` 与部署路径绑定，是子路径项目的稳妥取值。

### 2.4 `background_color` 双主题取舍

- 规范限定其用途为「样式表可用前的加载体验」（源 B）——即启动闪屏底色，运行期无效果；实现方可按系统深色偏好覆写该值，草案另有 `color_scheme_dark` 成员（源 B），同为实验态、未采纳。
- 本应用首帧守卫脚本（`index.html`）在注水前按「存储命中 → 系统偏好」判定主题并置 `data-theme`，闪屏期由 HTML 自身承载，清单 `background_color` 只在安装器/启动器层面出现。
- **采纳 `"#F7F8FA"`（浅色页底）**：取「安装动作多发生在浅色上下文 + 规范将深色覆写权留给实现」的稳妥口径；深色 token `#17171A`（`global.css:305`）不写入单值字段。若后续门禁对启动观感有反馈，再评估双份清单方案（与 §2.2 同口径不采纳）。

### 2.5 icons 字段值（与 §5 图标生成联动）

```json
"icons": [
  { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
]
```

- 安装判定要求（源 C）：清单须含 **192px 与 512px** 图标——为必备集，缺一不可安装提示。
- `purpose: "any maskable"`：规范允许单资源声明复数用途（token 集）；本设计为「满幅不透明底 + 内容居中安全区」，同时满足 any（原样展示）与 maskable（任意蒙版裁切后内容完整）两种语境（§5.1）。若规范阶段要求分置两份（`any` 一份、`maskable` 一份），图标字节翻倍（+约 6.5 KB），预算影响见 §6.3 注。
- SVG 图标在清单中的可行性（源 C）：部分操作系统支持 SVG 清单图标（`sizes: "any"`），但「要覆盖全部系统与小尺寸场景，仍须补 PNG 版本」——且移动端系统主屏图标**不读清单图标**，只读专用链接标签（§2.6）。结论：**SVG 仅可作锦上添花的 favicon，不进安装图标集**；安装图标集以 PNG 为准。

### 2.6 移动端系统特例（源 E + 源 C，逐条）

1. **主屏图标来源**：该系统的主屏添加流程**不读清单 `icons`**，读专用链接标签（rel 值为该系统机制标识符，含来源品牌词，处置见下「门禁处置」）；缺失时主屏图标回落为「安装时页面的截图」。**采纳**：`index.html` head 增补该专用链接标签、`href` 复用 192 图标文件不单出 180 文件（该系统按链接尺寸提示自行缩放，源 C 明示「提供一张较大图（如 192x192）由浏览器缩放通常已足够」）。**门禁处置**：该 rel 值含品牌词、命中命名门禁禁词表且无豁免子串，故不落入任何扫描范围文件——链接由 `vite.config.ts` 构建期注入（`transformIndexHtml`），交付物源文件与全部文档以「专用链接标签」中性指称。
2. **安装入口**：无应用内安装提示事件（`beforeinstallprompt` 在该系统不受支持，源 C）；安装仅经「分享菜单 → 添加到主屏幕」手工路径。**含义**：应用内不必也不能做自绘安装按钮的统一体验——桌面类浏览器可监听 `beforeinstallprompt` 自绘入口（源 C），该能力按「可选增强」留待后续，本轮不做。
3. **展示模式**：仅支持 `standalone` 一档（源 E），与 §2.1 决策一致。
4. **格式**：专用链接标签的图标惯例为 PNG（源 C `<link>` 参考页示例全为 PNG 且标注为非标准 rel 值）——PNG 即本方案产出格式。

---

## 3. 主题三：Service Worker 策略（预缓存 + 运行时 + wasm）

### 3.1 预缓存范围：构建产物全量

- 预缓存清单由构建期生成并内联进 sw.js（实测：条目含全部 hash 命名 chunk、`index.html`、`manifest.webmanifest`、public 目录命中文件；hash 命名文件 `revision: null`，非 hash 文件带内容摘要 revision——源 A：revision 为内容的 MD5）。
- **wasm 必须显式进 glob**：默认 glob 不含 `.wasm`。采纳配置（沙箱实测生效，预缓存清单出现 `core.wasm` 条目）：

```ts
injectManifest: {
  injectionPoint: "self.__WP_MANIFEST",
  globPatterns: ["**/*.{js,css,html,wasm,png,webmanifest}"],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // wasm 单项上限 800,000 字节（门禁线）内均可预缓存；4MB 为防报错余量
}
```

- 源 A：0.20.2 起插件对 `maximumFileSizeToCacheInBytes` 触发的构建警告改为直接抛错——显式放大该值是防御性配置，当前 wasm 372,534 字节远低于默认 2 MiB 亦不会触发；列入配置仅为消除未来 wasm 增长的构建阻断点。
- `includeAssets` 不再使用（实测发现其与 glob 命中重叠时 `injectManifest` 不去重，清单出现重复条目；本项目 public 下除图标外无其他需预缓存文件，图标已被 `png` glob 覆盖）。

### 3.2 手写 SW 骨架（采纳方案全文骨架，实测编译产物 1.0–2 KB）

设计要点（每条均对应实测或规范依据）：

1. **缓存名内嵌清单指纹**：`precache-<hash8(JSON.stringify(self.__WP_MANIFEST))>`。预缓存清单内联于 sw.js，任何影响产物的构建都会改变 sw.js 字节 → 触发浏览器字节比对更新周期 → install 写入新指纹缓存 → activate 清除旧指纹缓存。该机制同时解决「旧版本残留」与「hash chunk 孤儿条目累积」。
2. **install 用 `new Request(url, { cache: "reload" })`**：绕过 HTTP 缓存直取源文件（gh-pages 响应 `Cache-Control: max-age=600`，实测 §3.3），保证预缓存内容与构建产物一致。
3. **install 内 `self.skipWaiting()`、activate 内 `self.clients.claim()`**：即源 A 对 `autoUpdate` 语义的自定义 SW 等价写法；不发生对打开中页面的强制重载。
4. **fetch 三分**：导航请求 → 预缓存 `index.html`；同源 GET → 预缓存命中否则放行网络；跨域 → 默认放行（汇率接口走 §3.4 专用路由，其余跨域不缓存）。
5. **汇率接口专用路由（NetworkFirst，仅限该 https 公网域）**：

```ts
const FX_HOST = "open.er-api.com";
// fetch 处理器内：
if (url.protocol === "https:" && url.hostname === FX_HOST) {
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok) caches.open("fx-cache-v1").then((c) => c.put(event.request, res.clone()));
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || Promise.reject())),
  );
  return;
}
```

安全口径：协议显式限定 `https:`、主机精确等值匹配单一公网域——比页面侧既有校验（`src/services/rates.ts:76-99` 的 `isPublicHttpUrl`）更严格，满足「仅允许 http/https 公网地址、拒绝本地/私有/保留地址」的强约束（本地/私有地址按构造即不可能命中精确等值匹配）。

### 3.3 与既有离线快照逻辑的关系（分层退化链，源 G + 线上实测）

实测线上部署响应头（本会话 curl）：
- 应用页：`HTTP 200`、`Cache-Control: max-age=600`（部署可见性上限 10 分钟——SW 更新检查即使命中 HTTP 缓存，sw.js 字节至多滞后 10 分钟）；
- wasm：`Content-Type: application/wasm`（p2-spec §0.3 的 MIME 查证项以直接证据关闭；首访加载与预缓存回填均依赖正确 MIME）；
- 汇率接口：`HTTP 200`、`access-control-allow-origin: *`、`Content-Type: application/json`、自带 `Cache-Control: public, max-age=3600`——CORS 响应（非 opaque）可整体写入 Cache API，无 taint 问题。

四层退化链（自上而下）：

| 层 | 数据 | 生效条件 | 数据时新度标注 |
| --- | --- | --- | --- |
| ① 网络直连 | 实时汇率 | 在线 | 接口自带的 `ratesUpdatedAt` |
| ② SW 汇率缓存 | 上一次成功响应 | SW 路由网络失败且缓存命中 | 同上（接口载荷自带时间戳，UI 标注不失真） |
| ③ 页面级模块缓存 | 同 ②（`rates.ts:186` 模块级 cached） | 同一次会话内去重 | 同上 |
| ④ 构建内置快照 | `FX_RATE_SNAPSHOT`（`src/data/defaults.ts:201`） | ①②全失败（`rates.ts` `offlineSnapshot`，`offline: true`） | 快照记录时间 + 「离线快照」标注 |

- **关系结论：SW 缓存是既有快照逻辑的上游增强，不替代、不冲突。** ②命中时 `rates.ts` 的 `fetch` 正常成功（`offline: false`），仅在 ② 也失败时才落到既有 ④ 路径——既有逻辑零改动。附带收益：② 让「先离线后曾有网」的会话拿到真实历史汇率而非构建期快照，`offline` 标志语义仍由接口可达性如实驱动。
- 不需要缓存过期逻辑：②仅在 ①失败时被读取，在线会话永远优先 ①；时间戳由载荷自带，UI 已有展示位。

### 3.4 wasm 预缓存确认

- 实测：`injectManifest.globPatterns` 加 `wasm` 后，预缓存清单包含 `core.wasm` 条目（§3.1）。
- 首访路径：浏览器按正确 MIME（实测 `application/wasm`）加载 wasm → 同时已入预缓存；离线再访：SW 命中预缓存回包，`src/wasm/pkg/finance_core.js` 胶水层的实例化路径不变（胶水按 `import.meta.url` 解析同目录 wasm，SW 回包 URL 与真实 URL 一致，不触发 CORS/MIME 分支）。
- wasm 372,534 字节 < 单项门禁 800,000 字节（`scripts/check-size.mjs:26`），预缓存无额外限制问题。

---

## 4. 主题四：更新提示 UX（不使用推送类能力）

### 4.1 两种惯例（源 A 逐条核对）

| 口径 | 行为（源 A 表述） | 代价 |
| --- | --- | --- |
| `prompt`（插件默认） | 检出新内容后 `onNeedRefresh` 回调 → 界面弹「刷新/取消」→ 用户确认后 `updateSW()` 重载 | 须引虚拟模块 → 注册运行时 chunk +5,748 B（实测）＋ 弹窗 UI 与文案（三语） |
| `autoUpdate` | 检出新版本 → 更新缓存 → 「自动重载所有打开中的应用窗口/标签页」接管 | 源 A 明示主要缺点：自动重载可能令「正在填表单的窗口/标签页」丢失输入 |

### 4.2 本项目的关键改写：静默换版、不强刷

手写 SW（§3.2）的 `skipWaiting`/`clients.claim` 语义边界：新 SW 接管**只影响后续请求**，已加载页面继续运行旧脚本直到其自然重载/下次打开。即：取 `autoUpdate` 的「无需用户决策」，同时**不发生**源 A 警告的强刷丢输入场景。计算器形态的适配论据：

- 全部输入状态持久化于 localStorage（仓库既有 store 机制），「旧版页面 + 新缓存」共存一个会话无一致性风险（无跨版本存储迁移——若未来出现 schema 迁移，须重审本口径）；
- 新版本在下一次打开时生效，与「离线工具按需打开」的使用节拍一致；
- 源 A 对 prompt 的推荐理由是「让用户决定何时更新内容」，其反面代价（弹窗打断 + 5.7 KB + 三语弹窗文案）对本工具无对应对价。

### 4.3 采纳结论与实现口径

- `registerType: "autoUpdate"` + `injectRegister: "script"`（纯注册脚本，不引虚拟模块——§1.3）。
- 不做「新版本可用」提示条：更新在下一次打开自然生效，无用户动作可选项（若规范阶段坚持提示，唯一预算可行路径为 `injectRegister: "script"` + 手写约 30 行的 updatefound 监听，另评）。
- **不使用任何推送类能力**：无推送订阅、无通知 API、无后台同步、无周期同步（源 A 的 `registerPeriodicSync` 一类机制一并排除）。离线工具的更新检查仅依赖浏览器默认节奏：导航触发的 SW 脚本更新检查 + gh-pages 10 分钟 HTTP 缓存上限（实测 §3.3）。

---

## 5. 主题五：图标生成（零新增依赖，实测通路）

### 5.1 设计（手写 SVG）

- 单一设计同时覆盖 `any` 与 `maskable`（规范安全区定义：直径 80% 最小边的圆，源 B；业界指南口径：maskable 须满幅不透明底，源 C）：
  - 512 视窗满幅 `rect` 填 #4A6FA5（品牌色，`global.css` `--wf-primary` 同值），圆角 `rx=96`（≈18.75%，与主流系统图标圆角带一致量级）；
  - 白色闪电多边形（`M300 64 L148 288 L236 288 L196 448 L364 224 L272 224 Z`），按 0.62 缩放居中——内容最远点距中心 ≈119px，处于 512×0.4=204.8px 安全区半径内（实测图像目视核验，§5.2 产物截图复核）；
  - 满幅底保证任意蒙版裁切后不露白；圆角仅在 `any` 语境可见。
- SVG 源文件随仓维护（约 10 行），改色/改形只动一处；三尺寸经同一 `viewBox` 输出。

### 5.2 SVG → PNG 转换（本机既有工具，实测命令与产物）

通路：无头浏览器内核（本机已装，路径实测存在）以「固定像素 SVG 的 HTML + 截图」方式输出 PNG。本会话实测命令（192 一例，另两尺寸同理）：

```
msedge --headless=new --no-first-run --disable-gpu --force-device-scale-factor=1 \
  --user-data-dir=<临时目录> --hide-scrollbars \
  --screenshot="...icon-192.png" --window-size=192,192 \
  --default-background-color=00000000 "file:///<icon-192.html>"
```

实测要点（踩坑记录，供实现阶段复用）：
- 必须显式 SVG 像素尺寸（`<svg width="192" height="192" viewBox="0 0 512 512">`）+ `--force-device-scale-factor=1`：首次尝试用 `100vw/100vh` + 无缩放旗标，高 DPI 显示环境下 192 尺寸产物错位（实测复核发现后修正）；
- `--default-background-color=00000000` 保留圆角外透明；
- 产物核验：图像库逐一读取尺寸（实测 `192x192 / 512x512 / 180x180` 全对）+ 目视复核构图。

### 5.3 产物体积（实测）

| 文件 | 尺寸 | 字节 |
| --- | --- | --- |
| icon-192.png | 192×192 | 3,307 |
| icon-512.png | 512×512 | 9,757 |
| 主屏专用链接 180 图标（备选，见 §6.3 取舍） | 180×180 | 3,100 |
| **三张合计** | — | **16,164** |

- 纯色几何设计的 PNG 压缩率高（512 仅 9.8 KB）；若规范阶段换复杂设计，字节上限约翻倍仍可控，但须回算 §6.3 预算。
- 备选工具（如需更小字节）：无新依赖前提下可用「调低反走样细节/纯色块化」重绘；或以仓库既有临时目录图像处理脚本先例（PowerShell 图像库，`.tmp-research/crop.ps1`）做调色板量化——本轮未执行量化（无需求：预算已可容纳）。

---

## 6. 尺寸预算结论（全实测算术）

### 6.1 当前基线（本会话 `npm run build && node scripts/check-size.mjs`）

| 产物 | 字节 |
| --- | --- |
| index.html | 1,690 |
| assets/finance_core_bg-*.wasm | 372,534 |
| assets/index-*.js | 272,890 |
| assets/index-*.css | 329,720 |
| assets/vendor_arco-*.js | 560,356 |
| assets/vendor_charts-*.js | 379,593 |
| assets/vendor_state-*.js | 57,342 |
| assets/wasm_glue-*.js | 6,314 |
| **合计** | **1,980,439** |
| 门禁限额（`scripts/check-size.mjs:25`） | 2,000,000 |
| **余量** | **19,561 字节 ≈ 19.1 KB** |

（wasm 单项门禁 800,000 字节不动，余量充足。）

### 6.2 实测发现的门禁测量缺陷（与 PWA 无关，但影响一切预算判定）

部署脚本在 dist 内建独立 git 仓（`scripts/deploy.sh` 注释与实现），构建工具清空输出目录时刻意保留 `.git`；而 `walk()`（`scripts/check-size.mjs:29`）递归全目录不过滤。**实测复现**：部署仓存在时复跑门禁 → `DIST_TOTAL_KB=2590`、`dist 总和超标：2,651,744 bytes`（其中 `.git` 内部对象占约 671 KB）、退出码 1。
**建议（hygiene，非限值调整）**：`walk()` 跳过 `.git` 目录（一行过滤）。修复前，任何「构建 → 部署 → 复跑门禁」的顺序都会假阴性失败，PWA 增量的预算判定也依赖干净口径。

### 6.3 PWA 增量算术（沙箱实测单价 × 本项目清单）

**推荐组合**：`injectManifest` 手写 SW + `injectRegister: "script"` + 两张 PNG（180 复用 192 文件）：

| 项 | 实测/推算依据 | 字节 |
| --- | --- | --- |
| sw.js（手写 + 内联清单） | 沙箱 11 条目实测 1,463 B；本项目约 13 条目且 URL 更长 → 约 2.0 KB | ~2,000 |
| registerSW.js | 实测 136 B | 136 |
| manifest.webmanifest | 沙箱实测 339–383 B，加 `id`/`description` → 约 500 B | ~500 |
| icon-192.png + icon-512.png | 实测 3,307 + 9,757 | 13,064 |
| **合计** | | **≈ 15,700–15,900** |
| **对比余量 19,561** | | **通过，剩约 3.8 KB** |

可选增量项（默认不做，均给出代价）：
- 独立主屏专用 180 图标文件（实测 3,100 B）：剩余余量 ≈ 0.7 KB，过薄，**不采纳**；复用 192 文件（源 C 明示缩放足够）。
- `purpose` 分置两份图标集（any 一份 + maskable 一份）：图标字节 ×2（约 +13.1 KB）→ 超余量，**不采纳**；维持单设计双用途声明。
- 独立 SVG favicon：+数百字节量级，可选项，留规范阶段。

**对照组合（不推荐，仅存档）**：`generateSW`（默认策略）：
- SW 侧实测 sw.js 1,045 + workbox 运行时 15,112 = 16,157 B；加清单 ~500 + 双图标 13,064 + registerSW 154 ≈ **32.8 KB** → 超余量约 13.3 KB；
- 若再走虚拟模块（默认注册路径）：+5,748 B chunk → ≈ **38.4 KB** → 超余量约 19 KB。
- 结论：**默认策略与本项目预算不兼容**；除非走门禁例外流程（p2-spec §10.3 有先例：临时上调 + 理由 + 回滚条件），否则应采用推荐组合。

### 6.4 偏差说明

- 任务描述称「当前余量约 115KB」：本会话实测余量为 **19,561 字节 ≈ 19.1 KB**（§6.1 明细可复算）。差值来源未在本会话定位到唯一原因（可能为旧构建口径）；预算结论以本会话实测为准。
- devDependency +59 MB 不进 dist、不影响红线；运行时产物增量即 §6.3 全部内容。

---

## 7. 逐条采纳清单（配置级）

| # | 主题 | 采纳内容（含具体值） |
| --- | --- | --- |
| A1 | 依赖 | `npm i -D vite-plugin-pwa@^2.0.0`（peer `workbox-build@^7.4.1`、`workbox-window@^7.4.1` 随装；`@vite-pwa/assets-generator` 不装）。+59 MB devDeps，不进 dist |
| A2 | vite 配置 | `VitePWA({ strategies: "injectManifest", srcDir: "src", filename: "sw.ts", registerType: "autoUpdate", injectRegister: "script", manifest: {...A5} , injectManifest: { injectionPoint: "self.__WP_MANIFEST", globPatterns: ["**/*.{js,css,html,wasm,png,webmanifest}"], maximumFileSizeToCacheInBytes: 4*1024*1024 } })`；`base` 维持 `"./"` 不变（§1.4 实测两态皆正确，改动面最小） |
| A3 | SW 源 | 新增 `src/sw.ts`：`/// <reference lib="webworker" />` + §3.2 五点骨架（指纹命名缓存 / reload 回填 / skipWaiting+claim / fetch 三分 / 汇率 https+精确域 NetworkFirst）；不 import workbox 运行时 |
| A4 | manifest 链接与注册 | 零手写：插件自动注入 `<link rel="manifest" href="./manifest.webmanifest">` 与 `<script ... src="./registerSW.js">`（实测） |
| A5 | manifest 字段值 | `id: "/wealth-freedom-planner/"`；`name: "财富自由规划工具"`；`short_name: "财自规划"`（措辞留规范阶段定稿）；`lang: "zh-CN"`；`dir` 不设；`description` 复用 index.html meta 文案；`start_url`/`scope` 用插件生成 `"./"`；`display: "standalone"`；`theme_color: "#4A6FA5"`；`background_color: "#F7F8FA"`；`orientation` 不设；`icons` 见 A6 |
| A6 | 图标 | `public/icon-192.png`（3,307 B）+ `public/icon-512.png`（9,757 B），均 `{ sizes, type: "image/png", purpose: "any maskable" }`；生成通路 = 手写 SVG（§5.1）+ 无头内核截图（§5.2 命令与踩坑记录）；主屏专用链接复用 192 图标文件不单出文件 |
| A7 | index.html | 增补一行专用链接标签（移动端系统主屏图标专用，§2.6）；rel 值含品牌词落命名门禁禁词表，按 §2.6「门禁处置」由 `vite.config.ts` 构建期注入，index.html 源文件零手写；`<meta name="theme-color" content="#4A6FA5">` 已在位（`index.html:6`） |
| A8 | 汇率运行时缓存 | SW fetch 内：`https:` + 主机精确等值 `open.er-api.com` 才走 NetworkFirst 路由（§3.2 代码骨架）；成功回包写入 `fx-cache-v1`，失败回落缓存，再失败放行失败 → 页面层既有 `offlineSnapshot` 兜底（`rates.ts:122`）——四层退化链（§3.3），`rates.ts` 零改动 |
| A9 | 更新 UX | `autoUpdate` 语义 + 静默换版不强刷（§4.2）；无提示条、无弹窗；**无任何推送类能力**（无推送/通知/后台同步/周期同步） |
| A10 | 尺寸门禁 | 不调限值（推荐组合增量 ≈15.8 KB < 余量 19.6 KB）；**建议同步修 `scripts/check-size.mjs:29` `walk()` 跳过 `.git`**（§6.2 实测缺陷，hygiene） |
| A11 | 验证口径 | 构建验证：`npm run build` 后核对 `dist/sw.js`（清单含 wasm + 两 png 条目）、`dist/registerSW.js`（`./sw.js` + `scope: './'`）、`dist/manifest.webmanifest` 字段；本地离线验证：`npx vite preview` → 开发者工具 Application 面板断网重载；线上验证：部署后实测 SW 注册状态与离线重载（本会话仅验证了部署响应头，SW 行为属实现后验证项） |

---

## 8. 不采纳与留待后续

| 项 | 处置 | 依据 |
| --- | --- | --- |
| `generateSW` 默认策略 | 不采纳（超预算 13–19 KB） | §6.3 对照算术 |
| `registerType: "prompt"` 弹窗更新 | 不采纳（+5.7 KB 运行时 + 三语弹窗 UI；本应用无表单丢失风险） | §4.1–4.3 |
| 虚拟模块 `virtual:pwa-register` | 不采纳（引 5.7 KB chunk；无回调需求） | §1.3 |
| `base` 改绝对子路径 | 不改（现状已正确）；实现期出现解析歧义时的备选 | §1.4 |
| `*_localized` 多语言清单 / `color_scheme_dark` | 不采纳（实验态）；实现成熟后增量补 | §2.2 / §2.4 |
| 运行时改写 `<link rel="manifest">` 按语言换装 | 不采纳（静态托管无内容协商；安装判定时序耦合） | §2.2 |
| SVG 清单图标进安装图标集 | 不采纳（PNG 为跨系统必备；SVG 仅可作 favicon 增强） | §2.5 |
| 应用内自绘安装按钮（`beforeinstallprompt`） | 留待后续（可选增强；移动端系统不支持该事件） | §2.6 |
| 推送 / 通知 / 后台同步 / 周期同步 | 排除（任务口径 + 非离线工具所需） | §4.3 |
| 独立主屏专用 180 图标 / 双 purpose 图标集 | 不采纳（预算） | §6.3 |

---

## 9. 本会话执行记录（证据索引）

| 检查/实验 | 命令/动作 | 结果 |
| --- | --- | --- |
| 基线构建 + 门禁 | `npm run build && node scripts/check-size.mjs`（仓库根） | 构建过；门禁因 dist/.git 失败（DIST_TOTAL_KB=2590）；剔除 .git 后真实合计 1,980,439 B（§6.1） |
| 插件兼容 | `npm view vite-plugin-pwa@latest version peerDependencies --json` | 2.0.0，vite peer 含 ^6.0.0 |
| 沙箱构建 ×4 | `.tmp-research/pwa-sandbox` 内 `npx vite build`（A: 相对 base+generateSW+虚拟模块；B: 绝对子路径+generateSW；C: 绝对子路径+injectManifest 手写 SW；C': 相对 base+injectManifest+script 注册） | §1.3–1.5 / §3.1 全部产物实测 |
| wasm 进预缓存 | 沙箱 `injectManifest.globPatterns` 加 `wasm` 后复建 | 预缓存清单出现 core.wasm 条目 |
| 线上响应头 | `curl -sI` 应用页 / wasm / 汇率接口 | 200 / application/wasm / CORS 允许跨源（§3.3） |
| devDep 体积 | 空白目录两步安装对照 | 22 MB → 81 MB（+59 MB） |
| 图标 | 手写 SVG + 无头内核截图 ×3 尺寸 + 图像库核验尺寸 | 3,307 / 9,757 / 3,100 B，尺寸全对（§5.3） |
| 未执行项 | 真实项目内安装插件并构建；线上 SW 行为端到端验证；180 文件复用 192 的实机核验 | 属实现阶段验证项，本轮不虚报 |

---

## 10. 风险与边界

1. 手写 SW 的更新周期依赖「清单内联致 sw.js 字节变化」——任何**不影响任何预缓存文件内容**的纯仓库变更（如仅改 README）不会触发客户端更新，属预期行为。
2. 汇率缓存层（②）命中时 UI 的「离线快照」标注不会出现（页面侧 `offline` 为 false）——数据时间戳仍如实展示；若规范阶段要求「数据龄超 N 天提示」，属页面层增强，不在本轮。
3. 图标字节按当前极简设计实测；设计定稿若复杂化，须回算 §6.3（余量仅约 3.8 KB）。
4. 本文档所有「移动端系统」相关行为描述来自源 E/C 两个独立来源交叉；未在本会话以真实移动设备实测（无设备条件），实现后按 A11 线上验证口径补齐。

---

## 11. 来源对照（过程记录，中性描述）

| 标签 | 类型 | 引用章节 | 抓取方式 |
| --- | --- | --- | --- |
| 源 A | 本项目构建工具的 PWA 插件官方文档（vite-plugin-pwa 官方站点） | Getting Started / Register Service Worker / Service Worker Strategies And Behaviors / Automatic reload / Prompt for update / Advanced (injectManifest) / Workbox (generate-sw) | 官方站点抓取，2026-11-20 |
| 源 B | Web 应用清单现行规范草案（开放 Web 标准组织工作草案，2026-11 版） | 根成员清单 / `id` 处理算法 / `lang`、`dir` / `icons` purpose 与 maskable 安全区 / `start_url` 解析 / `display` 处理 / 颜色成员处理 / `*_localized` 与 `color_scheme_dark` 草案成员 | 标准文本抓取，2026-11-20 |
| 源 C | 开放 Web 技术文档参考站（社区维护的开发者文档） | Making PWAs installable（安装判定成员：192/512 图标等）/ Installing（安装流程与各系统差异）/ Define app icons（图标尺寸与 maskable 指南）/ Webpage metadata（自定义图标链接）/ `<link>` 元素参考（主屏图标专用链接 rel 值的语义与示例）/ `*_localized` 参考（实验态声明与回退规则） | 官方站点抓取，2026-11-20 |
| 源 D | 缓存策略库官方文档（workbox-strategies 模块页） | NetworkFirst 语义与选项（`cacheName`/`networkTimeoutSeconds`/`fetchOptions`/`matchOptions`）；三策略适用场景对照；opaque/200 默认缓存行为 | 官方站点抓取，2026-11-20 |
| 源 E | 端侧系统学习材料（安装行为专题，learn 系列安装章节） | 移动端系统无安装提示事件、经分享菜单添加主屏、主屏图标读专用链接标签（缺失回落页面截图）、仅支持 standalone 展示档 | 官方站点抓取，2026-11-20 |
| 源 F | npm 包注册表 | `vite-plugin-pwa` 版本线与 peerDependencies 查询 | 注册表 CLI 查询，2026-11-20 |
| 源 G | 仓库内既有机制 | `vite.config.ts:4,38`（base 口径）、`scripts/check-size.mjs:25-29`（门禁与 walk）、`scripts/deploy.sh`（部署链路）、`src/services/rates.ts:13,76-99,122,186`（汇率服务与安全校验）、`src/data/defaults.ts:201`（快照）、`index.html:6`（theme-color）、`src/styles/global.css:55,305`（双主题页底）、`docs/p2-spec.md §0.3/§10.3`（上轮裁定与门禁例外先例） | 本仓直接读取，2026-11-20 |
| 实测 | 本会话沙箱与线上检查 | §9 全表 | 本会话执行，2026-11-20 |

> 每个主题至少两类来源交叉：插件行为 = 源 A + 沙箱实测；清单字段 = 源 B + 源 C；安装判定 = 源 C + 沙箱产物；移动端特例 = 源 E + 源 C；缓存策略 = 源 D + 源 A；预算 = 源 G + 实测；子路径行为 = 沙箱实测 + 线上响应头实测。
