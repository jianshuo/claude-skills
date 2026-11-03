// 画风套件 cave（配方 huashu-art-motion 01_cave「40,000 BC 洞穴岩画，纯代码」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 核心手法「颜料吃进岩面」：岩壁 relief（半分辨率 fbm 高度场 × 法线 × 左上光）与岩面贴图全部 P.cached；
//   一切图形画进 K.paint 的颜料层（K.shape：fuzz 炭点毛边 + ink 炭笔图案描边 + 平涂；K.text 同理），
//   整层 source-atop 叠一次岩面贴图（全屏合成每帧仅此 1 次），炭点图案 9fps 错位「沸腾」。
// 分层顺序：K.bg（岩壁/裂缝/旧手印装饰）→ K.paint(g=>{…图形/字/手印/人/动物…}) → K.fire（overlay 火光）→ K.embers → K.finish（颗粒＋字幕带压暗）。
// 铁律：3+1 色板（赭墙/炭黑/白垩＋红赭），红赭只给重点；人不画写实五官（侧影＋杏仁眼）；主体 y200–1350，字幕带 y1380–1560 不放内容；
//   全部确定性（U.hash/U.rng 种子）；字体只用引擎自带 PuHui-Black/Heavy/Bold；GB2312 以外的字不许出现。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp, rng } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：负半径直接抛错（backOut 过冲/进度插值会算出负半径），一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__cav) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__cav = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}

// ---------- 色板（3+1：赭墙 / 炭黑 / 白垩 ＋ 红赭只给重点） ----------
const C = D.C = {
  wallL: '#ce925a', wallD: '#6e4426', wallR: '#b6643a',           // 岩壁（亮赭/暗/红斑）
  ink: '#21150d',                                                  // 炭黑（线、字）
  chalk: '#f0dfbf',                                                // 白垩（高光、字幕字、负形内填）
  red: '#9c3520', redD: '#74261a', hand: '#8e2a1a',                // 红赭（重点字、手印、重点记号）
  ochre: '#c9772f', bison: '#8c3d22', horse: '#cf8236',            // 动物平涂
  ember: '#ffe082', board: '#160b04',                              // 余烬 / 字幕底板
};
D.SAFE = { top: 200, bot: 1350, sub: 1480 };   // 主体区 y200–1350；字幕带 1380–1560

// ---------- 进度 / 缓存 / 相机 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };
D.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
D.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
D.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 炭笔图案（fuzz 喷点毛边 / ink 炭黑颗粒 / red 红赭颗粒），9fps 沸腾 ----------
const mkTile = (key, r0, g0, b0, seed) => P.cached(key, 256, 256, (g) => {
  const img = g.createImageData(256, 256), d = img.data, r = rng(seed);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256, y = (i / 256) | 0, n = P.noise(x * 0.09, y * 0.09) * 0.5 + P.noise(x * 0.3 + 9, y * 0.3) * 0.5;
    const hole = r() < 0.07 || n > 0.58;
    d[i * 4] = r0; d[i * 4 + 1] = g0; d[i * 4 + 2] = b0; d[i * 4 + 3] = hole ? 255 * r() * 0.35 : 225 + r() * 30;
  }
  g.putImageData(img, 0, 0);
});
const fuzzTile = () => P.cached('cv_fuzzpat', 256, 256, (g) => {
  const r = rng(57); g.fillStyle = '#21150d';
  for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.35 + r() * 0.6; g.beginPath(); g.arc(r() * 256, r() * 256, 0.7 + r() * 1.5, 0, TAU); g.fill(); }
});
const PATM = new WeakMap();
const pat = (g, t, tile) => {
  let m = PATM.get(g); if (!m) { m = {}; PATM.set(g, m); }
  let p = m[tile]; if (!p) { p = m[tile] = g.createPattern(tile(), 'repeat'); }
  const r = rng(P.boilSeed(t, 9) * 7 + 3);                 // 9fps 图案整体错位 → 炭点「沸腾」（几何不动）
  p.setTransform(new DOMMatrix().translate((r() * 256) | 0, (r() * 256) | 0)); return p;
};
const inkPat = (g, t) => pat(g, t, () => mkTile('cv_inkpat', 33, 21, 13, 91));
const redPat = (g, t) => pat(g, t, () => mkTile('cv_redpat', 156, 53, 32, 133));
const fuzzPat = (g, t) => pat(g, t, fuzzTile);

// ---------- 颜料图形的统一画法 ----------
// K.shape(g,path,fill,lw,t,alpha)：先 fuzz 宽描（外半圈喷点毛边）再 ink 实描，最后平涂 fill 盖住内半圈
D.shape = (g, path, fill, lw, t, alpha = 1) => {
  if (lw) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = fuzzPat(g, t); g.lineWidth = lw * 2 + 7; g.stroke(path); g.strokeStyle = inkPat(g, t); g.lineWidth = lw * 2; g.stroke(path); }
  if (fill) { g.globalAlpha = alpha; g.fillStyle = fill; g.fill(path); g.globalAlpha = 1; }
};
// K.inkLine(g,path,lw,t)：纯炭线（不填色），四肢/轮廓/引线用
D.inkLine = (g, path, lw, t) => { if (lw > 3.5) { g.strokeStyle = fuzzPat(g, t); g.lineWidth = lw + 5; g.lineCap = 'round'; g.stroke(path); } g.strokeStyle = inkPat(g, t); g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(path); };
// K.spray(g,cx,cy,sigma,n,col,seed,…)：高斯喷点（手印/点列/炭灰）
D.spray = (g, cx, cy, sigma, n, col, seed, rmin = 0.8, rmax = 3.2, amin = 0.25, amax = 0.75) => {
  const r = rng(seed); g.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = r() * TAU, rr = Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * sigma; g.globalAlpha = amin + r() * (amax - amin); g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rmin + r() * (rmax - rmin), 0, TAU); g.fill(); }
  g.globalAlpha = 1;
};

