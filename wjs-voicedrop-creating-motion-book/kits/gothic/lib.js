// 画风套件 gothic（来自《神药是怎样炼成的》）：竖屏 1080×1920，哥特泥金手抄本。导出 window.K（章节代码里写 const D = K）。
// 规矩：羊皮纸底＋金箔（纹理全片只算一次，所有镜头共享）＋粗墨线 #2b1a12＋朱红/群青/粉/绿/金平涂色板；
//       渐变只用于金属质感（金箔、光环、金球、高光扫过），其余一律平涂；人物无脸（袍服剪影＋光环＋道具）；
//       贯穿物＝红白胶囊药丸（K.pill，章节卡上的主物 K.cardToken）；字用霞鹜文楷（引擎自带，OFL），描墨边＋朱红填色＝朱批。
//       所有随机走种子（U.hash / U.rng），同一 t 画同一帧。环境层：金星闪烁、彩窗微亮、光环慢转；主体落定即停。
// 性能：重的静态层（金箔、羊皮纸、背景变体、漏斗、金面板）一律 P.cached 成离屏图，每帧只 drawImage；逐帧只画动的东西。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 的回弹起步段会让「r - 线宽」之类算成负数，canvas 遇负半径直接抛错（30fps 才撞上，10fps 冒烟漏过）。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const INK = K.INK = '#2b1a12';
const C = K.C = {
  parch: '#ecdfc0', parchDk: '#c9ae80', parch2: '#e3d2a8', ink: INK, inkL: '#6b4a38',
  gold: '#d9a63a', goldHi: '#f8de86', goldLo: '#9c6a1a',
  red: '#c3262e', redDk: '#7e1318', blue: '#24449e', blueDk: '#16296b', pink: '#e7a3aa', green: '#55a03c', greenDk: '#2f6a22',
  white: '#f8f2e2', cream: '#f6eedb', skin: '#f5dcc2', skinDk: '#d9b08c', ash: '#a89d8c', orange: '#c8742c', wood: '#8a5a2c', woodDk: '#5e3a18',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.35); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json
const ease = U.ease.inOut;

// ---------- 小工具 ----------
K.poly = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
// 平涂＋墨线（描边在后）
K.paint = (c, p, fill, line = INK, lw = 3.5) => { if (fill) { c.fillStyle = fill; c.fill(p); } if (line && lw) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(p); } };
K.dot = (c, x, y, r, fill, line = INK, lw = 1.5) => { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (line) { c.strokeStyle = line; c.lineWidth = lw; c.stroke(); } };
// 缓存精灵：fn(g) 用世界坐标画，只在第一次执行；之后每帧一次 drawImage。key 必须带上全部影响外观的参数。
K.sprite = (c, key, x0, y0, w, h, fn) => { x0 = Math.floor(x0); y0 = Math.floor(y0); w = Math.ceil(w); h = Math.ceil(h);
  c.drawImage(P.cached('gk_' + key, w, h, g => { g.translate(-x0, -y0); fn(g); }), x0, y0); };
const dsh = (g, a = 0.35, o = 5) => { g.shadowColor = `rgba(70,35,0,${a})`; g.shadowOffsetX = o; g.shadowOffsetY = o * 1.2; };
const noSh = g => { g.shadowColor = 'transparent'; g.shadowOffsetX = g.shadowOffsetY = 0; };
const R_ = s => U.rng(s);
const star4 = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); };
K.star4 = star4;
// 点线装饰带（白点沿折线）
K.band = (g, pts, col, w, dots = true) => {
  g.lineJoin = 'miter'; g.lineCap = 'butt';
  g.strokeStyle = INK; g.lineWidth = w + 6; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
  if (dots) for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 22);
    for (let k = 1; k < n; k++) { const q = k / n; K.dot(g, lerp(a[0], b[0], q), lerp(a[1], b[1], q), 2.6, '#fff', null); } }
};
// 红蓝相间的锯齿檐（朝下三角）／色块带
K.saw = (g, x0, x1, y, h = 20, tw = 38, a = C.blue, b = C.red) => { for (let x = x0, k = 0; x < x1 - 1; x += tw, k++) { const w = Math.min(tw, x1 - x); K.paint(g, K.poly([[x, y], [x + w, y], [x + w / 2, y + h]]), k % 2 ? a : b, INK, 2); } };
K.checker = (g, x0, x1, y, h = 22, tw = 43, a = C.blue, b = C.red) => { for (let x = x0, k = 0; x < x1 - 1; x += tw, k++) { const w = Math.min(tw, x1 - x); g.fillStyle = k % 2 ? a : b; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x, y, w, h); K.dot(g, x + w / 2, y + h / 2, 3, '#fff', null); } };

// ---------- 金箔：纹理只算一次（半分辨率算、放大、上下镜像成可无缝重复的 1080×1040） ----------
K.goldTex = () => P.cached('gk_goldTex', W, 1040, g => {
  const w = 540, h = 260, s = P.canvas(w, h), sg = s.getContext('2d'), img = sg.createImageData(w, h), d = img.data, r = R_(5);
  const lo = P.hex(C.goldLo), mid = P.hex(C.gold), hi = P.hex(C.goldHi);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x * 2, Y = y * 2, big = P.fbm(X * 0.0035, Y * 0.0035 + 7, 3), brush = P.noise(X * 0.004, Y * 0.09) * 0.5 + P.noise(X * 0.012, Y * 0.25) * 0.3;
    const f = clamp(0.54 + big * 0.42 + brush * 0.22 + 0.08 - X / W * 0.1 + (r() - 0.5) * 0.1, 0, 1), c0 = f < 0.5 ? P.mix(lo, mid, f * 2) : P.mix(mid, hi, (f - 0.5) * 2), i = (y * w + x) * 4;
    d[i] = c0[0]; d[i + 1] = c0[1]; d[i + 2] = c0[2]; d[i + 3] = 255;
  }
  sg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(s, 0, 0, W, 520);
  g.save(); g.translate(0, 1040); g.scale(1, -1); g.drawImage(s, 0, 0, W, 520); g.restore();
});
// 金箔填充任意路径（当前变换下）；o.line 墨线（默认墨色，null 不描）、o.shadow 投影
// 性能：画布「图案填充＋阴影」在软件渲染下每次 15ms+，所以这里不用画布阴影——有投影就先用平涂色画一份错位的影子，再无阴影地填金箔
K.gold = (c, path, o = {}) => { const { line = INK, lw = 4, shadow = false } = o; c.save(); if (shadow) dsh(c);
  const sc = c.shadowColor, sx = c.shadowOffsetX, sy = c.shadowOffsetY; noSh(c);
  if (sx || sy) { c.save(); c.translate(sx, sy); c.fillStyle = sc; c.fill(path); c.restore(); }
  c.fillStyle = c.createPattern(K.goldTex(), 'repeat'); c.fill(path); c.restore();
  if (line) { c.save(); c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(path); c.restore(); } };
// 斜向高光扫过（只落在 path 里，即只落在金上）：box 扫过范围 [x0,y0,x1,y1]；每 period 秒扫一次
K.shine = (c, path, t, o = {}) => { const { box = [0, 0, W, H], period = 3.6, delay = 0, a = 0.8, w = 150, slant = 0.45, sweep = 0.5 } = o;
  const u = (((t - delay) % period) + period) % period / period / sweep; if (u >= 1) return;
  const [x0, y0, x1, y1] = box, xc = lerp(x0 - w, x1 + w, u), yc = (y0 + y1) / 2, sl = (y1 - y0) / 2 * slant;
  c.save(); c.clip(path); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  const g = c.createLinearGradient(xc - w, yc, xc + w, yc); g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(0.45, 'rgba(255,236,170,.55)'); g.addColorStop(0.5, 'rgba(255,252,230,.9)'); g.addColorStop(0.55, 'rgba(255,236,170,.55)'); g.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(xc - w + sl, y0 - 40); c.lineTo(xc + w + sl, y0 - 40); c.lineTo(xc + w - sl, y1 + 40); c.lineTo(xc - w - sl, y1 + 40); c.closePath(); c.fill(); c.restore(); };
// 四角星闪（金光，叠加混合）
K.glint = (c, x, y, s, a = 1) => { if (s <= 0.02) return; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.fillStyle = '#fff6d0';
  c.beginPath(); c.moveTo(x, y - 22 * s); c.quadraticCurveTo(x, y, x + 22 * s, y); c.quadraticCurveTo(x, y, x, y + 22 * s); c.quadraticCurveTo(x, y, x - 22 * s, y); c.quadraticCurveTo(x, y, x, y - 22 * s); c.fill();
  c.globalAlpha = a * 0.5; c.beginPath(); c.arc(x, y, 7 * s, 0, TAU); c.fill(); c.restore(); };
// 金色球（金属质感径向渐变，缓存成精灵）
K.goldBall = () => P.cached('gk_goldBall', 96, 96, g => { const gr = g.createRadialGradient(34, 32, 4, 48, 48, 44); gr.addColorStop(0, '#fff3b8'); gr.addColorStop(0.35, C.goldHi); gr.addColorStop(0.75, C.gold); gr.addColorStop(1, C.goldLo);
  g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 44, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); });
K.ball = (c, x, y, r) => c.drawImage(K.goldBall(), x - r * 1.09, y - r * 1.09, r * 2.18, r * 2.18);

// ---------- 羊皮纸（边缘老化用噪声压暗，不用渐变）＋纤维＋斑点 ----------
K.paper = () => P.cached('gk_paper', W, H, g => {
  g.fillStyle = C.parch; g.fillRect(0, 0, W, H);
  const w = 135, h = 240, s = P.canvas(w, h), sg = s.getContext('2d'), img = sg.createImageData(w, h), d = img.data, dk = P.hex(C.parchDk);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = P.fbm(x * 0.045 + 3, y * 0.045, 3), e = Math.min(x, w - 1 - x, y, h - 1 - y), edge = clamp(1 - e / 20), a = clamp(0.1 + n * 0.3 + edge * edge * 0.6, 0, 0.8), i = (y * w + x) * 4;
    d[i] = dk[0] - 28; d[i + 1] = dk[1] - 36; d[i + 2] = dk[2] - 40; d[i + 3] = a * 255;
  }
  sg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(s, 0, 0, W, H);
  const r = R_(11);
  for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(120,85,40,${0.05 + r() * 0.07})`; g.lineWidth = 1.2; const x = r() * W, y = r() * H, a = r() * TAU, l = 10 + r() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(140,95,40,${0.05 + r() * 0.08})`; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 5, 0, TAU); g.fill(); }
});

// ---------- 金面板：菱格压花金箔（山墙／矩形／尖拱），缓存 ----------
const panelPath = (x0, y0, x1, y1, kind, apex) => { const cx = (x0 + x1) / 2;
  if (kind === 'gable') return K.poly([[x0, y0 + apex], [cx, y0], [x1, y0 + apex], [x1, y1], [x0, y1]]);
  if (kind === 'arch') { const p = new Path2D(), ah = apex || (x1 - x0) * 0.58; p.moveTo(x0, y1); p.lineTo(x0, y0 + ah); p.quadraticCurveTo(x0, y0 + ah * 0.3, cx, y0); p.quadraticCurveTo(x1, y0 + ah * 0.3, x1, y0 + ah); p.lineTo(x1, y1); p.closePath(); return p; }
  return K.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); };
