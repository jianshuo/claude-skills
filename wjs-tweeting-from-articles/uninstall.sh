#!/usr/bin/env bash
# Stop the daily 09:00 auto-tweet run. Leaves the skill itself + history intact.
set -euo pipefail
LABEL="com.jianshuo.wjs-tweeting-from-articles"
PLIST_DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

if [[ -f "$PLIST_DEST" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
  echo "✓ uninstalled launchd job; plist removed"
else
  echo "→ no plist at $PLIST_DEST; nothing to remove"
fi

echo "(skill files, state/, logs untouched)"
