---
name: wjs-translate-video
description: End-to-end video localization. Transcribe spoken audio in any language Whisper supports (Spanish, English, Portuguese, French, Italian, Japanese, Korean, etc.), translate into a chosen target language (Simplified Chinese and English are first-class; other targets work via the same pipeline if a TTS voice is available), generate punctuation-bounded SRT subtitles, optionally burn them into the video, and optionally produce a time-aligned voice dub. Defaults to single-speaker — uses one voice for the whole video. Multi-speaker dubbing (different voice per person) is an opt-in advanced mode triggered only when the user explicitly says the source has multiple speakers. TTS routes by voice ID — Volcano (豆包) for Chinese, edge-tts neural for any language. Preserves the original audio as a low-volume bed under the dub when desired. Bundled scripts in `scripts/`: `dub.py` (TTS + time-align), `render.py` (burn + mix + final), and `visual_diarize.py` (opt-in mouth-movement speaker detection). All major behaviors are flag-controlled.
---

# translate-video

## Purpose

End-to-end video localization pipeline. Given a video with spoken
audio in **any language Whisper recognizes**, this skill produces:

1. A timestamped transcript SRT in the source language.
2. A translated SRT in the user's chosen target language, segmented
   at punctuation boundaries (no mid-sentence breaks).
3. Optional: hard-burned subtitles in the chosen target language.
4. Optional: a time-aligned TTS voice dub in the target language,
   with the original audio optionally preserved as a low-volume bed.

Outputs are SRT and MP4 — usable directly in Final Cut Pro,
Premiere Pro, CapCut, DaVinci Resolve, or `ffmpeg`.

### Source language

Pass `--language es` (or `en`, `pt`, `fr`, `it`, `ja`, `ko`, etc.)
to whisper to lock detection. Auto-detect can mis-route on short or
heavily accented clips, so always pin the source explicitly when
known.

### Target language

This skill is fully validated for two targets:

- **Simplified Chinese (zh-CN)** — Volcano (豆包) TTS for dub,
  Chinese-specific subtitle line conventions.
- **English (en)** — edge-tts multilingual neural voices for dub,
  English subtitle line conventions.

Other targets (Japanese, Korean, French, etc.) work mechanically via
the same pipeline; the bottleneck is finding a good TTS voice — the
edge-tts catalog covers most major languages, but cap-test before
promising.

Picking from user phrasing:

- "翻成中文 / 中文字幕 / 中文配音" → `zh-CN`.
- "translate to English / English subs / English dub" → `en`.
- "bilingual" → produce both `.zh-CN.srt` and `.en.srt`; for dubs
  ask which one to render (or render both).
- Ambiguous → default to whichever the user has historically chosen
  in the project; otherwise ask once.

The canonical worked example throughout this doc is **Spanish → Chinese**
because that was the original validation scenario, but every step
applies to other source/target pairs unchanged.

### Number of speakers — default to one

**Default: assume one speaker.** Use a single voice for the entire
dub. This is the right answer for monologues, vlogs, recorded talks,
narrator-only clips, and the overwhelming majority of videos people
ask about. Don't run diarization, don't tag the SRT with `[A]`/`[B]`,
don't bring up multi-speaker complexity.

**Switch to multi-speaker only when the user explicitly says so** —
phrasings like "two people", "interview", "dialogue", "conversation
between", "separate the speakers", "different voice for each", or a
direct request to do diarization. When triggered, follow the
"Multi-speaker dubbing (advanced, opt-in)" section near the end of
this doc.

If you're unsure whether a video is one speaker or many, ship the
single-voice version first. Adding speaker separation later is
cheap (just regenerate the dub); shipping confused multi-speaker
output by default wastes the user's time.

---

## When to Use

Use this skill when the user asks to:

- Transcribe spoken audio from a video in any source language
- Translate video speech into Chinese or English (or other languages
  with available TTS)
- Add subtitles to a video (soft-muxed or hardcoded/burned-in)
- Generate `.srt` from audio or video
- Translate an existing subtitle file into another language
- Create bilingual or trilingual subtitles
- Fix, polish, or re-time translated subtitles
- Produce a voice dub of a foreign-language video, optionally with
  the original audio kept as a low-volume bed underneath

---

## Input Types

The user may provide:

- A video file: `.mp4`, `.mov`, `.mkv`, `.avi`
- An audio file: `.mp3`, `.wav`, `.m4a`, `.aac`
- A subtitle file: `.srt`, `.vtt`, `.ass`
- A Spanish transcript pasted into the chat
- A rough subtitle draft that needs translation or repair

---

## Default Workflow

### Step 1: Inspect the Source

Determine what the user provided:

- If the user provides a video or audio file, transcribe the Spanish speech.
- If the user provides an existing Spanish subtitle file, preserve its timestamps and translate line by line.
- If the user provides only transcript text, translate it and create subtitles only if timing information is available.
- If no timing information exists, do not invent exact timestamps unless the user explicitly asks for approximate timing.

---

### Step 2: Transcribe the Source Audio

When transcribing (any source language):

- Preserve the original meaning.
- Keep sentence boundaries clear.
- Do not hallucinate unclear words.
- Mark unclear audio as `[inaudible]` only when necessary.
- Preserve names, places, brands, dates, and numbers.
- If multiple speakers are obvious, label them only when useful.
- Keep the transcript aligned with timestamps where possible.

Preferred working format:

```text
[00:00:01.200 --> 00:00:04.800] Spanish transcript here.
[00:00:04.800 --> 00:00:08.500] Spanish transcript here.
```

#### Transcription tooling

**Default: OpenAI Whisper API with word-level timestamps.** Higher
accuracy than local Whisper (especially for Chinese), and — critically
— word-level granularity lets you do the cue-segmentation yourself,
which avoids the two failure modes that wreck `response_format=srt`:

1. **30-second blob cues.** In long monologues or quiet stretches,
   `whisper-1` with `response_format=srt` will emit one cue covering
   the full 30s `condition_on_previous_text` window. The transcript
   is fine; the timing is unusable for on-screen reading.
