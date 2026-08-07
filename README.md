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
| [`wjs-mining-voicedrop`](./wjs-mining-voicedrop/) | VoiceDrop 语音备忘 → 转写 → 公众号文章草稿 | R2 收件箱 VoiceDrop-*.m4a → SRT → N 篇微信草稿 |
| [`wjs-voicedrop`](./wjs-voicedrop/) | VoiceDrop MCP 的入口：完成 6+4 手机配对登录，把你接上 voicedrop.cn/mcp 的 32 个工具（文章读写与版本、文风与蒸馏、挖矿与重写、社区与投币等） | `voicedrop` / `voicedrop 登录` / `接 voicedrop mcp` / `/wjs-voicedrop` |
| [`wjs-evaling-voicedrop-prompts`](./wjs-evaling-voicedrop-prompts/) | 评估 VoiceDrop 挖矿 prompt 改版：用金标集对冠军和候选做盲评对决，输出胜率报告，人工确认后才晋级生产 | `评估 prompt` / `挖矿 prompt 改好了吗` / `eval prompt` / `/wjs-evaling-voicedrop-prompts` |
| [`wjs-voicedrop-choosing-cover`](./wjs-voicedrop-choosing-cover/) | 判断 VoiceDrop 文章是否需要 AI 题图，并选定风格与生成可直接用的 prompt（比例 2.45:1 / 1568×640） | `这篇要不要配题图` / `选个题图风格` / `给这篇出个题图 prompt` / `/wjs-voicedrop-choosing-cover` |
| [`wjs-voicedrop-post-processing`](./wjs-voicedrop-post-processing/) | 新挖 VoiceDrop 文章后处理守护进程（launchd 每 5 分钟触发，无人值守） | `/wjs-voicedrop-post-processing <stem>` |
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
| [`wjs-polishing-x-engagement`](./wjs-polishing-x-engagement/) | 把平淡中文 tweet 改写成"真事实 + 钩子"的高互动版本，每次给 2–3 个不同钩子的候选 | 一条中文推文 → 2–3 个改写版本 + 事实来源 |
| [`wjs-cleaning-spam`](./wjs-cleaning-spam/) | 清理 X 推文下的同城引流 spam 回复：dry-run 预览 → 人工审 borderline → 隐藏 + 静音 | spam 回复列表 → 隐藏条数 + 静音账号数（7 天窗口内） |
| [`wjs-auditing-project`](./wjs-auditing-project/) | 项目状态体检 | 一句"看看哪里出问题了" → grouped checklist |
| [`wjs-eating-and-growing`](./wjs-eating-and-growing/) | 5 步反思框架：把"吃堑"变成 L3 权重的真实改变 | 吃亏的经历 → 堑 + 自动输出 + 旧参数 + 新参数 + 替代动作 |
| [`wjs-teaching-english`](./wjs-teaching-english/) | 把一个英语单词做成 HLS 视频超剪（word + IPA + 中文解释 + 真实片段） | `teach love` / `学英语 <word>` / `/wjs-teaching-english <word>` |
| [`wjs-converting-wp-to-hugo`](./wjs-converting-wp-to-hugo/) | WordPress → Hugo 静态站迁移，老链接不断 | WXR .xml + uploads/ → Hugo + GitHub Pages |
| [`wjs-publishing-hugo`](./wjs-publishing-hugo/) | Hugo 博客的对话式后台：说一句就发文/改文件/管类目，无需 CMS 或服务器 | `发一篇博客` / `博客后台` / `/wjs-publishing-hugo` |
| [`wjs-looping-feedback`](./wjs-looping-feedback/) | 给任意网站装「提个建议→Issue→Claude 自动改代码→部署」反馈闭环 | `给网站加个反馈对话框` / `feedback loop` / `/wjs-looping-feedback` |
| [`wjs-publishing-testflight`](./wjs-publishing-testflight/) | 配置 fastlane + GitHub Actions，推 main 自动构建上传 TestFlight，每第 10 个 build 自动提审 App Store | iOS 项目 → Fastfile + build.yml + 自动 TestFlight / App Store |
| [`wjs-publishing-appstore`](./wjs-publishing-appstore/) | iOS TestFlight build → App Store：截图 + 元数据文案 + 提审（fastlane deliver + release lane） | `提交 App Store` / `准备截图和文案` / `/wjs-publishing-appstore` |
| [`wangjianshuo-perspective`](./wangjianshuo-perspective/) | 切换到王建硕视角写作与思考 | "用王建硕的角度" → 以他的声音回应，直到用户说"退出" |
| [`wjs-distilling-style`](./wjs-distilling-style/) | 从少量样文提炼任意作者写作指纹，再把目标文本改写成那种味道；日常用一次性 prompt 一把过，深验时开完整判官盲测闭环 | `蒸馏文风` / `把这篇改成XX的味儿` / `/wjs-distilling-style` |

