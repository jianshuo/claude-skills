// 画风套件 renaissance（配方 huashu-art-motion 06_renaissance「1503 文艺复兴盛期：晕涂 sfumato」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 核心手法「晕涂」：① 场景底整层 blur(1.3px) 后缓存（K.bg）；② 角色/重点物先画进离屏层，再 blur(1.6px) 全不透明＋叠 α0.82 清晰层（K.paint，所有软边道具内部都走它）；
//   ③ K.finish 叠缓存罩层（暗角、黄釉、画布经纬、油彩笔触、龟裂 α0.14）并压暗字幕带 y1380–1560。
// 硬边物不糊：钟表、怀表、碎表盘、证物袋、监控、文字、图表板、纸条、登记簿、钥匙锁都是清晰的精绘件（只带一层软影）。
// 色板：烟灰米白（雾/纸）、暗褐灰（地/树干）、旧金黄（叶/光）、冷灰蓝（背阴）、鞋赭红 #9A4A3A（唯一强调，只给鞋与关键证物）；夜章换暗铜。
// 人不画脸：只出剪影（K.figure/K.crowd）与手（K.hand）。环境层全部确定性（随机走 U.hash / U.rng），字体只用引擎自带 PuHui-Black/Heavy/Bold。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {   // 负半径兜底（backOut 起步会算出负半径，canvas 会抛错）
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__ren) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__ren = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}

// ---------- 色板 ----------
const C = D.C = {
  ash: '#CFC6B0', umber: '#6B6256', gold: '#D8A33E', blue: '#8E9AA3', shoe: '#9A4A3A', dark: '#2A2119', paper: '#E4DCC6', copper: '#7A5A2E',
  blueD: '#4F5A63', goldD: '#9A7428', umberD: '#3A3128', board: '#241C15', sub: '#8A7F6A',
  cream: '#E4DCC6', amber: '#D8A33E', red: '#9A4A3A', ink: '#2A2119', paper2: '#D3C9AF',
};
const HAZE = [226, 216, 186], HAZE_N = [34, 38, 46];
const hex = P.hex, rgb = P.rgb, mixc = (a, b, t, al = 1) => rgb(P.mix(hex(a), hex(b), t), al);

// ---------- 进度 / 缓存 / 相机 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
D.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
D.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
D.SAFE = { top: 200, bot: 1350, sub: 1480 };   // 主体区 y200–1350；字幕带 1380–1560
D.FIXED_TIME = [3, 47];                          // 全书「固定钟点」（钟表道具缺省指针）。书的 props.js 里可改：K.FIXED_TIME = [h, m]

// 平滑闭合曲线（经过各点中点的二次曲线）
const smooth = (g, pts, close = true) => { const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let q = m(pts[n - 1], pts[0]); g.moveTo(q[0], q[1]);
  for (let i = 0; i < n; i++) { q = m(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } if (close) g.closePath(); };
const sink = (g, x, y, rx, ry, a = 0.5, col = '8,4,0') => { g.save(); g.translate(x, y); g.scale(1, ry / rx); const s = g.createRadialGradient(0, 0, 1, 0, 0, rx); s.addColorStop(0, `rgba(${col},${a})`); s.addColorStop(1, `rgba(${col},0)`); g.fillStyle = s; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); };

// ---------- 晕涂：离屏层 blur1.6 + α0.82 清晰层 ----------
// K.paint(c, bbox[x,y,w,h](当前坐标系下), fn(g), {key, blur, alpha})：fn 在离屏层里按当前变换画，随后 blur＋清晰层 α0.82 叠回。只处理 bbox 范围。
//   传 key（字符串，凡影响画面的参数都要写进 key）时：第一次用真 blur(1.6px) 烤成精灵缓存，之后每帧只 drawImage（不再重画重糊）。
//   不传 key 时（会动的东西）每帧走「半尺寸缩放再放大」近似柔化（比 filter:blur 快 3–4 倍），K.SOFT='filter' 可改回真 blur。
let LAY = null, LG = null, SM = null, SG = null, inPaint = false, PK = null;   // PK：下一次 K.paint 的缓存 key（调用点先设后画）
D.SOFT = 'down';
D.paint = (c, bb, fn, o = {}) => {
  const key = o.key || PK; PK = null; if (inPaint) return fn(c);
  const pad = 12;
  if (key) { let e = D.cache['pt_' + key];
    if (!e) { const cw = Math.ceil(bb[2] + pad * 2), ch = Math.ceil(bb[3] + pad * 2), tmp = P.canvas(cw, ch), tg = tmp.getContext('2d'), cv = P.canvas(cw, ch), cg = cv.getContext('2d');
      tg.translate(pad - bb[0], pad - bb[1]); inPaint = true; try { fn(tg); } finally { inPaint = false; }
      cg.filter = `blur(${o.blur ?? 1.6}px)`; cg.drawImage(tmp, 0, 0); cg.filter = 'none'; cg.globalAlpha = o.alpha ?? 0.82; cg.drawImage(tmp, 0, 0); e = D.cache['pt_' + key] = cv; }
    c.drawImage(e, bb[0] - pad, bb[1] - pad); return; }
  if (!LAY) { LAY = P.canvas(W, H); LG = LAY.getContext('2d'); }
  const m = c.getTransform(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const X of [bb[0] - pad, bb[0] + bb[2] + pad]) for (const Y of [bb[1] - pad, bb[1] + bb[3] + pad]) { const px = m.a * X + m.c * Y + m.e, py = m.b * X + m.d * Y + m.f; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1)); const w = x1 - x0, h = y1 - y0; if (w <= 2 || h <= 2) return;
  LG.save(); LG.setTransform(1, 0, 0, 1, 0, 0); LG.clearRect(x0, y0, w, h); LG.beginPath(); LG.rect(x0, y0, w, h); LG.clip(); LG.setTransform(m);
  inPaint = true; try { fn(LG); } finally { inPaint = false; LG.restore(); }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (D.SOFT === 'filter') { c.filter = `blur(${o.blur ?? 1.6}px)`; c.drawImage(LAY, x0, y0, w, h, x0, y0, w, h); c.filter = 'none'; }
  else { if (!SM) { SM = P.canvas(W, H); SG = SM.getContext('2d'); } const sw = Math.ceil(w / 2), sh = Math.ceil(h / 2); SG.clearRect(0, 0, sw, sh); SG.imageSmoothingEnabled = true; SG.drawImage(LAY, x0, y0, w, h, 0, 0, sw, sh); c.imageSmoothingEnabled = true; c.drawImage(SM, 0, 0, sw, sh, x0, y0, w, h); }
  c.globalAlpha *= o.alpha ?? 0.82; c.drawImage(LAY, x0, y0, w, h, x0, y0, w, h); c.restore(); };
// 整层 blur 后缓存
const softCache = (key, fn, blur = 1.3) => P.cached(key, W, H, g => { const t = P.canvas(W, H); fn(t.getContext('2d')); g.filter = `blur(${blur}px)`; g.drawImage(t, 0, 0); g.filter = 'none'; });

// ---------- 梧桐叶 / 树干（静态底和前景树共用） ----------
const leafPath = (g, s, rot, r) => {   // 梧桐叶：五裂掌状，裂片长短、角度、宽窄随机（圆角裂片，不是星形模板）
  const pts = []; for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5 + (r() - 0.5) * 0.3, L = s * (i === 0 ? 1.08 : 0.74 + r() * 0.3), wd = 0.2 + r() * 0.1, nr = s * (0.5 + r() * 0.14);
    pts.push([Math.cos(a - TAU / 10) * nr, Math.sin(a - TAU / 10) * nr], [Math.cos(a - wd) * L * 0.8, Math.sin(a - wd) * L * 0.8], [Math.cos(a) * L, Math.sin(a) * L], [Math.cos(a + wd) * L * 0.8, Math.sin(a + wd) * L * 0.8]); }
  g.beginPath(); smooth(g, pts); };
const drawLeaf = (g, s, rot, col, frost, r) => {   // 一片带脉、带霜的叶（原点为叶心）
  g.fillStyle = 'rgba(15,8,3,.3)'; g.save(); g.translate(s * 0.07, s * 0.12); leafPath(g, s * 1.04, rot, U.rng(Math.floor(r() * 1e6))); g.fill(); g.restore();
  const seed = Math.floor(r() * 1e6); g.fillStyle = col; leafPath(g, s, rot, U.rng(seed)); g.fill();
  g.strokeStyle = 'rgba(40,24,8,.4)'; g.lineWidth = Math.max(0.8, s * 0.035); g.beginPath(); for (let j = 0; j < 5; j++) { g.moveTo(0, 0); g.lineTo(Math.cos(rot + j * 1.2566) * s * 0.8, Math.sin(rot + j * 1.2566) * s * 0.8); } g.stroke();
  if (frost) { g.strokeStyle = `rgba(238,244,244,${0.5 * frost})`; g.lineWidth = Math.max(1, s * 0.07); leafPath(g, s, rot, U.rng(seed)); g.stroke();
    g.fillStyle = `rgba(238,244,244,${0.3 * frost})`; for (let j = 0; j < 7; j++) { g.beginPath(); g.arc((r() - 0.5) * s * 0.9, (r() - 0.5) * s * 0.9, s * (0.04 + r() * 0.08), 0, TAU); g.fill(); } } };
const LEAF_COLS = [[186, 134, 52], [150, 96, 38], [112, 78, 36], [196, 150, 62], [168, 120, 44]];
const trunkShape = (g, bx, by, w, top, seedN, r) => {   // 微锥、边缘带噪声的树干路径
  const n = 18, L = [], R = []; for (let i = 0; i <= n; i++) { const f = i / n, y = lerp(top, by, f), ww = w * (0.86 + 0.18 * f) * 0.5, nz = P.fbm(f * 5 + seedN, seedN * 1.7, 3); L.push([bx - ww * (1 + 0.1 * nz), y]); R.push([bx + ww * (1 + 0.1 * P.fbm(f * 5 + seedN + 9, seedN, 3)), y]); }
  g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); R.reverse().forEach(p => g.lineTo(p[0], p[1])); g.closePath(); };
