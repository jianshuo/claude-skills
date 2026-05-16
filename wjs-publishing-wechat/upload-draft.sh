#!/usr/bin/env bash
# Upload an article folder to WeChat as a draft.
#
# Why this exists: `md2wechat convert --draft` doesn't auto-complete in a
# default setup — `--mode api` requires MD2WECHAT_API_KEY (paid cloud service),
# and `--mode ai` returns an AI request prompt instead of finished HTML. This
# script uses md2wechat's low-level commands (upload_image + create_draft) to
# actually produce a draft end-to-end.
#
# Pipeline:
#   1. md2wechat upload_image cover.png        → thumb_media_id
#   2. md2wechat upload_image illustration.png → wechat_url (if present)
#   3. Build content.html: strip frontmatter, drop body H1, wrap paragraphs
#      with inline styles, replace ./illustration.png with WeChat URL
#   4. Build draft.json with title/author/digest from meta.json
#   5. md2wechat create_draft draft.json
#
# Prerequisites:
#   - md2wechat CLI installed and configured (md2wechat config show)
#   - WECHAT_APPID + WECHAT_SECRET valid for the target 公众号
#   - Current public IP in WeChat MP backend's IP whitelist:
#     mp.weixin.qq.com → 设置与开发 → 基本配置 → IP 白名单
#
# Usage:
#   upload-draft.sh <article-folder>
#   upload-draft.sh                       # uses current directory

set -euo pipefail

ARTICLE_DIR="${1:-$(pwd)}"
[[ -d "$ARTICLE_DIR" ]] || { echo "error: not a directory: $ARTICLE_DIR" >&2; exit 1; }
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

META="$ARTICLE_DIR/meta.json"
ARTICLE_MD="$ARTICLE_DIR/article.md"
COVER="$ARTICLE_DIR/cover.png"

for f in "$META" "$ARTICLE_MD" "$COVER"; do
  [[ -f "$f" ]] || { echo "error: missing $f" >&2; exit 1; }
done

cd "$ARTICLE_DIR"

parse_upload_data() {
  python3 -c "
import sys, json, re
data = sys.stdin.read()
m = re.search(r'(\{\s*\"success\"[\s\S]*\})\s*\$', data)
if not m:
    sys.stderr.write('no JSON envelope in md2wechat output:\n' + data[-400:] + '\n')
    sys.exit(1)
obj = json.loads(m.group(1))
if not obj.get('success'):
    msg = obj.get('message') or obj.get('error') or 'unknown error'
    sys.stderr.write('md2wechat reported failure: ' + msg + '\n')
    if 'not in whitelist' in msg:
        sys.stderr.write('hint: add current IP to WeChat MP backend IP whitelist\n')
    sys.exit(1)
print(json.dumps(obj.get('data', {})))
"
}

echo "→ uploading cover.png ..." >&2
COVER_DATA=$(md2wechat upload_image cover.png 2>&1 | parse_upload_data)
THUMB_MEDIA_ID=$(echo "$COVER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['media_id'])")
echo "   thumb_media_id: ${THUMB_MEDIA_ID:0:24}..." >&2

ILLUSTRATION_URL=""
if [[ -f "$ARTICLE_DIR/illustration.png" ]]; then
  # Safety net: if illustration.png exists but isn't referenced in article.md,
  # the upload would silently drop the image. Auto-inject a reference at the
  # natural close — just before "## 后注" if present, otherwise at the end —
  # so the markdown is the source of truth and the result is reproducible.
  if ! grep -q 'illustration\.png' "$ARTICLE_MD"; then
    echo "→ illustration.png present but not referenced — injecting at natural close ..." >&2
    python3 - "$ARTICLE_MD" <<'PYEOF'
import re, sys
path = sys.argv[1]
text = open(path).read()
snippet = '\n\n整件事画出来，大概就是这样：\n\n![整件事画起来，是这样的](./illustration.png)\n'
m = re.search(r'\n##\s*后注\b', text)
if m:
    new = text[:m.start()] + snippet + text[m.start():]
else:
    new = text.rstrip() + snippet
open(path, 'w').write(new)
PYEOF
  fi
  echo "→ uploading illustration.png ..." >&2
  ILLUSTRATION_DATA=$(md2wechat upload_image illustration.png 2>&1 | parse_upload_data)
  ILLUSTRATION_URL=$(echo "$ILLUSTRATION_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['wechat_url'])")
  echo "   url: ${ILLUSTRATION_URL:0:64}..." >&2
fi

