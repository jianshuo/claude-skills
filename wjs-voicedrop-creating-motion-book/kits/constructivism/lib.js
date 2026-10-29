// 画风套件 constructivism（配方 huashu-art-motion 22_constructivism「1924 俄国构成主义海报」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：米色旧纸（带纤维）＋红 #c8231c／黑 #151311／奶白 三色；斜构图（斜红带、字轻微倾斜）；李西茨基楔形光束；半脸网点的几何人（无五官）；
//       全部硬边平涂，投影是「错位的一块黑」不是模糊阴影；动画是砸入／盖章／楔形射出，不做柔和淡入。所有随机走 U.hash / U.rng，同一 t 画同一帧。
// 人：圆头＋梯形身＋方臂，头的一半是网点（朝向侧），红＝角色 A／黑＝角色 B 只是色，不分性别；不画五官。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...a) { return arc.call(this, x, y, r > 0 ? r : 0, ...a); };
  proto.ellipse = function (x, y, rx, ry, ...a) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...a); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = D.C = { paper: '#e9dfc4', paper2: '#d9c9a4', paper3: '#c4b48c', red: '#c8231c', redD: '#8f1711', redL: '#d9483f', ink: '#151311', ink2: '#2b2724', gray: '#4a4640', cream: '#f4ecd6', white: '#f4ecd6' };

D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.35) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.6); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
// 阻尼二次动作：t0 那刻发生动作，之后按 period 秒摆、decay 秒衰减
D.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
// 多边形：D.poly(c, [[x,y],…], fill?) —— 填充（给了 fill 才填）；返回 c 方便接 stroke
D.poly = (c, pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } return c; };
D.polyPath = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
const tf = (c, x, y, s, rot, fn) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s, s); fn(); c.restore(); };
const ink = a => `rgba(21,19,17,${a})`, red = a => `rgba(200,35,28,${a})`;

// ---------- 底：旧纸（纤维＋斑点＋四角旧黄），可选斜带／大网点圆／深色版 ----------
D.paperTex = () => P.cached('cs_paper', W, H, g => {
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H); const r = U.rng(5);
  for (let i = 0; i < 4200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,95,50,.07)' : 'rgba(255,250,230,.10)'; g.fillRect(r() * W, r() * H, 2 + r() * 5, 1 + r() * 2); }
  g.lineCap = 'round';   // 纸纤维：短弯线
  for (let i = 0; i < 520; i++) { const x = r() * W, y = r() * H, a = r() * TAU, L = 14 + r() * 36; g.strokeStyle = r() < 0.6 ? 'rgba(130,100,55,.10)' : 'rgba(255,252,236,.22)'; g.lineWidth = 1 + r() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 10, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 10, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(110,80,35,${0.05 + r() * 0.07})`; g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 2.2, 0, TAU); g.fill(); }
  const v = g.createRadialGradient(W / 2, H * 0.45, 500, W / 2, H * 0.45, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(120,85,30,.22)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
});
D.darkTex = () => P.cached('cs_dark', W, H, g => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H); const r = U.rng(8);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,245,220,.05)' : 'rgba(255,255,255,.03)'; g.fillRect(r() * W, r() * H, 2 + r() * 5, 1 + r() * 2); }
  const v = g.createRadialGradient(W / 2, H * 0.45, 500, W / 2, H * 0.45, 1250); v.addColorStop(0, 'rgba(60,45,30,.0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
});
// 网点块：在多边形 pts 内按 45° 交错网格落点，密度 fn(x,y)→0..1（点半径 ∝ √密度）；box [x0,y0,x1,y1] 是网格范围
D.halftone = (c, pts, box, col, fn, cell = 14, gain = 0.5) => {
  c.save(); c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip();
  c.fillStyle = col; c.beginPath(); const [x0, y0, x1, y1] = box, s = cell;
  for (let j = 0; j <= (y1 - y0) / (s * 0.866) + 1; j++) for (let i = 0; i <= (x1 - x0) / s + 1; i++) {
    const x = x0 + (i + (j & 1) * 0.5) * s, y = y0 + j * s * 0.866; if (x > x1 + s) continue;
    const r = s * gain * Math.sqrt(clamp(fn(x, y))); if (r > 0.6) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } }
  c.fill(); c.restore(); };
// 圆形网点盘（大背景圆、聚光圈）：密度从圆心向外渐隐（o.inv 反过来），o.cell 点距
D.dotDisc = (c, x, y, r, col, o = {}) => { const { cell = 18, gain = 0.55, inv = false, alpha = 1 } = o; c.save(); c.globalAlpha *= alpha;
  D.halftone(c, [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]], [x - r, y - r, x + r, y + r], col, (px, py) => { const d = Math.hypot(px - x, py - y) / r; return d > 1 ? 0 : inv ? d : 1 - d * 0.8; }, cell, gain); c.restore(); };
// 斜带（分隔 / 底色块）：左边高度 a、右边高度 b、厚 th，上下各一道黑边；p 0..1 自左向右刷出；o.edge 黑边粗，o.col 带色
D.slab = (c, a, b, th, o = {}) => { const { p = 1, col = C.red, edge = 14, alpha = 1 } = o; if (p <= 0) return; const q = MO.cubicOut(clamp(p)), x1 = W * q, yb = x => lerp(a, b, x / W);
  c.save(); c.globalAlpha *= alpha; D.poly(c, [[0, a], [x1, yb(x1)], [x1, yb(x1) + th], [0, a + th]], col);
  if (edge > 0) { c.fillStyle = C.ink; c.beginPath(); c.moveTo(0, a - edge); c.lineTo(x1, yb(x1) - edge); c.lineTo(x1, yb(x1)); c.lineTo(0, a); c.fill();
    c.beginPath(); c.moveTo(0, a + th); c.lineTo(x1, yb(x1) + th); c.lineTo(x1, yb(x1) + th + edge); c.lineTo(0, a + th + edge); c.fill(); } c.restore(); };
// o: { slab: [a,b,th]（斜红带）, disc: [x,y,r]（大网点圆）, dark: true（黑底）, block: [x,y,w,h,rot]（红方块）, rules: true（角上细斜线）, p: 带刷出进度 }
D.bg = (c, t, o = {}) => {
  c.drawImage(o.dark ? D.darkTex() : D.paperTex(), 0, 0);
  if (o.disc) D.dotDisc(c, ...o.disc, o.dark ? C.paper2 : C.ink, { alpha: o.dark ? 0.35 : 0.28 });
  if (o.block) { const [x, y, w, h, r = 0.26] = o.block; c.save(); c.translate(x, y); c.rotate(r); c.fillStyle = C.red; c.fillRect(-w / 2, -h / 2, w, h); c.restore(); }
  if (o.rules) { c.save(); c.strokeStyle = o.dark ? 'rgba(244,236,214,.25)' : ink(0.5); c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(0, 150 + i * 16); c.lineTo(150 + i * 16, 0); c.moveTo(W, H - 150 - i * 16); c.lineTo(W - 150 - i * 16, H); } c.stroke(); c.restore(); }
  if (o.slab) D.slab(c, ...o.slab, { p: o.p ?? 1 });
};
// 收尾：旧黄压边＋字幕带（y1380–1560）压暗一层，让字幕底板和画面分开
D.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.45, 560, W / 2, H * 0.45, 1300); g.addColorStop(0, 'rgba(120,85,30,0)'); g.addColorStop(1, 'rgba(120,85,30,.16)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1370, 0, 1570); b.addColorStop(0, 'rgba(60,42,18,0)'); b.addColorStop(0.3, 'rgba(60,42,18,.13)'); b.addColorStop(0.7, 'rgba(60,42,18,.13)'); b.addColorStop(1, 'rgba(60,42,18,0)'); c.fillStyle = b; c.fillRect(0, 1370, W, 200);
};

// ---------- 文字 ----------
// K.text(c,s,x,y,o): { size, fam 默认 PuHui-Black, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot }
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 字压色块：红底（o.fill）奶白字，右下错位一块黑当投影。align: center | left（x 是左端）。返回牌宽
D.plate = (c, s, x, y, o = {}) => { const { size = 90, rot = -0.04, fill = C.red, col = C.cream, scale = 1, pad = 0.4, alpha = 1, align = 'center', shadow = true, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "PuHui-Black"`; if (track) c.letterSpacing = track + 'px';
  const tw = c.measureText(s).width, w = tw + size * pad * 2, h = size * 1.25, x0 = align === 'left' ? 0 : align === 'right' ? -w : -w / 2;
  if (shadow) { c.fillStyle = C.ink; c.fillRect(x0 + size * 0.11, -h / 2 + size * 0.11, w, h); } c.fillStyle = fill; c.fillRect(x0, -h / 2, w, h);
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s, x0 + size * pad, size * 0.04); c.restore(); return w * scale; };
// 砸入的大字：slamK 1.55→0.94→1；o.plate 时压红底块；o.rot 默认轻微倾斜 -0.03
D.popText = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const k = MO.slamK((lt - at) / (o.dur || 0.17)), a = clamp((lt - at) / 0.06) * (o.alpha ?? 1), rot = o.rot ?? -0.03;
  if (o.plate) D.plate(c, s, x, y, { ...o, rot, scale: k * (o.scale || 1), alpha: a }); else D.text(c, s, x, y, { ...o, rot, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：黑细线从 (ax,ay)（带方块锚点）射向 (bx,by)，末端红底牌逐字打出（约 20 字/秒）；o.fill 牌色
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.red, col = C.cream, size = 52 } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.3)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'butt'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.ink; const m = 9 * Math.min(1, p1 * 3); c.fillRect(ax - m, ay - m, m * 2, m * 2); c.restore();
  const q = D.at(lt, at + 0.28, 0.2); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 0.9, h = size * 1.45; c.translate(bx, by); c.rotate(o.rot ?? -0.03); c.scale(MO.slamK(q * 0.9 + 0.1, 1.25), MO.slamK(q * 0.9 + 0.1, 1.25));
  const x0 = o.align === 'right' ? -w : o.align === 'center' ? -w / 2 : 0;
  c.fillStyle = C.ink; c.fillRect(x0 + 9, -h / 2 + 9, w, h); c.fillStyle = fill; c.fillRect(x0, -h / 2, w, h);
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, x0 + size * 0.45, 3); c.restore(); };
// 数字滚动：从 0 数到 v（v 可带 suffix），大字砸入后滚；返回当前整数
D.count = (c, v, x, y, lt, at, o = {}) => { const { dur = 0.9, suffix = '', size = 200, col = C.red } = o; if (lt < at) return 0; const n = Math.round(v * MO.cubicOut(D.at(lt, at, dur)));
  D.text(c, n + suffix, x, y, { size, col, rot: o.rot ?? -0.03, scale: MO.slamK((lt - at) / 0.17), maxW: o.maxW || 0 }); return n; };

