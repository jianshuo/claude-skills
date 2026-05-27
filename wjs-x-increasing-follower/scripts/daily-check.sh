#!/usr/bin/env bash
# Mechanical half of the daily check. The agent runs this, then reviews verdicts
# and ASKS before rolling anything back (rollbacks are never silent).
#
#   1. ingest any CSVs sitting in inbox/  (then move them to inbox/done/)
#   2. evaluate active experiments, writing directional verdicts into the ledger
#   3. regenerate state/SCOREBOARD.md
#
# Usage: scripts/daily-check.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
mkdir -p inbox/done

shopt -s nullglob
csvs=(inbox/*.csv inbox/*.CSV)
if (( ${#csvs[@]} )); then
  for f in "${csvs[@]}"; do
    echo "== ingesting $f =="
    python3 scripts/ingest-csv.py "$f"
    mv "$f" "inbox/done/$(date +%Y%m%d-%H%M%S)-$(basename "$f")"
  done
else
  echo "No new CSV in inbox/ — using existing daily data."
fi

echo; echo "== evaluation =="
python3 scripts/evaluate.py --write-verdict

echo; echo "== scoreboard =="
python3 scripts/scoreboard.py >/dev/null
echo "Wrote state/SCOREBOARD.md"
echo
echo ">> If any experiment verdicts as ❌ rollback, surface it to 王建硕 and ASK before reverting."