---

## 1. 公众号 / WeChat

### [`wjs-publishing-wechat`](./wjs-publishing-wechat/)

帮我写 / 润色微信公众号文章，并自动生成配套素材。

- **轻润色，不重写。** 保留作者语气和节奏，只改错字、调段落、抚平特别拗口的句子。
- 自动生成 **题图（cover）**（900×383，2.35:1）和 **解释图（illustration）**（比例由内容决定，模型自选）。
- 自动生成标题候选、摘要（「好奇缺口」式，勾住读者）、可直接粘贴到 mp.weixin.qq.com 的 HTML。
- 每篇正文必须有 2–4 处红色标注（`<span style="color:#ff0000;">…</span>`），打在点睛句和核心概念词上；`**加粗**` 语法已弃用。
- 通过 `md2wechat` 上传草稿到公众号后台，自动在文末注入**最近已发布文章**链接列表（`upload-draft.sh` 驱动，支持 `WECHAT_PUBLISH_NO_RECENT=1` 关闭）。

> 触发词：`写一篇微信文章` / `公众号` / `润色` / `题图` / `发公众号`

### [`wjs-mining-articles`](./wjs-mining-articles/)

把一个视频的 SRT（独白或对谈）挖掘成多篇独立的微信公众号文章。

- **口语是矿，文章是提炼的金属。** 识别字幕里 2–6 个各自独立、各自值得成文的话题，每个话题长成一篇 800–1000 字的公众号文章。
- **支持独白和对谈两种源。** 对谈模式先让用户确认哪一方是王建硕，只提炼他的观点；自动跳过调麦克风、寒暄、离席等非正片段落。
- 生成每篇文章的微信草稿（对接 `wjs-publishing-wechat` 上传），可选再排期发到 X。

> 触发词：`把这个视频写成文章` / `从字幕里挖文章` / `这个 SRT 能写几篇` / `把对谈写成文章` / `/wjs-mining-articles <srt>`

### [`wjs-mining-voicedrop`](./wjs-mining-voicedrop/)

把 VoiceDrop iOS app 上传到 R2 收件箱（`jianshuo.dev/files`）的语音备忘，自动转写并挖掘成公众号文章草稿。这是 VoiceDrop 的 Mac 端闭环：开口即录、停即上传，回到桌面就有草稿等着。

- **不重写任何流程**：收件箱进出（列 / 下载 / 删）和逐条编排由本 skill 负责，转写交 `wjs-transcribing-audio`，成文交 `wjs-mining-articles`。
- **R2 当收件箱**：处理完成才从 R2 删，失败 / 未出草稿 / 用户未勾选 → 保留在 R2，下次再来。串行处理，一条彻底跑完再下一条，避免收件箱状态混乱。
- 唯一新增代码：`scripts/voicedrop-inbox.sh`（`list` / `download` / `delete`）。

> 触发词：`处理 VoiceDrop 录音` / `把新录音挖成文章` / `口述备忘变文章` / `处理一下我的录音` / `/wjs-mining-voicedrop`

### [`wjs-voicedrop`](./wjs-voicedrop/)

VoiceDrop 的 MCP 接入入口。所有实际功能（文章、文风、挖矿、社区……）都在 voicedrop.cn/mcp 的 32 个 MCP 工具里；本 skill 唯一的工作是把你接上去。

- **接上了？直接用工具。** 会话里已有 `list_articles`、`read_style`、`community_feed`、`credit_balance` 等工具时，无需阅读 SKILL.md，直接调用。
- **还没接上？走两步登录：** 用 MCP 的 `login` 工具完成 6+4 手机配对——先用手机 **设置 → 账户** 里的 6 位十六进制码发第一步，手机弹出 4 位数字码后发第二步，拿到 `anon_` 令牌后接进客户端。
- **MCP 覆盖的 32 个工具**：文章读写与版本、文风与蒸馏、挖矿与重写、社区与投币、算力余额与账单、分享 / 公众号 / 小红书等。工具说明以 MCP 自身描述为准。

> 触发词：`voicedrop` / `voicedrop 登录` / `接 voicedrop mcp` / `voicedrop token` / `/wjs-voicedrop`

### [`wjs-evaling-voicedrop-prompts`](./wjs-evaling-voicedrop-prompts/)

