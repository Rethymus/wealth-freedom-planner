/**
 * ⑤ 税务估算与多币种校验。
 * 税表来自 src/data/taxTables.ts（当前为占位空数组时给出提示并禁用计算）；
 * 选「其他」时可手动输入简化有效税率（构造单档税带走 estimate_tax）。
 * 文案经 react-i18next 三语化；税表数据层的长注释（来源/速算表口径）保持简中。
 */
import { Alert, Descriptions, Divider, Grid, InputNumber, Select, Typography } from "@arco-design/web-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_TABLES } from "../../data/taxTables";
import { LIMITS } from "../../data/defaults";
import { formatNumber, formatPercent } from "../../services/format";
import type { EstimateTaxInput, TaxBand } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { calcTax } from "../../services/finance";
import { FieldRow, AmountField } from "../fields";
import { useFinanceCall, useIsNarrowViewport, useMoney } from "../hooks";
import CurrencySection from "./CurrencySection";

const { Text } = Typography;
const { Col } = Grid;

const OTHER = "OTHER";

/** 国家/地区选项（税表按键匹配 TAX_TABLES.countryCode；名称随语言切换） */
const COUNTRY_CODES: Array<{ code: string; other?: boolean }> = [
  { code: "CN" },
  { code: "US" },
  { code: "GB" },
  { code: "DE" },
  { code: "JP" },
  { code: "SG" },
  { code: "AU" },
  { code: "CA" },
  { code: "OTHER", other: true },
];

