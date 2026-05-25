#!/usr/bin/env python3
"""Multicam audio sync — find the time offset between two recordings of the same
event via envelope cross-correlation, run a multi-probe drift check, and emit
`.sync.json` sidecars.

Originals are never modified. Downstream tools apply the offset at consume time
via `ffmpeg -itsoffset`.

Two modes (same algorithm, different failure philosophy):

  Full-overlap (default) — both inputs cover essentially the whole event, as
  with simultaneous multicam. Requires >=3 good probes or it FAILS loudly
  (too few good matches almost always means the wrong files or no shared
  audio). Writes a sidecar for BOTH inputs (reference gets delta=0).

  --partial — the source covers only PART of the reference's span (a Riverside
  / phone / lavalier recording that started mid-session, a late-arriving clip).
  Degrades gracefully instead of failing: median delta on few probes, coarse
  delta if none. Writes ONLY the source sidecar (the reference is assumed to
  already belong to a sync set). `delta_seconds` may be large (e.g. +1842.5).

Usage:
    python sync.py REFERENCE.MOV SOURCE.MOV            # full-overlap multicam
    python sync.py REFERENCE.MOV PARTIAL.mp4 --partial # partial-coverage source
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000
ENV_FRAME_HZ = 100  # 10 ms hop
ENV_WIN_MS = 50
SCHEMA_VERSION = 1


def loudest_audio_stream(video_path: Path) -> int:
    """Return the index N of the audio stream (`0:a:N`) with the highest mean
    volume, probed over a 60 s window mid-file.

    Why this matters: pro cameras often record multiple audio tracks where the
    first one is dead. Sony FX6 MXF clips carry 4 mono PCM tracks and commonly
    leave a:0 / a:1 silent (~-90 dB) with the real room mic on a:2 / a:3.
    Hard-coding `0:a:0` would cross-correlate silence and fail to sync, so pick
    the loudest track instead. Single-stream files (most MP4 cams) short-circuit
    to a:0.
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
    print(f"  [{video_path.name}] loudest audio stream: a:{best_idx} ({best_db:.1f} dB)")
    return best_idx


