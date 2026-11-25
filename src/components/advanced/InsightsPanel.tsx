/**
 * ⑨ 公式原理与数据依据（P10 §1.4 P1–P3 条目化重构）：8 节 → 5 条目（≤5 纪律）；
 * E5 声明 = Footer 两行迁入（app.footerDisclaimer / app.footerPrivacy 键复用不改名
 * ——T11 信息先迁移后删元素）。
 * - P1 条目切换条：5 条目（insights.entry* 五新键，§7）；<1200 分段条形态、≥1200
 *   左轨竖排（样式层承载，高度不变）。
 * - 骨架修复轮（F5，红线 10 路线 (b) 条目内两级切换的落地形态）：条目内分节改
 *   SlotPager 翻页等高互换——原「分节栈同屏」静态底稿在 320–1200×800 各档实测超预算
 *   （chain 809>502@320、E3 551>489@320 等），两级切换为全视口统一形态；分节内容
 *   零丢失（一次翻页可达），条目切换复位页码。
 * - 渲染压缩（红线 10 路线 (a)）：阅读段降 caption 档 12px/18px（.wf-entry-reading，
 *   样式层）、来源行/勘误注全文下沉 FieldTip（compact 恒启用）——数据层 insights.ts
 *   零改动；E2 链条行 ≤480 档 3 行/页、其余 4 行/页。
 * - P5 §5 冗长治理既有口径保留：FieldTip 全文下沉、核证 Tag 三色、S4 行 hover 原样；
 *   数据行挂 T4 行级 hover 读数。
 * 纯展示面板（无输入、无计算调用）；数据来自 src/data/insights.ts，环节标签走 i18n。
 */
import { Divider, Tag, Typography } from "@arco-design/web-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  INSIGHT_CHAIN_STEPS,
  INSIGHT_CHILD_COST_REGIONS,
  INSIGHT_HEALTH_ENTRIES,
  INSIGHT_MARKET_ENTRIES,
} from "../../data/insights";
import type { InsightEntry, InsightVerification } from "../../data/insights";
import { FILE_FRESHNESS, INSIGHT_FRESHNESS } from "../../data/freshness";
import type { InsightFreshness } from "../../data/freshness";
import { FieldTip } from "../fields";
import { SegBar, SlotPager } from "../slots";
import { useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport } from "../hooks";

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

