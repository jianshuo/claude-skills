// 画风套件 haring（配方 huashu-art-motion 31_haring「1982 凯斯·哈林」，收敛成「温暖安静」版）：竖屏 1080×1920。导出 window.K（同时 alias window.HK；章节代码里写 const D = K）。
// 规矩：一切形状 = 圆头粗黑线（LW≈11）＋小块平涂；底是浅暖色（奶黄/米），黄红蓝绿粉橙只做小面积重点色；
//       小人无脸、只有一个点眼，先全部描 2×LW 黑再统一填色＝并集轮廓；姿势 6fps 硬切不插值；放射线只做「重音」（注视、发现、记下的一刻）；
//       贯穿物 = 三行记录的小本子 K.notebook；字只用 GB2312（引擎自带 PuHui-Heavy/Black/Bold），屏上字 ≤ 8 字，整句话交给字幕。
//       主体放 y200–1350，字幕带 y≈1480，K.finish 在 y1380–1560 压暗。所有随机走 U.hash / U.rng，同一 lt 同一帧。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = window.HK = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__hk) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__hk = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__hk) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__hk = 1; } }

// ---------- 色板 ----------
const C = K.C = {
  ink: '#1c1814', paper: '#f7edd2', cream: '#fbf4df', white: '#fffaf0',
  yellow: '#f6c928', yellowL: '#f8dc6a', red: '#e2453a', blue: '#2e6fcf', blueL: '#a9cdea', green: '#3f9b5c', greenL: '#b9dba9',
  pink: '#f29ab8', pinkL: '#f7c8d3', orange: '#f08a2c', brown: '#b5784a', wood: '#c58a56', sub: '#7a6f5c',
};
const LW = K.LW = 11, BEAT = K.BEAT = 100 / 60;
K.pal = () => C;

// ---------- 进度 / 缓存 / 相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
K.jit = (lt, seed = 1, amp = 3) => (U.hash(Math.floor(lt * 8), seed) - 0.5) * 2 * amp;   // 8fps 抖
K.bounce = (t, ph = 0) => Math.pow(Math.abs(Math.sin((t * BEAT + ph) * Math.PI)), 0.6);      // 慢拍（100bpm），小人/灯笼跟它轻轻起伏

// ---------- 基础：描边 / 线 / 放射线 ----------
K.ink = (c, p, fill, lw = LW, col) => { c.lineJoin = 'round'; c.lineCap = 'round'; if (fill) { c.fillStyle = fill; c.fill(p); } if (lw > 0) { c.strokeStyle = col || C.ink; c.lineWidth = lw; c.stroke(p); } };
K.rect = (c, x, y, w, h, fill, lw = LW) => { const p = new Path2D(); p.rect(x, y, w, h); K.ink(c, p, fill, lw); };
K.line = (c, pts, lw = LW, col) => { c.save(); c.strokeStyle = col || C.ink; c.lineWidth = lw; c.lineCap = c.lineJoin = 'round'; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); c.restore(); };
// 放射线（重音专用）：椭圆外一圈短直线，8fps 换角度；a0..a1 可限定扇面。K.rays(c,cx,cy,rx,ry,n,t,seed,len,lw,a0,a1,k) k=0..1 出现进度
K.rays = (c, cx, cy, rx, ry, n = 8, t = 0, seed = 1, len = 30, lw = 8, a0 = 0, a1 = TAU, k = 1) => {
  if (k <= 0) return; const st = Math.floor(t * 8), r = U.rng(seed * 97 + st * 13); c.save(); c.strokeStyle = C.ink; c.lineWidth = lw; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const a = a0 + (i / Math.max(1, n - 1)) * (a1 - a0) + (r() - 0.5) * 0.2, L = len * (0.7 + r() * 0.6) * k, o = 1 + (1 - k) * 0.3, x0 = cx + Math.cos(a) * rx * o, y0 = cy + Math.sin(a) * ry * o;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); c.stroke(); }
  c.restore(); };
K.action = K.rays;

