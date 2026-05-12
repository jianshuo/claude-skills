---
name: wjs-transcribing-audio
description: Use when the user has audio or video and wants a timestamped transcript (SRT) in the source language. Routes by source language — Chinese defaults to Volcano (豆包) ASR; other languages (Spanish, English, Portuguese, French, Italian, Japanese, Korean, etc.) use OpenAI Whisper API with word-level timestamps and self-assembled cues. Outputs SRT with punctuation-bounded cues capped for on-screen reading. Triggers — "转写", "转成字幕", "做 SRT", "transcribe", "make subtitles", "speech to text", "出字幕".
---

# wjs-transcribing-audio

Spoken audio in → timestamped SRT in the same language out. **This skill stops at the source-language SRT.** Translation to another language is the next skill (`/wjs-translating-subtitles`).

## When to use

- User provides a video or audio file and wants a transcript / SRT in the source language.
- User already has a translated SRT and the source SRT is missing.
- User asks "做 SRT" / "make subtitles" / "出逐字稿" with no translation step requested yet.

## When NOT to use

- Source-language SRT already exists → skip straight to `/wjs-translating-subtitles`.
- User wants the transcript in a different language than spoken → run this skill first, then `/wjs-translating-subtitles`.
- User wants only the dub or burn-in → if SRT exists, skip; otherwise run this first.

## Routing: which engine

| Source language | Default engine | Why |
|---|---|---|
| Chinese (zh-CN, zh-HK, zh-TW) | **Volcano (豆包) ASR** | Materially better accuracy than Whisper for Chinese — user's standing preference |
| Any other (es, en, pt, fr, it, ja, ko, …) | **OpenAI Whisper API** with word-level granularity | Whisper's multilingual is strong; word timestamps let us assemble cues ourselves |
| Offline / no API access | Local `openai-whisper` (medium) | Quality floor; same loop/blob failure modes apply |

For Chinese, do **not** default to Whisper unless the user explicitly asks for it or Volcano is unavailable. This is a deliberate routing decision — see user's memory on Chinese ASR priority.

## OpenAI Whisper API path (non-Chinese, and Chinese fallback)

**The key principle: do not request `response_format=srt`.** Whisper cue-segmentation fails on long monologues (30-second blob cues) and quiet stretches (loop hallucinations). Request word-level timestamps and assemble cues yourself — the post-processing is deterministic and free.

### Why not response_format=srt

Two failure modes that wreck `whisper-1` SRT output on long content:

1. **30-second blob cues.** In long monologues, `whisper-1` with `response_format=srt` emits one cue covering the full 30s `condition_on_previous_text` window. Transcript is fine; timing is unusable for on-screen reading.
2. **Loop hallucination on quiet tails.** Greedy `temperature=0` on low-energy audio produces "你如果不把拥抱浪费写在这上面,你很难的" repeated 50 times.

Both stem from letting Whisper decide cue boundaries. Fix: word-level timestamps + your own punctuation-aware assembler.

### Calling the API

```bash
# 1. Compress for upload — 64kbps mono MP3 is plenty for speech.
#    OpenAI limit is 25MB per request; chunk into 10-min pieces
#    (≈4.5MB at 64kbps) for resilience under flaky proxies.
ffmpeg -hide_banner -loglevel error -y \
  -ss <start> -t 600 -i input.mp4 \
  -vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 64k chunk.mp3
```

```python
# 2. Request word-level timestamps. Do NOT request response_format=srt.
import httpx, os
data = {
    "model": "whisper-1",
    "language": "es",                        # pin source language; never auto-detect
    "response_format": "verbose_json",
    "timestamp_granularities[]": "word",     # ← the critical flag
    "temperature": "0.2",                    # enable fallback chain (anti-loop)
}
with open("chunk.mp3", "rb") as f:
    r = httpx.post(
        "https://api.openai.com/v1/audio/transcriptions",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        data=data,
        files={"file": ("chunk.mp3", f, "audio/mpeg")},
        timeout=600.0,
    )
r.raise_for_status()
j = r.json()
words    = j["words"]      # [{"word": "hola", "start": 0.12, "end": 0.34}, ...]
segments = j["segments"]   # see surprise below
```

