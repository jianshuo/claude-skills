#!/usr/bin/env bash
# post-x.sh <post.txt> [--dry-run]   exit: 0 ok / non-zero fail
# X auth is handled by xurl, not secrets.json; if xurl is unconfigured this exits 1 (recorded "failed"), never 3.
set -uo pipefail
TXT_FILE="${1:?usage: post-x.sh <post.txt> [--dry-run]}"
DRY="${2:-}"
TEXT="$(cat "$TXT_FILE")"
JSON="$(jq -nc --arg text "$TEXT" '{text:$text}')"

if [[ "$DRY" == "--dry-run" ]]; then echo "$JSON"; exit 0; fi

resp="$(xurl -X POST -d "$JSON" /2/tweets)" || { echo "xurl failed: $resp" >&2; exit 1; }
# X echoes raw newlines in `text`; grep id directly (strict jq would choke).
id="$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')"
[[ -n "$id" ]] || { echo "no tweet id: $resp" >&2; exit 1; }
echo "url=https://x.com/jianshuo/status/$id"
echo "post_id=$id"
