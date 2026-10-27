// 画风套件 pop（配方 huashu-art-motion 13_pop「1962 波普：利希滕斯坦漫画格＋沃霍尔」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：一切形状 = 粗黑描边（ink，6–9px）＋ 平涂；体块/阴影靠「本戴点」（45° 网点，createPattern，图案对齐屏幕坐标）和黑斜线 hatch；
//       四色（红黄蓝＋白）＋黑，色板不外加；大字是「描边大字＋硬投影」，整句话交给字幕，屏上字 ≤ 8 字；
//       版面 = 漫画分格 D.panel（轻微歪斜的黑框）＋爆炸框 D.burst＋对话/想法气泡；人只出「手」和「剪影」，不画脸；
//       贯穿物 = 硬币 D.coin（正/反翻转，正面黄底红字）；严肃章（爆仓/亏损）传 {dark:true} 切到 C.dark 降饱和色板；
//       环境层 12fps 抖（D.jit），其余确定性；所有随机走 U.hash / U.rng。字体只用引擎自带 PuHui-Black/Heavy/Bold，不依赖外网字体。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：pop 的回弹起步段会让「r - 线宽」之类算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__pop) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__pop = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__pop) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__pop = 1; } }

// ---------- 色板 ----------
const C = D.C = {
  ink: '#141414', paper: '#f3eedb', white: '#fbf8ee',
  red: '#d8232a', redD: '#a8161c', blue: '#2f5cc8', blueD: '#1f3f96', yellow: '#f7d52c', goldD: '#d9a514',
  dotRed: '#e2483c', skin: '#fae0cc', sub: '#6b6657',
};
// 严肃章（爆仓/亏损）：同一套键，降饱和＋压暗，黄变旧铜、白变灰纸。函数里传 {dark:true} 即用它。
C.dark = {
  ink: '#101010', paper: '#cfc9b4', white: '#d9d4c2',
  red: '#8e2f2f', redD: '#5e1c1c', blue: '#3a4a74', blueD: '#26324f', yellow: '#b79b3f', goldD: '#8a7430',
  dotRed: '#8a4a42', skin: '#c9b8a2', sub: '#6b6657',
};
const pl = o => (o && o.dark) ? C.dark : C;
D.pal = dark => dark ? C.dark : C;

// ---------- 进度 / 缓存 / 相机 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
D.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
// 12fps 抖动：D.jit(lt, seed, amp) → [-amp, amp]（同一 lt 同一值；环境/爆炸框用）
D.jit = (lt, seed = 1, amp = 3) => (U.hash(Math.floor(lt * 12), seed) - 0.5) * 2 * amp;

// ---------- 基础：路径 / 描边 / 本戴点 / 斜线 ----------
D.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
// 粗黑描边平涂：fill 可为颜色或 pattern；lw=0 只填不描
D.ink = (c, p, fill, lw = 7, col) => { if (fill) { c.fillStyle = fill; c.fill(p); } if (lw > 0) { c.strokeStyle = col || C.ink; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); } };
// 本戴点：45° 网格，pitch 点距、r 点半径、col 点色、bg 底色（缺省透明）。返回 pattern（tile 全局缓存，图案对齐屏幕坐标）
D.dots = (c, pitch, r, col, bg) => {
  const tile = P.cached(`pop_tile_${pitch}_${r}_${col}_${bg || ''}`, pitch, pitch, g => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, pitch, pitch); } g.fillStyle = col;
    [[0, 0], [pitch, 0], [0, pitch], [pitch, pitch], [pitch / 2, pitch / 2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); });
  return c.createPattern(tile, 'repeat');
};
// 用点填一条路径（先可选底色，再点）：D.dotFill(c, path, '#fff', {pitch, r, col, alpha})
D.dotFill = (c, p, bg, o = {}) => { const { pitch = 14, r = 3.2, col = C.dotRed, alpha = 1 } = o; c.save(); c.clip(p); if (bg) { c.fillStyle = bg; c.fillRect(0, 0, W, H); } c.globalAlpha *= alpha; c.fillStyle = D.dots(c, pitch, r, col); c.fillRect(0, 0, W, H); c.restore(); };
// 黑斜线阴影（矩形区域内）
D.hatch = (c, x0, y0, x1, y1, gap = 12, w = 3.5) => { c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  c.strokeStyle = C.ink; c.lineWidth = w; c.beginPath(); for (let x = x0 - (y1 - y0); x < x1; x += gap) { c.moveTo(x, y1); c.lineTo(x + (y1 - y0), y0); } c.stroke(); c.restore(); };
// 爆炸框路径：n 个尖，外半径 r1、内半径 r2，jit 随机起伏（seed 决定，确定性）
D.burst = (cx, cy, r1, r2, n = 14, rot = 0, jit = 0.1, seed = 1) => D.poly(Array.from({ length: n * 2 }, (_, i) => {
  const r = (i % 2 ? r2 : r1) * (1 + jit * (U.hash(i, seed) - 0.5)), a = rot + i / (n * 2) * TAU; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }));
