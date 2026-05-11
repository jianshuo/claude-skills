#!/usr/bin/env python3
"""wjs-video-crop — convert video orientation by face-tracked cropping.

Output: cropped + scaled MP4, plus a `.crop.json` sidecar with the crop plan.
The original input is never modified.

Usage:
    python crop.py INPUT.mp4 \
        [--target auto|portrait|landscape] \
        [--out OUTPUT.mp4] \
        [--sample-fps 2] \
        [--chunk-sec 3] \
        [--smooth-window 5] \
        [--no-face-timeout 10] \
        [--output-size 1080x1920] \
        [--encoder hevc_videotoolbox] \
        [--bitrate 12M]

Requires: ffmpeg, ffprobe on PATH; mediapipe + opencv-python + numpy pip-installed.
"""
import argparse, json, math, subprocess, sys, tempfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

SCHEMA_VERSION = 1

# MediaPipe 0.10+ ships only the Tasks API; the legacy `mp.solutions` namespace
# is gone. The Tasks API needs a downloadable model file (~200 KB), cached in
# the skill dir so subsequent runs are offline.
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_detector/"
    "blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
)
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "blaze_face_short_range.tflite"


def ensure_face_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading face detector model -> {MODEL_PATH}")
    import urllib.request
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


# --- input probing ---

def probe(path: Path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,avg_frame_rate",
         "-show_entries", "format=duration",
         "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    )
    data = json.loads(out.stdout)
    stream = data["streams"][0]
    w = int(stream["width"])
    h = int(stream["height"])
    num, den = stream["avg_frame_rate"].split("/")
    fps = float(num) / max(1.0, float(den)) if float(den) > 0 else 30.0
    dur = float(data["format"]["duration"])
    return w, h, fps, dur


def compute_crop_window(src_w, src_h, target):
    """Crop window for target orientation. Output is (crop_w, crop_h, target_resolved).

    The target aspect is the source aspect's W/H inverted. The crop window has
    one dimension equal to the smaller source dimension; the other shrinks so
    (crop_w / crop_h) == (src_h / src_w).
    """
    if target == "auto":
        target = "portrait" if src_w > src_h else "landscape"
    if target == "portrait":
        crop_h = src_h
        crop_w = round(src_h * src_h / src_w)
    else:  # landscape
        crop_w = src_w
        crop_h = round(src_w * src_w / src_h)
    # Even dimensions (yuv420p requirement)
    crop_w += crop_w % 2
    crop_h += crop_h % 2
    return crop_w, crop_h, target


def default_output_size(target):
    return (1080, 1920) if target == "portrait" else (1920, 1080)


# --- face detection ---

def detect_faces(input_path: Path, sample_fps: float):
    """Sample frames via ffmpeg at sample_fps, run MediaPipe face_detection,
    return [(t_seconds, norm_x, norm_y, norm_size)] for the largest face per
    frame (skipped if no face detected)."""
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        # ffmpeg extracts JPEGs at sample_fps — much faster than decoding
        # every frame via cv2 when we only need 2 fps.
        subprocess.run(
            ["ffmpeg", "-nostdin", "-y", "-i", str(input_path),
             "-vf", f"fps={sample_fps}", "-q:v", "3",
             str(td / "f_%06d.jpg")],
            check=True, stderr=subprocess.DEVNULL,
        )
        frames = sorted(td.glob("f_*.jpg"))
        mp_fd = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5,
        )
        samples = []
        for i, fp in enumerate(frames):
            t = i / sample_fps
            img = cv2.imread(str(fp))
            if img is None:
                continue
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            res = mp_fd.process(rgb)
            if not res.detections:
                continue
            # Largest face = closest to camera = main subject (heuristic)
            best = max(
                res.detections,
                key=lambda d: (
                    d.location_data.relative_bounding_box.width
                    * d.location_data.relative_bounding_box.height
                ),
            )
            box = best.location_data.relative_bounding_box
            cx = box.xmin + box.width / 2
            cy = box.ymin + box.height / 2
            size = math.sqrt(max(0.0, box.width * box.height))
            samples.append((t, cx, cy, size))
        mp_fd.close()
    return samples


