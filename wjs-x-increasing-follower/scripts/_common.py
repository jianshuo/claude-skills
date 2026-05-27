"""Shared helpers for wjs-x-increasing-follower scripts. stdlib only."""
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median

SKILL_DIR = Path(__file__).resolve().parent.parent
STATE = SKILL_DIR / "state"
DAILY = STATE / "daily.jsonl"
ACTIONS = STATE / "actions.jsonl"
SCOREBOARD = STATE / "SCOREBOARD.md"

# action.metric -> daily field
METRIC_FIELD = {
    "ratio": "ratio",
    "visits": "profile_visits",
    "impressions": "impressions",
    "follows": "new_follows",
}
METRIC_LABEL = {
    "ratio": "follows÷visits",
    "visits": "profile visits",
    "impressions": "impressions",
    "follows": "new follows",
}


def read_jsonl(path: Path):
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def load_daily():
    """date(str) -> row, sorted by date."""
    rows = {r["date"]: r for r in read_jsonl(DAILY)}
    return [rows[d] for d in sorted(rows)]


def load_actions():
    return read_jsonl(ACTIONS)


def parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


def daterange_values(daily, field, start: date, end: date):
    """median-ready list of `field` over [start, end] inclusive, skipping None."""
    out = []
    for r in daily:
        d = parse_date(r["date"])
        if start <= d <= end:
            v = r.get(field)
            if v is not None:
                out.append(v)
    return out


def med(vals):
    return round(median(vals), 4) if vals else None


def today_str():
    return date.today().isoformat()
