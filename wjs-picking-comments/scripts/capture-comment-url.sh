#!/usr/bin/env bash
# Capture the appmsgcomment URL for a given article via gstack browser.
# Stores it at <prev-folder>/comment-url.txt for fetch-comments-via-gstack.sh.
#
# Why this exists: the per-article appmsgcomment endpoint requires a
# comment_id that's only obtainable by clicking the article's "N条" link in
# the mp.weixin.qq.com 留言管理 UI and capturing the resulting XHR. This
# script automates that click + capture.
#
# Prerequisites:
#   - gstack browser logged into mp.weixin.qq.com (see wjs-picking-comments
#     SKILL.md Setup section for QR-scan instructions)
#   - <prev-folder>/meta.json with a "title" field matching the published
#     article's title exactly
#
# Usage:
#   capture-comment-url.sh <prev-article-folder>
#
# Output: <prev-folder>/comment-url.txt with the captured URL.
# Exit codes: 0=ok, 1=usage/setup, 2=not logged in, 3=title not found in UI.

set -euo pipefail

FOLDER="${1:-}"
[[ -n "$FOLDER" && -d "$FOLDER" ]] || { echo "usage: capture-comment-url.sh <prev-article-folder>" >&2; exit 1; }
FOLDER="$(cd "$FOLDER" && pwd)"

META="$FOLDER/meta.json"
[[ -f "$META" ]] || { echo "error: $META not found (need title field)" >&2; exit 1; }
TITLE=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('title',''))" "$META")
[[ -n "$TITLE" ]] || { echo "error: no title in $META" >&2; exit 1; }

B="$HOME/.claude/skills/gstack/browse/dist/browse"
[[ -x "$B" ]] || { echo "error: gstack browse not found at $B" >&2; exit 1; }
"$B" status >/dev/null 2>&1 || { echo "error: gstack browse server not running" >&2; exit 1; }

# Need a valid token. Try current URL; if not on a logged-in page, go to home.
get_token() {
  "$B" url 2>/dev/null | grep -oE 'token=[0-9]+' | head -1 | cut -d= -f2 || true
}
TOKEN=$(get_token)
if [[ -z "$TOKEN" ]]; then
  echo "→ refreshing session (no token in current URL) ..." >&2
  "$B" goto "https://mp.weixin.qq.com/cgi-bin/home" >/dev/null 2>&1 || true
  "$B" wait --networkidle >/dev/null 2>&1 || true
  TOKEN=$(get_token)
fi
if [[ -z "$TOKEN" ]]; then
  cat <<EOF >&2
error: gstack browser not logged into mp.weixin.qq.com.

Setup:
  $B goto https://mp.weixin.qq.com/
  $B screenshot --viewport /tmp/qr.png && open /tmp/qr.png
  # scan QR with WeChat, then re-run this script
EOF
  exit 2
fi
echo "  token: $TOKEN" >&2

# Navigate to the 留言管理 page (lists all articles + their comment counts).
echo "→ opening 留言管理 ..." >&2
"$B" goto "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_latest_comment&begin=0&count=10&sendtype=MASSSEND&scene=1&token=$TOKEN&lang=zh_CN" >/dev/null
"$B" wait --networkidle >/dev/null 2>&1 || true

# Verify logged in via DOM probe (URL check is unreliable here).
LOGIN=$("$B" js "(document.body.innerText.includes('请重新登录')||document.body.innerText.includes('登录超时'))?'OUT':'IN'" 2>/dev/null | tail -1 | tr -d '\r\n ')
if [[ "$LOGIN" != "IN" ]]; then
  echo "error: session expired on 留言管理 page. Re-scan QR." >&2
  exit 2
fi

# Find the article row matching TITLE and click its "N条" count link, then
# read the XHR URL out of the network log. Use a small JS snippet to do the
# find-and-click atomically — much safer than snapshot ref hunting.
echo "→ finding row '$TITLE' and triggering its comment list ..." >&2
"$B" network --clear >/dev/null

TITLE_JS=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$TITLE")
CLICK_RESULT=$("$B" js "
(() => {
  const target = $TITLE_JS;
  // Each article row has a clickable title element + a sibling 'N条' count.
  // Walk all elements with cursor:pointer; find one whose innerText starts
  // with the target title, then locate the nearest following 'N条' sibling
  // within the same row container.
  const all = Array.from(document.querySelectorAll('*'));
  const titleEl = all.find(el => {
    const t = (el.innerText || '').trim();
    return t === target || (t.startsWith(target) && t.length < target.length + 30);
  });
  if (!titleEl) return 'NOT_FOUND';
  // Walk up to find the row container that also contains an 'N条' element.
  let row = titleEl;
  let countEl = null;
  for (let i=0; i<6 && row && !countEl; i++) {
    countEl = Array.from(row.querySelectorAll('*')).find(e => /^\d+条$/.test((e.innerText||'').trim()));
    if (!countEl) row = row.parentElement;
  }
  if (!countEl) return 'NO_COUNT';
  countEl.click();
  return 'CLICKED:' + countEl.innerText.trim();
})()
" 2>&1 | tail -1 | tr -d '\r\n ')

if [[ "$CLICK_RESULT" == "NOT_FOUND" ]]; then
  echo "error: article title not found in 留言管理 list. Title: $TITLE" >&2
  echo "       maybe it's on page 2+? scroll/paginate in the UI first, or edit meta.json title to match." >&2
  exit 3
fi
if [[ "$CLICK_RESULT" == "NO_COUNT" ]]; then
  echo "error: found article row but no 'N条' count element in it" >&2
  exit 3
fi
echo "  $CLICK_RESULT" >&2

# Click triggers an XHR — wait for network activity to settle, then scan log.
"$B" wait --networkidle >/dev/null 2>&1 || true
sleep 1
URL=$("$B" network 2>/dev/null | grep -oE 'https://mp\.weixin\.qq\.com/misc/appmsgcomment\?action=list_comment[^[:space:]]+' | head -1)

if [[ -z "$URL" ]]; then
  echo "error: no appmsgcomment list_comment URL found in network log after click" >&2
  echo "  network log tail:" >&2
  "$B" network 2>&1 | grep -i appmsgcomment | tail -5 >&2
  exit 3
fi

OUT="$FOLDER/comment-url.txt"
echo "$URL" > "$OUT"
echo "→ saved: $OUT" >&2
echo "$URL"
