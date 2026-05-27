#!/usr/bin/env python3
"""Join the X Analytics Content CSV with the bot's post history into state/tweets.jsonl.

Each row of the Content CSV is one tweet (Post id = tweet_id). We:
  - parse per-tweet impressions + engagement counts
  - join to history.jsonl on tweet_id → adds slug, angle, source=bot (else manual)
  - derive prompt_sha by date: the prompts/x/prompt.md git commit live at post time
    (tweets posted before the prompt file existed get prompt_sha=null = "pre-prompt")
  - compute char_len (CJK proxy) + age_days + mature flag

Usage:  python3 ingest-tweets.py /path/to/content.csv
Upserts by tweet_id. Re-running with a longer export is safe.
"""
import argparse, csv, subprocess, sys
from datetime import datetime, date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (TWEETS, HISTORY, REPO, PROMPT_FILE, MATURITY_DAYS,  # noqa: E402
                     read_jsonl, write_jsonl, cjk_len)


def parse_date_cell(v):
    v = v.strip().strip('"')
    for fmt in ("%a, %b %d, %Y", "%Y-%m-%d", "%b %d, %Y", "%m/%d/%Y", "%a %b %d, %Y"):
        try:
            return datetime.strptime(v, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def to_int(v):
    try:
        return int(round(float(str(v).strip().replace(",", "") or 0)))
    except ValueError:
        return None


def prompt_commits():
    """[(iso_date, short_sha)] for prompts/x/prompt.md, oldest→newest. Empty if none."""
    try:
        out = subprocess.run(
            ["git", "-C", str(REPO), "log", "--reverse", "--date=short",
             "--format=%ad %h", "--", PROMPT_FILE],
            capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return []
    rows = []
    for line in out.splitlines():
        if line.strip():
            d, sha = line.split()
            rows.append((d, sha))
    return rows


def sha_for_date(commits, d_iso):
    """latest prompt commit with date <= tweet date; None if tweet predates the prompt file."""
    chosen = None
    for cdate, sha in commits:
        if cdate <= d_iso:
            chosen = sha
        else:
            break
    return chosen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    args = ap.parse_args()

    hist = {h["tweet_id"]: h for h in read_jsonl(HISTORY) if h.get("tweet_id")}
    commits = prompt_commits()
    today = date.today()

    existing = {t["tweet_id"]: t for t in read_jsonl(TWEETS)}
    rows = list(csv.DictReader(open(args.csv_path, newline="", encoding="utf-8-sig")))
    n = 0
    for r in rows:
        tid = (r.get("Post id") or "").strip()
        d = parse_date_cell(r.get("Date", ""))
        if not tid or not d:
            continue
        text = r.get("Post text", "") or ""
        h = hist.get(tid, {})
        age = (today - date.fromisoformat(d)).days
        rec = {
            "tweet_id": tid,
            "date": d,
            "impressions": to_int(r.get("Impressions")),
            "engagements": to_int(r.get("Engagements")),
            "likes": to_int(r.get("Likes")),
            "replies": to_int(r.get("Replies")),
            "reposts": to_int(r.get("Reposts")),
            "new_follows": to_int(r.get("New follows")),
            "char_len": cjk_len(text),
            "text": text,
            "slug": h.get("slug"),
            "angle": h.get("angle"),
            "source": "bot" if tid in hist else "manual",
            "prompt_sha": sha_for_date(commits, d),
            "age_days": age,
            "mature": age >= MATURITY_DAYS,
        }
        existing[tid] = rec
        n += 1

    write_jsonl(TWEETS, [existing[k] for k in sorted(existing, key=lambda k: existing[k]["date"])])
    mature = sum(1 for t in existing.values() if t["mature"])
    bot = sum(1 for t in existing.values() if t["source"] == "bot")
    print(f"Upserted {n} tweet(s). Total {len(existing)} ({bot} bot / {len(existing)-bot} manual), "
          f"{mature} mature (≥{MATURITY_DAYS}d).")
    if not commits:
        print("⚠ no git history for prompts/x/prompt.md — prompt_sha=null for all. "
              "Version comparison starts once the prompt file has commits.")
    else:
        print(f"prompt versions seen: {len(commits)} ({', '.join(s for _, s in commits)})")


if __name__ == "__main__":
    main()
