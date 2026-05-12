---
name: wjs-dubbing-video
description: Use when the user has a video + a target-language SRT and wants the video to actually speak that language — generates a time-aligned TTS voice dub. Routes by voice ID — Volcano (豆包) TTS for Chinese, edge-tts neural for any language. Defaults to one voice (single-speaker); opt-in multi-speaker via visual diarization. Outputs `*_<lang>_dub.mp4` with the dub audio in place of the original. Final mixing (audio bed + burn-in) is handed off to `/wjs-burning-subtitles`. Triggers — "配音", "中文配音", "Chinese dub", "voice over this", "dub the video", "TTS this SRT", "different voice for each speaker".
---

# wjs-dubbing-video

Video + target-language SRT → `*_<lang>_dub.mp4` with a time-aligned TTS voice. **This skill stops at the dub track.** Burn-in + audio bed mixing is the next skill (`/wjs-burning-subtitles/render.py` composites everything in one final encode).

## When to use

- User has a target-language SRT (e.g., `entrevista.zh-CN.srt`) and wants the video to speak that language.
- User says "中文配音 / 配音 / 帮我做配音 / dub it / voice over".
- User has multiple speakers on camera and wants different voices per speaker.

## When NOT to use

- No SRT yet → run `/wjs-transcribing-audio` then `/wjs-translating-subtitles` first.
- Source-language only TTS (rare; usually you translate first) → still use this skill, but pass the source SRT.
- Burn-in only, no audio change → skip to `/wjs-burning-subtitles`.

## Number of speakers — default to one

**Default: assume one speaker.** Use a single voice for the entire dub. This is the right answer for monologues, vlogs, recorded talks, narrator-only clips, and the overwhelming majority of videos people ask about. Don't run diarization, don't tag the SRT with `[A]`/`[B]`, don't bring up multi-speaker complexity.

**Switch to multi-speaker only when the user explicitly says so** — phrasings like "two people", "interview", "dialogue", "conversation between", "separate the speakers", "different voice for each", or a direct request to do diarization. When triggered, follow the "Multi-speaker dubbing" section below.

If you're unsure whether a video is one speaker or many, ship the single-voice version first. Adding speaker separation later is cheap (just regenerate the dub); shipping confused multi-speaker output by default wastes the user's time.

## Engine routing — by voice ID

`scripts/dub.py` auto-routes by voice-ID prefix:

| Voice ID pattern | Engine | Auth |
|---|---|---|
| `zh_..._bigtts` | **Volcano (字节跳动豆包) TTS** | `VOLC_TTS_APPID` + `VOLC_TTS_ACCESS_TOKEN` |
| `zh-CN-...Neural` / `en-US-...Neural` / etc. | **edge-tts** (Microsoft Edge neural) | none (free) |

For Mandarin, Volcano is markedly more natural than edge-tts, especially for emotional/contemplative content. Use edge-tts when Volcano credentials aren't available or as a debugging fallback.

## Volcano TTS (Chinese only)

Endpoint: `https://openspeech.bytedance.com/api/v3/tts/unidirectional` (used for both TTS 1.0 and 2.0; the Resource-Id header picks the backend).

Headers:

```
X-Api-App-Id:       (env: VOLC_TTS_APPID)         # 10-digit speech App ID
X-Api-Access-Key:   (env: VOLC_TTS_ACCESS_TOKEN)  # 32-char token from speech console
X-Api-Resource-Id:  volc.service_type.10029       # see resource ID note below
Content-Type:       application/json
```

Loading credentials: most users keep them in `~/code/.env`. Read them at the top of any session via:

```bash
set -a; source ~/code/.env; set +a
```

### Resource ID — important quirk

The doc lists `seed-tts-2.0` as the "TTS 2.0 (recommended)" resource, but a typical TTS-SeedTTS2.0 console instance does **not** include the popular `*_bigtts` speaker catalog (爽快斯斯, 高冷御姐, 开朗姐姐, etc.). Trying those speakers against `seed-tts-2.0` returns `200 code=55000000 "resource ID is mismatched with speaker related resource"`. The fix is to use `volc.service_type.10029` (the TTS 1.0 V3 endpoint) — the audio quality of the bigtts speakers is identical, and they all work against this resource. The bundled `dub.py` defaults to `volc.service_type.10029`; override with `VOLC_TTS_RESOURCE` env if you have a different instance.

