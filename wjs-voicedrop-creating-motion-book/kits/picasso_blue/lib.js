// 画风套件 picasso_blue（配方 huashu-art-motion 36_picasso_blue「毕加索蓝色时期」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：单色蓝体系（深海军蓝→钴蓝→冰白），干笔触肌理的底（长条、低对比、糊一层＋细毛刺），所有形体＝平涂＋几笔笔触＋笃定的粗深色轮廓（不抖）；
//       人是拉长的无脸剪影（长颈、长袍、椭圆长头；站/背/垂头/思考/伸手/坐），手指又长又细；贯穿物是同一只无花纹的白蓝杯（手柄朝向固定）。
//       琥珀 #F2B35A 是全片唯一的暖色信号：只给「希望／可改写」时刻（杯中茶、窗光、光环），平时不出现。
//       整体比样张提亮约 12%，背景笔触对比压低，手机上不发黑。环境层全部确定性（U.rng / U.hash），同一 t 画同一帧。
//       字：标题/标签带亮色底板（深字），或冰白字＋深色粗描边，手机可读；字体只用引擎自带 PuHui-Black/Heavy/Bold。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：回弹起步会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__pb) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__pb = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__pb) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__pb = 1; } }

const C = K.C = {
  abyss: '#0E2046', navy: '#17325F', prus: '#234A82', cob: '#376AA6', cer: '#7099C6', pale: '#B8D0E8', ice: '#E6F0FA',
  line: '#08142E', teal: '#3F7790', skin: '#9FBBD9', skinDk: '#6F90B6', hair: '#0C1B3C',
  amber: '#F2B35A', amberLt: '#FFD890', amberDk: '#C9852E',
};
// 色工具
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
K.mix = (a, b, k) => { const u = hex(a), v = hex(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
K.shade = (h, k = 0.3) => K.mix(h, C.line, k);
K.rgba = (h, a) => { const u = hex(h); return `rgba(${u[0]},${u[1]},${u[2]},${a})`; };

K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.ease = q => { q = clamp(q); return q * q * (3 - 2 * q); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
K.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
const bez = (p, q) => { const u = 1 - q; return [u*u*u*p[0][0] + 3*u*u*q*p[1][0] + 3*u*q*q*p[2][0] + q*q*q*p[3][0], u*u*u*p[0][1] + 3*u*u*q*p[1][1] + 3*u*q*q*p[2][1] + q*q*q*p[3][1]]; };
const band = (pts, w0, w1) => { const L = [], R = [];
  pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    L.push([p[0] - dy / n * w, p[1] + dx / n * w]); R.push([p[0] + dy / n * w, p[1] - dx / n * w]); });
  const path = new Path2D(); L.forEach((p, i) => i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])); R.reverse().forEach(p => path.lineTo(p[0], p[1])); path.closePath(); return path; };
K.band = band;

// ---------- 蓝色时期的「块」：平涂（可带月牙暗面）＋几笔小笔触＋笃定粗轮廓 ----------
// o: { box:[x0,y0,x1,y1] 笔触撒在哪（局部坐标）, seed, hi/lo 笔触色, dx,dy 暗面偏移（0=无）, lw 轮廓宽（0=无）, n 笔触数 }
K.body = (c, path, col, o = {}) => {
  const { box = [-200, -200, 200, 200], seed = 1, hi = 'rgba(184,208,232,.20)', lo = 'rgba(8,20,46,.20)', dx = 0, dy = 0, lw = 6, line = C.line } = o;
  c.save();
  if (dx || dy) { c.fillStyle = o.dark || K.shade(col, 0.32); c.fill(path); c.save(); c.clip(path); c.translate(-dx, -dy); c.fillStyle = col; c.fill(path); c.restore(); } else { c.fillStyle = col; c.fill(path); }
  const n = o.n ?? clamp(Math.round((box[2] - box[0]) * (box[3] - box[1]) / 9000), 6, 46);
  if (n > 0) { c.save(); c.clip(path); const r = U.rng(seed); c.lineCap = 'round'; c.lineWidth = Math.max(4, lw);
    for (let i = 0; i < n; i++) { const x = lerp(box[0], box[2], r()), y = lerp(box[1], box[3], r()), L = 26 + r() * 46; c.strokeStyle = i % 3 ? hi : lo; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.35) * 30, y + L); c.stroke(); }
    c.restore(); }
  if (lw > 0) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = line; c.stroke(path); }
  c.restore();
};
// 粗轮廓笔触描边：两遍（宽深色＋略偏的浅色细线），像手上过两道墨
K.ink = (c, path, o = {}) => { const { lw = 7, col = C.line, hi = null, alpha = 1 } = o; c.save(); c.globalAlpha *= alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = col; c.lineWidth = lw; c.stroke(path);
  if (hi) { c.strokeStyle = hi; c.lineWidth = Math.max(2, lw * 0.4); c.translate(-lw * 0.25, -lw * 0.25); c.stroke(path); } c.restore(); };
// 沿折线描一条粗笔触线：K.stroke(c, pts, {col, lw, outline, p 画出比例, dash})
K.stroke = (c, pts, o = {}) => { const { col = C.pale, lw = 10, outline = C.line, p = 1, dash = null, alpha = 1 } = o; if (p <= 0 || pts.length < 2) return;
  const m = Math.max(2, Math.round(pts.length * clamp(p))); const path = new Path2D(); pts.slice(0, m).forEach((q, i) => i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]));
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
  if (outline) { c.strokeStyle = outline; c.lineWidth = lw + 8; c.stroke(path); } c.strokeStyle = col; c.lineWidth = lw; c.stroke(path); c.restore(); };

