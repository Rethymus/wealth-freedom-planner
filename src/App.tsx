/**
 * 应用骨架：顶栏（币种切换 + 色盲友好配色开关 + 语言切换 + 主题切换）、基础计算（默认首屏）、
 * 高级估算（Collapse）、底部免责声明。全部界面文案经 react-i18next 三语化。
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Button, Layout, Message, Select, Switch, Typography } from "@arco-design/web-react";
import { IconMoonFill, IconSunFill, IconThunderbolt } from "@arco-design/web-react/icon";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { CURRENCIES, MOTION_DURATIONS, THEME, THEME_DARK, resolveThemeTokens } from "./data/defaults";
import type { ThemeMode } from "./data/defaults";
import { persistLanguage, SUPPORTED_LANGS } from "./i18n";
import type { SupportedLang } from "./i18n";
import { formatNumber, formatTimestamp } from "./services/format";
import { persistRoute, replaceUrlRoute, resolveInitialRoute } from "./services/routeState";
import type { AtlasRoute, AtlasTaskId } from "./services/routeState";
import { useCalculatorStore } from "./store/useCalculatorStore";
import { useDisplayRate, usePrefersReducedMotion } from "./components/hooks";
import BasicCalculator from "./components/BasicCalculator";
import AdvancedPanel from "./components/AdvancedPanel";
import TaskSwitcher from "./components/TaskSwitcher";
import LifeTaskPage from "./components/TaskPages";
import ReversePanel from "./components/advanced/ReversePanel";
import MonteCarloPanel from "./components/advanced/MonteCarloPanel";
import ScenarioPanel from "./components/advanced/ScenarioPanel";
import InsightsPanel from "./components/advanced/InsightsPanel";

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;

/** 数字键分域（wf03-spec §2.4）：1–4 → 四任务；5 → 专业模式。task=pro 时任务键整组
 *  不绑定——pro 内 1/2/3 仍归 S21 组切换（AdvancedPanel 原样）、5 为当前页无操作、
 *  4 无绑定，既有键盘习惯零变化（发布阻断级口径）。 */
const DIGIT_TASKS: Record<string, AtlasTaskId> = {
  "1": "freedom",
  "2": "life",
  "3": "risk",
  "4": "principles",
};

/** View Transitions 造型的最小结构类型（lib.dom 尚未收录 startViewTransition 的
 *  运行环境兼容写法；仅本函数使用，不污染全局） */
interface ViewTransitionLike {
  ready: Promise<void>;
}
type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionLike;
};

/**
 * S22 主题切换圆形揭示（p6-spec §2 S22；research-ui-trends §1 S1 定案版）：
 * 新主题自触发点坐标 clip-path 圆形揭示铺满全屏。双降级链——无
 * startViewTransition API 或系统「减弱动效」命中 → 直接 apply()（=现状令牌直换）；
 * vt.ready 被拒即静默放弃（换肤已完成，无视觉残留）。
 * apply 必须经 flushSync 包裹后再传入：React 18 的 setState 在
 * startViewTransition 回调内非同步提交 DOM，不包 flushSync 则浏览器快照「新状态」
 * 时 DOM 仍是旧主题，揭示的是旧皮随后硬切。360ms 与 cubic-bezier(0.2,0,0,1) 为
 * --wf-dur-slow / --wf-ease-standard 的字面值对齐（View Transitions 内联动画不走
 * CSS 令牌）；键盘激活（e.detail === 0）坐标回退按钮几何中心。
 * 低频纪律：仅主题切换按钮一处调用，不得用于高频动作。
 */
function revealTheme(x: number, y: number, apply: () => void, reduced: boolean): void {
  const doc = document as DocumentWithViewTransition;
  if (reduced || typeof doc.startViewTransition !== "function") {
    apply();
    return;
  }
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = doc.startViewTransition(() => flushSync(apply)); // 同步提交防 React 批处理漏帧
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        // 360ms = --wf-dur-slow 量级；cubic-bezier(0.2,0,0,1) = --wf-ease-standard 同曲
        { duration: 360, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      /* ready 不决时静默放弃：主题已切换完成，无视觉残留 */
    });
}

/** WASM 计算核心引导状态（由 main.tsx 的异步 bootstrap 提供） */
export type WasmBootstrapStatus =
  | { phase: "pending" }
  | { phase: "ready" }
  | { phase: "failed"; message: string };

