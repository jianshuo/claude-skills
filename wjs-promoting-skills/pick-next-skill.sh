#!/usr/bin/env bash
# Decide which wjs-* skill to promote today.
# Output: skill name, or exit 1 if nothing qualifies (rest day).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="${HOME}/.claude/skills"

if [[ -n "${SKILL:-}" ]]; then
  if [[ -d "${SKILLS_DIR}/${SKILL}" && -f "${SKILLS_DIR}/${SKILL}/SKILL.md" ]]; then
    echo "$SKILL"; exit 0
  else
    echo "ERROR: SKILL=$SKILL but ${SKILLS_DIR}/${SKILL}/SKILL.md does not exist" >&2; exit 2
  fi
fi

list=$("${HERE}/list-skills.sh")
never=$(echo "$list" | awk -F'\t' '$2 == "never" { print $1 }' | sort | head -1)
if [[ -n "$never" ]]; then echo "$never"; exit 0; fi

recent_edit_winner=""
recent_edit_mtime=0
oldest_winner=""
oldest_days=0

while IFS=$'\t' read -r name last_date days; do
  [[ "$days" -lt 7 ]] && continue
  skill_md="${SKILLS_DIR}/${name}/SKILL.md"
  [[ -f "$skill_md" ]] || continue
  mtime=$(stat -f %m "$skill_md" 2>/dev/null || echo 0)
  last_epoch=$(date -j -f "%Y-%m-%d" "$last_date" +%s 2>/dev/null || echo 0)
  if [[ "$mtime" -gt "$last_epoch" && "$mtime" -gt "$recent_edit_mtime" ]]; then
    recent_edit_winner="$name"; recent_edit_mtime=$mtime
  fi
  if [[ "$days" -gt "$oldest_days" ]]; then
    oldest_winner="$name"; oldest_days=$days
  fi
done <<< "$list"

if [[ -n "$recent_edit_winner" ]]; then echo "$recent_edit_winner"; exit 0; fi
if [[ -n "$oldest_winner" ]]; then echo "$oldest_winner"; exit 0; fi

echo "" >&2
echo "REST_DAY: all wjs-* skills were posted within the last 7 days; skipping." >&2
exit 1
