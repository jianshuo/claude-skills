---
name: wjs-picking-comments
description: Use when the user has finished drafting the NEXT 微信公众号 article and wants to attach a "上篇精选留言 Top 5" footer pulled from the previously published article. Auto-locates the previous article via wewe-rss, captures its comment-list URL via gstack browser, fetches comments, picks the best 5 with 王建硕-style judgement, generates a styled `<section>` HTML footer, and appends it to the new article's article.md. Triggers — "上篇精选", "精选留言 footer", "把上一篇的留言加到这篇", "/wjs-picking-comments".
---

# wjs-picking-comments

把**上一篇已发布文章的精选留言 Top 5** 编辑成 HTML `<section>` 块，追加到**这一篇还没发布的文章**末尾。

## Core Principle

**留言 = 上一篇的延伸。** 王建硕的公众号每篇都收很多有质量的留言；下一篇末尾呼应一下，对读者是尊重，对自己也是把对话续上去的线。footer 不抢主文风头——淡底色、灰字、轻轻挂在文末。

## When This Skill Fires

- 用户写完新一篇 WeChat 草稿，准备发，想加 footer 把上一篇的精华带上
- 用户说"加上一篇精选"、"上篇 footer"、"挑五条留言放底下"
- 用户跑了 `/wjs-picking-comments <new-article-folder>`

## When NOT to use

- 上一篇还没发布（草稿箱里的不算，要看 RSS 真有这条）
- 新文章还没写好（先写完正文，footer 最后加）
- 用户想要的是**回复留言**（marking 精选 / 公开回复评论）——那是 mp.weixin.qq.com 后台的事，本 skill 不做

## Setup (一次性 · 每台机器)

mp.weixin.qq.com 后台 cookies 几小时就过期，但 gstack 持久 Chromium profile（`~/.gstack/chromium-profile/`）扫码一次能撑约 7 天，到期再扫一次即可。

```bash
# 1. 打开后台，弹 QR
~/.claude/skills/gstack/browse/dist/browse goto https://mp.weixin.qq.com/
~/.claude/skills/gstack/browse/dist/browse screenshot --viewport /tmp/qr.png
open /tmp/qr.png

# 2. 手机微信扫屏幕上的 QR

# 3. 验证（应该看到 ...token=数字）
~/.claude/skills/gstack/browse/dist/browse wait --networkidle
~/.claude/skills/gstack/browse/dist/browse url
```

**不要**用 `browse connect`——那是有头模式，cookies 不持久。**必须** headless + 截图扫。

session 失效的信号：脚本报「未登录」或者 `browse js "document.body.innerText.includes('请重新登录')?'OUT':'IN'"` 返回 `OUT`。重跑上面 3 步即可。

## Workflow

### Step 1: 定位「上一篇」

```bash
scripts/fetch-latest-from-rss.py
```

输出 JSON `{title, url, published_at, summary}`。脚本按 `<published>` / `<updated>` 倒序排，自动给出真正最新的一条。

**别盲信**：如果 RSS 最新一条是「分享图片」这种零评论的占位贴，跳到下一条（`--skip 1`）。一般人眼判断一下。

### Step 2: 找上一篇对应的本地 article 文件夹

按 title 在 `~/code/wechat-publish/articles/*/meta.json` 里找匹配：

```bash
python3 -c "
import json, glob, sys
title = sys.argv[1]
for p in sorted(glob.glob('$HOME/code/wechat-publish/articles/*/meta.json')):
    if json.load(open(p)).get('title') == title:
        print(p.rsplit('/',1)[0]); break
" "$TITLE_FROM_RSS"
```

找不到本地文件夹 → 临时建一个：
```bash
mkdir -p /tmp/picking-comments-cache/<slug>
echo '{"title":"<title>"}' > /tmp/picking-comments-cache/<slug>/meta.json
```

### Step 3: 抓取上一篇的 appmsgcomment URL（per-article 一次性）

如果 `<prev-folder>/comment-url.txt` 已存在 → 跳过。

```bash
scripts/capture-comment-url.sh <prev-folder>
```

脚本做的事：用 gstack 浏览器打开留言管理页 → JS 找到 title 匹配的行 → 自动点该行的「N条」→ 从 network log 抓出 appmsgcomment URL → 存到 `<prev-folder>/comment-url.txt`。

如果脚本报 `NOT_FOUND` → 文章可能在留言管理第 2 页之后；让 LLM 翻页（`browse js` 模拟点「下一页」）后重跑。

