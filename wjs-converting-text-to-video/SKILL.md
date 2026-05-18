---
name: wjs-converting-text-to-video
description: Use when the user wants a 王建硕-style WeChat article (article.md) turned into a narrated MP4 video — TTS voiceover via 火山引擎 Volcano TTS, HyperFrames CSS/GSAP animation per scene, subtle SFX, full pipeline rendering to 1920×1080 MP4. Triggers — "把这篇文章做成视频", "做一个解说视频", "讲解视频", "/wjs-converting-text-to-video".
---

# wjs-converting-text-to-video

把一篇王建硕风格的微信公众号 article.md，做成一段 **1-1.5 分钟**的中文解说视频（**1080×1920 竖屏 MP4**，带 TTS 旁白、HyperFrames 全程动画、转场音效）。

**默认 9:16 竖屏** — 微信视频号 / 抖音 / 小红书 / Reels 都用竖屏。横屏 16:9 仅在用户明确要求时改。

**时长 60-90 秒** — 短视频留意力短，王建硕公众号文章本就短，视频更应短。超过 90 秒不行。

## Core Principle

**视频不是文章的可视化朗读，而是文章的视觉重构。**

每个 scene 是一个独立的视觉时刻——一个对比、一个排比、一个数字、一个比喻。文字撑满屏幕，黑体加粗，重点字橙色高亮。背景深暖黑（不是纯黑），整体调子稳重、克制、有冲击力。

**节奏 > 模板**。一段 7-10 scene 的视频，如果从头到尾都是"两行对照"的同一种排版，就不是视频，是 slideshow。**现代感来自对比**——极端字号差、不对称布局、短 scene 与长 scene 交替、纯文字 scene 与几何元素 scene 交替、暖黑底 scene 与亮色 punch scene 交替。

