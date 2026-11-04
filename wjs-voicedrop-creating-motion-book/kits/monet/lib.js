// 画风套件 monet（配方 huashu-art-motion 28_monet「莫奈印象派」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K 或直接用 K）。
// ================================ 规矩（章节 agent 必读） ================================
// 1. 色板暖冷对照：暖＝奶油沙金天光/玫瑰灰粉/沙黄岩；冷＝青绿海水/阴面灰紫。数据高光统一一个暖金 K.C.gold（#E8B04A），别的颜色不当数据色。
//    字色深紫褐 K.C.ink（#3A2A4A），带奶白光晕。不用蓝紫渐变底（夜景 tint:'night' 是深青靛海天，不是蓝紫霓虹）。
// 2. 色彩阴影：阴面用灰紫/冷青，不用黑；受光面用暖金。全片统一光向：光从右（东）来，岩石北面崖（左端）在阴影里。
// 3. 笔触只做「底」：天、海、岩、岸、远山都是缓存好的静态笔触层（K.once，按 tint/尺寸缓存，只建一次），逐帧只动水面光斑、海面横向漂、太阳光晕。
//    ★ 不要在 draw 里自己调 PAINT.strokes（整屏 getImageData 每帧几百毫秒）；要新笔触块用 K.strokeFill(c, 区域, {key:'唯一名',…})，必须给 key 才缓存。
// 4. 信息层要干净：数字、条约、百分比、隧道图例一律用 K.mapCard（奶白卡片）＋K.bigNum/K.bars/K.timeline 的扁平色块＋清晰字，别把图表画成笔触。
// 5. 战争/封锁章：整章 K.bg 传 tint:'grey' 或 {sat:0.55}（降饱和），别用暖粉天；夜景（隧道）用 tint:'night'。
// 6. 人只画剪影（K.person：披风/军帽/长袍/军人），不画脸；动物只画 K.monkey 剪影。
// 7. 字：PuHui-Black/Heavy/Bold（引擎自带，GB2312）。屏上字号 ≥52px（K.text 小于 44 会警告）；字幕带 y1380–1560 不放字和关键图形。
// 8. 确定性：所有随机走 U.hash / U.rng；同一 t 两帧逐像素一致；不要用 Math.random。
// ======================================================================================
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：回弹/outBack 起步段会把半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__monet) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__monet = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__monet) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__monet = 1; } }
const warns = {}; const warnOnce = (k, msg) => { if (!warns[k]) { warns[k] = 1; console.warn('[monet] ' + msg); } };

// ---------- 颜色工具 ----------
const hx = h => { if (Array.isArray(h)) return h; h = h.replace('#', ''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbs = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hexs = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => { a = hx(a); b = hx(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
K.mix = (a, b, t) => hexs(mixc(a, b, t));
const desat = (h, k) => { const c = hx(h), g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return hexs([lerp(g * 0.96, c[0], k), lerp(g, c[1], k), lerp(g * 1.04, c[2], k)]); };
const sampleRamp = (ramp, v) => { v = clamp(v); const f = v * (ramp.length - 1), i = Math.min(ramp.length - 2, f | 0), q = f - i; const a = ramp[i], b = ramp[Math.min(ramp.length - 1, i + 1)]; return [lerp(a[0], b[0], q), lerp(a[1], b[1], q), lerp(a[2], b[2], q)]; };

// ---------- 色板 ----------
const C = K.C = {
  cream: '#FBF3E2', sand: '#F2D9B0', rose: '#E8B8A8', rock: '#D8B878', ochre: '#B8946C',
  teal: '#3E8C98', deep: '#2F6E82', violet: '#8E6FA8', ink: '#3A2A4A', gold: '#E8B04A', brick: '#B5524A', scrub: '#7F9A5A', night: '#14233C',
};
C.war = { ...C, cream: '#EFE9DC', sand: '#D9CDB4', rose: '#C9B2A8', rock: '#BDA982', teal: '#5E8A90', deep: '#4A6C78', violet: '#7E7390', gold: '#C9A04E', brick: '#8E5148' };
K.pal = o => (o === true || (o && o.war)) ? C.war : C;

// ---------- 色调 tint：dawn 晨光 | noon 正午 | dusk 黄昏 | night 夜（深青靛）| grey 阴天/战争（降饱和） ----------
const TINTS = {
  dawn: { sky: ['#a9cfd6', '#d6dcd0', '#f1d6c0', '#f8e2b8'], sea: ['#f2d8b4', '#a9cdc4', '#58a0a2', '#3b7f8e', '#2d6678'], acc: ['#fbe0d0', '#f2c8b0', '#d89aa0'],
    lit: ['#f8ecc8', '#e8c88a', '#d8b878', '#c09a68'], shade: ['#a89ab8', '#8E6FA8', '#7a6a98'], scrub: ['#98ae66', '#7f9a5a', '#6a8a5a'], land: ['#e0c690', '#d8b682', '#a9b070', '#98ae66'],
    far: ['#cfdcd4', '#b8c8c8', '#a0b8b4'], cloud: ['#fff2d8', '#f8c8be', '#fbe4cc'], sun: ['#fffbe0', '#fff0c0', '#ffe4b0'], glow: [255, 226, 160], glint: ['#fffbe8', '#fdf0d0', '#fbe0d0', '#eaf6f0'],
    hull: '#4a3a3c', sail: '#fbf2dc', sailSh: '#f0c8b0', sun0: 0.9, band: [40, 70, 90] },
  noon: { sky: ['#8fc4d4', '#b8dce0', '#e6ecd8', '#f6edd0'], sea: ['#cde6d8', '#86c4b4', '#3e8c98', '#2f7488', '#2a6478'], acc: ['#e8f4ee', '#b8e0d4', '#f2e4b8'],
    lit: ['#faf0c8', '#ecd490', '#dcc080', '#c8a470'], shade: ['#9a92b8', '#8E6FA8', '#7a70a0'], scrub: ['#98b468', '#7f9a5a', '#6a8e5c'], land: ['#e4cc94', '#d8be84', '#a8b672', '#98b068'],
    far: ['#c8dcd8', '#a8c8c4', '#8cb4b0'], cloud: ['#ffffff', '#fff6e0', '#eef4f0'], sun: ['#ffffff', '#fffbe8', '#fff4cc'], glow: [255, 244, 200], glint: ['#ffffff', '#fffbe8', '#f4fbf4', '#e8f6ee'],
    hull: '#4a3a3c', sail: '#fffaee', sailSh: '#e8dcd0', sun0: 0.4, band: [30, 78, 96] },
  dusk: { sky: ['#a8b0b8', '#d8b0a0', '#f0a880', '#f8d090'], sea: ['#f4c098', '#d09494', '#6a8e98', '#3c6a80', '#2c5468'], acc: ['#f8c890', '#e89a88', '#fbe0b0'],
    lit: ['#fbd898', '#ecb070', '#d8955c', '#b87a58'], shade: ['#a07890', '#8a6684', '#74607e'], scrub: ['#8a9a5c', '#708a58', '#5c7a56'], land: ['#e0b070', '#c89a68', '#8f9a62', '#7a8c5c'],
    far: ['#d0b0a0', '#b89aa0', '#9a8c98'], cloud: ['#fbd8b0', '#f0a890', '#f8e6c4'], sun: ['#fff0c0', '#ffd890', '#ffc078'], glow: [255, 190, 120], glint: ['#fff0c8', '#ffd8a0', '#fbc0a0', '#fbe8d0'],
    hull: '#3e2e3a', sail: '#f6dcc0', sailSh: '#d89a90', sun0: 1.0, band: [60, 50, 70] },
  night: { sky: ['#14233c', '#1c3550', '#285066', '#3c6c7c'], sea: ['#4f8a92', '#2d5e72', '#1f4560', '#173650', '#12293f'], acc: ['#8fc0c8', '#cfe6ea', '#5a8ea4'],
    lit: ['#a8bccc', '#8aa4b8', '#6f8ca2', '#587490'], shade: ['#34466a', '#2c3a5c', '#243350'], scrub: ['#3e5a5c', '#34504e', '#2c4448'], land: ['#4a6470', '#3e5864', '#34505a', '#2c4450'],
    far: ['#3a5468', '#2e4860', '#26405a'], cloud: ['#4c6a7c', '#3a566a', '#5a7888'], sun: ['#fffff0', '#eef4e0', '#dce8e8'], glow: [190, 220, 230], glint: ['#e8f4f0', '#cfe6ea', '#f2f0d8', '#b8d8e0'],
    hull: '#0e1830', sail: '#9fb4c4', sailSh: '#6a84a0', sun0: 0.55, band: [8, 16, 34] },
  grey: { sky: ['#a6b0b4', '#bcc4c4', '#d0d2ca', '#dcd8cc'], sea: ['#cfd0c4', '#94a8a8', '#667f86', '#4d6670', '#3e5560'], acc: ['#dcdcd0', '#b4c0c0', '#9a8c94'],
    lit: ['#d0c8b0', '#bcb49c', '#a8a08c', '#948c7c'], shade: ['#8a8498', '#767080', '#646070'], scrub: ['#7a8a70', '#6a7a64', '#5c6c5c'], land: ['#bcb496', '#a8a288', '#8c9078', '#7c8470'],
    far: ['#b4bcba', '#9eaaaa', '#8a9898'], cloud: ['#e4e4dc', '#c8ccc8', '#b4bcbc'], sun: ['#f2f0e4', '#e8e6d8', '#dcdacc'], glow: [236, 232, 214], glint: ['#f2f2ea', '#e0e4e0', '#d0d8d6'],
    hull: '#3a3640', sail: '#e6e0d2', sailSh: '#b8b0a8', sun0: 0.18, band: [34, 52, 60] },
};
const TCACHE = {};
// K.tint(name, sat)：取色调对象（sky/sea/lit/shade/land/far/cloud/glint 色组、hull/sail…）；sat<1 整体降饱和（战争/封锁章用 0.5-0.7）
K.tint = (name = 'dawn', sat = 1) => { const key = name + '|' + sat; if (TCACHE[key]) return TCACHE[key]; const b = TINTS[name]; if (!b) throw new Error('K.tint：没有 ' + name + '（dawn|noon|dusk|night|grey）');
  const out = { name, sat }; for (const k in b) { const v = b[k]; out[k] = sat >= 1 || typeof v === 'number' || k === 'glow' || k === 'band' ? v : Array.isArray(v) ? v.map(h => desat(h, sat)) : desat(v, sat); } return TCACHE[key] = out; };
const tintOf = o => K.tint((o && o.tint) || 'dawn', o && o.sat != null ? o.sat : 1);
const tkey = o => ((o && o.tint) || 'dawn') + (o && o.sat != null && o.sat < 1 ? '@' + o.sat : '');

// ---------- 进度 / 缓存 / 相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
K.jit = (lt, seed = 1, amp = 3) => (U.hash(Math.floor(lt * 12), seed) - 0.5) * 2 * amp;

// ---------- 基础：路径 ----------
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
// 不规则折线（岩/岸的毛边）：每 ~step px 一个点，随机偏移 amp
K.jag = (pts, amp = 6, seed = 1, step = 16) => { const r = U.rng(seed), out = [];
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) { const q = k / n; out.push([x0 + (x1 - x0) * q + (r() - .5) * amp, y0 + (y1 - y0) * q + (r() - .5) * amp]); } }
  out.push(pts[pts.length - 1]); return out; };
const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h); return cv; };

