// 画风套件 kusama（配方 huashu-art-motion 21_kusama「草间弥生无限波点」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：红（或奶油/靛）底＋手绘不规则圆点；所有点的半径乘同一个「从注意力原点出发的行波」，整屏像在呼吸；
//       黄色只给「被注意到」的地方（注意力之光 K.glow）；黑描边平涂；点在六角网格上按下标取模生成（不存数组、帧间稳定），带抖动与随机转角。
//       图表/文字密集镜头用「静版」底（K.bg 的 quiet）：点更稀更淡、只在四周；字幕带内点缩小。
//       激活点半径必须封顶（间距 38 时 ≤ 16.5），否则糊成黑块。所有随机走 U.hash / U.rng，同一 t 画同一帧。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：负半径一律按 0 画（pop 的回弹起步段会算出负数，canvas 遇负半径直接抛错）
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  red: '#d9402f', redDk: '#a92a22', redLt: '#e8604c', cream: '#fbf1dc', cream2: '#f1e2c0', white: '#fffaf0',
  yellow: '#f7cc2e', orange: '#f29a2e', black: '#1b1512', coral: '#ef6a52', pink: '#f7b7a8',
  indigo: '#2a2a5c', indigoLt: '#4a4a8c', night: '#1f1f4a', sub: '#8b6f5e',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
const ss = (a, b, x) => { if (a === b) return x < a ? 0 : 1; const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };   // a>b 时反向
K.ss = ss;
K.mix = (a, b, k) => { const A = P.hex(a), B = P.hex(b); k = clamp(k); return `rgb(${lerp(A[0], B[0], k) | 0},${lerp(A[1], B[1], k) | 0},${lerp(A[2], B[2], k) | 0})`; };
const mixc = K.mix;

// ---------- 点：手绘不规则圆 ----------
// 轻微椭圆＋随机转角，像手画的。r<0.4 不画。
K.dot = (c, x, y, r, col, seed = 0, asp) => { if (r < 0.4) return; c.fillStyle = col; c.beginPath();
  c.ellipse(x, y, r, r * (asp ?? (0.88 + U.hash(seed, 3) * 0.2)), U.hash(seed, 5) * TAU, 0, TAU); c.fill(); };
// 有机圆形/椭圆路径（种子决定的不规则）
K.blob = (cx, cy, rx, seed = 1, wob = 0.07, n = 12, ry = rx) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (U.hash(i, seed) - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return K.smooth(pts); };
// 手绘圆环（描边，可选填充）
K.ring = (c, x, y, r, col = C.black, lw = 6, seed = 0, fill = null) => { const p = K.blob(x, y, r, seed, 0.035, 14);
  if (fill) { c.fillStyle = fill; c.fill(p); } c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(p); };
// 行波：以 (ox,oy) 为原点，0.84±amp，6rad/s。k 是速度倍数（放松章 0.5，焦虑章 1.6）
K.wave = (x, y, t, o = {}) => { const { ox = 540, oy = 900, k = 1, amp = 0.26 } = o; return 0.84 + amp * Math.sin(Math.hypot(x - ox, y - oy) * 0.016 - t * 6 * k); };
const band = y => 1 - 0.55 * ss(1330, 1400, y) * (1 - ss(1580, 1640, y));   // 字幕带里点收小 55%
K.band = band;

// 六角网格取模点阵：在 box 里铺点。o: { sp 间距, r 半径, col, seed, jit 抖动, t, pace 行波速度, amp, ox, oy 行波原点, still 不动不缩带,
//   fn(x,y,i,j)→半径倍数, colFn(x,y,i,j)→颜色（逐点 fill）, rowH 行距比 }
K.dots = (c, box, o = {}) => {
  const [x0, y0, x1, y1] = box, { sp = 118, r = 24, col = C.cream, seed = 1, jit = 0.3, t = 0, pace = 1, amp = 0.26, ox = 540, oy = 900, still = false, fn = null, colFn = null } = o;
  const rowH = sp * 0.87, j0 = Math.floor(y0 / rowH) - 1, j1 = Math.ceil(y1 / rowH) + 1;
  if (!colFn) { c.fillStyle = col; c.beginPath(); }
  for (let j = j0; j <= j1; j++) { const off = (j & 1) * sp / 2, i0 = Math.floor((x0 - off) / sp) - 1, i1 = Math.ceil((x1 - off) / sp) + 1;
    for (let i = i0; i <= i1; i++) { const key = i * 131 + j * 7919, x = i * sp + off + (U.hash(key, seed) - 0.5) * sp * jit, y = j * rowH + (U.hash(key, seed + 1) - 0.5) * sp * jit;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      let rr = r * (0.8 + U.hash(key, seed + 2) * 0.4); if (!still) rr *= K.wave(x, y, t, { ox, oy, k: pace, amp }) * band(y);
      if (fn) rr *= fn(x, y, i, j); if (rr < 0.5) continue;
      const rot = U.hash(key, seed + 3) * TAU, asp = 0.88 + U.hash(key, seed + 4) * 0.2;
      if (colFn) { c.fillStyle = colFn(x, y, i, j); c.beginPath(); c.ellipse(x, y, rr, rr * asp, rot, 0, TAU); c.fill(); }
      else { c.moveTo(x + rr, y); c.ellipse(x, y, rr, rr * asp, rot, 0, TAU); } } }
  if (!colFn) c.fill(); };

// ---------- 底 ----------
// mode: red 红底白点（默认，概念/叙事）｜cream 奶油底珊瑚点（放松/睡眠，降刺激）｜indigo 靛蓝底（冷静/数据章换气）｜yellow 黄底黑点（强调）
// quiet:true → 「静版」：点更稀更淡、只在四周，中间 keep 区（默认 [70,170,1010,1370]）不放点，图表/文字密集镜头用
// o: { mode, quiet, seed, pace 行波速度倍数, ox,oy 行波原点（填注意力之光所在处）, keep, dense 0..1（静版点量） }
const MODES = {
  red: { base: C.red, big: C.cream, small: C.cream, bigR: 24, smR: 8, amp: 0.26, pace: 1 },
  cream: { base: C.cream, big: C.coral, small: '#f4c3b0', bigR: 20, smR: 7, amp: 0.2, pace: 0.55 },
  indigo: { base: C.night, big: '#3d3d86', small: C.cream, bigR: 22, smR: 5, amp: 0.2, pace: 0.6 },
  yellow: { base: C.yellow, big: C.black, small: C.red, bigR: 18, smR: 6, amp: 0.24, pace: 0.9 },
};
K.bgBase = mode => (MODES[mode] || MODES.red).base;
K.bg = (c, t, o = {}) => {
  const M = MODES[o.mode || 'red'] || MODES.red, { seed = 1, ox = 540, oy = 900, quiet = false, keep = [70, 170, 1010, 1370], dense = 1 } = o, pace = (o.pace ?? 1) * M.pace;
  c.fillStyle = M.base; c.fillRect(0, 0, W, H);
  if (!quiet) {
    K.dots(c, [-20, -20, W + 40, H + 40], { sp: 118, r: M.bigR, col: M.big, seed: seed * 3, t, pace, amp: M.amp, ox, oy });
    K.dots(c, [30, 40, W + 40, H + 40], { sp: 118, r: M.smR, col: M.small, seed: seed * 3 + 1, jit: 0.5, t, pace: pace * 1.3, amp: M.amp, ox, oy });
  } else {
    const pale = mixc(M.base, M.big, 0.3), [kx0, ky0, kx1, ky1] = keep;
    const away = (x, y) => { const d = Math.max(kx0 - x, x - kx1, ky0 - y, y - ky1, 0); return ss(0, 150, d) * dense; };
    K.dots(c, [-20, -20, W + 40, H + 40], { sp: 150, r: M.bigR * 0.8, col: pale, seed: seed * 3, t, pace, amp: M.amp * 0.7, ox, oy, fn: away });
  } };
K.bgQuiet = (c, t, o = {}) => K.bg(c, t, { ...o, quiet: true });

// ---------- 收尾 ----------
// 压暗字幕带（y≈1380–1580）＋四角轻压边。每镜最后调一次。
K.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.45, 700, W / 2, H * 0.45, 1400); g.addColorStop(0, 'rgba(27,21,18,0)'); g.addColorStop(1, 'rgba(27,21,18,.16)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1350, 0, 1620); b.addColorStop(0, 'rgba(27,21,18,0)'); b.addColorStop(0.28, 'rgba(27,21,18,.27)'); b.addColorStop(0.72, 'rgba(27,21,18,.27)'); b.addColorStop(1, 'rgba(27,21,18,0)'); c.fillStyle = b; c.fillRect(0, 1350, W, 270);
};

