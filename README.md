# claude-skills

我（[王建硕](https://github.com/jianshuo)）日常在 Claude Code 里用的 skills。

> Auto-mirrored from `~/.claude/skills/` by a PostToolUse hook —
> 每次我编辑 `wjs-*` skill，对应目录会被 rsync 到这里并推送到 GitHub。
> Hook 源码：`~/.claude/skills-publish-hook.sh`

## 前置:安装 Claude Code / Install Claude Code

这些 skill 跑在 [Claude Code](https://claude.com/code) 里,所以先装 Claude Code。

```bash
# 方式 1:npm 全局安装(推荐,需要 Node.js ≥ 18)
npm install -g @anthropic-ai/claude-code
claude            # 启动

# 方式 2:不装,直接用 npx 跑一次
npx @anthropic-ai/claude-code

# 方式 3:原生安装脚本(无需 Node.js)
# macOS / Linux
curl -fsSL https://claude.ai/install.sh | bash
# Windows (PowerShell)
irm https://claude.ai/install.ps1 | iex
```

装好后在任意项目目录运行 `claude` 即可。首次启动会引导登录(Claude 账号或 API key)。
升级:`claude update`(原生安装)或 `npm update -g @anthropic-ai/claude-code`(npm 安装)。

## 安装 Skills / Install Skills

```bash
# 方式 1:从 ClawHub 装单个 skill
clawhub install wjs-transcribing-audio

# 方式 2:把整个仓库作为 Claude Code marketplace
claude plugin marketplace add jianshuo/claude-skills
claude plugin install wjs-transcribing-audio

# 方式 3:直接 clone 到 skills 目录
git clone https://github.com/jianshuo/claude-skills ~/.claude/skills/wjs
```

## 兼容性 / Compatibility

[`SKILL.md`](https://agentskills.io) 是 Anthropic 公开的 skill 格式标准（2025 年 10 月发布，2025 年 12 月被 OpenAI Codex 采纳），所以这套 skill 同样适用于:

- [**Claude Code**](https://claude.com/code) — 主要测试和使用环境
- [**OpenAI Codex CLI**](https://developers.openai.com/codex/skills) — 2025-12+ 起兼容
- **Cursor** / **Gemini CLI** / **Goose** —  生态在跟进

第三方分发平台:[ClawHub](https://clawhub.ai/jianshuo) · [SkillsMP](https://skillsmp.com)（自动索引）

## 这些 skill 是什么？

Claude Code skill 是一个带 frontmatter 的 `SKILL.md` 文件 + 一组脚本。当用户的请求匹配 skill 描述里的触发词（"翻译字幕"、"做封面"、"上传 YouTube"……）时，Claude 会自动加载这个 skill 并按里面写的流程执行。

这套 skill 大致围绕 **「视频创作 + 公众号写作」** 工作流：从原始拍摄素材 → 多机位对齐 → 自动剪辑 → 翻译配音 → 后期合成 → 平台分发。每个 skill 都做一件事，可以单独调用，也可以串成完整流水线。

**命名约定**：所有 skill 以 **动名词（V-ing）** 开头 —— `transcribing-audio` / `dubbing-video` / `editing-multicam` —— 描述「正在做什么动作」，方便和 Claude 自动加载逻辑对齐。

---

## 安装 & 使用 / How to Install

把任意一个 skill 目录复制到 Claude Code 的 skills 目录即可：

```bash
# 全局安装（所有项目都能用）
cp -r wjs-transcribing-audio ~/.claude/skills/

# 项目级安装（只在当前项目可用）
cp -r wjs-transcribing-audio ./.claude/skills/
```

装好后用触发词自然说话（如「转写这个视频」、「做 SRT」），或用斜杠命令 `/wjs-transcribing-audio` 显式调用。不需要重启 Claude Code，技能即时生效。

---

## Skills 总览

| Skill | 一句话作用 | 输入 → 输出 |
|---|---|---|
| [`wjs-publishing-wechat`](./wjs-publishing-wechat/) | 写 / 润色 / 发微信公众号 | 草稿文本 → 排版好的 HTML + 题图 + 解释图 + 上传草稿 |
| [`wjs-mining-articles`](./wjs-mining-articles/) | 从视频字幕里挖公众号文章（独白或对谈） | SRT → N 篇独立公众号文章 + 微信草稿 |
| [`wjs-converting-text-to-video`](./wjs-converting-text-to-video/) | 把公众号文章做成竖屏解说短视频 | `article.md` → 1080×1920 MP4（TTS + 水彩背景 + GSAP 动画） |
| [`wjs-transcribing-audio`](./wjs-transcribing-audio/) | 音视频转字幕（原语言） | 视频/音频 → 同语言 SRT |
| [`wjs-translating-subtitles`](./wjs-translating-subtitles/) | 字幕翻译 + 标点重切 | A 语言 SRT → B 语言 SRT（或双语 SRT） |
| [`wjs-dubbing-video`](./wjs-dubbing-video/) | 文本时间对齐 TTS 配音 | 视频 + 目标语 SRT → 配好音的视频 |
| [`wjs-burning-subtitles`](./wjs-burning-subtitles/) | 烧字幕 + 混音 + 终合成 | 视频 + SRT + (可选)dub → 上传就绪 MP4 |
| [`wjs-localizing-video`](./wjs-localizing-video/) | 上面四步的总编排器 | 视频 + 目标语言 → 字幕 + 配音的本地化视频 |
| [`wjs-syncing-multicam`](./wjs-syncing-multicam/) | 多机位音频互相关对齐 | N 个机位 → 每个机位一份 `.sync.json` |
| [`wjs-editing-multicam`](./wjs-editing-multicam/) | 多机位自动剪辑（音量切机位） | 同步过的 N 个机位 → 单条 MP4 |
| [`wjs-segmenting-video`](./wjs-segmenting-video/) | 长视频按话题切片 + 裁剪 | 长视频 + SRT → 3–6 个独立短片 + 各自 SRT |
| [`wjs-overlaying-video`](./wjs-overlaying-video/) | 后期：封面 / 字幕 / 动画 / CTA | 短片 + SRT → 带后期的成片 |
| [`wjs-reframing-video`](./wjs-reframing-video/) | 横竖屏互转 + 说话人跟踪裁切 | 16:9 ↔ 9:16，4:3 ↔ 3:4 |
| [`wjs-uploading-video`](./wjs-uploading-video/) | 批量上传 YouTube | MP4 (+ `UPLOAD_META.md`) → YouTube |
| [`wjs-tweeting-from-articles`](./wjs-tweeting-from-articles/) | 从最近公众号文章萃取每日 X tweet，人工挑角度后真发 | article.md → X / Twitter |
| [`wjs-syndicating-articles`](./wjs-syndicating-articles/) | 把最新公众号文章一键扇出到 X / Bluesky / Threads / LinkedIn + 手动平台待发件箱 | article.md → API 平台直发 + outbox |
| [`wjs-promoting-skills`](./wjs-promoting-skills/) | 每日自动推广 skill → X 帖 + 社区草稿 | `wjs-*` skills → X tweet + outbox drafts |
| [`wjs-x-increasing-follower`](./wjs-x-increasing-follower/) | X 涨粉实验框架：带编号的 A/B 实验，以新增关注 ÷ 主页访问转化率为北极星 | X Analytics CSV → SCOREBOARD.md |
| [`wjs-x-improving-content`](./wjs-x-improving-content/) | 迭代改 `prompt.md` 提升每条推的 impression：每版 prompt 是带假设的 git SHA 版本实验 | Content CSV → 版本对比 + 内容特征 |
| [`wjs-auditing-project`](./wjs-auditing-project/) | 项目状态体检 | 一句"看看哪里出问题了" → grouped checklist |
| [`wjs-eating-and-growing`](./wjs-eating-and-growing/) | 5 步反思框架：把"吃堑"变成 L3 权重的真实改变 | 吃亏的经历 → 堑 + 自动输出 + 旧参数 + 新参数 + 替代动作 |
| [`wjs-teaching-english`](./wjs-teaching-english/) | 把一个英语单词做成 HLS 视频超剪（word + IPA + 中文解释 + 真实片段） | `teach love` / `学英语 <word>` / `/wjs-teaching-english <word>` |
| [`wangjianshuo-perspective`](./wangjianshuo-perspective/) | 切换到王建硕视角写作与思考 | "用王建硕的角度" → 以他的声音回应，直到用户说"退出" |

---

## 1. 公众号 / WeChat

### [`wjs-publishing-wechat`](./wjs-publishing-wechat/)

帮我写 / 润色微信公众号文章，并自动生成配套素材。

- **轻润色，不重写。** 保留作者语气和节奏，只改错字、调段落、抚平特别拗口的句子。
- 自动生成 **题图（cover）** 和 **解释图（illustration）**。
- 自动生成标题候选、摘要、可直接粘贴到 mp.weixin.qq.com 的 HTML。
- 每篇正文必须有 2–4 处 `**加粗**`（`upload-draft.sh` 渲染为红色），打在点睛句和核心概念词上。
- 通过 `md2wechat` 上传草稿到公众号后台。

> 触发词：`写一篇微信文章` / `公众号` / `润色` / `题图` / `发公众号`

### [`wjs-mining-articles`](./wjs-mining-articles/)

把一个视频的 SRT（独白或对谈）挖掘成多篇独立的微信公众号文章。

- **口语是矿，文章是提炼的金属。** 识别字幕里 2–6 个各自独立、各自值得成文的话题，每个话题长成一篇 800–1000 字的公众号文章。
- **支持独白和对谈两种源。** 对谈模式先让用户确认哪一方是王建硕，只提炼他的观点；自动跳过调麦克风、寒暄、离席等非正片段落。
- 生成每篇文章的微信草稿（对接 `wjs-publishing-wechat` 上传），可选再排期发到 X。

> 触发词：`把这个视频写成文章` / `从字幕里挖文章` / `这个 SRT 能写几篇` / `把对谈写成文章` / `/wjs-mining-articles <srt>`

---

## 2. 文章转视频 / Article to Video

### [`wjs-converting-text-to-video`](./wjs-converting-text-to-video/)

把一篇公众号 `article.md` 做成 **1080×1920 竖屏、30–90 秒** 的中文解说短视频，直接发视频号 / 抖音 / 小红书 / YouTube Shorts。

- **TTS 旁白**：默认阿虎对话（Volcano 火山引擎 `zh_male_ahu_conversation_wvae_bigtts`），5–10 个 narration chunk，每段 3–12 秒
- **HyperFrames CSS/GSAP 动画**：按文章论证结构拆成 5–10 个视觉 scene，16 种模板（Hero / Contrast / List / Stat / Quote / 几何装饰）按强制配比混搭
- **抽象水彩背景**：GPT Image 2 生成 `bg.png`（6 种 theme 可选：tech / personal / reflection / growth…），blur 30 柔化后作全片基底
- **Scene Mix Rule**（强制）：≥4 种模板类型、≥1 个 color-flip、字号跨度 ≥240px、≥2 次节奏切换——防止"平铺直叙 slideshow"
- **转场 SFX**：tick（切场）/ chime（列表亮项）/ bell（climax 词，全片最多 1 次）
- **YouTube 日推**：cron 每天 10:00 自动上传最多 5 个 MP4；portrait 自动标 `#Shorts`

> 触发词：`把这篇文章做成视频` / `做一个解说视频` / `讲解视频` / `/wjs-converting-text-to-video`

---

## 3. 视频本地化 — 字幕 + 翻译 + 配音

一条 **「转写 → 翻译 → 配音 → 烧字幕」** 的四步流水线。每一步都是独立 skill，可以单独跑，也可以让 [`wjs-localizing-video`](./wjs-localizing-video/) 这个 orchestrator 串起来跑完整流程。

| 步骤 | Skill | IN | OUT |
|---|---|---|---|
| ① 转写 | [`wjs-transcribing-audio`](./wjs-transcribing-audio/) | 音/视频 + 源语言 | 源语言 SRT |
| ② 翻译 | [`wjs-translating-subtitles`](./wjs-translating-subtitles/) | 源语言 SRT + 目标语言 | 目标语言 SRT（标点重切） |
| ③ 配音（可选） | [`wjs-dubbing-video`](./wjs-dubbing-video/) | 视频 + 目标语 SRT + 音色 | 替换音轨的视频 |
| ④ 烧字幕 / 终混（可选） | [`wjs-burning-subtitles`](./wjs-burning-subtitles/) | 视频 + SRT (+ 可选 dub) | 一次编码完成的最终 MP4 |

### [`wjs-transcribing-audio`](./wjs-transcribing-audio/)
中文走豆包（Volcano）ASR，其它语言走 OpenAI Whisper word-level timestamps + 自己重新组装 cue。所有 cue 都按标点切，避免句子被切到一半。

### [`wjs-translating-subtitles`](./wjs-translating-subtitles/)
纯文本，不碰音视频。简体中文 / 英文是 first-class targets。重切逻辑保证每条字幕都在真正的句号 / 问号 / 感叹号处结束。可输出单语 SRT 或双语 SRT。

### [`wjs-dubbing-video`](./wjs-dubbing-video/)
按 voice ID 路由：中文 → 豆包 TTS，其它语言 → edge-tts neural。默认单说话人，opt-in 视觉 diarization 做多说话人多音色。**只产出 dub 音轨**，不做最终合成。

### [`wjs-burning-subtitles`](./wjs-burning-subtitles/)
本地化流水线的终点。一次 ffmpeg 编码同时做：烧字幕（libass）、把 dub 混进来、把原音降低音量作为底噪保留。**不走级联**——避免多次重编码掉画质。当 Homebrew 的 ffmpeg 不带 libass 时，会自动下载 evermeet 的静态构建。

### [`wjs-localizing-video`](./wjs-localizing-video/)（orchestrator）
当用户说 **「完整本地化」** 时用这个总编排器。单步需求请直接用上面四个之一 —— boundary 更清楚也更快。

---

## 4. 多机位拍摄 → 自动剪辑

### [`wjs-syncing-multicam`](./wjs-syncing-multicam/)

同一事件、不同设备拍的 N 路素材，用 **音频互相关** 算出每个文件相对共同时间轴的偏移。实现由开源的 **[`polysync`](https://pypi.org/project/polysync/)** pip 包承载（`pip install polysync`），通过 `polysync sync` 命令驱动。

- **关键设计：sidecar over re-encode。** 不生成 `_synced.MOV`，只输出每个原始文件旁边一份 `.sync.json`。原片永不被改写、不被复制、不被重编码。
- 75 分钟 3 机位 4K 拍摄 = 60+ GB，重编码同步会让磁盘翻倍且画质下降。Sidecar 是无损可逆元数据。
- 多探针漂移检测 + 线性拟合 —— 校正相机时钟间 5–50 ppm 晶振偏差，保证长节目末尾不跑偏。
- 自动选最响音频轨（处理 Sony FX6 MXF 等多轨文件中 `a:0`/`a:1` 静音的边界情况）。
- 下游用 `ffmpeg -itsoffset` 在消费侧应用偏移；`polysync verify` 做独立残差校验。

### [`wjs-editing-multicam`](./wjs-editing-multicam/)

读 sidecar，自动剪辑成单条 MP4。决策完全由 **每秒音频能量** 驱动 —— 哪个机位的麦最响，就切到哪个。实现由 **[`polysync`](https://pypi.org/project/polysync/)** 驱动（`polysync edit` 生成 EDL，`polysync render-cuts` / `render-pip` 渲染）。

- 硬切（无 crossfade）+ 可选的 picture-in-picture 小窗（`render-pip`）。
- 音频可选单机位麦（默认）或 `--duck-audio` 说话人门控混音——每秒保留当前说话人的领夹麦、压低其余麦，消除串音和底噪。`--audio-cams` 限定门控范围，排除宽景/空间感声道。
- 原生支持 Sony S-Log3 → Rec.709 套 LUT（`--log slog3`）、逐机位旋转（`--rotate 1:90`）、竖屏输出（`--width 1080 --height 1920 --fill`）。
- 不做人脸 / 取景识别 —— 那是 [`wjs-overlaying-video`](./wjs-overlaying-video/) 或 HyperFrames 的事。

---

## 5. 长视频拆条 + 后期 + 横竖屏

### [`wjs-segmenting-video`](./wjs-segmenting-video/)

长访谈 / 讲座 / 播客 → 3–6 段独立可看的短片。

5 步流水线（每步也能独立跑）：
1. Agent 读 SRT 决定话题边界
2. Stream-copy 切原视频（不重编码）
3. 给每个 clip 用 gpt-image-2 生成封面（标题烤进图里）
4. 把封面作为 1.5 秒 title card 拼到 clip 前面
5. libass 烧字幕

**只做切 + 裁 —— 封面 / 字幕 / 动画 / CTA 交给下游 `wjs-overlaying-video`。**

### [`wjs-overlaying-video`](./wjs-overlaying-video/)

视频后期。基于 **HyperFrames** —— 一个 HTML/CSS 的视频合成框架。在同一份 HyperFrames 工程里加：

- AI 生成封面作为首帧
- HTML/CSS captions（kinetic、逐词高亮、自定义字体）按 SRT 同步
- hook moment 的 kinetic illustration
- 章节 chip / 片尾 CTA / lower-thirds

**所有元素在一次最终编码里渲染**，不做级联。

### [`wjs-reframing-video`](./wjs-reframing-video/)

横竖屏互转 —— **裁切** 而不是缩放或加黑边。

- 16:9 → 9:16（发抖音 / 视频号 / 小红书 / YouTube Shorts / TikTok / Reels）
- 9:16 → 16:9（竖屏手机视频转横屏播客）
- 4:3 ↔ 3:4 也支持
- 用 MediaPipe FaceLandmarker + 嘴部张合度方差找 **真正在说话** 的人（不是最大或最 confident 的脸）
- 段落间 **硬切**，不做 smooth pan（更像真人剪辑）
- 输出 `.crop.json` 记录裁切计划，原片不动

---

## 6. 分发 / 上传 / 推广

### [`wjs-uploading-video`](./wjs-uploading-video/)

批量上传成片到 YouTube（王建硕频道）。

- 读取 sibling `UPLOAD_META.md` 拿每个视频的 title / description / tags（用户自定义的 markdown 格式）
- 在 SOCKS/HTTP 代理后能用 —— 直接走 `requests` 做 resumable upload，避开 `google-api-python-client` 的 `MediaFileUpload` 在该代理下卡死的问题
- 不支持微信视频号（无公开 API）/ 抖音 / 小红书 / B 站

### [`wjs-tweeting-from-articles`](./wjs-tweeting-from-articles/)

每天一条 X tweet，**灵感直接从最近发布的公众号文章里萃取**。

- 自动找到最近一篇还没推过的文章（7 天内按日期倒序）
- 从文章里起草三条候选（A 金句 / B 核心比喻 / C 认知反差），让用户选一条
- 用户确认后立刻真发（`xurl POST /2/tweets`），记录到 `state/history.jsonl` 防重复
- 风格约束：王建硕语气，平实家常，不加 hashtag / emoji / mp.weixin 链接；中文 tweet ≤ 120 字
- 支持**批量排期模式**：一次把多篇文章排进队列，按每 N 小时一条自动发。
- 可选 `--dry-run` 预览不发；支持 `/schedule daily` 自动触发

> 触发词：`今天的 tweet` / `从文章里发推` / `每天发一个 tweet` / `/wjs-tweeting-from-articles`

### [`wjs-syndicating-articles`](./wjs-syndicating-articles/)

把最新一篇还没分发过的公众号文章，**一套文案扇出到所有平台**。

- **API 平台真发**（有凭证时自动 POST）：X / Bluesky / Threads / LinkedIn
- **手动平台生成待发件箱**（`outbox/` 目录，复制粘贴即可）：Facebook / 小红书 / 即刻 / 知乎
- **幂等去重**：`state/history.jsonl` 记录每篇文章在每个平台的发布状态，重复跑只补发没成功的
- **凭证降级**：某平台 API 凭证缺失或过期 → 自动降为 outbox，不中断其他平台
- 可加 `--dry-run` 预览；`--mark <slug> <platform>` 手动标记已发；`--open` 交互模式开浏览器

> 触发词：`分发文章到各平台` / `同步到社交平台` / `今天的文章发各平台` / `/wjs-syndicating-articles`

---

### [`wjs-promoting-skills`](./wjs-promoting-skills/)

每天 04:00 自动推广 skill：挑一个 `wjs-*` skill → 生成今日推广角度 → 发到 X（Twitter）→ 把 Reddit / HN / Discord 草稿落到 `outbox/` 等人工 review。

- **X 真发，社区只起草。** Reddit / HN 没有可靠的自动发帖 API，不冒封号风险。
- **Idempotent + 节流**：同一 skill 7 天内不重复推；当天没改动的 skill 跳过；每天最多 1 条 X。
- 角度轮换：同一 skill 会从「具体痛点 → 反直觉设计决策 → 串联工作流 → 最近更新」四个维度循环。
- `DRY_RUN=1 daily.sh` 可以预览而不真发；`uninstall.sh` 随时停掉 launchd 定时任务。

> 触发词：`推广 skills` / `skill marketing` / `promote my skills` / `每天自动推广`

---

## 7. 英语教学 / English Teaching

### [`wjs-teaching-english`](./wjs-teaching-english/)

把一个英语单词做成 HLS "超剪" 课程，从 mira 视频库里找出所有含该单词的 season2 片段，拼成一个完整的 `.m3u8` 播放列表。

- **结构**：双语 intro card（word + IPA + 中文词义 + 用法，Volcano TTS 配音）→ 超剪片段 → 关注王建硕 CTA card
- **不生成 MP4**：只有两张 intro/CTA 卡片被渲染成 `.ts`，其余直接引用 COS 上的原始片段，减少重编码
- **card 编码**：自动对齐第一个超剪片段的 codec / fps / 分辨率，避免 HLS 播放器在 discontinuity 处重初始化解码器
- 如果该词在库里没有片段，脚本直接退出并提示用户换一个更常用的词

> 触发词：`teach <word>` / `讲讲 <word>` / `学英语 <word>` / `把 <word> 做成视频` / `/wjs-teaching-english <word>`

---

## 8. 项目体检 / 反思 / 自我维护

### [`wjs-auditing-project`](./wjs-auditing-project/)

当我说 "看看项目出了什么问题" / "为什么用户的需求还没上线" / "为什么没提交 App Store"，跑这个 skill。

- **硬性两阶段**：先 read-only 巡检 → 给我一份分组 checklist；我确认之后才动手修。
- 覆盖：未合并分支、停滞的 PR、失败的 GitHub Actions、过期的 build、TODOS.md / ROADMAP 漂移、未发布的 commit、日志里的 error。
- 知道我的 Cathier iOS app 工作流（Xcode + fastlane + @claude PR auto-merge）。

### [`wjs-eating-and-growing`](./wjs-eating-and-growing/)（吃一堑长一智）

当我反思一个失误、反复犯的错，或者"知道道理但做不到"，走这五步。

- **底层框架**：L1（不知道）/ L2（知道但临场来不及）/ L3（本能赢了）—— 三层完全不同，用错修法等于练了寂寞。目标永远是 L3——不假思索的第一反应。
- **一步一问，不可跳**：每步只问一个问题等回答再走下一步。跳步会让复盘变成又一条 L1 笔记。
- 五步：① 说清楚这次"堑"（纯事实）→ ② 抓住自动输出（第一反应原话）→ ③ 挖旧参数（解释模式根因）→ ④ 定新参数（一类触发的新响应）→ ⑤ 给出替代动作（那一秒具体做什么）。
- 最终输出：一个 block，5 行，任何一行还是模糊的说明没走完。

> 触发词：`反思` / `复盘` / `吃一堑` / `这次又栽了` / `为什么我总是…` / `知道道理但做不到`

---

## 9. 思维框架 / Perspective

### [`wangjianshuo-perspective`](./wangjianshuo-perspective/)

以王建硕（Jian Shuo Wang）的身份和声音写作、回应、思考。基于约 100 万词英文博客 + 约 109 万字中文博客（2002–2022，全部一手）提炼出 7 个核心心智模型、10 条决策启发式和完整的双语表达 DNA。

- 激活后直接用王建硕的语气回应（不写「王建硕会认为……」）
- 平实、诚恳、好奇，爱用家常比喻，先讲具体再上升到普通道理
- **默认用中文**（公众号声音）；需要英文时切换
- 保持角色直到用户说"退出" —— 不需要每轮重新点名
- 还包含 `yuanqi-prompt.md` —— 为元器（Yuanqi）平台精简版的人设 prompt

> 触发词：`用王建硕的视角` / `王建硕会怎么看` / `像王建硕一样写` / `Jian Shuo Wang perspective` / `切换到王建硕`

---

## 10. X 增长 / X Growth

### [`wjs-x-increasing-follower`](./wjs-x-increasing-follower/)

把「涨粉」当工程做：每个改动是带编号的实验，有假设、有目标指标、有 before 可回滚、有判决。不靠感觉，靠数。

- **北极星指标**：新增关注 ÷ 主页访问（转化率 ratio）——对爆款流量免疫，bio 改好了才让每个来访的人更愿意关注。
- **实验分层**：profile（转化）/ posting（触达）/ engagement（触达）/ timing（触达），每个 action 声明被哪个指标考核。
- 数据来源：X Analytics CSV 导出（ratio 数据 API 拿不到），每日 `daily-check.sh` 自动 ingest + 算判决。
- **判决规则**：中位数对比（抗均值被爆款骗）；Δ ≥ +10% keep / Δ ≤ -10% rollback / 之间 flat；回滚永远先问用户，绝不静默改 bio。

> 触发词：`涨粉` / `X 涨粉实验` / `A/B 测我的 profile` / `今天的涨粉检查` / `/wjs-x-increasing-follower`

### [`wjs-x-improving-content`](./wjs-x-improving-content/)

把「写好推」当工程做：不断改 `prompts/x/prompt.md`，用 impression 数据看哪版最好，挖出内容特征反哺下一版。是 `wjs-x-increasing-follower` 的孪生——那个测 profile→关注转化，这个测 **prompt→每条推的 impression**。

- **版本 = prompt.md 的 git short-SHA**：推发布时间对应当时 git 历史里的 prompt SHA，无需改 Action，历史推也能回填。
- **内容特征分析**（最有用的部分）：按 angle/长度/话题拆 impression 中位数，告诉你 prompt 该往哪改。版本对比给方向，内容特征给抓手。
- 数据来源：X Analytics Content CSV 导出（丢进 `inbox/` 目录）。
- 判决用中位数，每版至少 5 条成熟推（发布满 3 天）才下版本级结论。

> 触发词：`改 X 的 prompt` / `X 内容改进` / `哪版 prompt 最好` / `什么内容 impression 高` / `/wjs-x-improving-content`

---

## 典型工作流串接

**完整本地化一个西班牙语播客 → 中文版上 YouTube：**

```
源视频
  └─ wjs-transcribing-audio       → 西语 SRT
      └─ wjs-translating-subtitles → 中文 SRT
          └─ wjs-dubbing-video      → 中文配音的视频
              └─ wjs-burning-subtitles → 烧字幕 + 混音 → 最终 MP4
                  └─ wjs-uploading-video → YouTube
```

**或者一句话**：`/wjs-localizing-video` 把上面四步串起来跑。

**双机位访谈 → 抖音 + YouTube 双版本：**

```
两路 MOV
  └─ wjs-syncing-multicam         → 两份 .sync.json
      └─ wjs-editing-multicam     → 单条 16:9 MP4
          ├─ wjs-segmenting-video → 4 个独立话题 clip
          │   └─ wjs-overlaying-video → 加封面 + 字幕 + CTA
          │       └─ wjs-uploading-video → YouTube
          └─ wjs-reframing-video  → 9:16 竖屏版本 → 视频号 / 抖音
```

**写公众号文章并做成视频：**

```
草稿 → wjs-publishing-wechat → 题图 + 解释图 + HTML + 上传草稿 → mp.weixin.qq.com 后台微调发布
          └─ wjs-converting-text-to-video → 1080×1920 MP4（TTS + 水彩背景 + GSAP 动画）
                └─ 日推 cron → YouTube Shorts
```

---

## 如何贡献 / Contributing

欢迎提 Issue 或 PR。新增 skill 的要求：

1. 目录名用 **V-ing 动名词**（如 `wjs-doing-something`），加 `wjs-` 前缀与本仓库风格保持一致。
2. 目录内放一个 `SKILL.md`，frontmatter 里写 `name` 和 `description`（含具体触发词/例句），正文写清楚 when to use / when NOT to use / 执行步骤。
3. 需要的脚本放同目录下。
4. 提 PR，在 PR 描述里说明 skill 的用途和触发词。

有问题或建议，请到 [Issues](https://github.com/jianshuo/Claude-skills/issues) 反馈。
