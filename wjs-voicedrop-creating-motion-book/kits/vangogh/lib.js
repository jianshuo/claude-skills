// 画风套件 vangogh（配方 huashu-art-motion 09_postimp「后印象派·梵高」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 画法：钴蓝夜空 + 灯黄赭金 + 赤陶地板 + 深靛蓝描边；所有面都是「短笔触填充」（K.paint）：先平涂一层中间色打底，再沿流场（漩涡/竖/透视/肢体方向）铺短笔，
//       每笔带一圈深色边，最后用抖动的深靛蓝线收边。笔触层很重 → 一律离屏缓存（K.once / K.sprite / bg 缓存），每帧只贴位图 + 画便宜的活物（灯晕环、星闪、火苗、热气、指针）。
// 性能规矩：背景 K.bg 按参数缓存成整幅位图（最多留 5 幅，LRU）；道具与人物按「参数 + 沸腾帧号」缓存成小位图（总量按像素数 LRU）；
//          沸腾 = 2 个种子变体 6fps 轮换，只用在道具与人物上，背景默认静止（全屏沸腾会读成闪烁），o.boil=2 才开。所有随机都走种子，同一 t 画同一帧。
// 字：标题 PuHui-Black，标签 PuHui-Heavy，字幕 PuHui-Bold；字一律「奶黄字 + 深靛蓝描边」或「深靛蓝底牌上奶黄字」，最小 44px。
// 人：K.person 手写多边形 + 笔触 + 深蓝补线，三层（后层/头/前臂）分别缓存，头可活动；有 mood、hat、sit 等；返回锚点。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错、整段渲染失败。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  ink: '#1c2458', ink2: '#2a3580', ink3: '#10163e',                  // 深靛蓝：描边、字、暗部
  sky0: '#1b2a78', sky1: '#2f4fb8', sky2: '#5c86dc', sky3: '#8fb6ee', swirl: '#8fb3ec',   // 钴蓝夜空
  gold: '#f6d84a', lamp: '#fff2a0', halo: '#fbeea0', ochre: '#e3ad38', ochreD: '#b57d1c', ochreL: '#f8d860',   // 灯黄赭金
  terra: '#b5553b', terraD: '#8a3a2c', terraDD: '#6e2c2c', terraL: '#d7774a',                              // 赤陶地板
  green: '#2f8f58', greenL: '#6fd08a', cypress: '#1f4a2c', olive: '#7c8a46',
  red: '#d93a36', redD: '#7a1a22', cream: '#fbf1dd', paper: '#fff6d8',
  skin: '#f2c89a', skinD: '#d9a070', skinL: '#f8dcc6', hair: '#6a3a1c', cobalt: '#3a5fb4', cobaltD: '#2a4386',
};
const mixHex = K.mixHex = (a, b, k) => { const u = P.hex(a), v = P.hex(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
K.shade = (hex, k) => mixHex(hex, k > 0 ? '#10163e' : '#fff6d8', Math.abs(k));
// 由一个主色生成 n 档「暗→亮」色带（暗部偏靛蓝、亮部偏奶黄，梵高式冷暗暖亮）
const ramp = K.ramp = (hex, n = 5) => Array.from({ length: n }, (_, i) => { const q = i / (n - 1) * 2 - 1; return q < 0 ? mixHex(hex, C.ink, -q * 0.5) : mixHex(hex, C.cream, q * 0.38); });
const PAL = K.PAL = {                                                   // 笔触色板（都是暗→亮）
  sky: ['#1b2a78', '#22339a', '#2f4fb8', '#3c6bd0', '#5c86dc', '#8fb6ee'], skyDawn: ['#4a6ac8', '#8a78c8', '#e8806a', '#f6a850', '#f8d860', '#fff0a8'],
  skyDay: ['#2f6fd0', '#4a88e0', '#6aa8ee', '#8fc8f5', '#c6e4f6', '#f4f0c8'],
  wall: ['#4f6cc8', '#5f7fd8', '#6c6fd2', '#7f9be6', '#8ad0e6', '#a7bbf2'], wallDark: ['#1b2a78', '#22339a', '#2a3580', '#2f4fb8', '#3c5ab8'],
  floor: ['#6e2c2c', '#8e3b30', '#a8453a', '#c0573c', '#d7774a', '#e08a5c'], floorGreen: ['#5f8f6a', '#7c8a46'],
  wood: ['#b57d1c', '#d08a18', '#e0a020', '#e3ad38', '#f2c13a', '#f8d860'], woodDark: ['#6e4a14', '#8a5a14', '#b57d1c', '#d08a18'],
  gold: ['#d08a18', '#f0c040', '#f6d84a', '#ffe680', '#fff2a0'], halo: ['#f0c040', '#f6d84a', '#ffe680', '#fff2a0', '#fff7c8'],
  red: ['#7a1a22', '#a8321f', '#c63a2a', '#d93a36', '#f06b45'], green: ['#1f7a48', '#2f9a5c', '#4fc27a', '#8be09a'],
  cypress: ['#10301c', '#1f4a2c', '#2a6038', '#3c7a46'], night: ['#10163e', '#1a2160', '#1c2458', '#2a3580'],
  wheat: ['#b57d1c', '#d9a02a', '#e8bc3c', '#f2d25a', '#f8e486'], cream: ['#d8c8a0', '#efe2c0', '#fbf1dd', '#fffaf0'],
  skin: ['#c88a60', '#dca070', '#f2c89a', '#f8dcc6'], brick: ramp('#c8472f'), cobalt: ramp('#3a5fb4'), paper: ['#e0cfa0', '#f0e2b4', '#fff0c0', '#fff8dc'],
  glass: ['#8fb6ee', '#b8d4f4', '#dceaf8', '#f4f8ff'],
};

// ---------- 接口：时间、缓存、路径、相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
K.poly = (pts) => U.poly(pts, true);
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
K.last = (t, arr) => { let r = -1e9; for (const a of arr) if (a <= t) r = Math.max(r, a); return r; };
K.boilV = (t, n = 2, fps = 6) => n > 1 ? Math.floor(t * fps) % n : 0;     // 沸腾变体号

// ---------- 位图缓存（LRU，按像素数）----------
let CUR_V = 0;                                       // 当前正在画的变体号：只影响收边线的抖动（笔触种子不变，所以沸腾是「线在抖、色块不闪」）
const SPR = new Map(); let sprPx = 0; const SPR_MAX = 60e6;
const cvs = (w, h) => P.canvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
// K.sprite(key, [x0,y0,x1,y1], (g, v) => {...}, v=0)：在局部坐标 box 内画一次并缓存；g 已平移好，直接用局部坐标画。返回 {cv, ox, oy}
K.sprite = (key, box, draw, v = 0, pad = 8) => {
  const k = key + '|' + v, hit = SPR.get(k); if (hit) { SPR.delete(k); SPR.set(k, hit); return hit; }
  const [x0, y0, x1, y1] = box, cv = cvs(x1 - x0 + pad * 2, y1 - y0 + pad * 2), g = cv.getContext('2d');
  g.translate(pad - x0, pad - y0); CUR_V = v; try { draw(g, v); } finally { CUR_V = 0; }
  const e = { cv, ox: x0 - pad, oy: y0 - pad }; SPR.set(k, e); sprPx += cv.width * cv.height;
  for (const [kk, ee] of SPR) { if (sprPx <= SPR_MAX) break; SPR.delete(kk); sprPx -= ee.cv.width * ee.cv.height; }
  return e;
};
// K.blit(c, spr, x, y, o)：o = { s 缩放, sx 横向额外缩放, flip 水平镜像, rot 弧度, alpha, sy 竖向额外缩放（呼吸）, ax, ay 旋转/缩放支点（局部）}
K.blit = (c, e, x, y, o = {}) => { const { s = 1, flip = false, rot = 0, alpha = 1, sy = 1, sx = 1, ax = 0, ay = 0 } = o;
  c.save(); if (alpha !== 1) c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(s * sx * (flip ? -1 : 1), s * sy); c.translate(-ax, -ay);
  c.drawImage(e.cv, e.ox, e.oy); c.restore(); };

// ---------- 笔触填充 ----------
const TEST = P.canvas(2, 2).getContext('2d');
const hexPrep = pal => pal.map(h => { const rgb = P.hex(h); return { f: h, o: P.rgb(P.mix(rgb, P.hex(C.ink), 0.5), 1) }; });
// 把形状规范成 { path, box:[x0,y0,x1,y1], pts? }
const norm = (shape, o) => {
  if (typeof Path2D !== 'undefined' && shape instanceof Path2D) return { path: shape, box: o.box || [0, 0, W, H] };
  if (typeof shape === 'function') { const p = new Path2D(); shape(p); return { path: p, box: o.box || [0, 0, W, H] }; }
  if (shape && shape.path) return { path: shape.path, box: shape.box || o.box || [0, 0, W, H], pts: shape.pts };
  if (shape && shape.e) { const [cx, cy, rx, ry, rot = 0] = shape.e, ex = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot)), ey = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
    return { path: K.ellipse(cx, cy, rx, ry, rot), box: [cx - ex, cy - ey, cx + ex, cy + ey] }; }
  if (shape && shape.r) { const [x, y, w, h, r = 12] = shape.r; return { path: K.round(x, y, w, h, r), box: [x, y, x + w, y + h] }; }
  if (Array.isArray(shape) && shape.length === 4 && typeof shape[0] === 'number') { const [x, y, w, h] = shape; return { path: K.round(x, y, w, h, 0), box: [x, y, x + w, y + h], pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }; }
  const pts = shape.pts || shape; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { path: shape.smooth ? K.smooth(pts) : U.poly(pts, true), box: [x0, y0, x1, y1], pts: shape.smooth ? null : pts };
};
const angFn = (a, box) => typeof a === 'function' ? a : a === 'vert' ? () => -Math.PI / 2 : a === 'horiz' ? () => 0.03 : a === 'diag' ? () => -0.6
  : a === 'swirl' ? ((cx, cy) => (x, y) => Math.atan2(y - cy, x - cx) + Math.PI / 2)((box[0] + box[2]) / 2, (box[1] + box[3]) / 2) : () => (typeof a === 'number' ? a : 0);
// 手抖的深靛蓝边：多边形走 roughPath（每个种子不同），其它路径描两遍微偏
const edge = (g, n, o, seed) => {
  g.save(); g.strokeStyle = o.ec || C.ink; g.lineWidth = o.lw ?? 4.5; g.lineJoin = 'round'; g.lineCap = 'round';
  if (n.pts) { P.roughPath(g, n.pts, { amp: o.amp ?? 2.2, seed, closed: true, step: 14 }); g.stroke(); }
  else { g.stroke(n.path); g.globalAlpha = 0.5; g.translate(1.4 * Math.cos(seed), 1.4 * Math.sin(seed)); g.stroke(n.path); }
  g.restore();
};
// K.paint(c, shape, pal, opts)：用短笔触填满 shape。立即模式（会画几百～几千笔）→ 放进 K.once / K.sprite / bg 缓存里用，别每帧直接调。
//  shape：多边形点列 [[x,y],…]｜矩形 [x,y,w,h]｜{e:[cx,cy,rx,ry,rot]}｜{r:[x,y,w,h,radius]}｜{pts,smooth:true}｜Path2D 或 (p)=>{…}（这两种要传 o.box）
//  pal：色带数组（暗→亮，或 K.PAL.xxx 的名字）。
//  o：cell 网格(8) len 笔长(18) width 笔宽(5.5) angle 笔向（弧度｜(x,y)=>弧度｜'vert' 'horiz' 'diag' 'swirl'）seed(1)
//     tone (x,y)=>0..1 取色带位置｜shade [lx,ly,amt] 用光向做明暗（默认无）｜spread 随机取色幅度(0.3)｜base 先平涂中间色(true)
//     outline 每笔深色边(true) ow 边加宽(2.5) edge 收边线(true) lw 收边线宽(4.5) ec 收边色 amp 收边抖动(2.2) alpha 总透明度｜clip(true)
K.paint = (c, shape, pal, o = {}) => {
  if (typeof pal === 'string') pal = PAL[pal] || ramp(pal);
  const n = norm(shape, o), [x0, y0, x1, y1] = n.box, cell = o.cell ?? 8, len = o.len ?? 18, wd = o.width ?? 5.5, seed = o.seed ?? 1, sp = o.spread ?? 0.3;
  const ps = hexPrep(pal), N = ps.length, r = U.rng(seed * 7919 + 13), ang = angFn(o.angle ?? 0, n.box);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2);
  let tone = o.tone; if (!tone && o.shade) { const [lx, ly, am] = o.shade, L = Math.hypot(lx, ly) || 1; tone = (x, y) => 0.55 + am * (((x - cx) / hw) * lx / L + ((y - cy) / hh) * ly / L); }
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (o.base !== false) { c.fillStyle = ps[Math.min(N - 1, Math.floor(N * (tone ? 0.5 : 0.45)))].f; c.fill(n.path); }
  if (o.clip !== false) c.clip(n.path);
  c.lineCap = 'round';
  for (let y = y0 - cell; y < y1 + cell; y += cell) for (let x = x0 - cell; x < x1 + cell; x += cell) {
    const px = x + (r() - 0.5) * cell * 1.1, py = y + (r() - 0.5) * cell * 1.1;
    if (px < x0 - 2 || px > x1 + 2 || py < y0 - 2 || py > y1 + 2) { r(); r(); r(); continue; }
    TEST.setTransform(1, 0, 0, 1, 0, 0); if (!TEST.isPointInPath(n.path, px, py)) { r(); r(); r(); continue; }
    const tn = tone ? clamp(tone(px, py)) : r(), q = tone ? tn + (r() - 0.5) * 2 * sp : tn; r();
    const col = ps[clamp(Math.round(q * (N - 1)), 0, N - 1)], a = ang(px, py), l = len * (0.7 + r() * 0.6), dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2;
    if (o.outline !== false) { c.strokeStyle = col.o; c.lineWidth = wd + (o.ow ?? 2.5); c.beginPath(); c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy); c.stroke(); }
    c.strokeStyle = col.f; c.lineWidth = wd; c.beginPath(); c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy); c.stroke();
  }
  c.restore();
  if (o.edge !== false) edge(c, n, o, seed * 31 + 7 + CUR_V * 17);
  return n;
};
// 一笔一笔的粗线（给箭头、折线、藤蔓用）：沿 pts 铺短笔触
K.stroke = (c, pts, pal, o = {}) => { if (typeof pal === 'string') pal = PAL[pal] || ramp(pal); const ps = hexPrep(pal), r = U.rng((o.seed ?? 3) * 977), w = o.width ?? 10, step = o.step ?? w * 0.8;
  c.save(); c.lineCap = 'round'; let acc = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let d = acc; d < L; d += step) { const q = d / L, px = lerp(a[0], b[0], q) + (r() - 0.5) * w * 0.4, py = lerp(a[1], b[1], q) + (r() - 0.5) * w * 0.4, col = ps[Math.floor(r() * ps.length)], l = w * (1.1 + r() * 0.7), dx = Math.cos(th) * l / 2, dy = Math.sin(th) * l / 2;
      if (o.outline !== false) { c.strokeStyle = col.o; c.lineWidth = w + 3; c.beginPath(); c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy); c.stroke(); }
      c.strokeStyle = col.f; c.lineWidth = w; c.beginPath(); c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy); c.stroke(); }
    acc = ((acc + Math.ceil((L - acc) / step) * step) - L); }
  c.restore(); };
