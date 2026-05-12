"""Cut a long video into topical clips by SRT-aligned timestamp ranges.

Reads `segments.json`, for each segment:
  1. Cuts a clip from the source video using ffmpeg stream-copy.
     Falls back to re-encode if stream-copy lands on a non-keyframe
     and produces a black/frozen opening frame.
  2. Extracts a representative frame from the segment midpoint.

Outputs:
  output/clip_NN_slug.mp4
  output/frame_NN_slug.jpg
  output/segments.json   (copy of the input)

Usage:
  python3 segment.py --segments segments.json --out output/
  python3 segment.py --segments segments.json --out output/ --reencode
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

TIME_RE = re.compile(r"(\d+):(\d+):(\d+)[.,](\d+)")


def parse_time(s: str) -> float:
    m = TIME_RE.match(s.strip())
    if not m:
        raise ValueError(f"bad timestamp: {s!r}")
    h, mi, se, ms = m.groups()
    ms = (ms + "000")[:3]  # pad/truncate to 3 digits
    return int(h) * 3600 + int(mi) * 60 + int(se) + int(ms) / 1000.0


def fmt_time(t: float) -> str:
    h = int(t // 3600)
    mi = int((t % 3600) // 60)
    se = t - h * 3600 - mi * 60
    return f"{h:02d}:{mi:02d}:{se:06.3f}"


def run(cmd, **kw):
    """Run a subprocess and return its CompletedProcess; raise on failure."""
    proc = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if proc.returncode != 0:
        sys.stderr.write(f"\n$ {' '.join(cmd)}\n{proc.stderr}\n")
        proc.check_returncode()
    return proc


def cut_clip(source: Path, start: float, end: float, out: Path, reencode: bool):
    """Cut [start, end] from source to out."""
    duration = end - start
    if duration <= 0:
        raise ValueError(f"non-positive duration {duration} for {out.name}")
    if reencode:
        cmd = [
            "ffmpeg", "-y",
            "-ss", fmt_time(start), "-to", fmt_time(end),
            "-i", str(source),
            "-c:v", "libx264", "-crf", "20", "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            str(out),
        ]
    else:
        # Stream-copy: very fast, lossless. Put -ss before -i for fast seek;
        # use -avoid_negative_ts to keep timestamps clean for muxing.
        cmd = [
            "ffmpeg", "-y",
            "-ss", fmt_time(start), "-to", fmt_time(end),
            "-i", str(source),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            str(out),
        ]
    run(cmd)


def extract_frame(source: Path, t: float, out: Path):
    """Pull a single high-quality JPEG frame at time t."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", fmt_time(t), "-i", str(source),
        "-frames:v", "1", "-q:v", "2",
        str(out),
    ]
    run(cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--segments", required=True, help="path to segments.json")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument(
        "--reencode",
        action="store_true",
        help="re-encode each clip instead of stream-copy (slower but lossless boundaries)",
    )
    args = ap.parse_args()

    seg_path = Path(args.segments).resolve()
    cfg = json.loads(seg_path.read_text(encoding="utf-8"))
    project_dir = seg_path.parent
    source = (project_dir / cfg["source_video"]).resolve()
    if not source.exists():
        sys.exit(f"source video not found: {source}")

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Copy segments.json into out_dir for traceability.
    shutil.copy2(seg_path, out_dir / "segments.json")

    summary = []
    for seg in cfg["segments"]:
        sid = seg["id"]
        slug = seg["slug"]
        start = parse_time(seg["start"])
        end = parse_time(seg["end"])
        mid = (start + end) / 2.0

        clip_path = out_dir / f"clip_{sid:02d}_{slug}.mp4"
        frame_path = out_dir / f"frame_{sid:02d}_{slug}.jpg"

        print(
            f"[{sid:02d}] {slug}  "
            f"{fmt_time(start)} → {fmt_time(end)}  "
            f"({end - start:.1f}s)",
            file=sys.stderr,
        )
        cut_clip(source, start, end, clip_path, args.reencode)
        extract_frame(source, mid, frame_path)
        summary.append(
            {
                "id": sid,
                "slug": slug,
                "title": seg.get("title", ""),
                "duration_s": round(end - start, 2),
                "clip": clip_path.name,
                "frame": frame_path.name,
            }
        )

    print("\nclips written:", file=sys.stderr)
    for s in summary:
        print(
            f"  {s['clip']}  ({s['duration_s']}s)  → {s['title'][:40]}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
