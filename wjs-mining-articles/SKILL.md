---
name: wjs-mining-articles
description: Use when the user has a video's SRT subtitle file (a 王建硕 monologue / 讲解, not a multi-person interview) and wants to mine it into multiple standalone 微信公众号 articles — one article per distinct topic the video covers. Triggers — "把这个视频写成文章", "从字幕里挖文章", "这个 SRT 能写几篇", "/wjs-mining-articles <srt>".
---

# wjs-mining-articles

一个独白视频的 SRT → 一桌选题 → 用户勾几个 → 每个长成一篇可发布的公众号文章,自动建好微信草稿。

## Core Principle

**口语是矿,文章是提炼出来的金属。** 一段王建硕的独白里通常讲了好几个各自独立、各自值得成文的点;每个点单独成一篇,比硬塞成一篇长文更符合公众号「800–1000 字、一篇一个核心」的节奏。

**字幕只是原料,成文要彻底书面化**——去掉「呃、那个、就是说、然后」这类口头碎屑,把口语逻辑理成书面段落;但**保留作者的用词偏好、家常比喻和语气**,绝不改成营销腔或书面八股。

## When This Skill Fires

- 用户给一个 SRT 路径,说「把这个视频写成文章」/「从字幕里挖文章」/「能写几篇」
- 用户跑 `/wjs-mining-articles <srt-path>`

## When NOT to use

- **没有 SRT,只有视频/音频**——先用 `wjs-transcribing-audio` 出 SRT,再回来
- **多人对谈/嘉宾访谈**——本 skill v1 只服务独白。对谈要从多人对话抽观点再用第一人称重写,暂不支持
- **已有一篇成稿要发**——直接用 `wjs-publishing-wechat`

## Workflow

### Step 1 · 读 SRT,识别选题

脚本在本 skill 目录下,从 skill 根目录跑(或写全 `~/.claude/skills/wjs-mining-articles/scripts/parse-srt.sh`):

```bash
scripts/parse-srt.sh <srt-path>          # 句子合并、每块前缀 [起–止] 时间区间
scripts/parse-srt.sh <srt-path> --raw    # 一行一 cue: HH:MM:SS<TAB>text(需要细看时)
```

读输出全文,识别出 **N 个独立的、各自值得成文**的话题(典型 2–6 个)。每块前的 `[HH:MM:SS–HH:MM:SS]` 区间直接拿来标选题的 SRT 时间段——一个话题跨多块时,取第一块的起到最后一块的止。**没有「几个才算独立」的死规则**:看作者是否真的换了一个能独立成文的点(他常会自己数「第一个/第二个」,顺着他的切分走)。

### Step 2 · 出选题清单,等用户勾选 ⟵ 唯一的人工闸

用 `AskUserQuestion`(**`multiSelect: true`**)列出每个候选:

- 拟定标题
- 一句话梳理这个话题在讲什么
- 对应 SRT 时间段(如 `03:12–06:40`)

只有勾中的进入 Step 3。

### Step 3 · 每个选中话题写成 article.md + meta.json

写正文前载入 `wangjianshuo-perspective` 保证语气是本人。按 **`wjs-publishing-wechat` 的硬约束**写(那是单一事实源,这里只复述要点):

- 默认 **800–1000 字**,超 1200 回去再砍
- **红色加粗 `**...**` 2–4 处**,打在点睛句/关键结论/核心概念词。一处都没有 = 没写完
- **不加 AI 连接词**(首先/其次/综上所述/值得注意的是)、不加 emoji、不把口语强行八股化
- 默认不写 `## 后注`,正文最后落点收束

每篇落到一个**新文件夹** `<workspace>/articles/YYYY-MM-DD-{slug}/`,写两个文件:

| 文件 | 内容 |
|---|---|
| `article.md` | 正文 |
| `meta.json` | `{ "title", "summary", "author": "王建硕", "date", "slug" }` — 三个复用脚本都靠它 |
| `source.srt.md` | 原料备份:SRT 来源路径 + 本篇对应时间段 + 抽出的原始口语片段(可追溯) |

`<workspace>` 默认 `~/Library/Mobile Documents/com~apple~CloudDocs/my/我的项目/我的创作/wechat-publish/`,与 publishing 一致。

### Step 4 · 直接建草稿(全自动)

对每个选中文件夹依次调 publishing 的**现成脚本**(不重写),路径 `~/.claude/skills/wjs-publishing-wechat/scripts/`:

```bash
gen-cover-ai.sh   <folder>   # 题图 cover.png(读 meta.json 的 title 当目标字词)
gen-illustration.sh <folder> # 解释图 illustration.png + 确保 article.md 引用 ![](./illustration.png)
upload-draft.sh   <folder>   # 上传到微信后台建草稿(只建草稿,不群发)
```

交付:每篇都是「微信后台已有草稿、可一键发布」状态。**群发由用户在后台手动点**——本 skill 到草稿为止。

## 复用边界

| 复用 | 用法 |
|---|---|
| `wjs-publishing-wechat` 三个脚本 | 题图/解释图/建草稿,直接调,不重写 |
| `wjs-publishing-wechat` 字数/加粗/无 AI 味规则 | 单一事实源,本 skill 不另立标准 |
| `wangjianshuo-perspective` | 写正文时载入,保语气 |

**本 skill 唯一新增代码**:`scripts/parse-srt.sh`。

## Common Mistakes

- **把多个话题硬塞成一篇长文** —— 违背「一篇一个核心」。识别出几个独立话题就出几个候选,让用户挑
- **照搬口语,留着「呃/然后/就是说」** —— 字幕是原料不是成稿,必须彻底书面化
- **忘了写 `meta.json`** —— 三个复用脚本全靠它,缺了题图和草稿都建不出来
- **忘了红色加粗** —— 一处都没有就是没写完
- **自动跑去群发** —— 本 skill 只建草稿,真正发布是用户的手动决定
