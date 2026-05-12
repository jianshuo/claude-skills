#!/usr/bin/env python3
"""wjs-reframing-video — convert video orientation by face-tracked cropping.

The crop window follows the ACTIVE SPEAKER — detected via mouth-motion variance
across tracked face landmarks. "Active speaker" means the face whose mouth is
*moving* in the last ~1 s, not the face whose mouth is widest. (A laugh has a
high static MAR but low variance; speech has bouncing MAR.)

Output: cropped + scaled MP4, plus a `.crop.json` sidecar with the crop plan
and per-segment speaker decisions. The original input is never modified.

Usage:
    python crop.py INPUT.mp4 \
        [--target auto|portrait|landscape] \
        [--out OUTPUT.mp4] \
        [--sample-fps 5] \
        [--min-segment-sec 1.5] \
        [--mar-var-window-sec 1.0] \
        [--mar-var-threshold 1.5e-4] \
        [--face-pick speaker|largest] \
        [--no-face-timeout 10] \
        [--output-size 1080x1920] \
        [--encoder hevc_videotoolbox] \
        [--bitrate 12M]

Requires: ffmpeg, ffprobe on PATH; mediapipe + opencv-python + numpy pip-installed.
"""
import argparse, json, math, subprocess, sys, tempfile
from collections import defaultdict
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

SCHEMA_VERSION = 2  # bump: now records per-segment speaker_id + MAR variance

# MediaPipe FaceLandmarker model — gives 478 face landmarks including mouth.
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "face_landmarker.task"

# FaceMesh landmark indices for inner mouth (more sensitive to speech than outer)
LM_UPPER_INNER_LIP = 13   # inner mouth top center
LM_LOWER_INNER_LIP = 14   # inner mouth bottom center
LM_LEFT_MOUTH_CORNER = 78
LM_RIGHT_MOUTH_CORNER = 308

# Bounding-box approximation: we use eye-distance landmarks for face size
LM_LEFT_EYE_OUTER = 33
LM_RIGHT_EYE_OUTER = 263
LM_NOSE_TIP = 4
LM_CHIN = 152
LM_FOREHEAD = 10


def ensure_face_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading face landmarker model -> {MODEL_PATH}")
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
    if target == "auto":
        target = "portrait" if src_w > src_h else "landscape"
    if target == "portrait":
        crop_h = src_h
        crop_w = round(src_h * src_h / src_w)
    else:
        crop_w = src_w
        crop_h = round(src_w * src_w / src_h)
    crop_w += crop_w % 2
    crop_h += crop_h % 2
    return crop_w, crop_h, target


def default_output_size(target):
    return (1080, 1920) if target == "portrait" else (1920, 1080)


# --- face detection + landmarks ---

def detect_face_landmarks(input_path: Path, sample_fps: float, num_faces: int = 5):
    """Sample frames via ffmpeg at sample_fps, run MediaPipe FaceLandmarker.

    Returns:
        sample_times: list of t_seconds, one per sampled frame
        per_frame_faces: list of lists; per_frame_faces[i] = list of dicts
            {cx, cy, size, mar, bbox} in normalized [0,1] coords.
    """
    model_path = ensure_face_model()
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        subprocess.run(
            ["ffmpeg", "-nostdin", "-y", "-i", str(input_path),
             "-vf", f"fps={sample_fps}", "-q:v", "3",
             str(td / "f_%06d.jpg")],
            check=True, stderr=subprocess.DEVNULL,
        )
        frames = sorted(td.glob("f_*.jpg"))
        base_opts = mp_python.BaseOptions(model_asset_path=str(model_path))
        options = mp_vision.FaceLandmarkerOptions(
            base_options=base_opts,
            num_faces=num_faces,
        )
        landmarker = mp_vision.FaceLandmarker.create_from_options(options)

        sample_times = []
        per_frame_faces = []
        for i, fp in enumerate(frames):
            t = i / sample_fps
            img = cv2.imread(str(fp))
            if img is None:
                sample_times.append(t)
                per_frame_faces.append([])
                continue
            h, w = img.shape[:2]
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect(mp_image)

            faces = []
            for face_lms in (result.face_landmarks or []):
                # landmarks are normalized [0,1]
                p_upper = face_lms[LM_UPPER_INNER_LIP]
                p_lower = face_lms[LM_LOWER_INNER_LIP]
                p_left = face_lms[LM_LEFT_MOUTH_CORNER]
                p_right = face_lms[LM_RIGHT_MOUTH_CORNER]
                p_chin = face_lms[LM_CHIN]
                p_forehead = face_lms[LM_FOREHEAD]
                p_left_eye = face_lms[LM_LEFT_EYE_OUTER]
                p_right_eye = face_lms[LM_RIGHT_EYE_OUTER]

                # MAR (inner-lip aspect ratio): vertical / horizontal mouth distance
                vert = abs(p_lower.y - p_upper.y)
                horiz = max(1e-6, abs(p_right.x - p_left.x))
                mar = vert / horiz

                # Face size (proxy): eye-to-eye + chin-to-forehead in normalized coords
                eye_dist = math.hypot(p_right_eye.x - p_left_eye.x,
                                       p_right_eye.y - p_left_eye.y)
                face_height = math.hypot(p_chin.x - p_forehead.x,
                                          p_chin.y - p_forehead.y)
                size = eye_dist * face_height

                # Face center: centroid of a few stable points
                cx = (p_left_eye.x + p_right_eye.x + p_chin.x + p_forehead.x) / 4
                cy = (p_left_eye.y + p_right_eye.y + p_chin.y + p_forehead.y) / 4

                faces.append({"cx": cx, "cy": cy, "size": size, "mar": mar})
            sample_times.append(t)
            per_frame_faces.append(faces)
        landmarker.close()
    return sample_times, per_frame_faces