// col(hex)→css 色（静态街用 hz 加空气透视；前景树直接用本色）
const drawTrunk = (g, bx, by, w, top, side, seedN, col, r) => {
  trunkShape(g, bx, by, w, top, seedN, r);
  const grd = g.createLinearGradient(bx - w / 2, 0, bx + w / 2, 0), dk = col('#1c140d'), md = col('#4a3e2e'), lt = col('#a89e80');
  if (side > 0) { grd.addColorStop(0, dk); grd.addColorStop(0.55, md); grd.addColorStop(1, lt); } else { grd.addColorStop(0, lt); grd.addColorStop(0.45, md); grd.addColorStop(1, dk); }
  g.fillStyle = grd; g.fill(); g.save(); trunkShape(g, bx, by, w, top, seedN, r); g.clip();
  const span = by - top, n = Math.floor(w * span / 5200 + 8);
  for (let k = 0; k < n; k++) {   // 斑驳剥落：不规则多边形块，大小/朝向/色都不同
    const yy = by - r() * span, xx = bx + (r() - 0.5) * w, rx = w * (0.04 + r() * 0.16), ry = rx * (0.9 + r() * 3.2), rot = (r() - 0.5) * 0.5, nv = 5 + Math.floor(r() * 4), cr = r();
    g.fillStyle = cr < 0.38 ? col('#b5ad8a') : cr < 0.62 ? col('#6d7048') : cr < 0.8 ? col('#8d8668') : col('#3c2f22'); g.globalAlpha = 0.18 + r() * 0.22; g.beginPath();
    for (let i = 0; i < nv; i++) { const a = i / nv * TAU, k2 = 0.6 + r() * 0.55, px = Math.cos(a) * rx * k2, py = Math.sin(a) * ry * k2; const X = xx + px * Math.cos(rot) - py * Math.sin(rot), Y = yy + px * Math.sin(rot) + py * Math.cos(rot); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.closePath(); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = col('#2a2016'); g.lineWidth = Math.max(1, w * 0.012); g.globalAlpha = 0.4;
  for (let k = 0; k < Math.floor(w / 9) + 2; k++) { let x = bx + (r() - 0.5) * w * 0.9, y = by - r() * span; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * w * 0.08; y -= 20 + r() * w * 0.6; g.lineTo(x, y); } g.stroke(); }
  g.restore(); g.globalAlpha = 1; };

// ---------- 底：街 / 室内 / 窗框 / 夜 / 暗 / 冷色（停尸间） ----------
const VX = 540, VY = 690, F = 900, STCAM = 1.6;   // 街的透视：x=VX+F·X/Z  y=VY+F·(STCAM−Y)/Z
const pj = (X, Z, Y = 0) => [VX + F * X / Z, VY + F * (STCAM - Y) / Z];
const quad = pts => D.poly(pts);
const WIN_LIT = [];   // 夜景里要补亮的橱窗（街painter写入）
function streetPaint(g, night) {
  const r = U.rng(11), HZ = night ? HAZE_N : HAZE, hz = (h, z) => rgb(P.mix(hex(h), HZ, clamp((z - 5) / 40) * 0.85)); WIN_LIT.length = 0;
  const sky = g.createRadialGradient(VX, VY - 60, 20, VX, VY - 60, 1100);
  if (night) { sky.addColorStop(0, '#5a5448'); sky.addColorStop(0.2, '#3a3d40'); sky.addColorStop(0.55, '#262a30'); sky.addColorStop(1, '#101216'); }
  else { sky.addColorStop(0, '#f3ecd0'); sky.addColorStop(0.2, '#cfc9a8'); sky.addColorStop(0.55, '#7f8a7e'); sky.addColorStop(1, '#2c2c22'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {   // 远景老洋房
    const z = 45 - k * 3.6, x0 = side * 3.0, a = pj(x0, z, 0), b = pj(x0, z - 3.2, 0), ht = 4 + r() * 3, ta = pj(x0, z, ht), tb = pj(x0, z - 3.2, ht);
    g.fillStyle = hz(k % 2 ? '#8a7a66' : '#756b5c', z + 6); g.fill(quad([a, b, tb, ta]));
    g.fillStyle = hz('#3f362c', z + 6); g.fillRect(Math.min(a[0], b[0]) + 3, ta[1] + (a[1] - ta[1]) * 0.35, Math.abs(a[0] - b[0]) * 0.3, (a[1] - ta[1]) * 0.2); }
  const gnd = g.createLinearGradient(0, VY, 0, H); gnd.addColorStop(0, night ? '#4a463c' : '#d6cfb4'); gnd.addColorStop(0.18, night ? '#2e2c28' : '#9c9482'); gnd.addColorStop(0.55, night ? '#1c1a17' : '#5e5546'); gnd.addColorStop(1, '#140e09');
  g.fillStyle = gnd; g.fillRect(0, VY, W, H - VY);
  g.fillStyle = night ? 'rgba(30,40,48,.6)' : 'rgba(70,82,84,.55)'; g.fill(quad([pj(-2.3, 60), pj(-9, 60), [-1400, H], [VX + F * -2.3 / 1.15, H]]));   // 马路（偏冷）
  g.fillStyle = 'rgba(230,226,205,.5)'; g.fill(quad([pj(-2.3, 60), pj(-2.15, 60), [VX + F * -2.15 / 1.15, H], [VX + F * -2.3 / 1.15, H]]));   // 路缘石
  g.lineWidth = 2;
  for (let z = 1.3; z < 45; z *= 1.075) { const a = pj(-2.15, z), b = pj(2.6, z); g.strokeStyle = `rgba(30,22,14,${0.34 * (1 - clamp(z / 45))})`; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  for (let x = -2; x <= 2.6; x += 0.5) { g.strokeStyle = 'rgba(30,22,14,.22)'; g.beginPath(); g.moveTo(...pj(x, 1.15)); g.lineTo(...pj(x, 45)); g.stroke(); }
  // 右侧：一排沿街小铺（上海线索：雨篷、橱窗、门楣招牌板、铁门）
  g.fillStyle = hz('#6b5a46', 6); g.fill(quad([pj(2.9, 1.1, 0), pj(2.9, 45, 0), pj(2.9, 45, 3.2), pj(2.9, 1.1, 3.2)]));
  const WALL = ['#6f7780', '#8a7350', '#6c7566', '#7a6a58'], AWN = [['#8E9AA3', '#CFC6B0'], ['#9A4A3A', '#CFC6B0'], ['#6B6256', '#D8A33E'], ['#4F5A63', '#CFC6B0']];
  for (let k = 0; k < 9; k++) {
    const z0 = 4.6 + k * 3.7, z1 = z0 + 3.4, wc = WALL[k % 4], lit = r() < 0.55, aw = AWN[(k + 1) % 4];
    g.fillStyle = hz(wc, z0); g.fill(quad([pj(2.9, z0, 0), pj(2.9, z1, 0), pj(2.9, z1, 3.2), pj(2.9, z0, 3.2)]));
    const wz0 = z0 + 0.35, wz1 = z1 - 1.0, wq = [pj(2.9, wz0, 0.45), pj(2.9, wz1, 0.45), pj(2.9, wz1, 2.1), pj(2.9, wz0, 2.1)];
    g.fillStyle = hz(lit ? '#e0b45a' : '#3c3a34', z0); g.fill(quad(wq)); if (lit) WIN_LIT.push(wq);
    g.strokeStyle = hz('#2a2118', z0); g.lineWidth = Math.max(1.5, 14 / z0); g.stroke(quad(wq)); const mz = (wz0 + wz1) / 2; g.beginPath(); g.moveTo(...pj(2.9, mz, 0.45)); g.lineTo(...pj(2.9, mz, 2.1)); g.stroke();
    g.fillStyle = hz('#241c14', z0); g.fill(quad([pj(2.9, z1 - 0.8, 0), pj(2.9, z1 - 0.25, 0), pj(2.9, z1 - 0.25, 2.1), pj(2.9, z1 - 0.8, 2.1)]));   // 店门
    const NS = 6; for (let s = 0; s < NS; s++) { const za = lerp(z0 + 0.1, z1 - 0.1, s / NS), zb = lerp(z0 + 0.1, z1 - 0.1, (s + 1) / NS);   // 条纹雨篷（向街外探出）
      g.fillStyle = hz(aw[s % 2], z0); g.fill(quad([pj(2.9, za, 2.75), pj(2.9, zb, 2.75), pj(2.5, zb, 2.2), pj(2.5, za, 2.2)])); }
    g.fillStyle = hz('#2a2118', z0); g.fill(quad([pj(2.9, z0 + 0.2, 2.85), pj(2.9, z1 - 0.2, 2.85), pj(2.9, z1 - 0.2, 3.15), pj(2.9, z0 + 0.2, 3.15)]));   // 招牌板
    g.strokeStyle = hz('#D8A33E', z0); g.lineWidth = Math.max(1, 6 / z0); g.beginPath(); g.moveTo(...pj(2.9, z0 + 0.3, 3.0)); g.lineTo(...pj(2.9, z1 - 0.3, 3.0)); g.stroke(); }
  // 左侧：铁艺栏杆＋矮冬青
  g.strokeStyle = hz('#1c1812', 6); for (let z = 2.2; z < 30; z += 0.38 + z * 0.014) { const a = pj(-2.55, z, 0), b = pj(-2.55, z, 1.0); g.lineWidth = Math.max(1, 7 / z); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  g.lineWidth = 3; g.beginPath(); g.moveTo(...pj(-2.55, 2.2, 1.0)); g.lineTo(...pj(-2.55, 30, 1.0)); g.stroke(); g.beginPath(); g.moveTo(...pj(-2.55, 2.2, 0.2)); g.lineTo(...pj(-2.55, 30, 0.2)); g.stroke();
  for (let z = 6; z < 34; z += 2.8) { const [hx, hy] = pj(-2.8, z, 0.7), s = F * 1.1 / z; const hg = g.createRadialGradient(hx, hy, 0, hx, hy, s); hg.addColorStop(0, hz('#4f5a3c', z)); hg.addColorStop(1, rgb(P.mix(hex('#4f5a3c'), HZ, 0.6), 0)); g.fillStyle = hg; g.fillRect(hx - s, hy - s, s * 2, s * 2); }
  const pool = g.createRadialGradient(VX + 40, 1030, 20, VX + 40, 1030, 620); pool.addColorStop(0, night ? 'rgba(216,163,62,.22)' : 'rgba(255,238,190,.34)'); pool.addColorStop(1, 'rgba(255,238,190,0)'); g.fillStyle = pool; g.fillRect(0, 700, W, 1000);
  for (let k = 0; k < 5200; k++) {   // 地面霜：近处更密更大，偏冷白
    const z = 1.3 + Math.pow(r(), 1.7) * 30, X = -2.1 + r() * 4.6, [x, y] = pj(X, z), s = Math.max(0.8, 9 / z); g.fillStyle = `rgba(238,244,244,${(0.16 + r() * 0.36) * (night ? 0.6 : 1)})`; g.fillRect(x, y, s * (1 + r() * 2.4), s * 0.7); }
  const trees = []; for (let z = 34, i = 0; z > 3; z *= 0.74, i++) trees.push([-1.95 + (r() - 0.5) * 0.2, z], [2.0 + (r() - 0.5) * 0.2, z + 1.5]);
  trees.sort((a, b) => b[1] - a[1]);
  for (const [X, z] of trees) {
    const [bx, by] = pj(X, z), w = F * 0.36 / z, top = Math.min(pj(X, z, 9)[1], -50), col = h => hz(h, z);
    drawTrunk(g, bx, by, w, top, X < 0 ? 1 : -1, z * 0.37 + X, col, r);
    sink(g, bx, by + 4, w * 1.6, w * 0.35, 0.5, '20,12,6');
    if (z > 7) for (let k = 0; k < 46; k++) { const a = r() * TAU, rr = Math.sqrt(r()) * 2.9, [cx, cy] = pj(X + Math.cos(a) * rr - X * 0.25, z, 8.6 + Math.sin(a) * rr * 0.5), s = F * (0.5 + r() * 0.7) / z, cg = g.createRadialGradient(cx, cy, 0, cx, cy, s);
      const cc = LEAF_COLS[Math.floor(r() * 5)], mc = night ? [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5] : cc; cg.addColorStop(0, rgb(P.mix(mc, HZ, clamp((z - 3) / 38) * 0.8), 0.55)); cg.addColorStop(1, rgb(mc, 0)); g.fillStyle = cg; g.fillRect(cx - s, cy - s, s * 2, s * 2); } }
  const arr = []; for (let k = 0; k < 360; k++) { const z = 1.5 + Math.pow(r(), 1.9) * 26, X = -2.1 + r() * 4.5; if (z < 3.9 && Math.abs(X - 0.05) < 0.62 && r() < 0.8) continue; arr.push([z, X, r() * TAU, r()]); }
  arr.sort((a, b) => b[0] - a[0]);
  for (const [z, X, rot, q] of arr) { const [x, y] = pj(X, z), s = Math.min(F * 0.12 / z, 52), cc = LEAF_COLS[Math.floor(q * 5) % 5]; g.save(); g.translate(x, y); g.scale(1, 0.4);
    drawLeaf(g, s, rot, rgb(P.mix(night ? cc.map(v => v * 0.55) : cc, HZ, clamp((z - 3) / 38) * 0.75)), 0.9 - clamp(z / 30) * 0.5, r); g.restore(); }
  const fog = g.createLinearGradient(0, VY - 420, 0, VY + 260); fog.addColorStop(0, rgb(HZ, 0)); fog.addColorStop(0.5, rgb(HZ, night ? 0.3 : 0.38)); fog.addColorStop(1, rgb(HZ, 0)); g.fillStyle = fog; g.fillRect(0, VY - 420, W, 680);
  if (night) {
    g.fillStyle = 'rgba(14,18,26,.4)'; g.fillRect(0, 0, W, H);
    for (const q of WIN_LIT) { const gl = g.createLinearGradient(0, q[3][1], 0, q[0][1]); gl.addColorStop(0, 'rgba(236,190,100,.95)'); gl.addColorStop(1, 'rgba(160,110,50,.9)'); g.fillStyle = gl; g.fill(quad(q)); }
    for (const [X, z] of [[-2.2, 6], [2.3, 11], [-2.2, 17], [2.3, 24], [-2.2, 32]]) { const [lx, ly] = pj(X, z, 4.3), [fx, fy] = pj(X, z, 0); g.strokeStyle = '#0c0a08'; g.lineWidth = Math.max(2, 22 / z); g.beginPath(); g.moveTo(fx, fy); g.lineTo(lx, ly); g.stroke();
      const s = F * 2.6 / z; g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(lx, ly, 0, lx, ly, s); lg.addColorStop(0, 'rgba(216,160,80,.85)'); lg.addColorStop(0.15, 'rgba(160,110,50,.4)'); lg.addColorStop(1, 'rgba(120,80,30,0)'); g.fillStyle = lg; g.fillRect(lx - s, ly - s, s * 2, s * 2);
      const fg = g.createRadialGradient(lx, fy + 6, 0, lx, fy + 6, s * 0.9); fg.addColorStop(0, 'rgba(216,160,80,.28)'); fg.addColorStop(1, 'rgba(216,160,80,0)'); g.fillStyle = fg; g.fillRect(lx - s, fy - s * 0.3, s * 2, s * 0.9); g.restore(); } }
}
const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
function roomPaint(g) {
  const wl = g.createLinearGradient(0, 0, 0, 1250); wl.addColorStop(0, '#2c241c'); wl.addColorStop(0.35, '#6B6256'); wl.addColorStop(1, '#8c8168'); g.fillStyle = wl; g.fillRect(0, 0, W, 1250);
  for (let k = 0; k < 40; k++) { const x = U.hash(k, 3) * W, y = U.hash(k, 4) * 1100; sink(g, x, y, 120 + U.hash(k, 5) * 220, 90 + U.hash(k, 6) * 120, 0.05 + U.hash(k, 7) * 0.05, '20,14,8'); }   // 墙面斑驳
  rect(g, 0, 880, W, 380, '#5a5143'); rect(g, 0, 868, W, 16, '#a39a82'); rect(g, 0, 884, W, 6, 'rgba(0,0,0,.35)');   // 护墙板
  g.strokeStyle = 'rgba(20,14,8,.4)'; g.lineWidth = 4; for (let x = 100; x < W; x += 260) g.strokeRect(x, 930, 200, 250);
  rect(g, 0, 1230, W, 40, '#2a2119'); rect(g, 0, 1226, W, 6, '#8c8168');   // 踢脚线
  const fl = g.createLinearGradient(0, 1270, 0, H); fl.addColorStop(0, '#4a3a2a'); fl.addColorStop(1, '#17100a'); g.fillStyle = fl; g.fillRect(0, 1270, W, H - 1270);
  g.strokeStyle = 'rgba(10,6,2,.55)'; g.lineWidth = 3; for (let k = 0; k < 8; k++) { const y = 1270 + Math.pow(k, 1.9) * 12; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let k = -8; k <= 8; k++) { g.beginPath(); g.moveTo(540 + k * 40, 1270); g.lineTo(540 + k * 160, H); g.stroke(); }
}
function windowPaint(g) {   // 框景：暗屋里一整扇窗，窗外黄雾
  const wl = g.createLinearGradient(0, 0, 0, H); wl.addColorStop(0, '#1b150f'); wl.addColorStop(1, '#2a2119'); g.fillStyle = wl; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 30; k++) sink(g, U.hash(k, 3) * W, U.hash(k, 4) * H, 160 + U.hash(k, 5) * 200, 120 + U.hash(k, 6) * 160, 0.12, '60,44,28');
  const wx = 150, wy = 250, ww = 780, wh = 960; g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  const fg = g.createLinearGradient(0, wy, 0, wy + wh); fg.addColorStop(0, '#e9d9a0'); fg.addColorStop(0.5, '#d8b866'); fg.addColorStop(1, '#8c7a50'); g.fillStyle = fg; g.fillRect(wx, wy, ww, wh);
  const sun = g.createRadialGradient(wx + ww * 0.55, wy + wh * 0.45, 10, wx + ww * 0.55, wy + wh * 0.45, 520); sun.addColorStop(0, 'rgba(255,244,200,.9)'); sun.addColorStop(1, 'rgba(255,244,200,0)'); g.fillStyle = sun; g.fillRect(wx, wy, ww, wh);
  const r = U.rng(5); for (let i = 0; i < 9; i++) { const z = 1 + i * 0.7, tx = wx + ww * (0.12 + ((i * 0.39) % 0.8)), tw = 80 / z, a = clamp(1 - i / 9.5); g.fillStyle = mixc('#3a3128', '#d8c88a', clamp(i / 10), 0.5 + a * 0.5); g.fillRect(tx - tw / 2, wy + wh * (0.12 + i * 0.02), tw, wh); }
  for (let k = 0; k < 24; k++) { const x = wx + r() * ww, y = wy + wh * (0.2 + r() * 0.6); g.save(); g.translate(x, y); drawLeaf(g, 14 + r() * 18, r() * TAU, rgb(LEAF_COLS[Math.floor(r() * 5)], 0.6), 0.4, r); g.restore(); }
  g.restore();
  g.fillStyle = '#d3c9ad'; g.fillRect(wx - 30, wy - 30, ww + 60, 30); g.fillRect(wx - 30, wy + wh, ww + 60, 30); g.fillRect(wx - 30, wy, 30, wh); g.fillRect(wx + ww, wy, 30, wh);   // 窗框（受光）
  g.fillStyle = '#b9ae92'; g.fillRect(wx + ww / 2 - 12, wy, 24, wh); g.fillRect(wx, wy + wh * 0.34, ww, 22); g.fillRect(wx, wy + wh * 0.68, ww, 22);
  g.fillStyle = 'rgba(30,20,10,.3)'; g.fillRect(wx + ww / 2 + 12, wy, 8, wh); g.fillRect(wx, wy + wh * 0.34 + 22, ww, 8);
  g.fillStyle = '#8c8168'; g.fillRect(wx - 70, wy + wh + 30, ww + 140, 36); g.fillStyle = '#2a2119'; g.fillRect(wx - 70, wy + wh + 66, ww + 140, 10);
  for (const s of [-1, 1]) { const cx = s < 0 ? 0 : W; for (let k = 0; k < 6; k++) { const px = cx - s * k * 28; const cg = g.createLinearGradient(px, 0, px - s * 40, 0); cg.addColorStop(0, '#2a2119'); cg.addColorStop(1, '#43372a'); g.fillStyle = cg; g.fillRect(Math.min(px, px - s * 40), 0, 40, H); } }
  sink(g, 540, 1340, 520, 80, 0.55, '0,0,0');
  const fl = g.createLinearGradient(0, 1290, 0, H); fl.addColorStop(0, '#3b2d1e'); fl.addColorStop(1, '#120c07'); g.fillStyle = fl; g.fillRect(0, 1290, W, H - 1290);
  g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(216,163,62,.18)'; g.beginPath(); g.moveTo(wx, wy + wh + 30); g.lineTo(wx + ww, wy + wh + 30); g.lineTo(W - 20, H); g.lineTo(20, H); g.closePath(); g.fill(); g.restore();
}
function nightRoomPaint(g) { roomPaint(g); g.fillStyle = 'rgba(14,18,26,.58)'; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(540, 700, 0, 540, 700, 800); lg.addColorStop(0, 'rgba(190,130,60,.55)'); lg.addColorStop(0.4, 'rgba(122,90,46,.22)'); lg.addColorStop(1, 'rgba(122,90,46,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H); g.restore(); }
function darkPaint(g) { const b = g.createRadialGradient(540, 760, 80, 540, 900, 1250); b.addColorStop(0, '#3a2f24'); b.addColorStop(0.6, '#241c15'); b.addColorStop(1, '#120d08'); g.fillStyle = b; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 24; k++) sink(g, U.hash(k, 3) * W, U.hash(k, 4) * H, 140 + U.hash(k, 5) * 200, 100 + U.hash(k, 6) * 120, 0.08, '70,54,34'); }
function morguePaint(g) {   // 冷色：灰蓝瓷砖墙、不锈钢柜、冷荧光
  const wl = g.createLinearGradient(0, 0, 0, 1180); wl.addColorStop(0, '#2a3036'); wl.addColorStop(0.3, '#5d6a72'); wl.addColorStop(1, '#8E9AA3'); g.fillStyle = wl; g.fillRect(0, 0, W, 1180);
  g.strokeStyle = 'rgba(20,28,34,.45)'; g.lineWidth = 3; for (let x = 0; x <= W; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1180); g.stroke(); } for (let y = 0; y <= 1180; y += 90) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 14; j++) { if (U.hash(i * 14 + j, 8) > 0.3) continue; g.fillStyle = `rgba(210,222,228,${0.05 + U.hash(i * 14 + j, 9) * 0.07})`; g.fillRect(i * 90 + 3, j * 90 + 3, 84, 84); }
  for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { const x = 90 + k * 250, y = 380 + r * 250; g.fillStyle = '#a9b4ba'; g.fillRect(x, y, 230, 230); const sg = g.createLinearGradient(x, y, x + 230, y + 230); sg.addColorStop(0, 'rgba(255,255,255,.35)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(20,30,36,.4)'); g.fillStyle = sg; g.fillRect(x, y, 230, 230);
    g.strokeStyle = '#3a454c'; g.lineWidth = 6; g.strokeRect(x, y, 230, 230); g.fillStyle = '#2f3a41'; g.fillRect(x + 75, y + 100, 80, 14); }
  const fl = g.createLinearGradient(0, 1180, 0, H); fl.addColorStop(0, '#6c7880'); fl.addColorStop(0.4, '#3d474e'); fl.addColorStop(1, '#161b1f'); g.fillStyle = fl; g.fillRect(0, 1180, W, H - 1180);
  g.strokeStyle = 'rgba(10,16,20,.5)'; g.lineWidth = 3; for (let k = 0; k < 7; k++) { const y = 1180 + Math.pow(k, 1.8) * 16; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let k = -9; k <= 9; k++) { g.beginPath(); g.moveTo(540 + k * 40, 1180); g.lineTo(540 + k * 180, H); g.stroke(); }
  g.fillStyle = 'rgba(10,16,20,.55)'; g.fillRect(0, 0, W, 90); g.fillStyle = '#e8f0f2'; g.fillRect(250, 36, 580, 26);   // 荧光灯管
}
const PAINTERS = { street: g => streetPaint(g, false), night: g => streetPaint(g, true), room: roomPaint, window: windowPaint, nightroom: nightRoomPaint, dark: darkPaint, morgue: morguePaint };
D.WIN = { x: 150, y: 250, w: 780, h: 960 };   // kind:'window' 的窗洞（人物/物件可以对着它摆）

// 动态层精灵（缓存）：光柱、窗格光斑
const shaftSprite = () => P.cached('ren_shaft', W, 1000, g => { g.filter = 'blur(40px)'; g.fillStyle = 'rgba(255,226,160,.5)'; g.beginPath(); g.moveTo(140, 940); g.lineTo(280, 60); g.lineTo(560, 60); g.lineTo(220, 1040); g.closePath(); g.fill(); });
const sashSprite = () => P.cached('ren_sash', 900, 1300, g => { g.filter = 'blur(10px)'; g.fillStyle = 'rgba(255,214,140,.55)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const x = 100 + i * 340, y = 100 + j * 360; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 300, y + 20); g.lineTo(x + 380, y + 330); g.lineTo(x + 60, y + 330); g.closePath(); g.fill(); } });
// K.bg(c,t,o)：o { kind 'street'(默认)|'room'|'window'|'night'|'nightroom'|'dark'|'morgue', warm 0..1 黄雾占画面（末章温暖），shaft false 关光柱/窗光, dust false 关浮尘, leaf false 关飘叶, drift 光柱缓移幅度 }
D.bg = (c, t, o = {}) => {
  const kind = PAINTERS[o.kind] ? o.kind : 'street', S = softCache('ren_bg_' + kind, PAINTERS[kind]); c.drawImage(S, 0, 0);
  const warm = o.warm || 0, dx = (o.drift ?? 50) * Math.sin(t * 0.25 + (o.phase || 0));
  if (o.shaft !== false) {
    if (kind === 'street') { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = (0.5 + 0.12 * Math.sin(t * 0.8)) * (1 + warm * 0.8); c.drawImage(shaftSprite(), 430 + dx * 0.4, -20, 1080 * 0.9, 1000 * 0.9); c.restore(); }
    if (kind === 'room' || kind === 'window') { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.42 + 0.08 * Math.sin(t * 0.7); c.drawImage(sashSprite(), 130 + dx, 700, 900, 1300 * 0.75); c.restore(); }
    if (kind === 'morgue') { c.fillStyle = `rgba(200,225,235,${0.04 + 0.035 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1))})`; c.fillRect(0, 0, W, 1180); }
    if (kind === 'night' || kind === 'nightroom') { c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = `rgba(160,110,50,${0.03 + 0.02 * Math.sin(t * 3.1)})`; c.fillRect(0, 0, W, H); c.restore(); } }
  if (warm > 0) { c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(540, 700, 40, 540, 760, 1300); g.addColorStop(0, `rgba(255,224,150,${0.55 * warm})`); g.addColorStop(1, `rgba(216,163,62,${0.28 * warm})`); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }
  if (o.dust !== false && kind !== 'dark') { const warmDust = kind === 'morgue' ? '210,230,240' : '255,244,214'; for (let k = 0; k < 40; k++) { const x0 = U.hash(k, 1) * W, y0 = 100 + U.hash(k, 2) * 1200, sp = 6 + U.hash(k, 3) * 12, ph = U.hash(k, 4) * TAU, x = x0 + Math.sin(t * 0.5 + ph) * 14, y = ((y0 - t * sp) % 1200 + 1200) % 1200 + 100;
    c.fillStyle = `rgba(${warmDust},${(0.12 + 0.18 * Math.sin(t * 2 + ph)) * 0.8})`; c.beginPath(); c.arc(x, y, 1 + U.hash(k, 5) * 2, 0, TAU); c.fill(); } }
  if (o.leaf !== false && (kind === 'street' || kind === 'window')) D.fall(c, t, { n: 1, x0: 520, x1: 760, seed: 2, speed: 150, y0: 380, y1: 1300 });
};
// 飘落的霜叶：D.fall(c,t,{n,x0,x1,y0,y1,speed,seed,s,loop})  loop false 时只落一次
D.fall = (c, t, o = {}) => { const n = o.n || 3, y0 = o.y0 ?? 200, y1 = o.y1 ?? 1300, sp = o.speed || 120, span = y1 - y0;
  for (let i = 0; i < n; i++) { const ph = U.hash(i, o.seed || 1) * span, q = o.loop === false ? y0 + t * sp + ph * 0 - i * 90 : y0 + ((t * sp + ph) % span); if (q < y0 || q > y1) continue;
    const fx = lerp(o.x0 ?? 100, o.x1 ?? 980, U.hash(i, (o.seed || 1) + 7)) + Math.sin(t * 1.3 + i * 2) * 60; c.save(); c.translate(fx, q); c.rotate(t * 1.2 + i); c.scale(1, 0.55 + 0.4 * Math.abs(Math.sin(t * 1.7 + i)));
    drawLeaf(c, o.s || 34, 0, rgb(LEAF_COLS[i % 5]), 0.8, U.rng(i * 17 + 3)); c.restore(); } };

// 罩层：暗角、黄釉、画布经纬、油彩笔触、龟裂＋亮边（缓存一次）
const overSprite = () => P.cached('ren_over', W, H, g => {
  const vg = g.createRadialGradient(540, 900, 380, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.5, 'rgba(8,4,0,.34)'); vg.addColorStop(1, 'rgba(8,4,0,.86)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(190,140,50,.07)'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(40,24,8,.05)'; g.lineWidth = 1; g.beginPath(); for (let y = 0; y < H; y += 3) { g.moveTo(0, y); g.lineTo(W, y); } for (let x = 0; x < W; x += 3) { g.moveTo(x, 0); g.lineTo(x, H); } g.stroke();
  const r = U.rng(9); g.lineCap = 'round';
  for (let k = 0; k < 9000; k++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 18 + r() * 30; g.strokeStyle = r() < 0.5 ? 'rgba(255,230,170,.024)' : 'rgba(20,10,0,.027)'; g.lineWidth = 5 + r() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const ck = P.craquelure('ren_kit', 0.14); g.drawImage(ck, 0, 0); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.07; g.filter = 'brightness(0) invert(1)'; g.drawImage(ck, 1, 1); g.restore(); });
// 每镜收尾：罩层＋(夜/暖)色釉＋字幕带 y1380–1560 压暗（深褐渐变，不放内容）。o { warm 0..1, night true }
D.finish = (c, o = {}) => {
  c.drawImage(overSprite(), 0, 0);
  if (o.night) { c.fillStyle = 'rgba(30,22,10,.14)'; c.fillRect(0, 0, W, H); }
  if (o.warm) { c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,214,120,${0.25 * o.warm})`; c.fillRect(0, 0, W, H); c.restore(); }
  const b = c.createLinearGradient(0, 1340, 0, 1620); b.addColorStop(0, 'rgba(26,19,13,0)'); b.addColorStop(0.28, 'rgba(26,19,13,.78)'); b.addColorStop(0.72, 'rgba(26,19,13,.78)'); b.addColorStop(1, 'rgba(26,19,13,0)'); c.fillStyle = b; c.fillRect(0, 1340, W, 280); };

// ---------- 文字（硬边、清晰，不糊） ----------
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot }
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ash, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k); c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
// 大字：烟灰米白字＋深褐硬投影。size ≥ 100
D.bigText = (c, s, x, y, size = 120, fill = C.ash, o = {}) => { size = Math.max(100, size); const { fam = 'PuHui-Black', shadow = true, rot = 0, scale = 1, alpha = 1, maxW = 0, shadowCol = 'rgba(20,12,6,.85)' } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; if (shadow) { c.fillStyle = shadowCol; c.fillText(s, size * 0.045, size * 0.055); } c.fillStyle = fill; c.fillText(s, 0, 0); c.restore(); };
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标题牌：深褐底＋金色细框＋烟灰字（不透明，字永远整块可读）。返回底边 y。o { size≥100, w, h, lt, at（弹入）, alpha, fill, col, edge, rot }
D.title = (c, s, x, y, o = {}) => { const size = Math.max(100, o.size || 128), lines = D.split2(s), n = lines.length, w = o.w || 940, h = o.h || (size * 1.28 * n + 40), k = o.lt != null ? D.pop(o.lt, o.at || 0, 0.5) : 1; if (k <= 0) return y + h / 2;
  const a = clamp(k * 2) * (o.alpha ?? 1); c.save(); c.globalAlpha *= a; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(k, k);
  c.fillStyle = 'rgba(12,8,4,.55)'; c.fillRect(-w / 2 + 12, -h / 2 + 14, w, h); c.fillStyle = o.fill || C.dark; c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = o.edge || C.gold; c.lineWidth = 3; c.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); c.lineWidth = 1.5; c.strokeRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36);
  lines.forEach((ln, i) => D.text(c, ln, 0, (i - (n - 1) / 2) * size * 1.2 + 3, { size, fam: 'PuHui-Black', col: o.col || C.ash, maxW: w - 80 })); c.restore(); return y + h / 2; };
// 标签板：纸色底＋深褐字（size ≥ 52），左侧窄条（hot＝鞋赭红，否则暗褐）。返回宽度。o { size, fam, fill, col, scale, alpha, rot, hot, align:'left' }
D.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 56), { fam = 'PuHui-Heavy', scale = 1, alpha = 1, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const tw = c.measureText(s).width, w = tw + size * 1.2, h = size * 1.5, ox = o.align === 'left' ? w / 2 : 0;
  c.fillStyle = 'rgba(12,8,4,.55)'; c.fillRect(-w / 2 + ox + 8, -h / 2 + 9, w, h); c.fillStyle = o.fill || C.paper; c.fillRect(-w / 2 + ox, -h / 2, w, h);
  c.fillStyle = o.hot ? C.shoe : C.umber; c.fillRect(-w / 2 + ox, -h / 2, 12, h); c.fillStyle = 'rgba(80,60,30,.18)'; c.fillRect(-w / 2 + ox + 12, h / 2 - 8, w - 12, 8);
  c.fillStyle = o.col || C.dark; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, ox + 6, 3); c.restore(); return w; };
D.popText = (c, s, x, y, lt, at, o = {}) => { const k = D.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha ?? 1);
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else D.bigText(c, s, x, y, o.size || 120, o.fill || C.ash, { ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：细线从 (ax,ay) 画向 (bx,by)，末端标签板逐字打出（约 20 字/秒）。o { size(≥52), hot }
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = 'rgba(12,8,4,.7)'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax + 3, ay + 4); c.lineTo(lerp(ax, bx, p1) + 3, lerp(ay, by, p1) + 4); c.stroke();
  c.strokeStyle = C.ash; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = o.hot ? C.shoe : C.ash; c.beginPath(); c.arc(ax, ay, 13 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; D.tag(c, TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20)), bx, by, { ...o, scale: q, size: Math.max(52, o.size || 54), align: 'left' }); };

// ---------- 树 / 叶 ----------
// 单片叶：D.leaf(c,x,y,{s,rot,frost 0..1,col 0..4,seed})
D.leaf = (c, x, y, o = {}) => { const s = o.s || 40; c.save(); c.translate(x, y); c.rotate(o.rot || 0); if (o.sq) c.scale(1, o.sq); D.paint(c, [-s * 1.3, -s * 1.3, s * 2.6, s * 2.6], g => drawLeaf(g, s, o.rot2 || 0, rgb(LEAF_COLS[(o.col ?? 0) % 5]), o.frost ?? 0.8, U.rng((o.seed || 1) * 31 + 5))); c.restore(); };
// 一把落叶（一次 paint）：D.leaves(c,x,y,w,h,n,{s,frost,seed})  地面上散落（y 方向压扁）
D.leaves = (c, x, y, w, h, n, o = {}) => (PK = `leaves_${Math.round(w)}_${Math.round(h)}_${n}_${o.seed || 1}_${o.s || 34}_${o.frost ?? 0.8}`, D.paint)(c, [x - w / 2 - 60, y - h / 2 - 60, w + 120, h + 120], g => { const r = U.rng((o.seed || 1) * 13 + 1);
  for (let i = 0; i < n; i++) { g.save(); g.translate(x + (r() - 0.5) * w, y + (r() - 0.5) * h); g.scale(1, 0.45); drawLeaf(g, (o.s || 34) * (0.6 + r() * 0.8), r() * TAU, rgb(LEAF_COLS[Math.floor(r() * 5)]), o.frost ?? 0.8, r); g.restore(); } });
// 梧桐树：D.tree(c,x,y,{h 树干高(默认 1300), w 干粗(120), side 受光侧 ±1, canopy true 顶部叶冠, seed, alpha})  (x,y) 树根中点。干为缓存精灵，每帧一次贴图。
D.tree = (c, x, y, o = {}) => { const w = o.w || 120, h = o.h || 1300, seed = o.seed || 1, side = o.side || 1;
  const spr = D.once(`ren_tree_${seed}_${w}_${h}_${side}`, () => { const cw = Math.ceil(w * 2.4), cvs = P.canvas(cw, h + 40), g = cvs.getContext('2d'), out = P.canvas(cw, h + 40), og = out.getContext('2d');
    drawTrunk(g, cw / 2, h + 20, w, 20, side, seed * 3.1, h2 => h2, U.rng(seed * 7 + 1)); og.filter = 'blur(1.3px)'; og.drawImage(cvs, 0, 0); og.filter = 'none'; return out; });
  c.save(); c.globalAlpha *= o.alpha ?? 1; sink(c, x, y + 6, w * 1.7, w * 0.4, 0.55, '20,12,6'); c.drawImage(spr, x - spr.width / 2, y - h - 20);
  if (o.canopy !== false) { const cs = D.once(`ren_canopy_${seed}`, () => { const cvs = P.canvas(900, 640), g = cvs.getContext('2d'), r = U.rng(seed * 11 + 5);
      for (let k = 0; k < 40; k++) { const a = r() * TAU, rr = Math.sqrt(r()) * 190, cx = 450 + Math.cos(a) * rr * 1.4, cy = 320 + Math.sin(a) * rr * 0.8, s = 70 + r() * 80, cg = g.createRadialGradient(cx, cy, 0, cx, cy, s), cc = LEAF_COLS[Math.floor(r() * 5)]; cg.addColorStop(0, rgb(cc, 0.5)); cg.addColorStop(1, rgb(cc, 0)); g.fillStyle = cg; g.fillRect(cx - s, cy - s, s * 2, s * 2); }
      for (let k = 0; k < 60; k++) { const a = r() * TAU, rr = Math.sqrt(r()) * 250; g.save(); g.translate(450 + Math.cos(a) * rr * 1.4, 320 + Math.sin(a) * rr * 0.75); drawLeaf(g, 18 + r() * 24, r() * TAU, rgb(LEAF_COLS[Math.floor(r() * 5)], 0.8), 0.5, r); g.restore(); }
      const out = P.canvas(900, 640), og = out.getContext('2d'); og.filter = 'blur(1.6px)'; og.drawImage(cvs, 0, 0); og.filter = 'none'; og.globalAlpha = 0.82; og.drawImage(cvs, 0, 0); return out; });
    c.drawImage(cs, x - 450 * (w / 120 * 0.8 + 0.2), y - h - 330, 900 * (w / 120 * 0.8 + 0.2), 640 * (w / 120 * 0.8 + 0.2)); }
  c.restore(); };

// ---------- 鞋（贯穿物）：赭红皮鞋 ----------
const shoeSide = (g, L, frost) => {
  const hgt = L * 0.31;
  g.fillStyle = '#1b0f0a'; g.beginPath(); g.moveTo(-L * 0.5, -4); g.quadraticCurveTo(-L * 0.52, 12, -L * 0.44, 14); g.lineTo(L * 0.42, 14); g.quadraticCurveTo(L * 0.54, 12, L * 0.52, -14); g.lineTo(-L * 0.5, -18); g.closePath(); g.fill();
  const body = new Path2D(); body.moveTo(-L * 0.5, -16); body.bezierCurveTo(-L * 0.53, -hgt * 0.5, -L * 0.5, -hgt * 0.9, -L * 0.42, -hgt * 0.98); body.bezierCurveTo(-L * 0.3, -hgt, -L * 0.22, -hgt * 0.78, -L * 0.12, -hgt * 0.72);
  body.bezierCurveTo(-L * 0.02, -hgt * 0.7, 0, -hgt * 0.98, L * 0.12, -hgt * 0.88); body.bezierCurveTo(L * 0.3, -hgt * 0.78, L * 0.5, -hgt * 0.45, L * 0.53, -20); body.lineTo(L * 0.5, -16); body.closePath();
  const lg = g.createLinearGradient(0, -hgt, 0, 0); lg.addColorStop(0, '#b0583f'); lg.addColorStop(0.35, '#9A4A3A'); lg.addColorStop(1, '#4a1e14'); g.fillStyle = lg; g.fill(body); g.save(); g.clip(body);
  const hl = g.createRadialGradient(L * 0.3, -hgt * 0.5, 4, L * 0.3, -hgt * 0.5, L * 0.3); hl.addColorStop(0, 'rgba(255,214,170,.5)'); hl.addColorStop(1, 'rgba(255,214,170,0)'); g.fillStyle = hl; g.fillRect(-L, -hgt * 1.2, L * 2, hgt * 1.4);
  const bk = g.createLinearGradient(-L * 0.5, 0, -L * 0.1, 0); bk.addColorStop(0, 'rgba(10,3,0,.55)'); bk.addColorStop(1, 'rgba(10,3,0,0)'); g.fillStyle = bk; g.fillRect(-L * 0.55, -hgt * 1.2, L * 0.5, hgt * 1.4);
  g.strokeStyle = 'rgba(230,180,130,.35)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(-L * 0.46, -24); g.lineTo(L * 0.48, -26); g.stroke(); g.setLineDash([]);
  g.strokeStyle = 'rgba(20,6,2,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(L * 0.17, -hgt * 0.84); g.quadraticCurveTo(L * 0.27, -hgt * 0.45, L * 0.2, -22); g.stroke();
  g.strokeStyle = 'rgba(20,6,2,.35)'; g.lineWidth = 2.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(L * (0.02 + i * 0.04), -hgt * (0.55 - i * 0.06)); g.quadraticCurveTo(L * (0.08 + i * 0.04), -hgt * (0.4 - i * 0.05), L * (0.04 + i * 0.04), -hgt * 0.25); g.stroke(); }
  if (frost) { const r = U.rng(31); for (let k = 0; k < 150; k++) { const x = (r() - 0.3) * L * 0.9, y = -r() * hgt * 0.95; g.fillStyle = `rgba(240,247,248,${(0.15 + r() * 0.5) * frost})`; g.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 1.5); } }
  g.restore(); g.fillStyle = 'rgba(8,2,0,.9)'; g.beginPath(); g.moveTo(-L * 0.4, -hgt * 0.98); g.bezierCurveTo(-L * 0.3, -hgt, -L * 0.22, -hgt * 0.78, -L * 0.12, -hgt * 0.72); g.bezierCurveTo(-L * 0.2, -hgt * 0.84, -L * 0.32, -hgt * 0.88, -L * 0.4, -hgt * 0.98); g.fill(); };
const SHOE_TOP = [[-0.5, 0], [-0.48, -0.1], [-0.38, -0.145], [-0.12, -0.13], [0.1, -0.17], [0.34, -0.15], [0.5, -0.07], [0.54, 0], [0.5, 0.07], [0.34, 0.15], [0.1, 0.17], [-0.12, 0.13], [-0.38, 0.145], [-0.48, 0.1]];
const shoeTop = (g, L, frost) => {   // 俯视鞋（脚尖朝 +x）
  const outl = k => SHOE_TOP.map(p => [p[0] * L * k, p[1] * L * k]);
  g.fillStyle = '#1b0f0a'; g.save(); g.translate(0, L * 0.035); g.beginPath(); smooth(g, outl(1.01)); g.fill(); g.restore();   // 皮底厚度
  g.beginPath(); smooth(g, outl(1)); const lg = g.createLinearGradient(0, -L * 0.17, 0, L * 0.17); lg.addColorStop(0, '#b8624a'); lg.addColorStop(0.5, '#9A4A3A'); lg.addColorStop(1, '#5a261a'); g.fillStyle = lg; g.fill();
  g.save(); g.clip(); const hl = g.createRadialGradient(L * 0.28, -L * 0.04, 2, L * 0.28, -L * 0.04, L * 0.25); hl.addColorStop(0, 'rgba(255,214,170,.5)'); hl.addColorStop(1, 'rgba(255,214,170,0)'); g.fillStyle = hl; g.fillRect(-L, -L, L * 2, L * 2);
  g.fillStyle = 'rgba(14,5,2,.95)'; g.beginPath(); g.ellipse(-L * 0.26, 0, L * 0.15, L * 0.07, 0, 0, TAU); g.fill();   // 鞋口
  g.fillStyle = '#6a2c1f'; g.beginPath(); g.moveTo(-L * 0.12, -L * 0.055); g.quadraticCurveTo(L * 0.1, -L * 0.075, L * 0.12, 0); g.quadraticCurveTo(L * 0.1, L * 0.075, -L * 0.12, L * 0.055); g.closePath(); g.fill();   // 鞋舌/鞋面
  g.strokeStyle = 'rgba(235,205,170,.55)'; g.lineWidth = 2.5; for (let i = 0; i < 4; i++) { const x = -L * 0.07 + i * L * 0.045; g.beginPath(); g.moveTo(x, -L * 0.05); g.lineTo(x + L * 0.02, L * 0.05); g.stroke(); }
  g.strokeStyle = 'rgba(20,6,2,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(L * 0.22, -L * 0.13); g.quadraticCurveTo(L * 0.3, 0, L * 0.22, L * 0.13); g.stroke();
  g.strokeStyle = 'rgba(230,180,130,.35)'; g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); smooth(g, outl(0.93)); g.stroke(); g.setLineDash([]);
  if (frost) { const r = U.rng(41); for (let k = 0; k < 110; k++) { g.fillStyle = `rgba(240,247,248,${(0.15 + r() * 0.5) * frost})`; g.fillRect((r() - 0.5) * L, (r() - 0.5) * L * 0.34, 1 + r() * 2.5, 1 + r() * 1.5); } } g.restore(); };
// 鞋：D.shoe(c,x,y,o)：(x,y) 鞋心（侧视＝鞋底接地中点）。o { L 鞋长(300), view 'side'(侧视，脚尖朝 +x，dir=-1 翻向)|'top'(俯视，rot 为朝向角：0 朝右，−π/2 朝上), dir, rot, persp 俯视压扁(默认 0.62), frost 0..1(默认 0.9), shadow, alpha, scale }
D.shoe = (c, x, y, o = {}) => { const L = o.L || 300, view = o.view || 'side', fr = o.frost ?? 0.9; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.scale) c.scale(o.scale, o.scale);
  if (view === 'side') { if (o.shadow !== false) { c.save(); c.scale(1, 0.22); const sh = c.createRadialGradient(0, 0, 4, 0, L * 0.12, L * 0.62); sh.addColorStop(0, 'rgba(8,4,0,.7)'); sh.addColorStop(1, 'rgba(8,4,0,0)'); c.fillStyle = sh; c.beginPath(); c.arc(0, L * 0.12, L * 0.62, 0, TAU); c.fill(); c.restore(); }
    c.rotate(o.rot || 0); c.scale(o.dir || 1, 1); D.paint(c, [-L * 0.62, -L * 0.45, L * 1.24, L * 0.6], g => shoeSide(g, L, fr), { key: `shoeS_${Math.round(L)}_${fr}` }); }
  else { const pr = o.persp ?? 0.62; c.scale(1, pr); if (o.shadow !== false) sink(c, L * 0.04, L * 0.08, L * 0.62, L * 0.26, 0.55, '8,4,0'); c.rotate(o.rot || 0); c.scale(o.dir || 1, 1); D.paint(c, [-L * 0.65, -L * 0.3, L * 1.3, L * 0.6], g => shoeTop(g, L, fr), { key: `shoeT_${Math.round(L)}_${fr}` }); }
  c.restore(); };
// 一双鞋（贯穿物）：D.shoePair(c,x,y,o)：(x,y) 两鞋中点。o { L, wrong 0..1（0＝摆正并拢朝前；1＝一只掉头，脚尖朝后）, gap, view:'top'(默认)|'side', frost, alpha }
//   「章与章之间摆放角度逐渐摆正」＝ 各章用 wrong 递减（末章 0）。侧视时 wrong>0.5 两只相对（八字相对）。
D.shoePair = (c, x, y, o = {}) => { const L = o.L || 280, w = clamp(o.wrong ?? 1), gap = o.gap ?? L * 0.42, view = o.view || 'top';
  if (view === 'side') { D.shoe(c, x - gap * 1.1, y - 20, { ...o, L, dir: 1, rot: -0.04 * w }); D.shoe(c, x + gap * 1.1, y + 36, { ...o, L: L * 1.1, dir: w > 0.5 ? -1 : 1, rot: 0.05 * w }); return; }
  const rl = -Math.PI / 2 - w * 0.5, rr = -Math.PI / 2 + w * Math.PI * 0.82 + (1 - w) * 0.03; D.shoe(c, x - gap, y, { ...o, L, view: 'top', rot: rl }); D.shoe(c, x + gap, y + w * L * 0.12, { ...o, L, view: 'top', rot: rr }); };
// 鞋印（只剩鞋印）：D.footprint(c,x,y,{s,rot,n,step,alpha})  n 个脚印沿 rot 方向间隔 step
D.footprint = (c, x, y, o = {}) => { const s = o.s || 200, n = o.n || 1, rot = o.rot ?? -Math.PI / 2, st = o.step || s * 1.5;
  for (let i = 0; i < n; i++) { c.save(); c.translate(x + Math.cos(rot) * st * i, y + Math.sin(rot) * st * i * 0.62 + (i % 2 ? 14 : -14)); c.scale(1, 0.62); c.rotate(rot); c.globalAlpha *= (o.alpha ?? 0.7) * (1 - i / (n + 1));
    c.fillStyle = 'rgba(16,10,4,.55)'; c.beginPath(); smooth(c, SHOE_TOP.map(p => [p[0] * s, p[1] * s])); c.fill(); c.fillStyle = 'rgba(238,244,244,.3)'; c.beginPath(); smooth(c, SHOE_TOP.map(p => [p[0] * s * 0.82, p[1] * s * 0.7])); c.fill(); c.restore(); } };

// ---------- 钟表（硬边精绘，不糊） ----------
const timeOf = tm => { const t = tm || D.FIXED_TIME, h = t[0] || 0, m = t[1] || 0, s = t[2] || 0; return { h, m, s, ha: ((h % 12) + m / 60) / 12 * TAU, ma: (m + s / 60) / 60 * TAU, sa: s / 60 * TAU }; };
const hand = (g, len, wid, col, tail = 0.18) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, len * tail); g.lineTo(-wid * 0.55, 0); g.lineTo(-wid * 0.28, -len * 0.82); g.lineTo(0, -len); g.lineTo(wid * 0.28, -len * 0.82); g.lineTo(wid * 0.55, 0); g.closePath(); g.fill(); };
const dial = (g, r, tm, o = {}) => {   // 表盘（圆心为原点）：纸面、刻度、数字、指针
  const T = timeOf(tm), fg = g.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r); fg.addColorStop(0, '#efe8d3'); fg.addColorStop(1, '#cfc6ad'); g.fillStyle = fg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = C.dark; for (let i = 0; i < 60; i++) { const big = i % 5 === 0, a = i / 60 * TAU; g.lineWidth = big ? r * 0.035 : r * 0.012; g.beginPath(); g.moveTo(Math.sin(a) * r * (big ? 0.82 : 0.88), -Math.cos(a) * r * (big ? 0.82 : 0.88)); g.lineTo(Math.sin(a) * r * 0.94, -Math.cos(a) * r * 0.94); g.stroke(); }
  const all = o.nums ? o.nums === 'all' : r >= 150;
  if (o.nums !== 'none') for (let i = 1; i <= 12; i++) { if (!all && i % 3) continue; const a = i / 12 * TAU; D.text(g, String(i), Math.sin(a) * r * 0.66, -Math.cos(a) * r * 0.66 + r * 0.01, { size: r * (all ? 0.2 : 0.26), fam: 'PuHui-Black', col: C.dark }); }
  g.save(); g.rotate(T.ha); hand(g, r * 0.5, r * 0.1, C.dark); g.restore(); g.save(); g.rotate(T.ma); hand(g, r * 0.78, r * 0.065, C.dark, 0.14); g.restore();
  if (o.sec != null) { g.save(); g.rotate(o.sec / 60 * TAU); g.strokeStyle = C.shoe; g.lineWidth = r * 0.02; g.beginPath(); g.moveTo(0, r * 0.18); g.lineTo(0, -r * 0.84); g.stroke(); g.restore(); }
  g.fillStyle = C.goldD; g.beginPath(); g.arc(0, 0, r * 0.05, 0, TAU); g.fill(); g.fillStyle = C.dark; g.beginPath(); g.arc(0, 0, r * 0.02, 0, TAU); g.fill(); };
const ringGrad = (g, r, a = C.gold, b = C.copper) => { const rg = g.createLinearGradient(-r, -r, r, r); rg.addColorStop(0, '#e8c470'); rg.addColorStop(0.45, a); rg.addColorStop(1, b); return rg; };
// 墙钟：D.clock(c,x,y,r,o)：(x,y) 圆心。o { time:[h,m,s]（缺省 K.FIXED_TIME）, sec 秒针秒数(缺省不画), frame 'brass'(默认)|'wood'|'plain', cracked 0..1 玻璃裂纹, shadow, alpha, nums 'all'|'four'|'none' }
D.clock = (c, x, y, r, o = {}) => { c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y);
  if (o.shadow !== false) sink(c, r * 0.1, r * 0.14, r * 1.28, r * 1.28, 0.5, '8,4,0');
  const fr = o.frame || 'brass', fw = r * 0.13; c.beginPath(); c.arc(0, 0, r + fw, 0, TAU); c.fillStyle = fr === 'wood' ? '#4a3622' : fr === 'plain' ? C.umberD : ringGrad(c, r + fw); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 1, 0, TAU); c.stroke(); c.strokeStyle = 'rgba(255,240,200,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + fw - 3, Math.PI * 0.9, Math.PI * 1.55); c.stroke();
  dial(c, r, o.time, o);
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); c.fillStyle = 'rgba(255,250,230,.1)'; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.45, r * 0.8, r * 0.35, -0.6, 0, TAU); c.fill(); c.restore();
  if (o.cracked) { const q = clamp(o.cracked); c.strokeStyle = `rgba(30,20,10,${0.65 * q})`; c.lineWidth = Math.max(1.5, r * 0.012); c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); for (let i = 0; i < 7; i++) { const a = U.hash(i, 3) * TAU; let px = Math.cos(a) * r * 0.12, py = Math.sin(a) * r * 0.12; c.beginPath(); c.moveTo(px, py); for (let k = 0; k < 5 * q + 1; k++) { px += Math.cos(a + (U.hash(i * 9 + k, 2) - 0.5) * 0.9) * r * 0.2; py += Math.sin(a + (U.hash(i * 9 + k, 2) - 0.5) * 0.9) * r * 0.2; c.lineTo(px, py); } c.stroke(); } c.restore(); }
  c.restore(); };
// 怀表：D.pocketWatch(c,x,y,r,o)：(x,y) 表盘圆心。o { time, lid 表盖 0 开(默认)..1 合, chain true 带链(默认), chainTo [x,y]（链另一端，缺省垂向下方）, sway 链摆动(t), cracked, shadow, alpha }
D.pocketWatch = (c, x, y, r, o = {}) => { c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y);
  if (o.chain !== false) { const ex = o.chainTo ? o.chainTo[0] - x : r * 1.1 + Math.sin(o.sway || 0) * 30, ey = o.chainTo ? o.chainTo[1] - y : r * 3.2, x0 = 0, y0 = -r * 1.42, N = 26; c.lineWidth = Math.max(3, r * 0.04);
    for (let i = 0; i <= N; i++) { const f = i / N, bx = lerp(x0, ex, f) + Math.sin(f * Math.PI) * r * 0.5 * (ex >= 0 ? 1 : -1), by = lerp(y0, ey, f) - Math.sin(f * Math.PI) * r * 0.2; c.strokeStyle = i % 2 ? C.goldD : '#e8c470'; c.beginPath(); c.ellipse(bx, by, r * 0.045, r * 0.07, (i % 2 ? 0.6 : -0.6) + f * 2, 0, TAU); c.stroke(); } }
  if (o.shadow !== false) sink(c, r * 0.12, r * 0.16, r * 1.3, r * 1.3, 0.5, '8,4,0');
  c.fillStyle = ringGrad(c, r); c.fillRect(-r * 0.14, -r * 1.3, r * 0.28, r * 0.3); c.strokeStyle = C.goldD; c.lineWidth = r * 0.06; c.beginPath(); c.arc(0, -r * 1.42, r * 0.2, 0, TAU); c.stroke();   // 表冠＋表环
  const rg = r * 1.1; c.beginPath(); c.arc(0, 0, rg, 0, TAU); c.fillStyle = ringGrad(c, rg); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = 'rgba(255,240,200,.45)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rg - 5, Math.PI * 0.9, Math.PI * 1.55); c.stroke();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); dial(c, r, o.time, { nums: r >= 130 ? 'all' : 'four' }); c.fillStyle = 'rgba(30,20,10,.18)'; c.beginPath(); c.arc(0, r * 0.45, r * 0.2, 0, TAU); c.fill(); c.restore();   // 小秒盘
  c.strokeStyle = 'rgba(30,20,10,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, r * 0.45, r * 0.2, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(40,28,10,.45)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r + 2, 0, TAU); c.stroke();
  if (o.cracked) { c.strokeStyle = `rgba(30,20,10,${0.6 * clamp(o.cracked)})`; c.lineWidth = Math.max(1.5, r * 0.012); for (let i = 0; i < 6; i++) { const a = U.hash(i, 3) * TAU; let px = Math.cos(a) * r * 0.1, py = Math.sin(a) * r * 0.1; c.beginPath(); c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += Math.cos(a + (U.hash(i * 9 + k, 2) - 0.5)) * r * 0.22; py += Math.sin(a + (U.hash(i * 9 + k, 2) - 0.5)) * r * 0.22; c.lineTo(px, py); } c.stroke(); } }
  const lid = clamp(o.lid ?? 0); if (lid > 0.02) { c.save(); c.translate(-rg, 0); c.scale(lid, 1); c.translate(rg, 0); c.beginPath(); c.arc(0, 0, rg, 0, TAU); c.fillStyle = ringGrad(c, rg); c.fill(); c.strokeStyle = C.goldD; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, rg * 0.75, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, rg * 0.55, 0, TAU); c.stroke(); c.restore(); }
  c.restore(); };
// 碎表盘：D.brokenDial(c,x,y,r,o)：o { time, p 碎裂进度 0..1（碎片逐渐错开）, missing [碎片序号]（缺失的碎片，默认 [3]）, alpha, frame }
D.brokenDial = (c, x, y, r, o = {}) => { const p = clamp(o.p ?? 1), N = 9, ang = [], miss = o.missing || [3]; for (let i = 0; i < N; i++) ang.push(i / N * TAU + (U.hash(i, 31) - 0.5) * 0.4);
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.shadow !== false) sink(c, r * 0.1, r * 0.14, r * 1.28, r * 1.28, 0.5, '8,4,0');
  const fw = r * 0.13; c.beginPath(); c.arc(0, 0, r + fw, 0, TAU); c.fillStyle = ringGrad(c, r + fw); c.fill(); c.fillStyle = '#120c07'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();   // 空洞里是深色机芯
  const cen = [(U.hash(1, 5) - 0.5) * r * 0.2, (U.hash(2, 5) - 0.5) * r * 0.2];
  for (let i = 0; i < N; i++) { if (miss.includes(i)) continue; const a0 = ang[i], a1 = ang[(i + 1) % N] + (i === N - 1 ? TAU : 0), am = (a0 + a1) / 2, rm = r * (0.5 + U.hash(i, 6) * 0.2);
    const pts = [cen, [Math.cos(a0) * r * 1.01, Math.sin(a0) * r * 1.01], [Math.cos(am) * r * 1.01, Math.sin(am) * r * 1.01], [Math.cos(a1) * r * 1.01, Math.sin(a1) * r * 1.01], [Math.cos(a1 - 0.1) * rm, Math.sin(a1 - 0.1) * rm], [Math.cos(a0 + 0.1) * rm, Math.sin(a0 + 0.1) * rm]];
    c.save(); c.translate(Math.cos(am) * r * 0.05 * p * (0.4 + U.hash(i, 7)), Math.sin(am) * r * 0.05 * p * (0.4 + U.hash(i, 7)) + p * r * 0.01 * i % 3); c.rotate((U.hash(i, 8) - 0.5) * 0.12 * p); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => c.lineTo(q[0], q[1])); c.closePath(); c.clip();
    dial(c, r, o.time, { nums: r >= 150 ? 'all' : 'four' }); c.restore();
    c.save(); c.translate(Math.cos(am) * r * 0.05 * p * (0.4 + U.hash(i, 7)), Math.sin(am) * r * 0.05 * p * (0.4 + U.hash(i, 7))); c.rotate((U.hash(i, 8) - 0.5) * 0.12 * p); c.strokeStyle = 'rgba(255,248,225,.7)'; c.lineWidth = Math.max(1.5, r * 0.01); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => c.lineTo(q[0], q[1])); c.closePath(); c.stroke(); c.restore(); }
  c.restore(); };

// ---------- 人：无脸剪影 / 手 ----------
const TONES = { dark: ['#1b1510', '#3a3128', '#5d5242'], blue: ['#2a3138', '#4a555e', '#8E9AA3'], ash: ['#4a4337', '#6B6256', '#a69d84'], warm: ['#2a1c10', '#5a4326', '#a8844a'] };
const limb = (g, ax, ay, bx, by, w0, w1) => { const a = Math.atan2(by - ay, bx - ax) + Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a); g.beginPath(); g.moveTo(ax + dx * w0 / 2, ay + dy * w0 / 2); g.lineTo(bx + dx * w1 / 2, by + dy * w1 / 2); g.arc(bx, by, w1 / 2, a, a + Math.PI, true); g.lineTo(ax - dx * w0 / 2, ay - dy * w0 / 2); g.arc(ax, ay, w0 / 2, a + Math.PI, a + TAU, true); g.closePath(); g.fill(); };
const figBody = (g, o) => {   // 原点＝脚底（sit：椅下地面；kneel：膝/小腿着地处）；向上为负 y；身高约 800
  const pose = o.pose, tone = TONES[o.tone] || TONES.dark, br = Math.sin((o.t || 0) * 1.6) * 2.5, hz = o.haze || 0, mixh = h => hz ? rgb(P.mix(hex(h), HAZE, hz)) : h;
  const gr = g.createLinearGradient(-140, 0, 140, 0); gr.addColorStop(0, mixh(tone[0])); gr.addColorStop(0.6, mixh(tone[1])); gr.addColorStop(1, mixh(tone[2]));
  const fill = gr; g.fillStyle = fill; const head = (hx, hy, tilt, hat) => { g.save(); g.translate(hx, hy); g.rotate(tilt); g.fillStyle = fill; g.beginPath(); g.ellipse(0, 0, 44, 54, 0, 0, TAU); g.fill();
    if (hat) { g.fillStyle = mixh(tone[0]); g.beginPath(); g.ellipse(0, -34, 70, 14, 0, 0, TAU); g.fill(); g.fillRect(-40, -78, 80, 48); } g.restore(); };
  const coat = (cx, cy, w, wBot, hh) => { g.fillStyle = fill; g.beginPath(); g.moveTo(cx - w * 0.3, cy - 8); g.bezierCurveTo(cx - w * 0.75, cy - 8, cx - w, cy + 8, cx - w, cy + 50); g.lineTo(cx - wBot, cy + hh); g.quadraticCurveTo(cx, cy + hh + 16, cx + wBot, cy + hh); g.lineTo(cx + w, cy + 50); g.bezierCurveTo(cx + w, cy + 8, cx + w * 0.75, cy - 8, cx + w * 0.3, cy - 8); g.closePath(); g.fill(); };
  const skin = mixh(hz ? '#8d7560' : '#8d7560');
  if (pose === 'stand' || pose === 'back') {
    g.fillStyle = fill; limb(g, -34, -380, -38, -22, 62, 46); limb(g, 34, -380, 38, -22, 62, 46); g.fillStyle = mixh('#120c08'); g.beginPath(); g.ellipse(-44, -10, 36, 14, 0, 0, TAU); g.ellipse(44, -10, 36, 14, 0, 0, TAU); g.fill();
    g.fillStyle = fill; coat(0, -700 + br, 96, 112, 380); limb(g, -100, -664, -134, -392, 40, 32); limb(g, 100, -664, 134, -392, 40, 32); g.fillStyle = skin; g.beginPath(); g.ellipse(-136, -374, 15, 21, 0, 0, TAU); g.ellipse(136, -374, 15, 21, 0, 0, TAU); g.fill();
    g.fillStyle = fill; g.fillRect(-18, -742 + br, 36, 54); head(0, -768 + br, 0, o.hat); }
  else if (pose === 'walk') {   // 侧身行走（朝 +x）
    const ph = Math.sin((o.t || 0) * 5 + (o.phase || 0)), ph2 = Math.cos((o.t || 0) * 5 + (o.phase || 0)), hip = [0, -380]; g.fillStyle = fill;
    limb(g, hip[0] - 10, hip[1], hip[0] - ph * 100, -24 - Math.max(0, ph2) * 26, 58, 40); limb(g, hip[0] + 10, hip[1], hip[0] + ph * 100, -24 - Math.max(0, -ph2) * 26, 58, 40);
    g.fillStyle = mixh('#120c08'); g.beginPath(); g.ellipse(-ph * 100 + 18, -14 - Math.max(0, ph2) * 26, 40, 14, 0, 0, TAU); g.ellipse(ph * 100 + 18, -14 - Math.max(0, -ph2) * 26, 40, 14, 0, 0, TAU); g.fill();
    g.save(); g.translate(0, br + Math.abs(ph) * -6); g.rotate(0.06); g.fillStyle = fill; coat(-6, -700, 76, 92, 360); limb(g, 0, -670, ph * 70 - 20, -420, 40, 32); limb(g, 0, -670, -ph * 70 - 20, -420, 40, 32); g.fillRect(-14, -742, 30, 52); head(14, -768, 0.05, o.hat); g.restore(); }
  else if (pose === 'sit') {   // 侧身坐（朝 +x），椅在身下
    if (o.chair !== false) { g.fillStyle = mixh('#43372a'); g.fillRect(-130, -420, 210, 24); g.fillRect(-140, -420, 20, 420); g.fillRect(60, -420, 20, 420); g.fillRect(-150, -760, 22, 350); g.fillRect(-150, -760, 22, 30); }
    g.fillStyle = fill; limb(g, 0, -400, 170, -410, 74, 56); limb(g, 170, -410, 182, -30, 56, 44); g.fillStyle = mixh('#120c08'); g.beginPath(); g.ellipse(214, -14, 48, 16, 0, 0, TAU); g.fill();
    g.fillStyle = fill; g.save(); g.translate(0, br); g.beginPath(); g.moveTo(-60, -410); g.bezierCurveTo(-78, -560, -76, -680, -40, -732); g.lineTo(60, -738); g.bezierCurveTo(98, -680, 96, -540, 84, -406); g.closePath(); g.fill();
    limb(g, 30, -690, 150, -520, 40, 32); g.fillStyle = skin; g.beginPath(); g.ellipse(160, -512, 24, 20, 0, 0, TAU); g.fill(); g.fillStyle = fill; g.fillRect(-10, -776, 34, 50); head(20, -808, 0.05, o.hat); g.restore(); }
  else if (pose === 'kneel') {   // 跪姿（朝 +x，低头看地）
    g.fillStyle = fill; limb(g, 90, -26, -120, -22, 54, 40); limb(g, -10, -330, 92, -34, 80, 56); g.fillStyle = mixh('#120c08'); g.beginPath(); g.ellipse(-140, -16, 40, 14, 0, 0, TAU); g.fill();
    g.fillStyle = fill; g.save(); g.translate(0, br * 0.5); g.beginPath(); g.moveTo(-50, -330); g.bezierCurveTo(-70, -450, -30, -580, 30, -640); g.lineTo(100, -620); g.bezierCurveTo(110, -520, 80, -430, 60, -330); g.closePath(); g.fill();
    limb(g, 70, -610, 190, -380, 40, 32); limb(g, 190, -380, 215, -96, 32, 26); g.fillStyle = skin; g.beginPath(); g.ellipse(220, -80, 24, 22, 0, 0, TAU); g.fill(); g.fillStyle = fill; head(118, -668, 0.5, o.hat); g.restore(); }
  if (o.hi) { g.fillStyle = C.shoe; if (pose === 'stand' || pose === 'back') g.fillRect(-24, -700, 48, 14); else if (pose === 'walk') g.fillRect(-6, -702, 34, 12); else g.fillRect(20, -742, 40, 12); }   // 红点（围巾）
  if (o.shadow !== false && pose !== 'kneel') { g.save(); g.globalAlpha = 0.5; g.fillStyle = 'rgba(8,4,0,.5)'; g.beginPath(); g.ellipse(10, 6, 150, 20, 0, 0, TAU); g.fill(); g.restore(); } };
// 剪影人：D.figure(c,x,y,o)：o { pose 'stand'|'walk'|'sit'|'back'|'kneel', s 缩放(默认 0.8), f 朝向 ±1, tone 'dark'|'blue'|'ash'|'warm', hi 红点(鞋赭红围巾), hat, t 时间(呼吸/步态), haze 0..1(空气透视), chair false, alpha }
//   (x,y) = 脚底中点（sit＝椅下地面；kneel＝跪地处）。身高约 800·s。无五官。返回头部中心 [x,y]。
D.figure = (c, x, y, o = {}) => { const s = o.s ?? 0.8, f = o.f || 1; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(s * f, s);
  { const rimOn = o.rim === false ? false : (o.rim || ['stand', 'back', 'walk', undefined].includes(o.pose)); const walk = (o.pose === 'walk'), ph = walk ? Math.round((((o.t || 0) * 5 + (o.phase || 0)) % TAU + TAU) % TAU / TAU * 16) % 16 : 0, o2 = walk ? { ...o, t: (ph / 16 * TAU - (o.phase || 0)) / 5 } : { ...o, t: 0 }; PK = `fig_${o.pose || 'stand'}_${o.tone || 'dark'}_${o.hat ? 1 : 0}_${o.hi ? 1 : 0}_${(o.haze || 0).toFixed(2)}_${o.chair === false ? 0 : 1}_${rimOn ? o.rimA ?? 0.3 : 0}_${ph}`; o = { ...o2, rim: rimOn }; }
  D.paint(c, [-260, -900, 560, 940], g => { figBody(g, o); if (o.rim) { g.globalCompositeOperation = 'source-atop'; const rg = g.createLinearGradient(70, 0, 150, 0); rg.addColorStop(0, 'rgba(216,163,62,0)'); rg.addColorStop(1, `rgba(216,163,62,${o.rimA ?? 0.3})`); g.fillStyle = rg; g.fillRect(-300, -900, 700, 940); g.globalCompositeOperation = 'source-over'; } }); c.restore(); const hy = { stand: -768, back: -768, walk: -768, sit: -808, kneel: -668 }[o.pose || 'stand']; return [x + (o.pose === 'sit' ? 20 : o.pose === 'kneel' ? 118 : 0) * s * f, y + hy * s]; };
// 人群：D.crowd(c,x,y,w,n,o)：一排 n 个背影（纵深错落，越小越淡），(x,y) 脚底基线中点，w 总宽。o { s 基础缩放(0.4), hi 第几个带红点, seed, tone, t, haze 起始雾度(0.1) }
D.crowd = (c, x, y, w, n, o = {}) => { const s0 = o.s ?? 0.4, seed = o.seed || 3, step = w / Math.max(1, n - 1), bb = [x - w / 2 - 200, y - 960 * s0 * 1.3, w + 400, 1000 * s0 * 1.3 + 40];
  PK = `crowd_${n}_${Math.round(w)}_${seed}_${s0}_${o.hi}_${o.tone || 'dark'}_${o.haze ?? 0.1}`; D.paint(c, bb, g => { for (let i = 0; i < n; i++) { const dep = U.hash(i, seed + 2), sc = s0 * (0.78 + dep * 0.36), px = n === 1 ? x : x - w / 2 + i * step + (U.hash(i, seed + 3) - 0.5) * step * 0.5, py = y - dep * 30;
    g.save(); g.translate(px, py); g.scale(sc, sc); figBody(g, { pose: 'stand', tone: o.tone || 'dark', haze: clamp((o.haze ?? 0.1) + (1 - dep) * 0.3), hi: o.hi === i, hat: U.hash(i, seed + 5) > 0.7, t: (o.t || 0) + i, shadow: i % 2 === 0 }); g.restore(); } }); };
// 手：D.hand(c,x,y,o)：(x,y) 手腕；袖子从左（−x）伸来，手指朝 +x。o { pose 'open'|'point'|'pinch'|'fist'|'flat', rot, s(默认 1), f 镜像 ±1, sleeve 'dark'|'blue'|'ash', alpha }。返回指尖点。
D.hand = (c, x, y, o = {}) => { const { pose = 'open', rot = 0, s = 1, f = 1 } = o, k = ({ open: 190, point: 240, pinch: 210, fist: 140, flat: 200 })[pose] || 190, SL = ({ dark: ['#2a2119', '#43372a'], blue: ['#3a444c', '#56626b'], ash: ['#5a5143', '#7b705c'] })[o.sleeve || 'dark'];
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(rot); c.scale(s * f, s);
  PK = `hand_${pose}_${o.sleeve || 'dark'}`; D.paint(c, [-700, -130, 960, 300], g => { const sk = '#b08968', skD = '#8c6a50', bone = (bx, by, len, th, ang, col) => { g.save(); g.translate(bx, by); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.roundRect(0, -th / 2, len, th, th / 2); g.fill(); g.restore(); };
    g.fillStyle = SL[0]; g.beginPath(); g.moveTo(-640, -84); g.lineTo(-46, -70); g.lineTo(-46, 76); g.lineTo(-640, 140); g.closePath(); g.fill(); g.fillStyle = SL[1]; g.beginPath(); g.moveTo(-640, 40); g.lineTo(-46, 24); g.lineTo(-46, 76); g.lineTo(-640, 140); g.closePath(); g.fill();
    g.fillStyle = C.ash; g.beginPath(); g.moveTo(-66, -74); g.lineTo(-18, -70); g.lineTo(-18, 78); g.lineTo(-66, 84); g.closePath(); g.fill();
    g.fillStyle = sk; g.beginPath(); g.roundRect(-22, -62, 128, 124, 30); g.fill(); g.fillStyle = skD; g.beginPath(); g.roundRect(-22, 24, 128, 38, 18); g.fill();
    if (pose === 'open' || pose === 'flat') { [-46, -15, 16, 47].forEach((fy, i) => { const len = 98 - Math.abs(i - 1.3) * 12; bone(96, fy, len, 31, (i - 1.5) * (pose === 'flat' ? 0.03 : 0.1), sk); bone(104, fy + 14, len - 10, 6, (i - 1.5) * 0.1, skD); }); bone(10, -66, 96, 36, -0.78, sk); }
    else if (pose === 'point') { bone(96, -34, 140, 34, 0, sk); [-2, 28, 56].forEach(fy => { bone(88, fy, 52, 30, 0.05, skD); bone(88, fy - 3, 48, 28, 0.05, sk); }); bone(2, -66, 86, 36, -0.5, sk); }
    else if (pose === 'pinch') { bone(96, -28, 110, 32, 0.16, sk); bone(40, -70, 100, 34, 0.5, sk); [10, 38].forEach(fy => bone(88, fy, 56, 30, 0.1, sk)); }
    else { [-44, -14, 16, 46].forEach(fy => bone(90, fy - 4, 52, 31, 0, sk)); bone(0, -64, 84, 36, -0.25, sk); } });
  c.restore(); return [x + k * s * f * Math.cos(rot), y + k * s * f * Math.sin(rot)]; };

// ---------- 场景道具：桌 / 窗 / 灯 / 抽屉 / 门 / 锁 / 钥匙 ----------
// 桌：D.table(c,o)：o { y 桌面后沿(900), yf 前沿(1290), wb 后沿半宽(430), tone }。返回 { y, yf, pt(u,v) 桌面点 }（u 0..1 左右，v 0 后→1 前）
D.table = (c, o = {}) => { const y = o.y ?? 900, yf = o.yf ?? 1290, hb = o.wb ?? 430, xb0 = 540 - hb, xb1 = 540 + hb;
  PK = `table_${y}_${yf}_${hb}`; D.paint(c, [-90, y - 20, W + 180, yf - y + 140], g => { const wg = g.createLinearGradient(0, y, 0, yf); wg.addColorStop(0, '#6b5a42'); wg.addColorStop(1, '#8c7654'); g.fillStyle = wg; g.fill(D.poly([[xb0, y], [xb1, y], [W + 70, yf], [-70, yf]]));
    g.strokeStyle = 'rgba(40,28,14,.35)'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { const v = k / 6, yy = lerp(y, yf, v), e = v * 70; g.beginPath(); g.moveTo(xb0 - e, yy); g.lineTo(xb1 + e, yy); g.stroke(); }
    for (let i = 0; i < 14; i++) { const v = U.hash(i, 3), yy = lerp(y, yf, v), xx = lerp(xb0 - v * 70, xb1 + v * 70, U.hash(i, 4)); g.strokeStyle = 'rgba(40,28,14,.18)'; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 60 + U.hash(i, 5) * 160, yy); g.stroke(); }
    const sg = g.createRadialGradient(540, (y + yf) / 2, 40, 540, (y + yf) / 2, 700); sg.addColorStop(0, 'rgba(255,214,140,.22)'); sg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = sg; g.fillRect(-70, y, W + 140, yf - y);
    g.fillStyle = '#4a3a28'; g.fillRect(-70, yf, W + 140, 24); g.fillStyle = '#241a11'; g.fillRect(-70, yf + 24, W + 140, 80); });
  return { y, yf, pt: (u, v) => [lerp(lerp(xb0, -70, v), lerp(xb1, W + 70, v), u), lerp(y, yf, v)] }; };
// 窗（挂在墙上的窗框＋窗外景）：D.window(c,x,y,w,h,{view:'fog'|'night'|'dark', blind 0..1 卷帘, cols, rows})
D.window = (c, x, y, w, h, o = {}) => { const view = o.view || 'fog', cols = o.cols || 2, rows = o.rows || 3;
  PK = `win_${view}_${w}_${h}_${cols}_${rows}_${Math.round((o.blind || 0) * 20)}`; D.paint(c, [x - 50, y - 40, w + 100, h + 120], g => { g.fillStyle = '#b9ae92'; g.fillRect(x - 24, y - 24, w + 48, h + 48);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (view === 'night') { g.fillStyle = '#10141a'; g.fillRect(x, y, w, h); for (let i = 0; i < 6; i++) { const bw = w / 6, bh = h * (0.25 + U.hash(i, 31) * 0.45); g.fillStyle = '#0a0c10'; g.fillRect(x + i * bw, y + h - bh, bw - 4, bh); for (let k = 0; k < 8; k++) if (U.hash(i * 9 + k, 5) > 0.55) { g.fillStyle = '#c9983c'; g.fillRect(x + i * bw + 8 + (k % 2) * 26, y + h - bh + 14 + Math.floor(k / 2) * 30, 14, 18); } } }
    else if (view === 'dark') { g.fillStyle = '#10141a'; g.fillRect(x, y, w, h); }
    else { const fg = g.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, '#ecdca4'); fg.addColorStop(1, '#a89050'); g.fillStyle = fg; g.fillRect(x, y, w, h); for (let i = 0; i < 4; i++) { g.fillStyle = mixc('#3a3128', '#d8c88a', i / 5, 0.8); g.fillRect(x + w * (0.12 + i * 0.25), y + h * 0.15, w * 0.07 / (1 + i * 0.3), h); } }
    if (o.blind) { const bh = h * clamp(o.blind); g.fillStyle = '#b9ae92'; g.fillRect(x, y, w, bh); g.fillStyle = '#8c8168'; for (let k = 1; k * 26 < bh; k++) g.fillRect(x, y + k * 26 - 3, w, 3); g.fillStyle = C.umber; g.fillRect(x + w / 2 - 6, y + bh, 12, 40); }
    g.restore(); g.fillStyle = '#d3c9ad'; for (let i = 1; i < cols; i++) g.fillRect(x + w * i / cols - 8, y, 16, h); for (let j = 1; j < rows; j++) g.fillRect(x, y + h * j / rows - 8, w, 16);
    g.fillStyle = '#8c8168'; g.fillRect(x - 50, y + h + 24, w + 100, 24); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 50, y + h + 48, w + 100, 10); }); };
// 台灯（桌上，暗铜灯罩＋暖光晕）：D.deskLamp(c,x,y,{s, glow(默认 true)})  (x,y) 底座中点
D.deskLamp = (c, x, y, o = {}) => { const s = o.s || 1; c.save(); c.translate(x, y); c.scale(s, s);
  if (o.glow !== false) { c.save(); c.globalCompositeOperation = 'screen'; const lg = c.createRadialGradient(80, -230, 0, 80, -230, 420); lg.addColorStop(0, 'rgba(236,190,100,.55)'); lg.addColorStop(1, 'rgba(236,190,100,0)'); c.fillStyle = lg; c.fillRect(-340, -650, 840, 840); c.restore(); }
  PK = 'lamp'; D.paint(c, [-90, -330, 280, 340], g => { g.fillStyle = '#2a2119'; g.fillRect(-60, -16, 120, 16); g.fillRect(-8, -150, 16, 140); g.strokeStyle = '#2a2119'; g.lineWidth = 14; g.beginPath(); g.moveTo(0, -150); g.lineTo(70, -250); g.stroke();
    g.fillStyle = '#7A5A2E'; g.fill(D.poly([[30, -250], [110, -290], [140, -220], [60, -190]])); g.fillStyle = '#f0d89a'; g.fill(D.poly([[60, -190], [140, -220], [150, -200], [66, -172]])); }); c.restore(); };
// 抽屉柜：D.drawer(c,x,y,w,h,{open 0..1 中间一格拉出, items 'papers'|'key'|'watch'|null})  (x,y) 左上角
D.drawer = (c, x, y, w, h, o = {}) => { const q = D.ease(o.open ?? 0), n = 3, dh = h / n;
  PK = `drawer_${w}_${h}_${Math.round(q * 20)}_${o.items}`; D.paint(c, [x - 30, y - 20, w + 60, h + 40 + q * 200], g => { g.fillStyle = '#43372a'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,230,180,.12)'; g.fillRect(x, y, w, 10);
    for (let i = 0; i < n; i++) { const yy = y + i * dh, mid = i === 1, out = mid ? q * 150 : 0;
      if (mid && q > 0.02) { g.fillStyle = '#120c07'; g.fillRect(x + 14, yy + 12, w - 28, dh - 24); g.fillStyle = '#2a2119'; g.fill(D.poly([[x + 14, yy + dh - 12], [x + w - 14, yy + dh - 12], [x + w - 14 + 40 * q, yy + dh - 12 + out], [x + 14 - 40 * q, yy + dh - 12 + out]]));
        if (o.items === 'papers') for (let k = 0; k < 4; k++) { g.save(); g.translate(x + w / 2 + (k - 1.5) * 50, yy + dh * 0.5 + out * 0.6); g.rotate((k - 1.5) * 0.12); g.fillStyle = k % 2 ? '#e4dcc6' : '#cfc6b0'; g.fillRect(-50, -70, 100, 130); g.restore(); } }
      g.fillStyle = '#6b5a42'; g.fillRect(x + 14 - 40 * (mid ? q : 0), yy + 12 + out, w - 28 + 80 * (mid ? q : 0), dh - 24); g.strokeStyle = 'rgba(20,12,4,.5)'; g.lineWidth = 4; g.strokeRect(x + 28 - 40 * (mid ? q : 0), yy + 26 + out, w - 56 + 80 * (mid ? q : 0), dh - 52);
      g.fillStyle = ringGrad(g, 40); g.beginPath(); g.roundRect(x + w / 2 - 44, yy + dh / 2 - 9 + out, 88, 18, 8); g.fill(); } }); };
// 钥匙：D.key(c,x,y,o)：(x,y) 钥匙环中心。o { s(1), rot(朝向，0＝钥匙杆朝右), tag 吊牌文字(≥52px 小牌，缺省无), hot 证物红线绳, alpha }
D.key = (c, x, y, o = {}) => { const s = o.s || 1; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s); sink(c, 90, 30, 160, 40, 0.5, '8,4,0');
  c.fillStyle = ringGrad(c, 80); c.beginPath(); c.arc(0, 0, 54, 0, TAU); c.arc(0, 0, 30, 0, TAU, true); c.fill('evenodd'); c.fillRect(48, -14, 230, 28);
  c.beginPath(); c.moveTo(214, 14); c.lineTo(214, 62); c.lineTo(244, 62); c.lineTo(244, 14); c.moveTo(254, 14); c.lineTo(254, 44); c.lineTo(274, 44); c.lineTo(274, 14); c.fill();
  c.strokeStyle = 'rgba(255,240,200,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(56, -8); c.lineTo(270, -8); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(0, 0, 54, 0.3, Math.PI * 0.9); c.stroke();
  if (o.tag) { c.strokeStyle = o.hot ? C.shoe : C.ash; c.lineWidth = 4; c.beginPath(); c.moveTo(-40, -30); c.quadraticCurveTo(-90, -80, -140, -40); c.stroke(); c.save(); c.translate(-150, -40); c.rotate(-0.3); D.tag(c, o.tag, 0, 0, { size: 52, hot: o.hot, align: 'left', scale: 0.9 }); c.restore(); }
  c.restore(); };
// 门锁：D.lock(c,x,y,s,{locked, bolt 0..1, chain})  (x,y) 锁板中心；s 缩放。locked 时锁舌伸出
D.lock = (c, x, y, s = 1, o = {}) => { const lk = o.bolt ?? (o.locked === false ? 0 : 1); c.save(); c.translate(x, y); c.scale(s, s); sink(c, 10, 18, 120, 190, 0.5, '8,4,0');
  c.fillStyle = ringGrad(c, 100); c.beginPath(); c.roundRect(-70, -150, 140, 300, 16); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 4; c.stroke(); c.strokeStyle = 'rgba(255,240,200,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-60, -140); c.lineTo(-60, 130); c.stroke();
  c.fillStyle = '#2a2119'; c.beginPath(); c.arc(0, -50, 28, 0, TAU); c.fill(); c.fillRect(-8, -50, 16, 52); c.fillStyle = '#4a3a28'; c.beginPath(); c.arc(0, 90, 30, 0, TAU); c.fill(); c.fillStyle = ringGrad(c, 40); c.fillRect(-9, 66, 18, 54);
  c.fillStyle = ringGrad(c, 60); c.fillRect(-70 - 150 * lk, 50, 150 * lk + 4, 36); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-70 - 150 * lk, 78, 150 * lk, 8);
  if (o.chain) { c.strokeStyle = C.goldD; c.lineWidth = 8; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-70 - 12 - i * 22, 120, 14, 9, 0, 0, TAU); c.stroke(); } }
  c.restore(); };
// 门：D.door(c,x,y,w,h,{open 0..1 虚掩缝, locked, light 缝里透光(默认 true)})  (x,y) 左上角；门板朝外开，缝里透黄光
D.door = (c, x, y, w, h, o = {}) => { const q = D.ease(o.open ?? 0), gap = q * w * 0.35;
  if (q > 0.01) { c.fillStyle = '#120c07'; c.fillRect(x, y, w, h); if (o.light !== false) { c.save(); c.globalCompositeOperation = 'screen'; const lg = c.createLinearGradient(x, 0, x + gap, 0); lg.addColorStop(0, 'rgba(236,190,100,.8)'); lg.addColorStop(1, 'rgba(236,190,100,0)'); c.fillStyle = lg; c.fillRect(x, y, gap + 60, h); c.restore(); } }
  PK = `door_${w}_${h}_${Math.round(q * 20)}`; D.paint(c, [x - 40, y - 40, w + 80, h + 80], g => { g.fillStyle = '#2a2119'; g.fillRect(x - 28, y - 28, w + 56, h + 28); const dw = w - gap, dg = g.createLinearGradient(x + gap, 0, x + w, 0); dg.addColorStop(0, '#4a3a28'); dg.addColorStop(1, '#6b5a42'); g.fillStyle = dg;
    g.fill(D.poly([[x + gap, y + q * 16], [x + w, y], [x + w, y + h], [x + gap, y + h - q * 16]])); g.strokeStyle = 'rgba(20,12,4,.5)'; g.lineWidth = 5;
    for (const [fx, fy, fw, fh] of [[0.14, 0.06, 0.72, 0.38], [0.14, 0.52, 0.72, 0.4]]) g.strokeRect(x + gap + dw * fx, y + h * fy, dw * fw, h * fh);
    g.fillStyle = ringGrad(g, 40); g.beginPath(); g.arc(x + w - 70, y + h * 0.5, 22, 0, TAU); g.fill(); }); if (o.locked) D.lock(c, x + w - 70, y + h * 0.5 - 130, 0.38, { locked: true }); };
// 证物袋：D.evidenceBag(c,x,y,w,h,o)：(x,y) 袋心。o { rot, label（贴纸字，默认「证物」，≥52px）, item 'shoe'|'key'|'watch'|'paper'|函数(c,w,h), hot（红封条，默认 true）, alpha }
D.evidenceBag = (c, x, y, w = 360, h = 480, o = {}) => { c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); sink(c, 20, h / 2 - 6, w * 0.7, 30, 0.5, '8,4,0');
  c.fillStyle = 'rgba(205,215,220,.2)'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 12); c.fill();
  c.save(); c.translate(0, -40); const it = o.item; if (typeof it === 'function') it(c, w, h); else if (it === 'shoe') D.shoe(c, 0, 90, { L: w * 0.72, rot: -0.1, view: 'side', shadow: false }); else if (it === 'key') D.key(c, -w * 0.28, 40, { s: 0.7, rot: 0.2 }); else if (it === 'watch') D.pocketWatch(c, 0, 40, w * 0.22, { time: o.time, chainTo: [w * 0.3, h * 0.28] });
  else if (it === 'paper') { c.rotate(0.05); c.fillStyle = '#e4dcc6'; c.fillRect(-w * 0.3, -h * 0.15, w * 0.6, h * 0.42); c.fillStyle = 'rgba(60,44,28,.5)'; for (let i = 0; i < 5; i++) c.fillRect(-w * 0.24, -h * 0.08 + i * 40, w * (0.34 + U.hash(i, 3) * 0.2), 8); } c.restore();
  const sh = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(255,255,255,.08)'); sh.addColorStop(1, 'rgba(255,255,255,.0)'); c.fillStyle = sh; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 12); c.fill();
  c.strokeStyle = 'rgba(235,242,245,.65)'; c.lineWidth = 4; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 12); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-w / 2 + 20, h / 2 - 90); c.quadraticCurveTo(-w / 4, h / 2 - 120, -w / 8, h / 2 - 60); c.stroke();
  c.fillStyle = '#d3d8da'; c.fillRect(-w / 2, -h / 2, w, 70); c.fillStyle = (o.hot ?? true) ? C.shoe : C.umber; c.fillRect(-w / 2, -h / 2 + 26, w, 18); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.strokeRect(-w / 2, -h / 2, w, 70);
  const lw = Math.min(w - 40, 300), lh = 90; c.fillStyle = '#efe9d6'; c.fillRect(-lw / 2, h / 2 - lh - 28, lw, lh); c.strokeStyle = C.umber; c.lineWidth = 3; c.strokeRect(-lw / 2 + 6, h / 2 - lh - 22, lw - 12, lh - 12);
  D.text(c, o.label ?? '证物', 0, h / 2 - lh / 2 - 26, { size: 52, fam: 'PuHui-Heavy', col: C.dark, maxW: lw - 30 }); c.restore(); };
// 监控方块：D.cctv(c,x,y,w,h,o)：(x,y) 左上角。o { cells 1|2|4, t, time '02:11:34'（时间戳，默认随 t 走）, fn(c,i,x,y,w,h) 自定义画面, hot 第几格带红点（鞋）, alpha }
D.cctv = (c, x, y, w, h, o = {}) => { const n = o.cells || 1, cols = n === 1 ? 1 : 2, rows = n === 4 ? 2 : 1, t = o.t || 0, pad = 18, cw = (w - pad * (cols + 1)) / cols, ch = (h - pad * (rows + 1)) / rows;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = 'rgba(12,8,4,.55)'; c.fillRect(x + 14, y + 16, w, h); c.fillStyle = '#16191c'; c.fillRect(x, y, w, h); c.strokeStyle = '#3a454c'; c.lineWidth = 4; c.strokeRect(x + 4, y + 4, w - 8, h - 8);
  const scan = D.once('ren_scan', () => { const s = P.canvas(8, 6), g = s.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 4, 8, 2); return c.createPattern(s, 'repeat'); });
  for (let i = 0; i < n; i++) { const cx = x + pad + (i % cols) * (cw + pad), cy = y + pad + Math.floor(i / cols) * (ch + pad); c.save(); c.beginPath(); c.rect(cx, cy, cw, ch); c.clip();
    if (o.fn) o.fn(c, i, cx, cy, cw, ch); else { const bg = c.createLinearGradient(0, cy, 0, cy + ch); bg.addColorStop(0, '#59646b'); bg.addColorStop(1, '#2f383d'); c.fillStyle = bg; c.fillRect(cx, cy, cw, ch);
      c.strokeStyle = 'rgba(200,215,220,.25)'; c.lineWidth = 2; const vy = cy + ch * 0.4; for (let k = -5; k <= 5; k++) { c.beginPath(); c.moveTo(cx + cw / 2, vy); c.lineTo(cx + cw / 2 + k * cw * 0.35, cy + ch); c.stroke(); } for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(cx, vy + (ch * 0.6) * k * k / 25); c.lineTo(cx + cw, vy + (ch * 0.6) * k * k / 25); c.stroke(); }
      const wx = cx + ((t * 40 + i * 120) % (cw + 80)) - 40, wy = cy + ch * 0.82, sc = ch / 520; c.fillStyle = '#12161a'; c.beginPath(); c.roundRect(wx - 34 * sc, wy - 190 * sc, 68 * sc, 150 * sc, 24 * sc); c.fill(); c.beginPath(); c.arc(wx, wy - 214 * sc, 24 * sc, 0, TAU); c.fill(); c.fillRect(wx - 26 * sc, wy - 50 * sc, 20 * sc, 50 * sc); c.fillRect(wx + 6 * sc, wy - 50 * sc, 20 * sc, 50 * sc);
      if (o.hot === i) { c.fillStyle = C.shoe; c.fillRect(wx - 30 * sc, wy - 8 * sc, 30 * sc, 10 * sc); } }
    c.fillStyle = scan; c.fillRect(cx, cy, cw, ch); c.fillStyle = 'rgba(200,220,230,.07)'; c.fillRect(cx, cy + ((t * 90 + i * 70) % ch), cw, 28); c.restore();
    c.strokeStyle = '#0a0d0f'; c.lineWidth = 3; c.strokeRect(cx, cy, cw, ch);
    c.fillStyle = (Math.floor(t * 1.5) % 2 === 0 || true) ? C.shoe : 'transparent'; c.beginPath(); c.arc(cx + 30, cy + 30, 10, 0, TAU); c.fill();
    const ts = o.time || `02:${String(Math.floor(11 + t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`; D.text(c, ts, cx + cw - 16, cy + ch - 28, { size: n === 1 ? 52 : 44, fam: 'PuHui-Bold', col: '#d9e4e8', align: 'right' }); D.text(c, 'CAM ' + (i + 1), cx + 56, cy + 30, { size: 44, fam: 'PuHui-Bold', col: '#d9e4e8', align: 'left' }); }
  c.restore(); };

// ---------- 时间线（地面上渐远的格线） ----------
// D.timeline(c,o)：消失点 (vx,vy)，近端 y=yn 宽 wn。o { vx(540), vy(700), yn(1300), wn(900), n 格线数(14), p 已走过的进度 0..1（近→远亮起金色）, marks [{u 0..1, label, hot}]（u＝离近端的位置，label 用 ≥52px 标签板，建议同屏≤3 个）, now 当前点 u, alpha }
//   返回 { pt(u) → [x,y,scale] }
D.timeline = (c, o = {}) => { const vx = o.vx ?? 540, vy = o.vy ?? 700, yn = o.yn ?? 1300, wn = o.wn ?? 900, n = o.n ?? 14, K0 = 9, yy = u => vy + (yn - vy) / (1 + u * K0), sc = u => (yy(u) - vy) / (yn - vy), pt = u => [vx, yy(u), sc(u)];
  c.save(); c.globalAlpha *= o.alpha ?? 1; const pu = clamp(o.p ?? 0);
  c.fillStyle = 'rgba(20,14,8,.5)'; c.beginPath(); c.moveTo(vx - 4, vy); c.lineTo(vx + 4, vy); c.lineTo(vx + wn / 2, yn); c.lineTo(vx - wn / 2, yn); c.closePath(); c.fill();
  ((g) => { for (const sd of [-1, 1]) { g.strokeStyle = C.ash; g.lineWidth = 6; g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + sd * wn / 2, yn); g.stroke(); }
    for (let i = 0; i <= n; i++) { const u = i / n, y = yy(u), s = sc(u), hw = wn / 2 * s, on = u <= pu; g.strokeStyle = on ? C.gold : mixc(C.ash, '#2a2119', clamp(u * 0.7)); g.lineWidth = Math.max(2, 9 * s); g.beginPath(); g.moveTo(vx - hw, y); g.lineTo(vx + hw, y); g.stroke(); }
    if (pu > 0) { const y1 = yy(pu); g.fillStyle = 'rgba(216,163,62,.2)'; g.beginPath(); g.moveTo(vx - wn / 2 * sc(pu), y1); g.lineTo(vx + wn / 2 * sc(pu), y1); g.lineTo(vx + wn / 2, yn); g.lineTo(vx - wn / 2, yn); g.closePath(); g.fill(); } })(c);
  const mk = (u, hot) => { const [x, y, s] = pt(u), r = Math.max(8, 34 * s); c.fillStyle = hot ? C.shoe : C.gold; c.strokeStyle = C.dark; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.8, y); c.closePath(); c.fill(); c.stroke(); return [x, y, s]; };
  (o.marks || []).forEach((m, i) => { const [x, y] = mk(m.u, m.hot); if (m.label) D.tag(c, m.label, x + (i % 2 ? -40 : 40) * 1, y - 62, { size: 52, hot: m.hot, align: i % 2 ? undefined : 'left', scale: 1 }); });
  if (o.now != null) { const [x, y, s] = pt(o.now); c.fillStyle = C.ash; c.strokeStyle = C.gold; c.lineWidth = 6; c.beginPath(); c.arc(x, y - 16, Math.max(12, 30 * s), 0, TAU); c.fill(); c.stroke(); }
  c.restore(); return { pt }; };

// ---------- 纸条 / 登记簿 / 示意图板 ----------
const tornPath = (g, w, h, seed) => { const r = U.rng(seed * 5 + 1), pts = []; const nx = 12, ny = 8; for (let i = 0; i <= nx; i++) pts.push([-w / 2 + w * i / nx, -h / 2 + (r() - 0.5) * 7]); for (let j = 1; j <= ny; j++) pts.push([w / 2 + (r() - 0.5) * 5, -h / 2 + h * j / ny]); for (let i = nx - 1; i >= 0; i--) pts.push([-w / 2 + w * i / nx, h / 2 + (r() - 0.5) * 7]); for (let j = ny - 1; j > 0; j--) pts.push([-w / 2 + (r() - 0.5) * 5, -h / 2 + h * j / ny]); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
// 纸条：D.note(c,x,y,w,h,o)：(x,y) 纸心。o { lines:[字…]（每行 ≥44px，自动缩进 maxW）, size(52), rot, tape true, hot 末行红线, seed, alpha, scale, fill }
D.note = (c, x, y, w, h, o = {}) => { c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); if (o.scale) c.scale(o.scale, o.scale);
  tornPath(c, w + 12, h + 12, o.seed || 1); c.fillStyle = 'rgba(8,4,0,.45)'; c.save(); c.translate(10, 14); c.fill(); c.restore(); tornPath(c, w, h, o.seed || 1); c.fillStyle = o.fill || '#e4dcc6'; c.fill();
  const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,250,230,.35)'); g.addColorStop(1, 'rgba(120,90,40,.22)'); c.fillStyle = g; c.fill();
  const L = o.lines || [], sz = Math.max(44, o.size || 52), lh = sz * 1.5, y0 = -(L.length - 1) * lh / 2; L.forEach((ln, i) => D.text(c, ln, 0, y0 + i * lh, { size: sz, fam: 'PuHui-Heavy', col: o.hot && i === L.length - 1 ? C.shoe : C.dark, maxW: w - 60 }));
  if (o.hot && L.length) { c.strokeStyle = C.shoe; c.lineWidth = 5; c.beginPath(); c.moveTo(-w * 0.34, y0 + (L.length - 1) * lh + sz * 0.62); c.quadraticCurveTo(0, y0 + (L.length - 1) * lh + sz * 0.72, w * 0.34, y0 + (L.length - 1) * lh + sz * 0.6); c.stroke(); }
  if (o.tape !== false) { c.save(); c.translate(0, -h / 2 + 4); c.rotate(0.05); c.fillStyle = 'rgba(216,196,140,.7)'; c.fillRect(-60, -18, 120, 40); c.restore(); } c.restore(); };
// 登记簿：D.ledger(c,x,y,w,h,o)：(x,y) 书心，摊开两页。o { title（左页顶，≥52px 粗体，默认「登记」）, rows [[左列,右列]…]（最多 5 行，字 ≥44px）, hi 高亮行（红线圈住）, rot, alpha }
D.ledger = (c, x, y, w, h, o = {}) => { c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); sink(c, 10, h / 2 - 10, w * 0.62, 36, 0.6, '8,4,0');
  c.fillStyle = '#2a2119'; c.fillRect(-w / 2 - 14, -h / 2 - 10, w + 28, h + 24); for (const sd of [-1, 1]) { const pg = c.createLinearGradient(sd * w / 2, 0, 0, 0); pg.addColorStop(0, '#d9d0b6'); pg.addColorStop(0.85, '#e8e0c8'); pg.addColorStop(1, '#a89c80'); c.fillStyle = pg; c.fillRect(sd < 0 ? -w / 2 : 0, -h / 2, w / 2, h); }
  c.fillStyle = 'rgba(40,28,14,.35)'; c.fillRect(-8, -h / 2, 16, h); const rows = (o.rows || []).slice(0, 5), sz = 46, top = -h / 2 + 150, rh = Math.min(100, (h - 220) / Math.max(rows.length, 1));
  c.strokeStyle = 'rgba(60,44,28,.35)'; c.lineWidth = 2; for (let i = 0; i <= 5; i++) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 30, top + i * rh - rh / 2 + 10); c.lineTo(sd * (w / 2 - 28), top + i * rh - rh / 2 + 10); c.stroke(); }
  c.strokeStyle = 'rgba(122,70,50,.5)'; c.beginPath(); c.moveTo(-w / 2 + 120, -h / 2 + 20); c.lineTo(-w / 2 + 120, h / 2 - 20); c.stroke();
  D.text(c, o.title ?? '登记', -w / 4, -h / 2 + 80, { size: 56, fam: 'PuHui-Black', col: C.dark, maxW: w / 2 - 70 });
  rows.forEach((r, i) => { const yy = top + i * rh; D.text(c, r[0] || '', -w / 4 + 30, yy, { size: sz, fam: 'PuHui-Bold', col: C.dark, maxW: w / 2 - 190 }); D.text(c, r[1] || '', w / 4, yy, { size: sz, fam: 'PuHui-Bold', col: i === o.hi ? C.shoe : C.dark, maxW: w / 2 - 70 });
    if (i === o.hi) { c.strokeStyle = C.shoe; c.lineWidth = 5; c.beginPath(); c.ellipse(0, yy, w / 2 - 50, rh * 0.5, -0.01, 0, TAU); c.stroke(); } });
  c.restore(); };
// 示意图板（米黄纸面，深褐框，自发光）：D.board(c,x,y,w,h,o,fn)：o { alpha, scale }；fn(c) 内容（屏幕坐标）
D.board = (c, x, y, w, h, o = {}, fn) => { const k = o.scale ?? 1; if (k <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x + w / 2, y + h / 2); c.scale(k, k); c.translate(-x - w / 2, -y - h / 2);
  c.fillStyle = 'rgba(8,4,0,.5)'; c.fillRect(x + 14, y + 16, w, h); c.fillStyle = C.dark; c.fillRect(x, y, w, h); c.fillStyle = '#e4dcc6'; c.fillRect(x + 12, y + 12, w - 24, h - 24);
  c.strokeStyle = 'rgba(122,90,46,.5)'; c.lineWidth = 2; c.strokeRect(x + 22, y + 22, w - 44, h - 44);
  c.save(); c.beginPath(); c.rect(x + 12, y + 12, w - 24, h - 24); c.clip(); if (fn) fn(c); c.restore(); c.restore(); };
D.series = (n, seed = 1, o = {}) => { const { trend = 0.4, vol = 0.1 } = o, r = U.rng(seed * 977 + 13); let v = o.start ?? (0.5 - trend / 2); const a = []; for (let i = 0; i < n; i++) { a.push(clamp(v, 0.03, 0.97)); v += trend / (n - 1) + (r() - 0.5) * vol; } return a; };
D.mapPts = (vals, x, y, w, h) => vals.map((v, i) => [x + w * i / Math.max(1, vals.length - 1), y + h * (1 - v)]);
D.shiyi = (c, x, y) => D.tag(c, '示意', x, y, { size: 52, fill: C.gold, align: 'left' });
// 折线：D.line(c,x,y,w,h,vals,o)：在 D.board 里用。vals 0..1；o { p 画到哪, hot 赭红, col, lw, area, grid, dot, note 画「示意」(默认 true) }。返回笔尖 [x,y]
D.line = (c, x, y, w, h, vals, o = {}) => { const pts = D.mapPts(vals, x, y, w, h), p = clamp(o.p ?? 1), col = o.col || (o.hot || o.down ? C.shoe : C.dark);
  if (o.grid !== false) { c.strokeStyle = 'rgba(80,60,30,.22)'; c.lineWidth = 3; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y + h * k / 3); c.lineTo(x + w, y + h * k / 3); c.stroke(); } }
  c.strokeStyle = C.umber; c.lineWidth = 6; c.lineCap = 'square'; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x, y + h + 3); c.lineTo(x + w + 10, y + h + 3); c.stroke();
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const want = L[L.length - 1] * p, q = [pts[0]];
  for (let i = 1; i < pts.length; i++) { if (L[i] <= want) q.push(pts[i]); else { const f = (want - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); q.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
  if (o.area && q.length > 1) { c.save(); c.globalAlpha *= 0.2; c.fillStyle = col; c.fill(D.poly([...q, [q[q.length - 1][0], y + h], [q[0][0], y + h]])); c.restore(); }
  c.strokeStyle = col; c.lineWidth = o.lw || 9; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(D.poly(q, false)); const e = q[q.length - 1];
  if (o.dot !== false && q.length > 1) { c.fillStyle = '#e4dcc6'; c.beginPath(); c.arc(e[0], e[1], 15, 0, TAU); c.fill(); c.strokeStyle = col; c.lineWidth = 7; c.stroke(); }
  if (o.note !== false) D.shiyi(c, x + 10, y + h + 56); return e; };
// 柱：D.bars(c,x,y,w,h,vals,o)：(x,y) 左上角。o { p 生长, hi 赭红柱序号, gap, labels[]（≥52px，字少用）, note }
D.bars = (c, x, y, w, h, vals, o = {}) => { const n = vals.length, gap = o.gap ?? 22, bw = (w - gap * (n - 1)) / n, p = o.p ?? 1, tops = [];
  vals.forEach((v, i) => { const g = D.ease(clamp(p * (1 + 0.5 * (n - 1) / n) - i * 0.5 / n)), bh = Math.max(0, h * v * g), bx = x + i * (bw + gap); c.fillStyle = i === o.hi ? C.shoe : (i % 2 ? C.blue : C.umber); c.fillRect(bx, y + h - bh, bw, bh);
    c.fillStyle = 'rgba(20,12,4,.2)'; c.fillRect(bx + bw * 0.62, y + h - bh, bw * 0.38, bh); if (o.labels && o.labels[i]) D.text(c, o.labels[i], bx + bw / 2, y + h + 50, { size: 52, fam: 'PuHui-Heavy', col: C.dark, maxW: bw + gap }); tops.push([bx + bw / 2, y + h - bh]); });
  c.fillStyle = C.umber; c.fillRect(x - 12, y + h, w + 24, 6); if (o.note !== false) D.shiyi(c, x + 6, y - 40); return tops; };
})();

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 四种底轮换（街/室内/窗框/夜街）。酒红换成深褐牌＋金边：「第 N 章」＋章名逐字打出；地面一条进度线 N 站，贯穿物（鞋）走到本站，
// 且鞋的朝向随章数「摆正」：第 1 章最歪，末章摆正。换书可改 D.cardToken。
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.CARD_KINDS = [{ kind: 'street' }, { kind: 'room' }, { kind: 'window' }, { kind: 'night' }];
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking, arriveAt, o) => { const N = Math.max(2, o && o.N || 2), n = o && o.n || 1, wrong = 1 - (n - 1) / (N - 1);
  D.shoe(c, x, y + 40, { L: 150, view: 'top', rot: -0.15 + wrong * 1.9 + (walking ? Math.sin(lt * 9) * 0.25 : 0), persp: 1, frost: 0.5 }); });
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const k = D.CARD_KINDS[(n - 1) % D.CARD_KINDS.length];
  D.bg(c, t, { ...k, phase: n });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 110, x1 = 920, y = 1230, X = i => lerp(x0, x1, i / (N - 1));
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  c.fillStyle = 'rgba(20,12,6,.45)'; c.fillRect(x0 - 50, y - 70, x1 - x0 + 100, 110);
  c.strokeStyle = 'rgba(8,4,0,.6)'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, y + 6); c.lineTo(x1 + 20, y + 6); c.stroke(); c.strokeStyle = C.ash; c.lineWidth = 6; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y); c.stroke();
  c.strokeStyle = C.gold; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(Math.max(x0 - 20, lerp(from, done, q)), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? D.pop(lt, walkEnd, 0.45) : 1, r = cur ? 18 * Math.max(0.6, pp) : 9; c.fillStyle = past ? C.gold : cur ? C.shoe : C.ash; c.beginPath(); c.arc(X(i), y, r, 0, TAU); c.fill(); if (cur) { c.strokeStyle = C.ash; c.lineWidth = 4; c.stroke(); } }
  const tx = lerp(from, done, q), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 30 : -Math.max(0, 1 - (lt - walkEnd) * 4) * 12; D.cardToken(c, tx, y - 70 + hop, lt, t, lt < walkEnd, walkEnd, { ...o, n, N });
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 108 : all > 6 ? 104 : 128;
  const s1 = D.ease(D.at(lt, 0.08, 0.4)); if (s1 > 0) { c.save(); c.globalAlpha *= s1; c.translate(-(1 - s1) * 160, 0); D.title(c, `第 ${n} 章`, 540, 270, { size: 132, w: 620, h: 190, col: C.gold }); c.restore(); }
  const s2 = D.ease(D.at(lt, 0.4, 0.4)); if (s2 > 0) { const bh = lines.length > 1 ? 330 : 220, by = 410; c.save(); c.globalAlpha *= s2; c.translate((1 - s2) * 160, 0);
    c.fillStyle = 'rgba(12,8,4,.55)'; c.fillRect(70 + 12, by + 14, 940, bh); c.fillStyle = C.paper; c.fillRect(70, by, 940, bh); c.strokeStyle = C.umber; c.lineWidth = 3; c.strokeRect(82, by + 12, 916, bh - 24);
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) D.text(c, a.slice(0, kk).join(''), 540, by + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.2 + 3, { size, fam: 'PuHui-Black', maxW: 860, col: C.dark }); }); c.restore(); }
  D.finish(c, { night: k.kind === 'night', ...o });
};
})();
// 字幕（assemble 生成的 subs.js 调它）：深褐底板＋烟灰字＋旧金硬投影，字幕带 y≈1480，让开视频号底栏
(() => { const D = K, C = D.C;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = C.gold; c.fillRect(x - w / 2 + 7, y - h / 2 + 8, w, h);
  c.fillStyle = 'rgba(30,22,15,.95)'; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = C.ash; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
