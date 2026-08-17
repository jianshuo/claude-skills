---
name: wjs-creating-video-book
description: Use when the user wants a book turned into YouTube chapter videos — 每章用 VoiceDrop 读书的有声书 mp3 做音轨，配 GPT Image 2 画面和中心思想大字，输出 1920×1080 横屏视频发 YouTube。Triggers — "把这本书做成视频", "有声书做成视频", "讲书视频", "book video", "/wjs-creating-video-book <书名>".
---

# wjs-creating-video-book

把一本书做成 **按章节的 YouTube 视频**：每一章用 VoiceDrop 读书的有声书 mp3 作为音轨，从章节内容提炼 **1-3 个中心思想**，为每个中心思想设计提示词、用 GPT Image 2 生成画面（Ken Burns 缓推 + 交叉淡化），中心思想以大字叠加在画面上，最终合成 1920×1080 横屏视频，上传 YouTube。

## What this skill produces

| 维度 | 默认 |
|---|---|
| 尺寸 | 1920×1080 横屏 (16:9)，30fps |
| 粒度 | **一章一支视频**（章节 mp3 多长视频就多长）|
| 音轨 | VoiceDrop 读书的章节有声书 mp3（不重新 TTS）|
| 画面 | 每章 1-3 张 GPT Image 2 生成图，Ken Burns 缓推，段间 1s 交叉淡化 |
| 文字 | 每个中心思想：大字标题（≤12 字）+ 一句阐释，淡入淡出，Pillow 渲染 |
| 项目目录 | `~/code/book-videos/<book-slug>/` |
| 输出 | `<slug>-chNN.mp4` × N 章 + `UPLOAD_META.md` |
| 发布 | `wjs-uploading-video` 上传（横屏普通 video），默认 public |

## When this skill fires

- 用户给一本书说「做成视频」「把有声书配上画面发 YouTube」
- 用户跑 `/wjs-creating-video-book <书名或书架章节>`

## When NOT to use

- 要的是 30-90 秒竖屏解说短视频 → `/wjs-converting-text-to-video`
- 只要有声书 mp3、不要视频 → `/wjs-voicedrop-reading-aloud`
- 要写书评文章 → `/wjs-publishing-wechat`

## Core Principle

**这是「听为主、看为辅」的视频。** 音轨是整章朗读，观众是在"听书"；画面的职责是给眼睛一个可以停留的锚点，不是动画表演。所以：

- **中心思想宁少勿多** — 一章挑 1-3 个真正的支柱观点，一张画面停留几分钟是正常的
- **全书一个视觉风格** — 章与章之间画风必须一致（同一媒介、同一色调家族），观众换章时不出戏
- **画面画具象场景，不画抽象概念** — 「杠杆」画一根撬动巨石的长杆，不画"杠杆"两个字或抽象箭头图表
- **版权自查** — 整章朗读原文 + 公开发布，只适用于公版书或用户拥有权利的书；在版权书先向用户确认再发布

## Workflow

### Step 0: 项目目录

```bash
SLUG=<book-slug>   # 优先用书的英文名短 slug（如 naval-almanack）；没有英文名才用拼音
BOOK=~/code/book-videos/$SLUG
mkdir -p $BOOK/chapters/{01,02,...}   # 每章一个两位数目录
```

### Step 1: 每章拿到文本 + 有声书 mp3

| 素材 | 来源（按优先级）|
|---|---|
| 章节 mp3 | ① jianshuo.dev 书架有声书已合成的章节 mp3（R2，见 memory [[jianshuo-dev-audiobook]]）直接下载 ② 没有 → 用 `/wjs-voicedrop-reading-aloud` 从章节文本生成 |
| 章节文本 | 书架页面 / 用户给的 PDF・EPUB（EPUB 先 `pandoc x.epub -t plain`，pandoc 未装先 `brew install pandoc`）|

存为 `chapters/NN/audio.mp3` 和 `chapters/NN/chapter.md`。

### Step 2: 每章提炼 1-3 个中心思想 → `ideas.json`