def extract_audio_pcm(video_path: Path, dst: Path, stream=None):
    ch = loudest_audio_stream(video_path) if stream is None else stream
    cmd = [
        "ffmpeg", "-nostdin", "-y", "-i", str(video_path),
        "-map", f"0:a:{ch}", "-ac", "1", "-ar", str(SR),
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


def coarse_offset(env_a: np.ndarray, env_b: np.ndarray, env_sr: float) -> tuple[float, float]:
    """Return delta = tA_event - tB_event such that A_t = B_t + delta."""
    a_n = norm(env_a)
    b_n = norm(env_b)
    xc = signal.correlate(a_n, b_n, mode="full", method="fft")
    lags = np.arange(len(xc)) - (len(b_n) - 1)
    pk = int(np.argmax(xc))
    return float(lags[pk] / env_sr), float(xc[pk] / len(env_b))


def refine(a: np.ndarray, b: np.ndarray, b_start_s: float, expected_delta: float,
           probe_len_s: float = 60.0, pad_s: float = 1.5):
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


def sidecar_path(media_path: Path) -> Path:
    """Sidecar lives next to the original, named <original>.sync.json."""
    return media_path.with_suffix(media_path.suffix + ".sync.json")


def write_sidecar(media_path: Path, *, source: str, reference: str,
                  delta_seconds: float, drift_slope: float,
                  overlap_in_reference: tuple[float, float],
                  overlap_in_source: tuple[float, float]):
    """Write the canonical sync.json sidecar next to `media_path`.

    Originals are never modified. The sidecar holds everything a downstream
    consumer needs to align `source` to `reference`'s timeline using
    `ffmpeg -itsoffset delta_seconds` (optionally `atempo=1+drift_slope`).
    """
    sc = {
        # _about / _help are intentionally human-readable. Open the JSON
        # in a text editor and the schema is self-explanatory.
        "_about": (
            f"Sync metadata for {source} (aligned to {reference}). "
            "Generated by wjs-syncing-multicam. Originals are not modified; "
            "downstream uses ffmpeg -itsoffset delta_seconds to align."
        ),
        "_help": {
            "delta_seconds": (
                "Source's t=0 expressed in reference's timeline. "
                "Positive => source starts after reference. "
                "Apply via `ffmpeg -itsoffset <delta_seconds> -i <source>`."
            ),
            "drift_slope": (
                "Residual clock drift between source and reference clocks "
                "(dimensionless, ~1e-5 typical). For camera-cut editing, "
                "ignore. For sync-sound / long-form lip-sync apply "
                "atempo=1+drift_slope to the source."
            ),
            "overlap_in_reference": (
                "[start, end] window in reference's timeline where BOTH "
                "source and reference have valid content. Use this to "
                "constrain EDL segments / trims."
            ),
            "overlap_in_source": (
                "Same window in source's local timeline "
                "(= overlap_in_reference shifted by -delta_seconds)."
            ),
            "verification": (
                "Filled in by verify.py: median_residual_ms, "
                "residual_spread_ms, probe_count. Empty until verify runs."
            ),
        },
        "schema_version": SCHEMA_VERSION,
        "source": source,
        "reference": reference,
        "delta_seconds": float(delta_seconds),
        "drift_slope": float(drift_slope),
        "overlap_in_reference": [float(overlap_in_reference[0]),
                                 float(overlap_in_reference[1])],
        "overlap_in_source": [float(overlap_in_source[0]),
                              float(overlap_in_source[1])],
        "verification": None,
    }
    p = sidecar_path(media_path)
    p.write_text(json.dumps(sc, indent=2, ensure_ascii=False))
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", type=Path, help="Camera A (the reference; defines the timeline)")
    ap.add_argument("b", type=Path, help="Camera B (will be aligned to A)")
    args = ap.parse_args()

    A_dur = media_duration(args.a)
    B_dur = media_duration(args.b)
    print(f"A (reference): {args.a.name}  duration={A_dur:.3f}s")
    print(f"B (source):    {args.b.name}  duration={B_dur:.3f}s")

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
            print("ERROR: could not find good probes; sync failed.", file=sys.stderr)
            sys.exit(1)

        bs_arr = np.array([p[0] for p in probes])
        d_arr = np.array([p[1] for p in probes])
        v_arr = np.array([p[2] for p in probes])
        good = np.abs(v_arr) > 0.05
        print(f"  good probes: {good.sum()} / {len(probes)}")
        for bs, d, v in probes:
            print(f"    B@{bs:7.1f}s  delta={d:+.4f}s  ncoef={v:+.3f}")

        if good.sum() < 3:
            print("ERROR: too few good probes; sync may be unreliable.", file=sys.stderr)
            sys.exit(1)

        slope, intercept = np.polyfit(bs_arr[good], d_arr[good], 1)
        # Canonical at midpoint of B — symmetric residual error.
        midpoint_b = B_dur / 2
        canonical = float(slope * midpoint_b + intercept)
        drift_ms = float(slope * B_dur * 1000)
        print(f"\n  delta(b_t) = {slope:+.3e} * b_t + {intercept:+.6f}s")
        print(f"  drift over B's span: {drift_ms:+.2f} ms")
        print(f"  canonical delta (at B midpoint): {canonical:+.6f}s")

    delta = canonical  # B's t=0 in A's timeline
    drift_slope = float(slope)

    # Overlap window (A-timeline = reference timeline)
    overlap_ref_start = max(0.0, delta)
    overlap_ref_end = min(A_dur, delta + B_dur)
    overlap_src_start = overlap_ref_start - delta
    overlap_src_end = overlap_ref_end - delta
    overlap_dur = overlap_ref_end - overlap_ref_start

    print(f"\nOverlap window (reference timeline): "
          f"[{overlap_ref_start:.3f} .. {overlap_ref_end:.3f}]s  "
          f"({overlap_dur:.3f}s)")

    if overlap_dur < 1.0:
        print("ERROR: overlap window <1s; the two recordings barely share content.",
              file=sys.stderr)
        sys.exit(1)

    # Reference sidecar — self-aligned, delta=0, drift=0. Same overlap window
    # so downstream sees consistent coverage info per cam.
    a_sc = write_sidecar(
        args.a,
        source=args.a.name,
        reference=args.a.name,
        delta_seconds=0.0,
        drift_slope=0.0,
        overlap_in_reference=(overlap_ref_start, overlap_ref_end),
        overlap_in_source=(overlap_ref_start, overlap_ref_end),
    )
    b_sc = write_sidecar(
        args.b,
        source=args.b.name,
        reference=args.a.name,
        delta_seconds=delta,
        drift_slope=drift_slope,
        overlap_in_reference=(overlap_ref_start, overlap_ref_end),
        overlap_in_source=(overlap_src_start, overlap_src_end),
    )

    print(f"\nWrote {a_sc}")
    print(f"Wrote {b_sc}")
    print("\nNo video re-encoded. Originals untouched. Run verify.py next.")


if __name__ == "__main__":
    main()
