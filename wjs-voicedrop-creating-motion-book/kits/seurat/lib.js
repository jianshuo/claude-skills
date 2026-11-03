// 画风套件 seurat（来自《判断的品味》）：竖屏 1080×1920，修拉点彩。导出 window.K（章节代码里写 const D = K）。
// 做法：章节代码用「平涂」画整幅（形状、渐变都行，别用 <14px 细线），最后 K.finish(c) 把整幅画布重绘成
// 固定六角网格的等大彩点（21 色纯色板按比例并置＝视觉混色）。文字（K.text/tag/popText/callout/bigText）先排队，
// finish 在点阵之后才落到画面上——字永远是实色，不被点打散。每镜最后调 K.finish(c)。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U;
const K = window.K = { W, H, TAU };
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  paper: '#f4ecd8', paper2: '#efe0bf', ink: '#1a2058', navy: '#2a3a9a', blue: '#3f6fd0', sky: '#8fc3ee', green: '#2f9a5a', greenD: '#1f6a52', lime: '#a8c83a',
  yel: '#f2cf3a', org: '#f08a2a', red: '#e0432a', rose: '#c0306a', violet: '#7a4aa8', cream: '#f8f4e8', skin: '#e8b48a', wood: '#c99a4a', pink: '#f2b8c8',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.4); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 点彩渲染器 ----------
const PAL = ['#1a2058', '#2a3a9a', '#3f6fd0', '#6aaee6', '#1f6a52', '#2f9a5a', '#a8c83a', '#f2cf3a', '#f08a2a', '#e0432a', '#c0306a', '#7a4aa8', '#f8f4e8', '#e8b48a', '#f6e49a', '#f6c48a', '#cfe08a', '#b0cff0', '#f2b8c8', '#c99a4a', '#9a7ac8'];
const RGB = PAL.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const COMP = { 0: 8, 1: 8, 2: 8, 3: 9, 4: 9, 5: 10, 6: 11, 7: 11, 8: 2, 9: 5, 10: 5, 11: 7, 12: 17, 13: 17, 14: 20, 15: 17, 16: 18, 17: 15, 18: 16, 19: 2, 20: 14 };
const pickCache = new Map();
function pick(r, g, b, h) {
  const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3); let e = pickCache.get(key);
  if (!e) { let best = 1e12; e = [0, 0, 1];
    for (let i = 0; i < 21; i++) for (let j = i; j < 21; j++) { const a = RGB[i], d = RGB[j]; let w = 1;
      const vx = a[0] - d[0], vy = a[1] - d[1], vz = a[2] - d[2], L2 = vx * vx + vy * vy + vz * vz;
      if (i !== j) w = clamp(((r - d[0]) * vx + (g - d[1]) * vy + (b - d[2]) * vz) / L2, 0.2, 0.8);
      const dr = r - (d[0] + vx * w), dg = g - (d[1] + vy * w), db = b - (d[2] + vz * w), s = dr * dr + dg * dg + db * db + 0.004 * (i === j ? 0 : L2);
      if (s < best) { best = s; e = [i, j, w]; } }
    pickCache.set(key, e); }
  return h < e[2] ? e[0] : e[1];
}
// 固定网格（点位不动，抖动静态）
const PITCH = 11, ROWH = 9.5, R = 4.6;
const GRID = (() => { const xs = [], ys = [], hs = [], js = [], ds = []; let row = 0;
  for (let y = 6; y < H; y += ROWH, row++) for (let x = (row % 2) * PITCH / 2 + 4; x < W; x += PITCH) {
    xs.push(x + (U.hash(x + y * 3) - 0.5) * 2.2); ys.push(y + (U.hash(x * 5 + y) - 0.5) * 2.2); hs.push(U.hash(x * 7 + y * 13)); js.push(U.hash(x * 3 + y * 11) - 0.5); ds.push(U.hash(x * 11 + y * 5)); }
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), hs: Float32Array.from(hs), js: Float32Array.from(js), ds: Float32Array.from(ds), n: xs.length }; })();
let small = null;
function dotify(c) {
  const cv = c.canvas, cw = cv.width, ch = cv.height, sc = 0.5;
  if (!small) { small = document.createElement('canvas'); small.width = W * sc; small.height = H * sc; }
  const g = small.getContext('2d', { willReadFrequently: true }); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, small.width, small.height); g.drawImage(cv, 0, 0, cw, ch, 0, 0, small.width, small.height);
  const id = g.getImageData(0, 0, small.width, small.height).data, sw = small.width, sh = small.height;
  const paths = PAL.map(() => new Path2D()), { xs, ys, hs, js, ds, n } = GRID;
  for (let i = 0; i < n; i++) {
    const px = Math.min(sw - 1, xs[i] * sc | 0), py = Math.min(sh - 1, ys[i] * sc | 0), o = (py * sw + px) * 4, dj = js[i] * 26;
    let k = pick(clamp(id[o] + dj, 0, 255) | 0, clamp(id[o + 1] + dj * 0.8, 0, 255) | 0, clamp(id[o + 2] - dj * 0.6, 0, 255) | 0, hs[i]);
    if (ds[i] < 0.04) k = COMP[k];
    paths[k].moveTo(xs[i] + R, ys[i]); paths[k].arc(xs[i], ys[i], R, 0, TAU);
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.filter = 'blur(5px) saturate(.85) brightness(1.06)'; c.drawImage(small, 0, 0, sw, sh, 0, 0, cw, ch); c.filter = 'none';
  const k = cw / W; c.scale(k, ch / H);
  PAL.forEach((col, i) => { c.fillStyle = col; c.fill(paths[i]); });
  c.restore();
}
let POST = [];
K.queue = (c, fn) => { POST.push({ fn, M: c.getTransform(), a: c.globalAlpha }); };
K.finish = c => {
  dotify(c);
  for (const p of POST) { c.save(); c.setTransform(p.M); c.globalAlpha = p.a; p.fn(); c.restore(); }
  POST = [];
};

