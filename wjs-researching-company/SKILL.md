---
name: wjs-researching-company
description: Use when 王建硕 wants a listed company researched end to end and turned into a VoiceDrop book — pulls everything he already has, Unusual Whales data (price/options/flow/shorts/insiders/news) and zerohedge.com coverage plus fundamentals, runs a bull-vs-bear agent debate with an independent judge, then writes a 6-chapter 科普 book (现状 + 涨跌预测 + confidence + 理由) and publishes it straight to voicedrop.cn/books with build.mjs (no AI rewrite). Triggers — "研究一下 INTC", "研究清楚这家公司", "多空辩论", "做一本公司研究书", "/wjs-researching-company <ticker>".
---

# wjs-researching-company — 一家公司，一场多空辩论，一本书

**输入**：股票代码（如 `INTC`），可选公司名、章数（缺省 6）。
**产出**（全部在 `~/code/reports/<TICKER>-<YYYY-MM-DD>/`）：

| 文件 | 内容 |
|---|---|
| `00-local.md` | 我手里已有的信息（记忆库、持仓、旧报告） |
| `01-unusualwhales.md` | Unusual Whales：价格、期权/IV、资金流、做空、内部人/机构/国会、财报反应、新闻 |
| `02-zerohedge.md` | zerohedge.com 的相关文章与转载的卖方观点 |
| `03-fundamentals-news.md` | 财报、指引、事件时间线、估值、卖方评级、催化剂 |
| `debate/` | `bull-1.md bear-1.md`（立论）→ `-2`（反驳）→ `-3`（结辩）→ `judge.md`（裁决） |
| `book-<slug>/` | 书的工作目录（book.json、chapters/NN.html、reviews/NN.json、cover.jpg） |
| `~/code/reports/predictions.tsv` | 预测流水（只追加），以后回头打分校准用 |

最后一步把书**直接上架** `voicedrop.cn/books/<slug>/`——用写书 skill 的 `build.mjs`，正文就是我们写好的，**不交给云端写书 AI 重写**（MCP `write_book` 只收 20k 字的种子、AI 会自由发挥，不用它）。

## 核心原则

- **事实与观点分层**：收集层只记事实（每个数带日期和出处），辩论层才有观点，裁决层才有预测。书里每个数字都能追到 01–03 的某一行。
- **辩论要真对抗**：多方、空方是两个独立 agent，互相看不到对方的思路，只看到对方的成稿；裁判是第三个没参与辩论的 agent。
- **预测要可打分**：每个时间窗给方向、价格区间、上涨概率和 confidence，并用期权隐含波动区间做对照。说不准就说不准，confidence 低也照写。
- **不是投资建议**：书里写明数据截止时间、作者持仓（查 `jianshuo-memory/10-investing/`），以及「这是推演，不是建议」。

## 流程

### 0. 定目标与目录

- 用 `mcp__unusualwhales__uw_stock {action_type:"info", ticker}` 和 `{action_type:"stock_state"}` 确认公司、市值、下次财报日、最新价（盘前/盘中/收盘要标清）。
- 建目录 `~/code/reports/<TICKER>-<今天>/`。
- 写 `00-local.md`：在 `~/code/jianshuo-memory`（尤其 `10-investing/`）、`~/code/reports/`、`~/code/wechat-publish/` 里 grep 代码和公司名；有富途 OpenD 时可用 `~/code/futu-tools/query.py` 查持仓。没有就写「无持仓、无旧资料」。

### 1. 收集（三个 agent 并行，一条消息里同时发）

提示词模板在 `references/prompts.md` 的「收集」一节，各自写自己的文件：

1. **Unusual Whales** → `01-unusualwhales.md`。MCP 工具 `mcp__unusualwhales__uw_*`，参数鉴别字段是 `action_type`（不是 `action`）。
2. **Zero Hedge** → `02-zerohedge.md`。`WebSearch` + `allowed_domains:["zerohedge.com"]` 多角度检索，再 `WebFetch` 读正文；付费墙读不到就记标题、日期、URL、摘要。
3. **基本面与新闻** → `03-fundamentals-news.md`。财报一手来源（公司 IR、8-K、电话会）优先，近期事件用 `WebSearch` 的 `extended` 模式。

三份到齐后主循环通读一遍，有明显缺口（比如没拿到财报指引）就补派一个 agent，别带着缺口去辩论。

### 2. 辩论（三轮，每轮多空并行）

提示词在 `references/prompts.md` 的「辩论」一节。每个辩手都读 00–03 全部资料。

