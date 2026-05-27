#!/usr/bin/env python3
"""Mirror the iCloud wechat-publish articles to a LOCAL dir so the (bash)
tweet picker never has to read iCloud from launchd.

Why: launchd-spawned bash doesn't get TCC Full Disk Access reliably (the
picker rests with "backlog empty"), but python3 DOES read iCloud fine from
launchd (proven by the multicam render job). So daily.sh runs THIS first to
copy each article's article.md (+ meta.json) into ~/.local/share, preserving
mtime (the picker sorts by mtime). Tiny text files, fast.
"""
import os, glob, sys

SRC = os.path.expanduser("~/code/wechat-publish/articles")
DST = os.path.expanduser("~/.local/share/wjs-tweet-articles/articles")


def safe_copy(src, dst):
    """Buffered read→write copy that preserves mtime.

    Deliberately avoids shutil.copy2/copyfile: on macOS APFS those call
    _fastcopy_fcopyfile (a clone syscall) which deadlocks (EDEADLK / errno 11,
    "Resource deadlock avoided") against the iCloud daemon for synced files.
    Plain open/read/write never touches fcopyfile, so it's iCloud-safe.
    """
    with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
        while True:
            buf = fsrc.read(1 << 20)
            if not buf:
                break
            fdst.write(buf)
    st = os.stat(src)
    os.utime(dst, (st.st_atime, st.st_mtime))   # preserve mtime (picker sorts by it)


os.makedirs(DST, exist_ok=True)
n = 0
fail = 0
for d in glob.glob(os.path.join(SRC, "[0-9]*-*/")):
    slug = os.path.basename(d.rstrip("/"))
    amd = os.path.join(d, "article.md")
    if not os.path.isfile(amd):
        continue
    outdir = os.path.join(DST, slug)
    os.makedirs(outdir, exist_ok=True)
    try:
        safe_copy(amd, os.path.join(outdir, "article.md"))
        meta = os.path.join(d, "meta.json")
        if os.path.isfile(meta):
            safe_copy(meta, os.path.join(outdir, "meta.json"))
        n += 1
    except OSError as e:
        fail += 1
        print(f"[mirror] WARN skip {slug}: {e}", file=sys.stderr)

print(f"[mirror] {n} articles → {DST}" + (f" ({fail} skipped)" if fail else ""),
      file=sys.stderr)
