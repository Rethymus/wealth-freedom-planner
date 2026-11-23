/**
 * 全局计算器状态（zustand）。
 * 各高级面板输入初值均引用 src/data/defaults.ts，避免双处维护默认值。
 */
import { create } from "zustand";
import {
  ACCUMULATION_DEFAULTS,
  BASELINE_DEFAULTS,
  LOAN_DEFAULTS,
  MONTE_CARLO_DEFAULTS,
  PENSION_DEFAULTS,
  PROGRESS_DEFAULTS,
  RENTAL_DEFAULTS,
  REVERSE_ESTIMATE_DEFAULTS,
  TAX_ESTIMATE_DEFAULTS,
  THEME_STORAGE_KEY,
  PREFS_STORAGE_KEY,
  readInitialTheme,
  readInitialPrefs,
} from "../data/defaults";
import type { ProgressInputs, ThemeMode } from "../data/defaults";
import type { PensionInputs } from "../data/pensionParams";
import { effectiveMonthsDivisor } from "../data/pensionParams";
import type { IndexId, MonteCarloReturnMode } from "../data/indexSeries";
import { PRESET_PROFILES } from "../data/presets";
import type { PresetId } from "../data/presets";
import { decodeShareState } from "../services/share";
import type { ShareState } from "../services/share";
import type { LifeEventInput } from "../services/finance";
import type {
  AccumulationInput,
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  RentalAnalysisInput,
  ReverseEstimateInput,
} from "../wasm/bridge";

/** 主题模式（浅色 / 深色；定义于 defaults.ts——readInitialTheme 与 resolveThemeTokens
 * 以它为签名，此处重导出作为 store 状态的外部键，保持单一事实来源） */
export type { ThemeMode };

/** 显式主题切换持久化：只有显式切换动作写入 localStorage；系统推导出的初始值不落盘
 * （未做选择前每次访问仍跟随系统偏好，设计规范 2.11）。存储不可用时静默——仅影响下次访问 */
function persistTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* 忽略持久化失败（主题仍在当前会话生效） */
  }
}

/** 界面偏好（展示币种 + 色盲友好开关）持久化：与 persistTheme 同口径——只有显式选择
 * 动作（切换币种 / 切换开关 / 恢复默认）写入 localStorage。存储不可用时静默——仅影响下次访问 */
function persistPrefs(currency: CurrencySetting, colorBlindFriendly: boolean): void {
  try {
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ display: currency.display, colorBlindFriendly }),
    );
  } catch {
    /* 忽略持久化失败（偏好仍在当前会话生效） */
  }
}

/** 币种设置 */
export interface CurrencySetting {
  /** 计价基准币种（输入金额所属币种，ISO 4217） */
  base: string;
  /** 展示换算币种（ISO 4217） */
  display: string;
}