// ---------- 底：干笔触（宽、长、低对比、糊一层＋细毛刺）；kind: room 室内 / night 夜 / street 街 / dawn 晨光 / dark 暗 / bright 亮 ----------
const M = 220;   // 纹理四周多画的边，镜头拉远（z<1）、横移时不露边
const BG = {
  room:   { wall: '#1B386A', cols: ['#234A82', '#17325F', '#1F427A', '#3F7790', '#376AA6'], table: '#1E3F74', hz: 1040, edge: 'rgba(112,153,198,.5)' },
  night:  { wall: '#112652', cols: ['#17325F', '#0E2046', '#15305B', '#234A82'], table: '#16305E', hz: 1040, edge: 'rgba(112,153,198,.4)' },
  street: { wall: '#1A3866', cols: ['#234A82', '#17325F', '#2A5B94', '#3F7790'], table: '#2B528A', hz: 1220, edge: 'rgba(184,208,232,.35)' },
  dawn:   { wall: '#3D6FA6', cols: ['#4F82B8', '#376AA6', '#6C9AC8', '#2F5E94'], table: '#2A5489', hz: 1040, edge: 'rgba(230,240,250,.5)' },
  dark:   { wall: '#0F2347', cols: ['#17325F', '#0E2046', '#122A52', '#1A3A6A'], table: null, hz: 0, edge: '' },
  bright: { wall: '#3A68A4', cols: ['#4C7EB8', '#5F8FC4', '#34609B', '#7099C6'], table: '#2C5690', hz: 1040, edge: 'rgba(230,240,250,.55)' },
};
const bgTex = (kind, hz, seed, hope) => P.cached(`pb_bg_${kind}_${hz}_${seed}_${hope ? 1 : 0}`, W + 2 * M, H + 2 * M, g => {
  const d = BG[kind] || BG.room, r = U.rng(36 + seed * 101), Wt = W + 2 * M, Ht = H + 2 * M, top = M + (hz || 0);
  g.fillStyle = d.wall; g.fillRect(0, 0, Wt, Ht);
  if (kind === 'dawn') { const gr = g.createLinearGradient(0, 0, 0, top); gr.addColorStop(0, '#2F5E94'); gr.addColorStop(0.7, '#6F9CCB'); gr.addColorStop(1, '#B8D0E8'); g.fillStyle = gr; g.fillRect(0, 0, Wt, top); }
  if (kind === 'street') {   // 远处楼群：竖向块面＋窗点
    let bx = 0; while (bx < Wt) { const bw = 120 + r() * 140, bh = 420 + r() * 520, y0 = top - bh; g.fillStyle = ['#143060', '#1B3C70', '#112856', '#21497E'][Math.floor(r() * 4)]; g.fillRect(bx, y0, bw - 6, bh + 4);
      g.fillStyle = 'rgba(184,208,232,.22)'; for (let yy = y0 + 40; yy < top - 30; yy += 54) for (let xx = bx + 18; xx < bx + bw - 34; xx += 40) if (r() < 0.42) g.fillRect(xx, yy, 18, 24); bx += bw; } }
  // 笔触：墙上竖向长条，桌面横向长条
  const nW = kind === 'dark' ? 360 : 520;
  for (let i = 0; i < nW; i++) { const x = r() * Wt, y = r() * (hz ? top : Ht), col = d.cols[Math.floor(r() * d.cols.length)];
    g.save(); g.globalAlpha = 0.14 + r() * 0.14; g.fillStyle = col; g.translate(x, y); g.rotate((r() - 0.5) * 0.1); g.beginPath(); g.roundRect(-22, -90, 44, 180 + r() * 90, 20); g.fill(); g.restore(); }
  g.save(); g.filter = 'blur(7px)'; g.globalAlpha = 0.8; g.drawImage(g.canvas, 0, 0); g.restore();
  // 干笔毛刺：细长竖线，亮暗各半
  for (let i = 0; i < 70; i++) { const x = r() * Wt, y = r() * (hz ? top : Ht), L = 60 + r() * 140; g.strokeStyle = r() < 0.5 ? 'rgba(160,196,232,.05)' : 'rgba(8,20,46,.06)'; g.lineWidth = 4 + r() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 10, y + L); g.stroke(); }
  if (kind === 'night') {   // 星、月、远处灯火（冷白，不暖）
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(230,240,250,${0.25 + r() * 0.4})`; const s = 3 + r() * 3; g.fillRect(M + r() * W, M + r() * 520, s, s); }
    const mg = g.createRadialGradient(M + 880, M + 480, 20, M + 880, M + 480, 200); mg.addColorStop(0, 'rgba(184,208,232,.5)'); mg.addColorStop(1, 'rgba(184,208,232,0)'); g.fillStyle = mg; g.fillRect(M + 640, M + 240, 480, 480);
    g.fillStyle = '#C9DCF0'; g.beginPath(); g.arc(M + 880, M + 480, 46, 0, TAU); g.fill(); g.strokeStyle = C.line; g.lineWidth = 6; g.stroke();
    g.fillStyle = 'rgba(8,20,46,.85)'; for (let i = 0, x = 0; x < Wt; i++) { const bw = 70 + r() * 90, bh = 90 + r() * 150; g.fillRect(x, top - bh, bw - 4, bh); x += bw; }
    g.fillStyle = 'rgba(184,208,232,.55)'; for (let i = 0; i < 70; i++) g.fillRect(r() * Wt, top - 20 - r() * 150, 8, 10); }
  if (kind === 'dawn' && hope) { const hg = g.createLinearGradient(0, top - 340, 0, top); hg.addColorStop(0, 'rgba(242,179,90,0)'); hg.addColorStop(1, 'rgba(242,179,90,.55)'); g.fillStyle = hg; g.fillRect(0, top - 340, Wt, 340); }
  if (d.table && hz) {   // 桌面（单独成层，画在笔触之后）
    g.fillStyle = d.table; g.fillRect(0, top, Wt, Ht - top);
    const tc = kind === 'street' ? ['#3A6BA2', '#234A82', '#2A5B94'] : ['#234A82', '#17325F', '#376AA6', '#122A52'];
    for (let i = 0; i < 380; i++) { const x = r() * Wt, y = top + r() * (Ht - top); g.save(); g.globalAlpha = 0.14 + r() * 0.14; g.fillStyle = tc[Math.floor(r() * tc.length)]; g.translate(x, y); g.beginPath(); g.roundRect(-70, -14, 140 + r() * 80, 28, 12); g.fill(); g.restore(); }
    g.save(); g.filter = 'blur(4px)'; g.globalAlpha = 0.5; g.drawImage(g.canvas, 0, top, Wt, Ht - top, 0, top, Wt, Ht - top); g.restore();
    g.fillStyle = d.edge; g.fillRect(0, top - 2, Wt, 5); g.fillStyle = C.line; g.fillRect(0, top - 8, Wt, 8);
    if (hope && kind !== 'dawn') { g.fillStyle = 'rgba(242,179,90,.10)'; g.fillRect(0, top, Wt, 40); } }
});
// o: { kind, hz 地平/桌沿 y（false=无桌）, seed, hope（琥珀晨光，只给希望时刻）}
K.bg = (c, t, o = {}) => { const kind = BG[o.kind] ? o.kind : 'room', d = BG[kind], hz = o.hz === false ? 0 : (o.hz ?? d.hz);
  c.drawImage(bgTex(kind, hz, o.seed || 0, !!o.hope), -M, -M); };
// 收尾：压边＋字幕带一层很淡的深色（让字幕底板和画面分开）
K.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.4, 600, W / 2, H * 0.4, 1350); g.addColorStop(0, 'rgba(6,14,34,0)'); g.addColorStop(1, 'rgba(6,14,34,.34)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1370, 0, 1600); b.addColorStop(0, 'rgba(8,18,42,0)'); b.addColorStop(0.5, 'rgba(8,18,42,.4)'); b.addColorStop(1, 'rgba(8,18,42,0)'); c.fillStyle = b; c.fillRect(0, 1370, W, 230);
};

// ---------- 文字 ----------
// 冰白字＋深色粗描边。o: { size, fam, col, align, alpha, scale, track, maxW, rot, sw 描边比例 }
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ice, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, sw = 0.14 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = size * sw; c.strokeStyle = o.stroke || C.line; if (sw > 0) c.strokeText(s, 0, 0); c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.bigText = (c, s, x, y, o = {}) => K.text(c, s, x, y, { ...o, size: Math.max(100, o.size || 128) });
K.split2 = (s, max = 8) => { const a = [...s]; if (a.length <= max) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—？'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 亮色底板（略歪的剪纸感）：硬投影＋粗描边。fill: 'ice' 冰白（深字）/ 'dark' 深蓝（冰字）/ 'amber' 琥珀（深字，只给希望）
const PLATE = { ice: [C.ice, C.line], pale: [C.pale, C.line], dark: [C.navy, C.ice], amber: [C.amber, C.line] };
const plate = (c, w, h, fill, skew = 5, rad = 18) => { const [bg] = PLATE[fill] || PLATE.ice, sk = skew;
  const p = new Path2D(); p.moveTo(-w / 2 + rad, -h / 2 + sk); p.lineTo(w / 2 - rad, -h / 2 - sk); p.quadraticCurveTo(w / 2, -h / 2 - sk, w / 2, -h / 2 - sk + rad); p.lineTo(w / 2, h / 2 + sk - rad); p.quadraticCurveTo(w / 2, h / 2 + sk, w / 2 - rad, h / 2 + sk);
  p.lineTo(-w / 2 + rad, h / 2 - sk); p.quadraticCurveTo(-w / 2, h / 2 - sk, -w / 2, h / 2 - sk - rad); p.lineTo(-w / 2, -h / 2 + sk + rad); p.quadraticCurveTo(-w / 2, -h / 2 + sk, -w / 2 + rad, -h / 2 + sk); p.closePath();
  c.save(); c.translate(9, 12); c.fillStyle = 'rgba(6,14,34,.62)'; c.fill(p); c.restore();
  c.fillStyle = bg; c.fill(p); c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = C.line; c.stroke(p); };
// 标题板：字 ≥100px，板宽随字，超宽整体缩小。o: { size, fill, rot, scale, alpha, maxW, w, h }
K.title = (c, s, x, y, o = {}) => { const size = Math.max(100, o.size || 120), fill = o.fill || 'ice', maxW = o.maxW || 1000;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot ?? -0.015); c.font = `${size}px "PuHui-Black"`;
  const tw = c.measureText(s).width, w = o.w || tw + size * 0.9, h = o.h || size * 1.45, k = (o.scale || 1) * Math.min(1, maxW / w); c.scale(k, k);
  plate(c, w, h, fill); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PLATE[fill][1]; c.fillText(s, 0, size * 0.04); c.restore(); return Math.min(w, maxW); };
// 标签板：字 ≥52px
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 52), fill = o.fill || 'ice';
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(o.scale ?? 1, o.scale ?? 1); c.font = `${size}px "${o.fam || 'PuHui-Heavy'}"`;
  const w = c.measureText(s).width + size * 1.1, h = size * 1.5; plate(c, w, h, fill, 3, 14);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PLATE[fill][1]; c.fillText(s, 0, size * 0.04); c.restore(); return w; };
// 「示意」小标（44px，图表示意级必带）
K.mark = (c, x, y, s = '示意') => { c.save(); c.font = '44px "PuHui-Heavy"'; const w = c.measureText(s).width + 36; c.translate(x, y); c.fillStyle = 'rgba(8,20,46,.85)'; c.fill(K.round(-w / 2, -30, w, 60, 14)); c.strokeStyle = C.pale; c.lineWidth = 4; c.stroke(K.round(-w / 2, -30, w, 60, 14));
  c.fillStyle = C.pale; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate === 'title') K.title(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else if (o.plate) K.tag(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：深描边冰白粗线先画出来，末端标签板逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const size = Math.max(52, o.size || 52), p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.strokeStyle = C.line; c.lineWidth = 14; c.stroke(); c.strokeStyle = o.lineCol || C.pale; c.lineWidth = 6; c.stroke();
  const r = 13 * Math.min(1, p1 * 3); c.fillStyle = C.pale; c.beginPath(); c.arc(ax, ay, r, 0, TAU); c.fill(); c.lineWidth = 5; c.strokeStyle = C.line; c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.translate(bx, by); c.scale(q, q); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.1, h = size * 1.5; plate(c, w, h, o.fill || 'ice', 3, 14);
  c.fillStyle = PLATE[o.fill || 'ice'][1]; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.55, size * 0.04); c.restore(); };
// 光环/涟漪：K.rings(c,x,y,r,lt,at,{n,col,lw,sq 纵向压扁})
K.rings = (c, x, y, r, lt, at, o = {}) => { const { n = 2, col = C.pale, lw = 7, sq = 1, fade = true } = o; for (let i = 0; i < n; i++) { const q = K.at(lt, at + i * 0.25, 0.9); if (q <= 0 || q >= 1) continue;
  c.save(); c.globalAlpha *= (fade ? 1 - q : 1) * 0.9; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, r * (0.4 + q * 1.1), r * sq * (0.4 + q * 1.1), 0, 0, TAU); c.stroke(); c.restore(); } };

// ---------- 杯：全片同一只无花纹的白蓝杯，手柄在左（o.flip 才镜像）----------
// (x,y)=杯底中心。o: { s 缩放, t 时间, steam 0..1 热气浓度, mood 'calm'|'tense'|'curl', amber 0..1 杯中茶变琥珀（只给希望）, halo 光环（默认悬浮时有）, float 悬浮高度px, tilt 弧度, flip, alpha, shadow }
// 返回锚点 { base, rim 杯口中心, handle 手柄中点, top }（屏幕坐标，未计 tilt）
K.cup = (c, x, y, o = {}) => { const { s = 1, t = 0, steam = 0, mood = 'calm', amber = 0, float: fl = 0, tilt = 0, flip = false, alpha = 1, shadow = true } = o, halo = o.halo ?? fl > 0;
  const warm = clamp(amber), ringCol = warm > 0 ? K.mix(C.cer, C.amber, warm) : C.cer, cy = y - fl;
  c.save(); c.globalAlpha *= alpha;
  if (shadow) { c.save(); c.translate(x, y + 6); c.fillStyle = `rgba(6,14,34,${0.42 * (1 - Math.min(0.6, fl / 300))})`; c.beginPath(); c.ellipse(0, 0, 110 * s * (1 - fl / 900), 20 * s, 0, 0, TAU); c.fill(); c.restore(); }
  if (halo) { c.save(); c.translate(x, y + 4); const gr = c.createRadialGradient(0, 0, 10 * s, 0, 0, 190 * s); gr.addColorStop(0, K.rgba(warm > 0 ? C.amber : C.cer, 0.42)); gr.addColorStop(1, K.rgba(warm > 0 ? C.amber : C.cer, 0));
    c.scale(1, 0.24); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 190 * s, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = ringCol; c.lineWidth = 7; c.beginPath(); c.ellipse(x, y + 4, 112 * s, 26 * s, 0, 0, TAU); c.stroke(); }
  c.translate(x, cy); c.rotate(tilt); c.scale(s * (flip ? -1 : 1), s);
  const ha = new Path2D(); ha.ellipse(-168, -168, 62, 80, 0, 1.24, 5.04, false);
  c.lineCap = 'round'; c.lineWidth = 26; c.strokeStyle = C.line; c.stroke(ha); c.lineWidth = 13; c.strokeStyle = C.pale; c.stroke(ha);
  const cup = new Path2D(); cup.moveTo(-135, -310); cup.bezierCurveTo(-140, -150, -100, -30, -70, 0); cup.lineTo(70, 0); cup.bezierCurveTo(100, -30, 140, -150, 135, -310); cup.closePath();
  K.body(c, cup, C.pale, { box: [-130, -300, 130, 0], seed: 31, dx: -28, dy: 0, dark: C.cer, hi: 'rgba(230,240,250,.4)', lo: 'rgba(55,106,166,.28)', n: 14, lw: 7 });
  // 杯口：茶面（深蓝；变琥珀）
  const tea = warm > 0 ? K.mix('#0E2046', '#C98A3A', warm) : '#0E2046';
  c.fillStyle = tea; c.beginPath(); c.ellipse(0, -310, 135, 30, 0, 0, TAU); c.fill();
  if (warm > 0) { c.fillStyle = K.rgba(C.amberLt, 0.55 * warm); c.beginPath(); c.ellipse(-20, -306, 80, 14, 0, 0, TAU); c.fill(); }
  c.lineWidth = 7; c.strokeStyle = C.line; c.stroke(); c.strokeStyle = C.ice; c.lineWidth = 7; c.beginPath(); c.ellipse(0, -310, 135, 30, 0, 0, TAU); c.stroke();
  // 热气
  if (steam > 0) { const sp = mood === 'tense' ? 2.2 : 1, amp = mood === 'tense' ? 22 : mood === 'curl' ? 28 : 14, col = warm > 0 ? C.amberLt : C.pale;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const sg = (cc, a0) => { const g = c.createLinearGradient(0, -345, 0, -345 - 14 * 22); g.addColorStop(0, K.rgba(cc, a0 * steam)); g.addColorStop(1, K.rgba(cc, 0)); return g; };
    for (let k = 0; k < 3; k++) { const pth = new Path2D(); for (let i = 0; i <= 14; i++) { const px = -45 + k * 45 + (mood === 'tense' ? (i % 2 ? 1 : -1) * 8 : 0) + Math.sin(i * 0.7 + t * sp + k * 2) * amp * (0.4 + i / 14), py = -345 - i * 22; i ? pth.lineTo(px, py) : pth.moveTo(px, py); }
      c.strokeStyle = sg(C.line, 0.55); c.lineWidth = 17; c.stroke(pth); c.strokeStyle = sg(col, 0.9); c.lineWidth = 9; c.stroke(pth); } }
  c.restore();
  return { base: [x, y], rim: [x, cy - 310 * s], handle: [x + (flip ? 168 : -168) * s, cy - 168 * s], top: [x, cy - 345 * s] };
};

// ---------- 桌/窗/椅 ----------
// 独立桌板（bg 已带桌面时不用）：(x,y)=桌面后缘中点，w 宽，d 桌面进深，legs 腿长
K.table = (c, o = {}) => { const { x = 540, y = 1040, w = 900, d = 150, legs = 260, col = C.prus } = o;
  c.save(); c.translate(x, y); [-w / 2 + 50, w / 2 - 50].forEach((lx, i) => K.body(c, K.round(lx - 26, d, 52, legs, 8), C.navy, { box: [lx - 26, d, lx + 26, d + legs], seed: 5 + i, n: 4 }));
  K.body(c, K.poly([[-w / 2 + 70, 0], [w / 2 - 70, 0], [w / 2, d], [-w / 2, d]]), col, { box: [-w / 2, 0, w / 2, d], seed: 9, n: 22 });
  K.body(c, K.round(-w / 2, d, w, 44, 10), C.navy, { box: [-w / 2, d, w / 2, d + 44], seed: 10, n: 6 }); c.restore(); };
// 窗：(x,y)=窗中心。o: { kind 'night'|'dawn'|'rain', t, hope 琥珀窗光（只给希望）, curtain, beam 光束斜落到地面 }
K.window = (c, x, y, w, h, o = {}) => { const { kind = 'night', t = 0, hope = false } = o; c.save(); c.translate(x, y);
  const pane = K.round(-w / 2, -h / 2, w, h, 10); c.save(); c.clip(pane);
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2); if (hope || kind === 'dawn') { g.addColorStop(0, '#5F8FC4'); g.addColorStop(0.6, '#B8D0E8'); g.addColorStop(1, hope ? '#F2B35A' : '#E6F0FA'); } else { g.addColorStop(0, '#0E2046'); g.addColorStop(1, '#234A82'); }
  c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h);
  if (!hope && kind !== 'dawn') { const r = U.rng(77); for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(230,240,250,${0.3 + r() * 0.5})`; c.fillRect(-w / 2 + r() * w, -h / 2 + r() * h * 0.6, 5, 5); } c.fillStyle = '#C9DCF0'; c.beginPath(); c.arc(w * 0.18, -h * 0.22, w * 0.1, 0, TAU); c.fill(); }
  if (kind === 'rain') { c.strokeStyle = 'rgba(184,208,232,.5)'; c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 26; i++) { const px = -w / 2 + U.hash(i, 3) * w, py = (-h / 2 + ((U.hash(i, 4) * h + t * 360) % (h + 60))) - 30; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 8, py + 34); c.stroke(); } }
  c.restore();
  c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = C.line; c.stroke(pane); c.lineWidth = 30; c.strokeStyle = C.line; c.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12); c.lineWidth = 16; c.strokeStyle = C.cob; c.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
  c.fillStyle = C.cob; c.fillRect(-7, -h / 2, 14, h); c.fillRect(-w / 2, -7, w, 14); c.lineWidth = 5; c.strokeStyle = C.line; c.strokeRect(-7, -h / 2, 14, h); c.strokeRect(-w / 2, -7, w, 14);
  K.body(c, K.round(-w / 2 - 34, h / 2 + 8, w + 68, 30, 8), C.cer, { box: [-w / 2, h / 2, w / 2, h / 2 + 40], seed: 3, n: 4 });
  if (o.curtain) [-1, 1].forEach(sd => { const cw = w * 0.34, x0 = sd * (w / 2 + 30), x1 = sd * (w / 2 + 30 + cw * 1.0), yT = -h / 2 - 40, yB = h / 2 + 150, p = new Path2D();
    p.moveTo(x0, yT); p.lineTo(x1, yT); p.lineTo(x1 + sd * 6, yB - 20); p.quadraticCurveTo((x0 + x1) / 2, yB + 24, x0 - sd * 6, yB - 10); p.closePath();
    K.body(c, p, C.prus, { box: [Math.min(x0, x1), yT, Math.max(x0, x1), yB], seed: 8 + sd, n: 0 }); c.save(); c.clip(p); c.strokeStyle = 'rgba(8,20,46,.3)'; c.lineWidth = 8; for (let i = 1; i < 4; i++) { const fx = lerp(x0, x1, i / 4); c.beginPath(); c.moveTo(fx, yT); c.lineTo(fx + sd * 4, yB); c.stroke(); } c.restore(); });
  if (hope && o.beam !== false) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(242,179,90,.17)'; c.beginPath(); c.moveTo(-w / 2, h / 2); c.lineTo(w / 2, h / 2); c.lineTo(w * 0.9, h / 2 + 700); c.lineTo(-w * 0.3, h / 2 + 700); c.closePath(); c.fill(); c.restore(); }
  c.restore(); };
