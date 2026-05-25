#!/usr/bin/env python3
"""火山引擎 大模型流式语音识别 (bigmodel streaming ASR) — the WORKING Chinese path.

Pushes raw PCM audio bytes over a WebSocket. NO public URL, NO server-side
file download, NO 飞书妙记. Returns utterances with per-word ms timestamps,
which `build_srt_from_asr.py` turns into a clean, audio-aligned SRT.

Why streaming (not 录音文件识别 / MediaKit): every file/URL API requires a
publicly reachable HTTP(S) URL for the audio. Hosting that is fragile (tunnels
fail on hotspots) and the user rejected the "server downloads the mp3" model.
Streaming sidesteps the URL entirely by pushing bytes.

Protocol: openspeech v3 binary framing (gzip + JSON).
Endpoint:  wss://openspeech.bytedance.com/api/v3/sauc/bigmodel

Usage:
  volc_asr_stream.py <input.pcm|wav|mp3|mp4|mov> <out.json>

Credentials (env, either naming works):
  VOLC_ASR_APPID  / VOLC_APPID
  VOLC_ASR_ACCESS_TOKEN / VOLC_TOKEN
Optional:
  FFMPEG_BIN  (default: ffmpeg on PATH)  — used to decode non-.pcm input
"""
import sys, os, json, gzip, uuid, time, struct, subprocess
from concurrent.futures import ThreadPoolExecutor
import websocket  # pip install websocket-client

APPID = os.environ.get("VOLC_ASR_APPID") or os.environ["VOLC_APPID"]
TOKEN = os.environ.get("VOLC_ASR_ACCESS_TOKEN") or os.environ["VOLC_TOKEN"]
FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")
ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"
RESOURCE_ID = "volc.bigasr.sauc.duration"

# ---- binary protocol constants ----
PROTOCOL_VERSION = 0b0001
DEFAULT_HEADER_SIZE = 0b0001
FULL_CLIENT = 0b0001
AUDIO_ONLY = 0b0010
FULL_SERVER = 0b1001
ERROR_RESP = 0b1111
POS_SEQ = 0b0001
NEG_WITH_SEQ = 0b0011
JSON_SER = 0b0001
GZIP = 0b0001


def header(msg_type, flags, ser=JSON_SER, comp=GZIP):
    return bytes([
        (PROTOCOL_VERSION << 4) | DEFAULT_HEADER_SIZE,
        (msg_type << 4) | flags,
        (ser << 4) | comp,
        0x00,
    ])


def build_full_client(seq):
    payload = {
        "user": {"uid": "wjs-asr"},
        "audio": {"format": "pcm", "rate": 16000, "bits": 16, "channel": 1, "codec": "raw"},
        "request": {
            "model_name": "bigmodel",
            "enable_punc": True,
            "enable_itn": True,
            "show_utterances": True,
            # NOTE: do NOT set result_type:"single" — that returns only the
            # latest sentence each frame; default mode accumulates all.
        },
    }
    body = gzip.compress(json.dumps(payload).encode("utf-8"))
    return header(FULL_CLIENT, POS_SEQ) + struct.pack(">i", seq) + struct.pack(">I", len(body)) + body


def build_audio(chunk, seq, last):
    flags = NEG_WITH_SEQ if last else POS_SEQ
    body = gzip.compress(chunk)
    seqv = -seq if last else seq
    return header(AUDIO_ONLY, flags, ser=0, comp=GZIP) + struct.pack(">i", seqv) + struct.pack(">I", len(body)) + body


def parse_response(data):
    msg_type = (data[1] >> 4) & 0x0f
    flags = data[1] & 0x0f
    ser = (data[2] >> 4) & 0x0f
    comp = data[2] & 0x0f
    payload = data[4:]
    if flags & 0x01 or flags & 0x02:
        payload = payload[4:]  # skip seq
    if msg_type == ERROR_RESP:
        code = struct.unpack(">I", payload[:4])[0]
        sz = struct.unpack(">I", payload[4:8])[0]
        body = payload[8:8+sz]
        if comp == GZIP:
            body = gzip.decompress(body)
        return {"_error": code, "_msg": body.decode("utf-8", "replace")}
    sz = struct.unpack(">I", payload[:4])[0]
    body = payload[4:4+sz]
    if comp == GZIP and body:
        body = gzip.decompress(body)
    if ser == JSON_SER and body:
        return json.loads(body.decode("utf-8"))
    return {"_raw": body}


def to_pcm(path):
    if path.endswith(".pcm"):
        return open(path, "rb").read()
    out = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-vn", "-ac", "1",
                          "-ar", "16000", "-f", "s16le", "-"], capture_output=True)
    return out.stdout