// ---------- 楔形光束与爆发 ----------
// 李西茨基楔形：从 (x0,y0) 射向 (x1,y1)，起点窄、终点半宽 w；p 射出进度；o.alpha 透明度；o.tip 起点半宽
D.wedge = (c, x0, y0, x1, y1, w, col = C.red, p = 1, o = {}) => { if (p <= 0) return; const q = MO.cubicOut(clamp(p)), ex = lerp(x0, x1, q), ey = lerp(y0, y1, q), ww = w * q, tip = o.tip ?? 5;
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a); c.save(); c.globalAlpha *= o.alpha ?? 0.92;
  D.poly(c, [[x0 + nx * tip, y0 + ny * tip], [ex + nx * ww, ey + ny * ww], [ex - nx * ww, ey - ny * ww], [x0 - nx * tip, y0 - ny * tip]], col); c.restore(); };
// 放射爆发：n 根楔形从 (x,y) 向外，r0 内半径、r1 外半径；rot 起始角；p 进度；o.col 色、o.half 半宽角
D.burst = (c, x, y, r0, r1, n, rot, col = C.red, p = 1, o = {}) => { if (p <= 0) return; const q = MO.cubicOut(clamp(p)), hw = (o.half ?? 0.09); c.save(); c.globalAlpha *= o.alpha ?? 1;
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, rr = lerp(r0, r1, q) * (i % 2 ? 0.7 : 1); D.poly(c, [[x + Math.cos(a - 0.01) * r0, y + Math.sin(a - 0.01) * r0], [x + Math.cos(a - hw) * rr, y + Math.sin(a - hw) * rr], [x + Math.cos(a + hw) * rr, y + Math.sin(a + hw) * rr], [x + Math.cos(a + 0.01) * r0, y + Math.sin(a + 0.01) * r0]], col); } c.restore(); };
// 声波：从 (x,y) 朝 dir（1 右 / -1 左）发三道弧；lt/at 起，循环扩散；o.t 全片时间
D.voice = (c, x, y, dir, lt, at, o = {}) => { if (lt < at) return; const { col = C.ink, r = 40, lw = 9, t = lt } = o; c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'butt'; const f = (t * 1.4) % 1;
  for (let i = 0; i < 3; i++) { const k = (i + f) / 3, rr = r + k * r * 2.6; c.globalAlpha = (1 - k) * clamp((lt - at) * 4); c.beginPath(); c.arc(x, y, rr, dir > 0 ? -0.7 : Math.PI - 0.7, dir > 0 ? 0.7 : Math.PI + 0.7); c.stroke(); } c.restore(); };

