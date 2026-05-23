#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export SYND_CONFIG="$SKILL/config.json"
export SYND_HISTORY="$TMP/history.jsonl"

H="$SKILL/scripts/history.sh"

# initially nothing recorded -> has returns 1
bash "$H" has slugA x; assert_exit $? 1 "has on empty history -> 1"

# record a posted X -> has returns 0
bash "$H" record slugA x posted "https://x.com/u/1" "1"
bash "$H" has slugA x; assert_exit $? 0 "has after posted -> 0"

# queued counts as done
bash "$H" record slugA facebook queued "" "" no_creds
bash "$H" has slugA facebook; assert_exit $? 0 "has after queued -> 0"

# failed does NOT count as done (retry)
bash "$H" record slugA bluesky failed
bash "$H" has slugA bluesky; assert_exit $? 1 "has after failed -> 1 (retry)"

# fully-done: slugA not done until ALL enabled platforms done
bash "$H" fully-done slugA; assert_exit $? 1 "fully-done false while some platforms missing"

# record done for every enabled platform
for p in x bluesky threads linkedin facebook xiaohongshu jike zhihu; do
  bash "$H" record slugA "$p" queued
done
bash "$H" fully-done slugA; assert_exit $? 0 "fully-done true after all platforms done"

# the recorded line is valid JSON with expected fields
LINE="$(grep '"platform":"x"' "$SYND_HISTORY" | head -1)"
assert_eq "$(echo "$LINE" | jq -r .status)" "posted" "x record status posted"
assert_eq "$(echo "$LINE" | jq -r .url)" "https://x.com/u/1" "x record url"

finish test_history