// ---------- 底：平涂暖纸/色底（点阵会把渐变化成点的疏密） ----------
// kind: paper | sky | green | dusk | warm | night | rose
const BGS = {
  paper: ['#f6ecd0', '#f0dca8'], sky: ['#cfe6f6', '#f4ecd8'], green: ['#d8e8b0', '#a8c87a'], dusk: ['#8fb0e6', '#f6d6a8'],
  warm: ['#f8e0b0', '#f2b890'], night: ['#1f2a6a', '#3a4aa0'], rose: ['#f6d0d4', '#f0b4a8'],
};
K.bg = (c, t, o = {}) => {
  POST = [];
  const [a, b] = BGS[o.kind || 'paper'] || BGS.paper; const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (o.ground !== false) { c.fillStyle = o.kind === 'night' ? '#14204a' : '#d9a868'; c.fillRect(0, 1250, W, H - 1250); c.fillStyle = 'rgba(80,60,140,.35)'; c.fillRect(0, 1244, W, 8); }
};

// ---------- 文字（排队，点阵之后才画；永远实色） ----------
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Heavy', col = C.ink, align = 'center', alpha = 1, scale = 1, rot = 0 } = o;
  K.queue(c, () => { c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); }); };
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 64), { fam = 'PuHui-Black', alpha = 1, scale = 1, padX = size * 0.5, bg = C.cream, fg = C.ink, rot = 0, edge = true } = o;
  c.save(); c.font = `${size}px "${fam}"`; const tw = c.measureText(s).width; c.restore(); const w = tw + padX * 2, h = size * 1.4;
  K.queue(c, () => { c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
    c.fillStyle = bg; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, size * 0.28); c.fill(); if (edge) { c.lineWidth = 5; c.strokeStyle = fg; c.stroke(); }
    c.font = `${size}px "${fam}"`; c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, size * 0.05); });
  return { w, h }; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return;
  if (o.plate === false) { K.text(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); return; }
  K.tag(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { size = 52 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1);
  K.queue(c, () => { c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ex, ey); c.stroke(); c.fillStyle = C.red; c.beginPath(); c.arc(ax, ay, 14, 0, TAU); c.fill(); });
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return;
  K.tag(c, TY.typed(s, K.at(lt, at + 0.3, [...s].length / 14)) || '　', bx, by, { size, scale: q, bg: o.bg || C.yel, fg: o.fg || C.ink, rot: o.rot ?? -0.03 }); };
