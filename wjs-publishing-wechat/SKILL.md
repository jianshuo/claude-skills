---
name: wjs-publishing-wechat
description: 当用户想写或发布微信公众号文章时使用——他们给出零散思路、草稿或笔记，请你润色、生成题图和解释图，或准备上传到 mp.weixin.qq.com。触发词："写一篇微信文章"、"公众号"、"润色"、"题图"、"发公众号"、"/wjs-publishing-wechat"。
---

# wjs-publishing-wechat

帮用户写微信公众号文章。**轻润色，不重写。** 自动生成题图和解释图，一行命令推草稿。

## 核心原则

**保留作者的语气和节奏。** 你只做四件事：

1. 修明显错字和重复字
2. 调整段落（每段 1–3 句）
3. 抚平特别拗口的句子（保守，能不动就不动）
4. 准备配套素材（题图、标题候选、摘要）

**不要做**：改用词偏好；加 AI 味连接词（"首先 / 其次 / 综上所述 / 值得注意的是"）；把口语改书面；加 emoji；重组段落顺序；"提升"作者表达。

**改动尺度**：改的字数超过原文 5% 就是改太多了，退回去。

## 长度与例子（硬约束）

**默认 800–1000 字。** 第一稿就按预算写，不要写完再砍——砍出来的文章会残留拼接感。超 1200 回去再砍一轮。

写例子段时过这把尺：**这个例子是真具体（真事 / 真人 / 真数字），还是为演示框架编的？** 后者直接删，让 `illustration.png` 承担"演示结构"。

- **优先保留**：开头钩子 + 核心框架 + 1 句点睛 + 软着陆结尾
- **优先砍掉**：演示性例子、重复阐释、"怎么用 / 入口在哪"这类 instructional 段落

**默认不写 `## 后注`**，除非真有必要的致谢或来源标注，否则正文最后落点收束即可。

数字数：

```bash
python3 -c "import re; t=open('article.md').read(); t=re.sub(r'\!\[.*?\]\(.*?\)','',t); print(len(re.findall(r'[一-鿿]',t)) + len(re.findall(r'[A-Za-z]+',t)))"
```

## 加粗加红（每篇必须有）

`upload-draft.sh` 把 `**...**` 渲染成**红色粗体**——作者刻意要的视觉重点。**每篇正文都必须有合理加粗，一处都没有 = 没写完。**

- **2–4 处**，打在点睛句、关键结论、核心概念词上
- 优先加：每节一句话结论、全文情绪落点、读者最该记住的那句
- 不要加：整段、过渡句、罗列项（命令用 `` `code` ``）；标题（H2/H3）已有字重，不再 `**` 包

## 盘古之白

中英之间留空格——「用 AI 写 skill」。`upload-draft.sh` 自动跑 `scripts/pangu.py`，Claude 不用手动。

## 命令 / 代码：独立成段，用代码样式

正文出现安装 / 运行命令时**默认拉出来单独成段**，别混在叙述句里写成 inline。两种写法：

- **首选**——淡底色代码块（raw HTML 块，整段一行，内部不能有空行）：
  ```
  <section style="background:#f6f8fa;border-radius:6px;padding:14px 16px;overflow-x:auto;font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.8;color:#24292e;">npm install -g xxx<br>xxx run</section>
  ```
