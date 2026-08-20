#!/usr/bin/env bash
# 输出下一本要发的书："slug<TAB>title"。没有可发的 → exit 1。
# 我的书 = author 是「王建硕」或空；跳过 history.jsonl 里已出现的 slug
# （posted / posted_partial 都算发过），跳过 chapters==0 的老书（没法读正文）。
# 顺序：createdAt 从新到旧。
# 退出码：0 = 选中一本；3 = 全发完了；其他 = 出错。
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 - "$HERE/state/history.jsonl" <<'PY'
import json, sys, urllib.request
UA = {"User-Agent": "Mozilla/5.0 wjs-publishing-books-to-x"}  # 裸 urllib UA 会被 CF 403
hist = set()
try:
    for line in open(sys.argv[1]):
        line = line.strip()
        if line:
            try:
                hist.add(json.loads(line).get("slug"))
            except Exception:
                pass
except FileNotFoundError:
    pass
req = urllib.request.Request("https://jianshuo.dev/voicedrop/books?format=json", headers=UA)
with urllib.request.urlopen(req, timeout=30) as r:
    d = json.load(r)
mine = [b for b in d["books"]
        if b.get("author") in ("王建硕", "")
        and b.get("chapters", 0) > 0
        and b["slug"] not in hist]
mine.sort(key=lambda b: -b.get("createdAt", 0))
if not mine:
    sys.exit(3)
print(f'{mine[0]["slug"]}\t{mine[0]["title"]}')
PY
