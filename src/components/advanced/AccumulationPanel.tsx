/**
 * ⑥ 打工积累模拟：给定税后月收入与月支出，按名义回报 + 通胀双随机模拟攒钱路径，
 * 输出财富自由达成概率、首达年限分位、期末资产分布与 50 条路径图。
 * 口径（契约 simulate_accumulation，见 src/wasm/bridge.ts）：月储蓄 = 月收入 − 月支出
 * （可为负）；年储蓄自第 1 年起随通胀上行；目标随通胀水涨；首达即记录整数年，
 * 模拟继续至年限结束；同一种子 + 相同输入 → 结果完全可复现。
 * P2 新增（docs/p2-spec.md §5.2 / §6.5 / §6.6）：模拟模式二选一——正向模拟（现状口径）/
 * 反推储蓄（给定目标年限，闭式解反推所需月储蓄 + 一键蒙特卡洛验证）；
 * 未运行空态改用 Empty 组件；折线图补 role="img" + aria 汇总句。
 * 文案经 react-i18next 三语化。
 */
import {Alert, Button, Descriptions, Empty, Grid, Progress, Radio, Spin, Typography} from "@arco-design/web-react";
import { IconLock } from "@arco-design/web-react/icon";
import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcAccumulation, calcBaseline, calcRequiredSaving } from "../../services/finance";
import type { FinanceResult } from "../../services/finance";
import { formatNumber, formatCompactAxis, formatMoney } from "../../services/format";
import { cnyToDisplay } from "../../services/currency";
import { LIMITS, MOTION_DURATIONS, resolveThemeTokens } from "../../data/defaults";
import type { AccumulationOutput, RequiredSavingOutput } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { effectiveAccumulationSim } from "../../store/effectiveInputs";
import { AmountField, FieldRow, FieldTip, IntField, PathsField, PercentField } from "../fields";
import { SegBar, SlotBox, SlotPager } from "../slots";
import { EmptyRulerArt } from "../EmptyRuler";
import { compactXInterval, useAnimatedNumber, useChartMetrics, useFinanceCall, useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport, useMoney, usePrefersReducedMotion } from "../hooks";

const { Text, Title } = Typography;
const { Col } = Grid;

/** 折线图最多展示的抽样路径条数（契约 samplePaths 为 50 条代表路径） */
const MAX_CHART_PATHS = 50;
/** 模拟年限 UI 限额（数据层 LIMITS 集中维护；同时控制图表规模） */
const YEARS_LIMIT = LIMITS.simYears;
/** 目标值预览防抖（与基础模式临界值实时联动的节拍，docs/p0-spec.md §4.6.1） */
const TARGET_DEBOUNCE_MS = 300;

