#!/usr/bin/env python3
"""Randomly split a video into N segments using ffmpeg.

Usage:
    split.py <video> [-n NUM] [-o OUT_DIR] [--seed SEED] [--reencode]

Default: 10 segments, output in <video_stem>_segments/ next to the input.
"""
import argparse
import json
import random
import subprocess
import sys
from pathlib import Path


def get_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def random_boundaries(duration: float, n: int, min_seg: float) -> list[float]:
    if duration < n * min_seg:
        min_seg = duration / (n * 2)
    for _ in range(500):
        cuts = sorted(random.uniform(0, duration) for _ in range(n - 1))
        boundaries = [0.0, *cuts, duration]
        gaps = [boundaries[i + 1] - boundaries[i] for i in range(n)]
        if min(gaps) >= min_seg:
            return boundaries
    # Fallback: equal spacing with light jitter
    step = duration / n
    jitter = step * 0.1
    cuts = sorted(
        max(min_seg, min(duration - min_seg, step * (i + 1) + random.uniform(-jitter, jitter)))
        for i in range(n - 1)
    )
    return [0.0, *cuts, duration]


def main() -> int:
    p = argparse.ArgumentParser(description="Randomly split a video into N segments.")
    p.add_argument("video", type=Path)
    p.add_argument("-n", "--num", type=int, default=10, help="Number of segments (default 10)")
    p.add_argument("-o", "--out", type=Path, default=None, help="Output directory")
    p.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    p.add_argument("--min-seg", type=float, default=1.0, help="Min segment seconds (default 1.0)")
    p.add_argument("--reencode", action="store_true",
                   help="Re-encode for frame-accurate cuts (slower, larger). Default: stream copy.")
    args = p.parse_args()

    src: Path = args.video
    if not src.exists():
        print(f"File not found: {src}", file=sys.stderr)
        return 1
    if args.num < 2:
        print("--num must be >= 2", file=sys.stderr)
        return 1

    if args.seed is not None:
        random.seed(args.seed)

    out_dir: Path = args.out or src.parent / f"{src.stem}_segments"
    out_dir.mkdir(parents=True, exist_ok=True)

    duration = get_duration(src)
    boundaries = random_boundaries(duration, args.num, args.min_seg)

    suffix = src.suffix or ".mp4"
    width = max(2, len(str(args.num)))
    segments = []
    for i in range(args.num):
        start = boundaries[i]
        end = boundaries[i + 1]
        out_file = out_dir / f"{src.stem}_part{i + 1:0{width}d}{suffix}"
        cmd = ["ffmpeg", "-y", "-loglevel", "error"]
        if args.reencode:
            cmd += ["-i", str(src), "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
                    "-c:v", "libx264", "-c:a", "aac", "-preset", "fast", str(out_file)]
        else:
            # -ss before -i = fast seek; -c copy = no re-encode
            cmd += ["-ss", f"{start:.3f}", "-i", str(src),
                    "-t", f"{end - start:.3f}", "-c", "copy",
                    "-avoid_negative_ts", "make_zero", str(out_file)]
        subprocess.run(cmd, check=True)
        segments.append({
            "index": i + 1,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "path": str(out_file),
        })

    print(json.dumps({
        "input": str(src),
        "duration": round(duration, 3),
        "num_segments": args.num,
        "output_dir": str(out_dir),
        "segments": segments,
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
