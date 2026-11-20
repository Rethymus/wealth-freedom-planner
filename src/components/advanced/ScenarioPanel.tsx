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
import { Button, Empty, Input, Message, Popconfirm, Table, Tag, Typography } from "@arco-design/web-react";
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
import { calcBaseline, calcPension, calcRental, calcReverse, calcTax } from "../../services/finance";
import { currencySymbol, formatMoney, formatMoneyFixed, formatNumber } from "../../services/format";
import { resolveThemeTokens } from "../../data/defaults";
import { useCalculatorStore } from "../../store/useCalculatorStore";

const { Text } = Typography;

/** 对比列：每条合法情景一列；failed = 任一确定性计算失败（整列「—」） */
interface CompareCol {
  id: string;
  name: string;
  valid: boolean;
  failed: boolean;
  /** 8 项指标值（§4.3 表行序；valid=false / failed=true 时为空数组） */
  values: string[];
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

/** 单条情景的 8 项指标复算（确定性 wasm 函数；任一失败返回 failed 列） */
async function computeColumn(entry: ScenarioEntry, symbol: string, yearUnit: string): Promise<CompareCol> {
  const invalid: CompareCol = { id: entry.id, name: entry.name, valid: false, failed: false, values: [] };
  const shared: ShareState | null = decodeShareState(entry.payload);
  if (!shared) return invalid;
  const [baselineR, rentalR, pensionR, taxR, reverseR] = await Promise.all([
    calcBaseline(shared.baseline),
    calcRental(shared.rental),
    calcPension({ ...shared.baseline, ...shared.pension }),
    calcTax(shared.tax),
    calcReverse(shared.reverse),
  ]);
  const failedCol: CompareCol = { id: entry.id, name: entry.name, valid: true, failed: true, values: [] };
  if (!baselineR.ok || !rentalR.ok || !pensionR.ok || !taxR.ok || !reverseR.ok) return failedCol;
  const saving = shared.accumulation.monthlyIncome - shared.accumulation.monthlyExpense;
  const payback = rentalR.data.paybackYears;
  const values: string[] = [
    formatMoney(baselineR.data.criticalValue, symbol),
    formatMoney(rentalR.data.annualNetCashFlow, symbol),
    payback >= 0 ? `${formatNumber(payback, 1)} ${yearUnit}` : "—",
    formatMoney(pensionR.data.pensionMonthly, symbol),
    `${formatNumber(pensionR.data.coverageRatio * 100, 1)}%`,
    formatMoney(taxR.data.netIncome, symbol),
    formatMoney(reverseR.data.sustainableMonthly, symbol),
    // 月储蓄（打工口径）：TS 显示算术，可负（列内固定两位小数与其他金额列对齐）
    formatMoneyFixed(saving, symbol),
  ];
  return { id: entry.id, name: entry.name, valid: true, failed: false, values };
}

export default function ScenarioPanel() {
  const { t } = useTranslation();
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  const symbol = currencySymbol(displayCode);
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);
  const applyShareState = useCalculatorStore((s) => s.applyShareState);

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<ScenarioEntry[]>([]);
  const [cols, setCols] = useState<CompareCol[]>([]);

  const reload = () => setEntries(listScenarios());
  useEffect(() => {
    reload();
  }, []);

  /** 对比表复算：条目集或币种变化后逐景重算（毫秒级 × ≤12 情景；过期结果丢弃） */
  useEffect(() => {
    let stale = false;
    void (async () => {
      const computed = await Promise.all(entries.map((e) => computeColumn(e, symbol, t("units.yearUnit"))));
      if (!stale) setCols(computed);
    })();
    return () => {
      stale = true;
    };
  }, [entries, symbol, t]);

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

  /** 对比表数据：行 = 指标、列 = 合法情景（§4.3「对每条合法情景解码后复算」；
   *  解码失败的条目在场景库列表标记 versionMismatch，不入对比列）；失败列整列「—」 */
  const validCols = cols.filter((c) => c.valid);
  const tableColumns = [
    { title: "", dataIndex: "metric", width: 150 },
    ...validCols.map((c) => ({
      title: (
        <Text style={{ color: c.failed ? themeTokens.fall : undefined }} bold={!c.failed}>
          {c.name}
        </Text>
      ),
      dataIndex: c.id,
    })),
  ];
  const tableData = METRIC_KEYS.map((key, rowIdx) => {
    const row: Record<string, string> = { metric: t(key) };
    for (const c of validCols) {
      if (c.failed) row[c.id] = "—";
      else row[c.id] = c.values[rowIdx] ?? "—";
    }
    return row;
  });

  return (
    <div>
      {/* 保存当前参数：复用分享编码（store.buildShareState → encodeShareState） */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Input
          allowClear
          value={name}
          maxLength={SCENARIO_NAME_MAX_CHARS}
          placeholder={t("scenario.namePlaceholder")}
          onChange={(v) => setName(v)}
          style={{ width: 240 }}
          onPressEnter={onSave}
        />
        <Button type="primary" size="small" onClick={onSave} className="wf-pressable">
          {t("scenario.save")}
        </Button>
      </div>

      {/* 场景库列表：名称 + 保存序号；版本不符条目标记 scenario.versionMismatch 并禁用载入 */}
      <div style={{ marginTop: 12 }}>
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

      {/* 并排对比表：行 = 指标、列 = 情景（≤12 列横向滚动；窄屏同口径滚动） */}
      <div style={{ marginTop: 16 }}>
        <Text bold>{t("scenario.compareTitle")}</Text>
        {cols.filter((c) => c.valid).length === 0 ? (
          <Empty
            style={{ marginTop: 8 }}
            description={t("scenario.listEmpty")}
          />
        ) : (
          <>
            {/* D7 滑动提示：仅非空分支渲染（无表可滚不虚示）；<670.9 档由样式层放行 */}
            <Text type="secondary" className="wf-swipe-hint">{t("common.swipeHint")}</Text>
            {/* D7 两层结构：渐隐 ::after 挂在不滚动的外层上（挂在内层滚动容器会随内容滚走） */}
            <div className="wf-scenario-table-outer">
              <div className="wf-scenario-table-wrap">
                <Table
                  size="small"
                  border
                  columns={tableColumns}
                  data={tableData}
                  className="wf-scenario-table"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
