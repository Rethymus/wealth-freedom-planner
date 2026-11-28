/**
 * UI 层共享 hook。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { MOTION_DURATIONS } from "../data/defaults";
// P6 S26 useMagnetic 已按 §8 降档顺序裁撤（docs/p6-spec.md §8；dist 原始字节门禁实测回写）
import type { FinanceResult } from "../services/finance";
import { currencySymbol, formatMoney, formatMoneyFixed } from "../services/format";
import { cnyToDisplay, pickRate } from "../services/currency";
import { getRates } from "../services/rates";

export interface FinanceCallState<O> {
  /** 是否正在调用计算核心 */
  loading: boolean;
  /** 最近一次结果（null = 尚未完成首次调用） */
  result: FinanceResult<O> | null;
}

export interface UseFinanceCallOptions {
  /** 防抖毫秒数（默认 300，随输入实时重算用） */
  debounceMs?: number;
  /** false 时跳过调用（结果清空），如税表数据未就绪 */
  enabled?: boolean;
}

/**
 * 随输入变化自动（防抖）调用计算核心 service。
 * runner 依赖外部状态时请一并放进 deps。
 */
export function useFinanceCall<O>(
  runner: () => Promise<FinanceResult<O>>,
  deps: readonly unknown[],
  options: UseFinanceCallOptions = {},
): FinanceCallState<O> {
  const { debounceMs = 300, enabled = true } = options;
  const [state, setState] = useState<FinanceCallState<O>>({ loading: false, result: null });
  const runnerRef = useRef(runner);
  runnerRef.current = runner;

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, result: null });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true }));
      runnerRef
        .current()
        .then((result) => {
          if (!cancelled) setState({ loading: false, result });
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setState({
              loading: false,
              result: {
                ok: false,
                error: e instanceof Error ? e.message : String(e),
                notReady: false,
              },
            });
          }
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // deps 由调用方显式给出（长度在调用点固定），此处禁用 exhaustive-deps 检查
  }, [...deps, enabled, debounceMs]);

  return state;
}

/** 与 Arco responsiveMap.md（min-width: 768px）互补的窄视口查询 */
const NARROW_MEDIA_QUERY = "(max-width: 767.9px)";

/**
 * 窄视口判定（< 768px，即 Arco md 断点以下，与各面板 column={{ xs: 1, md: N }} 的
 * 单列切换点一致）。useState 惰性初始化直接读 matchMedia，首帧即得正确值，
 * 不存在「桌面端先纵向后横向」的闪动。
 */
export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(NARROW_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    setIsNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isNarrow;
}

/** 紧凑视口判定（< 640px，P3 响应式专项的紧凑收纳档；与 useIsNarrowViewport 同构） */
const COMPACT_MEDIA_QUERY = "(max-width: 639.9px)";

export function useIsCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    setIsCompact(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isCompact;
}

/**
 * 双栏工作台判定（≥ 1200px 且视口高度 ≥ 880px；P10fix E1 高度驱动形态降级——
 * docs/p10fix-spec.md §1.1/§2.2）。宽度维与 global.css 工作台网格断点一一对应
 * （V1/V2 修复专用：工作台两栏是 400px 定宽左栏与被 1112px 容器封顶的右栏，容器
 * 实际宽度小于组件库 viewport 级 md 断点所假设的可用宽度，viewport 级多列
 * Descriptions 会在栏内溢出被 tabs 裁切层静默裁掉——两栏内的 Descriptions 以本判定
 * 切单列键值行）。高度维为 E1 修复新增：双栏页栈静态预算左列 742 / 右列 628
 * （p10fix-spec §1.1 在册），880 = max(742, 628) ＋ chrome 124 ＋ slack 14——
 * H < 880 时双栏不可达 580 下限零滚动预算域，整体降为叶树形态（E1 三个破功视口
 * 1366×768 / 1366×650 / 1280×720 的溢出源由此整体消除）；1440×900 / 1920×1080
 * 保持双栏。落点唯一：本 hook 是双栏形态的唯一激活路径（.wf-freedom-split 无 CSS
 * media query 副本，BasicCalculator isWorkbench 分支单点渲染）。
 * 与 useIsNarrowViewport 同构：惰性初始化直读 matchMedia，首帧即得正确值。
 */
