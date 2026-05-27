#!/usr/bin/env bash
# Pick a 微信公众号 article to tweet from. Two passes:
#   1. freshest un-tweeted article published in the last $MAX_AGE_DAYS days
#   2. fallback: newest un-tweeted article in the WHOLE archive (any age)
# Output: absolute path to the article folder (one line), or empty + exit 1
# only if EVERY article has already been tweeted.
#
# Rotation rule: newest article first (by article.md mtime); skip if its slug
# appears in history.jsonl with status="posted". So we post one per day as long
# as any un-tweeted article exists — a true rest day means the backlog is empty.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$HERE/.." && pwd)"
HISTORY="$SKILL_DIR/state/history.jsonl"
# Read from the LOCAL mirror (daily.sh refreshes it via mirror-articles.py),
# NOT iCloud — launchd-spawned bash can't reliably read iCloud. Falls back to
# the iCloud source if the mirror doesn't exist yet (e.g. interactive first run).
ARTICLES_DIR="$HOME/.local/share/wjs-tweet-articles/articles"
[[ -d "$ARTICLES_DIR" ]] || ARTICLES_DIR="$HOME/code/wechat-publish/articles"
MAX_AGE_DAYS=14

[[ -d "$ARTICLES_DIR" ]] || { echo "error: $ARTICLES_DIR not found" >&2; exit 2; }
[[ -f "$HISTORY" ]] || touch "$HISTORY"

today_epoch=$(date +%s)

# Articles by article.md mtime (most-recently-touched first).
SORTED=$(for d in "$ARTICLES_DIR"/[0-9]*-*/; do
  [[ -f "${d}article.md" ]] || continue
  printf '%s\t%s\n' "$(stat -f %m "${d}article.md")" "$d"
done | sort -rn | cut -f2)

# pick <max_age_days>  — 0 or negative means "no age limit".
# Prints the first un-tweeted folder and returns 0; returns 1 if none.
pick() {
  local cap="$1" folder slug date_part folder_epoch age_days
  while IFS= read -r folder; do
    [[ -n "$folder" ]] || continue
    slug=$(basename "$folder")
    [[ -f "${folder}article.md" ]] || continue

    if [[ "$cap" -gt 0 ]]; then
      date_part="${slug:0:10}"  # YYYY-MM-DD
      folder_epoch=$(date -j -f "%Y-%m-%d" "$date_part" +%s 2>/dev/null || echo 0)
      [[ "$folder_epoch" -gt 0 ]] || continue
      age_days=$(( (today_epoch - folder_epoch) / 86400 ))
      [[ "$age_days" -gt "$cap" ]] && continue
    fi

    # Skip if already posted
    if grep -F "\"slug\":\"${slug}\"" "$HISTORY" 2>/dev/null \
         | grep -qF "\"status\":\"posted\""; then
      continue
    fi

    echo "${folder%/}"
    return 0
  done <<< "$SORTED"
  return 1
}

# Pass 1: freshest un-tweeted within the recency window.
if pick "$MAX_AGE_DAYS"; then exit 0; fi

# Pass 2: fallback — newest un-tweeted article in the whole archive.
echo "no fresh (<=${MAX_AGE_DAYS}d) article; falling back to newest un-tweeted in archive" >&2
if pick 0; then exit 0; fi

echo "every article already tweeted — backlog empty, true rest day" >&2
exit 1