// ================================ 笔触核心 ================================
// K.strokeFill(c, region, o)：在区域里撒短笔触，颜色沿 ramp 渐变（印象派色块）。
//   region：点数组 [[x,y],…]（闭合多边形）｜{path:Path2D, bbox:[x0,y0,x1,y1]}｜{ellipse:[cx,cy,rx,ry]}（软边，云用）
//   o：key（★给了就整块缓存成离屏图，之后每帧只 drawImage；不给则每次现画，只能画极小块）｜ramp:[hex…]（沿 dir 渐变）｜dir:[dx,dy]（默认[0,1]自上而下）｜field(x,y)→0..1（覆盖 dir）
//      angle（弧度或 (x,y)=>弧度，默认 0 横笔）｜cell 9｜len 28｜width 6｜seed｜jit 颜色抖动 10｜spread 色阶散布 0.12｜nz 噪声 0.1｜alpha｜size(y)→笔触放大倍数（近大远小）
//      under 先铺一遍大笔盖缝（默认 true）｜accent:{cols:[hex…],p:0.07} 偶发点缀色笔｜mask(x,y) 只在返回 true 处落笔
function paintStrokes(g, bb, o) {
  const [x0, y0, x1, y1] = bb, ramp = (o.ramp || ['#888888']).map(hx), cell = o.cell || 9, len0 = o.len || 28, wid0 = o.width || 6, jit = o.jit != null ? o.jit : 10, spread = o.spread != null ? o.spread : 0.12, nz = o.nz != null ? o.nz : 0.1;
  const dir = o.dir || [0, 1], corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(q => q[0] * dir[0] + q[1] * dir[1]), pmin = Math.min(...corners), pext = Math.max(1, Math.max(...corners) - pmin);
  const field = o.field || ((x, y) => (x * dir[0] + y * dir[1] - pmin) / pext), ang = typeof o.angle === 'function' ? o.angle : () => o.angle || 0, sz = o.size || (() => 1);
  const acc = o.accent ? o.accent.cols.map(hx) : null, E = o.ellipse, mask = o.mask;
  g.lineCap = 'round'; if (o.alpha != null) g.globalAlpha = o.alpha;
  const passes = o.under === false ? [1] : [1.6, 1];
  passes.forEach((pk, pi) => {
    const r = U.rng((o.seed || 1) * 7919 + pi * 131 + 17);
    for (let y = y0 - cell; y < y1 + cell; y += cell * pk * sz(y)) { const k = sz(y); for (let x = x0 - cell; x < x1 + cell; x += cell * pk * k) {
      const px = x + (r() - .5) * cell * pk * k, py = y + (r() - .5) * cell * pk * k;
      if (E) { const d = Math.hypot((px - E[0]) / E[2], (py - E[1]) / E[3]); if (d > 1.15 || r() > clamp(2.2 * (1.12 - d))) continue; }
      if (mask && !mask(px, py)) continue;
      const v = field(px, py) + (r() - .5) * spread + nz * P.noise(px * 0.011, py * 0.013);
      let col = sampleRamp(ramp, v);
      if (acc && r() < o.accent.p) col = acc[(r() * acc.length) | 0];
      const j = (r() - .5) * jit, a = ang(px, py) + (r() - .5) * 0.18, l = len0 * k * pk * (0.7 + r() * 0.6) / 2, w = wid0 * k * pk * (0.85 + r() * 0.3);
      g.strokeStyle = `rgb(${clamp(col[0] + j, 0, 255) | 0},${clamp(col[1] + j * 0.8, 0, 255) | 0},${clamp(col[2] + j * 0.6, 0, 255) | 0})`; g.lineWidth = w;
      const dx = Math.cos(a) * l, dy = Math.sin(a) * l; g.beginPath(); g.moveTo(px - dx, py - dy); g.lineTo(px + dx, py + dy); g.stroke(); } }
  });
}
const regionBox = region => {
  if (Array.isArray(region)) { let a = 1e9, b = 1e9, c2 = -1e9, d = -1e9; region.forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c2 = Math.max(c2, x); d = Math.max(d, y); }); return [a - 4, b - 4, c2 + 4, d + 4]; }
  if (region.ellipse) { const [cx, cy, rx, ry] = region.ellipse; return [cx - rx, cy - ry, cx + rx, cy + ry]; }
  return region.bbox;
};
K.strokeFill = (c, region, o = {}) => {
  const bb = regionBox(region), pad = 12, bx = Math.floor(bb[0]) - pad, by = Math.floor(bb[1]) - pad, bw = Math.ceil(bb[2] - bb[0]) + pad * 2, bh = Math.ceil(bb[3] - bb[1]) + pad * 2;
  const draw = (g, ox, oy) => { g.save(); g.translate(-ox, -oy);
    const oo = region.ellipse ? { ...o, ellipse: region.ellipse } : o;
    if (!region.ellipse) g.clip(Array.isArray(region) ? K.poly(region) : region.path);
    paintStrokes(g, bb, oo); g.restore(); };
  if (!o.key) { warnOnce('nokey', 'K.strokeFill 没给 key，每帧现画很慢；静态块请给唯一 key'); c.save(); draw(c, 0, 0); c.restore(); return; }
  const cv = K.once('sf:' + o.key, () => { const cc = mkCanvas(bw, bh); draw(cc.getContext('2d'), bx, by); return cc; });
  c.drawImage(cv, bx, by);
};

