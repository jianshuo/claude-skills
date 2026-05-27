---
name: wjs-x-improving-content
description: Use when 王建硕 wants to systematically improve his X (Twitter) content by iterating on the content-generation prompt (prompts/x/prompt.md, used by the every-6h tweet Action) and finding which prompt version produces the highest-reach tweets. Each prompt edit is a git-SHA-versioned, numbered experiment with a hypothesis; tweets are attributed to the version live at post time and judged on median impressions per tweet. Also mines per-tweet impression data for content-feature signals (angle / length / topic) that feed the next prompt edit. North-star = impressions per tweet. Triggers — "改 X 的 prompt", "X 内容改进", "哪版 prompt 最好", "什么内容 impression 高", "improve my tweets", "A/B test the X prompt", "/wjs-x-improving-content".
---

# wjs-x-improving-content

把「写好推」当工程做：**不断改 `prompts/x/prompt.md`，用 impression 数据看哪版最好**，并挖出「什么内容特征和高 impression 相关」反哺下一版。是 [[wjs-x-increasing-follower]] 的孪生——那个测 profile→关注转化率，这个测 **prompt→每条推的 impression**。

## Core Principle

**impression 主要由源文章 / 话题决定，prompt 只是二阶因素。** 一篇好文章配任何 prompt 都能爆。所以诚实地分两层看：

| 看什么 | 信号强度 | 怎么用 |
|---|---|---|
| **prompt 版本对比**（哪版 prompt 的推中位 impression 高） | 弱（被文章支配，需大量样本） | 方向性参考，攒够样本才下判决 |
| **内容特征**（angle A/B/C、长度、钩子——prompt 直接控制的东西） | 较强（同样话题下，特征差异才显出 prompt 的手艺） | **真正反哺 prompt 的依据** |

**所以：版本对比给方向，内容特征给抓手。** 别把版本判决当因果。

**判决用中位数不用均值**（impression 极度长尾，一条爆款骗死均值）；**每版至少 5 条成熟推**才下版本级判决；**成熟窗 = 发布满 3 天**（impression 还在涨的太新推不计入）。

**回滚是一等公民**：prompt 在 git 里，回滚 = `git checkout <旧SHA> -- prompts/x/prompt.md`。

## 版本 = prompt.md 的 git short-SHA

每条推归到哪版 prompt，**按时间推导**：推发布时间 T → `prompts/x/prompt.md` git 历史里时间 ≤ T 的最后一次提交 = 那条推用的版本。**不用改 Action**，历史推也能回填。早于 prompt 文件存在的推 → `prompt_sha=null`（pre-prompt）。

## 数据从哪来

每条推的 impression **X API 不稳**，靠 **Content CSV 导出**：`x.com/i/account_analytics` → **Content** 标签 → 导出 CSV（含 Post id / Impressions / Engagements …）→ 丢进 `inbox/`。`Post id` 就是 `tweet_id`，和发推历史对得上。

## When This Skill Fires

- 「改 X 的 prompt」「哪版 prompt 最好」「什么内容 impression 高」「X 内容改进」
- 跑 `/wjs-x-improving-content`

## When NOT to use

- 涨粉 / 改 profile → [[wjs-x-increasing-follower]]
- 只是发一条推 → `/wjs-tweeting-from-articles`
- 推广 skill → `/wjs-promoting-skills`

---

## Workflow

脚本在 `scripts/`，状态在 `state/`。先 `cd` 到 skill 目录。

### Step 1 — 吃数据

```bash
python3 scripts/ingest-tweets.py /path/to/content.csv
```

join Content CSV + 发推历史（`~/.claude/skills/wjs-tweeting-from-articles/state/history.jsonl`，带 slug/angle）→ `state/tweets.jsonl`，按日期推导 `prompt_sha`，算 `char_len` 和 `mature`(≥3天)。upsert，重跑更长导出安全。

### Step 2 — 挖内容特征（核心，立刻有用）

```bash
python3 scripts/analyze-content.py          # 成熟推
python3 scripts/analyze-content.py --all     # 含未成熟（angle 样本更全）
```

按 angle / 长度 / 来源拆 impression 中位数 + 互动率，列最高/最低推。**这层告诉你 prompt 该往哪改。**

### Step 3 — 提一版 prompt 改动（带假设）

据 Step 2 的信号，对 `prompts/x/prompt.md` 做**一个可证伪的改动**（例：「偏短句」「在拿不准时优先选金句 angle」）。改完 commit：

```bash
cd ~/code/wechat-publish
# 编辑 prompts/x/prompt.md ...
git add prompts/x/prompt.md && git commit -m "x prompt: <一句话改了啥>"
NEW_SHA=$(git log -1 --format=%h -- prompts/x/prompt.md)
```

登记成编号实验：

```bash
python3 ~/.claude/skills/wjs-x-improving-content/scripts/ledger.py register "$NEW_SHA" \
  --hypothesis "短句比长句 impression 高，prompt 收紧到 80 字以内"
```

之后每 6h 的 Action 自动用新版生成推。**一次只改一处**，否则分不清哪个改动起的作用。

### Step 4 — 攒够样本后判决

```bash
python3 scripts/evaluate.py     # 各版本中位 impression + 相邻版本 Δ% 判决
```

`Δ ≥ +10%` → **keep**；`Δ ≤ -10%` → **rollback**；之间 → **flat**。样本不足（<5 条成熟推）显示 measuring。

- keep：`ledger.py keep <SHA> --note "短句 +18%"`
- rollback（先问王建硕）：
  ```bash
  git -C ~/code/wechat-publish checkout <旧SHA> -- prompts/x/prompt.md
  git -C ~/code/wechat-publish commit -m "x prompt: rollback to <旧SHA>"
  ```
  再 `ledger.py rollback <SHA> --note "短句反而掉了"`

### Step 5 — 看板

```bash
python3 scripts/scoreboard.py    # 写并打印 state/SCOREBOARD.md
```

现状 + 版本排行榜 + 内容特征（angle）+ to-do。给王建硕看就发这个。

---

## 数据模型（state/）

- `tweets.jsonl` —— 一推一行：`{tweet_id, date, impressions, engagements, likes, replies, reposts, new_follows, char_len, text, slug, angle, source(bot|manual), prompt_sha, age_days, mature}`
- `versions.jsonl` —— 一 prompt 版本一行：`{id, prompt_sha, hypothesis, registered, status(active|kept|rolled_back), verdict, notes}`
- `SCOREBOARD.md` —— 生成物

## 默认参数（要改传 flag / 改 _common.py）

- 成熟窗 `MATURITY_DAYS=3`
- 版本判决最少样本 `MIN_TWEETS_PER_VERSION=5`
- keep/rollback 阈值 `--threshold 0.10`
- 回滚 prompt **永远先问**

## 路径假设（_common.py 顶部，换机器改这里）

- 发推历史：`~/.claude/skills/wjs-tweeting-from-articles/state/history.jsonl`
- prompt 文件：`~/code/wechat-publish/prompts/x/prompt.md`
