---
name: wjs-publishing-wechat
description: 当用户想写或发布微信公众号文章时使用——他们给出零散思路、草稿或笔记，请你润色、生成题图和解释图，或准备上传到 mp.weixin.qq.com。触发词："写一篇微信文章"、"公众号"、"润色"、"题图"、"发公众号"、"/wjs-publishing-wechat"。
---

# wjs-publishing-wechat

帮用户写微信公众号文章。**轻润色，不重写。** 自动生成题图和解释图，一行命令推草稿。

## ⚠️ 风格唯一权威：STYLE.md（写作 / 润色前必读）

**写或润色每一篇文章前，先读同目录的 [`STYLE.md`](./STYLE.md)，并严格遵循。** 那是王建硕本人维护的风格定义文件——语气 DNA、长度、加粗、排版、红线清单全在那里。本 SKILL.md 只管**机制与工作流**（脚本、配图、HTML 转换、发布）。

风格上 STYLE.md 与本文件冲突时，**以 STYLE.md 为准**。要调风格 = 改 STYLE.md，不在这里改、更不在草稿里改。

下面只保留机制相关的写作约束：

- **字数**（STYLE.md 定预算，这里给计数命令）：

```bash
python3 -c "import re; t=open('article.md').read(); t=re.sub(r'\!\[.*?\]\(.*?\)','',t); print(len(re.findall(r'[一-鿿]',t)) + len(re.findall(r'[A-Za-z]+',t)))"
```

- **加粗加红的机制**：`upload-draft.sh` 把 `**...**` 渲染成红色粗体（用法见 STYLE.md「加粗加红」）。
- **盘古之白的机制**：`upload-draft.sh` 自动跑 `scripts/pangu.py`，Claude 不用手动加空格。
- **命令 / 代码独立成段的写法**（规则见 STYLE.md，这里给可复制的样式）：
  - **首选**——淡底色代码块（raw HTML 块，整段一行，内部不能有空行）：
    ```
    <section style="background:#f6f8fa;border-radius:6px;padding:14px 16px;overflow-x:auto;font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.8;color:#24292e;">npm install -g xxx<br>xxx run</section>
    ```
  - 或 fenced ```` ```bash ```` 块，脚本转成独立 `<p><code>…</code></p>`。

## 介绍 skill 的文章：末尾必须附安装方法

**触发条件**：这篇在介绍 / 推荐某个具体的 Claude Code skill。

**前置 — 确认 skill 已发布**：王建硕自己的 `wjs-*` skill 由 `~/.claude/skills-publish-hook.sh` 自动 push 到 [github.com/jianshuo/claude-skills](https://github.com/jianshuo/claude-skills)，用 `gh api repos/jianshuo/claude-skills/contents/<skill-name>` 确认。别人的 skill 先确认在公开 git repo 里。

**末尾附下面这段**（`<SKILL_NAME>` 替换成实际名）：

```markdown
## 安装方法

不用复制命令。打开你用的 AI agent——Claude Code、Codex、Kimi Code、OpenClaw 都可以，对它说一句：

> 安装 https://github.com/jianshuo/claude-skills/blob/main/<SKILL_NAME>/SKILL.md

它会自己 fetch、放到 skill 目录里、提示你重启对话。

用 Hermes 的话直接命令行：

\`\`\`bash
hermes skills install https://github.com/jianshuo/claude-skills/blob/main/<SKILL_NAME>/SKILL.md
\`\`\`

装完之后，对 agent 说一句「<一句最自然的触发语，紧扣这个 skill 的入口>」，就能用。
```

规则：
1. 这段**不计入** 800–1000 字预算
2. URL 用 `github.com/<owner>/<repo>/blob/main/<path>`——浏览器能直接看，LLM agent 也能从 blob URL 抽 markdown
3. Hermes 单独列**命令行**，因为它是 registry CLI 而非 chat agent
4. 最后那句触发语按当前 skill 实际入口写，**不要漏**
5. 通常放最后；有 `## 后注` 则放后注之前

## 工作流