// 画好的爆炸框：外白内黄＋硬投影；s 缩放（配 D.pop）；shake 抖动幅度；返回内框中心。内部放字用 D.bigText
D.burstBox = (c, x, y, r, o = {}) => { const { n = 14, rot = 0.1, seed = 4, fill = C.white, inner = C.yellow, s = 1, shake = 0, lt = 0, dark } = o, p = pl(o);
  if (s <= 0) return; const sh = shake ? D.jit(lt, seed, shake) : 0, sh2 = shake ? D.jit(lt, seed + 5, shake * 0.7) : 0, bx = x + sh, by = y + sh2, R = r * s;
  D.ink(c, D.burst(bx + 12, by + 14, R, R * 0.82, n, rot, 0.1, seed), p.ink, 1);
  D.ink(c, D.burst(bx, by, R, R * 0.82, n, rot, 0.1, seed), o.fill || p.white, 8);
  if (inner) D.ink(c, D.burst(bx, by, R * 0.8, R * 0.67, n, rot + 0.05, 0.1, seed + 5), o.inner || p.yellow, 6); };
// 放射动作线（黑三角，从中心向外）：D.speedLines(c, cx, cy, r0, r1, n, lt, seed)
D.speedLines = (c, cx, cy, r0, r1, n = 10, lt = 0, seed = 1, col) => { c.fillStyle = col || C.ink;
  for (let i = 0; i < n; i++) { const a = i / n * TAU + U.hash(i, seed) * 0.3, len = (r1 - r0) * (0.85 + 0.25 * Math.sin(lt * 40 + i * 2)), w = 0.07;
    c.beginPath(); c.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); c.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); c.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); c.closePath(); c.fill(); } };

// ---------- 底 / 收尾 ----------
const grainTex = () => P.grain('pop', 0.035, [60, 50, 30], 0.1);
// o: { kind 'dots'|'rays'|'solid'|'paper', tint 'blue'|'red'|'yellow'|'white', bold（dots 时蓝/红实底配白点）, ox, oy（rays 中心）, spin, dark, frame（外框黑边宽）}
D.bg = (c, t, o = {}) => {
  const { kind = 'dots', tint = 'blue', bold = false, ox = 400, oy = 620, spin = 0.2, frame = 0 } = o, p = pl(o), col = { blue: p.blue, red: p.red, yellow: p.yellow, white: p.white }[tint] || p.blue;
  c.fillStyle = p.paper; c.fillRect(0, 0, W, H);
  if (kind === 'paper') { c.fillStyle = D.dots(c, 22, 2.6, o.dark ? '#b3ad98' : '#e3d9b4'); c.fillRect(0, 0, W, H); }
  else if (kind === 'dots') {
    if (bold) { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = D.dots(c, 24, 5.4, p.white); c.globalAlpha = 0.9; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    else { c.fillStyle = p.white; c.fillRect(0, 0, W, H); c.fillStyle = D.dots(c, 24, 5.6, col); c.fillRect(0, 0, W, H); } }
  else if (kind === 'solid') { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = D.dots(c, 16, 2.6, tint === 'yellow' ? p.goldD : p.ink); c.globalAlpha = 0.16; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  else if (kind === 'rays') {
    const n = 20, rot = t * spin, a2 = tint === 'yellow' || tint === 'white' ? p.white : p.yellow;
    c.fillStyle = tint === 'blue' ? p.blue : tint === 'red' ? p.red : p.yellow; c.fillRect(0, 0, W, H); c.fillStyle = a2;
    for (let i = 0; i < n; i += 2) { const a0 = rot + i / n * TAU, a1 = a0 + TAU / n; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a0) * 2600, oy + Math.sin(a0) * 2600); c.lineTo(ox + Math.cos(a1) * 2600, oy + Math.sin(a1) * 2600); c.closePath(); c.fill(); }
    c.fillStyle = D.dots(c, 24, 5, p.blue); c.globalAlpha = 0.35; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  if (o.dark) { c.fillStyle = 'rgba(16,16,16,.18)'; c.fillRect(0, 0, W, H); }
  if (frame) { c.strokeStyle = p.ink; c.lineWidth = frame * 2; c.strokeRect(0, 0, W, H); }
};
// 每镜收尾：纸面颗粒＋字幕带 y1380–1560 压暗（网点＋黑渐变，不放内容）。o.dark 同 bg
D.finish = (c, o = {}) => {
  c.drawImage(grainTex(), 0, 0);
  const b = c.createLinearGradient(0, 1360, 0, 1600); b.addColorStop(0, 'rgba(20,20,20,0)'); b.addColorStop(0.3, 'rgba(20,20,20,.5)'); b.addColorStop(0.7, 'rgba(20,20,20,.5)'); b.addColorStop(1, 'rgba(20,20,20,0)');
  c.fillStyle = b; c.fillRect(0, 1360, W, 240);
  c.save(); c.beginPath(); c.rect(0, 1380, W, 180); c.clip(); c.globalAlpha = 0.5; c.fillStyle = D.dots(c, 14, 2.6, '#000'); c.fillRect(0, 1380, W, 180); c.restore();
};

// ---------- 文字 ----------
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot }
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
// 描边大字（黑边＋硬投影）：o { fam, lw, shadow, rot, scale, alpha, maxW, stroke }
D.bigText = (c, s, x, y, size, fill = C.red, o = {}) => { const { fam = 'PuHui-Black', lw = size * 0.14, shadow = true, rot = 0, scale = 1, alpha = 1, maxW = 0, stroke = C.ink } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2; c.strokeStyle = stroke; c.lineWidth = lw;
  if (shadow) { c.fillStyle = stroke; c.strokeText(s, size * 0.05, size * 0.06); c.fillText(s, size * 0.05, size * 0.06); }
  c.strokeText(s, 0, 0); c.fillStyle = fill; c.fillText(s, 0, 0); c.restore(); };
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标签牌（tag）：略歪的方牌＋黑边＋硬投影。返回宽度。o { size, fam, fill, col, scale, alpha, rot, padX, dark }
D.tag = (c, s, x, y, o = {}) => { const p = pl(o), { size = 50, fam = 'PuHui-Heavy', fill = p.white, col = p.ink, scale = 1, alpha = 1, rot = 0, padX = 0.6 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.5, sk = size * 0.06;
  const q = D.poly([[-w / 2, -h / 2], [w / 2, -h / 2 - sk], [w / 2, h / 2], [-w / 2, h / 2 + sk]]);
  c.save(); c.translate(7, 8); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, fill, 6, p.ink);
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
// 弹出大字（backOut 过冲）：o.plate 为 true 用 tag 牌，否则描边大字。o { size, fill, dur, alpha, rot, ... }
D.popText = (c, s, x, y, lt, at, o = {}) => { const k = D.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha ?? 1), p = pl(o);
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else D.bigText(c, s, x, y, o.size || 96, o.fill || p.red, { ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：黑粗线先画出来（圆头），末端 tag 牌逐字打出（约 20 字/秒）
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p = pl(o), { fill = p.yellow, col = p.ink, size = 48 } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = p.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = p.ink; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.2, h = size * 1.5; c.translate(bx, by); c.scale(q, q);
  c.save(); c.translate(7, 8); D.ink(c, D.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]), p.ink, 1); c.restore();
  D.ink(c, D.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]), fill, 6, p.ink);
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.6, 3); c.restore(); };