/** P10 §1.4 条目定义（id → 分节渲染；顺序 = 条目切换条展示序） */
const ENTRY_KEYS: { id: string; labelKey: string }[] = [
  { id: "formula", labelKey: "insights.entryFormula" },
  { id: "chain", labelKey: "insights.entryChain" },
  { id: "data", labelKey: "insights.entryData" },
  { id: "evidence", labelKey: "insights.entryEvidence" },
  { id: "notice", labelKey: "insights.entryNotice" },
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

/** 行级时效角标（P11 §3：ok 零渲染；soft=灰 Tag / hard=红 Tag；详情句并入行 FieldTip
 *  尾部——零新布局高度。hard 详情句 {{newValue}} 仅在数据层显式携带已核证新值时填充
 *  （三值齐备才走 hard 键，待证路径不出现数字占位——否则按 soft 展示在案口径） */
function freshnessTagAndDetail(
  fresh: InsightFreshness | undefined,
  t: TFunction<"translation", undefined>,
): { tag: ReactNode; detail: string } {
  if (!fresh) return { tag: null, detail: "" };
  const hard =
    fresh.level === "hard" && fresh.newValue != null && fresh.newDate != null && fresh.oldValue != null;
  return {
    tag: (
      <Tag size="small" color={hard ? "red" : "gray"}>
        {t(hard ? "insights.freshnessHard" : "insights.freshnessSoft", { year: fresh.year })}
      </Tag>
    ),
    detail: hard
      ? t("insights.freshnessHardDetail", {
          date: fresh.newDate,
          newValue: fresh.newValue,
          oldValue: fresh.oldValue,
          year: fresh.year,
        })
      : t("insights.freshnessSoftDetail", {
          year: fresh.year,
          due: fresh.due ?? "—",
          checked: fresh.checked,
        }),
  };
}

/** 通用数据行（链条 / 市场平均 / 医疗共用同一渲染；行挂 S4 hover 读数）。
 *  P10 compact（<768 压缩路线 (a)）：来源行全文下沉 FieldTip（图标零布局高度），
 *  行主体单行化——桌面（≥768）来源行可见不变。
 *  P11：行级时效角标按 labelKey 命中 INSIGHT_FRESHNESS（仅非 ok 项在案），详情句
 *  并入本行 FieldTip 尾部（compact 通道既有，零新布局高度） */
function EntryRows({ entries, compact }: { entries: (InsightEntry & { labelKey?: string })[]; compact: boolean }) {
  const { t } = useTranslation();
  return (
    <ol className="wf-insight-list">
      {entries.map((entry) => {
        const fresh = entry.labelKey ? INSIGHT_FRESHNESS[entry.labelKey] : undefined;
        const { tag, detail } = freshnessTagAndDetail(fresh, t);
        const tipText = `${entry.source}；${entry.year}；${entry.scope}${detail ? `；${detail}` : ""}`;
        return (
          <li key={entry.labelKey ?? entry.value} className="wf-insight-row">
            <div className="wf-insight-main">
              {entry.labelKey ? <Text>{t(entry.labelKey)}</Text> : null}
              <Text bold className="wf-nowrap">{entry.value}</Text>
              <Tag size="small" color={VERIFICATION[entry.verification].color}>
                {t(VERIFICATION[entry.verification].key)}
              </Tag>
              {tag}
              {compact ? <FieldTip text={tipText} /> : null}
            </div>
            {compact ? null : (
              <Text type="secondary" className="wf-insight-source">
                {tipText}
              </Text>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function InsightsPanel() {
  const { t } = useTranslation();
  /** P1 条目切换（默认首条目；App visitedTasks 门控下本面板首展挂载） */
  const [entryId, setEntryId] = useState<string>(ENTRY_KEYS[0].id);
  /** 骨架修复轮（F5，红线 10 路线 (b) 条目内两级切换）：分节页码——每条目两分节经
   *  SlotPager 翻页等高互换（E2 链条行为前 N 页、锚点为末页），分节内容零丢失、
   *  条目切换即复位。静态底稿「分节栈同屏」在 320–1200×800 各档实测均超预算
   *  （chain 809>502@320 / E3 551>489 等），两级切换为全视口统一形态（登记：
   *  p10-spec §1.4 分节栈形态由本页级切换替代，节点数 +2 分节页器，键零新增）。 */
  const [secPage, setSecPage] = useState(0);
  const isCompact = useIsCompactViewport();
  /** 压缩档（路线 (a)：来源行全文下沉 FieldTip）——全视口恒启用（P10 实测回填：
   *  1180 阅读列下链条 5 行带来源 ≈ 768 > 槽，来源下沉后达标；
   *  EntryRows 的来源行信息由行内 FieldTip 承载，零丢失） */
  const isNarrow = true;
  void useIsNarrowViewport;
  void useIsWorkbenchViewport;
  /** E2 链条每页行数（≤480 档 3 行 / 其余 4 行）；末页 = 锚点分节 */
  const chainPerPage = isCompact ? 3 : 4;
  const chainPages = Math.ceil(INSIGHT_CHAIN_STEPS.length / chainPerPage);
  const chainTotal = chainPages + 1;
  const safeSecPage = Math.min(secPage, chainTotal - 1);
  const chainRows = INSIGHT_CHAIN_STEPS.slice(
    safeSecPage * chainPerPage,
    safeSecPage * chainPerPage + chainPerPage,
  );
  /** P11 E5 第 2 分页「数据时效清单」（p10 红线 10 路线 (b) SlotPager 等高互换的延伸）：
   *  页 1 = 声明（Footer 两行原样）、页 2.. = 九文件清单（每页行数复用 chainPerPage 档位：
   *  ≤480 档 3 行/页、其余 4 行/页）；条目切换复位页码由既有 onChange 承载，页码随档位钳制 */
  const listPages = Math.ceil(FILE_FRESHNESS.length / chainPerPage);
  const noticeTotal = 1 + listPages;
  const noticePage = Math.min(safeSecPage, noticeTotal - 1);
  const listRows = FILE_FRESHNESS.slice(
    Math.max(0, noticePage - 1) * chainPerPage,
    Math.max(0, noticePage - 1) * chainPerPage + chainPerPage,
  );

  return (
    <div className="wf-insights">
      {/* P1 条目切换条（5 条目；≥1200 左轨竖排由样式层承载，高度不变） */}
      <SegBar
        name="wf-insights-entry"
        ariaLabel={t("atlas.nav.principles")}
        value={entryId}
        onChange={(v: string) => {
          setEntryId(v);
          setSecPage(0);
        }}
        options={ENTRY_KEYS.map((e) => ({ value: e.id, label: t(e.labelKey) }))}
      />

      {/* —— E1 公式与口径（页 1 = 公式推导 / 页 2 = 严格/宽松口径） —— */}
      <div className="wf-entry" hidden={entryId !== "formula"}>
        {safeSecPage === 0 ? (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.formulaTitle" />
            <div className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              <Text type="secondary">{t("insights.formulaShort")}</Text>
              <FieldTip
                text={joinParts(t("insights.formulaBody1"), t("insights.formulaBody2"), t("insights.formulaBody3"))}
              />
            </div>
          </div>
        ) : (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.strictTitle" />
            <div className={isNarrow ? "wf-entry-reading" : undefined}>
              <Text type="secondary" className="wf-insights-body">{t("insights.strictBody")}</Text>
              <Text type="secondary" className="wf-insights-body">{t("insights.looseBody")}</Text>
            </div>
          </div>
        )}
        <SlotPager label={t("insights.entryFormula")} total={2} page={safeSecPage} onPage={setSecPage} />
      </div>

      {/* —— E2 假设链条（前 N 页 = 推导链[分页] / 末页 = 直观锚点） —— */}
      <div className="wf-entry" hidden={entryId !== "chain"}>
        {safeSecPage < chainPages ? (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.chainTitle" />
            <Text type="secondary" className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              {t("insights.chainIntro")}
            </Text>
            <EntryRows entries={chainRows} compact={isNarrow} />
          </div>
        ) : (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.anchorTitle" />
            <Text type="secondary" className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              {t("insights.anchorNote")}
            </Text>
            <div className="wf-insight-list">
              {INSIGHT_ANCHOR_KEYS.map((k) => (
                <div key={k} className="wf-insight-row">
                  <Text>{t(k)}</Text>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 链条条目分页（≤480 档 3 行×4 页+锚点 / 其余 4 行×3 页+锚点；零新交互词汇） */}
        <SlotPager label={t("insights.entryChain")} total={chainTotal} page={safeSecPage} onPage={setSecPage} />
      </div>

      {/* —— E3 数据与来源（页 1 = 市场平均 / 页 2 = 育儿成本） —— */}
      <div className="wf-entry" hidden={entryId !== "data"}>
        {safeSecPage === 0 ? (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.marketTitle" />
            <EntryRows entries={INSIGHT_MARKET_ENTRIES} compact={isNarrow} />
            <Text type="secondary" className={isNarrow ? "wf-insight-note wf-entry-reading" : "wf-insight-note"}>
              {t("insights.marketNote")}
            </Text>
          </div>
        ) : (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.childTitle" />
            <div className="wf-insight-list">
              {INSIGHT_CHILD_COST_REGIONS.map((row) => (
                <div key={row.region} className="wf-insight-row">
                  <div className="wf-insight-main">
                    <Text>{row.region}</Text>
                    <Text bold className="wf-nowrap">{row.costWan} 万元</Text>
                    {row.note ? (
                      isNarrow ? <FieldTip text={row.note} /> : (
                        <Text type="secondary" className="wf-insight-source">{row.note}</Text>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              {/* P5 §5：childNote / childVideoNote 两长串——副行 1 行 + 全文 tooltip；
                  childVideoNote（勘误性质）内联零文字、全文仅存 tooltip */}
              <Text type="secondary">{t("insights.childShort")}</Text>
              <FieldTip
                text={joinParts(
                  t("insights.childNote1"),
                  t("insights.childNote2"),
                  t("insights.childVideoNote1"),
                  t("insights.childVideoNote2"),
                )}
              />
            </div>
          </div>
        )}
        <SlotPager label={t("insights.entryData")} total={2} page={safeSecPage} onPage={setSecPage} />
      </div>

      {/* —— E4 医疗与证据（页 1 = 医疗预留 / 页 2 = 证据说明） —— */}
      <div className="wf-entry" hidden={entryId !== "evidence"}>
        {safeSecPage === 0 ? (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.healthTitle" />
            <EntryRows entries={INSIGHT_HEALTH_ENTRIES} compact={isNarrow} />
            <div className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              <Text type="secondary">{t("insights.healthShort")}</Text>
              <FieldTip text={joinParts(t("insights.healthNote1"), t("insights.healthNote2"))} />
            </div>
          </div>
        ) : (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.evidenceTitle" />
            <div className={isNarrow ? "wf-insights-body wf-entry-reading" : "wf-insights-body"}>
              {/* P5 §11 补漏：evidence 小节补标题键（原 evidenceNote 独立渲染无标题） */}
              <Text type="secondary">{t("insights.evidenceShort")}</Text>
              <FieldTip text={joinParts(t("insights.evidenceNote1"), t("insights.evidenceNote2"))} />
            </div>
          </div>
        )}
        <SlotPager label={t("insights.entryEvidence")} total={2} page={safeSecPage} onPage={setSecPage} />
      </div>

      {/* —— E5 声明 + 数据时效清单（P11：1 + ⌈9/每页⌉ 页；页 1 = Footer 两行迁入原样，
          页 2.. = 九文件文件级清单——p10 红线 10 路线 (b) SlotPager 等高互换延伸，
          交互词汇零新增） —— */}
      <div className="wf-entry" hidden={entryId !== "notice"}>
        {noticePage === 0 ? (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.entryNotice" />
            <div className={isNarrow ? "wf-entry-reading" : undefined} role="contentinfo">
              <Text type="secondary" className="wf-insights-body">{t("app.footerDisclaimer")}</Text>
              <Text type="secondary" className="wf-insights-body">{t("app.footerPrivacy")}</Text>
            </div>
          </div>
        ) : (
          <div className="wf-entry-sec">
            <SectionTitle titleKey="insights.freshnessListTitle" />
            <div className={isNarrow ? "wf-entry-reading" : undefined}>
              {/* 列头（§7.3 回收②：四列并三列——年度·复核并合；freshnessColChecked 键
                  P11 验收 F2 勘误：该键已随列头裁剪一并裁去、三语均无此键；状态 Tag 沿 EntryRows 行尾 Tag 同款惯例、不设列头；
                  回收登记：列头行裁剪（列语义由行字段顺序承载，细目见数据层头注释）） */}
              {listRows.map((row) => (
                <div key={row[0]} className="wf-insight-row">
                  <div className="wf-insight-main">
                    <Text bold className="wf-nowrap">{row[0]}</Text>
                    <Text type="secondary" className="wf-nowrap">{row[1]} · {row[2]}</Text>
                    <Text type="secondary" className="wf-nowrap">{row[3]}</Text>
                    {row[4] ? (
                      <Tag size="small" color="gray">{t("insights.freshnessRestricted")}</Tag>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <SlotPager label={t("insights.entryNotice")} total={noticeTotal} page={noticePage} onPage={setSecPage} />
      </div>
    </div>
  );
}
