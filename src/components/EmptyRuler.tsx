/**
 * P5 S6 空态人格化：内联 SVG「未上弦的刻度尺」（docs/p5-spec.md §3 T6）。
 * - 造型：一柄微微上仰的刻度尺 + 一段未绷直的虚线弓弦——资产未填时进度环缺席位
 *   与四处空态（情景库 / 蒙特卡洛正态与自助抽样 / 打工模拟）共用同一图形；
 * - 取色：主体走 currentColor（由宿主经 style color 注入 --wf-text-tertiary 等令牌），
 *   高亮刻度走主题令牌 --wf-primary——禁硬编码浅色（研究 §2 Empty 行深色适配注意）；
 * - 静态图形，无动画（S6 降级口径：静态图形）；装饰性 SVG 一律 aria-hidden，
 *   信息由空态文案（「缺什么——下一步」句式）承载。
 */

/** 刻度尺齿位（x 坐标，viewBox 96×64；间距均匀、末齿加长 = 「满档」意象） */
const RULER_TICKS = [14, 26, 38, 50, 62] as const;

export function EmptyRulerArt({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * (64 / 96)}
      viewBox="0 0 96 64"
      aria-hidden="true"
      focusable="false"
      style={{ color: "var(--wf-text-tertiary)", display: "block" }}
    >
      {/* 未绷直的弓弦：从尺尾垂到尺首的虚线弧（上弦前的松弛态） */}
      <path
        d="M 10 22 Q 48 54 86 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* 刻度尺本体：上仰 8° 的圆角矩形 */}
      <g transform="rotate(-8 48 40)">
        <rect
          x={8}
          y={34}
          width={80}
          height={14}
          rx={3}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
        {/* 刻度齿：短齿 currentColor、第 4 齿为主色（点亮「第一档」的邀请） */}
        {RULER_TICKS.map((x, i) => (
          <line
            key={x}
            x1={x}
            y1={i === 3 ? 34 : 38}
            x2={x}
            y2={i === 3 ? 42 : 42}
            stroke={i === 3 ? "var(--wf-primary)" : "currentColor"}
            strokeWidth={i === 3 ? 2 : 1.5}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