// 抖动的深靛蓝线（立即模式，便宜）：pts 折线，closed 闭合
K.rough = (c, pts, o = {}) => { c.save(); c.strokeStyle = o.col || C.ink; c.lineWidth = o.lw ?? 4.5; c.lineJoin = 'round'; c.lineCap = 'round';
  P.roughPath(c, pts, { amp: o.amp ?? 2.2, seed: o.seed ?? 5, closed: !!o.closed, step: o.step ?? 14 }); c.stroke(); c.restore(); };
// 加色发光（灯晕、烛光、筹码上的一点光）
K.glow = (c, x, y, r, a = 0.5, col = '255,230,140') => { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, r * 0.05, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); };
// 灯晕环：一圈圈向外脉动的虚线圆
K.haloRings = (c, x, y, t, o = {}) => { const { n = 3, r0 = 50, r1 = 230, speed = 0.5, a = 0.3, lw = 20, col = '255,236,140' } = o;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let k = 0; k < n; k++) { const ph = ((t * speed + k / n) % 1), r = r0 + ph * (r1 - r0); c.strokeStyle = `rgba(${col},${a * (1 - ph) * (o.k ?? 1)})`; c.lineWidth = lw; c.setLineDash([lw * 1.3, lw * 0.8]); c.lineDashOffset = -t * 60; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  c.setLineDash([]); c.restore(); };
// 星：闪烁的小太阳（加色光晕 + 星核 + 十字芒）
K.star = (c, x, y, r, t, k = 0, col = C.gold) => { const tw = 0.75 + 0.35 * Math.sin(t * 5 + k * 1.7); K.glow(c, x, y, r * 3.2 * tw, 0.5, '251,238,160');
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 0.75 * tw, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,246,200,.85)'; c.lineWidth = Math.max(2, r * 0.18); c.lineCap = 'round'; const l = r * 1.9 * tw; c.beginPath(); c.moveTo(x - l, y); c.lineTo(x + l, y); c.moveTo(x, y - l); c.lineTo(x, y + l); c.stroke(); };

// ---------- 背景：整幅位图缓存（K.bg）----------
// 预设：night 夜空漩涡+远村+柏树+赤陶地板（主镜头）｜room 暖色室内墙地（可开一扇窗）｜window 深夜窗景（大窗+暗墙）｜field 白天天空+黄麦田｜plain 单色笔触墙（图示底）
// K.bg(c, t, o)：o = { preset, horizon 地平线 y(900), floor 有无地板(true), lamp [x,y]|false 灯晕（默认 [640,350]）, moon, stars, village, cypress ('left'|'right'|false), swirls 漩涡数,
//   chaos 0..1（漩涡变多变乱）, dawn 0..1（黄光铺满）, dim 0..1（压暗/熄灯）, tint ['#hex', 0..1]（整体偏色）, pal {sky, floor, wall, halo}（色带覆盖，暗→亮的 hex 数组）,
//   window [x,y,w,h]（room/window 的窗）, vignette false（不烤暗角）, seed, boil 0|2（沸腾变体数，默认 0 静止）, live false（不画星闪和灯晕环） }
const BG_LRU = []; const BG_MAX = 5;
const BGD = {
  night: { hor: 900, floor: true, lamp: [640, 350], moon: true, village: true, cypress: 'right' },
  room: { hor: 900, floor: true, lamp: [640, 330], window: [110, 250, 380, 520], moon: true, village: true, cypress: 'left' },
  window: { hor: 1010, floor: true, lamp: false, window: [90, 230, 900, 740], moon: true, village: true, cypress: 'right', wallPal: 'wallDark' },
  field: { hor: 880, floor: false, lamp: false, moon: false, village: false, cypress: 'right', day: true },
  plain: { hor: 1000, floor: false, lamp: false, moon: false, village: false, cypress: false },
};
const SWL = [[.23, .37, .14], [.72, .52, .16], [.52, .14, .09], [.86, .84, .08], [.1, .78, .085], [.42, .71, .065]];   // 漩涡：归一化 (u,v,半径/宽)
const bgCfg = (o0) => {
  const d = BGD[o0.preset || 'night'] || BGD.night, o = { ...d, ...o0 }; o.preset = o0.preset || 'night';
  o.seed = o.seed ?? 1; o.dawn = o.dawn ?? 0; o.dim = o.dim ?? 0; o.chaos = o.chaos ?? 0;
  const hor = o.hor = o.horizon ?? d.hor;
  o.box = o.preset === 'night' || o.preset === 'field' ? [0, 0, W, hor] : o.window ? [o.window[0], o.window[1], o.window[0] + o.window[2], o.window[1] + o.window[3]] : null;
  return o;
};
const bgLayout = (o) => {                                               // 星、漩涡、月、灯：位置只由参数决定，缓存与实时共用
  const r = U.rng(o.seed * 101 + 3), box = o.box, L = { swirls: [], stars: [], lamp: o.lamp || null, moon: null, sun: null, box };
  if (!box) return L;
  const bw = box[2] - box[0], bh = box[3] - box[1], big = bw * bh > 0.3 * W * H, nS = o.swirls ?? (big ? 6 : 3) + Math.round(o.chaos * 7);
  for (let i = 0; i < nS; i++) { const s = i < SWL.length ? SWL[i] : [r(), r() * 0.9 + 0.05, 0.04 + r() * 0.05];
    const jit = i < SWL.length ? o.chaos * 0.06 : 0;
    L.swirls.push([box[0] + (s[0] + (r() - 0.5) * jit) * bw, box[1] + (s[1] + (r() - 0.5) * jit) * bh, s[2] * bw * (i < SWL.length ? 1 : 0.8)]); }
  if (o.moon && !o.day) L.moon = o.moonAt || [box[0] + bw * (big ? 0.83 : 0.72), box[1] + bh * (big ? 0.26 : 0.2), big ? 56 : 30];
  if (o.day || o.dawn > 0.25) L.sun = o.sunAt || (o.dawn > 0.25 ? [box[0] + bw * 0.46, box[3] - 40 - 60 * (1 - o.dawn), 70 + 70 * o.dawn] : [box[0] + bw * 0.8, box[1] + bh * 0.2, 90]);
  const nStar = big ? 9 : 5, avoidD = (x, y, a, rr) => a && Math.hypot(x - a[0], y - a[1]) < rr;
  for (let i = 0, g = 0; i < nStar && g < 200; g++) { const x = box[0] + 40 + r() * (bw - 80), y = box[1] + 40 + r() * (bh * 0.8 - 40), rad = 9 + r() * 12;
    if (avoidD(x, y, L.lamp && [L.lamp[0], L.lamp[1] + 20], 170) || avoidD(x, y, L.moon, 120) || avoidD(x, y, L.sun, 170) || (o.cypress === 'right' && x > box[2] - 150 && y > box[1] + bh * 0.3) || (o.cypress === 'left' && x < box[0] + 150 && y > box[1] + bh * 0.3)) continue;
    L.stars.push([x, y, rad]); i++; }
  return L;
};
const tPal = (pal, o) => { if (typeof pal === 'string') pal = PAL[pal]; let p = pal; if (o.tint) p = p.map(h => mixHex(h, o.tint[0], o.tint[1] * 0.6)); return p; };
const swatch = (pal, mix) => P.swatch(pal, mix);
const lum = col => col[0] + col[1] + col[2];