K.bigText = (c, s, x, y, lt, at, o = {}) => { const chars = [...s], size = Math.max(100, o.size || 140), tile = size * 1.28, step = o.step ?? 0.09;
  const maxPer = Math.max(1, Math.floor(980 / (tile + 8))), rows = Math.ceil(chars.length / maxPer), per = Math.ceil(chars.length / rows), cols = o.cols || [C.yel, C.cream, C.pink, C.sky, C.lime];
  chars.forEach((ch, i) => { const rI = Math.floor(i / per), cI = i % per, n = Math.min(per, chars.length - rI * per), q = K.pop(lt, at + i * step, 0.45); if (q <= 0) return;
    const px = x + (cI - (n - 1) / 2) * (tile + 8), py = y + (rI - (rows - 1) / 2) * (tile + 10);
    K.queue(c, () => { c.translate(px, py); c.rotate((U.hash(i, 3) - 0.5) * 0.1); c.scale(q, q); c.globalAlpha *= clamp(q * 2);
      c.fillStyle = cols[(i + (o.shift || 0)) % cols.length]; c.beginPath(); c.roundRect(-tile / 2, -tile / 2, tile, tile, 26); c.fill(); c.lineWidth = 6; c.strokeStyle = C.ink; c.stroke();
      c.font = `${size}px "PuHui-Black"`; c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, size * 0.05); }); });
  return { rows, per, tile }; };

// ---------- 平涂形状（章节代码直接用；都是大块面，finish 会点彩化） ----------
K.disc = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
K.blob = (c, x, y, rx, ry, col, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };
K.rect = (c, x, y, w, h, col, r = 0) => { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
K.poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
K.bar = (c, a, b, w, col) => { c.strokeStyle = col; c.lineWidth = Math.max(16, w); c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
K.shadowEl = (c, x, y, rx, ry = rx * 0.25) => K.blob(c, x, y, rx, ry, 'rgba(60,40,130,.35)');
// 台阶：n 级，从左下往右上；cur 级高亮。返回每级的 {x,y,w,h}
K.stairs = (c, x, base, n, w, step, lt, at, o = {}) => { const out = [], cols = o.cols || [C.sky, C.green, C.yel, C.org, C.red, C.navy, C.violet, C.rose, C.blue, C.lime];
  for (let i = 0; i < n; i++) { const q = K.pop(lt, at + i * (o.gap ?? 0.18), 0.5), h = (o.h0 ?? 120) + step * i, xx = x + i * w;
    out.push({ x: xx, y: base - h, w, h }); if (q <= 0) continue; c.save(); c.translate(0, (1 - clamp(q)) * 70); c.globalAlpha = clamp(q * 2);
    K.rect(c, xx, base - h, w, h, i === o.cur ? C.red : cols[i % cols.length], 14); c.restore(); }
  return out; };
// 人：只用色块，不画脸。pose: stand | walk | think | cheer | point | sit。(x,y) 脚底。s≈1 约 420px 高
K.person = (c, x, y, s = 1, o = {}) => { const { col = C.navy, skin = C.skin, hat = C.red, pose = 'stand', t = 0, flip = 1 } = o, sw = Math.sin(t * 6) * (pose === 'walk' ? 1 : 0);
  c.save(); c.translate(x, y); c.scale(s * flip, s); K.shadowEl(c, 0, 8, 90, 22);
  K.bar(c, [-24, -150], [-24 + sw * 26, -10], 30, C.ink); K.bar(c, [24, -150], [24 - sw * 26, -10], 30, C.ink);
  K.poly(c, [[-62, -150], [62, -150], [48, -330], [-48, -330]], col);
  const arms = { stand: [[-70, -120], [70, -120]], walk: [[-60 - sw * 20, -150], [60 + sw * 20, -150]], think: [[-70, -130], [20, -300]], cheer: [[-96, -420], [96, -420]], point: [[-70, -130], [150, -330]], sit: [[-70, -150], [60, -190]] }[pose] || [[-70, -120], [70, -120]];
  K.bar(c, [-48, -310], arms[0], 26, col); K.bar(c, [48, -310], arms[1], 26, col); K.disc(c, arms[0][0], arms[0][1], 17, skin); K.disc(c, arms[1][0], arms[1][1], 17, skin);
  K.disc(c, 0, -372, 42, skin); K.blob(c, 0, -396, 48, 30, hat); c.restore();
  return { head: [x, y - 372 * s], chest: [x, y - 250 * s], handL: [x + arms[0][0] * s * flip, y + arms[0][1] * s], handR: [x + arms[1][0] * s * flip, y + arms[1][1] * s] }; };
K.book = (c, x, y, w, h, col = C.red) => { K.rect(c, x, y, w, h, col, 14); K.rect(c, x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.8, C.cream, 8); K.rect(c, x + w * 0.46, y, w * 0.08, h, col); };
K.check = (c, x, y, s, col = C.green) => { c.strokeStyle = col; c.lineWidth = 26 * s; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - 50 * s, y); c.lineTo(x - 12 * s, y + 42 * s); c.lineTo(x + 56 * s, y - 44 * s); c.stroke(); };
K.cross = (c, x, y, s, col = C.red) => { c.strokeStyle = col; c.lineWidth = 26 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 46 * s, y - 46 * s); c.lineTo(x + 46 * s, y + 46 * s); c.moveTo(x + 46 * s, y - 46 * s); c.lineTo(x - 46 * s, y + 46 * s); c.stroke(); };
K.scale = (c, x, y, w, tilt = 0, col = C.ink) => { K.bar(c, [x, y + 200], [x, y - 40], 20, col); K.rect(c, x - 90, y + 190, 180, 30, col, 12);
  c.save(); c.translate(x, y - 40); c.rotate(tilt); K.bar(c, [-w / 2, 0], [w / 2, 0], 20, col);
  for (const sd of [-1, 1]) { K.bar(c, [sd * w / 2, 0], [sd * w / 2 - 50, 150], 14, col); K.bar(c, [sd * w / 2, 0], [sd * w / 2 + 50, 150], 14, col); K.blob(c, sd * w / 2, 160, 90, 26, sd < 0 ? C.yel : C.sky); } c.restore(); };