// ---------- 几何人 ----------
// K.person(c, x, y, s, o) —— (x,y)=脚下地面中点，s=1 站姿约 510px 高（坐姿约 440）。返回屏幕锚点 {head, top, mouth, handF, handB, chest, feet}。
// o: { pose, to, mix（姿势混合 0..1）, role 'A'(黑身红领)|'B'(红身黑领)|自定 col/accent, dir 1 朝右 -1 朝左（半脸网点在朝向这一侧）,
//      seat 坐在凳上（默认 sit/listen/lean/talk/slump 为 true）, t 全片时间（呼吸、talk 手势）, react 受触动时刻（头阻尼晃）, alpha, face 覆盖朝向 -1..1 }
// pose：sit 坐 / stand 站 / point 指向前方 / shrug 耸肩摊手 / turn 转身（与 stand 混合：头从有网点侧经纯色背面转到另一侧）/ listen 听（倾头托腮）/
//       talk 说（手势＋自带声波可用 K.voice）/ lean 前倾 / slump 垂头丧气 / cheer 举双手
const POSE = {   // F 前手 B 后手：相对肩线中点 (dx 朝向为正, dy 下为正)；sh 耸肩抬升；hd 头偏移；tilt 头倾；lean 身前倾；fm 朝向乘数
  stand: { F: [78, 205], B: [-78, 205], sh: 0, hd: [0, 0], tilt: 0, lean: 0, fm: 1 },
  sit: { F: [170, 112], B: [96, 120], sh: 0, hd: [0, 0], tilt: 0, lean: 0, fm: 1 },
  point: { F: [236, -44], B: [-78, 205], sh: 0, hd: [8, 0], tilt: -0.05, lean: 0.03, fm: 1 },
  shrug: { F: [150, 60], B: [-150, 60], sh: -20, hd: [0, 6], tilt: -0.14, lean: 0, fm: 1 },
  turn: { F: [78, 205], B: [-78, 205], sh: 0, hd: [0, 0], tilt: 0, lean: 0, fm: -1 },
  listen: { F: [86, -16], B: [96, 126], sh: 0, hd: [6, 4], tilt: 0.13, lean: 0.03, fm: 1 },
  talk: { F: [200, 40], B: [100, 118], sh: 0, hd: [0, 0], tilt: -0.04, lean: 0.02, fm: 1 },
  lean: { F: [196, 118], B: [128, 124], sh: 0, hd: [10, 8], tilt: 0.04, lean: 0.14, fm: 1 },
  slump: { F: [60, 190], B: [-60, 190], sh: 16, hd: [0, 30], tilt: 0.2, lean: -0.07, fm: 1 },
  cheer: { F: [120, -230], B: [-120, -230], sh: -8, hd: [0, -6], tilt: 0, lean: 0, fm: 1 },
};
D.POSES = Object.keys(POSE);
const SEATED = { sit: 1, listen: 1, lean: 1, talk: 1, slump: 1 };
const mixP = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A, L = (u, v) => lerp(u, v, k), L2 = (u, v) => [L(u[0], v[0]), L(u[1], v[1])];
  return { F: L2(A.F, B.F), B: L2(A.B, B.B), sh: L(A.sh, B.sh), hd: L2(A.hd, B.hd), tilt: L(A.tilt, B.tilt), lean: L(A.lean, B.lean), fm: L(A.fm, B.fm) }; };
const ik = (S, T, a, b, out) => { let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-3; d = Math.min(d, a + b - 0.5); const ang = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a], sc = E => E[1] + E[0] * out * 0.12;
  const k = Math.min(1, d / (Math.hypot(dx, dy) || 1)); return { E: sc(E1) >= sc(E2) ? E1 : E2, Hn: [S[0] + dx * k, S[1] + dy * k] }; };
const bar = (c, A, B, w0, w1, col, ol) => { const a = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(a), ny = Math.cos(a); D.poly(c, [[A[0] + nx * w0 / 2, A[1] + ny * w0 / 2], [B[0] + nx * w1 / 2, B[1] + ny * w1 / 2], [B[0] - nx * w1 / 2, B[1] - ny * w1 / 2], [A[0] - nx * w0 / 2, A[1] - ny * w0 / 2]], col); if (ol) { c.strokeStyle = ol; c.lineWidth = 5; c.lineJoin = 'miter'; c.stroke(); } };
D.person = (c, x, y, s = 1, o = {}) => {
  const { pose = 'stand', to = null, mix = 0, role = 'A', dir = 1, t = 0, react = -1e9, alpha = 1, noFace = false } = o;
  const isA = role !== 'B', col = o.col || (isA ? C.ink : C.red), accent = o.accent || (isA ? C.red : C.ink), dark = o.dark || (col === C.ink ? C.ink2 : col === C.red ? C.redD : C.ink2);
  const Q = mixP(pose, to || pose, MO.cubicInOut(clamp(mix))), seat = o.seat ?? (to && mix > 0.5 ? !!SEATED[to] : !!SEATED[pose]);
  const face = o.face ?? dir * Q.fm, fa = Math.abs(face), fs = Math.sign(face) || 1, torsoK = 0.8 + 0.2 * Math.max(fa, 0.2);
  const hipY = seat ? -100 : -170, shY0 = hipY - 190, br = Math.sin(t * 2.6) * 1.5, shY = shY0 + Q.sh + br, wob = D.damped(t, react, 0.08, 0.42, 0.36), ang = Q.lean * dir;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  // 腿／凳（在身体后面）
  if (seat) { c.fillStyle = C.ink2; c.fillRect(-84, -100, 168, 22); [-60, 60].forEach(lx => { c.fillStyle = C.redD; c.fillRect(lx - 7, -78, 14, 78); });
    bar(c, [dir * 8, hipY - 20], [dir * 108, hipY - 20], 42, 38, dark); bar(c, [dir * 108, hipY - 20], [dir * 112, -12], 38, 34, dark); D.poly(c, [[dir * 96, -16], [dir * 160, -16], [dir * 160, 0], [dir * 96, 0]], dark); }
  else { [[-40, -1], [40, 1]].forEach(([lx]) => { bar(c, [lx, hipY], [lx * 1.15, -14], 46, 40, dark); D.poly(c, [[lx * 1.15 - 22, -14], [lx * 1.15 + dir * 52, -14], [lx * 1.15 + dir * 52, 0], [lx * 1.15 - 22, 0]], dark); }); }
  // 上身绕胯点前倾
  const lp = (px, py) => { const cs = Math.cos(ang), sn = Math.sin(ang), dx = px, dy = py - hipY; return [x + (dx * cs - dy * sn) * s, y + (dx * sn + dy * cs + hipY) * s]; };
  c.translate(0, hipY); c.rotate(ang); c.translate(0, -hipY);
  const tw = 62 * torsoK, bw = 92 * torsoK;
  D.poly(c, [[-tw, shY], [tw, shY], [bw, hipY], [-bw, hipY]], col);
  D.poly(c, [[-tw, shY], [-tw * 0.3, shY], [-bw * 0.52, hipY], [-bw, hipY]], dark);                      // 暗面
  if (fa > 0.2) { const sd = fs, tx = sd * 0.0; D.poly(c, sd > 0 ? [[-6, shY + 52], [58, shY + 118], [38, shY + 132], [-6, shY + 84]] : [[6, shY + 52], [-58, shY + 118], [-38, shY + 132], [6, shY + 84]], accent); }   // 领带三角
  c.fillStyle = col; c.fillRect(-18, shY - 34, 36, 40);                                                    // 颈
  // 头
  const hx = Q.hd[0] * dir, hy = Q.hd[1], hc = [hx, shY - 88 + hy]; c.save(); c.translate(hx, shY - 30 + hy); c.rotate((Q.tilt + wob) * dir); c.translate(-hx, -(shY - 30 + hy));
  c.fillStyle = col; c.beginPath(); c.arc(hc[0], hc[1], 62, 0, TAU); c.fill();
  if (!noFace && fa > 0.04) { c.save(); c.beginPath(); c.arc(hc[0], hc[1], 62, 0, TAU); c.clip(); const start = 6 + (1 - fa) * 58;   // 半脸：朝向一侧奶白底＋网点
    c.fillStyle = C.cream; if (fs > 0) c.fillRect(hc[0] + start, hc[1] - 70, 140, 140); else c.fillRect(hc[0] - start - 140, hc[1] - 70, 140, 140);
    D.halftone(c, [[hc[0] - 80, hc[1] - 80], [hc[0] + 80, hc[1] - 80], [hc[0] + 80, hc[1] + 80], [hc[0] - 80, hc[1] + 80]], [hc[0] - 80, hc[1] - 80, hc[0] + 80, hc[1] + 80], col,
      (px, py) => { const u = (px - hc[0]) * fs - start; return u < -1 ? 0 : clamp(0.5 + u / 70 + (py - hc[1]) / 400); }, 10, 0.55); c.restore(); }
  c.restore();
  // 手臂（压在身体前面；奶白描边把手臂和同色身体分开）
  const hands = [], wig = pose === 'talk' || to === 'talk' ? Math.sin(t * 9) * 12 : 0;
  [['B', -dir], ['F', dir]].forEach(([k, side]) => { const T0 = Q[k], SS = [side * 62 * torsoK, shY + 6], T = [T0[0] * dir, shY + T0[1] + (k === 'F' ? wig : 0)], { E, Hn } = ik(SS, T, 118, 112, side);
    c.save(); bar(c, SS, E, 40, 34, col, C.cream); bar(c, E, Hn, 34, 28, col, C.cream);
    c.beginPath(); c.arc(Hn[0], Hn[1], 19, 0, TAU); c.fillStyle = col; c.fill(); c.stroke(); c.restore(); hands.push(Hn); });
  c.restore();
  return { head: lp(hc[0], hc[1]), top: lp(hc[0], hc[1] - 90), mouth: lp(hc[0] + dir * 62, hc[1] + 16), handF: lp(...hands[1]), handB: lp(...hands[0]), chest: lp(0, shY + 90), feet: [x, y] };
};
// 小人图标（人群、统计）：圆头＋梯形身；o.hop 跳起高度
D.mini = (c, x, y, s, col = C.ink, o = {}) => { const { alpha = 1, hop = 0, half = false } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y - hop); c.scale(s, s);
  D.poly(c, [[-26, -78], [26, -78], [40, 0], [-40, 0]], col); c.fillStyle = col; c.beginPath(); c.arc(0, -108, 26, 0, TAU); c.fill();
  if (half) { c.save(); c.beginPath(); c.arc(0, -108, 26, 0, TAU); c.clip(); c.fillStyle = C.cream; c.fillRect(4, -140, 40, 60); D.halftone(c, [[4, -140], [40, -140], [40, -80], [4, -80]], [4, -140, 40, -80], col, () => 0.8, 7, 0.55); c.restore(); }
  c.restore(); };
