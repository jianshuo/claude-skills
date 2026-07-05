---
name: wjs-voicedrop
description: VoiceDrop 账号的完整 API 工具箱——文章(list/read/write/版本/删除/边车/标签)、文风(读写/版本/语料偷师 collect/dataset/服务端蒸馏 extract/单篇重挖 restyle)、照片/音频(列出/上传/下载)、触发挖矿(mine)、算力余额与账单、公开分享链接、发公众号草稿、社区(分享/浏览/回复/举报)。认证用用户自己的 token 且自带登录：6+4 手机设备配对(本 skill 内置 vd-login.mjs，自己就能登录)、App 复制的 anon token，或 Apple 登录 session。别名："vd"、"voicedrop"、"口述" 都指这个 app（口述 = VoiceDrop 这款语音口述 app），用户提到这三个词中任意一个、且涉及录音/文章/文风/照片/挖矿/算力/社区等操作，都用本 skill。触发词："vd"、"voicedrop"、"口述"、"口述 app"、"voicedrop api"、"voicedrop 登录"、"列出 voicedrop 文章/照片/录音"、"读/写 voicedrop 文章"、"voicedrop 触发挖矿"、"voicedrop 算力余额"、"蒸馏文风"、"偷师"、"重新挖"、"voicedrop 社区"、"/wjs-voicedrop"。
---

# VoiceDrop API Skill

> **安装**：本 skill = 这个目录。把它放到 `~/.claude/skills/wjs-voicedrop/` 即装好——`git clone https://github.com/jianshuo/claude-skills` 后 `cp -R wjs-voicedrop ~/.claude/skills/`（或直接对 Claude Code 说「安装 https://github.com/jianshuo/claude-skills/tree/main/wjs-voicedrop」）。登录脚本 `vd-login.mjs` 需 Node ≥ 20。

VoiceDrop 后端的完整 HTTP 接口工具箱。所有资源（文章、文风、照片、音频）都能列出、读、写；还能触发挖矿、蒸馏文风、单篇重挖、查算力、发公众号、逛社区。**先认证拿 `$TOKEN`，再调任意接口。**

两个 base URL：

| 服务 | Base URL | 提供 |
|---|---|---|
| Files API（Cloudflare Pages） | `https://jianshuo.dev/files/api` | 文件/文章/文风(含语料)/照片/音频/分享/公众号/社区/Apple 登录 |
| Agent Worker（Durable Objects） | `https://jianshuo.dev/agent` | 挖矿触发、文风蒸馏、单篇重挖、算力余额/账单、语音编辑(WS)、库指令(WS)、设备配对 |

---

## 认证（用户 token，优先 6+4 设备配对）

所有接口都要 `Authorization: Bearer $TOKEN`，例外是几个公开端点：`GET /files/api/photo/*`（公开照片）、`GET /files/api/asset/wechat-covers/*`（公众号封面图库）、`GET /voicedrop/<id>`（分享页 HTML，`?s=<index>` 选第几节）。token 取用户自己的凭证：

```bash
# 6+4 手机设备配对登录（本 skill 自带的 vd-login.mjs 存下来的用户身份）
CRED=~/.config/voicedrop/credentials
TOKEN=$(python3 -c "import json;print(json.load(open('$CRED'))['token'])")
SCOPE=$(python3 -c "import json;print(json.load(open('$CRED'))['scope'])")   # users/anon-xxxx/
```

**取 token 的方式（都只能访问自己 scope 的数据）：**

| 方式 | token 形态 | scope（能看谁） | 怎么拿 |
|---|---|---|---|
| **6+4 设备配对** | `anon_…`（该用户的完整密钥） | 该用户自己 `users/anon-<hash>/` | 下面「自助登录」流程，凭证落 `~/.config/voicedrop/credentials` |
| **App 临时** | `anon_…` | 该用户自己 | App 设置 → 账户/访问令牌 → 复制 |
| **Apple 登录 session** | JWT（HS256，带 `apple` 标记） | 该用户自己 `users/<sub>/` | `POST /files/api/auth/apple`，body `{identityToken}`（App 内 Sign in with Apple 后端换发）→ `{session,scope}`。**写社区必须用这种** |
| **24h 只读 token** | 短期 token（`ro:true`） | 该用户自己，仅 `list`/`download` | `GET /files/api/token/articles` → `{token,url,expires_in:86400}`，用于把文章列表只读地交给外部工具；干别的一律 403 `read-only token` |

### 6+4 自助登录（本 skill 自带，无需别的 skill）