// ---------- 文字 ----------
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot, stroke 描边色, sw 描边宽 }
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.black, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, stroke = null, sw = 10 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 药丸标签：黄底＋黑描边＋红点（原型的标题样式）。返回宽度。o: { size, fam, fill, col, scale, alpha, rot, padX, dots }
K.tag = (c, s, x, y, o = {}) => { const { size = 56, fam = 'PuHui-Black', fill = C.yellow, col = C.black, scale = 1, alpha = 1, rot = 0, padX = 0.8, dots = true, lw = 6 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.62, p = K.round(-w / 2, -h / 2, w, h, h / 2);
  c.fillStyle = fill; c.fill(p);
  if (dots) { c.save(); c.clip(p); K.dots(c, [-w / 2, -h / 2, w / 2, h / 2], { sp: h * 0.62, r: h * 0.09, col: fill === C.yellow ? C.red : C.coral, seed: 5, still: true, jit: 0.5 }); c.restore(); }
  c.strokeStyle = C.black; c.lineWidth = lw; c.stroke(p);
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
// 顶部标题药丸（≤8 字），y48–198
K.title = (c, s, lt = 99, at = 0, o = {}) => { const p = K.pop(lt, at, 0.45); if (p <= 0) return; K.tag(c, s, 540, o.y ?? 123, { size: 100, scale: p, alpha: clamp(p * 2), ...o }); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：黑线＋黑圆头先画出，末端药丸标签逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.yellow, col = C.black, size = 50 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.black; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  K.dot(c, ax, ay, 11 * Math.min(1, p1 * 3), C.black, 1); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.6, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  const p = K.round(-w / 2, -h / 2, w, h, h / 2); c.fillStyle = fill; c.fill(p); c.strokeStyle = C.black; c.lineWidth = 6; c.stroke(p);
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.8, 3); c.restore(); };

// ---------- 线：沿折线撒点 ----------
// 折线 pts 按弧长每 sp 撒一个点，半径 r→r2 渐变。o: { sp, r, r2, col, prog 0..1, t（有就呼吸）, seed, pulse {at:0..1, w:px} 或数组（亮点脉冲：变大变色）, litCol }
// 返回 { total, end:[x,y], ang }
K.dotLine = (c, pts, o = {}) => {
  const { sp = 22, r = 6, r2 = null, col = C.black, prog = 1, seed = 1, t = null, litCol = C.red } = o, pulses = o.pulse ? (Array.isArray(o.pulse) ? o.pulse : [o.pulse]) : [];
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1, n = Math.floor(total * clamp(prog) / sp); let seg = 0, end = pts[0], ang = 0;
  for (let k = 0; k <= n; k++) { const d = k * sp; while (seg < pts.length - 2 && cum[seg + 1] < d) seg++;
    const a = pts[seg], b = pts[seg + 1] || a, L = (cum[seg + 1] - cum[seg]) || 1, u = clamp((d - cum[seg]) / L), x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u);
    let rr = lerp(r, r2 ?? r, d / total) * (0.85 + U.hash(k, seed) * 0.3); if (t != null) rr *= 0.9 + 0.2 * Math.sin(d * 0.05 - t * 6);
    let lit = 0; for (const p of pulses) lit = Math.max(lit, Math.exp(-Math.pow((d - p.at * total) / (p.w || 90), 2)));
    K.dot(c, x, y, rr * (1 + lit * 0.9), lit > 0.3 ? litCol : col, k + seed * 99); end = [x, y]; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  return { total, end, ang }; };
K.curve = (p0, p1, p2, n = 24) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; o.push([v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1]]); } return o; };
// 箭头：点线（点越来越大）＋黑色手绘箭头。o: { bend 弯曲像素, col, r, r2, dur, head }
K.arrow = (c, x0, y0, x1, y1, lt, at, o = {}) => { const { bend = 0, col = C.black, r = 4, r2 = 9, dur = 0.5, head = 46 } = o, q = MO.cubicOut(K.at(lt, at, dur)); if (q <= 0) return;
  const mx = (x0 + x1) / 2 - (y1 - y0) / Math.hypot(x1 - x0, y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) / Math.hypot(x1 - x0, y1 - y0) * bend, pts = K.curve([x0, y0], [mx, my], [x1, y1], 28);
  const e = K.dotLine(c, pts, { sp: 24, r, r2, col, prog: q * 0.9, seed: 7 }); if (q < 0.9) return;
  const k = clamp((q - 0.9) / 0.1), a = Math.atan2(y1 - my, x1 - mx); c.save(); c.translate(x1, y1); c.rotate(a); c.scale(k, k);
  c.beginPath(); c.moveTo(head * 0.5, 0); c.lineTo(-head * 0.5, -head * 0.7); c.lineTo(-head * 0.2, 0); c.lineTo(-head * 0.5, head * 0.7); c.closePath(); c.fillStyle = col; c.fill(); c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = 6; c.stroke(); c.restore(); };

// ---------- 注意力之光 ----------
// 黄核＋黑边＋红芯＋一圈黑小点（绕椭圆慢转）。贯穿全书，每章都在场，位置随话题移动。o: { s 缩放, alpha, halo 大光圈 0..1 }
K.glow = (c, x, y, t, o = {}) => { const s = o.s ?? 1, a = o.alpha ?? 1; if (a <= 0 || s <= 0) return; const pul = 1 + 0.12 * Math.sin(t * 6);
  c.save(); c.globalAlpha *= a;
  if (o.halo) { c.globalAlpha *= clamp(o.halo) * 0.55; K.dot(c, x, y, 120 * s * pul, C.yellow, 11, 1); c.globalAlpha /= clamp(o.halo) * 0.55 || 1; }
  K.dot(c, x, y, 56 * s * pul, C.black, 1, 1); K.dot(c, x, y, 46 * s * pul, C.yellow, 2, 1); K.dot(c, x, y, 20 * s * pul, C.red, 3, 1); K.dot(c, x - 6 * s, y - 7 * s, 7 * s, C.cream, 4, 1);
  for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + t * 0.6; K.dot(c, x + Math.cos(an) * 78 * s * pul, y + Math.sin(an) * 52 * s * pul, 8 * s, C.black, i + 20, 1); }
  c.restore(); };
// 让光在两点（或一串点）之间移动：k 0..1，缓入缓出；arc 是中途拱起的像素
K.focus = (a, b, k, o = {}) => { const e = MO.cubicInOut(clamp(k)), arc = (o.arc || 0) * Math.sin(e * Math.PI); return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - arc]; };
K.focusPath = (pts, k) => { const n = pts.length - 1, f = clamp(k) * n, i = Math.min(n - 1, Math.floor(f)); return K.focus(pts[i], pts[i + 1], f - i, {}).map((v, j) => (f - i) > 0 && (f - i) < 1 ? lerp(pts[i][j], pts[i + 1][j], f - i) : v); };

// ---------- 涟漪（波点扩散） ----------
// 以 (x,y) 为圆心的点环一圈圈向外。o: { t0, speed 255, gap 125, n 6, loop true（循环，否则只扩一次）, from 外圈色, to 内圈色, clip [x0,y0,x1,y1], maxDots }
K.ripple = (c, x, y, t, o = {}) => { const { t0 = 0, speed = 255, gap = 125, n = 6, loop = true, from = C.red, to = C.yellow, clip = [0, 150, W, 1365], maxDots = 150 } = o;
  c.save(); if (clip) { c.beginPath(); c.rect(clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1]); c.clip(); }
  const span = gap * n, front = (t - t0) * speed; if (front < 0) { c.restore(); return; }
  for (let k = 0; k < n; k++) { const R = loop ? (front + k * gap) % span : front - k * gap; if (R < 30) continue;
    const fade = loop ? clamp(1 - R / span) * clamp(R / 100) : clamp(1 - k / n) * clamp(R / 120), cnt = Math.min(maxDots, Math.max(12, (R * 0.45) | 0)), sz = 6 + 10 * fade + (cnt === maxDots ? R / maxDots * 0.25 : 0);
    for (let i = 0; i < cnt; i++) { const a = i / cnt * TAU + k * 0.7; K.dot(c, x + Math.cos(a) * R, y + Math.sin(a) * R, sz * (0.8 + 0.3 * Math.sin(i * 1.7 + t * 4)), mixc(from, to, 0.35 + 0.65 * fade), i + k * 300); } }
  c.restore(); };

