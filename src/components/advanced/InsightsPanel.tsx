/**
 * ⑨ 公式原理与数据依据：480 的推导、假设链条与展示数据的来源/年份/核证标注。
 * 纯展示面板（无输入、无计算调用）；数据来自 src/data/insights.ts，环节标签走 i18n。
 */
import { Tag, Typography } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import {
  INSIGHT_CHAIN_STEPS,
  INSIGHT_CHILD_COST_REGIONS,
  INSIGHT_HEALTH_ENTRIES,
  INSIGHT_MARKET_ENTRIES,
} from "../../data/insights";
import type { InsightEntry, InsightVerification } from "../../data/insights";

const { Text } = Typography;

/** 核证等级 → i18n 键与 Tag 色（静态映射，禁用模板串拼键；色语义：绿=官方 / 蓝=媒体 / 橙=视频口径） */
const VERIFICATION: Record<InsightVerification, { key: string; color: string }> = {
  official: { key: "insights.tagOfficial", color: "green" },
  media: { key: "insights.tagMedia", color: "blue" },
  video: { key: "insights.tagVideo", color: "orange" },
};

/** 直观换算锚点四行键（字面量静态映射，禁用模板串拼键；排列顺序即展示顺序） */
const INSIGHT_ANCHOR_KEYS: readonly string[] = [
  "insights.anchorExpense1",
  "insights.anchorExpense2",
  "insights.anchorAsset1",
  "insights.anchorAsset2",
];

/** 通用数据行（链条 / 市场平均 / 医疗共用同一渲染） */
function EntryRows({ entries }: { entries: (InsightEntry & { labelKey?: string })[] }) {
  const { t } = useTranslation();
  return (
    <ol className="wf-insight-list">
      {entries.map((entry) => (
        <li key={entry.labelKey ?? entry.value} className="wf-insight-row">
          <div className="wf-insight-main">
            {entry.labelKey ? <Text>{t(entry.labelKey)}</Text> : null}
            <Text bold className="wf-nowrap">{entry.value}</Text>
            <Tag size="small" color={VERIFICATION[entry.verification].color}>
              {t(VERIFICATION[entry.verification].key)}
            </Tag>
          </div>
          <Text type="secondary" className="wf-insight-source">
            {entry.source}；{entry.year}；{entry.scope}
          </Text>
        </li>
      ))}
    </ol>
  );
}

export default function InsightsPanel() {
  const { t } = useTranslation();
  return (
    <div className="wf-insights">
      <Text bold className="wf-insight-section-title">{t("insights.formulaTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.formulaBody")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.chainTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.chainIntro")}</Text>
      <EntryRows entries={INSIGHT_CHAIN_STEPS} />

      <Text bold className="wf-insight-section-title">{t("insights.anchorTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.anchorNote")}</Text>
      <div className="wf-insight-list">
        {INSIGHT_ANCHOR_KEYS.map((k) => (
          <div key={k} className="wf-insight-row">
            <Text>{t(k)}</Text>
          </div>
        ))}
      </div>

      <Text bold className="wf-insight-section-title">{t("insights.marketTitle")}</Text>
      <EntryRows entries={INSIGHT_MARKET_ENTRIES} />
      <Text type="secondary" className="wf-insight-note">{t("insights.marketNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.childTitle")}</Text>
      <div className="wf-insight-list">
        {INSIGHT_CHILD_COST_REGIONS.map((row) => (
          <div key={row.region} className="wf-insight-row">
            <div className="wf-insight-main">
              <Text>{row.region}</Text>
              <Text bold className="wf-nowrap">{row.costWan} 万元</Text>
            </div>
            {row.note ? (
              <Text type="secondary" className="wf-insight-source">{row.note}</Text>
            ) : null}
          </div>
        ))}
      </div>
      <Text type="secondary" className="wf-insight-note">{t("insights.childNote")}</Text>
      <Text type="secondary" className="wf-insight-note">{t("insights.childVideoNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.healthTitle")}</Text>
      <EntryRows entries={INSIGHT_HEALTH_ENTRIES} />
      <Text type="secondary" className="wf-insight-note">{t("insights.healthNote")}</Text>

      <Text bold className="wf-insight-section-title">{t("insights.strictTitle")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.strictBody")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.looseBody")}</Text>

      <Text type="secondary" className="wf-insight-note">{t("insights.evidenceNote")}</Text>
    </div>
  );
}