interface CalculatorState {
  /** 基础计算输入（480 法则） */
  baselineInputs: BaselineInput;
  /** 当前生效的画像预设；"custom" = 用户手动修改过任一基础字段 */
  activePresetId: PresetId | "custom";
  /** 自由刻度输入（currentAssets = 0 视为未填写，进度环隐藏） */
  progressInputs: ProgressInputs;
  /** 反向估算面板输入 */
  reverseInputs: ReverseEstimateInput;
  /** 贷款测算面板输入 */
  loanInputs: AmortizeInput;
  /** 买房收租面板输入 */
  rentalInputs: RentalAnalysisInput;
  /** 蒙特卡洛面板输入 */
  monteCarloInputs: MonteCarloInput;
  /** 税务估算面板输入 */
  taxInputs: EstimateTaxInput;
  /** 打工积累模拟面板输入 */
  accumulationInputs: AccumulationInput;
  /** 目标值是否与基础模式临界值实时联动（手动修改目标值即置 false） */
  accumulationTargetSynced: boolean;
  /** 社保养老金面板输入 */
  pensionInputs: PensionInputs;
  /** P9 人生事件切片（显式增删改、零自动播种——写入路径白名单恰五处：本三动作 +
   *  applyShareState（v5 载荷）+ businessDefaults 回落空数组；applyPreset / clearPreset
   *  不触碰事件，docs/p9-spec.md §1.5 零播种铁律） */
  lifeEvents: LifeEventInput[];
  /** 添加一条人生事件（id 由调用方生成，scenarios.ts:96 先例同式） */
  addLifeEvent: (ev: LifeEventInput) => void;
  /** 按 id 局部更新一条人生事件 */
  updateLifeEvent: (id: string, patch: Partial<LifeEventInput>) => void;
  /** 按 id 删除一条人生事件 */
  removeLifeEvent: (id: string) => void;
  setPensionInputs: (patch: Partial<PensionInputs>) => void;
  /** 计发月数是否与退休年龄联动对照表（手动修改即置 false） */
  pensionMonthsSynced: boolean;
  setPensionMonthsSynced: (v: boolean) => void;
  /** 蒙特卡洛收益模式（正态参数 / 历史自助抽样；业务口径，随分享链接携带） */
  monteCarloReturnMode: MonteCarloReturnMode;
  setMonteCarloReturnMode: (v: MonteCarloReturnMode) => void;
  /** 自助抽样收益序列选择 */
  monteCarloSeriesId: IndexId;
  setMonteCarloSeriesId: (v: IndexId) => void;
  /** 币种设置 */
  currency: CurrencySetting;
  /** 色盲友好模式（开启后涨跌语义色替换为 Okabe–Ito 蓝/橙） */
  colorBlindFriendly: boolean;
  /** P7/P0-3 一次性提示（瞬态，不入 share 载荷 / 不入情景存档 / resetEpoch 语义不变）：
   *  旧链接或外来载荷携带正名前的支取策略名 inflation_uplift、解码端已并入 fixed 时置位；
   *  关闭提示或切换策略即清除 */
  strategyLegacyNotice: boolean;
  clearStrategyLegacyNotice: () => void;
  /** 业务输入重置纪元：损坏分享链接回落默认时递增，组件以 key 重挂载刷新
   *  Arco InputNumber 在用户编辑后不跟随受控值的内部态（见验收 P1-2/Q3-2） */
  resetEpoch: number;
  /** 主题（已解析两态值：无存储首访跟随系统偏好，显式切换后持久化值优先；
   * 运行期间不监听操作系统级切换——不做 "system" 三态的取舍见设计规范 2.11） */
  theme: ThemeMode;

  setBaselineInputs: (patch: Partial<BaselineInput>) => void;
  /** 应用画像预设：以 presets.ts 的 5 个基础字段整体覆盖 baselineInputs 对应键 */
  applyPreset: (id: PresetId) => void;
  /** 取消画像：5 个画像覆盖字段整体回落 BASELINE_DEFAULTS，activePresetId 回 "custom"。 */
  clearPreset: () => void;
  setProgressInputs: (patch: Partial<ProgressInputs>) => void;
  setReverseInputs: (patch: Partial<ReverseEstimateInput>) => void;
  setLoanInputs: (patch: Partial<AmortizeInput>) => void;
  setRentalInputs: (patch: Partial<RentalAnalysisInput>) => void;
  setMonteCarloInputs: (patch: Partial<MonteCarloInput>) => void;
  setTaxInputs: (patch: Partial<EstimateTaxInput>) => void;
  setAccumulationInputs: (patch: Partial<AccumulationInput>) => void;
  setAccumulationTargetSynced: (v: boolean) => void;
  setCurrency: (patch: Partial<CurrencySetting>) => void;
  toggleColorBlindFriendly: () => void;
  /** 显式设置主题并持久化（UI 偏好；resetAll 不重置主题） */
  setTheme: (theme: ThemeMode) => void;
  /** 翻转主题并持久化 */
  toggleTheme: () => void;
  /** 从分享 hash 恢复全部业务输入切片；payload 非法/版本不符时不动任何切片并返回 false */
  applyShareState: (hash: string) => boolean;
  /** 装配当前全部业务输入为分享切片（docs/p2-spec.md §4.3：BasicCalculator 内联装配
   *  原样上移为 store 方法，分享按钮与场景库保存共用；含 effectiveMonthsDivisor 联动口径） */
  buildShareState: () => ShareState;
  /** 恢复全部默认值 */
  resetAll: () => void;
  /** 业务输入切片恢复默认（不含币种 / 色盲开关等界面偏好）：同文档粘贴损坏分享链接时回落默认 */
  resetBusinessInputs: () => void;
}

