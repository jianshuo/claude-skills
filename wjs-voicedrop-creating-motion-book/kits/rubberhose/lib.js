// 画风套件 rubberhose（配方 huashu-art-motion 33_rubberhose「1930 橡皮管卡通」，来自《AI 就是新时代的葵花宝典》）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：纸色单色系（做旧米色底＋深棕黑粗描边），朱砂红 K.C.red 只当点缀（额带圆点、剑穗、腰结、强调箭头），不铺面。
//       一切东西都用「粗黑描边＋纯色平涂」：手臂是没有肘的橡皮管 K.hose，手是四指白手套 K.glove，眼睛是派切眼（黑瞳切一楔）K.face。
//       时间：角色与母题一律 12fps 步进（K.tq(t)），随 128BPM 节拍上下弹跳＋挤压拉伸（K.bnc / K.boing）；只有胶片层 K.finish 按 24fps 变。
//       所有随机走 U.hash / U.rng 种子，同一 t 画同一帧。字体：大字 PuHui-Black / PuHui-Heavy（黑粗描边），字幕 PuHui-Bold，只用 GB2312 字。
// 版面：主体 y200–1350；字幕带 y1380–1560（K.finish 在此压暗但不全黑，K.subtitle 画黑底字幕牌，y≈1480）。人物 s=1 身高约 850px（含发髻），群像/章节卡用 0.2–0.4。
// 时间约定：需要动的函数都吃 o.t（全片时间 t，章节代码 draw(c,lt,t) 里的 t）；K.bg(c,t,…) 会记下 t，没传 o.t 的函数（气泡、finish）就取这个。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：backOut 回弹起步会让半径为负，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__rh) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__rh = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__rh) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__rh = 1; } }

// ---------- 色板 ----------
const C = D.C = {
  ink: '#141210', paper: '#efe7d2', paper2: '#e5dcc5', paper3: '#d9d0b8', mid: '#a39a84', dk: '#5e574b', dk2: '#3b362d',
  white: '#fbf7ec', hose: '#f4eedc', face: '#f8f3e6', brain: '#e9c9c0',
  red: '#B5412F', redLt: '#CF6A55',   // 朱砂：只点缀
};

// ---------- 进度 / 缓存 / 世界 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
const ell = D.ellipse, circ = D.circle;

// ---------- 12fps 步进＋节拍弹跳 ----------
const BEAT = D.BEAT = 60 / 128;
D.tq = t => Math.floor(t * 12) / 12;                                                  // 12fps 步进后的时间（赛璐珞的顿挫）
D.bnc = (tq, ph = 0) => Math.abs(Math.sin(Math.PI * (tq / BEAT + ph)));               // 0=落地 1=最高；ph 以拍为单位错开相位
// 以着地点 (ax,ay) 为轴：上弹 amp 像素；落地压扁、腾空拉长。fn 里画东西。
D.boing = (c, ax, ay, b, amp, fn, k = 1) => {
  c.save(); c.translate(ax, ay - b * amp); const sq = (1 - b) * 0.09 * k, st = b * 0.05 * k;
  c.scale(1 + sq - st * 0.6, 1 - sq + st); c.translate(-ax, -ay); fn(); c.restore();
};
const tOf = o => (o && o.t != null ? o.t : (D._t || 0));
// 粗黑描边笔
const ink = D.ink = (c, w = 6) => { c.strokeStyle = C.ink; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; };
const F = D.fillStroke = (c, p, col, w = 6) => { c.fillStyle = col; c.fill(p); ink(c, w); c.stroke(p); };
const SM = pts => RIG.smooth(pts, true);

// ---------- 底：墙纸竖条＋菱点＋地板 ----------
// tone：paper 做旧米色（默认）｜warm 暖黄｜dim 深一档｜night 夜（深灰褐）｜red 微朱砂调墙（只用于强调章节/高潮）
const TONES = {
  paper: { wall: '#efe7d2', stripe: '#e5dcc5', dia: '#cfc5ab', floor: '#cdc3a8', line: '#8a816c', base: '#5e574b' },
  warm: { wall: '#ecdcb9', stripe: '#e2cfa6', dia: '#c9b48a', floor: '#c8b48c', line: '#85734f', base: '#5a4a33' },
  dim: { wall: '#cfc6ad', stripe: '#c4baa0', dia: '#aa9f84', floor: '#a89e85', line: '#6b634f', base: '#403b30' },
  night: { wall: '#6f6a5c', stripe: '#655f52', dia: '#58534a', floor: '#514c42', line: '#37332b', base: '#26231e' },
  red: { wall: '#ead6c3', stripe: '#e0c4ae', dia: '#c98a73', floor: '#c9b69d', line: '#8a6a58', base: '#5e3a30' },
};
D.TONES = TONES;
D.bgTex = (tone = 'paper', pattern = 'stripe', floorY = 1330) => P.cached(`rh_bg_${tone}_${pattern}_${floorY}`, W, H, g => {
  const T = TONES[tone] || TONES.paper, wallH = floorY || H;
  g.fillStyle = T.wall; g.fillRect(0, 0, W, H);
  if (pattern === 'stripe') {
    for (let x = 0; x < W; x += 64) { g.fillStyle = T.stripe; g.fillRect(x, 0, 30, wallH); }
    g.fillStyle = T.dia; for (let y = 30; y < wallH; y += 70) for (let x = 47; x < W; x += 64) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 6, y); g.lineTo(x, y + 7); g.lineTo(x - 6, y); g.fill(); }
  } else if (pattern === 'dots') {
    g.fillStyle = T.stripe; for (let y = 0; y < wallH; y += 56) for (let x = ((y / 56) % 2) * 28; x < W; x += 56) { g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
  }
  if (floorY) {
    g.fillStyle = T.floor; g.fillRect(0, floorY, W, H - floorY);
    ink(g, 3); g.strokeStyle = T.line; let y = floorY + 26, gap = 40, row = 0;
    for (; y < H + 40; y += gap, gap += 7, row++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      const step = 150 + row * 30; for (let x = (row % 2) * step / 2 - step; x < W + step; x += step) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - W / 2) * 0.06, y + gap); g.stroke(); } }
    g.fillStyle = T.base; g.fillRect(0, floorY - 20, W, 22); ink(g, 5); g.beginPath(); g.moveTo(0, floorY - 20); g.lineTo(W, floorY - 20); g.moveTo(0, floorY + 2); g.lineTo(W, floorY + 2); g.stroke();
  }
});
// K.bg(c, t, {tone, pattern:'stripe'|'dots'|'plain', floor:1330|false})：t 必传（记下来给 finish/气泡当时间）
D.bg = (c, t, o = {}) => { D._t = t; const { tone = 'paper', pattern = 'stripe', floor = 1330 } = o; D.dark = tone === 'night'; c.drawImage(D.bgTex(tone, pattern, floor), 0, 0); };

