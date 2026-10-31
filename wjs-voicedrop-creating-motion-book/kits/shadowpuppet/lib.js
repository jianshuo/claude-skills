// 画风套件 shadowpuppet（配方 huashu-art-motion 34_shadowpuppet「中国皮影」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：整片是一块「影窗」——背后一盏灯把幕布照亮，所有形体都是镂空皮件（皮色 × 幕布色 = multiply 透光，刻纹处透出幕布光）。
//       皮件 = 填色 → 刻纹（destination-out，鱼子纹/团花/云纹/方格/刻线）→ 补皮边 → 深褐描边（K.piece）；印到幕布：先偏移软影再 multiply 本体（K.cut）。
//       偶人 K.puppet 是提线偶：铆钉关节，10fps 步进抖动，杆线从颈和手通到画面下缘（越近字幕带越淡）。
//       幕布三套色轮换（避免整片一片棕）：day 暖黄 / dusk 玫瑰暮色 / night 月光冷蓝。灯焰 15fps 跳，光斑在 K.bg 里。
//       竖屏版式：主体放 y 290–1250（15%–65%），下方留给字幕；道具要比偶人更亮更大，线条粗（刻线 ≥ 6px、街宽 ≥ 24px）。
//       所有随机走 U.hash / U.rng，同一 t 画同一帧；静态层（幕布、城市）离屏缓存，偶人/道具各用一块按尺寸分档复用的小画布。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  edge: '#3a160a', ink: '#3a160a', ink2: '#6a3a1a', cream: '#FFF1C4', creamDk: '#F6D783', sub: '#c9a070',
  red: '#c0352a', redLt: '#d9503c', green: '#2f7d4c', greenLt: '#4a9a62', amber: '#d99a2e', yellow: '#e2bd4a', blue: '#2c5a8a', orange: '#d9782a',
  tan: '#e6c07a', tanLt: '#f2dca4', shoe: '#5a2a14', skin: '#eab85c', teal: '#2a8a8a', plum: '#8a3a5a', brown: '#8a5a2c',
};
// 幕布三套色：stops [中心, 亮, 中, 边]；lamp 灯色；city 三层城市皮色（远→近）；ground 地面皮色
const SCREEN = {
  day: { stops: ['#fffbe6', '#fbe6b0', '#e8bb7a', '#a8743c'], lamp: '255,238,190', city: ['#e3b27a', '#c48a54', '#9a6030'], ground: '#7a4620' },
  dusk: { stops: ['#fff0d2', '#fbc9a0', '#de8068', '#7a3a52'], lamp: '255,214,170', city: ['#e09a80', '#b8605a', '#7e3a4a'], ground: '#5a2a3a' },
  night: { stops: ['#f0f6ff', '#b4c9ee', '#6c88c6', '#26336a'], lamp: '214,230,255', city: ['#8aa0d4', '#5a72b0', '#34478a'], ground: '#1c2a5a' },
};
K.SCREEN = SCREEN; K.tone = 'day';

K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
K.poly = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
K.last = (t, arr) => { let r = -1e9; for (const a of arr) if (a <= t) r = Math.max(r, a); return r; };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };

// ======================= 皮件 / 印到幕布 =======================
K.carve = P.carve;   // dots 鱼子纹 / flowers 团花 / clouds 云纹 / lattice 方格 / lines 刻线
// 一块皮件（在 g 上画）：填色 → carve(g) 刻纹 → 补皮边 → 深褐描边。o: { edge=5, line, lw }
K.piece = (g, path, col, carve, o = {}) => P.piece(g, path, col, carve, { edge: o.edge ?? 5, line: o.line || C.edge, lw: o.lw ?? 3 });
K.rivet = (g, x, y, r = 8) => { g.fillStyle = '#2a1006'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = '#c8924a'; g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r * 0.4, 0, TAU); g.fill(); };
// 分档复用的离屏小画布（宽高向上取 128 的倍数）
const POOL = {};
const layerFor = (w, h) => { const kw = Math.ceil(w / 128) * 128, kh = Math.ceil(h / 128) * 128, k = kw + 'x' + kh; return POOL[k] || (POOL[k] = P.canvas(kw, kh)); };
// 印一组皮件：在 (x0,y0,w,h) 这块区域里 fn(g) 用「世界坐标」画皮件，然后软影＋multiply 印到幕布 c。
// o: { alpha, dx, dy, shadow }  （镜头放大时离屏按放大倍数画，不糊）
K.cut = (c, x0, y0, w, h, fn, o = {}) => {
  const m = c.getTransform(), sc = clamp(Math.hypot(m.a, m.b) || 1, 1, 2), lw = Math.min(Math.ceil(w * sc), 2400), lh = Math.min(Math.ceil(h * sc), 2400);
  const L = layerFor(lw, lh), g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.width, L.height);
  g.save(); g.scale(lw / w, lh / h); g.translate(-x0, -y0); fn(g); g.restore();
  const al = o.alpha ?? 1, dx = o.dx ?? 7, dy = o.dy ?? 5, sh = o.shadow ?? 0.26;
  c.save(); c.globalCompositeOperation = 'multiply';
  if (sh > 0 && al > 0) { c.globalAlpha = al * sh; c.drawImage(L, 0, 0, lw, lh, x0 + dx, y0 + dy, w, h); c.globalAlpha = al * sh * 0.5; c.drawImage(L, 0, 0, lw, lh, x0 + dx * 1.6 + 2, y0 + dy * 1.6 + 2, w, h); }
  c.globalAlpha = al; c.drawImage(L, 0, 0, lw, lh, x0, y0, w, h); c.restore();
};
// 道具通用：以 (x,y) 为中心、半径 R 的方框；fn(g, pc) 里 pc(path,col,carve,edge) 画一块皮件，坐标以 (x,y) 为原点；o.rot 旋转，o.s 缩放，o.t 有就加 10fps 晃
const prop = (c, x, y, R, fn, o = {}) => {
  const ts = o.t == null ? 0 : U.stepTime(o.t, 10), wob = o.t == null ? 0 : 0.018 * Math.sin(ts * 5 + (o.seed || 0)), s = o.s ?? 1, RR = R * s * 1.3 + 14;
  K.cut(c, x - RR, y - RR, RR * 2, RR * 2, g => { g.translate(x, y); g.rotate((o.rot || 0) + wob); g.scale(s, s); fn(g, (path, col, carve, edge) => K.piece(g, path, col, carve, { edge: edge ?? 5 })); }, o);
};

