---
name: wjs-editing-multicam
description: Use when the user has 2+ recordings of the same event (each with a `.sync.json` sidecar from wjs-syncing-multicam) and wants them combined into a single MP4 — auto-switching between cams second-by-second on audio energy, with optional picture-in-picture inset. Triggers — "auto-edit multicam", "做个剪辑", "切几个机位", "把这几个视频合成一个", "combine these angles", "PiP overlay".
---

# wjs-editing-multicam

Combine N synced camera angles into a single rendered MP4. Decisions are audio-energy-driven only — the cam with the loudest mic each second wins. Output is hard cuts (or hard cuts plus a corner PiP).

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| Audio-energy-driven cam switching | Face / framing detection (no face_recognition, no MediaPipe) |
| Single-source audio (one cam's mic) | Multi-mic mix / per-speaker gating |
| Hard cuts, with optional PiP inset | Crossfades / opacity transitions / sliding animations |
| `ffmpeg` concat + `overlay` filter renders | HyperFrames composition / `<hf-clip>` |
| Coverage-aware (won't pick a cam outside its sidecar window) | Frame-accurate beat alignment / VAD-edge cuts |

If you need face tracking, fade transitions, captions, or HyperFrames composition, use the **hyperframes** skill on top of this skill's MP4 output.

## REQUIRED INPUT

**Original camera files (untouched) plus their `.sync.json` sidecars next to them.** If sources aren't synced yet, run **wjs-syncing-multicam** first to write the sidecars. Missing sidecar = cam assumed at delta=0, full coverage.

`autoedit.py` reads each sidecar for `delta_seconds` + `overlap_in_reference`, lifts the cam's audio envelope into the reference timeline, and only schedules a cam during its coverage window. `render_cuts.py` / `render_pip.py` apply `ffmpeg -itsoffset` per input using the EDL's `deltas[]` array.

## When NOT to use

- One source — nothing to switch between; use **video-segmentation**.
- Polished NLE timeline already exists — don't fight the editor.
- Want fade transitions / overlay captions / brand title cards — run this skill first to get the cut-down MP4, then feed it into **wjs-overlaying-video** or **hyperframes**.

## Pipeline

1. Read each input's sidecar → list of `delta_seconds[k]` + `overlap_in_reference[k]`.
2. Extract per-cam mono PCM @ 16 kHz from the original file.
3. Log-RMS envelope at 1 Hz frame rate (per-second).
4. **Lift each envelope into reference timeline** by indexing at `t_ref - delta_k`; uncovered seconds become `-inf` so they're never picked.
5. **Audio source** = the cam with the largest envelope spread (90th − 10th percentile over its covered seconds), with a small bonus for coverage fraction.
6. **Score per second**: `cam[k] - mean(other covered cams)`. Highest score = best active-speaker candidate.
7. **Editor decides EDL** — two modes:
   - `rotation` (default): random dwell in [`min_dwell=8`, `max_dwell=15`] s, pick best-scoring covered cam (≠ current) at each cut.
   - `greedy`: hysteresis — hold current unless another cam's lookahead-window score beats it by `--switch-threshold`. Floor `min_dwell=4`, ceiling `max_dwell=18`.
   Both force-switch if the active cam exits its coverage window mid-shot.
8. Emit EDL JSON.

## EDL schema (`edl.json`)

```json
{
  "_about": "EDL produced by wjs-editing-multicam/autoedit.py. Times in reference timeline. Render scripts apply ffmpeg -itsoffset deltas[k] per input.",
  "_help": {
    "inputs":        "Original media paths, in cam-index order (cam 0, cam 1, ...).",
    "deltas":        "Per-cam delta_seconds from each sidecar. Render uses ffmpeg -itsoffset deltas[k].",
    "duration_sec":  "Output duration in reference timeline.",
    "audio_source":  "Cam index whose audio track becomes the master. Single source — not a mix.",
    "coverage":      "[start, end] per cam in reference timeline.",
    "edl":           "List of {cam, start, end} segments. Times are reference-timeline seconds."
  },
  "inputs":       ["cam_a.MOV", "cam_b.MOV"],
  "deltas":       [0.0, 12.345],
  "duration_sec": 4512,
  "audio_source": 0,
  "coverage":     [[0.0, 4512.0], [12.345, 4499.835]],
  "edl":          [{"cam": 0, "start": 0, "end": 13}, {"cam": 1, "start": 13, "end": 28}, ...]
}
```

`autoedit.py` writes `_about` + `_help` directly into the file so opening the JSON in any editor explains itself.

## Render

| Script | What it does |
|---|---|
| `scripts/render_cuts.py` | Hard cuts only. `concat` filter graph over per-segment `trim+scale+pad`. Audio = `audio_source` cam, trimmed to first EDL row's start. |
| `scripts/render_pip.py` | Hard cuts + corner picture-in-picture overlay. Main cam = EDL row's `cam`; PiP cam picked round-robin (or via per-row `pip` field). PiP is scaled to `--pip-width` (default 480 px), placed in a configurable corner with optional white border. **No fade / no opacity — solid block on/off.** |

Both apply `-itsoffset deltas[k]` per input.

## Brainstorm before running

Three real knobs to confirm with the user:

- **Pacing** — `--mode rotation` (varied dwell, easier on the ear) vs `--mode greedy` (energy-following, snappier).
- **PiP** — yes / no. If yes, which corner + width?
- **Min cut length** — `--min-dwell` floor. 8 s default for rotation is conservative; talking-heads can go to 4.

`audio_source` is auto-picked; override with `--audio-source <cam-index>` if the auto-pick sounds wrong on a 30 s listen.

## File layout

```
working_dir/
  cam_a.MOV                 # ORIGINAL, untouched
  cam_a.MOV.sync.json       # from wjs-syncing-multicam
  cam_b.MOV                 # ORIGINAL, untouched
  cam_b.MOV.sync.json
  edl.json                  # from autoedit.py
  multicam_render.mp4       # from render_cuts.py OR render_pip.py
```

## Common pitfalls

- **Trusting `audio_source` without listening.** Spread + coverage is a proxy. Always sample a 30 s clip before committing — a high-spread track can still be clipped / distorted.
- **Running `autoedit.py` on the full 75 min before tuning.** Run on a 2-min slice first (`ffmpeg -ss A -t 120` an extract per cam), listen, adjust `--min-dwell` / `--mode`, then commit to full length.
- **Expecting face-driven framing.** This skill doesn't see the video — only the audio. If one cam is well-framed but quiet, the editor won't favor it. Use `--audio-source` + per-segment `pip` overrides as the manual escape hatch.
- **Re-rendering when sync was wrong.** EDL bakes in `deltas[]` at autoedit time. If you fix the sidecars later, re-run `autoedit.py` to regenerate the EDL before re-rendering.
