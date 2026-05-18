#!/usr/bin/env bash
# Fetch WeChat MP comments via gstack's persistent Chromium profile.
# No manual cookie抓包 — pulls fresh cookie + token from the live browser session
# each time, then hands off to fetch-comments-by-cookie.sh.
#
# Why this exists: raw cookies from DevTools die in a few hours. A real browser
# session, kept warm by occasional use, lasts weeks. gstack already maintains
# a persistent Chromium profile at ~/.gstack/chromium-profile/, so we piggyback
# on that.
#
# One-time setup (per machine):
#   1. $HOME/.claude/skills/gstack/browse/dist/browse goto https://mp.weixin.qq.com/
#   2. Scan the QR code with WeChat to log in.
#   3. Login state now lives in ~/.gstack/chromium-profile/ — survives across
#      sessions / reboots until WeChat actively kicks you out.
#
# One-time setup (per article):
#   Capture the appmsgcomment URL once from DevTools and save to the article folder:
#     1. mp.weixin.qq.com → 留言管理 → click target article
#     2. DevTools → Network → filter "appmsgcomment"
#     3. Click "load more" in the comment UI to trigger a request
#     4. Right-click that request → Copy → Copy URL
#     5. echo 'PASTED_URL' > <article-folder>/comment-url.txt
#
# Per-fetch (zero manual steps):
#   fetch-comments-via-gstack.sh <article-folder> [--md|--json|--both]
#
# What it does:
#   1. browse goto mp.weixin.qq.com/cgi-bin/home   (refresh + verify login)
#   2. browse url   → extract current token=
#   3. browse cookies   → format Cookie header
#   4. Read saved URL pattern, swap token to current
#   5. Hand off to fetch-comments-by-cookie.sh

set -euo pipefail

ARTICLE_DIR="${1:-}"
FORMAT="${2:---md}"

if [[ -z "$ARTICLE_DIR" || ! -d "$ARTICLE_DIR" ]]; then
  cat <<'EOF' >&2
usage: fetch-comments-via-gstack.sh <article-folder> [--md|--json|--both]

prerequisites:
  1. gstack browser logged into mp.weixin.qq.com:
       browse goto https://mp.weixin.qq.com/   (scan QR once)
  2. <article-folder>/comment-url.txt exists with appmsgcomment URL
EOF
  exit 1
fi
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

URL_FILE="$ARTICLE_DIR/comment-url.txt"
if [[ ! -f "$URL_FILE" ]]; then
  cat <<EOF >&2
error: $URL_FILE not found.

First-time-per-article setup:
  1. mp.weixin.qq.com → 留言管理 → click target article
  2. DevTools → Network → filter "appmsgcomment"
  3. Click "load more" to trigger a request
  4. Right-click → Copy → Copy URL (the one with begin=0&count=...)
  5. Save it: echo 'PASTED_URL' > "$URL_FILE"
EOF
  exit 1
fi

B="$HOME/.claude/skills/gstack/browse/dist/browse"
[[ -x "$B" ]] || { echo "error: gstack browse not found at $B" >&2; exit 1; }

URL_PATTERN=$(head -1 "$URL_FILE" | tr -d '\r\n' | awk '{$1=$1; print}')
[[ -n "$URL_PATTERN" ]] || { echo "error: $URL_FILE is empty" >&2; exit 1; }

if ! "$B" status >/dev/null 2>&1; then
  echo "error: gstack browse server is not running. Try: $B status" >&2
  exit 3
fi

# Strategy: don't try to "verify" login by navigating — mp.weixin.qq.com's home
# page is fussy about referrer and will show "请重新登录" even with valid
# cookies if you arrive cold. Just take the token currently in the URL (if any)
# OR fall back to the token in the saved URL pattern, and let fetch-comments
# fail with HTML-response error if cookies are actually stale.

CURRENT_URL=$("$B" url 2>/dev/null | tr -d '\r\n' || true)
TOKEN=""
if [[ "$CURRENT_URL" == *"mp.weixin.qq.com"* ]] && [[ "$CURRENT_URL" == *"token="* ]]; then
  TOKEN=$(printf '%s' "$CURRENT_URL" | grep -oE 'token=[0-9]+' | head -1 | cut -d= -f2)
  echo "  token: $TOKEN  (from current browser URL)" >&2
fi
if [[ -z "$TOKEN" ]]; then
  TOKEN=$(printf '%s' "$URL_PATTERN" | grep -oE 'token=[0-9]+' | head -1 | cut -d= -f2)
  if [[ -z "$TOKEN" ]]; then
    echo "error: no token= in current URL or saved URL pattern. Re-scan QR + re-capture URL." >&2
    exit 1
  fi
  echo "  token: $TOKEN  (from saved comment-url.txt — may be stale)" >&2
fi

COOKIE=$("$B" cookies 2>/dev/null | python3 -c "
import sys, json, urllib.parse
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit('error: browse cookies did not return JSON')
if isinstance(data, dict):
    data = data.get('cookies') or data.get('value') or []
parts = []
for c in data:
    if not isinstance(c, dict): continue
    domain = c.get('domain', '')
    if 'weixin.qq.com' not in domain and 'mp.weixin' not in domain: continue
    name = c.get('name'); val = c.get('value')
    if not name: continue
    # Cookie header must be latin-1-safe; percent-encode any value with high
    # bytes (WeChat's slave_sid sometimes contains an em-dash).
    if any(ord(ch) > 127 for ch in val):
        val = urllib.parse.quote(val, safe='=/:')
    parts.append(f'{name}={val}')
print('; '.join(parts))
")
if [[ -z "$COOKIE" ]]; then
  echo "error: no weixin.qq.com cookies in browser (was login successful?)" >&2
  exit 1
fi
COOKIE_COUNT=$(printf '%s\n' "$COOKIE" | tr ';' '\n' | wc -l | tr -d ' ')
echo "  cookies: $COOKIE_COUNT items" >&2

URL_LIVE=$(printf '%s' "$URL_PATTERN" | sed -E "s/token=[0-9]+/token=$TOKEN/")

echo "→ handing off to fetch-comments-by-cookie.sh ..." >&2
exec "$(dirname "$0")/fetch-comments-by-cookie.sh" "$ARTICLE_DIR" \
  --url "$URL_LIVE" \
  --cookie "$COOKIE" \
  "$FORMAT"