### Step 0: 接收输入

输入形式：完整草稿 / 散乱思路 / 长段没分段 / 语音转写（可能有错字）。太散就**问一个问题**："想写一篇文章，还是几个独立想法？"——只问这一次。

### Step 1: 轻润色

- 修错字（"的得地"、同音字、"我我"重复字）
- 每 1–3 句一段
- 拗口处做最小改动；改完语气变了宁可不改
- 标点：中文全角，英文 / 数字间空格
- 保留原本开头和结尾

### Step 1.5: 隐私扫描（定稿前硬关卡）

**触发**：润色完、文字即将定稿之前，每篇都过。**逐句扫个人隐私信息**——具体人名、餐厅 / 店铺 / 场所名、精确地点 / 住址、电话 / 邮箱 / 微信号等——这些**不能进最终发布版**，泛化替换或删除。判定边界、替换示例、城市级地名照留等细则见 [`STYLE.md`「10. 隐私红线」](./STYLE.md)。

命中的项并进交付改动清单（标「隐私」）；一处都没有也说一句「隐私扫描：无」。拿不准的列出来问用户，不擅自删有意为之的细节。

### Step 2: 标题候选

给 **3 个候选**：A) 直白型；B) 故事型；C) 原文里最有味道的一句。不做标题党、夸张、"震惊"、"必看"。

### Step 3: 摘要（50–80 字）

**勾住读者、激发点击**——用「好奇缺口」：抛出文章里最反直觉 / 最有张力的那个点（结论、代价、转折、数字），但**留一手**，把答案留在正文，让人非点进来不可。仍是王建硕语气（具体、诚恳、话说一半的克制），钩子来自真东西不是形容词；**绝不**标题党、夸张、营销腔。不是第一段的复制。规则与例子见 STYLE.md「6. 标题与摘要」。

### Step 4: 配图（每篇两张，自动生成不问用户）

- **题图 cover.png** — **严格 2.35:1**（900×383），强字体、强构图、文字主导
- **解释图 illustration.png** — **比例由内容决定**（模型自选），扁平卡通、有标签和流程

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/gen-cover-ai.sh <article-folder> ["目标字词"]
~/.claude/skills/wjs-publishing-wechat/scripts/gen-illustration.sh <article-folder>
```

- 不传第二参数时从 `meta.json` 取 `title`；建议挑核心概念字词（1–4 字）
- 内部走 `gpt-image-2-skill` 的 `--provider codex`，需要 `~/.codex/auth.json`
- 题图自动裁到 900×383；解释图不裁

**解释图必须在 markdown 里被引用**——`article.md` 要有 `![](./illustration.png)` 一行，否则草稿里看不到。

**⚠️ 正文里除 `cover.png` / `illustration.png` 外的图不会自动上 CDN。** 用户给的本地截图（如 `img-xxx.png`）每张先 `md2wechat upload_image img-xxx.png --json` 拿 `data.wechat_url`，再替换 `article.md` 里的本地路径。验证：`grep -c mmbiz content.html` = 正文图片数，`grep -c 'img-' content.html` = 0。

默认插入位置：**正文最后落点之后**（有 `## 后注` 放后注前；有 `## 安装方法` 放安装方法前）。

**绝不给解释图写引导语**——不写「整件事画起来是这样」「如图所示」之类，图自己说话。详见 [[no-illustration-caption]]。

> 安全网：`illustration.png` 存在但 `article.md` 没引用时，`upload-draft.sh` 自动插入并改写，幂等。

### Step 5: 输出文件包

在工作目录（默认 `~/wechat-publish/articles/`）创建：

```
articles/2026-05-09-{slug}/
├── article.md           # 润色后的 markdown
├── cover.png            # 题图 900×383
├── illustration.png     # 解释图
├── meta.json            # { title, summary, author, date, slug }
└── original.md          # 用户原始输入
```

`{slug}`：拼音首字母 + 关键词，30 字符内。

### Step 5.5: 发布前选标题（硬关卡，必须等用户回复）