// ---------- 小人 ----------
// 姿势 = 局部关键点（原点脚底，身高≈270，朝右）：head 头心, neck, hip, hl/hr 左/右手, el/er 左/右肘（可省）, kl/kr 膝, fl/fr 脚。6fps 硬切
const POSES = K.POSES = {
  stand: { head: [0, -228], neck: [0, -180], hip: [0, -92], hl: [-36, -104], hr: [36, -104], kl: [-14, -46], kr: [14, -46], fl: [-24, 0], fr: [24, 0] },
  walkA: { head: [10, -226], neck: [4, -178], hip: [0, -92], hl: [-44, -128], hr: [42, -86], kl: [-34, -48], kr: [28, -52], fl: [-58, 0], fr: [44, -8] },
  walkP: { head: [10, -232], neck: [4, -184], hip: [0, -98], hl: [-30, -112], hr: [34, -108], kl: [-14, -52], kr: [18, -56], fl: [-22, 0], fr: [26, -12] },
  walkB: { head: [10, -226], neck: [4, -178], hip: [0, -92], hl: [44, -86], hr: [-42, -128], kl: [28, -52], kr: [-34, -48], fl: [44, -8], fr: [-58, 0] },
  look: { head: [8, -228], neck: [2, -180], hip: [0, -92], hl: [-34, -102], hr: [34, -218], er: [56, -160], kl: [-14, -46], kr: [18, -46], fl: [-26, 0], fr: [30, 0] },       // 手搭额头张望
  point: { head: [8, -228], neck: [2, -180], hip: [0, -92], hl: [-34, -104], hr: [112, -196], er: [58, -190], kl: [-16, -46], kr: [20, -46], fl: [-30, 0], fr: [34, 0] },
  crouch: { head: [34, -158], neck: [18, -116], hip: [-18, -58], hl: [-8, -80], hr: [64, -52], el: [14, -64], er: [44, -84], kl: [36, -56], kr: [56, -36], fl: [18, 0], fr: [66, 0] },  // 蹲着看地上
  sit: { head: [2, -176], neck: [-4, -130], hip: [-14, -48], hl: [34, -72], hr: [52, -70], kl: [50, -62], kr: [60, -60], fl: [54, 0], fr: [100, 0] },                          // 坐台阶（脚底 = 台阶面）
  write: { head: [22, -214], neck: [6, -176], hip: [0, -92], hl: [44, -126], hr: [64, -134], el: [8, -120], er: [20, -112], kl: [-14, -46], kr: [14, -46], fl: [-24, 0], fr: [24, 0] },   // 低头写本子
  wave: { head: [0, -228], neck: [0, -180], hip: [0, -92], hl: [-34, -104], hr: [60, -268], er: [50, -210], kl: [-14, -46], kr: [14, -46], fl: [-24, 0], fr: [24, 0] },
  reach: { head: [14, -226], neck: [6, -178], hip: [0, -92], hl: [-30, -104], hr: [70, -250], kl: [-16, -46], kr: [18, -46], fl: [-26, 0], fr: [30, 0] },                      // 抬手摸/指高处（电线、灯笼）
};
const limb = (A, B, wA, wB) => { const p = new Path2D(), a = Math.atan2(B[1] - A[1], B[0] - A[0]), n = a + Math.PI / 2;
  p.moveTo(A[0] + Math.cos(n) * wA / 2, A[1] + Math.sin(n) * wA / 2); p.lineTo(B[0] + Math.cos(n) * wB / 2, B[1] + Math.sin(n) * wB / 2);
  p.arc(B[0], B[1], wB / 2, n, n - Math.PI, true); p.lineTo(A[0] - Math.cos(n) * wA / 2, A[1] - Math.sin(n) * wA / 2);
  p.arc(A[0], A[1], wA / 2, n - Math.PI, n - 2 * Math.PI, true); p.closePath(); return p; };
K.limb = limb;
// K.figure(c,x,y,s,col,pose,o) → 锚点 { head, eye, hl, hr, neck, hip, fl, fr, feet, top }（屏幕坐标）。pose 可为名字或点集；o { flip=1|-1, eye=true, alpha, lw }
K.figure = (c, x, y, s, col, pose = 'stand', o = {}) => {
  const p = typeof pose === 'string' ? POSES[pose] : pose, flip = o.flip || 1, T = q => [x + q[0] * s * flip, y + q[1] * s];
  const arm = (a, e, h) => e ? [limb(T(a), T(e), 28 * s, 25 * s), limb(T(e), T(h), 25 * s, 24 * s)] : [limb(T(a), T(h), 28 * s, 25 * s)];
  const parts = [limb(T(p.neck), T(p.hip), 52 * s, 44 * s), ...arm(p.neck, p.el, p.hl), ...arm(p.neck, p.er, p.hr),
    limb(T(p.hip), T(p.kl), 36 * s, 32 * s), limb(T(p.kl), T(p.fl), 32 * s, 28 * s), limb(T(p.hip), T(p.kr), 36 * s, 32 * s), limb(T(p.kr), T(p.fr), 32 * s, 28 * s)];
  const hc = T(p.head), hd = new Path2D(); hd.arc(hc[0], hc[1], 40 * s, 0, TAU); parts.push(hd);
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = (o.lw || LW) * 2 * clamp(s, 0.5, 1.2); parts.forEach(q => c.stroke(q)); c.fillStyle = col; parts.forEach(q => c.fill(q));
  const eye = [hc[0] + 16 * s * flip, hc[1] - 3 * s];
  if (o.eye !== false) { c.fillStyle = C.ink; c.beginPath(); c.arc(eye[0], eye[1], Math.max(3.5, 7 * s), 0, TAU); c.fill(); }
  c.restore();
  const A = { head: hc, eye, hl: T(p.hl), hr: T(p.hr), neck: T(p.neck), hip: T(p.hip), fl: T(p.fl), fr: T(p.fr), feet: [x, y], top: [hc[0], hc[1] - 40 * s] }; return A; };
// 走路：4 帧 6fps 硬切（脚在地上滑动由调用方按 lt 算 x）；o { flip, speed=1, bob=true, eye }
K.walker = (c, x, y, s, col, t, o = {}) => { const seq = ['walkA', 'walkP', 'walkB', 'walkP'], i = Math.floor(t * 6 * (o.speed || 1)) % 4, pass = i % 2 === 1;
  return K.figure(c, x, y - (o.bob === false ? 0 : (pass ? 5 : 0)) * s, s, col, seq[i], o); };
