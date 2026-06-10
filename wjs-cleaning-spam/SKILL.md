---
name: wjs-cleaning-spam
description: Use when the user complains about spam on his X/Twitter posts — 同城面付 / 寻固炮 / 线下上门 / 免费破处 这类引流号在他推文下刷的 emoji 垃圾回复 — and wants them removed. Covers the last 7 days (X recent-search window). Triggers — "把这些spam删掉", "清理X垃圾回复", "推文下面好多引流号", "clean spam replies", "/wjs-cleaning-spam".
---

# wjs-cleaning-spam

清理挂在王建硕推文下的同城引流 spam 回复：**隐藏回复 + 静音账号**。

## Core Principle

**别人的推文删不掉。** X 只给串主两个武器：hide reply（从评论区移除，访客不可见）和 mute（通知里不再出现）。**block 端点已被 X 从 API 下线**（v2 返回 code 34，v1.1 要更高访问级别），真要拉黑只能网页手动。「删掉spam」= 隐藏 + 静音，做到 API 上限。

**先 dry-run，人审 borderline，再 apply。** 启发式会把真人评论（"机器人🤖"、"저지능🤪"）和 spam 变体（"我在济源呀🌷" + 隐形字符）分错边。flagged 直接处理，borderline 必须 Claude 逐条看。

## Workflow

```bash
# 1. dry-run：输出 flagged + borderline 两个名单（JSON）
python3 ~/.claude/skills/wjs-cleaning-spam/scripts/clean_spam.py

# 2. Claude 逐条审 borderline：引流号特征 = 名字带 💕🌸♥ 装饰 / 同城话术 /
#    文本夹隐形字符（U+034F 等）/ 纯 emoji。真人评论（哪怕是骂人）不动。
#    把 borderline 里确认是 spam 的 id 并入名单。

# 3. apply：隐藏 + 静音（默认只处理 flagged；审完 borderline 用 --ids 指定全集）
python3 ~/.claude/skills/wjs-cleaning-spam/scripts/clean_spam.py --apply
python3 ~/.claude/skills/wjs-cleaning-spam/scripts/clean_spam.py --apply --ids id1,id2,...

# 4. 撞 429 限流（hide 约 50 次/15 分钟）脚本会自动停 —— 15 分钟后重跑同一条命令，
#    state/cleaned.jsonl 记录了已处理的 id，自动跳过、续跑。
```

向用户汇报：隐藏几条、失败几条（及原因）、静音几个号；提醒 block 需网页手动。

## 踩过的坑（2026-06-10 实战）

| 坑 | 现实 |
|----|------|
| raw 查询 401 Unauthorized | query 参数里的 `:` 必须 URL 编码（`to%3Ajianshuo`），不是 auth 问题，别去换 oauth1/oauth2 |
| `xurl block` 报 code 34 | block 端点已从 X API 移除（v2/v1.1 都不行），用 mute 替代，别反复试 |
| hide 报 "Invalid Request" | 该回复所在会话的根推文不是用户的（用户只是参与别人的串），串主才有权隐藏——记为 hide-failed，账号照样静音 |
| hide 报 429 | 限流约 50 次/15 分钟，等窗口刷新重跑脚本即可（状态文件保证幂等） |
| 纯文本 spam 漏网 | "我在济源呀" 这类同城话术靠隐形字符（U+034F/零宽符）混过滤器——脚本已检测，新变体出现时把特征加进 `NAME_KW` / `INVISIBLE` |
| 误伤真人 | emoji 启发式会扫进真人短评——这就是 borderline 名单存在的原因，必须人审 |

## When NOT to use

- spam 超过 7 天：recent-search 接口只覆盖 7 天，更早的要用网页手动
- 用户要删**自己发的**推文：直接 `xurl delete POST_ID`
- 用户要拉黑某个具体账号：API 做不到，告诉他网页操作（账号主页 ⋯ → Block）

## State

`state/cleaned.jsonl` — 每条处理过的回复一行（id / author / status）。重跑跳过已处理；想重头来删掉此文件。
