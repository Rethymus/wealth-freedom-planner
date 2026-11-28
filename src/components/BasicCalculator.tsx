/**
 * 基础模式（480 法则基线）＝ freedom 任务页零滚动切换树（docs/p10-spec.md §1.1 F0–F9）：
 * - <1200 双叶形态：F0 叶切换条复合行（计算结果 ⇄ 输入参数，复用 basic.outputTitle/
 *   inputTitle；P10fix §2.5-5 右端 share 图标位——C3 dock 退役一档，中栏叶B share 缺宿主
 *   同步补齐）→
 *   叶A（输出卡：F1 hero / F2 关键读数两行 / F3 槽条 明细⇄敏感性 / F4 等高槽 284——
 *   P10fix §2.5-4 进度说明行并入槽首行 caption）或
 *   叶B（输入卡：F6 预设画像行 / F7 槽条 欲望⇄假设⇄反向估算 / F8 等高槽 280 /
 *   F9 核心参数折叠头 + 公式解构行）；
 * - ≥1200 且 H≥880 双栏同屏（F0/F7 退役；P10fix E1 高度驱动降级——H<880 落叶树，
 *   hooks.ts WORKBENCH_MEDIA_QUERY 增高度维）：左列输入卡全量字段（两列紧凑栅格），
 *   右列输出卡 + 反向卡（ReverseCard 双态恒高 228，修订对照轮二⑧）；
 * - 槽等高互换契约（§2.3）：敏感性从加性折叠改 F3/F4 槽互换（展开不再产生滚动）；
 *   明细拆解 <768 加性 toggle 退役（信息并入 F4 槽「明细」态）；核心参数加性 Collapse
 *   退役（闭合态按 F9 行计预算，展开内容占 F8 槽——§2.3 机制前提）。
 * S1–S26 语义零回退（§6）：S1/S2/S6 宿主输出卡 F1 恒驻区；S9 徽标宿主卡头（<1200 卡头
 * 退役，反馈路径由 F1 hero Spin + 卡类 wf-computing 承载——登记注记）；S14/S16 触发链
 * 不变；S18 可见性闸宿主 = 叶A 卡容器（原根 ref 重挂，语义保留）；S19 hover 选择器已随
 * T12 简化；S25 敏感性触屏兜底行保留（F4 槽内分页第二页，卡内可达）。
 * §3 联动矩阵：childCount=0 谓词折叠「子女预留未启用（预设/）」+「启用」显式按钮
 * （不清 costPerChild、不写死 disabled、不改 applyPreset/clearPreset 写入集）。
 * 输出区置顶恒可见（sticky 退役——「恒可见」由 flex 槽保证，T2 退役登记）；
 * 文案经 react-i18next 三语化。
 */
import { Alert, Button, Card, Descriptions, Grid, Message, Spin, Switch, Tag, Typography } from "@arco-design/web-react";
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
import { AmountField, FieldRow, FieldTip, IntField, PercentField } from "./fields";
import FormulaAnatomyRow from "./FormulaAnatomyRow";
import type { AnatomyVar } from "./FormulaAnatomyRow";
import { EmptyRulerArt } from "./EmptyRuler";
import { SegBar, SlotBox, SlotPager } from "./slots";
import { ReverseCard } from "./advanced/ReversePanel";
import { useAnimatedNumber, useFinanceCall, useFlashOnChange, useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport, useMoney, usePrefersReducedMotion, useShortViewport } from "./hooks";

const { Text, Title } = Typography;
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

/** P10 §1.1 F4 槽下限（明细 ⇄ 敏感性 等高互换；敏感性第二页承载 S25 触屏兜底行）。
 *  骨架修复轮：语义从固定高改为 min-height 下限（槽本体 flex 填充页内剩余空间）。
 *  200 = §1.0a 图槽硬底线；320 档实测分配 212–267（≤240 预算档 ✓，A1 实测裁决） */
const F4_SLOT_HEIGHT = 200;
/** P10 §1.1 F8 槽下限（步骤内容 ⇄ 反向卡 ⇄ 核心参数展开 三态等高互换）。
 *  240 ≤ §1.1 预算档 280；320 档实测分配 ≥290（反向卡 228 ≤ 槽） */
