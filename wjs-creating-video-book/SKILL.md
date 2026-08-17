---
name: wjs-creating-video-book
description: Use when the user wants a book turned into a YouTube 讲书/解读视频 — they give a book title (中文或英文) or a PDF/EPUB/笔记 file and want a 1920×1080 横屏中文讲书视频, published to the 王建硕 YouTube channel. Triggers — "把这本书做成视频", "讲书视频", "解读这本书", "讲一讲《X》", "book explanation video", "/wjs-creating-video-book <书名|文件>".
---

# wjs-creating-video-book

把一本书做成 **1920×1080 横屏、4-8 分钟** 的中文 YouTube 讲书视频：王建硕视角的讲书稿 + Volcano TTS 旁白 + HyperFrames CSS/GSAP 章节化动画 + 抽象水彩背景，渲染后上传 YouTube。

**REQUIRED BACKGROUND:** 视觉系统（色彩 / 字体逻辑 / 布局 / 转场 / Modern Motion Techniques / SFX / HyperFrames 工程坑）全部继承 `wjs-converting-text-to-video`。**先读那个 SKILL.md**，本 skill 只写差异。

## What this skill produces

| 维度 | 默认 |
|---|---|
| 尺寸 | 1920×1080 横屏 (16:9) — 这是和文章短视频最大的差异 |
| 时长 | 4-8 分钟（讲书需要展开，不是 90 秒 punch）|
| 结构 | Hook → 一句话立论 → 3-5 个核心观点（每个观点 2-4 scene）→ 我怎么用 → 收尾 CTA |
| Scene 数 | 12-24 |
| 旁白 | 火山引擎 Volcano TTS，默认 `zh_male_ahu_conversation_wvae_bigtts`（阿虎对话）|
| 背景 | GPT Image 2 抽象水彩（横屏 1920×1088）+ blur 30 + 暖黑 overlay |
| 项目目录 | `~/code/book-videos/<book-slug>/` |
| 输出 | `<book-slug>.mp4` + `thumbnail.jpg` + `UPLOAD_META.md` |
| 发布 | `wjs-uploading-video` 上传（横屏 → 普通 video，非 Shorts），默认 public |

## When this skill fires

- 用户给一本书（书名 / PDF / EPUB / 读书笔记），说「做成视频」「讲一讲这本书」「解读一下」
- 用户跑 `/wjs-creating-video-book <书名或文件路径>`

## When NOT to use

- 输入是自己写的文章 `article.md` → `/wjs-converting-text-to-video`（竖屏 30-90s）
- 要竖屏短视频版讲书（视频号/Shorts）→ 先用本 skill 出稿，再走 `/wjs-converting-text-to-video` 的竖屏管线
- 要把书整本朗读成有声书 → `/wjs-voicedrop-reading-aloud`
- 要写书评文章发公众号 → `/wjs-publishing-wechat`

## Core Principle

**讲书不是书摘。书是引子，讲的是"我读完之后怎么看"。**

一支平庸的讲书视频复述目录：「第一章讲了 X，第二章讲了 Y」。一支王建硕式的讲书视频只挑 3-5 个真正扎人的观点，每个观点配一个自己的经历、一个家常类比、或一个反直觉的推论 —— 观点是书的，例子和判断是自己的。写稿时调用 `wangjianshuo-perspective` skill 保持语气：平实、断言、具体和抽象之间架梯子。

**版权红线**：讲书是评论 + 解读（合理使用），不是朗读。直接引用原文每处 ≤ 2 句，全片 ≤ 5 处，其余全部用自己的话重述。

## Workflow

### Step 0: Bootstrap 项目目录

```bash
SLUG=<book-slug>   # 优先用书的英文名做短 slug（如 naval-almanack）；没有英文名才用拼音
BOOK=~/code/book-videos/$SLUG
mkdir -p $BOOK
~/.claude/skills/wjs-converting-text-to-video/scripts/bootstrap-project.sh $BOOK

# bootstrap 默认竖屏 —— 讲书是横屏，必须改 meta.json：
cat > $BOOK/video/meta.json <<'EOF'
{ "name": "wjs-book-video", "width": 1920, "height": 1080, "fps": 30 }
EOF
```

bootstrap 会复制 `tts_narration.py`、生成 `hyperframes.json` / `package.json`、合成 SFX。它会提示「no illustration.png」— 忽略，bg 由 Step 5 生成。

### Step 1: 拿到书的内容 → `notes.md`

按输入类型：

