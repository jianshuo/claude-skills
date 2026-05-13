#!/usr/bin/env bash
# List all wjs-* skills with their last-promotion date from history.jsonl.
# Output: TSV — skill_name<TAB>last_posted_date<TAB>days_since
# "never" / "9999" for skills that have never been posted.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${HOME}/.claude/skills"
HISTORY="${HERE}/state/history.jsonl"

today_epoch=$(date +%s)

for d in "${SKILLS_DIR}"/wjs-*/; do
  [[ -d "$d" ]] || continue
  name=$(basename "$d")
  # Skip self
  [[ "$name" == "wjs-promoting-skills" ]] && continue
  # Skip if no SKILL.md
  [[ -f "${d}SKILL.md" ]] || continue

  if [[ -f "$HISTORY" ]]; then
    # Only count successful posts — failed/skipped attempts don't reset the rotation clock.
    last_date=$(grep -F "\"skill\":\"${name}\"" "$HISTORY" 2>/dev/null \
                | grep -F "\"status\":\"posted\"" \
                | tail -1 \
                | sed -E 's/.*"date":"([^"]+)".*/\1/')
  else
    last_date=""
  fi

  if [[ -z "$last_date" ]]; then
    printf '%s\tnever\t9999\n' "$name"
  else
    last_epoch=$(date -j -f "%Y-%m-%d" "$last_date" +%s 2>/dev/null || echo 0)
    if [[ "$last_epoch" -eq 0 ]]; then
      printf '%s\t%s\t9999\n' "$name" "$last_date"
    else
      days=$(( (today_epoch - last_epoch) / 86400 ))
      printf '%s\t%s\t%d\n' "$name" "$last_date" "$days"
    fi
  fi
done | sort -k3 -t$'\t' -nr
