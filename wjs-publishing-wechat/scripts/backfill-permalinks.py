#!/usr/bin/env python3
"""backfill-permalinks.py — refresh the local permalink ledger.

The "最近文章" list (build-recent-articles.py) is built offline from each
article's publish.json `permalink`. This script is what fills that field in:
it calls the WeChat MP web backend `appmsgpublish` list endpoint (the published
-articles list), paginates the whole account, and writes `permalink` +
`published_at` into every matching articles/*/publish.json by EXACT title match.

Exact-title match only — on purpose. The published headline often differs from
meta.json's title; fuzzy matching would write wrong links. Titles that don't
match are reported and left untouched (resolve by hand if needed).

Auth (web session — NOT the publish API access_token). The endpoint needs the
logged-in mp.weixin.qq.com cookie + the per-login `token` + the account `fakeid`.
These expire in hours, so this is an occasional maintenance run, not part of
publishing. Provide them one of two ways:

  A) Env vars:
       WECHAT_MP_COOKIE='<full Cookie header>'
       WECHAT_MP_TOKEN='<token= digits from any mp.weixin.qq.com backend URL>'
       WECHAT_MP_FAKEID='<fakeid= of the account>'
  B) A session file (default ~/.config/wjs-wechat/mp-session.env) that exports
     the same three vars. Pass a different path with --session <file>.

How to grab them (once, when they expire): open mp.weixin.qq.com logged in →
DevTools → Network → trigger the 已发布 list (内容管理 → 已发布) → find the
`appmsgpublish` request → Copy as cURL. token & fakeid are in the URL; the
Cookie is the -H 'Cookie: ...' value.

Usage:
  backfill-permalinks.py [<articles-root>] [--session <file>] [--dry-run]

  <articles-root> : folder containing the YYYY-MM-DD-slug/ article dirs.
                    Default: ~/code/wechat-publish/articles (falls back to CWD).
"""
import os
import re
import sys
import json
import glob
import time
import datetime
import urllib.request
import urllib.parse

DEFAULT_ROOT = os.path.expanduser("~/code/wechat-publish/articles")
DEFAULT_SESSION = os.path.expanduser("~/.config/wjs-wechat/mp-session.env")


def load_session(path):
    """Read KEY=VALUE / export KEY=VALUE lines into os.environ if not already set."""
    if not path or not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        line = re.sub(r"^export\s+", "", line)
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


def fetch_page(token, fakeid, cookie, begin):
    params = {
        "sub": "list", "search_field": "null", "begin": str(begin), "count": "20",
        "query": "", "fakeid": fakeid, "type": "101_1", "free_publish_type": "1",
        "sub_action": "list_ex", "token": token, "lang": "zh_CN", "f": "json", "ajax": "1",
    }
    url = "https://mp.weixin.qq.com/cgi-bin/appmsgpublish?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        "Referer": "https://mp.weixin.qq.com/",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "*/*",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def build_maps(token, fakeid, cookie):
    """Return (title_map, digest_map), each key -> (permalink, published_at_iso).

    Two independent indexes so we can match by exact published title first, then
    fall back to exact author-written summary (the `digest`), which survives a
    title rewrite. Newest entry wins on duplicate keys.
    """
    tmap, dmap = {}, {}
    begin = 0
    while True:
        data = fetch_page(token, fakeid, cookie, begin)
        if data.get("base_resp", {}).get("ret") not in (0, None):
            raise RuntimeError(f"base_resp={data.get('base_resp')} (cookie/token expired?)")
        pp = data.get("publish_page")
        if not pp:
            break
        pp = json.loads(pp)
        plist = pp.get("publish_list", [])
        for it in plist:
            info = it.get("publish_info")
            if not info:
                continue
            info = json.loads(info)
            ts = (info.get("sent_info") or {}).get("time")
            iso = (datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")
                   if ts else "")
            for a in info.get("appmsgex", []):
                link = a.get("link")
                if not link:
                    continue
                t = (a.get("title") or "").strip()
                if t and t not in tmap:
                    tmap[t] = (link, iso)
                dg = (a.get("digest") or "").strip()
                if dg and dg not in dmap:
                    dmap[dg] = (link, iso)
        total = pp.get("total_count", 0)
        begin += 20
        if not plist or begin >= total:
            break
        time.sleep(0.6)
    return tmap, dmap


