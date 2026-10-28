// 画风套件 egypt（配方 huashu-art-motion 02_egypt「埃及墓室壁画」，阿马尔纳时期）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：沙纸黄灰泥墙＋彩块几何边框＋顶部象形字栏；一切形状都是「深墨描边＋平涂」；人是埃及程式（侧脸、正面眼、正面肩与胸、侧面腿）。
//       颜色有语义：红 C.red＝道理/压力/指令，蓝 C.blue＝感受/内心/孩子，金 C.gold＝关系/温暖/修复；灰云 C.cloud＝压在人身上的情绪；
//       越往全书结尾，云越薄、越金（D.cloud 的 thick / gold）。贯穿物建议＝灰云＋餐桌（供桌）中间的缝（D.table 的 gap/gold、D.crack）。
//       象形字只当装饰（固定字形库 D.GLYPHS），不当真文本。字幕带 y1380–1560 由 D.finish 铺一层沙纸并画两条分栏线，内容别放进去。
//       所有随机走 U.hash / U.rng；静态层与墙面斑驳都缓存，逐帧只画会动的东西。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：负半径一律按 0 画（pop 回弹起步段会算出负半径，canvas 会抛错）
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = D.C = {
  paper: '#E6D3A3', paper2: '#D8C597', paper3: '#C4AC78', wall: '#E6D3A3', wall2: '#CDB784', cream: '#F2EAD6', white: '#F6F2E8',
  ink: '#1E1612', line: '#1E1612', black: '#231A14', navy: '#1C2236', rule: '#9A2B22',
  red: '#B5432E', redDk: '#8E2E20', redLt: '#D2705A', blue: '#2F55A4', blueDk: '#22407F', blueLt: '#6E8FCB', green: '#2E8B57', greenDk: '#1F6A40', greenLt: '#5FB083',
  gold: '#D9A82E', goldDk: '#A8741C', goldLt: '#F0CE6E', yellow: '#E2B13A', turq: '#3FA6A0',
  cloud: '#7C8594', cloud2: '#939BAA', cloudDk: '#5C6472', rain: '#46608C',
  skin: '#C27A4A', skinDk: '#9C5C34', skinM: '#B5653A', skinF: '#DBA468', terra: '#D4936A', clay: '#B9744B', wood: '#8A5A34',
  hair: '#1A1410', sub: '#6E5A3E', ink2: '#4A3A2C',
};
// 与其他套件同名的别名（章节代码里写 C.coral / C.sky 之类也不会出错，且仍在埃及色板内）
Object.assign(C, { coral: C.red, coralDk: C.redDk, coralLt: C.redLt, mint: '#BFD6B8', mintDot: C.greenLt, lav: '#C9D3E6', lavDot: C.blueLt, pink: '#E0B49A', pinkDot: C.terra, sky: '#A9C4D8', coffee: '#7A4A24', skin2: C.skinM, blush: C.terra, hair2: '#3A2A1E' });
D.BAND = [C.red, C.blue, C.yellow, C.green];   // 边框四色轮换
D.tint = col => [col, D.shade(col, 0.28), D.shade(col, -0.25)];
D.tone = D.tint;
D.mixHex = (a, b, k) => { const u = DG.arr(a), v = DG.arr(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
D.shade = (hex, k) => { const v = DG.arr(hex), m = k > 0 ? 0 : 255, a = Math.abs(k); return '#' + v.slice(0, 3).map(x => Math.round(x + (m - x) * a).toString(16).padStart(2, '0')).join(''); };

D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
D.poly = (pts, close = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (close) p.closePath(); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
D.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
D.last = (t, arr) => { let r = -1e9; for (const a of arr) if (a <= t) r = Math.max(r, a); return r; };

// ---------- 描边平涂：埃及壁画的基本笔法 ----------
// D.flat(c, path, 填充色, { line 描边宽(默认4，0=不描边), edge 描边色, alpha, band 在形内加一条深一档的窄带(true) })
D.flat = (c, path, col, o = {}) => { const { line = 4, edge = C.ink, alpha = 1 } = o; c.save(); c.globalAlpha *= alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  if (col) { c.fillStyle = col; c.fill(path); }
  if (line > 0) { c.strokeStyle = edge; c.lineWidth = line; c.stroke(path); } c.restore(); };
// 粗线管：先描边再填色（四肢、茎、藤）
D.tube = (c, pts, w, fill, lw = 3.4, edge = C.ink) => { c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  c.strokeStyle = edge; c.lineWidth = w + 2 * lw; c.stroke(); c.strokeStyle = fill; c.lineWidth = w; c.stroke(); c.restore(); };
// 横/竖向彩块带（边框、分栏用）：沿长边每 len 一块，四色轮换，块间墨线
D.blocks = (g, x0, y0, x1, y1, len, off = 0, pal = D.BAND) => { const hor = (x1 - x0) > (y1 - y0), L = hor ? x1 - x0 : y1 - y0;
  g.fillStyle = C.cream; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let s = 0, k = off; s < L; s += len, k++) { g.fillStyle = pal[k % pal.length];
    if (hor) g.fillRect(x0 + s + 3, y0 + 3, Math.min(len - 6, L - s - 3), y1 - y0 - 6); else g.fillRect(x0 + 3, y0 + s + 3, x1 - x0 - 6, Math.min(len - 6, L - s - 3));
    g.fillStyle = C.ink; if (hor) g.fillRect(x0 + s, y0, 2, y1 - y0); else g.fillRect(x0, y0 + s, x1 - x0, 2); }
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0); };
})();

// ---------- 象形字字形库（只当装饰，不当真文本）----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U, P = PAINT;
const poly = (g, pts, close = true) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (close) g.closePath(); };
  const GL = {
    ankh: { h: 60, cols: [C.blue, C.green, C.black, C.red], d(g) { g.lineWidth = 3.6; g.beginPath(); g.ellipse(0, -17, 8, 11, 0, 0, 7); g.moveTo(-16, -3); g.lineTo(16, -3); g.moveTo(0, -5); g.lineTo(0, 29); g.stroke(); } },
    sun: { h: 40, cols: [C.black, C.blue, C.red], d(g) { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); } },
    bread: { h: 26, cols: [C.red, C.blue, C.green], d(g) { g.beginPath(); g.arc(0, 9, 19, Math.PI, 0); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-12, 4); g.lineTo(12, 4); g.stroke(); } },
    reed: { h: 62, cols: [C.black, C.green, C.red], d(g) { g.beginPath(); g.moveTo(-2, 29); g.quadraticCurveTo(-11, 0, 1, -29); g.quadraticCurveTo(7, -2, 4, 29); g.stroke(); g.beginPath(); g.moveTo(1, -29); g.quadraticCurveTo(9, -31, 10, -24); g.stroke(); } },
    owl: { h: 60, cols: [C.black, C.blue], d(g) { g.beginPath(); g.ellipse(3, 6, 12, 19, 0.1, 0, 7); g.stroke(); g.beginPath(); g.arc(-2, -18, 10, 0, 7); g.stroke(); g.beginPath(); g.arc(-6, -19, 2.4, 0, 7); g.arc(2, -19, 2.4, 0, 7); g.fill(); g.beginPath(); g.moveTo(-2, -14); g.lineTo(-3, -9); g.moveTo(9, 22); g.lineTo(18, 29); g.moveTo(-3, 24); g.lineTo(-5, 30); g.moveTo(4, 24); g.lineTo(3, 30); g.stroke(); } },
    falcon: { h: 60, cols: [C.black, C.red, C.blue], d(g) { g.beginPath(); g.arc(-6, -20, 7, 0, 7); g.fill(); poly(g, [[-12, -21], [-19, -16], [-11, -15]]); g.fill(); g.beginPath(); g.ellipse(2, 1, 10, 20, -0.35, 0, 7); g.stroke(); poly(g, [[8, 16], [20, 30], [6, 27]]); g.fill(); g.beginPath(); g.moveTo(-3, 19); g.lineTo(-5, 30); g.moveTo(2, 19); g.lineTo(1, 30); g.moveTo(-1, -8); g.quadraticCurveTo(10, 0, 12, 14); g.stroke(); } },
    heron: { h: 64, cols: [C.green, C.black, C.blue], d(g) { g.beginPath(); g.moveTo(-20, -22); g.lineTo(-8, -26); g.quadraticCurveTo(0, -28, -1, -18); g.quadraticCurveTo(-6, -8, 2, -2); g.stroke(); g.beginPath(); g.ellipse(8, 4, 13, 8, 0.4, 0, 7); g.stroke(); g.beginPath(); g.moveTo(4, 11); g.lineTo(2, 31); g.moveTo(10, 11); g.lineTo(12, 31); g.moveTo(18, 9); g.lineTo(24, 14); g.stroke(); } },
    snake: { h: 30, cols: [C.green, C.black, C.red], d(g) { g.lineWidth = 3.2; g.beginPath(); g.moveTo(22, 8); g.bezierCurveTo(10, -4, 4, 14, -6, 6); g.bezierCurveTo(-14, 0, -16, -4, -20, -2); g.stroke(); g.beginPath(); g.moveTo(-20, -2); g.lineTo(-23, -9); g.moveTo(-17, -3); g.lineTo(-15, -10); g.stroke(); } },
    eye: { h: 36, cols: [C.green, C.black, C.blue], d(g) { g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -12, 18, 0); g.quadraticCurveTo(0, 9, -18, 0); g.stroke(); g.beginPath(); g.arc(0, -1, 4.5, 0, 7); g.fill(); g.beginPath(); g.moveTo(-18, -12); g.quadraticCurveTo(0, -20, 20, -11); g.moveTo(-4, 6); g.lineTo(-6, 16); g.moveTo(6, 5); g.quadraticCurveTo(14, 18, 4, 16); g.stroke(); } },
    cartouche: { h: 74, cols: [C.black, C.red], d(g) { g.beginPath(); g.ellipse(0, -2, 15, 31, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-14, 33); g.lineTo(14, 33); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, -18, 5, 0, 7); g.moveTo(-7, -2); g.lineTo(7, -2); g.moveTo(-6, 8); g.lineTo(-3, 13); g.lineTo(0, 8); g.lineTo(3, 13); g.lineTo(6, 8); g.stroke(); } },
    scarab: { h: 46, cols: [C.blue, C.black], d(g) { g.beginPath(); g.ellipse(0, 6, 10, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -11, 6, 0, 7); g.fill(); g.beginPath(); for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { g.moveTo(s * 9, 6 + k * 8); g.lineTo(s * 17, 2 + k * 11); } g.stroke(); } },
    seated: { h: 58, cols: [C.red, C.black, C.blue], d(g) { g.beginPath(); g.arc(-2, -21, 6.5, 0, 7); g.fill(); poly(g, [[-6, -13], [4, -13], [6, 6], [16, 8], [17, 18], [-10, 18], [-10, 2]]); g.fill(); g.beginPath(); g.moveTo(-6, -8); g.lineTo(-17, -16); g.stroke(); g.beginPath(); g.moveTo(-14, 26); g.lineTo(18, 26); g.stroke(); } },
    leg: { h: 50, cols: [C.green, C.black, C.red], d(g) { poly(g, [[-3, -24], [6, -24], [6, 18], [16, 22], [16, 26], [-4, 26]]); g.stroke(); } },
    arm: { h: 24, cols: [C.black, C.red], d(g) { poly(g, [[-22, -4], [10, -4], [16, -8], [22, -6], [16, 2], [-22, 4]]); g.stroke(); } },
    basket: { h: 26, cols: [C.blue, C.green, C.black], d(g) { g.beginPath(); g.moveTo(-20, -4); g.lineTo(20, -4); g.quadraticCurveTo(18, 12, 0, 12); g.quadraticCurveTo(-18, 12, -20, -4); g.stroke(); g.beginPath(); g.arc(22, 2, 5, -1.5, 1.6); g.stroke(); } },
    house: { h: 36, cols: [C.black, C.red], d(g) { g.beginPath(); g.moveTo(-6, 14); g.lineTo(-18, 14); g.lineTo(-18, -14); g.lineTo(18, -14); g.lineTo(18, 14); g.lineTo(6, 14); g.stroke(); } },
    strokes: { h: 34, cols: [C.red, C.black], d(g) { g.beginPath(); for (const x of [-8, 0, 8]) { g.moveTo(x, -14); g.lineTo(x, 14); } g.stroke(); } },
    feather: { h: 60, cols: [C.blue, C.green, C.black], d(g) { g.beginPath(); g.moveTo(-2, 29); g.quadraticCurveTo(-8, -10, 4, -29); g.quadraticCurveTo(12, -18, 6, 0); g.quadraticCurveTo(3, 15, 2, 29); g.stroke(); } },
    djed: { h: 62, cols: [C.blue, C.green], d(g) { g.beginPath(); g.moveTo(-6, 29); g.lineTo(-6, -10); g.moveTo(6, 29); g.lineTo(6, -10); for (let k = 0; k < 4; k++) { g.moveTo(-13, -12 - k * 5); g.lineTo(13, -12 - k * 5); } g.moveTo(-12, 29); g.lineTo(12, 29); g.stroke(); } },
    shen: { h: 42, cols: [C.red, C.blue], d(g) { g.beginPath(); g.arc(0, -4, 13, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-14, 13); g.lineTo(14, 13); g.stroke(); } },
    jug: { h: 50, cols: [C.red, C.green, C.blue], d(g) { g.beginPath(); g.moveTo(-6, -22); g.lineTo(6, -22); g.lineTo(5, -14); g.quadraticCurveTo(16, -6, 12, 12); g.quadraticCurveTo(8, 22, 0, 22); g.quadraticCurveTo(-8, 22, -12, 12); g.quadraticCurveTo(-16, -6, -5, -14); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke(); } },
    lotus: { h: 56, cols: [C.green, C.blue], d(g) { g.beginPath(); g.moveTo(0, 27); g.lineTo(0, -6); g.stroke(); poly(g, [[0, -6], [-12, -18], [-6, -26], [0, -16], [6, -26], [12, -18]]); g.stroke(); } },
    nfr: { h: 56, cols: [C.black, C.red], d(g) { g.beginPath(); g.ellipse(0, 12, 10, 14, 0, 0, 7); g.moveTo(0, -2); g.lineTo(0, -26); g.moveTo(-6, -18); g.lineTo(6, -18); g.moveTo(-6, -12); g.lineTo(6, -12); g.stroke(); } },
    mouth: { h: 20, cols: [C.red], d(g) { g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -9, 18, 0); g.quadraticCurveTo(0, 9, -18, 0); g.stroke(); } },
    water: { h: 30, cols: [C.blue], water: true, d(g, ph = 0) { g.lineWidth = 2.6; for (let r = -1; r <= 1; r++) { g.beginPath(); for (let i = 0; i <= 16; i++) { const x = -21 + i * 2.625, y = r * 9 + ((i + ph) % 2 < 1 ? -3 : 3); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } } },
  };
  const GN = Object.keys(GL);
