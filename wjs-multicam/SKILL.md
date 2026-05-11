---
name: wjs-multicam
description: Sync and edit multi-camera footage of the same scene. Step 1 — sync timelines via audio cross-correlation (envelope-based, robust under low SNR). Step 2 — director-style auto-edit: pick the cleanest audio track, switch cameras on speaker changes / silence boundaries / motion beats, with optional crop-zoom virtual close-ups and picture-in-picture. Use when the user says "多机位", "multicam", "sync these camera angles", "match camera timelines", "auto-edit multicam", or provides 2+ video files of the same event from different angles.
---

# Multicam

Two phases. Each works standalone — sync without editing is fine; editing assumes a synced set.

## Phase 1 — Audio Sync

Goal: find a single time offset for each camera so the timelines line up, then trim every file to the common overlap window. Output files are byte-clean playable MOVs/MP4s with matching durations.

### Algorithm (proven, robust under noise)

1. **Extract mono PCM at low SR** (8 kHz, 16-bit) from each input. Don't use raw waveform cross-correlation — at low SNR (typical for the second/third camera with a worse mic) it gives weak peaks and false matches.
2. **Build a log-energy envelope** at 100 Hz frame rate (10 ms hop, 50 ms window). High-pass it (cutoff 0.05 Hz, 2nd-order Butterworth, filtfilt) to remove slow drift / gain differences. The envelope captures dialogue/music dynamics — the same event hits both mics regardless of room response.
3. **FFT cross-correlate the envelopes** end-to-end. The peak gives a coarse offset to ~10 ms.
4. **Refine at sample level** with a 60 s probe from B near the coarse-aligned position in A, using a ±2 s search window. Parabolic peak interpolation gets sub-sample precision.
5. **Multi-probe drift check**: run step 4 every ~3 minutes across the timeline. Linear fit `delta(t) = slope·t + intercept` reveals real clock drift between cameras (typical: 5–50 ppm). Use the **midpoint canonical** offset (`slope · midpoint + intercept`) so residual error is symmetric around zero across the duration.
6. **Compute overlap window** in each camera's local timeline using the chosen delta:
    - `delta = tB0 − tA0` (B's start in wall-clock minus A's start). If delta > 0, A leads.
    - In A: overlap is `[max(0, delta), min(A_dur, delta + B_dur)]`.
    - In B: same span shifted by `−delta`.
7. **Trim each file** to its overlap window with re-encode (stream-copy can't cut mid-GOP; the trim must be frame-accurate). On macOS use `hevc_videotoolbox` (5–10× realtime on Apple Silicon). For shorter clips x264/x265 software encode is fine.

### Partial-coverage clips (one source covers only part of the session)

A common case: the main cameras run for the whole 75-min session, but a third recorder (Riverside, separate audio recorder, late-arriving phone) only covers the middle 30 min. Sync that to the existing common timeline without touching the main cams.

`scripts/sync_partial.py REF_SYNCED.mov NEW_INPUT.mp4` does this:

1. Cross-correlates the new input's audio against the reference's audio.
2. Finds the start offset (where the new clip's t=0 sits in the reference's timeline).
3. Produces a file with the same duration as the reference, with leading black + silence padding so it's drop-in usable as another timeline-aligned input.
4. Writes a `.sync.json` sidecar describing the offset/trim plan.

Use `--audio-only` for audio-only sources (saves the cost of encoding 30+ minutes of black video).

The padded approach trades disk for ergonomics — the file plays naturally alongside the main cams in any NLE without per-track time offsets. If disk matters more than drop-in ergonomics, skip the script's encode step and use the sidecar JSON's `delta_seconds` as an `-itsoffset` argument when adding the input to ffmpeg.

### When to skip drift correction

For camera-cut editing (the common case), ±25 ms residual across an hour is below human perception. Just use the static midpoint offset.

For sync-sound or lip-sync at very long durations (>30 min, drift >40 ms), apply `atempo` to the slower file: `atempo = 1 + slope`. Re-encode is required.

### Reference script

`scripts/sync.py` is the end-to-end implementation: discovers inputs, extracts envelopes, finds the offset, runs multi-probe drift analysis, prints the trim plan, and emits an `ffmpeg` command per file. Read it before adapting.

### Output naming

`<stem>_synced.MOV` next to each input. If A doesn't need trimming (its window is fully inside B's), still produce `A_synced.MOV` so the user has a clean pair with matching names and durations. Stream-copy A — no re-encode needed.

### Verification (always run)

After producing the synced pair, re-extract audio and run the multi-probe correlation on the **outputs**. Median residual should be a few ms; the spread tells you the residual drift. If the spread exceeds 1 frame at the target frame rate, retry with drift correction. `scripts/verify.py` does this.

## Phase 2 — Director-Style Auto-Edit

Goal: produce a single render using the cleanest audio and switching among cameras + virtual crops at moments a human director would pick.

This is open enough that you should brainstorm with the user before executing — confirm style (talking-heads, performance, interview, vlog), pacing preference (fast cuts vs. long takes), and whether they want PiP or only hard cuts.

### Audio selection

