#!/usr/bin/env bash
# Generate (or refresh) a 30-day marketing plan for a single skill.
# Usage: make-plan.sh <skill-name>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="${1:-}"
[[ -z "$SKILL" ]] && { echo "Usage: $0 <skill-name>" >&2; exit 2; }

SKILL_DIR="${HOME}/.claude/skills/${SKILL}"
[[ -f "${SKILL_DIR}/SKILL.md" ]] || { echo "ERROR: ${SKILL_DIR}/SKILL.md not found" >&2; exit 2; }

mkdir -p "${HERE}/state/plans"
PLAN_PATH="${HERE}/state/plans/${SKILL}.md"
prompt=$(sed "s|\${SKILL}|${SKILL}|g" "${HERE}/prompts/make-plan.md")
echo "Generating plan for ${SKILL} → ${PLAN_PATH}" >&2

claude -p \
  --bare \
  --allowedTools "Read,Write,Bash(git config:*),Bash(git -C *:*),Bash(stat *),Bash(date *)" \
  "$prompt" >&2

if [[ -f "$PLAN_PATH" ]]; then
  echo "OK: $PLAN_PATH ($(wc -l <"$PLAN_PATH") lines)" >&2
else
  echo "WARNING: plan not written." >&2; exit 1
fi
