---
name: wjs-publishing-books-to-x
description: Use when 王建硕 wants to publish his VoiceDrop books (voicedrop.cn/books) to X/Twitter as threads — 列出他写的书、挑没发过的、整本拆成推文串发出。Triggers — "把书发到 X", "发书的 thread", "publish my book to X", "书架的书发推", "/wjs-publishing-books-to-x".
---

# wjs-publishing-books-to-x

把 VoiceDrop 书架上**我写的书**，一本一个 thread 发到 X。首条钩子 + 封面图，中间按书的脉络走，**最后一条讲这本书是怎么用 VoiceDrop 写出来的**。

## Core Principle

**一本书 = 一个 thread。** 书已经是成品，thread 是它的预告片——从章节梗概和正文里**抠**最硬的内容，不重新构思、不写营销腔。

**只发我的书。** 书架是社区书架，上面有别的用户写的书，发出去就是替别人代言，绝对不行。

## Workflow

### Step 1: 列我的书，排除已发过的

```
mcp__voicedrop__list_books   # 公开书架，免登录
```

- hidden 的书（book.json 里 `hidden: true`）服务端已滤掉，**不用再处理**。
- **我的书判定**：`author == "王建硕"` **或为空**（早期的书没署名，都是我的）→ 是我的。其他署名（蜜蜡 / Dennis / sissi / …）→ 别人的书，**不发**。
- 对照 `state/history.jsonl` 排除已发过的，列出剩余清单让用户挑。用户点名某本 → 直接用那本。

### Step 2: 读书

```
mcp__voicedrop__read_book <slug>            # 目录 + 每章梗概 + 一句话简介
mcp__voicedrop__read_book_chapter <slug> intro   # 序章；再挑 1-2 个最有料的章读正文
```

梗概给骨架，正文给 quotable 的细节（数字、比喻、反直觉的断言）。

### Step 3: 拆 thread（结构合同）

| 条 | 内容 |
|----|------|
| 1 | 钩子：书的核心断言或问题 + 书名，**配封面图** `https://voicedrop.cn/books/<slug>/cover.jpg` |
| 2 … N-2 | 按书的脉络每条讲透一个点，从梗概/正文里抠。总共 6–10 条 |
| N-1 | 全书免费读：`https://voicedrop.cn/books/<slug>/` |
| N（必须） | 这本书怎么写的：真实过程——在 VoiceDrop 丢了一句什么中心思想（seed），书自己长出来、逐章补齐、不满意的地方一句话修书。落 voicedrop.cn |

**硬约束**：每条加权 ≤280（中文每字算 2），**buffer 到 ~120 汉字**。王建硕语气：平实、家常比喻。无 hashtag、无 emoji、无 @。链接只出现在 N-1 和 N 两条。盘古之白。

### Step 4: 过目

整串列给用户确认（每条标序号 + 字数）。用户说过 `--yes` 或明确「直接发」才跳过。

### Step 5: 发（xurl 链式）

```bash
SLUG=<slug>
curl -s -o /tmp/cover.jpg "https://voicedrop.cn/books/$SLUG/cover.jpg"
MEDIA_ID=$(xurl media upload --category tweet_image --media-type image/jpeg /tmp/cover.jpg \
  | grep -oE '"media_id_string":"[0-9]+"' | grep -oE '[0-9]+')
# 注意：不带 --category tweet_image 会按视频处理，media id 无效

# 首条（带图）
resp=$(xurl -X POST -d "$(jq -nc --arg t "$T1" --arg m "$MEDIA_ID" \
  '{text:$t, media:{media_ids:[$m]}}')" /2/tweets)
# X 返回的 text 里有裸换行，jq 会拒；grep 抠 id
PREV=$(printf '%s' "$resp" | grep -oE '"id":"[0-9]+"' | head -1 | grep -oE '[0-9]+')
[[ -n "$PREV" ]] || { echo "POST failed: $resp"; exit 1; }

# 2…N 条依次 reply 上一条，条间 sleep 5
resp=$(xurl -X POST -d "$(jq -nc --arg t "$TN" --arg r "$PREV" \
  '{text:$t, reply:{in_reply_to_tweet_id:$r}}')" /2/tweets)
```

任何一条失败：**停在原地**，把已发到第几条 + 失败原文给用户，别跳条继续（断链）。首条 URL：`https://x.com/jianshuo/status/<首条id>`。

### Step 6: 记录

```bash
jq -nc --arg date "$(date +%F)" --arg slug "$SLUG" --arg id "$FIRST_ID" --argjson n $N \
  '{date:$date,slug:$slug,thread_first_id:$id,tweets:$n,status:"posted"}' \
  >> ~/.claude/skills/wjs-publishing-books-to-x/state/history.jsonl
```

收尾告诉用户：thread URL、哪本书、几条、还剩几本没发。

## 多本连发

一次 session 默认发**一本**。用户要「把书都发了」→ 每本间隔 ≥4 小时排期（一口气连发多个 thread 会被 X 判刷屏），机制照抄 `wjs-tweeting-from-articles` 的批量排期模式（队列 + cron 自节流）。

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 发署名是别人的书 | 社区用户的书，不是我的 |
| thread 写成目录（第一章讲X，第二章讲Y…） | 要抠内容，不是报菜名 |
| 每条都塞链接 | 链接只在 N-1、N 两条 |
| 最后一条写成 VoiceDrop 广告词 | 讲**这本书**的真实写作过程，产品是顺带的 |
| `jq -r '.data.id'` 解析发推返回 | 返回的 text 带裸换行，jq 报 control characters；用 grep |
| media upload 不带 --category | 默认按视频处理，图挂不上 |

## File Layout

```
~/.claude/skills/wjs-publishing-books-to-x/
├── SKILL.md
└── state/
    ├── .gitignore        # history.jsonl 不进公开 repo
    └── history.jsonl     # 每发一本记一行
```

## Dependencies

- **xurl**：`xurl whoami` 能返回用户名
- **voicedrop MCP**：list_books / read_book / read_book_chapter（公开内容，免登录）
- **jq**
