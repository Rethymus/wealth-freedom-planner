/**
 * 基础模式（480 法则基线）：默认首屏，不含任何图表。
 * 输出区（临界值卡片）置顶且始终可见；输入区在其下方。文案经 react-i18next 三语化。
 */
import { Alert, Button, Card, Collapse, Descriptions, Divider, Grid, Message, Spin, Switch, Tag, Typography } from "@arco-design/web-react";
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
  Tooltip,
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
import FormulaAnatomyRow from "./FormulaAnatomyRow";
import type { AnatomyVar } from "./FormulaAnatomyRow";
import { EmptyRulerArt } from "./EmptyRuler";
import { useAnimatedNumber, useFinanceCall, useFlashOnChange, useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport, useMoney, usePrefersReducedMotion } from "./hooks";

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

/** 自由刻度进度环几何常量（docs/p0-spec.md §3.2 逐字规格；P5 T1 修订：viewBox 扩为 80） */
const RING_RADIUS = 30;
const RING_C = 2 * Math.PI * RING_RADIUS; // ≈ 188.496
/** S1 刻度环几何（p5-spec §3 T1 修订 #2：viewBox 0 0 80 80、圆心 40；刻度点显式 r=38，
 *  38 + 1.2 = 39.2 < 40 出界安全余量 0.8px；环本体几何不变，带域 [26,34]、刻度点在带外沿） */
const RING_CENTER = 40;
const TICK_RADIUS = 38;
const TICK_DOT_R = 1.2;
/** S1 档位宽（百分比）：25/50/75/100 四档刻度 */
const TICK_LEVEL_PCT = 25;
/** S1 档位数（pct 为真实值不封顶，档位封顶 4 = 100% 刻度） */
const TICK_LEVEL_MAX = 4;
/** S2 闩锁滞回带：比率跌破 1 − 0.02 才清达成态——阈值附近来回（1→0.99→1）不重放，
 *  真回落（< 0.98）清位后才可再次庆祝（p5-spec §3 T2 修订 #8） */
const GOAL_LATCH_RELEASE = 0.98;

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
  // P6 S17 已按 §8 降档顺序裁撤（docs/p6-spec.md §8；dist 原始字节门禁实测回写）

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

  /** S25 图表 hover 读数（p6-spec §2）：十字虚线 + 读数气泡（读数窗隐喻延伸到图形）。
   *  cursor 描边取 resolveThemeTokens 解析值（仓库取色纪律：SVG 属性一律经解析函数，
   *  不传 CSS 变量字符串——与其余图表 stroke 取值同口径）；系列名复用既有方向图例键；
   *  触屏无 hover 无气泡，数值信息由图下明细行兜底（R13 aria 链路不重复播报） */
  const renderTornadoTip = (): ReactElement => (
    <Tooltip
      cursor={{ stroke: tokens.textTertiary, strokeDasharray: "3 3" }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const row = payload[0]?.payload as TornadoRow | undefined;
        if (!row) return null;
        return (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{row.name}</div>
            <div className="wf-chart-tip-row">
              <span>{row.up ? t("sensitivity.legendHigher") : t("sensitivity.legendLower")}</span>
              <span className="wf-chart-tip-value">{`${row.up ? "+" : "−"}${money(row.delta)}`}</span>
            </div>
          </div>
        );
      }}
    />
  );

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
                      {/* §6 图表质感：1px 实线网格挂图表网格令牌；横向条形图保持 horizontal={false} */}
                      <CartesianGrid stroke={tokens.chartGrid} horizontal={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={56}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: tokens.chartTick }}
                      />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
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
                      {/* S25 读数气泡 */}
                      {renderTornadoTip()}
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
                    <Text bold>
                      {/* T10 方向冗余编码：调高档数值行前置 ▲ 字形（形状通道独立于颜色） */}
                      <span style={{ fontSize: "var(--wf-text-caption)" }}>▲</span>{" "}
                      {row.critical === null ? "—" : money(row.critical)}
                    </Text>
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
                    <Text bold>
                      {/* T10 方向冗余编码：调低档数值行前置 ▼ 字形 */}
                      <span style={{ fontSize: "var(--wf-text-caption)" }}>▼</span>{" "}
                      {row.critical === null ? "—" : money(row.critical)}
                    </Text>
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
  /** 分享回落 / 参数重置序号：递增即清达成闩锁与刻度档位记录（回落 / 重置后才可再次庆祝） */
  resetEpoch: number;
  /** 系统「减弱动态效果」偏好：命中时不挂动画类（S1 放大 / S2 脉冲停用，变色保留——CSS 兜底块双闸） */
  reducedMotion: boolean;
}

