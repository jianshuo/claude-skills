#!/usr/bin/env bash
# Daily 09:00 entry point. Picks the most-recently-touched article that hasn't
# been tweeted yet, asks Claude headless to draft + pick a tweet, posts it via
# xurl, logs to history.jsonl.
#
# Env overrides:
#   DRY_RUN=1                       → draft + pick + log, but don't actually post
#   FORCE_FOLDER=<absolute path>    → bypass pick-next-article.sh
#   FORCE_ANGLE=A|B|C               → bypass Claude's angle pick (uses simple
#                                     extraction from the chosen angle)

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
export PATH

# launchd has no proxy env; the Anthropic API (claude -p draft) needs the local
# proxy from China or it 403s. Match the interactive shell's proxy.
export HTTPS_PROXY="http://127.0.0.1:1087" HTTP_PROXY="http://127.0.0.1:1087"
export https_proxy="http://127.0.0.1:1087" http_proxy="http://127.0.0.1:1087"
export ALL_PROXY="socks5://127.0.0.1:1087" NO_PROXY="localhost,127.0.0.1,::1"

LOG_DIR="${HOME}/Library/Logs/wjs-tweeting-from-articles"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/daily-$(date +%Y-%m-%d).log"
exec > >(tee -a "$LOG") 2>&1

echo "=== wjs-tweeting-from-articles daily.sh start: $(date -Iseconds) ==="
echo "DRY_RUN=${DRY_RUN:-0} FORCE_FOLDER=${FORCE_FOLDER:-<auto>}"

for bin in claude xurl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FATAL: missing $bin"; exit 1; }
done

today="$(date +%Y-%m-%d)"
STATE_DIR="${HERE}/state"
HISTORY="${STATE_DIR}/history.jsonl"
mkdir -p "$STATE_DIR"
touch "$HISTORY"

# Hourly mode: NO per-day cap. pick-next-article.sh only ever returns an
# un-tweeted article (dedup by slug in history.jsonl), so each hourly run posts
# a DIFFERENT article — one new tweet per hour until the backlog is empty.
# (To restore once-per-day, re-add a guard on "\"date\":\"${today}\"" + posted.)

# --- Step 0: refresh local mirror of iCloud articles (python3 reads iCloud
# fine from launchd; bash doesn't). Picker then reads the local mirror. ---
python3 "${HERE}/scripts/mirror-articles.py" || echo "WARN: mirror refresh failed (picker will use whatever's already mirrored / iCloud fallback)"

# --- Step 1: pick article ---
if [[ -n "${FORCE_FOLDER:-}" ]]; then
  FOLDER="$FORCE_FOLDER"
  [[ -d "$FOLDER" && -f "$FOLDER/article.md" ]] || {
    echo "FATAL: FORCE_FOLDER invalid: $FOLDER"; exit 1;
  }
else
  if ! FOLDER=$("${HERE}/scripts/pick-next-article.sh"); then
    echo "No article to tweet from. REST_DAY."
    echo "{\"date\":\"${today}\",\"status\":\"rest_day\"}" >> "$HISTORY"
    exit 0
  fi
fi
SLUG=$(basename "$FOLDER")
echo "Picked: $FOLDER (slug: $SLUG)"

# --- Step 2: Claude headless drafts + picks ---
TWEET_FILE="${STATE_DIR}/today-tweet.txt"
ANGLE_FILE="${STATE_DIR}/today-angle.txt"
rm -f "$TWEET_FILE" "$ANGLE_FILE"

prompt=$(cat <<EOF
Read the article at:
  $FOLDER/article.md

Draft 3 tweet candidates for X (Twitter), each from a different angle:
- A · 金句 — quote the strongest single sentence (or short couplet) from the article, optionally with a one-line lead-in
- B · 反差 — sharp "not X, is Y" cognitive flip
- C · 小灾难 — the "every day, most attempts fail, but failure is the data" rhythm

Hard constraints on each candidate:
- ≤ 140 Chinese characters (X allows 280 latin = 140 CJK characters)
- Preserve 王建硕 voice: plain, honest, conversational, family-style metaphors
- NO hashtags, NO @mentions, NO emoji (unless original article has them), NO marketing tone
- Material MUST come from the article text — do not invent new examples
- NO mp.weixin link, NO "click here", NO call-to-action

Then pick the strongest of the 3 (the one with most resonance + tightest line).

Write ONLY the chosen tweet text (exactly what should be posted, no quotes around it, no metadata) to:
  $TWEET_FILE

Write the letter (A or B or C) to:
  $ANGLE_FILE

Do not output anything else. Do not write a summary. Just write those two files.
EOF
)

echo "→ asking Claude to draft + pick ..."
# IMPORTANT: --allowedTools is variadic, will eat the prompt positional arg if
# space-separated. Use `=` form OR put `--` before the prompt. Also DON'T use
# --bare (requires ANTHROPIC_API_KEY; daily user is OAuth via keychain).
claude -p --allowedTools=Read,Write -- "$prompt" || {
  echo "FATAL: claude drafting failed"
  echo "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"draft_failed\"}" >> "$HISTORY"
  exit 1
}

[[ -f "$TWEET_FILE" ]] || {
  echo "FATAL: claude did not write $TWEET_FILE"
  echo "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"status\":\"no_tweet_file\"}" >> "$HISTORY"
  exit 1
}
TWEET_TEXT=$(cat "$TWEET_FILE")
ANGLE=$(cat "$ANGLE_FILE" 2>/dev/null | tr -d '\r\n ' || echo "?")
CHARS=$(printf '%s' "$TWEET_TEXT" | wc -m | tr -d ' ')

echo "Angle: $ANGLE"
echo "Chars: $CHARS"
echo "--- tweet ---"
echo "$TWEET_TEXT"
echo "--- end tweet ---"

# --- Step 3: POST ---
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN — not posting."
  TEXT_JSON=$(printf '%s' "$TWEET_TEXT" | jq -Rs .)
  echo "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"angle\":\"${ANGLE}\",\"chars\":${CHARS},\"status\":\"dry_run\",\"text\":${TEXT_JSON}}" >> "$HISTORY"
  exit 0
fi

JSON=$(jq -nc --arg text "$TWEET_TEXT" '{text:$text}')
resp=$(xurl -X POST -d "$JSON" /2/tweets 2>&1)
# X API returns raw newlines in echoed `text` — jq rejects them. Grep id instead.
TWEET_ID=$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')
if [[ -z "$TWEET_ID" ]]; then
  echo "FATAL: post returned no id"
  echo "$resp"
  echo "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"angle\":\"${ANGLE}\",\"status\":\"post_failed\"}" >> "$HISTORY"
  exit 1
fi
TWEET_URL="https://x.com/jianshuo/status/${TWEET_ID}"
echo "✓ Posted: $TWEET_URL"

# --- Step 4: history ---
TEXT_JSON=$(printf '%s' "$TWEET_TEXT" | jq -Rs .)
echo "{\"date\":\"${today}\",\"slug\":\"${SLUG}\",\"angle\":\"${ANGLE}\",\"chars\":${CHARS},\"tweet_id\":\"${TWEET_ID}\",\"tweet_url\":\"${TWEET_URL}\",\"text\":${TEXT_JSON},\"status\":\"posted\"}" >> "$HISTORY"

echo "=== done: $(date -Iseconds) ==="