// ======================= 幕布 + 灯 =======================
const WEAVE = () => P.cached('sp_weave', 256, 256, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); const r = U.rng(5);
  g.strokeStyle = 'rgba(110,80,40,.10)'; g.lineWidth = 1; for (let x = 0; x < 256; x += 4) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, 256); g.stroke(); } for (let y = 0; y < 256; y += 4) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(256, y + .5); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,60,30,${0.03 + r() * 0.05})`; g.fillRect(r() * 256, r() * 256, 3 + r() * 6, 2); } });
const screenTex = tone => P.cached('sp_screen_' + tone, W, H, g => { const S = SCREEN[tone] || SCREEN.day, [a, b, c2, d] = S.stops;
  const gr = g.createRadialGradient(540, 700, 40, 540, 800, 1250); gr.addColorStop(0, a); gr.addColorStop(0.28, b); gr.addColorStop(0.62, c2); gr.addColorStop(1, d); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(WEAVE(), 'repeat'); g.fillRect(0, 0, W, H); g.restore(); });
// 幕布＋灯光。o: { tone:'day'|'dusk'|'night', lx, ly 灯心（光斑）, r 光斑半径, flicker 0..1 }
K.bg = (c, t, o = {}) => {
  const tone = SCREEN[o.tone] ? o.tone : 'day'; K.tone = tone; const S = SCREEN[tone];
  c.drawImage(screenTex(tone), 0, 0);
  const ft = U.stepTime(t, 15), fl = (0.5 * P.noise(ft * 3, 1) + 0.3 * P.noise(ft * 9, 4)) * (o.flicker ?? 1);
  const lx = (o.lx ?? 540) + fl * 18, ly = (o.ly ?? 700) + P.noise(ft * 2, 7) * 12, r = (o.r ?? 440) * (1 + fl * 0.08);
  c.save(); c.globalCompositeOperation = 'screen'; const hg = c.createRadialGradient(lx, ly, 0, lx, ly, r);
  hg.addColorStop(0, `rgba(${S.lamp},${0.55 + fl * 0.25})`); hg.addColorStop(1, `rgba(${S.lamp},0)`); c.fillStyle = hg; c.fillRect(lx - r, ly - r, 2 * r, 2 * r); c.restore();
};
// 灯与光圈：已知（圈内）/ 未知（圈外压暗）。(x,y) 灯心，r 光圈半径。
// o: { dark 0..1 圈外压暗程度, soft 边缘虚化, ring 画剪纸虚线圈, lamp 在灯心画一盏油灯, grow 0..1 光圈长出来, s 油灯大小 }
K.lamp = (c, t, x, y, r, o = {}) => {
  const { dark = 0.4, soft = 0.45, ring = true, lamp = false, grow = 1 } = o, S = SCREEN[K.tone] || SCREEN.day, rr = Math.max(1, r * grow);
  const ft = U.stepTime(t, 15), fl = 0.5 * P.noise(ft * 3, 3) + 0.3 * P.noise(ft * 9, 6), R = rr * (1 + fl * 0.03);
  if (dark > 0) { c.save(); c.globalCompositeOperation = 'multiply'; const [rd, gd, bd] = K.tone === 'night' ? [18, 22, 60] : K.tone === 'dusk' ? [60, 22, 40] : [50, 20, 6];
    const g = c.createRadialGradient(x, y, R * (1 - soft), x, y, R * (1 + soft * 0.35)); g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(1, `rgb(${Math.round(lerp(255, rd, dark))},${Math.round(lerp(255, gd, dark))},${Math.round(lerp(255, bd, dark))})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }
  if (ring) { c.save(); c.strokeStyle = `rgba(${S.lamp},.9)`; c.lineWidth = 7; c.lineCap = 'round'; c.setLineDash([26, 20]); c.lineDashOffset = -U.stepTime(t, 6) * 8; c.beginPath(); c.arc(x, y, R * 0.98, 0, TAU); c.stroke(); c.restore(); }
  if (lamp) K.oilLamp(c, t, x, y, { s: o.s ?? 1 });
};
// 一盏油灯（皮件）：灯座＋灯碗＋灯焰（发光）。(x,y) 是火焰中心
K.oilLamp = (c, t, x, y, o = {}) => { const s = o.s ?? 1;
  prop(c, x, y + 70 * s, 120, (g, pc) => { pc(K.round(-26, -10, 52, 62, [8, 8, 12, 12]), C.brown, k => K.carve.lines(k, [[[-10, 6], [-10, 42]], [[10, 6], [10, 42]]], 5)); pc(K.round(-58, 44, 116, 22, 11), C.brown);
    pc(K.smooth([[-66, -34], [66, -34], [50, 0], [0, 12], [-50, 0]]), C.amber, k => K.carve.dots(k, -56, -28, 56, -4, 20, 4.5)); }, { ...o, shadow: 0.2 });
  const ft = U.stepTime(t, 15), fl = 0.5 * P.noise(ft * 3, 9) + 0.3 * P.noise(ft * 9, 2), S = SCREEN[K.tone] || SCREEN.day;
  c.save(); c.globalCompositeOperation = 'screen'; const hg = c.createRadialGradient(x, y, 0, x, y, 120 * s); hg.addColorStop(0, 'rgba(255,255,235,.95)'); hg.addColorStop(0.35, `rgba(${S.lamp},.5)`); hg.addColorStop(1, `rgba(${S.lamp},0)`); c.fillStyle = hg; c.fillRect(x - 130 * s, y - 130 * s, 260 * s, 260 * s);
  c.fillStyle = 'rgba(255,255,240,.95)'; c.beginPath(); c.ellipse(x, y + 6 * s, 15 * s, (30 + fl * 14) * s, 0, 0, TAU); c.fill(); c.restore(); };

// ======================= 杆线 / 提线 =======================
// 杆：从各点通到画面下缘（end 之前实、之后淡出），multiply 深褐。pts: [[x,y],…]；o: { w=6, end=1440, dx 下端水平偏移, rivet }
K.rods = (c, pts, o = {}) => { const { w = 6, end = 1440, dx = 0, rivet = false } = o;
  c.save(); c.globalCompositeOperation = 'multiply'; c.lineCap = 'round';
  pts.forEach(([px, py]) => { if (py >= end) return; const g = c.createLinearGradient(0, py, 0, end + 120); g.addColorStop(0, 'rgba(70,30,10,.75)'); g.addColorStop(clamp((end - 140 - py) / (end + 120 - py)), 'rgba(70,30,10,.7)'); g.addColorStop(1, 'rgba(70,30,10,0)');
    c.strokeStyle = g; c.lineWidth = w; c.beginPath(); c.moveTo(px, py); c.lineTo(px + dx, end + 120); c.stroke(); });
  c.restore(); if (rivet) pts.forEach(([px, py]) => { c.save(); K.rivet(c, px, py, 8); c.restore(); }); };
