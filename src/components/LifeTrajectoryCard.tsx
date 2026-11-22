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
import { useTranslation } from "react-i18next";
import { calcLifecycle } from "../services/finance";
import { formatNumber } from "../services/format";
import { effectiveMonthsDivisor } from "../data/pensionParams";
import { useCalculatorStore } from "../store/useCalculatorStore";
import LifeLensTrack from "./lens/LifeLensTrack";
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
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** 金额展示绑定：读数卡 7 读数中全部金额经展示币种换算（§4.1 形态约束） */
  const { money } = useMoney(displayCode);
  /** 窄视口 / workbench 下 Descriptions 布局与既有面板同构（PensionPanel 同参数） */
  const isNarrow = useIsNarrowViewport();
  /** 计发月数联动：与 PensionPanel / 分享链接同一口径函数（禁两处内联重推） */
  const effectiveMonths = effectiveMonthsDivisor(pension.monthsDivisor, pension.retireAge, monthsSynced);

  /** P8 唯一新增调用点（§4.4：hook 调用 8 → 9 处；防抖口径与既有面板一致 300 ms） */
  const { loading, result } = useFinanceCall(
    () =>
      calcLifecycle({
        base: baseline,
        accum: accumulation,
        pension: { ...pension, monthsDivisor: effectiveMonths },
        loan,
        rental,
      }),
    [baseline, accumulation, pension, monthsSynced, loan, rental],
    { debounceMs: 300 },
  );

  const data = result?.ok === true ? result.data : null;
  const serviceError = result && !result.ok ? result.error : null;
  const summary = data?.summary ?? null;
  const lastRow = data && data.timeline.length > 0 ? data.timeline[data.timeline.length - 1] : null;
  const startRow = data?.timeline.find((row) => row.pensionStart) ?? null;
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

  return (
    <div>
      {/* V-F1（P8.1）：卡头重复口径注已删——caliberNote 唯一承载为卡尾 12px caption
          触发器（tooltip 挂全文 caliberTooltip），宪法 §3.1 口径注档位 + §1.3 反冗长 */}

      {/* 运行区：无按钮；防抖计算中在结果区头部显示小型旋转器（PensionPanel 同款） */}
      {loading ? <Spin size={14} /> : null}

      {serviceError ? <Alert type="error" style={{ marginTop: 8 }} content={serviceError} /> : null}

      {summary ? (
        <Descriptions
          border
          size="small"
          style={{ marginTop: 8, opacity: loading ? 0.45 : 1 }}
          layout={isNarrow ? "vertical" : "horizontal"}
          column={1}
          tableLayout={isNarrow ? "auto" : "fixed"}
          data={[
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
            {
              // 存续双指标（引用口径）：标签复用既有 accumulation 键值作 {{label}}；
              // 仅 sustainYears > 0 展示存续项（bridge.ts:515-519 哨兵，Rust 无 −1 特判）
              label: t("life.sameSeedRef", { label: t("accumulation.fiLabel") }),
              value: <span className="wf-nowrap">{probabilityText(summary.survival.fiProbability)}</span>,
            },
            ...(summary.survival.sustainYears > 0
              ? [
                  {
                    label: t("life.sameSeedRef", { label: t("accumulation.sustainedLabel") }),
                    value: <span className="wf-nowrap">{probabilityText(summary.survival.sustainedProbability)}</span>,
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {/* WF-04 T1 时间透镜（docs/wf04-spec.md §1-T1；落位次序 research-wf04-lens §2.1：
          Descriptions → 刻度轨区 → 读数面板 → 既有标记轴 aria 行）。props 传同一
          timeline 内存数组引用（零新增调用零 wasm，§3 红线 1）；防抖窗口旧数据在则轨
          照常可拖，容器随 Descriptions 同步 opacity 0.45（:84 同源）；落定后选中 t
          钳制不重置（LifeLensTrack 内钳制）；未就绪/服务错误/timeline 空整块不渲染不占位 */}
      {summary && data && data.timeline.length > 0 ? (
        <div style={{ marginTop: 8, opacity: loading ? 0.45 : 1 }}>
          <LifeLensTrack
            timeline={data.timeline}
            fiFirstYear={summary.fiFirstYear}
            depletedYear={summary.depletedYear}
            money={money}
          />
        </div>
      ) : null}

      {/* 读数 7：事件标记轴（本轮唯一施工标记 = pensionStart；events[] 恒空——WF-04）。
          非视觉替代文本：容器 role="img" + aria-label 汇总标记（§5 红线 3） */}
      {startRow ? (
        <div
          style={{ marginTop: 8 }}
          role="img"
          aria-label={`${t("life.timelineLabel")}：${t("life.pensionStartAt", { year: startRow.year, age: startRow.age })}`}
        >
          <Tag>{t("life.pensionStartMark")}</Tag>
          <Text type="secondary" className="wf-nowrap" style={{ marginLeft: 8 }}>
            {t("life.pensionStartAt", { year: startRow.year, age: startRow.age })}
          </Text>
        </div>
      ) : null}

      {/* 口径注全文 tooltip（§4.3）：双参数族拆分 + 桥接纯生活费 / r = i 边界 +
          乘数族/行族分水岭 + 存续口径（资产 ≤ 0）——caliberNote 唯一承载在此（P8.1 V-F1） */}
      <Tooltip content={<div style={{ maxWidth: 420 }}>{t("life.caliberTooltip")}</div>}>
        <Text type="secondary" className="wf-panel-note" style={{ display: "inline-block", marginTop: 8 }}>
          {t("life.caliberNote")}
        </Text>
      </Tooltip>
    </div>
  );
}
