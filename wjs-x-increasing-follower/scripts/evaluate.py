#!/usr/bin/env python3
"""Evaluate every ACTIVE experiment: baseline vs post-window, on its own metric.

Single-account reality check: this is NOT a parallel A/B test. It is a
sequential before/after on one timeline, so we defend against the obvious traps:
  - MEDIAN (not mean) over each window -> one viral day can't fake a win.
  - Minimum data + elapsed window before any verdict -> no early calls.
  - CONFOUND flag when another active experiment on the SAME metric overlaps
    this window -> the read is shared, don't over-trust it.
We report a DIRECTIONAL verdict, never causality.

Windows (applied day itself excluded, partial-day noise):
    baseline = [applied - window_days, applied - 1]
    post     = [applied + 1, min(latest, applied + window_days)]

Verdict (relative to baseline median):
    keep      delta >= +THRESHOLD
    rollback  delta <= -THRESHOLD
    flat      otherwise
Default THRESHOLD = 0.10 (=+/-10%).

Usage:
    python3 evaluate.py                 # print table
    python3 evaluate.py --json          # machine-readable
    python3 evaluate.py --write-verdict # store verdict+evaluated into ledger (does NOT change status)
    python3 evaluate.py --threshold 0.15 --min-post-days 3
"""
import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (ACTIONS, METRIC_FIELD, METRIC_LABEL, daterange_values,  # noqa: E402
                     load_actions, load_daily, med, parse_date, write_jsonl)


def metric_over(daily, metric, start, end):
    """Window value + n. For 'ratio' use TRAFFIC-WEIGHTED aggregate (Σfollows/Σvisits)
    so tiny-denominator days can't distort it; for count metrics use the median."""
    if metric == "ratio":
        v = daterange_values(daily, "profile_visits", start, end)
        f = daterange_values(daily, "new_follows", start, end)
        # count only days that have a visit number (the measurable days)
        days = [r for r in daily if start <= parse_date(r["date"]) <= end
                and r.get("profile_visits") is not None]
        tv = sum(r["profile_visits"] for r in days)
        tf = sum((r.get("new_follows") or 0) for r in days)
        return (round(tf / tv, 4) if tv else None), len(days)
    vals = daterange_values(daily, METRIC_FIELD[metric], start, end)
    return med(vals), len(vals)


def windows(a, latest):
    applied = parse_date(a["applied"])
    w = a.get("window_days", 7)
    base = (applied - timedelta(days=w), applied - timedelta(days=1))
    post = (applied + timedelta(days=1), min(latest, applied + timedelta(days=w)))
    return applied, w, base, post


def overlaps(a1, a2, latest):
    """do two actions' post windows overlap (and share a metric)?"""
    if a1["metric"] != a2["metric"]:
        return False
    _, _, _, p1 = windows(a1, latest)
    _, _, _, p2 = windows(a2, latest)
    return p1[0] <= p2[1] and p2[0] <= p1[1]


def evaluate(threshold, min_post_days):
    daily = load_daily()
    actions = load_actions()
    if not daily:
        return [], None
    latest = parse_date(daily[-1]["date"])
    active = [a for a in actions if a["status"] == "active" and a.get("applied")]
    results = []
    for a in active:
        applied, w, (bs, be), (ps, pe) = windows(a, latest)
        baseline, n_base = metric_over(daily, a["metric"], bs, be)
        post, n_post = metric_over(daily, a["metric"], ps, pe)
        days_elapsed = (latest - applied).days
        confounded = [b["id"] for b in active if b["id"] != a["id"] and overlaps(a, b, latest)]

        r = {
            "id": a["id"], "title": a["title"], "category": a["category"],
            "metric": a["metric"], "metric_label": METRIC_LABEL[a["metric"]],
            "applied": a["applied"], "window_days": w,
            "baseline": baseline, "post": post,
            "n_baseline": n_base, "n_post": n_post,
            "confounded_with": confounded,
        }
        if n_post < min_post_days and days_elapsed < w:
            r["state"] = "measuring"
            r["days_left"] = max(0, w - days_elapsed)
            r["delta"] = None
            r["verdict"] = None
        elif baseline in (None, 0) or post is None:
            r["state"] = "no-baseline" if not baseline else "no-data"
            r["delta"] = None
            r["verdict"] = "inconclusive"
        else:
            delta = (post - baseline) / baseline
            r["delta"] = round(delta, 4)
            r["state"] = "ready"
            r["verdict"] = "keep" if delta >= threshold else "rollback" if delta <= -threshold else "flat"
        if r["n_baseline"] < 3 and r.get("state") != "measuring":
            r["thin_baseline"] = True
        results.append(r)
    return results, latest


def fmt(v, pct=False):
    if v is None:
        return "  —  "
    return f"{v:+.0%}" if pct else (f"{v:.3f}" if isinstance(v, float) else str(v))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.10)
    ap.add_argument("--min-post-days", type=int, default=3)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--write-verdict", action="store_true")
    args = ap.parse_args()

    results, latest = evaluate(args.threshold, args.min_post_days)
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        if not results:
            print("No active experiments to evaluate (or no daily data yet).")
        for r in results:
            line = (f"#{r['id']} [{r['state']}] {r['category']}/{r['metric_label']}: {r['title']}\n"
                    f"     baseline {fmt(r['baseline'])} (n={r['n_baseline']})  ->  "
                    f"post {fmt(r['post'])} (n={r['n_post']})  "
                    f"Δ {fmt(r['delta'], pct=True)}  =>  VERDICT: {r['verdict'] or '(measuring, '+str(r.get('days_left'))+'d left)'}")
            print(line)
            if r.get("confounded_with"):
                print(f"     ⚠ confounded with experiment(s) {r['confounded_with']} on the same metric — read with care.")
            if r.get("thin_baseline"):
                print(f"     ⚠ thin baseline (<3 days) — verdict is shaky.")

    if args.write_verdict:
        actions = load_actions()
        by_id = {r["id"]: r for r in results}
        from _common import today_str
        for a in actions:
            if a["id"] in by_id and by_id[a["id"]]["verdict"] not in (None,):
                a["verdict"] = by_id[a["id"]]["verdict"]
                a["evaluated"] = today_str()
        write_jsonl(ACTIONS, actions)
        print("\nWrote verdicts into ledger (status unchanged — keep/rollback is your call).")


if __name__ == "__main__":
    main()