| 轮 | 多方 | 空方 |
|---|---|---|
| 1 立论 | `bull-1.md`：最强的 5 条看多理由 + 目标价 | `bear-1.md`：最强的 5 条看空理由 + 目标价 |
| 2 反驳 | 读 `bear-1.md`，逐条反驳 → `bull-2.md` | 读 `bull-1.md`，逐条反驳 → `bear-2.md` |
| 3 结辩 | 读 `bear-2.md`，承认什么、坚持什么 → `bull-3.md` | 读 `bull-2.md` → `bear-3.md` |

每轮都要**新 spawn** 辩手（上一轮的成稿通过文件传，不复用上下文），这样每一轮只靠写下来的论证说话。

### 3. 裁决（独立裁判）

新 spawn 一个没参与的 agent，读 00–03 和六份辩稿，写 `judge.md`：逐条判哪方论证更站得住，然后给预测表（1 周 / 1 个月 / 3 个月 / 12 个月）：方向、中枢价、区间、上涨概率、confidence（0–100%）、最关键的三条理由、什么信号出现就说明判断错了。必须和期权隐含区间（价格×IV×√(T/365)）对照，偏离要说理由。

裁决完把预测追加进 `~/code/reports/predictions.tsv`（只追加，表头：`日期	代码	基准价	窗口	方向	中枢	区间低	区间高	上涨概率	confidence	书slug`）。

### 4. 成书（按写书 skill 的科普书写法，直接写）

先读两份写书 skill（真源在 jianshuo.dev 仓库）：

```bash
S=~/code/jianshuo.dev/claude-agent/skills
cat $S/wjs-voicedrop-writing-book/SKILL.md $S/wjs-voicedrop-writing-explainary-book/SKILL.md
```

照它们来：`type: "explainary"`、`category: "投资"`、费曼式文风、`<dfn>` 和大白话盒子、写手和评审独立、过审一章发一章。和写书 skill 不同的只有两点：**章数缺省 6**（用户可改），**大纲是固定骨架**（不另派建筑师），见 `references/prompts.md` 的「成书」一节：

1. 今天发生了什么（现状、这次事件、数据截止时间）
2. 这家公司怎么走到今天（历史、业务、财务、竞争）
3. 市场在用钱投票（期权、资金流、做空、内部人与机构）
4. 看多的人怎么说（多方论证 + 空方反驳的过程）
5. 看空的人怎么说（空方论证 + 多方反驳的过程）
6. 裁决：涨还是跌、有多大把握、为什么（预测表 + 证伪信号 + 免责声明）

工作目录用 `~/code/reports/<TICKER>-<日期>/book-<slug>/`。slug 只能用小写字母、数字和连字符，形如 `intc-2026-10`。`book.json` 写 `author: "王建硕"`，owner 写 `users/anon-ae209ac53499d51d513425503bd134b0/`（本机凭据 `~/.config/voicedrop/credentials` 就是这个账号，也是书架发布账号，`GET https://jianshuo.dev/files/api/whoami` 可核对）。

```bash
B=~/code/jianshuo.dev/claude-agent/skills/wjs-voicedrop-writing-book/build.mjs
node $B index book-<slug>            # 骨架先上线
node $B done book-<slug> 01          # 每章过审即发
node $B intro book-<slug>            # 导读
node $B all book-<slug>              # 收尾，打印公开链接
```

**封面**：在 Tokyo VPS 上用 paint 出图（book 流水线同一个工具，带 `--group <slug>`），拉回本地再 `build.mjs asset`：

```bash
ssh root@66.42.45.128 "sudo -u claude-agent /opt/claude-agent/bin/paint '<提示词>' /opt/claude-agent/workspace/covers/<slug>.jpg --size 1024x1536 --group <slug>"
scp root@66.42.45.128:/opt/claude-agent/workspace/covers/<slug>.jpg book-<slug>/cover.jpg
node $B asset book-<slug> cover.jpg cover.jpg
```

封面要求照写书 skill：大字书名为主、副标题、作者「王建硕」，淡雅抽象背景，画面上只出现这些字，JPG。

### 5. 收尾

- 打开 `https://voicedrop.cn/books/<slug>/` 抽查目录页和第 6 章。
- 给用户：书的链接、一句话结论（方向 + confidence）、研究目录路径。

## Red Flags

- 书里出现 01–03 里找不到的数字 → 删掉或回去补出处。
- 辩手看到了对方的提示词或思路，或裁判参与过辩论 → 不算独立，重来。
- 预测只有方向没有概率和 confidence，或没和期权隐含区间对照 → 裁决不合格。
- 用 `write_book` 发书 → 会被云端 AI 重写、种子还被截到 20k，不用。
- 价格没标清盘前、盘中还是收盘，没写数据截止时间 → 补上。
- 忘了追加 `predictions.tsv` → 以后没法校准。
