#!/usr/bin/env python3
"""The numbered experiment ledger (state/actions.jsonl).

Every growth action is a numbered experiment so it can be evaluated and rolled
back. This CLI is the ONLY safe way to mutate the ledger (auto-increments ids,
keeps fields consistent). The actual change to X (bio edit, etc.) is applied
separately via xurl or by hand — this just records intent + before-state + status.

Subcommands:
    add      --category C --title T --hypothesis H --metric M [--window-days N]
    apply    ID [--before-field F --before-value V --after-value V]   # mark active, stamp date
    rollback ID [--note ...]                                          # mark rolled_back
    keep     ID [--note ...]                                          # mark kept
    drop     ID                                                       # delete a not-yet-applied proposal
    list     [--status S]

category: profile | posting | engagement | timing
metric:   ratio | visits | impressions | follows   (what this action is judged on)
status flow: proposed -> active -> (kept | rolled_back)
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import ACTIONS, load_actions, write_jsonl, today_str  # noqa: E402

CATEGORIES = {"profile", "posting", "engagement", "timing"}
METRICS = {"ratio", "visits", "impressions", "follows"}


def save(actions):
    write_jsonl(ACTIONS, actions)


def get(actions, aid):
    for a in actions:
        if a["id"] == aid:
            return a
    sys.exit(f"No action #{aid}.")


def cmd_add(args):
    actions = load_actions()
    if args.category not in CATEGORIES:
        sys.exit(f"category must be one of {sorted(CATEGORIES)}")
    if args.metric not in METRICS:
        sys.exit(f"metric must be one of {sorted(METRICS)}")
    new_id = max((a["id"] for a in actions), default=0) + 1
    rec = {
        "id": new_id,
        "category": args.category,
        "title": args.title,
        "hypothesis": args.hypothesis,
        "metric": args.metric,
        "window_days": args.window_days,
        "before": None,
        "after": None,
        "applied": None,
        "status": "proposed",
        "evaluated": None,
        "verdict": None,
        "notes": "",
    }
    actions.append(rec)
    save(actions)
    print(f"Added experiment #{new_id} ({args.category}/{args.metric}): {args.title}")


def cmd_apply(args):
    actions = load_actions()
    a = get(actions, args.id)
    a["status"] = "active"
    a["applied"] = args.date or today_str()
    if args.before_field or args.before_value:
        a["before"] = {"field": args.before_field, "value": args.before_value}
    if args.after_value is not None:
        a["after"] = {"value": args.after_value}
    save(actions)
    print(f"#{a['id']} now ACTIVE, applied {a['applied']}. Baseline = "
          f"{a['window_days']}d before; verdict after {a['window_days']}d of data.")
    if not a["before"]:
        print("  ⚠ no before-state recorded — rollback won't have a value to restore.")


def _close(args, status):
    actions = load_actions()
    a = get(actions, args.id)
    a["status"] = status
    a["evaluated"] = today_str()
    if args.note:
        a["notes"] = (a["notes"] + " " + args.note).strip()
    save(actions)
    print(f"#{a['id']} -> {status}.")
    if status == "rolled_back" and a.get("before"):
        print(f"  restore value: field={a['before'].get('field')} "
              f"value={a['before'].get('value')!r}")


def cmd_rollback(args):
    _close(args, "rolled_back")


def cmd_keep(args):
    _close(args, "kept")


def cmd_drop(args):
    actions = load_actions()
    a = get(actions, args.id)
    if a["status"] != "proposed":
        sys.exit(f"#{a['id']} is {a['status']}, not a proposal — use rollback/keep instead.")
    actions = [x for x in actions if x["id"] != args.id]
    save(actions)
    print(f"Dropped proposal #{args.id}.")


def cmd_list(args):
    actions = load_actions()
    if args.status:
        actions = [a for a in actions if a["status"] == args.status]
    for a in actions:
        print(f"#{a['id']:>3} [{a['status']:>11}] {a['category']:>10}/{a['metric']:<11} "
              f"{a['title']}")
    if not actions:
        print("(none)")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("add"); p.set_defaults(fn=cmd_add)
    p.add_argument("--category", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--hypothesis", required=True)
    p.add_argument("--metric", required=True)
    p.add_argument("--window-days", type=int, default=7)

    p = sub.add_parser("apply"); p.set_defaults(fn=cmd_apply)
    p.add_argument("id", type=int)
    p.add_argument("--date")
    p.add_argument("--before-field")
    p.add_argument("--before-value")
    p.add_argument("--after-value")

    p = sub.add_parser("rollback"); p.set_defaults(fn=cmd_rollback)
    p.add_argument("id", type=int); p.add_argument("--note")

    p = sub.add_parser("keep"); p.set_defaults(fn=cmd_keep)
    p.add_argument("id", type=int); p.add_argument("--note")

    p = sub.add_parser("drop"); p.set_defaults(fn=cmd_drop)
    p.add_argument("id", type=int)

    p = sub.add_parser("list"); p.set_defaults(fn=cmd_list)
    p.add_argument("--status")

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
