/**
 * 数据时效元数据层（P11 §3：过期提示 UI 的数据承载）。
 *
 * 纪律（承 insights.ts:9 展示数据纪律扩展，docs/p11-spec.md §6-7）：
 * - 本文件为纯展示数据层，不入任何计算路径，不得被 src/wasm/** 引用；
 * - 全部为编译期静态登记（零自动播种：运行时零外部请求，过期提示只是静态判据比对）；
 * - 三档判据（research-p11-data-audit §3）：ok=判据未命中（零渲染，不占视觉资源）/
 *   soft=发布窗口已过未更新或落后一届等 / hard=连续两届未采值等（详情句 {{newValue}}
 *   仅在显式携带已核证新值时填充——待证与写作裁定类禁填，本轮零 hard 项）；
 * - 「复核受限」= 审计判待证项（§1 待证清单 + 税表 T6/T7/T8/T9）：无已证缺口不挂角标，
 *   清单页状态列显示「复核受限」（不编造更新值——data-dictionary §4 禁则）。
 */
import { seriesRange } from "./indexSeries";
import type { IndexSeries } from "./indexSeries";

/** 时效档位 */
export type FreshnessLevel = "ok" | "soft" | "hard";

/** 行级时效提示（面板⑨数据行按 labelKey 命中；仅登记非 ok 项——ok 零渲染纪律） */
export interface InsightFreshness {
  /** 档位（soft=灰 Tag / hard=红 Tag） */
  level: Exclude<FreshnessLevel, "ok">;
  /** 年度口径（soft/hard 详情句 {{year}}） */
  year: string;
  /** 下一发布窗口（soft 详情句 {{due}}） */
  due?: string;
  /** 最近复核日（soft 详情句 {{checked}}） */
  checked: string;
  /** hard 专用：已核证新值与发布日期（待证/写作裁定类禁填；本轮无） */
  newValue?: string;
  newDate?: string;
  /** 当前展示值（hard 详情句 {{oldValue}}） */
  oldValue?: string;
}

/**
 * 面板⑨展示数据行级时效映射（E2 假设链条 / E3 市场消费 / E4 医疗行按 labelKey 命中）。
 * 仅登记非 ok 项：本轮唯一 soft = 企业年金环（2025 年度摘要已发布在案、「自 2007 年以来
 * 平均」精确均值复核受限——缺口已证但新值未证，soft 档不填 newValue）；存款利率两环、
 * 卫生公报、育儿报告四条均为「复核受限」（无已证缺口，行内不挂角标，见 FILE_FRESHNESS）；
 * 社保环 7.62% 更新口径属写作裁定（非时效缺口），保持 ok。
 */
export const INSIGHT_FRESHNESS: Record<string, InsightFreshness> = {
  "insights.chainAnnuity": {
    level: "soft",
    year: "2007–2024",
    due: "2027-03",
    checked: "2026-11-21",
  },
};

/** E5「数据时效清单」行（文件级元组：[文件, 年度口径, 最近复核, 判据, 是否复核受限]；
 *  简中数据口径字段按 data-layer 惯例不入 i18n；年度 "—" = 工程/派生混合或零数据项；
 *  restricted=true → 状态列挂 i18n「复核受限」Tag，ok 零渲染——无缺口不占视觉资源；
 *  待证明细不入 dist（§7.3 回收登记）——承载于下方清单头注释与 docs/data-dictionary.md） */
export type FileFreshnessRow = [file: string, year: string, checked: string, expiryClass: string, restricted: boolean];

/**
 * 九文件文件级时效清单（E5 第 2 分页「数据时效清单」数据源；@data-meta 头块同源）。
 * 状态裁定（2026-11-25 判据比对，零自动播种）：
 * - insights.ts：复核受限（待证项：存款挂牌利率两环——2025-05-20 后新调整未核验；卫生公报
 *   ——2025 年度版存在性未核验；育儿报告四条——2024 版后新版未核验；企业年金「自 2007 年
 *   以来平均」精确均值——2025 年度摘要 PDF 未直读。均以在案口径展示，不编造更新值；
 *   年金环缺口已证部分由行级 soft Tag 承载）；
 * - taxTables.ts：复核受限（待证项：JP 令和8年度税改、AU 2026–27 财年、CA 2026 指数化公告、
 *   SG IRAS 官方页（YA2027 触发点 2027-02 预算案）未能核验；CN/GB 表值经审计判「已是最新」
 *   ——个税法延续、免税额冻结，year 字段落后当前税年属标注顺延，非数值缺口）；
 * - 其余七文件判据未命中（PE2/R1–R8/US 两表/DE 表 2026-11-24 采值轮、X1 2025 收宫补录、
 *   Numbeo 滚动窗口 2026-11-20 读取、汇率快照机制内）。
 */
export const FILE_FRESHNESS: FileFreshnessRow[] = [
  ["defaults.ts", "—", "2026-11-24", "L4", false],
  ["presets.ts", "—", "2026-11-21", "L4", false],
  ["pensionParams.ts", "2025", "2026-11-24", "L1·L2", false],
  ["insights.ts", "逐条", "2026-11-21", "L1·L4", true],
  ["regional.ts", "2025/2024", "2026-11-24", "L1", false],
  ["rentParams.ts", "2025/2026-11", "2026-11-20", "L3", false],
  ["taxTables.ts", "2025/2026", "2026-11-24", "L2", true],
  ["indexSeries.ts", "2005–2025", "2026-11-25", "L3", false],
  ["types.ts", "—", "—", "—", false],
];

/** 年度序列类 L3 判据的「最近已完成年度」（上年收宫 = 该年度年度值应已补录） */
const SERIES_LAST_COMPLETED_YEAR = 2025;

/** 行级时效提示（键 + 插值参数；面板渲染时 t(key, params)——数据层不做 i18n 渲染） */
export interface FreshnessHint {
  key: string;
  params: Record<string, string | number>;
}

/**
 * 序列 L3 soft 判据（research-p11-data-audit §3-L3；docs/p11-spec.md §3.2）：
 * ①年度序列类：上年收宫后 Q1 未补录年度值（range.end < 最近已完成年度）；
 * ②滚动类：fetchedAt 距今 >6 个月。
 * 命中返回 soft 详情句的键与插值（{{year}}/{{due}}/{{checked}}）；未命中返回 null
 * （ok 零渲染纪律——选择器 FieldTip 尾部不追加任何文案）。
 */
export function seriesFreshnessHint(s: IndexSeries): FreshnessHint | null {
  const { end } = seriesRange(s);
  const fetchedMs = Date.parse(`${s.fetchedAt}T00:00:00Z`);
  const stale =
    end < SERIES_LAST_COMPLETED_YEAR ||
    (Number.isFinite(fetchedMs) && Date.now() - fetchedMs > 182 * 86400000);
  return stale
    ? { key: "insights.freshnessSoftDetail", params: { year: String(end), due: "Q1", checked: s.fetchedAt } }
    : null;
}
