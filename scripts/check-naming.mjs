#!/usr/bin/env node
/**
 * 命名审计门禁：src/ 全目录禁词扫描（此前以 node -e 内联执行，本轮固化为
 * 正式脚本以便 CI 化与 check-share/check-data 同列门禁序列）。
 * 用法：node scripts/check-naming.mjs <禁词正则>
 * 退出码：0=通过；1=命中（输出文件:行 清单）。
 */
import fs from "node:fs";
import path from "node:path";

const pattern = process.argv[2];
if (!pattern) {
  console.error("用法：node scripts/check-naming.mjs <禁词正则>");
  process.exit(2);
}
const rx = new RegExp(pattern, "i");
const ROOT = path.resolve("src");
const hits = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.resolve(dir, name);
    // 根边界校验：条目解析后必须仍位于 ROOT 内；符号链接一律跳过（lstat 不跟随）
    if (!p.startsWith(ROOT + path.sep) && p !== ROOT) continue;
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|css|html|json)$/.test(name)) continue;
    const text = fs.readFileSync(p, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (rx.test(lines[i])) {
        hits.push(path.relative(process.cwd(), p) + ":" + (i + 1) + " " + lines[i].trim().slice(0, 120));
      }
    }
  }
}

walk(ROOT);
if (hits.length > 0) {
  console.error("命名审计失败：\n" + hits.join("\n"));
  process.exit(1);
}
console.log("[check-naming] src/ 零禁词命中，审计通过");
