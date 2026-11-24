#!/usr/bin/env python3
"""把评审和它评的那一版稿子绑在一起：在 reviews/NN.json 里记下正文和笔记的指纹。

    scripts/stamp_review.py NVDA 03        评审写完 reviews/03.json 之后立刻跑
    scripts/stamp_review.py NVDA --check   列出哪些章在评审之后又被改过

稿子在评审之后哪怕只改一个字，指纹就对不上，build.py 会把这一章当成「改过未复核」，不发布。
所以流程是：写 → 评 → （照意见改）→ 再评改过的地方 → 盖章。最后一步永远是评审，不是修改。
"""
import hashlib, json, os, sys
from pathlib import Path

ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()


def fingerprint(book_dir: Path, no: int) -> str:
    h = hashlib.sha256()
    for rel in (f"chapters/{no:02d}.html", f"notes/{no:02d}.json"):
        p = book_dir / rel
        h.update(p.read_bytes() if p.exists() else b"")
        h.update(b"\0")
    return h.hexdigest()[:16]


def main():
    ticker = sys.argv[1].upper()
    d = ROOT / "books" / ticker
    if sys.argv[2] == "--check":
        for rf in sorted((d / "reviews").glob("[0-9][0-9].json")):
            no = int(rf.stem)
            r = json.loads(rf.read_text())
            stamp = r.get("reviewed_fingerprint")
            state = "没盖章" if not stamp else ("一致" if stamp == fingerprint(d, no) else "评审之后被改过")
            print(f"{no:02d} {r.get('verdict')} {state}")
        return
    no = int(sys.argv[2])
    rf = d / "reviews" / f"{no:02d}.json"
    r = json.loads(rf.read_text())
    r["reviewed_fingerprint"] = fingerprint(d, no)
    rf.write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print(f"{ticker} 第 {no} 章：评审已和当前稿子绑定（{r['reviewed_fingerprint']}）")


if __name__ == "__main__":
    main()