// ---------- 橡皮管 / 白手套 ----------
// K.hose(c, A, B, bend, w, col, {bend2, line})：A→B 一根没有肘的面条，粗细恒定，黑边 +line(10)。bend 为控制点偏移（弧高≈bend/2，正负定方向）；
// 给 bend2 变成 S 形（面条甩动）。返回 {ang: B 处切线角, ctrl}，K.glove 用 ang 接着画。
D.hose = (c, A, B, bend = 0, w = 24, col = C.hose, o = {}) => {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; let tx, ty, ctrl;
  c.save(); c.beginPath(); c.moveTo(A[0], A[1]);
  if (o.bend2 !== undefined) { const c1 = [A[0] + dx / 3 + nx * bend, A[1] + dy / 3 + ny * bend], c2 = [A[0] + dx * 2 / 3 + nx * o.bend2, A[1] + dy * 2 / 3 + ny * o.bend2]; c.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], B[0], B[1]); tx = B[0] - c2[0]; ty = B[1] - c2[1]; ctrl = c2; }
  else { ctrl = [(A[0] + B[0]) / 2 + nx * bend, (A[1] + B[1]) / 2 + ny * bend]; c.quadraticCurveTo(ctrl[0], ctrl[1], B[0], B[1]); tx = B[0] - ctrl[0]; ty = B[1] - ctrl[1]; }
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = w + (o.line ?? 10); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.restore();
  return { ang: Math.atan2(ty, tx), ctrl };
};
// K.glove(c, x, y, ang, s, {pose:'open'|'point'|'fist'|'thumb'|'flat', cuff:true})：四指白手套，(x,y)=手腕，手指朝 +x，ang 弧度；s=1 手长约 90px
D.glove = (c, x, y, ang = 0, s = 1, o = {}) => {
  const pose = o.pose || 'open', W2 = C.white;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  const fing = (fx, fy, rx, ry, a = 0) => F(c, ell(fx, fy, rx, ry, a), W2, 5);
  if (pose === 'point') {
    F(c, SM([[-30, -16], [-6, -24], [18, -20], [28, -8], [28, 10], [18, 22], [-4, 24], [-22, 18], [-32, 4]]), W2, 5);
    fing(22, 16, 11, 8, 0.5); fing(14, 24, 10, 7, 0.7); fing(46, -6, 30, 10, -0.05); fing(2, -26, 12, 8, -0.6);
  } else if (pose === 'fist' || pose === 'thumb') {
    F(c, ell(4, 0, 30, 28), W2, 5);
    [[-14, 0], [-4.5, 0], [4.5, 0], [14, 0]].forEach(([dy]) => fing(30, dy * 1.05 + 0, 9, 8)); ink(c, 3); c.beginPath(); c.moveTo(18, -16); c.lineTo(34, -16); c.moveTo(18, 0); c.lineTo(36, 0); c.moveTo(18, 16); c.lineTo(34, 16); c.stroke();
    if (pose === 'thumb') fing(8, -40, 11, 22, 0.1); else fing(10, -28, 14, 9, -0.3);
  } else if (pose === 'flat') {
    F(c, SM([[-30, -16], [-8, -24], [14, -22], [26, -12], [28, 12], [14, 22], [-8, 24], [-26, 18], [-32, 4]]), W2, 5);
    [-15, -5, 5, 15].forEach((dy, i) => fing(48, dy, 22, 6.5)); fing(8, -30, 18, 9, -0.35);
  } else {
    F(c, SM([[-30, -14], [-8, -24], [16, -22], [30, -12], [34, 4], [24, 20], [4, 24], [-20, 18], [-32, 4]]), W2, 5);
    [[22, -18], [30, -6], [30, 8]].forEach(([fx, fy]) => fing(fx + 6, fy, 11, 8, 0.2)); fing(10, 26, 12, 8, 0.5);
    ink(c, 3); [-6, 2, 10].forEach(xx => { c.beginPath(); c.moveTo(xx - 10, xx * 0.2 - 2); c.lineTo(xx + 2, xx * 0.2 - 4); c.stroke(); });
  }
  if (o.cuff !== false) F(c, SM([[-30, -20], [-46, -26], [-52, 0], [-46, 26], [-30, 20], [-26, 0]]), W2, 5);
  c.restore();
};

// ---------- 脸：派切眼 / 螺旋眼 ----------
const pieEye = (c, x, y, rx, ry, lk = 0, lkY = 0) => {
  const E = ell(x, y, rx, ry); F(c, E, C.white, 4.5);
  const px = x + lk * rx * 0.35, py = y + ry * 0.2 + lkY * ry * 0.3;
  c.save(); c.clip(E); c.fillStyle = C.ink; c.beginPath(); c.ellipse(px, py, rx * 0.62, ry * 0.7, 0, 0, TAU); c.fill();
  c.fillStyle = C.white; c.beginPath(); c.moveTo(px + rx * 0.05, py - ry * 0.05); c.arc(px, py, ry, -1.45, -0.85); c.closePath(); c.fill(); c.restore();
  ink(c, 4.5); c.stroke(E);
};
const spiralEye = (c, x, y, rx, ry, rot) => {
  const E = ell(x, y, rx, ry); F(c, E, C.white, 4.5); c.save(); c.clip(E); ink(c, 4.5); c.beginPath();
  for (let a = 0; a < 17; a += 0.3) { const rr = 2 + a * (rx * 0.05), px = x + Math.cos(a + rot) * rr, py = y + Math.sin(a + rot) * rr * (ry / rx); a ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); c.restore(); ink(c, 4.5); c.stroke(E);
};
const brow = (c, x0, y0, x1, y1, bend = -6, w = 6.5) => { ink(c, w); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend, x1, y1); c.stroke(); };
// K.face(c, x, y, r, {mood, t, look, lookY, fill, bare, talk, blink, ph, tilt, lash})
// mood：calm 平静｜happy 开心(∩眼)｜grin 咧嘴坏笑｜dizzy 螺旋眼晕｜shock 惊｜sad 难过(泪)｜angry 怒｜worry 担心(汗)｜sleep 睡｜smirk 得意斜笑｜none 只画脸圈
// (x,y)=脸圆心，r=脸半径。bare:true 只画五官不画脸圈（给脑子、太阳等别的底形用）。talk 0..1 张嘴说话（12fps 开合）。
D.face = (c, x, y, r, o = {}) => {
  const { mood = 'calm', look = 0, lookY = 0, fill = C.face, bare = false, talk = 0, ph = 0, tilt = 0, lash = false } = o, t = tOf(o), tq = D.tq(t);
  const auto = ['calm', 'smirk', 'grin', 'worry', 'sad'].includes(mood) && ((t + ph * 3.7) % 3.6) < 0.13;
  const blink = o.blink !== undefined ? o.blink : auto;
  c.save(); c.translate(x, y); c.rotate(tilt); c.scale(r / 100, r / 100);
  if (!bare) F(c, ell(0, 0, 100, 96), fill, 8);
  const ex = 38, ey = 8, rx = 21, ry = 27, mo = ((Math.floor(t * 12 + ph * 7)) % 2) === 0 ? talk : 0;
  const closedEyes = up => { ink(c, 7); [-ex, ex].forEach(X => { c.beginPath(); c.arc(X, up ? ey + 8 : ey - 2, 17, up ? Math.PI : 0, up ? TAU : Math.PI); c.stroke(); }); };
  const cheeks = () => { c.fillStyle = C.mid; c.globalAlpha *= 0.75; [-68, 68].forEach(X => { c.beginPath(); c.arc(X, 36, 12, 0, TAU); c.fill(); }); c.globalAlpha /= 0.75; };
  const nose = (dy = 28) => { c.fillStyle = C.ink; c.beginPath(); c.ellipse(0, dy, 9, 7, 0, 0, TAU); c.fill(); };
  const mouthOpen = (w, h, y0, tongue = true) => { const M = SM([[-w, y0], [0, y0 + 4], [w, y0], [w * 0.7, y0 + h], [0, y0 + h + 6], [-w * 0.7, y0 + h]]); F(c, M, C.ink, 5.5);
    if (tongue) { c.save(); c.clip(M); c.fillStyle = C.mid; c.beginPath(); c.ellipse(0, y0 + h + 6, w * 0.5, h * 0.45, 0, 0, TAU); c.fill(); c.restore(); } };
  const smile = (w, y0, d = 0.25) => { ink(c, 6); c.beginPath(); c.arc(0, y0 - 14, w, d, Math.PI - d); c.stroke(); };
  if (mood !== 'none') {
    if (mood === 'calm') { if (blink) closedEyes(false); else { pieEye(c, -ex, ey, rx, ry, look, lookY); pieEye(c, ex, ey, rx, ry, look, lookY); }
      brow(c, -62, -26, -18, -30); brow(c, 18, -30, 62, -26); nose(); if (mo) mouthOpen(18, 14 * mo, 48); else smile(20, 60); }
    else if (mood === 'happy') { closedEyes(true); brow(c, -62, -30, -18, -38, -8); brow(c, 18, -38, 62, -30, -8); nose(24); cheeks(); mouthOpen(34, 30 + 10 * mo, 38); }
    else if (mood === 'grin') {
      [-ex, ex].forEach(X => { pieEye(c, X, ey + 4, rx, ry * 0.9, look, 0); c.save(); c.clip(ell(X, ey + 4, rx, ry * 0.9)); c.fillStyle = fill; c.fillRect(X - 30, ey - 40, 60, 40); c.restore(); ink(c, 6); c.beginPath(); c.moveTo(X - rx - 3, ey + 2); c.lineTo(X + rx + 3, ey + 2); c.stroke(); });
      brow(c, -62, -18, -18, -26, -4); brow(c, 18, -26, 62, -18, -4); nose(24); cheeks();
      const M = SM([[-52, 36], [0, 42], [52, 36], [44, 70], [0, 82], [-44, 70]]); F(c, M, C.white, 6); c.save(); c.clip(M); ink(c, 4); for (let k = -36; k <= 36; k += 12) { c.beginPath(); c.moveTo(k, 36); c.lineTo(k, 90); c.stroke(); } c.beginPath(); c.moveTo(-60, 56); c.lineTo(60, 56); c.stroke(); c.restore(); ink(c, 6); c.stroke(M); }
    else if (mood === 'dizzy') { const rot = tq * 6; spiralEye(c, -ex, ey, rx + 3, ry, rot); spiralEye(c, ex, ey, rx + 3, ry, -rot);
      brow(c, -64, -30, -16, -22, -8); brow(c, 16, -22, 64, -30, -8); nose(26); cheeks();
      const wob = Math.sin(tq * 14) * 3; ink(c, 6); c.beginPath(); c.moveTo(-26, 58); for (let i = 1; i <= 6; i++) c.lineTo(-26 + i * 8.7, 58 + (i % 2 ? 9 : -2) + wob); c.stroke(); }
    else if (mood === 'shock') { const j = Math.sin(tq * 40) * 1.5;
      c.save(); c.translate(j, 0); [-ex, ex].forEach(X => { const E = ell(X, ey - 2, 25, 33); F(c, E, C.white, 4.5); c.fillStyle = C.ink; c.beginPath(); c.arc(X + look * 6, ey - 2, 5.5, 0, TAU); c.fill(); });
      brow(c, -68, -50, -18, -56, -6); brow(c, 18, -56, 68, -50, -6); const M = ell(0, 60, 16, 22); F(c, M, C.ink, 5); c.restore(); }
    else if (mood === 'sad') { if (blink) closedEyes(false); else { pieEye(c, -ex, ey + 4, rx, ry, 0, 1); pieEye(c, ex, ey + 4, rx, ry, 0, 1); }
      brow(c, -64, -18, -18, -34, 2); brow(c, 18, -34, 64, -18, 2); nose(30); ink(c, 6); c.beginPath(); c.arc(0, 78, 20, Math.PI + 0.35, TAU - 0.35); c.stroke();
      const dr = 0.5 + 0.5 * Math.sin(tq * 5); c.save(); c.translate(-ex - 6, 38 + dr * 14); F(c, SM([[0, -14], [9, 2], [0, 10], [-9, 2]]), C.white, 4); c.restore(); }
    else if (mood === 'angry') { pieEye(c, -ex, ey + 6, rx - 2, ry - 8, 0.3, 0); pieEye(c, ex, ey + 6, rx - 2, ry - 8, -0.3, 0);
      brow(c, -66, -34, -14, -12, 0, 9); brow(c, 14, -12, 66, -34, 0, 9); nose(30);
      const M = SM([[-30, 74], [0, 62], [30, 74], [22, 86], [0, 90], [-22, 86]]); F(c, M, C.ink, 5.5); c.save(); c.clip(M); c.fillStyle = C.white; c.fillRect(-26, 62, 52, 10); c.restore(); }
    else if (mood === 'worry') { if (blink) closedEyes(false); else { pieEye(c, -ex, ey, rx, ry, 0.3, 0.4); pieEye(c, ex, ey, rx, ry, 0.3, 0.4); }
      brow(c, -64, -20, -18, -36, 2); brow(c, 18, -36, 64, -20, 2); nose(28);
      ink(c, 6); c.beginPath(); c.moveTo(-24, 66); for (let i = 1; i <= 6; i++) c.lineTo(-24 + i * 8, 66 + (i % 2 ? -5 : 4)); c.stroke();
      c.save(); c.translate(82, -34 + (tq * 8 % 1) * 6); F(c, SM([[0, -20], [11, 2], [0, 14], [-11, 2]]), C.white, 4.5); c.restore(); }
    else if (mood === 'sleep') { closedEyes(false); brow(c, -62, -22, -18, -24); brow(c, 18, -24, 62, -22); nose(26); const br = 6 + 3 * Math.sin(tq * 3); F(c, ell(0, 62, 9 + br * 0.4, 7 + br * 0.5), C.ink, 4); }
    else if (mood === 'smirk') { [-ex, ex].forEach(X => { pieEye(c, X, ey + 4, rx, ry * 0.9, 0.6, 0); c.save(); c.clip(ell(X, ey + 4, rx, ry * 0.9)); c.fillStyle = fill; c.fillRect(X - 30, ey - 40, 60, 38); c.restore(); ink(c, 6); c.beginPath(); c.moveTo(X - rx - 3, ey + 1); c.lineTo(X + rx + 3, ey + 1); c.stroke(); });
      brow(c, -62, -20, -18, -30, -4); brow(c, 18, -22, 62, -36, -6); nose(26); cheeks(); ink(c, 6); c.beginPath(); c.moveTo(-26, 66); c.quadraticCurveTo(10, 76, 40, 52); c.stroke(); }
    if (lash) { ink(c, 4); [-ex, ex].forEach(X => { for (let k = 0; k < 3; k++) { const a = -2.5 + k * 0.45; c.beginPath(); c.moveTo(X + Math.cos(a) * rx, ey + Math.sin(a) * ry); c.lineTo(X + Math.cos(a) * (rx + 14), ey + Math.sin(a) * (ry + 14)); c.stroke(); } }); }
  }
  c.restore();
};

