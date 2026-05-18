#!/usr/bin/env bash
# Generate (or refresh) a 30-day marketing plan for a single skill.
# Usage: make-plan.sh <skill-name>
# Writes: state/plans/<skill-name>.md

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="${1:-}"

if [[ -z "$SKILL" ]]; then
  echo "Usage: $0 <skill-name>" >&2
  exit 2
fi

SKILL_DIR="${HOME}/.claude/skills/${SKILL}"
if [[ ! -f "${SKILL_DIR}/SKILL.md" ]]; then
  echo "ERROR: ${SKILL_DIR}/SKILL.md not found" >&2
  exit 2
fi

mkdir -p "${HERE}/state/plans"
PLAN_PATH="${HERE}/state/plans/${SKILL}.md"
PROMPT_TEMPLATE="${HERE}/prompts/make-plan.md"

# Substitute ${SKILL} into the prompt
prompt=$(sed "s|\${SKILL}|${SKILL}|g" "$PROMPT_TEMPLATE")

# Headless Claude run — give it the prompt, let it read the inputs itself
# Use --bare to skip hooks / CLAUDE.md / auto-memory for determinism
# Disable dangerous permission prompts since we want no interaction; we trust
# Claude only to write the plan file (it'll be invoked from cron).
echo "Generating plan for ${SKILL} → ${PLAN_PATH}" >&2

claude -p \
  --bare \
  --allowedTools "Read,Write,Bash(git config:*),Bash(git -C *:*),Bash(stat *),Bash(date *)" \
  "$prompt" >&2

if [[ -f "$PLAN_PATH" ]]; then
  echo "OK: $PLAN_PATH ($(wc -l <"$PLAN_PATH") lines)" >&2
else
  echo "WARNING: plan not written. Claude may have output to stdout instead." >&2
  exit 1
fi
