---
name: wjs-multicam-edit
description: Use when the user has multiple already-synced camera angles of the same scene and wants them combined into a single render — director-style hard cuts, virtual close-ups via crop-zoom, picture-in-picture, or a mix. Triggers — "auto-edit multicam", "director cut", "highlight reel from these angles", "switch between cameras", "PiP overlay", "做个剪辑", "切几个机位".
---

# wjs-multicam-edit

Take N synced camera angles and emit a single render that switches between them at moments a human director would pick.

## REQUIRED INPUT

**Original camera files (untouched) plus their `.sync.json` sidecars next to them.** No `_synced.MOV` files are needed — and aren't produced anywhere in the pipeline anymore. If sources aren't synced yet, run **wjs-multicam-sync** first to write the sidecars.

Each input must have a `<input>.sync.json` next to it (written by wjs-multicam-sync). The sidecar carries `delta_seconds` (how this cam's t=0 maps into the reference timeline) and `overlap_in_reference` (this cam's coverage window). `autoedit.py` reads sidecars automatically and shifts each cam's envelope into reference time before scoring. `render_cuts.py` / `render_pip.py` read the EDL's `deltas[]` array and apply `ffmpeg -itsoffset` per input.

Missing sidecar = cam assumed at delta=0, full coverage (backward-compat for single-source jobs).

## When NOT to use

- One source → no switching needed; use **video-segmentation** for clip extraction.
- Polished edit already exists in an NLE → don't fight the timeline.
- Final render with overlays / captions / brand transitions — drive **HyperFrames** (`render_pip.py` here scaffolds a HyperFrames composition for that case).

## Brainstorm with the user before executing

This step is open-ended. Confirm before running `autoedit.py`:

- **Style** — talking-heads, performance, interview, vlog?
- **Pacing** — fast cuts (~3 s holds) or long takes (~15 s)?
- **PiP** — yes / no? When yes, what pattern? (speaker + listener inset, wide + CU inset)
- **Audio source** — clean single mic, or per-speaker mix?

## Audio selection

Pick one main audio track. SNR per file = ratio of the 90th to 10th percentile envelope dB during voice-active frames. Highest ratio wins. Verify by listening to a 30 s sample — a high-SNR but distorted track will lose to a slightly noisier but clean one.

Multi-mic per-speaker mixing is overkill unless you have diarization + per-mic energy maps.

## Director HMM

Model the edit as a state machine; each state is a candidate shot (physical cam, virtual crop, or PiP variant). Transition scores from these signals:

| Signal | Favors |
|---|---|
| Active-speaker energy | Camera whose mic is loudest (≈ closest to current speaker) |
| Face / framing score | Cameras with well-framed face (rule-of-thirds, eyes upper third). `face_recognition` or MediaPipe @ 1 fps |
| Composition variety | Penalize current shot the longer it's held (rises after 8 s, sharp climb after 20 s) |
| Cut cost | Penalize switching too soon (min cut: 3 s for talking heads, 1.5 s floor for action) |
| Beat alignment | Prefer cuts on silence boundaries / new-utterance starts (VAD edge transitions) |
| Reaction-shot bonus | When speaker A talks, occasional ≤4 s cut to listener B |

Combine via Viterbi: per-second emission scores, transition penalty for cut cost. Decoded path = the EDL.

### Hard rules the algorithm encodes

- Open on master / wide for 5–10 s before the first cut.
- Hold any shot ≥ 3 s.
- Same pair can't repeat within 8 s (no ping-pong).
- Force a cut at the next beat after 25 s on one shot, regardless of score.
- Reaction shots ≤ 4 s; return to active speaker.

Implementation: `scripts/autoedit.py` (skeleton — get hard cuts working with active-speaker scoring alone, listen, *then* add face / composition / PiP).

## Virtual cameras (crop-zoom from a wide shot)

A 1080p+ wide cam yields multiple virtual cams via cropping. Useful when the second physical cam is unavailable or its angle isn't right.

Pre-compute a face track (one box per frame @ 1 fps, interpolated). Crop presets:

- **Wide** — full frame
- **MCU** — face-centered, 2× face height
- **CU** — 1.2× face height
- **2-shot** — bbox of two faces with 20% padding

Smooth crop centers with a 0.5 Hz low-pass to avoid jitter. Render via `ffmpeg crop` filter, scaled back to delivery res (e.g. 1920×1080).

## Picture-in-picture

Treat the inset as another shot in the HMM. Use sparingly — **≤ 15% of total runtime**.

Common patterns:
- Speaker on main + listener PiP bottom-right (Q&A, interview)
- Wide on main + CU PiP top-right (performance, demo)

Transitions: 0.3 s opacity fade in, hard cut out (or vice versa). **Avoid sliding animations — they look amateur.**

## Render

Two paths:

| Path | Script | When |
|---|---|---|
| Pure ffmpeg | `scripts/render_cuts.py` | Hard cuts only, no PiP, no transitions. Fastest. |
| HyperFrames | `scripts/render_pip.py` | PiP, fade transitions, captions, overlays. Scaffolds an `<hf-clip>` composition; render via `hyperframes-cli render`. |

Both consume the EDL produced by `autoedit.py`. For anything beyond hard cuts, prefer HyperFrames — the `hyperframes` skill documents composition patterns.

## File layout

```
working_dir/
  cam_a_synced.MOV          # from wjs-multicam-sync
  cam_b_synced.MOV
  edl.json                  # from autoedit.py: [{cam, start, end, crop, audio_source}, ...]
  multicam_render.mp4       # from render_cuts.py OR render_pip.py
```

## Common pitfalls

- **Picking "best" per-second cam without hysteresis ping-pongs.** Min-cut-length + cut-cost terms in the HMM are non-optional.
- **Skipping the brainstorm step** produces a generic edit that looks like every other AI edit. The style / pacing / PiP choices are where the human taste lives.
- **Treating `autoedit.py` as a black box.** It's deliberately a skeleton — read it, run it on a 2-min slice, listen, adjust scoring weights. Don't render the full 75 min on the first pass.
