#!/usr/bin/env bash
# post-bluesky.sh <post.txt> [--dry-run]  exit: 0 ok / 3 no creds / other fail
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
TXT_FILE="${1:?usage: post-bluesky.sh <post.txt> [--dry-run]}"
DRY="${2:-}"
TEXT="$(cat "$TXT_FILE")"

HANDLE="$(secret '.bluesky.handle')"
APPPW="$(secret '.bluesky.app_password')"
[[ -n "$HANDLE" && -n "$APPPW" ]] || { echo "bluesky: no creds" >&2; exit 3; }

if [[ "$DRY" == "--dry-run" ]]; then echo "bluesky would post: $TEXT"; exit 0; fi

PDS="https://bsky.social"
sess="$(curl -fsS -X POST "$PDS/xrpc/com.atproto.server.createSession" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg id "$HANDLE" --arg pw "$APPPW" '{identifier:$id,password:$pw}')")" \
  || { echo "bluesky session failed" >&2; exit 1; }
JWT="$(echo "$sess" | jq -r .accessJwt)"; DID="$(echo "$sess" | jq -r .did)"
[[ -n "$JWT" && "$JWT" != "null" ]] || { echo "bluesky auth failed: $sess" >&2; exit 1; }

NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
rec="$(jq -nc --arg t "$TEXT" --arg now "$NOW" --arg did "$DID" \
  '{repo:$did,collection:"app.bsky.feed.post",record:{ "$type":"app.bsky.feed.post", text:$t, createdAt:$now }}')"
resp="$(curl -fsS -X POST "$PDS/xrpc/com.atproto.repo.createRecord" \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' -d "$rec")" \
  || { echo "bluesky post failed: $resp" >&2; exit 1; }
uri="$(echo "$resp" | jq -r .uri)"
rkey="${uri##*/}"
echo "url=https://bsky.app/profile/$HANDLE/post/$rkey"
echo "post_id=$rkey"