// 人群剪影：cols×rows 交错网格，底行中点 (cx,y)；o.hi 高亮序号数组（红色并跳起，o.hiAt 起跳时刻配 o.lt），o.dim 其余淡化，o.appear 逐个砸出的起点秒
D.crowd = (c, cx, y, cols, rows, gap, s, o = {}) => { const { seed = 3, hi = [], hiCol = C.red, lt = 0, hiAt = 0, dim = 0, appear = null, col = C.ink, half = true } = o;
  for (let r = rows - 1; r >= 0; r--) for (let k = 0; k < cols; k++) { const i = r * cols + k, isH = hi.includes(i), xx = cx + (k - (cols - 1) / 2) * gap + (r % 2) * gap * 0.3, yy = y - r * gap * 0.62;
    const a = appear == null ? 1 : D.pop(lt, appear + i * 0.03, 0.3); if (a <= 0) continue;
    const base = U.hash(i, seed) < 0.3 ? C.ink2 : col, cc = isH ? hiCol : dim ? D.mix(base, C.paper2, dim * 0.7) : base, hop = isH ? Math.max(0, -D.damped(lt, hiAt, 24, 0.5, 0.45)) : 0;
    D.mini(c, xx, yy, s * a, cc, { hop, half: half && !isH ? U.hash(i, seed + 4) < 0.5 : half && isH }); } };
