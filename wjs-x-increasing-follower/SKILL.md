---
name: wjs-x-increasing-follower
description: Use when 王建硕 wants to systematically grow his X (Twitter) followers by running numbered, A/B-testable growth experiments and tracking which ones actually work. Every action gets a number, a hypothesis, a target metric, a before-state (for rollback), and a verdict. The North-Star metric is the new-follower ÷ profile-visit ratio (conversion) — every profile change is judged against it. Daily it ingests the X Analytics CSV export, scores each running experiment, and recommends keep / rollback. Triggers — "涨粉", "增加 X 粉丝", "X 涨粉实验", "follower growth", "A/B test my profile", "今天的涨粉检查", "/wjs-x-increasing-follower".
---

# wjs-x-increasing-follower

把「涨粉」当工程做：**每个改动是一个带编号的实验**，有假设、有目标指标、有 before（可回滚）、有判决。不靠感觉，靠数。

## Core Principle

**单账号没法做平行 A/B —— 只能做时间轴上的前后对比。** 所以唯一可信的北极星指标是 **转化率 = 新增关注 ÷ 主页访问（ratio）**：它对爆款流量免疫。一条推爆了带来一堆访问，ratio 不一定动；但 bio 改好了，每个来访的人更愿意关注，ratio 一定动。

**所以指标分层（每个 action 必须声明自己被哪个指标考核）：**

| Action 类型 | 拨动的杠杆 | 用什么考核 |
|---|---|---|
| **profile**（bio / 名字 / 头像 / banner / 置顶 / URL / 地点） | 转化 | **ratio**（北极星，抗爆款） |
| **posting**（格式 / 钩子 / 频率 / thread vs 单条） | 触达 | profile visits + impressions（ratio 当护栏，别把转化拖垮） |
| **engagement**（回复 / 关注别人 / 互动） | 触达 | new follows + visits |
| **timing**（发布时间） | 触达 | profile visits |

**诚实护栏（写死在 evaluate.py 里）：** 用中位数不用均值（一天爆款骗不了判决）；够 7 天 / 够数据才下判决；同指标实验窗口重叠 → 打 `confounded` 标记；只给「方向性」结论，不号称因果。

**回滚是一等公民。** 每个 action 存了精确的 before 值，#N 永远能还原。判 ❌ rollback **先问王建硕，绝不静默改他的 bio**。

## 数据从哪来（关键约束）

ratio 这个数 **X API / xurl 拿不到** —— 只活在 Analytics 看板里。所以靠 **CSV 导出**：
打开 `x.com/i/account_analytics` → Overview → 右上角下载图标（7D/2W/4W/3M/1Y 想要哪段先选好）→ 导出 CSV → 丢进 `inbox/`（或直接给路径）。

## When This Skill Fires

- 王建硕说「涨粉」「搞个 X 涨粉实验」「A/B 测一下我的 profile」「今天的涨粉检查」
- 跑 `/wjs-x-increasing-follower`
- 设了 `/schedule daily /wjs-x-increasing-follower`（见末尾「每日检查」）

## When NOT to use

- 只是要发一条推 → `/wjs-tweeting-from-articles` 或直接 `xurl post`
- 推广 skill → `/wjs-promoting-skills` / `/publish-skill`
- 把文章分发到各平台 → `/wjs-syndicating-articles`

---

## Workflow

所有脚本在 `scripts/`，状态在 `state/`。先 `cd` 到 skill 目录。

### Step 1 — 吃数据（CSV → daily.jsonl）

```bash
python3 scripts/ingest-csv.py /path/to/export.csv
```

脚本模糊匹配列名（Profile visits / New follows / Impressions / Followers），按日期 upsert，自动算 ratio。**它会打印它认的列映射 —— 看一眼对不对**，不对就 `--visits-col "X" --follows-col "Y"`。重跑更长的导出会覆盖重叠的天，安全。

### Step 2 — 出 to-do（提实验）

看 `state/daily.jsonl` 现状，给王建硕一份**带编号的实验菜单**。每条必须有：`category` / `title` / `hypothesis` / `metric`。原则：

- **一次只让少数 profile 实验在跑**（同指标重叠会互相污染读数）。
- 假设要可证伪：「concrete 一行证明比模糊 tagline 转化高」✅；「让 bio 更好」❌。
- profile 类先于 posting 类 —— 转化是地基，先把来访的人接住，再去放大流量。

入账（自动分配编号，别手改 jsonl）：

```bash
python3 scripts/ledger.py add --category profile --metric ratio \
  --title "Bio: 开头一行放硬证明" \
  --hypothesis "访客看到具体成绩比看到口号更愿意关注"
```

