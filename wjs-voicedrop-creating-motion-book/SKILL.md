---
name: wjs-voicedrop-creating-motion-book
description: Use when the user wants a whole book (usually a VoiceDrop 书架 book) turned into a chaptered explainer animation narrated by the book's own audiobook (书架「听本章」) — vertical 视频号 9:16 by default, art style auto-picked from the book's content, delivered as an in-browser HTML player and optionally MP4. Triggers — "把这本书做成动画", "做成艺术动画片", "读书动画", "听书配动画", "motion book", "/wjs-voicedrop-creating-motion-book <书名>".
---

# wjs-voicedrop-creating-motion-book：一本书 → 分章解说动画（口播＝书架听书）

底座是 **huashu-art-motion**（Canvas 逐帧画的引擎、风格配方、qa/deliver 门禁）。本 skill 加三样：整本书的分章流水线、**画风套件**（kits/，选过的画风做成库，下一本直接复用）、**公用组件**（scripts/*.mjs 与 player/，每本书不再重写）。开工前读一遍 huashu-art-motion 的 SKILL.md「导演的要求」和「六种做坏方式」。

**口播就是书架听书那一份整章朗读，不写新稿、不调 TTS。** 听书缓存（R2 `audiobook/<slug>/<stem>.mp3`）有就直接用；没有就经听书接口合成一次，它自己写回缓存，以后用户听书和再做动画都不再花钱。我们这边从不往听书缓存里写。片长＝全书朗读长度（一章 4–8 分钟）。

默认：竖屏 1080×1920@30（视频号 9:16）、**交付 HTML 版**；用户要 MP4 才渲（只在 Mac）。

## 流水线

`S=~/.claude/skills/wjs-voicedrop-creating-motion-book/scripts`，项目放 `~/code/art-films/<slug>/`。本 skill 的脚本全是 `.mjs`（Node ≥20）。取书、建工程、取口播、总装、冒烟、打包、发布不要 ffmpeg / Python / Chromium，Tokyo VPS 可跑；`qa_batches`、`framing_sheet`、`render_chunks` 是去调 huashu-art-motion 上游的 `render.py` / `qa.py`（要 uv + Chromium，MP4 拼接还要 ffmpeg），只在能出图的机器上跑。

| 步 | 做什么 | 命令 / 产物 | 在哪跑 |
|---|---|---|---|
| 1 取书 | VoiceDrop MCP `list_books` → `read_book`：slug、章名（写成一行一个的文件）、听书章节 stem（缺省 01…NN） | 章名.txt | 任意 |
| 2 选画风 | `references/选画风.md`：内容画像 → 先语法后画风 → 3 候选同句主镜头、独立评委 7 维打分；新画风先做成 `kits/<名>/` | `三方向/评审.md`、`选型结果.jpg`（发给用户，不等回复） | 出主镜头要 Chromium：VPS 上只按画像和 kits 的 fits/avoid 从已有套件里选 |
| 3 建工程 | 复制引擎、装套件和字体、写 book.json 与章节制作规范 | `node $S/new_book.mjs <项目> --slug … --title … --kit … --chapters 章名.txt` | 任意 |
| 4 取口播 | 听书 mp3（缓存优先）→ ASR → 稿＝ASR 文本 → 句时间 | `node $S/narrate.mjs <项目>` | 任意 |
| 5 分章制作 | 章节 agent 并行，每个 1–2 章，brief＝`<项目>/制作规范.md`＋章号；贯穿物先写进 `scenes/book/props.js` | `scenes/book/chNN.js`、`音频/chNN.shots.json`、`镜头表/chNN.md` | 自查静帧要 Chromium；VPS 上用 `node $S/smoke.mjs <项目> --film chNN` 查报错和框景 |
| 6 总装 | 音轨（帧级拼接＋静音帧）、段落表、字幕 | `node $S/assemble.mjs <项目>`（缺章先看：`--allow-missing`） | 任意 |
| 6½ 冒烟检查（必做） | 不出像素地跑完整本：启动错误、运行时报错、缺字形、框景（半截字/进字幕带/叠字，判据同 qa）；有错不交付 | `node $S/smoke.mjs <项目>` → `qa/smoke/`（一本 20 分钟约 15s，VPS 约 2 分钟、124MB） | 任意 |
| 7 审片 | 独立审片 agent 看 qa 拼图＋口播文本，打分列问题 → 回给对应章节 agent 改 | `审片/*.md` | Mac |
| 8 qa | 冒烟查不到的：画面好不好看、近空白、图形出画、确定性。分批跑、合并；框景线索出两帧拼图，两帧都切边的才改 | `node $S/qa_batches.mjs <项目> <项目>/qa/vN`；`node $S/framing_sheet.mjs <项目> <项目>/qa/vN` | Mac |
| 9 HTML 交付 | 打包公用播放器 | `node $S/build_html.mjs <项目>` → Mac 发 Artifact（`files` 用 `html/artifact_files.json`）；VPS 把 `html/` 整个目录传到静态站 | 任意 |
| 10 MP4（要才做） | 按章分段渲、可续跑、并发按空闲内存自动算（`-j` 可手动）；出片后自动 `add_cover.mjs` 加 1 秒书封片头＋MP4 封面元数据（`--no-cover` 跳过，已有封面不重复加）；要分章下载：`node $S/split_chapters.mjs <项目>` → `成片/分章/NN_章名.mp4`（复用分段画面＋切口播，不重渲；分章不加书封片头，`--cover` 才加）；deliver 门禁 | `node $S/render_chunks.mjs <项目> <项目>/成片/成片_vN.mp4`；`uv run ~/.claude/skills/huashu-art-motion/scripts/deliver.py <mp4> --project <项目>/代码工程 --qa <qa 目录> --root <项目> --vertical yes --out <项目>/output/` | Mac |

**顺序是硬的：步 4 先拿到听书 mp3，步 5 的画面全部按这份 mp3 的 ASR 句时间切镜。** 音频只有这一个来源；全流程唯一可能花 TTS 钱的地方是步 4 里听书缓存没命中的章（一章只一次，之后永久缓存）。

只改了几镜：改 `chNN.js` → 重跑步 9（HTML 不到 1 秒）；MP4 删掉 `成片_vN_chunks/chNN.mp4` 重跑步 10，其余章复用。

## 云端一次性机器（Tokyo VPS 上一条命令，做完销毁）

`bash cloud/run_book.sh <slug> [--only ch01,ch02,ch03]`（Tokyo VPS root）：Vultr 开一台 `vhp-8c-16gb-amd`（$0.132/时，东京）→ `cloud/cloud-init.sh` 装 Node 22 / uv / Chromium / Claude Code / 引擎 / 本 skill → 无人值守 `claude -p` 按本 skill 从取书做到 HTML → 拉回 `/root/motion-book/books/<slug>/` → `scripts/publish_video.mjs` 发到书架 **voicedrop.cn/books/<slug>/video/** → 销毁。退出必销毁（`--keep` 除外）；`cloud/reaper.sh` 每 30 分钟删掉开了超过 6 小时的 motion-book 机器。`--dry` 只验环境不派 Claude。

- 凭据只读不复制：Vultr key 与火山 ASR 在 `/root/motion-book/secrets.env`；Claude 用写书引擎 `/opt/claude-agent/.env` 的 `CLAUDE_CODE_OAUTH_TOKEN`（setup-token 长期令牌，不轮换，多机共用不互踢；但和写书引擎的 Claude 腿共用订阅额度）；书架发布用 `/opt/claude-agent/.config/voicedrop/credentials`。
- **无人值守（`claude -p`）时子 agent 只能前台并行**：同一条消息发多个 Agent 调用、等这批全部返回再派下一批；绝不用后台 agent、绝不「等通知」就结束回合——`-p` 一结束回合进程就退出，后台 agent 全被杀（2026-10-25 第一单 20 个 agent 做到一半全没了）。`run_book.sh` 的提示词已写死这条；Claude 退出却没做出网页版时，用 `claude -p --continue` 接着同一会话续跑，最多 3 轮；重开的机器会先把上一轮拉回的半成品传上去接着做。
- 云端没有 VoiceDrop MCP：取书用 `node $S/fetch_book.mjs <slug> 章名.txt`（读书架公开的 `_src/book.json`，要做的章没写完就退出，不开机）。
- Vultr API key 有 IP 白名单：Tokyo VPS 的 IPv4 要在控制台 Account → API → Access Control 里放行，curl 用 `-4`。
- **线上入口（像听书）**：任何人打开 `voicedrop.cn/books/<slug>/video/`，没做过就自动下单；lab 服务 `GET|POST https://lab.jianshuo.dev/api/video-book?slug=`（下单）/ `…/status?slug=`（只查）用 systemd-run 起 `video-<slug>` 单元跑 `run_book.sh`（`MB_ROOT=/opt/claude-agent/motion-book`）。闸：只做写完的书、同时最多 2 本、24 小时内最多开工 5 本（`/opt/claude-agent/.env` 的 `VIDEO_MAX_CONCURRENT` / `VIDEO_MAX_PER_DAY`，代码缺省 1 / 2；实现在 jianshuo.dev 仓库 `claude-agent/src/video-book.ts`）。书架已有 `video/` 时接口答 done，不会重做——要重做整本先删 R2 `books/<slug>/video/`。
- **书架标志**：`publish_video.mjs` 发布成功后往线上 `_src/book.json` 合并 `video: {url, publishedAt, duration, chapters}`（chapters 少于全书章数＝试看版）；写书的 build.mjs 每次整份发布会把它从线上接回来，修书不会抹掉。

## 省时间的关键

- **口播零成本复用**：听书缓存命中就不花 TTS 的钱；ASR 推 mp3 约 40 倍速，几章并发一两分钟完。
- **套件复用**：选画风时已有套件分差 ≤2 就用它。现有：`kurzgesagt`（科学/医学/技术机制）、`banknote`（货币/央行/金融制度，字体是随套件分发的思源宋体 OFL）。每做完一本新画风的书，把库收进 kits/。
- **默认 HTML**：长片渲 MP4 要几小时，HTML 打包不到 1 秒；画面一样，改一镜即时生效。
- **章节并行**：步 5 一次派齐；每章用章内局部时间，互不依赖，总装最后做。

## 交付回报

HTML 链接；听书缓存命中几章、新合成几章；（有 MP4 时）路径、时长、门禁结论和黄灯理由；选了哪个画风、为什么。坑先查 `references/踩坑.md`。

## 运行环境

- 全部：Node ≥20（20 会自动加 `--experimental-websocket`）、huashu-art-motion 引擎（`~/.claude/skills/huashu-art-motion/scripts/engine`，或 `HUASHU_ENGINE` 指向它；VPS 上 `git clone https://github.com/alchaincyf/huashu-art-motion`）、火山 ASR 凭据（环境变量，或 `~/code/.env`，或 `BOOK_ENV` 指向的文件）。
- Mac 另需：uv、ffmpeg、Playwright Chromium（huashu-art-motion 已装），只给 qa / 静帧 / MP4 用。渲染并发由 `render_chunks.mjs` 按空闲内存（每进程留 1.5GB、再留 4GB 余量）和核数自动算：16GB 机器约 2，64GB 的 pro 约 8。
