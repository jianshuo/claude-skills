// 画风套件 impression（配方 huashu-art-motion 08_impressionism「印象派·莫奈」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 画法：背景和主体（鲸、人、楼、鱼）都是「平涂底稿 → 短笔触重画」，笔位用 (格子坐标, 种子) 哈希固定，永不整屏重洗；
//       重画只在首次用到时做一次，存进离屏层（K.once），之后每帧只 drawImage ＋ 少量动态短笔（光斑、水波、云、喷水、气泡）。
//       数据（票据、图表、字）一律放奶白纸卡上清晰盖在笔触之后，笔触只在背景和实物上。
// 版式：主体 y 200–1350；y 1380–1560 字幕带；字 ≥ 44px（标签 52+）；不用蓝紫霓虹（水色走青绿灰＋暖桃金）。
// 约定：除票据/图表外，所有组件的 (x,y) 是锚点（鲸=身体中心，人/楼=脚底中点，卡片=中心）。
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
  ink: '#2b3a44', ink2: '#4a5a62', paper: '#fbf1d8', paperDk: '#e9d9b4', cream: '#fff4dc',
  call: '#2F8A4D', callLt: '#5fb872', put: '#C0392B', putLt: '#e0705a',
  gold: '#f4c25a', sun: '#f6c870', orange: '#f0a050', peach: '#f6c6a0', rose: '#ec9a8a', coral: '#e0785a',
  sea0: '#2f6a74', sea1: '#4f8f93', sea2: '#78b2a8', sea3: '#a8d0c0', foam: '#f6f2e4', deep: '#0c2630',
  whale0: '#3c5560', whale1: '#566f7a', whale2: '#7a94a0', whale3: '#a8b8bc',
};
const hx = P.hex, rgb = P.rgb, mix = P.mix, hash = U.hash;
K.hex = hx;
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.smooth = (pts, closed = true) => { const p = new Path2D(), n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = m(pts[n - 1], pts[0]); p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const q = pts[i], e = m(q, pts[(i + 1) % n]); p.quadraticCurveTo(q[0], q[1], e[0], e[1]); }
  if (closed) p.closePath(); return p; };
K.poly = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
const sw = (hexes, m = 0.35) => { const cs = hexes.map(hx); return (col, r) => mix(cs[(r() * cs.length) | 0], col, m); };
const jit = (c, r, a) => P.jitter(c, r, a);

// ======================= 笔触引擎（只在缓存时跑，不在每帧跑）=======================
// 每格一个独立随机数（由格子坐标＋种子哈希得出），与调用顺序、底稿颜色无关 → 笔位永远固定。
// 笔触量用「用户坐标」(ux,uy) 传给 pal/ang/mask：位图像素 / scale + (X0,Y0)。
function strokePass(dst, sd, SW, SH, o) {
  const { cell, len, width, seed = 1, pal, ang, alphaOnly = false, jitter = 22, mask, scale = 1, X0 = 0, Y0 = 0 } = o;
  dst.lineCap = 'round'; dst.lineWidth = width;
  const nx = Math.ceil(SW / cell) + 1, ny = Math.ceil(SH / cell) + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const r = U.rng((hash(i + seed * 131, j) * 4294967296) >>> 0);
    const px = i * cell + (r() - 0.5) * cell, py = j * cell + (r() - 0.5) * cell, ix = px | 0, iy = py | 0;
    if (ix < 0 || iy < 0 || ix >= SW || iy >= SH) continue;
    const k = (iy * SW + ix) * 4; if (alphaOnly && sd[k + 3] < 170) continue;
    const ux = px / scale + X0, uy = py / scale + Y0; if (mask && !mask(ux, uy)) continue;
    let col = [sd[k], sd[k + 1], sd[k + 2]]; col = pal ? pal(ux, uy, col, r) : jit(col, r, jitter);
    const a = ang ? ang(ux, uy) : 0, l = len * (0.7 + r() * 0.6), dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2;
    dst.strokeStyle = rgb(col); dst.beginPath(); dst.moveTo(px - dx, py - dy); dst.lineTo(px + dx, py + dy); dst.stroke();
  }
}
// 默认笔色：底稿色抖动，偶尔跳到邻近冷暖色（印象派的色彩分割）
const autoPal = (x, y, col, r) => { const u = r(); let c = jit(col, r, 20);
  if (u < 0.16) c = mix(c, [248, 214, 170], 0.22); else if (u < 0.26) c = mix(c, [120, 176, 168], 0.2); else if (u < 0.36) c = mix(c, [30, 50, 60], 0.16); return c; };
K.autoPal = autoPal;
// 精灵：平涂底稿 draw(g)（原点在锚点 (ax,ay)，坐标系 = 精灵局部）→ 笔触重画，只在 alpha 内出笔。返回 {cv,w,h,ax,ay}。
K.paint = (key, w, h, ax, ay, draw, passes, o = {}) => K.once('P|' + key, () => {
  const res = o.res || 1.5, cw = Math.ceil(w * res), ch = Math.ceil(h * res);
  const b = document.createElement('canvas'); b.width = cw; b.height = ch; const g = b.getContext('2d', { willReadFrequently: true });
  g.scale(res, res); g.translate(ax, ay); draw(g);
  const sd = g.getImageData(0, 0, cw, ch).data, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const d = cv.getContext('2d');
  for (const p of passes) strokePass(d, sd, cw, ch, { pal: autoPal, ...p, cell: p.cell * res, len: p.len * res, width: p.width * res, scale: res, X0: -ax, Y0: -ay, alphaOnly: true });
  return { cv, w, h, ax, ay };
});
// 在精灵上盖一层半透明色（只落在已有笔触上），用于水下/夜色变体
K.tint = (sp, key, fill) => K.once('T|' + key, () => { const cv = document.createElement('canvas'); cv.width = sp.cv.width; cv.height = sp.cv.height; const g = cv.getContext('2d');
  g.drawImage(sp.cv, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = typeof fill === 'function' ? fill(g, cv.height) : fill; g.fillRect(0, 0, cv.width, cv.height); return { ...sp, cv }; });
K.blit = (c, sp, x, y, s = 1, rot = 0, alpha = 1, flip = 1) => { c.save(); if (alpha < 1) c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(s * flip, s); c.drawImage(sp.cv, -sp.ax, -sp.ay, sp.w, sp.h); c.restore(); };
const dashes = (c, arr, w, col, alpha = 1) => { c.save(); c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = col; c.globalAlpha *= alpha; c.beginPath(); for (const [x, y, l, a = 0] of arr) { const dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2; c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); } c.stroke(); c.restore(); };

// ======================= 背景（8 种 tone，整层缓存）=======================
// tone: dawn 海日出｜noon 正午海｜dusk 暮色海｜night 夜海｜under 海下｜abyss 深渊（暗池用）｜land 陆地（草地＋天空）｜wall 室内暖墙（地板 y≈1350）
// 层比屏幕大一圈（M），所以 K.bg 可以画在 K.world 里随相机平移/拉远。
const M = 200, LW = W + 2 * M, LH = H + 2 * M;
K.HY = { dawn: 400, noon: 520, dusk: 620, night: 600, land: 820 };       // 地平线 y（水线/地平线）；under/abyss/wall 没有
K.SUN = { dawn: [215, 215], noon: [780, 190], dusk: [540, 610], night: [800, 240], land: [820, 300] };
const grad = (g, x0, y0, x1, y1, stops) => { const q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([p, col]) => q.addColorStop(p, col)); return q; };
const glow = (g, x, y, r0, R, rgbs, a0) => { const q = g.createRadialGradient(x, y, r0, x, y, R); q.addColorStop(0, `rgba(${rgbs},${a0})`); q.addColorStop(0.3, `rgba(${rgbs},${a0 * 0.75})`); q.addColorStop(1, `rgba(${rgbs},0)`); g.fillStyle = q; g.fillRect(x - R, y - R, 2 * R, 2 * R); };
const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const seaTone = (name, o) => {
  const hy = K.HY[name], [sx, sy] = K.SUN[name];
  return { hy, sx, sy, o, ground: o.ground,
    base(g) {
      g.fillStyle = grad(g, 0, -M, 0, hy, o.sky); g.fillRect(-M, -M, LW, hy + M + 2);
      glow(g, sx, sy, 10, o.glowR, o.glowRgb, o.glowA); if (o.sunR) disc(g, sx, sy, o.sunR, o.sunCol);
      g.save(); g.beginPath(); g.rect(-M, -M, LW, hy + M + 2); g.clip(); g.restore();
      g.fillStyle = grad(g, 0, hy, 0, H + M, o.sea); g.fillRect(-M, hy, LW, H + M - hy);
      const rg = g.createLinearGradient(0, hy, 0, hy + 760); rg.addColorStop(0, `rgba(${o.reflRgb},${o.reflA ?? 0.95})`); rg.addColorStop(1, `rgba(${o.reflRgb},0)`);
      g.fillStyle = rg; g.beginPath(); g.moveTo(sx - 60, hy); g.lineTo(sx + 60, hy); g.lineTo(sx + 60 + o.reflSpread, hy + 760); g.lineTo(sx - 60 - o.reflSpread * 0.6, hy + 760); g.closePath(); g.fill(); },
    pal: (() => { const Z = Object.fromEntries(Object.entries(o.z).map(([k, v]) => [k, sw(v[0], v[1] ?? 0.35)]));
      return (x, y, col, r) => { const d = Math.hypot(x - sx, y - sy);
        if (y < hy) { if (name !== 'night' && col[0] > 245 && col[1] > 232 && d < 85) return Z.glow([255, 240, 170], r); if (d < 150) return Z.glow(col, r); return d < 330 && Z.glow2 ? Z.glow2(col, r) : Z.sky(col, r); }
        if (col[0] > 200 && col[1] > 170 && col[2] < 225 && Math.abs(x - sx - (y - hy) * 0.1) < 190 + (y - hy) * 0.1) return Z.refl(col, r);
        return y < hy + 160 || r() < 0.12 ? Z.seaLt(col, r) : Z.sea(col, r); }; })(),
    ang: (x, y) => y < hy ? -0.08 + 0.1 * Math.sin(x * 0.01 + y * 0.02) : 0.03 * Math.sin(x * 0.02 + y * 0.05) + 0.05 * Math.sin(y * 0.03),
    fine: (x, y) => y > hy - 70 && y < hy + 170 || Math.hypot(x - sx, y - sy) < 160,
  };
};
const TONES = {
  dawn: seaTone('dawn', { sky: [[0, '#9fbcc4'], [0.55, '#e8d8c0'], [1, '#f6c8a0']], glowR: 560, glowRgb: '255,232,165', glowA: 0.95, sunR: 62, sunCol: '#fff6d0',
    sea: [[0, '#9cc8b8'], [0.3, '#5f9a9a'], [1, '#2f6a74']], reflRgb: '255,232,160', reflSpread: 200,
    z: { sky: [['#a8c4cc', '#c4d4d0', '#e4d6c0', '#f0d8b8', '#f6e0c0'], 0.3], glow: [['#fbe2a8', '#f6c890', '#ffeec0', '#f2b890', '#fff2cc'], 0.25], glow2: [['#fbe2a8', '#f6c890', '#ffeec0', '#f2b890', '#fff2cc'], 0.3],
      sea: [['#2f6a74', '#3f8088', '#4f8f93', '#5f9f9a', '#78b2a8', '#3a7480'], 0.4], seaLt: [['#a8d0c0', '#b8dcc8', '#d4e4c8', '#8cc0b0', '#e8e8c8'], 0.35], refl: [['#ffe9a0', '#f8d880', '#fff4c0', '#f2c868', '#ffffff'], 0.2] } }),
  noon: seaTone('noon', { sky: [[0, '#86bcc8'], [0.55, '#cfe6dc'], [1, '#f6f0d6']], glowR: 480, glowRgb: '255,250,215', glowA: 0.7, sunR: 54, sunCol: '#fffbe0',
    sea: [[0, '#a8dccb'], [0.3, '#4fa5a2'], [1, '#256f7c']], reflRgb: '255,250,215', reflSpread: 120,
    z: { sky: [['#8fc4d0', '#a8d4d4', '#cfe6dc', '#e8efe0', '#bde0e0'], 0.3], glow: [['#fff6c8', '#fff0a8', '#ffffff', '#f8e8a0'], 0.25], glow2: [['#e8f0d8', '#f4f0d0', '#d8ecdc', '#fff6d8'], 0.3],
      sea: [['#256f7c', '#378a90', '#4fa5a2', '#5fb4aa', '#3a8890'], 0.4], seaLt: [['#a8dccb', '#c8ecd4', '#e4f2d0', '#8fcfbf'], 0.35], refl: [['#fffbd8', '#fff2b0', '#ffffff'], 0.2] } }),
  dusk: seaTone('dusk', { ground: '#cdb6a6', sky: [[0, '#7fa0a6'], [0.5, '#e6b894'], [1, '#f59a62']], glowR: 640, glowRgb: '255,170,110', glowA: 0.85, sunR: 118, sunCol: '#f58a4e',
    sea: [[0, '#f0b080'], [0.14, '#9a8c80'], [0.5, '#3d6e7a'], [1, '#1f4654']], reflRgb: '255,190,120', reflSpread: 340,
    z: { sky: [['#7fa0a6', '#a8aaa0', '#d8b098', '#f0a878', '#f6c090'], 0.3], glow: [['#f8a060', '#f6b070', '#ffc890', '#f08a50'], 0.25], glow2: [['#e8a078', '#f0b088', '#d8a090', '#f6c090'], 0.3],
      sea: [['#1f4654', '#2f6070', '#3d6e7a', '#4a7c84', '#2a5666'], 0.4], seaLt: [['#e8a878', '#d89a78', '#c8a088', '#f0b080'], 0.35], refl: [['#ffc080', '#f8a060', '#ffd8a0', '#ffb070'], 0.2] } }),
  night: seaTone('night', { ground: '#2c5560', sky: [[0, '#0a1f2a'], [1, '#365e6a']], glowR: 380, glowRgb: '255,240,200', glowA: 0.45, sunR: 58, sunCol: '#fff2d0',
    sea: [[0, '#1c4452'], [0.3, '#143642'], [1, '#0a2029']], reflRgb: '255,240,200', reflA: 0.5, reflSpread: 120,
    z: { sky: [['#0f2a36', '#16384a', '#1c4452', '#265a66'], 0.35], glow: [['#fff2d0', '#f0e0b0', '#c8d8c0'], 0.25], glow2: [['#2c5260', '#386470', '#4a7a80'], 0.35],
      sea: [['#0c2430', '#143642', '#1a404c', '#245462', '#102c38'], 0.4], seaLt: [['#1c4452', '#245462', '#2d5a66'], 0.4], refl: [['#fff0c8', '#e8dcb0', '#fffae0'], 0.25] } }),
};
// 海下 / 深渊：竖向渐变＋斜光柱（光柱在底稿里，笔触跟着它走）
const underTone = (ground, o) => ({ hy: -1, ground, base(g) {
    g.fillStyle = grad(g, 0, -M, 0, H + M, o.stops); g.fillRect(-M, -M, LW, LH);
    for (const [x, w, a] of o.shafts) { const q = g.createLinearGradient(0, -M, 0, 1200); q.addColorStop(0, `rgba(${o.shaftRgb},${a})`); q.addColorStop(1, `rgba(${o.shaftRgb},0)`);
      g.fillStyle = q; g.beginPath(); g.moveTo(x - w * 0.5, -M); g.lineTo(x + w * 0.5, -M); g.lineTo(x + w * 1.6, 1200); g.lineTo(x - w * 0.8, 1200); g.closePath(); g.fill(); } },
  pal: (() => { const Z = Object.fromEntries(Object.entries(o.z).map(([k, v]) => [k, sw(v, 0.35)])); return (x, y, col, r) => col[0] > o.shaftThr ? Z.shaft(col, r) : (y + (r() - 0.5) * 220) < 520 ? Z.top(col, r) : (y + (r() - 0.5) * 220) < 1150 ? Z.mid(col, r) : Z.deep(col, r); })(),
  ang: (x, y) => -0.35 + 0.3 * Math.sin(x * 0.012 + y * 0.01), fine: () => false });