// 站着呼吸（慢拍）：轻轻上下
K.idle = (c, x, y, s, col, t, pose = 'stand', o = {}) => K.figure(c, x, y - K.bounce(t, o.ph || 0) * 5 * s, s, col, pose, o);
// 人群：n 个小人，随机颜色/姿势/朝向；o { spread 横向宽度, depth 纵向错开, walking, cols, flip }。远小近大，按 y 排序
K.crowd = (c, x, y, n, s, t, seed = 1, o = {}) => { const { spread = 600, depth = 60, walking = false } = o, cols = o.cols || [C.blue, C.red, C.yellow, C.green, C.pink, C.orange];
  const list = Array.from({ length: n }, (_, i) => ({ i, x: x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread) + (U.hash(i, seed) - 0.5) * spread / n * 0.6, dy: U.hash(i, seed + 7) * depth }));
  list.sort((a, b) => a.dy - b.dy).forEach(q => { const k = 0.85 + q.dy / depth * 0.3, col = cols[Math.floor(U.hash(q.i, seed + 3) * cols.length)], fl = o.flip || (U.hash(q.i, seed + 5) > 0.5 ? 1 : -1), ph = U.hash(q.i, seed + 9) * 4;
    if (walking) K.walker(c, q.x, y + q.dy, s * k, col, t + ph, { flip: fl }); else K.figure(c, q.x, y + q.dy - K.bounce(t, ph) * 5 * s, s * k, col, ['stand', 'look', 'stand', 'point'][Math.floor(U.hash(q.i, seed + 11) * 4)], { flip: fl }); }); };

// ---------- 街景组件（局部坐标：x,y 多为左上角；落地物给 y = 脚底） ----------
// 墙面块：K.house(c,x,y,w,h,col,{roof:'tile'|'flat'|'none', win:n, winCol})
K.house = (c, x, y, w, h, col = C.pinkL, o = {}) => { const roof = o.roof || 'tile';
  K.rect(c, x, y, w, h, col);
  if (roof === 'tile') { const p = K.poly([[x - 24, y + 6], [x + 24, y - 56], [x + w - 24, y - 56], [x + w + 24, y + 6]]); K.ink(c, p, C.ink, LW); for (let i = 1; i < 4; i++) K.line(c, [[x - 24 + 12 * i, y - 6 - 12 * i], [x + w + 24 - 12 * i, y - 6 - 12 * i]], 5, C.sub); }
  else if (roof === 'flat') K.rect(c, x - 10, y - 24, w + 20, 24, C.ink, LW);
  const n = o.win ?? 2, ww = Math.min(80, w / (n + 1) * 0.7); for (let i = 0; i < n; i++) { const wx = x + w * (i + 1) / (n + 1) - ww / 2, wy = y + h * 0.22; K.rect(c, wx, wy, ww, ww * 1.1, o.winCol || C.cream, 9); K.line(c, [[wx + ww / 2, wy], [wx + ww / 2, wy + ww * 1.1]], 6); } };
// 电线杆＋横担；电线用 K.wires
K.pole = (c, x, top, bot) => { K.rect(c, x - 16, top, 32, bot - top, C.brown, LW);
  [top + 36, top + 120].forEach((yy, i) => K.line(c, [[x - 100 + i * 28, yy], [x + 100 - i * 28, yy]], 18)); [-80, 80].forEach(d => K.line(c, [[x + d, top + 36], [x + d, top + 18]], 8));
  K.rect(c, x - 26, top + 190, 52, 70, C.greenL, 8); };                                  // 变压器
K.wires = (c, x0, x1, y, sag = 60, n = 3, t = 0) => { for (let k = 0; k < n; k++) { const s = sag + Math.sin(t * 1.2 + k) * 2; c.save(); c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y + k * 30); c.quadraticCurveTo((x0 + x1) / 2, y + k * 30 + s, x1, y + k * 30 - 8); c.stroke(); c.restore(); } };
// 灯笼：(x,y)=挂点；s 缩放；轻摆
K.lantern = (c, x, y, s = 1, t = 0, ch = '') => { c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2.2 + x * 0.01) * 0.06); c.scale(s, s);
  K.line(c, [[0, 0], [0, 36]], 7); K.rect(c, -22, 34, 44, 14, C.ink, 6); K.ink(c, K.ellipse(0, 94, 42, 52), C.red, LW - 1); [-24, 0, 24].forEach(d => { c.save(); c.beginPath(); c.ellipse(0, 94, 42, 52, 0, 0, TAU); c.clip(); K.line(c, [[d * 1.4, 44], [d * 0.6, 144]], 4); c.restore(); });
  K.rect(c, -22, 140, 44, 14, C.ink, 6); if (ch) K.text(c, ch, 0, 96, { size: 44, fam: 'PuHui-Heavy', col: C.cream }); c.restore(); };
// 木门（带檐、格窗、灯笼）。(x,y)=门板左上角
K.door = (c, x, y, w, h, t = 0, o = {}) => { K.rect(c, x - 20, y - 66, w + 40, 66, o.roofCol || C.red);
  K.rect(c, x, y, w, h, C.wood); for (let i = 1; i < 4; i++) K.line(c, [[x + w * i / 4, y], [x + w * i / 4, y + h]], 6, C.brown);
  K.rect(c, x + w * 0.2, y + 44, w * 0.6, h * 0.3, C.cream, 9); K.line(c, [[x + w * 0.5, y + 44], [x + w * 0.5, y + 44 + h * 0.3]], 6); K.line(c, [[x + w * 0.2, y + 44 + h * 0.15], [x + w * 0.8, y + 44 + h * 0.15]], 6);
  if (o.lantern !== false) K.lantern(c, x + w - 6, y - 66, 0.9, t, o.ch); };
