// 画风套件 cubism（配方 huashu-art-motion 11_cubism「分析立体主义」，来自《ServiceNow：AI帮谁赚钱》）：竖屏 1080×1920，导出 window.K。
// 规矩：米褐纸底＋大面积半透明切面；物体用「三角刻面＋渐变」（K.shape，位图缓存后仿射贴图）；粗墨褐描边带出头；布拉克小笔触点缀；
//       赭金＝整块/确定，钢蓝灰＝碎块/不确定，红只给下跌与结论。无霓虹、无蓝紫渐变底。随机一律 U.hash/U.rng；主体落定即停，只有背景切面极慢漂移。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = K.C = { paper: '#DCCFB4', paper2: '#CDBE9E', ochre: '#D9A441', ochreD: '#9A6A1A', steel: '#5E7A94', steelD: '#3E4E60', ink: '#2B1D14', cream: '#ECE3CF', red: '#B03225', grey: '#8E8A7C' };
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (a, al) => `rgba(${a.map(Math.round).join()},${al})`;
const CREAM = hex(C.cream), DARK = hex(C.ink);
const COL = { ochre: C.ochre, ochreD: C.ochreD, steel: C.steel, steelD: C.steelD, grey: C.grey, red: C.red, cream: C.cream, ink: C.ink, paper2: C.paper2 };

// ---------- 切面物体：多边形切成渐变三角，缓存成位图 ----------
// poly: [[x,y],…]（局部坐标）；col: COL 键或 #hex；o: {x,y 贴到的位置（poly 原点）, rot, scale, alpha, seed, cell, bias, edge}
K.shape = (c, poly, col = 'ochre', o = {}) => {
  const { x = 0, y = 0, rot = 0, scale = 1, alpha = 1, seed = 5, cell = 44, bias = 0, edge = 5, ax, ay } = o, base = COL[col] || col;
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), pad = 30, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const key = 'cub_' + base + '_' + seed + '_' + cell + '_' + bias + '_' + poly.map(p => p.map(Math.round).join(',')).join(';');
  const img = P.cached(key, Math.ceil(w), Math.ceil(h), g => {
    const R = U.rng(seed), B = hex(base); g.translate(-x0, -y0); g.save(); g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    g.fillStyle = rgba(mix(B, DARK, 0.15), 1); g.fillRect(x0 - 5, y0 - 5, w + 10, h + 10);
    const nx = Math.ceil(w / cell) + 3, ny = Math.ceil(h / cell) + 3, gp = []; for (let j = 0; j < ny; j++) { gp.push([]); for (let i = 0; i < nx; i++) gp[j].push([x0 - cell + i * cell + (R() - 0.5) * cell * 0.5, y0 - cell + j * cell + (R() - 0.5) * cell * 0.5]); }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = gp[j][i], b = gp[j][i + 1], d = gp[j + 1][i], e = gp[j + 1][i + 1];
      const tris = R() < 0.5 ? [[a, b, d], [b, e, d]] : [[a, b, e], [a, e, d]];
      for (const t of tris) { const k = R() - 0.35 + bias, col2 = k > 0 ? mix(B, CREAM, Math.min(k * 0.7, 0.8)) : mix(B, DARK, Math.min(-k * 0.9, 0.85));
        const gr = g.createLinearGradient(t[0][0], t[0][1], t[2][0], t[2][1]); gr.addColorStop(0, rgba(mix(col2, CREAM, 0.2), 1)); gr.addColorStop(1, rgba(mix(col2, DARK, 0.25), 1));
        g.fillStyle = gr; g.beginPath(); g.moveTo(...t[0]); g.lineTo(...t[1]); g.lineTo(...t[2]); g.closePath(); g.fill(); g.strokeStyle = 'rgba(43,29,20,.2)'; g.lineWidth = 1.5; g.stroke(); } }
    g.restore();
    if (edge) { g.strokeStyle = C.ink; g.lineWidth = edge; g.lineCap = 'round'; const r2 = U.rng(seed + 9);
      for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, o2 = 10 + r2() * 10;
        g.beginPath(); g.moveTo(p[0] - dx / L * o2, p[1] - dy / L * o2); g.lineTo(q[0] + dx / L * o2, q[1] + dy / L * o2); g.stroke(); } } });
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  if (ax !== undefined) c.translate(-ax, -ay);   // 旋转/缩放锚点（局部坐标）
  c.drawImage(img, x0, y0); c.restore(); };
