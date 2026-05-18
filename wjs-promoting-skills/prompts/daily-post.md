# Today's X post for ${SKILL}

## Inputs (read these)

- `~/.claude/skills/${SKILL}/SKILL.md`
- `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md`
- `~/.claude/skills/wjs-promoting-skills/state/history.jsonl` (last 60 lines)
- `~/.claude/skills/wjs-promoting-skills/state/research.md`

## Task

Write **one** X post (≤ 280 chars) promoting `${SKILL}`. Output to `${OUT_TXT}` (a file path provided in env). Nothing else.

## Process

1. **Find which angle to use.** Look at `history.jsonl` — past entries for `${SKILL}` have an `angle` field. Pick the next angle in the rotation defined by the plan. If no history yet → Angle 1.

2. **Check the "what's new" override.** If `git -C ~/.claude/skills/${SKILL} log -1 --since=<last_post_date>` shows commits since last post → switch to Angle 8 (what's new) regardless of rotation.

3. **Draft the post following the chosen angle's template.** Pull concrete details from SKILL.md — never paraphrase to vagueness. Numbers, technical terms, file formats, before/after measurements all stay.

4. **Verify length.** X counts URL as 23 chars. Compute: `length(text_without_url) + 23 + 1 + 1 ≤ 280`. If over, cut bullets, not the hook.

5. **Verify voice.** Forbidden words: "game-changer", "supercharge", "AI-powered", "revolutionary". No rocket / 100 / fire emoji. Hashtag count ≤ 1.

6. **Output**:
   - Write the final post text to `${OUT_TXT}` — just the text, no markdown wrapper, no JSON, no preamble.
   - On stderr, print one line: `angle=<N> chars=<count> url=<repo URL>`.

## Format reminder

```
<line 1: skill name + one-line value>

<bullet 1>
<bullet 2>
[<bullet 3>]

<repo URL>
[<one hashtag>]
```

The blank lines are real — they render as paragraph breaks in X.

## Constraints

- ≤ 280 chars (URL counts as 23)
- Repo URL on its own line — X auto-renders a preview card
- Don't reveal local file paths
- Don't post if there is no repo URL — write `__NO_REPO__` to `${OUT_TXT}` and exit
- If `history.jsonl` shows `${SKILL}` was posted in the last 7 days → write `__SKIP_TOO_RECENT__` and exit
