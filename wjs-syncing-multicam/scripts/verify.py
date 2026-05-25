#!/usr/bin/env python3
"""Verify a (reference, source, sidecar) tuple.

Re-extract audio from BOTH originals NATIVELY (no offset baked into ffmpeg) and
run multi-probe cross-correlation within the overlap window, applying the
sidecar's `delta_seconds` (and optional drift) as index arithmetic in numpy.
Writes results back into the sidecar's `verification` field.

Why index arithmetic, not `ffmpeg -itsoffset`: `-itsoffset` shifts input
timestamps, but when muxing to a headerless raw stream (`-f s16le`) there are
no timestamps to carry the offset — it is silently dropped and NO leading
silence is inserted. Relying on it makes the source's t=0 line up with the
reference's t=0 regardless of delta, so every probe correlates the wrong
region, peaks land in noise (ncoef ~0), and verification falsely FAILs. We
extract both natively and shift indices ourselves, which matches exactly how
sync.py computed the offset in the first place.

PASS = `median_residual_ms < 15` AND `residual_spread_ms < 1 frame at target
fps` (default 30 fps → 33.33 ms).

Usage:
    python verify.py REFERENCE.MOV SOURCE.MOV SOURCE.MOV.sync.json
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000


def loudest_audio_stream(video_path: Path) -> int:
    """Index of the highest-mean-volume audio stream (`0:a:N`), 60 s mid probe.

    Mirrors sync.py: FX6 MXF clips leave a:0 / a:1 dead (~-90 dB) with the room
    mic on a:2 / a:3, so a:0-only extraction would correlate silence. Verify
    must pick the SAME track sync picked, or residuals are meaningless.
    """
    streams = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", str(video_path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip().splitlines()
    if len(streams) <= 1:
        return 0
    best_idx, best_db = 0, -1e9
    for ch in range(len(streams)):
        err = subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-ss", "300", "-t", "60",
             "-i", str(video_path), "-map", f"0:a:{ch}",
             "-af", "volumedetect", "-f", "null", "-"],
            capture_output=True, text=True,
        ).stderr
        for line in err.splitlines():
            if "mean_volume" in line:
                try:
                    db = float(line.split("mean_volume:")[1].strip().split()[0])
                except (IndexError, ValueError):
                    db = -1e9
                if db > best_db:
                    best_db, best_idx = db, ch
                break
    return best_idx


def extract_audio_pcm(video: Path, dst: Path):
    """Extract the loudest audio stream as mono PCM @ 8 kHz, no offset applied."""
    ch = loudest_audio_stream(video)
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-i", str(video),
        "-map", f"0:a:{ch}", "-ac", "1", "-ar", str(SR),
        "-f", "s16le", str(dst),
    ]
    subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)


def norm(x):
    x = x - x.mean()
    s = x.std()
    return x / s if s > 0 else x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reference", type=Path, help="Original reference media")
    ap.add_argument("source", type=Path, help="Original source media (will be offset-aligned)")
    ap.add_argument("sidecar", type=Path, help="Source's .sync.json sidecar")
    ap.add_argument("--probe-len", type=float, default=60.0)
    ap.add_argument("--step", type=float, default=600.0,
                    help="Probe spacing in seconds (default 10 min)")
    ap.add_argument("--max-frame-ms", type=float, default=33.33,
                    help="Fail threshold for residual spread; default 1 frame at 30fps")
    ap.add_argument("--apply-drift", action="store_true",
                    help="Apply atempo=1+drift_slope when extracting source audio")
    args = ap.parse_args()

    sc = json.loads(args.sidecar.read_text())
    if sc.get("schema_version") != 1:
        print(f"WARNING: unexpected schema_version {sc.get('schema_version')}",
              file=sys.stderr)

    delta = float(sc["delta_seconds"])
    drift_slope = float(sc.get("drift_slope", 0.0))
    overlap_ref = sc["overlap_in_reference"]

    print(f"Reference: {args.reference.name}")
    print(f"Source:    {args.source.name}")
    print(f"Sidecar:   {args.sidecar.name}")
    print(f"delta_seconds = {delta:+.6f}")
    print(f"drift_slope   = {drift_slope:+.3e}  "
          f"({'applied' if args.apply_drift else 'NOT applied — pass --apply-drift to enable'})")
    print(f"overlap [ref] = [{overlap_ref[0]:.3f} .. {overlap_ref[1]:.3f}]s")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        ref_pcm, src_pcm = td / "ref.pcm", td / "src.pcm"
        # Extract both NATIVELY — the offset is applied by index arithmetic
        # below, not by ffmpeg (-itsoffset is a no-op on headerless raw PCM).
        extract_audio_pcm(args.reference, ref_pcm)
        extract_audio_pcm(args.source, src_pcm)
        ref = np.fromfile(ref_pcm, dtype=np.int16).astype(np.float32)
        src = np.fromfile(src_pcm, dtype=np.int16).astype(np.float32)

    # Source-local time τ maps to reference time τ + delta (and, with drift
    # applied, the source clock runs at 1+slope). So a probe at reference time
    # `bs` is drawn from the source at local time (bs - delta), then sought
    # near ref index bs; the peak offset is the residual sync error.
    pl = int(args.probe_len * SR)
    pad = int(0.5 * SR)

    # Run probes only inside the overlap window in reference timeline.
    ovl_start = max(60.0, float(overlap_ref[0]) + 1.0)
    ovl_end = float(overlap_ref[1]) - args.probe_len - 1.0
    if ovl_end <= ovl_start:
        print("ERROR: overlap window too short to verify.", file=sys.stderr)
        sys.exit(2)

    rs = []
    for bs in np.arange(ovl_start, ovl_end, args.step):
        # Source-local time corresponding to this reference time.
        src_t = bs - delta
        if args.apply_drift:
            src_t = src_t / (1.0 + drift_slope)
        si = int(src_t * SR)
        bsi = int(bs * SR)
        if si < 0 or si + pl > len(src):
            continue
        probe = src[si:si + pl]
        if np.abs(probe).mean() < 1.0:
            # Silence — no signal to correlate. Skip.
            continue
        lo = max(0, bsi - pad)
        hi = min(len(ref), bsi + pl + pad)
        if hi - lo < pl:
            continue
        seg = ref[lo:hi].astype(np.float32)
        xc = signal.correlate(norm(seg), norm(probe.astype(np.float32)),
                              mode="valid", method="fft")
        pk = int(np.argmax(np.abs(xc)))
        ncoef = float(xc[pk] / len(probe))
        ref_pos = (lo + pk) / SR
        residual_ms = (ref_pos - bs) * 1000
        rs.append((bs, residual_ms, ncoef))
        print(f"t={bs:7.1f}s  residual={residual_ms:+7.2f} ms  ncoef={ncoef:+.3f}")

    if not rs:
        print("ERROR: no usable probes (all silence or out of overlap).", file=sys.stderr)
        sys.exit(2)

    arr = np.array([r[1] for r in rs])
    median_residual_ms = float(np.median(arr))
    residual_spread_ms = float(np.max(np.abs(arr - median_residual_ms)) * 2)
    print(f"\nResidual: median={median_residual_ms:+.2f} ms  "
          f"spread=±{residual_spread_ms/2:+.2f} ms (range "
          f"[{arr.min():+.2f} .. {arr.max():+.2f}])")

    # Write results back into the sidecar.
    sc["verification"] = {
        "median_residual_ms": round(median_residual_ms, 3),
        "residual_spread_ms": round(residual_spread_ms, 3),
        "probe_count": len(rs),
        "drift_applied": bool(args.apply_drift),
    }
    args.sidecar.write_text(json.dumps(sc, indent=2, ensure_ascii=False))
    print(f"Updated {args.sidecar} (verification field).")

    if abs(median_residual_ms) > 15.0 or residual_spread_ms > args.max_frame_ms:
        print(f"FAIL: residual exceeds budget "
              f"(|median|>15 or spread>{args.max_frame_ms:.2f} ms).",
              file=sys.stderr)
        sys.exit(1)
    print(f"PASS: residual within budget.")


if __name__ == "__main__":
    main()
