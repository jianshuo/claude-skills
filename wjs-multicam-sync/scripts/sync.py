#!/usr/bin/env python3
"""Multicam audio sync — find time offset between two camera files via envelope
cross-correlation, run multi-probe drift check, emit a trim plan.

Usage:
    python sync.py CAM_A.MOV CAM_B.MOV [--out-dir DIR]

Inputs must be playable by ffmpeg. Output: prints chosen offset + ffmpeg
commands. Pass --execute to run the trim commands.
"""
import argparse, json, os, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000
ENV_FRAME_HZ = 100  # 10 ms hop
ENV_WIN_MS = 50

def extract_audio_pcm(video_path: Path, dst: Path):
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-i", str(video_path),
        "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
        "-f", "s16le", str(dst),
    ]
    subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)

def envelope(x: np.ndarray, sr: int = SR, hop_ms: int = 10, win_ms: int = ENV_WIN_MS):
    hop = int(sr * hop_ms / 1000)
    win = int(sr * win_ms / 1000)
    n = (len(x) - win) // hop + 1
    sq = x.astype(np.float64) ** 2
    csq = np.concatenate([[0.0], np.cumsum(sq)])
    out = np.empty(n, dtype=np.float32)
    for i in range(n):
        s = i * hop
        out[i] = np.sqrt(max(1e-9, (csq[s + win] - csq[s]) / win))
    return out, sr / hop

def hp(x: np.ndarray, fs: float, cut_hz: float = 0.05) -> np.ndarray:
    sos = signal.butter(2, cut_hz, btype="high", fs=fs, output="sos")
    return signal.sosfiltfilt(sos, x).astype(np.float32)

def norm(x: np.ndarray) -> np.ndarray:
    x = x - x.mean()
    s = x.std()
    return x / s if s > 0 else x

def coarse_offset(env_a: np.ndarray, env_b: np.ndarray, env_sr: float) -> float:
    """Return delta = tA_event - tB_event such that A_t = B_t + delta."""
    a_n = norm(env_a)
    b_n = norm(env_b)
    xc = signal.correlate(a_n, b_n, mode="full", method="fft")
    lags = np.arange(len(xc)) - (len(b_n) - 1)
    pk = int(np.argmax(xc))
    return float(lags[pk] / env_sr), float(xc[pk] / len(env_b))

def refine(a: np.ndarray, b: np.ndarray, b_start_s: float, expected_delta: float,
           probe_len_s: float = 60.0, pad_s: float = 1.5):
    """Sample-precise refine via waveform xcorr around expected position."""
    pl = int(probe_len_s * SR)
    bs = int(b_start_s * SR)
    if bs + pl > len(b):
        return None
    probe = b[bs:bs + pl]
    a_center = b_start_s + expected_delta
    lo = max(0, int((a_center - pad_s) * SR))
    hi = min(len(a), int((a_center + pad_s + probe_len_s) * SR))
    if hi - lo < pl:
        return None
    seg = a[lo:hi].astype(np.float32)
    p = probe.astype(np.float32)
    xc = signal.correlate(norm(seg), norm(p), mode="valid", method="fft")
    pk = int(np.argmax(np.abs(xc)))
    val = xc[pk] / len(p)
    # parabolic interp
    if 0 < pk < len(xc) - 1:
        y0, y1, y2 = xc[pk - 1], xc[pk], xc[pk + 1]
        denom = (y0 - 2 * y1 + y2)
        sub = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-9 else 0.0
    else:
        sub = 0.0
    a_pos = (lo + pk + sub) / SR
    return float(a_pos - b_start_s), float(val)

def multi_probe(a, b, expected_delta, B_dur, A_dur, step_s=180.0):
    rs = []
    for bs in np.arange(60.0, B_dur - 60.0, step_s):
        a_center = bs + expected_delta
        if a_center < 1.5 or a_center + 60.0 + 1.5 > A_dur:
            continue
        r = refine(a, b, bs, expected_delta)
        if r:
            rs.append((bs, r[0], r[1]))
    return rs

