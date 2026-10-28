// 画风套件 greek（配方 huashu-art-motion 03_greek「阿提卡黑绘陶器」，来自《读懂 SpaceX 招股书》）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：黑绘 = 黑釉剪影（sil）＋ 陶土色刻线（line）＋ 附加色（酒红带＋米白小点）三件套，缺一不可；
//       底 = 陶土橙（拉坯纹、颗粒、暗角），酒红只给字牌/饰带/火焰/关键块，米白字；剪影不描边，靠与底的对比成形；
//       版面 = 回纹边框＋滚动纹带（顶回纹、底莲苞、两侧串点）框住画面，内容区 x56–1024, y120–1700（D.SAFE），字幕带 y1380–1560 内不放关键内容；
//       数据图 = 陶罐柱（D.jar/D.bars）、分段圆盘（D.pie）、天平（D.scales）、币堆（D.coins）；人只出侧面剪影（D.person），无五官；
//       反相（风险/崩塌章）：所有函数传 {inv:true} → 黑底、剪影变陶土橙、刻线变黑（红绘式反相）。
//       环境层用 t 驱动匀速滚动；其余确定性；所有随机走 U.rng / U.hash 种子。字体只用引擎自带 PuHui-Black / PuHui-Bold（GB2312 子集）。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让「r - 线宽」之类算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__gk) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__gk = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__gk) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__gk = 1; } }

// ---------- 色板 ----------
const C = D.C = {
  clay: '#dc6a2f', clayD: '#b4531f', clayDD: '#4a1c0a', pale: '#f3cfa4',   // 陶土底、深陶土、字幕带压暗用的深陶土、陶土留白
  black: '#1b120d', red: '#8a2a37', white: '#f6ead6', inc: '#ee9a58',      // 黑釉、酒红、米白、刻线橙
};
// 反相（黑底）：剪影 = 陶土橙，刻线 = 黑釉
const INV = { sil: C.clay, line: C.black, red: C.red, white: C.white, bg: '#17100b', fg: C.white, outline: C.black, pale: C.pale, sub: C.clayD, inv: true };
const NOR = { sil: C.black, line: C.inc, red: C.red, white: C.white, bg: C.clay, fg: C.white, outline: C.black, pale: C.pale, sub: C.clayD, inv: false };
const pl = o => (o && o.inv) ? INV : NOR;
D.pal = inv => inv ? INV : NOR;
D.SAFE = { x0: 56, x1: 1024, y0: 120, y1: 1700, subY0: 1380, subY1: 1560 };   // 内容安全区与字幕带

// ---------- 进度 / 缓存 / 相机 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
D.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
D.rng = seed => U.rng(seed);

// ---------- 底：陶土（拉坯纹、颗粒、裂纹）／反相黑底，缓存 ----------
const bgTex = inv => P.cached(inv ? 'gk_bg_inv' : 'gk_bg', W, H, g => {
  const lw = 270, lh = 480, lo = P.canvas(lw, lh), lg = lo.getContext('2d'), img = lg.createImageData(lw, lh), d = img.data, b = P.hex(inv ? '#1a120c' : C.clay);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const n = P.fbm(x * 0.016 + 3, y * 0.016, 4), s = P.noise(x * 0.85, y * 0.006) * 0.3 + P.noise(x * 0.3, y * 0.013) * 0.7;
    const k = inv ? n * 14 + s * 5 : n * 28 + s * 8, i = (y * lw + x) * 4;
    d[i] = b[0] + k; d[i + 1] = b[1] + k * 0.75; d[i + 2] = b[2] + k * 0.45; d[i + 3] = 255;
  }
  lg.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, W, H);
  const hl = g.createRadialGradient(560, 700, 60, 560, 700, 800); hl.addColorStop(0, inv ? 'rgba(220,106,47,.10)' : 'rgba(255,170,90,.2)'); hl.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = hl; g.fillRect(0, 0, W, H);
  const r = U.rng(31);
  for (let i = 0; i < 420; i++) { const y = r() * H, x = r() * W - 200, L = 100 + r() * 600;
    g.strokeStyle = inv ? `rgba(238,154,88,${0.015 + r() * 0.03})` : (r() < 0.55 ? `rgba(120,38,8,${0.03 + r() * 0.05})` : `rgba(255,196,140,${0.03 + r() * 0.05})`);
    g.lineWidth = 0.7 + r() * 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + (r() - .5) * 2); g.stroke(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = inv ? `rgba(238,154,88,${0.05 + r() * 0.12})` : `rgba(70,24,8,${0.25 + r() * 0.45})`; g.beginPath(); g.arc(r() * W, r() * H, 0.6 + r() * 1.6, 0, TAU); g.fill(); }
  g.drawImage(P.grain(inv ? 'gk_gA_i' : 'gk_gA', 0.07, inv ? [238, 154, 88] : [70, 22, 6], inv ? 0.08 : 0.16), 0, 0);
  g.strokeStyle = inv ? 'rgba(238,154,88,.18)' : 'rgba(52,18,6,.5)'; g.lineWidth = 1.3; g.beginPath(); const cr = U.rng(5); let x = 40, y = 1640; g.moveTo(x, y);
  for (let i = 0; i < 30; i++) { x += 18 + cr() * 14; y += (cr() - .4) * 14; g.lineTo(x, y); } g.stroke();
});
const vigTex = inv => P.cached(inv ? 'gk_vig_inv' : 'gk_vig', W, H, g => {
  const v = g.createRadialGradient(W / 2, 780, 420, W / 2, 780, 1250); v.addColorStop(0, 'rgba(30,6,0,0)'); v.addColorStop(1, inv ? 'rgba(0,0,0,.5)' : 'rgba(30,6,0,.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
});

// ---------- 回纹带 / 莲苞链（预渲成条带，每帧 drawImage 平移；周期 60 / 76） ----------
const MP = 60, LP = 76;
const meanderStrip = inv => P.cached(inv ? 'gk_mea_i' : 'gk_mea', W + 2 * MP, 84, g => {
  const p = pl({ inv }), u = [[4, 46], [4, 0], [50, 0], [50, 34], [18, 34], [18, 14], [36, 14], [36, 22]];
  g.strokeStyle = p.sil; g.lineJoin = 'miter'; g.lineCap = 'butt'; g.lineWidth = 8;
  for (let x = 0; x < W + 3 * MP; x += MP) { g.beginPath(); u.forEach((q, i) => i ? g.lineTo(x + q[0], 16 + q[1]) : g.moveTo(x + q[0], 16 + q[1])); g.stroke(); }
  g.lineWidth = 7; g.beginPath(); g.moveTo(0, 8); g.lineTo(W + 2 * MP, 8); g.moveTo(0, 70); g.lineTo(W + 2 * MP, 70); g.stroke();
  g.strokeStyle = p.line; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 8); g.lineTo(W + 2 * MP, 8); g.moveTo(0, 70); g.lineTo(W + 2 * MP, 70); g.stroke();
});
const lotusStrip = inv => P.cached(inv ? 'gk_lot_i' : 'gk_lot', W + 2 * LP, 120, g => {
  const p = pl({ inv }); g.fillStyle = p.sil; g.fillRect(0, 56, W + 2 * LP, 8); let k = 0;
  for (let x = 0; x < W + 3 * LP; x += 38, k++) {
    const up = k % 2 === 0; g.save(); g.translate(x + 19, 60); if (!up) g.scale(1, -1);
    g.fillStyle = up ? p.sil : p.red; g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-18, -34, 0, -52); g.quadraticCurveTo(18, -34, 16, 0); g.closePath(); g.fill();
    g.strokeStyle = up ? p.line : p.white; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -8); g.lineTo(0, -40); g.stroke(); g.restore();
  }
});
const sh = (off, per) => ((off % per) + per) % per;
// 回纹带（x0..x1，顶边 y，缩放 s，偏移 off）。单独用时：D.meander(c, 100, 980, 300, 1, t*30)
D.meander = (c, x0, x1, y, s = 1, off = 0, o = {}) => { c.save(); c.beginPath(); c.rect(x0, y, x1 - x0, 84 * s); c.clip(); c.translate(x0, y); c.scale(s, s); const st = meanderStrip(!!o.inv); for (let xx = -sh(off / s, MP); xx < (x1 - x0) / s; xx += W) c.drawImage(st, xx, 0); c.restore(); };
D.lotus = (c, x0, x1, y, off = 0, o = {}) => { c.save(); c.beginPath(); c.rect(x0, y, x1 - x0, 120); c.clip(); c.drawImage(lotusStrip(!!o.inv), x0 - sh(off, LP), y); c.restore(); };
// 边框＋滚动纹带：顶回纹（左行）、底莲苞（右行）、两侧串点。o { speed(px/s), top, bottom, sides, inv }
D.frame = (c, t, o = {}) => {
  const p = pl(o), v = o.speed ?? 26, top = o.top !== false, bot = o.bottom !== false, sides = o.sides !== false;
  if (top) D.meander(c, 0, W, 18, 1, t * v, o);
  if (bot) D.lotus(c, 0, W, 1712, -t * v * 0.8, o);
  if (sides) for (const x of [14, W - 14]) {
    c.strokeStyle = p.sil; c.lineWidth = 7; c.beginPath(); c.moveTo(x, top ? 96 : 0); c.lineTo(x, bot ? 1720 : H); c.stroke();
    c.strokeStyle = p.line; c.lineWidth = 2; c.beginPath(); c.moveTo(x, top ? 96 : 0); c.lineTo(x, bot ? 1720 : H); c.stroke();
    c.fillStyle = p.white; for (let y = 118; y < 1700; y += 44) { c.beginPath(); c.arc(x < W / 2 ? 32 : W - 32, y, 3.2, 0, TAU); c.fill(); }
  }
};
// 底。o { inv:反相黑底, frame:false 关掉边框/纹带, speed, top/bottom/sides }
D.bg = (c, t, o = {}) => { c.drawImage(bgTex(!!o.inv), 0, 0); if (o.frame !== false) D.frame(c, t, o); };
// 每镜收尾：暗角＋字幕带 y1380–1560 压暗（深陶土，不用蓝紫）
D.finish = (c, o = {}) => {
  c.drawImage(vigTex(!!o.inv), 0, 0);
  const b = c.createLinearGradient(0, 1360, 0, 1600); b.addColorStop(0, 'rgba(74,28,10,0)'); b.addColorStop(0.3, 'rgba(74,28,10,.6)'); b.addColorStop(0.7, 'rgba(74,28,10,.6)'); b.addColorStop(1, 'rgba(74,28,10,0)');
  c.fillStyle = b; c.fillRect(0, 1360, W, 240);
};

