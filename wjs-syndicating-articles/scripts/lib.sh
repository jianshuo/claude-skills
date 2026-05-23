#!/usr/bin/env bash
# Shared helpers. Source with:  source "$(dirname "$0")/lib.sh"
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${SYND_CONFIG:-$SKILL_DIR/config.json}"
SECRETS="${SYND_SECRETS:-$SKILL_DIR/secrets.json}"
HISTORY="${SYND_HISTORY:-$SKILL_DIR/state/history.jsonl}"

command -v jq >/dev/null  || { echo "jq not installed" >&2; exit 1; }

cfg()  { jq -r "$1" "$CONFIG"; }                         # cfg '.articles_dir'
secret() {                                               # secret '.bluesky.handle' -> value or empty
  [[ -f "$SECRETS" ]] || { echo ""; return 0; }
  jq -r "$1 // empty" "$SECRETS" 2>/dev/null || echo ""
}
enabled_platforms() { jq -r '.platforms | keys[]' "$CONFIG"; }
platform_mode() { jq -r --arg p "$1" '.platforms[$p].mode' "$CONFIG"; }
ensure_state() { mkdir -p "$(dirname "$HISTORY")"; touch "$HISTORY"; }
