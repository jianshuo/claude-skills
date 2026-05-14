#!/usr/bin/env bash
# One-time setup: check prereqs, prime research.md, install launchd plist.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.jianshuo.wjs-promoting-skills"
PLIST_DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/wjs-promoting-skills"

echo "=== wjs-promoting-skills setup ==="

for bin in claude xurl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "✗ Missing dependency: $bin"
    case "$bin" in
      jq) echo "  Install: brew install jq" ;;
      xurl) echo "  Install: brew install xurl, then xurl auth login" ;;
      claude) echo "  Install: see https://claude.com/code" ;;
    esac
    exit 1
  fi
done
echo "✓ claude, xurl, jq present"

echo "→ Verifying xurl auth..."
if ! xurl whoami >/dev/null 2>&1; then
  echo "✗ xurl whoami failed. Run: xurl auth login"
  exit 1
fi
user=$(xurl whoami 2>/dev/null | jq -r '.data.username // .data.name // empty')
echo "✓ xurl authenticated as: ${user:-<unknown>}"

mkdir -p "${HERE}/state" "${HERE}/state/plans" "${HERE}/outbox" "$LOG_DIR"
touch "${HERE}/state/history.jsonl"

cat > "${HERE}/state/.gitignore" <<'EOF'
*
!.gitignore
!README.md
EOF
cat > "${HERE}/outbox/.gitignore" <<'EOF'
*
!.gitignore
EOF

if [[ ! -f "${HERE}/state/research.md" ]]; then
  echo "→ Priming marketplace research (one-time; takes 1–3 min)..."
  if "${HERE}/research-marketplaces.sh"; then
    echo "✓ Research written to state/research.md"
  else
    echo "⚠ Research failed — you can run it later with research-marketplaces.sh"
    echo "# Marketplace research (placeholder — not yet generated)" > "${HERE}/state/research.md"
  fi
else
  echo "→ state/research.md already exists, skipping prime."
fi

echo "→ Installing launchd plist at ${PLIST_DEST}"
if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
  echo "  Unloading existing job..."
  launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null || true
fi
mkdir -p "$(dirname "$PLIST_DEST")"
sed -e "s|__DAILY_SH__|${HERE}/daily.sh|g" \
    -e "s|__HOME__|${HOME}|g" \
    "${HERE}/com.jianshuo.wjs-promoting-skills.plist.template" > "$PLIST_DEST"
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/${LABEL}"
echo "✓ Loaded and enabled. Next run: tomorrow 04:00."