2. **Loop hallucination on quiet tails.** Greedy `temperature=0` on
   low-energy audio produces "你如果不把拥抱浪费写在这上面,你很难的" repeated 50
   times. The model gets stuck and never escapes within the window.

Both stem from **letting Whisper decide cue boundaries**. The fix is to
ask for word-level timestamps and assemble cues yourself at
punctuation boundaries. This makes downstream post-processing
(loop detection, splitting, merging) deterministic and free —
no second API call needed to "fix" a bad output.

##### Calling the API

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
    "language": "zh",                        # pin source language
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
words = r.json()["words"]   # [{"word": "你好", "start": 0.12, "end": 0.34}, ...]
```

##### Assembling cues from words

```python
# 3. Group words into cues. Flush at punctuation OR length cap.
CHINESE_PUNCT = set("，。！？；：、——,.;:!?")
MAX_DUR = 7.0     # seconds — longer than this hurts on-screen reading
MIN_DUR = 1.0     # seconds — shorter than this feels choppy
MAX_GAP = 1.5     # silence between words → force flush
cues, buf = [], []
def flush():
    if not buf: return
    cues.append((buf[0]["start"], buf[-1]["end"],
                 "".join(w["word"] for w in buf)))
    buf.clear()
for i, w in enumerate(words):
    buf.append(w)
    cur_dur = buf[-1]["end"] - buf[0]["start"]
    gap = (words[i+1]["start"] - w["end"]) if i+1 < len(words) else 0
    ends_in_punct = any(p in w["word"] for p in CHINESE_PUNCT)
    if (ends_in_punct and cur_dur >= MIN_DUR) or cur_dur >= MAX_DUR or gap >= MAX_GAP:
        flush()
flush()
```

##### Operational details

- **Auth:** credentials live in `~/code/.env`; load with
  `set -a; source ~/code/.env; set +a` before invoking.
- **SOCKS proxy on this machine:** `httpx` needs the `socksio` extra —
  use `uvx --with httpx --with socksio python ...` (without it you get
  `ImportError: Using SOCKS proxy, but the 'socksio' package is not
  installed`).
- **Chunking:** 10-min pieces at 64kbps mono MP3 (~4.5MB each) are the
  reliability sweet spot. 20-min chunks (~9MB) sometimes RST under flaky
  proxies. Concurrency `max_workers=2` is more reliable than `4`.
- **Retry:** every API call wrapped in 5× exponential backoff
  (`time.sleep(min(2**n, 30))`) — `RemoteProtocolError: Server
  disconnected` is common and transient.
- **Offset stitching:** each chunk's words come back with timestamps
  relative to that chunk. When merging, add the chunk's absolute start
  offset to every word's `start`/`end` before assembling cues.
- **Loop guard (belt + suspenders):** even with `temperature=0.2`,
  occasionally a sub-chunk still loops. After assembly, run a
  loop-detector on each cue's text — if any phrase of length 8–40 chars
  repeats 3+ times consecutively, drop the cue. Cheap and catches the
  residue.

##### Local Whisper as fallback

Use the local `openai-whisper` package only when offline, the API
quota is exhausted, or for ultra-cheap rough drafts. Quality is
materially lower for Chinese than `whisper-1`, and the same blob/loop
failure modes still apply — local Whisper does not expose word-level
timestamps via the CLI, so the principled fix above isn't available.

```bash
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le _audio.wav -y
uvx --from openai-whisper whisper _audio.wav \
    --language zh --task transcribe \
    --model medium --output_format srt --output_dir .
rm _audio.wav
```

Notes:

- Use `--language zh` (or `es`, `en`, etc.) to lock detection;
  auto-detect can mis-route on short or accented clips.
- `medium` is the practical floor for Chinese accuracy; `small` is OK
  only for clean studio English.
- Whisper writes `.` milliseconds; the file is still valid SRT
  (players accept it). If you regenerate the SRT, always emit `,` ms.

##### Anti-patterns (do not do)

- ❌ **Do not request `response_format=srt`** for content longer than
  ~2 minutes. You're handing cue-segmentation to a model that is bad
  at it on hard audio.
- ❌ **Do not "fix" bad cues with a second API call.** If you got blob
  cues or loop hallucinations from your first call, the principled
  fix is to redo with word-level granularity once — not to
  re-transcribe just the broken sub-range. The post-processing path
  is deterministic and free once you have words.
- ❌ **Do not use `temperature=0`** on potentially-quiet audio (yoga,
  spiritual content, podcast outros). Greedy decoding loops. `0.2`
  enables the fallback chain and breaks out cleanly with no
  perceptible quality loss.
- ❌ **Do not skip `language=zh` / `language=es` etc.** Auto-detect
  occasionally swaps Chinese→Japanese or Spanish→Portuguese on the
  first 30 seconds and the whole transcript is then wrong.

---

### Step 3: Translate Spanish into the Target Language

Both target languages share the same core principles, but the text
mechanics (line length, punctuation, registers) differ.

#### Shared principles

- Prioritize meaning over literal wording.
- Use concise subtitle-style language — viewers read at ~3 wps for
  Chinese, ~3–4 wps for English; lines that exceed that go off-screen
  before they can be read.
- Preserve the tone of the speaker. Casual Spanish → casual target;
  formal Spanish → formal target.
- Do not over-translate names, brands, cultural references, or
  technical terms.
- Keep numbers, dates, names, and places accurate.
- If a phrase has no exact equivalent, translate the meaning
  naturally. No literal/word-for-word constructions.
- Avoid stiff, machine-translated output.

#### Translating into Simplified Chinese (zh-CN)

- Use natural spoken Mandarin for casual speech, formal Mandarin for
  formal speech.
- Use Simplified characters only (do NOT use Traditional Hanzi unless
  the user explicitly asks).
- Subtitle lines should be roughly **15 Chinese characters** or fewer
  per line, max 2 lines per cue (3 only when unavoidable for very
  long cues — see SRT discipline below).
- Use Chinese punctuation: 「，」「。」「；」「：」「、」「——」.
  Never mix English commas/periods into Chinese subtitles.
- **Minimize filler demonstratives 「这」「那」「这个」「那个」
  「那份」「那种」「那里」「那样」.** Spanish-to-Chinese MT routinely
  inserts these because Spanish has overt demonstratives ("eso, esa,
  ese, aquello") that Chinese usually drops. Examples:
  - "这把我们带入二元世界的载体" → "把我们带入二元的载体"
  - "运用那份能量" → "运用这股能量" if needed, or just "运用能量"
  - "正是在这合一里" → "正是在合一中"
  - "像罪人那样翻滚" → "像罪人翻滚" / "像罪人般翻滚"
  - "那份精微的觉知" → "精微的觉知"
  Keep them only when they carry real meaning (deixis, contrast, or
  fixed phrase like spiritual "我就是那" / "tat tvam asi"). Default
  is to delete; add back only if the sentence becomes ambiguous.

Examples:

```text
Spanish: No pasa nada.
Chinese: 没关系。

