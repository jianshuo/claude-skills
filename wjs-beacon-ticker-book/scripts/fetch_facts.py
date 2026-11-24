#!/usr/bin/env python3
"""给一只美股采集「事实档案」，写书前必须先跑。写手只许引用这里面的数字，评审按它核对。

    scripts/fetch_facts.py NVDA

产出 books/<TICKER>/data/：
    facts.json        结构化事实：公司身份、近年年度与季度关键财务、最新报价、文件清单（每项带来源和日期）
    10k-business.txt  最新年报「业务描述」(Item 1) 原文
    10k-risk.txt      最新年报「风险因素」(Item 1A) 原文
    10k-mdna.txt      最新年报「管理层讨论与分析」(Item 7) 原文
    10q-mdna.txt      最新季报的管理层讨论原文
    proxy.txt         最新委托书 (DEF 14A) 原文（高管持股、薪酬）

数据源：美国证监会 EDGAR（监管披露，免费）；实时报价来自 beacon.jianshuo.dev 的 UW 代理。

环境变量（服务器上由调度服务注入；本机可改用 ~/.beacon-signing/ 下的同名文件）：
    SEC_USER_AGENT   EDGAR 要求的「名称 邮箱」，没有会被 403
    BEACON_APP_KEY   取实时报价用，可缺省（缺了档案里就没有报价）
    BEACON_BOOK_ROOT 工作根目录，缺省当前目录

不提交 10-K 的公司（多数外国公司交的是 20-F）目前写不了：以「NO_10K」开头报错退出。
"""
import datetime, html, json, os, re, sys, time, urllib.request
from pathlib import Path

# 工作根目录：书稿在 <根>/books/<TICKER>/，渲染结果在 <根>/out/books/<TICKER>/。
# 缺省是当前目录；服务器上由运行手册设 BEACON_BOOK_ROOT。
ROOT = Path(os.environ.get("BEACON_BOOK_ROOT") or os.getcwd()).resolve()


def secret(env_name, file_name):
    """密钥先看环境变量，再看本机 ~/.beacon-signing/ 下的文件；都没有返回 None。绝不写进 skill。"""
    if os.environ.get(env_name):
        return os.environ[env_name].strip()
    f = Path.home() / ".beacon-signing" / file_name
    return f.read_text().strip() if f.exists() else None


# EDGAR 要求自动程序声明身份并留联系邮箱（"名称 邮箱"），否则 403。
UA = secret("SEC_USER_AGENT", "sec-user-agent")
if not UA:
    sys.exit("缺少 SEC_USER_AGENT：需要一行「名称 邮箱」，例如 Beacon research you@example.com")