echo "→ building content.html + draft.json ..." >&2
ILLUSTRATION_URL="$ILLUSTRATION_URL" THUMB_MEDIA_ID="$THUMB_MEDIA_ID" python3 <<'PYEOF'
import os, re, json

ILLUSTRATION_URL = os.environ.get('ILLUSTRATION_URL', '')
THUMB_MEDIA_ID   = os.environ['THUMB_MEDIA_ID']

meta = json.load(open('meta.json'))
text = open('article.md').read()
text = re.sub(r'^---\n.*?\n---\n', '', text, count=1, flags=re.DOTALL).strip()

# Body font: 17px to match WeChat MP editor's default. Headings step up
# proportionally so the hierarchy reads at a glance: 17 / 19 / 22.
P_STYLE   = 'margin: 1em 0; line-height: 1.75; font-size: 17px; color: #333;'
IMG_STYLE = 'max-width: 100%; height: auto; display: block; margin: 1.5em auto;'
H2_STYLE  = 'margin: 1.6em 0 0.6em; font-size: 22px; font-weight: bold; line-height: 1.4; color: #222;'
H3_STYLE  = 'margin: 1.3em 0 0.5em; font-size: 19px; font-weight: bold; line-height: 1.4; color: #222;'
LI_STYLE  = 'margin: 0.4em 0; line-height: 1.75; font-size: 17px; color: #333;'

def inline(s):
    # Convert inline markdown the WeChat editor would otherwise show as raw text.
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)   # **bold**
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', s)  # *italic*
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)           # `code`
    return s

blocks = []
for block in re.split(r'\n\s*\n', text):
    block = block.strip()
    if not block:
        continue
    m = re.match(r'^!\[(.*?)\]\((.*?)\)\s*$', block)
    if m:
        alt, src = m.group(1), m.group(2)
        if 'illustration' in src and ILLUSTRATION_URL:
            src = ILLUSTRATION_URL
        blocks.append(f'<p style="text-align: center;"><img src="{src}" alt="{alt}" style="{IMG_STYLE}"></p>')
    elif block.startswith('### '):
        blocks.append(f'<h3 style="{H3_STYLE}">{inline(block[4:].strip())}</h3>')
    elif block.startswith('## '):
        blocks.append(f'<h2 style="{H2_STYLE}">{inline(block[3:].strip())}</h2>')
    elif block.startswith('# '):
        # Drop body H1 — the WeChat editor uses meta.json title as the article title.
        # Keeping a body H1 causes md2wechat inspect's DUPLICATE_H1 warning.
        continue
    elif all(re.match(r'^\s*([-*]|\d+\.)\s+', ln) for ln in block.splitlines()):
        # A bullet / ordered list block.
        ordered = bool(re.match(r'^\s*\d+\.\s+', block.splitlines()[0]))
        items = [re.sub(r'^\s*([-*]|\d+\.)\s+', '', ln) for ln in block.splitlines()]
        lis = ''.join(f'<li style="{LI_STYLE}">{inline(it)}</li>' for it in items)
        tag = 'ol' if ordered else 'ul'
        blocks.append(f'<{tag} style="margin: 1em 0; padding-left: 1.5em;">{lis}</{tag}>')
    else:
        blocks.append(f'<p style="{P_STYLE}">{inline(block)}</p>')

content_html = '\n'.join(blocks)
open('content.html', 'w').write(content_html)

draft = {
    "articles": [{
        "title":  meta['title'],
        "author": meta['author'],
        "digest": meta['summary'],
        "content": content_html,
        "thumb_media_id": THUMB_MEDIA_ID,
        "content_source_url": "",
        "need_open_comment": 1,
        "only_fans_can_comment": 0,
    }]
}
open('draft.json', 'w').write(json.dumps(draft, ensure_ascii=False, indent=2))
PYEOF

echo "→ md2wechat create_draft draft.json ..." >&2
RESULT=$(md2wechat create_draft draft.json 2>&1)
DRAFT_ID=$(echo "$RESULT" | python3 -c "
import sys, json, re
data = sys.stdin.read()
m = re.search(r'(\{\s*\"success\"[\s\S]*\})\s*\$', data)
if not m:
    sys.stderr.write(data[-400:] + '\n')
    sys.exit(1)
obj = json.loads(m.group(1))
if not obj.get('success'):
    sys.stderr.write(obj.get('message','unknown error') + '\n')
    sys.exit(1)
print(obj['data']['media_id'])
")

echo "" >&2
echo "✓ draft created" >&2
echo "  media_id: $DRAFT_ID" >&2
echo "  → https://mp.weixin.qq.com/ → 草稿箱 → 预览 / 发布" >&2