// ---------- 通用「点填充形体」 ----------
// parts: { strokes:[{a:[x,y],b:[x,y],w,tag}], polys:[{pts,tag}], paths:[{path,tag}], bbox:[x0,y0,x1,y1]（局部坐标，缺省由 strokes 推） }
// 画法：离屏层里先铺底色，source-atop 铺黄色高亮与点阵（被光/行波照到的点变黑变大），destination-over 垫黑描边，再整块贴回。
// o: { flip, sp 38, rb 8.5, base, dotCol, litCol, litBg, outline, grow 描边外扩, t, pace, alpha, hi:[tag…] 黄色高亮的部件, hiA, blobs:[{x,y,r,a}]（局部坐标，黄色光斑）,
//      reach/ox/oy（屏幕坐标：行波原点与激活半径）, deco(g) 在层内画局部装饰 }
const bboxOf = parts => { if (parts.bbox) return parts.bbox; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  (parts.strokes || []).forEach(s => { add(s.a[0], s.a[1], s.w / 2); add(s.b[0], s.b[1], s.w / 2); }); (parts.polys || []).forEach(p => p.pts.forEach(q => add(q[0], q[1], 0))); return [x0, y0, x1, y1]; };
const segDist = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, u = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L); return Math.hypot(px - (a[0] + dx * u), py - (a[1] + dy * u)); };
K.figure = (c, x, y, s, parts, o = {}) => {
  const { flip = 1, sp = 38, rb = 8.5, base = C.cream, dotCol = C.coral, litCol = C.black, litBg = C.yellow, outline = C.black, grow = 8, t = 0, pace = 1, alpha = 1, hi = null, hiA = 1, blobs = null, deco = null, reach = 0 } = o;
  if (alpha <= 0 || s <= 0) return;
  const bb = bboxOf(parts), M = c.getTransform(), pad = grow * s + 8, cw = c.canvas.width || W, ch = c.canvas.height || H;
  const xs = [], ys = []; for (const lx of [bb[0], bb[2]]) for (const ly of [bb[1], bb[3]]) { const X = x + lx * s * flip, Y = y + ly * s; xs.push(M.a * X + M.c * Y + M.e); ys.push(M.b * X + M.d * Y + M.f); }
  const dx0 = Math.max(0, Math.floor(Math.min(...xs) - pad * Math.abs(M.a))), dy0 = Math.max(0, Math.floor(Math.min(...ys) - pad * Math.abs(M.d))), dx1 = Math.min(cw, Math.ceil(Math.max(...xs) + pad * Math.abs(M.a))), dy1 = Math.min(ch, Math.ceil(Math.max(...ys) + pad * Math.abs(M.d)));
  if (dx1 <= dx0 || dy1 <= dy0) return;
  const g = P.scratch('kfig').getContext('2d');
  const draw = (col, gr, only) => { g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of parts.paths || []) { if (only && !only.has(p.tag)) continue; g.fill(p.path); if (gr) { g.lineWidth = gr * 2; g.stroke(p.path); } }
    for (const p of parts.polys || []) { if (only && !only.has(p.tag)) continue; g.beginPath(); p.pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fill(); if (gr) { g.lineWidth = gr * 2; g.stroke(); } }
    for (const q of parts.strokes || []) { if (only && !only.has(q.tag)) continue; if (q.a[0] === q.b[0] && q.a[1] === q.b[1]) { g.beginPath(); g.arc(q.a[0], q.a[1], q.w / 2 + gr, 0, TAU); g.fill(); } else { g.lineWidth = q.w + gr * 2; g.beginPath(); g.moveTo(q.a[0], q.a[1]); g.lineTo(q.b[0], q.b[1]); g.stroke(); } } };
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  g.setTransform(M.a, M.b, M.c, M.d, M.e, M.f); g.translate(x, y); g.scale(s * flip, s);
  draw(base, 0, null); g.globalCompositeOperation = 'source-atop';
  const hiSet = hi && hi.length && hiA > 0 ? new Set(hi) : null;
  if (hiSet) { g.globalAlpha = clamp(hiA); draw(litBg, 0, hiSet); g.globalAlpha = 1; }
  for (const b of blobs || []) { if (!(b.a > 0)) continue; const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); gr.addColorStop(0, `rgba(247,204,46,${clamp(b.a)})`); gr.addColorStop(0.72, `rgba(247,204,46,${clamp(b.a) * 0.85})`); gr.addColorStop(1, 'rgba(247,204,46,0)'); g.fillStyle = gr; g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); }
  // 点阵（局部坐标，六角取模）
  const lox = ((o.ox ?? (x + (bb[0] + bb[2]) / 2 * s * flip)) - x) / (s * flip), loy = ((o.oy ?? (y + (bb[1] + bb[3]) / 2 * s)) - y) / s, cols = [];
  for (let i = 0; i <= 7; i++) cols.push(mixc(dotCol, litCol, i / 7));
  const segs = hiSet ? (parts.strokes || []).filter(q => hiSet.has(q.tag)) : [], rowH = sp * 0.87, rmax = sp * 0.43;
  for (let j = Math.floor(bb[1] / rowH) - 1; j <= Math.ceil(bb[3] / rowH) + 1; j++) { const off = (j & 1) * sp / 2;
    for (let i = Math.floor((bb[0] - off) / sp) - 1; i <= Math.ceil((bb[2] - off) / sp) + 1; i++) { const key = i * 131 + j * 7919, px = i * sp + off + (U.hash(key, 7) - 0.5) * sp * 0.28, py = j * rowH + (U.hash(key, 8) - 0.5) * sp * 0.28;
      if (px < bb[0] - sp || px > bb[2] + sp || py < bb[1] - sp || py > bb[3] + sp) continue;
      let act = 0; for (const q of segs) act = Math.max(act, ss(q.w / 2 + sp * 0.5, q.w / 2 - sp * 0.2, segDist(px, py, q.a, q.b)) * hiA);
      for (const b of blobs || []) act = Math.max(act, ss(b.r * 0.85, b.r * 0.45, Math.hypot(px - b.x, py - b.y)) * clamp(b.a || 0));
      if (reach > 0) act = Math.max(act, ss(reach + 40, reach - 220, Math.hypot((px - lox) * s, (py - loy) * s)));
      const sc = 0.8 + U.hash(key, 9) * 0.4, wv = K.wave(px * flip * s + x, py * s + y, t, { ox: o.ox ?? 540, oy: o.oy ?? 900, k: pace * 1.2 }), rr = Math.min(rmax, (rb + 6 * act) * sc * wv);
      g.fillStyle = cols[Math.round(ss(0.45, 0.85, act) * 7)]; g.beginPath(); g.ellipse(px, py, rr, rr * (0.88 + U.hash(key, 10) * 0.2), U.hash(key, 11) * TAU, 0, TAU); g.fill(); } }
  if (deco) deco(g);
  g.globalCompositeOperation = 'destination-over'; draw(outline, grow, null); g.restore();
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= alpha; c.drawImage(g.canvas, dx0, dy0, dx1 - dx0, dy1 - dy0, dx0, dy0, dx1 - dx0, dy1 - dy0); c.restore(); };

