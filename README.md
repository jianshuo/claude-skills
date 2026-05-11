# claude-skills

My Claude Code skills.

Auto-mirrored from `~/.claude/skills/` by a PostToolUse hook —
every time I edit a `wjs-*` skill (or `jianshuo-wechat-mp-publish`),
the changed skill directory is rsynced here and pushed to GitHub.

Skills:

- [`jianshuo-wechat-mp-publish/`](./jianshuo-wechat-mp-publish/) — polish + publish WeChat 公众号 articles end-to-end (cover/illustration generation, draft upload via `md2wechat`).
- [`wjs-multicam/`](./wjs-multicam/) — sync multi-camera footage via audio cross-correlation and auto-edit director-style cuts on speaker / silence / motion changes.
- [`wjs-translate-video/`](./wjs-translate-video/) — end-to-end video localization: transcribe (Whisper) → translate → SRT → optional burn-in → optional time-aligned voice dub (Volcano / edge-tts).
- [`wjs-video-overlay/`](./wjs-video-overlay/) — layer animated overlays (title cards, callouts, cutaways, lower-thirds) on top of an existing video via a HyperFrames composition.

Hook source: `~/.claude/skills-publish-hook.sh`