// 小店门帘（暖帘）：(x,y)=帘杆左端；ch 一个 GB2312 字（茶/面/酒/药/米…）
K.noren = (c, x, y, w, h = 150, col = C.blue, ch = '茶', t = 0) => { K.line(c, [[x - 12, y], [x + w + 12, y]], 12); const n = 4, pw = w / n;
  for (let i = 0; i < n; i++) { const sw = Math.sin(t * 1.6 + i * 0.9) * 3; const p = K.poly([[x + i * pw + 4, y + 6], [x + (i + 1) * pw - 4, y + 6], [x + (i + 1) * pw - 4 + sw, y + h], [x + i * pw + 4 + sw, y + h]]); K.ink(c, p, col, 8); }
  if (ch) K.text(c, ch, x + w / 2, y + h * 0.5, { size: Math.min(110, w * 0.34), fam: 'PuHui-Black', col: C.cream }); };
// 自动贩卖机：红壳、饮料格、取物口、按钮慢闪、灯光放射线（rays=false 关掉）
K.vending = (c, x, y, w, h, t = 0, o = {}) => { K.rect(c, x, y, w, h, o.col || C.red); K.rect(c, x + 20, y + 22, w - 40, h * 0.5, C.cream, 9);
  const cols = [C.blue, C.orange, C.green, C.pink], cw = (w - 40) / 4;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) K.rect(c, x + 20 + i * cw + 7, y + 22 + 12 + r * h * 0.24, cw - 14, h * 0.18, cols[(i + r * 2) % 4], 7);
  for (let i = 0; i < 4; i++) K.rect(c, x + 20 + i * cw + cw / 2 - 11, y + h * 0.58, 22, 22, i === (Math.floor(t * 1.5) % 4) ? C.yellow : C.cream, 6);
  K.rect(c, x + 28, y + h * 0.74, w - 56, h * 0.16, C.ink, 7); if (o.rays !== false) K.rays(c, x + w / 2, y + h * 0.3, w * 0.62, h * 0.36, 7, t, 11, 24, 7, Math.PI * 1.1, Math.PI * 1.9); };
// 排水沟盖（路面上，透视压扁）：(x,y)=左端中线，w 宽
K.drain = (c, x, y, w = 200, h = 34) => { K.rect(c, x, y - h / 2, w, h, C.sub, 8); for (let i = 1; i < 8; i++) K.line(c, [[x + w * i / 8, y - h / 2 + 5], [x + w * i / 8, y + h / 2 - 5]], 5, C.ink); };
// 圆形井盖
K.manhole = (c, x, y, rx = 70) => { K.ink(c, K.ellipse(x, y, rx, rx * 0.3), C.sub, 9); K.ink(c, K.ellipse(x, y, rx * 0.7, rx * 0.2), null, 5); K.line(c, [[x - rx * 0.4, y], [x + rx * 0.4, y]], 5); };
// 路面接缝：y 处一条横缝＋若干短竖缝（水泥板缝）
K.seams = (c, x0, x1, y, gap = 180, seed = 1) => { K.line(c, [[x0, y], [x1, y]], 7); for (let x = x0 + gap * (0.3 + U.hash(1, seed) * 0.5); x < x1; x += gap) K.line(c, [[x, y], [x - 24, y + 34]], 6); };
// 台阶：(x,y)=最下一级左下角；n 级，每级 w×h，向右上升
K.steps = (c, x, y, w = 120, h = 44, n = 4, col = C.cream) => { for (let i = 0; i < n; i++) K.rect(c, x + i * w, y - (i + 1) * h, w * (n - i), h, i % 2 ? col : C.paper, 9); };
// 猫：(x,y)=脚底；pose 'sit'|'loaf'|'walk'；flip；col 橘/黑/白
K.cat = (c, x, y, s = 1, t = 0, o = {}) => { const { pose = 'sit', flip = 1, col = C.orange } = o, T = (a, b) => [x + a * s * flip, y + b * s]; c.save(); c.lineJoin = c.lineCap = 'round';
  const tail = K.bounce(t) * 10, parts = [];
  if (pose === 'sit') { parts.push(K.ellipse(...T(0, -48), 44 * s, 56 * s)); parts.push(K.ellipse(...T(-40, -16), 20 * s, 14 * s)); }
  else if (pose === 'loaf') parts.push(K.ellipse(...T(0, -34), 66 * s, 36 * s));
  else { parts.push(K.ellipse(...T(0, -58), 62 * s, 32 * s)); const st = Math.floor(t * 6) % 2; [[-44, st], [-24, 1 - st], [26, st], [46, 1 - st]].forEach(([a, b]) => parts.push(K.round(...T(a - 7, -30), 14 * s, 30 * s, 6 * s))); }
  const hx = pose === 'sit' ? 20 : pose === 'loaf' ? 54 : 70, hy = pose === 'sit' ? -118 : pose === 'loaf' ? -62 : -84, hc = T(hx, hy);
  const tl = new Path2D(); const t0 = T(pose === 'sit' ? -34 : -62, pose === 'sit' ? -24 : -46); tl.moveTo(...t0); tl.quadraticCurveTo(...T(-100, -30 - tail), ...T(-88, -110 - tail * 1.4));
  c.strokeStyle = C.ink; c.lineWidth = (28 + 2 * LW) * s; c.stroke(tl); c.strokeStyle = col; c.lineWidth = 28 * s; c.stroke(tl);
  const ears = [[-26, -32, -30, -66, -2, -40], [26, -32, 30, -66, 2, -40]].map(e => K.poly([[hc[0] + e[0] * s * flip, hc[1] + e[1] * s], [hc[0] + e[2] * s * flip, hc[1] + e[3] * s - 14 * s], [hc[0] + e[4] * s * flip, hc[1] + e[5] * s]]));
  const hd = K.circle(hc[0], hc[1], 38 * s); parts.push(hd, ...ears);
  c.strokeStyle = C.ink; c.lineWidth = 2 * LW * Math.max(0.6, s); parts.forEach(q => c.stroke(q)); c.fillStyle = col; parts.forEach(q => c.fill(q));
  c.fillStyle = C.cream; c.beginPath(); c.ellipse(hc[0] + 8 * s * flip, hc[1] + 14 * s, 18 * s, 13 * s, 0, 0, TAU); c.fill();
  c.fillStyle = C.ink; c.beginPath(); c.arc(hc[0] + 14 * s * flip, hc[1] - 6 * s, Math.max(3, 6 * s), 0, TAU); c.fill(); c.restore(); return { head: hc }; };
