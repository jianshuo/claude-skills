#!/usr/bin/env bash
# Generate an abstract watercolor background image for a video via GPT Image 2.
#
# Usage:
#   generate-bg.sh <article-folder> [theme]
#
# theme options (picks color palette):
#   personal | tech | reflection | warning | growth | abstract
#
# If theme omitted, defaults to "personal".
set -euo pipefail

ART="${1:-}"
THEME="${2:-personal}"

if [[ -z "$ART" || ! -d "$ART" ]]; then
  echo "usage: generate-bg.sh <article-folder> [personal|tech|reflection|warning|growth|abstract]" >&2
  exit 1
fi

ART="$(cd "$ART" && pwd)"
VIDEO="$ART/video"
mkdir -p "$VIDEO"
OUT="$VIDEO/bg.png"

case "$THEME" in
  personal)   COLORS="bright warm yellow, soft coral pink, terracotta, sage green, cream off-white";;
  tech)       COLORS="cool teal, electric blue, deep purple, mint green, soft white";;
  reflection) COLORS="sage green, dusty blue, lavender, pearl gray, cream";;
  warning)    COLORS="burnt orange, deep red, mustard yellow, charcoal, terracotta";;
  growth)     COLORS="fresh green, gold, soft yellow, sky blue, mint";;
  abstract)   COLORS="lavender, dusty rose, sage green, soft amber, pearl";;
  *)          echo "unknown theme: $THEME" >&2; exit 1;;
esac

PROMPT="Abstract watercolor painting, large bold brushstrokes, big color blocks of ${COLORS}. Thick paint texture, painterly canvas feel, organic flowing shapes, no figures, no text, no faces, no objects. Loose impressionist composition, vibrant joyful palette. Pure abstract gestural marks, no representational elements."

echo "[gen-bg] theme=$THEME → $OUT"

node /Users/jianshuo/.claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs \
  --json --provider codex images generate \
  --prompt "$PROMPT" \
  --out "$OUT" \
  --format png --size 1088x1920 --quality high \
  > /tmp/gen-bg-$$.log 2>&1

if [[ -f "$OUT" ]] && [[ $(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT") -gt 100000 ]]; then
  echo "[gen-bg] ✓ $(ls -lh "$OUT" | awk '{print $5}')"
  rm -f /tmp/gen-bg-$$.log
else
  echo "[gen-bg] ✗ generation failed, see /tmp/gen-bg-$$.log"
  tail -20 /tmp/gen-bg-$$.log
  exit 1
fi
