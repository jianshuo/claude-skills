# claude-skills

我（[王建硕](https://github.com/jianshuo)）日常在 Claude Code 里用的 skills。

> Auto-mirrored from `~/.claude/skills/` by a PostToolUse hook —
> 每次我编辑 `wjs-*` skill，对应目录会被 rsync 到这里并推送到 GitHub。
> Hook 源码：`~/.claude/skills-publish-hook.sh`

## 安装 / Install

```bash
# 单个 skill（推荐）
clawhub install wjs-transcribing-audio
clawhub install wjs-translating-subtitles
# ... 13 个 skill 都可以这样装

# 或者克隆整个仓库到 ~/.claude/skills/
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
| [`wjs-auditing-project`](./wjs-auditing-project/) | 项目状态体检 | 一句"看看哪里出问题了" → grouped checklist |

---

## 1. 公众号 / WeChat

### [`wjs-publishing-wechat`](./wjs-publishing-wechat/)

帮我写 / 润色微信公众号文章，并自动生成配套素材。

- **轻润色，不重写。** 保留作者语气和节奏，只改错字、调段落、抚平特别拗口的句子。
- 自动生成 **题图（cover）** 和 **解释图（illustration）**。
- 自动生成标题候选、摘要、可直接粘贴到 mp.weixin.qq.com 的 HTML。
- 通过 `md2wechat` 上传草稿到公众号后台。

> 触发词：`写一篇微信文章` / `公众号` / `润色` / `题图` / `发公众号`

---

## 2. 视频本地化 — 字幕 + 翻译 + 配音

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

## 3. 多机位拍摄 → 自动剪辑

### [`wjs-syncing-multicam`](./wjs-syncing-multicam/)

同一事件、不同设备拍的 N 路素材，用 **音频互相关** 算出每个文件相对共同时间轴的偏移。

- **关键设计：sidecar over re-encode。** 不生成 `_synced.MOV`，只输出每个原始文件旁边一份 `.sync.json`。原片永不被改写、不被复制、不被重编码。
- 75 分钟 3 机位 4K 拍摄 = 60+ GB，重编码同步会让磁盘翻倍且画质下降。Sidecar 是无损可逆元数据。
- 下游用 `ffmpeg -itsoffset` 在消费侧应用偏移。

### [`wjs-editing-multicam`](./wjs-editing-multicam/)

读 sidecar，自动剪辑成单条 MP4。决策完全由 **每秒音频能量** 驱动 —— 哪个机位的麦最响，就切到哪个。

- 硬切（无 crossfade）+ 可选的 picture-in-picture 小窗。
- 音频取自被选中那个机位的麦（不做多麦克风 mix）。
- 不做人脸 / 取景识别 —— 那是 [`wjs-overlaying-video`](./wjs-overlaying-video/) 或 HyperFrames 的事。

---

## 4. 长视频拆条 + 后期 + 横竖屏

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

## 5. 分发 / 上传

### [`wjs-uploading-video`](./wjs-uploading-video/)

批量上传成片到 YouTube（王建硕频道）。

- 读取 sibling `UPLOAD_META.md` 拿每个视频的 title / description / tags（用户自定义的 markdown 格式）
- 在 SOCKS/HTTP 代理后能用 —— 直接走 `requests` 做 resumable upload，避开 `google-api-python-client` 的 `MediaFileUpload` 在该代理下卡死的问题
- 不支持微信视频号（无公开 API）/ 抖音 / 小红书 / B 站

---

## 6. 项目体检 / 自我维护

### [`wjs-auditing-project`](./wjs-auditing-project/)

当我说 "看看项目出了什么问题" / "为什么用户的需求还没上线" / "为什么没提交 App Store"，跑这个 skill。

- **硬性两阶段**：先 read-only 巡检 → 给我一份分组 checklist；我确认之后才动手修。
- 覆盖：未合并分支、停滞的 PR、失败的 GitHub Actions、过期的 build、TODOS.md / ROADMAP 漂移、未发布的 commit、日志里的 error。
- 知道我的 Cathier iOS app 工作流（Xcode + fastlane + @claude PR auto-merge）。

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

**写公众号文章：**

```
草稿 → wjs-publishing-wechat → 题图 + 解释图 + HTML + 上传草稿 → mp.weixin.qq.com 后台微调发布
```

---

## 如何贡献 / Contributing

欢迎提 Issue 或 PR。新增 skill 的要求：

1. 目录名用 **V-ing 动名词**（如 `wjs-doing-something`），加 `wjs-` 前缀与本仓库风格保持一致。
2. 目录内放一个 `SKILL.md`，frontmatter 里写 `name` 和 `description`（含具体触发词/例句），正文写清楚 when to use / when NOT to use / 执行步骤。
3. 需要的脚本放同目录下。
4. 提 PR，在 PR 描述里说明 skill 的用途和触发词。

有问题或建议，请到 [Issues](https://github.com/jianshuo/Claude-skills/issues) 反馈。
