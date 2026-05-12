#!/usr/bin/env python3
"""Visual speaker diarization via mouth-movement detection.

Reads a video + an SRT, detects up to N faces per frame using
MediaPipe Face Mesh, clusters them by horizontal screen position into
speakers (left = A, right = B), measures each face's mouth aperture
over time, and integrates frame-to-frame mouth movement within each
SRT cue's [start, end] window. The face with the most movement during
a cue wins that cue's speaker tag.

Outputs a tagged SRT with `[A]`/`[B]` prefixes and a JSON report of
per-cue scores so you can spot-check ambiguous calls.

Usage:
  visual_diarize.py --video V.mp4 --srt CLEAN.srt --out TAGGED.srt
                    [--sample-fps 5] [--num-speakers 2]
                    [--report report.json]
"""
import argparse, json, re, sys
from pathlib import Path

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# MediaPipe Tasks API needs a model file. Use a stable cache location.
MODEL_PATH = Path("/tmp/mp_models/face_landmarker.task")
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/"
             "face_landmarker/face_landmarker/float16/1/face_landmarker.task")


def ensure_model():
    if MODEL_PATH.exists():
        return
    import urllib.request
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {MODEL_URL} → {MODEL_PATH}", file=sys.stderr)
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def ts_to_sec(ts):
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000


def parse_srt(text):
    out = []
    for b in re.split(r"\n\s*\n", text.strip()):
        lines = b.strip().splitlines()
        if len(lines) < 3:
            continue
        idx = lines[0]
        m = re.match(r"(\S+)\s+-->\s+(\S+)", lines[1])
        out.append({
            "idx": idx,
            "time_line": lines[1],
            "start": ts_to_sec(m.group(1)),
            "end": ts_to_sec(m.group(2)),
            # Strip any pre-existing [X] tag from cue text — we'll re-tag
            "text": re.sub(r'^\[[A-Za-z][A-Za-z0-9_-]*\]\s*',
                           '', "\n".join(lines[2:])),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--srt", required=True, help="clean SRT (no [X] tags)")
    ap.add_argument("--out", required=True, help="output tagged SRT")
    ap.add_argument("--sample-fps", type=float, default=5.0,
                    help="frames per second to sample (default 5)")
    ap.add_argument("--num-speakers", type=int, default=2)
    ap.add_argument("--labels", default="A,B,C,D,E",
                    help="comma-separated labels in left-to-right order")
    ap.add_argument("--report", default=None,
                    help="write per-cue diarization JSON for spot-checking")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = n_frames / fps
    print(f"video: {duration:.1f}s @ {fps:.2f}fps, {n_frames} frames", file=sys.stderr)

    # Sample every Nth frame
    step = max(1, int(round(fps / args.sample_fps)))
    actual_sample_fps = fps / step
    print(f"sampling every {step} frames ({actual_sample_fps:.2f}fps)", file=sys.stderr)

    ensure_model()
    base = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base,
        running_mode=mp_vision.RunningMode.VIDEO,
        num_faces=args.num_speakers,
        min_face_detection_confidence=0.4,
        min_face_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    # Per-frame: collect (face_center_x, mouth_aperture) for each detected face
    timeline = []  # list of (timestamp, [(cx, aperture), ...])
    fi = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if fi % step == 0:
            ts = fi / fps
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, int(ts * 1000))
            faces = []
            for lm_list in result.face_landmarks:
                # Use nose-tip x (idx 1) as horizontal anchor
                cx = lm_list[1].x
                # Mouth aperture: inner upper (13) - inner lower (14)
                upper = lm_list[13]
                lower = lm_list[14]
                aperture = abs(upper.y - lower.y)
                faces.append((cx, aperture))
            timeline.append((ts, faces))
        fi += 1
    cap.release()
    landmarker.close()
    print(f"sampled {len(timeline)} frames", file=sys.stderr)

    # Cluster face positions: simple bucket along x-axis. For 2 speakers,
    # split at the median of all detected face_center_x. For N>2, use
    # equal-percentile bins.
    all_cx = np.array([cx for _, faces in timeline for cx, _ in faces])
    if all_cx.size == 0:
        sys.exit("no faces detected anywhere — diarization not possible")

    n = args.num_speakers
    quantiles = np.linspace(0, 1, n + 1)
    bin_edges = np.quantile(all_cx, quantiles)
    bin_edges[0] -= 1e-6
    bin_edges[-1] += 1e-6
    labels = args.labels.split(",")[:n]
    print(f"x-bin edges: {bin_edges.round(3).tolist()} → labels {labels}",
          file=sys.stderr)

    # Per-frame per-speaker aperture
    apertures = {lab: [] for lab in labels}
    timestamps = []
    for ts, faces in timeline:
        timestamps.append(ts)
        per = {lab: np.nan for lab in labels}
        for cx, ap in faces:
            # Find which bin this face falls in
            bin_idx = np.searchsorted(bin_edges, cx, side='right') - 1
            bin_idx = max(0, min(n - 1, bin_idx))
            lab = labels[bin_idx]
            # If multiple faces hit the same bin (shouldn't happen for a
            # well-posed scene), keep the larger aperture
            cur = per[lab]
            per[lab] = ap if np.isnan(cur) else max(cur, ap)
        for lab in labels:
            apertures[lab].append(per[lab])

    timestamps = np.array(timestamps)
    movement = {}
    for lab in labels:
        a = np.array(apertures[lab], dtype=float)
        # Forward-fill NaNs so diff isn't blasted to NaN at gaps
        # (a missing detection ≠ no movement; we just don't know)
        diff = np.zeros_like(a)
        for i in range(1, len(a)):
            if not np.isnan(a[i]) and not np.isnan(a[i-1]):
                diff[i] = abs(a[i] - a[i-1])
            # else 0 (insufficient data)
        movement[lab] = diff

    # Per cue: integrate movement
    cues = parse_srt(Path(args.srt).read_text())
    report = []
    for cue in cues:
        mask = (timestamps >= cue["start"]) & (timestamps < cue["end"])
        scores = {lab: float(np.nansum(movement[lab][mask])) for lab in labels}
        max_lab = max(scores, key=scores.get)
        # Confidence: ratio of winner to runner-up
        sorted_v = sorted(scores.values(), reverse=True)
        ratio = (sorted_v[0] / sorted_v[1]) if len(sorted_v) > 1 and sorted_v[1] > 0 else float('inf')
        report.append({
            "idx": cue["idx"],
            "time": cue["time_line"],
            "start": cue["start"],
            "end": cue["end"],
            "scores": scores,
            "speaker": max_lab,
            "confidence_ratio": ratio,
            "frames_in_cue": int(mask.sum()),
        })

    # Write tagged SRT
    with open(args.out, "w") as f:
        for cue, r in zip(cues, report):
            f.write(f"{cue['idx']}\n{cue['time_line']}\n[{r['speaker']}] {cue['text']}\n\n")

    # Print summary
    counts = {}
    for r in report:
        counts[r["speaker"]] = counts.get(r["speaker"], 0) + 1
    print(f"\nspeaker assignments: {counts}", file=sys.stderr)
    print(f"low-confidence cues (ratio < 1.5):", file=sys.stderr)
    for r in report:
        if r["confidence_ratio"] < 1.5:
            print(f"  cue {r['idx']} → [{r['speaker']}] "
                  f"scores={r['scores']} ratio={r['confidence_ratio']:.2f}",
                  file=sys.stderr)

    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2))
        print(f"wrote per-cue report → {args.report}", file=sys.stderr)


if __name__ == "__main__":
    main()
