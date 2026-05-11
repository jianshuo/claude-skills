"""Prepend a cover image as a still title-card intro to a video.

Speed strategy: encode JUST the 1.5s intro to match the body's codec
parameters exactly, then concat-demuxer + stream-copy. The body is
never re-encoded. A 2-minute body clip takes ~1-2 seconds to process
instead of ~30-60 seconds with full re-encode.

Falls back to filter-graph concat + re-encode (the old behavior) if
the body's codec / parameters can't be reproduced (rare).

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
  python3 prepend_intro.py --segments segments.json --out output/ --reencode

Usage (standalone):
  python3 prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4
  python3 prepend_intro.py --clip in.mp4 --cover c.png --out out.mp4 --duration 2.0
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def find_ffmpeg():
    for p in [os.environ.get("FFMPEG"), "/tmp/ff_bin/ffmpeg", shutil.which("ffmpeg")]:
        if p and Path(p).exists():
            return p
    sys.exit("ffmpeg not found")


def ffprobe_path(ffmpeg):
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")
    if Path(ffprobe).exists():
        return ffprobe
    return shutil.which("ffprobe") or "ffprobe"


def probe_streams(ffmpeg, clip):
    """Return dict with codec params for video + audio streams."""
    ffprobe = ffprobe_path(ffmpeg)
    proc = subprocess.run(
        [ffprobe, "-v", "error", "-show_streams", "-show_format",
         "-of", "json", str(clip)],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(proc.stdout)
    info = {"video": None, "audio": None}
    for s in data.get("streams", []):
        t = s.get("codec_type")
        if t == "video" and info["video"] is None:
            info["video"] = s
        elif t == "audio" and info["audio"] is None:
            info["audio"] = s
    return info


def parse_fps(rate_str):
    """'30000/1001' -> 29.97, '30/1' -> 30.0, '30' -> 30.0."""
    if "/" in rate_str:
        n, d = rate_str.split("/")
        return float(n) / float(d) if float(d) else 30.0
    return float(rate_str)


def encode_intro(ffmpeg, cover_path, intro_path, duration, vinfo, ainfo):
    """Encode the still cover to a tiny mp4 whose codec/params match the
    body clip exactly, so it can be concat-demuxed with -c copy."""
    w = int(vinfo["width"])
    h = int(vinfo["height"])
    fps = parse_fps(vinfo.get("r_frame_rate") or vinfo.get("avg_frame_rate") or "30/1")
    pix_fmt = vinfo.get("pix_fmt", "yuv420p")
    profile_raw = (vinfo.get("profile") or "").lower()
    profile = "high" if "high" in profile_raw else "main" if "main" in profile_raw else "baseline" if "baseline" in profile_raw else "high"

    # Match audio params (or default to stereo 48k AAC if body has no audio).
    if ainfo:
        ar = int(ainfo.get("sample_rate", 48000))
        ch = int(ainfo.get("channels", 2))
        a_codec = ainfo.get("codec_name", "aac")
        a_bitrate = ainfo.get("bit_rate")
    else:
        ar, ch, a_codec, a_bitrate = 48000, 2, "aac", None

    cl = "stereo" if ch == 2 else ("mono" if ch == 1 else f"{ch}c")

    cmd = [
        ffmpeg, "-y",
        "-loop", "1", "-t", f"{duration:.3f}", "-i", str(cover_path),
        "-f", "lavfi", "-t", f"{duration:.3f}",
        "-i", f"anullsrc=channel_layout={cl}:sample_rate={ar}",
        "-vf",
        (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"setsar=1,fps={fps},format={pix_fmt}"
        ),
        "-c:v", "libx264", "-profile:v", profile, "-preset", "fast", "-crf", "18",
        "-pix_fmt", pix_fmt, "-r", f"{fps}",
        "-c:a", a_codec, "-ar", str(ar), "-ac", str(ch),
    ]
    if a_bitrate:
        try:
            cmd += ["-b:a", f"{int(a_bitrate)}"]
        except Exception:
            cmd += ["-b:a", "192k"]
    else:
        cmd += ["-b:a", "192k"]
    cmd += ["-movflags", "+faststart", str(intro_path)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-2000:])
        proc.check_returncode()


def concat_stream_copy(ffmpeg, intro_path, body_path, out_path):
    """Concat-demuxer with -c copy. Fails fast if codec params don't match."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(f"file '{intro_path.resolve()}'\n")
        f.write(f"file '{body_path.resolve()}'\n")
        list_path = Path(f.name)
    try:
        proc = subprocess.run(
            [ffmpeg, "-y", "-f", "concat", "-safe", "0",
             "-i", str(list_path),
             "-c", "copy", "-movflags", "+faststart", str(out_path)],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            sys.stderr.write(proc.stderr[-2000:])
        return proc.returncode == 0
    finally:
        list_path.unlink(missing_ok=True)


def prepend_fast(ffmpeg, clip_path, cover_path, duration, out_path):
    """Fast path: encode intro to match body, then concat-demuxer + stream copy."""
    info = probe_streams(ffmpeg, clip_path)
    vinfo, ainfo = info["video"], info["audio"]
    if not vinfo:
        return False
    with tempfile.TemporaryDirectory() as td:
        intro = Path(td) / "intro.mp4"
        try:
            encode_intro(ffmpeg, cover_path, intro, duration, vinfo, ainfo)
        except subprocess.CalledProcessError:
            return False
        if not intro.exists() or intro.stat().st_size == 0:
            return False
        return concat_stream_copy(ffmpeg, intro, clip_path, out_path)


def prepend_slow(ffmpeg, clip_path, cover_path, duration, out_path, target_w, target_h):
    """Fallback: re-encode the whole video with filter-graph concat. Slow
    but always works regardless of body codec parameters."""
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


def prepend(ffmpeg, clip_path, cover_path, duration, out_path, force_reencode=False):
    """Try fast path first; fall back to re-encode if it fails."""
    if not force_reencode:
        if prepend_fast(ffmpeg, clip_path, cover_path, duration, out_path):
            return "stream-copy"
    info = probe_streams(ffmpeg, clip_path)
    vinfo = info.get("video") or {}
    w = int(vinfo.get("width") or 1080)
    h = int(vinfo.get("height") or 1920)
    prepend_slow(ffmpeg, clip_path, cover_path, duration, out_path, w, h)
    return "re-encoded"


def main():
    ap = argparse.ArgumentParser(
        description="Prepend a cover image as a 1.5s title-card to a video.",
    )
    ap.add_argument("--segments", help="batch mode: path to segments.json")
    ap.add_argument("--out", required=True,
                    help="output dir (batch) or output file (standalone)")
    ap.add_argument("--clip", help="standalone mode: single input video")
    ap.add_argument("--cover", help="standalone mode: cover image to prepend")
    ap.add_argument(
        "--duration", type=float, default=1.5,
        help="seconds to hold the cover as still intro (default 1.5)",
    )
    ap.add_argument(
        "--no-burned", action="store_true",
        help="(batch) prepend onto the raw clip even if a *_burned.mp4 exists",
    )
    ap.add_argument(
        "--reencode", action="store_true",
        help="force the slow fallback (re-encode entire output). Useful if "
             "concat-demuxer + stream-copy fails for codec-mismatch reasons.",
    )
    args = ap.parse_args()

    standalone = bool(args.clip or args.cover)
    batch = bool(args.segments)
    if standalone == batch:
        sys.exit("pass EITHER --segments (batch) OR --clip + --cover (standalone)")

    ffmpeg = find_ffmpeg()

    if standalone:
        if not (args.clip and args.cover):
            sys.exit("standalone mode needs both --clip and --cover")
        clip_in = Path(args.clip).resolve()
        cover = Path(args.cover).resolve()
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        info = probe_streams(ffmpeg, clip_in)
        vinfo = info.get("video") or {}
        w, h = int(vinfo.get("width") or 0), int(vinfo.get("height") or 0)
        mode = prepend(ffmpeg, clip_in, cover, args.duration, out_path, args.reencode)
        print(f"{clip_in.name} ({w}x{h}) + {cover.name} → {out_path.name}  [{mode}]",
              file=sys.stderr)
        return

    cfg = json.loads(Path(args.segments).read_text(encoding="utf-8"))
    out_dir = Path(args.out).resolve()

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
        info = probe_streams(ffmpeg, clip_in)
        vinfo = info.get("video") or {}
        w, h = int(vinfo.get("width") or 0), int(vinfo.get("height") or 0)
        mode = prepend(ffmpeg, clip_in, cover, args.duration, out_path, args.reencode)
        print(f"[{sid:02d}] {slug}: {clip_in.name} ({w}x{h}) + cover → {out_name}  [{mode}]",
              file=sys.stderr)


if __name__ == "__main__":
    main()
