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

# No inline CSS — only semantic HTML. The WeChat editor applies its own
# defaults for line-height / font-size / color, and per-user preference we
# stay out of its way (回车分段即可，不覆写任何样式).
#
# But: without inline margins, adjacent <p> elements collapse against each
# other (no visual gap between paragraphs). The fix is to use the same source
# WeChat itself produces when a user presses Enter twice in the editor —
# `<p><br></p>` as a spacer block between every top-level block. This
# matches editor-native source faithfully and survives the editor's
# normalization passes (raw <br><br> gets folded; empty <p></p> gets stripped).

CODE_STYLE = 'font-family:Menlo,Consolas,monospace;background:#f4f4f4;padding:1px 6px;border-radius:3px;font-size:0.92em;'

def inline(s):
    # Convert inline markdown the WeChat editor would otherwise show as raw text.
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)   # **bold**
    s = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', s)  # *italic*
    s = re.sub(r'`([^`]+)`', rf'<code style="{CODE_STYLE}">\1</code>', s)  # `code` (structural: monospace + light bg)
    return s

def is_table(block):
    # Markdown pipe table: first row is header (starts with |), second row is
    # a separator row of dashes/colons separated by pipes.
    lines = block.splitlines()
    if len(lines) < 2 or not lines[0].lstrip().startswith('|'):
        return False
    sep = lines[1].strip()
    return bool(re.match(r'^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$', sep))

def parse_row(line):
    line = line.strip()
    if line.startswith('|'): line = line[1:]
    if line.endswith('|'): line = line[:-1]
    return [c.strip() for c in line.split('|')]

def build_table(block):
    # Inline styles ARE used here — table borders are structural (without them
    # the table is invisible in WeChat), unlike line-height/font-size which are
    # decorative and should defer to the editor's defaults.
    lines = [ln for ln in block.splitlines() if ln.strip()]
    headers = parse_row(lines[0])
    rows = [parse_row(ln) for ln in lines[2:]]
    th_s = 'border:1px solid #d9d9d9;padding:6px 10px;background:#f6f6f6;text-align:left;'
    td_s = 'border:1px solid #d9d9d9;padding:6px 10px;'
    thead = '<thead><tr>' + ''.join(f'<th style="{th_s}">{inline(h)}</th>' for h in headers) + '</tr></thead>'
    tbody = '<tbody>' + ''.join('<tr>' + ''.join(f'<td style="{td_s}">{inline(c)}</td>' for c in row) + '</tr>' for row in rows) + '</tbody>'
    return f'<table style="border-collapse:collapse;width:100%;">{thead}{tbody}</table>'

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
        blocks.append(f'<p><img src="{src}" alt="{alt}"></p>')
    elif block.startswith('### '):
        # h3: ~1 号大于正文 + bold. Structural style (without it WeChat renders
        # headers indistinguishably from paragraphs — defeats the purpose).
        blocks.append(f'<h3 style="font-size:1.2em;font-weight:bold;">{inline(block[4:].strip())}</h3>')
    elif block.startswith('## '):
        # h2: ~2 号大于正文 + bold. Same rationale as h3.
        blocks.append(f'<h2 style="font-size:1.4em;font-weight:bold;">{inline(block[3:].strip())}</h2>')
    elif block.startswith('# '):
        # Drop body H1 — the WeChat editor uses meta.json title as the article title.
        # Keeping a body H1 causes md2wechat inspect's DUPLICATE_H1 warning.
        continue
    elif block.startswith('```'):
        # Fenced code block: strip the ``` fences AND any language hint (the
        # "bash" / "python" / etc would otherwise be rendered as literal text
        # by WeChat). Render as <p><code>…</code></p> so it sits inline with
        # surrounding paragraphs — WeChat's editor doesn't handle <pre> blocks
        # well, and a fenced block of short commands (the common case) reads
        # better as a styled inline `code` than as a separate code box.
        lines = block.splitlines()
        inner_lines = lines[1:-1] if len(lines) >= 2 and lines[-1].strip().startswith('```') else lines[1:]
        escaped = [ln.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') for ln in inner_lines]
        inner = '<br>'.join(escaped)
        blocks.append(f'<p><code style="{CODE_STYLE}">{inner}</code></p>')
    elif is_table(block):
        blocks.append(build_table(block))
    elif all(re.match(r'^\s*([-*]|\d+\.)\s+', ln) for ln in block.splitlines()):
        # A bullet / ordered list block.
        ordered = bool(re.match(r'^\s*\d+\.\s+', block.splitlines()[0]))
        items = [re.sub(r'^\s*([-*]|\d+\.)\s+', '', ln) for ln in block.splitlines()]
        lis = ''.join(f'<li>{inline(it)}</li>' for it in items)
        tag = 'ol' if ordered else 'ul'
        blocks.append(f'<{tag}>{lis}</{tag}>')
    else:
        blocks.append(f'<p>{inline(block)}</p>')

content_html = '\n<p><br></p>\n'.join(blocks)
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

# Persist draft media_id + minimal metadata to publish.json so downstream
# commands (mass-send.sh, fetch-comments.sh) can find it. Merge with any
# existing publish.json fields (e.g. previous mass_sent_at / msg_data_id
# from an earlier publish of the same article).
DRAFT_ID="$DRAFT_ID" python3 <<'PYEOF'
import json, os, datetime
meta = json.load(open('meta.json'))
pub = {}
if os.path.exists('publish.json'):
    try: pub = json.load(open('publish.json'))
    except Exception: pub = {}
pub['draft_media_id']   = os.environ['DRAFT_ID']
pub['draft_created_at'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
pub['title']            = meta.get('title', '')
pub['slug']             = meta.get('slug', '')
open('publish.json', 'w').write(json.dumps(pub, ensure_ascii=False, indent=2))
PYEOF
echo "  (publish.json updated)" >&2

# Auto-open the WeChat MP draft box in the default browser. The actual
# per-draft edit URL requires a session token + internal appmsgid that we
# can't construct from the API-returned media_id, so we open the home page —
# if the user is logged in, the browser lands at 草稿箱 in 1 click.
# Disable with: export WECHAT_PUBLISH_NO_OPEN=1
if [[ -z "${WECHAT_PUBLISH_NO_OPEN:-}" ]]; then
  WECHAT_HOME="https://mp.weixin.qq.com/"
  if command -v open >/dev/null 2>&1; then
    open "$WECHAT_HOME" >/dev/null 2>&1 || true
    echo "  (opened in browser)" >&2
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$WECHAT_HOME" >/dev/null 2>&1 || true
    echo "  (opened in browser)" >&2
  fi
fi