// ---------- 天 / 海 / 底 ----------
const CLOUDS = [[170, 0.2, 230, 34], [610, 0.14, 260, 30], [900, 0.3, 210, 28], [330, 0.42, 280, 26], [780, 0.55, 240, 22], [120, 0.62, 200, 20]];
K.sky = (c, t, o = {}) => {
  const T = tintOf(o), hz = o.hz || 640, key = `sky:${tkey(o)}:${hz}`;
  const cv = K.once(key, () => { const cc = mkCanvas(W, hz + 6), g = cc.getContext('2d');
    g.fillStyle = rgbs(hx(T.sky[0])); g.fillRect(0, 0, W, hz + 6);
    const hzc = Math.min(hz, 900);
    paintStrokes(g, [0, 0, W, hz + 6], { ramp: T.sky, cell: 11, len: 56, width: 9, angle: (x, y) => -0.1 + 0.1 * P.noise(x * 0.008, y * 0.02), seed: 31, jit: 8, spread: 0.1, nz: 0.12, field: (x, y) => y / (hz * 0.98) });
    const heavy = T.name === 'grey' ? 1.5 : 1, n = T.name === 'night' ? 3 : CLOUDS.length, sk = hzc / 640;
    for (let i = 0; i < n; i++) { const [cx, fy, rx, ry] = CLOUDS[i], cy = fy * hzc; paintStrokes(g, [cx - rx, cy - ry, cx + rx, cy + ry], { ellipse: [cx, cy, rx * heavy, ry * heavy], ramp: [T.cloud[(i + 1) % 3], T.cloud[i % 3], T.cloud[(i + 2) % 3]], cell: 8, len: 44, width: 7, angle: -0.04, seed: 40 + i, jit: 10, spread: 0.3, nz: 0.1, under: false, alpha: 0.88, field: (x, y) => 0.5 + 0.4 * P.noise(x * 0.02, y * 0.03) }); }
    if (T.name === 'night') { const r = U.rng(909); g.fillStyle = '#f2f0d8'; for (let i = 0; i < 46; i++) { g.globalAlpha = 0.35 + r() * 0.6; g.beginPath(); g.ellipse(r() * W, r() * hzc * 0.7, 2 + r() * 2.4, 1.6 + r() * 1.4, r() * 3, 0, TAU); g.fill(); } g.globalAlpha = 1; }
    return cc; });
  c.drawImage(cv, 0, 0);
};
const SEA_PAD = 28;
K.sea = (c, t, o = {}) => {
  const T = tintOf(o), hz = o.hz || 640, key = `sea:${tkey(o)}:${hz}`, hs = H - hz + 4;
  const cv = K.once(key, () => { const cc = mkCanvas(W + SEA_PAD * 2, hs), g = cc.getContext('2d'); g.translate(SEA_PAD, -hz);
    g.fillStyle = rgbs(hx(T.sea[1])); g.fillRect(-SEA_PAD, hz, W + SEA_PAD * 2, hs);
    const sz = y => 0.55 + 1.35 * clamp((y - hz) / (H - hz));
    paintStrokes(g, [-SEA_PAD, hz, W + SEA_PAD, H + 4], { ramp: T.sea, cell: 8, len: 30, width: 5, angle: (x, y) => 0.05 * Math.sin(x * 0.02 + y * 0.03) + 0.04 * P.noise(x * 0.01, y * 0.02), seed: 33, jit: 12, spread: 0.1, nz: 0.1, size: sz,
      field: (x, y) => Math.pow(clamp((y - hz) / (H - hz)), 0.7), accent: { cols: T.acc, p: 0.03 } });
    return cc; });
  // 横向分带漂移：越近越大幅，水面「呼吸」；整张是缓存图，每帧 ~28 次 drawImage
  const bands = 28, sh = hs / bands;
  for (let i = 0; i < bands; i++) { const y = i * sh, depth = i / bands, dx = Math.sin(t * 0.7 + i * 0.9) * (0.8 + depth * 4.2) + Math.sin(t * 0.31 + i * 1.7) * 1.4;
    c.drawImage(cv, 0, y, cv.width, sh + 1.2, -SEA_PAD + dx, hz + y, cv.width, sh + 1.2); }
};
// 太阳/月亮：现画，不进缓存。pos=[x,y]
K.sun = (c, t, T, pos, o = {}) => {
  if (!pos) return; const [sx, sy] = pos, k = o.r || 50;
  c.save(); c.globalCompositeOperation = 'lighter'; const g = T.glow, a0 = T.sun0 * (o.glow != null ? o.glow : 1);
  const rg = c.createRadialGradient(sx, sy, 6, sx, sy, 360); rg.addColorStop(0, `rgba(${g},${0.7 * a0})`); rg.addColorStop(0.25, `rgba(${g},${0.28 * a0})`); rg.addColorStop(1, `rgba(${g},0)`); c.fillStyle = rg; c.fillRect(sx - 360, sy - 360, 720, 720);
  c.restore();
  if (T.name === 'grey' && !o.force) return;
  c.save(); const cols = T.sun.map(hx), dg = c.createRadialGradient(sx, sy, 2, sx, sy, k * 1.15); dg.addColorStop(0, rgbs(cols[0])); dg.addColorStop(0.7, rgbs(cols[1])); dg.addColorStop(1, rgbs(cols[2], 0.0)); c.fillStyle = dg; c.beginPath(); c.arc(sx, sy, k * 1.2, 0, TAU); c.fill();
  c.lineCap = 'round'; const sr = U.rng(77); for (let i = 0; i < 30; i++) { const a = sr() * TAU, d = Math.sqrt(sr()) * k * 0.95; c.strokeStyle = rgbs(cols[i % 3]); c.lineWidth = 7; c.globalAlpha = 0.6;
    c.beginPath(); c.moveTo(sx + Math.cos(a) * d - 12, sy + Math.sin(a) * d * 0.85); c.lineTo(sx + Math.cos(a) * d + 12, sy + Math.sin(a) * d * 0.85 + 1); c.stroke(); } c.restore();
};
// 水面光斑：亮色短笔 10fps 横向跳动；o.x 为日光路中心 x
K.glints = (c, t, o = {}) => {
  const T = tintOf(o), hz = o.hz || 640, cx = o.x != null ? o.x : 680, n = o.n || (T.name === 'grey' ? 90 : 260), st = Math.floor(t * 10), cols = T.glint.map(hx), gain = o.gain != null ? o.gain : T.name === 'grey' ? 0.55 : 1;
  c.save(); c.lineCap = 'round'; const span = H - hz;
  for (let i = 0; i < n; i++) { const r = U.rng(i * 29 + 5), q = r(), y = hz + 10 + q * q * span * 0.62, spread = 30 + (y - hz) * 0.2, x = cx + (r() - .5) * 2 * spread - (y - hz) * 0.05;
    const a = clamp(Math.sin(t * (4 + r() * 7) + r() * TAU) * Math.sin(2.1 * t + i) + 0.15, 0, 1) * Math.pow(1 - (y - hz) / (span * 0.7), 1.5) * gain; if (a < 0.1) continue;
    const jx = (U.hash(i, st) - .5) * 12, len = 10 + (y - hz) * 0.05 + r() * 18;
    c.globalAlpha = a; c.strokeStyle = rgbs(cols[i % cols.length]); c.lineWidth = 3.5 + (y - hz) / 140 + r() * 2;
    c.beginPath(); c.moveTo(x + jx, y); c.lineTo(x + jx + len, y + (r() - .5) * 2); c.stroke(); }
  c.restore();
};
// K.bg(c,t,o)：天＋海＋日/月＋光斑。o {tint, sat, hz（地平线 y，默认 640）, sea（false＝天铺满全屏，信息卡/地图底用）, sun:[x,y]|false, glow, glints（false 关）, sunR}
K.bg = (c, t, o = {}) => {
  K._t = t; const T = tintOf(o), hz = o.sea === false ? H : (o.hz || 640), oo = { ...o, hz };
  K.sky(c, t, oo);
  if (o.sea === false) { if (o.sun) K.sun(c, t, T, o.sun, { glow: o.glow, r: o.sunR }); return; }
  K.sea(c, t, oo);
  const sun = o.sun === false ? null : o.sun || [690, hz - 200];
  if (sun) { K.sun(c, t, T, sun, { glow: o.glow, r: o.sunR }); }
  if (o.glints !== false) K.glints(c, t, { ...oo, x: sun ? sun[0] : 680 });
};

// ---------- 远岸（非洲穆萨山）/ 前景岸线 ----------
// K.far(c,t,o)：地平线上的远山，雾色。o {tint, hz, kind:'africa'|'ridge', x（山脚左端，默认 650）, alpha}
K.far = (c, t, o = {}) => {
  const T = tintOf(o), hz = o.hz || 640, kind = o.kind || 'africa', x0 = o.x != null ? o.x : 650, key = `far:${tkey(o)}:${kind}`;
  const prof = kind === 'africa' ? [[0, 0], [40, 14], [85, 46], [130, 86], [175, 126], [215, 142], [252, 124], [290, 100], [330, 74], [380, 52], [430, 34], [470, 20], [520, 8], [560, 0]]
    : [[0, 0], [70, 18], [150, 34], [260, 24], [370, 46], [470, 30], [560, 14], [640, 6], [680, 0]];
  const cv = K.once(key, () => { const wmax = prof[prof.length - 1][0], hmax = Math.max(...prof.map(p => p[1])) + 12, cc = mkCanvas(wmax + 40, hmax + 24), g = cc.getContext('2d'), base = hmax + 12;
    const pts = K.jag(prof.map(([x, y]) => [x + 20, base - y]), 4, 21, 14); pts.unshift([0, base + 8]); pts.push([wmax + 40, base + 8]);
    g.save(); g.clip(K.poly(pts)); paintStrokes(g, [0, 0, wmax + 40, base + 10], { ramp: T.far, cell: 6, len: 20, width: 4.6, angle: (x, y) => -0.5 + 0.6 * P.noise(x * 0.02, y * 0.02), seed: 41, jit: 12, spread: 0.12, field: (x, y) => 0.1 + 0.8 * (y / base) }); g.restore();
    cc._base = base; return cc; });
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.drawImage(cv, x0 - 20, hz + 3 - cv._base); c.restore();
};
// K.land(c,t,pts,o)：前景岸（闭合多边形，沿岸毛边）。o {tint, key（缺省按点集自动）, foam: [[x,y]…]（浪沫线）, seed, ramp, dir}
K.land = (c, t, pts, o = {}) => {
  const T = tintOf(o), kk = o.key || pts.map(p => Math.round(p[0]) + ',' + Math.round(p[1])).join(';'), key = `land:${tkey(o)}:${kk}`, rpts = K.jag(pts, 8, o.seed || 31);
  K.strokeFill(c, rpts, { key, ramp: o.ramp || T.land, cell: 7, len: 24, width: 5.4, angle: (x, y) => 0.22 * (x < W / 2 ? -1 : 1) + 0.2 * P.noise(x * 0.02, y * 0.02), seed: o.seed || 43, jit: 14, spread: 0.2, nz: 0.2, dir: o.dir || [0.25, 1], accent: { cols: T.scrub, p: 0.1 } });
  if (o.foam) { const fk = `foam:${key}`, bb = regionBox(o.foam), pad = 14, fw = Math.ceil(bb[2] - bb[0]) + pad * 2, fh = Math.ceil(bb[3] - bb[1]) + pad * 2;
    const cv = K.once(fk, () => { const cc = mkCanvas(fw, fh), g = cc.getContext('2d'); g.translate(pad - bb[0], pad - bb[1]); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#f6f0dc'; g.lineWidth = 6; g.beginPath();
      K.jag(o.foam, 6, 51).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); return cc; });
    c.save(); c.globalAlpha = 0.9; c.drawImage(cv, bb[0] - pad + Math.sin((t || 0) * 0.9) * 3, bb[1] - pad); c.restore(); }
};

// ================================ 直布罗陀巨岩 ================================
// 真实轮廓（侧视，u 自北向南，h 0..1 高度）：北端低地（机场地峡）→ 北面近垂直断崖 → 顶部窄脊（Rock Gun 最高）→ 长脊分阶下降 → 南端欧罗巴角低缓台地（灯塔）。
const ROCK_PROF = [[-0.03, 0], [0.0, 0.015], [0.02, 0.06], [0.032, 0.42], [0.042, 0.78], [0.07, 0.95], [0.105, 1.0], [0.14, 0.97], [0.17, 0.93], [0.2, 0.935], [0.23, 0.89], [0.27, 0.85], [0.31, 0.86], [0.345, 0.81], [0.385, 0.82],
  [0.42, 0.84], [0.46, 0.8], [0.5, 0.74], [0.54, 0.7], [0.58, 0.71], [0.62, 0.64], [0.66, 0.58], [0.7, 0.6], [0.735, 0.5], [0.76, 0.36], [0.785, 0.27], [0.81, 0.22], [0.835, 0.19], [0.86, 0.17], [0.885, 0.13], [0.92, 0.11], [0.955, 0.095], [0.985, 0.085], [1.02, 0.05], [1.04, 0]];