// ---------- 岩壁（全部缓存） ----------
const HW = 540, HH = 960;
const relief = () => P.cached('cv_relief', HW, HH, (g) => {
  const WL = [206, 146, 90], WD = [110, 68, 38], WR = [182, 100, 58];
  const hgt = new Float32Array((HW + 1) * (HH + 1));
  for (let y = 0; y <= HH; y++) for (let x = 0; x <= HW; x++) { const X = x * 2, Y = y * 2;
    hgt[y * (HW + 1) + x] = P.fbm(X * 0.0022 + 3, Y * 0.0022, 4) * 1.0 + P.fbm(X * 0.011, Y * 0.011 + 7, 3) * 0.16 + P.noise(X * 0.05, Y * 0.05) * 0.03; }
  const img = g.createImageData(HW, HH), d = img.data, L = [-0.55, -0.62, 0.56];
  const shade = new Float32Array(HW * HH);
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const i = y * (HW + 1) + x, dx = (hgt[i + 1] - hgt[i]) * 52, dy = (hgt[i + HW + 1] - hgt[i]) * 52;
    const nl = Math.hypot(dx, dy, 1), dot = (-dx * L[0] - dy * L[1] + L[2]) / nl;
    const s = clamp(0.5 + (dot - 0.56) * 0.9); shade[y * HW + x] = s;
    const X = x * 2, Y = y * 2, n2 = P.fbm(X * 0.0016 + 11, Y * 0.0016 + 2, 3), n3 = P.fbm(X * 0.004 + 40, Y * 0.004, 2);
    let col = P.mix(WL, WD, clamp(0.35 - n2 * 1.3)); col = P.mix(col, WR, clamp(n3 * 1.4, 0, 0.45));
    const k = 0.72 + s * 0.55, j = (y * HW + x) * 4;
    d[j] = col[0] * k; d[j + 1] = col[1] * k; d[j + 2] = col[2] * k; d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0); g.__shade = shade;
});
// 岩面贴图（颜料层 source-atop 用）：阴影处压暗、亮处提暖 + 颗粒 + 低频干湿斑
const figTex = () => P.cached('cv_figtex', W, H, (g) => {
  const sh = relief().getContext('2d').__shade;
  const s = P.canvas(HW, HH), sg = s.getContext('2d'), img = sg.createImageData(HW, HH), d = img.data;
  for (let i = 0; i < HW * HH; i++) { const v = sh ? sh[i] : 0.5; const dk = v < 0.5; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = dk ? 20 : 255; if (!dk) { d[i * 4 + 1] = 236; d[i * 4 + 2] = 200; } d[i * 4 + 3] = (dk ? (0.5 - v) * 150 : (v - 0.5) * 50); }
  sg.putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, W, H);
  g.drawImage(P.grain('cv_fdk', 0.14, [30, 18, 8], 0.32), 0, 0);
  g.drawImage(P.grain('cv_flt', 0.05, [255, 236, 200], 0.22), 0, 0);
  const m = P.canvas(135, 240), mg = m.getContext('2d'), mi = mg.createImageData(135, 240);
  for (let i = 0; i < 135 * 240; i++) { const x = i % 135, y = (i / 135) | 0, n = P.fbm(x * 0.08 + 21, y * 0.08, 3); mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = n > 0 ? 255 : 0; mi.data[i * 4 + 3] = Math.abs(n) * 70; }
  mg.putImageData(mi, 0, 0); g.drawImage(m, 0, 0, W, H);
});
// 裂缝（随机游走；钳出 y1330–1600 字幕带）
const cracks = (g, seed) => {
  const r = rng(seed * 977 + 404);
  const starts = [[300, 0, 1.3], [520, 0, 1.75], [920, 0, 1.95], [0, 480, -0.12], [0, 1080, 0.12], [1080, 660, 3.1], [1080, 1220, 3.35], [140, 1920, -1.35], [880, 1920, -1.8], [0, 1650, 0.35]];
  const walk = (x, y, a, n, w, depth) => {
    const pts = [[x, y]];
    for (let s = 0; s < n; s++) { a += (r() - .5) * 0.9; const l = 14 + r() * 26; x += Math.cos(a) * l; y += Math.sin(a) * l;
      if (y > 1330 && y < 1600) y = y < 1465 ? 1330 : 1600;
      pts.push([x, y]);
      if (depth < 2 && r() < 0.12) walk(x, y, a + (r() < .5 ? 1 : -1) * (0.6 + r() * 0.6), (n - s) * 0.5 | 0, w * 0.7, depth + 1); }
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,226,180,.22)'; g.lineWidth = w + 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + 1.6, p[1] + 1.6) : g.moveTo(p[0] + 1.6, p[1] + 1.6)); g.stroke();
    g.strokeStyle = 'rgba(40,22,10,.62)'; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  };
  starts.forEach(([x, y, a]) => walk(x, y, a, 12 + (r() * 14 | 0), 2.2, 0));
};

