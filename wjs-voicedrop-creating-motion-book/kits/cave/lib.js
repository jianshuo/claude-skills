// 画风套件 cave（配方 huashu-art-motion 01_cave「洞穴岩画」，来自《达利欧机器》）：竖屏 1080×1920，导出 window.K。
// 规矩：岩壁赭土底（缓存）＋所有图形同一种画法「炭笔粗边＋喷点毛边＋赭石/白垩平涂」，K.finish 时整层再叠一次岩面明暗与颗粒；
//       文字＝平涂白垩/炭黑＋炭边（不被纹理打碎）；数据图元：石柱 K.bars、炭刻曲线 K.line、岩面十字 K.quad、齿轮 K.gear（贯穿物）。
//       红赭＝下行/风险/警示，赭黄＝上行/黄金/alpha，炭灰蓝只给股票/增长。线宽≥10px，字≥52px。随机一律种子化。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp, rng } = U, P = PAINT;
const K = window.K = { W, H, TAU };
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = { wallL: [206, 146, 90], wallD: [110, 68, 38], wallR: [182, 100, 58],
  charcoal: '#21150d', red: '#a8331f', redD: '#74261a', chalk: '#f0dfbf', ochre: '#c9772f', gold: '#e3a526', bison: '#8c3d22', stone: '#e8ce9a', stoneD: '#c9a46a', blue: '#566d78', hand: '#8e2a1a' };
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K._t = 0;
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const ez = q => MO.cubicOut(clamp(q));

// ---------- 炭笔/喷点图案（沸腾：每 1/9 秒随机平移，几何不动） ----------
const inkTile = () => P.cached('kcv_ink', 256, 256, g => { const img = g.createImageData(256, 256), d = img.data, r = rng(91);
  for (let i = 0; i < 65536; i++) { const x = i % 256, y = (i / 256) | 0, n = P.noise(x * 0.09, y * 0.09) * 0.5 + P.noise(x * 0.3 + 9, y * 0.3) * 0.5, hole = r() < 0.05 || n > 0.6;
    d[i * 4] = 33; d[i * 4 + 1] = 21; d[i * 4 + 2] = 13; d[i * 4 + 3] = hole ? 255 * r() * 0.4 : 232 + r() * 23; } g.putImageData(img, 0, 0); });
const fuzzTile = () => P.cached('kcv_fuzz', 256, 256, g => { const r = rng(57); g.fillStyle = '#21150d'; for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.35 + r() * 0.6; g.beginPath(); g.arc(r() * 256, r() * 256, 0.7 + r() * 1.5, 0, TAU); g.fill(); } });
let PATS = null, PSEED = -1;
const pat = (c, k) => { if (!PATS) { PATS = { ink: c.createPattern(inkTile(), 'repeat'), fuzz: c.createPattern(fuzzTile(), 'repeat') }; }
  const s = Math.floor(K._t * 9); if (s !== PSEED) { PSEED = s; const r = rng(s * 13 + 3); PATS.ink.setTransform(new DOMMatrix().translate((r() * 256) | 0, (r() * 256) | 0)); PATS.fuzz.setTransform(new DOMMatrix().translate((r() * 256) | 0, (r() * 256) | 0)); }
  return PATS[k]; };

// ---------- 路径工具 ----------
const poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
const smooth = (pts, closed = true) => { const p = new Path2D(), n = pts.length; if (n < 3) return poly(pts, closed);
  if (closed) { const m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]; let s = m(n - 1); p.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const e = m(i); p.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); } p.closePath(); }
  else { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); p.lineTo(pts[n - 1][0], pts[n - 1][1]); }
  return p; };
K.poly = poly; K.smooth = smooth;
// 粗糙矩形石板（带手抖，种子固定）
K.rough = (x, y, w, h, seed = 1, amp = 5) => { const r = rng(seed * 11 + 2), j = () => (r() - .5) * amp * 2, n = Math.max(2, Math.round(w / 160)), m = Math.max(2, Math.round(h / 160)), pts = [];
  for (let i = 0; i < n; i++) pts.push([x + w * i / n + j(), y + j()]); for (let i = 0; i < m; i++) pts.push([x + w + j(), y + h * i / m + j()]);
  for (let i = n; i > 0; i--) pts.push([x + w * i / n + j(), y + h + j()]); for (let i = m; i > 0; i--) pts.push([x + j(), y + h * i / m + j()]); return poly(pts, true); };
K.slab = (x, y, w, h, seed = 1, amp = 7) => { const r = rng(seed * 7 + 1), j = () => (r() - .5) * amp * 2;
  return smooth([[x + j(), y + j()], [x + w / 2, y + j() * .5], [x + w + j(), y + j()], [x + w + j(), y + h / 2], [x + w + j(), y + h + j()], [x + w / 2, y + h + j() * .5], [x + j(), y + h + j()], [x + j(), y + h / 2]], true); };