**默认是平庸的**。如果你只是从 [Step 1 模板表](#step-1-读文章挑-8-12-个视觉时刻) 顶端挑几种最容易的，结果一定是"平铺直叙的两行格式"。强制走 [Scene Mix Rule](#step-1b-scene-mix-rule-强制) 配比。

不要：把整段段落贴到屏幕上让人读（那是 PPT，不是视频）；用 serif 字体（不够冲击）；超过 10 scene（注意力放不下、超时长）；让所有 scene 都用同一个模板（最大的反现代）；所有 scene 都居中（无聊）；所有 scene 时长都在 5-7s（节奏死）。

## When This Skill Fires

- 用户已有 `article.md`，说「做成视频」「做一个解说」「讲一遍」
- 用户跑 `/wjs-converting-text-to-video <article-folder>`
- 用户说「把昨天发的那 10 篇都做成视频」之类的批量请求

## When NOT to use

- 没有文章稿，只是一个想法 —— 先用 wjs-publishing-wechat 写出 article.md，再来
- 用户要的是「字幕烧录」「翻译」「配音替换」—— 那是 wjs-burning-subtitles / wjs-dubbing-video / wjs-localizing-video 的事
- 视频要英文 / 西语等非中文 —— 本 skill 专注中文 TTS (Volcano 火山引擎)；非中文走 hyperframes 自己的 tts 命令 (kokoro 英文还可以)

## Workflow

### Step 1: 读文章，挑 7-10 个视觉时刻

打开 `<article-folder>/article.md`，按文章的论证结构拆成 **7-10 个 scene**（控制在 1-1.5 min 总时长）。每个 scene 一段叙述（旁白）+ 一个清晰的视觉骨架。

**好 scene 的形态——分 6 类共 16 种，按需混搭。不要每篇都用同一类。**

### A. Hero / Punch（强对比 climax，每片至少 1 个，时长 ≤4s）

| 模板 | 适合 |
|---|---|
| **A1. 全屏单字 hero** | 一个 climax 词撑满屏，字号 320-480px，居中或贴边，背景纯色 |
| **A2. Outline hero** | 空心字 (`-webkit-text-stroke: 4px #f5efe5; color: transparent;`)，配一个实心 emphasis 词 |
| **A3. Color-flip punch** | 整屏背景变橙色 (`#e87a3e`) 或亮蓝，反白字。用来撞反差、强调转折 |
| **A4. Gradient text hero** | 大字加 `background: linear-gradient(...); -webkit-background-clip: text;` |

### B. Contrast / 对照（反差结构，每片建议 1-2 个，时长 5-8s）

| 模板 | 适合 |
|---|---|
| **B1. 双行对照 + strikethrough** | 「以前 X，现在 Y」「不是 A，是 B」—— 注意：**整片最多 2 个**，不要每个 scene 都用 |
| **B2. 左右分屏对照** | 屏幕一分为二（可加竖线分隔），左旧右新，左暗右亮，对比色彩 |
| **B3. 对角线对照** | 一边在左上角，一边在右下角，中间大量留白，对角张力 |

### C. List / 结构（多项并列，每片建议 1-2 个，时长 6-10s）

| 模板 | 适合 |
|---|---|
| **C1. N 个卡片横排** | 3-5 个并列分类。**不要用浅灰小卡片**——用纯色大块（深暖黑 + 单色边框 2-4px），更现代 |
| **C2. 垂直堆叠关键词** | 6-8 个排比项，每项一行，可加序号 01-08 (小字偏左) 或圆点装饰 |
| **C3. 真网格** | 3×3 或 4×2 网格布局，每格一个图标 + 标签，整齐排布。比横排更密更现代 |
| **C4. 阶梯 / 错位列表** | 列表每项缩进递增 (`margin-left: 0/60/120/180...`)，制造阶梯感 |

### D. Stat / 数据（数字 climax，每片至少 1 个，时长 4-6s）

| 模板 | 适合 |
|---|---|
| **D1. 数字 ticker** | 0 → N 滚动动画 (`gsap.to({textContent: N, snap: { textContent: 1 }})`)，单位贴在右下 |
| **D2. 数字 + 缩写标签** | 主数字 200-400px，下方一行 60-80px 的解释文字 ("一年前" / "现在") |
| **D3. 进度条 / 时间轴** | 横向 progress bar 填充动画，节点上挂关键事件 |

### E. Quote / Climax（单句结论，每片建议 1-2 个，时长 6-10s）

| 模板 | 适合 |
|---|---|
| **E1. 段落级 hero text** | 一句 60-100px 的金句，左对齐，配一个 8px 粗的橙色短线或左侧 emphasis bar |
| **E2. 大引号 + 内文** | 巨大开引号 (200px+，半透明) 作背景装饰，正文在上层 |

### F. 装饰 / 几何（不是主角，是节奏调味，每片可有可无）

| 模板 | 适合 |
|---|---|
| **F1. 格子 + spinner / 进度条** | "10 个 tab 在跑" "很多 worker 在干活" 等并发画面 |
| **F2. 对话气泡 ↔ 回应** | 角色 A 说 → 角色 B 做。两个不对称气泡 |

**每个 scene 的旁白控制在 4-12 秒**（短 punch 4s，长 breath 10-12s，**不要全部都是 5-7s**）。所有 scene 加起来 **60-90 秒**。**不要超过 90 秒**。

### Step 1b: Scene Mix Rule（强制）

**写完 8-12 个 scene 设计后，按下面这个 checklist 自查。任何一条不满足都要回去调整。**

#### 配比硬规则

一段 7-10 scene 的视频必须包含：

- [ ] **≥1 个 A 类**（Hero/Punch，超大字撑屏，≤4s）
- [ ] **≥1 个 D 类**（Stat/数据，有具体数字）
- [ ] **≥1 个 C 类**（List/结构，3+ 项并列）
- [ ] **≥1 个 E 类**（Quote/Climax，金句落点）
- [ ] **≤2 个 B1 模板**（双行对照 + strikethrough）—— 这是最容易被滥用的模板，强限制
- [ ] **≥1 个 color-flip scene**（A3，亮色背景反白字）作视觉 punctuation
- [ ] **≥4 种不同的模板类型**（A/B/C/D/E/F 至少出现 4 类）
- [ ] **≤2 个连续 scene 用同一类**（不能 3 个 contrast scene 连排）

#### 节奏硬规则

- [ ] **scene 时长跨度 ≥ 6s**（最短 scene ≤ 4s，最长 scene ≥ 9s。如果所有 scene 都在 5-7s，节奏死）
- [ ] **至少 2 次"短 → 长 → 短"或"长 → 短"节奏切换**
- [ ] **字号跨度 ≥ 240px**（最大 hero ≥ 320px，最小信息文字 ≤ 80px。所有 scene 都用同一个字号 = 平铺直叙）

#### 布局硬规则

- [ ] **≥2 个 scene 是非居中布局**（贴角、对角线、左对齐、贴底等）
- [ ] **≥1 个 scene 留白占 ≥ 60% 的屏幕**（呼吸感，反"撑满"惯性）
- [ ] **≥1 个 scene 包含几何装饰元素**（粗线条、色块、箭头、圆点、数字编号）

#### 配色硬规则（反"全片一个色"惯性）

- [ ] **大部分 scene 没有 `background:` 色**，让 bg-image 透出来（普通 scene 完全透明；只有 color-flip scene 才用纯色 bg）。**不要给每个 scene 都加 bg 色**——bg-image 就是统一的色调氛围，scene 加 bg 等于把它盖死
- [ ] **color-flip scene 颜色不只是橙/蓝/白**（深红 / 深金 / 翠绿 / 青松 / 暗紫 / 暗粉 都可以用，根据 scene 主题选）
- [ ] **emphasis 至少用 2-3 种颜色**（不能 12 个 scene 都只有橙色 sweep。技术词用蓝，价值词用金，增长词用绿，警告词用红…）

#### 反单调自检

打开你设计好的 scene 列表，问自己：

1. 如果把所有 scene 截图缩成缩略图并排，**能一眼分辨吗**？如果 8 个看起来一模一样 → 立刻回去改成不同模板
2. 第 1、6、12 scene 的**视觉密度**是不是不一样？（应该有的密、有的极简）
3. 有没有任何一种**"meta-rhythm"**？比如：A1 hero 开场 → 3 个 B/C 展开 → D 数字 climax → E 金句收尾。比一路线性铺更有戏剧弧

如果以上任何一条不满足，**重新设计 scene 列表**。不要将就。

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
- **去掉百姓网相关 facts**：article.md 里如果出现「百姓网」「百姓网现在 X 人」「百姓网员工」等都要 strip 或泛化（"百姓网现在 158 个人" → "公司里没几个真人" / "现实里没几个人"）。这是过时信息，不要进视频。同理 visuals 里也不要出现 "百姓网" label 或 "158 人" stat。详见 [[no-baixing-facts]]

### Step 3: 生成 TTS narration

```bash
cd <article-folder>/video
~/.claude/skills/wjs-converting-text-to-video/scripts/tts.py
```

脚本会：
- 默认用 `zh_male_ahu_conversation_wvae_bigtts`（阿虎对话 — 自然口语对话感）
- 每段 chunk 独立调 Volcano TTS API
- 段间插 0.35s 静音
- 输出 `narration.mp3` + `timing.json`（每段的 start/end/duration）

**Volcano TTS 注意事项（踩过的坑）**：
- 用 `volc.service_type.10029` resource，speaker 选 `zh_*_*_bigtts` 命名的（其他可能没开通）
- **绝对不要传 `emotion` / `emotion_scale` 参数**——大部分 `_bigtts` 声音对这两个参数会返回 `data: null`（HTTP 200 但没音频），脚本会 retry 失败
- **绝对不要用 kokoro**（hyperframes 自带的 `npx hyperframes tts`）—— 中文质量差，用户明确不接受。详见 [[no-kokoro-use-volcano]]
- 备用声音（按推荐顺序）：
  - `zh_male_ahu_conversation_wvae_bigtts` (阿虎对话) — 默认，自然口语
  - `zh_male_M392_conversation_wvae_bigtts` — 同 wvae 系列，备选
  - `zh_male_wennuanahu_moon_bigtts` (温暖阿虎) — 更暖、播音感
  - `zh_male_silang_mars_bigtts` (思朗) — 沉稳思考，戏剧感强
  - `zh_male_baqiqingshu_mars_bigtts` (霸气) — 更有力度
- **避免** `zh_male_jieshuonansheng_mars_bigtts`（解说男声）—— 在含 "Claude Code" 等英文专名的句子会循环 hallucinate 数倍时长

### Step 4: 写 HyperFrames composition (`index.html`)

读 `timing.json`，按每个 chunk 的 start/end 设计 scene。一个标准的 **1080×1920 竖屏** composition 结构：

```html
<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  html, body {
    width: 1080px; height: 1920px; margin: 0; overflow: hidden;
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
  <div id="root" data-composition-id="main" data-start="0" data-duration="<total+2>" data-width="1080" data-height="1920">
    <!-- scene divs s1..sN, each .scene -->
    <!-- audio: narration + tick × N + chime × M + bell -->
  </div>
  <script>
    /* GSAP timeline: paused + register to window.__timelines['main'] */
  </script>
</body></html>
```

**⚠️ 竖屏布局调整要点**：
- 宽度只有 1080px（横屏的 56%），单行文字字数明显减少。3-4 字 hero 用 320-400px；5-7 字用 180-240px；8+ 字用 100-140px
- 高度 1920px（横屏的 178%），垂直方向更宽松。垂直堆叠 list、长 quote 可以放更多行
- 居中布局 / 网格布局可能要重新排（4 列横排 → 改 2×2 网格 或 4 行垂直堆叠）
- 对角线布局：左上 / 右下 仍可，但距离更短

**Visual rules (这套样式是 skill 的固定 design system)**：

#### 背景图层（取代纯黑底，全片必须有）

视频整体背景**不再是单一 `#0e0b08`**，而是一张**专门生成的抽象水彩背景**——粗大笔触、明亮色块、无具体形象。这样每个 scene 都浮在艺术氛围之上，但前景文字仍然清晰。

**为什么不用 article 的 `illustration.png`**：手绘示意图细节太多，blur 后变成均匀深色泥（看起来还是纯黑）。必须用专门生成的、本身就抽象的水彩。

**⚠️ 关键：图片必须在 `video/` 目录内** —— 不能用 `../illustration.png`，hyperframes render 不解析跨目录相对路径会渲染成纯黑。

**生成步骤**（bootstrap 之后、写 narration 之前）：

```bash
node /Users/jianshuo/.claude/skills/gpt-image-2-skill/scripts/gpt_image_2_skill.cjs \
  --json --provider codex images generate \
  --prompt "Abstract watercolor painting, large bold brushstrokes, big color blocks of [theme-colors], thick paint texture, painterly canvas feel, organic flowing shapes, no figures, no text, no faces, no objects. Loose impressionist composition, vibrant joyful palette. Pure abstract gestural marks." \
  --out <article-folder>/video/bg.png \
  --format png --size 1920x1088 --quality high
```

**Theme-colors 选**（根据文章主题）：
- 个人/手作/温暖 → `bright warm yellow, soft coral pink, terracotta, cream`
- 技术/AI/数据 → `cool teal, electric blue, deep purple, mint, white`
- 反思/沉静 → `sage green, dusty blue, lavender, pearl, cream`
- 警示/张力 → `burnt orange, deep red, mustard, charcoal`
- 增长/复利 → `fresh green, gold, soft yellow, sky blue`
- 抽象/哲思 → `lavender, dusty rose, sage, soft amber`

`--provider codex` 用 ChatGPT auth（无 OpenAI 额度也能跑）。3.2MB PNG / ~30-60s 生成时间。

**生成失败的 fallback**：复制 `<article>/illustration.png` → `bg.png` 作降级（仍然能渲染但效果差很多）。

**HTML 结构**（在 `#root` 内、所有 scene 之前）：

```html
<div id="bg-image"></div>
<div id="bg-overlay"></div>
<!-- scene divs s1..sN follow -->
```

**CSS**（**`url('bg.png')` 必须是本地路径**，最终 tuned 参——水彩可见但不抢戏）：

```css
#bg-image {
  position: absolute; inset: 0;
  background-image: url('bg.png');
  background-size: cover;
  background-position: center;
  filter: blur(30px) brightness(0.65) saturate(0.85);
  z-index: 0;
  transform: scale(1.1);
}
#bg-overlay {
  position: absolute; inset: 0;
  background: rgba(14, 11, 8, 0.28);
  z-index: 1;
}
.scene { z-index: 2; }  /* scenes 始终在 bg-image / overlay 之上 */
```

**调参历史**（参考）：
- 第一版 blur 60 / brightness 0.22 / overlay 0.55 → 太暗，看上去仍是纯黑
- 中间试过 blur 15 / brightness 0.85 / overlay 0.18 → 太亮，水彩太抢戏
- **当前 blur 30 / brightness 0.65 / overlay 0.28** → 用户确认这个 sweet spot：水彩可见但氛围克制、文字清晰

**⚠️ 千万别给每个 scene 都加 `background:` 色** —— 那会盖住 bg-image，等于白生成了。普通 scene 都让 bg-image 透出来；只有 **color-flip scene (A3) 才可以用纯色 bg** 作 punch 反差。

**Color-flip scene (A3)** 用 `background: #e87a3e` 等纯色，会盖住背景图 — 这是设计意图，保持 color-flip 反差冲击力。

**图源**：bootstrap 自动从 `<article-folder>/illustration.png` 复制到 `video/bg.png`。备选 `cover.png`。都没有就退回纯 `#0e0b08`（旧行为，不推荐）。

**调参原则**（已 tuned 出 sweet spot）：
- `blur(50px)` — 模糊到看不清细节、保留色调
- `brightness(0.38)` — 暗到不抢眼、仍能看见纹理
- `saturate(0.6)` — 略降饱和
- overlay `rgba(14,11,8, 0.45)` — 与字色对比度足够
- 如果文章 illustration 整体很亮（cream/white底），加 overlay alpha 到 0.55；很暗（深色场景），降到 0.30

**警告**：原本设计为"装饰性深色 label"（如 `color: #2b2620` 的 01/02/03 编号）在 bg-image 下会更难看清。可以换 `#4a3f35` 或更亮的灰。

**可选：缓慢 Ken Burns 平移**（贯穿全片，增强氛围感）

```js
tl.fromTo('#bg-image',
  { scale: 1.10, x: 0, y: 0 },
  { scale: 1.15, x: -60, y: -40, duration: totalDuration, ease: 'none' },
  0);
```

**验证**：用 `npx hyperframes snapshot` 在最密集文字 scene + color-flip scene 各截一张，确认 (a) 普通 scene bg 是"暖深色雾"不是纯黑 (b) color-flip scene 仍是纯色不透 (c) 文字清晰。

#### 色彩系统

**重要：palette 必须丰富，不能 12 个 scene 都是同样的深暖黑底 + 橙色 emphasis。**

##### 主文字 / 锚定色（design system，全片一致）

| 角色 | 值 | 用法 |
|---|---|---|
| 主文字 | `#f5efe5` (暖奶白) | hero / 主要内容、所有 scene |
| 默认 fallback bg | `#0e0b08` (深暖黑) | 被 #bg-image+overlay 覆盖；color-flip 不用 |
| 二级文字 | `#8a7e72` (暖灰) | 副标题、caption |
| 划掉文字 | `#6d635a` (暗灰) | strikethrough |
| Outline 描边 | `#f5efe5` 4-8px stroke + `color: transparent` | A2 空心字 |

##### Scene 背景：让 bg-image 透出来，普通 scene 不写 `background`

**重要规则**：bg-image 是视觉主基调（水彩抽象），它已经提供了丰富的色相。**普通 scene 不要再写 `background:` 色** —— 那会盖掉 bg-image，把视觉退化成单色。

普通 scene 的 CSS 应该是这样（**没有** background 行）：
```css
#s3 { /* 没 background 行 — bg-image + overlay 透出来 */ }
.scene { position: absolute; inset: 0; overflow: hidden; opacity: 0; }
```

**唯一例外：color-flip scene (A3)** 才用纯色 background 盖住 bg-image，做 punch 反差：
```css
#s6 { background: #e87a3e; }  /* 橙色 color-flip punch */
#s9 { background: #5a8c6a; }  /* 翠绿 punch */
```

**建议 12 个 scene 里**：10 个无 background（bg-image 透出）、1-2 个 color-flip（盖 bg-image 做反差）。这样既有连贯的水彩氛围，又有节奏 punch。

##### Color-flip 背景 palette（A3，不只是橙/蓝/白）

| color-flip 色 | hex | 适合 |
|---|---|---|
| 经典橙 | `#e87a3e` | 警示、强调、climax punch |
| 亮蓝 | `#6b9bc4` | 数据、技术 climax |
| 暖奶白 | `#f5efe5` | 收尾、安静的反差 |
| 深红 punch | `#c45c3e` | 警告、错误 climax |
| 深金 | `#d4a040` | 成就、价值 climax |
| 翠绿 | `#5a8c6a` | 增长、复利、生命力 |
| 青松 | `#4a8a8a` | 冷静、长期主义 |
| 暗紫 | `#7a5a8a` | 智慧、神秘 climax |
| 暗粉 | `#c48a8a` | 柔软、人性 |

color-flip scene 上的文字用 `#0e0b08` 或 `#f5efe5` 之一作反相。

##### Emphasis / Accent palette（不只是橙色）

| 色 | hex | 适合 |
|---|---|---|
| 橙 | `#e87a3e` | 默认 emphasis，重点字 / sweep |
| 蓝 | `#6b9bc4` | 数据、技术词、AI |
| 金 | `#d4a040` | 价值、成就关键词 |
| 翠绿 | `#5a8c6a` | 增长、好结果 |
| 青松 | `#4a8a8a` | 长期、稳定 |
| 深红 | `#c45c3e` | 警告、错误、反差 |
| 暗紫 | `#8a7aaa` | 抽象、智慧 |
| 暗粉 | `#c48a8a` | 柔软、人性化 |

**整片 emphasis 至少用 2-3 种颜色**（不要 12 个 scene 都只用橙色 sweep）。根据 scene 主题选 accent。

#### 字体系统

| 项 | 值 |
|---|---|
| 字体 | `Noto Sans SC` (hyperframes auto-embeds) |
| 字重 | hero 900 / 主文 800 / 二级 600-700 / caption 500 |
| 字距 | hero `-0.04em` 到 `-0.06em` / 主文 `-0.02em` / caption `0` |
| **字号必须跨度大**（反"全片一个字号"惯性，**1080 宽 竖屏**调小一档）：|
| - Punch hero (A1/A2，1-3 字) | 280-400px |
| - 短句 hero (4-6 字) | 160-240px |
| - 长句 hero (7-10 字) | 100-150px |
| - 卡片内容 | 56-130px |
| - 副标题 | 40-72px |
| - Caption / 序号 / 标签 | 20-40px |

#### 布局系统（**反居中惯性**）

不要每个 scene 都 `display: flex; justify-content: center; align-items: center;`。学会用：

| 布局 | CSS 关键 | 适合 |
|---|---|---|
| 居中 | `flex; center; center;` | A 类 hero，但不要超过 50% scene |
| 左对齐贴顶 | `padding: 80px 80px 0 80px;` | E 类金句、长 quote |
| 右下角锚定 | `position: absolute; right: 80px; bottom: 80px;` | 落款、climax 词 |
| 对角线 | 两元素分别 top-left / bottom-right | B3 对角对照 |
| 网格 | `display: grid; grid-template-columns: repeat(3, 1fr);` | C3 真网格 |
| 阶梯 | 每项 `margin-left: calc(60px * var(--i));` | C4 错位列表 |
| 贴底 + 上方留白 | `position: absolute; bottom: 60px;` 大量上方空白 | 呼吸 scene |
| 边角小元素 | 文字小、贴在屏幕一角，其他全空 | 极简 / 留白 punch |

**Padding 规则**：撑满型 scene 40-80px，呼吸型 scene 可以 120-200px。**不要所有 scene 都用同一个 padding 值**。

#### 几何元素（让 scene 不只是"飘文字"）

每隔几个 scene 就用一个：

- **粗短线** (8-16px 高 × 40-200px 宽) 作 emphasis bar，颜色 `#e87a3e`
- **左侧 emphasis bar** (6px × 100% 高) 配长 quote
- **大数字编号** 01-08，作 list 项的序号（淡灰、巨大、装饰性）
- **大引号字符** `"` 作背景装饰（半透明、超大、置于左上角）
- **横向分隔线** (2-4px、奶白 30% 透明) 作章节分割
- **圆点 / 方块** 作 list bullet 替代品（直径 12-20px、橙色）
- **箭头** ➜ 或自绘 SVG，连接两个元素

**Scene 转场（4 种 + 混用规则）**：

不要全片都 blur crossfade —— 那是"软"，听起来安全但视觉单调。每 4 个转场必须包含 ≥2 种不同类型。

**T1. Blur crossfade**（默认，柔和过渡用）

- 0.6s，`sine.inOut`
- 后 scene: `opacity: 0, filter: blur(24px)` → `opacity: 1, filter: blur(0)`
- 前 scene 同时: `opacity: 1` → `0`, blur 0 → 20
- 适合：连接两个同类型 scene

**T2. White flash cut**（punch 切，最现代）

- 总长 0.18s
- 60ms 全屏白闪 → 80ms 切到新 scene → 40ms 新 scene scale 1.05 → 1
- 适合：进入 A 类 hero、进入 D 类 stat、climax 切换

```js
// 在 root 上加一个全屏 white overlay 元素
tl.to('.flash', { opacity: 1, duration: 0.06, ease: 'none' }, T - 0.06)
  .set(prevScene, { opacity: 0 }, T)
  .set(nextScene, { opacity: 1 }, T)
  .to('.flash', { opacity: 0, duration: 0.12, ease: 'power2.out' }, T)
  .from(nextScene, { scale: 1.05, duration: 0.25, ease: 'expo.out' }, T);
```

**T3. Scale push**（推进感）

- 0.55s，前 scene 缩小淡出 + 后 scene 放大进入
- 前 scene: `scale: 1` → `0.85`, `opacity: 1` → `0`
- 后 scene: `scale: 1.15` → `1`, `opacity: 0` → `1`
- 适合：从概览推到细节、从一个论点深入到具体例子

**T4. Color flash cut**（橙色或亮蓝闪一下，强烈节奏）

- 总长 0.22s，类似 white flash 但用 emphasis 色
- 80ms 全屏橙色 (`#e87a3e`) → 切 → 40ms 收
- 适合：进入 A3 color-flip scene，或文章的关键转折点
- **全片最多 2 次**，多了腻

**Scene 1 默认 visible (`opacity: 1`)，其他都 `opacity: 0`**。flash overlay 在 HTML 里加一个 `<div class="flash">` 全屏定位、默认 opacity 0、z-index 最高。

**入场动画规则（每 scene 必须做）**：
- 每个 scene 的每个元素都用 `tl.from(...)` 入场（y/opacity/scale）
- 入场 stagger 0.1-0.3s；首元素从 t = scene.start + 0.3 开始
- 至少 3 种不同的 ease（`power3.out`、`back.out(1.3)`、`sine.out`、`expo.out`、`elastic.out(1, 0.5)`）
- **绝对不要用 `gsap.to({opacity: 0})` 退场**——转场已经处理了。只有最后一个 scene 可以 fade-to-black
- **整片必须用到 ≥3 种** [Modern Motion Techniques](#modern-motion-techniques)，不能 12 个 scene 都只是 `tl.from({ y: 60, opacity: 0 })`

### Modern Motion Techniques

平庸视频和现代视频的差别一半在排版、一半在 motion。下面 7 种技法每片必须用到 ≥3 种（每种只在特定 scene 用，不要全片堆）。

#### 1. Kinetic Typography（字符 stagger 入场）

把一个词的每个字符 stagger 飞入。**适合 A 类 hero scene**。

```html
<h1 class="kinetic">维 修 工</h1>
```
```js
// 拆字 (建议在 HTML 里手动拆，避免运行时 split)
// 或者: const chars = el.textContent.split(''); el.innerHTML = chars.map(c => `<span>${c}</span>`).join('');
tl.from('.kinetic span', {
  y: 180, opacity: 0, rotateX: -90,
  duration: 0.7, stagger: 0.06,
  ease: 'back.out(1.4)',
  transformOrigin: '50% 100%',
}, T);
```

#### 2. Camera Punch（scene 入场推近 / 拉远）

整个 scene 像被摄像机推近一下。**适合 A3 color-flip、D 类 stat scene**。

```js
tl.from(scene, {
  scale: 1.15, opacity: 0,
  duration: 0.5, ease: 'expo.out',
}, sceneStart);
```

逆向（拉远）：从 `scale: 0.85` 起，配 `power3.out`，给"放下重锤"的感觉。

#### 3. Mask Reveal（clip-path 揭示）

用 `clip-path` 从一个方向 reveal 文字。比 opacity fade 现代得多。**适合 E 类 quote**。

```css
.reveal { clip-path: inset(0 100% 0 0); }
```
```js
tl.to('.reveal', {
  clipPath: 'inset(0 0% 0 0)',
  duration: 0.9, ease: 'expo.inOut',
}, T);
```

竖向 reveal：`inset(0 0 100% 0)` → `inset(0 0 0% 0)`，从下往上揭。

#### 4. Number Ticker（数字滚动）

D1 模板的核心动画。从 0 滚到目标数。

```html
<div class="ticker" data-end="3600">0</div>
```
```js
const ticker = document.querySelector('.ticker');
const obj = { val: 0 };
tl.to(obj, {
  val: parseInt(ticker.dataset.end),
  duration: 1.8, ease: 'power2.out',
  onUpdate: () => { ticker.textContent = Math.round(obj.val).toLocaleString(); },
}, T);
```

千分位用 `toLocaleString()`；百分比加 `+ '%'`；倍数加 `+ '×'`。

#### 5. Outline → Fill（空心字变实心）

字先以 outline (`-webkit-text-stroke`) 入场，然后填色。**适合 A2 outline hero 的 climax 时刻**。

```css
.morph {
  -webkit-text-stroke: 4px #f5efe5;
  color: transparent;
  transition: none;
}
```
```js
tl.to('.morph', {
  color: '#e87a3e',
  webkitTextStrokeColor: '#e87a3e',
  duration: 0.5, ease: 'power2.out',
}, T);
// 或: 改 CSS variable 让 stroke 缩到 0
```

#### 6. Letter Highlight Sweep（关键词扫光高亮）

橙色块从左扫到右，覆盖关键词然后停住。比直接换色更现代。**适合 E 类金句中的 climax 词**。

```html
<span class="sweep"><span class="sweep-bg"></span>搭档</span>
```
```css
.sweep { position: relative; display: inline-block; padding: 0 8px; }
.sweep-bg {
  position: absolute; inset: 0;
  background: #e87a3e;
  transform: scaleX(0); transform-origin: left;
  z-index: -1;
}
```
```js
tl.to('.sweep-bg', { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, T);
tl.to('.sweep', { color: '#0e0b08', duration: 0.1 }, T + 0.25);
```

#### 7. Background Color Punch（背景闪变）

整个 scene 的背景在某个时刻闪一下橙色。**全片只用 1-2 次**，给最重要的 climax。

```js
tl.to(scene, {
  backgroundColor: '#e87a3e',
  duration: 0.08, ease: 'none',
}, T)
.to(scene, {
  backgroundColor: '#0e0b08',
  duration: 0.4, ease: 'power2.out',
}, T + 0.1);
```

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

### Step 6: Lint + Inspect + Snapshot + Render

```bash
cd <article-folder>/video

# 必跑 1：linter
npx hyperframes lint
# → 必须 0 errors

# 必跑 2：layout inspect 找溢出（**这是 hard requirement，不能跳**）
npx hyperframes inspect --at 1,8,15,25,35,45,55,65
# → 必须 0 errors。如果有 text_box_overflow 或 canvas_overflow，回到 index.html 调小字号或换 break 方式

# 推荐：snapshot 看排版
npx hyperframes snapshot --at <t1>,<t2>,<t3> .

# 渲染（lint + inspect 都通过才能跑）
npx hyperframes render --quality standard --fps 30 --output <slug>.mp4
```

**为什么 inspect 必跑**：竖屏 1080 宽很窄，中文 hero 字号 280-400px 时，3-4 字就接近宽度极限。如果 subagent 不查 inspect 就 render，会出现"文字飞出屏幕"的灾难。每次必须查。

**fix overflow 的方法**：
- 字号缩小（inspect 会给具体建议字号）
- 长 hero 分行（"没法积累" → "没法" 一行 / "积累" 一行）
- 加 `white-space: nowrap` 但只在确认字数 ×字号 <屏宽时

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

### 反单调（最重要——这是用户反复抱怨"平铺直叙"的根源）

| 不要 | 原因 |
|------|------|
| **12 个 scene 都用"双行对照 + strikethrough" (B1)** | 这是 skill 历史上最大的失败模式。B1 整片最多 2 次。强制走 [Scene Mix Rule](#step-1b-scene-mix-rule-强制) |
| **所有 scene 居中布局** | 死气沉沉。≥2 个 scene 必须非居中（贴角、对角、左对齐、阶梯） |
| **所有 scene 字号差不多** | 字号必须跨度 ≥240px。没有大小起伏 = 没有节奏 |
| **所有 scene 时长 5-7s** | 时长必须跨度 ≥6s。要有短 punch (≤4s) 和长 breath (≥9s) 交替 |
| **整片只用 blur crossfade 一种转场** | 每 4 个转场必须 ≥2 种类型。加白闪 / scale push / color flash |
| **整片没有任何亮色 punch scene** | ≥1 个 color-flip scene 是硬要求。永远深暖黑 → 视觉昏睡 |
| **整片没有任何几何元素** | 至少 ≥1 个 scene 加粗线条、大数字编号、引号装饰、箭头等 |
| **整片只用 `tl.from({y, opacity})` 一种入场** | 必须 ≥3 种 [Modern Motion Techniques](#modern-motion-techniques) |
| **每个 scene 都堆满（90% 屏幕都是文字/卡片）** | ≥1 个 scene 留白 ≥60%，呼吸感和节奏来自空 |
| **每个 scene 都是中等密度 / 中等字号** | 应有的极简（5 字撑屏）有的密集（网格 + 标签） |
| **背景永远是纯 `#0e0b08`** | 必须铺一层 `illustration.png` blur+darken 作 bg-image，让视频带上文章主题氛围。详见 [背景图层](#背景图层取代纯黑底全片必须有) |
| **给每个 scene 都加 `background:` 色** | 那会把 bg-image 全盖住，等于白生成 bg.png。**普通 scene 让 bg-image 透出来**（不写 `background`），只有 color-flip scene (A3) 才用纯色 bg punch 反差 |
| **12 个 scene 全用同一个 bg 色** | bg-image 已经提供主色调；scene 层不该再叠一层单色。让 bg-image 做主角 |
| **color-flip 永远只用橙色** | 整片就一种 punch 色 = 单调。深红、深金、翠绿、青松等都可以根据 scene 主题选 |
| **emphasis 永远只用橙色** | 至少 2-3 种 accent。技术词用蓝、价值词用金、增长词用绿、警告词用红 |

**反单调自检**：12 个 scene 截图缩成缩略图并排，能不能一眼分辨？如果 8 个看起来一样 → 重做。

### 内容 / 工程

| 不要 | 原因 |
|------|------|
| 用 Kokoro (hyperframes 自带 tts) 做中文 | 中文质量差，用户明确不接受 |
| Volcano TTS 传 `emotion` 参数 | 大部分 `_bigtts` 声音会返回 `data: null` 静默失败 |
| 用 serif 字体 (Songti / 宋体 / Noto Serif) | 不够冲击力。用户明确要 "类似黑体的粗一点重一点的字体" |
| 把整段文章贴到屏幕上 | 那是 PPT。视频每屏只一个视觉时刻 |
| 超过 12 个 scene | 注意力放不下，节奏散 |
| 视频超过 3 分钟 | 王建硕的文章本就短，视频更应该短 |
| 每个 scene 换一种字体配色风格 | 风格漂移，看起来不像同一段视频。design system 是固定的，模板是变化的 |
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
