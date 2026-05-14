#!/usr/bin/env python3
"""Expression-DNA stats across the blog corpus + a stratified sample file.

Usage: python3 expression_stats.py [parsed_corpus_dir]
  parsed_corpus_dir contains corpus_*.txt produced by parse_wxr.py
  (defaults to ../references/sources/articles/parsed relative to this script)
"""
import re, os, glob, sys
from collections import Counter

_DEFAULT = os.path.join(os.path.dirname(__file__),
                        "..", "references", "sources", "articles", "parsed")
PARSED = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(_DEFAULT)

# Reassemble posts from corpus files
posts = []
for fn in sorted(glob.glob(os.path.join(PARSED, 'corpus_2*.txt'))):
    txt = open(fn).read()
    chunks = re.split(r'\n\n===== (.*?) =====\n\n', txt)
    # chunks: ['', header, body, header, body, ...]
    for i in range(1, len(chunks) - 1, 2):
        header = chunks[i]
        body = chunks[i + 1]
        date = header.split(' | ')[0]
        title = header.split(' | ')[1] if ' | ' in header else ''
        posts.append({'date': date, 'title': title, 'body': body.strip()})

posts.sort(key=lambda p: p['date'])
print(f"Reassembled {len(posts)} posts")

allbody = "\n".join(p['body'] for p in posts)
words = re.findall(r"[a-zA-Z']+", allbody.lower())
print(f"Total word tokens: {len(words):,}")

STOP = set("""the a an and or but if then of to in on at for with as by is are was were be
been being it its this that these those i you he she we they my your his her our their
me him us them do does did have has had not no so very just can will would could should
may might from out up down about into over also there here what when where which who how
all one two more most some any no out s t re ll ve m d""".split())

content = [w for w in words if w not in STOP and len(w) > 2]
print("\n=== TOP 80 CONTENT WORDS ===")
for w, c in Counter(content).most_common(80):
    print(f"  {w}: {c}")

# Sentence length
sents = re.split(r'(?<=[.!?])\s+', allbody)
sents = [s for s in sents if 3 < len(s.split()) < 80]
avglen = sum(len(s.split()) for s in sents) / max(len(sents), 1)
short = sum(1 for s in sents if len(s.split()) <= 8)
print(f"\n=== SENTENCES ===")
print(f"  count: {len(sents):,}  avg words/sentence: {avglen:.1f}")
print(f"  short (<=8 words): {short:,} ({100*short/len(sents):.0f}%)")

# Post openings (first sentence of each post)
print("\n=== 40 POST OPENINGS (sampled every Nth) ===")
step = max(1, len(posts) // 40)
for p in posts[::step]:
    first = re.split(r'(?<=[.!?])\s+', p['body'])[0][:120]
    print(f"  [{p['date'][:10]}] {first}")

# Signature phrases
print("\n=== SIGNATURE PHRASE COUNTS ===")
for ph in ["I think", "I believe", "I don't know", "I am not sure", "I guess",
           "in China", "in Shanghai", "for example", "as I", "to be honest",
           "the fact that", "I would say", "interesting", "amazing", "I feel",
           "my point is", "anyway", "P.S.", "Update:", "Wow", "lol",
           "I am very", "very interesting", "It is interesting", "I love"]:
    print(f"  '{ph}': {len(re.findall(re.escape(ph), allbody, re.I))}")

# Stratified sample: ~3 posts per year, prefer mid-length
by_year = {}
for p in posts:
    by_year.setdefault(p['date'][:4], []).append(p)
sample = []
for y in sorted(by_year):
    ps = sorted(by_year[y], key=lambda x: abs(len(x['body'].split()) - 350))
    sample.extend(ps[:3])
with open(os.path.join(PARSED, 'sample_stratified.txt'), 'w') as f:
    for p in sample:
        f.write(f"\n\n===== {p['date']} | {p['title']} =====\n\n{p['body']}\n")
print(f"\nWrote sample_stratified.txt: {len(sample)} posts")
