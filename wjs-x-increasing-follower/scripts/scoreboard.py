#!/usr/bin/env python3
"""Render state/SCOREBOARD.md — the to-do list + live experiment verdicts.

Sections:
    1. Headline    — latest ratio, 7d median ratio, follower total, trend
    2. Active      — running experiments with baseline/post/Δ/verdict
    3. Backlog     — proposed (not yet applied) actions = the TO-DO LIST
    4. Settled     — kept / rolled_back, with outcomes

Usage: python3 scoreboard.py   (writes state/SCOREBOARD.md and prints it)
"""
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (SCOREBOARD, METRIC_LABEL, load_actions, load_daily,  # noqa: E402
                     med, parse_date, today_str)
import importlib.util

# reuse evaluate.evaluate()
_spec = importlib.util.spec_from_file_location("evaluate", Path(__file__).resolve().parent / "evaluate.py")
_ev = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ev)


def pct(v):
    return "—" if v is None else f"{v:+.0%}"


def num(v, places=3):
    if v is None:
        return "—"
    return f"{v:.{places}f}" if isinstance(v, float) else f"{v:,}"


def headline(daily):
    if not daily:
        return ["_No daily data yet. Drop a dashboard CSV and run `ingest-csv.py`._"]
    latest = daily[-1]

    def agg(days):
        tv = sum(d["profile_visits"] for d in days if d.get("profile_visits") is not None)
        tf = sum((d.get("new_follows") or 0) for d in days if d.get("profile_visits") is not None)
        return round(tf / tv, 4) if tv else None

    L = []
    L.append(f"- **Latest day ({latest['date']})**: {num(latest.get('profile_visits'))} visits, "
             f"{num(latest.get('new_follows'))} new follows → ratio **{num(latest.get('ratio'))}**")
    L.append(f"- **Conversion (Σfollows÷Σvisits, traffic-weighted)** — "
             f"7d **{num(agg(daily[-7:]))}** · 30d **{num(agg(daily[-30:]))}** · 90d **{num(agg(daily[-90:]))}**")
    if latest.get("followers_total") is not None:
        L.append(f"- **Followers total**: {num(latest['followers_total'])}")
    return L


def main():
    daily = load_daily()
    actions = load_actions()
    results, _ = _ev.evaluate(threshold=0.10, min_post_days=3)
    res_by_id = {r["id"]: r for r in results}

    out = [f"# X Follower Growth — Scoreboard", f"_generated {today_str()}_", ""]
    out += ["## 📈 Where we stand", ""] + headline(daily) + [""]

    # Active experiments
    out += ["## 🧪 Active experiments", ""]
    active = [a for a in actions if a["status"] == "active"]
    if active:
        out += ["| # | cat | experiment | metric | baseline | post | Δ | verdict | note |",
                "|---|-----|-----------|--------|----------|------|---|---------|------|"]
        for a in active:
            r = res_by_id.get(a["id"], {})
            v = r.get("verdict")
            state = r.get("state")
            vtxt = (f"⏳ {r.get('days_left','?')}d left" if state == "measuring"
                    else {"keep": "✅ keep", "rollback": "❌ rollback", "flat": "➖ flat"}.get(v, v or "—"))
            note = []
            if r.get("confounded_with"):
                note.append(f"confounded w/ {r['confounded_with']}")
            if r.get("thin_baseline"):
                note.append("thin baseline")
            out.append(f"| {a['id']} | {a['category']} | {a['title']} | {METRIC_LABEL[a['metric']]} | "
                       f"{num(r.get('baseline'))} | {num(r.get('post'))} | {pct(r.get('delta'))} | "
                       f"{vtxt} | {', '.join(note)} |")
    else:
        out.append("_none running._")
    out.append("")

    # Backlog = the to-do list
    out += ["## ✅ To-do (backlog — proposed, not yet applied)", ""]
    backlog = [a for a in actions if a["status"] == "proposed"]
    if backlog:
        for a in backlog:
            out.append(f"- [ ] **#{a['id']}** ({a['category']} → {METRIC_LABEL[a['metric']]}): "
                       f"{a['title']}  \n      _hypothesis: {a['hypothesis']}_")
    else:
        out.append("_empty — ask the skill to propose more actions._")
    out.append("")

    # Settled
    out += ["## 📚 Settled", ""]
    settled = [a for a in actions if a["status"] in ("kept", "rolled_back")]
    if settled:
        out += ["| # | experiment | outcome | note |", "|---|-----------|---------|------|"]
        for a in settled:
            mark = "✅ kept" if a["status"] == "kept" else "❌ rolled back"
            out.append(f"| {a['id']} | {a['title']} | {mark} | {a.get('notes','').strip()} |")
    else:
        out.append("_nothing settled yet._")
    out.append("")

    text = "\n".join(out)
    SCOREBOARD.parent.mkdir(parents=True, exist_ok=True)
    SCOREBOARD.write_text(text)
    print(text)


if __name__ == "__main__":
    main()
