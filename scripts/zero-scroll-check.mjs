/**
 * ============================================================================
 * 零滚动自检脚本（docs/p10-spec.md §9-A1 程序化断言的机读承载；扩展六视口）
 * ============================================================================
 * 判定（A1 三重 + P10 槽裁切探测）：
 *   ① 页根（.atlas-page:not([hidden])）scrollHeight ≤ clientHeight；
 *   ② 页根全部后代可滚动元素枚举——任一后代 scrollHeight > clientHeight 且
 *      computed overflowY ∈ {auto, scroll} 即挂（禁内滚兜底）；
 *   ②′ 槽裁切探测（P10 扩围，比 A1 更严）：.wf-slot / .wf-reverse-card /
 *      .wf-risk-leaf（overflow:hidden 载体）任一 scrollHeight > clientHeight 即挂
 *      ——overflow:hidden 不触发 ②，静默裁切必须由本判定显式拦截；
 *   ③ Content（#wf-main）computed overflowY ∈ {visible, hidden}（禁内滚兜底）。
 *
 * 遍历协议（visitedTasks 门控下的前置遍历 + 叶/槽贪心遍历）：
 *   - 先经任务切换逐页首展挂载（App.tsx visitedTasks），再逐页遍历；
 *   - 每页内：贪心点击「可见且未点击过的 SegBar 单选钮」与「启用的 SlotPager 前进钮」，
 *     每次点击后等待落定（rAF×2 + 260ms）并断言；状态空间由贪心深度上限约束；
 *   - 任一判定失败即记录失败项（不中断遍历，末尾汇总 exit code）。
 *
 * 运行通道：本模块导出 VIEWPORTS / TASKS / runSweep(driver)，供 GUI 自动化通道
 * （browser-use IAB/CDP 等，红线 6：不引入测试框架/新依赖）注入 driver 执行；
 * 裸 node 直跑仅打印用法（无浏览器驱动时不虚报结果）。
 * driver 接口：{ setViewport(w, h), gotoTask(task), evaluate(fn) } —— evaluate 在
 * 应用页面上下文执行注入的贪心遍历（点击 via el.click()，读数 via computed style）。
 */

export const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 667 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
];

export const TASKS = ["freedom", "life", "risk", "principles", "pro"];

export const THEMES = ["light", "dark"];

/** 页内单步状态机（每步一个控制动作 + 断言；供 GUI 通道 ≤3s 预算的 evaluate 逐步驱动）。
 *  游标驻留 window.__zs（页面上下文跨 evaluate 持续）；返回 {done, state, issues, states}。 */
export function pageStepFn() {
  return async function inPageStep() {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const assertNow = () => {
      const issues = [];
      const page = document.querySelector(".atlas-page:not([hidden])");
      if (!page) return ["NO_VISIBLE_PAGE"];
      if (page.scrollHeight > page.clientHeight) {
        issues.push(`P1页面溢出 ${page.scrollHeight}>${page.clientHeight}`);
      }
      for (const el of page.querySelectorAll("*")) {
        if (el.scrollHeight <= el.clientHeight) continue;
        const oy = getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") {
          issues.push(`P2内滚 <${el.tagName.toLowerCase()} class=${(el.className || "").toString().slice(0, 40)}> ${el.scrollHeight}>${el.clientHeight}`);
        }
      }
      for (const el of page.querySelectorAll(".wf-slot, .wf-reverse-card, .wf-risk-leaf")) {
        if (el.scrollHeight > el.clientHeight) {
          issues.push(`P2槽裁切 <${el.className.split(" ")[0]}> ${el.scrollHeight}>${el.clientHeight}`);
        }
      }
      const main = document.getElementById("wf-main");
      if (main) {
        const oy = getComputedStyle(main).overflowY;
        if (oy !== "visible" && oy !== "hidden") {
          issues.push(`P3主区滚动 ${oy}`);
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
      const out = { done: true, state: "done", states: window.__zs.states, failed: window.__zs.failed };
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
 *   evaluate(fnSrc) — 页面上下文执行（fnSrc = pageStepFn() 的函数字符串，逐步驱动，
 *   单步 ≤3s 通道预算内；节点侧循环至 done）。
 * 返回汇总 JSON（逐 viewport × theme × task 逐组读数登记）。
 */
export async function runSweep(driver) {
  const all = [];
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await driver.setViewport(vp.width, vp.height);
      await driver.setTheme(theme);
      for (const task of TASKS) {
        await driver.gotoTask(task);
        const step = await driver.evaluate(`(${pageStepFn()})`);
        const failed = [];
        let states = 0;
        for (let i = 0; i < 60; i += 1) {
          const r = await driver.evaluateStep(step);
          states = r.states;
          if (r.issues?.length) failed.push(...r.issues.map((s) => ({ state: r.state, issue: s })));
          if (r.done) break;
        }
        all.push({ task, viewport: vp, theme, states, failed, ok: failed.length === 0 });
      }
    }
  }
  const failed = all.filter((r) => !r.ok);
  return {
    viewports: VIEWPORTS,
    tasks: TASKS,
    themes: THEMES,
    groups: all.length,
    passed: failed.length === 0,
    results: all,
  };
}

/* ---- 裸 node 直跑：仅打印用法（不虚报任何结果） ---- */
const isMain = process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  console.log(
    "[zero-scroll-check] 本模块为零滚动 A1 断言承载（六视口×五任务页×两主题）。" +
      "须由 GUI 自动化通道注入 driver 执行（红线 6：零新依赖、不引入测试框架），" +
      "例：browser-use 通道 import { runSweep } 后传入 { setViewport, gotoTask, setTheme, evaluate }。" +
      "裸 node 直跑不产生任何断言结果。",
  );
}
