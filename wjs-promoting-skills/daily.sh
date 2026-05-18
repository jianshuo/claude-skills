#!/usr/bin/env bash
# Daily 4 AM entry point.
# What it does:
#   1. pick today's skill (rotation rules in pick-next-skill.sh)
#   2. ensure that skill has a marketing plan (make-plan.sh if missing/stale)
#   3. ask Claude to write today's X post (daily-post.md prompt)
#   4. post via xurl (unless DRY_RUN=1)
#   5. ask Claude to draft community posts into outbox/<date>/
#   6. append a line to state/history.jsonl
#
# Env overrides:
#   DRY_RUN=1          → do everything except actually post to X
#   SKILL=<name>       → force this skill (bypasses rotation)
#   FORCE=1            → bypass 7-day skip
#   PLAN_MAX_AGE_DAYS  → regenerate plan if older than this (default 30)

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
export PATH

LOG_DIR="${HOME}/Library/Logs/wjs-promoting-skills"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/daily-$(date +%Y-%m-%d).log"
exec > >(tee -a "$LOG") 2>&1

echo "=== wjs-promoting-skills daily.sh start: $(date -Iseconds) ==="
echo "DRY_RUN=${DRY_RUN:-0} SKILL=${SKILL:-<auto>} FORCE=${FORCE:-0}"

# --- Prereqs ---
for bin in claude xurl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "FATAL: missing dependency: $bin"
    exit 1
  fi
done

today="$(date +%Y-%m-%d)"
STATE_DIR="${HERE}/state"
HISTORY="${STATE_DIR}/history.jsonl"
mkdir -p "$STATE_DIR" "${STATE_DIR}/plans" "${HERE}/outbox"
touch "$HISTORY"

# --- Step 1: Pick skill ---
SKILL_NAME="$(${HERE}/pick-next-skill.sh)" || {
  rc=$?
  if [[ $rc -eq 1 ]]; then
    echo "REST_DAY — no skill qualifies today. Exiting cleanly."
    echo "{\"date\":\"${today}\",\"skill\":null,\"status\":\"rest_day\"}" >> "$HISTORY"
    exit 0
  fi
  echo "FATAL: pick-next-skill.sh failed with code $rc"
  exit $rc
}
echo "Today's skill: ${SKILL_NAME}"

SKILL_DIR="${HOME}/.claude/skills/${SKILL_NAME}"

# --- Step 2: 7-day skip check (unless FORCE=1) ---
if [[ "${FORCE:-0}" != "1" ]]; then
  last_post_date=$(grep -F "\"skill\":\"${SKILL_NAME}\"" "$HISTORY" 2>/dev/null \
                   | grep "\"status\":\"posted\"" \
                   | tail -1 \
                   | sed -E 's/.*"date":"([^"]+)".*/\1/')
  if [[ -n "$last_post_date" ]]; then
    last_epoch=$(date -j -f "%Y-%m-%d" "$last_post_date" +%s 2>/dev/null || echo 0)
    today_epoch=$(date +%s)
    days=$(( (today_epoch - last_epoch) / 86400 ))
    if [[ $days -lt 7 ]]; then
      echo "SKIP: ${SKILL_NAME} was posted ${days} days ago (< 7). Exiting."
      echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"skip_too_recent\",\"days_since\":${days}}" >> "$HISTORY"
      exit 0
    fi
  fi
fi

# --- Step 3: Ensure plan exists and is fresh ---
PLAN="${STATE_DIR}/plans/${SKILL_NAME}.md"
PLAN_MAX_AGE_DAYS="${PLAN_MAX_AGE_DAYS:-30}"
need_plan=0
if [[ ! -f "$PLAN" ]]; then
  echo "No plan yet for ${SKILL_NAME} — generating."
  need_plan=1
else
  plan_mtime=$(stat -f %m "$PLAN")
  plan_age_days=$(( ($(date +%s) - plan_mtime) / 86400 ))
  if [[ $plan_age_days -gt $PLAN_MAX_AGE_DAYS ]]; then
    echo "Plan is ${plan_age_days} days old (> ${PLAN_MAX_AGE_DAYS}) — regenerating."
    need_plan=1
  fi
fi
if [[ $need_plan -eq 1 ]]; then
  if ! "${HERE}/make-plan.sh" "$SKILL_NAME"; then
    echo "WARN: make-plan.sh failed; will try to post without a fresh plan."
  fi
fi

# --- Step 4: Generate today's X post ---
OUTBOX_DIR="${HERE}/outbox/${today}"
mkdir -p "$OUTBOX_DIR"
OUT_TXT="${OUTBOX_DIR}/x-draft.txt"

