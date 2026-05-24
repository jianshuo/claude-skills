---
name: wjs-mining-articles
description: Use when the user has a video's SRT subtitle file — a 王建硕 monologue / 讲解, OR a 对谈 / 访谈 where 王建硕 is one of the speakers — and wants to mine it into multiple standalone 微信公众号 articles, one article per distinct topic. Triggers — "把这个视频写成文章", "从字幕里挖文章", "这个 SRT 能写几篇", "把对谈写成文章", "/wjs-mining-articles <srt>".
---

# wjs-mining-articles

一个视频的 SRT(独白或对谈)→ 一桌选题 → 用户勾几个(长对谈可「全要」)→ 每个长成一篇可发布的公众号文章,自动建好微信草稿,可选再排期发到 X。

## Core Principle

**口语是矿,文章是提炼出来的金属。** 一段王建硕的独白里通常讲了好几个各自独立、各自值得成文的点;每个点单独成一篇,比硬塞成一篇长文更符合公众号「800–1000 字、一篇一个核心」的节奏。

**字幕只是原料,成文要彻底书面化**——去掉「呃、那个、就是说、然后」这类口头碎屑,把口语逻辑理成书面段落;但**保留作者的用词偏好、家常比喻和语气**,绝不改成营销腔或书面八股。

## When This Skill Fires

- 用户给一个 SRT 路径,说「把这个视频写成文章」/「从字幕里挖文章」/「能写几篇」
- 用户跑 `/wjs-mining-articles <srt-path>`

支持两种源:**独白/讲解**(你一个人说)和**对谈/访谈**(你和别人对话)。两种走不同的识别路径(见 Step 1),但成文标准一致。

## When NOT to use

- **没有 SRT,只有视频/音频**——先用 `wjs-transcribing-audio` 出 SRT,再回来
- **对谈里王建硕根本没怎么说话**(纯主持、对方独角戏)——挖不出他第一人称的文章,别硬写
- **已有一篇成稿要发**——直接用 `wjs-publishing-wechat`

## Workflow

### Step 1 · 读 SRT,判断源类型,识别选题

脚本在本 skill 目录下,从 skill 根目录跑(或写全 `~/.claude/skills/wjs-mining-articles/scripts/parse-srt.sh`):

```bash
scripts/parse-srt.sh <srt-path>          # 句子合并、每块前缀 [起–止] 时间区间
scripts/parse-srt.sh <srt-path> --raw    # 一行一 cue: HH:MM:SS<TAB>text(需要细看时)
```

**先判断这是独白还是对谈。** SRT 没有说话人标记,从内容判断:有一问一答、现场寒暄/调设备、「你/我」互相称呼、有人反驳——就是**对谈**;从头到尾一个人连续讲就是**独白**。文件名/目录名带别人名字(如「汤维维」)是强信号。

**跳过非正片的口水段**:录制前的寒暄、调麦克风、「咱们聊啥」「这是播客还是视频」,以及中途「我去个洗手间」「换点水」这类——都不是内容,识别选题时直接略过(这次那条对谈开头约 5 分钟、中间几处都是这种)。

**ASR 人名几乎一定有错**:逐字稿里的人名先存疑,派 agent 写之前跟用户核对(这次「黄一孟」被听成「黄一梦」)。

**独白路径**:读输出全文,识别出 **N 个独立的、各自值得成文**的话题(典型 2–6 个)。每块前的 `[HH:MM:SS–HH:MM:SS]` 区间拿来标选题时间段——话题跨多块时取第一块起到最后一块止。**没有「几个才算独立」的死规则**:看作者是否真的换了一个能独立成文的点(他常自己数「第一个/第二个」,顺着切)。

**对谈路径**(多两步,顺序不能省):

1. **先确认谁是王建硕** ⟵ 不许猜,也**不许默认主讲人/说得最多的人就是王建硕**。把开头一段对话原样贴给用户,标出你推断的两个角色(谁在问、谁在答),用 `AskUserQuestion` 让用户确认哪一方是王建硕。用户没确认前,不进入识别选题。
2. **只挖王建硕真正展开了观点的话题**。对谈里的选题 = 王建硕给出了成段的、能独立成文的看法之处;对方纯提问、纯背景、纯附和的地方不算选题。读上下文判断每个点是谁说的——**拿不准某句是不是王建硕说的,就标「存疑」交给用户判,绝不替他认领**。
3. 选题清单照常出(Step 2),但每条额外标一句「这个点里王建硕的核心主张是 X」,方便用户判断值不值得写。

### Step 2 · 出选题清单,等用户勾选 ⟵ 唯一的人工闸

每个候选给三样:拟定标题 / 一句话梳理这个话题在讲什么 / 对应 SRT 时间段(如 `03:12–06:40`)。对谈每条再加一句「这个点里王建硕的核心主张是 X」。

**清单怎么呈现,按候选数分两种**:

