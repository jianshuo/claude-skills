#!/usr/bin/env python3
"""Parse a (possibly malformed) WordPress WXR export via regex into clean text."""
import sys, os, re, html
from collections import Counter

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

data = open(SRC, 'r', encoding='utf-8', errors='replace').read()

def strip_html(s):
    if not s:
        return ''
    s = re.sub(r'<script.*?</script>', '', s, flags=re.S | re.I)
    s = re.sub(r'<style.*?</style>', '', s, flags=re.S | re.I)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'</p>', '\n\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def field(block, tag):
    m = re.search(rf'<{tag}>(.*?)</{tag}>', block, re.S)
    if not m:
        return ''
    v = m.group(1)
    cd = re.match(r'\s*<!\[CDATA\[(.*?)\]\]>\s*$', v, re.S)
    if cd:
        return cd.group(1)
    return html.unescape(v)

items = re.findall(r'<item>(.*?)</item>', data, re.S)
print(f"Raw <item> blocks: {len(items)}")

posts = []
for it in items:
    if field(it, 'wp:post_type').strip() != 'post':
        continue
    if field(it, 'wp:status').strip() != 'publish':
        continue
    title = field(it, 'title').strip()
    date = field(it, 'wp:post_date').strip()
    content = field(it, 'content:encoded')
    cats = re.findall(r'<category[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</category>', it, re.S)
    cats = [html.unescape(c).strip() for c in cats if c.strip()]
    body = strip_html(content)
    posts.append({
        'title': title, 'date': date, 'cats': sorted(set(cats)),
        'body': body, 'wordcount': len(body.split()),
    })

posts.sort(key=lambda p: p['date'])
print(f"Published posts: {len(posts)}")
if posts:
    print(f"Date range: {posts[0]['date']} -> {posts[-1]['date']}")
print(f"Total words: {sum(p['wordcount'] for p in posts):,}")
years = Counter(p['date'][:4] for p in posts)
print("Posts per year:", dict(sorted(years.items())))

with open(os.path.join(OUT, '_index.tsv'), 'w') as f:
    f.write("date\twords\ttitle\n")
    for p in posts:
        f.write(f"{p['date']}\t{p['wordcount']}\t{p['title']}\n")

buckets = {}
for p in posts:
    y = int(p['date'][:4]) if p['date'][:4].isdigit() else 0
    if y <= 2005: b = '2002-2005'
    elif y <= 2009: b = '2006-2009'
    elif y <= 2014: b = '2010-2014'
    elif y <= 2019: b = '2015-2019'
    else: b = '2020-2022'
    buckets.setdefault(b, []).append(p)

for b in sorted(buckets):
    ps = buckets[b]
    with open(os.path.join(OUT, f'corpus_{b}.txt'), 'w') as f:
        for p in ps:
            f.write(f"\n\n===== {p['date']} | {p['title']} | [{', '.join(p['cats'])}] =====\n\n")
            f.write(p['body'])
    print(f"  corpus_{b}.txt: {len(ps)} posts, {sum(x['wordcount'] for x in ps):,} words")

longform = [p for p in posts if p['wordcount'] >= 800]
with open(os.path.join(OUT, 'corpus_longform.txt'), 'w') as f:
    for p in longform:
        f.write(f"\n\n===== {p['date']} | {p['title']} | {p['wordcount']}w =====\n\n")
        f.write(p['body'])
print(f"  corpus_longform.txt: {len(longform)} posts >=800 words")
