/**
 * 应用入口：i18next 初始化（见 src/i18n）+ 异步 bootstrap WASM 计算核心。
 * Arco 组件库语言包由 ArcoLocaleGate 随 i18next 当前语言切换（zh-CN / zh-Hant / en-US）；
 * 注：zh-Hant 对应 Arco 语言包文件名为 locale/zh-TW（第三方包自身的文件命名）。
 *
 * - init 成功：wasm 计算核心就绪（services/finance.ts 的懒加载 init 与本次
 *   init 共享同一模块实例，后续调用零重复开销）；
 * - init 失败：页面仍能渲染，计算区顶部显示「计算核心加载失败」Alert
 *   （见 App 的 wasmBootstrap prop），各计算面板会经由 FinanceResult
 *   的 ok:false 各自展示错误，页面其余部分不受影响。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import zhHantLocale from "@arco-design/web-react/es/locale/zh-TW";
import enUS from "@arco-design/web-react/es/locale/en-US";
/* 组件库样式按需引入：仅随实际用到的组件引入编译后 CSS。各组件 style/css.js 会自动
   级联引入全局基座（CSS 变量 / 深色令牌 / normalize / 图标与动画基类）与传递依赖
   （如 Select → Trigger / Empty / Checkbox / InputTag）；全量 dist/css/arco.css 约
   581KB，按需引入使 dist 总量降至尺寸门禁限额内。新增组件使用后须同步补对应引入。 */
import "@arco-design/web-react/es/Alert/style/css.js";
import "@arco-design/web-react/es/Button/style/css.js";
import "@arco-design/web-react/es/Card/style/css.js";
import "@arco-design/web-react/es/Collapse/style/css.js";
import "@arco-design/web-react/es/ConfigProvider/style/css.js";
import "@arco-design/web-react/es/Descriptions/style/css.js";
import "@arco-design/web-react/es/Divider/style/css.js";
import "@arco-design/web-react/es/Grid/style/css.js";
import "@arco-design/web-react/es/InputNumber/style/css.js";
import "@arco-design/web-react/es/Layout/style/css.js";
import "@arco-design/web-react/es/Message/style/css.js";
import "@arco-design/web-react/es/Progress/style/css.js";
import "@arco-design/web-react/es/Radio/style/css.js";
import "@arco-design/web-react/es/Select/style/css.js";
import "@arco-design/web-react/es/Spin/style/css.js";
import "@arco-design/web-react/es/Switch/style/css.js";
import "@arco-design/web-react/es/Table/style/css.js";
/* 第 2 轮视觉验收 V1（P0）：高级区组内标签页（Tabs type="capsule"）样式自 P4 导航重构起
   漏引——药丸/横排/hover/激活底全部未出货，9 个 tab 标题呈全宽竖排裸文本；
   global.css 的活动标题涨色规则按药丸形态前提书写，须随本引入一并生效 */
import "@arco-design/web-react/es/Tabs/style/css.js";
import "@arco-design/web-react/es/Tag/style/css.js";
import "@arco-design/web-react/es/Tooltip/style/css.js";
import "@arco-design/web-react/es/Typography/style/css.js";
import "./styles/global.css";
import "./i18n";
import App from "./App";
import type { WasmBootstrapStatus } from "./App";
import init from "./wasm/pkg/finance_core.js";

/** Arco 语言包映射（键 = i18next 语言码） */
const ARCO_LOCALES: Record<string, typeof zhCN> = {
  "zh-CN": zhCN,
  "zh-Hant": zhHantLocale,
  en: enUS,
};

/** Arco 组件库语言包跟随 i18next 当前语言 */
function ArcoLocaleGate({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const locale = ARCO_LOCALES[i18n.language] ?? zhCN;
  return <ConfigProvider locale={locale}>{children}</ConfigProvider>;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("未找到 #root 挂载点");
}

/** 异步 bootstrap：init WASM 计算核心；失败不阻断渲染，状态传递给 App */
function WasmGate() {
  const [status, setStatus] = React.useState<WasmBootstrapStatus>({ phase: "pending" });

  React.useEffect(() => {
    let cancelled = false;
    init()
      .then(() => {
        if (!cancelled) setStatus({ phase: "ready" });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setStatus({ phase: "failed", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <App wasmBootstrap={status} />;
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ArcoLocaleGate>
      <WasmGate />
    </ArcoLocaleGate>
  </React.StrictMode>,
);
