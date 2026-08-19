---
name: wjs-voicedrop
description: VoiceDrop 的入口。所有能力都在 MCP 里（voicedrop.cn/mcp，44 个工具：文章读写与版本、文风与蒸馏、挖矿与重写、社区与投币、算力、分享/公众号/小红书、书架读书与写书修书）。本 skill 只做一件事——把你接上那个 MCP：用它的 login 工具做 6+4 手机配对登录拿到令牌，然后接进客户端。触发词："voicedrop"、"登录 voicedrop"、"voicedrop 登录"、"接 voicedrop mcp"、"voicedrop token"、"/wjs-voicedrop"。
---

# VoiceDrop

**VoiceDrop 的全部能力都在 MCP 里。这个 skill 唯一的作用，是把你接上去。**

## 先看：接上了吗？

会话里已经有 `list_articles`、`read_style`、`community_feed`、`credit_balance` 这些工具？

**接上了。停止阅读本文件，直接用工具。**

工具自带完整说明（参数、语义、花不花算力都写在描述里）。**本文件有意不重复它们**——重复就会漂移：改了 MCP 忘了改这里，你就会照着过期的文档干活。**单一真源是 MCP 自己。**

没接上的话，往下走。全程两步：登录拿令牌 → 接进客户端。

---

## 第一步：登录（MCP 的 `login` 工具，6+4 手机配对）

**一个工具，调两次。** 靠字段分辨阶段——第一步只传 `code`，第二步只传 `verify_code` + `pairing`：

```
login(code="a3f2b1")                    → 手机弹出 4 位码，返回 pairing 句柄
login(verify_code="7391", pairing="…")  → 返回 anon_ 令牌
```

**为什么两次往返省不掉**：4 位码是服务端在第一步**才随机生成**的——第一步之前它不存在。而且它是安全性的核心：6 位码可能同时匹配多个账号（最多 10 个），服务端给每个候选推**不同**的 4 位码。报对了，才同时证明「手机在你手上」和「你要的是哪个账号」。省掉它，猜个 6 位码 + 手机上误点一下就能被接管。

### MCP 还没接上，怎么调它的工具？

`login` 是**唯一免 token 的工具**（要 token 才能登录、要登录才能拿 token，那是死锁）。所以**不必先接 MCP，也不必装任何东西**——curl 直接打端点：

```bash
VD=https://voicedrop.cn/mcp
call() {  # $1=工具名  $2=参数 JSON
  curl -s -X POST "$VD" -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" \
    | python3 -c "import json,sys;r=json.load(sys.stdin)['result'];t=r['content'][0]['text'];print('ERR: '+t if r['isError'] else t)"
}
```

1. 问用户要手机 **设置 → 账户** 里的 **6 位十六进制码**：

   ```bash
   call login '{"code":"a3f2b1"}'
   # → {"pairing":"…", "next":"看手机——App 里会弹出一个 4 位数字码…"}
   ```

2. **手机上会弹出 4 位数字码**（也会收到一条推送「有新设备要登录」）。问用户要那个码：

   ```bash
   call login '{"verify_code":"7391","pairing":"<上一步返回的 pairing 原样粘回来>"}'
   # → {"token":"anon_…", "scope":"users/anon-…/", "next":"…"}
   ```

### 节奏很重要（这几条是真机上流血换来的）

- **配对只活 2 分钟。** 拿到 6 位码**立刻**发起，拿到 4 位码**立刻**完成。**中间不要聊天、不要解释、不要顺手干别的**——超时就得整个重来。
- **用户报完 4 位码后，多半会切回电脑。** App 一进后台，服务端的「放行」消息就送不到手机。这时手机会收到**第二条推送「确认登录」——提醒用户立刻点它**；或者手动把 App 切回前台，登录会自动完成（服务端存着待办，回前台自动补送）。
- **手机没弹码？** 让用户把 App 切到前台就行——码会自动补送出来，不必重新发起。

### 报错对照

| 报错 | 含义 / 怎么办 |
|---|---|
| `没找到这个账号` | 6 位码抄错，或手机离线/未登录该账号 |
| `验证码不对，还能再试 N 次` | 4 位码错了。配对还活着，**报个对的重调一次 `login` 就行**，别重来 |
| `验证码不对，还能再试 ? 次` | **注意那个 `?`** —— 它说明配对已经不存在了（多半超过 2 分钟过期），**必须重新发起**，不是码错 |
| `手机没有响应` | 手机没放行。让用户点「确认登录」推送，或把 App 切回前台 |
| `你在手机上点了「不是我」` | 用户拒绝了这次登录 |

### 安全须知（用户没听过就说一遍）

`login` 返回的是账号的**完整密钥**（`anon_…`）——**不可吊销、不会过期**，谁拿到它就拥有该账号的全部权限。而且它**会进入模型上下文和会话记录**。别贴到任何公开的地方。

> 不想走配对？App 里 **设置 → 账户 → 访问令牌** 可以直接复制，效果一样。

---

## 第二步：接进客户端

```bash
claude mcp add voicedrop --transport http https://voicedrop.cn/mcp \
  --header "Authorization: Bearer <上一步拿到的 token>"
```

其它客户端（Claude 桌面版自定义连接器等）：URL 填 `https://voicedrop.cn/mcp`，自定义头填 `Authorization: Bearer <token>`。

接上后用 `/mcp` 确认工具已加载，然后**正常使唤即可，不用再回到本文件**。

**令牌的能力边界**（决定了哪些工具会报错）：

| 令牌 | 限制 |
|---|---|
| **anon**（6+4 配对 / App 复制的） | **不能发社区、不能投币**——那需要 Apple 或微信登录后的身份 |
| **Apple / 微信 session** | 全功能 |

碰到 `需要 Apple 登录` 之类的报错，就是这个原因：让用户在 App 里用 Apple/微信登录，再重新复制令牌。

---

## MCP 唯一做不到的事

**上传录音/照片这类二进制文件。**

这是**物理限制，不是偷懒**：MCP server 跑在远端，读不到你本地的文件；唯一的办法是把文件 base64 塞进模型上下文——几 MB 的二进制流进 LLM，是灾难。

正常路径是**在 App 里录**。真要从命令行传：

```bash
# 文件名必须纯 ASCII；leaf 是 VoiceDrop-*.m4a 会自动触发挖矿
curl -s -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: audio/mp4" \
  --data-binary @rec.m4a \
  "https://jianshuo.dev/files/api/upload/VoiceDrop-<ts>-<dur>-<weekday>-<period>.m4a"
```

传完用 MCP 的 `trigger_mining` 催一下，`list_articles` 看结果。

---

**MCP 源码**：`~/code/jianshuo.dev/mcp/`（`README.md` 讲了架构和几个不显然的约束）。
