/**
 * 时间透镜（WF-04 T1；docs/wf04-spec.md §1-T1 / research-wf04-lens §1 全量承接）：
 * 自研刻度轨（div role="slider" + tabIndex=0，44px 命中高）＋常驻逐年读数面板，
 * 由 LifeTrajectoryCard 渲染于 Descriptions 之后（嵌入裁定，research §2.1）。
 * 读数 = timeline[y−1] 纯内存数组索引（props 与宿主持有同一数组引用）——拖动全程
 * 零 calc* 调用、零 wasm 触发（wf04-spec §3 红线 1）；里程碑标记 = summary 派生
 * 字段静态渲染（形状通道独立于颜色，S10 同构纪律）。
 * 零动效设计（research §3.1）：面板常驻无显隐过渡、thumb 位移为 pointer 直接操纵、
 * 数值即时替换、拖动反馈自始静态高亮——两模式行为一致、零降级分支；
 * 不引入 usePrefersReducedMotion（零多余 matchMedia）。
 * 监听器纪律（wf04-spec §3 红线 3）：pointer 全走 React 合成事件 + setPointerCapture
 * （capture 保证拖出轨区后 move 仍派发），pointercancel 与 pointerup 由浏览器自动
 * 释放 capture（落定无额外动作，research §1.5），零手动全局监听。
 * thumb / 刻度 / 里程碑定位纯 CSS 百分比 + 端内距（零 getBoundingClientRect /
 * ResizeObserver / addEventListener / matchMedia——偏离登记条款零命中）；
 * len===1 时 frac 写死 0（除零防御）。键盘 ←/→ 1 岁、PgUp/PgDn 5 岁、Home/End
 * 首尾、钳 [1, len]；数字键不消费原样冒泡（App 端 role="slider" 豁免，§2-S21）。
 */
import { useState } from "react";
import { Tag, Typography } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import type { YearRow } from "../../services/finance";
import { compactXInterval } from "../hooks";

const { Text } = Typography;

/** 轨端内距 px（--wf-space-4 现值；seek 映射与 thumb/刻度/里程碑定位共用同一坐标系） */
const TRACK_INSET = 16;

interface LifeLensTrackProps {
  /** 宿主 LifeTrajectoryCard 持有的同一 timeline 数组引用（零复制、零新调用） */
  timeline: YearRow[];
  /** FI 首达年（summary 派生；≥1 渲染空心点） */
  fiFirstYear: number;
  /** 耗尽年（summary 派生；≥1 渲染 fall 色竖线） */
  depletedYear: number;
  /** 金额展示绑定（宿主同源 useMoney().money，展示币种换算同卡面口径） */
  money: (v: number) => string;
}

