---
name: wjs-converting-text-to-video
description: Use when the user wants a 王建硕-style WeChat article (article.md) turned into a narrated MP4 video — TTS voiceover via 火山引擎 Volcano TTS, HyperFrames CSS/GSAP animation per scene, subtle SFX, full pipeline rendering to 1920×1080 MP4. Triggers — "把这篇文章做成视频", "做一个解说视频", "讲解视频", "/wjs-converting-text-to-video".
---

# wjs-converting-text-to-video

把一篇王建硕风格的微信公众号 article.md，做成一段 1.5–3 分钟的中文解说视频（1920×1080 MP4，带 TTS 旁白、HyperFrames 全程动画、转场音效）。

## Core Principle

**视频不是文章的可视化朗读，而是文章的视觉重构。**

每个 scene 是一个独立的视觉时刻——一个对比、一个排比、一个数字、一个比喻。文字撑满屏幕，黑体加粗，重点字橙色高亮。背景深暖黑（不是纯黑），整体调子稳重、克制、有冲击力。

**节奏 > 模板**。一段 12-scene 的视频，如果从头到尾都是"两行对照"的同一种排版，就不是视频，是 slideshow。**现代感来自对比**——极端字号差、不对称布局、短 scene 与长 scene 交替、纯文字 scene 与几何元素 scene 交替、暖黑底 scene 与亮色 punch scene 交替。