// ---------- 分格 / 气泡 ----------
// 漫画格：略歪的四边形黑框。D.panel(c, x, y, w, h, o, fn)：o { fill 颜色, dots {pitch,r,col}, skew 歪斜像素, lw, scale/alpha（配 pop，以格中心缩放）, dark }；fn(c) 在 clip 里画内容（局部仍用屏幕坐标）。返回 Path2D
D.panel = (c, x, y, w, h, o = {}, fn) => { const p = pl(o), { skew = 14, lw = 9, scale = 1, alpha = 1, shadow = true } = o; if (scale <= 0) return null;
  const q = D.poly([[x, y], [x + w, y + skew * 0.4], [x + w, y + h], [x, y + h - skew]]);
  c.save(); c.globalAlpha *= alpha; c.translate(x + w / 2, y + h / 2); c.scale(scale, scale); c.translate(-x - w / 2, -y - h / 2);
  if (shadow) { c.save(); c.translate(12, 14); D.ink(c, q, p.ink, 1); c.restore(); }
  c.save(); c.clip(q); c.fillStyle = o.fill || p.white; c.fillRect(x - 20, y - 20, w + 40, h + 40);
  if (o.dots) { c.fillStyle = D.dots(c, o.dots.pitch || 24, o.dots.r || 5.4, o.dots.col || p.blue); c.fillRect(x - 20, y - 20, w + 40, h + 40); }
  if (fn) fn(c, q); c.restore(); D.ink(c, q, null, lw, p.ink); c.restore(); return q; };
// 对话/想法气泡。D.speech(c, x, y, w, h, s, o)：(x,y) 中心；s 可含 \n；o { tail:[tx,ty] 尾巴指向, think 想法泡（小圆点串）, size, lt, at（弹出时刻）, fill, col, dark }
D.speech = (c, x, y, w, h, s, o = {}) => { const p = pl(o), { tail, think = false, size = 44, lt = 99, at = 0, fill = p.white, col = p.ink } = o, k = lt >= 99 ? 1 : D.pop(lt, at, 0.4); if (k <= 0) return;
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
  const body = think ? (() => { const q = new Path2D(); const n = 11; for (let i = 0; i < n; i++) { const a = i / n * TAU; q.moveTo(x + Math.cos(a) * w * 0.38 + w * 0.1, y + Math.sin(a) * h * 0.38 + h * 0.1); q.arc(x + Math.cos(a) * w * 0.4, y + Math.sin(a) * h * 0.4, Math.min(w, h) * 0.2, 0, TAU); }
    q.ellipse(x, y, w * 0.42, h * 0.42, 0, 0, TAU); return q; })() : D.round(x - w / 2, y - h / 2, w, h, Math.min(h / 2, 60));
  const tl = new Path2D();
  if (tail) { const [tx, ty] = tail; if (think) { [[0.35, 14], [0.62, 10], [0.84, 7]].forEach(([f, r]) => { tl.moveTo(lerp(x, tx, f) + r, lerp(y + h * 0.4, ty, f)); tl.arc(lerp(x, tx, f), lerp(y + h * 0.4, ty, f), r, 0, TAU); }); }
    else { const bx = clamp(lerp(x, tx, 0.3), x - w * 0.4, x + w * 0.4), by = y + (ty > y ? h / 2 - 4 : -h / 2 + 4), sg = ty > y ? 1 : -1; tl.moveTo(bx - 26, by); tl.lineTo(tx, ty); tl.lineTo(bx + 26, by - sg * 2); tl.closePath(); } }
  c.strokeStyle = p.ink; c.lineJoin = 'round'; c.lineWidth = 14; c.stroke(body); c.stroke(tl); c.fillStyle = fill; c.fill(body); c.fill(tl);
  const lines = String(s).split('\n'); lines.forEach((ln, i) => D.text(c, ln, x, y + (i - (lines.length - 1) / 2) * size * 1.22, { size, fam: 'PuHui-Heavy', col, maxW: w - 50 }));
  c.restore(); };