Other 401/403 errors:

- `401 code=45000010 "load grant: requested grant not found in SaaS storage"` — the App ID + key combo is valid against the gateway, but the user has not activated this resource. They must go to 火山引擎 → 语音技术 → 语音合成大模型 → 实例管理 and 开通 the service. No workaround.
- `403 code=45000030` — the speaker isn't included in the user's instance bundle.

### Response format

Despite the doc's casual language, the response is **streaming NDJSON**, not a single JSON object and not raw audio bytes. Each line is a separate JSON event with a base64-encoded MP3 chunk in `data`. The terminal event has `code: 20000000` (which means OK in this API's success codes — different from `code: 0`). Concatenate the decoded chunks for the full MP3.

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

### Speaker catalog (verified working under `volc.service_type.10029`)

Full list at volcengine.com/docs/6561/1257544 — but availability depends on your instance bundle. Confirmed-working female voices for the typical SeedTTS-2.0 starter instance:

| Speaker ID                                    | 中文名     | Feel                       |
| ---                                           | ---        | ---                        |
| `zh_female_gaolengyujie_moon_bigtts`          | 高冷御姐   | **Best for contemplative/spiritual content.** Mature, restrained, calm. |
| `zh_female_kailangjiejie_moon_bigtts`         | 开朗姐姐   | Warm older-sister storytelling. |
| `zh_female_shuangkuaisisi_moon_bigtts`        | 爽快斯斯   | Versatile, conversational baseline. |
| `zh_female_linjianvhai_moon_bigtts`           | 邻家女孩   | Casual, lifestyle-vlog. |
| `zh_female_yuanqinvyou_moon_bigtts`           | 元气女友   | Lively, upbeat. |
| `zh_female_meilinvyou_moon_bigtts`            | 美丽女友   | Soft, intimate. |
| `zh_female_shuangkuaisisi_emo_v2_mars_bigtts` | 斯斯情感版 | Full emotional range — pair with explicit emotion + scale. |

These voices return 55000000 against the typical instance even though the doc lists them: `vv_uranus_bigtts`, `wenroushunv_moon_bigtts`, `qingxin_moon_bigtts`, `yingmaoxiaoyuan_moon_bigtts`, `tianxinxiaoling_moon_bigtts`, `shaoergushi_moon_bigtts`. Don't promise them without testing.

### Audio params

`speech_rate` is Volcano's native scale [-50, +100] where the value is a percentage delta (so `-8` means 8% slower). The script passes `--rate -8%` through as `-8`.

Useful emotion presets:

- `emotion="calm"`, `emotion_scale=4` — contemplative, default for this skill's spiritual-content niche.
- `emotion="gentle"` — softer / more intimate.
- `emotion="neutral"` — flat / informational.
- `emotion="sad"` — melancholic. Use sparingly.

Override `dub.py` defaults with `VOLC_TTS_EMOTION` and `VOLC_TTS_EMOTION_SCALE` env vars without editing code.

**No English Volcano voices** are wired up in this skill — for English use edge-tts (next section). Volcano does have English speakers (`en_male_*_bigtts`, `en_female_*_bigtts`) but they aren't typically included in TTS-SeedTTS-2.0 starter instances. Add them by extending the voice routing in `dub.py` once verified.

## edge-tts (Microsoft Edge neural TTS)

Free, no API key, high-quality but less expressive than Volcano. Install into a project venv — **do not** call it via `uvx` once per segment. Each `uvx` invocation spawns a fresh Python process and the bing endpoint will rate-limit or RST the connection after a handful of rapid hits, breaking mid-render.

```bash
uv venv .venv
uv pip install --python .venv/bin/python edge-tts
```