# --- face tracking across frames ---

def track_faces(per_frame_faces, max_match_dist: float = 0.15,
                max_gap_frames: int = 10):
    """Assign stable face IDs by nearest-center matching across sampled frames.

    Returns:
        tracks: dict {face_id: list of (sample_idx, face_dict)}
    """
    tracks = defaultdict(list)
    last_seen = {}  # face_id -> (sample_idx, (cx, cy))
    next_id = 0

    for fi, faces in enumerate(per_frame_faces):
        unmatched = set(range(len(faces)))

        # Match each existing track to the nearest face within tolerance
        # (process closest-first to avoid greedy lock-in on the wrong face)
        candidates = []
        for fid, (last_fi, (lcx, lcy)) in last_seen.items():
            if fi - last_fi > max_gap_frames:
                continue
            for ui in range(len(faces)):
                f = faces[ui]
                d = math.hypot(f["cx"] - lcx, f["cy"] - lcy)
                if d < max_match_dist:
                    candidates.append((d, fid, ui))
        candidates.sort()
        claimed_ui = set()
        claimed_fid = set()
        for d, fid, ui in candidates:
            if fid in claimed_fid or ui in claimed_ui:
                continue
            tracks[fid].append((fi, faces[ui]))
            last_seen[fid] = (fi, (faces[ui]["cx"], faces[ui]["cy"]))
            claimed_fid.add(fid)
            claimed_ui.add(ui)
            unmatched.discard(ui)

        # Spawn new tracks for unmatched faces
        for ui in unmatched:
            f = faces[ui]
            fid = next_id
            next_id += 1
            tracks[fid].append((fi, f))
            last_seen[fid] = (fi, (f["cx"], f["cy"]))

    return dict(tracks)


# --- active speaker detection ---

def mar_series_for_track(track):
    """Return parallel arrays (sample_idx, mar) for a face track."""
    idx = np.array([s for s, _ in track])
    mar = np.array([f["mar"] for _, f in track])
    return idx, mar


def mar_variance_at(track_idx, track_mar, sample_idx, window_samples):
    """Variance of MAR in [sample_idx - W/2, sample_idx + W/2] for this track."""
    lo = sample_idx - window_samples // 2
    hi = sample_idx + window_samples // 2
    mask = (track_idx >= lo) & (track_idx <= hi)
    if mask.sum() < 3:
        return None
    return float(np.var(track_mar[mask]))


def detect_active_speaker(tracks, n_samples, var_window_samples, var_threshold):
    """For each sample index, pick the face with the highest MAR variance over
    the window. Returns list of (active_face_id_or_None, scores_dict) per sample."""
    track_arrays = {fid: mar_series_for_track(t) for fid, t in tracks.items()}
    out = []
    for si in range(n_samples):
        scores = {}
        for fid, (idx, mar) in track_arrays.items():
            v = mar_variance_at(idx, mar, si, var_window_samples)
            if v is not None:
                scores[fid] = v
        if not scores:
            out.append((None, {}))
            continue
        best_fid = max(scores, key=scores.get)
        if scores[best_fid] < var_threshold:
            out.append((None, scores))
        else:
            out.append((best_fid, scores))
    return out


