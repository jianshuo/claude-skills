---
name: wjs-overlaying-video
description: Use when the user has one or more video clips and wants to add post-production on top — AI-generated cover as first frame, HTML/CSS captions synced to SRT, kinetic illustration overlays at hook moments, chapter chips, end-card CTA, or any other timed motion graphics. Most often used as the downstream of `/wjs-segmenting-video` — pick up where that skill stopped (raw cropped clip + per-clip SRT) and produce the upload-ready MP4. Backed by HyperFrames so everything compiles to ONE final encode — no cascade of re-encodes. Triggers — "加封面", "加字幕", "加动画", "加 CTA", "做后期", "post-production", "title card", "kinetic captions", "end card".
---

# wjs-overlaying-video

Post-production for a video clip: cover, captions, illustrations, CTA,
custom motion graphics — all composed in ONE HyperFrames project and
rendered in a SINGLE final encode. No cascade of decodes/re-encodes
(each cascade pass degrades quality and burns time).

## When to use

- **Downstream of `/wjs-segmenting-video`** — the segmentation skill
  hands you cropped clips + per-clip SRTs; this skill turns them into
  upload-ready MP4s with cover/captions/illustrations/CTA.
- User has a finished video and wants to dress it up with motion
  graphics: opening hook, key-quote callout, closing slogan, chapter
  cards, AI-generated cover as first frame.
- User wants HTML/CSS-quality captions on a video (kinetic word-by-word
  highlighting, custom fonts, large outlined text, seekable per cue).
- User wants illustration overlays at specific hook moments — diagrams,
  big text emphasis, flow charts.

**Don't use** for:
- Splitting one long video into clips → use `/wjs-segmenting-video`.
- Creating the source SRT → use `/wjs-transcribing-audio` (then `/wjs-translating-subtitles` if you need a different language).
- Full HyperFrames productions where the source isn't a fixed video →
  use `hyperframes` directly.
- 微信视频号 / 抖音 upload (no public API for those) → this skill
  produces the MP4; upload is manual.

## What this skill IS — and IS NOT

