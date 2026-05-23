#!/usr/bin/env bash
# post-threads.sh <post.txt> [--dry-run]  exit: 0 ok / 3 no creds / other fail
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
TXT_FILE="${1:?usage: post-threads.sh <post.txt> [--dry-run]}"
DRY="${2:-}"
TEXT="$(cat "$TXT_FILE")"

TOKEN="$(secret '.threads.access_token')"
UID_="$(secret '.threads.user_id')"
[[ -n "$TOKEN" && -n "$UID_" ]] || { echo "threads: no creds" >&2; exit 3; }

if [[ "$DRY" == "--dry-run" ]]; then echo "threads would post: $TEXT"; exit 0; fi

API="https://graph.threads.net/v1.0"
# 1) create container
cre="$(curl -fsS -X POST "$API/$UID_/threads" \
  --data-urlencode "media_type=TEXT" \
  --data-urlencode "text=$TEXT" \
  --data-urlencode "access_token=$TOKEN")" || { echo "threads container failed: $cre" >&2; exit 1; }
CID="$(echo "$cre" | jq -r .id)"
[[ -n "$CID" && "$CID" != "null" ]] || { echo "threads no container id: $cre" >&2; exit 1; }
# 2) publish
pub="$(curl -fsS -X POST "$API/$UID_/threads_publish" \
  --data-urlencode "creation_id=$CID" \
  --data-urlencode "access_token=$TOKEN")" || { echo "threads publish failed: $pub" >&2; exit 1; }
PID="$(echo "$pub" | jq -r .id)"
[[ -n "$PID" && "$PID" != "null" ]] || { echo "threads no post id: $pub" >&2; exit 1; }
U="$(secret '.threads.username')"
echo "url=https://www.threads.net/@${U:-me}/post/$PID"
echo "post_id=$PID"
