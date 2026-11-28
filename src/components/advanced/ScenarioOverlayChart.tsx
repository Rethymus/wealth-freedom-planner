/**
 * 情景叠影图卡（WF-04 T3；docs/wf04-spec.md §1-T3 / research-wf04-anatomy-overlay §2 承接）：
 * 基准 vs 情景资产路径双线同图。恒两线裁定（research §2.4）：基准实线挂 resolveThemeTokens
 * primary、情景虚线（strokeDasharray "6 4"，同参考线口径）按差异方向挂 rise/fall（语义色
 * 仅此一维；线型差异独立于颜色通道，▲▼ 字形冗余写入图例——S10）。
 * 坐标纪律：X 轴 = YearRow.age，以 age 对齐各成序列、短序列尾部 null 不连线
 * （connectNulls 缺省 false，无假延伸）；情景耗尽后线落 0 水平延续；图高 D5 三档 240/280/320。
 * 降档登记（wf04-spec §5.2 D2③④，升级裁决 d 强制执行）：④ 差异区间 Area 填充裁撤——
 * §6-4 首验实证 Area 组件树未在 vendor_charts 既有 chunk 内（+10,472B），门禁回收裁撤；
 * ③ 逐年差异兜底表裁撤——S25 触屏/读屏兜底由气泡 + ▲▼图例（含 depletedAt 复用标注）承担。
 * 动效：数据落定线插值 base 240ms（MOTION_DURATIONS.base）+ ease-out（既有 barAnimationProps
 * 同参数，非新曲线）；isAnimationActive 经 usePrefersReducedMotion 短路——图表内建动画
 * CSS 兜底管不住，hook 短路为唯一闸（§3 红线 4）。
 * S25 第 6 个消费图：cursor 挂 textTertiary + "3 3"，气泡复用 .wf-chart-tip（三行 =
 * 基准/情景/差值 ▲▼ 冗余）；单图不挂 syncId。
 * 数据恒 CNY 规范值入 props，图内经 convert 换算一次（与既有图表同口径，不二次换算）。
 */
import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearRow } from "../../services/finance";
import { formatCompactAxis, formatMoney } from "../../services/format";
import { MOTION_DURATIONS } from "../../data/defaults";
import type { ThemeTokens } from "../../data/types";
import { compactXInterval, useChartMetrics } from "../hooks";

/** 叠影行：age 对齐合并行（短序列一侧 null → 该行该线断开，无假延伸） */
interface OvRow {
  age: number;
  base: number | null;
  scen: number | null;
}