**默认是平庸的**。如果你只是从 [Step 1 模板表](#step-1-读文章挑-8-12-个视觉时刻) 顶端挑几种最容易的，结果一定是"平铺直叙的两行格式"。强制走 [Scene Mix Rule](#step-1b-scene-mix-rule-强制) 配比。

不要：把整段段落贴到屏幕上让人读（那是 PPT，不是视频）；用 serif 字体（不够冲击）；超过 12 scene（注意力放不下）；让 12 个 scene 都用同一个模板（最大的反现代）；所有 scene 都居中（无聊）；所有 scene 时长都在 5-7s（节奏死）。

## When This Skill Fires

- 用户已有 `article.md`，说「做成视频」「做一个解说」「讲一遍」
- 用户跑 `/wjs-converting-text-to-video <article-folder>`
- 用户说「把昨天发的那 10 篇都做成视频」之类的批量请求

## When NOT to use

- 没有文章稿，只是一个想法 —— 先用 wjs-publishing-wechat 写出 article.md，再来
- 用户要的是「字幕烧录」「翻译」「配音替换」—— 那是 wjs-burning-subtitles / wjs-dubbing-video / wjs-localizing-video 的事
- 视频要英文 / 西语等非中文 —— 本 skill 专注中文 TTS (Volcano 火山引擎)；非中文走 hyperframes 自己的 tts 命令 (kokoro 英文还可以)

## Workflow

### Step 1: 读文章，挑 8-12 个视觉时刻

打开 `<article-folder>/article.md`，按文章的论证结构拆成 8-12 个 scene。每个 scene 一段叙述（旁白）+ 一个清晰的视觉骨架。

**好 scene 的形态（选 1-2 种用，不要每篇都堆全）**：

| 视觉模板 | 适合的内容 |
|---|---|
| **双行对照 + strikethrough** | 「以前 X，现在 Y」「不是 A，是 B」类反差 |
| **N 个卡片横排** | 3-5 个并列分类、选项、阶段 |
| **垂直堆叠的关键词** | 6-8 个同类动作 / 名词的排比（每个一行） |
| **对话气泡 ↔ 回应** | 角色 A 说什么 → 角色 B 做什么 |
| **大字单词 / 短句撑满屏** | 单点结论、情绪落点、climax 词 |
| **格子图 + spinner / 进度条** | "10 个 tab 在跑"、"很多 worker 在干活"等多并发画面 |
| **数字滚动 + ×倍** | "100 倍" "10 万次" 等量化 |
| **图标 + 标签的 N 列** | 5 个概念、5 个角落、5 个角色 |

**每个 scene 的旁白控制在 10–25 秒**。所有 scene 加起来 1.5–3 分钟。**不要超过 3 分钟**——王建硕公众号文章本身就短，视频更短才对。

### Step 2: 写 narration chunks JSON

把每个 scene 的旁白写成 `<article-folder>/video/narration_chunks.json`：

```json
[
  {"id": "s01", "text": "我们以前，是 AI 的领导。现在，我们就是它的维修工。"},
  {"id": "s02", "text": "..."},
  ...
]
```

**写旁白的细节**：
- 比 article.md 更口语、更短促，逗号/句号多用，让 TTS 自然停顿
- 数字 / 英文混排没问题（"Claude Code"、"100 倍"、"GPT-5.5"），Volcano 都能读
- 不写括号注释、不写省略号 "..."、不写破折号 "——"（TTS 会读成"破折号"）
- 删掉 article.md 里的 **加粗 markdown 语法**，只留纯文字
- 如果 article.md 里某段是排比/列表，旁白也保持那种节奏感

### Step 3: 生成 TTS narration

```bash
cd <article-folder>/video
~/.claude/skills/wjs-converting-text-to-video/scripts/tts.py
```

脚本会：
- 默认用 `zh_male_silang_mars_bigtts`（思朗 — 稳重思考型中年男声）
- 每段 chunk 独立调 Volcano TTS API
- 段间插 0.35s 静音
- 输出 `narration.mp3` + `timing.json`（每段的 start/end/duration）

**Volcano TTS 注意事项（踩过的坑）**：
- 用 `volc.service_type.10029` resource，speaker 选 `zh_*_*_bigtts` 命名的（其他可能没开通）
- **绝对不要传 `emotion` / `emotion_scale` 参数**——大部分 `_bigtts` 声音对这两个参数会返回 `data: null`（HTTP 200 但没音频），脚本会 retry 失败
- **绝对不要用 kokoro**（hyperframes 自带的 `npx hyperframes tts`）—— 中文质量差，用户明确不接受。详见 [[no-kokoro-use-volcano]]
- 备用稳重声音（按推荐顺序）：
  - `zh_male_silang_mars_bigtts` (思朗) — 默认，沉稳思考
  - `zh_male_baqiqingshu_mars_bigtts` (霸气) — 更有力度
  - `zh_male_wennuanahu_moon_bigtts` (温暖) — 更暖
  - `zh_male_M392_conversation_wvae_bigtts` — 偏 conversational
- **避免** `zh_male_jieshuonansheng_mars_bigtts`（解说男声）—— 在含 "Claude Code" 等英文专名的句子会循环 hallucinate 数倍时长

### Step 4: 写 HyperFrames composition (`index.html`)

读 `timing.json`，按每个 chunk 的 start/end 设计 scene。一个标准的 1920×1080 composition 结构：

```html
<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html, body {
    width: 1920px; height: 1080px; margin: 0; overflow: hidden;
    background: #0e0b08;
    font-family: 'Noto Sans SC', 'PingFang SC', 'Heiti SC', sans-serif;
    font-weight: 900;
    color: #f5efe5;
    letter-spacing: -0.02em;
    -webkit-font-smoothing: antialiased;
  }
  .scene { position: absolute; inset: 0; overflow: hidden; }
  /* scene 1 visible by default; scenes 2+ opacity:0 */
  /* ... scene-specific styles ... */
</style></head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="<total+2>" data-width="1920" data-height="1080">
    <!-- scene divs s1..sN, each .scene -->
    <!-- audio: narration + tick × N + chime × M + bell -->
  </div>
  <script>
    /* GSAP timeline: paused + register to window.__timelines['main'] */
  </script>
</body></html>
```

**Visual rules (这套样式不是装饰，是 skill 的固定形态)**：

| 项 | 值 |
|---|---|
| 背景 | `#0e0b08` (深暖黑，不是纯黑) |
| 主文字 | `#f5efe5` (暖奶白) |
| 二级文字 | `#8a7e72` (暖灰) |
| 暗灰 (划掉的) | `#6d635a` |
| 蓝色 (AI / 数据) | `#6b9bc4` |
| 橙色 emphasis | `#e87a3e` |
| 字体 | `Noto Sans SC` (hyperframes auto-embeds, sans-serif 黑体感) |
| 字重 | `900` 默认（heavy black）；二级文字 600-700 |
| 字距 | `letter-spacing: -0.02em` 到 `-0.06em`（重字号要更紧）|
| 主文字 hero 字号 | 168-280px（短句越大；7-8 字以上的句子用 120-180px）|
| 二级 / 副标题 | 44-88px |
| 卡片内容 | 60-180px |
| Padding | 40-80px（**不要超过 100px** — 留白多了就不"撑满"了）|

**Scene 转场 (必须的)**：
- Blur crossfade，0.6s，`sine.inOut`
- 后一个 scene `opacity: 0, filter: blur(24px)` → `opacity: 1, filter: blur(0)`
- 前一个 scene 同时 `opacity: 1` → `0`, blur 0 → 20
- Scene 1 默认 visible (`opacity: 1`)，其他都 `opacity: 0`

**入场动画规则（每 scene 必须做）**：
- 每个 scene 的每个元素都用 `tl.from(...)` 入场（y/opacity/scale）
- 入场 stagger 0.1-0.3s；首元素从 t = scene.start + 0.3 开始
- 至少 3 种不同的 ease（`power3.out`、`back.out(1.3)`、`sine.out`）
- **绝对不要用 `gsap.to({opacity: 0})` 退场**——转场已经处理了。只有最后一个 scene 可以 fade-to-black

**Strike-through 动画**：用真实 DOM `<span class="strike-line">` 而不是 `::after` 伪元素。伪元素 + CSS 变量在某些 hyperframes 渲染路径下不工作。

```html
<span class="strike">领导<span class="strike-line"></span></span>
```
```css
.strike-line {
  position: absolute; left: -10px; right: -10px; top: 56%;
  height: 10px; background: #e87a3e;
  transform: scaleX(0); transform-origin: left;
}
```
```js
tl.to('.strike .strike-line', { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, T);
```

### Step 5: 加 SFX

```bash
~/.claude/skills/wjs-converting-text-to-video/scripts/synth-sfx.sh <article-folder>/video
```

这会在 `video/sfx/` 下生成 3 个：
- `tick.mp3` — 80ms 1.2kHz sine，转场用（每次 scene 切换前 0.3s）
- `chime.mp3` — 220ms 880+1320Hz 双音，对话/列表的某一项亮起时用
- `bell.mp3` — 1.5s 低频钟，最后 climax 词 (例如「搭档」「带它入门」) 出来时用

**SFX 接入 timeline 的方式**：直接在 HTML 里加 `<audio>` 元素：

```html
<audio src="narration.mp3" data-start="0" data-duration="<total>" data-track-index="0" data-volume="1"></audio>

<!-- 转场 tick × (N-1) 个 -->
<audio src="sfx/tick.mp3" data-start="<scene2.start - 0.3>" data-duration="0.1" data-track-index="2" data-volume="0.6"></audio>
... 重复每个 scene 切换 ...

<!-- 对话/列表的 chime (可选) -->
<audio src="sfx/chime.mp3" data-start="<T>" data-duration="0.3" data-track-index="3" data-volume="0.45"></audio>

<!-- 最后 climax 的 bell (可选，只用一次) -->
<audio src="sfx/bell.mp3" data-start="<climax-T>" data-duration="1.6" data-track-index="4" data-volume="0.55"></audio>
```

不同 track-index 不会冲突，但同 track-index 的不能时间重叠。

**SFX 用量节制原则**：转场 tick 是必须的；chime / bell 是装饰，不是必须。如果一个 scene 内容简单（一行字），不要加任何 chime。bell 全片最多一次。

### Step 6: Lint + Snapshot + Render

```bash
cd <article-folder>/video

# 必跑：linter
npx hyperframes lint

# 推荐：拉几帧 snapshot 看看排版（不渲染整段）
npx hyperframes snapshot --at <t1>,<t2>,<t3> .

# 推荐：layout inspect 找溢出
npx hyperframes inspect --at <t1>,<t2>,<t3>

# 渲染
npx hyperframes render --quality standard --fps 30 --output <slug>.mp4
```

**渲染质量**：
- `--quality draft` (~30s render) — 迭代用
- `--quality standard` (~1.5min render) — 默认，公众号 / 视频号发布够用
- `--quality high` (~3min render) — 投到大屏 / 商务用

**时间预算（标准质量、156s 视频、4 workers）**：
- TTS 生成：30-60s
- Render：1-2 min
- 总耗时一篇约 3-5 min

### Step 7: 收尾

输出文件路径：`<article-folder>/video/<slug>.mp4`

按需 `open` 它给用户预览。**不要自动上传到视频号**（用户可能想先剪掉/调整）。

## 标准目录结构

```
<article-folder>/
├── article.md
├── meta.json
├── ...                       # 文章本身的 cover/illustration/draft.json 等
└── video/
    ├── narration_chunks.json # 12 个 scene 的旁白文本
    ├── tts_narration.py      # 调 Volcano TTS 的脚本（从 skill scripts 复制）
    ├── narration.mp3         # 合并后的全段 TTS 音频
    ├── timing.json           # 每段 start/end/duration
    ├── narration/            # 单段 mp3 (s01..s12)
    ├── sfx/                  # tick.mp3 / chime.mp3 / bell.mp3
    ├── index.html            # HyperFrames composition
    ├── package.json          # hyperframes 项目元数据
    ├── hyperframes.json      # hyperframes 配置
    ├── meta.json             # hyperframes 项目元数据
    ├── snapshots/            # 渲染前的快照检查
    └── <slug>.mp4            # 最终视频
```

## File Layout (skill 自身)

```
~/.claude/skills/wjs-converting-text-to-video/
├── SKILL.md
└── scripts/
    ├── tts.py                # Volcano TTS narration generator
    ├── synth-sfx.sh          # tick/chime/bell synthesis via ffmpeg
    └── bootstrap-project.sh  # init hyperframes config + copy tts/sfx scripts to <video-dir>
```

## Anti-Patterns

| 不要 | 原因 |
|------|------|
| 用 Kokoro (hyperframes 自带 tts) 做中文 | 中文质量差，用户明确不接受 |
| Volcano TTS 传 `emotion` 参数 | 大部分 `_bigtts` 声音会返回 `data: null` 静默失败 |
| 用 serif 字体 (Songti / 宋体 / Noto Serif) | 不够冲击力。用户明确要 "类似黑体的粗一点重一点的字体" |
| 把整段文章贴到屏幕上 | 那是 PPT。视频每屏只一个视觉时刻 |
| 超过 12 个 scene | 注意力放不下，节奏散 |
| 视频超过 3 分钟 | 王建硕的文章本就短，视频更应该短 |
| 每个 scene 用不同字体 / 配色 | 风格漂移，看起来不像同一段视频 |
| 用 `::after` 伪元素 + CSS 变量做 strike 动画 | hyperframes 渲染路径下有时失效。用真实 DOM `<span class="strike-line">` |
| 在最后一个 scene 之外用 `gsap.to({opacity: 0})` | 退场动画 hyperframes 禁止 — 转场才是退场 |
| 给每段 chunk 都加 chime SFX | 太吵。chime 只在视觉上需要"叮"一下的关键时刻 |
| 渲染时 unset HTTPS_PROXY | 不影响 hyperframes，但如果你的脚本调外部 API 会撞 [[wechat-proxy-whitelist]] |

## Common Pitfalls

- **narration_chunks.json 里写「——」破折号 → TTS 念出 "破折号" 三个字**：删掉，用句号或逗号代替
- **某段 chunk 异常长（>3 chars/s 应该正常）→ Volcano hallucinate 循环**：换一个声音，或把这段拆成更短的 chunk
- **scene 时长比 narration 时长还短 → 旁白被下一个 scene 切掉**：scene 必须覆盖整段 narration + 0.3s 缓冲
- **黑底大字 opacity:0 时仍可见**：检查 `.scene` 是否有 `opacity: 0` 默认（除了 scene 1）
- **hyperframes snapshot 用本地字体 (Songti SC 等)，render 用 Noto Sans SC**：snapshot 看到的中文字形可能和最终 MP4 不一致。**永远以 `--quality draft` 短渲后的 ffmpeg extract 帧为准**
- **草稿 MP4 用 standard 渲完才发现字号不对**：先 snapshot 检查再大渲。snapshot 用的也是 Noto Sans SC（render 后端），所以反映的是真实 MP4 字形

## Dependencies

- **HyperFrames CLI** (`npx hyperframes`) — 1920×1080 composition 编译 + render
- **ffmpeg** — SFX 合成、audio concat
- **Volcano TTS** — `VOLC_TTS_APPID` / `VOLC_TTS_ACCESS_TOKEN` 在 `~/code/.env`
- **uv / uvx** — 跑 tts.py 时按需拉 requests
