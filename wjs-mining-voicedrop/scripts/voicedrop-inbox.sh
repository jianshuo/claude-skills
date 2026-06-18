#!/usr/bin/env bash
# VoiceDrop inbox on jianshuo.dev/files (Cloudflare R2). The only new code in
# this skill — transcription and article-writing are reused skills.
#
# Subcommands:
#   list                      -> print unprocessed VoiceDrop-*.m4a names, one per line
#   download <name> <outdir>  -> download to <outdir>/<name>, print the local path
#   delete   <name>           -> remove from R2 (call ONLY after successful mining)
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

cmd_list() {
  load_token
  curl -fsS -H "Authorization: Bearer $FILES_TOKEN" "$BASE/list" \
    | PREFIX="$PREFIX" python3 -c '
import os, sys, json
prefix = os.environ["PREFIX"]
files = json.load(sys.stdin).get("files", [])
for f in sorted(files, key=lambda x: x["name"]):
    n = f["name"]
    # admin (master token) sees per-user keys "users/<sub>/VoiceDrop-*.m4a"
    # as well as legacy flat "VoiceDrop-*.m4a" — match on the basename, print
    # the full key so download/delete address the right object.
    base = n.rsplit("/", 1)[-1]
    if base.startswith(prefix) and base.endswith(".m4a"):
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

cmd_delete() {
  load_token
  local name="$1"
  curl -fsS -X DELETE -H "Authorization: Bearer $FILES_TOKEN" "$BASE/file/$name" >/dev/null
  echo "deleted from R2: $name"
}

case "${1:-}" in
  list)     cmd_list ;;
  download) shift; [ $# -eq 2 ] || { echo "usage: $0 download <name> <outdir>" >&2; exit 2; }; cmd_download "$@" ;;
  delete)   shift; [ $# -eq 1 ] || { echo "usage: $0 delete <name>" >&2; exit 2; }; cmd_delete "$@" ;;
  *) echo "usage: $0 {list | download <name> <outdir> | delete <name>}" >&2; exit 2 ;;
esac
