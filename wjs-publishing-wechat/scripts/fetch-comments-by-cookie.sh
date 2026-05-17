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

def unwrap_json_strings(obj):
    """Some WeChat endpoints (notably list_comment) return comment_list as a
    JSON-encoded string nested inside the outer JSON. Recursively detect such
    strings and parse them so the rest of the code sees real arrays/dicts."""
    if isinstance(obj, dict):
        return {k: unwrap_json_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [unwrap_json_strings(v) for v in obj]
    if isinstance(obj, str):
        s = obj.lstrip()
        if s.startswith('{') or s.startswith('['):
            try:
                parsed = json.loads(obj)
                return unwrap_json_strings(parsed)
            except (json.JSONDecodeError, ValueError):
                pass
    return obj

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
    """Locate the comment-count integer.

    Several "*_count" fields can coexist (total_elected_count, total_shield_count,
    total_top_count, etc.) and many of them are 0 for normal articles — so we
    can't just grab the first int with 'count' in its path. Prefer the precise
    `total_count` field; fall back to any *_count without disqualifying tokens.
    """
    bad_tokens = ('elected', 'shield', 'top', 'reply', 'reply_count', 'fail')
    # 1st pass: exact `total_count` key
    for path, val in walk(payload):
        if isinstance(val, int) and path and path[-1] == 'total_count':
            return val
    # 2nd pass: any *_count or *_total without disqualifying tokens in path
    for path, val in walk(payload):
        if isinstance(val, int) and path and isinstance(path[-1], str):
            tail = path[-1].lower()
            joined = '/'.join(str(p).lower() for p in path)
            if (tail.endswith('_count') or tail.endswith('_total') or tail == 'total'):
                if not any(b in joined for b in bad_tokens):
                    return val
    return None

print(f'→ GET {URL[:100]}{"..." if len(URL) > 100 else ""}', file=sys.stderr)
first = fetch(URL)
if isinstance(first, dict) and first.get('base_resp', {}).get('ret') not in (None, 0):
    print(f'⚠ base_resp.ret = {first.get("base_resp")} (likely cookie expired or wrong endpoint)', file=sys.stderr)
first = unwrap_json_strings(first)

comment_path, comments_page1 = find_comments(first)
if comments_page1 is None:
    sys.stderr.write('error: could not locate comments array in response. Dumping payload to comments-raw.json for inspection.\n')
    open(os.path.join(DIR, 'comments-raw.json'), 'w').write(json.dumps(first, ensure_ascii=False, indent=2))
    sys.exit(2)

total = find_total(first, comment_path)
print(f'  found {len(comments_page1)} on page 1; reported total: {total}', file=sys.stderr)

# Paginate. Two stop conditions: page returns empty/short, OR (when known) total reached.
# Don't trust total == 0 as "done" — that's almost always a misidentified count field;
# the actual stop signal in that case is a short/empty page.
all_comments = list(comments_page1)
begin = page_size
if len(comments_page1) >= page_size:  # first page was full → there might be more
    while True:
        if total is not None and total > 0 and begin >= total: break
        next_url = build_url(begin)
        print(f'→ GET begin={begin} ...', file=sys.stderr)
        payload = unwrap_json_strings(fetch(next_url))
        _, page = find_comments(payload)
        if not page: break
        all_comments.extend(page)
        begin += len(page)
        if len(page) < page_size: break  # short page = done
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
        # Timestamp field names differ by endpoint: post_time (内部接口) vs create_time (官方 API)
        ctime = fmt_ts(g(c, 'post_time', 'create_time', 'createTime', 'CreateTime', default=0))
        elected = g(c, 'is_elected', 'isElected', 'comment_type', default=0)
        elected_s = ' **[精选]**' if elected else ''
        is_top = g(c, 'is_top', default=False)
        top_s = ' **[置顶]**' if is_top else ''
        like = g(c, 'like_num', 'likeNum', 'LikeNum', default=0)
        like_s = f' · 👍 {like}' if like else ''
        ip = g(c, 'ip_wording', default='')
        ip_s = f' · {ip}' if ip else ''
        lines.append(f'## {nick}  ({ctime}){top_s}{elected_s}{like_s}{ip_s}')
        lines.append('')
        lines.append((str(content) or '_（空）_').strip())
        # Public reply: official API uses reply.content; internal endpoint uses
        # reply.reply_list[] (each with content + post_time). Handle both.
        reply = g(c, 'reply', 'Reply', default=None)
        new_reply = g(c, 'new_reply', default=None)
        replies = []
        if isinstance(reply, dict):
            if reply.get('content'):
                replies.append((reply.get('create_time', 0), reply['content']))
            for r in (reply.get('reply_list') or []):
                if isinstance(r, dict) and r.get('content'):
                    replies.append((r.get('create_time') or r.get('post_time') or 0, r['content']))
        if isinstance(new_reply, dict):
            for r in (new_reply.get('reply_list') or []):
                if isinstance(r, dict) and r.get('content'):
                    replies.append((r.get('create_time') or r.get('post_time') or 0, r['content']))
        seen = set()
        for rtime_raw, rcontent in replies:
            key = (rtime_raw, rcontent)
            if key in seen: continue
            seen.add(key)
            lines.append('')
            lines.append(f'> **公开回复** ({fmt_ts(rtime_raw)})：{rcontent}')
        lines.append('')
        lines.append('---')
        lines.append('')
    out = os.path.join(DIR, 'comments.md')
    open(out, 'w').write('\n'.join(lines))
    print(f'  → {out}', file=sys.stderr)
PYEOF