- 或 fenced ```` ```bash ```` 块，脚本转成独立 `<p><code>…</code></p>`

句中只提命令名 → inline `` `code` `` 即可。

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

### Step 2: 标题候选

给 **3 个候选**：A) 直白型；B) 故事型；C) 原文里最有味道的一句。不做标题党、夸张、"震惊"、"必看"。

### Step 3: 摘要（50–80 字）

不是第一段的复制；一句话说清读者会获得什么；用作者语气，不是营销腔。

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

### Step 6: 发布（`upload-draft.sh`）

```bash
~/.claude/skills/wjs-publishing-wechat/scripts/upload-draft.sh <workspace>/articles/YYYY-MM-DD-{slug}
```

脚本做的事：

1. 跑 `pangu.py` 加盘古之白
2. `md2wechat upload_image cover.png` → 拿 `thumb_media_id`
3. `illustration.png` 存在但没引用时自动插入并 upload 拿 CDN URL（幂等安全网）
4. 从 `article.md` 生成 `content.html`（转换规则见下）
5. 装 `draft.json`，调 `create_draft` 或（`publish.json` 有 `draft_media_id` 时）`draft/update` 原地更新
6. macOS / Linux 自动打开 `mp.weixin.qq.com` 草稿箱
7. 自动 `git add / commit / push` 文章目录到 origin

**article.md 写作约束**（影响 Claude 怎么写；其他 HTML 细节脚本自理）：

- 支持 `<p>` / `<h2>` / `<h3>` / `<img>` / `<strong>` / `<em>` / `<code>` / `<ul>` / `<ol>` / `<li>` / pipe table
- **Raw HTML 块透传**：以 `<` 开头的块原样输出，整段必须是一个块，**内部不能有空行**
- **段内多行 → `<br>` 分行**（用于排比 / 并列短句）：**硬规则：行尾绝不能是逗号「，」**，分行边界只能落在句末标点（。？！）之后

**环境变量**：
- `WECHAT_PUBLISH_FORCE_NEW=1` — 强制建新草稿（不复用 `draft_media_id`）
- `WECHAT_PUBLISH_NO_OPEN=1` — 不自动打开浏览器
- `WECHAT_PUBLISH_NO_PUSH=1` — 不自动 push

**前置依赖**：
- `md2wechat` CLI 装好且 `WECHAT_APPID` + `WECHAT_SECRET` 配好（`md2wechat config show`）
- **当前公网 IP 在公众号后台白名单**：mp.weixin.qq.com → 设置与开发 → 基本配置 → IP 白名单。漏掉会 `errcode=40164`

**常见 errcode**：`40164` IP 不在白名单 ｜ `45004` `summary` 为空 / 太短 ｜ `40007` 老 `draft_media_id` 被删（脚本自动 fallback 建新）。

成功后到草稿箱 → 手机预览 → 发布。

## 润色启发

错字模式：
- "的得地"误用（按语法）
- 重复字："我我"、"是是"、"了了" → 删一个
- 同音字（"在" vs "再"，"做" vs "作"）

分段时机：
- 一句话讲完一个意思，下一句换主语 → 分段
- 句首出现"但是 / 不过 / 所以 / 后来" → 考虑分段
- 一段超过 80 字 → 找最近句号分

不分段：排比句、列举、对话（按对话格式）。

## 不要这么做

| 不要 | 原因 |
|------|------|
| "我觉得" → "笔者认为" | 改变作者身份 |
| 加小标题打断行文 | 微信读者不需要导航 |
| 删句尾"吧/呢/啊" | 删了就不是这个人写的 |
| 加"欢迎关注 / 点赞在看" | 作者自己决定 |
| "今天" → 具体日期 | 作者用"今天"是有意为之 |
| 自己加举例 / 引用 / 数据 | 这是写作，不是补全 |
| 改完没给 diff 直接全文输出 | 用户看不见你改了什么 |
| 文章超过 1500 字 | 多半某段空例子在撑场，砍掉它 |
| 为演示框架编一段完整例子 | 让 `illustration.png` 承担 |

## 先给改动清单

润色完**先告诉用户改了什么**，再问要不要继续：

```
我改了 7 处：
1. L3: "我我觉得" → "我觉得"（重复字）
2. L8: 长段落 (120字) 拆成两段
...

要看完整结果吗？
```

改动 ≤ 3 处可直接给完整结果。

依赖外部 skill：`gpt-image-2-skill`（cover/illustration 生成）+ `/md2wechat`（upload + draft）。

## 完成标准

- [ ] `articles/YYYY-MM-DD-{slug}/` 文件夹存在
- [ ] 含 article.md、cover.png、illustration.png、meta.json、original.md
- [ ] meta.json 字段齐全
- [ ] 草稿在 mp.weixin.qq.com 后台可见
- [ ] 用户没说"再改改"
