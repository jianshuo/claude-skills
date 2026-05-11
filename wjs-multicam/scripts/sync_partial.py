#!/usr/bin/env python3
"""Sync a partial-coverage source (e.g. a Riverside recording, a phone audio
recorder, a clip that started mid-session) to an existing reference camera
already on the common timeline.

Output is a file with the same duration as the reference, with leading
black+silence padding so the new source can drop into the multicam set as
another timeline-aligned input. Original input is not modified.

Usage:
    python sync_partial.py REF_SYNCED.mov NEW_INPUT.mp4 [--out NAME] \
        [--video|--audio-only] [--encoder hevc_videotoolbox] [--bitrate 8M]
"""
import argparse, json, subprocess, tempfile
from pathlib import Path

import numpy as np
from scipy import signal

SR = 8000

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
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","default=nw=1:nk=1", str(p)], check=True,
                         capture_output=True, text=True)
    return float(out.stdout.strip())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reference", type=Path, help="Already-synced reference camera (sets the timeline)")
    ap.add_argument("new", type=Path, help="New source to align")
    ap.add_argument("--out", type=Path, default=None, help="Output path (default: <new_stem>_synced.mp4)")
    ap.add_argument("--encoder", default="hevc_videotoolbox")
    ap.add_argument("--bitrate", default="8M")
    ap.add_argument("--audio-only", action="store_true",
                    help="Skip video; produce a .m4a synced to the reference timeline")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args()

    out = args.out or args.new.with_name(f"{args.new.stem}_synced{'.m4a' if args.audio_only else '.mp4'}")
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
        coarse = lags[pk] / esr
        ncoef = xc[pk] / len(env_r)
        print(f"Coarse offset: {coarse:.4f}s (xc/N={ncoef:.3f})")
        if abs(ncoef) < 0.3:
            print(f"WARNING: low correlation; sync may be wrong")

        # multi-probe refinement
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
                y0,y1,y2 = xc[pk-1], xc[pk], xc[pk+1]
                d = y0 - 2*y1 + y2
                sub = 0.5*(y0-y2)/d if abs(d) > 1e-9 else 0.0
            else:
                sub = 0.0
            return (lo + pk + sub)/SR - b_start, val

        probes = []
        for bs in np.arange(60.0, new_dur - 60.0, 180.0):
            res = refine(bs, coarse)
            if res:
                probes.append((bs, res[0], res[1]))

        if probes:
            arr = np.array(probes)
            good = np.abs(arr[:,2]) > 0.05
            if good.sum() >= 3:
                slope, intercept = np.polyfit(arr[good,0], arr[good,1], 1)
                midpoint = new_dur / 2
                delta = float(slope * midpoint + intercept)
                drift_ms = float(slope * new_dur * 1000)
                print(f"Drift: {drift_ms:+.2f} ms over {new_dur:.0f}s")
            else:
                delta = float(np.median(arr[:,1]))
        else:
            delta = float(coarse)
        print(f"Chosen delta: {delta:.4f}s (= start of new in reference timeline)")

    # Compute trim and pad
    pre_pad = max(0.0, delta)
    in_start = max(0.0, -delta)
    avail = new_dur - in_start
    out_avail = ref_dur - pre_pad
    use_dur = min(avail, out_avail)
    post_pad = ref_dur - pre_pad - use_dur
    in_end = in_start + use_dur
    print(f"\nPlan:")
    print(f"  Pre-pad black/silence: {pre_pad:.3f}s")
    print(f"  Use new[{in_start:.3f} .. {in_end:.3f}]  ({use_dur:.3f}s)")
    print(f"  Post-pad: {post_pad:.3f}s")
    print(f"  Output total: {ref_dur:.3f}s")

    # ffmpeg with tpad for video + adelay for audio
    # adelay accepts ms; pre_pad in ms
    pre_ms = int(round(pre_pad * 1000))

    if args.audio_only:
        af = (
            f"[0:a]atrim=start={in_start}:end={in_end},asetpts=PTS-STARTPTS,"
            f"aresample=48000"
            + (f",adelay={pre_ms}" if pre_ms > 0 else "")
            + (f",apad=pad_dur={post_pad}" if post_pad > 0.01 else "")
            + "[a]"
        )
        cmd = ["ffmpeg","-nostdin","-y","-i", str(args.new),
               "-filter_complex", af, "-map","[a]",
               "-t", f"{ref_dur}",
               "-c:a","aac","-b:a","192k","-movflags","+faststart",
               str(out)]
    else:
        W, H, fps = args.width, args.height, args.fps
        vf = (
            f"[0:v]trim=start={in_start}:end={in_end},setpts=PTS-STARTPTS,"
            f"fps={fps},scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1"
            + (f",tpad=start_duration={pre_pad}:color=black" if pre_pad > 0.01 else "")
            + (f",tpad=stop_duration={post_pad}:color=black" if post_pad > 0.01 else "")
            + "[v]"
        )
        af = (
            f"[0:a]atrim=start={in_start}:end={in_end},asetpts=PTS-STARTPTS,"
            f"aresample=48000"
            + (f",adelay={pre_ms}" if pre_ms > 0 else "")
            + (f",apad=pad_dur={post_pad}" if post_pad > 0.01 else "")
            + "[a]"
        )
        cmd = ["ffmpeg","-nostdin","-y","-i", str(args.new),
               "-filter_complex", f"{vf};{af}",
               "-map","[v]","-map","[a]",
               "-t", f"{ref_dur}",
               "-c:v", args.encoder, "-b:v", args.bitrate, "-tag:v","hvc1",
               "-c:a","aac","-b:a","192k","-movflags","+faststart",
               str(out)]

    sidecar = out.with_suffix(out.suffix + ".sync.json")
    sidecar.write_text(json.dumps({
        "reference": str(args.reference),
        "input": str(args.new),
        "output": str(out),
        "delta_seconds": delta,
        "pre_pad_seconds": pre_pad,
        "input_trim_start": in_start,
        "input_trim_end": in_end,
        "post_pad_seconds": post_pad,
    }, indent=2))
    print(f"Sidecar metadata: {sidecar}")
    print("Running ffmpeg...")
    subprocess.run(cmd, check=True)
    print(f"Done: {out}")

if __name__ == "__main__":
    main()
