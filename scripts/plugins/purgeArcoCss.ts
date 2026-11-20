/**
 * ============================================================================
 * P5 尺寸回收（docs/p5-spec.md §13）：组件库按需样式表的保守 denylist purge
 * ============================================================================
 *
 * 背景：main.tsx 组件库样式早已按需引入（20 组件逐一 style/css.js），index.css
 * 为按需产物；真实回收杠杆是对产物做规则级死规则删除（p5-spec §13 前提勘误）。
 *
 * 实施载体：vite 插件（本文件），在 vite-plugin-pwa 之前注册，于 generateBundle
 * 阶段改写 CSS asset 内容——CSS asset 已在 renderChunk 阶段由 vite:css-post 发射
 * 且经 lightningcss 压缩（finalizeCss），故本插件拿到的是最终 minified 形态；
 * 先于 VitePWA 的 generateBundle 执行，保证 sw.js 预缓存清单与文件内容 hash
 * 同源于 purge 后内容（p5-spec §9 R6 PWA 回归红线）。构建链不变：
 * node --run build && node scripts/check-size.mjs 量的是 purge 后真实产物。
 *
 * 机制：块级解析（非行级正则整文件替换）——按 {} 配对扫描（字符串字面量与转义
 * 安全），一条规则仅当其「全部」顶层逗号分隔选择器均命中 denylist 才整条删除；
 * 顶层逗号切分括号感知（:is()/:not() 参数内逗号不切，保守方向）；@media /
 * @supports 块内同口径递归，块被清空则整块删除（再省一层壳字节）；
 * @keyframes / @font-face 及其余 at-rule 原样保留。
 *
 * denylist（首期三类；收口复核清单——未来启用以下任一形态前须先摘除对应条目再施工）：
 *   1. .arco-*-rtl —— RTL 变体全族：ConfigProvider 仅传 locale（main.tsx），无
 *      rtl prop / direction 配置；dist 内无 [dir=rtl] 属性选择器（grep 实测零命中），
 *      RTL 规则全部以 .arco-*-rtl 类承载，运行时恒不渲染。
 *   2. .arco-textarea* —— TextArea 变体：src/ 全目录 grep 'Textarea|textArea' 零命中；
 *      已用 20 组件及其级联链（Trigger/Empty/Checkbox/Space/InputTag/Input）均不渲染
 *      TextArea，该类在运行 DOM 中不存在。
 *   3. .arco-tag-checkable —— Tag checkable 交互变体：src/ 全目录 grep 'checkable'
 *      零命中，Tag 仅作静态标签（p5-spec §4 边界）。
 *
 * 【实施修订，与 p5-spec §13 表的两处偏差，已按偏差登记纪律核证】
 *   a. §13 所列 `.arco-tag-checked` 不入 denylist：组件库 Tag 源码
 *      node_modules/@arco-design/web-react/es/Tag/index.js:105 实测
 *      `_checked = checkable ? mergedChecked : true`——非 checkable 的 Tag（含全部
 *      彩色 Tag：InsightsPanel 来源标签 / CurrencySection 离线标签 / 自定义徽标）
 *      恒挂 arco-tag-checked 类（tag.js 同文件 :111），删除将破坏在渲染样式。
 *      故仅删「全部选择器含 arco-tag-checkable」的规则（hover 态、cursor、transition），
 *      保留一切仅含 arco-tag-checked 的规则（含全部颜色变体）。
 *   b. §13 所列 `.arco-pagination` 不入首期：组件库 Table 源码
 *      node_modules/@arco-design/web-react/es/Table/table.js:719 实测
 *      `showPagination = pagination !== false && (processedData.length !== 0 || …)`
 *      ——ScenarioPanel.tsx:293 的 Table 未传 pagination prop（undefined ≠ false），
 *      有数据时内部分页器照渲染，非死代码；p5-spec 的放行闸（运行时复核）在源码
 *      证据下不成立，保守保留，字节损失以 rtl/textarea/checkable 余量覆盖。
 *
 * dry-run：环境变量 PURGE_CSS_DRY_RUN=1 时只输出删类清单（规则数 / 字节 / 分类
 * 明细）不改产物，供人工复核（p5-spec §13 风险点 ④）。产出脚本为 TS 且被
 * vite.config.ts 经 esbuild 加载，裸 node 无法直跑 TS，dry-run 经由同一条构建
 * 流水线的环境变量开关实现（与 p5-spec「脚本留 --dry-run 模式」意图一致）。
 */
