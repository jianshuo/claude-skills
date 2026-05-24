---
name: wjs-publishing-wechat
description: Use when the user wants to write or publish a 微信公众号 (WeChat Official Account) article — they share rough thoughts, a draft, or notes and ask for help polishing, generating a cover image (题图) and explanation illustration (解释图), or preparing the article for upload to mp.weixin.qq.com. Triggers include "写一篇微信文章", "公众号", "润色", "题图", "发公众号", "/wjs-publishing-wechat".
---

# wjs-publishing-wechat

帮助用户写微信公众号文章。**轻润色，不重写。** 自动生成题图和解释图，输出可直接粘贴到公众号后台的内容包。

## Core Principle

**保留作者的语气和节奏。** 用户的思路和表达方式是文章的灵魂。你只做四件事：

1. 修明显错字和重复字
2. 调整段落（微信读者习惯短段落，每段 1–3 句）
3. 抚平特别拗口的句子（保守，能不动就不动）
4. 准备配套素材（题图、标题候选、摘要）

**不要做的事：**
- 不要改变作者的用词偏好
- 不要加 AI 味儿的连接词（"首先"、"其次"、"综上所述"、"总而言之"、"值得注意的是"）
- 不要把口语改成书面语
- 不要加 emoji（除非原文有）
- 不要重新组织段落顺序
- 不要"提升"作者的表达——他写他的，你只是清洁工

## 长度与例子（硬约束）

**默认 800–1000 字。** 2000 字算超长，必须有特别理由（系列长文、技术深度文）才能放过。**第一稿就按这个预算写，不要写完再砍**——按预算写出来的文章节奏紧，砍出来的文章会残留拼接感。

**写到例子段时，过一遍这把尺**：

> 这个例子是真的具体（真事 / 真人 / 真数字 / 真细节），还是为了演示框架编出来的？

后者直接删，让 `illustration.png` 自己承担"演示结构"的功能——结构图已经把整套流程画出来了，正文再用文字把同一套结构展开一遍，是双倍的、空的内容。

**优先保留**：开头反差 / 钩子 + 核心框架 + 1 句点睛 + 软着陆结尾。

**优先砍掉**：演示性例子、重复阐释、"怎么用 / 入口在哪"这类 instructional 段落（让被介绍的工具 / skill 的 README 自己说）。

**默认不要写 `## 后注`**。文章在正文最后落点收束即可。只有当**真的有必要**的致谢、来源标注、对前文的重要补充（不是凑数）时才加——比如转述别人的框架必须致谢原作者。"correct me if I am wrong——欢迎拍砖"这类签名收尾，不构成加后注的理由。

写完一定要数字数。`python3 -c "import re; t=open('article.md').read(); t=re.sub(r'\!\[.*?\]\(.*?\)','',t); print(len(re.findall(r'[一-鿿]',t)) + len(re.findall(r'[A-Za-z]+',t)))"`。超过 1200 就回去再砍一轮。

## 加粗加红（每篇必须有，不是可选）

`upload-draft.sh` 会把 markdown 的 `**...**` 渲染成**红色粗体**（`<strong style="color:#ff0000">`）——这是作者刻意要的视觉重点。**每篇文章正文都必须有合理的加粗，一处都没有 = 没写完。**

规则：
- **2–4 处**，打在点睛句、关键结论、核心概念词上。不通篇加，也绝不能零处
- 优先加在：每节的「一句话结论」、全文情绪落点、读者最该记住的那句
- 不要加在：整段、过渡句、罗列项。命令 / 代码用 `` `code` `` 样式或独立代码块，不用加粗
- 标题（H2/H3）已有字号字重，不再 `**` 包

这条**不属于**「不要提升作者表达」的禁区——红色加粗是作者既定风格的一部分，等同于错字和分段，必须补齐。

写完检查：通篇 `**` 成对数在 2–4 之间，且每一处都值得变红。

## 盘古之白（中英之间留空格，每篇必须）

作者要求**中文里所有英文单词/词组前后都留一个空格**——「用 AI 写 skill」「Claude Code 是车」「发过去 13 万字」。纯数字与中文之间不强制（「13万字」可不加），要留白的是**英文**。

机械活，**别靠手敲、靠脚本**（幂等，自动跳过代码块 / 链接 / URL）：

```bash
python3 ~/.claude/skills/wjs-publishing-wechat/scripts/pangu.py <folder>/article.md
```

`upload-draft.sh` 在建草稿时会先对 `article.md` 跑一遍 `pangu.py`，所以走完整发布流程的文章自动带盘古之白；但如果只是手写片段 / 单独生成 tweet，记得自己跑一下。

## 命令 / 代码：独立成段，用代码样式

正文里出现安装 / 运行命令时，**默认拉出来单独成段**，不要混在叙述句里写成 inline `` `npm install` ``（除非只是顺带提一句命令名）。两种写法：

