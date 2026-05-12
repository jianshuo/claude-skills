#!/usr/bin/env python3
"""Director-style auto-edit for N cameras of the same event.

INPUTS ARE ORIGINAL UNTOUCHED MEDIA. Each input must have a `.sync.json`
sidecar next to it (written by wjs-syncing-multicam). Sidecars provide
`delta_seconds` (per-cam time offset into the reference timeline) and
`overlap_in_reference` (per-cam coverage window). No re-encoded
`*_synced.MOV` files are needed or expected.

Pipeline:
  1. Read each input's `.sync.json` for delta + coverage in reference timeline.
  2. Extract per-cam mono PCM @ 16 kHz from the ORIGINAL file (local time).
  3. Compute log-RMS envelope at 1 Hz frame rate.
  4. Shift each per-cam envelope into reference timeline using delta_seconds.
  5. Score each cam per second relative to others (active-speaker proxy).
  6. Run editor (rotation / greedy) — only picks among covered cams.
  7. Emit EDL JSON, including per-cam deltas so render scripts can
     reapply -itsoffset without re-reading sidecars.

For 1-cam input the output is a single-row EDL covering the full duration.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path

import numpy as np

SR = 16000
FRAME_HZ = 1.0
ENV_HOP_MS = 100
SCHEMA_VERSION = 1

def extract(video: Path, dst: Path):
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-i", str(video),
                    "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
                    "-f", "s16le", str(dst)], check=True, stderr=subprocess.DEVNULL)

def envelope_rms(x, sr=SR, hop_ms=ENV_HOP_MS, win_ms=200):
    hop = int(sr * hop_ms / 1000)
    win = int(sr * win_ms / 1000)
    n = (len(x) - win) // hop + 1
    sq = x.astype(np.float64) ** 2
    csq = np.concatenate([[0.0], np.cumsum(sq)])
    out = np.empty(n, dtype=np.float32)
    for i in range(n):
        s = i * hop
        out[i] = np.sqrt(max(1e-9, (csq[s + win] - csq[s]) / win))
    return np.log(out + 1e-3), sr / hop

def per_second(env, env_sr, total_sec):
    """Compute per-second mean envelope in the cam's LOCAL time."""
    n_per = int(env_sr / FRAME_HZ)
    take = (len(env) // n_per) * n_per
    env = env[:take].reshape(-1, n_per).mean(axis=1)
    return env[:total_sec]


def per_sec_in_reference(env, env_sr, delta_sec, total_ref_sec):
    """Lift cam-local envelope into the reference timeline.

    For each reference second t, returns env_local at (t - delta_sec). Times
    falling outside the cam's recorded range are filled with -inf so they're
    never picked by the editor's argmax."""
    n_per = int(env_sr / FRAME_HZ)
    take = (len(env) // n_per) * n_per
    local_per_sec = env[:take].reshape(-1, n_per).mean(axis=1)
    local_dur = len(local_per_sec)
    out = np.full(total_ref_sec, -np.inf, dtype=np.float32)
    for t in range(total_ref_sec):
        t_local_f = t - delta_sec
        t_local = int(t_local_f)
        if 0 <= t_local < local_dur:
            out[t] = local_per_sec[t_local]
    return out

def read_sidecar(input_path: Path):
    """Read <input>.sync.json. Returns (delta_seconds, overlap_in_reference,
    has_sidecar). Falls back to (0.0, None, False) if absent — caller treats
    this as 'cam is at reference timeline, full coverage'."""
    sidecar = input_path.with_suffix(input_path.suffix + ".sync.json")
    if not sidecar.exists():
        return (0.0, None, False)
    try:
        d = json.loads(sidecar.read_text())
        if d.get("schema_version") != SCHEMA_VERSION:
            print(f"WARN: {sidecar.name} schema_version != {SCHEMA_VERSION}; "
                  "attempting to read anyway")
        delta = float(d["delta_seconds"])
        ovl = d.get("overlap_in_reference")
        ovl = (float(ovl[0]), float(ovl[1])) if ovl else None
        return (delta, ovl, True)
    except Exception as e:
        print(f"WARN: failed to parse {sidecar.name}: {e}; using delta=0")
        return (0.0, None, False)


def coverage_from_sidecar(input_path: Path, total: int):
    """Coverage window in the REFERENCE timeline. Reads new-schema sidecar;
    falls back to full coverage if absent."""
    _, ovl, _ = read_sidecar(input_path)
    if ovl is None:
        return (0.0, float(total))
    return (max(0.0, ovl[0]), min(float(total), ovl[1]))

def parse_coverage_flag(flag_values, K, total):
    """Parse --coverage entries like '2:2403.748:4485.887'."""
    cov = [(0.0, float(total))] * K
    for v in (flag_values or []):
        parts = v.split(":")
        if len(parts) != 3:
            raise SystemExit(f"--coverage expects CAM:START:END, got {v!r}")
        k = int(parts[0]); s = float(parts[1]); e = float(parts[2])
        if not (0 <= k < K):
            raise SystemExit(f"--coverage cam {k} out of range")
        cov[k] = (s, e)
    return cov

def covered_at(cov, t):
    """Return list of cam indices whose coverage window contains t."""
    return [k for k, (s, e) in enumerate(cov) if s <= t < e]


def rotation_edit(scores, coverage, min_dwell=8, max_dwell=15,
                  opening_dwell=10, seed=42):
    """Rotation editor — alternates among covered cams with varying dwell.

    - Opening shot: cam with highest score over the first window, restricted to
      cams covered at t=0.
    - At each cut: pick the cam (≠ current, currently covered) with the highest
      score in the next ~6 s. If only one cam is covered, hold.
    - If the active cam exits coverage mid-shot, force a switch immediately.
    """
    T, K = scores.shape
    rng = np.random.default_rng(seed)
    seq = np.full(T, -1, dtype=np.int32)

    def best_at(t, candidates, win=opening_dwell):
        end = min(T, t + win)
        return max(candidates, key=lambda k: scores[t:end, k].mean() if end > t else scores[t, k])

    cur_set = covered_at(coverage, 0)
    if not cur_set:
        raise SystemExit("No camera is covered at t=0")
    cur = best_at(0, cur_set)
    t = 0
    while t < T:
        dwell = int(rng.integers(min_dwell, max_dwell + 1))
        # Walk forward up to `dwell`, but stop early if active cam exits coverage
        end = t
        while end < t + dwell and end < T:
            if cur not in covered_at(coverage, end):
                break
            seq[end] = cur
            end += 1
        if end >= T:
            break
        # Pick next: covered cams excluding current
        cands = [k for k in covered_at(coverage, end) if k != cur]
        if not cands:
            # only `cur` is covered — but cur is also leaving. Try keeping any covered.
            cands = covered_at(coverage, end)
            if not cands:
                # gap: nothing covered. Hold cur (keeps last frame). Skip ahead.
                seq[end] = cur
                end += 1
                t = end
                continue
        upcoming = min(T, end + 6)
        cur = max(cands, key=lambda k: scores[end:upcoming, k].mean()
                                       if upcoming > end else scores[end, k])
        t = end
    # If any -1 remain (only happens if no coverage at t), fill with first covered
    for t in range(T):
        if seq[t] == -1:
            cands = covered_at(coverage, t)
            seq[t] = cands[0] if cands else 0
    return seq


def greedy_edit(scores, coverage, min_dwell=4, max_dwell=18, lookahead=4,
                switch_threshold=0.0, opening_dwell=8):
    """Greedy hard-cut editor. Picks the highest-scoring covered cam per
    frame, with min/max dwell hysteresis. Forces a switch when active cam
    exits coverage."""
    T, K = scores.shape

    def win_mean(t, k, w):
        end = min(T, t + w)
        return scores[t:end, k].mean() if end > t else scores[t, k]

    seq = np.full(T, -1, dtype=np.int32)
    cands0 = covered_at(coverage, 0)
    if not cands0:
        raise SystemExit("No camera is covered at t=0")
    seq[0] = max(cands0, key=lambda k: win_mean(0, k, opening_dwell))
    streak = 1
    for t in range(1, T):
        cur = seq[t - 1]
        cur_covered = cur in covered_at(coverage, t)
        if not cur_covered:
            cands = [k for k in covered_at(coverage, t) if k != cur] or covered_at(coverage, t)
            if not cands:
                seq[t] = cur; streak += 1; continue
            seq[t] = max(cands, key=lambda k: win_mean(t, k, lookahead))
            streak = 1; continue
        if streak < min_dwell:
            seq[t] = cur; streak += 1; continue
        cands = [k for k in covered_at(coverage, t) if k != cur]
        if not cands:
            seq[t] = cur; streak += 1; continue
        if streak >= max_dwell:
            seq[t] = max(cands, key=lambda k: win_mean(t, k, lookahead))
            streak = 1; continue
        cur_s = win_mean(t, cur, lookahead)
        best_k = max(cands, key=lambda k: win_mean(t, k, lookahead))
        best_s = win_mean(t, best_k, lookahead)
        if best_s > cur_s + switch_threshold:
            seq[t] = best_k; streak = 1
        else:
            seq[t] = cur; streak += 1
    return seq


def edl_from_seq(seq):
    edl = []
    i = 0
    while i < len(seq):
        j = i
        while j < len(seq) and seq[j] == seq[i]:
            j += 1
        edl.append({"start": float(i), "end": float(j), "cam": int(seq[i])})
        i = j
    return edl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", type=Path, nargs="+",
                    help="Synced video files (camera 0, camera 1, ...)")
    ap.add_argument("--audio-source", type=int, default=None,
                    help="Camera index whose audio to use as the master "
                         "(default: highest dynamic range covered cam)")
    ap.add_argument("--mode", choices=["rotation", "greedy"], default="rotation")
    ap.add_argument("--min-dwell", type=int, default=8)
    ap.add_argument("--max-dwell", type=int, default=15)
    ap.add_argument("--switch-threshold", type=float, default=0.0,
                    help="(greedy) other cam must beat current by this much")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--coverage", action="append", default=None,
                    help="Override per-cam coverage: CAM:START:END (seconds). "
                         "Repeatable. Defaults read from <input>.sync.json if present.")
    ap.add_argument("--out", type=Path, required=True, help="output EDL json")
    args = ap.parse_args()

    K = len(args.inputs)

    # Pre-read all sidecars so we know per-cam deltas + coverage in ref time.
    deltas = []
    cov_from_sc = []
    has_sidecars = []
    for p in args.inputs:
        d, ovl, has = read_sidecar(p)
        deltas.append(d)
        cov_from_sc.append(ovl)
        has_sidecars.append(has)
    missing = [p.name for p, h in zip(args.inputs, has_sidecars) if not h]
    if missing:
        print(f"WARN: no sidecar for {missing}; assuming delta=0, full coverage. "
              "Run wjs-syncing-multicam first if you expected these to be offset.")

    # Extract per-cam audio (LOCAL time) and compute LOCAL envelopes.
    durations = []
    envs = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for i, p in enumerate(args.inputs):
            out = td / f"{i}.pcm"
            extract(p, out)
            x = np.fromfile(out, dtype=np.int16).astype(np.float32)
            env, esr = envelope_rms(x)
            durations.append(len(x) / SR)
            envs.append((env, esr))

    # Total in REFERENCE timeline = max(coverage end across cams). If no
    # sidecars at all, falls back to min(durations) (everyone-shares-clock).
    cov_ends = [ovl[1] for ovl in cov_from_sc if ovl is not None]
    if cov_ends:
        total = int(max(cov_ends))
    else:
        total = int(min(durations))

    # Lift each cam's envelope into reference timeline using its delta.
    per_sec = np.full((total, K), -np.inf, dtype=np.float32)
    for k, (env, esr) in enumerate(envs):
        per_sec[:, k] = per_sec_in_reference(env, esr, deltas[k], total)

    # Coverage in reference timeline: from sidecar if present, CLI override below
    coverage = [coverage_from_sidecar(p, total) for p in args.inputs]
    if args.coverage:
        cov_overrides = parse_coverage_flag(args.coverage, K, total)
        # Only override entries explicitly given (CLI list applies to all-K, but
        # parse_coverage_flag starts from full coverage; merge: keep sidecar
        # values where CLI didn't touch — simpler: CLI overrides always win)
        for v in args.coverage:
            k = int(v.split(":")[0])
            coverage[k] = cov_overrides[k]

    print(f"Cameras ({K}):")
    for k, p in enumerate(args.inputs):
        s, e = coverage[k]
        print(f"  cam{k}: {p.name}  coverage [{s:.1f} .. {e:.1f}]s")

    # Active-speaker score relative to others (per second). Treat -inf
    # (uncovered) as nan so it doesn't poison the "others" mean.
    finite = np.where(np.isfinite(per_sec), per_sec, np.nan)
    if K > 1:
        scores = np.full_like(per_sec, -np.inf)
        for k in range(K):
            others = np.nanmean(np.delete(finite, k, axis=1), axis=1)
            diff = finite[:, k] - others
            scores[:, k] = np.where(np.isfinite(diff), diff, -np.inf)
    else:
        scores = per_sec.copy()

    # Audio source: highest dynamic range cam that is mostly covered.
    # Compute spread over the cam's COVERED seconds only.
    if args.audio_source is None:
        spread = []
        for k in range(K):
            v = finite[:, k]
            v = v[np.isfinite(v)]
            spread.append(0.0 if len(v) == 0 else
                          float(np.percentile(v, 90) - np.percentile(v, 10)))
        spread = np.array(spread)
        cov_pct = np.array([(coverage[k][1] - coverage[k][0]) / max(1, total)
                            for k in range(K)])
        audio_src = int(np.argmax(spread + 0.5 * cov_pct))
    else:
        audio_src = args.audio_source

    if K == 1:
        # Single-cam case: trivial EDL
        seq = np.zeros(total, dtype=np.int32)
    elif args.mode == "rotation":
        seq = rotation_edit(scores, coverage,
                            min_dwell=args.min_dwell, max_dwell=args.max_dwell,
                            seed=args.seed)
    else:
        seq = greedy_edit(scores, coverage,
                          min_dwell=args.min_dwell, max_dwell=args.max_dwell,
                          switch_threshold=args.switch_threshold)
    edl = edl_from_seq(seq)

    plan = {
        "_about": (
            "EDL produced by wjs-editing-multicam/autoedit.py. Times are in the "
            "reference timeline. `deltas[k]` is the per-input offset — render "
            "scripts apply `ffmpeg -itsoffset deltas[k] -i inputs[k]` so they "
            "can read original (un-trimmed) files. See wjs-editing-multicam/SKILL.md."
        ),
        "inputs": [str(p) for p in args.inputs],
        "deltas": [float(d) for d in deltas],
        "duration_sec": total,
        "audio_source": audio_src,
        "coverage": coverage,
        "edl": edl,
    }
    args.out.write_text(json.dumps(plan, indent=2))
    print(f"\nEDL: {len(edl)} segments; audio_source=cam{audio_src}; saved {args.out}")
    cam_counts = {}
    for row in edl:
        cam_counts[row["cam"]] = cam_counts.get(row["cam"], 0) + (row["end"] - row["start"])
    for k, dur in sorted(cam_counts.items()):
        print(f"  cam{k}: {dur:.0f}s on screen ({100*dur/total:.0f}%)")
    for row in edl[:25]:
        print(f"  [{row['start']:7.1f} .. {row['end']:7.1f}] cam{row['cam']}")
    if len(edl) > 25:
        print(f"  ... {len(edl) - 25} more")


if __name__ == "__main__":
    main()
