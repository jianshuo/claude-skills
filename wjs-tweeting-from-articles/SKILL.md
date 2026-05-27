---
name: wjs-tweeting-from-articles
description: Use when the user wants to post a daily X/Twitter tweet inspired by one of their recently-published 微信公众号 articles. Picks the newest article that hasn't been tweeted yet, drafts 3 tweet candidates from it (different angles — quote / metaphor / one-liner), posts the chosen one via xurl, records to history. Triggers — "每天发一个 tweet", "从文章里发推", "今天的 tweet", "/wjs-tweeting-from-articles".
---

# wjs-tweeting-from-articles

每天一条 X tweet，灵感**直接从最近发的公众号文章**里抠。文章是源头，tweet 是更短的萃取。

## Core Principle

**文章已经过了一轮王建硕式的精炼，tweet 只是再短一格的版本。** 不要重新构思——从 article.md 里直接抠最 quotable 的一句 / 一段，按 X 的节奏切。

**一天最多一条，一篇文章只推一次。** 状态文件 `state/history.jsonl` 记录哪些 article 已经推过；不重复。（**例外:批量排期模式**——一次把多篇排进队列、按每 N 小时一条自动发,见下文。）

**真发，不暂存。** 用户确认后立刻 `xurl POST`。失败原文 dump 给用户重试。

## When This Skill Fires

- 用户说「今天的 tweet」/「发一条 X」/「从文章里发推」
- 用户跑 `/wjs-tweeting-from-articles`
- 用户设了 `/schedule daily /wjs-tweeting-from-articles` 之后每天自动调

## When NOT to use

- 用户要发的内容**和最近的公众号文章无关**——直接 `xurl POST /2/tweets` 即可
- 用户要发的是产品 / skill 推广——用 `/publish-skill` 或 `/wjs-promoting-skills`

## Workflow

### Step 1: 挑今天要推的文章

```bash
scripts/pick-next-article.sh
```

输出最新一篇**还没推过**的文章的 folder 路径（最近一周内，按日期倒序找第一个未推的）。已经全推完 → 退出 0、空输出，告诉用户「最近 7 天的文章都推过了，今天 rest day」。

如果用户想推**特定**那一篇：跳过此脚本，直接用 `<folder>`。

### Step 2: 读文章 + 草拟 3 条 tweet 候选

读 `<folder>/article.md`，按下面**三个角度**各起草一条：

| 角度 | 选材 | 例子 |
|------|------|------|
| **A · 金句** | 从文中挑一句最 quotable 的，可以加一句铺垫 | "笔头钝了，写不出锋——蘸点墨，在砚台上转两圈，重新有了尖。" |
| **B · 比喻** | 文章的核心比喻 + 一句把比喻落到读者头上 | "写 prompt 跟画画一样，是手感活儿。每天都得写点。" |
| **C · 反差** | 「不是 X，是 Y」式的认知翻转 | "不是变聪明，是手感来了。" |

**长度硬约束**：tweet ≤ **280 字符**（X 限制；中文每字算 2）——所以中文 tweet 实际 ≤ **140 字**。**留 buffer 到 120 字以内**比较稳。

**风格**：保留王建硕语气——平实、家常比喻、不写营销腔。**不要**加 hashtags、不要加 @、不要加 emoji（除非原文有）。**不要**加 mp.weixin 链接（默认）；如果用户问要不要带链接，提示可以 reply 里附。

### Step 3: 让用户挑一条

用 `AskUserQuestion` 给出 A/B/C 三条候选 + 「四选其他」。用户选一条之后进入 Step 4。

### Step 4: 真发 X

```bash
TWEET_TEXT='<picked text>'
JSON=$(jq -nc --arg text "$TWEET_TEXT" '{text:$text}')
resp=$(xurl -X POST -d "$JSON" /2/tweets)
# Don't use `jq -r '.data.id'` here — X API returns raw newlines in the echoed
# `text` field, which strict jq rejects with "control characters must be escaped".
# Grep the id directly instead.
TWEET_ID=$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')
[[ -n "$TWEET_ID" ]] || { echo "POST failed: $resp"; exit 1; }
echo "https://x.com/jianshuo/status/$TWEET_ID"
```

成功 → 拿到 tweet_id + URL，告诉用户。

### Step 5: 记录到 history

