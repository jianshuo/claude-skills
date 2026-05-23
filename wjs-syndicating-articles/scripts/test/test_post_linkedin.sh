#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
POST_TXT="$TMP/post.txt"; printf 'Skill 是函数，不是文档。' > "$POST_TXT"

export SYND_SECRETS="$TMP/none.json"
bash "$SKILL/scripts/post-linkedin.sh" "$POST_TXT"; assert_exit $? 3 "missing creds -> exit 3"

echo '{"linkedin":{"access_token":"tok","author_urn":"urn:li:person:abc"}}' > "$TMP/sec.json"
export SYND_SECRETS="$TMP/sec.json"
OUT="$(bash "$SKILL/scripts/post-linkedin.sh" "$POST_TXT" --dry-run)"; CODE=$?
assert_exit "$CODE" 0 "dry-run with creds -> exit 0"
assert_contains "$OUT" "Skill 是函数" "dry-run echoes the text"
assert_contains "$OUT" "urn:li:person:abc" "dry-run shows author urn"

finish test_post_linkedin