| 输入 | 做法 |
|---|---|
| PDF | 直接 Read（分页读，抓核心章节）|
| EPUB | `pandoc book.epub -t plain -o book.txt` 后读 |
| 只有书名 | 用自己的知识写出核心框架；关键数据 / 出版信息用 WebSearch 核实 |
| 用户笔记 | 以笔记为准，书的框架做补充 |

产出 `notes.md`：书的一句话主张、核心概念清单（每个概念一段解释 + 书中的关键例子）、金句候选（标注出处章节）、值得质疑的点。

**禁止编造**：没核实过的引文一律不写成引号引用；不确定的数据不进稿。

### Step 2: 写讲书稿 → `script.md`

调 `wangjianshuo-perspective` 定语气。**1100-2100 字**（中文 TTS ≈ 4.5 字/秒 → 4-8 分钟音频；成片 ≈ 音频长度 + 收尾缓冲，所以字数直接决定片长）。

结构（这也是后面 scene 的章节骨架）：

1. **Hook**（≤3 句）— 一个反直觉的问题或断言，不是「今天给大家介绍一本书」
2. **立论**（1 段）— 这本书用一句话说什么 + 我为什么觉得它值得讲
3. **观点 × 3-5** — 每个观点：书里怎么说（1-2 句）→ 我自己的例子/类比（这是重头）→ 一个推论或判断
4. **我怎么用**（1 段）— 读完之后我实际改变了什么，具体到动作
5. **收尾**（≤3 句）— 一句话收束 + CTA（「这本书值得你自己翻一遍」之类，不要「一键三连」腔）

**旁白文字规则**（同 `wjs-converting-text-to-video` Step 2）：口语、短句；不写 `——` 破折号（TTS 会念出"破折号"）、不写括号注释、不留 markdown 加粗；不提百姓网 facts。

### Step 3: 拆 scene → `video/narration_chunks.json`

格式同 sibling：`[{"id": "s01", "text": "..."}]`。

- 每个观点章节 2-4 个 scene；每 scene 旁白 5-18 秒（讲书比短视频呼吸长，但仍要短长交替）
- **章节边界必须是强转场** — 主用 T2 white flash；T4 color flash 长片放宽到全片 ≤3 次（覆盖 sibling 的 ≤2 规则）。章节内部用 T1/T3
- Scene Mix Rule（sibling Step 1b）整体适用，按 4-8 分钟等比放大：每个章节内 ≥2 种模板类型；全片 A3 color-flip 2-4 个；B1 双行 strikethrough 全片 ≤4 个

### Step 4: TTS

```bash
cd $BOOK/video
set -a && source ~/code/.env && set +a     # VOLC_TTS_APPID / VOLC_TTS_ACCESS_TOKEN
uvx --with requests python tts_narration.py   # → narration.mp3 + timing.json
```

声音选择、Volcano 的坑（不传 emotion、不用 kokoro、避开 jieshuonansheng）全部见 sibling Step 3。**长稿注意**：任何一段 chunk 出现 >3 字/秒的异常时长 = hallucinate，拆短重合成。

### Step 5: 横屏水彩背景

```bash
~/.claude/skills/wjs-converting-text-to-video/scripts/generate-bg.sh $BOOK reflection 1920x1088
```

第三个参数 `1920x1088` 是横屏尺寸（该脚本默认竖屏，别漏）。theme 按书的气质选：思维/心理类 `reflection`、商业/科技类 `tech`、成长类 `growth`、警世类 `warning`。输出 `video/bg.png`。

### Step 6: HyperFrames composition（横屏差异点）

Composition 骨架、bg-image/overlay 层、色彩系统、motion、`<audio>` 必须带 id 等工程规则全同 sibling Step 5，改 `data-width="1920" data-height="1080"`，body 尺寸同改。**横屏专属差异**：

| 项 | 竖屏 (sibling) | 横屏（本 skill）|
|---|---|---|
| Punch hero 字号 | 280-400px | 200-320px（屏更矮，超 320px 会溢出）|
| 长句 hero | 100-150px | 90-140px，一行能放 12-16 字，少分行 |
| 网格 | 2×N | 3×N / 4×N 横排卡片可用了 |
| 左右分屏 B2 | 偶尔 | **主力模板** — 左观点右例子、左书里右现实 |
| 常驻元素 | 无 | 左下角小字书名+作者（opacity 0.5, 28px, 全片常驻，z-index 3, 放 scene 外）|
| 章节标号 | 无 | 每章节首 scene 一个大编号 01-05 + 章节题 |

**第一帧规则**（硬性，同 sibling）：t=0 必须 bg-image 可见 + s1 标题可见（不 from opacity:0），s1 不是 color-flip。

