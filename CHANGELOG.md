# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2026-05-14]

### Added

- **`wangjianshuo-perspective`** — new skill: distilled thinking OS for Wang Jianshuo (王建硕). Synthesised from ~1M-word English blog + ~1.09M-word Chinese blog (2002–2022). Activates on triggers like "用王建硕的视角" / "Jian Shuo Wang perspective" / "切换到王建硕"; Claude then speaks directly as Wang Jianshuo until the user says "退出". Includes 7 core mental models, 10 decision heuristics, and bilingual voice guidelines.
- **`wangjianshuo-perspective/yuanqi-prompt.md`** — condensed (~4000-char) version of the persona prompt for the 元器 (Yuanqi) platform, with example title-generation outputs and intellectual-lineage context.

### Changed

- **`wjs-eating-and-growing`** — simplified from 6 steps to 4: the framework now runs ① capture the hot moment → ② root cause → ③ one-line insight → ④ minimum next action. Dropped the layer-diagnosis and fire-test as separate steps; the L1/L2/L3 model is still the conceptual backbone but no longer a user-facing prompt step.
- **`wjs-publishing-wechat`** — iterative content update (exact changes tracked in skill directory).
- **README** — added Claude Code install instructions (npm / npx / native-installer paths); added `wangjianshuo-perspective` to skills table and dedicated section.

## [2026-05-13]

### Added

- **`wjs-eating-and-growing`** — new skill: 6-step interactive reflection framework ("吃一舍长一智"). Diagnoses which of three layers (L1 knowledge gap / L2 in-the-moment retrieval / L3 default reaction) caused a setback, then prescribes the right training modality for that layer. Replaces the earlier `eat-grow` skill.
- **`.claude-plugin/marketplace.json`** — the repo is now installable as a Claude Code marketplace plugin (`claude plugin marketplace add jianshuo/claude-skills`).
- **`LICENSE`** — MIT licence added.

### Changed

- **`wjs-prompting-skills` renamed to `wjs-promoting-skills`** — the skill is about *marketing / promoting* skills externally (X posts, community drafts), not about prompting. Name corrected to remove ambiguity.
- **`wjs-promoting-skills`** — multiple iterative improvements to the daily automation flow, rotation rules, X post format constraints, and community-draft templates.
- **README** — documented three install paths (ClawHub / marketplace / git clone) and added a compatibility section listing Claude Code, OpenAI Codex CLI, Cursor, Gemini CLI, and Goose.

## [2026-05-12]

### Changed

- **Renamed all skills to V-ing (gerund) convention** — skill directories now describe *what action is happening*, which aligns with Claude Code's auto-loading trigger logic. Mapping:
  - `wjs-burn-subs` → `wjs-burning-subtitles`
  - `wjs-transcribe` → `wjs-transcribing-audio`
  - `wjs-translate-srt` → `wjs-translating-subtitles`
  - `wjs-dub` → `wjs-dubbing-video`
  - `wjs-video-overlay` → `wjs-overlaying-video`
  - `wjs-video-segmentation` → `wjs-segmenting-video`
  - `wjs-translate-video` → `wjs-localizing-video`
  - `wjs-wechat-publish` → `wjs-publishing-wechat`
  - `wjs-video-upload` → `wjs-uploading-video`
  - `wjs-make-it-right` → `wjs-auditing-project`
  - `wjs-multicam-edit` → `wjs-editing-multicam`
  - `wjs-multicam-sync` → `wjs-syncing-multicam`
  - `wjs-video-crop` → `wjs-reframing-video`
- **README rewritten** with updated skill names, improved catalog table, grouped workflow sections, and end-to-end pipeline diagrams.
- **`wjs-publishing-wechat`**: Cover image (题图) is now always AI-generated. Removed the interactive prompt that asked the user to choose a cover option.

### Updated (skill content)

- `wjs-publishing-wechat` — multiple iterative improvements throughout the day.
- `wjs-overlaying-video` — content updates.
- `wjs-segmenting-video` — content updates.
- `wjs-localizing-video` — content updates.
- `wjs-burning-subtitles` — content updates.
- `wjs-dubbing-video` — content updates.
- `wjs-translating-subtitles` — content updates.
- `wjs-transcribing-audio` — content updates.
- `wjs-uploading-video` — content updates.
