#!/usr/bin/env python3
"""Parse an X Analytics 'Account overview' CSV export into state/daily.jsonl.

The dashboard download button (top-right of the chart) exports the data behind
the currently-selected metrics. Column names vary, so we fuzzy-match headers.

Usage:
    python3 ingest-csv.py path/to/export.csv
    python3 ingest-csv.py path/to/export.csv --visits-col "Profile visits" --follows-col "New follows"

Upserts by date (re-running with a longer export overwrites overlapping days).
Prints the column mapping it chose so you can sanity-check it.
"""
import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import DAILY, read_jsonl, write_jsonl  # noqa: E402


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def find_col(headers, *, must, must_not=()):
    """First header whose normalized form contains all `must` tokens and no `must_not`."""
    for h in headers:
        n = norm(h)
        if all(norm(t) in n for t in must) and not any(norm(t) in n for t in must_not):
            return h
    return None


def parse_date_cell(v):
    v = v.strip().strip('"')
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%b %d %Y",
                "%d %b %Y", "%Y/%m/%d", "%a, %b %d, %Y", "%a %b %d, %Y",
                "%A, %b %d, %Y", "%a, %d %b %Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def to_int(v):
    if v is None:
        return None
    v = v.strip().replace(",", "").replace("%", "")
    if v == "" or v == "-":
        return None
    try:
        return int(round(float(v)))
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--date-col")
    ap.add_argument("--visits-col")
    ap.add_argument("--follows-col")
    ap.add_argument("--impressions-col")
    ap.add_argument("--followers-col")
    ap.add_argument("--keep-latest", action="store_true",
                    help="keep the most recent day (default drops it — it's a partial/incomplete day)")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.csv_path, newline="", encoding="utf-8-sig")))
    if not rows:
        sys.exit("CSV has no data rows.")
    headers = list(rows[0].keys())

    date_col = args.date_col or find_col(headers, must=["date"]) or headers[0]
    visits_col = args.visits_col or find_col(headers, must=["profile", "visit"]) or find_col(headers, must=["visit"])
    follows_col = args.follows_col or find_col(headers, must=["new", "follow"]) or find_col(headers, must=["follow"], must_not=["unfollow", "following"])
    impr_col = args.impressions_col or find_col(headers, must=["impression"])
    followers_col = args.followers_col or find_col(headers, must=["followers"], must_not=["new", "unfollow"])

    print(f"Column mapping (verify!):")
    print(f"  date        <- {date_col!r}")
    print(f"  visits      <- {visits_col!r}")
    print(f"  new follows <- {follows_col!r}")
    print(f"  impressions <- {impr_col!r}")
    print(f"  followers   <- {followers_col!r}")
    if not (visits_col and follows_col):
        sys.exit("Could not locate both visits & follows columns. Pass --visits-col / --follows-col.")

    # the most recent date in THIS import is "today" — partial/incomplete, drop by default
    parsed_dates = [d for d in (parse_date_cell(r.get(date_col, "")) for r in rows) if d]
    latest_in_file = max(parsed_dates) if parsed_dates else None
    skip_date = None if args.keep_latest else latest_in_file

    existing = {r["date"]: r for r in read_jsonl(DAILY)}
    if skip_date:
        existing.pop(skip_date, None)  # also purge any stale partial row already stored
        print(f"  (ignoring latest day {skip_date} — incomplete; pass --keep-latest to override)")
    added = 0
    for row in rows:
        d = parse_date_cell(row.get(date_col, ""))
        if not d or d == skip_date:
            continue
        visits = to_int(row.get(visits_col))
        follows = to_int(row.get(follows_col))
        ratio = round(follows / visits, 4) if (visits and follows is not None) else None
        rec = {
            "date": d,
            "profile_visits": visits,
            "new_follows": follows,
            "ratio": ratio,
            "impressions": to_int(row.get(impr_col)) if impr_col else None,
            "followers_total": to_int(row.get(followers_col)) if followers_col else None,
        }
        existing[d] = rec
        added += 1

    write_jsonl(DAILY, [existing[d] for d in sorted(existing)])
    print(f"\nUpserted {added} day(s). {DAILY} now has {len(existing)} day(s).")


if __name__ == "__main__":
    main()
