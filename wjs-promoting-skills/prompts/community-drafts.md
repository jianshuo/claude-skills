# Draft community posts for ${SKILL}

Drafts only — 王建硕 reviews and copy-pastes manually.

## Inputs

- `~/.claude/skills/${SKILL}/SKILL.md`
- `~/.claude/skills/wjs-promoting-skills/state/plans/${SKILL}.md`
- The X post that was just sent: `${POSTED_X}`
- `~/.claude/skills/wjs-promoting-skills/state/research.md`

## Task: produce 4 markdown files in `${OUTBOX_DIR}`

### 1. `reddit-r-ClaudeAI.md`
Selfpost. Title ≤ 80 chars (question form). Body 200-800 words: hook → context → skill capabilities → open question. Repo URL at bottom. No marketing voice.

### 2. `hn-show.md`
Show HN. Title: `Show HN: <skill> – <one line value>` (≤ 80 chars). Body ≤ 600 words: what it does → why I built it → how it works → what's open. Name the license. Repo URL in body.

### 3. `discord-anthropic.md`
2-4 sentences. Repo URL. Tag what feedback you'd want. Conversational.

### 4. `wechat-followup.md`
Only if `${SKILL}` warrants a long-form Chinese 公众号 article (>1500 字 of material): 200 字 outline + 3 hook options + key sections. Otherwise write: `这个 skill 不适合单独写一篇公众号文章。建议放进 "本月新 skill" 合集帖。`

## Voice: 实用、具体、不吹牛. No "AI-powered", "game-changer". WeChat in Chinese.

Write all 4 files. Don't modify anything outside `${OUTBOX_DIR}`.
