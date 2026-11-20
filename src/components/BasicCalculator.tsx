/**
 * 基础模式（480 法则基线）：默认首屏，不含任何图表。
 * 输出区（临界值卡片）置顶且始终可见；输入区在其下方。文案经 react-i18next 三语化。
 */
import { Alert, Button, Card, Collapse, Grid, Message, Spin, Switch, Tag, Typography } from "@arco-design/web-react";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { calcBaseline } from "../services/finance";
import { buildShareUrl, copyShareUrl, encodeShareState } from "../services/share";
import { formatMultiplier, formatNumber, formatPercent, formatCompactAxis, toWan } from "../services/format";
import { cnyToDisplay } from "../services/currency";
import { BASELINE_DEFAULTS, MOTION_DURATIONS, resolveThemeTokens } from "../data/defaults";
import { PRESET_PROFILES } from "../data/presets";
import type { PresetBreakdown, PresetId } from "../data/presets";
import type { ThemeTokens } from "../data/types";
import { useCalculatorStore } from "../store/useCalculatorStore";
import { AmountField, FieldRow, IntField, PercentField } from "./fields";
import { useAnimatedNumber, useFinanceCall, useIsCompactViewport, useIsNarrowViewport, useMoney, usePrefersReducedMotion } from "./hooks";

const { Text, Title } = Typography;
const CollapseItem = Collapse.Item;
const { Col } = Grid;

const DEBOUNCE_MS = 300;

/** 「480 法则」名称来源示例（数值全部取自数据层 BASELINE_DEFAULTS） */
const RULE_REAL_PCT = BASELINE_DEFAULTS.nominalReturnPct - BASELINE_DEFAULTS.inflationPct;
const RULE_MULTIPLIER = RULE_REAL_PCT > 0 ? 1200 / RULE_REAL_PCT : 0;

/** 画像预设 id → i18n 名称键的静态映射（禁用模板串拼键） */
const PRESET_NAME_KEY: Record<PresetId, string> = {
  single_renter: "presets.names.singleRenter",
  couple_no_kids: "presets.names.coupleNoKids",
  family_one_kid: "presets.names.familyOneKid",
  zen_frugal: "presets.names.zenFrugal",
};

/** 消费构成固定键集 → i18n 键的静态映射（禁用模板串拼键；排列顺序即展示顺序） */
const PRESET_BREAKDOWN_ORDER: { key: keyof PresetBreakdown; i18nKey: string }[] = [
  { key: "food", i18nKey: "presets.breakdown.food" },
  { key: "housing", i18nKey: "presets.breakdown.housing" },
  { key: "transport", i18nKey: "presets.breakdown.transport" },
  { key: "communication", i18nKey: "presets.breakdown.communication" },
  { key: "other", i18nKey: "presets.breakdown.other" },
];

/** 自由刻度进度环几何常量（docs/p0-spec.md §3.2 逐字规格） */
const RING_RADIUS = 30;
const RING_C = 2 * Math.PI * RING_RADIUS; // ≈ 188.496

/** 月开销敏感性档位（百分比振幅，正 = 调高月开销；展示顺序 +30 → −30） */
const SENS_STEPS = [30, 20, 10, -10, -20, -30] as const;

interface SensitivityRow {
  pct: number;
  /** 该档临界值（元；档位计算失败为 null） */
  critical: number | null;
}

/** 龙卷风图数据行：档位标签 + 透明底段长度 + 偏离段长度与方向（docs/p2-spec.md §6.1 C1） */
interface TornadoRow {
  /** 档位标签（复用 sensitivity.plusRow / minusRow 键） */
  name: string;
  /** 透明底段长度 = min(档位临界值, 基准临界值) */
  base: number;
  /** 彩色段长度 = |档位临界值 − 基准临界值| */
  delta: number;
  /** 临界值高于基准（更难，跌色）；低于为 false（更易，涨色） */
  up: boolean;
}

/** LabelList content 回调的形状（recharts 未导出精确类型，此处窄化已知字段） */
interface BarLabelShape {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
}

/** 输出卡内局部组件：月开销敏感性（docs/p1-spec.md §5 + docs/p2-spec.md §6.1/§6.2；
 * C1 龙卷风图 + C2 加载态；文案经组件内 useTranslation） */