const F8_SLOT_HEIGHT = 240;

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

/**
 * 输出卡敏感性槽内容（docs/p1-spec.md §5 + docs/p2-spec.md §6.1/§6.2；P10 槽化重构）：
 * 加性展开开关退役（F3 槽条承载切换），本组件只渲染槽内容两页——页 1 = 龙卷风图 +
 * 方向图例；页 2 = S25 触屏兜底数值行（六档两列）+ 说明行。页切换经 Pagination mini
 * （等高互换，零新交互词汇）。
 */
function SensitivitySlotContent(props: {
  page: number;
  /** P10 ≤480 紧档：龙卷风图 240→200（D5 320 紧档登记）；骨架修复轮再登记：
   *  矮视口档（高度 <850，1200×800 双栏右列）200→180——图槽本体仍 ≥200 硬底线
   *  （§1.0a），槽内 svg 档位压缩，图例移槽内第二页（方向语义随 ▲▼ 行在位） */
  compact: boolean;
  /** 矮视口档（hooks useShortViewport）：图 180 档 */
  short: boolean;
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
  const { page, compact, short, loading, rows, unavailable, delta, money, convert, baseline, tokens, reducedMotion } = props;
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
   *  cursor 描边取 resolveThemeTokens 解析值；系列名复用既有方向图例键；
   *  触屏无 hover 无气泡，数值信息由 F4 槽第二页兜底行承载（页内可达） */
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

  if (unavailable) {
    return <Alert type="info" content={t("sensitivity.unavailable")} />;
  }
  if (rows.length === 0) {
    /* C2 加载态（docs/p2-spec.md §6.2）：空 rows 期间（含防抖窗口）渲染指示器；
     *  已有 rows 时保持旧图原地不闪烁（超集判定，历史偏差登记保留） */
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Spin size={14} />
        <Text type="secondary">{t("common.computing")}</Text>
      </div>
    );
  }
  return (
    <div className="wf-sens-block">
      {page === 0 ? (
        <>
          {tornadoRows.length > 0 && baseline !== null ? (
            <div className="wf-sens-chart" role="img" aria-label={t("sensitivity.chartAria")}>
              <ResponsiveContainer width="100%" height={compact ? 200 : short ? 180 : 240}>
{/* C1 ①：layout="vertical" + 类目 Y 轴（档位标签）+ 数值 X 轴；高 240（≤480 紧档 200） */}
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
        </>
      ) : (
        <>
          {/* C1 ⑧ 方向图例（骨架修复轮：随数值兜底行移槽内第二页——紧档下与图同页
              折行加高超槽；方向语义同时由兜底行 ▲▼ 字形承载，色盲友好档自动替换） */}
          <div className="wf-sens-legend wf-sens-legend-inline">
            <span className="wf-sens-legend-row">
              <span className="wf-sens-legend-dot" style={{ background: tokens.fall }} />
              {t("sensitivity.legendHigher")}
            </span>
            <span className="wf-sens-legend-row">
              <span className="wf-sens-legend-dot" style={{ background: tokens.rise }} />
              {t("sensitivity.legendLower")}
            </span>
          </div>
          {/* C1 ⑧：数值兜底行两列网格（S25 触屏通道，槽内可达）+ 分组标题并入行首 */}
          <div className="wf-sens-rows-grid">
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
 * 输出卡构成明细（§4 结构化，p5-spec §4）：2 列键值表。
 * P10 槽化：<768 加性 toggle 退役（信息并入 F4 槽「明细」态）；≥1200 双栏左栏容器窄的
 * 单列键值行（V1 既有裁定）保留——workbench 形态（左列 400px）仍走单列 fixed 布局。
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
   *  628px 会被裁切层静默裁掉数值列——workbench 双栏形态切单列键值行；
   *  P10：左列输入卡为独立双栏形态，输出卡右列容器较宽（≥400px），明细表在右列
   *  维持 md:2 双列；仅 <768 窄屏纵排（xs:1）。 */
  const isWorkbench = useIsWorkbenchViewport();
  /** 骨架修复轮（F1/F9 收口）：<768 单列纵排下 7 行明细高 ≈459 > 槽——行分页
   *  3 行/页（320 档实测 459>240 的静默裁切收口）；≥768 md:2 双对列单页不变 */
  const isNarrow = useIsNarrowViewport();
  const [bdPage, setBdPage] = useState(0);
  const rows = [
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
  ];
  const bdTotal = Math.ceil(rows.length / 2);
  const safeBdPage = Math.min(bdPage, bdTotal - 1);
  return (
    <>
      <Descriptions
        border
        size="small"
        column={{ xs: 1, md: 2 }}
        data={isNarrow ? rows.slice(safeBdPage * 2, safeBdPage * 2 + 2) : rows}
      />
      {isNarrow ? (
        <SlotPager label={t("basic.breakdownTitle")} total={bdTotal} page={safeBdPage} onPage={setBdPage} />
      ) : null}
    </>
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

  /** P10 §1.1 树形态：≥1200 双栏同屏（F0/F7 退役），<1200 双叶 + 槽 */
  const isWorkbench = useIsWorkbenchViewport();
  /** F0 叶切换条（<1200；页级 2 段） */
  const [leaf, setLeaf] = useState<"output" | "input">("output");
  /** F3 槽切换条（叶A：明细 ⇄ 敏感性） */
  const [outSlot, setOutSlot] = useState<"breakdown" | "sens">("breakdown");
  /** F4 敏感性态内分页（页 1 图 / 页 2 S25 兜底行——等高互换） */
  const [sensPage, setSensPage] = useState(0);
  /** F7 槽切换条（叶B：①欲望 ②假设与资产 ③反向估算——反向卡为 F8 第三态，
   *  复用 advanced.reverseTitle 既有键承载段标签，零新键） */
  const [inSlot, setInSlot] = useState<"step1" | "step2" | "reverse">("step1");
  /** F9 核心参数折叠头：闭合态按行计预算；激活时内容占 F8 槽（等高互换，§2.3） */
  const [coreOpen, setCoreOpen] = useState(false);

  /** 响应式档位（docs/p3-spec.md §6.8 D9）：紧凑档 <640 进度环 56px（保留） */
  const isCompact = useIsCompactViewport();
  /** 矮视口档（高度 <850，hooks useShortViewport）。P10fix 勘误（§1.1 连带登记）：
   *  注释原文「双栏 1200×800 档环 56」随「双栏 ∧ 矮档」空集化（WORKBENCH_MEDIA_QUERY
   *  增高度维）退役——本判定现服务于叶树/单列形态：S1 环档阶梯 72/56/48（§7-S1
   *  档位扩展登记；56=紧凑档、48=深矮档新档，D9 家族档位压缩延续），龙卷风图 180 档
   *  与反向卡矮档 170 继续生效。hero 行单列 52 / 中栏 60 由环 48 与既有 display/num
   *  字号档自然给出（p10fix-spec §2.3/§2.4 预算）。 */
  const isShort = useShortViewport();
  /** P10fix §2.5-3：S1 环档阶梯（72 默认 / 56 紧凑 / 48 深矮档）；图形宿主（空态刻度尺）同档 */
  const gaugeSize = isShort ? 48 : isCompact ? 56 : 72;

  /** ⑤ 金额展示绑定（p4-spec §3.4）：展示币种符号 + 换算率；rate null = 换算不可用，
   *  全部金额按 CNY 值直出（符号-only 模式），图表数据经 convert 同源换算 */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** CNY 规范值 → 展示币种数值（图表数据换算；rate 不可用时恒等） */
  const convert = (v: number): number => (rate !== null ? cnyToDisplay(v, rate) : v);
  /** §3.1 现状派生保留：计划育儿开关谓词（单一派生源，§3.4 折叠态与之互斥共用） */
  const planChildren = baseline.childCount > 0;

  // 实时预览（与计算核心公式一致：12 ÷ 实际回报率）
  const realReturnPct = baseline.nominalReturnPct - baseline.inflationPct;
  const multiplierPreview = realReturnPct > 0 ? 1200 / realReturnPct : 0;
  const localInvalid = realReturnPct <= 0;

  const { loading, result } = useFinanceCall(() => calcBaseline(baseline), [baseline], { debounceMs: DEBOUNCE_MS });

  /** T9 = S9 输出卡计算徽标（p5-spec §3 T9）：防抖静默窗口期呼吸。P10 登记注记：
   *  宿主卡头 <1200 退役（F0 承载标题），呼吸视觉仅 ≥1200 双栏呈现；<1200 反馈路径 =
   *  hero 大数字位 Spin（loading）+ 输入卡字段即时回显——语义链（pending 置位/清位）
   *  原样保留，卡片恒挂 .wf-computing 供样式层扩展。 */
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
  /** S14 × S16 共存闸：涨色类按「刚跨档」布尔承载（基础档计时摘类，先例 = S1 popTick） */
  const [multFlashOn, setMultFlashOn] = useState(false);

  /** WF-04 T2 公式解构（docs/wf04-spec.md §1-T2）：锁定/预览为纯展示态（组件局部 state，
   *  零 store 写入、零参数修改——§4 条 8）；hover 300ms 预览态与锁定态分离 */
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
   *  S18 可见性闸：宿主根元素经 IntersectionObserver 监听——hidden/视口外暂停 rAF（§6 红线 2）。
   *  P10 §6-S18 迁移落点：宿主 ref 随叶A 卡容器重挂（原根 ref 同位保留） */
  const rootRef = useRef<HTMLElement>(null);
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

  /** T14 段位判定：乘数取防抖结果（未就绪退回本地预览）；≥ 2 才有段位（整数位） */
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

  /** ③ 欲望敏感性（docs/p1-spec.md §5）：槽化后防抖逐档复算随「敏感性」态激活；
   *  槽内容未激活时零计算（保持既有折叠态零开销口径） */
  const [sensState, setSensState] = useState<{ loading: boolean; rows: SensitivityRow[] }>({
    loading: false,
    rows: [],
  });

  useEffect(() => {
    if (outSlot !== "sens" || localInvalid) return;
    if (sensState.rows.length > 0) {
      // 已有行时仍需随 baseline 重算——走下方 timer；此处不短路
    }
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
  }, [outSlot, baseline, localInvalid]);

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
   *  分享行与 C3 dock 静态行共用同一入口（DRY）；P5 T5 轻确认：成功回调即换
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

  /** ⑦ 欲望敏感性数据（槽内复算结果） */
  const breakdownTable = data ? (
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
  ) : null;

  /** —— 共用块：预设画像行（F6） —— */
  const presetBar = (
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
      {/* 「自定义」态徽标：非按钮不可点击，高亮由 Tag color 承载（栅格第 5 格，防换行加高） */}
      <Tag className="wf-preset-custom" color={activePresetId === "custom" ? "arcoblue" : "gray"}>
        {t("presets.custom")}
      </Tag>
    </div>
  );

  /** —— 共用块：消费构成 Tag 行（预设生效时渲染；槽态紧凑 = 口径注下沉 FieldTip，
   *  桌面全量 = 注文可见——P5 反冗长 caption 口径与信息路径两全） —— */
  const presetTagsRow = activeProfile ? (
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
        {/* P10 槽态：两条口径注（画像 note + presets.note）下沉 FieldTip（<1200）；桌面保留注行 */}
        {isWorkbench ? null : <FieldTip text={`${activeProfile.note}；${t("presets.note")}`} />}
      </div>
      {isWorkbench ? (
        <Text type="secondary" className="wf-preset-note">
          {activeProfile.note}；{t("presets.note")}
        </Text>
      ) : null}
    </div>
  ) : null;

  /** —— 共用块：核心参数（回报率与通胀）+ 实时区（桌面内联展开 / 叶B 经 F9 折叠头占 F8 槽） —— */
  const coreParamsBlock = (
    <>
      <div className="wf-slot-fields">
        <PercentField
          xs={12}
          md={12}
          label={t("basic.nominalReturn")}
          tooltip={t("basic.nominalReturnTooltip")}
          value={baseline.nominalReturnPct}
          onChange={(v) => setBaseline({ nominalReturnPct: v })}
          suffix="%"
        />
        <PercentField
          xs={12}
          md={12}
          label={t("basic.inflation")}
          tooltip={t("basic.inflationTooltip")}
          value={baseline.inflationPct}
          onChange={(v) => setBaseline({ inflationPct: v })}
          suffix="%"
        />
      </div>
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
        {/* 第 2 轮验收 F-03（freedom F9 展开态 375×667 dy=33）：口径来源注紧档转 sr-only
            （读屏可达、零布局高度——ReverseCard 口径注同款先例；L3 前置行已有同源简化
            公式行，视觉路径零丢失。桌面 ≥768 原样） */}
        <Text type="secondary" className={isCompact ? "wf-panel-note wf-sr-only" : undefined}>
          {t("basic.ruleOrigin", {
            nominal: formatPercent(BASELINE_DEFAULTS.nominalReturnPct, 1),
            inflation: formatPercent(BASELINE_DEFAULTS.inflationPct, 1),
            real: formatPercent(RULE_REAL_PCT, 1),
            multiplier: formatMultiplier(RULE_MULTIPLIER),
          })}
        </Text>
      </div>
    </>
  );

  /** —— 共用块：子女预留字段组（§3.4：childCount=0 谓词折叠态，预设归因 + 显式启用） —— */
  const childFields = planChildren ? (
    <>
      <IntField
        xs={12}
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
        xs={12}
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
  ) : (
    /* §3.4 折叠态：显式归因（预设 / custom 两文案）+「启用」文字按钮（= 置开开关，
        setBaseline({ childCount: 1 }) 回场即 costPerChild 现值——预设下 58 万；
        aria 用同一文案，禁 title-only；不清 costPerChild、不写死 disabled） */
    <div className="wf-child-folded">
      <Text type="secondary">
        {activePresetId !== "custom" ? t("presets.childFoldedPreset") : t("presets.childFolded")}
      </Text>
      <Button
        type="text"
        size="mini"
        className="wf-pressable"
        aria-label={
          activePresetId !== "custom" ? t("presets.childFoldedPreset") : t("presets.childFolded")
        }
        onClick={() => setBaseline({ childCount: 1 })}
      >
        {t("presets.childEnable")}
      </Button>
    </div>
  );

  /** —— 共用块：欲望三字段 + 育儿开关（F7 步骤①；桌面同栅格） —— */
  const desireFields = (
    <>
      <AmountField
        xs={12}
        md={12}
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
      <Col className="wf-field" xs={12} md={12}>
        <div className="wf-field-label">
          <Text>{t("basic.planChildren")}</Text>
          {/* 提示文案下沉 FieldTip（槽态紧凑；键盘可达，A5 先例） */}
          <FieldTip text={t("basic.planChildrenHint")} />
        </div>
        {/* 点击区扩展包装：本体视觉尺寸不变，命中区扩至触控目标档；
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
      {childFields}
    </>
  );

  /** —— 共用块：假设与资产字段（F7 步骤②）。≤480 紧档：两行 hint 下沉 FieldTip
   *  （槽 260 内字段行高 74；信息路径零丢失——P5 出处/提示 tooltip 判据） —— */
  const assumptionFields = (
    <>
      <AmountField
        xs={12}
        md={12}
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
        xs={12}
        md={12}
        key={"mi-" + resetKey}
        label={
          isCompact ? (
            <span>
              {t("basic.majorInvestment")}
              <FieldTip text={t("basic.majorInvestmentHint")} />
            </span>
          ) : (
            t("basic.majorInvestment")
          )
        }
        tooltip={t("basic.majorInvestmentTooltip")}
        highlighted={anatomyActive === "M"}
        value={baseline.majorInvestment}
        onChange={(v) => setBaseline({ majorInvestment: v })}
        prefix={symbol}
        suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
        hint={isCompact ? undefined : t("basic.majorInvestmentHint")}
        convertRate={rate}
      />
      {/* ② 自由刻度：选填已有资产（默认 0 = 未填写 → 进度环隐藏，docs/p0-spec.md §3.2） */}
      <AmountField
        xs={12}
        md={12}
        label={t("progress.assetsLabel")}
        tooltip={t("progress.assetsTooltip")}
        value={progressInputs.currentAssets}
        onChange={(v) => setProgressInputs({ currentAssets: v })}
        prefix={symbol}
        suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
        convertRate={rate}
      />
    </>
  );

  /** —— 叶A：输出卡（F1 hero / F2 关键读数两行 / F3 槽条 / F4 等高槽） —— */
  const outputCard = (
    <section ref={rootRef} aria-label={t("basic.outputTitle")}>
      <div>
        <Card
          className={
            [
              "wf-output-card",
              // T9 计算徽标：pending（防抖静默窗口）时呼吸；计算开始 Spin 接管不并存；
              // reduced-motion 命中 JS 侧不挂类（CSS 兜底块双闸）
              computingPending && !loading && !reducedMotion ? "wf-computing" : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
          title={isWorkbench ? t("basic.outputTitle") : undefined}
          extra={
            isWorkbench ? (
              loading ? (
                <Spin size={14} />
              ) : (
                <Text type="secondary">{t("basic.liveUpdate")}</Text>
              )
            ) : undefined
          }
        >
          {/* A8 实时区域（p4-spec §7）：视觉隐藏 live 节点常驻 DOM、内容替换式更新——
              只绑落定值，polite + atomic 整句播报，防抖窗口与键入期间零逐键播报 */}
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
              {/* F1 读数窗区：大字号 + 进度环并排（环在右）；<1200 卡头退役，
                  basic.liveUpdate 并入进度说明 caption（信息迁移登记 §1.1） */}
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
                    size={gaugeSize}
                    resetEpoch={resetEpoch}
                    reducedMotion={reducedMotion}
                  />
                ) : progressInputs.currentAssets === 0 && data !== null ? (
                  /* T6 = S6 进度环缺席位（修订 #5 扩围）：资产未填时渲染「未上弦的刻度尺」
                      占位图形（装饰性 aria-hidden，信息由引导句承载——引导句经 P10fix
                      §2.5-4 并入 F4 槽首行 caption） */
                  <span className="wf-progress-ring" aria-hidden="true">
                    <EmptyRulerArt size={gaugeSize} />
                  </span>
                ) : null}
              </div>
              {/* P10fix §2.5-4：进度说明行/空态引导行并入 F4 槽内容（槽内首行 caption，
                  省 22px 常驻行——渲染点移至下方 SlotBox 首子；内容与条件零变化，
                  basic.liveUpdate ≥1200 双栏仍由卡头 extra 承载） */}
              {/* F2 关键读数两行：S16 ① 重挂承载（key={flashEpoch}；hero 与槽条严禁进入
                  重挂范围——S1/S2 闩锁与键盘焦点不受扰）。段位 Tag 涨色经 multFlashOn 类闸 */}
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
                          // 字符串不可作 compact 入参），走 Intl compact 统一口径
                          formatCompactAxis(convert(animatedCritical))
                        )
                      ) : (
                        "—"
                      )}
                    </Text>
                    {summarySuffix}
                  </Text>
                </div>
                {/* T14 = S14 段位徽标：乘数 ≥ 2 时行尾段位 Tag（key 含 flash 序号） */}
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
              {/* F3 槽切换条：明细 ⇄ 敏感性（复用既有键，零新键；Radio 语义 = §10 红线 4） */}
              <SegBar
                name="wf-f3-outslot"
                ariaLabel={t("basic.breakdownTitle")}
                value={outSlot}
                onChange={(v: string) => setOutSlot(v as "breakdown" | "sens")}
                options={[
                  { value: "breakdown", label: t("basic.breakdownTitle") },
                  { value: "sens", label: t("sensitivity.title") },
                ]}
              />
              {/* F4 等高槽（284）：明细 ⇄ 敏感性 等高互换；敏感性态内两页（图 / S25 兜底行）。
                  P10fix §2.5-4：进度说明行并入槽内首行 caption（原独立行退役，省 22px） */}
              <SlotBox height={F4_SLOT_HEIGHT}>
                {gaugeVisible ? null : (
                  <div className="wf-progress-caption">
                    <Text type="secondary">
                      {progressInputs.currentAssets === 0 && data !== null ? t("progress.emptyHint") : ""}
                      {!isWorkbench ? ` · ${t("basic.liveUpdate")}` : ""}
                    </Text>
                  </div>
                )}
                {outSlot === "breakdown" ? (
                  <div className={breakdownFlashOn ? "wf-output-breakdown wf-flash-single" : "wf-output-breakdown"}>
                    {breakdownTable}
                    {/* 骨架修复轮：紧凑档口径注沉降 FieldTip（P5 反冗长口径，全文零丢失） */}
                    {isCompact ? (
                      <span className="wf-panel-note" style={{ display: "inline-flex", alignItems: "center" }}>
                        <FieldTip text={t("basic.fisherNote")} />
                      </span>
                    ) : (
                      <Text type="secondary" className="wf-panel-note">
                        {t("basic.fisherNote")}
                      </Text>
                    )}
                  </div>
                ) : (
                  <>
                    <SensitivitySlotContent
                      page={sensPage}
                      compact={isCompact}
                      short={isShort}
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
                    <SlotPager label={t("sensitivity.title")} total={2} page={sensPage} onPage={setSensPage} />
                  </>
                )}
              </SlotBox>
            </>
          )}
          {!localInvalid && serviceError ? (
            <Alert type="error" style={{ marginTop: 8 }} content={serviceError} />
          ) : null}
        </Card>
      </div>
    </section>
  );

  /** —— 共用块：公式解构行（S16 ③落点互斥既有口径；两形态同源） —— */
  const anatomyRow = (
    <FormulaAnatomyRow
      locked={anatomyLocked}
      planChildren={planChildren}
      onLock={setAnatomyLocked}
      onPreview={setAnatomyPreview}
    />
  );

  /** —— 共用块：场景分享行（④；dock 单实例另行承载） —— */
  const copyLabel = copied ? `${t("share.copiedShort")} ✓` : t("share.copy");

  /** —— 叶B：输入卡（F6 预设行入 F8 槽首行——≤480 紧档登记：独立 F6 行使叶B 超页框
   *  23px（实测 750>565），移入槽内信息路径零丢失 / F7 槽条 / F8 等高槽 / F9 折叠头 +
   *  公式解构行 / C3 dock） —— */
  const inputCardTree = (
    <Card
      className="wf-input-card"
      aria-label={t("basic.inputTitle")}
    >
      {/* F7 槽切换条：欲望 / 假设与资产 / 反向估算（复用 basic.stepDesire / stepAssumption /
          advanced.reverseTitle，零新键） */}
      <SegBar
        name="wf-f7-inslot"
        ariaLabel={t("basic.inputTitle")}
        value={coreOpen ? "" : inSlot}
        onChange={(v: string) => {
          setInSlot(v as "step1" | "step2" | "reverse");
          setCoreOpen(false);
        }}
        options={[
          { value: "step1", label: t("basic.stepDesire") },
          { value: "step2", label: t("basic.stepAssumption") },
          { value: "reverse", label: t("advanced.reverseTitle") },
        ]}
      />
      {/* F8 等高槽（≤480 紧档 260）：步骤内容（首行 F6 预设画像）⇄ 反向卡（双态）⇄ 核心参数展开 */}
      <SlotBox height={F8_SLOT_HEIGHT}>
        {coreOpen ? (
          coreParamsBlock
        ) : inSlot === "step1" ? (
          <FieldRow className="wf-slot-row">{presetBar}{desireFields}{presetTagsRow ? <Col xs={24} md={24}>{presetTagsRow}</Col> : null}</FieldRow>
        ) : inSlot === "step2" ? (
          <FieldRow className="wf-slot-row">{assumptionFields}</FieldRow>
        ) : (
          <ReverseCard />
        )}
      </SlotBox>
      {/* F9 假设折叠头（闭合态 44）+ 公式解构行（44）：展开走 F8 槽（§2.3 槽契约） */}
      <div className="wf-core-row">
        <Button
          type="text"
          size="small"
          className="wf-core-toggle wf-pressable"
          aria-expanded={coreOpen}
          onClick={() => setCoreOpen((v) => !v)}
        >
          {t("basic.coreParams")} {coreOpen ? t("basic.collapse") : t("basic.expand")}
        </Button>
      </div>
      {anatomyRow}
    </Card>
  );

  /** —— 桌面左列：输入卡全量（F0/F7 退役；核心参数内联展开；消费构成注行保留） —— */
  const inputCardFull = (
    <Card className="wf-input-card" aria-label={t("basic.inputTitle")}>
      {presetBar}
      {presetTagsRow}
      <FieldRow className="wf-slot-row">
        {desireFields}
        {assumptionFields}
      </FieldRow>
      {coreParamsBlock}
      {anatomyRow}
      {/* ④ 场景分享：把全部业务输入编码进 URL hash（界面偏好不携带，docs/p1-spec.md §6）。
          骨架修复轮：说明长句沉降 FieldTip（双栏左列恒 400px 宽，长句折行实测 132px
          ——1200×800/1440×900 页栈超预算的共同构成行；说明全文零丢失，P5 口径） */}
      <div className="wf-share-row">
        <Button size="small" className="wf-pressable" onClick={handleCopyShare}>
          {copyLabel}
        </Button>
        <FieldTip text={t("share.copyTooltip")} />
      </div>
    </Card>
  );

  /** —— 树形态渲染（<1200）：F0 叶切换条复合行（P10fix §2.5-5：叶条＋右端 share 图标位）
   *  + 单叶。原 C3 dock 行退役一档：<768 分享入口上收 F0 复合行（44 命中不变、更靠上）；
   *  ≥768 中栏叶B 原 share 缺宿主（dock 仅 <768 放行、wf-share-row 仅双栏左列渲染）由
   *  本复合行补齐（§2.3 叶B 预算行）；copyLabel 已复制轻确认（T5）保留于图标 aria。 —— */
  if (!isWorkbench) {
    return (
      <div className="wf-freedom-tree">
        {/* F0 叶切换条（页级 2 段；复用 basic.outputTitle / basic.inputTitle，卡头 <1200
            退役后两卡标题信息路径由本条承载——§1.1 卡壳规则）＋ share 钮位（P10fix
            §2.5-5 复合行：栅格两列「叶条 minmax(0,1fr)｜钮 auto」，叶条吃满余宽、
            行高/页距复用叶条自身 margin 档 8/深矮档 2——零新 CSS 档）。
            P10fix 尺寸门禁降档登记（§9.2 降档序③同类）：图标位降为紧凑文本钮——
            复用 T5 copyLabel（已复制 ✓ 轻确认随钮承载，aria 由可见文本自带），
            新图标组件不进包；44 命中随触屏档全局 min-height 规则不变 */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
          <SegBar
            name="wf-f0-leaf"
            ariaLabel={t("atlas.nav.freedom")}
            value={leaf}
            onChange={(v: string) => setLeaf(v as "output" | "input")}
            options={[
              { value: "output", label: t("basic.outputTitle") },
              { value: "input", label: t("basic.inputTitle") },
            ]}
          />
          <Button size="mini" className="wf-pressable" onClick={handleCopyShare}>
            {copyLabel}
          </Button>
        </div>
        {leaf === "output" ? outputCard : inputCardTree}
      </div>
    );
  }

  /** —— 双栏形态渲染（≥1200）：左列输入全量 / 右列输出 + 反向卡（右列恒驻） —— */
  return (
    <div className="wf-freedom-split">
      <div className="wf-freedom-col wf-freedom-left">{inputCardFull}</div>
      <div className="wf-freedom-col wf-freedom-right">
        {outputCard}
        <ReverseCard />
      </div>
    </div>
  );
}
