---
name: wjs-segmenting-video
description: Use when the user has a long-form video (interview / lecture / podcast / conversation) and a transcript SRT, and wants to extract 3–6 stand-alone topical short clips from it. This skill ONLY cuts and crops — it produces raw clips + per-clip SRTs as a hand-off package for downstream post-production (`/wjs-overlaying-video`). Triggers — "切成几段", "分主题", "拆成短视频", "切片", "topic segments", "split into clips".
---

# wjs-segmenting-video

Cut a long video + SRT into multiple stand-alone short clips, each
oriented for the target platform. **This skill stops after cutting +
cropping** — it hands off the raw clips to `/wjs-overlaying-video` for
covers, captions, illustrations, CTA, and final render.

## When to use

- Long-form video (≥10 min) with an existing SRT transcript.
- Goal is **stand-alone** short clips (each viewable without context).
- The user will (or you will) drive post-production separately in
  `/wjs-overlaying-video`.

## When NOT to use

- Single-topic trimming → just use `ffmpeg -ss A -to B`.
- No transcript yet → run **`/wjs-transcribing-audio`** first (then `/wjs-translating-subtitles` if the segments need a non-source language).
- Multicam editing → use **`/wjs-editing-multicam`**.
- Highlight reel with multiple cuts inside a single topic → that's
  editing, not segmentation.

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| You (the agent) **read the full SRT and decide the topic boundaries** | A script that runs NLP topic modeling, silence detection, or "viral moment" scoring. Topic boundaries are semantic; competing tools (Descript, OpusClip, Riverside Magic Clips) all get this wrong by automating it. |
| `segment.py` cuts; `/wjs-reframing-video` reorients | An end-to-end "magic" pipeline |
| Accurate-seek cuts by default (re-encode) — clip starts EXACTLY at requested timestamp | Stream-copy cuts (those produce keyframe-snap drift up to GOP duration) |
| Hands off **raw cropped clips + per-clip SRTs** | Burned subtitles, covers, intros, CTAs (those live in `/wjs-overlaying-video`) |

## The pipeline

```
long video + SRT
   ↓     (agent reads SRT, decides topics — judgment, not parsing)
segments.json
   ↓     segment.py --reencode (accurate seek; clip starts exactly at requested t)
clip_NN.mp4 + frame_NN.jpg
   ↓     ASK: target platform orientation match source?
   ↓     /wjs-reframing-video on each clip (if 16:9 → 9:16, etc.)
   ↓     re-extract frames from cropped clips
clip_NN.mp4 (now in target orientation) + clip_NN.zh-CN.burn.srt
   ↓
HAND OFF → /wjs-overlaying-video
   (does covers + captions + illustrations + CTA + final render)
```

## Step 1 — Read SRT, write `segments.json`

**Don't outsource topic identification to a script.** For each candidate segment, judge:

- **Self-contained?** A cold viewer must understand it without prior context.
- **Single thread?** One central question / insight; if the speaker pivots mid-clip, that's two segments.
- **Length fits platform?** 60–180s for 视频号 / 30–60s for 抖音&Shorts. <30s feels truncated; >4min loses retention.
- **Hook + payoff?** Open on a claim / question / vivid image; close on a takeaway. Never end mid-sentence.
- **Snap to SRT cue boundaries** — never cut mid-word.

3–6 strong segments from a 10-minute source is normal. Drop boring middles. Quality > quantity.

Schema (full spec in `references/segments_schema.json`, example in `references/example_segments.json`):

```json
{
  "source_video": "input.mp4",
  "source_srt": "input.zh-CN.srt",
  "platform": "wechat_channels",
  "segments": [{
    "id": 1, "slug": "intent-not-code",
    "title": "AI 时代不是写代码\n而是写意图",
    "summary": "Two-sentence pitch — what's the insight, what's at stake.",
    "start": "00:00:43.460", "end": "00:02:35.220",
    "cover_prompt": "Visual concept for gpt-image-2 (style anchor, not literal scene)"
  }]
}
```

`slug` = kebab-case English (used in filenames). `title` uses `\n` for line break, 2 lines max, 8–12 Chinese chars per line. `cover_prompt` is consumed downstream by `/wjs-overlaying-video`'s cover-generation step — keep it written here so the overlay skill can pick it up without re-asking.

## Step 2 — Accurate-seek cut

```bash
python3 ~/.claude/skills/wjs-segmenting-video/scripts/segment.py \
    --segments segments.json --out output/ --reencode
```

`--reencode` is the **default recommended mode**. It cuts with
`ffmpeg -ss N -i src -c:v libx264 -c:a aac` so the output starts
EXACTLY at the requested timestamp. ~30s per clip on CPU. Also extracts
a midpoint frame per segment to `output/frame_NN_slug.jpg`.

**Why default to `--reencode` and not stream-copy:**

