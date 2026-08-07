---
name: wjs-voicedrop-post-processing
description: Use when a newly mined VoiceDrop article needs automated post-processing — invoked headless by the 5-minute poller (launchd com.jianshuo.voicedrop-postprocess) with the article stem as argument. Triggers — "/wjs-voicedrop-post-processing <stem>".
---

# VoiceDrop 文章后处理

输入：文章 stem，由调用参数给出（$ARGUMENTS）。

运行环境：无人值守 `claude -p`，voicedrop MCP 已接好（读文章/写版本工具可用；发布、删除、社区、花钱类工具已被调用方禁用）。不要问任何问题，跑完即退。

## 流程

1. 用 voicedrop MCP 的读文章工具取回该 stem 的文章全文与元数据。读不到就重试一次，再失败以非零退出（轮询器下一轮会重试）。
2. 【后处理动作——待建硕定义，目前是骨架版：只检查，不改动文章】
   - 检查正文非空、标题存在
   - 最后输出一行：`postprocess ok: <stem> — <标题>（<字数>字）`

## 铁律（同夜班编辑）

- 绝不发布、绝不删除、绝不碰文风库和社区。
- 将来若要改文章，只能走「写新版本」，不切 head。

## 待定义

后处理具体做什么（配图 / 打标签 / 质量评分 / 生成摘要…）想好后，替换第 2 步即可，轮询器不用动。