// 椅：(x,y)=座面正下方地面，朝向 dir（背在 -dir 一侧）。座面高 300·s，与 K.figure 的 sit 坐姿对齐
K.chair = (c, x, y, s = 1, o = {}) => { const dir = o.dir || 1; c.save(); c.translate(x, y); c.scale(s * dir, s);
  [[-120, 30], [140, 30]].forEach(([lx], i) => K.body(c, K.round(lx - 18, -290, 36, 290, 8), C.navy, { box: [lx - 18, -290, lx + 18, 0], seed: 40 + i, n: 3 }));
  K.body(c, K.round(-150, -640, 38, 360, 12), C.prus, { box: [-150, -640, -112, -280], seed: 44, n: 6 });
  K.body(c, K.round(-172, -330, 360, 46, 12), C.cob, { box: [-172, -330, 188, -284], seed: 45, n: 6 }); c.restore(); };

// ---------- 手：reach 伸 / point 指 / pinch 捏 / fist 握 / open 摊（细长、指节分明）----------
// (x,y)=手腕，朝向 +x，o.rot 旋转，o.dir=-1 镜像；o.from=[x0,y0] 画一条袖子＋前臂从那儿伸到手腕；o.hold(c,x,y) 在捏点/指尖画被拿的东西；返回 { tip, pinch } 屏幕坐标
// 肢体：沿折线的一串带圆关节的粗带（先描边再填色＝合并轮廓），w0→w1 渐细
K.limb = (c, pts, w0, w1, col, o = {}) => { const pieces = [], n = pts.length;
  pts.forEach((p, i) => { const w = lerp(w0, w1, i / (n - 1)); pieces.push(K.circle(p[0], p[1], w / 2)); if (i) { const q = pts[i - 1], wq = lerp(w0, w1, (i - 1) / (n - 1)); pieces.push(band([q, [(q[0] + p[0]) / 2, (q[1] + p[1]) / 2], p], wq, w)); } });
  c.save(); c.lineJoin = 'round'; c.strokeStyle = o.line || C.line; c.lineWidth = o.lw || 12; pieces.forEach(p => c.stroke(p)); c.fillStyle = col; pieces.forEach(p => c.fill(p));
  if (o.dark) { c.strokeStyle = o.dark; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); pts.forEach((p, i) => { const nx = pts[Math.min(n - 1, i + 1)], pv = pts[Math.max(0, i - 1)], dx = nx[0] - pv[0], dy = nx[1] - pv[1], L = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (n - 1)) * 0.28, q = [p[0] - dy / L * w, p[1] + dx / L * w]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); }
  c.restore(); };
