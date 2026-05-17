#!/usr/bin/env bash
# Cookie-based留言 fetcher — fallback path for 个人主体 accounts whose
# official-API access was revoked in 2025-07.
#
# How it works:
#   1. You抓包一次 mp.weixin.qq.com/misc/appmsgcomment from DevTools.
#   2. Pass the URL + Cookie string to this script.
#   3. Script auto-paginates by incrementing begin=, scrapes all comments,
#      writes <article-folder>/comments.md (and optionally comments.json).
#
# Auth state lives in browser cookies which expire in a few hours, so plan
# on re-grabbing once or twice a day. Cookies are equivalent to your logged-in
# session — do not commit them to git or paste into public channels.
#
# Usage:
#   fetch-comments-by-cookie.sh <article-folder> \
#       --url '<full URL incl. begin=0...>' \
#       --cookie '<full Cookie header string>'
#       [--json|--both]   # default: write comments.md
#
# Worked抓包 example:
#   1. Login mp.weixin.qq.com → 留言管理 → click target article
#   2. DevTools → Network → filter Fetch/XHR
#   3. Click next-page / load-more in the comment UI
#   4. Find request URL containing "appmsgcomment", right-click → Copy → Copy as cURL (bash)
#   5. From that curl: grab the URL (with begin=0&count=...) and the -H 'Cookie: ...' value

set -euo pipefail

ARTICLE_DIR="${1:-}"
shift || true

URL=""
COOKIE=""
FORMAT="--md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)    URL="$2"; shift 2 ;;
    --cookie) COOKIE="$2"; shift 2 ;;
    --json)   FORMAT="--json"; shift ;;
    --md)     FORMAT="--md"; shift ;;
    --both)   FORMAT="--both"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$ARTICLE_DIR" || -z "$URL" || -z "$COOKIE" ]]; then
  cat <<'EOF' >&2
usage:
  fetch-comments-by-cookie.sh <article-folder> --url '<full URL>' --cookie '<cookie>' [--md|--json|--both]

  --url:    full mp.weixin.qq.com/misc/appmsgcomment URL with begin=0 (抓自浏览器 DevTools)
  --cookie: entire Cookie header string from the same请求
  format:   --md (default) writes comments.md; --json writes comments.json; --both writes both

抓包 how-to: see header comment in this script.
EOF
  exit 1
fi

[[ -d "$ARTICLE_DIR" ]] || { echo "error: not a directory: $ARTICLE_DIR" >&2; exit 1; }
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

ARTICLE_DIR="$ARTICLE_DIR" URL="$URL" COOKIE="$COOKIE" FORMAT="$FORMAT" \
python3 <<'PYEOF'
import os, json, sys, re, time, datetime
import urllib.request, urllib.parse

DIR    = os.environ['ARTICLE_DIR']
URL    = os.environ['URL']
COOKIE = os.environ['COOKIE']
FMT    = os.environ['FORMAT']

# Parse the URL — pull out scheme/host/path + query as dict so we can rewrite
# begin= for pagination.
parsed = urllib.parse.urlparse(URL)
qs = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
# parse_qs returns lists; flatten to scalars
qs = {k: (v[0] if v else '') for k, v in qs.items()}

if 'begin' not in qs:
    print('⚠ URL has no begin= param — script may not paginate. Continuing anyway.', file=sys.stderr)
    qs['begin'] = '0'

page_size = int(qs.get('count', '10') or 10)

def build_url(begin):
    q = dict(qs); q['begin'] = str(begin)
    new_query = urllib.parse.urlencode(q)
    return urllib.parse.urlunparse(parsed._replace(query=new_query))

