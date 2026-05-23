#!/usr/bin/env bash
# Exercises the mechanical pipeline (pick -> dry-run posts -> outbox -> history)
# without network or live SKILL.md orchestration.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

ART="$TMP/articles"; F="$ART/2026-05-20-demo"; mkdir -p "$F"
printf '手感这东西，得每天练。' > "$F/article.md"
printf 'PNG' > "$F/cover.png"
CFG="$TMP/config.json"; jq --arg d "$ART" '.articles_dir=$d' "$SKILL/config.json" > "$CFG"
export SYND_CONFIG="$CFG"; export SYND_HISTORY="$TMP/history.jsonl"; : > "$SYND_HISTORY"
export SYND_SECRETS="$TMP/none.json"   # no creds -> bluesky/threads/linkedin degrade

# pick
PICK="$(bash "$SKILL/scripts/pick-next-article.sh")"
assert_eq "$(basename "$PICK")" "2026-05-20-demo" "e2e: picks the demo article"

# write post.txt (simulating Claude's Step 2) — keep it outside the outbox dir
# so build-outbox.sh can cp it in without a self-copy error
POST_TXT="$TMP/post.txt"
printf '手感这东西，得每天练。\nhttps://mp.weixin.qq.com/x' > "$POST_TXT"
OB="$TMP/outbox/2026-05-20-demo"; mkdir -p "$OB"

# X dry-run ok
bash "$SKILL/scripts/post-x.sh" "$POST_TXT" --dry-run >/dev/null; assert_exit $? 0 "e2e: x dry-run ok"
# bluesky/threads/linkedin degrade (exit 3) with no creds
bash "$SKILL/scripts/post-bluesky.sh" "$POST_TXT" >/dev/null 2>&1; assert_exit $? 3 "e2e: bluesky degrades"
bash "$SKILL/scripts/post-threads.sh" "$POST_TXT" >/dev/null 2>&1; assert_exit $? 3 "e2e: threads degrades"
bash "$SKILL/scripts/post-linkedin.sh" "$POST_TXT" >/dev/null 2>&1; assert_exit $? 3 "e2e: linkedin degrades"

# outbox builds
bash "$SKILL/scripts/build-outbox.sh" "$F" "$POST_TXT" "$OB" >/dev/null
assert_file "$OB/OPEN.md" "e2e: outbox OPEN.md exists"
assert_file "$OB/image.png" "e2e: outbox image exists"

finish test_e2e_dryrun