K.panelPath = panelPath;
// kind: 'gable'|'arch'|'rect'；返回路径（便于 K.shine）。lattice 压花默认开
K.goldPanel = (c, x0, y0, x1, y1, o = {}) => { const { kind = 'rect', apex = 130, lattice = true, s = 46, line = INK, lw = 4 } = o;
  const path = panelPath(x0, y0, x1, y1, kind, apex), key = `gp_${x0}_${y0}_${x1}_${y1}_${kind}_${apex}_${lattice}_${s}_${lw}`;
  K.sprite(c, key, x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16, g => {
    g.save(); g.clip(path); g.fillStyle = g.createPattern(K.goldTex(), 'repeat'); g.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
    if (lattice) { g.lineWidth = 1.6; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, n = Math.ceil(Math.max(x1 - x0, y1 - y0) / s) + 2;
      for (const [col, off] of [['rgba(255,240,180,.55)', 1.2], ['rgba(110,66,10,.55)', 0]]) { g.strokeStyle = col; g.beginPath();
        for (let k = -n; k < n; k++) { const u = k * s; g.moveTo(cx + u - 1200 + off, cy + 1200 + off); g.lineTo(cx + u + 1200 + off, cy - 1200 + off); g.moveTo(cx + u - 1200 + off, cy - 1200 + off); g.lineTo(cx + u + 1200 + off, cy + 1200 + off); } g.stroke(); }
      for (let a = -n; a < n; a++) for (let b = -n; b < n; b++) { const u = (a + 0.5) * s, v = (b + 0.5) * s, x = cx + (u + v) / 2, y = cy + (u - v) / 2;
        if (x < x0 - 4 || x > x1 + 4 || y < y0 - 4 || y > y1 + 4) continue;
        for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) { g.fillStyle = 'rgba(255,245,200,.7)'; g.beginPath(); g.arc(x + dx - 0.6, y + dy - 0.6, 1.9, 0, 7); g.fill(); g.fillStyle = 'rgba(120,70,10,.55)'; g.beginPath(); g.arc(x + dx + 0.7, y + dy + 0.7, 1.5, 0, 7); g.fill(); } } }
    g.restore(); if (line) { g.strokeStyle = line; g.lineWidth = lw; g.lineJoin = 'miter'; g.stroke(path); } });
  return path; };

// ---------- 背景变体 ----------
K.WIN = [110, 430, 970, 686];          // gable 变体里的奶白窗（舞台区）
K.ARCH = [0, 1, 2].map(i => ({ x0: 70 + i * 320, x1: 390 + i * 320, cx: 230 + i * 320, top: 250, bot: 760 }));   // arcade 三个拱的范围
K.TABLE_Y = 1118;                       // desk 变体的桌面线：物体站在这条线上
const finial = (g, x, y) => { g.fillStyle = C.gold; g.strokeStyle = INK; g.lineWidth = 2.5; g.fillRect(x - 4, y - 36, 8, 36); g.strokeRect(x - 4, y - 36, 8, 36); g.fillRect(x - 14, y - 28, 28, 8); g.strokeRect(x - 14, y - 28, 28, 8); };
const miniRose = (g, x, y, k = 1) => { const q = new Path2D(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; q.moveTo(x + Math.cos(a) * 24 * k + 22 * k, y + Math.sin(a) * 24 * k); q.arc(x + Math.cos(a) * 24 * k, y + Math.sin(a) * 24 * k, 22 * k, 0, 7); }
  K.paint(g, q, C.red, INK, 3); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; K.dot(g, x + Math.cos(a) * 24 * k, y + Math.sin(a) * 24 * k, 12 * k, C.blue, INK, 2); } K.dot(g, x, y, 9 * k, C.gold, INK, 2); };
const column = (g, x, y0, y1, w = 34) => { g.fillStyle = C.white; g.fillRect(x - w / 2, y0, w, y1 - y0); g.save(); g.beginPath(); g.rect(x - w / 2, y0, w, y1 - y0); g.clip(); g.strokeStyle = C.blue; g.lineWidth = 6;
  for (let y = y0 - 40; y < y1 + 40; y += 26) { g.beginPath(); g.moveTo(x - w, y + w); g.lineTo(x + w, y - w); g.stroke(); } g.restore(); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(x - w / 2, y0, w, y1 - y0);
  for (const y of [y0, y1 - 14]) { g.fillStyle = C.gold; g.fillRect(x - w / 2 - 8, y, w + 16, 14); g.strokeRect(x - w / 2 - 8, y, w + 16, 14); } };
// 页边框：墨粗线＋朱红细线＋四角金球
K.frame = (g, inset = 26) => { g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset); g.strokeStyle = C.red; g.lineWidth = 2.5; g.strokeRect(inset + 13, inset + 13, W - 2 * inset - 26, H - 2 * inset - 26);
  for (const [x, y] of [[inset, inset], [W - inset, inset], [inset, H - inset], [W - inset, H - inset]]) K.dot(g, x, y, 11, C.gold, INK, 2.5); };
const ROSE = { cx: 540, cy: 640, R: 380 };
const rosePetal = i => { const { cx, cy, R } = ROSE, a0 = i / 12 * TAU - TAU / 4 - TAU / 24, a1 = a0 + TAU / 12, p = new Path2D(); p.moveTo(cx + Math.cos(a0) * 70, cy + Math.sin(a0) * 70); p.arc(cx, cy, R - 24, a0 + 0.02, a1 - 0.02); p.arc(cx, cy, 70, a1 - 0.03, a0 + 0.03, true); p.closePath(); return p; };

const BG_DRAW = {
  gable(g, o) {
    K.goldPanel(g, 60, 205, 1020, 712, { kind: 'gable', apex: 125 });
    K.band(g, [[52, 336], [540, 196], [1028, 336]], C.pink, 30); finial(g, 540, 196); miniRose(g, 540, 268, 0.9);
    if (o.win !== false) { const [x0, y0, x1, y1] = K.WIN; g.save(); dsh(g); K.paint(g, K.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), C.cream, INK, 4); g.restore();
      g.strokeStyle = 'rgba(140,110,70,.5)'; g.lineWidth = 2; g.strokeRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20); K.saw(g, x0 + 10, x1 - 20, y0 + 10, 20, 38); K.checker(g, x0, x1, y1, 22, 43); }
  },
  arcade(g) {
    K.paint(g, K.poly([[50, 232], [1030, 232], [1030, 770], [50, 770]]), C.parch2, INK, 4);
    K.ARCH.forEach((a, i) => { const x0 = a.x0 + 22, x1 = a.x1 - 22, p = panelPath(x0, a.top + 20, x1, a.bot, 'arch', 190);
      K.paint(g, p, [C.cream, C.blue, C.red][i], INK, 5); g.save(); g.clip(p); const r = R_(40 + i);
      if (i === 1) for (let k = 0; k < 22; k++) star4(g, x0 + r() * (x1 - x0), a.top + 60 + r() * 420, 7 + r() * 8, C.gold);
      else if (i === 2) { for (let k = 0; k < 40; k++) K.dot(g, x0 + r() * (x1 - x0), a.top + 80 + r() * 420, 5, C.goldHi, null); }
      else { g.strokeStyle = 'rgba(140,110,70,.35)'; g.lineWidth = 2; for (let y = a.top + 120; y < a.bot; y += 38) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); } }
      g.restore(); g.strokeStyle = C.gold; g.lineWidth = 7; g.stroke(p); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(p); });
    for (let i = 0; i <= 3; i++) column(g, 70 + i * 320, 380, 740, 38);
    K.saw(g, 52, 1030, 232, 22, 40); K.checker(g, 50, 1030, 770, 24, 40);
  },
  page(g) {
    K.paint(g, K.poly([[84, 176], [996, 176], [996, 1340], [84, 1340]]), 'rgba(246,238,219,.5)', INK, 5);
    g.strokeStyle = C.red; g.lineWidth = 2.5; g.strokeRect(100, 192, 880, 1132);
    g.strokeStyle = 'rgba(140,100,60,.3)'; g.lineWidth = 2; for (let y = 262; y < 1310; y += 56) { g.beginPath(); g.moveTo(150, y); g.lineTo(930, y); g.stroke(); }
    g.strokeStyle = C.red; g.lineWidth = 2; for (const x of [140, 940]) { g.beginPath(); g.moveTo(x, 200); g.lineTo(x, 1316); g.stroke(); }
    K.saw(g, 100, 980, 192, 16, 30);
  },
  window(g) {
    const { cx, cy, R } = ROSE; K.goldPanel(g, cx - R - 50, 180, cx + R + 50, 1060, { kind: 'arch', apex: 400 });
    K.paint(g, panelPath(cx - R - 14, 232, cx + R + 14, 1040, 'arch', 380), C.blueDk, INK, 5);
    const cols = [C.red, C.blue, C.green, C.pink, C.orange, C.blue];
    for (let i = 0; i < 12; i++) { K.paint(g, rosePetal(i), cols[i % cols.length], INK, 4); const am = i / 12 * TAU - TAU / 4, x = cx + Math.cos(am) * 215, y = cy + Math.sin(am) * 215; K.dot(g, x, y, 34, C.cream, INK, 3); star4(g, x, y, 22, C.goldHi); }
    g.strokeStyle = C.gold; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R - 24, 0, TAU); g.stroke(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); K.dot(g, cx, cy, 58, C.gold, INK, 4); K.dot(g, cx, cy, 30, C.red, INK, 3);
    for (const sx of [-1, 1]) { const x = cx + sx * 150; K.paint(g, panelPath(x - 70, 1010, x + 70, 1040, 'rect'), null, null, 0); }
  },
  desk(g) {
    K.goldPanel(g, 150, 230, 930, 1130, { kind: 'arch', apex: 330 });
    const inner = panelPath(196, 290, 884, 1130, 'arch', 300); K.paint(g, inner, C.blue, INK, 5);
    g.save(); g.clip(inner); const r = R_(61); for (let k = 0; k < 34; k++) star4(g, 210 + r() * 660, 330 + r() * 740, 6 + r() * 9, C.goldHi);
    g.fillStyle = C.wood; g.fillRect(190, 700, 700, 18); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(190, 700, 700, 18);
    for (let i = 0; i < 8; i++) K.vial(g, 262 + i * 80, 700 - 24 * 0.95, 0.95, K.VIAL_COLS[i % 6], 0, {});
    g.restore();
    K.paint(g, K.poly([[0, 1118], [W, 1118], [W, 1380], [0, 1380]]), C.red, INK, 5);
    g.save(); g.beginPath(); g.rect(0, 1150, W, 230); g.clip(); g.strokeStyle = 'rgba(255,225,150,.75)'; g.lineWidth = 3; for (let x = -40; x < W + 40; x += 54) { g.beginPath(); g.moveTo(x, 1250); g.lineTo(x + 27, 1340); g.lineTo(x + 54, 1250); g.stroke(); } g.restore();
    K.paint(g, K.poly([[-10, 1118], [W + 10, 1118], [W + 10, 1160], [-10, 1160]]), C.wood, INK, 5);
    g.strokeStyle = C.woodDk; g.lineWidth = 2; for (let k = 0; k < 14; k++) { const y = 1128 + (k % 3) * 9; g.beginPath(); g.moveTo(k * 80 + 10, y); g.lineTo(k * 80 + 60, y); g.stroke(); }
    for (let x = -10; x < W; x += 40) K.paint(g, K.poly([[x, 1380], [x + 40, 1380], [x + 20, 1410]]), C.gold, INK, 2);
  },
  plain() {},
};
const STARS = { gable: [[210, 480], [520, 560], [800, 500], [940, 630], [130, 280], [900, 290]], arcade: [[150, 330], [540, 420], [900, 350], [320, 640], [760, 680]], window: [[300, 470], [790, 520], [540, 330], [420, 880], [700, 900]], desk: [[300, 400], [700, 460], [520, 620], [600, 900], [380, 800]], page: [[150, 230], [930, 230], [540, 1290]], plain: [[160, 260], [920, 1250]] };
// K.bg(c, t, o)：o.v = 'gable'(默认)|'arcade'|'page'|'window'|'desk'|'plain'；o.win 仅 gable：是否画奶白窗；o.frame 页边框（默认 plain/page 开）；o.stars 星闪（默认开）；o.seed
K.bg = (c, t, o = {}) => {
  const v = BG_DRAW[o.v || 'gable'] ? (o.v || 'gable') : 'gable', frame = o.frame ?? (v === 'plain' || v === 'page'), win = o.win !== false, seed = o.seed || 0;
  c.drawImage(P.cached(`gk_bg_${v}_${win}_${frame}`, W, H, g => { g.drawImage(K.paper(), 0, 0); BG_DRAW[v](g, { win }); if (frame) K.frame(g); }), 0, 0);   // 纸＋变体合成一张，每帧一次 drawImage
  if (v === 'window') { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { c.globalAlpha = 0.1 + 0.1 * Math.sin(t * 1.6 + i * 1.3 + seed); c.fillStyle = '#ffe9b0'; c.fill(rosePetal(i)); } c.restore(); }   // 彩窗微亮：每瓣错相呼吸
  if (o.stars !== false) STARS[v].forEach(([x, y], k) => K.glint(c, x, y, 0.45 + 0.5 * Math.max(0, Math.sin(t * 2.6 + k * 1.9 + seed)), 0.85));
};
// 变体里的金面板路径（想让高光扫过时：K.shine(c, K.bgGoldPath('gable'), t, { box: [60,205,1020,712] })）
K.bgGoldPath = v => v === 'gable' ? panelPath(60, 205, 1020, 712, 'gable', 125) : v === 'desk' ? panelPath(150, 230, 930, 1130, 'arch', 330) : v === 'window' ? panelPath(ROSE.cx - ROSE.R - 50, 180, ROSE.cx + ROSE.R + 50, 1060, 'arch', 400) : null;

