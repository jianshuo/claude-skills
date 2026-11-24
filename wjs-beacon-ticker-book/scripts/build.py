#!/usr/bin/env python3
"""把一本股票书渲染成静态网页：<根>/books/<TICKER>/ → <根>/out/books/<TICKER>/

    scripts/build.py NVDA            只渲染过审的章节（reviews/NN.json 的 verdict 为 pass）
    scripts/build.py NVDA --draft    没过审的也渲染出来，页首标「未过审」，自己预览用
    scripts/build.py NVDA --status   只列每章状态，不渲染

渲染完用 scripts/upload.py 发布。除了网页，还会写两个小文件给 app 和代理用：
    meta.json      书目信息（书名、章数、数据截至），代理据此列出「已有分析」
    progress.json  写作进度（该写几章、过审几章），代理据此判断一本书写完没有

排版借自 VoiceDrop 写书的模板：暖米纸底、宋体标题、720px 阅读栏、单一强调色，零外部资源。
体检表（第 0 章）不靠写：从各章 notes/NN.json 自动汇总。
"""
import html, json, os, re, sys
from pathlib import Path

# 工作根目录：书稿在 <根>/books/<TICKER>/，渲染结果在 <根>/out/books/<TICKER>/。
# 缺省是当前目录；服务器上由运行手册设 BEACON_BOOK_ROOT。
ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()

VERDICT = {"pass": ("过", "ok"), "watch": ("盯着", "watch"), "fail": ("不过", "bad"), "unknown": ("看不懂", "unk")}
KIND = {"written": "", "live": "实时", "summary": "自动汇总"}
LIVE = Path(__file__).resolve().parents[1] / "live"   # 实时章节的模板，在 skill 的 live/ 下

