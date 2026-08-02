---
name: wjs-voicedrop-choosing-cover
description: Use when 王建硕 wants to decide whether a VoiceDrop article should get an AI 题图 (公众号封面), and which style of image prompt to use — before generating any cover. Triggers — "这篇要不要配题图", "选个题图风格", "给这篇出个题图 prompt", "choosing cover", "/wjs-voicedrop-choosing-cover".
---

# wjs-voicedrop-choosing-cover

给一篇 VoiceDrop 文章做两个决定：**配不配题图**，以及**用哪种风格的 prompt 生成**。核心原则：真素材优先于 AI 画；风格跟着文章气质走，绝不一招鲜。

## 输入

三种都接受：VoiceDrop 文章（MCP `read_article`，按标题或 ID）/ 本地 markdown / 直接粘贴的正文。`[[photo:KEY]]` 是文中已插入的用户实拍照片。

## Step 1：配不配（先于一切风格讨论）

| 情形 | 判断 |
|------|------|
| 文中已有实拍照片且与主题相关 | **不配**。首图即封面（真照片 > AI 画，AI 封面会把实拍正文的诚恳感冲掉）。指出用哪张 `[[photo:KEY]]`。 |
| 无照片，会发布 / 分享 | **配** |
| 无照片，极短碎碎念（<100 字） | 先问「这篇要单独发吗」；发才配 |
| 实拍照片存在但与主题无关（截图、票据） | 视同无照片，配 |

## Step 2：风格选择（必须过这张表，禁止默认某一种）

| 文章气质 | 风格 | 基调 |
|----------|------|------|
| 思辨 / 观点 / 方法论 | 极简概念图 | 一个具体物件当隐喻，大留白 |
| 生活随笔 / 自然 / 散步 | 水彩淡彩 | 轻、透、浅色底 |
| 怀旧 / 回忆 / 家人 | 胶片 / 油画 | 暖调、颗粒感 |
| 科技 / 工具 / AI / 教程 | 编辑部封面 | 具体物件（卡片、面板、画布），忌泛泛机器人 |
| 幽默 / 自嘲 | 卡通轻插画 | 松弛，不闹腾 |
| 哀伤 / 悼念 / 疾病 | 素描或极淡水彩 | 低饱和、克制，不画人脸，**绝不卡通 / 广告风** |

拿不准气质时读全文再判，不按标题猜。

## Step 3：拼 prompt（硬规格）

- **比例 2.45:1，尺寸 1568x640**（VoiceDrop 题图规格；本地 wjs-publishing-wechat 线是 900×383，别抄混）
- 题图主标题从文章标题提炼 **6–10 个汉字**（极简概念图可用 1–4 字大字），必须清晰可读
- 构图：大标题在上，主视觉在下，文字左右撑满
- 配色随主题变，默认浅色底；同一批文章不许撞色撞构图
- 避免清单（写进 prompt）：乱码文字、过多小字、真实品牌 logo、纯氛围壁纸、厚重蓝紫渐变、廉价营销海报感

## Step 4：出图（用户要求时才做）

`gpt-image-2-skill` 走 `--provider codex`，`--size 1568x640`；或在 VoiceDrop 内把 prompt 交给 `new_photo`。

## 输出契约（每篇固定这四行）

```
判断：配 / 不配 —— 一句理由
风格：<Step 2 表里的风格名>
Prompt：<完整可直接用，含 2.45:1 / 1568x640 与避免清单>
（不配时第三行改为：封面 = [[photo:KEY]]，横向裁 2.45:1 的建议裁法）
```

## Red Flags

- 连续两篇输出同一风格 → 回 Step 2 重判
- 文中有实拍还在写 AI prompt → 回 Step 1
- prompt 里出现 900×383 或 2.35:1 → 规格抄错线了
- 哀伤文出现卡通 / 亮色 → 重来
