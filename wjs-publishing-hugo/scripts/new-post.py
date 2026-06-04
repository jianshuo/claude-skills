#!/usr/bin/env python3
"""Create a correctly-formatted Hugo post for the maggiacito-style blog.

Writes content/posts/<slug>.md with the repo's authoritative front matter:
  title / date / lastmod / categories[] / tags[] / url
Date format is "YYYY-MM-DD HH:MM:SS" in Asia/Shanghai (matches existing posts).
Body is read from --body-file or stdin (markdown). Prints the created path.

This script is the SINGLE source of truth for the front-matter format — generate
posts through it rather than hand-writing front matter, so the format never drifts.
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Asia/Shanghai")
except Exception:  # pragma: no cover - fallback if tz data missing
    TZ = None


def sanitize_filename(s: str) -> str:
    # Filenames are invisible to readers; keep them filesystem-safe.
    # Drop slashes/colons, collapse spaces to hyphens. CJK is kept as-is.
    bad = '/\\:*?"<>|'
    out = "".join("-" if c in (" ", "\t") else c for c in s if c not in bad)
    return out.strip("-. ") or "post"


def fm_list(values):
    if not values:
        return "[]"
    return "[" + ", ".join(f'"{v}"' for v in values) + "]"


def main():
    p = argparse.ArgumentParser(description="Create a Hugo post (maggiacito conventions).")
    p.add_argument("--title", required=True)
    p.add_argument("--category", action="append", default=[], help="repeatable")
    p.add_argument("--tag", action="append", default=[], help="repeatable")
    p.add_argument("--slug", help="filename + url last segment (default: derived from title)")
    p.add_argument("--url", help="explicit url (default: /<first-category-or-posts>/<slug>/)")
    p.add_argument("--date", help='override date, "YYYY-MM-DD HH:MM:SS" (default: now Shanghai)')
    p.add_argument("--body-file", help="markdown body file (default: stdin, may be empty)")
    p.add_argument("--repo", default=".", help="Hugo repo root (default: cwd)")
    p.add_argument("--section", default="posts", help="content section dir (default: posts)")
    p.add_argument("--force", action="store_true", help="overwrite if the file exists")
    a = p.parse_args()

    now = datetime.now(TZ) if TZ else datetime.now()
    stamp = a.date or now.strftime("%Y-%m-%d %H:%M:%S")

    slug = a.slug or sanitize_filename(a.title)
    last_seg = (a.slug or a.title).strip("/")
    if a.url:
        url = a.url if a.url.endswith("/") else a.url + "/"
        if not url.startswith("/"):
            url = "/" + url
    else:
        first_cat = a.category[0] if a.category else a.section
        url = f"/{first_cat}/{last_seg}/"

    repo = Path(a.repo).resolve()
    posts_dir = repo / "content" / a.section
    if not posts_dir.exists():
        sys.exit(f"error: {posts_dir} does not exist — is --repo a Hugo site root?")
    dest = posts_dir / f"{slug}.md"
    if dest.exists() and not a.force:
        sys.exit(f"error: {dest} already exists (use --force to overwrite)")

    if a.body_file:
        body = Path(a.body_file).read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        body = sys.stdin.read()
    else:
        body = ""

    title_escaped = a.title.replace('"', '\\"')
    front = (
        "---\n"
        f'title: "{title_escaped}"\n'
        f"date: {stamp}\n"
        f"lastmod: {stamp}\n"
        f"categories: {fm_list(a.category)}\n"
        f"tags: {fm_list(a.tag)}\n"
        f"url: {url}\n"
        "---\n\n"
    )
    dest.write_text(front + body.lstrip("\n"), encoding="utf-8")
    print(dest)


if __name__ == "__main__":
    main()
