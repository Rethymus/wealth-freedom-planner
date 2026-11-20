#!/usr/bin/env node
/**
 * ============================================================================
 * 币种换算样本断言（p4-spec §3.8；零第三方运行时依赖——esbuild 随 vite 在依赖树内，
 * i18n 键集检查已有同流程先例）
 * ============================================================================
 *
 * 经 esbuild 把 src/services/currency.ts 转译后在 Node 内以 node:assert 断言五组：
 *  1. cnyToDisplay(1_635_200, 0.14) ≈ 228,928（ε = 1e-6；mock rate 0.14 的二进制近似
 *     使浮点积 ≈ 228928.00000000003，用 ε 比较，不用严格相等）
 *  2. displayToCny(228_928, 0.14) === 1,635,200（逆向精确回写）
 *  3. cnyToDisplay(-34_710.24, 0.14) ≈ -4,859.4336（ε = 1e-9；负值符号保真——收租净现金流；
 *     期望值为精确算术值，node -e 实测 -34710.24 × 0.14 = -4859.4336 无浮点误差项）
 *  4. pickRate 缺币种 / 非法值 → null（符号-only 信号）；CNY 恒 1
 *  5. 往返漂移：对样本值 × 两组 rate，|displayToCny(cnyToDisplay(v, r), r) − v| ≤ 1 CNY
 *
 * 用法：node scripts/check-currency.mjs（或 npm run check:currency）
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { transformSync } from "esbuild";

// 1) 转译 src/services/currency.ts（纯函数模块，零 import，bundle 无依赖）
const src = new URL("../src/services/currency.ts", import.meta.url);
const source = (await import("node:fs")).readFileSync(src, "utf8");
const { code } = transformSync(source, { loader: "ts", format: "esm", target: "es2020" });

// 2) 写入临时目录后动态 import（临时目录用后即删，不落仓内）
const dir = mkdtempSync(join(tmpdir(), "wf-check-currency-"));
const outFile = join(dir, "currency.mjs");
writeFileSync(outFile, code, "utf8");
const { cnyToDisplay, displayToCny, pickRate } = await import(pathToFileURL(outFile).href);

try {
  // 断言 1：ask 指定样本（mock rate 0.14）
  const fwd = cnyToDisplay(1_635_200, 0.14);
  assert.ok(
    Math.abs(fwd - 228_928) <= 1e-6,
    `断言 1 失败：cnyToDisplay(1635200, 0.14) = ${fwd}，期望 ≈ 228928`,
  );

  // 断言 2：逆向精确回写
  const back = displayToCny(228_928, 0.14);
  assert.equal(back, 1_635_200, `断言 2 失败：displayToCny(228928, 0.14) = ${back}，期望 1635200`);

  // 断言 3：负值符号保真（收租净现金流；精确算术值无浮点误差项）
  const neg = cnyToDisplay(-34_710.24, 0.14);
  assert.ok(
    Math.abs(neg - -4_859.4336) <= 1e-9,
    `断言 3 失败：cnyToDisplay(-34710.24, 0.14) = ${neg}，期望 ≈ -4859.4336`,
  );

  // 断言 4：pickRate 合法 / 缺币种 / 非法值 / CNY 恒等
  assert.equal(pickRate({ USD: 0.14 }, "USD"), 0.14, "断言 4a 失败：合法汇率应原样返回");
  assert.equal(pickRate({}, "USD"), null, "断言 4b 失败：缺币种应返回 null");
  assert.equal(pickRate({ USD: -1 }, "USD"), null, "断言 4c 失败：非法值应返回 null");
  assert.equal(pickRate({}, "CNY"), 1, "断言 4d 失败：CNY 应恒为 1");

  // 断言 5：往返漂移 ≤ 1 CNY
  const values = [0, 1, 2990, 1_635_200, 1e9];
  const rates = [0.14, 20.9];
  for (const v of values) {
    for (const r of rates) {
      const drift = Math.abs(displayToCny(cnyToDisplay(v, r), r) - v);
      assert.ok(
        drift <= 1,
        `断言 5 失败：v=${v} r=${r} 往返漂移 ${drift} > 1 CNY`,
      );
    }
  }

  console.log("[check-currency] 五组样本断言全部通过（p4-spec §3.8）。");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