TONES.under = underTone('#6aa89e', { stops: [[0, '#6cc0b4'], [0.35, '#3a8a94'], [1, '#10394a']], shaftRgb: '235,246,205', shafts: [[220, 260, 0.2], [560, 320, 0.18], [900, 220, 0.16]], shaftThr: 120,
  z: { top: ['#6cc0b4', '#7ccbbc', '#58b0a8', '#8cd4c0'], mid: ['#3a8a94', '#2f7a86', '#4a9a9c', '#2a7080'], deep: ['#10394a', '#17485a', '#1f5868', '#0d3040'], shaft: ['#d8f0d0', '#e8f6d8', '#c8e8c8', '#b8e0c0'] } });
TONES.abyss = underTone('#14424e', { stops: [[0, '#14404e'], [0.4, '#0b2a36'], [1, '#04121a']], shaftRgb: '120,190,180', shafts: [[540, 260, 0.16]], shaftThr: 60,
  z: { top: ['#14404e', '#1a4a58', '#103642', '#1f5560'], mid: ['#0b2a36', '#0f3340', '#082430', '#16404c'], deep: ['#04121a', '#06202a', '#031018', '#0a2a34'], shaft: ['#2f6a74', '#3a7a80', '#245862'] } });
// 陆地：天空＋草地
{ const hy = K.HY.land, [sx, sy] = K.SUN.land, Zs = { sky: sw(['#9fc0c8', '#b8d4cc', '#e4dcc4', '#f4d8b8', '#f7e4c4'], 0.3), glow: sw(['#fff0b8', '#fbe2a8', '#ffeec0', '#f8d898'], 0.25),
    gr: sw(['#6f9a62', '#7fa86c', '#5f8a5a', '#8fb070', '#a8b878', '#4f7a50'], 0.4), grLt: sw(['#b0c888', '#c8d490', '#9bb878', '#e0dca0'], 0.35) };
  TONES.land = { hy, base(g) { g.fillStyle = grad(g, 0, -M, 0, hy, [[0, '#9fc0c8'], [0.6, '#ecdcc2'], [1, '#f7d0a8']]); g.fillRect(-M, -M, LW, hy + M + 2); glow(g, sx, sy, 10, 520, '255,236,170', 0.9); disc(g, sx, sy, 64, '#fff6d0');
      g.fillStyle = grad(g, 0, hy, 0, H + M, [[0, '#a8c488'], [0.25, '#6f9a62'], [1, '#3f7050']]); g.fillRect(-M, hy, LW, H + M - hy);
      g.fillStyle = 'rgba(246,220,170,.5)'; g.beginPath(); g.ellipse(540, hy + 6, 700, 26, 0, 0, TAU); g.fill(); },
    pal: (x, y, col, r) => y < hy ? (Math.hypot(x - sx, y - sy) < 200 ? Zs.glow(col, r) : Zs.sky(col, r)) : (y < hy + 130 || r() < 0.12 ? Zs.grLt(col, r) : Zs.gr(col, r)),
    ang: (x, y) => y < hy ? -0.06 + 0.08 * Math.sin(x * 0.01 + y * 0.02) : -1.25 + 0.5 * Math.sin(x * 0.04 + y * 0.03) + (x - 540) * 0.0008, fine: (x, y) => y > hy - 60 && y < hy + 120 }; }
// 室内暖墙（墙＋窗光＋地板）
{ const FY = 1350, Zw = { wall: sw(['#f4dcbc', '#efd0a8', '#f8e4c8', '#e8c4a0', '#f2cfae'], 0.3), glow: sw(['#fff0c0', '#ffe8a8', '#fff8e0', '#f8dc98'], 0.25), fl: sw(['#b98a62', '#a67852', '#c89a70', '#8a6044'], 0.4) };
  TONES.wall = { hy: -1, base(g) { g.fillStyle = grad(g, 0, -M, 0, FY, [[0, '#f4dcbc'], [1, '#e6b890']]); g.fillRect(-M, -M, LW, FY + M); glow(g, 900, 180, 10, 820, '255,238,170', 0.8);
      g.fillStyle = grad(g, 0, FY, 0, H + M, [[0, '#b98a62'], [1, '#7a5238']]); g.fillRect(-M, FY, LW, H + M - FY); g.fillStyle = 'rgba(244,236,214,.9)'; g.fillRect(-M, FY - 26, LW, 28); },
    pal: (x, y, col, r) => y > FY ? Zw.fl(col, r) : (col[0] > 250 && col[1] > 230 ? Zw.glow(col, r) : Zw.wall(col, r)),
    ang: (x, y) => y > FY ? 0.02 * Math.sin(x * 0.02) : -0.5 + 0.35 * Math.sin(x * 0.011 + y * 0.016), fine: (x, y) => y > FY - 60 && y < FY + 80 }; }

const bgLayer = tone => K.once('BG|' + tone, () => {
  const T = TONES[tone]; if (!T) throw new Error('K.bg: 没有这个 tone：' + tone);
  const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH; const g = cv.getContext('2d', { willReadFrequently: true });
  g.translate(M, M); T.base(g); g.setTransform(1, 0, 0, 1, 0, 0);
  const sd = g.getImageData(0, 0, LW, LH).data; g.fillStyle = T.ground || '#f3e8dc'; g.fillRect(0, 0, LW, LH);
  const common = { pal: T.pal, ang: T.ang, scale: 1, X0: -M, Y0: -M };
  strokePass(g, sd, LW, LH, { ...common, cell: 10, len: 22, width: 7, seed: 21 });
  strokePass(g, sd, LW, LH, { ...common, cell: 6, len: 12, width: 4.5, seed: 22, mask: T.fine });
  return cv; });
K.warm = (tones = Object.keys(TONES)) => tones.forEach(bgLayer);   // 可选：开场先把用到的底层画好（每个 tone 首次约 0.4–0.9 秒）
// 云：先画成精灵，每帧只漂
const CLOUD = { dawn: ['#fff0e0', '#f8d0bc', '#ffe4d0', '#f4c0b0'], noon: ['#ffffff', '#f4f8ee', '#e8f0e8', '#fffaf0'], dusk: ['#f8c0a0', '#f0a888', '#fcd0b0', '#e89a80'], land: ['#fff4e4', '#fbe4d0', '#fffaf0', '#f4d4c0'], night: ['#3a6470', '#2f5662', '#46747c', '#284c58'] };
const cloudSp = (kind, v) => K.paint(`cloud|${kind}|${v}`, 520, 170, 260, 85, g => { const cols = CLOUD[kind]; g.fillStyle = cols[0]; const sets = [[[0, 0, 160, 38], [-95, 10, 105, 28], [105, 12, 115, 30], [22, -22, 95, 30]], [[0, 4, 190, 34], [-110, 12, 100, 26], [90, -14, 100, 34]], [[-30, 0, 150, 32], [70, 8, 120, 28], [-120, 14, 80, 22], [30, -26, 80, 28]]][v % 3];
  for (const [dx, dy, rx, ry] of sets) { g.beginPath(); g.ellipse(dx, dy, rx, ry, 0, 0, TAU); g.fill(); } }, [{ cell: 7, len: 18, width: 6, seed: 40 + v, pal: (x, y, col, r) => sw(CLOUD[kind], 0.3)(col, r), ang: () => -0.04 }], { res: 1 });
