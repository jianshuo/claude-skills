#!/usr/bin/env bash
# Tier 1 publish helper for 微信公众号.
# Opens mp.weixin.qq.com, reveals cover.png in Finder, puts the article body
# HTML on the clipboard as rich text, and offers an interactive menu to swap
# the clipboard between title / author / summary / body.
#
# Usage:
#   publish.sh                  # uses current directory
#   publish.sh <article-folder>

set -euo pipefail

ARTICLE_DIR="${1:-$(pwd)}"
if [[ ! -d "$ARTICLE_DIR" ]]; then
  echo "error: not a directory: $ARTICLE_DIR" >&2
  exit 1
fi
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

META="$ARTICLE_DIR/meta.json"
HTML="$ARTICLE_DIR/article.html"

# Cover may be png or jpg
COVER=""
for ext in png jpg jpeg; do
  if [[ -f "$ARTICLE_DIR/cover.$ext" ]]; then
    COVER="$ARTICLE_DIR/cover.$ext"
    break
  fi
done

for f in "$META" "$HTML"; do
  if [[ ! -f "$f" ]]; then
    echo "error: missing $f" >&2
    echo "       run /wechat-publish first to generate the article folder" >&2
    exit 1
  fi
done

if [[ -z "$COVER" ]]; then
  echo "warn: no cover.png/jpg found in $ARTICLE_DIR (cover step skipped)" >&2
fi

# Read meta with python (handles unicode reliably)
read_meta() {
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],''))" "$META" "$1"
}
TITLE="$(read_meta title)"
AUTHOR="$(read_meta author)"
SUMMARY="$(read_meta summary)"

# --- clipboard helpers ---

copy_text() {
  printf "%s" "$1" | pbcopy
}

# Put rich-text HTML on the clipboard so a Cmd+V into the WeChat editor
# preserves paragraph structure. Uses macOS «class HTML» pasteboard type.
copy_html_richtext() {
  osascript <<APPLESCRIPT
set htmlFile to POSIX file "$HTML"
set htmlData to (read htmlFile as «class HTML»)
set the clipboard to htmlData
APPLESCRIPT
}

# --- actions ---

# Open WeChat editor (new tab in default browser)
open "https://mp.weixin.qq.com/" >/dev/null 2>&1 || true

# Reveal cover in Finder so user can drag it into the editor
if [[ -n "$COVER" ]]; then
  open -R "$COVER" >/dev/null 2>&1 || true
fi

# Open article.html in a browser tab as fallback (if rich-text clipboard fails,
# user can switch to that tab and Cmd+A → Cmd+C from the rendered page)
open "$HTML" >/dev/null 2>&1 || true

# Default clipboard = body HTML (rich text)
copy_html_richtext

clear
cat <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀  准备发布：$TITLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✓ 浏览器：mp.weixin.qq.com 已打开（扫码登录）
  ✓ 浏览器：article.html 已打开（备用，可 Cmd+A → Cmd+C）
EOF
if [[ -n "$COVER" ]]; then
  echo "  ✓ Finder ：$(basename "$COVER") 已显示（拖到编辑器封面区）"
fi
cat <<EOF
  ✓ 剪贴板：正文 HTML（rich text）已就绪 → 在编辑器正文 Cmd+V

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  按数字切换剪贴板内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1] 标题   $TITLE
  [2] 作者   $AUTHOR
  [3] 摘要   $SUMMARY
  [4] 正文   (重新放到剪贴板)
  [q] 退出

EOF

# If no TTY (e.g. invoked from a non-interactive runner), skip the menu —
# side effects above are already done.
if [[ ! -t 0 ]]; then
  echo "  (no TTY — skipping interactive menu; clipboard already set to body HTML)"
  echo "  to use the menu, run this in a real terminal:"
  echo "    $0 $ARTICLE_DIR"
  exit 0
fi

while true; do
  printf "  按 1 / 2 / 3 / 4 / q： "
  IFS= read -r -n 1 key
  echo
  case "$key" in
    1) copy_text "$TITLE";        echo "     → 标题已复制" ;;
    2) copy_text "$AUTHOR";       echo "     → 作者已复制" ;;
    3) copy_text "$SUMMARY";      echo "     → 摘要已复制" ;;
    4) copy_html_richtext;        echo "     → 正文 HTML（rich text）已复制" ;;
    q|Q) echo "     bye"; exit 0 ;;
    "")  ;;
    *)   echo "     ?" ;;
  esac
done
