/**
 * 应用骨架：顶栏（币种切换 + 色盲友好配色开关 + 语言切换 + 主题切换）、基础计算（默认首屏）、
 * 高级估算（Collapse）、底部免责声明。全部界面文案经 react-i18next 三语化。
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Alert, Button, Layout, Message, Select, Switch, Typography } from "@arco-design/web-react";
import { IconMoonFill, IconSunFill, IconThunderbolt } from "@arco-design/web-react/icon";
import { useTranslation } from "react-i18next";
import { CURRENCIES, MOTION_DURATIONS, THEME, THEME_DARK, resolveThemeTokens } from "./data/defaults";
import type { ThemeMode } from "./data/defaults";
import { persistLanguage, SUPPORTED_LANGS } from "./i18n";
import type { SupportedLang } from "./i18n";
import { formatNumber, formatTimestamp } from "./services/format";
import { useCalculatorStore } from "./store/useCalculatorStore";
import { useDisplayRate } from "./components/hooks";
import BasicCalculator from "./components/BasicCalculator";
import AdvancedPanel from "./components/AdvancedPanel";

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;

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
              onClick={toggleTheme}
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
        {/* 双栏工作台（≥1200，工效裁定：终结桌面单列长滚动——左栏「我的数字」
            常驻（输出卡 + 基础参数，sticky + 视口内自滚动），右栏工作区（高级
            导航 + 面板）；<1200 维持单列（移动优先形态）。见 global.css §工作台。 */}
        <div className="wf-workbench">
          <div className="wf-workbench-primary">
            <BasicCalculator />
          </div>
          <div className="wf-workbench-secondary">
            <AdvancedPanel />
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
