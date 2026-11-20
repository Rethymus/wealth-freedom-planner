/**
 * UI 层共享 hook。
 */
import { useEffect, useRef, useState } from "react";
import { MOTION_DURATIONS } from "../data/defaults";
import type { FinanceResult } from "../services/finance";

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
 *   （rAF 正常时循环早已完成，兜底不触发）。
 */
export function useAnimatedNumber(target: number, durationMs?: number): number {
  const duration = durationMs ?? MOTION_DURATIONS.slow;
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  /** 当前显示值（下一轮动画的起点，与 state 同步维护以便在 effect 内读取最新值） */
  const displayRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  /** 首值不滚动：挂载后接收到的首个目标值直接落值 */
  const firstValueRef = useRef(true);

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
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const from = displayRef.current;
    if (from === target) return;
    const start = performance.now();
    let completed = false;
    const finish = () => {
      if (completed) return; // 正常完成帧已落值；兜底到点时空转
      completed = true;
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
    frameRef.current = requestAnimationFrame(step);
    // 墙钟兜底：rAF 停摆时不依赖帧回调，到点直接落值（正常时 completed 已为 true，此处空转）
    const fallbackTimer = window.setTimeout(finish, duration + RAF_FALLBACK_GRACE_MS);
    return () => {
      completed = true;
      window.clearTimeout(fallbackTimer);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, duration, reducedMotion]);

  return display;
}
