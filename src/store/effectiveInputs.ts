/**
 * 共享参数单源化有效输入派生（P10fix §3.2；docs/p10fix-spec.md §3 全量普查 14 字段）。
 *
 * 纯函数模块：零 React / zustand / DOM / 存储依赖（Node 可直载——scripts/
 * check-param-sync.mjs 的前置条件，§6.1）。单源化全部是 UI 显示层派生锁定
 * （§8 红线 1）：锁态（组级布尔标志 true，store businessDefaults 默认值）下显示层
 * 取核心参数（freedom 输入卡 baseline 切片）派生直显、运行提交帧同帧解析覆盖，
 * 零面板切片写入；解锁 = 显式动作，同时把当刻核心值落入面板切片（unlock*Patch
 * 快照函数，消除「解锁即见旧值」错位——mcMeansSynced unlockMeans 五要素模板
 * ③，useCalculatorStore / MonteCarloPanel 先例同构）。
 *
 * 派生口径（§3.2 表）：
 * - effectiveReverse：childReserve = childCount × costPerChild（childCount = 0 → 0，
 *   字段恒在不隐藏）；healthReserve / majorInvestment / nominalReturnPct /
 *   inflationPct 直取 baseline 同名值（普查 #1–#5 = 原手动同步钮集合）。
 * - effectiveMonteCarlo：annualSpend = monthlyExpense × 12（普查 #10，收编
 *   MonteCarloPanel 内联派生式）；两均值同 mcMeansSynced 机制（普查 #11/#12）。
 * - effectiveAccumulationSim：monthlyExpense 直取 baseline（普查 #6）；两均值同上
 *   （普查 #8/#9）。targetValue 联动（普查 #7 accumulationTargetSynced）不迁移、
 *   本模块零触碰；currentAssets（普查 #13/#14）裁定不联动——自由刻度已有资产带
 *   0=未填写哨兵语义（defaults.ts PROGRESS_DEFAULTS、进度环隐藏口径），联动会把
 *   哨兵 0 传入模拟初始资产，语义异名不属重复。
 */
import type {
  AccumulationInput,
  BaselineInput,
  MonteCarloInput,
  ReverseEstimateInput,
} from "../wasm/bridge";

/** effectiveReverse 的锁定态覆盖集（五重复字段；totalAssets 不在其中——非重复字段） */
export type ReverseSyncPatch = Pick<
  ReverseEstimateInput,
  "childReserve" | "healthReserve" | "majorInvestment" | "nominalReturnPct" | "inflationPct"
>;

/** 解锁快照：当刻核心值落 reverse 切片（unlockMeans 语义同构③） */
export function reverseUnlockPatch(baseline: BaselineInput): ReverseSyncPatch {
  return {
    childReserve: baseline.childCount * baseline.costPerChild,
    healthReserve: baseline.healthReserve,
    majorInvestment: baseline.majorInvestment,
    nominalReturnPct: baseline.nominalReturnPct,
    inflationPct: baseline.inflationPct,
  };
}

/** 反向估算有效输入：reverseSynced = true → 五字段取 baseline 派生直显；false → 切片原值 */
export function effectiveReverse(
  reverse: ReverseEstimateInput,
  baseline: BaselineInput,
  reverseSynced: boolean,
): ReverseEstimateInput {
  if (!reverseSynced) return reverse;
  return { ...reverse, ...reverseUnlockPatch(baseline) };
}

/** MC 有效输入选项：means = mcMeansSynced（普查 #11/#12）、spend = mcSpendSynced（普查 #10） */
export interface MonteCarloSyncOptions {
  means: boolean;
  spend: boolean;
}

/** 蒙特卡洛有效输入：锁定键取 baseline 派生；未锁定键保持面板切片原值（互不覆盖）。
 *  P10fix 尺寸门禁降档登记（§9.2 ① 同类）：MC/Acc 的解锁快照补丁不设模块导出——
 *  解锁 handler 内联当刻核心值字面量（MC unlockMeans 为 P10 既有内联式原样保留），
 *  模块仅保留 reverseUnlockPatch（反向五字段派生算式唯一、禁两处重推）。 */
export function effectiveMonteCarlo(
  mc: MonteCarloInput,
  baseline: BaselineInput,
  opts: MonteCarloSyncOptions,
): MonteCarloInput {
  let out = mc;
  if (opts.spend) out = { ...out, annualSpend: baseline.monthlyExpense * 12 };
  if (opts.means) {
    out = { ...out, nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct };
  }
  return out;
}

/** 打工积累有效输入选项：expense = accExpenseSynced（普查 #6）、means = accMeansSynced（普查 #8/#9） */
export interface AccumulationSyncOptions {
  expense: boolean;
  means: boolean;
}

/** 打工积累有效输入：锁定键取 baseline 派生；targetValue / currentAssets 不在耦合集
 *  （普查 #7 不迁移零变化、#14 不联动裁定——本函数输出对两键恒等直通） */
export function effectiveAccumulationSim(
  acc: AccumulationInput,
  baseline: BaselineInput,
  opts: AccumulationSyncOptions,
): AccumulationInput {
  let out = acc;
  if (opts.expense) out = { ...out, monthlyExpense: baseline.monthlyExpense };
  if (opts.means) {
    out = { ...out, nominalReturnMeanPct: baseline.nominalReturnPct, inflationMeanPct: baseline.inflationPct };
  }
  return out;
}
