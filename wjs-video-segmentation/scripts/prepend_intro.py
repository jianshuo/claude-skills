"""Prepend a cover image as a still title-card intro to a video.

Two modes:

  BATCH mode (read segments.json):
    For each segment with both a cover and a clip in `output/`, prepend
    `cover_NN_slug.png` as a still in front of `clip_NN_slug.mp4`
    (or its `_burned.mp4` variant if subtitles were already burned).

  STANDALONE mode (single file, no segments.json):
    Prepend any cover image in front of any clip. Useful when you've
    cropped/edited a clip outside the segmentation pipeline.

Common: the still period plays silence; the clip's audio starts cleanly
at the moment the live footage begins. Many short-video platforms grab
the literal first frame as the auto-thumbnail — by making the cover the
first frame, you lock in your chosen thumbnail by construction.

Usage (batch):
  python3 prepend_intro.py --segments segments.json --out output/
  python3 prepend_intro.py --segments segments.json --out output/ --duration 2.0
  python3 prepend_intro.py --segments segments.json --out output/ --no-burned

Usage (standalone):
  python3 prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4
  python3 prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4 --duration 2.0
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def find_ffmpeg():
    for p in [os.environ.get("FFMPEG"), "/tmp/ff_bin/ffmpeg", shutil.which("ffmpeg")]:
        if p and Path(p).exists():
            return p
    sys.exit("ffmpeg not found")


def probe_resolution(ffmpeg, clip):
    # Use ffprobe alongside the chosen ffmpeg if possible; fall back to ffmpeg -i.
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if not Path(ffprobe).exists():
        ffprobe = shutil.which("ffprobe") or "ffprobe"
    proc = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "default=noprint_wrappers=1:nokey=1", str(clip)],
        capture_output=True, text=True,
    )
    proc.check_returncode()
    parts = [p.strip() for p in proc.stdout.split() if p.strip()]
    return int(parts[0]), int(parts[1])


def prepend(ffmpeg, clip_path, cover_path, duration, out_path, target_w, target_h):
    """Prepend the cover image as a still for `duration` seconds before the clip."""
    cmd = [
        ffmpeg, "-y",
        "-loop", "1", "-t", f"{duration:.3f}", "-i", str(cover_path),
        "-i", str(clip_path),
        "-f", "lavfi", "-t", f"{duration:.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-filter_complex",
        (
            f"[0:v]scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"setsar=1,fps=30,format=yuv420p[intro_v];"
            f"[1:v]scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"setsar=1,fps=30,format=yuv420p[clip_v];"
            f"[intro_v][2:a][clip_v][1:a]concat=n=2:v=1:a=1[outv][outa]"
        ),
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        str(out_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-3000:])
        proc.check_returncode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--segments", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--duration",
        type=float,
        default=1.5,
        help="seconds to hold the cover as still intro (default 1.5)",
    )
    ap.add_argument(
        "--no-burned",
        action="store_true",
        help="prepend onto the raw clip even if a *_burned.mp4 exists",
    )
    args = ap.parse_args()

    cfg = json.loads(Path(args.segments).read_text(encoding="utf-8"))
    out_dir = Path(args.out).resolve()
    ffmpeg = find_ffmpeg()

    for seg in cfg["segments"]:
        sid, slug = seg["id"], seg["slug"]
        cover = out_dir / f"cover_{sid:02d}_{slug}.png"
        if not cover.exists():
            print(f"[{sid:02d}] {slug}: cover missing — run make_cover.py first", file=sys.stderr)
            continue

        burned = out_dir / f"clip_{sid:02d}_{slug}_burned.mp4"
        raw = out_dir / f"clip_{sid:02d}_{slug}.mp4"
        if not args.no_burned and burned.exists():
            clip_in = burned
            out_name = f"clip_{sid:02d}_{slug}_burned_intro.mp4"
        elif raw.exists():
            clip_in = raw
            out_name = f"clip_{sid:02d}_{slug}_intro.mp4"
        else:
            print(f"[{sid:02d}] {slug}: no input clip found", file=sys.stderr)
            continue

        out_path = out_dir / out_name
        w, h = probe_resolution(ffmpeg, clip_in)
        print(f"[{sid:02d}] {slug}: {clip_in.name} ({w}x{h}) + cover → {out_name}", file=sys.stderr)
        prepend(ffmpeg, clip_in, cover, args.duration, out_path, w, h)


if __name__ == "__main__":
    main()
