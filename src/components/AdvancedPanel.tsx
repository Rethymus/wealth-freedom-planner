/**
 * 高级估算面板：分段控件（3 组）+ 组内横滚标签页导航（方案 B，
 * docs/research-advanced-nav.md 复审后的用户选型）。
 * - 分组：人生规划（反向估算 / 打工模拟 / 社保养老金）、购房金融（贷款计算 /
 *   买房收租）、分析工具（蒙特卡洛 / 税务估算 / 多情景对比 / 公式原理）——
 *   9 面板 → 3 组认知分组，缓解「选项多、平铺单调」的主诉。
 * - 组内 Arco Tabs（横向，超宽自动收纳）：lazyload 首展挂载 + destroyOnHide
 *   默认 false——切换标签 / 切换分组均不卸载面板，已运行的模拟结果与表单
 *   输入保留（与互斥折叠版行为等价）。
 * - 每组记忆各自最后激活标签，切回分组时停留原面板。
 * - 键盘：组件库 Tabs 原生具备 ARIA tab 语义（role="tab" / aria-selected /
 *   tabindex=0 / aria-controls，源码实证），但无方向键漫游——本组件在外层
 *   捕获 ←/→ 切换并把焦点移到新标签头（roving tabindex 惯例）。
 * - 标签悬停提示（title）显示描述副行（*Desc 键），信息不因重构丢失。
 * - 面板标题经 react-i18next 三语化。
 */
import { Card, Radio, Tabs } from "@arco-design/web-react";
import { useState } from "react";
import type { ReactNode } from "react";
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

/** 单个面板定义：key 与历史折叠版一致（分享链接 / 情景库不引用面板 key，无兼容负担） */
interface PanelDef {
  key: string;
  titleKey: string;
  descKey: string;
  node: ReactNode;
}

/** 分组定义：顺序即分段控件展示顺序 */
interface GroupDef {
  id: string;
  labelKey: string;
  panels: PanelDef[];
}

/** 九面板 → 三组的导航信息架构（组序 / 组内序为产品口径，调整只动此表） */
const GROUPS: GroupDef[] = [
  {
    id: "plan",
    labelKey: "advanced.groupPlan",
    panels: [
      { key: "reverse", titleKey: "advanced.reverseTitle", descKey: "advanced.reverseDesc", node: <ReversePanel /> },
      { key: "accumulation", titleKey: "advanced.accumulationTitle", descKey: "advanced.accumulationDesc", node: <AccumulationPanel /> },
      { key: "pension", titleKey: "advanced.pensionTitle", descKey: "advanced.pensionDesc", node: <PensionPanel /> },
    ],
  },
  {
    id: "housing",
    labelKey: "advanced.groupHousing",
    panels: [
      { key: "loan", titleKey: "advanced.loanTitle", descKey: "advanced.loanDesc", node: <LoanPanel /> },
      { key: "rental", titleKey: "advanced.rentalTitle", descKey: "advanced.rentalDesc", node: <RentalPanel /> },
    ],
  },
  {
    id: "analysis",
    labelKey: "advanced.groupAnalysis",
    panels: [
      { key: "monte-carlo", titleKey: "advanced.mcTitle", descKey: "advanced.mcDesc", node: <MonteCarloPanel /> },
      { key: "tax", titleKey: "advanced.taxTitle", descKey: "advanced.taxDesc", node: <TaxPanel /> },
      { key: "scenario", titleKey: "advanced.scenarioTitle", descKey: "advanced.scenarioDesc", node: <ScenarioPanel /> },
      { key: "insights", titleKey: "advanced.insightsTitle", descKey: "advanced.insightsDesc", node: <InsightsPanel /> },
    ],
  },
];

/** 每组各自的初始面板（首项） */
const INITIAL_ACTIVE: Record<string, string> = Object.fromEntries(
  GROUPS.map((g) => [g.id, g.panels[0].key]),
);

export default function AdvancedPanel() {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState<string>(GROUPS[0].id);
  /** 每组记忆最后激活标签：activeByGroup[id] = panelKey */
  const [activeByGroup, setActiveByGroup] = useState<Record<string, string>>(INITIAL_ACTIVE);

  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];

  /** 方向键漫游：组件库 Tabs 无原生方向键（源码实证），←/→ 在组内标签间
   *  循环切换并把 DOM 焦点移到新标签（roving tabindex 惯例）。键盘事件由
   *  获得焦点的标签（原生 tabindex=0）冒泡至本包装层，无需额外焦点停靠。 */
  const makeTabsKeyDown = (gid: string) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const panels = GROUPS.find((g) => g.id === gid)?.panels ?? [];
    if (panels.length === 0) return;
    const wrapEl = e.currentTarget;
    const titles = Array.from(wrapEl.querySelectorAll<HTMLElement>(".arco-tabs-header-title"));
    // WAI-ARIA tabs 惯例：方向键以「聚焦的标签」为基准（聚焦项通常即激活项，
    // 但用户可点击其他标签后再按方向键，此时以聚焦项为准）
    const targetEl = e.target instanceof HTMLElement ? e.target : null;
    const focusedTitle = targetEl?.closest<HTMLElement>(".arco-tabs-header-title") ?? null;
    const focusedIdx = focusedTitle ? titles.indexOf(focusedTitle) : -1;
    const current = activeByGroup[gid] ?? panels[0].key;
    const idx = focusedIdx >= 0 ? focusedIdx : Math.max(0, panels.findIndex((p) => p.key === current));
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + delta + panels.length) % panels.length;
    setActiveByGroup((m) => ({ ...m, [gid]: panels[next].key }));
    // 焦点随切换移动。注意：React 合成事件的 currentTarget 在事件派发结束后
    // 会被置空，异步回调里必须用同步捕获的元素引用。
    window.setTimeout(() => {
      titles[next]?.focus();
    }, 0);
  };

  return (
    <Card title={t("advanced.cardTitle")} style={{ marginTop: 16 }}>
      <Radio.Group
        className="wf-adv-seg"
        type="button"
        name="advanced-group"
        value={groupId}
        onChange={(v: string) => setGroupId(v)}
        options={GROUPS.map((g) => ({ label: t(g.labelKey), value: g.id }))}
      />
      {/* 每组一个常驻 Tabs（hidden 隐藏而非卸载）：单 Tabs 实例随组换 children 会
          整组重挂导致已运行结果丢失（浏览器实测）；常驻 + hidden 保证跨组切换时
          面板 DOM 与组件状态（含蒙特卡洛运行结果、表单输入）完整保留。
          hidden 属性天然不参与 Tab 焦点序与 aria 曝光。 */}
      {GROUPS.map((g) => (
        <div
          key={g.id}
          className="wf-adv-tabs-wrap"
          hidden={g.id !== groupId}
          aria-label={t("advanced.tabsKbdHint")}
          onKeyDown={g.id === groupId ? makeTabsKeyDown(g.id) : undefined}
        >
          <Tabs
            className="wf-adv-tabs"
            type="capsule"
            activeTab={activeByGroup[g.id] ?? g.panels[0].key}
            lazyload
            onChange={(v: string) => setActiveByGroup((m) => ({ ...m, [g.id]: v }))}
          >
            {g.panels.map((p) => (
              <Tabs.TabPane
                key={p.key}
                title={<span title={t(p.descKey)}>{t(p.titleKey)}</span>}
              >
                {p.node}
              </Tabs.TabPane>
            ))}
          </Tabs>
        </div>
      ))}
    </Card>
  );
}