// ---------- 人形（坐 / 躺 / 站 / 举手 / 手放胸口，姿势可混合）----------
// K.person(c, x, y, s, o) —— 站姿 (x,y)=两脚中点，s=1 身高约 1000px；坐姿 (x,y)=坐垫（盘腿）或脚下（椅子）；躺姿 (x,y)=身体中心（俯视，头在左）。
// o: { pose 'stand'|'sit'|'chair'|'lie'|'armsUp'|'chest', to, mix, hi 高亮部位名/数组/{名:0..1}, hiA, glow 光所在（部位名或 [x,y]，true=第一个 hi）, gs 光大小,
//      reach 光扩散半径(px，身体点阵被波前点亮), t, breath -1..1（缺省慢呼吸）, flip, base 底色, alpha, sp 点间距 }
// hi 部位名：head throat chest heart belly pelvis shoulderL shoulderR kneeL kneeR toes toesL toesR（光斑）；
//            handL handR hands armL armR arms legL legR legs footL footR feet torso all（整件变黄）
// 返回锚点（屏幕坐标）：head crown throat chest heart belly pelvis shoulderL shoulderR handL handR kneeL kneeR footL footR toesL toesR
const POSE = {
  stand: { head: [0, -930], neck: [0, -850], shL: [-120, -805], shR: [120, -805], hip: [0, -470], hpL: [-48, -470], hpR: [48, -470], elL: [-165, -630], elR: [165, -630], haL: [-185, -450], haR: [185, -450], knL: [-52, -250], knR: [52, -250], ftL: [-58, -35], ftR: [58, -35] },
  armsUp: { head: [0, -930], neck: [0, -850], shL: [-120, -805], shR: [120, -805], hip: [0, -470], hpL: [-48, -470], hpR: [48, -470], elL: [-215, -960], elR: [215, -960], haL: [-200, -1130], haR: [200, -1130], knL: [-52, -250], knR: [52, -250], ftL: [-58, -35], ftR: [58, -35] },
  chest: { head: [0, -930], neck: [0, -850], shL: [-120, -805], shR: [120, -805], hip: [0, -470], hpL: [-48, -470], hpR: [48, -470], elL: [-170, -630], elR: [170, -630], haL: [-30, -705], haR: [30, -705], knL: [-52, -250], knR: [52, -250], ftL: [-58, -35], ftR: [58, -35] },
  sit: { head: [0, -545], neck: [0, -465], shL: [-120, -420], shR: [120, -420], hip: [0, -85], hpL: [-48, -85], hpR: [48, -85], elL: [-185, -270], elR: [185, -270], haL: [-250, -120], haR: [250, -120], knL: [-290, -70], knR: [290, -70], ftL: [-45, -50], ftR: [45, -50] },
  chair: { head: [0, -905], neck: [0, -825], shL: [-120, -780], shR: [120, -780], hip: [0, -440], hpL: [-48, -440], hpR: [48, -440], elL: [-170, -610], elR: [170, -610], haL: [-95, -395], haR: [95, -395], knL: [-85, -390], knR: [85, -390], ftL: [-90, -40], ftR: [90, -40] },
  lie: { head: [-470, 0], neck: [-385, 0], shL: [-340, -125], shR: [-340, 125], hip: [30, 0], hpL: [30, -48], hpR: [30, 48], elL: [-250, -180], elR: [-250, 180], haL: [-70, -165], haR: [-70, 165], knL: [265, -55], knR: [265, 55], ftL: [470, -70], ftR: [470, 70] },
};
K.POSES = Object.keys(POSE);
const mixPose = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A, o = {}; for (const n in A) o[n] = [lerp(A[n][0], B[n][0], k), lerp(A[n][1], B[n][1], k)]; return o; };
const buildPose = (x, y, s, o) => { const { pose = 'stand', to = null, mix = 0, flip = 1, t = 0 } = o, J = mixPose(pose, to || pose, MO.cubicInOut(clamp(mix)));
  const br = o.breath ?? Math.sin(t * 1.6) * 0.5, lieK = pose === 'lie' && !to ? 1 : 0;
  if (!lieK) { for (const n of ['head', 'neck', 'shL', 'shR']) J[n] = [J[n][0], J[n][1] - 7 * br]; } else { for (const n of ['shL', 'shR']) J[n] = [J[n][0] + 6 * br, J[n][1]]; }
  const A = p => [x + p[0] * s * flip, y + p[1] * s], mid = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const chest = mid(J.neck, J.hip, 0.27), belly = mid(J.neck, J.hip, 0.64), tipT = (k, f) => { const dx = J[f][0] - J[k][0], dy = J[f][1] - J[k][1], L = Math.hypot(dx, dy) || 1; return [J[f][0] + dx / L * 58, J[f][1] + dy / L * 58]; };
  const sgn = lieK ? 0 : 1, an = {
    head: A(J.head), crown: A([J.head[0], J.head[1] - 70]), throat: A(mid(J.head, J.neck, 0.78)), chest: A(chest), heart: A([chest[0] + (lieK ? 0 : 38 * flip * 0 + 38), chest[1] + (lieK ? 38 : 0)]), belly: A(belly), pelvis: A(mid(J.hip, J.neck, 0.08)),
    shoulderL: A(J.shL), shoulderR: A(J.shR), handL: A(J.haL), handR: A(J.haR), kneeL: A(J.knL), kneeR: A(J.knR), footL: A(J.ftL), footR: A(J.ftR), toesL: A(tipT('knL', 'ftL')), toesR: A(tipT('knR', 'ftR')) };
  return { J, an, br, sgn }; };
K.anchors = (x, y, s, o = {}) => buildPose(x, y, s, o).an;
const LIMB = { head: ['head'], neck: ['neck'], torso: ['torso'], handL: ['handL'], handR: ['handR'], hands: ['handL', 'handR'], armL: ['armL', 'foreL', 'handL'], armR: ['armR', 'foreR', 'handR'], arms: ['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'],
  legL: ['thighL', 'shinL', 'footL'], legR: ['thighR', 'shinR', 'footR'], legs: ['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'], footL: ['footL'], footR: ['footR'], feet: ['footL', 'footR'] };
LIMB.all = [].concat(...Object.values(LIMB));
const BLOB = { chest: ['chest', 150], heart: ['heart', 95], belly: ['belly', 150], throat: ['throat', 85], pelvis: ['pelvis', 130], shoulderL: ['shoulderL', 90], shoulderR: ['shoulderR', 90], kneeL: ['kneeL', 90], kneeR: ['kneeR', 90], toesL: ['toesL', 85], toesR: ['toesR', 85], head: ['head', 130] };
const hiMap = h => !h ? {} : typeof h === 'string' ? { [h]: 1 } : Array.isArray(h) ? Object.fromEntries(h.map(n => [n, 1])) : h;
K.person = (c, x, y, s = 0.8, o = {}) => {
  const { flip = 1, hiA = 1, alpha = 1, t = 0 } = o, { J, an, br } = buildPose(x, y, s, o), H = hiMap(o.hi), tags = [], blobs = [];
  for (const n in H) { const a = clamp((H[n] ?? 1) * hiA); if (a <= 0) continue; if (LIMB[n] && n !== 'head') LIMB[n].forEach(g => tags.push(g)); else if (BLOB[n]) { const [an0, R] = BLOB[n], p = an[an0]; blobs.push({ x: (p[0] - x) / (s * flip), y: (p[1] - y) / s, r: R, a }); } else if (n === 'head') blobs.push({ x: (an.head[0] - x) / (s * flip), y: (an.head[1] - y) / s, r: 130, a }); }
  // 光的位置
  const ANC = { hands: 'handL', armL: 'handL', armR: 'handR', arms: 'chest', legL: 'kneeL', legR: 'kneeR', legs: 'pelvis', feet: 'footL', torso: 'chest', neck: 'throat', all: 'chest' };
  const anOf = n => an[n] || an[ANC[n]] || (BLOB[n] && an[BLOB[n][0]]) || null;
  let gp = null; const G = o.glow; if (G) gp = Array.isArray(G) ? G : anOf(G === true ? Object.keys(H)[0] : G) || an.chest;
  if (o.pose === 'chair' || o.to === 'chair') { const k = o.pose === 'chair' ? 1 - (o.mix || 0) : o.mix || 0; if (k > 0.5) { c.save(); c.translate(x, y); c.scale(s * flip, s); const p = K.round(-200, -415, 400, 52, 20); c.fillStyle = C.cream2; c.fill(p); c.strokeStyle = C.black; c.lineWidth = 8; c.stroke(p);
    c.lineCap = 'round'; c.beginPath(); c.moveTo(-170, -363); c.lineTo(-170, -30); c.moveTo(170, -363); c.lineTo(170, -30); c.stroke(); c.restore(); } }
  const sh = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sx = J.shR[0] - J.shL[0], sy = J.shR[1] - J.shL[1], sl = Math.hypot(sx, sy) || 1, nx = sx / sl, ny = sy / sl, bw = 1 + 0.05 * br;
  const parts = { strokes: [
    { a: J.neck, b: J.head, w: 46, tag: 'neck' }, { a: J.head, b: J.head, w: 150, tag: 'head' },
    { a: J.shL, b: J.elL, w: 56, tag: 'armL' }, { a: J.elL, b: J.haL, w: 48, tag: 'foreL' }, { a: J.haL, b: J.haL, w: 70, tag: 'handL' },
    { a: J.shR, b: J.elR, w: 56, tag: 'armR' }, { a: J.elR, b: J.haR, w: 48, tag: 'foreR' }, { a: J.haR, b: J.haR, w: 70, tag: 'handR' },
    { a: J.hpL, b: J.knL, w: 96, tag: 'thighL' }, { a: J.knL, b: J.ftL, w: 74, tag: 'shinL' }, { a: J.ftL, b: J.ftL, w: 78, tag: 'footL' },
    { a: J.hpR, b: J.knR, w: 96, tag: 'thighR' }, { a: J.knR, b: J.ftR, w: 74, tag: 'shinR' }, { a: J.ftR, b: J.ftR, w: 78, tag: 'footR' }],
    polys: [{ pts: [[J.shL[0] - nx * 6, J.shL[1] - ny * 6], [J.shR[0] + nx * 6, J.shR[1] + ny * 6], [J.hpR[0] + nx * 28, J.hpR[1] + ny * 28], [J.hpL[0] - nx * 28, J.hpL[1] - ny * 28]].map(([px, py]) => { const cx = (J.shL[0] + J.shR[0] + J.hpL[0] + J.hpR[0]) / 4, cy = (J.shL[1] + J.shR[1] + J.hpL[1] + J.hpR[1]) / 4; return [cx + (px - cx) * bw, cy + (py - cy) * bw]; }), tag: 'torso' }],
    bbox: null };
  parts.bbox = bboxOf(parts); parts.bbox = [parts.bbox[0] - 20, parts.bbox[1] - 20, parts.bbox[2] + 20, parts.bbox[3] + 20];
  K.figure(c, x, y, s, parts, { ...o, hi: tags, hiA, blobs, ox: gp ? gp[0] : undefined, oy: gp ? gp[1] : undefined, reach: gp ? (o.reach || 0) : 0, base: o.base || C.cream, grow: o.grow ?? 8 / Math.max(s, 0.45), sp: o.sp ?? 38 });
  if (gp) K.glow(c, gp[0], gp[1], t, { s: o.gs ?? clamp(s * 1.05, 0.45, 1.2), alpha, halo: o.halo });
  return an; };

