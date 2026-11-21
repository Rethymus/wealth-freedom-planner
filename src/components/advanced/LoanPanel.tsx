/**
 * ② 贷款计算：商贷 / 公积金 Select、等额本息 / 等额本金 Radio、利率年限
 * → 月供摘要 + 总利息 + 摊销表（表格行多时展示首 12 期 + 关键汇总）。
 * 文案经 react-i18next 三语化。
 */
import { Alert, Descriptions, Grid, Radio, Select, Table, Typography } from "@arco-design/web-react";
import type { TableColumnProps } from "@arco-design/web-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { calcAmortize } from "../../services/finance";
import { formatNumber } from "../../services/format";
import { LIMITS } from "../../data/defaults";
import type { AmortizeRow } from "../../wasm/bridge";
import { useCalculatorStore } from "../../store/useCalculatorStore";
import { AmountField, FieldRow, IntField, PercentField } from "../fields";
import { useAnimatedNumber, useFinanceCall, useIsNarrowViewport, useIsWorkbenchViewport, useMoney } from "../hooks";

const { Text } = Typography;
const { Col } = Grid;

/** 贷款类型（仅影响提示文案与展示，计算对两类贷款一致） */
type LoanKind = "commercial" | "housing_fund";

/** 贷款年限 UI 限额（数据层 LIMITS 集中维护） */
const LOAN_YEARS_LIMIT = LIMITS.loanYears;