// ---------- 硬币（贯穿物） ----------
// D.coin(c, x, y, r, a, o)：a = 翻转角（弧度，cos(a)>0 看正面 faces[0]、<0 看反面 faces[1]）；o { faces:['正','反'], rot, dark }
D.coin = (c, cx, cy, r, a = 0, o = {}) => { const p = pl(o), faces = o.faces || ['正', '反'], cs = Math.cos(a), s = Math.max(0.08, Math.abs(cs)), face = cs >= 0 ? faces[0] : faces[1];
  c.save(); c.translate(cx, cy); if (o.rot) c.rotate(o.rot);
  if (o.shadow !== false) { c.fillStyle = p.ink; c.beginPath(); c.ellipse(r * 0.13, r * 0.16, r * s, r, 0, 0, TAU); c.fill(); }
  c.scale(s, 1); const body = D.circle(0, 0, r);
  D.ink(c, body, p.yellow, 7 / Math.max(s, 0.5));
  c.save(); c.clip(body); c.fillStyle = D.dots(c, 13, 3.3, p.dotRed); c.beginPath(); c.arc(-r * 0.55, r * 0.55, r * 1.0, 0, TAU); c.arc(0, 0, r * 0.9, 0, TAU, true); c.fill('evenodd'); c.restore();
  c.strokeStyle = p.ink; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, r * 0.78, 0, TAU); c.stroke();
  if (s > 0.3) D.bigText(c, face, 0, r * 0.04, r * 1.0, cs >= 0 ? p.red : p.blue, { lw: r * 0.1, shadow: false });
  c.strokeStyle = p.white; c.lineCap = 'round'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 1.1, Math.PI * 1.38); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 1.46, Math.PI * 1.52); c.stroke();
  c.restore(); };
// 自动翻转的硬币：D.coinFlip(c, x, y, r, lt, o)：o { rate 每秒圈数(1.2), at 起翻时刻, toss 抛起高度(0), land 停在哪面 0正/1反（到 at+dur 后落定）, dur, faces, dark }
D.coinFlip = (c, x, y, r, lt, o = {}) => { const { rate = 1.2, at = 0, toss = 0, land = null, dur = 1.6 } = o, u = Math.max(0, lt - at); let a = u * rate * TAU, yy = y;
  if (toss) { const q = clamp(u / dur); yy = y - Math.sin(q * Math.PI) * toss; }
  if (land != null && u >= dur) a = land * Math.PI; else if (land != null) { const fin = Math.round(dur * rate) * TAU + land * Math.PI; a = fin * D.ease(u / dur); }
  D.coin(c, x, yy, r, a, o); return a; };
// 硬币堆：n 枚（可小数），底在 y0，宽 w，每枚厚 th。返回顶面 y
D.stack = (c, x, y0, w, n, th = 15, o = {}) => { const p = pl(o), rx = w / 2, ry = w * 0.17; if (n <= 0.001) return y0;
  for (let k = 0; k < Math.ceil(n); k++) { const f = Math.min(1, n - k), yb = y0 - k * th, h = th * f;
    const q = new Path2D(); q.moveTo(x - rx, yb); q.lineTo(x - rx, yb - h); q.ellipse(x, yb - h, rx, ry, 0, Math.PI, 0, true); q.lineTo(x + rx, yb); q.ellipse(x, yb, rx, ry, 0, 0, Math.PI); q.closePath();
    D.ink(c, q, k % 2 ? p.yellow : (o.dark ? '#c7ad55' : '#ffe45a'), 3.5);
    c.strokeStyle = p.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + rx * 0.45, yb + ry * 0.9); c.lineTo(x + rx * 0.45, yb - h + ry * 0.9); c.stroke(); }
  const top = y0 - n * th, e = D.ellipse(x, top, rx, ry); D.ink(c, e, p.yellow, 4);
  c.save(); c.clip(e); c.fillStyle = D.dots(c, 13, 3.3, p.dotRed); c.fillRect(x - rx, top - ry, rx, ry * 2); c.restore();
  c.strokeStyle = p.white; c.lineWidth = 4; c.beginPath(); c.ellipse(x, top, rx * 0.6, ry * 0.6, 0, Math.PI * 1.1, Math.PI * 1.5); c.stroke(); return top; };