Spanish: Vamos a ver qué pasa.
Chinese: 我们看看会发生什么。

Spanish: Me parece una locura.
Chinese: 我觉得这太疯狂了。

Spanish: ¿Qué quieres decir?
Chinese: 你是什么意思？

Spanish: La verdad es que no lo esperaba.
Chinese: 说实话，我没想到会这样。
```

#### Translating into English (en)

- Use natural conversational English. Avoid translationese
  ("It is precisely through entering the body…" → "It's by entering
  the body…").
- Lines should be roughly **40–42 characters** or fewer (about 7–9
  words), max 2 lines per cue. Hard cap 50 chars per line.
- Use ASCII punctuation: `,` `.` `;` `:` `—` (em-dash). Avoid Unicode
  curly quotes unless the source needs them — keeps `.srt` portable.
- For contemplative/spiritual content (the typical Spanish-coach
  source), prefer plain words over Latinate jargon: "presence" over
  "manifestation," "wholeness" over "totality," "wake up" over
  "awaken to consciousness."

Examples:

```text
Spanish: No pasa nada.
English: It's nothing.

Spanish: Vamos a ver qué pasa.
English: Let's see what happens.

Spanish: Me parece una locura.
English: This feels crazy to me.

Spanish: ¿Qué quieres decir?
English: What do you mean?

Spanish: La verdad es que no lo esperaba.
English: Honestly, I wasn't expecting this.
```

---

### Step 3.5: Re-segment cues at punctuation boundaries

Whisper segments by silence/breath, not grammar. The result almost
always has cues that **end mid-sentence** (e.g., "...es una forma de
aterrizar," then next cue starts "el espíritu en el cuerpo..."). Any
TTS that processes one cue at a time will then insert an unnatural
pause exactly where the original speaker did not. The fix is mandatory
before dubbing — and improves on-screen reading too.

Apply this regardless of target language. The punctuation set
differs:

- Chinese cues must end at "，" "。" "；" "：" "——" or "、".
- English cues must end at `,` `.` `;` `:` `—` (em-dash) or, in
  practice for subtitles, occasionally a single dash. Never end an
  English cue on a comma-less clause break, and never split inside
  a phrase like "kind of" or "in order to".

Rules:

- **Every cue must end at a real punctuation mark.** Never let a
  cue end on a noun, verb, conjunction, or article that flows into
  the next cue.
- It is fine (and often necessary) to **split** a single Whisper cue
  into 2–4 shorter cues, with timestamps interpolated by character
  position within the original cue's duration.
- It is fine to **merge** the tail of one Whisper cue with the head
  of the next when they form one clause — the merged cue inherits
  the start of the first and the end of the second.
- Target 3–8 seconds per cue. Cues shorter than ~1.5s feel choppy on
  screen; cues longer than ~10s usually contain a missed punctuation
  break.

A typical 2–3 minute talk yields roughly 25–40 punct-bounded cues
from 12–18 raw Whisper cues. This is normal — don't try to keep the
original cue count.

When TTS dubbing follows: the punctuation-bounded structure means
each TTS clip is a complete utterance with proper end-intonation, and
concatenating clips sounds natural because every join is at a real
pause point.

---

### Step 4: Generate Chinese SRT

Generate a valid `.srt` subtitle file.

SRT format:

```text
1
00:00:01,200 --> 00:00:04,800
中文字幕内容

2
00:00:04,800 --> 00:00:08,500
中文字幕内容
```

SRT rules:

- Number subtitles sequentially starting from `1`.
- Use this timestamp format: `HH:MM:SS,mmm`.
- Use comma milliseconds, not period milliseconds.
- Do not overlap timestamps.
- Preserve the original timing unless adjustment is necessary.
- Each subtitle should usually be 1–2 lines.
- Keep each Chinese line readable.
- Prefer no more than about 18–22 Chinese characters per line when possible.
- If one subtitle is too long, split it into shorter subtitles when timing allows.
- Do not add commentary inside the subtitle file.

---

## Chinese-Only Subtitle Output

Default output should be Chinese-only SRT:

```text
1
00:00:01,200 --> 00:00:04,800
没关系。

2
00:00:04,800 --> 00:00:08,500
我们看看会发生什么。
```

---

## Bilingual Subtitle Output

If the user asks for bilingual subtitles, use Spanish on the first line and Chinese on the second line:

```text
1
00:00:01,200 --> 00:00:04,800
No pasa nada.
没关系。