- **首选**——和作者既有风格一致的淡底色代码块（raw HTML 块，整段一行，不能有内部空行）：
  ```
  <section style="background:#f6f8fa;border-radius:6px;padding:14px 16px;overflow-x:auto;font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.8;color:#24292e;">npm install -g xxx<br>xxx run</section>
  ```
- 或 fenced ```` ```bash ```` 块，`upload-draft.sh` 会转成独立的 `<p><code>…</code></p>`。

判断：单独展示一行 / 几行命令 → 用上面的块；只在句中提一下命令名 → inline `` `code` `` 即可。

## 介绍 skill 的文章：末尾必须附 5 平台安装方法

**触发条件**：这篇文章是在介绍 / 推荐 / 解释某个具体的 Claude Code skill（不管是王建硕自己写的，还是别人的）。

**前置 — 确认 skill 已发布**：
- 王建硕自己的 `wjs-*` skill：写完 SKILL.md 后，`~/.claude/skills-publish-hook.sh` 会自动 rsync + commit + push 到 [github.com/jianshuo/claude-skills](https://github.com/jianshuo/claude-skills)，无需手动。可用 `gh api repos/jianshuo/claude-skills/contents/<skill-name>` 确认已上线
- 其他人的 skill：写文章前先确认它在公开 git repo 里。没有的话回头让作者先发布，不要让读者装不到

**末尾必须附下面这段**（直接套用，把 `<SKILL_NAME>` 替换成实际 skill 名）：

```markdown
## 安装方法

不用复制命令。打开你用的 AI agent——Claude Code、Codex、Kimi Code、OpenClaw 都可以，对它说一句：

> 安装 https://github.com/jianshuo/claude-skills/blob/main/<SKILL_NAME>/SKILL.md

它会自己 fetch、放到自己平台的 skill 目录里、提示你重启对话。

用 Hermes 的话直接命令行：

\`\`\`bash
hermes skills install https://github.com/jianshuo/claude-skills/blob/main/<SKILL_NAME>/SKILL.md
\`\`\`

装完之后，对 agent 说一句「<一句最自然的触发语，紧扣这个 skill 的入口>」，就能用。
```

**几条规则**：
1. 这段**不计入** 800–1000 字预算（是附录性工具信息，不是正文）
2. **为什么是"对 agent 说一句话"而不是 `cp -r` 命令**：在 agent 时代，安装 = 让 agent fetch URL 并写到自己平台的 skill 目录。任何能上网的 agent 都能搞定，不需要用户记每个平台的目录路径。`cp -r` 命令对公众号读者过于技术，已经是上一时代的安装方式
3. URL 用 `github.com/<owner>/<repo>/blob/main/<path>` 形式：在浏览器能直接看到内容（读者可以先点开看再决定装不装），LLM agent 也能自动从 blob URL 抽出 markdown 原文（不需要手动转 raw.githubusercontent.com）
4. Hermes 单独列**命令行**形式：因为 Hermes 是 skill registry CLI 而非 chat agent，没有"对它说一句话"的入口，但它的 `hermes skills install <URL>` 接受同一个 URL，是最干净的等价物
5. 最后那句「装完之后，对 agent 说一句『……』」要根据当前 skill 的实际触发语写。例如「我想吃一堑长一智，最近这件事——」/「帮我准备一篇公众号」。**不要漏这一句**——读者装完不知道怎么开始用，整个安装段就白费
6. 通常放在文章最后（默认无 `## 后注`）；如果这篇例外性地有 `## 后注`，安装方法放在后注之前
7. 如果将来出了新的支持 SKILL.md 的 agent 平台，**在第一段平台列表加一个名字即可**（"Claude Code、Codex、Kimi Code、OpenClaw、新平台 都可以"），不需要为它写新一行命令

## When This Skill Fires

- 用户提供一段思路、草稿、或语音转写文字
- 用户说"帮我写一篇公众号"、"润色一下"、"准备发布"
- 用户在公众号写作工作目录下工作（默认 `~/Library/Mobile Documents/com~apple~CloudDocs/my/我的项目/我的创作/wechat-publish/`，可由用户配置）

## Workflow

### Step 0: 接收输入

用户会以以下形式给你内容：
- 完整草稿（最常见）
- 几段散乱的思路 / bullet points
- 一段长文字，没有分段
- 语音转写（可能有错字、重复）

如果输入太散，**问一个问题**："这是想写一篇文章，还是几个独立想法？" —— 但只问这一次。

### Step 1: 轻润色

打开一个 markdown 文件，把用户的内容粘进去。然后**只**做下面这些：

- 修错字（"的得地"乱用、同音字错字、重复字"我我"）
- 段落切分：每 1–3 句一段。微信里长段落很难读
- 拗口的地方做最小改动。如果改动后语气变了，宁可不改
- 标点统一：中文用全角逗号句号，英文/数字之间空格
- 保留原本的开头和结尾——这是作者的标志性特征

