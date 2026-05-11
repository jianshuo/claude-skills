---
name: wjs-video-segmentation
description: Use when the user has a long-form video (interview / lecture / podcast / conversation) and a transcript SRT, and wants to extract 3–6 stand-alone topical short clips ready to upload to a short-video platform (视频号 / 抖音 / 小红书 / YouTube Shorts / TikTok / Reels). Each clip gets an AI-generated cover image with the title baked in. Triggers — "切成几段", "分主题", "拆成短视频", "做封面+标题", "video chapters", "topic segments", "split into clips".
---

# wjs-video-segmentation

A 5-step pipeline that turns one long video + SRT into multiple stand-alone short clips with covers and burned-in subtitles. The agent does the **judgment** work (topic identification); 5 scripts handle the mechanical work (cut, cover, intro, subs).

## When to use

- Long-form video (≥10 min) with an already-existing SRT transcript.
- Goal is **stand-alone** short clips (each viewable without context).
- Target is a vertical / mobile short-video platform.

## When NOT to use

- Single-topic trimming → just use `ffmpeg -ss A -to B`, no orchestration needed.
- No transcript yet → run **wjs-translate-video** first to produce an SRT.
- Multicam editing → use **wjs-multicam-edit**.
- Highlight reel with multiple cuts inside a single topic → that's editing, not segmentation.

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| You (the agent) **read the full SRT and decide the topic boundaries** | A script that runs NLP topic modeling, silence-based chapter detection, or "viral moment" scoring. **This is intentional — topic boundaries are semantic, not acoustic, and competing tools (Descript, OpusClip, Riverside Magic Clips) all get this wrong by automating it.** |
| 5 scripts coupled by `segments.json` as the data contract | One giant orchestrator script |
| Stream-copy cuts (seconds, lossless) | Full re-encode by default (only fallback when keyframes don't align) |
| GPT-Image-2 bakes the title text directly into the AI image (default) | Pillow text-on-top of frame (Pillow fallback exists for offline / no-LLM) |
| Cover is prepended as 1.5s title-card intro → becomes the platform's auto-thumbnail | Just an upload thumbnail with no presence in the video |
| Subtitles burned via libass per clip | Subtitles via overlay or HTML composition |
| Scripts also runnable standalone (single clip, no segments.json) | Only batch-mode pipeline |

## The pipeline — two paths

```
long video + SRT
   ↓     (agent reads SRT, decides topics — judgment, not parsing)
segments.json
   ↓     segment.py:    cut clips + extract mid-segment frames
clip_NN.mp4 + frame_NN.jpg
   ↓     ASK: target platform orientation match source?
   ↓     /wjs-video-crop on each clip (if 16:9 → 9:16, etc.)
   ↓     re-extract frames from cropped clips
clip_NN.mp4 (now in target orientation) + clip_NN.zh-CN.burn.srt
   │
   ├──[Path A: ship now]────────────────┐
   │   ↓ make_cover.py (cover_NN.png)   │
   │   ↓ burn_subs.py (SLOW re-encode)  │
   │   ↓ prepend_intro.py (stream-copy) │
   │   clip_NN_burned_intro.mp4 ────────┘ ← upload directly
   │
   └──[Path B: high-production via hyperframes]
       ↓ HAND OFF clip_NN.mp4 + clip_NN.zh-CN.burn.srt to hyperframes
       ↓ hyperframes builds ONE composition with:
       ↓   • cover as animated title scene (not just a still)
       ↓   • subs as HTML/CSS text overlays (word-by-word highlight,
       ↓     kinetic reveal, keyword color/emphasis, custom fonts)
       ↓   • interstitial title cards, golden-quote callouts
       ↓   • end-card CTA (订阅王建硕 / 关注 AI 炼金术 etc.)
       ↓   • scene transitions (crossfade / shader / push)
       ↓ ONE final ffmpeg encode
       final.mp4 ← upload
```

**Default to Path B when downstream styling is planned.** Path A's
burn step bakes pixels into the video frames, making every subtitle /
title decision permanent and forcing a full re-encode. If you'll
later want word-by-word kinetic highlights, animated callouts, or
end-card CTAs, you're going to render in hyperframes anyway — so
hand off the cropped raw clip + the per-segment SRT and let
hyperframes do cover + subs + animation + CTA in a **single final
encode**. Avoids generation loss from cascade encodes, and HTML/CSS
text styling is materially richer than libass.

**Use Path A only when you need to ship immediately** and don't have
time to author a hyperframes composition. Path A is the "good enough,
ready-to-upload" output; Path B is the "production-quality, designed
for retention" output.

### Path A order matters: burn FIRST, prepend LAST

Burning libass subs into video requires re-encoding every frame of
the body — unavoidable. But prepending the cover doesn't have to
re-encode the body if the 1.5-second cover-clip is encoded to match
the body's codec exactly; then `ffmpeg -f concat -c copy` stitches
them losslessly in seconds. Prepending first means burn re-encodes
the prepended output anyway, wasting that stream-copy savings.

### Path B hand-off package

When stopping after Step 2.5 to hand off to hyperframes, deliver
EXACTLY these per-segment artifacts:

```
output/
  clip_NN_slug.mp4                  # raw cropped clip (target orientation, no subs, no cover)
  clip_NN_slug.zh-CN.burn.srt       # per-clip SRT, timestamps already shifted to start at 0
  segments.json                     # for slug/title/summary/cover_prompt metadata
  frame_NN_slug.jpg                 # midpoint frame (cover reference for hyperframes)
  cover_NN_slug.png                 # **regenerate at native target aspect** (see below)
```

To generate the per-clip SRTs WITHOUT burning them, run:

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/burn_subs.py \
    --segments segments.json --out output/ --no-burn
```

This slices the master SRT to each segment's `[start, end]` and shifts
timestamps to start at 0 per clip — exactly the input hyperframes
captions expect (each composition's timeline starts at t=0).

**Cover image aspect — MUST match the composition aspect.** When
covers will be used as the literal first frame of a hyperframes
composition (a full-frame still scene, not letterboxed), regenerate
covers at the SUPPORTED gpt-image-2 size CLOSEST to your target:

| Target frame | Use `--size`     | Aspect    | Notes |
|--------------|------------------|-----------|-------|
| 1920×1080    | `1536x1024`      | 3:2 ≈ 16:9 | default |
| **1080×1920** (视频号) | `1024x1792`      | ≈ 9:16    | **must use this for vertical**; `1024x1536` (default) is 2:3 and gets cropped or letterboxed |
| Square       | `1024x1024`      | 1:1       | |

The default `--size 1024x1536` (2:3) is fine for the Path A title-card
intro because `prepend_intro.py` letterboxes it during concat. But for
hyperframes Path B where the cover IS the first frame full-bleed,
mismatch shows up as either ugly letterbox bars (object-fit: contain)
or cropped title text (object-fit: cover) — both wrong. Always pass
`--size 1024x1792` for vertical.

**Why hand off raw, not burned:** hyperframes will compose the cover
animation, render subtitle text as HTML/CSS (with kinetic word-by-word
highlights, keyword emphasis, custom fonts, deterministic seekability),
add interstitial title cards and golden-quote callouts, append an
end-card CTA, run scene transitions, and produce ONE final encode. If
you hand off a `_burned.mp4` instead of raw, hyperframes has to render
on top of pixels that already contain libass subtitles — meaning two
sets of subs visually colliding. Always hand off raw cropped clip.

**Avoid double subtitle systems.** If hyperframes will render captions
from the SRT, do NOT also burn libass subs in this skill. Pick one
caption system per output video.

### What hyperframes adds on top of Path B raw clips

Concrete things hyperframes can do that this skill cannot (and that
make Path B worth the additional authoring time):

- **AI cover as the literal first frame** of the video — full-bleed,
  no animation needed, served as the platform thumbnail by default.
- **Outlined large-font HTML/CSS captions** (white text, thick black
  `-webkit-text-stroke`, ~64px on vertical 1080-wide) — more readable
  than libass bubbles and seekable per cue.
- **Illustration overlays at hook moments** — top-corner stack diagrams,
  centered "hammer" callouts (e.g., a 96px "LLM = 新编译器" with kinetic
  reveal), keyword pops. Each illustration is its own timed `class="clip"`
  div with `data-start` / `data-duration`.
- **End-card CTA scene** — branded outro for "关注王建硕 / AI 炼金术"
  with arrow + foot text.
- **Scene transitions** — crossfades, wipes, shader transitions between
  cover/body/CTA.

The body video itself is just a normal `<video class="clip">` clip with
matching `<audio>` track; the SRT is loaded as inline JSON and each cue
becomes its own bubble element with deterministic show/hide tweens.
The whole composition compiles to ONE final encode — no cascade.

## Step 1 — Agent reads SRT, writes `segments.json`

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

`slug` = kebab-case English (used in filenames). `title` uses `\n` for line break, 2 lines max, 8–12 Chinese chars per line.

## Step 2 — Cut clips

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/segment.py \
    --segments segments.json --out output/
```

Stream-copies via `ffmpeg -ss S -to E -c copy`. Falls back to re-encode if a copy cut lands mid-keyframe and produces a black opening frame. Also extracts a midpoint frame per segment to `output/frame_NN_slug.jpg` (used as gpt-image-2's `--ref-image`).

Pass `--reencode` to force re-encode all clips.

### ⚠ Keyframe-snap audio/caption desync — read before shipping

**Stream-copy cuts at any timestamp produce a clip that starts EARLIER
than requested** — up to one GOP interval (typically 1-4 seconds on
H.264 source). `ffmpeg -ss N -i src -c copy` seeks to the nearest
keyframe *before* N because it can't re-encode. The output's t=0 then
maps to source's t=keyframe (not source's t=N), so the clip plays a
fraction of a second of "lead-in" content before the requested speech.

Captions sliced from the master SRT and shifted to start at segment
boundary N will then appear **AHEAD of the audio** by exactly that
GOP fraction. Listeners feel "subtitles lead the voice."

#### Diagnosing

```bash
# What's the source GOP near segment N?
ffprobe -v error -select_streams v:0 -read_intervals "$((N-2))%$((N+5))" \
  -show_entries packet=pts_time,flags -of csv=p=0 master.mp4 | grep "K_"
```

Output like `360.023,K__   362.023,K__   364.023,K__` → GOP=2s. A
stream-copy cut requested at 361.000 actually starts at 360.023 →
**captions are 0.977s ahead of audio**.

#### Fix — pick one

**A. Per-clip SRT offset shim (fastest, retroactive).** After cutting,
measure the exact offset (`requested_start − nearest_preceding_keyframe`)
and add it to every cue's `start` / `end` in the per-clip SRT. Works
for already-cut clips you don't want to re-encode.

**B. Re-cut with accurate seek (slow, correct, per-clip).** Drop
`-c copy` and let ffmpeg re-encode the cut so it lands precisely:

```bash
ffmpeg -ss 361.0 -i master.mp4 -t 107.76 \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 192k \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  clip_01.mp4
```

Accurate to the frame; ~30s per clip on CPU. Use `segment.py --reencode`
to force this for all segments.

**C. Pre-encode the master with keyframes at segment boundaries
(BEST for production).** Before cutting, re-encode the source ONCE
forcing keyframes at every requested cut point. Then ALL stream-copy
cuts land exactly:

```bash
# Build the comma-separated keyframe list from segments.json
KF=$(python3 -c "import json,sys; s=json.load(open('segments.json'))
ts=[]
for seg in s['segments']:
    ts += [seg['start'], seg['end']]
print(','.join(ts))")

# Re-encode master once, forcing keyframes at all segment boundaries
ffmpeg -i master.mp4 \
  -c:v libx264 -preset medium -crf 18 \
  -force_key_frames "$KF" \
  -c:a copy master_kf.mp4

# Now segment.py stream-copies cleanly — every cut lands on a keyframe.
python3 segment.py --segments segments.json --source master_kf.mp4 --out output/
```

Trade-off: re-encodes the full source once (slow) but every subsequent
cut is free. Best when you'll re-cut the same source multiple times
(iterating on segment boundaries).

**Recommendation:** for one-shot work, use **B** (`--reencode`). For
iterative work (re-picking segments), use **C** (pre-keyframed master).
For already-shipped wrong cuts, use **A**.

## Step 2.5 — Orientation check (ask before continuing)

**Critical decision point — must happen before covers.** Covers are
generated to match clip dimensions, so converting orientation *after*
covers means regenerating every cover. Do the orientation conversion
*before* cover/intro/burn.

Compare source video aspect ratio to the target platform's native
orientation:

| Platform                  | Native orientation | Aspect |
|---------------------------|--------------------|--------|
| 视频号 (WeChat Channels)  | vertical           | 9:16   |
| 抖音 / TikTok / Reels     | vertical           | 9:16   |
| 小红书 (Xiaohongshu video)| vertical           | 9:16   |
| YouTube Shorts            | vertical           | 9:16   |
| YouTube (regular)         | horizontal         | 16:9   |
| B站 (Bilibili)            | horizontal         | 16:9   |

Probe source aspect with `ffprobe`:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height \
  -of csv=p=0 clip_01_*.mp4
```

If source aspect already matches the platform → **skip this step**,
proceed to covers.

If mismatch → **ASK THE USER** before converting. Sample phrasing:

> 源视频是横屏 (1920×1080)，平台 视频号 需要竖屏 (9:16)。是否对每段
> 调用 `/wjs-video-crop` 转成竖屏？(crop 会用 MediaPipe 跟踪正在说话
> 的人的脸，保持说话人始终在画面中)

If the user confirms, invoke wjs-video-crop on each clip. The crop
script needs `mediapipe + opencv + numpy` in a Python 3.12 venv
(mediapipe doesn't yet ship wheels for 3.14+). One-time setup:

```bash
uv venv --python 3.12 /tmp/_crop_venv
/tmp/_crop_venv/bin/python -m pip install mediapipe opencv-python numpy
```

Per-clip invocation (loops over all 5 segments in shell):

```bash
for n in 01 02 03 04 05; do
  slug=$(ls clip_${n}_*.mp4 | grep -v -E "_intro|_burned|_vert" | head -1 | sed -E "s/clip_${n}_(.+)\.mp4/\1/")
  /tmp/_crop_venv/bin/python ~/.claude/skills/wjs-video-crop/scripts/crop.py \
    "clip_${n}_${slug}.mp4" \
    --out "clip_${n}_${slug}_vert.mp4" \
    --target portrait \
    --bitrate 8M    # 视频号 caps at 10Mbps; 抖音 12Mbps OK
done
```

After cropping, **swap the cropped versions to canonical names** so
downstream make_cover / burn_subs / prepend_intro find them:

```bash
mkdir -p _horizontal_archive
for n in 01 02 03 04 05; do
  base=$(ls clip_${n}_*_vert.mp4 | sed -E "s/_vert\.mp4$//")
  mv "${base}.mp4" "_horizontal_archive/"          # keep original
  mv "${base}_vert.mp4" "${base}.mp4"              # promote vertical
  # Re-extract midpoint frame from the now-vertical clip:
  mid=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${base}.mp4" | awk '{print $1/2}')
  slug=$(echo "$base" | sed -E "s/^clip_${n}_//")
  ffmpeg -hide_banner -loglevel error -ss "$mid" -i "${base}.mp4" \
    -frames:v 1 -q:v 3 "frame_${n}_${slug}.jpg" -y
done
```

**Sanity check** — face-on-screen detection rate in the crop output
log can read low (e.g. `face#0: 9.6s on screen (9%)`) when speakers
sit further than ~2 m from the camera. That number being low is OK —
the active-speaker hysteresis + fallback-to-largest-face still
produces well-centered crops. **Verify visually by extracting a
midpoint frame from each `_vert.mp4` and checking the speaker is
centered** before committing to the swap.

**Skip the prompt only when:**
- Source aspect already matches target platform.
- User specified orientation upfront in segments.json's `platform`
  field AND the source already matches.
- A previous run in the same session already cropped these clips.

**Never silently skip the check** — getting a horizontal podcast on
视频号 and finding out only at upload time is a frustrating failure
mode the skill exists to prevent.

## Step 3 — Generate covers

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/make_cover.py \
    --segments segments.json --out output/
```

For each segment, calls `gpt-image-2 images edit` with the frame as ref + a prompt combining `cover_prompt` and explicit typography instructions (bold Heiti, very large, white-with-black-outline, face-clear placement). Output: `output/cover_NN_slug.png` at 16:9 (default 1536×1024).

**Pass `--size` to match clip orientation.** `make_cover.py` defaults
to `1536x1024` (16:9 horizontal). For vertical clips (post Step 2.5
crop), pass `--size 1024x1536` so the cover matches 9:16. Mismatched
size means the cover gets letterboxed when prepended — wastes screen
real estate in the precious title-card moment.

```bash
# After cropping to 9:16:
make_cover.py --segments S.json --out output/ --size 1024x1536
```

**Always preview segment 1 before generating the rest.** Cover style is the single highest-signal taste decision in the pipeline. `--single N` re-rolls one cover; lock in segment 1, then batch.

**Codex provider can transient-fail** — if make_cover errors on one
segment mid-batch (e.g. codex CLI returns non-zero), the rest of the
batch still completes. Retry the failed segment with `--single N`.

**Pillow fallback** (`compose_cover.py`) — use when gpt-image-2 is unavailable OR its Chinese typography is unacceptable. Produces a vertical 4:5 thumbnail from frame + text overlay. Per-platform dimensions in `references/platform_sizes.md`.

## Step 4 — Slice + burn subtitles (BEFORE prepend)

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/burn_subs.py \
    --segments segments.json --out output/
```

For each segment: clamp full SRT to `[start, end]`, shift timestamps to start at 0, burn into the clip via libass. Auto-detects ffmpeg with libass (`$FFMPEG` → `/tmp/ff_bin/ffmpeg` → `which ffmpeg`); exits with a hint if none has libass.

Burn is **unavoidably slow** — libass writes pixels into every frame,
so the whole body re-encodes. ~30-60s per 2-min clip on CPU. Run
prepend AFTER this so prepend can stream-copy.

`--no-burn` writes only the per-clip SRTs (for editing in Final Cut Pro / Premiere).

**Style — match font scale to clip orientation.** libass scales
`Fontsize` linearly with frame height (PlayResY default 288), so the
same Fontsize renders much larger on 1920-tall vertical than on
1080-tall horizontal.

| Clip aspect       | Recommended `--style`                                          |
|-------------------|----------------------------------------------------------------|
| Horizontal 16:9   | `Fontsize=18,MarginV=60` (default)                             |
| **Vertical 9:16** | `Fontsize=14,MarginL=20,MarginR=20,MarginV=80`                 |

`MarginV` is **distance from the bottom in libass PlayResY=288 units**
— `MarginV=80` on a 1920-tall frame places the subtitle baseline at
`80×1920/288 ≈ 533px` from the bottom (lower-third placement, just
above the typical 视频号 / 抖音 bottom-UI strip that takes ~300px).
Counterintuitively, *raising* MarginV pushes subs *up* the frame; do
not over-shoot to 200+ or subs land in the upper-middle and visually
collide with the speaker's face. At
`Fontsize=14` on 1080-wide, ~13-14 Chinese characters fit on one line
before wrap — which is why **the source SRT cues should already cap
at ~18 characters** (handled upstream by your assembly logic; see
`wjs-translate-video` skill).

**Standalone mode**:
```bash
burn_subs.py --video in.mp4 --srt in.srt --out out.mp4 [--style '...']
```

## Step 5 — Prepend cover as title-card intro (LAST, fast)

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/prepend_intro.py \
    --segments segments.json --out output/
```

Inserts the cover as a 1.5s still in front of each `_burned.mp4`,
producing the final `_burned_intro.mp4`. The cover IS the literal
first frame of the video, so platforms that auto-pick the first frame
as the thumbnail get your designed cover by default.

**Fast path: concat-demuxer + stream-copy.** The script probes the
body's codec/profile/fps/pix_fmt/audio params, encodes just the 1.5s
intro to a tiny mp4 matching those params exactly, then runs
`ffmpeg -f concat -c copy` to stitch them. A 2-minute body that would
take 30-60s to re-encode wraps in ~1s. The script prints `[stream-copy]`
when this path succeeds.

**Fallback: filter-graph concat + re-encode.** If the intro can't be
encoded to match the body (rare — exotic codec, weird pix_fmt), the
script falls back to filtergraph concat + libx264 medium. Marked
`[re-encoded]` in the output. Force this with `--reencode` if you
suspect codec mismatch causing playback issues.

**Standalone mode** (no segments.json needed):
```bash
prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4 [--duration 1.5]
```

## Quick reference

| Task | Command |
|---|---|
| Cut clips + frames | `segment.py --segments S.json --out output/` |
| Force re-encode | `segment.py … --reencode` |
| Probe source aspect | `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 IN.mp4` |
| Convert orientation (ask first) | invoke `/wjs-video-crop` per clip BEFORE covers |
| AI covers — horizontal 16:9 | `make_cover.py --segments S.json --out output/` (default size) |
| AI covers — vertical 9:16 | `make_cover.py … --size 1024x1536` |
| Re-roll one cover | `make_cover.py … --single 3` |
| Pillow cover (fallback) | `compose_cover.py --segments S.json --out output/` |
| Slice + burn subs — horizontal | `burn_subs.py --segments S.json --out output/` |
| Slice + burn subs — vertical | `burn_subs.py … --style 'Fontsize=14,MarginL=20,MarginR=20,MarginV=200'` |
| Burn one (no segments.json) | `burn_subs.py --video A --srt B --out C` |
| Just slice SRTs, don't burn | `burn_subs.py … --no-burn` |
| Prepend cover (fast, after burn) | `prepend_intro.py --segments S.json --out output/` |
| Prepend one (no segments.json) | `prepend_intro.py --clip A --cover B --out C` |
| Force prepend re-encode | `prepend_intro.py … --reencode` |

## Common mistakes

- **Cutting mid-sentence** — always snap to SRT cue boundaries.
- **Trying to use 100% of the video** — 3–6 strong clips from 10 min is normal. Boring middle = drop.
- **Letting the LLM write the title** — the title is judgment, not summary. Review and rewrite before passing to make_cover.
- **Forgetting "no text" in `cover_prompt`** — gpt-image-2 will hallucinate fake glyphs if you don't constrain it. The hardcoded prompt in make_cover.py already handles this; don't undo it in `cover_prompt`.
- **Pre-generating all covers before showing the user one** — taste is iterative. Always preview segment 1.
- **Re-encoding when stream-copy works** — segment.py detects black-opening-frame cases automatically; trust the fallback.
- **Skipping the orientation check (Step 2.5)** — generating a 16:9 cover and burning subs onto a 16:9 clip, only to later realize 视频号/抖音 needs 9:16, means redoing covers/intro/burn from scratch. Always probe source aspect and ask the user *before* covers.
- **Forgetting `--size 1024x1536` for vertical covers** — make_cover.py defaults to 16:9 (1536×1024) regardless of clip aspect. Pass the matching size or the cover gets letterboxed in the 1.5s title card.
- **Forgetting vertical `--style` for burn** — using the horizontal default `Fontsize=18` on a 1080×1920 clip produces oversized subtitles that overflow the frame. Use `Fontsize=14,MarginL=20,MarginR=20,MarginV=200` for vertical.
- **Prepending intro BEFORE burning subs** — the burn step then re-encodes the prepended output and wastes the prepend's potential stream-copy. Always burn first, prepend last.
- **Force-re-encoding prepend by default** — the script's fast path is concat-demuxer + stream-copy and should hit `[stream-copy]` for almost all clips. If you see `[re-encoded]` in the output, your body has unusual codec params; investigate rather than just accepting the slow path.

## Integration with other wjs- skills

- **wjs-translate-video** — produce the source SRT first if missing; its `*.burn.srt` variant is the preferred input for `burn_subs.py` (hard-wrapped for on-screen reading).
- **wjs-multicam-edit** — if the source is multi-cam, render the synced single MP4 first, then segment.
- **wjs-video-crop** — **call BEFORE covers in Step 2.5** when source orientation doesn't match the target platform. Face-tracked active-speaker following keeps the talker in frame during the crop. Doing this *after* covers wastes a re-render.
- **gpt-image-2-skill** — make_cover.py wraps `images edit`; standalone gpt-image-2 invocations also work.
- **hyperframes** — **the preferred downstream for production-quality work** (Path B above). Hand off raw cropped clips + per-segment SRT after Step 2.5; let hyperframes compose cover + subs + animations + CTA in one final encode. Don't burn subs in this skill if hyperframes will follow.
- **wjs-video-overlay** — alternative to hyperframes if you only need static title cards / lower-thirds / annotations on top of an already-burned clip. Use when the overlay needs are simple (no per-word kinetic styling).

## Files & references

- `scripts/segment.py` `scripts/make_cover.py` `scripts/compose_cover.py` `scripts/prepend_intro.py` `scripts/burn_subs.py`
- `references/segments_schema.json` — JSON Schema for segments.json
- `references/example_segments.json` — worked example
- `references/platform_sizes.md` — per-platform cover dimensions & title placement
