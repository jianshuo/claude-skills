#!/usr/bin/env python3
"""Generate a target-language voice dub from an SRT, time-aligned to the
original video.

Supports Chinese (Volcano TTS preferred, edge-tts fallback) and English
(edge-tts neural voices) targets — engine routes by voice ID:

  - VOICE matches `zh_..._bigtts`           → Volcano (env: VOLC_TTS_APPID,
                                                       VOLC_TTS_ACCESS_TOKEN)
  - VOICE matches `*Neural` (zh-CN, en-US…) → edge-tts

Auto-detects the source video and SRT in the cwd. Pass --video / --srt to
override. Output file derives from the source name + a language tag
inferred from the SRT extension (e.g., foo.zh-CN.srt → foo_zh_dub.mp4,
foo.en.srt → foo_en_dub.mp4).

Usage:
  .venv/bin/python dub.py [voice] [rate] [pitch] [--video FILE] [--srt FILE] [--out FILE]

Examples:
  # Mature Chinese contemplative female (Volcano):
  .venv/bin/python dub.py zh_female_gaolengyujie_moon_bigtts -8% +0Hz

  # Warm English caring female (edge-tts, multilingual):
  .venv/bin/python dub.py en-US-AvaMultilingualNeural -5% -3Hz

  # Default Chinese fallback (no Volcano creds needed):
  .venv/bin/python dub.py zh-CN-XiaoxiaoNeural -8% -10Hz
"""
import re, subprocess, sys, json, shutil, asyncio, argparse, os
from pathlib import Path
import edge_tts

ap = argparse.ArgumentParser()
ap.add_argument("voice", nargs="?", default="zh-CN-XiaoxiaoNeural")
ap.add_argument("rate", nargs="?", default="+0%")
ap.add_argument("pitch", nargs="?", default="+0Hz")
ap.add_argument("--video", default=None)
ap.add_argument("--srt", default=None)
ap.add_argument("--out", default=None)
ap.add_argument("--voice-map", default="",
                help='comma-separated speaker=voice pairs, e.g. "A=en-US-BrianMultilingualNeural,B=en-US-AndrewMultilingualNeural". Cues prefixed with [A]/[B] in the SRT route to that voice. Cues with no tag use the default --voice.')
args = ap.parse_args()
VOICE, RATE, PITCH = args.voice, args.rate, args.pitch
VOICE_MAP = {}
if args.voice_map:
    for pair in args.voice_map.split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            VOICE_MAP[k.strip()] = v.strip()

def autodetect_video() -> Path:
    cs = []
    for ext in ("*.mp4","*.MP4","*.mov","*.MOV","*.mkv","*.avi"):
        cs += list(Path(".").glob(ext))
    # Skip anything that looks like one of our outputs
    skip_suffixes = ("_zh_dub","_en_dub","_zh_final","_en_final","_final","_zh","_en")
    cs = [p for p in cs if not any(p.stem.endswith(s) for s in skip_suffixes)]
    if len(cs) != 1:
        sys.exit(f"specify --video; found {len(cs)} candidates: {cs}")
    return cs[0]

def autodetect_srt(video: Path) -> Path:
    # Prefer language-tagged SRTs; if multiple, prompt with list.
    candidates = sorted(
        list(Path(".").glob(f"{video.stem}.zh-CN.srt"))
      + list(Path(".").glob(f"{video.stem}.en.srt"))
      + list(Path(".").glob("*.zh-CN.srt"))
      + list(Path(".").glob("*.en.srt"))
    )
    seen = []
    for p in candidates:
        if p not in seen: seen.append(p)
    if len(seen) == 1: return seen[0]
    sys.exit(f"specify --srt; found {len(seen)} candidates: {seen}")

VIDEO = Path(args.video) if args.video else autodetect_video()
SRT = Path(args.srt) if args.srt else autodetect_srt(VIDEO)
# Infer language tag from SRT extension: foo.zh-CN.srt → "zh", foo.en.srt → "en"
_lang_match = re.search(r"\.(zh(?:-CN|-TW|-HK)?|en|es)\.srt$", SRT.name)
LANG_TAG = "zh" if (_lang_match and _lang_match.group(1).startswith("zh")) else \
           (_lang_match.group(1) if _lang_match else "zh")
OUT = Path(args.out) if args.out else Path(f"{VIDEO.stem}_{LANG_TAG}_dub.mp4")
WORK = Path("dub_work")
WORK.mkdir(exist_ok=True)

