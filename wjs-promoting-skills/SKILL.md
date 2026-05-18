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

如果用户只想发**一次**（不要 cron），直接用 `/publish-skill <name>` —— 那是单条手动版。本 skill 的价值是**每天自动**。

## File Layout

```
~/.claude/skills/wjs-promoting-skills/
├── SKILL.md                                # 本文件
├── setup.sh                                # 一次性：装 launchd plist，启动 4 AM 定时
├── uninstall.sh                            # 一次性：卸 launchd plist
├── daily.sh                                # ★ 4 AM 入口：跑一遍完整流程
├── list-skills.sh                          # 列出当前所有 wjs-* skill
├── pick-next-skill.sh                      # 按轮换规则挑今日 skill
├── research-marketplaces.sh                # 研究 openclaw / clawhub / SkillsMP 的爆款怎么写文案（每月跑一次）
├── make-plan.sh                            # 给一个 skill 生成 marketing plan（30 天 angle rotation）
├── com.jianshuo.wjs-promoting-skills.plist.template
├── prompts/
│   ├── research-marketplaces.md            # 研究 prompt
│   ├── make-plan.md                        # marketing plan prompt
│   ├── daily-post.md                       # 今日 X 帖 prompt
│   └── community-drafts.md                 # Reddit / HN / Discord 草稿 prompt
├── state/                                  # 状态目录（.gitignored，不会被 publish hook 推到 GitHub）
│   ├── .gitignore
│   ├── README.md
│   ├── research.md                         # 最近一次 marketplace 研究的产物
│   ├── plans/<skill>.md                    # 每个 skill 的 30 天 angle rotation 计划
│   └── history.jsonl                       # 每次跑完追加一行：date / skill / tweet_id / status
└── outbox/                                 # 社区帖草稿（人工 review 后 copy-paste 出去）
    └── YYYY-MM-DD/
        ├── x-posted.txt                    # 实际发出去的 X 帖文本（archive）
        ├── reddit-r-ClaudeAI.md
        ├── hn-show.md
        ├── discord-anthropic.md
        └── wechat-followup.md              # （可选）下次写公众号文章时的角度参考
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

## Daily Flow (4 AM — what `daily.sh` does)

```
04:00 →
  Step 1: list-skills.sh        → 当前所有 wjs-* skill 的清单 + 各自上次推广时间
  Step 2: pick-next-skill.sh    → 按规则挑出今天的 skill（见 §Rotation Rules）
  Step 3: 检查跳过条件             → 7 天内推过 / SKILL.md 没动 / outbox 已有今日 → 直接 exit 0
  Step 4: make-plan.sh <skill>  → 如果该 skill 没有 plan 或 plan 老于 30 天，重新生成
  Step 5: claude -p 跑 daily-post.md
            └── 输入: SKILL.md + plan + research.md + history.jsonl 最近 30 天
            └── 输出: 一条 ≤ 280 char 的 X 文本（包含 repo URL）
  Step 6: xurl -X POST -d '{"text": "..."}' /2/tweets   ← 真发
  Step 7: claude -p 跑 community-drafts.md
            └── 输出: outbox/<date>/reddit-r-ClaudeAI.md / hn-show.md / discord-anthropic.md
  Step 8: 追加一行到 history.jsonl，并把发出去的 X 帖归档到 outbox/<date>/x-posted.txt
```

每周日跑完 daily 之后额外：
- `research-marketplaces.sh` 刷新一遍 `state/research.md`（看看 marketplaces 上当周爆款的写法变化）

每月 1 号跑完 daily 之后额外：
- 对所有 plan 老于 30 天的 skill 重跑 `make-plan.sh`（rotate angles）

## Rotation Rules (pick-next-skill.sh)

按优先级从高到低排：

1. **从没推过的 skill** —— 优先推，让新 skill 早点曝光
2. **最近 7 天内没推过的 skill** —— 在这些里挑 SKILL.md 最近**有修改**的（说明用户刚迭代过）
3. **其它** —— 在所有 skill 里挑「距离上次推广最久」的那个

如果所有 skill 都在 7 天内推过 → 当天跳过（避免变成噪音）。
如果所有 skill 都从没推过 → 按字母序挑第一个。

## X Post Format (daily-post.md output)

Constraints:
- ≤ 280 字符（X 算 URL 为 23 字符，预留 25）
- 第一行：skill name + 一句话价值
- 中间：2–3 个具体能力 / 此次更新的差异点
- 倒数第二行单独一行放 repo URL（X 自动 render preview card）
- 最多 1 个 hashtag（`#ClaudeCode` 或 `#ClaudeSkills`）
- **不许**：营销腔、火箭 emoji、`AI-powered`、`game-changer`、夸张词
- **必须**：用户的语气（参考 README.md 里 wjs-* skill 的文风：实用、具体、不吹牛）

Angle rotation（同一个 skill 多次推时不重复）：
- 角度 A：**它解决的具体问题**（"75 分钟 4K 多机位 60GB 重编码同步会让磁盘翻倍" 这种细节）
- 角度 B：**反直觉的设计决策**（"sidecar over re-encode" 这种）
- 角度 C：**串联工作流**（和其他 skill 一起跑出什么效果）
- 角度 D：**最近一次更新的差异**（如果 SKILL.md 自上次推广有改动，diff 出来重点讲新东西）