const RW = 760, RH = 360, RS = 1.5, USPAN = 1.07;      // 岩体宽 760（u 跨度 1.07 → 屏上总宽约 813）、高 300（s=1），缓存按 1.5 倍分辨率
K.ROCK = { w: RW * USPAN, h: RH };
const rockCanvas = (T, o) => K.once(`rock:${tkey(o)}:${o.light === 'left' ? 'L' : 'R'}`, () => {
  const k = RS, cw = Math.ceil((RW * USPAN + 40) * k), ch = Math.ceil((RH + 40) * k), cc = mkCanvas(cw, ch), g = cc.getContext('2d'), base = ch - 12 * k, ox = 20 * k, L = o.light === 'left' ? -1 : 1;
  const X = u => ox + (u + 0.03) * RW * k, pts = K.jag(ROCK_PROF.map(([u, h]) => [X(u), base - h * RH * k]), 5 * k, 12, 14 * k); pts.unshift([ox - 10, base + 20]); pts.push([cw - 10, base + 20]);
  const uOf = x => (x - ox) / (RW * k) - 0.03, hh = y => (base - y) / (RH * k);
  const shadeAt = (x, y) => { const u = uOf(x), h = hh(y); return L > 0 ? u < 0.03 + 0.085 * h + 0.025 * P.noise(x * 0.03, y * 0.03) : u > 0.82 - 0.12 * h; };
  g.save(); g.clip(K.poly(pts));
  paintStrokes(g, [0, 0, cw, ch], { ramp: T.lit, cell: 6 * k, len: 22 * k, width: 5.5 * k, seed: 42, jit: 14, spread: 0.12, nz: 0.2,
    angle: (x, y) => { const h = hh(y); return uOf(x) < 0.2 ? -1.2 + 0.3 * P.noise(x * 0.04, y * 0.04) : h > 0.4 ? -1.25 + 0.5 * P.noise(x * 0.05, y * 0.03) : -0.5 * L + 0.35 * P.noise(x * 0.03, y * 0.03); },
    field: (x, y) => { const u = L > 0 ? uOf(x) : 1 - uOf(x), h = hh(y), led = 0.09 * Math.sin(h * 38 + P.noise(x * 0.01, 3) * 6); return clamp(0.08 + 0.55 * (1 - h) * (1.1 - 0.5 * u) + 0.2 * (1 - u) + led + 0.18 * P.noise(x * 0.012, y * 0.012)); }, accent: { cols: [T.lit[0], T.lit[1], T.lit[3]], p: 0.12 } });
  // 下坡灌木带（山脚到 1/3 高）
  paintStrokes(g, [0, 0, cw, ch], { ramp: [T.scrub[0], T.scrub[1], T.scrub[2]], cell: 7 * k, len: 22 * k, width: 6 * k, seed: 46, jit: 14, spread: 0.3, nz: 0.2, under: false, alpha: 0.7, angle: 0.1, field: (x, y) => 0.5 + 0.5 * P.noise(x * 0.03, y * 0.03),
    mask: (x, y) => { const h = hh(y); return h < 0.1 + 0.1 * P.noise(x * 0.02, 5) && uOf(x) > 0.06; } });
  // 色彩阴影：北面崖冷灰紫、竖笔（印象派不用黑做阴影）
  paintStrokes(g, [0, 0, cw, ch], { ramp: T.shade, cell: 6 * k, len: 24 * k, width: 5.5 * k, seed: 44, jit: 12, spread: 0.16, nz: 0.2, under: false,
    angle: (x, y) => -1.5 + 0.28 * P.noise(x * 0.05, y * 0.04), field: (x, y) => clamp(0.2 + 0.6 * (1 - hh(y)) + 0.3 * P.noise(x * 0.02, y * 0.02)), mask: shadeAt });
  // 岩层暗纹、山脚灌木
  const r = U.rng(5); g.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const u0 = 0.12 + r() * 0.66, h0 = (0.08 + r() * 0.55) * (1.05 - u0 * 0.7), x0 = X(u0), y0 = base - h0 * RH * k, l = (40 + r() * 70) * k;
    g.strokeStyle = rgbs(hx(T.shade[1]), 0.3); g.lineWidth = (3.5 + r() * 2) * k; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + l * 0.9 * L, y0 + l * (0.25 + r() * 0.2)); g.stroke(); }
  for (let i = 0; i < 60; i++) { const u0 = 0.06 + r() * 0.8, hp = ROCK_PROF.reduce((m, q) => Math.abs(q[0] - u0) < Math.abs(m[0] - u0) ? q : m)[1], h0 = hp * (0.25 + r() * 0.7), x0 = X(u0), y0 = base - h0 * RH * k, l = (18 + r() * 40) * k; g.strokeStyle = rgbs(hx(T.shade[i % 3]), 0.35); g.lineWidth = (3 + r() * 2.5) * k; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (r() - 0.5) * 6 * k, y0 + l); g.stroke(); }
  const sc = T.scrub.map(hx); for (let i = 0; i < 70; i++) { const u = 0.02 + r() * 0.98, hb = (0.02 + r() * 0.16) * (u < 0.1 ? 0.2 : 1); g.fillStyle = rgbs(sc[i % 3], 0.8); g.beginPath(); g.ellipse(X(u), base - hb * RH * k * 0.6 - r() * 8 * k, (14 + r() * 16) * k, (5 + r() * 5) * k, r() * 0.4 - 0.2, 0, TAU); g.fill(); }
  g.restore();
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = rgbs(hx(T.lit[0]), 0.85); g.lineWidth = 3.5 * k; g.beginPath(); let st = 0; pts.slice(1, -1).forEach(([px, py]) => { if (uOf(px) > 0.05) { st ? g.lineTo(px, py + 2 * k) : g.moveTo(px, py + 2 * k); st = 1; } }); g.stroke(); g.restore();
  const lx = X(0.99), ly = base - 0.085 * RH * k; g.fillStyle = rgbs(hx(T.lit[0])); g.fillRect(lx - 3 * k, ly - 22 * k, 6 * k, 22 * k); g.fillStyle = rgbs(hx(T.shade[1])); g.fillRect(lx - 4.5 * k, ly - 27 * k, 9 * k, 5 * k);   // 欧罗巴角灯塔
  cc._base = base; cc._cx = ox + RW * USPAN * k / 2; return cc; });
// K.rock(c, x, y, s, o)：直布罗陀巨岩。(x,y)＝岩体水平中心、水线；s＝缩放（1＝宽约 813px 高 300px；放左三分线用 x≈330, s≈0.9）。
//   o {tint, sat, light:'right'|'left'（光从哪边来，默认 right＝东，北面崖在阴影里）, flip（整体镜像）, alpha, reflect（水中倒影强度 0-1，默认 0.4）, t, levanter（山顶莱万特云）, flag:{col,col2}（岩顶旗）}
//   返回锚点 {summit, north, europa, base, left, right, top}（屏幕坐标，给 K.callout 用）
K.rock = (c, x, y, s = 1, o = {}) => {
  const T = tintOf(o), cv = rockCanvas(T, o), f = o.flip ? -1 : 1, k = s / RS, tt = o.t != null ? o.t : (K._t || 0), al = o.alpha != null ? o.alpha : 1;
  c.save();
  const rf = o.reflect != null ? o.reflect : 0.4;      // 倒影：竖向翻转的细切片，随水波左右错开、向下渐隐；不走倒影合成，几十次 drawImage
  if (rf > 0) { const n = 30, sh = 8 * Math.max(0.6, s), srcH = sh / k * 0.8;
    c.save(); c.translate(x, y); c.scale(f, 1);
    for (let i = 0; i < n; i++) { const sy = cv._base - (i + 1) * srcH; if (sy < 0) break; c.globalAlpha = al * rf * (1 - i / n) * 0.8; const dx = Math.sin(i * 0.8 + tt * 1.9) * (2 + i * 0.3);
      c.drawImage(cv, 0, sy, cv.width, srcH, -cv._cx * k + dx, 6 + i * sh, cv.width * k, sh + 1.2); }
    c.restore(); }
  c.globalAlpha = al; c.translate(x, y); c.scale(f * k, k); c.drawImage(cv, -cv._cx, -cv._base); c.restore();
  const wpx = RW * USPAN * s, px = u => x + f * ((u + 0.03) / USPAN - 0.5) * wpx, py = h => y - h * RH * s;
  const pts = { summit: [px(0.115), py(1.0)], north: [px(0.04), py(0.55)], ridge: [px(0.46), py(0.96)], europa: [px(0.985), py(0.085)], base: [x, y], left: x - wpx / 2, right: x + wpx / 2, top: y - RH * s };
  if (o.levanter) K.levanter(c, tt, pts.summit[0] + f * 40 * s, pts.summit[1] - 10, s, o);
  if (o.flag) K.flag(c, pts.summit[0], pts.summit[1] + 2, 0.7 * s, { ...o.flag, t: tt });
  return pts;
};
// 山顶莱万特云（岩顶常年一团白云被东风吹向西）
K.levanter = (c, t, x, y, s = 1, o = {}) => { const T = tintOf(o), cl = T.cloud.map(hx); c.save(); c.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const r = U.rng(i * 13 + 3), q = r(), px = x - q * 220 * s + Math.sin(t * 0.4 + i) * 4, py = y - 30 * s - q * 40 * s + (r() - .5) * 40 * s; c.globalAlpha = 0.75 * (1 - q * 0.7); c.strokeStyle = rgbs(cl[i % 3]); c.lineWidth = (14 + r() * 12) * s; c.beginPath(); c.moveTo(px - 20 * s, py); c.lineTo(px + 22 * s, py + (r() - .5) * 4); c.stroke(); } c.restore(); };
// 旗：K.flag(c,x,y,s,{col,col2,t}) 杆＋微飘旗面（纯色块，不画徽章；col2 是中间横条）
K.flag = (c, x, y, s = 1, o = {}) => { const t = o.t != null ? o.t : K._t || 0, col = o.col || C.brick, ph = 150 * s; c.save(); c.translate(x, y); c.strokeStyle = o.pole || '#4a3a3c'; c.lineWidth = 5 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -ph); c.stroke();
  const w = 80 * s, h = 52 * s; c.fillStyle = col; c.beginPath(); c.moveTo(0, -ph);
  for (let i = 0; i <= 8; i++) c.lineTo(w * i / 8, -ph + Math.sin(i * 0.9 - t * 4) * 6 * s * (i / 8)); for (let i = 8; i >= 0; i--) c.lineTo(w * i / 8, -ph + h + Math.sin(i * 0.9 - t * 4) * 6 * s * (i / 8)); c.closePath(); c.fill();
  if (o.col2) { c.fillStyle = o.col2; c.fillRect(0, -ph + h * 0.38, w * 0.98, h * 0.26); } c.restore(); };
// K.strait：招牌构图（岩石在左、非洲在右、窄水道；第 1 章与第 14 章同机位）。o {tint, sat, hz 640, rockX 330, rockY, s 0.95, land（前景岸 默认 true）, africa（默认 true）, levanter, flag, sun}。返回岩石锚点
K.strait = (c, t, o = {}) => {
  const hz = o.hz || 640, oo = { tint: o.tint, sat: o.sat, hz };
  K.bg(c, t, { ...oo, sun: o.sun === undefined ? [700, hz - 200] : o.sun });
  if (o.africa !== false) K.far(c, t, { ...oo, kind: 'africa', x: 640 });
  const pts = K.rock(c, o.rockX != null ? o.rockX : 340, o.rockY != null ? o.rockY : hz + 175, o.s || 0.75, { ...oo, t, levanter: o.levanter, flag: o.flag });
  if (o.land !== false) K.land(c, t, [[-40, hz + 170], [680, hz + 170], [560, hz + 230], [380, hz + 330], [200, hz + 430], [-40, hz + 560]], { ...oo, foam: [[680, hz + 172], [560, hz + 232], [380, hz + 332], [200, hz + 432], [-40, hz + 562]] });
  return pts;
};

