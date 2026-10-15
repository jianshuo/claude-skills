#!/usr/bin/env python3
"""Search Internet Archive for a (public-domain / openly licensed) feature film.

usage: ia_search.py "Title" [year]
prints JSON: candidates with identifier, licenseurl, and the video/subtitle files (name, size MB, format).
"""
import json, sys, urllib.parse, urllib.request

def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

title = sys.argv[1]
year = sys.argv[2] if len(sys.argv) > 2 else ""
q = f'title:("{title}") AND mediatype:movies'
if year:
    q += f" AND year:{year}"
params = urllib.parse.urlencode({
    "q": q, "rows": 8, "output": "json",
    "fl[]": ["identifier", "title", "year", "licenseurl", "downloads", "collection"],
    "sort[]": "downloads desc",
}, doseq=True)
docs = get(f"https://archive.org/advancedsearch.php?{params}")["response"]["docs"]

VIDEO = (".mp4", ".mkv", ".m4v", ".mpeg", ".avi", ".ogv")
SUBS = (".srt", ".vtt", ".ass")
out = []
for d in docs:
    meta = get(f"https://archive.org/metadata/{d['identifier']}")
    files = []
    for f in meta.get("files", []):
        n = f.get("name", "")
        if n.lower().endswith(VIDEO + SUBS):
            files.append({"name": n, "mb": round(int(f.get("size", 0)) / 1e6), "format": f.get("format"),
                          "url": f"https://archive.org/download/{d['identifier']}/{urllib.parse.quote(n)}"})
    out.append({**d, "page": f"https://archive.org/details/{d['identifier']}", "files": files})
print(json.dumps(out, ensure_ascii=False, indent=1))
