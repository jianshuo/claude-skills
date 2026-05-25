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

> ⛔ **NEVER use 飞书妙记 / lark-minutes for ASR.** It only gives turn-level (speaker-turn) timestamps, not per-word timing — subtitles built from it drift by seconds and break at unnatural places. The user's standing rule: "以后不要用飞书妙记来做ASR，不能作为SRT使用，记住". There is no 飞书妙记 fallback. If Volcano is unavailable, fall back to the OpenAI Whisper word-level path above (pin `language=zh`).

### Use the STREAMING WebSocket API — pushes bytes, needs NO public URL

The file / 录音文件识别 / MediaKit APIs all require a publicly reachable HTTP(S) audio URL. The user rejected URL-hosting ("不要再用什么从服务器端去 download 的这 mp3 这样的模式" — tunnels fail on their hotspot). The **大模型流式语音识别 (bigmodel streaming)** API sidesteps the URL entirely by pushing raw PCM bytes over a WebSocket. **This is the working path.** It returns per-word ms timestamps.

**Bundled scripts (use these — they are the verified working path):**

```bash
# 1. Transcribe: pushes 16k mono PCM bytes over WebSocket → ASR JSON
#    (decodes any input via ffmpeg; .pcm passes straight through)
export VOLC_ASR_APPID=…  VOLC_ASR_ACCESS_TOKEN=…   # credentials live with the user
python3 scripts/volc_asr_stream.py <clip.mp4|wav|mp3|pcm> <out.asr.json>

# 2. Build a clean, word-timed SRT from the ASR JSON
python3 scripts/build_srt_from_asr.py <out.asr.json> <out.srt> [max_chars=18]
#    Segmentation knobs (optional):
#      --max-chars N   raise to keep cues whole / break on punctuation, not mid-sentence
#      --soft-min N    min chars before a ，、； flushes a cue (default 8)
#      --strip-punct   remove ALL punctuation from displayed text (clean subtitle look)
```

