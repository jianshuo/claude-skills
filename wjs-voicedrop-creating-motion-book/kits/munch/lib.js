// 画风套件 munch（来自《工程师造的诡计》）：竖屏 1080×1920，蒙克表现主义。导出 window.K（章节代码里写 const D = K）。
// 做法：K.bg 用「沿正弦方向场积分的长弯笔」铺天空与峡湾（半透明、不描边，按 8fps 缓存）；章节代码在上面画粗墨描边的平涂道具；
// 每镜最后 K.finish(c)：整幅按行/列正弦位移（世界在流动），然后才落排队的文字（实色，不被扭）。
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
  ink: '#1a0f14', cream: '#f6e9c8', org: '#e2541c', red: '#c8301e', yel: '#f4c03a', brown: '#8a2e1c', blue: '#2c5a8a', navy: '#14243e', steel: '#4a6aa0',
  olive: '#5a6a2a', wood: '#c88a42', plum: '#5a2a4a', skin: '#d8cf9a', gray: '#6a8a9a', paper: '#f6e9c8',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.4); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 底：流线笔天空＋峡湾 ----------
const KINDS = {
  dusk:  { sky: ['#e2541c', '#f08a24', '#f4c03a', '#c8301e', '#e8743a', '#f6a63a', '#b82a1e'], gr: ['#1d3a6a', '#2c5a8a', '#3a4a7a', '#14243e', '#4a6aa0', '#5a2a4a'], g0: '#b82a1e', g1: '#e2541c', g2: '#2c3a6a', g3: '#14243e' },
  blood: { sky: ['#c8301e', '#b82a1e', '#e2541c', '#8a2e1c', '#e8743a', '#a8201a', '#f08a24'], gr: ['#2a1020', '#5a2a4a', '#14243e', '#3a1a30', '#2c3a6a', '#8a2e1c'], g0: '#8a1a14', g1: '#c8301e', g2: '#4a1a30', g3: '#1a0f14' },
  dawn:  { sky: ['#f4c03a', '#f6d870', '#f08a24', '#f6e9a0', '#e8a640', '#cfe08a', '#f2b070'], gr: ['#2c5a8a', '#4a6aa0', '#5a8a9a', '#3a6a5a', '#6a8ab0', '#a8c8b0'], g0: '#e8a640', g1: '#f6d870', g2: '#4a7aa0', g3: '#2c4a6a' },
  night: { sky: ['#14243e', '#2c3a6a', '#3a4a7a', '#1d3a6a', '#5a2a4a', '#4a6aa0', '#2c5a8a'], gr: ['#0e1a30', '#14243e', '#1d3a6a', '#2a2a50', '#243a5a', '#3a2a4a'], g0: '#14243e', g1: '#2c3a6a', g2: '#14243e', g3: '#0a1020', star: true },
  calm:  { sky: ['#a8c8d8', '#cfe0d8', '#f6e9c8', '#8ab0c8', '#e8d8a8', '#b8d0c0', '#f0c890'], gr: ['#4a6aa0', '#5a8a9a', '#3a5a7a', '#6a8ab0', '#8ab0b8', '#2c5a8a'], g0: '#8ab0c8', g1: '#f0e0b8', g2: '#4a6aa0', g3: '#2c4a6a' },
  mist:  { sky: ['#6a7a8a', '#8a98a6', '#4a5a6a', '#a8b4bc', '#5a6a7a', '#7a8a96', '#c8c0b0'], gr: ['#2c3a4a', '#3a4a5a', '#14243e', '#4a5a6a', '#243444', '#5a6a7a'], g0: '#4a5a6a', g1: '#a8b4bc', g2: '#2c3a4a', g3: '#14243e' },
};
const BGN = 0.5;    // 笔触底按半分辨率画再放大（笔数不变、像素少 4 倍）
const bgCache = [];
function paintBg(kind, hor, q) {
  const P = KINDS[kind] || KINDS.dusk, t = q / 8;
  const cv = document.createElement('canvas'); cv.width = W * BGN; cv.height = H * BGN; const o = cv.getContext('2d'); o.scale(BGN, BGN);
  const gr = o.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.g0); gr.addColorStop(clamp(hor / H - 0.15), P.g1); gr.addColorStop(clamp(hor / H + 0.02), P.g2); gr.addColorStop(1, P.g3);
  o.fillStyle = gr; o.fillRect(0, 0, W, H);
  const horizon = x => hor + 70 * Math.sin(x * 0.008 + 0.5) + 8 * Math.sin(t * 2 + x * 0.02);
  const rg = (x, y) => (y < horizon(x) ? 0 : 1);
  const ang = (x, y, r) => r === 0 ? 0.55 * Math.sin(x * 0.011 + y * 0.018 - 2.4 * t) + 0.15 * Math.sin(y * 0.05 + 3 * t)
    : (Math.atan2(y - (hor + 450), x - 300) + Math.PI / 2 + 0.3 * Math.sin(2 * t) + 0.5 * Math.sin(x * 0.01 + y * 0.02));
  o.lineCap = 'round';
  const rnd = U.rng(q * 7 + 3), skyN = P.sky.length;
  for (let y = -10; y < H + 24; y += 24) for (let x = -10; x < W + 24; x += 24) {
    let px = x + (rnd() - 0.5) * 24, py = y + (rnd() - 0.5) * 24; const r0 = rg(px, py);
    let col;
    if (r0 === 0) { const yy = py + 22 * Math.sin(px * 0.014 - 2.2 * t); col = P.sky[Math.floor((((yy % (skyN * 28)) + skyN * 28) % (skyN * 28)) / 28) % skyN]; }
    else col = P.gr[Math.floor(rnd() * P.gr.length)];
    o.strokeStyle = col; o.globalAlpha = r0 === 0 ? 0.78 : 0.6; o.lineWidth = r0 === 0 ? 13 : 12;
    const n = (r0 === 0 ? 30 : 24) + Math.floor(rnd() * 8); o.beginPath(); o.moveTo(px, py);
    for (let i = 0; i < n; i++) { const a = ang(px, py, r0); px += Math.cos(a) * 7; py += Math.sin(a) * 7; if (rg(px, py) !== r0) break; o.lineTo(px, py); }
    o.stroke();
  }
  o.globalAlpha = 1;
  if (P.star) { o.fillStyle = '#f4e8a0'; for (let i = 0; i < 26; i++) { const x = U.hash(i, 5) * W, y = U.hash(i, 6) * (hor - 150) + 60; o.globalAlpha = 0.5 + 0.4 * U.hash(i, 7); o.beginPath(); o.arc(x, y, 5 + U.hash(i, 8) * 7, 0, TAU); o.fill(); } o.globalAlpha = 1; }
  return cv;
}
let lastT = 0;
K.bg = (c, t, o = {}) => {
  POST = []; lastT = t;
  const kind = o.kind || 'dusk', hor = o.horizon || 1020, q = Math.floor(t * 8), key = kind + '|' + hor + '|' + q;
  let e = bgCache.find(b => b.key === key);
  if (!e) { e = { key, cv: paintBg(kind, hor, q) }; bgCache.push(e); if (bgCache.length > 3) bgCache.shift(); }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.drawImage(e.cv, 0, 0, c.canvas.width, c.canvas.height); c.restore();
};

