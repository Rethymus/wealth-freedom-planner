#!/usr/bin/env node
/**
 * ============================================================================
 * wasm 尺寸回收（构建链固定步骤，无第三方依赖，Node >= 18）
 * ============================================================================
 *
 * 背景（docs/wf04-spec.md §5.3 / src/wasm/Cargo.toml 注释登记，2026-11-23）：
 * - Cargo.toml 元数据 wasm-opt = false：wasm-pack 自带 binaryen v117 的默认特性集
 *   不含 bulk-memory / 非陷阱浮点转整（trunc_sat），自动后处理校验整败，不可置 true；
 * - 正典回收 = 同一 binaryen 二进制手动后处理 + 显式特性允许标志：
 *     wasm-opt <pkg>/finance_core_bg.wasm -o <同文件> -O --enable-bulk-memory --enable-nontrapping-float-to-int
 *   实测 387,792 → 356,983 B（−30,809 B）；
 * - src/wasm/pkg/.gitignore 为 *（pkg 不入库），wasm-pack 重建即丢失手动后处理
 *   （2026-11-23 门禁修复轮实证复发：dist 回到未回收 387,792 B，总量 2,011,717 B
 *   超硬线 11,717 B）——本脚本把上述登记命令固化为 npm run build 链内、vite build
 *   之前的固定步骤，保证每次构建 dist 内 wasm 均为回收后字节。
 *
 * 设计约束：
 * - 在 vite build 之前优化 pkg 源文件（不在构建后改 dist）：vite 资产内容 hash 与
 *   PWA 预缓存清单同源于最终字节（p5-spec §13 同源不变量不被打破）；
 * - 重复运行幂等无害（-O 对已优化输入确定性收敛）；
 * - 找不到 wasm-opt 二进制：告警后放行（exit 0）——尺寸门禁（check-size）仍是硬线
 *   执法者，构建不在无工具链的机器上被阻断；
 * - 二进制在但执行失败：exit 1 阻断构建——不带病产出超标产物。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const WASM_PATH = join("src", "wasm", "pkg", "finance_core_bg.wasm");
// 与 src/wasm/Cargo.toml 注释登记的命令逐字一致（元数据路线保持 false 不动）
const OPT_FLAGS = ["-O", "--enable-bulk-memory", "--enable-nontrapping-float-to-int"];

/** 查找 wasm-opt：优先 wasm-pack 附带 binaryen，兜底 PATH（Unix CI 等场景） */
function findWasmOpt() {
  const exeName = process.platform === "win32" ? "wasm-opt.exe" : "wasm-opt";
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const wasmPackDir = join(localAppData, ".wasm-pack");
    if (existsSync(wasmPackDir)) {
      const candidates = readdirSync(wasmPackDir)
        .filter((entry) => entry.startsWith("wasm-opt-"))
        .sort();
      for (const entry of candidates) {
        const exe = join(wasmPackDir, entry, "bin", exeName);
        if (existsSync(exe)) return exe;
      }
    }
  }
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [exeName.replace(/\.exe$/, "")], {
    encoding: "utf8",
  });
  if (probe.status === 0) {
    const first = probe.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first && existsSync(first)) return first;
  }
  return "";
}

if (!existsSync(WASM_PATH)) {
  console.warn(`[optimize-wasm] 未找到 ${WASM_PATH}（wasm-pack 产物缺失），跳过回收。`);
  process.exit(0);
}

const before = statSync(WASM_PATH).size;
const exe = findWasmOpt();
if (!exe) {
  console.warn(
    "[optimize-wasm] 未找到 wasm-opt（wasm-pack 工具链目录与 PATH 均无），跳过回收——" +
      "dist 将携带未回收 wasm，尺寸门禁（check-size）按硬线执法。",
  );
  process.exit(0);
}

// 原位回收：binaryen 先整读输入再写输出，同路径输入输出即登记命令原形
const res = spawnSync(exe, [WASM_PATH, "-o", WASM_PATH, ...OPT_FLAGS], { encoding: "utf8" });
if (res.status !== 0 || res.error) {
  console.error(`[optimize-wasm] wasm-opt 执行失败（退出码 ${res.status}）：${exe}`);
  if (res.stderr) console.error(res.stderr.trim());
  if (res.error) console.error(String(res.error));
  process.exit(1);
}
const after = statSync(WASM_PATH).size;
console.log(
  `[optimize-wasm] ${WASM_PATH}  ${before.toLocaleString("en-US")} → ${after.toLocaleString("en-US")} bytes（${exe}）`,
);
