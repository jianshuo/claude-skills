# 提示词模板

`<T>` = 代码，`<D>` = 研究目录（`~/code/reports/<T>-<日期>/`），`<CTX>` = 一两句现状（最新价、标清盘前/盘中/收盘、最近事件）。

## 收集

### Unusual Whales → `<D>/01-unusualwhales.md`

> 收集 <T> 的 Unusual Whales 数据，写成中文事实档案（数字原样，IV/OI/GEX 等术语可留英文）。现状：<CTX>。
> 先 `ToolSearch` 查询 "unusualwhales"（max_results 20）把工具加载进来，每个工具用 `action_type` 选动作。至少拉：
> - uw_stock：stock_state、ohlc（约 1 年日线 + 近几日）、iv_rank、interpolated_iv、volatility_term_structure、volatility_realized、max_pain、greek_exposure、spot_exposures_by_strike、oi_per_expiry、options_volume、flow_recent、net_prem_ticks、insider_buy_sells、ownership
> - uw_earnings（历次财报的实际涨跌 vs 隐含波动）、uw_shorts、uw_darkpool、uw_flow / uw_alerts（近两周大单）、uw_institutions、uw_insider、uw_congress / uw_politicians、uw_news（近 30 天）
> 某个动作重试一次还报错就跳过，并在档案里注明。
> 结构：1 价格与走势 2 期权与波动率（含未来 1 周/1 月/3 月隐含区间 = 价格×IV×√(T/365)）3 资金流 4 做空 5 机构/内部人/议员 6 历次财报反应表 7 新闻时间线 8 数据面多空信号小结（只说数据指向，不下结论）。每个数带日期，不编数，缺的标缺。完成后回一个 10 行摘要。

### Zero Hedge → `<D>/02-zerohedge.md`

> 收集 zerohedge.com 上关于 <公司>（<T>）的报道，写成中文档案。现状：<CTX>。重点看近 12 个月，尤其最近几周。
> `ToolSearch` 加载 "select:WebSearch,WebFetch"。WebSearch 用 `allowed_domains:["zerohedge.com"]`，多角度检索（财报、业务线、政策、并购、裁员、管理层、关税、卖方观点、轧空等，按公司换词），再 WebFetch 读正文（ZH 常转载卖方研报，记下机构、观点、数字）。付费墙就记标题、日期、URL 和能拿到的摘要。目标 15–30 篇。
> 结构：1 文章时间线表（日期 | 标题 | URL | 一句要点 | 偏多/偏空）2 看多/看空论点归纳（附出处）3 宏观与行业背景的含义 4 最近事件的报道细节。不编，数字必须有 URL。完成后回简短摘要。

### 基本面与新闻 → `<D>/03-fundamentals-news.md`

> 为 <公司>（<T>）建基本面与新闻档案（中文）。现状：<CTX>。要查清楚最近这次涨跌的直接原因。
> `ToolSearch` 加载 "select:WebSearch,WebFetch"。最新事件用 WebSearch 的 `extended` 模式。一手来源优先：公司 IR 的财报新闻稿和 CFO 解读、电话会记录或可靠摘要、10-Q/8-K、Reuters/Bloomberg/CNBC/WSJ/FT，以及财报后的评级和目标价调整。
> 内容：1 最近一季财报（收入、毛利率、EPS vs 预期、分部、下季指引 vs 预期、管理层原话、市场反应原因）2 一年来关键事件时间线 3 近 8 季财务趋势 4 估值与同业对比 5 竞争与技术路线 6 卖方评级与目标价分布（事件前后）7 即将到来的催化剂（带日期）。每条事实带 URL 和日期，不编，缺的标缺。完成后回 15 行摘要。

## 辩论

所有辩手共用的开头：

> 你在一场关于 <T>（<公司>）未来股价的辩论里担任<多方|空方>。今天 <日期>，<CTX>。资料只有这几份，先全部读完：<D>/00-local.md、01-unusualwhales.md、02-zerohedge.md、03-fundamentals-news.md、04-futu.md（富途行情，csv 明细在 futu/）。
> 规则：只用资料里的事实，引用时写出处（文件名 + 小节）；资料没有的不要编，可以说「资料未覆盖」。你的任务是为你这一方做最强的论证，而不是两边都说。不要写免责声明。用中文。