function SensitivitySection(props: {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  rows: SensitivityRow[];
  unavailable: boolean;
  /** 说明行用变动值：父组件按「月开销 × 10% × 乘数」算好经 props 传入（字符串，展示币种口径） */
  delta: string;
  /** 金额展示绑定（展示币种符号 + 换算；p4-spec §3.4） */
  money: (v: number) => string;
  /** CNY → 展示币种数值换算（rate 不可用时为恒等；图表数据与轴同源换算） */
  convert: (v: number) => number;
  /** 基准临界值（主输出 criticalValue；null = 主输出未就绪，不渲染龙卷风图） */
  baseline: number | null;
  /** 主题解析值（resolveThemeTokens 输出） */
  tokens: ThemeTokens;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const { open, onToggle, loading, rows, unavailable, delta, money, convert, baseline, tokens, reducedMotion } = props;
  const plusRows = rows.filter((r) => r.pct > 0);
  const minusRows = rows.filter((r) => r.pct < 0);

  /** C1 ②：按 |档位临界值 − 基准临界值| 降序（layout="vertical" 下数据首行渲染在顶部，
   *  降序数组即「最大在顶」）；档位临界值 null（该档计算失败）不渲染该行。
   *  图表数据换算到展示币种（rate > 0 为线性缩放，方向判定不变；p4-spec §3.5） */
  const tornadoRows: TornadoRow[] =
    baseline === null || !Number.isFinite(baseline)
      ? []
      : rows
          .filter((r): r is SensitivityRow & { critical: number } => r.critical !== null)
          .map((r) => {
            const criticalDisp = convert(r.critical);
            const baselineDisp = convert(baseline);
            return {
              name:
                r.pct > 0
                  ? t("sensitivity.plusRow", { pct: Math.abs(r.pct) })
                  : t("sensitivity.minusRow", { pct: Math.abs(r.pct) }),
              base: Math.min(criticalDisp, baselineDisp),
              delta: Math.abs(criticalDisp - baselineDisp),
              up: criticalDisp > baselineDisp,
            };
          })
          .sort((a, b) => b.delta - a.delta);

  /** C1 ⑨：入场动画三参数与两既有折线图同口径 */
  const barAnimationProps = {
    isAnimationActive: !reducedMotion,
    animationDuration: MOTION_DURATIONS.slow,
    animationEasing: "ease-out",
  } as const;

  /** C1 ⑦：数值标签带符号金额（正 + / 负 −），up 标在段右、down 标在段左（12px chartTick 色） */
  const renderTornadoLabel = (shape: unknown): ReactElement => {
    const p = shape as BarLabelShape;
    const row = tornadoRows[p.index ?? -1];
    if (!row || typeof p.x !== "number" || typeof p.y !== "number" || typeof p.width !== "number" || typeof p.height !== "number") {
      return <g />;
    }
    return (
      <text
        x={row.up ? p.x + p.width + 4 : p.x - 4}
        y={p.y + p.height / 2 + 4}
        textAnchor={row.up ? "start" : "end"}
        fontSize={12}
        fill={tokens.chartTick}
      >
        {`${row.up ? "+" : "−"}${money(row.delta)}`}
      </text>
    );
  };

  return (
    <>
      {/* 展开开关：text 按钮承载「标题 + 展开/收起」，aria-expanded 暴露折叠态 */}
      <Button
        type="text"
        size="small"
        className="wf-sens-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        {t("sensitivity.title")} {open ? t("sensitivity.collapse") : t("sensitivity.expand")}
      </Button>
      {open ? (
        <div className="wf-sens-block">
          {unavailable ? (
            <Alert type="info" content={t("sensitivity.unavailable")} />
          ) : rows.length === 0 ? (
            /* C2 加载态（docs/p2-spec.md §6.2）：研究把空窗定义为「展开后 300ms 防抖 +
             *  wasm 往返期间渲染两个空分组标题」，故空 rows 期间（含防抖窗口）渲染指示器；
             *  已有 rows 时保持旧图原地不闪烁。规范字面条件 loading && rows.length === 0
             *  只覆盖防抖之后（React 18 会把 loading 翻转与结果落值合帧，实测指示器不可见），
             *  此处按研究意图取超集 rows.length === 0（loading 隐含 rows 为空），已登记 deviations */
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Spin size={14} />
              <Text type="secondary">{t("common.computing")}</Text>
            </div>
          ) : (
            <>
              {tornadoRows.length > 0 && baseline !== null ? (
                <div className="wf-sens-chart" role="img" aria-label={t("sensitivity.chartAria")}>
                  <ResponsiveContainer width="100%" height={240}>
                    {/* C1 ①：layout="vertical" + 类目 Y 轴（档位标签）+ 数值 X 轴；总高 240px */}
                    <BarChart data={tornadoRows} layout="vertical" margin={{ top: 16, right: 56, bottom: 0, left: 0 }} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke={tokens.chartGrid} horizontal={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={56}
                        tick={{ fontSize: 12, fill: tokens.chartTick }}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: tokens.chartTick }}
                        tickFormatter={(v: number) => formatCompactAxis(v)}
                      />
                      {/* C1 ④：基准参考线（6 4 虚线同打工模拟目标虚线口径），线顶标注基准值 */}
                      <ReferenceLine
                        x={convert(baseline)}
                        strokeDasharray="6 4"
                        stroke={tokens.textTertiary}
                        label={{
                          value: `${t("sensitivity.baseRefLabel")} ${money(baseline)}`,
                          position: "top",
                          fontSize: 12,
                          fill: tokens.textTertiary,
                        }}
                      />
                      {/* C1 ③：每档两段堆叠——透明底段 + 彩色偏离段（Cell 按方向取色） */}
                      <Bar dataKey="base" stackId="tornado" fill="transparent" isAnimationActive={false} />
                      <Bar dataKey="delta" stackId="tornado" {...barAnimationProps}>
                        {tornadoRows.map((row) => (
                          <Cell key={row.name} fill={row.up ? tokens.fall : tokens.rise} />
                        ))}
                        <LabelList content={renderTornadoLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              {/* C1 ⑧ 方向图例两行（涨跌语义色经 resolveThemeTokens，色盲友好档自动替换） */}
              <div className="wf-sens-legend">
                <span className="wf-sens-legend-row">
                  <span className="wf-sens-legend-dot" style={{ background: tokens.fall }} />
                  {t("sensitivity.legendHigher")}
                </span>
                <span className="wf-sens-legend-row">
                  <span className="wf-sens-legend-dot" style={{ background: tokens.rise }} />
                  {t("sensitivity.legendLower")}
                </span>
              </div>
              {/* C1 ⑧：图下保留分组数值行作数据表替代 */}
              <Text type="secondary" className="wf-sens-group">
                {t("sensitivity.plusTitle")}
              </Text>
              <div className="wf-sens-rows">
                {plusRows.map((row) => (
                  <div key={row.pct} className="wf-sens-row">
                    <Text type="secondary">{t("sensitivity.plusRow", { pct: Math.abs(row.pct) })}</Text>
                    <Text bold>{row.critical === null ? "—" : money(row.critical)}</Text>
                  </div>
                ))}
              </div>
              <Text type="secondary" className="wf-sens-group">
                {t("sensitivity.minusTitle")}
              </Text>
              <div className="wf-sens-rows">
                {minusRows.map((row) => (
                  <div key={row.pct} className="wf-sens-row">
                    <Text type="secondary">{t("sensitivity.minusRow", { pct: Math.abs(row.pct) })}</Text>
                    <Text bold>{row.critical === null ? "—" : money(row.critical)}</Text>
                  </div>
                ))}
              </div>
              <Text type="secondary" className="wf-sens-note">
                {t("sensitivity.note", { pct: 10, delta })}
              </Text>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

interface FreedomGaugeProps {
  /** 资产 ÷ 临界值（> 0） */
  ratio: number;
  /** 展示百分比（真实值，不封顶），如 12.3 */
  pct: number;
  /** 主题解析值（resolveThemeTokens 输出） */
  tokens: ThemeTokens;
  /** 无障碍标签 */
  ariaLabel: string;
  /** 环直径（默认 72；紧凑档 56——viewBox 与内部几何不变，等比缩放，docs/p3-spec.md §6.8 D9） */
  size?: number;
}

/** 自由刻度进度环（内联 SVG，无新依赖；环面文字属装饰重复，读屏以 aria-label 为准） */
function FreedomGauge({ ratio, pct, tokens, ariaLabel, size = 72 }: FreedomGaugeProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <svg
      className="wf-progress-ring"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      role="img"
      aria-label={ariaLabel}
    >
      <circle cx={36} cy={36} r={RING_RADIUS} fill="none" stroke={tokens.chartGrid} strokeWidth={8} />
      <circle
        cx={36}
        cy={36}
        r={RING_RADIUS}
        fill="none"
        stroke={tokens.primary}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - clamped)}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset var(--wf-dur-base) var(--wf-ease-standard)" }}
      />
      <text
        x={36}
        y={36}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight="bold"
        fill={tokens.primary}
      >
        {formatNumber(pct, 1)}%
      </text>
    </svg>
  );
}

export default function BasicCalculator() {
  const { t, i18n } = useTranslation();
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  const setBaseline = useCalculatorStore((s) => s.setBaselineInputs);
  const activePresetId = useCalculatorStore((s) => s.activePresetId);
  const applyPreset = useCalculatorStore((s) => s.applyPreset);
  const clearPreset = useCalculatorStore((s) => s.clearPreset);
  const progressInputs = useCalculatorStore((s) => s.progressInputs);
  const setProgressInputs = useCalculatorStore((s) => s.setProgressInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const resetEpoch = useCalculatorStore((s) => s.resetEpoch);
  const theme = useCalculatorStore((s) => s.theme);
  /** 损坏分享链接回落默认时递增：作为基础输入字段的 key 之一，强制重挂载
   *  以刷新 Arco InputNumber 在用户编辑后不跟随受控值的内部态（验收 Q3-2） */
  const resetKey = "r" + resetEpoch;

  /** 响应式档位（docs/p3-spec.md §6.8 D9）：紧凑档 <640 进度环 56px；窄档 <768 明细拆解折叠 */
  const isCompact = useIsCompactViewport();
  const isNarrow = useIsNarrowViewport();
  /** 明细拆解窄屏折叠态（<768 默认收起、按钮切换；≥768 全量，状态不参与渲染） */
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  /** ⑤ 金额展示绑定（p4-spec §3.4）：展示币种符号 + 换算率；rate null = 换算不可用，
   *  全部金额按 CNY 值直出（符号-only 模式），图表数据经 convert 同源换算 */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** CNY 规范值 → 展示币种数值（图表数据换算；rate 不可用时恒等） */
  const convert = (v: number): number => (rate !== null ? cnyToDisplay(v, rate) : v);
  const planChildren = baseline.childCount > 0;

  // 实时预览（与计算核心公式一致：12 ÷ 实际回报率）
  const realReturnPct = baseline.nominalReturnPct - baseline.inflationPct;
  const multiplierPreview = realReturnPct > 0 ? 1200 / realReturnPct : 0;
  const localInvalid = realReturnPct <= 0;

  const { loading, result } = useFinanceCall(() => calcBaseline(baseline), [baseline], { debounceMs: DEBOUNCE_MS });

  const data = result?.ok === true ? result.data : null;
  const serviceError = result && !result.ok ? result.error : null;
  // 大数字与语义色经主题解析函数取值（规范 6.2 #9）：组件不感知主题，
  // 深浅选组与色盲友好替换均由解析函数完成，深色下自动取提亮变体
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const semanticRise = themeTokens.rise;
  const semanticFall = themeTokens.fall;

  /** 临界值大数字：防抖结果经数值渐近滚动呈现（hook 内部处理首值落值与减弱动效降级） */
  const animatedCritical = useAnimatedNumber(data?.criticalValue ?? 0);
  /** 系统「减弱动态效果」偏好：命中时龙卷风图入场动画停用（C1 ⑨，与既有折线图同口径） */
  const reducedMotion = usePrefersReducedMotion();

  /** 当前生效画像（"custom" 时为 null；Tag 行仅在有画像时渲染） */
  const activeProfile =
    activePresetId === "custom"
      ? null
      : (PRESET_PROFILES.find((p) => p.id === activePresetId) ?? null);

  /** 自由刻度进度环：资产已填 + 防抖结果就绪 + 参数合法（三者全满足才渲染，任一不满足不占位） */
  const gaugeVisible = progressInputs.currentAssets > 0 && data !== null && !localInvalid;
  /** 口径（docs/p0-spec.md §3.2）：ratio = 资产 ÷ 临界值，pct = ratio × 100（真实值，不封顶） */
  const gaugeRatio = data !== null ? progressInputs.currentAssets / data.criticalValue : 0;
  const gaugePct = gaugeRatio * 100;
  const gaugePctText = formatNumber(gaugePct, 1);

  /** sticky 锚点离开视口顶即认为输出卡吸附，切 .wf-is-stuck 状态类（样式由样式层定义） */
  const stickyAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  useEffect(() => {
    const anchor = stickyAnchorRef.current;
    if (!anchor) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  /** ③ 欲望敏感性（docs/p1-spec.md §5）：折叠态零开销；展开时防抖逐档复用 calcBaseline 调用 */
  const [sensOpen, setSensOpen] = useState(false);
  const [sensState, setSensState] = useState<{ loading: boolean; rows: SensitivityRow[] }>({
    loading: false,
    rows: [],
  });

  useEffect(() => {
    if (!sensOpen || localInvalid) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSensState((s) => ({ ...s, loading: true }));
      const results = await Promise.all(
        SENS_STEPS.map(async (pct) => {
          const r = await calcBaseline({
            ...baseline,
            monthlyExpense: Math.round(baseline.monthlyExpense * (1 + pct / 100)),
          });
          return { pct, critical: r.ok && r.data.error === "" ? r.data.criticalValue : null };
        }),
      );
      if (!cancelled) setSensState({ loading: false, rows: results });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sensOpen, baseline, localInvalid]);

  /** 敏感性说明行变动值：月开销 × 10% × 乘数（乘数取核心回显值，未就绪时退回本地预览） */
  const sensDelta = money(baseline.monthlyExpense * 0.1 * (data ? data.multiplier : multiplierPreview));

  /** 复制分享（docs/p3-spec.md §6.7 D8）：原 wf-share-row 按钮逻辑提取为局部函数，
   *  原按钮与 <768 底部吸附条按钮共用同一入口（DRY），逻辑零改动 */
  const handleCopyShare = () => {
    const payload = encodeShareState(useCalculatorStore.getState().buildShareState());
    void copyShareUrl(buildShareUrl(payload)).then((ok) => {
      if (ok) Message.success(t("share.copied"));
      else Message.error(t("share.copyFailed"));
    });
  };
  /** 不可用判定：实际回报率 ≤ 0（与主输出同因）或已计算的档位全部失败；
   * rows 尚未算出（首次展开防抖窗口）不算不可用——沿用空 rows 等待，不显示误导性提示 */
  const sensUnavailable =
    localInvalid || (sensState.rows.length > 0 && sensState.rows.every((r) => r.critical === null));

  return (
    <div>
      {/* sticky 锚点：纯视觉元素，滚动时先于输出卡离开视口顶 */}
      <div ref={stickyAnchorRef} className="wf-sticky-anchor" aria-hidden />
      {/* 输出区：置顶恒可见 */}
      <div className="wf-output-sticky">
        <Card
          className={isStuck ? "wf-output-card wf-is-stuck" : "wf-output-card"}
          title={t("basic.outputTitle")}
          extra={loading ? <Spin size={14} /> : <Text type="secondary">{t("basic.liveUpdate")}</Text>}
        >
          {/* A8 实时区域（p4-spec §7）：视觉隐藏 live 节点常驻 DOM、内容替换式更新——
              只绑落定值（data / gaugePct 均为防抖落定结果；rAF 中间帧不进本节点），
              polite + atomic 整句播报，防抖窗口与键入期间零逐键播报（防噪三规则成文）。
              金额随 ⑤ 换算为展示币种口径。 */}
          <span className="wf-sr-only" aria-live="polite" aria-atomic="true">
            {data
              ? gaugeVisible
                ? `${t("a11y.resultAnnouncement", { value: money(data.criticalValue) })}；${t("a11y.resultAnnouncementAssets", { pct: gaugePctText })}`
                : t("a11y.resultAnnouncement", { value: money(data.criticalValue) })
              : ""}
          </span>
          {localInvalid ? (
            <Alert
              type="error"
              content={t("basic.invalidRealReturn", { pct: formatPercent(realReturnPct) })}
            />
          ) : (
            <>
              {/* 大字号 + 自由刻度进度环并排（环在右、大字号在左；环隐藏时 hero 退化为单元素不跳动）。
                  动画仍滚动 CNY 规范值，换算在格式化处逐帧做（rAF 中间帧不落 store 口径不变） */}
              <div className="wf-output-hero">
                <Title
                  heading={3}
                  className="wf-big-number"
                  style={{ color: themeTokens.primary, fontSize: "var(--wf-text-num)" }}
                >
                  {data ? money(animatedCritical) : "—"}
                </Title>
                {gaugeVisible ? (
                  <FreedomGauge
                    ratio={gaugeRatio}
                    pct={gaugePct}
                    tokens={themeTokens}
                    ariaLabel={t("progress.ariaLabel", { pct: gaugePctText })}
                    size={isCompact ? 56 : 72}
                  />
                ) : null}
              </div>
              {gaugeVisible ? (
                <div className="wf-progress-caption">
                  <Text type="secondary">{t("progress.caption", { pct: gaugePctText })}</Text>
                </div>
              ) : null}
              <div className="wf-output-line">
                <Text>
                  {t("basic.summaryPrefix")}{" "}
                  <Text bold className="wf-nowrap">
                    {data ? (
                      displayCode === "CNY" ? (
                        i18n.language.startsWith("en") ? (
                          // 英文语境用惯用百万读法（163.5 万 → 1.635 million），避免「×10k」被误读为算式
                          `${formatNumber(animatedCritical / 1_000_000, 3)} ${t("units.wanUnit")}`
                        ) : (
                          `${formatNumber(toWan(animatedCritical), 1)} ${t("units.wanUnit")}`
                        )
                      ) : (
                        // ⑤ 非 CNY 展示币种：与 money 同源换算但取数值路径（money 返回已格式化
                        // 字符串不可作 compact 入参），走 Intl compact 统一口径（en 分支删除）
                        formatCompactAxis(convert(animatedCritical))
                      )
                    ) : (
                      "—"
                    )}
                  </Text>{" "}
                  {t("basic.summarySuffix")}
                </Text>
              </div>
              <div className="wf-output-line">
                <Text>
                  {t("basic.savePrefix")}{" "}
                  <Text bold className="wf-nowrap">
                    {formatMultiplier(data ? data.multiplier : multiplierPreview)}
                  </Text>{" "}
                  {t("basic.saveSuffix")}
                </Text>
              </div>
              {/* D9 输出卡紧凑模式（docs/p3-spec.md §6.8）：<768 明细拆解默认收起、按钮切换；
                  ≥768 现状全量。插值参数与原全量态完全一致 */}
              {data ? (
                isNarrow ? (
                  <>
                    <Button
                      type="text"
                      size="small"
                      className="wf-breakdown-toggle"
                      aria-expanded={breakdownOpen}
                      onClick={() => setBreakdownOpen((v) => !v)}
                    >
                      {t("basic.breakdownTitle")} {breakdownOpen ? t("basic.collapse") : t("basic.expand")}
                    </Button>
                    {breakdownOpen ? (
                      <div className="wf-output-breakdown">
                        <Text type="secondary">
                          {t("basic.breakdown", {
                            expense: money(baseline.monthlyExpense),
                            multiplier: formatMultiplier(data.multiplier),
                            children: baseline.childCount,
                            childCost: money(baseline.costPerChild),
                            health: money(baseline.healthReserve),
                            major: money(baseline.majorInvestment),
                          })}
                        </Text>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="wf-output-breakdown">
                    <Text type="secondary">
                      {t("basic.breakdown", {
                        expense: money(baseline.monthlyExpense),
                        multiplier: formatMultiplier(data.multiplier),
                        children: baseline.childCount,
                        childCost: money(baseline.costPerChild),
                        health: money(baseline.healthReserve),
                        major: money(baseline.majorInvestment),
                      })}
                    </Text>
                  </div>
                )
              ) : null}
            </>
          )}
          {!localInvalid && serviceError ? (
            <Alert type="error" style={{ marginTop: 8 }} content={serviceError} />
          ) : null}
          {/* ③ 欲望敏感性：与主输出同条件渲染之外（localInvalid 分支之外），小节本身仍可展开；
              data 未就绪时行值显示「—」（docs/p1-spec.md §5.1） */}
          <SensitivitySection
            open={sensOpen}
            onToggle={() => setSensOpen((v) => !v)}
            loading={sensState.loading}
            rows={sensState.rows}
            unavailable={sensUnavailable}
            delta={sensDelta}
            money={money}
            convert={convert}
            baseline={data ? data.criticalValue : null}
            tokens={themeTokens}
            reducedMotion={reducedMotion}
          />
        </Card>
      </div>

      {/* 输入区 */}
      <Card title={t("basic.inputTitle")} style={{ marginTop: 16 }}>
        {/* ① 预设场景：画像按钮排 + 「自定义」态徽标（docs/p0-spec.md §2.3） */}
        <div className="wf-preset-bar">
          {PRESET_PROFILES.map((profile) => (
            <Button
              key={profile.id}
              size="small"
              className="wf-preset-btn wf-pressable"
              type={activePresetId === profile.id ? "primary" : "default"}
              aria-pressed={activePresetId === profile.id}
              title={activePresetId === profile.id ? t("presets.cancelHint") : undefined}
              onClick={() => {
                if (activePresetId === profile.id) {
                  // 再次点击已激活画像即取消（toggle 语义）：5 字段回落默认、Tag 回「自定义」
                  clearPreset();
                  Message.success(t("presets.cancelled", { name: t(PRESET_NAME_KEY[profile.id]) }));
                } else {
                  applyPreset(profile.id);
                  Message.success(t("presets.appliedHint", { name: t(PRESET_NAME_KEY[profile.id]) }));
                }
              }}
            >
              {t(PRESET_NAME_KEY[profile.id])}
            </Button>
          ))}
          {/* 「自定义」态徽标：非按钮不可点击，高亮由 Tag color 承载 */}
          <Tag className="wf-preset-custom" color={activePresetId === "custom" ? "arcoblue" : "gray"}>
            {t("presets.custom")}
          </Tag>
        </div>
        {/* 消费构成 Tag 行：仅画像生效时渲染（手动修改任一基础字段即隐藏） */}
        {activeProfile ? (
          <div className="wf-preset-tags">
            <Text>
              {t("presets.tagTitle", {
                total: money(activeProfile.baseline.monthlyExpense),
              })}
            </Text>
            <div>
              {PRESET_BREAKDOWN_ORDER.map(({ key, i18nKey }) => (
                <Tag key={key}>
                  {t(i18nKey)} {money(activeProfile.breakdown[key])}
                </Tag>
              ))}
            </div>
            <Text type="secondary" className="wf-preset-note">
              {activeProfile.note}；{t("presets.note")}
            </Text>
          </div>
        ) : null}
        <FieldRow>
          <AmountField
            key={"me-" + resetKey}
            label={t("basic.monthlyExpense")}
            tooltip={t("basic.monthlyExpenseTooltip")}
            value={baseline.monthlyExpense}
            onChange={(v) => setBaseline({ monthlyExpense: v })}
            prefix={symbol}
            suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
            convertRate={rate}
          />
          <Col className="wf-field" xs={24} md={24}>
            <div className="wf-field-label">
              <Text>{t("basic.planChildren")}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {t("basic.planChildrenHint")}
              </Text>
            </div>
            {/* 点击区扩展包装：本体视觉尺寸不变，命中区扩至触控目标档（样式由样式层定义）；
                A3：开关补可访问名称（复用标签文案） */}
            <span className="wf-touch-target">
              <Switch
                className="wf-pressable"
                checked={planChildren}
                aria-label={t("basic.planChildren")}
                onChange={(checked) => setBaseline({ childCount: checked ? 1 : 0 })}
              />
            </span>
          </Col>
          {planChildren ? (
            <>
              <IntField
                md={12}
                key={"cc-" + resetKey}
                label={t("basic.childCount")}
                tooltip={t("basic.childCountTooltip")}
                value={baseline.childCount}
                onChange={(v) => setBaseline({ childCount: v })}
                hint={t("basic.childCountHint")}
              />
              <AmountField
                md={12}
                key={"kc-" + resetKey}
                label={t("basic.childCost")}
                tooltip={t("basic.childCostTooltip")}
                value={baseline.costPerChild}
                onChange={(v) => setBaseline({ costPerChild: v })}
                prefix={symbol}
                suffix={displayCode === "CNY" ? t("units.yuanPerChild") : undefined}
                hint={t("basic.childCostHint")}
                convertRate={rate}
              />
            </>
          ) : null}
          <AmountField
            key={"hr-" + resetKey}
            label={t("basic.healthReserve")}
            tooltip={t("basic.healthReserveTooltip")}
            value={baseline.healthReserve}
            onChange={(v) => setBaseline({ healthReserve: v })}
            prefix={symbol}
            suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
            convertRate={rate}
          />
          <AmountField
            key={"mi-" + resetKey}
            label={t("basic.majorInvestment")}
            tooltip={t("basic.majorInvestmentTooltip")}
            value={baseline.majorInvestment}
            onChange={(v) => setBaseline({ majorInvestment: v })}
            prefix={symbol}
            suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
            hint={t("basic.majorInvestmentHint")}
            convertRate={rate}
          />
          {/* ② 自由刻度：选填已有资产（默认 0 = 未填写 → 进度环隐藏，docs/p0-spec.md §3.2） */}
          <AmountField
            label={t("progress.assetsLabel")}
            tooltip={t("progress.assetsTooltip")}
            value={progressInputs.currentAssets}
            onChange={(v) => setProgressInputs({ currentAssets: v })}
            prefix={symbol}
            suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
            convertRate={rate}
          />
        </FieldRow>

        <Collapse className="wf-core-params" bordered={false}>
          <CollapseItem name="core-params" header={t("basic.coreParams")}>
            <FieldRow>
              <PercentField
                md={12}
                label={t("basic.nominalReturn")}
                tooltip={t("basic.nominalReturnTooltip")}
                value={baseline.nominalReturnPct}
                onChange={(v) => setBaseline({ nominalReturnPct: v })}
                suffix="%"
              />
              <PercentField
                md={12}
                label={t("basic.inflation")}
                tooltip={t("basic.inflationTooltip")}
                value={baseline.inflationPct}
                onChange={(v) => setBaseline({ inflationPct: v })}
                suffix="%"
              />
            </FieldRow>
            <div className="wf-realtime">
              <Text>
                {t("basic.realReturn")}
                <Text bold style={{ color: realReturnPct > 0 ? semanticRise : semanticFall }}>
                  {formatPercent(realReturnPct)}
                </Text>
              </Text>
              <Text>
                {t("basic.multiplierLine")}
                <Text bold>{realReturnPct > 0 ? formatMultiplier(multiplierPreview) : "—"}</Text>
              </Text>
              <Text type="secondary">
                {t("basic.ruleOrigin", {
                  nominal: formatPercent(BASELINE_DEFAULTS.nominalReturnPct, 1),
                  inflation: formatPercent(BASELINE_DEFAULTS.inflationPct, 1),
                  real: formatPercent(RULE_REAL_PCT, 1),
                  multiplier: formatMultiplier(RULE_MULTIPLIER),
                })}
              </Text>
            </div>
          </CollapseItem>
        </Collapse>

        {/* ④ 场景分享：把全部业务输入编码进 URL hash（界面偏好不携带，docs/p1-spec.md §6）。
            切片装配已上移为 store.buildShareState（docs/p2-spec.md §4.3，场景库保存共用同一口径） */}
        <div className="wf-share-row">
          <Button size="small" className="wf-pressable" onClick={handleCopyShare}>
            {t("share.copy")}
          </Button>
          <Text type="secondary">{t("share.copyTooltip")}</Text>
        </div>
        {/* D8 底部吸附操作条：<768 常驻自然可达区 [0.66H, 1.0H]（响应研究 §7.2；样式层断点控制显隐） */}
        <div className="wf-action-dock">
          <Button size="small" type="primary" className="wf-pressable" title={t("share.copyTooltip")} onClick={handleCopyShare}>
            {t("share.copyShort")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