const WORKBENCH_MEDIA_QUERY = "(min-width: 1200px) and (min-height: 880px)";

export function useIsWorkbenchViewport(): boolean {
  const [isWorkbench, setIsWorkbench] = useState(() => window.matchMedia(WORKBENCH_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(WORKBENCH_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsWorkbench(e.matches);
    setIsWorkbench(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isWorkbench;
}

/** 矮视口判定（视口高度 < 850px；P10 骨架修复轮新增）：高度维度的档位判定——
 *  与 useIsNarrowViewport 同构（matchMedia 惰性初始化，首帧即得正确值）。
 *  用途勘误（P10fix §1.1 连带登记）：注释原文「双栏 1200×800 档的档位压缩
 *  （反向卡 228→190、进度环 72→56）」中 190 为陈旧值——反向卡矮档代码常量为
 *  170（ReversePanel.tsx REVERSE_CARD_HEIGHT_SHORT 228/170，以代码为准）；
 *  且 WORKBENCH_MEDIA_QUERY 已增高度维（H≥880 才双栏），「双栏 ∧ 矮档」组合
 *  成为空集——本判定现服务于叶树/单列形态的档位压缩（进度环 48、龙卷风图 180、
 *  反向卡 170、反向卡编辑分页 3 页×2 字段）与 global.css 深矮档压缩块。 */
const SHORT_HEIGHT_MEDIA_QUERY = "(max-height: 849.9px)";

export function useShortViewport(): boolean {
  const [isShort, setIsShort] = useState(() => window.matchMedia(SHORT_HEIGHT_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(SHORT_HEIGHT_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsShort(e.matches);
    setIsShort(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isShort;
}

/** 图表响应式三档（响应研究 D5）：高度 <640:240 / 640–767:280 / ≥768:320；
 *  YAxis 宽 <640:56（刻度字号 12 保持，跌破可读下限的不再缩）/ 其余 72 */
export interface ChartMetrics {
  chartHeight: number;
  yAxisWidth: number;
  isCompact: boolean;
}

export function useChartMetrics(): ChartMetrics {
  const isNarrow = useIsNarrowViewport();
  const isCompact = useIsCompactViewport();
  return {
    chartHeight: isCompact ? 240 : isNarrow ? 280 : 320,
    yAxisWidth: isCompact ? 56 : 72,
    isCompact,
  };
}

/** 紧凑档 X 轴刻度上限 5：按刻度总数返回 recharts XAxis 的 interval 值（非紧凑档不调用） */
export function compactXInterval(totalTicks: number): number {
  return Math.max(0, Math.ceil(totalTicks / 5) - 1);
}

/** 系统减弱动态效果偏好查询串（实现模式与 useIsNarrowViewport 一致） */
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * 系统「减弱动态效果」偏好（prefers-reduced-motion: reduce）。
 * CSS 过渡由样式层兜底全停；JS 驱动的动画（rAF 数值滚动、图表入场）
 * 必须经本 hook 显式短路，两者缺一不可。
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * 数值渐近滚动缓动解析式：1-(1-t)^3，与令牌 --wf-ease-asymptotic 同族
 * （末端速度趋近零、无限逼近终值），避免在 JS 里手工采样贝塞尔。
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** rAF 停摆兜底宽限（毫秒）：动画时长之后仍无完成帧即视为帧回调停摆，直接落值。
 * 正常 60fps 帧距约 16ms，留足余量避免误伤慢帧环境。 */
const RAF_FALLBACK_GRACE_MS = 500;

/**
 * 数值渐近滚动：目标值变化时从当前显示值向新目标 rAF 逐帧收敛。
 * - 默认时长取 MOTION_DURATIONS.slow（慢档，与令牌 --wf-dur-slow 同源）；
 * - 系统「减弱动态效果」命中时跳过插值直接落值（不播放也不残留中间帧）；
 * - 首值不滚动：首次拿到数据直接显示，不从空态占位 0 起滚；
 * - 连续快速变化时以最新显示值为起点重启；
 * - 非有限数目标直接吸附；结束帧精确等于目标值（防舍入残留）；
 * - 卸载/依赖变更时取消未完成帧；
 * - 墙钟兜底：个别环境 rAF 帧回调停摆（页面 visible 且聚焦仍可能发生），
 *   超过「动画时长 + 宽限」仍无完成帧时直接落值到目标，保证显示值最终一致
 *   （rAF 正常时循环早已完成，兜底不触发）；
 * - 可见性闸（P6 S18，p6-spec §6 红线 2 硬性要求）：hostRef 指向宿主元素时经
 *   IntersectionObserver 监听其可见性——宿主 display:none（方案 B 常驻+hidden
 *   面板）或视口外时 rAF 循环当帧暂停不再调度，恢复可见时从当前显示值续播
 *   （墙钟已过时长则恢复帧直接落定值）；hostRef 未提供时闸不生效（行为同前）。
 *   observer 卸载 disconnect；rAF 中间帧只进显示值，永不进 store。
 */
export function useAnimatedNumber(target: number, durationMs?: number, hostRef?: RefObject<HTMLElement>): number {
  const duration = durationMs ?? MOTION_DURATIONS.slow;
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  /** 当前显示值（下一轮动画的起点，与 state 同步维护以便在 effect 内读取最新值） */
  const displayRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  /** 首值不滚动：挂载后接收到的首个目标值直接落值 */
  const firstValueRef = useRef(true);
  /** S18 可见性闸：宿主可见性（初始按可见处理，IO 首报后以实测为准） */
  const [hostVisible, setHostVisible] = useState(true);
  useEffect(() => {
    const el = hostRef?.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setHostVisible(entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hostRef]);
  /** 动画回合计时起点（跨 effect 重跑保持：目标变更开启新回合，可见性恢复沿用原起点） */
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    // 直接落值：减弱动效偏好 / 非有限数目标 / 首值 / 从空态占位 0 进入有值态
    const snapDirectly =
      reducedMotion || !Number.isFinite(target) || firstValueRef.current || displayRef.current === 0;
    if (snapDirectly) {
      firstValueRef.current = false;
      startRef.current = null;
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    if (from === target) {
      startRef.current = null;
      return;
    }
    // 新回合（目标 / 时长 / 减动效偏好变化）从头计时；可见性恢复沿用原起点续播
    if (startRef.current === null) startRef.current = performance.now();
    const start = startRef.current;
    let completed = false;
    const finish = () => {
      if (completed || !hostVisible) return; // 宿主不可见时不落值（恢复后按墙钟判定直接落定）
      completed = true;
      startRef.current = null;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      displayRef.current = target;
      setDisplay(target);
    };
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      if (progress >= 1) {
        // 结束帧精确等于目标值
        frameRef.current = null;
        finish();
        return;
      }
      const value = from + (target - from) * easeOutCubic(progress);
      displayRef.current = value;
      setDisplay(value);
      frameRef.current = requestAnimationFrame(step);
    };
    // 宿主不可见：当帧暂停不再调度（effect 重跑已取消在飞帧），恢复可见时本 effect 重跑续播
    frameRef.current = hostVisible ? requestAnimationFrame(step) : null;
    // 墙钟兜底：rAF 停摆时不依赖帧回调，到点直接落值（正常时 completed 已为 true，此处空转；
    // 暂停期间计时继续走，恢复后按已过时长决定续播或立即落定）
    const elapsed = performance.now() - start;
    const fallbackTimer = window.setTimeout(finish, Math.max(0, duration + RAF_FALLBACK_GRACE_MS - elapsed));
    return () => {
      completed = true;
      window.clearTimeout(fallbackTimer);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, duration, reducedMotion, hostVisible]);

  return display;
}

/**
 * 因果高亮序号（P6 S16，p6-spec §2；research 片段 6.1）：值变化返回递增 epoch，
 * 宿主以 key={epoch} 重挂承载一次性 CSS 动画（与段位涨色 multFlashEpoch 同构）。
 * 首值不闪（与 useAnimatedNumber 首值纪律一致）；epoch 只驱动重渲染，
 * 不进 store、不触发任何计算路径（§6 红线 4）。
 */
export function useFlashOnChange(value: number): number {
  const [epoch, setEpoch] = useState(0);
  const prev = useRef(value);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prev.current = value;
      return;
    }
    if (value !== prev.current) {
      prev.current = value;
      setEpoch((e) => e + 1);
    }
  }, [value]);
  return epoch;
}

// ---------------------------------------------------------------------------
// P4 ⑤ 币种展示换算（docs/p4-spec.md §3.3/§3.4）：store 金额恒为 CNY 规范值，
// 展示层按 rate（1 CNY = rate 单位展示币种）换算；rate 缺失回退符号-only 模式。
// 核心公式（wasm）零改动，换算全部在本层完成。
// ---------------------------------------------------------------------------

/** 展示汇率状态（useDisplayRate 输出；rate = null 表示换算不可用） */
export interface DisplayRate {
  /** 当前展示币种 */
  code: string;
  /** null = 换算不可用（符号-only 模式） */
  rate: number | null;
  /** true = getRates Promise 未决（请求进行中，超时上限 8s）；true 期间调用方
   *  不得渲染「汇率暂不可用」类断言文案（数据未定，横幅会先撒谎后翻转） */
  loading: boolean;
  /** 汇率数据是否来自离线快照 */
  offline: boolean;
  /** ratesUpdatedAt（可能为空串） */
  updatedAt: string;
  /** 数据来源说明 */
  source: string;
}

/** CNY 展示币种恒等态（模块级常量：不发请求、不产生新引用） */
const CANONICAL_RATE: DisplayRate = {
  code: "CNY",
  rate: 1,
  loading: false,
  offline: false,
  updatedAt: "",
  source: "canonical",
};

/** 请求未决期占位（rate null → 字段按符号-only 渲染，就绪后整帧切换为换算值） */
function pendingRate(code: string): DisplayRate {
  return { code, rate: null, loading: true, offline: false, updatedAt: "", source: "" };
}

/**
 * 展示币种 → 换算率（p4-spec §3.3）：
 * 1. displayCode === "CNY"：恒返回 canonical 态，不发起请求；
 * 2. 其他币种：调用 getRates()（模块级缓存与 CurrencySection 既有调用自动去重）→
 *    pickRate(result.rates, displayCode)；快照缺币种时 pickRate 得 null → 符号-only。
 * 展示币种变化时重跑（deps：displayCode）。已知限制：CurrencySection 强刷
 * （getRates(true) 覆写模块级 cached）后，已挂载组件持有的 resolved 值不随动，
 * 至切币种 / 重挂载前保持旧 rate（旧 rate 仍是有效历史值，p4-spec §14 #15）。
 */
export function useDisplayRate(displayCode: string): DisplayRate {
  const [state, setState] = useState<DisplayRate>(() =>
    displayCode === "CNY" ? CANONICAL_RATE : pendingRate(displayCode),
  );
  useEffect(() => {
    if (displayCode === "CNY") {
      setState(CANONICAL_RATE);
      return;
    }
    let cancelled = false;
    setState(pendingRate(displayCode));
    void getRates().then((r) => {
      if (cancelled) return;
      setState({
        code: displayCode,
        rate: pickRate(r.rates, displayCode),
        loading: false,
        offline: r.offline,
        updatedAt: r.ratesUpdatedAt,
        source: r.source,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [displayCode]);
  return state;
}

/**
 * 组件级金额展示绑定（p4-spec §3.4）：rate 可用时换算后格式化，
 * 否则按 CNY 值直出（符号-only）。money/moneyFixed 经 useCallback 稳定引用
 * （rate / 符号不变时不触发下游 effect 重跑）；display 一并返回，
 * 供输入字段 convertRate 与图表数据同源换算使用。
 */
export function useMoney(displayCode: string): {
  /** 展示币种符号（换算不可用时仅切换符号，数值保持 CNY 口径） */
  symbol: string;
  /** CNY 规范值 → 展示金额字符串（符号 + 千分位） */
  money: (cnyValue: number) => string;
  /** CNY 规范值 → 展示金额字符串（固定两位小数，表格列内精度一致） */
  moneyFixed: (cnyValue: number) => string;
  /** 换算率与请求状态（输入字段 convertRate / 图表数据换算取 display.rate） */
  display: DisplayRate;
} {
  const display = useDisplayRate(displayCode);
  const symbol = currencySymbol(displayCode);
  const rate = display.rate;
  const money = useCallback(
    (v: number) => formatMoney(rate !== null ? cnyToDisplay(v, rate) : v, symbol),
    [rate, symbol],
  );
  const moneyFixed = useCallback(
    (v: number) => formatMoneyFixed(rate !== null ? cnyToDisplay(v, rate) : v, symbol),
    [rate, symbol],
  );
  return { symbol, money, moneyFixed, display };
}
