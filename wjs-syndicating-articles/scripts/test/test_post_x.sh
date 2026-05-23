#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

POST_TXT="$TMP/post.txt"; printf '手感这东西，得每天练。\nhttps://mp.weixin.qq.com/x' > "$POST_TXT"

OUT="$(bash "$SKILL/scripts/post-x.sh" "$POST_TXT" --dry-run)"; CODE=$?
assert_exit "$CODE" 0 "dry-run exits 0"
assert_contains "$OUT" '"text"' "dry-run prints JSON payload with text field"
assert_contains "$OUT" "手感这东西" "dry-run payload contains the copy"

finish test_post_x
