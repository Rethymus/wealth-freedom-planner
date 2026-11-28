/**
 * ⑧ 多情景对比器（docs/p2-spec.md §4.3）：
 * - 保存当前参数 = store.buildShareState() → encodeShareState → 本地场景库（localStorage，
 *   上限 12 个，scenarios.ts 契约）；载入 = store.applyShareState（裸载荷解码，版本不符标记禁用）；
 * - 并排对比表：每条合法情景用既有确定性 wasm 函数逐景复算 8 项关键指标（毫秒级），
 *   不纳入蒙特卡洛（数千路径 × N 情景为秒级，违背对比器即时性）；
 * - 行 = 指标、列 = 情景（≤12 列，横向滚动；窄屏同口径滚动，不切换布局）；
 *   任一计算失败该列整体显示「—」并在列头以跌色标注。
 * 文案经 react-i18next 三语化。
 */
import { Button, Empty, Input, Message, Popconfirm, Select, Switch, Table, Tag, Typography } from "@arco-design/web-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { decodeShareState, encodeShareState } from "../../services/share";
import type { ShareState } from "../../services/share";
import {
  deleteScenario,
  listScenarios,
  saveScenario,
  SCENARIO_MAX_COUNT,
  SCENARIO_NAME_MAX_CHARS,
} from "../../services/scenarios";
import type { ScenarioEntry } from "../../services/scenarios";
import { calcBaseline, calcLifecycle, calcPension, calcRental, calcReverse, calcTax } from "../../services/finance";
import type { YearRow } from "../../services/finance";
import { formatNumber } from "../../services/format";
import { cnyToDisplay } from "../../services/currency";
import {
  buildExportFilename,
  buildScenarioTableBitmap,
  downloadCanvasPng,
} from "../../services/exportScenarios";
import { resolveThemeTokens } from "../../data/defaults";
import { effectiveMonthsDivisor } from "../../data/pensionParams";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { FieldTip } from "../fields";
import { EmptyRulerArt } from "../EmptyRuler";
import { SegBar, SlotBox, SlotPager } from "../slots";
import ScenarioOverlayChart from "./ScenarioOverlayChart";
import { useIsCompactViewport, useIsNarrowViewport, useMoney, usePrefersReducedMotion } from "../hooks";

const { Text } = Typography;

/** WF-04 T3 叠影重算独立防抖（300ms，DEBOUNCE_MS 先例 BasicCalculator.tsx:38 同值；
 *  不与读数卡 useFinanceCall 共用实例——wf04-spec §3 红线 2） */
const OVERLAY_DEBOUNCE_MS = 300;

/** P9 基准列伪条目 id（wf06 F4「当前参数」基准列；不入 entries、不入情景库 localStorage、
 *  不入叠影图——恒两线裁定不动） */
const BASE_COL_ID = "__base__";

/** 叠影数据态（组件局部、只读——情景切片不写 store，§4 条 7/8）：null = 未就绪/解码失败 */
interface OverlayData {
  base: YearRow[];
  scen: YearRow[];
  name: string;
  depletedYear: number;
}

/** 对比列：每条合法情景一列；failed = 任一确定性计算失败（整列「—」） */
interface CompareCol {
  id: string;
  name: string;
  valid: boolean;
  failed: boolean;
  /** 8 项指标值（§4.3 表行序；valid=false / failed=true 时为空数组） */
  values: string[];
  /** F1 情景输入档案·「年支出（基期）」保存值（非复算指标，纯展示——只改年支出保存的
   *  情景不再与基准「一模一样」；decode 失败时为空串不入列） */
  spend: string;
}

/** 指标行定义（§4.3 表序：行名键见 §8 组 3） */
const METRIC_KEYS = [
  "scenario.metricCritical",
  "scenario.metricRentalNet",
  "scenario.metricPayback",
  "scenario.metricPension",
  "scenario.metricCoverage",
  "scenario.metricNetIncome",
  "scenario.metricSustainable",
  "scenario.metricSaving",
] as const;

/** 单条情景的 8 项指标复算（确定性 wasm 函数；任一失败返回 failed 列）。
 *  ⑤ 金额经 money / moneyFixed（展示币种换算；p4-spec §3.4）——已存载荷恒为 CNY 规范值 */
