#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export SYND_CONFIG="$SKILL/config.json"

# fake article folder with a cover image
ARTF="$TMP/2026-05-15-demo"; mkdir -p "$ARTF"
printf 'PNGDATA' > "$ARTF/cover.png"
POST_TXT="$TMP/post.txt"; printf '一套文案走天下。\nhttps://mp.weixin.qq.com/x' > "$POST_TXT"
OUTBOX="$TMP/outbox/2026-05-15-demo"

bash "$SKILL/scripts/build-outbox.sh" "$ARTF" "$POST_TXT" "$OUTBOX"
assert_file "$OUTBOX/post.txt" "post.txt copied"
assert_file "$OUTBOX/image.png" "hero image copied"
assert_file "$OUTBOX/OPEN.md" "OPEN.md written"
assert_contains "$(cat "$OUTBOX/OPEN.md")" "小红书" "OPEN.md mentions xiaohongshu"
assert_contains "$(cat "$OUTBOX/OPEN.md")" "okjike.com" "OPEN.md includes jike compose link"

# folder with no cover but illustration -> uses illustration
ARTF2="$TMP/2026-05-16-demo2"; mkdir -p "$ARTF2"; printf 'X' > "$ARTF2/illustration.png"
OUTBOX2="$TMP/outbox/2026-05-16-demo2"
bash "$SKILL/scripts/build-outbox.sh" "$ARTF2" "$POST_TXT" "$OUTBOX2"
assert_file "$OUTBOX2/image.png" "falls back to illustration.png"

# regression: post.txt already inside the outbox dir (src == dst) must not abort
ARTF3="$TMP/2026-05-17-demo3"; mkdir -p "$ARTF3"; printf 'P' > "$ARTF3/cover.png"
OUTBOX3="$TMP/outbox/2026-05-17-demo3"; mkdir -p "$OUTBOX3"
printf '原地文案。' > "$OUTBOX3/post.txt"
bash "$SKILL/scripts/build-outbox.sh" "$ARTF3" "$OUTBOX3/post.txt" "$OUTBOX3"
assert_file "$OUTBOX3/OPEN.md" "OPEN.md written even when post.txt is already in outbox"
assert_contains "$(cat "$OUTBOX3/post.txt")" "原地文案" "in-place post.txt preserved"

finish test_build_outbox
