#!/usr/bin/env python3
"""Append/replace the "上篇精选留言" <section> footer in a new article's article.md.

Idempotent: if a footer block already exists (detected by the literal string
"上篇精选留言"), it is replaced. Otherwise the new block is appended to EOF.
"""
import argparse, re, sys
from pathlib import Path

MARKER = "上篇精选留言"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("article_folder")
    ap.add_argument("footer_html_path")
    args = ap.parse_args()

    folder = Path(args.article_folder)
    md = folder / "article.md"
    if not md.exists():
        sys.exit(f"error: not found: {md}")

    footer = Path(args.footer_html_path).read_text().rstrip()
    text = md.read_text()

    # Match an existing <section ...>...上篇精选留言...</section> block (non-greedy).
    pattern = re.compile(
        r'<section[^>]*>(?:(?!</section>).)*?' + re.escape(MARKER) + r'(?:(?!</section>).)*?</section>',
        re.DOTALL,
    )

    if pattern.search(text):
        new_text, n = pattern.subn(footer, text, count=1)
        assert n == 1
        action = "replaced"
    else:
        # Append. Ensure exactly one blank line before, and a trailing newline.
        new_text = text.rstrip() + "\n\n" + footer + "\n"
        action = "appended"

    md.write_text(new_text)
    print(f"{action} footer in {md} ({len(footer)} chars)")

if __name__ == "__main__":
    main()