Then drive it from a single long-lived Python process using `edge_tts.Communicate(...)` directly, with retry-on-failure logic. The bundled `scripts/dub.py` does this.

## Voice selection — match the original speaker

There is no perfect cross-language match — choose gender, age feel, and tone deliberately, then bend with rate/pitch.

### Chinese voices (Volcano preferred, edge-tts fallback)

Volcano's `zh_female_gaolengyujie_moon_bigtts` (高冷御姐, calm, `speech_rate=-8`) is the validated baseline for mature contemplative female speakers — equivalent to or better than any edge-tts option for that profile. See the Volcano speaker table above for the rest.

edge-tts catalog (Chinese):

| Voice                              | Gender | Default feel                  |
| ---                                | ---    | ---                           |
| `zh-CN-XiaoxiaoNeural`             | F      | Warm, news/novel              |
| `zh-CN-XiaoyiNeural`               | F      | Lively, young                 |
| `zh-CN-YunjianNeural`              | M      | Passionate, sports            |
| `zh-CN-YunxiNeural`                | M      | Sunshine, lively              |
| `zh-CN-YunyangNeural`              | M      | Professional newsreader       |
| `zh-HK-HiuMaanNeural`              | F      | Friendly, slightly mature     |
| `zh-TW-HsiaoChenNeural`            | F      | Friendly                      |

### English voices (edge-tts neural, all multilingual)

All voices below speak fluent American/British/Australian English; the `*Multilingual*` ones also handle Spanish names, French/Italian loanwords, etc. without mispronunciation.

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