CSS = """
:root{--paper:#f3eee3;--panel:#faf6ec;--ink:#3b352b;--muted:#8a8172;--line:#e4dccb;
  --accent:%(dark)s;--tint:%(tint)s;--up:#cc4238;--down:#298f66;
  --serif:"Songti SC","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif;
  --sans:"PingFang SC","Hiragino Sans GB","Helvetica Neue",-apple-system,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.85;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:38px 22px 96px}
a{color:var(--accent);text-decoration:none}
.crumb{font-size:13px;color:var(--muted);letter-spacing:.5px}
h1{font-family:var(--serif);font-weight:600;font-size:32px;line-height:1.35;margin:10px 0 6px}
.sub{color:var(--muted);margin:0 0 6px}.tag{font-size:13px;color:var(--muted)}
.q{font-family:var(--serif);font-size:19px;color:var(--accent);margin:14px 0 26px}
.banner{margin:18px 0;padding:12px 16px;border-radius:12px;background:#f6e3df;border:1px solid #e7c4bd;font-size:14.5px}
.disc{margin:22px 0;padding:14px 18px;border-radius:12px;background:var(--panel);border:1px solid var(--line);
  font-size:14.5px;color:var(--muted)}
.toc{margin-top:26px}.toc h3{font-size:12px;letter-spacing:2px;color:var(--muted);margin:26px 0 8px;font-weight:600}
.row{display:flex;gap:14px;align-items:baseline;padding:12px 10px;border-bottom:1px solid var(--line);color:inherit}
a.row:hover{background:var(--tint);border-radius:10px}
.row .no{font-family:var(--serif);color:var(--accent);min-width:28px}
.row .t{flex:1}.row .t b{font-family:var(--serif);font-weight:600;font-size:17px}
.row .t span{display:block;font-size:14px;color:var(--muted);line-height:1.6}
.row.off{opacity:.55}.pill{font-size:12px;padding:2px 9px;border-radius:999px;background:var(--tint);color:var(--accent);white-space:nowrap}
article h2{font-family:var(--serif);font-weight:600;font-size:23px;margin:36px 0 12px;line-height:1.45}
article h3{font-family:var(--serif);font-weight:600;font-size:18px;margin:26px 0 8px;color:var(--accent)}
article p{margin:14px 0}article strong{color:var(--accent);font-weight:600}
article blockquote{margin:20px 0;padding:12px 18px;border-left:3px solid var(--accent);background:var(--panel);
  border-radius:0 12px 12px 0;font-family:var(--serif)}
article blockquote p{margin:6px 0}
article code{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:.9em;background:var(--tint);padding:1px 6px;border-radius:6px}
article table{display:block;max-width:100%%;overflow-x:auto;border-collapse:collapse;margin:20px 0;font-size:15px;
  font-variant-numeric:tabular-nums}
article th,article td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
article th:first-child,article td:first-child{text-align:left}
article th{font-weight:600;color:var(--accent);background:var(--tint)}
.plain{background:var(--tint);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:18px 0}
.plain::before{content:"大白话";display:inline-block;font-size:11px;letter-spacing:1px;color:var(--accent);font-weight:600}
.plain p{margin:4px 0;font-size:15.5px}
.note{background:var(--panel);border:1px solid var(--accent);border-radius:12px;padding:14px 18px;margin:30px 0 18px}
.note::before{content:"本章笔记";display:block;font-size:11px;letter-spacing:1px;color:var(--accent);font-weight:600;margin-bottom:2px}
.note p{margin:4px 0;font-family:var(--serif);font-size:17.5px}
dfn{font-style:normal;border-bottom:1px dashed var(--accent)}
small.src{font-size:12.5px;color:var(--muted)}
mark.unsourced{background:#f6e3df;color:#a8483a;font-size:12.5px;padding:1px 6px;border-radius:6px}
.nav{display:flex;gap:12px;margin-top:44px}
.nav a{flex:1;padding:14px 16px;border-radius:12px;background:var(--panel);border:1px solid var(--line);color:inherit;font-size:14.5px}
.nav a b{display:block;font-family:var(--serif);font-size:16px;color:var(--ink)}.nav a.next{text-align:right}
.badge{display:inline-block;font-size:12.5px;padding:2px 10px;border-radius:999px;font-weight:600;white-space:nowrap}
.badge.ok{background:#dcefe5;color:#1f7a55}.badge.watch{background:#f5ead0;color:#96700f}
.badge.bad{background:#f6e3df;color:#a8483a}.badge.unk{background:#e9e4d8;color:#7a7263}
article table.check{display:table;width:100%%;table-layout:fixed}
.check th,.check td{white-space:normal;text-align:left;vertical-align:top;padding:10px 8px}
.check th:nth-child(1),.check td:nth-child(1){width:2.2em;color:var(--muted)}
.check th:nth-child(2),.check td:nth-child(2){width:27%%}
.check th:nth-child(4),.check td:nth-child(4){width:4.6em;text-align:right}
.check td:nth-child(2) a{font-family:var(--serif);font-weight:600;font-size:16px}
.check td:nth-child(2) small{display:block;line-height:1.5;margin-top:2px}
.check ul{margin:4px 0 0;padding-left:1.1em;font-size:13.5px;color:var(--muted)}
.up{color:var(--up)}.down{color:var(--down)}
.live-meta{font-size:13px;color:var(--muted);margin:22px 0 4px}.loading{color:var(--muted)}
.verdict{margin:14px 0 6px;padding:16px 20px;border-radius:14px;background:var(--panel);border:1px solid var(--accent)}
.verdict b{display:block;font-family:var(--serif);font-size:26px;color:var(--accent)}.verdict span{font-size:15px;color:var(--muted)}
article table.kv td:first-child{color:var(--muted);white-space:nowrap}
article table.kv td:nth-child(2){font-weight:600;white-space:nowrap}
article table.kv td:nth-child(3){text-align:left;white-space:normal;color:var(--muted);font-size:14px}
article table.wide{display:table;width:100%%}article table.wide th,article table.wide td{text-align:center}
article table.events td{white-space:normal;vertical-align:top}article table.events td:nth-child(-n+3){white-space:nowrap}article table.events td:nth-child(4){text-align:left;min-width:14em}
svg.chart{display:block;width:100%%;height:auto;margin:10px 0 2px;background:var(--panel);border:1px solid var(--line);border-radius:12px}
svg.chart .line{fill:none;stroke:var(--accent);stroke-width:2;vector-effect:non-scaling-stroke}
svg.chart .base{stroke:var(--muted);stroke-width:1;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}
svg.chart .earn{stroke:var(--muted);stroke-width:1;stroke-dasharray:2 4;vector-effect:non-scaling-stroke;opacity:.7}
svg.chart .dot{fill:#d9992a;stroke:var(--panel);stroke-width:1.5}svg.chart .now{fill:var(--accent)}
.axis{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
footer{margin-top:40px;font-size:13px;color:var(--muted)}
@media(max-width:520px){h1{font-size:27px}body{font-size:16.5px}}
"""


