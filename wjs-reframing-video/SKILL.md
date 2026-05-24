---
name: wjs-reframing-video
description: Use when the user wants to convert a video between horizontal and vertical orientations while preserving the inverted aspect ratio (16:9 ↔ 9:16, 4:3 ↔ 3:4, 21:9 ↔ 9:21). The skill crops a narrow band from the source and tracks the active speaker — the person whose mouth is moving — via MediaPipe face landmarks and mouth-aspect-ratio variance, so the talker stays in frame even when other people are visible. Triggers — "横转竖", "竖转横", "做成竖屏发抖音/视频号/小红书", "16:9 to 9:16", "make this vertical for Reels / TikTok / YouTube Shorts", "crop to portrait", "convert to landscape".
---

# wjs-reframing-video

Convert a video's orientation by **cropping** a narrow band from the source — not by physically rotating it. The crop window follows the **active speaker** (the face whose mouth is *moving*), not just the largest or most-confident face. A `.crop.json` sidecar records the crop plan, the per-segment speaker decisions, and the parameters used. The original input is never modified.

## When to use

- Repurposing a 16:9 podcast / interview / talk for vertical short-video platforms (WeChat Channels 视频号, Douyin 抖音, Xiaohongshu 小红书, YouTube Shorts, TikTok, Reels).
- Repurposing a 9:16 phone recording for horizontal players (YouTube long-form, blog embeds).
- Repurposing 4:3 archive footage for 3:4 mobile, or vice versa.

The output aspect is the source aspect with width and height swapped — 16:9 → 9:16, not "letterboxed 16:9 in a 9:16 frame".

## When NOT to use

- **Multi-person Q&A** where each face needs its own crop — this skill picks one crop track per video. For per-speaker split renders, use **wjs-editing-multicam** instead.
- **Animated content / B-roll with no faces** — falls back to center crop, usually wrong for the intent.
- **Heavy camera motion in the source** (handheld pan/zoom) — the face tracker amplifies camera shake. Stabilize first.
- **Source already at target aspect** — no work to do.

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| **Visual active-speaker detection** via MAR (mouth-aspect-ratio) variance | Audio-visual fusion (audio energy + lip motion cross-correlated) |
| Stable face tracking across frames by center-distance matching | Re-identification across long gaps / occlusions |
| Speaker-aligned segments with hysteresis to prevent flicker | Frame-by-frame switching on every flicker |
| `--face-pick speaker` (default) — pick whoever's mouth is moving | `--face-pick largest` (opt-in legacy) — pick largest face |
| **Hard cuts between segments, fixed crop within each segment** (`--motion cut`, default) | Smooth panning that drifts during a speaker's turn (opt-in `--motion smooth`) |
| Audio stream-copy (bit-exact) | Audio reprocessing / re-encoding |
| MediaPipe Tasks `FaceLandmarker` (478-pt mesh) at 5 fps sampled via ffmpeg | Per-frame neural inpainting / out-painting |
| One `ffmpeg crop + scale` pass | Frame-by-frame Python compositor |

Falls back to "largest face" automatically when no one is talking (silence, music-only stretches).

## Dependencies

```bash
pip install mediapipe opencv-python numpy
```

(MediaPipe lives outside the standard Python distribution; ffmpeg and ffprobe must be on `PATH`.)

**First-run model download**: MediaPipe 0.10+ uses the Tasks API, which needs a `face_landmarker.task` model file (~4 MB). On the first call, `crop.py` downloads it to `~/.claude/skills/wjs-reframing-video/models/` and caches it for subsequent runs. The script fails offline on first run.

**Range limitation**: The bundled landmarker is tuned for faces within ~2 m of the camera (selfie / podcast / interview distance). Wide event shots with small faces may not detect — sample a frame first to confirm.

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
3. **Sample frames at `--sample-fps`** (default 5; high enough to catch mouth motion — Nyquist for speech is ~10 Hz, we need at least 4–5 fps).
4. **Detect face landmarks** per sampled frame with MediaPipe Tasks `FaceLandmarker` (478 landmarks). For each detected face record: center, size proxy, MAR (mouth-aspect-ratio = inner-lip vertical distance / horizontal mouth-corner distance).
5. **Track faces** across frames by center-distance matching → each face gets a stable `face_id`.
6. **Per-sample active speaker**: for each face track, variance of MAR over a sliding window (`--mar-var-window-sec`, default 1 s). The face with the highest variance is "speaking". Below `--mar-var-threshold`, no one is speaking → fall back to largest face.
7. **Hysteresis**: a candidate switch only commits if the new speaker is stable for `--min-segment-sec` (default 1.5 s). Shorter flickers are squashed — prevents the crop from ping-ponging on a one-frame mis-detection.
8. **Speaker-aligned segments** → for each segment, mean (cx, cy) of that speaker's face over the segment becomes the crop center, *fixed* for the full duration of the segment.
9. **Build a ffmpeg step-function expression** (`--motion cut`, default) that holds each segment's crop position constant and **jumps instantly at each segment boundary** — the visual feel of a real cut between camera angles. (`--motion smooth` switches to piecewise-linear pan between segment midpoints; rarely the right call for talking-head content because the camera appears to drift mid-sentence.)
10. **Render** one ffmpeg pass — `crop=W:H:x='expr':y='expr', scale=OUT_W:OUT_H`. The crop filter evaluates `x` and `y` per frame natively. Audio stream-copied.

`scripts/crop.py` is the implementation. Output side effects:
- `<input>.crop.json` — sidecar with the crop plan
- `<input>_cropped.mp4` — final cropped + scaled video

## Sidecar schema (`<input>.crop.json`)

