#!/usr/bin/env bash
# One-time setup: check prereqs, install launchd plist for daily 09:00 run.
# Re-runnable: safe to run multiple times.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.jianshuo.wjs-tweeting-from-articles"
PLIST_DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/wjs-tweeting-from-articles"

echo "=== wjs-tweeting-from-articles setup ==="

# 1. Prereqs
echo "→ checking prereqs..."
for bin in claude xurl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "✗ missing: $bin"
    case "$bin" in
      jq) echo "  install: brew install jq" ;;
      xurl) echo "  install: brew install xurl, then xurl auth login" ;;
      claude) echo "  install: see https://claude.com/code" ;;
    esac
    exit 1
  fi
done
echo "✓ claude, xurl, jq present"

# 2. xurl auth
echo "→ verifying xurl auth..."
if ! xurl whoami >/dev/null 2>&1; then
  echo "✗ xurl whoami failed. Run: xurl auth login"
  exit 1
fi
user=$(xurl whoami 2>/dev/null | jq -r '.data.username // .data.name // empty')
echo "✓ xurl authenticated as: ${user:-<unknown>}"

# 3. State + log dirs
mkdir -p "${HERE}/state" "$LOG_DIR"
touch "${HERE}/state/history.jsonl"

# 4. Install plist
echo "→ installing launchd plist at ${PLIST_DEST}"
if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
  echo "  unloading existing job..."
  launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null || true
fi

mkdir -p "$(dirname "$PLIST_DEST")"
sed -e "s|__DAILY_SH__|${HERE}/daily.sh|g" \
    -e "s|__HOME__|${HOME}|g" \
    "${HERE}/com.jianshuo.wjs-tweeting-from-articles.plist.template" > "$PLIST_DEST"

launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/${LABEL}"
echo "✓ loaded + enabled. Next run: tomorrow 09:00 (your local time)."

cat <<EOF

=== setup complete ===

Schedule:    Daily at 09:00 (macOS launchd, local time)
Log:         ${LOG_DIR}/daily-YYYY-MM-DD.log
launchd:     ${PLIST_DEST}

Useful commands:
  ${HERE}/scripts/pick-next-article.sh        # see what tomorrow will pick
  DRY_RUN=1 ${HERE}/daily.sh                  # full dry-run (draft, no post)
  ${HERE}/daily.sh                            # force a real run now
  launchctl print gui/$(id -u)/${LABEL}       # inspect launchd state
  ${HERE}/uninstall.sh                        # stop auto-runs

To trigger the job manually now:
  launchctl kickstart -k gui/$(id -u)/${LABEL}
  tail -f ${LOG_DIR}/daily-\$(date +%Y-%m-%d).log
EOF