// 盆栽：(x,y)=盆底中心
K.plant = (c, x, y, s = 1, t = 0, o = {}) => { const sw = Math.sin(t * 1.4 + x * 0.02) * 0.05; c.save(); c.translate(x, y); c.scale(s, s);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42 + sw, L = 96 - Math.abs(i - 2) * 12; c.save(); c.rotate(a + Math.PI / 2); K.ink(c, K.ellipse(0, -60 - L / 2, 22, L / 2), o.leaf || (i % 2 ? C.green : C.greenL), LW - 2); c.restore(); }
  K.ink(c, K.poly([[-44, -64], [44, -64], [34, 0], [-34, 0]]), o.pot || C.red, LW); K.line(c, [[-44, -64], [44, -64]], LW + 4); c.restore(); };
// 树/行道树（团块）：(x,y)=树根
K.tree = (c, x, y, s = 1, t = 0, col = C.green) => { c.save(); c.translate(x, y); c.scale(s, s); K.rect(c, -14, -160, 28, 160, C.brown, LW); const sw = Math.sin(t * 1.1) * 3;
  [[0, -230, 90], [-66, -180, 62], [66, -184, 62]].forEach(([a, b, r], i) => K.ink(c, K.circle(a + sw * (i ? 1 : 0.4), b, r), i === 0 ? col : C.greenL, LW)); c.restore(); };
// 地面：K.ground(c, y0, col, lineW) 一条地平线＋地色（不铺满时也可只画线）
K.ground = (c, y0, col = C.yellowL, lw = 12) => { c.fillStyle = col; c.fillRect(0, y0, W, H - y0); c.fillStyle = C.ink; c.fillRect(0, y0 - lw / 2, W, lw); };

// ---------- 贯穿物：三行记录的小本子 ----------
// K.notebook(c,x,y,s,rot,o)：(x,y)=本子中心；o { lines:[p1,p2,p3] 三行各自写出的进度 0..1, open 0..1 翻开程度, pen 笔尖在最后写的行, lt, col 封面色, alpha }
// 返回 { pen:[x,y] 笔尖位置, cx, cy }。三行是粗线条（不是字），写到哪笔尖跟到哪。
K.notebook = (c, x, y, s = 1, rot = 0, o = {}) => { const L = o.lines || [0, 0, 0], open = o.open ?? 1, col = o.col || C.yellow;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const w = 220, h = 270; let pen = [0, 0];
  if (open < 0.5) { K.ink(c, K.round(-w / 2 + 12, -h / 2 + 12, w, h, 12), C.ink, 1); K.ink(c, K.round(-w / 2, -h / 2, w, h, 12), col, LW); K.line(c, [[-w / 2 + 34, -h / 2], [-w / 2 + 34, h / 2]], 7); K.rect(c, -30, -50, 120, 70, C.cream, 7); K.line(c, [[-10, -24], [70, -24]], 6); K.line(c, [[-10, -2], [50, -2]], 6); }
  else { const ww = w * (0.55 + 0.45 * open);
    K.ink(c, K.round(-ww + 12, -h / 2 + 12, ww * 2, h, 12), C.ink, 1); K.ink(c, K.round(-ww, -h / 2, ww * 2, h, 12), C.cream, LW); K.line(c, [[0, -h / 2], [0, h / 2]], 8);
    const yy = [-60, 0, 60]; yy.forEach((ly, i) => { const p = clamp(L[i] || 0); K.line(c, [[28, ly], [ww - 28, ly]], 4, '#d8cba6'); if (p > 0) { c.save(); c.strokeStyle = C.ink; c.lineWidth = 9; c.lineCap = c.lineJoin = 'round'; c.beginPath(); const n = Math.max(2, Math.round(p * 14));
      for (let k = 0; k <= n; k++) { const px = 28 + (ww - 56) * p * (k / n), py = ly - 6 + (k % 2 ? 11 : 0) * (i === 1 ? 0.6 : 1); k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); c.restore(); pen = [28 + (ww - 56) * p, ly - 4]; } });
    K.line(c, [[-ww + 30, -60], [-ww + 80, -60]], 7, C.red); K.line(c, [[-ww + 30, 0], [-ww + 70, 0]], 7, C.blue); K.line(c, [[-ww + 30, 60], [-ww + 76, 60]], 7, C.green); }   // 左页三个小彩标
  c.restore(); const co = Math.cos(rot), si = Math.sin(rot); const pp = [x + (pen[0] * co - pen[1] * si) * s, y + (pen[0] * si + pen[1] * co) * s];
  if (o.pen !== false && open >= 0.5 && L.some(v => v > 0 && v < 1)) K.pen(c, pp[0], pp[1], s, rot);
  return { pen: pp, cx: x, cy: y }; };