// ---------- 统一画法：炭边＋喷点毛边＋平涂 ----------
// 填充形：先喷点毛边，再炭边，再平涂盖住内半圈
K.shape = (c, path, fill, lw = 7) => { c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (lw) { c.strokeStyle = pat(c, 'fuzz'); c.lineWidth = lw * 2 + 8; c.stroke(path); c.strokeStyle = pat(c, 'ink'); c.lineWidth = lw * 2; c.stroke(path); }
  if (fill) { c.fillStyle = fill; c.fill(path); } c.restore(); };
// 炭线：lw 为线芯宽；col 给了就在炭边里填一道彩线（炭边宽出每侧 ~4.5px）
K.ink = (c, path, lw = 12, col = null) => { c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = pat(c, 'fuzz'); c.lineWidth = lw + (col ? 17 : 5); c.stroke(path); c.strokeStyle = pat(c, 'ink'); c.lineWidth = lw + (col ? 9 : 0); c.stroke(path);
  if (col) { c.strokeStyle = col; c.lineWidth = lw; c.stroke(path); } c.restore(); };

// ---------- 岩壁（全部缓存） ----------
const HW = 270, HH = 480, S = 4; let SHADE = null;
const relief = () => P.cached('kcv_relief', HW, HH, g => {
  const hgt = new Float32Array((HW + 1) * (HH + 1));
  for (let y = 0; y <= HH; y++) for (let x = 0; x <= HW; x++) { const X = x * S, Y = y * S; hgt[y * (HW + 1) + x] = P.fbm(X * 0.0022 + 3, Y * 0.0022, 4) + P.fbm(X * 0.011, Y * 0.011 + 7, 3) * 0.16 + P.noise(X * 0.05, Y * 0.05) * 0.03; }
  const img = g.createImageData(HW, HH), d = img.data, L = [-0.55, -0.62, 0.56], shade = new Float32Array(HW * HH);
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { const i = y * (HW + 1) + x, dx = (hgt[i + 1] - hgt[i]) * 52 * 1.2, dy = (hgt[i + HW + 1] - hgt[i]) * 52 * 1.2, nl = Math.hypot(dx, dy, 1);
    const s = clamp(0.5 + ((-dx * L[0] - dy * L[1] + L[2]) / nl - 0.56) * 0.9, 0, 1); shade[y * HW + x] = s;
    const X = x * S, Y = y * S, n2 = P.fbm(X * 0.0016 + 11, Y * 0.0016 + 2, 3), n3 = P.fbm(X * 0.004 + 40, Y * 0.004, 2);
    let col = P.mix(C.wallL, C.wallD, clamp(0.4 - n2 * 0.95, 0, 0.8)); col = P.mix(col, C.wallR, clamp(n3 * 1.1, 0, 0.3)); const k = 0.8 + s * 0.42, j = (y * HW + x) * 4;
    d[j] = col[0] * k; d[j + 1] = col[1] * k; d[j + 2] = col[2] * k; d[j + 3] = 255; }
  g.putImageData(img, 0, 0); SHADE = shade; });
// 整层岩面明暗：阴影→炭黑、亮处→暖白、颗粒、低频干湿斑；K.finish 时整帧叠一次
const figTex = () => P.cached('kcv_figtex', W, H, g => { relief(); const sh = SHADE;
  const s = P.canvas(HW, HH), sg = s.getContext('2d'), img = sg.createImageData(HW, HH), d = img.data;
  for (let i = 0; i < HW * HH; i++) { const v = sh[i], dk = v < 0.5; d[i * 4] = dk ? 20 : 255; d[i * 4 + 1] = dk ? 20 : 236; d[i * 4 + 2] = dk ? 20 : 200; d[i * 4 + 3] = dk ? (0.5 - v) * 90 : (v - 0.5) * 40; }
  sg.putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, W, H);
  g.drawImage(P.grain('kcv_fdk', 0.12, [30, 18, 8], 0.26), 0, 0); g.drawImage(P.grain('kcv_flt', 0.05, [255, 236, 200], 0.2), 0, 0);
  const m = P.canvas(108, 192), mg = m.getContext('2d'), mi = mg.createImageData(108, 192);
  for (let i = 0; i < 108 * 192; i++) { const x = i % 108, y = (i / 108) | 0, n = P.fbm(x * 0.08 + 21, y * 0.08, 3); mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = n > 0 ? 255 : 0; mi.data[i * 4 + 3] = Math.min(26, Math.abs(n) * 70); }
  mg.putImageData(mi, 0, 0); g.drawImage(m, 0, 0, W, H); });

