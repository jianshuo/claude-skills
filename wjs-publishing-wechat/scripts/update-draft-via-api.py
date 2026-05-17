#!/usr/bin/env python3
"""Update an existing WeChat draft in place via the official draft/update API.

Why this exists: md2wechat exposes `create_draft` but not `update_draft` —
even though the underlying library knows the URL. Re-running upload-draft.sh
without this would create a brand-new draft each time, polluting the draft box.
This script reuses the same media_id so WeChat treats it as a new version of
the same draft (built-in version control in the backend).

Network note: api.weixin.qq.com whitelists by IP. On this machine the only
whitelisted egress is via the user's HTTP/HTTPS proxy. httpx picks up
HTTPS_PROXY / HTTP_PROXY env vars automatically; do not strip them.

Usage:
  update-draft-via-api.py --draft draft.json --media-id <id>
Exit codes:
  0 = updated in place (existing media_id reused)
  3 = update rejected (e.g. media_id no longer exists) → caller should fall
      back to create_draft
  1 = other error (auth, network, malformed input)
"""
import argparse, json, os, sys
import urllib.request, urllib.error
import urllib.parse

API_TOKEN = "https://api.weixin.qq.com/cgi-bin/token"
API_UPDATE = "https://api.weixin.qq.com/cgi-bin/draft/update"

# Errcodes that mean "this draft is gone, please create a fresh one".
GONE_ERRCODES = {
    40007,  # invalid media_id (stale; was deleted/replaced)
    46003,  # media data invalid
    47001,  # data format error
}

def http_post_json(url: str, body: dict, timeout: float = 30.0) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    # urllib honors http_proxy / https_proxy env vars via ProxyHandler default.
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def http_get_json(url: str, params: dict, timeout: float = 30.0) -> dict:
    q = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{q}", timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def get_access_token() -> str:
    appid = os.environ.get("WECHAT_APPID")
    secret = os.environ.get("WECHAT_SECRET")
    if not appid or not secret:
        sys.exit("WECHAT_APPID / WECHAT_SECRET must be set in env")
    r = http_get_json(API_TOKEN, {
        "grant_type": "client_credential",
        "appid": appid,
        "secret": secret,
    })
    if "access_token" not in r:
        # 40164 = IP not whitelisted; common cause: proxy was stripped.
        sys.exit(f"access_token fetch failed: {r}")
    return r["access_token"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", required=True, help="path to draft.json (md2wechat format: {articles:[{...}]})")
    ap.add_argument("--media-id", required=True, help="existing draft media_id to update in place")
    args = ap.parse_args()

    draft = json.load(open(args.draft))
    articles = draft.get("articles") or []
    if not articles:
        sys.exit("draft.json has no articles[]")
    if len(articles) > 1:
        sys.exit("draft has multiple articles — update API takes one at a time; not supported here")

    token = get_access_token()
    body = {
        "media_id": args.media_id,
        "index": 0,
        "articles": articles[0],
    }
    url = f"{API_UPDATE}?access_token={token}"
    resp = http_post_json(url, body)
    errcode = resp.get("errcode", 0)
    if errcode == 0:
        print(json.dumps({"ok": True, "media_id": args.media_id}, ensure_ascii=False))
        return 0
    if errcode in GONE_ERRCODES:
        sys.stderr.write(f"draft no longer exists (errcode={errcode} {resp.get('errmsg')}); caller should create new\n")
        return 3
    # Other errors (e.g. 45004 description too long): bubble up
    sys.stderr.write(f"draft/update failed: {resp}\n")
    return 1

if __name__ == "__main__":
    sys.exit(main())