// 笔：笔尖在 (x,y)，斜向右上
K.pen = (c, x, y, s = 1, rot = 0) => { c.save(); c.translate(x, y); c.rotate(rot - 0.9); c.scale(s, s); const p = K.poly([[0, 0], [-10, -26], [10, -26]]); K.ink(c, p, C.cream, 7); K.rect(c, -10, -140, 20, 114, C.red, 8); c.restore(); };

// ---------- 时间 / 声音 / 温度的符号 ----------
K.sun = (c, x, y, r = 80, t = 0, o = {}) => { c.save(); c.translate(x, y); const n = 12, st = Math.floor(t * 8);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + st * 0.04, L = r * (i % 2 ? 0.42 : 0.62); K.line(c, [[Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3], [Math.cos(a) * (r * 1.3 + L), Math.sin(a) * (r * 1.3 + L)]], 9); }
  K.ink(c, K.circle(0, 0, r), o.col || C.yellow, LW); if (o.eye) { c.fillStyle = C.ink; c.beginPath(); c.arc(r * 0.3, -r * 0.1, 7, 0, TAU); c.fill(); } c.restore(); };
K.moon = (c, x, y, r = 80, t = 0, o = {}) => { const r2 = r * 0.82, ox = r * 0.5, oy = -r * 0.16, d = Math.hypot(ox, oy), a = Math.atan2(oy, ox), phi = Math.acos(clamp((r * r + d * d - r2 * r2) / (2 * r * d), -1, 1));
  const P1 = [x + Math.cos(a + phi) * r, y + Math.sin(a + phi) * r], P2 = [x + Math.cos(a - phi) * r, y + Math.sin(a - phi) * r], cx2 = x + ox, cy2 = y + oy;
  const i1 = Math.atan2(P1[1] - cy2, P1[0] - cx2), i2 = Math.atan2(P2[1] - cy2, P2[0] - cx2), b = Math.atan2(-oy, -ox), md = q => ((q % TAU) + TAU) % TAU, delta = md(i1 - i2), bd = md(b - i2);
  const p = new Path2D(); p.arc(x, y, r, a + phi, a - phi + TAU); p.arc(cx2, cy2, r2, i2, i1, !(bd <= delta)); p.closePath(); K.ink(c, p, o.col || C.yellowL, LW);
  if (o.stars !== false) for (let i = 0; i < 3; i++) { const sx = x + r * (1.4 + i * 0.35), sy = y - r * (0.5 - i * 0.6), k = 0.8 + 0.2 * Math.sin(t * 3 + i * 2); K.line(c, [[sx - 14 * k, sy], [sx + 14 * k, sy]], 7); K.line(c, [[sx, sy - 14 * k], [sx, sy + 14 * k]], 7); } };
// 音波：从 (x,y) 向 dir（弧度）扩散的 3 道弧；o { col, n }
K.sound = (c, x, y, s = 1, t = 0, o = {}) => { const dir = o.dir ?? 0, n = o.n || 3, st = Math.floor(t * 4) % (n + 1); c.save(); c.translate(x, y); c.rotate(dir); c.strokeStyle = C.ink; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const r = (40 + i * 38) * s; c.globalAlpha = i < st || st === 0 ? 1 : 0.35; c.lineWidth = LW * 0.9; c.beginPath(); c.arc(0, 0, r, -0.6, 0.6); c.stroke(); c.strokeStyle = o.col || C.blue; c.lineWidth = LW * 0.9 - 6; c.stroke(); c.strokeStyle = C.ink; } c.restore(); };
// 温度计：(x,y)=管顶中心；h 总高；level 0..1；o { hot 冒热气线, cold 冷气小点 }
K.temp = (c, x, y, h = 300, level = 0.5, t = 0, o = {}) => { const tw = 40, bulb = 38, tube = K.round(x - tw / 2, y, tw, h - bulb, tw / 2);
  K.ink(c, tube, C.cream, LW); K.ink(c, K.circle(x, y + h, bulb), o.col || C.red, LW);
  const top = y + h - bulb - (h - bulb - 30) * clamp(level); c.save(); c.fillStyle = o.col || C.red; c.fillRect(x - 11, top, 22, y + h - top); c.restore(); K.ink(c, K.circle(x, y + h, bulb - 4), o.col || C.red, 0);
  for (let i = 0; i < 5; i++) K.line(c, [[x + tw / 2 + 10, y + 30 + i * (h - bulb - 50) / 4], [x + tw / 2 + (i % 2 ? 26 : 38), y + 30 + i * (h - bulb - 50) / 4]], 6);
  if (o.hot) for (let i = 0; i < 3; i++) { const bx = x - 80 - i * 44, sw = Math.sin(t * 4 + i) * 6; c.save(); c.strokeStyle = C.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, y + h * 0.5); c.bezierCurveTo(bx - 14 + sw, y + h * 0.4, bx + 14 - sw, y + h * 0.3, bx, y + h * 0.18); c.stroke(); c.restore(); } };