function spray(g, cx, cy, sigma, n, col, seed, rmin = 0.8, rmax = 3.2, amin = 0.25, amax = 0.75) { const r = rng(seed); g.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = r() * TAU, rr = Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * sigma; g.globalAlpha = amin + r() * (amax - amin); g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rmin + r() * (rmax - rmin), 0, TAU); g.fill(); } g.globalAlpha = 1; }
function handPaths() { const out = [], pal = new Path2D(); pal.ellipse(0, 8, 26, 31, 0, 0, TAU); out.push(pal);
  [[-0.5, 54, -17], [-0.17, 64, -6], [0.14, 62, 6], [0.46, 50, 17], [-1.25, 46, -20]].forEach(([a, l, ox], k) => { const A = k < 4 ? [ox, -8] : [-18, 18], B = [A[0] + Math.sin(a) * l, A[1] - Math.cos(a) * l];
    const p = new Path2D(), n = Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.PI / 2, w = k < 4 ? 7 : 8;
    p.moveTo(A[0] + Math.cos(n) * w, A[1] + Math.sin(n) * w); p.lineTo(B[0] + Math.cos(n) * w * .85, B[1] + Math.sin(n) * w * .85); p.arc(B[0], B[1], w * .85, n, n + Math.PI, true); p.lineTo(A[0] - Math.cos(n) * w, A[1] - Math.sin(n) * w); p.closePath(); out.push(p); });
  const wr = new Path2D(); wr.rect(-16, 26, 32, 46); out.push(wr); return out; }
// 红赭手印（负形：喷点盖住手，手形处留岩面）。按 (col, seed) 缓存成 320² 位图，逐帧只贴图
function handTile(col, seed) { return P.cached('kcv_hand_' + col + seed, 320, 320, tg => {
  spray(tg, 160, 160, 46, 3200, col, seed, .8, 3.2, .15, .6); spray(tg, 160, 160, 28, 1400, col, seed + 1, 1, 3.5, .3, .75);
  const mk = P.canvas(320, 320), mg = mk.getContext('2d'); mg.translate(160, 160); mg.fillStyle = '#f6e2bc'; handPaths().forEach(p => mg.fill(p));
  tg.globalCompositeOperation = 'destination-out'; tg.globalAlpha = .95; tg.drawImage(mk, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = .3; tg.drawImage(mk, 0, 0); }); }
// K.hand(c,x,y,{scale=1,rot=0,col,seed=31,alpha=1,flip}) 手印约 190px 高 @scale1
K.hand = (c, x, y, o = {}) => { const { scale = 1, rot = 0, col = C.hand, seed = 31, alpha = 1, flip = false } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(flip ? -scale : scale, scale); c.drawImage(handTile(col, seed), -160, -160); c.restore(); };
function cracks(g) { const r = rng(404);
  const walk = (x, y, a, n, w, dp) => { const pts = [[x, y]]; for (let s = 0; s < n; s++) { a += (r() - .5) * .9; const l = 14 + r() * 26; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); if (dp < 2 && r() < .12) walk(x, y, a + (r() < .5 ? 1 : -1) * (.6 + r() * .6), (n - s) * .5 | 0, w * .7, dp + 1); }
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,226,180,.22)'; g.lineWidth = w + 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + 1.6, p[1] + 1.6) : g.moveTo(p[0] + 1.6, p[1] + 1.6)); g.stroke();
    g.strokeStyle = 'rgba(40,22,10,.62)'; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  [[300, 0, 1.6], [820, 0, 1.5], [0, 700, 0.1], [1080, 900, 3.1], [200, 1920, -1.5], [900, 1920, -1.6], [0, 1500, .2], [1080, 1500, 3.2]].forEach(([x, y, a]) => walk(x, y, a, 14 + (r() * 12 | 0), 2.4, 0)); }
const wall = hands => P.cached('kcv_bg' + (hands ? 'H' : ''), W, H, g => {
  g.imageSmoothingQuality = 'high'; g.drawImage(relief(), 0, 0, W, H);
  g.drawImage(P.grain('kcv_wdk', .2, [60, 36, 18], .3), 0, 0); g.drawImage(P.grain('kcv_wlt', .1, [255, 238, 205], .26), 0, 0); cracks(g);
  if (hands) [[110, 180, -.35, 1], [990, 150, .3, .95], [80, 1290, .25, .9], [1000, 1330, -.2, 1], [1010, 1700, .3, .9], [90, 1760, -.3, .9]].forEach(([x, y, a, s], k) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); g.drawImage(handTile(C.hand, 31 + k * 17), -160, -160); g.restore(); });
  const v = g.createRadialGradient(540, 760, 380, 540, 960, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,0,.62)'); g.fillStyle = v; g.fillRect(0, 0, W, H); });
// K.bg(c,t,{hands=true})：岩壁（缓存，每帧一次 drawImage）。必须每镜先调，它同时设定炭笔“沸腾”的时间。
K.bg = (c, t, o = {}) => { K._t = t || 0; c.drawImage(wall(o.hands !== false), 0, 0); };
// 收尾：整层岩面明暗＋火光＋字幕带压暗
K.finish = c => { c.drawImage(figTex(), 0, 0); const t = K._t;
  const fl = .13 + .08 * P.noise(t * 9.5, 3.3) + .03 * Math.sin(t * 23), fx = 540 + P.noise(t * 3.1, 1.7) * 60, fy = 900 + P.noise(t * 2.3, 8.1) * 40;
  const gr = c.createRadialGradient(fx, fy, 10, fx, fy, 900); gr.addColorStop(0, `rgba(255,196,110,${fl * 2.4})`); gr.addColorStop(.5, `rgba(255,160,80,${fl * 1.2})`); gr.addColorStop(1, 'rgba(255,140,60,0)');
  c.save(); c.globalCompositeOperation = 'overlay'; c.fillStyle = gr; c.fillRect(0, 0, W, H); c.restore();
  const sb = c.createLinearGradient(0, 1360, 0, 1640); sb.addColorStop(0, 'rgba(24,12,4,0)'); sb.addColorStop(.35, 'rgba(24,12,4,.34)'); sb.addColorStop(.7, 'rgba(24,12,4,.34)'); sb.addColorStop(1, 'rgba(24,12,4,0)'); c.fillStyle = sb; c.fillRect(0, 1360, W, 280); };