- **≤4 篇**:用 `AskUserQuestion`(**`multiSelect: true`**),勾选框最干净。
- **>4 篇(长对谈常见,一场 1–2 小时能挖 10–16 篇)**:`AskUserQuestion` 一题最多 4 个选项,塞不下。改用**文字表格**(序号 | 标题 | 核心主张 | 时间段),按「多强 + 多像王建硕招牌观点」排序、标出 ⭐ 推荐,让用户**直接报序号**(「1 3 4」/「先写 ⭐ 那几篇」/「全要」)。

只有选中的进入 Step 3。用户说「全要」就全写。

### Step 3 · 每个选中话题写成 article.md + meta.json

写正文前载入 `wangjianshuo-perspective` 保证语气是本人。按 **`wjs-publishing-wechat` 的硬约束**写(那是单一事实源,这里只复述要点):

- 默认 **800–1000 字**,超 1200 回去再砍
- **红色加粗 `**...**` 2–4 处**,打在点睛句/关键结论/核心概念词。一处都没有 = 没写完
- **不加 AI 连接词**(首先/其次/综上所述/值得注意的是)、不加 emoji、不把口语强行八股化
- 默认不写 `## 后注`,正文最后落点收束

写完每篇 article.md 后,**跑一遍盘古之白**(中英文之间补空格,机械活、不靠自己记):

```bash
python3 ~/.claude/skills/wjs-publishing-wechat/scripts/pangu.py <folder>/article.md   # 幂等
```

**对谈成文额外规则(归属红线)**:文章是**王建硕第一人称**,主体是他的观点和思考。对方(如汤维维)的话**只作引子/背景**——「有人问我…」「聊到 X 的时候」——绝不把对方的独到观点写成王建硕自己的主张。对方提了一个王建硕没正面回应的点,就别写进这篇。`source.srt.md` 里要注明本篇基于对谈、对方是谁、引用了对方哪几句作引子。

**选中很多篇时(长对谈)用并行 agent 批量写**:每个 agent 载入 `wangjianshuo-perspective`、拿到对应的逐字稿行区间和上面全部硬约束,各写 2–3 篇,落 `article.md`+`meta.json`+`source.srt.md`。一条 1–2 小时的对谈一次写 10+ 篇,串行太慢,并行又快又互不干扰(每篇独立)。**派 agent 前先把全片通读一遍、把归属和事实更正都定下来**(比如这次「黄一孟」被 ASR 听成「黄一梦」,得在派单时就写明),否则每个 agent 各猜一遍容易出错。

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

**配图/建草稿是重活,长对谈十几篇要跑很久**:gen-cover / gen-illustration 都走 codex 出图,每篇约 1–3 分钟。串成一个后台批处理脚本一次跑完(逐篇记成功/失败、出错不影响其他篇),别一篇篇手动等。脚本里给 gen-cover / gen-illustration 加「图已存在就跳过」,这样中途失败重跑不浪费已生成的图。

### Step 5 · (可选)排期发到 X

用户要把这些文章也发成 tweet 时,交给 `wjs-tweeting-from-articles`:

- 发 1 条 → 它的默认流程(挑一篇、起 A/B/C 候选、用户选、`xurl` 发)。
- **一次要发很多篇**(长对谈挖出的十几篇)→ 它的**批量排期模式**:每篇抠一条 ≤120 字的 tweet 排进队列,`post-next-from-queue.sh` + 每小时 cron(脚本自己节流)按「每 N 小时一条」自动发,避免一次连发被 X 判刷屏。详见该 skill。

## 复用边界

| 复用 | 用法 |
|---|---|
| `wjs-publishing-wechat` 三个脚本 | 题图/解释图/建草稿,直接调,不重写 |
| `wjs-publishing-wechat` 字数/加粗/无 AI 味规则 | 单一事实源,本 skill 不另立标准 |
| `wjs-publishing-wechat/scripts/pangu.py` | 盘古之白,每篇 article.md 写完跑一遍 |
| `wangjianshuo-perspective` | 写正文时载入,保语气 |
| `wjs-tweeting-from-articles` | (可选)Step 5 把文章排期发到 X |

**本 skill 唯一新增代码**:`scripts/parse-srt.sh`。

## Common Mistakes

- **把多个话题硬塞成一篇长文** —— 违背「一篇一个核心」。识别出几个独立话题就出几个候选,让用户挑
- **照搬口语,留着「呃/然后/就是说」** —— 字幕是原料不是成稿,必须彻底书面化
- **忘了写 `meta.json`** —— 三个复用脚本全靠它,缺了题图和草稿都建不出来
- **忘了红色加粗** —— 一处都没有就是没写完
- **自动跑去群发** —— 本 skill 只建草稿,真正发布是用户的手动决定
- **对谈里默认「说得最多的就是王建硕」** —— 大错。必须让用户确认身份;说不定主讲人是嘉宾,王建硕才是提问的一方
- **把对方的观点写成王建硕的主张** —— 归属红线。对方的话只能作引子,拿不准是谁说的就标存疑
