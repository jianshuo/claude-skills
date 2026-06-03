#!/usr/bin/env bash
# open-draft-edit.sh <article-folder> ["title"]
#
# Open the WeChat MP draft EDIT page for a just-created/updated draft directly,
# instead of just the mp.weixin.qq.com home page.
#
# How it works (no cookie decryption, no stored secrets):
#   1. Read the web-console session `token` from an already-open, logged-in
#      mp.weixin.qq.com tab (Safari preferred, then Chrome).
#   2. Ask that same logged-in browser to fetch the draft list JSON endpoint
#      (cgi-bin/appmsg?action=list_ex&type=77&f=json) and match our draft by
#      exact title → its internal numeric `appmsgid`.
#   3. Navigate that tab to the appmsg_edit URL built from token + appmsgid.
#
# Why a browser and not curl: the edit page needs the web `token` (a per-login
# session token, unrelated to the publish API's access_token) AND the internal
# `appmsgid` (NOT returned by the draft API). Both live only in the logged-in
# web session. Reading Safari's `source of tab` needs no special settings.
#
# Any failure (not logged in, title not found, wrong browser) falls back to
# opening the home page and exits 0 — it must never block publishing.

set -uo pipefail

FOLDER="${1:-.}"
TITLE="${2:-}"
if [ -z "$TITLE" ] && [ -f "$FOLDER/meta.json" ]; then
  TITLE=$(python3 -c "import json,sys; print(json.load(open('$FOLDER/meta.json')).get('title',''))" 2>/dev/null || true)
fi

fallback() {
  echo "  (open-draft-edit: $1 → opening home page)" >&2
  open "https://mp.weixin.qq.com/" >/dev/null 2>&1 || true
  exit 0
}

[ -z "${TITLE:-}" ] && fallback "no title"

# --- 1. token + which browser holds the logged-in session -------------------
# AppleScript only returns "<Browser>\t<full-url>"; token is parsed in bash to
# keep apostrophes out of this $()-wrapped heredoc (macOS bash 3.2 mis-parses
# a "'" inside command substitution).
detect_tab() {
  osascript <<'OSA' 2>/dev/null
try
  tell application "Safari"
    repeat with w in windows
      repeat with t in tabs of w
        set u to URL of t
        if u contains "mp.weixin.qq.com" and u contains "token=" then
          return "Safari	" & u
        end if
      end repeat
    end repeat
  end tell
end try
try
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        set u to URL of t
        if u contains "mp.weixin.qq.com" and u contains "token=" then
          return "Chrome	" & u
        end if
      end repeat
    end repeat
  end tell
end try
return ""
OSA
}

# Apple Events can transiently return empty right after a heavy upload; retry.
DETECT=""
for _ in 1 2 3; do
  DETECT=$(detect_tab)
  [ -n "$DETECT" ] && break
  sleep 0.6
done

BROWSER=$(printf '%s' "$DETECT" | cut -f1)
DETECT_URL=$(printf '%s' "$DETECT" | cut -f2-)
# token=<digits> from the url
TOKEN=$(printf '%s' "$DETECT_URL" | sed -n 's/.*[?&]token=\([0-9][0-9]*\).*/\1/p')
[ -z "${TOKEN:-}" ] && fallback "no logged-in mp tab"

LIST_URL="https://mp.weixin.qq.com/cgi-bin/appmsg?begin=0&count=20&type=77&action=list_ex&token=${TOKEN}&lang=zh_CN&f=json"

# --- 2. fetch the draft list in the logged-in session, read its source ------
# Safari: `source of tab` returns the raw JSON with no special settings.
# Chrome: cannot read tab source without "Allow JavaScript from Apple Events";
# fall back to opening the draft list page (one click from the draft).
if [ "$BROWSER" != "Safari" ]; then
  echo "  (open-draft-edit: session in $BROWSER, opening draft list)" >&2
  open "https://mp.weixin.qq.com/cgi-bin/appmsgpublish?sub=list&type=77&token=${TOKEN}&lang=zh_CN" >/dev/null 2>&1 || true
  exit 0
fi

SRC=$(osascript <<OSA 2>/dev/null
tell application "Safari"
  set listTab to make new tab at end of tabs of window 1 with properties {URL:"${LIST_URL}"}
  set tries to 0
  repeat until (source of listTab is not "") or tries > 40
    delay 0.25
    set tries to tries + 1
  end repeat
  return source of listTab
end tell
OSA
)

# --- 3. match draft by exact title → appmsgid -------------------------------
APPMSGID=$(SRC="$SRC" TITLE="$TITLE" python3 <<'PY'
import json, os, re
src = os.environ.get("SRC", "")
m = re.search(r"\{.*\}", src, re.S)
if m:
    try:
        data = json.loads(m.group(0))
        want = os.environ["TITLE"].strip()
        for it in data.get("app_msg_list", []):
            if it.get("title", "").strip() == want:
                print(it.get("appmsgid", ""))
                break
    except Exception:
        pass
PY
)

if [ -z "${APPMSGID:-}" ]; then
  # close the list tab we opened, then fall back
  osascript >/dev/null 2>&1 <<'OSA' || true
tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t) contains "action=list_ex" then close t
    end repeat
  end repeat
end tell
OSA
  fallback "title not found in draft list"
fi

EDIT_URL="https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${APPMSGID}&isMul=1&replaceScene=0&isSend=0&isFreePublish=0&token=${TOKEN}&lang=zh_CN"

# --- 4. navigate the list tab to the edit page (reuse it, no leftover) ------
osascript >/dev/null 2>&1 <<OSA || true
tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t) contains "action=list_ex" then
        set URL of t to "${EDIT_URL}"
        set current tab of w to t
        activate
      end if
    end repeat
  end repeat
end tell
OSA

echo "  (opened draft edit page directly: appmsgid ${APPMSGID})" >&2
