# Make 30-day marketing plan for ${SKILL}

You're writing a 30-day rotation plan for promoting **${SKILL}** on X.

## Inputs (read these first)

- `~/.claude/skills/${SKILL}/SKILL.md` — the skill itself
- `~/.claude/skills/${SKILL}/README.md` (if exists)
- `~/code/claude-skills/README.md` — overall portfolio + style reference
- `~/.claude/skills/wjs-promoting-skills/state/research.md` — current marketplace research

## Task

Generate `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md` with **8 distinct X-post angles** (we'll rotate through them when it's this skill's turn — at ~1 post/week per skill, 8 angles = ~2 months coverage).

## Required structure

```markdown
# Marketing plan: ${SKILL}
Generated: <YYYY-MM-DD>
Repo URL: <auto-resolve from `git -C ~/.claude/skills/${SKILL} config --get remote.origin.url`, normalized to https://>

## One-line value
<the single sentence that, if a stranger reads only this, they get it>

## Target audience
<who specifically would install this — be specific. "Claude Code users" is not enough.>

## 8 angles

### Angle 1 — The specific problem it solves
Hook: <one provocative sentence; mention a real number/detail from the SKILL.md>
Body bullets (2–3):
  - <concrete capability with detail>
  - <concrete capability with detail>
CTA URL: <repo URL>

### Angle 2 — The counter-intuitive design decision
Hook: <"X over Y" / "we don't do Z, because…">
Body bullets:
  - <the decision + reason>
  - <what it lets you skip>
CTA URL: <repo URL>

### Angle 3 — Workflow chain (pairs with another skill)
Hook: <"X → Y → Z in one command">
Body bullets:
  - <what the chain produces>
  - <how long it would take by hand>
CTA URL: <repo URL>

### Angle 4 — Tiny demo / before-after
Hook: <"Input: <one line>. Output: <one line>.">
Body bullets:
  - <the magic step in the middle>
  - <one constraint that makes it non-trivial>
CTA URL: <repo URL>

### Angle 5 — Origin story / why I built this
Hook: <one-line incident from real life — "Last month I had X problem">
Body bullets:
  - <what existing tools failed at>
  - <what this fixes>
CTA URL: <repo URL>

### Angle 6 — A surprising failure mode and how it handles it
Hook: <"It would be easy to assume X, but actually Y">
Body bullets:
  - <the edge case>
  - <how the skill handles it>
CTA URL: <repo URL>

### Angle 7 — For Chinese-speaking creators specifically
Hook: <Chinese hook line — "做中文创作者需要 X">
Body bullets in Chinese:
  - <what this gives Chinese creators that English-first tools miss>
CTA URL: <repo URL>
Note: This angle posts in Chinese. Keep ≤ 140 Chinese chars (~280 weighted).

### Angle 8 — What's new since last version (placeholder for diff posts)
Hook: <"Just shipped: X" — to be filled at post time based on recent SKILL.md diff>
Body bullets: TO-FILL-AT-POST-TIME
CTA URL: <repo URL>
Note: This angle only runs if SKILL.md changed since the last time this skill was posted.

## Rotation order
1, 2, 3, 5, 7, 4, 6, then 8 if SKILL.md changed; otherwise back to 1.

## Voice constraints (apply to all angles)
- 王建硕's tone: 实用、具体、不吹牛
- No emoji except occasionally ✓ or →
- No marketing voice: avoid "game-changer", "AI-powered", "supercharge"
- One hashtag max: #ClaudeCode or #ClaudeSkills
- ≤ 280 chars; X counts URL as 23 chars; reserve 25 for URL+space
```

## Constraints

- **Read the SKILL.md first.** Don't write generic angles — every angle must reference a specific detail.
- **No invented features.** If the SKILL.md doesn't say it, don't claim it.
- **Repo URL must be real.** Run the git command. If the skill is not in a git repo, write `repo_url: null` and note "needs repo wiring" prominently.
- **One file only.** Output to `state/plans/${SKILL}.md`. Don't touch anything else.
- **Output language**: Same as the SKILL.md primary language (王建硕的 skill 通常英文 description + 中文 body — angles 跟着这个混合)。
