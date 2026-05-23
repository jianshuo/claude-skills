#!/usr/bin/env bash
# build-outbox.sh <article-folder> <post.txt> <outbox-dir>
# Prepares post.txt + image.png + OPEN.md for the manual (outbox-mode) platforms.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ARTF="${1:?article folder}"; POST_TXT="${2:?post.txt}"; OUTBOX="${3:?outbox dir}"
mkdir -p "$OUTBOX"
[[ "$POST_TXT" -ef "$OUTBOX/post.txt" ]] || cp "$POST_TXT" "$OUTBOX/post.txt"

# hero image: cover.png > illustration.png > none
if   [[ -f "$ARTF/cover.png" ]];        then cp "$ARTF/cover.png" "$OUTBOX/image.png"
elif [[ -f "$ARTF/illustration.png" ]]; then cp "$ARTF/illustration.png" "$OUTBOX/image.png"
fi

POST_BODY="$(cat "$OUTBOX/post.txt")"
{
  echo "# 待发件箱 — 手动平台粘贴指引"
  echo
  echo "文案已在 \`post.txt\`（运行 \`--open\` 时会自动进剪贴板）。主图见 \`image.png\`。"
  echo
  echo "## 文案"
  echo
  echo '```'
  echo "$POST_BODY"
  echo '```'
  echo
  for p in $(enabled_platforms); do
    [[ "$(platform_mode "$p")" == "outbox" ]] || continue
    web="$(jq -r --arg p "$p" '.platforms[$p].web_compose // empty' "$CONFIG")"
    case "$p" in
      facebook)    echo "## Facebook";    echo "- 打开：${web:-https://www.facebook.com/}"; echo "- 粘贴文案 → 发布。" ;;
      jike)        echo "## 即刻";        echo "- 打开：${web:-https://web.okjike.com/}"; echo "- 粘贴文案 → 发布。" ;;
      xiaohongshu) echo "## 小红书";      echo "- 这是手机 App 为主：把 \`image.png\` AirDrop 到手机，文案已在剪贴板，App 内发图文笔记。"; [[ -n "$web" ]] && echo "- 或网页创作者后台：$web" || true ;;
      zhihu)       echo "## 知乎";        echo "- 打开：${web:-https://zhuanlan.zhihu.com/write}（走「想法」短文案，或贴成文章）"; echo "- 粘贴文案 → 发布。" ;;
      *)           echo "## $p"; [[ -n "$web" ]] && echo "- 打开：$web" || true; echo "- 粘贴文案 → 发布。" ;;
    esac
    echo
  done
} > "$OUTBOX/OPEN.md"
echo "outbox=$OUTBOX"