const SKYTONE = { dawn: 1, noon: 1, dusk: 1, land: 1, night: 1 };
// 动态点缀：全部 hash 固定位置，只做漂移/明灭
K.bg = (c, t, o = {}) => {
  const tone = o.tone || 'dawn', T = TONES[tone] || (() => { throw new Error('K.bg: 没有这个 tone：' + tone); })(); K.tone = tone;
  c.drawImage(bgLayer(tone), -M, -M);
  const hy = T.hy, [sx, sy] = K.SUN[tone] || [540, 300], X0 = -160, XW = W + 320;
  if (SKYTONE[tone] && o.clouds !== false) for (let i = 0; i < 3; i++) { const sp = 7 + i * 3, y = (tone === 'dusk' ? 160 : 120) + i * 150 + hash(i, 3) * 40, x = ((hash(i, 9) * (XW + 600) + t * sp) % (XW + 600)) - 300 + X0;
    if (y < hy - 60) K.blit(c, cloudSp(tone, i), x, y, 0.8 + i * 0.12, 0, tone === 'night' ? 0.55 : 0.9); }
  if (hy > 0) {
    // 日/月光斑（反射柱里的金色短笔）
    const gl = [], gc = { dawn: 'rgba(255,238,170,.95)', noon: 'rgba(255,252,220,.95)', dusk: 'rgba(255,208,140,.95)', night: 'rgba(255,246,210,.9)', land: null }[tone];
    if (gc) { for (let i = 0; i < 34; i++) { const yy = hy + 10 + hash(i, 5) * 330, a = 0.45 + 0.55 * Math.sin(t * (2.2 + hash(i, 6) * 2) + i * 1.7), spread = 40 + (yy - hy) * 0.2; gl.push([sx + (hash(i, 7) - 0.5) * 2 * spread + Math.sin(t * 0.7 + i) * 8, yy, 26 + hash(i, 8) * 56, 0, a]); }
      c.save(); c.lineCap = 'round'; c.strokeStyle = gc; c.lineWidth = 5; for (const [x, y, l, , a] of gl) { c.globalAlpha = a * 0.9; c.beginPath(); c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y); c.stroke(); } c.restore(); }
    // 水面浪痕：浅色横向短笔，缓缓漂移、明灭
    if (tone !== 'land') { const n = 44, arr = [], arr2 = []; for (let i = 0; i < n; i++) { const yy = hy + 40 + Math.pow(hash(i, 11), 0.8) * (H - hy - 120), sc = 0.6 + (yy - hy) / (H - hy), x = ((hash(i, 12) * XW + t * (6 + hash(i, 13) * 10) * sc) % XW) + X0, l = 30 + hash(i, 14) * 50 * sc, a = Math.sin(t * 1.3 + i * 2.1) > 0.15; (a ? arr : arr2).push([x, yy, l, 0]); }
      dashes(c, arr, 5, tone === 'night' ? 'rgba(170,205,200,.32)' : 'rgba(246,242,228,.8)'); dashes(c, arr2, 4, tone === 'night' ? 'rgba(120,170,170,.2)' : 'rgba(210,235,220,.45)'); }
    else { // 草地：风吹的亮笔
      const arr = []; for (let i = 0; i < 30; i++) { const yy = hy + 30 + hash(i, 15) * 700, x = hash(i, 16) * W; arr.push([x + Math.sin(t * 1.4 + i) * 6, yy, 22 + hash(i, 17) * 20, -1.2 + Math.sin(t * 1.4 + i) * 0.2]); } dashes(c, arr, 5, 'rgba(226,232,170,.7)'); }
    if (tone === 'night') { c.save(); for (let i = 0; i < 30; i++) { const x = hash(i, 20) * W, y = hash(i, 21) * (hy - 40), a = 0.3 + 0.7 * Math.max(0, Math.sin(t * (1 + hash(i, 22) * 2) + i * 3)); c.globalAlpha = a; c.fillStyle = '#fff4d0'; c.fillRect(x - 2.5, y - 2.5, 5, 5); } c.restore(); }
  } else if (tone === 'under' || tone === 'abyss') {
    const col = tone === 'under' ? 'rgba(236,248,214,.55)' : 'rgba(120,190,185,.32)', arr = [];
    for (let i = 0; i < 26; i++) { const x = hash(i, 30) * W + Math.sin(t * 0.5 + i) * 14, y = ((hash(i, 31) * 1.2 * H - t * (14 + hash(i, 32) * 22)) % (H + 80) + H + 80) % (H + 80) - 40; arr.push([x, y, 5 + hash(i, 33) * 8, -1.4]); }
    dashes(c, arr, 4.5, col);
    if (tone === 'under') { c.save(); c.lineWidth = 3.5; c.strokeStyle = 'rgba(240,252,230,.6)'; for (let i = 0; i < 12; i++) { const x = hash(i, 34) * W + Math.sin(t * 1.1 + i * 2) * 10, y = ((hash(i, 35) * 1.3 * H - t * (50 + hash(i, 36) * 40)) % (H + 100) + H + 100) % (H + 100) - 50; c.beginPath(); c.arc(x, y, 7 + hash(i, 37) * 12, 0, TAU); c.stroke(); } c.restore(); }
  } else if (tone === 'wall') { // 窗光斑：暖黄短笔斜纹，缓缓漂移
    const arr = []; for (let k = 0; k < 4; k++) for (let i = 0; i < 16; i++) { const bx = 880 - k * 150 + Math.sin(t * 0.35 + k) * 24, by = 520 + k * 260 + Math.cos(t * 0.3 + k * 2) * 14; arr.push([bx + (hash(i, 40 + k) - 0.5) * 200, by + (hash(i, 50 + k) - 0.5) * 120, 34 + hash(i, 60 + k) * 30, -0.7]); }
    dashes(c, arr, 6, 'rgba(255,240,180,.55)'); }
  if (o.dim) { c.fillStyle = `rgba(14,34,42,${o.dim})`; c.fillRect(-M, -M, LW, LH); }
};

// ======================= 鲸鱼 =======================
// 朝右；局部坐标原点 = 身体中心；身长约 890。尾鳍单独一块，绕尾柄关节摆。
const WB = [[455, 35], [430, -30], [370, -95], [270, -140], [130, -165], [-40, -160], [-190, -120], [-300, -75], [-380, -45], [-432, -40], [-436, -2], [-390, 25], [-300, 70], [-180, 130], [-20, 175], [150, 190], [300, 170], [400, 120], [450, 75]];
const FL = [[10, 10], [-10, -30], [-50, -70], [-110, -95], [-172, -92], [-132, -58], [-106, -30], [-122, -4], [-152, 26], [-96, 20], [-50, 26], [-8, 36]];
const JOINT = [-428, -22];
const WCOL = sw(['#4a6874', '#5a7884', '#6a8892', '#3c5560', '#7a94a0', '#8aa4a8'], 0.45), WLIT = sw(['#b8c4c0', '#d8c8b0', '#c4b4a0', '#a8bcc0', '#e8d4b8'], 0.35), WDEEP = sw(['#2f5660', '#3a666e', '#2a4c58', '#487a7c', '#35606a'], 0.4);
const whalePal = (x, y, col, r) => { const L = (col[0] + col[1] + col[2]) / 3; if (L > 150 || (y > 130 && r() < 0.5)) return WLIT(col, r); return L < 80 ? WDEEP(col, r) : WCOL(col, r); };
const whaleAng = (x, y) => x < -300 ? -0.6 : y > 90 ? 0.12 - (x - 100) * 0.0004 : -0.16 + (x + 100) * 0.0004 - 0.3 * Math.max(0, (x - 300) / 200);
const whaleSp = () => K.paint('whale|body', 980, 430, 490, 215, g => {
  const body = K.smooth(WB), bg = g.createLinearGradient(0, -165, 0, 190); bg.addColorStop(0, '#3c5560'); bg.addColorStop(0.5, '#587480'); bg.addColorStop(0.82, '#8ea2a8'); bg.addColorStop(1, '#b4bcb4');
  g.fillStyle = bg; g.fill(body);
  g.fillStyle = '#3a5460'; g.fill(K.smooth([[130, 120], [70, 200], [40, 228], [118, 214], [190, 168], [210, 130]]));      // 胸鳍
}, [{ cell: 7, len: 17, width: 6, seed: 61, pal: whalePal, ang: whaleAng }, { cell: 5.5, len: 10, width: 4, seed: 62, pal: whalePal, ang: whaleAng, mask: (x, y) => x > 120 || y > 120 }]);
const flukeSp = () => K.paint('whale|fluke', 240, 170, 200, 120, g => { g.fillStyle = grad(g, 0, -100, 0, 40, [[0, '#4c6a76'], [1, '#6a8490']]); g.fill(K.smooth(FL)); },
  [{ cell: 6, len: 13, width: 5, seed: 63, pal: whalePal, ang: () => -0.7 }]);
const UNDER = { sea: 'rgba(36,104,116,.74)', dark: 'rgba(6,26,36,.84)' };
const whaleParts = (c, under) => { const b = whaleSp(), f = flukeSp(); if (under) { var bb = K.tint(b, 'whale|body|' + under, UNDER[under]), ff = K.tint(f, 'whale|fluke|' + under, UNDER[under]); } return [under ? bb : b, under ? ff : f]; };
const MOODS = { calm: { eye: 1, brow: 0, mouth: 4 }, alert: { eye: 1.5, brow: -1, mouth: 0 }, happy: { eye: 1, arc: 1, brow: 0, mouth: 14 }, sleep: { eye: 0, closed: 1, mouth: 2 }, sad: { eye: 1, brow: 1, mouth: -12 } };
const POSES = { swim: { rot: 0, wl: null }, surface: { rot: 0, wl: 62 }, breach: { rot: -0.72, wl: null }, dive: { rot: 1.12, wl: -110 }, rise: { rot: -0.28, wl: 40 } };
// K.whale(c,x,y,s,{pose,mood,dir,spout,t,rot,wl,under,alpha,wag}) → {blow,eye,tail,mouth}（屏幕坐标，给喷水/引线用）
// pose: swim 游｜surface 背浮出水面（wl 为水线相对中心的 y 偏移，默认 62；水下部分自动染青）｜breach 跃出｜dive 扎入（只露尾）｜rise 抬头斜浮
// mood: calm alert happy sleep sad｜dir 1 向右 -1 向左｜spout 0..1 喷水量｜t 全片时间（摆尾/起伏）｜under 'sea'|'dark' 整只在水下
K.whale = (c, x, y, s, o = {}) => {
  const { pose = 'swim', mood = 'calm', dir = 1, t = 0, spout = 0, under = null, alpha = 1 } = o, PS = POSES[pose] || POSES.swim, md = MOODS[mood] || MOODS.calm;
  const rot = o.rot ?? PS.rot, wlOff = o.wl ?? PS.wl, bob = Math.sin(t * 1.5 + (o.ph || 0)) * 6 * s, wag = (o.wag ?? 1) * Math.sin(t * 2.3 + (o.ph || 0)) * 0.2, yy = y + bob;
  const wl = wlOff == null ? null : (o.wlAbs ?? yy + wlOff * s);
  const [b, f] = whaleParts(c, under);
  const draw = (cc, nb, nf, det) => { cc.save(); cc.translate(x, yy); cc.rotate(rot); cc.scale(s * dir, s);
    cc.save(); cc.translate(JOINT[0], JOINT[1]); cc.rotate(wag); cc.drawImage(nf.cv, -nf.ax, -nf.ay, nf.w, nf.h); cc.restore();
    cc.drawImage(nb.cv, -nb.ax, -nb.ay, nb.w, nb.h); if (det) whaleFace(cc, md, t); cc.restore(); };
  c.save(); if (alpha < 1) c.globalAlpha *= alpha;
  if (wl == null) draw(c, b, f, !under);
  else { const lo = K.tint(whaleSp(), 'whale|body|sea', UNDER.sea), lf = K.tint(flukeSp(), 'whale|fluke|sea', UNDER.sea);
    c.save(); c.beginPath(); c.rect(x - 2400, yy - 4000, 4800, wl - (yy - 4000)); c.clip(); draw(c, b, f, true); c.restore();
    c.save(); c.beginPath(); c.rect(x - 2400, wl, 4800, 4000); c.clip(); draw(c, lo, lf, false); c.restore();
    const fw = (Math.abs(rot) > 0.8 ? 130 : 420 * Math.cos(rot)) * s, arr = [], arr2 = []; for (let i = 0; i < 22; i++) { const px = x + (hash(i, 70) - 0.5) * 2 * fw, a = Math.sin(t * 2 + i * 1.9) > -0.3; (a ? arr : arr2).push([px, wl + (hash(i, 71) - 0.5) * 12 * s, (26 + hash(i, 72) * 34) * s, 0]); }
    dashes(c, arr, 6 * Math.max(0.6, s), 'rgba(250,246,230,.92)'); dashes(c, arr2, 4, 'rgba(236,244,232,.5)'); }
  c.restore();
  const cs = Math.cos(rot), sn = Math.sin(rot), P2 = (lx, ly) => [x + (lx * dir * cs - ly * sn) * s, yy + (lx * dir * sn + ly * cs) * s];
  const out = { blow: P2(210, -156), eye: P2(320, 20), tail: P2(-430 - 150, -80), mouth: P2(380, 55), head: P2(420, 0), top: P2(0, -170) };
  if (spout > 0 && (wl == null || out.blow[1] < wl)) K.spout(c, t, out.blow[0], out.blow[1], 330 * s * spout, { amt: spout });
  return out; };