/** 图表数据行：逐年各路径值 + 逐年中位数 + 展示口径目标线 */
type ChartRow = Record<string, number | string>;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function AccumulationPanel() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const inputs = useCalculatorStore((s) => s.accumulationInputs);
  const setInputs = useCalculatorStore((s) => s.setAccumulationInputs);
  const synced = useCalculatorStore((s) => s.accumulationTargetSynced);
  const setSynced = useCalculatorStore((s) => s.setAccumulationTargetSynced);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  /** P10fix §3.2 普查 #6/#8/#9：月开销与两均值单源化口径标志（mcMeansSynced 五要素模板
   *  推广）——锁态（默认 true）显示层取 baseline 派生直显、运行提交帧同帧解析覆盖，
   *  派生口径统一在 effectiveInputs.ts 纯函数模块（零面板切片写入）；解锁 = 显式动作
   *  同时把当刻核心值落入切片（unlock*Patch 快照）。普查 #7 targetValue 联动
   *  （accumulationTargetSynced）不迁移零变化、#14 currentAssets 裁定不联动。 */
  const accExpenseSynced = useCalculatorStore((s) => s.accExpenseSynced);
  const accMeansSynced = useCalculatorStore((s) => s.accMeansSynced);
  const setSyncFlag = useCalculatorStore((s) => s.setSyncFlag);
  /** 有效输入（显示/运行同源）：月开销与两均值锁定键取 baseline 派生，其余键切片原值 */
  const effAcc = effectiveAccumulationSim(inputs, baseline, {
    expense: accExpenseSynced,
    means: accMeansSynced,
  });
  /** 锁标（解锁触发点；月开销 / 两均值各一）——aria 三语键复用 mc.meanSync*（§11.2 降档登记）；
   *  解锁快照内联当刻核心值字面量（消除解锁即见旧值错位；§9.2 降档登记） */
  const expenseLockButton = (
    <Button
      size="mini"
      type="text"
      className="wf-pressable"
      aria-label={t("mc.meanSyncLockAria")}
      icon={<IconLock />}
      onClick={() => {
        setSyncFlag("accExpenseSynced", false);
        setInputs({ monthlyExpense: baseline.monthlyExpense });
      }}
    />
  );
  const meansLockButton = (
    <Button
      size="mini"
      type="text"
      className="wf-pressable"
      aria-label={t("mc.meanSyncLockAria")}
      icon={<IconLock />}
      onClick={() => {
        setSyncFlag("accMeansSynced", false);
        setInputs({ nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct });
      }}
    />
  );
  /** 锁态 hint/suffix 复用（两均值三字段共用） */
  const accMeansHint = accMeansSynced ? t("mc.meanSyncHint") : undefined;
  const accMeansSuffix = accMeansSynced ? meansLockButton : "%";
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：储蓄行 / 分位数 / 大数字经展示币种换算；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** CNY 规范值 → 展示币种数值（路径图 / 目标线几何数据同源换算；rate 不可用时恒等） */
  const convert = (v: number): number => (rate !== null ? cnyToDisplay(v, rate) : v);
  /** 窄视口下统计 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();
  /** V-V2（P7.1 视觉验收）：双栏右栏容器 ~618px 装不下 md:2 表宽（实测 757px 被祖先
   *  裁切、中位终值整列不可见）——workbench 形态统计表切单列 + fixed 布局
   *  （P5 BreakdownTable 同款先例），窄视口维持纵向堆叠既有口径 */
  const isWorkbench = useIsWorkbenchViewport();
  /** 图表响应式三档（docs/p3-spec.md §6.4 D5）：高度 240/280/320、YAxis 宽 56/72、紧凑档 X 刻度 ≤5。
   *  P10 ≤480 紧档：槽内图 200（D5 320 紧档登记） */
  const { chartHeight, yAxisWidth, isCompact } = useChartMetrics();

  /** P2-F4 模拟模式（docs/p2-spec.md §5.2）：本地 state，不随分享链接携带
   *  （accumulation 切片形状不变，明示取舍） */
  const [mode, setMode] = useState<"forward" | "reverse">("forward");

  /** 目标值联动的轻量基线预览（只读临界值，不写入任何面板输入） */
  const baselinePreview = useFinanceCall(() => calcBaseline(baseline), [baseline], {
    debounceMs: TARGET_DEBOUNCE_MS,
  });
  /** 目标值：联动中取基础模式临界值实时值；未联动（或预览未就绪）取面板输入 */
  const effectiveTarget =
    synced && baselinePreview.result?.ok
      ? baselinePreview.result.data.criticalValue
      : inputs.targetValue;

  const [result, setResult] = useState<FinanceResult<AccumulationOutput> | null>(null);
  const [running, setRunning] = useState(false);
  /** T15 = S15 目标线叙事标注（修订 #1 P0）：run() 提交帧同步快照的当刻 effectiveTarget——
   *  与 calcAccumulation 入参同一值、同一帧（纯展示层快照，零数据流改动 / wasm 契约不动）。
   *  联动默认态下改基础输入不重跑时，目标线与叙事行保持与图同一真值不漂移；
   *  null = 尚未运行（无快照不渲染线与叙事行，渲染门槛与图表同闸） */
  const [submittedTarget, setSubmittedTarget] = useState<number | null>(null);
  /**
   * 同步按钮点击序号：作为目标值字段的 key，点击同步即递增并强制该字段重挂载。
   * Arco InputNumber 在用户键入后（isUserTyping 锁定 raw 输入文本）不再跟随外部
   * 受控 value 变化重绘输入框（es/InputNumber/index.js displayedInputValue），
   * 故「点同步 → 联动恢复」时仅靠 value prop 更新无法回填联动值，须重挂载重置其内部态。
   * key 只随同步点击变化（不随 synced 翻转），手动编辑首键不会触发重挂载丢焦点。
   */
  const [targetSyncEpoch, setTargetSyncEpoch] = useState(0);

  // 图表 SVG 属性经主题解析函数取解析值（规范第 8 节取色口径，与蒙特卡洛面板一致）：
  // 组件不感知主题，深浅选组与色盲友好替换均在函数内完成
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const pathColor = themeTokens.primary;
  const medianColor = themeTokens.rise;
  const targetColor = themeTokens.textSecondary;

  /** 系统「减弱动态效果」偏好：命中时图表入场动画停用（与蒙特卡洛面板同约定） */
  const reducedMotion = usePrefersReducedMotion();
  /** 折线入场动画：慢档时长令牌数值 + 渐近族最近预设 easing */
  const lineAnimationProps = {
    isAnimationActive: !reducedMotion,
    animationDuration: MOTION_DURATIONS.slow,
    animationEasing: "ease-out",
  } as const;

  // ---------------------------------------------------------------------------
  // P2-F4 反推模式（docs/p2-spec.md §5.2）：闭式解实时计算（防抖节拍同面板 300ms）
  // ---------------------------------------------------------------------------
  const reverseCall = useFinanceCall(
    () =>
      calcRequiredSaving({
        currentAssets: inputs.currentAssets,
        targetValue: effectiveTarget,
        years: inputs.years,
        nominalReturnMeanPct: effAcc.nominalReturnMeanPct,
        inflationMeanPct: effAcc.inflationMeanPct,
      }),
    [inputs.currentAssets, effectiveTarget, inputs.years, effAcc.nominalReturnMeanPct, effAcc.inflationMeanPct],
    { debounceMs: TARGET_DEBOUNCE_MS, enabled: mode === "reverse" },
  );
  const revData: RequiredSavingOutput | null =
    mode === "reverse" && reverseCall.result?.ok === true ? reverseCall.result.data : null;

  const [verifyRunning, setVerifyRunning] = useState(false);
  const [verifyState, setVerifyState] = useState<FinanceResult<AccumulationOutput> | null>(null);

  const run = () => {
    setRunning(true);
    // T15：提交帧同步快照目标值（与下方 calcAccumulation 入参同一值、同一帧）
    setSubmittedTarget(effectiveTarget);
    // 运行时取当刻联动目标值提交（不回写 store）；calcAccumulation 内部已捕获全部异常，此处仅兜底。
    // P10fix §3.2：提交帧解析用 effAcc——锁态月开销/两均值取 baseline 现值同帧覆盖
    // （与 MonteCarloPanel run() 的 effectiveInputs 同帧提交先例完全同构）
    calcAccumulation({ ...effAcc, targetValue: effectiveTarget })
      .then((r) => setResult(r))
      .catch((e: unknown) =>
        setResult({ ok: false, error: e instanceof Error ? e.message : String(e), notReady: false }),
      )
      .finally(() => setRunning(false));
  };

  /** 蒙特卡洛验证：以「月储蓄 = 月支出 + S」重跑正向模拟（S = 反推所需月储蓄），
   *  给出目标年限内达成概率（docs/p2-spec.md §5.2）；失败走既有 error Alert。
   *  P10fix：月支出取 effAcc（锁态 = baseline 派生，与显示/运行同源） */
  const runVerify = () => {
    if (!revData) return;
    setVerifyRunning(true);
    calcAccumulation({
      ...effAcc,
      targetValue: effectiveTarget,
      monthlyIncome: effAcc.monthlyExpense + revData.requiredMonthlySaving,
      years: inputs.years,
    })
      .then((r) => setVerifyState(r))
      .catch((e: unknown) =>
        setVerifyState({ ok: false, error: e instanceof Error ? e.message : String(e), notReady: false }),
      )
      .finally(() => setVerifyRunning(false));
  };

  /** 50 条抽样路径 + 逐年中位数 + 展示口径目标线 → 图表数据（数值经 convert 换算到展示币种） */
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
      // 展示口径目标线 = effectiveTarget × (1 + 通胀均值)^year（契约不含各路径目标序列，
      // 各路径实际判定使用其自身通胀样本——图下注释注明）。P10fix：通胀均值取 effAcc
      //（锁态 = baseline 派生，与图同帧同源）
      row.target = convert(effectiveTarget * Math.pow(1 + effAcc.inflationMeanPct / 100, y + 1));
      rows.push(row);
    }
    return rows;
    // convert 随展示币种变化须重算（rate > 0 线性缩放）；rate=1 时与现状逐位一致
  }, [result, effectiveTarget, effAcc.inflationMeanPct, rate]);

  const data = result?.ok === true ? result.data : null;
  /** 统一错误提示：正向运行 / 反推闭式解 / 蒙特卡洛验证任一步失败均走既有 error Alert */
  const error =
    (result && !result.ok ? result.error : null) ??
    (mode === "reverse" && reverseCall.result && !reverseCall.result.ok ? reverseCall.result.error : null) ??
    (verifyState && !verifyState.ok ? verifyState.error : null);
  /** 图表实际绘制的路径条数（契约 50 条；按返回数据兜底） */
  const chartPathCount = data ? Math.min(MAX_CHART_PATHS, data.samplePaths.length) : 0;

  /** F1 支出口径一致性：面板「月支出」与自由刻度「每月开销」不一致即警示（字段 hint）+
   *  一键同步按钮（显式动作，不自动改值）。P10fix §3.2 普查 #6：accExpenseSynced 锁态
   *  （默认）下字段显示即派生值，警示与同步钮仅在解锁态有意义（hint 改单源化共用句） */
  const expenseMismatched = !accExpenseSynced && inputs.monthlyExpense !== baseline.monthlyExpense;
  /** 月储蓄（可为负；负值以跌色展示，正值以涨色展示）。P10fix：月支出取 effAcc
   *  （锁态 = baseline 派生，与字段显示/运行口径同源） */
  const saving = inputs.monthlyIncome - effAcc.monthlyExpense;
  const savingText = money(saving);
  /** 整句经 i18n 插值后定位储蓄数值子串，按正负着色（同串渲染，不拆文案键） */
  const savingLine = t("accumulation.savingLine", {
    income: money(inputs.monthlyIncome),
    expense: money(effAcc.monthlyExpense),
    saving: savingText,
  });
  const savingIdx = savingLine.lastIndexOf(savingText);

  /** 年限分位值：< 0（无达成样本）显示「—」，否则「N 年」 */
  const formatYearsValue = (v: number): string =>
    v < 0 ? "—" : `${formatNumber(v, 1)} ${t("units.yearUnit")}`;

  /** 反推模式达成概率（验证结果行） */
  const verifyData = verifyState?.ok === true ? verifyState.data : null;
  const verifyPercent = verifyData ? Math.round(verifyData.fiProbability * 1000) / 10 : 0;
  /** S18 面板主数渐近滚动（p6-spec §2，反推模式大数）：hook 必须无条件调用（规则 hooks），
   *  未就绪以 0 占位（hook 首值纪律：0→有值直接落值不滚动）；rAF 中间帧只进显示值、
   *  永不进 store（§6 红线 2）；submittedTarget 同帧快照（S15 锚点）不触碰 */
  const animatedRequiredSaving = useAnimatedNumber(revData ? revData.requiredMonthlySaving : 0, undefined, hostRef);
  /** P10 槽契约（§1.2 L4/L5；life 规划组与 pro 人生规划组两宿主共用）：结果 ⇄ 参数两态
   *  等高互换（槽 260）；超行走槽内分页——参数 3 页（基础四字段 / 均值标准差 / 模拟参数），
   *  正向结果 4 页（达成概率 / 首达分布 / 期末分布 / 路径图 240 D5 档）；反推结果单页。
   *  槽内字段两列由 .wf-slot-row 样式层承载（xs 断点解耦，§1.1 F8 槽内口径） */
  /** P10 §8 尺寸回收：两张分位表共用同一形态入参（展开注入） */
  const tbl = {
    border: true,
    size: "small" as const,
    style: { marginTop: 8 },
    layout: "horizontal" as const,
    column: (isWorkbench || isNarrow ? 1 : { xs: 1, md: 2 }) as 1 | { xs: number; md: number },
    tableLayout: (isWorkbench ? "fixed" : "auto") as "fixed" | "auto",
  };
  const [slot, setSlot] = useState<"out" | "params">("out");
  const [outPage, setOutPage] = useState(0);
  const [paramPage, setParamPage] = useState(0);
  /** 第 2 轮验收 F-07：结果段可达页数随模式/数据收敛（ReverseCard safeEditPage 同款
   *  钳制）——正推未运行仅页 0（口径行+空态）有内容、运行后四页全量；反推仅页 0
   *  （反解大数字）有内容。页码钳制消除「pager 停末页切分段落入无内容页」。 */
  const outTotal = mode === "forward" ? (data ? 4 : 1) : 1;
  const safeOutPage = Math.min(outPage, outTotal - 1);
  /** S25 图表 hover 读数（p6-spec §2）：十字虚线 + 读数气泡（中位与展示口径目标线两行；
   *  50 条抽样路径不入气泡降噪）。金额与图轴同源（chartData 已按展示币种换算，formatMoney
   *  直出不再二次换算）；系列名复用既有键。触屏无 hover 无气泡，分位 Descriptions 兜底 */
  const narrativeText = submittedTarget !== null && data
    ? t("accumulation.medianNarrative", { years: formatNumber(data.yearsMedian, 1) })
    : "";
  const noteText = t("accumulation.chartNote", { count: chartPathCount });
  const renderAccTip = (): ReactElement => (
    <Tooltip
      cursor={{ stroke: themeTokens.textTertiary, strokeDasharray: "3 3" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const names: Record<string, string> = {
          median: t("seq.fateMedian"),
          target: t("accumulation.targetLineLabel"),
        };
        const rows = payload.filter((p) => p.dataKey === "median" || p.dataKey === "target");
        if (rows.length === 0) return null;
        return (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{label}</div>
            {rows.map((p) => (
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

  return (
    <div ref={hostRef}>
      {/* P2-F4 模拟模式行（docs/p2-spec.md §5.2）：面板顶部 */}
      <div className="wf-mc-mode">
        <Text>{t("accumulation.mode")}</Text>
        <Radio.Group
          name="acc-mode"
          value={mode}
          onChange={(v) => setMode(v as "forward" | "reverse")}
          options={[
            { label: t("accumulation.modeForward"), value: "forward" },
            { label: t("accumulation.modeReverse"), value: "reverse" },
          ]}
        />
      </div>

      {/* P10 L4 槽切换条（复用 atlas.slotChart / atlas.slotParams，零新键） */}
      <SegBar
        name="wf-acc-slot"
        ariaLabel={t("advanced.accumulationTitle")}
        value={slot}
        onChange={(v: string) => setSlot(v as "out" | "params")}
        options={[
          { value: "out", label: t("atlas.slotChart") },
          { value: "params", label: t("atlas.slotParams") },
        ]}
      />
      <SlotBox height={200}>
        {slot === "params" ? (
          <div className="wf-slot-body">
      <FieldRow className="wf-slot-row">
        {paramPage === 0 ? (
          <>
        <AmountField
          label={t("accumulation.currentAssets")}
          tooltip={t("accumulation.currentAssetsTooltip")}
          value={inputs.currentAssets}
          onChange={(v) => setInputs({ currentAssets: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        {/* 反推模式隐藏「税后月收入」（docs/p2-spec.md §5.2；所需月储蓄即其反解值） */}
        {mode === "forward" ? (
          <AmountField
            label={t("accumulation.monthlyIncome")}
            tooltip={t("accumulation.monthlyIncomeTooltip")}
            value={inputs.monthlyIncome}
            onChange={(v) => setInputs({ monthlyIncome: v })}
            prefix={symbol}
            suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
            convertRate={rate}
          />
        ) : null}
        {/* P10fix §3.2 普查 #6：锁态字段形态（disabled + 派生值直显 + 尾部锁标，
            形态复制 MC #11/#12 mcMeansSynced 模板）；解锁态 → 现字段原样可编 + 不一致警示 */}
        <AmountField
          label={t("accumulation.monthlyExpense")}
          tooltip={t("accumulation.monthlyExpenseTooltip")}
          value={effAcc.monthlyExpense}
          onChange={(v) => setInputs({ monthlyExpense: v })}
          disabled={accExpenseSynced}
          prefix={symbol}
          suffix={accExpenseSynced ? expenseLockButton : displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
          convertRate={rate}
          hint={
            isCompact
              ? undefined
              : accExpenseSynced
                ? t("mc.meanSyncHint")
                : expenseMismatched
                  ? t("accumulation.expenseMismatchHint", { value: money(baseline.monthlyExpense) })
                  : undefined
          }
        />
        <AmountField
          key={`target-sync-${targetSyncEpoch}`}
          label={t("accumulation.targetValue")}
          tooltip={t("accumulation.targetValueTooltip")}
          value={effectiveTarget}
          onChange={(v) => {
            setInputs({ targetValue: v });
            setSynced(false); // 手动修改目标值即解除联动
          }}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          hint={synced && !isCompact ? t("accumulation.syncedHint") : undefined}
          convertRate={rate}
        />
          </>
        ) : paramPage === 1 ? (
          <>
        {/* 反推模式为确定性口径：只消费均值，隐藏两个标准差字段（§5.2 字段清单）。
            P10fix §3.2 普查 #8/#9：两均值锁态字段形态（disabled + 派生值直显 + 尾部锁标，
            模板同 MC #11/#12；正推/反推两分支同构处理） */}
        {mode === "forward" ? (
          <>
            <PercentField
              md={12}
              label={t("mc.returnMean")}
              tooltip={t("mc.returnMeanTooltip")}
              value={effAcc.nominalReturnMeanPct}
              onChange={(v) => setInputs({ nominalReturnMeanPct: v })}
              disabled={accMeansSynced}
              hint={accMeansHint}
              suffix={accMeansSuffix}
            />
            <PercentField
              md={12}
              label={t("mc.returnStd")}
              tooltip={t("mc.returnStdTooltip")}
              value={inputs.nominalReturnStdPct}
              onChange={(v) => setInputs({ nominalReturnStdPct: v })}
              suffix="%"
            />
          </>
        ) : (
          <PercentField
            md={12}
            label={t("mc.returnMean")}
            tooltip={t("mc.returnMeanTooltip")}
            value={effAcc.nominalReturnMeanPct}
            onChange={(v) => setInputs({ nominalReturnMeanPct: v })}
            disabled={accMeansSynced}
            hint={accMeansHint}
            suffix={accMeansSuffix}
          />
        )}
        <PercentField
          md={12}
          label={t("mc.inflationMean")}
          tooltip={t("mc.inflationMeanTooltip")}
          value={effAcc.inflationMeanPct}
          onChange={(v) => setInputs({ inflationMeanPct: v })}
          disabled={accMeansSynced}
          hint={accMeansHint}
          suffix={accMeansSuffix}
        />
        {mode === "forward" ? (
          <PercentField
            md={12}
            label={t("mc.inflationStd")}
            tooltip={t("mc.inflationStdTooltip")}
            value={inputs.inflationStdPct}
            onChange={(v) => setInputs({ inflationStdPct: v })}
            suffix="%"
          />
        ) : null}
          </>
        ) : (
          <>
        <IntField
          md={12}
          label={mode === "reverse" ? t("accumulation.yearsToTarget") : t("mc.years")}
          tooltip={t("mc.yearsTooltip")}
          value={inputs.years}
          onChange={(v) => setInputs({ years: v })}
          min={YEARS_LIMIT.min}
          max={YEARS_LIMIT.max}
          suffix={t("units.yearUnit")}
          hint={t("mc.yearsHint", { max: YEARS_LIMIT.max })}
        />
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
        {/* P7/P0-2：达标后接支取模拟的存续年数（0 = 关闭）。经 ...inputs 随 run()
            自动携带，calcAccumulation 调用点零改动（§5 红线 5：P7 调用点增量 = 0） */}
        <IntField
          md={12}
          label={t("accumulation.sustainYears")}
          tooltip={t("accumulation.sustainYearsTooltip")}
          value={inputs.sustainYears ?? 0}
          onChange={(v) => setInputs({ sustainYears: v })}
          min={LIMITS.sustainYears.min}
          max={LIMITS.sustainYears.max}
          suffix={t("units.yearUnit")}
        />
          </>
        )}
      </FieldRow>

      {/* 目标值联动恢复按钮（模式同 ReversePanel 的同步按钮）；点击递增重挂载序号，
          让目标值输入框回填当刻联动值（显示与运行口径一致，docs/p0-spec.md §4.8）＋
          F1 支出口径一致性一键同步（仅不一致时渲染）——两钮随参数页 0 在位 */}
      {paramPage === 0 ? (
        <div className="wf-acc-sync-row">
          <Button
            size="small"
            onClick={() => {
              setTargetSyncEpoch((c) => c + 1);
              setSynced(true);
            }}
            className="wf-pressable"
          >
            {t("accumulation.syncButton")}
          </Button>
          {expenseMismatched ? (
            <Button
              size="small"
              onClick={() => setInputs({ monthlyExpense: baseline.monthlyExpense })}
              className="wf-pressable"
            >
              {t("accumulation.expenseSyncButton", { value: money(baseline.monthlyExpense) })}
            </Button>
          ) : null}
          {/* P10fix §3.2 普查 #6/#8/#9：月开销/两均值一键恢复联动（三语键共用
              mc.meanSyncRestore；锁态字段值直接派生自 baseline，disabled 无键入
              无受控回写缺陷路径） */}
          {!accExpenseSynced ? (
            <Button size="small" onClick={() => setSyncFlag("accExpenseSynced", true)} className="wf-pressable">
              {t("mc.meanSyncRestore")}
            </Button>
          ) : null}
          {!accMeansSynced ? (
            <Button size="small" onClick={() => setSyncFlag("accMeansSynced", true)} className="wf-pressable">
              {t("mc.meanSyncRestore")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {/* 参数槽分页（3 页：基础四字段 / 均值标准差 / 模拟参数） */}
      <SlotPager label={t("advanced.accumulationTitle")} total={3} page={Math.min(paramPage, 2)} onPage={setParamPage} />
          </div>
        ) : (
          <div className="wf-slot-body">

      {/* 结果槽（正向）：页 0 = 月储蓄口径行 + 达成/存续双指标 + 空态；页 1 = 首达分布；
          页 2 = 期末分布 + 目标线叙事与图注（S15 落点约束：叙事行随图容器迁至同槽）；
          页 3 = 路径图（D5 档） */}
      {mode === "forward" && safeOutPage === 0 ? (
        <>
          {/* 月储蓄口径行：储蓄数值按正负着色（负 = 跌色，正 = 涨色） */}
          <div>
            <Text>
              {savingIdx >= 0 ? (
                <>
                  {savingLine.slice(0, savingIdx)}
                  <Text bold className="wf-nowrap" style={{ color: saving < 0 ? themeTokens.fall : themeTokens.rise }}>
                    {savingText}
                  </Text>
                  {savingLine.slice(savingIdx + savingText.length)}
                </>
              ) : (
                savingLine
              )}
            </Text>
          </div>
        </>
      ) : (
        <>
          {/* P2-F4 反推结果：大数字（正 = 涨色，负 = 次级文字色）+ 口径注 + 蒙特卡洛验证 */}
          <div className="wf-realtime">
            <Text>{t("accumulation.requiredSaving")}</Text>
            <Title
              heading={3}
              className="wf-big-number"
              style={{
                color: revData && revData.requiredMonthlySaving >= 0 ? themeTokens.rise : themeTokens.textSecondary,
                // P5 §1.1 双 hero 违例修正：右栏禁用 display 档（40px 与左栏读数窗竞争焦点），
                // 反推大数降为 title 档 20px bold（视觉变更登记 docs/p5-spec.md §12.4）
                fontSize: "var(--wf-text-title)",
                margin: 0,
              }}
            >
              {revData ? money(animatedRequiredSaving) : "—"}
            </Title>
            <Text type="secondary">
              {t("accumulation.reverseNote", { years: inputs.years })}
            </Text>
            <div className="wf-acc-actions" style={{ margin: "4px 0 0" }}>
              <Button
                type="primary"
                loading={verifyRunning}
                onClick={runVerify}
                disabled={verifyRunning || !revData}
                className="wf-pressable"
              >
                {t("accumulation.verify")}
              </Button>
              {verifyRunning ? (
                <span className="wf-acc-running">
                  <Spin size={14} /> <Text type="secondary">{t("common.computing")}</Text>
                </span>
              ) : null}
            </div>
            {/* 验证结果行 + 波动成本注（docs/p2-spec.md §5.2） */}
            {verifyData ? (
              <>
                <Text>
                  {t("accumulation.verifyResult", {
                    years: inputs.years,
                    pct: formatNumber(verifyPercent, 1),
                    paths: formatNumber(inputs.paths, 0),
                    saving: money(revData ? revData.requiredMonthlySaving : 0),
                  })}
                </Text>
                <Text type="secondary">
                  {t("accumulation.verifyNote", {
                    years: inputs.years,
                    saving: money(revData ? revData.requiredMonthlySaving : 0),
                  })}
                </Text>
              </>
            ) : null}
          </div>
        </>
      )}

      {error ? <Alert type="error" style={{ marginTop: 4 }} content={error} /> : null}

      {data && mode === "forward" && safeOutPage === 0 ? (
        <>
          <div className="wf-acc-progress">
            <Text>{t("accumulation.fiLabel")}</Text>
            <Progress
              percent={data.fiProbability * 100}
              color={medianColor}
              formatText={(p) => `${formatNumber(p, 1)}%`}
              style={{ maxWidth: 420 }}
            />
            <Text type="secondary">{t("accumulation.fiHint")}</Text>
          </div>
          {/* P7/P0-2 持续成功率（双指标）：仅输入侧 sustainYears > 0 时渲染（0 = 关闭
              不占位，零默认行为变化）；sustainedProbability = 0.0 为「未度量」哨兵，
              Rust 不引入 -1 特判——判定语义见 bridge.ts §g */}
          {(inputs.sustainYears ?? 0) > 0 ? (
            <div className="wf-acc-progress">
              <Text>{t("accumulation.sustainedLabel")}</Text>
              <Progress
                percent={data.sustainedProbability * 100}
                color={pathColor}
                formatText={(p) => `${formatNumber(p, 1)}%`}
                style={{ maxWidth: 420 }}
              />
              <Text type="secondary">
                {t("accumulation.sustainedHint", { years: inputs.sustainYears ?? 0 })}
              </Text>
            </div>
          ) : null}
        </>
      ) : null}
      {data && mode === "forward" && safeOutPage === 1 ? (
        <>
          <Descriptions
            {...tbl}
            title={t("accumulation.yearsTitle")}
            data={[
              { label: t("mc.p5"), value: <span className="wf-nowrap">{formatYearsValue(data.yearsP5)}</span> },
              { label: t("mc.p25"), value: <span className="wf-nowrap">{formatYearsValue(data.yearsP25)}</span> },
              { label: t("mc.medianTerminal"), value: <span className="wf-nowrap">{formatYearsValue(data.yearsMedian)}</span> },
              { label: t("mc.p75"), value: <span className="wf-nowrap">{formatYearsValue(data.yearsP75)}</span> },
              { label: t("mc.p95"), value: <span className="wf-nowrap">{formatYearsValue(data.yearsP95)}</span> },
            ]}
          />
        </>
      ) : null}
      {data && mode === "forward" && safeOutPage === 2 ? (
        <>
          <Descriptions
            {...tbl}
            title={t("accumulation.finalTitle")}
            data={[
              { label: t("mc.p5"), value: <span className="wf-nowrap">{money(data.finalAssetPercentiles.p5)}</span> },
              { label: t("mc.p25"), value: <span className="wf-nowrap">{money(data.finalAssetPercentiles.p25)}</span> },
              {
                label: t("mc.medianTerminal"),
                value: (
                  <Text bold className="wf-nowrap">{money(data.finalAssetPercentiles.p50)}</Text>
                ),
              },
              { label: t("mc.p75"), value: <span className="wf-nowrap">{money(data.finalAssetPercentiles.p75)}</span> },
              { label: t("mc.p95"), value: <span className="wf-nowrap">{money(data.finalAssetPercentiles.p95)}</span> },
              {
                label: `${t("mc.paths")} / ${t("mc.years")}`,
                value: t("mc.pathsYears", { paths: formatNumber(inputs.paths, 0), years: inputs.years }),
              },
            ]}
          />
          {/* T15 叙事行 + 图注（S15 落点约束：随图容器同槽承载——页 2 与期末分布同页；
              无目标快照不渲染叙事行）。≤480 紧档下沉 FieldTip（P5 口径，信息路径保留） */}
          {submittedTarget !== null && data.yearsMedian >= 0 ? (
            <Text type="secondary" className="wf-panel-note">
              {narrativeText}
              {isCompact ? <FieldTip text={narrativeText} /> : null}
            </Text>
          ) : null}
          <Text type="secondary" className={isCompact ? "wf-panel-note wf-sr-only" : "wf-panel-note"}>
            {noteText}
            {isCompact ? <FieldTip text={noteText} /> : null}
          </Text>
        </>
      ) : null}
      {data && mode === "forward" && safeOutPage === 3 && chartData.length > 0 ? (
        <>
          <div
              className="wf-acc-chart"
              role="img"
              aria-label={t("accumulation.chartAria", {
                paths: formatNumber(chartPathCount, 0),
                years: inputs.years,
                prob: formatNumber(Math.round(data.fiProbability * 1000) / 10, 1),
              })}
            >
              <ResponsiveContainer width="100%" height={isCompact ? 180 : chartHeight}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  {/* S25 读数气泡 */}
                  {renderAccTip()}
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
                  {/* T15 = S15 目标线叙事标注：基期目标水平参考线（run 提交帧快照 submittedTarget，
                      与 calcAccumulation 同帧同值——联动默认态下改基础输入不重跑时线与图同一真值
                      不漂移）；渲染与图表同闸，无快照不渲染；宿主容器 role="img" aria 不变 */}
                  {submittedTarget !== null ? (
                    <ReferenceLine
                      y={convert(submittedTarget)}
                      stroke={targetColor}
                      label={{
                        value: t("accumulation.targetLineLabel"),
                        position: "insideTopRight",
                        fontSize: 12,
                        fill: themeTokens.chartTick,
                      }}
                    />
                  ) : null}
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
                  {/* 展示口径目标线：按通胀均值上行（各路径实际判定使用其自身通胀样本） */}
                  <Line
                    dataKey="target"
                    stroke={targetColor}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    {...lineAnimationProps}
                    connectNulls
                  />
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
            </div>
        </>
      ) : null}
      {mode === "forward" && !data && safeOutPage === 0 ? (
        /* C6 空态组件化：未运行空态从 Alert 改为 Empty（复用现有键，改写句式）；
           T6 = S6 空态人格化：同族「未上弦的刻度尺」图形经 Empty icon 参数注入。
           第 1 轮验收复测补档：紧档插图 56→32（375×667 空态页 = 模式行 44 + Empty 108
           + 分页器 44 = 208 > 槽 205，降档后 166 ≤ 205；视觉档位压缩非退役） */
        <Empty style={{ marginTop: 8 }} icon={<EmptyRulerArt size={isCompact ? 32 : 56} />} description={t("accumulation.placeholder")} />
      ) : null}
      {/* 结果槽分页（正向 4 页 / 反推单页不渲染分页器） */}
      {mode === "forward" ? (
        <SlotPager label={t("advanced.accumulationTitle")} total={outTotal} page={safeOutPage} onPage={setOutPage} />
      ) : null}
          </div>
        )}
      </SlotBox>
      {/* 运行区：C3 dock 之外的面板主运行钮（正向）；反推验证钮在结果态单页内 */}
      {mode === "forward" ? (
        <div className="wf-acc-actions">
          <Button type="primary" loading={running} onClick={run} disabled={running} className="wf-pressable">
            {t("mc.run")}
          </Button>
          {running ? (
            <span className="wf-acc-running">
              <Spin size={14} /> <Text type="secondary">{t("mc.running")}</Text>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
