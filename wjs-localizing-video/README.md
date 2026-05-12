# translate-video

A [Claude Code](https://docs.claude.com/claude-code) skill for end-to-end
video localization: transcribe spoken audio in any source language,
translate into a target language, generate punctuation-bounded subtitles,
optionally burn them into the video, and optionally produce a
time-aligned voice dub — with the original audio preserved as a
low-volume bed if desired.

Built and validated on **Spanish → Chinese** and **Spanish → English**;
the same pipeline works for any source language Whisper recognizes
and any target language with an available TTS voice.

## What it does

Given a video file:

1. **Transcribe** — `openai-whisper` produces a source-language SRT.
2. **Translate** — Claude rewrites it into the target language at
   the same timestamps, then re-segments at punctuation boundaries
   so no cue ends mid-sentence.
3. **Dub** (optional) — TTS generates one MP3 per cue, atempo-fits
   each clip to its time slot, fills gaps with silence, and muxes a
   complete audio track that exactly matches video length.
4. **Render** (optional) — burns the subtitles into the video using
   libass and mixes the original audio at a configurable low volume
   under the dub.

## Why this exists

Most "subtitle generators" stop at SRT. Most "TTS dubbers" don't
align to original timing. This skill chains both with the small
quality details that make output actually shippable to social media:

- Cues split at punctuation, not at Whisper's silence/breath
  detection (which routinely cuts mid-clause and makes any TTS
  sound choppy).
- Mild time-stretch (`atempo` 0.82–0.95×) when target speech is
  shorter than source — fills awkward dead air without sounding
  drugged.
- Original audio kept as a 15–25% bed under the dub gives a
  professional "translated" feel rather than a robotic voiceover.
- Subtitle Fontsize calibrated against actual rendered output,
  not nominal libass units.
- Auto-fetches a libass-enabled static ffmpeg if the system one
  is stripped (Homebrew's default is).

## Repo layout

```
translate-video/
├── SKILL.md             # Full instructions for Claude (loaded as a skill)
├── README.md            # This file
├── LICENSE              # MIT
└── scripts/
    ├── dub.py           # TTS + per-cue time-alignment + per-speaker voices
    ├── render.py        # Burn subtitles + mix audio + final cut
    └── visual_diarize.py  # Mouth-movement speaker diarization (MediaPipe)
```

## Optional: multi-speaker dubbing (advanced)

By default, the pipeline uses **one voice for the whole video** —
that's the right choice for the overwhelming majority of clips
(monologues, vlogs, talks, narration). Skip this section unless the
source actually has multiple speakers and you want a different voice
per person.

When you do need multi-speaker dubbing, two paths to assign cues to
speakers:

1. **Visual diarization (recommended for on-camera speakers).** Runs
   MediaPipe on the video, watches whose mouth moves during each
   cue, tags the SRT with `[A]`/`[B]`/...

   ```bash
   uv pip install --python .venv/bin/python mediapipe opencv-python
   .venv/bin/python scripts/visual_diarize.py \
       --video in.mp4 --srt in.en.srt --out in.en.diarized.srt \
       --report report.json --sample-fps 5
   ```

2. **Manual tagging.** Edit the SRT directly to add `[A]`/`[B]`
   prefixes. Faster for very short clips, but text-based guessing
   about "who would say this" is often wrong — visual is more
   reliable when speakers are visible.

Then route voices in `dub.py`:

```bash
.venv/bin/python scripts/dub.py en-US-AndrewMultilingualNeural -3% +0Hz \
    --srt in.en.diarized.srt \
    --voice-map "A=en-US-BrianMultilingualNeural,B=en-US-AndrewMultilingualNeural"
```

`render.py` always uses the **clean** SRT (no tags) for burn-in, so
the on-screen text doesn't show `[A]`/`[B]` labels.

## Install as a Claude Code skill

```bash
git clone https://github.com/jianshuo/translate-video.git \
    ~/.claude/skills/translate-video
```

Restart Claude Code. The skill registers as `translate-video` and
fires when you ask to translate a video, generate subtitles,
generate a dub, etc.

## Use the scripts directly

You don't need Claude Code to use the scripts — they are standalone
Python.

### Setup

```bash
# In the project folder where your video lives
uv venv .venv
uv pip install --python .venv/bin/python edge-tts requests
```

For Volcano TTS (豆包) Chinese voices, set credentials:

```bash
# Get from 火山引擎 → 语音技术 → 语音合成大模型
export VOLC_TTS_APPID=your_speech_app_id
export VOLC_TTS_ACCESS_TOKEN=your_speech_access_token
```

### 1. Transcribe

```bash
ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le _audio.wav -y
uvx --from openai-whisper whisper _audio.wav \
    --language es --task transcribe \
    --model small --output_format srt --output_dir .
rm _audio.wav
```

### 2. Translate

Hand the SRT to Claude (or any LLM) with the principles in
`SKILL.md` (sentence-bounded cues, line-length limits per language,
no filler demonstratives in Chinese). Save as
`input.zh-CN.srt` or `input.en.srt`.

### 3. Dub

Auto-detects video and SRT in the working directory.

```bash
# Chinese — Volcano (high-quality)
.venv/bin/python dub.py zh_female_gaolengyujie_moon_bigtts -8% +0Hz

# Chinese — edge-tts fallback (no API keys)
.venv/bin/python dub.py zh-CN-XiaoxiaoNeural -8% -10Hz

# English — edge-tts neural
.venv/bin/python dub.py en-US-AvaMultilingualNeural -5% -3Hz \
    --srt input.en.srt
```

Voice routing:

- Voice matches `zh_*_bigtts` → Volcano TTS 2.0
- Anything else → edge-tts (neural multilingual)

Outputs `<stem>_zh_dub.mp4` or `<stem>_en_dub.mp4` (audio-replaced video).

### 4. Render the final cut

```bash
# Burned subs + dub + 18% original-audio bed
.venv/bin/python render.py \
    --video input.mp4 \
    --srt input.zh-CN.srt \
    --dub input_zh_dub.mp4 \
    --out input_zh_final.mp4
```

All knobs are flags:

```bash
.venv/bin/python render.py --help
```

Common ones:

- `--font 'PingFang SC'` (Chinese) or `'Helvetica'` (English)
- `--fontsize 12` (calibrate per video — extract a frame and check)
- `--margin-v 40` (distance from bottom)
- `--style outline|box` (outline-only vs opaque box behind text)
- `--bed-volume 0.18` (original audio gain when dubbed)
- `--no-original-audio` (drop original entirely)
- `--copy-video` (skip subtitle burn-in even if --srt is given)

### One-shot: subs only, dub only, or full final

```bash
# Subs only — burn subtitles, keep original audio as-is
render.py --video in.mp4 --srt in.zh-CN.srt --out out.mp4

# Dub only — replace audio, no burned subs (video stream copied)
render.py --video in.mp4 --dub in_zh_dub.mp4 \
          --no-original-audio --copy-video --out out.mp4

# Full final
render.py --video in.mp4 --srt in.zh-CN.srt --dub in_zh_dub.mp4 \
          --out out.mp4
```

## Volcano TTS notes

The skill is wired for the Chinese 豆包 (Doubao) TTS 2.0 service
because it produces noticeably more natural Mandarin than edge-tts,
especially for emotional/contemplative content.

Two gotchas that cost an hour of debugging during validation, baked
into the script defaults so you don't hit them:

1. **Resource ID quirk.** A typical TTS-SeedTTS-2.0 console instance
   does not actually grant access to the popular `*_bigtts` speaker
   catalog under resource `seed-tts-2.0`. It does grant access under
   `volc.service_type.10029` (the V3 endpoint with TTS 1.0 routing).
   The script defaults to that resource. Override with the
   `VOLC_TTS_RESOURCE` env var if your instance is configured
   differently.

2. **Streaming NDJSON response.** Despite the doc's casual language,
   the V3 unidirectional endpoint returns a chunked stream of JSON
   events, not a single response. Each line carries a base64-encoded
   MP3 fragment in `data`; concatenate them all. The terminator code
   is `20000000` (success), not `0`.

Verified-working female voices on a typical SeedTTS-2.0 starter
instance:

| Speaker ID                                    | 中文名     | Best for                |
| ---                                           | ---        | ---                     |
| `zh_female_gaolengyujie_moon_bigtts`          | 高冷御姐   | Mature, calm, contemplative |
| `zh_female_kailangjiejie_moon_bigtts`         | 开朗姐姐   | Warm storytelling       |
| `zh_female_shuangkuaisisi_moon_bigtts`        | 爽快斯斯   | Versatile baseline      |
| `zh_female_linjianvhai_moon_bigtts`           | 邻家女孩   | Casual lifestyle        |
| `zh_female_yuanqinvyou_moon_bigtts`           | 元气女友   | Lively, upbeat          |
| `zh_female_meilinvyou_moon_bigtts`            | 美丽女友   | Soft, intimate          |

The full doc lists more voices (`vv_uranus`, `wenroushunv`,
`qingxin`, etc.) but they fail with `code=55000000` against the
typical starter instance. Don't promise them without testing.

Tunable env vars:

```bash
VOLC_TTS_RESOURCE=volc.service_type.10029   # default
VOLC_TTS_EMOTION=calm                        # calm|gentle|neutral|sad|...
VOLC_TTS_EMOTION_SCALE=4                     # 1-5
```

## Requirements

- Python 3.10+
- `ffmpeg` — any version for transcribe/dub/probe; render.py
  auto-fetches a libass-enabled build if the active one is stripped.
- `openai-whisper` (run via `uvx`, no global install)
- `edge-tts` Python library (in venv)
- `requests` (in venv, for Volcano)

Optional:

- A Volcano speech-service App ID + Access Token (for Chinese dub
  quality)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

- [openai-whisper](https://github.com/openai/whisper) for transcription
- [edge-tts](https://github.com/rany2/edge-tts) for free neural TTS
- 火山引擎 (Volcano) [豆包语音合成](https://www.volcengine.com/docs/6561/1598757)
  for Mandarin voices
- [evermeet.cx](https://evermeet.cx/ffmpeg/) for libass-enabled static
  macOS ffmpeg builds