/**
 * 自由刻度进度环（内联 SVG，无新依赖；环面文字属装饰重复，读屏以 aria-label 为准）。
 * P5 签名元素：S1 四档里程碑刻度环（25/50/75/100 四个刻度点，跨档单次放大回落、
 * 每档一次）、S2 达成一次脉冲（全站唯一庆祝动效，闩锁 + 滞回一次性语义）、
 * S11 深色环线抬升（halo 描边环恒渲染，显隐由 CSS [data-theme] 承载）。
 */
function FreedomGauge({ ratio, pct, tokens, ariaLabel, size = 72, resetEpoch, reducedMotion }: FreedomGaugeProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  /** 当前档位（0–4；防抖落定帧纯展示层派生，无数据流改动） */
  const tickLevel = Math.min(TICK_LEVEL_MAX, Math.max(0, Math.floor(pct / TICK_LEVEL_PCT)));
  /** S1 单次放大：档位单调抬升时对当次跨入的刻度点播一次（每档一次；回落不降档、
   *  阈值附近来回不重播） */
  const [popTick, setPopTick] = useState<number | null>(null);
  const maxTickRef = useRef(-1);
  /** S2 达成态（环心文字涨色信息路径）+ 闩锁 ref（滞回：跌破 0.98 才清位） */
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  /** S2 单次脉冲类挂载态（播完即摘类） */
  const [pulseOn, setPulseOn] = useState(false);

  // resetEpoch 递增（分享回落 / 参数重置）：清刻度档位记录与达成闩锁
  useEffect(() => {
    maxTickRef.current = -1;
    setPopTick(null);
    reachedRef.current = false;
    setReached(false);
    setPulseOn(false);
  }, [resetEpoch]);

  // S1 跨档判定：档位抬升 → 对新档刻度点单次放大（reduced-motion 命中不挂动画类，变色保留）
  useEffect(() => {
    if (tickLevel > maxTickRef.current) {
      maxTickRef.current = tickLevel;
      if (!reducedMotion && tickLevel >= 1) setPopTick(tickLevel);
    }
  }, [tickLevel, reducedMotion]);

  // S2 达成判定：ratio ≥ 1 且未闩锁 → 庆祝一次；跌破滞回带清闩锁（回落清位后可再次触发）
  useEffect(() => {
    if (ratio >= 1 && !reachedRef.current) {
      reachedRef.current = true;
      setReached(true);
      if (!reducedMotion) setPulseOn(true);
    } else if (ratio < GOAL_LATCH_RELEASE && reachedRef.current) {
      reachedRef.current = false;
      setReached(false);
      setPulseOn(false);
    }
  }, [ratio, reducedMotion]);

  // 单次动画播完即摘类（基础档计时）：类摘除后同档不重播（maxTickRef / 闩锁仍置位）
  useEffect(() => {
    if (popTick === null) return;
    const timer = window.setTimeout(() => setPopTick(null), MOTION_DURATIONS.base);
    return () => window.clearTimeout(timer);
  }, [popTick]);

  /** 刻度点位置：进度自顶部（−90°）顺时针，每档 90°——25%→3 点钟、50%→6 点、
   *  75%→9 点、100%→12 点钟方向；r = 38 显式数值与 viewBox 80 联动 */
  const ticks = [1, 2, 3, 4].map((i) => {
    const angle = ((-90 + 90 * i) * Math.PI) / 180;
    return {
      level: i,
      cx: RING_CENTER + TICK_RADIUS * Math.cos(angle),
      cy: RING_CENTER + TICK_RADIUS * Math.sin(angle),
      lit: tickLevel >= i,
    };
  });

  return (
    <svg
      className="wf-progress-ring"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={ariaLabel}
    >
      {/* S2 脉冲作用域：环线三件（轨 + halo + 进度）整体 scale，环心文字不参与 */}
      <g className={pulseOn ? "wf-ring-pulse wf-goal-pulse-on" : "wf-ring-pulse"}>
        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke={tokens.chartGrid} strokeWidth={8} />
        {/* S11 深色环线抬升：r = 34 = 环带外沿 1px 提亮描边；浅色由 CSS display:none 隐藏 */}
        <circle className="wf-ring-halo" cx={RING_CENTER} cy={RING_CENTER} r={34} fill="none" stroke={tokens.ringHalo} strokeWidth={1} />
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={tokens.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - clamped)}
          transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          style={{ transition: "stroke-dashoffset var(--wf-dur-base) var(--wf-ease-standard)" }}
        />
      </g>
      {/* S1 四档刻度点：r = 1.2，跨档变色（主色）+ 单次放大回落 */}
      {ticks.map((tick) => (
        <circle
          key={tick.level}
          className={
            ["wf-ring-tick", tick.lit ? "wf-ring-tick-on" : "", popTick === tick.level ? "wf-ring-tick-pop" : ""]
              .filter(Boolean)
              .join(" ")
          }
          cx={tick.cx}
          cy={tick.cy}
          r={TICK_DOT_R}
          fill={tick.lit ? tokens.primary : tokens.chartGrid}
        />
      ))}
      {/* 环心百分比文字：达成态涨色（S2 信息路径，reduced-motion 下保留） */}
      <text
        x={RING_CENTER}
        y={RING_CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight="bold"
        fill={reached ? tokens.rise : tokens.primary}
      >
        {formatNumber(pct, 1)}%
      </text>
    </svg>
  );
}

