#!/usr/bin/env bash
# VoiceDrop inbox on jianshuo.dev/files (Cloudflare R2). The only new code in
# this skill — transcription and article-writing are reused skills.
#
# Subcommands:
#   list                       -> print UNPROCESSED VoiceDrop-*.m4a keys, one per line
#                                 (a recording is processed once an
#                                  articles/<stem>.json OR articles/<stem>.empty
#                                  marker exists — see below)
#   download   <key> <outdir>  -> download to <outdir>/<basename>, print the local path
#   mark-done  <key> <jsonfile>-> PUT a v2 article JSON to articles/<stem>.json
#                                 (marks the recording processed + surfaces it in the app)
#   mark-empty <key> <reason>  -> PUT an articles/<stem>.empty marker
#                                 (reason ∈ corrupt|silent|no-speech) — processed,
#                                  no usable speech; shows as 无语音 in the app
#   delete     <key>           -> remove a key from R2 (manual cleanup only;
#                                 the mining flow NEVER deletes — it marks instead)
#
# Processing state is represented entirely by sidecar files, never by deletion:
# the audio always stays in R2 until the user deletes it themselves (in the app).
#
# Token: read from $FILES_TOKEN, else from ~/code/.env (FILES_TOKEN=...).
# The base URL is public; the token is NEVER hardcoded (this skill is public).
set -euo pipefail

BASE="https://jianshuo.dev/files/api"
PREFIX="VoiceDrop-"

load_token() {
  # Prefer the env var if already exported; else read ~/code/.env.
  # Accept either JIANSHUO_DEV_FILES_TOKEN (namespaced) or FILES_TOKEN.
  : "${FILES_TOKEN:=${JIANSHUO_DEV_FILES_TOKEN:-}}"
  if [ -z "${FILES_TOKEN:-}" ] && [ -f "$HOME/code/.env" ]; then
    FILES_TOKEN=$(grep -hE '^(export +)?(JIANSHUO_DEV_FILES_TOKEN|FILES_TOKEN)=' "$HOME/code/.env" \
      | head -1 | cut -d= -f2- | tr -d '"'"'"' \r\n')
  fi
  if [ -z "${FILES_TOKEN:-}" ]; then
    echo "FILES_TOKEN not set (export JIANSHUO_DEV_FILES_TOKEN/FILES_TOKEN or add to ~/code/.env)" >&2
    exit 1
  fi
}

# <prefix>articles/<stem>.<ext> for an audio key. Echoes the marker key.
# e.g. users/anon-x/VoiceDrop-Y.m4a  json -> users/anon-x/articles/VoiceDrop-Y.json
marker_key() {
  local key="$1" ext="$2"
  local base="${key##*/}"; local stem="${base%.m4a}"
  local dir="${key%/*}"; local kp=""
  [ "$dir" != "$key" ] && kp="$dir/"
  echo "${kp}articles/${stem}.${ext}"
}

cmd_list() {
  load_token
  # Print only VoiceDrop-*.m4a that have NO articles/<stem>.json and NO
  # articles/<stem>.empty marker yet — i.e. genuinely unprocessed.
  curl -fsS -H "Authorization: Bearer $FILES_TOKEN" "$BASE/list" \
    | PREFIX="$PREFIX" python3 -c '
import os, sys, json
prefix = os.environ["PREFIX"]
files = json.load(sys.stdin).get("files", [])
names = {f["name"] for f in files}

def marker(key, ext):
    parts = key.rsplit("/", 1)
    stem = parts[-1][:-4]                      # strip .m4a
    kp = parts[0] + "/" if len(parts) == 2 else ""
    return f"{kp}articles/{stem}.{ext}"

for f in sorted(files, key=lambda x: x["name"]):
    n = f["name"]
    base = n.rsplit("/", 1)[-1]
    if not (base.startswith(prefix) and base.endswith(".m4a")):
        continue
    if marker(n, "json") in names or marker(n, "empty") in names:
        continue                               # already processed — skip
    print(n)'
}

cmd_download() {
  load_token
  local name="$1" outdir="$2"
  mkdir -p "$outdir"
  # <name> may be a per-user key with slashes ("users/<sub>/VoiceDrop-x.m4a");
  # the URL keeps the full key, but the local file is just the basename.
  local base="${name##*/}"
  curl -fsS -H "Authorization: Bearer $FILES_TOKEN" \
    "$BASE/download/$name" -o "$outdir/$base"
  echo "$outdir/$base"
}

cmd_mark_done() {
  load_token
  local key="$1" jsonfile="$2"
  local art; art=$(marker_key "$key" json)
  curl -fsS -X PUT -H "Authorization: Bearer $FILES_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary @"$jsonfile" "$BASE/upload/$art" >/dev/null
  echo "marked done: $art"
}

cmd_mark_empty() {
  load_token
  local key="$1" reason="$2"
  local base="${key##*/}"
  local emp; emp=$(marker_key "$key" empty)
  local body="{\"schema\":2,\"status\":\"empty\",\"reason\":\"$reason\",\"sourceAudio\":\"$base\"}"
  curl -fsS -X PUT -H "Authorization: Bearer $FILES_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$body" "$BASE/upload/$emp" >/dev/null
  echo "marked empty ($reason): $emp"
}

cmd_delete() {
  load_token
  local name="$1"
  curl -fsS -X DELETE -H "Authorization: Bearer $FILES_TOKEN" "$BASE/file/$name" >/dev/null
  echo "deleted from R2: $name"
}

case "${1:-}" in
  list)       cmd_list ;;
  download)   shift; [ $# -eq 2 ] || { echo "usage: $0 download <key> <outdir>" >&2; exit 2; }; cmd_download "$@" ;;
  mark-done)  shift; [ $# -eq 2 ] || { echo "usage: $0 mark-done <key> <jsonfile>" >&2; exit 2; }; cmd_mark_done "$@" ;;
  mark-empty) shift; [ $# -eq 2 ] || { echo "usage: $0 mark-empty <key> <reason>" >&2; exit 2; }; cmd_mark_empty "$@" ;;
  delete)     shift; [ $# -eq 1 ] || { echo "usage: $0 delete <key>" >&2; exit 2; }; cmd_delete "$@" ;;
  *) echo "usage: $0 {list | download <key> <outdir> | mark-done <key> <jsonfile> | mark-empty <key> <reason> | delete <key>}" >&2; exit 2 ;;
esac