// ---------- 器官图标（波点化）----------
// 都是 (c, x, y, s, o)，s=1 约 300px 宽。o: { t, lit 0..1（整体点亮成黄）, base, dotCol, alpha, ox, oy, k 行波速度 }
const organ = (name, mk) => (c, x, y, s = 1, o = {}) => { const P0 = mk(o, s), t = o.t || 0;
  K.figure(c, x, y, P0.s ?? s, P0.parts, { t, pace: o.k || 1, alpha: o.alpha ?? 1, base: o.base || P0.base, dotCol: o.dotCol || P0.dot, sp: o.sp ?? 34, rb: 7.5, grow: 7 / Math.max(s, 0.5), ox: o.ox ?? x, oy: o.oy ?? y, blobs: o.lit ? [{ x: P0.cx || 0, y: P0.cy || 0, r: P0.R || 200, a: o.lit }] : null, deco: P0.deco, flip: o.flip || 1 }); };
const dotArc = (g, pts, r, col, sp = 20, seed = 1) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); let seg = 0;
  for (let d = 0, k = 0; d <= cum[cum.length - 1]; d += sp, k++) { while (seg < pts.length - 2 && cum[seg + 1] < d) seg++; const L = (cum[seg + 1] - cum[seg]) || 1, u = clamp((d - cum[seg]) / L); K.dot(g, lerp(pts[seg][0], pts[seg + 1][0], u), lerp(pts[seg][1], pts[seg + 1][1], u), r * (0.85 + U.hash(k, seed) * 0.3), col, k + seed); } };
const BRAIN = K.once('kBrain', () => ({ main: K.smooth([[-170, 10], [-185, -50], [-150, -110], [-90, -145], [-20, -160], [60, -150], [125, -115], [165, -55], [170, 0], [140, 40], [90, 52], [30, 58], [-30, 70], [-100, 60], [-150, 45]]), cb: K.ellipse(100, 78, 70, 42, -0.15) }));
K.brain = organ('brain', (o, s) => ({ parts: { paths: [{ path: BRAIN.main, tag: 'b' }, { path: BRAIN.cb, tag: 'c' }], strokes: [{ a: [22, 50], b: [38, 150], w: 52, tag: 's' }], bbox: [-190, -175, 190, 205] }, base: C.cream, dot: C.coral, cx: -10, cy: -40, R: 220,
  deco: g => { const ar = [[[-125, -60], [-80, -115], [-25, -70]], [[-20, -95], [40, -135], [100, -75]], [[-135, 5], [-70, -30], [0, 10]], [[15, -20], [80, -55], [140, -10]], [[-100, 40], [-30, 18], [50, 38]]];
    g.globalCompositeOperation = 'source-atop'; ar.forEach((a, i) => dotArc(g, K.curve(a[0], a[1], a[2], 12), 5.5, C.black, 17, i + 3));
    if (o.insula) { const q = o.insula === true ? 1 : o.insula, pu = 1 + 0.06 * Math.sin((o.t || 0) * 6); K.dot(g, -15, -5, 52 * q * pu, C.black, 1, 1); K.dot(g, -15, -5, 44 * q * pu, C.yellow, 2, 1); K.dot(g, -15, -5, 17 * q * pu, C.red, 3, 1); } } }));
// 岛叶：大脑里深处的一团黄点（大脑图标 + 黄色岛叶，o.insula 0..1）
K.insula = (c, x, y, s = 1, o = {}) => K.brain(c, x, y, s, { ...o, insula: o.insula ?? 1 });
const heartPts = K.once('kHeart', () => { const p = []; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; p.push([6.2 * 16 * Math.pow(Math.sin(a), 3), -6.2 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) + 10]); } return K.smooth(p); });
K.heart = (c, x, y, s = 1, o = {}) => { const bpm = o.bpm || 70, beat = 1 + 0.07 * Math.max(0, Math.sin((o.t || 0) * bpm / 60 * TAU));
  organ('heart', () => ({ s: s * beat, parts: { paths: [{ path: heartPts, tag: 'h' }], strokes: [], bbox: [-110, -120, 110, 120] }, base: C.coral, dot: C.cream, cx: 0, cy: -10, R: 150 }))(c, x, y, s, o); };
const LUNG = K.once('kLung', () => ({ l: K.smooth([[-30, -100], [-95, -85], [-135, -20], [-140, 60], [-110, 110], [-50, 105], [-25, 40]]), r: K.smooth([[30, -100], [95, -85], [135, -20], [140, 60], [110, 110], [50, 105], [25, 40]]) }));
K.lung = (c, x, y, s = 1, o = {}) => { const b = o.breath ?? Math.sin((o.t || 0) * 1.6), k = 1 + 0.07 * b;
  organ('lung', () => ({ s: s * k, parts: { paths: [{ path: LUNG.l, tag: 'l' }, { path: LUNG.r, tag: 'r' }], strokes: [{ a: [0, -185], b: [0, -60], w: 36, tag: 't' }, { a: [0, -60], b: [-55, -20], w: 26, tag: 't' }, { a: [0, -60], b: [55, -20], w: 26, tag: 't' }], bbox: [-155, -205, 155, 125] }, base: C.pink, dot: C.coral, cx: 0, cy: 0, R: 190 }))(c, x, y, s, o); };
const STOM = K.once('kStomach', () => K.smooth([[-70, -100], [10, -125], [90, -100], [130, -30], [115, 50], [60, 105], [-10, 120], [-70, 95], [-90, 40], [-70, -10], [-110, -50]]));
K.stomach = organ('stomach', () => ({ parts: { paths: [{ path: STOM, tag: 's' }], strokes: [{ a: [-100, -190], b: [-70, -105], w: 34, tag: 'e' }, { a: [-95, 55], b: [-40, 140], w: 30, tag: 'd' }], bbox: [-150, -210, 150, 150] }, base: C.cream2, dot: C.orange, cx: 0, cy: 0, R: 170,
  deco: g => { g.globalCompositeOperation = 'source-atop'; dotArc(g, K.curve([-60, -60], [20, -20], [70, 40], 10), 5, C.black, 18, 4); } }));

