#!/bin/bash
# 在服务器上从 GitHub 安装或更新本 skill。每次开始写书前跑一次；重复跑是安全的。
#
#   bash install.sh            安装/更新到 $BEACON_BOOK_ROOT（缺省 /opt/claude-agent/workspace/beacon-books）
#
# 做的事：克隆（或拉取）公开仓库 jianshuo/claude-skills，只检出本 skill；校验脚本语法和必需文件；
# 校验不过就退回更新前的版本，保证代理拿到的永远是一份能用的 skill。
set -euo pipefail

ROOT="${BEACON_BOOK_ROOT:-/opt/claude-agent/workspace/beacon-books}"
REPO_URL="https://github.com/jianshuo/claude-skills.git"
NAME="wjs-beacon-ticker-book"
REPO="$ROOT/.claude-skills"

mkdir -p "$ROOT/books" "$ROOT/out"

if [ ! -d "$REPO/.git" ]; then
  git clone --quiet --depth 1 --filter=blob:none --sparse "$REPO_URL" "$REPO"
  git -C "$REPO" sparse-checkout set "$NAME"
  PREV=""
else
  PREV=$(git -C "$REPO" rev-parse HEAD)
  git -C "$REPO" fetch --quiet --depth 1 origin main
  git -C "$REPO" reset --quiet --hard origin/main
fi

check() {
  local d="$REPO/$NAME"
  for f in SKILL.md WRITING.md RUNBOOK.md book.template.json scripts/fetch_facts.py scripts/fetch_events.py \
           scripts/build.py scripts/upload.py live/common.js live/08.html live/10.html live/12.html; do
    [ -s "$d/$f" ] || { echo "缺文件：$f"; return 1; }
  done
  python3 -m py_compile "$d"/scripts/*.py || return 1
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$d/book.template.json" || return 1
}

if ! check; then
  if [ -n "$PREV" ]; then
    git -C "$REPO" reset --quiet --hard "$PREV"
    echo "新版本校验不过，已退回 ${PREV:0:7}"
  else
    echo "首次安装校验不过"; exit 1
  fi
fi

ln -sfn ".claude-skills/$NAME" "$ROOT/skill"
echo "skill 就绪：$(git -C "$REPO" rev-parse --short HEAD)（$(git -C "$REPO" log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M'))"
