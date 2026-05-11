#!/usr/bin/env python3
"""Render an EDL produced by autoedit.py into a single MP4 via ffmpeg.

Hard cuts only (no transitions / no PiP). For PiP and transitions, generate a
HyperFrames composition instead — see SKILL.md.

Usage:
    python render_cuts.py edl.json --out out.mp4 [--encoder hevc_videotoolbox]
"""
import argparse, json, subprocess
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("edl", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--encoder", default="hevc_videotoolbox")
    ap.add_argument("--bitrate", default="12M")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    args = ap.parse_args()

    plan = json.loads(args.edl.read_text())
    inputs = plan["inputs"]
    deltas = plan.get("deltas", [0.0] * len(inputs))
    edl = plan["edl"]
    audio_src = plan["audio_source"]
    W, H = args.width, args.height

    # Apply per-input -itsoffset so each cam's frames carry reference-timeline
    # timestamps. Then `trim=start=X:end=Y` in the filter graph works directly
    # with EDL times (which are already in reference timeline).
    cmd = ["ffmpeg", "-nostdin", "-y"]
    for src, dlt in zip(inputs, deltas):
        if abs(dlt) > 1e-9:
            cmd.extend(["-itsoffset", f"{dlt:.6f}"])
        cmd.extend(["-i", src])

    # Build filter graph: per-segment trim+scale+pad, concat. pad needs
    # width:height as separate args (W:H, not WxH).
    filters = []
    for i, row in enumerate(edl):
        cam = row["cam"]; start = row["start"]; end = row["end"]
        filters.append(
            f"[{cam}:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,"
            f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}]"
        )
    concat_inputs = "".join(f"[v{i}]" for i in range(len(edl)))
    filters.append(f"{concat_inputs}concat=n={len(edl)}:v=1:a=0[vout]")
    fc = ";".join(filters)

    # Audio: trim from the EDL's first-row start (so window EDLs work)
    audio_offset = edl[0]["start"] if edl else 0.0
    duration = plan["duration_sec"]
    fc += (f";[{audio_src}:a:0]atrim=start={audio_offset}:"
           f"duration={duration},asetpts=PTS-STARTPTS[aout]")
    cmd.extend([
        "-filter_complex", fc,
        "-map", "[vout]",
        "-map", "[aout]",
        "-t", str(duration),
        "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(args.out),
    ])
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    main()