// 天空场景：box 内画漩涡星空（底稿 → 流场笔触 → 远村/柏树）
function skyScene(g, o, L, v) {
  const [x0, y0, x1, y1] = L.box, bw = x1 - x0, bh = y1 - y0, k = bw / 1080, hor = y1, dawn = o.dawn, day = !!o.day;
  const B = cvs(W, H), b = B.getContext('2d'); b.save(); b.beginPath(); b.rect(x0, y0, bw, bh); b.clip();
  const top = day ? '#2f6fd0' : mixHex('#1d2c7c', '#3a5bc0', dawn), bot = day ? '#bcdcf4' : mixHex('#3350b0', '#f0b050', dawn);
  const gr = b.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(day ? 0.85 : 0.6 + 0.2 * dawn, bot); gr.addColorStop(1, bot); b.fillStyle = gr; b.fillRect(x0, y0, bw, bh);
  b.lineCap = 'round';
  L.swirls.forEach(([x, y, r], i) => { for (let ring = 0; ring < 4; ring++) { b.strokeStyle = day ? (ring % 2 ? '#f4f0d8' : '#9cc8f0') : ring % 2 ? C.swirl : '#5a82d6'; b.lineWidth = (22 - ring * 4) * Math.max(0.55, k * 1.2); b.beginPath();
    for (let a = 0; a < Math.PI * 3.4; a += 0.15) { const rr = r * (0.2 + a / (Math.PI * 3.4)) * (1 - ring * 0.1), aa = a + i * 1.3 + ring * 0.2; const px = x + Math.cos(aa) * rr * (i % 2 ? -1 : 1), py = y + Math.sin(aa) * rr * 0.8; a ? b.lineTo(px, py) : b.moveTo(px, py); } b.stroke(); } });
  if (L.sun) { const [sx, sy, sr] = L.sun; const hg = b.createRadialGradient(sx, sy, 6, sx, sy, sr * 1.7); hg.addColorStop(0, '#fffbe0'); hg.addColorStop(0.45, '#f6d84a'); hg.addColorStop(1, 'rgba(240,176,80,0)'); b.fillStyle = hg; b.beginPath(); b.arc(sx, sy, sr * 1.7, 0, TAU); b.fill(); }
  if (L.lamp) { const [lx, ly] = L.lamp, lr = 120, ly2 = ly + 20, hg = b.createRadialGradient(lx, ly2, 8, lx, ly2, lr); hg.addColorStop(0, '#fff7c8'); hg.addColorStop(0.5, '#f4d65a'); hg.addColorStop(1, 'rgba(120,150,220,0)'); b.fillStyle = hg; b.beginPath(); b.arc(lx, ly2, lr, 0, TAU); b.fill(); }
  b.restore();
  g.drawImage(B, 0, 0);
  const skyP = o.pal?.sky || (day ? PAL.skyDay : PAL.sky), dawnP = PAL.skyDawn;
  const A = swatch(tPal(skyP, o), day ? 0.4 : 0.45), Bd = swatch(tPal(dawnP, o), 0.35), HL = swatch(tPal(o.pal?.halo || PAL.halo, o), 0.3);
  const lampD = (x, y) => L.lamp ? Math.hypot(x - L.lamp[0], y - L.lamp[1] - 20) : 1e9, sunD = (x, y) => L.sun ? Math.hypot(x - L.sun[0], y - L.sun[1]) : 1e9;
  const chaos = o.chaos;
  const angle = (x, y) => {
    if (lampD(x, y) < 170) return Math.atan2(y - L.lamp[1] - 20, x - L.lamp[0]) + Math.PI / 2;
    if (sunD(x, y) < L.sun?.[2] * 1.8) return Math.atan2(y - L.sun[1], x - L.sun[0]) + Math.PI / 2;
    let best = null, bd = 1e9; L.swirls.forEach(s => { const d = Math.hypot(x - s[0], y - s[1]) / s[2]; if (d < bd) { bd = d; best = s; } });
    if (bd < 1.8) return Math.atan2(y - best[1], x - best[0]) + Math.PI / 2 + chaos * 1.2 * P.noise(x * 0.01, y * 0.01);
    return 0.15 * Math.sin(x * 0.02 + y * 0.004) + chaos * 1.4 * P.noise(x * 0.006 + 3, y * 0.006);
  };
  const palette = (x, y, col, r) => {
    if (lampD(x, y) < 105 || sunD(x, y) < (L.sun ? L.sun[2] * 1.1 : 0)) return HL(col, r);
    const bright = lum(col) > 560; if (bright && !day) return L.moon && Math.hypot(x - L.moon[0], y - L.moon[1]) < L.moon[2] * 1.3 ? HL(col, r) : null;
    const dk = dawn * clamp((y - y0) / bh * 1.3); const pick = A(col, r); return dk > 0.02 ? P.mix(pick, Bd(col, r), dk) : pick;
  };
  const cell = Math.round(11 * Math.max(0.7, Math.min(1, k * 1.6))), seed = 9 + v * 50 + o.seed;
  P.strokes(g, B, { cell, len: 26 * Math.max(0.7, Math.min(1, k * 1.6)), width: 7.5 * Math.max(0.65, Math.min(1, k * 1.5)), angle, seed, t: 0, boil: 0, outline: 0.9, outlineMix: 0.45, palette, mask: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 });
  g.save(); g.beginPath(); g.rect(x0, y0, bw, bh); g.clip();
  if (L.moon && dawn < 0.6) { const [mx, my, mr] = L.moon, rr = mr * 1.25; g.save(); g.globalAlpha = 1 - clamp(dawn * 1.6);
    for (const [k2, col] of [[1.45, ['#5a82d6', '#8fb3ec']], [1.9, ['#4a6ec8', '#6a8ee0']]]) { const pts = []; for (let a = 0; a < TAU * 0.92; a += 0.25) pts.push([mx + Math.cos(a + k2) * rr * k2, my + Math.sin(a + k2) * rr * k2]); K.stroke(g, pts, col, { width: 7 * Math.max(0.7, k * 1.3), seed: 61, outline: false }); }
    const T = cvs(rr * 2 + 40, rr * 2 + 40), tg = T.getContext('2d'), T2 = cvs(rr * 2 + 40, rr * 2 + 40), t2 = T2.getContext('2d'), cx0 = rr + 20, io = [-0.5 * rr, -0.34 * rr, rr * 0.9];
    t2.fillStyle = C.ink; t2.beginPath(); t2.arc(cx0, cx0, rr + 4, 0, TAU); t2.fill(); t2.globalCompositeOperation = 'destination-out'; t2.beginPath(); t2.arc(cx0 + io[0], cx0 + io[1], io[2] - 4, 0, TAU); t2.fill();
    K.paint(tg, { e: [cx0, cx0, rr, rr] }, PAL.gold, { cell: 5, len: 13, width: 4.4, angle: 'swirl', seed: 62, edge: false, outline: false }); tg.globalCompositeOperation = 'destination-out'; tg.beginPath(); tg.arc(cx0 + io[0], cx0 + io[1], io[2], 0, TAU); tg.fill();
    g.drawImage(T2, mx - cx0, my - cx0); g.drawImage(T, mx - cx0, my - cx0); g.restore(); }
  const sc = Math.max(0.6, k), vil = o.village !== false && !day;
  if (vil) {                                                              // 远村：深靛蓝剪影 + 亮窗
    const h0 = hor, base = [[x0, h0 - 50 * sc], [x0 + 0.07 * bw, h0 - 70 * sc], [x0 + 0.14 * bw, h0 - 55 * sc], [x0 + 0.21 * bw, h0 - 85 * sc], [x0 + 0.28 * bw, h0 - 100 * sc], [x0 + 0.305 * bw, h0 - 130 * sc], [x0 + 0.333 * bw, h0 - 100 * sc], [x0 + 0.42 * bw, h0 - 65 * sc], [x0 + 0.52 * bw, h0 - 80 * sc], [x0 + 0.63 * bw, h0 - 60 * sc], [x0 + 0.74 * bw, h0 - 75 * sc], [x0 + 0.83 * bw, h0 - 55 * sc], [x1, h0 - 70 * sc], [x1, h0 + 4], [x0, h0 + 4]];
    K.paint(g, base, o.pal?.village || PAL.night, { cell: 7, len: 16, width: 5, angle: 'horiz', seed: 5 + v, edge: false, base: true });
    g.fillStyle = '#f2c94c'; [.11, .2, .31, .44, .55, .7, .83].forEach((u, i) => { if (U.hash(i, o.seed) > 0.8) return; const wx = x0 + u * bw, wy = h0 - (22 + U.hash(i, 7) * 22) * sc; g.fillRect(wx, wy, 10 * sc, 12 * sc); });
  }
  if (o.hills !== false && day) {                                          // 远丘（白天）
    K.paint(g, [[x0, hor - 120], [x0 + 0.2 * bw, hor - 190], [x0 + 0.45 * bw, hor - 140], [x0 + 0.7 * bw, hor - 210], [x1, hor - 150], [x1, hor + 6], [x0, hor + 6]], ['#2a6a7a', '#3c8a8a', '#5aa0a0', '#7cb8b0'], { cell: 8, len: 22, width: 6, angle: 'horiz', seed: 11, edge: true, smooth: false });
  }
  if (o.cypress) {                                                         // 柏树：火焰形
    const right = o.cypress !== 'left', cxp = right ? x1 - 0.1 * bw : x0 + 0.1 * bw, sg = right ? 1 : -1, topY = y0 + bh * 0.4, bw2 = 54 * Math.max(0.55, k * 1.15);
    const pts = [[cxp - bw2 * 0.7, hor + 6], [cxp - bw2 * 1.15, hor - bh * 0.18], [cxp - bw2 * 0.5, hor - bh * 0.34], [cxp - bw2 * 0.9 * sg * 0, topY + bh * 0.2], [cxp + 6 * sg, topY], [cxp + bw2 * 0.55, topY + bh * 0.2], [cxp + bw2 * 1.1, hor - bh * 0.3], [cxp + bw2 * 0.9, hor - bh * 0.12], [cxp + bw2 * 0.8, hor + 6]];
    K.paint(g, { pts, smooth: true }, o.pal?.cypress || PAL.cypress, { cell: 7, len: 20, width: 5.5, angle: (x, y) => -Math.PI / 2 + 0.5 * Math.sin(y * 0.03 + x * 0.02), seed: 21 + v, lw: 5 });
  }
  g.restore();
}
function floorScene(g, o, L, v) {
  const hor = o.hor, B = cvs(W, H), b = B.getContext('2d'), VP = [L.lamp ? L.lamp[0] : W * 0.55, hor - 140];
  const fp = tPal(o.pal?.floor || PAL.floor, o);
  b.fillStyle = fp[2]; b.fillRect(0, hor, W, H - hor); b.strokeStyle = fp[0]; b.lineWidth = 8;
  for (let i = -10; i <= 10; i++) { b.beginPath(); b.moveTo(VP[0] + i * 70, hor); b.lineTo(VP[0] + i * 300, H); b.stroke(); }
  const SW = swatch(fp.concat(['#5f8f6a']), 0.3);
  P.strokes(g, B, { cell: 14, len: 52, width: 9, angle: (x, y) => Math.atan2(y - VP[1], x - VP[0]) + 0.06 * Math.sin(x * 0.01 + y * 0.004), seed: 29 + v * 50 + o.seed, t: 0, boil: 0, outline: 0.85, outlineMix: 0.45, palette: (x, y, col, r) => SW(col, r), mask: (x, y) => y > hor + 2 });
  g.save(); g.strokeStyle = C.ink; g.lineWidth = 3.5; const sd = 17 + v * 3;
  for (let i = -8; i <= 8; i += 2) { P.roughPath(g, [[VP[0] + i * 70 * 1.2, hor + 6], [VP[0] + i * 300, H]], { amp: 2.4, seed: sd + i * 5, closed: false, step: 14 }); g.stroke(); }
  g.restore();
}
function wallScene(g, o, L, v) {                                         // 室内墙：竖向笔触（微摇曳）
  const hor = o.hor, B = cvs(W, H), b = B.getContext('2d'), wp = tPal(o.pal?.wall || PAL[o.wallPal || 'wall'], o);
  const gr = b.createLinearGradient(0, 0, 0, hor); gr.addColorStop(0, wp[1]); gr.addColorStop(1, wp[0]); b.fillStyle = gr; b.fillRect(0, 0, W, hor);
  if (L.lamp) { const [lx, ly] = L.lamp, hg = b.createRadialGradient(lx, ly + 20, 8, lx, ly + 20, 130); hg.addColorStop(0, '#fff7c8'); hg.addColorStop(0.5, '#f4d65a'); hg.addColorStop(1, 'rgba(120,150,220,0)'); b.fillStyle = hg; b.beginPath(); b.arc(lx, ly + 20, 130, 0, TAU); b.fill(); }
  const SW = swatch(wp, 0.3), HL = swatch(tPal(o.pal?.halo || PAL.halo, o), 0.3), lampD = (x, y) => L.lamp ? Math.hypot(x - L.lamp[0], y - L.lamp[1] - 20) : 1e9;
  const win = o.window, inWin = (x, y, m = 0) => win && x > win[0] - m && x < win[0] + win[2] + m && y > win[1] - m && y < win[1] + win[3] + m;
  P.strokes(g, B, { cell: 13, len: 60, width: 8, angle: (x, y) => lampD(x, y) < 150 ? Math.atan2(y - L.lamp[1] - 20, x - L.lamp[0]) + Math.PI / 2 : -Math.PI / 2 + 0.26 * P.noise(x * 0.008, y * 0.008 + 3 + v * 7), seed: 19 + v * 50 + o.seed, t: 0, boil: 0, outline: 0.8, outlineMix: 0.38,
    palette: (x, y, col, r) => lampD(x, y) < 100 ? HL(col, r) : SW(col, r), mask: (x, y) => y < hor && !inWin(x, y, 34) });
}
function windowFrame(g, o, v) {
  const [wx, wy, ww, wh] = o.window, fw = 26;
  const fg = tPal(PAL.green, o);
  K.paint(g, [wx - fw, wy - fw, ww + fw * 2, fw], fg, { cell: 6, len: 16, width: 5, angle: 'horiz', seed: 31 + v, lw: 4 });
  K.paint(g, [wx - fw, wy + wh, ww + fw * 2, fw], fg, { cell: 6, len: 16, width: 5, angle: 'horiz', seed: 32 + v, lw: 4 });
  K.paint(g, [wx - fw, wy, fw, wh], fg, { cell: 6, len: 16, width: 5, angle: 'vert', seed: 33 + v, lw: 4 });
  K.paint(g, [wx + ww, wy, fw, wh], fg, { cell: 6, len: 16, width: 5, angle: 'vert', seed: 34 + v, lw: 4 });
  K.paint(g, [wx + ww / 2 - 10, wy, 20, wh], fg, { cell: 6, len: 16, width: 5, angle: 'vert', seed: 35 + v, lw: 4 });
  K.paint(g, [wx - fw - 20, wy + wh + fw - 4, ww + fw * 2 + 40, 26], tPal(PAL.wood, o), { cell: 6, len: 18, width: 5, angle: 'horiz', seed: 36 + v, lw: 4 });
}
function buildBg(o, L, v) {
  const cv = cvs(W, H), g = cv.getContext('2d'), hor = o.hor;
  if (o.preset === 'night' || o.preset === 'field') skyScene(g, o, L, v);
  else if (o.preset === 'plain') {
    const hue = o.hue || C.sky1, B = cvs(W, H), b = B.getContext('2d'), p = o.pal?.wall || ramp(hue, 6); b.fillStyle = p[2]; b.fillRect(0, 0, W, H);
    const SW = swatch(p, 0.25); P.strokes(g, B, { cell: 13, len: 58, width: 8, angle: (x, y) => -Math.PI / 2 + 0.3 * P.noise(x * 0.008, y * 0.008 + 3 + v * 7), seed: 19 + v * 50 + o.seed, t: 0, boil: 0, outline: 0.8, outlineMix: 0.38, palette: (x, y, col, r) => SW(col, r) });
  } else {
    wallScene(g, o, L, v);
    if (o.window) { skyScene(g, { ...o, village: o.village, cypress: o.cypress }, { ...L, lamp: null }, v); windowFrame(g, o, v); }
  }
  if (o.preset === 'field') {                                              // 黄麦田：长笔触，起伏，一条赤陶小路
    const fy = hor - 4, wp = tPal(o.pal?.ground || PAL.wheat, o), B = cvs(W, H), b = B.getContext('2d'); b.fillStyle = wp[2]; b.fillRect(0, fy, W, H - fy);
    const SW = swatch(wp.concat(['#6fa04a', '#c0573c']), 0.35);
    P.strokes(g, B, { cell: 12, len: 44, width: 8.5, angle: (x, y) => -1.05 + 0.7 * P.noise(x * 0.006, y * 0.006 + v * 5) + 0.35 * Math.sin(y * 0.012), seed: 41 + v * 50 + o.seed, t: 0, boil: 0, outline: 0.85, outlineMix: 0.4, palette: (x, y, col, r) => SW(col, r), mask: (x, y) => y > fy });
    K.paint(g, { pts: [[W * 0.35, fy + 4], [W * 0.62, fy + 4], [W * 0.95, H], [W * 0.1, H]], smooth: false }, PAL.floor, { cell: 12, len: 40, width: 8, angle: (x, y) => Math.atan2(y - fy, x - W * 0.48) + Math.PI / 2 * 0 + 0.0, seed: 45, edge: false });
  }
  if (!o.floor && (o.preset === 'night' || o.preset === 'window') && hor < H - 4) K.paint(g, [0, hor - 2, W, H - hor + 2], o.pal?.ground || ['#0e1440', '#1a2160', '#1f4a2c', '#2a3580', '#16306a'], { cell: 11, len: 44, width: 8.5, angle: (x, y) => 0.1 * Math.sin(x * 0.01 + y * 0.02) + 0.05, seed: 53 + v, edge: false });
  if (o.floor && o.preset !== 'field' && o.preset !== 'plain') {
    floorScene(g, o, L, v);
    g.save(); g.strokeStyle = '#3a2a6a'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, hor); g.lineTo(W, hor); g.stroke(); g.restore();
    P.roughPath(g, [[0, hor], [W, hor]], { amp: 2.4, seed: 7 + v, closed: false, step: 14 }); g.strokeStyle = C.ink; g.lineWidth = 5; g.stroke();
  }
  if (o.dim > 0) { g.fillStyle = `rgba(14,20,66,${o.dim * 0.6})`; g.fillRect(0, 0, W, H); }
  if (o.tint) { g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = o.tint[1]; g.fillStyle = o.tint[0]; g.fillRect(0, 0, W, H); g.restore(); }
  if (o.vignette !== false) { const gr = g.createRadialGradient(W / 2, H * 0.42, 620, W / 2, H * 0.42, 1350); gr.addColorStop(0, 'rgba(12,16,56,0)'); gr.addColorStop(1, 'rgba(12,16,56,.32)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  return cv;
}
K.bg = (c, t, o = {}) => {
  const cfg = bgCfg(o), key = JSON.stringify(cfg), nb = cfg.boil || 1;
  let e = BG_LRU.find(x => x.key === key);
  if (e) { BG_LRU.splice(BG_LRU.indexOf(e), 1); BG_LRU.push(e); } else { e = { key, L: bgLayout(cfg), imgs: [] }; BG_LRU.push(e); if (BG_LRU.length > BG_MAX) BG_LRU.shift(); }
  const v = K.boilV(t, nb, 6); if (!e.imgs[v]) e.imgs[v] = buildBg(cfg, e.L, v);
  c.drawImage(e.imgs[v], 0, 0);
  if (cfg.live !== false) {
    const sk = 1 - clamp(cfg.dawn * 1.4) - clamp(cfg.dim * 0.8, 0, 0.8) * 0.5;
    if (sk > 0.02 && cfg.stars !== false) { c.save(); c.globalAlpha *= sk; e.L.stars.forEach(([x, y, r], k) => K.star(c, x, y, r, t, k)); c.restore(); }
    if (e.L.lamp && (cfg.lampLive ?? 1) && cfg.dim < 0.85) K.haloRings(c, e.L.lamp[0], e.L.lamp[1] + 20, t, { k: 1 - cfg.dim });
  }
  return e.L;
};
// 预热：提前把若干背景配置建好缓存（每个冷启动 0.4–0.9 秒），实时播放器里可在上一镜末尾调用，避免换镜卡一下。离线渲染不需要。
K.prewarm = (list) => { list.forEach(o => { const cfg = bgCfg(o), key = JSON.stringify(cfg); let e = BG_LRU.find(x => x.key === key); if (!e) { e = { key, L: bgLayout(cfg), imgs: [] }; BG_LRU.push(e); if (BG_LRU.length > BG_MAX) BG_LRU.shift(); } if (!e.imgs[0]) e.imgs[0] = buildBg(cfg, e.L, 0); }); };

// ---------- 道具 ----------
// 通用约定：K.xxx(c, x, y, o)，(x,y)=物体「落地点」底部中心（灯/钟/窗等挂物例外，见各自说明）；o.s 缩放(默认 1)、o.flip 水平镜像、o.alpha、o.t 时间(沸腾/活物)、o.boil 变体数(默认 2，0=不沸腾)。
// 返回锚点对象（屏幕坐标），方便摆东西：例如 table → top（桌面中心）、chair → seat（座面中心）。
// 一致比例：K.person 的 s=1 时身高约 520；椅座高 135、桌面高 262 与之匹配；章节里人/桌/椅用同一个 s 即可。
const rm = ['s', 'flip', 'alpha', 't', 'boil', 'rot'];
const defProp = (name, box, draw, anchors) => {
  K[name] = (c, x, y, o = {}) => {
    const { s = 1, flip = false, alpha = 1, t = 0, boil = 2, rot = 0 } = o, p = {}; for (const k in o) if (!rm.includes(k) && typeof o[k] !== 'function') p[k] = o[k];
    const key = name + JSON.stringify(p), v = K.boilV(t, boil, 6);
    const e = K.sprite(key, typeof box === 'function' ? box(p) : box, (g, vv) => draw(g, p, vv), v);
    K.blit(c, e, x, y, { s, flip, alpha, rot });
    const f = flip ? -1 : 1, A = (dx, dy) => [x + dx * s * f, y + dy * s]; return anchors ? anchors(A, p, s, f) : { at: A };
  };
};
const sd0 = v => 100;
// 桌：正面略俯视，桌面是一块亮色梯形，前沿有厚度，带抽屉。o.w 桌宽(640)
defProp('table', p => [-(p.w || 640) / 2 - 8, -306, (p.w || 640) / 2 + 8, 4], (g, p, v) => {
  const w = p.w || 640, hw = w / 2, s = sd0(v), Wd = PAL.wood, Wk = PAL.woodDark;
  K.paint(g, [-hw + 62, -262, 24, 226], Wk, { cell: 6, len: 15, width: 4.5, angle: 'vert', seed: s + 1, lw: 4 });
  K.paint(g, [hw - 86, -262, 24, 226], Wk, { cell: 6, len: 15, width: 4.5, angle: 'vert', seed: s + 2, lw: 4 });
  K.paint(g, [-hw + 12, -238, w - 24, 48], PAL.wood.slice(0, 5), { cell: 6, len: 20, width: 4.8, angle: 'horiz', seed: s + 3, lw: 4 });
  K.paint(g, [-70, -230, 140, 30], PAL.wood.slice(2), { cell: 6, len: 16, width: 4.5, angle: 'horiz', seed: s + 4, lw: 3.5 });
  g.fillStyle = C.ochreD; g.beginPath(); g.arc(0, -215, 6, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke();
  K.paint(g, [-hw + 22, -240, 30, 240], Wd.slice(0, 5), { cell: 6, len: 16, width: 4.8, angle: 'vert', seed: s + 5, lw: 4.5 });
  K.paint(g, [hw - 52, -240, 30, 240], Wd.slice(0, 5), { cell: 6, len: 16, width: 4.8, angle: 'vert', seed: s + 6, lw: 4.5 });
  K.paint(g, [-hw, -266, w, 30], Wd, { cell: 6, len: 22, width: 5, angle: 'horiz', seed: s + 7, lw: 4.5 });
  K.paint(g, [[-hw + 38, -304], [hw - 38, -304], [hw, -266], [-hw, -266]], PAL.wood.slice(2), { cell: 7, len: 26, width: 5.4, angle: 'horiz', seed: s + 8, lw: 4.5, shade: [-0.3, -1, 0.35] });
}, (A, p) => { const w = p.w || 640; return { top: A(0, -285), front: A(0, -268), left: A(-w / 2 + 70, -285), right: A(w / 2 - 70, -285), surfaceY: A(0, -285)[1], w: w * (p.s || 1) }; });
// 椅：梯背椅，侧面 3/4。默认面朝右（椅背在左），flip 面朝左。座面高 135
defProp('chair', [-110, -360, 130, 4], (g, p, v) => {
  const s = sd0(v) + 40, Wd = PAL.wood.slice(0, 5), Wk = PAL.woodDark, d = [26, -16], xn = y => -67 + (-y) / 340 * -14;
  const post = (ox, oy, pal, sdv) => K.paint(g, [[-80 + ox, oy], [-56 + ox, oy], [-70 + ox, -340 + oy], [-94 + ox, -340 + oy]], pal, { cell: 6, len: 15, width: 4.6, angle: 'vert', seed: sdv, lw: 4.5 });
  K.paint(g, [[52 + d[0], -102 + d[1]], [74 + d[0], -102 + d[1]], [76 + d[0], d[1]], [54 + d[0], d[1]]], Wk, { cell: 6, len: 15, width: 4.4, angle: 'vert', seed: s + 1, lw: 4 });
  post(d[0], d[1], Wk, s + 2);
  for (let k = 0; k < 4; k++) { const y = -178 - k * 48, a = xn(y), b = xn(y) + d[0];
    K.paint(g, [[a + 8, y], [b - 8, y + d[1]], [b - 8, y + d[1] - 18], [a + 8, y - 18]], Wd, { cell: 5, len: 14, width: 4, angle: 'diag', seed: s + 3 + k, lw: 3.5 }); }
  post(0, 0, Wd, s + 9);
  K.paint(g, [[-86, -124], [74, -124], [100, -140], [-60, -140]], PAL.wheat, { cell: 6, len: 16, width: 4.6, angle: 0.5, seed: s + 10, lw: 4.5 });
  K.paint(g, [-86, -124, 160, 22], Wd, { cell: 6, len: 20, width: 4.8, angle: 'horiz', seed: s + 11, lw: 4.5 });
  K.paint(g, [[50, -102], [76, -102], [78, 0], [52, 0]], Wd, { cell: 6, len: 15, width: 4.6, angle: 'vert', seed: s + 12, lw: 4.5 });
  K.paint(g, [-64, -56, 116, 11], Wd, { cell: 5, len: 14, width: 4, angle: 'horiz', seed: s + 13, lw: 3.5 });
}, (A) => ({ seat: A(8, -134), backTop: A(-80, -340), front: A(70, -124), floor: A(0, 0) }));
// 筹码：o.col 颜色(红)、o.w 直径(120)；(x,y)=底面中心。
const chipRR = p => (p.w || 120) / 2;
defProp('chip', p => [-chipRR(p) - 4, -chipRR(p) * 0.33 - (p.h || chipRR(p) * 0.37) - 4, chipRR(p) + 4, chipRR(p) * 0.33 + 4], (g, p, v) => {
  const rx = chipRR(p), ry = rx * 0.33, th = p.h || rx * 0.37, col = p.col || C.red, rp = ramp(col, 5), s = sd0(v) + 70;
  const side = q => { q.moveTo(-rx, -th); q.lineTo(-rx, 0); q.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true); q.lineTo(rx, -th); q.closePath(); };
  const sideBox = [-rx, -th - ry, rx, ry];
  K.paint(g, side, rp.slice(0, 3), { box: sideBox, cell: 5, len: 12, width: 4, angle: 'vert', seed: s, lw: 4 });
  g.fillStyle = C.cream; g.strokeStyle = C.ink; g.lineWidth = 2.5; for (let i = 0; i < 7; i++) { const a = Math.PI * (i + 0.5) / 7, px = -Math.cos(a) * rx * 0.94, h2 = Math.sin(a) * ry; g.beginPath(); g.roundRect(px - rx * 0.07, -th + 3 + h2 * 0.9, rx * 0.14, th - 6, 2); g.fill(); g.stroke(); }
  K.paint(g, { e: [0, -th, rx, ry] }, rp.slice(2), { cell: 5, len: 14, width: 4.2, angle: 'swirl', seed: s + 1, lw: 4.5 });
  g.save(); g.strokeStyle = C.cream; g.lineWidth = 4; g.setLineDash([rx * 0.2, rx * 0.12]); g.beginPath(); g.ellipse(0, -th, rx * 0.76, ry * 0.76, 0, 0, TAU); g.stroke(); g.restore();
  K.paint(g, { e: [0, -th, rx * 0.42, ry * 0.42] }, PAL.gold, { cell: 4, len: 9, width: 3.4, angle: 'swirl', seed: s + 2, lw: 3 });
}, (A, p) => { const rx = chipRR(p), th = p.h || rx * 0.37; return { top: A(0, -th), base: A(0, 0), mid: A(0, -th / 2), thick: th * (p.s || 1) }; });
// 一摞筹码：n 枚，cols 颜色轮换；lean 顶端偏移 px；sway 活动摇摆；top 锚点
K.chipStack = (c, x, y, o = {}) => { const { n = 5, s = 1, w = 120, cols = [C.red], lean = 0, sway = 0, t = 0, alpha = 1, flip = false } = o, th = (o.h || w / 2 * 0.37), step = th * 0.86;
  let top = [x, y];
  for (let i = 0; i < n; i++) { const q = n > 1 ? i / (n - 1) : 0, off = (lean * q * q + sway * q * Math.sin(t * 2.2 + i * 0.3) + (U.hash(i, w) - 0.5) * 3.5) * s;
    top = K.chip(c, x + off, y - i * step * s, { s, w, h: th, col: cols[i % cols.length], t, alpha, boil: o.boil ?? 2 }).top; }
  return { top, base: [x, y], height: (n - 1) * step * s + th * s }; };
// 一堆筹码（n 枚自动排成几摞，每摞最多 per 枚）：返回各摞顶端
K.chipPile = (c, x, y, n, o = {}) => { const { per = 6, gap = 108, s = 1, cols = [C.red, C.ochre, C.cobalt], t = 0 } = o, stacks = Math.max(1, Math.ceil(n / per)), tops = [];
  for (let i = 0; i < stacks; i++) { const cnt = Math.min(per, n - i * per), px = x + (i - (stacks - 1) / 2) * gap * s, py = y + (i % 2 ? 14 : 0) * s;
    tops.push(K.chipStack(c, px, py, { n: cnt, s, cols: [cols[i % cols.length]], w: o.w || 112, t, lean: (U.hash(i, 3) - 0.5) * 6 }).top); } return { tops }; };
// 吊灯：(x,y)=灯泡中心；o.top 吊线顶 y(0)；o.on 0..1（0 熄灯）；o.sway 摆角(弧度)；glow 发光半径(150)
defProp('lampShade', [-70, -80, 70, 24], (g, p, v) => {
  const s = sd0(v) + 90, on = p.on ?? 1, pal = on > 0.5 ? PAL.gold.slice(0, 4) : ramp('#4a4a6a', 4);
  K.paint(g, { pts: [[-60, 12], [-50, -22], [-22, -52], [0, -60], [22, -52], [50, -22], [60, 12]], smooth: true }, pal, { cell: 5, len: 13, width: 4.2, angle: 'swirl', seed: s, lw: 4.5, shade: [-0.4, -1, 0.3] });
}, null);
K.lamp = (c, x, y, o = {}) => { const { s = 1, on = 1, top = 0, sway = 0, t = 0, glow = 150 } = o, a = sway * Math.sin(t * 1.6);
  c.save(); c.translate(x, top); c.rotate(a); c.translate(-x, -top);
  c.strokeStyle = '#2a2236'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, top); c.lineTo(x, y - 62 * s); c.stroke();
  K.lampShade(c, x, y - 4 * s, { s, on: on > 0.5 ? 1 : 0, t, boil: o.boil ?? 2 });
  c.fillStyle = on > 0.5 ? '#fff6c0' : '#8a8aa8'; c.beginPath(); c.arc(x, y + 6 * s, 17 * s, 0, TAU); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 3; c.stroke();
  if (on > 0.02) K.glow(c, x, y + 6 * s, glow * s, 0.5 * on);
  c.restore(); return { bulb: [x, y + 6 * s], shade: [x, y - 20 * s] }; };
