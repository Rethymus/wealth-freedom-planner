/**
 * 高级估算面板：9 个子面板，互斥折叠（accordion）——同一时间至多展开一项，
 * 已展开项再点即收起（组件库 onItemClick 语义：允许全部收起，research-advanced-nav §6.2）。
 * 折叠头两行文案：短标签主行（*Title）+ 描述副行（*Desc，<640 视觉收纳，样式层承载）。
 * 内容区使用 Grid：md 起两列、窄屏单列（见各面板的 FieldRow / md={12}）。
 * P2 新增第 8 个子面板「多情景对比」（docs/p2-spec.md §4.3，置于养老金之后）。
 * P3 新增第 9 个子面板「公式原理与数据依据」（docs/p3-spec.md §3，置于多情景对比之后）。
 * P4 互斥重构（docs/p4-spec.md §4–§5）：accordion 一行属性承载互斥；标题两行化；
 * 键盘与 aria 语义零变化（头部 role="button" + aria-expanded + Enter 由组件库承载）；
 * lazyload 保留——首展挂载 / 收起不卸载，切换面板不丢表单输入与已运行结果。
 * PanelHeader 渲染进 role="button" 头节点内部：内部只放纯展示节点，严禁可交互元素。
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

/** 折叠头两行标题：短标签主行 + 描述副行（副行 <640 由样式层 display:none 收纳） */
function PanelHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="wf-collapse-head">
      <div className="wf-collapse-head-title">{title}</div>
      <div className="wf-collapse-head-desc">{desc}</div>
    </div>
  );
}

export default function AdvancedPanel() {
  const { t } = useTranslation();
  return (
    <Card title={t("advanced.cardTitle")} style={{ marginTop: 16 }}>
      <Collapse bordered={false} expandIconPosition="right" lazyload accordion>
        <CollapseItem
          name="reverse"
          header={<PanelHeader title={t("advanced.reverseTitle")} desc={t("advanced.reverseDesc")} />}
        >
          <ReversePanel />
        </CollapseItem>
        <CollapseItem
          name="loan"
          header={<PanelHeader title={t("advanced.loanTitle")} desc={t("advanced.loanDesc")} />}
        >
          <LoanPanel />
        </CollapseItem>
        <CollapseItem
          name="rental"
          header={<PanelHeader title={t("advanced.rentalTitle")} desc={t("advanced.rentalDesc")} />}
        >
          <RentalPanel />
        </CollapseItem>
        <CollapseItem
          name="monte-carlo"
          header={<PanelHeader title={t("advanced.mcTitle")} desc={t("advanced.mcDesc")} />}
        >
          <MonteCarloPanel />
        </CollapseItem>
        <CollapseItem
          name="tax"
          header={<PanelHeader title={t("advanced.taxTitle")} desc={t("advanced.taxDesc")} />}
        >
          <TaxPanel />
        </CollapseItem>
        <CollapseItem
          name="accumulation"
          header={<PanelHeader title={t("advanced.accumulationTitle")} desc={t("advanced.accumulationDesc")} />}
        >
          <AccumulationPanel />
        </CollapseItem>
        <CollapseItem
          name="pension"
          header={<PanelHeader title={t("advanced.pensionTitle")} desc={t("advanced.pensionDesc")} />}
        >
          <PensionPanel />
        </CollapseItem>
        <CollapseItem
          name="scenario"
          header={<PanelHeader title={t("advanced.scenarioTitle")} desc={t("advanced.scenarioDesc")} />}
        >
          <ScenarioPanel />
        </CollapseItem>
        <CollapseItem
          name="insights"
          header={<PanelHeader title={t("advanced.insightsTitle")} desc={t("advanced.insightsDesc")} />}
        >
          <InsightsPanel />
        </CollapseItem>
      </Collapse>
    </Card>
  );
}