def media_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", type=Path, help="Camera A (reference) video")
    ap.add_argument("b", type=Path, help="Camera B video")
    ap.add_argument("--out-dir", type=Path, default=None)
    ap.add_argument("--bitrate", default="12M", help="video bitrate for re-encode")
    ap.add_argument("--encoder", default="hevc_videotoolbox",
                    help="ffmpeg video encoder for trim re-encode")
    ap.add_argument("--execute", action="store_true",
                    help="actually run the trim commands")
    args = ap.parse_args()

    out_dir = args.out_dir or args.a.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    A_dur = media_duration(args.a)
    B_dur = media_duration(args.b)
    print(f"A: {args.a.name}  duration={A_dur:.3f}s")
    print(f"B: {args.b.name}  duration={B_dur:.3f}s")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        a_pcm = td / "a.pcm"
        b_pcm = td / "b.pcm"
        print("Extracting mono PCM @ 8 kHz...")
        extract_audio_pcm(args.a, a_pcm)
        extract_audio_pcm(args.b, b_pcm)

        a = np.fromfile(a_pcm, dtype=np.int16).astype(np.float32)
        b = np.fromfile(b_pcm, dtype=np.int16).astype(np.float32)

        print("Building envelopes...")
        env_a, esr = envelope(a)
        env_b, _ = envelope(b)
        env_a = hp(np.log(env_a + 1e-3), esr)
        env_b = hp(np.log(env_b + 1e-3), esr)

        print("Coarse cross-correlation...")
        coarse_d, coarse_v = coarse_offset(env_a, env_b, esr)
        print(f"  coarse delta = {coarse_d:+.4f}s (xc/N={coarse_v:.3f})")

        print("Multi-probe sample-level refinement...")
        probes = multi_probe(a, b, coarse_d, B_dur, A_dur)
        if not probes:
            print("ERROR: could not find good probes; sync failed.")
            sys.exit(1)

        bs_arr = np.array([p[0] for p in probes])
        d_arr = np.array([p[1] for p in probes])
        v_arr = np.array([p[2] for p in probes])
        good = np.abs(v_arr) > 0.05
        print(f"  good probes: {good.sum()} / {len(probes)}")
        for bs, d, v in probes:
            print(f"    B@{bs:7.1f}s  delta={d:+.4f}s  ncoef={v:+.3f}")

        if good.sum() < 3:
            print("ERROR: too few good probes; sync may be unreliable.")
            sys.exit(1)

        slope, intercept = np.polyfit(bs_arr[good], d_arr[good], 1)
        # canonical at midpoint of B (center the residual error)
        midpoint_b = B_dur / 2
        canonical = float(slope * midpoint_b + intercept)
        drift_ms = float(slope * B_dur * 1000)
        print(f"\n  delta(b_t) = {slope:+.3e} * b_t + {intercept:+.6f}s")
        print(f"  drift over B's span: {drift_ms:+.2f} ms")
        print(f"  canonical delta (at B midpoint): {canonical:+.6f}s")

    delta = canonical  # tA0 - tB0 = -delta? our convention: A_t - B_t = delta
    # Overlap window in A's timeline:
    A_start = max(0.0, delta)
    A_end = min(A_dur, delta + B_dur)
    overlap = A_end - A_start
    B_start = A_start - delta
    B_end = A_end - delta
    print(f"\n=== Trim plan ===")
    print(f"  Common overlap: {overlap:.3f}s")
    print(f"  A: keep [{A_start:.4f} .. {A_end:.4f}]  ({overlap:.3f}s)")
    print(f"  B: keep [{B_start:.4f} .. {B_end:.4f}]  ({overlap:.3f}s)")

    out_a = out_dir / f"{args.a.stem}_synced{args.a.suffix}"
    out_b = out_dir / f"{args.b.stem}_synced{args.b.suffix}"

    # If A doesn't need trim (start≈0 and end≈A_dur), stream-copy
    needs_trim_a = A_start > 0.05 or (A_dur - A_end) > 0.05
    needs_trim_b = B_start > 0.05 or (B_dur - B_end) > 0.05

    def trim_cmd(src, dst, ss, dur, copy=False):
        if copy:
            return ["ffmpeg", "-nostdin", "-y", "-i", str(src),
                    "-map", "0:v:0", "-map", "0:a:0",
                    "-c", "copy", "-movflags", "+faststart", str(dst)]
        return ["ffmpeg", "-nostdin", "-y", "-ss", f"{ss:.4f}",
                "-i", str(src), "-t", f"{dur:.4f}",
                "-map", "0:v:0", "-map", "0:a:0",
                "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v", "hvc1",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(dst)]

    cmd_a = trim_cmd(args.a, out_a, A_start, overlap, copy=not needs_trim_a)
    cmd_b = trim_cmd(args.b, out_b, B_start, overlap, copy=not needs_trim_b)

    print(f"\nA -> {out_a.name}  ({'remux' if not needs_trim_a else 're-encode'})")
    print("  " + " ".join(cmd_a))
    print(f"B -> {out_b.name}  ({'remux' if not needs_trim_b else 're-encode'})")
    print("  " + " ".join(cmd_b))

    plan = {
        "a_input": str(args.a), "b_input": str(args.b),
        "a_output": str(out_a), "b_output": str(out_b),
        "delta_seconds": delta, "drift_ms": drift_ms,
        "overlap_seconds": overlap,
        "a_trim": [A_start, A_end], "b_trim": [B_start, B_end],
    }
    plan_path = out_dir / "multicam_sync.json"
    plan_path.write_text(json.dumps(plan, indent=2))
    print(f"\nPlan saved: {plan_path}")

    if args.execute:
        print("\nExecuting...")
        subprocess.run(cmd_a, check=True)
        subprocess.run(cmd_b, check=True)
        print("Done.")
    else:
        print("\nRe-run with --execute to perform the trims.")

if __name__ == "__main__":
    main()