**触发**：文件包就绪、即将跑 `upload-draft.sh` 之前。**这一步不可跳过、不能自作主张选**——必须停下来，把标题选项发给用户、等用户回一个字母再继续。

给 **4 个候选**，排版成一目了然的列表：

- **A) 原标题**——即 `meta.json` 里现有的 `title`，原样列出（让用户知道「不改」长什么样）
- **B / C / D) 更有冲击力的三个**——比原标题更抓人、张力更足，但仍守王建硕红线：**不标题党、不夸张、不「震惊 / 必看 / 颠覆」、不营销腔**。冲击力来自真东西（反直觉的结论、具体的数字、尖锐的对比、话说一半的钩子），不是形容词堆砌。

发完候选后说一句：「回 A 用原标题，或 B/C/D 选新的，也可以自己给一个。」然后**停**。

用户选定后：
1. 若选 B/C/D 或自拟 → 用 `python3` 把 `meta.json` 的 `title` 改成选中的那条（`cover.png` 已生成，不必因标题变化重画题图，除非用户要求）
2. 选 A 或没回 → 标题不动
3. 再继续 Step 6 发布

### Step 6: 发布（`upload-draft.sh`）

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh <workspace>/articles/YYYY-MM-DD-{slug}
```

脚本做的事：

1. 跑 `pangu.py` 加盘古之白
2. `md2wechat upload_image cover.png` → 拿 `thumb_media_id`
3. `illustration.png` 存在但没引用时自动插入并 upload 拿 CDN URL（幂等安全网）
4. **注入「最近文章」链接列表**（`build-recent-articles.py`，默认开，见下节）
5. 从 `article.md` 生成 `content.html`（转换规则见下）
6. 装 `draft.json`，调 `create_draft` 或（`publish.json` 有 `draft_media_id` 时）`draft/update` 原地更新
7. 自动打开草稿：macOS 走 `scripts/open-draft-edit.sh`——读已登录浏览器的 session token、按标题查出 `appmsgid`、**直达这一篇的编辑页**（没登录则回退开首页）；Linux 开 `mp.weixin.qq.com` 首页。`WECHAT_PUBLISH_NO_OPEN=1` 关掉
8. 自动 `git add / commit / push` 文章目录到 origin

### 文末「最近文章」列表（自动）

每次发布，`upload-draft.sh` 会在文末自动挂一个**最近已发布文章**的链接列表（默认 5 篇），用微信编辑器原生的文章超链接格式（`mp_article_text_link` + `data-linktype="2"`，同账号 `/s/` 链接才点得动）。

机制 = **本地账本 + 离线渲染**，发布步骤零网络、确定性、离线可跑：

- **账本**：每篇 `publish.json` 里的 `permalink`（`https://mp.weixin.qq.com/s/…`）+ `published_at`。
- **渲染**：`build-recent-articles.py <article-folder>` 扫同级 `*/publish.json` 里有 `permalink` 的文章，按 `published_at` 倒序取最近 N 篇（排除本篇），在 `article.md` 的 `<!--RECENT_ARTICLES_START/END-->` 标记区内**幂等重写**一个 raw-HTML 块（`content.html` 构建器原样透传，微信忽略注释）。账本为空就不挂，从不报错、从不阻断发布。
- 单独跑/预览：`build-recent-articles.py <folder> --print`（只打印不写）；`--count N` 改数量。
- 关掉：`WECHAT_PUBLISH_NO_RECENT=1`；改数量：`WECHAT_RECENT_COUNT=8`。