// ---------- 文字：平涂 + 炭边（不叠纹理） ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.text = (c, s, x, y, o = {}) => { const { size = 60, fam = 'PuHui-Heavy', col = C.chalk, align = 'center', alpha = 1, scale = 1, rot = 0, track = 0, lw = Math.max(5, size / 10) } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (track) c.letterSpacing = track + 'px';
  if (lw) { c.strokeStyle = pat(c, 'fuzz'); c.lineWidth = lw * 2 + 5; c.strokeText(s, 0, 0); c.strokeStyle = pat(c, 'ink'); c.lineWidth = lw * 2; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 石板标签（砂岩底＋炭字）。size≥52。o:{col 字色, fill 板色, w,h 指定尺寸, rot, scale, alpha, seed}
K.stone = (c, s, x, y, o = {}) => { const { size = 56, fam = 'PuHui-Heavy', col = '#2b1a12', fill = C.stone, scale = 1, alpha = 1, rot = 0, seed = hash(s) % 97 } = o;
  c.save(); c.font = `${size}px "${fam}"`; const w = o.w || c.measureText(s).width + size * 1.1, h = o.h || size * 1.55;
  c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  K.shape(c, K.slab(-w / 2, -h / 2, w, h, seed, 5), fill, 7);
  c.strokeStyle = 'rgba(120,80,40,.35)'; c.lineWidth = 4; c.lineCap = 'round'; const r = rng(seed + 5); for (let i = 0; i < 3; i++) { const px = (r() - .5) * w * .8, py = h / 2 - 12 - r() * 6; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 18 + r() * 24, py - 3); c.stroke(); }
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };
K.plate = K.stone;
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; (o.plate || o.stone ? K.stone : K.text)(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// 引线标签：炭线(粗8)从 (ax,ay) 画到 (bx,by)，端点一个炭点，标签是石板
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = ez(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  K.ink(c, poly([[ax, ay], [lerp(ax, bx, p1), lerp(ay, by, p1)]], false), 8);
  c.save(); c.fillStyle = C.charcoal; c.beginPath(); c.arc(ax, ay, 13, 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.25, 0.45); if (q > 0) K.stone(c, s, bx, by, { size: o.size || 52, col: o.col, scale: q }); };
// 旗标：左尖右方的红赭条（只给警示/结论）
K.tag = (c, s, x, y, o = {}) => { const { size = 52, col = C.red, tc = C.chalk } = o; c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + 40, h = size * 1.45;
  K.shape(c, poly([[x, y], [x + 28, y - h / 2], [x + 28 + w, y - h / 2], [x + 28 + w, y + h / 2], [x + 28, y + h / 2]]), col, 6);
  c.fillStyle = tc; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s, x + 48, y + 3); c.restore(); };
// 红赭印：砸下的方章（结论/下跌）
K.stamp = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const { size = 80, rot = -0.1, col = C.red } = o, k = MO.slamK((lt - at) / 0.17);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 0.8, h = size * 1.4;
  K.shape(c, K.slab(-w / 2, -h / 2, w, h, hash(s) % 97, 5), col, 8); c.fillStyle = C.chalk; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };

// ---------- 箭头 ----------
// K.arrow(c,x1,y1,x2,y2,{col=red,lw=16,prog=1,head=46}) 炭边彩芯粗箭头，任意方向，prog 控制画出进度
K.arrow = (c, x1, y1, x2, y2, o = {}) => { const { col = C.red, lw = 16, head = 46, prog = 1 } = o, p = clamp(prog); if (p <= 0) return;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ex = x1 + dx * p, ey = y1 + dy * p, r = rng(hash([x1, y1, x2, y2].join()) % 997);
  const mx = (x1 + ex) / 2 - uy * (r() - .5) * 8, my = (y1 + ey) / 2 + ux * (r() - .5) * 8;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; const shaft = poly([[x1, y1], [mx, my], [ex - ux * 6, ey - uy * 6]], false); K.ink(c, shaft, lw, col);
  if (p > .6) { const a = Math.atan2(uy, ux), hd = new Path2D(); hd.moveTo(ex - Math.cos(a - .5) * head, ey - Math.sin(a - .5) * head); hd.lineTo(ex, ey); hd.lineTo(ex - Math.cos(a + .5) * head, ey - Math.sin(a + .5) * head); K.ink(c, hd, lw, col); }
  c.restore(); };