// ---------- 黑釉剪影＋刻线＋附加色 辅助 ----------
D.sil = (c, path, o = {}) => { c.fillStyle = pl(o).sil; c.fill(path); };
// 刻线：pts [[x,y],…] 折线或 Path2D
D.incise = (c, pts, o = {}) => { c.save(); c.strokeStyle = pl(o).line; c.lineWidth = o.lw || 3; c.lineCap = 'round'; c.lineJoin = 'round'; if (pts instanceof Path2D) c.stroke(pts); else { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); } c.restore(); };
D.dots = (c, pts, r = 4.5, o = {}) => { c.fillStyle = pl(o).white; for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } };
D.dotRow = (c, x0, y0, x1, y1, gap = 20, r = 4, o = {}) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / gap)), a = []; for (let i = 0; i <= n; i++) a.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); D.dots(c, a, r, o); };
// 酒红饰带＋白点（矩形）
D.band = (c, x, y, w, h, o = {}) => { const p = pl(o); c.fillStyle = p.red; c.fillRect(x, y, w, h); D.dotRow(c, x + h * 0.6, y + h / 2, x + w - h * 0.6, y + h / 2, o.gap || h * 0.55, o.r || Math.max(2.4, h * 0.11), o); };

// ---------- 文字 ----------
// 默认米白字＋黑釉描边（陶土底上够清楚）；字号默认 64（≥56）。o { size, fam, col, align, alpha, scale, maxW, rot, outline:false, outlineCol, track }
D.text = (c, s, x, y, o = {}) => { const p = pl(o), { size = 64, fam = 'PuHui-Black', col = p.fg, align = 'center', alpha = 1, scale = 1, maxW = 0, rot = 0, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
  if (o.outline !== false) { c.strokeStyle = o.outlineCol || p.outline; c.lineWidth = size * 0.17; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 酒红字牌：黑釉边＋酒红底＋刻线内框＋米白字。返回宽度。o { size, w, h, maxW, scale, alpha, rot, fill, padX }
D.plaque = (c, cx, cy, text, o = {}) => { const p = pl(o), { size = 64, scale = 1, alpha = 1, rot = 0, fill = p.red, padX = 0.7 } = o;
  c.save(); c.globalAlpha *= alpha; c.font = `${size}px "PuHui-Black"`;
  const w = o.w || Math.min(o.maxW || 9999, c.measureText(text).width + size * padX * 2), h = o.h || size * 1.7;
  c.translate(cx, cy); if (rot) c.rotate(rot); c.scale(scale, scale);
  c.fillStyle = p.sil; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 6); c.fill();
  c.fillStyle = fill; c.fillRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
  c.strokeStyle = C.inc; c.lineWidth = 2.4; c.strokeRect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30);
  c.font = `${size}px "PuHui-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = p.white;
  const tw = c.measureText(text).width, mw = w - 40; if (tw > mw) c.scale(mw / tw, mw / tw);
  c.fillText(text, 0, size * 0.06); c.restore(); return w; };
// 弹出文字（backOut 过冲）：o.plate 为 true 用酒红字牌，否则描边字
D.popText = (c, s, x, y, lt, at, o = {}) => { const k = D.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha ?? 1);
  if (o.plate) D.plaque(c, x, y, s, { ...o, scale: k * (o.scale || 1), alpha: a }); else D.text(c, s, x, y, { size: 96, ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：黑釉线先画出来（圆头），末端酒红字牌逐字打出（约 20 字/秒）
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p = pl(o), size = o.size || 56; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = p.sil; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.strokeStyle = p.line; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = p.sil; c.beginPath(); c.arc(ax, ay, 12 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Black"`; const w = o.w || Math.min(o.maxW || 900, c.measureText(s).width + size * 1.4); c.restore();
  D.plaque(c, bx, by, shown || ' ', { ...o, size, w, scale: q }); };

// ---------- 人物剪影（侧面，无五官；脚底中心为 (x,y)，h = 身高） ----------
// o { pose:'stand'|'walk'|'point'|'raise'|'hold'|'sit', dir:1|-1, t, speed, phase, long:长袍, head:'hair'|'band'|'hat'|'bald', beard, band:false 去掉酒红下摆带, sash:false 去掉斜肩带, inv, alpha }
function strokePts(c, pts, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }
D.person = (c, x, y, h, o = {}) => {
  const p = pl(o), s = h / 200, dir = o.dir || 1, pose = o.pose || 'stand', ph = (o.t || 0) * (o.speed || 6) + (o.phase || 0), a = Math.sin(ph);
  const long = !!o.long, hem = long ? -12 : -52, seat = pose === 'sit', lw = Math.max(2.4, 1.5 / s);
  c.save(); c.translate(x, y); c.scale(dir * s, s); c.globalAlpha *= o.alpha ?? 1;
  const S = [2, -150];
  let nE, nH, fE, fH;
  if (pose === 'walk') { nE = [8 * a + 4, -122]; nH = [20 * a + 6, -100 - 4 * Math.abs(a)]; fE = [-8 * a + 2, -122]; fH = [-20 * a, -100]; }
  else if (pose === 'point') { nE = [28, -148]; nH = [58, -152]; fE = [-4, -124]; fH = [-6, -100]; }
  else if (pose === 'raise') { nE = [16, -178]; nH = [22, -208]; fE = [-4, -124]; fH = [-6, -100]; }
  else if (pose === 'hold') { nE = [14, -126]; nH = [32, -134]; fE = [4, -124]; fH = [24, -132]; }
  else { nE = [6, -122]; nH = [10, -98]; fE = [-6, -124]; fH = [-8, -100]; }
  const hipY = seat ? -40 : -58;
  const leg = (near) => { const sgn = near ? 1 : -1, f = pose === 'walk' ? a * sgn : sgn * 0.22, ft = [f * 22, -Math.max(0, -f) * 9], kn = [ft[0] * 0.5 + 3, hipY * 0.5 - 4];
    if (seat) { const fx = near ? 38 : 28; strokePts(c, [[0, hipY], [fx, hipY + 2], [fx - 2, -4]], 11, p.sil); c.fillStyle = p.sil; c.fillRect(fx - 4, -5, 17, 5); if (near) { c.fillRect(-22, hipY + 2, 44, 7); c.fillRect(-18, hipY + 8, 7, 40 + hipY * 0 - 8); c.fillRect(11, hipY + 8, 7, 40 + hipY * 0 - 8); } return; }
    if (near) strokePts(c, [[0, hipY], kn, ft], 14, p.line);
    strokePts(c, [[0, hipY], kn, ft], 11, p.sil);
    c.fillStyle = p.sil; c.beginPath(); c.ellipse(ft[0] + 5, ft[1] - 2, 11, 4.5, 0, 0, TAU); c.fill(); };
  const arm = (E, Hh, near) => { if (near) strokePts(c, [S, E, Hh], 12.5, p.line); strokePts(c, [S, E, Hh], 9, p.sil); c.fillStyle = p.sil; c.beginPath(); c.arc(Hh[0], Hh[1], 5.6, 0, TAU); c.fill(); };
  arm(fE, fH, false); leg(false);
  // 躯干＋袍（hem 之下为裙摆）
  const tb = hem + 4, fl = long ? 26 : 22;
  const torso = new Path2D(); torso.moveTo(-12, -158); torso.lineTo(4, -161); torso.lineTo(15, -151); torso.lineTo(15, -128); torso.quadraticCurveTo(12, -108, 11, -96); torso.lineTo(fl, tb); torso.lineTo(-fl - 2, tb); torso.lineTo(-10, -96); torso.quadraticCurveTo(-14, -126, -14, -140); torso.closePath();
  c.fillStyle = p.sil; c.fill(torso); c.lineJoin = 'round'; c.strokeStyle = p.sil; c.lineWidth = 3; c.stroke(torso);
  c.save(); c.clip(torso);
  if (o.sash !== false) { c.fillStyle = p.red; c.beginPath(); c.moveTo(-16, -152); c.lineTo(-3, -162); c.lineTo(20, -100); c.lineTo(5, -90); c.closePath(); c.fill(); D.dotRow(c, -8, -146, 11, -98, 12, 2.2, o); }
  if (o.band !== false) { c.fillStyle = p.red; c.fillRect(-34, tb - 11, 70, 11); D.dotRow(c, -fl, tb - 5.5, fl, tb - 5.5, 9, 2, o); }
  c.strokeStyle = p.line; c.lineWidth = lw; c.lineCap = 'round';
  for (const [x0, k] of [[-4, -2], [3, 3], [-9, -6]]) { c.beginPath(); c.moveTo(x0, -92); c.quadraticCurveTo(x0 + k, (tb - 92) / 2 - 10, x0 + k * 1.8, tb - 14); c.stroke(); }
  c.beginPath(); c.moveTo(-12, -140); c.quadraticCurveTo(0, -132, 14, -138); c.stroke();
  c.restore();
  leg(true);
  // 头颈
  strokePts(c, [[2, -158], [3, -171]], 10, p.sil);
  c.fillStyle = p.sil; c.beginPath(); c.arc(0, -181, 13, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(6, -192); c.lineTo(14, -187); c.lineTo(21, -178); c.lineTo(13.5, -176); c.lineTo(15, -172); c.lineTo(12, -166); c.lineTo(2, -166); c.closePath(); c.fill();
  if (o.beard) { c.beginPath(); c.moveTo(10, -170); c.lineTo(19, -166); c.lineTo(12, -158); c.lineTo(5, -164); c.closePath(); c.fill(); }
  const hd = o.head || 'hair'; c.strokeStyle = p.line; c.lineWidth = lw; c.lineCap = 'round';
  if (hd !== 'bald') { c.beginPath(); c.arc(-1, -182, 10, Math.PI * 0.6, Math.PI * 1.4); c.stroke(); }
  c.beginPath(); c.arc(3, -179, 3, 0, TAU); c.stroke();
  if (hd === 'band') { c.strokeStyle = p.red; c.lineWidth = 5; c.beginPath(); c.arc(0, -181, 13.5, Math.PI * 1.08, Math.PI * 1.72); c.stroke(); }
  if (hd === 'hat') { c.fillStyle = p.sil; c.beginPath(); c.ellipse(4, -192, 22, 4.5, -0.08, 0, TAU); c.fill(); c.beginPath(); c.arc(2, -193, 11, Math.PI, 0); c.fill(); c.fillStyle = p.red; c.fillRect(-9, -196, 22, 4); }
  arm(nE, nH, true);
  if (pose === 'point') { c.strokeStyle = p.sil; c.lineWidth = 4.2; c.beginPath(); c.moveTo(nH[0], nH[1]); c.lineTo(nH[0] + 12, nH[1] - 1); c.stroke(); }
  if (pose === 'hold') { c.fillStyle = p.red; c.fillRect(24, -146, 24, 17); c.strokeStyle = p.white; c.lineWidth = 2; c.strokeRect(27, -143, 18, 11); }
  c.restore();
};
// 人群／饰带：一排行走的剪影，下方一条黑釉地线＋酒红带＋白点。o { n, t, seed, poses:['walk',…], dir, speed, ground:false 不画地线, inv }
D.frieze = (c, x0, x1, y, h, o = {}) => {
  const p = pl(o), n = o.n || 6, r = U.rng(o.seed || 7), dir = o.dir || 1, poses = o.poses || ['walk'], span = (x1 - x0) / n;
  const items = []; for (let i = 0; i < n; i++) items.push({ k: 0.88 + r() * 0.22, ph: r() * TAU, long: r() < 0.3, head: ['hair', 'band', 'hat', 'hair'][(r() * 4) | 0], beard: r() < 0.35, pose: poses[(r() * poses.length) | 0] });
  items.forEach((it, i) => D.person(c, x0 + span * (i + 0.5), y, h * it.k, { ...o, pose: it.pose, long: it.long, head: it.head, beard: it.beard, dir, phase: it.ph, speed: o.speed || 5 }));
  if (o.ground !== false) { c.fillStyle = p.sil; c.fillRect(x0 - 10, y, x1 - x0 + 20, 12); c.fillStyle = p.red; c.fillRect(x0 - 10, y + 3, x1 - x0 + 20, 4); D.dotRow(c, x0, y + 5, x1, y + 5, 22, 1.6, o); }
};

// ---------- 火箭（Starship 黑剪影＋三道酒红白点带） ----------
// (x,y) = 所画部分的中心；scale 缩放；rot 弧度（0=车头朝上）；flame 0..1+（0 不喷）；legs 着陆腿展开 0..1（undefined 不画）；o.part 'full'|'ship'|'booster'；o.t 火焰抖动
D.rocket = (c, x, y, scale = 1, rot = 0, flame = 0, legs, o = {}) => {
  const p = pl(o), t = o.t || 0, hw = 86, part = o.part || 'full', ship = part !== 'booster', boost = part !== 'ship', yb = boost ? 926 : 340, piv = part === 'ship' ? 170 : part === 'booster' ? 631 : 463;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.translate(0, -piv); c.globalAlpha *= o.alpha ?? 1;
  const band = (yy, hh) => { c.fillStyle = p.red; c.fillRect(-hw, yy, hw * 2, hh); D.dotRow(c, -hw + 14, yy + hh / 2, hw - 14, yy + hh / 2, 21, 4.4, o); };
  c.fillStyle = p.sil;
  for (const sx of [-1, 1]) {
    if (boost) { c.beginPath(); c.moveTo(sx * hw - sx * 4, 372); c.lineTo(sx * 146, 378); c.lineTo(sx * 146, 440); c.lineTo(sx * hw - sx * 4, 436); c.closePath(); c.fill();
      c.strokeStyle = p.line; c.lineWidth = 3.2; for (let i = 1; i <= 3; i++) { const xx = sx * (hw + 14 * i); c.beginPath(); c.moveTo(xx, 384 + i * 2); c.lineTo(xx, 432 - i); c.stroke(); } }
    if (ship) {
      c.beginPath(); c.moveTo(sx * hw - sx * 2, 150); c.lineTo(sx * 128, 178); c.lineTo(sx * 122, 232); c.lineTo(sx * hw - sx * 2, 232); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(sx * hw - sx * 2, 262); c.lineTo(sx * 150, 330); c.lineTo(sx * 150, 338); c.lineTo(sx * hw - sx * 2, 338); c.closePath(); c.fill();
      c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.moveTo(sx * 112, 186); c.lineTo(sx * 106, 226); c.stroke(); c.beginPath(); c.moveTo(sx * 118, 296); c.lineTo(sx * 118, 330); c.stroke();
    }
  }
  if (ship) { c.beginPath(); c.moveTo(-hw, 338); c.lineTo(-hw, 150); c.bezierCurveTo(-hw, 70, -34, 14, 0, 0); c.bezierCurveTo(34, 14, hw, 70, hw, 150); c.lineTo(hw, 338); c.closePath(); c.fill(); }
  if (boost) { c.fillRect(-hw, ship ? 336 : 340, hw * 2, ship ? 560 : 556);
    c.beginPath(); c.moveTo(-hw, 892); c.lineTo(-hw - 8, 926); c.lineTo(hw + 8, 926); c.lineTo(hw, 892); c.closePath(); c.fill(); }
  else { c.beginPath(); c.moveTo(-hw, 332); c.lineTo(-hw - 6, 352); c.lineTo(hw + 6, 352); c.lineTo(hw, 332); c.closePath(); c.fill(); }
  if (ship) { band(168, 26); band(boost ? 318 : 292, boost ? 40 : 34); }
  if (boost) { band(820, 44); if (!ship) band(352, 40); }
  c.strokeStyle = p.line; c.lineWidth = 3.4; c.lineCap = 'round';
  if (ship) { c.beginPath(); c.moveTo(-60, 70); c.quadraticCurveTo(-66, 120, -66, 160); c.stroke(); for (const xx of [-52, 52]) { c.beginPath(); c.moveTo(xx, 214); c.lineTo(xx, boost ? 304 : 282); c.stroke(); }
    for (let yy = 224; yy < (boost ? 300 : 280); yy += 38) { c.beginPath(); c.moveTo(-28, yy); c.lineTo(28, yy); c.stroke(); }
    c.fillStyle = p.white; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-24 + i * 24, 92 + (i === 1 ? -4 : 0), 5.5, 0, TAU); c.fill(); } }
  if (boost) { for (const xx of [-52, 52]) { c.beginPath(); c.moveTo(xx, 400); c.lineTo(xx, 800); c.stroke(); } for (let yy = 440; yy < 800; yy += 60) { c.beginPath(); c.moveTo(-30, yy); c.lineTo(30, yy); c.stroke(); } }
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 24, yb - 26); c.lineTo(i * 28, yb - 4); c.stroke(); }
  // 着陆腿
  if (legs !== undefined && legs !== null) { const g = clamp(legs), top = yb - 120;
    for (const sx of [-1, 1]) { const ex = sx * (hw + 6 + 112 * g), ey = yb - 6 + 34 * g, sx0 = sx * (hw - 4);
      strokePts(c, [[sx0, top], [ex, ey]], 15, p.sil); strokePts(c, [[sx0, top + 6], [sx * (hw - 18), yb - 14]], 9, p.sil);
      c.strokeStyle = p.line; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx0, top + 10); c.lineTo(lerp(sx0, ex, 0.92), lerp(top, ey, 0.92)); c.stroke();
      c.fillStyle = p.sil; c.fillRect(ex - 18, ey - 2, 36, 9); } }
  // 火焰：剪影色＋酒红舌，刻线，白点
  if (flame > 0) { c.save(); c.translate(0, yb); const k0 = boost ? 1 : 0.6;
    [[-56, 0.8], [-28, 1.1], [0, 1.45], [28, 1.1], [56, 0.8]].forEach(([fx, k], i) => { fx *= k0; const L = (96 * k * k0 + 14 * Math.sin(t * 13 + i * 2)) * flame, w = 26 * k0;
      c.fillStyle = i % 2 ? p.red : p.sil; c.beginPath(); c.moveTo(fx - w, 0);
      c.bezierCurveTo(fx - w - 8, L * 0.4, fx + 12 * Math.sin(t * 9 + i), L * 0.75, fx + 6 * Math.sin(t * 11 + i), L);
      c.bezierCurveTo(fx + w + 8, L * 0.6, fx + w + 4, L * 0.3, fx + w, 0); c.closePath(); c.fill();
      c.strokeStyle = i % 2 ? p.white : p.line; c.lineWidth = 3; c.beginPath(); c.moveTo(fx, 10); c.quadraticCurveTo(fx + 4, L * 0.4, fx + 2 * Math.sin(t * 11 + i), L * 0.7); c.stroke();
      if (i % 2) D.dotRow(c, fx, 22, fx + 2, L * 0.6, 22, 3.2, o); });
    c.restore(); }
  c.restore();
};
// 发射塔：黑格构＋X 撑＋酒红顶帽＋接箭臂（筷子）。(x, yTop) = 塔左上，yBot = 地面。o { w, dir:1 臂朝右|-1 朝左, arm 臂伸出 0..1, open 钳口张开 0..1, armY, armLen, inv }
D.tower = (c, x, yTop, yBot, o = {}) => {
  const p = pl(o), w = o.w || 120, dir = o.dir || 1, arm = o.arm ?? 1, open = o.open ?? 1, armY = o.armY ?? lerp(yTop, yBot, 0.32), armLen = (o.armLen ?? 215) * arm;
  c.save(); if (dir < 0) { c.translate(x + w / 2, 0); c.scale(-1, 1); c.translate(-(x + w / 2), 0); } c.globalAlpha *= o.alpha ?? 1;
  c.fillStyle = p.sil; c.fillRect(x, yTop, 20, yBot - yTop); c.fillRect(x + w - 20, yTop, 20, yBot - yTop);
  c.strokeStyle = p.sil; c.lineWidth = 11; const n = Math.max(2, Math.round((yBot - yTop) / 100));
  for (let i = 0; i < n; i++) { const y0 = yTop + i * (yBot - yTop) / n, y1 = yTop + (i + 1) * (yBot - yTop) / n;
    c.beginPath(); c.moveTo(x + 10, y0); c.lineTo(x + w - 10, y1); c.moveTo(x + w - 10, y0); c.lineTo(x + 10, y1); c.stroke(); c.fillRect(x, y1 - 7, w, 12); }
  c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 10, yTop + 24); c.lineTo(x + 10, yBot - 20); c.moveTo(x + w - 10, yTop + 24); c.lineTo(x + w - 10, yBot - 20); c.stroke();
  c.fillStyle = p.red; c.fillRect(x - 8, yTop - 26, w + 16, 34); D.dotRow(c, x + 6, yTop - 9, x + w - 6, yTop - 9, 20, 4.2, o);
  if (armLen > 2) for (const sgn of [-1, 1]) { const dy = sgn * (10 + 26 * open), ex = x + w + armLen;
    c.fillStyle = p.sil; c.beginPath(); c.moveTo(x + w - 6, armY + dy - 18); c.lineTo(ex, armY + dy - 14 + sgn * 4 * (1 - open)); c.lineTo(ex + 16, armY + dy + 2); c.lineTo(ex, armY + dy + 14 + sgn * 4 * (1 - open)); c.lineTo(x + w - 6, armY + dy + 18); c.closePath(); c.fill();
    c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w + 10, armY + dy); c.lineTo(ex - 10, armY + dy); c.stroke();
    c.fillStyle = p.red; c.fillRect(x + w + armLen * 0.4, armY + dy - 14, 40, 28); }
  c.restore();
};
// 卫星：方箱＋两翼太阳板（刻线分格）＋酒红带＋小天线。(x,y) 中心，s 缩放，rot 旋转
D.sat = (c, x, y, s = 1, rot = 0, o = {}) => { const p = pl(o);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = p.sil;
  for (const sx of [-1, 1]) { c.fillRect(sx > 0 ? 40 : -150, -30, 110, 60); c.fillRect(sx * 34 - 3, -4, 6, 8);
    c.strokeStyle = p.line; c.lineWidth = 2.4; c.beginPath(); for (let i = 1; i < 4; i++) { const xx = (sx > 0 ? 40 : -150) + i * 27.5; c.moveTo(xx, -26); c.lineTo(xx, 26); } c.moveTo(sx > 0 ? 44 : -146, 0); c.lineTo(sx > 0 ? 146 : -44, 0); c.stroke(); }
  c.fillStyle = p.sil; c.fillRect(-40, -34, 80, 68); c.fillStyle = p.red; c.fillRect(-40, -6, 80, 16); D.dotRow(c, -32, 2, 32, 2, 14, 3, o);
  c.strokeStyle = p.line; c.lineWidth = 2.4; c.strokeRect(-33, -28, 66, 56);
  c.strokeStyle = p.sil; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -34); c.lineTo(0, -62); c.stroke(); c.fillStyle = p.sil; c.beginPath(); c.arc(0, -66, 9, Math.PI, 0); c.fill();
  c.beginPath(); c.moveTo(-10, 34); c.lineTo(10, 34); c.lineTo(6, 52); c.lineTo(-6, 52); c.closePath(); c.fill(); c.restore(); };