// ================================ 船 ================================
// K.ship(c,x,y,s,o)：帆船/战舰剪影（无脸无人）。(x,y)＝水线中心；s＝缩放（1＝船长约 220px）。
//   o {kind:'dhow'三角帆|'galleon'三桅|'line'战列舰|'steam'汽船|'war'灰色军舰, tint, sat, t, heel（倾斜弧度）, flip, alpha, flag（旗色）, smoke（0-1 炮烟）, fire（0-1 炮口火光）, wake（0 关尾迹）, reflect（0 关水中暗影）, seed}
K.ship = (c, x, y, s = 1, o = {}) => {
  const T = tintOf(o), t = o.t != null ? o.t : (K._t || 0), kind = o.kind || 'dhow', f = o.flip ? -1 : 1, seed = o.seed || 1, ph = seed * 1.7;
  const bob = Math.sin(t * 1.3 + ph) * 3 * s, roll = (o.heel || 0) + Math.sin(t * 0.9 + ph) * 0.02;
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.translate(x, y + bob); c.scale(f * s, s);
  const hull = o.hull || T.hull, sail = o.sail || T.sail, shade = T.sailSh;
  if (o.reflect !== 0) { c.save(); c.globalAlpha *= 0.28; c.fillStyle = hull; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(Math.sin(t * 2 + i + ph) * 3, 12 + i * 7, 96 - i * 14, 2.6, 0, 0, TAU); c.fill(); } c.restore(); }
  if (o.wake !== 0 && kind !== 'war') { c.save(); c.strokeStyle = 'rgba(250,246,230,.7)'; c.lineWidth = 3.4; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-108 - i * 18, 5 + i * 3); c.lineTo(-146 - i * 26 + Math.sin(t * 3 + i) * 3, 7 + i * 4); c.stroke(); } c.restore(); }
  c.rotate(roll);
  const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); };
  const squareSail = (cx, ty, w, h, bulge = 8) => { c.fillStyle = sail; c.beginPath(); c.moveTo(cx - w / 2, ty); c.lineTo(cx + w / 2, ty); c.quadraticCurveTo(cx + w / 2 + bulge, ty + h / 2, cx + w / 2 - 3, ty + h); c.quadraticCurveTo(cx, ty + h + bulge * 0.7, cx - w / 2 + 3, ty + h); c.quadraticCurveTo(cx - w / 2 - bulge, ty + h / 2, cx - w / 2, ty); c.closePath(); c.fill();
    c.fillStyle = shade; c.beginPath(); c.moveTo(cx + w * 0.12, ty); c.lineTo(cx + w / 2, ty); c.quadraticCurveTo(cx + w / 2 + bulge, ty + h / 2, cx + w / 2 - 3, ty + h); c.lineTo(cx + w * 0.2, ty + h); c.closePath(); c.fill(); c.fillStyle = hull; c.fillRect(cx - w / 2 - 3, ty - 2, w + 6, 4); };
  const flagAt = (fx, fy, col) => { c.fillStyle = col || o.flag || C.brick; c.beginPath(); c.moveTo(fx, fy); for (let i = 0; i <= 5; i++) c.lineTo(fx + 8 + i * 4, fy + 2 + Math.sin(i * 1.1 - t * 5) * 2.5); c.lineTo(fx + 28, fy + 11); c.lineTo(fx, fy + 11); c.closePath(); c.fill(); };
  if (kind === 'dhow') {
    quad([[-100, -2], [104, -2], [88, 14], [-82, 14]], hull); c.fillStyle = hull; c.beginPath(); c.moveTo(-100, -2); c.quadraticCurveTo(-112, -14, -108, -22); c.lineTo(-96, -4); c.closePath(); c.fill(); c.beginPath(); c.moveTo(104, -2); c.quadraticCurveTo(116, -10, 124, -20); c.lineTo(100, -2); c.closePath(); c.fill();
    c.strokeStyle = hull; c.lineWidth = 4; c.beginPath(); c.moveTo(-70, -2); c.lineTo(74, -118); c.stroke();
    c.fillStyle = sail; c.beginPath(); c.moveTo(-64, -6); c.quadraticCurveTo(0, -30, 72, -112); c.lineTo(96, -6); c.closePath(); c.fill();
    c.fillStyle = shade; c.beginPath(); c.moveTo(10, -9); c.quadraticCurveTo(44, -42, 72, -112); c.lineTo(96, -6); c.closePath(); c.fill();
    c.fillStyle = sail; c.beginPath(); c.moveTo(-92, -4); c.lineTo(-76, -50); c.lineTo(-60, -5); c.closePath(); c.fill(); flagAt(72, -120);
  } else if (kind === 'galleon') {
    quad([[-108, -8], [112, -8], [96, 14], [-90, 14]], hull); quad([[-108, -8], [-96, -30], [-60, -30], [-52, -8]], hull); quad([[96, -8], [120, -14], [128, -6], [112, -8]], hull);
    c.fillStyle = shade; c.fillRect(-100, -2, 196, 3.5);
    [[-52, 1], [10, 1.18], [66, 0.9]].forEach(([mx, hs]) => { c.strokeStyle = hull; c.lineWidth = 3.6; c.beginPath(); c.moveTo(mx, -8); c.lineTo(mx, -8 - 100 * hs - 10); c.stroke(); squareSail(mx, -8 - 98 * hs, 56 * hs, 44 * hs, 7); squareSail(mx, -8 - 48 * hs, 66 * hs, 42 * hs, 8); });
    flagAt(10, -8 - 98 * 1.18 - 16);
  } else if (kind === 'line') {
    quad([[-132, -10], [138, -10], [120, 16], [-112, 16]], hull); quad([[-132, -10], [-124, -36], [-84, -36], [-70, -10]], hull); quad([[118, -10], [158, -20], [168, -14], [138, -10]], hull);
    c.fillStyle = sail; for (let i = 0; i < 2; i++) c.fillRect(-120, -4 + i * 9, 236, 3); c.fillStyle = shade; for (let i = 0; i < 12; i++) { c.fillRect(-114 + i * 19, -4, 8, 2.5); c.fillRect(-114 + i * 19, 5, 8, 2.5); }
    [[-70, 1.02], [4, 1.28], [78, 1.0]].forEach(([mx, hs]) => { c.strokeStyle = hull; c.lineWidth = 4; c.beginPath(); c.moveTo(mx, -10); c.lineTo(mx, -10 - 190 * hs); c.stroke(); squareSail(mx, -10 - 186 * hs, 54 * hs, 38 * hs, 6); squareSail(mx, -10 - 140 * hs, 72 * hs, 52 * hs, 9); squareSail(mx, -10 - 80 * hs, 88 * hs, 62 * hs, 10); });
    flagAt(4, -10 - 190 * 1.28 - 6);
  } else if (kind === 'steam') {
    quad([[-110, -4], [118, -4], [98, 16], [-96, 16]], hull); quad([[-60, -4], [60, -4], [60, -26], [-60, -26]], hull); c.fillStyle = sail; c.fillRect(-52, -22, 104, 8); c.fillStyle = hull; c.fillRect(-14, -66, 24, 42); c.fillStyle = o.flag || C.brick; c.fillRect(-14, -66, 24, 7);
    c.strokeStyle = hull; c.lineWidth = 3; c.beginPath(); c.moveTo(54, -26); c.lineTo(54, -76); c.stroke(); flagAt(54, -76);
  } else {
    quad([[-128, -2], [136, -2], [118, 14], [-110, 14]], '#5a5a66'); c.fillStyle = '#6c6c78'; c.fillRect(-100, -22, 190, 20); c.fillRect(-60, -44, 70, 22); c.fillRect(-30, -66, 24, 22);
    c.strokeStyle = '#4a4a56'; c.lineWidth = 6; c.beginPath(); c.moveTo(-90, -14); c.lineTo(-130, -26); c.moveTo(70, -14); c.lineTo(112, -24); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(-18, -66); c.lineTo(-18, -112); c.stroke();
    c.fillStyle = '#8a8a96'; c.fillRect(-100, -22, 190, 3); }
  c.restore();
  if (kind === 'steam' && o.smoke == null) K.smoke(c, x - f * 2 * s, y - 70 * s, t, { n: 7, s: 0.9 * s, drift: -f, up: 120 * s, tint: o.tint, sat: o.sat, seed });
  if (o.smoke > 0) K.smoke(c, x + f * 20 * s, y - 60 * s, t, { n: 12, s: s * 1.4, up: 150 * s, intensity: o.smoke, tint: o.tint, sat: o.sat, seed });
  if (o.fire > 0) K.flash(c, x + f * 30 * s, y - 30 * s, t, { s, k: o.fire, seed });
};
// K.smoke(c,x,y,t,o)：炮烟/烟囱烟（暖灰粉白的柔软笔触团，循环上升）。o {n, s, up, drift, intensity, tint, seed}
K.smoke = (c, x, y, t, o = {}) => { const T = tintOf(o), n = o.n || 12, s = o.s || 1, up = o.up || 130, cols = T.name === 'night' ? ['#46586a', '#34465a', '#586a7a'] : T.name === 'grey' ? ['#a8a8a4', '#8c8c8c', '#c0beb6'] : ['#d8c8c0', '#b0a0a8', '#efe0d4', '#9a8a96'], it = o.intensity != null ? o.intensity : 1;
  c.save(); c.lineCap = 'round'; for (let i = 0; i < n; i++) { const r = U.rng((o.seed || 1) * 100 + i), ph = ((t * 0.28 + r()) % 1), px = x + (o.drift != null ? o.drift : 1) * ph * 60 * s + (r() - .5) * 30 * s, py = y - ph * up, a = Math.sin(ph * Math.PI) * 0.7 * it;
    c.globalAlpha = a; c.strokeStyle = cols[i % cols.length]; c.lineWidth = (18 + ph * 36 + r() * 12) * s; c.beginPath(); c.moveTo(px - (10 + ph * 22) * s, py); c.lineTo(px + (10 + ph * 22) * s, py + (r() - .5) * 6); c.stroke(); } c.restore(); };