2
00:00:04,800 --> 00:00:08,500
Vamos a ver qué pasa.
我们看看会发生什么。
```

Rules for bilingual subtitles:

- Keep Spanish first.
- Keep Chinese second.
- Preserve timing.
- Avoid adding extra explanations unless requested.
- Keep both lines short enough to read.

---

## Subtitle Quality Rules

Before final output, verify:

- Subtitle numbers are sequential.
- Timestamps are valid.
- Milliseconds use commas.
- No subtitle time ranges overlap.
- Chinese translation is natural.
- Chinese subtitle length is readable.
- Speaker tone is preserved.
- Proper nouns are accurate.
- Unclear audio is marked honestly.
- No missing subtitle blocks.
- No invented content.

---

## Handling Unclear Audio

If audio is unclear:

- Do not guess aggressively.
- Use `[inaudible]` for completely unintelligible words.
- Use `[unclear]` only when part of the speech is uncertain.
- Mention uncertain sections after the SRT output.

Example note:

```text
Uncertain sections:
- 00:01:23–00:01:26: background noise makes the Spanish partly unclear.
- 00:03:10–00:03:13: speaker mentions a name that may be misspelled.
```

Do not put long uncertainty explanations inside the subtitle file unless the user asks.

---

## Output Formats

Depending on the user request, provide one or more of the following:

1. Chinese-only `.srt`
2. Spanish-Chinese bilingual `.srt`
3. Chinese transcript without timestamps
4. Side-by-side Spanish/Chinese table
5. Soft-muxed `.mp4` (togglable Chinese subtitle track)
6. Hardcoded burn-in `.mp4` (always-visible Chinese subtitles)
7. Chinese voice dub `.mp4`, with three audio modes:
   - dub-only (replaces Spanish audio)
   - dub + Spanish bed (Chinese 100%, Spanish at 15–25%)
   - dub + burned-in subtitles + Spanish bed (full localized cut)

Default output:

- Chinese-only `.srt`
- A short uncertainty note if needed

If the user already has the subtitle file and asks for dub or burn-in,
go straight to that — don't regenerate the SRT.

---

## Subtitle Output Modes

There are two ways to attach the SRT to the video. Pick based on what
the user is doing with the file.

### Soft-mux (togglable subtitle track)

Player apps (QuickTime, VLC, IINA, mobile players) can show/hide.
Works with any `ffmpeg` build — does **not** need libass:

```bash
ffmpeg -i input.mp4 -i input.zh-CN.srt \
  -map 0:v -map 0:a -map 1:0 \
  -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=zho -metadata:s:s:0 title="中文" \
  output.mp4
```

### Hardcoded burn-in (always visible)

Required for WeChat/抖音/朋友圈 etc. where the player will not honor
embedded subtitle tracks. Needs an `ffmpeg` built with libass.

**Verify libass is available before promising burn-in:**

```bash
ffmpeg -filters 2>&1 | grep -E "subtitles|^.. ass "
```

If neither `subtitles` nor `ass` shows up, the build lacks libass.
Homebrew's default `ffmpeg` formula is often stripped (no
`--enable-libass`, no `--enable-libfreetype`, no `drawtext`). Don't
waste time fighting the comma-escaping inside `force_style` — it will
fail with `No such filter: 'subtitles'` no matter how the shell quotes
it.

**Fastest fix on macOS — drop in a static build, no system changes:**

```bash
curl -fsSL -o /tmp/ff.zip https://evermeet.cx/ffmpeg/getrelease/zip
unzip -o /tmp/ff.zip -d /tmp/ff_bin >/dev/null
FF=/tmp/ff_bin/ffmpeg
$FF -version | grep -oE -- "--enable-(libass|libfreetype)"
```

Then use `$FF` instead of `ffmpeg` for the render. The brew binary is
fine for everything else (probe, audio extraction, soft-mux).

**Burn-in render with style overrides.**

🛑 **Checkpoint — confirm before full-render.** Burn-in re-encodes the
entire video (minutes of CPU on a 5-min clip). Before kicking it off:

1. Render only the first 30s with `-t 30` for a fast preview.
2. Extract a frame from the longest-line cue (see Fontsize calibration
   below) and Read it.
3. Show the user the preview frame + the cue text, ask: "字号/字体/边距
   OK 吗？OK 才跑全片。" Wait for explicit confirmation.

Skip the checkpoint only if the user has already approved a full render
of this exact video at this exact font config in the same conversation.

```bash
$FF -i input.mp4 \
  -vf "subtitles=input.zh-CN.srt:force_style='Fontname=PingFang SC\,Fontsize=12\,PrimaryColour=&H00FFFFFF\,OutlineColour=&H00000000\,BorderStyle=1\,Outline=2\,Shadow=1\,MarginL=20\,MarginR=20\,MarginV=40'" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a copy output.mp4
```

Inside `force_style`, escape every comma as `\,` (the filter graph
parser eats the bare comma as a chain separator). All other special
chars are fine.

#### Fontsize calibration — critical

libass scales its internal PlayRes up to the actual video resolution.
The number you pass is **not pixels** in the output. As a starting
calibration on a 544×960 vertical phone video, `Fontsize=22` rendered
each Chinese character at ~55px wide and overflowed the frame, while
`Fontsize=12` rendered at ~30–35px wide and fit cleanly with 15-char
lines.

Rule of thumb: start at `Fontsize=12`, render, then **always**
extract a frame and look:

```bash
$FF -ss 30 -i output.mp4 -frames:v 1 /tmp/frame.png -y
# then Read /tmp/frame.png to verify the longest-line cue fits
```

Pick a timestamp that lands on the cue with the most characters per
line — short lines won't expose overflow. Add `MarginL=20 MarginR=20`
as a safety inset; never trust default left/right margins.

#### Style cheatsheet

Keys that matter (libass `force_style`):

- `Fontname=PingFang SC` — macOS default CJK; alternates: `Songti SC`,
  `Heiti SC`, `STHeiti`, `Hiragino Sans GB`.
- `Fontsize=12` — start small, scale up only after frame check.
- `PrimaryColour=&H00FFFFFF` — white text (BBGGRR + alpha).
- `OutlineColour=&H00000000` — black outline.
- `BorderStyle=1` — outline only (clean over varied backgrounds).
  Use `BorderStyle=3` for an opaque box behind text when the
  background is busy.
- `Outline=2` — 2px outline thickness.
- `Shadow=1` — subtle drop shadow.
- `MarginL=20 MarginR=20` — keep text inside the frame.
- `MarginV=40` — vertical distance from the bottom edge.

#### SRT line-length discipline for burn-in

Even with correct `Fontsize`, lines that are too long will wrap or
overflow. Keep each on-screen line ≤ ~15 Chinese characters. Use
explicit `\n` line breaks inside the SRT block — do not rely on
auto-wrapping. Two short lines beat one long one every time.

---

## Chinese Voice Dubbing

When the user wants the video to actually **speak Chinese** (not just
display Chinese subtitles), generate a TTS dub aligned to the original
SRT timing.

### Engine choice — Volcano (preferred) or edge-tts (fallback)

For Mandarin dubbing, the preferred engine is **Volcano (字节跳动豆包)
TTS 2.0** — the voices are markedly more natural than edge-tts,
especially for emotional/contemplative content. It needs paid
credentials. Use edge-tts when you don't have Volcano access or while
debugging.

The bundled `dub.py` auto-routes by voice-ID prefix:

- Voice starts with `zh_…_bigtts` → Volcano TTS 2.0
- Voice starts with `zh-CN-…Neural` (or any locale + `…Neural`) →
  edge-tts

#### Volcano TTS — Chinese only

Endpoint: `https://openspeech.bytedance.com/api/v3/tts/unidirectional`
(used for both TTS 1.0 and 2.0; the Resource-Id header picks the
backend).