# --- smoothing & chunking ---

def smooth_track(samples, src_w, src_h, smooth_window):
    """Convert normalized face samples into smoothed (t, x_px, y_px) tuples."""
    if not samples:
        return []
    times = np.array([s[0] for s in samples])
    xs = np.array([s[1] * src_w for s in samples])
    ys = np.array([s[2] * src_h for s in samples])
    if smooth_window > 1 and len(xs) >= smooth_window:
        k = np.ones(smooth_window) / smooth_window
        xs = np.convolve(xs, k, mode="same")
        ys = np.convolve(ys, k, mode="same")
    return list(zip(times.tolist(), xs.tolist(), ys.tolist()))


def chunk_crop_centers(smoothed, chunk_sec, total_dur, src_w, src_h,
                        no_face_timeout):
    """Per chunk, mean smoothed center. Fall back to last good center if no
    samples in chunk; if gap exceeds no_face_timeout, recenter on source mid."""
    n_chunks = max(1, int(math.ceil(total_dur / chunk_sec)))
    chunks = []
    last_good_t = -1e9
    last_cx = src_w / 2
    last_cy = src_h / 2
    arr = np.array(smoothed) if smoothed else np.empty((0, 3))
    for i in range(n_chunks):
        t0 = i * chunk_sec
        t1 = min((i + 1) * chunk_sec, total_dur)
        cx = cy = None
        if len(arr):
            mask = (arr[:, 0] >= t0) & (arr[:, 0] < t1)
            in_chunk = arr[mask]
            if len(in_chunk):
                cx = float(in_chunk[:, 1].mean())
                cy = float(in_chunk[:, 2].mean())
                last_good_t = t1
                last_cx, last_cy = cx, cy
        if cx is None:
            if (t0 - last_good_t) <= no_face_timeout:
                cx, cy = last_cx, last_cy
            else:
                cx, cy = src_w / 2, src_h / 2
        chunks.append({"t0": t0, "t1": t1, "cx": cx, "cy": cy})
    return chunks


# --- ffmpeg expression builder ---

def build_crop_expr(chunks, axis, crop_dim, src_dim, max_control_points=200):
    """Build an ffmpeg `crop` x or y expression that linearly interpolates the
    crop window's top-left coordinate between chunk midpoints. Hard-clamped to
    [0, src_dim - crop_dim].

    axis: 'cx' (drive crop x) or 'cy' (drive crop y).
    """
    if not chunks:
        return f"{max(0.0, (src_dim - crop_dim) / 2):.2f}"

    # Build (t_midpoint, topleft) control points
    mids = []
    for ch in chunks:
        tmid = (ch["t0"] + ch["t1"]) / 2
        center = ch[axis]
        topleft = max(0.0, min(src_dim - crop_dim, center - crop_dim / 2))
        mids.append((tmid, topleft))

    # Cap control points to keep the expression string sane
    if len(mids) > max_control_points:
        step = math.ceil(len(mids) / max_control_points)
        mids = mids[::step]

    if len(mids) == 1:
        return f"{mids[0][1]:.2f}"

    parts = []
    # Before first midpoint — hold first value
    parts.append(f"lt(t,{mids[0][0]:.3f})*{mids[0][1]:.2f}")
    # Piecewise linear interp between consecutive midpoints
    for i in range(len(mids) - 1):
        t0, v0 = mids[i]
        t1, v1 = mids[i + 1]
        dt = max(1e-6, t1 - t0)
        parts.append(
            f"between(t,{t0:.3f},{t1:.3f})*"
            f"({v0:.2f}+({v1 - v0:.2f})*(t-{t0:.3f})/{dt:.3f})"
        )
    # After last midpoint — hold last value
    parts.append(f"gte(t,{mids[-1][0]:.3f})*{mids[-1][1]:.2f}")
    return "(" + "+".join(parts) + ")"