// K.flash：炮口火光（暖金短笔星点，12fps 闪烁）。o {s, k 0-1, seed}
K.flash = (c, x, y, t, o = {}) => { const s = o.s || 1, st = Math.floor(t * 12), k = o.k != null ? o.k : 1; if (U.hash(st, (o.seed || 1) * 7) > 0.55 * k + 0.1) return; c.save(); c.lineCap = 'round'; const cols = ['#fff4c0', '#ffd890', '#f8b070'];
  for (let i = 0; i < 9; i++) { const a = U.hash(i, st) * TAU, l = (10 + U.hash(i + 9, st) * 26) * s; c.strokeStyle = cols[i % 3]; c.lineWidth = (6 - i * 0.3) * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  c.fillStyle = 'rgba(255,240,190,.9)'; c.beginPath(); c.arc(x, y, 8 * s, 0, TAU); c.fill(); c.restore(); };

// ================================ 堡垒 / 隧道剖面 ================================
// K.fort(c,x,y,s,o)：城堡/棱堡剪影（雉堞城墙＋塔＋炮口），(x,y)＝墙脚中点，s=1 墙宽约 380。o {tint, sat, flag（旗色）, cannon, flip, alpha}
K.fort = (c, x, y, s = 1, o = {}) => { const T = tintOf(o), lit = hx(T.lit[1]), lit2 = hx(T.lit[0]), sh = hx(T.shade[1]), f = o.flip ? -1 : 1;
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.translate(x, y); c.scale(f * s, s);
  const wall = (x0, x1, h, col) => { c.fillStyle = rgbs(col); c.fillRect(x0, -h, x1 - x0, h); for (let xx = x0; xx < x1 - 10; xx += 28) c.fillRect(xx, -h - 16, 16, 16); };
  wall(-190, 190, 120, lit); c.fillStyle = rgbs(sh, 0.9); c.fillRect(-190, -120, 60, 120); c.fillStyle = rgbs(lit2); c.fillRect(90, -120, 100, 14);
  c.fillStyle = rgbs(hx(T.shade[2]), 0.8); for (let i = 0; i < 4; i++) c.fillRect(-100 + i * 70, -78, 18, 30);
  wall(-30, 70, 205, lit); c.fillStyle = rgbs(sh, 0.9); c.fillRect(-30, -205, 24, 205); c.fillStyle = rgbs(hx(T.shade[2])); c.fillRect(8, -150, 16, 34);
  if (o.cannon !== false) { c.strokeStyle = rgbs(hx(T.hull)); c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(130, -134); c.lineTo(196, -158); c.stroke(); c.lineWidth = 6; c.beginPath(); c.arc(128, -128, 12, 0, TAU); c.stroke(); }
  c.restore(); if (o.flag) K.flag(c, x + f * 20 * s, y - 221 * s, 0.6 * s, { col: o.flag, t: K._t }); };
// K.tunnel(c,x,y,w,h,lt,o)：岩体剖面（侧视切开，扁平清晰信息层）。(x,y)＝左上角；外形用真实侧影，内部暗腔里画发光坑道。
//   o {tint（默认 night）, sat, prog（0-1 坑道逐段亮起，默认随 lt 自动）, routes:[[[u,v]…],…]（u 左→右、v 下→上，0..1）, rooms:[[u,v,w,h]…], sea（底部海 默认 true）, strata（岩层线 默认 true）, hi:[坑道序号]（金色重点坑道）}
//   返回 {X(u), Y(v)}：单位坐标→屏幕坐标（给 K.callout / K.tag 定位）
K.tunnel = (c, x, y, w, h, lt, o = {}) => {
  const tn = o.tint || 'night', night = tn === 'night', T = K.tint(tn, o.sat != null ? o.sat : 1), prog = o.prog != null ? o.prog : K.at(lt, 0.3, 2.2);
  const rock = night ? ['#566684', '#46567a', '#384668'] : T.lit.slice(1).concat([T.shade[1]]), cav = night ? '#0f1a2e' : '#3a2a4a', glow = '#F6D58A', gold = C.gold;
  const X = u => x + u * w, Y = v => y + h - v * h, key = `tun:${tkey({ tint: tn, sat: o.sat })}:${Math.round(w)}x${Math.round(h)}@${Math.round(x)},${Math.round(y)}`;
  const prof = ROCK_PROF.map(([u, hh]) => [X(u * 0.94 + 0.04), Y(0.06 + hh * 0.92)]); prof.unshift([X(-0.03), Y(0)]); prof.push([X(1.02), Y(0)]); const region = K.jag(prof, 5, 8, 16);
  c.save();
  K.strokeFill(c, region, { key, ramp: rock, cell: 8, len: 26, width: 6, angle: (xx, yy) => -0.5 + 0.4 * P.noise(xx * 0.02, yy * 0.02), seed: 61, jit: 10, spread: 0.14, nz: 0.2, field: (xx, yy) => clamp((yy - y) / h * 0.9 + 0.1 * P.noise(xx * 0.01, yy * 0.01)) });
  c.save(); c.clip(K.poly(region));
  if (o.strata !== false) { c.strokeStyle = rgbs(hx(night ? '#2c3a5c' : T.shade[2]), 0.45); c.lineWidth = 4; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x, Y(i * 0.13)); c.bezierCurveTo(X(0.3), Y(i * 0.13 + 0.03), X(0.6), Y(i * 0.13 - 0.04), X(1), Y(i * 0.13 + 0.02)); c.stroke(); } }
  const routes = o.routes || [[[0.06, 0.22], [0.2, 0.25], [0.38, 0.3], [0.56, 0.26], [0.72, 0.2], [0.9, 0.16]], [[0.09, 0.5], [0.2, 0.54], [0.34, 0.52], [0.5, 0.46]], [[0.2, 0.25], [0.24, 0.4], [0.2, 0.54]], [[0.5, 0.46], [0.52, 0.34], [0.56, 0.26]]];
  const rooms = o.rooms || [[0.40, 0.31, 0.12, 0.08], [0.60, 0.17, 0.1, 0.06], [0.26, 0.5, 0.09, 0.06]];
  let tot = 0; const lens = routes.map(r => { let l = 0; for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); tot += l; return l; });
  let acc = 0; routes.forEach((r, ri) => { const q = clamp((prog * tot - acc) / lens[ri]); acc += lens[ri]; if (q <= 0) return;
    const hi = o.hi && o.hi.includes(ri), path = () => { c.beginPath(); let left = q * lens[ri]; c.moveTo(X(r[0][0]), Y(r[0][1])); for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]), k2 = Math.min(1, left / d); if (k2 <= 0) break; c.lineTo(X(lerp(r[i - 1][0], r[i][0], k2)), Y(lerp(r[i - 1][1], r[i][1], k2))); left -= d; } };
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = cav; c.lineWidth = 26; path(); c.stroke(); c.strokeStyle = hi ? gold : glow; c.lineWidth = 11; path(); c.stroke(); });
  rooms.forEach(([u, v, rw, rh], i) => { const q = clamp(prog * 1.4 - i * 0.25 - 0.3); if (q <= 0) return; c.fillStyle = cav; c.fillRect(X(u) - 8, Y(v + rh) - 8, rw * w + 16, rh * h + 16); c.fillStyle = glow; c.globalAlpha = q; c.fillRect(X(u), Y(v + rh), rw * w, rh * h); c.globalAlpha = 1; });
  c.restore();
  for (let i = 0; i < 6; i++) { const q = clamp(prog * 1.6 - i * 0.1); if (q > 0) { c.fillStyle = gold; c.globalAlpha = q; c.beginPath(); c.arc(X(0.05 + i * 0.012), Y(0.4 + i * 0.07), 7, 0, TAU); c.fill(); c.globalAlpha = 1; } }
  if (o.sea !== false) { const sy0 = Y(0.06), sh = y + h + 90 - sy0, sk = `${key}:sea`; K.strokeFill(c, { bbox: [x - 60, sy0, x + w + 60, sy0 + sh], path: K.poly([[x - 60, sy0], [x + w + 60, sy0], [x + w + 60, sy0 + sh], [x - 60, sy0 + sh]]) }, { key: sk, ramp: [T.sea[1], T.sea[2], T.sea[3], T.sea[4]], cell: 8, len: 30, width: 5, angle: 0.03, seed: 63, jit: 10, spread: 0.1 }); }
  c.restore(); return { X, Y }; };

