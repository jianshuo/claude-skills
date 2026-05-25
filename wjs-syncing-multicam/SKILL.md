---
name: wjs-syncing-multicam
description: Use when the user has 2+ video / audio recordings of the same event captured by different devices (cameras, phones, separate audio recorders) and wants them aligned to a single common timeline. Outputs only a lightweight `.sync.json` sidecar per input — original files are never re-encoded. Triggers — "多机位同步", "对齐这几个机位", "match camera timelines", "sync these angles", "audio drift between cameras", "separate audio recorder", "Riverside / Zoom recording that needs to line up".
---

# wjs-syncing-multicam

Compute a single time offset for each multi-source recording of the same event using audio cross-correlation, and emit a `.sync.json` sidecar next to each original. **Originals are never modified, copied, or re-encoded.** Downstream tools use `-itsoffset` to apply the offset at consume time.

## Setup & commands

The implementation lives in the open-source **`polysync`** pip package (<https://pypi.org/project/polysync/> · <https://github.com/jianshuo/polysync>) — this skill no longer ships its own scripts. Ensure it's installed, then drive it via its CLI:

```bash
python3 -m pip install -U polysync      # needs ffmpeg/ffprobe on PATH

polysync sync   REFERENCE SOURCE        # align SOURCE to REFERENCE, write sidecars
polysync sync   REFERENCE SOURCE --partial   # source covers only part of the session
polysync verify REFERENCE SOURCE SOURCE.sync.json   # independent residual check
```

Run one `polysync sync` per non-reference angle (reference first, same reference each time). The sections below document the algorithm, the sidecar schema, and the gotchas baked into the package — read them to interpret output and choose flags.

## Design principle — sidecar over re-encode

Earlier versions of this skill produced `*_synced.MOV` files by trimming + re-encoding to bake the offset into the file. We removed that:

- **Disk** — a 75-min 4K shoot from 3 cameras is 60+ GB. Re-encoded synced copies double that for no information gain.
- **Quality** — every re-encode is lossy. The originals are the source of truth; sidecars are reversible metadata.
- **Speed** — `_synced.MOV` generation took 10+ min per file on Apple Silicon; sidecar emission takes seconds.
- **Composability** — any downstream tool (`polysync edit`, NLE import, ffmpeg one-liners) reads the sidecar and applies the offset itself. No tool-specific file format lock-in.

## When NOT to use

- Single-camera footage — nothing to sync to. For splitting one source into clips, use **video-segmentation**.
- Sources already aligned in an NLE timeline — don't fight the editor.
- For the auto-edit / cut / PiP rendering step that comes AFTER sync, use **wjs-editing-multicam** (consumes these sidecars).

## Why envelope-based, not raw waveform

Raw PCM cross-correlation gives weak peaks and false matches when the two mics have different gain / room response — i.e., almost always with a secondary cam. The log-energy envelope captures dialogue and music dynamics, which both mics hear regardless of frequency response. **Don't skip the envelope step — it's the entire reason this skill is robust at low SNR.**

## Algorithm

1. **Extract mono PCM at 8 kHz, 16-bit** from each input. The audio stream is **auto-selected by loudness** (`loudest_audio_stream`): probe each `0:a:N` over a 60 s mid-file window and pick the highest mean volume. Multi-track pro cameras break a naive `0:a:0` — Sony FX6 MXF clips carry 4 mono PCM tracks and routinely leave a:0 / a:1 **dead (~-90 dB)** with the room mic on a:2 / a:3; correlating the silent track fails to sync. Single-stream inputs (most MP4 cams) short-circuit to a:0.
2. **Log-energy envelope** at 100 Hz (10 ms hop, 50 ms window). High-pass with a 2nd-order Butterworth, 0.05 Hz cutoff, filtfilt — removes slow drift and gain offsets.
3. **FFT cross-correlate envelopes** end-to-end → coarse offset (~10 ms).
4. **Refine at sample level** with a 60 s probe from B near the coarse-aligned position in A, ±2 s search window, parabolic peak interpolation.
5. **Multi-probe drift check** — repeat step 4 every ~3 min. Linear fit `delta(t) = slope·t + intercept` reveals real clock drift (5–50 ppm typical). Use the **midpoint-canonical** offset (`slope · midpoint + intercept`) so residual error is symmetric around zero.
6. **Compute overlap window** in the reference timeline: `overlap = [max(0, delta), min(ref_dur, delta + src_dur)]`.
7. **Emit `.sync.json` sidecar** next to each non-reference input. No file is copied, trimmed, or re-encoded. The reference input gets a sidecar too (with `delta_seconds: 0`) so downstream code can treat all inputs uniformly.

`polysync sync` is the implementation. It emits **only** the `.sync.json` sidecar — no `_synced.MOV`, no re-encode.

## Sidecar schema (`<input>.sync.json`)

One sidecar per original input, written next to it. Pure JSON, no comments in-file — the field reference below is canonical.

```json
{
  "_about": "Sync metadata for cam_b.MOV. Apply via ffmpeg -itsoffset. See wjs-syncing-multicam SKILL.md for full schema.",
  "schema_version": 1,
  "source": "cam_b.MOV",
  "reference": "cam_a.MOV",
  "delta_seconds": 12.345,
  "drift_slope": 1.8e-5,
  "overlap_in_reference": [12.345, 4512.180],
  "overlap_in_source":    [0.000,   4499.835],
  "verification": {
    "median_residual_ms": 4.2,
    "residual_spread_ms": 11.8,
    "probe_count": 24
  }
}
```

### Field reference

| Field | Type | Meaning |
|---|---|---|
| `_about` | string | Human-readable one-liner. Includes pointer back to this SKILL.md. Always present. |
| `schema_version` | int | Bumps on any breaking change to this schema. Current: `1`. |
| `source` | string | Filename of the original this sidecar describes. Relative to the sidecar's directory. **Never points to a re-encoded file.** |
| `reference` | string | The input whose timeline we're aligned to. Reference's own sidecar lists itself here. |
| `delta_seconds` | float | The source's `t=0` expressed in the reference's timeline. **If positive, source starts after reference; pass to ffmpeg as `-itsoffset <delta>`.** Can be negative (source starts before reference, e.g. early-rolling camera). |
| `drift_slope` | float | Linear clock-drift slope (dimensionless, ~10⁻⁵). `0.0` means no measurable drift. Downstream applies `atempo = 1 + drift_slope` to the source ONLY for sync-sound / long-form lip-sync — for camera-cut editing, ignore. |
| `overlap_in_reference` | `[start, end]` (seconds) | The window during which both source and reference have coverage, expressed in the reference's timeline. Use this to trim outputs to mutually-valid time ranges. |
| `overlap_in_source` | `[start, end]` (seconds) | Same window expressed in the source's local timeline. `overlap_in_reference[0] - delta_seconds = overlap_in_source[0]`. |
| `verification` | object | Output of running `polysync verify` — drives a "did sync converge?" gate. `median_residual_ms` should be a few ms; `residual_spread_ms` > 1 frame at delivery fps means drift correction was needed but skipped. |

## How downstream consumes the sidecar

`-itsoffset` is per-input in ffmpeg and applies BEFORE `-i`. Always read the source's `delta_seconds` from the sidecar:

```bash
# Play cam_b aligned to cam_a's timeline
ffmpeg -itsoffset $(jq -r .delta_seconds cam_b.MOV.sync.json) -i cam_b.MOV \
       -i cam_a.MOV \
       -filter_complex "[0:v][1:v]hstack" out.mp4

# Trim to mutual overlap window (read from cam_b.MOV.sync.json)
ffmpeg -ss <overlap_in_source[0]> -i cam_b.MOV -t <overlap_dur> ...
```

For `wjs-editing-multicam`, `polysync edit` ingests every `<input>.sync.json` automatically; you don't compose these flags by hand.

## Partial-coverage clips — `polysync sync --partial`

Common case — main cams cover 75 min, a Riverside / phone / lavalier recorder only covers the middle 30 min. Run `polysync sync REF.MOV NEW.mp4 --partial`:

1. Cross-correlates the new input against the reference (same envelope algorithm as full-overlap mode).
2. Finds where the new clip's `t=0` sits in the reference timeline (`delta_seconds` may be large, e.g. 1842.5).
3. Writes ONLY the source sidecar — **no black padding, no audio padding, no re-encode.** `overlap_in_reference` tells consumers exactly when this input has coverage; outside that window, fall back to the main cams.

The `--partial` flag changes only the failure philosophy: it degrades gracefully (median delta on few probes, coarse delta if none) instead of failing on <3 good probes, and skips the reference sidecar (the reference is assumed to already belong to an established sync set). Everything else is identical to the default mode.

## When to skip drift correction

For camera-cut editing (the common case), ±25 ms residual across an hour is below human perception — pass `drift_slope: 0.0` and use only the midpoint `delta_seconds`.

For sync-sound / lip-sync at long durations (>30 min and `verification.residual_spread_ms > 40`), downstream applies `atempo = 1 + drift_slope` to the source. Source files are still not modified — the `atempo` filter runs at consume time.

## Verification (always run)

`polysync verify REF.MOV SRC.MOV SRC.sync.json` re-extracts audio from BOTH originals **natively** (loudest stream, no ffmpeg offset) and runs multi-probe correlation again. It applies the sidecar's `delta_seconds` (and, with `--apply-drift`, the drift slope) as **index arithmetic in numpy** — a probe at reference time `bs` is drawn from the source at local time `bs - delta`, then sought near reference index `bs`; the peak offset is the residual. Writes results back into the sidecar's `verification` field.

Pass criteria — `median_residual_ms < 15` and `residual_spread_ms < 1 frame at delivery fps`. Fail = retry with drift correction enabled.

**A spread-only fail with a near-zero median is usually noise, not desync.** Far-field mics on a wide / B-roll camera (high reverb, low SNR, ncoef ~0.2) produce a few outlier probes that blow up the spread while the median stays at a few ms. For camera-cut editing that is aligned — the median is the truth; the spread gate is conservative. Only chase it for long-form lip-sync.

## Common pitfalls

- **Raw waveform cross-correlation gives false peaks under low SNR.** Always envelope first — this is not a tunable, it's the entire premise.
- **`-itsoffset` semantics differ for audio vs video** — for sync-correctness it must be the FIRST flag for that input. `ffmpeg -i src -itsoffset X` is wrong; `ffmpeg -itsoffset X -i src` is right.
- **`-itsoffset` is a NO-OP when muxing to headerless raw PCM (`-f s16le`).** There are no container timestamps to carry the offset, so ffmpeg silently drops it and inserts NO leading silence. Any analysis that extracts to raw PCM (like `polysync verify`) must apply the offset by **index arithmetic in numpy**, never via `-itsoffset` on the extraction. Symptom of getting this wrong: verification residuals scatter by hundreds of ms with `ncoef ~0` even though sync itself was perfect.
- **Naive `0:a:0` extraction silently syncs against a dead track.** Multi-track cameras (Sony FX6 MXF: a:0/a:1 often -90 dB, mic on a:2) need loudness-based stream selection. `polysync sync` and `polysync verify` both pick the SAME loudest track automatically — if you ever reimplement, keep that invariant or residuals are meaningless.
- **Sidecar paths must be relative to the sidecar file's directory**, not the working directory of the consuming process. Resolve `source` / `reference` against `Path(sidecar).parent`.
- **Don't bake `drift_slope` into the sidecar's `delta_seconds`.** They're separate fields for a reason — naive consumers can ignore drift, sync-sound consumers can apply it. Mixing them loses information.