**改动的尺度参考：** 如果你改的字数超过原文的 5%，你改太多了。退回去。

### Step 2: 标题候选

给用户 **3 个标题候选**：

- A) 直白型：直接说文章讲什么
- B) 故事型：从一个场景或冲突切入
- C) 用户原文里的一句话：从草稿里摘最有味道的一句

不要做：标题党、夸张、"震惊"、"必看"。

### Step 3: 摘要 (50–80 字)

公众号摘要是发到朋友圈/对话框时的预览。要点：

- 不是文章第一段的复制
- 一句话说清楚读者会获得什么
- 用作者的语气，不是营销腔

### Step 4: 配图（每篇两张）

每篇文章配 **两张图**:

- **题图 cover.png** — 进入文章前的封面,**严格 2.35:1**(900×383, 即 900÷383=2.349),进 WeChat 编辑器封面字段。强字体、强构图、文字主导
- **解释图 illustration.png** — 正文里的配图,**比例由内容决定**(模型自选),帮读者一眼看懂文章核心结构。扁平卡通,有标签和流程

**题图固定走 AI 生成**（不问用户，每张约 $0.05–0.20）：

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/gen-cover-ai.sh <article-folder> ["目标字词"]
```

- 不传第二个参数时，从 `meta.json` 取 `title` 当目标字词
- 内部调用 `gpt-image-2-skill`，**强制走 `--provider codex`**（不再支持 OpenAI API key fallback）
- 默认尺寸 `1536x1024`（最接近 2.35:1 的 landscape），自动 sips 居中裁到 900×383
- 原图保存为 `cover-raw.png`，裁剪后是 `cover.png`
- `cover-prompt.md` 作为 `--instructions`（设计哲学），短生成指令作为 `--prompt`——这样 gpt-5.4 能消化长 prompt 后再调 image_generation 工具
- 可调环境变量：`WECHAT_PUBLISH_IMAGE_SIZE`（默认 `1536x1024`）、`WECHAT_PUBLISH_IMAGE_QUALITY`（默认 `high`）

**前置依赖**：必须装好 `gpt-image-2-skill`：

```bash
git clone https://github.com/Wangnov/gpt-image-2-skill /tmp/g
cp -r /tmp/g/skills/gpt-image-2-skill ~/.claude/skills/
```

并且必须有 Codex 鉴权：
- **唯一支持**：Codex `~/.codex/auth.json`（ChatGPT Plus 计划即可，**不需要 OpenAI 组织验证**，gpt-image-2 的中文字渲染明显比 gpt-image-1 准确）
- **不再支持** `OPENAI_API_KEY` 直连（`--instructions` 仅 Codex provider 支持，且 API 模式会绕过 Codex 的 prompt 优化）

**目标字词**的选择：文章标题往往是长短语（如「AI 能力的三个简单层次」），但 prompt 模板对单字 / 两字词更友好。可以建议用户挑核心概念字词：

> 目标字词用什么？默认是文章标题。建议挑一个核心概念字词（1–4 字），比如「AI 能力的三个简单层次」可以用「三层」或「层次」。

**然后生成解释图**(无需问用户,自动跑):

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/gen-illustration.sh <article-folder>
```

- 读 `article.md` 全文,作为 instructions 传给 gpt-image-2
- 模型理解文章核心结构后,生成扁平卡通解释图
- **不裁剪**,模型自选画幅(双行对照通常出 3:2,流程类用横长条,层级深度用竖版)
- 输出 `illustration.png`,直接用作正文配图

**重要：解释图必须在 markdown 里被引用**——`article.md` 里要有 `![](./illustration.png)` 一行，否则 `upload-draft.sh` 上传的草稿里看不到这张图（虽然图已经传到 CDN）。

默认插入位置：**正文最后落点之后**（默认无后注；如果有 `## 后注` 则放在后注之前；如果有 `## 安装方法` 则放在安装方法之前）——把解释图当作"整件事画起来就是这样"的视觉总结，配一句口语化引导（例如"整件事画出来，大概就是这样："），不要写"如图所示"这种说明文腔。如果解释图只针对某一节（不是全文摘要），就紧跟在那一节正文之后。

> 安全网：如果生成了 `illustration.png` 但 `article.md` 漏掉了这一行引用，`upload-draft.sh` 会自动在最合适的位置（有后注则后注前，否则文末）插入引用并改写 `article.md`，确保结果幂等。但首选还是在 Step 5 写 `article.md` 时就把它放进去。

如果用户对某张图不满意,直接重跑对应脚本——每次结果不同。

### Step 5: 输出文件包

在用户的工作目录下（默认 `~/wechat-publish/articles/`）创建文件夹：