// ================================ 人 / 猴（只画剪影，不画脸） ================================
// K.person(c,x,y,s,o)：剪影。(x,y)＝脚底中心，s=1 高约 300。o {kind:'cloak'披风|'officer'军帽(双角帽)|'robe'长袍|'soldier'军人|'civ'平民, tint, sat, flip, t, alpha, point（抬手指向）, col, seed}
K.person = (c, x, y, s = 1, o = {}) => { const T = tintOf(o), kind = o.kind || 'cloak', f = o.flip ? -1 : 1, hull = o.col || T.hull, rim = T.lit[1], sway = Math.sin((o.t != null ? o.t : K._t || 0) * 1.4 + (o.seed || 0)) * 2;
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.translate(x, y); c.scale(f * s, s);
  const body = () => { c.beginPath();
    if (kind === 'cloak') { c.moveTo(-14, -226); c.bezierCurveTo(-34, -214, -54, -140, -66, 0); c.lineTo(66 + sway, 0); c.bezierCurveTo(54, -130, 32, -214, 14, -226); c.closePath(); }
    else if (kind === 'robe') { c.moveTo(-16, -222); c.bezierCurveTo(-40, -200, -48, -120, -52, 0); c.lineTo(52, 0); c.bezierCurveTo(48, -120, 40, -200, 16, -222); c.closePath(); }
    else if (kind === 'officer') { c.moveTo(-26, -214); c.lineTo(-30, -110); c.lineTo(-46, -40); c.lineTo(-30, 0); c.lineTo(-6, 0); c.lineTo(0, -80); c.lineTo(6, 0); c.lineTo(30, 0); c.lineTo(46, -40); c.lineTo(30, -110); c.lineTo(26, -214); c.closePath(); }
    else if (kind === 'soldier') { c.moveTo(-24, -210); c.lineTo(-30, -100); c.lineTo(-28, 0); c.lineTo(-4, 0); c.lineTo(0, -70); c.lineTo(4, 0); c.lineTo(28, 0); c.lineTo(30, -100); c.lineTo(24, -210); c.closePath(); }
    else { c.moveTo(-22, -208); c.lineTo(-30, -110); c.lineTo(-24, 0); c.lineTo(-4, 0); c.lineTo(0, -70); c.lineTo(4, 0); c.lineTo(24, 0); c.lineTo(30, -110); c.lineTo(22, -208); c.closePath(); } };
  const head = () => { c.beginPath(); c.ellipse(0, -248, 21, 24, 0, 0, TAU); };
  const hat = () => { c.beginPath();
    if (kind === 'officer') { c.moveTo(-52, -266); c.quadraticCurveTo(0, -330, 52, -266); c.quadraticCurveTo(0, -284, -52, -266); c.closePath(); }
    else if (kind === 'soldier') { c.moveTo(-26, -258); c.lineTo(-24, -284); c.lineTo(26, -284); c.lineTo(28, -260); c.lineTo(42, -258); c.lineTo(42, -252); c.lineTo(-28, -252); c.closePath(); }
    else if (kind === 'robe') { c.ellipse(0, -268, 27, 19, 0, 0, TAU); }
    else if (kind === 'cloak') { c.moveTo(-26, -236); c.quadraticCurveTo(-30, -286, 0, -290); c.quadraticCurveTo(30, -286, 26, -236); c.lineTo(14, -226); c.lineTo(-14, -226); c.closePath(); }
    else { c.moveTo(-28, -262); c.lineTo(28, -262); c.lineTo(22, -280); c.lineTo(-22, -280); c.closePath(); } };
  const arm = () => { c.lineCap = 'round'; c.lineWidth = 15; if (o.point) { c.beginPath(); c.moveTo(18, -190); c.lineTo(66, -218); c.lineTo(104, -224); c.stroke(); } else if (kind === 'soldier') { c.beginPath(); c.moveTo(20, -190); c.lineTo(36, -120); c.stroke(); c.lineWidth = 5; c.beginPath(); c.moveTo(48, -230); c.lineTo(40, -10); c.stroke(); } else if (kind === 'officer') { c.beginPath(); c.moveTo(24, -190); c.lineTo(44, -130); c.stroke(); c.lineWidth = 4; c.beginPath(); c.moveTo(44, -130); c.lineTo(62, -40); c.stroke(); } };
  const draw = (col, dx) => { c.save(); c.translate(dx, 0); c.fillStyle = col; c.strokeStyle = col; body(); c.fill(); head(); c.fill(); hat(); c.fill(); arm(); c.restore(); };
  draw(rim, 5); draw(hull, 0); c.restore(); };
// K.monkey(c,x,y,s,o)：猕猴剪影（蹲坐、尾巴上卷，朝右），(x,y)＝臀下。s=1 高约 150。o {tint, sat, flip, t, alpha, col, seed}
K.monkey = (c, x, y, s = 1, o = {}) => { const T = tintOf(o), f = o.flip ? -1 : 1, hull = o.col || T.hull, rim = T.lit[1], t = o.t != null ? o.t : K._t || 0, tw = Math.sin(t * 1.6 + (o.seed || 0)) * 4;
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.translate(x, y); c.scale(f * s, s);
  const shape = () => { c.beginPath(); c.ellipse(0, -48, 42, 46, -0.15, 0, TAU); c.moveTo(68, -112); c.arc(46, -112, 22, 0, TAU); c.moveTo(87, -104); c.ellipse(72, -100, 15, 11, 0, 0, TAU);
    c.moveTo(37, -124); c.arc(28, -124, 9, 0, TAU); c.moveTo(32, -8); c.ellipse(-4, -8, 36, 12, 0, 0, TAU); c.moveTo(72, -8); c.ellipse(46, -8, 26, 10, 0, 0, TAU); };
  const limbs = () => { c.lineCap = 'round'; c.lineWidth = 14; c.beginPath(); c.moveTo(24, -80); c.quadraticCurveTo(50, -56, 56, -22); c.stroke();
    c.lineWidth = 10; c.beginPath(); c.moveTo(-40, -34); c.bezierCurveTo(-86, -30, -100, -90, -78 + tw, -126); c.stroke(); };
  [[rim, 4], [hull, 0]].forEach(([col, dx]) => { c.save(); c.translate(dx, 0); c.fillStyle = col; c.strokeStyle = col; shape(); c.fill(); limbs(); c.restore(); });
  c.restore(); };

// ================================ 文字 ================================
// K.text(c,s,x,y,o)：深紫褐字＋奶白光晕（压在岩/海/天上都可读）。o {size 64, col, align, alpha, scale, track, maxW, rot, fam, halo（默认 true）, haloCol}
K.text = (c, s, x, y, o = {}) => { const { size = 64, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o, fam = o.fam || 'PuHui-Black';
  if (size < 44) warnOnce('small', `K.text 字号 ${size} 太小（手机竖屏 ≥44，标签 ≥52）`);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (o.halo !== false) { const hc = o.haloCol || '255,248,226'; c.shadowColor = `rgba(${hc},.95)`; c.shadowBlur = size * 0.4; c.strokeStyle = `rgba(${hc},.92)`; c.lineWidth = size * 0.26; c.strokeText(s, 0, 0); c.shadowBlur = 0; c.strokeText(s, 0, 0); }
  c.fillStyle = o.col || C.ink; c.fillText(s, 0, 0); c.restore(); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const k = K.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha != null ? o.alpha : 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { size: 96, ...o, scale: k * (o.scale || 1), alpha: a }); };
// K.tag：金底深字标签（数据高光）。返回宽度。o {size 56, fill, col, scale, alpha, rot}
K.tag = (c, s, x, y, o = {}) => { const { size = 56, scale = 1, alpha = 1, rot = 0 } = o, fill = o.fill || C.gold, col = o.col || C.ink;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 0.9, h = size * 1.45;
  c.shadowColor = 'rgba(58,42,74,.35)'; c.shadowBlur = 14; c.shadowOffsetY = 4; c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.3); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0; c.strokeStyle = 'rgba(58,42,74,.55)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
// K.callout(c,s,ax,ay,bx,by,lt,at,o)：引线标注。金点（锚）＋深紫褐细线＋奶白板深字（逐字出）。字号默认 54（≥52）。o {size, fill, col, line}
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const size = o.size || 54, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = o.line || C.ink; c.lineWidth = 5; c.lineCap = 'round'; c.shadowColor = 'rgba(255,248,226,.9)'; c.shadowBlur = 10; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = C.gold; c.strokeStyle = C.ink; c.lineWidth = 4; c.beginPath(); c.arc(ax, ay, 12 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Black"`; const w = c.measureText(s).width + size * 0.9, h = size * 1.5; c.translate(bx, by); c.scale(q, q);
  c.shadowColor = 'rgba(58,42,74,.3)'; c.shadowBlur = 16; c.shadowOffsetY = 4; c.fillStyle = o.fill || 'rgba(251,243,226,.96)'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.28); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0; c.strokeStyle = C.gold; c.lineWidth = 4; c.stroke();
  c.fillStyle = o.col || C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.45, 3); c.restore(); };

// ================================ 干净信息层 ================================
// K.mapCard(c,x,y,w,h,o,fn)：奶白卡片（信息图底，不被笔触吞）。o {title, tone:'cream'|'night', scale/alpha（配 pop）, head（标题栏高，默认 104）}；fn(c, box)，box={x,y,w,h,ix,iy,iw,ih,dark}（ix/iy 是卡内局部坐标，fn 在卡内局部坐标系里画）
K.mapCard = (c, x, y, w, h, o = {}, fn) => { const sc = o.scale != null ? o.scale : 1, al = o.alpha != null ? o.alpha : 1; if (sc <= 0 || al <= 0) return null; const dark = o.tone === 'night', head = o.title ? (o.head || 104) : 0;
  c.save(); c.globalAlpha *= al; c.translate(x + w / 2, y + h / 2); c.scale(sc, sc); c.translate(-w / 2, -h / 2);
  c.shadowColor = 'rgba(40,30,60,.32)'; c.shadowBlur = 36; c.shadowOffsetY = 10; c.fillStyle = dark ? 'rgba(22,34,56,.94)' : 'rgba(251,243,226,.95)'; c.beginPath(); c.roundRect(0, 0, w, h, 34); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.strokeStyle = dark ? 'rgba(232,176,74,.8)' : 'rgba(184,148,108,.7)'; c.lineWidth = 4; c.stroke();
  if (o.title) { c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 34); c.clip(); c.fillStyle = dark ? 'rgba(232,176,74,.2)' : 'rgba(232,176,74,.28)'; c.fillRect(0, 0, w, head); c.fillStyle = C.gold; c.fillRect(0, head - 5, w, 5); c.restore();
    c.font = '60px "PuHui-Black"'; c.fillStyle = dark ? C.cream : C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(o.title, 44, head / 2 - 1, w - 88); }
  const box = { x, y, w, h, ix: 44, iy: head + 24, iw: w - 88, ih: h - head - 48, dark }; if (fn) { c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 34); c.clip(); fn(c, box); c.restore(); } c.restore(); return box; };
// K.bigNum(c,s,x,y,o)：大数字（金填充＋深紫褐描边＋奶白光晕，压天空/岩石/卡片都清楚）。(x,y)＝数字中线。o {size 220, unit（单位，小一号）, label（下方一行说明 ≥52）, lt, at（配 pop）, col, scale, alpha, dark, labelSize}
K.bigNum = (c, s, x, y, o = {}) => { const size = o.size || 220, k = o.lt != null ? K.pop(o.lt, o.at || 0, 0.55) : 1; if (k <= 0) return; const alpha = clamp(k * 2) * (o.alpha != null ? o.alpha : 1), usz = size * 0.38;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(k * (o.scale || 1), k * (o.scale || 1)); c.font = `${size}px "PuHui-Heavy"`; const nw = c.measureText(s).width; let uw = 0; if (o.unit) { c.font = `${usz}px "PuHui-Black"`; uw = c.measureText(o.unit).width + size * 0.08; }
  const x0 = -(nw + uw) / 2; c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round'; c.miterLimit = 2;
  const lay = (txt, tx, ty, font) => { c.font = font;
    if (!o.dark) { c.shadowColor = 'rgba(255,248,226,.95)'; c.shadowBlur = size * 0.2; c.strokeStyle = 'rgba(255,248,226,.92)'; c.lineWidth = size * 0.2; c.strokeText(txt, tx, ty); c.shadowBlur = 0; }
    c.strokeStyle = C.ink; c.lineWidth = size * 0.075; c.strokeText(txt, tx, ty); c.fillStyle = o.col || C.gold; c.fillText(txt, tx, ty); c.save(); c.beginPath(); c.rect(tx - 20, ty - size, 4000, size * 0.5); c.clip(); c.fillStyle = 'rgba(255,244,200,.5)'; c.fillText(txt, tx, ty); c.restore(); };
  lay(s, x0, 0, `${size}px "PuHui-Heavy"`); if (o.unit) lay(o.unit, x0 + nw + size * 0.08, size * 0.25, `${usz}px "PuHui-Black"`); c.restore();
  if (o.label) K.text(c, o.label, x, y + size * 0.62 + 20, { size: o.labelSize || 56, alpha, col: o.dark ? C.cream : C.ink, halo: !o.dark, maxW: 940 }); };
