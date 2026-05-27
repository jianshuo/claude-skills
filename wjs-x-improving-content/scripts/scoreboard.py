#!/usr/bin/env python3
"""Render state/SCOREBOARD.md — versions leaderboard + content insights + to-do.

Usage: python3 scoreboard.py   (writes + prints)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (read_jsonl, TWEETS, VERSIONS, SCOREBOARD, med,  # noqa: E402
                     MATURITY_DAYS, MIN_TWEETS_PER_VERSION)
from datetime import date

ANGLE_NAME = {"A": "金句", "B": "反差", "C": "小灾难"}


def main():
    tweets = [t for t in read_jsonl(TWEETS) if t.get("mature")]
    versions = read_jsonl(VERSIONS)
    imps = [t["impressions"] for t in tweets if t.get("impressions") is not None]

    out = ["# X 内容改进 — Scoreboard", f"_generated {date.today()}_", ""]
    out += ["## 📈 现状", ""]
    if imps:
        out.append(f"- 成熟推 {len(tweets)} 条（≥{MATURITY_DAYS}天），中位 impression **{med(imps)}**，最高 {max(imps)}")
    else:
        out.append("- _还没数据，丢 Content CSV 进 inbox 跑 ingest-tweets.py_")
    out.append("- ⚠ impression 主要由源文章/话题决定，prompt 是二阶因素——版本判决弱信号，内容特征才是杠杆")
    out.append("")

    # version leaderboard
    out += ["## 🏷️ Prompt 版本", ""]
    g = {}
    for t in tweets:
        g.setdefault(t.get("prompt_sha"), []).append(t)
    vmeta = {v["prompt_sha"]: v for v in versions}
    if g:
        out += ["| 版本 | n | 中位imp | 状态 | 假设 |", "|---|---|---|---|---|"]
        for sha in sorted(g, key=lambda s: (s is None, s or "")):
            vs = [t["impressions"] for t in g[sha] if t.get("impressions") is not None]
            m = vmeta.get(sha, {})
            label = sha or "pre-prompt"
            flag = "" if (sha and len(vs) >= MIN_TWEETS_PER_VERSION) else "样本不足"
            out.append(f"| {label} | {len(vs)} | {med(vs)} | {m.get('verdict') or m.get('status') or ''} {flag} | {m.get('hypothesis','')} |")
    else:
        out.append("_无_")
    real_versions = [s for s in g if s]
    if len(real_versions) < 2:
        out.append("")
        out.append(f"> 目前 {len(real_versions)} 个正式版本——版本对比要等下一版 prompt。先看下面的内容特征。")
    out.append("")

    # content insight: angle (the prompt's main knob)
    out += ["## 🎯 内容特征（angle = prompt 主旋钮）", ""]
    ang = {}
    for t in tweets:
        if t.get("angle"):
            ang.setdefault(t["angle"], []).append(t)
    if ang:
        out += ["| angle | n | 中位imp | 互动率 |", "|---|---|---|---|"]
        for a in "ABC":
            if a in ang:
                ts = ang[a]
                vs = [t["impressions"] for t in ts if t.get("impressions") is not None]
                ti = sum(t["impressions"] or 0 for t in ts); te = sum(t["engagements"] or 0 for t in ts)
                rate = f"{te/ti:.1%}" if ti else "—"
                out.append(f"| {a} {ANGLE_NAME[a]} | {len(vs)} | {med(vs)} | {rate} |")
    else:
        out.append("_bot 推还没带 angle 标签_")
    out.append("")

    # to-do
    out += ["## ✅ To-do（下一步）", ""]
    out.append("- [ ] 据内容特征分析，提一版 prompt 改动（带假设）→ 改 `prompts/x/prompt.md` + commit → `ledger.py register <新SHA>`")
    pend = [v for v in versions if v.get("status") == "active" and not v.get("verdict")]
    for v in pend:
        out.append(f"- [ ] v{v['id']} ({v['prompt_sha']}) 测量中 — 攒够 {MIN_TWEETS_PER_VERSION} 条成熟推后 evaluate")
    out.append("")

    text = "\n".join(out)
    SCOREBOARD.parent.mkdir(parents=True, exist_ok=True)
    SCOREBOARD.write_text(text)
    print(text)


if __name__ == "__main__":
    main()