// 地球／太阳／月盘：kind 'sun'|'earth'|'moon'|'plain'；o.t 转动，o.seed 大陆形状
D.disc = (c, x, y, r, kind = 'sun', o = {}) => { const p = pl(o), t = o.t || 0;
  c.save(); c.translate(x, y); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = p.sil;
  if (kind === 'sun') { for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + t * 0.12; c.beginPath(); c.moveTo(Math.cos(a - 0.1) * r, Math.sin(a - 0.1) * r); c.lineTo(Math.cos(a) * (r * 1.65), Math.sin(a) * (r * 1.65)); c.lineTo(Math.cos(a + 0.1) * r, Math.sin(a + 0.1) * r); c.fill(); } }
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  if (kind === 'sun') { c.fillStyle = p.red; c.beginPath(); c.arc(0, 0, r * 0.65, 0, TAU); c.fill(); c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 0.92, 0, TAU); c.stroke(); D.dots(c, Array.from({ length: 8 }, (_, i) => [Math.cos(i * TAU / 8) * r * 0.42, Math.sin(i * TAU / 8) * r * 0.42]), Math.max(2.4, r * 0.065), o); }
  else if (kind === 'earth') { c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip(); const rr = U.rng(o.seed || 11);
    for (let k = 0; k < 4; k++) { const cx = (rr() - 0.5) * r * 1.4 + ((t * 8 + k * 97) % (r * 3)) - r * 1.5, cy = (rr() - 0.5) * r * 1.1, R = r * (0.22 + rr() * 0.2), pts = [], m = 9;
      for (let i = 0; i < m; i++) { const a = i * TAU / m, q = R * (0.7 + rr() * 0.5); pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.8]); }
      c.fillStyle = p.red; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); c.strokeStyle = p.line; c.lineWidth = 2.6; c.stroke();
      D.dots(c, pts.filter((_, i) => i % 3 === 0).map(q => [q[0] * 0.8 + cx * 0.2, q[1] * 0.8 + cy * 0.2]), Math.max(2, r * 0.03), o); }
    c.strokeStyle = p.line; c.lineWidth = 2; for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(0, 0, r, Math.abs(k) * r * 0.9 + 0.001, 0, 0, TAU); c.stroke(); } c.restore();
    c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 0.94, 0, TAU); c.stroke(); }
  else if (kind === 'moon') { c.strokeStyle = p.line; c.lineWidth = 3; const rr = U.rng(o.seed || 23); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc((rr() - 0.5) * r, (rr() - 0.5) * r, r * (0.1 + rr() * 0.12), 0, TAU); c.stroke(); } c.beginPath(); c.arc(0, 0, r * 0.92, 0, TAU); c.stroke(); }
  else { c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 0.9, 0, TAU); c.stroke(); }
  c.restore(); };

