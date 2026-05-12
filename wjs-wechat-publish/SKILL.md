---
name: wjs-wechat-publish
description: Use when the user wants to write or publish a 微信公众号 (WeChat Official Account) article — they share rough thoughts, a draft, or notes and ask for help polishing, generating a cover image (题图) and explanation illustration (解释图), or preparing the article for upload to mp.weixin.qq.com. Triggers include "写一篇微信文章", "公众号", "润色", "题图", "发公众号", "/wjs-wechat-publish".
---

# wjs-wechat-publish

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

## When This Skill Fires

- 用户提供一段思路、草稿、或语音转写文字
- 用户说"帮我写一篇公众号"、"润色一下"、"准备发布"
- 用户在公众号写作工作目录下工作（默认 `~/wechat-publish/` 或 `~/code/wechat-publish/`，可由用户配置）

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

**先问用户题图怎么处理**:

> 题图想怎么处理？
> A) 我有图片，我提供路径
> B) **AI 生成（gpt-image-2 via Codex，按词义出概念图，每张约 $0.05–0.20）**
> C) 跳过，待会儿手动处理

**如果选 A**：把用户提供的图片复制到文章目录，重命名为 `cover.png`/`cover.jpg`。

**如果选 B**：

```bash
~/.claude/skills/wjs-wechat-publish/gen-cover-ai.sh <article-folder> ["目标字词"]
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
~/.claude/skills/wjs-wechat-publish/gen-illustration.sh <article-folder>
```

- 读 `article.md` 全文,作为 instructions 传给 gpt-image-2
- 模型理解文章核心结构后,生成扁平卡通解释图
- **不裁剪**,模型自选画幅(双行对照通常出 3:2,流程类用横长条,层级深度用竖版)
- 输出 `illustration.png`,直接用作正文配图

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
~/.claude/skills/wjs-wechat-publish/upload-draft.sh \
  <workspace>/articles/YYYY-MM-DD-{slug}
```

脚本内部做了 4 件事（用 `md2wechat` 的低层命令，绕过它高层 `convert` 的 API key 限制）：

1. `md2wechat upload_image cover.png` → 拿到 `thumb_media_id`
2. `md2wechat upload_image illustration.png` → 拿到 WeChat CDN `wechat_url`
3. 从 `article.md` 生成 `content.html`（去掉 frontmatter 和正文 H1，段落加内联样式，`./illustration.png` 替换成 CDN URL），再从 `meta.json` 装出 `draft.json`
4. `md2wechat create_draft draft.json` → 返回草稿 `media_id`

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
~/.claude/skills/wjs-wechat-publish/upload-draft.sh \
  /Users/jianshuo/code/wechat-publish/articles/YYYY-MM-DD-{slug}
```

成功后输出 `draft media_id`，并在文章目录里留下 `content.html` 和 `draft.json` 两个产物，便于复查或下次直接 `md2wechat create_draft draft.json` 重发。

**Step 6.3 — 后台预览发布**

登录 https://mp.weixin.qq.com → 草稿箱 → 找到刚上传的文章 → 手机预览 → 发布。

**如果出错**：
- `errcode=40164 not in whitelist`：把当前公网 IP 加进 WeChat MP 后台白名单
- `errcode=45004`：`meta.json` 的 `summary` 为空或太短
- 封面相关：确认 `cover.png` 路径正确、尺寸 ≥ 900×383
- token / appid：`md2wechat config validate` 看配置

**Optional — 高级排版**：如需第一屏判断、CTA、作者名片等模块，在 `article.md` 加 `:::block` 语法（需要 `MD2WECHAT_API_KEY` 才能渲染）。本 skill 默认不加，保持作者原文清洁。

输出给用户的最后一段话，固定格式：

```
准备好了。文章在 articles/YYYY-MM-DD-{slug}/

发布（一行）：
  ~/.claude/skills/wjs-wechat-publish/upload-draft.sh \
    articles/YYYY-MM-DD-{slug}

成功后到 mp.weixin.qq.com 草稿箱预览 / 发布。

article.md 是源文件，下次改用这个。
```

## File Layout (skill 自身)

```
~/.claude/skills/wjs-wechat-publish/
├── SKILL.md                       # 本文件
├── cover-prompt.md                # AI 题图 prompt 模板（[目标字词] 占位符）
├── gen-cover-ai.sh                # 题图: 2.35:1 强约束, 自动裁到 900×383
├── illustration-prompt.md         # AI 解释图 prompt 模板（[文章内容] 占位符）
├── gen-illustration.sh            # 解释图: 比例自适应, 不裁剪
└── upload-draft.sh                # Step 6 主路径：upload_image × 2 + create_draft
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
6. 用 AskUserQuestion 问题图选择（A 用户提供 / B AI 生成 / C 跳过）
7. 生成题图（如选 B 跑 gen-cover-ai.sh）+ 解释图（自动跑 gen-illustration.sh）
8. 生成 `article.html`、`meta.json`
9. 输出发布指引

## Done When

- [ ] `articles/YYYY-MM-DD-{slug}/` 文件夹存在
- [ ] 包含 article.md、article.html、cover.png、meta.json、original.md
- [ ] meta.json 字段齐全
- [ ] 用户拿到了发布指引
- [ ] 用户没说"再改改"
