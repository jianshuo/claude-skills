---
name: wjs-trading-diary
description: Use when 王建硕 is about to place, has just placed, or is reflecting on an investment trade — 下单前, 下单后, 成交了, 挂单, 建仓, 加仓, 减仓, 卖出, 调仓, 再平衡, 富途截图, 账户体检, 看盘, 亏了, 赚了, 投资复盘, 吃一堑长一智 about money, "记一笔投资", "交易日记", "投资 log", "/wjs-trading-diary". Also when he pastes a brokerage screenshot or fill confirmation.
---

# wjs-trading-diary（交易日记）

## 核心

每一次**下单前 / 下单后 / 吃一堑**都跑一遍。两本账，**都只准追加，历史一个字不改**：

| 文件 | 记什么 |
|---|---|
| `/Users/jianshuo/code/jianshuo-memory/10-investing/LOG.md` | **事实**：日期、标的、股数、价格、金额、手续费、当时的理由和心情 |
| `/Users/jianshuo/code/jianshuo-memory/10-investing/LESSONS.md` | **学到的东西**：一条一规则，可在下一次下单前直接拿来用 |
| `/Users/jianshuo/code/jianshuo-memory/10-investing/portfolio.md` | 组合宪法（目标配置、铁律）。只读对照；只有建硕明确说「改规则」才改 |

**本 skill 会同步到公开仓库**：金额、持仓只写进上面的私有文件，绝不写进本 SKILL.md。

## 第 0 步：判断是哪一种

| 信号 | 模式 |
|---|---|
| 「准备买/卖」「想挂单」「要不要加点」 | A 下单前 |
| 截图、成交回报、「买好了」「成交了」、定期看账户 | B 下单后 / 体检 |
| 「亏了」「又栽了」「早知道」「这次学到…」 | C 吃一堑 |

一次对话可以连着走 A→B（下单前记一条，成交后再记一条）。

## A 下单前

1. 读 `LESSONS.md` 全文 + `portfolio.md` 铁律，**挑出跟这一笔相关的条目原文念给他**（「你 X 月 X 日学到过：…」）。这是整个 skill 最值钱的一步。
2. 对照铁律逐条过：限价单？避开开盘头 15 分钟？卫星仓有没有在加仓/补跌？是不是还没到再平衡日就想动核心仓？违反就直说，**不替他下决定**，但要他亲口说「我知道，仍然要做，因为…」并原话记下。
3. 带时间窗口（期权、事件驱动、财报前/解锁前择时）→ **REQUIRED SUB-SKILL:** `s-trading-principle`，三问走完再继续。
4. 追加 LOG：`## YYYY-MM-DD · 下单前：<一句话>`，写计划（标的/方向/股数/限价）+ 理由 + 此刻心情 + 引用了哪几条 LESSONS。

## B 下单后 / 体检

1. **先用 API 取事实**：OpenD 在监听 `127.0.0.1:11111` 时，跑 `~/code/futu-tools/.venv/bin/python ~/code/futu-tools/query.py deals|orders|summary --start <日期>`，手续费用 `order_fee_query` 查（用法见记忆库 `10-investing/futu-openapi.md`）。API 时间是美东时间，要换算成东京时间。OpenD 没开时，才从截图或他的话里抽，做成表（标的｜股数｜成交价｜金额｜时间）。看不清的数字**问，不猜**。他口述的事实和 API 对不上时，以 API 为准，并追加一条更正。
2. 对账：计划 vs 成交（价差、股数）；账户总额拆解（浮盈亏 + 现金变动 + 手续费 = 账面变化），对不上就写明差额和推测来源，标「待核对」。
3. 体检时按 σ 说话（几个 σ，2σ 内不问为什么），并检查核心仓偏离目标是否 ≥5 个百分点。
4. 追加 LOG：`## YYYY-MM-DD · <一句话结论>`。有遗留问题就在条目末尾写「**遗留**：…」，下次体检先把上次的遗留念出来。

## C 吃一堑

1. **REQUIRED SUB-SKILL:** `wjs-eating-and-growing`，五步走完（它自己会存到 eating-and-growing/MEMORY.md，这里不再抄五行）。
2. 把第 4 步「新参数」和第 5 步「下次的那一秒」压成一条投资规则，追加 LESSONS.md（格式见下），标注来源。
3. 追加 LOG：`## YYYY-MM-DD · 堑：<一句话>`，写事实（亏了多少、哪一笔）+ 指向那条新 LESSON。

## 追加的写法（两本账通用）

- **倒序**：新条目插在第一个 `## ` 标题**之前**（文件头和注释块之下）。用 Edit 以「第一个现有 `## ` 标题行」为锚点，`new_string` = 新条目 + 原锚点行。
- 写完立刻验证只增不改：
  ```bash
  cd /Users/jianshuo/code/jianshuo-memory && git diff --numstat 10-investing/
  ```
  第二列（删除行数）必须是 0。不是 0 → 撤回重写。
- 发现旧条目写错：追加 `## YYYY-MM-DD · 更正 <原日期> 条：…`，原条目不动。
- 旧教训被推翻：追加新 LESSON，写「取代 L-xxx，因为…」，旧条不删。

LESSONS.md 条目格式：

```markdown
## L-NNN · YYYY-MM-DD · <规则，一句话，祈使句>
- 来源：<哪件事 / LOG 哪天的条目>
- 用法：<下单前遇到什么情形时念这一条>
```

编号接着现有最大号往上加。

## 收尾

一句话告诉他：记了哪几条（LOG 标题 / LESSONS 编号），有没有遗留问题。

## 常见错误

| 错误 | 改正 |
|---|---|
| 顺手「整理」旧条目、合并重复、改错别字 | 一律不动，另起更正条 |
| 下单前只记计划，没念 LESSONS | 第 1 步不能跳，账本不回读就只是存档 |
| 截图数字模糊就估一个 | 问 |
| 把金额写进本 SKILL.md 或公开文章 | 只进私有记忆库 |
| 吃一堑直接写教训，跳过五步 | 先走 wjs-eating-and-growing |