// 硬币柱状图：vals 为每柱硬币数；prog 0..1 逐柱长出。返回各柱顶点 [[x,y],…]
D.coinBars = (c, vals, x0, y0, gap, w, lt, at = 0, o = {}) => vals.map((v, i) => { const g = D.ease((lt - at - i * 0.13) / 0.7), top = D.stack(c, x0 + i * gap, y0, w, Math.max(0.001, v * g), o.th || 14, o); return [x0 + i * gap, top - 14]; });
// 平涂柱状图：vals 0..1（相对 h）；cols 每柱颜色（缺省红蓝黄轮换）；prog 0..1 总生长；labels 底部小字。返回各柱顶 [[x,y],…]
D.bars = (c, vals, x, y0, w, h, o = {}) => { const p = pl(o), { gap = 18, prog = 1, cols, labels, lw = 7 } = o, n = vals.length, bw = (w - gap * (n - 1)) / n, cs = cols || [p.red, p.blue, p.yellow], tops = [];
  vals.forEach((v, i) => { const g = D.ease(clamp(prog * (1 + 0.5 * (n - 1) / n) - i * 0.5 / n)), bh = Math.max(0, h * v * g), bx = x + i * (bw + gap), q = D.poly([[bx, y0], [bx, y0 - bh], [bx + bw, y0 - bh], [bx + bw, y0]]);
    if (bh > 2) { D.ink(c, q, cs[i % cs.length], lw, p.ink); c.save(); c.clip(q); c.fillStyle = D.dots(c, 13, 3.2, p.ink); c.globalAlpha = 0.28; c.fillRect(bx + bw * 0.55, y0 - bh, bw * 0.45, bh); c.globalAlpha = 1; c.restore(); }
    if (labels && labels[i]) D.text(c, labels[i], bx + bw / 2, y0 + 36, { size: 34, fam: 'PuHui-Heavy', col: p.ink, maxW: bw + gap });
    tops.push([bx + bw / 2, y0 - bh]); });
  c.strokeStyle = p.ink; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 16, y0 + 4); c.lineTo(x + w + 16, y0 + 4); c.stroke(); return tops; };

// ---------- 曲线 / 箭头 ----------
// 确定性序列：D.series(n, seed, { trend 总漂移(+上升 -下跌), vol 波动 }) → 0..1 的 n 个值（起点 0.5 附近）
D.series = (n, seed = 1, o = {}) => { const { trend = 0.5, vol = 0.12 } = o, r = U.rng(seed * 977 + 13); let v = 0.5 - trend / 2; const a = []; for (let i = 0; i < n; i++) { a.push(v); v += trend / (n - 1) + (r() - 0.5) * vol; } const mn = Math.min(...a), mx = Math.max(...a); return a.map(x => (x - mn) / (mx - mn || 1)); };
// 值 → 屏幕点：D.mapPts(vals, x, y, w, h)  (值 1 在顶)
D.mapPts = (vals, x, y, w, h) => vals.map((v, i) => [x + w * i / Math.max(1, vals.length - 1), y + h * (1 - v)]);
// 粗曲线：D.line(c, pts, o)：o { prog 0..1 画到哪, dir 'up'(红)|'down'(蓝，深色章为暗红) 决定默认色, col, lw, arrow 箭头(true), dark }。返回笔尖 [x,y,角度]
D.line = (c, pts, o = {}) => { const p = pl(o), { prog = 1, lw = 9, arrow = true } = o, col = o.col || (o.dir === 'down' ? p.blue : p.red);
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const tot = L[L.length - 1], want = tot * clamp(prog); if (want <= 1) return null;
  const q = [pts[0]]; for (let i = 1; i < pts.length; i++) { if (L[i] <= want) q.push(pts[i]); else { const f = (want - L[i - 1]) / (L[i] - L[i - 1]); q.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
  const path = D.poly(q, false); c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = p.ink; c.lineWidth = lw + 10; c.stroke(path); c.strokeStyle = col; c.lineWidth = lw; c.stroke(path);
  const e = q[q.length - 1], f = q[Math.max(0, q.length - 2)], ang = Math.atan2(e[1] - f[1], e[0] - f[0]);
  if (arrow && q.length > 1) { c.translate(e[0], e[1]); c.rotate(ang); D.ink(c, D.poly([[34, 0], [-18, -30], [-6, 0], [-18, 30]]), col, 7, p.ink); } c.restore(); return [e[0], e[1], ang]; };
// 粗箭头（块状）：D.arrow(c, x0, y0, x1, y1, o)：o { col, w 杆宽, head 箭头大小, prog, dark }
D.arrow = (c, x0, y0, x1, y1, o = {}) => { const p = pl(o), { w = 34, head = 70, prog = 1 } = o, col = o.col || p.red, a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0) * clamp(prog); if (L < 4) return;
  c.save(); c.translate(x0, y0); c.rotate(a); const hd = Math.min(head, L);
  D.ink(c, D.poly([[0, -w / 2], [L - hd, -w / 2], [L - hd, -head * 0.62], [L, 0], [L - hd, head * 0.62], [L - hd, w / 2], [0, w / 2]]), col, 7, p.ink); c.restore(); };

// ---------- 人：只出手 / 剪影（不画脸） ----------
// 手：D.hand(c, x, y, s, o)：(x,y) 是手掌中心，袖子从左下方伸来。o { pose 'point'|'open'|'fist'|'pinch', rot 弧度, sleeve 袖色, flip -1 镜像, dark }
D.hand = (c, x, y, s = 1, o = {}) => { const p = pl(o), { pose = 'point', rot = 0, sleeve = p.blue, flip = 1 } = o;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * flip, s);
  D.ink(c, D.poly([[-330, -62], [-110, -78], [-100, 78], [-330, 96]]), sleeve, 8, p.ink);                 // 袖
  c.save(); c.clip(D.poly([[-330, -62], [-110, -78], [-100, 78], [-330, 96]])); c.fillStyle = D.dots(c, 16, 3.6, p.ink); c.globalAlpha = 0.3; c.fillRect(-330, 20, 230, 90); c.restore();
  D.ink(c, D.poly([[-125, -82], [-85, -84], [-85, 84], [-125, 86]]), p.white, 7, p.ink);               // 袖口
  const skin = (q) => { D.ink(c, q, p.skin, 7, p.ink); };
  const palm = D.round(-90, -60, 130, 120, 36); skin(palm);
  c.save(); c.clip(palm); c.fillStyle = D.dots(c, 12, 3, p.dotRed); c.fillRect(-90, 14, 130, 50); c.restore(); c.strokeStyle = p.ink; c.lineWidth = 7; c.stroke(palm);
  const finger = (x0, y0, len, wd, ang) => { c.save(); c.translate(x0, y0); c.rotate(ang); skin(D.round(0, -wd / 2, len, wd, wd / 2)); c.restore(); };
  if (pose === 'point') { finger(30, -34, 170, 36, 0); [[24, -2], [24, 28], [24, 54]].forEach(([fx, fy]) => finger(fx, fy - 8, 70, 30, 0)); finger(-52, -60, 90, 34, -0.7); }
  else if (pose === 'open') { [-46, -18, 10, 38].forEach((fy, i) => finger(30, fy, 150 - Math.abs(i - 1.2) * 12, 30, (i - 1.5) * 0.12)); finger(-30, -62, 100, 34, -0.9); }
  else if (pose === 'fist') { [-44, -14, 14, 42].forEach(fy => finger(24, fy - 4, 56, 30, 0)); finger(-60, -64, 84, 34, -0.3); }
  else if (pose === 'pinch') { finger(30, -26, 120, 32, 0.15); finger(30, 14, 120, 32, -0.15); [14, 40].forEach(fy => finger(24, fy, 60, 28, 0.1)); }
  c.restore(); };