评估 VoiceDrop 挖矿 prompt 的改版是否真的更好。用一组金标集对「冠军 prompt」（当前生产版）和「候选 prompt」（改版）跑相同输入，派盲评裁判 agent 做成对比较，汇总胜率报告——胜率 ≥ 70% 且无确定性回退，才在用户确认后晋级生产。

- **盲评协议**：A/B 顺序随机（一半 fixture 把候选放 A，一半放 B），每条由与生成模型不同家族的裁判模型独立评分，完全消除位置偏见。
- **判决维度**（`references/judge-rubric.md`）：结构完整性、王建硕文风还原、事实骨架保留、句子节奏、段落密度——每维 1–5 分 + 理由。
- **晋级门槛**：胜率 ≥ 70% + 无 JSON 格式回退 + 用户点「认可」，三者缺一不可；候选写回 `mine.js` 后自动跑 `npm test` 确认无破坏。
- 不做无人值守、不测成本/延迟、不评审核或语音编辑 prompt。

> 触发词：`评估 prompt` / `挖矿 prompt 改好了吗` / `eval prompt` / `比一比两版 prompt` / `/wjs-evaling-voicedrop-prompts`

### [`wjs-voicedrop-choosing-cover`](./wjs-voicedrop-choosing-cover/)

给一篇 VoiceDrop 文章做两个决定：**配不配题图**，以及**用哪种风格的 prompt 生成**。

- **真照片优先**：文中有 `[[photo:KEY]]` 实拍且与主题相关 → 直接指出用哪张当封面，不写 AI prompt。
- **四步流水**：① 配不配（实拍 / 无照片 / 极短文）→ ② 按文章气质选风格（思辨 / 生活随笔 / 怀旧 / 科技 / 幽默 / 哀伤 共 6 种）→ ③ 拼 prompt（比例 2.45:1 / 1568×640，标题 6–10 字，带避免清单）→ ④ 出图（仅用户要求时）。
- **固定输出契约**（每篇 3–4 行）：判断 → 风格 → Prompt（或封面裁切建议）。
- **内置防呆 Red Flags**：连续同风格、文中有实拍还写 AI prompt、规格混错（900×383）、哀伤文卡通化 —— 任一触发即打回重来。

> 触发词：`这篇要不要配题图` / `选个题图风格` / `给这篇出个题图 prompt` / `choosing cover` / `/wjs-voicedrop-choosing-cover`

### [`wjs-voicedrop-post-processing`](./wjs-voicedrop-post-processing/)

VoiceDrop 新文章的自动后处理——由 launchd `com.jianshuo.voicedrop-postprocess` 每 5 分钟轮询触发，以文章 stem 为参数无人值守地运行。

- **守护进程模式**：通过 `claude -p`（headless）调用，voicedrop MCP 预先接好；读文章 / 写版本工具可用，发布、删除类工具在调用方已禁用。
- **当前是骨架版**：验证正文非空、标题存在，完成后输出 `postprocess ok: <stem> — <标题>（<字数>字）`。
- **可扩展**：第 2 步占位符可替换为配图 / 打标签 / 质量评分 / 生成摘要等动作，轮询器无需改动。
- **幂等**：读失败自动重试一次，再失败以非零退出（轮询器下一轮重试），绝不发布、删除或修改文风库。

> 触发词：`/wjs-voicedrop-post-processing <stem>`（守护进程直接调用，不走自然语言触发）

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

### [`wjs-distilling-style`](./wjs-distilling-style/)

从少量样文提炼任意作者的写作指纹，再把目标文本改写成那种味道——任何作者都适用，不限于王建硕。

- **9 轴结构化指纹**：句子节奏、段落长度、词汇签名、语气腔调、论证结构、比喻运用、情绪强度、开头收尾、雷区——每轴必须摘 2–3 句真实锚点原句（没有锚点的轴等于没蒸馏）。
- **事实骨架纪律**：先把原文信息点列成 bullet，改写只换「怎么说」，不增不减事实——改风格不是改内容。
- **默认一次性 prompt（日常推荐）**：`references/oneshot-prompts.md` 提供两段自包含提示词——Prompt A（Style Card + 目标文章 → 改写稿）和 Prompt B（样本文章 → Style Card）——内嵌 9 轴指纹、事实骨架纪律和 AI 露馅 6 条反制，把多轮判官循环压缩成一轮内联自检，够用、一把过。
- **独立判官盲测（深验时启用）**：起一个 subagent，只给它 Style Card + 改写稿，不告诉它是 AI 改的，逐轴评分（1–5），列出具体出戏句；发布级 / 批量高仿真时才跑完整闭环（含图灵判别盲测）。
- **两种模式**：蒸馏（样本 → `~/code/style-cards/<author>/style-card.md`）/ 改写（目标文本 + Style Card → 改写稿，不达标最多 2–3 轮回炉）。样本 < 3 篇会明确提示用户指纹会不稳。
- Style Cards 存在本地独立库（`~/code/style-cards/`），不同步到公开 repo，防止他人稿件外泄。