**账本怎么来 — `backfill-permalinks.py`（偶尔跑一次）**：`permalink` 只有文章正式发布后、从公众号后台才拿得到（草稿→发布是手动点的，不回流）。这个脚本调网页后台 `appmsgpublish`（已发布列表）拉全账号，**按标题精确匹配**把 `permalink`/`published_at` 写回各 `publish.json`。只精确匹配——发布标题常和 `meta.title` 不一样，模糊匹配会写错链接，对不上的会列出来留你手动处理。

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/backfill-permalinks.py [articles根目录] [--dry-run]
```

鉴权走**网页 session**（不是发布 API 的 access_token），cookie 几小时过期，所以是「偶尔维护」不是每次发布都跑。三个值任选其一给：① 环境变量 `WECHAT_MP_COOKIE` / `WECHAT_MP_TOKEN` / `WECHAT_MP_FAKEID`；② 会话文件（默认 `~/.config/wjs-wechat/mp-session.env`，里面 `export` 同名三个变量）。抓法：登录 mp.weixin.qq.com → 内容管理 → 已发布 → DevTools Network 找 `appmsgpublish` 请求 → Copy as cURL，`token`/`fakeid` 在 URL 里，`Cookie` 在请求头。

> `upload-draft.sh` 发布时若检测到上述凭据/会话文件，会**先尽力刷新账本**再注入（非致命，过期就跳过）；没配就直接用现有本地账本。配好会话文件后，发布即「自动回填 + 自动挂最近文章」一步到位。

**article.md 写作约束**（影响 Claude 怎么写；其他 HTML 细节脚本自理）：

- 支持 `<p>` / `<h2>` / `<h3>` / `<img>` / `<strong>` / `<em>` / `<code>` / `<ul>` / `<ol>` / `<li>` / pipe table
- **Raw HTML 块透传**：以 `<` 开头的块原样输出，整段必须是一个块，**内部不能有空行**
- **段内多行 → `<br>` 分行**（用于排比 / 并列短句）：**硬规则：行尾绝不能是逗号「，」**，分行边界只能落在句末标点（。？！）之后

**环境变量**：
- `WECHAT_PUBLISH_FORCE_NEW=1` — 强制建新草稿（不复用 `draft_media_id`）
- `WECHAT_PUBLISH_NO_OPEN=1` — 不自动打开浏览器
- `WECHAT_PUBLISH_NO_PUSH=1` — 不自动 push
- `WECHAT_PUBLISH_NO_RECENT=1` — 不注入文末「最近文章」列表
- `WECHAT_RECENT_COUNT=N` — 「最近文章」列出几篇（默认 5）
- `WECHAT_MP_COOKIE` / `WECHAT_MP_TOKEN` / `WECHAT_MP_FAKEID` 或 `WECHAT_MP_SESSION`（会话文件路径，默认 `~/.config/wjs-wechat/mp-session.env`）— 配上则发布时自动刷新 permalink 账本

**前置依赖**：
- `md2wechat` CLI 装好且 `WECHAT_APPID` + `WECHAT_SECRET` 配好（`md2wechat config show`）
- **当前公网 IP 在公众号后台白名单**：mp.weixin.qq.com → 设置与开发 → 基本配置 → IP 白名单。漏掉会 `errcode=40164`

**常见 errcode**：`40164` IP 不在白名单 ｜ `45004` `summary` 为空 / 太短 ｜ `40007` 老 `draft_media_id` 被删（脚本自动 fallback 建新）。

成功后到草稿箱 → 手机预览 → 发布。

## 润色启发 / 分段 / 红线 / 改动清单

**全部移到 [`STYLE.md`](./STYLE.md)**——错字模式、分段规则、红线清单、交付前先给改动清单，都在那里。润色前读 STYLE.md，按它执行。

依赖外部 skill：`gpt-image-2-skill`（cover/illustration 生成）+ `/md2wechat`（upload + draft）。

## 完成标准

- [ ] `articles/YYYY-MM-DD-{slug}/` 文件夹存在
- [ ] 含 article.md、cover.png、illustration.png、meta.json、original.md
- [ ] meta.json 字段齐全
- [ ] **定稿前已做隐私扫描**（Step 1.5）——人名 / 餐厅 / 地点等个人隐私信息已泛化或删除，命中项进了改动清单
- [ ] **发布前已给 A（原标题）+ 3 个更有冲击力的候选，并按用户选择定标题**（Step 5.5）
- [ ] 草稿在 mp.weixin.qq.com 后台可见
- [ ] 用户没说"再改改"
