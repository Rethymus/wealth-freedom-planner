/**
 * ④ 蒙特卡洛模拟：手动运行 → loading → 耗尽概率、分位数终值 + 折线图
 * （50 条低透明度抽样路径 + 逐年中位数粗线；入场动画按设计规范
 *   第 4 节 #11 与第 8 节启用：慢档时长令牌 + 渐近族最近预设，减弱动效时停用；
 *   网格线/刻度/路径/语义色为 SVG 属性，经主题解析函数按当前主题组与
 *   色盲友好开关取解析值，不传 CSS 变量字符串——规范第 8 节取色口径）。
 * P2 新增（docs/p2-spec.md §2.4 / §3.4 / §6.5 / §6.6）：支取策略三选一与策略参数、
 * 初始支取率与末年支取额三分位行、序列风险对照子区（确定性，组件本地状态不入 store）、
 * 图表 role="img" + aria 汇总句、未运行空态改用 Empty 组件。
 * 文案经 react-i18next 三语化；纵轴「万」刻度随语言切换（英文为 ×10k）。
 */
import {Alert, Button, Descriptions, Empty, Grid, Progress, Radio, Select, Spin, Switch, Typography} from "@arco-design/web-react";
import { IconLock } from "@arco-design/web-react/icon";
import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calcMonteCarlo,
  calcMonteCarloBootstrap,
  calcSequence,
  runSequenceReorder,
  runSequenceRolling,
  selectFateWindows,
} from "../../services/finance";
import type { FateWindow } from "../../services/finance";
import type { FinanceResult } from "../../services/finance";
import { formatNumber, formatCompactAxis, formatMoney } from "../../services/format";
import { cnyToDisplay } from "../../services/currency";
import { LIMITS, MONTE_CARLO_STRATEGY_DEFAULTS, MOTION_DURATIONS, resolveThemeTokens } from "../../data/defaults";
import { INDEX_ORDER, INDEX_SERIES } from "../../data/indexSeries";
import type { IndexId, MonteCarloReturnMode } from "../../data/indexSeries";
import type { MonteCarloOutput, SequenceDirection, SequenceSimOutput, WithdrawalStrategy } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, FieldTip, IntField, NumberField, PathsField, PercentField } from "../fields";
import { SegBar, SlotBox, SlotPager } from "../slots";
import { EmptyRulerArt } from "../EmptyRuler";
import { compactXInterval, useAnimatedNumber, useChartMetrics, useIsNarrowViewport, useMoney, usePrefersReducedMotion } from "../hooks";

const { Text } = Typography;
const { Col } = Grid;

/** 折线图最多展示的抽样路径条数（契约 samplePaths 为 50 条代表路径） */
const MAX_CHART_PATHS = 50;
/** 模拟年限 UI 限额（数据层 LIMITS 集中维护；同时控制图表规模） */
const YEARS_LIMIT = LIMITS.simYears;
/** 序列风险对照：年储蓄默认（= 研究口径「年投 12 万」，docs/p2-spec.md §3.4） */
const SEQ_ANNUAL_SAVING_DEFAULT = 120000;
/** 序列风险对照：初始支取率默认 4%（docs/p2-spec.md §3.4） */
const SEQ_INITIAL_RATE_DEFAULT = 4;
/** 序列风险对照：滚动窗长默认 10 年（docs/p2-spec.md §3.4） */
const SEQ_WINDOW_YEARS_DEFAULT = 10;

/** 指数 id → i18n 显示名键（禁用模板串拼键） */
const INDEX_NAME_KEY: Record<IndexId, string> = {
  csi300: "mc.indexCsi300",
  sp500: "mc.indexSp500",
};
/** 序列口径说明键 */
const INDEX_KIND_KEY: Record<IndexId, string> = {
  csi300: "mc.seriesPriceOnly",
  sp500: "mc.seriesTotalReturn",
};

/** 图表数据行：逐年各路径值 + 逐年中位数（命运曲线图为三条命运线） */
type ChartRow = Record<string, number | string>;

