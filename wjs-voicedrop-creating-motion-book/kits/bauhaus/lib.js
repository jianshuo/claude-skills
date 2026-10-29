// 画风套件 bauhaus（配方 huashu-art-motion 12_bauhaus「1923 包豪斯海报」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：旧纸米白＋颗粒＋一条贯穿斜线；只有红黄蓝黑奶白五色；形状只有圆/方/三角/粗杆；粗黑框柜子格子是贯穿物；
//       人是施莱默人偶（圆头、黑竖条眼、金色扇形发、蓝梯形躯干、黑扇裙、粗杆四肢＋米白圆盘关节），不画写实脸、不画 Q 版；
//       无渐变、无描边外发光；动态＝弹入（backOut）、滑入、按进度画线，不做沸腾。每章用 K.bg 的 tint 换一个主色块，补色域窄。
//       字：标题 PuHui-Black / PuHui-Heavy，数字用 Poppins-800（引擎自带），字幕 PuHui-Bold；最小字号 44，标签 ≥52。
// 坐标：y 200–1350 画主体；y 1380–1560 字幕带不放东西；所有随机走 U.hash / U.rng。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = K.C = {
  paper: '#ebe3cf', paper2: '#e0d6bc', ink: '#161514', red: '#d3262b', yel: '#efc12f', blue: '#2a58b4', cream: '#f2ecdf', white: '#faf6ec',
  grey: '#c6c3bb', lblue: '#b9cee0', redDk: '#a81c21', yelDk: '#c99a14', blueDk: '#1f4290', pinkWash: 'rgba(211,38,43,.14)', blueWash: 'rgba(42,88,180,.14)', yelWash: 'rgba(239,193,47,.28)',
};
C.yellow = C.yel;
const INK = C.ink, RED = C.red, YEL = C.yel, BLUE = C.blue, CREAM = C.cream, PAPER = C.paper;
K.TINTS = { red: RED, blue: BLUE, yellow: YEL, yel: YEL, ink: INK, cream: CREAM };
const tintCol = t => K.TINTS[t] || t || null;
// 浅色底上用深字，深色底上用奶白字
const onCol = f => ([YEL, CREAM, PAPER, C.white, C.grey, C.lblue, C.paper2].includes(f) ? INK : CREAM);

K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);

// ============ 几何基元 ============
// 通用 o：{ alpha, scale（绕中心）, rot（弧度，绕中心）, line（黑边宽，默认 0）}。尺寸为负或 0 时什么也不画。
const wrap = (c, cx, cy, o, fn) => { c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(cx, cy); if (o.rot) c.rotate(o.rot); if (o.scale != null && o.scale !== 1) c.scale(Math.max(0, o.scale), Math.max(0, o.scale)); fn(); c.restore(); };
const edge = (c, o) => { if (o.line > 0) { c.strokeStyle = INK; c.lineWidth = o.line; c.lineJoin = 'miter'; c.stroke(); } };
// 矩形：(x,y) 左上角
K.rect = (c, x, y, w, h, col = INK, o = {}) => { if (w <= 0 || h <= 0) return; wrap(c, x + w / 2, y + h / 2, o, () => { c.fillStyle = col; c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.fill(); edge(c, o); }); };
// 圆：(x,y) 圆心。o.half：'top'|'bottom'|'left'|'right' 画半圆；o.ring 画环（宽度）
K.disc = (c, x, y, r, col = RED, o = {}) => { if (r <= 0) return; wrap(c, x, y, o, () => { c.fillStyle = col; c.beginPath();
  if (o.half) { const a = { top: [Math.PI, TAU], bottom: [0, Math.PI], left: [Math.PI / 2, Math.PI * 1.5], right: [-Math.PI / 2, Math.PI / 2] }[o.half]; c.arc(0, 0, r, a[0], a[1]); c.closePath(); } else c.arc(0, 0, r, 0, TAU);
  if (o.ring) { c.strokeStyle = col; c.lineWidth = o.ring; c.beginPath(); c.arc(0, 0, r - o.ring / 2, 0, TAU); c.stroke(); } else c.fill(); edge(c, o); }); };
// 等腰三角：(x,y) 包围盒中心，w 底宽、h 高，默认尖朝上；o.flip 尖朝下；o.right 直角三角（直角在左下）
K.tri = (c, x, y, w, h, col = YEL, o = {}) => { if (w <= 0 || h <= 0) return; wrap(c, x, y, o, () => { c.fillStyle = col; c.beginPath(); const f = o.flip ? -1 : 1;
  if (o.right) { c.moveTo(-w / 2, h / 2 * f); c.lineTo(w / 2, h / 2 * f); c.lineTo(-w / 2, -h / 2 * f); } else { c.moveTo(-w / 2, h / 2 * f); c.lineTo(w / 2, h / 2 * f); c.lineTo(0, -h / 2 * f); }
  c.closePath(); c.fill(); edge(c, o); }); };
// 粗杆：(x1,y1)→(x2,y2)，宽 w（平头）。o.p 画出进度 0..1
K.bar = (c, x1, y1, x2, y2, w = 16, col = INK, o = {}) => { const p = o.p ?? 1; if (p <= 0 || w <= 0) return; c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.strokeStyle = col; c.lineWidth = w; c.lineCap = o.cap || 'butt';
  if (o.dash) c.setLineDash(o.dash); c.beginPath(); c.moveTo(x1, y1); c.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); c.stroke(); c.restore(); };

