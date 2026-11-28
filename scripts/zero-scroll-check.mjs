/**
 * ============================================================================
 * 零滚动自检脚本（docs/p10-spec.md §9-A1 程序化断言的机读承载；P10fix §10.1 扩维：
 * 语言维入矩阵 + 在册十视口 + ④判定 + 低于下限档单独登记）
 * ============================================================================
 * 判定（A1 三重 + P10 槽裁切探测 + P10fix ④/⑤）：
 *   ① 页根（.atlas-page:not([hidden])）scrollHeight ≤ clientHeight；
 *   ② 页根全部后代可滚动元素枚举——任一后代 scrollHeight > clientHeight 且
 *      computed overflowY ∈ {auto, scroll} 即挂（禁内滚兜底）；
 *   ②′ 槽裁切探测（P10 扩围，比 A1 更严）：.wf-slot / .wf-reverse-card /
 *      .wf-risk-leaf（overflow:hidden 载体）任一 scrollHeight > clientHeight 即挂
 *      ——overflow:hidden 不触发 ②，静默裁切必须由本判定显式拦截；
 *   ③ Content（#wf-main）computed overflowY ∈ {visible, hidden}（禁内滚兜底）；
 *   ④ pro 活动面板根在视口内（P10fix §5-4，E5 回归闸）：每个
 *      .wf-adv-tabs-wrap:not([hidden]) 的活动面板根（.arco-tabs-content-item-active
 *      .arco-tabs-pane 首个）getBoundingClientRect() 与视口相交且 left ≥ 0
 *      （E5 修复前 index≥1 标签 innerX −850/−1897/−2943 态由此拦截）；
 *   ⑤ 提示不遮挡（P10fix §4-A4）：活动 Message 容器（.arco-message-wrapper-bottom /
 *      -top 任一存在且非空）与 .atlas-switch rect 不相交；.wf-fallback-banner 在
 *      文档流中与 .atlas-switch rect 不相交。
 *
 * 遍历协议（visitedTasks 门控下的前置遍历 + 叶/槽贪心遍历）：
 *   - 先经任务切换逐页首展挂载（App.tsx visitedTasks），再逐页遍历；
 *   - 每页内：贪心点击「可见且未点击过的 SegBar 单选钮」与「启用的 SlotPager 前进钮」
 *     与「pro 组内 Arco 标签头」，每次点击后等待落定（240ms）并断言；状态空间由贪心
 *     深度上限约束；
 *   - 语言注入逐组回读 document.documentElement.lang 确认生效，失效组作废重跑一次
 *     （p10-spec R-4 教训：语言注入失效会产出假阳性全过组）；
 *   - 任一判定失败即记录失败项（不中断遍历，末尾汇总 exit code）。
 *
 * 运行通道：本模块导出 VIEWPORTS / LANGS / THEMES / TASKS / runSweep(driver)，供 GUI
 * 自动化通道（红线 6：不引入测试框架/新依赖）注入 driver 执行；裸 node 直跑仅打印用法
 * （无浏览器驱动时不虚报结果）。
 * driver 接口：{ setViewport(w, h), gotoTask(task), setTheme(theme), setLang(lang),
 * evaluate(expr) } —— evaluate 在应用页面上下文执行表达式并返回其值。
 *
 * 低于下限档（320×568，BELOW_FLOOR_VIEWPORTS）：预期回退横幅出现属登记例外（§10.1
 * 末行口径）——断言收窄为 belowFloor 模式：页根溢出须伴随 .wf-fallback-scroll（放行
 * 滚动，无静默裁切）、横幅 rect 与切换条不相交（文档流单行不遮挡）；不进零滚动 PASS
 * 计数，汇总单独登记。
 */

/** 在册十视口（P10fix §10.1：全部 ≥580 高；1366×620 / 1366×650 / 1280×720 /
 *  1536×864 为 E1 高度降级点名档，1200×800 为 A3 补档边界档不单列矩阵组） */
export const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1366, height: 650 },
  { width: 1366, height: 620 },
  { width: 1280, height: 720 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
  { width: 375, height: 667 },
];

/** 低于下限档（物理极限档，H=568 < 580）：不进 PASS 计数，行为登记单独走查 */
export const BELOW_FLOOR_VIEWPORTS = [{ width: 320, height: 568 }];