本目录自带 `vd-login.mjs`（零依赖，Node ≥ 20）——它扮演设备配对协议里的「新设备」，和手机（老设备）配一次对，把账号密钥**端到端加密**取到本地。**先查是否已登录**，没有再走两步握手：

```bash
VD=~/.claude/skills/wjs-voicedrop/vd-login.mjs
node "$VD" status        # 已登录 → {"ok":true,"scope":"users/anon-…/","live":true}；未登录 → ok:false
```

**前提**：用户手机在线、app 在前台、已登录目标账号、是支持设备配对的版本。

**两步握手（每条子命令只打印一行 JSON，按 `ok` 解析，别抓散文）：**

1. 问用户要 **6 位十六进制码**（手机 **设置 → 账户** 里那串短 ID）。
2. `node "$VD" start <6hex>`：
   - `{"ok":true,"pairingId":…,"matchCount":N}` → 告诉用户**手机这会儿会弹一个 4 位数字码**。
   - `{"ok":false,"error":"no_match"}` → 6 位码错了，或手机离线/后台/旧版本 → 回第 1 步。
3. 问用户要**手机上弹出的 4 位数字码**。
4. `node "$VD" finish <4digit>`：
   - `{"ok":true,"scope":"users/anon-…/"}` → 登录成功，凭证已写 `~/.config/voicedrop/credentials`（0600）。
   - `{"ok":false,"error":"wrong_code","remaining":N}` → 码输错了，问对的再重跑 `finish`（配对还活着，共 5 次 / 2 分钟）。
   - `{"ok":false,"error":"expired"|"too_many_attempts"|"timeout"|"cancelled"}` → 从第 1 步重来。

其它子命令：`node "$VD" logout`（删凭证）。

**安全须知（用户没听过就说一遍）**：这是把账号的**完整密钥**拷到磁盘，**不是**可吊销的子 token（VoiceDrop 的 anon 身份签不出子 token）。谁拿到 `~/.config/voicedrop/credentials` 就有该账号全部权限，且无法单独吊销这台机器。保持文件私有，**绝不**提交或同步到任何可读处。

| 登录报错 | 原因 / 处理 |
|---|---|
| `no_match` | 6 位码错，或手机离线/后台/旧版本 |
| `wrong_code` + `remaining` | 4 位码输错，用对的重跑 `finish`（5 次 / 2 分钟） |
| `timeout` | 手机没响应——把 app 切到前台，从 `start` 重来 |
| `cancelled` | 用户在手机上点了「不是我」 |
| `expired` | `start` 到 `finish` 超过 2 分钟，重跑 `start` |

**key 写法**：所有 key 都是相对自己 scope 的——文章 stem 直接写 `VoiceDrop-xxx`，文件名直接写 `photos/...`；服务端自动拼上你的 `users/anon-<hash>/` 前缀，越不出自己的数据。

---

## 全部接口速查