D.GL = GL; D.GLYPHS = GN;
const drawGlyph = (g, q, ph = 0, rv = 1) => { g.save(); g.translate(q.x, q.y); g.scale(q.s, q.s); g.strokeStyle = q.col; g.fillStyle = q.col; g.lineWidth = 3.1; g.lineCap = 'round'; g.lineJoin = 'round';
  if (rv < 1) { g.setLineDash([Math.max(0.01, rv * 95), 999]); if (rv < 0.55) g.fillStyle = 'rgba(0,0,0,0)'; }
  GL[q.n].d(g, ph); g.restore(); };
// 画一个字形：D.glyph(c, 'ankh', x, y, 高度 px, 颜色, 相位)
D.glyph = (c, name, x, y, hpx = 60, col = null, ph = 0) => { const gl = GL[name] || GL.ankh; drawGlyph(c, { n: GL[name] ? name : 'ankh', x, y, s: hpx / gl.h, col: col || gl.cols[0] }, ph); };
// 一行象形字（装饰栏）：D.glyphRow(c, x0, x1, y, seed, 高度, 色数组|null)
D.glyphRow = (c, x0, x1, y, seed = 1, hpx = 70, cols = null, ph = 0) => { const r = U.rng(seed * 131 + 7); let prev = '', x = x0 + hpx * 0.4;
  while (x < x1 - hpx * 0.3) { let n; do { n = GN[(r() * GN.length) | 0]; } while (n === prev || n === 'scarab' || n === 'water'); prev = n;
    const gl = GL[n], s = Math.min(1.5, hpx / gl.h); drawGlyph(c, { n, x, y, s, col: cols ? cols[(r() * cols.length) | 0] : gl.cols[(r() * gl.cols.length) | 0] }, ph); x += hpx * 0.8 + r() * 6; } };
// 伸手的阿顿光线末端小手
D.hand = (g, x, y, ang, open = 0.5, col = '#b4452c', sc = 1) => {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(1.35 * sc, 1.35 * sc);
  g.lineCap = 'round'; g.scale(0.9 + 0.3 * open, 0.9 + 0.3 * open);
  for (let k = 0; k < 4; k++) { const a = (k - 1.5) * (0.03 + open * 0.42); g.beginPath(); g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); g.lineTo(Math.cos(a) * (12.5 + open * 1.5), Math.sin(a) * (12.5 + open * 1.5)); g.strokeStyle = '#5a1c10'; g.lineWidth = 5.6; g.stroke(); g.strokeStyle = col; g.lineWidth = 3.4; g.stroke(); }
  g.beginPath(); g.moveTo(1, -5); g.lineTo(5, -10 - open * 3); g.strokeStyle = '#5a1c10'; g.lineWidth = 5.4; g.stroke(); g.strokeStyle = col; g.lineWidth = 3.2; g.stroke();
  g.beginPath(); g.ellipse(0, 0, 8, 6.6, 0, 0, 7); g.fillStyle = col; g.fill(); g.strokeStyle = '#5a1c10'; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); g.moveTo(-9, 0); g.lineTo(-14, 0); g.strokeStyle = col; g.lineWidth = 4; g.stroke(); g.restore(); };
})();

// ---------- 底：灰泥墙＋彩块边框＋顶部象形字栏＋地线 ----------
(() => { const D = K, C = D.C, { W, H, TAU } = D, { clamp, lerp } = U, P = PAINT;
const TINTS = { sand: { wall: C.wall, wall2: C.wall2, rule: C.rule, glyph: null }, cream: { wall: '#EFE3C2', wall2: '#D9C99C', rule: C.rule, glyph: null },
  dusk: { wall: '#DDBB8C', wall2: '#BD9462', rule: C.redDk, glyph: null }, night: { wall: '#2A3350', wall2: '#1C2236', rule: C.gold, glyph: [C.goldLt, C.gold, '#9DB4E8'] } };
D.TINTS = Object.keys(TINTS); D.tintNow = 'sand';
D.GY = 1310;   // 默认地线（脚底）
const wallTex = tint => P.cached('eg_wall_' + tint, W, H, g => { const T = TINTS[tint], img = g.createImageData(W, H), d = img.data, b = DG.arr(T.wall), k = DG.arr(T.wall2), r = U.rng(5 + tint.length);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const n = clamp(P.fbm(x * 0.0035 + 13, y * 0.0035, 4) * 1.3 + 0.25), gr = (r() - 0.5) * 10;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = ((y + dy) * W + x + dx) * 4; d[i] = lerp(b[0], k[0], n * 0.7) + gr; d[i + 1] = lerp(b[1], k[1], n * 0.7) + gr; d[i + 2] = lerp(b[2], k[2], n * 0.7) + gr * 0.8; d[i + 3] = 255; } }
  g.putImageData(img, 0, 0); });
const layer = (tint, seed, floor, top) => P.cached(`eg_bg_${tint}_${seed % 4}_${floor}_${top ? 1 : 0}`, W, H, g => { const T = TINTS[tint]; g.drawImage(wallTex(tint), 0, 0); g.lineCap = 'round';
  if (top) { g.strokeStyle = T.rule; g.lineWidth = 3; for (const yy of [46, 182]) { g.beginPath(); g.moveTo(26, yy); g.lineTo(W - 26, yy); g.stroke(); }
    D.glyphRow(g, 30, W - 30, 114, seed % 4 + 1, 100, T.glyph); }
  if (floor) { g.fillStyle = C.ink; g.fillRect(0, floor + 12, W, 6); g.fillStyle = C.cream; g.fillRect(0, floor + 18, W, 52); D.blocks(g, -20, floor + 26, W + 20, floor + 60, 54, 1); g.fillStyle = C.ink; g.fillRect(0, floor + 70, W, 3); }
  // 底部饰带（y>1590，视频号底栏遮挡区，纯装饰）
  g.fillStyle = C.cream; g.fillRect(0, 1590, W, 100); D.blocks(g, -20, 1604, W + 20, 1640, 60, 0);
  g.fillStyle = C.yellow; g.fillRect(0, 1654, W, 12); g.fillStyle = C.red; g.fillRect(0, 1672, W, 10);
  g.fillStyle = C.ink; [1590, 1602, 1652, 1670, 1690].forEach(y => g.fillRect(0, y, W, 2));
  g.fillStyle = C.navy; g.fillRect(0, 1690, W, 230); const rr = U.rng(7); for (let i = 0; i < 3000; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(90,100,140,.35)' : 'rgba(5,8,20,.45)'; g.fillRect(rr() * W, 1690 + rr() * 230, 1 + rr() * 2, 1 + rr() * 2); }
  D.blocks(g, -10, 0, W + 10, 34, 56, 2); D.blocks(g, 0, 34, 26, 1690, 46, 1); D.blocks(g, W - 26, 34, W, 1690, 46, 3); });
// D.bg(c, t, o)  o: { tint 'sand'|'cream'|'dusk'|'night', floor 地线 y(默认 1310；false 不画地线), top 顶部象形字栏(默认 true), seed,
//   sun {x,y,r,rays,open} 阿顿日盘与带手的光线（会动）, cx/cy/r/blob/decos 等别的套件的参数收下不用 }
D.bg = (c, t, o = {}) => { const { tint = 'sand', floor = D.GY, top = true, seed = 1, sun = null } = o; D.tintNow = TINTS[tint] ? tint : 'sand';
  c.drawImage(layer(D.tintNow, seed, floor || 0, top), 0, 0); if (sun) D.aten(c, sun.x, sun.y, sun.r || 44, t, sun); };
})();