interface AppProps {
  /** 缺省按 pending 处理（不显示 bootstrap 提示） */
  wasmBootstrap?: WasmBootstrapStatus;
}

export default function App({ wasmBootstrap }: AppProps = {}) {
  const { t, i18n } = useTranslation();
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const toggleColorBlindFriendly = useCalculatorStore((s) => s.toggleColorBlindFriendly);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const setCurrency = useCalculatorStore((s) => s.setCurrency);
  const theme = useCalculatorStore((s) => s.theme);
  const toggleTheme = useCalculatorStore((s) => s.toggleTheme);
  /** S22 减弱动效判定：复用既有 usePrefersReducedMotion（hooks.ts:162 为唯一来源） */
  const reducedMotion = usePrefersReducedMotion();
  /** S22 主题按钮接入：键盘激活（Enter/Space，detail === 0 无指针坐标）回退按钮
   *  几何中心为揭示原点；指针激活取点击坐标。组件库 Button 的 onClick 形参类型为
   *  Event（es/Button/interface.d.ts:82），运行时为 DOM MouseEvent，此处窄化取用 */
  const handleThemeToggle = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    const rect = (mouseEvent.currentTarget as HTMLButtonElement | null)?.getBoundingClientRect();
    const x = mouseEvent.detail === 0 ? (rect ? rect.left + rect.width / 2 : 0) : mouseEvent.clientX;
    const y = mouseEvent.detail === 0 ? (rect ? rect.top + rect.height / 2 : 0) : mouseEvent.clientY;
    revealTheme(x, y, toggleTheme, reducedMotion);
  };
  const applyShareState = useCalculatorStore((s) => s.applyShareState);
  const resetBusinessInputs = useCalculatorStore((s) => s.resetBusinessInputs);
  const shareHandledRef = useRef(false);
  /** ⑤ App 级换算提示（p4-spec §3.7）：分三态——loading 态不渲染横幅（静默过渡，
   *  getRates 超时上限 8s，字段已按符号-only 渲染，横幅闪变比误报更伤）；
   *  落定后 rate 可用 → 换算说明（含汇率时点）；rate null（离线 / 缺币种）→ 符号-only 回退说明 */
  const rateInfo = useDisplayRate(displayCode);
  useEffect(() => {
    /** 分享 hash 处理：首挂载与同文档 hashchange 共用同一口径——合法载荷恢复并提示成功；
     * 损坏 / 版本不符业务参数回落默认并提示一次。同文档导航（地址栏改 hash / 粘贴仅差
     * hash 的链接，App 不重挂载）此前只在首挂载解析，损坏时静默且参数保持原值，与
     * 「新标签打开损坏链接」行为不一致（验收 Q3-2） */
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#s=")) return;
      if (applyShareState(hash)) {
        Message.success(t("share.restored"));
      } else {
        // 损坏 / 版本不符：业务参数回落默认（与新标签打开终态一致；界面偏好不动）+ 一次提示
        resetBusinessInputs();
        Message.warning(t("share.restoreIgnored"));
      }
    };
    if (!shareHandledRef.current) {
      shareHandledRef.current = true;
      handleHash(); // 仅首挂载解析现有 hash；hash 保留在地址栏，刷新可复现同一套参数
    }
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [applyShareState, resetBusinessInputs, t]);

  /** WF-03 任务路由（§2.2/§2.3/§4.3）：首渲染前解析（useState 初始化器，禁 effect 后
   *  解析——防任务闪变，readInitialTheme 先例）；显式切换动作统一走 selectTask——
   *  wf-route 写盘与 replaceState 同文档改写均只在此发生，深链落地不写盘（URL 是
   *  事实来源，§2.3）；lastTaskRef 记录进入 pro 前的任务供 Esc 返回（无历史回 freedom）。
   *  分享 hash 与 query 路由两条通道互不触碰：本块不读写 location.hash（§2.2）。 */
  const [route, setRoute] = useState<AtlasRoute & { explicit: boolean; canonical: boolean }>(
    resolveInitialRoute,
  );
  const lastTaskRef = useRef<AtlasTaskId>("freedom");
  /** 首展挂载集合（§5.5 lazyload 先例 AdvancedPanel.tsx:161）：任务页根（tabpanel 语义
   *  载体）恒挂载，页内面板内容首次展现才挂载、此后常驻（hidden 非卸载——切走不卸载，
   *  已运行模拟结果 / 表单输入零丢失） */
  const [visitedTasks, setVisitedTasks] = useState<ReadonlySet<AtlasTaskId>>(
    () => new Set([route.task]),
  );
  const selectTask = (task: AtlasTaskId) => {
    if (route.task === task) return;
    if (route.task !== "pro" && task === "pro") lastTaskRef.current = route.task;
    const next: AtlasRoute = { task, panel: task === "pro" ? route.panel : null };
    persistRoute(next); // 仅显式切换写盘（§2.3）
    replaceUrlRoute(next); // 同文档改写不 pushState；hash 通道透传（§4.3）
    setVisitedTasks((prev) => {
      if (prev.has(task)) return prev;
      const visited = new Set(prev);
      visited.add(task);
      return visited;
    });
    setRoute({ ...next, explicit: true, canonical: true });
  };

  /** 深链规范化：URL 显式携带参数但非 canonical 形态（越界值 / 冗余写法 / 多余参数序）
   *  → 挂载即 replaceState 规范化，静默无提示（路由无数据损失，§4.3 与分享损坏警示分级）；
   *  状态已在初始化器按同一解析链落位，本效果只修 URL 表现层，仅挂载跑一次。 */
  useEffect(() => {
    if (route.explicit && !route.canonical) {
      replaceUrlRoute({ task: route.task, panel: route.panel });
    }
  }, []); // 仅挂载规范化一次（深链落地修 URL；切换动作已实时同步）

  /** 切换反馈（§2.1）：滚动复位至切换条（.atlas-switch-anchor scroll-margin-top 令牌化，
   *  顶栏不遮挡）+ 焦点移至新页根（tabpanel tabIndex=0 可聚焦，routing §1.3）；首挂载
   *  不动作（prev 空哨兵）。滚动为瞬时——动效纪律约束动画属性，滚动复位属导航原语。 */
  const prevTaskRef = useRef<AtlasTaskId | null>(null);
  const switcherAnchorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prev = prevTaskRef.current;
    prevTaskRef.current = route.task;
    if (prev === null || prev === route.task) return;
    switcherAnchorRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    document.getElementById(`atlas-${route.task}`)?.focus({ preventScroll: true });
  }, [route.task]);

  /** 数字键 1–4/5 分域 + Esc（§2.4）：S21 式显式输入豁免逐字沿用（INPUT/TEXTAREA/
   *  SELECT/contenteditable 不派发，AdvancedPanel.tsx:100-107 判定原文）；WF-04 T1
   *  豁免扩展（wf04-spec §2-S21 裁定 a，透镜硬前置）：role="slider"[tabIndex=0] 的
   *  target.tagName 为 DIV 不在既有集合内，焦点落于时间透镜刻度轨时按 1–5 不得跳任务；
   *  修饰键组合不劫持；task=pro 时任务键整组不绑定（冲突消解见 DIGIT_TASKS 注）；
   *  Esc 仅 pro 消费——返回最近所在任务，组件库弹层容器内不消费（弹层自身 Esc 语义
   *  优先）。makeTabsKeyDown 判定原文同款不联动——透镜不在 pro 页零改动；未来 slider
   *  落 pro 页须同款扩展（wf04-spec §2-S21 登记注记）。 */
  const handleAtlasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable === true ||
      target?.getAttribute("role") === "slider";
    if (typing) return;
    if (e.key === "Escape") {
      if (route.task !== "pro" || e.defaultPrevented) return;
      if (target?.closest(".arco-select-popup, .arco-trigger-popup, .arco-modal, .arco-drawer")) return;
      selectTask(lastTaskRef.current);
      return;
    }
    if (route.task === "pro") return;
    const digitTask = DIGIT_TASKS[e.key];
    if (digitTask) {
      selectTask(digitTask);
    } else if (e.key === "5") {
      selectTask("pro");
    }
  };

  /** 一次性迁移说明（§8.5 ②）：默认视图换四任务导航的提示；显隐为会话级瞬态
   *  （不入盘——wf-route §2.3「瞬态 UI 不入盘」同口径），关闭后本会话不再出现。 */
  const [migrateNoticeVisible, setMigrateNoticeVisible] = useState(true);

  /** 动态层令牌注入 + 主题属性联动：取色统一经 resolveThemeTokens（按主题选组 + 涨跌语义色
   * 随「色盲友好」开关替换，全应用唯一主题取色入口）；写入 documentElement（组件库弹层挂在
   * body 下、位于页面骨架之外，注入点必须在 documentElement 才对其全局生效）。键名与
   * global.css :root 浅色块、:root[data-theme="dark"] 深色块一一对应且值一致，防首帧闪变。
   * 属性联动双载体：data-theme 恒置 documentElement（供读屏/测试环境探测），组件库深色载体
   * arco-theme 恒置 body（其样式表深色规则的唯一挂点；ConfigProvider 的 theme 属性是令牌
   * 覆写记录、不是明暗开关，见设计规范 2.11）。 */
  useEffect(() => {
    const tokens = resolveThemeTokens(theme, colorBlindFriendly);
    const vars: ReadonlyArray<readonly [name: string, value: string]> = [
      ["--wf-primary", tokens.primary],
      ["--wf-text", tokens.textPrimary],
      ["--wf-text-secondary", tokens.textSecondary],
      ["--wf-text-tertiary", tokens.textTertiary],
      ["--wf-rise", tokens.rise],
      ["--wf-fall", tokens.fall],
      ["--wf-accent-teal", tokens.accentTeal],
      ["--wf-accent-copper", tokens.accentCopper],
      ["--wf-accent-copper-graphic", tokens.accentCopperGraphic],
      ["--wf-accent-slate", tokens.accentSlate],
      ["--wf-accent-slate-graphic", tokens.accentSlateGraphic],
      ["--wf-bg-mint", tokens.bgMint],
      ["--wf-bg-sunken", tokens.bgPage],
      ["--wf-bg-inset", tokens.bgInset],
      ["--wf-bg-surface", tokens.bgSurface],
      ["--wf-bg-tint", tokens.tintBg],
      ["--wf-chart-grid", tokens.chartGrid],
      ["--wf-chart-tick", tokens.chartTick],
      ["--wf-ring-halo", tokens.ringHalo],
      ["--wf-surface-topbar-bg", tokens.surfaceTopbarBg],
      ["--wf-surface-topbar-blur", tokens.surfaceTopbarBlur],
      ["--wf-surface-card-bg", tokens.surfaceCardBg],
      ["--wf-surface-card-blur", tokens.surfaceCardBlur],
      ["--wf-surface-overlay-bg", tokens.surfaceOverlayBg],
      ["--wf-surface-overlay-blur", tokens.surfaceOverlayBlur],
      ["--wf-surface-tooltip-bg", tokens.surfaceTooltipBg],
      ["--wf-surface-tooltip-blur", tokens.surfaceTooltipBlur],
      ["--wf-hairline-topbar", tokens.hairlineTopbar],
      ["--wf-hairline-card", tokens.hairlineCard],
      ["--wf-hairline-overlay", tokens.hairlineOverlay],
      ["--wf-shadow-1", tokens.shadow1],
      ["--wf-shadow-2", tokens.shadow2],
      ["--wf-shadow-3", tokens.shadow3],
      ["--wf-dur-fast", tokens.durationFast],
      ["--wf-dur-base", tokens.durationBase],
      ["--wf-dur-slow", tokens.durationSlow],
      ["--wf-ease-standard", tokens.easeStandard],
      ["--wf-ease-emphasis", tokens.easeEmphasis],
      ["--wf-ease-asymptotic", tokens.easeAsymptotic],
      ["--wf-focus-ring", tokens.focusRing],
      ["--wf-focus-ring-dark", tokens.focusRingDark],
    ];
    const rootStyle = document.documentElement.style;
    for (const [name, value] of vars) {
      rootStyle.setProperty(name, value);
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("arco-theme", theme);
    // 浏览器地址栏颜色（meta theme-color）：深色置深色页面底，浅色恢复品牌主色
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", theme === "dark" ? THEME_DARK.bgPage : THEME.primary);
    }
  }, [theme, colorBlindFriendly]);

  /** 主题切换全局颜色过渡调度（设计规范第 4 节 #15）：主题变更帧给 documentElement 挂
   * .wf-theme-switching 类、基础档时长后移除（样式见 global.css 动效区）。以 ref 记录上一
   * 主题值：首挂载（prev 为空）与同值重跑（如 StrictMode 双调用）均不挂类——页面载入无
   * 过渡；timer 存 ref，effect 重跑与卸载时清理。减弱动效偏好下由既有 reduced-motion 兜底
   * 块强制瞬时切换，无需 JS 判断（设计规范 5.1）。 */
  const switchingTimerRef = useRef<number | null>(null);
  const prevThemeRef = useRef<ThemeMode | null>(null);
  useEffect(() => {
    const prev = prevThemeRef.current;
    prevThemeRef.current = theme;
    if (prev === null || prev === theme) {
      return;
    }
    const root = document.documentElement;
    root.classList.add("wf-theme-switching");
    if (switchingTimerRef.current !== null) {
      window.clearTimeout(switchingTimerRef.current);
    }
    switchingTimerRef.current = window.setTimeout(() => {
      root.classList.remove("wf-theme-switching");
      switchingTimerRef.current = null;
    }, MOTION_DURATIONS.base);
    return () => {
      if (switchingTimerRef.current !== null) {
        window.clearTimeout(switchingTimerRef.current);
        switchingTimerRef.current = null;
      }
      root.classList.remove("wf-theme-switching");
    };
  }, [theme]);

  /** D2 aria-label（docs/p3-spec.md §6.2）：Select 的 combobox 根元素不接受 aria-* prop
   * （组件库 select-view.js 白名单过滤，aria-label 不经 prop 到达 DOM），以 id 定位补写
   * 可访问名称；Switch 的 aria-label 经组件库 omit(rest,...) 透传直写（见上方 JSX）。
   * 语言切换时 t 变化重跑，名称随语言更新。 */
  useEffect(() => {
    document.getElementById("wf-select-currency")?.setAttribute("aria-label", t("app.currencyLabel"));
    document.getElementById("wf-select-lang")?.setAttribute("aria-label", t("app.languageLabel"));
  }, [t]);

  /** 币种选项：代码 + 符号（币种代码与符号跨语言通用，避免界面文案里夹带数据层名称）。
   *  S3-2（验收）：标签为双形态节点——全称（桌面）与短形态（收纳档），由样式层按
   *  ≤789.9px 切换显隐（.wf-select-label-full / .wf-select-label-short），避免收纳档
   *  104/96px 窄档下当前值被 ellipsis 截断（「CNY（¥…」）。value 不随形态变化。 */
  const currencyOptions = CURRENCIES.map((c) => ({
    label: (
      <>
        <span className="wf-select-label-full">{`${c.code}（${c.symbol}）`}</span>
        <span className="wf-select-label-short">{c.code}</span>
      </>
    ),
    value: c.code,
  }));

  /** 语言选项：标签永远用该语言的自身文字（不随界面语言翻译，用户在任何语言下都能认出）。
   *  S3-2：同币种选项的双形态方案——收纳档短形态「中文 / 繁體 / EN」仍各自可认（自身文字
   *  或通行缩写），避免 88/96px 窄档下「简体…」截断。 */
  const langOptions: Array<{ label: ReactNode; value: SupportedLang }> = [
    {
      label: (
        <>
          <span className="wf-select-label-full">简体中文</span>
          <span className="wf-select-label-short">中文</span>
        </>
      ),
      value: "zh-CN",
    },
    {
      label: (
        <>
          <span className="wf-select-label-full">繁體中文</span>
          <span className="wf-select-label-short">繁體</span>
        </>
      ),
      value: "zh-Hant",
    },
    {
      label: (
        <>
          <span className="wf-select-label-full">English</span>
          <span className="wf-select-label-short">EN</span>
        </>
      ),
      value: "en",
    },
  ];
  const currentLang = (SUPPORTED_LANGS as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLang)
    : "zh-CN";
  const changeLanguage = (lng: SupportedLang) => {
    void i18n.changeLanguage(lng);
    persistLanguage(lng);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* A1 跳过链接（p4-spec §7）：置 Layout 首个子元素（Header 之前）——须先于重复块成为
          首 Tab 停留点方有效；Enter 后焦点落 #wf-main（Content tabIndex={-1}） */}
      <a className="wf-skip-link" href="#wf-main">
        {t("a11y.skipToContent")}
      </a>
      <Header
        role="banner"
        className="wf-header wf-surface-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="wf-header-brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconThunderbolt style={{ color: "#fff", fontSize: 20 }} />
          <Title heading={5} style={{ color: "#fff", margin: 0 }}>
            {t("app.title")}
          </Title>
        </div>
        <div className="wf-header-tools">
          <Text className="wf-header-label">{t("app.currencyLabel")}</Text>
          <Select
            className="wf-select-currency"
            id="wf-select-currency"
            size="small"
            value={displayCode}
            options={currencyOptions}
            onChange={(v: string) => setCurrency({ base: v, display: v })}
          />
          <Text className="wf-header-label wf-header-label-cb">{t("app.colorBlindLabel")}</Text>
          {/* 点击区扩展包装：small 档开关本体 16px，+28px 命中区扩展达 44px 触控目标（无条件包装） */}
          <span className="wf-touch-target-sm">
            <Switch
              size="small"
              checked={colorBlindFriendly}
              aria-label={t("app.colorBlindLabel")}
              onChange={toggleColorBlindFriendly}
            />
          </span>
          <Text className="wf-header-label">{t("app.languageLabel")}</Text>
          <Select
            className="wf-select-lang"
            id="wf-select-lang"
            size="small"
            value={currentLang}
            options={langOptions}
            onChange={(v: SupportedLang) => changeLanguage(v)}
          />
          {/* 主题切换按钮（设计规范 3.7）：图标即「点击后到达的状态」——深色态显示日形图标
              （点击转浅色）、浅色态显示月形图标（点击转深色）；图标切换不做动画，状态语义
              由图标形状承载。aria-label 与 title 随状态描述目标主题。图标颜色与顶栏纯白
              文字规则一致；外包触控区扩展（28px 本体 + 20px = 48px ≥ 44px 命中目标，本体
              经样式层豁免保持 28×28 圆形）；挂 .wf-pressable 作按压反馈与顶栏焦点环挂载点。 */}
          <span className="wf-touch-target">
            <Button
              className="wf-pressable"
              size="small"
              shape="circle"
              aria-label={theme === "dark" ? t("app.themeToLight") : t("app.themeToDark")}
              title={theme === "dark" ? t("app.themeToLight") : t("app.themeToDark")}
              icon={
                theme === "dark" ? (
                  <IconSunFill style={{ color: "#fff" }} />
                ) : (
                  <IconMoonFill style={{ color: "#fff" }} />
                )
              }
              onClick={handleThemeToggle}
            />
          </span>
        </div>
      </Header>

      {/* box-sizing 必须显式声明：组件库无全局 border-box 重置，content-box 下
          width:100% + 水平 padding 会在窄视口溢出（375px 实测 scrollWidth 392）。
          maxWidth 同步 +32（padding），保持桌面端 1080 内容宽度不变。 */}
      <Content
        role="main"
        id="wf-main"
        tabIndex={-1}
        style={{
          boxSizing: "border-box",
          width: "100%",
          maxWidth: 1112,
          margin: "0 auto",
          padding: "24px 16px",
        }}
      >
        {wasmBootstrap?.phase === "failed" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            content={t("app.wasmFailed", { message: wasmBootstrap.message })}
          />
        ) : null}
        {/* ⑤ 换算提示三态（p4-spec §3.7）：CNY 恒不渲染；loading 不渲染（防先撒谎后翻转）；
            落定可用 → 换算说明（{{rate}}/{{time}}/{{code}} 占位）；落定不可用 → 符号-only 回退说明 */}
        {displayCode !== "CNY" && !rateInfo.loading && rateInfo.rate !== null ? (
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            content={t("app.currencyNotice", {
              rate: formatNumber(rateInfo.rate, 4),
              code: rateInfo.code,
              time: formatTimestamp(rateInfo.updatedAt, t("currency.noTimestamp")),
            })}
          />
        ) : null}
        {displayCode !== "CNY" && !rateInfo.loading && rateInfo.rate === null ? (
          <Alert type="warning" style={{ marginBottom: 16 }} content={t("app.currencyFallback")} />
        ) : null}
        {/* WF-03 Atlas 任务区（§2.2）：任务切换条 → 五个任务页容器（四任务 + 专业模式）。
            切换条恰 5 项（四任务主行 + 专业模式次级）；任务页 hidden 非卸载（§5.5：
            已运行模拟结果 / 表单输入切换零丢失），页内布局归原型 §1–§4、life/risk
            本轮单列聚合承载（§2.5，容器查询归 WF-04）。壳层（Header/Footer/Content
            maxWidth 1112）零改动。 */}
        <div className="atlas-region" onKeyDown={handleAtlasKeyDown}>
          <div className="atlas-switch-anchor" ref={switcherAnchorRef}>
            {migrateNoticeVisible ? (
              <Alert
                type="info"
                closable
                className="atlas-migrate"
                content={t("atlas.migrate.notice")}
                onClose={() => setMigrateNoticeVisible(false)}
              />
            ) : null}
            <TaskSwitcher active={route.task} onSelect={selectTask} />
          </div>
          {/* —— 自由刻度（默认落点）：L1/L2 基础公式 + L3 反向估算交叉工具卡（原型 §1.1；
              双栏语义自 wf-workbench 迁入，容器查询首批 per §2.5） —— */}
          <div
            id="atlas-freedom"
            role="tabpanel"
            aria-labelledby="atlas-tab-freedom"
            tabIndex={0}
            hidden={route.task !== "freedom"}
            className="atlas-page atlas-freedom"
          >
            <div className="atlas-freedom-layout">
              <h2 className="atlas-page-title">{t("atlas.nav.freedom")}</h2>
              {visitedTasks.has("freedom") ? (
                <>
                  <div className="wf-workbench-primary">
                    <BasicCalculator />
                  </div>
                  <div className="wf-workbench-secondary">
                    <section className="atlas-tool-card" aria-label={t("advanced.reverseTitle")}>
                      <ReversePanel />
                    </section>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {/* —— 人生轨迹：五组单列聚合承载（组件壳 LifeTaskPage，§1 表 2–5/7 行） —— */}
          <div
            id="atlas-life"
            role="tabpanel"
            aria-labelledby="atlas-tab-life"
            tabIndex={0}
            hidden={route.task !== "life"}
            className="atlas-page atlas-life"
          >
            <h2 className="atlas-page-title">{t("atlas.nav.life")}</h2>
            {visitedTasks.has("life") ? <LifeTaskPage /> : null}
          </div>
          {/* —— 风险实验室：主模拟 + 情景库单列聚合承载（§1 表 6/8 行，容器查询归 WF-04） —— */}
          <div
            id="atlas-risk"
            role="tabpanel"
            aria-labelledby="atlas-tab-risk"
            tabIndex={0}
            hidden={route.task !== "risk"}
            className="atlas-page atlas-risk"
          >
            <h2 className="atlas-page-title">{t("atlas.nav.risk")}</h2>
            {visitedTasks.has("risk") ? (
              <>
                <section className="atlas-tool-card" aria-label={t("advanced.mcTitle")}>
                  <MonteCarloPanel />
                </section>
                <section className="atlas-tool-card" aria-label={t("advanced.scenarioTitle")}>
                  <ScenarioPanel />
                </section>
              </>
            ) : null}
          </div>
          {/* —— 原理档案：纯阅读页（InsightsPanel 整壳迁挂，insights.ts 数据源零改动） —— */}
          <div
            id="atlas-principles"
            role="tabpanel"
            aria-labelledby="atlas-tab-principles"
            tabIndex={0}
            hidden={route.task !== "principles"}
            className="atlas-page atlas-principles"
          >
            <h2 className="atlas-page-title">{t("atlas.nav.principles")}</h2>
            {visitedTasks.has("principles") ? (
              <section className="atlas-principles-body">
                <InsightsPanel />
              </section>
            ) : null}
          </div>
          {/* —— 专业模式：原三组九面板整壳（AdvancedPanel 本体零改，仅接受受控初始
              面板供 `?task=pro&panel=<key>` 落位，§4.1/§4.3） —— */}
          <div
            id="atlas-pro"
            role="tabpanel"
            aria-labelledby="atlas-tab-pro"
            tabIndex={0}
            hidden={route.task !== "pro"}
            className="atlas-page atlas-pro"
          >
            <div className="atlas-pro-topbar">
              <Button size="small" onClick={() => selectTask(lastTaskRef.current)}>
                {t("atlas.pro.backLabel")}
              </Button>
            </div>
            {visitedTasks.has("pro") ? <AdvancedPanel initialPanelKey={route.panel} /> : null}
          </div>
        </div>
      </Content>

      <Footer role="contentinfo" className="wf-footer" style={{ textAlign: "center", padding: "16px 24px" }}>
        <div>
          <Text type="secondary">{t("app.footerDisclaimer")}</Text>
        </div>
        <div>
          <Text type="secondary">{t("app.footerPrivacy")}</Text>
        </div>
      </Footer>
    </Layout>
  );
}