// ---------- 图标（岩画符号，s=1 约 150px） ----------
const I = K.icons = {};
I.bison = (c, x, y, s = 1, o = {}) => { const { col = C.bison } = o; c.save(); c.translate(x, y); c.scale(s * .7, s * .7);
  [[-70, 30, -78, 100], [-30, 40, -34, 104], [34, 40, 40, 104], [72, 30, 84, 98]].forEach(([a, b, c2, d]) => K.ink(c, poly([[a, b], [c2, d]], false), 18));
  K.ink(c, smooth([[-96, -10], [-120, 10], [-112, 50]], false), 9);
  K.shape(c, smooth([[-100, 12], [-72, -34], [-20, -78], [30, -102], [68, -86], [104, -40], [136, -16], [146, 30], [124, 56], [102, 52], [92, 76], [60, 54], [0, 54], [-70, 48]], true), col, 8);
  K.ink(c, smooth([[112, -34], [124, -62], [146, -66]], false), 9); K.ink(c, smooth([[-52, -22], [-6, -66], [44, -64]], false), 9, '#5a2412');
  c.fillStyle = C.chalk; c.beginPath(); c.arc(120, 2, 6, 0, TAU); c.fill(); c.restore(); };
I.sun = (c, x, y, s = 1, o = {}) => { const { col = C.gold } = o; c.save(); c.translate(x, y); c.scale(s, s);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .1; K.ink(c, poly([[Math.cos(a) * 52, Math.sin(a) * 52], [Math.cos(a) * 84, Math.sin(a) * 84]], false), 12); }
  K.shape(c, K.circle(0, 0, 40), col, 8); c.restore(); };
I.wave = (c, x, y, s = 1, o = {}) => { const { col = C.chalk } = o; c.save(); c.translate(x, y); c.scale(s, s);
  [-42, 0, 42].forEach(dy => { const pts = []; for (let i = 0; i <= 8; i++) pts.push([-80 + i * 20, dy + (i % 2 ? -16 : 16)]); K.ink(c, smooth(pts, false), 12, col); }); c.restore(); };
I.human = (c, x, y, s = 1, o = {}) => { const { col = C.redD } = o; c.save(); c.translate(x, y); c.scale(s, s);
  K.ink(c, poly([[0, -22], [0, 34]], false), 26, col); K.ink(c, poly([[-4, -18], [-40, -52]], false), 14, col); K.ink(c, poly([[4, -18], [40, -52]], false), 14, col);
  K.ink(c, poly([[-3, 30], [-30, 82]], false), 15, col); K.ink(c, poly([[3, 30], [32, 82]], false), 15, col); K.shape(c, K.circle(0, -52, 20), col, 7); c.restore(); };
I.arrow = (c, x, y, s = 1, o = {}) => { const { col = o.dir === 'down' ? C.red : C.gold, dir = 'up' } = o, d = dir === 'down' ? 1 : -1;
  K.arrow(c, x, y - d * 52 * s, x, y + d * 52 * s, { col, lw: 18 * s, head: 44 * s }); };
I.coin = (c, x, y, s = 1, o = {}) => { const { col = C.gold } = o; c.save(); c.translate(x, y); c.scale(s, s); K.shape(c, K.circle(0, 0, 54), col, 8);
  K.ink(c, K.circle(0, 0, 32), 7); c.restore(); };
K.icon = (c, name, x, y, s = 1, o = {}) => { if (!I[name]) throw new Error('K.icon: 没有这个图标 ' + name + '（有 ' + Object.keys(I).join('/') + '）'); I[name](c, x, y, s, o); };

// ---------- 齿轮（贯穿物） ----------
const gearPath = (ro, ri, n, rot) => { const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, w = TAU / n; [[-.3, ri], [-.2, ro], [.2, ro], [.3, ri]].forEach(([o, r]) => p.push([Math.cos(a + o * w * 1.6) * r, Math.sin(a + o * w * 1.6) * r])); } return poly(p); };
// K.gear(c,x,y,r,{rot=t*.35, teeth=12, lit=1, spokes=6, label, size, hub=red, fill, minis:[{a,r,teeth,label,fill}], alpha, lw=9})
// lit<1：只画炭线轮廓（未完成的草图），lit→1 填色点亮；minis 为咬合在大轮外沿的小齿轮（a=方位角弧度，r=半径），按真实齿比反向转
K.gear = (c, x, y, r, o = {}) => { const { rot = K._t * .35, teeth = 12, lit = 1, spokes = 6, label, hub = C.red, fill = '#dc8a3a', alpha = 1, lw = 9, minis = [], size = Math.round(r * .4) } = o;
  const ro = r, ri = r * .81, one = (cx, cy, R, n, rt, fl, L, lbl, ls) => { c.save(); c.translate(cx, cy);
    const gp = gearPath(R, R * .81, n, rt), hole = K.circle(0, 0, R * .64), hb = K.circle(0, 0, R * .29);
    if (L < .98) { c.save(); c.globalAlpha *= 1 - L * .0; c.setLineDash([R * .12, R * .07]); K.ink(c, gp, lw + 2); K.ink(c, hole, 7); c.setLineDash([]); c.restore(); }
    if (L > .02) { c.save(); c.globalAlpha *= L; K.shape(c, gp, fl, lw); K.shape(c, hole, '#b8844a', 7);
      for (let i = 0; i < spokes; i++) { const a = rt + i / spokes * TAU; K.ink(c, poly([[Math.cos(a) * R * .35, Math.sin(a) * R * .35], [Math.cos(a) * R * .62, Math.sin(a) * R * .62]], false), Math.max(10, R * .06)); }
      K.shape(c, hb, hub, 8); c.restore(); }
    if (lbl) K.text(c, lbl, 0, 0, { size: ls, alpha: Math.max(L, .35) }); c.restore(); };
  c.save(); c.globalAlpha *= alpha;
  minis.forEach(m => { const mr = m.r, mn = m.teeth || Math.max(6, Math.round(teeth * mr / r)), pr = (ro + ri) / 2 + (mr + mr * .81) / 2, rt = -rot * teeth / mn + m.a * (1 + teeth / mn) + Math.PI / mn;
    one(x + Math.cos(m.a) * pr, y + Math.sin(m.a) * pr, mr, mn, rt, m.fill || C.stone, lit, m.label, m.size || Math.round(mr * .5)); });
  one(x, y, r, teeth, rot, fill, lit, label, size); c.restore(); };