Headers:

```
X-Api-App-Id:       (env: VOLC_TTS_APPID)         # 10-digit speech App ID
X-Api-Access-Key:   (env: VOLC_TTS_ACCESS_TOKEN)  # 32-char token from speech console
X-Api-Resource-Id:  volc.service_type.10029       # see resource ID note below
Content-Type:       application/json
```

Loading the credentials: most users keep them in `~/code/.env`. Read
them at the top of any session that needs them via:

```bash
set -a; source ~/code/.env; set +a
```

**Resource ID — important quirk.** The doc lists `seed-tts-2.0` as
the "TTS 2.0 (recommended)" resource, but a typical TTS-SeedTTS2.0
console instance does **not** include the popular `*_bigtts` speaker
catalog (爽快斯斯, 高冷御姐, 开朗姐姐, etc.). Trying those speakers
against `seed-tts-2.0` returns `200 code=55000000 "resource ID is
mismatched with speaker related resource"`. The fix is to use
`volc.service_type.10029` (the TTS 1.0 V3 endpoint) — the audio
quality of the bigtts speakers is identical, and they all work
against this resource. The bundled `dub.py` defaults to
`volc.service_type.10029`; override with `VOLC_TTS_RESOURCE` env if
you have a different instance.

Other 401/403 errors:

- `401 code=45000010 "load grant: requested grant not found in SaaS
  storage"` — the App ID + key combo is valid against the gateway,
  but the user has not activated this resource. They must go to
  火山引擎 → 语音技术 → 语音合成大模型 → 实例管理 and 开通 the
  service. No workaround.
- `403 code=45000030` — the speaker isn't included in the user's
  instance bundle.

**Response format.** Despite the doc's casual language, the response
is **streaming NDJSON**, not a single JSON object and not raw audio
bytes. Each line is a separate JSON event with a base64-encoded MP3
chunk in `data`. The terminal event has `code: 20000000` (which
means OK in this API's success codes — different from `code: 0`).
Concatenate the decoded chunks for the full MP3.

```python
import base64, json, requests
audio = b""
r = requests.post(url, headers=h, json=payload, timeout=60, stream=True)
for line in r.iter_lines():
    if not line: continue
    evt = json.loads(line)
    if evt.get("code") not in (0, None, 20000000):
        raise RuntimeError(f"code={evt.get('code')} {evt.get('message')}")
    if evt.get("data"):
        audio += base64.b64decode(evt["data"])
```

**Speaker catalog (verified working under
`volc.service_type.10029`).** Full list at
volcengine.com/docs/6561/1257544 — but availability depends on your
instance bundle. Confirmed-working female voices for the typical
SeedTTS-2.0 starter instance:

| Speaker ID                                    | 中文名     | Feel                       |
| ---                                           | ---        | ---                        |
| `zh_female_gaolengyujie_moon_bigtts`          | 高冷御姐   | **Best for contemplative/spiritual content.** Mature, restrained, calm. |
| `zh_female_kailangjiejie_moon_bigtts`         | 开朗姐姐   | Warm older-sister storytelling. |
| `zh_female_shuangkuaisisi_moon_bigtts`        | 爽快斯斯   | Versatile, conversational baseline. |
| `zh_female_linjianvhai_moon_bigtts`           | 邻家女孩   | Casual, lifestyle-vlog. |
| `zh_female_yuanqinvyou_moon_bigtts`           | 元气女友   | Lively, upbeat. |
| `zh_female_meilinvyou_moon_bigtts`            | 美丽女友   | Soft, intimate. |
| `zh_female_shuangkuaisisi_emo_v2_mars_bigtts` | 斯斯情感版 | Full emotional range — pair with explicit emotion + scale. |

These voices return 55000000 against the typical instance even though
the doc lists them: `vv_uranus_bigtts`, `wenroushunv_moon_bigtts`,
`qingxin_moon_bigtts`, `yingmaoxiaoyuan_moon_bigtts`,
`tianxinxiaoling_moon_bigtts`, `shaoergushi_moon_bigtts`. Don't
promise them without testing.

**Audio params.** `speech_rate` is Volcano's native scale [-50, +100]
where the value is a percentage delta (so `-8` means 8% slower). The
script passes `--rate -8%` through as `-8`. Useful emotion presets:

- `emotion="calm"`, `emotion_scale=4` — contemplative, default for
  this skill's spiritual-content niche.
- `emotion="gentle"` — softer / more intimate.
- `emotion="neutral"` — flat / informational.
- `emotion="sad"` — melancholic. Use sparingly.

Override the script's defaults with `VOLC_TTS_EMOTION` and
`VOLC_TTS_EMOTION_SCALE` env vars without editing code.

**No English Volcano voices** are wired up in this skill — for
English use edge-tts (next section). Volcano does have English
speakers (`en_male_*_bigtts`, `en_female_*_bigtts`) but they aren't
typically included in TTS-SeedTTS-2.0 starter instances and they
were not validated for this workflow. Add them by extending the
voice routing in `dub.py` once verified.

#### edge-tts (Microsoft Edge neural TTS)

Free, no API key, high-quality but less expressive than Volcano.
Install into a project venv — **do not** call it via `uvx` once per
segment. Each `uvx` invocation spawns a fresh Python process and the
bing endpoint will rate-limit or RST the connection after a handful
of rapid hits, breaking mid-render.

```bash
uv venv .venv
uv pip install --python .venv/bin/python edge-tts
```

Then drive it from a single long-lived Python process using
`edge_tts.Communicate(...)` directly, with retry-on-failure logic. A
ready-to-run script lives at `scripts/dub.py` next to this SKILL.md;
copy it into the working directory and run:

🛑 **Checkpoint — sample before full dub.** A full-video dub is the
most expensive step (TTS API calls + atempo + ffmpeg mux). Before
running `dub.py` over the whole SRT:

1. Pick the longest-text cue (worst stretch case) and one
   short/casual cue (timbre check).
2. Synthesize 3–4 voice/rate/pitch combos at 3–8s each — see "Always
   sample before committing" below.
3. Show the user the audio panel and ask: "选哪个 voice？rate/pitch
   要调吗？确认后我再跑全片。" Wait for explicit pick.

Skip the checkpoint only if the user named a specific voice up front
AND has already heard a sample of that voice on this video.

```bash
.venv/bin/python dub.py [voice] [rate] [pitch]
# e.g. mature warm female, slower, lower pitch:
.venv/bin/python dub.py zh-CN-XiaoxiaoNeural -8% -10Hz
```

The script:

1. Reads the SRT (looks for `*.zh-CN.srt`-style filename — edit the
   constants at the top of the script).
2. Synthesizes one MP3 per cue under `dub_work/seg_NN.mp3`.
3. Probes each clip's actual duration with `ffprobe`.
4. For each cue: if TTS is longer than the SRT slot, chains `atempo`
   filters to speed it up; if shorter, pads with silence after.
5. Inserts silence segments for SRT gaps and any trailing tail so the
   output audio length exactly matches the source video.
6. Muxes the new audio into a `*_zh_dub.mp4` keeping the original
   video stream by `-c:v copy`.

### Voice selection — match the original speaker

This is the part that "尽量匹配原声" hinges on. There is no perfect
match across language — choose gender, age feel, and tone
deliberately, then bend with rate/pitch.

#### Chinese voices (Volcano preferred, edge-tts fallback)

Volcano's `zh_female_gaolengyujie_moon_bigtts` (高冷御姐, calm,
`speech_rate=-8`) is the validated baseline for mature contemplative
female speakers — equivalent to or better than any edge-tts option
for that profile. See the Volcano speaker table above for the rest.