def fetch(url):
    req = urllib.request.Request(url, headers={
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
        'Accept': 'application/json, text/plain, */*',
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode('utf-8', errors='replace')
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        sys.stderr.write(f'⚠ non-JSON response (first 500 chars):\n{raw[:500]}\n')
        sys.stderr.write('  if you see HTML/login page → cookie expired, re-grab\n')
        sys.exit(1)

def walk(obj, path=()):
    """Yield (path, value) for every leaf+container so we can heuristically find arrays."""
    yield path, obj
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, path + (i,))

def find_comments(payload):
    """Find the list-of-comments array. Try common names, fall back to longest list of dicts."""
    name_hints = ('comment_list', 'comments', 'commentlist', 'list', 'items', 'data')
    candidates = []
    for path, val in walk(payload):
        if isinstance(val, list) and val and isinstance(val[0], dict):
            score = 0
            joined = '/'.join(str(p) for p in path)
            for n in name_hints:
                if n in joined: score += 10
            # bonus if items look like comments
            sample = val[0]
            if 'content' in sample or 'nick_name' in sample or 'nickname' in sample or 'create_time' in sample:
                score += 20
            candidates.append((score, len(val), path, val))
    if not candidates:
        return None, None
    candidates.sort(reverse=True)
    score, length, path, val = candidates[0]
    return path, val

def find_total(payload, comment_path):
    """Total count near the comment array."""
    for path, val in walk(payload):
        if isinstance(val, int) and any(k in str(p) for p in path for k in ('total', 'count')):
            # prefer one near the comment array (shared prefix)
            if comment_path and len(path) > 0 and path[0] == comment_path[0]:
                return val
    # fallback: any int near 'total'
    for path, val in walk(payload):
        if isinstance(val, int) and 'total' in '/'.join(str(p) for p in path):
            return val
    return None

print(f'→ GET {URL[:100]}{"..." if len(URL) > 100 else ""}', file=sys.stderr)
first = fetch(URL)
if isinstance(first, dict) and first.get('base_resp', {}).get('ret') not in (None, 0):
    print(f'⚠ base_resp.ret = {first.get("base_resp")} (likely cookie expired or wrong endpoint)', file=sys.stderr)

comment_path, comments_page1 = find_comments(first)
if comments_page1 is None:
    sys.stderr.write('error: could not locate comments array in response. Dumping payload to comments-raw.json for inspection.\n')
    open(os.path.join(DIR, 'comments-raw.json'), 'w').write(json.dumps(first, ensure_ascii=False, indent=2))
    sys.exit(2)

total = find_total(first, comment_path)
print(f'  found {len(comments_page1)} on page 1; reported total: {total}', file=sys.stderr)

# Paginate
all_comments = list(comments_page1)
begin = page_size
while True:
    if total is not None and begin >= total: break
    next_url = build_url(begin)
    print(f'→ GET begin={begin} ...', file=sys.stderr)
    payload = fetch(next_url)
    _, page = find_comments(payload)
    if not page:
        break
    all_comments.extend(page)
    begin += len(page)
    if total is None and len(page) < page_size:
        break  # no total; stop when page is short
    time.sleep(0.3)

print(f'  total fetched: {len(all_comments)}', file=sys.stderr)

# Save raw JSON if requested
if FMT in ('--json', '--both'):
    out = os.path.join(DIR, 'comments.json')
    payload = {
        'fetched_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'cookie-fallback',
        'total': total,
        'comments': all_comments,
    }
    open(out, 'w').write(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f'  → {out}', file=sys.stderr)

# Format Markdown
if FMT in ('--md', '--both'):
    def g(d, *names, default=''):
        for n in names:
            if isinstance(d, dict) and d.get(n) not in (None, ''):
                return d[n]
        return default

    def fmt_ts(ts):
        try: return datetime.datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d %H:%M')
        except Exception: return '?'

    pub_title = ''
    pub_path = os.path.join(DIR, 'publish.json')
    if os.path.exists(pub_path):
        try: pub_title = json.load(open(pub_path)).get('title', '')
        except Exception: pass

    lines = []
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    header_title = pub_title or os.path.basename(DIR)
    lines.append(f'# {header_title} — {len(all_comments)} 条留言')
    lines.append('')
    lines.append(f'_拉取于 {now}（cookie fallback）_')
    lines.append('')
    if not all_comments:
        lines.append('（没有留言）')
    for c in all_comments:
        nick = g(c, 'nick_name', 'nickname', 'NickName', default='匿名')
        content = g(c, 'content', 'Content')
        ctime = fmt_ts(g(c, 'create_time', 'createTime', 'CreateTime', default=0))
        elected = g(c, 'is_elected', 'isElected', 'comment_type', default=0)
        elected_s = ' **[精选]**' if elected else ''
        like = g(c, 'like_num', 'likeNum', 'LikeNum', default=0)
        like_s = f' · 👍 {like}' if like else ''
        lines.append(f'## {nick}  ({ctime}){elected_s}{like_s}')
        lines.append('')
        lines.append((str(content) or '_（空）_').strip())
        reply = g(c, 'reply', 'Reply', default=None)
        if isinstance(reply, dict) and reply.get('content'):
            rtime = fmt_ts(reply.get('create_time', 0))
            lines.append('')
            lines.append(f'> **公开回复** ({rtime})：{reply["content"]}')
        lines.append('')
        lines.append('---')
        lines.append('')
    out = os.path.join(DIR, 'comments.md')
    open(out, 'w').write('\n'.join(lines))
    print(f'  → {out}', file=sys.stderr)
PYEOF