// ---------- 数据图示 ----------
// 陶罐轮廓（归一化：u 高度 0..1 自下而上，r 半宽比）
const JAR = [[0, 0.40], [0.05, 0.46], [0.09, 0.34], [0.22, 0.78], [0.38, 1.0], [0.58, 0.92], [0.72, 0.62], [0.80, 0.36], [0.90, 0.33], [0.96, 0.46], [1, 0.50]];
function jarPath(w, h) { const pa = new Path2D(), n = JAR.length;
  const R = JAR.map(([u, r]) => [r * w / 2, -u * h]), L = JAR.map(([u, r]) => [-r * w / 2, -u * h]).reverse();
  pa.moveTo(R[0][0], R[0][1]); for (let i = 1; i < n - 1; i++) { const mx = (R[i][0] + R[i + 1][0]) / 2, my = (R[i][1] + R[i + 1][1]) / 2; pa.quadraticCurveTo(R[i][0], R[i][1], mx, my); }
  pa.lineTo(R[n - 1][0], R[n - 1][1]); pa.lineTo(L[0][0], L[0][1]);
  for (let i = 1; i < n - 1; i++) { const mx = (L[i][0] + L[i + 1][0]) / 2, my = (L[i][1] + L[i + 1][1]) / 2; pa.quadraticCurveTo(L[i][0], L[i][1], mx, my); }
  pa.lineTo(L[n - 1][0], L[n - 1][1]); pa.closePath(); return pa; }