// ---------- 药丸 / 糖丸 ----------
// 胶囊：两半不同色，黑描边，波点。o: { rot, a 左半色, b 右半色, t, alpha }
K.pill = (c, x, y, s = 1, o = {}) => { const { rot = -0.5, a = C.yellow, b = C.red, t = 0, alpha = 1 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const p = K.round(-120, -48, 240, 96, 48); c.save(); c.clip(p); c.fillStyle = a; c.fillRect(-120, -48, 120, 96); c.fillStyle = b; c.fillRect(0, -48, 120, 96);
  K.dots(c, [-120, -48, 0, 48], { sp: 30, r: 6, col: C.black, seed: 3, t, ox: x, oy: y }); K.dots(c, [0, -48, 120, 48], { sp: 30, r: 6, col: C.cream, seed: 4, t, ox: x, oy: y }); c.restore();
  c.strokeStyle = C.black; c.lineWidth = 8; c.stroke(p); c.beginPath(); c.moveTo(0, -48); c.lineTo(0, 48); c.stroke(); K.dot(c, -78, -24, 9, C.white, 5, 1); c.restore(); };
// 糖丸（安慰剂）：奶油圆片＋黑描边＋一圈珊瑚点＋高光
K.sugar = (c, x, y, s = 1, o = {}) => { const { t = 0, alpha = 1 } = o, r = 62; c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  const p = K.blob(0, 0, r, 9, 0.025, 12); c.fillStyle = C.cream; c.fill(p); c.save(); c.clip(p);
  for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + 0.2; K.dot(c, Math.cos(an) * 40, Math.sin(an) * 40, 8 * (0.85 + 0.3 * Math.sin(t * 6 - i)), C.coral, i + 30); } K.dot(c, 0, 0, 12 * (1 + 0.15 * Math.sin(t * 6)), C.red, 2); c.restore();
  c.strokeStyle = C.black; c.lineWidth = 8; c.stroke(p); K.dot(c, -26, -30, 8, C.white, 5, 1); c.restore(); };

// ---------- 手 / 脚 ----------
// 手（手心朝向观众，五指张开 spread 0..1）。(x,y)=掌心。o: { rot, spread, hi:['f0'…'f4','palm'], glow:'f1'|[x,y]|true, t, flip }  tag：f0 拇指 f1 食指 … f4 小指 palm
K.hand = (c, x, y, s = 1, o = {}) => { const { rot = 0, spread = 0.7, t = 0, flip = 1 } = o, cr = Math.cos(rot), sr = Math.sin(rot), R = p => [p[0] * cr - p[1] * sr, p[0] * sr + p[1] * cr];
  const strokes = [{ a: R([0, 60]), b: R([0, 150]), w: 84, tag: 'palm' }, { a: R([-38, 0]), b: R([38, 0]), w: 112, tag: 'palm' }], tips = [];
  const F = [[-58, 16, -0.7 - 0.3 * spread, 100, 36], [-43, -38, -0.3 * spread, 124, 30], [-14, -46, -0.1 * spread, 138, 30], [15, -44, 0.1 * spread, 128, 30], [44, -34, 0.32 * spread, 100, 28]];
  F.forEach(([bx, by, an, L, w], i) => { const e = [bx + Math.sin(an) * L, by - Math.cos(an) * L]; strokes.push({ a: R([bx, by]), b: R(e), w, tag: 'f' + i }); tips.push(e); });
  const toS = p => { const r = R(p); return [x + r[0] * s * flip, y + r[1] * s]; }, hi = o.hi || [], gi = o.glow === true ? hi[0] : typeof o.glow === 'string' ? o.glow : null;
  const gp = Array.isArray(o.glow) ? o.glow : gi && gi[0] === 'f' ? toS(tips[+gi[1]]) : null;
  K.figure(c, x, y, s, { strokes, bbox: [-170, -200, 150, 190] }, { ...o, hi, hiA: o.hiA ?? 1, sp: o.sp ?? 30, rb: 6.5, grow: 7 / Math.max(s, 0.5), ox: gp ? gp[0] : x, oy: gp ? gp[1] : y, reach: gp ? o.reach || 0 : 0, t }); if (gp) K.glow(c, gp[0], gp[1], t, { s: o.gs ?? 0.5 * s + 0.2 }); return { tips: tips.map(toS) }; };
// 脚（俯视，右脚；flip=-1 左脚），(x,y)=脚掌中心。toe 0..4 点亮指定脚趾（0=大脚趾）并带光。o: { toe, rot, t, hi }
K.foot = (c, x, y, s = 1, o = {}) => { const { rot = 0, t = 0, flip = 1 } = o, cr = Math.cos(rot), sr = Math.sin(rot), R = p => [p[0] * cr - p[1] * sr, p[0] * sr + p[1] * cr];
  const toes = [[-42, -92, 26], [-4, -110, 18], [26, -100, 17], [50, -86, 15], [68, -66, 13]], strokes = [{ a: R([-4, 90]), b: R([0, -10]), w: 104, tag: 'sole' }, { a: R([0, -20]), b: R([8, -40]), w: 138, tag: 'sole' }];
  toes.forEach(([tx, ty, r], i) => strokes.push({ a: R([tx, ty]), b: R([tx, ty]), w: r * 2, tag: 't' + i }));
  const hi = o.hi || (o.toe != null ? ['t' + o.toe] : []), tp = o.toe != null ? R(toes[o.toe]) : null, gp = tp ? [x + tp[0] * s * flip, y + tp[1] * s] : Array.isArray(o.glow) ? o.glow : null;
  K.figure(c, x, y, s, { strokes, bbox: [-100, -140, 100, 150] }, { ...o, hi, hiA: o.hiA ?? 1, sp: o.sp ?? 30, rb: 6.5, grow: 7 / Math.max(s, 0.5), ox: gp ? gp[0] : x, oy: gp ? gp[1] : y, reach: gp ? o.reach || 0 : 0, t });
  if (gp) K.glow(c, gp[0], gp[1], t, { s: o.gs ?? 0.5 * s + 0.2 }); return { toes: toes.map(p => { const r = R(p); return [x + r[0] * s * flip, y + r[1] * s]; }) }; };

// ---------- 神经线路 ----------
// 一条神经：靛蓝小点串，红色信号脉冲沿线跑。k 给定则脉冲固定在 k（0..1），否则循环。o: { speed, n 脉冲数, r, col, sp }
K.nerve = (c, pts, t, o = {}) => { const { speed = 0.3, n = 2, r = 5, col = C.indigo, sp = 22, k = null, litCol = C.red } = o, pulse = [];
  if (k != null) pulse.push({ at: k, w: 90 }); else for (let i = 0; i < n; i++) pulse.push({ at: ((t * speed + i / n) % 1), w: 90 });
  return K.dotLine(c, pts, { sp, r, col, pulse, litCol, seed: o.seed || 3, prog: o.prog ?? 1 }); };
// 神经网络：nodes [[x,y]]，edges [[i,j]]。o: { lit:[节点下标] 黄色, speed, nodeR, edgeCol }
K.network = (c, nodes, edges, t, o = {}) => { const { lit = [], speed = 0.4, nodeR = 26, edgeCol = C.indigo, prog = 1 } = o;
  edges.forEach(([i, j], e) => { const ph = (t * speed + U.hash(e, 5)) % 1; K.dotLine(c, [nodes[i], nodes[j]], { sp: 20, r: 4.5, col: edgeCol, pulse: { at: ph, w: 70 }, seed: e + 1, prog: clamp(prog * 1.4 - U.hash(e, 6) * 0.4) }); });
  nodes.forEach(([x, y, r], i) => { const rr = (r || nodeR) * K.pop(prog * 2, U.hash(i, 8), 0.5) || 0, L = lit.includes(i), pu = 1 + 0.08 * Math.sin(t * 6 + i);
    K.dot(c, x, y, rr * 1.2 * pu, C.black, i + 50, 1); K.dot(c, x, y, rr * pu, L ? C.yellow : C.cream, i + 60, 1); K.dot(c, x, y, rr * 0.4, L ? C.red : C.indigo, i + 70, 1); }); };

