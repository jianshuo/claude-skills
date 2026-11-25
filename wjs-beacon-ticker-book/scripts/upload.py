#!/usr/bin/env python3
"""把渲染好的一本书发布到 beacon.jianshuo.dev（代理把文件存进云端存储，app 和网页从那里读）。

    scripts/upload.py NVDA             上传 <根>/out/books/NVDA/ 下的网页，和 <根>/books/NVDA/ 下的源稿
    scripts/upload.py NVDA --pages     只上传网页（每过审一章就发一次时用，快）

源稿（book.json、正文、笔记、评审意见、事实档案）存在 _src/ 下：服务器的盘坏了也能把一本书原样取回来续写。

环境变量：
    BEACON_ADMIN_KEY   上传口令（服务器上由调度服务注入；本机可放 ~/.beacon-signing/admin-key）
    BEACON_BASE        缺省 https://beacon.jianshuo.dev
    BEACON_BOOK_ROOT   工作根目录，缺省当前目录
"""
import mimetypes, os, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()
BASE = os.environ.get("BEACON_BASE", "https://beacon.jianshuo.dev").rstrip("/")


def admin_key():
    if os.environ.get("BEACON_ADMIN_KEY"):
        return os.environ["BEACON_ADMIN_KEY"].strip()
    f = Path.home() / ".beacon-signing" / "admin-key"
    if f.exists():
        return f.read_text().strip()
    sys.exit("缺少 BEACON_ADMIN_KEY，没法上传")


def put(key, path, name):
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if name.endswith((".html", ".json", ".txt", ".js")):
        ctype += "; charset=utf-8"
    req = urllib.request.Request(f"{BASE}/api/book-admin/files/{name}", data=path.read_bytes(), method="PUT",
                                 headers={"Authorization": "Bearer " + key, "Content-Type": ctype,
                                          "User-Agent": "beacon-book-upload"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f"上传失败 {name}: {e.code} {e.read().decode()[:200]}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ticker = args[0].upper()
    pages_only = "--pages" in sys.argv
    key = admin_key()

    out = ROOT / "out" / "books" / ticker
    if not (out / "index.html").exists():
        sys.exit(f"{out} 里没有渲染结果，先跑 build.py {ticker}")
    # 连子目录一起传（日报在 d/ 下）
    files = [(f, f"{ticker}/{f.relative_to(out).as_posix()}") for f in sorted(out.rglob("*")) if f.is_file()]

    if not pages_only:
        src = ROOT / "books" / ticker
        for f in sorted(src.rglob("*")):
            # 年报、季报的全文原件体积大、随时能重新抓，不存
            if f.is_file() and not f.name.endswith("-full.txt") and not f.name.startswith("."):
                files.append((f, f"{ticker}/_src/{f.relative_to(src).as_posix()}"))

    for path, name in files:
        put(key, path, name)
    print(f"{ticker}: 已上传 {len(files)} 个文件到 {BASE}/books/{ticker}/")


if __name__ == "__main__":
    main()
