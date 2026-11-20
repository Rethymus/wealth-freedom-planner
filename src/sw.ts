/// <reference lib="webworker" />
/**
 * 手写 Service Worker（P4 ① PWA 离线安装，docs/p4-spec.md §6.3 / research-pwa §3.2）：
 * - autoUpdate 语义：install 内 skipWaiting + activate 内 clients.claim——静默换版，
 *   新 SW 接管只影响后续请求，不强刷打开中的页面（全部输入已持久化，无表单丢失风险）；
 *   不 import 任何 workbox 运行时（injectManifest 策略，产物仅 sw.js 一个文件）。
 * - 预缓存清单由构建期注入 self.__WP_MANIFEST（vite-plugin-pwa injectManifest），
 *   缓存名内嵌清单指纹：任何影响产物的构建都会改变 sw.js 字节 → 触发更新周期。
 * - fetch 三分：① 导航请求 → 命中预缓存 index.html；② 同源 GET → 预缓存命中否则放行网络；
 *   ③ 跨域 → 仅当 https: 且主机精确等值 FX_HOST 走 NetworkFirst（成功回包 clone 写入
 *   FX_CACHE，失败回落缓存命中，再失败按构造放行网络失败 → 页面层既有 offlineSnapshot 兜底）；
 *   其余跨域一律放行不缓存。
 * - 安全口径（强约束）：汇率路由协议显式限定 https: + 主机精确等值匹配单一公网域——
 *   本地 / 环回 / 私有 / 保留地址按构造即不可能命中。不使用任何推送类能力
 *   （无推送 / 通知 / 后台同步 / 周期同步）。
 *
 * 模块形态强制（勿删）：文件无 import/export 时 TS 按全局脚本处理，下方 declare self 与
 * lib.dom 全局 self 冲突并级联报错（仓内 TypeScript 实测：脚本形态 TS2451 + 多处
 * TS2339/TS2769，exit=2；文件尾 export {} 转模块形态后 exit=0）。该形态依赖 tsconfig 的
 * skipLibCheck:true（lib.webworker 与 lib.dom 共存前提）——勿单独移除该旗标（p4-spec §6.3）。
 */

interface PrecacheEntryLike {
  url: string;
  revision: string | null;
}

declare const self: ServiceWorkerGlobalScope & { __WP_MANIFEST: PrecacheEntryLike[] };

/** 8 位十六进制指纹：逐字符 31 进折叠（构建产物内容变化即变化，无需密码学强度） */
function hash8(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// 构建期注入点：workbox-build 要求 swSrc 内 injectionPoint 字符串恰好出现一次，
// 故仅在唯一引用处读取，其余代码一律使用下方本地常量（勿再写 self.__WP_MANIFEST）。
// 注入清单按 url 去重：插件对自产文件（manifest.webmanifest / icons/*.png）与
// globPatterns 结果的重叠不处理，实测 15 条仅 12 唯一——不去重则 install 对这
// 三个 URL 各重复回填一次（验收 T1-2；research-pwa §3.1 同口径缺陷）
const PRECACHE_MANIFEST: PrecacheEntryLike[] = [
  ...new Map(self.__WP_MANIFEST.map((entry) => [entry.url, entry])).values(),
];

const PRECACHE = "precache-" + hash8(JSON.stringify(PRECACHE_MANIFEST));
/** 汇率接口主机（与 src/services/rates.ts 的 RATES_URL 同源；唯一被 SW 运行时缓存的跨域） */
const FX_HOST = "open.er-api.com";
/** 汇率运行时缓存（跨版本保留，不随指纹清除——在线会话永远优先网络，无过期需求） */
const FX_CACHE = "fx-cache-v1";
/** 预缓存 index.html 条目（导航请求回退源；条目名由构建清单生成，恒为根相对路径） */
const NAVIGATION_FALLBACK = "index.html";

// install：cache:"reload" 绕过 HTTP 缓存直取源文件（部署响应 max-age=600）→ 全量回填 → skipWaiting
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_MANIFEST.map(async (entry) => {
          const response = await fetch(new Request(entry.url, { cache: "reload" }));
          if (!response.ok) {
            throw new Error(`预缓存回填失败：${entry.url}（HTTP ${response.status}）`);
          }
          await cache.put(entry.url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

/** 换代游标缓存（验收 T2-7）：记录上一代预缓存名，activate 仅删除「上上代及更早」，
 *  保留上一代一个版本周期——换版窗口内进行中的加载（旧 SW 控制期落在旧预缓存
 *  index.html 上的导航）activate 删旧后对旧 hash 资源 404 → wasm 初始化失败白屏；
 *  保留一代后该类页面仍可从上一代缓存取到旧资源。游标键用 invalid 顶级域绝对 URL：
 *  仅作 Cache API 键值等值匹配，任何页面请求都不可能命中（非同源、不可解析） */
const CURSOR_CACHE = "sw-cursor-v1";
const CURSOR_KEY = "https://sw-cursor.invalid/precache-prev";

// activate：删「上上代及更早」预缓存（上一代保留一个版本周期，见 CURSOR_CACHE 注释）
// → 汇率缓存 fx-cache-v1 跨版本保留 → clients.claim
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const cursorCache = await caches.open(CURSOR_CACHE);
      const prevGen: string | null = await cursorCache
        .match(CURSOR_KEY)
        .then((r) => (r ? r.text() : null));
      await Promise.all(
        names
          .filter((n) => n.startsWith("precache-") && n !== PRECACHE && n !== prevGen)
          .map((n) => caches.delete(n)),
      );
      await cursorCache.put(CURSOR_KEY, new Response(PRECACHE));
      await self.clients.claim();
    })(),
  );
});

// fetch 三分（见文件头注释）
self.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // ③ 跨域：仅 https: + 主机精确等值 FX_HOST 走 NetworkFirst；其余跨域一律放行不缓存
  if (url.origin !== self.location.origin) {
    if (url.protocol === "https:" && url.hostname === FX_HOST) {
      event.respondWith(
        (async () => {
          try {
            const response = await fetch(request);
            if (response.ok) {
              // CORS 响应（非 opaque）可整体写入 Cache API；clone 供页面侧继续消费
              const cache = await caches.open(FX_CACHE);
              await cache.put(request, response.clone());
            }
            return response;
          } catch {
            const hit = await caches.match(request);
            // 再失败：返回网络错误 → 页面层 fetch reject → 既有 offlineSnapshot 快照兜底
            return hit ?? Response.error();
          }
        })(),
      );
    }
    return;
  }

  // ① 导航请求：命中【当前代】预缓存 index.html（离线整页可用），未命中放行网络。
  // 必须以 cacheName 限定当前代：activate 保留的上一代缓存含过期 index.html（验收
  // T2-7），无限定时 caches.match 按缓存创建序遍历可能命中旧壳——新导航拿到旧应用
  if (request.mode === "navigate") {
    event.respondWith(
      (async () =>
        (await caches.match(NAVIGATION_FALLBACK, { cacheName: PRECACHE })) ??
        (await fetch(request)))(),
    );
    return;
  }

  // ② 同源 GET：预缓存命中否则放行网络
  event.respondWith((async () => (await caches.match(request)) ?? (await fetch(request)))());
});

export {};
