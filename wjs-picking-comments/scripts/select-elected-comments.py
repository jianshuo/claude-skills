#!/usr/bin/env python3
"""Parse comments.md (from fetch-comments-by-cookie.sh) and emit
candidates for the LLM to pick from.

We parse the markdown because it's the canonical paginated output;
the sibling comments-raw.json is only a first-page debug dump.

comments.md format (per fetch-comments-by-cookie.sh):

  ## <nick>  (YYYY-MM-DD HH:MM) [**[置顶]**] [**[精选]**] [· 👍 N] [· <ip-location>]

  <content lines>
  [> reply content lines]

  ---

Default mode (--mode elected): emit only elected comments, sorted by likes.
Fallback (--mode topliked): if elected < min-elected, also include unelected
with like_num ≥ 3.

Usage:
  select-elected-comments.py <comments.md>
  select-elected-comments.py <comments.md> --max 20 --min-elected 5
"""
import argparse, json, re, sys
from pathlib import Path

# Pattern: '## <nick>  (YYYY-MM-DD HH:MM) [marks...]'
HEADER_RE = re.compile(r"^##\s+(?P<rest>.+?)\s*$")

def parse_header(line: str):
    """Parse a comment heading line, return dict of extracted fields or None."""
    m = HEADER_RE.match(line)
    if not m:
        return None
    rest = m.group("rest")

    # Time: '(YYYY-MM-DD HH:MM)' — find first paren block
    tm = re.search(r"\(([^)]+)\)", rest)
    if not tm:
        return None
    time_str = tm.group(1)
    # Nick is everything before the '('
    nick = rest[:tm.start()].strip().rstrip()  # strip trailing whitespace
    if not nick:
        return None

    # After the time paren: marks separated by spaces or `· `
    tail = rest[tm.end():].strip()
    is_elected = "**[精选]**" in tail
    is_top = "**[置顶]**" in tail

    # Likes: ' · 👍 N'
    lm = re.search(r"👍\s*(\d+)", tail)
    like_num = int(lm.group(1)) if lm else 0

    # Location: trailing ' · <text>' that isn't 👍 — heuristic: last '·' segment
    # not matching 👍 / [精选] / [置顶]
    location = ""
    for seg in [s.strip() for s in tail.split("·")][::-1]:
        seg_clean = seg.strip()
        if not seg_clean:
            continue
        if seg_clean.startswith("👍"):
            continue
        if seg_clean in ("**[精选]**", "**[置顶]**"):
            continue
        location = seg_clean
        break

    return {
        "nick_name": nick,
        "time": time_str,
        "is_elected": is_elected,
        "is_top": is_top,
        "like_num": like_num,
        "location": location,
    }

def parse_comments_md(text: str):
    """Walk through the file, collecting comment blocks."""
    lines = text.splitlines()
    out = []
    i = 0
    while i < len(lines):
        h = parse_header(lines[i])
        if h is None:
            i += 1
            continue
        # Skip blank line after header
        i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        # Content: until next '---' or next '## ' header
        content_lines = []
        while i < len(lines):
            ln = lines[i]
            if ln.strip() == "---":
                break
            if HEADER_RE.match(ln):
                break
            content_lines.append(ln)
            i += 1
        # Filter out blockquoted reply lines and strip trailing blanks
        content = "\n".join(
            l for l in content_lines if not l.lstrip().startswith(">")
        ).strip()
        if content and content != "_（空）_":
            h["content"] = content
            out.append(h)
        # Skip past the '---' separator if present
        if i < len(lines) and lines[i].strip() == "---":
            i += 1
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("md_path")
    ap.add_argument("--max", type=int, default=20,
                    help="max candidates to emit (default 20)")
    ap.add_argument("--min-elected", type=int, default=5,
                    help="if fewer elected than this, also include high-like unelected (default 5)")
    args = ap.parse_args()

    text = Path(args.md_path).read_text()
    rows = parse_comments_md(text)

    elected = [r for r in rows if r["is_elected"]]
    elected.sort(key=lambda r: (-r["like_num"], r["time"]))

    if len(elected) < args.min_elected:
        fallback = [r for r in rows if not r["is_elected"] and r["like_num"] >= 3]
        fallback.sort(key=lambda r: (-r["like_num"], r["time"]))
        candidates = elected + fallback
    else:
        candidates = elected

    candidates = candidates[: args.max]

    json.dump({
        "total_comments": len(rows),
        "total_elected": len(elected),
        "candidates": candidates,
    }, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")

if __name__ == "__main__":
    main()