/** 业务输入默认值工厂：初始态 / resetAll / resetBusinessInputs 三处共用同一份清单防漂移；
 * 每次调用产生全新嵌套对象（zustand 状态不可变替换，不得共享嵌套引用）。
 * 不含界面偏好（币种 / 色盲开关）——它们是持久化偏好，不随业务重置走 */
function businessDefaults() {
  return {
    baselineInputs: { ...BASELINE_DEFAULTS },
    activePresetId: "custom" as PresetId | "custom",
    progressInputs: { ...PROGRESS_DEFAULTS },
    reverseInputs: { ...REVERSE_ESTIMATE_DEFAULTS },
    loanInputs: { ...LOAN_DEFAULTS },
    rentalInputs: { ...RENTAL_DEFAULTS },
    monteCarloInputs: { ...MONTE_CARLO_DEFAULTS },
    taxInputs: { ...TAX_ESTIMATE_DEFAULTS },
    accumulationInputs: { ...ACCUMULATION_DEFAULTS },
    accumulationTargetSynced: true,
    pensionInputs: { ...PENSION_DEFAULTS },
    // P9 事件切片：恒空数组（零自动播种铁律——无示例事件、无演示数据、无「帮你填一条」）
    lifeEvents: [],
    pensionMonthsSynced: true,
    monteCarloReturnMode: "normal" as MonteCarloReturnMode,
    monteCarloSeriesId: "csi300" as IndexId,
    strategyLegacyNotice: false,
  };
}

/** 币种默认值：初始态与 resetAll 共用，防两处字面量漂移（base 固定 CNY，仅展示币种可换） */
const DEFAULT_CURRENCY: CurrencySetting = { base: "CNY", display: "CNY" };

/** 界面偏好初始值：只在模块加载时读一次存储（展示币种 + 色盲友好开关，均带合法性校验） */
const initialPrefs = readInitialPrefs();

