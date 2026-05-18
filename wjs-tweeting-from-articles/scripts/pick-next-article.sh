#!/usr/bin/env bash
# Find the most recent 微信公众号 article that hasn't been tweeted yet.
# Output: absolute path to the article folder (one line), or empty + exit 1
# if no unposted article in last 14 days.
#
# Rotation rule: newest article first; skip if its slug appears in
# history.jsonl with status="posted".

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$HERE/.." && pwd)"
HISTORY="$SKILL_DIR/state/history.jsonl"
ARTICLES_DIR="$HOME/code/wechat-publish/articles"
MAX_AGE_DAYS=14

[[ -d "$ARTICLES_DIR" ]] || { echo "error: $ARTICLES_DIR not found" >&2; exit 2; }
[[ -f "$HISTORY" ]] || touch "$HISTORY"

today_epoch=$(date +%s)

# Walk articles newest-first
for folder in $(ls -1d "$ARTICLES_DIR"/[0-9]*-*/ 2>/dev/null | sort -r); do
  slug=$(basename "$folder")
  date_part="${slug:0:10}"  # YYYY-MM-DD
  folder_epoch=$(date -j -f "%Y-%m-%d" "$date_part" +%s 2>/dev/null || echo 0)
  [[ "$folder_epoch" -gt 0 ]] || continue

  age_days=$(( (today_epoch - folder_epoch) / 86400 ))
  [[ "$age_days" -gt "$MAX_AGE_DAYS" ]] && continue

  [[ -f "${folder}article.md" ]] || continue

  # Skip if already posted
  if grep -F "\"slug\":\"${slug}\"" "$HISTORY" 2>/dev/null \
       | grep -qF "\"status\":\"posted\""; then
    continue
  fi

  echo "${folder%/}"
  exit 0
done

echo "no unposted article in last $MAX_AGE_DAYS days" >&2
exit 1
