---
name: wjs-burning-subtitles
description: Use when the user has a video + an SRT and wants the subtitles either burned into the pixels (libass, always-visible) or soft-muxed as a togglable track. Also handles the final composite step for the localization pipeline — burn subs, mix a dub track, and keep the original audio as a low-volume bed, all in ONE ffmpeg encode (no cascade). Verifies libass availability and auto-downloads a static evermeet ffmpeg build when Homebrew's stripped binary lacks it. Triggers — "烧字幕", "硬字幕", "burn subtitles", "burn-in subs", "embed subtitle", "soft mux SRT", "把字幕烧进视频", "做最终合成".
---

# wjs-burning-subtitles

Video + SRT → video with subtitles. Also the final-encode stage for the localization pipeline: takes a video, an optional dub track from `/wjs-dubbing-video`, and an optional SRT to burn, and produces the upload-ready MP4 in **one** ffmpeg pass. No cascade of decodes/re-encodes.

## When to use

- User has an SRT and wants it always-visible on the video (burn-in for 微信视频号 / 抖音 / WeChat — players that won't honor embedded subtitle tracks).
- User wants a togglable subtitle track (soft-mux) for QuickTime / VLC / IINA / mobile players that support `mov_text`.
- Final composite after `/wjs-dubbing-video`: burn target-language subs + mix dub over original-as-bed in one encode.

## When NOT to use

- No SRT yet → run `/wjs-transcribing-audio` then `/wjs-translating-subtitles` first.
- HTML/CSS captions (kinetic, per-word highlights, custom fonts) on a clip composed in HyperFrames → use `/wjs-overlaying-video` instead. Don't mix libass burn-in with HyperFrames captions on the same output.
- The "subtitles" are actually motion graphics (animated callouts, lower-thirds with logos, kinetic typography) → that's `/wjs-overlaying-video`, not this skill.

## The 3 modes of `render.py`

`scripts/render.py` auto-detects mode from flags:

1. **Subtitles only** — `--video + --srt` → re-encodes video with burned subs, original audio passes through.
2. **Dub only** — `--video + --dub` → keeps original video stream; replaces or mixes the audio track.
3. **Full localized cut** — `--video + --srt + --dub` → burns subs AND mixes dub. By default keeps original audio at low volume as a "bed" under the dub (set `--bed-volume 0` or `--no-original-audio` to drop it).

Burn-in requires an ffmpeg built with libass. The script auto-downloads a static libass-enabled build from evermeet.cx into `/tmp/ff_bin/` on first use if needed.

## Soft-mux (togglable subtitle track)

Player apps can show/hide. Works with any `ffmpeg` build — does **not** need libass:

```bash
ffmpeg -i input.mp4 -i input.zh-CN.srt \
  -map 0:v -map 0:a -map 1:0 \
  -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=zho -metadata:s:s:0 title="中文" \
  output.mp4
```

This is fast (stream-copy) and reversible. Use it when:

- Target platform supports embedded subs (YouTube auto-detects; VLC/QuickTime honors).
- User wants viewers to be able to toggle off.
- You don't want to re-encode the video.

`render.py --video IN.mp4 --srt SUB.srt --soft-mux` runs this path.

## Hardcoded burn-in (always visible, libass)

Required for WeChat/抖音/朋友圈 etc. where the player will not honor embedded subtitle tracks.

### Verify libass is available BEFORE promising burn-in

```bash
ffmpeg -filters 2>&1 | grep -E "subtitles|^.. ass "
```

If neither `subtitles` nor `ass` shows up, the build lacks libass. Homebrew's default `ffmpeg` formula is often stripped (no `--enable-libass`, no `--enable-libfreetype`, no `drawtext`). Don't waste time fighting the comma-escaping inside `force_style` — it will fail with `No such filter: 'subtitles'` no matter how the shell quotes it.

### Fastest fix on macOS — drop in a static build, no system changes

```bash
curl -fsSL -o /tmp/ff.zip https://evermeet.cx/ffmpeg/getrelease/zip
unzip -o /tmp/ff.zip -d /tmp/ff_bin >/dev/null
FF=/tmp/ff_bin/ffmpeg
$FF -version | grep -oE -- "--enable-(libass|libfreetype)"
```

Then use `$FF` instead of `ffmpeg` for the render. The brew binary is fine for everything else (probe, audio extraction, soft-mux). `render.py` does this auto-fallback if its default ffmpeg lacks libass.

### Burn-in render with style overrides

🛑 **Checkpoint — confirm before full-render.** Burn-in re-encodes the entire video (minutes of CPU on a 5-min clip). Before kicking it off:

1. Render only the first 30s with `-t 30` for a fast preview.
2. Extract a frame from the longest-line cue (see Fontsize calibration below) and Read it.
3. Show the user the preview frame + the cue text, ask: "字号/字体/边距 OK 吗？OK 才跑全片。" Wait for explicit confirmation.

Skip the checkpoint only if the user has already approved a full render of this exact video at this exact font config in the same conversation.

```bash
$FF -i input.mp4 \
  -vf "subtitles=input.zh-CN.srt:force_style='Fontname=PingFang SC\,Fontsize=12\,PrimaryColour=&H00FFFFFF\,OutlineColour=&H00000000\,BorderStyle=1\,Outline=2\,Shadow=1\,MarginL=20\,MarginR=20\,MarginV=40'" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a copy output.mp4
```

Inside `force_style`, escape every comma as `\,` (the filter graph parser eats the bare comma as a chain separator). All other special chars are fine.

### Fontsize calibration — critical

libass scales its internal PlayRes up to the actual video resolution. The number you pass is **not pixels** in the output. As a starting calibration on a 544×960 vertical phone video, `Fontsize=22` rendered each Chinese character at ~55px wide and overflowed the frame, while `Fontsize=12` rendered at ~30–35px wide and fit cleanly with 15-char lines.

Rule of thumb: start at `Fontsize=12`, render, then **always** extract a frame and look:

```bash
$FF -ss 30 -i output.mp4 -frames:v 1 /tmp/frame.png -y
# then Read /tmp/frame.png to verify the longest-line cue fits
```

Pick a timestamp that lands on the cue with the most characters per line — short lines won't expose overflow. Add `MarginL=20 MarginR=20` as a safety inset; never trust default left/right margins.

### Style cheatsheet

Keys that matter (libass `force_style`):

- `Fontname=PingFang SC` — macOS default CJK; alternates: `Songti SC`, `Heiti SC`, `STHeiti`, `Hiragino Sans GB`.
- `Fontsize=12` — start small, scale up only after frame check.
- `PrimaryColour=&H00FFFFFF` — white text (BBGGRR + alpha).
- `OutlineColour=&H00000000` — black outline.
- `BorderStyle=1` — outline only (clean over varied backgrounds). Use `BorderStyle=3` for an opaque box behind text when the background is busy.
- `Outline=2` — 2px outline thickness.
- `Shadow=1` — subtle drop shadow.
- `MarginL=20 MarginR=20` — keep text inside the frame.
- `MarginV=40` — vertical distance from the bottom edge.

### SRT line-length discipline for burn-in

Even with correct `Fontsize`, lines that are too long will wrap or overflow. Keep each on-screen line ≤ ~15 Chinese characters (~42 Latin chars). Use explicit `\n` line breaks inside the SRT block — do not rely on auto-wrapping. Two short lines beat one long one every time. (This is upstream discipline — `/wjs-translating-subtitles` should already cap cues at these limits.)

## Audio mixing — keep the original as a low-volume bed

A pure dub-only track sounds dubbed (because it is). Mixing the original audio at low volume under the dub gives the "professional translation" feel — you still hear the speaker's breath, emphasis, and laughter, just under the new voice.

```bash
$FF -i original.mp4 -i dub.mp4 \
  -filter_complex "[0:a]volume=0.18[orig];\
                   [1:a]volume=1.0[dub];\
                   [orig][dub]amix=inputs=2:duration=longest:normalize=0[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k mixed.mp4
```

Reasonable starting volumes:

- Original bed at `0.15`–`0.25` (≈ −16 to −12 dB)
- Dub at `1.0`
- Use `normalize=0` so amix doesn't auto-attenuate when both are active.

To drop the original entirely: `--no-original-audio` (equivalent to `--bed-volume 0`).

## Combining dub + burn-in + bed (the full job)

One ffmpeg call does all three — burn the target subtitle onto the video stream and mix the two audio tracks:

```bash
$FF -i original.mp4 -i dub.mp4 \
  -filter_complex "[0:v]subtitles=input.zh-CN.srt:force_style='Fontname=PingFang SC\,Fontsize=12\,PrimaryColour=&H00FFFFFF\,OutlineColour=&H00000000\,BorderStyle=1\,Outline=2\,Shadow=1\,MarginL=20\,MarginR=20\,MarginV=40'[v];\
                   [0:a]volume=0.18[orig];[1:a]volume=1.0[dub];\
                   [orig][dub]amix=inputs=2:duration=longest:normalize=0[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k final.mp4
```

This is the "ship to social media" final cut. `render.py --video original.mp4 --dub dub.mp4 --srt input.zh-CN.srt` runs this exact pipeline.

## Running `render.py`

```bash
# Subtitles only (burn):
python3 ~/.claude/skills/wjs-burning-subtitles/scripts/render.py \
    --video IN.mp4 --srt SUB.srt --out OUT.mp4

# Dub only (replace audio, no subs):
python3 ~/.claude/skills/wjs-burning-subtitles/scripts/render.py \
    --video IN.mp4 --dub IN_zh_dub.mp4 --out OUT.mp4

# Full localized cut (burn + dub + original bed):
python3 ~/.claude/skills/wjs-burning-subtitles/scripts/render.py \
    --video IN.mp4 --srt IN.zh-CN.srt --dub IN_zh_dub.mp4 --out OUT.mp4

# Soft-mux (no re-encode):
python3 ~/.claude/skills/wjs-burning-subtitles/scripts/render.py \
    --video IN.mp4 --srt SUB.srt --soft-mux --out OUT.mp4
```

See `render.py --help` for the full style/audio flag list (`--font`, `--fontsize`, `--color`, `--outline-color`, `--margin-v`, `--bed-volume`, `--no-original-audio`).

## Output

- Burn mode: `<source>_burned.mp4` (re-encoded, libass-rendered subs)
- Soft-mux mode: `<source>_softsub.mp4` (stream-copy, `mov_text` track)
- Full cut: `<source>_final.mp4` (re-encoded video with burned subs + mixed audio)

## Anti-patterns

- ❌ **Promising burn-in without verifying libass.** Check `ffmpeg -filters | grep subtitles` first; auto-fall back to evermeet static build if missing.
- ❌ **Committing a burn render without a frame check.** Always extract a frame at the longest-line cue and Read it before kicking off the full render.
- ❌ **Bare commas inside `force_style`.** The filter graph parser eats them. Escape every internal comma as `\,`.
- ❌ **Mixing libass burn-in with HyperFrames captions.** Pick ONE caption system per output video. If you're using HTML/CSS captions in `/wjs-overlaying-video`, don't burn here too.
- ❌ **Using period milliseconds in the SRT.** Whisper local writes `.mmm`; libass tolerates it but other downstream tools choke. Normalize to `,mmm`.
- ❌ **Defaulting to `BorderStyle=3` (opaque box).** Use `BorderStyle=1` (outline only) unless the background is genuinely busy — the box looks heavy and dated.

## Upstream

- **`/wjs-transcribing-audio`** + **`/wjs-translating-subtitles`** — produce the SRT input.
- **`/wjs-dubbing-video`** — produces the `*_<lang>_dub.mp4` input for full-localized-cut mode. The dub-only file is technically a finished video; this skill is what mixes the original underneath and burns the subs to make it shippable.

## Common pitfalls

- **Fontsize that worked on one video looks tiny / huge on another.** libass scales by PlayRes ratio, not pixels. Recalibrate per video resolution; don't trust a hardcoded value.
- **Margin defaults clip text on vertical phone videos.** Always set `MarginL=20 MarginR=20` and `MarginV=40` (or higher) explicitly.
- **`mov_text` track shows up in QuickTime but not in some Android players.** If the target audience is mobile-Chinese, soft-mux is unreliable; burn instead.
- **Background-bus busy / contrast issues.** Increase `Outline=2` → `Outline=3`, or switch to `BorderStyle=3` for a translucent box (`BackColour=&H80000000` for 50% black).