// 细线（提线/连线）：从 a 到 b，下垂 sag；tense 0..1 绷紧（1 = 直线）；draw 0..1 画出来
K.string = (c, ax, ay, bx, by, o = {}) => { const { w = 4, sag = 40, tense = 0, draw = 1, col = 'rgba(70,30,10,.85)', t } = o; if (draw <= 0) return;
  const sg = sag * (1 - tense) * (1 + (t == null ? 0 : 0.06 * Math.sin(U.stepTime(t, 10) * 3)));
  c.save(); c.globalCompositeOperation = 'multiply'; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i <= 24; i++) { const q = i / 24 * draw, x = lerp(ax, bx, q), y = lerp(ay, by, q) + Math.sin(q * Math.PI) * sg; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); };

// ======================= 提线偶人 =======================
// K.puppet(c, pose, x, y, s, o) —— (x,y) 是两脚中点（地面），s=1 时全高约 680px（含帽）。
// pose：stand 站 / walk 走 / raise 举手 / down 低头 / point 指 / shrug 摊手 / lift 双手托举 / think 托腮 / wave 挥手 / bow 作揖
// o: { to 混向的姿势, mix 0..1, t 全片时间（10fps 步进抖动）, dir 1 朝右 -1 朝左, walk 走路相位（弧度，默认 t*7）, hat 'cap'|'bun'|'wusha'|'none',
//      cols:{robe,top,hair,hat,skin,shoe,belt}, rods 画杆（默认 true）, handRods 画手杆（默认举手时画）, alpha, seed, jitter 抖动强度（默认 1）, face 空脸（默认 true）}
// 返回屏幕坐标锚点 { head, top, neck, handA, handB, feet, chest, elbowA }（handA 是近侧手，托举/指向的东西挂在这）
const POSES = {
  stand: { lean: 0, head: 0, A: [0.12, 0.18], B: [-0.12, 0.12] },
  raise: { lean: -0.02, head: -0.14, A: [2.7, 0.1], B: [0.08, 0.2] },
  down: { lean: 0.08, head: 0.5, A: [0.3, 0.5], B: [0.12, 0.5] },
  point: { lean: 0.05, head: -0.03, A: [1.5, 0.0], B: [-0.12, 0.12], finger: 1 },
  shrug: { lean: 0, head: 0.06, A: [0.75, 1.05], B: [-0.75, -1.05] },
  lift: { lean: -0.03, head: -0.1, A: [2.25, 0.5], B: [2.0, 0.7] },
  think: { lean: 0.03, head: 0.12, A: [0.65, 2.15], B: [-0.1, 0.12] },
  bow: { lean: 0.5, head: 0.2, A: [0.9, 1.8], B: [0.6, 1.8] },
};
K.POSES = ['stand', 'walk', 'raise', 'down', 'point', 'shrug', 'lift', 'think', 'wave', 'bow'];
const poseAt = (name, t, ph) => {
  if (name === 'walk') return { lean: 0.05, head: 0.02, A: [0.1 + 0.55 * Math.sin(ph), 0.25 + 0.2 * Math.max(0, Math.cos(ph))], B: [-0.1 - 0.55 * Math.sin(ph), 0.2], walk: ph };
  if (name === 'wave') return { lean: -0.02, head: -0.06, A: [2.45, 0.55 * Math.sin(t * 9)], B: [-0.1, 0.1] };
  return POSES[name] || POSES.stand;
};
const mixPose = (a, b, k) => ({ lean: lerp(a.lean, b.lean, k), head: lerp(a.head, b.head, k), A: [lerp(a.A[0], b.A[0], k), lerp(a.A[1], b.A[1], k)], B: [lerp(a.B[0], b.B[0], k), lerp(a.B[1], b.B[1], k)],
  walk: k < 0.5 ? a.walk : b.walk, finger: lerp(a.finger || 0, b.finger || 0, k) });
