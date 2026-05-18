# scripts/

Repo-level tooling. Versioned so the marketplace ships with it.

## `lint_skill.py`

Validates a `SKILL.md` frontmatter so the auto-publish hook never ships a skill
with a broken `name:` or `description:` that breaks Claude's auto-invocation
matching.

```bash
# manual
./scripts/lint_skill.py wjs-transcribing-audio/SKILL.md

# sweep the whole repo
find . -maxdepth 2 -name SKILL.md | xargs -n1 ./scripts/lint_skill.py
```

### Wire it up as a PostToolUse hook

Paste this into `~/.claude/settings.json` (global, so it fires when you edit
skills in `~/.claude/skills/wjs-*/` as well as in this repo). Adjust the
absolute path to where you cloned this repo.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/jianshuo/code/claude-skills/scripts/lint_skill.py --hook"
          }
        ]
      }
    ]
  }
}
```

Exit codes:
- `0` — silent pass (or soft warnings on stderr)
- `2` — hard failure, errors are surfaced back to Claude as feedback so it
  fixes the frontmatter before continuing

The script no-ops cleanly when the edited file isn't a `SKILL.md`, so the
matcher can stay broad.
