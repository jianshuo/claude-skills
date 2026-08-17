#!/usr/bin/env python3
"""Render one book-chapter video: chapter audiobook mp3 + 1-3 GPT-Image-2
stills (Ken Burns slow push) + 中心思想 text overlays, via ffmpeg.

Run with:  uvx --with pillow python render-chapter.py <chapter-dir>
(needs Pillow for text rendering — this machine's ffmpeg has no drawtext)

<chapter-dir> must contain:
    audio.mp3        chapter audiobook narration (VoiceDrop 读书 mp3)
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
XFADE = 1.0                # crossfade seconds between stills
ZOOM_PER_FRAME = 0.00025   # slow push: ~1.09x over 12s
FONT_CANDIDATES = (
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
)


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(out.strip())


def render_text_overlay(out_png: Path, title: str, caption: str, font_path: str):
    """Transparent 1920x1080 PNG: big title + caption, soft shadow."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d_img, d_sh = ImageDraw.Draw(img), ImageDraw.Draw(shadow)
    f_title = ImageFont.truetype(font_path, 104)
    f_cap = ImageFont.truetype(font_path, 50)
    x, y_title, y_cap = 120, H - 350, H - 195
    d_sh.text((x + 4, y_title + 8), title, font=f_title, fill=(0, 0, 0, 200))
    d_img.text((x, y_title), title, font=f_title, fill=(255, 255, 255, 255))
    if caption:
        d_sh.text((x + 3, y_cap + 6), caption, font=f_cap, fill=(0, 0, 0, 180))
        d_img.text((x, y_cap), caption, font=f_cap, fill=(245, 239, 229, 225))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    Image.alpha_composite(shadow, img).save(out_png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter_dir")
    ap.add_argument("--output")
    ap.add_argument("--font", default=None)
    args = ap.parse_args()
    if args.font is None:
        args.font = next((c for c in FONT_CANDIDATES if Path(c).exists()), None)
        if args.font is None:
            sys.exit("no Chinese font found — pass --font")

    cdir = Path(args.chapter_dir).resolve()
    audio = cdir / "audio.mp3"
    ideas_f = cdir / "ideas.json"
    if not audio.exists() or not ideas_f.exists():
        sys.exit(f"need {audio} and {ideas_f}")
    ideas = json.loads(ideas_f.read_text())
    if not 1 <= len(ideas) <= 6:
        sys.exit("ideas.json must have 1-6 entries")

    total = probe_duration(audio)
    n = len(ideas)
    starts = [i.get("start") for i in ideas]
    if any(s is None for s in starts):
        starts = [total * k / n for k in range(n)]
    ends = starts[1:] + [total]
    durs = [e - s for s, e in zip(starts, ends)]
    if min(durs) <= XFADE + 3:
        sys.exit(f"segment too short ({min(durs):.1f}s) — fewer ideas or fix starts")

    inputs, filters = [], []
    # inputs 0..n-1: stills with Ken Burns
    for k, idea in enumerate(ideas):
        img = cdir / idea["image"]
        if not img.exists():
            sys.exit(f"missing image {img}")
        seg = durs[k] + (XFADE if k < n - 1 else 0)
        frames = int(seg * FPS)
        inputs += ["-loop", "1", "-t", f"{seg:.3f}", "-i", str(img)]
        # force 16:9 by upscale + center-crop (codex images come in odd aspects;
        # zoompan would squash any non-16:9 input)
        filters.append(
            f"[{k}:v]scale=3840:2160:force_original_aspect_ratio=increase,"
            f"crop=3840:2160,zoompan=z='min(zoom+{ZOOM_PER_FRAME},1.12)'"
            f":d={frames}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{k}]")

    # chain xfades between stills
    prev, offset = "v0", 0.0
    for k in range(1, n):
        offset += durs[k - 1]
        out = f"x{k}" if k < n - 1 else "vx"
        filters.append(
            f"[{prev}][v{k}]xfade=transition=fade:duration={XFADE}"
            f":offset={offset:.3f}[{out}]")
        prev = out
    if n == 1:
        filters.append("[v0]copy[vx]")

    # inputs n..2n-1: pre-rendered text overlays (Pillow), alpha fade in/out,
    # PTS-shifted into place; eof_action=pass keeps the base going outside.
    base = "vx"
    for k, idea in enumerate(ideas):
        ov_png = cdir / f"overlay-{k+1}.png"
        render_text_overlay(ov_png, idea["title"], idea.get("caption", ""), args.font)
        t0 = starts[k] + 0.8
        seg = max(2.5, ends[k] - 0.5 - t0)
        inputs += ["-loop", "1", "-t", f"{seg:.3f}", "-i", str(ov_png)]
        out = f"o{k}" if k < n - 1 else "vout"
        filters.append(
            f"[{n + k}:v]format=rgba,fade=t=in:st=0:d=1:alpha=1,"
            f"fade=t=out:st={seg - 1:.3f}:d=1:alpha=1,fps={FPS},"
            f"setpts=PTS-STARTPTS+{t0:.3f}/TB[ov{k}]")
        filters.append(f"[{base}][ov{k}]overlay=0:0:eof_action=pass[{out}]")
        base = out

    output = Path(args.output) if args.output else cdir / "chapter.mp4"
    cmd = (["ffmpeg", "-y", "-v", "error", "-stats"] + inputs + ["-i", str(audio),
           "-filter_complex", ";".join(filters),
           "-map", "[vout]", "-map", f"{2 * n}:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19",
           "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", str(output)])
    print(f"[render-chapter] {n} stills over {total:.0f}s audio → {output.name}")
    subprocess.check_call(cmd)
    print(f"[render-chapter] ✓ {output}")


if __name__ == "__main__":
    main()
