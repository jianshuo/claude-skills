#!/usr/bin/env python3
"""Fetch subtitles from OpenSubtitles REST API (needs OPENSUBTITLES_API_KEY; downloads also need
OPENSUBTITLES_USERNAME / OPENSUBTITLES_PASSWORD — free account gives ~20 downloads/day).

usage: opensubs.py <video-file> <imdb_id|"Title"> <lang: en|zh-cn|zh-tw> <out.srt>
Tries moviehash match first (exact sync for this cut), then imdb/title query; picks most downloaded.
exit 2 = nothing found / no key  (caller falls back to Whisper + translation)
"""
import json, os, struct, sys, urllib.parse, urllib.request

API = "https://api.opensubtitles.com/api/v1"
KEY = os.environ.get("OPENSUBTITLES_API_KEY")
if not KEY:
    print("no OPENSUBTITLES_API_KEY", file=sys.stderr); sys.exit(2)

def req(path, data=None, token=None):
    h = {"Api-Key": KEY, "User-Agent": "wjs-fetching-movie v1", "Content-Type": "application/json", "Accept": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(API + path, data=json.dumps(data).encode() if data else None, headers=h)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.load(resp)

def moviehash(path):
    size = os.path.getsize(path); h = size; chunk = 65536
    with open(path, "rb") as f:
        for off in (0, max(0, size - chunk)):
            f.seek(off); buf = f.read(chunk)
            for (v,) in struct.iter_unpack("<q", buf[: len(buf) // 8 * 8]):
                h = (h + v) & 0xFFFFFFFFFFFFFFFF
    return f"{h:016x}"

video, ident, lang, out = sys.argv[1:5]
queries = []
if os.path.exists(video):
    queries.append({"moviehash": moviehash(video), "languages": lang})
key = "imdb_id" if ident.lower().lstrip("t").isdigit() or ident.startswith("tt") else "query"
queries.append({key: ident.lstrip("t") if key == "imdb_id" else ident, "languages": lang, "type": "movie"})

best = None
for q in queries:
    data = req("/subtitles?" + urllib.parse.urlencode(sorted(q.items())))["data"]
    data = [d for d in data if d["attributes"].get("files")]
    if q.get("moviehash"):
        data = [d for d in data if d["attributes"].get("moviehash_match")]
    if data:
        best = max(data, key=lambda d: d["attributes"].get("download_count", 0)); break
if not best:
    print(f"no {lang} subtitles found", file=sys.stderr); sys.exit(2)

token = None
if os.environ.get("OPENSUBTITLES_USERNAME"):
    token = req("/login", {"username": os.environ["OPENSUBTITLES_USERNAME"], "password": os.environ["OPENSUBTITLES_PASSWORD"]})["token"]
link = req("/download", {"file_id": best["attributes"]["files"][0]["file_id"], "sub_format": "srt"}, token)["link"]
urllib.request.urlretrieve(link, out)
a = best["attributes"]
print(json.dumps({"out": out, "release": a.get("release"), "hash_match": a.get("moviehash_match", False),
                  "downloads": a.get("download_count")}, ensure_ascii=False))