> 触发词：`蒸馏文风` / `提炼XX的风格` / `把这篇改成XX的味儿` / `mimic this writer` / `match this author's style` / `/wjs-distilling-style`

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

### [`wjs-polishing-x-engagement`](./wjs-polishing-x-engagement/)

把一条平淡的中文推文改写成"有真实事实支撑 + 带互动钩子"的高参与度版本，每次给 2–3 个钩子不同的候选。核心是两件事叠加：**一个真事实**（用 `web_search` 现查，绝不编造）+ **一个钩子**（留缺口让读者忍不住接话）。

- **风格铁律**：短、白、口语——能删的字全删，日常说话的调子，不煽情不堆形容词。
- **五种钩子**：历史规律外推（最强）/ 提问 / 填空 / 反常识 / 二选一站队。
- 每版末尾附事实来源，方便用户核实后再发。
- 有合适老照片或对比图时顺手用 `image_search` 找出来给用户。

> 触发词：`润色这条推` / `改写这条推文` / `让它更有互动` / `涨互动` / `帮我把这条发得更好` / `/wjs-polishing-x-engagement`

### [`wjs-cleaning-spam`](./wjs-cleaning-spam/)

清理挂在王建硕 X/Twitter 推文下的同城引流 spam 回复。X API 只允许串主 **隐藏回复**（访客不可见）和 **静音账号**（通知静音），block 端点已从 API 下线，拉黑只能网页手动。

- **三步走**：先 dry-run 输出 flagged + borderline 名单 → Claude 逐条审 borderline（区分真人评论和变体 spam）→ apply（隐藏 + 静音）
- **自动幂等**：`state/cleaned.jsonl` 记录已处理 id，重跑自动跳过；撞 429 限流（约 50 次/15 分钟）脚本自动停，等窗口刷新后续跑
- **只覆盖 7 天内**：X recent-search 接口上限；更早的 spam 需网页手动处理
- **block 做不到**：如需拉黑，提示用户到账号主页手动操作

> 触发词：`把这些spam删掉` / `清理X垃圾回复` / `推文下面好多引流号` / `clean spam replies` / `/wjs-cleaning-spam`

---

## 11. Hugo 博客 / Hugo Blog

### [`wjs-publishing-hugo`](./wjs-publishing-hugo/)

Hugo 博客的对话式后台。没有 CMS，没有 /admin 页面——说要发什么，Claude 就改 `content/`、放图、commit、push，走仓库现有部署流自动上线。先做前置检测（确认 `hugo.toml` 和现有帖子 front matter 格式），再动手，格式不漂。

- 新增帖子：`scripts/new-post.py`（生成标准 front matter，日期/URL/类目一次到位）
- 管理类目：`scripts/categories.sh` 列现有类目，防止造重复；批量改名/合并类目也支持
- 上传图片：`scripts/add-image.py`，新图进 `static/uploads/<年>/`，超 2000px 宽自动缩小
- 发布：`scripts/publish.sh` commit + push，触发 GitHub Actions 自动部署

> 触发词：`发一篇博客` / `给 Hugo 加文章` / `写篇帖子到博客` / `博客后台` / `/wjs-publishing-hugo`

### [`wjs-converting-wp-to-hugo`](./wjs-converting-wp-to-hugo/)

把任意 WordPress 站迁成 **Hugo + Markdown + git** 静态站，部署到 **GitHub Pages**。全程离线、零第三方依赖。

- **输入**：WordPress 后台导出的 WXR `.xml` + 站点 `wp-content/uploads/` 文件夹。
- **产出**：`content/*.md` + `static/wp-content/uploads/` + 手写极简主题，Hugo 构建，GitHub Actions 自动发布。
- **老链接 100% 不断**：全站 URL 保持 `/archives/<数字>/` 格式，SEO 和外部引用不受影响。
- **安全优先**：WXR 含密码文章正文和作者邮箱，`gitignore` 已根锚定，绝不进 git 历史。密码保护文章和脚手架页的处理方式必须由用户决定，不静默发布。
- **TDD 转换器**：`wxr_to_hugo.py` 是纯函数，`test_wxr.py` 先跑测试再全量转换；`verify_build.py` 断言每个老链接都命中。