BYTES_PER_SEC = 16000 * 2          # 16k mono s16le
CHUNK_SEC = 600                    # 10-min ASR chunks — the streaming session
                                   # times out ("waiting next packet") on long
                                   # (>~12 min) single connections, so split.
MAX_WORKERS = int(os.environ.get("VOLC_ASR_WORKERS", "4"))  # chunks transcribed
                                   # concurrently. The bigmodel streaming API runs
                                   # at ~realtime per connection, so N parallel
                                   # connections cut wall time ~Nx. Lower if the
                                   # account hits a concurrency/QPS cap.


def transcribe_pcm(pcm):
    """Stream one PCM blob over a single WebSocket connection and return the
    final result dict (raises on server error / init failure)."""
    hdrs = {
        "X-Api-App-Key": APPID,
        "X-Api-Access-Key": TOKEN,
        "X-Api-Resource-Id": RESOURCE_ID,
        "X-Api-Connect-Id": str(uuid.uuid4()),
    }
    ws = websocket.create_connection(ENDPOINT, header=[f"{k}: {v}" for k, v in hdrs.items()],
                                     timeout=30, max_size=None)
    try:
        seq = 1
        ws.send_binary(build_full_client(seq))
        init = parse_response(ws.recv())
        if init.get("_error"):
            raise RuntimeError(f"init error: {init}")

        CHUNK = 6400  # 200ms @ 16k mono s16le
        chunks = [pcm[i:i+CHUNK] for i in range(0, len(pcm), CHUNK)]
        last_result = None
        for i, ch in enumerate(chunks):
            seq += 1
            ws.send_binary(build_audio(ch, seq, i == len(chunks) - 1))
            try:
                ws.settimeout(0.01)
                while True:
                    r = parse_response(ws.recv())
                    if r.get("_error"):
                        raise RuntimeError(f"stream error: {r}")
                    if "result" in r:
                        last_result = r
            except RuntimeError:
                raise
            except Exception:
                pass
            ws.settimeout(30)
            time.sleep(0.02)

        while True:
            try:
                r = parse_response(ws.recv())
            except Exception:
                break
            if r.get("_error"):
                raise RuntimeError(f"tail error: {r}")
            if "result" in r:
                last_result = r
        return last_result
    finally:
        ws.close()


def _shift(res, off_ms):
    """Add off_ms to every (non-zero) timestamp in a chunk result, in place.
    Zero stays zero — build_srt treats 0 as 'missing' and fills from neighbours."""
    for u in res.get("result", {}).get("utterances", []):
        if u.get("start_time"):
            u["start_time"] += off_ms
        if u.get("end_time"):
            u["end_time"] += off_ms
        for w in u.get("words", []):
            if w.get("start_time"):
                w["start_time"] += off_ms
            if w.get("end_time"):
                w["end_time"] += off_ms
    return res


def main():
    inp, outp = sys.argv[1], sys.argv[2]
    pcm = to_pcm(inp)
    chunk_bytes = CHUNK_SEC * BYTES_PER_SEC

    if len(pcm) <= chunk_bytes:
        result = transcribe_pcm(pcm)
        if not result:
            print("NO RESULT"); sys.exit(1)
    else:
        n = (len(pcm) + chunk_bytes - 1) // chunk_bytes
        workers = min(MAX_WORKERS, n)
        print(f"long audio ({len(pcm)/BYTES_PER_SEC:.0f}s) -> {n} chunks of {CHUNK_SEC}s, "
              f"{workers} parallel")

        def do_chunk(i):
            seg = pcm[i*chunk_bytes:(i+1)*chunk_bytes]
            for attempt in range(3):
                try:
                    return i, transcribe_pcm(seg)
                except Exception as e:
                    print(f"  chunk {i+1}/{n} attempt {attempt+1} failed: {e}", flush=True)
                    time.sleep(min(2 ** attempt, 10))
            return i, None

        results = [None] * n
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for i, res in ex.map(do_chunk, range(n)):
                results[i] = res
                got = len(res.get("result", {}).get("utterances", [])) if res else 0
                print(f"  chunk {i+1}/{n}: {got} utts" if res
                      else f"  chunk {i+1}/{n}: FAILED", flush=True)

        utts, text = [], ""
        for i, res in enumerate(results):
            if not res:
                continue
            _shift(res, i * CHUNK_SEC * 1000)
            r = res.get("result", {})
            utts += r.get("utterances", [])
            text += r.get("text", "")
        if not utts:
            print("NO RESULT (all chunks failed)"); sys.exit(1)
        result = {"result": {"utterances": utts, "text": text}}

    json.dump(result, open(outp, "w"), ensure_ascii=False, indent=2)
    res = result.get("result", {})
    print(f"utterances={len(res.get('utterances', []))} text_len={len(res.get('text',''))} -> {outp}")


if __name__ == "__main__":
    main()
