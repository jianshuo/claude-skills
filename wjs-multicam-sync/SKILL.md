---
name: wjs-multicam-sync
description: Use when the user has 2+ video / audio recordings of the same event captured by different devices (cameras, phones, separate audio recorders) and wants them aligned to a single common timeline. Triggers — "多机位同步", "对齐这几个机位", "match camera timelines", "sync these angles", "audio drift between cameras", "separate audio recorder", "Riverside / Zoom recording that needs to line up".
---

# wjs-multicam-sync

Align multi-source recordings of the same event onto a common timeline using audio cross-correlation. Output is a set of `*_synced.MOV` files with matching durations and (optionally) a `.sync.json` sidecar describing the offset.

## When NOT to use

- Single-camera footage — nothing to sync to. For splitting one source into clips, use **video-segmentation**.
- Sources already aligned in an NLE (Final Cut / Premiere) — re-sync would fight the editor's timeline.
- For the auto-edit / cut / PiP rendering step that comes AFTER sync, use **wjs-multicam-edit**.

## Why envelope-based, not raw waveform

Raw PCM cross-correlation gives weak peaks and false matches whenever the two mics have different gain or room response — i.e., almost always with a second / third camera. The log-energy envelope captures dialogue and music dynamics, which both mics hear regardless of frequency response. **This is the single most important design choice — don't skip it.**

## Algorithm

1. **Extract mono PCM at 8 kHz, 16-bit** from each input.
2. **Log-energy envelope** at 100 Hz (10 ms hop, 50 ms window). High-pass with a 2nd-order Butterworth, 0.05 Hz cutoff, filtfilt — removes slow drift and gain offsets.
3. **FFT cross-correlate envelopes** end-to-end → coarse offset (~10 ms).
4. **Refine at sample level** with a 60 s probe from B near the coarse-aligned position in A, ±2 s search window, parabolic peak interpolation.
5. **Multi-probe drift check**: repeat step 4 every ~3 minutes. Linear fit `delta(t) = slope·t + intercept` reveals real clock drift (5–50 ppm typical). Use the **midpoint-canonical** offset (`slope · midpoint + intercept`) so residual error is symmetric.
6. **Compute overlap window**: `delta = tB0 − tA0`. In A, overlap is `[max(0, delta), min(A_dur, delta + B_dur)]`; in B, same span shifted by `−delta`.
7. **Trim with re-encode** (stream copy can't cut mid-GOP). On macOS use `hevc_videotoolbox` (5–10× realtime on Apple Silicon).

Implementation: `scripts/sync.py` — discovers inputs, builds envelopes, runs the drift analysis, emits ffmpeg trim commands. Read it before adapting.

## Partial-coverage clips

Common case: main cameras run the whole 75-min session, but Riverside / a phone / a separate audio recorder only covers the middle 30 min.

`scripts/sync_partial.py REF_SYNCED.mov NEW_INPUT.mp4`:

1. Cross-correlates new input against the reference.
2. Finds where new clip's `t=0` sits in the reference timeline.
3. Pads with leading black + silence so the output matches reference duration — drop-in playable in any NLE.
4. Writes a `.sync.json` sidecar: `{delta_seconds, ref_duration, trim_plan}`. Consumed downstream by `wjs-multicam-edit/autoedit.py`.

Flags: `--audio-only` for audio-only sources (skips encoding 30 min of black).

If disk matters more than drop-in ergonomics, skip the encode and use the sidecar's `delta_seconds` as `-itsoffset` when ffmpeg-ing.

## When to skip drift correction

For camera-cut editing (the common case), ±25 ms residual across an hour is below human perception — static midpoint offset is enough.

For sync-sound / lip-sync at long durations (>30 min, drift >40 ms): apply `atempo = 1 + slope` to the slower file. Re-encode required.

## Verification (always run)

After producing the synced set, re-extract audio and run multi-probe correlation on the **outputs**. Median residual should be a few ms; the spread tells you residual drift.

`scripts/verify.py` does this. If spread > 1 frame at the target frame rate, redo with drift correction.

## Output naming

`<stem>_synced.MOV` next to each input. If A doesn't need trimming (its window is fully inside B's), still produce `A_synced.MOV` via stream copy so the user gets a clean pair with matching names and durations.

## Common pitfalls

- **Raw waveform cross-correlation gives false peaks** under low SNR — always envelope first.
- **Stream-copy trim is not frame-accurate** — it cuts at the previous keyframe, often 2 s off. Re-encode the trim.
- **Display Matrix metadata is dropped on re-encode** unless preserved. iPhone videos often have an identity display matrix on visually-horizontal content stored as 1080×1920 — extract a frame to confirm orientation before delivering.
- **Audio-only sync misses long-period drift** — `verify.py` on the outputs is non-optional.
