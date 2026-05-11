# claude-skills

My Claude Code skills.

Auto-mirrored from `~/.claude/skills/` by a PostToolUse hook —
every time I edit a `wjs-*` skill, the changed skill directory is rsynced
here and pushed to GitHub.

Skills:

- [`wjs-wechat-publish/`](./wjs-wechat-publish/) — polish + publish WeChat 公众号 articles end-to-end (cover/illustration generation, draft upload via `md2wechat`).
- [`wjs-multicam-sync/`](./wjs-multicam-sync/) — align 2+ recordings of the same event via audio cross-correlation. Output is a `.sync.json` sidecar per input; originals are never re-encoded. Downstream uses `ffmpeg -itsoffset`.
- [`wjs-multicam-edit/`](./wjs-multicam-edit/) — director-style auto-edit of synced multicam footage: hard cuts, virtual close-ups via crop-zoom, picture-in-picture. Consumes the sidecars produced by `wjs-multicam-sync`.
- [`wjs-translate-video/`](./wjs-translate-video/) — end-to-end video localization: transcribe (Whisper) → translate → SRT → optional burn-in → optional time-aligned voice dub (Volcano / edge-tts).
- [`wjs-video-overlay/`](./wjs-video-overlay/) — layer animated overlays (title cards, callouts, cutaways, lower-thirds) on top of an existing video via a HyperFrames composition.
- [`wjs-video-rotate/`](./wjs-video-rotate/) — convert a video between horizontal and vertical orientations by face-tracked cropping (16:9 ↔ 9:16, 4:3 ↔ 3:4). Uses MediaPipe to follow the speaker; ffmpeg piecewise-linear crop expression for smooth panning.

Hook source: `~/.claude/skills-publish-hook.sh`
