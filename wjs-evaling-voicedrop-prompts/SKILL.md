---
name: wjs-evaling-voicedrop-prompts
description: Use when 王建硕 wants to evaluate whether a change to VoiceDrop's 挖矿 system prompt is actually better than the live version — runs the local eval harness (golden fixtures × champion-vs-candidate, same input), dispatches blind pairwise judge subagents, aggregates a win-rate verdict, and on approval promotes the candidate into agent/src/prompts/mine.js. Triggers — "评估 prompt"、"挖矿 prompt 改好了吗"、"eval prompt"、"比一比两版 prompt"、"/wjs-evaling-voicedrop-prompts".
---

# VoiceDrop 挖矿 prompt 评估

harness = 本 skill（协议）+ jianshuo.dev `agent/eval/`（脚本/数据）。运行时 = 本地 Claude Code。
被测对象 = `agent/src/prompts/mine.js` 的 `MINE_SYSTEM`（git 即版本库）。

## 何时用
用户改了挖矿 prompt（`MINE_SYSTEM`），想用数据判断改好了还是改坏了，而不是凭感觉看一两次。

## 流程（按序）

1. **拿候选 prompt**：把候选版 `MINE_SYSTEM` 文本写到一个临时文件（如 `/tmp/cand-prompt.txt`）；冠军 = 当前 `mine.js` 的 `MINE_SYSTEM`（脚本自动读）。
2. **跑产出**：`cd ~/code/jianshuo.dev/agent && CLAUDE_API_KEY=$CLAUDE_API_KEY node eval/run-eval.mjs /tmp/cand-prompt.txt <runId>`。产出落 `eval/runs/<runId>/`。先看终端有没有「确定性回退」警告——有就先停，多半是候选 prompt 破坏了 JSON 输出。
3. **成对盲评**：对每条 fixture，dispatch 一个 subagent，喂 `references/judge-rubric.md` + 该 fixture 的 transcript + 两份产出。**A/B 顺序随机**（一半 fixture 把 candidate 放 A、一半放 B，记录映射，收到结果后还原成 champion/candidate）。裁判模型用与生成（opus）不同家族的模型。收每条的 `{winner, dims, reason}`。
4. **聚合**：把还原后的 `verdicts`（winner ∈ candidate/champion/tie）+ 候选 proxyFails 喂 `aggregate()`，渲染 `renderReport()` → 写 `eval/runs/<runId>/report.md`。
5. **人工终审**：把胜负最接近、分歧最大的 1–2 条产出并排摆给用户。**机器只筛掉明显更差的，文风最后一票是用户。**
6. **晋级**：仅当 `decision==="promote"`（胜率 ≥70% 且无回退）**且用户点「认可」**——把候选写回 `agent/src/prompts/mine.js` 的 `MINE_SYSTEM`，commit（message 附 runId 与胜率），并跑 `npm test` 确认没破坏。否则保留报告、不动生产版。

## 边界
- 只评挖矿 prompt（`MINE_SYSTEM`/`MINE_SYSTEM_FORCE`）。审核/语音编辑 prompt 是不同 eval 模式，不在本 skill。
- 不测成本/缓存/延迟（本地缓存行为≠生产）；不做无人值守。
- 真实金标集要 ≥10 条才可信（见 `agent/eval/fixtures/README.md` 的补充流程）；种子 2 条只够自测流程。