| 资源 | 操作 | 方法 + 路径 |
|---|---|---|
| **文章** | 列出 | `GET /files/api/articles` |
| | 读 | `GET /files/api/articles/<stem>` |
| | 写（版本化） | `PUT /files/api/articles/<stem>` |
| | 版本历史 | `GET /files/api/articles/<stem>/history` |
| | 切版本(撤销/重做) | `PATCH /files/api/articles/<stem>/head` |
| | 删除(连边车) | `DELETE /files/api/articles/<stem>` |
| | 写 SRT 边车 | `PUT /files/api/articles/<stem>/srt` |
| | 标记无语音 | `PUT /files/api/articles/<stem>/empty` |
| | 标记算力不足 | `PUT /files/api/articles/<stem>/blocked` |
| **文风** | 读 | `GET /files/api/style` |
| | 写（版本化） | `PUT /files/api/style` |
| | 版本历史 | `GET /files/api/style/history` |
| | 切版本(撤销/重做) | `PATCH /files/api/style/head` |
| **文风语料(偷师)** | 收一条样本 | `POST /files/api/style/collect` |
| | 语料清单 | `GET /files/api/style/dataset` |
| | 清空语料 | `DELETE /files/api/style/dataset` |
| **蒸馏/重挖** | 服务端蒸馏文风 | `POST /agent/style/extract` |
| | 单篇按某版文风重挖 | `POST /agent/restyle` |
| **照片** | 列出 | `GET /files/api/list`（筛 `photos/`） |
| | 上传 | `PUT /files/api/upload/photos/<sessionTs>/<offset>-<rand>.jpg` |
| | 下载(私有) | `GET /files/api/download/photos/<...>.jpg` |
| | 下载(公开) | `GET /files/api/photo/<完整 R2 key>`（无需 token） |
| **音频** | 列出 | `GET /files/api/list`（筛 `VoiceDrop-*.m4a`） |
| | 上传 | `PUT /files/api/upload/VoiceDrop-<...>.m4a`（自动触发挖矿） |
| | 下载 | `GET /files/api/download/VoiceDrop-<...>.m4a` |
| **挖矿** | 触发 | `POST /agent/mine/trigger`（推荐）或 `POST /files/api/mine` |
| **算力** | 余额 | `GET /agent/usage/balance` |
| | 账单流水 | `GET /agent/usage/ledger?limit=N` |
| **分享** | 生成公开链接 | `GET /files/api/share/articles/<stem>.json` |
| **公众号** | 发/更新草稿 | `POST /files/api/wechat/articles/<stem>.json` |
| | 封面图库(公开) | `GET /files/api/asset/wechat-covers/` |
| **社区** | 分享文章到社区 | `POST /files/api/community/share/articles/<stem>.json`（需 Apple 登录） |
| | 信息流 | `GET /files/api/community/list` |
| | 读一条(含全文/照片) | `GET /files/api/community/get/<shareId>` |
| | 回复列表 | `GET /files/api/community/replies/<shareId>` |
| | 某文章是否已分享 | `GET /files/api/community/shared/articles/<stem>.json` |
| | 撤下自己的分享 | `POST /files/api/community/unshare/<shareId>`（需 Apple 登录） |
| | 举报 | `POST /files/api/community/report/<shareId>` |
| **身份** | 我是谁 | `GET /files/api/whoami` |
| | Apple 登录换 session | `POST /files/api/auth/apple` |
| | 领 24h 只读 token | `GET /files/api/token/articles` |
| **通用文件** | 删除任意文件 | `DELETE /files/api/file/<name>` |
| **UI 配置** | 长按菜单配置 | `GET /agent/ui-config` |

---

## 文章 articles（版本化 CRUD）

**列出**（最新在前）：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles
# → {"articles":[{stem,title,head,createdAt,updatedAt,count,tags?}]}   count=节数, head=当前版本号
#   tags=标签数组（doc 顶层字段，语音 tag_article 工具写入，可 remove:true 删）；无标签时字段不出现
```

格式化展示：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles | python3 -c "
import json,sys; from datetime import datetime
for a in json.load(sys.stdin).get('articles',[]):
    dt=datetime.fromtimestamp(a['createdAt']/1000).strftime('%Y-%m-%d')
    print(f\"  [{dt}] {a['title']}  (stem={a['stem']}, {a['count']} 节, v{a['head']})\")"
```

**读全文**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles/<stem>
# → {transcript, srt, articles:[{title,body}], createdAt, updatedAt, status, model, ...}
#   body 是 Markdown 正文；[[photo:<relkey>]] 是内嵌照片标记
```

**写**（版本化——每次 PUT 追加一个新版本，head 前移）：

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"articles":[{"title":"新标题","body":"新正文..."}]}' \
  https://jianshuo.dev/files/api/articles/<stem>
# → {ok:true, head:<新版本号>}
```

**版本历史 / 切版本（撤销重做）**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles/<stem>/history
# → {head, versions:[...]}
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"head":2}' https://jianshuo.dev/files/api/articles/<stem>/head     # 只移指针，不新增版本
```

**删除**（连 `.srt/.empty/.blocked/.tags` 边车一起删，**不删音频**）：

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles/<stem>
```

边车写入：`PUT .../articles/<stem>/srt`（body=SRT 文本）、`/empty`（body `{"reason":"no-speech"}`）、`/blocked`（body `{"reason":"no-credit"}`）。

**标签 tags**：HTTP 侧只读——列表接口带出 `tags` 数组；写入没有专门端点，靠语音库指令（`/agent/command` WS 里的 `tag_article` 工具，可 `remove:true` 删）。要用 HTTP 改标签，只能 `PUT` 整篇文章 doc 时带上顶层 `tags` 字段。

---

## 文风（版本化 /style）

挖矿时这份文风会被叠加进 system prompt。存储已升级为**版本化的 `CLAUDE.json`**（schema-3，和文章同一套 history / undo / 回滚），统一走 `/files/api/style`——别再用旧的 `download/upload CLAUDE.md`。

