---
name: wjs-mining-voicedrop
description: Use when 王建硕 wants to turn his uploaded VoiceDrop voice memos into 微信公众号 article drafts — pulling the unprocessed recordings sitting on jianshuo.dev/files (the R2 inbox), transcribing them, and mining articles from each. Triggers — "处理 VoiceDrop 录音", "把新录音挖成文章", "口述备忘变文章", "处理一下我的录音", "/wjs-mining-voicedrop".
---

# wjs-mining-voicedrop

VoiceDrop 收件箱（`jianshuo.dev/files` 上的 `VoiceDrop-*.m4a`）→ 逐条转写 → 交给 `wjs-mining-articles` 出公众号草稿。这是 VoiceDrop iOS app（开口即录、停即上传）的 Mac 端闭环。

**本 skill 自身的产出 = ① 公众号草稿（`~/code/wechat-publish/`）+ ② 本地音频/SRT 存档（`~/code/voicedrop/archive/`）+ ③ R2 上的处理标记（`articles/<stem>.json` 或 `.empty`）+ ④ 一份批次报告（处理几条、各出几篇、哪些标了无语音及原因、还剩几条未处理）。** 完整接口契约见 `agents/interface.yaml`。

## Core Principle

**复用，不重写。** 本 skill 只做两件本身没有的事：**收件箱的进出**（列/下载/标记）和**逐条编排**。转写交 `wjs-transcribing-audio`，成文交 `wjs-mining-articles`，一行都不重写。

**R2 永不删，用标记文件表示处理状态。** 音频一直留在 R2，直到用户自己在 app 里删。「未处理」= 还没有 `articles/<stem>.json`（已成文）也没有 `articles/<stem>.empty`（无语音）标记的 `VoiceDrop-*.m4a`；`list` 已自动只列未处理的。一条**成功**成文后写 `mark-done`，**没语音/损坏**写 `mark-empty`——两者都让这条不再被重复处理。**绝不 delete**（delete 只留给用户在 app 里手动清理）。

## When This Skill Fires

- 用户说「处理 VoiceDrop 录音」「把新录音挖成文章」「处理一下我的口述」
- 用户跑 `/wjs-mining-voicedrop`

## When NOT to use

- **已经有 SRT** → 直接 `wjs-mining-articles`
- **音频不在 R2 收件箱**（本地散文件）→ 直接 `wjs-transcribing-audio` 出 SRT，再 `wjs-mining-articles`
- **桶里是别的机器传的非录音文件** → 本 skill 只认 `VoiceDrop-*.m4a` 前缀，其余不碰

## 前置

- `~/code/.env` 里有 `FILES_TOKEN`（收件箱鉴权）和火山 ASR creds（`VOLC_ASR_*` / `VOLC_TTS_*`，转写用）。`set -a; source ~/code/.env; set +a`。

## Workflow

唯一的新增代码：`scripts/voicedrop-inbox.sh`（`list` / `download` / `mark-done` / `mark-empty` / `delete`，token 运行时从 `~/code/.env` 读，绝不落代码）。`list` 只列未处理；`mark-done`/`mark-empty` 写处理标记；`delete` 只给手动清理用，成文流程不调它。

### Step 0 · 定位脚本 + 载入环境（不依赖当前目录）

```bash
INBOX=~/.claude/skills/wjs-mining-voicedrop/scripts/voicedrop-inbox.sh
set -a; source ~/code/.env; set +a    # FILES_TOKEN + 火山 ASR creds
```

用绝对路径 `$INBOX` 调脚本——**不要**写成 `scripts/voicedrop-inbox.sh`，那依赖「人恰好在 skill 根目录」这个隐藏假设，换目录就崩。

### Step 1 · 列收件箱

```bash
"$INBOX" list      # 打印未处理的 VoiceDrop-*.m4a，一行一个
```

- 命令**非零退出**（网络不通 / token 失效）→ 报「收件箱连不上或 FILES_TOKEN 失效，检查 `~/code/.env`」并停，**不进入循环**。
- 输出为空 → 报「收件箱没有新录音」结束。
- 非空 → 拿到这一批文件名。

### Step 2 · 逐条闭环（串行，一条跑完再下一条）

**串行**。**批次韧性：单条任何一步失败 → 记录原因、跳到下一条、绝不中止整批、绝不漏标。** 每条录音最终必须落到三个终态之一：**已成文（mark-done）/ 无语音（mark-empty）/ 失败（不标，留待下次）**——绝不「处理了却什么都没标」。对每个 `<name>`：

1. **下载存档**：
   ```bash
   "$INBOX" download <name> ~/code/voicedrop/archive
   ```
   音频落 `~/code/voicedrop/archive/<name>`。R2 上的原件始终保留，本地这份只是离线副本。