export SKILL="$SKILL_NAME"
export OUT_TXT
prompt=$(sed "s|\${SKILL}|${SKILL_NAME}|g; s|\${OUT_TXT}|${OUT_TXT}|g" "${HERE}/prompts/daily-post.md")

echo "Drafting X post → ${OUT_TXT}"
claude -p \
  --bare \
  --allowedTools "Read,Write,Bash(git -C *:*),Bash(git log:*),Bash(jq *)" \
  "$prompt" || {
    echo "FATAL: claude failed to draft post"
    echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"draft_failed\"}" >> "$HISTORY"
    exit 1
  }

if [[ ! -f "$OUT_TXT" ]]; then
  echo "FATAL: ${OUT_TXT} not written"
  echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"no_output_file\"}" >> "$HISTORY"
  exit 1
fi

post_text=$(cat "$OUT_TXT")

# Sentinel values from the prompt
case "$post_text" in
  __NO_REPO__*)
    echo "SKIP: skill has no resolvable repo URL."
    echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"no_repo_url\"}" >> "$HISTORY"
    exit 0
    ;;
  __SKIP_TOO_RECENT__*)
    echo "SKIP: prompt determined too-recent."
    echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"skip_too_recent_in_prompt\"}" >> "$HISTORY"
    exit 0
    ;;
esac

chars=$(printf '%s' "$post_text" | wc -c | tr -d ' ')
echo "Draft (${chars} chars):"
echo "----"
echo "$post_text"
echo "----"

# --- Step 5: Post to X (unless DRY_RUN) ---
TWEET_ID=""
TWEET_URL=""
STATUS="posted"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN=1 — skipping X post."
  STATUS="dry_run"
else
  # JSON-escape the post text safely with jq
  json_body=$(jq -nc --arg t "$post_text" '{text: $t}')
  echo "Posting to X..."
  resp=$(xurl -X POST -d "$json_body" /2/tweets 2>&1) || {
    echo "FATAL: xurl post failed"
    echo "Response: $resp"
    echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"post_failed\",\"error\":$(echo "$resp" | jq -Rs .)}" >> "$HISTORY"
    exit 1
  }
  TWEET_ID=$(printf '%s' "$resp" | jq -r '.data.id // empty')
  if [[ -z "$TWEET_ID" ]]; then
    echo "FATAL: xurl returned no tweet id"
    echo "Response: $resp"
    echo "{\"date\":\"${today}\",\"skill\":\"${SKILL_NAME}\",\"status\":\"no_tweet_id\",\"error\":$(echo "$resp" | jq -Rs .)}" >> "$HISTORY"
    exit 1
  fi
  TWEET_URL="https://x.com/jianshuo/status/${TWEET_ID}"
  echo "Posted: ${TWEET_URL}"
  # Archive the actual posted text
  cp "$OUT_TXT" "${OUTBOX_DIR}/x-posted.txt"
fi

# --- Step 6: Draft community posts ---
export POSTED_X="${OUTBOX_DIR}/x-posted.txt"
[[ -f "$POSTED_X" ]] || POSTED_X="$OUT_TXT"
export OUTBOX_DIR

drafts_prompt=$(sed "s|\${SKILL}|${SKILL_NAME}|g; s|\${POSTED_X}|${POSTED_X}|g; s|\${OUTBOX_DIR}|${OUTBOX_DIR}|g" \
                "${HERE}/prompts/community-drafts.md")

echo "Drafting community posts → ${OUTBOX_DIR}/"
claude -p \
  --bare \
  --allowedTools "Read,Write,Bash(git -C *:*)" \
  "$drafts_prompt" || echo "WARN: community drafts failed (non-fatal)"

# --- Step 7: Log to history.jsonl ---
log_line=$(jq -nc \
  --arg date "$today" \
  --arg skill "$SKILL_NAME" \
  --arg status "$STATUS" \
  --argjson chars "$chars" \
  --arg tweet_id "$TWEET_ID" \
  --arg tweet_url "$TWEET_URL" \
  '{date:$date, skill:$skill, status:$status, chars:$chars, tweet_id:$tweet_id, tweet_url:$tweet_url}')
echo "$log_line" >> "$HISTORY"

# --- Step 8: Weekly research refresh (Sundays) ---
if [[ "$(date +%u)" == "7" ]] && [[ "${DRY_RUN:-0}" != "1" ]]; then
  echo "Sunday — refreshing marketplace research."
  "${HERE}/research-marketplaces.sh" || echo "WARN: research refresh failed (non-fatal)"
fi

echo "=== wjs-promoting-skills daily.sh done: $(date -Iseconds) ==="
