---
name: wjs-video-split
description: Use when the user wants to randomly split a video file into multiple segments (default 10) of varying lengths — triggers include "把视频分成N段", "随机切分视频", "split video into N clips", "随机分割", "切成几段".
---

# video-split

Randomly split one video into N segments (default 10) at random cut points. Uses ffmpeg stream copy by default — fast and lossless.

## When to Use

- User has a video and wants to break it into N pieces with **random** boundaries.
- User says "随机分成 N 段" / "split into N random clips".

**NOT for:**
- **Topic-based** segmentation (use `video-segmentation` skill).
- **Fixed-duration** equal chunks (use `ffmpeg -f segment -segment_time` directly).
- Adding overlays / titles (use `video-overlay`).

## Quick Reference

```bash
python3 ~/.claude/skills/video-split/split.py <video>                    # 10 random segments
python3 ~/.claude/skills/video-split/split.py <video> -n 5               # 5 segments
python3 ~/.claude/skills/video-split/split.py <video> -o ./out           # custom output dir
python3 ~/.claude/skills/video-split/split.py <video> --seed 42          # reproducible cuts
python3 ~/.claude/skills/video-split/split.py <video> --reencode         # frame-accurate (slower)
```

Output: `<video_stem>_segments/<stem>_partNN.<ext>` plus a JSON manifest on stdout.

## How It Works

1. `ffprobe` reads the duration.
2. Picks `N-1` uniform-random cut points, retrying until every segment is ≥ `--min-seg` seconds (default 1s).
3. Calls `ffmpeg` once per segment with `-c copy` (stream copy — no re-encode, ~instant).

## Notes

- **Stream copy caveat:** cuts snap to the nearest keyframe before the requested time, so segment lengths are approximate. For frame-accurate cuts pass `--reencode` (re-encodes to H.264/AAC; slower, larger files).
- Default min segment is 1s; if `duration < N × min_seg`, the script auto-shrinks `min_seg`.
- Pass `--seed` for reproducible random boundaries.
- Output directory defaults to `<input_dir>/<stem>_segments/` and is created if missing.