// 眼、嘴线、喉褶（笔触之后清晰叠上）——在鲸局部坐标里
function whaleFace(c, md, t) {
  c.save(); c.lineCap = 'round';
  c.strokeStyle = 'rgba(30,44,52,.78)'; c.lineWidth = 6; c.beginPath(); c.moveTo(446, 52); c.quadraticCurveTo(390, 62 + md.mouth * 0.3, 318, 54 - md.mouth * 0.6); c.stroke();
  const ex = 322, ey = 20, k = md.eye;
  if (md.closed) { c.lineWidth = 5; c.beginPath(); c.moveTo(ex - 14, ey); c.quadraticCurveTo(ex, ey + 9, ex + 14, ey); c.stroke(); }
  else if (md.arc) { c.lineWidth = 6; c.beginPath(); c.moveTo(ex - 14, ey + 4); c.quadraticCurveTo(ex, ey - 12, ex + 14, ey + 4); c.stroke(); }
  else { c.fillStyle = '#1e2c34'; c.beginPath(); c.arc(ex, ey, 10 * k, 0, TAU); c.fill(); c.fillStyle = '#fff4dc'; c.beginPath(); c.arc(ex + 3 * k, ey - 3 * k, 3.2 * k, 0, TAU); c.fill();
    if (md.brow) { c.strokeStyle = 'rgba(30,44,52,.8)'; c.lineWidth = 6; c.beginPath(); c.moveTo(ex - 20, ey - 22 + md.brow * 6); c.lineTo(ex + 20, ey - 22 - md.brow * 8); c.stroke(); } }
  c.strokeStyle = 'rgba(214,224,222,.55)'; c.lineWidth = 4; for (let i = 0; i < 5; i++) { const a = 100 + i * 60, b = 120 + i * 3, d = 280 + i * 20, e = 100 + i * 6; c.beginPath(); c.moveTo(a + 100, b + 40); c.quadraticCurveTo((a + d + 100) / 2, b + 60, d + 120, e + 22); c.stroke(); }
  c.restore(); }
// 喷水/水花粒子：抛物线上的短笔，循环 ＋ 底部白雾。amt 0..1
const particles = (c, t, x, y, o) => { const { n = 56, h = 320, spread = 0.3, seed = 80, w = 6, col = '255,252,240', rate = 0.9 } = o; c.save(); c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = `rgb(${col})`;
  for (let i = 0; i < n; i++) { const u = (t * rate + hash(i, seed)) % 1, vx = (hash(i, seed + 1) - 0.5) * 2 * spread * h * 0.5, px = x + vx * u * 2, py = y - h * 4 * u * (1 - u), dvy = -h * 4 * (1 - 2 * u), ang = Math.atan2(dvy, vx * 2), l = 14 + hash(i, seed + 3) * 18;
    c.globalAlpha = (u < 0.85 ? 1 : (1 - u) / 0.15) * (0.55 + 0.45 * hash(i, seed + 2)); c.beginPath(); c.moveTo(px, py); c.lineTo(px - Math.cos(ang) * l, py - Math.sin(ang) * l); c.stroke(); }
  c.restore(); };
K.spout = (c, t, x, y, h, o = {}) => { const a = o.amt ?? 1; c.save(); const q = c.createRadialGradient(x, y - h * 0.1, 4, x, y - h * 0.1, h * 0.45); q.addColorStop(0, `rgba(255,252,240,${0.55 * a})`); q.addColorStop(1, 'rgba(255,252,240,0)'); c.fillStyle = q; c.fillRect(x - h * 0.5, y - h * 0.7, h, h * 0.8); c.restore();
  c.save(); c.fillStyle = 'rgba(255,252,240,.9)'; for (let i = 0; i < 3; i++) { const sw0 = Math.sin(t * 3 + i * 2) * 10, hh = h * (0.62 + 0.1 * Math.sin(t * 2.4 + i)), ox = (i - 1) * 10; c.beginPath(); c.moveTo(x + ox - 13, y); c.quadraticCurveTo(x + ox - 6 + sw0 * 0.3, y - hh * 0.5, x + ox + (i - 1) * 26 + sw0, y - hh); c.quadraticCurveTo(x + ox + 6 + sw0 * 0.3, y - hh * 0.5, x + ox + 13, y); c.fill(); } c.restore();
  particles(c, t, x, y, { n: Math.round(44 * a) + 10, h: h * 0.9, spread: 0.45, seed: 80, w: 7 * Math.max(0.7, h / 330), rate: 0.8 }); };
// 水花：落水处的喷溅 K.splash(c,t,x,y,w,amt)
K.splash = (c, t, x, y, w = 300, amt = 1) => { particles(c, t, x, y, { n: Math.round(40 * amt) + 6, h: w * 0.9, spread: 0.55, seed: 90, w: 6, rate: 0.7 }); dashes(c, Array.from({ length: 14 }, (_, i) => [x + (hash(i, 95) - 0.5) * w * 1.3, y + (hash(i, 96) - 0.5) * 14, 24 + hash(i, 97) * 34, 0]), 6, 'rgba(250,246,230,.85)'); };
K.glints = (c, pts, t, o = {}) => { c.save(); c.lineCap = 'round'; c.strokeStyle = o.col || 'rgba(255,238,170,.95)';
  pts.forEach(([x, y, l], i) => { c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.7); c.lineWidth = o.w || 5; const dx = o.vert ? 0 : l / 2, dy = o.vert ? l / 2 : 0; c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke(); }); c.restore(); };
K.ripples = (c, x, y, rx, ry, n, t, col = 'rgba(246,242,228,.75)') => { c.save(); c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 5;
  for (let i = 0; i < n; i++) { const q = (i + (t * 0.3) % 1) / n; c.globalAlpha = (1 - q) * 0.9; c.beginPath(); c.ellipse(x, y, rx * (0.5 + q), ry * (0.5 + q), 0, 0.2, TAU - 0.2); c.setLineDash([36, 20]); c.stroke(); } c.restore(); };
// 前景浪线：K.wave(c,t,y,{x0,x1,rows,amp,col,alpha,speed,w})  虚线随时间流动，多行叠成浪带
K.wave = (c, t, y, o = {}) => { const { x0 = -40, x1 = W + 40, rows = 5, amp = 10, col = 'rgba(250,246,232,.85)', alpha = 1, speed = 40, w = 7, gap = 26 } = o; c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.globalAlpha *= alpha;
  for (let r = 0; r < rows; r++) { c.lineWidth = w * (0.7 + 0.3 * (r % 2)); c.setLineDash([44 + r * 6, 30 + (r % 3) * 8]); c.lineDashOffset = -(t * speed * (1 + r * 0.12)) * (r % 2 ? -1 : 1); c.beginPath();
    for (let x = x0; x <= x1; x += 24) { const yy = y + r * gap + Math.sin(x * 0.014 + t * 1.2 + r * 1.7) * amp + Math.sin(x * 0.031 - t * 0.8 + r) * amp * 0.4; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); } c.restore(); };
