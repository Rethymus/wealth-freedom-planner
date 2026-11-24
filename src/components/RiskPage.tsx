/**
 * 风险实验室任务页（P10 §1.3 K1–K4 切换树）：页级 2 叶（模拟 ⇄ 情景，桌面同样保持
 * 两叶不并栏——两卡均超半栏预算，p10-spec §1.3 K1 行）。
 * - K1 叶切换条：复用 advanced.mcTitle / advanced.scenarioTitle 既有键（零新键）；
 *   SegBar（Radio.Group 既有语义，§10 红线 4 零新交互词汇）。
 * - 叶内容 = MonteCarloPanel / ScenarioPanel 各自槽化壳（读数固定区 + 图⇄参数槽，
 *   K2–K4 契约由面板内部承载）；hidden 非卸载（首展挂载 + 常驻——模拟运行结果与
 *   表单输入跨叶切换零丢失，红线 7；先例 TaskPages visited 集合同构）。
 * - K3 运行入口落 C3 dock（T6 迁移：MC 面板尾 .wf-mc-dock-run flex 静态行）。
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import MonteCarloPanel from "./advanced/MonteCarloPanel";
import ScenarioPanel from "./advanced/ScenarioPanel";
import { SegBar } from "./slots";

type RiskLeaf = "sim" | "scenario";

export default function RiskPage() {
  const { t } = useTranslation();
  const [leaf, setLeaf] = useState<RiskLeaf>("sim");
  /** 首展挂载集合：展现过的叶永久保留挂载（hidden 非卸载；未展现叶不挂载省首屏成本） */
  const [visited, setVisited] = useState<ReadonlySet<RiskLeaf>>(() => new Set<RiskLeaf>(["sim"]));

  const selectLeaf = (v: string) => {
    setLeaf(v as RiskLeaf);
    setVisited((prev) => {
      const next = v as RiskLeaf;
      if (prev.has(next)) return prev;
      const out = new Set(prev);
      out.add(next);
      return out;
    });
  };

  return (
    <div className="wf-risk-page">
      {/* K1 叶切换条（40 预算；44px 命中随触屏档全局规则） */}
      <SegBar
        name="wf-k1-leaf"
        ariaLabel={t("atlas.nav.risk")}
        value={leaf}
        onChange={selectLeaf}
        options={[
          { value: "sim", label: t("advanced.mcTitle") },
          { value: "scenario", label: t("advanced.scenarioTitle") },
        ]}
      />
      <div className="wf-risk-leaf" hidden={leaf !== "sim"}>
        {visited.has("sim") ? <MonteCarloPanel /> : null}
      </div>
      <div className="wf-risk-leaf" hidden={leaf !== "scenario"}>
        {visited.has("scenario") ? <ScenarioPanel /> : null}
      </div>
    </div>
  );
}