The "main" audio track is one of:
- The cleanest single mic (use SNR + spectral flatness — pick the track with highest median SNR over voice-active frames).
- A multi-mic mix with per-speaker gating (only if you have speaker diarization and per-mic energy maps; usually overkill for two-camera shoots).

Compute SNR per file by VAD-segmenting the envelope: the 90th percentile / 10th percentile ratio in dB. Pick the track with the largest ratio. Verify by listening to a 30 s sample.

### Camera switching — "Director HMM"

Model the edit as a state machine where each state is a candidate shot (each physical camera plus virtual crops/PiP variants). Transitions are scored from a few signals:

| Signal | What it favors |
| --- | --- |
| **Active-speaker energy** | Camera whose mic is loudest right now (proxy: closest mic = closest to speaker). |
| **Face / framing score** | Cameras where a face is well-framed (rule-of-thirds, eyes upper third). Use `face_recognition` or MediaPipe at 1 fps. |
| **Composition variety** | Penalize the current shot the longer it stays on (boredom term: rises linearly after 8 s, sharp climb after 20 s). |
| **Cut cost** | Penalize switching too soon (min cut ~3 s for talking heads, ~1.5 s for action). Hard floor: 1.5 s. |
| **Beat alignment** | Prefer cuts on silence boundaries or at the start of a new utterance — detect via VAD edge transitions. |
| **Reaction-shot bonus** | When speaker A talks, occasional cut to listener B for ≤ 4 s. |

Combine via Viterbi: per-second scores, transition penalty for cut cost, decode the lowest-cost path. This produces the EDL.

**Rules of thumb the algorithm should encode:**
- Open on the master/wide shot for 5–10 s before the first cut.
- Hold a shot ≥ 3 s. Cut on the first natural beat after that.
- Don't ping-pong: same pair can't repeat within 8 s.
- After 25 s on one shot, force a cut at the next beat regardless.
- Reaction shots ≤ 4 s, returning to the active speaker.

### Virtual cameras (crop-zoom from a wide shot)

A wide camera with high resolution (1080p+) yields multiple "virtual cameras" by cropping. Useful when the second physical camera is unavailable or its angle isn't right.

Implementation: pre-compute a face track (one box per frame at 1 fps, interpolated). Define virtual crops:
- **Wide**: full frame.
- **MCU (medium close-up)**: crop centered on the active speaker's face, 2× face height.
- **CU**: crop, 1.2× face height.
- **2-shot**: bounding box of two faces with 20% padding.

Crops are smoothed with a low-pass filter (0.5 Hz cutoff) to avoid jitter. Output via `ffmpeg crop` filter, scaled back to delivery resolution (e.g. 1920×1080).

### Picture-in-picture

Treat the inset as a separate "shot" in the HMM. Use sparingly (≤ 15% of total runtime). Common patterns:
- Speaker on main, listener PiP bottom-right (Q&A, interview).
- Wide on main, CU PiP top-right (performance / demo).

Transition: 0.3 s opacity fade in, hard cut out (or vice versa). Avoid sliding animations — they look amateur.

### Render

Two paths, pick by complexity:

**Pure ffmpeg** (no PiP, no fancy transitions, just hard cuts + crops): write a `concat` filter graph from the EDL. Each segment is `ss=...:t=...,crop=...,scale=...` from one input. Fastest, no extra deps.

**HyperFrames** (PiP, transitions, captions, audio-reactive elements): generate `index.html` with `<hf-clip>` elements per EDL row, each `<hf-clip>` containing a `<video>` whose `data-clip-time` controls playback. Use `hyperframes-cli render` to produce the final MP4. Best when the user wants overlays, transitions, or branding.

For pure cuts, ffmpeg is faster and simpler. For anything with PiP or motion graphics, prefer HyperFrames — that's what it's built for, and the `hyperframes` skill covers the composition patterns.

### Reference script

`scripts/autoedit.py` skeleton (not full implementation): runs VAD per camera audio, computes per-camera scores, runs Viterbi, emits an EDL JSON. Stop short of full face/composition scoring on a first pass — get hard cuts working with active-speaker scoring alone, listen to results, then add complexity.

## File layout convention

Inputs in a working directory; outputs alongside.

```
working_dir/
  cam_a.MOV                  # original
  cam_b.MOV
  cam_a_synced.MOV           # Phase 1 outputs
  cam_b_synced.MOV
  edl.json                   # Phase 2 EDL (camera id, start, end, crop, audio_source)
  multicam_render.mp4        # Phase 2 render
```

## Common pitfalls

- **Raw waveform cross-correlation gives weak/false peaks** when the two mics have different gain or room response. Always use envelope first.
- **Stream-copy trim is not frame-accurate** — it cuts at the previous keyframe (often 2 s off). Re-encode the trim.
- **Display Matrix metadata is dropped during re-encode** unless you preserve it. iPhone videos often have an identity display matrix on visually-horizontal content stored as 1080×1920 — extract a frame to confirm orientation before delivering.
- **Audio-only sync misses long-period drift**. Always run the multi-probe verification on the outputs.
- **Don't pick "best" per-second cam without hysteresis** — the result ping-pongs. Min-cut-length and cut-cost terms in the HMM are non-optional.
