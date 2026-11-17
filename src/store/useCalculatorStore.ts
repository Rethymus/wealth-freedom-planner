/**
 * 全局计算器状态（zustand）。
 * 各高级面板输入初值均引用 src/data/defaults.ts，避免双处维护默认值。
 */
import { create } from "zustand";
import {
  BASELINE_DEFAULTS,
  LOAN_DEFAULTS,
  MONTE_CARLO_DEFAULTS,
  RENTAL_DEFAULTS,
  REVERSE_ESTIMATE_DEFAULTS,
  TAX_ESTIMATE_DEFAULTS,
} from "../data/defaults";
import type {
  AmortizeInput,
  BaselineInput,
  EstimateTaxInput,
  MonteCarloInput,
  RentalAnalysisInput,
  ReverseEstimateInput,
} from "../wasm/bridge";

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
  /** 币种设置 */
  currency: CurrencySetting;
  /** 色盲友好模式（开启后涨跌语义色替换为 Okabe–Ito 蓝/橙） */
  colorBlindFriendly: boolean;

  setBaselineInputs: (patch: Partial<BaselineInput>) => void;
  setReverseInputs: (patch: Partial<ReverseEstimateInput>) => void;
  setLoanInputs: (patch: Partial<AmortizeInput>) => void;
  setRentalInputs: (patch: Partial<RentalAnalysisInput>) => void;
  setMonteCarloInputs: (patch: Partial<MonteCarloInput>) => void;
  setTaxInputs: (patch: Partial<EstimateTaxInput>) => void;
  setCurrency: (patch: Partial<CurrencySetting>) => void;
  toggleColorBlindFriendly: () => void;
  /** 恢复全部默认值 */
  resetAll: () => void;
}

export const useCalculatorStore = create<CalculatorState>()((set) => ({
  baselineInputs: { ...BASELINE_DEFAULTS },
  reverseInputs: { ...REVERSE_ESTIMATE_DEFAULTS },
  loanInputs: { ...LOAN_DEFAULTS },
  rentalInputs: { ...RENTAL_DEFAULTS },
  monteCarloInputs: { ...MONTE_CARLO_DEFAULTS },
  taxInputs: { ...TAX_ESTIMATE_DEFAULTS },
  currency: { base: "CNY", display: "CNY" },
  colorBlindFriendly: false,

  setBaselineInputs: (patch) =>
    set((state) => ({ baselineInputs: { ...state.baselineInputs, ...patch } })),
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
  setCurrency: (patch) =>
    set((state) => ({ currency: { ...state.currency, ...patch } })),
  toggleColorBlindFriendly: () =>
    set((state) => ({ colorBlindFriendly: !state.colorBlindFriendly })),
  resetAll: () =>
    set({
      baselineInputs: { ...BASELINE_DEFAULTS },
      reverseInputs: { ...REVERSE_ESTIMATE_DEFAULTS },
      loanInputs: { ...LOAN_DEFAULTS },
      rentalInputs: { ...RENTAL_DEFAULTS },
      monteCarloInputs: { ...MONTE_CARLO_DEFAULTS },
      taxInputs: { ...TAX_ESTIMATE_DEFAULTS },
      currency: { base: "CNY", display: "CNY" },
      colorBlindFriendly: false,
    }),
}));
