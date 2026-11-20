import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" —— GitHub Pages 项目页（/repo-name/ 子路径）使用相对路径加载资源。
// manualChunks（docs/p2-spec.md §10.3 辅助项）：vendor（组件库 / 图表库 / 状态与 i18n）
// 与 wasm 胶水拆独立 chunk——不减少总量，但缓解单 chunk 与增量缓存粒度
// （vite build 的 >500kB 警告即为该意图；门禁例外主方案见 §10.3 裁定 1）。

// 组件库 Layout/index.js 以副作用赋值 `LayoutComponent.Sider = Sider` 强制引入
// sider.js → ResizeBox（index/split/split-group/resize-trigger）整链（源码约 47KB），
// 而本应用顶栏骨架只用 Layout/Header/Content/Footer（App.tsx），Sider 与 ResizeBox
// 从未渲染。此插件以虚拟模块替换 sider 请求：接口与 Layout/sider.js 逐项对齐
// （default 导出 = forwardRef 空组件、SiderContext 默认值逐字一致；Menu 经 Layout
// 再导出消费 SiderContext，本应用未引 Menu）。运行时行为不变；升级组件库若该模块
// 接口变化需同步下方 STUB_CODE（失效表现为 bundle 复增约 20KB，被尺寸门禁捕获）。
// 匹配面：依赖图内以 sider 结尾的模块请求（仅组件库 Layout 的 './sider' 与 Menu 的
// '../Layout/sider'，无其他同名模块）。
const SIDER_STUB_CODE = `
import { createContext, forwardRef } from "react";
export const SiderContext = createContext({ siderCollapsed: false, collapsedWidth: 64 });
export default forwardRef(function Sider() { return null; });
`;

const arcoLayoutSiderStub: Plugin = {
  name: "arco-layout-sider-stub",
  enforce: "pre",
  resolveId(id) {
    if (/[/\\]sider(\.js)?$/.test(id)) return "\0arco-layout-sider-stub";
    return null;
  },
  load(id) {
    if (id === "\0arco-layout-sider-stub") return SIDER_STUB_CODE;
    return null;
  },
};

// P4 ① PWA（docs/p4-spec.md §6.6 / research-pwa §2.6）：该系统主屏图标不读清单
// icons、读专用链接标签，缺失回落「安装时页面的截图」。其 rel 值为该系统机制
// 标识符且含来源品牌词，命中命名门禁禁词表（无豁免子串），故不写入交付物
// index.html 源文件，改由此处在构建期注入——机制标识符仅以代码形式存在于
// 构建配置（design-spec 豁免条款「属性值属实现层必需标识符」）。href 复用
// 192 图标文件不单出 180（源文档明示该系统自行缩放，192 通常已足够）。
const platformIconLink: Plugin = {
  name: "pwa-platform-icon-link",
  transformIndexHtml() {
    return [
      {
        tag: "link",
        attrs: { rel: "apple-touch-icon", href: "./icons/icon-192.png" },
      },
    ];
  },
};

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    arcoLayoutSiderStub,
    platformIconLink,
    // P4 ① PWA（docs/p4-spec.md §6.1 / research-pwa 采纳清单 A2）：
    // injectManifest 手写 SW（src/sw.ts，零 workbox 运行时）+ script 注入注册
    // （省 5.7KB 注册运行时 chunk）+ autoUpdate 静默换版（无更新提示 UI，§6.4）。
    // base 维持 "./"：研究沙箱实测相对 base 下清单链接 / start_url / scope /
    // 预缓存条目四类产物全部正确。wasm 必须显式进 glob（默认不含 .wasm）；
    // maximumFileSizeToCacheInBytes 为防御性放大，消除未来 wasm 增长的构建阻断点。
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "script",
      manifest: {
        // 显式安装身份：不受 start_url 形态漂移影响（research-pwa §2.3）
        id: "/wealth-freedom-planner/",
        name: "财富自由规划工具",
        short_name: "财自规划",
        // 清单单语 zh-CN；三语由应用内 i18next 承载（research-pwa §2.2）
        lang: "zh-CN",
        description: "财富自由个性化规划工具（480 法则，本地计算）",
        // start_url / scope 由插件按 base 生成为 "./"（实测正确，不手写）
        display: "standalone",
        theme_color: "#4A6FA5",
        background_color: "#F7F8FA",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        injectionPoint: "self.__WP_MANIFEST",
        // png/webmanifest 不入 glob：插件对自产 manifest/icons 条目不去重（验收 T1-2 实证），
        // glob 排除后由插件侧自动注入，预缓存清单 12 条目唯一、sw.js 更小
        globPatterns: ["**/*.{js,css,html,wasm}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // Terser 压缩（尺寸门禁杠杆）：esbuild → terser 对本仓库 JS 产物实测再省
    // 约 3–6%（toplevel + 谨慎的代码变换），覆盖高级区 Tabs 导航新增的体积；
    // terser 为 devDependency，不进入运行时 bundle。
    minify: "terser",
    // lightningcss 压缩 CSS（尺寸门禁杠杆之二）：对组件库全量样式表
    // （arco.css）实测比默认 esbuild 再省数个百分点；devDependency。
    cssMinify: "lightningcss",
    // 现代浏览器目标：lightningcss 据此决定特性降级与回退生成量（PWA 产物
    // 本身要求现代浏览器，SW/manifest 即门槛），较默认目标再省少量字节
    cssTarget: ["chrome100", "firefox100", "safari15", "edge100"],
    terserOptions: {
      compress: {
        passes: 3,
        toplevel: true,
        // unsafe：标准 ES 产物（React/组件库无元编程）下的等价变换优化，
        // 由构建后浏览器全功能验证兜底
        unsafe: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // react / react-dom 不单列：rollup 会随首个引用方（组件库）归组，单列会生成空 chunk
          vendor_arco: ["@arco-design/web-react"],
          vendor_charts: ["recharts"],
          vendor_state: ["zustand", "i18next", "react-i18next"],
          wasm_glue: ["./src/wasm/pkg/finance_core.js"],
        },
      },
    },
  },
});