// ---------- 整幅扭动＋落字 ----------
let POST = [], tmpCv = null;
K.queue = (c, fn) => { POST.push({ fn, M: c.getTransform(), a: c.globalAlpha }); };
K.finish = c => {
  const cv = c.canvas, cw = cv.width, ch = cv.height, t = lastT, sx = cw / W, sy = ch / H;
  if (!tmpCv || tmpCv.width !== cw || tmpCv.height !== ch) { tmpCv = document.createElement('canvas'); tmpCv.width = cw; tmpCv.height = ch; }
  const m = tmpCv.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, cw, ch); m.drawImage(cv, 0, 0);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const M = 16 * sx, bandH = 6 * sy;
  for (let y = 0; y < ch; y += bandH) {
    const yy = y / sy, dx = (7 * Math.sin(yy * 0.012 + 4.2 * t) + 3 * Math.sin(yy * 0.031 - 6 * t)) * sx;
    c.drawImage(tmpCv, M, y, cw - 2 * M, bandH, M + dx - M, y, cw, bandH);   // 源取去掉边距的中段，拉伸回全宽再位移：边缘不露缺口
  }
  c.restore();
  for (const p of POST) { c.save(); c.setTransform(p.M); c.globalAlpha = p.a; p.fn(); c.restore(); }
  POST = [];
};

