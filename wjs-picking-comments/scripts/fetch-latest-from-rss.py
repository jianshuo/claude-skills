#!/usr/bin/env python3
"""Fetch the latest article from wewe-rss feed (default: 王建硕 公众号).

Outputs JSON to stdout:
  {"title": "...", "url": "...", "published_at": "...", "summary": "..."}

Usage:
  fetch-latest-from-rss.py
  fetch-latest-from-rss.py --feed http://localhost:4000/feeds/<biz>.atom
  fetch-latest-from-rss.py --skip 1   # skip the most recent (use the one before)
"""
import argparse, json, sys, urllib.request, xml.etree.ElementTree as ET

DEFAULT_FEED = "http://localhost:4000/feeds/MP_WXS_2397242840.atom"
NS = {"atom": "http://www.w3.org/2005/Atom"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default=DEFAULT_FEED)
    ap.add_argument("--skip", type=int, default=0,
                    help="skip N most recent entries (default 0 = take the latest)")
    args = ap.parse_args()

    try:
        with urllib.request.urlopen(args.feed, timeout=10) as r:
            body = r.read()
    except Exception as e:
        sys.exit(f"error: cannot fetch {args.feed}: {e}\nis the wewe-rss container running on :4000?")

    root = ET.fromstring(body)
    entries = root.findall("atom:entry", NS)
    if not entries:
        sys.exit("error: no entries in feed")

    # Sort by published-or-updated descending — wewe-rss XML ordering is not
    # reliably most-recent-first; some entries have only <updated>, no <published>.
    def ts(e):
        return (e.findtext("atom:published", "", NS) or
                e.findtext("atom:updated", "", NS) or "").strip()
    entries = sorted(entries, key=ts, reverse=True)

    if args.skip >= len(entries):
        sys.exit(f"error: --skip {args.skip} but only {len(entries)} entries")

    e = entries[args.skip]
    title = (e.findtext("atom:title", "", NS) or "").strip()
    link_el = e.find("atom:link", NS)
    url = link_el.get("href") if link_el is not None else ""
    published_at = ts(e)
    summary = (e.findtext("atom:summary", "", NS) or "").strip()
    # Strip HTML tags out of summary if any
    import re as _re
    summary = _re.sub(r"<[^>]+>", "", summary).strip()

    json.dump({
        "title": title,
        "url": url,
        "published_at": published_at,
        "summary": summary,
    }, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")

if __name__ == "__main__":
    main()
