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

# WeChat API egress proxy — the value is NOT hardcoded here. Single source of
# truth is the infra memory file (so swapping VPS = edit one line of memory):
#   jianshuo-memory/08-infrastructure/wechat-publish-proxy.md  →  WECHAT_PUBLISH_PROXY=...
# Only this egress IP is in the 公众号 IP whitelist; wrong egress => errcode 40164.
# Pin ALL six upper/lower-case vars: the ambient env may set lowercase https_proxy
# and ALL_PROXY to a different (non-whitelisted) egress, and requests/urllib honor
# ALL_PROXY and the lowercase names over uppercase HTTPS_PROXY — only setting the
# uppercase ones lets the request leak out the wrong IP and hit 40164.
_PROXY_MEMORY="${WJS_MEMORY_DIR:-$HOME/code/jianshuo-memory}/08-infrastructure/wechat-publish-proxy.md"
_WECHAT_PROXY="${WECHAT_PUBLISH_PROXY:-}"
if [[ -z "$_WECHAT_PROXY" && -f "$_PROXY_MEMORY" ]]; then
  _WECHAT_PROXY="$(grep -oE 'WECHAT_PUBLISH_PROXY=[^[:space:]"`]+' "$_PROXY_MEMORY" | head -1 | cut -d= -f2-)"
fi
if [[ -n "$_WECHAT_PROXY" ]]; then
  export HTTPS_PROXY="$_WECHAT_PROXY" HTTP_PROXY="$_WECHAT_PROXY" ALL_PROXY="$_WECHAT_PROXY"
  export https_proxy="$_WECHAT_PROXY" http_proxy="$_WECHAT_PROXY" all_proxy="$_WECHAT_PROXY"
  echo "→ WeChat egress proxy: $_WECHAT_PROXY (from ${WECHAT_PUBLISH_PROXY:+env}${WECHAT_PUBLISH_PROXY:-memory})"
else
  echo "⚠ no WeChat egress proxy resolved (looked in $_PROXY_MEMORY and \$WECHAT_PUBLISH_PROXY)." >&2
  echo "  WeChat API needs a whitelisted exit IP — request will likely hit errcode 40164." >&2
fi

ARTICLE_DIR="${1:-$(pwd)}"
[[ -d "$ARTICLE_DIR" ]] || { echo "error: not a directory: $ARTICLE_DIR" >&2; exit 1; }
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

META="$ARTICLE_DIR/meta.json"
ARTICLE_MD="$ARTICLE_DIR/article.md"
COVER="$ARTICLE_DIR/cover.png"

for f in "$META" "$ARTICLE_MD" "$COVER"; do
  [[ -f "$f" ]] || { echo "error: missing $f" >&2; exit 1; }
done

# 盘古之白:中英文之间补空格(幂等;自动跳过代码块/链接/URL)。出错绝不阻断发布。
python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pangu.py" "$ARTICLE_MD" >&2 2>&1 || true

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
snippet = '\n\n![](./illustration.png)\n'
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

# 最近文章: refresh the tail link-list from the LOCAL permalink ledger
# (articles/*/publish.json `permalink`). Offline + idempotent: rewrites a managed
# block in article.md so content.html below picks it up as a raw-HTML pass-through.
# If a logged-in MP web session is available (WECHAT_MP_* env or a session file),
# best-effort refresh the ledger from appmsgpublish first. Both steps are
# non-fatal. Disable the whole thing with WECHAT_PUBLISH_NO_RECENT=1.
if [[ -z "${WECHAT_PUBLISH_NO_RECENT:-}" ]]; then
  SCRIPT_DIR_R="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  MP_SESSION="${WECHAT_MP_SESSION:-$HOME/.config/wjs-wechat/mp-session.env}"
  if { [[ -n "${WECHAT_MP_COOKIE:-}" && -n "${WECHAT_MP_TOKEN:-}" && -n "${WECHAT_MP_FAKEID:-}" ]] || [[ -f "$MP_SESSION" ]]; }; then
    echo "→ refreshing permalink ledger (appmsgpublish) ..." >&2
    "$SCRIPT_DIR_R/backfill-permalinks.py" "$(dirname "$ARTICLE_DIR")" --session "$MP_SESSION" >&2 2>&1 \
      || echo "  (ledger refresh skipped — session missing/expired)" >&2
  fi
  echo "→ injecting 扩展阅读 list ..." >&2
  "$SCRIPT_DIR_R/build-recent-articles.py" "$ARTICLE_DIR" >&2 2>&1 || true
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
BOLD_STYLE = 'color:#ff0000;'

def inline(s):
    # Convert inline markdown the WeChat editor would otherwise show as raw text.
    s = re.sub(r'\*\*(.+?)\*\*', rf'<strong style="{BOLD_STYLE}">\1</strong>', s)   # **bold** → 纯红 #ff0000 粗体
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
    elif block.startswith('<'):
        # Raw HTML pass-through. For visually distinct boxes (e.g. <section>
        # with light background + muted text for a "previous article's
        # featured comments" footer) that markdown can't express. Author
        # owns valid HTML — keep it as one block (no blank lines inside)
        # so the splitter sees it as one unit.
        blocks.append(block)
    elif all(re.match(r'^\s*([-*]|\d+\.)\s+', ln) for ln in block.splitlines()):
        # A bullet / ordered list block.
        ordered = bool(re.match(r'^\s*\d+\.\s+', block.splitlines()[0]))
        items = [re.sub(r'^\s*([-*]|\d+\.)\s+', '', ln) for ln in block.splitlines()]
        lis = ''.join(f'<li>{inline(it)}</li>' for it in items)
        tag = 'ol' if ordered else 'ul'
        blocks.append(f'<{tag}>{lis}</{tag}>')
    else:
        # Preserve intentional in-block line breaks (排比 / 并列短句 / 多行短句)
        # by converting \n → <br> BEFORE inline. This keeps the lines visually
        # separated while staying inside one <p> (one paragraph, multiple
        # visible lines). Also makes **...** spans work across those breaks,
        # since the inline regex `.+?` matches across `<br>` (no newline char).
        flattened = block.replace('\n', '<br>')
        blocks.append(f'<p>{inline(flattened)}</p>')

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

# If publish.json already has a draft_media_id from a previous run AND the
# user hasn't asked for a brand-new draft, try draft/update first so the
# existing draft is replaced in place (WeChat backend keeps version history).
# Falls back to create_draft if the old media_id is gone or the update path
# isn't usable.
EXISTING_MEDIA_ID=""
if [[ -z "${WECHAT_PUBLISH_FORCE_NEW:-}" && -f publish.json ]]; then
  EXISTING_MEDIA_ID=$(python3 -c "
import json
try:
    print(json.load(open('publish.json')).get('draft_media_id','') or '')
except Exception:
    pass
" 2>/dev/null)
fi

DRAFT_ID=""
DRAFT_MODE=""

if [[ -n "$EXISTING_MEDIA_ID" ]]; then
  echo "→ update existing draft in place (media_id: ${EXISTING_MEDIA_ID:0:24}...)" >&2
  SCRIPT_DIR_LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  set +e
  UPDATE_OUT=$("$SCRIPT_DIR_LOCAL/update-draft-via-api.py" --draft draft.json --media-id "$EXISTING_MEDIA_ID" 2>&1)
  UPDATE_RC=$?
  set -e
  if [[ $UPDATE_RC -eq 0 ]]; then
    DRAFT_ID="$EXISTING_MEDIA_ID"
    DRAFT_MODE="updated"
  elif [[ $UPDATE_RC -eq 3 ]]; then
    echo "  (old draft is gone, creating new)" >&2
  else
    echo "$UPDATE_OUT" >&2
    exit 1
  fi
fi

if [[ -z "$DRAFT_ID" ]]; then
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
  DRAFT_MODE="created"
fi

echo "" >&2
if [[ "$DRAFT_MODE" == "updated" ]]; then
  echo "✓ draft updated in place (reused media_id)" >&2
else
  echo "✓ draft created" >&2
fi
echo "  media_id: $DRAFT_ID" >&2
echo "  → https://mp.weixin.qq.com/ → 草稿箱 → 预览 / 发布" >&2

# Persist draft media_id + minimal metadata to publish.json so downstream
# commands (mass-send.sh, fetch-comments.sh) can find it. Merge with any
# existing publish.json fields (e.g. previous mass_sent_at / msg_data_id
# from an earlier publish of the same article).
DRAFT_ID="$DRAFT_ID" DRAFT_MODE="$DRAFT_MODE" python3 <<'PYEOF'
import json, os, datetime
meta = json.load(open('meta.json'))
pub = {}
if os.path.exists('publish.json'):
    try: pub = json.load(open('publish.json'))
    except Exception: pub = {}
pub['draft_media_id']   = os.environ['DRAFT_ID']
now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
if os.environ.get('DRAFT_MODE') == 'updated':
    pub['draft_updated_at'] = now
else:
    pub['draft_created_at'] = now
    # If this is a fresh create that re-occupies the same slot, clear any
    # stale draft_updated_at from a previous lifecycle.
    pub.pop('draft_updated_at', None)
pub['title']            = meta.get('title', '')
pub['slug']             = meta.get('slug', '')
open('publish.json', 'w').write(json.dumps(pub, ensure_ascii=False, indent=2))
PYEOF
echo "  (publish.json updated)" >&2

# Auto-open the draft. On macOS, open-draft-edit.sh reads the logged-in browser
# session token + resolves this draft's internal appmsgid and opens the actual
# edit page directly (falls back to the home page if not logged in). Elsewhere,
# open the home page — logged-in users land at 草稿箱 in 1 click.
# Disable with: export WECHAT_PUBLISH_NO_OPEN=1
if [[ -z "${WECHAT_PUBLISH_NO_OPEN:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ "$(uname)" == "Darwin" ]] && [[ -x "$SCRIPT_DIR/open-draft-edit.sh" ]]; then
    "$SCRIPT_DIR/open-draft-edit.sh" "$ARTICLE_DIR" >&2 || true
  elif command -v open >/dev/null 2>&1; then
    open "https://mp.weixin.qq.com/" >/dev/null 2>&1 || true
    echo "  (opened in browser)" >&2
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://mp.weixin.qq.com/" >/dev/null 2>&1 || true
    echo "  (opened in browser)" >&2
  fi
  # 留言已由 need_open_comment 自动开。原创+赞赏是不可逆动作、且不在 API 内，
  # 故保留为手动——在已打开的编辑页点一次即可。
  echo "  ⟶ 手动两步：① 声明原创  ② 打开赞赏（在编辑页右侧，原创点了赞赏才出现）" >&2
fi

# Auto-sync the published article to its git remote (commit the article folder,
# rebase on remote, push the current branch). Mirrors the WECHAT_PUBLISH_NO_OPEN
# opt-out convention above: ON by default, since publishing a draft is the
# natural moment to sync the source to GitHub. No-ops safely if the article
# folder isn't in a git repo or has no remote; push failures only warn, never
# break the publish. Disable with: export WECHAT_PUBLISH_NO_PUSH=1
if [[ -z "${WECHAT_PUBLISH_NO_PUSH:-}" ]]; then
  REPO_ROOT="$(git -C "$ARTICLE_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$REPO_ROOT" ]] && git -C "$REPO_ROOT" remote get-url origin >/dev/null 2>&1; then
    BR="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
    echo "→ git sync ($REPO_ROOT @ $BR) ..." >&2
    git -C "$REPO_ROOT" add "$ARTICLE_DIR" >/dev/null 2>&1 || true
    if git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
      echo "  (no tracked file changes to commit)" >&2
    else
      git -C "$REPO_ROOT" commit -q -m "publish: $(basename "$ARTICLE_DIR")" >/dev/null 2>&1 || true
    fi
    # Integrate any remote commits first (tweet-bot / cloud auto-sync push here too).
    if ! git -C "$REPO_ROOT" pull --rebase --autostash origin "$BR" >/dev/null 2>&1; then
      echo "  ⚠ git pull --rebase failed — resolve, then push manually" >&2
    fi
    if git -C "$REPO_ROOT" push origin "$BR" >/dev/null 2>&1; then
      echo "  ✓ pushed to GitHub ($BR)" >&2
    else
      echo "  ⚠ git push failed — push manually" >&2
    fi
  fi
fi
