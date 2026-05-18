#!/usr/bin/env bash
# Fetch WeChat MP comments via gstack's persistent Chromium profile.
# Uses in-browser `fetch()` (same-origin, auto cookies) to bypass all cookie
# extraction / token-swap fragility. Much more reliable than the cookie-header
# approach.
#
# One-time setup (per machine):
#   1. browse goto https://mp.weixin.qq.com/
#   2. browse screenshot --viewport /tmp/qr.png && open /tmp/qr.png
#   3. Scan QR with WeChat
#   4. browse url   # should show ...token=NNNN — login state lives in ~/.gstack/chromium-profile
#
# One-time setup (per article):
#   Save the appmsgcomment URL (captured once from DevTools or browser
#   network log) to <article-folder>/comment-url.txt
#
# Per-fetch (zero manual steps):
#   fetch-comments-via-gstack.sh <article-folder> [--md|--json|--both]

set -euo pipefail

ARTICLE_DIR="${1:-}"
FORMAT="${2:---md}"

if [[ -z "$ARTICLE_DIR" || ! -d "$ARTICLE_DIR" ]]; then
  cat <<'EOF' >&2
usage: fetch-comments-via-gstack.sh <article-folder> [--md|--json|--both]
prerequisites:
  1. gstack browser logged into mp.weixin.qq.com (see script header)
  2. <article-folder>/comment-url.txt exists with appmsgcomment URL
EOF
  exit 1
fi
ARTICLE_DIR="$(cd "$ARTICLE_DIR" && pwd)"

URL_FILE="$ARTICLE_DIR/comment-url.txt"
[[ -f "$URL_FILE" ]] || { echo "error: $URL_FILE not found." >&2; exit 1; }
URL_PATTERN=$(head -1 "$URL_FILE" | tr -d '\r\n' | awk '{$1=$1; print}')
[[ -n "$URL_PATTERN" ]] || { echo "error: $URL_FILE is empty" >&2; exit 1; }

B="$HOME/.claude/skills/gstack/browse/dist/browse"
[[ -x "$B" ]] || { echo "error: gstack browse not found at $B" >&2; exit 1; }
"$B" status >/dev/null 2>&1 || { echo "error: gstack browse server not running" >&2; exit 3; }

# Need to be on a same-origin mp.weixin.qq.com page for fetch() to send cookies
# correctly. Use the latest-comments page — it works once logged in, doesn't
# require per-article params, and stays valid as long as the session is alive.
TOKEN=$(printf '%s' "$URL_PATTERN" | grep -oE 'token=[0-9]+' | head -1 | cut -d= -f2)
[[ -n "$TOKEN" ]] || { echo "error: no token= in $URL_FILE" >&2; exit 1; }

CURRENT_URL=$("$B" url 2>/dev/null | tr -d '\r\n' || true)
if [[ "$CURRENT_URL" != *"mp.weixin.qq.com"* ]]; then
  echo "→ navigating to mp.weixin.qq.com (need same-origin context for fetch) ..." >&2
  "$B" goto "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_latest_comment&begin=0&count=10&sendtype=MASSSEND&scene=1&token=$TOKEN&lang=zh_CN" >/dev/null
  "$B" wait --networkidle >/dev/null 2>&1 || true
fi

# Quick login probe via browser DOM (faster + more reliable than URL check)
LOGIN_STATE=$("$B" js "(document.body.innerText.includes('请重新登录')||document.body.innerText.includes('登录超时'))?'OUT':'IN'" 2>/dev/null | tail -1 | tr -d '\r\n')
if [[ "$LOGIN_STATE" == "OUT" ]]; then
  cat <<EOF >&2
error: gstack browser session is expired.

Re-scan QR:
  $B goto https://mp.weixin.qq.com/
  $B screenshot --viewport /tmp/qr.png && open /tmp/qr.png
  # scan with WeChat, then re-run this script
EOF
  exit 2
fi

