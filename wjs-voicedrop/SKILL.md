---
name: wjs-voicedrop
description: VoiceDrop 配套 skill。list 模式用 articles API 列出已成文文章；distill 模式蒸馏文风并上传。触发词："voicedrop list"、"列出 VoiceDrop 文件"、"voicedrop 文章"、"voicedrop distill"、"蒸馏 VoiceDrop 文风"、"/wjs-voicedrop"。
---

# VoiceDrop Skill

## 认证

```bash
# 王建硕（管理员）直接从 .env 读
TOKEN=$(grep -E '^FILES_TOKEN=' ~/code/.env | cut -d'=' -f2- | tr -d '"' | head -1)

# 普通用户：App → 设置 → 访问令牌 → 复制
TOKEN=anon_xxxxxxxx...
```

---

## 模式一：list — 列出已成文文章

使用 articles API（不再用 `/files/api/list`）：

```bash
TOKEN=$(grep -E '^FILES_TOKEN=' ~/code/.env | cut -d'=' -f2- | tr -d '"' | head -1)
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles
```

返回结构：
```json
{
  "articles": [
    { "stem": "VoiceDrop-2026-06-20-143052", "title": "AI 与人的边界", "version": 3, "createdAt": 1718870452000, "updatedAt": 1718872000000, "count": 2 }
  ]
}
```

格式化展示（最新在前）：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles \
  | python3 -c "
import json, sys
from datetime import datetime
data = json.load(sys.stdin)
arts = data.get('articles', [])
print(f'共 {len(arts)} 篇文章：\n')
for a in arts:
    dt = datetime.fromtimestamp(a['createdAt']/1000).strftime('%Y-%m-%d')
    print(f'  [{dt}]  {a[\"title\"]}  (stem={a[\"stem\"]}, {a[\"count\"]} 节, v{a[\"version\"]})')
"
```

如需读某篇全文（transcript + 正文 Markdown）：

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles/<stem>
# 返回 {transcript, articles:[{title, body}], createdAt, updatedAt, ...}
```

---

## 模式二：distill — 蒸馏文风并上传

**目标**：从几篇样本文章提炼出精简的「文风规则」，上传到 R2 的 `CLAUDE.md`，让 miner 挖文章时自动带上。

### 为什么是精简版

服务器 miner 的 SYSTEM prompt 已包含核心文风 DNA。`CLAUDE.md` 的 `# 我的文风` 是叠加补充的，只需 10–20 条**可执行的差异规则**，不需要完整卡片。

### 步骤

**1. 列出可用文章**

```bash
TOKEN=$(grep -E '^FILES_TOKEN=' ~/code/.env | cut -d'=' -f2- | tr -d '"' | head -1)
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles
```

**2. 请用户选择 3–6 篇作为样本**（少于 3 篇提醒指纹不稳定）

**3. 逐篇读取正文**

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/articles/<stem>
```

从返回 JSON 中取 `articles[*].body`（已成文的 Markdown 正文）作为分析素材，不用 `transcript`（口述原文）。

**4. 派子 agent 分析**（隔离上下文）

> 从这些文章里提炼这位作者写作时**最突出的、可执行的**语言习惯。关注：句子长短偏好、段落密度、人称用法、词汇倾向、论证方式、结尾习惯、绝不做的事。**不要** 分析思想立场，只分析怎么写。输出 15–20 条 bullet，每条一句话，用「用 X」「不用 Y」「X 必须在 Y 前面」等可执行语言写。

**5. 回收规则，润色**

检查每条是否可执行（「喜欢短句」太模糊；「单句成段，段落 1–3 句居多」才够用）。去掉与服务器 SYSTEM prompt 完全重复的规则。

**6. 组装 CLAUDE.md**

```
# 我的名字
<用户名字>

# 我的文风
- 规则1
- 规则2
...
```

**7. 预览，获得确认后上传**

```bash
cat > /tmp/voicedrop-claudemd.txt << 'STYLE'
# 我的名字
王建硕

# 我的文风
- <规则1>
- <规则2>
STYLE

curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/markdown; charset=utf-8" \
  --data-binary @/tmp/voicedrop-claudemd.txt \
  https://jianshuo.dev/files/api/upload/CLAUDE.md
```

成功（2xx）→ 告知用户「文风已上传，下次录音挖文章时自动生效」。

### 更新已有文风（只改几条）

```bash
# 先读出现有文风
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://jianshuo.dev/files/api/download/CLAUDE.md"
# 手动编辑后重新 PUT（同上传步骤）
```

---

## 挖矿触发

如需立即触发挖矿（对待处理录音加急处理）：

```bash
TOKEN=$(grep -E '^FILES_TOKEN=' ~/code/.env | cut -d'=' -f2- | tr -d '"' | head -1)
curl -s -X POST -H "Authorization: Bearer $TOKEN" https://jianshuo.dev/files/api/mine
```

完整挖矿流程（含 ASR 转写、多文章挖出）见 `/wjs-mining-voicedrop` skill。

---

## 常见错误

| 错误 | 修正 |
|---|---|
| `401 Unauthorized` | TOKEN 没设或过期 → App 设置 → 访问令牌 → 重新复制 |
| `403 Forbidden` | 普通 token 只能访问自己的 scope；管理员操作用 `FILES_TOKEN` |
| articles 返回空数组 | 还没有成文的文章，可触发挖矿或等待 miner 处理 |
| 上传文风后 App 没变 | 切离再切回「设置」tab 重新加载 |
| 文风规则太抽象 | 每条规则要能被不认识该作者的模型直接照着执行 |
