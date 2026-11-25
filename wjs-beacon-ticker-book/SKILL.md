---
name: wjs-beacon-ticker-book
description: Use when the user wants a stock ticker turned into a "book" for the Beacon app — 给一个美股代码，从公司是干什么的讲起、价格最后才看，写成十三章的股票书（九章写作 + 三章实时 + 体检表），发布到 beacon.jianshuo.dev 并出现在 Beacon app 的「分析」页签。也用于修改写书流程本身、把新版本部署到服务器。Triggers — "给 XX 写一本书", "写股票书", "ticker book", "分析这只股票写成书", "改写书流程", "部署写书到 VPS", "/wjs-beacon-ticker-book <TICKER>".
---

# wjs-beacon-ticker-book

给一个美股代码，写成一本「股票书」：先弄懂生意，价格最后才看。成品在 `https://beacon.jianshuo.dev/books/<TICKER>/`，Beacon app 的「分析」页签和每只股票的详情页都会链接到它。

**这个 skill 是整个写书流程的唯一真源。** 写法、采集脚本、排版脚本、实时章节模板、服务器运行手册、部署方式都在这里。改任何东西都先改这里，见最后一节「改流程的规矩」。

## 这里有什么

| 文件 | 管什么 |
|------|--------|
| `WRITING.md` | 怎么写：章节骨架、读者画像、费曼式文风、数字纪律、写手和评审的提示词、红线 |
| `RUNBOOK.md` | 服务器上无人值守写一本书的完整流程（代理照着做） |
| `book.template.json` | 全书大纲模板，建筑师填成 `book.json` |
| `scripts/fetch_facts.py` | 从美国证监会采集事实档案：结构化财务 + 年报、季报、临时公告、委托书原文 |
| `scripts/fetch_events.py` | 采集公司事件（临时公告），给「最近表现」一章对大波动日 |
| `scripts/fetch_daily.py` | 取某个交易日的「当日事实」（价格、对比、期权、暗池、卖空、新闻标题、公告），给日报用 |
| `scripts/build.py` | 只把过审的章节和日报渲染成网页；体检表从各章笔记自动汇总；日报的数据表从当日事实直接排出 |
| `scripts/upload.py` | 把渲染结果和源稿发布到 beacon.jianshuo.dev |
| `live/` | 三章实时章节的页面模板（便宜还是贵 / 别人怎么看 / 最近表现），打开时现取现算 |
| `install.sh` | 在服务器上从 GitHub 安装或更新本 skill，校验通过才启用 |
| `publish.sh` | 本机：检查 → 提交 → 推到 GitHub →（可选）让服务器立刻装上 |

## 一本书的构成

顺序即方法——便宜的检查在前，昂贵的检查在后（借自《一个代码的十二次追问》）：

| 章 | 追问 | 怎么来的 |
|----|------|----------|
| 00 一页体检表 | 十二项检查各自过没过 | 自动汇总各章末尾的一行结论 |
| 01–07、09、11 | 哪家公司 / 靠什么赚钱 / 谁在付钱 / 护城河 / 公司自己怎么说 / 数字自洽吗 / 会先死吗 / 谁在掌舵 / 红旗 | **写**：写手 → 独立评审逐个核对数字 → 不过重写，过审才发 |
| 08、10、12 | 便宜还是贵 / 别人怎么看 / 最近表现 | **实时**：没有人写正文，网页打开时向代理取数现算 |

| 日报 | 今天发生了什么，和书里哪个结论有关 | **追加**：每个交易日收盘后一篇。数据表由程序排出，短评由代理写、逐个数字核对后才发 |

三类章节：**写一次**的（长期不变）、**实时**的（打开时现算）、**追加**的（日报，按日期一篇篇攒下去，在 `books/<TICKER>/daily/`，网页在 `d/<日期>.html`，列表在 `daily.html`）。

不给评级、不给目标价、不预测股价。估值只下三档：明显贵 / 明显便宜 / 说不清。

## 平时怎么用：服务器自动写

