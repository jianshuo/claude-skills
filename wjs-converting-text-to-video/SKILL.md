---
name: wjs-converting-text-to-video
description: Use when the user wants a 王建硕-style WeChat article (article.md) turned into a narrated short MP4 video — TTS voiceover via 火山引擎 Volcano TTS, HyperFrames CSS/GSAP animation per scene, subtle SFX, abstract watercolor background, full pipeline rendering to 1080×1920 portrait MP4 (30-90s). Triggers — "把这篇文章做成视频", "做一个解说视频", "讲解视频", "/wjs-converting-text-to-video".
---

# wjs-converting-text-to-video

把一篇王建硕风格的微信公众号 `article.md` 做成 **1080×1920 竖屏、30-90 秒** 的中文解说短视频：TTS 旁白 + HyperFrames CSS/GSAP 动画 + 抽象水彩背景 + 转场 SFX。输出 MP4 给视频号 / 抖音 / 小红书 / Reels。

## What this skill produces

| 维度 | 默认 |
|---|---|
| 尺寸 | 1080×1920 竖屏 (9:16) |
| 时长 | 30-90 秒 |
| Scene 数 | 5-10 |
| 旁白 | 火山引擎 Volcano TTS，默认阿虎对话男声 |
| 背景 | GPT Image 2 生成的抽象水彩 (`bg.png`) + blur 30 + 暖黑半透明 overlay |
| 字体 | Noto Sans SC，hero 900，主文字暖奶白 |
| 输出 | `<article-folder>/<slug>.mp4`（与 `video/` 平行，不放 `video/` 里）|
| 发布 | 自动上传到 YouTube — Portrait → Shorts，Landscape → 普通 video；重新渲染会替换老视频（不累积）|

## When this skill fires

- 用户已有 `article.md`，说「做成视频」「做一个解说」「讲一遍」
- 用户跑 `/wjs-converting-text-to-video <article-folder>`
- 用户说「把昨天发的那 X 篇都做成视频」之类的批量请求

## When NOT to use

- 没有文章稿，只是一个想法 → 先用 `/wjs-publishing-wechat` 写出 article.md，再来
- 用户要的是字幕烧录 / 翻译 / 配音替换 → 用 `/wjs-burning-subtitles` / `/wjs-dubbing-video` / `/wjs-localizing-video`
- 视频要英文 / 西语等非中文 → 本 skill 专注中文 TTS (Volcano 火山引擎)；非中文走 hyperframes 自带 tts 命令 (kokoro 英文还可以)
- 横屏 16:9 → 本 skill 默认竖屏；横屏仅在用户明确要求时改

## Core Principle

**视频不是文章的可视化朗读，而是文章的视觉重构。**

每个 scene 是一个独立的视觉时刻 —— 一个对比、一个排比、一个数字、一个比喻。文字撑满屏幕，黑体加粗，重点字橙色高亮。背景是抽象水彩 (blur 后柔化)，整体调子稳重、克制、有冲击力。

**节奏 > 模板**。一段 5-10 scene 的视频，如果从头到尾都是"两行对照"的同一种排版，就不是视频，是 slideshow。**现代感来自对比** —— 极端字号差、不对称布局、短 scene 与长 scene 交替、纯文字 scene 与几何元素 scene 交替、水彩底 scene 与亮色 punch scene 交替。