const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const PUP = { robe: C.green, top: C.red, hair: C.amber, hat: C.red, skin: C.skin, shoe: C.shoe, belt: C.yellow };
const FACE = [[6, -58], [38, -56], [52, -38], [54, -18], [72, 2], [54, 10], [56, 24], [48, 30], [54, 40], [44, 54], [18, 66], [-6, 54], [-14, 8], [-10, -34]];
K.puppet = (c, pose, x, y, s = 1, o = {}) => {
  const t = U.stepTime(o.t ?? 0, 10), ti = Math.round(t * 10), dir = o.dir ?? 1, cols = { ...PUP, ...(o.cols || {}) }, seed = o.seed ?? 1, jit = o.jitter ?? 1, hat = o.hat ?? 'cap';
  const J = i => (U.hash(ti, i + seed * 13) - 0.5) * jit;
  const ph = o.walk ?? t * 7; let pz = poseAt(pose, t, ph); if (o.to) pz = mixPose(pz, poseAt(o.to, t, ph), clamp(o.mix ?? 0));
  const sway = 0.012 * Math.sin(t * 4.4 + seed) + J(3) * 0.012, X = x + J(1) * 4, Y = y + J(2) * 3 + (pz.walk != null ? -Math.abs(Math.sin(pz.walk)) * 6 * s : 0);
  const lean = pz.lean + J(4) * 0.03, headT = pz.head + 0.04 * Math.sin(t * 3 + seed) + J(5) * 0.05;
  // 坐标：HIP 在偶人局部（脚底为原点，上为负）；SH / NK 与手臂点都是「腰相对」（随上身前倾一起转）
  const HIP = [0, -235], SH = [0, -195], NK = [0, -205], L1 = 108, L2 = 98;
  const arm = (a, jj) => { const a1 = a[0] + J(jj) * 0.06, a2 = a1 + a[1] + (pz.finger > 0.5 ? 0 : 0.06 * Math.sin(t * 11 + jj + seed)), E = [SH[0] + L1 * Math.sin(a1), SH[1] + L1 * Math.cos(a1)], Hd = [E[0] + L2 * Math.sin(a2), E[1] + L2 * Math.cos(a2)]; return { E, Hd, a2 }; };
  const A = arm(pz.A, 10), B = arm(pz.B, 20);
  const sp = pz.walk != null ? Math.sin(pz.walk) : 0, lf = pz.walk != null ? [Math.max(0, Math.cos(pz.walk)) * 16, Math.max(0, -Math.cos(pz.walk)) * 16] : [0, 0];
  const feet = [[-26 - sp * 40, -lf[0]], [30 + sp * 40, -lf[1]]];
  const up = p => { const q = rot2(p, lean); return [q[0] + HIP[0], q[1] + HIP[1]]; };
  const toScr = p => { const q = rot2([p[0] * dir * s, p[1] * s], sway); return [X + q[0], Y + q[1]]; };
  const hc = rot2([12, -80], headT), headC = up([NK[0] + hc[0], NK[1] + hc[1]]);
  const anchors = { neck: toScr(up(NK)), head: toScr(headC), top: toScr([headC[0], headC[1] - 90]), handA: toScr(up(A.Hd)), handB: toScr(up(B.Hd)), feet: [X, Y], chest: toScr(up([0, -110])), elbowA: toScr(up(A.E)) };
  const R = 400 * s, bx = X - R, by = Y - 780 * s, bw = 2 * R, bh = 830 * s;
  K.cut(c, bx, by, bw, bh, g => {
    g.translate(X, Y); g.rotate(sway); g.scale(dir * s, s);
    const pc = (path, col, carve, edge) => K.piece(g, path, col, carve, { edge: edge ?? 5, lw: 3.2 });
    const sleeve = (E, Hd, a2, wS) => { pc(RIG.taper(SH, E, wS, wS * 0.8, 6), cols.top, k => K.carve.clouds(k, SH[0] - 70, SH[1] - 70, SH[0] + 80, SH[1] + 140, 34)); pc(RIG.taper(E, Hd, wS * 0.8, wS * 0.66), cols.top, k => K.carve.lines(k, [[[E[0] - 8, E[1] + 6], [lerp(E[0], Hd[0], 0.7), lerp(E[1], Hd[1], 0.7)]]], 6), 4);
      pc(K.ellipse(Hd[0], Hd[1], 24, 19, a2 - Math.PI / 2), cols.skin, null, 4); };
    // 远侧手臂（B）、脚
    g.save(); g.translate(HIP[0], HIP[1]); g.rotate(lean); sleeve(B.E, B.Hd, B.a2, 52); g.restore();
    feet.forEach(([fx, fy]) => { pc(RIG.taper([fx * 0.4, -170], [fx, fy - 30], 34, 26), cols.robe, null, 4); pc(K.smooth([[fx - 24, fy - 4], [fx + 38, fy - 4], [fx + 54, fy - 18], [fx + 40, fy - 30], [fx - 20, fy - 30]]), cols.shoe, null, 4); });
    // 长袍下身
    pc(K.smooth([[-52, -240], [52, -240], [82, -140], [114, -48], [-114, -48], [-82, -140]]), cols.robe, k => { K.carve.lines(k, [[[-38, -190], [-60, -66]], [[0, -190], [0, -66]], [[40, -190], [64, -66]]], 6); K.carve.dots(k, -110, -92, 110, -52, 22, 4.6); });
    pc(K.smooth([[-112, -64], [112, -64], [116, -44], [-116, -44]]), cols.belt, null, 4);
    // 上身（绕腰前倾）
    g.save(); g.translate(HIP[0], HIP[1]); g.rotate(lean);
    pc(K.smooth([[-56, 8], [56, 8], [62, -90], [52, -192], [-52, -192], [-62, -90]]), cols.top, k => K.carve.flowers(k, -56, -180, 56, 0, 48, 6.5));
    pc(K.round(-66, -14, 132, 28, 12), cols.belt, k => K.carve.dots(k, -60, -8, 60, 10, 20, 4.2), 4);
    pc(K.round(-18, -222, 36, 40, 8), cols.skin, null, 4);
    // 头（绕颈转）
    g.save(); g.translate(NK[0], NK[1]); g.rotate(headT);
    pc(K.ellipse(10, -82, 68, 78), cols.hair, k => K.carve.clouds(k, -50, -150, 60, -90, 30));
    if (hat === 'cap') { pc(K.smooth([[-52, -142], [-14, -178], [46, -170], [60, -138], [40, -128], [-40, -126]]), cols.hat, k => K.carve.dots(k, -40, -168, 50, -140, 16, 3.8), 4);
      pc(K.smooth([[-48, -140], [-100, -126], [-112, -90], [-82, -104], [-44, -116]]), cols.hat, null, 4); }
    else if (hat === 'wusha') { pc(K.round(-40, -204, 92, 66, 12), C.shoe, k => K.carve.dots(k, -34, -196, 44, -146, 16, 3.6), 4); pc(K.round(-104, -184, 70, 22, 8), C.shoe, null, 4); pc(K.round(34, -184, 70, 22, 8), C.shoe, null, 4); }
    else if (hat === 'bun') { pc(K.circle(-44, -150, 30), cols.hair, k => K.carve.clouds(k, -70, -176, -18, -126, 24), 4); pc(K.round(-52, -150, 10, 70, 4), C.yellow, null, 3); pc(K.smooth([[-30, -138], [40, -150], [62, -118], [-20, -112]]), cols.hair, null, 4); }
    if (o.face !== false) { const face = K.smooth(FACE); g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(face); g.restore();
      g.strokeStyle = C.edge; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke(face);
      g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(20, -36); g.quadraticCurveTo(34, -46, 50, -38); g.stroke();
      g.beginPath(); g.moveTo(22, -16); g.quadraticCurveTo(36, -28, 52, -14); g.quadraticCurveTo(36, -8, 22, -16); g.stroke(); g.fillStyle = C.edge; g.beginPath(); g.arc(40, -17, 4.5, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(34, 36); g.quadraticCurveTo(44, 40, 52, 36); g.stroke(); }
    g.restore();
    K.rivet(g, NK[0], NK[1] + 4, 9);
    // 近侧手臂（A）
    sleeve(A.E, A.Hd, A.a2, 56);
    if (pz.finger > 0.3) { const f = pz.finger; pc(RIG.taper(A.Hd, [A.Hd[0] + Math.sin(A.a2) * 58 * f, A.Hd[1] + Math.cos(A.a2) * 58 * f], 16, 8), cols.skin, null, 3); }
    K.rivet(g, SH[0], SH[1], 9); K.rivet(g, A.E[0], A.E[1], 8); K.rivet(g, B.E[0], B.E[1], 7);
    g.restore();
  }, { alpha: o.alpha ?? 1 });
  if (o.rods !== false && (o.alpha ?? 1) > 0.3) { const pts = [anchors.neck]; if (o.handRods ?? (pz.A[0] > 1.8 || pz.B[0] > 1.8)) pts.push(anchors.handA); K.rods(c, pts, { w: 6 * Math.max(0.8, s) }); }
  return anchors;
};
// 一排偶人（错开相位、轮换服色与帽）：n 个，间距 gap，大小 s
K.crowd = (c, t, x, y, n, gap, s, o = {}) => { const out = []; for (let i = 0; i < n; i++) { const cols = [[C.green, C.red], [C.blue, C.orange], [C.plum, C.teal], [C.red, C.green]][i % 4];
  out.push(K.puppet(c, o.pose || 'stand', x + (i - (n - 1) / 2) * gap, y, s, { t: t + i * 0.13, seed: 3 + i, hat: ['cap', 'bun', 'wusha', 'none'][i % 4], cols: { robe: cols[0], top: cols[1] }, rods: o.rods ?? false, dir: o.dir ?? 1, walk: (o.walk ?? t * 7) + i })); } return out; };

// ======================= 地图 / 城市 / 地面 =======================
// 镂空地图（亮色大皮件，街道是整条透光的粗槽）。(x,y) 中心，w×h。
// o: { streets: n（默认 3）| [[x0,y0,x1,y1]…]（相对中心），sw 街宽（默认 26）, grow 0..1 街一条条长出来, mark:[x,y]（相对中心）红点, rot, s, t, col }
K.map = (c, x, y, w, h, o = {}) => { const sw = o.sw ?? 26, grow = o.grow ?? 1, col = o.col || C.tanLt;
  let st = o.streets; if (typeof st === 'number' || st == null) { const n = st ?? 3, base = [[-w * .4, -h * .18, w * .4, -h * .18], [-w * .4, h * .2, w * .4, h * .2], [-w * .06, -h * .4, -w * .06, h * .4], [w * .2, -h * .4, w * .2, h * .4], [-w * .3, -h * .4, -w * .3, h * .4], [-w * .4, 0, w * .4, 0]]; st = base.slice(0, n); }
  prop(c, x, y, Math.max(w, h) * 0.75, (g, pc) => {
    pc(K.round(-w / 2, -h / 2, w, h, 16), col, k => {
      st.forEach(([x0, y0, x1, y1], i) => { const p = clamp(grow * st.length - i); if (p <= 0) return; k.lineWidth = sw; k.lineCap = 'round'; k.beginPath(); k.moveTo(x0, y0); k.lineTo(lerp(x0, x1, p), lerp(y0, y1, p)); k.stroke(); });
      for (let i = -w / 2 + 28; i < w / 2 - 20; i += 24) { k.beginPath(); k.arc(i, -h / 2 + 18, 4.2, 0, TAU); k.arc(i, h / 2 - 18, 4.2, 0, TAU); k.fill(); }
      for (let j = -h / 2 + 28; j < h / 2 - 20; j += 24) { k.beginPath(); k.arc(-w / 2 + 18, j, 4.2, 0, TAU); k.arc(w / 2 - 18, j, 4.2, 0, TAU); k.fill(); } }, 7);
    if (o.mark) { const [mx, my] = o.mark; g.fillStyle = C.red; g.strokeStyle = C.edge; g.lineWidth = 4; g.beginPath(); g.arc(mx, my, 20, 0, TAU); g.fill(); g.stroke(); }
  }, { ...o, shadow: 0.3 }); };
// 城市剪影（多层瓦顶＋层檐，亮窗是镂空）。base 地平线 y，h 高度系数，alpha，rise 0..1 从地里长出来，seed，layers 1..3，lit 亮窗密度。皮色随当前幕布色（先调 K.bg）
K.city = (c, t, o = {}) => { const { base = 1260, h = 1, alpha = 1, rise = 1, seed = 11, layers = 3, lit = 0.2 } = o, tone = K.tone, S = SCREEN[tone] || SCREEN.day, HH = 1000;
  const tex = P.cached(`sp_city_${tone}_${seed}_${layers}_${lit}_${h}`, W, HH, g => { const r = U.rng(seed), cols = S.city.slice(3 - layers);
    cols.forEach((col, li) => { const bb = HH - 60 - (cols.length - 1 - li) * 40, k = 1 - (cols.length - 1 - li) * 0.1; g.save(); g.fillStyle = col; let x = -40 + li * 30;
      while (x < W + 40) { const w = 84 + r() * 90, hh = (170 + r() * 420) * h * k, top = bb - hh, tiers = 1 + (r() * 3 | 0), parts = [];   // 每块单独 fill（合成一条 path 会因缠绕方向相反挖出洞）
        const rc = new Path2D(); rc.rect(x, top + 30, w, hh + 120); parts.push(rc); let ty = top + 30, tw = w + 20, tx = x - 10, rx = x + w / 2, ry = ty;
        for (let i = 0; i < tiers; i++) { const rh = 36 + r() * 20, p = new Path2D(); rx = tx + tw / 2; ry = ty - 38 - rh * .5; p.moveTo(tx - 22, ty - 10); p.quadraticCurveTo(tx + 6, ty + 8, tx + tw * .28, ty - 16); p.quadraticCurveTo(tx + tw * .42, ty - 32 - rh * .4, tx + tw / 2, ty - 38 - rh * .5);
          p.quadraticCurveTo(tx + tw * .58, ty - 32 - rh * .4, tx + tw * .72, ty - 16); p.quadraticCurveTo(tx + tw - 6, ty + 8, tx + tw + 22, ty - 10); p.lineTo(tx + tw, ty + 16); p.lineTo(tx, ty + 16); p.closePath(); parts.push(p);
          ty -= rh + 40; tw *= 0.74; tx = x + w / 2 - tw / 2; const wl = new Path2D(); wl.rect(tx + 8, ty + 16, tw - 16, rh + 30); parts.push(wl); }
        const sp = new Path2D(); sp.moveTo(rx - 6, ry + 6); sp.lineTo(rx, ry - 34 - r() * 26); sp.lineTo(rx + 6, ry + 6); sp.closePath(); parts.push(sp);
        parts.forEach(p => g.fill(p)); if (li === cols.length - 1) { g.strokeStyle = 'rgba(58,22,8,.5)'; g.lineWidth = 3; parts.forEach(p => g.stroke(p)); }
        if (li === cols.length - 1) for (let wy = top + 80; wy < bb - 40; wy += 52) if (r() < lit) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(x + w * 0.32, wy, 16, 24); g.restore(); }
        x += w * (0.72 + r() * 0.26); }
      g.restore(); }); });
  c.save(); c.globalAlpha *= alpha; c.globalCompositeOperation = 'multiply'; const dy = (1 - clamp(rise)) * 420; c.beginPath(); c.rect(0, base - HH + 60, W, HH - 60); c.clip();
  c.drawImage(tex, 0, base - HH + 60 + dy); c.restore(); };