// 柱：底边中心 (x, baseY)，宽 w，高 h；peak=true 顶部做成尖/斜面
K.bar = (c, x, baseY, w, h, col = 'ochre', o = {}) => { if (h < 2) return; const pk = o.peak ? Math.min(w * 0.35, h * 0.3) : 0;
  const poly = pk ? [[0, 0], [0, -h + pk], [w / 2, -h], [w, -h + pk], [w, 0]] : [[0, 0], [0, -h], [w, -h + (o.slant || 0)], [w, 0]];
  K.shape(c, poly, col, { ...o, x: x - w / 2, y: baseY, seed: o.seed || Math.round(w + h) }); };
// 碎裂：一块 (x,y 左上, w,h) 随 prog 0→1 裂成 n×m 块并掉落（落点由种子定，确定性）
K.shatter = (c, x, y, w, h, prog, col = 'steel', o = {}) => { const { n = 2, m = 3, fall = 520, seed = 4 } = o, R = U.rng(seed), cw = w / n, ch = h / m;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const r1 = R(), r2 = R(), d = clamp((prog - 0.05 * (m - j) - r1 * 0.2) / 0.6), e = d * d;
    K.shape(c, [[0, 0], [cw * (0.9 + r2 * 0.1), 0], [cw, ch], [0, ch * (0.9 + r1 * 0.1)]], col, { x: x + i * cw + (r1 - 0.5) * 140 * d, y: y + j * ch + fall * e * (0.5 + r2), rot: (r2 - 0.5) * 1.6 * d, alpha: 1 - clamp((d - 0.8) * 4) * 0.6, cell: 36, bias: -0.1 * d, seed: seed * 7 + i * 3 + j, ax: cw / 2, ay: ch / 2 }); } };

// ---------- 底：纸＋大面积半透明切面（静态）＋布拉克笔触；少数大切面极慢漂移（环境层） ----------
K.paperTex = () => P.cached('cub_paper', W, H, g => { g.fillStyle = C.paper; g.fillRect(0, 0, W, H); const R = U.rng(7); const pal = [C.ochre, C.steel, C.grey, C.ochreD, C.cream, C.steelD];
  for (let i = 0; i < 38; i++) { const n = 3 + Math.floor(R() * 2), cx = R() * W, cy = R() * H, r = 160 + R() * 360, pts = []; for (let k = 0; k < n; k++) { const a = R() * TAU; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.2]); }
    g.fillStyle = rgba(hex(pal[Math.floor(R() * pal.length)]), 0.07 + R() * 0.1); g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fill(); }
  for (let i = 0; i < 5000; i++) { g.fillStyle = R() < 0.55 ? 'rgba(236,227,207,.3)' : 'rgba(43,29,20,.08)'; g.fillRect(R() * W, R() * H, 3 + R() * 6, 2); } });
K.bg = (c, t, o = {}) => { c.drawImage(K.paperTex(), 0, 0); const R = U.rng(21);
  for (let i = 0; i < 5; i++) { const cx = 100 + R() * 880, cy = 260 + R() * 1300, s = 240 + R() * 160, ph = R() * TAU, dx = Math.sin(t * 0.12 + ph) * 26, dy = Math.cos(t * 0.1 + ph) * 22;
    c.fillStyle = i % 2 ? 'rgba(236,227,207,.16)' : 'rgba(43,29,20,.07)'; c.beginPath(); c.moveTo(cx + dx, cy + dy); c.lineTo(cx + s + dx, cy + 60 + dy); c.lineTo(cx + 80 + dx, cy + s * 1.2 + dy); c.closePath(); c.fill(); }
  c.strokeStyle = 'rgba(43,29,20,.35)'; c.lineWidth = 4; c.strokeRect(40, 40, W - 80, H - 80); };
K.finish = c => { const g = c.createRadialGradient(W / 2, H * 0.42, 600, W / 2, H * 0.42, 1300); g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,.2)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };

