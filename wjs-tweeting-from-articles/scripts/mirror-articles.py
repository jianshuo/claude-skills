#!/usr/bin/env python3
"""Mirror the iCloud wechat-publish articles to a LOCAL dir so the (bash)
tweet picker never has to read iCloud from launchd.

Why: launchd-spawned bash doesn't get TCC Full Disk Access reliably (the
picker rests with "backlog empty"), but python3 DOES read iCloud fine from
launchd (proven by the multicam render job). So daily.sh runs THIS first to
copy each article's article.md (+ meta.json) into ~/.local/share, preserving
mtime (the picker sorts by mtime). Tiny text files, fast.
"""
import os, glob, shutil, sys

SRC = os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/"
                         "my/我的项目/我的创作/wechat-publish/articles")
DST = os.path.expanduser("~/.local/share/wjs-tweet-articles/articles")

os.makedirs(DST, exist_ok=True)
n = 0
for d in glob.glob(os.path.join(SRC, "[0-9]*-*/")):
    slug = os.path.basename(d.rstrip("/"))
    amd = os.path.join(d, "article.md")
    if not os.path.isfile(amd):
        continue
    outdir = os.path.join(DST, slug)
    os.makedirs(outdir, exist_ok=True)
    shutil.copy2(amd, os.path.join(outdir, "article.md"))   # copy2 preserves mtime
    meta = os.path.join(d, "meta.json")
    if os.path.isfile(meta):
        shutil.copy2(meta, os.path.join(outdir, "meta.json"))
    n += 1

print(f"[mirror] {n} articles → {DST}", file=sys.stderr)
