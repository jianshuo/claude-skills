---
name: wjs-mining-voicedrop
description: Use when 王建硕 wants to turn his uploaded VoiceDrop voice memos into 微信公众号 article drafts — pulling the unprocessed recordings sitting on jianshuo.dev/files (the R2 inbox), transcribing them, and mining articles from each. Triggers — "处理 VoiceDrop 录音", "把新录音挖成文章", "口述备忘变文章", "处理一下我的录音", "/wjs-mining-voicedrop".
---

# wjs-mining-voicedrop

VoiceDrop 收件箱（`jianshuo.dev/files` 上的 `VoiceDrop-*.m4a`）→ 逐条转写 → 交给 `wjs-mining-articles` 出公众号草稿。这是 VoiceDrop iOS app（开口即录、停即上传）的 Mac 端闭环。

## Core Principle

**复用，不重写。** 本 skill 只做两件本身没有的事：**收件箱的进出**（列/下载/删）和**逐条编排**。转写交 `wjs-transcribing-audio`，成文交 `wjs-mining-articles`，一行都不重写。

**R2 当收件箱。** 「未处理」= 桶里现有的所有 `VoiceDrop-*.m4a`。一条**成功**跑完文章后，音频已存档到本地，再从 R2 删——桶里永远只剩还没处理的。**没成功就不删**，留着下次再来。

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

唯一的新增代码：`scripts/voicedrop-inbox.sh`（`list` / `download` / `delete`，token 运行时从 `~/code/.env` 读，绝不落代码）。从 skill 根目录跑。

### Step 1 · 列收件箱

```bash
scripts/voicedrop-inbox.sh list      # 打印未处理的 VoiceDrop-*.m4a，一行一个
```

空 → 报「收件箱没有新录音」结束。非空 → 拿到这一批文件名。

### Step 2 · 逐条闭环（串行，一条跑完再下一条）

**串行**，因为删除安全依赖「这一条彻底成功」。对每个 `<name>`：

1. **先下载存档**（绝不先删 R2）：
   ```bash
   scripts/voicedrop-inbox.sh download <name> ~/code/voicedrop/archive
   ```
   音频落 `~/code/voicedrop/archive/<name>`。**这一步就是存档**——之后即使删了 R2，本地也有。
2. **快速看一眼是不是真录音**：`ffprobe` 查时长。≈0 秒 / 几字节的误传/测试文件 → 跳过、向用户报告，**不删**（让用户自己决定清不清）。
3. **转写** → SRT：载入 **`wjs-transcribing-audio`**（中文走火山豆包 `volc_asr_stream.py` + `build_srt_from_asr.py` + 在 session 内做 AI 润色改错别字）。SRT 落 `~/code/voicedrop/archive/<stem>.srt`。
4. **挖文章**：把这个 SRT 交给 **`wjs-mining-articles`** 跑它的完整流程——出选题清单（**它的人工闸，照走别跳**）、成文、建微信草稿。语音备忘多是短独白单主题，清单常只有 1 条，照常让用户确认。
5. **只有上面都成功**（出了至少一篇草稿、用户没中止）**才删 R2**：
   ```bash
   scripts/voicedrop-inbox.sh delete <name>
   ```
   转写失败 / 用户没勾任何选题 / 挖不出文章 → **不删**，留收件箱，报告原因。

### Step 3 · 汇报

处理了几条、各挖出几篇草稿（落在 `~/code/wechat-publish/`）、本地存档路径、R2 收件箱现在还剩几条。

## 删除安全红线

```
download(存档) → transcribe → mine → 出了草稿 → 才 delete
```

任何一步失败、用户没勾选、没产出草稿 → **不 delete**。删除是「这一条彻底处理完」的最后一步，不是中途动作。先存档后删，音频永不丢。

## 复用边界

| 复用 | 用法 |
|---|---|
| `wjs-transcribing-audio` | 每条音频 → SRT（中文火山豆包，含润色改错别字） |
| `wjs-mining-articles` | 每个 SRT → 选题清单 → 成文 → 微信草稿（含它自己的人工闸） |
| `~/code/.env` | `FILES_TOKEN` + 火山 ASR creds |
| VoiceDrop app | 上游：文件名形如 `VoiceDrop-<时间戳>-<时长>-<星期>-<时段>[-<城市-城区>].m4a`（全 ASCII）。本 skill 靠 `VoiceDrop-` 前缀 + `.m4a` 后缀认领；中间的时长/星期/时段/地点是上下文，成文时可借来判断这条录音是何时何地的口述 |

**本 skill 唯一新增代码**：`scripts/voicedrop-inbox.sh`。

## Common Mistakes

- **先删 R2 再处理** —— 红线倒置。必须先 download 存档、彻底成功后才 delete。
- **转写失败/没成文却把文件删了** —— 永久丢录音。没产出草稿绝不 delete。
- **跳过 `wjs-mining-articles` 的选题闸自己硬写** —— 那个闸是它的设计，照走。
- **并行处理多条还各自删** —— 串行逐条闭环，避免中途失败时收件箱状态混乱。
- **把桶里非 VoiceDrop 文件也当源** —— 只认 `VoiceDrop-*.m4a` 前缀。
- **误传/0 秒测试文件当真录音去转写** —— 先 ffprobe 看时长，可疑的报给用户、不删。