K.magnifier = (c, x, y, r, col = C.ink) => { K.bar(c, [x + r * 0.7, y + r * 0.7], [x + r * 1.6, y + r * 1.6], 34, C.wood); c.strokeStyle = col; c.lineWidth = 26; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); K.disc(c, x, y, r - 10, 'rgba(255,255,255,.35)'); };
K.pot = (c, x, y, s = 1, lt = 0) => { K.blob(c, x, y - 70 * s, 130 * s, 80 * s, C.ink); K.rect(c, x - 130 * s, y - 120 * s, 260 * s, 70 * s, C.ink, 20 * s); K.bar(c, [x + 120 * s, y - 100 * s], [x + 220 * s, y - 130 * s], 22 * s, C.ink);
  for (let i = 0; i < 3; i++) { const q = (lt * 0.7 + i / 3) % 1; K.blob(c, x - 50 * s + i * 50 * s + Math.sin(q * 6) * 12, y - 150 * s - q * 130 * s, 24 * s, 34 * s, 'rgba(255,255,255,' + (0.8 - q * 0.7) + ')'); } };
K.plate = (c, x, y, r, items = [C.red, C.green, C.yel]) => { K.blob(c, x, y, r, r * 0.34, C.cream); K.blob(c, x, y - 4, r * 0.78, r * 0.24, C.paper2); items.forEach((col, i) => K.disc(c, x - r * 0.4 + i * r * 0.4, y - r * 0.12, r * 0.18, col)); };
K.tree = (c, x, y, s = 1, col = C.green) => { K.rect(c, x - 16 * s, y - 160 * s, 32 * s, 160 * s, C.wood); K.blob(c, x, y - 230 * s, 110 * s, 100 * s, col); K.blob(c, x - 60 * s, y - 190 * s, 70 * s, 60 * s, C.greenD); };
K.sun = (c, x, y, r, t = 0) => { K.disc(c, x, y, r * 1.5, 'rgba(246,230,154,.55)'); K.disc(c, x, y, r, C.yel); };
K.cloud = (c, x, y, w) => { K.blob(c, x, y, w * 0.5, w * 0.16, C.cream); K.blob(c, x - w * 0.15, y - w * 0.1, w * 0.22, w * 0.16, C.cream); K.blob(c, x + w * 0.12, y - w * 0.12, w * 0.26, w * 0.2, C.cream); };
K.arrow = (c, a, b, col = C.ink, w = 24) => { K.bar(c, a, b, w, col); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); K.poly(c, [[b[0] + Math.cos(ang) * 30, b[1] + Math.sin(ang) * 30], [b[0] + Math.cos(ang + 2.5) * 50, b[1] + Math.sin(ang + 2.5) * 50], [b[0] + Math.cos(ang - 2.5) * 50, b[1] + Math.sin(ang - 2.5) * 50]], col); };
K.bars = (c, vals, x, y, w, h, lt, at, o = {}) => { const mx = o.max || Math.max(...vals), bw = w / vals.length * 0.7, cols = o.cols || [C.blue, C.org, C.green, C.rose, C.yel];
  vals.forEach((v, i) => { const q = MO.cubicOut(K.at(lt, at + i * 0.15, 0.6)), bh = v / mx * h * q; K.rect(c, x + i * w / vals.length + (w / vals.length - bw) / 2, y + h - bh, bw, bh, cols[i % cols.length], 14); });
  K.text(c, '示意', x + w - 70, y - 30, { size: 44, col: C.violet }); };

