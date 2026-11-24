/**
 * ⑤ 税务估算与多币种校验。
 * 税表来自 src/data/taxTables.ts（当前为占位空数组时给出提示并禁用计算）；
 * 选「其他」时可手动输入简化有效税率（构造单档税带走 estimate_tax）。
 * 文案经 react-i18next 三语化；税表数据层的长注释（来源/速算表口径）保持简中。
 */
import {Alert, Descriptions, Grid, InputNumber, Select, Typography} from "@arco-design/web-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_TABLES } from "../../data/taxTables";
import { LIMITS } from "../../data/defaults";
import { formatNumber, formatPercent } from "../../services/format";
import type { EstimateTaxInput, TaxBand } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { calcTax } from "../../services/finance";
import { FieldRow, AmountField, FieldTip } from "../fields";
import { SegBar, SlotBox, SlotPager } from "../slots";
import { useFinanceCall, useIsNarrowViewport, useMoney } from "../hooks";
import CurrencySection from "./CurrencySection";

const { Text } = Typography;
const { Col } = Grid;

const OTHER = "OTHER";

/** 国家/地区码 → i18n 键的静态映射（禁用模板串拼键；键集与 COUNTRY_CODES / 三语资源 countries.* 一致，未知码回退原码展示） */
const COUNTRY_NAME_KEY: Record<string, string> = {
  CN: "countries.CN",
  US: "countries.US",
  GB: "countries.GB",
  DE: "countries.DE",
  JP: "countries.JP",
  SG: "countries.SG",
  AU: "countries.AU",
  CA: "countries.CA",
};

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
    label: other ? t("tax.other") : t(COUNTRY_NAME_KEY[code] ?? code),
    value: code,
  }));
  const countryLabel = (code: string): string =>
    code === OTHER ? t("tax.other") : t(COUNTRY_NAME_KEY[code] ?? code);

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

  /** F6（第 1 轮验收 P1）修复：把选定税表（standardDeduction + bands，与 taxInput 同源）
   *  回写 store.taxInputs——对比列（ScenarioPanel computeColumn calcTax(shared.tax)）、
   *  情景存档与分享载荷（tax 切片本就携带 bands，share v6 形状零变更）与本面板同源，
   *  消除「面板显示税后收入而基准列恒 ¥0」的失真。写入按字段判等（bands 引用稳定）
   *  防回环；「其他」未填手动税率（taxInput null）不写——store 保持既有值。 */
  useEffect(() => {
    if (!taxInput) return;
    const s = useCalculatorStore.getState().taxInputs;
    if (s.standardDeduction !== taxInput.standardDeduction || s.bands !== taxInput.bands) {
      setTaxInputs({ standardDeduction: taxInput.standardDeduction, bands: taxInput.bands });
    }
  }, [taxInput, setTaxInputs]);

  const data = result?.ok === true ? result.data : null;
  const error = taxInput && result && !result.ok ? result.error : null;

  const selectedLabel = countryLabel(country);
  /** P10 槽契约（§1.5 R4/R5；life 税务组与 pro 分析组两宿主共用）：结果 ⇄ 参数 ⇄
   *  多币种校验三态等高互换（第三段标签复用 tax.currencySectionTitle 既有键，零新键），
   *  多币种态内两页（汇率 / 基准与恩格尔——超行走槽内分页） */
  const [slot, setSlot] = useState<"out" | "params" | "currency">("params");
  const [currencyPage, setCurrencyPage] = useState(0);

  return (
    <div>
      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      <SegBar
        name="wf-tax-slot"
        ariaLabel={t("advanced.taxTitle")}
        value={slot}
        onChange={(v: string) => setSlot(v as "out" | "params" | "currency")}
        options={[
          { value: "out", label: t("atlas.slotChart") },
          { value: "params", label: t("atlas.slotParams") },
          { value: "currency", label: t("tax.currencySectionTitle") },
        ]}
      />
      <SlotBox height={200}>
        {slot === "out" ? (
          <div className="wf-slot-body">
            {!isOther ? (
              <Text type="secondary" className="wf-panel-note">
                {t("tax.disclaimer")}
              </Text>
            ) : (
              <Text type="secondary" className="wf-panel-note">
                {t("tax.otherDisclaimer", { disclaimer: t("tax.disclaimer") })}
              </Text>
            )}
            {!isOther && !table ? (
              <Alert type="warning" content={t("tax.tableMissing", { country: selectedLabel })} />
            ) : null}
            {table ? (
              /* 骨架修复轮（F1/F9）：表注全文（来源/速算口径数百字）下沉 FieldTip——
                  320 档面板注行实测 300px+ 级超槽的构成行；名称+年度仍单行可见（P5
                  冗长治理口径，全文零丢失） */
              <Text type="secondary" className="wf-panel-note">
                {table.name}（{table.year} 年度口径）
                <FieldTip text={`${table.name}（${table.year} 年度口径）；${table.note}`} />
              </Text>
            ) : null}
            {data ? (
              <Descriptions
                border
                size="small"
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
            {error ? <Alert type="error" style={{ marginTop: 4 }} content={error} /> : null}
          </div>
        ) : slot === "params" ? (
          <div className="wf-slot-body">
            <FieldRow className="wf-slot-row">
              <Col xs={12} md={12} className="wf-field">
                <div className="wf-field-label">
                  <Text>{t("tax.countryLabel")}</Text>
                  <FieldTip text={t("tax.countryHint")} />
                </div>
                <Select
                  value={country}
                  options={countryOptions}
                  onChange={(v: string) => setCountry(v)}
                  className="wf-pressable wf-input-full"
                />
                {countryTables.length > 1 ? (
                  <Select
                    value={String(Math.min(tableIndex, countryTables.length - 1))}
                    options={countryTables.map((tbl, i) => ({ label: tbl.name, value: String(i) }))}
                    onChange={(v: string) => setTableIndex(Number(v))}
                    style={{ marginTop: 4 }}
                    className="wf-pressable wf-input-full"
                  />
                ) : null}
              </Col>
              <AmountField
                xs={12}
                md={12}
                label={t("tax.grossIncome")}
                tooltip={t("tax.grossIncomeTooltip")}
                value={taxInputs.grossAnnualIncome}
                onChange={(v) => setTaxInputs({ grossAnnualIncome: v })}
                suffix={displayCode === "CNY" ? t("units.localPerYear") : undefined}
                convertRate={rate}
              />
              {isOther ? (
                <Col xs={24} md={24} className="wf-field">
                  <div className="wf-field-label">
                    <Text>{t("tax.manualRate")}</Text>
                    <FieldTip text={t("tax.manualRateHint")} />
                  </div>
                  <InputNumber
                    value={manualRatePct ?? undefined}
                    min={LIMITS.manualRate.min}
                    max={LIMITS.manualRate.max}
                    step={LIMITS.manualRate.step}
                    precision={LIMITS.manualRate.precision}
                    placeholder={t("tax.manualRatePlaceholder")}
                    suffix="%"
                    style={{ width: 160 }}
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
          </div>
        ) : (
          <div className="wf-slot-body">
            {/* P5 T7 同族类：多币种校验区迁入槽第三态（原 Divider + 标题行结构退役——
                标题信息由槽切换条段标签承载，键值不变）。骨架修复轮：页 0 币种选择 /
                页 1 汇率表 / 页 2 区域偏离与恩格尔三页等高互换（320 档收口登记） */}
            <CurrencySection paged page={currencyPage} />
            <SlotPager label={t("advanced.taxTitle")} total={3} page={Math.min(currencyPage, 2)} onPage={setCurrencyPage} />
          </div>
        )}
      </SlotBox>
    </div>
  );
}
