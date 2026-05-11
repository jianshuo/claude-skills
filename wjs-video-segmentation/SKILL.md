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

## The pipeline

```
long video + SRT
   ↓     (agent reads SRT, decides topics — judgment, not parsing)
segments.json
   ↓     segment.py:    cut clips + extract mid-segment frames
clip_NN.mp4 + frame_NN.jpg
   ↓     ASK: target platform orientation match source?
   ↓     /wjs-video-crop on each clip (if 16:9 → 9:16, etc.)
clip_NN.mp4    (now in target orientation)
   ↓     make_cover.py: gpt-image-2 generates cover (title baked in)
cover_NN.png   (matches clip aspect)
   ↓     prepend_intro.py: prepend cover as 1.5s title-card
clip_NN_intro.mp4
   ↓     burn_subs.py:  slice SRT + libass burn-in
clip_NN_burned_intro.mp4    ← upload this
```

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

If the user confirms, run the crop skill on each clip in place:

```bash
# Conceptually — invoke the wjs-video-crop skill per clip.
# It uses MediaPipe face-tracking to keep the active speaker in frame.
# The skill replaces clip_NN.mp4 with the vertical version (or writes
# to a new path; pick one convention and stay consistent so later
# steps find the right file).
```

The wjs-video-crop skill handles the cropping mechanics (active-speaker
detection via mouth-aspect-ratio variance, smoothed pan, etc.). This
skill's only job at Step 2.5 is to **gate** the decision and orchestrate
the call.

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

**Always preview segment 1 before generating the rest.** Cover style is the single highest-signal taste decision in the pipeline. `--single N` re-rolls one cover; lock in segment 1, then batch.

**Pillow fallback** (`compose_cover.py`) — use when gpt-image-2 is unavailable OR its Chinese typography is unacceptable. Produces a vertical 4:5 thumbnail from frame + text overlay. Per-platform dimensions in `references/platform_sizes.md`.

## Step 4 — Prepend cover as title-card intro

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/prepend_intro.py \
    --segments segments.json --out output/
```

Inserts the cover as a 1.5s still in front of each clip (silent audio during the still, clip audio starts cleanly). Result: the cover IS the literal first frame of the video, so platforms that auto-pick the first frame as the thumbnail get your designed cover by default.

**Standalone mode** (no segments.json needed):
```bash
prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4 [--duration 1.5]
```

## Step 5 — Slice + burn subtitles

```bash
python3 ~/.claude/skills/wjs-video-segmentation/scripts/burn_subs.py \
    --segments segments.json --out output/
```

For each segment: clamp full SRT to `[start, end]`, shift timestamps to start at 0, burn into the clip via libass. Auto-detects ffmpeg with libass (`$FFMPEG` → `/tmp/ff_bin/ffmpeg` → `which ffmpeg`); exits with a hint if none has libass.

`--no-burn` writes only the per-clip SRTs (for editing in Final Cut Pro / Premiere). Default style: `Fontsize=18,MarginV=60`. Override via `--style 'Fontsize=22,MarginV=80'` (commas auto-escaped).

**Standalone mode**:
```bash
burn_subs.py --video in.mp4 --srt in.srt --out out.mp4 [--style '...']
```

## Quick reference

| Task | Command |
|---|---|
| Cut clips + frames | `segment.py --segments S.json --out output/` |
| Force re-encode | `segment.py … --reencode` |
| Probe source aspect | `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 IN.mp4` |
| Convert orientation (ask first) | invoke `/wjs-video-crop` per clip BEFORE covers |
| AI covers (title baked in) | `make_cover.py --segments S.json --out output/` |
| Re-roll one cover | `make_cover.py … --single 3` |
| Pillow cover (fallback) | `compose_cover.py --segments S.json --out output/` |
| Prepend cover as 1.5s intro | `prepend_intro.py --segments S.json --out output/` |
| Prepend one (no segments.json) | `prepend_intro.py --clip A --cover B --out C` |
| Slice + burn subs | `burn_subs.py --segments S.json --out output/` |
| Burn one (no segments.json) | `burn_subs.py --video A --srt B --out C` |
| Just slice SRTs, don't burn | `burn_subs.py … --no-burn` |

## Common mistakes

- **Cutting mid-sentence** — always snap to SRT cue boundaries.
- **Trying to use 100% of the video** — 3–6 strong clips from 10 min is normal. Boring middle = drop.
- **Letting the LLM write the title** — the title is judgment, not summary. Review and rewrite before passing to make_cover.
- **Forgetting "no text" in `cover_prompt`** — gpt-image-2 will hallucinate fake glyphs if you don't constrain it. The hardcoded prompt in make_cover.py already handles this; don't undo it in `cover_prompt`.
- **Pre-generating all covers before showing the user one** — taste is iterative. Always preview segment 1.
- **Re-encoding when stream-copy works** — segment.py detects black-opening-frame cases automatically; trust the fallback.
- **Skipping the orientation check (Step 2.5)** — generating a 16:9 cover and burning subs onto a 16:9 clip, only to later realize 视频号/抖音 needs 9:16, means redoing covers/intro/burn from scratch. Always probe source aspect and ask the user *before* covers.

## Integration with other wjs- skills

- **wjs-translate-video** — produce the source SRT first if missing; its `*.burn.srt` variant is the preferred input for `burn_subs.py` (hard-wrapped for on-screen reading).
- **wjs-multicam-edit** — if the source is multi-cam, render the synced single MP4 first, then segment.
- **wjs-video-crop** — **call BEFORE covers in Step 2.5** when source orientation doesn't match the target platform. Face-tracked active-speaker following keeps the talker in frame during the crop. Doing this *after* covers wastes a re-render.
- **gpt-image-2-skill** — make_cover.py wraps `images edit`; standalone gpt-image-2 invocations also work.

## Files & references

- `scripts/segment.py` `scripts/make_cover.py` `scripts/compose_cover.py` `scripts/prepend_intro.py` `scripts/burn_subs.py`
- `references/segments_schema.json` — JSON Schema for segments.json
- `references/example_segments.json` — worked example
- `references/platform_sizes.md` — per-platform cover dimensions & title placement