// ---------- 文字（排队，扭动之后画；实色，粗墨描边） ----------
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Heavy', col = C.cream, align = 'center', alpha = 1, scale = 1, rot = 0, stroke = true } = o;
  K.queue(c, () => { c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle';
    if (stroke) { c.lineJoin = 'round'; c.lineWidth = size * 0.16; c.strokeStyle = C.ink; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); }); };
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 64), { fam = 'PuHui-Black', alpha = 1, scale = 1, padX = size * 0.5, bg = C.cream, fg = C.ink, rot = 0 } = o;
  c.save(); c.font = `${size}px "${fam}"`; const tw = c.measureText(s).width; c.restore(); const w = tw + padX * 2, h = size * 1.4;
  K.queue(c, () => { c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
    c.fillStyle = bg; c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.fill(); c.lineWidth = 7; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.stroke();
    c.font = `${size}px "${fam}"`; c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, size * 0.05); });
  return { w, h }; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return;
  if (o.plate === false) { K.text(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); return; }
  K.tag(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { size = 52 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1);
  K.queue(c, () => { c.strokeStyle = C.ink; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ex, ey); c.stroke(); c.fillStyle = C.red; c.beginPath(); c.arc(ax, ay, 16, 0, TAU); c.fill(); c.lineWidth = 5; c.stroke(); });
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return;
  K.tag(c, TY.typed(s, K.at(lt, at + 0.3, [...s].length / 14)) || '　', bx, by, { size, scale: q, bg: o.bg || C.yel, fg: o.fg || C.ink, rot: o.rot ?? -0.03 }); };
