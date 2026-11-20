/**
 * 高级估算面板：9 个子面板，默认全部收起。
 * 内容区使用 Grid：md 起两列、窄屏单列（见各面板的 FieldRow / md={12}）。
 * P2 新增第 8 个子面板「多情景对比」（docs/p2-spec.md §4.3，置于养老金之后）。
 * P3 新增第 9 个子面板「公式原理与数据依据」（docs/p3-spec.md §3，置于多情景对比之后）。
 * 面板标题经 react-i18next 三语化。
 */
import { Card, Collapse } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import ReversePanel from "./advanced/ReversePanel";
import LoanPanel from "./advanced/LoanPanel";
import RentalPanel from "./advanced/RentalPanel";
import MonteCarloPanel from "./advanced/MonteCarloPanel";
import TaxPanel from "./advanced/TaxPanel";
import AccumulationPanel from "./advanced/AccumulationPanel";
import PensionPanel from "./advanced/PensionPanel";
import ScenarioPanel from "./advanced/ScenarioPanel";
import InsightsPanel from "./advanced/InsightsPanel";

const CollapseItem = Collapse.Item;

export default function AdvancedPanel() {
  const { t } = useTranslation();
  return (
    <Card title={t("advanced.cardTitle")} style={{ marginTop: 16 }}>
      <Collapse bordered={false} expandIconPosition="right" lazyload>
        <CollapseItem name="reverse" header={t("advanced.reverseHeader")}>
          <ReversePanel />
        </CollapseItem>
        <CollapseItem name="loan" header={t("advanced.loanHeader")}>
          <LoanPanel />
        </CollapseItem>
        <CollapseItem name="rental" header={t("advanced.rentalHeader")}>
          <RentalPanel />
        </CollapseItem>
        <CollapseItem name="monte-carlo" header={t("advanced.mcHeader")}>
          <MonteCarloPanel />
        </CollapseItem>
        <CollapseItem name="tax" header={t("advanced.taxHeader")}>
          <TaxPanel />
        </CollapseItem>
        <CollapseItem name="accumulation" header={t("advanced.accumulationHeader")}>
          <AccumulationPanel />
        </CollapseItem>
        <CollapseItem name="pension" header={t("advanced.pensionHeader")}>
          <PensionPanel />
        </CollapseItem>
        <CollapseItem name="scenario" header={t("advanced.scenarioHeader")}>
          <ScenarioPanel />
        </CollapseItem>
        <CollapseItem name="insights" header={t("advanced.insightsHeader")}>
          <InsightsPanel />
        </CollapseItem>
      </Collapse>
    </Card>
  );
}
