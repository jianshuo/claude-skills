#!/usr/bin/env python3
"""Render an EDL with picture-in-picture for 1, 2, or N cameras.

- 1 cam: pass-through (no PiP overlay).
- 2 cam: main = active cam from EDL; PiP = the other cam at same time range.
- N cam (3+): main = active cam; PiP = the second-best covered cam for that
              segment, picked from the EDL's `coverage` and per-segment scores
              if present, else from the input order (next non-active).

Usage:
    python render_pip.py edl.json --out out.mp4 \
        [--pip bottom-right|top-right|bottom-left|top-left] \
        [--pip-width 480] [--pip-margin 24] [--border-px 4] \
        [--pip-pick next|second-best]

Per-segment EDL rows may carry a `pip` field (cam index) to override the
picker.
"""
import argparse, json, subprocess
from pathlib import Path

POSITIONS = {
    "bottom-right": ("W-w-{m}", "H-h-{m}"),
    "top-right":    ("W-w-{m}", "{m}"),
    "bottom-left":  ("{m}",      "H-h-{m}"),
    "top-left":     ("{m}",      "{m}"),
}


def covered_at(coverage, t):
    return [k for k, (s, e) in enumerate(coverage) if s <= t < e]


def pick_pip(row, K, coverage, mode="next"):
    """Choose the PiP cam for a segment. Honours an explicit row['pip'] if set;
    otherwise picks among cams that are *covered for the entire segment*.
    Falls back to None if no other cam is covered."""
    if row.get("pip") is not None:
        return int(row["pip"])
    cam = row["cam"]
    s, e = row["start"], row["end"]
    candidates = []
    for k in range(K):
        if k == cam:
            continue
        cs, ce = coverage[k]
        if cs <= s and ce >= e:
            candidates.append(k)
    if not candidates:
        return None
    if mode == "next":
        # Round-robin: prefer the next index after `cam` mod K
        for off in range(1, K):
            cand = (cam + off) % K
            if cand in candidates:
                return cand
    # second-best: caller didn't pass scores here, so just return first
    return candidates[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("edl", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--encoder", default="hevc_videotoolbox")
    ap.add_argument("--bitrate", default="12M")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--pip", choices=list(POSITIONS), default="bottom-right")
    ap.add_argument("--pip-width", type=int, default=480)
    ap.add_argument("--pip-margin", type=int, default=24)
    ap.add_argument("--border-px", type=int, default=4)
    ap.add_argument("--pip-pick", choices=["next", "second-best"], default="next",
                    help="Which non-active cam to use as PiP when EDL doesn't say")
    args = ap.parse_args()

    plan = json.loads(args.edl.read_text())
    inputs = plan["inputs"]
    deltas = plan.get("deltas", [0.0] * len(inputs))
    edl = plan["edl"]
    audio_src = plan["audio_source"]
    K = len(inputs)
    coverage = plan.get("coverage", [[0.0, plan["duration_sec"]]] * K)

    W, H = args.width, args.height
    pw = args.pip_width
    ph = round(pw * 9 / 16)
    bw = args.border_px
    pip_total_w = pw + 2 * bw
    pip_total_h = ph + 2 * bw
    x_expr, y_expr = POSITIONS[args.pip]
    x_expr = x_expr.format(m=args.pip_margin)
    y_expr = y_expr.format(m=args.pip_margin)

    # Apply per-input -itsoffset so EDL times (reference timeline) work
    # directly inside the filter graph.
    cmd = ["ffmpeg", "-nostdin", "-y"]
    for src, dlt in zip(inputs, deltas):
        if abs(dlt) > 1e-9:
            cmd.extend(["-itsoffset", f"{dlt:.6f}"])
        cmd.extend(["-i", src])

    # --- 1-cam pass-through ---
    if K == 1:
        filters = []
        for i, row in enumerate(edl):
            s = row["start"]; e = row["end"]
            filters.append(
                f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,"
                f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={args.fps}[v{i}]"
            )
        concat = "".join(f"[v{i}]" for i in range(len(edl)))
        filters.append(f"{concat}concat=n={len(edl)}:v=1:a=0[vout]")
        audio_offset = edl[0]["start"] if edl else 0.0
        dur = plan["duration_sec"]
        fc = ";".join(filters)
        fc += (f";[{audio_src}:a:0]atrim=start={audio_offset}:"
               f"duration={dur},asetpts=PTS-STARTPTS[aout]")
        cmd.extend([
            "-filter_complex", fc,
            "-map", "[vout]", "-map", "[aout]",
            "-t", str(dur),
            "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v", "hvc1",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", str(args.out),
        ])
        print(f"1 cam pass-through; {len(edl)} segments")
        subprocess.run(cmd, check=True)
        return

    # --- 2+ cam with PiP ---
    filters = []
    for i, row in enumerate(edl):
        cam = row["cam"]
        s, e = row["start"], row["end"]
        # Main
        filters.append(
            f"[{cam}:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,"
            f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={args.fps}[m{i}]"
        )

        pip_cam = pick_pip(row, K, coverage, mode=args.pip_pick)
        if pip_cam is None:
            # No PiP candidate (only one cam covered for this segment) — pass main through
            filters.append(f"[m{i}]copy[v{i}]")
            continue

        # PiP — same time range from a different input
        pip_chain = (
            f"[{pip_cam}:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,"
            f"scale={pw}:{ph}:force_original_aspect_ratio=decrease,"
            f"pad={pw}:{ph}:(ow-iw)/2:(oh-ih)/2,"
        )
        if bw > 0:
            pip_chain += f"pad={pip_total_w}:{pip_total_h}:{bw}:{bw}:white,"
        pip_chain += f"setsar=1,fps={args.fps}[p{i}]"
        filters.append(pip_chain)
        filters.append(f"[m{i}][p{i}]overlay={x_expr}:{y_expr}:eof_action=pass[v{i}]")

    concat = "".join(f"[v{i}]" for i in range(len(edl)))
    filters.append(f"{concat}concat=n={len(edl)}:v=1:a=0[vout]")

    audio_offset = edl[0]["start"] if edl else 0.0
    dur = plan["duration_sec"]
    fc = ";".join(filters)
    fc += (f";[{audio_src}:a:0]atrim=start={audio_offset}:"
           f"duration={dur},asetpts=PTS-STARTPTS[aout]")
    cmd.extend([
        "-filter_complex", fc,
        "-map", "[vout]", "-map", "[aout]",
        "-t", str(dur),
        "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(args.out),
    ])
    pip_summary = {}
    for row in edl:
        pc = pick_pip(row, K, coverage, mode=args.pip_pick)
        key = f"main=cam{row['cam']}/pip={'cam'+str(pc) if pc is not None else 'none'}"
        pip_summary[key] = pip_summary.get(key, 0) + (row["end"] - row["start"])
    print(f"PiP main {W}x{H}, inset {pw}x{ph} (+{bw}px) at {args.pip}; {K} cams; "
          f"{len(edl)} segments")
    for k, v in sorted(pip_summary.items(), key=lambda x: -x[1]):
        print(f"  {v:6.0f}s  {k}")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