// ---------- 负形喷绘手印（岩画母题＝「只有你能签字」的手） ----------
// K.handPath(s)：手形块数组（中心原点、指尖朝上；逐块填，避免 Path2D 子路径绕向相反的缺口）
D.handPath = (s = 1) => {
  const out = [], pal = new Path2D(); pal.ellipse(0, 8 * s, 26 * s, 31 * s, 0, 0, TAU); out.push(pal);
  [[-0.5, 54, -17], [-0.17, 64, -6], [0.14, 62, 6], [0.46, 50, 17], [-1.25, 46, -20]].forEach(([a, l, ox], k) => {
    const A = k < 4 ? [ox * s, -8 * s] : [-18 * s, 18 * s], B = [A[0] + Math.sin(a) * l * s, A[1] - Math.cos(a) * l * s];
    const p = new Path2D(); const n = Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.PI / 2, w = (k < 4 ? 7 : 8) * s;
    p.moveTo(A[0] + Math.cos(n) * w, A[1] + Math.sin(n) * w); p.lineTo(B[0] + Math.cos(n) * w * 0.85, B[1] + Math.sin(n) * w * 0.85);
    p.arc(B[0], B[1], w * 0.85, n, n + Math.PI, true); p.lineTo(A[0] - Math.cos(n) * w, A[1] - Math.sin(n) * w); p.closePath(); out.push(p); });
  const wr = new Path2D(); wr.rect(-16 * s, 26 * s, 32 * s, 46 * s); out.push(wr); return out;
};
// 手印画布（缓存）：高斯喷点云 − destination-out 实心手形 + 手形淡填白垩
const stencilCvs = (s, col, seed, inner) => {
  const size = Math.ceil(320 * Math.max(1, s * 1.35));
  return P.cached(`cv_hand_${size}_${s}_${seed}_${col}_${inner}`, size, size, (g) => {
    const mid = size / 2, dn = Math.max(1, s * s * 0.6), rf = Math.max(1, s * 0.55);
    D.spray(g, mid, mid, 46 * s, Math.round(3200 * dn), col, seed, 0.8 * rf, 3.2 * rf, 0.15, 0.6);
    D.spray(g, mid, mid, 28 * s, Math.round(1400 * dn), col, seed + 1, 1 * rf, 3.5 * rf, 0.3, 0.75);
    const mk = P.canvas(size, size), mg = mk.getContext('2d'); mg.translate(mid, mid); mg.fillStyle = '#f6e2bc'; D.handPath(s).forEach(p => mg.fill(p));
    g.save(); g.translate(mid, mid); g.restore();
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.95; g.drawImage(mk, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = inner; g.drawImage(mk, 0, 0);
  });
};
// K.handStencil(c,x,y,o)：o { s 缩放(1≈手掌 220px), rot, col(默认 hand 红赭), seed, p 0..1 按上墙的进度(1.05→1 缩放＋淡入), alpha, inner 负形内填白垩强度 }
D.handStencil = (c, x, y, o = {}) => {
  const s = o.s || 1, p = o.p ?? 1; if (p <= 0 || (o.alpha ?? 1) <= 0) return;
  const cv = stencilCvs(s, o.col || C.hand, o.seed || 31, o.inner ?? (s > 1.5 ? 0.12 : 0.3)), size = cv.width, k = 1.05 - 0.05 * clamp(p);
  c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(k, k); c.globalAlpha *= clamp(p) * (o.alpha ?? 1);
  c.drawImage(cv, -size / 2, -size / 2); c.restore();
};

// ---------- 底：岩壁 ----------
// K.bg(c,t,o)：o { seed(默认 1，决定裂缝/装饰布局), hands 四角旧手印装饰(默认 true), dots 顶部红点列(默认 true),
//   dim 额外压暗 0..1, warm 额外暖光 0..1, light 整体提亮 0..1 }
D.bg = (c, t, o = {}) => {
  const seed = o.seed || 1, hands = o.hands !== false, dots = o.dots !== false;
  const key = `cv_bg_${seed}_${hands ? 1 : 0}_${dots ? 1 : 0}`;
  const img = P.cached(key, W, H, (g) => {
    g.imageSmoothingQuality = 'high'; g.drawImage(relief(), 0, 0, W, H);
    g.drawImage(P.grain('cv_wdk', 0.22, [60, 36, 18], 0.32), 0, 0);
    g.drawImage(P.grain('cv_wlt', 0.10, [255, 238, 205], 0.28), 0, 0);
    cracks(g, seed);
    if (hands) { const rr = rng(seed * 31 + 7);
      [[120, 300, -0.3, 0.85], [950, 220, 0.25, 0.8], [108, 880, -0.15, 0.7], [968, 640, 0.3, 0.62]].forEach(([x, y, a, s], k) =>
        D.handStencil(g, x, y, { s, rot: a, seed: 31 + k * 17 + seed, alpha: 0.85 + rr() * 0.15 })); }
    if (dots) for (let k = 0; k < 13; k++) { const x = 200 + k * 56, y = 148 + Math.sin(k * 1.7) * 8;
      D.spray(g, x, y, 3.5, 30, '#9a2e1c', 200 + k + seed * 13, 0.8, 2, 0.4, 0.8); g.fillStyle = '#9a2e1c'; g.globalAlpha = 0.75; g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill(); g.globalAlpha = 1; }
    const v = g.createRadialGradient(540, 900, 300, 540, 960, 1500); v.addColorStop(0, 'rgba(30,14,4,0)'); v.addColorStop(0.55, 'rgba(30,14,4,.18)'); v.addColorStop(1, 'rgba(18,8,2,.82)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const fl = g.createRadialGradient(540, 1000, 20, 540, 1000, 700); fl.addColorStop(0, 'rgba(255,190,110,.32)'); fl.addColorStop(0.5, 'rgba(255,150,70,.13)'); fl.addColorStop(1, 'rgba(255,150,70,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = fl; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  });
  c.drawImage(img, 0, 0);
  if (o.light) { c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,230,190,${clamp(o.light)})`; c.fillRect(0, 0, W, H); c.restore(); }
  if (o.warm) { c.save(); c.globalCompositeOperation = 'lighter'; const w = c.createRadialGradient(540, 1000, 20, 540, 1000, 800); w.addColorStop(0, `rgba(255,180,100,${0.3 * clamp(o.warm)})`); w.addColorStop(1, 'rgba(255,150,70,0)'); c.fillStyle = w; c.fillRect(0, 0, W, H); c.restore(); }
  if (o.dim) { c.fillStyle = `rgba(14,6,2,${clamp(o.dim)})`; c.fillRect(0, 0, W, H); }
};
// K.paint(c,fn)：颜料层。fn(g) 里画一切图形/字（K.shape/K.text/K.handStencil/K.figure/K.animal…），
//   整层 source-atop 叠岩面贴图后贴上墙——这是「颜料吃进岩面」的唯一入口，全屏合成每帧仅此 1 次。
D.paint = (c, fn) => {
  const L = P.scratch('cv_fig'), g = L.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  fn(g);
  g.globalCompositeOperation = 'source-atop'; g.drawImage(figTex(), 0, 0); g.globalCompositeOperation = 'source-over';
  c.drawImage(L, 0, 0);
};

// ---------- 文字（炭笔字，画进 K.paint 才会吃岩面） ----------
// K.text(g,s,x,y,o)：(x,y) 基线中点；o { size(≥52), col 'ink'(默认)|'red'|'chalk', t(沸腾时钟), align, alpha, rot, maxW, fam }
D.text = (g, s, x, y, o = {}) => {
  const { size = 100, col = 'ink', t = 0, align = 'center', alpha = 1, rot = 0, maxW = 0, fam = 'PuHui-Black' } = o;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); if (rot) g.rotate(rot);
  g.font = `${size}px "${fam}"`; g.textAlign = align; g.textBaseline = 'alphabetic';
  let k = 1; if (maxW) { const w = g.measureText(s).width; if (w > maxW) k = maxW / w; } g.scale(k, k);
  g.lineJoin = 'round'; g.strokeStyle = fuzzPat(g, t); g.lineWidth = size * (col === 'chalk' ? 0.08 : 0.1) + 5; g.strokeText(s, 0, 0);
  g.fillStyle = col === 'chalk' ? C.chalk : (col === 'red' ? redPat(g, t) : inkPat(g, t)); g.fillText(s, 0, 0);
  g.restore();
};
// K.write(g,s,x,y,lt,at,dur,o)：炭笔写上动画。o.mode 'wipe'(默认，左→右擦出＋笔头炭点) | 'type'(逐字蹦上)；其余同 K.text。返回进度 0..1。
D.write = (g, s, x, y, lt, at, dur, o = {}) => {
  const p = MO.smooth(D.at(lt, at, dur)); if (p <= 0) return 0;
  const size = o.size || 100, t = o.t || 0, seed = o.seed || 11;
  if (o.mode === 'type') {
    const a = [...s], k = Math.round(p * a.length);
    if (k > 0) D.text(g, a.slice(0, k).join(''), x, y, o);
    if (p < 1 && k > 0) { g.save(); g.font = `${size}px "${o.fam || 'PuHui-Black'}"`; const w = g.measureText(s).width, wk = g.measureText(a.slice(0, k).join('')).width; g.restore();
      const hx = x - w / 2 + wk + size * 0.1, hy = y - size * 0.4, r = rng(seed + P.boilSeed(t, 24));
      g.fillStyle = '#160d07'; g.beginPath(); g.arc(hx + (r() - .5) * 5, hy + (r() - .5) * 5, size * 0.07, 0, TAU); g.fill(); }
    return p;
  }
  g.save(); g.font = `${size}px "${o.fam || 'PuHui-Black'}"`; const w = g.measureText(s).width; g.restore();
  const pad = size * 0.3, x0 = x - w / 2 - pad;
  g.save(); g.beginPath(); g.rect(x0 - 4, y - size * 1.3, (w + pad * 2) * p + 8, size * 1.65); g.clip();
  D.text(g, s, x, y, o); g.restore();
  if (p < 1) { const hx = x0 + (w + pad * 2) * p, hy = y - size * 0.42, r = rng(seed + P.boilSeed(t, 24));
    g.fillStyle = '#160d07'; g.beginPath(); g.arc(hx + (r() - .5) * 5, hy + (r() - .5) * 5, size * 0.08, 0, TAU); g.fill();
    D.spray(g, hx, hy, size * 0.07, 10, C.ink, seed * 7 + P.boilSeed(t, 12), 0.6, 1.7, 0.3, 0.7); }
  return p;
};
// K.popText(g,s,x,y,lt,at,o)：backOut 弹出的炭笔字。o { size(≥100), col, dur, alpha, rot, maxW }
D.popText = (g, s, x, y, lt, at, o = {}) => { const k = D.pop(lt, at, o.dur || 0.5); if (k <= 0) return;
  D.text(g, s, x, y, { ...o, size: Math.max(100, o.size || 120) * k * (o.scale || 1), alpha: clamp(k * 2) * (o.alpha ?? 1) }); };
// K.equals(g,x,y,o)：手画等号（PuHui GB2312 子集没有「＝」，缺字！等号一律用它画两条炭杠）。o { size(杠长,默认90), t, col 'ink'|'red' }
D.equals = (g, x, y, o = {}) => {
  const s = o.size || 90, t = o.t || 0, red = o.col === 'red', lw = Math.max(9, s * 0.15);
  for (const dy of [-s * 0.2, s * 0.2]) {
    const p = D.poly([[x - s / 2, y + dy + (U.hash(dy, 7) - .5) * 5], [x + s / 2, y + dy + (U.hash(dy, 3) - .5) * 5]], false);
    if (red) { g.save(); g.strokeStyle = redPat(g, t); g.lineWidth = lw; g.lineCap = 'round'; g.stroke(p); g.restore(); }
    else D.inkLine(g, p, lw, t);
  }
};
// K.callout(g,s,ax,ay,bx,by,lt,at,o)：炭线从锚点 (ax,ay) 长到 (bx,by)，末端逐字写上标签（≥52）。o { size, col, hot(红赭), seed }
D.callout = (g, s, ax, ay, bx, by, lt, at, o = {}) => {
  const t = o.t || 0, p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1);
  const lp = new Path2D(); P.roughPath({ moveTo: (...a) => lp.moveTo(...a), lineTo: (...a) => lp.lineTo(...a), beginPath() {} }, [[ax, ay], [ex, ey]], { amp: 2, seed: o.seed || 5, step: 10 });
  D.inkLine(g, lp, 4, t);
  g.fillStyle = o.hot ? C.red : C.ink; g.beginPath(); g.arc(ax, ay, 7 * Math.min(1, p1 * 3), 0, TAU); g.fill();
  D.spray(g, ax, ay, 4, 16, o.hot ? C.red : C.ink, (o.seed || 5) * 3 + 1, 0.7, 1.8, 0.3, 0.7);
  const q = D.at(lt, at + 0.3, [...s].length / 16); if (q <= 0) return;
  const a = [...s], k = Math.round(clamp(q) * a.length);
  D.text(g, a.slice(0, k).join(''), bx, by, { size: Math.max(52, o.size || 56), col: o.hot ? 'red' : (o.col || 'ink'), t, fam: 'PuHui-Heavy', align: o.align || 'center' });
};

// ---------- 人（岩画人形：红赭/炭黑剪影，侧脸只留一只杏仁眼，不画写实五官） ----------
const limb = (A, B, wA, wB) => { const n = Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.PI / 2, ca = Math.cos(n), sa = Math.sin(n), p = new Path2D();
  p.moveTo(A[0] + ca * wA, A[1] + sa * wA); p.lineTo(B[0] + ca * wB, B[1] + sa * wB); p.arc(B[0], B[1], wB, n, n + Math.PI, true);
  p.lineTo(A[0] - ca * wA, A[1] - sa * wA); p.arc(A[0], A[1], wA, n + Math.PI, n, true); p.closePath(); return p; };
// K.figure(g,x,y,o)：(x,y) 脚底中点，朝 +x（f:-1 镜像），身高约 600·s。
//   o { pose 'stand'|'reach'(伸手)|'carry'(抬物过肩)|'squat'(蹲), s, f, col(默认 red 红赭), lw, t, eye(默认 true) }
//   返回锚点 { head, hand, hand2 }（世界坐标），方便接续画手里/肩上的物。
D.figure = (g, x, y, o = {}) => {
  const { pose = 'stand', s = 0.9, f = 1, t = 0 } = o, col = o.col || C.red, lw = o.lw || 6;
  const A = {};   // 局部锚点
  g.save(); g.translate(x, y); g.scale(s * f, s);
  const head = (hx, hy, tilt = 0) => {
    const hp = new Path2D(); hp.ellipse(hx, hy, 34, 38, tilt, 0, TAU); D.shape(g, hp, col, lw, t);
    const nose = D.poly([[hx + 30, hy - 8], [hx + 44, hy + 2], [hx + 30, hy + 10]]); D.shape(g, nose, col, lw * 0.6, t);
    if (o.eye !== false) { g.save(); g.translate(hx + 12, hy - 6); g.rotate(tilt);
      g.fillStyle = C.chalk; g.beginPath(); g.ellipse(0, 0, 9, 5, -0.1, 0, TAU); g.fill();
      g.fillStyle = C.ink; g.beginPath(); g.arc(1.5, 0, 2.8, 0, TAU); g.fill(); g.restore(); }
    A.head = [hx, hy];
  };
  if (pose === 'squat') {
    const hip = [0, -215], knee = [100, -200], foot = [100, 0], sh = [42, -400];
    D.shape(g, limb([-24, -210], [70, -196], 26, 18), col, lw, t); D.shape(g, limb([70, -196], [70, 0], 18, 12), col, lw, t);   // 远腿
    D.shape(g, limb(hip, knee, 30, 20), col, lw, t); D.shape(g, limb(knee, foot, 20, 13), col, lw, t);
    D.shape(g, limb(hip, sh, 56, 46), col, lw, t);                                                                                 // 躯干（前倾）
    D.shape(g, limb(sh, [140, -300], 20, 11), col, lw, t); A.hand = [140, -300];                                                    // 臂前伸
    D.shape(g, limb([sh[0] - 8, sh[1] + 20], [96, -262], 18, 10), col, lw, t); A.hand2 = [96, -262];
    head(sh[0] + 18, sh[1] - 52, 0.1);
  } else {
    const lean = pose === 'reach' ? 14 : 0, hip = [0, -330], sh = [8 + lean, -498];
    D.shape(g, limb([-12, -330], [-30, 0], 26, 14), col, lw, t); D.shape(g, limb([16, -330], [38, 0], 26, 14), col, lw, t);         // 双腿
    D.shape(g, limb(hip, sh, 60, 50), col, lw, t);                                                                                 // 躯干
    if (pose === 'reach') { D.shape(g, limb(sh, [168, -548], 22, 12), col, lw, t); A.hand = [168, -548];
      D.shape(g, limb([sh[0] - 10, sh[1] + 26], [-34, -300], 20, 11), col, lw, t); A.hand2 = [-34, -300]; }
    else if (pose === 'carry') { D.shape(g, limb(sh, [74, -618], 22, 12), col, lw, t); A.hand = [74, -618];
      D.shape(g, limb([sh[0] - 12, sh[1] + 24], [122, -596], 20, 11), col, lw, t); A.hand2 = [122, -596]; }
    else { D.shape(g, limb(sh, [36, -282], 22, 12), col, lw, t); A.hand = [36, -282];
      D.shape(g, limb([sh[0] - 12, sh[1] + 24], [-6, -286], 20, 11), col, lw, t); A.hand2 = [-6, -286]; }
    head(sh[0] + 16, sh[1] - 56, pose === 'reach' ? 0.12 : 0);
  }
  g.restore();
  const W2 = p => [x + p[0] * s * f, y + p[1] * s];
  return { head: W2(A.head), hand: W2(A.hand), hand2: W2(A.hand2) };
};

// ---------- 动物（野牛/马剪影；两张姿态每 7 帧交替＝原始「动画」） ----------
const BISON_B = [[470, 300], [495, 280], [545, 268], [595, 250], [632, 240], [660, 246], [682, 268], [692, 300], [686, 330], [668, 350], [640, 356], [590, 352], [530, 348], [488, 342], [468, 324]];
const BISON_H = [[672, 270], [698, 280], [716, 302], [724, 326], [714, 340], [696, 338], [682, 326], [668, 300]];
const HORSE_B = [[452, 474], [470, 458], [510, 456], [548, 452], [566, 432], [582, 414], [598, 410], [614, 432], [612, 444], [598, 444], [586, 438], [578, 458], [574, 478], [540, 488], [486, 488], [458, 486]];
const LEGS = {
  bison: [[[652, 340, 648, 392], [632, 346, 618, 396], [500, 340, 504, 394], [520, 344, 530, 394]],
          [[652, 340, 698, 384], [632, 346, 672, 394], [500, 340, 458, 378], [520, 344, 482, 390]]],
  horse: [[[566, 486, 562, 528], [552, 488, 544, 530], [484, 488, 488, 528], [470, 486, 466, 526]],
          [[566, 486, 596, 520], [552, 488, 580, 528], [484, 488, 456, 520], [470, 486, 442, 516]]],
};
// K.animal(g,x,y,o)：(x,y) 身体中心；o { kind 'bison'(默认)|'horse', s, f 镜像, t, ph 姿态 0/1(默认 t 每 7 帧交替), col }
D.animal = (g, x, y, o = {}) => {
  const kind = o.kind || 'bison', s = o.s || 1, f = o.f || 1, t = o.t || 0, ph = o.ph ?? Math.floor(t * 60 / 7) % 2;
  const cx = kind === 'bison' ? 585 : 523, cy = kind === 'bison' ? 318 : 463, TP = p => [x + (p[0] - cx) * s * f, y + (p[1] - cy) * s];
  g.save();
  LEGS[kind][ph].forEach(([x0, y0, x1, y1]) => D.inkLine(g, D.smooth([TP([x0, y0]), TP([(x0 + x1) / 2, (y0 + y1) / 2 + 2]), TP([x1, y1])], false), 5.5 * s, t));
  if (kind === 'bison') {
    const B = D.smooth(BISON_B.map(TP));
    D.shape(g, B, o.col || C.bison, 6 * s, t, 0.95);
    g.save(); g.clip(B); g.strokeStyle = 'rgba(70,24,10,.55)'; g.lineWidth = 20 * s; g.lineCap = 'round';
    g.stroke(D.smooth([[480, 292], [545, 276], [600, 258], [640, 252], [672, 268]].map(TP), false)); g.restore();
    const hcx = 698, hcy = 300, rot = (ph ? 0.12 : -0.09) * f;
    g.save(); g.translate(...TP([hcx, hcy])); g.rotate(rot); g.translate(-TP([hcx, hcy])[0], -TP([hcx, hcy])[1]);
    D.shape(g, D.smooth(BISON_H.map(TP)), '#76301a', 5 * s, t);
    D.inkLine(g, D.smooth([[700, 284], [708, 262], [722, 248]].map(TP), false), 4.5 * s, t);
    D.inkLine(g, D.smooth([[688, 280], [688, 258], [698, 242]].map(TP), false), 4 * s, t);
    g.fillStyle = C.ink; g.beginPath(); g.arc(...TP([704, 304]), 3.5 * s, 0, TAU); g.fill(); g.restore();
    g.fillStyle = C.ink; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(...TP([538 + k * 13, 301]), 3 * s, 0, TAU); g.fill(); }
    D.inkLine(g, D.smooth([[468, 296], [452, 314], [446, 336]].map(TP), false), 4 * s, t);
  } else {
    const B = D.smooth(HORSE_B.map(TP));
    const hcx = 590, hcy = 440, rot = (ph ? -0.08 : 0.1) * f;
    g.save(); g.translate(...TP([hcx, hcy])); g.rotate(rot); g.translate(-TP([hcx, hcy])[0], -TP([hcx, hcy])[1]);
    D.shape(g, B, o.col || C.horse, 5.5 * s, t, 0.95);
    D.shape(g, D.poly([[592, 414], [598, 396], [606, 414]].map(TP)), o.col || C.horse, 3 * s, t);
    for (let k = 0; k < 6; k++) { const p = new Path2D(); p.moveTo(...TP([566 + k * 4.5, 446 - k * 6])); p.lineTo(...TP([558 + k * 4.5, 438 - k * 6])); D.inkLine(g, p, 3 * s, t); }
    g.fillStyle = C.ink; g.beginPath(); g.arc(...TP([600, 424]), 3 * s, 0, TAU); g.fill(); g.restore();
    D.inkLine(g, D.smooth([[454, 468], [440, 480], [432, 500]].map(TP), false), 4 * s, t);
  }
  g.restore();
};

// ---------- 环境层 ----------
// K.fire(c,t,o)：火光摇曳（overlay 提亮暖化，不洗白颜料）＋暗部呼吸。o { fx, fy(默认 1420，火在画面外下方), k 强度(默认 1), glow [x,y,p] 重点物上的独立跳动暖光 }
D.fire = (c, t, o = {}) => {
  const n1 = P.noise(t * 3.1, 1.7), n2 = P.noise(t * 2.3, 8.1), kk = o.k ?? 1;
  const fl = (0.14 + 0.11 * P.noise(t * 9.5, 3.3) + 0.04 * Math.sin(t * 23) + 0.03 * Math.sin(t * 37)) * kk;
  const fx = (o.fx ?? 470) + n1 * 70, fy = (o.fy ?? 1420) + n2 * 42;
  const gr = c.createRadialGradient(fx, fy, 10, fx, fy, 1000 + n2 * 70); gr.addColorStop(0, `rgba(255,196,110,${fl * 2.2})`); gr.addColorStop(0.5, `rgba(255,160,80,${fl * 1.1})`); gr.addColorStop(1, 'rgba(255,140,60,0)');
  c.save(); c.globalCompositeOperation = 'overlay'; c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  const dk = c.createRadialGradient(fx, fy, 480, fx, fy, 1450); dk.addColorStop(0, 'rgba(20,8,2,0)'); dk.addColorStop(1, `rgba(20,8,2,${0.2 - fl * 0.4})`);
  c.fillStyle = dk; c.fillRect(0, 0, W, H);
  if (o.glow) { const [gx, gy, gp] = o.glow, v = clamp(0.5 + 0.9 * P.noise(t * 7, 3.7)) * (gp ?? 1);
    if (v > 0.05) { c.globalCompositeOperation = 'lighter';
      const hg = c.createRadialGradient(gx, gy, 5, gx, gy, 300); hg.addColorStop(0, `rgba(255,150,80,${0.22 * v})`); hg.addColorStop(1, 'rgba(255,120,60,0)'); c.fillStyle = hg; c.fillRect(gx - 300, gy - 300, 600, 600); } }
  c.restore();
};
// K.embers(c,t,o)：金色余烬上漂（默认 y1350→140，不进字幕带）。o { groups [[x0,x1,n]…], y0, y1, life }
D.embers = (c, t, o = {}) => {
  const groups = o.groups || [[0, 240, 13], [840, 1080, 13], [240, 840, 5]], y0 = o.y0 ?? 1350, y1 = o.y1 ?? 140;
  c.save(); c.globalCompositeOperation = 'lighter';
  groups.forEach(([x0, x1, n], s) => {
    P.particles(n, 300 + s * 31, t, { x0, x1, y0, y1, drift: 22, life: o.life || 5.5 }).forEach(p => {
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 7 + p.i * 1.9)), fade = Math.sin(p.q * Math.PI), r0 = 1.8 + p.s * 2.0;
      c.fillStyle = `rgba(255,170,60,${0.26 * tw * fade})`; c.beginPath(); c.arc(p.x, p.y, r0 * 3.0, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,224,130,${0.95 * tw * fade})`; c.beginPath(); c.arc(p.x, p.y, r0, 0, TAU); c.fill();
    });
  });
  c.restore();
};
// 每镜收尾：颗粒＋字幕带 y1380–1560 压暗（深褐渐变，不放内容）
D.finish = (c, o = {}) => {
  c.drawImage(P.grain('cavekit', 0.05, [40, 24, 12], 0.12), 0, 0);
  const b = c.createLinearGradient(0, 1340, 0, 1620); b.addColorStop(0, 'rgba(16,7,2,0)'); b.addColorStop(0.28, `rgba(16,7,2,${o.band ?? 0.66})`); b.addColorStop(0.72, `rgba(16,7,2,${o.band ?? 0.66})`); b.addColorStop(1, 'rgba(16,7,2,0)');
  c.fillStyle = b; c.fillRect(0, 1340, W, 280);
};

