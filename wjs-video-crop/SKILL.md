---
name: wjs-video-crop
description: Use when the user wants to convert a video between horizontal and vertical orientations while preserving the inverted aspect ratio (16:9 ↔ 9:16, 4:3 ↔ 3:4, 21:9 ↔ 9:21). The skill crops a narrow band from the source and tracks the active speaker — the person whose mouth is moving — via MediaPipe face landmarks and mouth-aspect-ratio variance, so the talker stays in frame even when other people are visible. Triggers — "横转竖", "竖转横", "做成竖屏发抖音/视频号/小红书", "16:9 to 9:16", "make this vertical for Reels / TikTok / YouTube Shorts", "crop to portrait", "convert to landscape".
---

# wjs-video-crop

Convert a video's orientation by **cropping** a narrow band from the source — not by physically rotating it. The crop window follows the **active speaker** (the face whose mouth is *moving*), not just the largest or most-confident face. A `.crop.json` sidecar records the crop plan, the per-segment speaker decisions, and the parameters used. The original input is never modified.

## When to use

- Repurposing a 16:9 podcast / interview / talk for vertical short-video platforms (WeChat Channels 视频号, Douyin 抖音, Xiaohongshu 小红书, YouTube Shorts, TikTok, Reels).
- Repurposing a 9:16 phone recording for horizontal players (YouTube long-form, blog embeds).
- Repurposing 4:3 archive footage for 3:4 mobile, or vice versa.

The output aspect is the source aspect with width and height swapped — 16:9 → 9:16, not "letterboxed 16:9 in a 9:16 frame".

## When NOT to use

- **Multi-person Q&A** where each face needs its own crop — this skill picks one crop track per video. For per-speaker split renders, use **wjs-multicam-edit** instead.
- **Animated content / B-roll with no faces** — falls back to center crop, usually wrong for the intent.
- **Heavy camera motion in the source** (handheld pan/zoom) — the face tracker amplifies camera shake. Stabilize first.
- **Source already at target aspect** — no work to do.

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| Single-face track (the largest face per sampled frame) | Per-speaker independent crops |
| Smooth pan via ffmpeg piecewise-linear crop expression | Cinematic ease-in/ease-out camera moves |
| Audio stream-copy (bit-exact) | Audio reprocessing / re-encoding |
| MediaPipe Tasks `FaceDetector` (BlazeFace short-range) at 2 fps sampled via ffmpeg | Per-frame neural inpainting / out-painting |
| One `ffmpeg crop + scale` pass | Frame-by-frame Python compositor |

If you need active-speaker tracking (mic + face fused), it's not in this skill — for now the heuristic is "largest face = main subject".

## Dependencies

```bash
pip install mediapipe opencv-python numpy
```

(MediaPipe lives outside the standard Python distribution; ffmpeg and ffprobe must be on `PATH`.)

**First-run model download**: MediaPipe 0.10+ uses the Tasks API, which needs a `blaze_face_short_range.tflite` model file (~230 KB). On the first call, `crop.py` downloads it to `~/.claude/skills/wjs-video-crop/models/` and caches it for subsequent runs. The script will fail offline on first run.

**Range limitation**: BlazeFace short-range is tuned for faces within ~2 m of the camera (selfie / podcast / interview distance). Wide event shots with small faces may not detect — sample a frame first to confirm.

## Crop math

Source aspect = `W / H`. Target aspect = `H / W` (inverted). Compute crop window:

| Source orientation | Crop window |
|---|---|
| Horizontal (W > H) → Portrait | `W_crop = H × H / W`, `H_crop = H` (narrow vertical band) |
| Portrait (W < H) → Horizontal | `W_crop = W`, `H_crop = W × W / H` (narrow horizontal band) |

For 1920×1080 → portrait, `W_crop = 608`, `H_crop = 1080`. Final scale to 1080×1920 (upscale ~1.78×).
For 1080×1920 → landscape, `W_crop = 1080`, `H_crop = 608`. Final scale to 1920×1080.

Override the final size via `--output-size 1080x1920` if you want native crop dimensions instead of upscaling.

## Pipeline

1. **Probe** input dimensions, fps, duration via ffprobe.
2. **Decide orientation** — auto from aspect (`--target portrait|landscape` to override).
3. **Sample frames at 2 fps** by piping ffmpeg's `fps=2` filter to a temp directory of JPEGs.
4. **Face detect** each sampled frame with MediaPipe Tasks `FaceDetector` (BlazeFace short-range model). Pick the largest face (closest to camera) per frame.
5. **Smooth** the face-center track with a moving-average window (default 5 samples).
6. **Chunk** into fixed-duration windows (default 3 s). Within each chunk, take the mean smoothed face center → one crop center per chunk.
7. **Build a ffmpeg piecewise-linear expression** that interpolates the crop-window top-left between chunk midpoints. Hard-clamp to source bounds so the crop never falls off-screen.
8. **Render** one ffmpeg pass — `crop=W:H:x='expr':y='expr', scale=OUT_W:OUT_H`. The crop filter evaluates `x` and `y` per frame natively, so no `eval` flag is needed. Audio stream-copied.

`scripts/crop.py` is the implementation. Output side effects:
- `<input>.crop.json` — sidecar with the crop plan
- `<input>_cropped.mp4` — final cropped + scaled video

## Sidecar schema (`<input>.crop.json`)

```json
{
  "_about": "wjs-video-crop crop plan for cam_a.MOV. Source not modified.",
  "_help": {
    "source_size":   "[width, height] in pixels.",
    "target_size":   "[width, height] of the final rendered output.",
    "crop_window":   "[width, height] of the moving crop in source coords.",
    "chunks":        "List of {t0, t1, cx, cy} — crop center per time window in source coords."
  },
  "schema_version": 1,
  "source": "cam_a.MOV",
  "source_size": [1920, 1080],
  "target": "portrait",
  "target_size": [1080, 1920],
  "crop_window": [608, 1080],
  "chunks": [
    {"t0": 0.0, "t1": 3.0, "cx": 808, "cy": 540},
    {"t0": 3.0, "t1": 6.0, "cx": 822, "cy": 540}
  ],
  "face_sample_count": 1234
}
```

## Performance

- **Detection** is the slow step. On Apple Silicon at 2 fps sampling, expect ~10–20× realtime (a 30-min source detects in ~1–2 min). Bumping `--sample-fps` makes detection slower but tracking more responsive.
- **Render** is fast — single ffmpeg pass with hardware encode (`hevc_videotoolbox` on macOS). Often <1× realtime for a 1080p source.
- For very long sources (>200 chunks), the ffmpeg expression gets cumbersome; the script auto-downsamples chunk midpoints to keep the expression under ~200 control points.

## Common pitfalls

- **No face detected for long stretches** — the script holds the previous chunk's center. If the gap exceeds `--no-face-timeout` (default 10 s), it falls back to source center. Spot-check the output for those stretches.
- **Two faces moving in opposite directions** — the "largest face" heuristic ping-pongs between them. Pre-segment the video (split at the speaker change) and run this skill per segment, then concat.
- **Source has burned-in lower-thirds / subtitles** — for H→V, the lower band gets cropped out; for V→H, it stays but gets stretched. Strip burn-ins before running.
- **Wide-angle / fish-eye lenses** — face detection misses faces near edges. Pre-correct lens distortion with `ffmpeg lenscorrection` first.
- **Upscaling artifacts** — `608×1080 → 1080×1920` is a 1.78× upscale and visible on sharp text. If the source has overlays you want sharp, render at native crop dims (`--output-size 608x1080`) and let the platform upscale.
