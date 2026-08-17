#!/usr/bin/env python3
"""Render one book-chapter video: chapter audiobook mp3 + 1-3 GPT-Image-2
stills (Ken Burns slow push) + 中心思想 text overlays, via ffmpeg.

Usage:
    render-chapter.py <chapter-dir> [--output out.mp4] [--font /path/font.ttc]

<chapter-dir> must contain:
    audio.mp3        chapter audiobook narration (from VoiceDrop 读书 mp3)
    ideas.json       [{"title": "≤12字标题", "caption": "一句阐释",
                       "image": "img-1.png", "start": 0}, ...]
                     "start" (seconds) optional — omitted → segments split
                     the audio evenly.
    img-*.png        one 1920x1088 (or larger) image per idea

Output: <chapter-dir>/chapter.mp4 (1920x1080, 30fps, aac) unless --output.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

FPS = 30
W, H = 1920, 1080
XFADE = 1.0          # crossfade seconds between stills
ZOOM_PER_FRAME = 0.00025   # slow push: ~1.09x over 12s


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(out.strip())


def esc(text: str) -> str:
    """Escape for ffmpeg drawtext."""
    return (text.replace("\\", "\\\\").replace(":", "\\:")
                .replace("'", "\\'").replace("%", "\\%"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter_dir")
    ap.add_argument("--output")
    ap.add_argument("--font", default="/System/Library/Fonts/PingFang.ttc")
    args = ap.parse_args()

    cdir = Path(args.chapter_dir).resolve()
    audio = cdir / "audio.mp3"
    ideas_f = cdir / "ideas.json"
    if not audio.exists() or not ideas_f.exists():
        sys.exit(f"need {audio} and {ideas_f}")
    ideas = json.loads(ideas_f.read_text())
    if not 1 <= len(ideas) <= 6:
        sys.exit("ideas.json must have 1-6 entries")
    font = Path(args.font)
    if not font.exists():
        sys.exit(f"font not found: {font}")

    total = probe_duration(audio)
    n = len(ideas)
    # Segment start times: explicit "start" or even split
    starts = [i.get("start") for i in ideas]
    if any(s is None for s in starts):
        starts = [total * k / n for k in range(n)]
    ends = starts[1:] + [total]
    durs = [e - s for s, e in zip(starts, ends)]
    if min(durs) <= XFADE + 1:
        sys.exit(f"segment too short ({min(durs):.1f}s) — fewer ideas or fix starts")

    inputs, filters = [], []
    for k, idea in enumerate(ideas):
        img = cdir / idea["image"]
        if not img.exists():
            sys.exit(f"missing image {img}")
        # each still is looped; overlap adds XFADE to all but the last
        seg = durs[k] + (XFADE if k < n - 1 else 0)
        frames = int(seg * FPS)
        inputs += ["-loop", "1", "-t", f"{seg:.3f}", "-i", str(img)]
        # upscale before zoompan to avoid jitter, slow push-in
        filters.append(
            f"[{k}:v]scale=3840:-2,zoompan=z='min(zoom+{ZOOM_PER_FRAME},1.12)'"
            f":d={frames}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{k}]")

    # chain xfades
    prev = "v0"
    offset = 0.0
    for k in range(1, n):
        offset += durs[k - 1]
        out = f"x{k}" if k < n - 1 else "vx"
        filters.append(
            f"[{prev}][v{k}]xfade=transition=fade:duration={XFADE}"
            f":offset={offset:.3f}[{out}]")
        prev = out
    if n == 1:
        filters.append("[v0]copy[vx]")

    # drawtext overlays: title (大字) + caption, fade via alpha ramp
    label_in = "vx"
    for k, idea in enumerate(ideas):
        t0, t1 = starts[k] + 0.8, ends[k] - 0.5
        alpha = (f"if(lt(t,{t0}),0,if(lt(t,{t0}+1),(t-{t0})/1,"
                 f"if(lt(t,{t1}-1),1,if(lt(t,{t1}),({t1}-t)/1,0))))")
        out = f"t{k}" if k < n - 1 else "vout"
        dt = (
            f"drawtext=fontfile='{font}':text='{esc(idea['title'])}'"
            f":fontsize=110:fontcolor=white:borderw=3:bordercolor=black@0.35"
            f":shadowx=0:shadowy=6:shadowcolor=black@0.5"
            f":x=120:y=h-360:alpha='{alpha}'")
        if idea.get("caption"):
            dt += (
                f",drawtext=fontfile='{font}':text='{esc(idea['caption'])}'"
                f":fontsize=52:fontcolor=white@0.85:borderw=2"
                f":bordercolor=black@0.35:x=124:y=h-200:alpha='{alpha}'")
        filters.append(f"[{label_in}]{dt}[{out}]")
        label_in = out

    output = Path(args.output) if args.output else cdir / "chapter.mp4"
    cmd = (["ffmpeg", "-y"] + inputs + ["-i", str(audio),
           "-filter_complex", ";".join(filters),
           "-map", "[vout]", "-map", f"{n}:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19",
           "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(output)])
    print("[render-chapter]", " ".join(cmd[:8]), f"... ({n} stills, {total:.0f}s)")
    subprocess.check_call(cmd)
    print(f"[render-chapter] ✓ {output}")


if __name__ == "__main__":
    main()