// ---------- 每镜收尾：字幕带压暗 y1380–1560；y>1574 是视频号底栏遮挡区，整条盖成墨褐装订边 ----------
K.finish = c => {
  c.save(); c.fillStyle = 'rgba(43,26,18,.34)'; c.fillRect(0, 1368, W, 206);
  c.fillStyle = C.gold; c.fillRect(0, 1366, W, 4); c.fillRect(0, 1570, W, 4); c.fillStyle = INK; c.fillRect(0, 1370, W, 2); c.fillRect(0, 1568, W, 2);
  c.fillStyle = INK; c.fillRect(0, 1574, W, H - 1574);
  c.fillStyle = C.gold; c.fillRect(0, 1594, W, 3); c.fillStyle = C.red; for (let x = 0; x < W; x += 54) { c.beginPath(); c.moveTo(x, 1574); c.lineTo(x + 27, 1574); c.lineTo(x + 13.5, 1590); c.fill(); }
  c.fillStyle = C.blue; for (let x = 27; x < W; x += 54) { c.beginPath(); c.moveTo(x, 1574); c.lineTo(x + 27, 1574); c.lineTo(x + 13.5, 1590); c.fill(); }
  c.restore(); c.drawImage(P.grain('gk', 0.05, [90, 60, 20], 0.14), 0, 0);
};

// ---------- 文字：霞鹜文楷；朱批＝描墨边＋朱红填色 ----------
const FAM = 'LXGWWenKai-500';
K.text = (c, s, x, y, o = {}) => { const { size = 60, fam = FAM, col = INK, align = 'center', alpha = 1, scale = 1, track = 0, stroke = 0, strokeCol = INK, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = strokeCol; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 牌匾字：奶白底牌＋金双线框＋朱红描墨字
K.plaque = (c, s, x, y, o = {}) => { const { size = 56, scale = 1, alpha = 1, fill = C.cream, col = C.red, stroke = size * 0.06 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${FAM}"`; const w = c.measureText(s).width + size * 1.5, h = size * 1.6;
  c.save(); dsh(c, 0.35, 4); K.paint(c, K.round(-w / 2, -h / 2, w, h, h * 0.2), fill, INK, 4); c.restore(); c.strokeStyle = C.gold; c.lineWidth = 3; c.stroke(K.round(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, h * 0.14));
  [-1, 1].forEach(sd => K.dot(c, sd * (w / 2 - size * 0.4), 0, size * 0.1, C.gold, INK, 2)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = stroke; c.strokeStyle = INK; c.strokeText(s, 0, 2); c.fillStyle = col; c.fillText(s, 0, 2); c.restore(); };
// 朱批字：描墨边朱红填色（默认）；o.plate 垫牌匾；o.col 换填色
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const size = o.size || 84, a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) return K.plaque(c, s, x, y, { ...o, scale: p, alpha: a });
  K.text(c, s, x, y, { size, col: o.col || C.red, stroke: o.stroke ?? size * (size >= 90 ? 0.14 : size >= 60 ? 0.11 : 0.08), scale: p, alpha: a, rot: o.rot || 0, align: o.align, track: o.track }); };
// 引线标签：墨线从锚点画出（锚点金球），末端是奶白飘带标签，字逐个打出
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); K.dot(c, ax, ay, 9, C.gold, INK, 3); c.restore();
  const q = K.pop(lt, at + 0.28, 0.45); if (q <= 0) return; const size = o.size || 50, shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 40));
  c.save(); c.font = `${size}px "${FAM}"`; const w = c.measureText(s).width + size * 1.5, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  c.save(); dsh(c, 0.35, 4); const sw = size * 0.45; K.paint(c, K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - sw, 0], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2 + sw, 0]]), o.fill || C.cream, INK, 4); c.restore();
  c.strokeStyle = o.rule || C.red; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-w / 2 + sw + 6, -h / 2 + 7); c.lineTo(w / 2 - 6, -h / 2 + 7); c.moveTo(-w / 2 + sw + 6, h / 2 - 7); c.lineTo(w / 2 - 6, h / 2 - 7); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.col || INK; c.fillText(shown, 0, 2); c.restore(); };
// 飘带标题（红白飘带）：w 宽；lt/at 给了就弹出
K.banner = (c, s, x, y, o = {}) => { const { w = 780, h = 118, size = 104, lt, at = 0, col = C.red } = o; let sc = 1; if (lt != null) { sc = K.pop(lt, at, 0.5); if (sc <= 0) return; }
  c.save(); c.translate(x, y); c.scale(sc, sc); c.save(); dsh(c, 0.4, 4);
  for (const dir of [-1, 1]) { const x0 = dir * w / 2; K.paint(c, K.poly([[x0, -h / 2 + 22], [x0 + dir * 60, -h / 2 + 22], [x0 + dir * 36, 0], [x0 + dir * 60, h / 2 - 22], [x0, h / 2 - 22]]), C.redDk, INK, 3); }
  K.paint(c, K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]), C.white, INK, 4); c.restore();
  c.strokeStyle = C.red; c.lineWidth = 3; c.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); c.strokeStyle = C.gold; c.lineWidth = 2; c.strokeRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32);
  for (const sx of [-1, 1]) { K.dot(c, sx * (w / 2 - 36), 0, 9, C.gold, INK, 2); K.dot(c, sx * (w / 2 - 36), 0, 3, C.red, null); }
  K.text(c, s, 0, 6, { size, col, stroke: size * 0.065 }); c.restore(); };
// 泥金首字母：金菱格方块＋朱红大字
K.initial = (c, ch, x, y, size = 200, o = {}) => { const { scale = 1, alpha = 1, col = C.red } = o, h = size / 2;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.translate(-x, -y);
  K.goldPanel(c, x - h, y - h, x + h, y + h, { kind: 'rect', s: Math.max(24, size / 4.4), lw: 5 }); c.strokeStyle = C.red; c.lineWidth = 3; c.strokeRect(x - h + 10, y - h + 10, size - 20, size - 20);
  K.text(c, ch, x, y + size * 0.04, { size: size * 0.78, col, stroke: size * 0.06 }); c.restore(); };
// 金色圆章数字（数据）：金边圈＋奶白底＋朱红字（描墨）
K.seal = (c, x, y, r, s, o = {}) => { const { scale = 1, alpha = 1, col = C.red, fill = C.cream } = o; if (scale <= 0) return; const L = [...String(s)].length, size = r * (L <= 1 ? 1.35 : L === 2 ? 1.05 : L === 3 ? 0.78 : 0.6);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.save(); dsh(c, 0.35, r * 0.08); K.gold(c, K.circle(0, 0, r), { lw: r * 0.08 }); c.restore();
  K.dot(c, 0, 0, r * 0.82, fill, INK, r * 0.05); for (let a = 0; a < 16; a++) K.dot(c, Math.cos(a / 16 * TAU) * r * 0.91, Math.sin(a / 16 * TAU) * r * 0.91, r * 0.035, '#fff', null);
  K.text(c, String(s), 0, r * 0.06, { size, col, stroke: size * 0.07 }); c.restore(); };

