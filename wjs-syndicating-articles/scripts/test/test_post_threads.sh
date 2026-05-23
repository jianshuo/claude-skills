#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
POST_TXT="$TMP/post.txt"; printf '少跟 AI 聊天，多写程序。' > "$POST_TXT"

export SYND_SECRETS="$TMP/none.json"
bash "$SKILL/scripts/post-threads.sh" "$POST_TXT"; assert_exit $? 3 "missing creds -> exit 3"

echo '{"threads":{"access_token":"tok","user_id":"123"}}' > "$TMP/sec.json"
export SYND_SECRETS="$TMP/sec.json"
OUT="$(bash "$SKILL/scripts/post-threads.sh" "$POST_TXT" --dry-run)"; CODE=$?
assert_exit "$CODE" 0 "dry-run with creds -> exit 0"
assert_contains "$OUT" "少跟 AI 聊天" "dry-run echoes the text"

finish test_post_threads