// 地面带（偶人站的台）：深色皮件，刻鱼子纹；y 是地面线
K.ground = (c, y, o = {}) => { const S = SCREEN[K.tone] || SCREEN.day, col = o.col || S.ground;
  K.cut(c, 0, y - 40, W, 190, g => { K.piece(g, K.round(-40, y, W + 80, 130, 0), col, k => { k.beginPath(); for (let i = -20; i < W + 40; i += 26) { k.moveTo(i + 6, y + 40); k.arc(i + 8, y + 40, 6, 0, TAU); k.moveTo(i + 19, y + 80); k.arc(i + 21, y + 80, 6, 0, TAU); } k.fill(); }, { edge: 7 });
    const r = U.rng(21); g.fillStyle = col; for (let i = 0; i < 26; i++) { const gx = r() * W; g.beginPath(); g.moveTo(gx - 6, y + 2); g.quadraticCurveTo(gx, y - 20 - r() * 14, gx + 8, y + 2); g.fill(); } }, { shadow: 0.15, dy: -4 }); };

// ======================= 道具（均为镂空皮件；(x,y) 为中心，o.t 有就 10fps 轻晃，o.s 缩放，o.rot 旋转） =======================
// 箭头：从 (x,y) 指向 ang（弧度），长 len，粗 o.th。o.grow 0..1 伸出来
K.arrow = (c, x, y, len, ang = 0, o = {}) => { const th = o.th ?? 64, L = len * (o.grow ?? 1); if (L < 4) return;
  prop(c, x + Math.cos(ang) * L / 2, y + Math.sin(ang) * L / 2, L / 2 + th, (g, pc) => { g.rotate(ang); g.translate(-L / 2, 0); const hd = Math.min(th * 1.5, L * 0.5);
    pc(K.smooth([[0, -th / 3], [L - hd, -th / 3], [L - hd, -th * .75], [L, 0], [L - hd, th * .75], [L - hd, th / 3], [0, th / 3]], true), o.col || C.red, k => { k.lineWidth = 7; k.lineCap = 'round'; k.beginPath(); k.moveTo(th * .6, 0); k.lineTo(Math.max(th * .6, L - hd - th * .4), 0); k.stroke(); }); }, { ...o, rot: 0 }); };