// 剪影人：D.figure(c, x, y, s, o)：(x,y) 脚底中点，s=1 身高约 520；o { col 衣色, suit 画领带, pose 'stand'|'arms'(举臂)|'slump'(垂头), t, dark } 无五官
D.figure = (c, x, y, s = 1, o = {}) => { const p = pl(o), { col = p.ink, pose = 'stand', suit = true } = o, bob = o.t != null ? Math.sin(o.t * 2.4 + x) * 3 : 0;
  c.save(); c.translate(x, y + bob * 0); c.scale(s, s);
  const slump = pose === 'slump' ? 22 : 0;
  D.ink(c, D.poly([[-40, -2], [-40, -250], [-8, -250], [-4, -2]]), col, 7, p.ink); D.ink(c, D.poly([[8, -2], [4, -250], [40, -250], [40, -2]]), col, 7, p.ink);   // 腿
  D.ink(c, D.poly([[-58, -250], [-72, -440 + slump], [72, -440 + slump], [58, -250]]), col, 7, p.ink);                                                  // 躯干
  const arm = (sg) => { const up = pose === 'arms'; D.ink(c, up ? D.poly([[sg * 66, -430], [sg * 96, -440], [sg * 130, -560], [sg * 98, -566]]) : D.poly([[sg * 66, -430 + slump], [sg * 100, -420 + slump], [sg * 92, -270], [sg * 62, -272]]), col, 7, p.ink); };
  arm(-1); arm(1);
  D.ink(c, D.poly([[-12, -440 + slump], [12, -440 + slump], [12, -468 + slump], [-12, -468 + slump]]), p.skin, 6, p.ink);
  c.save(); c.translate(0, slump * 0.6); if (pose === 'slump') c.rotate(0.18); D.ink(c, D.ellipse(0, -505 + slump * 0.4, 34, 40), p.skin, 7, p.ink); c.restore();
  if (suit) { D.ink(c, D.poly([[-10, -440 + slump], [10, -440 + slump], [16, -330], [0, -300], [-16, -330]]), p.red, 5, p.ink); }
  c.save(); c.clip(D.poly([[-58, -250], [-72, -440 + slump], [72, -440 + slump], [58, -250]])); c.fillStyle = D.dots(c, 12, 3, p.white); c.globalAlpha = 0.35; c.fillRect(-80, -440 + slump, 52, 200); c.restore();
  c.restore(); };
// 人群剪影：n 个头肩，两行；seed 决定高低与衣色；lt 给 12fps 轻晃
D.crowd = (c, x, y, w, n = 8, o = {}) => { const p = pl(o), seed = o.seed || 1, cols = o.cols || [p.red, p.blue, p.yellow, p.ink, p.white];
  for (let row = 1; row >= 0; row--) for (let i = 0; i < n; i++) { const hx = x + (i + 0.5 + row * 0.5 - 0.25) * w / n, hy = y + row * -40 + (U.hash(i + row * 31, seed) - 0.5) * 24 + (o.lt != null ? D.jit(o.lt, i + row * 7, 2) : 0), r = w / n * 0.3, col = cols[Math.floor(U.hash(i + row * 17, seed + 3) * cols.length)];
    D.ink(c, D.poly([[hx - r * 1.7, hy + 200], [hx - r * 1.6, hy + r * 1.8], [hx + r * 1.6, hy + r * 1.8], [hx + r * 1.7, hy + 200]]), col, 6, p.ink); D.ink(c, D.circle(hx, hy, r), p.skin, 6, p.ink); } };

