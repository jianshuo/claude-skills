---
name: wjs-picking-comments
description: Use when the user has finished drafting the NEXT 微信公众号 article and wants to attach a "上篇精选留言 Top 5" footer pulled from the previously published article. Auto-locates the previous article via wewe-rss, fetches its comments, picks the best 5 with 王建硕-style judgement, generates a styled `<section>` HTML footer, and appends it to the new article's article.md. Triggers — "上篇精选", "精选留言 footer", "把上一篇的留言加到这篇", "/wjs-picking-comments".
---

# wjs-picking-comments

把**上一篇已发布文章的精选留言 Top 5** 编辑成 HTML `<section>` 块，追加到**这一篇还没发布的文章**末尾，作为「上篇精选留言」footer。

## Core Principle

**留言 = 上一篇的延伸。** 王建硕的公众号每篇都收很多有质量的留言；下一篇开头/末尾呼应一下，对读者是一种尊重，对自己也是一条把对话续上去的线。这个 footer 不抢主文风头——淡底色、灰字、轻轻挂在文末。

不要做的事：
- 不要假装这是文章的一部分（用淡色 + 小字明确区分）
- 不要选超过 5 条（再多就喧宾夺主）
- 不要选"夸我写得好""感谢分享"类的客套话（这些不是新角度，是寒暄）
- 不要改留言原文（最多去掉表情符号、修明显错字）

## When This Skill Fires

- 用户写完了**新的一篇** WeChat 草稿，准备发，想加一个 footer 把上一篇的留言精华带上
- 用户说"加上一篇精选"、"挑五条留言放底下"、"上篇 footer"
- 用户跑了 `/wjs-picking-comments`

## When NOT to use

- 上一篇还没发布（草稿箱里的不算，要看到真发出去过的）
- 新文章还没写好（先写完正文，footer 最后加）
- 用户想要的是**回复留言**（marking 精选 / 公开回复评论），那是 mp.weixin.qq.com 后台的事，本 skill 不做

## Workflow

### Step 1: 定位「上一篇」

默认走 wewe-rss——从 `http://localhost:4000/feeds/MP_WXS_2397242840.atom` 取最新一条：

```bash
scripts/fetch-latest-from-rss.py
```

输出一个 JSON：
```json
{
  "title": "智能变得廉价以后，会改变什么？",
  "url": "https://mp.weixin.qq.com/s/-_dmDAsDbBGbL3zt8ur6Sg",
  "published_at": "2026-05-16T...",
  "summary": "..."
}
```

如果 wewe-rss 容器没启动（默认 http://localhost:4000 拉不通），让用户启动它，或者用 `--prev-url <wechat-url>` 显式指定。

**注意**："上一篇" 默认是 RSS 最新一条；如果用户最近发了很多篇，自己确认一下是不是真的想呼应这一篇。可以用 `--prev-url` 显式指定任意一篇历史文章。

### Step 2: 找上一篇对应的本地 article 文件夹（可选但推荐）

按 RSS 拿到的 title 去 `~/code/wechat-publish/articles/` 搜匹配的 meta.json：

```bash
python3 -c "
import json, glob, sys
title = sys.argv[1]
for p in glob.glob('$HOME/code/wechat-publish/articles/*/meta.json'):
    m = json.load(open(p))
    if m['title'] == title:
        print(p.rsplit('/',1)[0])
        break
" "$TITLE_FROM_RSS"
```

找到了：
- 优先读 `comments.md` / `comments-raw.json`（如果已经拉取过且 <6 小时）
- `publish.json` 里有 `draft_media_id` / `msg_data_id`，备用

找不到也 OK——comments 不一定非要从本地拿。

### Step 3: 拉取上一篇的留言

**默认走 gstack 持久浏览器路径**（cookie 自动从浏览器 profile 拿，零手工抓包）。详见 [wjs-publishing-wechat](../wjs-publishing-wechat/SKILL.md) 的 Step 8 路径 A。