// ---------- 文字：粗黑体，米白描边保证压在切面上也读得清 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.text = (c, s, x, y, o = {}) => { const { size = 60, fam = 'PuHui-Heavy', col = C.ink, align = 'center', alpha = 1, scale = 1, halo = true, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px';
  if (halo) { c.lineJoin = 'round'; c.lineWidth = size / 5; c.strokeStyle = C.cream; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 切片标签：米白纸片＋墨褐粗边（斜切角）
K.plate = (c, s, x, y, o = {}) => { const { size = 56, fam = 'PuHui-Heavy', col = C.ink, scale = 1, alpha = 1, fill = C.cream } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * 1.1, h = size * 1.5, k = size * 0.28;
  c.beginPath(); c.moveTo(-w / 2 + k, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2 - k); c.lineTo(w / 2 - k, h / 2); c.lineTo(-w / 2, h / 2); c.lineTo(-w / 2, -h / 2 + k); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = 5; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.stroke(); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; (o.plate ? K.plate : K.text)(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 4; c.setLineDash([14, 10]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); c.setLineDash([]); c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 8, 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.25, 0.45); if (q > 0) K.plate(c, s, bx, by, { size: o.size || 48, col: o.col || C.ink, scale: q }); };
K.tag = (c, s, x, y, o = {}) => { const { size = 52, col = C.red } = o; c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + 40, h = size * 1.4;
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 24, y - h / 2); c.lineTo(x + 24 + w, y - h / 2); c.lineTo(x + 24 + w, y + h / 2); c.lineTo(x + 24, y + h / 2); c.closePath(); c.fill();
  c.fillStyle = C.cream; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s, x + 44, y + 3); c.restore(); };
// 红色印章（只给下跌/结论）
K.stamp = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const { size = 80, rot = -0.1, col = C.red } = o, k = MO.slamK((lt - at) / 0.17);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 0.8, h = size * 1.4;
  c.strokeStyle = col; c.lineWidth = size * 0.09; c.strokeRect(-w / 2, -h / 2, w, h); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };
// 横轴：墨褐粗线＋刻度字
K.axis = (c, x0, x1, y, ticks, fmt = v => v) => { c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 14, y); c.lineTo(x1 + 14, y); c.stroke();
  ticks.forEach(([u, v]) => { const x = lerp(x0, x1, u); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 18); c.stroke(); K.text(c, String(fmt(v)), x, y + 56, { size: 44, fam: 'PuHui-Bold' }); }); };

// ---------- 章节卡 ----------
// 中央主物：整块赭金立方切面；在 props.js 里改 K.cardCenter 换成本书贯穿物
K.cardCenter = K.cardCenter || ((c, lt, t) => { const s = 0.96 + Math.sin(t * 0.8) * 0.02;
  K.shape(c, [[0, 0], [160, -60], [330, 0], [330, 260], [160, 330], [0, 260]], 'ochre', { x: 540, y: 880, scale: s, seed: 11, cell: 50, ax: 165, ay: 130 });
  K.shape(c, [[0, 0], [130, 40], [60, 200]], 'steel', { x: 700, y: 1000 + Math.sin(t) * 6, rot: 0.3, seed: 13, cell: 40, alpha: 0.9 }); });
K.chapterCard = (c, lt, t, n, title) => { K.bg(c, t);
  const s = lt > 0.1 ? MO.slamK((lt - 0.1) / 0.17) : 0; K.cardCenter(c, lt, t);
  K.text(c, `第 ${n} 章`, W / 2, 330, { size: 80, col: C.ochreD, alpha: K.at(lt, 0.2, 0.3) });
  if (s) K.text(c, String(n), W / 2, 1180, { size: 200, col: C.red, scale: s });
  const shown = TY.typed(title, K.at(lt, 0.35, [...title].length / 16)); K.text(c, shown, W / 2, 470, { size: title.length > 9 ? 66 : 80, col: C.ink });
  K.finish(c); };
// 字幕：墨褐底板＋米白字，带 y≈1480
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480; c.fillStyle = 'rgba(43,29,20,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 12); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 2); c.restore(); };
})();