def ts_to_sec(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000

def parse_srt(text: str):
    blocks = re.split(r"\n\s*\n", text.strip())
    out = []
    for b in blocks:
        lines = b.strip().splitlines()
        if len(lines) < 3: continue
        idx = int(lines[0])
        m = re.match(r"(\S+)\s+-->\s+(\S+)", lines[1])
        start, end = ts_to_sec(m.group(1)), ts_to_sec(m.group(2))
        # join remaining lines, strip line breaks (TTS reads as one)
        spoken = " ".join(lines[2:]).replace("——", "，").replace("—", "，")
        # extract optional [A]/[B]/etc. speaker tag at start
        sm = re.match(r'^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*', spoken)
        speaker = None
        if sm:
            speaker = sm.group(1)
            spoken = spoken[sm.end():]
        out.append((idx, start, end, spoken, speaker))
    return out

def probe_dur(p: Path) -> float:
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                        "-of","default=nw=1:nk=1", str(p)], capture_output=True, text=True)
    return float(r.stdout.strip())

segs = parse_srt(SRT.read_text())
video_dur = probe_dur(VIDEO)
print(f"video: {video_dur:.3f}s, {len(segs)} segments, voice={VOICE}")

# 1. generate TTS per segment
# Engine selection:
#   - VOICE starts with "zh_" (Volcano speaker IDs like zh_female_*_bigtts) → Volcano TTS 2.0
#   - VOICE starts with "zh-CN-/zh-HK-/en-US-" etc → edge-tts neural voices
import time, requests as _rq

def is_volcano_voice(v): return v.startswith("zh_") and "bigtts" in v

def voice_for(speaker):
    """Look up effective voice ID for a given speaker tag (None → default)."""
    if speaker and speaker in VOICE_MAP:
        return VOICE_MAP[speaker]
    return VOICE

def volcano_synth(text: str, out_path: Path, voice: str = None):
    """Volcano (字节豆包) TTS via /api/v3/tts/unidirectional.

    Streaming NDJSON response: each line is a JSON event carrying a
    base64 mp3 chunk in `data`. Final event has code 20000000 ("OK").

    Uses resource_id `volc.service_type.10029` which works with the
    common `*_bigtts` speakers in TTS-SeedTTS2.0 instances. (The
    `seed-tts-2.0` resource is reserved for a different speaker
    catalog that needs separate activation.)

    Needs env: VOLC_TTS_APPID, VOLC_TTS_ACCESS_TOKEN.
    """
    import base64, json
    url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    h = {
        "X-Api-App-Id": os.environ["VOLC_TTS_APPID"],
        "X-Api-Access-Key": os.environ["VOLC_TTS_ACCESS_TOKEN"],
        "X-Api-Resource-Id": os.environ.get("VOLC_TTS_RESOURCE", "volc.service_type.10029"),
        "Content-Type": "application/json",
    }
    rate_pct = int(RATE.rstrip("%"))           # e.g. -8 → speech_rate
    payload = {
        "user": {"uid": "dub-script"},
        "req_params": {
            "text": text,
            "speaker": voice or VOICE,
            "audio_params": {
                "format": "mp3",
                "sample_rate": 24000,
                "emotion": os.environ.get("VOLC_TTS_EMOTION", "calm"),
                "emotion_scale": int(os.environ.get("VOLC_TTS_EMOTION_SCALE", "4")),
                "speech_rate": max(-50, min(100, rate_pct)),
                "loudness_rate": 0,
            },
        },
    }
    r = _rq.post(url, headers=h, json=payload, timeout=60, stream=True)
    if r.status_code != 200:
        raise RuntimeError(f"Volcano TTS HTTP {r.status_code}: {r.content[:300]!r}")
    audio = b""
    for line in r.iter_lines():
        if not line: continue
        evt = json.loads(line)
        code = evt.get("code")
        if code not in (0, None, 20000000):
            raise RuntimeError(f"Volcano TTS code={code} msg={evt.get('message')!r}")
        if evt.get("data"):
            audio += base64.b64decode(evt["data"])
    if not audio:
        raise RuntimeError("Volcano TTS returned no audio data")
    out_path.write_bytes(audio)

async def edge_synth(text: str, out_path: Path, voice: str = None):
    comm = edge_tts.Communicate(text, voice or VOICE, rate=RATE, pitch=PITCH)
    await comm.save(str(out_path))

import os
print(f"voice map: {VOICE_MAP or '(none — using default voice for all)'}")

async def gen_all():
    for idx, start, end, text, speaker in segs:
        mp3 = WORK / f"seg_{idx:02d}.mp3"
        if mp3.exists() and mp3.stat().st_size > 0:
            continue
        v = voice_for(speaker)
        engine = "volcano" if is_volcano_voice(v) else "edge"
        for attempt in range(8):
            try:
                if engine == "volcano":
                    volcano_synth(text, mp3, voice=v)
                else:
                    await edge_synth(text, mp3, voice=v)
                if mp3.exists() and mp3.stat().st_size > 0:
                    break
            except Exception as e:
                print(f"  seg{idx:02d} [{speaker or '-'}] attempt {attempt+1} failed: {e}")
            await asyncio.sleep(1.5 * (attempt + 1))
        else:
            sys.exit(f"failed to generate seg {idx}")

asyncio.run(gen_all())