/** 语言维（P10fix §10.1 扩维；与 src/i18n SUPPORTED_LANGS 同序） */
export const LANGS = ["zh-CN", "zh-Hant", "en"];

export const TASKS = ["freedom", "life", "risk", "principles", "pro"];

export const THEMES = ["light", "dark"];

/** 页内单步状态机（每步一个控制动作 + 断言；供 GUI 通道 ≤3s 预算的 evaluate 逐步驱动）。
 *  游标驻留 window.__zs（页面上下文跨 evaluate 持续）；返回 {done, state, issues, states}。
 *  低于下限档收窄口径由 runSweep 在 gotoTask 后置 window.__zsBelow = true 承载
 *  （本函数经 .toString() 注入页面、闭包不随行——配置只能走 window；页面重载后
 *  默认 undefined = 常规口径）：①放行 wf-fallback-scroll 页根 + 收尾补横幅在位
 *  断言，不产 P1 溢出失败项。 */
export function pageStepFn() {
  return async function inPageStep() {
    const belowFloor = window.__zsBelow === true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rectsIntersect = (a, b) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const assertNow = () => {
      const issues = [];
      const page = document.querySelector(".atlas-page:not([hidden])");
      if (!page) return ["NO_VISIBLE_PAGE"];
      // ①（belowFloor 收窄：页根溢出须伴随显式回退类——放行滚动，无静默裁切）
      if (page.scrollHeight > page.clientHeight) {
        if (belowFloor) {
          if (!page.classList.contains("wf-fallback-scroll")) {
            issues.push(`P1静默裁切 ${page.scrollHeight}>${page.clientHeight}（无 wf-fallback-scroll）`);
          }
        } else {
          issues.push(`P1页面溢出 ${page.scrollHeight}>${page.clientHeight}`);
        }
      }
      // ② 后代内滚枚举（第 2 轮验收 F-05：横向 auto/scroll 同族违例一并拦截——
      //    Arco Table 的 .arco-table-content-inner 横向滚动兜底由此显式可见）
      for (const el of page.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight) {
          if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
            issues.push(`P2内滚 <${el.tagName.toLowerCase()} class=${(el.className || "").toString().slice(0, 40)}> ${el.scrollHeight}>${el.clientHeight}`);
          }
        }
        if (el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === "auto" || cs.overflowX === "scroll")) {
          issues.push(`P2横向内滚 <${el.tagName.toLowerCase()} class=${(el.className || "").toString().slice(0, 40)}> ${el.scrollWidth}>${el.clientWidth}`);
        }
      }
      // ②′ 槽裁切显式拦截（belowFloor 档横幅占流后整页可滚，槽仍禁静默裁切）
      for (const el of page.querySelectorAll(".wf-slot, .wf-reverse-card, .wf-risk-leaf")) {
        if (el.scrollHeight > el.clientHeight) {
          issues.push(`P2槽裁切 <${el.className.split(" ")[0]}> ${el.scrollHeight}>${el.clientHeight}`);
        }
      }
      // ③ 主区禁内滚兜底
      const main = document.getElementById("wf-main");
      if (main) {
        const oy = getComputedStyle(main).overflowY;
        if (oy !== "visible" && oy !== "hidden") {
          issues.push(`P3主区滚动 ${oy}`);
        }
      }
      // ④ pro 活动面板根在视口内（E5 回归闸）
      for (const wrap of page.querySelectorAll(".wf-adv-tabs-wrap:not([hidden])")) {
        const pane = wrap.querySelector(".arco-tabs-content-item-active .arco-tabs-pane");
        if (!pane) {
          issues.push("P4 pro 活动面板根缺失（.arco-tabs-pane）");
          continue;
        }
        const r = pane.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        if (!(r.left >= 0 && r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0)) {
          issues.push(`P4 pro 面板根出视口 left=${Math.round(r.left)} top=${Math.round(r.top)} w=${Math.round(r.width)}`);
        }
      }
      // ⑤ 提示不遮挡（E2/A4）：活动 Message 容器与回退横幅均不得与切换条相交
      const switchEl = document.querySelector(".atlas-switch");
      if (switchEl) {
        const sw = switchEl.getBoundingClientRect();
        for (const pos of ["top", "bottom"]) {
          const wrapEl = document.querySelector(`.arco-message-wrapper-${pos}`);
          if (!wrapEl) continue;
          const mr = wrapEl.getBoundingClientRect();
          if (mr.width > 0 && mr.height > 0 && rectsIntersect(mr, sw)) {
            issues.push(`P5 ${pos} Message 与切换条相交（E2 回归）`);
          }
        }
        const banner = document.querySelector(".wf-fallback-banner");
        if (banner) {
          const br = banner.getBoundingClientRect();
          if (br.width > 0 && rectsIntersect(br, sw)) {
            issues.push(`P5 回退横幅与切换条相交 left=${Math.round(br.left)} top=${Math.round(br.top)}`);
          }
        }
      }
      return issues;
    };
    const waitSettled = async () => {
      // 纯计时等待：后台/节流环境 rAF 可能停摆（浏览器通道实测），React 提交后
      // 固定 240ms 足以覆盖切换淡入（base 档）与防抖外的受控重渲染
      await sleep(240);
    };
    if (!window.__zs) {
      window.__zs = { radios: new Set(), nexts: new Set(), tabs: new Set(), states: 1, failed: [] };
      const issues0 = assertNow();
      if (issues0.length) window.__zs.failed.push({ state: "initial", issues: issues0 });
    }

    const pageEl = document.querySelector(".atlas-page:not([hidden])");
    if (!pageEl) {
      const out = { done: true, state: "no-page", states: window.__zs.states, failed: window.__zs.failed };
      window.__zs = undefined;
      return out;
    }
    // 收尾（belowFloor）：遍历结束时机补一次横幅在位断言（回退守卫 280+320ms 防抖后
    // 横幅必现——下方 done 分支执行）
    let target = null;
    let kind = "";
    for (const input of pageEl.querySelectorAll(".wf-segbar input, .wf-adv-seg input")) {
      if (!input.checked && !window.__zs.radios.has(input)) {
        const label = input.closest("label") || input;
        const rect = label.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !label.closest("[hidden]")) {
          target = input;
          kind = "radio";
          break;
        }
      }
    }
    if (!target) {
      for (const btn of pageEl.querySelectorAll(".wf-slot-pager button")) {
        const label = btn.textContent.trim();
        if (label !== "›" || btn.disabled || window.__zs.nexts.has(btn)) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && !btn.closest("[hidden]")) {
          target = btn;
          kind = "next";
          break;
        }
      }
    }
    if (!target) {
      for (const t of pageEl.querySelectorAll(".arco-tabs-header-title")) {
        if (t.classList.contains("arco-tabs-header-title-active") || window.__zs.tabs.has(t)) continue;
        const rect = t.getBoundingClientRect();
        if (rect.width > 0 && !t.closest("[hidden]")) {
          target = t;
          kind = "tab";
          break;
        }
      }
    }
    if (!target) {
      const failed = window.__zs.failed.slice();
      if (belowFloor) {
        // 低于下限档收尾断言：显式回退横幅须在文档流中（不遮挡由 ⑤逐态兜底），
        // 页根须已放行滚动（无静默裁切）
        const page = pageEl;
        if (!page.classList.contains("wf-fallback-scroll")) {
          failed.push({ state: "final", issues: ["P6 回退横幅态缺失（320×568 预期显式回退）"] });
        }
        if (!document.querySelector(".wf-fallback-banner")) {
          failed.push({ state: "final", issues: ["P6 回退横幅未渲染（红线 9：须明示不静默）"] });
        }
      }
      const out = { done: true, state: "done", states: window.__zs.states, failed };
      window.__zs = undefined;
      return out;
    }
    (kind === "radio" ? window.__zs.radios : kind === "next" ? window.__zs.nexts : window.__zs.tabs).add(target);
    target.click();
    await waitSettled();
    const issues = assertNow();
    window.__zs.states += 1;
    if (issues.length) window.__zs.failed.push({ state: `${kind}:${window.__zs.states}`, issues });
    return { done: false, state: `${kind}:${window.__zs.states}`, issues, states: window.__zs.states };
  }.toString();
}