实验菜单参考（按杠杆分）：
- **profile/ratio**：bio 重写（钩子前置 / 硬证明 / CTA「关注看 X」）、显示名加身份锚、头像换正脸高清、banner 放一句话价值主张、置顶换最强 thread、URL 指向落地页。
- **posting/visits**：发布格式（thread vs 单条）、首句钩子、带图 vs 纯文、话题聚焦。
- **engagement/follows**：固定回复某圈层、主动关注目标人群、参与热门话题。
- **timing/visits**：早 9 点 vs 晚 9 点、工作日 vs 周末。

`state/SCOREBOARD.md` 的「To-do」区就是这份清单的落地版（见 Step 6）。

### Step 3 — 上线一个实验（含抓 before）

**先抓 before-state**（profile 字段）：

```bash
xurl "/2/users/me?user.fields=name,description,url,location,profile_image_url,pinned_tweet_id"
```

记下当前值。**然后真正去改：**

- **bio / 名字 / URL / 地点** —— 可走 API（OAuth1 v1.1）：
  ```bash
  xurl --auth oauth1 -X POST "/1.1/account/update_profile.json?description=<urlencoded>"
  ```
  （`name` / `url` / `location` 同理。失败/没 enroll OAuth1 → 退回 App 里手改，照样记账。）
- **头像 / banner / 置顶推** —— 没有可靠公开 API，**在 App / 网页里手改**，skill 只负责记 before/after + 跟踪。

**记账（盖上 applied 日期 + before 值）：**

```bash
python3 scripts/ledger.py apply 1 \
  --before-field description --before-value "<原 bio 原文>" \
  --after-value "<新 bio>"
```

之后这个实验进入测量期：baseline = applied 前 `window_days`(默认7) 天的指标中位数；判决要等 applied 后攒够数据。

### Step 4 — 每天喂数 + 重算（见也用于「每日检查」）

```bash
scripts/daily-check.sh
```

它会：ingest `inbox/` 里的新 CSV（用完归档到 `inbox/done/`）→ `evaluate.py --write-verdict` 把方向性判决写回账本 → 重生成 `SCOREBOARD.md`。**注意：它只写判决，不动状态** —— keep/rollback 是人的决定。

### Step 5 — 判决与回滚

```bash
python3 scripts/evaluate.py          # 看每个在跑实验：baseline vs post，Δ%，verdict
```

判决（相对 baseline 中位数）：`Δ ≥ +10%` → **keep**；`Δ ≤ -10%` → **rollback**；之间 → **flat**。注意 `⚠ confounded` / `⚠ thin baseline` 标记，有就别太当真，延长窗口或停掉重叠实验再测。

- **keep**：`python3 scripts/ledger.py keep 1 --note "+58% 转化"`
- **rollback（先问王建硕！）**：确认后，用 `apply` 时存的 before 值还原（API 或手改），再
  `python3 scripts/ledger.py rollback 1 --note "转化掉了，还原 bio"`（命令会打印要还原的 before 值）
- **flat**：保留观察，或归为「不影响」撤掉。

### Step 6 — 看板

```bash
python3 scripts/scoreboard.py        # 写并打印 state/SCOREBOARD.md
```

四块：📈 现状（最新 ratio / 7 日中位 ratio / 粉丝数）、🧪 在跑实验（baseline/post/Δ/判决/告警）、✅ To-do 待办（proposed 清单）、📚 已结案（kept / rolled_back）。给王建硕看就发这个文件。

---

## 数据模型（state/）

- `daily.jsonl` —— 一天一行：`{date, profile_visits, new_follows, ratio, impressions, followers_total}`。
- `actions.jsonl` —— 一实验一行：`{id, category, title, hypothesis, metric, window_days, before:{field,value}, after:{value}, applied, status, evaluated, verdict, notes}`。状态流：`proposed → active → (kept | rolled_back)`。
- `SCOREBOARD.md` —— 生成物，人看的。

## 默认参数（要改就传 flag）

- 评估窗口 `--window-days` 默认 **7 天**
- keep/rollback 阈值 `--threshold` 默认 **±0.10（相对 ±10%）**
- 下判决前最少 post 数据 `--min-post-days` 默认 **3 天**
- 回滚 **永远先问**，不静默

## 每日检查（可选调度）

`/schedule daily /wjs-x-increasing-follower` —— 每天调起本 skill：跑 `daily-check.sh`，把 `SCOREBOARD.md` 现状 + 任何判 ❌ rollback 的实验 **发给王建硕并征求是否回滚**。CSV 还是得他手动导出丢进 `inbox/`（ratio 数据 API 拿不到，这步绕不开）。