### Step 4: 拉取留言

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/fetch-comments-via-gstack.sh <prev-folder> --both
```

输出 `<prev-folder>/comments.md` + `comments.json`。脚本走浏览器 in-page `fetch()`——同源 + cookies 自动带，绕过所有 token/cookie 折腾。

如果脚本报「session expired」→ 回 Setup 重扫一次 QR，再跑。

### Step 5: 筛 + LLM 挑 Top 5

```bash
scripts/select-elected-comments.py <prev-folder>/comments.md --max 20 --min-elected 5
```

输出候选 JSON。**只看精选**；如果精选不足 5 条，自动补点赞 ≥ 3 的未精选。

把候选丢给 LLM（也就是当前的你）按下面**王建硕精选标准**排出 Top 5：

#### 王建硕精选标准（按权重排）

1. **新角度** > 老观点 + 共鸣。上一篇没提到、但读完后冒出来的视角。
2. **凝练** > 啰嗦。一句话点透 > 三段话绕弯。
3. **正向、好奇、坦诚** > 抬杠、纠错、自我表演。和王建硕观点不同但温和好奇可以选；阴阳怪气不选。
4. **能 trigger 下一篇** > 单纯赞同。提出新问题或新假设的留言最高优。
5. **高赞是 tie-breaker，不是决定项**。寒暄类留言点赞常常很高；真正洞见的留言可能只有 1-2 赞。

挑出来的 5 条按从最强到最弱排，写成 `picks.json`：

```json
[
  {"nick_name": "...", "location": "上海", "like_num": 19, "content": "..."},
  ...
]
```

`location` 取留言里的省份。`content` 用原文，**只去 emoji 和明显错字**，不要润色。

**如果总精选 < 5 条**：有几条挑几条，footer 模板支持 1-5 条。

### Step 6: 生成 footer HTML

```bash
scripts/build-footer.py \
  --prev-title "<上一篇标题>" \
  --prev-url   "<上一篇 mp.weixin URL>" \
  --recap      "<一句话复述上一篇核心问题或主张，≤50 字>" \
  --total-count <总留言数（含未精选）> \
  --picks-json /tmp/picks.json \
  --closing    "<本次收束语，不要每次都用同一句>" \
  --out        /tmp/footer-section.html
```

**recap** 你自己写——把上一篇抛出的问题或主张一句话点回来，让没看过上一篇的读者也能瞬间 catch 到 context。

**closing** 每次换一句，配合本次的精选基调。默认句式参考：「谢谢每一位留言的朋友——下一篇我接着从你们的留言里找钥匙。」

### Step 7: 追加到新文章

```bash
scripts/inject-footer.py <new-article-folder> /tmp/footer-section.html
```

幂等：如果 `article.md` 已有「上篇精选留言」section，替换；否则追加到文末。

### Step 8: 收尾

告诉用户跑这条上传：

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh <new-article-folder>
```

## Inputs

```
/wjs-picking-comments <new-article-folder>
```

第一次跑：会让你做 Setup（扫码登录 gstack）+ 自动跑 capture-comment-url.sh 抓 URL。
之后每次：单命令零手工。

## File Layout

```
~/.claude/skills/wjs-picking-comments/
├── SKILL.md
└── scripts/
    ├── fetch-latest-from-rss.py    # 从 wewe-rss 拿最新一篇文章
    ├── capture-comment-url.sh      # 用 gstack 浏览器自动抓 appmsgcomment URL
    ├── select-elected-comments.py  # 从 comments.md 筛已精选 + 排序
    ├── build-footer.py             # 用 5 条候选 + 元数据生成 <section> HTML
    └── inject-footer.py            # 把 HTML 块追加/替换到 article.md
```

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 选超过 5 条 | 6 条以上 footer 就成了主角 |
| 选"建硕老师写得真好"类客套留言 | footer 是「续上对话」，不是「展示读者赞美」 |
| 选阴阳怪气的留言 | 不是辩论场 |
| 改留言原文（除了去 emoji 修错字） | 留言是别人写的，篡改即失信 |
| 把 like_num 当唯一标准 | 寒暄类点赞高，洞见类常常 1-2 赞 |
| 把 footer 放正文中间 | 永远在文末 |
| 复制粘贴上一篇的 footer | 每篇都要重新挑 |
| 用 `browse connect` 扫码 | 有头模式 cookies 不持久——必须 headless + 截图 |
| 拿 `cookies` dump 出来塞 Cookie header | `slave_sid` 含 em-dash 撞 latin-1 编码，且 token/cookies 易不一致——已废弃，全部走 in-browser `fetch()` |

## Dependencies

- **gstack browse**（`~/.claude/skills/gstack/browse/dist/browse`）：持久浏览器
- **wewe-rss 容器**：`http://localhost:4000/feeds/MP_WXS_2397242840.atom` 提供王建硕公众号 RSS（容器没跑要先启动）
- **wjs-publishing-wechat** skill：`fetch-comments-via-gstack.sh` + `upload-draft.sh` 在这里
- **mp.weixin.qq.com 后台登录**：gstack profile 里持久存在，约 7 天有效

## Common Pitfalls

- **不要把 `browse js` 包成 `(async()=>{...})()`**——它不会 await IIFE async Promise。用 `.then()` 链式（`fetch(url).then(r=>r.text())`）才能拿到结果。
- **fetch-comments-via-gstack.sh 用 in-browser fetch**——不走 Cookie header，绕过 cookie 编码问题 + 绕过 token/session 不一致。
- **`comments.json` 里 `comment_list` 是 JSON 字符串**，需要二次 `json.loads()`——脚本已自动 unwrap。
- **`is_elected` 是 0/1 整数**，不是 boolean。
- **`location` 字段**有时叫 `province`，脚本两个 key 都 fallback。
- **`post_time` 是 Unix epoch 秒**，不是毫秒。
- **留言管理只显示当前页**。如果上一篇在第 2 页之后，capture-comment-url.sh 找不到——先翻页再重跑。