// 小鱼（散户）：K.fish(c,x,y,s,{col,dir,t,ph}) ／ K.school(c,t,x,y,n,spread,s,{dir,cols})
const FISHC = ['#f0a050', '#e0785a', '#f4c25a', '#78b2a8', '#ec9a8a', '#d8c070'];
const fishSp = col => K.paint('fish|' + col, 150, 90, 75, 45, g => { g.fillStyle = col; g.beginPath(); g.ellipse(-4, 0, 52, 26, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-40, 0); g.lineTo(-76, -26); g.lineTo(-70, 0); g.lineTo(-76, 26); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,244,220,.5)'; g.beginPath(); g.ellipse(0, 12, 38, 9, 0, 0, TAU); g.fill(); }, [{ cell: 4, len: 8, width: 3.2, seed: 66, ang: () => 0.1 }]);
K.fish = (c, x, y, s, o = {}) => { const { col = FISHC[0], dir = 1, t = 0, ph = 0 } = o, sp = fishSp(col); K.blit(c, sp, x, y + Math.sin(t * 2 + ph) * 3 * s, s, Math.sin(t * 5 + ph) * 0.06, 1, dir);
  c.save(); c.translate(x, y); c.scale(s * dir, s); c.fillStyle = '#1e2c34'; c.beginPath(); c.arc(30, -6, 4.5, 0, TAU); c.fill(); c.restore(); };
K.school = (c, t, x, y, n, spread, s, o = {}) => { const { dir = 1, cols = FISHC, speed = 18 } = o; for (let i = 0; i < n; i++) { const px = x + (hash(i, 100) - 0.5) * spread * 2 + Math.sin(t * 0.8 + i) * 12 + dir * ((t * speed + hash(i, 101) * 40) % 40), py = y + (hash(i, 102) - 0.5) * spread * 0.8 + Math.sin(t * 1.3 + i * 2) * 6;
  K.fish(c, px, py, s * (0.8 + hash(i, 103) * 0.4), { col: cols[i % cols.length], dir, t, ph: i }); } };

// ======================= 人物（印象派笔触着色的剪影，不画五官）=======================
const SKIN = ['#e8b88c', '#d09a68', '#b07a4c', '#8a5a3c'], HAIR = ['#2b2420', '#4a3426', '#7a5a3a', '#c9a050', '#6a6a6a'];
const COATS = { ink: '#2f4a56', teal: '#3f8088', rose: '#c4685a', ochre: '#d8a040', cream: '#e8dcc0', green: '#4f8a5e', brown: '#7a5a48', slate: '#5a7480', red: '#C0392B' };
K.COATS = COATS;
const limb = (g, pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
// 手臂/腿的关节点（局部，脚底原点，身高约 320）
const POSE = {
  stand: { legs: [[[-13, -150], [-16, -78], [-17, -8]], [[13, -150], [16, -78], [17, -8]]], arms: [[[-40, -256], [-50, -196], [-46, -140]], [[40, -256], [50, -196], [46, -140]]], dy: 0 },
  walk0: { legs: [[[-13, -150], [-34, -80], [-58, -10]], [[13, -150], [24, -84], [30, -8]]], arms: [[[-40, -256], [-30, -196], [-18, -146]], [[40, -256], [58, -204], [76, -160]]], dy: 0 },
  walk1: { legs: [[[-13, -150], [-24, -84], [-30, -8]], [[13, -150], [34, -80], [58, -10]]], arms: [[[-40, -256], [-58, -204], [-76, -160]], [[40, -256], [30, -196], [18, -146]]], dy: 0 },
  point: { legs: [[[-13, -150], [-16, -78], [-17, -8]], [[13, -150], [16, -78], [17, -8]]], arms: [[[-40, -256], [-50, -196], [-46, -140]], [[40, -256], [100, -270], [166, -296]]], dy: 0 },
  raise: { legs: [[[-13, -150], [-16, -78], [-17, -8]], [[13, -150], [16, -78], [17, -8]]], arms: [[[-40, -256], [-50, -196], [-46, -140]], [[40, -256], [62, -312], [60, -372]]], dy: 0 },
  hold: { legs: [[[-13, -150], [-16, -78], [-17, -8]], [[13, -150], [16, -78], [17, -8]]], arms: [[[-40, -256], [-48, -200], [-6, -222]], [[40, -256], [48, -200], [10, -226]]], dy: 0, phone: [2, -240] },
  sit: { legs: [[[0, -106], [82, -112], [90, -8]], [[10, -106], [96, -108], [108, -8]]], arms: [[[-4, -214], [40, -170], [96, -156]], [[10, -214], [52, -166], [108, -152]]], dy: 0, seat: true },
};
const personSp = (pose, coat, skin, hair, hs) => K.paint(`person|${pose}|${coat}|${skin}|${hair}|${hs}`, 260, 420, 130, 400, g => {
  const P0 = POSE[pose] || POSE.stand, cc = COATS[coat] || coat, trs = rgb(mix(hx(cc), [30, 44, 54], 0.5)), sk = SKIN[skin % SKIN.length], hr = HAIR[hair % HAIR.length], hy0 = P0.seat ? -106 : -150, top = P0.seat ? -216 : -262, sh = P0.seat ? 0 : 0, hd = top - 44;
  if (P0.seat) { g.fillStyle = '#8a6a48'; g.fillRect(-52, -216, 14, 216); g.fillRect(-52, -112, 190, 12); g.fillRect(118, -100, 12, 100); g.fillRect(-52, -100, 12, 100); }
  g.lineCap = 'round'; for (const lg of P0.legs) limb(g, lg, 24, trs); for (const lg of P0.legs) { g.fillStyle = '#26323a'; g.beginPath(); g.ellipse(lg[2][0] + (P0.seat ? 8 : 8), lg[2][1] + 2, 20, 8, 0, 0, TAU); g.fill(); }
  // 躯干（外套）
  g.fillStyle = cc; g.fill(K.smooth([[-44, top + 4], [-26, top - 8], [26, top - 8], [44, top + 4], [38, hy0 + 20], [30, hy0 + 40], [-30, hy0 + 40], [-38, hy0 + 20]]));
  for (const ar of P0.arms) limb(g, ar, 17, cc); for (const ar of P0.arms) disc(g, ar[2][0], ar[2][1], 10, sk);
  g.fillStyle = sk; g.fillRect(-8, top - 22, 16, 22); disc(g, 0, hd, 21, sk);
  g.fillStyle = hr; g.beginPath(); if (hs === 1) { g.ellipse(0, hd - 5, 23, 19, 0, Math.PI, TAU); g.fill(); g.beginPath(); g.ellipse(0, hd + 6, 26, 32, 0, 0, TAU); g.globalCompositeOperation = 'destination-over'; g.fill(); g.globalCompositeOperation = 'source-over'; }
  else if (hs === 2) { g.ellipse(0, hd - 8, 26, 14, 0, Math.PI, TAU); g.fill(); g.fillRect(-30, hd - 10, 60, 7); } else { g.ellipse(0, hd - 6, 22, 17, 0, Math.PI, TAU); g.fill(); }
  g.fillStyle = 'rgba(255,244,220,.9)'; g.beginPath(); g.moveTo(-9, top - 8); g.lineTo(0, top + 40); g.lineTo(9, top - 8); g.closePath(); g.fill();   // 衬衫 V 领
  g.fillStyle = COATS.red; g.beginPath(); g.moveTo(0, top + 2); g.lineTo(-5, top + 14); g.lineTo(0, top + 62); g.lineTo(5, top + 14); g.closePath(); g.fill();   // 领带（红）
  if (P0.phone) { g.fillStyle = '#f6ecd0'; g.fillRect(P0.phone[0] - 12, P0.phone[1] - 22, 24, 40); }
  g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = grad(g, -90, 0, 90, 0, [[0, 'rgba(255,238,190,.28)'], [0.5, 'rgba(255,238,190,0)'], [1, 'rgba(24,44,60,.28)']]); g.fillRect(-130, -420, 260, 440); g.restore();
}, [{ cell: 4.2, len: 9.5, width: 3.8, seed: 71, ang: (x, y) => (y > -150 ? -1.3 : -0.5) + 0.3 * Math.sin(x * 0.2 + y * 0.12) }, { cell: 3, len: 6, width: 2.6, seed: 72, mask: (x, y) => y < -270 }]);
// K.person(c,x,y,s,{pose,coat,skin,hair,hs,dir,t,bob}) 脚底中点为锚。pose: stand walk point raise hold sit；coat 取 K.COATS 的键或 #hex；hs 发型 0 短 1 长 2 帽
K.person = (c, x, y, s, o = {}) => { const { pose = 'stand', coat = 'ink', skin = 0, hair = 0, hs = 0, dir = 1, t = 0, bob = 0 } = o;
  const pk = pose === 'walk' ? 'walk' + (Math.floor(t * 4 + (o.ph || 0)) % 2) : pose, yy = y - (pose === 'walk' ? Math.abs(Math.sin(t * 4 * Math.PI / 1 + (o.ph || 0))) * 5 * s : bob * Math.sin(t * 2 + (o.ph || 0)) * s);
  K.blit(c, personSp(pk, coat, skin, hair, hs), x, yy, s, 0, o.alpha ?? 1, dir); return { head: [x, yy - 306 * s], hand: [x + dir * (POSE[pk]?.arms[1][2][0] || 40) * s, yy + (POSE[pk]?.arms[1][2][1] || -150) * s], top: [x, yy - 330 * s] }; };
// 人群：n 个人一排（rows 排，后排略小略淡），不画脸，色相按 hash 轮换。gap 为间距。
K.crowd = (c, t, x, y, n, gap, s, o = {}) => { const { rows = 1, coats = ['ink', 'teal', 'rose', 'ochre', 'slate', 'green'], seed = 1, pose = 'stand', dir = 1, alpha = 1 } = o;
  for (let r = rows - 1; r >= 0; r--) for (let i = 0; i < n; i++) { const hsh = hash(i + r * 31, seed), px = x + (i - (n - 1) / 2) * gap + (r % 2 ? gap / 2 : 0) + (hsh - 0.5) * gap * 0.25, py = y - r * 46 * s, ss = s * (1 - r * 0.12) * (0.94 + hsh * 0.12);
    K.person(c, px, py, ss, { pose: o.walk ? 'walk' : pose, coat: coats[Math.floor(hash(i, seed + 5 + r) * coats.length)], skin: Math.floor(hash(i, seed + 9) * 4), hair: Math.floor(hash(i, seed + 13) * 5), hs: Math.floor(hash(i, seed + 17) * 3), dir, t, bob: 3, ph: i * 1.3, alpha: alpha * (1 - r * 0.1) }); } };

// 立足处：K.ground(c,y,{kind:'dock'|'sand'|'stone',x0,x1,h})  y 为台面上沿；人/物脚底放在 y+20 左右。dock=木栈桥（下有桩入水），sand 沙滩，stone 石阶/广场
const GROUNDC = { dock: ['#a67c50', '#8a6240', '#c09468', '#74502e'], sand: ['#ecd6a8', '#f4e2b8', '#e0c690', '#f6ead0'], stone: ['#c8c0ae', '#d8d0bc', '#b4ac98', '#e4dcc8'] };
K.ground = (c, y, o = {}) => { const { kind = 'dock', x0 = -60, x1 = W + 60, h = 150 } = o, cols = GROUNDC[kind];
  const sp = K.paint('ground|' + kind, 1300, 260, 0, 0, g => { g.fillStyle = cols[0]; g.fillRect(0, 0, 1300, 160); g.fillStyle = cols[1]; g.fillRect(0, 0, 1300, 26);
    if (kind === 'dock') { g.fillStyle = cols[3]; for (let x = 0; x < 1300; x += 108) g.fillRect(x, 0, 6, 160); g.fillStyle = cols[3]; for (let x = 60; x < 1300; x += 300) g.fillRect(x, 160, 34, 100); }
    else { g.fillStyle = cols[2]; for (let x = 0; x < 1300; x += 140) g.fillRect(x + (x % 280 ? 30 : 0), 40, 6, 120); } }, [{ cell: 6, len: 20, width: 5.5, seed: 77, pal: (x, y, col, r) => sw(cols, 0.4)(col, r), ang: () => 0.02 }], { res: 1 });
  c.drawImage(sp.cv, 0, 0, 1300, 260, x0, y, x1 - x0, h * 260 / 160 * (o.kind === 'dock' ? 1 : 1)); };

// ======================= 建筑：国会大厦、华尔街楼群 =======================
const HALLC = { day: ['#f4ead2', '#e2d2b0', '#c8b890', '#7a9aa2', '#f2ecdc'], dusk: ['#f8d8b8', '#e8b898', '#c08a78', '#6a7a80', '#f4cdb0'], night: ['#6a8890', '#4a6870', '#34505a', '#16303a', '#8aa4a8'] };
const hallSp = tone => K.paint('hall|' + tone, 1000, 560, 500, 550, g => {
  const [lt, md, dk, win, dome] = HALLC[tone] || HALLC.day, night = tone === 'night';
  g.fillStyle = md; g.fillRect(-470, -52, 940, 52); g.fillStyle = dk; for (let i = 0; i < 4; i++) g.fillRect(-470 + i * 8, -52 + i * 12, 940 - i * 16, 6);
  // 侧翼
  for (const sd of [-1, 1]) { g.fillStyle = lt; g.fillRect(sd < 0 ? -470 : 130, -150, 340, 98); g.fillStyle = dk; g.fillRect(sd < 0 ? -470 : 130, -156, 340, 8);
    for (let i = 0; i < 9; i++) { g.fillStyle = night ? '#f4d890' : win; g.fillRect((sd < 0 ? -450 : 150) + i * 36, -134, 18, 54); g.fillStyle = md; g.fillRect((sd < 0 ? -454 : 146) + i * 36, -80 + 0, 26, 4); } }
  // 中央门廊
  g.fillStyle = lt; g.fillRect(-130, -230, 260, 180); g.fillStyle = md; g.beginPath(); g.moveTo(-150, -230); g.lineTo(0, -290); g.lineTo(150, -230); g.closePath(); g.fill();
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? md : lt; g.fillRect(-120 + i * 32, -222, 16, 170); g.fillStyle = night ? HALLC.night[3] : win; }
  g.fillStyle = night ? HALLC.night[3] : win; g.fillRect(-110, -222, 220, 6);
  // 鼓座与穹顶
  g.fillStyle = md; g.fillRect(-104, -330, 208, 100); for (let i = 0; i < 12; i++) { g.fillStyle = lt; g.fillRect(-96 + i * 17, -322, 8, 84); }
  g.fillStyle = dk; g.fillRect(-110, -336, 220, 8);
  g.fillStyle = dome; g.beginPath(); g.moveTo(-96, -336); g.bezierCurveTo(-96, -470, -50, -540, 0, -548); g.bezierCurveTo(50, -540, 96, -470, 96, -336); g.closePath(); g.fill();
  g.fillStyle = 'rgba(70,104,116,.42)'; g.beginPath(); g.moveTo(10, -336); g.bezierCurveTo(20, -460, 10, -520, 0, -548); g.bezierCurveTo(50, -540, 96, -470, 96, -336); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,140,140,.35)'; g.lineWidth = 3; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 14, -340); g.quadraticCurveTo(i * 12, -460, i * 2, -540); g.stroke(); }
  g.fillStyle = md; g.fillRect(-14, -574, 28, 30); g.beginPath(); g.moveTo(-18, -574); g.lineTo(0, -602); g.lineTo(18, -574); g.closePath(); g.fill();
  if (night) { g.fillStyle = '#f4d890'; for (let i = 0; i < 5; i++) g.fillRect(-100 + i * 8 + (i > 1 ? 28 : 0), -190, 14, 36); }
}, [{ cell: 5, len: 11, width: 4, seed: 73, ang: (x, y) => -1.5 + 0.2 * Math.sin(x * 0.1) }, { cell: 3.5, len: 6, width: 2.8, seed: 74, mask: (x, y) => y > -340 && y < -50 }], { res: 1.4 });
// K.hall(c,x,y,s,{tone:'day'|'dusk'|'night'}) 国会大厦剪影，锚点＝底边中点，s=1 宽约 940
K.hall = (c, x, y, s = 1, o = {}) => { K.blit(c, hallSp(o.tone || (K.tone === 'night' ? 'night' : K.tone === 'dusk' ? 'dusk' : 'day')), x, y, s, 0, o.alpha ?? 1); };
const citySp = (seed, tone) => K.paint(`city|${seed}|${tone}`, 1000, 520, 500, 510, g => {
  const night = tone === 'night', cols = night ? ['#3a5a66', '#2c4a56', '#46686f'] : tone === 'dusk' ? ['#9a7a78', '#b08a82', '#8a6a70'] : ['#8aa6ac', '#a6bcbc', '#7a9aa2'];
  let x = -490; for (let i = 0; x < 480; i++) { const w = 56 + Math.floor(hash(i, seed) * 70), h = 150 + Math.floor(hash(i, seed + 1) * 320) * (hash(i, seed + 2) > 0.7 ? 1.15 : 0.8), col = cols[i % 3]; g.fillStyle = col; g.fillRect(x, -h, w, h);
    if (hash(i, seed + 3) > 0.5) { g.fillRect(x + w * 0.2, -h - 40, w * 0.6, 40); } if (hash(i, seed + 4) > 0.8) { g.fillRect(x + w / 2 - 3, -h - 90, 6, 60); }
    for (let yy = -h + 22; yy < -20; yy += 28) for (let xx = x + 10; xx < x + w - 14; xx += 20) if (hash(xx + i, yy + seed) > (night ? 0.45 : 0.62)) { g.fillStyle = night ? '#f4d890' : 'rgba(255,240,200,.85)'; g.fillRect(xx, yy, 10, 14); } x += w + 4; } },
  [{ cell: 5, len: 11, width: 4, seed: 75, ang: () => -1.5 }, { cell: 3.4, len: 5, width: 2.4, seed: 76 }], { res: 1.3 });
