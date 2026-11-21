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
import { Alert, Button, Descriptions, Empty, Grid, Progress, Radio, Spin, Typography } from "@arco-design/web-react";
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
import { AmountField, FieldRow, IntField, PathsField, PercentField } from "../fields";
import { EmptyRulerArt } from "../EmptyRuler";
import { compactXInterval, useAnimatedNumber, useChartMetrics, useFinanceCall, useIsNarrowViewport, useMoney, usePrefersReducedMotion } from "../hooks";

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
  /** 图表响应式三档（docs/p3-spec.md §6.4 D5）：高度 240/280/320、YAxis 宽 56/72、紧凑档 X 刻度 ≤5 */
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
        nominalReturnMeanPct: inputs.nominalReturnMeanPct,
        inflationMeanPct: inputs.inflationMeanPct,
      }),
    [inputs.currentAssets, effectiveTarget, inputs.years, inputs.nominalReturnMeanPct, inputs.inflationMeanPct],
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
    // 运行时取当刻联动目标值提交（不回写 store）；calcAccumulation 内部已捕获全部异常，此处仅兜底
    calcAccumulation({ ...inputs, targetValue: effectiveTarget })
      .then((r) => setResult(r))
      .catch((e: unknown) =>
        setResult({ ok: false, error: e instanceof Error ? e.message : String(e), notReady: false }),
      )
      .finally(() => setRunning(false));
  };

  /** 蒙特卡洛验证：以「月储蓄 = 月支出 + S」重跑正向模拟（S = 反推所需月储蓄），
   *  给出目标年限内达成概率（docs/p2-spec.md §5.2）；失败走既有 error Alert */
  const runVerify = () => {
    if (!revData) return;
    setVerifyRunning(true);
    calcAccumulation({
      ...inputs,
      targetValue: effectiveTarget,
      monthlyIncome: inputs.monthlyExpense + revData.requiredMonthlySaving,
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
      // 各路径实际判定使用其自身通胀样本——图下注释注明）
      row.target = convert(effectiveTarget * Math.pow(1 + inputs.inflationMeanPct / 100, y + 1));
      rows.push(row);
    }
    return rows;
    // convert 随展示币种变化须重算（rate > 0 线性缩放）；rate=1 时与现状逐位一致
  }, [result, effectiveTarget, inputs.inflationMeanPct, rate]);

  const data = result?.ok === true ? result.data : null;
  /** 统一错误提示：正向运行 / 反推闭式解 / 蒙特卡洛验证任一步失败均走既有 error Alert */
  const error =
    (result && !result.ok ? result.error : null) ??
    (mode === "reverse" && reverseCall.result && !reverseCall.result.ok ? reverseCall.result.error : null) ??
    (verifyState && !verifyState.ok ? verifyState.error : null);
  /** 图表实际绘制的路径条数（契约 50 条；按返回数据兜底） */
  const chartPathCount = data ? Math.min(MAX_CHART_PATHS, data.samplePaths.length) : 0;

  /** 月储蓄（可为负；负值以跌色展示，正值以涨色展示） */
  const saving = inputs.monthlyIncome - inputs.monthlyExpense;
  const savingText = money(saving);
  /** 整句经 i18n 插值后定位储蓄数值子串，按正负着色（同串渲染，不拆文案键） */
  const savingLine = t("accumulation.savingLine", {
    income: money(inputs.monthlyIncome),
    expense: money(inputs.monthlyExpense),
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
  /** S25 图表 hover 读数（p6-spec §2）：十字虚线 + 读数气泡（中位与展示口径目标线两行；
   *  50 条抽样路径不入气泡降噪）。金额与图轴同源（chartData 已按展示币种换算，formatMoney
   *  直出不再二次换算）；系列名复用既有键。触屏无 hover 无气泡，分位 Descriptions 兜底 */
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

      <FieldRow>
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
        <AmountField
          label={t("accumulation.monthlyExpense")}
          tooltip={t("accumulation.monthlyExpenseTooltip")}
          value={inputs.monthlyExpense}
          onChange={(v) => setInputs({ monthlyExpense: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
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
          hint={synced ? t("accumulation.syncedHint") : undefined}
          convertRate={rate}
        />
        {/* 反推模式为确定性口径：只消费均值，隐藏两个标准差字段（§5.2 字段清单） */}
        {mode === "forward" ? (
          <>
            <PercentField
              md={12}
              label={t("mc.returnMean")}
              tooltip={t("mc.returnMeanTooltip")}
              value={inputs.nominalReturnMeanPct}
              onChange={(v) => setInputs({ nominalReturnMeanPct: v })}
              suffix="%"
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
            value={inputs.nominalReturnMeanPct}
            onChange={(v) => setInputs({ nominalReturnMeanPct: v })}
            suffix="%"
          />
        )}
        <PercentField
          md={12}
          label={t("mc.inflationMean")}
          tooltip={t("mc.inflationMeanTooltip")}
          value={inputs.inflationMeanPct}
          onChange={(v) => setInputs({ inflationMeanPct: v })}
          suffix="%"
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
      </FieldRow>

      {/* 目标值联动恢复按钮（模式同 ReversePanel 的同步按钮）；点击递增重挂载序号，
          让目标值输入框回填当刻联动值（显示与运行口径一致，docs/p0-spec.md §4.8） */}
      <Button
        size="small"
        style={{ marginBottom: 12 }}
        onClick={() => {
          setTargetSyncEpoch((c) => c + 1);
          setSynced(true);
        }}
        className="wf-pressable"
      >
        {t("accumulation.syncButton")}
      </Button>

      {mode === "forward" ? (
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

      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}

      {data && mode === "forward" ? (
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
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 2 }}
            title={t("accumulation.yearsTitle")}
            data={[
              { label: t("mc.p5"), value: formatYearsValue(data.yearsP5) },
              { label: t("mc.p25"), value: formatYearsValue(data.yearsP25) },
              { label: t("mc.medianTerminal"), value: formatYearsValue(data.yearsMedian) },
              { label: t("mc.p75"), value: formatYearsValue(data.yearsP75) },
              { label: t("mc.p95"), value: formatYearsValue(data.yearsP95) },
            ]}
          />
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 2 }}
            title={t("accumulation.finalTitle")}
            data={[
              { label: t("mc.p5"), value: money(data.finalAssetPercentiles.p5) },
              { label: t("mc.p25"), value: money(data.finalAssetPercentiles.p25) },
              {
                label: t("mc.medianTerminal"),
                value: (
                  <Text bold className="wf-nowrap">{money(data.finalAssetPercentiles.p50)}</Text>
                ),
              },
              { label: t("mc.p75"), value: money(data.finalAssetPercentiles.p75) },
              { label: t("mc.p95"), value: money(data.finalAssetPercentiles.p95) },
              {
                label: `${t("mc.paths")} / ${t("mc.years")}`,
                value: t("mc.pathsYears", { paths: formatNumber(inputs.paths, 0), years: inputs.years }),
              },
            ]}
          />
          {chartData.length > 0 ? (
            <div
              className="wf-acc-chart"
              role="img"
              aria-label={t("accumulation.chartAria", {
                paths: formatNumber(chartPathCount, 0),
                years: inputs.years,
                prob: formatNumber(Math.round(data.fiProbability * 1000) / 10, 1),
              })}
            >
              <ResponsiveContainer width="100%" height={chartHeight}>
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
              {/* T15 叙事行：中位首达年（与 Descriptions 同源字段 data.yearsMedian，同一
                  submittedTarget 快照下算出）；无目标快照不渲染整行 */}
              {submittedTarget !== null && data.yearsMedian >= 0 ? (
                <Text type="secondary" className="wf-panel-note">
                  {t("accumulation.medianNarrative", { years: formatNumber(data.yearsMedian, 1) })}
                </Text>
              ) : null}
              <Text type="secondary" className="wf-panel-note">
                {t("accumulation.chartNote", { count: chartPathCount })}
              </Text>
            </div>
          ) : null}
        </>
      ) : mode === "forward" ? (
        /* C6 空态组件化：未运行空态从 Alert 改为 Empty（复用现有键，改写句式）；
           T6 = S6 空态人格化：同族「未上弦的刻度尺」图形经 Empty icon 参数注入 */
        <Empty style={{ marginTop: 8 }} icon={<EmptyRulerArt size={56} />} description={t("accumulation.placeholder")} />
      ) : null}
    </div>
  );
}