D.mix = (a, b, k) => { const f = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const u = f(a), v = f(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };

// ---------- 桌子 ----------
// K.table(c, cx, y, o) —— y 是地面线；桌面高 o.h（默认 190，坐姿手搁的高度）。o.kind: 'square' 方桌 | 'round' 圆桌（单柱）| 'long' 长桌（肩并肩，四腿）；o.w 宽；o.p 0..1 从中心展开；o.tilt 桌面微斜
// 返回 { top: 桌面上沿 y, x0, x1 }，好往桌上放杯子、手机。先画人再画桌（桌挡住下半身）。
D.table = (c, cx, y, o = {}) => { const { kind = 'square', h = 190, p = 1, tilt = -0.012, col = C.ink, leg = C.red } = o, w = o.w ?? (kind === 'long' ? 900 : kind === 'round' ? 360 : 440), th = 30, q = MO.cubicOut(clamp(p));
  const x0 = cx - w / 2, x1 = cx + w / 2, top = y - h, dy = w * tilt; if (q <= 0) return { top, x0, x1 };
  c.save(); c.translate(cx, 0); c.scale(q, 1); c.translate(-cx, 0);
  if (kind === 'round') { D.poly(c, [[cx - 22, top + th], [cx + 22, top + th], [cx + 22, y - 18], [cx - 22, y - 18]], leg); D.poly(c, [[cx - 100, y - 18], [cx + 100, y - 18], [cx + 100, y], [cx - 100, y]], col);
    c.fillStyle = col; c.beginPath(); c.ellipse(cx, top + 14, w / 2, 26, 0, 0, TAU); c.fill(); c.fillStyle = C.paper; c.globalAlpha *= 0; c.globalAlpha = 1; D.poly(c, [[cx - w / 2 + 40, top + 14], [cx + w / 2 - 40, top + 14], [cx + w / 2 - 70, top + 28], [cx - w / 2 + 70, top + 28]], C.ink2); }
  else { const legs = kind === 'long' ? [x0 + 24, x0 + w * 0.34, x1 - w * 0.34 - 26, x1 - 50] : [x0 + 24, x1 - 50];
    legs.forEach(lx => D.poly(c, [[lx, top + th], [lx + 26, top + th], [lx + 26, y], [lx, y]], leg));
    D.poly(c, [[x0 + 24, top + th + 60], [x1 - 24, top + th + 60 + dy], [x1 - 24, top + th + 76 + dy], [x0 + 24, top + th + 76]], col);
    D.poly(c, [[x0, top], [x1, top + dy], [x1, top + dy + th], [x0, top + th]], col); D.poly(c, [[x0, top + th - 8], [x1, top + dy + th - 8], [x1, top + dy + th], [x0, top + th]], leg); }
  c.restore(); return { top, x0, x1 }; };

// ---------- 图标（都以中心 (x,y) 为准，s=1 约 120px；col 主色；颜色只用红/黑/奶白） ----------
D.heartPath = () => D.once('cs_heart', () => { const q = new Path2D(); q.moveTo(0, 46); q.bezierCurveTo(-70, -2, -52, -58, -24, -58); q.bezierCurveTo(-10, -58, 0, -46, 0, -34); q.bezierCurveTo(0, -46, 10, -58, 24, -58); q.bezierCurveTo(52, -58, 70, -2, 0, 46); q.closePath(); return q; });
// 心：o.t 给全片时间则跳动；o.ring 加黑色虚线转圈
D.heart = (c, x, y, s = 1, col = C.red, o = {}) => { const b = o.t != null ? 1 + 0.07 * Math.max(0, Math.sin(o.t * 9)) : 1; tf(c, x, y, s * b * 1.2, o.rot || 0, () => { c.fillStyle = col; c.fill(D.heartPath()); });
  if (o.ring) { c.save(); c.strokeStyle = C.ink; c.lineWidth = 6; c.setLineDash([24, 14]); c.lineDashOffset = -(o.t || 0) * 60; c.beginPath(); c.arc(x, y - 6 * s, 82 * s, 0, TAU); c.stroke(); c.restore(); } };
// 齿轮：rot 转角（配 lt 让它转；啮合的两个齿轮反向转）
D.gear = (c, x, y, r = 60, rot = 0, col = C.ink) => { c.save(); c.translate(x, y); c.rotate(rot); const p = new Path2D(), n = 8;
  for (let i = 0; i < n; i++) { const a = i * TAU / n, w = 0.2; [[a - w, 1], [a - w * 0.7, 1.3], [a + w * 0.7, 1.3], [a + w, 1], [a + 0.4, 1]].forEach(([an, k]) => p.lineTo(Math.cos(an) * r * k, Math.sin(an) * r * k)); }
  p.closePath(); p.moveTo(r * 0.4, 0); p.arc(0, 0, r * 0.4, 0, TAU, true); c.fillStyle = col; c.fill(p, 'evenodd'); c.restore(); };
// 杯子：o.t 让热气三角波上飘；o.col 杯色
D.cup = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const col = o.col || C.red;
  if (o.t != null) { c.fillStyle = C.ink; [-26, 4, 34].forEach((sx, i) => { const k = (o.t * 0.8 + i / 3) % 1; c.globalAlpha = 1 - k; D.poly(c, [[sx - 8, -92 - k * 50], [sx + 8, -92 - k * 50], [sx, -134 - k * 50]], C.ink); }); c.globalAlpha = 1; }
  c.strokeStyle = C.ink; c.lineWidth = 14; c.beginPath(); c.arc(56, -42, 28, -1.45, 1.45); c.stroke();
  D.poly(c, [[-58, -86], [58, -86], [44, 0], [-44, 0]], col); D.poly(c, [[-58, -86], [-30, -86], [-20, 0], [-44, 0]], D.mix(col, C.ink, 0.35)); c.fillStyle = C.ink; c.fillRect(-72, 0, 144, 12); });
// 手机：o.screen(c) 在屏幕坐标 (-60..60, -100..100) 画内容；o.buzz 震动时刻配 o.t；o.lit 亮屏
D.phone = (c, x, y, s = 1, o = {}) => { const jit = o.buzz != null && o.t != null && o.t - o.buzz > 0 && o.t - o.buzz < 0.6 ? Math.sin((o.t - o.buzz) * 80) * 6 : 0;
  tf(c, x + jit, y, s, o.rot || 0, () => { D.poly(c, [[-70, -120], [70, -120], [70, 120], [-70, 120]], C.ink); c.fillStyle = o.lit ? C.cream : C.ink2; c.fillRect(-58, -100, 116, 196);
    if (o.screen) { c.save(); c.beginPath(); c.rect(-58, -100, 116, 196); c.clip(); o.screen(c); c.restore(); } else if (o.lit) { c.fillStyle = C.red; c.fillRect(-42, -78, 84, 26); c.fillStyle = C.ink; c.fillRect(-42, -34, 84, 14); c.fillRect(-42, -6, 56, 14); c.fillRect(-42, 22, 70, 14); }
    c.fillStyle = C.red; c.fillRect(-18, 104, 36, 8); }); };
// 对话气泡：矩形＋三角尾巴指向 (tx,ty)，黑色错位投影；o.text 逐字打出；o.dots 画「…」；o.fill 默认奶白（红底时字奶白）；(x,y) 是中心
D.bubble = (c, x, y, w, h, lt, at, o = {}) => { const { fill = C.cream, text = '', size = 52, tx = x - w * 0.3, ty = y + h * 0.5 + 70, dots = false, rot = 0 } = o; if (lt < at) return;
  const k = MO.slamK(clamp((lt - at) / 0.17) * 0.9 + 0.1, 1.3), col = fill === C.red ? C.cream : C.ink; c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
  const tail = [[-w * 0.3, h / 2 - 2], [-w * 0.1, h / 2 - 2], [(tx - x) / k, (ty - y) / k]];
  c.fillStyle = C.ink; c.fillRect(-w / 2 + 9, -h / 2 + 9, w, h); D.poly(c, tail.map(([a, b]) => [a + 9, b + 9]), C.ink);
  c.fillStyle = fill; c.fillRect(-w / 2, -h / 2, w, h); D.poly(c, tail, fill); c.strokeStyle = C.ink; c.lineWidth = 6; c.strokeRect(-w / 2, -h / 2, w, h);
  c.fillStyle = fill; c.fillRect(-w * 0.1 - (w * 0.2), h / 2 - 4, w * 0.2 + 2, 8);
  if (text) D.text(c, TY.typed(text, D.at(lt, at + 0.15, [...text].length / 18)), 0, 3, { size, fam: 'PuHui-Heavy', col, maxW: w * 0.88 });
  if (dots) for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin(lt * 7 - i * 0.9)) * 10; c.fillStyle = col; c.fillRect(-48 + i * 40, -10 - b, 20, 20); }
  c.restore(); };
D.question = (c, x, y, s = 1, col = C.red, o = {}) => { if ((o.lt ?? 1) < (o.at ?? 0)) return; const k = o.lt != null ? MO.slamK((o.lt - o.at) / 0.17) : 1; D.text(c, '?', x, y, { size: 150 * s, col, rot: (o.rot ?? 0.1) + Math.sin((o.t || 0) * 3) * 0.05, scale: k }); };
D.exclaim = (c, x, y, s = 1, col = C.red, o = {}) => { if ((o.lt ?? 1) < (o.at ?? 0)) return; const k = o.lt != null ? MO.slamK((o.lt - o.at) / 0.17) : 1; D.text(c, '!', x, y, { size: 150 * s, col, rot: (o.rot ?? -0.1), scale: k }); };
// 箭头：粗直杆＋三角头，p 画出进度；w 杆宽；o.col；o.head 头长
D.arrow = (c, x0, y0, x1, y1, p = 1, o = {}) => { const { col = C.ink, w = 22, head = 56 } = o; if (p <= 0) return; const q = MO.cubicOut(clamp(p)), L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), l = L * q;
  c.save(); c.translate(x0, y0); c.rotate(a); c.fillStyle = col; c.fillRect(0, -w / 2, Math.max(0, l - head * 0.6), w); if (l > 8) D.poly(c, [[l, 0], [l - head, -head * 0.62], [l - head, head * 0.62]], col); c.restore(); };