**默认是平庸的**。如果只是从模板表顶端挑几种最容易的，结果一定是"平铺直叙的两行格式"。强制走 [Step 1b Scene Mix Rule](#step-1b-scene-mix-rule强制) 配比。

## Workflow

### Step 1: 设计 5-10 个视觉时刻

读 `<article-folder>/article.md`，按论证结构拆成 5-10 个 scene（控制在 30-90 秒总时长）。短文（核心 1-2 个要点）做 5-6 scene / 30-50s；长文 8-10 scene / 60-90s。每个 scene 一段叙述（旁白）+ 一个清晰的视觉骨架。

**模板表 —— 6 类共 16 种，按需混搭**：

#### A. Hero / Punch（强对比 climax，每片 ≥1，时长 ≤4s）
| 模板 | 适合 |
|---|---|
| **A1. 全屏单字 hero** | 1-3 字 climax 词撑满屏，字号 280-400px |
| **A2. Outline hero** | 空心字 `-webkit-text-stroke: 4px #f5efe5; color: transparent;` |
| **A3. Color-flip punch** | 整屏背景换亮色（橙/红/金/翠绿等），反白字 |
| **A4. Gradient text hero** | 大字加 `background: linear-gradient(...); -webkit-background-clip: text;` |

#### B. Contrast / 对照（反差结构，每片 1-2 个，时长 5-8s）
| 模板 | 适合 |
|---|---|
| **B1. 双行对照 + strikethrough** | 「以前 X，现在 Y」「不是 A，是 B」 — **整片最多 2 个** |
| **B2. 左右分屏对照** | 屏幕一分为二（可加竖线分隔） |
| **B3. 对角线对照** | 左上 ↔ 右下，中间大量留白 |

#### C. List / 结构（多项并列，每片 1-2 个，时长 6-10s）
| 模板 | 适合 |
|---|---|
| **C1. N 个卡片横排** | 3-5 个并列，用深暖黑 + 单色边框 |
| **C2. 垂直堆叠关键词** | 6-8 个排比项，可加大数字编号 01-08 |
| **C3. 真网格** | 2×2 / 3×2 网格，每格图标 + 标签（竖屏宽度有限，4 列横排会挤） |
| **C4. 阶梯 / 错位列表** | 每项 `margin-left` 递增 |

#### D. Stat / 数据（数字 climax，每片 ≥1，时长 4-6s）
| 模板 | 适合 |
|---|---|
| **D1. 数字 ticker** | 0 → N 滚动动画（`gsap.to({textContent})`）|
| **D2. 数字 + 标签** | 主数字 200-400px + 60-80px 解释 |
| **D3. 进度条 / 时间轴** | 横向 progress bar + 节点 |

#### E. Quote / Climax（金句落点，每片 1-2 个，时长 6-10s）
| 模板 | 适合 |
|---|---|
| **E1. 段落级 hero text** | 一句 60-100px 金句，左对齐 + 左侧 emphasis bar |
| **E2. 大引号 + 内文** | 巨大半透明开引号作背景装饰 |

#### F. 装饰 / 几何（节奏调味，可选）
| 模板 | 适合 |
|---|---|
| **F1. 格子 + spinner / 进度条** | 多并发画面 |
| **F2. 对话气泡 ↔ 回应** | 角色 A 说 → 角色 B 做 |

**每个 scene 的旁白控制在 3-12 秒**（短 punch 3-4s，长 breath 10-12s，**不要全部都是 5-7s**）。所有 scene 加起来 **30-90 秒**，不要超过 90 秒。文章短就做短，5 个 scene × 6s = 30s 也是合格。

### Step 1b: Scene Mix Rule（强制）

**写完 5-10 个 scene 设计后，按下面 checklist 自查。任何一条不满足 → 回去调整。**

#### 配比硬规则
- [ ] ≥1 个 A 类 / D 类 / C 类 / E 类
- [ ] ≤2 个 B1 模板（双行 strikethrough — 历史上最容易被滥用）
- [ ] ≥1 个 A3 color-flip scene（亮色背景反白字）
- [ ] ≥4 种不同的模板类型（A/B/C/D/E/F 至少 4 类）
- [ ] ≤2 个连续 scene 用同一类

#### 节奏硬规则
- [ ] scene 时长跨度 ≥ 6s（最短 ≤ 4s、最长 ≥ 9s）
- [ ] ≥2 次"短 → 长 → 短"或"长 → 短"节奏切换
- [ ] 字号跨度 ≥ 240px（最大 hero ≥ 320px，最小 ≤ 80px）

#### 布局硬规则
- [ ] ≥2 个 scene 非居中（贴角、对角、左对齐、阶梯等）
- [ ] ≥1 个 scene 留白占 ≥ 60% 屏幕（呼吸）
- [ ] ≥1 个 scene 含几何装饰（粗线、色块、箭头、圆点、大编号）

#### 配色硬规则
- [ ] **大部分 scene 没有 `background:` 色** — 让水彩 bg-image 透出；只有 A3 color-flip 才用纯色 bg
- [ ] color-flip scene 颜色不只是橙/蓝/白（深红 / 深金 / 翠绿 / 青松 / 暗紫 等都可）
- [ ] emphasis 至少 2-3 种颜色（技术词用蓝、价值词用金、增长词用绿、警告词用红）

#### 反单调自检
1. 把所有 scene 截图缩成缩略图并排 — **能一眼分辨吗**？如果 8 个看起来一样 → 重做
2. 第 1、4、7 scene 的视觉密度是不是不一样？应该有的密、有的极简
3. 有"meta-rhythm"吗？比如 A 开场 → 3 个 B/C 展开 → D climax → E 收尾 — 比线性铺更有戏剧弧

### Step 2: 写 `narration_chunks.json`

```json
[
  {"id": "s01", "text": "我们以前，是 AI 的领导。现在，我们就是它的维修工。"},
  {"id": "s02", "text": "..."}
]
```

**写旁白细节**：
- 比 article.md 更口语、更短促，逗号/句号多用让 TTS 自然停顿
- 数字 / 英文混排 OK（"Claude Code"、"100 倍"），Volcano 都能读
- 不写括号注释、不写 `...`、不写破折号 `——`（TTS 会念出 "破折号" 三字）
- 删掉 article.md 里的 `**加粗 markdown**`，只留纯文字
- **去掉百姓网相关 facts**：article.md 里如出现「百姓网」「百姓网现在 X 人」「百姓网员工」等都要 strip 或泛化（"百姓网现在 158 个人" → "现实里没几个真人"）。这是过时信息，不要进视频。同理 visuals 不要出现 "百姓网" label 或 "158 人" stat。详见 [[no-baixing-facts]]

### Step 3: 生成 TTS narration

```bash
cd <article-folder>/video
python3 tts_narration.py
```

脚本默认用 `zh_male_ahu_conversation_wvae_bigtts`（阿虎对话）— 段间插 0.35s 静音，输出 `narration.mp3` + `timing.json`。

**Volcano TTS 注意事项（踩过的坑）**：
- 用 resource `volc.service_type.10029`，speaker 选 `zh_*_*_bigtts`
- **绝对不要传 `emotion` / `emotion_scale`** — 大部分 `_bigtts` 声音会返回 `data: null` 静默失败
- **绝对不要用 kokoro**（hyperframes 自带 tts）— 中文质量差，用户明确不接受
- **避免** `zh_male_jieshuonansheng_mars_bigtts` — 含英文专名（如 "Claude Code"）会循环 hallucinate

**备用声音**（按推荐顺序）：
- `zh_male_ahu_conversation_wvae_bigtts` (阿虎对话) — 默认，自然口语
- `zh_male_M392_conversation_wvae_bigtts` — 同 wvae 系列
- `zh_male_wennuanahu_moon_bigtts` (温暖阿虎) — 更暖、播音感
- `zh_male_silang_mars_bigtts` (思朗) — 沉稳思考，戏剧感强
- `zh_male_baqiqingshu_mars_bigtts` (霸气) — 更有力度

切声音：`python3 tts_narration.py --voice zh_male_silang_mars_bigtts`

### Step 4: 生成水彩背景图

bg-image 是视觉主基调（柔化的抽象水彩）。**不要用 article 的 `illustration.png`** — 手绘示意图细节太多，blur 后变成均匀深色泥（视觉上仍是纯黑）。必须用专门生成的抽象水彩。

```bash
~/.claude/skills/wjs-converting-text-to-video/scripts/generate-bg.sh <article-folder> <theme>
```

`<theme>` 选（根据文章主题）：

| theme | 色板 | 适合 |
|---|---|---|
| `personal` | bright warm yellow, soft coral pink, terracotta, sage green, cream | 个人、手作、温暖 |
| `tech` | cool teal, electric blue, deep purple, mint, white | AI、技术、数据 |
| `reflection` | sage green, dusty blue, lavender, pearl, cream | 反思、沉静 |
| `warning` | burnt orange, deep red, mustard, charcoal | 警示、张力 |
| `growth` | fresh green, gold, soft yellow, sky blue | 增长、复利 |
| `abstract` | lavender, dusty rose, sage, soft amber | 抽象、哲思 |

输出：`<article-folder>/video/bg.png` (1088×1920, ~3MB)。

**⚠️ 图片必须在 `video/` 目录内** — 不能用 `../illustration.png`，hyperframes render 不解析跨目录相对路径，会渲染成纯黑。

### Step 5: 写 HyperFrames composition (`index.html`)

读 `timing.json`，按每个 chunk 的 start/end 设计 scene。竖屏 1080×1920 结构：

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
  .scene { position: absolute; inset: 0; overflow: hidden; opacity: 0; z-index: 2; }
  #s1 { opacity: 1; }
  /* ... scene-specific styles ... */
</style></head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="<total+2>" data-width="1080" data-height="1920">
    <div id="bg-image"></div>
    <div id="bg-overlay"></div>
    <!-- scene divs s1..sN -->
    <!-- audio: narration + ticks + chimes + bell -->
  </div>
  <script>
    /* GSAP timeline: paused + register to window.__timelines['main'] */
  </script>
</body></html>
```

#### 🎬 第一帧规则（硬性）

视频 **t=0** 必须包含：
1. **bg-image 完全可见** — 永远 opacity 1，从不 fade-in（CSS 默认就可见，别在 GSAP 里改它的 opacity）
2. **标题元素可见** — s1 的主要标题元素 `tl.from({y:30, scale:0.95})` 可，但 **不要** `tl.from({opacity:0})`，否则 t=0 就是黑屏
3. **s1 不能是 A3 color-flip** — 否则盖住 bg-image，第一帧就看不到水彩。color-flip 留给 s2+

#### 色彩系统

**主文字 / 锚定色（design system，全片一致）**：

| 角色 | 值 | 用法 |
|---|---|---|
| 主文字 | `#f5efe5` 暖奶白 | hero / 主要内容 |
| 二级文字（副标题、caption）| `#f5efe5` + `opacity: 0.7` + 小字号 | **不要用灰色**（`#8a7e72` 在水彩底上看不清）。用 opacity + 缩字号做 hierarchy |
| 划掉文字本身 | `#f5efe5` + `opacity: 0.5` + strikethrough line | **不要用 `#6d635a` 暗灰** — 在水彩底上看不清。改用 opacity 弱化 + 橙色 strike line |
| 装饰大编号（01-08）| `#f5efe5` + `opacity: 0.18` 或 `#e87a3e` + `opacity: 0.35` | **不要用 `#2b2620` 等深灰**（水彩底上完全消失）|
| Outline 描边 | `#f5efe5` 4-8px stroke + `color: transparent` | A2 空心字 |
| 默认 fallback bg | `#0e0b08` 深暖黑 | 被 bg-image + overlay 覆盖；color-flip 不用 |

**核心原则：所有文字用 `#f5efe5` cream 或 `#e87a3e` 橙系（accent palette），用 opacity + size 做 hierarchy，不用色相变化。灰色是黑底时代的遗物，水彩底上一律不用。** 详见 [[no-low-contrast-text]]

**Color-flip 背景 palette（A3，不只是橙/蓝/白）**：

| hex | 适合 |
|---|---|
| `#e87a3e` 经典橙 | 警示、强调、climax punch |
| `#6b9bc4` 亮蓝 | 数据、技术 climax |
| `#f5efe5` 暖奶白 | 收尾、安静的反差 |
| `#c45c3e` 深红 | 警告、错误 climax |
| `#d4a040` 深金 | 成就、价值 climax |
| `#5a8c6a` 翠绿 | 增长、复利、生命力 |
| `#4a8a8a` 青松 | 冷静、长期主义 |
| `#7a5a8a` 暗紫 | 智慧、神秘 climax |
| `#c48a8a` 暗粉 | 柔软、人性 |

color-flip 上的文字用 `#0e0b08` 或 `#f5efe5` 反相。

**Emphasis / Accent palette（不只是橙）**：

| hex | 适合 |
|---|---|
| `#e87a3e` 橙 | 默认 emphasis |
| `#6b9bc4` 蓝 | 数据、技术词、AI |
| `#d4a040` 金 | 价值、成就 |
| `#5a8c6a` 翠绿 | 增长、好结果 |
| `#4a8a8a` 青松 | 长期、稳定 |
| `#c45c3e` 深红 | 警告、反差 |
| `#8a7aaa` 暗紫 | 抽象、智慧 |
| `#c48a8a` 暗粉 | 柔软、人性化 |

**整片 emphasis ≥ 2-3 种**，根据 scene 主题选 accent。

#### 字体系统（**竖屏 1080 宽**）

| 项 | 值 |
|---|---|
| 字重 | hero 900 / 主文 800 / 二级 600-700 / caption 500 |
| 字距 | hero `-0.04em` 到 `-0.06em` / 主文 `-0.02em` / caption `0` |
| Punch hero (A1/A2，1-3 字) | 280-400px |
| 短句 hero (4-6 字) | 160-240px |
| 长句 hero (7-10 字) | 100-150px |
| 卡片内容 | 56-130px |
| 副标题 | 40-72px |
| Caption / 序号 / 标签 | 20-40px |

#### 布局系统（**反居中惯性**）

| 布局 | CSS 关键 | 适合 |
|---|---|---|
| 居中 | `flex; center; center;` | A 类 hero，但 ≤50% scene |
| 左对齐贴顶 | `padding: 80px 80px 0 80px;` | E 类金句、长 quote |
| 右下角锚定 | `position: absolute; right: 80px; bottom: 80px;` | 落款、climax 词 |
| 对角线 | top-left / bottom-right | B3 对角对照 |
| 网格 | `display: grid; grid-template-columns: repeat(2, 1fr);` | C3（竖屏 2×N 而非 3×N）|
| 阶梯 | 每项 `margin-left: calc(60px * var(--i));` | C4 错位列表 |
| 贴底 + 上方留白 | `position: absolute; bottom: 60px;` 上方空白 | 呼吸 scene |
| 边角小元素 | 文字小贴一角，其他全空 | 极简 / 留白 punch |

**Padding**：撑满型 40-80px，呼吸型 120-200px。不要所有 scene 都用同一个 padding。

#### 几何装饰元素

每隔几个 scene 用一个：

- **粗短线** 8-16px × 40-200px，emphasis bar，橙色
- **左侧 emphasis bar** 6px × 100%，配长 quote
- **大数字编号** 01-08，list 项序号（淡灰、巨大、装饰性）
- **大引号字符** `"` 半透明超大置左上
- **横向分隔线** 2-4px 奶白 30% 透明
- **圆点 / 方块** 12-20px、橙色，list bullet
- **箭头** ➜ 或自绘 SVG

#### Scene 转场（4 种 + 混用规则）

**不要全片都 blur crossfade**。每 4 个转场必须 ≥2 种类型。

**T1. Blur crossfade**（默认柔和）
- 0.6s，`sine.inOut`
- 后 scene `opacity: 0, filter: blur(24px)` → `opacity: 1, filter: blur(0)`
- 前 scene 同时 fade-out + blur

**T2. White flash cut**（punch 切，最现代）
- 0.18s 总长：60ms 白闪 → 切 → 40ms 新 scene scale 1.05 → 1
- 适合：进入 A 类 hero、D 类 stat、climax 切换
```js
tl.to('.flash', { opacity: 1, duration: 0.06, ease: 'none' }, T - 0.06)
  .set(prevScene, { opacity: 0 }, T)
  .set(nextScene, { opacity: 1 }, T)
  .to('.flash', { opacity: 0, duration: 0.12, ease: 'power2.out' }, T)
  .from(nextScene, { scale: 1.05, duration: 0.25, ease: 'expo.out' }, T);
```

**T3. Scale push**（推进感）
- 0.55s，前 scene `scale: 1 → 0.85`，后 scene `scale: 1.15 → 1`
- 适合：从概览推到细节

**T4. Color flash cut**（橙/蓝闪一下，强烈节奏）
- 0.22s 总长：80ms 全屏橙 → 切 → 40ms 收
- 适合：进入 A3 color-flip 或关键转折
- **全片最多 2 次**

flash overlay 在 HTML 里加 `<div class="flash">` 全屏定位、默认 opacity 0、z-index 100。

#### 入场动画规则

- 每个 scene 的每个元素都用 `tl.from(...)` 入场（y/opacity/scale）
- 入场 stagger 0.1-0.3s；首元素 t = scene.start + 0.3 起
- ≥3 种不同 ease（`power3.out` / `back.out(1.3)` / `expo.out` / `elastic.out(1, 0.5)`）
- **不要 `gsap.to({opacity: 0})` 退场** — 转场已处理。只有最后 scene 可 fade-to-black
- **整片必须用到 ≥3 种** [Modern Motion Techniques](#modern-motion-techniques)

### Modern Motion Techniques

平庸视频和现代视频的差别一半在排版、一半在 motion。下面 7 种每片必须用 ≥3 种（特定 scene 用，不要全片堆）。

#### 1. Kinetic Typography（字符 stagger 入场）—— A 类 hero
```html
<h1 class="kinetic">维 修 工</h1>
```
```js
tl.from('.kinetic span', {
  y: 180, opacity: 0, rotateX: -90,
  duration: 0.7, stagger: 0.06,
  ease: 'back.out(1.4)',
  transformOrigin: '50% 100%',
}, T);
```

#### 2. Camera Punch（推近 / 拉远）—— A3、D 类
```js
tl.from(scene, { scale: 1.15, opacity: 0, duration: 0.5, ease: 'expo.out' }, sceneStart);
```

#### 3. Mask Reveal（clip-path 揭示）—— E 类 quote
```css
.reveal { clip-path: inset(0 100% 0 0); }
```
```js
tl.to('.reveal', { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'expo.inOut' }, T);
```

#### 4. Number Ticker（数字滚动）—— D1
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

#### 5. Outline → Fill（空心字变实心）—— A2
```css
.morph { -webkit-text-stroke: 4px #f5efe5; color: transparent; }
```
```js
tl.to('.morph', { color: '#e87a3e', webkitTextStrokeColor: '#e87a3e', duration: 0.5, ease: 'power2.out' }, T);
```

#### 6. Letter Highlight Sweep（关键词扫光）—— E 类 climax 词
```html
<span class="sweep"><span class="sweep-bg"></span>搭档</span>
```
```css
.sweep { position: relative; display: inline-block; padding: 0 8px; }
.sweep-bg { position: absolute; inset: 0; background: #e87a3e; transform: scaleX(0); transform-origin: left; z-index: -1; }
```
```js
tl.to('.sweep-bg', { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, T);
tl.to('.sweep', { color: '#0e0b08', duration: 0.1 }, T + 0.25);
```

#### 7. Background Color Punch（背景闪变）—— 全片 1-2 次
```js
tl.to(scene, { backgroundColor: '#e87a3e', duration: 0.08 }, T)
  .to(scene, { backgroundColor: '#0e0b08', duration: 0.4, ease: 'power2.out' }, T + 0.1);
```

**Strike-through 动画**：用真实 DOM `<span class="strike-line">` 而不是 `::after`。伪元素 + CSS 变量在 hyperframes 某些渲染路径下不工作。
```html
<span class="strike">领导<span class="strike-line"></span></span>
```
```css
.strike-line { position: absolute; left: -10px; right: -10px; top: 56%; height: 10px; background: #e87a3e; transform: scaleX(0); transform-origin: left; }
```
```js
tl.to('.strike .strike-line', { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, T);
```

### Step 6: 加 SFX

```bash
~/.claude/skills/wjs-converting-text-to-video/scripts/synth-sfx.sh <article-folder>/video
```

生成 `video/sfx/{tick,chime,bell}.mp3`：
- `tick.mp3` — 80ms 1.2kHz sine，**转场用**（每次 scene 切换前 0.3s）
- `chime.mp3` — 220ms 880+1320Hz 双音，对话/列表某项亮起时（**可选**）
- `bell.mp3` — 1.5s 低频钟，最后 climax 词出来时（**全片最多 1 次**）

**接入 timeline**：
```html
<audio id="aud-narration" src="narration.mp3" data-start="0" data-duration="<total>" data-track-index="0" data-volume="1"></audio>

<audio id="aud-tick-s02" src="sfx/tick.mp3" data-start="<scene2.start - 0.3>" data-duration="0.1" data-track-index="2" data-volume="0.55"></audio>
<!-- 重复每个 scene 切换；T2/T4 flash 转场可不加 tick -->

<audio id="aud-chime-s08-1" src="sfx/chime.mp3" data-start="<T>" data-duration="0.3" data-track-index="3" data-volume="0.45"></audio>
<audio id="aud-bell-s12" src="sfx/bell.mp3" data-start="<climax-T>" data-duration="1.6" data-track-index="4" data-volume="0.55"></audio>
```

**⚠️ 每个 `<audio>` 必须有 `id`**，否则 render 出 silent（hyperframes 强制要求）。

不同 `track-index` 不冲突，同 track 不能时间重叠。

**SFX 用量节制**：转场 tick 必须；chime / bell 是装饰，scene 内容简单时不加；bell 全片只 1 次。

### Step 7: Lint + Inspect + Render（必须按顺序）

```bash
cd <article-folder>/video

# 必跑 1：linter（必须 0 errors）
npx hyperframes lint

# 必跑 2：layout inspect 找溢出（必须 0 errors）
npx hyperframes inspect --at 1,8,15,25,35,45,55,65

# 推荐：snapshot 看排版
npx hyperframes snapshot --at <t1>,<t2>,<t3> .

# 渲染（lint + inspect 都通过才能跑）
# ⚠️ 输出到上级目录，与 video/ 平行 —— 最终 MP4 不放 video/ 里
npx hyperframes render --quality standard --fps 30 --output ../<slug>.mp4
```

**为什么 inspect 必跑**：竖屏 1080 宽很窄，3-4 字 hero 在 280-400px 字号下就接近溢出。每次必须 inspect，**0 errors 才能 render**。

**fix overflow**：
- 字号缩小（inspect 给具体建议）
- 长 hero 分行（"没法积累" → 两行 "没法" / "积累"）
- `white-space: nowrap` 只在确认字数 × 字号 < 屏宽时
- 若 `.em` 在 `reveal-wrap` 内溢出 → 加 `line-height: 1` 到 `.em`

**渲染质量**：
- `--quality draft` ~30s 渲染 — 迭代用
- `--quality standard` ~1.5min — 默认，发布够用
- `--quality high` ~3min — 投大屏 / 商务

### Step 8: 预览

输出：`<article-folder>/<slug>.mp4`（**与 `video/` 平行**，不在 `video/` 内 —— `video/` 留给中间文件）。

`open <article-folder>/<slug>.mp4` 给用户预览。**不要自动上传到视频号**（用户可能想先剪/调）。

### Step 9: 发布到 YouTube（自动 cron，**不在 render 流程内**）

新视频 render 完成后**不立即上传** —— YouTube 有 daily quota 限制（默认 6 个/天 @ 1600 配额点/上传），渲染多了会卡 quota。

**做法**：cron 每天 10:00 自动跑 `daily-upload-batch.sh`，挑最多 5 个还没上传过的 MP4（按文章日期升序），上传后写 `.youtube.json` 记录。

**cron 已注册**（一次性，不用重复跑）：
```
0 10 * * * /Users/jianshuo/.claude/skills/wjs-converting-text-to-video/scripts/daily-upload-batch.sh
```

**手动触发**（**不要在 wjs-converting-text-to-video 流程里跑** — 让 cron 处理）：
```bash
~/.claude/skills/wjs-converting-text-to-video/scripts/daily-upload-batch.sh
# 或单个文章立即上传
~/.claude/skills/wjs-converting-text-to-video/scripts/publish-to-youtube.py <article-folder>
```

每个上传的脚本行为：
1. 检测 MP4 portrait/landscape → portrait 标题加 `#shorts`、landscape 普通 video
2. title 从 article.md H1 / description 从前几段
3. 检查 `<article-folder>/.youtube.json`：存在 → 尝试删老再传新（需 `youtube.force-ssl` scope，当前 token 没这个 scope → 跳过 delete + 上传新）
4. 写 `.youtube.json` 记录

详见 memory: [[auto-publish-youtube]]

## 目录结构

```
<article-folder>/
├── article.md
├── illustration.png            # 用户原始示意图，不直接用作 bg
├── <slug>.mp4                  # ⭐ 最终视频（与 video/ 平行，不放 video/ 里）
└── video/                      # 所有中间产物
    ├── narration_chunks.json   # 5-10 个 scene 的旁白文本
    ├── tts_narration.py        # bootstrap 复制进来
    ├── narration.mp3           # 合并的全段 TTS
    ├── narration/              # 单段 mp3 (s01..sN)
    ├── timing.json             # 每段 start/end/duration
    ├── bg.png                  # GPT Image 2 生成的水彩背景
    ├── sfx/{tick,chime,bell}.mp3
    ├── index.html              # HyperFrames composition
    ├── hyperframes.json
    ├── meta.json
    ├── package.json
    └── snapshots/              # 渲染前快照
```

## Skill 自身文件

```
~/.claude/skills/wjs-converting-text-to-video/
├── SKILL.md
└── scripts/
    ├── bootstrap-project.sh        # init video/ 目录 + 复制 helper + 生成 sfx
    ├── generate-bg.sh              # 调 GPT Image 2 生成抽象水彩 bg.png
    ├── tts.py                      # Volcano TTS narration 生成
    ├── synth-sfx.sh                # tick/chime/bell 合成 (ffmpeg)
    ├── retrofit-bg-image.py        # 给已有视频补 bg-image 层
    ├── strip-dark-scene-bgs.py     # 剥离 scene-level 暗色 bg，让 bg-image 透出
    └── publish-to-youtube.py       # 自动上传 MP4 到 YouTube（portrait→Shorts），可替换已有上传
```

## Anti-Patterns

### 反单调（最重要 — "平铺直叙"的根源）

| 不要 | 原因 |
|------|------|
| 所有 scene 都用 B1 双行 strikethrough | 历史最大失败模式。B1 整片最多 2 次 |
| 所有 scene 居中布局 | 死气沉沉。≥2 非居中 |
| 所有 scene 字号差不多 | 跨度必须 ≥240px |
| 所有 scene 时长 5-7s | 跨度必须 ≥6s |
| 整片只用 blur crossfade | 每 4 个转场 ≥2 种 |
| 整片没有 color-flip | ≥1 个 A3 是硬要求 |
| 整片没有几何元素 | ≥1 个 scene 加粗线 / 大编号 / 引号 |
| 整片只用 `tl.from({y, opacity})` | ≥3 种 Modern Motion Techniques |
| 每个 scene 都堆满 | ≥1 个 scene 留白 ≥60% |
| 给每个 scene 都加 `background:` 色 | 盖住 bg-image，等于白生成水彩。普通 scene 不写 bg；只有 A3 color-flip 用纯色 |
| color-flip / emphasis 永远只用橙 | 至少 2-3 种 accent |
| 用灰色作 secondary text / strike / 装饰 | 水彩底上灰色对比度太低，会消失。改用 `#f5efe5` cream + opacity 弱化（详见 [[no-low-contrast-text]]）|

### 内容 / 工程

| 不要 | 原因 |
|------|------|
| 用 Kokoro 做中文 TTS | 中文质量差，用户明确不接受 |
| Volcano TTS 传 `emotion` 参数 | `_bigtts` 声音返回 `data: null` 静默失败 |
| 用 `zh_male_jieshuonansheng_mars_bigtts` | 含英文专名时循环 hallucinate |
| 用 serif 字体（Songti / 宋体 / Noto Serif） | 不够冲击 |
| 把整段文章贴屏 | 那是 PPT。视频每屏一个视觉时刻 |
| 超过 10 scene / 超过 90 秒 | 注意力放不下 |
| 短文硬填到 90 秒 | 文章短就做 30-50s，硬撑长会注水变浅 |
| 每个 scene 换字体配色风格 | 风格漂移。design system 固定，模板变化 |
| `::after` 伪元素 + CSS 变量做 strike | hyperframes 渲染路径下失效。用真实 DOM `<span class="strike-line">` |
| 最后 scene 之外用 `gsap.to({opacity: 0})` | 退场动画 hyperframes 禁止 — 转场才是退场 |
| 每段 chunk 都加 chime | 太吵 |
| 用 `../illustration.png` 作 bg url | hyperframes render 不解析跨目录路径，渲染成纯黑。**bg.png 必须在 `video/` 内** |
| `<audio>` 没 `id` | render 会 silent。每个 `<audio>` 必须 `id="..."` |
| s1 是 A3 color-flip | 第一帧看不到 bg-image。color-flip 放 s2+ |
| s1 标题元素都 `from({opacity: 0})` | 第一帧黑屏。s1 主元素 `opacity: 1` 默认，只动 y/scale |

## Common Pitfalls

- **改了旁白文字但 TTS 没变（用了缓存）** → `tts_narration.py` 按 chunk `id` 缓存单段 mp3，改文案但 `id` 没变会复用旧音频（症状：`timing.json` 时长和上一版一模一样，明明文字变长了）。重合成前先 `rm -rf narration/ narration.mp3 timing.json` 再跑
- **narration 写「——」破折号** → TTS 念出 "破折号"。删掉用句号或逗号
- **某段 chunk 异常长（>3 chars/s）** → Volcano hallucinate 循环。换声音，或拆短
- **scene 时长 < narration 时长** → 旁白被下一个 scene 切掉。scene 必须覆盖整段 narration + 0.3s 缓冲
- **黑底大字 opacity: 0 时仍可见** → 检查 `.scene` 是否有 `opacity: 0` 默认（除了 s1）
- **`.em` 在 `.reveal-wrap` 里少量溢出（top/bottom 几 px）** → 给 `.em` 加 `line-height: 1`
- **snapshot 字形和 render 不一致** → 现在都用 Noto Sans SC，正常一致

## Dependencies

- **HyperFrames CLI** (`npx hyperframes`) — composition lint / inspect / snapshot / render
- **GPT Image 2** (`~/.claude/skills/gpt-image-2-skill/`) — 生成 bg.png；`--provider codex` 用 ChatGPT auth
- **Volcano TTS** — `VOLC_TTS_APPID` / `VOLC_TTS_ACCESS_TOKEN` 在 `~/code/.env`
- **ffmpeg** — SFX 合成、audio concat、aspect-ratio 检测
- **YouTube uploader** (`~/.claude/skills/wjs-uploading-video/`) + OAuth token at `~/.config/youtube/token.json` —— Step 9 自动发布
