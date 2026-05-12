---
name: wjs-localizing-video
description: Thin orchestrator for the end-to-end video localization pipeline. Routes to the four focused sub-skills — /wjs-transcribing-audio, /wjs-translating-subtitles, /wjs-dubbing-video, /wjs-burning-subtitles. Use when the user asks for full localization in one go ("帮我把这个西班牙语视频做成中文字幕+配音", "translate and dub this video", "做完整的本地化"). For any individual step (just transcribe, just translate, just dub, just burn), invoke the sub-skill directly — it's faster and the boundary is cleaner.
---

# wjs-localizing-video (orchestrator)

> **This skill was split.** What used to be one 1300-line catch-all is now 4 focused sub-skills. Use this orchestrator only when the user asks for the *full pipeline* in one request. For any individual step, route directly to the sub-skill.

## The four sub-skills

| Step | Skill | IN | OUT |
|---|---|---|---|
| 1. ASR | **`/wjs-transcribing-audio`** | audio / video + source language | source-language SRT |
| 2. Translate | **`/wjs-translating-subtitles`** | source SRT + target language | target SRT (punct-bounded) |
| 3. Dub (optional) | **`/wjs-dubbing-video`** | video + target SRT + voice | `*_<lang>_dub.mp4` (TTS audio swapped in) |
| 4. Burn / mix (optional) | **`/wjs-burning-subtitles`** | video + SRT + (optional dub) | final MP4 (one encode) |

Steps 3 and 4 are optional and independent — most "subtitle-only" jobs stop after step 2 + soft-mux via `/wjs-burning-subtitles`. Most "dub-only" jobs stop after step 3.

## When to invoke this orchestrator vs a sub-skill directly

**Invoke this skill (`wjs-localizing-video`)** when the user asks for the whole chain in one go:

- "帮我把这个西班牙语视频做成中文字幕和中文配音"
- "translate this Spanish video to English with dubbing"
- "全套：转写、翻译、烧字幕、配音、混音"

**Invoke a sub-skill directly** when the user asks for one step:

- "转写一下这个音频" → `/wjs-transcribing-audio`
- "把这个 SRT 翻译成中文" → `/wjs-translating-subtitles`
- "给这个视频配个中文音" → `/wjs-dubbing-video`
- "把字幕烧进视频" → `/wjs-burning-subtitles`

The sub-skills are more focused and document their input/output contracts tighter. Don't route through this orchestrator when a single step is the whole ask — you'll just be reading docs you don't need.

## Progress checklist (do this FIRST, before any sub-skill)

The pipeline has up to four steps and runs for several minutes. The user wants to see live progress, not a wall of silence followed by a finished file. **Before invoking the first sub-skill, lay out the planned steps as a TaskCreate checklist.** As you start each step, update its task to `in_progress`; when it finishes, mark `completed`. Claude Code renders this as a checklist in the UI that ticks off in real time.

### Which tasks to create

Decide from the user's ask which subset of the 4 steps will run:

| User asked for | Tasks to create |
|---|---|
| Full localization (subs + dub + final mix) | ① 转写 ② 翻译 ③ 配音 ④ 烧字幕 + 混音 |
| Subtitles only (no voice change) | ① 转写 ② 翻译 ③ 烧字幕 (or soft-mux) |
| Dub only (no burn) | ① 转写 ② 翻译 ③ 配音 |
| User already has source SRT | skip ①; create only the remaining steps |
| User already has target SRT | skip ① and ②; create only the remaining |

Don't create tasks for steps you won't run — an unchecked item at the end reads as "we forgot," not "we skipped."

### How to phrase the task subjects

Use the same labels you'll use in the "Final response template" below, so the in-flight checklist and the completion summary read as the same artifact:

- `转写 <source-lang>` (e.g., `转写 西班牙语`)
- `翻译 → <target-lang>` (e.g., `翻译 → 中文`)
- `配音 <target-lang>` (e.g., `配音 中文 (高冷御姐 -8%)`)
- `烧字幕 + 原声底层 <bed>` (e.g., `烧字幕 + 原声底层 0.18`)

For `activeForm`, use the present-continuous variant (`转写中…`, `翻译中…`, `配音中…`, `合成中…`).

### State discipline

- Mark `in_progress` **only** the task currently running (one at a time).
- Mark `completed` immediately when the sub-skill returns its output file — don't batch.
- If a step surfaces a clarifying question or fails, **leave it as `in_progress`** so the user can see exactly where the pipeline stopped. Don't mark a half-finished step as completed.
- If the user redirects mid-pipeline (e.g., "skip the dub"), update the remaining tasks: delete the ones no longer applicable, keep the rest. Don't silently drop them.

## Canonical end-to-end pipeline (Spanish → Chinese, with dub + bed + burn)

This is the original "validation scenario" — Spanish yoga/spiritual content into Chinese for 微信视频号 / 小红书. Walks through all 4 sub-skills.