export default function ScenarioOverlayChart(props: {
  /** 基准路径（当前 store 六切片 calcLifecycle 输出的 timeline 引用） */
  base: YearRow[];
  /** 情景路径（decodeShareState 切片映射 calcLifecycle 输出的 timeline 引用） */
  scen: YearRow[];
  /** 情景名（图 aria 与图例冗余） */
  scenName: string;
  /** 情景路径耗尽年（≥1 时图例行加 life.depletedAt 复用标注，零新增键） */
  depletedYear: number;
  tokens: ThemeTokens;
  /** 展示币种符号（与对比表同源 useMoney().symbol） */
  symbol: string;
  /** CNY → 展示币种数值换算（rate 不可用时恒等；图数据与轴同源一次换算） */
  convert: (v: number) => number;
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const { base, scen, scenName, depletedYear, tokens, symbol, convert, reducedMotion } = props;
  /** 图高三档 / YAxis 宽 / 紧凑档（D5，与两既有折线图同 hook 同参数）。
   *  第 1 轮验收复测补档：≤480 紧档槽内图 240→160（375×667 叠影页实容 347（240 档）
   *  > 槽 299——图 160 档后 267 ≤ 299；首改 200 档实测仍超即再降一档，D5 档位扩展
   *  登记，桌面三档不变） */
  const { chartHeight, yAxisWidth, isCompact } = useChartMetrics();
  const overlayHeight = isCompact ? 160 : chartHeight;
  /** age 对齐合并（两路径 horizon / 起始年龄可不同——切片差异，以 age 为键各成序列） */
  const rows: OvRow[] = [];
  const map = new Map<number, OvRow>();
  const put = (r: YearRow, k: "base" | "scen") => {
    const e = map.get(r.age) ?? { age: r.age, base: null, scen: null };
    e[k] = convert(r.closingAssets);
    map.set(r.age, e);
  };
  base.forEach((r) => put(r, "base"));
  scen.forEach((r) => put(r, "scen"));
  map.forEach((e) => rows.push(e));
  rows.sort((a, b) => a.age - b.age);
  /** 差异方向：取末个两线齐备行的差值符号（情景线语义色 + ▲▼ 图例冗余共用） */
  let dirRise = true;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.base !== null && r.scen !== null) {
      dirRise = r.scen - r.base >= 0;
      break;
    }
  }
  const scenColor = dirRise ? tokens.rise : tokens.fall;
  /** 数据落定线插值：base 240ms + ease-out（既有 barAnimationProps 同参数，非新曲线） */
  const anim = {
    isAnimationActive: !reducedMotion,
    animationDuration: MOTION_DURATIONS.base,
    animationEasing: "ease-out",
  } as const;
  const fmt = (v: number | null) => (v === null ? "—" : formatMoney(v, symbol));

  const renderTip = (): ReactElement => (
    <Tooltip
      cursor={{ stroke: tokens.textTertiary, strokeDasharray: "3 3" }}
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const row = payload[0]?.payload as OvRow | undefined;
        if (!row || (row.base === null && row.scen === null)) return null;
        const d = row.base !== null && row.scen !== null ? row.scen - row.base : null;
        return (
          <div className="wf-chart-tip">
            <div className="wf-chart-tip-label">{row.age}</div>
            <div className="wf-chart-tip-row">
              <span>{t("scenario.overlayLegendBase")}</span>
              <span className="wf-chart-tip-value">{fmt(row.base)}</span>
            </div>
            <div className="wf-chart-tip-row">
              <span>{t("scenario.overlayLegendScenario")}</span>
              <span className="wf-chart-tip-value">{fmt(row.scen)}</span>
            </div>
            <div className="wf-chart-tip-row">
              <span>{d === null ? "—" : d >= 0 ? "▲" : "▼"}</span>
              <span className="wf-chart-tip-value">{d === null ? "—" : fmt(Math.abs(d))}</span>
            </div>
          </div>
        );
      }}
    />
  );

  return (
    <div>
      <div role="img" aria-label={t("scenario.overlayChartAria", { name: scenName })}>
        <ResponsiveContainer width="100%" height={overlayHeight}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            {renderTip()}
            <CartesianGrid stroke={tokens.chartGrid} vertical={false} />
            {/* 紧凑档（<640）X 刻度 ≤5：interval 按叠影行数推导（compactXInterval 同式） */}
            <XAxis
              dataKey="age"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: tokens.chartTick }}
              interval={isCompact ? compactXInterval(rows.length) : undefined}
            />
            <YAxis
              width={yAxisWidth}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: tokens.chartTick }}
              tickFormatter={(v: number) => formatCompactAxis(v)}
            />
            <Line dataKey="base" stroke={tokens.primary} strokeWidth={2} dot={false} {...anim} />
            <Line dataKey="scen" stroke={scenColor} strokeWidth={2} strokeDasharray="6 4" dot={false} {...anim} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* S25 兜底（D2③ 降档后形态）：图例 ▲▼ 冗余 + depletedAt 复用标注；触屏/读屏
          经 role="img" aria 与气泡外文案兜底（逐年差异表已裁，§5.2 D2③） */}
      <div className="wf-ov-legend">
        <span className="wf-lens-cap">
          <span className="wf-ov-swatch" style={{ background: tokens.primary }} />
          {t("scenario.overlayLegendBase")}
        </span>
        <span className="wf-lens-cap">
          <span className="wf-ov-swatch wf-ov-dash" style={{ borderColor: scenColor }} />
          {t("scenario.overlayLegendScenario")} {dirRise ? "▲" : "▼"}
        </span>
        {depletedYear >= 1 ? <span className="wf-lens-cap">{t("life.depletedAt", { year: depletedYear })}</span> : null}
      </div>
    </div>
  );
}
