#!/usr/bin/env python3
"""Sync a partial-coverage source (e.g. a Riverside recording, a phone audio
recorder, a clip that started mid-session) to a reference camera that defines
the common timeline.

Output: ONE `.sync.json` sidecar next to the new source. No video / audio is
re-encoded; the original input is left untouched. Downstream tools apply
`ffmpeg -itsoffset delta_seconds` at consume time.

Usage:
    python sync_partial.py REFERENCE.MOV NEW_INPUT.mp4
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000
SCHEMA_VERSION = 1


def extract(video, dst):
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-i", str(video),
                    "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
                    "-f", "s16le", str(dst)], check=True, stderr=subprocess.DEVNULL)


def envelope(x, sr=SR, hop_ms=10, win_ms=50):
    hop = int(sr * hop_ms / 1000); win = int(sr * win_ms / 1000)
    n = (len(x) - win) // hop + 1
    sq = x.astype(np.float64) ** 2
    csq = np.concatenate([[0.0], np.cumsum(sq)])
    out = np.empty(n, dtype=np.float32)
    for i in range(n):
        s = i * hop
        out[i] = np.sqrt(max(1e-9, (csq[s+win] - csq[s]) / win))
    return out, sr / hop


def hp(x, fs, cut=0.05):
    sos = signal.butter(2, cut, btype="high", fs=fs, output="sos")
    return signal.sosfiltfilt(sos, x).astype(np.float32)


def norm(x):
    x = x - x.mean(); s = x.std()
    return x/s if s > 0 else x


def media_dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(p)], check=True,
                         capture_output=True, text=True)
    return float(out.stdout.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reference", type=Path,
                    help="Reference recording (defines the common timeline). "
                         "Usually one of the main cameras.")
    ap.add_argument("new", type=Path,
                    help="New source to align. Can cover only part of the reference's span.")
    args = ap.parse_args()

    ref_dur = media_dur(args.reference)
    new_dur = media_dur(args.new)
    print(f"Reference: {args.reference.name}  {ref_dur:.3f}s")
    print(f"New:       {args.new.name}  {new_dur:.3f}s")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        ref_pcm, new_pcm = td / "ref.pcm", td / "new.pcm"
        extract(args.reference, ref_pcm)
        extract(args.new, new_pcm)
        a = np.fromfile(ref_pcm, dtype=np.int16).astype(np.float32)
        r = np.fromfile(new_pcm, dtype=np.int16).astype(np.float32)
        env_a, esr = envelope(a)
        env_r, _   = envelope(r)
        env_a = hp(np.log(env_a + 1e-3), esr)
        env_r = hp(np.log(env_r + 1e-3), esr)
        xc = signal.correlate(norm(env_a), norm(env_r), mode="full", method="fft")
        lags = np.arange(len(xc)) - (len(env_r) - 1)
        pk = int(np.argmax(xc))
        coarse = float(lags[pk] / esr)
        ncoef = float(xc[pk] / len(env_r))
        print(f"Coarse offset: {coarse:.4f}s (xc/N={ncoef:.3f})")
        if abs(ncoef) < 0.3:
            print("WARNING: low correlation; sync may be unreliable", file=sys.stderr)

        # Multi-probe refinement
        def refine(b_start, expected, probe_len=60.0, pad=1.5):
            pl = int(probe_len * SR); bs = int(b_start * SR)
            if bs + pl > len(r): return None
            probe = r[bs:bs + pl]
            a_center = b_start + expected
            lo = max(0, int((a_center - pad) * SR))
            hi = min(len(a), int((a_center + pad + probe_len) * SR))
            if hi - lo < pl: return None
            seg = a[lo:hi].astype(np.float32)
            xc = signal.correlate(norm(seg), norm(probe.astype(np.float32)),
                                  mode="valid", method="fft")
            pk = int(np.argmax(np.abs(xc)))
            val = xc[pk] / len(probe)
            if 0 < pk < len(xc) - 1:
                y0, y1, y2 = xc[pk-1], xc[pk], xc[pk+1]
                d = y0 - 2*y1 + y2
                sub = 0.5 * (y0 - y2) / d if abs(d) > 1e-9 else 0.0
            else:
                sub = 0.0
            return (lo + pk + sub) / SR - b_start, val

        probes = []
        for bs in np.arange(60.0, new_dur - 60.0, 180.0):
            res = refine(bs, coarse)
            if res:
                probes.append((bs, res[0], res[1]))

        drift_slope = 0.0
        if probes:
            arr = np.array(probes)
            good = np.abs(arr[:, 2]) > 0.05
            if good.sum() >= 3:
                slope, intercept = np.polyfit(arr[good, 0], arr[good, 1], 1)
                midpoint = new_dur / 2
                delta = float(slope * midpoint + intercept)
                drift_slope = float(slope)
                drift_ms = float(slope * new_dur * 1000)
                print(f"Drift: {drift_ms:+.2f} ms over {new_dur:.0f}s")
            else:
                delta = float(np.median(arr[:, 1]))
        else:
            delta = float(coarse)
        print(f"Chosen delta: {delta:.4f}s (= start of new in reference timeline)")

    # Overlap window in reference timeline
    overlap_ref_start = max(0.0, delta)
    overlap_ref_end = min(ref_dur, delta + new_dur)
    overlap_src_start = overlap_ref_start - delta
    overlap_src_end = overlap_ref_end - delta
    overlap_dur = overlap_ref_end - overlap_ref_start

    print(f"\nCoverage (reference timeline): "
          f"[{overlap_ref_start:.3f} .. {overlap_ref_end:.3f}]s  ({overlap_dur:.3f}s)")
    print(f"Coverage (source timeline):    "
          f"[{overlap_src_start:.3f} .. {overlap_src_end:.3f}]s")

    if overlap_dur < 1.0:
        print("ERROR: overlap window <1s. Reference and source barely share content.",
              file=sys.stderr)
        sys.exit(1)

    sidecar = args.new.with_suffix(args.new.suffix + ".sync.json")
    sc = {
        "_about": (
            f"Sync metadata for {args.new.name} (aligned to {args.reference.name}). "
            "Generated by wjs-syncing-multicam/sync_partial.py for a partial-coverage source. "
            "Original is not modified; downstream uses ffmpeg -itsoffset delta_seconds."
        ),
        "_help": {
            "delta_seconds": (
                "Source's t=0 in reference's timeline. Positive => source starts AFTER "
                "reference (common for late-arriving / mid-session recordings)."
            ),
            "drift_slope": "Clock drift slope; usually 0 for short partial recordings.",
            "overlap_in_reference": (
                "[start, end] in reference timeline where this source has content. "
                "Outside this window, fall back to other cameras."
            ),
            "overlap_in_source": (
                "Same window in the source's local timeline."
            ),
            "verification": (
                "Filled in by verify.py: median_residual_ms, residual_spread_ms, probe_count."
            ),
        },
        "schema_version": SCHEMA_VERSION,
        "source": args.new.name,
        "reference": args.reference.name,
        "delta_seconds": float(delta),
        "drift_slope": drift_slope,
        "overlap_in_reference": [float(overlap_ref_start), float(overlap_ref_end)],
        "overlap_in_source": [float(overlap_src_start), float(overlap_src_end)],
        "verification": None,
    }
    sidecar.write_text(json.dumps(sc, indent=2, ensure_ascii=False))
    print(f"\nWrote sidecar: {sidecar}")
    print("Original input untouched. No video / audio encoded.")


if __name__ == "__main__":
    main()