// ---------- 药丸（贯穿物，红白胶囊）、小瓶、光环 ----------
// (x,y) 中心，rot 弧度，s 比例（1＝全长约 180px）；o.glow 金辉、o.crack 0..1 裂开两半、o.dead 灰
K.pill = (c, x, y, rot = 0, s = 1, o = {}) => { const { glow = 0, crack = 0, alpha = 1, shadow = true, dead = false } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineJoin = 'round';
  if (glow > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.55 * glow; const g = c.createRadialGradient(0, 0, 10, 0, 0, 150); g.addColorStop(0, 'rgba(255,230,140,.9)'); g.addColorStop(1, 'rgba(255,230,140,0)'); c.fillStyle = g; c.fillRect(-160, -160, 320, 320); c.restore(); }
  const L = 62, Rr = 28, cap = sg => { const p = new Path2D(); p.moveTo(0, -Rr); p.lineTo(sg * L, -Rr); p.arc(sg * L, 0, Rr, -Math.PI / 2, Math.PI / 2, sg < 0); p.lineTo(0, Rr); p.closePath(); return p; };
  const a = cap(-1), b = cap(1), cx = crack * 18;
  c.save(); c.translate(-cx, 0); if (shadow) { c.shadowColor = 'rgba(70,35,0,.4)'; c.shadowBlur = 8; c.shadowOffsetY = 6; } c.fillStyle = dead ? C.ash : C.red; c.fill(a); c.shadowColor = 'transparent'; c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke(a);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-L + 8, -Rr + 6, L - 14, 6); c.restore();
  c.save(); c.translate(cx, 0); if (shadow) { c.shadowColor = 'rgba(70,35,0,.4)'; c.shadowBlur = 8; c.shadowOffsetY = 6; } c.fillStyle = dead ? '#ddd3c0' : C.white; c.fill(b); c.shadowColor = 'transparent'; c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke(b);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(14, -Rr + 6, L - 22, 6); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(8, Rr - 12, L - 12, 7); c.restore();
  c.restore(); };
K.cardToken = K.cardToken || ((c, x, y) => K.pill(c, x, y, -0.3, 0.55, { glow: 0.8 }));
K.VIAL_COLS = [C.red, C.blue, C.green, C.pink, C.gold, C.orange];
// 小瓶：o.grey 灰（被筛掉）、o.level 液面 0..1
K.vial = (c, x, y, s, col = C.red, rot = 0, o = {}) => { const { grey = false, level = 1, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineJoin = 'round';
  const body = K.once('vialBody', () => { const b = new Path2D(); b.moveTo(-6, -24); b.lineTo(6, -24); b.lineTo(6, -13); b.quadraticCurveTo(19, -6, 19, 8); b.quadraticCurveTo(19, 24, 0, 24); b.quadraticCurveTo(-19, 24, -19, 8); b.quadraticCurveTo(-19, -6, -6, -13); b.closePath(); return b; });
  c.fillStyle = grey ? '#ddd3c0' : '#fffaf0'; c.fill(body); c.save(); c.clip(body); const top = lerp(26, -2, clamp(level)); c.fillStyle = grey ? C.ash : col; c.fillRect(-22, top, 44, 40); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-22, top, 44, 3); c.restore();
  c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke(body); c.fillStyle = grey ? '#7a6a58' : C.gold; c.fillRect(-8, -31, 16, 8); c.strokeRect(-8, -31, 16, 8); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-13, 3, 3, 12); c.restore(); };