/**
 * driver 注入执行入口。driver 接口：
 *   setViewport(width, height) — 视口设定（等宽高语义与 CSS 视口一致）；
 *   gotoTask(task) — 携 ?task= 深链导航并等待 domcontentloaded + wasm 就绪；
 *   setTheme(theme) — 写 localStorage["wf-theme"]（defaults.ts THEME_STORAGE_KEY）；
 *   setLang(lang) — 写 localStorage["wf-lang"]（src/i18n/index.ts:15 STORAGE_KEY，
 *     与 setTheme 同构；下次 gotoTask 重载生效）；
 *   evaluate(expr) — 页面上下文执行表达式并返回其值。
 * 返回汇总 JSON（逐 viewport × lang × theme × task 逐组读数登记；在册 300 组 +
 * 低于下限档单独登记组）。语言注入逐组回读 document.documentElement.lang，失效组
 * 作废重跑一次，再失效按 langInjectFailed 单独登记（不计零滚动判定）。
 */
export async function runSweep(driver) {
  const all = [];
  const belowFloorResults = [];
  const belowFloor = new Set(BELOW_FLOOR_VIEWPORTS.map((v) => `${v.width}x${v.height}`));
  const viewports = [...VIEWPORTS, ...BELOW_FLOOR_VIEWPORTS];
  for (const vp of viewports) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        await driver.setViewport(vp.width, vp.height);
        await driver.setTheme(theme);
        await driver.setLang(lang);
        for (const task of TASKS) {
          await driver.gotoTask(task);
          // 语言注入回读确认（R-4 教训：失效组作废重跑；重载一次后仍失效即登记）
          let gotLang = await driver.evaluate("document.documentElement.lang");
          let langInjectFailed = false;
          if (gotLang !== lang) {
            await driver.gotoTask(task);
            gotLang = await driver.evaluate("document.documentElement.lang");
            langInjectFailed = gotLang !== lang;
          }
          const isBelow = belowFloor.has(`${vp.width}x${vp.height}`);
          // 低于下限档口径经 window.__zsBelow 注入页面（pageStepFn 字符串化后闭包不随行）
          await driver.evaluate(`window.__zsBelow = ${isBelow ? "true" : "false"}`);
          const step = await driver.evaluate(`(${pageStepFn()})`);
          const failed = [];
          let states = 0;
          for (let i = 0; i < 60; i += 1) {
            const r = await driver.evaluateStep(step);
            states = r.states;
            if (r.issues?.length) failed.push(...r.issues.map((s) => ({ state: r.state, issue: s })));
            if (r.done) {
              if (r.failed?.length) failed.push(...r.failed.map((f) => ({ state: f.state, issue: f.issues.join("；") })));
              break;
            }
          }
          const record = { task, viewport: vp, lang, theme, states, langInjectFailed, failed, ok: !langInjectFailed && failed.length === 0 };
          if (isBelow) belowFloorResults.push(record);
          else all.push(record);
        }
      }
    }
  }
  const failed = all.filter((r) => !r.ok);
  return {
    viewports: VIEWPORTS,
    langs: LANGS,
    tasks: TASKS,
    themes: THEMES,
    groups: all.length,
    passed: failed.length === 0,
    results: all,
    belowFloor: {
      viewports: BELOW_FLOOR_VIEWPORTS,
      groups: belowFloorResults.length,
      results: belowFloorResults,
      passed: belowFloorResults.every((r) => !r.langInjectFailed && r.failed.length === 0),
    },
  };
}

/* ---- 裸 node 直跑：仅打印用法（不虚报任何结果） ---- */
const isMain = process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  console.log(
    "[zero-scroll-check] 本模块为零滚动 A1 断言承载（在册 10 视口×3 语言×2 主题×5 任务页 = 300 组 + 320×568 低于下限档单独登记）。" +
      "须由 GUI 自动化通道注入 driver 执行（红线 6：零新依赖、不引入测试框架），" +
      "例：browser-use 通道 import { runSweep } 后传入 { setViewport, gotoTask, setTheme, setLang, evaluate, evaluateStep }。" +
      "裸 node 直跑不产生任何断言结果。",
  );
}