// 陶罐柱：(x, yBase) 底中心，w 罐宽，h = value 1 对应的高度；value 0..1 画实心罐；o.target（默认 1）> value 时以虚线画出「应有高度」；o.red 罐身用酒红；o.num 罐顶数字
D.jar = (c, x, yBase, w, h, value, o = {}) => { const p = pl(o), v = clamp(value), tg = o.target ?? 1, hv = Math.max(0.001, h * v);
  c.save(); c.translate(x, yBase); c.globalAlpha *= o.alpha ?? 1;
  if (tg > v + 0.02 && o.ghost !== false) { c.save(); c.setLineDash([14, 11]); c.strokeStyle = p.sil; c.lineWidth = 4.5; c.lineJoin = 'round'; c.stroke(jarPath(w, h * tg)); c.restore(); }
  if (v > 0.004) { const pa = jarPath(w, hv); c.fillStyle = o.red ? p.red : p.sil; c.fill(pa);
    const hy0 = -hv * 0.84, hy1 = -hv * 0.66, hr = w * 0.35;
    c.strokeStyle = o.red ? p.red : p.sil; c.lineWidth = Math.max(5, w * 0.06); c.lineCap = 'round';
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * w * 0.18, hy0); c.bezierCurveTo(sg * hr * 1.7, hy0 - hv * 0.04, sg * hr * 1.8, hy1 + hv * 0.04, sg * w * 0.34, hy1 + hv * 0.02); c.stroke(); }
    c.save(); c.clip(pa);
    if (!o.red) { c.fillStyle = p.red; c.fillRect(-w, -hv * 0.66, w * 2, hv * 0.12); D.dotRow(c, -w * 0.5, -hv * 0.6, w * 0.5, -hv * 0.6, Math.max(12, w * 0.1), Math.max(2.2, w * 0.022), o); }
    c.strokeStyle = o.red ? p.white : p.line; c.lineWidth = 2.6; for (const u of [0.14, 0.3, 0.46]) { c.beginPath(); c.moveTo(-w, -hv * u); c.lineTo(w, -hv * u); c.stroke(); }
    c.beginPath(); c.moveTo(-w * 0.34, -hv * 0.74); c.lineTo(-w * 0.28, -hv * 0.2); c.stroke(); c.restore(); }
  if (o.num) D.text(c, o.num, 0, -hv - 54, { size: o.numSize || 60, maxW: w * 1.8, inv: o.inv });
  c.restore(); };
