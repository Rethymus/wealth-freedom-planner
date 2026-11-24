/**
 * 人生轨迹任务页壳（P10 §1.2 L1–L5：组数 7 → 5 有意变更登记——同屏独立选项 ≤5 纪律，
 * research-responsive §8.4；现状 7 组为 wf03/P8/P9 有意变更登记链，本轮再登记收敛）。
 * 组→组迁移映射（信息路径先迁移，宪法 §5.2）：`trajectory→轨迹`、`events→事件`、
 * `accumulation+pension→规划`（组内 2 标签）、`loan+rental→资产`（组内 2 标签）、
 * `tax→税务`。
 * - L1 组分段条：Radio.Group（.wf-adv-seg 既有类）；<480 短形态由样式层承载（键零新）。
 * - L2 组内标签条：仅 规划/资产 两组渲染（其余组 0）；每组记忆最后激活标签（切回停留）。
 * - hidden 非卸载与首展挂载语义原样保留（visited 集合按面板粒度——跨组切换不丢表单
 *   输入与已运行结果，§5.5 红线 7）。
 * - L3/L4/L5 槽契约（读数区 + 图⇄参数槽）由各面板内部承载（life 与 pro 两宿主共用同一
 *   面板槽化壳）；组标签：轨迹组用 life.trajectoryTitle、事件组 life.eventsTitle、
 *   规划/资产用 atlas.lifeGroupPlan/lifeGroupAsset（P10 §7 新键）、税务 advanced.taxTitle。
 * - 键盘：数字键 1–5 在本页归任务分域（App 容器监听，§2.4 冲突消解），本页不绑
 *   数字键；组切换由分段控件原生键盘语义（方向键 / Tab）承载。
 */
import { Radio } from "@arco-design/web-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import LifeTrajectoryCard from "./LifeTrajectoryCard";
import LifeEventEditor from "./LifeEventEditor";
import AccumulationPanel from "./advanced/AccumulationPanel";
import PensionPanel from "./advanced/PensionPanel";
import LoanPanel from "./advanced/LoanPanel";
import RentalPanel from "./advanced/RentalPanel";
import TaxPanel from "./advanced/TaxPanel";
import { SegBar } from "./slots";

/** 组定义：inner 存在的组（规划/资产）先经 L2 组内标签条再挂面板（L2 仅这两组渲染） */
interface LifePanelDef {
  id: string;
  labelKey: string;
  node: ReactNode;
}

interface LifeGroupDef {
  id: string;
  labelKey: string;
  node?: ReactNode;
  inner?: LifePanelDef[];
}

const LIFE_GROUPS: LifeGroupDef[] = [
  { id: "trajectory", labelKey: "life.trajectoryTitle", node: <LifeTrajectoryCard /> },
  { id: "events", labelKey: "life.eventsTitle", node: <LifeEventEditor /> },
  {
    id: "plan",
    labelKey: "atlas.lifeGroupPlan",
    inner: [
      { id: "accumulation", labelKey: "advanced.accumulationTitle", node: <AccumulationPanel /> },
      { id: "pension", labelKey: "advanced.pensionTitle", node: <PensionPanel /> },
    ],
  },
  {
    id: "asset",
    labelKey: "atlas.lifeGroupAsset",
    inner: [
      { id: "loan", labelKey: "advanced.loanTitle", node: <LoanPanel /> },
      { id: "rental", labelKey: "advanced.rentalTitle", node: <RentalPanel /> },
    ],
  },
  { id: "tax", labelKey: "advanced.taxTitle", node: <TaxPanel /> },
];

export default function LifeTaskPage() {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState<string>(LIFE_GROUPS[0].id);
  /** L2 组内标签记忆：activeByGroup[id] = 面板 id（切回组停留原面板） */
  const [activeByGroup, setActiveByGroup] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const g of LIFE_GROUPS) {
      if (g.inner) out[g.id] = g.inner[0].id;
    }
    return out;
  });
  /** 首展挂载集合（按面板粒度）：展现过的面板永久保留挂载（hidden 非卸载） */
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set<string>([LIFE_GROUPS[0].id, activeByGroupDefault(LIFE_GROUPS)]),
  );

  const group = LIFE_GROUPS.find((g) => g.id === groupId) ?? LIFE_GROUPS[0];
  const activePanelId = activeByGroup[groupId] ?? group.inner?.[0].id ?? "";

  const selectGroup = (id: string) => {
    setGroupId(id);
    const g = LIFE_GROUPS.find((x) => x.id === id);
    const panelId = g?.inner ? (activeByGroup[id] ?? g.inner[0].id) : (g?.id ?? id);
    markVisited(panelId);
  };

  const markVisited = (panelId: string) => {
    setVisited((prev) => {
      if (prev.has(panelId)) return prev;
      const next = new Set(prev);
      next.add(panelId);
      return next;
    });
  };

  const selectInnerPanel = (gid: string, panelId: string) => {
    setActiveByGroup((m) => ({ ...m, [gid]: panelId }));
    markVisited(panelId);
  };

  return (
    <div className="wf-life-page">
      {/* L1 组分段条（5 组） */}
      <Radio.Group
        className="wf-adv-seg"
        type="button"
        name="atlas-life-group"
        value={groupId}
        onChange={(v: string) => selectGroup(v)}
        options={LIFE_GROUPS.map((g) => ({ label: t(g.labelKey), value: g.id }))}
      />
      {/* L2 组内标签条：仅规划/资产两组渲染（其余组 0 行——预算 L2 36 命中组） */}
      {group.inner ? (
        <SegBar
          name={`atlas-life-inner-${groupId}`}
          ariaLabel={t(group.labelKey)}
          value={activePanelId}
          onChange={(v: string) => selectInnerPanel(groupId, v)}
          options={group.inner.map((p) => ({ value: p.id, label: t(p.labelKey) }))}
        />
      ) : null}
      {/* 面板承载：inner 组按面板粒度 hidden 非卸载；单面板组按组粒度 */}
      {LIFE_GROUPS.map((g) => {
        if (g.inner) {
          return g.inner.map((p) => (
            <div key={p.id} className="atlas-life-panel" hidden={g.id !== groupId || p.id !== activePanelId}>
              {visited.has(p.id) ? p.node : null}
            </div>
          ));
        }
        return (
          <div key={g.id} className="atlas-life-panel" hidden={g.id !== groupId}>
            {visited.has(g.id) ? g.node : null}
          </div>
        );
      })}
    </div>
  );
}

/** 首组若为 inner 组则同时标记其首个面板（visited 初始化对齐 selectGroup 口径） */
function activeByGroupDefault(groups: LifeGroupDef[]): string {
  const first = groups[0];
  return first.inner ? first.inner[0].id : first.id;
}
