#!/usr/bin/env bash
# Generate WeChat 公众号 cover via gpt-image-2-skill.
#
# Strategy:
#   - Read cover-prompt.md (long design prompt with [目标字词] placeholder)
#   - Pass it as --instructions (gpt-5.4 distills it into a focused image prompt)
#   - Pass a short generation directive as --prompt
#   - Output 1536x1024, then sips-crop to 900x383 (2.35:1 微信主封面)
#
# Provider: forced --provider codex (requires ~/.codex/auth.json). The OpenAI
# API key path is intentionally NOT supported — --instructions is codex-only,
# and direct API calls bypass Codex's prompt distillation.
#
# Usage:
#   gen-cover-ai.sh <article-folder> [target-word]

set -euo pipefail

ARTICLE_DIR="${1:-}"
WORD_OVERRIDE="${2:-}"

if [[ -z "$ARTICLE_DIR" || ! -d "$ARTICLE_DIR" ]]; then
  echo "usage: gen-cover-ai.sh <article-folder> [target-word]" >&2
  exit 2
fi
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"  # scripts/ → skill root
TEMPLATE="$SKILL_DIR/prompts/cover-prompt.md"
WRAPPER="$HOME/.claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "error: prompt template missing: $TEMPLATE" >&2
  exit 1
fi
if [[ ! -f "$WRAPPER" ]]; then
  echo "error: gpt-image-2-skill wrapper not found at $WRAPPER" >&2
  echo "       install: git clone https://github.com/Wangnov/gpt-image-2-skill /tmp/g && \\" >&2
  echo "                cp -r /tmp/g/skills/gpt-image-2-skill ~/.claude/skills/" >&2
  exit 1
fi

# Determine target word
WORD="$WORD_OVERRIDE"
if [[ -z "$WORD" && -f "$ARTICLE_DIR/meta.json" ]]; then
  WORD=$(python3 -c "import json,sys; print((json.load(open(sys.argv[1])).get('title') or '').strip())" "$ARTICLE_DIR/meta.json")
fi
if [[ -z "$WORD" ]]; then
  echo "error: no target word (pass as 2nd arg or have meta.json with title)" >&2
  exit 1
fi

# Build instructions from template
INSTRUCTIONS=$(python3 -c "
import sys
template = open(sys.argv[1]).read()
print(template.replace('[目标字词]', sys.argv[2]))
" "$TEMPLATE" "$WORD")

# Short generation directive (the model will use instructions as design philosophy)
GEN_PROMPT="为「${WORD}」生成一张顶级字体美学概念图像。严格遵守 instructions 中的所有原则——文字必须绝对突出、字形准确、隐喻系统围绕文字、画幅比例适合 2.35:1 微信公众号主封面横版裁切。"

RAW_OUT="$ARTICLE_DIR/cover-raw.png"
COVER_OUT="$ARTICLE_DIR/cover.png"
SIZE="${WECHAT_PUBLISH_IMAGE_SIZE:-1536x1024}"
QUALITY="${WECHAT_PUBLISH_IMAGE_QUALITY:-high}"

echo "calling gpt-image-2-skill (target: '$WORD', size: $SIZE, quality: $QUALITY)" >&2

# Codex-only: --instructions is supported solely by the codex provider, and we
# do not allow OPENAI_API_KEY fallback. ~/.codex/auth.json must exist.
cd "$HOME/.claude/skills/gpt-image-2-skill"
RESULT=$(node "$WRAPPER" --json --provider codex images generate \
  --instructions "$INSTRUCTIONS" \
  --prompt "$GEN_PROMPT" \
  --out "$RAW_OUT" \
  --size "$SIZE" \
  --format png \
  --quality "$QUALITY" 2>&1) || {
  echo "image generation failed:" >&2
  echo "$RESULT" | tail -20 >&2
  exit 1
}

if [[ ! -s "$RAW_OUT" ]]; then
  echo "error: no image written to $RAW_OUT" >&2
  echo "$RESULT" | tail -20 >&2
  exit 1
fi

echo "raw image: $RAW_OUT" >&2

# Crop to 900x383 (sips on macOS): scale width to 900, then center-crop height to 383
TMP_SCALED="$ARTICLE_DIR/.cover-scaled.tmp.png"
sips --resampleWidth 900 "$RAW_OUT" --out "$TMP_SCALED" >/dev/null
sips -c 383 900 "$TMP_SCALED" --out "$COVER_OUT" >/dev/null
rm -f "$TMP_SCALED"

# Record what was used
{
  echo "target_word: $WORD"
  echo "size: $SIZE"
  echo "quality: $QUALITY"
  echo "via: gpt-image-2-skill (codex provider only)"
  echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$ARTICLE_DIR/cover-prompt-used.txt"

echo "cover ready: $COVER_OUT (900x383)" >&2
