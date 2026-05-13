#!/usr/bin/env bash
# Uninstall: unload the launchd plist. State files are preserved.

set -uo pipefail
LABEL="com.jianshuo.wjs-promoting-skills"
PLIST_DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

echo "=== Uninstalling wjs-promoting-skills launchd job ==="

if [[ -f "$PLIST_DEST" ]]; then
  if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
    echo "→ Unloading job..."
    launchctl bootout "gui/$(id -u)" "$PLIST_DEST" || true
  fi
  echo "→ Removing plist: $PLIST_DEST"
  rm -f "$PLIST_DEST"
  echo "✓ Done. State files (history.jsonl, plans/, outbox/) preserved."
else
  echo "→ No plist at $PLIST_DEST — nothing to uninstall."
fi

echo ""
echo "To fully remove state (irreversible):"
echo "  rm -rf $(cd "$(dirname "$0")" && pwd)/state $(cd "$(dirname "$0")" && pwd)/outbox"