def largest_face_at(per_frame_faces, sample_idx, tracks):
    """Fallback: face_id of the largest face at sample_idx. None if no faces."""
    faces = per_frame_faces[sample_idx]
    if not faces:
        return None
    # Find biggest face
    best_face = max(faces, key=lambda f: f["size"])
    # Map back to track id by matching center
    best_fid = None
    best_d = float("inf")
    for fid, track in tracks.items():
        for s_idx, f in track:
            if s_idx == sample_idx:
                d = math.hypot(f["cx"] - best_face["cx"], f["cy"] - best_face["cy"])
                if d < best_d:
                    best_d = d
                    best_fid = fid
                break
    return best_fid


def speaker_segments(sample_times, speakers, per_frame_faces, tracks,
                     min_segment_sec, face_pick_mode, no_face_timeout_sec):
    """Group consecutive samples by speaker. Apply min-segment hysteresis,
    fall back to largest-face when no active speaker (or per face_pick_mode)."""
    if not sample_times:
        return []
    n = len(sample_times)
    # Build per-sample chosen face_id with fallback
    chosen = [None] * n
    last_active_t = -1e9
    last_active_fid = None
    for i in range(n):
        active_fid, _ = speakers[i]
        if face_pick_mode == "largest":
            chosen[i] = largest_face_at(per_frame_faces, i, tracks)
        elif active_fid is not None:
            chosen[i] = active_fid
            last_active_t = sample_times[i]
            last_active_fid = active_fid
        else:
            # No active speaker right now. Hold last active if recent.
            if (sample_times[i] - last_active_t) <= no_face_timeout_sec and last_active_fid is not None:
                chosen[i] = last_active_fid
            else:
                chosen[i] = largest_face_at(per_frame_faces, i, tracks)

    # Apply hysteresis: don't switch unless current candidate has been stable
    # for min_segment_sec.
    sample_dt = (sample_times[-1] - sample_times[0]) / max(1, n - 1)
    min_samples = max(1, int(round(min_segment_sec / sample_dt)))
    segments = []
    seg_start_i = 0
    cur_speaker = chosen[0]
    i = 0
    while i < n:
        # Find the longest run of identical "candidate" speakers
        run_end = i
        while run_end + 1 < n and chosen[run_end + 1] == chosen[i]:
            run_end += 1
        run_len = run_end - i + 1
        if chosen[i] != cur_speaker and run_len < min_samples and run_end + 1 < n:
            # Short flicker — squash by overwriting with cur_speaker.
            for j in range(i, run_end + 1):
                chosen[j] = cur_speaker
        elif chosen[i] != cur_speaker:
            # Stable change — commit previous segment, start new one.
            segments.append((sample_times[seg_start_i], sample_times[i], cur_speaker))
            seg_start_i = i
            cur_speaker = chosen[i]
        i = run_end + 1
    segments.append((sample_times[seg_start_i], sample_times[-1], cur_speaker))
    return segments


# --- chunk → crop center ---

def segments_to_chunks(segments, tracks, src_w, src_h):
    """For each segment, compute crop center = mean (cx, cy) of segment's
    speaker face across the segment's time range. Outputs are in source pixels."""
    chunks = []
    track_lookup = {fid: t for fid, t in tracks.items()}
    for (t0, t1, fid) in segments:
        if fid is None or fid not in track_lookup:
            chunks.append({
                "t0": float(t0), "t1": float(t1),
                "cx": src_w / 2, "cy": src_h / 2, "speaker_id": None,
            })
            continue
        # Pick samples for this face within this time window
        cxs, cys = [], []
        for s_idx, f in track_lookup[fid]:
            # We need the sample's time, which is s_idx * (1/sample_fps).
            # But we don't have sample_times here. Use a closure or pass times in.
            # Simpler: caller stores t in face dict. We don't yet — let's store t directly.
            t = f.get("_t")
            if t is not None and t0 <= t <= t1:
                cxs.append(f["cx"] * src_w)
                cys.append(f["cy"] * src_h)
        if cxs:
            cx = float(np.mean(cxs))
            cy = float(np.mean(cys))
        else:
            cx, cy = src_w / 2, src_h / 2
        chunks.append({
            "t0": float(t0), "t1": float(t1),
            "cx": cx, "cy": cy, "speaker_id": int(fid),
        })
    return chunks


def _topleft(ch, axis, crop_dim, src_dim):
    return max(0.0, min(src_dim - crop_dim, ch[axis] - crop_dim / 2))