// 光环：金盘＋红内圈＋转动的金光芒；(x,y) 圆心，a 透明度
K.halo = (c, x, y, a, t, o = {}) => { if (a <= 0.01) return; const r = o.r || 104; c.save(); c.globalAlpha *= a;
  c.save(); c.translate(x, y); c.rotate(t * 0.15); for (let k = 0; k < 16; k++) { c.rotate(TAU / 16); c.fillStyle = k % 2 ? 'rgba(248,222,134,.75)' : 'rgba(217,166,58,.65)'; c.beginPath(); c.moveTo(-r * 0.08, -r + 6); c.lineTo(0, -r - r * 0.33 - (k % 2) * r * 0.13); c.lineTo(r * 0.08, -r + 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } c.restore();
  const gr = c.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#fbe9a0'); gr.addColorStop(1, C.gold); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = gr; c.fill(); c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  c.beginPath(); c.arc(x, y, r - r * 0.115, 0, TAU); c.strokeStyle = C.red; c.lineWidth = r * 0.058; c.stroke(); for (let k = 0; k < 40; k++) { const an = k / 40 * TAU; K.dot(c, x + Math.cos(an) * (r * 0.77), y + Math.sin(an) * (r * 0.77), r * 0.03, C.goldLo, null); } c.restore(); };

// ---------- 漏斗（彩玻璃壁＋金筛层）、金筛、沙漏、金币 ----------
// 漏斗几何：cx 中心、rim 沿口 y、neck 颈 y、w0 沿口半宽（默认 450）、wn 颈半宽；返回 { hw(y) } 供小瓶落点计算
K.funnelGeom = (o = {}) => { const { cx = 540, rim = 765, neck = 1070, w0 = 450, wn = 40 } = o; return { cx, rim, neck, hw: y => wn + (w0 - wn) * Math.pow(clamp((neck - y) / (neck - rim), 0, 1.2), 1.2) }; };
// 彩玻璃漏斗：o.layers 筛层 y 数组（默认三层）、o.spout 嘴底 y（≤neck 不画嘴）
K.funnel = (c, o = {}) => { const g0 = K.funnelGeom(o), { cx, rim, neck, hw } = g0, layers = o.layers || [860, 950, 1025], spout = o.spout ?? neck + 48, w0 = o.w0 || 450, wn = o.wn || 40;
  const key = `fun_${cx}_${rim}_${neck}_${w0}_${wn}_${layers.join(',')}_${spout}`;
  K.sprite(c, key, cx - w0 - 80, rim - 60, 2 * w0 + 160, spout - rim + 90, g => {
    const ys = []; for (let y = rim; y <= neck; y += 5) ys.push(y); ys.push(neck);
    const shape = pad => { const p = new Path2D(); ys.forEach((y, i) => { const x = cx - hw(y) - pad; i ? p.lineTo(x, y) : p.moveTo(x, y); }); for (let i = ys.length - 1; i >= 0; i--) p.lineTo(cx + hw(ys[i]) + pad, ys[i]); p.closePath(); return p; };
    g.save(); dsh(g, 0.4, 6); K.paint(g, shape(26), C.blue, INK, 4); g.restore();
    for (const sg of [-1, 1]) for (let y = rim + 12; y < neck - 20; y += 24) K.dot(g, cx + sg * (hw(y) + 14), y, 2.8, '#fff', null);
    const inner = shape(0), ym = (rim + neck) / 2; g.save(); g.clip(inner); g.fillStyle = C.cream; g.fillRect(cx - w0 - 40, rim, 2 * w0 + 80, neck - rim + 10);
    const s = 34; for (let a = -40; a < 60; a++) for (let b = -40; b < 40; b++) { const u = a * s, v = b * s, x = cx + (u + v) / 2, y = ym + (u - v) / 2; if (y < rim || y > neck + 4 || x < cx - w0 || x > cx + w0) continue;
      g.fillStyle = (a + b) % 2 ? 'rgba(195,38,46,.17)' : 'rgba(36,68,158,.15)'; g.fill(K.poly([[x, y - s / 2], [x + s / 2, y], [x, y + s / 2], [x - s / 2, y]])); }
    g.strokeStyle = 'rgba(200,150,50,.55)'; g.lineWidth = 1.6; g.beginPath(); for (let k = -80; k < 120; k++) { const c0 = cx + (k + 0.5) * s; g.moveTo(c0 - 1400, ym + 1400); g.lineTo(c0 + 1400, ym - 1400); g.moveTo(c0 - 1400, ym - 1400); g.lineTo(c0 + 1400, ym + 1400); } g.stroke();
    g.restore(); K.paint(g, inner, null, INK, 4.5);
    layers.forEach(y => { const w = hw(y); g.fillStyle = g.createPattern(K.goldTex(), 'repeat'); g.fillRect(cx - w, y, w * 2, 15); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(cx - w, y, w * 2, 15); g.fillStyle = C.goldHi; g.fillRect(cx - w + 2, y + 2, w * 2 - 4, 3);
      for (let x = cx - w + 14; x < cx + w - 8; x += 17) K.dot(g, x, y + 10, 2.4, INK, null); });
    if (spout > neck) { K.paint(g, K.poly([[cx - wn, neck - 2], [cx + wn, neck - 2], [cx + wn - 8, spout], [cx - wn + 8, spout]]), C.pink, INK, 4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(cx - wn + 12, neck + 4, 7, 40);
      for (const y of [neck + 6, spout - 12]) { g.fillStyle = C.gold; g.fillRect(cx - wn - 6, y, wn * 2 + 12, 12); g.strokeStyle = INK; g.lineWidth = 2.5; g.strokeRect(cx - wn - 6, y, wn * 2 + 12, 12); } }
    const rw = hw(rim) + 30; K.checker(g, cx - rw, cx + rw, rim - 18, 30, 44); g.strokeStyle = INK; g.lineWidth = 3.5; g.strokeRect(cx - rw, rim - 18, rw * 2, 30);
    for (const sg of [-1, 1]) { g.fillStyle = C.gold; g.fillRect(cx + sg * rw - 14, rim - 28, 28, 48); g.strokeStyle = INK; g.lineWidth = 2.5; g.strokeRect(cx + sg * rw - 14, rim - 28, 28, 48); K.dot(g, cx + sg * rw, rim - 36, 9, C.gold, INK, 2.5); } });
  return g0; };
// 金筛（独立件，筛子正面，带柄）：r 半宽；o.tilt 倾斜、o.shake 抖动
K.sieve = (c, x, y, r, o = {}) => { const { tilt = 0, shake = 0, alpha = 1, holes = true } = o; c.save(); c.globalAlpha *= alpha; c.translate(x + shake, y); c.rotate(tilt); c.scale(r / 150, r / 150);
  const bowl = K.once('sieveBowl', () => { const p = new Path2D(); p.moveTo(-150, -10); p.quadraticCurveTo(-140, 100, 0, 104); p.quadraticCurveTo(140, 100, 150, -10); p.closePath(); return p; });
  c.save(); dsh(c, 0.4, 6); K.gold(c, bowl, { lw: 4 }); c.restore();
  if (holes) { c.save(); c.clip(bowl); for (let j = 0; j < 7; j++) for (let i = -9; i <= 9; i++) { const px = i * 15 + (j % 2) * 7.5, py = j * 15 + 6; if (Math.abs(px) < 150 - j * 8) K.dot(c, px, py, 3.2, INK, null); } c.restore(); }
  const rim = K.round(-160, -26, 320, 30, 12); K.gold(c, rim, { lw: 4 }); for (let i = -7; i <= 7; i++) K.dot(c, i * 21, -11, 2.8, C.red, INK, 1.2);
  K.gold(c, K.round(150, -22, 150, 20, 10), { lw: 4 }); K.dot(c, 308, -12, 14, C.red, INK, 3); c.restore(); };
// 沙漏：p 0..1（0 沙全在上，1 全在下），沙流自动；flip 翻转（0/1）
K.hourglass = (c, x, y, s = 1, o = {}) => { const { p = 0, alpha = 1, flip = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(flip * Math.PI); c.scale(s, s);
  const gl = K.once('hgl', () => K.poly([[-34, -62], [34, -62], [34, -46], [8, -4], [8, 4], [34, 46], [34, 62], [-34, 62], [-34, 46], [-8, 4], [-8, -4], [-34, -46]]));
  c.save(); dsh(c, 0.35, 4); K.paint(c, gl, C.cream, INK, 3.5); c.restore();
  c.save(); c.clip(gl); c.fillStyle = C.gold; const q = clamp(p);
  c.fillRect(-40, lerp(-58, -4, q), 80, 56); c.beginPath(); c.moveTo(-40, 62); c.lineTo(-40, 62 - 34 * q + 6); c.lineTo(0, 62 - 34 * q - 8); c.lineTo(40, 62 - 34 * q + 6); c.lineTo(40, 62); c.fill();
  if (q > 0 && q < 1) c.fillRect(-2, -4, 4, 66 - 34 * q); c.restore(); K.paint(c, gl, null, INK, 3.5);
  for (const yy of [-72, 62]) { c.fillStyle = C.red; c.fillRect(-46, yy, 92, 14); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(-46, yy, 92, 14); K.dot(c, -34, yy + 7, 2.5, C.goldHi, null); K.dot(c, 34, yy + 7, 2.5, C.goldHi, null); }
  c.strokeStyle = INK; c.lineWidth = 5; for (const xx of [-42, 42]) { c.beginPath(); c.moveTo(xx, -62); c.lineTo(xx, 66); c.stroke(); } c.strokeStyle = C.wood; c.lineWidth = 2.5; for (const xx of [-42, 42]) { c.beginPath(); c.moveTo(xx, -62); c.lineTo(xx, 66); c.stroke(); }
  c.restore(); };
// 金币：单枚（正面，r 半径；o.mark 币面一个字）
K.coin = (c, x, y, r, o = {}) => { const { alpha = 1, mark = '', rot = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot);
  c.save(); dsh(c, 0.35, r * 0.07); K.gold(c, K.circle(0, 0, r), { lw: r * 0.07 }); c.restore(); c.strokeStyle = C.goldLo; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, 0, r * 0.74, 0, TAU); c.stroke(); c.strokeStyle = C.goldHi; c.lineWidth = r * 0.025; c.beginPath(); c.arc(0, 0, r * 0.82, 0, TAU); c.stroke();
  if (mark) K.text(c, mark, 0, r * 0.04, { size: r * 1.0, col: C.goldLo }); else star4(c, 0, 0, r * 0.4, C.goldLo); c.restore(); };
// 金币堆：n 枚竖叠（侧视，椭圆币）；(x,y) 底中点
K.coins = (c, x, y, n, s = 1, o = {}) => { const { alpha = 1 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  for (let k = 0; k < n; k++) { const yy = -k * 17, e = new Path2D(); e.ellipse(0, yy + 12, 50, 17, 0, 0, Math.PI); e.lineTo(-50, yy); e.ellipse(0, yy, 50, 17, 0, Math.PI, 0, true); e.closePath(); K.paint(c, e, C.goldLo, INK, 3);
    const tp = new Path2D(); tp.ellipse(0, yy, 50, 17, 0, 0, TAU); K.paint(c, tp, C.goldHi, INK, 3); c.strokeStyle = C.goldLo; c.lineWidth = 2; c.beginPath(); c.ellipse(0, yy, 30, 9, 0, 0, TAU); c.stroke(); } c.restore(); };
// 一排金币堆（种子随机高矮）：范围 x0..x1，底 y；p 0..1 逐堆长高；o.tall 高度倍数
K.coinHeap = (c, x0, x1, y, p = 1, seed = 1, o = {}) => { const n = Math.max(1, Math.round((x1 - x0) / 100)), r = R_(seed + 300); for (let i = 0; i < n; i++) { const h = Math.round(2 + r() * 5 * (o.tall || 1)), q = MO.lagged(i, n, p, 0.1); K.coins(c, lerp(x0 + 50, x1 - 50, n === 1 ? 0.5 : i / (n - 1)), y, Math.round(h * q), o.s || 1); } };

// ---------- 数据：尖塔柱状图 ----------
// 单座尖塔：(x, base) 底中点，w 宽，h 塔身高（不含尖顶），col 条纹色；p 0..1 长高
K.spire = (c, x, base, w, h, o = {}) => { const { col = C.blue, p = 1, roof = C.red, alpha = 1 } = o; if (p <= 0.001) return; const hh = h * p, rh = w * 0.95 * clamp(p * 1.4);
  c.save(); c.globalAlpha *= alpha; c.translate(x, base); c.lineJoin = 'round'; c.save(); dsh(c, 0.3, 4);
  K.paint(c, K.poly([[-w / 2, 0], [w / 2, 0], [w / 2, -hh], [-w / 2, -hh]]), C.white, INK, 4); c.restore();
  c.save(); c.beginPath(); c.rect(-w / 2, -hh, w, hh); c.clip(); c.fillStyle = col; for (const dx of [-0.28, 0.2]) c.fillRect(w * dx - w * 0.05, -hh, w * 0.1, hh);
  for (let k = 0; k < Math.floor(hh / 70); k++) { const yy = -70 - k * 70; if (yy < -hh + 30) break; K.paint(c, panelPath(-w * 0.18, yy - 30, w * 0.18, yy + 8, 'arch', w * 0.3), C.cream, INK, 2.5); } c.restore();
  c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(-w / 2, -hh, w, hh); c.fillStyle = c.createPattern(K.goldTex(), 'repeat'); c.fillRect(-w / 2 - 6, -hh - 4, w + 12, 12); c.lineWidth = 3; c.strokeRect(-w / 2 - 6, -hh - 4, w + 12, 12);
  K.paint(c, K.poly([[-w / 2, -hh - 4], [0, -hh - 4 - rh], [w / 2, -hh - 4]]), roof, INK, 4); K.dot(c, 0, -hh - 4 - rh - 4, w * 0.07, C.gold, INK, 2.5); c.restore(); };
// 尖塔柱状图：items [{v, label, col}]；o { x0, x1, base, hmax, lt, at, size, fmt, max, hi（高亮第几座：朱红顶＋大数字） }
K.spireChart = (c, items, o = {}) => { const { x0 = 100, x1 = 980, base = 1180, hmax = 640, lt = 99, at = 0, size = 46, fmt = v => String(v), hi = -1 } = o, n = items.length, max = o.max || Math.max(...items.map(i => i.v)), gap = (x1 - x0) / n, w = Math.min(150, gap * 0.62);
  c.fillStyle = c.createPattern(K.goldTex(), 'repeat'); c.fillRect(x0 - 30, base, x1 - x0 + 60, 24); c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(x0 - 30, base, x1 - x0 + 60, 24);
  items.forEach((it, i) => { const x = x0 + gap * (i + 0.5), p = ease(K.at(lt, at + i * 0.12, 0.7)), h = it.v / max * hmax; K.spire(c, x, base, w, h, { col: it.col || (i === hi ? C.red : C.blue), p, roof: i === hi ? C.redDk : C.red });
    if (it.label) K.text(c, it.label, x, base + 62, { size, col: INK, alpha: clamp(p * 3) });
    if (p > 0.85) K.popText(c, fmt(it.v), x, base - h * p - w * 0.95 - 54, lt, at + i * 0.12 + 0.55, { size: i === hi ? 78 : 62, dur: 0.4 }); }); };

// ---------- 藤蔓（页边装饰、转场）、箭头、锁钥 ----------
const pathLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
const leaf = (c, x, y, a, l, col) => { c.save(); c.translate(x, y); c.rotate(a); const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(l * 0.5, -l * 0.42, l, 0); p.quadraticCurveTo(l * 0.5, l * 0.42, 0, 0); K.paint(c, p, col, INK, 2.2); c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(l * 0.75, 0); c.stroke(); c.restore(); };
// 藤蔓：沿折线 pts 生长到进度 p（0..1），叶子/浆果按种子；o.lw 茎粗、o.leafL 叶长、o.step 叶距
K.vine = (c, pts, p, o = {}) => { const { lw = 5, leafL = 30, step = 38, seed = 1, berry = true, alpha = 1 } = o; if (p <= 0) return; const L = pathLen(pts), tot = L[L.length - 1], d = tot * clamp(p);
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const at = dd => { let i = 1; while (i < L.length - 1 && L[i] < dd) i++; const q = (dd - L[i - 1]) / ((L[i] - L[i - 1]) || 1), a = pts[i - 1], b = pts[i]; return [lerp(a[0], b[0], q), lerp(a[1], b[1], q), Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  c.beginPath(); for (let k = 0; k <= 40; k++) { const [x, y] = at(d * k / 40); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = INK; c.lineWidth = lw + 4; c.stroke(); c.strokeStyle = C.greenDk; c.lineWidth = lw; c.stroke();
  const r = R_(seed * 13 + 5); let side = 1;
  for (let dd = step * 0.6, k = 0; dd < d; dd += step, k++) { const [x, y, a] = at(dd), g = clamp((d - dd) / 60), l = leafL * (0.75 + r() * 0.5) * g; side = -side;
    if (l > 1) leaf(c, x, y, a + side * (0.8 + r() * 0.4), l, k % 3 === 2 ? C.green : C.greenDk);
    if (berry && k % 4 === 3 && g > 0.5) { const bx = x + Math.cos(a + side * 1.2) * 22, by = y + Math.sin(a + side * 1.2) * 22; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(bx, by); c.stroke(); K.dot(c, bx, by, 8 * g, k % 8 === 3 ? C.red : C.blue, INK, 2); } }
  const [ex, ey, ea] = at(d); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(ex + Math.cos(ea + 1.4) * 8, ey + Math.sin(ea + 1.4) * 8, 8, ea + 2.4, ea + 2.4 + 4.6); c.stroke(); c.restore(); };
// 页边藤蔓：沿页面左右边缘；o.sides 'lr'|'l'|'r'；p 生长进度；t 给了就轻摆
K.vineBorder = (c, p, o = {}) => { const { sides = 'lr', y0 = 220, y1 = 1330, seed = 1, t = 0 } = o;
  for (const sd of sides) { const sx = sd === 'l' ? 1 : -1, bx = sd === 'l' ? 62 : W - 62, pts = []; for (let k = 0; k <= 28; k++) { const q = k / 28; pts.push([bx + sx * (Math.sin(q * 11 + seed) * 16 + 6 + Math.sin(t * 1.2 + q * 5) * 2), lerp(y0, y1, q)]); } K.vine(c, pts, p, { seed: seed + (sd === 'l' ? 0 : 7), leafL: 34, step: 44 }); } };
// 箭头：朱红粗带＋墨边＋白点；(ax,ay)→(bx,by)，p 进度，o.bend 弯曲量（连线垂直方向，占连线长比例）
K.arrow = (c, ax, ay, bx, by, p = 1, o = {}) => { const { col = C.red, w = 26, bend = 0, alpha = 1 } = o; if (p <= 0) return; const mx = (ax + bx) / 2 - (by - ay) * bend, my = (ay + by) / 2 + (bx - ax) * bend, len = Math.hypot(bx - ax, by - ay) + 1;
  const bz = u => [(1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx, (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by], e = clamp(p), pe = bz(e), hl = w * 1.5;
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'butt'; c.lineJoin = 'miter'; const line = (u1, lw, st) => { c.beginPath(); for (let k = 0; k <= 24; k++) { const q = bz(u1 * k / 24); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.strokeStyle = st; c.lineWidth = lw; c.stroke(); };
  const hs = e > 0.12, ue = hs ? Math.max(0, e - hl / len) : e; line(ue, w + 7, INK); line(ue, w, col); c.save(); c.setLineDash([0.1, 22]); c.lineCap = 'round'; line(ue, 5, '#fff'); c.restore();
  if (hs) { const q = bz(ue), a2 = Math.atan2(pe[1] - q[1], pe[0] - q[0]); c.save(); c.translate(q[0], q[1]); c.rotate(a2); K.paint(c, K.poly([[-2, -w * 0.95], [hl + 6, 0], [-2, w * 0.95]]), col, INK, 4.5); c.restore(); } c.restore(); };
// 钥匙：金柄＋四叶柄环；(x,y) 柄环中心，rot 朝向（0＝齿朝右）
K.key = (c, x, y, s = 1, rot = 0, o = {}) => { const { alpha = 1 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const bow = K.once('keyBow', () => { const p = new Path2D(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; p.moveTo(Math.cos(a) * 26 + 22, Math.sin(a) * 26); p.arc(Math.cos(a) * 26, Math.sin(a) * 26, 22, 0, TAU); } return p; });
  c.save(); dsh(c, 0.35, 4); K.gold(c, K.round(30, -9, 200, 18, 5), { lw: 4 }); K.gold(c, K.poly([[150, 9], [150, 44], [176, 44], [176, 9]]), { lw: 4 }); K.gold(c, K.poly([[196, 9], [196, 32], [220, 32], [220, 9]]), { lw: 4 }); K.gold(c, bow, { lw: 4 }); c.restore();
  K.dot(c, 0, 0, 12, C.parch, INK, 3.5); K.dot(c, 52, 0, 4, C.red, INK, 1.5); c.restore(); };
// 锁：金锁体＋锁梁；o.open 0..1（锁梁抬起）
K.lock = (c, x, y, s = 1, o = {}) => { const { open = 0, alpha = 1, shake = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x + shake, y); c.scale(s, s);
  c.save(); c.translate(0, -open * 22); c.strokeStyle = INK; c.lineWidth = 34; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-52, -10); c.lineTo(-52, -70); c.arc(0, -70, 52, Math.PI, 0); c.lineTo(52, open > 0.5 ? -50 : -10); c.stroke(); c.strokeStyle = '#cfcfc6'; c.lineWidth = 22; c.stroke(); c.restore();
  const body = K.round(-84, -10, 168, 130, 18); c.save(); dsh(c, 0.4, 6); K.gold(c, body, { lw: 5 }); c.restore(); c.strokeStyle = C.goldLo; c.lineWidth = 3; c.stroke(K.round(-70, 4, 140, 102, 10));
  K.dot(c, 0, 42, 17, INK, null); K.paint(c, K.poly([[-8, 48], [8, 48], [13, 92], [-13, 92]]), INK, null, 0); c.restore(); };
// 受体（锁孔窗花）：彩玻璃尖拱窗里一个钥匙形凹槽；o.bound 0..1 药嵌入后凹槽点亮成金
K.receptor = (c, x, y, s = 1, o = {}) => { const { bound = 0, col = C.blue, alpha = 1, t = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  c.save(); dsh(c, 0.4, 6); K.gold(c, panelPath(-110, -170, 110, 150, 'arch', 160), { lw: 5 }); c.restore(); const inner = panelPath(-86, -146, 86, 126, 'arch', 140); K.paint(c, inner, col, INK, 4);
  c.save(); c.clip(inner); c.strokeStyle = C.gold; c.lineWidth = 2.4; for (let k = -6; k < 7; k++) { c.beginPath(); c.moveTo(k * 34 - 200, 300); c.lineTo(k * 34 + 200, -300); c.moveTo(k * 34 - 200, -300); c.lineTo(k * 34 + 200, 300); c.stroke(); } c.restore();
  const hole = new Path2D(); hole.arc(0, -20, 38, 0, TAU); hole.moveTo(-14, -10); hole.lineTo(14, -10); hole.lineTo(22, 80); hole.lineTo(-22, 80); hole.closePath();
  c.fillStyle = INK; c.fill(hole); if (bound > 0) { c.save(); c.globalAlpha *= clamp(bound); c.fillStyle = C.goldHi; c.fill(hole); c.restore(); K.glint(c, 0, -20, 1.4 * bound + 0.2 * Math.sin(t * 6), bound); } c.restore(); };

// ---------- 分子：金球＋墨线（默认），或彩玻璃花窗象征画法 ----------
// 种子生成：kind 'tree'（随机枝状）｜'ring'（六元环＋侧链，苯环）｜'fused'（两环并联）
K.molShape = (seed, kind = 'tree') => K.once(`mol${seed}_${kind}`, () => { const r = R_(seed * 97 + 11), at = [], bonds = [];
  if (kind === 'ring' || kind === 'fused') { const ringAt = (cx, cy, off) => { const base = at.length; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + off; at.push([cx + Math.cos(a), cy + Math.sin(a), 0.5 + r() * 0.12]); } for (let i = 0; i < 6; i++) bonds.push([base + i, base + (i + 1) % 6, i % 2 === 0]); };
    ringAt(0, 0, Math.PI / 6); if (kind === 'fused') ringAt(1.732, 0, Math.PI / 6);
    const nSide = 1 + Math.floor(r() * 2); for (let k = 0; k < nSide; k++) { const i = Math.floor(r() * 6), a = Math.atan2(at[i][1], at[i][0]), id = at.length; at.push([at[i][0] + Math.cos(a), at[i][1] + Math.sin(a), 0.45 + r() * 0.3]); bonds.push([i, id, false]); if (r() < 0.6) { const id2 = at.length; at.push([at[id][0] + Math.cos(a + 0.9) * 0.95, at[id][1] + Math.sin(a + 0.9) * 0.95, 0.4 + r() * 0.2]); bonds.push([id, id2, r() < 0.4]); } } }
  else { const n = 4 + Math.floor(r() * 4); at.push([0, 0, 0.6]); for (let i = 1; i < n; i++) { const pi = Math.floor(r() * at.length), p = at[pi], a = r() * TAU; at.push([p[0] + Math.cos(a) * 1.25, p[1] + Math.sin(a) * 1.25, 0.4 + r() * 0.3]); bonds.push([pi, at.length - 1, r() < 0.2]); } }
  const mx = at.reduce((s, q) => s + q[0], 0) / at.length, my = at.reduce((s, q) => s + q[1], 0) / at.length; at.forEach(q => { q[0] -= mx; q[1] -= my; }); return { at, bonds }; });
// 画分子：s＝一个键长的像素数（60–110）；o.kind 形状，o.style 'gold'金球（默认）|'glass'彩玻璃，o.rot，o.p 逐个原子长出的进度 0..1
K.mol = (c, x, y, s, seed = 1, o = {}) => { const { kind = 'tree', style = 'gold', rot = 0, alpha = 1, p = 1, cols = [C.red, C.blue, C.green, C.pink] } = o, { at, bonds } = K.molShape(seed, kind), n = at.length;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineCap = 'round';
  bonds.forEach(([i, j, dbl]) => { const q = clamp(p * (n + 2) - j * 0.8 + 0.2); if (q <= 0) return; const a = at[i], b = at[j], bx = lerp(a[0], b[0], q), by = lerp(a[1], b[1], q), nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1, ox = nx / nl * 0.08, oy = ny / nl * 0.08;
    const seg = (dx, dy) => { c.beginPath(); c.moveTo(a[0] + dx, a[1] + dy); c.lineTo(bx + dx, by + dy); }, lw = 0.2 * (style === 'glass' ? 0.8 : 1);
    c.strokeStyle = INK; c.lineWidth = lw + 0.06; if (dbl) { seg(ox, oy); c.stroke(); seg(-ox, -oy); c.stroke(); } else { seg(0, 0); c.stroke(); }
    c.strokeStyle = style === 'glass' ? C.gold : C.goldHi; c.lineWidth = lw - 0.06; if (dbl) { seg(ox, oy); c.stroke(); seg(-ox, -oy); c.stroke(); } else { seg(0, 0); c.stroke(); } });
  at.forEach((q, i) => { const g = clamp(p * (n + 2) - i * 0.8); if (g <= 0) return; const rr = 0.25 * q[2] / 0.5 * 1.2 * g;
    if (style === 'glass') { K.dot(c, q[0], q[1], rr, cols[i % cols.length], INK, 0.07); c.strokeStyle = INK; c.lineWidth = 0.05; c.beginPath(); c.moveTo(q[0] - rr, q[1]); c.lineTo(q[0] + rr, q[1]); c.moveTo(q[0], q[1] - rr); c.lineTo(q[0], q[1] + rr); c.stroke(); c.strokeStyle = C.gold; c.lineWidth = 0.05; c.beginPath(); c.arc(q[0], q[1], rr * 0.62, 0, TAU); c.stroke(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(q[0] - rr * 0.4, q[1] - rr * 0.4, rr * 0.18, 0, TAU); c.fill(); }
    else { K.ball(c, q[0], q[1], rr); if (i % 3 === 1) K.dot(c, q[0], q[1], rr * 0.34, [C.red, C.blue, C.green][(i >> 1) % 3], INK, 0.05); } });
  c.restore(); };

// ---------- 手（红袍金袖，掌心向上，从右入画）：(x,y)＝掌心上沿中点，药丸放在 (x, y-30*s) ----------
K.hand = (c, x, y, s = 1, o = {}) => { const { flip = false, alpha = 1, rot = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(flip ? -s : s, s); c.translate(-520, -1263);
  const sl = new Path2D(); sl.moveTo(1090, 1150); sl.quadraticCurveTo(900, 1190, 800, 1238); sl.lineTo(796, 1304); sl.quadraticCurveTo(920, 1350, 1090, 1352); sl.closePath();
  c.save(); dsh(c, 0.3, 4); K.paint(c, sl, C.red, INK, 4); c.restore(); c.save(); c.clip(sl); c.strokeStyle = 'rgba(255,225,150,.8)'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(1090, 1160 + k * 24); c.quadraticCurveTo(940, 1200 + k * 16, 800, 1240 + k * 8); c.stroke(); } c.restore(); K.paint(c, sl, null, INK, 4);
  K.paint(c, K.poly([[790, 1232], [820, 1226], [830, 1312], [796, 1308]]), C.gold, INK, 3.5); K.dot(c, 807, 1258, 3, C.red, null); K.dot(c, 811, 1280, 3, C.red, null);
  const S = pts => { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } p.lineTo(...pts[pts.length - 1]); p.closePath(); return p; };
  const palm = S([[800, 1240], [700, 1252], [600, 1263], [490, 1266], [420, 1264], [352, 1268], [336, 1280], [352, 1292], [420, 1296], [500, 1300], [600, 1306], [700, 1312], [800, 1308]]); K.paint(c, palm, C.skin, INK, 3.8);
  c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round'; for (const [x0, y0, x1, y1] of [[480, 1266, 380, 1269], [480, 1281, 372, 1281], [490, 1297, 390, 1293]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  c.strokeStyle = 'rgba(190,120,90,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(640, 1292); c.quadraticCurveTo(580, 1284, 540, 1296); c.stroke();
  K.paint(c, S([[760, 1245], [715, 1222], [668, 1212], [648, 1220], [660, 1236], [712, 1252], [748, 1262]]), C.skin, INK, 3.8); c.restore(); };

// ---------- 袍服剪影人物（无脸）：(x,y) 脚底中点，身高约 440*s ----------
// o: robe 袍色、trim 镶边色、head 'hood'|'cap'|'crown'|'bald'|'bare'、prop 'none'|'scroll'|'book'|'vial'|'staff'|'pill'|'flask'|'key'、halo、flip、t（光环慢转）、bob
K.robed = (c, x, y, s = 1, o = {}) => { const { robe = C.red, trim = C.gold, head = 'hood', prop = 'none', halo = false, flip = false, t = 0, alpha = 1, bob = 0, inner = C.cream } = o, lw = Math.max(3.5, 2.4 / s);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y + bob); c.scale(flip ? -s : s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  if (halo) K.halo(c, 0, -358, 1, t, { r: 62 });
  const body = K.once('robeBody', () => { const p = new Path2D(); p.moveTo(-60, -304); p.quadraticCurveTo(-72, -210, -112, -90); p.quadraticCurveTo(-124, -40, -126, 0); p.lineTo(126, 0); p.quadraticCurveTo(124, -40, 112, -90); p.quadraticCurveTo(72, -210, 60, -304); p.quadraticCurveTo(0, -332, -60, -304); p.closePath(); return p; });
  c.save(); dsh(c, 0.3, 5); K.paint(c, body, robe, INK, lw); c.restore();
  c.save(); c.clip(body); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 3; for (const fx of [-60, -22, 30, 66]) { c.beginPath(); c.moveTo(fx * 0.4, -230); c.quadraticCurveTo(fx, -120, fx * 1.6, 0); c.stroke(); }
  c.fillStyle = trim; c.fillRect(-9, -310, 18, 330); c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(-9, -310, 18, 330); for (let yy = -290; yy < -20; yy += 22) K.dot(c, 0, yy, 2.4, C.red, null);
  c.fillStyle = trim; c.fillRect(-140, -26, 280, 26); c.strokeRect(-140, -26, 280, 26); for (let xx = -120; xx < 120; xx += 20) K.dot(c, xx, -13, 3, C.red, INK, 1); c.restore();
  K.paint(c, K.poly([[-24, -320], [0, -300], [24, -320], [20, -296], [0, -286], [-20, -296]]), inner, INK, 2.5);
  const holding = prop !== 'none' && prop !== 'staff', hx = holding ? 28 : 92, hy = holding ? -206 : -140;
  const arm = sg => { const sx = sg * 60, sy = -292, ex = sg * hx, ey = sg === 1 && prop === 'vial' ? -330 : hy, mx = (sx + ex) / 2 + sg * 16, my = (sy + ey) / 2 + 20;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, ex, ey); c.strokeStyle = INK; c.lineWidth = 52 + lw * 2; c.stroke(); c.strokeStyle = robe; c.lineWidth = 52; c.stroke();
    const bx = lerp(mx, ex, 0.5), by = lerp(my, ey, 0.5); c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.strokeStyle = INK; c.lineWidth = 56 + lw; c.stroke(); c.strokeStyle = trim; c.lineWidth = 50; c.stroke();
    c.beginPath(); c.moveTo(lerp(bx, ex, 0.55), lerp(by, ey, 0.55)); c.lineTo(ex, ey); c.strokeStyle = robe; c.lineWidth = 46; c.stroke(); };
  const pr = { scroll: () => { c.save(); c.translate(0, -214); c.rotate(-0.18); K.paint(c, K.round(-70, -17, 140, 34, 8), C.cream, INK, lw); for (const sx of [-1, 1]) K.paint(c, K.round(sx * 70 - 9, -22, 18, 44, 6), C.red, INK, lw); c.restore(); },
    book: () => { c.save(); c.translate(0, -226); K.paint(c, K.poly([[-72, -34], [0, -26], [0, 42], [-72, 36]]), C.cream, INK, lw); K.paint(c, K.poly([[72, -34], [0, -26], [0, 42], [72, 36]]), C.cream, INK, lw); c.strokeStyle = C.red; c.lineWidth = 2.5; for (let k = 0; k < 4; k++) for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 12, -14 + k * 11); c.lineTo(sg * 60, -18 + k * 11); c.stroke(); } c.restore(); },
    vial: () => K.vial(c, 100, -386, 1.5, C.red, 0.2),
    pill: () => K.pill(c, 0, -246, -0.2, 0.8, { shadow: false }), flask: () => K.flask(c, 0, -196, 0.9, { col: C.green }), key: () => K.key(c, -20, -226, 0.55, -0.4) };
  if (prop === 'staff') { c.strokeStyle = INK; c.lineWidth = 14 + lw; c.beginPath(); c.moveTo(-124, 6); c.lineTo(-124, -420); c.stroke(); c.strokeStyle = C.wood; c.lineWidth = 12; c.stroke(); K.dot(c, -124, -432, 17, C.gold, INK, 3); finial(c, -124, -428); }
  arm(-1); arm(1);
  if (head === 'hood') { K.paint(c, K.poly([[-58, -310], [-54, -372], [0, -432], [54, -372], [58, -310], [0, -296]]), robe, INK, lw); const f = new Path2D(); f.ellipse(0, -354, 36, 44, 0, 0, TAU); K.paint(c, f, C.skin, INK, lw); c.fillStyle = trim; c.fillRect(-58, -312, 116, 10); c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(-58, -312, 116, 10); }
  else { const f = new Path2D(); f.ellipse(0, -354, 38, 46, 0, 0, TAU); K.paint(c, f, C.skin, INK, lw); c.fillStyle = trim; c.fillRect(-14, -312, 28, 14); c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(-14, -312, 28, 14);
    if (head === 'cap') { const cp = new Path2D(); cp.ellipse(0, -386, 46, 16, 0, 0, TAU); K.paint(c, cp, C.blueDk, INK, lw); K.paint(c, K.round(-30, -412, 60, 28, 10), C.blueDk, INK, lw); c.strokeStyle = C.gold; c.lineWidth = 3.5; c.beginPath(); c.moveTo(40, -386); c.lineTo(52, -352); c.stroke(); K.dot(c, 52, -350, 5, C.gold, INK, 1.5); }
    else if (head === 'crown') K.paint(c, K.poly([[-34, -386], [-38, -424], [-18, -406], [0, -432], [18, -406], [38, -424], [34, -386]]), C.gold, INK, lw);
    else if (head === 'bald') { c.save(); c.beginPath(); c.ellipse(0, -354, 38, 46, 0, 0, TAU); c.clip(); c.fillStyle = C.woodDk; c.fillRect(-40, -402, 80, 18); c.fillRect(-42, -402, 10, 60); c.fillRect(32, -402, 10, 60); c.restore(); K.paint(c, f, null, INK, lw); } }
  if (pr[prop]) pr[prop]();
  if (holding) for (const sg of [-1, 1]) K.dot(c, sg * (prop === 'vial' && sg === 1 ? 70 : 34), prop === 'vial' && sg === 1 ? -334 : -204, 14, C.skin, INK, lw * 0.8);
  else for (const sg of [-1, 1]) K.dot(c, sg * hx, hy + 24, 13, C.skin, INK, lw * 0.8);
  c.restore(); };
// 人群：n 个小袍服人排一排（颜色按种子）；o.t 给了就轻摆，o.p 逐个出现
K.crowd = (c, x, y, n, s, seed = 1, o = {}) => { const { gap = 126 * s, t = 0, heads = ['hood', 'cap', 'bald'], p = 1, cols = [C.red, C.blue, C.green, C.pink, C.orange], alpha = 1 } = o, r = R_(seed + 900);
  for (let i = 0; i < n; i++) { const rs = 0.92 + r() * 0.16, rc = cols[Math.floor(r() * cols.length)], q = clamp(p * (n + 1) - i); if (q <= 0) continue; K.robed(c, x + (i - (n - 1) / 2) * gap, y, s * rs * ease(q), { robe: rc, head: heads[i % heads.length], bob: Math.sin(t * 3 + i * 1.7) * 2 * s, alpha }); } };

// ---------- 其它道具：书／卷轴、培养皿、药草、蒸馏瓶、尖拱小画框 ----------
// 翻开的书：(x,y) 中心，w×h；o.open 0..1；o.hl [[行号, 进度]] 朱红划线
K.book = (c, x, y, w, h, o = {}) => { const { open = 1, alpha = 1, lines = 7, hl = [], rot = 0 } = o, ww = w / 2 * Math.max(0.05, ease(open)); c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot);
  c.save(); dsh(c, 0.35, 6); K.paint(c, K.poly([[-ww - 14, -h / 2 - 12], [ww + 14, -h / 2 - 12], [ww + 14, h / 2 + 12], [-ww - 14, h / 2 + 12]]), C.red, INK, 5); c.restore();
  for (const sg of [-1, 1]) { K.paint(c, K.poly([[sg * 5, -h / 2], [sg * ww, -h / 2 + 8], [sg * ww, h / 2 - 2], [sg * 5, h / 2 - 10]]), C.cream, INK, 4);
    if (open > 0.6) { c.strokeStyle = 'rgba(80,50,30,.5)'; c.lineWidth = 3; for (let i = 0; i < lines; i++) { const yy = -h / 2 + 40 + i * (h - 80) / (lines - 1), ll = (ww - 40) * (0.7 + 0.3 * U.hash(i + sg * 5, 3)); c.beginPath(); c.moveTo(sg * 24, yy); c.lineTo(sg * (24 + ll * 0.9), yy + 2); c.stroke(); } } }
  hl.forEach(([i, q]) => { const yy = -h / 2 + 40 + i * (h - 80) / (lines - 1); c.strokeStyle = C.red; c.lineWidth = 6; c.beginPath(); c.moveTo(24, yy + 12); c.lineTo(24 + (ww - 50) * clamp(q), yy + 12); c.stroke(); });
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -h / 2 + 4); c.lineTo(0, h / 2 - 6); c.stroke(); c.restore(); };
// 卷轴：横展开，p 展开进度，w 全宽
K.scroll = (c, x, y, w, h, p = 1) => { const ww = Math.max(24, w * ease(clamp(p))); c.save(); c.translate(x, y); c.save(); dsh(c, 0.35, 5); K.paint(c, K.poly([[-ww / 2, -h / 2], [ww / 2, -h / 2], [ww / 2, h / 2], [-ww / 2, h / 2]]), C.cream, INK, 4); c.restore();
  if (ww > 120) { c.save(); c.beginPath(); c.rect(-ww / 2, -h / 2, ww, h); c.clip(); c.strokeStyle = 'rgba(80,50,30,.45)'; c.lineWidth = 3; for (let yy = -h / 2 + 32; yy < h / 2 - 20; yy += 34) { c.beginPath(); c.moveTo(-ww / 2 + 36, yy); c.lineTo(ww / 2 - 36 - (yy * 7 % 60 + 60) % 60, yy); c.stroke(); } c.restore(); }
  for (const sg of [-1, 1]) { K.paint(c, K.round(sg * ww / 2 - 16, -h / 2 - 12, 32, h + 24, 12), C.red, INK, 4); K.dot(c, sg * ww / 2, -h / 2 - 14, 9, C.gold, INK, 2.5); K.dot(c, sg * ww / 2, h / 2 + 14, 9, C.gold, INK, 2.5); } c.restore(); };
// 培养皿（俯视）：o.mold 0..1 霉斑长大；o.ring 抑菌圈 0..1
K.dish = (c, x, y, r, o = {}) => { const { mold = 0, ring = 0, seed = 1, alpha = 1, agar = '#e9d27a' } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y);
  c.save(); dsh(c, 0.35, r * 0.05); K.dot(c, 0, 0, r, C.cream, INK, r * 0.04); c.restore(); K.dot(c, 0, 0, r * 0.88, agar, INK, r * 0.025);
  if (ring > 0) { c.strokeStyle = 'rgba(255,250,225,.9)'; c.lineWidth = r * 0.04; c.setLineDash([r * 0.12, r * 0.08]); c.beginPath(); c.arc(0, 0, r * 0.3 * ring + r * 0.3, 0, TAU); c.stroke(); c.setLineDash([]); }
  for (let i = 1; i < 24; i++) { const a = U.hash(i, seed) * TAU, d = r * (0.45 + U.hash(i, seed + 1) * 0.35); K.dot(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.025 * (0.6 + U.hash(i, seed + 2)), C.pink, null); }
  if (mold > 0) { const m = new Path2D(), n = 14; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.1 + 0.2 * mold) * (0.8 + 0.4 * U.hash(i, seed)), px = Math.cos(a) * rr, py = Math.sin(a) * rr; m.moveTo(px + r * (0.07 + 0.04 * mold), py); m.arc(px, py, r * (0.07 + 0.04 * mold), 0, TAU); } m.moveTo(r * (0.1 * mold + 0.04), 0); m.arc(0, 0, r * (0.1 * mold + 0.04), 0, TAU); K.paint(c, m, C.green, INK, r * 0.014);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; K.dot(c, Math.cos(a) * r * 0.16 * mold, Math.sin(a) * r * 0.16 * mold, r * 0.02, '#fff', null); } }
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = r * 0.03; c.beginPath(); c.arc(0, 0, r * 0.78, 3.6, 4.4); c.stroke(); c.restore(); };
// 药草／柳枝：(x,y) 根部，h 高，seed 种子；o.kind 'herb'|'willow'，o.t 轻摆，o.p 生长
K.herb = (c, x, y, h, seed = 1, o = {}) => { const { t = 0, kind = 'herb', alpha = 1, p = 1 } = o, r = R_(seed + 500), n = kind === 'willow' ? 9 : 7; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.lineCap = 'round';
  c.rotate(Math.sin(t * 1.3 + seed) * 0.03); c.strokeStyle = INK; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(h * 0.08, -h * 0.5, 0, -h * p); c.stroke(); c.strokeStyle = C.greenDk; c.lineWidth = 5; c.stroke();
  for (let i = 0; i < n; i++) { const u = (i + 1) / (n + 1), side = i % 2 ? 1 : -1, yy = -h * p * u, xx = h * 0.08 * Math.sin(u * 2.6) * 0.8, g = clamp(p * 1.4 - u * 0.7), l = (kind === 'willow' ? h * 0.42 : h * 0.3) * (1.05 - u * 0.5) * g; if (l < 2) continue;
    if (kind === 'willow') { c.save(); c.translate(xx, yy); const lp = new Path2D(); lp.moveTo(0, 0); lp.quadraticCurveTo(side * l * 0.5, l * 0.15, side * l * 0.55, l * 0.75); lp.quadraticCurveTo(side * l * 0.35, l * 0.2, 0, 8); K.paint(c, lp, C.green, INK, 2.5); c.restore(); }
    else leaf(c, xx, yy, side > 0 ? -0.9 - r() * 0.3 : -Math.PI + 0.9 + r() * 0.3, l, i % 3 === 0 ? C.green : C.greenDk); }
  c.restore(); };
// 蒸馏瓶（三角烧瓶，带气泡）：o.col 液色，o.level 液位，t 冒泡
K.flask = (c, x, y, s = 1, o = {}) => { const { col = C.green, level = 0.55, t = 0, alpha = 1, rot = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const body = K.once('flaskBody', () => { const p = new Path2D(); p.moveTo(-18, -80); p.lineTo(18, -80); p.lineTo(18, -34); p.lineTo(80, 60); p.quadraticCurveTo(92, 84, 60, 84); p.lineTo(-60, 84); p.quadraticCurveTo(-92, 84, -80, 60); p.lineTo(-18, -34); p.closePath(); return p; });
  c.save(); dsh(c, 0.3, 4); c.fillStyle = '#fffaf0'; c.fill(body); c.restore(); c.save(); c.clip(body); const top = lerp(84, -20, level); c.fillStyle = col; c.fillRect(-100, top, 200, 120); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-100, top, 200, 4);
  for (let i = 0; i < 5; i++) { const q = ((t * 0.6 + i * 0.21) % 1), bx = -34 + i * 17 + Math.sin(t * 2 + i) * 4, by = lerp(78, top + 8, q); if (by > top + 4) K.dot(c, bx, by, 3 + (i % 2) * 2, 'rgba(255,255,255,.75)', null); } c.restore();
  c.strokeStyle = INK; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(body); K.paint(c, K.round(-14, -108, 28, 30, 6), C.gold, INK, 3.5); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-36, 20, 5, 36); c.restore(); };
// 尖拱小画框（人物小传、手抄本插图）：(x,y) 左上，w×h；o.draw(c) 在框内（已裁剪）画内容；o.fill 框内底色；o.scale 弹出
K.panel = (c, x, y, w, h, o = {}) => { const { fill = C.cream, draw, kind = 'arch', alpha = 1, scale = 1 } = o; if (scale <= 0) return null; c.save(); c.globalAlpha *= alpha; c.translate(x + w / 2, y + h / 2); c.scale(scale, scale); c.translate(-x - w / 2, -y - h / 2);
  const out = panelPath(x, y, x + w, y + h, kind, w * 0.6), inn = panelPath(x + 20, y + 20, x + w - 20, y + h - 20, kind, w * 0.5);
  c.save(); dsh(c, 0.4, 6); K.gold(c, out, { lw: 5 }); c.restore(); c.fillStyle = fill; c.fill(inn); if (draw) { c.save(); c.clip(inn); draw(c); c.restore(); } K.paint(c, inn, null, INK, 4); c.restore(); return out; };
})();