正常情况下不需要在本机跑任何东西：

1. 在 Beacon app 里，没有书的美股点一下「分析」→ app 向 `beacon.jianshuo.dev` 提交写书请求。
2. 代理把任务交给服务器上的调度服务（engine-router，`task_class: book`），它在几个订阅账号里挑有余量的来跑。
3. 代理开工前先跑 `install.sh` 从 GitHub 装最新版 skill，再照 `RUNBOOK.md` 做：采集 → 大纲 → 逐章写、评、发 → 通读 → 收尾。
4. 过审一章发一章，app 里能看到进度；写完后这本书就固定在「分析」里。

手动触发（不经过 app）：

```bash
KEY=$(cat ~/.beacon-signing/app-key)
curl -s -X POST -H "X-Beacon-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"code":"usAAPL.OQ"}' https://beacon.jianshuo.dev/api/book/AAPL/request
curl -s -H "X-Beacon-Key: $KEY" https://beacon.jianshuo.dev/api/book/AAPL/status
```

**日报**不用人管：代理每个交易日美东 18:30 之后，给每一本写完的书各交一个日报任务（`RUNBOOK.md` 的「日报」一节），休市日代理发现没有行情会自己跳过。手动补某一天：

```bash
curl -s -X POST -H "X-Beacon-Key: $KEY" "https://beacon.jianshuo.dev/api/book/AAPL/daily?date=2026-11-24"
```

目前只支持向美国证监会提交 10-K 年报的公司。A 股、港股和交 20-F 的外国公司还没有对应的事实采集。

## 在本机写（调试写法、或想要更强的独立评审时）

本机的 Claude Code 有子代理，写手和评审可以真正互相独立。工作根目录用 Beacon 仓库：

```bash
cd ~/code/beacon
S=~/.claude/skills/wjs-beacon-ticker-book
python3 $S/scripts/fetch_facts.py AAPL && python3 $S/scripts/fetch_events.py AAPL
# 然后照 RUNBOOK.md 第 2–6 步做，走「并行档」：每章一个写手子代理 + 一个没参与写作的评审子代理
python3 $S/scripts/build.py AAPL && python3 $S/scripts/upload.py AAPL
```

本机需要的三样东西放在 `~/.beacon-signing/`（不进任何仓库）：`sec-user-agent`（证监会要求的「名称 邮箱」）、`app-key`、`admin-key`。

## 服务器上的布局

```
/opt/claude-agent/workspace/beacon-books/        工作根目录（调度服务允许的工作区内）
  .claude-skills/                                从 GitHub 克隆的 claude-skills 仓库（只检出本 skill）
  skill -> .claude-skills/wjs-beacon-ticker-book 代理读的就是这个链接
  books/<TICKER>/                                每本书的源稿
  out/books/<TICKER>/                            渲染结果
```

服务器上不存任何密钥：上传口令、证监会联系信息、报价口令由代理提交任务时通过调度服务的环境变量传给这一次运行。

## 改流程的规矩

**先改 skill，再让它流到服务器。不直接改服务器上的文件，也不在 Beacon 仓库里另存一份脚本。**

1. 改这个目录里的文件（本机路径 `~/code/claude-skills/wjs-beacon-ticker-book/`，`~/.claude/skills/` 下是指向它的链接）。
2. 推到 GitHub：用 Claude Code 的编辑工具改文件时，钩子会自动跑 `publish.sh` 提交并推送；手改的话自己跑一次 `./publish.sh`。
3. 服务器下次开始写书前会自己 `install.sh` 拉最新版。想马上生效并验证：`./publish.sh --install`。
4. 新版本在服务器上校验不过（脚本语法错、缺文件）时，`install.sh` 会退回上一个能用的版本，不会带病开工。

这个仓库是公开的：**不要把密钥、邮箱、口令写进这里的任何文件。**

写法改动（`WRITING.md`）只影响以后新写和重写的章节，已发布的书不会自动重写。排版和实时章节模板的改动，要对每本书重新 `build.py` + `upload.py` 才会生效。