读 `chapter.md`，挑真正的支柱观点。数量跟着音频长度走：<5 分钟 1-2 个，5-15 分钟 2-3 个，>15 分钟也**最多 3 个**（画面是锚点不是字幕）。

```json
[
  {"title": "杠杆是新的钱",  "caption": "代码和媒体是无需许可的杠杆", "image": "img-1.png", "start": 0},
  {"title": "把自己产品化",  "caption": "独特知识乘以杠杆才有复利",   "image": "img-2.png", "start": 312}
]
```

- `title` ≤12 字（大字）；`caption` 一句话 ≤20 字；都不写标点结尾
- `start`（秒）= 该思想在朗读中开始被讲到的位置，按文本位置比例估算即可；全部省略则均分音频
- 中心思想必须忠于章节内容 — 这不是二次创作，是给听众划重点

### Step 3: 每个中心思想一张画面（GPT Image 2）

先给**全书**定一个风格底稿 `$BOOK/style.md`（只做一次）：**媒介必须是插画类**（editorial illustration / 水彩插画 / 极简扁平插画等，不用照片写实——插画在 Ken Burns 缓推和文字叠加下最耐看）、色调家族、光线气质，2-3 句。

每张图的提示词按**视频友好插画模板**拼装 = 全书插画风格 + 该思想的具象场景 + 固定收尾：

```bash
node ~/.claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs \
  --json --provider codex images generate \
  --prompt "<全书插画风格>. <这个中心思想的具象场景>. Wide horizontal panoramic composition, landscape orientation, cinematic 16:9 framing. Generous negative space, calm lower left area for text overlay. Illustration, not a photograph. No text, no words, no letters." \
  --out $BOOK/chapters/NN/img-1.png --format png --size 1920x1088 --quality high
```

固定收尾三句缺一不可，各治一种实际踩过的坑：

- **"Wide horizontal panoramic composition, landscape orientation"** — Codex 端 `--size` 只是参考，构图实际跟着提示词走；不写这句会返回方图甚至竖图（竖图被 16:9 居中裁剪后损失大半画面）。渲染脚本虽有兜底裁剪，但源头出横图才是正解
- **"Generous negative space, calm lower left area"** — 左下角是中心思想大字的固定落位，画面主体必须避开
- **"No text, no words, no letters" + "Illustration, not a photograph"** — 文字由渲染脚本 Pillow 叠加，AI 画中文必崩；照片写实风在缓推 + 大字下显廉价

其余要求：

- 画具象场景（人、物、光、空间），不画概念图解 / 图表 / 箭头
- 同章多张图之间要有视觉关联（同一空间的不同角度、同一天的不同时辰）
- 生成后检查尺寸：仍出竖图（高 > 宽）就换更明确的横向场景措辞重生成，不要将就

### Step 4: 合成本章视频

```bash
cd $BOOK/chapters/NN
uvx --with pillow python ~/.claude/skills/wjs-creating-video-book/scripts/render-chapter.py .
mv chapter.mp4 $BOOK/$SLUG-chNN.mp4
```

脚本（已在本机验证）做的事：每张图 3840 上采样后 zoompan 缓推（12s 约 1.09×）、段间 1s xfade、中心思想大字 + 阐释句 Pillow 渲染成透明 PNG 后 overlay（1s alpha 淡入淡出，避开段首段尾各 0.8s/0.5s）、章节 mp3 直接做音轨，`-crf 19` 输出。字体自动探测 PingFang → Hiragino Sans GB → STHeiti。

**注意**：本机 ffmpeg 没编译 drawtext，文字必须走脚本里的 Pillow 路径，别试图手写 drawtext 滤镜。

### Step 5: 缩略图（每章）

用视频帧 + 大字（不另画 AI 插画）：挑该章标题字最清晰的一帧：

```bash
ffmpeg -y -ss <标题完全显示的秒数> -i $BOOK/$SLUG-chNN.mp4 -frames:v 1 -vf scale=1280:720 $BOOK/thumb-chNN.jpg
```

uploader 不支持 API 设缩略图 — 上传后提醒用户在 YouTube Studio 手动设置。

