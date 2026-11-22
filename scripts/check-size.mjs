#!/usr/bin/env node
/**
 * ============================================================================
 * 尺寸门禁（无第三方依赖，Node >= 18）
 * ============================================================================
 *
 * 统计 dist/ 下全部文件的原始字节总和，以及其中最大 .wasm 文件的字节数；
 * 打印两行汇总（供 CI / 工作流门禁解析）：
 *
 *   DIST_TOTAL_KB=<整数>
 *   WASM_MAX_KB=<整数>
 *
 * 超标判定（exit 1 并打印超标项）：
 *   - dist 全部文件原始字节总和 > 2,000,000 字节；
 *   - 最大 .wasm 文件 > 800,000 字节。
 *
 * KB 一律向上取整（ceil），对门禁偏保守。
 *
 * 用法：先 npm run build，再 node scripts/check-size.mjs（或 npm run check:size）。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST_DIR = "dist";
// P5 回收落地后按既定回滚条件回调（p5-spec §13：组件库按需样式表 denylist purge
// 实测回收 73,380 字节（873 条规则；dry-run 报告与产物差值一致，收口勘误，见 p5-spec §14），
// dist 总量降至 2,000,000 以内）——P4 特批 2,010,000 归档。
// WF-04 特批已按回滚触发器全额归档（工作流升级裁决，2026-11-23）：三巧思落地曾实测破线
// （2,024,438B 峰值），经裁决 C 启用 wasm-opt 真实回收——387,792 → 356,983（-30,809B，
// 同 binaryen 二进制手动 -O + 显式特性允许标志，命令登记 src/wasm/Cargo.toml 注释与
// docs/wf04-spec.md §5.3）——含批 3 全量后 dist 总量 1,980,908B ≤ 2,000,000，触发器条件
// 「回收使 dist ≤ 2,000,000（含批 3 全量）」达成，门禁线恢复 2,000,000 原值。
// 红线语义不变——2,000,000 仍是显式硬限，超标即 exit 1；wasm 单项 800,000 不动。
const TOTAL_LIMIT_BYTES = 2_000_000;
const WASM_LIMIT_BYTES = 800_000;

/** 递归收集目录下的全部普通文件 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue; // 部署快照仓内部对象不属交付产物（p4-spec §11.1）
      out.push(...walk(p));
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

const distDir = join(process.cwd(), DIST_DIR);
if (!existsSync(distDir)) {
  console.error(`[check-size] 未找到 ${DIST_DIR}/ 目录：请先执行 npm run build`);
  process.exit(1);
}

const files = walk(distDir);
if (files.length === 0) {
  console.error(`[check-size] ${DIST_DIR}/ 目录为空：请先执行 npm run build`);
  process.exit(1);
}

let totalBytes = 0;
let wasmMaxBytes = 0;
let wasmMaxFile = "";
let wasmCount = 0;
const rows = [];

for (const file of files) {
  const size = statSync(file).size;
  totalBytes += size;
  const rel = relative(process.cwd(), file).split(sep).join("/");
  rows.push({ rel, size });
  if (rel.endsWith(".wasm")) {
    wasmCount += 1;
    if (size > wasmMaxBytes) {
      wasmMaxBytes = size;
      wasmMaxFile = rel;
    }
  }
}

rows.sort((a, b) => b.size - a.size);
const totalKb = Math.ceil(totalBytes / 1024);
const wasmKb = wasmCount > 0 ? Math.ceil(wasmMaxBytes / 1024) : 0;

// 明细（供人工核查）
console.log(`[check-size] dist 文件数 = ${files.length}，其中 .wasm = ${wasmCount} 个`);
for (const row of rows) {
  console.log(`  ${row.rel}  ${row.size.toLocaleString("en-US")} bytes`);
}

// 门禁解析用的两行汇总
console.log(`DIST_TOTAL_KB=${totalKb}`);
console.log(`WASM_MAX_KB=${wasmKb}`);

// 超标判定
const offenders = [];
if (totalBytes > TOTAL_LIMIT_BYTES) {
  offenders.push(
    `dist 总和超标：${totalBytes.toLocaleString("en-US")} bytes > 限额 ${TOTAL_LIMIT_BYTES.toLocaleString("en-US")} bytes；占用最大的文件：`,
  );
  for (const row of rows.slice(0, 10)) {
    offenders.push(`  ${row.rel}  ${row.size.toLocaleString("en-US")} bytes`);
  }
}
if (wasmCount > 0 && wasmMaxBytes > WASM_LIMIT_BYTES) {
  offenders.push(
    `wasm 超标：${wasmMaxFile} ${wasmMaxBytes.toLocaleString("en-US")} bytes > 限额 ${WASM_LIMIT_BYTES.toLocaleString("en-US")} bytes；全部 .wasm：`,
  );
  for (const row of rows.filter((r) => r.rel.endsWith(".wasm"))) {
    offenders.push(`  ${row.rel}  ${row.size.toLocaleString("en-US")} bytes`);
  }
}
if (wasmCount === 0) {
  offenders.push(
    "警告：dist 中未发现 .wasm 文件（WASM_MAX_KB=0）——请确认 wasm 计算核心的打包接线未丢失。",
  );
}

if (offenders.length > 0) {
  console.error("[check-size] 尺寸门禁未通过：");
  for (const line of offenders) console.error(line);
  process.exit(1);
}

console.log("[check-size] 尺寸门禁通过。");