```bash
HIST="$HOME/.claude/skills/wjs-tweeting-from-articles/state/history.jsonl"
SLUG=$(basename "$FOLDER")
jq -nc --arg date "$(date +%F)" --arg slug "$SLUG" --arg angle "$ANGLE" \
       --arg tweet_id "$TWEET_ID" --arg text "$TWEET_TEXT" \
       '{date:$date,slug:$slug,angle:$angle,tweet_id:$tweet_id,text:$text,status:"posted"}' \
  >> "$HIST"
```

`angle` ∈ `A` / `B` / `C` / `other`。

### Step 6: 收尾

告诉用户：
- tweet URL
- 哪篇文章（slug）
- 哪个 angle
- 今天的 history 行已经写入

## Inputs

```
/wjs-tweeting-from-articles                       # 自动挑最近一篇没推过的
/wjs-tweeting-from-articles <article-folder>      # 显式指定
/wjs-tweeting-from-articles --dry-run             # 草稿不发
```

## File Layout

```
~/.claude/skills/wjs-tweeting-from-articles/
├── SKILL.md
├── scripts/
│   ├── pick-next-article.sh        # 找最近一篇未推的 article folder
│   └── post-next-from-queue.sh     # 批量排期模式:每次发队列里下一条,自节流
└── state/
    ├── .gitignore              # 屏蔽 history.jsonl 不被推到 public repo
    ├── history.jsonl           # 每条 tweet 一行 JSON record
    ├── queue-<DATE>.tsv        # 批量模式:待发队列 idx/slug/text
    ├── queue-cursor            # 批量模式:下一条序号
    └── last-post-epoch         # 批量模式:上次发出的时间戳(节流用)
```

## 批量排期模式（多篇一次排，每 N 小时一条）

一次要发**很多篇**（典型来源：`wjs-mining-articles` 从一场长对谈挖出十几篇文章），用这个模式——一次连发会被 X 判刷屏，所以排成队列、按固定间隔自动发。

**为什么不用 `AskUserQuestion` 逐篇选 angle**：十几篇 × A/B/C 太多。每篇直接抠**一条**最 quotable 的(≤120 字、王建硕语气、无 hashtag/emoji/链接、带盘古之白)，列全文给用户一次过目 + 定节奏，确认后排期。

**机制**（`scripts/post-next-from-queue.sh` + 每小时 cron，脚本自己节流）：

```bash
# 1. 队列文件:state/queue-<DATE>.tsv,每行  idx<TAB>slug<TAB>text
# 2. cursor: state/queue-cursor(下一条序号);last-post-epoch(上次发的时间)
# 3. 立刻发第一条(FORCE 绕过节流,顺便验证 xurl 能发):
FORCE=1 bash scripts/post-next-from-queue.sh
# 4. 装 cron:每小时跑,脚本只在距上次 ≥ MIN_GAP(默认 4h)才真发:
( crontab -l 2>/dev/null | grep -v post-next-from-queue.sh; \
  echo "5 * * * * /bin/bash $HOME/.claude/skills/wjs-tweeting-from-articles/scripts/post-next-from-queue.sh >/dev/null 2>&1" ) | crontab -
```

脚本要点:单机锁(防并发)、发失败不推进 cursor(下小时重试)、发成功才写 `history.jsonl` 并推进、**队列发完自动删掉自己的 cron 行**。改间隔用 `MIN_GAP`(秒)。

## Daily 自动化（可选）

要每天自动跑：

```bash
/schedule daily 09:00 /wjs-tweeting-from-articles
```

或写 cron。但**默认不**自动跑——每天人工确认 angle 选哪条更稳。

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 加 hashtags（#AI #prompt） | 王建硕的 X 风格不用 hashtag，加了变营销腔 |
| 同一篇文章推两条 | 一篇一推；如果文章特别长 / 多核心，下次跑时把它从 history 删一行重推 |
| tweet 里塞 mp.weixin 链接 | 默认不带；想带就放 reply 里 |
| 把 3 条候选都发出去 | 用户挑 1 条；不挑 = 跳过今天 |
| 凭空生造一条不在文章里的 tweet | 灵感**必须**从 article.md 抠；这条 skill 的价值就是「文章是源」 |
| LLM 自己改原文风格做"提炼" | 王建硕原文已经够紧；直接抠 > 重写 |

## Dependencies

- **xurl**：`xurl whoami` 能返回用户名（auth OK）
- **jq**：解析 xurl 返回的 JSON
- **存在 `~/code/wechat-publish/articles/YYYY-MM-DD-*/article.md`**：源文章