// K.timeline(c,x,y,w,lt,items,o)：时间线。items [{t:'1704', label:'英军占领', at:秒, hi:true}]。默认竖排（竖屏友好，x 为左缘），o.horizontal 横排。年份 64、说明 54。o {gap 150, dark, prog}
K.timeline = (c, x, y, w, lt, items, o = {}) => { const n = items.length, gap = o.gap || 150, dark = o.dark, ink = dark ? C.cream : C.ink, hiCol = dark ? C.gold : '#B77F1E';
  if (o.horizontal) { const step = w / (n - 1 || 1); c.save(); c.strokeStyle = ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * (o.prog != null ? o.prog : 1), y); c.stroke(); c.restore();
    items.forEach((it, i) => { const q = K.pop(lt, it.at != null ? it.at : i * 0.5, 0.45); if (q <= 0) return; const px = x + step * i; c.save(); c.translate(px, y); c.scale(q, q); c.fillStyle = it.hi ? C.gold : C.cream; c.strokeStyle = ink; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, it.hi ? 20 : 15, 0, TAU); c.fill(); c.stroke(); c.restore();
      K.text(c, it.t, px, y - 66, { size: 60, col: it.hi ? hiCol : ink, halo: false, alpha: q, fam: 'PuHui-Heavy' }); if (it.label) K.text(c, it.label, px, y + 70, { size: 52, col: ink, halo: false, alpha: q, maxW: step - 10 }); }); return; }
  c.save(); c.strokeStyle = ink; c.globalAlpha *= 0.6; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 210, y - 20); c.lineTo(x + 210, y + (n - 1) * gap + 20); c.stroke(); c.restore();
  items.forEach((it, i) => { const q = K.pop(lt, it.at != null ? it.at : i * 0.5, 0.45); if (q <= 0) return; const py = y + i * gap; c.save(); c.translate(x + 210, py); c.scale(q, q); c.fillStyle = it.hi ? C.gold : C.cream; c.strokeStyle = ink; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, it.hi ? 21 : 16, 0, TAU); c.fill(); c.stroke(); c.restore();
    c.save(); c.globalAlpha *= clamp(q * 2); c.font = '64px "PuHui-Heavy"'; c.textBaseline = 'middle'; c.textAlign = 'right'; c.fillStyle = it.hi ? hiCol : ink; c.fillText(it.t, x + 178, py + 2); c.font = '54px "PuHui-Black"'; c.textAlign = 'left'; c.fillStyle = ink; c.fillText(it.label || '', x + 252, py + 2, w - 260); c.restore(); }); };
// K.bars(c,x,y,w,h,items,lt,o)：横条对比。items [{label, v（0..1 占比）, text, hi}]，hi 用暖金，其余冷青。每行 标签(54)＋条＋数值(60)。o {at 起点秒, dur, dark}
K.bars = (c, x, y, w, h, items, lt, o = {}) => { const n = items.length, rh = h / n, dark = o.dark, ink = dark ? C.cream : C.ink, at = o.at || 0.2;
  items.forEach((it, i) => { const g = MO.cubicOut(K.at(lt, at + i * 0.25, o.dur || 0.9)); if (g <= 0) return; const ry = y + i * rh, bh = Math.min(54, rh * 0.38), bw = (w - 8) * clamp(it.v) * g;
    c.save(); c.globalAlpha *= clamp(g * 3); c.font = '54px "PuHui-Black"'; c.fillStyle = ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(it.label, x, ry + rh * 0.22, w - 200);
    c.fillStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(58,42,74,.1)'; c.beginPath(); c.roundRect(x, ry + rh * 0.48, w - 8, bh, bh / 2); c.fill();
    c.fillStyle = it.hi ? C.gold : (dark ? '#5aa0a8' : C.teal); c.beginPath(); c.roundRect(x, ry + rh * 0.48, Math.max(bh, bw), bh, bh / 2); c.fill();
    if (it.text != null) { c.font = '60px "PuHui-Heavy"'; c.textAlign = 'right'; c.fillStyle = it.hi ? (dark ? C.gold : '#B77F1E') : ink; c.fillText(it.text, x + w, ry + rh * 0.22); } c.restore(); }); };

// ================================ 收尾 / 章节卡 / 字幕 ================================
// K.finish(c,o)：每镜最后调。纸面颗粒（multiply）＋字幕带 y1370–1570 轻压暗（色随 tint）。o {tint, sat, band（0 关）}
K.finish = (c, o = {}) => { const T = tintOf(o);
  c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(P.grain('monet', 0.05, [150, 120, 90], 0.12), 0, 0); c.restore();
  if (o.band === 0) return; const b = T.band, fg = c.createLinearGradient(0, 1370, 0, 1630); fg.addColorStop(0, `rgba(${b},0)`); fg.addColorStop(0.2, `rgba(${b},.3)`); fg.addColorStop(0.6, `rgba(${b},.38)`); fg.addColorStop(1, `rgba(${b},0)`); c.fillStyle = fg; c.fillRect(0, 1370, W, 260); };
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
// 章节卡里的「小船」站牌：换书时可在 props.js 改 K.cardToken
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking, arriveAt, o) => { K.ship(c, x, y + 28, 0.34, { kind: 'dhow', tint: o && o.tint, sat: o && o.sat, t, wake: 0, reflect: 0 }); });
K.splitTitle = s => { const a = [...s]; if (a.length <= 7) return [s]; const mid = a.length / 2; let best = -1, bd = 99; a.forEach((ch, i) => { if ('，、：；—与之的'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + ('与之的'.includes(ch) ? 0 : 1); } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// K.chapterCard(c,lt,t,n,title,o)：晨光海面＋远处岩石＋「第 N 章」金色大字＋章名＋N 站航线（小船从上一站驶到本站）。o {tint 'dawn', sat, rock（默认 true）, anchor（日期锚点小字，如 '公元 711 年'）}
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const tint = o.tint || 'dawn', hz = 930, q = MO.cubicOut(K.at(lt, 0, 2.6)), oo = { tint, sat: o.sat, hz };
  K.bg(c, t, { ...oo, sun: [lerp(640, 700, q), lerp(hz + 20, hz - 250, q)], glow: 0.5 + 0.5 * q });
  K.far(c, t, { ...oo, kind: 'africa', x: 650 });
  if (o.rock !== false) K.rock(c, 320, hz + 170, 0.72, { ...oo, t, reflect: 0.3 });
  K.land(c, t, [[-40, hz + 168], [640, hz + 168], [460, hz + 230], [300, hz + 330], [-40, hz + 450]], { ...oo, foam: [[640, hz + 170], [460, hz + 232], [300, hz + 332], [-40, hz + 452]] });
  const a1 = K.pop(lt, 0.35, 0.6), a2 = K.at(lt, 0.9, 0.6);
  if (a1 > 0) K.bigNum(c, `第 ${n} 章`, W / 2, 250 + (1 - clamp(a1)) * 40, { size: 150, alpha: clamp(a1 * 2) });
  const lines = K.splitTitle(title), size = lines.length > 1 ? 104 : [...title].length > 6 ? 118 : 138, cy = lines.length > 1 ? 500 : 470;
  lines.forEach((ln, i) => { const shown = TY.typed(ln, K.at(lt, 0.9 + i * 0.5, Math.max(0.35, [...ln].length / 14))); if (shown) K.text(c, shown, W / 2, cy + (i - (lines.length - 1) / 2) * size * 1.2, { size, maxW: 960 }); });
  if (o.anchor && a2 > 0) K.text(c, o.anchor, W / 2, cy + (lines.length > 1 ? size * 1.3 : size * 0.95), { size: 56, alpha: a2 });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 90, x1 = 990, ry = 1250, X = i => lerp(x0, x1, i / (N - 1)), rq = MO.cubicOut(K.at(lt, 1.2, 0.5));
  if (rq > 0) { c.save(); c.strokeStyle = 'rgba(58,42,74,.8)'; c.lineWidth = 6; c.lineCap = 'round'; c.setLineDash([2, 16]); c.beginPath(); c.moveTo(x0 - 20, ry); c.lineTo(lerp(x0 - 20, x1 + 20, rq), ry); c.stroke(); c.setLineDash([]); c.restore(); }
  const walkEnd = 2.4, wq = MO.cubicInOut(K.at(lt, 1.35, walkEnd - 1.35)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 40;
  if (lt > 1.4) for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.4) : 1; c.save(); c.fillStyle = past || cur ? C.gold : C.cream; c.strokeStyle = C.ink; c.lineWidth = cur ? 5 : 3.5; c.beginPath(); c.arc(X(i), ry, cur ? 20 * Math.max(0.5, pp) : 10, 0, TAU); c.fill(); c.stroke(); c.restore(); }
  if (lt > 1.35 && rq > 0.9) K.cardToken(c, lerp(from, done, wq), ry - 40 + Math.sin(t * 2.2) * 2, lt, t, lt < walkEnd, walkEnd, o);
  K.finish(c, { tint, sat: o.sat });
};
// 字幕（assemble 生成的 subs.js 调它）：深紫褐半透明圆角条＋奶白字＋金色细边，字幕带 y≈1480，让开视频号底栏
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; const w = Math.min(1040, c.measureText(text).width + 72), h = 90, x = 540, y = 1480;
  c.shadowColor = 'rgba(20,14,34,.35)'; c.shadowBlur = 18; c.fillStyle = 'rgba(46,34,62,.78)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 26); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(232,176,74,.85)'; c.lineWidth = 3; c.stroke(); c.fillStyle = C.cream; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 2, 1000); c.restore(); };
})();