// ============ 文字 ============
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot }
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = INK, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—（'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标签：直角牌＋粗黑边＋硬投影块。字号至少 52。o: { size, fam, fill, col, scale, alpha, shadow, rot, padX, align 'center'|'left', line }。返回牌宽
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 52), { fam = 'PuHui-Heavy', fill = CREAM, scale = 1, alpha = 1, shadow = true, rot = 0, padX = 0.55, align = 'center', line = 6 } = o, col = o.col || onCol(fill);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(Math.max(0, scale), Math.max(0, scale)); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.5, x0 = align === 'left' ? 0 : -w / 2;
  if (shadow) { c.fillStyle = INK; c.fillRect(x0 + 9, -h / 2 + 9, w, h); }
  c.fillStyle = fill; c.fillRect(x0, -h / 2, w, h); if (line) { c.strokeStyle = INK; c.lineWidth = line; c.lineJoin = 'miter'; c.strokeRect(x0, -h / 2, w, h); }
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x0 + w / 2, 3); c.restore(); return w; };
// 弹出的大字/数字（backOut 过冲）；o.plate 时带标签牌（o.fill 牌色）
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：黑粗线先画出来（末端黑方点），再弹出标签牌逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = YEL, col, size = 52 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  K.bar(c, ax, ay, bx, by, 7, INK, { p: p1 }); const d = 11 * Math.min(1, p1 * 3); c.fillStyle = INK; c.fillRect(ax - d, ay - d, 2 * d, 2 * d);
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${Math.max(52, size)}px "PuHui-Heavy"`; const full = c.measureText(s).width; c.restore();
  K.tag(c, shown, bx - full / 2 - Math.max(52, size) * 0.55, by, { size, fill, col, scale: q, align: 'left', padX: 0.55, ...(o.rot ? { rot: o.rot } : {}) }); };

// ============ 底 ============
const paperTex = () => P.cached('bh_paper', W, H, g => { g.fillStyle = PAPER; g.fillRect(0, 0, W, H); const r = U.rng(7);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,100,70,.10)' : 'rgba(255,255,255,.18)'; const s = 2 + r() * 5; g.fillRect(r() * W, r() * H, s, s); }
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(22,21,20,.10)'; const s = 3 + r() * 3; g.fillRect(r() * W, r() * H, s, s); } });
// 主色块的六种版式（避开中央主体：都贴边、出画）。用 o.layout 指定，缺省按 seed 轮换
const LAYOUTS = [
  (c, col) => { K.disc(c, 940, 130, 330, col); K.rect(c, 0, 0, 90, 1340, INK); },                 // 0 右上大圆＋左黑竖条
  (c, col) => { K.rect(c, 0, 0, 120, 1343, col); K.rect(c, 120, 0, 14, 1343, INK); },            // 1 左侧通高色带
  (c, col) => { K.tri(c, 270, 1010, 540, 660, col, { right: true }); },                           // 2 左下大直角三角（落在地线上）
  (c, col) => { K.disc(c, 900, 1343, 330, col, { half: 'top' }); },                               // 3 右下半圆（落在地线上）
  (c, col) => { K.rect(c, 700, 0, 380, 330, col); K.disc(c, 700, 330, 60, INK); },                // 4 右上方块＋黑圆
  (c, col) => { K.rect(c, 0, 0, W, 170, col); },                                                   // 5 顶部通栏
];
// o: { tint 'red'|'blue'|'yellow'|'ink'|null 主色块（每章换一个主色）, layout 0..5, seed, floor 地线 y|false, line 贯穿斜线 true/false, decos 小几何个数(默认 3) }
K.bg = (c, t, o = {}) => {
  const { tint = null, seed = 1, floor = false, line = true, decos = 3 } = o, col = tintCol(tint);
  c.drawImage(paperTex(), 0, 0);
  if (col) LAYOUTS[(o.layout ?? seed) % LAYOUTS.length](c, col);
  if (floor) { K.rect(c, 40, floor, 1000, 14, INK); }
  if (line) K.bar(c, 0, 1640, W, 160, 3, 'rgba(22,21,20,.55)');
  const SLOTS = [[990, 1230, 'tri'], [80, 1430, 'sq'], [1000, 900, 'ring'], [980, 560, 'sq'], [60, 760, 'disc']], cols = [RED, YEL, BLUE];
  for (let i = 0; i < Math.min(decos, SLOTS.length); i++) { const [x, y, k] = SLOTS[(i + seed) % SLOTS.length], cc = cols[(i + seed) % 3] === col ? INK : cols[(i + seed) % 3];
    if (k === 'tri') K.tri(c, x, y, 44, 40, cc); else if (k === 'sq') K.rect(c, x - 20, y - 20, 40, 40, cc); else if (k === 'ring') K.disc(c, x, y, 24, cc, { ring: 8 }); else K.disc(c, x, y, 20, cc); }
};
// 收尾：四角很淡的旧纸压边＋字幕带压暗一档（让字幕黑板和画面分开）
K.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.42, 700, W / 2, H * 0.42, 1350); g.addColorStop(0, 'rgba(120,100,70,0)'); g.addColorStop(1, 'rgba(120,100,70,.12)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1360, 0, 1600); b.addColorStop(0, 'rgba(22,21,20,0)'); b.addColorStop(0.5, 'rgba(22,21,20,.10)'); b.addColorStop(1, 'rgba(22,21,20,0)'); c.fillStyle = b; c.fillRect(0, 1360, W, 240);
};

// ============ 数字圆盘 / 虚线位框 / 箭头 ============
// numDisc(c, n, x, y, r, col, o)：圆盘里一个数字（或一个字）。数字用 Poppins-800，汉字用 PuHui-Black。o.scale 弹入、o.col 字色
K.numDisc = (c, n, x, y, r = 34, col = RED, o = {}) => { if (r <= 0) return; const s = String(n), latin = /^[0-9A-Za-z.\-+%]+$/.test(s);
  K.disc(c, x, y, r, col, o); wrap(c, x, y, o, () => { c.font = latin ? `${Math.round(r * 1.2)}px "Poppins-800"` : `${Math.round(r * 1.05)}px "PuHui-Black"`; c.fillStyle = o.col || onCol(col); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, latin ? r * 0.06 : r * 0.04); }); };
// slot(c, x, y, w, h, o)：虚线位框（一物一位）。(x,y) 左上角。o: { lw, dash, fill 底色, p 弹入 0..1, pulse 空位时闪一下的时刻 lt }。返回中心锚点 {cx, cy, x, y, w, h}
K.slot = (c, x, y, w, h, o = {}) => { const p = o.p ?? 1, a = { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }; if (p <= 0) return a;
  c.save(); c.translate(a.cx, a.cy); c.scale(p, p); if (o.fill) { c.fillStyle = o.fill; c.fillRect(-w / 2, -h / 2, w, h); }
  c.strokeStyle = o.col || INK; c.lineWidth = o.lw || 6; c.setLineDash(o.dash || [16, 11]); c.strokeRect(-w / 2, -h / 2, w, h); c.restore(); return a; };
// arrow(c, x1, y1, x2, y2, o)：粗杆＋实心三角头。o: { col, w 杆宽, head 头长, p 画出进度 0..1, dash }
K.arrow = (c, x1, y1, x2, y2, o = {}) => { const { col = RED, w = 14, head = 42, p = 1 } = o; if (p <= 0) return; const d = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / d, uy = (y2 - y1) / d, L = d * p, hl = Math.min(head, L);
  const ex = x1 + ux * L, ey = y1 + uy * L, bx = ex - ux * hl, by = ey - uy * hl;
  K.bar(c, x1, y1, bx, by, w, col, { dash: o.dash });
  c.fillStyle = col; c.beginPath(); c.moveTo(ex, ey); c.lineTo(bx - uy * hl * 0.62, by + ux * hl * 0.62); c.lineTo(bx + uy * hl * 0.62, by - ux * hl * 0.62); c.closePath(); c.fill(); };

// ============ 条形 / 计数 / 时间线 ============
// bars(c, x, y, data, o)：条形图。data = [数, …] 或 [{v, label, col}, …]；(x,y) 是基线左端；竖条向上长、横条（o.horizontal）向右长。
// o: { w 总宽, h 最大条长, max, gap, lt, at 起点, stagger 条间隔, size 标签字号(≥44), val 在条头标数值 }
K.bars = (c, x, y, data, o = {}) => { const { w = 760, h = 420, gap = 22, lt = 99, at = 0, stagger = 0.12, size = 46, horizontal = false } = o, n = data.length, items = data.map((d, i) => typeof d === 'number' ? { v: d, col: [RED, YEL, BLUE][i % 3] } : { col: [RED, YEL, BLUE][i % 3], ...d });
  const max = o.max || Math.max(...items.map(d => d.v), 1), fs = Math.max(44, size);
  if (!horizontal) { const bw = (w - gap * (n - 1)) / n; K.bar(c, x - 10, y + 7, x + w + 10, y + 7, 14, INK);
    items.forEach((d, i) => { const p = clamp(MO.cubicOut(K.at(lt, at + i * stagger, 0.5))), bh = h * d.v / max * p, bx = x + i * (bw + gap); K.rect(c, bx, y - bh, bw, bh, d.col);
      if (o.val && p > 0.5) K.text(c, String(d.v), bx + bw / 2, y - bh - 34, { size: fs, fam: 'Poppins-800' });
      if (d.label) K.text(c, d.label, bx + bw / 2, y + 56, { size: fs, fam: 'PuHui-Heavy', maxW: bw + gap }); }); }
  else { const bh = (h - gap * (n - 1)) / n, lw = o.labelW ?? 220; K.bar(c, x + lw + 7, y - 10, x + lw + 7, y + h + 10, 14, INK);
    items.forEach((d, i) => { const p = clamp(MO.cubicOut(K.at(lt, at + i * stagger, 0.5))), by = y + i * (bh + gap), bw = (w - lw) * d.v / max * p; K.rect(c, x + lw + 14, by, bw, bh, d.col);
      if (d.label) K.text(c, d.label, x + lw - 10, by + bh / 2 + 2, { size: fs, fam: 'PuHui-Heavy', align: 'right', maxW: lw - 10 });
      if (o.val && p > 0.5) K.text(c, String(d.v), x + lw + 14 + bw + 18, by + bh / 2 + 2, { size: fs, fam: 'Poppins-800', align: 'left' }); }); } };
// tally(c, n, x, y, o)：计数划记（四竖一斜，第五划红）。(x,y) 左上角。o: { size 划高, p 进度 0..1（显示 n·p 划）, perRow 每行几组, lw }
K.tally = (c, n, x, y, o = {}) => { const { size = 90, p = 1, perRow = 3, lw = 11 } = o, show = Math.round(n * clamp(p)), gw = size * 1.25, gap = lw * 2.6;
  for (let i = 0; i < show; i++) { const g = Math.floor(i / 5), k = i % 5, gx = x + (g % perRow) * (gw + 40), gy = y + Math.floor(g / perRow) * (size + 36);
    if (k < 4) K.bar(c, gx + k * gap + lw / 2, gy, gx + k * gap + lw / 2, gy + size, lw, INK); else K.bar(c, gx - 12, gy + size * 0.78, gx + gw - 4, gy + size * 0.18, lw, RED); } };
// timeline(c, x1, y1, x2, y2, marks, o)：时间线。marks = [{label, col}, …] 等距（或 {t:0..1}）。o: { p 进度 0..1 (已走过的红段), cur 当前节点序号(放大), side 1 标签在下/-1 在上/0 交替, lw, size(≥44), lt, at 逐节点弹入 }。返回节点坐标数组
K.timeline = (c, x1, y1, x2, y2, marks, o = {}) => { const { p = 1, lw = 14, size = 46, side = 0, lt = 99, at = 0 } = o, n = marks.length, fs = Math.max(44, size), nodes = [];
  K.bar(c, x1, y1, x2, y2, lw, INK); if (p > 0) K.bar(c, x1, y1, x2, y2, lw + 2, RED, { p: clamp(p) });
  const vert = Math.abs(y2 - y1) > Math.abs(x2 - x1);
  marks.forEach((m, i) => { const tt = m.t ?? (n > 1 ? i / (n - 1) : 0.5), nx = lerp(x1, x2, tt), ny = lerp(y1, y2, tt), pp = K.pop(lt, at + i * 0.12, 0.4), done = tt <= p + 1e-6, cur = o.cur === i, r = (cur ? 30 : 22) * pp;
    nodes.push([nx, ny]); K.disc(c, nx, ny, r + 7, INK); K.disc(c, nx, ny, r, m.col || (done ? RED : CREAM));
    if (m.label && pp > 0.3) { const sd = side || (i % 2 ? -1 : 1);
      if (vert) K.text(c, m.label, nx + 56, ny, { size: fs, fam: 'PuHui-Heavy', align: 'left', alpha: clamp(pp) });
      else K.text(c, m.label, nx, ny + sd * 70, { size: fs, fam: 'PuHui-Heavy', alpha: clamp(pp), maxW: Math.abs(x2 - x1) / Math.max(1, n - 1) * 1.7 }); } });
  return nodes; };

// ============ 柜子 / 格子 ============
// cabinetGeom(o)：只算位置不画。o: { x, y 外框左上角, rows, cols, cw, ch 格内宽高（数或数组）, bar 框粗(默认 16) }。返回 { x, y, w, h, bar, cell(i,j) }
// cell(i,j) = { x, y, w, h, cx, cy, floor（格内地面 y）, top }，i 行（0 在上）、j 列（0 在左）
K.cabinetGeom = (o = {}) => { const { x = 100, y = 440, rows = 3, cols = 2, bar = 16 } = o, arr = (v, n, d) => Array.isArray(v) ? v : Array(n).fill(v ?? d), cw = arr(o.cw, cols, 320), ch = arr(o.ch, rows, 280);
  const xs = [], ys = []; let ax = x + bar, ay = y + bar; for (let j = 0; j < cols; j++) { xs.push(ax); ax += cw[j] + bar; } for (let i = 0; i < rows; i++) { ys.push(ay); ay += ch[i] + bar; }
  const g = { x, y, w: ax - x, h: ay - y, bar, rows, cols, cw, ch, cell: (i, j) => { const q = { x: xs[j], y: ys[i], w: cw[j], h: ch[i] }; q.cx = q.x + q.w / 2; q.cy = q.y + q.h / 2; q.floor = q.y + q.h; q.top = q.y; return q; } };
  return g; };
// cell(i, j)：最近一次 K.cabinet 的格子锚点；或 K.cell(i, j, 同样的 o)
K.cell = (i, j, o) => (o ? K.cabinetGeom(o) : K._cab).cell(i, j);
// cabinet(c, o)：黑粗框柜子。o: { x, y, rows, cols, cw, ch, bar, fill 格底色(奶白), lt, at 整柜弹入起点, grow 弹入时长,
//   doors: true | [色…] | (i,j)=>色|null 门板色（缺省无门，格子全开）, open: 数 | (i,j)=>0..1 | {'i,j':0..1}（缺省有门=0、无门=1）,
//   tintCells: {'i,j': 色} 格底着色（如 K.C.pinkWash）, content: (c, i, j, cell, openAmt) => {…} 在格内画东西, feet: 柜脚高度, shadow: 硬投影 }
// 返回几何（同 cabinetGeom，含 cell(i,j)），并记为 K._cab。
K.cabinet = (c, o = {}) => { const g = K.cabinetGeom(o), { rows, cols, bar } = g, lt = o.lt ?? 99, at = o.at ?? 0; K._cab = g;
  const pp = lt >= at + 1 ? 1 : K.pop(lt, at, o.grow || 0.5); if (pp <= 0) return g;
  const cyc = [RED, YEL, BLUE, CREAM], doorOf = (i, j) => o.doors === true ? cyc[(i + j * 2) % 3] : Array.isArray(o.doors) ? o.doors[(i * cols + j) % o.doors.length] : typeof o.doors === 'function' ? o.doors(i, j) : null;
  const openOf = (i, j) => { const v = o.open; const base = o.doors ? 0 : 1; if (typeof v === 'function') return clamp(v(i, j)); if (v && typeof v === 'object') return clamp(v[i + ',' + j] ?? base); return clamp(v ?? base); };
  c.save(); c.translate(g.x + g.w / 2, g.y + g.h); c.scale(1, Math.max(0.01, pp)); c.translate(-(g.x + g.w / 2), -(g.y + g.h));
  if (o.shadow) { c.fillStyle = INK; c.fillRect(g.x + 12, g.y + 12, g.w, g.h); }
  c.fillStyle = INK; c.fillRect(g.x, g.y, g.w, g.h);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const q = g.cell(i, j), open = openOf(i, j), door = doorOf(i, j);
    c.fillStyle = o.fill || CREAM; c.fillRect(q.x, q.y, q.w, q.h);
    const tc = o.tintCells && o.tintCells[i + ',' + j]; if (tc) { c.fillStyle = tc; c.fillRect(q.x, q.y, q.w, q.h); }
    c.fillStyle = 'rgba(22,21,20,.10)'; c.fillRect(q.x, q.y, q.w, 10);   // 顶部一条深纸色：格子的纵深
    if (o.content && open > 0.02) { c.save(); c.beginPath(); c.rect(q.x, q.y, q.w, q.h); c.clip(); o.content(c, i, j, q, open); c.restore(); }
    if (door) { const dp = o.doors && lt < at + 1 ? K.pop(lt, at + 0.25 + (i * cols + j) * 0.05, 0.4) : 1, dw = q.w * (1 - 0.88 * open) * Math.min(1, dp);
      if (dw > 1) { c.fillStyle = door; c.fillRect(q.x, q.y, dw, q.h); c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(q.x + 3, q.y + 3, dw - 6, q.h - 6);
        if (open < 0.4) K.disc(c, q.x + dw - 36 * Math.min(1, dw / q.w), q.cy, 11, onCol(door) === INK ? INK : CREAM); } } }
  if (o.feet) { K.rect(c, g.x + 24, g.y + g.h, 22, o.feet, INK); K.rect(c, g.x + g.w - 46, g.y + g.h, 22, o.feet, INK); }
  c.restore(); return g; };

// ============ 图标（22 个）============
// icon(c, name, x, y, size, o)：(x,y) 图标中心，size 约为包围盒边长（默认 120）。o: { alpha, rot, col 主色覆盖, t 动画时刻(太阳转/钟走), time 钟的小时数(默认 10.17) }
// name：drop sun fire key cup bowl book hanger pills bottle pot shoe umbrella bed towel clock phone lamp box check cross；也接受中文名（水滴 太阳 火 钥匙 杯 碗 书 衣架 药盒 瓶 锅 鞋 伞 床 毛巾 钟 手机 灯 箱子 勾选 叉）
const ICON_ALIAS = { 水滴: 'drop', 太阳: 'sun', 火: 'fire', 钥匙: 'key', 杯: 'cup', 碗: 'bowl', 书: 'book', 衣架: 'hanger', 药盒: 'pills', 瓶: 'bottle', 锅: 'pot', 鞋: 'shoe', 伞: 'umbrella', 床: 'bed', 毛巾: 'towel', 钟: 'clock', 手机: 'phone', 灯: 'lamp', 箱子: 'box', 勾选: 'check', 叉: 'cross' };
const R_ = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const O_ = (c, col, x, y, r) => { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const T_ = (c, col, ...p) => { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.closePath(); c.fill(); };
const L_ = (c, col, w, x1, y1, x2, y2) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
const ICONS = {   // 都画在 ±50 的盒里
  drop: (c, o) => { const k = o.col || BLUE; T_(c, k, -26, 8, 26, 8, 0, -48); O_(c, k, 0, 14, 28); R_(c, CREAM, -16, 6, 7, 16); },
  sun: (c, o) => { const k = o.col || YEL, a0 = (o.t || 0) * 0.8; for (let i = 0; i < 8; i++) { const a = a0 + i * TAU / 8; L_(c, k, 8, Math.cos(a) * 32, Math.sin(a) * 32, Math.cos(a) * 49, Math.sin(a) * 49); } O_(c, k, 0, 0, 24); },
  fire: (c, o) => { T_(c, o.col || RED, -34, 44, 34, 44, 0, -48); T_(c, YEL, -18, 44, 18, 44, 0, 2); R_(c, INK, -40, 44, 80, 8); },
  key: (c, o) => { const k = o.col || YEL; L_(c, k, 12, -8, 0, 38, 0); R_(c, k, 20, 0, 10, 22); R_(c, k, 34, 0, 10, 14); O_(c, k, -26, 0, 22); O_(c, CREAM, -26, 0, 9); },
  cup: (c, o) => { const k = o.col || RED; c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.arc(30, 4, 14, -Math.PI / 2, Math.PI / 2); c.stroke(); R_(c, k, -32, -22, 58, 62, 0); R_(c, INK, -32, -22, 58, 8); L_(c, INK, 6, -14, -46, -14, -32); L_(c, INK, 6, 4, -46, 4, -32); },
  bowl: (c, o) => { c.fillStyle = o.col || BLUE; c.beginPath(); c.arc(0, -8, 44, 0, Math.PI); c.closePath(); c.fill(); R_(c, INK, -48, -12, 96, 8); R_(c, INK, -18, 34, 36, 8); },
  book: (c, o) => { R_(c, o.col || RED, -32, -42, 66, 84); R_(c, INK, -32, -42, 12, 84); R_(c, CREAM, -8, -26, 32, 26); R_(c, CREAM, 33, -40, 6, 80); },
  hanger: (c, o) => { T_(c, o.col || YEL, -42, 16, 42, 16, 0, -22); T_(c, CREAM, -26, 16, 26, 16, 0, -6); L_(c, INK, 7, 0, -22, -43, 17); L_(c, INK, 7, 0, -22, 43, 17); L_(c, INK, 7, -44, 17, 44, 17); L_(c, INK, 7, 0, -22, 0, -32);
    c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.arc(-8, -38, 10, Math.PI * 0.2, Math.PI * 1.6); c.stroke(); },
  pills: (c, o) => { R_(c, INK, -44, -28, 88, 56); R_(c, CREAM, -38, -22, 76, 44); R_(c, o.col || RED, -8, -16, 16, 32); R_(c, o.col || RED, -16, -8, 32, 16); R_(c, INK, -44, -28, 88, 8); },
  bottle: (c, o) => { R_(c, INK, -13, -50, 26, 12); R_(c, INK, -10, -40, 20, 20); R_(c, o.col || BLUE, -26, -22, 52, 72); R_(c, CREAM, -26, -2, 52, 26); R_(c, o.col || BLUE, -6, 4, 12, 14); },
  pot: (c, o) => { R_(c, o.col || RED, -32, -8, 64, 44); R_(c, INK, -40, -16, 80, 9); O_(c, INK, 0, -24, 7); R_(c, INK, -52, 0, 20, 9); R_(c, INK, 32, 0, 20, 9); R_(c, YEL, -32, 10, 64, 8); },
  shoe: (c, o) => { c.fillStyle = o.col || BLUE; c.beginPath(); c.moveTo(-42, 26); c.lineTo(-42, -26); c.lineTo(-12, -26); c.lineTo(8, 0); c.lineTo(44, 10); c.lineTo(44, 26); c.closePath(); c.fill(); R_(c, INK, -46, 26, 94, 12); L_(c, CREAM, 5, -10, -18, 4, -2); L_(c, CREAM, 5, -22, -10, -8, 4); },
  umbrella: (c, o) => { c.fillStyle = o.col || RED; c.beginPath(); c.arc(0, -4, 46, Math.PI, TAU); c.closePath(); c.fill(); T_(c, CREAM, -14, -4, 14, -4, 0, -46); L_(c, INK, 6, 0, -4, 0, 34); c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.arc(-9, 34, 9, 0, Math.PI); c.stroke(); },
  bed: (c, o) => { R_(c, INK, -48, -30, 9, 70); R_(c, INK, -48, 22, 96, 9); R_(c, INK, 39, 22, 9, 18); R_(c, o.col || BLUE, -40, 2, 88, 22); R_(c, CREAM, -36, -12, 30, 14); R_(c, YEL, 8, 2, 40, 8); },
  towel: (c, o) => { R_(c, o.col || RED, -26, -36, 52, 76); R_(c, CREAM, -26, 14, 52, 7); R_(c, CREAM, -26, 26, 52, 7); R_(c, INK, -38, -44, 76, 9); },
  clock: (c, o) => { const hr = o.time ?? 10.17, am = hr / 12 * TAU, mm = (hr % 1) * TAU; O_(c, INK, 0, 0, 44); O_(c, CREAM, 0, 0, 35); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; L_(c, INK, 5, Math.cos(a) * 24, Math.sin(a) * 24, Math.cos(a) * 31, Math.sin(a) * 31); }
    L_(c, INK, 7, 0, 0, Math.sin(am) * 17, -Math.cos(am) * 17); L_(c, INK, 5, 0, 0, Math.sin(mm) * 27, -Math.cos(mm) * 27); O_(c, RED, 0, 0, 6); },
  phone: (c, o) => { R_(c, INK, -24, -44, 48, 88); R_(c, o.col || BLUE, -18, -36, 36, 64); O_(c, CREAM, 0, 36, 4.5); R_(c, YEL, -10, -26, 20, 20); },
  lamp: (c, o) => { R_(c, INK, -26, 38, 52, 9); L_(c, INK, 8, 0, 38, 0, -4); c.fillStyle = o.col || YEL; c.beginPath(); c.moveTo(-30, -4); c.lineTo(30, -4); c.lineTo(16, -40); c.lineTo(-16, -40); c.closePath(); c.fill(); R_(c, INK, -30, -8, 60, 6); },
  box: (c, o) => { R_(c, o.col || YEL, -40, -24, 80, 66); R_(c, INK, -46, -34, 92, 14); R_(c, INK, -14, -6, 28, 9); R_(c, RED, -4, -20, 8, 14); },
  check: (c, o) => { O_(c, o.col || BLUE, 0, 0, 46); c.strokeStyle = CREAM; c.lineWidth = 13; c.lineCap = 'butt'; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(-22, 2); c.lineTo(-6, 20); c.lineTo(24, -18); c.stroke(); },
  cross: (c, o) => { O_(c, o.col || RED, 0, 0, 46); L_(c, CREAM, 13, -18, -18, 18, 18); L_(c, CREAM, 13, 18, -18, -18, 18); },
};
K.ICON_NAMES = Object.keys(ICONS);
K.icon = (c, name, x, y, size = 120, o = {}) => { const f = ICONS[ICON_ALIAS[name] || name]; if (!f) throw new Error('K.icon: 没有这个图标 ' + name + '（可用：' + K.ICON_NAMES.join(' ') + '）'); if (size <= 0) return;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(size / 100, size / 100); f(c, o); c.restore(); };

// ============ 施莱默人偶 ============
// figure(c, x, y, o)：(x,y) 两脚中点（地面）。s=1 时总高约 800px，常用 0.45–0.7。返回屏幕锚点 { hand, handB, head, top, chest, feet, prop }。
// o: { s, dir 1 朝右 / -1 朝左, pose, to, mix 0..1 姿势混合, t 全片时间（呼吸、走路、欢呼的时钟）, walk 走路相位(弧度，缺省 t*6),
//      target [屏幕x, 屏幕y] point/reach 时手指向哪里（IK），prop (c, {x,y,s,dir}) => {…} 在手处画道具（carry 时在两手之间）,
//      torso 躯干色(蓝), hair 发色(黄), alpha, chair 坐姿时是否画凳子(默认是) }
// pose：stand 站 / walk 走 / point 指 / reach 伸手取 / carry 双手捧 / sit 坐 / cheer 举手欢呼
const POSE = {
  stand: () => ({ hA: [96, -378], hB: [-96, -378], fA: [36, 0], fB: [-36, 0] }),
  walk: (ph) => { const sw = Math.sin(ph); return { hA: [70 - sw * 86, -410 - Math.abs(sw) * 6], hB: [-70 + sw * 86, -410 - Math.abs(sw) * 6], fA: [36 + sw * 120, -Math.max(0, Math.cos(ph)) * 44], fB: [-36 - sw * 120, -Math.max(0, -Math.cos(ph)) * 44], bob: -Math.abs(Math.cos(ph)) * 8 }; },
  point: () => ({ hA: [340, -650], hB: [-96, -378], fA: [44, 0], fB: [-44, 0], lean: 10, tgt: 'A' }),
  reach: () => ({ hA: [290, -520], hB: [-90, -380], fA: [60, 0], fB: [-44, 0], lean: 34, tgt: 'A' }),
  carry: () => ({ hA: [168, -470], hB: [138, -440], fA: [36, 0], fB: [-36, 0], lean: 8, carry: true }),
  sit: () => ({ hA: [150, -262], hB: [64, -250], fA: [190, 0], fB: [150, 0], drop: 150, sit: true }),
  cheer: (ph) => ({ hA: [128, -884], hB: [-128, -884], fA: [40, 0], fB: [-40, 0], bob: -Math.abs(Math.sin(ph)) * 34 }),
};
const mixPose = (a, b, m) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const u = a[k], v = b[k]; o[k] = Array.isArray(u ?? v) ? (u && v ? [lerp(u[0], v[0], m), lerp(u[1], v[1], m)] : (m < 0.5 ? u : v)) : typeof (u ?? v) === 'number' ? lerp(u ?? 0, v ?? 0, m) : (m < 0.5 ? u : v); } return o; };
K.POSES = Object.keys(POSE);
K.figure = (c, x, y, o = {}) => {
  const s = o.s ?? 0.5, dir = o.dir || 1, t = o.t ?? 0, ph = o.walk ?? t * 6, mk = n => { const f = POSE[n]; if (!f) throw new Error('K.figure: 没有这个姿势 ' + n + '（可用：' + K.POSES.join(' ') + '）'); return f(ph); };
  let pz = mk(o.pose || 'stand'); if (o.to) pz = mixPose(pz, mk(o.to), clamp(o.mix ?? 0)); const drop = (pz.drop || 0) + (pz.bob || 0), lean = pz.lean || 0, br = Math.sin(t * 2.4) * 3, torso = o.torso || BLUE, hair = o.hair || YEL;
  const S2 = (lx, ly) => [x + lx * s * dir, y + ly * s], toL = (sx, sy) => [(sx - x) / (s * dir), (sy - y) / s];
  let hA = pz.hA, hB = pz.hB; if (o.target && pz.tgt) hA = toL(o.target[0], o.target[1]);
  const shA = [70 + lean, -620 + drop + br], shB = [-70 + lean, -620 + drop + br], LL = 136;
  const ik = (Sh, Hd) => { let dx = Hd[0] - Sh[0], dy = Hd[1] - Sh[1], d = Math.hypot(dx, dy) || 1; if (d > 2 * LL - 2) { Hd = [Sh[0] + dx / d * (2 * LL - 2), Sh[1] + dy / d * (2 * LL - 2)]; dx = Hd[0] - Sh[0]; dy = Hd[1] - Sh[1]; d = 2 * LL - 2; }
    const h = Math.sqrt(Math.max(0, LL * LL - d * d / 4)), e1 = [Sh[0] + dx / 2 + dy / d * h, Sh[1] + dy / 2 - dx / d * h], e2 = [Sh[0] + dx / 2 - dy / d * h, Sh[1] + dy / 2 + dx / d * h]; return [e2[1] > e1[1] ? e2 : e1, Hd]; };
  const arm = (Sh, Hd) => { const [E, Hn] = ik(Sh, Hd); L_(c, INK, 22, Sh[0], Sh[1], E[0], E[1]); L_(c, INK, 22, E[0], E[1], Hn[0], Hn[1]);
    for (const [p, rd] of [[Sh, 17], [E, 15]]) { O_(c, INK, p[0], p[1], rd + 5); O_(c, CREAM, p[0], p[1], rd); O_(c, INK, p[0], p[1], 5); } O_(c, INK, Hn[0], Hn[1], 14); return Hn; };
  const leg = (hx, F) => { const H0 = [hx, -330 + drop]; if (pz.sit) { const K0 = [F[0], H0[1]]; L_(c, INK, 20, H0[0], H0[1], K0[0], K0[1]); L_(c, INK, 20, K0[0], K0[1], F[0], F[1]); R_(c, INK, F[0] - 6, F[1] - 14, 66, 14); }
    else { L_(c, INK, 20, H0[0], H0[1], F[0], F[1] - 4); R_(c, INK, F[0] - 40, F[1] - 14, 70, 14); } };
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); c.scale(s * dir, s);
  if (pz.sit && o.chair !== false) { R_(c, RED, -70, -186 + 12, 150, 14); L_(c, INK, 10, -56, -172, -56, 0); L_(c, INK, 10, 60, -172, 60, 0); }
  const hbT = arm(shB, hB);
  leg(-24, pz.fB); leg(24, pz.fA);
  // 上身（随坐姿下沉、随 lean 前倾）
  c.save(); c.translate(lean * 0.5, drop + br * 0);
  const fx = 0, fy = 0;
  c.fillStyle = INK; c.beginPath(); c.moveTo(fx, fy - 560); c.arc(fx, fy - 560, 225, Math.PI * 0.32, Math.PI * 0.68); c.closePath(); c.fill();
  c.fillStyle = torso; c.beginPath(); c.moveTo(fx - 70, fy - 560 + br); c.lineTo(fx + 70, fy - 560 + br); c.lineTo(fx + 100, fy - 330); c.lineTo(fx - 100, fy - 330); c.closePath(); c.fill();
  c.fillStyle = INK; c.beginPath(); c.moveTo(fx + 8, fy - 560 + br); c.lineTo(fx + 70, fy - 560 + br); c.lineTo(fx + 100, fy - 330); c.lineTo(fx + 20, fy - 330); c.closePath(); c.fill();
  c.fillStyle = torso; c.beginPath(); c.moveTo(fx - 84, fy - 640 + br); c.lineTo(fx + 84, fy - 640 + br); c.lineTo(fx + 62, fy - 470); c.lineTo(fx - 62, fy - 470); c.closePath(); c.fill();
  c.fillStyle = INK; c.beginPath(); c.moveTo(fx + 14, fy - 640 + br); c.lineTo(fx + 84, fy - 640 + br); c.lineTo(fx + 62, fy - 470); c.lineTo(fx + 14, fy - 470); c.closePath(); c.fill();
  const hx = fx + 6 + lean * 0.3, hy = fy - 730 + br * 1.2;
  c.fillStyle = hair; c.beginPath(); c.moveTo(hx, hy); c.arc(hx, hy, 66, -1.95, 1.15); c.closePath(); c.fill(); O_(c, hair, hx - 62, hy - 46, 28);
  O_(c, CREAM, hx + 4, hy, 56); T_(c, hair, hx - 40, hy - 52, hx + 20, hy - 56, hx - 6, hy - 20);
  if ((t % 2.6) > 2.5) R_(c, INK, hx + 14, hy - 6, 14, 5); else R_(c, INK, hx + 20, hy - 20, 8, 26);
  R_(c, RED, hx + 24, hy + 8, 18, 14); R_(c, INK, hx + 26, hy + 32, 24, 6); R_(c, INK, hx - 8, hy + 52, 16, 22);
  c.restore();
  // 道具：在两手之间（carry）或近手处
  const hAn = ik(shA, hA)[1], mid = pz.carry ? [(hAn[0] + hbT[0]) / 2, (hAn[1] + hbT[1]) / 2 - 6] : hAn;
  c.restore();
  if (o.prop) { const m = S2(mid[0], mid[1]); o.prop(c, { x: m[0], y: m[1], s, dir }); }
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); c.scale(s * dir, s); arm(shA, hA); c.restore();
  const hd = S2(6 + lean * 0.3, -730 + drop + br * 1.2);
  return { hand: S2(hAn[0], hAn[1]), handB: S2(hbT[0], hbT[1]), head: hd, top: [hd[0], hd[1] - 70 * s], chest: S2(lean * 0.5, -560 + drop), feet: [x, y], prop: S2(mid[0], mid[1]) };
};

// ============ 章节卡 ============
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
K.CARD_TINTS = K.CARD_TINTS || ['red', 'blue', 'yellow'];    // 章节卡主色每章轮换；换书可在 props.js 里改
// 包豪斯海报版式：左上大数字 N（Poppins-800 压在主色圆上）、「第 N 章」黑牌、章名粗黑大字（长的拆两行）、N 站进度＝一排小方块（走过的黑、当前的主色放大、没到的空心）
K.chapterCard = (c, lt, t, n, title = '') => {
  const tint = K.CARD_TINTS[(n - 1) % K.CARD_TINTS.length], col = tintCol(tint), ink2 = col === INK ? RED : INK;
  c.drawImage(paperTex(), 0, 0);
  K.bar(c, 0, 1640, W, 160, 3, 'rgba(22,21,20,.55)');
  // 主色块：右上大圆（弹入）＋压在数字下的黑条＋右下小三角方块点缀
  const pd = K.pop(lt, 0.0, 0.5); K.disc(c, 780, 500, 340 * pd, col);
  K.tri(c, 130, 1130, 120, 104, col === YEL ? BLUE : YEL, { scale: K.pop(lt, 0.7, 0.4) });
  // 大数字 N
  const ns = String(n); c.save(); c.font = '500px "Poppins-800"'; const nw = c.measureText(ns).width; c.restore(); const nk = Math.min(1, 800 / nw), q = lt > 0.08 ? MO.slamK((lt - 0.08) / 0.2) : 0;
  if (q > 0) K.text(c, ns, 66, 560, { size: 500, fam: 'Poppins-800', col: INK, align: 'left', scale: q * nk, maxW: 0 });
  if (lt > 0.2) K.tag(c, `第 ${n} 章`, 66, 190, { size: 60, align: 'left', fam: 'PuHui-Black', fill: INK, col: CREAM, scale: MO.slamK((lt - 0.2) / 0.17), shadow: true });
  // 章名
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 96 : all > 7 ? 112 : 130;
  const ty = lines.length > 1 ? 880 : 930; let used = 0;
  K.rect(c, 60, ty - size * 0.85, 12, size * (lines.length > 1 ? 2.6 : 1.7), RED);
  lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K.text(c, a.slice(0, k).join(''), 100, ty + i * size * 1.25, { size, fam: 'PuHui-Black', align: 'left', maxW: 900 }); });
  // 进度：N 站小方块
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 70, x1 = 1010, y = 1250, sq = Math.min(54, ((x1 - x0) / (N - 1)) * 0.72), X = i => lerp(x0 + sq / 2, x1 - sq / 2, i / (N - 1));
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, p = cur ? K.pop(lt, 1.0, 0.45) : K.pop(lt, 0.7 + i * 0.02, 0.3), r = (cur ? sq * 1.45 : sq) * Math.max(0, p);
    if (cur) { K.rect(c, X(i) - r / 2 + 6, y - r / 2 + 6, r, r, INK); K.rect(c, X(i) - r / 2, y - r / 2, r, r, col, { line: 6 }); }
    else if (past) K.rect(c, X(i) - r / 2, y - r / 2, r, r, INK); else { K.rect(c, X(i) - r / 2, y - r / 2, r, r, CREAM, { line: 5 }); } }
  K.finish(c);
};

// 字幕（assemble 生成的 subs.js 调它）：黑板＋奶白字，字幕带 y≈1480，让开视频号底栏
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 90), h = 92, x = 540, y = 1480;
  c.fillStyle = RED; c.fillRect(x - w / 2 + 8, y - h / 2 + 8, w, h);
  c.fillStyle = INK; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = YEL; c.fillRect(x - w / 2 + 14, y - 12, 24, 24);
  c.fillStyle = CREAM; c.fillText(text, x + 12, y + 2, 950); c.restore();
};
})();
