#!/usr/bin/env python3
"""fetch-book.py <slug> <outfile> — 把一本书的素材抓成一个纯文本文件，给 claude -p 起草 thread 用。

素材 = _src/book.json（书名/副题/简介/目录+每章梗概）+ 序章 + 前两章正文（各截 4000 字）。
公开内容，免登录。"""
import json
import re
import sys
import urllib.request
from html import unescape

BASE = "https://jianshuo.dev/voicedrop/books"


def get(path):
    try:
        with urllib.request.urlopen(f"{BASE}/{path}", timeout=30) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return ""


def text(html):
    html = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", "", html)
    html = re.sub(r'<div id="abw"[\s\S]*?</div>', "", html)  # 「听本章」播放器
    html = re.sub(r"</(p|div|h[1-6]|li|blockquote)>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\n{3,}", "\n\n", unescape(html)).strip()


slug, out = sys.argv[1], sys.argv[2]
parts, nums = [], []
src = get(f"{slug}/_src/book.json")
if src:
    try:
        j = json.loads(src)
        parts.append(f"书名: {j.get('title', '')}\n副题: {j.get('subtitle', '')}\n简介: {j.get('tagline', '')}")
        toc = [f"{i:02d}. {c.get('title', '')} — {c.get('brief') or c.get('synopsis') or ''}"
               for i, c in enumerate(j.get("chapters", []), 1)]
        parts.append("目录与梗概:\n" + "\n".join(toc))
        nums = [f"{i:02d}" for i in range(1, len(j.get("chapters", [])) + 1)]
    except Exception:
        pass
intro = text(get(f"{slug}/intro.html"))
if intro:
    parts.append("=== 序章 ===\n" + intro[:4000])
for n in nums[:2]:
    t = text(get(f"{slug}/{n}.html"))
    if t:
        parts.append(f"=== 第{n}章正文 ===\n" + t[:4000])
if not parts:
    sys.exit(f"FATAL: no material for {slug}")
open(out, "w").write("\n\n".join(parts))
print(f"{out}: {sum(len(p) for p in parts)} chars, {len(parts)} sections")