// ---------- 图标（锚点 x,y 为中心，s 缩放，o 同含 dark/lt） ----------
D.bill = (c, x, y, s = 1, o = {}) => { const p = pl(o); c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s);
  const q = D.round(-130, -70, 260, 140, 10); c.save(); c.translate(8, 9); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, p.white, 7, p.ink);
  c.save(); c.clip(q); c.fillStyle = D.dots(c, 14, 3, p.blue); c.fillRect(-130, -70, 260, 140); c.restore(); D.ink(c, D.round(-112, -52, 224, 104, 6), null, 4, p.ink);
  D.ink(c, D.circle(0, 0, 40), p.white, 6, p.ink); D.text(c, '元', 0, 3, { size: 50, col: p.red }); c.restore(); };
D.kline = (c, x, y, s = 1, o = {}) => { const p = pl(o), up = o.up !== false; c.save(); c.translate(x, y); c.scale(s, s);
  const q = D.round(-140, -110, 280, 220, 12); c.save(); c.translate(8, 9); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, p.white, 7, p.ink);
  const base = [0.2, 0.4, 0.3, 0.55, 0.45, 0.7, 0.62, 0.85]; base.forEach((v0, i) => { const v = up ? v0 : 1 - v0, bx = -104 + i * 30, top = 80 - v * 150 - 18, h = 36 + (U.hash(i, 5) * 20), col = (i % 3 === 1) === up ? p.blue : p.red;
    c.strokeStyle = p.ink; c.lineWidth = 5; c.beginPath(); c.moveTo(bx, top - 14); c.lineTo(bx, top + h + 14); c.stroke(); D.ink(c, D.poly([[bx - 11, top], [bx + 11, top], [bx + 11, top + h], [bx - 11, top + h]]), col, 4.5, p.ink); }); c.restore(); };
D.clock = (c, x, y, s = 1, o = {}) => { const p = pl(o), lt = o.lt || 0, rate = o.rate || 1; c.save(); c.translate(x, y); c.scale(s, s);
  D.ink(c, D.circle(8, 9, 100), p.ink, 1); D.ink(c, D.circle(0, 0, 100), p.white, 8, p.ink); c.save(); c.clip(D.circle(0, 0, 100)); c.fillStyle = D.dots(c, 12, 2.6, p.yellow); c.fillRect(-100, -100, 200, 200); c.restore(); D.ink(c, D.circle(0, 0, 100), null, 8, p.ink);
  c.strokeStyle = p.ink; c.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = i % 3 ? 4 : 8; c.beginPath(); c.moveTo(Math.sin(a) * 76, -Math.cos(a) * 76); c.lineTo(Math.sin(a) * 88, -Math.cos(a) * 88); c.stroke(); }
  const hand = (a, l, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * l, -Math.cos(a) * l); c.stroke(); }; hand(lt * rate * TAU / 12, 50, 11); hand(lt * rate * TAU, 76, 7);
  c.fillStyle = p.red; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.stroke(); c.restore(); };
D.gear = (c, x, y, s = 1, o = {}) => { const p = pl(o), rot = o.rot != null ? o.rot : (o.lt || 0) * 0.8, n = 10; c.save(); c.translate(x, y); c.scale(s, s); c.rotate(rot);
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, w = TAU / n * 0.22; [[-w * 1.6, 78], [-w, 104], [w, 104], [w * 1.6, 78]].forEach(([d, r]) => pts.push([Math.cos(a + d) * r, Math.sin(a + d) * r])); }
  const q = D.poly(pts); c.save(); c.translate(8, 9); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, o.fill || p.blue, 8, p.ink);
  c.save(); c.clip(q); c.fillStyle = D.dots(c, 13, 3, p.white); c.globalAlpha = 0.5; c.fillRect(-120, -120, 240, 240); c.restore(); D.ink(c, q, null, 8, p.ink); D.ink(c, D.circle(0, 0, 30), p.paper, 7, p.ink); c.restore(); };
D.magnifier = (c, x, y, s = 1, o = {}) => { const p = pl(o); c.save(); c.translate(x, y); c.rotate(o.rot ?? -0.3); c.scale(s, s);
  c.save(); c.translate(8, 9); D.ink(c, D.round(-20, 80, 40, 130, 14), p.ink, 1); c.restore(); D.ink(c, D.round(-20, 80, 40, 130, 14), p.red, 7, p.ink);
  D.ink(c, D.circle(0, 0, 90), p.white, 1); c.save(); c.clip(D.circle(0, 0, 80)); c.fillStyle = D.dots(c, 12, 3, p.blue); c.globalAlpha = 0.5; c.fillRect(-90, -90, 180, 180); c.globalAlpha = 1; c.restore();
  D.ink(c, D.circle(0, 0, 90), null, 16, p.ink); c.strokeStyle = p.yellow; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 90, 0, TAU); c.stroke();
  c.strokeStyle = p.white; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 58, Math.PI * 1.1, Math.PI * 1.4); c.stroke(); c.restore(); };