// ---------- 小符号（汗、星、问号、叹号、怒、Z） ----------
// K.emote(c, kind, x, y, s, {t, p}) kind: sweat stars question exclaim anger zzz sparkle
D.emote = (c, kind, x, y, s = 1, o = {}) => {
  const tq = D.tq(tOf(o)), p = o.p == null ? 1 : o.p; if (p <= 0) return; c.save(); c.translate(x, y); c.scale(s * p, s * p);
  if (kind === 'sweat') { const dy = (tq * 6 % 1) * 12; [[0, 0], [34, 20]].forEach(([dx, d2], i) => { c.save(); c.translate(dx, d2 + dy * (i ? 0.7 : 1)); F(c, SM([[0, -24], [14, 4], [0, 18], [-14, 4]]), C.white, 5); c.restore(); }); }
  else if (kind === 'stars') { for (let i = 0; i < 3; i++) { const a = tq * 5 + i * TAU / 3; c.save(); c.translate(Math.cos(a) * 80, Math.sin(a) * 22); c.rotate(a * 2); D.burst(c, 0, 0, 26, { n: 5, inner: 0.45, col: C.white, spin: 0 }); c.restore(); } }
  else if (kind === 'question' || kind === 'exclaim') D.text(c, kind === 'question' ? '?' : '!', 0, 0, { size: 120, rot: Math.sin(tq * 9) * 0.12 });
  else if (kind === 'anger') { ink(c, 9); c.strokeStyle = C.red; const k = 1 + 0.12 * Math.sin(tq * 16); c.scale(k, k); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { c.beginPath(); c.arc(sx * 20, sy * 20, 18, sx > 0 ? (sy > 0 ? Math.PI * 0.5 : Math.PI) : (sy > 0 ? 0 : Math.PI * 1.5), (sx > 0 ? (sy > 0 ? Math.PI * 0.5 : Math.PI) : (sy > 0 ? 0 : Math.PI * 1.5)) + Math.PI * 0.5); c.stroke(); }); }
  else if (kind === 'zzz') { for (let i = 0; i < 3; i++) { const q = (tq * 0.6 + i / 3) % 1; c.save(); c.translate(q * 60, -q * 120); c.globalAlpha *= 1 - q * q; D.text(c, 'Z', 0, 0, { size: 50 + i * 16 }); c.restore(); } }
  else if (kind === 'sparkle') { D.burst(c, 0, 0, 40 * (1 + 0.2 * Math.sin(tq * 14)), { n: 4, inner: 0.2, col: C.white }); }
  c.restore();
};

// ---------- 光芒 ----------
// K.burst(c, x, y, r, {n, inner(0..1 内圈比), col, line(描边 w|false), spin(rad/s), rot, alt(长短交替 0..1), t, alpha})
D.burst = (c, x, y, r, o = {}) => {
  const { n = 14, inner = 0.5, col = C.white, line = 5, spin = 0, rot = 0, alt = 0.18, alpha = 1 } = o, a0 = rot + D.tq(tOf(o)) * spin;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(a0); c.fillStyle = col; ink(c, line || 1);
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, tip = i % 2 === 0, rr = tip ? r * (1 - ((i / 2) % 2) * alt) : r * inner; i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill(); if (line) c.stroke(); c.restore();
};