// 天平：tilt>0 右边沉。o.l / o.r 是两边托盘上的砝码数
K.scales = (c, x, y, s = 1, tilt = 0, o = {}) => { const l = o.l ?? 1, r = o.r ?? 1;
  prop(c, x, y - 120 * s, 330, (g, pc) => { g.translate(0, 80);
    pc(K.smooth([[-18, 0], [18, 0], [24, 180], [70, 220], [70, 250], [-70, 250], [-70, 220], [-24, 180]]), o.col || C.brown, k => K.carve.dots(k, -20, 30, 20, 170, 24, 4.5));
    g.save(); g.rotate(tilt); pc(K.round(-250, -14, 500, 28, 14), C.amber, k => K.carve.dots(k, -240, -8, 240, 8, 28, 4));
    [-1, 1].forEach(sd => { const n = sd < 0 ? l : r; g.save(); g.translate(sd * 250, 0); g.rotate(-tilt); g.strokeStyle = C.edge; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, 190); g.moveTo(0, 0); g.lineTo(90, 190); g.stroke();
      pc(K.smooth([[-110, 190], [110, 190], [86, 232], [0, 246], [-86, 232]]), C.red, k => K.carve.dots(k, -90, 196, 90, 226, 22, 4.5), 5);
      for (let i = 0; i < n; i++) pc(K.circle(-40 + (i % 3) * 40 + (Math.floor(i / 3) % 2) * 20, 160 - Math.floor(i / 3) * 40, 20), C.blue, null, 4);
      K.rivet(g, 0, 0, 8); g.restore(); });
    g.restore(); K.rivet(g, 0, 0, 11); }, { ...o, s: (o.s ?? 1) * s }); };
// 钟：tm 小时（可小数，3.5 = 三点半）
K.clock = (c, x, y, r = 130, tm = 3, o = {}) => prop(c, x, y, r * 1.2, (g, pc) => {
  pc(K.circle(0, 0, r), o.col || C.tanLt, k => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, q = [Math.sin(a) * r * 0.78, -Math.cos(a) * r * 0.78]; k.beginPath(); k.arc(q[0], q[1], i % 3 === 0 ? 13 : 8, 0, TAU); k.fill(); } k.beginPath(); k.arc(0, 0, r * 0.95, 0, TAU); k.lineWidth = 6; k.stroke(); }, 8);
  const ah = (tm % 12) / 12 * TAU, am = (tm % 1) * TAU;
  pc(RIG.taper([0, 0], [Math.sin(ah) * r * 0.5, -Math.cos(ah) * r * 0.5], 20, 12), C.red, null, 4); pc(RIG.taper([0, 0], [Math.sin(am) * r * 0.74, -Math.cos(am) * r * 0.74], 14, 8), C.red, null, 4); K.rivet(g, 0, 0, 10); }, o);
// 书：open 0..1（0 合上，1 摊开）
K.book = (c, x, y, s = 1, open = 1, o = {}) => prop(c, x, y, 230, (g, pc) => { const q = Math.max(0.06, open), pw = 170 * q;
  pc(K.round(-pw - 14, -130, pw * 2 + 28, 270, 12), o.cover || C.red, null, 5);
  [-1, 1].forEach(sd => { const p = K.smooth([[sd * 6, -112], [sd * pw, -120], [sd * pw, 124], [sd * 6, 130]]); pc(p, C.tanLt, k => { if (q < 0.35) return; for (let i = 0; i < 6; i++) { const yy = -80 + i * 38; k.lineWidth = 11; k.lineCap = 'round'; k.beginPath(); k.moveTo(sd * 24, yy); k.lineTo(sd * (pw - 24 - (i === 5 ? 50 : 0)), yy); k.stroke(); } }, 5); }); }, { ...o, s: (o.s ?? 1) * s });
// 树
K.tree = (c, x, y, s = 1, o = {}) => prop(c, x, y - 190 * s, 270, (g, pc) => { g.translate(0, 190); const sw = o.t == null ? 0 : 0.03 * Math.sin(U.stepTime(o.t, 10) * 3 + (o.seed || 0));
  pc(K.smooth([[-18, 0], [18, 0], [14, -150], [30, -230], [-30, -230], [-14, -150]]), C.brown, k => K.carve.lines(k, [[[-6, -10], [-4, -130]], [[8, -20], [6, -100]]], 5));
  g.translate(0, -230); g.rotate(sw); [[0, -90, 100], [-90, -30, 80], [90, -30, 80], [-40, -130, 64], [48, -134, 60]].forEach(([cx, cy, rr], i) => pc(K.circle(cx, cy, rr), o.col || (i % 2 ? C.greenLt : C.green), k => { for (let j = 0; j < 7; j++) { const a = j / 7 * TAU; k.beginPath(); k.ellipse(cx + Math.cos(a) * rr * 0.45, cy + Math.sin(a) * rr * 0.45, 10, 18, a, 0, TAU); k.fill(); } }, 5)); }, { ...o, s: (o.s ?? 1) * s });