### Surprise: words[] has no punctuation, segments[] is inconsistent

Whisper's `words[]` array typically has **no punctuation** in `word["word"]` — each entry is a bare token like `"做"`, `"个"`, `"测"`, `"试"`. Punctuation, when present, lives only in `segments[]` `text` field.

Worse, `segments[]` text is **inconsistently punctuated** across chunks of the same file: chunk 0 of a 79-min podcast might emit 285 bare segments ("做个测试" "你在" "呵呵") at 1-2s each with no punctuation; chunk 7 might emit 34 segments at 14-30s each *with* punctuation. Both behaviors ship in the same API response.

So the right recipe combines both: use `segments[]` for natural pause boundaries (already aligned to breath), but treat them as raw input to your own cue assembler, which uses word timestamps to split anywhere the segments are too long.

### Cue assembly recipe

```python
TARGET_DUR = 3.0   # try to make cues this long
MAX_CUE_DUR = 5.0  # never exceed
MAX_CHARS = 18     # ~one line at Fontsize 14 on 1080-wide vertical
MAX_GAP = 1.0      # silence threshold → force cue boundary
MIN_PIECE = 0.3    # below this, merge with neighbor
SPLIT_PUNCT = set("，。！？；,.;!?")

# Step A: merge short segments[] toward TARGET_DUR (use segments,
#         not words — Whisper's segment boundaries are already
#         pause-aligned).
def assemble(segments, offset):
    cues, buf = [], []
    def flush():
        if buf:
            cues.append((buf[0]["start"]+offset, buf[-1]["end"]+offset,
                         "".join(s["text"].strip() for s in buf)))
            buf.clear()
    for s in segments:
        dur = s["end"] - s["start"]
        # Long single segment WITH internal punct → split standalone
        if dur > MAX_CUE_DUR and any(c in s["text"] for c in SPLIT_PUNCT):
            flush(); cues.extend(split_long_segment(s, offset)); continue
        if not buf: buf.append(s); continue
        if (s["start"] - buf[-1]["end"]) >= MAX_GAP \
           or (buf[-1]["end"] - buf[0]["start"]) >= TARGET_DUR \
           or (s["end"] - buf[0]["start"]) > MAX_CUE_DUR:
            flush()
        buf.append(s)
    flush(); return cues

# Step B: final pass — split every internal comma/period to its own cue
#         (proportional timestamps by char position). Coalesce pieces
#         shorter than MIN_PIECE forward.

# Step C: any cue still > MAX_CHARS gets split at the largest inter-word
#         gap using words[] timestamps. Recursive until under cap.
```

Tweak `TARGET_DUR` and `MAX_CHARS` to platform reading rhythm. The 18-char cap matters for burn-in on vertical 1080×1920 at `Fontsize=14` — longer wraps to multiple unreadable lines.

### Operational details

- **Auth:** credentials live in `~/code/.env`. Load with `set -a; source ~/code/.env; set +a` before invoking.
- **SOCKS proxy on this machine:** `httpx` needs the `socksio` extra — use `uvx --with httpx --with socksio python ...` (without it you get `ImportError: Using SOCKS proxy, but the 'socksio' package is not installed`).
- **Chunking:** 10-min pieces at 64kbps mono MP3 (~4.5MB each) are the reliability sweet spot. 20-min chunks (~9MB) sometimes RST under flaky proxies. Concurrency `max_workers=2` is more reliable than `4`.
- **Retry:** every API call wrapped in 5× exponential backoff (`time.sleep(min(2**n, 30))`) — `RemoteProtocolError: Server disconnected` is common and transient.
- **Offset stitching:** each chunk's words come back with timestamps relative to that chunk. When merging, add the chunk's absolute start offset to every word's `start`/`end` before assembling cues.
- **Loop guard (belt + suspenders):** even with `temperature=0.2`, occasionally a sub-chunk still loops. After assembly, run a loop-detector on each cue's text — if any phrase of length 8–40 chars repeats 3+ times consecutively, drop the cue.