/** 序列风险对照结果（滚动 / 三序两形态，docs/p2-spec.md §3.4） */
type SeqState =
  | { kind: "rolling"; windows: FateWindow[]; bestIndex: number; medianIndex: number; worstIndex: number }
  | { kind: "reorder"; original: SequenceSimOutput; ascending: SequenceSimOutput; descending: SequenceSimOutput };

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function MonteCarloPanel() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const inputs = useCalculatorStore((s) => s.monteCarloInputs);
  const setInputs = useCalculatorStore((s) => s.setMonteCarloInputs);
  const returnMode = useCalculatorStore((s) => s.monteCarloReturnMode);
  const setReturnMode = useCalculatorStore((s) => s.setMonteCarloReturnMode);
  const seriesId = useCalculatorStore((s) => s.monteCarloSeriesId);
  // P7/P0-3：旧链接/外来载荷「通胀上调」正名并入 fixed 后的一次性提示（瞬态，
  // 不入 share 载荷 / 不入情景存档 / resetEpoch 语义不变）；关闭或切换策略即清除
  const strategyLegacyNotice = useCalculatorStore((s) => s.strategyLegacyNotice);
  const clearStrategyLegacyNotice = useCalculatorStore((s) => s.clearStrategyLegacyNotice);
  const setSeriesId = useCalculatorStore((s) => s.setMonteCarloSeriesId);
  /** F1 支出口径一致性：自由刻度「每月开销」为支出口径锚点——仅用于一致性警示与显式
   *  同步按钮（用户显式点击才写入），不引入静默联动（数据流零改动） */
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  /** P10 §4 单源化：mcMeansSynced = true（默认锁态）时两均值显示层取 baseline 派生直显、
   *  运行提交帧同帧解析覆盖（与 AccumulationPanel run() effectiveTarget「同一值、同一帧」
   *  先例同构）；锁态零 monteCarloInputs 写入（数据流铁律）。解锁 = 显式动作：同时把当刻
   *  核心值落入面板切片（消除解锁即见旧值的错位），此后与核心参数无关联 */
  const mcMeansSynced = useCalculatorStore((s) => s.mcMeansSynced);
  const setMcMeansSynced = useCalculatorStore((s) => s.setMcMeansSynced);
  /** 锁态运行提交帧：两均值取 baseline 现值（inflationMean 两模式都参与正态抽样故两模式
   *  都覆盖；returnMean 仅 normal 消费，bootstrap 下传入无害——分布由所选序列决定） */
  const effectiveInputs = mcMeansSynced
    ? { ...inputs, nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct }
    : inputs;
  /** 解锁（显式动作）：口径标志置 false + 当刻核心值落入切片（回场值即所见值，无错位） */
  const unlockMeans = () => {
    setMcMeansSynced(false);
    setInputs({ nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct });
  };
  /** 锁标（解锁触发点；两字段共用同一按钮元素） */
  const lockButton = (
    <Button
      size="mini"
      type="text"
      className="wf-pressable"
      aria-label={t("mc.meanSyncLockAria")}
      icon={<IconLock />}
      onClick={unlockMeans}
    />
  );
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：统计行与 aria 内嵌金额经展示币种换算；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** CNY 规范值 → 展示币种数值（路径图 / 命运曲线几何数据同源换算；rate 不可用时恒等） */
  const convert = (v: number): number => (rate !== null ? cnyToDisplay(v, rate) : v);
  /** 窄视口下统计 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();
  /** 图表响应式三档（docs/p3-spec.md §6.4 D5）：高度 240/280/320、YAxis 宽 56/72、紧凑档 X 刻度 ≤5。
   *  P10 ≤480 紧档：槽内图 200（D5 320 紧档登记），槽 240 与分页行共存 */
  const { chartHeight, yAxisWidth, isCompact } = useChartMetrics();

  const [result, setResult] = useState<FinanceResult<MonteCarloOutput> | null>(null);
  const [running, setRunning] = useState(false);
  /** P10 槽契约（§1.3 K2–K4；risk 模拟叶与 pro 分析组两宿主共用）：结果 ⇄ 参数 ⇄ 序列
   *  三态等高互换（槽 260）；超行走槽内分页——结果 3 页（耗尽概率 + 统计前 6 行 / 统计后
   *  4 行 + 策略口径 / 主图 240 D5 档）、参数 3 页（核心输入 / 均值标准差年限 / 路径种子
   *  与策略参数）、序列 3 页（控制与运行 / 命运曲线 240 / 三联读数表）。第三段标签复用
   *  seq.title 既有键（零新键，§7 预算不变） */
  /** P10 §8 尺寸回收：结果/序列读数表共用同一形态入参（展开注入） */
  const tbl = {
    border: true,
    size: "small" as const,
    layout: "horizontal" as const,
    column: { xs: 1, md: 2 } as { xs: number; md: number },
  };
  const [slot, setSlot] = useState<"out" | "params" | "seq">("out");
  const [outPage, setOutPage] = useState(0);
  const [paramPage, setParamPage] = useState(0);
  const [seqPage, setSeqPage] = useState(0);
  /** 骨架修复轮（F1/F9）：序列态分页档位化——≤480 紧档 4 页（0 模式方向 / 1 参数与
   *  运行 / 2 命运图 / 3 读数表），其余 3 页（0 控制与运行 / 1 图 / 2 表）。
   *  原 4 页中页 1/3 为空页的旧档退役；页码随档位钳制 */
  const isCompactMc = isCompact;
  const seqTotal = isCompactMc ? 4 : 3;
  const seqPageFields = isCompactMc ? 1 : 0;
  const seqPageChart = isCompactMc ? 2 : 1;
  const seqPageTables = isCompactMc ? 3 : 2;
  const safeSeqPage = Math.min(seqPage, seqTotal - 1);

  // 图表 SVG 属性经主题解析函数取解析值（规范第 8 节）：组件不感知主题，
  // 深浅选组与色盲友好替换均在函数内完成；主题切换即重渲染换色，
  // 入场动画由数据变化驱动，颜色 prop 变化不重放
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const pathColor = themeTokens.primary;
  const medianColor = themeTokens.rise;
  const fallColor = themeTokens.fall;

  /** 系统「减弱动态效果」偏好：命中时图表入场动画停用（与历史关闭行为等价） */
  const reducedMotion = usePrefersReducedMotion();
  /** 折线入场动画（规范第 8 节）：慢档时长令牌数值 + 渐近族最近预设 easing */
  const lineAnimationProps = {
    isAnimationActive: !reducedMotion,
    animationDuration: MOTION_DURATIONS.slow,
    animationEasing: "ease-out",
  } as const;

  // ---------------------------------------------------------------------------
  // P2-F1 支取策略（docs/p2-spec.md §2.4 ①）：切换即按需物化嵌套参数对象，
  // 避免 undefined 传给核心；已存在（如分享链接恢复 / 此前编辑过）则保留用户值
  // ---------------------------------------------------------------------------
  const handleStrategyChange = (value: string) => {
    const strategy = value as WithdrawalStrategy;
    // P7/P0-3：切换策略即清除「正名并入」一次性提示（随策略注生命周期走）
    if (strategyLegacyNotice) clearStrategyLegacyNotice();
    if (strategy === "threshold" && !inputs.threshold) {
      setInputs({ strategy, threshold: { ...MONTE_CARLO_STRATEGY_DEFAULTS.threshold } });
    } else if (strategy === "percent" && !inputs.percent) {
      setInputs({ strategy, percent: { ...MONTE_CARLO_STRATEGY_DEFAULTS.percent } });
    } else {
      setInputs({ strategy });
    }
  };

  // ---------------------------------------------------------------------------
  // P2-F2 序列风险对照（docs/p2-spec.md §3.4）：分析控件为组件本地 state，
  // 不入 store、不随分享链接携带（口径注 seq.note1/note2 明示口径）
  // ---------------------------------------------------------------------------
  const [seqMode, setSeqMode] = useState<"rolling" | "reorder">("rolling");
  const [seqDirection, setSeqDirection] = useState<SequenceDirection>("withdrawal");
  const [seqWindowYears, setSeqWindowYears] = useState(SEQ_WINDOW_YEARS_DEFAULT);
  const [seqRate, setSeqRate] = useState(SEQ_INITIAL_RATE_DEFAULT);
  const [seqSaving, setSeqSaving] = useState(SEQ_ANNUAL_SAVING_DEFAULT);
  const [seqRunning, setSeqRunning] = useState(false);
  const [seqState, setSeqState] = useState<SeqState | null>(null);
  const [seqError, setSeqError] = useState<string | null>(null);

  const seqSeriesMeta = INDEX_SERIES[seriesId];
  const seqSeries = seqSeriesMeta.annualReturnsPct;

  /** 序列年储蓄口径的滚动（runSequenceRolling 契约仅定义支取口径签名；验收 #7 要求
   *  两模式 × 两方向，积累口径滚动在此按同一编排循环 calcSequence 后复用
   *  selectFateWindows 选取——选取口径单一实现，不重复推导） */
  const runSeqRolling = async (): Promise<FinanceResult<{
    windows: FateWindow[];
    bestIndex: number;
    medianIndex: number;
    worstIndex: number;
  }>> => {
    const annualSpend = inputs.currentAssets * (seqRate / 100);
    const annualSaving = seqDirection === "withdrawal" ? 0 : seqSaving;
    if (seqDirection === "withdrawal") {
      return runSequenceRolling(seqSeries, seqSeriesMeta.firstYear, seqWindowYears, inputs.currentAssets, annualSpend);
    }
    const windows: FateWindow[] = [];
    for (let start = 0; start + seqWindowYears <= seqSeries.length; start += 1) {
      const r = await calcSequence({
        series: seqSeries.slice(start, start + seqWindowYears),
        years: seqWindowYears,
        direction: "accumulation",
        currentAssets: inputs.currentAssets,
        annualSpend: 0,
        annualSaving,
      });
      if (!r.ok) return r;
      windows.push({
        startYear: seqSeriesMeta.firstYear + start,
        terminalMultiple: r.data.terminalMultiple,
        depletedYear: r.data.depletedYear,
        assetPath: r.data.assetPath,
      });
    }
    return { ok: true, data: { windows, ...selectFateWindows(windows) } };
  };

  const runSeq = () => {
    setSeqRunning(true);
    setSeqError(null);
    const settle = (r: FinanceResult<SeqState>) => {
      if (r.ok) setSeqState(r.data);
      else setSeqError(r.error);
    };
    if (seqMode === "rolling") {
      runSeqRolling()
        .then((r) =>
          settle(r.ok ? { ok: true, data: { kind: "rolling", ...r.data } } : r),
        )
        .catch((e: unknown) => setSeqError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSeqRunning(false));
    } else {
      runSequenceReorder(
        seqSeries,
        seqDirection,
        inputs.currentAssets,
        inputs.currentAssets * (seqRate / 100),
        seqSaving,
      )
        .then((r) =>
          settle(r.ok ? { ok: true, data: { kind: "reorder", ...r.data } } : r),
        )
        .catch((e: unknown) => setSeqError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSeqRunning(false));
    }
  };

  const run = () => {
    setRunning(true);
    // 收益模式分支：自助抽样仅改变收益样本来源（序列有放回重抽）；正态参数与现状一致。
    // P10 §4：提交帧解析用 effectiveInputs——锁态两均值取 baseline 现值同帧覆盖
    // （与 AccumulationPanel run() 的 effectiveTarget 同帧提交先例完全同构）；
    // （service 内部已捕获全部异常，此处仅兜底）
    const call =
      returnMode === "bootstrap"
        ? calcMonteCarloBootstrap({
            ...effectiveInputs,
            series: INDEX_SERIES[seriesId].annualReturnsPct,
          })
        : calcMonteCarlo(effectiveInputs);
    call
      .then((r) => setResult(r))
      .catch((e: unknown) =>
        setResult({ ok: false, error: e instanceof Error ? e.message : String(e), notReady: false }),
      )
      .finally(() => setRunning(false));
  };

  /** 50 条抽样路径 + 逐年中位数 → 图表数据（数值经 convert 换算到展示币种） */
  const chartData: ChartRow[] = useMemo(() => {
    if (!result?.ok) return [];
    const paths = result.data.samplePaths.slice(0, MAX_CHART_PATHS);
    const years = paths.reduce((acc, p) => Math.max(acc, p.length), 0);
    const rows: ChartRow[] = [];
    for (let y = 0; y < years; y += 1) {
      const row: ChartRow = { year: y + 1 };
      const column: number[] = [];
      paths.forEach((p, i) => {
        const v = convert(p[y] ?? 0);
        row[`p${i}`] = v;
        column.push(v);
      });
      column.sort((a, b) => a - b);
      row.median = median(column);
      rows.push(row);
    }
    return rows;
    // convert 随展示币种变化须重算（rate > 0 线性缩放）；rate=1 时与现状逐位一致
  }, [result, rate]);

  /** 命运曲线图数据：最好 / 中位 / 最差三条逐年资产路径（滚动模式；数值换算到展示币种） */
  const seqChartData: ChartRow[] = useMemo(() => {
    if (!seqState || seqState.kind !== "rolling") return [];
    const { windows, bestIndex, medianIndex, worstIndex } = seqState;
    const best = windows[bestIndex];
    const mid = windows[medianIndex];
    const worst = windows[worstIndex];
    if (!best || !mid || !worst) return [];
    const years = Math.max(best.assetPath.length, mid.assetPath.length, worst.assetPath.length);
    const rows: ChartRow[] = [];
    for (let y = 0; y < years; y += 1) {
      rows.push({
        year: y + 1,
        best: convert(best.assetPath[y] ?? 0),
        median: convert(mid.assetPath[y] ?? 0),
        worst: convert(worst.assetPath[y] ?? 0),
      });
    }
    return rows;
  }, [seqState, rate]);

  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;
  const depletionPercent = data ? Math.round(data.depletionProb * 1000) / 10 : 0;
  /** S18 面板主数渐近滚动（p6-spec §2）：rAF 中间帧只进显示值、永不进 store（§6 红线 2）；
   *  aria live 区只绑落定值 data.medianTerminal（R13 锚点，动画中间值不入播报） */
  const animatedMedianTerminal = useAnimatedNumber(data?.medianTerminal ?? 0, undefined, hostRef);
  /** 图表实际绘制的路径条数（契约 50 条；按返回数据兜底） */
  const chartPathCount = data ? Math.min(MAX_CHART_PATHS, data.samplePaths.length) : 0;
  /** 初始支取率（输入侧实时）= 年支出（基期）÷ 当前资产；currentAssets = 0 显示「—」（除零防护） */
  const initialRateText =
    inputs.currentAssets > 0
      ? `${formatNumber((inputs.annualSpend / inputs.currentAssets) * 100, 2)}%`
      : "—";

  /** F1 支出口径一致性：MC「年支出（基期）」≠ 自由刻度「每月开销」×12 时给字段警示 +
   *  一键同步（仅提示与显式动作，不自动改值——MONTE_CARLO_DEFAULTS.annualSpend 为
   *  编译期常量，仅作初始值，不随 store 联动是既有口径，本处不改变该数据流） */
  const baselineAnnualSpend = baseline.monthlyExpense * 12;
  const spendMismatched = inputs.annualSpend !== baselineAnnualSpend;

  /** 序列窗口数（seq.note1 的 {{count}}：滚动窗起点数 = 序列长度 − 窗长 + 1） */
  const seqWindowsCount = Math.max(0, seqSeries.length - seqWindowYears + 1);

  /** 序列口径句（P5 冗长治理：两处独立 seriesNote 段落删并，全文下沉 FieldTip 通道——
   *  出处类信息经「一句话出处 + 全文 tooltip」判据挂序列选择器标签，触发点紧邻目标） */
  const seriesNoteText = t("mc.seriesNote", {
    name: t(INDEX_NAME_KEY[seriesId]),
    firstYear: seqSeriesMeta.firstYear,
    lastYear: seqSeriesMeta.firstYear + seqSeries.length - 1,
    count: seqSeries.length,
    kind: t(INDEX_KIND_KEY[seriesId]),
    source: seqSeriesMeta.source,
  });

  /** S25 图表 hover 读数（p6-spec §2）：十字虚线 + 读数气泡，金额与图轴同源（chartData
   *  已按展示币种换算，格式化取 formatMoney 直出不再二次换算）。系列名复用既有键；
   *  主线图 50 条抽样路径不入气泡（共享气泡降噪，中位粗线为读数主体）；两图
   *  syncId="wf-mc" + syncMethod="value" 按年份值对齐（两图行数可能不同——窗长 ≠ 年数，
   *  index 对齐有错位风险，research §4.2 口径）。触屏无 hover 无气泡，明细行兜底 */
  const fateYearOf = (kind: "best" | "worst"): string => {
    if (!seqState || seqState.kind !== "rolling") return "—";
    const index = kind === "best" ? seqState.bestIndex : seqState.worstIndex;
    const window = seqState.windows[index];
    return window ? `${window.startYear}` : "—";
  };
  const renderFateTip = (): ReactElement => (
    <Tooltip
      cursor={{ stroke: themeTokens.textTertiary, strokeDasharray: "3 3" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const names: Record<string, string> = {
          best: t("seq.fateBest", { year: fateYearOf("best") }),
          median: t("seq.fateMedian"),
          worst: t("seq.fateWorst", { year: fateYearOf("worst") }),
        };
        return (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{label}</div>
            {payload.map((p) => (
              <div key={String(p.dataKey)} className="wf-chart-tip-row">
                <span>{names[String(p.dataKey)] ?? String(p.dataKey)}</span>
                <span className="wf-chart-tip-value">{formatMoney(Number(p.value), symbol)}</span>
              </div>
            ))}
          </div>
        );
      }}
    />
  );
  const renderMainTip = (): ReactElement => (
    <Tooltip
      cursor={{ stroke: themeTokens.textTertiary, strokeDasharray: "3 3" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const median = payload.find((p) => p.dataKey === "median");
        if (!median) return null;
        return (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{label}</div>
            <div className="wf-chart-tip-row">
              <span>{t("seq.fateMedian")}</span>
              <span className="wf-chart-tip-value">{formatMoney(Number(median.value), symbol)}</span>
            </div>
          </div>
        );
      }}
    />
  );
  /** 命运行数值：期末倍数 + 耗尽年标注 */
  const fateValue = (w: FateWindow): string => {
    const multiple = `${formatNumber(w.terminalMultiple, 2)}×`;
    return w.depletedYear >= 1
      ? `${multiple} · ${t("seq.depletedYear", { year: w.depletedYear })}`
      : multiple;
  };
  /** 三序行数值：期末倍数 + 耗尽年标注 */
  const reorderValue = (o: SequenceSimOutput): string => {
    const multiple = `${t("seq.terminalMultiple")} ${formatNumber(o.terminalMultiple, 2)}`;
    return o.depletedYear >= 1
      ? `${multiple} · ${t("seq.depletedYear", { year: o.depletedYear })}`
      : multiple;
  };

  /** A8 序列完成播报句（p4-spec §7）：绑 seqState 落定帧（滚动模式用命运行值、
   *  三序模式用倍数行值）；节点常驻、内容替换式更新，只播落定值（防噪三规则） */
  const seqAria = (() => {
    if (!seqState) return "";
    if (seqState.kind === "rolling") {
      const b = seqState.windows[seqState.bestIndex];
      const m = seqState.windows[seqState.medianIndex];
      const w = seqState.windows[seqState.worstIndex];
      return t("seq.doneAria", {
        best: b ? fateValue(b) : "—",
        median: m ? fateValue(m) : "—",
        worst: w ? fateValue(w) : "—",
      });
    }
    return t("seq.doneAria", {
      best: reorderValue(seqState.original),
      median: reorderValue(seqState.ascending),
      worst: reorderValue(seqState.descending),
    });
  })();

  return (
    <div ref={hostRef}>
      {/* P10 §1.3 紧档登记：收益模式行 / 支取策略行 / bootstrap 注移入参数槽页 0（行属
          参数语义；槽外固定区只留 K1 叶条 + 槽 + 运行钮 + C3 dock——页框实测回填）。 */}

      {/* P10 L4 槽切换条（三态；段标签复用 advanced.mcTitle 语境既有键——图表/参数为 §7 新键，
          序列段复用 seq.title） */}
      <SegBar
        name="wf-mc-slot"
        ariaLabel={t("advanced.mcTitle")}
        value={slot}
        onChange={(v: string) => setSlot(v as "out" | "params" | "seq")}
        options={[
          { value: "out", label: t("atlas.slotChart") },
          { value: "params", label: t("atlas.slotParams") },
          { value: "seq", label: t("seq.title") },
        ]}
      />
      <SlotBox height={200}>
        {/* 参数态：p0 模式/策略行 + 核心输入 + 同步/恢复钮；p1 均值标准差年限；p2 路径种子；p3 策略参数 */}
        {slot === "params" ? (
          <div className="wf-slot-body">
      {/* 收益模式行（docs/p1-spec.md §4.6）：正态参数 / 历史自助抽样；自助抽样附加序列选择。
          A5：提示图标经 FieldTip（Tab 可聚焦 + focus 触发 Tooltip）；A7：Radio 组补 name */}
      {paramPage === 0 ? (
        <>
      <div className="wf-mc-mode">
        <Text>{t("mc.returnMode")}</Text>
        <FieldTip text={t("mc.returnModeTooltip")} />
        <Radio.Group
          name="mc-return-mode"
          value={returnMode}
          onChange={(v) => setReturnMode(v as MonteCarloReturnMode)}
          options={[
            { label: t("mc.modeNormal"), value: "normal" },
            { label: t("mc.modeBootstrap"), value: "bootstrap" },
          ]}
        />
      </div>
      <div className="wf-mc-mode">
        <Text>{t("mc.strategy")}</Text>
        <Radio.Group
          name="mc-strategy"
          value={inputs.strategy ?? "fixed"}
          onChange={(v) => handleStrategyChange(v as string)}
          options={[
            { label: t("mc.strategyFixed"), value: "fixed" },
            { label: t("mc.strategyThreshold"), value: "threshold" },
            { label: t("mc.strategyPercent"), value: "percent" },
          ]}
        />
        {returnMode === "bootstrap" ? (
          <>
            <FieldTip text={`${t("mc.seriesTooltip")}；${seriesNoteText}`} />
            <Select
              size="small"
              value={seriesId}
              options={INDEX_ORDER.map((id) => ({ label: t(INDEX_NAME_KEY[id]), value: id }))}
              onChange={(v: IndexId) => setSeriesId(v)}
              className="wf-input-full"
            />
          </>
        ) : null}
      </div>
      {returnMode === "bootstrap" ? (
        <Text type="secondary">{t("mc.bootstrapModeNote")}</Text>
      ) : null}
        </>
      ) : null}
      {/* P2-F1 阈值带参数（strategy = "threshold"；四个带参数共用 mc.thresholdBandTooltip） */}
      {paramPage === 3 && inputs.strategy === "threshold" && inputs.threshold ? (
        <FieldRow className="wf-slot-row">
          <NumberField
            md={12}
            label={t("mc.thresholdExceedPct")}
            tooltip={t("mc.thresholdBandTooltip")}
            value={inputs.threshold.exceedPct}
            onChange={(v) => setInputs({ threshold: { ...inputs.threshold!, exceedPct: v } })}
            limit={LIMITS.strategyPct}
            suffix="%"
          />
          <NumberField
            md={12}
            label={t("mc.thresholdCutPct")}
            tooltip={t("mc.thresholdBandTooltip")}
            value={inputs.threshold.cutPct}
            onChange={(v) => setInputs({ threshold: { ...inputs.threshold!, cutPct: v } })}
            limit={LIMITS.strategyPct}
            suffix="%"
          />
          <NumberField
            md={12}
            label={t("mc.thresholdFallPct")}
            tooltip={t("mc.thresholdBandTooltip")}
            value={inputs.threshold.fallPct}
            onChange={(v) => setInputs({ threshold: { ...inputs.threshold!, fallPct: v } })}
            limit={LIMITS.strategyPct}
            suffix="%"
          />
          <NumberField
            md={12}
            label={t("mc.thresholdRaisePct")}
            tooltip={t("mc.thresholdBandTooltip")}
            value={inputs.threshold.raisePct}
            onChange={(v) => setInputs({ threshold: { ...inputs.threshold!, raisePct: v } })}
            limit={LIMITS.strategyPct}
            suffix="%"
          />
          <IntField
            md={12}
            label={t("mc.thresholdNoCutYears")}
            tooltip={t("mc.thresholdBandTooltip")}
            value={inputs.threshold.noCutLastYears}
            onChange={(v) => setInputs({ threshold: { ...inputs.threshold!, noCutLastYears: v } })}
            min={0}
            max={200}
            suffix={t("units.yearUnit")}
          />
          <Col className="wf-field" xs={24} md={12}>
            <div className="wf-field-label">
              <Text>{t("mc.thresholdFreeze")}</Text>
              <FieldTip text={t("mc.thresholdFreezeTooltip")} />
            </div>
            {/* A3：开关补可访问名称（复用标签文案，p4-spec §7） */}
            <Switch
              checked={inputs.threshold.freezeOnLoss}
              aria-label={t("mc.thresholdFreeze")}
              onChange={(checked) => setInputs({ threshold: { ...inputs.threshold!, freezeOnLoss: checked } })}
            />
          </Col>
        </FieldRow>
      ) : null}

      {/* P2-F1 余额比例参数（strategy = "percent"；地板 / 上限 0 = 关闭） */}
      {paramPage === 3 && inputs.strategy === "percent" && inputs.percent ? (
        <FieldRow className="wf-slot-row">
          <NumberField
            md={12}
            label={t("mc.percentRealReturn")}
            tooltip={t("mc.percentRealReturnTooltip", {
              value: formatNumber(MONTE_CARLO_STRATEGY_DEFAULTS.percent.realReturnAssumpPct, 1),
            })}
            value={inputs.percent.realReturnAssumpPct}
            onChange={(v) => setInputs({ percent: { ...inputs.percent!, realReturnAssumpPct: v } })}
            limit={LIMITS.strategyRealReturnPct}
            suffix="%"
          />
          <IntField
            md={12}
            label={t("mc.percentFloor")}
            tooltip={t("mc.percentBoundTooltip")}
            value={inputs.percent.floorPctOfLastYear}
            onChange={(v) => setInputs({ percent: { ...inputs.percent!, floorPctOfLastYear: v } })}
            min={LIMITS.strategyPct.min}
            max={LIMITS.strategyPct.max}
            suffix="%"
          />
          <IntField
            md={12}
            label={t("mc.percentCap")}
            tooltip={t("mc.percentBoundTooltip")}
            value={inputs.percent.capPctOfInitialReal}
            onChange={(v) => setInputs({ percent: { ...inputs.percent!, capPctOfInitialReal: v } })}
            min={LIMITS.strategyCapPct.min}
            max={LIMITS.strategyCapPct.max}
            suffix="%"
          />
        </FieldRow>
      ) : null}

      <FieldRow className="wf-slot-row">
        {paramPage === 0 ? (
          <>
        <AmountField
          label={t("mc.currentAssets")}
          tooltip={t("mc.currentAssetsTooltip")}
          value={inputs.currentAssets}
          onChange={(v) => setInputs({ currentAssets: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("mc.annualSpend")}
          tooltip={t("mc.annualSpendTooltip")}
          value={inputs.annualSpend}
          onChange={(v) => setInputs({ annualSpend: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuanPerYear") : undefined}
          convertRate={rate}
          hint={
            spendMismatched
              ? t("mc.annualSpendMismatchHint", { value: money(baselineAnnualSpend) })
              : undefined
          }
        />
          </>
        ) : paramPage === 1 ? (
          <>
        {/* 自助抽样模式下名义回报均值/标准差不参与计算（分布由所选序列决定），隐藏两个字段；
            通胀均值/标准差保留（通胀仍按正态分布抽样）。
            P10 §4 锁态字段形态：disabled + 派生值直显 + 尾部锁标（锁标即解锁触发点，
            aria 与可见 hint 同源——§10 红线 8 禁 title-only）；unlocked → 现字段原样可编 */}
        {returnMode === "normal" ? (
          <PercentField
            md={12}
            label={t("mc.returnMean")}
            tooltip={t("mc.returnMeanTooltip")}
            value={mcMeansSynced ? baseline.nominalReturnPct : inputs.nominalReturnMeanPct}
            onChange={(v) => setInputs({ nominalReturnMeanPct: v })}
            disabled={mcMeansSynced}
            hint={mcMeansSynced ? t("mc.meanSyncHint") : undefined}
            suffix={mcMeansSynced ? lockButton : "%"}
          />
        ) : null}
        {returnMode === "normal" ? (
          <PercentField
            md={12}
            label={t("mc.returnStd")}
            tooltip={t("mc.returnStdTooltip")}
            value={inputs.nominalReturnStdPct}
            onChange={(v) => setInputs({ nominalReturnStdPct: v })}
            suffix="%"
          />
        ) : null}
        <PercentField
          md={12}
          label={t("mc.inflationMean")}
          tooltip={t("mc.inflationMeanTooltip")}
          value={mcMeansSynced ? baseline.inflationPct : inputs.inflationMeanPct}
          onChange={(v) => setInputs({ inflationMeanPct: v })}
          disabled={mcMeansSynced}
          hint={mcMeansSynced ? t("mc.meanSyncHint") : undefined}
          suffix={mcMeansSynced ? lockButton : "%"}
        />
        <PercentField
          md={12}
          label={t("mc.inflationStd")}
          tooltip={t("mc.inflationStdTooltip")}
          value={inputs.inflationStdPct}
          onChange={(v) => setInputs({ inflationStdPct: v })}
          suffix="%"
        />
        <IntField
          md={12}
          label={t("mc.years")}
          tooltip={t("mc.yearsTooltip")}
          value={inputs.years}
          onChange={(v) => setInputs({ years: v })}
          min={YEARS_LIMIT.min}
          max={YEARS_LIMIT.max}
          suffix={t("units.yearUnit")}
          hint={t("mc.yearsHint", { max: YEARS_LIMIT.max })}
        />
          </>
        ) : paramPage === 2 ? (
          <>
        <PathsField
          md={12}
          label={t("mc.paths")}
          tooltip={t("mc.pathsTooltip")}
          value={inputs.paths}
          onChange={(v) => setInputs({ paths: v })}
          hint={t("mc.pathsHint")}
        />
        <IntField
          md={12}
          label={t("mc.seed")}
          tooltip={t("mc.seedTooltip")}
          value={inputs.seed}
          onChange={(v) => setInputs({ seed: v })}
          suffix="#"
        />
          </>
        ) : (
          <>
        {/* 策略参数独立页（threshold 3 行 / percent 2 行；≤480 紧档槽 240 内可达） */}
          </>
        )}
      </FieldRow>
      {/* 参数槽分页（4 页：核心 / 均值标准差年限 / 路径种子 / 策略参数）；页 0 = 同步/恢复按钮在位 */}
      {paramPage === 0 ? (
        <>
      {/* F1 支出口径一致性一键同步：仅在不一致时渲染（显式动作，不自动改值）；
          字段显示刷新走 NumberField 的外部值重挂载机制（fields.ts inputEpoch） */}
      {spendMismatched ? (
        <Button
          size="small"
          onClick={() => setInputs({ annualSpend: baselineAnnualSpend })}
          className="wf-pressable"
        >
          {t("mc.annualSpendSyncButton", { value: money(baselineAnnualSpend) })}
        </Button>
      ) : null}
      {/* P10 §4 一键恢复联动（可选按钮，形态同 AccumulationPanel「恢复联动」）：
          置回 locked；锁态字段 value 直接派生自 baseline，显示随受控值更新
          （disabled 字段无用户键入，无 InputNumber 受控回写缺陷路径） */}
      {!mcMeansSynced ? (
        <Button size="small" onClick={() => setMcMeansSynced(true)} className="wf-pressable">
          {t("mc.meanSyncRestore")}
        </Button>
      ) : null}
        </>
      ) : null}
      <SlotPager label={t("advanced.mcTitle")} total={4} page={paramPage} onPage={setParamPage} />
          </div>
        ) : slot === "seq" ? (
          <div className="wf-slot-body">

      {/* P5 冗长治理：bootstrap 模式的独立 seriesNote 段落删除——口径全文已并入上方
          收益序列 FieldTip（出处类信息经 tooltip 承载，面板 note 收敛 ≤2） */}

      {/* P2-F2 序列风险对照子区（docs/p2-spec.md §3.4）——P10 序列态承载：p0 控制与运行、
          p1 命运曲线图 240、p2 三联/三序读数表；独立 seqRunning，不复用 running 状态 */}
      <>
        <Text bold>
          {t("seq.title")}
          {/* P5 冗长治理：seq.note 段落全文（2 段拼接键）下沉本提示（确定性与「演示性质」
              口径随触发点可达）；{{count}} 插值在首段键内承载 */}
          <FieldTip text={`${t("seq.note1", { count: seqWindowsCount })} ${t("seq.note2")}`} />
        </Text>
        {/* A8 序列完成播报：绑 seqState 落定帧（运行中内容为空） */}
        <span className="wf-sr-only" aria-live="polite" aria-atomic="true">{seqAria}</span>
        {safeSeqPage === 0 ? (
        <div className="wf-mc-mode" style={{ marginTop: 8 }}>
        {/* 序列态 p0：模式/方向两组（≤480 紧档拆分——p1 序列/窗长/运行，p2 图，p3 表） */}
          {/* 对照模式选项自解释（起点滚动 / 三序对照），无独立标签键 */}
          <Radio.Group
            name="seq-mode"
            value={seqMode}
            onChange={(v) => setSeqMode(v as "rolling" | "reorder")}
            options={[
              { label: t("seq.modeRolling"), value: "rolling" },
              { label: t("seq.modeReorder"), value: "reorder" },
            ]}
          />
          <Text>{t("seq.direction")}</Text>
          <Radio.Group
            name="seq-direction"
            value={seqDirection}
            onChange={(v) => setSeqDirection(v as SequenceDirection)}
            options={[
              { label: t("seq.directionWithdrawal"), value: "withdrawal" },
              { label: t("seq.directionAccumulation"), value: "accumulation" },
            ]}
          />
          {/* 序列沿用面板既有 seriesId 选择器（同一 store 状态；面板顶层选择器仅在
              bootstrap 模式可见，此处为序列风险子区的可见入口）；P5 冗长治理：
              seriesNote 全文经本标签 FieldTip 承载（原独立段落删除） */}
          <Text>
            {t("mc.seriesLabel")}
            <FieldTip text={seriesNoteText} />
          </Text>
          <Select
            size="small"
            value={seriesId}
            options={INDEX_ORDER.map((id) => ({ label: t(INDEX_NAME_KEY[id]), value: id }))}
            onChange={(v: IndexId) => setSeriesId(v)}
            style={{ width: 190 }}
          />
        </div>
        ) : null}
        {safeSeqPage === seqPageFields ? (
        <FieldRow className="wf-slot-row">
          {seqMode === "rolling" ? (
            <IntField
              md={12}
              label={t("seq.windowYears")}
              value={seqWindowYears}
              onChange={(v) => setSeqWindowYears(v)}
              min={1}
              max={seqSeries.length}
              suffix={t("units.yearUnit")}
            />
          ) : null}
          {seqDirection === "withdrawal" ? (
            <PercentField
              md={12}
              label={t("seq.initialRate")}
              value={seqRate}
              onChange={(v) => setSeqRate(v)}
              suffix="%"
            />
          ) : (
            <AmountField
              md={12}
              label={t("seq.annualSaving")}
              value={seqSaving}
              onChange={(v) => setSeqSaving(v)}
              prefix={symbol}
              suffix={displayCode === "CNY" ? t("units.yuanPerYear") : undefined}
              convertRate={rate}
            />
          )}
        </FieldRow>
        ) : null}
        {safeSeqPage === seqPageFields ? (
        <div className="wf-mc-actions">
          <Button loading={seqRunning} disabled={seqRunning} onClick={runSeq} className="wf-pressable">
            {t("seq.run")}
          </Button>
          {seqRunning ? (
            <span className="wf-mc-running">
              <Spin size={14} /> <Text type="secondary">{t("common.computing")}</Text>
            </span>
          ) : null}
        </div>
        ) : null}
        {safeSeqPage === seqPageFields && seqError ? <Alert type="error" style={{ marginBottom: 8 }} content={seqError} /> : null}
        {seqState === null ? (
          safeSeqPage === seqPageFields ? (
            /* T6 = S6 空态人格化：同族「未上弦的刻度尺」图形经 Empty icon 参数注入 */
            <Empty icon={<EmptyRulerArt size={56} />} description={t("seq.placeholder")} />
          ) : null
        ) : seqState.kind === "rolling" ? (
          <>
            {/* 命运曲线图：最好 / 中位 / 最差三线（C4 双主题令牌 + C5 aria 汇总句） */}
            {safeSeqPage === seqPageChart && seqChartData.length > 0 ? (
              <div
                className="wf-mc-chart"
                role="img"
                aria-label={t("seq.chartAria", {
                  count: seqState.windows.length,
                  years: seqWindowYears,
                })}
              >
                {/* P10 槽档：命运曲线图 ≤480 紧档 180（骨架修复轮 D5 再登记 200→180——
                    320 档图+分页器 211>202 收口），其余 240 */}
                <ResponsiveContainer width="100%" height={isCompact ? 180 : 240}>
                  {/* S25：与主线图同 syncId 联动（value 按年份值对齐） */}
                  <LineChart data={seqChartData} syncId="wf-mc" syncMethod="value" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    {/* S25 读数气泡 */}
                    {renderFateTip()}
                    {/* §6 图表质感：仅水平 1px 实线网格，去轴框与刻度短线 */}
                    <CartesianGrid stroke={themeTokens.chartGrid} vertical={false} />
                    {/* 紧凑档（<640）X 刻度 ≤5：interval 按刻度总数（= 窗长）推导，非紧凑档不干预 */}
                    <XAxis
                      dataKey="year"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                      interval={isCompact ? compactXInterval(seqWindowYears) : undefined}
                    />
                    <YAxis
                      width={yAxisWidth}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                      tickFormatter={(v: number) => formatCompactAxis(v)}
                    />
                    <Line
                      dataKey="best"
                      stroke={themeTokens.rise}
                      strokeWidth={2}
                      dot={false}
                      {...lineAnimationProps}
                      connectNulls
                    />
                    <Line
                      dataKey="median"
                      stroke={themeTokens.primary}
                      strokeWidth={2.5}
                      dot={false}
                      {...lineAnimationProps}
                      connectNulls
                    />
                    <Line
                      dataKey="worst"
                      stroke={themeTokens.fall}
                      strokeWidth={2}
                      dot={false}
                      {...lineAnimationProps}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            {/* 三联数行（数据表替代，C5 口径）+ 窗口数标注——序列态读数表页 */}
            {safeSeqPage === seqPageTables ? (
            <Descriptions
              {...tbl}
              column={{ xs: 1, md: 3 }}
              style={{ marginTop: 8 }}
              data={[
                {
                  label: t("seq.fateBest", { year: seqState.windows[seqState.bestIndex]?.startYear ?? "—" }),
                  value: seqState.windows[seqState.bestIndex] ? fateValue(seqState.windows[seqState.bestIndex]) : "—",
                },
                {
                  label: t("seq.fateMedian"),
                  value: seqState.windows[seqState.medianIndex] ? fateValue(seqState.windows[seqState.medianIndex]) : "—",
                },
                {
                  label: t("seq.fateWorst", { year: seqState.windows[seqState.worstIndex]?.startYear ?? "—" }),
                  value: seqState.windows[seqState.worstIndex] ? fateValue(seqState.windows[seqState.worstIndex]) : "—",
                },
              ]}
            />
            ) : null}
            {/* P5 冗长治理：独立窗口数注删除——窗口数并入 seq.note（FieldTip）与
                seq.chartAria（已有 {{count}} × {{years}} 信息），Descriptions 起点标签已有信息 */}
          </>
        ) : (
          <>
            {/* 三序汇总表（顺序名 + 期末倍数 + 耗尽年；数据表替代，C5 口径）——序列态读数表页 */}
            {safeSeqPage === seqPageTables ? (
            <Descriptions
              {...tbl}
              column={{ xs: 1, md: 3 }}
              style={{ marginTop: 8 }}
              data={[
                { label: t("seq.originalOrder"), value: reorderValue(seqState.original) },
                { label: t("seq.worstFirst"), value: reorderValue(seqState.ascending) },
                { label: t("seq.bestFirst"), value: reorderValue(seqState.descending) },
              ]}
            />
            ) : null}
          </>
        )}
        {/* P5 冗长治理：seq.note 独立段落删除（全文已在子区标题 FieldTip 承载，
            面板 note 收敛 ≤2——见 §5 判据与 §8 #19） */}
        {/* 序列槽分页（3 页：控制与运行 / 命运曲线 / 读数表） */}
        <SlotPager label={t("advanced.mcTitle")} total={seqTotal} page={safeSeqPage} onPage={setSeqPage} />
      </>
          </div>
        ) : (
          <div className="wf-slot-body">
      {data ? (
        <>
          {/* 结果态：p0 = 耗尽概率 + 统计前 4 行；p1 = 统计后 6 行 + 策略口径；p2 = 主图 240 */}
          {outPage === 0 ? (
          <div className="wf-mc-progress">
            <Text>{t("mc.depletionLabel")}</Text>
            <Progress
              percent={depletionPercent}
              color={fallColor}
              formatText={(p) => `${formatNumber(p, 1)}%`}
              style={{ maxWidth: 420 }}
            />
          </div>
          ) : null}
          <Descriptions
            {...tbl}
            layout="horizontal"
            style={{ marginTop: 8 }}
            data={outPage === 0 ? [
              { label: t("mc.medianTerminal"), value: <Text bold className="wf-nowrap">{money(animatedMedianTerminal)}</Text> },
              { label: t("mc.p5"), value: money(data.p5) },
              { label: t("mc.p25"), value: money(data.p25) },
              { label: t("mc.p75"), value: money(data.p75) },
                ] : [
              { label: t("mc.p95"), value: money(data.p95) },
              {
                label: `${t("mc.paths")} / ${t("mc.years")}`,
                value: t("mc.pathsYears", { paths: formatNumber(inputs.paths, 0), years: inputs.years }),
              },
              /* P2-F1 §2.4 ④：初始支取率（输入侧实时；策略任意模式均显示；0 资产除零防护） */
              {
                label: (
                  <span>
                    {t("mc.initialWithdrawalRate")}
                    <FieldTip text={t("mc.initialWithdrawalRateTooltip")} />
                  </span>
                ),
                value: initialRateText,
              },
              /* P2-F1 §2.4 ④：末年支取额三分位（键清单逐键成行） */
              { label: t("mc.withdrawalP5"), value: money(data.withdrawalP5) },
              { label: t("mc.withdrawalMedian"), value: money(data.withdrawalMedian) },
              { label: t("mc.withdrawalP95"), value: money(data.withdrawalP95) },
            ]}
          />
          {/* P2-F1 §2.4 ⑤ / P5 §5 冗长治理：策略口径压 ≤1 行短句内联，全文（2 段拼接键）
              进 FieldTip（阈值带 / 余额比例 / 算术锚三段声明全文保留）——结果态页 1 */}
          {outPage === 1 ? (
          <Text type="secondary" className="wf-panel-note">
            {t("mc.strategyNoteShort")}
            <FieldTip text={`${t("mc.strategyNote1")} ${t("mc.strategyNote2")}`} />
          </Text>
          ) : null}
          {/* P7/P0-3（修订轮二 R4）：解码端把历史/外来载荷的 inflation_uplift 并入
              fixed 后的一次性提示——仅规范化标志在位时出现，关闭按钮或切换策略即清除 */}
          {outPage === 1 && strategyLegacyNotice ? (
            <Text type="secondary" className="wf-panel-note">
              {t("share.strategyLegacyNotice")}{" "}
              <Button
                type="text"
                size="small"
                className="wf-pressable"
                aria-label={t("share.strategyLegacyNotice")}
                onClick={clearStrategyLegacyNotice}
              >
                {"✕"}
              </Button>
            </Text>
          ) : null}
          {outPage === 2 && chartData.length > 0 ? (
            <div
              className="wf-mc-chart"
              role="img"
              aria-label={t("mc.chartAria", {
                paths: formatNumber(chartPathCount, 0),
                years: inputs.years,
                prob: formatNumber(depletionPercent, 1),
                median: money(data.medianTerminal),
              })}
            >
              {/* P10 槽档：主图 ≤480 紧档 180（骨架修复轮 D5 再登记 200→180），其余 240 */}
              <ResponsiveContainer width="100%" height={isCompact ? 180 : 240}>
                <LineChart data={chartData} syncId="wf-mc" syncMethod="value" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  {/* S25 读数气泡 */}
                  {renderMainTip()}
                  {/* §6 图表质感：仅水平 1px 实线网格，去轴框与刻度短线 */}
                  <CartesianGrid stroke={themeTokens.chartGrid} vertical={false} />
                  {/* 紧凑档（<640）X 刻度 ≤5：interval 按刻度总数（= 年数）推导，非紧凑档不干预 */}
                  <XAxis
                    dataKey="year"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                    interval={isCompact ? compactXInterval(inputs.years) : undefined}
                  />
                  <YAxis
                    width={yAxisWidth}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: themeTokens.chartTick }}
                    tickFormatter={(v: number) => formatCompactAxis(v)}
                  />
                  {Array.from({ length: chartPathCount }, (_, i) => (
                    <Line
                      key={`path-${i}`}
                      dataKey={`p${i}`}
                      stroke={pathColor}
                      strokeWidth={1}
                      strokeOpacity={0.12}
                      dot={false}
                      {...lineAnimationProps}
                      connectNulls
                    />
                  ))}
                  <Line
                    dataKey="median"
                    stroke={medianColor}
                    strokeWidth={2.5}
                    dot={false}
                    {...lineAnimationProps}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
              <Text type="secondary" className="wf-panel-note">
                {returnMode === "bootstrap"
                  ? t("mc.chartNoteBootstrap", { count: chartPathCount })
                  : t("mc.chartNote", { count: chartPathCount })}
              </Text>
            </div>
          ) : null}
        </>
      ) : (
        /* C6 空态组件化：未运行空态从 Alert 改为 Empty（错误仍用 Alert type="error"）；
           T6 = S6 空态人格化：同族「未上弦的刻度尺」图形经 Empty icon 参数注入（两态共用） */
        <Empty
          style={{ marginTop: 8 }}
          icon={<EmptyRulerArt size={56} />}
          description={
            returnMode === "bootstrap" ? t("mc.placeholderBootstrap") : t("mc.placeholder")
          }
        />
      )}
      {/* 结果槽分页（3 页） */}
      <SlotPager label={t("advanced.mcTitle")} total={3} page={outPage} onPage={setOutPage} />
          </div>
        )}
      </SlotBox>

      <div className="wf-mc-actions">
        <Button type="primary" loading={running} onClick={run} disabled={running} className="wf-pressable">
          {t("mc.run")}
        </Button>
        {running ? (
          <span className="wf-mc-running">
            <Spin size={14} /> <Text type="secondary">{t("mc.running")}</Text>
          </span>
        ) : null}
      </div>

      {error ? <Alert type="error" style={{ marginTop: 4 }} content={error} /> : null}

      {/* A8 完成播报（p4-spec §7）：视觉隐藏 live 节点绑 result 落定帧（data 派生自 settled
          result，无动画中间帧），运行期间内容为空、完成时 polite 整句播报一次（防噪三规则） */}
      <span className="wf-sr-only" aria-live="polite" aria-atomic="true">
        {data ? t("mc.doneAria", { prob: formatNumber(depletionPercent, 1), median: money(data.medianTerminal) }) : ""}
      </span>

      {/* D8 面板尾部 sticky-bottom 复用按钮（docs/p3-spec.md §6.7）：与既有运行按钮同 run 处理
          函数、同 loading/disabled 口径；<768 生效（样式层断点控制显隐），常驻拇指自然可达区 */}
      <div className="wf-mc-dock-run">
        <Button type="primary" loading={running} onClick={run} disabled={running} className="wf-pressable">
          {t("mc.run")}
        </Button>
      </div>
    </div>
  );
}
