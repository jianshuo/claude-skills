#!/usr/bin/env python3
"""Optional Atlas Cloud ASR client for wjs-transcribing-audio.

The client preflights the live model catalog and schema, requires an explicit
cost confirmation, submits once, and converts the completed response into the
same result.utterances[] shape consumed by build_srt_from_asr.py.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
from pathlib import Path
import sys
import time
from typing import Any, Callable
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.atlascloud.ai"
MODEL = "bytedance/seed-asr-2.0"
GENERATE = "/api/v1/model/generateAudio"
PREDICTION = "/api/v1/model/prediction/{request_id}"
FORMATS = {"mp3", "ogg", "raw", "wav"}
MAX_BYTES = 512 * 1024 * 1024


class AtlasError(RuntimeError):
    pass


class Transport:
    """Single-attempt HTTPS JSON transport."""

    def request(self, method, url, *, token=None, payload=None):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https":
            raise AtlasError(f"refusing non-HTTPS endpoint: {url}")
        if token and parsed.netloc != "api.atlascloud.ai":
            raise AtlasError("refusing to send the API key outside api.atlascloud.ai")
        headers = {
            "Accept": "application/json",
            "User-Agent": "wjs-transcribing-audio-atlas/1.0",
        }
        body = None
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise AtlasError(f"HTTP {error.code} for {method} {parsed.path}") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise AtlasError(f"request failed for {method} {parsed.path}: {error}") from error


def unwrap(response):
    data = response.get("data", response) if isinstance(response, dict) else response
    if not isinstance(data, dict):
        raise AtlasError("Atlas response is not an object")
    return data


def preflight(transport, token):
    raw = transport.request("GET", f"{API}/api/v1/models", token=token)
    models = raw.get("data", raw) if isinstance(raw, dict) else raw
    if isinstance(models, dict):
        models = models.get("models", models.get("items"))
    if not isinstance(models, list):
        raise AtlasError("live model catalog does not contain a model list")
    model = next((item for item in models if item.get("model") == MODEL), None)
    if not model or model.get("display_console") is False:
        raise AtlasError(f"{MODEL} is not available in the live model catalog")

    schema_url = model.get("schema")
    if not schema_url:
        raise AtlasError("live model catalog does not provide a schema URL")
    schema = transport.request("GET", schema_url)
    try:
        paths = schema["paths"]
        required = set(schema["components"]["schemas"]["Input"]["required"])
    except (KeyError, TypeError) as error:
        raise AtlasError("model schema does not contain the expected OpenAPI contract") from error
    if GENERATE not in paths or PREDICTION not in paths:
        raise AtlasError("model schema routes changed; stop before submission")
    if not {"model", "audio_url"}.issubset(required):
        raise AtlasError("model schema inputs changed; stop before submission")

    price = ((model.get("price") or {}).get("actual") or {}).get("base_price")
    return str(price) if price is not None else "not published"


def audio_input(source, explicit_format=None, encode=True):
    parsed = urllib.parse.urlparse(source)
    path_text = parsed.path if parsed.scheme else source
    audio_format = explicit_format or Path(path_text).suffix.lower().lstrip(".")
    if audio_format not in FORMATS:
        raise AtlasError("use --format with mp3, ogg, raw, or wav")
    if parsed.scheme:
        if parsed.scheme != "https" or not parsed.netloc:
            raise AtlasError("remote audio must use a public HTTPS URL")
        return source, audio_format

    path = Path(source).expanduser()
    if not path.is_file():
        raise AtlasError(f"audio file not found: {source}")
    if path.stat().st_size > MAX_BYTES:
        raise AtlasError("audio exceeds the model's 512 MB limit")
    if not encode:
        return None, audio_format
    mime = mimetypes.guess_type(path.name)[0] or f"audio/{audio_format}"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}", audio_format


def request_id(prediction):
    value = prediction.get("id") or prediction.get("request_id")
    if not value:
        raise AtlasError("generation response did not include a prediction ID")
    return str(value)


def to_builder_shape(prediction):
    result = prediction.get("stt_result") or {}
    text = result.get("text")
    if not text and prediction.get("outputs"):
        text = prediction["outputs"][0]
    timeline = result.get("words") or []
    if not text:
        raise AtlasError("completed prediction did not contain transcript text")

    words = [item for item in timeline if item.get("type") != "utterance"]
    if words:
        normalized = [
            {
                "text": item["text"],
                "start_time": round(float(item.get("start", 0)) * 1000),
                "end_time": round(float(item.get("end", 0)) * 1000),
            }
            for item in words
            if item.get("text")
        ]
        utterances = [{
            "text": text,
            "start_time": normalized[0]["start_time"],
            "end_time": normalized[-1]["end_time"],
            "words": normalized,
        }] if normalized else []
    else:
        utterances = [
            {
                "text": item["text"],
                "start_time": round(float(item.get("start", 0)) * 1000),
                "end_time": round(float(item.get("end", 0)) * 1000),
                "words": [],
            }
            for item in timeline
            if item.get("text")
        ]
    if not utterances:
        duration = round(float(result.get("duration", 0)) * 1000)
        utterances = [{"text": text, "start_time": 0, "end_time": duration, "words": []}]
    return {"result": {"text": text, "utterances": utterances}}


def transcribe(
    source,
    *,
    token,
    confirmed,
    audio_format=None,
    language=None,
    poll_attempts=8,
    poll_interval=2.0,
    transport=None,
    sleep: Callable[[float], None] = time.sleep,
    stderr=sys.stderr,
):
    if not token:
        raise AtlasError("set ATLASCLOUD_API_KEY before using the Atlas backend")
    if poll_attempts < 1 or poll_interval < 0:
        raise AtlasError("poll attempts must be positive and interval cannot be negative")
    transport = transport or Transport()
    price = preflight(transport, token)
    print(f"Live Atlas catalog price for {MODEL}: {price}", file=stderr)
    _, fmt = audio_input(source, audio_format, encode=False)
    if not confirmed:
        return {"submitted": False, "model": MODEL, "catalog_price": price}

    audio, _ = audio_input(source, audio_format, encode=True)
    payload = {
        "model": MODEL,
        "audio_url": audio,
        "format": fmt,
        "enable_itn": True,
        "enable_punc": True,
        "show_utterances": True,
    }
    if language:
        payload["language"] = language
    submitted = unwrap(transport.request(
        "POST", f"{API}{GENERATE}", token=token, payload=payload
    ))
    prediction_id = request_id(submitted)

    last_error = None
    for attempt in range(poll_attempts):
        try:
            current = unwrap(transport.request(
                "GET", f"{API}{PREDICTION.format(request_id=prediction_id)}", token=token
            ))
            last_error = None
        except AtlasError as error:
            current = {}
            last_error = error
        status = str(current.get("status", "")).lower()
        if status == "completed":
            return to_builder_shape(current)
        if status in {"failed", "canceled", "cancelled"}:
            detail = current.get("error") or current.get("message") or "no detail"
            raise AtlasError(f"prediction {prediction_id} {status}: {detail}")
        if attempt + 1 < poll_attempts:
            sleep(poll_interval * min(2 ** attempt, 8))
    if last_error:
        raise AtlasError(f"prediction GET failed after {poll_attempts} attempts: {last_error}")
    raise AtlasError(f"prediction {prediction_id} did not complete after {poll_attempts} GETs")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", help="local audio path or public HTTPS URL")
    ap.add_argument("output_json")
    ap.add_argument("--format", choices=sorted(FORMATS))
    ap.add_argument("--language", help="Atlas language code, e.g. zh-CN, en-US, es-MX")
    ap.add_argument("--poll-attempts", type=int, default=8)
    ap.add_argument("--poll-interval", type=float, default=2.0)
    ap.add_argument("--yes", action="store_true",
                    help="accept the live catalog quote and allow one generation POST")
    args = ap.parse_args()
    token = os.environ.get("ATLASCLOUD_API_KEY") or os.environ.get("ATLAS_CLOUD_API_KEY", "")
    try:
        result = transcribe(
            args.audio, token=token, confirmed=args.yes, audio_format=args.format,
            language=args.language, poll_attempts=args.poll_attempts,
            poll_interval=args.poll_interval,
        )
    except AtlasError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    if result.get("submitted") is False:
        print(json.dumps(result, ensure_ascii=False))
        print("Preflight only; re-run with --yes after explicit cost approval.", file=sys.stderr)
        return 0
    with open(args.output_json, "w", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
    print(f"Atlas transcript -> {args.output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