def page(book, title, body):
    css = CSS % {"dark": book.get("dark", "#48709e"), "tint": book.get("tint", "#ece4d2")}
    return (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
            f'<title>{html.escape(title)}</title><style>{css}</style></head><body><div class="wrap">{body}'
            f'<footer>{html.escape(book.get("disclaimer", ""))}<br>数据截至 {book.get("as_of", "")}。</footer></div></body></html>')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    draft, status_only = "--draft" in sys.argv, "--status" in sys.argv
    ticker = args[0].upper()
    src = ROOT / "books" / ticker
    out = ROOT / "out" / "books" / ticker
    book = json.loads((src / "book.json").read_text())

    def load(kind, no):
        p = src / kind / f"{no:02d}.{'html' if kind == 'chapters' else 'json'}"
        if not p.exists():
            return None
        return p.read_text() if kind == "chapters" else json.loads(p.read_text())

    # 每章状态：written 章要有正文且评审通过才算可发布
    state = {}
    for ch in book["chapters"]:
        no = ch["no"]
        if ch["kind"] == "written":
            body, review = load("chapters", no), load("reviews", no)
            verdict = (review or {}).get("verdict")
            state[no] = ("done" if body and verdict == "pass" else
                         "unreviewed" if body and not review else
                         "failed" if body else "planned")
        elif ch["kind"] == "summary":
            state[no] = "done"
        else:
            state[no] = "live" if (LIVE / f"{no:02d}.html").exists() else "pending"

    if status_only:
        for ch in book["chapters"]:
            r = load("reviews", ch["no"]) or {}
            print(f"{ch['no']:02d} {state[ch['no']]:<10} {ch['title']}  {r.get('scores', '')}")
        return

    out.mkdir(parents=True, exist_ok=True)
    for stale in out.glob("*.html"):   # 清掉上一次渲染留下的页面（例如草稿预览里没过审的章），只留这次生成的
        stale.unlink()
    visible = {no for no, s in state.items() if s in ("done", "live") or (draft and s in ("unreviewed", "failed"))}

    # 实时章节的配置：页面里的 BOOK 对象，和代理用来判断「这本书存在、同行是谁」的 live.json
    events = []
    ev_file = src / "data" / "events.json"
    if ev_file.exists():
        notes = book.get("event_notes", {})
        events = [{**e, "note": notes.get(e["date"])} for e in json.loads(ev_file.read_text())["events"]]
    live_cfg = {"ticker": ticker, "names": book.get("names", {}), "peers_note": book.get("peers_note", ""), "events": events}
    (out / "live.json").write_text(json.dumps({"ticker": ticker, "peers": book.get("peers", [])}))
    live_head = ("<script>const BOOK = " + json.dumps(live_cfg, ensure_ascii=False).replace("</", "<\\/") + ";\n"
                 + (LIVE / "common.js").read_text() + "</script>")

    def link(no):
        return f"{no:02d}.html"

    # ---- 体检表 ----
    rows = []
    for ch in book["chapters"]:
        if ch["kind"] == "live" and state[ch["no"]] == "live":
            rows.append(f'<tr><td>{ch["no"]:02d}</td><td><a href="{link(ch["no"])}">{html.escape(ch["title"])}</a><br>'
                        f'<small class="src">{html.escape(ch["question"])}</small></td>'
                        f'<td><small class="src">实时章节：打开时按当时的数据现算，结论见该章末尾</small></td>'
                        f'<td><span class="badge unk">实时</span></td></tr>')
            continue
        if ch["kind"] != "written":
            continue
        note = load("notes", ch["no"]) if ch["no"] in visible else None
        title = (f'<a href="{link(ch["no"])}">{html.escape(ch["title"])}</a>' if ch["no"] in visible else html.escape(ch["title"]))
        if note:
            label, cls = VERDICT.get(note.get("verdict"), VERDICT["unknown"])
            ev = "".join(f"<li>{html.escape(str(e))}</li>" for e in note.get("evidence", []))
            rows.append(f'<tr><td>{ch["no"]:02d}</td><td>{title}<br><small class="src">{html.escape(ch["question"])}</small></td>'
                        f'<td>{html.escape(note.get("answer", ""))}<ul>{ev}</ul></td><td><span class="badge {cls}">{label}</span></td></tr>')
        else:
            rows.append(f'<tr><td>{ch["no"]:02d}</td><td>{title}<br><small class="src">{html.escape(ch["question"])}</small></td>'
                        f'<td><small class="src">这一章还没有过审的内容</small></td><td><span class="badge unk">待写</span></td></tr>')
    summary = (f'<article><p>下面每一行是对应那一章末尾的结论。<strong>顺序就是方法</strong>：便宜的检查在前，昂贵的检查在后；'
               f'前面任何一项不过，后面就不必看了。</p>'
               f'<table class="check"><thead><tr><th>#</th><th>追问</th><th>一行结论与依据</th><th>结果</th></tr></thead>'
               f'<tbody>{"".join(rows)}</tbody></table>'
               f'<p><small class="src">「过」只表示这一项检查没发现问题，不是买入的理由。标「实时」的三章不靠写，由数据在你打开页面时直接生成。</small></p></article>')

    # ---- 各章 ----
    order = [c for c in book["chapters"] if c["no"] in visible]
    for i, ch in enumerate(order):
        no = ch["no"]
        body = (summary if ch["kind"] == "summary" else
                live_head + (LIVE / f"{no:02d}.html").read_text() if ch["kind"] == "live" else load("chapters", no))
        body = re.sub(r"(?is)^\s*<article[^>]*>|</article>\s*$", "", body.strip())
        banner = ""
        if state[no] in ("unreviewed", "failed"):
            banner = f'<div class="banner">这一章{"还没有经过独立评审" if state[no] == "unreviewed" else "没有通过独立评审"}，数字和结论可能有误。</div>'
        elif ch["kind"] == "written" and (load("reviews", no) or {}).get("caveat"):
            banner = f'<div class="banner">这一章有一处没有核实清楚：{html.escape(str(load("reviews", no)["caveat"]))}</div>'
        nav = '<div class="nav">'
        nav += (f'<a href="{link(order[i-1]["no"])}">上一章<b>{html.escape(order[i-1]["title"])}</b></a>' if i else '<a href="index.html">目录<b>回到目录</b></a>')
        nav += (f'<a class="next" href="{link(order[i+1]["no"])}">下一章<b>{html.escape(order[i+1]["title"])}</b></a>' if i + 1 < len(order) else '<a class="next" href="index.html">目录<b>回到目录</b></a>')
        nav += "</div>"
        content = (f'<div class="crumb"><a href="index.html">{html.escape(book["title"])}</a> · 第 {no} 章</div>'
                   f'<h1>{html.escape(ch["title"])}</h1><div class="q">{html.escape(ch["question"])}</div>{banner}'
                   f'<article>{body}</article>{nav}')
        (out / link(no)).write_text(page(book, f'{ch["title"]} — {book["title"]}', content))

    # ---- 目录 ----
    toc = ""
    for ch in book["chapters"]:
        no = ch["no"]
        pill = KIND.get(ch["kind"], "")
        if ch["kind"] == "written" and no not in visible:
            pill = "写作中"
        if ch["kind"] == "written" and no in visible and state[no] != "done":
            pill = "未过审"
        inner = (f'<span class="no">{no:02d}</span><span class="t"><b>{html.escape(ch["title"])}</b>'
                 f'<span>{html.escape(ch["question"])}</span></span>' + (f'<span class="pill">{pill}</span>' if pill else ""))
        if ch["kind"] == "live" and no not in visible:
            inner = inner.replace(">实时<", ">实时 · 待接入<")
        toc += (f'<a class="row" href="{link(no)}">{inner}</a>' if no in visible else f'<div class="row off">{inner}</div>')
    index = (f'<div class="crumb">{html.escape(book["ticker"])} · 股票书</div><h1>{html.escape(book["title"])}</h1>'
             f'<p class="sub">{html.escape(book["subtitle"])}</p><p class="tag">{html.escape(book["tagline"])}</p>'
             f'<div class="q">{html.escape(book["through_question"])}</div>'
             f'<div class="disc">{html.escape(book["disclaimer"])}</div><div class="toc"><h3>目录</h3>{toc}</div>')
    (out / "index.html").write_text(page(book, book["title"], index))
    # 书目信息和写作进度：代理读这两个文件（书目清单由代理汇总各书的 meta.json，不在这里生成）
    written = [c["no"] for c in book["chapters"] if c["kind"] == "written"]
    passed = [no for no in written if state[no] == "done"]
    (out / "meta.json").write_text(json.dumps({
        "ticker": ticker, "code": book.get("code", ""), "title": book["title"], "subtitle": book.get("subtitle", ""),
        "as_of": book.get("as_of", ""), "chapters": len(order), "url": f"https://beacon.jianshuo.dev/books/{ticker}/",
    }, ensure_ascii=False))
    (out / "progress.json").write_text(json.dumps({
        "ticker": ticker, "written_total": len(written), "written_done": len(passed),
        "pending": [no for no in written if no not in passed], "complete": len(passed) == len(written),
    }))

    done = sum(1 for s in state.values() if s == "done")
    live_n = sum(1 for s in state.values() if s == "live")
    print(f"{ticker}: 渲染 {len(order)} 章到 {out.relative_to(ROOT)}（过审 {done - 1} 章，实时 {live_n} 章，{'含未过审草稿' if draft else '仅过审'}）")


if __name__ == "__main__":
    main()
