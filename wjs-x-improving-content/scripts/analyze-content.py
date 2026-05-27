#!/usr/bin/env python3
"""Content-feature analysis: which content traits correlate with high impressions.

This is the part that ties content back to the PROMPT — angle / length / engagement
are exactly what prompts/x/prompt.md controls. Runs over MATURE tweets only
(impressions settled). Honest framing: impressions are dominated by the source
article/topic; treat these as directional levers, not laws.

Breakdowns (median impressions, since the distribution is viral-skewed):
  - by angle (A 金句 / B 反差 / C 小灾难)   ← the prompt's main knob
  - by length bucket (CJK chars)
  - by source (bot = prompt-generated vs manual)
  - engagement rate (engagements / impressions) by angle
  - top / bottom tweets, to read what actually resonated

Usage: python3 analyze-content.py [--all]   (--all includes immature tweets)
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import read_jsonl, TWEETS, med, MATURITY_DAYS  # noqa: E402

ANGLE_NAME = {"A": "金句", "B": "反差", "C": "小灾难"}
LEN_BUCKETS = [(0, 60, "短 <60"), (60, 100, "中 60–100"), (100, 9999, "长 ≥100")]


def grp(tweets, keyfn):
    out = {}
    for t in tweets:
        k = keyfn(t)
        if k is None:
            continue
        out.setdefault(k, []).append(t)
    return out


def imps(ts):
    return [t["impressions"] for t in ts if t.get("impressions") is not None]


def table(title, groups, order=None):
    print(f"\n## {title}")
    keys = order or sorted(groups)
    print(f"  {'组':<14} {'n':>3}  {'中位 impression':>14}  {'最高':>6}")
    rows = []
    for k in keys:
        if k not in groups:
            continue
        ts = groups[k]
        vs = imps(ts)
        if not vs:
            continue
        rows.append((k, len(vs), med(vs), max(vs)))
    for k, n, m, mx in rows:
        print(f"  {str(k):<14} {n:>3}  {m:>14}  {mx:>6}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="include immature tweets")
    args = ap.parse_args()

    allt = read_jsonl(TWEETS)
    tweets = allt if args.all else [t for t in allt if t.get("mature")]
    vs = imps(tweets)
    if not vs:
        print("No tweets to analyze. Ingest a Content CSV first.")
        return

    print(f"# 内容特征分析  (n={len(tweets)} 条" +
          ("" if args.all else f"，成熟≥{MATURITY_DAYS}天") + ")")
    print(f"全体中位 impression = {med(vs)}   最高 = {max(vs)}   最低 = {min(vs)}")
    print("⚠ impression 主要由源文章/话题决定，prompt 是二阶因素；下面是方向性信号，不是定律。")

    table("按 angle（prompt 的主旋钮）",
          grp(tweets, lambda t: f"{t['angle']} {ANGLE_NAME.get(t['angle'],'')}" if t.get("angle") else None),
          order=[f"{a} {ANGLE_NAME[a]}" for a in "ABC"])

    def lb(t):
        for lo, hi, name in LEN_BUCKETS:
            if lo <= (t.get("char_len") or 0) < hi:
                return name
        return None
    table("按长度（CJK 字数）", grp(tweets, lb), order=[n for _, _, n in LEN_BUCKETS])

    table("按来源", grp(tweets, lambda t: t.get("source")), order=["bot", "manual"])

    # engagement rate by angle
    print("\n## 互动率 = engagements / impressions（按 angle）")
    g = grp([t for t in tweets if t.get("angle")], lambda t: t["angle"])
    for a in "ABC":
        if a in g:
            ts = g[a]
            ti = sum(t["impressions"] or 0 for t in ts)
            te = sum(t["engagements"] or 0 for t in ts)
            rate = f"{te/ti:.1%}" if ti else "—"
            print(f"  {a} {ANGLE_NAME[a]:<6} n={len(ts):>2}  互动率 {rate}")

    st = sorted([t for t in tweets if t.get("impressions") is not None],
                key=lambda t: t["impressions"], reverse=True)
    def show(t):
        tag = f"[{t['angle']}]" if t.get("angle") else "[manual]"
        txt = t["text"].replace("\n", " ")[:46]
        print(f"  {t['impressions']:>6}  {tag:<9} {txt}…")
    print("\n## 🔝 impression 最高 5 条"); [show(t) for t in st[:5]]
    print("\n## 🔻 最低 5 条"); [show(t) for t in st[-5:]]


if __name__ == "__main__":
    main()