```
articles/2026-05-09-{slug}/
├── article.md           # 润色后的 markdown 源文件
├── article.html         # 转成 HTML，直接粘贴用
├── cover.png            # 题图 900×383 (2.35:1 严格)
├── illustration.png     # 解释图（任意比例，模型自选）
├── meta.json            # { title, summary, author, date, slug }
└── original.md          # 用户原始输入，备份
```

`{slug}` 从标题生成：拼音首字母 + 关键词，限制 30 字符以内。例如"我的第一台 Mac" → `my-first-mac`。

**article.html 转换规则：**
- 用 `pandoc` 或简单的 markdown 解析（不需要复杂样式，公众号编辑器会重新排版）
- 保留段落分隔（`<p>`）
- 保留加粗（`<strong>`）和列表
- 不要内联 CSS——公众号会清掉

```bash
pandoc article.md -f markdown -t html -o article.html
# 如果没有 pandoc:
# 用 Python 的 markdown 包 / Node 的 marked / 或手写最简实现
```

### Step 6: 发布（用 `upload-draft.sh` 走 md2wechat 底层）

文章包准备好后，跑一行就能把文章作为草稿推到公众号后台：

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh \
  <workspace>/articles/YYYY-MM-DD-{slug}
```

脚本内部做了 4 件事（用 `md2wechat` 的低层命令，绕过它高层 `convert` 的 API key 限制）：

1. `md2wechat upload_image cover.png` → 拿到 `thumb_media_id`
2. **如果 `illustration.png` 存在但 `article.md` 没引用**：自动在最合适的位置（有 `## 后注` 则后注前，否则文末）插入 `![整件事画起来，是这样的](./illustration.png)` 并改写 `article.md`（幂等安全网）。然后 `md2wechat upload_image illustration.png` → 拿到 WeChat CDN `wechat_url`
3. 从 `article.md` 生成 `content.html`：
   - 去掉 frontmatter 和正文 H1（避免 md2wechat inspect 的 DUPLICATE_H1 警告）
   - 支持的 markdown 块：`<p>` / `<h2>` / `<h3>` / `<img>` / `<strong>` / `<em>` / `<code>` / `<ul>` / `<ol>` / `<li>` / `<table>`（markdown pipe table）
   - **Raw HTML 块透传**：以 `<` 开头的块（典型用例：`<section style="background:#f7f5f0;…">…</section>` 包一段淡底色 + 灰字的引用 / 注释卡片）会原样输出，不被包成 `<p>`。整段必须是**一个块**——内部不能有空行打断，否则会被切碎。作者自己负责 HTML 合法 + WeChat 编辑器能吃
   - **段落和图片等不写 inline CSS** —— 让微信编辑器的默认 line-height / font-size / color 接管
   - 段落之间用 `<p><br></p>` 作为间距块（和编辑器里手动按两次回车的源码一致；不能省，否则相邻 `<p>` 在没有 margin 的情况下会贴在一起；也不能用 `<br><br>` 或空 `<p></p>`，会被编辑器规范化吃掉）
   - **段内多行 → 自动 `<br>` 分行**：如果一个 markdown 段落（行之间不留空行）写了多行，转 HTML 时每个 `\n` 被替换成 `<br>`，整段还在一个 `<p>` 里。专门给排比 / 并列短句这种「视觉上一行一句、但属于同一段」的写法用——参见 [[wangjianshuo-perspective]] 里的「排比 / 并列短句要分行写，不要分段写」。`**...**` 加粗也可以跨这些行（inline 正则用 `<br>` 而不是 `\n` 作内部边界）
   - **结构性样式例外**（这些 inline style 必须加，不加就破坏可读性）：
     - `<h2>`：`font-size:1.4em; font-weight:bold;`（比正文大两号 + 粗体）
     - `<h3>`：`font-size:1.2em; font-weight:bold;`（比正文大一号 + 粗体）
     - `<strong>`（即 `**...**`）：`color:#ff0000;`（纯红粗体——作者刻意要的视觉点。仅作用于 markdown `**bold**` 转出来的 `<strong>`；raw HTML 块里手写的带显式 inline style 的 `<strong style="...">` 不会被覆盖）
     - `<table>`：`border-collapse:collapse; width:100%;`
     - `<th>/<td>`：`border:1px solid #d9d9d9; padding:6px 10px;`（`<th>` 另加 `background:#f6f6f6`）
     - `<code>`：`font-family:Menlo,Consolas,monospace; background:#f4f4f4; padding:1px 6px; border-radius:3px; font-size:0.92em;`（不加，命令和普通文字混一起看不出是命令）
   - **判定原则**：装饰性样式（行高、颜色、字体）让微信编辑器接管；结构性样式（标题层级、表格边框、代码视觉块）必须 inline——不加就退化成正文 / 几行裸文字，块的意义丢失
   - **Fenced code block (` ```bash ... ``` `)**：脚本自动剥掉 ``` 围栏 **和**语言名（"bash" / "python" 等），转成 `<p><code>…</code></p>`，多行用 `<br>` 连接。不做 `<pre>` —— WeChat 编辑器对 `<pre>` 块不友好，而单行短命令用 inline-styled `<code>` 视觉更干净
   - **命令展示的首选写法**：在 article.md 里直接用 inline `` `...` ``（一对反引号包命令），而不是 fenced ```bash 块。除非真的有多行连续 shell 流程必须用块，否则 inline 比 block 更适合公众号阅读
   - `./illustration.png` 替换成 CDN URL