const finger = (x, y, ang, len, w0, w1 = w0 * 0.72) => { const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  return [band([[x, y], [(x + ex) / 2, (y + ey) / 2], [ex, ey]], w0, w1), K.circle(ex, ey, w1 / 2), K.circle(x, y, w0 / 2)]; };
K.hand = (c, x, y, o = {}) => { const { pose = 'reach', s = 1, rot = 0, dir = 1, skin = C.skin, sleeve = C.navy, from = null, bend = 0.12, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha;
  if (from) { const dx = x - from[0], dy = y - from[1], L = Math.hypot(dx, dy) || 1, mid = [(x + from[0]) / 2 - dy / L * L * bend, (y + from[1]) / 2 + dx / L * L * bend], pts = []; for (let i = 0; i <= 24; i++) { const q = i / 24, u = 1 - q; pts.push([u * u * from[0] + 2 * u * q * mid[0] + q * q * x, u * u * from[1] + 2 * u * q * mid[1] + q * q * y]); }
    const k = 17; K.limb(c, pts.slice(k - 2), 46 * s, 34 * s, skin); K.limb(c, pts.slice(0, k), 84 * s, 52 * s, sleeve, { dark: 'rgba(112,153,198,.25)' }); }
  c.translate(x, y); c.rotate(rot); c.scale(s * dir, s);
  const pieces = [], pal = (rx, ry, cx = 30) => pieces.push(K.ellipse(cx, 0, rx, ry)), fg = (...a) => pieces.push(...finger(...a));
  let tip = [150, 0], pinch = null;
  if (pose === 'reach') { pal(40, 30); [[-20, -0.03, 108], [-7, -0.01, 122], [7, 0.01, 116], [20, 0.05, 96]].forEach(([fy, a, L]) => fg(60, fy, a, L, 17)); fg(34, -24, -0.8, 66, 20, 13); tip = [180, 0]; }
  else if (pose === 'point') { pal(38, 31); fg(58, -15, -0.04, 146, 17, 11); [-2, 12, 26].forEach(fy => fg(58, fy, 0.5, 44, 17, 14)); fg(34, -26, -0.7, 58, 20, 13); tip = [204, -21]; }
  else if (pose === 'pinch') { pal(38, 30); fg(56, -15, -0.3, 70, 17, 14); fg(123, -36, 0.71, 62, 14, 11); fg(40, 22, 0.45, 70, 20, 15); fg(103, 52, -0.62, 82, 15, 11); [-2, 10].forEach(fy => fg(56, fy, 0.7, 40, 16, 13)); pinch = [170, 5]; tip = pinch; }
  else if (pose === 'fist') { pal(44, 36, 34); [-27, -9, 9, 27].forEach(fy => pieces.push(K.circle(70, fy, 15))); fg(40, -26, 0.15, 58, 20, 16); tip = [90, 0]; }
  else { pal(42, 34); [[-26, -0.62, 98], [-9, -0.25, 116], [9, 0.04, 108], [26, 0.34, 88]].forEach(([fy, a, L]) => fg(62, fy, a, L, 17)); fg(28, 30, 0.95, 64, 20, 13); tip = [185, 0]; }
  c.lineJoin = 'round'; c.strokeStyle = C.line; c.lineWidth = 12; pieces.forEach(p => c.stroke(p)); c.fillStyle = skin; pieces.forEach(p => c.fill(p));
  c.strokeStyle = 'rgba(8,20,46,.26)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(46, -8); c.lineTo(54, 14); c.moveTo(34, -14); c.lineTo(38, 8); c.stroke();
  if (o.hold) o.hold(c, tip[0], tip[1]);
  c.restore();
  const cr = Math.cos(rot), sr = Math.sin(rot), pt = q => { const ux = q[0] * s * dir, uy = q[1] * s; return [x + ux * cr - uy * sr, y + ux * sr + uy * cr]; };
  return { tip: pt(tip), pinch: pinch ? pt(pinch) : null }; };

// ---------- 拉长的无脸人物剪影 ----------
// K.figure(c, x, y, s, o)：(x,y)=脚底（坐姿也是地面），s=1 时全高约 910px；dir=1 朝右、-1 朝左（水平镜像）
// o.pose: stand 站 / back 背影 / slump 垂头 / think 托腮 / reach 伸手(o.target=[tx,ty] 屏幕坐标) / walk(o.walk 相位) / sit 坐 / sitThink / sitSlump / sitReach（坐姿配 K.chair，座面高 300·s）
// o: { to 混向的另一姿势, mix 0..1, face 'side'|'front'|'back', coat 袍色, shawl 披肩色|false, hair 头发色|false, t 呼吸, shadow, alpha, skin }
// 返回屏幕坐标锚点 { head, top, chest, hand 前手, handB 后手, feet }
const POSE = {   // lean 前倾, hd 头偏移, tilt 头倾斜, aF/aB 前/后手腕目标（局部，脚底为原点、朝向 +x），eF 前肘（可选，不写则 IK）
  stand: { lean: 0, hd: [0, 0], tilt: 0.05, aF: [112, -226], aB: [-112, -226] },
  back: { lean: 0, hd: [0, 0], tilt: 0, aF: [112, -226], aB: [-112, -226] },
  slump: { lean: 0.24, hd: [10, 34], tilt: 0.42, aF: [116, -240], aB: [-104, -240] },
  think: { lean: 0.03, hd: [4, 4], tilt: -0.16, aF: [46, -742], aB: [-112, -226], eF: [150, -520] },
  reach: { lean: 0.08, hd: [8, 2], tilt: 0.08, aF: [380, -560], aB: [-112, -226] },
  walk: { lean: 0.06, hd: [0, 0], tilt: 0.02, aF: [118, -270], aB: [-118, -270] },
  sit: { lean: 0.04, hd: [0, 0], tilt: 0.06, aF: [210, -430], aB: [120, -420] },
  sitThink: { lean: 0.05, hd: [4, 4], tilt: -0.16, aF: [46, -742], aB: [140, -420], eF: [150, -520] },
  sitSlump: { lean: 0.3, hd: [10, 34], tilt: 0.45, aF: [200, -420], aB: [120, -420] },
  sitReach: { lean: 0.12, hd: [10, 2], tilt: 0.08, aF: [380, -560], aB: [120, -420] },
};
const ik2 = (S, T, a, b, bd) => { const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-3, dd = Math.min(d, a + b - 1), ang = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1));
  const E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a];
  const sc = E => E[0] * bd[0] + E[1] * bd[1]; return { E: sc(E1) >= sc(E2) ? E1 : E2, Wr: [S[0] + Math.cos(ang) * dd, S[1] + Math.sin(ang) * dd] }; };