// K.city(c,x,y,s,{seed,tone}) 华尔街楼群剪影，锚点＝底边中点，s=1 宽约 980
K.city = (c, x, y, s = 1, o = {}) => K.blit(c, citySp(o.seed ?? 3, o.tone || (K.tone === 'night' ? 'night' : K.tone === 'dusk' ? 'dusk' : 'day')), x, y, s, 0, o.alpha ?? 1);

// ======================= 暗池 =======================
// K.deep(c,t,{reveal,blocks,hot}) 深水里一块块暗色方块（暗池大宗）。reveal 0..1 方块浮现；hot=[序号] 的方块泛暖光（被「看见」的那笔）
const DEEPB = [[250, 560, 210, 150], [770, 640, 270, 190], [520, 940, 330, 220], [170, 1080, 180, 130], [900, 1060, 200, 150], [610, 380, 150, 110]];
K.deepBlock = (c, t, x, y, w, h, a, hot, i = 0) => { if (a <= 0) return; const dx = w * 0.22, dy = h * 0.2; c.save(); c.globalAlpha *= a; const wob = Math.sin(t * 0.6 + i * 1.7) * 5; c.translate(0, wob);
  const fr = c.createLinearGradient(x, y - h / 2, x, y + h / 2); fr.addColorStop(0, '#2a6270'); fr.addColorStop(1, '#123844');
  c.fillStyle = fr; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = '#3c7a84'; c.beginPath(); c.moveTo(x - w / 2, y - h / 2); c.lineTo(x - w / 2 + dx, y - h / 2 - dy); c.lineTo(x + w / 2 + dx, y - h / 2 - dy); c.lineTo(x + w / 2, y - h / 2); c.closePath(); c.fill();
  c.fillStyle = '#0e2e3a'; c.beginPath(); c.moveTo(x + w / 2, y - h / 2); c.lineTo(x + w / 2 + dx, y - h / 2 - dy); c.lineTo(x + w / 2 + dx, y + h / 2 - dy); c.lineTo(x + w / 2, y + h / 2); c.closePath(); c.fill();
  const arr = [], arr2 = []; for (let k = 0; k < 16; k++) { arr.push([x - w / 2 + 14 + hash(k, i * 7) * (w - 28), y - h / 2 + 12 + hash(k, i * 7 + 1) * (h - 24), 14 + hash(k, i * 7 + 2) * 18, -0.4]); } for (let k = 0; k < 6; k++) arr2.push([x - w / 2 + dx * hash(k, i) + hash(k, i + 3) * w, y - h / 2 - dy * hash(k, i + 4), 16 + hash(k, i + 5) * 16, 0]);
  dashes(c, arr, 5, 'rgba(90,160,160,.4)'); dashes(c, arr2, 5, 'rgba(120,190,185,.45)');
  c.strokeStyle = hot ? 'rgba(255,214,120,.95)' : 'rgba(150,210,200,.5)'; c.lineWidth = hot ? 6 : 3.5; c.strokeRect(x - w / 2, y - h / 2, w, h);
  if (hot) { const q = c.createRadialGradient(x, y, 10, x, y, w * 0.9); q.addColorStop(0, `rgba(255,214,120,${0.5 + 0.2 * Math.sin(t * 3)})`); q.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = q; c.fillRect(x - w, y - w, 2 * w, 2 * w); }
  c.restore(); };
K.deep = (c, t, o = {}) => { K.bg(c, t, { tone: 'abyss' }); const rv = o.reveal ?? 1, bl = o.blocks || DEEPB, hot = o.hot || [];
  bl.forEach(([x, y, w, h], i) => K.deepBlock(c, t, x, y, w, h, clamp(rv * bl.length - i * 0.6) * 0.92, hot.includes(i), i)); };

// ======================= 小物件：硬币、钟、仪表、铃、箭头 =======================
// 币：K.coin(c,x,y,r,{spin,t,sym,stack})；spin=自转速度（圈/秒，0 不转），sym 币面字（默认 $）；stack=n 叠成一摞
K.coin = (c, x, y, r, o = {}) => { const { spin = 0, t = 0, sym = '$', stack = 0 } = o;
  if (stack > 1) { for (let i = 0; i < stack; i++) K.coin(c, x + (hash(i, 120) - 0.5) * r * 0.15, y - i * r * 0.28, r, { sym: i === stack - 1 ? sym : '', t }); return; }
  const k = spin ? Math.abs(Math.cos(t * spin * Math.PI)) : 1, rx = Math.max(r * 0.12, r * k); c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(30,50,56,.25)'; c.beginPath(); c.ellipse(5, r * 0.18 + 5, rx, r * 0.9, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(-rx, -r, rx, r); g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#f4c25a'); g.addColorStop(1, '#c8903a'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, r, 0, 0, TAU); c.fill();
  c.strokeStyle = '#b8802e'; c.lineWidth = Math.max(3, r * 0.07); c.stroke(); c.strokeStyle = 'rgba(184,128,46,.7)'; c.lineWidth = Math.max(2, r * 0.05); c.beginPath(); c.ellipse(0, 0, rx * 0.76, r * 0.76, 0, 0, TAU); c.stroke();
  if (sym && k > 0.35) { c.save(); c.scale(k, 1); K.text(c, sym, 0, 3, { size: r * 1.1, col: '#a8701e', stroke: null, fam: 'PuHui-Black' }); c.restore(); }
  dashes(c, [[-rx * 0.5, -r * 0.55, r * 0.5, -0.6], [-rx * 0.3, -r * 0.68, r * 0.3, -0.5]], Math.max(3, r * 0.07), 'rgba(255,250,214,.85)'); c.restore(); };
// 钟：K.clock(c,x,y,r,t,{h,m,run,arc})；h/m 指定时刻（默认 9:30）；run=每秒走多少分钟；arc=[起分,止分] 红圈高亮一段（如收盘前最后一小时）
K.clock = (c, x, y, r, t, o = {}) => { const { h = 9, m = 30, run = 0, arc = null } = o, mm = m + run * t, hh = h + mm / 60; c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(30,50,56,.28)'; c.beginPath(); c.arc(8, 12, r, 0, TAU); c.fill(); c.fillStyle = C.cream; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = C.ink; c.lineWidth = r * 0.07; c.stroke();
  if (arc) { c.strokeStyle = C.put; c.lineWidth = r * 0.1; c.lineCap = 'butt'; c.beginPath(); c.arc(0, 0, r * 0.86, arc[0] / 60 * TAU - Math.PI / 2, arc[1] / 60 * TAU - Math.PI / 2); c.stroke(); }
  c.lineCap = 'round'; c.strokeStyle = C.ink2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 ? 0.08 : 0.16; c.lineWidth = i % 3 ? r * 0.035 : r * 0.06; c.beginPath(); c.moveTo(Math.sin(a) * r * 0.74, -Math.cos(a) * r * 0.74); c.lineTo(Math.sin(a) * r * (0.74 - l * 0.6), -Math.cos(a) * r * (0.74 - l * 0.6)); c.stroke(); }
  c.strokeStyle = C.ink; c.lineWidth = r * 0.09; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(hh / 12 * TAU) * r * 0.46, -Math.cos(hh / 12 * TAU) * r * 0.46); c.stroke();
  c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(mm / 60 * TAU) * r * 0.7, -Math.cos(mm / 60 * TAU) * r * 0.7); c.stroke(); disc(c, 0, 0, r * 0.07, C.put); c.restore(); };
// 仪表：K.gauge(c,x,y,r,v,{lt,at,l,rr,label})；v 0..1（0 全看跌 红，1 全看涨 绿），指针从 0.5 摆到 v。l/rr 左右端字（≥44px）
K.gauge = (c, x, y, r, v, o = {}) => { const { lt = 99, at = 0, l = 'PUT', rr = 'CALL' } = o, p = MO.cubicOut(K.at(lt, at, 0.9)), val = lerp(0.5, v, p) + (p < 1 ? 0 : Math.sin(lt * 3) * 0.004);
  c.save(); c.translate(x, y); c.fillStyle = 'rgba(30,50,56,.28)'; c.beginPath(); c.arc(8, 12, r * 1.1, Math.PI, TAU); c.lineTo(r * 1.1 + 8, r * 0.72 + 12); c.lineTo(-r * 1.1 + 8, r * 0.72 + 12); c.closePath(); c.fill();
  c.fillStyle = C.cream; c.beginPath(); c.arc(0, 0, r * 1.1, Math.PI, TAU); c.lineTo(r * 1.1, r * 0.72); c.lineTo(-r * 1.1, r * 0.72); c.closePath(); c.fill(); c.strokeStyle = '#8a7a58'; c.lineWidth = 3; c.stroke();
  const seg = [[C.put, 0, 0.36], ['#e8b050', 0.36, 0.64], [C.call, 0.64, 1]]; c.lineCap = 'butt'; for (const [col, a, b] of seg) { c.strokeStyle = col; c.lineWidth = r * 0.26; c.beginPath(); c.arc(0, 0, r * 0.82, Math.PI + a * Math.PI, Math.PI + b * Math.PI); c.stroke(); }
  const a = Math.PI + val * Math.PI; c.strokeStyle = C.ink; c.lineWidth = r * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); c.stroke(); disc(c, 0, 0, r * 0.12, C.ink);
  K.text(c, l, -r * 0.8, r * 0.3, { size: Math.max(44, r * 0.2), col: C.put, stroke: null }); K.text(c, rr, r * 0.8, r * 0.3, { size: Math.max(44, r * 0.2), col: C.call, stroke: null });
  if (o.label) K.text(c, o.label, 0, r * 0.4, { size: Math.max(48, r * 0.2), col: C.ink, stroke: null }); c.restore(); };
