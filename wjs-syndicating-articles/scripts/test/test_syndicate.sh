#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/assert.sh"
SKILL="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

ART="$TMP/articles"; F="$ART/2026-05-20-demo"; mkdir -p "$F"; printf 'P' > "$F/cover.png"
PT="$TMP/post.txt"; printf '一套文案。\nhttps://mp.weixin.qq.com/x' > "$PT"
export SYND_HISTORY="$TMP/history.jsonl"; : > "$SYND_HISTORY"
export SYND_SECRETS="$TMP/none.json"            # no creds -> api platforms degrade
export SYND_TW_HISTORY="$TMP/tw_none.jsonl"; : > "$SYND_TW_HISTORY"
SYN="$SKILL/scripts/syndicate.sh"

# --- dry-run writes NO history ---
CFG_DRY="$TMP/cfg_dry.json"; jq --arg d "$ART" '.articles_dir=$d' "$SKILL/config.json" > "$CFG_DRY"
export SYND_CONFIG="$CFG_DRY"
OUT="$(bash "$SYN" "$F" "$PT" --dry-run)"; CODE=$?
assert_exit "$CODE" 0 "dry-run exits 0"
assert_contains "$OUT" "2026-05-20-demo" "dry-run prints basename slug"
assert_eq "$(wc -l < "$SYND_HISTORY" | tr -d ' ')" "0" "dry-run writes no history"

# --- real run with X forced to outbox mode (no network at all) ---
CFG="$TMP/cfg.json"; jq --arg d "$ART" '.articles_dir=$d | .platforms.x.mode="outbox"' "$SKILL/config.json" > "$CFG"
export SYND_CONFIG="$CFG"
: > "$SYND_HISTORY"
bash "$SYN" "$F" "$PT" >/dev/null
# slug recorded must be the basename
assert_eq "$(jq -r 'select(.platform=="bluesky").slug' "$SYND_HISTORY")" "2026-05-20-demo" "history slug = folder basename"
# bluesky/threads/linkedin degrade to queued no_creds
assert_eq "$(jq -r 'select(.platform=="bluesky").status' "$SYND_HISTORY")" "queued" "bluesky queued (no creds)"
assert_eq "$(jq -r 'select(.platform=="bluesky").reason' "$SYND_HISTORY")" "no_creds" "bluesky reason no_creds"
# all 8 platforms recorded exactly once
assert_eq "$(wc -l < "$SYND_HISTORY" | tr -d ' ')" "8" "all 8 platforms recorded once"
# outbox built (no double date prefix)
assert_file "$SKILL/outbox/2026-05-20-demo/OPEN.md" "outbox OPEN.md at outbox/<basename>"
# idempotent: rerun does not add duplicates
bash "$SYN" "$F" "$PT" >/dev/null
assert_eq "$(wc -l < "$SYND_HISTORY" | tr -d ' ')" "8" "rerun adds no duplicates (idempotent)"

# --- X cross-skill dedup: tweeting history already posted this slug -> x skipped, no network ---
CFG2="$TMP/cfg2.json"; jq --arg d "$ART" '.articles_dir=$d' "$SKILL/config.json" > "$CFG2"  # x stays api
export SYND_CONFIG="$CFG2"
: > "$SYND_HISTORY"
echo '{"slug":"2026-05-20-demo","status":"posted"}' > "$SYND_TW_HISTORY"
bash "$SYN" "$F" "$PT" >/dev/null
assert_eq "$(jq -r 'select(.platform=="x").status' "$SYND_HISTORY")" "skipped" "x skipped via tweeting-skill dedup (no real post)"

# cleanup any outbox this test created
rm -rf "$SKILL/outbox/2026-05-20-demo"
finish test_syndicate