If Volcano isn't available, edge-tts catalog:

| Voice                              | Gender | Default feel                  |
| ---                                | ---    | ---                           |
| `zh-CN-XiaoxiaoNeural`             | F      | Warm, news/novel              |
| `zh-CN-XiaoyiNeural`               | F      | Lively, young                 |
| `zh-CN-YunjianNeural`              | M      | Passionate, sports            |
| `zh-CN-YunxiNeural`                | M      | Sunshine, lively              |
| `zh-CN-YunyangNeural`              | M      | Professional newsreader       |
| `zh-HK-HiuMaanNeural`              | F      | Friendly, slightly mature     |

#### English voices (edge-tts neural, all multilingual)

For English dubbing, use edge-tts. All voices below speak fluent
American/British/Australian English; the `*Multilingual*` ones also
handle Spanish names, French/Italian loanwords, etc. without
mispronunciation.

| Voice                                  | Gender | Default feel                            |
| ---                                    | ---    | ---                                     |
| `en-US-AvaMultilingualNeural`          | F      | **Best for warm/mature/caring** — natural for spiritual or coaching content |
| `en-US-EmmaMultilingualNeural`         | F      | Cheerful, conversational, younger        |
| `en-US-AndrewMultilingualNeural`       | M      | Warm, confident, sincere                 |
| `en-US-BrianMultilingualNeural`        | M      | Approachable, casual                     |
| `en-US-AriaNeural`                     | F      | Crisp newsreader                         |
| `en-US-GuyNeural`                      | M      | Steady male newsreader                   |
| `en-GB-SoniaNeural`                    | F      | British female (RP)                      |
| `en-GB-RyanNeural`                     | M      | British male (RP)                        |
| `en-AU-WilliamMultilingualNeural`      | M      | Australian male                          |
| `fr-FR-VivienneMultilingualNeural`     | F      | Mature European female who also reads English |

For matching a mature contemplative Spanish female (this skill's
canonical use case), start with `en-US-AvaMultilingualNeural` at
`--rate -5% --pitch -3Hz`. Do **not** use the news-style `Aria` or
`Guy` for spiritual content — they sound clinical.
| `zh-TW-HsiaoChenNeural`            | F      | Friendly                      |
| `en-US-AvaMultilingualNeural`      | F      | Caring, expressive (Western)  |
| `fr-FR-VivienneMultilingualNeural` | F      | Mature European female        |

Picking heuristics:

- **Mature contemplative female speaker (yoga/spirituality/coaching):**
  `zh-CN-XiaoxiaoNeural` with `--rate=-8% --pitch=-10Hz` is the most
  reliable starting point — drops the youthful brightness, slows it
  to a breathy pace.
- **Mature professional male:** `zh-CN-YunyangNeural` with
  `--rate=-5%`. Avoid Yunjian/Yunxi (too energetic).
- **Young casual speaker:** Defaults; no pitch shift.
- **Western-mouth feel** (sometimes preferred for foreign content):
  one of the `*MultilingualNeural` voices. They're trained on
  multiple languages and often have a less "TV anchor" timbre.

### Always sample before committing

Don't render the full dub on a guess. Generate the **same cue** with
3–4 voice/parameter combos at 3–8 seconds each, and have the user pick
A/B/C/D. Keeping samples under 10 seconds each lets the user audition
the entire panel in under a minute. After picking, re-run `dub.py`
with the chosen flags.

