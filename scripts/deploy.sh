#!/usr/bin/env bash
# ============================================================================
# GitHub Pages 部署脚本（bash / Git Bash 下运行：bash scripts/deploy.sh）
# ============================================================================
#
# 部署命令序列（按规格）：
#   npm run build
#   → cd dist && touch .nojekyll
#   → git add -A && git commit
#   → git push origin HEAD:gh-pages --force
#
# GitHub Pages 设置（一次性，在仓库 Settings → Pages 中配置）：
#   Source: Deploy from a branch
#   Branch: gh-pages
#   Folder: / (root)
#
# 本仓库不创建 .github/workflows（不走 GitHub Actions 部署，全部本地完成）。
#
# 实现说明：dist/ 使用独立 git 仓库承载部署快照（vue-cli 风格的 gh-pages
# 部署模式），使「git add -A && git commit」产生的 HEAD 快照就是 dist 内容
# 本身（树根即 index.html 与 .nojekyll），与 Pages 的 / (root) 设置匹配。
# 若在仓库根直接执行同一序列，gh-pages 的树根将是整个源码仓（根目录没有
# index.html），Pages 会 404。dist/ 已被外层 .gitignore 忽略，内层仓库不
# 会进入源码仓。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "[deploy] npm run build ..."
npm run build

cd dist
touch .nojekyll

# dist 独立部署仓库（幂等：已有 .git 则跳过）
if [ ! -d .git ]; then
  git init -q
fi

# origin 指向源码仓的 origin（同一仓库的不同分支 gh-pages）
OUTER_ORIGIN_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$OUTER_ORIGIN_URL"
else
  git remote add origin "$OUTER_ORIGIN_URL"
fi

git add -A

if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  git commit -m "deploy: GitHub Pages build $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
else
  echo "[deploy] dist 无变更，跳过 commit（仍执行 force push 以对齐远端）"
fi

git push origin HEAD:gh-pages --force

echo "[deploy] 完成：dist 快照已强推到 gh-pages 分支。"
echo "[deploy] 请确认仓库 Settings → Pages：Source: Deploy from a branch / Branch: gh-pages / Folder: / (root)"