// 铃（警报）：K.bell(c,x,y,s,t,{ring})  ring>0 时摇晃并发出声波弧
K.bell = (c, x, y, s, t, o = {}) => { const ring = o.ring ?? 1, sw0 = Math.sin(t * 14) * 0.22 * ring * Math.exp(-((t * 1.3) % 1) * 2.2); c.save(); c.translate(x, y); c.scale(s, s); c.rotate(sw0);
  c.fillStyle = 'rgba(30,50,56,.25)'; c.beginPath(); c.ellipse(8, 70, 80, 14, 0, 0, TAU); c.fill();
  const g = c.createLinearGradient(-70, 0, 70, 0); g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#f4c25a'); g.addColorStop(1, '#c8903a'); c.fillStyle = g;
  c.beginPath(); c.moveTo(-20, -70); c.bezierCurveTo(-90, -50, -50, 30, -84, 62); c.lineTo(84, 62); c.bezierCurveTo(50, 30, 90, -50, 20, -70); c.closePath(); c.fill(); c.strokeStyle = '#b8802e'; c.lineWidth = 5; c.stroke();
  disc(c, 0, -82, 14, '#c8903a'); c.fillStyle = '#b8802e'; c.beginPath(); c.ellipse(0, 76 + sw0 * 40, 18, 14, 0, 0, TAU); c.fill(); c.restore();
  if (ring > 0) { c.save(); c.lineCap = 'round'; c.strokeStyle = C.put; c.lineWidth = 7 * s; for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { const q = ((t * 1.3) + i * 0.4) % 1; c.globalAlpha = (1 - q) * ring; c.beginPath(); c.arc(x, y - 10 * s, (90 + q * 60) * s, sd < 0 ? Math.PI * 1.15 : -Math.PI * 0.35, sd < 0 ? Math.PI * 1.45 : -Math.PI * 0.05); c.stroke(); } c.restore(); } };
// 笔刷箭头：K.arrow(c,x0,y0,x1,y1,{col,w,prog,bend,seed})；多笔叠成毛边粗箭，prog 0..1 画出来；col 默认 CALL 绿
K.arrow = (c, x0, y0, x1, y1, o = {}) => { const { col = C.call, w = 26, prog = 1, bend = 0, seed = 5 } = o; if (prog <= 0) return; const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hl = Math.min(L * 0.4, w * 3.4), shaft = Math.max(0, (L - hl * 0.6) * Math.min(1, prog / 0.85));
  const pt = (u, off) => { const b = Math.sin(u / L * Math.PI) * bend; return [x0 + ux * u + nx * (b + off), y0 + uy * u + ny * (b + off)]; };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (let k = 0; k < 5; k++) { const off = (k - 2) * w * 0.2, ww = w * (0.5 + hash(k, seed) * 0.25); c.strokeStyle = k < 1 ? 'rgba(30,50,56,.28)' : rgb(mix(hx(col), k % 2 ? [255, 236, 190] : [20, 50, 40], 0.1 + hash(k, seed + 1) * 0.12)); c.lineWidth = ww;
    c.beginPath(); for (let u = 0; u <= shaft; u += 14) { const p = pt(u, off + (k < 1 ? 8 : 0) + Math.sin(u * 0.05 + k) * 1.5 + (k < 1 ? 6 : 0)); u ? c.lineTo(p[0], p[1] + (k < 1 ? 6 : 0)) : c.moveTo(p[0], p[1] + (k < 1 ? 6 : 0)); } c.stroke(); }
  if (prog > 0.8) { const q = Math.min(1, (prog - 0.8) / 0.2), tip = pt(L, 0), base = pt(L - hl * q, 0); const bx = base[0], by = base[1], hw = w * 1.05 * q; c.fillStyle = col; c.strokeStyle = 'rgba(20,40,30,.35)'; c.lineWidth = 4; c.beginPath(); c.moveTo(tip[0] * q + (1 - q) * bx, tip[1] * q + (1 - q) * by); c.lineTo(bx + nx * hw, by + ny * hw); c.lineTo(bx - nx * hw, by - ny * hw); c.closePath(); c.fill(); c.stroke(); }
  c.restore(); };

// ======================= 纸、票据、图表（奶白纸卡，笔触之外清晰绘制）=======================
// K.paper(c,x,y,w,h,{rot,zig,band,shadow},fn)：奶白纸卡；fn(c,w,h) 在以中心为原点的局部坐标里画内容
K.paper = (c, x, y, w, h, o = {}, fn) => { const { rot = 0, zig = false, band = null } = o; c.save(); c.translate(x, y); if (rot) c.rotate(rot);
  c.fillStyle = 'rgba(30,50,56,.28)'; c.beginPath(); c.roundRect(-w / 2 + 10, -h / 2 + 22, w, h, 14); c.fill();
  c.beginPath(); c.moveTo(-w / 2, -h / 2 + 14); c.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 14, -h / 2); c.lineTo(w / 2 - 14, -h / 2); c.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 14);
  if (zig) { const n = Math.round(w / 22); c.lineTo(w / 2, h / 2 - 12); for (let i = n; i > 0; i--) { c.lineTo(-w / 2 + (i - 0.5) * (w / n), h / 2); c.lineTo(-w / 2 + (i - 1) * (w / n), h / 2 - 12); } } else { c.lineTo(w / 2, h / 2 - 14); c.quadraticCurveTo(w / 2, h / 2, w / 2 - 14, h / 2); c.lineTo(-w / 2 + 14, h / 2); c.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 14); }
  c.closePath(); const pg = c.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#fffaea'); pg.addColorStop(1, C.paper); c.fillStyle = pg; c.fill(); c.strokeStyle = '#8a7a58'; c.lineWidth = 3; c.stroke();
  if (band) { c.save(); c.clip(); c.fillStyle = band; c.fillRect(-w / 2, -h / 2, w, 18); c.restore(); }
  if (fn) fn(c, w, h); c.restore(); };
// 期权成交单。o: {sym,strike,exp,side:'CALL'|'PUT',amt,note,head,w,h,rot}；(x,y) 中心。head 可整行替换第一行。
K.ticket = (c, x, y, o = {}) => { const w = o.w || 860, h = o.h || 420, side = o.side || 'CALL', col = side === 'CALL' ? C.call : C.put;
  K.paper(c, x, y, w, h, { rot: o.rot ?? -0.04, zig: true, band: col }, () => { const L = -w / 2 + 44, R = w / 2 - 44;
    K.text(c, o.head || `${o.sym || 'NVDA'}  ${o.strike || '$150'} ${side}  ${o.exp || '12/19'}`, L, -h / 2 + 78, { size: 52, fam: 'PuHui-Heavy', col: C.ink, stroke: null, align: 'left', maxW: w - 88 });
    c.strokeStyle = '#a89870'; c.lineWidth = 3; c.setLineDash([12, 10]); c.beginPath(); c.moveTo(L, -h / 2 + 112); c.lineTo(R, -h / 2 + 112); c.stroke(); c.setLineDash([]);
    const by = 22, sz1 = 150, sz2 = 124, w1 = K.textW(c, side, sz1), w2 = K.textW(c, o.amt || '$4.2M', sz2), k = Math.min(1, (w - 88 - 40) / (w1 + w2));
    K.text(c, side, L, by, { size: sz1 * k, col, stroke: null, align: 'left' }); K.text(c, o.amt || '$4.2M', R, by, { size: sz2 * k, col: C.ink, stroke: null, align: 'right' });
    K.text(c, o.note || 'SWEEP · 买价扫入', L, h / 2 - 50, { size: 52, fam: 'PuHui-Heavy', col: C.ink2, stroke: null, align: 'left' });
    const ax = R - 40, ay = h / 2 - 78; c.fillStyle = col; c.beginPath(); if (side === 'CALL') { c.moveTo(ax, ay - 40); c.lineTo(ax + 44, ay + 22); c.lineTo(ax + 16, ay + 22); c.lineTo(ax + 16, ay + 46); c.lineTo(ax - 16, ay + 46); c.lineTo(ax - 16, ay + 22); c.lineTo(ax - 44, ay + 22); } else { c.moveTo(ax, ay + 46); c.lineTo(ax + 44, ay - 16); c.lineTo(ax + 16, ay - 16); c.lineTo(ax + 16, ay - 40); c.lineTo(ax - 16, ay - 40); c.lineTo(ax - 16, ay - 16); c.lineTo(ax - 44, ay - 16); } c.closePath(); c.fill(); }); };
K.stamp = (c, s, x, y, o = {}) => { const size = o.size || 60, col = o.col || C.put; c.save(); c.translate(x, y); c.rotate(o.rot ?? 0.2); c.globalAlpha *= 0.92 * (o.alpha ?? 1); if (o.scale) c.scale(o.scale, o.scale);
  const w = K.textW(c, s, size) + 36, h = size + 28; c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 10); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 6); c.stroke();
  K.text(c, s, 0, 2, { size, col, stroke: null }); c.restore(); };
// 图表卡：K.chartCard(c,x,y,w,h,{title,demo}) 画纸卡＋标题（左上）＋「示意」小章（demo:true），返回绘图区 {x,y,w,h}（左上角坐标）
K.chartCard = (c, x, y, w, h, o = {}) => { const ty = o.title ? 104 : 36;
  K.paper(c, x, y, w, h, { band: o.band ?? C.sea1 }, () => { if (o.title) K.text(c, o.title, -w / 2 + 40, -h / 2 + 64, { size: 52, fam: 'PuHui-Heavy', col: C.ink, stroke: null, align: 'left', maxW: w - 80 - (o.demo ? 150 : 0) });
    if (o.demo) K.text(c, '示意', w / 2 - 40, -h / 2 + 62, { size: 44, fam: 'PuHui-Bold', col: C.ink2, stroke: null, align: 'right' }); });
  return { x: x - w / 2 + 40, y: y - h / 2 + ty, w: w - 80, h: h - ty - 30 }; };