4. 再从 `meta.json` 装出 `draft.json`
5. **草稿写入 / 更新**：
   - 如果 `publish.json` 里已经有 `draft_media_id`（说明这篇之前发过草稿了），先跑 `update-draft-via-api.py` 复用同一个 media_id 在 backend **原地更新**——WeChat 后台自带版本控制，不会产生新草稿；只有 `draft_updated_at` 时间戳被刷新
   - 老 media_id 被用户在后台删了 → API 返回 `errcode=40007`，脚本自动 fallback 到 `md2wechat create_draft` 建一个新的
   - 想强制建新的（比如要保留旧版做对照）：`export WECHAT_PUBLISH_FORCE_NEW=1`
   - 这条「优先 update」是 2026-05 加的，之前每次都建新草稿——同一篇反复改会污染草稿箱

**为什么自己写 update？** md2wechat 的 CLI 只暴露了 `create_draft`，但 WeChat 后台 API 是有 `draft/update` 的（md2wechat binary 里都能 grep 到这个 URL，只是没接出来）。所以本 skill 用 30 行 Python 直接调，绕过 md2wechat CLI 这层限制。
- 走的是当前 shell 的 `HTTPS_PROXY`（必要！WeChat IP 白名单认的是 proxy 出口 IP，不是本机直出 IP）
- 老 `40007 invalid media_id` 自动 fallback；其他错误（45004 description 超长等）直接 bubble up，跟创建路径一致

**前置依赖**：
- `md2wechat` CLI 已安装并配置好 `WECHAT_APPID` + `WECHAT_SECRET`（`md2wechat config show` 验证）
- **当前公网 IP 已加进公众号后台白名单**：mp.weixin.qq.com → 设置与开发 → 基本配置 → IP 白名单。漏掉这一步会返回 `errcode=40164`，加白名单几十秒生效
- 详细命令、provider 选择、品牌档案，参考 `/md2wechat` skill

**为什么不用 `md2wechat convert --draft`？** 实测发现这条「一键」路径在默认配置下走不通：
- `--mode api`（默认）需要 `MD2WECHAT_API_KEY`（md2wechat.cn 付费云渲染服务），普通用户没有
- `--mode ai` 不直接出 HTML，而是返回一份 prompt 让外部 AI 渲染，不闭环

所以本 skill 用 `upload_image` + `create_draft` 两条底层命令组合，自己拼 HTML 和 draft JSON。`upload-draft.sh` 把这套流程封装成一行。

**Step 6.1 — 可选：先 inspect / preview 检查**

```bash
cd <workspace>/articles/YYYY-MM-DD-{slug}
md2wechat inspect article.md      # 检查元数据、字数、发布就绪状态
md2wechat preview article.md      # 生成本地 HTML 预览（degraded 模式，能看个大概）
```

发布前如想确认元数据有没有超长、摘要是不是空，跑 `inspect`。否则直接跳到 6.2。

**Step 6.2 — 一行发布**

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh \
  "/Users/jianshuo/Library/Mobile Documents/com~apple~CloudDocs/my/我的项目/我的创作/wechat-publish/articles/YYYY-MM-DD-{slug}"
```

成功后输出 `draft media_id`，并在文章目录里留下 `content.html` 和 `draft.json` 两个产物，便于复查或下次直接 `md2wechat create_draft draft.json` 重发。

**Step 6.3 — 后台预览发布**

`upload-draft.sh` 成功后**会自动用默认浏览器打开 `https://mp.weixin.qq.com/`**（macOS 用 `open`，Linux 用 `xdg-open`）。如果浏览器已登录，会直接进 home，点一下「草稿箱」就能看到刚才那条。

要禁用 auto-open（比如批量跑多篇时怕开一堆 tab）：`export WECHAT_PUBLISH_NO_OPEN=1`。

注：草稿的**精确编辑深链** URL 形如 `…appmsg_edit_v2?action=edit&appmsgid=XXX&token=YYY&…`，但 `appmsgid` 是后台数据库内部 ID（不等于 API 返回的 `media_id`），`token` 又是 session-bound，所以**没法**从 API 返回值拼出深链。打开草稿箱让用户选是当前能做的最稳的事。

到草稿箱 → 找到刚上传的文章 → 手机预览 → 发布。

