#!/usr/bin/env bash
# post-linkedin.sh <post.txt> [--dry-run]  exit: 0 ok / 3 no creds / other fail
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
TXT_FILE="${1:?usage: post-linkedin.sh <post.txt> [--dry-run]}"
DRY="${2:-}"
TEXT="$(cat "$TXT_FILE")"

TOKEN="$(secret '.linkedin.access_token')"
URN="$(secret '.linkedin.author_urn')"
[[ -n "$TOKEN" && -n "$URN" ]] || { echo "linkedin: no creds" >&2; exit 3; }

if [[ "$DRY" == "--dry-run" ]]; then echo "linkedin would post as $URN: $TEXT"; exit 0; fi

body="$(jq -nc --arg urn "$URN" --arg t "$TEXT" '{
  author:$urn, lifecycleState:"PUBLISHED",
  specificContent:{ "com.linkedin.ugc.ShareContent":{
    shareCommentary:{ text:$t }, shareMediaCategory:"NONE" } },
  visibility:{ "com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC" } }')"
resp="$(curl -fsS -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer $TOKEN" -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" -d "$body")" || { echo "linkedin post failed: $resp" >&2; exit 1; }
PID="$(echo "$resp" | jq -r .id)"
[[ -n "$PID" && "$PID" != "null" ]] || { echo "linkedin no post id: $resp" >&2; exit 1; }
echo "url=https://www.linkedin.com/feed/update/$PID"
echo "post_id=$PID"
