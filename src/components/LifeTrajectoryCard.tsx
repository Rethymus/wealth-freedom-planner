/**
 * 人生轨迹读数卡（docs/p8-spec.md §4；P8 最小面）。
 * 纯读数卡（D9 同构：无参数输入控件，P5.1 V1「输出卡纯读数」口径延伸；WF-04 T1
 * 时间透镜为时间维度的只读检视控件——零 store 写入、零参数修改，仅选择读数行，
 * 「无参数输入控件」语义不破，「无控件」字面经 wf04-spec §4 条 10 口径精确化）；
 * 一次 calcLifecycle 调用覆盖全周期（验收 ⑦①「同资料单次」），输入全部来自既有
 * store 切片（零新切片、零新必填用户输入）；monthsDivisor 经 effectiveMonthsDivisor
 * 联动口径入链（store buildShareState 同源函数，禁两处内联重推——p8-spec §4.2）。
 * 宪法约束（§5 红线）：零新动效、零新视觉令牌、零新签名元素（design-language §5.1
 * 本轮零申请）；数值行沿用 S3 等宽字排（global.css tabular-nums 既有规则）；
 * 金额全部经 useMoney().money() 币种换算（先例 PensionPanel.tsx:35-36）；
 * 时间透镜（WF-04 T1）经同一 timeline 数组引用嵌入——零新增调用点。
 */
import { Alert, Descriptions, Spin, Tag, Tooltip, Typography } from "@arco-design/web-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { calcLifecycle } from "../services/finance";
import { formatNumber } from "../services/format";
import { effectiveMonthsDivisor } from "../data/pensionParams";
import { useCalculatorStore } from "../store/useCalculatorStore";
import LifeLensTrack from "./lens/LifeLensTrack";
import { SlotBox, SlotPager } from "./slots";
import { useFinanceCall, useIsNarrowViewport, useMoney } from "./hooks";

const { Text } = Typography;