def build_crop_expr_cut(chunks, axis, crop_dim, src_dim):
    """Step-function ffmpeg expression: each chunk holds a constant crop
    position; transitions between chunks are instant hard cuts. This is the
    default — pans inside a speaker segment add no information and look like
    an AI artifact. Real editors cut, not pan."""
    if not chunks:
        return f"{max(0.0, (src_dim - crop_dim) / 2):.2f}"
    parts = []
    for i, ch in enumerate(chunks):
        tl = _topleft(ch, axis, crop_dim, src_dim)
        if i == len(chunks) - 1:
            # Catch t >= last chunk's t0 (extends past the nominal end)
            parts.append(f"gte(t,{ch['t0']:.3f})*{tl:.2f}")
        else:
            # Half-open [t0, t1): avoids double-counting at boundaries
            parts.append(
                f"(gte(t,{ch['t0']:.3f})*lt(t,{ch['t1']:.3f}))*{tl:.2f}"
            )
    return "(" + "+".join(parts) + ")"


def build_crop_expr_smooth(chunks, axis, crop_dim, src_dim, max_control_points=200):
    """Piecewise-linear pan between chunk midpoints. Opt-in via --motion smooth.
    Useful for solo speaker who moves around but should never cut to themselves.
    Default is hard cut (build_crop_expr_cut)."""
    if not chunks:
        return f"{max(0.0, (src_dim - crop_dim) / 2):.2f}"

    mids = []
    for ch in chunks:
        tmid = (ch["t0"] + ch["t1"]) / 2
        tl = _topleft(ch, axis, crop_dim, src_dim)
        mids.append((tmid, tl))

    if len(mids) > max_control_points:
        step = math.ceil(len(mids) / max_control_points)
        mids = mids[::step]

    if len(mids) == 1:
        return f"{mids[0][1]:.2f}"

    parts = []
    parts.append(f"lt(t,{mids[0][0]:.3f})*{mids[0][1]:.2f}")
    for i in range(len(mids) - 1):
        t0, v0 = mids[i]
        t1, v1 = mids[i + 1]
        dt = max(1e-6, t1 - t0)
        parts.append(
            f"between(t,{t0:.3f},{t1:.3f})*"
            f"({v0:.2f}+({v1 - v0:.2f})*(t-{t0:.3f})/{dt:.3f})"
        )
    parts.append(f"gte(t,{mids[-1][0]:.3f})*{mids[-1][1]:.2f}")
    return "(" + "+".join(parts) + ")"


