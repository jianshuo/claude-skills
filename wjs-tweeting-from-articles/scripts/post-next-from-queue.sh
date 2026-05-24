#!/usr/bin/env bash
# Post the next queued tweet via xurl, at most one per MIN_GAP seconds.
# Designed to be called hourly by cron — it self-throttles to a 4h spacing.
#
# Queue:  state/queue-<DATE>.tsv   (idx<TAB>slug<TAB>text, one per line)
# Cursor: state/queue-cursor       (1-based index of the next tweet to post)
# Gap:    state/last-post-epoch     (epoch of the last successful post)
# Log:    state/queue-post.log
#
# Env:
#   QUEUE_FILE   override the queue path (default: newest state/queue-*.tsv)
#   MIN_GAP      seconds between posts (default 14400 = 4h)
#   FORCE=1      ignore MIN_GAP (used to fire the first tweet immediately)
#
# Exit 0 always on "nothing to do" (too soon / queue drained) so cron stays quiet.

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ST="$SKILL_DIR/state"
LOG="$ST/queue-post.log"
HIST="$ST/history.jsonl"
CURSOR="$ST/queue-cursor"
EPOCH="$ST/last-post-epoch"
LOCK="$ST/.queue.lock"
MIN_GAP="${MIN_GAP:-14400}"
QUEUE_FILE="${QUEUE_FILE:-$(ls -t "$ST"/queue-*.tsv 2>/dev/null | head -1)}"

log(){ printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }

# Single-runner lock (mkdir is atomic). Stale lock >10min is reclaimed.
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -d "$LOCK" ] && [ "$(( $(date +%s) - $(stat -f %m "$LOCK") ))" -gt 600 ]; then
    rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" 2>/dev/null || exit 0
  else exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

[ -n "$QUEUE_FILE" ] && [ -f "$QUEUE_FILE" ] || { log "no queue file"; exit 0; }
[ -f "$CURSOR" ] || echo 1 > "$CURSOR"
idx=$(cat "$CURSOR")
total=$(grep -c . "$QUEUE_FILE")

if [ "$idx" -gt "$total" ]; then
  log "queue drained ($total posted) — removing cron"
  ( crontab -l 2>/dev/null | grep -v 'post-next-from-queue.sh' ) | crontab - 2>/dev/null
  exit 0
fi

# Throttle: skip if last post was < MIN_GAP ago (unless FORCE).
if [ "${FORCE:-0}" != "1" ] && [ -f "$EPOCH" ]; then
  last=$(cat "$EPOCH"); now=$(date +%s)
  if [ "$(( now - last ))" -lt "$(( MIN_GAP - 120 ))" ]; then
    exit 0   # too soon, stay quiet
  fi
fi

line=$(awk -F'\t' -v i="$idx" '$1==i{print;exit}' "$QUEUE_FILE")
[ -n "$line" ] || { log "no line for idx=$idx"; exit 0; }
slug=$(printf '%s' "$line" | cut -f2)
text=$(printf '%s' "$line" | cut -f3-)

JSON=$(jq -nc --arg t "$text" '{text:$t}')
resp=$(xurl -X POST -d "$JSON" /2/tweets 2>&1)
tid=$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')

if [ -z "$tid" ]; then
  log "POST failed idx=$idx slug=$slug :: $(printf '%s' "$resp" | tr '\n' ' ' | cut -c1-300)"
  exit 1   # do NOT advance cursor; cron retries next hour
fi

date +%s > "$EPOCH"
echo "$(( idx + 1 ))" > "$CURSOR"
jq -nc --arg date "$(date +%F)" --arg slug "$slug" --arg angle "queue" \
       --arg tweet_id "$tid" --arg text "$text" \
       '{date:$date,slug:$slug,angle:$angle,tweet_id:$tweet_id,text:$text,status:"posted"}' >> "$HIST"
log "posted idx=$idx slug=$slug https://x.com/jianshuo/status/$tid"
echo "https://x.com/jianshuo/status/$tid"