### Step 1 — Transcribe the Spanish source

```
Invoke /wjs-transcribing-audio with the video and `--language es`.
```

The sub-skill handles: chunking, word-level timestamps, cue assembly at punctuation boundaries, loop guard, retry. Output: `entrevista.srt` (Spanish, source-language).

### Step 2 — Translate to Simplified Chinese

```
Invoke /wjs-translating-subtitles with the Spanish SRT and target `zh-CN`.
```

The sub-skill handles: re-segmenting cues at punctuation, minimizing filler demonstratives, capping line length, preserving speaker tone. Output: `entrevista.zh-CN.srt`.

### Step 3 — (Optional) Dub into Chinese

```
Invoke /wjs-dubbing-video with the video + entrevista.zh-CN.srt + a voice ID.
```

Default for mature contemplative female: `zh_female_gaolengyujie_moon_bigtts` (Volcano 高冷御姐, `--rate -8% +0Hz`). If no Volcano credentials: `zh-CN-XiaoxiaoNeural --rate -8% --pitch -10Hz`. The sub-skill samples first, then commits.

Output: `entrevista_zh_dub.mp4`.

### Step 4 — Burn subs + mix dub over original-as-bed

```
Invoke /wjs-burning-subtitles with --video entrevista.mp4 --srt entrevista.zh-CN.srt --dub entrevista_zh_dub.mp4
```

The sub-skill handles: libass availability check, evermeet static-build fallback, Fontsize calibration, frame-check before full render, audio bed mix at 0.18.

Output: `entrevista_zh_final.mp4` (ship-ready).

## Defaults the user has standardized

These apply across the pipeline; each sub-skill enforces its own slice:

- **Chinese ASR routes to 豆包 (Volcano) first; Whisper is fallback.** Enforced in `/wjs-transcribing-audio`.
- **Single voice for the whole dub unless the user explicitly mentions multiple speakers.** Enforced in `/wjs-dubbing-video`.
- **Original audio kept as a low-volume bed (0.15–0.25) under any dub.** Enforced in `/wjs-burning-subtitles`.
- **Burn-in for 微信视频号 / 抖音; soft-mux for everything else by default.** Enforced in `/wjs-burning-subtitles`.
- **Channel CTA name (if added to description): 王建硕** — never a guest's name. (Global rule from `~/.claude/CLAUDE.md`; applies when this pipeline is followed by `/wjs-uploading-video`.)

## File naming convention (preserved from the original skill)

```text
input:                       entrevista.mp4

Chinese pipeline:
  source SRT                 entrevista.srt
  Chinese SRT                entrevista.zh-CN.srt
  Chinese dub (audio only)   entrevista_zh_dub.mp4
  Chinese final (subs+dub)   entrevista_zh_final.mp4

English pipeline:
  English SRT                entrevista.en.srt
  English dub                entrevista_en_dub.mp4
  English final              entrevista_en_final.mp4

Bilingual subtitles:
  Spanish + Chinese          entrevista.es-zh.srt
  Spanish + English          entrevista.es-en.srt
  three-language             entrevista.es-zh-en.srt
```

BCP-47-style suffixes keep multiple target-language outputs side-by-side and make the target obvious at a glance.

## What this orchestrator does NOT do

- It does not re-implement anything. Every step delegates to a sub-skill.
- It does not bundle the scripts. `dub.py` lives in `/wjs-dubbing-video/scripts/`, `render.py` lives in `/wjs-burning-subtitles/scripts/`, `visual_diarize.py` lives in `/wjs-dubbing-video/scripts/`. If you see stale copies under `wjs-localizing-video/scripts/`, prefer the canonical sub-skill locations.

## Final response template

When the full pipeline completes, respond briefly in the user's language. Match the original "Done" template the user is used to:

```text
已完成：
- 西班牙语转写  (/wjs-transcribing-audio)
- 中文翻译     (/wjs-translating-subtitles)
- 中文配音     (/wjs-dubbing-video, voice: 高冷御姐 -8%)
- 烧入字幕 + 原声底层 0.18  (/wjs-burning-subtitles)

输出：
- entrevista.srt
- entrevista.zh-CN.srt
- entrevista_zh_dub.mp4
- entrevista_zh_final.mp4

不确定片段：
- 00:01:23–00:01:26 背景噪音较大，原文可能不完全准确。
```

If there are no uncertain parts, drop the second list.

## See also

- `/wjs-segmenting-video` — cut long-form video into stand-alone short clips (uses its own SRT slicer; orthogonal to this pipeline).
- `/wjs-overlaying-video` — HTML/CSS captions on a clip via HyperFrames. **Don't combine with `/wjs-burning-subtitles`** — pick one caption system per output.
- `/wjs-uploading-video` — push the final MP4 to YouTube.
- `/lark-minutes` — alternate Chinese-only transcript path via 飞书妙记 when local 豆包 ASR isn't wired up.