// ---------- 字 ----------
// K.text(c, s, x, y, {size, fam, col(填充), line(描边色), align, alpha, scale, rot, maxW, shadow, plain(true=只填墨色不描边，放在浅色牌子上), lh, track})，'\n' 换行
D.text = (c, s, x, y, o = {}) => {
  const { size = 72, fam = 'PuHui-Black', col = C.white, line = C.ink, align = 'center', alpha = 1, scale = 1, rot = 0, maxW = 0, shadow = true, plain = false, lh = 1.2, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  const lines = String(s).split('\n'); let k = scale; if (maxW) { const w = Math.max(...lines.map(l => c.measureText(l).width)); if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  lines.forEach((ln, i) => { const yy = (i - (lines.length - 1) / 2) * size * lh;
    if (plain) { c.fillStyle = o.col || C.ink; c.fillText(ln, 0, yy); return; }
    if (shadow) { c.strokeStyle = line; c.lineWidth = size * 0.3; c.strokeText(ln, size * 0.05, yy + size * 0.07); c.fillStyle = line; c.fillText(ln, size * 0.05, yy + size * 0.07); }
    c.strokeStyle = line; c.lineWidth = size * 0.17; c.strokeText(ln, 0, yy); c.fillStyle = col; c.fillText(ln, 0, yy); });
  c.restore();
};
// K.popText(c, s, x, y, lt, at, {…K.text 的参数, dur, bob})：at 时刻弹出（过冲＋阻尼晃一下），bob:true 落定后随拍轻跳
D.popText = (c, s, x, y, lt, at, o = {}) => { const p = D.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const e = lt - at, wob = Math.sin(e * 22) * 0.07 * Math.exp(-e * 5);
  const bob = o.bob ? D.bnc(D.tq(o.t != null ? o.t : lt), 0) * 8 : 0;
  D.text(c, s, x, y - bob, { ...o, scale: p * (o.scale || 1), rot: (o.rot || 0) + wob, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// K.callout(c, s, ax, ay, bx, by, lt, at, {fill, size})：目标点(ax,ay)画个圈，橡皮管线甩到 (bx,by) 的圆角标签牌（黑字，逐字打出）
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.white, size = 50 } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  const bend = o.bend ?? 60; c.save(); D.hose(c, [bx, by], [lerp(bx, ax, p1), lerp(by, ay, p1)], bend, 8, C.ink, { line: 0 });
  c.lineWidth = 6; c.fillStyle = C.red; ink(c, 5); const R = 16 * Math.min(1, p1 * 3); c.beginPath(); c.arc(ax, ay, R, 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Black"`; const w = c.measureText(s).width + size * 1.4, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = C.ink; c.fill(D.round(-w / 2 + 6, -h / 2 + 8, w, h, h / 2)); F(c, D.round(-w / 2, -h / 2, w, h, h / 2), fill, 6);
  c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.7, 3); c.restore(); };

// ---------- 气泡 ----------
const bubbleFinish = (c, strokes, fills, lw) => { c.save(); ink(c, lw * 2); strokes.forEach(p => c.stroke(p)); c.fillStyle = C.white; fills.forEach(p => c.fill(p)); c.restore(); };
// K.speech(c, text, x, y, {w, size, tx, ty, p, t})：(x,y)=气泡中心，(tx,ty)=尾巴尖（嘴的位置），p 弹出进度 0..1（用 K.pop），文字 \n 换行
D.speech = (c, s, x, y, o = {}) => {
  const { size = 56, p = 1 } = o, t = tOf(o), tq = D.tq(t); if (p <= 0) return; const j = U.hash(Math.floor(tq * 12), 91);
  c.save(); c.font = `${size}px "PuHui-Black"`; const lines = String(s).split('\n'), tw = Math.max(...lines.map(l => c.measureText(l).width)); c.restore();
  const w = o.w || tw + size * 1.2, h = size * 1.35 * lines.length + size * 0.8, tx = o.tx ?? x - 60, ty = o.ty ?? y + h / 2 + 90;
  c.save(); c.translate(x + (j - 0.5) * 2.4, y + (U.hash(Math.floor(tq * 12), 92) - 0.5) * 2.4); c.scale(p, p);
  const body = D.round(-w / 2, -h / 2, w, h, Math.min(h / 2, 70)); const dx = (tx - x), dy = (ty - y), L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  // 尾巴：从气泡内侧一点出发，底边在朝向目标的边上
  const edge = Math.min(Math.abs(ux) > 1e-3 ? (w / 2) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? (h / 2) / Math.abs(uy) : 1e9), bx = ux * (edge - 12), by = uy * (edge - 12), nx = -uy, ny = ux, bw = Math.min(34, h * 0.3);
  const tail = new Path2D(); tail.moveTo(bx + nx * bw, by + ny * bw); const dd = Math.max(10, L - edge); tail.quadraticCurveTo(bx + ux * dd * 0.55 + nx * bw * 0.3, by + uy * dd * 0.55 + ny * bw * 0.3, dx, dy); tail.quadraticCurveTo(bx + ux * dd * 0.45 - nx * bw * 0.1, by + uy * dd * 0.45 - ny * bw * 0.1, bx - nx * bw, by - ny * bw); tail.closePath();
  bubbleFinish(c, [body, tail], [body, tail], 5);
  lines.forEach((ln, i) => D.text(c, ln, 0, (i - (lines.length - 1) / 2) * size * 1.35, { size, plain: true }));
  c.restore();
};
// K.thought(c, x, y, {w, h, tx, ty, p, t, text, size, draw(c,cx,cy)})：云朵想法泡，(x,y) 中心，尾巴三个小圈指向 (tx,ty)；draw 回调在泡中心画图（脑子、剑、书…）
D.thought = (c, x, y, o = {}) => {
  const { w = 360, h = 240, p = 1, size = 56 } = o, t = tOf(o), tq = D.tq(t); if (p <= 0) return; const tx = o.tx ?? x - 120, ty = o.ty ?? y + h / 2 + 150;
  c.save(); c.translate(x, y); c.scale(p, p); const paths = [], N = 11;
  for (let i = 0; i < N; i++) { const a = i / N * TAU, bx = Math.cos(a) * (w / 2 - 26), by = Math.sin(a) * (h / 2 - 26), r = 44 + U.hash(i, 7) * 14 + Math.sin(tq * 3 + i) * 2; paths.push(circ(bx, by, r)); }
  paths.push(ell(0, 0, w / 2 - 20, h / 2 - 20));
  const dx = tx - x, dy = ty - y; [[0.55, 26], [0.76, 18], [0.92, 11]].forEach(([k, r]) => paths.push(circ(dx * k * 0.82 + (dx > 0 ? 0 : 0), dy * k * 0.82 + h * 0.1 * (1 - k), r)));
  paths.push(circ(dx, dy, 8)); bubbleFinish(c, paths, paths, 5);
  if (o.draw) o.draw(c, 0, 0); if (o.text) D.text(c, o.text, 0, 0, { size, plain: true, maxW: w - 80 }); c.restore();
};

// ---------- 书（线装） ----------
// K.book(c, x, y, s, {title, open(0..1 翻开), flip(0..1 翻页进度), glow(0..1 发光), rot, t, col, tilt})  (x,y)=书中心；s=1 封面约 300×400
// title：字符串→书签条上竖排；数组→封面上横排大字（如 ['AI','秘籍']）
D.book = (c, x, y, s = 1, o = {}) => {
  const { title = '', open = 0, flip = 0, glow = 0, rot = 0, col = C.dk } = o, tq = D.tq(tOf(o));
  if (glow > 0) { c.save(); c.translate(x, y); c.rotate(tq * 0.6); c.globalAlpha *= clamp(glow); D.burst(c, 0, 0, 470 * s, { n: 14, inner: 0.62, col: C.white, line: 5, alt: 0.2 }); c.restore();
    const g = c.createRadialGradient(x, y, 40 * s, x, y, 340 * s); g.addColorStop(0, `rgba(255,255,240,${0.95 * clamp(glow)})`); g.addColorStop(1, 'rgba(255,255,240,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 340 * s, 0, TAU); c.fill(); }
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const RR = (x0, y0, x1, y1, r) => D.round(x0, y0, x1 - x0, y1 - y0, r);
  if (open > 0.02) {
    const k = clamp(open), hw = 215 * k;   // 单页半宽
    F(c, RR(-hw - 8, -196, hw + 8, 206, 10), col, 8);
    F(c, RR(-hw, -190, 0, 196, 6), C.white, 6); F(c, RR(0, -190, hw, 196, 6), C.white, 6);
    const lines = (x0, x1, sd) => { ink(c, 4); c.strokeStyle = C.mid; for (let i = 0; i < 12; i++) { const yy = -150 + i * 28, ww = (x1 - x0) * (0.55 + U.hash(i, sd) * 0.4); if (k < 0.5) continue; c.beginPath(); c.moveTo(x0 + (x1 - x0) * 0.1, yy); c.lineTo(x0 + (x1 - x0) * 0.1 + ww * 0.8, yy); c.stroke(); } };
    lines(-hw, 0, 3); lines(0, hw, 8);
    ink(c, 6); c.beginPath(); c.moveTo(0, -190); c.lineTo(0, 196); c.stroke();
    if (flip > 0 && flip < 1) { const a = flip * Math.PI, sx = Math.cos(a), pg = RR(0, -190, hw, 196, 6); c.save(); c.scale(sx, 1); c.translate(0, -Math.sin(a) * 14); F(c, pg, C.white, 6); if (sx > 0) { c.save(); c.clip(pg); lines(0, hw, 3); c.restore(); } c.restore(); }
    if (o.text) D.text(c, o.text, hw * 0.5, 0, { size: 46, plain: true, maxW: hw * 0.8 });
  } else {
    F(c, RR(-150, -190, 160, 206, 8), C.white, 7);      // 书页侧边
    ink(c, 3); for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(166 + i * 5, -184 + i * 3); c.lineTo(166 + i * 5, 200 - i * 2); c.stroke(); }
    F(c, RR(-170, -210, 160, 196, 10), col, 8);          // 封面
    F(c, RR(-170, -210, -130, 196, 6), C.dk2, 6);        // 书脊
    c.fillStyle = C.red; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-150, -150 + i * 100, 7, 0, TAU); c.fill(); }   // 线装的线孔（朱砂）
    ink(c, 5); c.strokeStyle = C.white; c.lineWidth = 6; c.strokeRect(-112, -186, 262, 358);
    if (Array.isArray(title)) { F(c, D.round(-100, -170, 238, 190, 22), C.white, 6);
      title.forEach((ln, i) => D.text(c, ln, 20, -120 + i * 100, { size: i ? 96 : 110, maxW: 220 })); ink(c, 5); c.beginPath(); c.moveTo(-96, 80); c.lineTo(134, 76); c.stroke(); }
    else if (title) { F(c, D.round(-40, -176, 76, 20 + [...title].length * 56, 8), C.white, 6); [...title].forEach((ch, i) => D.text(c, ch, -2, -138 + i * 56, { size: 48, plain: true })); }
  }
  c.restore();
};

// ---------- 剑 ----------
// K.sword(c, x, y, s, {ang, glint(0..1), t})：(x,y)=握柄中心，剑身朝 +x，ang 弧度（默认 -0.6 斜指右上）；s=1 全长约 560
D.sword = (c, x, y, s = 1, o = {}) => {
  const ang = o.ang ?? -0.6, tq = D.tq(tOf(o)); c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  const fl = Math.sin(tq * 11) * 10; ink(c, 7); c.strokeStyle = C.red; c.beginPath(); c.moveTo(-96, 0); c.bezierCurveTo(-130, 20, -150 + fl, 60, -176 + fl, 70 + fl * 0.5); c.moveTo(-96, 0); c.bezierCurveTo(-132, 8, -160 + fl, 30, -190 + fl, 28); c.stroke();
  F(c, D.round(-90, -15, 100, 30, 12), C.dk, 6); ink(c, 3); [-70, -46, -22, 2].forEach(xx => { c.beginPath(); c.moveTo(xx, -13); c.lineTo(xx + 10, 13); c.stroke(); });
  F(c, circ(-96, 0, 18), C.red, 6);
  F(c, D.round(6, -46, 26, 92, 10), C.ink, 5); c.fillStyle = C.mid; c.fillRect(14, -30, 6, 60);
  const bl = SM([[32, -17], [400, -14], [470, 0], [400, 14], [32, 17]]); F(c, new Path2D('M32 -17 L400 -14 L474 0 L400 14 L32 17 Z'), C.white, 7);
  ink(c, 3.5); c.strokeStyle = C.mid; c.beginPath(); c.moveTo(48, 0); c.lineTo(420, 0); c.stroke();
  if (o.glint) { const g = clamp(o.glint); D.burst(c, 330, -2, 60 * g, { n: 4, inner: 0.16, col: C.white, line: 4, rot: tq * 2 }); }
  c.restore();
};

// ---------- 脑子（带脸，会长手脚） ----------
// K.brain(c, x, y, s, {mood, limbs(0..1 手脚长出进度), pose:'idle'|'wave'|'cheer'|'run', t, col})，(x,y)=脑子中心；s=1 宽约 180
D.brain = (c, x, y, s = 1, o = {}) => {
  const { mood = 'calm', limbs = 0, pose = 'idle', col = C.brain } = o, t = tOf(o), tq = D.tq(t), ph = pose === 'run' ? Math.PI * tq / BEAT : 0; c.save(); c.translate(x, y); c.scale(s, s);
  const lm = MO.backOut(clamp(limbs), 1.6);
  if (lm > 0.02) {   // 腿（在脑子后面）
    [-1, 1].forEach((sd, i) => { const sw = pose === 'run' ? Math.sin(ph + i * Math.PI) * 26 : 0, lift = pose === 'run' ? Math.max(0, Math.sin(ph + i * Math.PI + 1.57)) * 12 : 0;
      const A = [sd * 30, 40], B = [sd * 34 + sw, 40 + 78 * lm - lift]; D.hose(c, A, B, sd * 12, 18, C.hose); F(c, ell(B[0] + 10, B[1] + 4, 28, 14), C.ink, 4); });
  }
  const p = SM([[-80, 10], [-90, -30], [-60, -65], [-20, -75], [20, -78], [62, -62], [88, -26], [78, 18], [40, 44], [-10, 48], [-50, 40]]);
  F(c, p, col, 7); c.save(); c.clip(p); ink(c, 5);
  [[-60, -30, -20, -20, -30, 10], [-20, -60, 10, -40, 0, -10], [20, -20, 50, -40, 60, -10], [10, 10, 40, 20, 30, 40], [-60, 20, -30, 25, -20, 40]].forEach(([a, b, cx, cy, d, e]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(cx, cy, d, e); c.stroke(); }); c.restore(); ink(c, 7); c.stroke(p);
  D.face(c, 0, -6, 58, { mood, t, bare: true, look: o.look || 0.2, ph: 0.3 });
  if (lm > 0.02) {   // 手（在脑子前面）
    [-1, 1].forEach((sd, i) => { let tx = sd * (84 + 62 * lm), ty = 10 + 24 * lm;
      if (pose === 'wave' && sd > 0) { tx = 140; ty = -70 + Math.sin(tq * 14) * 18; } else if (pose === 'cheer') { tx = sd * 120; ty = -100 - D.bnc(tq, 0) * 18; } else if (pose === 'run') { ty = 20 + Math.sin(ph + i * Math.PI) * 30; }
      const A = [sd * 80, 6], B = [lerp(A[0], tx, lm), lerp(A[1], ty, lm)], r = D.hose(c, A, B, -sd * 24, 18, C.hose); D.glove(c, B[0], B[1], r.ang + (sd < 0 ? 0 : 0), 0.9, { pose: pose === 'cheer' ? 'fist' : 'open' }); });
  }
  c.restore();
};

// ---------- 人：武侠角色（额带、发髻、长袍），橡皮管手臂＋白手套＋大头 ----------
// K.person(c, x, y, s, o) —— (x,y)=两脚中点（地面），s=1 全高约 850px。返回屏幕坐标锚点 {head, top, handL, handR, mid, chest, mouth, feet}（handL=画面左侧的手，dir=-1 时对调）。
// o: { pose, to, mix(0..1 混向另一个 pose), mood, t(全片时间，驱动 12fps 步进/节拍弹跳/走路), phase(弹跳相位偏移，拍), bounce(0..1，默认 1), dir(1 朝右 -1 朝左),
//      look, talk(0..1 说话), robe(袍色), hair, elder(白发白须), lite(省细节，群像用), item(c,x,y)=>画手里的东西(局部坐标，位于两手中点), alpha, walk(强制走路相位 rad) }
// pose：stand 站｜walk 走｜think 托腮｜shrug 摊手｜cheer 举双手｜slump 垂头丧气｜point 指向右上｜hold 双手捧物(配 item)｜wave 挥手｜hip 叉腰｜panic 抱头乱晃
const POSE = {
  stand: { L: [-130, -250], R: [130, -250], bL: 34, bR: -34, sh: 0, hd: [0, 0], tilt: 0, lean: 0 },
  walk: { L: [-125, -250], R: [125, -250], bL: 30, bR: -30, sh: 0, hd: [0, 0], tilt: 0, lean: 0.03 },
  think: { L: [30, -330], R: [58, -505], bL: -50, bR: -70, sh: 0, hd: [8, 4], tilt: 0.1, lean: 0, gR: 'fist' },
  shrug: { L: [-250, -380], R: [250, -380], bL: 60, bR: -60, sh: -16, hd: [0, 4], tilt: -0.1, lean: 0, gL: 'flat', gR: 'flat' },
  cheer: { L: [-200, -900], R: [200, -900], bL: -70, bR: 70, sh: -8, hd: [0, -6], tilt: 0, lean: 0, gL: 'fist', gR: 'fist' },
  slump: { L: [-80, -215], R: [80, -215], bL: 14, bR: -14, sh: 20, hd: [0, 34], tilt: 0.16, lean: 0.07 },
  point: { L: [-150, -300], R: [350, -610], bL: 50, bR: -20, sh: 0, hd: [8, 0], tilt: -0.06, lean: 0, gR: 'point' },
  hold: { L: [-120, -330], R: [120, -330], bL: 70, bR: -70, sh: 0, hd: [0, 4], tilt: 0, lean: 0, gL: 'flat', gR: 'flat' },
  wave: { L: [-130, -250], R: [215, -790], bL: 34, bR: 60, sh: 0, hd: [0, 0], tilt: -0.08, lean: 0 },
  hip: { L: [-92, -300], R: [92, -300], bL: 80, bR: -80, sh: 0, hd: [0, 0], tilt: 0, lean: 0, gL: 'fist', gR: 'fist' },
  panic: { L: [-210, -790], R: [210, -790], bL: 50, bR: -50, sh: -10, hd: [0, -4], tilt: 0, lean: 0 },
};
D.POSES = Object.keys(POSE);
const mixP = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A, L = (u, v) => lerp(u, v, k), L2 = (u, v) => [L(u[0], v[0]), L(u[1], v[1])];
  return { L: L2(A.L, B.L), R: L2(A.R, B.R), bL: L(A.bL, B.bL), bR: L(A.bR, B.bR), sh: L(A.sh, B.sh), hd: L2(A.hd, B.hd), tilt: L(A.tilt, B.tilt), lean: L(A.lean, B.lean), gL: (k < 0.5 ? A : B).gL || 'open', gR: (k < 0.5 ? A : B).gR || 'open' }; };
const ROBES = [C.dk, C.mid, C.dk2, '#7a715c', C.paper3];
D.person = (c, x, y, s = 1, o = {}) => {
  const { pose = 'stand', to = null, mix = 0, mood = 'calm', dir = 1, look = 0, talk = 0, phase = 0, bounce = 1, lite = false, alpha = 1, elder = false } = o;
  const t = tOf(o), tq = D.tq(t), robe = o.robe || C.dk, hairC = elder ? C.white : C.ink, Q = mixP(pose, to || pose, MO.cubicInOut(clamp(mix)));
  const walking = pose === 'walk' || o.walk != null, wph = o.walk != null ? o.walk : Math.PI * tq / BEAT, sw = walking ? Math.sin(wph) : 0;
  const b = bounce ? D.bnc(tq, 0.25 + phase) : 0, amp = 16 * bounce;
  // 动作叠加（12fps 步进）
  const L = [Q.L[0], Q.L[1]], R = [Q.R[0], Q.R[1]]; let bL = Q.bL, bR = Q.bR;
  L[1] += Math.sin(tq * 5 + phase * 3) * 5; R[1] += Math.sin(tq * 5 + 1.5 + phase * 3) * 5;
  if (walking) { L[1] -= sw * 55; R[1] += sw * 55; }
  const pm = k => (mix > 0.5 && to ? to : pose) === k ? 1 : 0;
  if (pm('wave')) { R[0] += Math.sin(tq * 16) * 36; bR += Math.sin(tq * 16) * 26; }
  if (pm('panic')) { L[0] += Math.sin(tq * 34) * 14; R[0] -= Math.sin(tq * 34) * 14; L[1] += Math.sin(tq * 28) * 18; R[1] -= Math.sin(tq * 28) * 18; }
  if (pm('cheer')) { L[1] -= D.bnc(tq, 0.25 + phase) * 36; R[1] -= D.bnc(tq, 0.25 + phase) * 36; }
  if (pm('shrug')) { L[1] -= D.bnc(tq, 0.5) * 14; R[1] -= D.bnc(tq, 0.5) * 14; }
  const hx = Q.hd[0], hy = -660 + Q.hd[1] + Math.sin(tq * 3.2 + phase) * 3, SL = [-92, -440 + Q.sh], SR = [92, -440 + Q.sh], HR = 150;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(dir * s, s);
  const sq = bounce ? (1 - b) * 0.08 * bounce : 0, st = b * 0.05 * bounce; c.translate(0, -b * amp); c.scale(1 + sq - st * 0.6, 1 - sq + st);
  // 腿
  [-1, 1].forEach((sd, i) => { const fx = sd * 38 + (walking ? (i ? -sw : sw) * 40 : sd * 6), lift = walking ? Math.max(0, (i ? -1 : 1) * Math.cos(wph)) * 24 : 0, fy = -34 - lift;
    D.hose(c, [sd * 38, -110], [fx, fy], sd * 6, 26, C.hose); F(c, ell(fx + 20, fy + 14, 52, 24), C.ink, 5); });
  c.save(); c.translate(0, -100); c.rotate(Q.lean + (walking ? 0.02 * sw : 0)); c.translate(0, 100);
  // 长袍
  const rb = SM([[-92, -452], [-30, -468], [30, -468], [92, -452], [112, -380], [142, -250], [162, -88], [0, -66], [-162, -88], [-142, -250], [-112, -380]]);
  F(c, rb, robe, 8);
  if (!lite) { c.save(); c.clip(rb); ink(c, 5); c.strokeStyle = robe === C.dk || robe === C.dk2 ? C.mid : C.dk; for (let xx = -170; xx < 180; xx += 50) { c.beginPath(); c.moveTo(xx * 0.7, -460); c.lineTo(xx, -70); c.stroke(); } c.restore(); ink(c, 8); c.stroke(rb); }
  F(c, SM([[-48, -462], [0, -380], [48, -462], [32, -470], [0, -424], [-32, -470]]), C.white, 6);   // 衣领
  F(c, SM([[-132, -300], [0, -280], [132, -300], [136, -246], [0, -230], [-132, -246]]), C.ink, 6);   // 腰带
  F(c, ell(0, -262, 24, 20), C.red, 5);                                                                   // 腰结（朱砂点缀）
  // 手臂（橡皮管）
  const arm = (S, T, bend) => D.hose(c, S, T, bend, 24, C.hose);
  const aL = arm(SL, L, bL), aR = arm(SR, R, bR);
  // 头：脖子、发髻、脸、头发、额带
  F(c, ell(0, -490, 28, 34), C.hose, 6);
  c.save(); c.translate(hx, 0); c.translate(0, hy); c.rotate(Q.tilt); c.translate(0, -hy);
  F(c, ell(0, hy - HR - 12, 48, 42), hairC, 7); ink(c, 7); c.strokeStyle = C.white; c.lineWidth = 8; c.beginPath(); c.moveTo(-44, hy - HR - 24); c.lineTo(46, hy - HR - 44); c.stroke();
  D.face(c, 0, hy, HR, { mood, t, look, talk, ph: phase });
  const head = ell(0, hy, HR, HR * 0.96);
  c.save(); c.clip(head);
  c.fillStyle = hairC; c.beginPath(); c.moveTo(-190, hy - 10); c.quadraticCurveTo(-130, hy - 100, 0, hy - 94); c.quadraticCurveTo(130, hy - 100, 190, hy - 10); c.lineTo(190, hy - 220); c.lineTo(-190, hy - 220); c.closePath(); c.fill();
  if (elder) { ink(c, 5); c.stroke(); }
  c.fillStyle = hairC; c.beginPath(); c.ellipse(-142, hy + 6, 16, 44, 0, 0, TAU); c.ellipse(142, hy + 6, 16, 44, 0, 0, TAU); c.fill();
  const band = new Path2D(); band.moveTo(-190, hy - 74); band.quadraticCurveTo(0, hy - 116, 190, hy - 74); band.lineTo(190, hy - 38); band.quadraticCurveTo(0, hy - 78, -190, hy - 38); band.closePath(); F(c, band, C.white, 5);
  c.fillStyle = C.red; c.beginPath(); c.arc(0, hy - 74, 11, 0, TAU); c.fill(); ink(c, 3.5); c.stroke();
  c.restore(); ink(c, 8); c.stroke(head);
  if (!lite) [-1, 1].forEach((k, i) => { const fl = Math.sin(tq * 9 + i * 2) * 16; D.hose(c, [-148, hy - 58], [-250 - i * 16, hy - 14 + fl + i * 24], 14 + i * 10, 16, C.white, { line: 8 }); });
  if (elder) { F(c, SM([[-84, hy + 96], [-52, hy + 126], [-30, hy + 230], [0, hy + 330], [30, hy + 230], [52, hy + 126], [84, hy + 96], [40, hy + 108], [0, hy + 114], [-40, hy + 108]]), C.white, 6);
    ink(c, 4); c.strokeStyle = C.mid; [-20, 0, 20].forEach(xx => { c.beginPath(); c.moveTo(xx, hy + 140); c.lineTo(xx * 1.2, hy + 270); c.stroke(); }); }
  c.restore();
  // 手里的东西（在两手中点，局部坐标）、手套
  const mid = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2];
  if (o.item) { c.save(); c.translate(mid[0], mid[1]); o.item(c, 0, 0); c.restore(); }
  const gs = lite ? 1.5 : 1.3, rl = pm('wave') ? Math.sin(tq * 16) * 0.25 : 0;
  D.glove(c, L[0], L[1], aL.ang, gs, { pose: Q.gL }); D.glove(c, R[0], R[1], aR.ang + rl, gs, { pose: Q.gR });
  c.restore(); c.restore();
  // 锚点（调用者坐标系；不含挤压）
  const sc = (px, py) => [x + dir * s * px, y + s * (py - b * amp)];
  return { head: sc(hx, hy), top: sc(hx, hy - HR - 55), handL: sc(L[0], L[1]), handR: sc(R[0], R[1]), mid: sc(mid[0], mid[1]), chest: sc(0, -360), mouth: sc(hx, hy + 78), feet: [x, y], sc };
};

