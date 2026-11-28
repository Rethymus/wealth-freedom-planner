/**
 * ⑦ 社保养老金：简化两层公式（基础养老金 + 个人账户）估算退休后月养老金，
 * 并给出「调整后参考线」——月开销中被养老金覆盖的部分不再需要本金支撑。
 * 口径（契约 estimate_pension，见 src/wasm/bridge.ts）：输入复用基础参数卡当前值
 * 组合调用；社平工资与缴费指数不做增长假设；账户余额不做未来增值假设。
 * 简化估算，不构成社保咨询（面板内固定免责文案）。
 * 文案经 react-i18next 三语化。
 */
import { Alert, Button, Descriptions, Spin, Typography } from "@arco-design/web-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { calcPension } from "../../services/finance";
import { formatNumber } from "../../services/format";
import { LIMITS, resolveThemeTokens } from "../../data/defaults";
import { effectiveMonthsDivisor, PENSION_WAGE_SOURCE_NOTE } from "../../data/pensionParams";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, FieldTip, IntField, NumberField } from "../fields";
import { SegBar, SlotBox, SlotPager } from "../slots";
import { useAnimatedNumber, useFinanceCall, useIsCompactViewport, useIsNarrowViewport, useIsWorkbenchViewport, useMoney, useShortViewport } from "../hooks";

const { Text } = Typography;