// 陶罐柱图：items [{v, label, num, target, red}]；v 已是 0..1，或设 o.max 让 v 除以 max。区间 x0..x1，罐底线 yBase，满高 h。lt/at 为出场进度（各罐 stagger 先后长高）
D.bars = (c, x0, x1, yBase, h, items, lt = 99, at = 0, o = {}) => { const p = pl(o), n = items.length, span = (x1 - x0) / n, jw = o.jarW || Math.min(span * 0.8, 210), mx = o.max || 1;
  c.fillStyle = p.sil; c.fillRect(x0 - 12, yBase, x1 - x0 + 24, 12); c.fillStyle = p.red; c.fillRect(x0 - 12, yBase + 3, x1 - x0 + 24, 4); D.dotRow(c, x0, yBase + 5, x1, yBase + 5, 22, 1.6, o);
  items.forEach((it, i) => { const q = MO.cubicOut(D.at(lt, at + i * (o.stagger ?? 0.14), o.dur || 0.8)), cx = x0 + span * (i + 0.5);
    D.jar(c, cx, yBase, jw, h, (it.v / mx) * q, { inv: o.inv, red: it.red, target: it.target !== undefined ? it.target / mx : (o.target ?? 1), ghost: q > 0.02 && o.ghost !== false, num: q > 0.7 ? it.num : null, alpha: clamp(q * 6 + 0.001) });
    if (it.label) D.text(c, it.label, cx, yBase + 56, { size: o.labelSize || 56, maxW: span * 0.96, inv: o.inv, alpha: clamp(q * 3) }); }); };
// 分段圆盘：parts [{v, label, fill, hi}]；r 半径；lt/at 扫出进度；o { start, ring:false 去外圈, pct:false 不写百分比, labelSize, labelMaxW }
D.pie = (c, cx, cy, r, parts, lt = 99, at = 0, o = {}) => { const p = pl(o), tot = parts.reduce((s, q) => s + q.v, 0) || 1, sweep = MO.cubicOut(D.at(lt, at, o.dur || 1.0)), start = o.start ?? -Math.PI / 2;
  const fills = o.inv ? [C.clay, C.red, C.pale, '#8a4a22'] : [C.black, C.red, C.pale, C.clayD];
  c.save(); c.translate(cx, cy); c.globalAlpha *= o.alpha ?? 1; let a0 = start; const lim = start + sweep * TAU;
  parts.forEach((q, i) => { const da = q.v / tot * TAU, a1 = Math.min(a0 + da, lim); if (a1 <= a0) { a0 += da; return; }
    const mid = (a0 + a1) / 2, ex = q.hi ? 22 : 0, ox = Math.cos(mid) * ex, oy = Math.sin(mid) * ex, fill = q.fill || fills[i % fills.length];
    c.fillStyle = fill; c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, r, a0, a1); c.closePath(); c.fill();
    c.strokeStyle = p.bg; c.lineWidth = 7; c.lineJoin = 'round'; c.stroke();
    c.save(); c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, r, a0, a1); c.closePath(); c.clip(); c.strokeStyle = fill === C.pale ? C.clayD : (fill === C.black ? C.inc : C.white); c.globalAlpha *= 0.8; c.lineWidth = 2.4;
    c.beginPath(); c.arc(ox, oy, r * 0.86, a0, a1); c.stroke(); c.restore();
    const lab = (a1 - a0 >= da - 1e-6) && sweep > 0.98;
    if (lab && o.pct !== false && da / TAU > 0.07) D.text(c, Math.round(q.v / tot * 100) + '%', ox + Math.cos(mid) * r * 0.58, oy + Math.sin(mid) * r * 0.58, { size: 56, col: fill === C.pale ? C.black : C.white, outlineCol: fill === C.pale ? C.pale : fill, maxW: r * 0.7, inv: o.inv });
    if (lab && q.label) D.text(c, q.label, ox + Math.cos(mid) * (r + 40), oy + Math.sin(mid) * (r + 40) + (Math.sin(mid) > 0.3 ? 28 : Math.sin(mid) < -0.3 ? -28 : 0), { size: o.labelSize || 56, align: Math.cos(mid) > 0.25 ? 'left' : Math.cos(mid) < -0.25 ? 'right' : 'center', maxW: o.labelMaxW || 330, inv: o.inv });
    a0 += da; });
  if (o.ring !== false) { c.strokeStyle = p.sil; c.lineWidth = 12; c.beginPath(); c.arc(0, 0, r + 14, 0, TAU); c.stroke(); c.strokeStyle = p.line; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, r + 14, 0, TAU); c.stroke();
    D.dots(c, Array.from({ length: 36 }, (_, i) => [Math.cos(i * TAU / 36) * (r + 14), Math.sin(i * TAU / 36) * (r + 14)]), 2.6, o); }
  c.fillStyle = p.sil; c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); c.fill(); c.fillStyle = p.red; c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU); c.fill(); c.strokeStyle = p.line; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, r * 0.17, 0, TAU); c.stroke();
  c.restore(); };