import type { Plugin } from "vite";

/* 本仓 tsconfig 未装 @types/node（依赖集冻结，铁律不新增），构建脚本内需要的 node
   运行时面以最小环境声明承载（仅限本模块作用域）：process.env 读取 dry-run 开关。
   字符串/字节转换用 DOM lib 自带的 TextEncoder / TextDecoder，不经 node:buffer。 */
declare const process: { env: Record<string, string | undefined> };

/** 单条 denylist 条目：名称 + 选择器命中正则（类名后缀负向环视，防把
 *  .arco-tag-checkable-xxx 之类更长类误判为本类；取值后缀本仓实测不存在，环视仅为保险） */
interface DenylistEntry {
  name: string;
  pattern: RegExp;
}

const DENYLIST: readonly DenylistEntry[] = [
  { name: "arco-rtl", pattern: /\.arco(?:-[a-z0-9_-]+)?-rtl(?![a-z0-9_-])/ },
  // .arco-textarea 与全部 arco-textarea-* 子类（-inner / -word-limit / -clear-icon 等）
  // 均属 TextArea 组件且运行 DOM 不存在，前缀族整体命中；不存在其他组件类名以
  // arco-textarea 开头（组件库类名前缀唯一性由组件名保证）
  { name: "arco-textarea", pattern: /\.arco-textarea[a-z0-9_-]*/ },
  { name: "arco-tag-checkable", pattern: /\.arco-tag-checkable(?![a-z0-9_-])/ },
];

export interface PurgeStats {
  /** 删除的规则数（含被清空的 @media/@supports 壳） */
  removedRules: number;
  /** 删除的原始字节数（minified 产物 1:1 减字节） */
  removedBytes: number;
  /** 按 denylist 条目归类的明细（归类取规则首个选择器的首个命中） */
  perEntry: Record<string, { rules: number; bytes: number }>;
}

function createStats(): PurgeStats {
  const perEntry: PurgeStats["perEntry"] = {};
  for (const entry of DENYLIST) perEntry[entry.name] = { rules: 0, bytes: 0 };
  return { removedRules: 0, removedBytes: 0, perEntry };
}

/** 选择器首个 denylist 命中（无命中返回 null） */
function firstDenyHit(selector: string): DenylistEntry | null {
  for (const entry of DENYLIST) {
    if (entry.pattern.test(selector)) return entry;
  }
  return null;
}

/** 顶层逗号切分：括号感知（()[] 内的逗号不切），保证 :is/:not 参数被完整看待 */
function splitTopLevelSelectors(selectorList: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selectorList.length; i++) {
    const ch = selectorList[i];
    if (ch === "(" || ch === "[") {
      depth += 1;
    } else if (ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1);
    } else if (ch === "," && depth === 0) {
      out.push(selectorList.slice(start, i));
      start = i + 1;
    }
  }
  out.push(selectorList.slice(start));
  return out;
}

/** 一条规则可删 = 全部顶层选择器均命中 denylist（每个选择器至少命中一条；无选择器不删） */
function ruleRemovable(selectorList: string): boolean {
  const selectors = splitTopLevelSelectors(selectorList)
    .map((s) => s.trim())
    .filter(Boolean);
  if (selectors.length === 0) return false;
  return selectors.every((s) => firstDenyHit(s) !== null);
}

/** 规则归类：取首个选择器的首个命中条目 */
function attributeEntry(selectorList: string): DenylistEntry | null {
  for (const selector of splitTopLevelSelectors(selectorList)) {
    const hit = firstDenyHit(selector.trim());
    if (hit) return hit;
  }
  return null;
}

/** 配对花括号扫描（跳过字符串字面量与转义，对 minified / 未压缩 CSS 均稳健） */
function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < css.length && css[i] !== quote) {
        if (css[i] === "\\") i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** prelude 尾部切分：previous 语句（; 或 } 结尾）与其后的本规则选择器分开，
 *  删除叶子规则时保留前置语句 */
