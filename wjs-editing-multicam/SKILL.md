---
name: wjs-editing-multicam
description: Use when the user has 2+ recordings of the same event (each with a `.sync.json` sidecar from wjs-syncing-multicam) and wants them combined into a single MP4 — auto-switching between cams second-by-second on audio energy, with optional picture-in-picture inset. Triggers — "auto-edit multicam", "做个剪辑", "切几个机位", "把这几个视频合成一个", "combine these angles", "PiP overlay".
---

# wjs-editing-multicam

Combine N synced camera angles into a single rendered MP4. Decisions are audio-energy-driven only — the cam with the loudest mic each second wins. Output is hard cuts (or hard cuts plus a corner PiP).

## Setup & commands

The implementation lives in the open-source **`polysync`** pip package (<https://pypi.org/project/polysync/> · <https://github.com/jianshuo/polysync>) — this skill no longer ships its own scripts. Install it, then drive it via its CLI:

```bash
python3 -m pip install -U polysync      # needs ffmpeg/ffprobe on PATH

polysync edit        CAM_A CAM_B CAM_C --out edl.json   # build the decision list
polysync render-cuts edl.json --out out.mp4             # hard cuts
polysync render-pip  edl.json --out out.mp4 --pip bottom-right   # cuts + corner inset
```

`edit` and the renderers read each input's `.sync.json` automatically. Sync first with **wjs-syncing-multicam** (`polysync sync`) if the sidecars don't exist yet.

Render flags for raw camera footage (see **Preflight** below for when to use each):

```bash
# Sony S-Log3 footage, shot vertical, FX6 cams turned on their side, for 小红书:
polysync render-cuts edl.json --out out.mp4 \
    --log slog3 \           # S-Log3/S-Gamut3.Cine -> Rec.709 grade
    --rotate 1:90 --rotate 2:90 \   # rotate cam1,cam2 90° CW (FX6 with no flag)
    --width 1080 --height 1920 --fill \   # vertical, crop-to-fill (no black bars)
    --duck-audio --audio-cams 0,1        # clean speaker-gated audio (cams 0,1 = the two lavs)
```

`--duck-audio` replaces the single-cam soundtrack with a speaker-gated mix: each moment keeps the active speaker's close mic and ducks the rest (much cleaner than a constant 2-mic sum, which piles up bleed/room tone). `--audio-cams 0,1` restricts gating to the real speaker mics — **always exclude the wide/room cam**, whose mic sits at a similar level but is reverby and would otherwise get picked. (See the editing-quality note below for the why.)

## Preflight — ALWAYS check raw footage before rendering (hard-won)

Straight-off-the-card footage renders WRONG without these checks. Spend 2 minutes here or you'll render the whole thing broken (we did).

1. **Color profile (Log).** Sony FX3/FX6 default to **S-Log3 / S-Gamut3.Cine** — flat, grey, low-contrast. It MUST be converted to Rec.709 or it looks washed-out and broken. Check the `.XML` sidecar's `CaptureGammaEquation` (`s-log3-cine`) or `ffprobe -show_entries stream=color_transfer`. Fix: `--log slog3`. (Performance: the LUT is applied AFTER downscale automatically — a 3D LUT on 4K is ~4x slower than on 1080p for an identical result.)
2. **Orientation.** Phone / vertically-mounted shoots record rotated. Extract one frame per cam (`ffmpeg -ss 200 -i CAM -frames:v 1 f.jpg`) and LOOK. Some cameras (FX3) write a rotation flag → ffmpeg auto-rotates, fine. Others (FX6 physically turned on its side) write **no flag** → people come out lying down. Fix per-cam: `--rotate 1:90` (90 = clockwise; try 270 if upside-from-the-other-side).
3. **Delivery orientation.** 小红书 / Reels / Shorts are **vertical** — and this footage is usually shot vertical. Render `--width 1080 --height 1920 --fill`. Default (1920×1080, pad) is for landscape only; mixing a portrait source into a landscape frame pillarboxes it (ugly black side bars).
4. **Staggered camera starts.** Cameras rarely roll at the same instant; the sidecar `delta`/coverage shows it. The opening N seconds may be single-cam (only the first-rolling camera covers t=0). That's unavoidable — expect a single-cam intro of `max(delta)` seconds.

## Editing quality — when `polysync edit` isn't enough

`polysync edit` switches to the **loudest mic** per second. With **close, bleeding mics** (each cam's mic also picks up the other speaker loudly), the close/guest mic stays loudest even when the *other* person talks, so the editor over-selects that cam and the cuts don't track the real speaker. Two fixes, applied by hand on the EDL when "cut to the correct speaker" matters:

- **Per-mic baseline-normalized speaker attribution.** Per second, subtract each mic's own median energy, then pick whichever mic is *highest relative to its own baseline* → that's who's actually talking. (polysync's raw `cam[k] - mean(others)` doesn't remove the per-mic baseline offset, so it favors the loud mic.)
- **Cutaways for rhythm (剪辑感).** Audio attribution alone gives long static holds. Cap any single shot (~8–10 s) and insert ~3 s cutaways to the **listener** (reaction shot) and the **wide** cam, alternating. The wide cam's quiet mic means the editor never picks it on energy — inject it deliberately for establishing / 整体.

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

`polysync edit` reads each sidecar for `delta_seconds` + `overlap_in_reference`, lifts the cam's audio envelope into the reference timeline, and only schedules a cam during its coverage window. `polysync render-cuts` / `polysync render-pip` apply `ffmpeg -itsoffset` per input using the EDL's `deltas[]` array.

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
   Both force-switch if the active cam exits its coverage window mid-shot. If no cam covers `t=0` (overlap windows that start a few seconds in), the editor opens at the first covered second and backfills the lead-in with cam 0.
8. Emit EDL JSON.

## EDL schema (`edl.json`)

```json
{
  "_about": "EDL produced by polysync.edit.autoedit. Times in reference timeline. Render commands apply ffmpeg -itsoffset deltas[k] per input.",
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

`polysync edit` writes `_about` + `_help` directly into the file so opening the JSON in any editor explains itself.

## Render

| Command | What it does |
|---|---|
| `polysync render-cuts` | Hard cuts only. `concat` filter graph over per-segment `trim+scale+pad`. Audio = `audio_source` cam, trimmed to first EDL row's start. |
| `polysync render-pip` | Hard cuts + corner picture-in-picture overlay. Main cam = EDL row's `cam`; PiP cam picked round-robin (or via per-row `pip` field). PiP is scaled to `--pip-width` (default 480 px), placed in a configurable corner with optional white border. **No fade / no opacity — solid block on/off.** |

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
  edl.json                  # from `polysync edit`
  multicam_render.mp4       # from `polysync render-cuts` OR `polysync render-pip`
```

## Common pitfalls

- **Trusting `audio_source` without listening.** Spread + coverage is a proxy. Always sample a 30 s clip before committing — a high-spread track can still be clipped / distorted.
- **Running `polysync edit` on the full 75 min before tuning.** Run on a 2-min slice first (`ffmpeg -ss A -t 120` an extract per cam), listen, adjust `--min-dwell` / `--mode`, then commit to full length.
- **Expecting face-driven framing.** This skill doesn't see the video — only the audio. If one cam is well-framed but quiet, the editor won't favor it. Use `--audio-source` + per-segment `pip` overrides as the manual escape hatch.
- **Re-rendering when sync was wrong.** EDL bakes in `deltas[]` at edit time. If you fix the sidecars later, re-run `polysync edit` to regenerate the EDL before re-rendering.
- **Rendering a mid-video window straight from the long 4K originals = brutally slow.** `polysync render-cuts` trims in the filter graph (`trim=start=…`) with **no input `-ss` seek**, so for a clip whose EDL starts deep in the source (e.g. a 90 s segment 28 min into a 34 min file) ffmpeg DECODES the 4K from t=0 to reach the window — ~20 min for a 92 s clip. Fix: **pre-cut each cam's window first with accurate fast seek** (`ffmpeg -ss <start-2> -i src -ss 2 -t <dur> …` — fast-seek to 2 s before, then accurate-decode 2 s), already rotated + graded + scaled to the target frame, then concat the multicam EDL on those short prepared windows (0-based times, cheap). All cams cut to the SAME reference window (`source-local start = ref_start - delta_k`) so they stay in sync. This is how `/wjs-segmenting-video` should render multicam segments — never feed a mid-video absolute-time EDL to a from-zero decode.