K.bigText = (c, s, x, y, lt, at, o = {}) => { const chars = [...s], size = Math.max(100, o.size || 140), step = o.step ?? 0.09, adv = size * 1.02;
  const maxPer = Math.max(1, Math.floor(980 / adv)), rows = Math.ceil(chars.length / maxPer), per = Math.ceil(chars.length / rows), cols = o.cols || [C.cream, C.yel, C.cream, C.org];
  chars.forEach((ch, i) => { const rI = Math.floor(i / per), cI = i % per, n = Math.min(per, chars.length - rI * per), q = K.pop(lt, at + i * step, 0.45); if (q <= 0) return;
    const px = x + (cI - (n - 1) / 2) * adv, py = y + (rI - (rows - 1) / 2) * (size * 1.15);
    K.queue(c, () => { c.translate(px, py); c.rotate((U.hash(i, 3) - 0.5) * 0.12); c.scale(q, q); c.globalAlpha *= clamp(q * 2);
      c.font = `${size}px "PuHui-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = size * 0.17; c.strokeStyle = C.ink; c.strokeText(ch, 0, 0);
      c.fillStyle = cols[(i + (o.shift || 0)) % cols.length]; c.fillText(ch, 0, 0); }); });
  return { rows, per }; };

// ---------- 描边平涂形状 ----------
const LW = 7;
const stroke = (c, col, lw = LW) => { c.lineWidth = lw; c.strokeStyle = col || C.ink; c.lineJoin = 'round'; c.stroke(); };
K.disc = (c, x, y, r, col, ol = true) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); if (ol) stroke(c); };
K.blob = (c, x, y, rx, ry, col, rot = 0, ol = true) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); if (ol) stroke(c); };
K.rect = (c, x, y, w, h, col, r = 0, ol = true) => { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); if (ol) stroke(c); };
K.poly = (c, pts, col, ol = true) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); if (ol) stroke(c); };
K.bar = (c, a, b, w, col, ol = true) => { c.lineCap = 'round'; if (ol) { c.strokeStyle = C.ink; c.lineWidth = Math.max(12, w) + 10; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.strokeStyle = col; c.lineWidth = Math.max(12, w); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
K.shadowEl = (c, x, y, rx, ry = rx * 0.25) => K.blob(c, x, y, rx, ry, 'rgba(10,5,20,.45)', 0, false);
K.gear = (c, x, y, r, teeth = 12, rot = 0, col = C.wood, hole = r * 0.22) => {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < teeth; i++) { const a = i / teeth * TAU, w = TAU / teeth;
    c.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); c.lineTo(Math.cos(a + w * 0.2) * r, Math.sin(a + w * 0.2) * r); c.lineTo(Math.cos(a + w * 0.5) * r, Math.sin(a + w * 0.5) * r); c.lineTo(Math.cos(a + w * 0.7) * r * 0.82, Math.sin(a + w * 0.7) * r * 0.82); }
  c.closePath(); c.fillStyle = col; c.fill(); stroke(c); c.beginPath(); c.arc(0, 0, hole, 0, TAU); c.fillStyle = C.navy; c.fill(); stroke(c); c.restore(); };
K.target = (c, x, y, r) => { const cols = [C.cream, C.ink, C.blue, C.red, C.yel]; for (let i = 0; i < 5; i++) K.disc(c, x, y, r * (1 - i * 0.2), cols[i]); };
K.arrowShot = (c, x, y, len = 200, ang = -0.7) => { c.save(); c.translate(x, y); c.rotate(ang); K.bar(c, [0, 0], [len, 0], 12, C.wood); K.poly(c, [[len, -18], [len + 44, 0], [len, 18]], C.red); c.restore(); };
K.card = (c, x, y, w, h, rot = 0, label = '', col = C.cream, size = 52) => { c.save(); c.translate(x, y); c.rotate(rot); K.rect(c, -w / 2, -h / 2, w, h, col, 4); c.restore();
  if (label) K.text(c, label, x, y, { size, col: C.ink, rot, stroke: false }); };
K.person = (c, x, y, s = 1, o = {}) => { const { col = C.ink, skin = C.skin, pose = 'stand', t = 0, flip = 1 } = o, sw = Math.sin(t * 6) * (pose === 'walk' ? 1 : 0);
  c.save(); c.translate(x, y); c.scale(s * flip, s); K.shadowEl(c, 0, 8, 90, 22);
  K.bar(c, [-24, -150], [-24 + sw * 26, -10], 30, col, false); K.bar(c, [24, -150], [24 - sw * 26, -10], 30, col, false);
  K.poly(c, [[-62, -150], [62, -150], [48, -330], [-48, -330]], col, false);
  const arms = { stand: [[-70, -120], [70, -120]], walk: [[-60 - sw * 20, -150], [60 + sw * 20, -150]], think: [[-70, -130], [20, -300]], cheer: [[-96, -420], [96, -420]], point: [[-70, -130], [150, -330]], sit: [[-70, -150], [60, -190]] }[pose] || [[-70, -120], [70, -120]];
  K.bar(c, [-48, -310], arms[0], 26, col, false); K.bar(c, [48, -310], arms[1], 26, col, false); K.disc(c, arms[0][0], arms[0][1], 17, skin); K.disc(c, arms[1][0], arms[1][1], 17, skin);
  K.disc(c, 0, -372, 44, col, false); c.restore();
  return { head: [x, y - 372 * s], chest: [x, y - 250 * s], handL: [x + arms[0][0] * s * flip, y + arms[0][1] * s], handR: [x + arms[1][0] * s * flip, y + arms[1][1] * s] }; };
K.book = (c, x, y, w, h, col = C.red) => { K.rect(c, x, y, w, h, col, 6); K.rect(c, x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.8, C.cream, 4); K.rect(c, x + w * 0.46, y, w * 0.08, h, col, 0); };
K.check = (c, x, y, s, col = C.olive) => { c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - 50 * s, y); c.lineTo(x - 12 * s, y + 42 * s); c.lineTo(x + 56 * s, y - 44 * s); c.strokeStyle = C.ink; c.lineWidth = 38 * s; c.stroke(); c.strokeStyle = col; c.lineWidth = 26 * s; c.stroke(); };
K.cross = (c, x, y, s, col = C.red) => { c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 46 * s, y - 46 * s); c.lineTo(x + 46 * s, y + 46 * s); c.moveTo(x + 46 * s, y - 46 * s); c.lineTo(x - 46 * s, y + 46 * s); c.strokeStyle = C.ink; c.lineWidth = 38 * s; c.stroke(); c.strokeStyle = col; c.lineWidth = 26 * s; c.stroke(); };
K.arrow = (c, a, b, col = C.cream, w = 22) => { K.bar(c, a, b, w, col); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); K.poly(c, [[b[0] + Math.cos(ang) * 34, b[1] + Math.sin(ang) * 34], [b[0] + Math.cos(ang + 2.5) * 52, b[1] + Math.sin(ang + 2.5) * 52], [b[0] + Math.cos(ang - 2.5) * 52, b[1] + Math.sin(ang - 2.5) * 52]], col); };
K.bars = (c, vals, x, y, w, h, lt, at, o = {}) => { const mx = o.max || Math.max(...vals), bw = w / vals.length * 0.7, cols = o.cols || [C.yel, C.org, C.cream, C.red, C.steel];
  vals.forEach((v, i) => { const q = MO.cubicOut(K.at(lt, at + i * 0.15, 0.6)), bh = v / mx * h * q; K.rect(c, x + i * w / vals.length + (w / vals.length - bw) / 2, y + h - bh, bw, bh, cols[i % cols.length], 0); });
  K.text(c, '示意', x + w - 70, y - 30, { size: 44, col: C.cream }); };
K.bridge = (c, x0, x1, y, lt = 1) => { K.poly(c, [[x0, y], [x1, y + 90], [x1, y + 150], [x0, y + 60]], C.wood); for (let i = 0; i <= 6; i++) { const u = i / 6; K.bar(c, [lerp(x0, x1, u), lerp(y, y + 90, u) - 110], [lerp(x0, x1, u), lerp(y, y + 90, u)], 12, C.ink, false); } K.bar(c, [x0, y - 110], [x1, y - 20], 12, C.ink, false); };

// ---------- 章名 / 章节卡 / 字幕 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
const CARD_KINDS = ['dusk', 'dawn', 'blood', 'calm', 'dusk', 'mist', 'dawn', 'dusk', 'calm', 'night'];
K.chapterCard = (c, lt, t, n, title) => {
  const kind = CARD_KINDS[(n - 1) % CARD_KINDS.length]; K.bg(c, t, { kind, horizon: 1150 });
  const NN = Math.max(K.CHAPTER_NAMES.length, n), x0 = 50, ww = (1080 - 2 * x0) / NN;
  for (let i = 0; i < NN; i++) { const q = K.pop(lt, 0.1 + i * 0.04, 0.5), h = 40 + i * 12, cur = i === n - 1; if (q <= 0) continue;
    K.rect(c, x0 + i * ww + 3, 1330 - h * clamp(q), ww - 6, h * clamp(q), cur ? C.red : i < n - 1 ? C.yel : C.steel, 0); }
  const s = MO.slamK ? MO.slamK(clamp((lt - 0.05) / 0.2)) : K.pop(lt, 0.05, 0.3);
  if (lt > 0.05) { c.save(); c.translate(540, 470); c.scale(s, s); K.gear(c, 0, 0, 230, 16, lt * 0.5, C.wood, 70); c.restore();
    K.text(c, String(n), 540, 470, { size: n > 9 ? 150 : 190, fam: 'PuHui-Black', col: C.cream, scale: s });
    K.tag(c, '第 ' + n + ' 章', 800, 720, { size: 56, scale: K.pop(lt, 0.3, 0.4), alpha: clamp(K.pop(lt, 0.3, 0.4) * 2), rot: 0.05 }); }
  const L = [...title].length;
  if (L <= 10) K.bigText(c, title, 540, L > 5 ? 930 : 910, lt, 0.5, { size: L > 5 ? 108 : 132, step: 0.1, shift: n });
  else { const a = [...title].slice(0, Math.ceil(L / 2)).join(''), b = [...title].slice(Math.ceil(L / 2)).join(''); K.popText(c, a, 540, 860, lt, 0.5, { size: 84 }); K.popText(c, b, 540, 990, lt, 0.8, { size: 84 }); }
  K.finish(c);
};
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 72, h = 90, x = 540, y = 1480; c.fillStyle = 'rgba(20,10,20,.86)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 12); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 3); c.restore(); };
})();