// 齿轮：rot 弧度，o.n 齿数
K.gear = (c, x, y, r = 120, rot = 0, o = {}) => { const n = o.n ?? 10, p = new Path2D(), step = TAU / n;
  for (let i = 0; i < n; i++) { const a = i * step; [[-0.3, 0.78], [-0.2, 1.0], [0.2, 1.0], [0.3, 0.78]].forEach(([da, k], j) => { const q = [Math.cos(a + da * step * 1.6) * r * k, Math.sin(a + da * step * 1.6) * r * k]; (i === 0 && j === 0) ? p.moveTo(q[0], q[1]) : p.lineTo(q[0], q[1]); }); } p.closePath();
  prop(c, x, y, r * 1.2, (g, pc) => { g.rotate(rot); pc(p, o.col || C.amber, k => { k.beginPath(); k.arc(0, 0, r * 0.22, 0, TAU); k.fill(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.beginPath(); k.arc(Math.cos(a) * r * 0.54, Math.sin(a) * r * 0.54, r * 0.13, 0, TAU); k.fill(); } }, 6); }, o); };
// 格子表（人不是参数）：rows×cols 镂空格；o.fill 前 n 格留实心皮
K.grid = (c, x, y, w, h, rows = 4, cols = 3, o = {}) => { const cw = w / cols, ch = h / rows, pad = Math.min(cw, ch) * 0.2;
  prop(c, x, y, Math.max(w, h) * 0.75, (g, pc) => pc(K.round(-w / 2, -h / 2, w, h, 14), o.col || C.tanLt, k => { let i = 0; for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++, i++) { if (i < (o.fill ?? 0)) continue; k.fill(K.round(-w / 2 + q * cw + pad, -h / 2 + r * ch + pad, cw - pad * 2, ch - pad * 2, 8)); } }, 7), o); };
// 清单卷轴：rows 行，checked 勾了几行（红勾，o.t / o.at 控制逐个出现）
K.scroll = (c, x, y, w, h, rows = 4, checked = 0, o = {}) => { const rh = (h - 70) / rows;
  prop(c, x, y, Math.max(w, h) * 0.75, (g, pc) => { pc(K.round(-w / 2, -h / 2, w, h, 10), o.col || C.tanLt, k => { for (let i = 0; i < rows; i++) { const yy = -h / 2 + 35 + rh * (i + 0.5); k.lineWidth = 9; k.strokeRect(-w / 2 + 34, yy - 24, 48, 48); k.fill(K.round(-w / 2 + 112, yy - 8, w * (0.38 + 0.12 * ((i * 7) % 3)), 16, 8)); } }, 6);
    for (let i = 0; i < checked; i++) { const yy = -h / 2 + 35 + rh * (i + 0.5), cp = K.pop(o.t ?? 9, (o.at ?? 0) + i * 0.4, 0.3); if (cp <= 0) continue; g.strokeStyle = C.red; g.lineWidth = 11; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-w / 2 + 40, yy); g.lineTo(-w / 2 + 56, yy + 18 * Math.min(1, cp)); g.lineTo(-w / 2 + 86, yy - 28 * Math.min(1, cp)); g.stroke(); }
    [-1, 1].forEach(sd => pc(K.round(-w / 2 - 22, sd * (h / 2) - 14, w + 44, 30, 15), C.brown, k => K.carve.dots(k, -w / 2, sd * h / 2 - 8, w / 2, sd * h / 2 + 8, 22, 3.6), 4)); }, o); };
