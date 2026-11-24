#!/usr/bin/env python3
"""采集一只美股最近的公司事件（8-K 临时公告），给「最近表现」一章把大波动日和公告对上。

    scripts/fetch_events.py NVDA      →  <根>/books/NVDA/data/events.json

每条事件只有日期、公告类别（由 8-K 的 Item 编号翻成中文）和原文链接。
类别是机械翻译出来的；要写具体发生了什么，在 book.json 的 event_notes 里按日期手写一句
（只写已经过审的章节里核实过的事实）。
"""
import datetime, json, os, sys, time, urllib.request
from pathlib import Path

# 工作根目录：书稿在 <根>/books/<TICKER>/，渲染结果在 <根>/out/books/<TICKER>/。
# 缺省是当前目录；服务器上由运行手册设 BEACON_BOOK_ROOT。
ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()
_ua_file = Path.home() / ".beacon-signing/sec-user-agent"
UA = (os.environ.get("SEC_USER_AGENT") or (_ua_file.read_text() if _ua_file.exists() else "")).strip()
if not UA:
    sys.exit("缺少 SEC_USER_AGENT：需要一行「名称 邮箱」")

ITEMS = {
    "1.01": "签订重大协议", "1.02": "终止重大协议", "1.03": "破产或接管",
    "2.01": "完成收购或出售资产", "2.02": "发布财报", "2.03": "新增债务或表外安排", "2.04": "债务加速到期",
    "2.05": "重组或裁员", "2.06": "资产减值",
    "3.01": "收到退市或不合规通知", "3.02": "未注册的股票发行", "3.03": "股东权利变更",
    "4.01": "更换审计师", "4.02": "以前的财报不能再信赖",
    "5.01": "控制权变更", "5.02": "董事或高管变动", "5.03": "修改章程", "5.07": "股东大会表决结果",
    "7.01": "监管披露", "8.01": "其他重要事件",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    time.sleep(0.25)
    return data


def main():
    ticker = sys.argv[1].upper()
    cik = next(str(v["cik_str"]).zfill(10) for v in get("https://www.sec.gov/files/company_tickers.json").values()
               if v["ticker"] == ticker)
    recent = get(f"https://data.sec.gov/submissions/CIK{cik}.json")["filings"]["recent"]
    filings = [dict(zip(recent.keys(), vals)) for vals in zip(*recent.values())]
    since = (datetime.date.today() - datetime.timedelta(days=550)).isoformat()
    events = []
    for f in filings:
        if f["form"] != "8-K" or f["filingDate"] < since:
            continue
        items = [i.strip() for i in (f.get("items") or "").split(",") if i.strip() and i.strip() != "9.01"]
        events.append({
            "date": f["filingDate"], "event_date": f.get("reportDate") or f["filingDate"],
            "items": items, "label": "、".join(ITEMS.get(i, f"8-K Item {i}") for i in items) or "临时公告",
            "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{f['accessionNumber'].replace('-', '')}/{f['primaryDocument']}",
        })
    out = ROOT / "books" / ticker / "data" / "events.json"
    out.write_text(json.dumps({"ticker": ticker, "collected_at": datetime.date.today().isoformat(),
                               "source": "SEC EDGAR 8-K", "events": events}, ensure_ascii=False, indent=1))
    print(f"{ticker}: {len(events)} 条 8-K 事件（{since} 起）")
    for e in events[:8]:
        print("  ", e["date"], e["event_date"], e["label"])


if __name__ == "__main__":
    main()
