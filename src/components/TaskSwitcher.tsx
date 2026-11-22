/**
 * Atlas 任务切换条（WF-03 §2.1/§2.4；裁定源 docs/research-wf03-routing.md §1）：
 * 恰 5 项——四任务主行样式 + 专业模式次级样式（发丝线分隔），自研分段切换条
 * （ADR-001 D-B1「自研抽象」结论域，零新依赖）。
 * - 完整 tab 语义：role="tablist" + aria-label（三语键）；每项 role="tab" +
 *   aria-selected + aria-controls="atlas-<task>"；roving tabindex（活动项 0 余 −1）；
 *   ←/→ 在 5 项间循环移动焦点（仅移焦）；Enter/Space 手动激活（重内容页不满足自动
 *   激活条件——button 原生承载，无额外键盘代码）。
 * - 数字键 1–4/5 分域监听挂任务容器（App.tsx，S21 式输入豁免同构判定），本组件不绑定
 *   数字键，避免与容器分域重复派发。
 * - 描述副行走 atlas.nav.*Desc / atlas.pro.desc（§6 既有新键）；样式挂既有令牌
 *   （.wf-adv-seg 语义先例 global.css），禁直写色值。
 */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ATLAS_TASK_IDS } from "../services/routeState";
import type { AtlasTaskId } from "../services/routeState";

/** 切换条 5 项的三语键映射（label 兼作 role=tab 的可见名；desc 为副行披露） */
const TASK_NAV_KEYS: Record<AtlasTaskId, { labelKey: string; descKey: string; pro?: boolean }> = {
  freedom: { labelKey: "atlas.nav.freedom", descKey: "atlas.nav.freedomDesc" },
  life: { labelKey: "atlas.nav.life", descKey: "atlas.nav.lifeDesc" },
  risk: { labelKey: "atlas.nav.risk", descKey: "atlas.nav.riskDesc" },
  principles: { labelKey: "atlas.nav.principles", descKey: "atlas.nav.principlesDesc" },
  pro: { labelKey: "atlas.pro.label", descKey: "atlas.pro.desc", pro: true },
};

interface TaskSwitcherProps {
  /** 当前活动任务（受控；恒有一选中项，tablist 无空选中态） */
  active: AtlasTaskId;
  /** 显式激活（点选 / Enter/Space）；持久化与 URL 同步由 App 统一承载 */
  onSelect: (task: AtlasTaskId) => void;
}

export default function TaskSwitcher({ active, onSelect }: TaskSwitcherProps) {
  const { t } = useTranslation();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /** ←/→ 漫游：以「聚焦的标签」为基准（WAI-ARIA tabs 惯例；聚焦项通常即活动项，
   *  但用户点选其他标签后再按方向键时以聚焦项为准），循环移动焦点不激活 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const focusedIdx = tabRefs.current.indexOf(document.activeElement as HTMLButtonElement | null);
    const base = focusedIdx >= 0 ? focusedIdx : ATLAS_TASK_IDS.indexOf(active);
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (base + delta + ATLAS_TASK_IDS.length) % ATLAS_TASK_IDS.length;
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="atlas-switch" role="tablist" aria-label={t("atlas.nav.label")} onKeyDown={handleKeyDown}>
      {ATLAS_TASK_IDS.map((id, i) => {
        const meta = TASK_NAV_KEYS[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`atlas-tab-${id}`}
            className={`atlas-switch-tab${isActive ? " atlas-switch-tab-active" : ""}${
              meta.pro ? " atlas-switch-tab-pro" : ""
            }`}
            aria-selected={isActive}
            aria-controls={`atlas-${id}`}
            tabIndex={isActive ? 0 : -1}
            title={t(meta.descKey)}
            onClick={() => onSelect(id)}
          >
            <span className="atlas-switch-tab-label">{t(meta.labelKey)}</span>
            <span className="atlas-switch-tab-desc" aria-hidden="true">
              {t(meta.descKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
