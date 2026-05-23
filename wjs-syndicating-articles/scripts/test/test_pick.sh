#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ART="$TMP/articles"; mkdir -p "$ART/2026-05-10-aaa" "$ART/2026-05-12-ccc" "$ART/2026-05-11-bbb"
# write a fake config pointing at the temp articles dir
CFG="$TMP/config.json"
jq --arg dir "$ART" '.articles_dir=$dir' "$SKILL/config.json" > "$CFG"
export SYND_CONFIG="$CFG"
export SYND_HISTORY="$TMP/history.jsonl"; : > "$SYND_HISTORY"

PICK="$SKILL/scripts/pick-next-article.sh"

# nothing syndicated -> newest folder (ccc, 05-12) is picked
OUT="$(bash "$PICK")"
assert_eq "$(basename "$OUT")" "2026-05-12-ccc" "picks newest by date desc"

# mark ccc fully done -> next newest (bbb, 05-11)
for p in x bluesky threads linkedin facebook xiaohongshu jike zhihu; do
  bash "$SKILL/scripts/history.sh" record 2026-05-12-ccc "$p" posted
done
OUT="$(bash "$PICK")"
assert_eq "$(basename "$OUT")" "2026-05-11-bbb" "skips fully-done, picks next newest"

# mark all done -> empty output, exit 0 (rest day)
for s in 2026-05-11-bbb 2026-05-10-aaa; do
  for p in x bluesky threads linkedin facebook xiaohongshu jike zhihu; do
    bash "$SKILL/scripts/history.sh" record "$s" "$p" posted
  done
done
OUT="$(bash "$PICK")"; CODE=$?
assert_eq "$OUT" "" "all done -> empty output"
assert_exit "$CODE" 0 "all done -> exit 0 (rest day)"

finish test_pick