```json
{
  "_about": "wjs-reframing-video crop plan for cam_a.MOV. Active-speaker detected via MAR variance.",
  "_help": {
    "source_size":     "[width, height] in pixels.",
    "target_size":     "[width, height] of the final rendered output.",
    "crop_window":     "[width, height] of the moving crop in source coords.",
    "chunks":          "Speaker-aligned segments: {t0, t1, cx, cy, speaker_id}.",
    "face_pick_mode":  "speaker = MAR-variance active-speaker; largest = old behavior.",
    "speaker_id":      "Stable face track id. null means no face / silence fallback."
  },
  "schema_version": 2,
  "source": "cam_a.MOV",
  "source_size": [1920, 1080],
  "target": "portrait",
  "target_size": [1080, 1920],
  "crop_window": [608, 1080],
  "face_pick_mode": "speaker",
  "sample_fps": 5.0,
  "mar_var_window_sec": 1.0,
  "mar_var_threshold": 1.5e-4,
  "min_segment_sec": 1.5,
  "chunks": [
    {"t0":  0.0, "t1":  4.2, "cx": 808, "cy": 540, "speaker_id": 0},
    {"t0":  4.2, "t1": 11.6, "cx": 1182, "cy": 540, "speaker_id": 1},
    {"t0": 11.6, "t1": 14.0, "cx": 808, "cy": 540, "speaker_id": 0}
  ],
  "face_sample_count": 1234,
  "track_count": 2
}
```

## Performance

- **Detection** is the slow step. On Apple Silicon at 2 fps sampling, expect ~10–20× realtime (a 30-min source detects in ~1–2 min). Bumping `--sample-fps` makes detection slower but tracking more responsive.
- **Render** is fast — single ffmpeg pass with hardware encode (`hevc_videotoolbox` on macOS). Often <1× realtime for a 1080p source.
- For very long sources (>200 chunks), the ffmpeg expression gets cumbersome; the script auto-downsamples chunk midpoints to keep the expression under ~200 control points.

## Common pitfalls

- **Mouth gestures aren't speech** — a yawn, laugh, eating, or sucking-in-air all raise MAR variance. The detector can briefly mistake these for talking. For high-stakes content, eyeball the speaker timeline in the sidecar (the script prints a `face#N: Xs on screen (Y%)` summary) and re-run with a different `--mar-var-threshold` if needed.
- **Side-profile or down-tilted faces** — when a face is rotated >60° from camera, MediaPipe may fail to land mouth landmarks reliably, so MAR variance flatlines. The speaker fallback to "largest face" kicks in. If you have a long stretch of profile shots, consider `--face-pick largest`.
- **Two faces with overlapping speech (interruption / talking over)** — both faces have MAR variance, only one wins. The losing face is treated as listener. For accurate per-speaker tracking under crosstalk, use **wjs-editing-multicam** with separate cams.
- **Long stretches of silence (B-roll, music)** — falls back to largest face. If the largest face is wrong (e.g. a listener stays still while the speaker's mic feeds music), you'll see drift. Pre-segment around music-only sections.
- **Source has burned-in lower-thirds / subtitles** — for H→V, the lower band gets cropped out; for V→H, it stays but gets stretched. Strip burn-ins before running.
- **Wide-angle / fish-eye lenses** — landmarks miss faces near edges. Pre-correct distortion with `ffmpeg lenscorrection` first.
- **Upscaling artifacts** — `608×1080 → 1080×1920` is a 1.78× upscale and visible on sharp text. Render at native crop dims (`--output-size 608x1080`) and let the platform upscale, if you have overlays you want to keep sharp.
- **Output bitrate > platform limit** — default is `--bitrate 12M`. WeChat Channels (视频号) caps at 10 Mbps; pass `--bitrate 8M` for that target.

## Zero-detection fallback: deterministic fixed crop

The "may not detect" range limit isn't just a warning — when MediaPipe
detects **0 faces** (far/static two-person interview, ~2 m+ from a wide
lens), the crop log reads `0 face observations across N sampled frames`
and the script **center-crops the frame** — which on an interview set
lands the window on the *background between the two people* (a fireplace,
a plant, a logo), not on anyone. The output looks broken and no
`--mar-var-threshold` tuning helps, because there are no landmarks at all.

**Always read the crop log before trusting the output.** If it says
`0 face track(s) identified` / `(no face / fallback): … 100%`, abandon
the MediaPipe crop and do a **deterministic fixed crop** instead. The
camera on these shoots is static and the speakers sit at fixed screen
positions, so a hand-set X offset is rock-solid:

```bash
# 1920×1080 → 9:16 ⇒ crop window 608×1080. X = speaker's screen position:
#   left speaker  → x=0      right speaker → x=1920-608=1312      centred → x=656
# Do crop + (HLG→SDR tone-map) + 30fps + dense keyframes in ONE pass so the
# body clip is final and HyperFrames can seek it (see /wjs-overlaying-video).
ZF=~/Library/Python/3.9/.../imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1
"$ZF" -i clip.mp4 -vf \
  "crop=608:1080:0:0,zscale=t=linear:npl=203,format=gbrpf32le,\
tonemap=tonemap=hable:desat=0,\
zscale=w=1080:h=1920:t=bt709:m=bt709:p=bt709:r=tv,format=yuv420p,fps=30" \
  -c:v libx264 -crf 19 -preset medium -g 30 -keyint_min 30 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -movflags +faststart clip_vert.mp4
```

Verify by extracting a frame (`-ss 20 -frames:v 1`) and confirming the
speaker is centred before committing. For clips that genuinely need to
follow *both* speakers (heavy back-and-forth), hand-label per-speaker
windows from the transcript and concatenate fixed crops; for a clip that
is one person's monologue, a single fixed X is enough. Drop the
tonemap filters if the source is already SDR (bt709) — applying the HLG
recipe to SDR mis-colors it.