export default function PensionPanel() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const pensionInputs = useCalculatorStore((s) => s.pensionInputs);
  const setPensionInputs = useCalculatorStore((s) => s.setPensionInputs);
  const monthsSynced = useCalculatorStore((s) => s.pensionMonthsSynced);
  const setPensionMonthsSynced = useCalculatorStore((s) => s.setPensionMonthsSynced);
  const baseline = useCalculatorStore((s) => s.baselineInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  const colorBlindFriendly = useCalculatorStore((s) => s.colorBlindFriendly);
  const theme = useCalculatorStore((s) => s.theme);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：两层养老金与调整后参考线经展示币种换算；rate null = 符号-only */
  const { symbol, money, display } = useMoney(displayCode);
  const rate = display.rate;
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下） */
  const isNarrow = useIsNarrowViewport();
  /** V-V3（P7.1 视觉验收）：双栏右栏容器 ~618px 装不下 md:2 表宽（实测 757px 裁切、
   *  个人账户养老金与覆盖率两格不可见）——workbench 形态三张结果表切单列 + fixed
   *  布局（P5 BreakdownTable 同款先例），窄视口维持纵向堆叠既有口径 */
  const isWorkbench = useIsWorkbenchViewport();
  /** 覆盖率满额行的涨色：经主题解析函数取解析值（不感知主题，见设计规范第 8 节口径） */
  const themeTokens = resolveThemeTokens(theme, colorBlindFriendly);

  /**
   * 计发月数联动：联动中按退休年龄查数据层对照表；对照表未收录的退休年龄回落用户手填值。
   * 同步按钮点击序号作为计发月数字段的 key（epoch 重挂载方案，模式同 AccumulationPanel
   * 的目标值联动）：Arco InputNumber 键入后不再跟随外部受控值重绘输入框，恢复联动时
   * 须重挂载重置其内部态才能回填表值。
   */
  const [monthsSyncEpoch, setMonthsSyncEpoch] = useState(0);
  const effectiveMonths = effectiveMonthsDivisor(
    pensionInputs.monthsDivisor,
    pensionInputs.retireAge,
    monthsSynced,
  );

  /** 组合调用：调整后参考线跟随基础参数卡当前值（单一事实来源）；计发月数必须传当刻
   * 联动值 effectiveMonths（不得直传 store 旧值，否则「恢复联动」后展示表值、计算仍按
   * 旧值，出现展示与计算口径漂移——先例即 AccumulationPanel 运行时取当刻联动目标值提交） */
  const { loading, result } = useFinanceCall(
    () => calcPension({ ...baseline, ...pensionInputs, monthsDivisor: effectiveMonths }),
    [baseline, pensionInputs, effectiveMonths],
    { debounceMs: 300 },
  );

  const data = result?.ok === true ? result.data : null;
  const serviceError = result && !result.ok ? result.error : null;
  /** S18 面板主数渐近滚动（p6-spec §2）：rAF 中间帧只进显示值、永不进 store（§6 红线 2） */
  const animatedPensionMonthly = useAnimatedNumber(data?.pensionMonthly ?? 0, undefined, hostRef);
  /** P10 槽契约（§1.2 L4/L5；life 与 pro 两宿主共用）：结果 ⇄ 参数两态等高互换，
   *  超行走槽内分页（§9 对比表槽分页先例同款） */
  const [slot, setSlot] = useState<"out" | "params">("out");
  const [outPage, setOutPage] = useState(0);
  const [paramPage, setParamPage] = useState(0);
  /** 第 2 轮验收 F-03：窄宽/矮高档（≤480 紧档 ∨ H<850 深矮档）结果表横向布局的标签/值
   *  争宽致行高 57–109px，375×812 主表页 dy=119、调整表页 dy=153。该档改纵排
   *  （layout vertical：label 上、value 下，整行宽承载）+ 结果分页加深（主表 5 行拆
   *  2+2+1，调整/桥接/覆盖文本各自成页）——页数随档收敛、页码钳制。桌面三页不变。 */
  const stackedTier = useIsCompactViewport() || useShortViewport();

  const resultOpacity = { opacity: loading ? 0.45 : 1 } as const;
  /** P10 §8 尺寸回收：三张结果表共用同一形态入参（展开注入；防抖降透明随表） */
  const tbl = {
    border: true,
    size: "small",
    style: resultOpacity,
    layout: (stackedTier ? "vertical" : "horizontal") as "vertical" | "horizontal",
    column: (isWorkbench || isNarrow ? 1 : { xs: 1, md: 2 }) as 1 | { xs: number; md: number },
    tableLayout: (isWorkbench ? "fixed" : "auto") as "fixed" | "auto",
  } as const;
  /** 第 2 轮验收 F-03：结果行数据化（三表行元素单源），供分档分页切片。
   *  行类型按 arco DescriptionsItem 渲染口径（label/value 均为 ReactNode）。 */
  const mainData: Array<{ label: React.ReactNode; value: React.ReactNode }> = data
    ? [
        {
          label: t("pension.monthlyPension"),
          value: (
            <Text bold className="wf-nowrap">
              {money(animatedPensionMonthly)}
            </Text>
          ),
        },
        { label: t("pension.basicPart"), value: <span className="wf-nowrap">{money(data.basicPensionMonthly)}</span> },
        { label: t("pension.accountPart"), value: <span className="wf-nowrap">{money(data.accountPensionMonthly)}</span> },
        { label: t("pension.yearsToRetire"), value: `${data.yearsToRetire} ${t("units.yearUnit")}` },
        { label: t("pension.monthsUsed"), value: `${effectiveMonths} ${t("pension.monthsUnit")}` },
      ]
    : [];
  /** 页码钳制（ReverseCard safeEditPage 同款）：数据未就绪只 1 页（防分页落空页） */
  const outTotal = data ? (stackedTier ? 5 : 3) : 1;
  const safeOutPage = Math.min(outPage, outTotal - 1);


  return (
    <div ref={hostRef}>
      {/* 说明行：两层公式 + 简化口径（固定读数区，P10 L3 前置行） */}
      <Text type="secondary" className="wf-panel-head-note">
        {t("pension.formulaNote")}
      </Text>
      {loading ? <Spin size={14} /> : null}
      {serviceError ? <Alert type="error" style={{ marginTop: 4 }} content={serviceError} /> : null}

      {/* L4 槽切换条（复用 atlas.slotChart / atlas.slotParams，零新键） */}
      <SegBar
        name="wf-pension-slot"
        ariaLabel={t("advanced.pensionTitle")}
        value={slot}
        onChange={(v: string) => setSlot(v as "out" | "params")}
        options={[
          { value: "out", label: t("atlas.slotChart") },
          { value: "params", label: t("atlas.slotParams") },
        ]}
      />
      <SlotBox height={200}>
        {slot === "out" ? (
          <div className="wf-slot-body">
            {/* 防抖窗口内金额来自上一轮 wasm 结果；loading 期间整表降透明度（既有口径）。
                槽内分页（第 2 轮验收 F-03 分档）：桌面常规 3 页（主表 5 行 / 调整后 3 行 +
                覆盖率注 / 桥接 2 行 + 口径注）；窄宽/深矮档（stackedTier）结果表纵排 +
                加深为 5 页（主表 2+2+1 / 调整后整表 / 覆盖率与桥接），页码钳制。 */}
            {data && safeOutPage === 0 ? (
              <Descriptions {...tbl} data={stackedTier ? mainData.slice(0, 2) : mainData} />
            ) : null}
            {data && stackedTier && safeOutPage > 0 && safeOutPage < 3 ? (
              <Descriptions {...tbl} data={mainData.slice(safeOutPage * 2 - 1, safeOutPage * 2 + 1)} />
            ) : null}
            {data && safeOutPage === (stackedTier ? 3 : 1) ? (
              <>
                <Descriptions
                  {...tbl}
                  title={t("pension.adjustedTitle")}
                  data={[
                    { label: t("pension.adjustedExpense"), value: <span className="wf-nowrap">{money(data.adjustedMonthlyExpense)}</span> },
                    {
                      label: t("pension.adjustedCritical"),
                      value: (
                        <Text bold className="wf-nowrap">
                          {money(data.adjustedCriticalValue)}
                        </Text>
                      ),
                    },
                    {
                      // 覆盖率是倍率不是百分点：× 100 后按一位小数渲染（如 0.95 → 95%）
                      label: t("pension.coverage"),
                      value: <span className="wf-nowrap">{`${formatNumber(data.coverageRatio * 100, 1)}%`}</span>,
                    },
                  ]}
                />
                {data.coverageRatio >= 1 ? (
                  <Text bold style={{ color: themeTokens.rise }}>
                    {t("pension.coverageFull")}
                  </Text>
                ) : null}
                {/* P5 §5 冗长治理：coverageHint + resultNote 合并键，估算口径一句话内联。
                    紧档（stackedTier）口径注 sr-only——调整表 en 纵排页在 375×667 槽 247
                    边界（213+38 超 9px），注转 sr-only 后零布局高度（读屏可达） */}
                <Text type="secondary" className={stackedTier ? "wf-panel-note wf-sr-only" : "wf-panel-note"}>
                  {t("pension.coverageNote")}
                </Text>
              </>
            ) : null}
            {data && safeOutPage === (stackedTier ? 4 : 2) ? (
              <>
                {/* P7/P0-1 桥接块（§4.2）：bridgeYears > 0 才渲染（缺省 = 0 不占位） */}
                {data.bridgeYears > 0 ? (
                  <Descriptions
                    {...tbl}
                    title={t("pension.bridgeTitle")}
                    data={[
                      { label: t("pension.bridgeYearsLabel"), value: `${data.bridgeYears} ${t("units.yearUnit")}` },
                      {
                        label: t("pension.bridgeFundingLabel"),
                        value: (
                          <Text bold className="wf-nowrap">
                            {money(data.bridgeFundingNeeded)}
                          </Text>
                        ),
                      },
                    ]}
                  />
                ) : null}
                <Text type="secondary" className="wf-panel-note">
                  {data.bridgeYears > 0 ? t("pension.bridgeNote") : t("pension.coverageNote")}
                </Text>
              </>
            ) : null}
            <SlotPager
              label={t("advanced.pensionTitle")}
              total={outTotal}
              page={safeOutPage}
              onPage={setOutPage}
            />
          </div>
        ) : (
          <div className="wf-slot-body">
            {/* 参数槽两页：9 字段两列紧凑栅格（xs=12 与视口断点解耦——§1.1 F8 槽内口径） */}
            <div className="wf-slot-fields">
              {paramPage === 0 ? (
                <>
                  <IntField
                    xs={12}
                    md={12}
                    label={t("pension.currentAge")}
                    tooltip={t("pension.currentAgeTooltip")}
                    value={pensionInputs.currentAge}
                    onChange={(v) => setPensionInputs({ currentAge: v })}
                    suffix={t("units.yearUnit")}
                  />
                  <IntField
                    xs={12}
                    md={12}
                    label={
                      <span>
                        {t("pension.retireAge")}
                        {/* P10 槽态：延迟退休口径长 hint 下沉 FieldTip（信息路径零丢失） */}
                        <FieldTip text={t("pension.retireAgeDelayNote")} />
                      </span>
                    }
                    tooltip={t("pension.retireAgeTooltip")}
                    value={pensionInputs.retireAge}
                    onChange={(v) => setPensionInputs({ retireAge: v })}
                    suffix={t("units.yearUnit")}
                  />
                </>
              ) : (
                <>
                  <NumberField
                    xs={12}
                    md={12}
                    label={t("pension.contribIndex")}
                    tooltip={t("pension.contribIndexTooltip")}
                    value={pensionInputs.contribIndex}
                    onChange={(v) => setPensionInputs({ contribIndex: v })}
                    limit={LIMITS.contribIndex}
                  />
                  <AmountField
                    xs={12}
                    md={12}
                    label={t("pension.accountBalance")}
                    tooltip={t("pension.accountBalanceTooltip")}
                    value={pensionInputs.accountBalance}
                    onChange={(v) => setPensionInputs({ accountBalance: v })}
                    prefix={symbol}
                    suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
                    convertRate={rate}
                  />
                </>
              )}
              {paramPage === 0 ? (
                <>
                  {/* P7/P0-1：想停止工作的年龄（时间口径）——只驱动桥接两字段，不影响任何
                      养老金金额（金额仍全部由 retireAge 经计发月数联动承载，验收锚点 ①） */}
                  <IntField
                    xs={12}
                    md={12}
                    label={t("pension.targetRetireAge")}
                    tooltip={t("pension.targetRetireAgeTooltip")}
                    value={pensionInputs.targetRetireAge}
                    onChange={(v) => setPensionInputs({ targetRetireAge: v })}
                    min={LIMITS.targetRetireAge.min}
                    max={LIMITS.targetRetireAge.max}
                    suffix={t("units.yearUnit")}
                  />
                  <IntField
                    xs={12}
                    md={12}
                    label={t("pension.contribYears")}
                    tooltip={t("pension.contribYearsTooltip")}
                    value={pensionInputs.contribYears}
                    onChange={(v) => setPensionInputs({ contribYears: v })}
                    suffix={t("units.yearUnit")}
                  />
                </>
              ) : (
                <>
                  <AmountField
                    xs={12}
                    md={12}
                    label={t("pension.avgWage")}
                    /* P5 §5 冗长治理：原「来源行」整段（wf-panel-note）删除——数据口径全文
                       并入本字段提示（一句话出处由 tooltip 值内联承载） */
                    tooltip={`${t("pension.avgWageTooltip")}；${PENSION_WAGE_SOURCE_NOTE}`}
                    value={pensionInputs.avgMonthlyWage}
                    onChange={(v) => setPensionInputs({ avgMonthlyWage: v })}
                    prefix={symbol}
                    suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
                    convertRate={rate}
                  />
                  <IntField
                    xs={12}
                    md={12}
                    key={`months-sync-${monthsSyncEpoch}`}
                    label={t("pension.monthsDivisor")}
                    tooltip={t("pension.monthsDivisorTooltip")}
                    value={effectiveMonths}
                    onChange={(v) => {
                      setPensionInputs({ monthsDivisor: v });
                      setPensionMonthsSynced(false); // 手动修改计发月数即解除联动
                    }}
                    min={1}
                    max={600}
                    suffix={t("pension.monthsUnit")}
                    hint={monthsSynced ? t("pension.monthsSyncedHint") : undefined}
                  />
                </>
              )}
            </div>
            {/* 联动恢复按钮：点击递增重挂载序号，让计发月数输入框回填当刻表值 */}
            <Button
              type="text"
              size="small"
              className="wf-pressable"
              onClick={() => {
                setMonthsSyncEpoch((c) => c + 1);
                setPensionMonthsSynced(true);
              }}
            >
              {t("pension.monthsResync")}
            </Button>
            <SlotPager label={t("atlas.slotParams")} total={2} page={paramPage} onPage={setParamPage} />
          </div>
        )}
      </SlotBox>

      {/* 免责文案：固定渲染，不参与折叠、不随结果就绪与否变化 */}
      <Text type="secondary" className="wf-panel-note">
        {t("pension.disclaimer")}
      </Text>
    </div>
  );
}