def get(url, raw=False, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    time.sleep(0.25)   # EDGAR 限速：每秒不超过 10 次
    return data if raw else json.loads(data)


def html_to_text(raw: bytes) -> str:
    s = raw.decode("utf-8", errors="replace")
    s = re.sub(r"(?is)<(script|style|ix:header)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<(br|/p|/div|/tr|/h\d|/li)[^>]*>", "\n", s)
    s = re.sub(r"(?i)</t[dh]>", " | ", s)
    s = html.unescape(re.sub(r"<[^>]+>", "", s)).replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n\n", s).strip()


def section(text: str, start_pat: str, end_pat: str) -> str:
    """取年报里某个 Item：目录里也有同名标题，所以取所有匹配里最长的那一段。"""
    best = ""
    for m in re.finditer(start_pat, text, flags=re.I):
        e = re.search(end_pat, text[m.end():], flags=re.I)
        chunk = text[m.start(): m.end() + e.start()] if e else ""
        if len(chunk) > len(best):
            best = chunk
    return best.strip()


def series(facts, tags, unit="USD"):
    """从 companyfacts 取一个指标的全部申报值（多个候选标签按顺序合并，同一期间取最新申报）。"""
    out = {}
    for tag in tags:
        node = facts.get("us-gaap", {}).get(tag) or facts.get("dei", {}).get(tag)
        if not node:
            continue
        for u, rows in node.get("units", {}).items():
            if u != unit:
                continue
            for r in rows:
                key = (r.get("start"), r["end"])
                if key not in out or r["filed"] > out[key]["filed"]:
                    out[key] = {**r, "tag": tag}
    return out


def pick(rows, annual: bool, year_ends=None):
    """年度 = 期间约一年；季度 = 约三个月。时点值（资产负债表）没有 start：
    年度只收落在财年期末日的，季度全收。"""
    res = {}
    for (start, end), r in rows.items():
        if start:
            days = (datetime.date.fromisoformat(end) - datetime.date.fromisoformat(start)).days
            ok = 350 <= days <= 380 if annual else 80 <= days <= 100
        else:
            ok = (end in (year_ends or ())) if annual else True
        if ok:
            res[end] = r
    return res


def main():
    ticker = sys.argv[1].upper()
    out = ROOT / "books" / ticker / "data"
    out.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()

    cik = next((str(v["cik_str"]).zfill(10) for v in get("https://www.sec.gov/files/company_tickers.json").values()
                if v["ticker"] == ticker), None)
    if not cik:
        sys.exit(f"NO_10K: 在美国证监会的公司名单里找不到 {ticker}")
    sub = get(f"https://data.sec.gov/submissions/CIK{cik}.json")
    recent = sub["filings"]["recent"]
    filings = [dict(zip(recent.keys(), vals)) for vals in zip(*recent.values())]

    def latest(form):
        return next((f for f in filings if f["form"] == form), None)

    if not latest("10-K"):
        sys.exit(f"NO_10K: {sub['name']} 没有提交过 10-K 年报（多数外国公司交的是 20-F），目前写不了")

    def doc_url(f):
        return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{f['accessionNumber'].replace('-', '')}/{f['primaryDocument']}"

    # ---- 结构化财务 ----
    cf = get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json")["facts"]
    metrics = {
        "revenue": (["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], "USD"),
        "cost_of_revenue": (["CostOfRevenue", "CostOfGoodsAndServicesSold"], "USD"),
        "gross_profit": (["GrossProfit"], "USD"),
        "rnd": (["ResearchAndDevelopmentExpense"], "USD"),
        "sga": (["SellingGeneralAndAdministrativeExpense"], "USD"),
        "operating_income": (["OperatingIncomeLoss"], "USD"),
        "net_income": (["NetIncomeLoss"], "USD"),
        "eps_diluted": (["EarningsPerShareDiluted"], "USD/shares"),
        "operating_cash_flow": (["NetCashProvidedByUsedInOperatingActivities"], "USD"),
        "capex": (["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"], "USD"),
        "buybacks": (["PaymentsForRepurchaseOfCommonStock"], "USD"),
        "dividends_paid": (["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"], "USD"),
        "stock_comp": (["ShareBasedCompensation"], "USD"),
        "interest_expense": (["InterestExpense", "InterestExpenseNonoperating"], "USD"),
        "cash": (["CashAndCashEquivalentsAtCarryingValue"], "USD"),
        "marketable_securities": (["MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"], "USD"),
        "inventory": (["InventoryNet"], "USD"),
        "receivables": (["AccountsReceivableNetCurrent"], "USD"),
        "total_assets": (["Assets"], "USD"),
        "total_liabilities": (["Liabilities"], "USD"),
        "long_term_debt": (["LongTermDebtNoncurrent", "LongTermDebt"], "USD"),
        "short_term_debt": (["DebtCurrent", "LongTermDebtCurrent"], "USD"),
        "equity": (["StockholdersEquity"], "USD"),
        "shares_outstanding": (["EntityCommonStockSharesOutstanding"], "shares"),
    }
    annual, quarterly = {}, {}
    # 股本是封面页上的时点数（日期是申报前几周，不是财报期末），单独成一列，不混进期间数据
    shares = [{"as_of": end, "value": r["val"], "form": r["form"], "filed": r["filed"]}
              for (_, end), r in sorted(series(cf, *metrics.pop("shares_outstanding")).items(), key=lambda kv: kv[0][1])][-8:]
    year_ends = set(pick(series(cf, *metrics["revenue"]), True))
    for name, (tags, unit) in metrics.items():
        rows = series(cf, tags, unit)
        for bucket, is_annual, keep in ((annual, True, 6), (quarterly, False, 9)):
            picked = pick(rows, is_annual, year_ends)
            for end in sorted(picked)[-keep:]:
                r = picked[end]
                bucket.setdefault(end, {})[name] = {
                    "value": r["val"], "form": r["form"], "filed": r["filed"], "fiscal": f"FY{r.get('fy')} {r.get('fp')}", "tag": r["tag"]}

    # ---- 实时报价（UW 代理）----
    quote = None
    app_key = secret("BEACON_APP_KEY", "app-key")
    if app_key:
        try:
            q = get(f"https://beacon.jianshuo.dev/api/us/quotes?symbols={ticker}", headers={"X-Beacon-Key": app_key})
            quote = q["data"].get(ticker)
        except Exception as e:   # 报价拿不到不影响档案其它部分
            quote = {"error": str(e)}

    # ---- 文件原文 ----
    files = {}
    k10, q10, proxy = latest("10-K"), latest("10-Q"), latest("DEF 14A")
    if k10:
        text = html_to_text(get(doc_url(k10), raw=True))
        parts = {
            "10k-business.txt": section(text, r"\n\s*Item\s+1\.?\s*Business", r"\n\s*Item\s+1A\.?\s*Risk\s+Factors"),
            "10k-risk.txt": section(text, r"\n\s*Item\s+1A\.?\s*Risk\s+Factors", r"\n\s*Item\s+1B\.?"),
            "10k-mdna.txt": section(text, r"\n\s*Item\s+7\.?\s*Management.s\s+Discussion", r"\n\s*Item\s+7A\.?"),
        }
        (out / "10k-full.txt").write_text(text)
        for name, body in parts.items():
            (out / name).write_text(body)
            files[name] = {"chars": len(body), "source": doc_url(k10), "form": "10-K", "filed": k10["filingDate"], "period": k10["reportDate"]}
    if q10:
        text = html_to_text(get(doc_url(q10), raw=True))
        body = section(text, r"\n\s*Item\s+2\.?\s*Management.s\s+Discussion", r"\n\s*Item\s+3\.?")
        (out / "10q-full.txt").write_text(text)
        (out / "10q-mdna.txt").write_text(body)
        files["10q-mdna.txt"] = {"chars": len(body), "source": doc_url(q10), "form": "10-Q", "filed": q10["filingDate"], "period": q10["reportDate"]}
    for i, f in enumerate([f for f in filings if f["form"] == "8-K"][:4]):
        base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{f['accessionNumber'].replace('-', '')}"
        texts = [html_to_text(get(doc_url(f), raw=True))]
        try:   # 新闻稿在附件 EX-99.x 里
            for item in get(base + "/index.json")["directory"]["item"]:
                n = item["name"].lower()
                if n.endswith(".htm") and n != f["primaryDocument"].lower() and "index" not in n:
                    texts.append(f"\n\n===== 附件 {item['name']} =====\n" + html_to_text(get(f"{base}/{item['name']}", raw=True)))
        except Exception:
            pass
        name = f"8k-{f['filingDate']}.txt"
        (out / name).write_text("\n".join(texts))
        files[name] = {"chars": sum(map(len, texts)), "source": doc_url(f), "form": "8-K", "filed": f["filingDate"],
                       "items": f.get("items", "")}
    if proxy:
        body = html_to_text(get(doc_url(proxy), raw=True))
        (out / "proxy.txt").write_text(body)
        files["proxy.txt"] = {"chars": len(body), "source": doc_url(proxy), "form": "DEF 14A", "filed": proxy["filingDate"]}

    facts = {
        "_说明": "事实档案。写手只许引用这里和同目录原文里的数字，引用时带上 form 和 filed；这里没有的数字一律标 [未核实]。",
        "collected_at": today,
        "identity": {
            "ticker": ticker, "name": sub["name"], "cik": cik, "exchanges": sub.get("exchanges"),
            "sic": sub.get("sic"), "sic_description": sub.get("sicDescription"),
            "fiscal_year_end": sub.get("fiscalYearEnd"), "state_of_incorporation": sub.get("stateOfIncorporation"),
            "address": (sub.get("addresses", {}).get("business") or {}), "website": sub.get("website"),
            "source": f"SEC EDGAR submissions CIK{cik}",
        },
        "quote": {"data": quote, "source": "Unusual Whales via beacon.jianshuo.dev", "as_of": today},
        "_财务说明": ("annual 的 key 是财年期末日；quarterly 的 key 是季度期末日。金额单位美元。"
                  "季度的现金流量项在申报里是年初至今累计数，这里只收了恰为三个月的那几期，所以二、三季度可能缺。"
                  "第四季度没有单独的 10-Q，要用全年减前三季。"
                  "EPS 是各份文件当时申报的原值，没有按拆股调整，跨拆股年份不能直接比。"),
        "shares_outstanding": shares,
        "annual": dict(sorted(annual.items())),
        "quarterly": dict(sorted(quarterly.items())),
        "files": files,
        "recent_filings": [{k: f[k] for k in ("form", "filingDate", "reportDate", "primaryDocDescription")} | {"url": doc_url(f)}
                           for f in filings[:400] if f["form"] in ("10-K", "10-Q", "8-K", "DEF 14A", "4", "SC 13G", "SC 13G/A")][:60],
    }
    (out / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=1))
    print(f"{ticker}: {sub['name']}  CIK {cik}")
    print("年度期间:", ", ".join(sorted(annual)))
    print("季度期间:", ", ".join(sorted(quarterly)))
    for name, meta in files.items():
        print(f"  {name}: {meta['chars']} 字符  {meta['form']} filed {meta['filed']}")
    print("报价:", quote)


if __name__ == "__main__":
    main()