2. **快速看一眼是不是真录音**：
   ```bash
   dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio" 2>/dev/null)
   ```
   `dur` 为空（非音频/损坏）→ `"$INBOX" mark-empty <name> corrupt`；`< 1.0` 秒（误传/静音）→ `"$INBOX" mark-empty <name> silent`。标完报告用户，**跳到下一条**——这条已是终态，不再重复处理。
3. **转写** → SRT：载入 **`wjs-transcribing-audio`**（中文走火山豆包 `volc_asr_stream.py` + `build_srt_from_asr.py` + 在 session 内做 AI 润色改错别字）。SRT 落 `~/code/voicedrop/archive/<stem>.srt`。
   - **转写出来是空的**（有声音但 ASR 一字未出，多是环境音）→ `"$INBOX" mark-empty <name> no-speech`，报告、跳下一条。
4. **挖文章**：把这个 SRT 交给 **`wjs-mining-articles`** 跑它的完整流程——出选题清单（**它的人工闸，照走别跳**）、成文、建微信草稿。语音备忘多是短独白单主题，清单常只有 1 条，照常让用户确认。
5. **成文成功后写处理标记**（出了至少一篇草稿、用户没中止）：把这一条挖出的文章拼成 v2 JSON（`{"schema":2,"status":"ready","sourceAudio":"<name>","articles":[{"title","body"},…]}`，可含 `transcript`/`srt`）写到临时文件，再：
   ```bash
   "$INBOX" mark-done <name> /tmp/<stem>.json
   ```
   这条就标成已成文、app 里也能看到，且不会被服务器或下次再挖。
   转写失败 / 用户没勾任何选题 / 挖不出文章 → **不标 done 也不标 empty**，留未处理，下次再来，报告原因。

### Step 3 · 汇报

处理了几条、各挖出几篇草稿（落在 `~/code/wechat-publish/`）、哪些标了无语音及原因（corrupt/silent/no-speech）、本地存档路径、R2 还剩几条未处理。

## 标记安全红线

```
download(存档) → 判别 → 成文 ? mark-done : 无语音 ? mark-empty : 留着不标
                                                     ↑ 绝不 delete
```

- **绝不 delete。** 音频永远留在 R2，删除只属于用户在 app 里的手动操作。
- **每条都有终态。** 成文 → `mark-done`；损坏/静音/无语音 → `mark-empty`（带 reason）；真失败（转写报错、用户中止、没挖出文章）→ 不标，留未处理下次再试。**绝不出现「跑过一遍却没留任何标记」**——那会让这条每次都被重新处理。

## 复用边界

| 复用 | 用法 |
|---|---|
| `wjs-transcribing-audio` | 每条音频 → SRT（中文火山豆包，含润色改错别字） |
| `wjs-mining-articles` | 每个 SRT → 选题清单 → 成文 → 微信草稿（含它自己的人工闸） |
| `~/code/.env` | `FILES_TOKEN` + 火山 ASR creds |
| VoiceDrop app | 上游：文件名形如 `VoiceDrop-<时间戳>-<时长>-<星期>-<时段>[-<城市-城区>].m4a`（全 ASCII）。本 skill 靠 `VoiceDrop-` 前缀 + `.m4a` 后缀认领；中间的时长/星期/时段/地点是上下文，成文时可借来判断这条录音是何时何地的口述 |
| 服务器 miner（`~/code/voicedrop/mining/mine.py`，每 2h） | 同一套标记约定：成文写 `articles/<stem>.json`、无语音写 `articles/<stem>.empty`、永不删音频。它会自动处理收件箱，所以本 skill 跑时 `list` 常常已经空了——这是预期，本 skill 是手动补位 |

**本 skill 唯一新增代码**：`scripts/voicedrop-inbox.sh`。

## Common Mistakes

- **delete 音频** —— 红线。成文流程永不 delete，只 `mark-done`/`mark-empty`；delete 仅用户在 app 里手动用。
- **跑过一条却不标记** —— 无语音/损坏的也要 `mark-empty`，否则它每次都被重新下载转写，永远「待处理」。
- **转写失败/用户没勾选也硬标 done** —— 真失败就留未处理（不标），下次再试；只有出了草稿才 `mark-done`。
- **跳过 `wjs-mining-articles` 的选题闸自己硬写** —— 那个闸是它的设计，照走。
- **把桶里非 VoiceDrop 文件也当源** —— 只认 `VoiceDrop-*.m4a` 前缀；`list` 也只列未处理的。
- **误传/0 秒/环境音当真录音反复试** —— 先 ffprobe 看时长，空/损坏/<1s 直接 `mark-empty`，别送去转写。
