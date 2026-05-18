# state/

Local-only state. Not pushed to GitHub (the sibling `.gitignore` excludes everything except this README).

## Files

- `research.md` — last marketplace research dump. Refreshed weekly (Sundays).
- `plans/<skill>.md` — per-skill 30-day angle rotation plan. Regenerated when older than 30 days.
- `history.jsonl` — one line per daily.sh run. Schema:
  ```json
  {"date":"YYYY-MM-DD","skill":"wjs-name","status":"posted|rest_day|skip_too_recent|no_repo_url|post_failed|dry_run","chars":123,"tweet_id":"...","tweet_url":"https://x.com/..."}
  ```

## Inspection

```bash
# What's been posted in the last 30 days?
tail -30 history.jsonl | jq -c 'select(.status == "posted") | {date, skill, tweet_url}'

# How many days since each skill was last posted?
~/.claude/skills/wjs-promoting-skills/list-skills.sh

# Failure rate over last 30 days?
tail -30 history.jsonl | jq -s 'group_by(.status) | map({(.[0].status): length}) | add'
```