export default function LoanPanel() {
  const { t } = useTranslation();
  /** S18 可见性闸宿主（hooks.ts useAnimatedNumber）：hidden/视口外暂停 rAF（§6 红线 2） */
  const hostRef = useRef<HTMLDivElement>(null);
  const inputs = useCalculatorStore((s) => s.loanInputs);
  const setInputs = useCalculatorStore((s) => s.setLoanInputs);
  const displayCode = useCalculatorStore((s) => s.currency.display);
  /** ⑤ 金额展示绑定（p4-spec §3.4）：摘要三值与摊销表四列经展示币种换算；rate null = 符号-only */
  const { symbol, moneyFixed, display } = useMoney(displayCode);
  const rate = display.rate;

  const [loanKind, setLoanKind] = useState<LoanKind>("commercial");

  const { loading, result } = useFinanceCall(() => calcAmortize(inputs), [inputs]);
  /** 窄视口下结果 Descriptions 切纵向堆叠（标签上/值下），避免长 label 挤压数值列 */
  const isNarrow = useIsNarrowViewport();
  /** V2 同族延伸（第 1 轮视觉验收复验实测：双栏右栏容器 594px、md:3 内容宽 687px
   *  溢出裁切「還款總額」数值列，与 ReversePanel V2 同因同款修复）：
   *  ≥1200 双栏激活时切单列键值行；<768（layout vertical + xs:1）与 768–1199 行为不变 */
  const isWorkbench = useIsWorkbenchViewport();

  const data = result?.ok === true ? result.data : null;
  const error = result && !result.ok ? result.error : null;
  const equalPrincipal = inputs.method === "equal_principal";
  /** S18 面板主数渐近滚动（p6-spec §2）：rAF 中间帧只进显示值、永不进 store（§6 红线 2） */
  const animatedMonthlyPayment = useAnimatedNumber(data?.monthlyPayment ?? 0, undefined, hostRef);

  /** 贷款类型选项（文案随语言切换） */
  const loanKindOptions = [
    { label: t("loan.loanCommercial"), value: "commercial" as const },
    { label: t("loan.loanHousingFund"), value: "housing_fund" as const },
  ];

  const columns: Array<TableColumnProps<AmortizeRow>> = [
    {
      title: t("loan.colPeriod"),
      dataIndex: "month",
      // 80px 容不下「第 10 期」（内容 ~49px + 单元格内边距 32px），两位数期次会折行；
      // 加宽至 96px 并禁止单元格内换行（arco-table-cell 默认 word-break: break-all）
      width: 96,
      render: (v: number) => <span className="wf-nowrap">{t("loan.period", { n: v })}</span>,
    },
    { title: t("loan.colPayment"), dataIndex: "payment", align: "right", render: (v: number) => moneyFixed(v) },
    { title: t("loan.colPrincipal"), dataIndex: "principalPart", align: "right", render: (v: number) => moneyFixed(v) },
    { title: t("loan.colInterest"), dataIndex: "interestPart", align: "right", render: (v: number) => moneyFixed(v) },
    { title: t("loan.colRemaining"), dataIndex: "remaining", align: "right", render: (v: number) => moneyFixed(v) },
  ];

  return (
    <div ref={hostRef}>
      <FieldRow>
        <AmountField
          label={t("loan.principal")}
          tooltip={t("loan.principalTooltip")}
          value={inputs.principal}
          onChange={(v) => setInputs({ principal: v })}
          prefix={symbol}
          suffix={displayCode === "CNY" ? t("units.yuan") : undefined}
          convertRate={rate}
        />
        <PercentField
          label={t("loan.annualRate")}
          tooltip={t("loan.annualRateTooltip")}
          value={inputs.annualRatePct}
          onChange={(v) => setInputs({ annualRatePct: v })}
          suffix="%"
        />
        <IntField
          label={t("loan.years")}
          tooltip={t("loan.yearsTooltip")}
          value={inputs.years}
          onChange={(v) => setInputs({ years: v })}
          min={LOAN_YEARS_LIMIT.min}
          max={LOAN_YEARS_LIMIT.max}
          suffix={t("units.yearUnit")}
          hint={t("loan.yearsHint", { max: LOAN_YEARS_LIMIT.max })}
        />
        <Col xs={24} className="wf-field">
          <div className="wf-field-label">
            <Text>{t("loan.loanType")}</Text>
          </div>
          <Select
            value={loanKind}
            options={loanKindOptions}
            onChange={(v: LoanKind) => setLoanKind(v)}
            style={{ width: 180 }}
            className="wf-pressable"
          />
          <div className="wf-field-hint">
            <Text type="secondary">
              {loanKind === "housing_fund" ? t("loan.housingFundHint") : t("loan.commercialHint")}
            </Text>
          </div>
        </Col>
        <Col xs={24} className="wf-field">
          <div className="wf-field-label">
            <Text>{t("loan.repayMethod")}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {t("loan.repayMethodHint")}
            </Text>
          </div>
          <Radio.Group
            name="loan-method"
            value={inputs.method}
            onChange={(v) => setInputs({ method: v as typeof inputs.method })}
          >
            <Radio value="equal_payment">{t("loan.equalPayment")}</Radio>
            <Radio value="equal_principal">{t("loan.equalPrincipal")}</Radio>
          </Radio.Group>
        </Col>
      </FieldRow>

      {loading ? <Text type="secondary">{t("common.computing")}</Text> : null}
      {data ? (
        <>
          <Descriptions
            border
            size="small"
            style={{ marginTop: 8 }}
            layout={isNarrow ? "vertical" : "horizontal"}
            column={isWorkbench ? 1 : { xs: 1, md: 3 }}
            data={[
              {
                label: equalPrincipal ? t("loan.monthlyPaymentFirst") : t("loan.monthlyPaymentFixed"),
                value: <Text bold className="wf-nowrap">{moneyFixed(animatedMonthlyPayment)}</Text>,
              },
              { label: t("loan.totalInterest"), value: moneyFixed(data.totalInterest) },
              {
                label: t("loan.totalRepayment"),
                value: moneyFixed(inputs.principal + data.totalInterest),
              },
            ]}
          />
          <div style={{ marginTop: 12 }}>
            {/* D7 滑动提示：置于表格上方（docs/p3-spec.md §6.6）；<675.9 档由样式层放行 */}
            <Text type="secondary" className="wf-swipe-hint">{t("common.swipeHint")}</Text>
            <Table
              columns={columns}
              data={data.rows.slice(0, 12)}
              pagination={false}
              size="small"
              border={{ wrapper: true, cell: true }}
              className="wf-amortize-table"
            />
            <Text type="secondary" className="wf-panel-note">
              {t("loan.rowsNote", { total: formatNumber(data.rows.length, 0) })}
            </Text>
          </div>
        </>
      ) : null}
      {error ? <Alert type="error" style={{ marginTop: 8 }} content={error} /> : null}
    </div>
  );
}