function splitPrelude(prelude: string): { head: string; tail: string } {
  const semi = prelude.lastIndexOf(";");
  const brace = prelude.lastIndexOf("}");
  const idx = Math.max(semi, brace);
  if (idx === -1) return { head: "", tail: prelude };
  return { head: prelude.slice(0, idx + 1), tail: prelude.slice(idx + 1) };
}

/** 可递归处理的嵌套块 at-rule（仅这两类；其余 at-rule 原样保留） */
const NESTED_AT_RULES = new Set(["media", "supports"]);

/**
 * 核心 purge：返回改写后的 CSS 与统计。stats 由调用方传入以支持递归聚合。
 * 解析异常形态（花括号不配对）时剩余部分原样保留（fail-open，绝不因解析丢内容）。
 */
function purgeCssInner(css: string, stats: PurgeStats): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) {
      out += css.slice(i);
      break;
    }
    const close = findMatchingBrace(css, open);
    if (close === -1) {
      out += css.slice(i);
      break;
    }
    const prelude = css.slice(i, open);
    const body = css.slice(open + 1, close);
    const trimmed = prelude.trim();
    const atMatch = /^@([a-zA-Z-]+)/.exec(trimmed);
    if (atMatch && NESTED_AT_RULES.has(atMatch[1])) {
      const inner = purgeCssInner(body, stats);
      if (inner.trim() === "") {
        // 块被清空：整块删除（prelude + 壳 + body）
        const removed = css.slice(i, close + 1);
        stats.removedRules += 1;
        stats.removedBytes += removed.length;
        const entry = attributeEntry(trimmed) ?? attributeEntry(body);
        if (entry) {
          stats.perEntry[entry.name].rules += 1;
          stats.perEntry[entry.name].bytes += removed.length;
        }
        i = close + 1;
        continue;
      }
      out += `${prelude}{${inner}}`;
      i = close + 1;
      continue;
    }
    if (atMatch) {
      // @keyframes / @font-face / @charset 等一律原样保留（库基座不动）
      out += `${prelude}{${body}}`;
      i = close + 1;
      continue;
    }
    if (ruleRemovable(trimmed)) {
      const { head, tail } = splitPrelude(prelude);
      out += head;
      const removedLength = tail.length + (close + 1 - open);
      stats.removedRules += 1;
      stats.removedBytes += removedLength;
      const entry = attributeEntry(trimmed);
      if (entry) {
        stats.perEntry[entry.name].rules += 1;
        stats.perEntry[entry.name].bytes += removedLength;
      }
      i = close + 1;
      continue;
    }
    out += `${prelude}{${body}}`;
    i = close + 1;
  }
  return out;
}

/** 对外入口：purge 一段 CSS，返回新内容与统计（不修改入参字符串） */
export function purgeArcoCss(css: string): { css: string; stats: PurgeStats } {
  const stats = createStats();
  return { css: purgeCssInner(css, stats), stats };
}

function formatStats(stats: PurgeStats): string {
  const parts = Object.entries(stats.perEntry)
    .filter(([, v]) => v.rules > 0)
    .map(([name, v]) => `${name}: ${v.rules} 条 / ${v.bytes} B`);
  return `${stats.removedRules} 条规则 / ${stats.removedBytes} B` + (parts.length ? `（${parts.join("；")}）` : "");
}

const DRY_RUN = process.env.PURGE_CSS_DRY_RUN === "1";

/**
 * vite 插件：generateBundle 阶段改写全部 CSS asset。
 * 注册位置约束：必须在 VitePWA 之前（用户 normal 插件按注册顺序执行 generateBundle），
 * 保证 PWA 预缓存清单同源于 purge 后内容。
 */
export function purgeArcoCssPlugin(): Plugin {
  return {
    name: "p5-purge-arco-css",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const asset = bundle[fileName];
        if (asset.type !== "asset" || !fileName.endsWith(".css")) continue;
        const raw = asset.source;
        const decoder = new TextDecoder();
        const cssText = typeof raw === "string" ? raw : decoder.decode(raw);
        const { css, stats } = purgeArcoCss(cssText);
        const label = DRY_RUN ? "（dry-run 未改产物）" : "";
        this.info(`[purge-arco-css] ${fileName}: 删除 ${formatStats(stats)}${label}`);
        if (!DRY_RUN) {
          asset.source = typeof raw === "string" ? css : new TextEncoder().encode(css);
        }
      }
    },
  };
}
