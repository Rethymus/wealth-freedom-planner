/**
 * 公式解构行（WF-04 T2；docs/wf04-spec.md §1-T2 / research-wf04-anatomy-overlay §1 承接）：
 * 480 法则公式行 A = 480X + KN + M + H——A 结果锚不可点击；X/K/N/M/H 为可点击 token
 * （<button>，Tab 按书写序漫游）。点击/Enter 锁定 → 目标输入字段静态描边 + label 加粗
 * （宿主经 props 置位/清除成对，纯展示态、零 store 写入、零参数修改——§4 条 8）；
 * hover 300ms 预览（原型推导值；无 hover 环境 tap 直锁）；Esc 清除锁定并把焦点还回
 * 原锁定 token（逐层退出语义）。K/N 在育儿开关关时 token 禁用态（aria-disabled + tooltip
 * 开启路径说明，复用 basic.planChildrenHint 既有键），公式形状恒完整、不静默缺项。
 * 与 S16 共存（§2-S16①）：本行落 BasicCalculator key={flashEpoch} 重挂域之外（输入卡
 * 尾 vs 输出卡重挂域，不同 DOM 子树）——落定重挂不扰动 token 焦点与锁定态。
 * 动效纪律：解构强调无动画（纯静态描边 + 加粗，reduced-motion 零降级分支）；tooltip
 * 进出场沿用组件库既有覆盖档；hover 计时器经 useEffect 卸载清理（cleanup 纪律）。
 */
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { Tooltip } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";

export type AnatomyVar = "X" | "K" | "N" | "M" | "H";

/** token 定义序 = 公式书写序（Tab 漫游序）；nameKey 复用既有字段名键（零新增）；
 *  term = 该变量在公式中的贡献段（anatomy.varNote 模板插值，i18n 并合预案：
 *  5 个 var 键并 1 模板键） */
const TOKENS: { sym: AnatomyVar; nameKey: string; term: string; needsChildren: boolean }[] = [
  { sym: "X", nameKey: "basic.monthlyExpense", term: "480X", needsChildren: false },
  { sym: "K", nameKey: "basic.childCost", term: "K", needsChildren: true },
  { sym: "N", nameKey: "basic.childCount", term: "N", needsChildren: true },
  { sym: "M", nameKey: "basic.majorInvestment", term: "M", needsChildren: false },
  { sym: "H", nameKey: "basic.healthReserve", term: "H", needsChildren: false },
];

interface FormulaAnatomyRowProps {
  /** 锁定变量（null = 无锁定）；状态提升至宿主——高亮目标字段在宿主 FieldRow 渲染 */
  locked: AnatomyVar | null;
  /** 育儿开关（K/N token 禁用态判定，与字段条件渲染同源） */
  planChildren: boolean;
  onLock: (v: AnatomyVar | null) => void;
  onPreview: (v: AnatomyVar | null) => void;
}

export default function FormulaAnatomyRow({ locked, planChildren, onLock, onPreview }: FormulaAnatomyRowProps) {
  const { t } = useTranslation();
  const timerRef = useRef<number | null>(null);
  const tokenRefs = useRef<Partial<Record<AnatomyVar, HTMLButtonElement | null>>>({});
  /** hover 300ms 预览计时器：卸载清理（监听器 cleanup 纪律，§3 红线 3 同源） */
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  const hover = (v: AnatomyVar) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onPreview(v), 300);
  };
  const leave = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onPreview(null);
  };
  /** Esc：清除锁定并把焦点还回原锁定 token（无论焦点当前在哪，逐层退出语义） */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || locked === null) return;
    const el = tokenRefs.current[locked];
    onLock(null);
    el?.focus();
  };
  const token = (sym: AnatomyVar) => {
    const def = TOKENS.find((d) => d.sym === sym);
    if (!def) return null;
    const off = def.needsChildren && !planChildren;
    return (
      <Tooltip key={sym} content={off ? t("basic.planChildrenHint") : t("anatomy.varNote", { sym, name: t(def.nameKey), term: def.term })}>
        <button
          type="button"
          ref={(el) => {
            tokenRefs.current[sym] = el;
          }}
          className={locked === sym ? "wf-anatomy-token wf-pressable wf-anatomy-on" : "wf-anatomy-token wf-pressable"}
          aria-disabled={off || undefined}
          onMouseEnter={off ? undefined : () => hover(sym)}
          onMouseLeave={off ? undefined : leave}
          onClick={() => {
            if (!off) onLock(locked === sym ? null : sym);
          }}
        >
          {sym}
        </button>
      </Tooltip>
    );
  };
  const lockedDef = TOKENS.find((d) => d.sym === locked);
  return (
    <div className="wf-anatomy" role="group" aria-label={t("basic.formulaRow")} onKeyDown={onKeyDown}>
      <span className="wf-lens-cap">{t("basic.formulaRow")}：</span>
      <span className="wf-anatomy-formula">
        A = 480
        {token("X")} + {token("K")}
        {token("N")} + {token("M")} + {token("H")}
      </span>
      {/* 行尾冗余行：空闲时即操作提示（escHint），锁定后切「当前解构：{{name}}」并经
          aria-live 播报（research §1.3 非视觉通道冗余；i18n 并合：两态共用一行） */}
      <div className="wf-lens-cap wf-anatomy-live" aria-live="polite">
        {lockedDef ? t("anatomy.lockedAria", { name: t(lockedDef.nameKey) }) : t("anatomy.escHint")}
      </div>
    </div>
  );
}