// 窗：(x,y)=窗洞中心；o.w o.h；o.sky 'night'|'dawn'|'day'|'dark'；窗外夜空漩涡 + 柏树，绿窗框
defProp('window', p => [-(p.w || 330) / 2 - 40, -(p.h || 400) / 2 - 40, (p.w || 330) / 2 + 40, (p.h || 400) / 2 + 60], (g, p, v) => {
  const w = p.w || 330, h = p.h || 400, sk = p.sky || 'night', s = sd0(v) + 120, x0 = -w / 2, y0 = -h / 2;
  const pal = sk === 'dawn' ? PAL.skyDawn : sk === 'day' ? PAL.skyDay : sk === 'dark' ? PAL.wallDark : PAL.sky;
  const sw = [[x0 + w * 0.32, y0 + h * 0.3, w * 0.2], [x0 + w * 0.72, y0 + h * 0.48, w * 0.22], [x0 + w * 0.5, y0 + h * 0.1, w * 0.12]];
  const ang = (x, y) => { let b = null, bd = 1e9; sw.forEach(q => { const d = Math.hypot(x - q[0], y - q[1]) / q[2]; if (d < bd) { bd = d; b = q; } }); return bd < 1.7 ? Math.atan2(y - b[1], x - b[0]) + Math.PI / 2 : 0.15; };
  K.paint(g, [x0, y0, w, h], pal, { cell: 7, len: 18, width: 5.2, angle: ang, seed: s, lw: 4, edge: false, tone: (x, y) => clamp(0.3 + 0.7 * (y - y0) / h * (sk === 'dawn' ? 1 : 0.5)) + 0.25 * Math.sin(ang(x, y) * 3) * (sk === 'dark' ? 0 : 1) });
  if (sk === 'night') { g.fillStyle = C.gold; g.beginPath(); g.arc(x0 + w * 0.78, y0 + h * 0.16, w * 0.07, 0, TAU); g.fill(); g.fillStyle = PAL.sky[2]; g.beginPath(); g.arc(x0 + w * 0.755, y0 + h * 0.14, w * 0.06, 0, TAU); g.fill(); }
  K.paint(g, { pts: [[x0 + w * 0.06, y0 + h], [x0 + w * 0.02, y0 + h * 0.7], [x0 + w * 0.12, y0 + h * 0.45], [x0 + w * 0.09, y0 + h * 0.25], [x0 + w * 0.15, y0 + h * 0.5], [x0 + w * 0.22, y0 + h * 0.75], [x0 + w * 0.2, y0 + h]], smooth: true }, PAL.cypress, { cell: 6, len: 16, width: 5, angle: 'vert', seed: s + 3, lw: 4 });
  const fw = 24, G = PAL.green;
  [[x0 - fw, y0 - fw, w + 2 * fw, fw, 'horiz'], [x0 - fw, y0 + h, w + 2 * fw, fw, 'horiz'], [x0 - fw, y0, fw, h, 'vert'], [x0 + w, y0, fw, h, 'vert'], [-9, y0, 18, h, 'vert'], [x0, -9 + h * 0.08, w, 16, 'horiz']].forEach((r, i) => K.paint(g, r.slice(0, 4), G, { cell: 6, len: 15, width: 4.8, angle: r[4], seed: s + 10 + i, lw: 4 }));
  K.paint(g, [x0 - fw - 22, y0 + h + fw - 4, w + 2 * fw + 44, 26], PAL.wood, { cell: 6, len: 18, width: 4.8, angle: 'horiz', seed: s + 20, lw: 4 });
}, (A, p) => ({ center: A(0, 0), top: A(0, -(p.h || 400) / 2), sill: A(0, (p.h || 400) / 2 + 24) }));
// 钟：(x,y)=表盘中心；o.r 半径(110)；o.h 钟点小时数(10.1 = 10:06，可连续变化)；表盘与指针分开，指针每帧画
defProp('clockFace', p => [-(p.r || 110) - 20, -(p.r || 110) - 20, (p.r || 110) + 20, (p.r || 110) + 20], (g, p, v) => {
  const r = p.r || 110, s = sd0(v) + 150;
  K.paint(g, { e: [0, 0, r + 14, r + 14] }, PAL.wood, { cell: 6, len: 16, width: 4.6, angle: 'swirl', seed: s, lw: 4.5 });
  K.paint(g, { e: [0, 0, r - 8, r - 8] }, PAL.cream, { cell: 6, len: 14, width: 4.4, angle: 'swirl', seed: s + 1, lw: 4 });
  g.strokeStyle = C.ink; g.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = r - (i % 3 ? 26 : 34), r1 = r - 14; g.lineWidth = i % 3 ? 4 : 7; g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1); g.stroke(); }
}, null);
K.clock = (c, x, y, o = {}) => { const { r = 110, h = 10.1, s = 1 } = o; K.clockFace(c, x, y, { r, s, t: o.t || 0, boil: o.boil ?? 2 });
  const hh = (h % 12) / 12 * TAU, mm = (h % 1) * TAU; c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round';
  [[hh, r * 0.5, 10], [mm, r * 0.78, 6]].forEach(([a, l, w]) => { c.strokeStyle = C.ink; c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * l, -Math.cos(a) * l); c.stroke(); });
  c.fillStyle = C.red; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 3; c.stroke(); c.restore(); return { center: [x, y] }; };