# 2. for each segment, atempo or pad to fit target duration
inputs = []
filt = []
for i, (idx, start, end, text, speaker) in enumerate(segs):
    mp3 = WORK / f"seg_{idx:02d}.mp3"
    tts_dur = probe_dur(mp3)
    target = end - start
    inputs.extend(["-i", str(mp3)])

    chain = f"[{i}:a]"
    if tts_dur > target:
        # speed up via atempo (chain if >2x)
        ratio = tts_dur / target
        steps = []
        r = ratio
        while r > 2.0:
            steps.append(2.0); r /= 2.0
        steps.append(r)
        for s in steps:
            chain += f"atempo={s:.4f},"
        chain = chain.rstrip(",")
        chain += f",apad=whole_dur={target:.3f}[a{i}]"
    else:
        chain += f"apad=whole_dur={target:.3f}[a{i}]"
    filt.append(chain)
    print(f"  seg{idx:02d}: tts={tts_dur:.2f}s target={target:.2f}s {'speedup' if tts_dur>target else 'pad'}")

# 3. concat segments, then pad tail to video length
concat_inputs = "".join(f"[a{i}]" for i in range(len(segs)))
filt.append(f"{concat_inputs}concat=n={len(segs)}:v=0:a=1[joined]")

# leading silence before seg 1 (if start>0)
first_start = segs[0][1]
last_end = segs[-1][2]
# segments are placed sequentially using their target durations starting from t=0,
# but actual SRT starts at first_start and there are gaps. We need to insert silence.
# Simpler: rebuild with silence segments between SRT entries.
filt = []
audio_parts = []
prev_end = 0.0
silence_idx = 0
input_count = 0
new_inputs = []
parts = []  # list of [label]

# We'll create silent inputs via aevalsrc/anullsrc inline
# Restart with cleaner pipeline:
pipeline_segments = []  # list of (kind, payload)
prev = 0.0
for idx, start, end, text, speaker in segs:
    if start > prev + 0.01:
        pipeline_segments.append(("silence", start - prev))
    pipeline_segments.append(("tts", idx, end - start))
    prev = end
if video_dur > prev + 0.01:
    pipeline_segments.append(("silence", video_dur - prev))

# Build ffmpeg inputs: only TTS files as inputs; silence via filter
inputs = []
filt_lines = []
labels = []
tts_input_idx = 0
for i, seg in enumerate(pipeline_segments):
    if seg[0] == "silence":
        dur = seg[1]
        filt_lines.append(f"anullsrc=r=44100:cl=mono:d={dur:.3f}[s{i}]")
        labels.append(f"[s{i}]")
    else:
        _, idx, target = seg
        mp3 = WORK / f"seg_{idx:02d}.mp3"
        tts_dur = probe_dur(mp3)
        inputs.extend(["-i", str(mp3)])
        chain = f"[{tts_input_idx}:a]"
        tts_input_idx += 1
        # MIN_ATEMPO: lower bound for time-stretching to fill silence.
        # Below ~0.85x, voice starts sounding drugged. Above 0.92x is imperceptible.
        MIN_ATEMPO = 0.82
        STRETCH_GAP = 0.5  # only stretch when slot has >0.5s slack
        if tts_dur > target:
            ratio = tts_dur / target
            steps = []
            r = ratio
            while r > 2.0:
                steps.append(2.0); r /= 2.0
            steps.append(r)
            for s in steps:
                chain += f"atempo={s:.4f},"
            chain = chain.rstrip(",")
            chain += f",apad=whole_dur={target:.3f},atrim=duration={target:.3f}[a{i}]"
            mode = "speedup"
        elif target - tts_dur > STRETCH_GAP and tts_dur > 0:
            # mild slow-stretch, then pad remainder with silence
            stretch = max(MIN_ATEMPO, tts_dur / target)
            chain += f"atempo={stretch:.4f},apad=whole_dur={target:.3f},atrim=duration={target:.3f}[a{i}]"
            mode = f"stretch×{stretch:.2f}"
        else:
            chain += f"apad=whole_dur={target:.3f},atrim=duration={target:.3f}[a{i}]"
            mode = "pad"
        filt_lines.append(chain)
        labels.append(f"[a{i}]")
        # report (overrides earlier print line)
        print(f"  seg{idx:02d}: tts={tts_dur:.2f}s target={target:.2f}s {mode}")

concat = "".join(labels) + f"concat=n={len(labels)}:v=0:a=1,aresample=44100[outa]"
filt_lines.append(concat)
filter_complex = ";".join(filt_lines)

cmd = ["ffmpeg","-y", *inputs, "-i", str(VIDEO),
       "-filter_complex", filter_complex,
       "-map", f"{tts_input_idx}:v",
       "-map", "[outa]",
       "-c:v","copy","-c:a","aac","-b:a","160k",
       "-shortest", str(OUT)]

print("\nrunning ffmpeg…")
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print("FFMPEG STDERR:")
    print(r.stderr[-3000:])
    sys.exit(1)
print(f"\n✓ wrote {OUT}  ({probe_dur(OUT):.2f}s)")
