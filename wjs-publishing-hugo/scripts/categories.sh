#!/usr/bin/env bash
# List existing categories used across the Hugo blog, with post counts (desc).
# Run from the repo root, or pass the repo root as $1.
set -euo pipefail
REPO="${1:-.}"
cd "$REPO"
[ -d content ] || { echo "error: no content/ dir — is '$REPO' a Hugo site root?" >&2; exit 1; }

# Pull every quoted value out of `categories: [...]` front-matter lines.
grep -rhoE '^categories:\s*\[.*\]' content 2>/dev/null \
  | grep -oE '"[^"]+"' \
  | tr -d '"' \
  | sort \
  | uniq -c \
  | sort -rn \
  | awk '{cnt=$1; $1=""; sub(/^ /,""); printf "%4d  %s\n", cnt, $0}'