// 大字皮件（用字体做的皮件）；K.qmark 是大问号
K.glyph = (c, ch, x, y, size = 200, o = {}) => prop(c, x, y, size * 0.8, g => { g.font = `${size}px "PuHui-Black"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = Math.max(8, size * 0.07); g.strokeStyle = C.edge; g.strokeText(ch, 0, 0); g.fillStyle = o.col || C.red; g.fillText(ch, 0, 0); }, o);
K.qmark = (c, x, y, size = 200, o = {}) => K.glyph(c, '？', x, y, size, o);
// 祥云
K.cloud = (c, x, y, s = 1, o = {}) => prop(c, x, y, 230, (g, pc) => { const pts = []; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, k = 1 + 0.2 * Math.abs(Math.sin(a * 2.5)); pts.push([Math.cos(a) * 150 * k, Math.sin(a) * 78 * k + (Math.sin(a) > 0 ? 8 : 0)]); }
  pc(K.smooth(pts), o.col || C.tanLt, k => { K.carve.clouds(k, -120, -50, 120, 60, 54); }, 6); }, { ...o, s: (o.s ?? 1) * s });
// 日 / 月（o.kind 'moon'）
K.orb = (c, x, y, r = 100, o = {}) => { if (o.kind === 'moon') { const S = SCREEN[K.tone] || SCREEN.day, ft = U.stepTime(o.t ?? 0, 15), fl = 0.5 * P.noise(ft * 3, 5);   // 月是亮的：screen 叠加，不是皮件
    c.save(); c.globalCompositeOperation = 'screen'; const hg = c.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6); hg.addColorStop(0, `rgba(${S.lamp},${0.55 + fl * 0.2})`); hg.addColorStop(1, `rgba(${S.lamp},0)`); c.fillStyle = hg; c.fillRect(x - r * 2.7, y - r * 2.7, r * 5.4, r * 5.4);
    const cl = new Path2D(); cl.rect(x - r * 4, y - r * 4, r * 8, r * 8); cl.moveTo(x + r * 0.42 + r * 0.86, y - r * 0.14); cl.arc(x + r * 0.42, y - r * 0.14, r * 0.86, 0, TAU); c.clip(cl, 'evenodd');   // 月牙 = 圆 A 减去圆 B
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = 'rgba(255,250,225,.97)'; c.fill(); c.restore(); return; }
  prop(c, x, y, r * 1.5, (g, pc) => {
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; pc(RIG.taper([Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12], [Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5], 24, 8), o.col || C.yellow, null, 3); }
  pc(K.circle(0, 0, r), o.col || C.yellow, k => { k.lineWidth = 7; k.beginPath(); k.arc(0, 0, r * 0.6, 0, TAU); k.stroke(); }, 6); }, o); };
// 灯笼
K.lantern = (c, x, y, s = 1, o = {}) => prop(c, x, y, 160, (g, pc) => { g.rotate(o.t == null ? 0 : 0.05 * Math.sin(U.stepTime(o.t, 10) * 2.6));
  pc(K.ellipse(0, 0, 84, 100), o.col || C.red, k => { k.lineWidth = 8; k.beginPath(); k.ellipse(0, 0, 42, 98, 0, 0, TAU); k.moveTo(0, -98); k.lineTo(0, 98); k.stroke(); }, 6);
  pc(K.round(-40, -118, 80, 26, 8), C.shoe, null, 4); pc(K.round(-40, 92, 80, 26, 8), C.shoe, null, 4); g.strokeStyle = C.edge; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 118); g.lineTo(0, 168); g.moveTo(-10, 118); g.lineTo(-14, 160); g.moveTo(10, 118); g.lineTo(14, 160); g.stroke(); }, { ...o, s: (o.s ?? 1) * s });
// 山（x 中心，base 山脚 y）
K.mountain = (c, x, base, w, h, o = {}) => prop(c, x, base - h / 2, Math.max(w, h) * 0.65, (g, pc) => { g.translate(0, h / 2);
  pc(K.smooth([[-w / 2, 0], [-w * .22, -h * .58], [-w * .08, -h * .46], [w * .02, -h], [w * .2, -h * .5], [w * .3, -h * .62], [w / 2, 0]], true), o.col || C.brown, k => { K.carve.clouds(k, -w / 2, -h * .8, w / 2, -h * .1, 50); K.carve.lines(k, [[[-w * .3, -8], [-w * .12, -h * .4]], [[w * .1, -8], [w * .05, -h * .6]]], 7); }, 6); }, o);
// 小屋（x 中心，base 地面 y）
K.house = (c, x, base, s = 1, o = {}) => prop(c, x, base - 120 * s, 200, (g, pc) => { g.translate(0, 120);
  pc(K.round(-80, -90, 160, 90, 4), o.col || C.tanLt, k => { k.fill(K.round(-48, -66, 34, 40, 4)); k.fill(K.round(14, -66, 34, 40, 4)); }, 6);
  pc(K.poly([[-130, -80], [-50, -170], [50, -170], [130, -80]]), C.red, k => K.carve.dots(k, -90, -160, 90, -92, 22, 4.6), 5); }, { ...o, s: (o.s ?? 1) * s });

// ======================= 字 =======================
// o: { size, fam, col, stroke 描边色, sw 描边宽（默认 size*0.16）, align, alpha, scale, track, maxW, rot }  默认：奶黄字＋深褐粗描边（任何幕布色上都清楚）
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.creamDk, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o, stroke = o.stroke ?? (K.tone === 'night' ? '#10183a' : C.edge), sw = o.sw ?? size * 0.16;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (sw > 0) { c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 标签牌：琥珀皮牌＋深褐粗边＋深褐字
K.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.amber, col = C.edge, scale = 1, alpha = 1, rot = 0, padX = 0.8 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.6; c.fillStyle = 'rgba(40,16,4,.3)'; c.fill(K.round(-w / 2 + 6, -h / 2 + 8, w, h, h / 2));
  c.fillStyle = fill; c.fill(K.round(-w / 2, -h / 2, w, h, h / 2)); c.strokeStyle = C.edge; c.lineWidth = 5; c.stroke(K.round(-w / 2, -h / 2, w, h, h / 2));
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：深褐圆头线先画出来，末端琥珀标签牌逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.amber, col = C.edge, size = 50 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.edge; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.edge; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.6, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = 'rgba(40,16,4,.3)'; c.fill(K.round(-w / 2 + 6, -h / 2 + 8, w, h, h / 2)); c.fillStyle = fill; c.fill(K.round(-w / 2, -h / 2, w, h, h / 2)); c.strokeStyle = C.edge; c.lineWidth = 5; c.stroke(K.round(-w / 2, -h / 2, w, h, h / 2));
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.8, 3); c.restore(); };

// 收尾：暗角＋字幕带压暗（y≥1330 渐暗到底，让字幕和杆线脚下有「台口」）
K.finish = c => {
  c.save(); c.globalCompositeOperation = 'multiply'; const v = c.createRadialGradient(W / 2, 760, 560, W / 2, 900, 1350); v.addColorStop(0, 'rgb(255,255,255)'); v.addColorStop(1, K.tone === 'night' ? 'rgb(150,158,196)' : 'rgb(190,155,125)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1330, 0, 1560); b.addColorStop(0, 'rgb(255,255,255)'); b.addColorStop(1, K.tone === 'night' ? 'rgb(96,108,164)' : K.tone === 'dusk' ? 'rgb(156,98,106)' : 'rgb(172,122,88)'); c.fillStyle = b; c.fillRect(0, 1330, W, H - 1330); c.restore(); };

// ======================= 章节卡 / 字幕 =======================
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.CARD_TONES = ['day', 'dusk', 'night'];   // 每章轮换的幕布色
K.chapterCard = (c, lt, t, n, title = '') => {
  const tone = K.CARD_TONES[(n - 1) % K.CARD_TONES.length];
  K.bg(c, t, { tone, lx: 540, ly: 520, r: 520 });
  K.city(c, t, { base: 1300, h: 0.9, alpha: 0.85, seed: 30 + n, layers: 3, rise: MO.cubicOut(K.at(lt, 0, 1.2)), lit: 0.25 });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 120, x1 = 960, y = 1190, X = i => lerp(x0, x1, i / (N - 1));
  K.cut(c, x0 - 60, y - 40, x1 - x0 + 120, 80, g => { K.piece(g, K.round(x0 - 36, y - 10, x1 - x0 + 72, 20, 10), C.brown, null, { edge: 3 }); for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1; K.piece(g, K.circle(X(i), y, cur ? 24 : 16), past ? C.amber : cur ? C.red : C.tan, null, { edge: 4 }); } }, { shadow: 0.2 });
  const walkEnd = 1.15, q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), tx = lerp(n > 1 ? X(n - 2) : x0 - 60, X(n - 1), q), walking = lt < walkEnd;
  K.ground(c, 1262);
  K.puppet(c, walking ? 'walk' : 'wave', tx, y - 18, 0.55, { t, walk: lt * 9, seed: 7, hat: n % 2 ? 'cap' : 'bun', rods: false, dir: 1 });
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); K.tag(c, `第 ${n} 章`, W / 2, 330, { size: 62, fam: 'PuHui-Black', scale: s }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 92 : all > 7 ? 108 : 128;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
    if (k > 0) K.text(c, a.slice(0, k).join(''), W / 2, (lines.length > 1 ? 540 : 600) + i * size * 1.28, { size, fam: 'PuHui-Black', maxW: 940 }); });
  K.finish(c);
};
// 字幕：深褐底板＋奶黄字＋琥珀细边，字幕带 y≈1480
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(20,8,2,.3)'; c.beginPath(); c.roundRect(x - w / 2 + 3, y - h / 2 + 8, w, h, 24); c.fill();
  c.fillStyle = 'rgba(48,20,8,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.strokeStyle = 'rgba(217,154,46,.8)'; c.lineWidth = 3; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 19); c.stroke();
  c.fillStyle = '#FFF1C4'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
