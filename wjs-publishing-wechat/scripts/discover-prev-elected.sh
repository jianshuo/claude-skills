#!/usr/bin/env bash
# Discover the most-recently published 王建硕 公众号 article that precedes the
# folder you pass in, and dump its elected (精选) comments as JSON so the agent
# can curate a "上篇精选留言" footer section into the current article.
#
# Inputs:
#   $1 — current article folder (e.g. articles/2026-05-18-edit-skill-not-output)
#
# What it does:
#   1. Sort sibling YYYY-MM-DD-* folders by name; pick the one immediately
#      before the current folder.
#   2. Read its meta.json for title.
#   3. Read its comments.md and pull every entry whose header line contains
#      **[精选]**. Sort by 👍 likes desc.
#   4. Hit the wewe-rss feed and match by exact title (or longest-prefix) to
#      grab the mp.weixin.qq.com URL.
#
# Output (stdout, JSON):
#   {
#     "prev_folder": "...",
#     "prev_title":  "...",
#     "prev_url":    "https://mp.weixin.qq.com/s/...",   # or "" if RSS miss
#     "total_comments": N,         # total in comments.md
#     "elected_count": M,          # entries flagged 精选
#     "elected": [
#       { "nick": "...", "region": "...", "likes": N, "time": "...",
#         "content": "...", "reply": "..." or "" },
#       ...
#     ]
#   }
#
# Exit codes:
#   0 success (even when 0 elected — caller decides whether to render)
#   1 misuse / current folder missing
#   2 no previous folder exists (first article in workspace)
#   3 previous folder has no comments.md (haven't pulled留言 yet)

set -euo pipefail

CURRENT="${1:-}"
if [[ -z "$CURRENT" || ! -d "$CURRENT" ]]; then
  echo "usage: discover-prev-elected.sh <current-article-folder>" >&2
  exit 1
fi
CURRENT="$(cd "$CURRENT" && pwd)"

RSS_URL="${WJS_WECHAT_RSS_URL:-http://localhost:4000/feeds/MP_WXS_2397242840.atom}"

CURRENT="$CURRENT" RSS_URL="$RSS_URL" python3 <<'PYEOF'
import os, sys, json, re, urllib.request, urllib.error

CURRENT = os.environ['CURRENT']
RSS_URL = os.environ['RSS_URL']

parent = os.path.dirname(CURRENT)
cur_name = os.path.basename(CURRENT)
date_re = re.compile(r'^\d{4}-\d{2}-\d{2}-')
siblings = sorted([d for d in os.listdir(parent)
                   if date_re.match(d) and os.path.isdir(os.path.join(parent, d))])
if cur_name not in siblings:
    print('error: current folder not in dated siblings list', file=sys.stderr); sys.exit(1)
idx = siblings.index(cur_name)
if idx == 0:
    print('no previous article folder (this is the first one)', file=sys.stderr); sys.exit(2)
prev_name = siblings[idx - 1]
prev_dir  = os.path.join(parent, prev_name)

meta_path = os.path.join(prev_dir, 'meta.json')
prev_title = ''
if os.path.exists(meta_path):
    try: prev_title = (json.load(open(meta_path)).get('title') or '').strip()
    except Exception: pass

comments_path = os.path.join(prev_dir, 'comments.md')
if not os.path.exists(comments_path):
    print(f'error: no comments.md in {prev_dir} — pull留言 first', file=sys.stderr); sys.exit(3)

# Parse comments.md. Header form (from fetch-comments-by-cookie.sh):
#   ## <nick>  (YYYY-MM-DD HH:MM)[ **[置顶]**][ **[精选]**][ · 👍 N][ · <region>]
# Body is the lines after a blank line until "---". A "> **公开回复**…" line
# inside the body is the public reply.
header_re = re.compile(r'^## (?P<nick>.+?)  \((?P<time>[^)]+)\)(?P<flags>.*)$')

text = open(comments_path, encoding='utf-8').read()
blocks = text.split('\n## ')
total = 0
elected = []
for i, b in enumerate(blocks):
    if i == 0:
        # header chunk before the first ##; skip
        continue
    block = '## ' + b
    lines = block.split('\n')
    m = header_re.match(lines[0])
    if not m: continue
    total += 1
    flags = m.group('flags')
    if '**[精选]**' not in flags: continue
    likes = 0
    lm = re.search(r'👍 (\d+)', flags)
    if lm: likes = int(lm.group(1))
    region = ''
    # region = the last "· token" after we strip flag tokens
    tail = flags
    # Drop flag markers and likes; leftover · tokens are region
    tail = re.sub(r'\s*\*\*\[[^\]]+\]\*\*', '', tail)
    tail = re.sub(r'\s*·\s*👍\s*\d+', '', tail)
    parts = [p.strip() for p in tail.split('·') if p.strip()]
    if parts: region = parts[-1]
    # Body: skip blank lines, collect until '---'
    body_lines = []
    reply = ''
    started = False
    for ln in lines[1:]:
        if ln.strip() == '---': break
        if not started and not ln.strip(): continue
        started = True
        if ln.startswith('> **公开回复**'):
            reply = re.sub(r'^> \*\*公开回复\*\*[^：:]*[：:]', '', ln).strip()
            continue
        body_lines.append(ln)
    content = '\n'.join(body_lines).strip()
    elected.append({
        'nick': m.group('nick').strip(),
        'time': m.group('time').strip(),
        'region': region,
        'likes': likes,
        'content': content,
        'reply': reply,
    })

elected.sort(key=lambda c: (-c['likes'], c['time']))

# RSS: title → URL lookup. wewe-rss returns Atom; pull each entry's title+link.
prev_url = ''
try:
    req = urllib.request.Request(RSS_URL, headers={'User-Agent': 'wjs-publishing-wechat/1'})
    raw = urllib.request.urlopen(req, timeout=6).read().decode('utf-8', errors='replace')
    entry_re = re.compile(r'<entry>.*?</entry>', re.DOTALL)
    title_re = re.compile(r'<title[^>]*><!\[CDATA\[(.*?)\]\]>')
    link_re  = re.compile(r'<link href="([^"]+)"')
    for ent in entry_re.findall(raw):
        tm = title_re.search(ent); lm = link_re.search(ent)
        if not (tm and lm): continue
        t = tm.group(1).strip(); u = lm.group(1).strip()
        if t == prev_title:
            prev_url = u; break
    if not prev_url and prev_title:
        # fallback: longest common prefix match (handles trailing punctuation drift)
        best = ('', 0)
        for ent in entry_re.findall(raw):
            tm = title_re.search(ent); lm = link_re.search(ent)
            if not (tm and lm): continue
            t = tm.group(1).strip(); u = lm.group(1).strip()
            n = 0
            while n < min(len(t), len(prev_title)) and t[n] == prev_title[n]:
                n += 1
            if n > best[1]: best = (u, n)
        if best[1] >= 6:  # at least 6 char prefix to call it a match
            prev_url = best[0]
except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
    print(f'⚠ RSS fetch failed ({e}) — prev_url will be empty; agent should ask user', file=sys.stderr)

print(json.dumps({
    'prev_folder': prev_dir,
    'prev_title': prev_title,
    'prev_url': prev_url,
    'total_comments': total,
    'elected_count': len(elected),
    'elected': elected,
}, ensure_ascii=False, indent=2))
PYEOF