// ---------- 柱图（石柱，含负值） ----------
// K.bars(c, items, {x,y,w,h, prog=1, fmt, size=64, lsize=52, gap=.28, zero:true})
// items:[{v, label, col?, hi?}]；(x,y,w,h) 是柱区方框（不含数字与标签）：正柱从零线向上、负柱向下(红)，柱端数字在方框外 ≤70px，
// 标签在 y+h+150 一行（过宽自动折两行，或写 \n）。因此方框上下各留 ~80px，标签行下留 ~70px。
K.bars = (c, items, o = {}) => { const { x = 100, y = 520, w = 880, h = 700, prog = 1, fmt = v => String(v), size = 64, lsize = 52, gap = .28 } = o, n = items.length;
  const mx = Math.max(0, ...items.map(i => i.v)), mn = Math.min(0, ...items.map(i => i.v)), span = (mx - mn) || 1, zy = y + h * mx / span, slot = w / n, bw = slot * (1 - gap);
  if (o.zero !== false) K.ink(c, poly([[x - 10, zy], [x + w + 10, zy]], false), 9);
  items.forEach((it, i) => { const pi = clamp(prog * (1 + .35 * (n - 1)) - .35 * i), q = ez(pi); if (q <= 0) return; const cx = x + slot * (i + .5), full = Math.abs(it.v) / span * h, bh = Math.max(14, full) * q, up = it.v >= 0;
    const col = it.col || (up ? C.gold : C.red), x0 = cx - bw / 2, y0 = up ? zy - bh : zy, r = rng(i * 17 + 3), j = () => (r() - .5) * 10;
    const path = smooth([[x0 + j(), y0 + j()], [cx, y0 + j() * .5], [x0 + bw + j(), y0 + j()], [x0 + bw + j(), y0 + bh / 2], [x0 + bw + j(), y0 + bh + j()], [cx, y0 + bh + j() * .5], [x0 + j(), y0 + bh + j()], [x0 + j(), y0 + bh / 2]], true);
    c.save(); K.shape(c, path, col, it.hi ? 11 : 7); c.clip(path); c.strokeStyle = 'rgba(40,22,10,.22)'; c.lineWidth = 5; c.lineCap = 'round';   // 石柱地层刻痕
    for (let k = 1; k < 4; k++) { const yy = y0 + bh * k / 4; c.beginPath(); c.moveTo(x0, yy + j()); c.lineTo(x0 + bw, yy + j()); c.stroke(); }
    c.fillStyle = 'rgba(255,236,200,.22)'; c.fillRect(x0 + 6, y0, bw * .16, bh); c.restore();
    if (pi > .75) { const a = clamp((pi - .75) * 4); K.text(c, fmt(it.v), cx, up ? y0 - 52 : y0 + bh + 52, { size, col: up ? C.chalk : '#ffd9c2', alpha: a, scale: .8 + .2 * a }); }
    const lab = String(it.label ?? ''); if (lab) { c.save(); c.font = `${lsize}px "PuHui-Heavy"`; let ls = lab.split('\n'); if (ls.length === 1 && c.measureText(lab).width > slot * .98) { const m = Math.ceil(lab.length / 2); ls = [lab.slice(0, m), lab.slice(m)]; } c.restore();
      ls.forEach((t, k) => K.text(c, t, cx, y + h + 150 + k * lsize * 1.15, { size: lsize, alpha: clamp(pi * 3), lw: 5 })); } }); };