# Pagination: extract path+query from URL_PATTERN (browser fetch needs relative
# path so cookies attach), strip token (will use current TOKEN), then page.
# Use Python to do the fetch loop via browse js, accumulate, write JSON.
ARTICLE_DIR="$ARTICLE_DIR" URL_PATTERN="$URL_PATTERN" FORMAT="$FORMAT" \
TOKEN="$TOKEN" BROWSE="$B" \
python3 <<'PYEOF'
import os, json, sys, subprocess, time, datetime, urllib.parse, re

DIR    = os.environ['ARTICLE_DIR']
URL    = os.environ['URL_PATTERN']
TOKEN  = os.environ['TOKEN']
FMT    = os.environ['FORMAT']
BROWSE = os.environ['BROWSE']

# Build relative path + parse query
parsed = urllib.parse.urlparse(URL)
qs = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
qs = {k: (v[0] if v else '') for k, v in qs.items()}
qs['token'] = TOKEN  # ensure fresh token
if 'begin' not in qs:
    qs['begin'] = '0'
page_size = int(qs.get('count', '20') or 20)

def page_url(begin):
    q = dict(qs); q['begin'] = str(begin)
    return f"{parsed.path}?{urllib.parse.urlencode(q)}"

def browse_fetch(rel_path):
    """In-browser fetch via browse js — same-origin, cookies auto.
    NOTE: browse js awaits Promises chained with .then() but does NOT await
    promises returned from IIFE async functions. Use .then() chain explicitly."""
    js = (
        "fetch(" + json.dumps(rel_path)
        + ",{credentials:'include',headers:{'Accept':'application/json'}})"
        + ".then(r=>r.text())"
    )
    res = subprocess.run([BROWSE, "js", js], capture_output=True, text=True, timeout=45)
    if res.returncode != 0:
        sys.exit(f"error: browse js failed: {res.stderr[:500]}")
    raw = res.stdout.strip()
    # browse js prints the resolved string directly (raw JSON); occasionally
    # wraps in "--- BEGIN UNTRUSTED ... ---" envelope.
    raw = re.sub(r"^--- BEGIN.*?---\s*\n", "", raw, flags=re.S)
    raw = re.sub(r"\n--- END.*?---\s*$", "", raw, flags=re.S)
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        sys.stderr.write(f"⚠ couldn't parse browse-js response (first 400 chars):\n{raw[:400]}\n")
        sys.exit(1)

def unwrap(o):
    """WeChat's list_comment returns comment_list as JSON-encoded string."""
    if isinstance(o, dict):  return {k: unwrap(v) for k,v in o.items()}
    if isinstance(o, list):  return [unwrap(v) for v in o]
    if isinstance(o, str):
        s = o.lstrip()
        if s.startswith('{') or s.startswith('['):
            try: return unwrap(json.loads(o))
            except (json.JSONDecodeError, ValueError): pass
    return o

def find_comments(payload):
    name_hints = ('comment_list','comments','commentlist','list','items','data','comment')
    candidates = []
    def walk(obj, path=()):
        yield path, obj
        if isinstance(obj, dict):
            for k,v in obj.items(): yield from walk(v, path+(k,))
        elif isinstance(obj, list):
            for i,v in enumerate(obj): yield from walk(v, path+(i,))
    for path, val in walk(payload):
        if isinstance(val, list) and val and isinstance(val[0], dict):
            score = 0
            joined = '/'.join(str(p) for p in path)
            for n in name_hints:
                if n in joined: score += 10
            s = val[0]
            if 'content' in s or 'nick_name' in s or 'create_time' in s or 'post_time' in s: score += 20
            candidates.append((score, len(val), path, val))
    if not candidates: return None
    candidates.sort(reverse=True)
    return candidates[0][3]

print(f"→ in-browser fetch (paginated, page_size={page_size}) ...", file=sys.stderr)
first = unwrap(browse_fetch(page_url(0)))
br = first.get('base_resp') if isinstance(first, dict) else None
if br and br.get('ret') not in (0, None):
    sys.exit(f"error: base_resp = {br}")
comments = find_comments(first) or []
print(f"  page 0 → {len(comments)} comments", file=sys.stderr)

