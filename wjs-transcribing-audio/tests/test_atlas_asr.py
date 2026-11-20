from __future__ import annotations

import io
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import atlas_asr  # noqa: E402
import build_srt_from_asr  # noqa: E402

SCHEMA = {
    "paths": {atlas_asr.GENERATE: {}, atlas_asr.PREDICTION: {}},
    "components": {"schemas": {"Input": {"required": ["model", "audio_url"]}}},
}


class FakeTransport:
    def __init__(self, predictions=None):
        self.calls = []
        self.predictions = list(predictions or [])

    def request(self, method, url, *, token=None, payload=None):
        self.calls.append((method, url, payload))
        if url.endswith("/api/v1/models"):
            return {"data": [{
                "model": atlas_asr.MODEL,
                "display_console": True,
                "schema": "https://static.atlascloud.ai/model/schema/asr.json",
                "price": {"actual": {"base_price": "0.002"}},
            }]}
        if url.endswith("asr.json"):
            return SCHEMA
        if method == "POST":
            return {"id": "pred-1", "status": "created"}
        value = self.predictions.pop(0)
        if isinstance(value, Exception):
            raise value
        return value


class AtlasASRTest(unittest.TestCase):
    def setUp(self):
        file = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        file.write(b"audio")
        file.close()
        self.audio = Path(file.name)

    def tearDown(self):
        self.audio.unlink(missing_ok=True)

    def test_preflight_does_not_submit(self):
        transport = FakeTransport()
        result = atlas_asr.transcribe(
            str(self.audio), token="test", confirmed=False,
            transport=transport, stderr=io.StringIO(),
        )
        self.assertFalse(result["submitted"])
        self.assertEqual([call[0] for call in transport.calls], ["GET", "GET"])

    def test_submits_once_and_converts_word_timestamps(self):
        transport = FakeTransport([
            {"id": "pred-1", "status": "processing"},
            {"status": "completed", "stt_result": {
                "text": "Hello world.",
                "duration": 1.0,
                "words": [
                    {"text": "Hello", "start": 0.1, "end": 0.4, "type": "word"},
                    {"text": "world", "start": 0.5, "end": 0.9, "type": "word"},
                ],
            }},
        ])
        sleeps = []
        result = atlas_asr.transcribe(
            str(self.audio), token="test", confirmed=True, transport=transport,
            poll_interval=0.25, sleep=sleeps.append, stderr=io.StringIO(),
        )
        methods = [call[0] for call in transport.calls]
        self.assertEqual(methods.count("POST"), 1)
        self.assertEqual(result["result"]["utterances"][0]["words"][0]["start_time"], 100)
        self.assertEqual(result["result"]["utterances"][0]["words"][1]["end_time"], 900)
        cues = build_srt_from_asr.cues_from_utt(result["result"]["utterances"][0])
        self.assertEqual((cues[0][0], cues[-1][1]), (100, 900))
        self.assertEqual(sleeps, [0.25])

    def test_failed_prediction_is_not_resubmitted(self):
        transport = FakeTransport([
            {"id": "pred-1", "status": "failed", "error": "bad audio"},
        ])
        with self.assertRaisesRegex(atlas_asr.AtlasError, "bad audio"):
            atlas_asr.transcribe(
                str(self.audio), token="test", confirmed=True,
                transport=transport, sleep=lambda _: None, stderr=io.StringIO(),
            )
        self.assertEqual([call[0] for call in transport.calls].count("POST"), 1)

    def test_prediction_get_retries_are_bounded(self):
        transport = FakeTransport([
            atlas_asr.AtlasError("temporary"), atlas_asr.AtlasError("temporary"),
        ])
        sleeps = []
        with self.assertRaisesRegex(atlas_asr.AtlasError, "after 2 attempts"):
            atlas_asr.transcribe(
                str(self.audio), token="test", confirmed=True,
                poll_attempts=2, poll_interval=0.5, transport=transport,
                sleep=sleeps.append, stderr=io.StringIO(),
            )
        self.assertEqual(sleeps, [0.5])
        self.assertEqual([call[0] for call in transport.calls].count("POST"), 1)


if __name__ == "__main__":
    unittest.main()
