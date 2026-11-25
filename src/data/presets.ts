/**
 * 预设场景数据层：4 组生活画像 + 消费构成明细。
 * 数值口径：以国家统计局居民消费支出分类及公开报告整理的一线城市参考锚点，
 * 全部可被用户自由修改；note 为简中数据口径注释（数据口径不入 i18n，见
 * src/i18n/locales/zh-CN.ts 头注释），页面上以只读提示展示。
 * 界面名称与消费构成标签文案在 i18n presets.* 键空间（见 docs/p0-spec.md §5）。
 *
 * @data-meta
 *   CHECKED_AT: 2026-11-21   // 在案台账复核列（工程整理口径；YEAR 省略）
 *   SOURCE_TYPE: engineering
 *   EXPIRY: L4（四画像内联同值：工程整理口径，仅复核提醒）
 *   SOURCE: 工程整理口径（整理算式见各画像行注释；P1–P4 见 docs/data-dictionary.md 一表）
 */
import type { BaselineInput } from "../wasm/bridge";

/** 画像预设标识（"custom" 仅为 UI 状态值，不是预设，不出现在本文件） */
export type PresetId = "single_renter" | "couple_no_kids" | "family_one_kid" | "zen_frugal";

/** 消费构成固定键集（元/月；每组合计必须等于画像的 monthlyExpense） */
export interface PresetBreakdown {
  /** 吃（餐饮食品） */
  food: number;
  /** 住（房租/房贷居住类） */
  housing: number;
  /** 行（交通） */
  transport: number;
  /** 通讯 */
  communication: number;
  /** 其他（衣着、教育文娱、医疗等） */
  other: number;
}

/** 画像预设（一键填入基础参数卡的 5 个基础字段；回报率/通胀不在预设范围） */
export interface PresetProfile {
  id: PresetId;
  baseline: Pick<
    BaselineInput,
    "monthlyExpense" | "childCount" | "costPerChild" | "healthReserve" | "majorInvestment"
  >;
  breakdown: PresetBreakdown;
  /** 简中口径注释（只读展示） */
  note: string;
}

export const PRESET_PROFILES: PresetProfile[] = [
  {
    // @data-meta CHECKED_AT=2026-11-21 SOURCE_TYPE=engineering EXPIRY=L4
    id: "single_renter",
    // 一线含房租单人口径：4500/月 = 吃 1500 + 住 2000 + 行 400 + 通讯 100 + 其他 500
    baseline: { monthlyExpense: 4500, childCount: 0, costPerChild: 580000, healthReserve: 150000, majorInvestment: 0 },
    breakdown: { food: 1500, housing: 2000, transport: 400, communication: 100, other: 500 },
    note: "以一线城市口径整理：含房租约 2,000 元/月；健康预留按单人 15 万整理。可自由修改。",
  },
  {
    // @data-meta CHECKED_AT=2026-11-21 SOURCE_TYPE=engineering EXPIRY=L4
    id: "couple_no_kids",
    // 一线含房租双人合计口径：8000/月 = 吃 2800 + 住 3500 + 行 700 + 通讯 200 + 其他 800
    baseline: { monthlyExpense: 8000, childCount: 0, costPerChild: 580000, healthReserve: 200000, majorInvestment: 0 },
    breakdown: { food: 2800, housing: 3500, transport: 700, communication: 200, other: 800 },
    note: "以一线城市口径整理：双人合计，含房租约 3,500 元/月；健康预留 20 万沿用默认双人口径。可自由修改。",
  },
  {
    // @data-meta CHECKED_AT=2026-11-21 SOURCE_TYPE=engineering EXPIRY=L4
    id: "family_one_kid",
    // 一线含房租三口口径：11000/月 = 吃 4000 + 住 4500 + 行 800 + 通讯 250 + 其他 1450
    baseline: { monthlyExpense: 11000, childCount: 1, costPerChild: 580000, healthReserve: 200000, majorInvestment: 0 },
    breakdown: { food: 4000, housing: 4500, transport: 800, communication: 250, other: 1450 },
    note: "以一线城市口径整理：三口之家，含房租约 4,500 元/月；1 孩抚养成本按 58 万整理（视频口径示例值；报告原文 0–17 岁平均 53.8 万，见面板⑨）。可自由修改。",
  },
  {
    // @data-meta CHECKED_AT=2026-11-21 SOURCE_TYPE=engineering EXPIRY=L4
    id: "zen_frugal",
    // 低线小城低欲望口径：2000/月 = 吃 900 + 住 600 + 行 150 + 通讯 50 + 其他 300
    baseline: { monthlyExpense: 2000, childCount: 0, costPerChild: 580000, healthReserve: 150000, majorInvestment: 0 },
    breakdown: { food: 900, housing: 600, transport: 150, communication: 50, other: 300 },
    note: "以低线小城低欲望口径整理：含房租约 600 元/月；健康预留按 15 万整理。可自由修改。",
  },
];