```bash
# 一次性 setup（per machine + per article）：
#   ~/.claude/skills/gstack/browse/dist/browse goto https://mp.weixin.qq.com/   # 扫码登录
#   echo '<appmsgcomment URL>' > <prev-article-folder>/comment-url.txt          # per article 一次

# 之后每次（零手工）：
~/.claude/skills/wjs-publishing-wechat/scripts/fetch-comments-via-gstack.sh \
  <prev-article-folder> --both
```

如果 gstack 没装、或脚本报「未登录 mp.weixin.qq.com」需要重新扫码，可以临时 fallback 到手抓 cookie 路径：

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/fetch-comments-by-cookie.sh \
  <prev-article-folder> \
  --url '<抓包 URL，含 begin=0...>' \
  --cookie '<整段 Cookie>' \
  --both
```

**Cookie 哪来的**：走 gstack 持久 Chromium profile（`~/.gstack/chromium-profile/`），扫码一次能撑几周。`fetch-comments-via-gstack.sh` 每次跑都从浏览器拿当下的 cookie + token，URL 模板存在 `<article-folder>/comment-url.txt`（per-article，一次性配置）。

如果上一篇还没有本地文件夹，先在 `/tmp/picking-comments-cache/<slug-from-title>/` 建一个临时的，放 `comments-raw.json` 进去。

### Step 4: 从 comments.md 里筛已精选 + 高赞

```bash
scripts/select-elected-comments.py <prev-folder>/comments.md \
  --max 20 --min-elected 5
```

输出 `{"total_comments": N, "total_elected": M, "candidates": [...]}`。

**注意**：parse 的是 `comments.md`（fetch-comments-by-cookie.sh 的规范输出），不是 `comments-raw.json`——后者只是某些失败 case 下的第一页 debug 转储，不全。

如果**已精选不足 5 条**（公众号没来得及精选所有该精选的），自动 fallback：补上全部留言里点赞数 ≥ 3 的未精选条目，仍按 like_num 排序。

### Step 5: LLM 挑 Top 5（这一步是本 skill 的核心质量保证）

把候选 N 条（一般 8-20 条）丢给 LLM——也就是当前对话里的你自己——按下面**王建硕的精选标准**排出 Top 5：

#### 王建硕精选标准（按权重）

1. **新角度** > 老观点 + 共鸣。上一篇没提到、但读完后冒出来的视角，最值得放在 footer。一个新角度 = 一个被打开的门。
2. **凝练** > 啰嗦。能用一句话点透的，胜过用三段话绕弯的。原话保留，但**啰嗦的不挑**。
3. **正向、好奇、坦诚** > 抬杠、纠错、自我表演。即使观点和王建硕不同，如果是温和的、好奇的，可以选；如果是阴阳怪气的，不选——读者会替你尴尬。
4. **能 trigger 下一篇** > 单纯赞同。留言里如果有人提了一个**新问题**或**新假设**，放在 footer 能自然引出下一篇——这是最高优。
5. **高赞是 tie-breaker，不是决定项**。点赞数高常常是寒暄类的；真正洞见的留言点赞数可能只有 1-2。

#### 输出格式

LLM 直接输出 5 条候选（按从最强到最弱排），每条带：
- nick_name
- location（如「上海」「广东」）
- like_num（如果 ≥3 才显示「👍 N」，否则不显示）
- content（原文，只去 emoji 和明显错字）

下面 Step 6 的脚本会按这 5 条生成 HTML。

### Step 6: 生成 `<section>` HTML

```bash
scripts/build-footer.py \
  --prev-title "智能变得廉价以后，会改变什么？" \
  --prev-url "https://mp.weixin.qq.com/s/-_dmDAsDbBGbL3zt8ur6Sg" \
  --recap "当智能像自来水一样廉价、人人都用得起，最大的机会会出现在哪里？这是上一篇抛给大家的问题。" \
  --total-count 36 \
  --picks-json /tmp/picks.json \
  --out /tmp/footer-section.html
