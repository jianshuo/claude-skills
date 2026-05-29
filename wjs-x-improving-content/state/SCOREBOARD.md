# X 内容改进 — Scoreboard
_generated 2026-05-30_

## 📈 现状

- 成熟推 86 条（≥3天），中位 impression **841.0**，最高 333474
- ⚠ impression 主要由源文章/话题决定，prompt 是二阶因素——版本判决弱信号，内容特征才是杠杆

## 🏷️ Prompt 版本

| 版本 | n | 中位imp | 状态 | 假设 |
|---|---|---|---|---|
| f6b47a3 | 18 | 579.0 | active  | 收紧到≤60字(短=更高触达)+拿不准时优先金句体A |
| pre-prompt | 68 | 982.5 |  样本不足 |  |

> 目前 1 个正式版本——版本对比要等下一版 prompt。先看下面的内容特征。

## 🎯 内容特征（angle = prompt 主旋钮）

| angle | n | 中位imp | 互动率 |
|---|---|---|---|
| A 金句 | 3 | 4193 | 1.3% |
| B 反差 | 4 | 901.0 | 2.5% |
| C 小灾难 | 1 | 392 | 1.3% |

## ✅ To-do（下一步）

- [ ] 据内容特征分析，提一版 prompt 改动（带假设）→ 改 `prompts/x/prompt.md` + commit → `ledger.py register <新SHA>`
- [ ] v1 (f6b47a3) 测量中 — 攒够 5 条成熟推后 evaluate
- [ ] v2 (c060c9a) 测量中 — 攒够 5 条成熟推后 evaluate