async function computeColumn(
  entry: ScenarioEntry,
  money: (v: number) => string,
  moneyFixed: (v: number) => string,
  yearUnit: string,
): Promise<CompareCol> {
  const invalid: CompareCol = { id: entry.id, name: entry.name, valid: false, failed: false, values: [], spend: "" };
  // P7：decodeShareState 返回 DecodeResult（state + 策略正名规范化信号）；
  // 对比列复算只消费切片本体，规范化信号由「载入」路径经 store 置一次性提示
  const decoded = decodeShareState(entry.payload);
  if (!decoded) return invalid;
  const shared = decoded.state;
  const [baselineR, rentalR, pensionR, taxR, reverseR] = await Promise.all([
    calcBaseline(shared.baseline),
    calcRental(shared.rental),
    calcPension({ ...shared.baseline, ...shared.pension }),
    calcTax(shared.tax),
    calcReverse(shared.reverse),
  ]);
  const failedCol: CompareCol = {
    id: entry.id,
    name: entry.name,
    valid: true,
    failed: true,
    values: [],
    // 档案值与确定性复算解耦：复算失败列仍展示保存的年支出输入值
    spend: money(shared.monteCarlo.annualSpend),
  };
  if (!baselineR.ok || !rentalR.ok || !pensionR.ok || !taxR.ok || !reverseR.ok) return failedCol;
  const saving = shared.accumulation.monthlyIncome - shared.accumulation.monthlyExpense;
  const payback = rentalR.data.paybackYears;
  const values: string[] = [
    money(baselineR.data.criticalValue),
    money(rentalR.data.annualNetCashFlow),
    payback >= 0 ? `${formatNumber(payback, 1)} ${yearUnit}` : "—",
    money(pensionR.data.pensionMonthly),
    `${formatNumber(pensionR.data.coverageRatio * 100, 1)}%`,
    money(taxR.data.netIncome),
    money(reverseR.data.sustainableMonthly),
    // 月储蓄（打工口径）：TS 显示算术，可负（列内固定两位小数与其他金额列对齐）
    moneyFixed(saving),
  ];
  return { id: entry.id, name: entry.name, valid: true, failed: false, values, spend: money(shared.monteCarlo.annualSpend) };
}