// ---------- 收尾与文字 ----------
(() => { const D = K, C = D.C, { W, H, TAU } = D, { clamp, lerp } = U, P = PAINT;
const surface = () => P.cached('eg_surface', W, H, g => { const img = g.createImageData(W, H), d = img.data, r = U.rng(99);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const n = P.fbm(x * 0.006 + 40, y * 0.006, 3), m = P.fbm(x * 0.03, y * 0.03 + 9, 2), v = 248 + n * 22 + m * 8 + (r() - 0.5) * 12;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = ((y + dy) * W + x + dx) * 4; d[i] = v; d[i + 1] = v - 4; d[i + 2] = v - 12; d[i + 3] = 255; } }
  g.putImageData(img, 0, 0); });
const specks = () => P.cached('eg_specks', W, H, g => { const r = U.rng(31); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(70,50,30,${0.08 + r() * 0.18})`; g.fillRect(r() * W, r() * H, 1 + r() * 2.4, 1 + r() * 2.4); } });
// 每镜收尾：壁画斑驳（multiply）＋颗粒＋四角暗边；字幕带 y1380–1560 铺一层沙纸并画两条分栏线（里面别放东西）
D.finish = c => { const night = D.tintNow === 'night';
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = night ? 0.5 : 1; c.drawImage(surface(), 0, 0); c.restore(); c.drawImage(specks(), 0, 0);
  const g = c.createRadialGradient(W / 2, H * 0.42, 620, W / 2, H * 0.42, 1350); g.addColorStop(0, 'rgba(90,60,30,0)'); g.addColorStop(1, 'rgba(90,60,30,.16)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1366, 0, 1574); const v = night ? '28,34,54' : '224,205,160'; b.addColorStop(0, `rgba(${v},0)`); b.addColorStop(0.12, `rgba(${v},.7)`); b.addColorStop(0.88, `rgba(${v},.7)`); b.addColorStop(1, `rgba(${v},0)`); c.fillStyle = b; c.fillRect(26, 1366, W - 52, 208);
  c.fillStyle = night ? C.gold : C.ink; c.globalAlpha = 0.5; c.fillRect(26, 1376, W - 52, 3); c.fillRect(26, 1562, W - 52, 3); c.globalAlpha = 1; };

// ---------- 文字 ----------
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
D.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 王名圈（cartouche）路径：两端半圆的长胶囊
D.pill = (x, y, w, h) => D.round(x - w / 2, y - h / 2, w, h, h / 2);
// 标签牌：奶白（或指定色）胶囊＋墨线＋内圈细线（o.edge 色）；o.cart 时右端加王名圈的端杠
D.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.cream, col = C.ink, scale = 1, alpha = 1, rot = 0, padX = 0.8, edge = C.gold, cart = false } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.6;
  c.fillStyle = 'rgba(30,22,18,.22)'; c.fill(D.pill(5, 8, w, h));
  c.fillStyle = fill; c.fill(D.pill(0, 0, w, h)); c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(D.pill(0, 0, w, h));
  c.lineWidth = 3; c.strokeStyle = edge; c.stroke(D.pill(0, 0, w - 18, h - 18));
  if (cart) { c.fillStyle = C.ink; c.fillRect(w / 2 - size * 0.55, -h / 2 - 6, 12, h + 12); c.fillStyle = edge; c.fillRect(w / 2 - size * 0.55 + 2, -h / 2 - 3, 8, h + 6); }
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, cart ? -size * 0.2 : 0, 3); c.restore(); return w; };
// 弹出的王名圈：D.cartouche(c, '不开心', x, y, lt, at, { edge: C.blue, size: 100 })
D.cartouche = (c, s, x, y, lt, at, o = {}) => { const p = D.pop(lt, at, o.dur || 0.5); if (p <= 0) return 0; return D.tag(c, s, x, y, { size: 96, fam: 'PuHui-Black', padX: 0.7, ...o, cart: true, scale: p * (o.scale || 1), alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// 弹出的大字/数字；o.plate 时带标签牌
D.popText = (c, s, x, y, lt, at, o = {}) => { const p = D.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else D.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：墨线圆头先画出来，末端标签牌逐字打出
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.goldLt, col = C.ink, size = 50, edge = C.red } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.red; c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.6, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = fill; c.fill(D.pill(0, 0, w, h)); c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(D.pill(0, 0, w, h)); c.lineWidth = 3; c.strokeStyle = edge; c.stroke(D.pill(0, 0, w - 18, h - 18));
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.8, 3); c.restore(); };
})();

// ---------- 人：埃及程式（侧脸、正面眼、正面肩与胸、侧面腿），墨线描边＋平涂 ----------
// D.person(c, x, y, s, o) —— (x,y) 是两脚中点（地面），s=1 时全高约 660px（含假发），默认朝右；dir:-1 朝左（整个人镜像）。
// 返回屏幕坐标锚点 {head, top, mouth, handL, handR, chest, feet}，好放情绪符号/思考泡/对话泡。
// o: { kind 'man'|'woman'|'child'（决定衣服、假发、肤色）, pose, to 混向的姿势, mix 0..1, mood, talk（true 或 0..1：嘴一张一合）, t 全片时间（呼吸）,
//      react 动作发生时刻（头阻尼晃）, walk 走路相位（弧度）, dir 1|-1, look, alpha,
//      top 领饰/肩带主色（父亲红、孩子蓝、母亲金）, bottom 衣裙色, skin, hair, hairStyle 'wig'|'long'|'side'|'bald', chair 坐姿时是否带凳子（默认 true）, hs 头比例 }
// pose：stand 站 / walk 走 / sit 坐（带凳）/ point 指 / bow 低头鞠躬 / hug 抱臂 / raise 举手 / cheer 举双手 / think 托腮 / shrug 摊手 / slump 垂头丧气 /
//       wave 挥手 / heart 手按胸口 / facepalm 扶额 / open 张开双臂 / hold 双手捧在身前 / give 递出
// mood：calm 平静 / happy 开心 / sad 难过（掉泪） / shock 惊 / worry 担心 / closed 闭眼安宁 / angry 生气 / none 不画五官
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
const POSE = {
  stand: { L: [-34, -250], R: [44, -246], sh: 0, hd: [0, 0], tilt: 0, lean: 0, sit: 0 },
  walk: { L: [-60, -262], R: [60, -262], sh: 0, hd: [0, 0], tilt: 0, lean: 0.03, sit: 0 },
  sit: { L: [58, -270], R: [128, -266], sh: 0, hd: [0, 0], tilt: 0, lean: 0.02, sit: 1 },
  point: { L: [-34, -250], R: [292, -462], sh: 0, hd: [6, 0], tilt: -0.05, lean: 0.02, sit: 0 },
  bow: { L: [40, -300], R: [74, -304], sh: 6, hd: [10, 12], tilt: 0.42, lean: 0.34, sit: 0 },
  hug: { L: [58, -404], R: [-46, -392], sh: 6, hd: [0, 8], tilt: 0.08, lean: 0, sit: 0 },
  raise: { L: [-34, -250], R: [126, -664], sh: -6, hd: [0, 0], tilt: -0.06, lean: 0, sit: 0 },
  cheer: { L: [-120, -662], R: [150, -664], sh: -8, hd: [0, -4], tilt: -0.04, lean: -0.02, sit: 0 },
  think: { L: [44, -372], R: [66, -546], sh: 0, hd: [4, 6], tilt: 0.12, lean: 0, ew: 3, sit: 0 },
  shrug: { L: [-168, -396], R: [200, -400], sh: -14, hd: [0, 4], tilt: -0.1, lean: 0, sit: 0 },
  slump: { L: [-26, -226], R: [30, -222], sh: 18, hd: [-2, 26], tilt: 0.24, lean: 0.1, sit: 0 },
  wave: { L: [-34, -250], R: [170, -640], sh: 0, hd: [0, 0], tilt: -0.08, lean: 0, sit: 0 },
  heart: { L: [-34, -250], R: [38, -420], sh: 0, hd: [0, 6], tilt: 0.1, lean: 0.02, sit: 0 },
  facepalm: { L: [40, -380], R: [52, -592], sh: 8, hd: [0, 14], tilt: 0.24, lean: 0.04, sit: 0 },
  open: { L: [-210, -450], R: [236, -440], sh: -4, hd: [0, -4], tilt: -0.02, lean: 0, sit: 0 },
  hold: { L: [96, -362], R: [150, -352], sh: 0, hd: [0, 0], tilt: 0, lean: 0.02, sit: 0 },
  give: { L: [-34, -250], R: [236, -400], sh: 0, hd: [0, 0], tilt: 0, lean: 0.03, sit: 0 },
};
D.POSES = Object.keys(POSE);
const mixP = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A; const L = (u, v) => lerp(u, v, k);
  return { L: [L(A.L[0], B.L[0]), L(A.L[1], B.L[1])], R: [L(A.R[0], B.R[0]), L(A.R[1], B.R[1])], sh: L(A.sh, B.sh), hd: [L(A.hd[0], B.hd[0]), L(A.hd[1], B.hd[1])], tilt: L(A.tilt, B.tilt), lean: L(A.lean, B.lean), ew: L(A.ew ?? 0.6, B.ew ?? 0.6), sit: L(A.sit, B.sit) }; };
const ik = (S, T, a, b, out, ew = 0.6) => { let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-3; d = Math.min(d, a + b - 0.5); const ang = Math.atan2(dy, dx);
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), al = Math.acos(ca);
  const E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a];
  const sc = E => E[0] * out + E[1] * ew; const E = sc(E1) >= sc(E2) ? E1 : E2; const k = d / Math.hypot(T[0] - S[0], T[1] - S[1]) || 1;
  return { E, Hn: [S[0] + (T[0] - S[0]) * Math.min(1, k), S[1] + (T[1] - S[1]) * Math.min(1, k)] }; };
const SKIN = { man: C.skinM, woman: C.skinF, child: C.skin }, TOP = { man: C.red, woman: C.gold, child: C.blue };
const poly = (pts) => D.poly(pts);

// 头（朝右，原点 = 脸中心附近）
function head(c, o) { const { kind, skin, mood, hairStyle, t, talk, lw, look, hair } = o;
  c.lineJoin = 'round'; c.lineCap = 'round';
  const fillP = (p, col, w = lw) => { c.fillStyle = col; c.fill(p); c.lineWidth = w; c.strokeStyle = C.ink; c.stroke(p); };
  if (hairStyle === 'side') { D.tube(c, [[-14, -34], [-24, 0], [-20, 40], [-28, 74]], 14, hair, 2.4); }
  if (hairStyle === 'long') fillP(poly([[44, -52], [30, -80], [4, -92], [-40, -76], [-66, -10], [-80, 120], [-86, 192], [-30, 198], [-16, 40], [4, -12], [30, -32]]), hair);
  // 脸
  fillP(poly([[0, -72], [34, -64], [52, -34], [52, -18], [68, 10], [54, 18], [57, 30], [50, 44], [30, 60], [-8, 56], [-28, 30], [-40, -20], [-28, -62]]), skin);
  if (hairStyle === 'wig') { fillP(poly([[44, -52], [30, -78], [4, -90], [-38, -74], [-60, -10], [-66, 96], [-18, 100], [-14, 30], [4, -12], [30, -32]]), hair);
    c.strokeStyle = '#4a3a2a'; c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(-24 - k * 8, 10); c.lineTo(-28 - k * 7, 92); c.stroke(); } }
  if (hairStyle === 'side') fillP(poly([[40, -54], [26, -76], [0, -86], [-30, -70], [-34, -50], [-10, -66], [18, -60]]), hair);
  if (hairStyle === 'long') fillP(poly([[44, -52], [30, -80], [4, -92], [-40, -76], [-52, -40], [-14, -30], [10, -52]]), hair);
  if (hairStyle === 'wig' || hairStyle === 'long') { D.tube(c, [[46, -56], [-4, -46], [-56, -30]], 7, o.crown, 1.8); }
  const ear = new Path2D(); ear.ellipse(-16, 8, 10, 14, 0, 0, 7); fillP(ear, skin, 2.6);
  if (mood === 'none') return;
  const tear = mood === 'sad';
  // 眼（正面眼画在侧脸上）
  const ex = 31 + look * 5;
  if (mood === 'happy') { c.beginPath(); c.arc(ex, -12, 12, 1.15 * Math.PI, 1.85 * Math.PI); c.strokeStyle = C.ink; c.lineWidth = 4.4; c.stroke(); }
  else if (mood === 'closed') { c.beginPath(); c.arc(ex, -18, 13, 0.15 * Math.PI, 0.85 * Math.PI); c.strokeStyle = C.ink; c.lineWidth = 4.4; c.stroke(); }
  else { const hh = mood === 'shock' ? 15 : 10; const eye = new Path2D(); eye.moveTo(46, -14); eye.quadraticCurveTo(31, -14 - hh, 14, -14); eye.quadraticCurveTo(31, -14 + hh * 0.7, 46, -14); fillP(eye, C.white, 2.6);
    c.fillStyle = C.ink; c.beginPath(); c.arc(ex + (mood === 'sad' || mood === 'worry' ? 0 : 0), -14 + (mood === 'sad' ? 2 : 0), mood === 'shock' ? 4 : 5.6, 0, 7); c.fill(); }
  c.beginPath(); c.moveTo(14, -14); c.lineTo(-8, -8); c.strokeStyle = C.ink; c.lineWidth = 3.6; c.stroke();            // 眼尾描线
  // 眉
  const bw = 4.6; c.strokeStyle = C.ink; c.lineWidth = bw; c.beginPath();
  if (mood === 'angry') { c.moveTo(10, -40); c.lineTo(52, -24); }
  else if (mood === 'sad' || mood === 'worry') { c.moveTo(10, -30); c.quadraticCurveTo(32, -38, 52, -50); }
  else if (mood === 'shock') { c.moveTo(12, -50); c.quadraticCurveTo(32, -62, 52, -50); }
  else { c.moveTo(52, -32); c.quadraticCurveTo(32, -42, 10, -30); }
  c.stroke();
  // 嘴（脸前缘 x≈40..58, y≈32）
  const open = talk ? (typeof talk === 'number' ? talk : (Math.sin(t * 15) > -0.1 ? 1 : 0.15)) : (mood === 'shock' ? 1 : 0);
  c.lineWidth = 3.6; c.beginPath();
  if (open > 0.3) { c.ellipse(49, 33, 6, 3 + 5 * open, 0, 0, 7); c.fillStyle = '#6a2418'; c.fill(); c.stroke(); }
  else if (mood === 'happy') { c.arc(49, 26, 9, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
  else if (mood === 'sad' || mood === 'worry') { c.arc(49, 42, 8, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke(); }
  else if (mood === 'angry') { c.moveTo(40, 36); c.lineTo(58, 31); c.stroke(); }
  else { c.moveTo(41, 33); c.lineTo(57, 31); c.stroke(); }
  if (tear) { const k = (t * 0.9) % 1; c.fillStyle = C.blueLt; c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); const ty = -2 + k * 40; c.moveTo(34, ty - 9); c.quadraticCurveTo(44, ty + 6, 34, ty + 9); c.quadraticCurveTo(24, ty + 6, 34, ty - 9); c.fill(); c.stroke(); }
}

D.person = (c, x, y, s = 1, o = {}) => {
  const { kind = 'man', pose = 'stand', to = null, mix = 0, mood = 'calm', talk = false, t = 0, react = -1e9, walk = null, dir = 1, look = 0, alpha = 1, chair = true } = o;
  const skin = o.skin || SKIN[kind], top = o.top || TOP[kind], bottom = o.bottom || (kind === 'woman' ? C.cream : C.white), hair = o.hair || C.hair;
  const hairStyle = o.hairStyle || (kind === 'woman' ? 'long' : kind === 'child' ? 'side' : 'wig'), hs = o.hs || (kind === 'child' ? 1.0 : 0.85);
  const Q = mixP(pose, to || pose, MO.cubicInOut(clamp(mix))), sit = Q.sit, lw = clamp(3.4 / Math.max(s, 0.5), 3.4, 6);
  const br = Math.sin(t * 2.6) * 2.2, wob = D.damped(t, react, 0.08, 0.42, 0.36), bounce = D.damped(t, react, 9, 0.42, 0.3);
  const sw = walk == null ? 0 : Math.sin(walk), bobW = walk == null ? 0 : Math.abs(Math.sin(walk)) * -5;
  const shY = Q.sh + br + bounce * 0.4, sitD = 66 * sit, hipY = -262 + sitD;
  const kw = kind === 'child' ? 0.86 : 1;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y + bobW); c.scale(s * dir, s); c.lineJoin = 'round'; c.lineCap = 'round';
  const fill = (p, col, w = lw) => { c.fillStyle = col; c.fill(p); c.lineWidth = w; c.strokeStyle = C.ink; c.stroke(p); };
  // 凳子
  if (sit > 0.5 && chair) { const wd = o.wood || C.wood; fill(poly([[-64, -392], [-52, -392], [-52, -10], [-64, -10]]), wd, lw * 0.8); fill(D.round(-70, -200, 150, 22, 5), wd); fill(D.round(-52, -178, 14, 178, 3), wd, lw * 0.8); fill(D.round(52, -178, 14, 178, 3), wd, lw * 0.8);
    c.fillStyle = C.gold; c.fillRect(-69, -194, 148, 7); }
  // 腿（0 后腿，1 前腿）
  const legs = [0, 1].map(i => { const hx = i ? 12 : -12, lift = walk == null ? 0 : Math.max(0, i ? Math.cos(walk) : -Math.cos(walk)) * 22;
    const fxS = walk == null ? (i ? 46 : -46) : (i ? sw : -sw) * 58 + (i ? 12 : -12), fxK = hx + 104 + i * 14;
    const fx = lerp(fxS, fxK + 6, sit), fy = lerp(-30 - lift, -30, sit), kx = lerp((hx + fxS) / 2 + 8, fxK, sit), ky = lerp(-146 - lift * 0.5, hipY, sit);
    return { hx, fx, fy, kx, ky }; });
  legs.forEach((L, i) => { const dressed = kind === 'woman';
    D.tube(c, [[L.hx, hipY], [L.kx, L.ky], [L.fx, L.fy]], 46, skin, lw);
    if (dressed && sit > 0.3) D.tube(c, [[L.hx, hipY], [L.kx, L.ky]], 46, bottom, lw);
    c.save(); c.translate(L.fx, L.fy + 30); fill(poly([[-12, -34], [10, -34], [16, -24], [46, -12], [48, 0], [-22, 0], [-22, -16]]), skin, lw * 0.9); c.restore(); });
  // 衣裙（腰到下摆；坐姿时收成盖在大腿上的一块）
  const hemY = kind === 'woman' ? -78 : -150, hemF = lerp(kind === 'woman' ? 92 : 88, 132, sit), hemB = -46;
  // 上身（绕胯点前倾）
  c.save(); c.translate(0, sitD); c.translate(0, -262); c.rotate(Q.lean); c.translate(0, 262);
  fill(poly([[-52 * kw, -292], [56 * kw, -292], [hemF, lerp(hemY, -236, sit)], [hemB, lerp(hemY, -232, sit)]]), bottom);
  // 腰带与褶
  c.strokeStyle = 'rgba(120,96,70,.55)'; c.lineWidth = 2; for (let k = 1; k < 6; k++) { const u = k / 6; c.beginPath(); c.moveTo(lerp(-52 * kw, 56 * kw, u), -290); c.lineTo(lerp(hemB, hemF, u), lerp(hemY, -236, sit) - 2); c.stroke(); }
  c.fillStyle = top; c.fillRect(-54 * kw, -312, 114 * kw, 24); c.lineWidth = lw * 0.8; c.strokeStyle = C.ink; c.strokeRect(-54 * kw, -312, 114 * kw, 24);
  // 躯干（正面）
  const torso = poly([[-70 * kw, -496 + shY], [70 * kw, -496 + shY], [58 * kw, -420], [42 * kw, -312], [-42 * kw, -312], [-58 * kw, -420]]);
  if (kind === 'woman') { fill(torso, skin); fill(poly([[-56, -440], [56, -440], [48, -312], [-50, -312]]), bottom); fill(D.round(-56, -312, 106, 16, 3), top, lw * 0.7); }
  else fill(torso, skin);
  c.fillStyle = C.ink; c.beginPath(); c.arc(0, -352, 3, 0, TAU); c.fill();
  // 脖子
  D.tube(c, [[2, -496 + shY], [8, -540 + shY]], 34, skin, lw * 0.9);
  // 宽领
  c.save(); c.clip(torso); [[96, top], [80, C.gold], [64, C.cream], [50, C.blue === top ? C.red : C.blue], [36, C.goldLt]].forEach(([r, col]) => { const e = new Path2D(); e.ellipse(0, -500 + shY, r * kw, r * 0.95, 0, 0, Math.PI); e.closePath(); fill(e, col, lw * 0.6); }); c.restore();
  // 头
  c.save(); c.translate(8 + Q.hd[0], -540 + shY + Q.hd[1] * 0.4); c.rotate(Q.tilt + wob); c.translate(12 * hs, -50 * hs); c.scale(hs, hs);
  head(c, { kind, skin, mood, hairStyle, t, talk, lw: lw / hs, look, hair, crown: o.crown || C.gold }); c.restore();
  // 手臂
  const arms = [], mk = MO.cubicInOut(clamp(mix)), waveW = (pose === 'wave' ? 1 - (to ? mk : 0) : 0) + (to === 'wave' ? mk : 0), ptW = (pose === 'point' ? 1 - (to ? mk : 0) : 0) + (to === 'point' ? mk : 0);
  [[Q.L, -1], [Q.R, 1]].forEach(([T, side]) => { const tg = [T[0], T[1]];
    if (walk != null) tg[0] += side * Math.sin(walk) * 40;
    if (side > 0 && waveW > 0) tg[0] += Math.sin(t * 9) * 26 * waveW;
    const S = [side * 62 * kw, -480 + shY], { E, Hn } = ik(S, tg, 120, 112, side, side > 0 ? Q.ew : 0.6);
    D.tube(c, [S, E, Hn], 30, skin, lw * 0.95);
    const cu0 = [lerp(E[0], Hn[0], 0.66), lerp(E[1], Hn[1], 0.66)], cu1 = [lerp(E[0], Hn[0], 0.78), lerp(E[1], Hn[1], 0.78)]; D.tube(c, [cu0, cu1], 30, C.gold, 2.4);
    if (side > 0 && ptW > 0.4) { const an = Math.atan2(Hn[1] - E[1], Hn[0] - E[0]); D.tube(c, [Hn, [Hn[0] + Math.cos(an) * 42, Hn[1] + Math.sin(an) * 42]], 11, skin, 2.6); }
    fill(D.circle(Hn[0], Hn[1], 16), skin, lw * 0.9); arms.push(Hn); });
  c.restore(); c.restore();
  const ang = Q.lean, cs = Math.cos(ang), sn = Math.sin(ang);
  const tr = (px, py) => { let dx = px, dy = py + 262; const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs; return [x + (rx) * s * dir, y + bobW + (ry - 262 + sitD) * s]; };
  const hc = [8 + Q.hd[0] + 12 * hs + 0, -540 + shY + Q.hd[1] * 0.4 - 50 * hs - 6 * hs];
  return { head: tr(hc[0] + 14, hc[1] - 6), top: tr(hc[0], hc[1] - 110 * hs), mouth: tr(hc[0] + 52 * hs, hc[1] + 30 * hs), handL: tr(...arms[0]), handR: tr(...arms[1]), chest: tr(0, -400), feet: [x, y] };
};
// 小人图标：圆头＋梯形身，墨线平涂（人群、统计）；o.hair 色
D.mini = (c, x, y, s, col = C.red, o = {}) => { const { alpha = 1, head = C.skin, hop = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y - hop); c.scale(s, s);
  const lw = 4 / Math.max(s, 0.5) * 0.7; D.flat(c, D.poly([[-30, 0], [-22, -76], [24, -76], [34, 0]]), col, { line: lw });
  D.flat(c, D.circle(0, -102, 24), head, { line: lw }); D.flat(c, D.poly([[-26, -106], [-20, -126], [8, -130], [26, -112], [28, -86], [14, -100], [-10, -104]]), o.hair || C.hair, { line: lw });
  c.restore(); };
// 人群：cols×rows 网格；o.hi 高亮序号数组（变红并跳一下，o.hiAt 起跳时刻配 o.lt），o.dim 其余变淡
D.crowd = (c, cx, y, cols, rows, gap, s, o = {}) => { const { seed = 3, hi = [], hiCol = C.red, lt = 0, hiAt = 0, dim = 0, pal = [C.blue, C.green, C.gold, C.cream, C.terra, C.turq], appear = null } = o;
  for (let r = rows - 1; r >= 0; r--) for (let k = 0; k < cols; k++) { const i = r * cols + k, isH = hi.includes(i), x = cx + (k - (cols - 1) / 2) * gap + (r % 2) * gap * 0.25, yy = y - r * gap * 0.74;
    const a = appear == null ? 1 : D.pop(lt, appear + i * 0.03, 0.4); if (a <= 0) continue;
    const col0 = pal[Math.floor(U.hash(i, seed) * pal.length)], col = isH ? hiCol : dim ? D.mixHex(col0, C.paper2, dim * 0.6) : col0, hop = isH ? Math.max(0, -D.damped(lt, hiAt, 26, 0.5, 0.45)) + (lt >= hiAt ? 6 : 0) : 0;
    const head = [C.skin, C.skinM, C.skinF][Math.floor(U.hash(i, seed + 9) * 3)];
    D.mini(c, x, yy, s * a, col, { head: !isH && dim ? D.mixHex(head, C.paper2, dim * 0.5) : head, hop }); } };
})();

// ---------- 情绪与思绪：灰云、阿顿日盘、思考泡、对话泡、情绪符号 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
// 灰云（贯穿物，压在人身上的情绪）：o { thick 0..1 云的厚度（1 满云，0.3 一小朵）, rain 0..1 雨, gold 0..1 变金（越到结尾越金）, alpha, flip }
// (x,y) 是云中心；s 大小倍数；t 全片时间（雨滴下落）
D.cloud = (c, x, y, s = 1, t = 0, o = {}) => { const { thick = 1, rain = 1, gold = 0, alpha = 1 } = o, gd = clamp(gold);
  const base = D.mixHex(C.cloud, C.goldLt, gd), alt = D.mixHex(C.cloud2, C.gold, gd), puffs = [[-100, 6, 46], [-48, -24, 60], [24, -34, 66], [88, -4, 50], [-6, 14, 58]];
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s * (0.45 + 0.55 * clamp(thick)), s * (0.5 + 0.5 * clamp(thick)));
  c.fillStyle = C.ink; puffs.forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r + 4, 0, 7); c.fill(); });
  puffs.forEach(([a, b, r], i) => { c.beginPath(); c.arc(a, b, r, 0, 7); c.fillStyle = i % 2 ? alt : base; c.fill(); });
  c.fillStyle = gd > 0.5 ? 'rgba(168,116,28,.28)' : 'rgba(40,50,70,.28)'; c.beginPath(); c.ellipse(0, 44, 120, 14, 0, 0, 7); c.fill();
  if (rain > 0) { c.lineCap = 'round'; c.strokeStyle = gd > 0.5 ? C.gold : C.rain; c.lineWidth = 6;
    [[-90, 70, 90], [-45, 78, 130], [0, 72, 100], [45, 80, 150], [90, 68, 110]].forEach(([a, b, len], i) => { const k = ((t * 0.9 + i * 0.37) % 1); c.globalAlpha = alpha * rain * (1 - k * 0.7); c.beginPath(); c.moveTo(a - 4 - k * 6, b + k * len * 0.9); c.lineTo(a - 10 - k * 6, b + k * len * 0.9 + len * 0.3); c.stroke(); }); }
  c.restore(); };
// 阿顿日盘：红盘＋放射的光线，光线末端是一只小手（一张一合）。o { rays 数, len, open, gold 0..1（1=金色，用来表示"被听见"的暖光）, down 只画下半, hands 手数 }
D.aten = (c, x, y, r = 44, t = 0, o = {}) => { const { rays = 10, len = 190, gold = 0, down = true, hands = true, spread = 1.5 } = o, col = D.mixHex('#c23a2a', C.gold, gold);
  c.save(); c.lineCap = 'round';
  for (let k = 0; k < rays; k++) { const u = rays > 1 ? k / (rays - 1) : 0.5, ang = down ? lerp(Math.PI * 0.5 - spread / 2, Math.PI * 0.5 + spread / 2, u) : u * TAU, L = len * (0.8 + 0.2 * U.hash(k, 4)), x1 = x + Math.cos(ang) * (r + L), y1 = y + Math.sin(ang) * (r + L);
    c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x + Math.cos(ang) * (r + 4), y + Math.sin(ang) * (r + 4)); c.lineTo(x1 - Math.cos(ang) * 10, y1 - Math.sin(ang) * 10); c.stroke();
    if (hands) D.hand(c, x1, y1, ang, o.open ?? (0.5 + 0.5 * Math.sin(t * 3 + k * 1.3)), gold > 0.5 ? '#c9962a' : '#b4452c', 1.1); }
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 4; c.strokeStyle = gold > 0.5 ? C.goldDk : '#7a1c14'; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.78, 0, 7); c.strokeStyle = 'rgba(255,230,190,.45)'; c.lineWidth = 2.4; c.stroke(); c.restore(); };
// 思考泡：一串小圆冒到 (x,y) 的云泡；o.text 字，o.draw(c, lt, p) 在泡中心坐标里画内容
D.thought = (c, x, y, w, h, lt, at, o = {}) => { const { fx = x - w * 0.4, fy = y + h * 0.9, fill = C.cream, text = '', size = 56, col = C.ink, edge = C.blue } = o;
  [0, 1, 2].forEach(i => { const p = D.pop(lt, at + i * 0.12, 0.35); if (p <= 0) return; const k = (i + 1) / 4, r = (10 + i * 8) * p;
    c.fillStyle = fill; c.strokeStyle = C.ink; c.lineWidth = 3.4; c.beginPath(); c.arc(lerp(fx, x - w * 0.25, k), lerp(fy, y + h * 0.45, k), r, 0, TAU); c.fill(); c.stroke(); });
  const p = D.pop(lt, at + 0.36, 0.5); if (p <= 0) return;
  c.save(); c.translate(x, y); c.scale(p, p);
  const cloud = D.once(`egcloud${w}_${h}`, () => { const q = new Path2D(), n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU, e = new Path2D(); e.arc(Math.cos(a) * w * 0.4, Math.sin(a) * h * 0.36, Math.min(w, h) * (0.26 + 0.06 * U.hash(i, 4)), 0, TAU); q.addPath(e); } const m = new Path2D(); m.ellipse(0, 0, w * 0.42, h * 0.38, 0, 0, TAU); q.addPath(m); return q; });
  c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = 11; c.stroke(cloud); c.fillStyle = fill; c.fill(cloud);
  if (text) D.text(c, TY.typed(text, D.at(lt, at + 0.5, [...text].length / 18)), 0, 2, { size, fam: 'PuHui-Heavy', col, maxW: w * 0.8 });
  if (o.draw) o.draw(c, lt, p);
  c.restore(); };
// 对话泡：奶白胶囊＋内圈（o.edge 色：父亲红/孩子蓝）＋小尾巴指向 (tx,ty)，字逐字打出
D.speech = (c, s, x, y, lt, at, o = {}) => { const { tx = x - 80, ty = y + 120, size = 52, fill = C.cream, col = C.ink, fam = 'PuHui-Heavy', edge = C.red } = o; const p = D.pop(lt, at, 0.45); if (p <= 0) return;
  c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * 1.5, h = size * 1.9; c.translate(x, y); c.scale(p, p); c.lineJoin = 'round';
  const tail = D.poly([[-w * 0.05, h * 0.3], [(tx - x) / p, (ty - y) / p], [w * 0.05, h * 0.3]]);
  c.fillStyle = 'rgba(30,22,18,.2)'; c.save(); c.translate(5, 8); c.fill(D.pill(0, 0, w, h)); c.restore();
  c.fillStyle = fill; c.fill(tail); c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(tail); c.fill(D.pill(0, 0, w, h)); c.stroke(D.pill(0, 0, w, h));
  c.fillStyle = fill; c.fillRect(-w * 0.05 + 3, h * 0.3 - 8, w * 0.1 - 6, 14);
  c.lineWidth = 3; c.strokeStyle = edge; c.stroke(D.pill(0, 0, w - 18, h - 18));
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(TY.typed(s, D.at(lt, at + 0.15, [...s].length / 18)), 0, 3); c.restore(); };
// 情绪符号：kind = spark 紧张线 | heart 心 | sweat 汗滴 | question 问号 | exclaim 叹号 | zzz 困 | scribble 乱线团 | rain 头顶小雨云 | cloud 灰云压顶（o.thick/o.gold）
//   | gold 金光（头顶小日盘，光线末端是手） | sparkle 闪星 | bulb 油灯亮了 | tear 泪滴
// (x,y) 一般放在 person 返回的 top 旁边；s 大小；lt/at 出现时刻；o.t 全片时间（循环小动）
D.emote = (c, kind, x, y, s, lt, at, o = {}) => { const p = D.pop(lt, at, 0.4); if (p <= 0) return; const { col, t = lt } = o, L = lt - at;
  c.save(); c.translate(x, y); c.scale(s * p, s * p); c.lineCap = 'round'; c.lineJoin = 'round';
  const ink = (path, fillc) => { c.fillStyle = fillc; c.fill(path); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke(path); };
  if (kind === 'spark') { const jit = (U.hash(Math.floor(t * 15), 3) - 0.5) * 4; c.strokeStyle = col || C.red; c.lineWidth = 9;
    [-0.75, -0.25, 0.25].forEach((a, i) => { const r0 = 26, r1 = 26 + 40 * MO.backOut(clamp(L / 0.25 - i * 0.2), 2); c.beginPath(); c.moveTo(Math.sin(a) * r0 + jit, -Math.cos(a) * r0); c.lineTo(Math.sin(a) * r1 + jit, -Math.cos(a) * r1); c.stroke(); }); }
  else if (kind === 'heart') { const b = 1 + 0.08 * Math.max(0, Math.sin(t * 7)); c.translate(0, -Math.min(30, L * 20)); c.scale(b, b); D.flat(c, D.heartPath(), col || C.red, { line: 3 }); }
  else if (kind === 'sweat' || kind === 'tear') { c.translate(0, Math.min(16, L * 18)); const q = new Path2D(); q.moveTo(0, -30); q.bezierCurveTo(16, -8, 20, 6, 0, 18); q.bezierCurveTo(-20, 6, -16, -8, 0, -30); ink(q, col || C.blueLt); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-6, 2, 4, 0, TAU); c.fill(); }
  else if (kind === 'question' || kind === 'exclaim') { const r = Math.sin(t * 3) * 0.12; c.rotate(r); D.text(c, kind === 'question' ? '?' : '!', 0, 0, { size: 110, fam: 'PuHui-Black', col: col || C.red }); }
  else if (kind === 'zzz') { [0, 1, 2].forEach(i => { const k = ((t * 0.6 + i / 3) % 1); D.text(c, 'Z', i * 26 + k * 20, -k * 70, { size: 40 + i * 12, fam: 'PuHui-Black', col: col || C.blueDk, alpha: 1 - k * 0.6 }); }); }
  else if (kind === 'scribble') { const n = Math.floor(clamp(L / 0.6) * 60); c.strokeStyle = col || C.ink; c.lineWidth = 6; c.beginPath();
    for (let i = 0; i <= n; i++) { const a = i * 0.55, r = 22 + 14 * Math.sin(i * 0.37) + (U.hash(i, 8) - 0.5) * 8, xx = Math.cos(a) * r * 1.3 + Math.sin(i * 0.11) * 14, yy = Math.sin(a) * r * 0.8; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
  else if (kind === 'rain') { D.cloud(c, 0, 0, 0.42, t, { thick: o.thick ?? 1, rain: 1, gold: o.gold || 0 }); }
  else if (kind === 'cloud') { D.cloud(c, 0, 0, 0.9, t, { thick: o.thick ?? 1, rain: o.rain ?? 1, gold: o.gold || 0 }); }
  else if (kind === 'gold') { D.aten(c, 0, 0, 30, t, { rays: 7, len: 80, gold: 1, down: false, hands: true, open: 0.4 + 0.5 * Math.sin(t * 3) }); }
  else if (kind === 'sparkle') { c.fillStyle = col || C.gold; c.strokeStyle = C.ink; c.lineWidth = 3; [[0, 0, 1], [46, -30, 0.55], [-40, -36, 0.45]].forEach(([a, b, k], i) => { const tw = 0.75 + 0.25 * Math.sin(t * 6 + i * 2); c.save(); c.translate(a, b); c.scale(k * tw, k * tw); c.beginPath(); for (let j = 0; j < 8; j++) { const r = j % 2 ? 9 : 34, an = j / 8 * TAU; c.lineTo(Math.sin(an) * r, -Math.cos(an) * r); } c.closePath(); c.fill(); c.stroke(); c.restore(); }); }
  else if (kind === 'bulb') { D.bulb(c, 0, 0, 1, { on: 1, t }); }
  c.restore(); };
D.heartPath = () => D.once('egheart', () => { const q = new Path2D(); q.moveTo(0, 30); q.bezierCurveTo(-60, -6, -40, -52, 0, -26); q.bezierCurveTo(40, -52, 60, -6, 0, 30); q.closePath(); return q; });
// 同心环（强调光圈）：从中心一圈圈弹开（红、金、青金蓝）
D.rings = (c, x, y, r, lt, at, o = {}) => { const cols = o.cols || [C.gold, C.red, C.blue]; c.save(); c.lineWidth = o.lw || 14;
  cols.forEach((col, i) => { const p = MO.cubicOut(D.at(lt, at + i * 0.1, 0.6)); if (p <= 0) return; c.strokeStyle = col; c.globalAlpha = (o.alpha ?? 1) * (o.fade ? 1 - D.at(lt, at + 0.8, 0.6) : 1); c.beginPath(); c.arc(x, y, r * (0.55 + 0.45 * p) + i * (c.lineWidth + 8), 0, TAU); c.stroke(); });
  c.restore(); };
})();

// ---------- 图示：箭头、柱状、比例条、时间轴、分栏、清单 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
// 粗圆头弯箭头（墨线描边＋彩芯），p 0..1 画出进度；bend 弯曲
D.arrow = (c, x0, y0, x1, y1, p = 1, o = {}) => { const { col = C.red, w = 14, bend = 0.18, head = 36, dash = null } = o; if (p <= 0) return;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -(y1 - y0), ny = x1 - x0, cx = mx + nx * bend, cy = my + ny * bend;
  const pt = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; const n = 40, end = Math.max(0.02, p);
  const stroke = (cs, lw, d) => { c.strokeStyle = cs; c.lineWidth = lw; if (d) c.setLineDash(d); c.beginPath(); for (let i = 0; i <= n; i++) { const [a, b] = pt(end * i / n * 0.97); i ? c.lineTo(a, b) : c.moveTo(a, b); } c.stroke(); c.setLineDash([]); };
  if (!dash) stroke(C.ink, w + 8); stroke(col, w, dash);
  const [ex, ey] = pt(end), [px, py] = pt(Math.max(0, end - 0.04)), an = Math.atan2(ey - py, ex - px);
  c.translate(ex, ey); c.rotate(an); const hp = D.poly([[6, 0], [-head, -head * 0.66], [-head * 0.72, 0], [-head, head * 0.66]]); c.fillStyle = col; c.fill(hp); c.lineWidth = 4.5; c.strokeStyle = C.ink; c.stroke(hp); c.restore(); };
// 柱状图（示意）：vals 0..1，labels 下方字，p 长高进度；柱子彩块＋墨线；o.hi 高亮第几根（红）
D.bars = (c, x, y, w, h, vals, p, o = {}) => { const { labels = [], cols = null, hi = -1, gapK = 0.35, note = '示意' } = o, n = vals.length, bw = w / (n + (n - 1) * gapK);
  c.fillStyle = C.ink; c.fill(D.round(x - 16, y, w + 32, 10, 3));
  vals.forEach((v, i) => { const q = MO.cubicOut(clamp(p * 1.3 - i * 0.12)), bh = h * v * q, bx = x + i * bw * (1 + gapK); if (bh > 2) {
    const col = cols ? cols[i] : i === hi ? C.red : [C.blue, C.gold, C.green, C.terra][i % 4], path = D.round(bx, y - bh, bw, bh, [4, 4, 0, 0]);
    D.flat(c, path, col, { line: 5 }); c.save(); c.clip(path); c.strokeStyle = 'rgba(30,22,18,.28)'; c.lineWidth = 3; for (let yy = y - bh + 22; yy < y; yy += 22) { c.beginPath(); c.moveTo(bx, yy); c.lineTo(bx + bw, yy); c.stroke(); } c.restore(); }
    if (labels[i]) D.text(c, labels[i], bx + bw / 2, y + 54, { size: 46, fam: 'PuHui-Heavy', maxW: bw * 1.3, alpha: clamp(p * 3) }); });
  if (note) D.tag(c, note, x + w - 40, y - h - 14, { size: 34, fill: C.paper2, edge: C.paper3, alpha: clamp(p * 3) }); };
// 比例条：parts [[份额, 色, 标签]]，p 进度
D.split = (c, x, y, w, h, parts, p, o = {}) => { let acc = 0; const tot = parts.reduce((a, q) => a + q[0], 0), full = D.round(x, y - h / 2, w * MO.cubicOut(clamp(p)), h, 8);
  c.save(); c.clip(full); parts.forEach(([v, col]) => { const ww = w * v / tot; c.fillStyle = col; c.fillRect(x + acc, y - h / 2, ww + 1, h); c.fillStyle = C.ink; c.fillRect(x + acc - 2, y - h / 2, 4, h); acc += ww; }); c.restore();
  c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(full);
  acc = 0; parts.forEach(([v, col, lab]) => { const ww = w * v / tot; if (lab && p > 0.6) D.text(c, lab, x + acc + ww / 2, y + h / 2 + 46, { size: 44, fam: 'PuHui-Heavy', alpha: D.at(p, 0.6, 0.3), maxW: Math.max(ww, 120) }); acc += ww; }); };
// 时间轴：横线＋圆点站，cur 当前站高亮；labels 站名
D.timeline = (c, x0, x1, y, labels, cur = -1, p = 1, o = {}) => { const n = labels.length, X = i => lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5);
  const xe = lerp(x0, x1, MO.cubicOut(clamp(p))); c.lineCap = 'round'; c.strokeStyle = C.ink; c.lineWidth = 16; c.beginPath(); c.moveTo(x0, y); c.lineTo(xe, y); c.stroke(); c.strokeStyle = C.gold; c.lineWidth = 8; c.beginPath(); c.moveTo(x0, y); c.lineTo(xe, y); c.stroke();
  labels.forEach((s, i) => { const q = clamp(p * n - i); if (q <= 0) return; const on = i === cur, r = (on ? 28 : 20) * MO.backOut(q, 1.6);
    D.flat(c, D.circle(X(i), y, r), on ? C.red : C.cream, { line: 5 }); if (!on) { c.fillStyle = C.blue; c.beginPath(); c.arc(X(i), y, r * 0.35, 0, TAU); c.fill(); }
    D.text(c, s, X(i), y + (i % 2 ? -72 : 78), { size: on ? 50 : 44, fam: 'PuHui-Heavy', col: on ? C.redDk : C.ink, alpha: q, maxW: (x1 - x0) / Math.max(1, n - 1) * 1.6 }); }); };
// 埃及数字：竖线计数（1–9，每组三画），当步骤编号。(x,y) 是中心
D.tally = (c, n, x, y, s = 1, col = C.ink) => { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 9;
  const rows = n <= 3 ? [n] : n <= 6 ? [3, n - 3] : [3, 3, n - 6], hh = rows.length > 1 ? 13 : 22, dy = rows.length > 1 ? 30 : 0;
  rows.forEach((k, r) => { const yy = (r - (rows.length - 1) / 2) * dy; for (let i = 0; i < k; i++) { const xx = (i - (k - 1) / 2) * 20; c.beginPath(); c.moveTo(xx, yy - hh); c.lineTo(xx, yy + hh); c.stroke(); } }); c.restore(); };
// 分栏格（壁画格）：墨线框＋底色＋内圈；p 0..1 展开；返回内区 [x,y,w,h]
D.panel = (c, x, y, w, h, o = {}) => { const { fill = C.cream, edge = C.gold, p = 1, alpha = 1 } = o; if (p <= 0) return null; const k = MO.cubicOut(clamp(p)), ww = w * k;
  c.save(); c.globalAlpha *= alpha; D.flat(c, D.round(x, y, ww, h, 6), fill, { line: 5 }); if (ww > 30) { c.lineWidth = 3; c.strokeStyle = edge; c.stroke(D.round(x + 10, y + 10, ww - 20, h - 20, 3)); } c.restore(); return [x + 10, y + 10, ww - 20, h - 20]; };
// 清单（步骤列）：items 字串数组，逐项弹出（间隔 o.gap 秒）。每行：埃及数字圆牌＋文字＋右端象形字，行间分栏线。
// D.list(c, ['先听', '再问', '后讲'], x, y(第一行中心), w, lt, at, { rowH, size, icons:['ear'..], cols })
D.list = (c, items, x, y, w, lt, at, o = {}) => { const { rowH = 170, size = 62, gap = 0.55, cols = [C.red, C.blue, C.gold, C.green], icons = ['ankh', 'eye', 'feather', 'lotus', 'sun', 'bread'] } = o;
  items.forEach((s, i) => { const p = D.pop(lt, at + i * gap, 0.5); if (p <= 0) return; const yy = y + i * rowH, col = cols[i % cols.length];
    c.save(); c.translate(x + w / 2, yy); c.scale(1, p); c.translate(-w / 2 - x, -yy);
    D.flat(c, D.round(x, yy - rowH * 0.42, w, rowH * 0.84, 16), C.cream, { line: 5 }); c.lineWidth = 3; c.strokeStyle = col; c.stroke(D.round(x + 9, yy - rowH * 0.42 + 9, w - 18, rowH * 0.84 - 18, 10));
    D.flat(c, D.circle(x + 78, yy, 52), col, { line: 5 }); D.tally(c, i + 1, x + 78, yy, 0.9, C.cream);
    D.text(c, s, x + 160, yy + 3, { size, fam: 'PuHui-Black', align: 'left', maxW: w - 160 - 130 });
    D.glyph(c, icons[i % icons.length], x + w - 66, yy, 62, C.ink2); c.restore(); }); };
})();

// ---------- 道具：纸草书、石板手机、陶杯、油灯、天平、时钟、日盘、大脑、心、窗、莲盆、供桌、裂缝 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
const tf = (c, x, y, s, rot, fn) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s, s); fn(); c.restore(); };
// 莲花盆：ang 让花茎摆（配 D.damped）；(x,y) 盆底中心
D.plant = (c, x, y, s = 1, ang = 0, o = {}) => tf(c, x, y, s, 0, () => { const pot = o.pot || C.clay;
  c.save(); c.translate(0, -108); c.rotate(ang);
  [[-46, -190, C.green], [52, -170, C.greenDk], [-8, -250, C.green]].forEach(([tx, ty, col], i) => { c.save(); c.rotate(Math.sin(i * 1.7) * 0.02 + ang * (0.5 + i * 0.3)); D.tube(c, [[0, 0], [tx * 0.4, ty * 0.5], [tx, ty]], 9, col, 2.6);
    const f = D.poly([[tx, ty + 6], [tx - 26, ty - 26], [tx - 10, ty - 46], [tx, ty - 22], [tx + 10, ty - 46], [tx + 26, ty - 26]]); D.flat(c, f, i === 1 ? C.red : C.blueLt, { line: 3.4 }); c.restore(); });
  c.restore(); const p = D.poly([[-70, -112], [70, -112], [60, -16], [40, 0], [-40, 0], [-60, -16]]); D.flat(c, p, pot, { line: 4.5 });
  c.fillStyle = C.cream; c.fillRect(-66, -92, 132, 14); c.fillStyle = C.blue; c.fillRect(-62, -60, 124, 10); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(-66, -92, 132, 14); });
// 书＝纸草卷：open 0 卷着（带系绳和标题牌）→ 1 展开（象形字行）；col 木轴色；title 展开前挂的牌；(x,y) 底中心
D.book = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const { open = 0, col = C.wood, title = '' } = o, k = MO.cubicInOut(clamp(open)), pap = '#EFE2B8';
  if (k < 0.5) { const q = 1 - k * 2; c.save(); c.scale(1, 1); D.flat(c, D.round(-150, -150, 300, 150, 22), pap, { line: 5 });
    [-1, 1].forEach(sd => { D.flat(c, D.ellipse(sd * 150, -75, 24 * (0.5 + q * 0.5) + 10, 75, 0), pap, { line: 5 }); D.flat(c, D.ellipse(sd * 150, -75, 12, 36, 0), C.paper3, { line: 3 }); });
    c.strokeStyle = 'rgba(30,22,18,.3)'; c.lineWidth = 2; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(-140, -150 + i * 30); c.lineTo(140, -150 + i * 30); c.stroke(); }
    D.flat(c, D.round(-16, -158, 32, 166, 6), C.red, { line: 4 }); if (title) D.tag(c, title, 0, -76, { size: 40, padX: 0.5, edge: C.red }); c.restore(); }
  else { const q = (k - 0.5) * 2, hw = 40 + 215 * q; D.flat(c, D.round(-hw, -300, hw * 2, 300, 8), pap, { line: 5 });
    c.save(); c.clip(D.round(-hw, -300, hw * 2, 300, 8)); c.strokeStyle = C.ink2; c.lineWidth = 2; for (let r = 0; r < 4; r++) { const yy = -250 + r * 62; c.beginPath(); c.moveTo(-hw + 20, yy + 30); c.lineTo(hw - 20, yy + 30); c.stroke();
      if (q > 0.6) D.glyphRow(c, -hw + 28, hw - 28, yy, 4 + r, 40, [C.ink, C.red, C.blue]); } c.restore();
    [-1, 1].forEach(sd => D.flat(c, D.round(sd * hw - 12, -314, 24, 328, 10), col, { line: 4.5 })); } });
// 手机＝石板（青金石蓝）：screen(c) 在屏幕坐标（-80..80, -160..160）画内容；buzz 震动时刻配 o.t
D.phone = (c, x, y, s = 1, o = {}) => { const jit = o.buzz != null && o.t != null && o.t - o.buzz > 0 && o.t - o.buzz < 0.6 ? Math.sin((o.t - o.buzz) * 80) * 6 : 0;
  tf(c, x + jit, y, s, o.rot || 0, () => { D.flat(c, D.round(-96, -190, 192, 380, 26), C.blue, { line: 6 }); D.flat(c, D.round(-80, -168, 160, 336, 14), o.lit ? C.cream : C.blueDk, { line: 3.4 });
    if (o.screen) { c.save(); c.clip(D.round(-80, -168, 160, 336, 14)); o.screen(c); c.restore(); } D.flat(c, D.round(-24, -182, 48, 9, 4), C.gold, { line: 2.4 }); }); };
// 杯＝双耳陶杯：steam 用全片时间让热气飘
D.cup = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const col = o.col || C.terra;
  if (o.t != null) { c.strokeStyle = 'rgba(70,60,50,.5)'; c.lineWidth = 7; c.lineCap = 'round'; [-24, 10].forEach((sx, i) => { c.beginPath(); for (let k = 0; k <= 12; k++) { const yy = -166 - k * 8, xx = sx + Math.sin(k * 0.7 + o.t * 3 + i * 2) * 8 * (k / 12 + 0.2); k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }); }
  [-1, 1].forEach(sd => { c.strokeStyle = C.ink; c.lineWidth = 22; c.beginPath(); c.arc(sd * 62, -90, 26, sd > 0 ? -1.4 : Math.PI - 1.4 + 0.0, sd > 0 ? 1.4 : Math.PI + 1.4); c.stroke(); c.strokeStyle = col; c.lineWidth = 12; c.stroke(); });
  D.flat(c, D.poly([[-52, -150], [52, -150], [64, -100], [44, 0], [-44, 0], [-64, -100]]), col, { line: 5 }); c.fillStyle = C.cream; c.fillRect(-60, -110, 120, 16); c.fillStyle = C.blue; c.fillRect(-52, -70, 104, 12); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(-60, -110, 120, 16);
  D.flat(c, D.ellipse(0, -150, 52, 10), C.coffee, { line: 4 }); });
// 灯泡＝油灯：on 0..1 点亮（火苗与光芒）
D.bulb = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const on = clamp(o.on ?? 1), t = o.t || 0;
  if (on > 0) { c.strokeStyle = C.gold; c.lineWidth = 8; c.lineCap = 'round'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42, r0 = 86, r1 = 86 + 30 * on + Math.sin(t * 5 + k) * 3; c.beginPath(); c.moveTo(Math.cos(a) * r0, -50 + Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, -50 + Math.sin(a) * r1); c.stroke(); } }
  D.flat(c, D.poly([[-62, -40], [62, -40], [44, 0], [-44, 0]]), C.clay, { line: 5 }); D.flat(c, D.round(-52, -52, 104, 20, 8), C.gold, { line: 4 });
  const f = 0.4 + 0.6 * on, fl = Math.sin(t * 9) * 3; const flame = D.smooth([[0, -62], [-22 * f, -90 * f - 20], [-8 * f, -130 * f - 30 + fl], [0, -150 * f - 38], [14 * f, -120 * f - 30], [26 * f, -88 * f - 18]]);
  D.flat(c, flame, on > 0.5 ? C.goldLt : C.paper3, { line: 4 }); if (on > 0.5) D.flat(c, D.ellipse(0, -96 * f - 20, 8 * f, 18 * f), C.red, { line: 0 }); });
// 天平（秤心）：tilt -1..1（正＝右边沉）；left/right(c) 在托盘上画东西
D.scales = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const a = (o.tilt || 0) * 0.32;
  D.flat(c, D.round(-14, -300, 28, 300, 6), C.wood, { line: 5 }); D.flat(c, D.round(-96, -24, 192, 28, 6), C.wood, { line: 5 });
  c.save(); c.translate(0, -300); c.rotate(a); D.flat(c, D.round(-230, -11, 460, 22, 8), C.gold, { line: 5 });
  [-1, 1].forEach(sd => { c.save(); c.translate(sd * 220, 0); c.rotate(-a); c.strokeStyle = C.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, 120); c.moveTo(0, 0); c.lineTo(70, 120); c.stroke();
    D.flat(c, D.poly([[-90, 120], [90, 120], [60, 152], [-60, 152]]), C.gold, { line: 4.5 }); const f = sd < 0 ? o.left : o.right; if (f) { c.translate(0, 118); f(c); } c.restore(); });
  c.restore(); D.flat(c, D.circle(0, -300, 22), C.red, { line: 4.5 }); });
// 时钟＝日晷盘：h 小时（带小数走针）
D.clock = (c, x, y, r = 120, o = {}) => tf(c, x, y, 1, 0, () => { const h = o.h ?? 10.1;
  D.flat(c, D.circle(0, 0, r), o.col || C.gold, { line: 6 }); D.flat(c, D.circle(0, 0, r * 0.8), C.cream, { line: 3.4 });
  c.fillStyle = C.ink; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.arc(Math.sin(a) * r * 0.66, -Math.cos(a) * r * 0.66, i % 3 ? r * 0.03 : r * 0.055, 0, TAU); c.fill(); }
  c.lineCap = 'round'; [[h / 12 * TAU, 0.38, 0.09], [(h % 1) * TAU, 0.58, 0.06]].forEach(([a, L, w]) => { c.strokeStyle = C.ink; c.lineWidth = r * w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * r * L, -Math.cos(a) * r * L); c.stroke(); });
  D.flat(c, D.circle(0, 0, r * 0.08), C.red, { line: 3 }); });
// 太阳＝阿顿日盘（光线末端有手）
D.sun = (c, x, y, r = 110, t = 0) => D.aten(c, x, y, r * 0.5, t, { rays: 12, len: r * 0.95, down: false, hands: true });
// 大脑：陶土色块＋回纹；glow 0..1 某一区亮起金斑
D.brain = (c, x, y, r = 160, o = {}) => tf(c, x, y, r / 160, 0, () => { const p = D.once('egbrain', () => D.smooth([[-150, 10], [-140, -70], [-90, -125], [-10, -140], [70, -128], [135, -80], [155, 0], [130, 70], [60, 100], [-30, 105], [-110, 80]]));
  D.flat(c, p, o.col || C.terra, { line: 6 });
  if (o.glow) { c.save(); c.clip(p); const g = c.createRadialGradient(o.gx ?? 40, o.gy ?? -40, 4, o.gx ?? 40, o.gy ?? -40, 90); g.addColorStop(0, `rgba(240,206,110,${clamp(o.glow)})`); g.addColorStop(1, 'rgba(240,206,110,0)'); c.fillStyle = g; c.fillRect(-170, -150, 340, 260); c.restore(); }
  c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round';
  [[[-110, -40], [-70, -80], [-30, -50]], [[-20, -100], [20, -70], [70, -95]], [[-90, 40], [-40, 10], [10, 50]], [[30, 0], [80, -30], [120, 20]], [[0, -10], [0, 30], [0, 80]]].forEach(([a, b, d]) => { c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(...b, ...d); c.stroke(); }); });
// 心：beat 跳动
D.heart = (c, x, y, r = 120, o = {}) => tf(c, x, y, r / 40 * (1 + 0.07 * Math.max(0, Math.sin((o.t || 0) * (o.bpm || 70) / 60 * TAU))), 0, () => D.flat(c, D.heartPath(), o.col || C.red, { line: 2.6 }));
// 窗＝石窗：框＋天空＋沙丘金字塔剪影＋日盘
D.window = (c, x, y, w = 360, h = 420, o = {}) => { c.save(); c.translate(x - w / 2, y - h / 2);
  D.flat(c, D.round(-16, -16, w + 32, h + 32, 6), C.paper3, { line: 6 }); const pane = D.round(8, 8, w - 16, h - 16, 4); c.save(); c.clip(pane);
  c.fillStyle = o.night ? C.navy : '#9FC3D4'; c.fillRect(0, 0, w, h); c.fillStyle = o.night ? C.goldLt : C.red; c.beginPath(); c.arc(w * 0.68, h * 0.3, w * 0.09, 0, TAU); c.fill();
  c.fillStyle = C.gold; c.beginPath(); c.moveTo(0, h * 0.72); c.quadraticCurveTo(w * 0.3, h * 0.62, w * 0.55, h * 0.72); c.quadraticCurveTo(w * 0.8, h * 0.8, w, h * 0.7); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  c.fillStyle = C.goldDk; c.beginPath(); c.moveTo(w * 0.1, h * 0.72); c.lineTo(w * 0.3, h * 0.46); c.lineTo(w * 0.5, h * 0.72); c.closePath(); c.fill(); c.strokeStyle = C.ink; c.lineWidth = 4; c.stroke(); c.restore();
  c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(pane); c.restore(); };
// 供桌（餐桌）：贯穿物。(x,y) 地面中心；gap 0..1 桌子从中间裂开（缝）；gold 0..1 缝被金填上；items 供品
D.table = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const { gap = 0, gold = 0, items = ['bread', 'plate', 'lotus'] } = o, gw = gap * 56, top = -250;
  const body = (side) => { c.save(); c.beginPath(); c.rect(side < 0 ? -400 : gw / 2 - 0.5, -700, side < 0 ? 400 - gw / 2 : 400, 800); if (gap > 0) c.clip(); else c.rect(-400, -700, 800, 800);
    c.save(); c.translate(side * gw / 2 * (gap > 0 ? 1 : 0), 0);
    D.flat(c, D.poly([[-40, top + 12], [-52, top + 60], [-30, top + 110], [-30, top + 160], [-70, top + 230], [-80, 0], [80, 0], [70, top + 230], [30, top + 160], [30, top + 110], [52, top + 60], [40, top + 12]]), C.cream, { line: 5 });
    c.fillStyle = C.blue; c.fillRect(-72, top + 130, 144, 12); c.fillStyle = C.red; c.fillRect(-76, top + 150, 152, 12); c.fillStyle = C.blue; c.fillRect(-76, -36, 152, 12);
    D.flat(c, D.round(-110, top - 6, 220, 24, 4), C.white, { line: 5 }); c.fillStyle = C.red; c.fillRect(-106, top + 8, 212, 5);
    if (items.includes('bread')) D.flat(c, D.poly([[-96, top - 6], [-86, top - 58], [-74, top - 86], [-62, top - 58], [-52, top - 6]]), C.white, { line: 4 });
    if (items.includes('plate')) { D.flat(c, D.smooth([[-38, top - 6], [-36, top - 40], [14, top - 44], [52, top - 40], [56, top - 6]]), C.gold, { line: 4 });
      [[-6, -50], [12, -50], [30, -50], [4, -66], [22, -66], [14, -82]].forEach(([a, b]) => D.flat(c, D.circle(a, top + b, 10), C.blueDk, { line: 2.4 })); }
    if (items.includes('lotus')) { c.strokeStyle = C.ink; c.lineWidth = 9; c.beginPath(); c.moveTo(82, top - 6); c.lineTo(82, top - 74); c.stroke(); c.strokeStyle = C.green; c.lineWidth = 4; c.stroke();
      D.flat(c, D.poly([[82, top - 70], [64, top - 98], [74, top - 116], [82, top - 96], [90, top - 116], [100, top - 98]]), C.blueLt, { line: 3.4 }); }
    c.restore(); c.restore(); };
  body(-1); body(1);
  if (gap > 0) { const gx = gw / 2 + 4; c.fillStyle = gold > 0 ? D.mixHex(C.ink, C.gold, clamp(gold)) : C.ink; c.beginPath(); c.moveTo(-gx, top); c.lineTo(gx, top); c.lineTo(gx * 0.7, 0); c.lineTo(-gx * 0.7, 0); c.closePath(); c.fill();
    if (gold > 0) { c.fillStyle = D.mixHex(C.paper2, C.gold, clamp(gold)); c.fillRect(-gx + 4, top, gx * 2 - 8, -top); c.fillStyle = C.goldLt; c.fillRect(-2, top + 8, 4, -top - 16); } } });
// 墙上的缝：从 (x,y0) 往下裂到 y1，p 0..1 裂开进度；o.gold 0..1 金缮（缝被金填上）；o.w 缝宽
D.crack = (c, x, y0, y1, p = 1, o = {}) => { if (p <= 0) return; const { gold = 0, w = 3, seed = 11 } = o, r = U.rng(seed); let cx = x, a = Math.PI / 2; const pts = [[cx, y0]], n = Math.max(2, Math.round((y1 - y0) / 16));
  for (let i = 1; i <= n * clamp(p); i++) { a = Math.PI / 2 + (r() - 0.5) * 1.1; cx += Math.cos(a) * 16; cx = Math.max(x - 26, Math.min(x + 26, cx)); pts.push([cx, y0 + i * (y1 - y0) / n]); }
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
  c.strokeStyle = 'rgba(70,45,28,.7)'; c.lineWidth = w + 2; c.stroke(); if (gold > 0) { c.strokeStyle = D.mixHex('#46301c', C.gold, clamp(gold)); c.lineWidth = w + 3 * clamp(gold); c.stroke(); } c.restore(); };
})();

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 日盘光线下的大王名圈里逐字出章名，上面砸入「第 N 章」；下方 N 站进度轨，一个小人（D.cardToken）从上一站走到本站，站定后挥手。
// 换书时可在本书 props.js 里改 D.cardToken = (c, x, y, lt, t, walking, arriveAt) => {…}；D.CARD_TINTS 是每章轮换的底色。
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.CARD_TINTS = D.CARD_TINTS || ['sand', 'cream', 'dusk', 'sand'];
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking, arriveAt) => D.person(c, x, y, 0.3, { kind: 'child', pose: walking ? 'walk' : 'stand', to: walking ? null : 'wave', mix: D.at(lt, arriveAt + 0.15, 0.4), walk: walking ? lt * 11 : null, t, react: arriveAt, mood: 'happy', top: C.blue }));
D.chapterCard = (c, lt, t, n, title = '') => {
  const tint = D.CARD_TINTS[(n - 1) % D.CARD_TINTS.length];
  D.bg(c, t, { tint, floor: false, seed: n, sun: { x: W / 2, y: 330, r: 52, rays: 9, len: 170, spread: 1.7 } });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, y = 1250, X = i => lerp(x0, x1, i / (N - 1));
  c.fillStyle = C.ink; c.fill(D.round(x0 - 34, y - 13, x1 - x0 + 68, 26, 10)); c.fillStyle = C.paper3; c.fill(D.round(x0 - 30, y - 9, x1 - x0 + 60, 18, 7));
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1);
  c.fillStyle = C.gold; c.fill(D.round(x0 - 30, y - 9, Math.max(18, lerp(n > 1 ? X(n - 2) : x0 - 30, done, q) - x0 + 30), 18, 7));
  for (let i = 0; i < N; i++) { const cur = i === n - 1, p = cur ? D.pop(lt, walkEnd, 0.45) : 1, past = i < n - 1;
    D.flat(c, D.circle(X(i), y, cur ? 24 * Math.max(0.6, p) : 14), past ? C.gold : cur ? C.red : C.cream, { line: 4 }); }
  if (lt > walkEnd) D.rings(c, done, y, 32, lt, walkEnd, { lw: 7, fade: true, alpha: 0.8 });
  const tx = lerp(n > 1 ? X(n - 2) : x0 - 60, done, q); D.cardToken(c, tx, y - 14, lt, t, lt < walkEnd, walkEnd);
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); D.tag(c, `第 ${n} 章`, W / 2, 560, { size: 62, fam: 'PuHui-Black', fill: C.red, col: C.cream, edge: C.goldLt, scale: s }); }
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 7 ? 104 : 124;
  const ph = lines.length > 1 ? 330 : 230, cy = lines.length > 1 ? 840 : 800, pa = D.pop(lt, 0.3, 0.5);
  if (pa > 0) { c.save(); c.translate(W / 2, cy); c.scale(pa, pa); c.fillStyle = 'rgba(30,22,18,.22)'; c.fill(D.pill(6, 10, 960, ph)); c.fillStyle = C.cream; c.fill(D.pill(0, 0, 960, ph)); c.lineWidth = 7; c.strokeStyle = C.ink; c.stroke(D.pill(0, 0, 960, ph));
    c.lineWidth = 4; c.strokeStyle = C.gold; c.stroke(D.pill(0, 0, 930, ph - 30)); c.fillStyle = C.ink; c.fillRect(425, -ph / 2 - 8, 14, ph + 16); c.fillStyle = C.red; c.fillRect(428, -ph / 2 - 4, 8, ph + 8); c.restore(); }
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
    if (k > 0) D.text(c, a.slice(0, k).join(''), W / 2 - 24, cy + (i - (lines.length - 1) / 2) * size * 1.22, { size, fam: 'PuHui-Black', maxW: 830 }); });
  D.finish(c);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：墨褐底板＋金细边＋沙白字，字幕带 y≈1480，让开视频号底栏
(() => { const D = K;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(30,22,18,.28)'; c.beginPath(); c.roundRect(x - w / 2 + 3, y - h / 2 + 8, w, h, 14); c.fill();
  c.fillStyle = 'rgba(30,22,18,.93)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 14); c.fill();
  c.strokeStyle = '#D9A82E'; c.lineWidth = 3; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 9); c.stroke();
  c.fillStyle = '#F6F2E8'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