// ---------- 章名 / 章节卡 / 字幕 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
const CARD_BG = ['paper', 'sky', 'warm', 'green', 'rose', 'dusk', 'paper', 'sky', 'warm', 'night'];
K.chapterCard = (c, lt, t, n, title) => {
  const kind = CARD_BG[(n - 1) % CARD_BG.length]; K.bg(c, t, { kind, ground: false });
  const NN = Math.max(K.CHAPTER_NAMES.length, n), x0 = 60, ww = (1080 - 2 * x0) / NN;
  for (let i = 0; i < NN; i++) { const q = K.pop(lt, 0.1 + i * 0.05, 0.5), h = 90 + i * 55, cur = i === n - 1, done = i < n - 1; if (q <= 0) continue;
    K.rect(c, x0 + i * ww + 4, 1330 - h * clamp(q), ww - 8, h * clamp(q), cur ? C.red : done ? C.green : (kind === 'night' ? C.blue : C.pink), 12); }
  const s = MO.slamK ? MO.slamK(clamp((lt - 0.05) / 0.2)) : K.pop(lt, 0.05, 0.3);
  if (lt > 0.05) { c.save(); c.translate(540, 470); c.scale(s, s); K.disc(c, 0, 0, 210, kind === 'night' ? C.yel : C.org); c.restore();
    K.text(c, String(n), 540, 485, { size: n > 9 ? 240 : 300, fam: 'PuHui-Black', col: C.cream, scale: s });
    K.tag(c, '第 ' + n + ' 章', 800, 700, { size: 56, scale: K.pop(lt, 0.3, 0.4), alpha: clamp(K.pop(lt, 0.3, 0.4) * 2), bg: C.cream, rot: 0.05 }); }
  const L = [...title].length;
  if (L <= 10) K.bigText(c, title, 540, L > 5 ? 900 : 880, lt, 0.5, { size: L > 5 ? 108 : 132, step: 0.1, shift: n });
  else { const a = [...title].slice(0, Math.ceil(L / 2)).join(''), b = [...title].slice(Math.ceil(L / 2)).join(''); K.popText(c, a, 540, 840, lt, 0.5, { size: 84 }); K.popText(c, b, 540, 970, lt, 0.8, { size: 84 }); }
  K.finish(c);
};
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 72, h = 90, x = 540, y = 1480; c.fillStyle = 'rgba(26,32,88,.88)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 26); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 3); c.restore(); };
})();