export default function LifeTrajectoryCard() {
  const { t } = useTranslation();
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  const accumulation = useCalculatorStore((s) => s.accumulationInputs);
  const pension = useCalculatorStore((s) => s.pensionInputs);
  const monthsSynced = useCalculatorStore((s) => s.pensionMonthsSynced);
  const loan = useCalculatorStore((s) => s.loanInputs);
  const rental = useCalculatorStore((s) => s.rentalInputs);
  /** P9 事件切片：编辑器写 store 即经本 deps 项触发重算（hook 调用数不变、无新 calc* 调用） */
  const lifeEvents = useCalculatorStore((s) => s.lifeEvents);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** 金额展示绑定：读数卡 7 读数中全部金额经展示币种换算（§4.1 形态约束） */
  const { money } = useMoney(displayCode);
  /** 窄视口 / workbench 下 Descriptions 布局与既有面板同构（PensionPanel 同参数） */
  const isNarrow = useIsNarrowViewport();
  /** 计发月数联动：与 PensionPanel / 分享链接同一口径函数（禁两处内联重推） */
  const effectiveMonths = effectiveMonthsDivisor(pension.monthsDivisor, pension.retireAge, monthsSynced);

  /** P8 唯一新增调用点（§4.4：hook 调用 8 → 9 处；防抖口径与既有面板一致 300 ms；
   *  P9：deps 六 → 七项 + lifeEvents，calcLifecycle 入参携事件切片——opts 不传（缺省
   *  = 现状口径逐位一致，p9-spec §2.2-1） */
  const { loading, result } = useFinanceCall(
    () =>
      calcLifecycle({
        base: baseline,
        accum: accumulation,
        pension: { ...pension, monthsDivisor: effectiveMonths },
        loan,
        rental,
        lifeEvents,
      }),
    [baseline, accumulation, pension, monthsSynced, loan, rental, lifeEvents],
    { debounceMs: 300 },
  );

  const data = result?.ok === true ? result.data : null;
  const serviceError = result && !result.ok ? result.error : null;
  const summary = data?.summary ?? null;
  const lastRow = data && data.timeline.length > 0 ? data.timeline[data.timeline.length - 1] : null;
  const startRow = data?.timeline.find((row) => row.pensionStart) ?? null;
  /** F1/F9 修复轮：L5 槽内两页（透镜 ⇄ 事件轴+续读两列+口径注）——槽改 flex 填充后
   *  内容高于槽的静默裁切（②′）由分页消化；页码等高互换（SlotPager 既有原语） */
  const [lensPage, setLensPage] = useState(0);
  /** L3 读数区窄档分页（骨架修复轮：320 档 5 行纵排实测 331px > 页预算——2 行/页 × 3 页；
   *  ≥768 横排单页不变。读数零丢失，翻页可达） */
  const [readPage, setReadPage] = useState(0);
  /** P9 购买力指标（§3.2）：哨兵 −1（域空未度量）与缺口行统一呈现 ppNotMeasured——
   *  域空缺口 0 以「未度量」承载，不以 ¥0.00 冒充无缺口 */
  const pp = summary?.purchasingPower ?? null;
  /** P9 事件轴汇总：遍历 timeline[].events 生成逐事件文案（kind ＋ year；金额不进 aria
   *  汇总行——逐年面板 withdrawal 读数已承载，避免 aria 冗长）。事件 ≤ 20 条且育儿区间
   *  ≤ 18 行 ⇒ 标记总数有界（20×18+20 上界 ~380 条，pathological 上界已封顶） */
  const eventMarks = data
    ? data.timeline.flatMap((row) =>
        row.events.map((ev) =>
          ev.kind === "homePurchase"
            ? t("life.eventMarkHome", { year: ev.year })
            : ev.kind === "childBirth"
              ? t("life.eventMarkChild", { year: ev.year })
              : t("life.eventMarkHealth", { year: ev.year }),
        ),
      )
    : [];
  const eventKinds = data
    ? new Set(data.timeline.flatMap((row) => row.events.map((ev) => ev.kind)))
    : new Set<string>();
  /** FI 首达行（fiFirstYear ≥ 1 时取对应行年龄；0 = 期初已达标、−1 = 未达成无对应行） */
  const fiRow = data && summary && summary.fiFirstYear >= 1 ? data.timeline[summary.fiFirstYear - 1] : null;
  const fiValue =
    summary === null
      ? "—"
      : summary.fiFirstYear < 0
        ? t("life.fiNotReached")
        : summary.fiFirstYear === 0
          ? t("life.fiAtStart")
          : `${formatNumber(summary.fiFirstYear, 0)} ${t("units.yearUnit")} · ${fiRow ? fiRow.age : "—"}`;
  const probabilityText = (p: number) => `${formatNumber(p * 100, 1)}%`;
  /** L3 读数 5 行（骨架修复轮：<768 抽 2 行/页 × 3 页；≥768 全量单页） */
  const readRows = summary
    ? (() => {
        const all = [
          {
            label: t("life.fiFirstYear"),
            value: <span className="wf-nowrap">{fiValue}</span>,
          },
          {
            label: t("life.bridgeYears"),
            value: <span className="wf-nowrap">{`${formatNumber(summary.bridgeYears, 0)} ${t("units.yearUnit")}`}</span>,
          },
          {
            label: t("life.bridgeFunding"),
            value: <span className="wf-nowrap">{money(summary.bridgeFundingNeeded)}</span>,
          },
          {
            label: t("life.pensionMonthly"),
            value: (
              <div>
                <Text bold className="wf-nowrap">
                  {money(summary.pensionMonthly)}
                </Text>
                {startRow ? (
                  <div>
                    <Text type="secondary" className="wf-nowrap">
                      {t("life.pensionStartAt", { year: startRow.year, age: startRow.age })}
                    </Text>
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            label: t("life.finalAssets"),
            value: (
              <div>
                <Text bold className="wf-nowrap">
                  {lastRow ? money(lastRow.closingAssets) : "—"}
                </Text>
                <div>
                  <Text type="secondary" className="wf-nowrap">
                    {summary.depletedYear >= 1
                      ? t("life.depletedAt", { year: summary.depletedYear })
                      : t("life.survived")}
                  </Text>
                </div>
              </div>
            ),
          },
        ];
        return isNarrow ? all.slice(Math.min(readPage, 2) * 2, Math.min(readPage, 2) * 2 + 2) : all;
      })()
    : [];

  return (
    <div>
      {/* V-F1（P8.1）：卡头重复口径注已删——caliberNote 唯一承载为槽内 12px caption
          触发器（tooltip 挂全文 caliberTooltip），宪法 §3.1 口径注档位 + §1.3 反冗长 */}

      {/* 运行区：无按钮；防抖计算中在结果区头部显示小型旋转器（PensionPanel 同款） */}
      {loading ? <Spin size={14} /> : null}

      {serviceError ? <Alert type="error" style={{ marginTop: 4 }} content={serviceError} /> : null}

      {/* P10 §1.2 L3 读数区：Descriptions 前 5 行（fi 首达 / 桥接两行 / 养老金 / 期末资产）
          ——购买力与存续续读行随槽内两列网格承载（信息路径零丢失，行项登记）。
          骨架修复轮：<768 纵排 2 行/页 × 3 页（320 档 5 行 331px 超页预算的收口） */}
      {summary ? (
        <>
          <Descriptions
            border
            size="small"
            style={{ marginTop: 4, opacity: loading ? 0.45 : 1 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={1}
            tableLayout={isNarrow ? "auto" : "fixed"}
            data={readRows}
          />
          {isNarrow ? (
            <SlotPager label={t("life.trajectoryTitle")} total={3} page={Math.min(readPage, 2)} onPage={setReadPage} />
          ) : null}
        </>
      ) : null}

      {/* P10 §1.2 L5 槽（下限 200；flex 填充页内剩余空间）：透镜全件（轨 + 刻度 +
          读数面板，交互态共享 sel）+ 续读两列（购买力两行 / 存续双指标）+ 事件标记轴 +
          口径注。骨架修复轮：槽内两页等高互换（页 1 = 透镜 + 事件轴；页 2 = 续读两列 +
          口径注）——内容高于槽的静默裁切由分页消化（②′收口）；落定后选中 t 钳制不重置
          （LifeLensTrack 内钳制）；未就绪整块不渲染不占位 */}
      {summary && data && data.timeline.length > 0 ? (
        <SlotBox height={200}>
          {lensPage === 0 ? (
            <div style={{ opacity: loading ? 0.45 : 1 }}>
              <LifeLensTrack
                timeline={data.timeline}
                fiFirstYear={summary.fiFirstYear}
                depletedYear={summary.depletedYear}
                money={money}
              />
            </div>
          ) : null}
          {lensPage === 1 && summary ? (
            <div className="wf-lens-extra-grid">
              <div className="wf-lens-extra-cell">
                <div className="wf-lens-cap">
                  {/* P9 购买力达标率行（插值支取年数；metShare = −1 域空显「未度量」） */}
                  {t("life.ppMetLabel", { count: summary.purchasingPower.withdrawalYears })}
                </div>
                <Text bold className="wf-nowrap">
                  {summary.purchasingPower.metShare >= 0
                    ? probabilityText(summary.purchasingPower.metShare)
                    : t("life.ppNotMeasured")}
                </Text>
              </div>
              <div className="wf-lens-extra-cell">
                <div className="wf-lens-cap">{t("life.ppGapLabel")}</div>
                <Text bold className="wf-nowrap">
                  {pp !== null && pp.withdrawalYears > 0 ? money(pp.cumulativeGap) : t("life.ppNotMeasured")}
                </Text>
              </div>
              <div className="wf-lens-extra-cell">
                <div className="wf-lens-cap">
                  {/* 存续双指标（引用口径）：标签复用既有 accumulation 键值作 {{label}} */}
                  {t("life.sameSeedRef", { label: t("accumulation.fiLabel") })}
                </div>
                <Text bold className="wf-nowrap">{probabilityText(summary.survival.fiProbability)}</Text>
              </div>
              {summary.survival.sustainYears > 0 ? (
                <div className="wf-lens-extra-cell">
                  <div className="wf-lens-cap">
                    {t("life.sameSeedRef", { label: t("accumulation.sustainedLabel") })}
                  </div>
                  <Text bold className="wf-nowrap">{probabilityText(summary.survival.sustainedProbability)}</Text>
                </div>
              ) : null}
            </div>
          ) : null}
          {/* 读数 7：事件标记轴（P9 起 events[] 非空；骨架修复轮随续读移槽内页 2——
              320 档透镜页超槽收口）。非视觉替代文本：容器 role="img" +
              aria-label 汇总标记（§5 红线 3）；P9 事件轴 aria 汇总行（金额不进 aria） */}
          {lensPage === 1 && startRow ? (
            <div
              style={{ marginTop: 4 }}
              role="img"
              aria-label={`${t("life.timelineLabel")}：${t("life.pensionStartAt", { year: startRow.year, age: startRow.age })}${eventMarks.length > 0 ? `；${t("life.eventsAxisLabel")}：${eventMarks.join("；")}` : ""}`}
            >
              <Tag>{t("life.pensionStartMark")}</Tag>
              <Text type="secondary" className="wf-nowrap" style={{ marginLeft: 8 }}>
                {t("life.pensionStartAt", { year: startRow.year, age: startRow.age })}
              </Text>
              {eventKinds.has("homePurchase") ? <Tag style={{ marginLeft: 4 }}>{t("life.eventKindHome")}</Tag> : null}
              {eventKinds.has("childBirth") ? <Tag style={{ marginLeft: 4 }}>{t("life.eventKindChild")}</Tag> : null}
              {eventKinds.has("healthPhase") ? <Tag style={{ marginLeft: 4 }}>{t("life.eventKindHealth")}</Tag> : null}
            </div>
          ) : null}
          {/* 口径注全文 tooltip（§4.3）：caliberNote 唯一可见承载（P8.1 V-F1；槽内页 2） */}
          {lensPage === 1 ? (
            <Tooltip content={<div style={{ maxWidth: 420 }}>{t("life.caliberTooltip")}</div>}>
              <Text type="secondary" className="wf-panel-note" style={{ display: "inline-block", marginTop: 4 }}>
                {t("life.caliberNote")}
              </Text>
            </Tooltip>
          ) : null}
          <SlotPager label={t("life.trajectoryTitle")} total={2} page={lensPage} onPage={setLensPage} />
        </SlotBox>
      ) : null}
    </div>
  );
}