D.server = (c, x, y, s = 1, o = {}) => { const p = pl(o), lt = o.lt || 0; c.save(); c.translate(x, y); c.scale(s, s);
  for (let i = 0; i < 3; i++) { const yy = -112 + i * 76, q = D.round(-110, yy, 220, 64, 8); c.save(); c.translate(7, 8); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, i === 1 ? p.blue : p.white, 7, p.ink);
    c.save(); c.clip(q); c.fillStyle = D.dots(c, 12, 2.6, p.ink); c.globalAlpha = 0.18; c.fillRect(-110, yy, 220, 64); c.restore();
    for (let k = 0; k < 3; k++) { const on = Math.floor(lt * 4 + i * 3 + k) % 3 !== 0; D.ink(c, D.circle(-80 + k * 28, yy + 32, 8), on ? [p.red, p.yellow, p.white][k] : p.paper, 4, p.ink); }
    c.strokeStyle = p.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, yy + 32); c.lineTo(88, yy + 32); c.stroke(); } c.restore(); };
D.bolt = (c, x, y, s = 1, o = {}) => { const p = pl(o); c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s);
  const q = D.poly([[30, -130], [-60, 10], [-6, 10], [-34, 130], [64, -28], [8, -28], [44, -130]]); c.save(); c.translate(9, 10); D.ink(c, q, p.ink, 1); c.restore(); D.ink(c, q, o.fill || p.yellow, 8, p.ink);
  c.strokeStyle = p.white; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, -104); c.lineTo(-36, 0); c.stroke(); c.restore(); };
D.icons = { bill: D.bill, kline: D.kline, clock: D.clock, gear: D.gear, magnifier: D.magnifier, server: D.server, bolt: D.bolt };
D.icon = (name, c, x, y, s, o) => D.icons[name](c, x, y, s, o);
})();

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 放射黄/蓝底，爆炸框砸入「第 N 章」，章名逐字出在白牌里（长的拆两行）；下方 N 站硬币进度轨：贯穿硬币翻着滚到本站。
// 换书时可在本书 props.js 里改 D.cardToken = (c, x, y, lt, t, walking, arriveAt) => {…} 画本书的贯穿物。
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.CARD_KINDS = [{ kind: 'rays', tint: 'yellow' }, { kind: 'dots', tint: 'blue', bold: true }, { kind: 'rays', tint: 'blue' }, { kind: 'dots', tint: 'red', bold: true }];
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking, arriveAt, o) => D.coin(c, x, y - 4, 34, walking ? lt * 14 : Math.max(0, 1 - (lt - arriveAt) * 3) * 6, o));
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const p = D.pal(o.dark), k = D.CARD_KINDS[(n - 1) % D.CARD_KINDS.length];
  D.bg(c, t, { ...k, ox: 540, oy: 560, dark: o.dark });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, y = 1250, X = i => lerp(x0, x1, i / (N - 1));
  c.strokeStyle = p.ink; c.lineWidth = 26; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y); c.stroke(); c.strokeStyle = p.white; c.lineWidth = 12; c.stroke();
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  c.strokeStyle = p.yellow; c.lineWidth = 12; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(Math.max(x0 - 20, lerp(from, done, q)), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? D.pop(lt, walkEnd, 0.45) : 1; D.ink(c, D.circle(X(i), y, cur ? 22 * Math.max(0.6, pp) : 13), past ? p.yellow : cur ? p.red : p.white, 6, p.ink); }
  const tx = lerp(from, done, q), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 26 : 0; D.cardToken(c, tx, y - 62 + hop, lt, t, lt < walkEnd, walkEnd, o);
  if (lt > 0.08) { const s = MO.slamK((lt - 0.08) / 0.17); D.burstBox(c, W / 2, 560, 330, { n: 14, rot: 0.1, seed: 3 + n, s, shake: lt < 1.5 ? 4 : 0, lt, dark: o.dark }); D.bigText(c, `第 ${n} 章`, W / 2, 560, 118, p.red, { lw: 17, scale: s, rot: -0.04, maxW: 400 }); }
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 84 : all > 6 ? 100 : 120;
  if (lt > 0.45) { const bw = 940, bh = lines.length > 1 ? 280 : 180, by = lines.length > 1 ? 870 : 920, k2 = MO.slamK(clamp((lt - 0.45) / 0.17));
    c.save(); c.translate(W / 2, by + bh / 2); c.scale(k2, k2); c.translate(-W / 2, -(by + bh / 2)); c.save(); c.translate(12, 14); D.ink(c, D.poly([[70, by], [70 + bw, by - 8], [70 + bw, by + bh], [70, by + bh + 8]]), p.ink, 1); c.restore();
    D.ink(c, D.poly([[70, by], [70 + bw, by - 8], [70 + bw, by + bh], [70, by + bh + 8]]), p.white, 9, p.ink); c.restore();
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) D.text(c, a.slice(0, kk).join(''), W / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.2, { size, fam: 'PuHui-Black', maxW: 860, col: p.ink }); }); }
  D.finish(c, o);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：黑底板＋白字＋黄色硬投影，字幕带 y≈1480，让开视频号底栏
(() => { const D = K, C = D.C;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = C.yellow; c.beginPath(); c.roundRect(x - w / 2 + 7, y - h / 2 + 8, w, h, 10); c.fill();
  c.fillStyle = 'rgba(20,20,20,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 10); c.fill();
  c.fillStyle = '#fbf8ee'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