// 袍身轮廓（左侧自下而上，再镜像）：长而窄的柱，肩斜、颈长
const robeSide = seated => seated ? [[-84, -300], [-72, -420], [-64, -500], [-78, -590], [-108, -654]] : [[-90, 0], [-76, -250], [-66, -450], [-78, -580], [-108, -654]];
K.figure = (c, x, y, s = 1, o = {}) => {
  const { dir = 1, face = null, coat = C.navy, shawl = false, hair = C.hair, t = 0, alpha = 1, skin = C.skin, shadow = true } = o;
  const name = o.pose || 'stand', seated = name.startsWith('sit'), A = POSE[name] || POSE.stand, B = POSE[o.to] || A, m = K.ease(o.mix || 0), L = (u, v) => lerp(u, v, m);
  const back = name === 'back', fc = face || (back ? 'back' : 'side');
  const Q = { lean: L(A.lean, B.lean), hd: [L(A.hd[0], B.hd[0]), L(A.hd[1], B.hd[1])], tilt: L(A.tilt, B.tilt), aF: [L(A.aF[0], B.aF[0]), L(A.aF[1], B.aF[1])], aB: [L(A.aB[0], B.aB[0]), L(A.aB[1], B.aB[1])], eF: m < 0.5 ? A.eF : B.eF };
  const br = Math.sin(t * 2.2) * 3, wk = o.walk == null ? 0 : Math.sin(o.walk) * 6;
  if (/reach/i.test(name) && o.target) Q.aF = [(o.target[0] - x) / (s * dir), (o.target[1] - y) / s];
  const bd = (px, py) => { const q = clamp((-py - 250) / 600), k = Math.pow(q, 1.4); return [px + Q.lean * 430 * k, py + Q.lean * 70 * k + (py < -300 ? br * q : 0)]; };
  const coatDk = K.shade(coat, 0.35), pants = K.shade(coat, 0.2), hipY = seated ? -300 : 0;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (wk) c.translate(0, -Math.abs(wk)); c.scale(s * dir, s);
  if (shadow) { c.fillStyle = 'rgba(6,14,34,.4)'; c.beginPath(); c.ellipse(seated ? 120 : 0, 6, seated ? 260 : 150, 22, 0, 0, TAU); c.fill(); }
  if (seated) { K.body(c, K.round(252, -340, 84, 320, 34), pants, { box: [250, -340, 340, -20], seed: 61, n: 5 }); K.body(c, K.ellipse(312, -14, 66, 24), C.line, { box: [250, -40, 380, 10], seed: 62, n: 0 });
    K.body(c, K.smooth([[-60, -410], [190, -408], [290, -385], [300, -318], [190, -300], [-60, -300]]), coat, { box: [-60, -410, 300, -300], seed: 63, n: 6, hi: 'rgba(112,153,198,.18)' }); }
  const side = robeSide(seated), rt = side.map(p => [-p[0], p[1]]).reverse(), sp = [...side, [-54, -706], [54, -706], ...rt].map(p => bd(p[0], p[1])), sm = K.smooth(sp, true);
  K.body(c, sm, coat, { box: [-120, -700, 120, hipY], seed: 11, dx: 20, dark: coatDk, n: 16, hi: 'rgba(112,153,198,.20)' });
  if (back) { c.save(); c.clip(sm); c.strokeStyle = 'rgba(112,153,198,.24)'; c.lineWidth = 7; c.lineCap = 'round'; for (let i = -2; i <= 2; i++) { const a = bd(i * 26, -650), b2 = bd(i * 20, -440); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.stroke(); } c.restore(); }
  if (shawl) { const sh = K.smooth([[-112, -656], [-56, -712], [56, -712], [112, -656], [92, -560], [30, -500], [-22, -540], [-84, -552]].map(p => bd(p[0], p[1])), true); K.body(c, sh, shawl, { box: [-130, -720, 130, -470], seed: 13, dx: 14, n: 8, hi: 'rgba(8,20,46,.18)' }); }
  // 颈、头（侧面：蛋形＋鼻尖凸起，只示朝向，不画五官）
  const nk = bd(0, -712), hc = [nk[0] + Q.hd[0], nk[1] - 128 + Q.hd[1]], pv = [nk[0], nk[1] - 10];
  K.body(c, K.round(nk[0] - 27, nk[1] - 120, 54, 130, 22), K.mix(skin, C.line, 0.2), { box: [nk[0] - 28, nk[1] - 120, nk[0] + 28, nk[1] + 10], seed: 14, n: 0 });
  c.save(); c.translate(pv[0], pv[1]); c.rotate(Q.tilt); c.translate(-pv[0], -pv[1]);
  const head = fc === 'side' ? K.smooth([[-8, -92], [36, -74], [54, -28], [64, 8], [50, 26], [46, 52], [28, 86], [-14, 94], [-46, 64], [-56, 6], [-44, -58]].map(p => [hc[0] + p[0], hc[1] + p[1]]), true) : K.ellipse(hc[0], hc[1], 54, 92);
  K.body(c, head, back ? hair : skin, { box: [hc[0] - 56, hc[1] - 92, hc[0] + 56, hc[1] + 92], seed: 12, dx: fc === 'front' ? 0 : -14, dark: back ? K.mix(hair, C.cer, 0.15) : K.mix(skin, C.line, 0.3), n: back ? 8 : 4, hi: back ? 'rgba(112,153,198,.22)' : 'rgba(8,20,46,.18)' });
  if (hair && !back) { const hr = new Path2D(); hr.moveTo(hc[0] - 54, hc[1] - 2); hr.bezierCurveTo(hc[0] - 64, hc[1] - 92, hc[0] - 10, hc[1] - 112, hc[0] + 34, hc[1] - 84); hr.bezierCurveTo(hc[0] - 4, hc[1] - 70, hc[0] - 22, hc[1] - 40, hc[0] - 54, hc[1] - 2); hr.closePath(); K.body(c, hr, hair, { box: [hc[0] - 64, hc[1] - 110, hc[0] + 34, hc[1]], seed: 15, n: 3, lw: 5 }); }
  c.restore();
  // 手臂：前手、后手（IK，肘朝外/朝后）
  const hands = [];
  [[Q.aB, -1, 'aB'], [Q.aF, 1, 'aF']].forEach(([tg, sd, nm]) => { if (back && nm === 'aF' && !/reach/i.test(name)) return;
    const Sh = bd(sd * 96, -660), bdv = seated ? [(sd > 0 ? -0.5 : -0.3), 1] : [0.22 * sd, 1];
    let E, Wr; if (nm === 'aF' && Q.eF) { E = Q.eF; Wr = tg; } else ({ E, Wr } = ik2(Sh, tg, 222, 214, bdv));
    const ap = [Sh, [lerp(Sh[0], E[0], 0.5), lerp(Sh[1], E[1], 0.5)], E, [lerp(E[0], Wr[0], 0.5), lerp(E[1], Wr[1], 0.5)], Wr];
    K.limb(c, ap, 66, 44, coat, { dark: 'rgba(112,153,198,.22)' });
    hands.push([Wr, Math.atan2(Wr[1] - ap[3][1], Wr[0] - ap[3][0]), nm]); });
  hands.forEach(([Wr, ang, nm]) => { if (back && nm === 'aB') return;
    K.hand(c, Wr[0], Wr[1], { pose: /think/i.test(name) && nm === 'aF' ? 'fist' : 'reach', s: 0.6, rot: ang, skin }); });
  c.restore();
  const pt = (lx, ly) => [x + dir * s * lx, y + s * ly], hF = hands[hands.length - 1][0], hB = hands[0][0];
  return { head: pt(hc[0], hc[1]), top: pt(hc[0], hc[1] - 92), chest: pt(bd(0, -560)[0], -560), hand: pt(hF[0], hF[1]), handB: pt(hB[0], hB[1]), feet: [x, y] };
};

