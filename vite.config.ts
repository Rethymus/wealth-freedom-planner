import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  base: "./",
  plugins: [react(), arcoLayoutSiderStub],
  build: {
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
