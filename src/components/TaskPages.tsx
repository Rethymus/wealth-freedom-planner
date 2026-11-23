/**
 * 人生轨迹任务页壳（WF-03 §1 迁移表 2–5/7 行 + §2.5：本轮单列聚合承载，life 容器
 * 查询归 WF-04——brief §六衔接注记）。七个面板组：轨迹总览 / 人生事件（P9 §5.3）/ 积累 /
 * 养老 / 负债 / 收租 / 税务（原型 §2.1 组序 + P8 §4.2 首组插入 LifeTrajectoryCard——
 * 组数 5 → 6 为 P8 有意变更；P9 §5.3 首组后插 events 组 6 → 7 有意变更），每面板整壳
 * 迁挂、本体零触碰（§4.2 白名单）。
 * - 分段 + hidden 非卸载（先例 AdvancedPanel.tsx:145-153）：组内面板首次展现才挂载
 *   （lazyload 先例 AdvancedPanel.tsx:161），此后常驻 DOM 仅切显隐——跨组切换不丢
 *   表单输入与已运行结果（§5.5 切换不卸载红线）。
 * - 组标签：轨迹组用 life.trajectoryTitle（P8 §4.3 新键），其余沿用既有 advanced.*
 *   键（不搬块不改名）；分段控件为组件库 Radio.Group（与专业模式组分段同语义，
 *   .wf-adv-seg 既有类）。
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

/** 七组定义：id = 面板现行 key（每组一面板）；顺序 = 分段展示序（原型 §2.1 + P8 §4.2
 *  首组插入 trajectory + P9 §5.3 首组后插 events——组数 5 → 6（P8）→ 7（P9 有意变更，
 *  理由：新输入面），分段控件语义 / hidden 非卸载 / 首展挂载全部不动；events 组不绑
 *  数字键（p9-spec §7 红线 4）） */
interface LifeGroupDef {
  id: string;
  labelKey: string;
  node: ReactNode;
}

const LIFE_GROUPS: LifeGroupDef[] = [
  { id: "trajectory", labelKey: "life.trajectoryTitle", node: <LifeTrajectoryCard /> },
  { id: "events", labelKey: "life.eventsTitle", node: <LifeEventEditor /> },
  { id: "accumulation", labelKey: "advanced.accumulationTitle", node: <AccumulationPanel /> },
  { id: "pension", labelKey: "advanced.pensionTitle", node: <PensionPanel /> },
  { id: "loan", labelKey: "advanced.loanTitle", node: <LoanPanel /> },
  { id: "rental", labelKey: "advanced.rentalTitle", node: <RentalPanel /> },
  { id: "tax", labelKey: "advanced.taxTitle", node: <TaxPanel /> },
];

export default function LifeTaskPage() {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState<string>(LIFE_GROUPS[0].id);
  /** 首展挂载集合：展现过的组永久保留挂载（hidden 非卸载；未展现组不挂载省首屏成本） */
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([LIFE_GROUPS[0].id]));

  const selectGroup = (id: string) => {
    setGroupId(id);
    setVisited((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="atlas-life">
      <Radio.Group
        className="wf-adv-seg"
        type="button"
        name="atlas-life-group"
        value={groupId}
        onChange={(v: string) => selectGroup(v)}
        options={LIFE_GROUPS.map((g) => ({ label: t(g.labelKey), value: g.id }))}
      />
      {LIFE_GROUPS.map((g) => (
        <div key={g.id} className="atlas-life-panel" hidden={g.id !== groupId}>
          {visited.has(g.id) ? g.node : null}
        </div>
      ))}
    </div>
  );
}