// 人群：成排的小剪影，同一步调。K.crowd(c, x, y, n, o)：(x,y)=最前排地面中点，o: { w 总宽, s 单人缩放(0.42), rows, t, step 走路起伏(0/1/2同步), odd 第几个特别（冰白亮色）, oddCol, seed, dir 朝向 } → 返回每人胸口坐标
K.crowd = (c, x, y, n, o = {}) => { const { w = 860, s = 0.42, rows = 1, t = 0, step = 0, odd = -1, oddCol = C.pale, seed = 5, dir = 1 } = o, tones = [C.navy, C.prus, '#2B5894', '#1D3E70', C.cob], out = [];
  const side = robeSide(false), rt = side.map(p => [-p[0], p[1]]).reverse(), shape = K.smooth([...side, [-54, -706], [54, -706], ...rt], true);
  for (let rw = rows - 1; rw >= 0; rw--) { const k = 1 - rw * 0.16, cnt = rw ? n + 1 : n, y0 = y - rw * 120;
    for (let i = 0; i < cnt; i++) { const px = x - w / 2 + (i + 0.5) * w / cnt + (U.hash(i, seed + rw) - 0.5) * 24, hs = s * k * (0.92 + U.hash(i, seed + 9) * 0.16), bob = step ? Math.abs(Math.sin(t * 5 + i * 0.7 + (step === 2 ? 0 : U.hash(i, 2) * 6))) * 10 : 0, isOdd = rw === 0 && i === odd;
      const col = isOdd ? oddCol : K.mix(tones[Math.floor(U.hash(i, seed + rw * 7) * tones.length)], C.line, rw * 0.22);
      c.save(); c.translate(px, y0 - bob); c.scale(hs * dir, hs);
      c.fillStyle = 'rgba(6,14,34,.35)'; c.beginPath(); c.ellipse(0, 4 + bob / hs, 74, 14, 0, 0, TAU); c.fill();
      K.body(c, shape, col, { box: [-110, -700, 110, 0], seed: 81 + i, dx: 18, n: 6, lw: 9 });
      K.body(c, K.round(-26, -780, 52, 90, 20), K.mix(C.skin, C.line, 0.2), { box: [-26, -780, 26, -690], seed: 83, n: 0, lw: 8 });
      K.body(c, K.smooth([[-8, -934], [36, -916], [54, -870], [64, -834], [50, -816], [46, -790], [28, -756], [-14, -748], [-46, -778], [-56, -836], [-44, -900]], true), isOdd ? C.ice : K.mix(C.skin, C.line, rw * 0.25), { box: [-56, -934, 64, -748], seed: 82 + i, dx: -12, n: 0, lw: 9 }); c.restore();
      out.push([px, y0 - 560 * hs]); } }
  return out; };


// ---------- 轨道/沟：杯子是被带着走的那个点 ----------
// K.groove(c, kind, o)：kind: 'line' 直线 / 'curve' S 形 / 'fork' 分岔 / 'loop' 环路
// o: { x,y 中心, w,h 范围, wd 沟宽(70), t, carry:{p 0..1 进度(loop 可超 1), s 杯缩放(0.3), draw(c,x,y,ang) 自定义被带的点|null}, take 0|1 走哪条岔, lit 0..1 走过的那段是否亮, deepen 0..1 越走越深（更宽更黑）, flow 流光, col 亮边色, ends 终点环, rot }
// 返回 { pos(q, branch?) → [x,y,角度], pts }，章节作者可用它摆别的东西
K.groove = (c, kind, o = {}) => { const { x = 540, y = 1200, w = 900, h = 200, wd = 70, t = 0, take = 0, lit = 1, deepen = 0, flow = true, col = C.cer, ends = true, carry = null, rot = 0 } = o;
  const sam = (p4, n = 36) => Array.from({ length: n + 1 }, (_, i) => bez(p4, i / n));
  let segs = [], pos, loop = false;
  if (kind === 'line') { const a = sam([[x - w / 2, y], [x - w / 6, y + (o.bend ?? 0)], [x + w / 6, y - (o.bend ?? 0)], [x + w / 2, y]]); segs = [a]; pos = q => at(a, q); }
  else if (kind === 'fork') { const tr = sam([[x - w / 2, y], [x - w / 4, y], [x - w / 8, y], [x, y]], 12), b0 = sam([[x, y], [x + w / 6, y], [x + w / 3, y - h / 2], [x + w / 2, y - h / 2]]), b1 = sam([[x, y], [x + w / 6, y], [x + w / 3, y + h / 2], [x + w / 2, y + h / 2]]);
    segs = [tr, b0, b1]; const full = [tr.concat(b0), tr.concat(b1)]; pos = (q, br = take) => at(full[br], q); }
  else if (kind === 'loop') { loop = true; const a = []; for (let i = 0; i <= 72; i++) { const th = i / 72 * TAU - Math.PI / 2; a.push([x + Math.cos(th) * w / 2, y + Math.sin(th) * h / 2]); } segs = [a]; pos = q => at(a, ((q % 1) + 1) % 1); }
  else { const a = sam([[x - w / 2, y + h / 2], [x - w * 0.15, y + h * 0.55], [x - w * 0.1, y - h * 0.4], [x + w / 2, y - h / 2]], 48); segs = [a]; pos = q => at(a, q); }
  function at(a, q) { q = clamp(q); const f = q * (a.length - 1), i = Math.min(a.length - 2, Math.floor(f)), r = f - i, p = a[i], n = a[i + 1]; return [lerp(p[0], n[0], r), lerp(p[1], n[1], r), Math.atan2(n[1] - p[1], n[0] - p[0])]; }
  const wdd = wd * (1 + deepen * 0.5);
  c.save(); if (rot) { c.translate(x, y); c.rotate(rot); c.translate(-x, -y); }
  segs.forEach((sg, si) => { const dim = kind === 'fork' && si > 0 && (si - 1) !== take ? 0.5 : 1;
    c.save(); c.globalAlpha *= dim; const bp = band(sg, wdd * 1.1, wdd * 0.9); c.fillStyle = K.mix('#0B1B3E', C.line, deepen * 0.7); c.fill(bp); c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = C.line; c.stroke(bp);
    c.strokeStyle = K.rgba(col, 0.8 * (1 - deepen * 0.3)); c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); sg.forEach((p, i) => { const pn = sg[Math.min(sg.length - 1, i + 1)], pp = sg[Math.max(0, i - 1)], dx = pn[0] - pp[0], dy = pn[1] - pp[1], L = Math.hypot(dx, dy) || 1, q = [p[0] + dy / L * wdd * 0.36 * (1), p[1] - dx / L * wdd * 0.36]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
    if (flow && dim === 1) for (let k = 0; k < 6; k++) { const q = ((t * 0.16 + k / 6) % 1), p = at(sg, q); c.fillStyle = K.rgba(C.pale, 0.55 * Math.sin(q * Math.PI)); c.beginPath(); c.ellipse(p[0], p[1], 24, 8, p[2], 0, TAU); c.fill(); }
    c.restore(); });
  if (ends && !loop) { const ends2 = kind === 'fork' ? [pos(1, 0), pos(1, 1)] : [pos(1)]; ends2.forEach((e, i) => { const hot = kind !== 'fork' || i === take; c.strokeStyle = hot ? col : K.rgba(col, 0.45); c.lineWidth = 7; c.beginPath(); c.ellipse(e[0], e[1], 100 * wd / 70, 24 * wd / 70, 0, 0, TAU); c.stroke(); }); }
  if (carry) { const q = carry.p ?? 0, [px, py, ang] = pos(q, take); if (carry.draw) carry.draw(c, px, py, ang); else K.cup(c, px, py + 4, { s: carry.s ?? 0.3, t, float: 24 * (carry.s ?? 0.3) / 0.3, steam: carry.steam ?? 0.6, amber: carry.amber || 0, halo: true }); }
  c.restore(); return { pos, pts: segs }; };

// ---------- 示意图元 ----------
// 箭头：粗、深描边、冰白；p 画出比例；bend 弯曲；dash 虚线
K.arrow = (c, x0, y0, x1, y1, o = {}) => { const { p = 1, w = 18, col = C.ice, bend = 0, dash = null, head = 46, alpha = 1 } = o; if (p <= 0) return; const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, cx = (x0 + x1) / 2 - dy / L * L * bend, cy = (y0 + y1) / 2 + dx / L * L * bend, pts = [];
  const n = 30, m = Math.max(2, Math.round(n * clamp(p))); for (let i = 0; i <= m; i++) { const q = i / n, u = 1 - q; pts.push([u * u * x0 + 2 * u * q * cx + q * q * x1, u * u * y0 + 2 * u * q * cy + q * q * y1]); }
  const e = pts[pts.length - 1], pr = pts[Math.max(0, pts.length - 3)], ang = Math.atan2(e[1] - pr[1], e[0] - pr[0]);
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
  const path = new Path2D(); pts.slice(0, p >= 1 ? -2 : undefined).forEach((q, i) => i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])); c.strokeStyle = C.line; c.lineWidth = w + 9; c.stroke(path); c.strokeStyle = col; c.lineWidth = w; c.stroke(path); c.setLineDash([]);
  c.translate(e[0], e[1]); c.rotate(ang); const hp = K.poly([[head * 0.5, 0], [-head * 0.5, -head * 0.62], [-head * 0.25, 0], [-head * 0.5, head * 0.62]]); c.lineWidth = 8; c.strokeStyle = C.line; c.stroke(hp); c.fillStyle = col; c.fill(hp); c.restore(); return e; };
