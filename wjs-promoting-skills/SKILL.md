---
name: wjs-promoting-skills
description: Use when the user wants to set up automated daily promotion / marketing for their Claude Code skills — researching how top skills are promoted on marketplaces (ClawHub / openclaw / SkillsMP / agentskills.io), generating a per-skill marketing plan, auto-posting to X (Twitter) via xurl, and drafting community discussion posts (Reddit / HN / Discord). Triggers — "推广 skills", "营销 skills", "自动发推广", "每天自动推广", "skill marketing", "promote my skills", "/wjs-promoting-skills".
---

# wjs-promoting-skills

每天早上 4:00 自动跑一遍：挑一个 `wjs-*` skill → 生成今日推广角度 → 发到 X → 起草社区帖。**X 真发，社区只起草到 outbox/ 让人工 review。**

## Core Principle

**Claude 是大脑，bash 是骨架。** 这个 skill 的所有判断（今天推哪个、怎么写、什么角度）都交给 `claude -p` 跑 headless 调用 —— bash 只负责定时、传 context、写日志、防重发。这样新增 skill / 新增渠道 / 改风格不需要改代码，只改 prompt 模板。

**真发只有一个渠道：X。** Reddit / HN / Discord 都没有可靠的「按用户身份自动发帖」API（要么需要 OAuth + 反垃圾审查，要么完全没接口）。所以这个 skill 把社区帖只**起草到 `outbox/<date>/`**，等人工 copy-paste。

**Idempotent + 节流。** 每天最多 1 条 X 帖。同一 skill 不在 7 天内重复推。如果 SKILL.md 自上次推广后没改、且过去 7 天没变化，跳过当天。这避免变成一个吵闹的机器人。

## When This Skill Fires

- 用户说「帮我推广这些 skills」/「设置每天自动发推广」/「研究一下别人怎么推广 skill 的」
- 用户用 `/wjs-promoting-skills` 显式调用
- 用户问「今天准备推哪个 skill」/「outbox 里有什么」

如果用户只想发**一次**（不要 cron），直接用 `/publish-skill <name>` —— 那是单条手动版。本 skill 的价値是**每天自动**。

## File Layout

```
~/.claude/skills/wjs-promoting-skills/
├── SKILL.md
├── setup.sh
├── uninstall.sh
├── daily.sh
├── list-skills.sh
├── pick-next-skill.sh
├── research-marketplaces.sh
├── make-plan.sh
├── com.jianshuo.wjs-promoting-skills.plist.template
├── prompts/
│   ├── research-marketplaces.md
│   ├── make-plan.md
│   ├── daily-post.md
│   └── community-drafts.md
├── state/
│   ├── .gitignore
│   ├── README.md
│   ├── research.md
│   ├── plans/<skill>.md
│   └── history.jsonl
└── outbox/
    └── YYYY-MM-DD/
        ├── x-posted.txt
        ├── reddit-r-ClaudeAI.md
        ├── hn-show.md
        ├── discord-anthropic.md
        └── wechat-followup.md
```

## Setup (one-time)

```bash
~/.claude/skills/wjs-promoting-skills/setup.sh
```

会做三件事：
1. 检查前置依赖：`claude` CLI、`xurl`（且 `xurl whoami` 能返回用户）、`jq`
2. 跑一次 `research-marketplaces.sh` 生成初始 `state/research.md`（**只此一次会真上网调研**，下次每月自动刷新一次）
3. 把 `com.jianshuo.wjs-promoting-skills.plist.template` 渲染成真正的 plist 放到 `~/Library/LaunchAgents/`，然后 `launchctl bootstrap`

跑完之后每天 04:00 自动触发，不需要任何手动操作。

要停止：`~/.claude/skills/wjs-promoting-skills/uninstall.sh`

## Daily Flow (4 AM)

```
04:00 →
  Step 1: list-skills.sh        → 当前所有 wjs-* skill 的清单 + 各自上次推广时间
  Step 2: pick-next-skill.sh    → 按规则挑出今天的 skill
  Step 3: 检查跳过条件         → 7 天内推过 / SKILL.md 没动 / outbox 已有今日 → 直接 exit 0
  Step 4: make-plan.sh <skill>  → 如果该 skill 没有 plan 或 plan 老于 30 天，重新生成
  Step 5: claude -p 跑 daily-post.md
  Step 6: xurl -X POST ← 真发
  Step 7: claude -p 跑 community-drafts.md → outbox/<date>/
  Step 8: 追加一行到 history.jsonl
```

## Rotation Rules

1. 从没推过的 skill —— 优先推
2. 最近 7 天内没推过的 skill，在这些里挑 SKILL.md 最近**有修改**的
3. 其它 —— 在所有 skill 里挑「距离上次推广最久」的那个
4. 所有 skill 都在 7 天内推过 → 当天跳过

## X Post Format

- ≤ 280 字符（X 算 URL 为 23 字符）
- 第一行：skill name + 一句话价値
- 中间：2–3 个具体能力 / 此次更新的差异点
- 倒数第二行单独一行放 repo URL（X 自动 render preview card）
- 最多 1 个 hashtag（`#ClaudeCode` 或 `#ClaudeSkills`）
- **不许**：营销腔、火箭 emoji、`AI-powered`、`game-changer`

## Anti-Patterns

| 不做 | 原因 |
|---|---|
| 一天发多条 X | 7000 followers 不需要 timeline 刷屏。每天 1 条，质量 > 数量 |
| Reddit / HN 自动发帖 | 反垃圾审查极严，自动发 = 封号风险。Draft only |
| 套模板（emoji + 夸张词） | 用户的语气是「实用、具体、不吹牛」。模板腔是品牌污染 |
| 同一个 skill 7 天内重复推 | 即使角度不同，频率不对也会让 follower 取关 |
| SKILL.md 没动 7 天还要发 | 没新东西就不发。沉默比噪音好 |