// ---------- 群像 ----------
// K.crowd(c, t, {n, x0, x1, y(最前排脚线), rows, s, seed, mood(字符串或数组), pose(字符串或数组), to, mix, face})：一排排小人，后排更小更高，节拍弹跳相位各异
D.crowd = (c, t, o = {}) => {
  const { n = 12, x0 = 70, x1 = 1010, y = 1310, rows = 2, s = 0.34, seed = 1 } = o, pick = (a, i, sd) => Array.isArray(a) ? a[Math.floor(U.hash(i, seed + sd) * a.length)] : a;
  for (let r = rows - 1; r >= 0; r--) { const cnt = n - r * 2, sr = s * (1 - r * 0.14), yy = y - r * 82 * s * 1.6;
    for (let i = 0; i < cnt; i++) { const id = r * 40 + i, fx = (i + 0.5 + (U.hash(id, seed) - 0.5) * 0.5 + r * 0.5) / (cnt + r * 0.5);
      D.person(c, lerp(x0, x1, clamp(fx, 0.02, 0.98)), yy, sr * (0.92 + U.hash(id, seed + 5) * 0.16), { t, lite: true, phase: U.hash(id, seed + 2), robe: ROBES[Math.floor(U.hash(id, seed + 3) * ROBES.length)],
        mood: pick(o.mood || ['calm', 'happy', 'shock'], id, 4), pose: pick(o.pose || 'stand', id, 6), to: o.to, mix: o.mix, dir: U.hash(id, seed + 7) < 0.5 ? 1 : -1, elder: U.hash(id, seed + 8) < 0.08, look: (U.hash(id, seed + 9) - 0.5) * 2 }); } }
};

