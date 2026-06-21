---
name: wjs-voicedrop
description: VoiceDrop 配套 skill。两个模式 — (1) list：列出你在 VoiceDrop R2 上的全部文件（录音 / 文章 JSON / 标记）；(2) distill：从你的样本文章蒸馏文风，生成可贴入 VoiceDrop「设置→文风」的精简规则集，并可直接通过 Files API 上传。触发词："voicedrop list"、"列出 VoiceDrop 文件"、"voicedrop distill"、"蒸馏 VoiceDrop 文风"、"/wjs-voicedrop"。
---

# VoiceDrop Skill

VoiceDrop 的两个常见 Claude Code 任务：**列文件** 和 **蒸馏文风**。

## 认证

Files API 地址：`https://jianshuo.dev/files/api`

每个请求都需要 bearer token。**开始前先检查 token 是否可用：**

### 没有 token？先去 App 拿

打开 VoiceDrop App → 底部「**设置**」tab → 下拉到底部「**访问令牌**」区域 → 点右侧复制按钮。

拿到的令牌形如 `anon_xxxxxxxx…`（匿名用户）或一长串 JWT（Sign in with Apple 用户）。

### 有了 token，在 Claude Code 里设好

```bash
# 普通用户（从 App 拿到的令牌）
TOKEN=anon_xxxxxxxx...    # 替换为你复制的令牌

# 管理员（王建硕）：直接从 .env 读
set -a; source ~/code/.env; set +a
TOKEN=$FILES_TOKEN
```

| 场景 | token 来源 |
|---|---|
| 普通用户 | VoiceDrop App → 设置 → 访问令牌 → 复制 |
| 管理员（王建硕） | `~/code/.env` 里的 `FILES_TOKEN` |

---

## 模式一：list — 列出所有文件

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://jianshuo.dev/files/api/list
```

返回 `{"files": ["users/<sub>/VoiceDrop-…m4a", …]}` 格式的 JSON。

### 格式化显示

拿到 files 列表后，按类型分组展示给用户：

| 类型 | 识别规则 |
|---|---|
| 录音（待处理） | `VoiceDrop-*.m4a`，且无同名 `.json` / `.empty` 标记 |
| 已成文 | `articles/<stem>.json` |
| 无语音 | `articles/<stem>.empty` |
| 文风设置 | `CLAUDE.md` |
| 其他 | 其余文件 |

打印格式示例：

```
录音（待处理）：2 条
  VoiceDrop-20260621-183s-Sun-evening-Shanghai-Xuhui.m4a
  VoiceDrop-20260620-94s-Sat-afternoon.m4a

已成文：5 篇（对应 5 条录音）
无语音：1 条（原因见 .empty 文件）

文风设置：已上传 CLAUDE.md
```

如果需要查看某个文件内容（如 `CLAUDE.md` 或某个 `.json`）：

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://jianshuo.dev/files/api/download/<urlencoded-key>"
```

---

## 模式二：distill — 蒸馏文风并上传

**目标**：从用户的几篇样本文章提炼出精简的「文风规则」，格式化后上传到 R2 的 `CLAUDE.md`，让服务器挖文章时自动带上。

### 为什么是「精简版」而非完整 9 轴卡

服务器 miner（`mine.py`）的 SYSTEM prompt 已经包含了王建硕文风的核心 DNA（断言开头、不讲故事、盘古之白等）。`CLAUDE.md` 的 `# 我的文风` 是**叠加**在 SYSTEM 之后的，用来补充「这个用户特有的」写法差异——所以只需 10–20 条**可执行的差异规则**，不需要完整卡片。

### 蒸馏步骤

1. **收集样本**  
   请用户提供 3–6 篇他/她自己写的文章（直接粘贴或给文件路径）。少于 3 篇就提醒指纹不稳定。

2. **起子 agent 做分析**（不污染主上下文）  
   把所有样本发给 subagent，提示：

   > 从这些文章里提炼这位作者写作时**最突出的、可执行的**语言习惯。关注：句子长短偏好、段落密度、人称用法、词汇倾向（口语/书面/中英混用）、论证方式（断言还是铺垫）、结尾习惯、绝不做的事。**不要** 分析思想立场，只分析怎么写。输出 15–20 条 bullet，每条一句话，用「用 X」「不用 Y」「X 必须在 Y 前面」等可执行语言写。

3. **回收规则，润色**  
   检查规则是否具体可执行（「喜欢短句」太模糊；「单句成段，段落 1–3 句居多」才够用）。去掉和服务器 SYSTEM prompt 完全重复的规则（如「不加 emoji」）。

4. **组装 CLAUDE.md**

   ```
   # 我的名字
   <用户名字，从 list 取或直接问>

   # 我的文风
   <15–20 条 bullet，纯文本>
   ```

5. **预览，让用户确认**  
   打印完整内容，问「要上传吗？」——获得确认再 PUT。

6. **上传**

   ```bash
   curl -s -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: text/markdown; charset=utf-8" \
     --data-binary @/tmp/voicedrop-claudemd.txt \
     https://jianshuo.dev/files/api/upload/CLAUDE.md
   ```

   成功（2xx）→ 告知用户「文风已上传，下次录音挖文章时自动生效」。  
   失败 → 打印状态码，提示检查 token。

### 更新已有文风

如果用户只想改其中几条而不是全量重写：
1. 先 `download/CLAUDE.md` 取现有内容
2. 在 parse 出的 `# 我的文风` 部分手动编辑或追加
3. 重新 PUT

---

## 常见错误

| 错误 | 修正 |
|---|---|
| `401 Unauthorized` | TOKEN 没设或过期 → App 设置 → 访问令牌 → 重新复制 |
| `403 Forbidden` | 普通 token 只能访问自己的 `users/<sub>/`；管理员操作请用 `FILES_TOKEN` |
| list 返回空 | 正常——录音都被 miner 处理完了，或者用户还没录过音 |
| 上传后 app 没变 | app 下次切到「设置」tab 时才重新 load；让用户来回切一下 |
| 文风规则太抽象 | 每条规则要能被「另一个不认识这位作者的模型」直接照着做 |
| 把思想立场写进文风 | 文风只描述「怎么写」，不描述「写什么」「怎么看这件事」 |
