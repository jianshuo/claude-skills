#!/usr/bin/env bash
# Pull all留言 of a mass-sent article from WeChat's comment/list API and
# format them into <article-folder>/comments.md (default) or comments.json.
#
# Prerequisites:
#   - <article-folder>/publish.json contains msg_data_id (written by mass-send.sh --send)
#   - WECHAT_APPID + WECHAT_SECRET in env
#   - 公众号 is 已认证 (same constraint as mass-send.sh)
#
# Usage:
#   fetch-comments.sh <article-folder>           # → comments.md (default Markdown)
#   fetch-comments.sh <article-folder> --json    # → comments.json (raw API payload)
#   fetch-comments.sh <article-folder> --both    # both files
#
# Output layout (comments.md):
#   # <title> — N 条留言 (拉取于 <timestamp>)
#   ## <openid prefix>  (2026-05-17 21:30) [精选]
#   评论内容
#   - 公开回复 (2026-05-17 22:00)：回复内容
#   ---

set -euo pipefail

ARTICLE_DIR="${1:-}"
FORMAT="${2:---md}"

usage() {
  cat <<'EOF' >&2
usage:
  fetch-comments.sh <article-folder> [--md|--json|--both]
  default: --md (Markdown to comments.md)
EOF
  exit 1
}

[[ -d "$ARTICLE_DIR" ]] || usage
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"
case "$FORMAT" in --md|--json|--both) ;; *) usage ;; esac

PUB="$ARTICLE_DIR/publish.json"
[[ -f "$PUB" ]] || { echo "error: $PUB missing" >&2; exit 1; }

: "${WECHAT_APPID:?WECHAT_APPID env var not set}"
: "${WECHAT_SECRET:?WECHAT_SECRET env var not set}"

WECHAT_APPID="$WECHAT_APPID" WECHAT_SECRET="$WECHAT_SECRET" \
ARTICLE_DIR="$ARTICLE_DIR" FORMAT="$FORMAT" \
python3 <<'PYEOF'
import os, json, sys, urllib.request, datetime, time

APPID  = os.environ['WECHAT_APPID']
SECRET = os.environ['WECHAT_SECRET']
DIR    = os.environ['ARTICLE_DIR']
FORMAT = os.environ['FORMAT']
PUB    = os.path.join(DIR, 'publish.json')

pub = json.load(open(PUB))
msg_data_id = pub.get('msg_data_id')
if not msg_data_id:
    sys.exit('error: publish.json has no msg_data_id (did you run mass-send.sh --send yet?)')

def api(method, path, body=None):
    url = f'https://api.weixin.qq.com/cgi-bin/{path}'
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))

print('→ fetching access_token ...', file=sys.stderr)
tok = api('GET', f'token?grant_type=client_credential&appid={APPID}&secret={SECRET}')
if 'access_token' not in tok: sys.exit(f'token error: {tok}')
TOKEN = tok['access_token']

# Paginate comment/list: max 50 per call, increment begin by 50 until begin >= total.
PAGE = 50
all_comments = []
total = None
begin = 0
print(f'→ comment/list msg_data_id={msg_data_id} ...', file=sys.stderr)
while True:
    body = {'msg_data_id': int(msg_data_id), 'index': 0,
            'begin': begin, 'count': PAGE, 'type': 0}
    r = api('POST', f'comment/list?access_token={TOKEN}', body)
    if r.get('errcode', 0) != 0:
        hint = ''
        if r.get('errcode') == 88000:
            hint = '\n  hint: 88000 = 评论未开启. mass-send.sh --send should have called comment/open; re-run it'
        sys.exit(f'comment/list failed: {r}{hint}')
    page = r.get('comment', [])
    all_comments.extend(page)
    if total is None:
        total = r.get('total', len(page))
        print(f'  total: {total}', file=sys.stderr)
    begin += PAGE
    if begin >= total or not page:
        break
    time.sleep(0.2)  # gentle pacing

print(f'  fetched {len(all_comments)} comments', file=sys.stderr)

def fmt_time(ts):
    return datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M')

# Raw JSON output
if FORMAT in ('--json', '--both'):
    out = os.path.join(DIR, 'comments.json')
    payload = {
        'title':       pub.get('title', ''),
        'msg_data_id': msg_data_id,
        'fetched_at':  datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'total':       total,
        'comments':    all_comments,
    }
    open(out, 'w').write(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f'  → {out}', file=sys.stderr)

# Markdown output
if FORMAT in ('--md', '--both'):
    lines = []
    title = pub.get('title', '')
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    lines.append(f'# {title} — {total} 条留言')
    lines.append('')
    lines.append(f'_拉取于 {now}_')
    lines.append('')
    if not all_comments:
        lines.append('（还没有人留言）')
    for c in all_comments:
        openid = c.get('openid', '匿名')
        nick = '@' + openid[:8] if openid else '匿名'
        ctime = fmt_time(c.get('create_time', 0))
        featured = ' **[精选]**' if c.get('comment_type', 0) == 1 else ''
        like = c.get('like_num') or c.get('reply_like_num')
        like_s = f' · 👍 {like}' if like else ''
        lines.append(f'## {nick}  ({ctime}){featured}{like_s}')
        lines.append('')
        lines.append(c.get('content', '').strip() or '_（空）_')
        reply = c.get('reply') or {}
        if reply.get('content'):
            rtime = fmt_time(reply.get('create_time', 0))
            lines.append('')
            lines.append(f'> **公开回复** ({rtime})：{reply["content"]}')
        lines.append('')
        lines.append('---')
        lines.append('')
    out = os.path.join(DIR, 'comments.md')
    open(out, 'w').write('\n'.join(lines))
    print(f'  → {out}', file=sys.stderr)
PYEOF
