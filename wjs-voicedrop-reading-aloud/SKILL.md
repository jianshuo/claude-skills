---
name: wjs-voicedrop-reading-aloud
description: Use when the user wants text turned into an audiobook / read aloud — they give a passage, a file, a URL, or a VoiceDrop article and want an mp3 narration with expressive voices. Triggers — "做成有声书", "朗读出来", "读给我听", "念出来", "read aloud", "/wjs-voicedrop-reading-aloud".
---

# wjs-voicedrop-reading-aloud

文字 → 有声书 mp3。不是照字面念，而是先**编排**：不同性质的内容换不同声音，关键转折处加语音指令，然后用火山引擎豆包 seed-tts-2.0 合成。

合成工具：`~/code/volcano-tts/tts.py`（先 `source ~/code/.env`）。

## 铁律

1. **绝不把带【】/[ ] 标注的文本直接喂裸 API** —— 裸 API 会把标注原样念出来（实测实锤）。永远走 `tts.py`，它把标注切段转成 `context_texts` 语音指令。
2. **只能用 2.0 音色（`_uranus_bigtts` 后缀）** —— moon/mars/tob 音色在 seed-tts-2.0 资源下报错 `resource ID is mismatched`。
3. **合成前把编排好的朗读脚本给用户看一眼**（除非用户说直接出）——编排是再创作，声音分配和指令值得确认。headless/自动化场景跳过此步。

## 工作流

### 1. 取内容并认真通读

- 纯文本/文件：直接读。
- URL：WebFetch；SPA 页面（如 docs.volcengine.com）用 browse skill 渲染后取正文。
- VoiceDrop 文章：voicedrop MCP 的 `read_article`。

通读时标记出：正文叙述 / 直接引用（引号、blockquote）/ 大白话吐槽与内心 OS / 数据、列表、表格 / 标题与小节。

### 2. 编排重写成朗读脚本

这是核心步骤，是**重写**不是转录：

- 去掉一切视觉残留：markdown 符号、链接、图片说明、脚注编号。
- 表格、列表、数据改写成口语句子（「三个原因：第一…」）。
- 标题不逐字念，化进过渡句，或用停顿+换气带过。
- 太书面的长句改口语，但保留作者的用词风格。
- **按内容性质分配音色**（见音色表）：正文一个主声贯穿；引用换引用声；吐槽/大白话换插话声。声音切换是给听众的「格式信号」，等价于视觉上的引用块。
- 不要频繁换声：一般 2~3 个声音封顶，切换只发生在内容性质真正变化处。

### 3. 加语音指令（克制）

在句前加 `[心理活动、细腻表情、肢体动作等描述]`，如 `[放慢，一字一顿，点出要害]`。

- **只在需要的地方加**：情绪转折、节奏变化、重音、引用的口吻模仿。平铺直叙的段落一个不加，靠全局指令兜底。
- 经验密度：每 3~5 句最多一处；一段平静的叙述可以整段没有。
- 每处标注就是一次切段（一次 API 调用+拼接点），切太碎会让语流变散。
- 标注写成对朗读者说的表演提示（心理活动/表情/动作皆可），不要写成对听众的说明。

### 4. 朗读脚本格式（tts.py --script）

```
# 注释行
@voice narrator zh_male_yuanboxiaoshu_uranus_bigtts
@voice quote zh_male_yizhipiannan_uranus_bigtts
@voice casual zh_male_fanjuanqingnian_uranus_bigtts

@narrator
[语气平静从容，像老朋友聊天]先讲一个真事。……他公开断言：

@quote
[带着当年的笃定与体面]股价已经站上了一个永久的高原。

@narrator
几天后，市场开始了最惨烈的下跌。

@casual
[像随口吐槽]这人判断力真差。
```

### 5. 合成与验收

```bash
source ~/code/.env
python3 ~/code/volcano-tts/tts.py -f script.txt --script -o out.mp3 \
  -i "这是一段有声书朗读，自然口语化，像讲故事，不要播音腔"
```

- `-i` 全局指令必带，定整体基调；`--speech-rate`、`--subtitle`（字级时间戳）按需。
- 验收：`afinfo out.mp3` 看时长是否与字数匹配（中文约 4~5 字/秒）；如首次改动过工具或有疑虑，用 `~/.claude/skills/wjs-transcribing-audio/scripts/volc_asr_stream.py` 抽查一段，确认标注没被念出来。
- 用 SendUserFile 把 mp3 发给用户。

## 音色表（已实测可用，全部支持语音指令）

| 用途 | voice_type | 名称 |
|---|---|---|
| 旁白主声（男，默认） | zh_male_yuanboxiaoshu_uranus_bigtts | 渊博小叔 |
| 旁白主声（女，备选） | zh_female_zhixingnv_uranus_bigtts | 知性女声 |
| 旁白（对话感/播客感） | zh_male_shenyeboke_uranus_bigtts | 深夜播客 |
| 解说腔 | zh_male_cixingjieshuonan_uranus_bigtts | 磁性解说男声 |
| 引用/名人语录/译文 | zh_male_yizhipiannan_uranus_bigtts | 译制片男 |
| 大白话/吐槽/内心 OS | zh_male_fanjuanqingnian_uranus_bigtts | 反卷青年 |
| 通用女声 | zh_female_vv_uranus_bigtts | Vivi |

更多 2.0 音色：https://www.volcengine.com/docs/6561/1257544 （只认 `_uranus_bigtts` 后缀）。

## 常见坑

- **指令悄无声息不生效（听起来全一样）** → `context_texts`/`section_id` 必须嵌在 `additions`（JSON 字符串）里，放 `req_params` 顶层会被服务端静默忽略、不报错。`tts.py` 已按正确层级实现；怀疑时用「极慢哭腔」指令 A/B 对比时长（应 +25% 以上），基线合成是确定性的（同句同参时长完全一致），差异小于 5% 即未生效。
- 标注被念出来 → 忘了走 `tts.py` 的标注解析，或用了它不认的括号格式（支持 `【】` 与 `[ ]`）。
- `resource ID is mismatched with speaker related resource` → 用了非 2.0 音色。
- 输出中间语气断裂感明显 → 标注切段太碎，合并标注、减少切换。
- 听到「星号」「井号」→ 编排步骤没洗干净 markdown（tts.py 未开 markdown 过滤，靠编排时清除）。
