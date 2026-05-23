#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ART="$TMP/articles"; mkdir -p "$ART/2026-05-10-aaa" "$ART/2026-05-12-ccc" "$ART/2026-05-11-bbb"
CFG="$TMP/config.json"
jq --arg dir "$ART" '.articles_dir=$dir' "$SKILL/config.json" > "$CFG"
export SYND_CONFIG="$CFG"
export SYND_HISTORY="$TMP/history.jsonl"; : > "$SYND_HISTORY"

PICK="$SKILL/scripts/pick-next-article.sh"

# nothing syndicated -> newest folder (ccc, 05-12) is picked
OUT="$(bash "$PICK")"
assert_eq "$(basename "$OUT")" "2026-05-12-ccc" "picks newest by date desc"

# mark the NEWEST (ccc) fully done -> rest day (empty), does NOT fall back to older bbb
for p in x bluesky threads linkedin facebook xiaohongshu jike zhihu; do
  bash "$SKILL/scripts/history.sh" record 2026-05-12-ccc "$p" posted
done
OUT="$(bash "$PICK")"; CODE=$?
assert_eq "$OUT" "" "newest already done -> empty (no backfill of older articles)"
assert_exit "$CODE" 0 "rest day -> exit 0"

finish test_pick
