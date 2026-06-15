#!/usr/bin/env bash
# Generate flat cartoon explanation illustration from article.md.
#
# Reads the article markdown, slots it into illustration-prompt.md as
# instructions, asks gpt-image-2 to visualize the article structure.
# No cropping — the model picks the aspect ratio that fits the content.
#
# Output:
#   <article-folder>/illustration.png   the AI-generated illustration as-is
#
# Usage:
#   gen-illustration.sh <article-folder>

set -euo pipefail

ARTICLE_DIR="${1:-}"
if [[ -z "$ARTICLE_DIR" || ! -d "$ARTICLE_DIR" ]]; then
  echo "usage: gen-illustration.sh <article-folder>" >&2
  exit 2
fi
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"  # scripts/ → skill root
TEMPLATE="$SKILL_DIR/prompts/illustration-prompt.md"
WRAPPER="$HOME/.claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs"

[[ -f "$TEMPLATE" ]] || { echo "error: template missing: $TEMPLATE" >&2; exit 1; }
[[ -f "$WRAPPER" ]]  || { echo "error: gpt-image-2-skill wrapper not found at $WRAPPER" >&2; exit 1; }

ARTICLE_MD="$ARTICLE_DIR/article.md"
[[ -f "$ARTICLE_MD" ]] || { echo "error: missing $ARTICLE_MD" >&2; exit 1; }

# Build instructions: read template + slot in article body
INSTRUCTIONS=$(python3 -c "
import sys
template = open(sys.argv[1]).read()
article  = open(sys.argv[2]).read()
print(template.replace('[文章内容]', article))
" "$TEMPLATE" "$ARTICLE_MD")

GEN_PROMPT="根据 instructions 中的文章内容,生成一张扁平卡通风格的解释图。画幅比例由内容决定 (双行对照用 3:2 / 4:3, 单行流程用横长条, 层级深度用竖版), 选最易读的版本。把文章的核心层级 / 对比 / 递进结构可视化,让读者一眼看懂。中文标签必须准确无伪字。"

OUT="${ARTICLE_DIR}/illustration.png"
SIZE="${WECHAT_PUBLISH_IMAGE_SIZE:-1536x1024}"
QUALITY="${WECHAT_PUBLISH_IMAGE_QUALITY:-high}"

echo "calling gpt-image-2-skill (illustration, size: $SIZE, quality: $QUALITY)" >&2

cd "$HOME/.claude/skills/gpt-image-2-skill"
# Codex-only: --instructions is supported solely by the codex provider, and we
# do not allow OPENAI_API_KEY fallback. ~/.codex/auth.json must exist.
RESULT=$(node "$WRAPPER" --json --provider codex images generate \
  --instructions "$INSTRUCTIONS" \
  --prompt "$GEN_PROMPT" \
  --out "$OUT" \
  --size "$SIZE" \
  --format png \
  --quality "$QUALITY" 2>&1) || {
  echo "image generation failed:" >&2
  echo "$RESULT" | tail -20 >&2
  exit 1
}

if [[ ! -s "$OUT" ]]; then
  echo "error: no image written to $OUT" >&2
  echo "$RESULT" | tail -20 >&2
  exit 1
fi

# Resize to 1024 wide (proportional). NO cropping — the model picks the aspect
# ratio for the content; the old center-crop to 16:9 chopped labels off the
# top and bottom of every illustration.
sips --resampleWidth 1024 "$OUT" --out "$OUT" >/dev/null 2>&1

# Read actual dimensions for the report
DIMS=$(sips -g pixelWidth -g pixelHeight "$OUT" | grep -E "pixel" | awk '{print $2}' | paste -sd "x" -)
echo "illustration ready: $OUT ($DIMS)" >&2
