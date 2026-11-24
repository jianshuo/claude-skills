#!/bin/bash
# 本机：把这个 skill 的改动提交并推到 GitHub（jianshuo/claude-skills）。
#
#   ./publish.sh              检查 → 提交 → 推送（没有改动就什么都不做）
#   ./publish.sh --install    推送后立刻让服务器从 GitHub 装上并校验
#   ./publish.sh --hook       给 Claude Code 的编辑钩子用：只在刚改的文件属于本 skill 时才动，安静模式
#
# 只提交本 skill 目录下的文件，不碰仓库里别的 skill。
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPO="$(cd "$DIR/.." && pwd -P)"
NAME="$(basename "$DIR")"
MODE="${1:-}"

if [ "$MODE" = "--hook" ]; then
  # 钩子从标准输入拿到这次编辑的文件路径；不是本 skill 的文件就直接退出
  FILE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)
  REAL=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$FILE" 2>/dev/null || true)
  case "$REAL" in "$DIR"/*) ;; *) exit 0 ;; esac
fi

say() { [ "$MODE" = "--hook" ] || echo "$@"; }

# 检查：脚本语法、模板是合法 JSON、SKILL.md 开头格式、没有把密钥写进来
python3 -m py_compile "$DIR"/scripts/*.py || { echo "wjs-beacon-ticker-book：脚本语法错，没有推送"; exit 2; }
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$DIR/book.template.json" || { echo "wjs-beacon-ticker-book：book.template.json 不是合法 JSON，没有推送"; exit 2; }
bash -n "$DIR/install.sh" || { echo "wjs-beacon-ticker-book：install.sh 语法错，没有推送"; exit 2; }
[ -x "$REPO/scripts/lint_skill.py" ] && { "$REPO/scripts/lint_skill.py" "$DIR/SKILL.md" >/dev/null || { echo "wjs-beacon-ticker-book：SKILL.md 开头格式不对，没有推送"; exit 2; }; }
SECRETS='(sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9_-]{24,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(com|dev|net|org))'
LEAKS=$(grep -rInoE "$SECRETS" "$DIR" --exclude=publish.sh --exclude-dir=__pycache__ | grep -v -E "example\.com|git@github\.com" || true)
if [ -n "$LEAKS" ]; then
  echo "wjs-beacon-ticker-book：文件里像是有密钥或邮箱（这个仓库是公开的），没有推送："
  echo "$LEAKS" | cut -c1-160
  exit 2
fi

cd "$REPO" || exit 1
git add -A -- "$NAME"
if git diff --cached --quiet -- "$NAME"; then
  say "没有改动"
else
  CHANGED=$(git diff --cached --name-only -- "$NAME" | sed "s#^$NAME/##" | tr '\n' ' ')
  git commit --quiet -m "update $NAME: $CHANGED" -- "$NAME" || exit 1
  if git push --quiet origin HEAD 2>/dev/null || { git pull --quiet --rebase origin main && git push --quiet origin HEAD; }; then
    say "已推送 $(git rev-parse --short HEAD)：$CHANGED"
  else
    echo "wjs-beacon-ticker-book：提交了但没推上去，稍后手动跑 ./publish.sh"; exit 1
  fi
fi

if [ "$MODE" = "--install" ]; then
  echo "让服务器从 GitHub 安装…"
  ssh -o BatchMode=yes -o ConnectTimeout=15 -o HostKeyAlias=149.28.16.135 root@lab.jianshuo.dev \
    "sudo -u engine-router env HOME=/opt/engine-router bash -s" < "$DIR/install.sh"
fi
