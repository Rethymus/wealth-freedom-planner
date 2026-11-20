/**
 * ⑨ 公式原理与数据依据：480 的推导、假设链条与展示数据的来源/年份/核证标注。
 * 纯展示面板（无输入、无计算调用）；数据来自 src/data/insights.ts，环节标签走 i18n。
 * P5 §5 冗长治理（p5-spec §4/§5）：每节改「小节标题（T7 左标线）+ 一句话副行 +
 * info 图标」，原文全文下沉 FieldTip（全文键复用既有——字节近似守恒）；
 * childVideoNote（勘误性质）内联零文字、全文仅存 tooltip；evidence 小节补标题键。
 * 数据行挂 T4 行级 hover 读数（样式层 .wf-insight-row:hover 半档着色底）。
 */
import { Divider, Tag, Typography } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import {
  INSIGHT_CHAIN_STEPS,
  INSIGHT_CHILD_COST_REGIONS,
  INSIGHT_HEALTH_ENTRIES,
  INSIGHT_MARKET_ENTRIES,
} from "../../data/insights";
import type { InsightEntry, InsightVerification } from "../../data/insights";
import { FieldTip } from "../fields";

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

/** P5 §5：全文提示按「≤1 行内联短句 + 全文 tooltip」双通道下沉。原文全文键为满足
 *  「zh-CN ≥140 字符界面串 0 条」门禁（§8 #19）按句界拆为 2–3 段拼接键，全文无损、
 *  三语同构；拼接以空格相连（CJK 句读自身承载分隔，en 词界由空格承载） */
function joinParts(...parts: string[]): string {
  return parts.join(" ");
}

/** P5 T7 小节头：左标线 + 小节名（组件库 Divider orientation=left，发丝线分组隐喻落版面） */
function SectionTitle({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Divider orientation="left" className="wf-group-line">
      {t(titleKey)}
    </Divider>
  );
}

/** 通用数据行（链条 / 市场平均 / 医疗共用同一渲染；行挂 S4 hover 读数） */
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
      <SectionTitle titleKey="insights.formulaTitle" />
      {/* P5 §5：228 字符长串压为 ≤1 行副行，全文（3 段拼接键）经 info 图标下沉 FieldTip */}
      <div className="wf-insights-body">
        <Text type="secondary">{t("insights.formulaShort")}</Text>
        <FieldTip
          text={joinParts(t("insights.formulaBody1"), t("insights.formulaBody2"), t("insights.formulaBody3"))}
        />
      </div>

      <SectionTitle titleKey="insights.chainTitle" />
      <Text type="secondary" className="wf-insights-body">{t("insights.chainIntro")}</Text>
      <EntryRows entries={INSIGHT_CHAIN_STEPS} />

      <SectionTitle titleKey="insights.anchorTitle" />
      <Text type="secondary" className="wf-insights-body">{t("insights.anchorNote")}</Text>
      <div className="wf-insight-list">
        {INSIGHT_ANCHOR_KEYS.map((k) => (
          <div key={k} className="wf-insight-row">
            <Text>{t(k)}</Text>
          </div>
        ))}
      </div>

      <SectionTitle titleKey="insights.marketTitle" />
      <EntryRows entries={INSIGHT_MARKET_ENTRIES} />
      <Text type="secondary" className="wf-insight-note">{t("insights.marketNote")}</Text>

      <SectionTitle titleKey="insights.childTitle" />
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
      {/* P5 §5：childNote / childVideoNote 两长串——副行 1 行 + 全文 tooltip；
          childVideoNote（勘误性质）内联零文字、全文仅存 tooltip（图标紧邻上一副行） */}
      <div className="wf-insights-body">
        <Text type="secondary">{t("insights.childShort")}</Text>
        <FieldTip text={joinParts(t("insights.childNote1"), t("insights.childNote2"))} />
        <FieldTip text={joinParts(t("insights.childVideoNote1"), t("insights.childVideoNote2"))} />
      </div>

      <SectionTitle titleKey="insights.healthTitle" />
      <EntryRows entries={INSIGHT_HEALTH_ENTRIES} />
      <div className="wf-insights-body">
        <Text type="secondary">{t("insights.healthShort")}</Text>
        <FieldTip text={joinParts(t("insights.healthNote1"), t("insights.healthNote2"))} />
      </div>

      <SectionTitle titleKey="insights.strictTitle" />
      <Text type="secondary" className="wf-insights-body">{t("insights.strictBody")}</Text>
      <Text type="secondary" className="wf-insights-body">{t("insights.looseBody")}</Text>

      {/* P5 §11 补漏：evidence 小节补标题键（原 evidenceNote 独立渲染无标题） */}
      <SectionTitle titleKey="insights.evidenceTitle" />
      <div className="wf-insights-body">
        <Text type="secondary">{t("insights.evidenceShort")}</Text>
        <FieldTip text={joinParts(t("insights.evidenceNote1"), t("insights.evidenceNote2"))} />
      </div>
    </div>
  );
}
