# Make 30-day marketing plan for ${SKILL}

## Inputs (read these first)

- `~/.claude/skills/${SKILL}/SKILL.md`
- `~/.claude/skills/${SKILL}/README.md` (if exists)
- `~/code/claude-skills/README.md`
- `~/.claude/skills/wjs-promoting-skills/state/research.md`

## Task

Generate `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md` with **8 distinct X-post angles**.

Required structure: name, generated date, repo URL, one-line value, target audience, then 8 angles each with: hook, 2-3 body bullets, CTA URL. Rotation order: 1, 2, 3, 5, 7, 4, 6, then 8 if SKILL.md changed.

Angles:
1. The specific problem it solves (real number/detail from SKILL.md)
2. The counter-intuitive design decision ("X over Y")
3. Workflow chain (pairs with another skill)
4. Tiny demo / before-after
5. Origin story / why I built this
6. A surprising failure mode and how it handles it
7. For Chinese-speaking creators specifically (post in Chinese, ≤ 140 chars)
8. What's new since last version (placeholder; only runs if SKILL.md changed)

## Voice constraints

- 王建硕's tone: 实用、具体、不吹牛
- No emoji except occasionally ✓ or →
- No "game-changer", "AI-powered", "supercharge"
- One hashtag max: #ClaudeCode or #ClaudeSkills
- ≤ 280 chars; X counts URL as 23 chars

## Constraints

- Read SKILL.md first. Every angle must reference a specific detail.
- No invented features.
- Repo URL must be real (run the git command).
- One file only: `state/plans/${SKILL}.md`.