// 天平：K.scales(c,x,y,{tilt 弧度(右沉为正), L:{text,r,col}, R:{...}, s}) (x,y)=支点
K.scales = (c, x, y, o = {}) => { const { tilt = 0, s = 1, L: l = { text: '', r: 60 }, R: r = { text: '', r: 60 }, t = 0 } = o, hl = 270;
  c.save(); c.translate(x, y); c.scale(s, s);
  K.body(c, K.poly([[-26, 0], [26, 0], [60, 500], [-60, 500]]), C.prus, { box: [-60, 0, 60, 500], seed: 91, n: 6 }); K.body(c, K.round(-170, 480, 340, 44, 14), C.navy, { box: [-170, 480, 170, 524], seed: 92, n: 4 });
  c.save(); c.rotate(tilt); K.body(c, K.round(-hl - 20, -14, 2 * hl + 40, 28, 14), C.cer, { box: [-hl, -14, hl, 14], seed: 93, n: 4, dx: 0, dy: 6 }); c.restore();
  [[-1, l], [1, r]].forEach(([sd, it]) => { const ex = Math.cos(tilt) * hl * sd, ey = Math.sin(tilt) * hl * sd, py = ey + 250; c.strokeStyle = C.line; c.lineWidth = 6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - 90, py); c.moveTo(ex, ey); c.lineTo(ex + 90, py); c.stroke();
    K.body(c, K.smooth([[ex - 120, py], [ex + 120, py], [ex + 90, py + 34], [ex - 90, py + 34]]), C.pale, { box: [ex - 120, py, ex + 120, py + 34], seed: 94 + sd, n: 3 });
    const rr = it.r || 60; K.body(c, K.circle(ex, py - rr, rr), it.col || C.cob, { box: [ex - rr, py - 2 * rr, ex + rr, py], seed: 96 + sd, n: 6, dx: -rr * 0.2, lw: 7 }); if (it.text) K.text(c, it.text, ex, py - rr, { size: Math.max(56, Math.min(100, rr * 1.2)), col: C.ice }); });
  K.body(c, K.circle(0, 0, 30), C.pale, { box: [-30, -30, 30, 30], seed: 98, n: 0 }); c.restore(); };
// 两个圆（快/慢、A/B）：K.twoCircles(c,x,y,{gap, a:{r,label,col}, b:{...}, active:'a'|'b', t})
K.twoCircles = (c, x, y, o = {}) => { const { gap = 440, a = { r: 150 }, b = { r: 150 }, active = null, t = 0 } = o, xa = x - gap / 2, xb = x + gap / 2;
  [[a, xa, 'a', 1], [b, xb, 'b', 2]].forEach(([it, cx, key, sd]) => { const r = it.r || 150, act = active === key, pu = act ? 1 + Math.sin(t * 4) * 0.025 : 1;
    if (act) { c.save(); c.strokeStyle = K.rgba(it.glow || C.pale, 0.5); c.lineWidth = 10; c.beginPath(); c.arc(cx, y, r * 1.18 * pu, 0, TAU); c.stroke(); c.restore(); }
    K.body(c, K.circle(cx, y, r * pu), it.col || (sd === 1 ? C.cob : C.cer), { box: [cx - r, y - r, cx + r, y + r], seed: 100 + sd, n: 14, dx: -r * 0.14, dy: -r * 0.06, lw: 8 });
    if (it.label) K.text(c, it.label, cx, y, { size: it.size || 96, maxW: r * 1.6 }); }); };
// 大脑轮廓剪影（侧视）：K.brain(c,x,y,{s, col, zones:[{x,y,r,col}] 亮区, pulse, t, rays 向前射出的预测弧})
K.brain = (c, x, y, o = {}) => { const { s = 1, col = C.cob, t = 0, zones = [], pulse = 0, rays = 0 } = o; c.save(); c.translate(x, y); c.scale(s, s);
  // 脑干、小脑
  K.body(c, K.round(30, 90, 74, 170, 30), K.shade(col, 0.2), { box: [30, 90, 110, 260], seed: 111, n: 0, lw: 7 });
  const cb = [K.circle(150, 120, 48), K.circle(110, 150, 40), K.circle(190, 150, 36)]; c.lineJoin = 'round'; c.strokeStyle = C.line; c.lineWidth = 14; cb.forEach(p => c.stroke(p)); c.fillStyle = K.shade(col, 0.15); cb.forEach(p => c.fill(p));
  // 大脑：一圈大小不一的圆叠成的「花椰菜」轮廓（先描边再填色，得到合并后的外轮廓）
  const R = U.rng(o.seed || 7), lobes = [], n = 13; for (let i = 0; i < n; i++) { const a = i / n * TAU, rx = 168, ry = 112; lobes.push(K.circle(Math.cos(a) * rx, Math.sin(a) * ry - 10, 62 + R() * 16)); }
  lobes.push(K.ellipse(0, -10, 170, 112));
  c.lineWidth = 15; c.strokeStyle = C.line; lobes.forEach(p => c.stroke(p)); c.fillStyle = col; lobes.forEach(p => c.fill(p));
  const ov = new Path2D(); lobes.forEach(p => ov.addPath(p));
  c.save(); c.clip(ov);
  c.strokeStyle = 'rgba(8,20,46,.5)'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
  [[[-170, -20], [-120, -80], [-60, -40], [-10, -90], [50, -60]], [[-150, 40], [-100, 0], [-50, 50], [0, 10], [60, 40]], [[20, -100], [70, -50], [120, -90], [170, -40]], [[-60, 100], [-10, 60], [50, 100], [110, 60], [160, 80]], [[100, 0], [140, 30], [175, 0]]].forEach(pts => c.stroke(K.smooth(pts, false)));
  c.strokeStyle = 'rgba(184,208,232,.22)'; c.lineWidth = 6; c.beginPath(); c.moveTo(-120, -110); c.quadraticCurveTo(-20, -150, 90, -120); c.stroke();
  zones.forEach(z => { const pu = 1 + pulse * Math.sin(t * 5 + z.x) * 0.12, g = c.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r * pu); g.addColorStop(0, K.rgba(z.col || C.ice, 0.9)); g.addColorStop(1, K.rgba(z.col || C.ice, 0)); c.fillStyle = g; c.beginPath(); c.arc(z.x, z.y, z.r * pu, 0, TAU); c.fill(); });
  c.restore();
  if (rays > 0) for (let i = 0; i < 3; i++) { const q = clamp(rays * 1.3 - i * 0.2); K.arrow(c, 230, -70 + i * 50, 230 + 120 + i * 40, -70 + i * 50 - 90 + i * 60, { p: q, w: 10, head: 30, dash: [20, 16], bend: 0.18, col: C.pale }); }
  c.restore(); };
// 循环（习惯回路等）：K.cycle(c,x,y,r,['提示','行动','奖励'],{p 0..1 一圈进度/可超1, hot 高亮第几个, t, nodeR})
K.cycle = (c, x, y, r, labels, o = {}) => { const n = labels.length, { p = null, hot = -1, nodeR = 84 } = o, P0 = i => [x + Math.cos(i / n * TAU - Math.PI / 2) * r, y + Math.sin(i / n * TAU - Math.PI / 2) * r];
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU - Math.PI / 2 + (nodeR + 22) / r, a1 = (i + 1) / n * TAU - Math.PI / 2 - (nodeR + 22) / r, pts = []; for (let k = 0; k <= 18; k++) { const a = lerp(a0, a1, k / 18); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    const e = pts[18], pr = pts[16], ang = Math.atan2(e[1] - pr[1], e[0] - pr[0]); K.stroke(c, pts.slice(0, 17), { col: C.pale, lw: 14 }); c.save(); c.translate(e[0], e[1]); c.rotate(ang); const hp = K.poly([[22, 0], [-18, -26], [-18, 26]]); c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = C.line; c.stroke(hp); c.fillStyle = C.pale; c.fill(hp); c.restore(); }
  labels.forEach((lb, i) => { const [px, py] = P0(i); K.body(c, K.circle(px, py, nodeR), hot === i ? C.ice : C.cob, { box: [px - nodeR, py - nodeR, px + nodeR, py + nodeR], seed: 120 + i, n: 8, dx: -10, lw: 8 }); K.text(c, lb, px, py + 2, { size: 60, col: hot === i ? C.line : C.ice, sw: hot === i ? 0 : 0.14, maxW: nodeR * 1.7 }); });
  if (p != null) { const a = ((p % 1 + 1) % 1) * TAU - Math.PI / 2, q = [x + Math.cos(a) * r, y + Math.sin(a) * r]; K.cup(c, q[0], q[1] + 34, { s: 0.22, steam: 0.5, t: o.t || 0, halo: true, float: 10 }); } };