// ---------- 章节卡 / 字幕 ----------
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
// 贯穿物 token：负形小手印在站间跳跃（呼应全书「只有你能签字」的手）。props.js 可覆盖 K.cardToken。
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking) =>
  D.handStencil(c, x, y, { s: 0.5, rot: walking ? Math.sin(lt * 9) * 0.3 : -0.06, seed: 77 }));
// K.chapterCard(c,lt,t,n,title)：「第 N 章」（红赭）＋章名（炭黑）逐字写上岩壁；底部 N 站进度线，小手印从上一站跳到本站。
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  D.bg(c, t, { seed: n * 3 + 1, hands: true, dots: true, dim: 0.06 });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 110, x1 = 970, y = 1150, X = i => lerp(x0, x1, i / (N - 1));
  const walkEnd = 1.2, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), from = n > 1 ? X(n - 2) : x0 - 40, done = X(n - 1);
  D.paint(c, g => {
    D.write(g, `第 ${n} 章`, 540, 350, lt, 0.1, 0.55, { size: 118, col: 'red', t, mode: 'type', seed: 5 });
    const ts = Math.max(100, Math.min(132, 900 / Math.max(1, [...title].length) * 1.6));
    D.write(g, title, 540, 590, lt, 0.6, Math.max(0.5, [...title].length / 11), { size: ts, t, mode: 'type', seed: 9, maxW: 920 });
    // 中部章徽：淡淡的负形手印（呼应「签字的手」）
    D.handStencil(g, 540, 890, { s: 1.5, rot: -0.05, alpha: 0.42, inner: 0.1, p: D.ease(D.at(lt, 1.0, 0.6)), seed: 90 });
    // 进度线：炭线 + 站（过了的站红实、本站大红、未到站白垩淡点）
    const lp = new Path2D(); lp.moveTo(x0 - 24, y); lp.lineTo(x1 + 24, y); D.inkLine(g, lp, 4, t);
    for (let i = 0; i < N; i++) { const past = i < n - 1, cur = i === n - 1;
      const pp = cur ? D.pop(lt, walkEnd, 0.45) : 1, r = cur ? 13 * Math.max(0.6, pp) : past ? 7 : 6;
      D.spray(g, X(i), y, 3, 12, past || cur ? '#9a2e1c' : '#f0dfbf', 600 + i, 0.7, 1.8, 0.3, 0.7);
      g.fillStyle = past || cur ? C.red : C.chalk; g.globalAlpha = past ? 0.9 : cur ? clamp(pp * 2) : 0.62;
      g.beginPath(); g.arc(X(i), y, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
    const tx = lerp(from, done, q), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 46 : -Math.max(0, 1 - (lt - walkEnd) * 4) * 16;
    D.cardToken(g, tx, y - 92 + hop, lt, t, lt < walkEnd, walkEnd, o);
  });
  D.fire(c, t, { glow: [540, 470, 0.7] });
  D.embers(c, t, { groups: [[0, 240, 8], [840, 1080, 8]] });
  D.finish(c, o);
};
// K.subtitle(c,text,alpha)：深褐底板＋白垩字，y≈1480，让开视频号底栏（assemble 生成的 subs.js 调它）
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(240,223,191,.85)'; c.fillRect(x - w / 2 + 6, y - h / 2 + 7, w, h);
  c.fillStyle = 'rgba(22,11,5,.94)'; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = C.red; c.fillRect(x - w / 2, y - h / 2, 8, h);
  c.fillStyle = C.chalk; c.fillText(text, x + 4, y + 2, 980); c.restore();
};
})();
