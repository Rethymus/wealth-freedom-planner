/**
 * ① 反向估算：已有资产 → 扣除各项预留 → 反推每月可放心花费与可维持年数。
 * 文案经 react-i18next 三语化。
 */
import { Alert, Button, Descriptions, Message, Tooltip, Typography } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import { calcReverse } from "../../services/finance";
import { formatNumber } from "../../services/format";
import type { ReverseEstimateInput } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, PercentField } from "../fields";
import { useFinanceCall, useIsNarrowViewport, useMoney } from "../hooks";

const { Text } = Typography;

/**
 * 演示算例（视频推演口径，docs/p3-spec.md §4）：两段静态输入一键填入。
 * 定性：数据研究条目 8——算例为视频自建推演、非官方文件；只采纳其算术框架。
 * 期望断言（填入后，回报假设同步为 4.5 / 2.0，实际 2.5%）：
 * - investableAssets = 4,800,000.00；sustainableMonthly = 10,000.00（±0.01）；yearsSupported = 4.8；
 * - 算例 B 视频称 ≈0.9 万/月，含约 10% 不可复算折让——本工具如实给出 10,000.00，不修正。
 */
const REVERSE_EXAMPLES: { id: "A" | "B"; nameKey: string; inputs: ReverseEstimateInput }[] = [
  {
    id: "A",
    nameKey: "reverse.exampleA",
    inputs: {
      totalAssets: 6_000_000, childReserve: 700_000, healthReserve: 500_000,
      majorInvestment: 0, nominalReturnPct: 4.5, inflationPct: 2.0,
    },
  },
  {
    id: "B",
    nameKey: "reverse.exampleB",
    inputs: {
      totalAssets: 6_000_000, childReserve: 0, healthReserve: 0,
      majorInvestment: 1_200_000, nominalReturnPct: 4.5, inflationPct: 2.0,
    },
  },
];

export default function ReversePanel() {
  const { t } = useTranslation();
  const inputs = useCalculatorStore((s) => s.reverseInputs);
  const setInputs = useCalculatorStore((s) => s.setReverseInputs);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：展示币种符号 + 换算率；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;

  const { loading, result } = useFinanceCall(() => calcReverse(inputs), [inputs]);
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();

  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;

  /** 与基础模式同步预留与回报假设（数值全部来自 store，不写死） */
  const syncFromBaseline = () => {
    setInputs({
      childReserve: baseline.childCount * baseline.costPerChild,
      healthReserve: baseline.healthReserve,
      majorInvestment: baseline.majorInvestment,
      nominalReturnPct: baseline.nominalReturnPct,
      inflationPct: baseline.inflationPct,
    });
  };

  return (
    <div>
      <FieldRow>
        <AmountField
          label={t("reverse.totalAssets")}
          tooltip={t("reverse.totalAssetsTooltip")}
          value={inputs.totalAssets}
          onChange={(v) => setInputs({ totalAssets: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("reverse.childReserve")}
          tooltip={t("reverse.childReserveTooltip")}
          value={inputs.childReserve}
          onChange={(v) => setInputs({ childReserve: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("common.healthReserve")}
          tooltip={t("common.healthReserveTooltip")}
          value={inputs.healthReserve}
          onChange={(v) => setInputs({ healthReserve: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("common.majorInvestment")}
          tooltip={t("common.majorInvestmentTooltip")}
          value={inputs.majorInvestment}
          onChange={(v) => setInputs({ majorInvestment: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <PercentField
          md={12}
          label={t("common.nominalReturn")}
          tooltip={t("common.nominalReturnTooltip")}
          value={inputs.nominalReturnPct}
          onChange={(v) => setInputs({ nominalReturnPct: v })}
          suffix="%"
        />
        <PercentField
          md={12}
          label={t("common.inflation")}
          tooltip={t("common.inflationTooltip")}
          value={inputs.inflationPct}
          onChange={(v) => setInputs({ inflationPct: v })}
          suffix="%"
        />
      </FieldRow>

      <div className="wf-example-bar">
        <Text type="secondary">{t("reverse.exampleLegend")}</Text>
        {REVERSE_EXAMPLES.map((example) => (
          <Button
            key={example.id}
            size="small"
            className="wf-pressable"
            onClick={() => {
              setInputs(example.inputs);
              Message.success(t("reverse.exampleApplied", { name: t(example.nameKey) }));
            }}
          >
            {t(example.nameKey)}
          </Button>
        ))}
      </div>

      <Button size="small" style={{ marginBottom: 12 }} onClick={syncFromBaseline} className="wf-pressable">
        {t("reverse.syncButton")}
      </Button>

      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      {data ? (
        <Descriptions
          border
          size="small"
          layout={isNarrow ? "vertical" : "horizontal"}
          column={{ xs: 1, md: 3 }}
          data={[
            { label: t("reverse.investable"), value: money(data.investableAssets) },
            {
              label: t("reverse.sustainableMonthly"),
              value: (
                <Text bold className="wf-nowrap">{money(data.sustainableMonthly)}</Text>
              ),
            },
            {
              label: t("reverse.leverageYears"),
              value: (
                <Tooltip content={t("reverse.leverageTooltip")}>
                  <span>{formatNumber(data.yearsSupported, 1)} {t("units.yearUnit")}</span>
                </Tooltip>
              ),
            },
          ]}
        />
      ) : null}
      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}
      <Text type="secondary" className="wf-panel-note">{t("reverse.exampleNote")}</Text>
      <Text type="secondary" className="wf-panel-note">{t("reverse.exampleBNote")}</Text>
      <Text type="secondary" className="wf-panel-note">
        {t("reverse.note")}
      </Text>
    </div>
  );
}
