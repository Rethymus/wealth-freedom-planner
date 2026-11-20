/**
 * ⑦ 社保养老金：简化两层公式（基础养老金 + 个人账户）估算退休后月养老金，
 * 并给出「调整后参考线」——月开销中被养老金覆盖的部分不再需要本金支撑。
 * 口径（契约 estimate_pension，见 src/wasm/bridge.ts）：输入复用基础参数卡当前值
 * 组合调用；社平工资与缴费指数不做增长假设；账户余额不做未来增值假设。
 * 简化估算，不构成社保咨询（面板内固定免责文案）。
 * 文案经 react-i18next 三语化。
 */
import { Alert, Button, Descriptions, Spin, Typography } from "@arco-design/web-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { calcPension } from "../../services/finance";
import { formatNumber } from "../../services/format";
import { LIMITS, resolveThemeTokens } from "../../data/defaults";
import { effectiveMonthsDivisor, PENSION_WAGE_SOURCE_NOTE } from "../../data/pensionParams";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, IntField, NumberField } from "../fields";
import { useFinanceCall, useIsNarrowViewport, useMoney } from "../hooks";

const { Text } = Typography;

export default function PensionPanel() {
  const { t } = useTranslation();
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

  return (
    <div>
      {/* 说明行：两层公式 + 简化口径 */}
      <Text type="secondary">{t("pension.formulaNote")}</Text>

      <FieldRow>
        <IntField
          md={12}
          label={t("pension.currentAge")}
          tooltip={t("pension.currentAgeTooltip")}
          value={pensionInputs.currentAge}
          onChange={(v) => setPensionInputs({ currentAge: v })}
          suffix={t("units.yearUnit")}
        />
        <IntField
          md={12}
          label={t("pension.retireAge")}
          tooltip={t("pension.retireAgeTooltip")}
          value={pensionInputs.retireAge}
          onChange={(v) => setPensionInputs({ retireAge: v })}
          suffix={t("units.yearUnit")}
          hint={t("pension.retireAgeDelayNote")}
        />
        <IntField
          md={12}
          label={t("pension.contribYears")}
          tooltip={t("pension.contribYearsTooltip")}
          value={pensionInputs.contribYears}
          onChange={(v) => setPensionInputs({ contribYears: v })}
          suffix={t("units.yearUnit")}
        />
        <NumberField
          md={12}
          label={t("pension.contribIndex")}
          tooltip={t("pension.contribIndexTooltip")}
          value={pensionInputs.contribIndex}
          onChange={(v) => setPensionInputs({ contribIndex: v })}
          limit={LIMITS.contribIndex}
        />
        <AmountField
          label={t("pension.accountBalance")}
          tooltip={t("pension.accountBalanceTooltip")}
          value={pensionInputs.accountBalance}
          onChange={(v) => setPensionInputs({ accountBalance: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <AmountField
          label={t("pension.avgWage")}
          tooltip={t("pension.avgWageTooltip")}
          value={pensionInputs.avgMonthlyWage}
          onChange={(v) => setPensionInputs({ avgMonthlyWage: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuanPerMonth") : undefined}
          convertRate={rate}
        />
        <IntField
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
      </FieldRow>

      {/* 联动恢复按钮：点击递增重挂载序号，让计发月数输入框回填当刻表值（显示与计算口径一致） */}
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

      {/* 来源行：数据口径简中原样（数据口径不入 i18n 为仓库既有纪律） */}
      <Text type="secondary" className="wf-panel-note">
        {t("pension.wageSourceLine", { source: PENSION_WAGE_SOURCE_NOTE })}
      </Text>

      {/* 运行区：无按钮；防抖计算中在结果区头部显示小型旋转器（模式同 BasicCalculator 输出卡头部） */}
      {loading ? <Spin size={14} /> : null}

      {serviceError ? <Alert type="error" style={{ marginTop: 8 }} content={serviceError} /> : null}

      {data ? (
        <>
          {/* 防抖窗口内金额来自上一轮 wasm 结果，而计发月数即时跟随输入（规范 §3.6.1 设计）；
              loading 期间整表降透明度提示「计算中」，消除「新月数 + 旧金额」的观感矛盾 */}
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8, opacity: loading ? 0.45 : 1 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 2 }}
            data={[
              {
                label: t("pension.monthlyPension"),
                value: (
                  <Text bold className="wf-nowrap">
                    {money(data.pensionMonthly)}
                  </Text>
                ),
              },
              { label: t("pension.basicPart"), value: money(data.basicPensionMonthly) },
              { label: t("pension.accountPart"), value: money(data.accountPensionMonthly) },
              {
                label: t("pension.yearsToRetire"),
                value: `${data.yearsToRetire} ${t("units.yearUnit")}`,
              },
              {
                label: t("pension.monthsUsed"),
                value: `${effectiveMonths} ${t("pension.monthsUnit")}`,
              },
            ]}
          />
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8, opacity: loading ? 0.45 : 1 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={{ xs: 1, md: 2 }}
            title={t("pension.adjustedTitle")}
            data={[
              {
                label: t("pension.adjustedExpense"),
                value: money(data.adjustedMonthlyExpense),
              },
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
                value: `${formatNumber(data.coverageRatio * 100, 1)}%`,
              },
            ]}
          />
          {data.coverageRatio >= 1 ? (
            <div style={{ marginTop: 8 }}>
              <Text bold style={{ color: themeTokens.rise }}>
                {t("pension.coverageFull")}
              </Text>
            </div>
          ) : null}
          <Text type="secondary" className="wf-panel-note">
            {t("pension.coverageHint")}
          </Text>
          <Text type="secondary" className="wf-panel-note">
            {t("pension.resultNote")}
          </Text>
        </>
      ) : null}

      {/* 免责文案：固定渲染，不参与折叠、不随结果就绪与否变化 */}
      <Text type="secondary" className="wf-panel-note">
        {t("pension.disclaimer")}
      </Text>
    </div>
  );
}