For matching a mature contemplative Spanish female (this skill's canonical use case), start with `en-US-AvaMultilingualNeural` at `--rate -5% --pitch -3Hz`. Do **not** use the news-style `Aria` or `Guy` for spiritual content — they sound clinical.

### Picking heuristics

- **Mature contemplative female speaker (yoga/spirituality/coaching):** `zh-CN-XiaoxiaoNeural` with `--rate=-8% --pitch=-10Hz` (or Volcano `gaolengyujie`).
- **Mature professional male:** `zh-CN-YunyangNeural` with `--rate=-5%`. Avoid Yunjian/Yunxi (too energetic).
- **Young casual speaker:** Defaults; no pitch shift.
- **Western-mouth feel:** one of the `*MultilingualNeural` voices.

## Always sample before committing

🛑 **Checkpoint — sample before full dub.** A full-video dub is the most expensive step (TTS API calls + atempo + ffmpeg mux). Before running `dub.py` over the whole SRT:

1. Pick the longest-text cue (worst stretch case) and one short/casual cue (timbre check).
2. Synthesize 3–4 voice/rate/pitch combos at 3–8s each.
3. Show the user the audio panel and ask: "选哪个 voice？rate/pitch 要调吗？确认后我再跑全片。" Wait for explicit pick.

Skip the checkpoint only if the user named a specific voice up front AND has already heard a sample of that voice on this video.

The script's `scripts/sample_voices.py` (if present) is a thin wrapper for exactly this; otherwise drive the same Python loop the dub script uses.

**Mandatory smoke test before promising any Volcano voice on a new account:** synth one ~5-word cue with that speaker ID first; only quote it to the user if the smoke test returns a non-empty MP3. If the smoke test 401s with `code=45000010` ("grant not found"), tell the user they need to 开通 the resource in 火山引擎 console — do not pretend it'll work after a retry.

## Running dub.py

```bash
.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/dub.py [voice] [rate] [pitch]

# Mature Chinese contemplative female (Volcano):
.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/dub.py \
    zh_female_gaolengyujie_moon_bigtts -8% +0Hz

# Warm English caring female (edge-tts, multilingual):
.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/dub.py \
    en-US-AvaMultilingualNeural -5% -3Hz

# Default Chinese fallback (no Volcano creds needed):
.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/dub.py \
    zh-CN-XiaoxiaoNeural -8% -10Hz
```

The script:

1. Reads the SRT (auto-detects `*.zh-CN.srt`, `*.en.srt`, etc., or pass `--srt`).
2. Synthesizes one MP3 per cue under `dub_work/seg_NN.mp3`.
3. Probes each clip's actual duration with `ffprobe`.
4. For each cue: if TTS is longer than the SRT slot, chains `atempo` filters to speed it up; if shorter, pads with silence after.
5. Inserts silence segments for SRT gaps and any trailing tail so the output audio length exactly matches the source video.
6. Muxes the new audio into `*_zh_dub.mp4` / `*_en_dub.mp4` keeping the original video stream by `-c:v copy`.

Output: `<source-stem>_<lang>_dub.mp4` (e.g., `entrevista_zh_dub.mp4`). This is the input for the next step — `/wjs-burning-subtitles/render.py` — which composites the final video.

## Filling awkward silences

Mandarin takes 60–80% of the time Spanish does to say the same thing. With strict cue-by-cue timing, that leaves awkward 2–4s silences at the end of most cues. English is closer to ~85% of Spanish. Three levers, in increasing impact:

1. **Slow the native TTS rate.** Changing `--rate` from `+0%` to `-12%` to `-15%` produces clean, natural-sounding slower speech (much better than time-stretching afterward). Try `-12%` first; `-15%`/`-20%` for very contemplative content.

2. **Mild slow-stretch per cue.** When a cue's TTS is still shorter than its slot, run `atempo` between 0.82× and 0.95×. `dub.py` does this automatically: when slack > 0.5s, it sets `atempo = max(0.82, tts_dur / target_dur)` and pads the remainder. Below 0.82× the voice starts sounding drugged; above 0.92× the stretch is essentially imperceptible.

3. **Expand the target-language text in the worst cues.** When the slot is so long that even 0.82× stretch leaves >2s of silence, the cleanest fix is to lengthen the translation. Add natural Mandarin particles ("嗯，", "其实", "也就是说", "你知道") or unpack a compressed phrase into its full meaning. This changes the on-screen subtitle, so confirm with the user before doing it. Edit the SRT, regenerate just those segments by deleting their `dub_work/seg_NN.mp3` and re-running `dub.py`.

Combine the levers: native rate `-12%` + stretch-to-fit handles ~80% of cases. Reserve text expansion for the 2–3 worst outliers.

## Multi-speaker dubbing (opt-in)

**Only invoke this section when the user explicitly says the source has multiple speakers** ("interview", "two people", "dialogue", "separate the speakers", "different voice for each", or a direct request to do diarization).

When triggered, generate the dub with a different voice per speaker so the listener can follow who's speaking. Two paths:

### Path 1 (recommended for on-camera speakers): visual diarization

`scripts/visual_diarize.py` watches mouth movement per face per frame and tags each cue with the dominant speaker. Self-contained, no API keys, no audio fingerprinting.

```bash
uv pip install --python .venv/bin/python mediapipe opencv-python

.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/visual_diarize.py \
    --video input.mp4 --srt input.en.srt \
    --out input.en.diarized.srt \
    --report diarization_report.json \
    --sample-fps 5 --num-speakers 2
```

How it works:

1. Samples N frames per second (default 5).
2. Runs MediaPipe FaceLandmarker (Tasks API) for up to `--num-speakers` faces per frame, 478 landmarks each.
3. Measures mouth aperture per face as the vertical distance between inner upper lip (idx 13) and inner lower lip (idx 14).
4. Bins faces by horizontal screen position (x-quantiles) → speakers `A`, `B`, ... left-to-right.
5. For every cue's [start, end] window, integrates per-speaker frame-to-frame mouth-aperture change. Highest mover wins the tag.
6. Writes a `[A]`/`[B]`-prefixed SRT plus a JSON report with per-cue scores and a confidence ratio (winner / runner-up).

On first run, downloads the FaceLandmarker model (~3.6 MB) to `/tmp/mp_models/face_landmarker.task`.

**Visual is materially better than guessing from text.** In one validation, manual text-based labels split 6/50 between speakers; visual diarization showed the actual split was 29/27 — text-based guessing was wildly wrong because both people take similar-shaped turns. Always prefer visual when the speakers are on camera.

**Spot-check low-confidence cues.** Any cue in the JSON report with `confidence_ratio < 1.5` is borderline — usually overlapping speech or one speaker briefly off-frame. Hand-correct before dubbing.

### Path 2 (fallback): manual tagging

For very short clips (1–2 minutes), or when speakers are off-camera, or when visual diarization fails:

```text
1
00:00:00,000 --> 00:00:03,400
[A] So what about that AI rewrite thing?

2
00:00:03,400 --> 00:00:08,200
[B] Right — let me explain the workflow.
```

Save as `*.tagged.srt`. Keep the **clean** SRT (without tags) for downstream burn-in via `/wjs-burning-subtitles`.

### Routing voices in dub.py

Pass `--voice-map` with `speaker=voice` pairs. The positional voice arg is the default for cues with no tag.

```bash
.venv/bin/python ~/.claude/skills/wjs-dubbing-video/scripts/dub.py \
    en-US-AndrewMultilingualNeural -3% +0Hz \
    --srt input.en.tagged.srt \
    --voice-map "A=en-US-BrianMultilingualNeural,B=en-US-AndrewMultilingualNeural"
```

Voice-pairing tips:

- **Two of the same gender:** pick voices with audibly different timbre. Brian (casual) + Andrew (warm) works for two American males. Ava (warm female) + Emma (cheerful female) for two females.
- **Mixed gender:** Ava + Andrew is a clean default.
- **Accent contrast:** pair `en-US-` and `en-GB-` for distinctness.
- **Chinese:** mix Volcano voices like `zh_female_gaolengyujie_moon_bigtts` (mature) + `zh_female_kailangjiejie_moon_bigtts` (warm sister).

### Limits

Visual diarization fails when:

- A speaker is consistently off-camera while talking.
- Camera cuts or zooms make face position unstable across cues.
- Three or more speakers sit at similar horizontal positions (x-quantile binning is too coarse — switch to k-means on (x, y) or use audio-based diarization instead).

For audio-only material (podcasts, voice-overs), fall back to `pyannote.audio` or `whisperx --diarize`. This skill does not yet bundle audio-based diarization.

## Output

- `<source-stem>_<lang>_dub.mp4` — video stream-copied from source, audio replaced with the time-aligned dub track. Drop-in input for `/wjs-burning-subtitles/render.py`.
- `dub_work/seg_NN.mp3` — per-cue TTS clips (kept for resume / per-cue regen).

## Downstream

- **`/wjs-burning-subtitles`** — to mix the original audio as a low-volume bed, burn the SRT, or both. The final encode happens there in one ffmpeg pass (no cascade). Pass `--video <source.mp4> --dub <source_lang_dub.mp4> [--srt <srt>]` to its `render.py`.
- The dub-only file (`*_<lang>_dub.mp4`) is technically a finished video and can ship as-is, but it sounds dubbed (because it is). Mixing the original underneath gives the "professional translation" feel — do that in `/wjs-burning-subtitles`.

## Anti-patterns

- ❌ **Calling `uvx edge-tts` once per cue.** Spawns a Python process each time; bing endpoint rate-limits or RSTs mid-render. Use the persistent library path in `dub.py`.
- ❌ **Trusting `audio_source` without listening.** Always sample a 30 s clip before committing.
- ❌ **Stretching below 0.82× atempo.** Voice starts sounding drugged. Add silence padding or expand text instead.
- ❌ **Tagging single-speaker SRTs with `[A]`.** Wastes time and the dub sounds the same. Default to one voice.
- ❌ **Promising a Volcano voice without smoke-testing it on the user's instance.** The doc lists many voices that error with `code=55000000` against typical SeedTTS-2.0 starter bundles. Always synth a 5-word smoke test before quoting.
- ❌ **Parsing Volcano response as one JSON document.** It's streaming NDJSON; the success terminator is `code=20000000`, not `code=0`. Concatenate base64-decoded `data` chunks for the full MP3.
