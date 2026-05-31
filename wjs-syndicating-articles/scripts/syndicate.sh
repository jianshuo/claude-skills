#!/usr/bin/env bash
# syndicate.sh <article-folder> <post.txt> [--dry-run]
# Deterministic fan-out. SLUG = basename of folder (canonical key everywhere).
# API platforms: post (or degrade to queued/no_creds); manual platforms: build outbox + queue.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ensure_state

FOLDER="${1:?usage: syndicate.sh <article-folder> <post.txt> [--dry-run]}"
POST_TXT="${2:?usage: syndicate.sh <article-folder> <post.txt> [--dry-run]}"
DRY="${3:-}"
SLUG="$(basename "$FOLDER")"
TW_HIST="${SYND_TW_HISTORY:-$HOME/.claude/skills/wjs-tweeting-from-articles/state/history.jsonl}"

echo "syndicate: slug=$SLUG dry=${DRY:-no}"

# ---- API platforms ----
for P in $(enabled_platforms); do
  [[ "$(platform_mode "$P")" == "api" ]] || continue

  # X is owned exclusively by wjs-tweeting-from-articles. This skill must NEVER post to X
  # (posting here double-posts). Always skip X structurally, regardless of tweeting history.
  if [[ "$P" == "x" ]]; then
    [[ "$DRY" == "--dry-run" ]] || bash "$SCRIPTS/history.sh" has "$SLUG" x || \
      bash "$SCRIPTS/history.sh" record "$SLUG" x skipped "" "" "owned_by_tweeting_skill"
    echo "  x: skipped (owned by wjs-tweeting-from-articles)"; continue
  fi
  if bash "$SCRIPTS/history.sh" has "$SLUG" "$P"; then echo "  $P: skipped (already done)"; continue; fi

  if [[ "$DRY" == "--dry-run" ]]; then
    bash "$SCRIPTS/post-$P.sh" "$POST_TXT" --dry-run >/dev/null 2>&1 || true; echo "  $P: DRY"; continue
  fi

  OUT=""; CODE=0
  OUT="$(bash "$SCRIPTS/post-$P.sh" "$POST_TXT" 2>/dev/null)" && CODE=0 || CODE=$?
  case $CODE in
    0) URL="$(echo "$OUT" | sed -n 's/^url=//p')"; PID="$(echo "$OUT" | sed -n 's/^post_id=//p')"
       bash "$SCRIPTS/history.sh" record "$SLUG" "$P" posted "$URL" "$PID"; echo "  $P: posted $URL" ;;
    3) bash "$SCRIPTS/history.sh" record "$SLUG" "$P" queued "" "" no_creds; echo "  $P: queued (no creds -> outbox)" ;;
    *) bash "$SCRIPTS/history.sh" record "$SLUG" "$P" failed; echo "  $P: FAILED -> will retry next run" ;;
  esac
done

# ---- manual platforms -> outbox ----
OUTBOX="$SKILL_DIR/outbox/$SLUG"
if [[ "$DRY" == "--dry-run" ]]; then
  echo "  (dry-run) would build outbox at $OUTBOX and queue manual platforms"
else
  bash "$SCRIPTS/build-outbox.sh" "$FOLDER" "$POST_TXT" "$OUTBOX" >/dev/null
  for P in $(enabled_platforms); do
    [[ "$(platform_mode "$P")" == "outbox" ]] || continue
    bash "$SCRIPTS/history.sh" has "$SLUG" "$P" || bash "$SCRIPTS/history.sh" record "$SLUG" "$P" queued
    echo "  $P: queued (outbox)"
  done
  echo "outbox=$OUTBOX"
fi