// ---------- 折线/曲线（炭刻，可描点） ----------
// K.line(c, pts, {prog=1, lw=14, col=gold, segCol:(i)=>色, smooth=true, axes:{x,y,w,h}|false, zero:y, marks:[{i, text, dx=0, dy=-90, hand, col}]})
// pts 为屏幕像素坐标 [[x,y],…]；segCol(i) 给第 i→i+1 段着色（如回撤段红）；marks 在第 i 个原始点处挖凹坑并挂石板标签；返回 {tip:[x,y]} 当前笔尖
K.line = (c, pts, o = {}) => { const { prog = 1, lw = 14, col = C.gold, segCol, marks = [] } = o, sm = o.smooth !== false, N = 12;
  if (o.axes) { const a = o.axes; K.ink(c, poly([[a.x, a.y], [a.x, a.y + a.h], [a.x + a.w, a.y + a.h]], false), 10); }
  if (o.zero != null) { c.save(); c.setLineDash([26, 20]); c.strokeStyle = C.chalk; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(60, o.zero); c.lineTo(W - 60, o.zero); c.stroke(); c.restore(); }
  const r = rng(hash(JSON.stringify(pts.slice(0, 3))) % 997), jp = pts.map(p => [p[0] + (r() - .5) * 5, p[1] + (r() - .5) * 5]), dense = [], seg = [];
  if (sm && jp.length > 2) { for (let i = 0; i < jp.length - 1; i++) { const p0 = jp[Math.max(0, i - 1)], p1 = jp[i], p2 = jp[i + 1], p3 = jp[Math.min(jp.length - 1, i + 2)];
      for (let k = 0; k < N; k++) { const u = k / N, u2 = u * u, u3 = u2 * u; dense.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3))); seg.push(i); } }
    dense.push(jp[jp.length - 1]); seg.push(jp.length - 2); }
  else { for (let i = 0; i < jp.length; i++) { dense.push(jp[i]); seg.push(Math.min(i, jp.length - 2)); } }
  const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const tot = cum[cum.length - 1] || 1, tgt = clamp(prog) * tot, cut = []; let cs = []; let tip = dense[0];
  for (let i = 0; i < dense.length; i++) { if (cum[i] <= tgt) { cut.push(dense[i]); cs.push(seg[i]); tip = dense[i]; } else { const f = (tgt - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); tip = [lerp(dense[i - 1][0], dense[i][0], f), lerp(dense[i - 1][1], dense[i][1], f)]; cut.push(tip); cs.push(seg[i]); break; } }
  if (cut.length < 2 || prog <= 0) return { tip };
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const full = poly(cut, false); c.strokeStyle = pat(c, 'fuzz'); c.lineWidth = lw + 17; c.stroke(full); c.strokeStyle = pat(c, 'ink'); c.lineWidth = lw + 9; c.stroke(full);
  const SC = i => (segCol && segCol(i)) || col; let run = [cut[0]], rc = SC(cs[0]); const flush = () => { if (run.length > 1) { c.strokeStyle = rc; c.lineWidth = lw; c.stroke(poly(run, false)); } };
  for (let i = 1; i < cut.length; i++) { const cc = SC(cs[i - 1]); if (cc !== rc) { flush(); run = [cut[i - 1]]; rc = cc; } run.push(cut[i]); } flush();
  c.restore();
  marks.forEach((m, k) => { const p = jp[m.i], at0 = (() => { let d = 0; for (let i = 0; i < m.i; i++) d += Math.hypot(jp[i + 1][0] - jp[i][0], jp[i + 1][1] - jp[i][1]); return d / tot; })(), at = Math.min(at0, .92); if (clamp(prog) < at) return;
    const q = ez((clamp(prog) - at) / .08); K.shape(c, K.circle(p[0], p[1], 22 * q), m.col || C.chalk, 8);
    if (m.hand) K.hand(c, p[0], p[1], { scale: .8 * q, seed: 40 + k, alpha: .95 });
    if (m.text && q > .3) { const dx = m.dx ?? 0, dy = m.dy ?? -90; K.ink(c, poly([[p[0], p[1] + Math.sign(dy) * 24], [p[0] + dx, p[1] + dy - Math.sign(dy) * ((m.size || 52) * .78 + 2)]], false), 8); K.stone(c, m.text, p[0] + dx, p[1] + dy, { size: m.size || 52, scale: q, col: m.tc }); } });
  return { tip }; };