export default function LifeLensTrack({ timeline, fiFirstYear, depletedYear, money }: LifeLensTrackProps) {
  const { t } = useTranslation();
  const [sel, setSel] = useState(1);
  const len = timeline.length;
  /** 重算落定后钳制不重置（research §2.2）：显示与键位一律经钳制值，state 原值保留——
      TaskPages 六组 hidden 非卸载，切组回来选中年仍在 */
  const y = Math.min(sel, len);
  const row = timeline[y - 1];
  const afterDepleted = depletedYear >= 1 && y > depletedYear;
  const psIdx = timeline.findIndex((r) => r.pensionStart);
  /** thumb / 刻度 / 里程碑共用定位式：端内距 + 纯百分比（len===1 → frac 0 除零防御） */
  const posStyle = (f: number): CSSProperties => ({
    left: `calc(${TRACK_INSET}px + ${f} * (100% - ${TRACK_INSET * 2}px))`,
  });
  const frac = len > 1 ? (y - 1) / (len - 1) : 0;
  /** 逐行读法：aria-valuetext 与面板旁注同一模板（i18n 并合：lensYearNo 由本模板承载） */
  const reading = row
    ? t("life.lensValueText", { year: row.year, age: row.age, value: money(row.closingAssets) })
    : "";
  /** 主刻度标签 ≤5（compactXInterval 同式：步长 = ceil(len/5)，标签数 ≤5，D5 全档适用） */
  const tickStep = compactXInterval(len) + 1;
  /** P9 事件标记（p9-spec §5.5；全部 aria-hidden，读法由轨 valuetext ＋读数卡事件轴
   *  aria 汇总行承载——形状通道独立于颜色，S10 同构纪律延续）：
   *  homePurchase = 实心菱形（单年）；childBirth = 区间带（出生→＋17 行）；healthPhase =
   *  区间带（起→止，双高变体区分）。区间带 = 按 kind 从 timeline 逐行 events[] 提取
   *  连续段（段断裂即分段渲染）；数量受 events ≤ 20 上限自然受限，重叠区间纵向共用
   *  轨区（不裁剪——登记：多段重叠靠双高差辨认，视觉不可辨为可接受边界，无降级分支） */
  const bandSegs = (kind: "childBirth" | "healthPhase"): Array<{ from: number; to: number }> => {
    const segs: Array<{ from: number; to: number }> = [];
    let cur: { from: number; to: number } | null = null;
    timeline.forEach((r, i) => {
      if (r.events.some((e) => e.kind === kind)) {
        if (cur !== null && cur.to === i - 1) cur.to = i;
        else {
          cur = { from: i, to: i };
          segs.push(cur);
        }
      } else {
        cur = null;
      }
    });
    return segs;
  };
  const childSegs = bandSegs("childBirth");
  const healthSegs = bandSegs("healthPhase");
  const homeIdx: number[] = [];
  timeline.forEach((r, i) => {
    if (r.events.some((e) => e.kind === "homePurchase")) homeIdx.push(i);
  });
  /** 区间带定位：端内距 + 纯百分比（同 posStyle 坐标系；宽度 = 段长 × 单位宽） */
  const bandStyle = (s: { from: number; to: number }): CSSProperties => ({
    left: `calc(${TRACK_INSET}px + ${s.from} * ((100% - ${TRACK_INSET * 2}px) / ${len - 1}))`,
    width: len > 1 ? `calc((${s.to - s.from}) * ((100% - ${TRACK_INSET * 2}px) / ${len - 1}))` : 0,
  });

  const clamp = (v: number) => Math.min(len, Math.max(1, v));
  /** S21 裁定 b：方向键族消费并 stopPropagation（防容器级键位误触）；数字键不消费、
      原样冒泡（豁免由 App 端判定——wf04-spec §2-S21 裁定 a） */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const next =
      k === "ArrowLeft" ? y - 1
      : k === "ArrowRight" ? y + 1
      : k === "PageUp" ? y - 5
      : k === "PageDown" ? y + 5
      : k === "Home" ? 1
      : k === "End" ? len
      : null;
    if (next !== null) {
      e.stopPropagation();
      e.preventDefault();
      setSel(clamp(next));
    }
  };
  /** 吸附最近年：offsetX（padding 边坐标系，子元素全部 pointer-events:none 恒落于轨本体）
      ÷ clientWidth——零测量设计（无 getBoundingClientRect） */
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const span = e.currentTarget.clientWidth - TRACK_INSET * 2;
    const f = span > 0 ? (e.nativeEvent.offsetX - TRACK_INSET) / span : 0;
    setSel(clamp(Math.round(Math.min(1, Math.max(0, f)) * (len - 1)) + 1));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(e);
  };
  /** 拖动跟手：capture 期间 move 恒派发；buttons 位掩码滤掉无按键 hover */
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) seek(e);
  };

  return (
    <div>
      <Text type="secondary" className="wf-lens-cap">
        {t("life.lensLabel")}
      </Text>
      <div
        className="wf-lens-track"
        role="slider"
        tabIndex={0}
        aria-label={t("life.lensLabel")}
        aria-valuemin={1}
        aria-valuemax={len}
        aria-valuenow={y}
        aria-valuetext={reading}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <span className="wf-lens-line" aria-hidden />
        {/* 里程碑标记（形状通道独立于颜色，S10 同构）：养老金起领实心点 / FI 首达空心点 /
            耗尽年 fall 色竖线；读法由轨 valuetext + 既有标记轴 aria 行承载，全部 aria-hidden */}
        {psIdx >= 0 ? (
          <span
            className={y - 1 === psIdx ? "wf-lens-dot wf-lens-on" : "wf-lens-dot"}
            style={posStyle(len > 1 ? psIdx / (len - 1) : 0)}
            aria-hidden
          />
        ) : null}
        {fiFirstYear >= 1 ? (
          <span
            className={y - 1 === fiFirstYear - 1 ? "wf-lens-dot-o wf-lens-on" : "wf-lens-dot-o"}
            style={posStyle(len > 1 ? (fiFirstYear - 1) / (len - 1) : 0)}
            aria-hidden
          />
        ) : null}
        {depletedYear >= 1 ? (
          <span
            className="wf-lens-bar"
            style={posStyle(len > 1 ? (depletedYear - 1) / (len - 1) : 0)}
            aria-hidden
          />
        ) : null}
        {/* P9 事件标记（≤3 新形状，全部 aria-hidden）：实心菱形 / 区间带双高变体 */}
        {homeIdx.map((i) => (
          <span key={`h${i}`} className="wf-lens-diamond" style={posStyle(len > 1 ? i / (len - 1) : 0)} aria-hidden />
        ))}
        {childSegs.map((s, k) => (
          <span key={`c${k}`} className="wf-lens-band" style={bandStyle(s)} aria-hidden />
        ))}
        {healthSegs.map((s, k) => (
          <span key={`p${k}`} className="wf-lens-band wf-lens-band-health" style={bandStyle(s)} aria-hidden />
        ))}
        <span className="wf-lens-thumb" style={posStyle(frac)} aria-hidden />
      </div>
      {/* 刻度标签行：主刻度 ≤5，与轨同一坐标系（同端内距 + 纯百分比） */}
      <div className="wf-lens-ticks" aria-hidden>
        {timeline.map((r, i) =>
          i % tickStep === 0 ? (
            <span key={r.year} className="wf-lens-cap wf-lens-tick" style={posStyle(len > 1 ? i / (len - 1) : 0)}>
              {r.year}
            </span>
          ) : null,
        )}
      </div>
      {/* 常驻读数面板（非浮层——固定面板天然消除手指遮挡，research §1.4 适配登记） */}
      <div className="wf-lens-panel">
        <div className="wf-lens-reading">
          <span className="wf-lens-age">{row ? row.age : "—"}</span>
          <Text type="secondary" className="wf-lens-cap">
            {reading}
          </Text>
        </div>
        <div className="wf-lens-fields">
          <div>
            <div className="wf-lens-cap">{t("life.lensWithdrawal")}</div>
            <div>{row ? money(row.withdrawal) : "—"}</div>
          </div>
          <div>
            <div className="wf-lens-cap">{t("life.lensClosing")}</div>
            <Text bold>{row ? money(row.closingAssets) : "—"}</Text>
          </div>
        </div>
        {afterDepleted ? (
          <Text type="secondary" className="wf-lens-cap wf-lens-status">
            {t("life.lensAfterDepleted")}
          </Text>
        ) : null}
        {row?.pensionStart ? <Tag size="small">{t("life.pensionStartMark")}</Tag> : null}
        {/* P9 逐年事件 Tag 行（pensionStart Tag 先例延伸）：选中行 events[] 逐条 mark 文案 */}
        {row?.events.map((ev, i) => (
          <Tag key={`${ev.kind}-${i}`} size="small">
            {ev.kind === "homePurchase"
              ? t("life.eventMarkHome", { year: ev.year })
              : ev.kind === "childBirth"
                ? t("life.eventMarkChild", { year: ev.year })
                : t("life.eventMarkHealth", { year: ev.year })}
          </Tag>
        ))}
      </div>
    </div>
  );
}
