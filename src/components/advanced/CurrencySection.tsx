/**
 * 多币种校验（税务面板下半区）：
 * 币种 Select + 汇率显示 + 获取时间戳 + 离线快照标注；
 * 月开销显著偏离区域人均消费时给出黄色 Alert（非阻断）；
 * 恩格尔系数对比（区域参考数据为空时降级为占位说明）。
 * 文案经 react-i18next 三语化；汇率来源/数据时间为接口原始数据。
 */
import { Alert, Button, Descriptions, Divider, InputNumber, Select, Tag, Typography } from "@arco-design/web-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CURRENCIES, LIMITS } from "../../data/defaults";
import { MONTHLY_EXPENSE_DEVIATION_THRESHOLDS, REGIONAL_BENCHMARKS } from "../../data/regional";
import { formatNumber, formatTimestamp } from "../../services/format";
import { getRates } from "../../services/rates";
import type { RatesResult } from "../../services/rates";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { useIsNarrowViewport } from "../hooks";

const { Text } = Typography;

/** 中国城镇基准条目（engel 系数与偏离检测共用；偏离锚点/阈值取数据层字段） */
const CN_BENCHMARK = REGIONAL_BENCHMARKS.find((b) => b.countryCode === "CN") ?? null;

export default function CurrencySection({ paged, page }: { paged?: boolean; page?: number } = {}) {
  const { t } = useTranslation();
  /** 骨架修复轮：汇率行恒横排（label「CNY（¥）」为短标签，纵排在 320 档使页 0 达
   *  664px 超槽——横排 6 行 ≈204px 收口；既有「防长 label 挤压」的纵排前提不成立，
   *  useIsNarrowViewport 保留登记注记） */
  void useIsNarrowViewport;
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const setCurrency = useCalculatorStore((s) => s.setCurrency);
  const monthlyExpense = useCalculatorStore((s) => s.baselineInputs.monthlyExpense);

  const [rates, setRates] = useState<RatesResult | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  /** 用户恩格尔系数（食品支出占总支出比例，0–1；选填） */
  const [engel, setEngel] = useState<number | null>(null);

  const load = useCallback((force: boolean) => {
    setRatesLoading(true);
    getRates(force)
      .then(setRates)
      .finally(() => setRatesLoading(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  /** 币种选项：代码 + 符号（跨语言通用，避免界面文案夹带数据层名称） */
  const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.code}（${c.symbol}）`, value: c.code }));

  /** 月开销偏离检测：按 regional.ts 用法建议，以中国城镇人均消费（RMB 锚点）为基准，不做汇率换算。
   *  ⑤（p4-spec §14 #8）：store 月开销恒为 CNY 规范值，检测与展示币种解耦——
   *  删除既有 displayCode !== "CNY" 提前返回分支，非 CNY 展示下检测同样执行（行为微变已登记） */
  const benchmarkAlert = (() => {
    if (!CN_BENCHMARK?.monthlyConsumptionAnchorCny) return null;
    const anchor = CN_BENCHMARK.monthlyConsumptionAnchorCny;
    const anchorText = formatNumber(anchor, 0);
    const region = t("common.regionUrbanCn");
    if (monthlyExpense / anchor < MONTHLY_EXPENSE_DEVIATION_THRESHOLDS.low) {
      return t("currency.benchmarkBelow", { region, anchor: anchorText, year: CN_BENCHMARK.year });
    }
    if (monthlyExpense / anchor > MONTHLY_EXPENSE_DEVIATION_THRESHOLDS.high) {
      return t("currency.benchmarkAbove", { region, anchor: anchorText, year: CN_BENCHMARK.year });
    }
    return null;
  })();

  const engelCompare = (() => {
    if (engel === null) return t("currency.engelEmpty");
    if (!CN_BENCHMARK) return t("currency.engelNoBenchmark", { value: formatNumber(engel, 2) });
    const [lo, hi] = CN_BENCHMARK.engelCoeffRange;
    const position =
      engel < lo ? t("currency.engelBelow") : engel > hi ? t("currency.engelAbove") : t("currency.engelWithin");
    return t("currency.engelCompare", {
      value: formatNumber(engel, 2),
      position,
      region: t("common.regionUrbanCn"),
      lo: formatNumber(lo, 2),
      hi: formatNumber(hi, 2),
      year: CN_BENCHMARK.year,
    });
  })();

  return (
    <div className="wf-currency-sec">
      {/* P10 槽态分页（TaxPanel 三态槽 currency 态承载）：paged=true 时三页等高互换——
          第 0 页 = 币种选择 + 刷新，第 1 页 = 汇率表 + 来源行，第 2 页 = 区域偏离 +
          恩格尔系数（骨架修复轮再分页：320 档页 0 全量 664px 超槽 381 的收口）；
          缺省（paged 未传）整段原样渲染 */}
      <div className="wf-field" style={{ marginBottom: 12 }} hidden={paged === true && page !== 0}>
        <div className="wf-field-label">
          <Text>{t("currency.label")}</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {t("currency.hint")}
          </Text>
        </div>
        <div className="wf-currency-meta" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Select
            value={displayCode}
            options={currencyOptions}
            onChange={(v: string) => setCurrency({ base: v, display: v })}
            style={{ width: 200 }}
            className="wf-pressable"
          />
          <Button size="small" loading={ratesLoading} onClick={() => load(true)} className="wf-pressable">
            {t("currency.refreshRates")}
          </Button>
          {rates ? (
            <Tag color={rates.offline ? "orange" : "green"}>
              {rates.offline ? t("currency.offline") : t("currency.online")}
            </Tag>
          ) : null}
        </div>
        {displayCode !== "CNY" ? (
          <div className="wf-field-hint">
            <Text type="secondary">{t("currency.cnyNotice")}</Text>
          </div>
        ) : null}
      </div>

      {rates && !(paged === true && page !== 1) ? (
        <>
          <Descriptions
            border
            size="small"
            className="wf-currency-rates"
            layout="horizontal"
            column={{ xs: 1, md: 3 }}
            title={null}
            data={CURRENCIES.map((c) => {
              const rate = rates.rates[c.code];
              return {
                label: `${c.code}（${c.symbol}）`,
                value:
                  typeof rate === "number" && Number.isFinite(rate)
                    ? t("currency.rateLine", { base: rates.base, rate: formatNumber(rate, 4), target: c.code })
                    : t("currency.rateUnavailable"),
              };
            })}
          />
          <div className="wf-field-hint">
            <Text type="secondary">
              {t("currency.sourceLine", {
                source: rates.source,
                offlineNote: rates.offline ? t("currency.offlineNote") : "",
                updated: rates.ratesUpdatedAt ? rates.ratesUpdatedAt : t("currency.rateUnavailable"),
                fetchedAt: formatTimestamp(rates.fetchedAt, t("currency.noTimestamp")),
                note: rates.note ? `；${rates.note}` : "",
              })}
            </Text>
          </div>
        </>
      ) : !(paged === true && page !== 1) ? (
        <Text type="secondary">{t("currency.loadingRates")}</Text>
      ) : null}

      {paged ? <Divider style={{ margin: "8px 0 8px" }} /> : <Divider style={{ margin: "16px 0 12px" }} />}

      {!paged || page === 2 ? (
        <>
          {benchmarkAlert ? (
            <Alert
              type="warning"
              style={{ marginBottom: 12 }}
              content={t("currency.benchmarkNoticePrefix") + benchmarkAlert}
            />
          ) : CN_BENCHMARK ? (
            // 检测已与展示币种解耦（⑤）：口径说明恒为「以人民币口径为锚」，不再分叉展示币种
            <Alert type="info" style={{ marginBottom: 12 }} content={t("currency.benchmarkInfoCny")} />
          ) : (
            <Alert type="info" style={{ marginBottom: 12 }} content={t("currency.benchmarkEmpty")} />
          )}

          <div className="wf-field" style={{ marginBottom: 4 }}>
            <div className="wf-field-label">
              <Text>{t("currency.engelLabel")}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {t("currency.engelHint")}
              </Text>
            </div>
            <InputNumber
              value={engel ?? undefined}
              min={LIMITS.engel.min}
              max={LIMITS.engel.max}
              step={LIMITS.engel.step}
              precision={LIMITS.engel.precision}
              placeholder={t("currency.engelPlaceholder")}
              style={{ width: 160 }}
              onChange={(v: number) => setEngel(Number.isFinite(v) ? v : null)}
            />
            <div className="wf-field-hint">
              <Text type="secondary">{engelCompare}</Text>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
