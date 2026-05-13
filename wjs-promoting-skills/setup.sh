#!/usr/bin/env bash
# One-time setup: check prereqs, prime research.md, install launchd plist.
# Re-runnable: safe to run multiple times.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.jianshuo.wjs-promoting-skills"
PLIST_DEST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/wjs-promoting-skills"

echo "=== wjs-promoting-skills setup ==="

# --- 1. Prereqs ---
echo "→ Checking prereqs..."
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

# --- 2. xurl auth ---
echo "→ Verifying xurl auth..."
if ! xurl whoami >/dev/null 2>&1; then
  echo "✗ xurl whoami failed. Run: xurl auth login"
  exit 1
fi
user=$(xurl whoami 2>/dev/null | jq -r '.data.username // .data.name // empty')
echo "✓ xurl authenticated as: ${user:-<unknown>}"

# --- 3. State dirs ---
mkdir -p "${HERE}/state" "${HERE}/state/plans" "${HERE}/outbox" "$LOG_DIR"
touch "${HERE}/state/history.jsonl"

# --- 4. .gitignore for state/ and outbox/ (they hold post histories + drafts, not for GitHub) ---
cat > "${HERE}/state/.gitignore" <<'EOF'
# State is local-only. history.jsonl has tweet IDs; plans/ has marketing internals.
*
!.gitignore
!README.md
EOF
cat > "${HERE}/outbox/.gitignore" <<'EOF'
# Drafts are local-only.
*
!.gitignore
EOF

# --- 5. Prime research.md if missing ---
if [[ ! -f "${HERE}/state/research.md" ]]; then
  echo "→ Priming marketplace research (one-time; takes 1–3 min)..."
  if "${HERE}/research-marketplaces.sh"; then
    echo "✓ Research written to state/research.md"
  else
    echo "⚠ Research failed — you can run it later with research-marketplaces.sh"
    # Write a placeholder so daily.sh doesn't choke
    echo "# Marketplace research (placeholder — not yet generated)" > "${HERE}/state/research.md"
  fi
else
  echo "→ state/research.md already exists, skipping prime."
fi

# --- 6. Render and install plist ---
echo "→ Installing launchd plist at ${PLIST_DEST}"

# Unload first if already loaded (idempotent)
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

# --- 7. Summary ---
cat <<EOF

=== Setup complete ===

Skill:       ${HERE}
Schedule:    Daily at 04:00 (macOS launchd)
Log:         ${LOG_DIR}/daily-YYYY-MM-DD.log
launchd:     ${PLIST_DEST}

Useful commands:
  ${HERE}/pick-next-skill.sh                  # see what tomorrow's run will pick
  DRY_RUN=1 ${HERE}/daily.sh                  # full dry-run (no X post)
  SKILL=wjs-segmenting-video ${HERE}/daily.sh # force a specific skill (still respects DRY_RUN)
  launchctl print gui/$(id -u)/${LABEL}       # inspect job state
  ${HERE}/uninstall.sh                        # stop auto-runs

To trigger the job once manually right now:
  launchctl kickstart -k gui/$(id -u)/${LABEL}
  tail -f ${LOG_DIR}/daily-\$(date +%Y-%m-%d).log
EOF
