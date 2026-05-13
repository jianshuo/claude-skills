# Today's X post for ${SKILL}

## Inputs (read these)

- `~/.claude/skills/${SKILL}/SKILL.md`
- `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md`
- `~/.claude/skills/wjs-promoting-skills/state/history.jsonl` (last 60 lines)
- `~/.claude/skills/wjs-promoting-skills/state/research.md`

## Task

Write **one** X post (≤ 280 chars) promoting `${SKILL}`. Output to `${OUT_TXT}`. Nothing else.

## Process

1. Find which angle to use from history.jsonl + plan rotation. If no history → Angle 1.
2. Check "what's new" override: if SKILL.md changed since last post → switch to Angle 8.
3. Draft following the chosen angle's template. Pull concrete details from SKILL.md.
4. Verify length: `length(text_without_url) + 23 + 1 + 1 ≤ 280`. Cut bullets, not the hook.
5. Verify voice: forbidden words: "game-changer", "supercharge", "AI-powered", "revolutionary". No rocket/100/fire emoji. Hashtag count ≤ 1.
6. Write final post text to `${OUT_TXT}` (plain text, no markdown wrapper). Print `angle=<N> chars=<count> url=<repo URL>` to stderr.

## Format

```
<skill name + one-line value>

<bullet 1>
<bullet 2>
[<bullet 3>]

<repo URL>
[<one hashtag>]
```

## Constraints

- ≤ 280 chars (URL counts as 23)
- Repo URL on its own line
- Don't post if no repo URL — write `__NO_REPO__` to `${OUT_TXT}` and exit
- If history.jsonl shows `${SKILL}` posted in last 7 days → write `__SKIP_TOO_RECENT__` and exit