```

`picks.json` 的格式：
```json
[
  {"nick_name": "小余", "location": "广东", "like_num": 19, "content": "..."},
  {"nick_name": "昕",   "location": "浙江", "like_num": 14, "content": "..."},
  ...
]
```

**LLM 在 Step 5 写 recap**——一句话，复述上一篇抛出的核心问题或主张，最多 50 字。

### Step 7: 追加到新文章 article.md

```bash
scripts/inject-footer.py <new-article-folder> /tmp/footer-section.html
```

逻辑：
- 读 `<new-article-folder>/article.md`
- 找有没有现存的 `<section ...>...</section>` 块（用 footer 标志 `上篇精选留言` 判断是同类）
  - **有**：替换（幂等）
  - **没有**：追加到文末（在结尾 newline 之前）
- 写回 article.md

注意：injecting raw HTML 需要 wjs-publishing-wechat 的 upload-draft.sh 支持（已支持，参见该 skill SKILL.md 的「Raw HTML 块透传」部分）。本 skill 只做内容生成，不做上传——上传由用户后续跑 `upload-draft.sh` 完成。

### Step 8: 收尾

```
✓ 上篇精选留言 footer 已加到 articles/2026-05-18-<slug>/article.md
  - 来源：《<prev-title>》(<prev-url>)
  - 总留言 N 条，已精选 M 条，挑了 Top 5
  - 准备发布：~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh articles/2026-05-18-<slug>
```

## Inputs

```
/wjs-picking-comments <new-article-folder>           # 自动从 RSS 拿上一篇
/wjs-picking-comments <new-article-folder> --prev-url <wechat-url>   # 显式指定上一篇
/wjs-picking-comments <new-article-folder> --prev <prev-folder>      # 显式指定本地 folder
```

第一次跑会 prompt 抓包指引（URL + Cookie）。之后 cookie 保存到 `~/.config/wjs-picking-comments/cookie.json`，下次先试缓存。

## File Layout

```
~/.claude/skills/wjs-picking-comments/
├── SKILL.md
└── scripts/
    ├── fetch-latest-from-rss.py    # 从 wewe-rss 拿最新一篇文章
    ├── select-elected-comments.py  # 从 comments-raw.json 筛已精选 + 排序
    ├── build-footer.py             # 用 5 条候选 + 元数据生成 <section> HTML
    └── inject-footer.py            # 把 HTML 块追加/替换到 article.md
```

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 选超过 5 条 | 6 条以上 footer 就成了主角，文章读完印象全是别人说的话 |
| 选"建硕老师写得真好"类的客套留言 | footer 是「续上对话」，不是「展示读者的赞美」 |
| 选纯粹反对你的、阴阳怪气的留言 | 不是辩论场，是延伸对话的小角落 |
| 改留言原文（除了去 emoji 修错字） | 留言是别人写的，篡改即失信 |
| 把 like_num 当唯一标准 | 寒暄类留言点赞高，洞见类常常只有 1-2 赞 |
| 把 footer 放到正文中间 | 永远在文末。读者读完正文再看 footer，不打断阅读 |
| 复制粘贴上一篇的 footer | 每篇都要重新挑——上一篇的精华挑过了，这次要看的是上一篇之后又新增的精选 |
| 自动「精选」未精选留言 | 本 skill 只读已精选的；marking 精选 = mp.weixin.qq.com 后台的事，不归本 skill 管 |

## Dependencies

- **wewe-rss 容器**在 http://localhost:4000 跑着（提供王建硕公众号的 RSS）。容器没跑也能用——只是要 `--prev-url` 显式传
- **wjs-publishing-wechat** skill 的 `fetch-comments-by-cookie.sh`：本 skill 复用它拉评论
- **cookie 抓包**一次：从 mp.weixin.qq.com → 留言管理 → DevTools → Network → 找 `appmsgcomment` 请求 → 复制 URL + Cookie

## Common Pitfalls

- **comments-raw.json 里 `comment_list` 是字符串**，需要二次 `json.loads()`。这是 WeChat 后台 API 的怪癖
- **`is_elected` 字段是 0/1 整数**，不是 boolean。`if c['is_elected']` OK 但 `if c['is_elected'] is True` 永远 False
- **location 字段**有时叫 `province`，有时叫 `location`，不同 API 版本会变。Skill 的脚本对两个 key 都做 fallback
- **like_num** 不存在的留言意味着 0 赞，不要让缺字段崩
- **post_time** 是 Unix epoch 秒，不是毫秒