// 热气/暖意波浪线：K.heat(c,x,y,w,t,n)
K.heat = (c, x, y, w = 200, t = 0, n = 3) => { for (let i = 0; i < n; i++) { const yy = y + i * 34; c.save(); c.strokeStyle = C.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); for (let k = 0; k <= 24; k++) { const px = x + w * k / 24, py = yy + Math.sin(k * 0.8 + t * 3 + i) * 8; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); c.restore(); } };
K.heart = (c, x, y, r = 40, col = C.red) => { const p = new Path2D(); p.moveTo(x, y + r * 0.9); p.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4); p.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9); K.ink(c, p, col, LW - 2); };
// 箭头：粗黑线＋三角头，画出来。K.arrow(c,x0,y0,x1,y1,o) o { col, lw, lt, at, dur, bend 弧度偏移 }
K.arrow = (c, x0, y0, x1, y1, o = {}) => { const k = o.lt == null ? 1 : MO.cubicOut(K.at(o.lt, o.at || 0, o.dur || 0.5)); if (k <= 0) return; const { bend = 0, lw = 12, col = C.ink } = o;
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend, B = (u, a, b, d) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * d, u = k;
  const ex = B(u, x0, mx, x1), ey = B(u, y0, my, y1), px = B(Math.max(0, u - 0.05), x0, mx, x1), py = B(Math.max(0, u - 0.05), y0, my, y1), ang = Math.atan2(ey - py, ex - px);
  c.save(); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = lw + 8; c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i <= 24; i++) { const q = u * i / 24; c.lineTo(B(q, x0, mx, x1), B(q, y0, my, y1)); } c.stroke();
  if (col !== C.ink) { c.strokeStyle = col; c.lineWidth = lw - 4; c.stroke(); }
  if (k > 0.3) { const hl = 46, a1 = ang + 2.6, a2 = ang - 2.6, hp = K.poly([[ex, ey], [ex + Math.cos(a1) * hl, ey + Math.sin(a1) * hl], [ex + Math.cos(a2) * hl, ey + Math.sin(a2) * hl]]); K.ink(c, hp, col === C.ink ? C.ink : col, 8); } c.restore(); };

// ---------- 底 / 收尾 ----------
const grainTex = () => P.grain('haring', 0.03, [70, 55, 30], 0.1);
// o: { kind 'cream'|'yellow'|'pink'|'blue'|'green'|'night', rays（放射线重音，默认关）, ox, oy, spin, ground:y（地平线）, groundCol, frame }
K.bg = (c, t, o = {}) => { const { kind = 'cream', ox = 540, oy = 620, spin = 0.12 } = o;
  const base = { cream: [C.paper, C.cream], yellow: [C.yellowL, '#fbe9a0'], pink: [C.pinkL, '#fbdde3'], blue: [C.blueL, '#cfe3f3'], green: [C.greenL, '#d6ebc8'], night: ['#2c3566', '#3a4580'] }[kind] || [C.paper, C.cream];
  c.fillStyle = base[0]; c.fillRect(0, 0, W, H);
  if (o.rays) { const n = 24, rot = t * spin; c.fillStyle = base[1]; for (let i = 0; i < n; i += 2) { const a0 = rot + i / n * TAU, a1 = a0 + TAU / n; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a0) * 2600, oy + Math.sin(a0) * 2600); c.lineTo(ox + Math.cos(a1) * 2600, oy + Math.sin(a1) * 2600); c.closePath(); c.fill(); } }
  if (o.ground) K.ground(c, o.ground, o.groundCol || C.yellowL);
  if (o.frame) { c.strokeStyle = C.ink; c.lineWidth = o.frame * 2; c.strokeRect(0, 0, W, H); } };
// 每镜收尾：纸面颗粒＋字幕带 y1380–1560 压暗（暖黑渐变，不放内容）
K.finish = (c, o = {}) => { c.drawImage(grainTex(), 0, 0);
  const b = c.createLinearGradient(0, 1350, 0, 1610); b.addColorStop(0, 'rgba(40,28,18,0)'); b.addColorStop(0.3, 'rgba(40,28,18,.55)'); b.addColorStop(0.7, 'rgba(40,28,18,.55)'); b.addColorStop(1, 'rgba(40,28,18,0)');
  c.fillStyle = b; c.fillRect(0, 1350, W, 260); };

