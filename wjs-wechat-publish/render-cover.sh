#!/usr/bin/env bash
# Render cover image (900x383 PNG) for WeChat 公众号 主封面.
# Usage: render-cover.sh <title> [subtitle] [author] [output_path]

set -euo pipefail

TITLE="${1:-}"
SUBTITLE="${2:-}"
AUTHOR="${3:-}"
OUT="${4:-./cover.png}"

if [[ -z "$TITLE" ]]; then
  echo "usage: $0 <title> [subtitle] [author] [output_path]" >&2
  exit 1
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SKILL_DIR/cover-template.html"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "error: template not found at $TEMPLATE" >&2
  exit 1
fi

# URL-encode helper (handles Chinese chars)
urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

ENCODED_TITLE=$(urlencode "$TITLE")
ENCODED_SUB=$(urlencode "$SUBTITLE")
ENCODED_AUTHOR=$(urlencode "$AUTHOR")

# Stage template under /tmp so browse/Chrome file:// scope check passes.
# (browse daemon allowlists /private/tmp; macOS $TMPDIR points elsewhere.)
STAGE_DIR="/tmp/wechat-cover-$$"
mkdir -p "$STAGE_DIR"
STAGED="$STAGE_DIR/cover.html"
cp "$TEMPLATE" "$STAGED"
URL="file://${STAGED}?title=${ENCODED_TITLE}&subtitle=${ENCODED_SUB}&author=${ENCODED_AUTHOR}"

OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
mkdir -p "$(dirname "$OUT_ABS")"

# Strategy 1: gstack browse daemon (fastest if available)
B=""
if [[ -x "$HOME/.claude/skills/gstack/browse/dist/browse" ]]; then
  B="$HOME/.claude/skills/gstack/browse/dist/browse"
fi

if [[ -n "$B" ]]; then
  "$B" viewport 900x383 >/dev/null
  "$B" goto "$URL" >/dev/null
  "$B" wait --networkidle >/dev/null 2>&1 || true
  "$B" screenshot "$OUT_ABS" >/dev/null
  echo "rendered (browse): $OUT_ABS"
  exit 0
fi

# Strategy 2: headless Chrome / Chromium (macOS default paths)
CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v chromium 2>/dev/null || true)" \
  "$(command -v chrome 2>/dev/null || true)"; do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo "error: no headless browser found (gstack browse, Chrome, Chromium, or Edge)" >&2
  exit 1
fi

TMP="$(mktemp -d)"
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --window-size=900,383 \
  --screenshot="$TMP/shot.png" \
  --default-background-color=00000000 \
  "$URL" >/dev/null 2>&1

if [[ ! -s "$TMP/shot.png" ]]; then
  echo "error: chrome produced empty screenshot" >&2
  exit 1
fi

mv "$TMP/shot.png" "$OUT_ABS"
rm -rf "$TMP" "$STAGE_DIR"
echo "rendered (chrome): $OUT_ABS"
