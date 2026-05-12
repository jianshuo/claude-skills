# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