// ---------- 文字 ----------
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
// 大字：黑粗描边＋纯色填（默认奶白），无投影
K.bigText = (c, s, x, y, size, fill = C.white, o = {}) => { const { fam = 'PuHui-Heavy', lw = size * 0.2, rot = 0, scale = 1, alpha = 1, maxW = 0, stroke = C.ink } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2; c.strokeStyle = stroke; c.lineWidth = lw; c.strokeText(s, 0, 0); c.fillStyle = fill; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标签牌：圆角方牌＋粗黑边（小面积重点色）。返回宽度。o { size, fam, fill, col, scale, alpha, rot, padX }
K.tag = (c, s, x, y, o = {}) => { const { size = 50, fam = 'PuHui-Heavy', fill = C.cream, col = C.ink, scale = 1, alpha = 1, rot = 0, padX = 0.6 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.5, q = K.round(-w / 2, -h / 2, w, h, size * 0.3); K.ink(c, q, fill, 9);
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const k = K.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else K.bigText(c, s, x, y, o.size || 96, o.fill || C.white, { ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：黑粗线画出来（圆头），末端 tag 牌逐字打出
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.yellow, col = C.ink, size = 46 } = o, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 12 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.2, h = size * 1.5; c.translate(bx, by); c.scale(q, q);
  K.ink(c, K.round(-w / 2, -h / 2, w, h, size * 0.3), fill, 9); c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.6, 3); c.restore(); };
// 对话/想法气泡。K.speech(c,x,y,w,h,s,o)：(x,y) 中心；s 可含 \n；o { tail:[tx,ty], think, size, lt, at, fill, col }
K.speech = (c, x, y, w, h, s, o = {}) => { const { tail, think = false, size = 44, lt = 99, at = 0, fill = C.white, col = C.ink } = o, k = lt >= 99 ? 1 : K.pop(lt, at, 0.4); if (k <= 0) return;
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
  const body = K.round(x - w / 2, y - h / 2, w, h, Math.min(h / 2, 46)); K.ink(c, body, fill, 9);
  if (tail) { if (think) [0.3, 0.6, 0.85].forEach((u, i) => K.ink(c, K.circle(lerp(x, tail[0], u * 0.9 + 0.1), lerp(y + h / 2, tail[1], u), 16 - i * 4), fill, 7));
    else { const dx = clamp(tail[0] - x, -w / 2 + 50, w / 2 - 50), by = tail[1] > y ? y + h / 2 : y - h / 2, tp = K.poly([[x + dx - 22, by], [tail[0], tail[1]], [x + dx + 22, by]]); c.save(); c.strokeStyle = C.ink; c.lineWidth = 9; c.lineJoin = 'round'; c.fillStyle = fill; c.fill(tp); c.stroke(tp); c.fillStyle = fill; c.fillRect(x + dx - 20, by - (tail[1] > y ? 6 : -6) - 4, 40, 10); c.restore(); } }
  c.font = `${size}px "PuHui-Heavy"`; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; const ls = String(s).split('\n'); ls.forEach((l, i) => c.fillText(l, x, y + (i - (ls.length - 1) / 2) * size * 1.25 + 2)); c.restore(); };

// ---------- 章节卡 / 字幕 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json
K.CARD_KINDS = [{ kind: 'yellow' }, { kind: 'pink' }, { kind: 'blue' }, { kind: 'green' }];
// 换书时可改：K.cardToken = (c, x, y, lt, t, walking, arriveAt) => {…} 画本书的贯穿物。默认 = 夹着小本子的小人，走到站点后掏出本子
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking, arriveAt) => { const s = 0.62;
  if (walking) { const A = K.walker(c, x, y, s, C.blue, lt, {}); K.notebook(c, A.hr[0] + 8, A.hr[1] + 2, 0.12, 0.2, { open: 0, pen: false }); }
  else { const k = K.at(lt, arriveAt, 0.5), A = K.figure(c, x, y - K.bounce(t) * 3, s, C.blue, k > 0.3 ? 'write' : 'stand'); K.notebook(c, A.hr[0] + 36, A.hr[1] - 40, 0.2 * K.pop(lt, arriveAt + 0.1, 0.4), 0.15, { open: 1, lines: [K.at(lt, arriveAt + 0.2, 0.5), 0, 0], pen: false }); K.rays(c, A.head[0], A.head[1], 28, 28, 6, t, 5, 16, 5, -2.6, -0.5, K.at(lt, arriveAt, 0.3)); } });
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const k = K.CARD_KINDS[(n - 1) % K.CARD_KINDS.length];
  K.bg(c, t, { ...k, rays: true, ox: 540, oy: 470 });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, y = 1250, X = i => lerp(x0, x1, i / (N - 1));
  c.strokeStyle = C.ink; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 30, y); c.lineTo(x1 + 30, y); c.stroke(); c.strokeStyle = C.cream; c.lineWidth = 8; c.stroke();
  const walkEnd = 1.15, q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  c.strokeStyle = C.yellow; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 30, y); c.lineTo(Math.max(x0 - 30, lerp(from, done, q)), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.45) : 1; K.ink(c, K.circle(X(i), y + 38, cur ? 15 * Math.max(0.6, pp) : 10), past ? C.yellow : cur ? C.red : C.cream, 6); }
  const tx = lerp(from, done, q); K.cardToken(c, tx, y - 6, lt, t, lt < walkEnd, walkEnd);
  if (lt > 0.08) { const s = MO.slamK((lt - 0.08) / 0.17); K.rays(c, W / 2, 470, 290, 120, 14, t, 3 + n, 46, 10, Math.PI * 1.06, Math.PI * 1.94, clamp(lt * 3));
    K.bigText(c, `第 ${n} 章`, W / 2, 470, 124, C.white, { scale: s, rot: -0.03, maxW: 520, lw: 26 }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 84 : all > 6 ? 100 : 120;
  if (lt > 0.45) { const bw = 920, bh = lines.length > 1 ? 280 : 180, by = lines.length > 1 ? 690 : 760, k2 = MO.slamK(clamp((lt - 0.45) / 0.17)), bx = 80;
    c.save(); c.translate(W / 2, by + bh / 2); c.scale(k2, k2); c.translate(-W / 2, -(by + bh / 2)); K.ink(c, K.round(bx, by, bw, bh, 36), C.cream, 11); c.restore();
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) K.text(c, a.slice(0, kk).join(''), W / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.2, { size, fam: 'PuHui-Black', maxW: 840, col: C.ink, scale: k2 }); }); }
  K.finish(c, o);
};
// 字幕（assemble 生成的 subs.js 调它）：暖黑底板＋奶白字＋黄色硬投影，字幕带 y≈1480，让开视频号底栏
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = C.yellow; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 7, w, h, 24); c.fill();
  c.fillStyle = 'rgba(28,24,20,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
