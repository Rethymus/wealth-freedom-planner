/**
 * P10 零滚动切换树的槽套件（docs/p10-spec.md §1.0/§2.3）：
 * - SegBar：槽切换条 / 分段条统一承载（Radio.Group type="button" 既有语义复用，
 *   零新交互词汇——§10 红线 4；样式挂既有 .wf-adv-seg 语义先例 + .wf-segbar 布局类）；
 * - SlotBox：等高槽容器（高度恒定，内部内容切换等高互换、替换不加高——§1.0 槽定义；
 *   overflow:hidden 防内容溢出加高，页面级零滚动由 A1 三重判定裁决）。
 * 键盘漫游沿用组件库 Radio 原生方向键语义（TaskSwitcher / AdvancedPanel 先例同族）。
 */
import { Button, Radio } from "@arco-design/web-react";
import type { ReactNode } from "react";

export interface SegOption {
  value: string;
  label: string;
}

export function SegBar(props: {
  name: string;
  ariaLabel: string;
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
}) {
  return (
    <Radio.Group
      className="wf-adv-seg wf-segbar"
      type="button"
      name={props.name}
      value={props.value}
      aria-label={props.ariaLabel}
      onChange={(v: string) => props.onChange(v)}
      options={props.options}
    />
  );
}

/**
 * 等高槽容器（P10 骨架修复轮改版）：槽本体由样式层 `flex: 1 1 0` 填充页内剩余空间——
 * 槽外固定区（切换条/读数区/dock）恒定时槽高恒定，内部内容切换等高互换、替换不加高
 * （§1.0 槽定义）。`height` 语义从「固定高度」改为「下限（min-height）」：内容低于
 * 下限时保底、空间不足时不强撑——页栈超限不再被静默裁切，而是上抛到页级
 * （A1 判定①挂起 + 显式回退横幅，红线 9）；槽内容超限由槽内分页消化（A1 判定②′）。
 */
export function SlotBox(props: { height?: number | string; children: ReactNode }) {
  return (
    <div
      className="wf-slot"
      style={props.height !== undefined ? { minHeight: props.height } : undefined}
    >
      {props.children}
    </div>
  );
}

/**
 * 槽内分页器（§8.3-3 槽分页控件简化登记）：双 mini 按钮 +「当前/总数」文本，等高互换
 * 的页切换原语。零新 i18n 键（§7 预算锁定）——按钮可访问名用数字目标页（{{n}}/{{total}}
 * 形态），外层 nav aria-label 承载宿主槽名（读屏先闻槽名再闻页序，登记注记）。
 * 相比组件库 Pagination（simple mini）省其按需 CSS 与组件 JS（尺寸门禁实测回写）。
 */
export function SlotPager(props: { label: string; total: number; page: number; onPage: (page0: number) => void }) {
  const first = props.page <= 0;
  const last = props.page >= props.total - 1;
  return (
    <nav className="wf-slot-pager" aria-label={`${props.label} ${props.page + 1}/${props.total}`}>
      <Button
        size="mini"
        type="text"
        className="wf-pressable"
        disabled={first}
        aria-label={`${props.page}/${props.total}`}
        onClick={() => props.onPage(props.page - 1)}
      >
        ‹
      </Button>
      <span aria-hidden="true" className="wf-slot-pager-text">
        {props.page + 1}/{props.total}
      </span>
      <Button
        size="mini"
        type="text"
        className="wf-pressable"
        disabled={last}
        aria-label={`${props.page + 2}/${props.total}`}
        onClick={() => props.onPage(props.page + 1)}
      >
        ›
      </Button>
    </nav>
  );
}