> **名字暂留 `CLAUDE.md`**：`# 我的名字` 仍由旧 `CLAUDE.md` 保管（作者抽取路径读它）；写入只往 `CLAUDE.json` 写文风正文，不再碰名字。端点名字里仍叫 `CLAUDE.md` 只是历史包袱，实际读写的是 `CLAUDE.json`。

**读当前文风**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/style
# → {style, name, styles, head, createdAt, updatedAt, default?}
#   name=作者名；styles=App 里选中的预设风格编号数组(≤3)；default:true=还没存过、返回的是默认王建硕文风
# 还没存过 CLAUDE.json、只有旧 CLAUDE.md → {style, name, head:0, legacy:true}
#   legacy:true = 读的是旧 md 的「# 我的文风」段；首次 PUT 即落 CLAUDE.json、旧 md 退役
# 两者都没有 → 404
```

**写（版本化——每次 PUT 追加一个新版本，head 前移）**：

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"style":"单句成段，段落 1–3 句居多；多用具体数字……"}' \
  https://jianshuo.dev/files/api/style
# → {ok:true, head:<新版本号>}    空 style → 400 empty_content
#   body 可选带 "source":"agent"（默认用户 token 记为 app）
#   body 还可带 "name"（作者名）和 "styles"（≤3 个预设风格编号）——只改这两个（不带 style）是改 profile，不新增版本
```

**版本历史 / 回滚（撤销重做，只移 head 指针、不新增版本）**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/style/history
# → {head, versions:[{v, savedAt, source, style}]}    oldest-first，最多留 10 版
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"head":2}' https://jianshuo.dev/files/api/style/head      # 回滚到 v2
# → {ok:true, head:2}    版本号不存在 → 404
#   注意：回滚到旧版后再 PUT，会先截掉 head 之后的「未来」版本再追加新版（git HEAD 式）
```

---

## 照片 photos

没有专门的「列照片」接口——用通用 `GET /list` 筛 `photos/`：

```bash
# 列出本账号所有照片（最新在前，按 uploaded 真实时间）
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/list \
  | python3 -c "import json,sys
ph=[f for f in json.load(sys.stdin)['files'] if f['name'].startswith('photos/') or '/photos/' in f['name']]
ph.sort(key=lambda f:f.get('uploaded',''), reverse=True)   # R2 上传时间倒序=最新在前
[print(f.get('uploaded',''),f['name'],f['size']) for f in ph]"

# 下载（私有，scoped）
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://jianshuo.dev/files/api/download/photos/<sessionTs>/<offset>-<rand>.jpg" -o out.jpg

# 下载（公开，无需 token——任何展示面都走这个；key 必须是完整 R2 key）
curl -s "https://jianshuo.dev/files/api/photo/users/<sub>/photos/<sessionTs>/<offset>-<rand>.jpg" -o out.jpg

# 上传（≤1200px 方形 JPEG）
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg \
  "https://jianshuo.dev/files/api/upload/photos/<sessionTs>/<offset>-<rand>.jpg"
```

**命名约定**：`photos/<sessionTs>/<offset>-<rand>.jpg`。`sessionTs`=录音开始的 `yyyy-MM-dd-HHmmss`；`offset`=距录音起点的整数秒；`<rand>`=3 位 base36 防同秒撞 key。正文里引用照片用 `[[photo:photos/<sessionTs>/<offset>-<rand>.jpg]]`（token 就是相对 key）。

---

## 音频 audio（录音）

同样用通用 `GET /list` 筛 `VoiceDrop-*.m4a`：

> **顺序**：`/articles` 端点服务端就按 `createdAt` 倒序（最新在前）。`/list` 是通用接口**不排序**，返回 R2 原始字典序。**别按文件名排**——名字里的时间戳不是可靠时钟（时钟偏差、staging/改名、导入的文件都可能对不上）；要排就按 `uploaded`（R2 上传时间，ISO-8601 UTC 字符串，字典序==时间序）。下面的例子已按 `uploaded` 倒序，和 App「我的录音」一致。

```bash
# 列出所有录音（最新在前，按 uploaded 真实时间）
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/list \
  | python3 -c "import json,sys
recs=[f for f in json.load(sys.stdin)['files'] if f['name'].endswith('.m4a')]
recs.sort(key=lambda f:f.get('uploaded',''), reverse=True)   # R2 上传时间倒序=最新在前
[print(f.get('uploaded',''),f['name'],f['size']) for f in recs]"

# 下载
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://jianshuo.dev/files/api/download/VoiceDrop-2026-06-20-143052-...m4a" -o rec.m4a

