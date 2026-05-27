#!/usr/bin/env python3
"""Annotate prompt versions with intent + verdict (state/versions.jsonl).

The version *identity* comes from git (prompts/x/prompt.md short-SHA). This ledger
adds the human layer the SHA can't carry: the hypothesis behind each edit and the
final verdict. One line per version.

Subcommands:
    register SHA --hypothesis "..."   # record a new prompt version + why you changed it
    keep     SHA [--note ...]         # this version won → leave it live
    rollback SHA [--note ...]         # this version lost → git checkout the prior SHA, mark it
    list

Typical flow:
    # 1. edit prompts/x/prompt.md, commit it → new SHA appears
    # 2. register that SHA with the hypothesis
    # 3. let tweets accrue, then evaluate.py → keep / rollback
"""
import argparse, sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import VERSIONS, read_jsonl, write_jsonl  # noqa: E402


def save(rows): write_jsonl(VERSIONS, rows)


def get(rows, sha):
    for r in rows:
        if r["prompt_sha"] == sha:
            return r
    return None


def cmd_register(a):
    rows = read_jsonl(VERSIONS)
    if get(rows, a.sha):
        sys.exit(f"version {a.sha} already registered.")
    n = max((r.get("id", 0) for r in rows), default=0) + 1
    rows.append({"id": n, "prompt_sha": a.sha, "hypothesis": a.hypothesis,
                 "registered": date.today().isoformat(), "status": "active",
                 "verdict": None, "notes": ""})
    save(rows)
    print(f"Registered v{n} ({a.sha}): {a.hypothesis}")


def _close(a, status):
    rows = read_jsonl(VERSIONS)
    r = get(rows, a.sha) or sys.exit(f"version {a.sha} not registered.")
    r["status"] = status
    if a.note:
        r["notes"] = (r["notes"] + " " + a.note).strip()
    save(rows)
    print(f"{a.sha} -> {status}.")
    if status == "rolled_back":
        print(f"  还原命令: git -C ~/code/wechat-publish checkout <prior-sha> -- prompts/x/prompt.md")


def cmd_list(a):
    rows = read_jsonl(VERSIONS)
    for r in rows:
        print(f"  v{r['id']} {r['prompt_sha']} [{r['status']}] {r.get('verdict') or ''} — {r['hypothesis']}")
    if not rows:
        print("  (none) — 还没登记任何 prompt 版本")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("register"); p.set_defaults(fn=cmd_register)
    p.add_argument("sha"); p.add_argument("--hypothesis", required=True)
    p = sub.add_parser("keep"); p.set_defaults(fn=lambda a: _close(a, "kept"))
    p.add_argument("sha"); p.add_argument("--note")
    p = sub.add_parser("rollback"); p.set_defaults(fn=lambda a: _close(a, "rolled_back"))
    p.add_argument("sha"); p.add_argument("--note")
    p = sub.add_parser("list"); p.set_defaults(fn=cmd_list)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