// ---------- 四象限（岩面十字） ----------
// K.quad(c, {x=130,y=420,w=820,h=980, cols:['增长↓','增长↑'], rows:['通胀↓','通胀↑'], cells:[{label,sub?,icon?,iconOpt?,col?,hi?,hand?} ×4 左上,右上,左下,右下], prog=1, size=60})
// 先画十字(prog 0→.4)，再逐格弹出内容。cells[i].hi 高亮（砂岩半透明＋红框）；轴标签在方框外：列标在上、行标在左(竖排)
K.quad = (c, o = {}) => { const { x = 130, y = 420, w = 820, h = 980, cols = [], rows = [], cells = [], prog = 1, size = 60 } = o, cw = w / 2, ch = h / 2, p = clamp(prog), pc = ez(p / .4);
  cells.forEach((cl, i) => { const cx = x + (i % 2) * cw, cy = y + Math.floor(i / 2) * ch, q = ez((p - .35 - i * .1) / .25); if (q <= 0) return;
    if (cl.hi) { c.save(); c.globalAlpha *= q; K.shape(c, K.rough(cx + 14, cy + 14, cw - 28, ch - 28, 40 + i, 4), 'rgba(240,223,191,.34)', 0); c.restore(); K.ink(c, K.rough(cx + 14, cy + 14, cw - 28, ch - 28, 40 + i, 4), 10, null); c.save(); c.strokeStyle = C.red; c.lineWidth = 8; c.globalAlpha *= q; c.stroke(K.rough(cx + 14, cy + 14, cw - 28, ch - 28, 40 + i, 4)); c.restore(); }
    c.save(); c.translate(cx + cw / 2, cy + ch / 2); c.scale(.7 + .3 * q, .7 + .3 * q); c.globalAlpha *= q;
    const hasSub = !!cl.sub, iy = -ch * (hasSub ? .22 : .16), ly = ch * (hasSub ? .16 : .26);
    if (cl.icon) K.icon(c, cl.icon, 0, iy, Math.min(cw, ch) / 330, cl.iconOpt || {});
    K.text(c, cl.label || '', 0, ly, { size, col: cl.col || C.chalk }); if (hasSub) K.text(c, cl.sub, 0, ly + size * 1.1, { size: 52, col: C.chalk, lw: 5 });
    if (cl.hand) K.hand(c, cw * .32, -ch * .3, { scale: .8, seed: 70 + i }); c.restore(); });
  const fr = K.rough(x, y, w, h, 77, 5); c.save(); c.setLineDash([]); if (pc > 0) { c.beginPath(); const hp = poly([[x - 10, y + ch], [x - 10 + (w + 20) * pc, y + ch + 3]], false), vp = poly([[x + cw, y - 10], [x + cw + 3, y - 10 + (h + 20) * pc]], false); K.ink(c, hp, 14); K.ink(c, vp, 14); } c.restore();
  if (pc > .5) { c.save(); c.globalAlpha *= clamp((pc - .5) * 2); K.ink(c, fr, 8); c.restore(); }
  const la = clamp((p - .2) * 4); cols.forEach((t, i) => K.text(c, t, x + cw * (i + .5), y - 56, { size, alpha: la })); rows.forEach((t, i) => K.text(c, t, x - 56, y + ch * (i + .5), { size, rot: -Math.PI / 2, alpha: la })); };

// ---------- 章节卡 ----------
// 中央主物：大齿轮＋刻在轮心的章号；在 props.js 里改 K.cardCenter 换成本书贯穿物
K.cardCenter = K.cardCenter || ((c, lt, t, n) => { const q = ez(K.at(lt, 0.1, 0.6));
  K.gear(c, 540, 1100, 300 * (.75 + .25 * q), { rot: t * .3, teeth: 14, spokes: 7, lit: q, alpha: q, minis: [{ a: -0.5, r: 110 }, { a: 2.5, r: 85 }], label: '', size: 1 });
  if (lt > 0.25) K.text(c, String(n), 540, 1100, { size: 250, col: C.chalk, scale: MO.slamK((lt - 0.25) / 0.17), lw: 16 }); });
K.chapterCard = (c, lt, t, n, title) => { K.bg(c, t);
  const N = K.CHAPTER_NAMES.length || 12, step = Math.min(72, 900 / Math.max(1, N - 1)), x0 = 540 - step * (N - 1) / 2;
  for (let i = 0; i < N; i++) { const cur = i === n - 1, done = i < n - 1; K.shape(c, K.circle(x0 + i * step, 150, cur ? 24 : 15), cur ? C.red : done ? C.gold : 'rgba(240,223,191,.35)', cur ? 8 : 6); }
  K.text(c, `第 ${n} 章`, 540, 290, { size: 88, col: C.gold, alpha: K.at(lt, 0.15, 0.3) });
  const size = 72, full = [...title], lines = []; c.save(); c.font = `${size}px "PuHui-Heavy"`; const per = Math.floor(820 / c.measureText('国').width);
  title.split(/(?<=[：:])/).forEach(seg => { const ch = [...seg], nl = Math.ceil(ch.length / per), ev = Math.ceil(ch.length / nl); for (let i = 0; i < ch.length; i += ev) lines.push(ch.slice(i, i + ev).join('')); }); c.restore();
  const shown = Math.round(K.at(lt, 0.3, full.length / 18) * full.length), lh = size * 1.28, ty = 470; let used = 0;
  const bw = 880, bh = lines.length * lh + 60, a = K.at(lt, 0.25, 0.3); if (a > 0) { c.save(); c.globalAlpha *= a; K.shape(c, K.slab(540 - bw / 2, ty - lh / 2 - 22, bw, bh, 9, 7), C.stone, 8); c.restore(); }
  lines.forEach((ln, k) => { const part = ln.slice(0, Math.max(0, shown - used)); used += ln.length; if (part) K.text(c, part, 540, ty + k * lh, { size, col: '#2b1a12', lw: 0, align: 'center' }); });
  K.cardCenter(c, lt, t, n); K.finish(c); };
// ---------- 字幕 ----------
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480; c.fillStyle = 'rgba(33,21,13,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 12); c.fill();
  c.fillStyle = C.chalk; c.fillText(text, x, y + 2); c.restore(); };
})();