- **第 1 轮立论**（`debate/bull-1.md` / `bear-1.md`）：给出你这一方最强的 5 条理由（每条：论点、证据、这条为什么会反映到股价上、时间尺度），再给 3 个月和 12 个月的目标价及推导。最后列出你这一方最怕的 2 个事实。
- **第 2 轮反驳**（`bull-2.md` / `bear-2.md`）：再附上对方的第 1 轮稿件 `<对方>-1.md`。逐条反驳对方 5 条理由（承认哪部分、反驳哪部分、用什么证据），再补充一条对方没提到的、对你有利的事实。
- **第 3 轮结辩**（`bull-3.md` / `bear-3.md`）：再附上对方的第 2 轮稿件 `<对方>-2.md`。写结辩：哪些地方你让步、哪些核心论点仍然成立、你的最终目标价和你自己估计的胜率（0–100%）。控制在 1200 字内。

## 裁决 → `debate/judge.md`

> 你是独立裁判，没参与这场关于 <T> 的辩论。今天 <日期>，<CTX>。读完 <D>/00–04 五份资料和 debate/ 下六份辩稿（bull-1..3、bear-1..3）。
> 1. 逐个争点判哪一方更站得住，理由要落到资料里的事实；点出双方各自回避了什么。
> 2. 预测表，时间窗 1 周 / 1 个月 / 3 个月 / 12 个月，每行：方向（涨/跌/横盘）、中枢价、68% 区间、上涨概率、confidence（0–100%，代表你对这一行判断本身有多大把握）。
> 3. 和期权市场对照：用 01 和 04 里的 IV 算出各窗口的隐含 ±1σ 区间，说明你的区间比市场宽还是窄、偏向哪边、为什么。
> 4. 最关键的三条理由；三个「出现就说明我判断错了」的证伪信号（要可观察、带阈值或日期）。
> 5. 一句话结论。
> 不编数据，不写空话。用中文。

## 成书

固定六章骨架（章数改了就合并或拆分，第 1 章和最后一章不动）：

| 章 | 标题方向 | 素材 |
|---|---|---|
| 1 | 今天发生了什么 | 00、01 第 1 节、03 第 1 节、04 快照；写清数据截止时间、价格是盘前/盘中/收盘 |
| 2 | 这家公司怎么走到今天 | 03 第 2–5 节、02 的背景 |
| 3 | 市场在用钱投票 | 01 第 2–6 节、04 资金流向/分布/期权；把 IV、GEX、做空比例这些词讲成人话 |
| 4 | 看多的人怎么说 | bull-1..3 + bear-2 对它的反驳；保留辩论来回 |
| 5 | 看空的人怎么说 | bear-1..3 + bull-2 对它的反驳 |
| 6 | 裁决：涨还是跌，有多大把握，为什么 | judge.md 全部；预测表、期权对照、证伪信号、作者持仓、「不是投资建议」 |

导读 `intro.html`：一个钩子 + 贯穿全书的问题（这只股票接下来会怎么走，凭什么这么判断）+ 一句结论预告。

### 写手提示词

> 你是这本书第 NN 章的写手。全书是《<书名>》，讲 <T> 在 <日期> 这个时点的状况和未来涨跌的推演。先读写书 skill 的科普书写法：~/code/jianshuo.dev/claude-agent/skills/wjs-voicedrop-writing-explainary-book/SKILL.md（读者画像、费曼铁律、HTML 约定都照它）。
> 本章：<no / title / brief>。全书大纲：<六章 title + brief>（别重复别章内容）。
> 素材只用：<上表对应文件的路径>。每个数字都要能在素材里找到，写的时候标上日期；不编数据。辩论章要把来回写出来：谁说了什么、对方怎么回、哪条站住了。
> 输出：`<article>` 里面的 HTML 片段，只用 `<p> <h2> <h3> <ul>/<ol>/<li> <strong> <blockquote> <code> <table>/<tr>/<th>/<td> <dfn> <div class="plain">`；不写 `<h1>`、不写内联 style、不放图片。约 1500–3000 字（第 6 章可以更长）。写到 <D>/book-<slug>/chapters/NN.html。

### 评审提示词

> 你是独立评审，没参与写作。读 <D>/book-<slug>/chapters/NN.html 和全书大纲，按科普书评审维度打分（见 wjs-voicedrop-writing-explainary-book 的「评审」一节：准确度 / 新颖性 / 有趣度，各 1–5）。准确度要拿章里的数字去 <D>/01–04 和 debate/ 里逐个核对，找不到出处的算硬伤；资料本身可疑的再上网查。另查：价格有没有标时间；预测类表述有没有写成确定事实。
> pass 条件：准确度 ≥4，新颖性和有趣度 ≥3，没有未解决的硬伤。输出 JSON 写到 <D>/book-<slug>/reviews/NN.json：`{"scores":{"accuracy":n,"novelty":n,"fun":n},"verdict":"pass|fail","must_fix":["…"],"note":"一句总评"}`，并原样返回。
