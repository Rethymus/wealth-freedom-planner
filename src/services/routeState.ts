/**
 * 任务路由状态（WF-03；docs/wf03-spec.md §2.3/§4.3，裁定源 docs/research-wf03-routing.md §3/§5）。
 *
 * - 通道：query 参数 `?task=<id>[&panel=<key>]`；hash 通道由分享载荷独占（share.ts 的
 *   #s=），两通道同 URL 并存互不触碰——本模块全部读写只走 query，hash 只透传不改写。
 * - task ∈ freedom | life | risk | principles | pro；panel 仅 task=pro 消费且取值 =
 *   AdvancedPanel 九面板现行 key 原文（routing §2.2#3「面板 key 不变」）。
 * - 序列化纪律：只写非默认值（task=freedom 且无 panel 时清参数，URL 恒净）；
 *   canonical 顺序 task→panel；其余未知 query 参数原样保留。
 * - 写入方式：history.replaceState 同文档改写（不 pushState，Back 语义保留给分享流）。
 * - 持久化：键名 wf-route（并入偏好键族 wf-lang / wf-theme / wf-prefs，单一 localStorage
 *   域）；值形状 JSON {"task","panel"}（panel 仅 task=pro 写入）；仅显式切换动作写入
 *   （深链落地不写盘——URL 是事实来源）；try/catch 静默（persistTheme/persistLanguage
 *   同口径）；组内末激活标签记忆维持会话级 useState 不入盘（现状行为，AdvancedPanel）。
 * - resetEpoch 零触碰：本模块不读不写 store（路由与分享载荷是两条正交 URL 通道）。
 * - URL 处理单一归属：纯函数对与 share.ts 同域（share.ts buildShareUrl 先例）。
 */

/** 任务 id 全集（前四对齐任务页容器命名，原型 §0.2；pro 为专业模式直达） */
export const ATLAS_TASK_IDS = ["freedom", "life", "risk", "principles", "pro"] as const;
export type AtlasTaskId = (typeof ATLAS_TASK_IDS)[number];

/** 默认任务（裸 pathname / 非法值回落） */
export const DEFAULT_TASK: AtlasTaskId = "freedom";

/** pro 页深链 panel 取值 = 九面板现行 key 原文（AdvancedPanel GROUPS，key 与分享/情景库无耦合） */
export const ATLAS_PANEL_KEYS = [
  "reverse",
  "accumulation",
  "pension",
  "loan",
  "rental",
  "monte-carlo",
  "tax",
  "scenario",
  "insights",
] as const;
export type AtlasPanelKey = (typeof ATLAS_PANEL_KEYS)[number];

/** 路由状态（panel 仅 task=pro 消费；null = 未指定，pro 落各组记忆首面板） */
export interface AtlasRoute {
  task: AtlasTaskId;
  panel: AtlasPanelKey | null;
}

/** 解析结果：explicit = URL 显式携带 task/panel（显式参数 > wf-route > 默认 freedom）；
 *  canonical = URL query 已是本状态的 canonical 序列化形态（否则挂载后 replaceState 规范化） */
export interface DecodedRoute extends AtlasRoute {
  explicit: boolean;
  canonical: boolean;
}

/** 偏好键族持久化键（wf-route） */
export const ROUTE_STORAGE_KEY = "wf-route";

function isTaskId(v: string): v is AtlasTaskId {
  return (ATLAS_TASK_IDS as readonly string[]).includes(v);
}

function isPanelKey(v: string): v is AtlasPanelKey {
  return (ATLAS_PANEL_KEYS as readonly string[]).includes(v);
}

/** 路由 → query 序列化（只写非默认值；canonical 顺序 task→panel）。
 *  返回 ""（freedom 且无 panel，URL 恒净）或 "?task=..." 形态。 */
export function encodeRoute(route: AtlasRoute): string {
  if (route.task === DEFAULT_TASK && route.panel === null) return "";
  const params = new URLSearchParams();
  params.set("task", route.task);
  if (route.task === "pro" && route.panel !== null) params.set("panel", route.panel);
  return `?${params.toString()}`;
}

/** 解析 location.search → 路由。task 越界静默归 freedom、panel 越界静默落 null
 *  （pro 首面板）——路由纯导航无数据损失，不弹提示（routing §3.2 分级裁定）；
 *  explicit/canonical 供调用方决定「读持久化」与「挂载后 replaceState 规范化」。 */
export function decodeRoute(search: string): DecodedRoute {
  const params = new URLSearchParams(search);
  const rawTask = params.get("task");
  const rawPanel = params.get("panel");
  const explicit = rawTask !== null || rawPanel !== null;
  const task: AtlasTaskId = rawTask !== null && isTaskId(rawTask) ? rawTask : DEFAULT_TASK;
  const panel: AtlasPanelKey | null =
    task === "pro" && rawPanel !== null && isPanelKey(rawPanel) ? rawPanel : null;
  const canonical = search === encodeRoute({ task, panel });
  return { task, panel, explicit, canonical };
}

/** 由当前 location 构造初始路由：URL 显式参数 > wf-route 持久化 > 默认 freedom。
 *  在 useState 初始化器中调用（首渲染前解析，禁 effect 后解析——防任务闪变；
 *  readInitialTheme 先例 defaults.ts）。深链落地不读不写持久化。 */
export function resolveInitialRoute(): DecodedRoute {
  const decoded = decodeRoute(window.location.search);
  if (decoded.explicit) return decoded;
  const persisted = readPersistedRoute();
  return persisted
    ? { ...persisted, explicit: false, canonical: true }
    : { task: DEFAULT_TASK, panel: null, explicit: false, canonical: true };
}

/** history.replaceState 同文档改写 query（不 pushState）；pathname 与 hash（分享载荷
 *  独占通道）原样透传；未知 query 参数原样保留并排在 task/panel 之后。 */
export function replaceUrlRoute(route: AtlasRoute): void {
  const { pathname, search, hash } = window.location;
  const foreign = new URLSearchParams(search);
  foreign.delete("task");
  foreign.delete("panel");
  const foreignStr = foreign.toString();
  const query = [encodeRoute(route).replace(/^\?/, ""), foreignStr].filter(Boolean).join("&");
  window.history.replaceState(window.history.state, "", `${pathname}${query ? `?${query}` : ""}${hash}`);
}

/** 读 wf-route 持久化：值不可解析 / 键越界 → 视同无存储静默回落（回落链走深链解析口径）。
 *  版本字段暂不设（二键扁平结构无演进分叉；未来加键仿 share v4 递增先例补 version）。 */
export function readPersistedRoute(): AtlasRoute | null {
  try {
    const raw = window.localStorage.getItem(ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<{ task: string; panel: string }>;
    if (typeof saved.task !== "string" || !isTaskId(saved.task)) return null;
    const task = saved.task;
    const panel =
      task === "pro" && typeof saved.panel === "string" && isPanelKey(saved.panel)
        ? (saved.panel as AtlasPanelKey)
        : null;
    return { task, panel };
  } catch {
    return null;
  }
}

/** 写 wf-route：仅显式切换动作调用（点选 / 键盘激活）；panel 仅 task=pro 写入；
 *  存储不可用仅影响下次访问（try/catch 静默，persistTheme 同口径）。 */
export function persistRoute(route: AtlasRoute): void {
  try {
    const value: { task: AtlasTaskId; panel?: AtlasPanelKey } = { task: route.task };
    if (route.task === "pro" && route.panel !== null) value.panel = route.panel;
    window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* 存储不可用（隐私模式等）：路由仍会在当前会话生效 */
  }
}
