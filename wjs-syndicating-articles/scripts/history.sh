#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
ensure_state

cmd="${1:-}"; shift || true

case "$cmd" in
  record)  # record <slug> <platform> <status> [url] [post_id] [reason]
    slug="$1"; platform="$2"; status="$3"; url="${4:-}"; post_id="${5:-}"; reason="${6:-}"
    jq -nc --arg date "$(date +%F)" --arg slug "$slug" --arg platform "$platform" \
           --arg status "$status" --arg url "$url" --arg post_id "$post_id" --arg reason "$reason" \
       '{date:$date,slug:$slug,platform:$platform,status:$status}
        + (if $url != "" then {url:$url} else {} end)
        + (if $post_id != "" then {post_id:$post_id} else {} end)
        + (if $reason != "" then {reason:$reason} else {} end)' >> "$HISTORY"
    ;;
  has)     # has <slug> <platform>  -> exit 0 if done (posted|queued|skipped)
    slug="$1"; platform="$2"
    if jq -e --arg s "$slug" --arg p "$platform" \
        'select(.slug==$s and .platform==$p and (.status=="posted" or .status=="queued" or .status=="skipped"))' \
        "$HISTORY" >/dev/null 2>&1; then exit 0; else exit 1; fi
    ;;
  fully-done)  # fully-done <slug> -> exit 0 if every enabled platform is done
    slug="$1"
    for p in $(enabled_platforms); do
      if ! "$0" has "$slug" "$p"; then exit 1; fi
    done
    exit 0
    ;;
  *) echo "usage: history.sh {record|has|fully-done} ..." >&2; exit 2 ;;
esac