### Step 6: `UPLOAD_META.md` + 上传

**格式必须严格照抄下面骨架** — `upload_youtube.py` 的解析器只认 `## NN · 文件名` 块头 + `**短标题**` / `**视频描述**` 小节 + 正文里的 `#tag`，别的格式解析出 0 个块直接退出。每章一个块：

```markdown
## 01 · <slug>-ch01.mp4

**短标题**
《书名》第一章：<章名或一句话钩子>

**视频描述**
<本章讲什么，2-3 句> + 本章的中心思想列表

有声书朗读来自 VoiceDrop。

#有声书 #听书 #<书名> #<作者> #读书

---
```

```bash
uvx --with google-auth --with requests python \
  ~/.claude/skills/wjs-uploading-video/scripts/upload_youtube.py --dir $BOOK
```

章节多时注意 YouTube 每日配额（默认约 6 个/天）：建 `upload-batch-N/` 暂存目录放当天要传的 mp4 软链接 + `UPLOAD_META.md` 软链接，`--dir` 指向暂存目录分天传。

`--dir` 模式自动配对目录里的 mp4 和 `UPLOAD_META.md`（**不要用 `--video` + `--meta`** — `--meta` 只在 `--dir` 分支生效，`--video` 分支要求 `--title` 且忽略 meta 文件）。多章节视频建议加 `--playlist <id>` 归入同一播放列表。上传完把链接回给用户。

## 目录结构

```
~/code/book-videos/<slug>/
├── style.md                  # 全书视觉风格底稿（一次定）
├── <slug>-ch01.mp4 ...       # ⭐ 每章最终视频（在根目录，供 --dir 上传扫描）
├── thumb-ch01.jpg ...        # 每章缩略图（YouTube Studio 手动设）
├── UPLOAD_META.md
└── chapters/
    └── 01/
        ├── chapter.md        # 章节文本
        ├── audio.mp3         # VoiceDrop 读书 mp3
        ├── ideas.json        # 1-3 个中心思想
        ├── img-1.png ...     # GPT Image 2 画面
        └── overlay-1.png ... # 脚本生成的文字层（中间产物）
```

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 把章节文本重新 TTS | 音轨就是 VoiceDrop 读书 mp3，重新合成既浪费又不一致 |
| 一章塞 5-6 个中心思想 | 画面变成字幕机。锚点宁少勿多，≤3 |
| 提示词里让 AI 画字 | GPT Image 2 画中文必崩。提示词强制 "No text"，文字走 Pillow 叠加 |
| 提示词不写 landscape/wide composition | Codex 端 `--size` 只是参考，会返回方图竖图，16:9 裁剪损失大半画面 |
| 用照片写实风格 | 插画才耐得住 Ken Burns 缓推 + 大字叠加；photo 风显廉价 |
| 画抽象概念图解（箭头/图表/概念词）| 画具象场景，让画面自己会呼吸 |
| 每章换一种画风 | 全书一个 style.md，章间一致 |
| 手写 drawtext 滤镜 | 本机 ffmpeg 没编译 drawtext，会 "No such filter"。用脚本的 Pillow 路径 |
| 在版权书直接公开发布 | 整章朗读原文的版权风险远大于讲书评论。公版书 / 有权利的书才默认发；否则先确认 |
| 缩略图另画 AI 插画 | 用视频帧 + 大字（同封面约定）|
| 上传用 `--video` + `--meta` | 该组合不成立（`--video` 要求 `--title` 且忽略 meta），用 `--dir` |

## Dependencies

- **ffmpeg**（已装；注意本机构建无 drawtext，脚本已用 Pillow 绕过）
- **uvx + pillow** — 文字层渲染（`uvx --with pillow python ...`）
- **GPT Image 2**（`~/.claude/skills/gpt-image-2-skill/`，`--provider codex`）— 画面生成
- **wjs-voicedrop-reading-aloud** — 章节 mp3 不存在时生成
- **wjs-uploading-video** + OAuth token `~/.config/youtube/token.json` — 上传
- **pandoc** — 仅 EPUB 输入需要，本机默认未装，先 `brew install pandoc`
