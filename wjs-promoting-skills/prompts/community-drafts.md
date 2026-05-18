# Draft community posts for ${SKILL}

These are **drafts only** — 王建硕 reviews and copy-pastes them manually. Don't worry about API auth or auto-posting.

## Inputs (read these)

- `~/.claude/skills/${SKILL}/SKILL.md`
- `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md`
- The X post that was just sent (path: `${POSTED_X}`)
- `~/.claude/skills/wjs-promoting-skills/state/research.md`

## Task

Produce 4 markdown files in `${OUTBOX_DIR}` (provided in env):

### 1. `reddit-r-ClaudeAI.md`

Reddit r/ClaudeAI selfpost. Title + body. Constraints:
- Title ≤ 300 chars but aim for ≤ 80 — questions outperform statements
- Body ≥ 200 words, ≤ 800 words
- Structure:
  1. **Hook**: a specific problem you ran into (1–2 sentences)
  2. **Context**: setup, what you tried, why off-the-shelf failed (3–5 sentences)
  3. **The skill**: what it does, 2–3 concrete capabilities with code or commands
  4. **Open question**: invite discussion ("anyone else doing X differently?")
- Include the repo URL at the bottom
- **No marketing voice**. r/ClaudeAI mods nuke obvious self-promo.

### 2. `hn-show.md`

Show HN post. Title + body. Constraints:
- Title format: `Show HN: <skill name> – <one line value>` (≤ 80 chars total)
- Body ≤ 600 words
- Structure:
  1. What it does (1 paragraph)
  2. Why I built it (1 paragraph, personal incident)
  3. How it works (1–2 paragraphs, technical)
  4. What's open (license, what would benefit from feedback)
- License must be named (likely MIT per `~/code/claude-skills/LICENSE`)
- Repo URL in the body, not just the URL field

### 3. `discord-anthropic.md`

Short post for the Anthropic Discord #show-and-tell channel (or similar). Constraints:
- 2–4 sentences total
- Repo URL
- Tag what feedback you'd want, if any
- Conversational, not formal

### 4. `wechat-followup.md`

**Optional** — only generate if `${SKILL}` warrants a long-form Chinese 公众号 article (>1500 字 worth of material). If yes:
- 200 字 outline of the article
- 3 hook sentence options (in Chinese, 王建硕 style)
- Key sections to cover
- Whether it'd pair with screenshots / a demo video

If not, write `wechat-followup.md` with just: `这个 skill 不适合单独写一篇公众号文章。建议放进 "本月新 skill" 合集帖。`

## Voice constraints (all 4 files)

- 王建硕 voice: 实用、具体、不吹牛
- No "AI-powered", "game-changer", emoji火箭, 💯, 🔥
- Reddit + HN: technical, problem-first, demo > claim
- Discord: casual, one specific detail
- WeChat: 中文，作者口吻，不写营销稿

## Output

Write all 4 files. Print their paths. Don't modify anything outside `${OUTBOX_DIR}`.
