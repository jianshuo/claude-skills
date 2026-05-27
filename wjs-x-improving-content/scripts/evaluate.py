#!/usr/bin/env python3
"""Compare prompt versions on impressions-per-tweet.

Each prompt version = a prompts/x/prompt.md git short-SHA. Tweets are grouped by
the prompt_sha live at post time. Metric = MEDIAN impressions per MATURE tweet
(viral-skewed → median, not mean). A version needs ≥ MIN_TWEETS_PER_VERSION
mature tweets before it gets a verdict vs the previous version.

Verdict (relative to the previous version's median):
  keep      Δ ≥ +THRESHOLD   (new prompt lifts reach — leave it live)
  rollback  Δ ≤ -THRESHOLD   (new prompt hurt — git checkout the old SHA)
  flat      otherwise

⚠ Big confound: impressions are dominated by which ARTICLE each tweet came from,
not the prompt. Version verdicts are weak signal until many tweets accumulate.
The content-feature analysis (analyze-content.py) is the stronger lever.

Usage: python3 evaluate.py [--threshold 0.10]
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (read_jsonl, TWEETS, VERSIONS, med, MIN_TWEETS_PER_VERSION)  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.10)
    args = ap.parse_args()

    tweets = [t for t in read_jsonl(TWEETS) if t.get("mature")]
    vmeta = {v["prompt_sha"]: v for v in read_jsonl(VERSIONS)}

    groups = {}
    for t in tweets:
        groups.setdefault(t.get("prompt_sha"), []).append(t)

    # order versions by their earliest tweet date (proxy for version age)
    def first_date(sha):
        return min(t["date"] for t in groups[sha])
    shas = sorted([s for s in groups], key=lambda s: (s is None, first_date(s) if groups[s] else "9999"))

    if not shas:
        print("No mature tweets yet. Ingest a Content CSV.")
        return

    print("# Prompt 版本对比（中位 impression / 条，成熟推）\n")
    print(f"  {'版本':<12} {'n':>3}  {'中位imp':>7}  {'假设/备注'}")
    rows = []
    for s in shas:
        vs = [t["impressions"] for t in groups[s] if t.get("impressions") is not None]
        label = s if s else "pre-prompt(无)"
        hyp = (vmeta.get(s, {}) or {}).get("hypothesis", "")
        m = med(vs)
        rows.append((s, len(vs), m))
        print(f"  {label:<12} {len(vs):>3}  {str(m):>7}  {hyp}")

    real = [r for r in rows if r[0] is not None]
    if len(real) < 2:
        print(f"\n只有 {len(real)} 个正式 prompt 版本——版本对比要等你改出下一版才有得比。")
        print("现在的重点：跑 analyze-content.py 看内容特征，据此提第一版改动。")
        return

    print("\n## 相邻版本判决")
    for (s0, n0, m0), (s1, n1, m1) in zip(real, real[1:]):
        if min(n0, n1) < MIN_TWEETS_PER_VERSION:
            print(f"  {s0}→{s1}: 样本不足（{n0} vs {n1}，需各 ≥{MIN_TWEETS_PER_VERSION}）— measuring")
            continue
        if not m0:
            continue
        d = (m1 - m0) / m0
        verdict = "✅ keep" if d >= args.threshold else "❌ rollback" if d <= -args.threshold else "➖ flat"
        print(f"  {s0}→{s1}: {m0} → {m1}  Δ {d:+.0%}  => {verdict}")


if __name__ == "__main__":
    main()
