#!/usr/bin/env python3
"""取某只股票某个交易日的「当日事实」，给日报用。

    scripts/fetch_daily.py NVDA 2026-11-24

存成 <根>/books/NVDA/daily/2026-11-24.facts.json。数字全部由 Beacon 的代理从行情数据源汇总
（价格、成交量、和大盘及同行的对比、期权、暗池、卖空、新闻标题、公告、内部人申报），
写日报的人只能引用这份文件里的数字。

这一天休市或数据还没出来时，输出以 NO_TRADING 开头的一行，不写文件。

环境变量：
    BEACON_APP_KEY     取数口令（服务器上由调度服务注入；本机可放 ~/.beacon-signing/app-key）
    BEACON_BASE        缺省 https://beacon.jianshuo.dev
    BEACON_BOOK_ROOT   工作根目录，缺省当前目录
"""
import json, os, re, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()
BASE = os.environ.get("BEACON_BASE", "https://beacon.jianshuo.dev").rstrip("/")


def app_key():
    if os.environ.get("BEACON_APP_KEY"):
        return os.environ["BEACON_APP_KEY"].strip()
    f = Path.home() / ".beacon-signing" / "app-key"
    if f.exists():
        return f.read_text().strip()
    sys.exit("缺少 BEACON_APP_KEY，没法取数")


def main():
    if len(sys.argv) != 3 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", sys.argv[2]):
        sys.exit("用法：fetch_daily.py <TICKER> <YYYY-MM-DD>")
    ticker, date = sys.argv[1].upper(), sys.argv[2]
    src = ROOT / "books" / ticker
    if not (src / "book.json").exists():
        sys.exit(f"{src} 里没有 book.json：先有书，才有日报")

    req = urllib.request.Request(f"{BASE}/api/book/{ticker}/daily-facts?date={date}",
                                 headers={"X-Beacon-Key": app_key(), "User-Agent": "beacon-book-daily"})
    facts, err = None, ""
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                facts = json.load(r)
            break
        except urllib.error.HTTPError as e:
            err = f"{e.code} {e.read().decode(errors='replace')[:160]}"
            if e.code not in (429, 500, 502, 503, 504):
                break
        except Exception as e:  # 网络抖动
            err = repr(e)[:160]
        time.sleep(8 * (attempt + 1))
    if facts is None:
        sys.exit(f"取当日事实失败：{err}")

    if not facts.get("trading"):
        print(f"NO_TRADING {facts.get('reason', '这一天没有行情')}")
        return

    out = src / "daily"
    out.mkdir(exist_ok=True)
    (out / f"{date}.facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=1))
    p = facts["price"]
    print(f"{ticker} {date}: 收 {p['close']}（{p['change_pct']:+.2f}%），成交量是 20 日均量的 {p.get('volume_vs_avg20')} 倍；"
          f"新闻标题 {len(facts.get('news') or [])} 条，公告 {len(facts.get('filings') or [])} 份，"
          f"内部人申报 {len(facts.get('insiders') or [])} 笔 → daily/{date}.facts.json")


if __name__ == "__main__":
    main()
