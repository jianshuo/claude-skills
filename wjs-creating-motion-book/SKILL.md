---
name: wjs-creating-motion-book
description: Use when the user wants a whole book (usually a VoiceDrop 书架 book) turned into a narrated, chaptered explainer animation — vertical 视频号 9:16 by default, art style auto-picked from the book's content, delivered as an in-browser HTML player and optionally MP4. Triggers — "把这本书做成动画", "做成艺术动画片", "20分钟的动画版", "读书动画", "motion book", "/wjs-creating-motion-book <书名>".
---

# wjs-creating-motion-book：一本书 → 分章解说动画

底座是 **huashu-art-motion**（Canvas 逐帧画的引擎、风格配方、qa/deliver 门禁）。本 skill 只加三样东西：整本书的分章流水线、**画风套件**（kits/，选过的画风做成库，下一本直接复用）、**公用组件**（scripts/ 与 player/，每本书不再重写）。开工前读一遍 huashu-art-motion 的 SKILL.md「导演的要求」和「六种做坏方式」。

默认：竖屏 1080×1920@30（视频号 9:16）、豆包 seed-tts-2.0 口播（`zh_female_vv_uranus_bigtts`）、约 20 分钟（开场＋每章约 110 秒）、**交付 HTML 版**；用户要 MP4 才渲。

## 流水线

`S=~/.claude/skills/wjs-creating-motion-book/scripts`，项目放 `~/code/art-films/<slug>/`。

| 步 | 做什么 | 命令 / 产物 |
|---|---|---|
| 1 取书写稿 | VoiceDrop MCP 读书；按 `references/写稿.md` 写 ch00 开场＋每章一段；**独立子 agent 核事实** | `稿/chNN.txt`、`稿/README.md`（画像、贯穿物、事实修正表）、章名文件 |
| 2 选画风 | 按 `references/选画风.md`：先语法后画风，3 候选同句主镜头，独立评委 7 维打分；新画风先做成 `kits/<名>/` | `三方向/评审.md`、`选型结果.jpg`（发给用户，不等回复） |
| 3 建工程 | 复制引擎、装套件、抽本机字体、写 book.json 和章节制作规范 | `python3 $S/new_book.py <项目> --slug … --title … --kit … --chapters 章名.txt` |
| 4 配音 | TTS→ASR→按字对齐，并发 3 章，只重做改过的章 | `python3 $S/narrate.py <项目>` → `音频/chNN.mp3`、`chNN.句时间.txt` |
| 5 分章制作 | 派章节 agent 并行，每个 1–2 章，brief = `<项目>/制作规范.md`＋章号；本书贯穿物先写进 `scenes/book/props.js` | `scenes/book/chNN.js`、`音频/chNN.shots.json`、`镜头表/chNN.md` |
| 6 总装 | 音轨、段落表、字幕 | `python3 $S/assemble.py <项目>`（缺章先看：`--allow-missing`） |
| 7 审片 | 一个独立审片 agent 看 qa 拼图＋稿子，打分列问题（画面、事实、字幕）→ 回给对应章节 agent 改；改了稿的章重跑步 4 | `审片/*.md` |
| 8 qa | 分批跑、合并；框景线索逐条看两帧拼图，两帧都切边的才改 | `python3 $S/qa_batches.py <项目> <项目>/qa/vN`；`python3 $S/framing_sheet.py <项目> <项目>/qa/vN` |
| 9 HTML 交付 | 打包公用播放器 → Artifact 发布（`files` 用 `html/artifact_files.json`） | `python3 $S/build_html.py <项目>` |
| 10 MP4（要才做） | 按章分段渲、可续跑、≤2 进程；然后 deliver 门禁 | `python3 $S/render_chunks.py <项目> <项目>/成片/成片_vN.mp4`；`uv run ~/.claude/skills/huashu-art-motion/scripts/deliver.py <mp4> --project <项目>/代码工程 --qa <qa 目录> --root <项目> --vertical yes --out <项目>/output/` |

只改了几镜：改 `chNN.js` → 重跑步 9（HTML 几秒）；MP4 删掉 `成片_vN_chunks/chNN.mp4` 重跑步 10，其余章直接复用。

## 省时间的关键

- **套件复用**：选画风时已有套件分差 ≤2 就用它，省掉建库与画风试错。现有套件：`kurzgesagt`（科学/医学/技术机制）、`banknote`（货币/央行/金融制度）。每做完一本新画风的书，把库收进 kits/。
- **ASR 在配音时一次做完**：章节 agent 拿到的句时间已经准，不再有返工定时那一轮。
- **默认 HTML**：20 分钟片渲 MP4 要 1–2 小时，HTML 打包几十秒；画面一样，改一镜即时生效。
- **章节并行**：步 5 一次派齐；每章互不依赖（章内局部时间），总装最后做。

## 交付回报

HTML 链接；（有 MP4 时）路径、时长、门禁结论和黄灯理由；事实修正几处；选了哪个画风、为什么。坑先查 `references/踩坑.md`。

## 运行环境

本机 Mac：Python 3 + uv、ffmpeg、Playwright Chromium（huashu-art-motion 已装）、`~/code/volcano-tts/tts.py` 与 `~/code/.env` 里的火山凭据、wjs-transcribing-audio 的 `volc_asr_stream.py`。渲染与 qa 吃内存，16GB 机器同时最多 2 个渲染进程。