### Step 7: SFX

`video/sfx/{tick,chime,bell}.mp3` 已由 Step 0 bootstrap 生成，接入 timeline 的方法同 sibling Step 6。讲书片长，额外规则：**bell 只用在全片唯一的 climax**（通常是「我怎么用」章节的落点），章节切换用 tick。

### Step 8: Lint + Inspect + Render

```bash
cd $BOOK/video
npx hyperframes lint            # 0 errors
# inspect 的时间点从 timing.json 取：每个章节首 scene 的 start + 1s，全部列上
npx hyperframes inspect --at <t1,t2,...>   # 0 errors
npx hyperframes render --quality standard --fps 30 --output ../$SLUG.mp4
```

长片渲染慢（standard 下 6 分钟片约 8-12 分钟），先用 `--quality draft` 迭代，最终出片用 standard。

### Step 9: 缩略图 `thumbnail.jpg`

用视频帧 + 大字，不另画 AI 插画（同封面约定）：

```bash
# 挑立论 scene 的一帧（视觉最有代表性的时刻）
npx hyperframes snapshot --at <t> .
ffmpeg -y -i snapshots/<frame>.png -vf scale=1280:720 ../thumbnail.jpg
```

如果帧本身文字不够大，就在 composition 里临时做一个 thumbnail 专用 scene（书名 + 一句钩子，字号拉满）再 snapshot。uploader 不支持 API 设缩略图 —— 提醒用户在 YouTube Studio 手动设置。

### Step 10: 写 `UPLOAD_META.md` + 上传

```markdown
# <slug>.mp4
- title: 《书名》讲了什么？<一句话钩子>
- description: <2-3 段：这本书是什么 + 视频讲了哪几个观点> + 章节 timestamps（00:00 开场 / 00:35 观点一 …，从 timing.json 换算）
- tags: 讲书,书评,<书名>,<作者>,读书
```

```bash
python3 ~/.claude/skills/wjs-uploading-video/scripts/upload_youtube.py \
  --video ~/code/book-videos/$SLUG/$SLUG.mp4 --meta ~/code/book-videos/$SLUG/UPLOAD_META.md
```

横屏 → 普通 video（标题不加 #shorts）。默认 public；上传完把视频链接回给用户，并提醒手动设缩略图。**不走** 文章视频那条 daily cron（那是给批量竖屏 Shorts 的）。

## 目录结构

```
~/code/book-videos/<slug>/
├── notes.md                  # Step 1 书的要点
├── script.md                 # Step 2 讲书稿
├── <slug>.mp4                # ⭐ 最终视频
├── thumbnail.jpg             # YouTube 缩略图（手动设）
├── UPLOAD_META.md
└── video/                    # 中间产物（同 sibling 结构）
    ├── narration_chunks.json / tts_narration.py / narration.mp3 / narration/ / timing.json
    ├── bg.png / sfx/ / index.html / hyperframes.json / snapshots/
```

## Anti-Patterns（本 skill 特有；通用反模式见 sibling）

| 不要 | 原因 |
|------|------|
| 复述目录（第一章…第二章…）| 那是书摘，不是讲书。只挑 3-5 个扎人观点 |
| 观点全是书里的例子 | 例子必须换成自己的经历/类比，观点书的、例子自己的 |
| 编造引文 / 未核实的数据进稿 | 讲书视频公开发布，错引原文很难看 |
| 大段朗读原文 | 版权红线：直接引用每处 ≤2 句、全片 ≤5 处 |
| 竖屏字号表照搬横屏 | 横屏矮，hero 超 320px 必溢出；inspect 必跑 |
| 全片居中大字 | 横屏优势是宽 — 左右分屏、3-4 列网格用起来 |
| 硬撑到 8 分钟 | 观点讲完就收，5 分钟的好片 > 8 分钟的水片 |
| 「一键三连」「记得订阅点赞」腔 | 不是这个频道的语气；CTA 是「值得你自己翻一遍」式 |
| 缩略图另画 AI 插画 | 用视频帧 + 大字（同封面约定）|

## Dependencies

同 `wjs-converting-text-to-video`（HyperFrames CLI / GPT Image 2 / Volcano TTS env / ffmpeg），外加：
- **wjs-uploading-video** — 上传（Step 10），OAuth token `~/.config/youtube/token.json`
- **pandoc** — EPUB 转文本（`brew install pandoc`，仅 EPUB 输入需要）
- **wangjianshuo-perspective** skill — Step 2 写稿语气