The skill's `scripts/sample_voices.py` (if present) is a thin wrapper
that does exactly this; otherwise just drive the same Python loop the
dub script uses.

### Filling awkward silences (Chinese is denser than Spanish)

Mandarin typically takes 60–80% of the time Spanish does to say the
same thing. With strict cue-by-cue timing, that leaves awkward 2–4s
silences at the end of most cues. Three levers, in increasing impact:

1. **Slow the native TTS rate.** Changing `--rate` from `+0%` to
   `-12%` to `-15%` produces clean, natural-sounding slower speech
   (much better than time-stretching afterward). Try `-12%` first;
   `-15%`/`-20%` for very contemplative content.

2. **Mild slow-stretch per cue.** When a cue's TTS is still shorter
   than its slot, run `atempo` between 0.82× and 0.95×. The bundled
   `dub.py` does this automatically: when slack > 0.5s, it sets
   `atempo = max(0.82, tts_dur / target_dur)` and pads the remainder.
   Below 0.82× the voice starts sounding drugged; above 0.92× the
   stretch is essentially imperceptible.

3. **Expand the Chinese in the worst cues.** When the slot is so
   long that even 0.82× stretch leaves >2s of silence, the cleanest
   fix is to lengthen the translation. Add natural Mandarin
   particles ("嗯，", "其实", "也就是说", "你知道") or unpack a
   compressed phrase into its full meaning. This changes the
   on-screen subtitle, so confirm with the user before doing it.
   Edit the SRT, regenerate just those segments by deleting their
   `dub_work/seg_NN.mp3` and re-running `dub.py`.

Combine the levers: native rate `-12%` + stretch-to-fit handles ~80%
of cases. Reserve text expansion for the 2–3 worst outliers.

### Audio mixing — keep the original as a bed

A pure dub-only track sounds dubbed (because it is). Mixing the
original Spanish at low volume under the Chinese dub gives the
"professional translation" feel — you still hear the speaker's breath,
emphasis, and laughter, just under the Mandarin.

```bash
$FF -i original.mp4 -i dub.mp4 \
  -filter_complex "[0:a]volume=0.18[orig];\
                   [1:a]volume=1.0[dub];\
                   [orig][dub]amix=inputs=2:duration=longest:normalize=0[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k mixed.mp4
```

Reasonable starting volumes:

- Spanish bed at `0.15`–`0.25` (≈ −16 to −12 dB)
- Chinese dub at `1.0`
- Use `normalize=0` so amix doesn't auto-attenuate when both are
  active.

### Combining dub + burn-in + bed (the full job)

One ffmpeg call does all three at once — burn the Chinese subtitle
onto the video stream and mix the two audio tracks:

```bash
$FF -i original.mp4 -i dub.mp4 \
  -filter_complex "[0:v]subtitles=input.zh-CN.srt:force_style='Fontname=PingFang SC\,Fontsize=12\,PrimaryColour=&H00FFFFFF\,OutlineColour=&H00000000\,BorderStyle=1\,Outline=2\,Shadow=1\,MarginL=20\,MarginR=20\,MarginV=40'[v];\
                   [0:a]volume=0.18[orig];[1:a]volume=1.0[dub];\
                   [orig][dub]amix=inputs=2:duration=longest:normalize=0[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k final.mp4
```

This is the "ship to social media" final cut.

---

## File Naming

Derive everything from the source video's stem. BCP-47-style suffixes
make the target language obvious at a glance and keep multiple
target-language outputs side-by-side.

```text
input:                       entrevista.mp4

Chinese pipeline:
  whisper Spanish SRT        entrevista.srt
  Chinese SRT                entrevista.zh-CN.srt
  Chinese dub (audio only)   entrevista_zh_dub.mp4
  Chinese final (subs+dub)   entrevista_zh_final.mp4

English pipeline:
  English SRT                entrevista.en.srt
  English dub                entrevista_en_dub.mp4
  English final              entrevista_en_final.mp4

Bilingual subtitles:
  Spanish + Chinese          entrevista.es-zh.srt
  Spanish + English          entrevista.es-en.srt
  three-language             entrevista.es-zh-en.srt
```

When only one target language is in play, `*_final.mp4` without a
language tag is acceptable (matches the existing project examples).
Adopt the `_zh_` / `_en_` infix the moment a project produces both.

---

## Important Constraints

- Do not hallucinate unclear Spanish.
- Do not summarize unless the user asks.
- Do not remove important details.
- Do not invent timestamps.
- Do not change the meaning to make it sound smoother.
- Do not over-explain inside subtitles.
- Do not translate proper nouns incorrectly.
- Do not use Traditional Chinese unless requested.
- Do not output invalid SRT syntax.
- Do not include markdown code fences inside the final `.srt` file if creating an actual file.
- Do not promise burn-in without first verifying the available
  `ffmpeg` was built with libass. If it wasn't, switch to soft-mux or
  pull a static build to `/tmp` rather than reinstalling system
  ffmpeg.
- Do not commit a burned-in render without extracting at least one
  frame at a long-line cue and visually confirming text is fully on
  screen.
- Do not dub by calling `uvx edge-tts` per cue — use the persistent
  Python library path with retries or the API will RST mid-render.
- Mild slow-stretch (`atempo` between **0.82× and 0.95×**) is fine and
  often necessary — both Mandarin and English tend to finish faster
  than Spanish, leaving awkward dead air. English may be marginally
  shorter than Spanish (~85%); Chinese is much shorter (~65%). Cap
  at 0.82×; below that the voice sounds drugged. Do not stretch when
  the slack is under ~0.5s (a short tail pause sounds natural).
- Don't promise a Volcano voice without checking it works against the
  user's instance. The doc lists many voices that error with
  `code=55000000 "resource ID is mismatched with speaker related
  resource"` against typical SeedTTS-2.0 starter bundles. The skill's
  Volcano speaker table marks which are confirmed-working. **Mandatory
  smoke test before promising any Volcano voice on a new account:**
  synth one ~5-word cue with that speaker ID first; only quote it to
  the user if the smoke test returns a non-empty MP3. If the smoke
  test 401s with `code=45000010` ("grant not found"), tell the user
  they need to 开通 the resource in 火山引擎 console — do not pretend
  it'll work after a retry.