`make-plan.sh` 会把这四种角度排成 30 天的 rotation，每条都预写一个 hook 句。

## Community Drafts (community-drafts.md output)

不真发。落到 `outbox/<date>/`，人工 review 后 copy-paste：

- **`reddit-r-ClaudeAI.md`**：长文格式，开头一句钩子，正文讲场景 + 代码片段 + 链接，结尾问一个开放性问题（Reddit 喜欢 discussion 不喜欢 ad）。**Selfpost only**，绝不放纯链接帖
- **`hn-show.md`**：Show HN 格式，标题 `Show HN: <skill> – <one line value>`，正文 < 600 字，注明开源协议 + repo URL，**不要在 HN 卖东西**
- **`discord-anthropic.md`**：短贴，2–3 句话 + 链接，适合 #show-and-tell 频道
- **`wechat-followup.md`**（可选）：如果该 skill 适合写一篇公众号文章详细讲，给个 200 字大纲 + 几个 angle，下次用户写文章时直接用

如果用户当天太忙没 review，不会重发 —— 帖子就停留在 outbox 里，第二天会再生成新的（针对另一个 skill）。

## Manual Override

测试 / 调试用 —— 任何一步都能单独跑：

```bash
# 看看明天会推谁
~/.claude/skills/wjs-promoting-skills/pick-next-skill.sh

# 给某个 skill 强制生成 plan
~/.claude/skills/wjs-promoting-skills/make-plan.sh wjs-transcribing-audio

# 把今天的整个 flow 跑一遍但不发 X（dry-run）
DRY_RUN=1 ~/.claude/skills/wjs-promoting-skills/daily.sh

# 强制推某个 skill（绕过 rotation）
SKILL=wjs-segmenting-video ~/.claude/skills/wjs-promoting-skills/daily.sh

# 刷新 marketplace 研究
~/.claude/skills/wjs-promoting-skills/research-marketplaces.sh

# 看最近 7 天推过什么
tail -7 ~/.claude/skills/wjs-promoting-skills/state/history.jsonl | jq .
```

## Prerequisites

- `claude` CLI 在 `$PATH`，且 `claude -p "hello"` 能跑通（headless 模式）
- `xurl` 已装，`xurl whoami` 返回 `jianshuo`
- `jq` 已装（`brew install jq`）
- 公开仓库：每个 `wjs-*` skill 都有 GitHub repo，`git config --get remote.origin.url` 能拿到 URL。本仓库 `~/code/claude-skills` 已经满足
- macOS（用 `launchd` 调度；Linux 等价方案是 systemd timer，但本 skill 没实现）

## Anti-Patterns (绝对不做)

| 不做 | 原因 |
|---|---|
| 一天发多条 X | 7000 followers 不需要 timeline 刷屏。每天 1 条，质量 > 数量 |
| Reddit / HN 自动发帖 | 反垃圾审查极严，自动发 = 封号风险。Draft only |
| 套模板（emoji + 夸张词） | 用户的语气是「实用、具体、不吹牛」。模板腔是品牌污染 |
| 同一个 skill 7 天内重复推 | 即使角度不同，频率不对也会让 follower 取关 |
| 「为了发而发」—— SKILL.md 没动 7 天还要发 | 没新东西就不发。沉默比噪音好 |
| 调用 `claude` 时不设 `--bare` | 我们要的是确定性输出，不要 hooks / 自动 memory / CLAUDE.md 干扰 |
| 把 state/ 推到 GitHub | history.jsonl 包含发 X 的元数据（tweet_id 这些），不是公开内容 |

## What This Skill Is NOT

- **不是**「让 AI 替你运营账号」—— 每个帖子都基于你写过的 SKILL.md，AI 只是换角度提炼
- **不是**「跨平台 cross-poster」—— 只有 X 是真发，其它是 draft
- **不是**「fully autonomous」—— 你随时可以 uninstall.sh 停掉，或者 `DRY_RUN=1` 看下一次会发什么
- **不是**「替代 `/publish-skill`」—— 那个是单次手动版，这个是每日自动版，两者可以并存

## Done When

- [ ] `setup.sh` 跑成功，`launchctl list | grep wjs-promoting-skills` 能看到
- [ ] `state/research.md` 存在且 > 1KB（说明研究跑过）
- [ ] `DRY_RUN=1 daily.sh` 能完整跑通一遍且不发 X
- [ ] `outbox/<today>/` 里有 4 个 markdown draft
- [ ] `history.jsonl` 在真发当天有一行新记录

> Auto-publish: 本 skill 由 `~/.claude/skills-publish-hook.sh` 自动同步到 [github.com/jianshuo/claude-skills](https://github.com/jianshuo/claude-skills)（每次编辑后自动 commit + push）。`state/` 和 `outbox/` 通过本目录的 `.gitignore` + 子目录 `.gitignore` 一起被排除，不会跟 SKILL.md 一起推送。
