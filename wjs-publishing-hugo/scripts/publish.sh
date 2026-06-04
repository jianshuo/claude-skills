#!/usr/bin/env bash
# Commit the working changes and push to main → the site's deploy workflow
# (deploy.yml `on: push`) builds and ships it. A normal user push DOES trigger
# that workflow (only the feedback bot's GITHUB_TOKEN push is blocked by GitHub).
#
# Usage: publish.sh "commit message" [repo-root]
set -euo pipefail
MSG="${1:?usage: publish.sh \"commit message\" [repo-root]}"
REPO="${2:-.}"
cd "$REPO"

if [ -z "$(git status --porcelain)" ]; then
  echo "nothing to publish — working tree clean"
  exit 0
fi

git add -A
git status --short
git commit -m "$MSG"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push origin "HEAD:${BRANCH}"
echo "pushed to ${BRANCH}; deploy workflow will build and ship it."
echo "watch: gh run watch \"\$(gh run list --workflow=deploy.yml -L1 --json databaseId --jq '.[0].databaseId')\""