# --- main ---

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--out", type=Path, default=None,
                    help="Output path (default: <input>_cropped.mp4)")
    ap.add_argument("--target", choices=["auto", "portrait", "landscape"], default="auto")
    ap.add_argument("--sample-fps", type=float, default=2.0,
                    help="Face detection sample rate")
    ap.add_argument("--chunk-sec", type=float, default=3.0,
                    help="Crop window holds within each chunk; interpolates between")
    ap.add_argument("--smooth-window", type=int, default=5,
                    help="Moving-average window in samples (1 to disable)")
    ap.add_argument("--no-face-timeout", type=float, default=10.0,
                    help="Seconds without a face before recentering to source middle")
    ap.add_argument("--output-size", default=None,
                    help="Override final size, e.g. 1080x1920. Default scales to "
                         "platform standard (1080x1920 or 1920x1080).")
    ap.add_argument("--encoder", default="hevc_videotoolbox",
                    help="ffmpeg video encoder (e.g. libx264 for portability)")
    ap.add_argument("--bitrate", default="12M")
    args = ap.parse_args()

    src_w, src_h, src_fps, src_dur = probe(args.input)
    print(f"Input:  {args.input.name}  {src_w}x{src_h}  {src_fps:.2f} fps  {src_dur:.1f}s")

    crop_w, crop_h, target = compute_crop_window(src_w, src_h, args.target)
    print(f"Target: {target}  crop window {crop_w}x{crop_h}")

    if args.output_size:
        try:
            out_w, out_h = (int(x) for x in args.output_size.lower().split("x"))
        except ValueError:
            sys.exit(f"--output-size must be WxH (got {args.output_size!r})")
    else:
        out_w, out_h = default_output_size(target)
    print(f"Output: {out_w}x{out_h}")

    print(f"Detecting faces at {args.sample_fps} fps...")
    samples = detect_faces(args.input, args.sample_fps)
    print(f"  {len(samples)} face samples")

    smoothed = smooth_track(samples, src_w, src_h, args.smooth_window)
    chunks = chunk_crop_centers(
        smoothed, args.chunk_sec, src_dur, src_w, src_h, args.no_face_timeout,
    )
    print(f"Crop plan: {len(chunks)} chunks of {args.chunk_sec}s each")

    crop_x_expr = build_crop_expr(chunks, "cx", crop_w, src_w)
    crop_y_expr = build_crop_expr(chunks, "cy", crop_h, src_h)

    # Sidecar
    sidecar = args.input.with_suffix(args.input.suffix + ".crop.json")
    sidecar.write_text(json.dumps({
        "_about": (
            f"wjs-video-crop crop plan for {args.input.name}. "
            "Original file is not modified."
        ),
        "_help": {
            "source_size": "[width, height] in pixels.",
            "target_size": "[width, height] of the final rendered output.",
            "crop_window": "[width, height] of the moving crop in source coords.",
            "chunks": "List of {t0, t1, cx, cy} — crop center per time window.",
        },
        "schema_version": SCHEMA_VERSION,
        "source": args.input.name,
        "source_size": [src_w, src_h],
        "target": target,
        "target_size": [out_w, out_h],
        "crop_window": [crop_w, crop_h],
        "chunks": chunks,
        "face_sample_count": len(samples),
    }, indent=2, ensure_ascii=False))
    print(f"Sidecar: {sidecar}")

    out_path = args.out or args.input.with_name(f"{args.input.stem}_cropped.mp4")
    vf = (
        f"crop={crop_w}:{crop_h}:x='{crop_x_expr}':y='{crop_y_expr}':eval=frame,"
        f"scale={out_w}:{out_h}"
    )
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-i", str(args.input),
        "-filter:v", vf,
        "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v", "hvc1",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ]
    print(f"Rendering: {out_path}")
    subprocess.run(cmd, check=True)
    print("Done.")


if __name__ == "__main__":
    main()