// 硬币（货币／秘密的价值）：圆＋内环＋方孔星；o.spin 0..1 让它绕竖轴转（宽度压缩）
D.coin = (c, x, y, r = 60, col = C.red, o = {}) => { const k = Math.max(0.12, Math.abs(Math.cos((o.spin || 0) * TAU))); c.save(); c.translate(x, y); c.scale(k, 1);
  c.fillStyle = C.ink; c.beginPath(); c.arc(8, 8, r, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = C.cream; c.lineWidth = r * 0.09; c.beginPath(); c.arc(0, 0, r * 0.76, 0, TAU); c.stroke();
  c.fillStyle = C.cream; c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.2 : r * 0.5, an = i / 10 * TAU - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore(); };
// 锁（秘密）：o.open 0..1 锁梁抬起
D.lock = (c, x, y, s = 1, col = C.ink, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const op = clamp(o.open || 0); c.strokeStyle = col; c.lineWidth = 18; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-34, -20 - op * 22); c.lineTo(-34, -64 - op * 22); c.arc(0, -64 - op * 22, 34, Math.PI, 0); c.lineTo(34, -40 - op * 22 * (1 - op)); c.stroke();
  c.fillStyle = col; c.fillRect(-60, -24, 120, 96); c.fillStyle = C.red; c.beginPath(); c.arc(0, 18, 14, 0, TAU); c.fill(); c.fillRect(-6, 18, 12, 30); });
// 扩音喇叭（罗德琴科）：锥＋柄；o.t 让声波楔形抖；dir 1 朝右
D.megaphone = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const d = o.dir ?? 1; c.scale(d, 1); D.poly(c, [[-70, -20], [-20, -20], [70, -66], [70, 66], [-20, 20], [-70, 20]], o.col || C.red); D.poly(c, [[-70, -20], [-20, -20], [-20, 20], [-70, 20]], C.ink);
  D.poly(c, [[-50, 20], [-24, 20], [-30, 78], [-56, 78]], C.ink); if (o.t != null) for (let i = 0; i < 3; i++) { const k = ((o.t * 1.5 + i / 3) % 1); c.globalAlpha = 1 - k; D.poly(c, [[88 + k * 80, -22 - i * 16], [110 + k * 80, -22 - i * 16 - 8], [110 + k * 80, 22 + i * 16 + 8], [88 + k * 80, 22 + i * 16]], C.ink); } c.globalAlpha = 1; });
// 领奖台（排位）：三级台阶，o.hi 高亮第几名（0 起，红），o.p 升起进度；标「1 2 3」
D.podium = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const hs = [150, 210, 110], xs = [-110, 0, 110], order = [1, 0, 2], p = o.p ?? 1;
  order.forEach((rk, j) => { const q = MO.backOut(clamp(p * 1.4 - j * 0.15), 1.4), h = hs[j] * q; if (h < 1) return; const hi = o.hi === rk; D.poly(c, [[xs[j] - 54, 0], [xs[j] + 54, 0], [xs[j] + 54, -h], [xs[j] - 54, -h]], hi ? C.red : C.ink);
    D.poly(c, [[xs[j] - 54, -h], [xs[j] - 20, -h], [xs[j] - 20, 0], [xs[j] - 54, 0]], hi ? C.redD : C.ink2); D.text(c, String(rk + 1), xs[j] + 10, -h / 2, { size: 64, col: C.cream, alpha: clamp(q) }); }); });
D.check = (c, x, y, s = 1, col = C.red, p = 1) => { if (p <= 0) return; c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.lineWidth = 22; c.lineCap = 'butt'; c.lineJoin = 'miter'; const q = clamp(p); c.beginPath(); c.moveTo(-44, 4); c.lineTo(lerp(-44, -10, clamp(q * 2)), lerp(4, 40, clamp(q * 2))); if (q > 0.5) c.lineTo(lerp(-10, 50, (q - 0.5) * 2), lerp(40, -40, (q - 0.5) * 2)); c.stroke(); c.restore(); };
D.cross = (c, x, y, s = 1, col = C.ink, p = 1) => { if (p <= 0) return; c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.lineWidth = 22; c.lineCap = 'butt'; const q = MO.cubicOut(clamp(p)) * 40; c.beginPath(); c.moveTo(-q, -q); c.lineTo(q, q); c.moveTo(q, -q); c.lineTo(-q, q); c.stroke(); c.restore(); };
D.clock = (c, x, y, r = 80, o = {}) => { const h = o.h ?? 10.1; c.save(); c.translate(x, y); c.fillStyle = C.ink; c.beginPath(); c.arc(8, 8, r, 0, TAU); c.fill(); c.fillStyle = C.cream; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = C.ink; c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillStyle = C.ink; c.fillRect(Math.sin(a) * r * 0.8 - 3, -Math.cos(a) * r * 0.8 - 3, 6, 6); }
  [[h / 12 * TAU, 0.5, 0.1, C.ink], [(h % 1) * TAU, 0.76, 0.06, C.red]].forEach(([a, L, w, col]) => { c.strokeStyle = col; c.lineWidth = r * w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * r * L, -Math.cos(a) * r * L); c.stroke(); }); c.fillStyle = C.ink; c.fillRect(-7, -7, 14, 14); c.restore(); };
D.star = (c, x, y, r = 40, col = C.red, rot = 0) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.42 : r, an = i / 10 * TAU - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore(); };

// ---------- 图示：柱图、横条、分布、时间轴、印章、卡片 ----------
// 柱图（示意）：vals 0..1（占 h 的比例），p 长高进度；o.labels 柱下字，o.valLabels 柱顶字，o.hi 红色的那根，o.cols 自定色，o.note 角标（默认「示意」，false 关）
D.bars = (c, x, y, w, h, vals, p, o = {}) => { const { labels = [], valLabels = [], cols = null, hi = -1, gapK = 0.4, note = '示意' } = o, n = vals.length, bw = w / (n + (n - 1) * gapK);
  c.fillStyle = C.ink; c.fillRect(x - 20, y, w + 40, 10);
  vals.forEach((v, i) => { const q = MO.cubicOut(clamp(p * 1.3 - i * 0.12)), bh = h * v * q, bx = x + i * bw * (1 + gapK); if (bh > 2) { const col = cols ? cols[i] : i === hi ? C.red : C.ink;
      c.fillStyle = C.paper3; c.fillRect(bx + 12, y - bh + 12, bw, bh); c.fillStyle = col; c.fillRect(bx, y - bh, bw, bh); c.fillStyle = col === C.ink ? C.ink2 : C.redD; c.fillRect(bx, y - bh, bw * 0.22, bh);
      D.halftone(c, [[bx + bw * 0.22, y - bh], [bx + bw, y - bh], [bx + bw, y], [bx + bw * 0.22, y]], [bx, y - bh, bx + bw, y], C.cream, (px, py) => 0.15 * clamp((py - (y - bh)) / Math.max(1, bh)), 12, 0.5); }
    if (valLabels[i] && q > 0.6) D.text(c, valLabels[i], bx + bw / 2, y - bh - 42, { size: 56, col: i === hi ? C.red : C.ink, alpha: clamp(q * 2 - 0.6) });
    if (labels[i]) D.text(c, labels[i], bx + bw / 2, y + 58, { size: 48, fam: 'PuHui-Heavy', maxW: bw * 1.35, alpha: clamp(p * 3) }); });
  if (note) D.text(c, note, x + w, y + 118, { size: 40, fam: 'PuHui-Heavy', col: C.gray, align: 'right', alpha: clamp(p * 3) }); };
