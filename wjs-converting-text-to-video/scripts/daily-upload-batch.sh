#!/usr/bin/env bash
# Daily YouTube upload: pick up to 5 articles where the MP4 exists but no
# .youtube.json record, upload them, save records. Designed for cron — stays
# under YouTube daily quota (default 6 uploads/day @ 1600 quota points each).
#
# Crontab: 0 10 * * * /Users/jianshuo/.claude/skills/wjs-converting-text-to-video/scripts/daily-upload-batch.sh
set -euo pipefail

MAX_PER_DAY="${MAX_PER_DAY:-5}"
ARTICLES_ROOT="${ARTICLES_ROOT:-/Users/jianshuo/Library/Mobile Documents/com~apple~CloudDocs/my/我的项目/我的创作/wechat-publish/articles}"
PUBLISH_SCRIPT="/Users/jianshuo/.claude/skills/wjs-converting-text-to-video/scripts/publish-to-youtube.py"
LOG_DIR="/Users/jianshuo/Library/Mobile Documents/com~apple~CloudDocs/my/我的项目/我的创作/wechat-publish/.upload-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d).log"

# Source env (Volcano TTS not needed here, but proxy + YouTube creds may be)
if [[ -f "$HOME/code/.env" ]]; then
  set -a
  source "$HOME/code/.env"
  set +a
fi

# Ensure python deps reachable
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

echo "[$(date)] === daily-upload-batch starting (max $MAX_PER_DAY) ===" | tee -a "$LOG"

# Find candidates: <article-folder>/*.mp4 exists, .youtube.json missing
# Process oldest article first (clear backlog from old → new)
candidates=()
for d in "$ARTICLES_ROOT"/*/; do
  [[ -d "$d" && -f "$d/article.md" ]] || continue
  # Skip if already uploaded
  [[ -f "$d/.youtube.json" ]] && continue
  # Find an MP4 in the article root (not video/)
  mp4=$(ls "$d"*.mp4 2>/dev/null | grep -v -- "-OLD\|-silang\|-raw" | head -1 || true)
  [[ -z "$mp4" ]] && continue
  candidates+=("$d")
done

echo "[$(date)] found ${#candidates[@]} unuploaded MP4s" | tee -a "$LOG"

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "[$(date)] nothing to upload" | tee -a "$LOG"
  exit 0
fi

# Sort by article date (folder name starts with YYYY-MM-DD) — oldest first
sorted=($(printf '%s\n' "${candidates[@]}" | sort))

uploaded=0
for d in "${sorted[@]}"; do
  if [[ $uploaded -ge $MAX_PER_DAY ]]; then
    echo "[$(date)] reached daily cap $MAX_PER_DAY, stopping" | tee -a "$LOG"
    break
  fi
  name=$(basename "$d")
  echo "" | tee -a "$LOG"
  echo "[$(date)] === uploading $name ===" | tee -a "$LOG"
  if python3 "$PUBLISH_SCRIPT" "$d" 2>&1 | tee -a "$LOG"; then
    uploaded=$((uploaded + 1))
  else
    echo "[$(date)] upload failed for $name — possibly quota exhausted, will retry tomorrow" | tee -a "$LOG"
    # Don't increment uploaded — but also don't continue, since further uploads will likely fail too
    break
  fi
done

echo "" | tee -a "$LOG"
echo "[$(date)] === done: uploaded $uploaded videos ===" | tee -a "$LOG"