export default function ScenarioPanel() {
  const { t } = useTranslation();
  /** 第 1 轮验收复测补档：紧档档位（≤480 空态插图降档 32，见下方 compare 表空态） */
  const isCompact = useIsCompactViewport();
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：8 项指标中 6 项金额经展示币种换算；rate null = 符号-only */
  const { money, moneyFixed, symbol, display } = useMoney(displayCode);
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const applyShareState = useCalculatorStore((s) => s.applyShareState);
  /** WF-04 T3 基准路径入参：六切片原子选择（与 LifeTrajectoryCard 同构入参；原子选择
   *  保证仅相关切片变更才重跑叠影防抖 effect，§2.3-①） */
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  const accumulation = useCalculatorStore((s) => s.accumulationInputs);
  const pension = useCalculatorStore((s) => s.pensionInputs);
  const monthsSynced = useCalculatorStore((s) => s.pensionMonthsSynced);
  const loan = useCalculatorStore((s) => s.loanInputs);
  const rental = useCalculatorStore((s) => s.rentalInputs);
  /** P9 事件切片：编辑器写入即触发对比表/叠影同步刷新（§5.6 deps 扩展） */
  const lifeEvents = useCalculatorStore((s) => s.lifeEvents);
  /** P10 §5（V-F-1 必修）：对比列 computeColumn 消费 reverseInputs（calcReverse）/ taxInputs
   *  （calcTax）/ monteCarloInputs（档案行 annualSpend）三切片，而下方对比表 effect 的
   *  deps 此前缺三者——手动改反向/税务/MC 输入后基准列八项指标与档案行静默停在旧值。
   *  补三个原子选择器 + deps 三项（叠影 effect deps 不动：calcLifecycle 不消费三者） */
  const reverse = useCalculatorStore((s) => s.reverseInputs);
  const taxInputs = useCalculatorStore((s) => s.taxInputs);
  const monteCarloInputs = useCalculatorStore((s) => s.monteCarloInputs);
  const reducedMotion = usePrefersReducedMotion();
  /** CNY → 展示币种数值（叠影图数据同源一次换算；rate 不可用恒等） */
  const convert = (v: number): number => (display.rate !== null ? cnyToDisplay(v, display.rate) : v);

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<ScenarioEntry[]>([]);
  const [cols, setCols] = useState<CompareCol[]>([]);
  /** WF-04 T3 叠影：开关 / 选中情景 / 数据（§1-T3；开关未置位零调用零基线开销） */
  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [overlayData, setOverlayData] = useState<OverlayData | null>(null);
  /** P10 槽契约（§1.3 K3/K4；risk 情景叶与 pro 分析组两宿主共用）：叠影图 ⇄ 对比表两态
   *  等高互换（槽 320）；段标签复用 scenario.overlaySwitch / scenario.compareTitle 既有键
   *  （后者长文案由样式层 .wf-segbar 省略承载，aria 全文可读） */
  const [slot, setSlot] = useState<"overlay" | "table">("table");
  /** 骨架修复轮：对比表行分页（档案行 + 8 指标 = 9 行；≤768 档 3 行/页 × 3 页——
   *  320 档表高 427>槽 312 的静默裁切收口；≥768 单页 9 行；表头逐页重复，列不切分） */
  const [comparePage, setComparePage] = useState(0);
  const isNarrowCmp = useIsNarrowViewport();
  const compareRowsPerPage = isNarrowCmp ? 2 : 9;
  const compareTotal = Math.ceil(9 / compareRowsPerPage);
  const safeComparePage = Math.min(comparePage, compareTotal - 1);
  // P6 S23 已按 §8 降档顺序裁撤（docs/p6-spec.md §8；dist 原始字节门禁实测回写）

  const reload = () => setEntries(listScenarios());
  useEffect(() => {
    reload();
  }, []);

  /** 对比表复算：条目集 / 换算率 / 语言变化后逐景重算（毫秒级 × ≤12 情景；过期结果丢弃）。
   *  P9 基准列（wf06 F4）：列首「当前参数」= 伪情景走既有 computeColumn 全管线（decode →
   *  五确定性调用 → 八指标——零新计算路径、零新 calc* 调用，p9-spec §5.6）；payload 在
   *  compute 时刻自 store.getState().buildShareState() 现取（伪条目不入 entries、不入情景
   *  库 localStorage）；deps 扩入七切片（与 LifeTrajectoryCard 同构）——手动改任意业务输入
   *  或事件即同表同步刷新；额外成本 = 每次重算多一列的 5 个毫秒级确定性调用（「毫秒级 ×
   *  ≤12」预算口径内） */
  useEffect(() => {
    let stale = false;
    void (async () => {
      const pseudo: ScenarioEntry = {
        id: BASE_COL_ID,
        name: t("scenario.baseColName"),
        payload: encodeShareState(useCalculatorStore.getState().buildShareState()),
        createdAt: 0,
      };
      const computed = await Promise.all([
        computeColumn(pseudo, money, moneyFixed, t("units.yearUnit")),
        ...entries.map((e) => computeColumn(e, money, moneyFixed, t("units.yearUnit"))),
      ]);
      if (!stale) setCols(computed);
    })();
    return () => {
      stale = true;
    };
  }, [entries, money, moneyFixed, t, baseline, accumulation, pension, monthsSynced, loan, rental, lifeEvents, reverse, taxInputs, monteCarloInputs]);

  /** WF-04 T3 叠影重算（wf04-spec §1-T3 / research §2.3 八裁定）：触发源仅三种——开关
   *  置位 / 情景选中变更 / 基准六切片落定帧；独立 300ms 防抖 + stale 布尔闭包丢弃过期
   *  结果 + clearTimeout cleanup（敏感性 effect 同款形态，§3 红线 2/3）；置位后每次
   *  重算恰 2 个 calcLifecycle 直接调用、Promise.all 并行（§4 条 5 登记值）；基准入参
   *  与 LifeTrajectoryCard 同构（effectiveMonthsDivisor 联动），情景入参 = 解码切片映射
   *  （ShareState.pension.monthsDivisor 已为 buildShareState 联动值，零二次推导）；解码
   *  失败不进候选（valid 判定同源）；情景切片只读解码进组件局部态，不触碰 applyShareState */
  useEffect(() => {
    if (!overlayOn || validCols.length === 0) {
      setOverlayData(null);
      return;
    }
    let stale = false;
    const timer = window.setTimeout(async () => {
      const id = overlayId ?? validCols[0].id;
      let target: ScenarioEntry | null = entries.find((e) => e.id === id) ?? null;
      if (!target || decodeShareState(target.payload) === null) {
        target = entries.find((e) => decodeShareState(e.payload) !== null) ?? null;
      }
      const decoded = target ? decodeShareState(target.payload) : null;
      if (!decoded) {
        if (!stale) setOverlayData(null);
        return;
      }
      const shared = decoded.state;
      const scenName = target?.name ?? "";
      const s = useCalculatorStore.getState();
      const effMonths = effectiveMonthsDivisor(
        s.pensionInputs.monthsDivisor,
        s.pensionInputs.retireAge,
        s.pensionMonthsSynced,
      );
      const [baseR, scenR] = await Promise.all([
        calcLifecycle({
          base: s.baselineInputs,
          accum: s.accumulationInputs,
          pension: { ...s.pensionInputs, monthsDivisor: effMonths },
          loan: s.loanInputs,
          rental: s.rentalInputs,
          lifeEvents: s.lifeEvents, // P9：叠加基准路径随事件重算（§5.6）
        }),
        calcLifecycle({
          base: shared.baseline,
          accum: shared.accumulation,
          pension: shared.pension,
          loan: shared.loan,
          rental: shared.rental,
          lifeEvents: shared.lifeEvents, // P9 v5：情景入参由 decode 切片映射自动携带事件
        }),
      ]);
      if (stale) return;
      setOverlayData(
        baseR.ok && scenR.ok
          ? {
              base: baseR.data.timeline,
              scen: scenR.data.timeline,
              name: scenName,
              depletedYear: scenR.data.summary.depletedYear,
            }
          : null,
      );
    }, OVERLAY_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [overlayOn, overlayId, entries, baseline, accumulation, pension, monthsSynced, loan, rental, lifeEvents]);

  const onSave = () => {
    const trimmed = Array.from(name.trim())
      .slice(0, SCENARIO_NAME_MAX_CHARS)
      .join("");
    if (trimmed === "") return;
    const payload = encodeShareState(useCalculatorStore.getState().buildShareState());
    const r = saveScenario(trimmed, payload);
    if (r.ok) {
      Message.success(t("scenario.saved", { name: trimmed }));
      setName("");
      reload();
    } else if (r.reason === "full") {
      Message.error(t("scenario.saveFailedFull", { max: SCENARIO_MAX_COUNT }));
    } else {
      Message.error(t("scenario.saveFailedStorage"));
    }
  };

  const onLoad = (entry: ScenarioEntry) => {
    if (applyShareState(entry.payload)) {
      Message.success(t("scenario.loaded", { name: entry.name }));
    }
  };

  const onDelete = (entry: ScenarioEntry) => {
    deleteScenario(entry.id);
    Message.success(t("scenario.deleted", { name: entry.name }));
    reload();
  };

  /** ③ 导出图片（p4-spec §8）：Canvas 2D 手绘对比表 → toBlob → <a download>；
   *  values 已是 ⑤ 换算后的屏显字符串，导出与屏显逐字符一致；配色取当前生效令牌
   *  （含色盲友好档语义色），三语文案随界面语言；零新依赖。valid 列数为 0 时按钮禁用。
   *  P9：导出自动携带基准列（shownCols = 基准列 + 存档情景列，屏显同源） */
  const onExport = () => {
    const exportCols = shownCols.map((c) => ({ name: c.name, failed: c.failed, values: c.values }));
    if (exportCols.length === 0) return;
    const canvas = buildScenarioTableBitmap({
      title: t("app.title"),
      metricLabels: METRIC_KEYS.map((key) => t(key)),
      columns: exportCols,
      footerLines: [t("app.title"), t("scenario.exportNote")],
      tokens: {
        bgPage: themeTokens.bgPage,
        textPrimary: themeTokens.textPrimary,
        textSecondary: themeTokens.textSecondary,
        fall: themeTokens.fall,
        hairlineCard: themeTokens.hairlineCard,
      },
      theme,
    });
    void downloadCanvasPng(canvas, buildExportFilename(new Date())).then((ok) => {
      if (ok) Message.success(t("scenario.exportDone"));
      else Message.error(t("scenario.exportFailed"));
    });
  };

  /** 对比表数据：行 = 指标、列 = 合法情景（§4.3「对每条合法情景解码后复算」；
   *  解码失败的条目在场景库列表标记 versionMismatch，不入对比列）；失败列整列「—」。
   *  P9 基准列（wf06 F4）：validCols = 存档情景列（不含伪条目——叠影/空态判定均按存档
   *  口径）；baseCol = 「当前参数」伪列，恒列首；shownCols = 屏显与导出的统一列序 */
  const validCols = cols.filter((c) => c.valid && c.id !== BASE_COL_ID);
  const baseCol = cols.find((c) => c.id === BASE_COL_ID && c.valid) ?? null;
  const shownCols = baseCol ? [baseCol, ...validCols] : validCols;
  const tableColumns = [
    { title: "", dataIndex: "metric", width: 150 },
    ...shownCols.map((c) => ({
      title: (
        <Text style={{ color: c.failed ? themeTokens.fall : undefined }} bold={!c.failed}>
          {c.name}
        </Text>
      ),
      dataIndex: c.id,
    })),
  ];
  const tableData = [
    /* F1 情景输入档案首行：展示各情景保存的「年支出（基期）」输入值（仅驱动蒙特卡洛模拟,
     *  不参与下方 8 项确定性指标复算——口径见 spendRowNote）。纯展示，零复算逻辑改动 */
    (() => {
      const row: Record<string, string> = { metric: t("mc.annualSpend") };
      for (const c of shownCols) {
        row[c.id] = c.failed ? "—" : c.spend;
      }
      return row;
    })(),
    ...METRIC_KEYS.map((key, rowIdx) => {
      const row: Record<string, string> = { metric: t(key) };
      for (const c of shownCols) {
        if (c.failed) row[c.id] = "—";
        else row[c.id] = c.values[rowIdx] ?? "—";
      }
      return row;
    }),
  ];

  return (
    <div>
      {/* 保存当前参数：复用分享编码（store.buildShareState → encodeShareState） */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Input
          allowClear
          value={name}
          maxLength={SCENARIO_NAME_MAX_CHARS}
          placeholder={t("scenario.namePlaceholder")}
          aria-label={t("scenario.nameLabel")}
          onChange={(v) => setName(v)}
          style={{ width: 240 }}
          onPressEnter={onSave}
        />
        <Button type="primary" size="small" onClick={onSave} className="wf-pressable">
          {t("scenario.save")}
        </Button>
      </div>

      {/* 场景库列表：名称 + 保存序号；版本不符条目标记 scenario.versionMismatch 并禁用载入 */}
      <div style={{ marginTop: 6 }}>
        <Text type="secondary">{t("scenario.listTitle", { count: entries.length })}</Text>
        {entries.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {entries.map((entry, idx) => {
              const valid = decodeShareState(entry.payload) !== null;
              return (
                <Tag
                  key={entry.id}
                  style={{ margin: 0, padding: "4px 8px" }}
                  color={valid ? "gray" : "red"}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>{idx + 1}</span>
                    <Text bold>{entry.name}</Text>
                    {valid ? null : <Text type="error">{t("scenario.versionMismatch")}</Text>}
                    {/* D6 触控区扩展包装：mini 按钮本体 24px 级命中扩至 ≥44px（docs/p3-spec.md §6.5） */}
                    <span className="wf-touch-target-sm">
                      <Button size="mini" type="text" disabled={!valid} onClick={() => onLoad(entry)}>
                        {t("scenario.load")}
                      </Button>
                    </span>
                    {/* D6 对策（docs/p3-spec.md §6.5 偏差 #12）：扩展命中区相邻重叠，删除为破坏性
                        动作，加 Popconfirm 二次确认——误触不再直接销毁情景（确定/取消文案随组件库
                        语言包联动，标题用 scenario.deleteConfirm） */}
                    <span className="wf-touch-target-sm">
                      <Popconfirm title={t("scenario.deleteConfirm")} onOk={() => onDelete(entry)}>
                        <Button size="mini" type="text">
                          {t("scenario.delete")}
                        </Button>
                      </Popconfirm>
                    </span>
                  </span>
                </Tag>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* P10 §1.3 K3/K4 槽切换条：叠影图 ⇄ 对比表（等高互换，槽 320） */}
      <SegBar
        name="wf-scenario-slot"
        ariaLabel={t("advanced.scenarioTitle")}
        value={slot}
        onChange={(v: string) => setSlot(v as "overlay" | "table")}
        options={[
          { value: "overlay", label: t("scenario.overlaySwitch") },
          { value: "table", label: t("scenario.compareTitle") },
        ]}
      />
      <SlotBox height={200}>
        {slot === "overlay" ? (
          <div className="wf-slot-body">
        {/* WF-04 T3 情景叠影（wf04-spec §1-T3）：开关置槽内行首（wf-touch-target
            44 命中）；恒两线裁定（research §2.4）；挂 scenario Tabs pane 内
            （hidden 非卸载承载）——切组/切 Tab 不卸载、不重算；防抖不被 Tab 切换触发 */}
        <Text bold>{t("scenario.overlaySwitch")}</Text>
        <span className="wf-touch-target" style={{ marginLeft: 8 }}>
          <Switch
            size="small"
            className="wf-pressable"
            checked={overlayOn}
            aria-label={t("scenario.overlaySwitch")}
            onChange={(v) => setOverlayOn(v)}
          />
        </span>
        {overlayOn && validCols.length > 0 ? (
          <Select
            size="mini"
            value={overlayId ?? validCols[0].id}
            style={{ width: 160, marginLeft: 8 }}
            aria-label={t("scenario.nameLabel")}
            options={validCols.map((c) => ({ label: c.name, value: c.id }))}
            onChange={(v) => setOverlayId(v)}
          />
        ) : null}
        {overlayOn && validCols.length === 0 ? (
          <Text type="secondary" className="wf-lens-cap" style={{ marginLeft: 8 }}>
            {t("scenario.overlayEmpty")}
          </Text>
        ) : null}
        {overlayOn && overlayData ? (
          <ScenarioOverlayChart
            base={overlayData.base}
            scen={overlayData.scen}
            scenName={overlayData.name}
            depletedYear={overlayData.depletedYear}
            tokens={themeTokens}
            symbol={symbol}
            convert={convert}
            reducedMotion={reducedMotion}
          />
        ) : null}
          </div>
        ) : (
          <div className="wf-slot-body">
        {/* 并排对比表：行 = 指标、列 = 情景（≤12 列横向滚动；窄屏同口径滚动）。
            骨架修复轮：标题/导出/口径注合一行（槽内 flex 纵排使三行独立占行，320 档
            335>312 的收口面） */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text bold>{t("scenario.compareTitle")}</Text>
          {/* ③ 导出图片按钮：size="small" + wf-pressable（44px 触控档随既有全局规则命中）；
              valid 列数为 0 时禁用（p4-spec §8.1）。F1 口径注沉降 FieldTip（骨架修复轮：
              独立注行收编——P5 反冗长口径，说明信息零丢失） */}
          <Button
            size="small"
            className="wf-pressable"
            disabled={validCols.length === 0}
            onClick={onExport}
          >
            {t("scenario.export")}
          </Button>
          <FieldTip text={t("scenario.spendRowNote")} />
        </div>
        {validCols.length === 0 ? (
          /* T6 = S6 空态人格化：同族「未上弦的刻度尺」图形经 Empty icon 参数注入；
             文案改写为「缺什么——下一步」句式（改值不增键）。
             第 1 轮验收复测补档：紧档插图 56→32（375×667 空表页 = 表头 96 + Empty 108
             = 216 > 槽 200，降档后 174 ≤ 200；视觉档位压缩非退役） */
          <Empty
            style={{ marginTop: 8 }}
            icon={<EmptyRulerArt size={isCompact ? 32 : 56} />}
            description={t("scenario.listEmpty")}
          />
        ) : (
          <>
            {/* D7 滑动提示：仅非空分支渲染（无表可滚不虚示）；<675.9 档由样式层放行 */}
            <Text type="secondary" className="wf-swipe-hint">{t("common.swipeHint")}</Text>
            {/* D7 两层结构：渐隐 ::after 挂在不滚动的外层上（挂在内层滚动容器会随内容滚走）。
                骨架修复轮：行分页（5 行/页 × 2 页）——320 档 9 行表高 390>槽静默裁切收口 */}
            <div className="wf-scenario-table-outer">
              <div className="wf-scenario-table-wrap">
                <Table
                  size="small"
                  border
                  columns={tableColumns}
                  data={tableData.slice(safeComparePage * compareRowsPerPage, safeComparePage * compareRowsPerPage + compareRowsPerPage)}
                  className="wf-scenario-table"
                />
              </div>
            </div>
            <SlotPager
              label={t("scenario.compareTitle")}
              total={compareTotal}
              page={safeComparePage}
              onPage={setComparePage}
            />
          </>
        )}
          </div>
        )}
      </SlotBox>
    </div>
  );
}
