"""Slice the full-video SRT into per-clip SRTs and burn-in to each clip.

Reads `segments.json`. For each segment:
  1. Reads the full-video SRT (default: <source_srt>'s `*.burn.srt`
     companion if present, else <source_srt>; override with --srt).
  2. Keeps cues that overlap [start, end], clamps boundaries, and
     shifts timestamps so the new SRT starts at 00:00:00.000.
  3. Writes `output/clip_NN_slug.zh-CN.burn.srt`.
  4. Burns those subtitles into the existing
     `output/clip_NN_slug.mp4`, producing
     `output/clip_NN_slug_burned.mp4`.

Step 4 needs an ffmpeg built with libass. The script auto-detects:
  - $FFMPEG env var
  - /tmp/ff_bin/ffmpeg (the path used by translate-video skill)
  - whichever ffmpeg is on PATH, only if its `-filters` output
    advertises `subtitles`/`ass`.

If none has libass and --no-burn was not passed, the script exits
with a hint to download a static build.

Usage:
  python3 burn_subs.py --segments segments.json --out output/
  python3 burn_subs.py --segments segments.json --out output/ --srt my.srt
  python3 burn_subs.py --segments segments.json --out output/ --no-burn
  python3 burn_subs.py --segments segments.json --out output/ --style 'Fontsize=22,MarginV=80'
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

TIME_RE = re.compile(r"(\d+):(\d+):(\d+)[.,](\d+)")

DEFAULT_STYLE = (
    "Fontname=STHeiti SC,Fontsize=18,"
    "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
    "BorderStyle=1,Outline=2,Shadow=1,"
    "MarginL=60,MarginR=60,MarginV=60"
)


def parse(s):
    m = TIME_RE.search(s)
    if not m:
        raise ValueError(f"bad timestamp: {s!r}")
    h, mi, se, ms = m.groups()
    ms = (ms + "000")[:3]
    return int(h) * 3600 + int(mi) * 60 + int(se) + int(ms) / 1000.0


def fmt(t):
    if t < 0:
        t = 0
    h = int(t // 3600)
    mi = int((t % 3600) // 60)
    se = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000:
        ms = 0
        se += 1
    return f"{h:02d}:{mi:02d}:{se:02d},{ms:03d}"


def parse_srt(text):
    blocks = re.split(r"\n\s*\n", text.strip())
    cues = []
    for b in blocks:
        lines = [ln for ln in b.splitlines() if ln.strip() != ""]
        if len(lines) < 2:
            continue
        timing = lines[1] if "-->" in lines[1] else lines[0]
        text_lines = lines[2:] if "-->" in lines[1] else lines[1:]
        try:
            s_str, e_str = timing.split("-->")
        except ValueError:
            continue
        cues.append((parse(s_str), parse(e_str), "\n".join(text_lines).strip()))
    return cues


def slice_for_segment(cues, seg_start, seg_end):
    out = []
    for cs, ce, t in cues:
        if ce <= seg_start or cs >= seg_end:
            continue
        new_s = max(cs, seg_start) - seg_start
        new_e = min(ce, seg_end) - seg_start
        if new_e - new_s < 0.05:
            continue
        out.append((new_s, new_e, t))
    return out


def write_srt(cues, path: Path):
    lines = []
    for i, (s, e, t) in enumerate(cues, 1):
        lines.append(str(i))
        lines.append(f"{fmt(s)} --> {fmt(e)}")
        lines.append(t)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def find_ffmpeg_with_libass():
    candidates = [os.environ.get("FFMPEG"), "/tmp/ff_bin/ffmpeg", shutil.which("ffmpeg")]
    for p in candidates:
        if not p or not Path(p).exists():
            continue
        try:
            out = subprocess.run([p, "-filters"], capture_output=True, text=True)
            if "subtitles" in out.stdout:
                return p
        except OSError:
            continue
    return None


def escape_for_filter(s: str) -> str:
    """Escape commas inside the force_style chain so ffmpeg's filtergraph
    parser doesn't treat them as filter-chain separators.
    """
    return s.replace(",", r"\,")


def burn_one(ffmpeg: str, clip_in: Path, srt: Path, clip_out: Path, style: str):
    style_escaped = escape_for_filter(style)
    cmd = [
        ffmpeg, "-y",
        "-i", str(clip_in),
        "-fps_mode", "cfr", "-r", "30",
        "-vf", f"subtitles={srt}:force_style='{style_escaped}'",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        str(clip_out),
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
        "--srt",
        default=None,
        help="full-video SRT (default: <source_srt>.burn.srt → <source_srt>)",
    )
    ap.add_argument(
        "--style",
        default=DEFAULT_STYLE,
        help="libass force_style string; commas auto-escaped",
    )
    ap.add_argument(
        "--no-burn",
        action="store_true",
        help="only write per-clip SRTs; skip the libx264 burn-in",
    )
    args = ap.parse_args()

    seg_path = Path(args.segments).resolve()
    cfg = json.loads(seg_path.read_text(encoding="utf-8"))
    project_dir = seg_path.parent
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Resolve full SRT path.
    if args.srt:
        srt_full = Path(args.srt).resolve()
    else:
        base = cfg.get("source_srt")
        if not base:
            sys.exit("segments.json has no source_srt; pass --srt explicitly")
        candidates = []
        if base.endswith(".srt"):
            candidates.append(project_dir / (base[:-4] + ".burn.srt"))
        candidates.append(project_dir / base)
        srt_full = next((c for c in candidates if c.exists()), None)
        if not srt_full:
            sys.exit(f"no SRT found at any of: {[str(c) for c in candidates]}")

    print(f"using full SRT: {srt_full}", file=sys.stderr)
    cues = parse_srt(srt_full.read_text(encoding="utf-8"))
    print(f"loaded {len(cues)} cues", file=sys.stderr)

    ffmpeg = None
    if not args.no_burn:
        ffmpeg = find_ffmpeg_with_libass()
        if not ffmpeg:
            sys.exit(
                "no libass-enabled ffmpeg found. Either:\n"
                "  - export FFMPEG=/path/to/ffmpeg-with-libass\n"
                "  - drop a static build to /tmp/ff_bin/ffmpeg "
                "(e.g. https://evermeet.cx/ffmpeg/getrelease/zip)\n"
                "  - or re-run with --no-burn to only emit per-clip SRTs"
            )
        print(f"using ffmpeg: {ffmpeg}", file=sys.stderr)

    for seg in cfg["segments"]:
        sid, slug = seg["id"], seg["slug"]
        s = parse(seg["start"])
        e = parse(seg["end"])
        sliced = slice_for_segment(cues, s, e)
        srt_path = out_dir / f"clip_{sid:02d}_{slug}.zh-CN.burn.srt"
        write_srt(sliced, srt_path)
        print(f"[{sid:02d}] {slug}: {len(sliced)} cues → {srt_path.name}", file=sys.stderr)

        if args.no_burn:
            continue

        clip_in = out_dir / f"clip_{sid:02d}_{slug}.mp4"
        clip_out = out_dir / f"clip_{sid:02d}_{slug}_burned.mp4"
        if not clip_in.exists():
            print(f"  skip burn: {clip_in.name} not found (run segment.py first)", file=sys.stderr)
            continue
        # Run from out_dir so the relative SRT path is short and free
        # of unicode pitfalls in the filtergraph string.
        cwd = os.getcwd()
        os.chdir(out_dir)
        try:
            burn_one(
                ffmpeg,
                Path(clip_in.name),
                Path(srt_path.name),
                Path(clip_out.name),
                args.style,
            )
        finally:
            os.chdir(cwd)
        print(f"  burned → {clip_out.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