export default function TaxPanel() {
  const { t } = useTranslation();
  const taxInputs = useCalculatorStore((s) => s.taxInputs);
  const setTaxInputs = useCalculatorStore((s) => s.setTaxInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：结果经展示币种换算；rate null = 符号-only。
   *  非中国税档「本币口径」歧义为现状简化（p4-spec §14 #9）：⑤ 统一换算不修复不恶化 */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();

  const [country, setCountry] = useState<string>("CN");
  /** 「其他」时手动输入的简化有效税率（百分点；未填时不计算） */
  const [manualRatePct, setManualRatePct] = useState<number | null>(null);
  /** 同一国家/地区存在多套税表（如美国单身 / 已婚合并申报）时的选择序号 */
  const [tableIndex, setTableIndex] = useState(0);

  /** 国家/地区选项（名称随语言切换） */
  const countryOptions = COUNTRY_CODES.map(({ code, other }) => ({
    label: other ? t("tax.other") : t(`countries.${code}`),
    value: code,
  }));
  const countryLabel = (code: string): string =>
    code === OTHER ? t("tax.other") : t(`countries.${code}`);

  /** 该国家/地区的全部税表（可能多于一套，全部由 TAX_TABLES 提供） */
  const countryTables = useMemo(
    () => TAX_TABLES.filter((tbl) => tbl.countryCode === country),
    [country],
  );
  useEffect(() => {
    setTableIndex(0);
  }, [country]);

  const table = countryTables[Math.min(tableIndex, Math.max(countryTables.length - 1, 0))] ?? null;
  const isOther = country === OTHER;

  /** 组装 estimate_tax 输入：真实税表 or 其他（单档有效税率，本币口径） */
  const taxInput: EstimateTaxInput | null = useMemo(() => {
    if (isOther) {
      if (manualRatePct === null) return null;
      const band: TaxBand = { lower: 0, rate: manualRatePct / 100 };
      return {
        grossAnnualIncome: taxInputs.grossAnnualIncome,
        standardDeduction: 0,
        bands: [band],
      };
    }
    if (!table) return null;
    return {
      grossAnnualIncome: taxInputs.grossAnnualIncome,
      standardDeduction: table.standardDeduction,
      bands: table.bands,
    };
  }, [isOther, manualRatePct, table, taxInputs.grossAnnualIncome]);

  const { loading, result } = useFinanceCall(
    () => (taxInput ? calcTax(taxInput) : Promise.resolve({ ok: false as const, error: "", notReady: false })),
    [taxInput],
    { enabled: taxInput !== null },
  );

  const data = result?.ok === true ? result.data : null;
  const error = taxInput && result && !result.ok ? result.error : null;

  const selectedLabel = countryLabel(country);

  return (
    <div>
      <FieldRow>
        <Col xs={24} className="wf-field">
          <div className="wf-field-label">
            <Text>{t("tax.countryLabel")}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {t("tax.countryHint")}
            </Text>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Select
              value={country}
              options={countryOptions}
              onChange={(v: string) => setCountry(v)}
              style={{ width: 220 }}
              className="wf-pressable"
            />
            {countryTables.length > 1 ? (
              <Select
                value={String(Math.min(tableIndex, countryTables.length - 1))}
                options={countryTables.map((tbl, i) => ({ label: tbl.name, value: String(i) }))}
                onChange={(v: string) => setTableIndex(Number(v))}
                style={{ width: 320 }}
                className="wf-pressable"
              />
            ) : null}
          </div>
        </Col>
        <AmountField
          label={t("tax.grossIncome")}
          tooltip={t("tax.grossIncomeTooltip")}
          value={taxInputs.grossAnnualIncome}
          onChange={(v) => setTaxInputs({ grossAnnualIncome: v })}
          suffix={displayCode === "CNY" ? t("units.localPerYear") : undefined}
          convertRate={rate}
        />
        {isOther ? (
          <Col xs={24} className="wf-field">
            <div className="wf-field-label">
              <Text>{t("tax.manualRate")}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {t("tax.manualRateHint")}
              </Text>
            </div>
            <InputNumber
              value={manualRatePct ?? undefined}
              min={LIMITS.manualRate.min}
              max={LIMITS.manualRate.max}
              step={LIMITS.manualRate.step}
              precision={LIMITS.manualRate.precision}
              placeholder={t("tax.manualRatePlaceholder")}
              suffix="%"
              style={{ width: 200 }}
              onChange={(v: number) => setManualRatePct(Number.isFinite(v) ? v : null)}
            />
            <div className="wf-field-hint">
              <Text type="secondary">
                {manualRatePct === null
                  ? t("tax.manualRateEmpty")
                  : t("tax.manualRateApplied", { rate: formatPercent(manualRatePct) })}
              </Text>
            </div>
          </Col>
        ) : null}
      </FieldRow>

      {!isOther ? (
        <div className="wf-field-hint" style={{ marginTop: 4 }}>
          <Text type="secondary">{t("tax.disclaimer")}</Text>
        </div>
      ) : (
        <div className="wf-field-hint" style={{ marginTop: 4 }}>
          <Text type="secondary">{t("tax.otherDisclaimer", { disclaimer: t("tax.disclaimer") })}</Text>
        </div>
      )}

      {!isOther && !table ? (
        <Alert
          type="warning"
          style={{ marginTop: 8 }}
          content={t("tax.tableMissing", { country: selectedLabel })}
        />
      ) : null}

      {table ? (
        <div className="wf-field-hint" style={{ marginTop: 4 }}>
          <Text type="secondary">
            {table.name}（{table.year} 年度口径）；{table.note}
          </Text>
        </div>
      ) : null}

      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      {data ? (
        <Descriptions
          border
          size="small"
          style={{ marginTop: 8 }}
          layout={isNarrow ? "vertical" : "horizontal"}
          column={{ xs: 1, md: 2 }}
          data={[
            { label: t("tax.taxableIncome"), value: money(data.taxableIncome) },
            { label: t("tax.taxAmount"), value: money(data.tax) },
            { label: t("tax.netIncome"), value: <Text bold className="wf-nowrap">{money(data.netIncome)}</Text> },
            { label: t("tax.effectiveRate"), value: formatPercent(data.effectiveRatePct) },
          ]}
        />
      ) : null}
      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}

      <Divider style={{ margin: "16px 0 12px" }} />
      <Text bold>{t("tax.currencySectionTitle")}</Text>
      <CurrencySection />
    </div>
  );
}
