#!/usr/bin/env python3
"""Generate Chinese narration via Volcano (火山引擎 / 豆包) TTS per chunk.

Reads narration_chunks.json from CWD, calls Volcano TTS for each chunk,
concatenates into narration.mp3 with 0.35s silence between chunks, writes
timing.json with start/end/duration per chunk for downstream HyperFrames sync.

DO NOT pass `emotion` / `emotion_scale` params — most `_bigtts` voices return
`data: null` silently when those are set.

Usage:
  cd <article-folder>/video
  ./tts.py
  ./tts.py --voice zh_male_baqiqingshu_mars_bigtts
"""
import os, sys, json, base64, subprocess, time, argparse
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("install requests:  uvx --with requests python tts.py  (or  pip install requests)")

DEFAULT_VOICE = "zh_male_ahu_conversation_wvae_bigtts"  # 阿虎对话 — natural conversational male
DEFAULT_GAP = 0.35  # seconds of silence between chunks
DEFAULT_SR = 24000

def synth(text: str, voice: str, out_path: Path):
    url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    h = {
        "X-Api-App-Id": os.environ["VOLC_TTS_APPID"],
        "X-Api-Access-Key": os.environ["VOLC_TTS_ACCESS_TOKEN"],
        "X-Api-Resource-Id": os.environ.get("VOLC_TTS_RESOURCE", "volc.service_type.10029"),
        "Content-Type": "application/json",
    }
    payload = {
        "user": {"uid": "wjs-text-to-video"},
        "req_params": {
            "text": text,
            "speaker": voice,
            "audio_params": {
                "format": "mp3",
                "sample_rate": DEFAULT_SR,
                "loudness_rate": 0,
            },
        },
    }
    last = None
    for attempt in range(5):
        try:
            r = requests.post(url, headers=h, json=payload, timeout=120)
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}: {r.content[:300]!r}")
            audio = b""
            for line in r.text.splitlines():
                line = line.strip()
                if not line:
                    continue
                evt = json.loads(line)
                code = evt.get("code")
                if code not in (0, None, 20000000):
                    raise RuntimeError(f"code={code} msg={evt.get('message')!r}")
                if evt.get("data"):
                    audio += base64.b64decode(evt["data"])
            if not audio:
                raise RuntimeError(f"empty audio (body head={r.text[:200]!r})")
            out_path.write_bytes(audio)
            return
        except Exception as e:
            last = e
            wait = 2 ** attempt
            print(f"  attempt {attempt+1} failed: {e}; retry in {wait}s", file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError(f"failed after retries: {last}")

def get_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip()
    return float(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--gap", type=float, default=DEFAULT_GAP)
    ap.add_argument("--chunks", default="narration_chunks.json")
    ap.add_argument("--out-dir", default="narration")
    ap.add_argument("--final", default="narration.mp3")
    ap.add_argument("--timing", default="timing.json")
    args = ap.parse_args()

    here = Path(".").resolve()
    chunks_path = here / args.chunks
    out_dir = here / args.out_dir
    out_dir.mkdir(exist_ok=True)
    chunks = json.loads(chunks_path.read_text())

    print(f"[tts] voice={args.voice} chunks={len(chunks)}", flush=True)
    for c in chunks:
        mp3 = out_dir / f"{c['id']}.mp3"
        if mp3.exists() and mp3.stat().st_size > 1000:
            continue
        print(f"[tts] synth {c['id']} ({len(c['text'])} chars)", flush=True)
        synth(c["text"], args.voice, mp3)

    # Compute timings and concat
    timing = []
    cursor = 0.0
    for c in chunks:
        mp3 = out_dir / f"{c['id']}.mp3"
        dur = get_duration(mp3)
        cps = len(c["text"]) / dur if dur > 0 else 0
        flag = "  ⚠️ slow" if cps < 2 else ""
        print(f"  {c['id']}  {dur:6.2f}s  {cps:.2f}c/s{flag}", flush=True)
        timing.append({
            "id": c["id"],
            "text": c["text"],
            "start": round(cursor, 3),
            "end": round(cursor + dur, 3),
            "duration": round(dur, 3),
            "gap_after": args.gap,
        })
        cursor += dur + args.gap

    total = round(cursor - args.gap, 3)
    (here / args.timing).write_text(json.dumps({
        "voice": args.voice,
        "total_duration": total,
        "chunks": timing,
    }, ensure_ascii=False, indent=2))

    # Concat with silence
    silence = here / "_silence.mp3"
    subprocess.check_call([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"anullsrc=r={DEFAULT_SR}:cl=mono",
        "-t", str(args.gap), "-c:a", "libmp3lame", "-b:a", "64k", str(silence),
    ])
    concat_list = here / "_concat.txt"
    lines = []
    for i, c in enumerate(chunks):
        lines.append(f"file '{(out_dir / (c['id']+'.mp3')).as_posix()}'")
        if i < len(chunks) - 1:
            lines.append(f"file '{silence.as_posix()}'")
    concat_list.write_text("\n".join(lines))
    final = here / args.final
    subprocess.check_call([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c", "copy", str(final),
    ])
    print(f"\n[tts] wrote {final} ({total}s)", flush=True)
    print(f"[tts] wrote {args.timing}", flush=True)

if __name__ == "__main__":
    main()
