#!/usr/bin/env python3
"""Clean spam replies under @jianshuo's recent tweets.

Pipeline: fetch replies (last 7 days, X recent-search window) -> classify ->
report (dry-run) or hide+mute (--apply). Idempotent: processed ids recorded in
state/cleaned.jsonl and skipped on re-run, so re-running after a 429 rate-limit
continues where it left off.

Usage:
  clean_spam.py            # dry-run: print flagged + borderline lists as JSON
  clean_spam.py --apply    # hide flagged replies + mute their authors
  clean_spam.py --apply --ids id1,id2  # apply to an explicit id list instead
                           # of the heuristic (after Claude reviewed borderline)

Requires: xurl authenticated (xurl auth status).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import unicodedata

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(SKILL_DIR, "state", "cleaned.jsonl")

# Spam-account display-name keywords (同城引流号 families seen so far).
NAME_KW = [
    "同城", "面付", "上门", "丄门", "空降", "外围", "喝茶", "楼凤", "约炮",
    "约啪", "固炮", "破处", "兼职", "学生妹", "熟女", "少妇", "点击主页",
    "箥菜", "博彩", "usdt", "代充", "出黑", "网赚", "日赚",
]
# Invisible chars spammers inject to dodge text filters (the 糯米 case).
INVISIBLE = re.compile(r"[͏​-‏⁠﻿]")


def xurl(path, method=None, body=None):
    cmd = ["xurl"]
    if method:
        cmd += ["-X", method]
    cmd.append(path)
    if body:
        cmd += ["-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    # xurl prints the JSON (even for errors) to stdout
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"_raw": r.stdout, "_stderr": r.stderr}


def fetch_replies(username):
    """Paginate /2/tweets/search/recent for replies to @username (7-day window)."""
    tweets, users = [], {}
    token = None
    for _ in range(15):
        # NOTE: the query value MUST be URL-encoded (to%3A...) — a literal ":" => 401
        path = (
            f"/2/tweets/search/recent?query=to%3A{username}&max_results=100"
            "&tweet.fields=created_at,author_id,conversation_id"
            "&expansions=author_id&user.fields=username,name"
        )
        if token:
            path += f"&next_token={token}"
        d = xurl(path)
        if "data" not in d:
            print(f"fetch error: {json.dumps(d)[:300]}", file=sys.stderr)
            break
        tweets += d["data"]
        for u in d.get("includes", {}).get("users", []):
            users[u["id"]] = u
        token = d.get("meta", {}).get("next_token")
        if not token:
            break
        time.sleep(1)
    return tweets, users


def classify(tweets, users):
    """Return (flagged, borderline). Flagged = confident spam; borderline needs review."""
    flagged, borderline = [], []
    for t in tweets:
        u = users.get(t["author_id"], {})
        name = (u.get("name", "") + " " + u.get("username", "")).lower()
        txt = re.sub(r"https?://\S+|@\w+", "", t["text"]).strip()
        emojis = sum(1 for c in txt if unicodedata.category(c) == "So")
        letters = sum(1 for c in txt if c.isalnum())
        rec = {
            "id": t["id"], "created": t["created_at"],
            "author_id": t["author_id"], "author": u.get("username", "?"),
            "name": u.get("name", "?"), "text": t["text"],
        }
        if any(k in name for k in NAME_KW):
            rec["reason"] = "name-keyword"
            flagged.append(rec)
        elif emojis >= 2 and letters <= 2:
            rec["reason"] = "emoji-only"
            flagged.append(rec)
        elif INVISIBLE.search(txt):
            rec["reason"] = "invisible-chars"
            flagged.append(rec)
        elif any(c in u.get("name", "") for c in "💕🌸♥💋🍵") or (emojis >= 1 and len(txt) <= 6):
            rec["reason"] = "borderline"
            borderline.append(rec)
    return flagged, borderline


def load_done():
    done = set()
    if os.path.exists(STATE):
        for line in open(STATE):
            try:
                done.add(json.loads(line)["id"])
            except (json.JSONDecodeError, KeyError):
                pass
    return done


def apply_actions(items, my_id):
    done = load_done()
    muted_authors = set()
    log = open(STATE, "a")
    hidden = skipped = failed = 0
    for rec in items:
        if rec["id"] in done:
            skipped += 1
            continue
        r = xurl(f"/2/tweets/{rec['id']}/hidden", "PUT", {"hidden": True})
        if r.get("data", {}).get("hidden"):
            status = "hidden"
            hidden += 1
        elif "Too Many Requests" in json.dumps(r):
            print(f"RATE-LIMITED at {rec['id']} — re-run in 15 min to continue",
                  file=sys.stderr)
            break
        else:
            # e.g. conversation not rooted at our tweet -> cannot hide
            status = "hide-failed"
            failed += 1
        # mute author regardless (block endpoint no longer exists in the API)
        if rec["author_id"] not in muted_authors:
            m = xurl(f"/2/users/{my_id}/muting", "POST",
                     {"target_user_id": rec["author_id"]})
            if m.get("data", {}).get("muting"):
                muted_authors.add(rec["author_id"])
        log.write(json.dumps({**rec, "status": status}, ensure_ascii=False) + "\n")
        log.flush()
        time.sleep(1)
    print(f"hidden={hidden} hide-failed={failed} already-done={skipped} "
          f"muted-authors={len(muted_authors)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--ids", help="comma-separated tweet ids to act on (with --apply)")
    args = ap.parse_args()

    me = xurl("/2/users/me").get("data", {})
    if not me:
        sys.exit("xurl not authenticated — run: xurl auth status")
    tweets, users = fetch_replies(me["username"])
    flagged, borderline = classify(tweets, users)
    done = load_done()

    if args.ids:
        wanted = set(args.ids.split(","))
        flagged = [r for r in flagged + borderline if r["id"] in wanted]

    if not args.apply:
        print(json.dumps({
            "total_replies": len(tweets),
            "flagged": [r for r in flagged if r["id"] not in done],
            "borderline": [r for r in borderline if r["id"] not in done],
            "already_cleaned": len([r for r in flagged if r["id"] in done]),
        }, ensure_ascii=False, indent=1))
        return
    apply_actions(flagged, me["id"])


if __name__ == "__main__":
    main()