// ---------- 章节卡：泥金首字母页；N 站进度藤，主物（K.cardToken，默认红白药丸）从上一站滑到本站 ----------
// 换书时在 props.js 里改 K.cardToken = (c, x, y) => {…}
(() => { const K = window.K, C = K.C, { W, TAU } = K, { clamp, lerp } = U;
K.chapterCard = (c, lt, t, n, title) => {
  K.bg(c, t, { v: 'plain', seed: 900 + n });
  const N = Math.max(K.CHAPTER_NAMES.length, n), x0 = 120, x1 = 960, y = 1222, X = i => lerp(x0, x1, i / Math.max(1, N - 1));
  const gp = K.goldPanel(c, 160, 230, 920, 700, { kind: 'gable', apex: 120 }); K.band(c, [[152, 350], [540, 224], [928, 350]], C.pink, 26); K.shine(c, gp, t, { box: [160, 230, 920, 700], period: 4 });
  c.save(); c.translate(540, 490); c.rotate(t * 0.05); for (let k = 0; k < 24; k++) { c.rotate(TAU / 24); c.fillStyle = k % 2 ? C.goldHi : C.red; c.beginPath(); c.moveTo(-10, -170); c.lineTo(0, -214); c.lineTo(10, -170); c.fill(); c.strokeStyle = K.INK; c.lineWidth = 2; c.stroke(); } c.restore();
  K.seal(c, 540, 490, 150, String(n), { scale: lt > 0.1 ? Math.max(0.01, MO.slamK((lt - 0.1) / 0.17)) : 0 });
  K.banner(c, `第 ${n} 章`, 540, 790, { w: 520, h: 100, size: 72, lt, at: 0.25 });
  // 章名：长于 8 字折成两行；逐字打出
  const L = [...title], two = L.length > 8, half = Math.ceil(L.length / 2), l1 = L.slice(0, half).join(''), l2 = L.slice(half).join(''), size = two ? (half > 6 ? 90 : 100) : (L.length > 6 ? 108 : 124);
  const shown = [...TY.typed(title, K.at(lt, 0.5, L.length / 16))];
  if (two) { K.text(c, shown.slice(0, half).join(''), W / 2, 925, { size, col: C.red, stroke: size * 0.13 }); K.text(c, shown.slice(half).join(''), W / 2, 1038, { size, col: C.red, stroke: size * 0.13 }); }
  else K.text(c, shown.join(''), W / 2, 980, { size, col: C.red, stroke: size * 0.13 });
  void l1; void l2;
  const rail = []; for (let i = 0; i <= 60; i++) rail.push([lerp(x0 - 40, x1 + 40, i / 60), y + Math.sin(i * 0.9) * 5]);
  K.vine(c, rail, K.at(lt, 0.1, 0.8), { lw: 5, leafL: 20, step: 40, seed: n, berry: false });
  for (let i = 0; i < N; i++) { const done = i < n - 1, cur = i === n - 1, p = cur ? K.pop(lt, 0.7, 0.5) : 1, r = cur ? 24 * Math.max(0.6, p) : 12;
    K.dot(c, X(i), y, r, done ? C.red : cur ? C.gold : C.parch, K.INK, cur ? 4 : 3); if (cur) K.dot(c, X(i), y, r * 0.45, C.red, null); }
  const q = MO.cubicInOut(K.at(lt, 0.2, 0.8)), cx = lerp(n > 1 ? X(n - 2) : x0 - 80, X(n - 1), q); K.cardToken(c, cx, y - 66);
  K.finish(c); };
// 字幕（assemble.py 生成的 subs.js 调它）：墨褐底板＋金细框，奶白字；字幕带 y≈1480
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "LXGWWenKai-500"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480;
  c.fillStyle = 'rgba(43,26,18,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 14); c.fill();
  c.strokeStyle = 'rgba(217,166,58,.9)'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 9); c.stroke();
  c.fillStyle = '#f6eedb'; c.fillText(text, x, y + 2); c.restore(); };
})();