// ---------- 示意道具 ----------
// K.arrow(c, x, y, len, dir('up'|'down'|'left'|'right'|弧度), {p, w, col, t})：粗胖卡通箭头，(x,y)=箭尾，p 0..1 伸出（过冲）；col 默认奶白，涨跌/强调可传 K.C.red
D.arrow = (c, x, y, len, dir = 'up', o = {}) => {
  const ang = typeof dir === 'number' ? dir : { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir], p = o.p == null ? 1 : o.p, w = o.w || 70, col = o.col || C.white; if (p <= 0) return;
  const L = len * MO.backOut(clamp(p), 1.6), hl = Math.min(L * 0.5, w * 1.25), tq = D.tq(tOf(o)), wob = o.wob === false ? 0 : Math.sin(tq * 10) * 0.025;
  c.save(); c.translate(x, y); c.rotate(ang + wob); const a = new Path2D(); a.moveTo(0, -w / 4); a.lineTo(L - hl, -w / 4); a.lineTo(L - hl, -w / 2 - w * 0.25); a.lineTo(L, 0); a.lineTo(L - hl, w / 2 + w * 0.25); a.lineTo(L - hl, w / 4); a.lineTo(0, w / 4); a.closePath();
  c.fillStyle = C.ink; c.save(); c.translate(7, 9); c.fill(a); c.restore(); F(c, a, col, 8); c.restore();
};
// K.bars(c, data, {x, y(基线), w, h, p, max, labels:[…], vals:true, hi:索引, col})：粗描边柱，data 为数字数组；p 0..1 逐根弹起（橡皮过冲）；hi 的那根朱砂
D.bars = (c, data, o = {}) => {
  const { x = 140, y = 1200, w = 800, h = 600, p = 1, labels = [], hi = -1 } = o, mx = o.max || Math.max(...data), n = data.length, bw = Math.min(150, w / n * 0.62), gap = w / n;
  c.save(); ink(c, 8); c.beginPath(); c.moveTo(x - 20, y); c.lineTo(x + w + 20, y); c.stroke();
  data.forEach((v, i) => { const q = clamp(p * n - i * 0.8, 0, 1), k = q <= 0 ? 0 : MO.backOut(q, 2.2), bh = Math.max(0, v / mx * h * k), bx = x + gap * (i + 0.5) - bw / 2;
    if (bh > 1) { const path = D.round(bx, y - bh, bw, bh + 14, 14); c.fillStyle = C.ink; c.save(); c.translate(8, 0); c.fill(path); c.restore(); F(c, path, i === hi ? C.red : (o.col || (i % 2 ? C.paper3 : C.white)), 7); c.save(); c.clip(path); ink(c, 3); c.strokeStyle = 'rgba(20,18,16,.35)'; for (let yy = y - bh + 24; yy < y; yy += 26) { c.beginPath(); c.moveTo(bx + bw * 0.2, yy); c.lineTo(bx + bw * 0.2 + 22, yy); c.stroke(); } c.restore(); }
    if (labels[i]) D.text(c, labels[i], bx + bw / 2, y + 48, { size: 42, maxW: gap * 0.95 });
    if (o.vals && q > 0.6) D.text(c, String(o.vals === true ? v : o.vals[i]), bx + bw / 2, y - bh - 44, { size: 54 }); });
  c.restore();
};
// K.scale(c, cx, cy, w, tilt, {p, left(c,x,y), right(c,x,y), leftText, rightText, t})：天平。(cx,cy)=支点，w=横梁长，tilt 弧度（正=右边沉）；left/right 回调在秤盘中心上方 (x,y) 摆东西
D.scale = (c, cx, cy, w, tilt = 0, o = {}) => {
  const p = o.p == null ? 1 : o.p; if (p <= 0) return; const tq = D.tq(tOf(o)), sw = Math.sin(tq * 3) * 0.015; c.save(); c.translate(cx, cy + (1 - p) * 30); c.globalAlpha *= clamp(p * 2);
  F(c, SM([[-14, 10], [14, 10], [18, 300], [80, 340], [96, 380], [-96, 380], [-80, 340], [-18, 300]]), C.dk, 7);
  const a = tilt + sw, e = [[-Math.cos(a) * w / 2, -Math.sin(a) * w / 2], [Math.cos(a) * w / 2, Math.sin(a) * w / 2]];
  D.hose(c, e[0], e[1], 0, 22, C.paper3, {});
  [[e[0], 'left', o.leftText], [e[1], 'right', o.rightText]].forEach(([E, sd, txt]) => { const py = E[1] + 210, sx = (sd === 'left' ? -1 : 1);
    ink(c, 5); c.beginPath(); c.moveTo(E[0], E[1]); c.lineTo(E[0] - 100, py - 30); c.moveTo(E[0], E[1]); c.lineTo(E[0] + 100, py - 30); c.stroke();
    if (o[sd]) o[sd](c, E[0], py - 40);
    F(c, new Path2D(`M${E[0] - 112} ${py - 30} Q${E[0]} ${py + 70} ${E[0] + 112} ${py - 30} Z`), C.paper3, 7);
    if (txt) D.text(c, txt, E[0], py + 70, { size: 44, maxW: 220 }); });
  F(c, circ(0, 0, 22), C.red, 6); c.restore();
};

