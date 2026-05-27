# X 内容改进 — Scoreboard
_generated 2026-05-27_

## 📈 现状

- 成熟推 39 条（≥3天），中位 impression **916**，最高 333030
- ⚠ impression 主要由源文章/话题决定，prompt 是二阶因素——版本判决弱信号，内容特征才是杠杆

## 🏷️ Prompt 版本

| 版本 | n | 中位imp | 状态 | 假设 |
|---|---|---|---|---|
| pre-prompt | 39 | 916 |  样本不足 |  |

> 目前 0 个正式版本——版本对比要等下一版 prompt。先看下面的内容特征。

## 🎯 内容特征（angle = prompt 主旋钮）

| angle | n | 中位imp | 互动率 |
|---|---|---|---|
| B 反差 | 1 | 435 | 1.6% |

## ✅ To-do（下一步）

- [ ] 据内容特征分析，提一版 prompt 改动（带假设）→ 改 `prompts/x/prompt.md` + commit → `ledger.py register <新SHA>`