- For the Volcano endpoint, parse the response as **streaming
  NDJSON**, not a single JSON document. The success terminator is
  `code=20000000`, not `code=0`. Concatenate base64-decoded `data`
  chunks for the full MP3.
- **Default to one voice for the whole video.** Do not run
  diarization, do not tag cues with `[A]`/`[B]`, and do not bring
  up multi-speaker complexity unless the user explicitly says the
  source has multiple speakers. Adding speaker separation later is
  a quick re-run; shipping confused multi-voice output by default
  wastes the user's time. The "Advanced: Multi-speaker dubbing"
  section is opt-in only.

---

## Advanced: Multi-speaker dubbing (opt-in)

**Only invoke this section when the user explicitly says the source
has multiple speakers** ("interview", "two people", "dialogue",
"separate the speakers", "different voice for each", or a direct
request to do diarization). For everything else, use one voice and
skip this section.

When triggered, generate the dub with a different voice per speaker
so the listener can follow who's speaking. Two paths:

### Path 1 (recommended for on-camera speakers): visual diarization

`scripts/visual_diarize.py` watches mouth movement per face per
frame and tags each cue with the dominant speaker. Self-contained,
no API keys, no audio fingerprinting.

```bash
uv pip install --python .venv/bin/python mediapipe opencv-python

.venv/bin/python scripts/visual_diarize.py \
    --video input.mp4 --srt input.en.srt \
    --out input.en.diarized.srt \
    --report diarization_report.json \
    --sample-fps 5 --num-speakers 2
```

How it works:

1. Samples N frames per second (default 5).
2. Runs MediaPipe FaceLandmarker (Tasks API) for up to
   `--num-speakers` faces per frame, 478 landmarks each.
3. Measures mouth aperture per face as the vertical distance between
   inner upper lip (idx 13) and inner lower lip (idx 14).
4. Bins faces by horizontal screen position (x-quantiles) → speakers
   `A`, `B`, ... left-to-right.
5. For every cue's [start, end] window, integrates per-speaker
   frame-to-frame mouth-aperture change. Highest mover wins the tag.
6. Writes a `[A]`/`[B]`-prefixed SRT plus a JSON report with
   per-cue scores and a confidence ratio (winner / runner-up).

On first run, downloads the FaceLandmarker model (~3.6 MB) to
`/tmp/mp_models/face_landmarker.task`.

**Visual is materially better than guessing from text.** In one
validation, manual text-based labels split 6/50 between speakers;
visual diarization showed the actual split was 29/27 — text-based
guessing was wildly wrong because both people take similar-shaped
turns. Always prefer visual when the speakers are on camera.

**Spot-check low-confidence cues.** Any cue in the JSON report with
`confidence_ratio < 1.5` is borderline — usually overlapping speech
or one speaker briefly off-frame. Hand-correct before dubbing.

### Path 2 (fallback): manual tagging

For very short clips (1–2 minutes), or when speakers are off-camera,
or when visual diarization fails:

```text
1
00:00:00,000 --> 00:00:03,400
[A] So what about that AI rewrite thing?

2
00:00:03,400 --> 00:00:08,200
[B] Right — let me explain the workflow.
```

Save as `*.tagged.srt`. Keep the **clean** SRT (without tags) for
subtitle burn-in.

### Routing voices in dub.py

Pass `--voice-map` with `speaker=voice` pairs. The positional voice
arg is the default for cues with no tag.

```bash
.venv/bin/python scripts/dub.py en-US-AndrewMultilingualNeural -3% +0Hz \
    --srt input.en.tagged.srt \
    --voice-map "A=en-US-BrianMultilingualNeural,B=en-US-AndrewMultilingualNeural"
```

Voice-pairing tips:

- **Two of the same gender:** pick voices with audibly different
  timbre. Brian (casual) + Andrew (warm) works for two American
  males. Ava (warm female) + Emma (cheerful female) for two females.
- **Mixed gender:** Ava + Andrew is a clean default.
- **Accent contrast:** pair `en-US-` and `en-GB-` for distinctness.
- **Chinese:** mix Volcano voices like
  `zh_female_gaolengyujie_moon_bigtts` (mature) +
  `zh_female_kailangjiejie_moon_bigtts` (warm sister).

### Rendering with multi-speaker dub

Use the **clean** SRT for `render.py --srt` so `[A]`/`[B]` tags
don't appear on screen:

```bash
.venv/bin/python scripts/render.py \
    --video input.mp4 \
    --srt input.en.srt              \  # CLEAN, for burn-in
    --dub input_en_dub.mp4          \  # contains the per-speaker voices
    --out input_en_final.mp4
```

### Limits

Visual diarization fails when:

- A speaker is consistently off-camera while talking.
- Camera cuts or zooms make face position unstable across cues.
- Three or more speakers sit at similar horizontal positions
  (x-quantile binning is too coarse — switch to k-means on (x, y)
  or use audio-based diarization instead).

For audio-only material (podcasts, voice-overs), fall back to
`pyannote.audio` or `whisperx --diarize`. This skill does not yet
bundle audio-based diarization — file an issue or PR if you need it.

---

## Default Final Response

When the task is complete, respond briefly. Match the user's language
and use the target-language tag in the summary.

For Chinese:

```text
已完成：
- 西班牙语转写
- 中文翻译
- 中文字幕 SRT 文件
（如有：中文配音、烧入字幕、原声底层）

不确定片段：
- 00:01:23–00:01:26 背景噪音较大，原文可能不完全准确。
```

For English:

```text
Done:
- Spanish transcript
- English translation
- English subtitle SRT
  (plus: English dub, burned-in subs, Spanish bed if produced)

Uncertain segments:
- 00:01:23–00:01:26 background noise; source partially unclear.
```

If there are no uncertain parts, drop the second list.
