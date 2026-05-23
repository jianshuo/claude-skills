#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_state
HIST_SH="$(dirname "${BASH_SOURCE[0]}")/history.sh"

ART_DIR="$(cfg '.articles_dir')"
[[ -d "$ART_DIR" ]] || { echo "articles_dir not found: $ART_DIR" >&2; exit 1; }

# Only the single newest folder (by name, ISO date prefix sorts correctly).
NEWEST="$(find "$ART_DIR" -maxdepth 1 -type d -name '20*-*' | sort -r | head -1)"
[[ -n "$NEWEST" ]] || exit 0          # no articles at all -> rest
slug="$(basename "$NEWEST")"
if bash "$HIST_SH" fully-done "$slug"; then exit 0; fi   # newest already syndicated -> rest day
echo "$NEWEST"
