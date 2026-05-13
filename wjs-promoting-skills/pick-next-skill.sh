#!/usr/bin/env bash
# Decide which wjs-* skill to promote today.
# Output: the skill name (one line), or empty string + exit 1 if no skill qualifies.
#
# Rules (in order):
#   1. SKILL env var set → that skill (manual override; bypasses 7-day check)
#   2. Skills never posted before → pick alphabetically first
#   3. Skills not posted in last 7 days, whose SKILL.md was modified more recently
#      than its last post → pick the one with the most recent SKILL.md change
#   4. Skills not posted in last 7 days → pick the one posted longest ago
#   5. Nothing qualifies → exit 1 (today is a rest day)

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${HOME}/.claude/skills"

# Manual override
if [[ -n "${SKILL:-}" ]]; then
  if [[ -d "${SKILLS_DIR}/${SKILL}" && -f "${SKILLS_DIR}/${SKILL}/SKILL.md" ]]; then
    echo "$SKILL"
    exit 0
  else
    echo "ERROR: SKILL=$SKILL but ${SKILLS_DIR}/${SKILL}/SKILL.md does not exist" >&2
    exit 2
  fi
fi

list=$("${HERE}/list-skills.sh")

# Rule 2: never posted
never=$(echo "$list" | awk -F'\t' '$2 == "never" { print $1 }' | sort | head -1)
if [[ -n "$never" ]]; then
  echo "$never"
  exit 0
fi

# Build a list of skills not posted in the last 7 days, with their SKILL.md mtime
recent_edit_winner=""
recent_edit_mtime=0
oldest_winner=""
oldest_days=0

while IFS=$'\t' read -r name last_date days; do
  [[ "$days" -lt 7 ]] && continue
  skill_md="${SKILLS_DIR}/${name}/SKILL.md"
  [[ -f "$skill_md" ]] || continue
  mtime=$(stat -f %m "$skill_md" 2>/dev/null || echo 0)
  # Compare with last post epoch
  last_epoch=$(date -j -f "%Y-%m-%d" "$last_date" +%s 2>/dev/null || echo 0)
  if [[ "$mtime" -gt "$last_epoch" && "$mtime" -gt "$recent_edit_mtime" ]]; then
    recent_edit_winner="$name"
    recent_edit_mtime=$mtime
  fi
  if [[ "$days" -gt "$oldest_days" ]]; then
    oldest_winner="$name"
    oldest_days=$days
  fi
done <<< "$list"

# Rule 3: not posted in 7 days, SKILL.md recently edited
if [[ -n "$recent_edit_winner" ]]; then
  echo "$recent_edit_winner"
  exit 0
fi

# Rule 4: not posted in 7 days, oldest post wins
if [[ -n "$oldest_winner" ]]; then
  echo "$oldest_winner"
  exit 0
fi

# Rule 5: nothing qualifies — rest day
echo "" >&2
echo "REST_DAY: all wjs-* skills were posted within the last 7 days; skipping." >&2
exit 1
