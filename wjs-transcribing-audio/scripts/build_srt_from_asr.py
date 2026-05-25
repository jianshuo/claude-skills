#!/usr/bin/env python3
"""Build a clean, audio-aligned SRT from 火山 streaming-ASR JSON.

Input JSON has result.utterances[], each with `text` (punctuated) and
`words[]` (punctuation-free tokens with ms start_time/end_time). We align
words back onto the punctuated text to recover break points, then split each
utterance into short cues (good for vertical video), timing every cue by its
first/last word — so cues sit exactly on the spoken audio with no drift.

Usage: build_srt_from_asr.py <asr.json> <out.srt> [max_chars]
                             [--soft-min N] [--strip-punct]

Segmentation knobs:
  max_chars / --max-chars  hard cap; raise it to avoid mid-sentence splits and
                           let cue boundaries fall on punctuation (default 18).
  --soft-min N             min chars before a comma/、/； flushes a cue (default 8).
  --strip-punct            remove ALL punctuation from the displayed cue text
                           (turns commas/periods into clean line breaks). By
                           default only leading/trailing punctuation is stripped.
"""
import sys, json, argparse

HARD = "。！？!?…"
SOFT = "，、；,;：: "
PUNCT = HARD + SOFT
MAX = 18           # overwritten from CLI in main()
SOFT_MIN = 8       # overwritten from CLI in main()
STRIP_ALL = False  # overwritten from CLI in main()


def fmt(ms):
    ms = max(0, int(round(ms)))
    h = ms // 3600000; ms -= h*3600000
    m = ms // 60000;   ms -= m*60000
    s = ms // 1000;    ms -= s*1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def clean(t):
    t = t.strip().strip(PUNCT).strip()
    if STRIP_ALL:
        t = "".join(c for c in t if c not in PUNCT)
    return t


def fix_words(utt):
    """火山 sometimes returns start=end=0 for latin tokens (e.g. 'AI').
    Forward/backward fill from neighbours so every word has a sane ms time."""
    ws = utt["words"]
    last = utt.get("start_time", 0)
    for w in ws:
        if w.get("start_time", 0) <= 0:
            w["start_time"] = last
        if w.get("end_time", 0) <= 0 or w["end_time"] < w["start_time"]:
            w["end_time"] = w["start_time"]
        last = max(last, w["end_time"])
    nxt = utt.get("end_time", last)
    for w in reversed(ws):
        if w["end_time"] <= w["start_time"]:
            w["end_time"] = min(nxt, w["start_time"] + 240)
        nxt = w["start_time"]
    return utt


FILLERS = {"呃", "嗯", "唉"}

def tidy_words(utt):
    """Conservative disfluency cleanup: drop 呃/嗯 fillers and collapse an
    immediately-repeated short token (才才→才, 就是就是→就是). Timing of the
    surviving token absorbs the dropped one so cues stay audio-aligned."""
    src = utt["words"]
    out = []
    for w in src:
        t = w["text"]
        if t in FILLERS:
            if out:
                out[-1]["end_time"] = max(out[-1]["end_time"], w["end_time"])
            continue
        if out and out[-1]["text"] == t and len(t) <= 2:
            out[-1]["end_time"] = max(out[-1]["end_time"], w["end_time"])
            continue
        out.append(dict(w))
    utt["words"] = out
    return utt


def cues_from_utt(utt):
    fix_words(utt)
    tidy_words(utt)
    text = utt["text"]
    words = utt["words"]
    pos = 0
    cues = []
    cur_words = []          # (token, start, end)
    cur_len = 0

    def flush():
        nonlocal cur_words, cur_len
        if not cur_words:
            return
        disp = clean("".join(w[0] for w in cur_words))
        if disp:
            cues.append([cur_words[0][1], cur_words[-1][2], disp])
        cur_words = []
        cur_len = 0

    for w in words:
        tok = w["text"]
        # locate token in text from pos (skip stray chars)
        idx = text.find(tok, pos)
        if idx < 0:
            idx = pos
        pos = idx + len(tok)
        cur_words.append((tok, w["start_time"], w["end_time"]))
        cur_len += len(tok)
        # consume any punctuation immediately following this word
        hard_break = False
        soft_break = False
        while pos < len(text) and text[pos] in PUNCT:
            if text[pos] in HARD:
                hard_break = True
            else:
                soft_break = True
            pos += 1
        if hard_break:
            flush()
        elif soft_break and cur_len >= SOFT_MIN:
            flush()
        elif cur_len >= MAX:
            flush()
    flush()
    return cues


def main():
    global MAX, SOFT_MIN, STRIP_ALL
    ap = argparse.ArgumentParser()
    ap.add_argument("asr_json")
    ap.add_argument("out_srt")
    ap.add_argument("max_chars", nargs="?", type=int, default=18,
                    help="hard cap per cue (positional, back-compat)")
    ap.add_argument("--max-chars", dest="max_chars_opt", type=int, default=None)
    ap.add_argument("--soft-min", type=int, default=8,
                    help="min chars before a soft (，、；) break flushes")
    ap.add_argument("--strip-punct", action="store_true",
                    help="strip ALL punctuation from displayed cue text")
    args = ap.parse_args()
    MAX = args.max_chars_opt if args.max_chars_opt is not None else args.max_chars
    SOFT_MIN = args.soft_min
    STRIP_ALL = args.strip_punct

    data = json.load(open(args.asr_json))
    utts = data["result"]["utterances"]
    all_cues = []
    for u in utts:
        if u.get("words"):
            all_cues += cues_from_utt(u)
        elif u.get("text", "").strip():
            all_cues.append([u["start_time"], u["end_time"], clean(u["text"])])

    # enforce monotonic, non-overlapping, min duration
    out = []
    for c in all_cues:
        if not c[2]:
            continue
        c[1] = max(c[1], c[0] + 400)          # min 0.4s
        if out and c[0] < out[-1][1]:
            out[-1][1] = min(out[-1][1], c[0])  # trim previous to avoid overlap
        out.append(c)

    with open(args.out_srt, "w", encoding="utf-8") as f:
        for i, (a, b, t) in enumerate(out, 1):
            f.write(f"{i}\n{fmt(a)} --> {fmt(b)}\n{t}\n\n")
    print(f"{len(utts)} utterances -> {len(out)} cues -> {args.out_srt}")


if __name__ == "__main__":
    main()
