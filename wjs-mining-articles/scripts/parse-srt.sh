#!/usr/bin/env bash
# Strip an SRT into readable transcript for topic mining.
#
# Why this exists: raw SRT is line-numbered, time-coded, and chopped into
# sub-second cues. To identify which topics a monologue covers — and cite the
# SRT time range for each — you want the spoken text merged back into sentences,
# with a single start timestamp in front of each merged chunk.
#
# Behavior:
#   - Joins consecutive cues until a sentence-ending mark (。！？!?.…) or a
#     time gap >= GAP_SEC (default 8s, signals a topic/scene jump).
#   - Prefixes each merged chunk with its [HH:MM:SS–HH:MM:SS] start–end range,
#     so a topic's full SRT span (including the last topic's end) is readable.
#   - Collapses the dangling filler that survives ASR ("呃" leading a cue) is
#     left in place — cleanup is the writer's judgment call, not the parser's.
#   - Handles both ',' and '.' millisecond separators.
#
# Usage:
#   parse-srt.sh <file.srt>            # merged, timestamped transcript
#   parse-srt.sh <file.srt> --raw      # one line per cue: HH:MM:SS<TAB>text
#
# GAP_SEC=12 parse-srt.sh foo.srt      # override the topic-break gap

set -euo pipefail

SRT="${1:-}"
MODE="${2:-merged}"
GAP_SEC="${GAP_SEC:-8}"

if [[ -z "$SRT" || ! -f "$SRT" ]]; then
  echo "usage: parse-srt.sh <file.srt> [--raw]" >&2
  exit 2
fi

python3 - "$SRT" "$MODE" "$GAP_SEC" <<'PY'
import re, sys

path, mode, gap = sys.argv[1], sys.argv[2], float(sys.argv[3])
text = open(path, encoding="utf-8-sig").read()

ts = re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*"
                r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")

def secs(h, m, s, ms): return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000
def hms(t):
    t = int(t); return f"{t//3600:02d}:{t%3600//60:02d}:{t%60:02d}"

cues = []  # (start_sec, end_sec, text)
block, start, end = [], None, None
for line in text.splitlines():
    m = ts.search(line)
    if m:
        start = secs(*m.group(1, 2, 3, 4))
        end = secs(*m.group(5, 6, 7, 8))
        block = []
    elif line.strip().isdigit() and start is None:
        continue  # cue index before the first timecode
    elif line.strip() == "":
        if block and start is not None:
            cues.append((start, end, " ".join(block).strip()))
            block, start = [], None
    else:
        if start is not None:
            block.append(line.strip())
if block and start is not None:
    cues.append((start, end, " ".join(block).strip()))

cues = [c for c in cues if c[2]]

if mode == "--raw":
    for s, e, t in cues:
        print(f"{hms(s)}\t{t}")
    sys.exit(0)

# Merge into sentence-bounded chunks, each tagged with its [start–end] range.
END = "。！？!?.…"
chunks, buf, buf_start, buf_end, prev_end = [], "", None, None, None
for s, e, t in cues:
    if buf and prev_end is not None and (s - prev_end) >= gap:
        chunks.append((buf_start, buf_end, buf)); buf, buf_start = "", None
    if buf_start is None:
        buf_start = s
    buf += t
    buf_end = prev_end = e
    if t and t[-1] in END:
        chunks.append((buf_start, buf_end, buf)); buf, buf_start = "", None
if buf:
    chunks.append((buf_start, buf_end, buf))

for s, e, t in chunks:
    print(f"[{hms(s)}–{hms(e)}] {t}")
PY