> 触发词：`把 WordPress 迁成 Hugo` / `wordpress 转静态站` / `migrate WordPress to Hugo` / `WXR to Hugo` / `/wjs-converting-wp-to-hugo`

---

## 12. 网站反馈闭环 / Website Feedback Loop

### [`wjs-looping-feedback`](./wjs-looping-feedback/)

给任意网站装「提一句话就自动改代码」的反馈闭环。完全跑在仓库所有者自己的 GitHub Actions 上，用自己的 Pro/Max OAuth token 或 `ANTHROPIC_API_KEY`，无需任何第三方服务或后端。

工作流：访客点浮动「提个建议」按钮 → 填建议 → 变成 GitHub Issue（`feedback` 标签）→ allowlist 检查（只有白名单用户能触发）→ Claude Code 按 `.feedback/INSTRUCTIONS.md` 改网站 → 自动 commit 到 `main` → 触发部署上线 → `/_feedback` 仪表板记录每条建议的处理状态 + issue 回复 commit 链接。Revert：发一条 `revert: #N` issue 即可。

支持 Hugo / Next.js / Astro / 静态站。

> 触发词：`给网站加个反馈对话框` / `提一句话就自动改网站` / `装上反馈闭环` / `feedback loop` / `/wjs-looping-feedback`

---

## 13. iOS 持续集成 / iOS CI

### [`wjs-publishing-testflight`](./wjs-publishing-testflight/)

为任意 iOS 项目配置 **fastlane + GitHub Actions** CI/CD，基于 Cathier 项目的实战模板。

- 推送 `main` 分支 → GitHub Actions 在 `macos-15` (Xcode 26.2) 上自动构建
- 查询 App Store Connect 最新 build number、自动加 1，运行 `match`（只读）签名，导出 app-store IPA
- **TestFlight**：每次 push 都上传，打 `testflight/<build_num>` tag
- **自动提审规则**：每第 10 个 build（`build_num % 10 == 0`）自动 bump minor 版本并提审 App Store；或开发者手动改 `MARKETING_VERSION` 触发；CI 永不静默 commit pbxproj
- 三条 lane：`beta`（日常 CI）/ `bump`（本地版本升级）/ `release`（强制立即提审）
- 配套完整的 `Appfile` / `Matchfile` / `Fastfile` / `Gemfile` 模板和 `build.yml` workflow，只需全局替换三个占位符（bundle ID、repo 名、Xcode scheme）

> 触发词：`testflight` / `fastlane` / `自动构建` / `CI TestFlight` / `/wjs-publishing-testflight`

### [`wjs-publishing-appstore`](./wjs-publishing-appstore/)

`wjs-publishing-testflight` 的配套技能——接过 CI/CD 之后的那一步：把 TestFlight 上已有 build 的 iOS app 正式提交 App Store。

- **流程**：`scripts/scaffold-metadata.sh` 搭 `deliver` 元数据骨架（VoiceDrop 模板起步）→ `scripts/shoot.sh` 用 `simctl` 截图（iPhone 6.9" 为唯一必要尺寸，每 locale 一轮）→ `scripts/release_lane.rb` 粘入 Fastfile 加 `release` lane → `fastlane release` 提审。
- **全局唯一名陷阱**：App Store 的 `name` 字段全局唯一（显示名，非 bundle ID）——短常用名几乎必然被占，要加词或中文后缀；是可改的，不是永久锁死的。
- **首次提审前置清单**：年龄评级问卷（2025 年 Apple 新增了若干字段，fastlane 未覆盖，需在 ASC 网页完成）、定价（Free）、内容版权声明、App 隐私「营养标签」——四项在 ASC 网页控制台配置一次，之后不需要再动；提审失败时 Apple 会列出所有缺项，一并修好再重触发即可。
- **iOS 26 Simulator 已知坑**：麦克风权限弹框 `simctl privacy grant` 无法抑制（手动点一次 Allow，之后重跑截图脚本即是干净画面）；TabView 标签栏附近会出现 Liquid Glass 幻影（device only 没有，不必追查）。
- **稳妥两步发布**：`beta` lane 上传并等 Apple 处理完毕 → 再触发 `fastlane release skip_build:true` 复用已处理的 build，避免提审时 build 还在 processing 的竞争条件。

> 触发词：`提交 App Store` / `上架` / `app store 审核` / `准备截图和文案` / `submit for review` / `/wjs-publishing-appstore`

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