- **Endpoint:** `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`
- **Headers:** `X-Api-App-Key:{appid}`, `X-Api-Access-Key:{token}`, `X-Api-Resource-Id:volc.bigasr.sauc.duration`, `X-Api-Connect-Id:{uuid}`
- **Binary v3 framing:** 4-byte header `[(ver<<4)|hdrsize, (msgtype<<4)|flags, (ser<<4)|comp, 0]`. Full-client(0x1)+POS_SEQ sends gzipped JSON config; audio(0x2) packets send gzipped PCM chunks (200ms = 6400 bytes @16k mono s16le); last packet uses NEG_WITH_SEQ(0x3) with **negative** seq. Server full-response(0x9) returns gzipped JSON.
- **Config JSON:** `{user:{uid}, audio:{format:"pcm",rate:16000,bits:16,channel:1,codec:"raw"}, request:{model_name:"bigmodel", enable_punc:true, enable_itn:true, show_utterances:true}}`. **Do NOT set `result_type:"single"`** — that returns only the latest sentence each frame; default mode accumulates all utterances.
- **Result shape:** `result.utterances[]`, each with `text` (punctuated) + `words[]` (token + ms `start_time`/`end_time`). Latin tokens like "AI" come back with `start=end=0` — `build_srt_from_asr.py` forward/backward-fills from neighbours.
- **build_srt_from_asr.py** also: splits cues on punctuation (HARD `。！？` flush; SOFT `，、；` flush past `--soft-min` chars; hard cap `--max-chars`), optionally strips all punctuation from the display (`--strip-punct`), drops 呃/嗯/唉 fillers, and collapses immediate duplicate short tokens (才才→才). Every cue is timed by its first/last word so it sits exactly on the spoken audio — no drift. **To avoid mid-sentence breaks, raise `--max-chars` so boundaries fall on punctuation rather than the char cap.**
- **Per-clip transcription:** transcribe each *clip's own* audio (16k mono PCM) so the SRT timestamps come out clip-relative.
- **Credentials:** live with the user (豆包语音引擎). Env names accepted by the script: `VOLC_ASR_APPID`/`VOLC_APPID` and `VOLC_ASR_ACCESS_TOKEN`/`VOLC_TOKEN`; `FFMPEG_BIN` optional.
  - **This user's 火山 ASR and TTS share ONE credential set** — same appid + access token work for both services. They're stored in `~/code/.env` as `VOLC_TTS_APPID` / `VOLC_TTS_ACCESS_TOKEN` (plus `VOLC_APPID` in `~/.zshrc`), with `VOLC_ASR_APPID` / `VOLC_ASR_ACCESS_TOKEN` aliases appended pointing at the same values. So `set -a; source ~/code/.env; set +a` is enough — no separate ASR token to hunt for. If the aliases are ever missing, recreate them from the TTS values (they're the same secret).
- **Dead ends (don't retry):** MediaKit asr-subtitles (doc 6448/2381968) still needs a public URL *and* a separate MediaKit API key. The 录音文件识别 file API needs a public URL.

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

## AI 润色 pass — fix obvious 错别字 (final step, always run for Chinese)

Even Volcano ASR ships clear homophone errors that read wrong on screen — observed: 「总数」→「意数」, 「需求」→「虚求」, 「程序员」→「成员」. Raw ASR text is the floor, not the ceiling. After the SRT is assembled, do **one Claude polish pass** over the full SRT to correct obvious errors using sentence context.

This pass is done **in-session by Claude reading the SRT** — no external API call. Rewrite the `.srt` in place (or to `<stem>.polished.srt`).

**Hard rules — this is correction, not editing:**

- ✅ Fix only *clear* homophone / 错别字 errors where the intended word is unambiguous from context (意数→总数, 虚求→需求).
- ⛔ **NEVER change timestamps, cue numbering, or cue boundaries.** Edit the text line *inside* each existing cue only. Same number of cues in and out.
- ⛔ **Do not paraphrase, polish grammar, condense, or "improve" phrasing.** Keep the spoken register, fillers the assembler kept, repetitions, and sentence shape. The SRT must still match the audio word-for-word except for the corrected characters.
- ⛔ **Do not silently "correct" 专有名词 / 人名 / 品牌 / 产品名.** Homophone-guessing names is how you ship 「黄一孟」→「黄一梦」. Leave them as-is and surface a list to the user for confirmation (see pitfall below). Never invent a name you didn't hear.
- ✅ Keep the gold-block-worthy numbers exactly as spoken (50万, 1,000万) — don't normalize digits/units.

**Workflow:** read the SRT → produce the corrected SRT with identical timing → report a short diff list of what changed (`意数→总数 @ 00:01:11`) so the user can spot-check. If a correction is uncertain, leave the original and add it to the proper-noun/uncertain list rather than guessing.

Run this **before** segmentation/clip-building so every downstream clip inherits the clean text.

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
- AI 润色 pass run — obvious 错别字 corrected, timestamps/cue count untouched, 专有名词 surfaced to user not silently changed

## Downstream

- **`/wjs-mining-articles`** — turn a 王建硕 monologue/对谈 SRT into multiple 微信公众号 articles.
- **`/wjs-translating-subtitles`** — translate the source SRT to a target language with punctuation-bounded re-segmentation.
- **`/wjs-dubbing-video`** — only if the user wants voice dub *in the source language* (rare); usually you translate first.
- **`/wjs-burning-subtitles`** — only if the user wants the source-language SRT burned onto the source video (e.g., Spanish video with Spanish subs for hearing-impaired).

## Common pitfalls

- **Sending the whole 60-minute file in one API call.** OpenAI's hard limit is 25 MB and the call gets choppy at >15 min anyway. Chunk first.
- **Treating `segments[]` text as authoritative.** It's inconsistently punctuated across chunks of the same file — never trust it without the assembler.
- **Letting Whisper auto-detect language.** Pin every time.
- **Forgetting to add chunk offsets.** Each API response has timestamps relative to the chunk's t=0; merging without adding the chunk's absolute start makes every cue past the first chunk wrong by minutes.
- **专有名词 / 人名几乎一定有错。** ASR 把人名、品牌、产品名听成同音别字是常态(实测「黄一孟」→「黄一梦」)。SRT 里的专有名词都先当存疑,下游成文/发布前(尤其 `/wjs-mining-articles`)一定跟用户核对,别照着错字写出去。