| Is | Is not |
|---|---|
| Everything that goes ON TOP of a video clip: cover, caption, chapter, illustration, CTA | Cutting / cropping a video (that's `/wjs-segmenting-video` + `/wjs-reframing-video`) |
| One HyperFrames composition per clip = ONE final encode | A multi-step decode/encode cascade |
| `cover` is the literal first frame of the output (platforms auto-pick it as thumbnail) | A separate thumbnail file the user uploads alongside |
| Captions are HTML/CSS — `-webkit-text-stroke` for white-on-anything readability | libass burn-in (deprecated) |
| Illustrations: re-usable `stack` / `hammer` patterns + custom escape hatch | One bespoke HTML/CSS per illustration without re-use |
| AI covers regenerated at native target aspect (1024×1792 for vertical, 1536×1024 for horizontal) | Single 1024×1536 default that letterboxes or crops on the platform |

## The pipeline

```
clip.mp4 + clip.zh-CN.burn.srt   (from /wjs-segmenting-video hand-off)
   ↓
1. (Optional) Generate AI cover via gpt-image-2
   make_cover.py --segments S.json --out output/ --size 1024x1792
   cover_NN_slug.png

2. Scaffold a HyperFrames project per clip
   hf_clip_NN/1080/{index.html, clip.mp4, cover.png, captions.json}

3. Compose: cover scene + body video + caption track + chapter chip
            + 1-2 illustrations at hook moments + CTA scene

4. npm run check (lint + validate + visual inspect)
   npm run render → upload-ready MP4
```

A 2-minute vertical 1080×1920 composition renders in ~2-3 min on M-series Mac.

## Standard overlay types (the 6 building blocks)

Every clip's final composition is built from some combination of these.
The agent picks the right ones per clip — typically all 6 for a
podcast highlight, or just 1-2 for a single annotation overlay.

### 1. `cover` — full-frame AI image as first frame

The cover IS the first frame (no animation, no zoom) so platforms that
auto-pick the first frame as the thumbnail get your designed cover by
default. **Always verify with `ffmpeg -ss 0 -vframes 1`** — frame 0
must NOT be black or platform thumbnails will be black.

**HTML:**
```html
<div id="cover" class="clip" data-start="0" data-duration="1.6"
     data-track-index="1" data-layout-allow-overflow>
  <img src="cover.png" alt="" data-layout-allow-overflow />
</div>
```

**CSS:**
```css
#cover { position: absolute; inset: 0; background: #0c0d10; overflow: hidden; }
#cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
```

**Generation:** use `/wjs-segmenting-video/scripts/make_cover.py`
(wraps `gpt-image-2 images edit` with the midpoint frame as ref):

```bash
# For 1080×1920 vertical output (视频号 / 抖音):
make_cover.py --segments S.json --out output/ --size 1024x1792 [--single N]

# For 1920×1080 horizontal output (YouTube / B站):
make_cover.py --segments S.json --out output/ --size 1536x1024
```

**Aspect must match output frame.** `--size 1024x1536` (2:3, the
script default) gets letterboxed or cropped on 9:16 output — always
pass `1024x1792` for vertical. The cover image's aspect is what the
viewer sees full-frame, so mismatch is visible. Re-roll one with
`--single N`; codex provider can transient-fail mid-batch.

**Codex auth required**: the script calls codex CLI via
`gpt-image-2-skill`. If `~/.codex/auth.json` is missing, the script
errors. See `gpt-image-2-skill` for setup.

### 2. `caption` — outlined HTML/CSS captions synced to SRT

White text with thick black stroke, no bubble background, vertically
centered in a fixed zone (so 1-line vs 2-line captions don't make the
visual center jump up and down).

**HTML:**
```html
<div id="caption" class="clip" data-start="{body_start}"
     data-duration="{body_dur}" data-track-index="4"></div>
```

**CSS (vertical 1080×1920):**
```css
#caption {
  position: absolute; left: 0; right: 0; bottom: 240px;
  height: 240px; z-index: 10; overflow: visible;
}
#caption .bubble {
  position: absolute; top: 50%; left: 50%;
  display: inline-block;
  padding: 0 24px;
  font-size: 56px; line-height: 1.18; font-weight: 900;
  color: #ffffff; max-width: 1020px; text-align: center;
  -webkit-text-stroke: 5px #000;
  paint-order: stroke fill;
  text-shadow: 0 6px 12px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.6);
  letter-spacing: 0.01em;
}
```

**JS (one bubble per cue + GSAP fade in/out, all centered at container midpoint):**
```js
// SRT cues are loaded as inline JSON. Each cue's start/end is offset
// by the cover-scene duration (e.g., 1.5s) so the timing aligns with
// the composition timeline (not the body's own t=0).
const captionEl = document.getElementById("caption");
const groups = JSON.parse(document.getElementById("captions-data").textContent);
const bubbles = groups.map((g, i) => {
  const b = document.createElement("span");
  b.className = "bubble"; b.id = "cap-" + i;
  b.textContent = g.text; b.style.opacity = "0";
  captionEl.appendChild(b);
  return b;
});
// GSAP xPercent/yPercent for centering (CSS transform would get
// overwritten the moment we tween y).
gsap.set(bubbles, { xPercent: -50, yPercent: -50 });
groups.forEach((g, i) => {
  const el = bubbles[i];
  tl.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, g.start);
  const exitStart = Math.max(g.start + 0.18, g.end - 0.12);
  tl.to(el, { opacity: 0, duration: 0.12, ease: "power2.in" }, exitStart);
  tl.set(el, { opacity: 0 }, g.end);
});
```

**Source SRT — slice + shift before inlining.** Take
`clip_NN.zh-CN.burn.srt` from segmentation, parse each cue, add the
cover duration to every `start`/`end`, and inline as JSON in a
`<script id="captions-data" type="application/json">` block.

**MarginV / position notes:**
- Vertical (1080×1920): `bottom: 240px` keeps captions clear of the
  视频号/抖音 bottom UI overlay (likes/comments/share buttons).
- Horizontal (1920×1080): `bottom: 100px`, `font-size: 48px`,
  `-webkit-text-stroke: 4px` is a reasonable default.

**Caption length cap.** If a single cue exceeds ~18 Chinese chars on
1080-wide at 56px, it wraps to 2 lines awkwardly. This is upstream
discipline — `/wjs-translating-subtitles` should cap cues at ~18 chars
using word-gap split + punctuation split. If you receive longer cues,
either reduce `font-size` to 48px or accept the wrap.

### 3. `chapter` — top-left chapter chip (4s reveal then fade)

A subtle badge identifying the segment. Enters at body start, fades
after a few seconds so it doesn't compete with the rest of the
composition.

**HTML:**
```html
<div id="chapter" class="clip" data-start="{body_start}"
     data-duration="{body_dur}" data-track-index="3">
  <span class="dot"></span>
  <span class="text">第一段 · 自然语言才是新代码</span>
</div>
```

**CSS:**
```css
#chapter {
  position: absolute; top: 80px; left: 60px; z-index: 9;
  display: inline-flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  background: rgba(12,13,16,0.78);
  border: 1px solid rgba(199,150,85,0.4);
  border-radius: 999px;
}
#chapter .dot { width: 10px; height: 10px; border-radius: 999px; background: #e8b063; }
#chapter .text {
  font-size: 24px; color: #f4f4f5; letter-spacing: 0.04em; font-weight: 600;
}
```

**GSAP:**
```js
tl.from("#chapter", { x: -40, opacity: 0, duration: 0.5, ease: "expo.out" }, body_start + 0.4);
tl.to("#chapter", { opacity: 0, duration: 0.4, ease: "power2.in" }, body_start + 4.0);
```

### 4. `stack` illustration — top-right vertical list card

A list of items (e.g., language hierarchy, workflow steps, levels) in
a dark card at the top-right. One item can be **accented** in amber
to highlight the relevant level/step.

**Use for:** showing a hierarchy or list while the speaker explains
it. Card stays visible 8-50s.

**HTML:**
```html
<div id="ill-stack" class="clip" data-start="{start}" data-duration="{dur}" data-track-index="5">
  <div class="ill-card">
    <div class="ill-card-label">我们写的层级</div>
    <div class="ill-row"><span class="ill-tag accent">自然语言</span></div>
    <div class="ill-row"><span class="ill-tag">Python</span></div>
    <div class="ill-row"><span class="ill-tag">C</span></div>
    <div class="ill-row"><span class="ill-tag">Assembly</span></div>
  </div>
</div>
```

**CSS:** (see `references/illustration_patterns.md` for the full
canonical CSS — copy verbatim)

**GSAP — slide in from right + stagger rows:**
```js
tl.fromTo("#ill-stack", { x: 360, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, start + 0.2);
tl.from("#ill-stack .ill-row", { y: 20, opacity: 0, duration: 0.4, stagger: 0.12, ease: "power2.out" }, start + 0.4);
tl.to("#ill-stack", { x: 360, opacity: 0, duration: 0.5, ease: "power2.in" }, end - 0.5);
```

### 5. `hammer` illustration — center-frame big equation/text overlay

A BIG center-frame text/equation that visually "hammers" a key claim.
Best for the single most quotable moment in a clip (e.g.,
"LLM = 编译器", "Token = 新 GDP", "AI ≠ 更快的轿子"). Visible 4–8s.

**HTML:**
```html
<div id="ill-hammer" class="clip" data-start="{start}" data-duration="{dur}" data-track-index="6">
  <div class="ill-h-content">
    <div class="ill-h-eq">
      <span class="ill-h-left">LLM</span>
      <span class="ill-h-equals">=</span>
      <span class="ill-h-right">新编译器</span>
    </div>
    <div class="ill-h-foot">自然语言 → Python → 汇编</div>
  </div>
</div>
```

**GSAP — scale-pop entrance + stagger each piece + scale-fade exit:**
```js
tl.fromTo("#ill-hammer", { scale: 0.85, opacity: 0 },
  { scale: 1.0, opacity: 1, duration: 0.45, ease: "back.out(1.6)" }, start);
tl.from("#ill-hammer .ill-h-left", { x: -40, opacity: 0, duration: 0.4, ease: "expo.out" }, start + 0.2);
tl.from("#ill-hammer .ill-h-equals", { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)" }, start + 0.4);
tl.from("#ill-hammer .ill-h-right", { x: 40, opacity: 0, duration: 0.4, ease: "expo.out" }, start + 0.6);
tl.from("#ill-hammer .ill-h-foot", { y: 20, opacity: 0, duration: 0.4, ease: "power2.out" }, start + 0.8);
tl.to("#ill-hammer", { scale: 1.05, opacity: 0, duration: 0.45, ease: "power2.in" }, end - 0.45);
```

(see `references/illustration_patterns.md` for full canonical CSS)

### 6. `cta` — end-card with channel CTA

A branded outro for the final 3 seconds. Use **王建硕** as the channel
name (per global instructions) — never put a guest's name in the CTA
slot.

**HTML:**
```html
<div id="cta" class="clip" data-start="{cta_start}" data-duration="3.24" data-track-index="1">
  <div class="cta-line-1">关注王建硕</div>
  <div class="arrow">↓</div>
  <div class="cta-line-2">微信公众号 · 视频号</div>
  <div class="cta-foot">AI 炼金术 · 持续更新</div>
</div>
```

**CSS / GSAP:** see `references/illustration_patterns.md`.

### Legacy types (for one-off overlays on a single video)

The `spec.json + scaffold.py` workflow also supports these older
overlay types — useful when you want to dress up ONE existing video
without going through the full post-production workflow above:

- **`quote`** — full-width kinetic typography, top or bottom gradient.
  Best for opening hooks and key-quote callouts.
- **`slogan`** — alias for `quote` with `position: bottom` and larger
  type. Best for closing slogans.
- **`callout`** — small annotation panel in a corner. Best for chapter
  labels, lower-thirds, "as seen in" notes.
- **`custom`** — escape hatch. Claude writes the overlay's HTML/CSS/GSAP
  inside an `overlays/<name>.html` fragment file. See
  `references/custom_overlay_recipes.md`.

## Workflow A — Post-segmentation preset (most common)

Use this when you're coming directly from `/wjs-segmenting-video`
and want the standard `cover + caption + chapter + illustrations + CTA`
treatment for each clip.

### Step 1 — Generate AI covers at the right aspect

```bash
# For vertical 9:16 output (视频号 / 抖音):
python3 ~/.claude/skills/wjs-segmenting-video/scripts/make_cover.py \
    --segments segments.json --out output/ --size 1024x1792 --single 1
# Verify segment 1's cover; then batch:
python3 ~/.claude/skills/wjs-segmenting-video/scripts/make_cover.py \
    --segments segments.json --out output/ --size 1024x1792
```

### Step 2 — For each clip, scaffold a HyperFrames project

`hf_clip_NN/1080/` with:
- `index.html` — the composition (from template; see
  `references/post_segmentation_template.html`)
- `clip.mp4` — copied from `output/clip_NN_slug.mp4`
- `cover.png` — copied from `output/cover_NN_slug.png`
- `captions.json` — generated from `output/clip_NN_slug.zh-CN.burn.srt`
  with **every cue's start/end shifted by +cover_duration** (so cues
  align with the composition timeline, not the body's own clock)

The build script at `references/build_hf_clips.py` does this for all
segments in one pass. It reads `segments.json` + an
`ILLUSTRATIONS` dict (illustrations per clip, see Step 3) + the
template, and emits 5 ready-to-render projects.

### Step 3 — Define illustrations per clip

For each clip, identify 1-2 hook moments and pick `stack` or `hammer`:

```python
ILLUSTRATIONS = {
    1: [
        # The language hierarchy as a stack card during the opening
        {"key": "stack", "pattern": "stack", "body_start": 0.3, "body_end": 9.0,
         "label": "我们写的层级",
         "rows": [
             {"text": "自然语言", "accent": True},
             {"text": "Python",   "accent": False},
             {"text": "C",        "accent": False},
             {"text": "Assembly", "accent": False},
         ]},
        # The hammer at the most quotable moment
        {"key": "hammer", "pattern": "hammer", "body_start": 10.8, "body_end": 14.6,
         "left": "LLM", "equals": "=", "right": "新编译器",
         "foot": "自然语言 → Python → 汇编"},
    ],
    # ... clips 2-5
}
```

Timestamps are **body-relative** (after the cover-scene duration); the
build script adds the cover offset when emitting GSAP positions.

### Step 4 — Build + render

```bash
python3 references/build_hf_clips.py    # scaffolds all projects
for n in 01 02 03 04 05; do
  cd "hf_clip_$n/1080"
  npx hyperframes lint
  npx hyperframes validate
  npx hyperframes render
  cd ../..
done
```

A 2:30 clip renders in ~3 min. Output: `hf_clip_NN/1080/renders/*.mp4`.

## Workflow B — Custom overlays on a single video (legacy spec.json)

Use this when you have ONE existing video and want to add a few
ad-hoc overlays (title cards, annotations, lower-thirds).

### spec.json schema

```json
{
  "source_video": "../path/to/source.mp4",
  "duration": 135.4,
  "size": "1920x1080",
  "name": "clip_01_animated",
  "overlays": [
    {"id": "o1", "type": "quote", "start": 8.0, "duration": 6.0,
     "position": "top", "lines": ["代码不存在错误", "只存在意图错配"],
     "accent": [false, true]},
    {"id": "o2", "type": "callout", "start": 30.0, "duration": 5.0,
     "anchor": "top-right", "text": "FRP 概念"},
    {"id": "o3", "type": "slogan", "start": 122.0, "duration": 13.4,
     "lines": ["改 prompt", "不改 AI 生成的代码"], "accent": [false, true]}
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `source_video` | Yes | Path to source MP4. Symlinked into the project as `source.mp4`. |
| `duration` | Yes | Total composition length in seconds — match the source video. |
| `size` | No | `WIDTHxHEIGHT` (default `1920x1080`). |
| `overlays[].type` | Yes | `quote`, `slogan`, `callout`, or `custom`. |
| `overlays[].start` | Yes | Start time in seconds. |
| `overlays[].duration` | Yes | How long the overlay is on screen. |

### Scaffold + render

```bash
python3 ~/.claude/skills/wjs-overlaying-video/scripts/scaffold.py spec.json
cd <name> && npm run check && npm run render
```

## Output checklist

Before considering a clip done:

- [ ] Frame 0 is the cover (not black) — `ffmpeg -ss 0 -vframes 1 out.mp4`
- [ ] Captions are synced with audio (lint a few seconds with audio playback)
- [ ] All illustrations enter and exit at the speech moments they support
- [ ] CTA renders correctly (`关注王建硕`, not a guest's name)
- [ ] `npx hyperframes lint && npx hyperframes validate` both pass
- [ ] `npx hyperframes inspect` shows no layout overflow
- [ ] Total duration matches the source clip + cover + CTA durations

## Common mistakes

- **Cover aspect ≠ output aspect.** `1024x1536` (the default
  make_cover.py size) is 2:3 and gets letterboxed or cropped on 9:16
  output. Always pass `--size 1024x1792` for vertical.
- **Caption alignment jumps with line count.** Anchor by CENTER
  (translate(-50%, -50%)) inside a fixed-height container so 1-line
  vs 2-line cues share the same visual midline. NOT anchored from
  bottom (causes growth-upward).
- **GSAP overwrites CSS transform centering.** If you set
  `transform: translate(-50%, -50%)` in CSS and then tween `y`, GSAP
  replaces the transform and centering breaks. Use `gsap.set(el, {
  xPercent: -50, yPercent: -50 })` instead so xPercent/yPercent compose
  with subsequent y/x tweens.
- **Burning libass subs on top of HTML/CSS captions.** Pick ONE caption
  system per output video. If you're using this skill's HTML/CSS
  captions, do NOT also burn subs in `/wjs-segmenting-video` —
  request the raw clip via the hand-off package.
- **Frame 0 is black.** If your cover scene has an opacity fade-in
  starting from 0, the literal first frame is black and the platform
  thumbnail will be black. Place the cover statically (no opacity
  tween) and verify with `ffmpeg -ss 0 -vframes 1`.
- **Channel name in CTA = guest's name.** Always use `王建硕`. Guests
  belong in description text inside the metadata, not in the on-screen
  CTA.
- **Cover image cropped because of object-fit: cover on mismatched
  aspect.** Either regenerate the cover at the right aspect (see Step
  1) or letterbox with `object-fit: contain` + dark background.

## Integration with other skills

- **`/wjs-segmenting-video`** — the typical upstream. After it cuts
  + crops + slices SRTs, this skill picks up. The hand-off package is
  `clip_NN.mp4` + `clip_NN.zh-CN.burn.srt` + `segments.json`.
- **`/wjs-transcribing-audio`** + **`/wjs-translating-subtitles`** — if no SRT exists, run them first. The
  word-level Whisper or Volcano/豆包 ASR output is preferred for
  accurate cue timing.
- **`hyperframes`** — the underlying composition framework. This skill
  is a thin wrapper that encodes the proven post-production patterns;
  everything in the `hyperframes` skill applies (preview, render,
  transitions, audio-reactive, etc.). Read it whenever you write
  `custom` overlays.
- **`hyperframes-cli`** — the CLI commands the project uses
  (`init`, `lint`, `validate`, `inspect`, `render`).
- **`gpt-image-2-skill`** — the cover generator. `make_cover.py`
  invokes it via the codex CLI; the codex auth in `~/.codex/auth.json`
  is required.
- **`/wjs-uploading-video`** — the next downstream after this skill
  produces an MP4. Uploads the renders to YouTube with title /
  description / tags from a metadata file.

## Files & references

- `scripts/scaffold.py` — Workflow B scaffolder (legacy spec.json
  for ad-hoc overlays)
- `references/post_segmentation_template.html` — Workflow A template:
  the canonical `cover + caption + chapter + illustration + CTA`
  composition shape, with placeholder substitutions
- `references/build_hf_clips.py` — Workflow A multi-clip builder.
  Reads `segments.json` + per-clip illustrations dict, scaffolds and
  populates one project per clip
- `references/illustration_patterns.md` — canonical CSS / GSAP for
  the `stack` and `hammer` illustration patterns
- `references/custom_overlay_recipes.md` — reusable `custom` overlay
  recipes (terminal demo, layer-stack diagram, callout with arrow)
- `references/example_spec.json` — Workflow B example
