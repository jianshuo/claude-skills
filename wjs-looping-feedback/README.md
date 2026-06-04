# wjs-looping-feedback

A Claude Code skill that wires a "suggest → auto-edit → auto-deploy → review/revert" loop
into any website repo. See `SKILL.md` for the trigger and `references/install.md` for how it
installs. Pure logic is in `assets/feedback-lib.mjs`; tests run with `npm test`.