// 书：躺放。o.open 摊开；o.col 封面色；o.w 宽(230)
defProp('book', p => [-(p.w || 230) / 2 - 20, -80, (p.w || 230) / 2 + 20, 6], (g, p, v) => {
  const w = p.w || 230, hw = w / 2, s = sd0(v) + 180, col = p.col || C.cobalt;
  if (!p.open) {
    K.paint(g, [[hw, 0], [hw + 24, -20], [hw + 24, -62], [hw, -42]], PAL.paper, { cell: 5, len: 14, width: 3.6, angle: 'vert', seed: s + 1, lw: 4 });
    K.paint(g, [[-hw, -42], [hw, -42], [hw + 24, -62], [-hw + 24, -62]], ramp(col, 5).slice(1), { cell: 6, len: 16, width: 4.6, angle: 'horiz', seed: s, lw: 4.5 });
    K.paint(g, [-hw, -42, w, 42], ramp(col, 5), { cell: 6, len: 16, width: 4.6, angle: 'horiz', seed: s + 2, lw: 4.5 });
    g.strokeStyle = C.gold; g.lineWidth = 5; g.lineCap = 'round'; [-14, -28].forEach(y => { g.beginPath(); g.moveTo(-hw + 14, y); g.lineTo(hw - 14, y); g.stroke(); });
  } else {
    K.paint(g, [[-hw, 0], [0, -8], [0, -66], [-hw, -52]], PAL.paper, { cell: 5, len: 14, width: 3.8, angle: 'horiz', seed: s, lw: 4.5 });
    K.paint(g, [[hw, 0], [0, -8], [0, -66], [hw, -52]], PAL.paper, { cell: 5, len: 14, width: 3.8, angle: 'horiz', seed: s + 1, lw: 4.5 });
    g.strokeStyle = 'rgba(28,36,88,.55)'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 4; i++) [-1, 1].forEach(sg => { g.beginPath(); g.moveTo(sg * 18, -18 - i * 10 - (sg < 0 ? 0 : 0)); g.lineTo(sg * (hw - 20), -14 - i * 10 + (sg < 0 ? -2 : 0)); g.stroke(); });
  }
}, (A, p) => ({ top: A(0, -p.open ? 36 : 40), base: A(0, 0) }));
// 杯：o.col 杯色；热气 o.steam(默认 true) 每帧画
defProp('cupBody', [-60, -90, 76, 8], (g, p, v) => {
  const s = sd0(v) + 210, col = p.col || C.cobalt, rp = ramp(col, 5);
  K.paint(g, [[-28, 0], [28, 0], [34, -70], [-34, -70]], rp, { cell: 5, len: 12, width: 4, angle: 'vert', seed: s, lw: 4.5, shade: [-1, 0, 0.25] });
  g.strokeStyle = C.ink; g.lineWidth = 9; g.beginPath(); g.ellipse(40, -38, 17, 20, 0, -1.3, 1.3); g.stroke(); g.strokeStyle = rp[3]; g.lineWidth = 4.5; g.stroke();
  K.paint(g, { e: [0, -70, 34, 9] }, PAL.cream.slice(0, 2), { cell: 5, len: 10, width: 3.6, angle: 'horiz', seed: s + 1, lw: 3.5 });
  K.paint(g, { e: [0, 2, 56, 10] }, PAL.cream, { cell: 5, len: 14, width: 3.6, angle: 'horiz', seed: s + 2, lw: 3.5 });
}, null);
K.cup = (c, x, y, o = {}) => { const { s = 1, t = 0 } = o; K.cupBody(c, x, y, { ...o, boil: o.boil ?? 2 }); if (o.steam !== false) P.steam(c, t, x, y - 76 * s, { h: 70 * s, n: 2, color: 'rgba(240,244,255,.85)', width: 4, spread: 14 * s, wobble: 9 }); return { rim: [x, y - 70 * s] }; };
// 烛：o.h 烛身高(150)；o.lit 0..1 火苗大小；火苗与光每帧画
defProp('candleBody', p => [-46, -(p.h || 150) - 10, 46, 14], (g, p, v) => {
  const h = p.h || 150, s = sd0(v) + 240;
  K.paint(g, [-17, -h, 34, h], PAL.cream, { cell: 5, len: 12, width: 4, angle: 'vert', seed: s, lw: 4.5, shade: [-1, 0, 0.2] });
  K.paint(g, { pts: [[-17, -h], [17, -h], [17, -h + 28], [11, -h + 46], [6, -h + 30], [-1, -h + 34], [-9, -h + 58], [-15, -h + 30], [-17, -h + 24]], smooth: false }, ['#e8d8a8', '#f6ecc8'], { cell: 5, len: 10, width: 3.6, angle: 'vert', seed: s + 1, lw: 0, edge: false, outline: false });
  K.paint(g, { e: [0, 4, 44, 11] }, PAL.wood, { cell: 5, len: 14, width: 4, angle: 'horiz', seed: s + 2, lw: 4 });
  g.strokeStyle = C.ink; g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -h); g.lineTo(1, -h - 12); g.stroke();
}, null);
K.candle = (c, x, y, o = {}) => { const { s = 1, h = 150, lit = 1, t = 0 } = o; K.candleBody(c, x, y, { h, s, boil: o.boil ?? 2 });
  const fy = y - (h + 14) * s; if (lit > 0.02) { const fl = 1 + 0.12 * Math.sin(t * 17) + 0.07 * Math.sin(t * 29 + 1), sw = Math.sin(t * 9) * 3 * s, fs = s * lit * fl;
    K.glow(c, x, fy - 10 * s, 130 * s * lit, 0.55);
    c.save(); c.translate(x, fy); c.scale(fs, fs); c.fillStyle = '#f0a030'; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-18, -14, -10, -36, sw, -58); c.bezierCurveTo(14 + sw, -34, 18, -14, 0, 0); c.fill();
    c.fillStyle = '#fff2a0'; c.beginPath(); c.moveTo(0, -2); c.bezierCurveTo(-9, -12, -5, -26, sw * 0.6, -38); c.bezierCurveTo(8, -24, 9, -12, 0, -2); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-18, -14, -10, -36, sw, -58); c.bezierCurveTo(14 + sw, -34, 18, -14, 0, 0); c.stroke(); c.restore(); }
  return { flame: [x, fy - 24 * s], top: [x, fy] }; };
// 天平：(x,y)=底座落地点；o.tilt -1..1（正=右盘下沉）；o.beam 半臂长(190)；返回 panL / panR 锚点（盘面中心，可摆筹码）
defProp('scaleStand', [-110, -450, 110, 4], (g, p, v) => {
  const s = sd0(v) + 270; K.paint(g, [[-90, 0], [90, 0], [60, -34], [-60, -34]], PAL.wood, { cell: 6, len: 16, width: 4.6, angle: 'horiz', seed: s, lw: 4.5 });
  K.paint(g, [-12, -420, 24, 388], PAL.wood.slice(1), { cell: 5, len: 14, width: 4.4, angle: 'vert', seed: s + 1, lw: 4.5 });
  K.paint(g, { e: [0, -424, 20, 20] }, PAL.gold, { cell: 4, len: 9, width: 3.4, angle: 'swirl', seed: s + 2, lw: 3.5 }); }, null);
defProp('scaleBeam', p => [-(p.beam || 190) - 20, -30, (p.beam || 190) + 20, 30], (g, p, v) => {
  const b = p.beam || 190, s = sd0(v) + 280; K.paint(g, { pts: [[-b, -4], [-b * 0.5, -14], [0, -16], [b * 0.5, -14], [b, -4], [b, 8], [0, 6], [-b, 8]], smooth: true }, PAL.wood.slice(1), { cell: 5, len: 16, width: 4.2, angle: 'horiz', seed: s, lw: 4.5 }); }, null);
defProp('scalePan', [-86, -8, 86, 26], (g, p, v) => { const s = sd0(v) + 290;
  K.paint(g, { pts: [[-80, 0], [80, 0], [58, 22], [-58, 22]], smooth: false }, PAL.gold.slice(0, 4), { cell: 5, len: 14, width: 4.2, angle: 'horiz', seed: s, lw: 4.5 }); }, null);
K.scales = (c, x, y, o = {}) => { const { s = 1, tilt = 0, beam = 190, t = 0 } = o, a = tilt * 0.3, px = x, py = y - 424 * s, bo = { boil: o.boil ?? 2, t };
  K.scaleStand(c, x, y, { s, ...bo }); const ex = Math.cos(a) * beam * s, ey = Math.sin(a) * beam * s, L = [px - ex, py - ey], R = [px + ex, py + ey], drop = 170 * s;
  K.blit(c, K.sprite('scaleBeam' + JSON.stringify({ beam }), [-beam - 20, -30, beam + 20, 30], (g, vv) => { const b = beam, q = sd0(vv) + 280; K.paint(g, { pts: [[-b, -4], [-b * 0.5, -14], [0, -16], [b * 0.5, -14], [b, -4], [b, 8], [0, 6], [-b, 8]], smooth: true }, PAL.wood.slice(1), { cell: 5, len: 16, width: 4.2, angle: 'horiz', seed: q, lw: 4.5 }); }, K.boilV(t, o.boil ?? 2, 6)), px, py, { s, rot: a });
  c.strokeStyle = C.ink; c.lineWidth = 3.5; [L, R].forEach(([bx, by]) => { c.beginPath(); c.moveTo(bx, by + 6 * s); c.lineTo(bx - 70 * s, by + drop); c.moveTo(bx, by + 6 * s); c.lineTo(bx + 70 * s, by + drop); c.stroke(); });
  K.scalePan(c, L[0], L[1] + drop, { s, ...bo }); K.scalePan(c, R[0], R[1] + drop, { s, ...bo });
  return { panL: [L[0], L[1] + drop], panR: [R[0], R[1] + drop], pivot: [px, py] }; };
// 沙漏：(x,y)=底座落地点；o.p 0..1 沙已漏下的比例；o.s
defProp('hourglassFrame', [-92, -400, 92, 6], (g, p, v) => { const s = sd0(v) + 310;
  K.paint(g, [-90, -392, 180, 26], PAL.wood, { cell: 6, len: 18, width: 4.6, angle: 'horiz', seed: s, lw: 4.5 });
  K.paint(g, [-90, -26, 180, 26], PAL.wood, { cell: 6, len: 18, width: 4.6, angle: 'horiz', seed: s + 1, lw: 4.5 });
  [-74, 74].forEach((px, i) => K.paint(g, [px - 7, -368, 14, 344], PAL.woodDark, { cell: 5, len: 14, width: 4, angle: 'vert', seed: s + 2 + i, lw: 4 })); }, null);
const HG_GLASS = [[-62, -366], [-58, -300], [-34, -236], [-8, -204], [-6, -196], [-8, -188], [-34, -156], [-58, -90], [-62, -28]];
K.hourglass = (c, x, y, o = {}) => { const { s = 1, p = 0.4, t = 0 } = o, q = clamp(p);
  c.save(); c.translate(x, y); c.scale(s, s);
  const gl = new Path2D(); HG_GLASS.forEach(([a, b], i) => i ? gl.lineTo(a, b) : gl.moveTo(a, b)); [...HG_GLASS].reverse().forEach(([a, b]) => gl.lineTo(-a, b)); gl.closePath();
  c.fillStyle = 'rgba(190,215,245,.28)'; c.fill(gl);
  c.save(); c.clip(gl); c.fillStyle = C.ochreL;
  const topFill = 1 - q, topH = 150 * topFill; c.beginPath(); c.moveTo(-70, -204 - 0); c.lineTo(-70, -204 - topH * 0.9 - (q > 0 ? 0 : 0)); c.lineTo(70, -204 - topH * 0.9); c.lineTo(70, -204); c.fill();
  if (topFill > 0.02) { c.fillStyle = C.ochreL; c.beginPath(); c.moveTo(-8, -190); c.lineTo(8, -190); c.lineTo(30, -204 - 0); c.lineTo(-30, -204); c.fill(); }
  const botH = 120 * q; c.fillStyle = C.ochre; c.beginPath(); c.moveTo(-60, -28); c.lineTo(60, -28); c.lineTo(10, -28 - botH); c.lineTo(-10, -28 - botH); c.closePath(); c.fill();
  if (q > 0 && q < 1) { c.strokeStyle = C.ochreL; c.lineWidth = 4; c.setLineDash([6, 5]); c.lineDashOffset = -t * 60; c.beginPath(); c.moveTo(0, -196); c.lineTo(0, -28 - botH); c.stroke(); c.setLineDash([]); }
  c.restore();
  c.strokeStyle = C.ink; c.lineWidth = 4.5; c.lineJoin = 'round'; c.stroke(gl); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-48, -330); c.lineTo(-44, -290); c.stroke();
  c.restore(); K.hourglassFrame(c, x, y, { s, t, boil: o.boil ?? 2 }); return { top: [x, y - 392 * s], neck: [x, y - 196 * s], base: [x, y] }; };
// 门：(x,y)=门洞底边中心；o.w o.h(240×520)；o.open 0..1 开门（门扇绕左侧合页转，缝里透出灯黄光）
defProp('doorFrame', p => [-(p.w || 240) / 2 - 30, -(p.h || 520) - 30, (p.w || 240) / 2 + 30, 6], (g, p, v) => { const w = p.w || 240, h = p.h || 520, s = sd0(v) + 350;
  K.paint(g, [-w / 2, -h, w, h], PAL.night, { cell: 7, len: 18, width: 5, angle: 'vert', seed: s, lw: 0, edge: false });
  [[-w / 2 - 22, -h - 22, 22, h + 22, 'vert'], [w / 2, -h - 22, 22, h + 22, 'vert'], [-w / 2 - 22, -h - 22, w + 44, 22, 'horiz']].forEach((r, i) => K.paint(g, r.slice(0, 4), PAL.wood, { cell: 6, len: 16, width: 4.6, angle: r[4], seed: s + 1 + i, lw: 4.5 })); }, null);
defProp('doorLeaf', p => [-4, -(p.h || 520) - 4, (p.w || 240) + 4, 4], (g, p, v) => { const w = p.w || 240, h = p.h || 520, s = sd0(v) + 360, col = p.col || '#a8432e';
  K.paint(g, [0, -h, w, h], ramp(col, 5), { cell: 7, len: 20, width: 5.2, angle: 'vert', seed: s, lw: 4.5 });
  [[w * 0.14, -h * 0.9, w * 0.72, h * 0.38], [w * 0.14, -h * 0.46, w * 0.72, h * 0.38]].forEach((r, i) => K.paint(g, r, ramp(col, 5).slice(0, 4), { cell: 6, len: 16, width: 4.4, angle: 'vert', seed: s + 1 + i, lw: 3.5 }));
  g.fillStyle = C.gold; g.beginPath(); g.arc(w * 0.86, -h * 0.46, 11, 0, TAU); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke(); }, null);