export const useCalculatorStore = create<CalculatorState>()((set, get) => ({
  ...businessDefaults(),
  currency: { ...DEFAULT_CURRENCY, display: initialPrefs.display },
  colorBlindFriendly: initialPrefs.colorBlindFriendly,
  resetEpoch: 0,
  theme: readInitialTheme(), // 两态 + 系统初始值（存储命中即用，否则 matchMedia 推导一次）

  // 任何经字段 onChange 的写入都切回「自定义」；只有 applyPreset 整体写入才标记对应画像
  setBaselineInputs: (patch) =>
    set((state) => ({
      baselineInputs: { ...state.baselineInputs, ...patch },
      activePresetId: "custom",
    })),
  applyPreset: (id) =>
    set((state) => {
      const profile = PRESET_PROFILES.find((p) => p.id === id);
      if (!profile) return {};
      return {
        baselineInputs: { ...state.baselineInputs, ...profile.baseline },
        activePresetId: id,
        // 外部整体写入 bump resetEpoch：强制重挂载受 Arco InputNumber 受控回写缺陷
        // 影响的字段（用户编辑后内部文本不再跟随受控值）——p4-spec §14.10 备案落实
        // （验收 T2-1 复现：预设应用后字段显示冻结于末次键入值）
        resetEpoch: state.resetEpoch + 1,
      };
    }),
  /** 取消画像：5 个画像覆盖字段整体回落 BASELINE_DEFAULTS，activePresetId 回 "custom"。
   *  nominalReturnPct / inflationPct 不在画像覆盖范围，保持当前值不动；progressInputs
   *  等其他切片不动。与 applyPreset 同为整体写入语义：预设写入是覆盖，取消就是回退。
   *  回落默认值（而非保留当前值）的理由：①「自定义」Tag 与数值真实一致（状态标签诚实）；
   *  ② 与 resetAll 的基础字段终态、新访客默认态三者同值（终态可预期）；
   *  ③ 画像写入 = 5 字段整体覆盖 → 取消 = 5 字段整体回退（语义对称）。
   *  bump resetEpoch（p4-spec §14.10 备案一行，验收 T2-1 复现后落实）：外部整体写入
   *  需重挂载字段以刷新组件库 InputNumber 编辑后不跟随受控值的内部态。 */
  clearPreset: () =>
    set((state) => ({
      baselineInputs: {
        ...state.baselineInputs,
        monthlyExpense: BASELINE_DEFAULTS.monthlyExpense,
        childCount: BASELINE_DEFAULTS.childCount,
        costPerChild: BASELINE_DEFAULTS.costPerChild,
        healthReserve: BASELINE_DEFAULTS.healthReserve,
        majorInvestment: BASELINE_DEFAULTS.majorInvestment,
      },
      activePresetId: "custom" as const,
      resetEpoch: state.resetEpoch + 1,
    })),
  setProgressInputs: (patch) =>
    set((state) => ({ progressInputs: { ...state.progressInputs, ...patch } })),
  setReverseInputs: (patch) =>
    set((state) => ({ reverseInputs: { ...state.reverseInputs, ...patch } })),
  setLoanInputs: (patch) =>
    set((state) => ({ loanInputs: { ...state.loanInputs, ...patch } })),
  setRentalInputs: (patch) =>
    set((state) => ({ rentalInputs: { ...state.rentalInputs, ...patch } })),
  setMonteCarloInputs: (patch) =>
    set((state) => ({ monteCarloInputs: { ...state.monteCarloInputs, ...patch } })),
  setTaxInputs: (patch) =>
    set((state) => ({ taxInputs: { ...state.taxInputs, ...patch } })),
  setAccumulationInputs: (patch) =>
    set((state) => ({ accumulationInputs: { ...state.accumulationInputs, ...patch } })),
  setAccumulationTargetSynced: (v) => set({ accumulationTargetSynced: v }),
  setPensionInputs: (patch) =>
    set((state) => ({ pensionInputs: { ...state.pensionInputs, ...patch } })),
  // P9 人生事件三动作（零自动播种白名单内的写入路径；事件属业务输入切片，
  // resetAll / resetBusinessInputs 经 businessDefaults() 回落空数组）
  addLifeEvent: (ev) => set((state) => ({ lifeEvents: [...state.lifeEvents, ev] })),
  updateLifeEvent: (id, patch) =>
    set((state) => ({
      lifeEvents: state.lifeEvents.map((e) => (e.id === id ? ({ ...e, ...patch } as LifeEventInput) : e)),
    })),
  removeLifeEvent: (id) =>
    set((state) => ({ lifeEvents: state.lifeEvents.filter((e) => e.id !== id) })),
  setPensionMonthsSynced: (v) => set({ pensionMonthsSynced: v }),
  setMonteCarloReturnMode: (v) => set({ monteCarloReturnMode: v }),
  setMonteCarloSeriesId: (v) => set({ monteCarloSeriesId: v }),
  clearStrategyLegacyNotice: () => set({ strategyLegacyNotice: false }),
  setCurrency: (patch) =>
    set((state) => {
      const currency = { ...state.currency, ...patch };
      persistPrefs(currency, state.colorBlindFriendly);
      return { currency };
    }),
  toggleColorBlindFriendly: () =>
    set((state) => {
      const colorBlindFriendly = !state.colorBlindFriendly;
      persistPrefs(state.currency, colorBlindFriendly);
      return { colorBlindFriendly };
    }),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next: ThemeMode = state.theme === "dark" ? "light" : "dark";
      persistTheme(next);
      return { theme: next };
    }),
  applyShareState: (hash) => {
    // P7：decodeShareState 返回 DecodeResult { state, strategyNormalizedFromLegacy }——
    // state 为恢复切片；规范化信号仅置瞬态标志（不入载荷 / 不入存档、resetEpoch 不变）
    const decoded = decodeShareState(hash);
    if (!decoded) return false;
    set({
      baselineInputs: decoded.state.baseline,
      activePresetId: "custom", // 画像 id 非业务输入，不随链接恢复
      reverseInputs: decoded.state.reverse,
      loanInputs: decoded.state.loan,
      rentalInputs: decoded.state.rental,
      monteCarloInputs: decoded.state.monteCarlo,
      monteCarloReturnMode: decoded.state.monteCarloReturnMode,
      monteCarloSeriesId: decoded.state.monteCarloSeriesId,
      taxInputs: decoded.state.tax,
      accumulationInputs: decoded.state.accumulation,
      accumulationTargetSynced: false, // 目标值以链接携带的原值呈现，不联动
      progressInputs: { currentAssets: decoded.state.progressCurrentAssets },
      pensionInputs: decoded.state.pension,
      // P9 v5 载荷：事件切片随分享整体恢复（缺键/形状不符由 decode 整体 null 拒绝，
      // 禁止部分恢复——share.ts:12-13 纪律）
      lifeEvents: decoded.state.lifeEvents,
      pensionMonthsSynced: false,
      strategyLegacyNotice: decoded.strategyNormalizedFromLegacy,
    });
    return true;
  },
  // 分享切片装配（原 BasicCalculator 内联逻辑上移，行为不变）：
  // 联动态的计发月数以面板所见表值入链（发送方所见 = 接收方所得，验收 Q3-3）；
  // 口径与 PensionPanel 的 effectiveMonths 同一函数，禁止两处内联重推
  buildShareState: () => {
    const s = get();
    return {
      baseline: s.baselineInputs,
      reverse: s.reverseInputs,
      loan: s.loanInputs,
      rental: s.rentalInputs,
      monteCarlo: s.monteCarloInputs,
      monteCarloReturnMode: s.monteCarloReturnMode,
      monteCarloSeriesId: s.monteCarloSeriesId,
      tax: s.taxInputs,
      accumulation: s.accumulationInputs,
      progressCurrentAssets: s.progressInputs.currentAssets,
      lifeEvents: s.lifeEvents, // P9 v5：事件入载荷（发送方所见 = 接收方所得，docs/p9-spec.md §6.2）
      pension: {
        ...s.pensionInputs,
        monthsDivisor: effectiveMonthsDivisor(
          s.pensionInputs.monthsDivisor,
          s.pensionInputs.retireAge,
          s.pensionMonthsSynced,
        ),
      },
    };
  },
  resetAll: () => {
    // 恢复默认同样落盘（显式动作写入口径），避免下次访问复活旧偏好
    persistPrefs(DEFAULT_CURRENCY, false);
    set({
      ...businessDefaults(),
      currency: { ...DEFAULT_CURRENCY },
      colorBlindFriendly: false,
    });
  },
  /** 业务输入切片恢复默认（不含界面偏好）：同文档粘贴损坏分享链接时回落默认，
   * 与「新标签打开损坏链接」终态一致（分享 hash 处理见 App.tsx） */
  resetBusinessInputs: () => set((s) => ({ ...businessDefaults(), resetEpoch: s.resetEpoch + 1 })),
}));
