#!/usr/bin/env python3
"""Build the <section> "上篇精选留言" footer HTML from picks + metadata.

Outputs ONE LINE of HTML (no newlines) — wjs-publishing-wechat's
upload-draft.sh treats raw HTML blocks as one block, splitting on blank lines.
"""
import argparse, json, sys, re

P_HEADER = '<p style="color:#888;font-size:14px;line-height:1.75;margin:0 0 14px;">'
P_RECAP  = '<p style="color:#999;font-size:13px;line-height:1.7;margin:0 0 14px;font-style:italic;">'
P_NAME   = '<p style="color:#888;font-size:14px;line-height:1.75;margin:0 0 4px;">'
P_BODY   = '<p style="color:#888;font-size:14px;line-height:1.75;margin:0 0 14px;">'
P_LAST   = '<p style="color:#888;font-size:14px;line-height:1.75;margin:0;">'
STRONG   = '<strong style="color:#777;">'
SECTION_OPEN = '<section style="background:#f7f5f0;padding:20px 22px;border-radius:8px;margin-top:32px;">'

def esc(s: str) -> str:
    """Minimal HTML escape — keep curly quotes and Chinese punctuation as-is."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def strip_emoji(s: str) -> str:
    """Strip emoji and zero-width chars that look out of place in a gray-on-beige footer."""
    # Common emoji ranges + variation selectors + ZWJ
    pattern = re.compile(
        "[\U0001F300-\U0001FAFF\U00002600-\U000027BF️‍]+",
        flags=re.UNICODE,
    )
    return pattern.sub("", s).strip()

def fmt_byline(pick: dict) -> str:
    name = esc(pick["nick_name"])
    parts = []
    if pick.get("location"):
        parts.append(esc(pick["location"]))
    likes = pick.get("like_num") or 0
    if likes >= 3:
        parts.append(f"\U0001F44D {likes}")
    if parts:
        return f"{name}（{' · '.join(parts)}）"
    return name

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prev-title", required=True)
    ap.add_argument("--prev-url", required=True)
    ap.add_argument("--recap", required=True, help="1-sentence recap of the previous article's question/claim")
    ap.add_argument("--total-count", type=int, required=True, help="total comment count on the previous article")
    ap.add_argument("--picks-json", required=True, help="path to picks.json (list of {nick_name, location, like_num, content})")
    ap.add_argument("--closing", default="谢谢每一位留言的朋友——下一篇我接着从你们的留言里找钥匙。")
    ap.add_argument("--out", required=True, help="output path for the HTML block")
    args = ap.parse_args()

    picks = json.load(open(args.picks_json))
    if not (1 <= len(picks) <= 5):
        sys.exit(f"error: expected 1-5 picks, got {len(picks)}")

    chunks = [SECTION_OPEN]
    # Header line
    title_link = f'<a href="{esc(args.prev_url)}" style="color:#888;text-decoration:underline;">{esc(args.prev_title)}</a>'
    chunks.append(f'{P_HEADER}{STRONG}上篇精选留言 ·《{title_link}》</strong></p>')
    # Recap
    chunks.append(f'{P_RECAP}{esc(args.recap)}</p>')
    # Lead-in
    n = len(picks)
    chunks.append(f'{P_HEADER}{args.total_count} 条留言里，最值得分享的 {n} 条——</p>')
    # 5 entries
    for pick in picks:
        byline = fmt_byline(pick)
        content = esc(strip_emoji(pick["content"]).strip())
        chunks.append(f'{P_NAME}{STRONG}{byline}</strong></p>')
        chunks.append(f'{P_BODY}{content}</p>')
    # Closing
    chunks.append(f'{P_LAST}{esc(args.closing)}</p>')
    chunks.append('</section>')

    html = "".join(chunks)
    with open(args.out, "w") as f:
        f.write(html)
    print(f"wrote {args.out} ({len(html)} chars)")

if __name__ == "__main__":
    main()
