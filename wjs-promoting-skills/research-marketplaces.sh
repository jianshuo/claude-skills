#!/usr/bin/env bash
# Refresh the marketplace research file at state/research.md.
# Safe to run anytime; daily.sh will call this weekly (Sundays).

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PROMPT="${HERE}/prompts/research-marketplaces.md"
OUT="${HERE}/state/research.md"

mkdir -p "${HERE}/state"
echo "Researching marketplaces → ${OUT}" >&2

claude -p \
  --bare \
  --allowedTools "Read,Write,WebFetch,WebSearch,Bash(xurl search:*)" \
  "$(cat "$PROMPT")" >&2

if [[ -f "$OUT" ]]; then
  echo "OK: $OUT ($(wc -c <"$OUT") bytes)" >&2
else
  echo "WARNING: research.md not written." >&2
  exit 1
fi