// 天平：(cx, yBase) 立柱底中心，w 横梁全长，tilt -1..1（正 = 右盘下沉）。o { h 立柱高, left(c,x,y,pan), right(c,x,y,pan) 往盘里放东西的回调, inv }
// 返回 { l:[x,y], r:[x,y] } 两个盘沿中心点
D.scales = (c, cx, yBase, w, tilt = 0, o = {}) => { const p = pl(o), H0 = o.h || 520, py = yBase - H0, ang = clamp(tilt, -1, 1) * 0.26, dr = 190, pw = w * 0.34;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = p.sil;
  c.beginPath(); c.moveTo(cx - 90, yBase); c.lineTo(cx + 90, yBase); c.lineTo(cx + 60, yBase - 36); c.lineTo(cx - 60, yBase - 36); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx - 12, yBase - 36); c.lineTo(cx + 12, yBase - 36); c.lineTo(cx + 7, py); c.lineTo(cx - 7, py); c.closePath(); c.fill();
  c.fillStyle = p.red; c.fillRect(cx - 62, yBase - 26, 124, 12); D.dotRow(c, cx - 50, yBase - 20, cx + 50, yBase - 20, 16, 2.6, o);
  c.strokeStyle = p.line; c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx, yBase - 50); c.lineTo(cx, py + 20); c.stroke();
  const L = w / 2, e = [[cx - Math.cos(ang) * L, py - Math.sin(ang) * L], [cx + Math.cos(ang) * L, py + Math.sin(ang) * L]];
  c.save(); c.translate(cx, py); c.rotate(ang); c.fillStyle = p.sil; c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(0, -26, L, 0); c.quadraticCurveTo(0, 14, -L, 0); c.fill();
  c.fillStyle = p.red; c.fillRect(-L * 0.45, -9, L * 0.9, 12); D.dotRow(c, -L * 0.4, -3, L * 0.4, -3, 18, 2.6, o); c.restore();
  c.fillStyle = p.sil; c.beginPath(); c.arc(cx, py, 18, 0, TAU); c.fill(); c.fillStyle = p.red; c.beginPath(); c.arc(cx, py, 9, 0, TAU); c.fill();
  const pans = e.map(q => [q[0], q[1] + dr]);
  e.forEach((q, i) => { const pan = pans[i];
    c.strokeStyle = p.sil; c.lineWidth = 4.5; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(pan[0] - pw / 2, pan[1]); c.moveTo(q[0], q[1]); c.lineTo(pan[0] + pw / 2, pan[1]); c.stroke();
    c.strokeStyle = p.line; c.lineWidth = 1.8; c.beginPath(); c.moveTo(q[0], q[1] + 4); c.lineTo(pan[0], pan[1] - 4); c.stroke();
    c.fillStyle = p.sil; c.beginPath(); c.moveTo(pan[0] - pw / 2 - 10, pan[1]); c.lineTo(pan[0] + pw / 2 + 10, pan[1]); c.quadraticCurveTo(pan[0] + pw / 2, pan[1] + 46, pan[0], pan[1] + 50); c.quadraticCurveTo(pan[0] - pw / 2, pan[1] + 46, pan[0] - pw / 2 - 10, pan[1]); c.closePath(); c.fill();
    c.fillStyle = p.red; c.fillRect(pan[0] - pw / 2 - 12, pan[1] - 6, pw + 24, 11); D.dotRow(c, pan[0] - pw / 2, pan[1] - 0.5, pan[0] + pw / 2, pan[1] - 0.5, 16, 2.2, o);
    const f = i ? o.right : o.left; if (f) f(c, pan[0], pan[1] - 6, pan); });
  c.restore(); return { l: pans[0], r: pans[1] }; };
// 币堆：(x, yBase) 堆底中心，n 枚；o { rx, ry, th 每枚厚, ghostN 额外用虚线画出「应有」的几枚, inv }
D.coins = (c, x, yBase, n, o = {}) => { const p = pl(o), rx = o.rx || 70, ry = o.ry || rx * 0.28, th = o.th || 15, cnt = Math.max(0, Math.round(n));
  c.save(); c.globalAlpha *= o.alpha ?? 1;
  for (let i = 0; i < cnt; i++) { const yy = yBase - i * th;
    c.fillStyle = p.sil; c.fillRect(x - rx, yy - th, rx * 2, th); c.beginPath(); c.ellipse(x, yy, rx, ry, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x, yy - th, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = p.line; c.lineWidth = 2.4; c.beginPath(); c.ellipse(x, yy, rx - 1, ry - 1, 0, 0.05, Math.PI - 0.05); c.stroke(); }
  if (cnt > 0) { const ty = yBase - (cnt - 1) * th - th; c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.ellipse(x, ty, rx - 12, ry - 5, 0, 0, TAU); c.stroke(); c.fillStyle = p.red; c.beginPath(); c.ellipse(x, ty, rx * 0.28, ry * 0.4, 0, 0, TAU); c.fill(); }
  for (let i = 0; i < (o.ghostN || 0); i++) { const yy = yBase - (cnt + i) * th - th; c.save(); c.setLineDash([12, 9]); c.strokeStyle = p.sil; c.lineWidth = 4; c.beginPath(); c.ellipse(x, yy, rx, ry, 0, 0, TAU); c.stroke(); c.restore(); }
  c.restore(); };
// 粗箭头：(x0,y0)→(x1,y1)。o { w 杆宽, k 画出进度 0..1, red, inv }
D.arrow = (c, x0, y0, x1, y1, o = {}) => { const p = pl(o), k = o.k ?? 1, w = o.w || 34, L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), hl = Math.min(L * 0.5, w * 2.1), len = L * clamp(k);
  if (len < 2) return; c.save(); c.translate(x0, y0); c.rotate(a); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = o.red ? p.red : p.sil;
  const sl = Math.max(0, len - hl); c.fillRect(0, -w / 2, sl + 1, w);
  if (len > hl * 0.5) { const hh = w * 1.15 * Math.min(1, len / hl); c.beginPath(); c.moveTo(sl, -hh); c.lineTo(len, 0); c.lineTo(sl, hh); c.closePath(); c.fill(); }
  c.strokeStyle = o.red ? p.white : p.line; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 0); c.lineTo(Math.max(10, len - hl * 0.55), 0); c.stroke(); c.restore(); };
// 循环环（双箭头）：(cx,cy) 半径 r，rot 转角
D.loop = (c, cx, cy, r, rot = 0, o = {}) => { const p = pl(o); c.save(); c.translate(cx, cy); c.rotate(rot); c.globalAlpha *= o.alpha ?? 1; c.lineCap = 'butt';
  for (let k = 0; k < 2; k++) { const a0 = k * Math.PI + 0.25, a1 = a0 + 2.35;
    c.strokeStyle = p.sil; c.fillStyle = p.sil; c.lineWidth = 26; c.beginPath(); c.arc(0, 0, r, a0, a1); c.stroke();
    const tx = Math.cos(a1), ty = Math.sin(a1), nx = -ty, ny = tx, px = tx * r, py = ty * r;
    c.beginPath(); c.moveTo(px + tx * 46, py + ty * 46); c.lineTo(px + nx * 38 - tx * 4, py + ny * 38 - ty * 4); c.lineTo(px - nx * 38 - tx * 4, py - ny * 38 - ty * 4); c.closePath(); c.fill();
    c.strokeStyle = p.line; c.lineWidth = 3.2; c.beginPath(); c.arc(0, 0, r, a0 + 0.12, a1 - 0.12); c.stroke(); }
  c.restore(); };