/**
 * 输出卡构成明细（§4 结构化，p5-spec §4）：原插值长句（basic.breakdown）改 2 列键值表。
 * 「合并的只是表格定义（单份 data 数组）」——<768 仍走既有 toggle（默认收起 +
 * aria-expanded 切换按钮）+ 条件渲染、≥768 常驻，分支行为原样保留（修订 #6）；
 * 外层 .wf-output-breakdown 类名不变（吸附态 D9 隐藏规则依赖它）。
 */
function BreakdownTable(props: {
  expense: string;
  multiplier: string;
  /** P7/E 精确乘数（费雪口径，两位小数——并行展示，无口径切换控件） */
  exactMultiplier: string;
  /** P7/E 精确口径参考线（元，经 money() 币种换算） */
  exactCritical: string;
  children: number;
  childTotal: string;
  health: string;
  major: string;
  total: string;
}) {
  const { t } = useTranslation();
  /** V1（第 1 轮视觉验收 P0）：双栏左栏容器仅 ~351px，viewport 级 md:2 双列内容宽
   *  628px 会被 tabs 裁切层 overflow:hidden 静默裁掉数值列（数值在 DOM 中但不可达）。
   *  ≥1200 双栏激活时切单列键值行（<768 纵排同款布局，375 档验收已验证可用）；
   *  768–1199 单列形态容器宽（≥656px > 628px）维持 md:2 双列不变。
   *  配套 tableLayout fixed：左栏 349px 下最宽 label + 金额值列超过容器，
   *  auto 布局会按组件库 label width:1px 的偏好把 label 列压塌成逐字竖排（白空间换行
   *  规则放开了 min-content）；fixed 布局使 label/值两列均分容器，label 至多折两行、
   *  数值列恒完整。<768 / 768–1199 维持 auto（既有验收基准布局不动）。 */
  const isWorkbench = useIsWorkbenchViewport();
  return (
    <Descriptions
      border
      size="small"
      column={isWorkbench ? 1 : { xs: 1, md: 2 }}
      tableLayout={isWorkbench ? "fixed" : "auto"}
      data={[
        { label: t("basic.rowMultiplier"), value: `${props.expense} × ${props.multiplier}` },
        // P7/E 费雪双口径并列两行（480 教学口径仍为主输出；research §4.2 并行展示、
        // 无口径切换控件；数值全部来自 wasm 输出，前端零复算——单一事实来源）
        { label: t("basic.multiplierExactLabel"), value: props.exactMultiplier },
        ...(props.children > 0
          ? [{ label: t("basic.rowChildren", { children: props.children }), value: props.childTotal }]
          : []),
        { label: t("basic.rowHealth"), value: props.health },
        { label: t("basic.rowMajor"), value: props.major },
        { label: t("basic.rowTotal"), value: props.total },
        { label: t("basic.criticalExactLabel"), value: props.exactCritical },
      ]}
    />
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

  /** T9 = S9 输出卡计算徽标（p5-spec §3 T9 修订 #4 落点：输出卡卡头）：诚实反馈的真缺口是
   *  防抖静默窗口——useFinanceCall 的 loading 在防抖计时后才置位（hooks.ts:45-46），窗口期
   *  卡头 extra 仍显示「实时更新」。业务输入变更置位 pending、loading 翻转或结果落定清位；
   *  pending 时卡挂 .wf-computing，CSS 对卡头 extra 文案呼吸（清位即移除类停循环），
   *  计算开始由既有 Spin 接管、呼吸与 Spin 不并存；reduced-motion 命中 JS 侧直接不挂类。 */
  const [computingPending, setComputingPending] = useState(false);
  const prevResultRef = useRef<typeof result>(null);
  useEffect(() => {
    setComputingPending(true);
  }, [baseline]);
  useEffect(() => {
    if (loading || result !== prevResultRef.current) {
      setComputingPending(false);
      prevResultRef.current = result;
    }
  }, [loading, result]);

  /** T5 = S5 轻确认「已复制」：复制成功回调后按钮内文案换「已复制 ✓」、基础档计时后还原
   *  （p5-spec §3 T5：restore 计时 = MOTION_DURATIONS.base）；既有 Message.success 保留为兜底 */
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  /** T14 = S14 乘数段位徽标：段位判定 = 乘数 ≥ 2 时的整数位（×2 / ×3.33 …）；跨档瞬间
   *  单次涨色——仅「从既有段位跨入新段位」时递增 flash 序号重挂 Tag 触发一次动画
   *  （首挂载不涨色；reduced-motion 下由 CSS 兜底块停动画、Tag 常驻信息不丢） */
  const [multFlashEpoch, setMultFlashEpoch] = useState(0);
  const prevMultSegmentRef = useRef<number | null>(null);
  /** S14 × S16 共存闸：涨色类按「刚跨档」布尔承载（基础档计时摘类，先例 = S1 popTick）。
   *  S16 重挂容器包含段位 Tag——Tag 若常挂动画类会随每次落定重挂重播涨色（把 S14 的
   *  「跨档单发」变成「每落定一发」）；类闸使重挂仅在跨档后的单发窗口内重播，触发时机
   *  与登记语义一致 */
  const [multFlashOn, setMultFlashOn] = useState(false);

  /** WF-04 T2 公式解构（docs/wf04-spec.md §1-T2）：锁定/预览为纯展示态（组件局部 state，
   *  零 store 写入、零参数修改——§4 条 8）；hover 300ms 预览态与锁定态分离，
   *  active = 预览 ?? 锁定（预览临时覆盖、离开回落锁定）；与 S16 共存按 §2-S16
   *  三条款——公式行落 key={flashEpoch} 重挂域之外（不同 DOM 子树，①落点互斥），
   *  落定重挂不扰动 token 焦点与锁定态 */
  const [anatomyLocked, setAnatomyLocked] = useState<AnatomyVar | null>(null);
  const [anatomyPreview, setAnatomyPreview] = useState<AnatomyVar | null>(null);
  const anatomyActive = anatomyPreview ?? anatomyLocked;

  const data = result?.ok === true ? result.data : null;
  const serviceError = result && !result.ok ? result.error : null;
  // 大数字与语义色经主题解析函数取值（规范 6.2 #9）：组件不感知主题，
  // 深浅选组与色盲友好替换均由解析函数完成，深色下自动取提亮变体
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const semanticRise = themeTokens.rise;
  const semanticFall = themeTokens.fall;

  /** 临界值大数字：防抖结果经数值渐近滚动呈现（hook 内部处理首值落值与减弱动效降级）。
   *  S18 可见性闸：宿主根元素经 IntersectionObserver 监听——hidden/视口外暂停 rAF（§6 红线 2） */
  const rootRef = useRef<HTMLDivElement>(null);
  const animatedCritical = useAnimatedNumber(data?.criticalValue ?? 0, undefined, rootRef);
  /** 系统「减弱动态效果」偏好：命中时龙卷风图入场动画停用（C1 ⑨，与既有折线图同口径） */
  const reducedMotion = usePrefersReducedMotion();

  /** S16 输出卡因果闪亮（p6-spec §2）：epoch 由落定值派生（首值不闪，零计算触发）——
   *  ① 汇总/乘数两行经 key={flashEpoch} 重挂承载；② 明细区经 flashOn 类承载
   *  （P5 同落点裁定：明细区禁重挂——展开开关焦点不因落定丢失；
   *  摘类先例 = S1 popTick，slow 档计时后移除） */
  const flashEpoch = useFlashOnChange(data?.criticalValue ?? 0);
  const [breakdownFlashOn, setBreakdownFlashOn] = useState(false);
  useEffect(() => {
    if (flashEpoch === 0) return;
    setBreakdownFlashOn(true);
    const timer = window.setTimeout(() => setBreakdownFlashOn(false), MOTION_DURATIONS.slow);
    return () => window.clearTimeout(timer);
  }, [flashEpoch]);

  /** T14 段位判定：乘数取防抖结果（未就绪退回本地预览）；≥ 2 才有段位（整数位）
   *  跨入新段位时递增 flash 序号重挂 Tag 触发单次涨色（首挂载不涨色） */
  const multiplierValue = data ? data.multiplier : multiplierPreview;
  const multSegment =
    Number.isFinite(multiplierValue) && multiplierValue >= 2 ? Math.floor(multiplierValue) : null;
  useEffect(() => {
    if (multSegment !== null && prevMultSegmentRef.current !== multSegment) {
      if (prevMultSegmentRef.current !== null) {
        setMultFlashEpoch((e) => e + 1);
        setMultFlashOn(true);
      }
      prevMultSegmentRef.current = multSegment;
    } else if (multSegment === null) {
      prevMultSegmentRef.current = null;
    }
  }, [multSegment]);

  // 涨色单发摘类：基础档计时后移除动画类（类摘除后同段位不重播）
  useEffect(() => {
    if (!multFlashOn) return;
    const timer = window.setTimeout(() => setMultFlashOn(false), MOTION_DURATIONS.base);
    return () => window.clearTimeout(timer);
  }, [multFlashOn]);

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
  /** F6（WF-06 P2）：摘要括注按实际预留动态生成——未开启的预留不再写「含」，
      消除「未计划育儿却显示含育儿预留」的误导（走查 F6）；全未开启则句号收尾 */
  const summaryParts = [
    baseline.childCount > 0 ? t("basic.summaryPartChild") : null,
    baseline.healthReserve > 0 ? t("basic.summaryPartHealth") : null,
    baseline.majorInvestment > 0 ? t("basic.summaryPartMajor") : null,
  ].filter((p): p is string => p !== null);
  const summarySuffix =
    summaryParts.length > 0
      ? i18n.language.startsWith("en")
        ? ` (${summaryParts.join(", ")}).`
        : `（${summaryParts.join("、")}）。`
      : t("basic.summarySuffixNone");

  /** 复制分享（docs/p3-spec.md §6.7 D8）：原 wf-share-row 按钮逻辑提取为局部函数，
   *  原按钮与 <768 底部吸附条按钮共用同一入口（DRY）；P5 T5 轻确认：成功回调即换
   *  「已复制 ✓」文案、基础档计时还原（Message.success 兜底链路不变） */
  const handleCopyShare = () => {
    const payload = encodeShareState(useCalculatorStore.getState().buildShareState());
    void copyShareUrl(buildShareUrl(payload)).then((ok) => {
      if (ok) {
        setCopied(true);
        if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopied(false), MOTION_DURATIONS.base);
        Message.success(t("share.copied"));
      } else {
        Message.error(t("share.copyFailed"));
      }
    });
  };
  /** 不可用判定：实际回报率 ≤ 0（与主输出同因）或已计算的档位全部失败；
   * rows 尚未算出（首次展开防抖窗口）不算不可用——沿用空 rows 等待，不显示误导性提示 */
  const sensUnavailable =
    localInvalid || (sensState.rows.length > 0 && sensState.rows.every((r) => r.critical === null));

  return (
    <div ref={rootRef}>
      {/* sticky 锚点：纯视觉元素，滚动时先于输出卡离开视口顶 */}
      <div ref={stickyAnchorRef} className="wf-sticky-anchor" aria-hidden />
      {/* 输出区：置顶恒可见 */}
      <div className="wf-output-sticky">
        <Card
          className={
            [
              "wf-output-card",
              isStuck ? "wf-is-stuck" : "",
              // T9 计算徽标：pending（防抖静默窗口）时呼吸；计算开始 Spin 接管不并存；
              // reduced-motion 命中 JS 侧不挂类（CSS 兜底块双闸）
              computingPending && !loading && !reducedMotion ? "wf-computing" : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
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
                  style={{ color: themeTokens.primary, fontSize: "var(--wf-text-display)" }}
                >
                  {data ? money(animatedCritical) : loading ? <Spin size={24} /> : "—"}
                </Title>
                {gaugeVisible ? (
                  <FreedomGauge
                    ratio={gaugeRatio}
                    pct={gaugePct}
                    tokens={themeTokens}
                    ariaLabel={t("progress.ariaLabel", { pct: gaugePctText })}
                    size={isCompact ? 56 : 72}
                    resetEpoch={resetEpoch}
                    reducedMotion={reducedMotion}
                  />
                ) : progressInputs.currentAssets === 0 && data !== null ? (
                  /* T6 = S6 进度环缺席位（修订 #5 扩围）：资产未填时渲染「未上弦的刻度尺」
                      占位图形（装饰性 aria-hidden，信息由下方引导句承载） */
                  <span className="wf-progress-ring" aria-hidden="true">
                    <EmptyRulerArt size={isCompact ? 56 : 72} />
                  </span>
                ) : null}
              </div>
              {gaugeVisible ? (
                <div className="wf-progress-caption">
                  <Text type="secondary">{t("progress.caption", { pct: gaugePctText })}</Text>
                </div>
              ) : progressInputs.currentAssets === 0 && data !== null ? (
                <div className="wf-progress-caption">
                  <Text type="secondary">{t("progress.emptyHint")}</Text>
                </div>
              ) : null}
              {/* S16 ① 重挂承载：汇总/乘数两行外包 key={flashEpoch} 容器（无状态、无可聚焦元素；
                  epoch 0 首挂不挂类不闪；hero 与明细展开开关严禁进入重挂范围——S1/S2 闩锁与
                  键盘焦点不受扰）。段位 Tag 涨色经 multFlashOn 类闸限定单发（见上方 S14 注释） */}
              <div key={flashEpoch} className={flashEpoch > 0 ? "wf-flash" : undefined}>
                <div className="wf-output-line">
                  <Text>
                    {t("basic.summaryPrefix")}{" "}
                    <Text bold className="wf-nowrap wf-num">
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
                    </Text>
                    {summarySuffix}
                  </Text>
                </div>
                {/* T14 = S14 段位徽标：乘数 ≥ 2 时行尾段位 Tag（key 含 flash 序号——仅真实跨档
                    重挂触发一次涨色；无段位不渲染） */}
                <div className="wf-output-line">
                  <Text>
                    {t("basic.savePrefix")}{" "}
                    <Text bold className="wf-nowrap wf-num">
                      {formatMultiplier(multiplierValue)}
                    </Text>{" "}
                    {t("basic.saveSuffix")}
                    {multSegment !== null ? (
                      <Tag
                        size="small"
                        className={multFlashOn ? "wf-mult-tag" : undefined}
                        key={`${multSegment}-${multFlashEpoch}`}
                        aria-label={t("basic.multTagAria", { mult: formatMultiplier(multiplierValue), n: multSegment })}
                        style={{ marginLeft: 8 }}
                      >
                        {t("basic.multTag", { n: multSegment })}
                      </Tag>
                    ) : null}
                  </Text>
                </div>
              </div>
              {/* D9 输出卡紧凑模式（docs/p3-spec.md §6.8）：<768 明细拆解默认收起、按钮切换；
                  ≥768 现状全量。§4 结构化：插值长句改 2 列键值表（单份表格定义、分支行为
                  原样保留——修订 #6）；≥768 分支补 T7 分组左标线小节头。
                  S16 ② 明细区因果闪亮走 flashOn 类承载（禁重挂——P5 裁定，展开开关焦点不受扰）；
                  S23 已按 §8 降档顺序裁撤（<768 展开分支不再挂进场类） */}
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
                      <div className={breakdownFlashOn ? "wf-output-breakdown wf-flash-single" : "wf-output-breakdown"}>
                        <BreakdownTable
                          expense={money(baseline.monthlyExpense)}
                          multiplier={formatMultiplier(data.multiplier)}
                          exactMultiplier={formatMultiplier(data.multiplierExact)}
                          exactCritical={money(data.criticalValueExact)}
                          children={baseline.childCount}
                          childTotal={money(baseline.childCount * baseline.costPerChild)}
                          health={money(baseline.healthReserve)}
                          major={money(baseline.majorInvestment)}
                          total={money(data.criticalValue)}
                        />
                      <Text type="secondary" className="wf-panel-note">
                        {t("basic.fisherNote")}
                      </Text>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className={breakdownFlashOn ? "wf-output-breakdown wf-flash-single" : "wf-output-breakdown"}>
                    <Divider orientation="left" className="wf-group-line">
                      {t("basic.breakdownTitle")}
                    </Divider>
                    <BreakdownTable
                      expense={money(baseline.monthlyExpense)}
                      multiplier={formatMultiplier(data.multiplier)}
                      exactMultiplier={formatMultiplier(data.multiplierExact)}
                      exactCritical={money(data.criticalValueExact)}
                      children={baseline.childCount}
                      childTotal={money(baseline.childCount * baseline.costPerChild)}
                      health={money(baseline.healthReserve)}
                      major={money(baseline.majorInvestment)}
                      total={money(data.criticalValue)}
                    />
                    <Text type="secondary" className="wf-panel-note">
                      {t("basic.fisherNote")}
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
            highlighted={anatomyActive === "X"}
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
                highlighted={anatomyActive === "N"}
                value={baseline.childCount}
                onChange={(v) => setBaseline({ childCount: v })}
                hint={t("basic.childCountHint")}
              />
              <AmountField
                md={12}
                key={"kc-" + resetKey}
                label={t("basic.childCost")}
                tooltip={t("basic.childCostTooltip")}
                highlighted={anatomyActive === "K"}
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
            highlighted={anatomyActive === "H"}
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
            highlighted={anatomyActive === "M"}
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
                {/* T10 = S10 方向冗余编码：▲/▼ 字形独立于颜色通道（WCAG 1.4.1），
                    字形走 caption 档字号，语义色仍由涨跌令牌承载 */}
                <Text bold style={{ color: realReturnPct > 0 ? semanticRise : semanticFall }}>
                  <span style={{ fontSize: "var(--wf-text-caption)" }}>{realReturnPct > 0 ? "▲" : "▼"}</span>{" "}
                  {formatPercent(realReturnPct)}
                </Text>
              </Text>
              <Text>
                {t("basic.multiplierLine")}
                <Text bold className="wf-num">{realReturnPct > 0 ? formatMultiplier(multiplierPreview) : "—"}</Text>
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

        {/* WF-04 T2 公式解构（docs/wf04-spec.md §1-T2；锚点 = </Collapse> 之后、.wf-share-row
            之前）：480 法则公式行变量 token → 目标输入字段静态描边 + label 加粗（高亮经
            fields highlighted prop，置位/清除成对）。S16 共存：本行在 key={flashEpoch}
            重挂域之外（输入卡尾部 vs 输出卡重挂域）——①落点互斥；S16 主色闪亮落输出卡、
            解构静态描边落输入区字段——②分域共存；S16 防抖落定驱动、解构用户点击驱动且
            纯静态——③时机错峰（§2-S16 表） */}
        <FormulaAnatomyRow
          locked={anatomyLocked}
          planChildren={planChildren}
          onLock={setAnatomyLocked}
          onPreview={setAnatomyPreview}
        />

        {/* ④ 场景分享：把全部业务输入编码进 URL hash（界面偏好不携带，docs/p1-spec.md §6）。
            切片装配已上移为 store.buildShareState（docs/p2-spec.md §4.3，场景库保存共用同一口径） */}
        <div className="wf-share-row">
          <Button size="small" className="wf-pressable" onClick={handleCopyShare}>
            {copied ? `${t("share.copiedShort")} ✓` : t("share.copy")}
          </Button>
          <Text type="secondary">{t("share.copyTooltip")}</Text>
        </div>
        {/* D8 底部吸附操作条：<768 常驻自然可达区 [0.66H, 1.0H]（响应研究 §7.2；样式层断点控制显隐） */}
        <div className="wf-action-dock">
          <Button size="small" type="primary" className="wf-pressable" title={t("share.copyTooltip")} onClick={handleCopyShare}>
            {copied ? `${t("share.copiedShort")} ✓` : t("share.copyShort")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