// 横条：rows [[标签, 0..1]]，行高 rh，条最长 w；p 进度；o.hi 红的行，o.valLabels，o.note
D.hbars = (c, x, y, w, rh, rows, p, o = {}) => { const { hi = -1, valLabels = [], note = '示意', labW = 200 } = o;
  c.fillStyle = C.ink; c.fillRect(x + labW, y - 20, 10, rows.length * rh + 12);
  rows.forEach(([lab, v], i) => { const q = MO.cubicOut(clamp(p * 1.3 - i * 0.12)), bh = rh * 0.64, yy = y + i * rh + (rh - bh) / 2 - 8, bl = (w - labW) * v * q, col = i === hi ? C.red : C.ink;
    D.text(c, lab, x + labW - 18, yy + bh / 2, { size: 50, fam: 'PuHui-Heavy', align: 'right', alpha: clamp(p * 3), maxW: labW - 20 });
    if (bl > 2) { c.fillStyle = C.paper3; c.fillRect(x + labW + 10 + 10, yy + 10, bl, bh); c.fillStyle = col; c.fillRect(x + labW + 10, yy, bl, bh); D.poly(c, [[x + labW + 10 + bl, yy], [x + labW + 10 + bl + 22, yy], [x + labW + 10 + bl, yy + bh]], col); }
    if (valLabels[i] && q > 0.6) D.text(c, valLabels[i], x + labW + 40 + bl, yy + bh / 2, { size: 52, col: i === hi ? C.red : C.ink, align: 'left', alpha: clamp(q * 2 - 0.6) }); });
  if (note) D.text(c, note, x + w, y + rows.length * rh + 36, { size: 40, fam: 'PuHui-Heavy', col: C.gray, align: 'right', alpha: clamp(p * 3) }); };
// 两条重叠的正态分布（效应量 / 分布重叠）：x,y = 基线左端；宽 w，峰高 h；d 两峰相距（标准差个数，可动画：从 0 拉开到 0.4…）；p 描线进度。
// 半透明叠色（黑＝A、红＝B），重叠部分奶白底＋网点；o.labels [A标签,B标签] 顶部；o.note 角标（默认「示意」）；o.means 画均值虚线；o.showOverlap 在重叠上标百分比
// 返回 { overlap: 重叠占比 0..1（=2Φ(−d/2)）, xa, xb 两峰屏幕 x }
D.dist = (c, x, y, w, h, p, o = {}) => { const { d = 1, cols = [C.ink, C.red], labels = [], note = '示意', means = true, showOverlap = false } = o, R = 3.4, span = d + 2 * R, X = u => x + (u + d / 2 + R) / span * w;
  const f = (u, m) => Math.exp(-(u - m) * (u - m) / 2), fa = u => f(u, -d / 2), fb = u => f(u, d / 2), N = 120, us = Array.from({ length: N + 1 }, (_, i) => -d / 2 - R + i / N * span);
  const erf = z => { const t = 1 / (1 + 0.3275911 * Math.abs(z)), y2 = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z); return z >= 0 ? y2 : -y2; };
  const ovl = 1 - erf(d / 2 / Math.SQRT2), xa = X(-d / 2), xb = X(d / 2);
  c.save(); c.beginPath(); c.rect(x - 30, y - h - 140, (w + 60) * clamp(p) , h + 300); c.clip();
  const curve = (fn, fill) => { c.beginPath(); c.moveTo(X(us[0]), y); us.forEach(u => c.lineTo(X(u), y - fn(u) * h)); c.lineTo(X(us[N]), y); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } };
  curve(fa, cols[0] === C.ink ? ink(0.5) : red(0.5)); curve(fb, cols[1] === C.red ? red(0.55) : ink(0.5));
  const ov = new Path2D(); ov.moveTo(X(us[0]), y); us.forEach(u => ov.lineTo(X(u), y - Math.min(fa(u), fb(u)) * h)); ov.lineTo(X(us[N]), y); ov.closePath();
  c.save(); c.clip(ov); c.fillStyle = C.cream; c.fillRect(x - 30, y - h - 20, w + 60, h + 40); D.halftone(c, [[x, y - h], [x + w, y - h], [x + w, y], [x, y]], [x, y - h, x + w, y], C.ink, () => 0.8, 11, 0.5); c.restore();
  c.lineWidth = 7; c.lineJoin = 'round'; [[fa, cols[0]], [fb, cols[1]]].forEach(([fn, col]) => { c.strokeStyle = col; c.beginPath(); us.forEach((u, i) => i ? c.lineTo(X(u), y - fn(u) * h) : c.moveTo(X(u), y - fn(u) * h)); c.stroke(); });
  c.fillStyle = C.ink; c.fillRect(x - 20, y, w + 40, 10);
  if (means) { c.lineWidth = 5; c.setLineDash([16, 10]); [[xa, cols[0]], [xb, cols[1]]].forEach(([xx, col]) => { c.strokeStyle = col; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y - h - 34); c.stroke(); }); c.setLineDash([]); }
  c.restore();
  if (labels[0] && p > 0.5) D.text(c, labels[0], xa, y - h - 76, { size: 56, col: cols[0], alpha: D.at(p, 0.5, 0.3) }); if (labels[1] && p > 0.5) D.text(c, labels[1], xb, y - h - 76, { size: 56, col: cols[1], alpha: D.at(p, 0.5, 0.3) });
  if (showOverlap && p > 0.8) D.text(c, `${Math.round(ovl * 100)}%`, (xa + xb) / 2, y + 66, { size: 70, col: C.ink, alpha: D.at(p, 0.8, 0.2) });
  if (note) D.text(c, note, x + w, y + 66, { size: 40, fam: 'PuHui-Heavy', col: C.gray, align: 'right', alpha: clamp(p * 3) });
  return { overlap: ovl, xa, xb }; };
// 时间轴：横杆＋方块站，cur 当前站（红）；labels 站名；p 进度
D.timeline = (c, x0, x1, y, labels, cur = -1, p = 1, o = {}) => { const n = labels.length, X = i => lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5);
  c.fillStyle = C.ink; c.fillRect(x0 - 10, y - 5, (x1 - x0 + 20) * MO.cubicOut(clamp(p)), 10);
  labels.forEach((s, i) => { const q = clamp(p * n - i); if (q <= 0) return; const on = i === cur, r = (on ? 26 : 17) * MO.backOut(q, 1.6);
    c.save(); c.translate(X(i), y); c.rotate(Math.PI / 4); c.fillStyle = C.ink; c.fillRect(-r + 6, -r + 6, r * 2, r * 2); c.fillStyle = on ? C.red : C.cream; c.fillRect(-r, -r, r * 2, r * 2); c.strokeStyle = C.ink; c.lineWidth = 5; c.strokeRect(-r, -r, r * 2, r * 2); c.restore();
    D.text(c, s, X(i), y + (i % 2 ? -70 : 78), { size: on ? 54 : 48, fam: 'PuHui-Heavy', col: on ? C.red : C.ink, alpha: q, maxW: (x1 - x0) / Math.max(1, n - 1) * 1.6 }); }); };