# 上传（leaf 是 VoiceDrop-*.m4a → 自动触发挖矿）
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: audio/mp4" \
  --data-binary @rec.m4a \
  "https://jianshuo.dev/files/api/upload/VoiceDrop-<ts>-<dur>-<weekday>-<period>.m4a"
```

**命名约定**：`VoiceDrop-<ts>-<dur>-<weekday>-<period>[-<city>-<district>].m4a`（全 ASCII）。**处理状态**靠边车判断：`articles/<stem>.json` 存在=已成文；`.empty`=无语音；`.blocked`=算力不足/录音过长。

---

## 操作

**触发挖矿**（处理待处理录音）：

```bash
# 推荐：Worker 直连，任何有效 token 都行
curl -s -X POST -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/agent/mine/trigger
# → 由 Miner DO 返回（如 queued）
# 备用：Pages 转发
curl -s -X POST -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/mine   # → {ok:true}
```

完整挖矿语义（ASR→Claude→多文章）见 `/wjs-mining-voicedrop`。

**算力余额 + 账单**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/agent/usage/balance
# → {suanli, yuan, granted_suanli, spent_suanli}   （23 算力 = ¥1）
curl -s -H "Authorization: Bearer $TOKEN" "https://jianshuo.dev/agent/usage/ledger?limit=50"
# → {entries:[{ts(毫秒), kind:grant|spend, reason:signup|asr|mine|edit|campaign:*, suanli, balance_suanli, detail}]}
```

**生成公开分享链接 / 发公众号草稿**：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/share/articles/<stem>.json
# → {url:"https://jianshuo.dev/voicedrop/<id>"}
curl -s -X POST -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/wechat/articles/<stem>.json
# → {ok,created,updated} / 409 wechat_not_configured / 502 {errcode,errmsg}
```

---

## 工作流：distill —— 蒸馏文风并上传

从样本文章提炼可执行的「文风规则」，写进 `CLAUDE.md`，让 miner 自动带上。

1. `GET /articles` 列出 → 请用户选 **3–6 篇**（<3 篇提醒指纹不稳）。
2. 逐篇 `GET /articles/<stem>`，取 `articles[*].body`（不要 `transcript` 口述原文）。
3. 派子 agent 分析（隔离上下文）：「提炼这位作者**最突出、可执行**的语言习惯：句长偏好、段落密度、人称、词汇倾向、论证方式、结尾习惯、绝不做的事。**只分析怎么写，不分析思想立场。**输出 15–20 条 bullet，每条一句，用『用 X』『不用 Y』『X 必须在 Y 前』这种可执行语言。」
4. 回收润色：每条要能被不认识该作者的模型直接照做（「喜欢短句」太模糊；「单句成段，段落 1–3 句居多」才够用）。去掉与服务器 SYSTEM prompt 重复的。
5. 组装文风正文，**预览给用户确认后**用上面的 `PUT /files/api/style`（JSON body `{"style":"…"}`）上传；落为新版本，随时可 `PATCH /style/head` 回滚。（名字不在这里写——它仍留在旧 `CLAUDE.md`。）
6. 成功 → 告知「下次录音挖文章时自动生效」。

---

## 实时接口（WebSocket，了解即可，curl 调不动）

- `wss://jianshuo.dev/agent/edit?stem=<stem>` — 语音编辑某篇文章（App 持麦克风串行发指令）。
- `wss://jianshuo.dev/agent/status` — 实时挖矿状态推送（待处理→听录音→挖文章→已成文）。
- `wss://jianshuo.dev/agent/asr` — 火山流式 ASR 代理（语音听写）。
- `/agent/link/*` — 设备配对（6+4）协议端点，由本 skill 自带的 `vd-login.mjs` 封装（见上面「6+4 自助登录」）。

---

## 常见错误

| 错误 | 修正 |
|---|---|
| `401 unauthorized` | token 没设/过期 → 重走上面「6+4 自助登录」，或 App 设置重新复制 |
| `403 forbidden` / `read-only token` | 用户 token 只能动自己 scope；写社区（share）需 Apple 登录过的 session；24h 临时 token 只能 list/download |
| `articles` 返回空数组 | 还没成文 → 触发挖矿或等 miner |
| `404 not found`（文章） | stem 写错 |
| `409 wechat_not_configured` | 该用户没配公众号 appid/secret（App 设置里填） |
| 照片 `400 not a photo` | `/photo/` 公开接口的 key 必须匹配 `users/<id>/photos/*.(jpg|jpeg|png)` |
| 上传文风后 App 没变 | 切离再切回「设置」tab 重新加载 |