### Anti-patterns (do not do)

- ❌ **Do not request `response_format=srt`** for content longer than ~2 minutes.
- ❌ **Do not "fix" bad cues with a second API call.** If you got blob cues or loop hallucinations from your first call, redo with word-level granularity once — don't re-transcribe just the broken sub-range.
- ❌ **Do not use `temperature=0`** on potentially-quiet audio (yoga, spiritual content, podcast outros). Greedy decoding loops. `0.2` enables the fallback chain.
- ❌ **Do not skip `language=...`.** Auto-detect occasionally swaps Chinese→Japanese or Spanish→Portuguese on the first 30 seconds and the whole transcript is then wrong.

## Volcano (豆包) ASR path — preferred for Chinese

Volcano ASR routinely beats Whisper on Mandarin accuracy (recognition rate, punctuation, named entities). Use this as the default for `zh-*` source.

- Endpoint and auth: see the user's `lark-minutes` and 豆包 ASR docs — credentials in `~/code/.env` (`VOLC_ASR_APPID`, `VOLC_ASR_ACCESS_TOKEN`).
- For long-form Chinese audio (>10 min): use the user's bundled scripts under `scripts/` if present; otherwise route through 飞书妙记 (`/lark-minutes`), which is the user's standing fallback for `.m4a` / `.mp3` / `.mp4` → SRT.

If Volcano isn't available on this machine, fall back to OpenAI Whisper API with the same word-level recipe above — pin `language=zh`, and follow the cue assembly steps.

## Local Whisper as last resort

Only when offline, the API quota is exhausted, or for ultra-cheap rough drafts. Quality is materially lower for Chinese; same blob/loop failure modes apply; local Whisper does not expose word-level timestamps via the CLI so the principled fix isn't available.

```bash
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le _audio.wav -y
uvx --from openai-whisper whisper _audio.wav \
    --language zh --task transcribe \
    --model medium --output_format srt --output_dir .
rm _audio.wav
```

`medium` is the practical floor for Chinese accuracy; `small` is OK only for clean studio English. Whisper writes `.` milliseconds; the file is still valid SRT. If you regenerate the SRT, always emit `,` ms.

## Output

- **File name**: `<source-stem>.srt` (no language suffix — this is the *source* language SRT, the master).
- **Format**: standard SRT, `HH:MM:SS,mmm` (comma ms), 1-indexed.
- **Cue rules**: punctuation-bounded; 3-8s typical duration; ≤18 Chinese chars or ≤42 Latin chars per visible line.
- **Unclear audio**: mark `[inaudible]` only when necessary; do not guess.

## Quality gate before handoff

- Subtitle numbers are sequential
- Timestamps don't overlap
- Milliseconds use commas
- No cue ends mid-word
- No cue exceeds MAX_CHARS without an internal split
- No phrase repeats 3+ times consecutively (loop residue)

## Downstream

- **`/wjs-translating-subtitles`** — translate the source SRT to a target language with punctuation-bounded re-segmentation.
- **`/wjs-dubbing-video`** — only if the user wants voice dub *in the source language* (rare); usually you translate first.
- **`/wjs-burning-subtitles`** — only if the user wants the source-language SRT burned onto the source video (e.g., Spanish video with Spanish subs for hearing-impaired).

## Common pitfalls

- **Sending the whole 60-minute file in one API call.** OpenAI's hard limit is 25 MB and the call gets choppy at >15 min anyway. Chunk first.
- **Treating `segments[]` text as authoritative.** It's inconsistently punctuated across chunks of the same file — never trust it without the assembler.
- **Letting Whisper auto-detect language.** Pin every time.
- **Forgetting to add chunk offsets.** Each API response has timestamps relative to the chunk's t=0; merging without adding the chunk's absolute start makes every cue past the first chunk wrong by minutes.