# Look for total
total = None
def walk_t(o, p=()):
    yield p, o
    if isinstance(o, dict):
        for k,v in o.items(): yield from walk_t(v, p+(k,))
    elif isinstance(o, list):
        for i,v in enumerate(o): yield from walk_t(v, p+(i,))
for p,v in walk_t(first):
    if isinstance(v, int) and p and p[-1] == 'total_count':
        total = v; break

begin = page_size
if len(comments) >= page_size:
    while True:
        if total is not None and total > 0 and begin >= total: break
        nxt = unwrap(browse_fetch(page_url(begin)))
        page = find_comments(nxt) or []
        if not page: break
        comments.extend(page)
        print(f"  page begin={begin} → +{len(page)}", file=sys.stderr)
        begin += len(page)
        if len(page) < page_size: break
        time.sleep(0.3)

print(f"  total fetched: {len(comments)}", file=sys.stderr)

# --- Save JSON ---
if FMT in ('--json','--both'):
    out = os.path.join(DIR, 'comments.json')
    open(out,'w').write(json.dumps({
        'fetched_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'gstack-browser-fetch',
        'total': total,
        'comments': comments,
    }, ensure_ascii=False, indent=2))
    print(f"  → {out}", file=sys.stderr)

# --- Save Markdown (mirror fetch-comments-by-cookie.sh format) ---
if FMT in ('--md','--both'):
    def g(d,*ns,default=''):
        for n in ns:
            if isinstance(d,dict) and d.get(n) not in (None,''): return d[n]
        return default
    def fmt_ts(t):
        try: return datetime.datetime.fromtimestamp(int(t)).strftime('%Y-%m-%d %H:%M')
        except Exception: return '?'
    pub_title = ''
    pub_path = os.path.join(DIR,'publish.json')
    if os.path.exists(pub_path):
        try: pub_title = json.load(open(pub_path)).get('title','')
        except Exception: pass
    lines = []
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    lines.append(f"# {pub_title or os.path.basename(DIR)} — {len(comments)} 条留言")
    lines.append('')
    lines.append(f"_拉取于 {now}（via gstack 浏览器）_")
    lines.append('')
    if not comments:
        lines.append('（没有留言）')
    for c in comments:
        nick = g(c,'nick_name','nickname','NickName',default='匿名')
        content = g(c,'content','Content')
        ctime = fmt_ts(g(c,'post_time','create_time','createTime','CreateTime',default=0))
        elected = g(c,'is_elected','isElected','comment_type',default=0)
        elected_s = ' **[精选]**' if elected else ''
        is_top = g(c,'is_top',default=False)
        top_s = ' **[置顶]**' if is_top else ''
        like = g(c,'like_num','likeNum','LikeNum',default=0)
        like_s = f' · 👍 {like}' if like else ''
        ip = g(c,'ip_wording',default='')
        ip_s = f' · {ip}' if ip else ''
        lines.append(f"## {nick}  ({ctime}){top_s}{elected_s}{like_s}{ip_s}")
        lines.append('')
        lines.append((str(content) or '_（空）_').strip())
        reply = g(c,'reply','Reply',default=None)
        new_reply = g(c,'new_reply',default=None)
        replies = []
        if isinstance(reply,dict):
            if reply.get('content'): replies.append((reply.get('create_time',0), reply['content']))
            for r in reply.get('reply_list') or []:
                if isinstance(r,dict) and r.get('content'):
                    replies.append((r.get('create_time') or r.get('post_time') or 0, r['content']))
        if isinstance(new_reply,dict):
            for r in new_reply.get('reply_list') or []:
                if isinstance(r,dict) and r.get('content'):
                    replies.append((r.get('create_time') or r.get('post_time') or 0, r['content']))
        seen = set()
        for rt,rc in replies:
            k=(rt,rc)
            if k in seen: continue
            seen.add(k)
            lines.append('')
            lines.append(f"> **公开回复** ({fmt_ts(rt)})：{rc}")
        lines.append('')
        lines.append('---')
        lines.append('')
    out = os.path.join(DIR,'comments.md')
    open(out,'w').write('\n'.join(lines))
    print(f"  → {out}", file=sys.stderr)
PYEOF