// 时间轴：K.timeline(c, x0, x1, y, {events:[{p,label,hot}], prog 0..1 已走过的亮段, t}) → X(p)
K.timeline = (c, x0, x1, y, o = {}) => { const { events = [], prog = 1 } = o, X = q => lerp(x0, x1, q);
  c.save(); c.lineCap = 'round'; c.strokeStyle = C.line; c.lineWidth = 22; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 30, y); c.stroke(); c.strokeStyle = C.cob; c.lineWidth = 12; c.stroke();
  c.strokeStyle = C.pale; c.lineWidth = 12; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(X(prog), y); c.stroke(); K.arrow(c, x1 - 10, y, x1 + 50, y, { w: 12, head: 36, col: C.cob });
  events.forEach((e, i) => { const px = X(e.p), up = i % 2 === 0, on = e.p <= prog + 1e-6, pp = on ? 1 : 0.55; c.save(); c.globalAlpha *= pp; K.body(c, K.circle(px, y, e.hot ? 26 : 18), e.hot ? C.ice : C.pale, { box: [px - 20, y - 20, px + 20, y + 20], seed: 130 + i, n: 0, lw: 7 });
    if (e.label) { c.strokeStyle = C.line; c.lineWidth = 6; c.beginPath(); c.moveTo(px, y + (up ? -26 : 26)); c.lineTo(px, y + (up ? -74 : 74)); c.stroke(); K.tag(c, e.label, px, y + (up ? -110 : 110), { fill: e.hot ? 'ice' : 'dark' }); } c.restore(); });
  c.restore(); return X; };
// 示意柱：K.bars(c, x, y, w, h, vals(0..1), {hot 第几根亮, labels, p 生长, mark})  (x,y)=左下角
K.bars = (c, x, y, w, h, vals, o = {}) => { const n = vals.length, bw = w / n * 0.62, gap = w / n, { hot = -1, labels = null, p = 1, mark = true } = o;
  c.save(); c.strokeStyle = C.line; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 20, y + 6); c.lineTo(x + w + 20, y + 6); c.stroke(); c.strokeStyle = C.cer; c.lineWidth = 5; c.stroke();
  vals.forEach((v, i) => { const bh = Math.max(6, h * v * K.ease(clamp(p * 1.3 - i * 0.08))), bx = x + i * gap + (gap - bw) / 2; K.body(c, K.round(bx, y - bh, bw, bh, 14), hot === i ? C.ice : C.cob, { box: [bx, y - bh, bx + bw, y], seed: 140 + i, n: 6, dx: -10, lw: 7 });
    if (labels && labels[i]) K.text(c, labels[i], bx + bw / 2, y + 56, { size: 52, maxW: gap * 0.95, fam: 'PuHui-Heavy' }); });
  if (mark) K.mark(c, x + w - 60, y - h - 36); c.restore(); };
// 对话泡/思考泡：K.bubble(c, x, y, w, h, text, {kind 'speech'|'thought', tx,ty 尾尖, size≥52, fill})
K.bubble = (c, x, y, w, h, text, o = {}) => { const { kind = 'speech', tx = x - 60, ty = y + h / 2 + 120, size = 56, fill = 'ice' } = o, lines = Array.isArray(text) ? text : [text];
  c.save(); c.translate(x, y); const bubble = new Path2D(); bubble.roundRect(-w / 2, -h / 2, w, h, kind === 'thought' ? h / 2 : 34);
  if (kind === 'speech') { const bx = clamp(tx - x, -w / 2 + 70, w / 2 - 70); bubble.moveTo(bx - 34, h / 2 - 4); bubble.lineTo(tx - x, ty - y); bubble.lineTo(bx + 34, h / 2 - 4); bubble.closePath(); }
  c.save(); c.translate(9, 12); c.fillStyle = 'rgba(6,14,34,.6)'; c.fill(bubble); c.restore(); c.fillStyle = PLATE[fill][0]; c.fill(bubble); c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = C.line; c.stroke(bubble);
  if (kind === 'thought') [[0.3, 1.0, 22], [0.55, 1.4, 14], [0.75, 1.8, 9]].forEach(([q, k, r]) => { const px = lerp(0, tx - x, q), py = lerp(h / 2 + 10, ty - y, q); c.fillStyle = PLATE[fill][0]; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill(); c.stroke(); });
  c.fillStyle = PLATE[fill][1]; c.font = `${size}px "PuHui-Heavy"`; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach((ln, i) => c.fillText(ln, 0, (i - (lines.length - 1) / 2) * size * 1.3 + 3, w - 50)); c.restore(); };
// 开关（默认值）：K.toggle(c, x, y, {on, k 0..1 开合进度, s, label})
K.toggle = (c, x, y, o = {}) => { const { s = 1, k = o.on ? 1 : 0 } = o, e = K.ease(k); c.save(); c.translate(x, y); c.scale(s, s);
  K.body(c, K.round(-120, -60, 240, 120, 60), K.mix(C.prus, C.cer, e), { box: [-120, -60, 120, 60], seed: 150, n: 6, lw: 8 }); K.body(c, K.circle(lerp(-60, 60, e), 0, 46), C.ice, { box: [-46, -46, 46, 46], seed: 151, n: 0, lw: 7 }); c.restore(); };
// 示意板（深蓝底浅边，放图表/概念）
K.panel = (c, x, y, w, h, o = {}) => { c.save(); c.translate(x, y); c.translate(9, 12); c.fillStyle = 'rgba(6,14,34,.55)'; c.fill(K.round(-w / 2, -h / 2, w, h, 26)); c.translate(-9, -12);
  K.body(c, K.round(-w / 2, -h / 2, w, h, 26), o.fill || C.navy, { box: [-w / 2, -h / 2, w / 2, h / 2], seed: 160, n: 10, lw: 7 }); c.strokeStyle = K.rgba(C.pale, 0.55); c.lineWidth = 4; c.stroke(K.round(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 18)); c.restore(); };

// ---------- 章节卡 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
K.CARD_KINDS = [{ kind: 'room' }, { kind: 'night' }, { kind: 'dawn' }, { kind: 'bright' }, { kind: 'street' }];
// 章节卡贯穿物：杯子沿进度轨走到本站；章作者可在 props.js 里覆盖 K.cardToken = (c,x,y,lt,t,walking,arriveAt,o) => {…}
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking, arriveAt, o = {}) => { const hop = walking ? -Math.abs(Math.sin(lt * 9)) * 26 : -Math.max(0, 1 - (lt - arriveAt) * 4) * 10;
  K.cup(c, x, y + hop, { s: 0.46, t, steam: walking ? 0.3 : 0.8, float: 18, halo: true, amber: o.hope ? 1 : 0, shadow: true }); });
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), hope = o.hope ?? (n === N && N > 2), kd = hope ? { kind: 'dawn', hope: true } : K.CARD_KINDS[(n - 1) % K.CARD_KINDS.length];
  K.bg(c, t, { ...kd, hz: 1130, seed: n });
  if (kd.kind === 'street') { /* 街景自带楼群 */ } else if (kd.kind !== 'bright') K.window(c, 540, 900, 330, 280, { kind: kd.kind === 'night' ? 'night' : 'dawn', hope, t, curtain: false, beam: hope });
  const x0 = 190, x1 = 890, y = 1270, X = i => lerp(x0, x1, N > 1 ? i / (N - 1) : 0);
  K.groove(c, 'line', { x: 540, y, w: x1 - x0 + 80, wd: 44, flow: false, ends: false, t });
  const walkEnd = 1.15, q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 70, tx = lerp(from, done, q);
  c.strokeStyle = hope ? C.amber : C.pale; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(Math.max(x0 - 20, tx), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.45) : 1, r = cur ? 19 * Math.max(0.6, pp) : 10; K.body(c, K.circle(X(i), y, r), cur ? (hope ? C.amber : C.ice) : past ? C.pale : C.cob, { box: [X(i) - r, y - r, X(i) + r, y + r], seed: i, n: 0, lw: 5 }); }
  if (lt > walkEnd) K.rings(c, done, y, 30, lt, walkEnd, { lw: 6, col: hope ? C.amber : C.pale });
  K.cardToken(c, tx, y - 18, lt, t, lt < walkEnd, walkEnd, { hope });
  const s0 = K.pop(lt, 0.1, 0.4); if (s0 > 0) K.tag(c, `第 ${n} 章`, 540, 250, { size: 64, fam: 'PuHui-Black', fill: hope ? 'amber' : 'dark', scale: s0, rot: -0.03 });
  const lines = K.split2(title), all = lines.reduce((a, l) => a + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 112 : 124;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) { const sc = K.ease(K.at(lt, 0.45 + i * 0.2, 0.3)); K.title(c, a.slice(0, k).join(''), 540, 450 + i * 190, { size, fill: hope ? 'amber' : 'ice', scale: 0.92 + 0.08 * sc, w: Math.max(size * 3, [...ln].length * size + size * 0.9), maxW: 990, rot: i ? 0.012 : -0.012 }); } });
  K.finish(c);
};

// ---------- 字幕（assemble 生成的 subs.js 调它）：深底板＋冰白字，字幕带 y≈1480，让开视频号底栏 ----------
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(8,20,46,.96)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.strokeStyle = 'rgba(112,153,198,.7)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#E6F0FA'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
