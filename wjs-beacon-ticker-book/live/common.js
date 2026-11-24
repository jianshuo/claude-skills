// 实时章节共用的小工具。BOOK 由 build.py 注入：{ticker, names, peers_note, events}
const $ = (id) => document.getElementById(id);
const name = (t) => (BOOK.names && BOOK.names[t]) || t;
const fmt = {
  price: (v) => (v == null || !isFinite(v) ? "—" : v.toFixed(2)),
  pct: (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%"),
  plainPct: (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v * 100).toFixed(d) + "%"),
  x: (v) => (v == null || !isFinite(v) || v <= 0 ? "—" : v.toFixed(1) + " 倍"),
  int: (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-US")),
  // 金额（美元）或股数，换成 万 / 亿 / 万亿
  big: (v, unit = "") => {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e12) return s + (a / 1e12).toFixed(2) + " 万亿" + unit;
    if (a >= 1e8) return s + (a / 1e8).toFixed(a >= 1e10 ? 0 : 1) + " 亿" + unit;
    if (a >= 1e4) return s + (a / 1e4).toFixed(0) + " 万" + unit;
    return s + a.toFixed(0) + unit;
  },
  // ISO 时间 → 美东时间「11-24 10:08」
  et: (iso) => {
    if (!iso) return "";
    const p = new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
    const g = (t) => p.find((x) => x.type === t)?.value;
    return `${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
  },
};
const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
const session = (s) => ({ premarket: "盘前", postmarket: "盘后", regular: "盘中", closed: "已收盘" }[s] || "");
const median = (a) => { const s = a.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y); if (!s.length) return null;
  const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// v 在数组里排在百分之几（比它小的占多少）
const rank = (a, v) => { const s = a.filter((x) => x != null && isFinite(x)); return s.length ? s.filter((x) => x < v).length / s.length : null; };
const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);

async function load(chapter) {
  const r = await fetch(`/api/book/${BOOK.ticker}/${chapter}`, { cache: "no-store" });
  if (!r.ok) throw new Error("取数失败（" + r.status + "）");
  return r.json();
}
function stamp(d, quoteTime, sess) {
  $("stamp").textContent = `数据时间：美东 ${fmt.et(quoteTime || d.as_of)}${sess ? "（" + session(sess) + "）" : ""} · 打开页面时实时取数`;
}
function fail(e) {
  $("live").innerHTML = `<div class="banner">实时数据暂时取不到：${e.message}。稍后刷新再试。</div>`;
}
const table = (head, rows, klass = "") =>
  `<table class="${klass}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

// 折线小图。series: [数值…]；marks: [{i, kind}]；baseline: 画一条水平参考线
function lineChart(series, { height = 150, marks = [], baseline = null, labels = null } = {}) {
  const W = 680, H = height, pad = 6, pts = series.map((v, i) => [i, v]).filter((p) => p[1] != null && isFinite(p[1]));
  if (pts.length < 2) return "";
  const lo = Math.min(...pts.map((p) => p[1]), baseline ?? Infinity), hi = Math.max(...pts.map((p) => p[1]), baseline ?? -Infinity);
  const X = (i) => pad + (i / (series.length - 1)) * (W - 2 * pad), Y = (v) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">`;
  if (baseline != null) s += `<line x1="${pad}" x2="${W - pad}" y1="${Y(baseline)}" y2="${Y(baseline)}" class="base"/>`;
  for (const m of marks) if (m.kind === "earnings") s += `<line x1="${X(m.i)}" x2="${X(m.i)}" y1="${pad}" y2="${H - pad}" class="earn"/>`;
  s += `<polyline points="${pts.map((p) => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ")}" class="line"/>`;
  for (const m of marks) if (m.kind !== "earnings" && series[m.i] != null) s += `<circle cx="${X(m.i)}" cy="${Y(series[m.i])}" r="4.5" class="dot"/>`;
  const last = pts[pts.length - 1];
  s += `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" class="now"/></svg>`;
  if (labels) s += `<div class="axis"><span>${labels[0]}</span><span>${labels[1]}</span></div>`;
  return s;
}