// ---------- 收尾：胶片层 ----------
// K.finish(c, {t, weave})：每镜最后一个调用。抖片(24fps 整幅微抖)、闪烁、竖划痕(寿命≈6fps)、灰尘毛发、颗粒、做旧褪色，圆角片门＋较轻的暗角；字幕带 y1380–1560 压暗（峰值 .4，不全黑）。
const gateTex = () => P.cached('rh_gate', W, H, g => {
  const vg = g.createRadialGradient(540, 880, 760, 540, 880, 1500); vg.addColorStop(0, 'rgba(40,30,18,0)'); vg.addColorStop(1, 'rgba(40,30,18,.3)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const b = g.createLinearGradient(0, 1380, 0, 1570); b.addColorStop(0, 'rgba(24,18,10,0)'); b.addColorStop(0.35, 'rgba(24,18,10,.4)'); b.addColorStop(0.7, 'rgba(24,18,10,.4)'); b.addColorStop(1, 'rgba(24,18,10,0)'); g.fillStyle = b; g.fillRect(0, 1380, W, 190);
  g.fillStyle = '#0c0a07'; g.beginPath(); g.rect(0, 0, W, H); g.roundRect(12, 12, W - 24, H - 24, 54); g.fill('evenodd');
});
const grainTex = () => P.cached('rh_grain', W + 100, H + 100, g => { const r = U.rng(3301), img = g.createImageData(W + 100, H + 100), d = img.data;
  for (let i = 0; i < d.length / 4; i++) if (r() < 0.14) { const dark = r() < 0.6; d[i * 4] = dark ? 20 : 255; d[i * 4 + 1] = dark ? 16 : 252; d[i * 4 + 2] = dark ? 10 : 240; d[i * 4 + 3] = 255 * 0.2 * (0.4 + r() * 0.6); } g.putImageData(img, 0, 0); });
D.finish = (c, o = {}) => {
  const t = tOf(o), fq = Math.floor(t * 24), r = U.rng(fq * 7919 + 11);
  if (o.weave !== false) {   // 抖片：整幅按 24fps 平移 ±1.5/±2 px（用暂存画布，片门圆角盖住边缘）
    const cv = c.canvas, sc = cv.width / W; if (!D._wv || D._wv.width !== cv.width || D._wv.height !== cv.height) { D._wv = document.createElement('canvas'); D._wv.width = cv.width; D._wv.height = cv.height; }
    const wg = D._wv.getContext('2d'); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); wg.globalCompositeOperation = 'copy'; wg.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'copy'; c.drawImage(D._wv, (r() - 0.5) * 3 * sc, (r() - 0.5) * 4 * sc); c.restore(); } else { r(); r(); }
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#f6eedb'; c.fillRect(0, 0, W, H); c.restore();      // 做旧褪色
  c.fillStyle = `rgba(255,250,235,${0.02 + r() * 0.05})`; c.fillRect(0, 0, W, H);                                         // 闪烁
  c.fillStyle = `rgba(20,16,10,${r() * 0.05})`; c.fillRect(0, 0, W, H);
  c.drawImage(gateTex(), 0, 0);                                                                                           // 暗角＋字幕带压暗＋圆角片门
  const r6 = U.rng(Math.floor(t * 6) * 131 + 5);                                                                          // 划痕：寿命 1/6 秒
  for (let k = 0; k < 3; k++) { const x = r6() * W + (r() - 0.5) * 6, dark = r6() < 0.5; c.strokeStyle = dark ? 'rgba(20,16,10,.3)' : 'rgba(255,252,240,.36)'; c.lineWidth = 1 + r6() * 1.3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 12, H); c.stroke(); }
  for (let k = 0; k < 14; k++) { c.fillStyle = r() < 0.6 ? 'rgba(20,16,10,.65)' : 'rgba(255,252,240,.75)'; c.beginPath(); c.arc(r() * W, r() * H, 1 + r() * 3.2, 0, TAU); c.fill(); }
  if (r() < 0.5) { c.strokeStyle = 'rgba(20,16,10,.55)'; c.lineWidth = 1.6; const x = 80 + r() * (W - 160), y = 80 + r() * (H - 160); c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 30, y - 20, x + 10, y + 40, x + 50, y + 30); c.stroke(); }
  c.drawImage(grainTex(), -r() * 100, -r() * 100);
};