**如果出错**：
- `errcode=40164 not in whitelist`：把当前公网 IP 加进 WeChat MP 后台白名单
- `errcode=45004`：`meta.json` 的 `summary` 为空或太短
- 封面相关：确认 `cover.png` 路径正确、尺寸 ≥ 900×383
- token / appid：`md2wechat config validate` 看配置

**Optional — 高级排版**：如需第一屏判断、CTA、作者名片等模块，在 `article.md` 加 `:::block` 语法（需要 `MD2WECHAT_API_KEY` 才能渲染）。本 skill 默认不加，保持作者原文清洁。

### Step 7（可选）—— API 群发 + 拉留言

**⚠️ 2025-07 政策变化 — 个人主体账号 API 发布权限被回收**

> 自 2025-07 起，微信回收了**个人主体认证账号**（即使有黄色 V）的「发布能力 API」调用权限。`mass/preview` / `mass/sendall` / `freepublish/*` / `comment/*` 全部返回 `errcode=48001`。
>
> **只有「企业主体认证」**（公司营业执照认证）的服务号 / 订阅号才有 API 发布 + 评论拉取权限。
>
> **判断方法**：调用 `mass/preview` 试一次。返回 48001 → 个人主体（这条 Step 7 整段不可用，跳到 Step 8 走 cookie fallback）。返回 0 → 企业主体，下面流程都可用。
>
> **如果你的账号被 48001 卡死**：用 [Step 8 - cookie-based 拉留言](#step-8可选--cookie-fallback拉留言) 替代这一段。

**前提**：公众号是**企业主体认证**订阅号或服务号。个人主体认证（黄 V）也不行——必须是公司主体。

**为什么单独设计成两个命令、不并进 `upload-draft.sh`**：
1. 订阅号每天**只有 1 次** API 群发配额，自动触发跑错就废了
2. 群发跳过"草稿箱后台预览 → 改个错别字"这道人工把关——保留它

**两个命令各自做什么**：

`mass-send.sh <folder> --preview <my-openid>`
- 调 `cgi-bin/message/mass/preview`，把已创建的草稿发给**你自己**的微信
- 不消耗当日群发配额，专用于"群发前最后看一眼实际效果"
- 微信里看 OK 了再走 `--send`

`mass-send.sh <folder> --send`
- 调 `cgi-bin/message/mass/sendall` (`filter.is_to_all=true`)，**真群发给所有粉丝**
- 成功后**自动**调 `cgi-bin/comment/open` 打开这篇的评论功能（不打开拉评论会返回 `errcode=88000`）
- 把 `msg_id` + `msg_data_id` 写回 `publish.json`，下游 `fetch-comments.sh` 凭这个找到这篇

`fetch-comments.sh <folder> [--md|--json|--both]`
- 从 `publish.json` 读 `msg_data_id`
- 翻页拉所有留言（`comment/list` 一页 50 条，自动翻完）
- 默认输出 Markdown 到 `comments.md`（含昵称前缀、时间、精选标记、点赞数、公开回复）；`--json` 输出原始 API payload 到 `comments.json`

**典型流程**（已认证账号）：

```
upload-draft.sh <folder>                        # 创建草稿 + 写 publish.json
mass-send.sh <folder> --preview <my-openid>     # 自己手机里看一眼
mass-send.sh <folder> --send                    # 真群发 + 打开评论
# 等几分钟到几小时让粉丝看到 + 留言
fetch-comments.sh <folder>                      # comments.md 出炉
```

**publish.json 字段**（增量写，永不丢之前的字段）：
- `draft_media_id` / `draft_created_at` — `upload-draft.sh` 写
- `preview_msg_id` / `preview_sent_at` / `preview_to` — `mass-send.sh --preview` 写
- `msg_id` / `msg_data_id` / `mass_sent_at` / `comments_open` — `mass-send.sh --send` 写

**何时不要走这条路**：
- 未认证账号（48001）：去做个人认证再来
- 已经用后台手动群发了这一篇：`msg_data_id` 拿不到了，只能 mp.weixin.qq.com 后台留言管理人肉看 / 导出
- 用 `freepublish/submit` 永久链接发的：不算"群发"、不出现在历史消息、`msg_data_id` 也拿不到——同样只能后台看

**常见 errcode**：
- `48001` — api unauthorized：**最常见原因不是未认证，是 2025-07 政策把个人主体的 API 发布权限回收了**（见本节顶部说明）。换企业主体或走 Step 8 cookie fallback
- `45028` — 当日群发配额已用完
- `88000` — 评论未开启（`mass-send.sh --send` 已经会自动 `comment/open`；如果跳过了 --send 直接拉，会撞这个）

### Step 8（可选）—— Cookie fallback：拉留言（个人主体唯一可用路径）

**适用场景**：公众号是**个人主体认证**（Step 7 的官方 API 路径被 48001 卡死），但仍想 programmatic 拉留言。

**原理**：mp.weixin.qq.com 后台是个 SPA，所有留言数据通过内部 endpoint `mp.weixin.qq.com/misc/appmsgcomment?action=...&token=...&begin=...&count=...` 返回 JSON。带上后台登录的 cookie + URL 里的 session token 就能跑通。

**前提**：浏览器登录了 mp.weixin.qq.com。两条路径，选一条：

#### 路径 A（推荐）：复用 gstack 持久浏览器 — `fetch-comments-via-gstack.sh`

原始 cookie 几小时就过期；但 gstack 维护的 Chromium profile（`~/.gstack/chromium-profile/`）里的登录态实际能撑 **3-14 天**（社区经验值，按 7 天规划比较稳）——只要偶尔有访问保持热度。这条路径把所有手工抓包步骤都消掉了。

**两条死规矩**：
1. **gstack profile 要独占** mp.weixin.qq.com 这个域。**不要**在系统 Chrome / Safari / 其他浏览器同时登录同一个公众号——并发登录会让 gstack 这边的 session 失效，又得重扫码。
2. **失败模式**：当 session 真的死了，请求会返回 HTML 登录页（不是 JSON），脚本会报「non-JSON response → cookie expired, re-grab」。这时跑 `browse goto https://mp.weixin.qq.com/` + 扫码即可。

```bash
# 一次性 setup（per machine）：扫码登录 mp.weixin.qq.com 到 gstack profile
~/.claude/skills/gstack/browse/dist/browse goto https://mp.weixin.qq.com/
# 用手机微信扫码

# 一次性 setup（per article）：保存 appmsgcomment URL 模板
# （URL 是 per-article 稳定的；token 部分脚本会每次从浏览器读最新值替换掉）
echo '<完整 appmsgcomment URL>' > <article-folder>/comment-url.txt

# 之后每次拉留言（零手工步骤）：
~/.claude/skills/wjs-publishing-wechat/scripts/fetch-comments-via-gstack.sh \
  <article-folder> [--md|--json|--both]
```

脚本流程：
1. `browse goto mp.weixin.qq.com/cgi-bin/home` — 刷新会话 + 校验登录
2. `browse url` — 抓当前 `token=`
3. `browse cookies` — 拿全套 cookie，过滤 weixin.qq.com 域，转成 Cookie header
4. 把 `comment-url.txt` 里的 token 替换成最新的
5. 调 `fetch-comments-by-cookie.sh`（下面路径 B 的脚本）跑完拉取

何时会失败：浏览器 profile 被微信踢出登录（异地登录 / 长期不用）。这时脚本会清楚告诉你重跑 `browse goto https://mp.weixin.qq.com/` + 扫码。

#### 路径 B（fallback）：手抓 cookie — `fetch-comments-by-cookie.sh`

gstack 没装、或想一次性快速拉，可以直接走这条：

```bash
# 1. 浏览器抓包（一次性，几分钟）
#    a. 登录 mp.weixin.qq.com → 留言管理 → 找到目标文章
#    b. 打开 DevTools (Cmd+Opt+I) → Network 标签 → 筛选 Fetch/XHR
#    c. 在页面上翻一页评论，或点"加载更多"
#    d. 找请求 URL 含 'appmsgcomment' 的那条，右键 → Copy → "Copy as cURL (bash)"
#    e. 从 curl 命令里抠出 -H 'Cookie: ...' 那段（整段 cookie 字符串）和 URL

# 2. 跑脚本
~/.claude/skills/wjs-publishing-wechat/scripts/fetch-comments-by-cookie.sh \
  <article-folder> \
  --url '<完整 URL，含 begin=0 那一段>' \
  --cookie '<整段 cookie 字符串>'
```

输出：`<article-folder>/comments.md`（同 fetch-comments.sh 格式）。

**caveats**：
- 路径 B 的 cookie 几小时就要重抓——这正是路径 A 存在的理由
- 内部 API 的字段名 / endpoint 可能随后台版本变；脚本用 heuristics 找 `comment_list` / `comments` / `data.list` 等常见字段。如果版本变了，让 Claude 现场 patch 几行 JSON path
- 不要把抓到的 cookie 发到 git 或 chat 公开渠道——它等于你的登录态

输出给用户的最后一段话，固定格式：

```
准备好了。文章在 articles/YYYY-MM-DD-{slug}/

发布（一行）：
  ~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh \
    articles/YYYY-MM-DD-{slug}

成功后到 mp.weixin.qq.com 草稿箱预览 / 发布。

article.md 是源文件，下次改用这个。
```

## File Layout (skill 自身)

```
~/.claude/skills/wjs-publishing-wechat/
├── SKILL.md                       # 本文件
├── README.md                      # 公开版 readme（GitHub 上展示用）
├── prompts/
│   ├── cover-prompt.md            # AI 题图 prompt 模板（[目标字词] 占位符）
│   └── illustration-prompt.md     # AI 解释图 prompt 模板（[文章内容] 占位符）
└── scripts/
    ├── gen-cover-ai.sh            # 题图: 2.35:1 强约束, 自动裁到 900×383
    ├── gen-illustration.sh        # 解释图: 比例自适应, 不裁剪
    ├── upload-draft.sh            # Step 6 主路径：upload_image × 2 + create_draft + 写 publish.json + 打开浏览器
    ├── mass-send.sh               # Step 7（可选, 仅企业主体）：mass/preview 或 mass/sendall + 自动 comment/open
    ├── fetch-comments.sh          # Step 7（可选, 仅企业主体）：拉 msg_data_id 对应的所有留言 → comments.md
    ├── fetch-comments-by-cookie.sh # Step 8（可选, 个人主体唯一可用）：cookie fallback，浏览器抓包后拉留言
    └── publish.sh                 # legacy 备用：浏览器 + 剪贴板手动流（md2wechat 不可用时的兜底）
```

依赖的外部 skill：
- `gpt-image-2-skill`（github.com/Wangnov/gpt-image-2-skill）—— gen-cover-ai.sh / gen-illustration.sh 走这里调 gpt-image-2，**只走 `--provider codex`**（两个脚本已硬编码），需要 `~/.codex/auth.json`。不支持 OpenAI API key 直连
- `/md2wechat` skill / `md2wechat` CLI —— upload-draft.sh 用它的 `upload_image` + `create_draft` 命令（需要 `WECHAT_APPID` / `WECHAT_SECRET`，且当前 IP 在白名单里）

> 注：仓库里仍保留 `publish.sh`（浏览器 + 剪贴板手动发布流），仅作为 md2wechat 配置未就绪 / 不能加 IP 白名单时的备用方案。本 skill 默认路径不再使用它。

> Auto-publish: 本 skill 由 `~/.claude/skills-publish-hook.sh` 自动同步到 [github.com/jianshuo/claude-skills](https://github.com/jianshuo/claude-skills)（每次编辑后自动 commit + push）。

## Polish Heuristics (具体到字)

错字模式 → 改：
- "的得地" 误用：根据语法判断
- 重复字："我我"、"是是"、"了了" → 删一个
- 同音字：考虑上下文（"在"vs"再"，"做"vs"作"）

段落切分时机：
- 一句话讲完一个意思，下一句换主语 → 分段
- 出现"但是"、"不过"、"所以"、"后来"在句首 → 考虑分段
- 一段超过 80 字 → 找最近的句号分

不要分段：
- 排比句、列举（保持节奏）
- 对话（按对话格式）

## Anti-Patterns (绝对不做)

| 不要 | 原因 |
|------|------|
| 把"我觉得"改成"笔者认为" | 改变了作者身份 |
| 加"小标题"打断行文 | 微信读者不需要导航 |
| 把口语句尾"吧/呢/啊"删掉 | 删掉就不是这个人写的了 |
| 在结尾加"欢迎关注"、"点赞在看" | 作者会自己决定要不要 |
| 把"今天"改成具体日期 | 作者用"今天"是有意为之 |
| 自己加举例 / 引用 / 数据 | 这是写作，不是补全 |
| 改动后没给 diff，直接全文输出 | 用户看不见你改了什么 |
| 文章超过 1500 字 | 多半是某段空例子在撑场。砍掉那段，看会不会自然回到 1000 字 |
| 为演示框架编一段完整例子 | 让 `illustration.png` 承担演示。正文只留点睛，不复述结构图 |

## Showing the Diff

每次润色完，**先告诉用户你改了什么**，再问要不要继续：

```
我改了 7 处：
1. L3: "我我觉得" → "我觉得"（重复字）
2. L8: 长段落 (120字) 拆成两段
3. L15: "通过…的方式" → "用…"（口语化保留）
...

要看完整结果吗？
```

如果改动 ≤ 3 处，可以直接给完整结果，不用列 diff。

## Running the Skill (实操步骤)

1. 确认工作目录（默认 `~/wechat-publish/`，可由用户配置）
2. 接收用户输入（粘贴或文件）
3. 写 `original.md`（用户原始输入）
4. 写 `article.md`（润色版）→ 列 diff 给用户
5. 用 AskUserQuestion 问标题候选
6. 自动跑 gen-cover-ai.sh 生成题图 + gen-illustration.sh 生成解释图（不问用户）
7. 生成 `article.html`、`meta.json`
8. 输出发布指引

## Done When

- [ ] `articles/YYYY-MM-DD-{slug}/` 文件夹存在
- [ ] 包含 article.md、article.html、cover.png、meta.json、original.md
- [ ] meta.json 字段齐全
- [ ] 用户拿到了发布指引
- [ ] 用户没说"再改改"