// ---------- 气流呼吸线 ----------
// 从 (x,y) 出发沿 ang 方向（0=向上）的 n 条波浪点线，点沿线流动。dir=1 吸入（流向 x,y），-1 呼出。o: { len, n, spread, ang, col, speed }
K.breath = (c, x, y, t, o = {}) => { const { dir = 1, len = 320, n = 4, spread = 46, ang = 0, col = C.cream, speed = 0.35, r = 7 } = o, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) { const lat0 = (i - (n - 1) / 2) * spread;
    for (let k = 0; k < 14; k++) { const u = ((k / 14) + (dir > 0 ? -1 : 1) * t * speed + 10) % 1, lat = lat0 * (0.25 + 0.75 * u) + Math.sin(u * TAU * 1.5 + i * 1.3 + t * 2) * 16 * u, fwd = u * len;
      const px = x + lat * ca + fwd * sa, py = y + lat * sa - fwd * ca, rr = r * Math.sin(u * Math.PI) * (0.8 + 0.4 * U.hash(i * 20 + k, 3)); K.dot(c, px, py, rr, col, i * 20 + k); } } };

// ---------- 数据（图表用静版底，面板为奶油色）----------
// 面板：奶油底＋黑描边，可选极淡点。(x,y)=左上
K.panel = (c, x, y, w, h, o = {}) => { const p = K.round(x, y, w, h, o.r ?? 36), a = o.alpha ?? 1; c.save(); c.globalAlpha *= a; c.fillStyle = o.fill || C.cream; c.fill(p);
  if (o.dots !== false) { c.save(); c.clip(p); K.dots(c, [x, y, x + w, y + h], { sp: 64, r: 7, col: o.dotCol || '#f3dcc0', seed: 21, still: true }); c.restore(); }
  c.strokeStyle = C.black; c.lineWidth = 7; c.stroke(p); c.restore(); };
// 数据条：data [{v,label,hi?}]（label 与数值文字都用奶油面板上的黑字）。(x,y,w,h)=绘图区。o: { max, unit, hi 下标, dur, panel, fmt, note 如「示意」 }
K.bars = (c, x, y, w, h, data, lt, at, o = {}) => { const n = data.length, max = o.max ?? Math.max(...data.map(d => d.v)) * 1.1, bw = Math.min(150, w / n * 0.62), gap = w / n; if (o.panel !== false) K.panel(c, x - 50, y - 110, w + 100, h + 230, { alpha: K.at(lt, at, 0.3) });
  c.save(); c.strokeStyle = C.black; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 20, y + h); c.lineTo(x + w + 20, y + h); c.stroke(); c.restore();
  data.forEach((d, i) => { const q = MO.cubicOut(K.at(lt, at + 0.1 + i * 0.12, o.dur || 0.7)); if (q <= 0) return; const hi = d.hi || o.hi === i, bx = x + gap * (i + 0.5) - bw / 2, bh = Math.max(4, d.v / max * h * q), by = y + h - bh, p = K.round(bx, by, bw, bh + 30, 26);
    c.save(); c.beginPath(); c.rect(bx - 10, by - 10, bw + 20, bh + 10); c.clip(); c.fillStyle = hi ? C.yellow : C.cream2; c.fill(p);
    c.save(); c.clip(p); K.dots(c, [bx, by, bx + bw, by + bh], { sp: 34, r: 8, col: hi ? C.black : C.coral, seed: 30 + i, still: true }); c.restore(); c.strokeStyle = C.black; c.lineWidth = 7; c.stroke(p); c.restore();
    const lab = (o.fmt || (v => String(v)))(d.v) + (o.unit || ''); K.text(c, lab, bx + bw / 2, by - 40, { size: 54, fam: 'PuHui-Black', alpha: clamp(q * 2), maxW: gap * 0.95 });
    K.text(c, d.label || '', bx + bw / 2, y + h + 56, { size: 44, fam: 'PuHui-Heavy', alpha: clamp(q * 2), maxW: gap * 0.95 }); });
  if (o.note) K.text(c, o.note, x - 10, y - 78, { size: 40, fam: 'PuHui-Bold', col: C.sub, align: 'left', alpha: K.at(lt, at, 0.4) }); };
// 折线：series [{pts:[数], col, label, hi}]，pts 等距。o: { min, max, xlabels:[…], dur, panel, note, markers }
K.line = (c, x, y, w, h, series, lt, at, o = {}) => { const all = series.flatMap(s => s.pts), mn = o.min ?? Math.min(...all), mx = o.max ?? Math.max(...all), rg = (mx - mn) || 1; if (o.panel !== false) K.panel(c, x - 60, y - 110, w + 120, h + 230, { alpha: K.at(lt, at, 0.3) });
  const ax = K.at(lt, at, 0.4); K.dotLine(c, [[x, y - 10], [x, y + h], [x + w, y + h]], { sp: 20, r: 4.5, col: C.black, prog: ax, seed: 2 });
  const q = MO.cubicInOut(K.at(lt, at + 0.2, o.dur || 1.4));
  series.forEach((s, si) => { const n = s.pts.length, P2 = s.pts.map((v, i) => [x + w * i / (n - 1), y + h - (v - mn) / rg * h]), col = s.col || (si ? C.coral : C.black);
    const e = K.dotLine(c, P2, { sp: 18, r: 6, col, prog: q, seed: si + 4, t: o.t });
    if (o.markers !== false) P2.forEach((p, i) => { const vis = q * (n - 1) >= i - 0.01; if (!vis) return; const pp = K.pop(q * (n - 1) - i + 0.3, 0, 0.4); K.ring(c, p[0], p[1], 15 * pp, C.black, 5, i + si * 9, s.hi === i ? C.yellow : C.cream); });
    if (q > 0.98 && s.label) K.text(c, s.label, x + w, P2[n - 1][1] + (si ? 56 : -56), { size: 44, fam: 'PuHui-Heavy', align: 'right', col: C.black, alpha: K.at(lt, at + 1.6, 0.3) }); });
  (o.xlabels || []).forEach((s, i, a) => K.text(c, s, x + w * i / Math.max(1, a.length - 1), y + h + 56, { size: 42, fam: 'PuHui-Heavy', alpha: ax, maxW: w / a.length * 0.95 }));
  if (o.note) K.text(c, o.note, x - 10, y - 78, { size: 40, fam: 'PuHui-Bold', col: C.sub, align: 'left', alpha: ax }); };
// 对比两栏：L/R = { title, value, sub }，右栏是黄底黑点（被强调的一边）。(x,y,w,h)=整体
K.versus = (c, x, y, w, h, L, R, lt, at, o = {}) => { const gw = 36, pw = (w - gw) / 2;
  [[L, x, false, 0], [R, x + pw + gw, true, 0.2]].forEach(([d, px, hi, dl]) => { const p = K.pop(lt, at + dl, 0.5); if (p <= 0) return; c.save(); c.translate(px + pw / 2, y + h / 2); c.scale(p, p); c.translate(-pw / 2, -h / 2);
    const pa = K.round(0, 0, pw, h, 40); c.fillStyle = hi ? C.yellow : C.cream; c.fill(pa); c.save(); c.clip(pa); K.dots(c, [0, 0, pw, h], { sp: 52, r: 11, col: hi ? C.black : '#f3c9b6', seed: hi ? 41 : 40, t: o.t || 0, ox: pw / 2, oy: h / 2, still: !o.t, pace: 0.6, amp: 0.2 }); c.restore();
    c.strokeStyle = C.black; c.lineWidth = 8; c.stroke(pa);
    const ty = h * 0.2; c.save(); const tp = K.round(pw * 0.08, ty - 44, pw * 0.84, 88, 44); c.fillStyle = C.cream; c.fill(tp); c.lineWidth = 6; c.stroke(tp); c.restore();
    K.text(c, d.title || '', pw / 2, ty + 2, { size: 52, fam: 'PuHui-Black', maxW: pw * 0.78 });
    if (d.value != null) { c.save(); const vp = K.round(pw * 0.1, h * 0.46 - 80, pw * 0.8, 160, 60); c.fillStyle = C.cream; c.fill(vp); c.lineWidth = 6; c.stroke(vp); c.restore(); K.text(c, String(d.value), pw / 2, h * 0.46, { size: 118, fam: 'PuHui-Black', maxW: pw * 0.72 }); }
    if (d.sub) { c.save(); const sp2 = K.round(pw * 0.06, h * 0.76 - 48, pw * 0.88, 96, 40); c.fillStyle = C.cream; c.fill(sp2); c.lineWidth = 6; c.stroke(sp2); c.restore(); K.text(c, d.sub, pw / 2, h * 0.76 + 2, { size: 46, fam: 'PuHui-Heavy', maxW: pw * 0.8 }); }
    c.restore(); });
  const vp = K.pop(lt, at + 0.35, 0.4); if (vp > 0) { K.dot(c, x + w / 2, y + h / 2, 56 * vp, C.black, 3, 1); K.text(c, 'VS', x + w / 2, y + h / 2 + 2, { size: 46, fam: 'PuHui-Black', col: C.cream, scale: vp }); } };