def norm(s):
    return "".join((s or "").split())


def main():
    args = sys.argv[1:]
    root = None
    session = DEFAULT_SESSION
    dry = False
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--session":
            session = args[i + 1]; i += 2
        elif a == "--dry-run":
            dry = True; i += 1
        elif not a.startswith("-"):
            root = a; i += 1
        else:
            i += 1

    load_session(session)
    token = os.environ.get("WECHAT_MP_TOKEN", "").strip()
    fakeid = os.environ.get("WECHAT_MP_FAKEID", "").strip()
    cookie = os.environ.get("WECHAT_MP_COOKIE", "").strip()
    if not (token and fakeid and cookie):
        sys.stderr.write(
            "error: need WECHAT_MP_TOKEN + WECHAT_MP_FAKEID + WECHAT_MP_COOKIE "
            f"(env or session file {session}). See header for how to grab them.\n")
        sys.exit(2)

    if not root:
        root = DEFAULT_ROOT if os.path.isdir(DEFAULT_ROOT) else os.getcwd()
    root = os.path.abspath(root)

    sys.stderr.write("→ fetching published list from appmsgpublish ...\n")
    tmap, dmap = build_maps(token, fakeid, cookie)
    nmap = {norm(t): v for t, v in tmap.items()}
    ndmap = {norm(d): v for d, v in dmap.items()}
    ntitles = list(nmap.items())  # [(norm_title, (link, iso))]
    sys.stderr.write(f"  {len(tmap)} published titles fetched\n")

    def prefix_match(meta_title):
        """High-precision: published title is meta title + a subtitle (or vice
        versa). Guarded by length so short titles can't collide. Returns
        (link, iso) or None; ambiguous (>1 candidate) returns None."""
        mt = norm(meta_title)
        if len(mt) < 8:
            return None
        hits = [v for nt, v in ntitles
                if nt != mt and (nt.startswith(mt) or mt.startswith(nt))
                and min(len(nt), len(mt)) >= 8 and abs(len(nt) - len(mt)) <= 40]
        return hits[0] if len(hits) == 1 else None

    wrote, by_digest, by_prefix, unmatched = 0, 0, 0, []
    for mf in sorted(glob.glob(os.path.join(root, "*", "meta.json"))):
        folder = os.path.dirname(mf)
        meta = json.load(open(mf, encoding="utf-8"))
        cands = [meta.get("title", "")] + (meta.get("title_alternatives") or [])
        hit = None
        for c in cands:
            c = (c or "").strip()
            if c in tmap:
                hit = tmap[c]; break
            if norm(c) in nmap:
                hit = nmap[norm(c)]; break
        if not hit:
            # Fallback: exact author-written summary == published digest. The
            # summary is stable across a title rewrite, so this is high-confidence.
            summ = (meta.get("summary") or "").strip()
            if summ and summ in dmap:
                hit = dmap[summ]; by_digest += 1
            elif summ and norm(summ) in ndmap:
                hit = ndmap[norm(summ)]; by_digest += 1
        if not hit:
            # Last tier: published title extends the meta title with a subtitle.
            pm = prefix_match(meta.get("title", ""))
            if pm:
                hit = pm; by_prefix += 1
        if not hit:
            unmatched.append((os.path.basename(folder), meta.get("title", "")))
            continue
        link, iso = hit
        pj = os.path.join(folder, "publish.json")
        pub = {}
        if os.path.exists(pj):
            try:
                pub = json.load(open(pj, encoding="utf-8"))
            except Exception:
                pub = {}
        if pub.get("permalink") == link and (not iso or pub.get("published_at") == iso):
            continue  # already current
        pub["permalink"] = link
        if iso:
            pub["published_at"] = iso
        pub.setdefault("title", meta.get("title"))
        pub.setdefault("slug", meta.get("slug"))
        if not dry:
            json.dump(pub, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        wrote += 1

    sys.stderr.write(f"{'[dry-run] would write' if dry else '✓ wrote'} permalink to {wrote} publish.json "
                     f"({by_digest} via summary→digest, {by_prefix} via title-prefix)\n")
    if unmatched:
        sys.stderr.write(f"  {len(unmatched)} unmatched (unpublished, or both title & summary differ):\n")
        for slug, t in unmatched:
            sys.stderr.write(f"    - {slug} :: {t}\n")


if __name__ == "__main__":
    main()