Stream-copy via `ffmpeg -ss N -c copy` seeks to the nearest keyframe
*before* N (it can't re-encode). The output's t=0 then maps to source
t=keyframe, so the clip plays a fraction of a second of "lead-in"
content before the requested speech. Captions sliced from the master
SRT at boundary N appear **AHEAD of the audio** by exactly that GOP
fraction — listeners feel "subtitles lead the voice."

In practice on H.264 source with GOP=2s: every clip is off by
0.6–1.5s. Looks like a synchronization bug downstream; it's actually
a cut-time bug upstream.

### Stream-copy variant (only if you control the source encode)

If the source has been re-encoded with `-force_key_frames` at every
requested cut boundary, stream-copy IS accurate. Workflow:

```bash
# Build the comma-separated keyframe list from segments.json
KF=$(python3 -c "import json; s=json.load(open('segments.json'))
ts=[]
for seg in s['segments']:
    ts += [seg['start'], seg['end']]
print(','.join(ts))")

# Re-encode master once, forcing keyframes at all segment boundaries
ffmpeg -i master.mp4 \
  -c:v libx264 -preset medium -crf 18 \
  -force_key_frames "$KF" \
  -c:a copy master_kf.mp4

# Now stream-copy cuts land exactly:
python3 segment.py --segments segments.json --source master_kf.mp4 --out output/
```

Use this only when iterating on segment boundaries (you'll re-cut the
same source many times). For one-shot work, `--reencode` is simpler
and just as correct.

### Diagnosing keyframe-snap on already-cut clips

```bash
ffprobe -v error -select_streams v:0 -read_intervals "$((N-2))%$((N+5))" \
  -show_entries packet=pts_time,flags -of csv=p=0 master.mp4 | grep "K_"
```

Output like `360.023,K__   362.023,K__` → GOP=2s. A `-c copy` cut at
361.000 actually starts at 360.023, captions are 0.977s ahead of audio.
The retroactive fix is a per-clip SRT offset shim
(`requested_start − nearest_preceding_keyframe`) added to every cue's
start/end, but the root fix is to re-cut with `--reencode`.

## Step 3 — Orientation check (ask before continuing)

Compare source video aspect ratio to the target platform:

| Platform                  | Native orientation | Aspect |
|---------------------------|--------------------|--------|
| 视频号 (WeChat Channels)  | vertical           | 9:16   |
| 抖音 / TikTok / Reels     | vertical           | 9:16   |
| 小红书 (Xiaohongshu video)| vertical           | 9:16   |
| YouTube Shorts            | vertical           | 9:16   |
| YouTube (regular)         | horizontal         | 16:9   |
| B站 (Bilibili)            | horizontal         | 16:9   |

Probe with `ffprobe`:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height -of csv=p=0 clip_01_*.mp4
```

If source aspect already matches the platform → **skip this step**.

If mismatch → **ASK THE USER** before converting. Sample phrasing:

> 源视频是横屏 (1920×1080)，平台 视频号 需要竖屏 (9:16)。是否对每段
> 调用 `/wjs-reframing-video` 转成竖屏？(crop 会用 MediaPipe 跟踪正在说话
> 的人的脸，保持说话人始终在画面中)

**Never silently skip the check** — finding out at upload time that
your horizontal clip needs to be vertical is a frustrating failure
mode the skill exists to prevent.

### Calling `/wjs-reframing-video`

The crop script needs `mediapipe + opencv + numpy` in a Python 3.12
venv (mediapipe doesn't ship wheels for 3.14+). One-time setup:

```bash
uv venv --python 3.12 /tmp/_crop_venv
/tmp/_crop_venv/bin/python -m pip install mediapipe opencv-python numpy
```

Per-clip invocation:

```bash
for n in 01 02 03 04 05; do
  slug=$(ls clip_${n}_*.mp4 | grep -v -E "_intro|_burned|_vert" | head -1 | sed -E "s/clip_${n}_(.+)\.mp4/\1/")
  /tmp/_crop_venv/bin/python ~/.claude/skills/wjs-reframing-video/scripts/crop.py \
    "clip_${n}_${slug}.mp4" \
    --out "clip_${n}_${slug}_vert.mp4" \
    --target portrait \
    --bitrate 8M    # 视频号 caps at 10Mbps
done
```

After cropping, **swap the cropped versions to canonical names** so
downstream pipelines find them:

```bash
mkdir -p _horizontal_archive
for n in 01 02 03 04 05; do
  base=$(ls clip_${n}_*_vert.mp4 | sed -E "s/_vert\.mp4$//")
  mv "${base}.mp4" "_horizontal_archive/"
  mv "${base}_vert.mp4" "${base}.mp4"
  # Re-extract midpoint frame:
  mid=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${base}.mp4" | awk '{print $1/2}')
  slug=$(echo "$base" | sed -E "s/^clip_${n}_//")
  ffmpeg -hide_banner -loglevel error -ss "$mid" -i "${base}.mp4" \
    -frames:v 1 -q:v 3 "frame_${n}_${slug}.jpg" -y
done
```

**Sanity check**: face-on-screen detection rate in the crop log can
read low (e.g. `face#0: 9.6s on screen (9%)`) when speakers sit
further than ~2 m from the camera. A *low* number is OK — the
active-speaker hysteresis + fallback-to-largest-face still produces
well-centered crops. But **`0 face observations` / `(no face /
fallback): 100%` is NOT OK**: with zero landmarks the crop falls back
to the frame *center*, which on a two-person interview set lands on the
background between the speakers (fireplace / plant), not on anyone. When
you see that, abandon the MediaPipe crop and do a **deterministic fixed
crop** on the speaker's known screen position — see
`/wjs-reframing-video` → "Zero-detection fallback". **Always verify
visually** by extracting a midpoint frame and confirming the speaker is
centered before committing.

## Step 4 — Slice per-clip SRTs

```bash
python3 ~/.claude/skills/wjs-segmenting-video/scripts/burn_subs.py \
    --segments segments.json --out output/ --no-burn
```

The `--no-burn` flag emits per-clip SRTs (`clip_NN_slug.zh-CN.burn.srt`)
with timestamps already shifted to start at 0 — exactly the input
`/wjs-overlaying-video` captions expect (its compositions start the
body at t=cover_duration, not the master clock).

Despite the legacy name `burn_subs.py`, this step does NOT burn pixels
in `--no-burn` mode — it's just an SRT slicer. (The burn-pixels mode
exists for the legacy "Path A" workflow but is deprecated in favor of
`/wjs-overlaying-video`'s HTML/CSS caption rendering.)

## Hand-off package — what to deliver to `/wjs-overlaying-video`

After Steps 1–4, deliver EXACTLY these per-segment artifacts:

```
output/
  clip_NN_slug.mp4                  # raw cropped clip (target orientation, no subs, no cover)
  clip_NN_slug.zh-CN.burn.srt       # per-clip SRT, timestamps shifted to start at 0
  frame_NN_slug.jpg                 # midpoint frame (cover reference)
  segments.json                     # for slug/title/summary/cover_prompt metadata
```

Then invoke `/wjs-overlaying-video` to add covers, captions, illustrations,
CTA, and produce the upload-ready MP4 per clip. The overlay skill
generates ONE final composition per clip and renders it in a single
encode (no cascade of re-encodes).

## Quick reference

| Task | Command |
|---|---|
| Cut clips (accurate, default) | `segment.py --segments S.json --out output/ --reencode` |
| Probe source aspect | `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 IN.mp4` |
| Convert orientation (ask first) | invoke `/wjs-reframing-video` per clip |
| Slice per-clip SRTs | `burn_subs.py --segments S.json --out output/ --no-burn` |
| Diagnose keyframe positions | `ffprobe -v error -select_streams v:0 -read_intervals A%B -show_entries packet=pts_time,flags -of csv=p=0 src.mp4 \| grep K_` |

## Common mistakes

- **Cutting mid-sentence** — always snap to SRT cue boundaries.
- **Trying to use 100% of the video** — 3–6 strong clips from 10 min is normal. Boring middle = drop.
- **Letting the LLM write the title** — the title is judgment, not summary. Review and rewrite before passing to make_cover.
- **Stream-copy without `--force_key_frames` preprocessing** — produces clips with audio ahead of captions by up to 1 GOP. Use `--reencode` (default) unless the source was specifically prepared.
- **Skipping the orientation check** — getting a horizontal podcast on 视频号 and finding out at upload time is preventable. Probe aspect and ask the user before cropping.
- **Burning subs / generating covers in THIS skill** — those moved to `/wjs-overlaying-video`. This skill stops after Step 4.

## Integration with other skills

- **`/wjs-transcribing-audio`** — produce the source SRT first if missing. The word-level Whisper output (or Volcano/豆包 ASR output) is preferred for accurate cue timing. If the segments need translating, chain into **`/wjs-translating-subtitles`**.
- **`/wjs-reframing-video`** — call in Step 3 when source orientation doesn't match target platform. Face-tracked active-speaker following keeps the talker in frame.
- **`/wjs-editing-multicam`** — if the source is multi-cam, render the synced single MP4 first, then segment.
- **`/wjs-overlaying-video`** — the **default downstream** for everything after Step 4. Covers, captions, illustrations, CTA, and final render all happen there. Don't add post-production in this skill.

## Files & references

- `scripts/segment.py` — accurate-seek + stream-copy cutting
- `scripts/burn_subs.py` — SRT slicer (`--no-burn` mode); legacy libass burn-in mode is deprecated in favor of `/wjs-overlaying-video`
- `references/segments_schema.json` — JSON Schema for segments.json
- `references/example_segments.json` — worked example