// 数字大牌：酒红字牌放大数字。str 为文字，或 o.count {to, from, dec} 做数字滚动；o { unit 后缀, sub 牌下小字, size（默认 150）, w, inv }
D.bigNum = (c, str, x, y, lt = 99, at = 0, o = {}) => { const k = D.pop(lt, at, 0.55); if (k <= 0) return 0; const size = o.size || 150;
  let s = str; if (o.count) { const q = MO.cubicOut(D.at(lt, at + 0.1, o.count.dur || 1.0)), v = lerp(o.count.from || 0, o.count.to, q), d = o.count.dec || 0; s = v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  s += o.unit || ''; const w = D.plaque(c, x, y, s, { inv: o.inv, size, scale: k, alpha: clamp(k * 2), w: o.w, maxW: o.maxW || 960, padX: 0.5 });
  if (o.sub) D.text(c, o.sub, x, y + size * 0.85 + 50, { size: o.subSize || 60, alpha: clamp((k - 0.6) * 3), maxW: 900, inv: o.inv });
  return w; };
// 时间线：pts [{label, sub}] 沿 x0→x1（o.vertical 时沿 y），lt/at 逐点点亮；标签上下交错。o { dur, labelSize, cur 当前高亮下标, vertical, side, inv }
D.timeline = (c, x0, x1, y, pts, lt = 99, at = 0, o = {}) => { const p = pl(o), n = pts.length, k = D.at(lt, at, o.dur || Math.max(0.8, n * 0.35)), vert = !!o.vertical;
  const X = i => lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5), span = Math.abs(x1 - x0) / Math.max(1, n - 1);
  const pt = (u, v) => vert ? [y + v, u] : [u, y + v];
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.strokeStyle = p.sil; c.lineWidth = 14; c.lineCap = 'round';
  const a = pt(x0, 0), b = pt(lerp(x0, x1, k), 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  c.strokeStyle = p.line; c.lineWidth = 2.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  pts.forEach((q, i) => { const pp = D.pop(k * (n + 0.5) - i, 0, 0.5); if (pp <= 0) return; const [px, py] = pt(X(i), 0), cur = i === (o.cur ?? n - 1);
    c.save(); c.translate(px, py); c.scale(pp, pp); c.fillStyle = p.sil; c.beginPath(); c.arc(0, 0, cur ? 30 : 24, 0, TAU); c.fill(); c.fillStyle = cur ? p.red : p.white; c.beginPath(); c.arc(0, 0, cur ? 15 : 10, 0, TAU); c.fill(); c.strokeStyle = p.line; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, cur ? 24 : 18, 0, TAU); c.stroke(); c.restore();
    const side = i % 2 ? 1 : -1, [tx, ty] = vert ? [px + (o.side || 1) * 60, py] : [px, py + side * 78];
    if (q.label) D.text(c, q.label, tx, ty, { size: o.labelSize || 56, alpha: clamp(pp * 2), maxW: vert ? 560 : Math.max(200, span * 1.9), align: vert ? 'left' : 'center', inv: o.inv });
    if (q.sub) D.text(c, q.sub, tx, ty + (vert ? 58 : side * 62), { size: 56, alpha: clamp(pp * 2), maxW: vert ? 560 : Math.max(200, span * 1.9), align: vert ? 'left' : 'center', inv: o.inv, col: C.pale }); });
  c.restore(); };

// ---------- 章节卡 / 字幕 ----------
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
D.roman = n => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
// 按字数折行（优先在标点后断）：最多 3 行，每行约 max 字
D.wrap = (s, max = 9) => { const a = [...s]; if (a.length <= max) return [s]; const nl = Math.min(3, Math.ceil(a.length / max)), out = []; let i = 0;
  for (let k = 0; k < nl; k++) { if (k === nl - 1) { out.push(a.slice(i).join('')); break; } const tg = i + Math.ceil((a.length - i) / (nl - k)); let best = tg;
    for (let d = 0; d <= 3; d++) { if ('，、：；？！,:;'.includes(a[tg - 1 + d] || '')) { best = tg + d; break; } if ('，、：；？！,:;'.includes(a[tg - 1 - d] || '')) { best = tg - d; break; } }
    while (best < a.length && '」』）》”'.includes(a[best])) best++;
    out.push(a.slice(i, best).join('').replace(/^[，、：；]/, '')); i = best; }
  return out.filter(Boolean); };
// 章节卡（每章第一镜，配口播念章名那一句）：回纹边框、罗马编号圆盘砸入、章名逐字刻在黑釉板里；下方 N 站进度（N 按章数算），小人沿路走到本站
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const p = pl(o); D.bg(c, t, o);
  const sc = MO.slamK(clamp((lt - 0.08) / 0.17));
  c.save(); c.translate(W / 2, 520); c.scale(sc, sc); D.disc(c, 0, 0, 150, 'plain', { ...o, t });
  c.fillStyle = p.red; c.beginPath(); c.arc(0, 0, 124, 0, TAU); c.fill(); c.strokeStyle = p.line; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 138, 0, TAU); c.stroke();
  D.dots(c, Array.from({ length: 28 }, (_, i) => [Math.cos(i * TAU / 28) * 108, Math.sin(i * TAU / 28) * 108]), 3.4, o);
  c.restore();
  if (lt > 0.08) D.text(c, D.roman(n), W / 2, 524, { size: 128, scale: sc, maxW: 220, outlineCol: C.black, inv: o.inv });
  D.text(c, `第 ${n} 章`, W / 2, 730, { size: 60, alpha: clamp((lt - 0.2) / 0.25), inv: o.inv });
  const lines = D.wrap(title, 9), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 2 ? 78 : lines.length > 1 ? 88 : all > 6 ? 100 : 116;
  if (lt > 0.4) { const bw = 940, bh = lines.length * size * 1.22 + 70, by = 800, k2 = MO.slamK(clamp((lt - 0.4) / 0.17));
    c.save(); c.translate(W / 2, by + bh / 2); c.scale(k2, k2); c.translate(-W / 2, -(by + bh / 2));
    c.fillStyle = p.sil; c.fillRect(70, by, bw, bh); c.strokeStyle = p.line; c.lineWidth = 2.6; c.strokeRect(86, by + 16, bw - 32, bh - 32);
    D.meander(c, 70, 70 + bw, by - 34, 0.42, 20 * lt, o); D.meander(c, 70, 70 + bw, by + bh + 2, 0.42, -20 * lt, o); c.restore();
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) D.text(c, a.slice(0, kk).join(''), W / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.22, { size, maxW: 840, outline: false, col: C.white, inv: o.inv }); }); }
  // N 站进度
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 110, x1 = 970, yy = 1335, X = i => lerp(x0, x1, i / (N - 1));
  c.strokeStyle = p.sil; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, yy); c.lineTo(x1 + 20, yy); c.stroke();
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 50, cur = lerp(from, done, q);
  c.strokeStyle = p.red; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 20, yy); c.lineTo(Math.max(x0 - 20, cur), yy); c.stroke();
  for (let i = 0; i < N; i++) { const isC = i === n - 1, past = i < n - 1, pp = isC ? Math.max(0.6, D.pop(lt, walkEnd, 0.45)) : 1; c.fillStyle = p.sil; c.beginPath(); c.arc(X(i), yy, isC ? 20 * pp : 12, 0, TAU); c.fill(); c.fillStyle = past || (isC && lt > walkEnd) ? p.red : p.white; c.beginPath(); c.arc(X(i), yy, isC ? 11 * pp : 6, 0, TAU); c.fill(); }
  D.person(c, cur, yy - 12, 120, { pose: 'walk', t: lt, speed: lt < walkEnd ? 9 : 0, phase: 0.6, inv: o.inv, head: 'band' });
  D.finish(c, o);
};
// 字幕（assemble 生成的 subs.js 调它）：深陶土底板＋米白字＋刻线内框，字幕带 y≈1480，让开视频号底栏
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 78), h = 92, x = 540, y = 1480;
  c.fillStyle = C.black; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 7, w, h, 8); c.fill();
  c.fillStyle = 'rgba(74,28,10,.95)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 8); c.fill();
  c.strokeStyle = C.inc; c.lineWidth = 2; c.strokeRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14);
  c.fillStyle = C.red; c.fillRect(x - w / 2 - 4, y - 7, 11, 14); c.fillRect(x + w / 2 - 7, y - 7, 11, 14);
  c.fillStyle = C.white; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