// 时间线：items [{t 标签, s 小字}] 等距排在 x0..x1 的横线上，光点沿线走；标签上下交错。o: { dur, size }
K.timeline = (c, x0, y, x1, items, lt, at, o = {}) => { const n = items.length, dur = o.dur || n * 0.6, q = MO.cubicInOut(K.at(lt, at, dur)), X = i => lerp(x0 + 130, x1 - 130, n > 1 ? i / (n - 1) : 0.5), t = o.t ?? lt;
  K.dotLine(c, [[x0, y], [x1, y]], { sp: 22, r: 6, col: C.black, prog: K.at(lt, at, 0.5), seed: 3 });
  items.forEach((it, i) => { const reach = q * (n - 1) >= i - 0.02, p = reach ? K.pop(q * (n - 1) - i + 0.25, 0, 0.45) : 0; if (p <= 0) return; const up = i % 2 === 0, ty = y + (up ? -110 : 110), past = q * (n - 1) > i + 0.5;
    K.dot(c, X(i), y, 30 * p, C.black, i + 80, 1); K.dot(c, X(i), y, 23 * p, past ? C.yellow : C.cream, i + 90, 1);
    c.save(); c.strokeStyle = C.black; c.lineWidth = 5; c.beginPath(); c.moveTo(X(i), y + (up ? -30 : 30)); c.lineTo(X(i), ty + (up ? 40 : -40)); c.stroke(); c.restore();
    K.tag(c, it.t, X(i), ty, { size: o.size || 46, fam: 'PuHui-Heavy', fill: past ? C.yellow : C.cream, scale: p, dots: false });
    if (it.s) K.text(c, it.s, X(i), ty + (up ? -64 : 64), { size: 38, fam: 'PuHui-Bold', col: C.black, alpha: p, stroke: C.cream, sw: 8 }); });
  const gx = lerp(X(0), X(n - 1), q); if (q > 0 && q < 1) K.glow(c, gx, y, t, { s: 0.45 }); };
// 人群点阵（ISOTYPE 小人）：n 个，前 hi 个黄色。(x,y,w,h)=区域。o: { hi, dur, cols }
K.crowd = (c, x, y, w, h, n, lt, at, o = {}) => { const cols = o.cols || Math.max(1, Math.round(Math.sqrt(n * w / h))), rows = Math.ceil(n / cols), cw = w / cols, ch = h / rows, u = Math.min(cw * 0.95, ch * 0.9);
  for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), cc = i % cols, p = K.pop(lt, at + U.hash(i, 3) * (o.dur || 0.8), 0.4); if (p <= 0) continue; const hi = i < (o.hi || 0), cx = x + cw * (cc + 0.5), cy = y + ch * (r + 0.5);
    c.save(); c.translate(cx, cy); c.scale(p, p); c.lineWidth = Math.max(3, u * 0.07); c.strokeStyle = C.black; c.fillStyle = hi ? C.yellow : C.cream;
    c.beginPath(); c.arc(0, -u * 0.62, u * 0.2, 0, TAU); c.fill(); c.stroke(); const b = K.round(-u * 0.27, -u * 0.36, u * 0.54, u * 0.92, u * 0.2); c.fill(b); c.stroke(b);
    K.dot(c, 0, -u * 0.02, u * 0.1, hi ? C.black : C.coral, i, 1); c.restore(); } };
// 南瓜（草间标志物，装饰/章尾落点）：黄底黑点。o: { t, alpha }
K.pumpkin = (c, x, y, s = 1, o = {}) => { const { t = 0, alpha = 1 } = o, br = 1 + 0.025 * Math.sin(t * 5); c.save(); c.globalAlpha *= alpha; c.translate(x, y + 90 * s); c.scale(s * br, s * br); c.translate(0, -90);
  c.fillStyle = C.black; c.strokeStyle = C.black; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -112); c.quadraticCurveTo(6, -150, 28, -160); c.lineWidth = 22; c.stroke();
  [-2, 2, -1, 1, 0].forEach(i => { const cx = i * 56, rx = 66 - Math.abs(i) * 7, ry = 108 - Math.abs(i) * 9, p = K.ellipse(cx, 0, rx, ry); c.fillStyle = C.yellow; c.fill(p); c.lineWidth = 8; c.strokeStyle = C.black; c.stroke(p);
    c.save(); c.clip(p); for (let r = -3; r <= 3; r++) for (let q = -1; q <= 1; q++) { const px = cx + q * 34 + (r & 1) * 14, py = r * 30, d = Math.hypot(q, r * 0.55); K.dot(c, px, py, Math.max(2, 10 - d * 2.5) * (0.9 + 0.2 * Math.sin(t * 6 + px * 0.05)), C.black, r * 7 + q + i * 3, 1); } c.restore(); });
  c.restore(); };

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 红底，黄色大圆里砸入「第 N 章」，章名逐字出在奶油面板上；下方 N 站进度轨，注意力之光从上一站走到本站，站定时扩一圈涟漪。
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.chapterCard = (c, lt, t, n, title = '') => {
  const x0 = 130, x1 = 950, y = 1250, N = Math.max(K.CHAPTER_NAMES.length, n, 2), X = i => lerp(x0, x1, i / (N - 1)), walkEnd = 1.15;
  K.bg(c, t, { mode: 'red', seed: 900 + n, ox: 540, oy: 560, pace: 0.9 });
  if (lt > 0.1) K.ripple(c, 540, 560, t, { t0: 0, from: C.red, to: C.yellow, clip: [0, 150, W, 980] });
  const sc = K.pop(lt, 0.05, 0.5); if (sc > 0) { c.save(); c.translate(540, 560); c.scale(sc, sc); const p = K.blob(0, 0, 250, n * 7, 0.025, 14); c.fillStyle = C.yellow; c.fill(p); c.save(); c.clip(p); K.dots(c, [-250, -250, 250, 250], { sp: 60, r: 12, col: C.red, seed: 9 + n, t, ox: 540, oy: 560 }); c.restore(); c.strokeStyle = C.black; c.lineWidth = 9; c.stroke(p); c.restore(); }
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); K.text(c, `第 ${n} 章`, 540, 560, { size: 128, fam: 'PuHui-Black', col: C.black, scale: s, maxW: 440, stroke: C.cream, sw: 14 }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 7 ? 100 : 118, ph = lines.length > 1 ? 280 : 180;
  const pp = K.pop(lt, 0.35, 0.45); if (pp > 0) { c.save(); c.translate(540, 905 + (lines.length > 1 ? 50 : 0)); c.scale(pp, pp); K.panel(c, -480, -ph / 2, 960, ph, { r: ph / 2 > 90 ? 60 : 90 }); c.restore(); }
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K.text(c, a.slice(0, k).join(''), 540, (lines.length > 1 ? 905 + 50 - size * 0.65 + i * size * 1.25 : 905) + 2, { size, fam: 'PuHui-Black', maxW: 880 }); });
  // 进度轨
  const q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  K.dotLine(c, [[x0 - 30, y], [x1 + 30, y]], { sp: 24, r: 7, col: C.cream, seed: 4 });
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, p = cur ? K.pop(lt, walkEnd, 0.45) : 1; K.dot(c, X(i), y, (cur ? 24 * Math.max(0.6, p) : 15) * 1.25, C.black, i + 120, 1); K.dot(c, X(i), y, cur ? 24 * Math.max(0.6, p) : 15, past ? C.yellow : cur ? C.coral : C.cream, i + 130, 1); }
  const tx = lerp(from, done, q); if (lt < walkEnd + 0.2) K.glow(c, tx, y - 6, t, { s: 0.55 }); else K.glow(c, done, y - 6, t, { s: 0.55 + 0.1 * Math.sin((lt - walkEnd) * 6) * Math.exp(-(lt - walkEnd)) });
  K.finish(c); };

// ---------- 字幕（assemble 生成的 subs.js 调它）：墨黑底板＋奶油字，字幕带 y≈1480 ----------
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(27,21,18,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.strokeStyle = C.yellow; c.lineWidth = 3; c.stroke();
  c.fillStyle = C.cream; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
