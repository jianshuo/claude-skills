#!/usr/bin/env python3
"""build-recent-articles.py — inject a "最近文章" link list into an article.

Zero network. Reads the LOCAL permalink ledger: every sibling article folder's
publish.json may carry a `permalink` (a https://mp.weixin.qq.com/s/... URL) and
`published_at`, backfilled by backfill-permalinks.py. This script picks the most
recent N *published* articles (excluding the current one) and rewrites a managed
block at the tail of article.md, idempotently, between sentinel comments.

Why article.md (not just content.html): article.md is the git-tracked source of
truth; upload-draft.sh rebuilds content.html from it and passes the raw-HTML
block through verbatim. The managed block is ONE raw-HTML line (no blank lines
inside) so the content.html splitter treats it as a single pass-through unit.

The links use the WeChat editor's native article-hyperlink markup
(`mp_article_text_link` + `data-linktype="2"`), which the MP draft API keeps
clickable for same-account /s/ links.

Usage:
  build-recent-articles.py <article-folder> [--count N] [--print]

  --count N : how many recent articles to list (default: $WECHAT_RECENT_COUNT or 5)
  --print   : write nothing; print the rendered block to stdout (for inspection)

Idempotent: re-running replaces the existing managed block. If no permalinks are
known (empty ledger) the block is removed entirely — never errors, never blocks
publishing.
"""
import os
import re
import sys
import json
import html
import glob
import random

START = "<!--RECENT_ARTICLES_START-->"
END = "<!--RECENT_ARTICLES_END-->"
# Matches the managed region plus any surrounding blank lines, so repeated runs
# don't accumulate whitespace.
REGION_RE = re.compile(r"\n*" + re.escape(START) + r".*?" + re.escape(END) + r"\n*", re.DOTALL)


def folder_date(folder):
    m = re.match(r"(\d{4}-\d{2}-\d{2})", os.path.basename(folder))
    return (m.group(1) + "T00:00:00Z") if m else "0000-00-00T00:00:00Z"


def collect(articles_root, exclude_slug):
    """Return [(sort_key, title, permalink)] for sibling articles with a permalink."""
    rows = []
    for pj in glob.glob(os.path.join(articles_root, "*", "publish.json")):
        folder = os.path.dirname(pj)
        try:
            pub = json.load(open(pj, encoding="utf-8"))
        except Exception:
            continue
        link = (pub.get("permalink") or "").strip()
        if not link:
            continue
        slug = pub.get("slug") or os.path.basename(folder)
        if exclude_slug and slug == exclude_slug:
            continue
        title = (pub.get("title") or "").strip()
        if not title:
            # fall back to meta.json title
            mp = os.path.join(folder, "meta.json")
            if os.path.exists(mp):
                try:
                    title = (json.load(open(mp, encoding="utf-8")).get("title") or "").strip()
                except Exception:
                    pass
        if not title:
            continue
        sort_key = (pub.get("published_at") or "").strip() or folder_date(folder)
        rows.append((sort_key, title, link))
    random.shuffle(rows)
    return rows


def anchor(title, url):
    t = html.escape(title)            # visible text
    a = html.escape(title, quote=True)  # textvalue attribute
    u = html.escape(url, quote=True)
    return (
        '<a class="normal_text_link mp_article_text_link" target="_blank" style="" '
        f'href="{u}" textvalue="{a}" data-itemshowtype="0" linktype="text" '
        f'data-linktype="2">{t}</a>'
    )


def render_block(rows):
    if not rows:
        return ""
    body = "<br>".join(anchor(t, u) for _, t, u in rows)
    section = (
        '<section style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e5e5;'
        'line-height:2.2;font-size:0.95em;">'
        '<strong style="color:#ff0000;">扩展阅读</strong><br>'
        + body
        + "</section>"
    )
    # One physical line so the content.html splitter sees a single raw-HTML block.
    return f"{START}\n{section}\n{END}"


def main():
    args = sys.argv[1:]
    folder = "."
    count = int(os.environ.get("WECHAT_RECENT_COUNT", "5") or 5)
    do_print = False
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--count":
            count = int(args[i + 1]); i += 2
        elif a == "--print":
            do_print = True; i += 1
        elif not a.startswith("-"):
            folder = a; i += 1
        else:
            i += 1
    folder = os.path.abspath(folder)
    articles_root = os.path.dirname(folder)

    cur_slug = os.path.basename(folder)
    meta = os.path.join(folder, "meta.json")
    if os.path.exists(meta):
        try:
            cur_slug = json.load(open(meta, encoding="utf-8")).get("slug") or cur_slug
        except Exception:
            pass

    rows = collect(articles_root, cur_slug)[:max(0, count)]
    block = render_block(rows)

    if do_print:
        print(block)
        return

    md_path = os.path.join(folder, "article.md")
    if not os.path.exists(md_path):
        sys.stderr.write(f"  (recent-articles: no article.md in {folder}, skipping)\n")
        return
    text = open(md_path, encoding="utf-8").read()
    text = REGION_RE.sub("\n", text).rstrip()
    if block:
        text = text + "\n\n" + block + "\n"
    else:
        text = text + "\n"
    open(md_path, "w", encoding="utf-8").write(text)
    sys.stderr.write(f"  (recent-articles: listed {len(rows)} link(s))\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never block publishing
        sys.stderr.write(f"  (recent-articles: skipped — {e})\n")