// 柱图：K.bars(c,x,y,w,h,data,lt,at,{title,demo,card,horiz,sign,fmt,vals,col,dur})
// data：数字或 {v,l,col}；sign:true 正绿负红（GEX/净流向）；horiz:true 横向（行权价阶梯/墙）；fmt(v) 值标签；card:false 不画卡直接画在画面上
K.bars = (c, x, y, w, h, data, lt = 99, at = 0, o = {}) => { const card = o.card !== false, R = card ? K.chartCard(c, x, y, w, h, o) : { x: x - w / 2, y: y - h / 2, w, h }; const D = data.map(d => typeof d === 'number' ? { v: d } : d), n = D.length, mx = Math.max(1e-9, ...D.map(d => Math.abs(d.v))), neg = D.some(d => d.v < 0), hz = !!o.horiz;
  const labH = hz ? 0 : (D.some(d => d.l) ? 60 : 0), labW = hz ? (D.some(d => d.l) ? Math.min(220, R.w * 0.3) : 0) : 0, px = R.x + labW, py = R.y, pw = R.w - labW, ph = R.h - labH, slot = (hz ? ph : pw) / n, bw = slot * 0.64, vs = o.vals ? 44 : 0;
  c.save(); c.lineCap = 'round';
  if (!hz) { const zy = neg ? py + ph / 2 : py + ph, span = neg ? (ph / 2 - vs * 0.6) : ph - vs - 6;
    c.strokeStyle = '#a89870'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, zy); c.lineTo(px + pw, zy); c.stroke();
    D.forEach((d, i) => { const p = MO.cubicOut(K.at(lt, at + i * 0.09, o.dur || 0.6)), bh = d.v / mx * span * p, bx = px + slot * i + (slot - bw) / 2, col = d.col || (o.sign ? (d.v >= 0 ? C.call : C.put) : (o.col || C.sea0)); barFill(c, bx, d.v >= 0 ? zy - bh : zy, bw, Math.abs(bh), col, i);
      if (p > 0.6 && o.vals) K.text(c, (o.fmt || (v => String(v)))(d.v), bx + bw / 2, d.v >= 0 ? zy - bh - 28 : zy - bh + 30, { size: 44, fam: 'PuHui-Bold', col: C.ink, stroke: null, maxW: slot });
      if (d.l) K.text(c, d.l, bx + bw / 2, py + ph + 36, { size: 44, fam: 'PuHui-Bold', col: C.ink2, stroke: null, maxW: slot + 10 }); }); }
  else { const zx = neg ? px + pw / 2 : px, span = neg ? pw / 2 - 80 : pw - 130;
    c.strokeStyle = '#a89870'; c.lineWidth = 3; c.beginPath(); c.moveTo(zx, py); c.lineTo(zx, py + ph); c.stroke();
    D.forEach((d, i) => { const p = MO.cubicOut(K.at(lt, at + i * 0.09, o.dur || 0.6)), bl = d.v / mx * span * p, by = py + slot * i + (slot - bw) / 2, col = d.col || (o.sign ? (d.v >= 0 ? C.call : C.put) : (o.col || C.sea0)); barFillH(c, d.v >= 0 ? zx : zx + bl, by, Math.abs(bl), bw, col, i);
      if (p > 0.6 && o.vals) K.text(c, (o.fmt || (v => String(v)))(d.v), d.v >= 0 ? zx + bl + 12 : zx + bl - 12, by + bw / 2, { size: 44, fam: 'PuHui-Bold', col: C.ink, stroke: null, align: d.v >= 0 ? 'left' : 'right' });
      if (d.l) K.text(c, d.l, px - 14, by + bw / 2, { size: 44, fam: 'PuHui-Bold', col: C.ink2, stroke: null, align: 'right', maxW: labW }); }); }
  c.restore(); return R; };
function barFill(c, x, y, w, h, col, i) { if (h < 1) return; c.fillStyle = col; c.fillRect(x, y, w, h); const n = Math.max(2, Math.round(w / 16)), a = [], b = []; for (let k = 0; k < n; k++) { const bx = x + (k + 0.5) / n * w, ln = Math.min(h, 24 + hash(k, i) * 40); (k % 2 ? a : b).push([bx, y + h * (0.2 + hash(k, i + 9) * 0.6), ln, -Math.PI / 2]); }
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); dashes(c, a, 5, 'rgba(255,244,214,.3)'); dashes(c, b, 5, 'rgba(10,30,36,.2)'); c.restore(); }
function barFillH(c, x, y, w, h, col, i) { if (w < 1) return; c.fillStyle = col; c.fillRect(x, y, w, h); const n = Math.max(2, Math.round(h / 16)), a = [], b = []; for (let k = 0; k < n; k++) { const by = y + (k + 0.5) / n * h, ln = Math.min(w, 24 + hash(k, i) * 40); (k % 2 ? a : b).push([x + w * (0.2 + hash(k, i + 9) * 0.6), by, ln, 0]); }
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); dashes(c, a, 5, 'rgba(255,244,214,.3)'); dashes(c, b, 5, 'rgba(10,30,36,.2)'); c.restore(); }
// 折线：K.line(c,x,y,w,h,pts,lt,at,{title,demo,card,col,dur,mark})；pts 数字数组；mark=[序号,…] 在这些点画圆标
K.line = (c, x, y, w, h, pts, lt = 99, at = 0, o = {}) => { const card = o.card !== false, R = card ? K.chartCard(c, x, y, w, h, o) : { x: x - w / 2, y: y - h / 2, w, h }, mn = Math.min(...pts), mx = Math.max(...pts), p = MO.cubicInOut(K.at(lt, at, o.dur || 1.2)), n = pts.length, col = o.col || (pts[n - 1] >= pts[0] ? C.call : C.put);
  const X = i => R.x + 16 + i / (n - 1) * (R.w - 32), Y = v => R.y + R.h - 20 - (v - mn) / (mx - mn || 1) * (R.h - 50);
  c.save(); c.strokeStyle = 'rgba(168,152,112,.5)'; c.lineWidth = 2.5; c.setLineDash([10, 12]); for (let i = 0; i < 4; i++) { const yy = R.y + 10 + i * (R.h - 30) / 3; c.beginPath(); c.moveTo(R.x, yy); c.lineTo(R.x + R.w, yy); c.stroke(); } c.setLineDash([]);
  c.lineCap = c.lineJoin = 'round'; const m = (n - 1) * p, k = Math.floor(m), f = m - k;
  for (const [dy, ww, a, cc] of [[6, 14, 0.18, '#1e2c34'], [0, 11, 1, col], [-2, 4, 0.5, '#fff4dc']]) { c.globalAlpha = a; c.strokeStyle = cc; c.lineWidth = ww; c.beginPath(); for (let i = 0; i <= k && i < n; i++) i ? c.lineTo(X(i), Y(pts[i]) + dy) : c.moveTo(X(0), Y(pts[0]) + dy); if (k < n - 1) c.lineTo(lerp(X(k), X(k + 1), f), lerp(Y(pts[k]), Y(pts[k + 1]), f) + dy); c.stroke(); }
  c.globalAlpha = 1; const ex = k < n - 1 ? lerp(X(k), X(k + 1), f) : X(n - 1), ey = k < n - 1 ? lerp(Y(pts[k]), Y(pts[k + 1]), f) : Y(pts[n - 1]); disc(c, ex, ey, 13, col); disc(c, ex, ey, 6, '#fff4dc');
  for (const i of o.mark || []) if (i <= m) { c.strokeStyle = C.put; c.lineWidth = 6; c.beginPath(); c.arc(X(i), Y(pts[i]), 22, 0, TAU); c.stroke(); } c.restore(); return { X, Y, R }; };

// ======================= 文字 =======================
// 画面上的字：奶白字＋深墨描边（压在笔触上也读得清）；放在纸卡上时传 {col:K.C.ink, stroke:null}。baseline 为 middle，(x,y) 是字中心线。
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, stroke = C.ink, sw: swd = size * 0.16 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px'; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (stroke && swd > 0) { c.lineWidth = swd; c.strokeStyle = stroke; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.textW = (c, s, size, fam = 'PuHui-Black') => { c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width; c.restore(); return w; };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99; a.forEach((ch, i) => { if (/[，、：； ·]/.test(ch) && Math.abs(i - mid) < bd) { bd = Math.abs(i - mid); best = i; } }); const cut = best >= 0 && bd < a.length * 0.3 ? best + 1 : Math.ceil(mid); return [a.slice(0, cut).join(''), a.slice(cut).join('')]; };
// 标签纸：奶白小纸牌＋墨字（底色可换 o.fill）；返回宽度
K.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.paper, col = C.ink, scale = 1, alpha = 1, rot = 0, padX = 0.7 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * padX * 2, h = size * 1.55;
  c.fillStyle = 'rgba(30,50,56,.28)'; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 10, w, h, 14); c.fill(); c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 14); c.fill(); c.strokeStyle = '#8a7a58'; c.lineWidth = 3; c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 2); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：墨线（毛笔感圆头）画出来，末端奶白标签纸逐字打出（约 20 字/秒）。(ax,ay) 指向物，(bx,by) 标签中心
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.paper, col = C.ink, size = 50 } = o, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.4, h = size * 1.55; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = 'rgba(30,50,56,.28)'; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 10, w, h, 14); c.fill(); c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 14); c.fill(); c.strokeStyle = '#8a7a58'; c.lineWidth = 3; c.stroke();
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.7, 2); c.restore(); };

// 收尾：极轻暗角＋字幕带压暗（y≥1330 渐暗，让字幕有「台口」）
K.finish = c => { c.drawImage(K.once('FIN', () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const v = g.createRadialGradient(540, 900, 600, 540, 960, 1300); v.addColorStop(0, 'rgba(40,40,40,0)'); v.addColorStop(1, 'rgba(40,40,40,.18)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const b = g.createLinearGradient(0, 1330, 0, 1580); b.addColorStop(0, 'rgba(18,36,44,0)'); b.addColorStop(1, 'rgba(18,36,44,.34)'); g.fillStyle = b; g.fillRect(0, 1330, W, H - 1330); return cv; }), 0, 0); };

// ======================= 章节卡 / 字幕 =======================
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.CARD_TONES = ['dawn', 'noon', 'dusk', 'night', 'under'];   // 按章号轮换的底；K.CARD_TONES 可改
K.chapterCard = (c, lt, t, n, title = '') => {
  const tone = K.CARD_TONES[(n - 1) % K.CARD_TONES.length], rise = MO.cubicOut(K.at(lt, 0, 1.1)), uw = tone === 'under';
  K.bg(c, t, { tone });
  K.whale(c, 540 + (1 - rise) * 160 * (n % 2 ? -1 : 1), 930 + (1 - rise) * 180, 0.74, { pose: uw ? 'swim' : 'surface', mood: 'calm', t, spout: uw ? 0 : clamp((lt - 0.5) * 1.5) * 0.9, dir: 1 });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 120, x1 = 960, y = 1210, X = i => lerp(x0, x1, i / (N - 1));
  c.save(); c.strokeStyle = 'rgba(255,244,220,.75)'; c.lineWidth = 6; c.lineCap = 'round'; c.setLineDash([2, 22]); c.beginPath(); c.moveTo(x0 - 40, y); c.lineTo(x1 + 40, y); c.stroke(); c.setLineDash([]);
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1; disc(c, X(i), y, cur ? 20 : 13, cur ? C.put : past ? C.gold : C.cream); if (cur) { c.strokeStyle = C.cream; c.lineWidth = 5; c.beginPath(); c.arc(X(i), y, 28, 0, TAU); c.stroke(); } }
  const q = MO.cubicInOut(K.at(lt, 0.2, 1.0)); K.whale(c, lerp(n > 1 ? X(n - 2) : x0 - 60, X(n - 1), q), y - 44, 0.15, { pose: 'swim', t, wag: 2.4 }); c.restore();
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); K.tag(c, `第 ${n} 章`, W / 2, 300, { size: 62, fam: 'PuHui-Black', scale: s, fill: C.paper }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 92 : all > 7 ? 108 : 128;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K.text(c, a.slice(0, k).join(''), W / 2, (lines.length > 1 ? 450 : 500) + i * size * 1.28, { size, maxW: 960 }); });
  K.finish(c); };
// 字幕：深墨青半透明底板＋奶白字，字幕带 y≈1480
K.subtitle = (c, text, a = 1) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480; c.fillStyle = 'rgba(30,48,54,.82)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.fillStyle = '#fff4dc'; c.fillText(text, x, y + 2, 1000); c.restore(); };
})();
