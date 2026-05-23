#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_state
HIST_SH="$(dirname "${BASH_SOURCE[0]}")/history.sh"

ART_DIR="$(cfg '.articles_dir')"
[[ -d "$ART_DIR" ]] || { echo "articles_dir not found: $ART_DIR" >&2; exit 1; }

# folders named like 20YY-MM-DD-slug, newest date first
while IFS= read -r dir; do
  [[ -d "$dir" ]] || continue
  slug="$(basename "$dir")"
  if ! bash "$HIST_SH" fully-done "$slug"; then
    echo "$dir"; exit 0
  fi
done < <(find "$ART_DIR" -maxdepth 1 -type d -name '20*-*' | sort -r)

# none left -> rest day
exit 0