// ---------- 字幕（assemble 生成的 subs.js 调它）：黑底牌＋奶白字，字幕带 y≈1480 ----------
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 72), h = 92, x = 540, y = 1480;
  c.fillStyle = 'rgba(20,18,16,.3)'; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 9, w, h, 26); c.fill();
  c.fillStyle = 'rgba(20,18,16,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 26); c.fill();
  c.strokeStyle = 'rgba(251,247,236,.55)'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 20); c.stroke();
  c.fillStyle = C.white; c.fillText(text, x, y + 2, 1000); c.restore();
};

// ---------- 章节卡：老电影片头字卡 ----------
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
D.CARD_TONES = ['dim', 'warm', 'night', 'red'];
// K.chapterCard(c, lt, t, n, title)：光圈打开→放射光芒＋双线圆角片框，「第 N 章」黑牌＋大号数字砸入，章名逐字出；下方胶片条 N 格进度（本格朱砂），小人走到本格站定挥手；右下 n / 总数
D.chapterCard = (c, lt, t, n, title = '') => {
  const tone = D.CARD_TONES[(n - 1) % D.CARD_TONES.length], tq = D.tq(t); D.bg(c, t, { tone, pattern: n % 2 ? 'stripe' : 'dots', floor: false });
  c.save(); c.globalAlpha = 0.55; D.burst(c, 540, 620, 760, { n: 18, inner: 0.1, col: tone === 'night' ? '#7d776a' : C.white, line: false, spin: 0.15, t }); c.restore();
  ink(c, 10); c.strokeRect(0, 0, 0, 0); c.beginPath(); c.roundRect(60, 110, W - 120, 1250, 56); c.stroke(); ink(c, 3.5); c.strokeStyle = C.red; c.beginPath(); c.roundRect(82, 132, W - 164, 1206, 40); c.stroke();
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2);
  if (lt > 0.12) { const k = MO.slamK((lt - 0.12) / 0.17); c.save(); c.translate(540, 290); c.scale(k, k); F(c, D.round(-190, -56, 380, 112, 30), C.ink, 6); D.text(c, `第 ${n} 章`, 0, 2, { size: 68, shadow: false, line: C.ink }); c.restore(); }
  if (lt > 0.3) { const k = MO.slamK((lt - 0.3) / 0.2), bn = D.bnc(tq, 0) * 10; D.text(c, String(n), 540, 560 - bn, { size: n > 9 ? 280 : 330, scale: k, maxW: 520 }); }
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), size = lines.length > 1 ? 100 : all > 6 ? 112 : 128, shown = Math.round(D.at(lt, 0.55, Math.max(0.3, all / 14)) * all);
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
    if (k > 0) D.text(c, a.slice(0, k).join(''), 540, (lines.length > 1 ? 830 : 880) + i * size * 1.25, { size, maxW: 900 }); });
  // 胶片条进度
  const x0 = 150, x1 = 930, y = 1230, X = i => lerp(x0, x1, i / (N - 1)), cw = Math.min(62, (x1 - x0) / (N - 1) * 0.74);
  F(c, D.round(x0 - 56, y - 52, x1 - x0 + 112, 104, 14), C.ink, 6); c.fillStyle = C.paper3; for (let i = 0; i < 24; i++) { const hx = x0 - 40 + i * ((x1 - x0 + 80) / 23); c.fillRect(hx - 6, y - 46, 12, 8); c.fillRect(hx - 6, y + 38, 12, 8); }
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.2, walkEnd - 0.2));
  for (let i = 0; i < N; i++) { const cur = i === n - 1, pp = cur ? 0.7 + 0.3 * D.pop(lt, walkEnd, 0.45) : 1;
    F(c, D.round(X(i) - cw / 2 * pp, y - cw / 2 * pp, cw * pp, cw * pp, 8), cur ? C.red : i < n - 1 ? C.white : C.mid, 5); }
  const tx = lerp(n > 1 ? X(n - 2) : x0 - 70, X(n - 1), q), arrived = lt >= walkEnd;
  D.person(c, tx, y - 56, 0.2, { t, pose: arrived ? 'wave' : 'walk', mood: 'happy', lite: true, robe: C.dk, phase: 0, bounce: 1, dir: 1 });
  D.text(c, `${n} / ${N}`, 540, 1305, { size: 52, scale: D.pop(lt, 0.9, 0.4) });
  if (lt < 0.55) { const rr = 1500 * MO.sineInOut(D.at(lt, 0, 0.55)); c.save(); c.fillStyle = C.ink; c.beginPath(); c.rect(0, 0, W, H); c.arc(540, 620, rr, 0, TAU, true); c.fill('evenodd'); c.restore(); }
  D.finish(c, { t });
};
})();
