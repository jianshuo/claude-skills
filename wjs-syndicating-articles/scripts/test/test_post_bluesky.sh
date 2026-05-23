#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

POST_TXT="$TMP/post.txt"; printf '手感这东西，得每天练。' > "$POST_TXT"

# no secrets file -> exit 3 (degrade)
export SYND_SECRETS="$TMP/none.json"
bash "$SKILL/scripts/post-bluesky.sh" "$POST_TXT"; assert_exit $? 3 "missing secrets -> exit 3"

# secrets present but dry-run -> exit 0, no network
echo '{"bluesky":{"handle":"me.bsky.social","app_password":"abcd"}}' > "$TMP/sec.json"
export SYND_SECRETS="$TMP/sec.json"
OUT="$(bash "$SKILL/scripts/post-bluesky.sh" "$POST_TXT" --dry-run)"; CODE=$?
assert_exit "$CODE" 0 "dry-run with creds -> exit 0"
assert_contains "$OUT" "手感这东西" "dry-run echoes the text"

# secrets file present but incomplete (no app_password) -> exit 3
echo '{"bluesky":{"handle":"me.bsky.social"}}' > "$TMP/partial.json"
export SYND_SECRETS="$TMP/partial.json"
bash "$SKILL/scripts/post-bluesky.sh" "$POST_TXT"; assert_exit $? 3 "incomplete creds -> exit 3"

finish test_post_bluesky