# --- main ---

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--target", choices=["auto", "portrait", "landscape"], default="auto")
    ap.add_argument("--sample-fps", type=float, default=5.0,
                    help="Face landmark sample rate. Needs to be high enough to "
                         "capture mouth motion (Nyquist for speech ~10 Hz). Default 5.")
    ap.add_argument("--min-segment-sec", type=float, default=1.5,
                    help="Minimum segment length before switching speakers; "
                         "shorter candidates get squashed (hysteresis)")
    ap.add_argument("--mar-var-window-sec", type=float, default=1.0,
                    help="Time window over which MAR variance is computed")
    ap.add_argument("--mar-var-threshold", type=float, default=1.5e-4,
                    help="Minimum MAR variance to count as 'speaking'. Below "
                         "this, fall back per --face-pick mode.")
    ap.add_argument("--face-pick", choices=["speaker", "largest"], default="speaker",
                    help="speaker = mouth-motion active-speaker; largest = old "
                         "behavior (largest face per frame, no speaker logic)")
    ap.add_argument("--motion", choices=["cut", "smooth"], default="cut",
                    help="cut = hard cut between segments, fixed crop within "
                         "each (default — looks like real editing). smooth = "
                         "piecewise-linear pan between segment midpoints "
                         "(can look like an AI artifact in talking-head content)")
    ap.add_argument("--num-faces", type=int, default=5,
                    help="Max faces to track per frame")
    ap.add_argument("--no-face-timeout", type=float, default=10.0)
    ap.add_argument("--output-size", default=None)
    ap.add_argument("--encoder", default="hevc_videotoolbox")
    ap.add_argument("--bitrate", default="12M")
    args = ap.parse_args()

    src_w, src_h, src_fps, src_dur = probe(args.input)
    print(f"Input:  {args.input.name}  {src_w}x{src_h}  {src_fps:.2f} fps  {src_dur:.1f}s")

    crop_w, crop_h, target = compute_crop_window(src_w, src_h, args.target)
    print(f"Target: {target}  crop window {crop_w}x{crop_h}")

    if args.output_size:
        out_w, out_h = (int(x) for x in args.output_size.lower().split("x"))
    else:
        out_w, out_h = default_output_size(target)
    print(f"Output: {out_w}x{out_h}")

    print(f"Detecting face landmarks at {args.sample_fps} fps "
          f"(up to {args.num_faces} faces / frame)...")
    sample_times, per_frame_faces = detect_face_landmarks(
        args.input, args.sample_fps, num_faces=args.num_faces,
    )
    # Annotate faces with their sample time for downstream segments_to_chunks
    for si, (t, faces) in enumerate(zip(sample_times, per_frame_faces)):
        for f in faces:
            f["_t"] = t
    total_faces = sum(len(fs) for fs in per_frame_faces)
    print(f"  {total_faces} face observations across {len(sample_times)} sampled frames")

    tracks = track_faces(per_frame_faces)
    print(f"  {len(tracks)} face track(s) identified "
          f"(lengths: {sorted([len(t) for t in tracks.values()], reverse=True)[:5]})")

    var_window_samples = max(3, int(round(args.mar_var_window_sec * args.sample_fps)))
    if args.face_pick == "speaker":
        speakers = detect_active_speaker(
            tracks, len(sample_times), var_window_samples, args.mar_var_threshold,
        )
        n_active = sum(1 for fid, _ in speakers if fid is not None)
        print(f"  active-speaker resolved in {n_active}/{len(speakers)} samples")
    else:
        speakers = [(None, {})] * len(sample_times)
        print("  --face-pick largest: skipping active-speaker detection")

    segments = speaker_segments(
        sample_times, speakers, per_frame_faces, tracks,
        args.min_segment_sec, args.face_pick, args.no_face_timeout,
    )
    print(f"  {len(segments)} speaker segments")
    # Print speaker timeline summary
    seg_dur_by_speaker = defaultdict(float)
    for (t0, t1, fid) in segments:
        seg_dur_by_speaker[fid] += (t1 - t0)
    for fid, d in sorted(seg_dur_by_speaker.items(), key=lambda x: -x[1]):
        label = f"face#{fid}" if fid is not None else "(no face / fallback)"
        print(f"    {label}: {d:.1f}s on screen ({100*d/src_dur:.0f}%)")

    chunks = segments_to_chunks(segments, tracks, src_w, src_h)
    expr_builder = build_crop_expr_cut if args.motion == "cut" else build_crop_expr_smooth
    crop_x_expr = expr_builder(chunks, "cx", crop_w, src_w)
    crop_y_expr = expr_builder(chunks, "cy", crop_h, src_h)
    print(f"  motion mode: {args.motion}")

    # Sidecar
    sidecar = args.input.with_suffix(args.input.suffix + ".crop.json")
    sidecar.write_text(json.dumps({
        "_about": (
            f"wjs-reframing-video crop plan for {args.input.name}. "
            "Active-speaker detected via MAR variance; original file is not modified."
        ),
        "_help": {
            "source_size":  "[width, height] in pixels.",
            "target_size":  "[width, height] of the final rendered output.",
            "crop_window":  "[width, height] of the moving crop in source coords.",
            "chunks":       "Speaker-aligned segments: {t0, t1, cx, cy, speaker_id}.",
            "face_pick_mode": "speaker = MAR-variance active-speaker; largest = old behavior.",
            "speaker_id":   "Stable face track id assigned by frame-to-frame matching. "
                            "null means no face / silence fallback.",
        },
        "schema_version": SCHEMA_VERSION,
        "source": args.input.name,
        "source_size": [src_w, src_h],
        "target": target,
        "target_size": [out_w, out_h],
        "crop_window": [crop_w, crop_h],
        "face_pick_mode": args.face_pick,
        "motion": args.motion,
        "sample_fps": args.sample_fps,
        "mar_var_window_sec": args.mar_var_window_sec,
        "mar_var_threshold": args.mar_var_threshold,
        "min_segment_sec": args.min_segment_sec,
        "chunks": chunks,
        "face_sample_count": total_faces,
        "track_count": len(tracks),
    }, indent=2, ensure_ascii=False))
    print(f"Sidecar: {sidecar}")

    out_path = args.out or args.input.with_name(f"{args.input.stem}_cropped.mp4")
    vf = (
        f"crop={crop_w}:{crop_h}:x='{crop_x_expr}':y='{crop_y_expr}',"
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
