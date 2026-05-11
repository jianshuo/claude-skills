#!/usr/bin/env python3
"""Verify a synced pair: extract audio from both files, run multi-probe
sample-level cross-correlation, report residual offset across the timeline.

Pass when |residual| < 1 frame at the slowest target frame rate.
"""
import argparse, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000

def extract(video: Path, dst: Path):
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-i", str(video),
                    "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
                    "-f", "s16le", str(dst)], check=True, stderr=subprocess.DEVNULL)

def norm(x):
    x = x - x.mean(); s = x.std()
    return x/s if s > 0 else x

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", type=Path)
    ap.add_argument("b", type=Path)
    ap.add_argument("--probe-len", type=float, default=60.0)
    ap.add_argument("--step", type=float, default=600.0,
                    help="probe spacing in seconds (default 10 min)")
    ap.add_argument("--max-frame-ms", type=float, default=33.33,
                    help="fail threshold; default 1 frame at 30fps")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        a_p, b_p = td / "a.pcm", td / "b.pcm"
        extract(args.a, a_p); extract(args.b, b_p)
        a = np.fromfile(a_p, dtype=np.int16).astype(np.float32)
        b = np.fromfile(b_p, dtype=np.int16).astype(np.float32)

    pl = int(args.probe_len * SR)
    pad = int(0.5 * SR)
    dur = min(len(a), len(b)) / SR
    rs = []
    for bs in np.arange(60.0, dur - args.probe_len, args.step):
        bsi = int(bs * SR)
        probe = b[bsi:bsi + pl]
        lo = max(0, bsi - pad)
        hi = min(len(a), bsi + pl + pad)
        seg = a[lo:hi].astype(np.float32)
        xc = signal.correlate(norm(seg), norm(probe.astype(np.float32)),
                              mode="valid", method="fft")
        pk = int(np.argmax(np.abs(xc)))
        ncoef = xc[pk] / len(probe)
        a_pos = (lo + pk) / SR
        residual_ms = (a_pos - bs) * 1000
        rs.append((bs, residual_ms, ncoef))
        print(f"t={bs:7.1f}s  residual={residual_ms:+7.2f} ms  ncoef={ncoef:+.3f}")

    arr = np.array([r[1] for r in rs])
    print(f"\nResidual: median={np.median(arr):+.2f} ms  range=[{arr.min():+.2f} .. {arr.max():+.2f}] ms")
    if np.max(np.abs(arr)) > args.max_frame_ms:
        print(f"FAIL: |residual| exceeds {args.max_frame_ms:.2f} ms (1 frame).")
        sys.exit(1)
    print(f"PASS: residual within ±{args.max_frame_ms:.0f} ms.")

if __name__ == "__main__":
    main()