K.door = (c, x, y, o = {}) => { const { s = 1, w = 240, h = 520, open = 0, t = 0 } = o, bo = { boil: o.boil ?? 2, t };
  K.doorFrame(c, x, y, { w, h, s, ...bo });
  if (open > 0.01) { const q = open, x0 = x - w / 2 * s, y0 = y - h * s;
    c.save(); const gr = c.createLinearGradient(0, y, 0, y0); gr.addColorStop(0, `rgba(255,214,110,${0.95 * q})`); gr.addColorStop(1, `rgba(255,244,190,${0.8 * q})`); c.fillStyle = gr; c.fillRect(x0, y0, w * s, h * s); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,220,120,${0.35 * q})`; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w * s, y); c.lineTo(x0 + (w + 200) * s, y + 260 * s); c.lineTo(x0 - 200 * s, y + 260 * s); c.closePath(); c.fill(); c.restore();
    K.glow(c, x, y - h * 0.4 * s, 260 * s, 0.4 * q);
    const lw = Math.max(0.1, Math.cos(q * 1.2));
    K.blit(c, K.sprite('doorLeaf' + JSON.stringify({ w, h }), [-4, -h - 4, w + 4, 4], (g, vv) => { const ss = sd0(vv) + 360, col = '#a8432e'; K.paint(g, [0, -h, w, h], ramp(col, 5), { cell: 7, len: 20, width: 5.2, angle: 'vert', seed: ss, lw: 4.5 }); }, K.boilV(t, o.boil ?? 2, 6)), x0, y, { s, sx: lw });
  } else K.doorLeaf(c, x - w / 2 * s, y, { w, h, s, ...bo });
  return { center: [x, y - h / 2 * s], base: [x, y], top: [x, y - h * s] }; };
// 牌：n 张扇形；o.faces [['A','h'],…] 正面（花色 h 红桃 d 方块 s 黑桃 c 梅花），缺省为牌背；o.spread 总张角(弧度)
const suit = (g, k, x, y, r) => { g.save(); g.translate(x, y); g.scale(r, r); g.beginPath();
  if (k === 'h' || k === 'd') { g.fillStyle = C.red; if (k === 'h') { g.moveTo(0, 0.9); g.bezierCurveTo(-1.3, 0, -1, -0.9, 0, -0.35); g.bezierCurveTo(1, -0.9, 1.3, 0, 0, 0.9); } else { g.moveTo(0, -1); g.lineTo(0.7, 0); g.lineTo(0, 1); g.lineTo(-0.7, 0); g.closePath(); } g.fill(); }
  else { g.fillStyle = C.ink; if (k === 's') { g.moveTo(0, -0.95); g.bezierCurveTo(-1.3, 0, -1, 0.7, 0, 0.35); g.bezierCurveTo(1, 0.7, 1.3, 0, 0, -0.95); g.fill(); g.fillRect(-0.12, 0.2, 0.24, 0.7); } else { [[0, -0.5], [-0.5, 0.2], [0.5, 0.2]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 0.42, 0, TAU); g.fill(); }); g.fillRect(-0.12, 0.2, 0.24, 0.7); } }
  g.restore(); };
defProp('card', p => [-50, -150, 50, 6], (g, p, v) => { const s = sd0(v) + 400, f = p.face;
  K.paint(g, { r: [-44, -138, 88, 138, 8] }, f ? PAL.paper : ramp(C.cobalt, 5), { cell: 6, len: 14, width: 4.2, angle: f ? 'horiz' : 'diag', seed: s, lw: 4 });
  if (!f) { g.strokeStyle = C.ochreL; g.lineWidth = 4; g.strokeRect(-32, -126, 64, 114); g.beginPath(); g.moveTo(0, -112); g.lineTo(20, -69); g.lineTo(0, -26); g.lineTo(-20, -69); g.closePath(); g.stroke(); }
  else { g.fillStyle = f[1] === 'h' || f[1] === 'd' ? C.red : C.ink; g.font = '40px "PuHui-Black"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f[0], -22, -112); suit(g, f[1], -22, -82, 14); suit(g, f[1], 6, -50, 30); }
}, null);
K.cards = (c, x, y, o = {}) => { const { n = 3, spread = 0.7, s = 1, faces = null, t = 0, lift = 0 } = o, out = [];
  for (let i = 0; i < n; i++) { const q = n > 1 ? i / (n - 1) - 0.5 : 0, a = q * spread, px = x + Math.sin(a) * 110 * s, py = y - Math.cos(a) * 14 * s - lift * s;
    K.card(c, px, py + 120 * s, { s, face: faces ? faces[i] : null, rot: a, boil: 0 }); out.push([px, py]); } return { cards: out }; };
// 向日葵花瓶（梵高标志）
defProp('sunflowers', [-130, -330, 130, 4], (g, p, v) => { const s = sd0(v) + 450; g.lineCap = 'round';
  [[-30, -100, -80, -210], [0, -100, 8, -260], [26, -100, 90, -200], [-8, -100, -34, -150]].forEach(([a, b, c2, d]) => { g.strokeStyle = C.ink; g.lineWidth = 11; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); g.strokeStyle = '#4d8a3a'; g.lineWidth = 6; g.stroke(); });
  K.paint(g, { pts: [[-36, 0], [-44, -52], [-26, -104], [26, -104], [44, -52], [36, 0]], smooth: true }, PAL.gold.slice(0, 4), { cell: 5, len: 13, width: 4.2, angle: 'vert', seed: s, lw: 4.5 });
  [[-80, -210, 36], [8, -260, 40], [90, -200, 34], [-34, -150, 24]].forEach(([x, y, r], k) => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + k; g.save(); g.translate(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.rotate(a); g.fillStyle = k % 2 ? '#f2b51c' : '#f6c630'; g.strokeStyle = C.ink; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, r * 0.45, r * 0.19, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    K.paint(g, { e: [x, y, r * 0.48, r * 0.48] }, ['#4a2a0c', '#6a3a10', '#8a4b14', '#b8651c'], { cell: 4, len: 8, width: 3.4, angle: 'swirl', seed: s + k, lw: 3.5 }); });
}, (A) => ({ top: A(0, -300) }));
// 柏树（独立）：o.h 高(520)
defProp('cypress', p => [-60, -(p.h || 520) - 10, 60, 6], (g, p, v) => { const h = p.h || 520, s = sd0(v) + 500;
  K.paint(g, { pts: [[-28, 4], [-50, -h * 0.25], [-30, -h * 0.5], [-14, -h * 0.78], [4, -h], [18, -h * 0.76], [40, -h * 0.5], [48, -h * 0.25], [30, 4]], smooth: true }, PAL.cypress, { cell: 6, len: 18, width: 5.4, angle: (x, y) => -Math.PI / 2 + 0.5 * Math.sin(y * 0.03 + x * 0.02), seed: s, lw: 5 }); }, (A, p) => ({ top: A(0, -(p.h || 520)) }));

// ---------- 人 ----------
// K.person(c, x, y, o)：(x,y)=脚底/地面接触点（坐姿时是椅脚下的地面，hip 在座面上方），s=1 时身高≈520（站），坐姿座高 134 与 K.chair 配套。
// 手写多边形 + 笔触 + 深靛蓝补线，3/4 侧面，默认面朝右（dir:-1 面朝左）。三层分别缓存：后层（腿/远臂/躯干）、头（可活动）、近臂（盖在头和桌上）。
// o：pose  stand 站｜sit 坐｜think 托腮｜slump 垂头坐｜cheer 举臂｜walk 走｜hold 双手捧在胸前｜reach 近手前伸｜despair 双手抱头
//    to/mix  混向另一姿势（mix 0..1，内部量化成 1/8 步以便缓存）
//    sit  强制坐/站（stand 加 sit:true 就是「站姿上身 + 坐下」）；seat 座高(134)
//    mood  calm 平静｜sad 难过｜happy 微笑｜tired 闭眼｜worry 担忧｜firm 坚定｜shock 惊｜none 不画五官
//    hat 'straw' 草帽｜'cap' 软帽｜'beret' 贝雷｜'none'；beard 胡子色（true=赭红）；top/pants/shoe/skin/hair/hatCol 颜色
//    handN / handF  屏幕坐标 [x,y]：近手/远手伸到这里（例如按在筹码上）；walk  步态相位（弧度，内部量化 12 步）
//    dir 1/-1  s 缩放  t 时间(呼吸、点头)  react 发生反应的时刻（头阻尼点一下）  layer 'all'|'back'|'front'（桌在人前面时：back→桌→front）  alpha
// 返回锚点（屏幕坐标）：head 头心｜top 帽顶｜mouth｜chest｜hip｜seat｜handN｜handF｜feet
const L_TH = 128, L_SH = 128, L_UA = 100, L_FA = 96, L_TO = 158;
const rnd1 = (n, k = 3) => Math.round(n / k) * k;
const poseDefs = {
  stand: { sit: false, hip: [0, -264], lean: 0.03, ht: 0.04, hN: [16, -200], hF: [-8, -196], fN: [24, -14], fF: [-26, -14] },
  sit: { sit: true, lean: 0.0, ht: 0.03, hN: [180, -268], hF: [206, -274] },
  think: { sit: true, lean: 0.16, ht: 0.12, hN: 'chin', hF: [196, -274] },
  slump: { sit: true, lean: 0.52, ht: 0.52, hN: [128, -118], hF: [104, -104] },
  cheer: { sit: false, hip: [0, -264], lean: -0.06, ht: -0.2, hN: [120, -606], hF: [-70, -560], fN: [30, -14], fF: [-30, -14] },
  walk: { sit: false, lean: 0.07, ht: 0.03 },
  hold: { sit: false, lean: 0.04, ht: 0.12, hN: [100, -336], hF: [82, -322], fN: [24, -14], fF: [-26, -14] },
  reach: { sit: false, lean: 0.1, ht: 0.04, hN: [250, -392], hF: [-8, -184], fN: [30, -14], fF: [-28, -14] },
  despair: { sit: false, lean: 0.1, ht: 0.35, hN: 'head', hF: 'head2', fN: [24, -14], fF: [-26, -14] },
};
K.POSES = Object.keys(poseDefs);
const sitFoot = { fN: [128, -12], fF: [150, -12] };
const T = (R, v, u) => [R.hip[0] + v * Math.cos(R.lean) + u * Math.sin(R.lean), R.hip[1] + v * Math.sin(R.lean) - u * Math.cos(R.lean)];
const ik = (S, Tg, a, b, mode) => {
  let dx = Tg[0] - S[0], dy = Tg[1] - S[1], d = Math.hypot(dx, dy) || 1e-3; const dmax = a + b - 1;
  if (d > dmax) { Tg = [S[0] + dx / d * dmax, S[1] + dy / d * dmax]; d = dmax; dx = Tg[0] - S[0]; dy = Tg[1] - S[1]; }
  const ang = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a];
  const sc = E => mode === 'leg' ? E[0] : -E[0] * 0.5 + E[1] * 0.8; return { E: sc(E1) >= sc(E2) ? E1 : E2, H: Tg };
};
const solvePose = (name, o) => {                                          // → 数值骨架（dir=+1，局部坐标）
  const d = poseDefs[name] || poseDefs.stand, sit = o.sit ?? d.sit, seat = o.seat ?? 134, R = { sit, lean: d.lean, ht: d.ht };
  if (name === 'walk') { const ph = o.walkQ || 0; R.hip = [0, -264 + 7 * Math.abs(Math.sin(ph))]; R.fN = [64 * Math.sin(ph), -14 - 30 * Math.max(0, Math.cos(ph))]; R.fF = [-64 * Math.sin(ph), -14 - 30 * Math.max(0, -Math.cos(ph))]; R.hN = [14 - 42 * Math.sin(ph), -200]; R.hF = [-4 + 42 * Math.sin(ph), -200]; }
  else { R.hip = sit ? [0, -(seat + 14)] : (d.hip || [0, -264]); R.fN = sit ? sitFoot.fN : d.fN; R.fF = sit ? sitFoot.fF : d.fF; R.hN = d.hN; R.hF = d.hF; }
  if (sit && !d.sit) { R.hN = d.hN; R.hF = d.hF; if (name === 'hold') { R.hN = [120, -270]; R.hF = [104, -262]; } if (name === 'stand') { R.hN = poseDefs.sit.hN; R.hF = poseDefs.sit.hF; } }
  if (!sit && d.sit) { R.fN = poseDefs.stand.fN; R.fF = poseDefs.stand.fF; R.hip = [0, -264]; }
  return finishRig(R);
};
const finishRig = (R) => {                                                // 由 hip/lean/ht + 目标 算出 头/肩/肘/膝
  R.nk = T(R, 4, L_TO + 2); R.Sn = T(R, -8, L_TO - 10); R.Sf = T(R, 24, L_TO - 6);
  const hr = R.lean * 0.45 + R.ht; R.hc = [R.nk[0] + Math.sin(hr) * 63 + 5 * Math.cos(hr), R.nk[1] - Math.cos(hr) * 63 + 5 * Math.sin(hr)]; R.hr = hr;
  const res = (h, k) => h === 'chin' ? [R.hc[0] + 30, R.hc[1] + 50] : h === 'head' ? [R.hc[0] + 8, R.hc[1] - 6] : h === 'head2' ? [R.hc[0] - 22, R.hc[1] - 14] : h;
  R.hN = res(R.hN); R.hF = res(R.hF);
  const an = ik(R.Sn, R.hN, L_UA, L_FA, 'arm'), af = ik(R.Sf, R.hF, L_UA, L_FA, 'arm'); R.eN = an.E; R.hN = an.H; R.eF = af.E; R.hF = af.H;
  const hn = [R.hip[0] + 4, R.hip[1] + 2], hf = [R.hip[0] + 12, R.hip[1] - 2], ln = ik(hn, R.fN, L_TH, L_SH, 'leg'), lf = ik(hf, R.fF, L_TH, L_SH, 'leg'); R.kN = ln.E; R.fN = ln.H; R.kF = lf.E; R.fF = lf.H; R.hipN = hn; R.hipF = hf;
  return R;
};
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const mixRig = (A, B, k) => { if (k <= 0) return A; const R = { sit: k > 0.5 ? B.sit : A.sit, lean: lerp(A.lean, B.lean, k), ht: lerp(A.ht, B.ht, k), hip: lerp2(A.hip, B.hip, k), fN: lerp2(A.fN, B.fN, k), fF: lerp2(A.fF, B.fF, k), hN: lerp2(A.hN, B.hN, k), hF: lerp2(A.hF, B.hF, k) }; return finishRig(R); };
// 肢体：沿关节折线两侧偏移出一条平滑轮廓（肘/膝处是连续的弯，没有「关节圆」），返回填充点列与开口边线（起点帽不描）
const chain = (pts, ws, capStart = true) => {
  const n = pts.length, L = [], Rr = [], dirs = []; for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], d = Math.hypot(dx, dy) || 1; dirs.push([dx / d, dy / d]); }
  for (let i = 0; i < n; i++) { const a = dirs[Math.max(0, i - 1)], b = dirs[Math.min(n - 2, i)], mx = a[0] + b[0], my = a[1] + b[1], ml = Math.hypot(mx, my) || 1, nx = -my / ml, ny = mx / ml, sc = 1 / Math.max(0.55, nx * -a[1] + ny * a[0]), off = ws[i] / 2 * sc;
    L.push([pts[i][0] + nx * off, pts[i][1] + ny * off]); Rr.push([pts[i][0] - nx * off, pts[i][1] - ny * off]); }
  const e = pts[n - 1], d = dirs[n - 2], w = ws[n - 1] / 2, cap = [[e[0] + d[0] * w * 0.9 + (L[n - 1][0] - e[0]) * 0.55, e[1] + d[1] * w * 0.9 + (L[n - 1][1] - e[1]) * 0.55], [e[0] + d[0] * w * 1.05, e[1] + d[1] * w * 1.05], [e[0] + d[0] * w * 0.9 + (Rr[n - 1][0] - e[0]) * 0.55, e[1] + d[1] * w * 0.9 + (Rr[n - 1][1] - e[1]) * 0.55]];
  const open = [...L, ...cap, ...Rr.slice().reverse()], b0 = pts[0], d0 = dirs[0], w0 = ws[0] / 2;
  const cap0 = [[b0[0] - d0[0] * w0 * 0.9 + (Rr[0][0] - b0[0]) * 0.55, b0[1] - d0[1] * w0 * 0.9 + (Rr[0][1] - b0[1]) * 0.55], [b0[0] - d0[0] * w0 * 1.05, b0[1] - d0[1] * w0 * 1.05], [b0[0] - d0[0] * w0 * 0.9 + (L[0][0] - b0[0]) * 0.55, b0[1] - d0[1] * w0 * 0.9 + (L[0][1] - b0[1]) * 0.55]];
  return { poly: [...open, ...cap0], open, pts };
};
const chainAngle = pts => (x, y) => { let best = 1e9, a = 0; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, q = clamp(((x - x0) * dx + (y - y0) * dy) / l2), d = Math.hypot(x - (x0 + dx * q), y - (y0 + dy * q)); if (d < best) { best = d; a = Math.atan2(dy, dx); } } return a; };
const strokeOpen = (g, pts, lw = 4.5) => { g.save(); g.strokeStyle = C.ink; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(K.smooth(pts, false)); g.restore(); };
const chainPaint = (g, pts, ws, pal, seed, o = {}) => { const ch = chain(pts, ws); K.paint(g, { pts: ch.poly, smooth: true }, pal, { cell: o.cell ?? 6, len: o.len ?? 14, width: o.width ?? 4.4, angle: chainAngle(pts), seed, edge: false, shade: o.shade ?? [0.6, -0.5, 0.2] });
  strokeOpen(g, ch.open, o.lw ?? 4.5); return ch; };
const shoePaint = (g, f, pal, seed) => K.paint(g, { pts: [[f[0] - 20, f[1] - 30], [f[0] + 6, f[1] - 34], [f[0] + 26, f[1] - 20], [f[0] + 52, f[1] - 12], [f[0] + 62, f[1] + 2], [f[0] + 54, f[1] + 14], [f[0] - 20, f[1] + 14]], smooth: true }, pal, { cell: 5, len: 12, width: 4, angle: 0.1, seed, lw: 4.5 });
const handPaint = (g, E, H, skin, seed) => { const a = Math.atan2(H[1] - E[1], H[0] - E[0]), ca = Math.cos(a), sa = Math.sin(a), c0 = [H[0] + ca * 6, H[1] + sa * 6];
  const P2 = (u, w) => [c0[0] + ca * u - sa * w, c0[1] + sa * u + ca * w];
  K.paint(g, { pts: [P2(-14, -11), P2(2, -13), P2(14, -11), P2(21, -3), P2(19, 6), P2(8, 12), P2(-6, 12), P2(-14, 10)], smooth: true }, skin, { cell: 4, len: 9, width: 3.6, angle: a, seed, lw: 3.8 });
  g.save(); g.strokeStyle = 'rgba(28,36,88,.7)'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); const q1 = P2(2, 3), q2 = P2(16, 3); g.moveTo(...q1); g.lineTo(...q2); g.stroke(); g.restore(); };
const Cl = o => ({ top: ramp(o.top || '#c8472f', 5), pants: ramp(o.pants || '#2e4a9a', 5), shoe: ramp(o.shoe || '#4a3020', 4), skin: ramp(o.skin || C.skin, 4).map((h, i) => i === 0 ? mixHex(o.skin || C.skin, '#b87850', 0.5) : h), hair: ramp(o.hair || '#6a3a1c', 4) });
const rigBox = (pts, ex = 70) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return [Math.floor(x0 - ex), Math.floor(y0 - ex), Math.ceil(x1 + ex), Math.ceil(y1 + ex)]; };
const armPaint = (g, S, E, Hh, pal, skin, sd) => { const cuff = lerp2(E, Hh, 0.84); chainPaint(g, [S, E, cuff], [44, 38, 30], pal, sd, { lw: 4.5 }); handPaint(g, E, Hh, skin, sd + 2); };
const drawBack = (g, R, o, v) => {
  const k = Cl(o), s = 600;
  [[R.hipF, R.kF, R.fF, 0], [R.hipN, R.kN, R.fN, 1]].forEach(([h, kn, f, near]) => {
    const pl = near ? k.pants : k.pants.map(h2 => mixHex(h2, C.ink, 0.28));
    chainPaint(g, [h, kn, [f[0], f[1] - 4]], [62, 50, 38], pl, s + near * 5, { lw: 4.5 });
    shoePaint(g, f, near ? k.shoe : k.shoe.map(h2 => mixHex(h2, C.ink, 0.25)), s + near * 5 + 2);
  });
  armPaint(g, R.Sf, R.eF, R.hF, k.top.map(h => mixHex(h, C.ink, 0.3)), k.skin, s + 20);
  const pts = [[-48, -4], [-58, 50], [-54, 108], [-46, 150], [-24, 172], [16, 174], [46, 156], [60, 118], [64, 62], [52, 0]].map(([v2, u]) => T(R, v2, u));
  K.paint(g, { pts, smooth: true }, k.top, { cell: 7, len: 20, width: 5.2, angle: (x, y) => R.lean - Math.PI / 2 + 0.55 * Math.sin(x * 0.05 + y * 0.03), seed: s + 30, lw: 5, shade: [0.7, -0.5, 0.28] });
  g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(28,36,88,.5)'; g.lineWidth = 3.5;
  [[22, 30, 16, 124], [-22, 24, -30, 96]].forEach(([v1, u1, v2, u2]) => { g.beginPath(); g.moveTo(...T(R, v1, u1)); g.quadraticCurveTo(...T(R, (v1 + v2) / 2 + 8, (u1 + u2) / 2), ...T(R, v2, u2)); g.stroke(); });
  g.fillStyle = C.ink; [58, 90, 122].forEach(u => { const p = T(R, 44 - (u - 58) * 0.08, u); g.beginPath(); g.arc(p[0], p[1], 3.8, 0, TAU); g.fill(); }); g.restore();
  K.paint(g, [T(R, -22, 170), T(R, 16, 174), T(R, 30, 150), T(R, 8, 128), T(R, -14, 150)], o.collar ? ramp(o.collar, 4) : PAL.cream, { cell: 4, len: 9, width: 3.4, angle: 0.4, seed: s + 31, lw: 3.5 });
};
const drawFront = (g, R, o, v) => { const k = Cl(o), s = 700; armPaint(g, R.Sn, R.eN, R.hN, k.top, k.skin, s); };
// 头：原点=颈根，朝右，头心约 (5,-63)，整体放大 1.12
const drawHead = (g, o, v) => {
  const k = Cl(o), s = 800, mood = o.mood || 'calm', hat = o.hat === undefined ? 'none' : o.hat, cx = 4, cy = -56;
  g.save(); g.scale(1.12, 1.12);
  K.paint(g, [[-14, 8], [16, 8], [14, -34], [-12, -34]], k.skin.slice(0, 3), { cell: 5, len: 10, width: 3.8, angle: 'vert', seed: s, lw: 4 });
  const hp = [[-34, 0], [-39, -22], [-27, -43], [-4, -53], [20, -51], [31, -37], [35, -21], [34, -9], [47, 8], [37, 14], [38, 21], [34, 29], [27, 41], [11, 47], [-10, 43], [-26, 28]].map(([x, y]) => [cx + x, cy + y]);
  K.paint(g, { pts: hp, smooth: true }, k.skin, { cell: 5, len: 11, width: 3.8, angle: 0.5, seed: s + 1, lw: 4.5, shade: [0.8, -0.5, 0.2] });
  K.paint(g, { e: [cx - 8, cy + 5, 6, 9] }, k.skin.slice(0, 2), { cell: 3, len: 6, width: 2.6, angle: 'swirl', seed: s + 2, lw: 3 });
  if (o.beard) { const bc = o.beard === true ? '#b8602a' : o.beard; K.paint(g, { pts: [[30, 22], [38, 34], [30, 52], [10, 58], [-14, 48], [-22, 26], [-6, 34], [12, 36], [26, 28]].map(([x, y]) => [cx + x, cy + y]), smooth: true }, ramp(bc, 4), { cell: 4, len: 10, width: 3.6, angle: 1.5, seed: s + 3, lw: 3.5 }); }
  if (hat === 'none' || hat === 'cap') K.paint(g, { pts: [[-38, 0], [-41, -26], [-24, -47], [-2, -57], [22, -53], [34, -35], [26, -26], [12, -37], [-8, -33], [-18, -12], [-22, 22], [-34, 22]].map(([x, y]) => [cx + x, cy + y]), smooth: true }, k.hair, { cell: 4, len: 10, width: 3.8, angle: 'swirl', seed: s + 4, lw: 4 });
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = C.ink; g.fillStyle = C.ink;
  if (mood !== 'none') {
    const ex = cx + 20, ey = cy - 12, my = cy + 30; g.lineWidth = 3.8;
    const brow = (a, dy = 0) => { g.beginPath(); g.moveTo(ex - 11, ey - 12 + dy + a * 7); g.lineTo(ex + 11, ey - 12 + dy - a * 7); g.stroke(); };
    if (mood === 'happy') { g.beginPath(); g.arc(ex, ey + 3, 7, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); brow(0.1, -2); }
    else if (mood === 'tired') { g.beginPath(); g.arc(ex, ey - 2, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); brow(-0.3, 2); }
    else if (mood === 'shock') { g.beginPath(); g.ellipse(ex, ey, 6.5, 8, 0, 0, TAU); g.stroke(); brow(0.4, -5); }
    else { g.beginPath(); g.ellipse(ex, ey, 6.2, mood === 'sad' ? 3.8 : 4.8, 0, 0, TAU); g.fill(); g.lineWidth = 3.2; g.beginPath(); g.moveTo(ex - 9, ey - (mood === 'sad' ? 1 : 5)); g.quadraticCurveTo(ex, ey - 8, ex + 9, ey - 3); g.stroke(); g.lineWidth = 3.8;
      if (mood === 'sad') brow(-0.42, 1); else if (mood === 'worry') brow(-0.5, -2); else if (mood === 'firm') brow(0.3, 1); else brow(0.04); }
    g.lineWidth = 3.8; g.beginPath();
    if (mood === 'happy') { g.arc(cx + 28, my - 6, 9, 0.2 * Math.PI, 0.95 * Math.PI); g.stroke(); }
    else if (mood === 'sad' || mood === 'worry') { g.arc(cx + 26, my + 8, 8, 1.15 * Math.PI, 1.9 * Math.PI); g.stroke(); }
    else if (mood === 'shock') { g.ellipse(cx + 28, my + 2, 5, 7, 0, 0, TAU); g.stroke(); }
    else if (mood === 'firm') { g.moveTo(cx + 20, my); g.lineTo(cx + 36, my - 1); g.stroke(); }
    else { g.moveTo(cx + 20, my - 1); g.quadraticCurveTo(cx + 28, my + 3, cx + 36, my - 1); g.stroke(); }
  }
  g.restore();
  const hc = o.hatCol || (hat === 'straw' ? '#ecc860' : hat === 'beret' ? '#2a3580' : '#3a3a58');
  if (hat === 'straw') {
    K.paint(g, { e: [cx - 2, cy - 36, 80, 15, -0.05] }, ramp(hc, 5).slice(1), { cell: 5, len: 14, width: 3.8, angle: 'horiz', seed: s + 6, lw: 4 });
    K.paint(g, { pts: [[-40, -34], [-40, -56], [-24, -76], [4, -82], [30, -76], [42, -56], [42, -34]].map(([x, y]) => [cx + x, cy + y]), smooth: true }, ramp(hc, 5).slice(1), { cell: 5, len: 12, width: 3.8, angle: 'vert', seed: s + 7, lw: 4 });
    K.paint(g, [cx - 41, cy - 52, 84, 16], ramp(o.band || '#2f50a8', 3), { cell: 4, len: 10, width: 3.4, angle: 'horiz', seed: s + 8, lw: 3.5 });
  } else if (hat === 'cap') {
    K.paint(g, { pts: [[-40, -24], [-38, -52], [-14, -68], [18, -64], [40, -44], [52, -30], [20, -34], [-8, -30]].map(([x, y]) => [cx + x, cy + y]), smooth: true }, ramp(hc, 5), { cell: 5, len: 12, width: 3.8, angle: 0.3, seed: s + 9, lw: 4.2 });
  } else if (hat === 'beret') {
    K.paint(g, { pts: [[-42, -34], [-34, -62], [-6, -72], [24, -66], [44, -44], [38, -32], [0, -40]].map(([x, y]) => [cx + x, cy + y]), smooth: true }, ramp(hc, 5), { cell: 5, len: 12, width: 3.8, angle: 'swirl', seed: s + 10, lw: 4.2 });
  }
  g.restore();
};
const qpose = (R) => JSON.stringify([R.sit, ...[R.hip, R.fN, R.fF, R.hN, R.hF].flat().map(n => rnd1(n, 4)), rnd1(R.lean * 100, 2), rnd1(R.ht * 100, 2)]);
K.person = (c, x, y, o = {}) => {
  const { s = 1, dir = 1, pose = 'stand', to = null, t = 0, react = -1e9, layer = 'all', alpha = 1, boil = 2 } = o, v = K.boilV(t, boil, 6);
  const o2 = { ...o, walkQ: Math.round((o.walk || 0) / (TAU / 12)) * (TAU / 12) };
  let R = solvePose(pose, o2); const mk = Math.round(clamp(o.mix || 0) * 8) / 8;
  if (to && mk > 0) R = mixRig(R, solvePose(to, o2), MO.cubicInOut(mk));
  const f = dir, toL = ([px, py]) => [(px - x) / s * f, (py - y) / s];            // 屏幕 → 局部
  const over = (H0, key) => { if (!o[key]) return; const tg = toL(o[key]).map(n => rnd1(n, 6)); const S = key === 'handN' ? R.Sn : R.Sf, a = ik(S, tg, L_UA, L_FA, 'arm'); if (key === 'handN') { R.hN = a.H; R.eN = a.E; } else { R.hF = a.H; R.eF = a.E; } };
  over(null, 'handN'); over(null, 'handF');
  const colK = JSON.stringify([o.top, o.pants, o.shoe, o.skin, o.hair, o.collar, o.beard, o.hat, o.hatCol, o.band, o.mood]);
  const br = 1 + 0.004 * Math.sin(t * 2.4), nod = K.damped(t, react, 0.14, 0.45, 0.4);
  const toS = ([px, py]) => [x + px * s * f, y + py * s * br];
  c.save(); if (alpha !== 1) c.globalAlpha *= alpha; c.translate(x, y); c.scale(s * f, s * br);
  const blit = (e, px, py, rot = 0) => { c.save(); c.translate(px, py); if (rot) c.rotate(rot); c.drawImage(e.cv, e.ox, e.oy); c.restore(); };
  if (layer !== 'front') {
    const bk = 'pb' + qpose(R) + colK, bx = rigBox([R.hip, R.nk, R.Sn, R.Sf, R.eF, R.hF, R.kN, R.kF, R.fN, R.fF], 70), eb = K.sprite(bk + JSON.stringify([rnd1(R.kN[0], 4), rnd1(R.kN[1], 4), rnd1(R.eF[0], 4), rnd1(R.eF[1], 4)]), bx, (g, vv) => drawBack(g, R, o, vv), v, 6); blit(eb, 0, 0);
    const eh = K.sprite('ph' + colK, [-90, -170, 100, 20], (g, vv) => drawHead(g, o, vv), v, 6);
    blit(eh, R.nk[0], R.nk[1], R.hr + nod * f);
  }
  if (layer !== 'back') {
    const fk = 'pf' + qpose(R) + colK + JSON.stringify([rnd1(R.eN[0], 4), rnd1(R.eN[1], 4)]), ef = K.sprite(fk, rigBox([R.Sn, R.eN, R.hN], 50), (g, vv) => drawFront(g, R, o, vv), v, 6); blit(ef, 0, 0);
  }
  c.restore();
  const hcS = toS([R.hc[0] + Math.sin(nod) * 4, R.hc[1]]);
  return { head: hcS, top: toS([R.hc[0], R.hc[1] - 70]), mouth: toS([R.hc[0] + 26, R.hc[1] + 30]), chest: toS(T(R, 10, 100)), hip: toS(R.hip), seat: toS([R.hip[0], R.hip[1] + 14]), handN: toS(R.hN), handF: toS(R.hF), feet: [x, y], elbowN: toS(R.eN) };
};
// 人群剪影：深靛蓝头肩剪影，灯光从一侧给赭金边；hi 序号数组 = 被灯照亮的几个（暖色）
K.crowd = (c, cx, y, o = {}) => { const { cols = 7, rows = 2, gap = 120, s = 1, seed = 3, hi = [], dim = 0, t = 0 } = o, key = 'crowd' + JSON.stringify({ cols, rows, gap, seed, hi }), w = cols * gap + 200, h = rows * gap * 0.7 + 260;
  const e = K.sprite(key, [-w / 2, -h, w / 2, 20], (g, v) => { const r = U.rng(seed * 77);
    for (let rw = rows - 1; rw >= 0; rw--) for (let i = 0; i < cols; i++) { const idx = rw * cols + i, k = 1 - rw * 0.12, px = (i - (cols - 1) / 2) * gap + (rw % 2) * gap * 0.4 + (r() - 0.5) * 18, py = -rw * gap * 0.62 + (r() - 0.5) * 10, sc = k * (0.9 + r() * 0.25), warm = hi.includes(idx), base = warm ? '#c8472f' : mixHex('#1c2458', '#2a3580', rw / Math.max(1, rows)), pal = ramp(base, 4);
      g.save(); g.translate(px, py); g.scale(sc, sc);
      K.paint(g, { pts: [[-54, 0], [-52, -36], [-36, -64], [-12, -72], [12, -72], [36, -64], [52, -36], [54, 0]], smooth: true }, pal, { cell: 6, len: 14, width: 4.4, angle: 'horiz', seed: 900 + idx, lw: 4 });
      K.paint(g, { e: [0, -104, 24, 29] }, warm ? ramp(C.skin, 4) : pal.slice(0, 3), { cell: 5, len: 11, width: 3.6, angle: 'swirl', seed: 901 + idx, lw: 4 }); g.restore(); } }, 0);
  K.blit(c, e, cx, y, { s }); if (dim) { /* 压暗交给调用方 */ } return { top: [cx, y - h * s] }; };

// ---------- 文字：奶黄字 + 深靛蓝描边，或深靛蓝/赭金牌子 ----------
// K.text(c, s, x, y, o)：o = { size 64, fam 'PuHui-Black', col 奶黄, stroke 深靛蓝, sw 描边宽(自动), align 'center', alpha, scale, track, maxW 超宽就整体缩小, rot, shadow true }
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.paper, stroke = C.ink, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, shadow = true } = o, sw = o.sw ?? Math.max(6, size * 0.15);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
  if (shadow && stroke) { c.fillStyle = c.strokeStyle = 'rgba(16,22,62,.55)'; c.lineWidth = sw; c.strokeText(s, 0, size * 0.07); c.fillText(s, 0, size * 0.07); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 牌子（笔触填充，缓存）：K.plate(c, s, x, y, o)  o = { size 52, fam 'PuHui-Heavy', fill 'ink'|'gold'|'red'|'cobalt'|'cream', col 字色, scale, alpha, rot, padX 0.8 }
const PLATE = { ink: [ramp('#1c2458', 5).slice(0, 4), C.paper], gold: [PAL.gold.slice(0, 4).concat(['#ffe680']), C.ink], red: [PAL.red, C.paper], cobalt: [ramp('#3a5fb4', 5), C.paper], cream: [PAL.paper, C.ink] };
K.plate = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = 'ink', scale = 1, alpha = 1, rot = 0, padX = 0.8 } = o, [pal, tcol] = PLATE[fill] || PLATE.ink;
  c.save(); c.font = `${size}px "${fam}"`; const tw = c.measureText(o.full || s).width; c.restore();
  const w = Math.ceil((tw + size * padX * 2) / 20) * 20, h = Math.ceil(size * 1.55 / 10) * 10;
  const e = K.sprite('plate' + fill + w + 'x' + h, [-w / 2 - 6, -h / 2 - 6, w / 2 + 12, h / 2 + 14], (g, v) => { g.fillStyle = 'rgba(16,22,62,.4)'; g.beginPath(); g.roundRect(-w / 2 + 4, -h / 2 + 9, w, h, 14); g.fill();
    K.paint(g, K.round(-w / 2, -h / 2, w, h, 14), pal, { box: [-w / 2, -h / 2, w / 2, h / 2], cell: 7, len: 20, width: 5, angle: 'horiz', seed: 70, lw: 5 }); }, 0, 10);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.drawImage(e.cv, e.ox, e.oy);
  c.font = `${size}px "${fam}"`; c.fillStyle = o.col || tcol; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
K.tag = K.plate;
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.plate(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a, fill: o.fill || 'gold' }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = 'gold', size = 50 } = o, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1);
  c.save(); c.lineCap = 'round'; c.strokeStyle = C.ink; c.lineWidth = 11; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = C.paper; c.lineWidth = 5; c.stroke();
  c.fillStyle = C.paper; c.strokeStyle = C.ink; c.lineWidth = 4; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const w = K.plate(c, '', bx, by, { size, fill, scale: q, padX: 0.8, full: s });
  c.save(); c.translate(bx, by); c.scale(q, q); c.font = `${size}px "PuHui-Heavy"`; c.fillStyle = fill === 'gold' || fill === 'cream' ? C.ink : C.paper; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20)), -w / 2 + size * 0.8, 3); c.restore(); };
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
// 收尾：字幕带压暗（保证字幕可读）。暗角已经烤进 K.bg 的缓存位图里（全屏实时画径向渐变要 14ms），所以 finish 很便宜
K.finish = c => { const b = c.createLinearGradient(0, 1340, 0, 1600); b.addColorStop(0, 'rgba(14,20,66,0)'); b.addColorStop(0.35, 'rgba(14,20,66,.32)'); b.addColorStop(0.7, 'rgba(14,20,66,.32)'); b.addColorStop(1, 'rgba(14,20,66,0)'); c.fillStyle = b; c.fillRect(0, 1340, W, 260); };
// 字幕：整宽半透明深靛蓝带（上下羽化）+ 奶黄字深靛蓝描边，字幕带 y≈1480，54px
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a;
  const b = c.createLinearGradient(0, 1408, 0, 1556); b.addColorStop(0, 'rgba(16,22,74,0)'); b.addColorStop(0.2, 'rgba(16,22,74,.78)'); b.addColorStop(0.8, 'rgba(16,22,74,.78)'); b.addColorStop(1, 'rgba(16,22,74,0)'); c.fillStyle = b; c.fillRect(0, 1408, W, 148);
  c.font = '54px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.strokeStyle = C.ink; c.lineWidth = 9; c.strokeText(text, 540, 1482, 1010); c.fillStyle = C.paper; c.fillText(text, 540, 1482, 1010); c.restore(); };

// ---------- 图示：箭头、柱、线、数字牌 ----------
// K.arrow(c, x0,y0, x1,y1, p, o)：笔触箭头，p 0..1 画出进度；o = { col 'gold'|'red'|'cream'|'cobalt', w 粗(18), bend 弯曲(0.15), head 箭头长(60), seed }
K.arrow = (c, x0, y0, x1, y1, p = 1, o = {}) => { if (p <= 0) return; const { w = 18, bend = 0.15, head = 60, seed = 3 } = o, pal = typeof (o.col || 'gold') === 'string' && PAL[o.col || 'gold'] ? PAL[o.col || 'gold'] : ramp(o.col, 5);
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * L * bend, my = (y0 + y1) / 2 + ny * L * bend, q = MO.cubicOut(clamp(p));
  const pt = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1], pts = []; const stop = 1 - head / L * 0.9;
  for (let i = 0; i <= 24; i++) pts.push(pt(Math.min(stop, i / 24 * q)));
  K.stroke(c, pts, pal, { width: w, seed, step: w * 0.7 });
  if (q > 0.97) { const a = pt(0.98), b = [x1, y1], th = Math.atan2(b[1] - pt(0.9)[1], b[0] - pt(0.9)[0]), hl = head, hw = head * 0.6;
    const tri = [[b[0], b[1]], [b[0] - Math.cos(th) * hl + Math.cos(th + 1.5708) * hw, b[1] - Math.sin(th) * hl + Math.sin(th + 1.5708) * hw], [b[0] - Math.cos(th) * hl * 0.7, b[1] - Math.sin(th) * hl * 0.7], [b[0] - Math.cos(th) * hl - Math.cos(th + 1.5708) * hw, b[1] - Math.sin(th) * hl - Math.sin(th + 1.5708) * hw]];
    c.save(); c.fillStyle = pal[Math.floor(pal.length * 0.7)]; c.strokeStyle = C.ink; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); tri.forEach((q2, i) => i ? c.lineTo(...q2) : c.moveTo(...q2)); c.closePath(); c.fill(); c.stroke(); c.restore(); } };
// 柱：K.bars(c, x,y,w,h, vals, p, o)  (x,y) 左上角，基线 y+h；p 0..1 逐根长出；o = { labels [], cols [], hi 序号, max, fmt (v)=>string, note '示意', size }
K.bars = (c, x, y, w, h, vals, p, o = {}) => { const { labels = [], cols = null, hi = -1, gapK = 0.45, size = 46, note = '示意' } = o, n = vals.length, bw = w / (n + (n - 1) * gapK), mx = o.max || Math.max(...vals, 1e-9);
  c.save(); c.strokeStyle = 'rgba(251,241,221,.5)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 20, y + h + 6); c.lineTo(x + w + 20, y + h + 6); c.stroke(); c.restore();
  vals.forEach((v, i) => { const bx = x + i * bw * (1 + gapK), pi = MO.backOut(clamp(p * (n + 1) - i, 0, 1), 1.2), bh = Math.max(0, h * v / mx * pi); if (bh < 2) return;
    const col = cols ? cols[i % cols.length] : (i === hi ? C.red : C.ochre), kk = 'bar' + col + Math.round(bw / 8) + 'x' + Math.round(h / 40);
    const e = K.sprite(kk, [0, 0, bw, h], (g, vv) => K.paint(g, [0, 0, bw, h], PAL[col] || ramp(col, 5), { cell: 7, len: 22, width: 5.2, angle: 'vert', seed: 60 + vv, lw: 0, edge: false }), 0, 4);
    c.save(); c.beginPath(); c.rect(bx - 6, y + h - bh, bw + 12, bh + 4); c.clip(); c.drawImage(e.cv, bx + e.ox, y + h - h + e.oy + 0); c.restore();
    c.save(); c.strokeStyle = C.ink; c.lineWidth = 5; c.lineJoin = 'round'; P.roughPath(c, [[bx, y + h], [bx, y + h - bh], [bx + bw, y + h - bh], [bx + bw, y + h]], { amp: 2, seed: 11 + i, closed: false, step: 14 }); c.stroke(); c.restore();
    if (o.fmt !== false && pi > 0.9) K.text(c, o.fmt ? o.fmt(v) : String(v), bx + bw / 2, y + h - bh - 38, { size, fam: 'PuHui-Black', alpha: clamp((pi - 0.9) * 10) });
    if (labels[i]) K.text(c, labels[i], bx + bw / 2, y + h + 56, { size: Math.max(44, size - 2), fam: 'PuHui-Heavy', maxW: bw * 1.5 + 30 }); });
  if (note) K.text(c, note, x + w, y - 34, { size: 44, fam: 'PuHui-Heavy', col: C.cream, align: 'right', stroke: C.ink }); };
// 折线：K.line(c, x,y,w,h, vals, p, o)；o = { col, min, max, labels:[首,尾], note, dots true }；返回最后一点
K.line = (c, x, y, w, h, vals, p, o = {}) => { const n = vals.length, mn = o.min ?? Math.min(...vals), mxv = o.max ?? Math.max(...vals), pts = vals.map((v, i) => [x + w * i / (n - 1), y + h - h * (v - mn) / ((mxv - mn) || 1)]);
  c.save(); c.strokeStyle = 'rgba(251,241,221,.5)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 20, y + h + 10); c.lineTo(x + w + 20, y + h + 10); c.moveTo(x - 20, y + h + 10); c.lineTo(x - 20, y - 20); c.stroke(); c.restore();
  const q = MO.cubicInOut(clamp(p)) * (n - 1), seg = Math.floor(q), part = q - seg, draw = []; for (let i = 0; i <= Math.min(seg, n - 1); i++) draw.push(pts[i]); if (seg < n - 1) draw.push(lerp2(pts[seg], pts[seg + 1], part));
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = C.ink; c.lineWidth = 22; c.beginPath(); draw.forEach((a, i) => i ? c.lineTo(...a) : c.moveTo(...a)); c.stroke();
  c.strokeStyle = o.col || C.ochreL; c.lineWidth = 12; c.stroke();
  if (o.dots !== false) draw.forEach((a, i) => { if (i === draw.length - 1 && part > 0 && part < 1) return; c.fillStyle = C.paper; c.beginPath(); c.arc(a[0], a[1], 15, 0, TAU); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 5; c.stroke(); }); c.restore();
  if (o.labels) { K.text(c, o.labels[0], x, y + h + 62, { size: 44, fam: 'PuHui-Heavy' }); K.text(c, o.labels[1], x + w, y + h + 62, { size: 44, fam: 'PuHui-Heavy' }); }
  if (o.note !== false) K.text(c, o.note || '示意', x + w, y - 44, { size: 44, fam: 'PuHui-Heavy', col: C.cream, align: 'right' });
  return draw[draw.length - 1]; };
// 数字牌：K.num(c, '70%', x, y, lt, at, o)  大数字金牌（带弹出），o = { size 120, fill 'gold'|'red'|'ink'… }
K.num = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, 0.5); if (p <= 0) return; K.plate(c, s, x, y, { size: 120, fam: 'PuHui-Black', fill: 'gold', padX: 0.5, ...o, scale: p * (o.scale || 1), alpha: clamp(p * 2) }); };

// ---------- 章节卡 ----------
K.CARD_TINTS = [null, ['#2a8a88', 0.4], null, ['#d8806a', 0.25]];
K.CARD_DAWN_LAST = true;                                                // 最后一章的章节卡天色转黄（黎明）；不想要就设 false
K.cardToken = K.cardToken || ((c, x, y, lt, t, moving, arriveAt) => { const r = 24 + 3 * Math.sin(t * 6); K.glow(c, x, y, 90, 0.7);
  c.save(); c.translate(x, y); c.rotate(t * 0.8); c.fillStyle = C.gold; c.strokeStyle = C.ink; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? r * 0.5 : r * 1.25; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); });
K.chapterCard = (c, lt, t, n, title = '') => {
  K.bg(c, t, { preset: 'night', horizon: H, floor: false, lamp: [W / 2, 400], seed: (n % 3) + 1, cypress: n % 2 ? 'right' : 'left', chaos: 0.12, dawn: K.CARD_DAWN_LAST && n === Math.max(K.CHAPTER_NAMES.length, n) && n > 2 ? 0.4 : 0, tint: K.CARD_TINTS[(n - 1) % K.CARD_TINTS.length] || undefined });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, y = 1210, X = i => lerp(x0, x1, i / (N - 1));
  const walkEnd = 1.15, q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), cur = lerp(n > 1 ? X(n - 2) : x0, done, q);
  c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(16,22,74,.7)'; c.lineWidth = 16; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  c.strokeStyle = 'rgba(143,179,236,.7)'; c.lineWidth = 8; c.setLineDash([16, 14]); c.beginPath(); c.moveTo(cur, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
  c.strokeStyle = C.ochreL; c.lineWidth = 10; c.beginPath(); c.moveTo(x0, y); c.lineTo(cur, y); c.stroke(); c.restore();
  for (let i = 0; i < N; i++) { const isCur = i === n - 1, past = i < n - 1, pp = isCur ? K.pop(lt, walkEnd, 0.45) : 1; if (isCur) { if (lt > walkEnd * 0.9) { K.glow(c, X(i), y, 110, 0.6); K.star(c, X(i), y, 26 * Math.max(0.6, pp), t, i); } }
    else K.star(c, X(i), y, past ? 15 : 10, t, i, past ? C.gold : '#8fb6ee'); }
  K.cardToken(c, cur, y - 8, lt, t, lt < walkEnd, walkEnd);
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); K.plate(c, `第 ${n} 章`, W / 2, 560, { size: 62, fam: 'PuHui-Black', fill: 'gold', scale: s }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 96 : all > 6 ? 112 : 132;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K.text(c, a.slice(0, k).join(''), W / 2, (lines.length > 1 ? 740 : 800) + i * size * 1.28, { size, fam: 'PuHui-Black', maxW: 940 }); });
  K.finish(c); };
})();
