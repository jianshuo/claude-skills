"""Shared helpers for wjs-x-improving-content. stdlib only."""
import json
from datetime import date, datetime
from pathlib import Path
from statistics import median

SKILL_DIR = Path(__file__).resolve().parent.parent
STATE = SKILL_DIR / "state"
TWEETS = STATE / "tweets.jsonl"
VERSIONS = STATE / "versions.jsonl"
SCOREBOARD = STATE / "SCOREBOARD.md"

# Where the prompt-generated tweets are logged, and where the X prompt lives.
HISTORY = Path.home() / ".claude/skills/wjs-tweeting-from-articles/state/history.jsonl"
REPO = Path.home() / "code/wechat-publish"
PROMPT_FILE = "prompts/x/prompt.md"  # relative to REPO

MATURITY_DAYS = 3   # impressions keep climbing; tweets younger than this don't count in verdicts
MIN_TWEETS_PER_VERSION = 5  # need at least this many mature tweets before a version verdict


def read_jsonl(path: Path):
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def parse_date(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


def med(vals):
    vals = [v for v in vals if v is not None]
    return round(median(vals), 1) if vals else None


def cjk_len(text):
    """王建硕 tweets are CJK; count chars excluding whitespace as the length proxy."""
    return len("".join(text.split()))


def mature_tweets():
    return [t for t in read_jsonl(TWEETS) if t.get("mature")]