// 红印章标签：双线框＋粗体字，盖下（砸入）后留；o.sub 小字，o.rot 默认 -0.12，o.col，o.size
D.stamp = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const { size = 90, rot = -0.12, col = C.red, sub = '' } = o, k = MO.slamK((lt - at) / 0.17, 1.7), seed = o.seed || 7;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.globalAlpha *= clamp((lt - at) / 0.05) * 0.94; c.font = `${size}px "PuHui-Black"`; const tw = c.measureText(s).width, w = tw + size * 0.9, h = size * (sub ? 2.1 : 1.45);
  const J = (i, a) => (U.hash(i, seed) - 0.5) * a, pts = [[-w / 2 + J(1, 4), -h / 2 + J(2, 4)], [w / 2 + J(3, 4), -h / 2 + J(4, 4)], [w / 2 + J(5, 4), h / 2 + J(6, 4)], [-w / 2 + J(7, 4), h / 2 + J(8, 4)]];
  c.strokeStyle = col; c.lineWidth = 10; c.lineJoin = 'miter'; D.poly(c, pts); c.stroke(); c.lineWidth = 3.5; c.strokeRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32);
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, sub ? -size * 0.28 : size * 0.04); if (sub) { c.font = `${size * 0.4}px "PuHui-Heavy"`; c.fillText(sub, 0, size * 0.52); }
  const r = U.rng(seed); c.fillStyle = C.paper; c.globalAlpha *= 0.55; for (let i = 0; i < 26; i++) c.fillRect((r() - 0.5) * w, (r() - 0.5) * h, 3 + r() * 5, 2 + r() * 3);   // 磨损
  c.restore(); };
// 小卡片：奶白纸＋红顶条＋黑投影；(x,y) 中心；o.title 红条里的标题，o.lines 正文行（每行 ≥44px），o.draw(c, lt) 在卡内坐标（中心为原点）画图标；o.rot 默认 -0.03
D.card = (c, x, y, w, h, lt, at, o = {}) => { if (lt < at) return; const { title = '', lines = [], rot = -0.03, fill = C.cream, head = C.red } = o, k = MO.slamK(clamp((lt - at) / 0.17) * 0.9 + 0.1, 1.3);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.fillStyle = C.ink; c.fillRect(-w / 2 + 12, -h / 2 + 12, w, h); c.fillStyle = fill; c.fillRect(-w / 2, -h / 2, w, h);
  if (title) { c.fillStyle = head; c.fillRect(-w / 2, -h / 2, w, 84); D.text(c, title, -w / 2 + 28, -h / 2 + 44, { size: 54, col: C.cream, align: 'left', maxW: w - 56 }); }
  lines.forEach((ln, i) => D.text(c, TY.typed(ln, D.at(lt, at + 0.2 + i * 0.25, [...ln].length / 18)), -w / 2 + 30, -h / 2 + (title ? 150 : 60) + i * 70, { size: 48, fam: 'PuHui-Heavy', align: 'left', maxW: w - 60 }));
  if (o.draw) o.draw(c, lt - at); c.restore(); };

// ---------- 章节卡 ----------
// 斜红带刷出，带里一个大号章号（奶白）；上方「第 N 章」黑块砸入；下方粗黑章名逐字打出，楔形光束从章号射向章名；底部 N 站进度方块，本章红块砸入
(() => { const { at, pop } = D;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
D.chapterCard = (c, lt, t, n, title = '') => {
  const ang = Math.atan2(520 - 640, W), cy0 = 640, th = 440;
  D.bg(c, t, { disc: [830, 300, 330], rules: true });
  const q = at(lt, 0.0, 0.4); D.slab(c, cy0, 520, th, { p: q });
  if (q > 0.25) { c.save(); c.beginPath(); c.moveTo(0, cy0); c.lineTo(W, 520); c.lineTo(W, 520 + th); c.lineTo(0, cy0 + th); c.closePath(); c.clip();
    D.burst(c, 860, 520 + th / 2 - 40, 200, 700, 14, 0.2, C.redD, at(lt, 0.2, 0.7), { half: 0.07, alpha: 0.55 });
    c.restore(); }
  c.save(); c.translate(54, lerp(cy0, 520, 0.05) + th / 2 + 6); c.rotate(ang); const sk = MO.slamK(clamp((lt - 0.2) / 0.17)); if (lt > 0.2) { c.scale(sk, sk); c.font = '430px "PuHui-Black"'; c.fillStyle = C.ink; c.textBaseline = 'middle'; c.textAlign = 'left'; const ns = String(n).padStart(2, '0'); c.fillText(ns, 12, 12); c.fillStyle = C.cream; c.fillText(ns, 0, 0); } c.restore();
  if (lt > 0.1) D.plate(c, `第 ${n} 章`, 68, 440, { size: 76, rot: -0.05, fill: C.ink, col: C.cream, align: 'left', scale: MO.slamK((lt - 0.1) / 0.17) });
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(at(lt, 0.55, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 112 : all > 7 ? 124 : 140;
  D.wedge(c, 340, 446, 600, 600, 34, C.ink, at(lt, 0.3, 0.5), { alpha: 0.9 });
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) D.text(c, a.slice(0, k).join(''), 60, 1205 + i * size * 1.2, { size, align: 'left', maxW: 960, rot: ang * 0.6 }); });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 90, x1 = 990, y = lines.length > 1 ? 1355 : 1320, X = i => lerp(x0, x1, i / (N - 1)); c.fillStyle = C.ink; c.fillRect(x0 - 20, y - 4, x1 - x0 + 40, 8);
  for (let i = 0; i < N; i++) { const cur = i === n - 1, pp = cur ? pop(lt, 0.9, 0.4) : 1, r = cur ? 26 * Math.max(0.5, pp) : 15; c.save(); c.translate(X(i), y); c.rotate(Math.PI / 4); c.fillStyle = i < n - 1 ? C.red : cur ? C.red : C.cream; c.fillRect(-r, -r, r * 2, r * 2); c.strokeStyle = C.ink; c.lineWidth = 5; c.strokeRect(-r, -r, r * 2, r * 2); c.restore(); }
  D.finish(c);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：黑底板＋左端红块＋奶白字，字幕带 y≈1480
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 96), h = 92, x = 540, y = 1480;
  c.fillStyle = C.red; c.fillRect(x - w / 2 + 8, y - h / 2 + 8, w, h); c.fillStyle = C.ink; c.fillRect(x - w / 2, y - h / 2, w, h); c.fillStyle = C.red; c.fillRect(x - w / 2, y - h / 2, 18, h);
  c.fillStyle = C.cream; c.fillText(text, x + 8, y + 2, 960); c.restore();
};
})();
