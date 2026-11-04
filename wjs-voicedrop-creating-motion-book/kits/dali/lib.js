// 画风套件 dali（配方 huashu-art-motion 23_dali「达利超现实」，来自《买稀土这件事》）：竖屏 1080×1920，导出 window.K。
// 规矩：深蓝→暖金的天、固定 48% 处的地平线（K.HZ=922）、一条玻璃海、沙地向下由金黄渐变到棕；全片无勾线，体积靠「线性渐变＋内阴影」（K.vol）；
//       物体落在沙地上拖一条仿射剪切的长影子（K.shadow，太阳在左前低空，影子往右后方躺）；
//       母题：软化下垂（K.softClock/磁铁 melt）、拐杖撑物（K.crutch）、玻璃漏斗；贯穿物＝红色马蹄磁铁 K.magnet；
//       色克制：一镜只用磁铁红＋一个矿点色（青/金/粉）作强调，其余是沙和天。字＝奶白＋棕描边，不用蓝紫渐变、不用霓虹发光。
//       下三分之一沙地（y>1000）是留给字幕/数字/图表的：图表一律走 K.chart（沙板底）。随机一律种子化。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp, rng } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：负半径一律按 0 画（pop 回弹起步段会算出负半径，canvas 直接抛错）
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = { skyTop: '#24407F', skyMid: '#6B92C2', skyLow: '#E8C27A', sand1: '#D9A95F', sand2: '#B78850', sand3: '#6B4423',
  red: '#C0392B', redD: '#4A0505', redL: '#F08070', steel: '#C9CACF', steelD: '#6D7278', ore: '#4A3F36', oreEdge: '#2A2018',
  teal: '#6FC3B8', gold: '#E8B93A', pink: '#E0689A', cream: '#FFF3D6', brown: '#4A2A18', ink: '#2A1810', sea: '#8AA6B8', wood: '#B27A42', woodD: '#5A3418', slab: '#E9D09A', dn: '#2E7D6B' };
K.HZ = 922;                       // 地平线，固定约 48%
const HZ = K.HZ;
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K._t = 0; K._sil = false;
const ez = q => MO.cubicOut(clamp(q));
const poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
const smooth = (pts, closed = true) => { const p = new Path2D(), n = pts.length; if (n < 3) return poly(pts, closed);
  if (closed) { const m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]; const s = m(n - 1); p.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const e = m(i); p.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); } p.closePath(); }
  else { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); p.lineTo(pts[n - 1][0], pts[n - 1][1]); }
  return p; };
K.poly = poly; K.smooth = smooth;
const lighter = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.round(v + (255 - v) * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// ---------- 体积填色：线性渐变＋内阴影（全片无勾线，圆润感全靠它） ----------
// K.vol(c, path, x0,y0,x1,y1, a, b, occl, blur)；a 可传 [[pos,色],…] 多段渐变（此时 b 填 null）。K._sil 为真时（画影子）只填纯黑
K.vol = (c, path, x0, y0, x1, y1, a, b, occl = 'rgba(30,12,4,.45)', blur = 10) => {
  if (K._sil) { c.fillStyle = '#000'; c.fill(path); return; }
  c.save(); const g = c.createLinearGradient(x0, y0, x1, y1); if (Array.isArray(a)) a.forEach(([p, col]) => g.addColorStop(p, col)); else { g.addColorStop(0, a); g.addColorStop(1, b); }
  c.fillStyle = g; c.fill(path);
  if (blur > 0) { c.clip(path); c.filter = `blur(${blur}px)`; c.strokeStyle = occl; c.lineWidth = blur * 2; c.lineJoin = 'round'; c.stroke(path); }
  c.restore(); };
const flat = (c, path, col) => { c.fillStyle = K._sil ? '#000' : col; c.fill(path); };

// ---------- 长影子：仿射剪切，投在地平线以下 ----------
// K.shadow(c, fn, yg, {kx=.9, ky=.22, alpha=.5, blur=2})：fn(g) 里用 K.magnet/K.ore/K.icon… 画剪影（套件函数认 K._sil 自动画纯黑）；yg＝物体着地线。
// x′=x+kx·(yg−y)，y′=yg−ky·(yg−y)：kx>0 往右后方躺；每镜让 kx 从 .7 慢慢到 1.2 就是「影子在变长」。离屏合成，重叠处不加深
let SH = null;
K.shadow = (c, fn, yg, o = {}) => { const { kx = 0.9, ky = 0.22, alpha = 0.5, blur = 2, clipY = HZ + 4 } = o;
  SH = SH || P.canvas(W, H); const g = SH.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(-W, clipY, W * 3, H); g.clip(); g.transform(1, 0, -kx, ky, kx * yg, yg * (1 - ky));
  K._sil = true; try { fn(g); } finally { K._sil = false; } g.restore();
  c.save(); c.globalAlpha *= alpha; c.filter = blur ? `blur(${blur}px)` : 'none'; c.drawImage(SH, 0, 0); c.restore(); };
// 脚下的接触阴影
K.ground = (c, x, y, w, a = 0.35) => { if (K._sil) return; c.save(); const g = c.createRadialGradient(x, y, 2, x, y, w / 2); g.addColorStop(0, `rgba(40,20,8,${a})`); g.addColorStop(1, 'rgba(40,20,8,0)');
  c.translate(0, y); c.scale(1, 0.18); c.translate(0, -y); c.fillStyle = g; c.beginPath(); c.arc(x, y, w / 2, 0, TAU); c.fill(); c.restore(); };

// ---------- 天、海、沙：K.sky / K.sea / K.sand / K.mesa 可单独用；K.bg 把它们合成一张缓存 ----------
const MOODS = { dusk: ['#24407F', '#6B92C2', '#E8C27A'], dawn: ['#3F6399', '#C8A58C', '#F6DDA2'], tense: ['#1B2646', '#7A4538', '#DA8A3A'], night: ['#121C3C', '#3A4A78', '#C98F52'] };
K.MOODS = Object.keys(MOODS); K.moodFor = n => K.MOODS[(Math.max(1, n) - 1) % K.MOODS.length];
K.sky = (c, o = {}) => { const m = MOODS[o.mood || 'dusk'], hz = o.hz || HZ; const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, m[0]); g.addColorStop(.55, m[1]); g.addColorStop(1, m[2]); c.fillStyle = g; c.fillRect(0, 0, W, hz + 2);
  if (o.mood === 'night') { const r = rng(5); c.fillStyle = '#FFF3D6'; for (let i = 0; i < 46; i++) { c.globalAlpha = .25 + r() * .5; c.beginPath(); c.arc(r() * W, r() * 600, .8 + r() * 1.6, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  [[160, 250, 220, 7], [820, 180, 300, 6], [420, 540, 360, 5], [930, 700, 280, 6]].forEach(([x, y, w, h]) => { const rg = c.createLinearGradient(x - w, 0, x + w, 0); rg.addColorStop(0, 'rgba(250,215,200,0)'); rg.addColorStop(.5, 'rgba(250,215,200,.5)'); rg.addColorStop(1, 'rgba(250,215,200,0)'); c.fillStyle = rg; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU); c.fill(); }); };
K.mesa = (c, side = 'L', hz = HZ) => { const mk = (pts, flip) => { const p = new Path2D(); p.moveTo(flip ? W : 0, hz); pts.forEach(([x, y]) => p.lineTo(flip ? W - x : x, y)); p.lineTo(flip ? W - pts[pts.length - 1][0] : pts[pts.length - 1][0], hz); p.closePath(); return p; };
  const pts = [[0, 884], [90, 852], [170, 806], [260, 794], [340, 842], [430, 902], [500, hz]];
  if (side === 'L' || side === 'both') K.vol(c, mk(pts, false), 0, 0, 500, 0, '#E8C27A', '#9A6A34', 'rgba(60,30,10,.4)', 14);
  if (side === 'R' || side === 'both') K.vol(c, mk(pts.map(([x, y]) => [x * .8, y + 18]), true), W, 0, W - 400, 0, '#E8C27A', '#9A6A34', 'rgba(60,30,10,.4)', 14); };
K.sea = (c, t = 0, hz = HZ) => { const g = c.createLinearGradient(0, hz - 36, 0, hz); g.addColorStop(0, '#9DB5C4'); g.addColorStop(1, '#7C97AA'); c.fillStyle = g; c.fillRect(0, hz - 36, W, 36);
  c.strokeStyle = 'rgba(245,240,215,.6)'; c.lineWidth = 2; [[560, 24, 900], [620, 12, 1060], [80, 18, 300]].forEach(([a, dy, b], i) => { const s = Math.sin(t * .8 + i * 2) * 14; c.beginPath(); c.moveTo(a + s, hz - dy); c.lineTo(b + s, hz - dy); c.stroke(); }); };
K.sand = (c, o = {}) => { const hz = o.hz || HZ; const g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#DDB87C'); g.addColorStop(.14, C.sand1); g.addColorStop(.5, C.sand2); g.addColorStop(1, C.sand3); c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
  const r = rng(11);   // 沙丘脊：亮边在上、暗边在下，越近越大，给下三分之一一点起伏
  for (let k = 0; k < 9; k++) { const q = Math.pow((k + 1) / 9, 1.5), y = hz + 30 + q * (H - hz - 60), amp = 6 + q * 26, ph = r() * 3;
    const ridge = dy => { c.beginPath(); c.moveTo(-10, y + dy); for (let x = 0; x <= W + 60; x += 60) c.lineTo(x - 10, y + dy + Math.sin(x * .004 + ph + k) * amp * .6 + Math.sin(x * .011 + k * 2) * amp * .3); };
    ridge(0); c.strokeStyle = 'rgba(255,230,170,.22)'; c.lineWidth = 3 + q * 4; c.stroke(); ridge(5 + q * 8); c.strokeStyle = 'rgba(80,45,18,.2)'; c.lineWidth = 3 + q * 5; c.stroke(); } };
const bgCache = (mood, mesa, sea) => P.cached(`dl_bg_${mood}_${mesa}_${sea}`, W, H, g => { K.sky(g, { mood }); if (mesa) K.mesa(g, mesa); if (sea) K.sea(g, 0); K.sand(g); g.drawImage(P.grain('dl_bgn', 0.05, [70, 45, 20], 0.1), 0, 0); });
// K.bg(c,t,{mood:'dusk'|'dawn'|'tense'|'night', mesa:'L'|'R'|'both'|null, sea:true})：天沙海底，缓存一张图；每镜先调（同时设时间）。章与章之间换 mood/mesa 来区分
K.bg = (c, t, o = {}) => { K._t = t || 0; const mood = o.mood || 'dusk', mesa = o.mesa === undefined ? 'L' : o.mesa, sea = o.sea !== false;
  c.drawImage(bgCache(mood, mesa || '', sea), 0, 0); if (sea) { c.save(); c.beginPath(); c.rect(0, HZ - 36, W, 36); c.clip(); K.sea(c, K._t); c.restore(); } };
// 收尾：颗粒＋暗角＋字幕带压暗
K.finish = c => { c.drawImage(P.grain('dl_fin', 0.05, [60, 40, 20], 0.09), 0, 0);
  const v = P.cached('dl_vig', W, H, g => { const r = g.createRadialGradient(540, 900, 520, 540, 960, 1250); r.addColorStop(0, 'rgba(30,12,2,0)'); r.addColorStop(1, 'rgba(30,12,2,.34)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }); c.drawImage(v, 0, 0);
  const sb = c.createLinearGradient(0, 1360, 0, 1640); sb.addColorStop(0, 'rgba(40,22,10,0)'); sb.addColorStop(.3, 'rgba(40,22,10,.3)'); sb.addColorStop(.7, 'rgba(40,22,10,.3)'); sb.addColorStop(1, 'rgba(40,22,10,0)'); c.fillStyle = sb; c.fillRect(0, 1360, W, 280); };

// ---------- 文字：奶白＋棕描边（描边克制，别滑向 Q 版） ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, stroke = C.brown, align = 'center', alpha = 1, scale = 1, rot = 0, track = 0, lw = Math.max(5, size * 0.1) } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (track) c.letterSpacing = track + 'px';
  if (lw) { c.strokeStyle = 'rgba(30,12,4,.35)'; c.lineWidth = lw * 2; c.strokeText(s, 0, size * 0.05); c.strokeStyle = stroke; c.lineWidth = lw * 2; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// 标签牌：深棕底＋奶白字（沙上、天上都读得清）。K.plaque(c,s,x,y,{size=52,fill,col,scale,alpha,rot})
K.plaque = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Bold', fill = 'rgba(52,28,14,.93)', col = C.cream, scale = 1, alpha = 1, rot = 0 } = o;
  c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * 0.9, h = size * 1.5; c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  c.fillStyle = 'rgba(30,12,4,.3)'; c.beginPath(); c.roundRect(-w / 2 + 4, -h / 2 + 7, w, h, h * 0.28); c.fill();
  c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.28); c.fill(); c.strokeStyle = 'rgba(255,243,214,.5)'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, h * 0.2); c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 2); c.restore(); };
K.tag = K.plaque;
// 引线标签：线从 (ax,ay) 拉向标签 (bx,by)，端点一颗红点
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = ez(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(30,12,4,.4)'; c.lineWidth = 8; c.beginPath(); c.moveTo(ax + 2, ay + 3); c.lineTo(lerp(ax, bx, p1) + 2, lerp(ay, by, p1) + 3); c.stroke();
  c.strokeStyle = C.cream; c.lineWidth = 4; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.red; c.strokeStyle = C.cream; c.lineWidth = 4; c.beginPath(); c.arc(ax, ay, 12, 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.25, 0.45); if (q > 0) K.plaque(c, s, bx, by, { size: o.size || 52, scale: q, alpha: clamp(q * 2), fill: o.fill, col: o.col }); };

// ---------- 软化下垂 ----------
// K.droop([x,y], {cx, top, bottom, D=160, sag=1, flare=.12, wid=120})：点 → 下垂后的点。top/bottom＝物体最高/最低 y；越高下垂越多，中央（|x−cx|<wid）最多，脚（bottom）钉死
K.droop = ([x, y], o) => { const { cx, top, bottom, D = 160, sag = 1, flare = 0.12, wid = 120 } = o, w = 1 - clamp((y - top) / ((bottom - top) || 1)), gx = Math.exp(-(((x - cx) / wid) ** 2));
  return [cx + (x - cx) * (1 + flare * sag * (1 - w) * 0.6), y + sag * D * Math.pow(w, 1.3) * (0.35 + 0.65 * gx)]; };
// 软钟：K.softClock(c,x,y,r,{sag=.8, t, fold=-.25})；(x,y)＝钟盘中心，sag 0→1.4 越垂越长，下半盘垂下；钟面/刻度/指针走同一映射
K.softClock = (c, x, y, r, o = {}) => { const { sag = 0.8, t = K._t, fold = -0.25, face = '#F6EFD6' } = o;
  const map = (u, v) => { const q = clamp((v - fold) / (1 - fold)), base = v < fold ? v * 0.6 : fold * 0.6 + (v - fold) * (1 + 0.55 * sag * q);
    return [x + u * r * (1 + 0.12 * q * Math.min(1.4, sag)), y + r * (base + 0.5 * sag * q * q * (1 - 0.45 * u * u) + Math.sin(u * 5 + v * 3) * 0.025 * q * sag)]; };
  const ring = (rad, n = 48) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(map(Math.cos(a) * rad, Math.sin(a) * rad)); } return smooth(pts, true); };
  const outer = ring(1), inner = ring(0.82), lo = map(0, 1)[1], hi = map(0, -1)[1];
  if (!K._sil) { c.save(); c.fillStyle = 'rgba(40,20,8,.25)'; c.beginPath(); c.ellipse(x + r * .15, lo + 8, r * (.9 + .1 * sag), r * .1, 0, 0, TAU); c.fill(); c.restore(); }
  K.vol(c, outer, x - r, hi, x + r, lo, [[0, '#F4D783'], [.5, '#D6A93C'], [1, '#8A6420']], null, 'rgba(70,40,5,.5)', 12);
  if (K._sil) return; K.vol(c, inner, x - r, hi, x + r, lo, face, '#D8CBA0', 'rgba(110,80,30,.4)', 8);
  c.save(); c.clip(inner); c.strokeStyle = C.brown; c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, p = map(Math.cos(a) * .7, Math.sin(a) * .7), q = map(Math.cos(a) * .78, Math.sin(a) * .78); c.lineWidth = i % 3 ? 4 : 7; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
  const z = map(0, 0); [[t * .5 + 1, .5, 9], [t * 4 + .5, .66, 5]].forEach(([a, l, lw]) => { const m = map(Math.cos(a) * l, Math.sin(a) * l); c.lineWidth = lw * r / 90; c.beginPath(); c.moveTo(z[0], z[1]); c.lineTo(m[0], m[1]); c.stroke(); });
  c.restore(); };

// ---------- 磁铁（贯穿物）：红色马蹄，渐变＋极头＋颗粒，可开合/融化 ----------
// K.magnet(c, x, y, {s=1, open=0, melt=0, field=0, halo=0, grain=true})：x＝拱门中心线，y＝脚下着地线；s=1 时宽 380、高 490（s≈1.6–2 为主镜头大小）。
//  open 0→1：从拱顶裂成两半向外掰开；melt 0→1：软化下垂（拱顶塌、脚摊开）；field 0→1：两极间磁感线渐出；halo：暖金光晕（克制，≤.6）。
//  K.magnet.geom(s) → {RO,RI,LEG,POLE}；拱门内腔中心约在 (x, y−LEG)，可放漏斗/字/图标。K.shadow 里直接调即得剪影
const mgeom = s => ({ RO: 190 * s, RI: 110 * s, LEG: 300 * s, POLE: 112 * s });
K.magnet = (c, x, y, o = {}) => { const { s = 1, open = 0, melt = 0, field = 0, halo = 0, grain = true } = o, G = mgeom(s), { RO, RI, LEG, POLE } = G, cy = y - LEG, N = 28, sil = K._sil, pvx = x, pvy = cy - (RO + RI) / 2;
  const rot = (p, a) => { if (!a) return p; const dx = p[0] - pvx, dy = p[1] - pvy, ca = Math.cos(a), sa = Math.sin(a); return [pvx + dx * ca - dy * sa, pvy + dx * sa + dy * ca]; };
  const dr = p => melt > 0 ? K.droop(p, { cx: x, top: cy - RO, bottom: y, D: 150 * s, sag: melt, flare: 0.5, wid: RO * 0.9 }) : p;
  const side = sg => { const a0 = sg <= 0 ? Math.PI : 1.5 * Math.PI, a1 = sg < 0 ? 1.5 * Math.PI : 2 * Math.PI, ang = -sg * open * 0.3, outer = [], inner = [], n = sg ? N : N * 2;   // sg=0 整块；±1 左右半块（open>0）
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); outer.push([x + Math.cos(a) * RO, cy + Math.sin(a) * RO]); inner.push([x + Math.cos(a) * RI, cy + Math.sin(a) * RI]); }
    const ir = inner.slice().reverse(), loop = sg < 0 ? [[x - RO, y], ...outer, ...ir, [x - RI, y]] : sg > 0 ? [...outer, [x + RO, y], [x + RI, y], ...ir] : [[x - RO, y], ...outer, [x + RO, y], [x + RI, y], ...ir, [x - RI, y]];
    const fy = sg ? y - Math.max(...[[x + sg * RO, y], [x + sg * RI, y]].map(p => rot(p, ang)[1])) : 0, f = p => { const q = rot(p, ang); return dr([q[0], q[1] + fy]); }, tr = pts => pts.map(f), poles = [];   // 掰开时脚仍踩地
    if (sg <= 0) poles.push({ x0: x - RO, x1: x - RI, box: [[x - RO, y - POLE], [x - RI, y - POLE], [x - RI, y], [x - RO, y]] });
    if (sg >= 0) poles.push({ x0: x + RI, x1: x + RO, box: [[x + RI, y - POLE], [x + RO, y - POLE], [x + RO, y], [x + RI, y]] });
    const hl = outer.map(p => [x + (p[0] - x) * (RO - 26 * s) / RO, cy + (p[1] - cy) * (RO - 26 * s) / RO]);
    return { body: poly(tr(loop)), poles: poles.map(q => ({ ...q, path: poly(tr(q.box)), line: tr(q.box.slice(0, 2)) })), hl: tr(hl) }; };
  const sides = open > 0 ? [side(-1), side(1)] : [side(0)];
  if (sil) { c.fillStyle = '#000'; sides.forEach(h => c.fill(h.body)); return; }
  if (halo > 0) { const hg = c.createRadialGradient(x, cy, RI * .3, x, cy, RO * 2.2); hg.addColorStop(0, `rgba(255,205,120,${.3 * halo})`); hg.addColorStop(1, 'rgba(255,205,120,0)'); c.fillStyle = hg; c.fillRect(x - RO * 2.5, cy - RO * 2.5, RO * 5, RO * 5); }
  K.ground(c, x, y + 2, RO * 2.3, .3);
  if (melt > 0.15) { c.save(); c.fillStyle = 'rgba(96,20,16,.5)'; c.beginPath(); c.ellipse(x, y + 6, RO * (.8 + melt * .7), 12 * s * melt + 3, 0, 0, TAU); c.fill(); c.restore(); }
  const stops = [[0, '#F05A3A'], [.45, C.red], [1, '#6A0F10']];
  sides.forEach(h => { K.vol(c, h.body, x - RO, 0, x + RO, 0, stops, null, 'rgba(50,0,0,.62)', 16 * s);
    c.save(); c.clip(h.body); const vg = c.createRadialGradient(x - RO * .3, cy - RO * .5, 10 * s, x, cy, RO); vg.addColorStop(0, 'rgba(255,230,190,.45)'); vg.addColorStop(.5, 'rgba(255,230,190,0)'); vg.addColorStop(1, 'rgba(40,0,0,.4)'); c.fillStyle = vg; c.fillRect(x - RO * 2, cy - RO * 2, RO * 4, RO * 4 + LEG);
    if (grain) { c.drawImage(P.grain('dl_mag', 0.16, [70, 8, 4], 0.28), 0, 0); c.drawImage(P.grain('dl_magL', 0.05, [255, 200, 170], 0.22), 0, 0); }
    h.poles.forEach(q => { const sg = c.createLinearGradient(q.x0, 0, q.x1, 0); sg.addColorStop(0, '#F6F6F2'); sg.addColorStop(.55, C.steel); sg.addColorStop(1, '#8D9197'); c.fillStyle = sg; c.fill(q.path);
      c.strokeStyle = 'rgba(40,10,10,.6)'; c.lineWidth = 6 * s; c.beginPath(); q.line.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); });
    c.restore();
    c.save(); c.clip(h.body); c.filter = `blur(${10 * s}px)`; c.strokeStyle = 'rgba(40,0,0,.5)'; c.lineWidth = 26 * s; c.stroke(h.body); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,215,175,.32)'; c.lineWidth = 12 * s; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); h.hl.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.restore(); });
  if (field > 0) { c.save(); c.setLineDash([16 * s, 14 * s]); c.lineCap = 'round'; c.strokeStyle = C.cream; c.lineWidth = 4 * s + 1;
    [.62, .78, .92].forEach((k, i) => { const q = ez(field * 1.4 - i * .25); if (q <= 0) return; c.globalAlpha = .75 * q; c.beginPath(); c.ellipse(x, y - POLE * .5, (RO + RI) / 2 * k + 8 * s, (LEG - RI * .1) * k * .9 * q, 0, Math.PI, TAU); c.stroke(); }); c.restore(); } };
K.magnet.geom = mgeom;
K.token = K.magnet;      // 贯穿物别名

// ---------- 拐杖（撑着东西，达利母题） ----------
// K.crutch(c, x0,y0, x1,y1, {sway=0, w=20})：地上 (x0,y0) 到上端叉口 (x1,y1)
K.crutch = (c, x0, y0, x1, y1, o = {}) => { const { sway = 0, w = 20 } = o; x1 += sway;
  c.save(); c.lineCap = 'round';
  if (K._sil) { c.strokeStyle = '#000'; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.lineWidth = w * .9; c.beginPath(); c.moveTo(x1 - w * 3, y1 - 6); c.quadraticCurveTo(x1, y1 + 26, x1 + w * 2.4, y1 - 4); c.stroke(); c.restore(); return; }
  const g = c.createLinearGradient(x1 - w, 0, x1 + w, 0); g.addColorStop(0, '#C48A50'); g.addColorStop(1, C.woodD);
  c.strokeStyle = g; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.lineWidth = w * .9; c.beginPath(); c.moveTo(x1 - w * 3.1, y1 - 6); c.quadraticCurveTo(x1, y1 + 26, x1 + w * 2.4, y1 - 4); c.stroke();
  c.strokeStyle = 'rgba(255,225,180,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 - w * .25, y0); c.lineTo(x1 - w * .25, y1); c.stroke(); c.restore(); };

// ---------- 矿石堆 ----------
const SPOT = { teal: C.teal, gold: C.gold, pink: C.pink };
// K.rock(c,x,y,r,{seed, spots:['teal','gold','pink'], n=4})：单块矿石（(x,y) 为中心）
K.rock = (c, x, y, r, o = {}) => { const { seed = 1, spots = ['gold'], n = 4 } = o, rr = rng(seed * 13 + 5), pts = [], m = 9;
  for (let i = 0; i < m; i++) { const a = i / m * TAU, k = 0.72 + rr() * 0.42; pts.push([x + Math.cos(a) * r * k * 1.15, y + Math.sin(a) * r * k * 0.8]); } const p = poly(pts);
  if (K._sil) { c.fillStyle = '#000'; c.fill(p); return; }
  K.vol(c, p, x - r, y - r, x + r, y + r, '#9C8873', '#3A2E24', 'rgba(20,10,5,.6)', r * 0.25);
  c.save(); c.clip(p); c.fillStyle = 'rgba(255,235,200,.16)'; c.beginPath(); c.moveTo(pts[5][0], pts[5][1]); pts.slice(6).concat(pts.slice(0, 2)).forEach(q => c.lineTo(q[0], q[1])); c.lineTo(x, y - r * .1); c.closePath(); c.fill(); c.restore();
  c.strokeStyle = 'rgba(42,24,16,.8)'; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke(p);
  for (let i = 0; i < n; i++) { const sx = x + (rr() - .5) * r * 1.1, sy = y + (rr() - .5) * r * .6, sr = 3 + rr() * Math.max(2, r * .05); c.fillStyle = SPOT[spots[i % spots.length]] || spots[i % spots.length]; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(sx - sr * .3, sy - sr * .3, sr * .3, 0, TAU); c.fill(); } };
// K.ore(c,x,y,{s=1, seed=1, spots:['teal','gold','pink'], prog=1})：矿石堆，(x,y)＝堆底中心，s=1 宽约 430、高约 250；prog 控制块数渐出
K.ore = (c, x, y, o = {}) => { const { s = 1, seed = 1, spots = ['teal', 'gold', 'pink'], prog = 1 } = o;
  const L = [[-130, -42, 78, 3], [10, -34, 86, 8], [140, -50, 70, 12], [-70, -118, 78, 21], [70, -126, 72, 5], [0, -196, 56, 44], [-150, -110, 50, 33], [150, -130, 46, 40]];
  L.forEach(([dx, dy, r, sd], i) => { const q = ez(prog * (L.length + 1) - i); if (q <= 0) return; K.rock(c, x + dx * s, y + dy * s - (1 - q) * 80 * s, r * s * (0.6 + .4 * q), { seed: sd + seed, spots: [spots[i % spots.length], spots[(i + 1) % spots.length]], n: 4 }); }); };
// K.powder(c,x,y,{s=1,col=pink})：粉末小堆（氧化镨钕＝粉色），(x,y)＝底边中心
K.powder = (c, x, y, o = {}) => { const { s = 1, col = C.pink } = o; const p = new Path2D(); p.moveTo(x - 70 * s, y); p.quadraticCurveTo(x - 30 * s, y - 20 * s, x - 8 * s, y - 70 * s); p.quadraticCurveTo(x, y - 82 * s, x + 8 * s, y - 70 * s); p.quadraticCurveTo(x + 30 * s, y - 20 * s, x + 70 * s, y); p.closePath();
  K.vol(c, p, x - 70 * s, 0, x + 70 * s, 0, [[0, lighter(col, .35)], [1, col]], null, 'rgba(70,10,30,.4)', 8 * s); };
// K.stream(c, x0,y0, x1,y1, t, {n=14, cols:[pink,gold,teal], lift=140, speed=.28})：矿屑沿弧线飞向目标（进漏斗、进磁铁）
K.stream = (c, x0, y0, x1, y1, t, o = {}) => { const { n = 14, cols = [C.pink, C.gold, C.teal], lift = 140, speed = 0.28, r0 = 11, r1 = 4 } = o; if (K._sil) return;
  for (let k = 0; k < n; k++) { const q = (t * speed + k / n) % 1, e = q * q * (3 - 2 * q), x = lerp(x0, x1, e) + Math.sin(q * 9 + k) * 16, y = lerp(y0, y1, e) - Math.sin(q * Math.PI) * lift;
    c.globalAlpha = Math.sin(q * Math.PI) * .95; c.fillStyle = cols[k % cols.length]; c.beginPath(); c.arc(x, y, lerp(r0, r1, q), 0, TAU); c.fill(); } c.globalAlpha = 1; };

// ---------- 玻璃漏斗 / 分离提纯 ----------
// K.funnel(c, x, y, {s=1, fill=1, layers:[[col,frac]…], t, drops=true, dropCol})：(x,y)＝上沿中心；s=1 上口宽 300、总高 330（比原型大）。fill＝内容物高度 0..1；layers 自上而下（粗矿→细筛→金属）
K.funnel = (c, x, y, o = {}) => { const { s = 1, fill = 1, t = K._t, drops = true, dropCol = '#FFE9A0', layers = [['#6A5A48', .4], ['#A89C78', .3], ['#E9D27A', .3]] } = o, TW = 150 * s, NW = 24 * s, CH = 220 * s, NH = 110 * s;
  const body = poly([[x - TW, y], [x + TW, y], [x + NW, y + CH], [x + NW, y + CH + NH], [x - NW, y + CH + NH], [x - NW, y + CH]]);
  if (K._sil) { c.fillStyle = '#000'; c.fill(body); return; }
  c.save(); c.fillStyle = 'rgba(190,215,230,.25)'; c.beginPath(); c.ellipse(x, y, TW, 26 * s, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.stroke();
  const gl = c.createLinearGradient(x - TW, 0, x + TW, 0); gl.addColorStop(0, 'rgba(235,245,255,.75)'); gl.addColorStop(.5, 'rgba(180,215,235,.3)'); gl.addColorStop(1, 'rgba(235,245,255,.7)'); c.fillStyle = gl; c.fill(body);
  c.save(); c.clip(body); const lv = clamp(fill), bottom = y + CH + 8 * s, rh = (CH - 12 * s) * lv, tot = layers.reduce((a, l) => a + l[1], 0); let yy = bottom - rh;
  layers.forEach(([col, f]) => { const hh = rh * f / tot; c.fillStyle = col; c.globalAlpha = .82; c.fillRect(x - TW, yy, TW * 2, hh + 1); yy += hh; }); c.globalAlpha = 1; c.restore();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(body);
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 7 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - TW * .78, y + 24 * s); c.lineTo(x - NW * 1.9, y + CH - 14 * s); c.stroke(); c.restore();
  if (drops) for (let k = 0; k < 3; k++) { const q = (t * .9 + k / 3) % 1; c.fillStyle = dropCol; c.beginPath(); c.ellipse(x, y + CH + NH - 14 * s + q * 190 * s, 8 * s, (12 + q * 5) * s, 0, 0, TAU); c.fill(); } };
// K.separate(c, x, y, t, {s=1, prog=1})：分离提纯整套——上方漏斗，漏嘴下分出青/金/粉三道细流落进三小堆粉末；(x,y)＝漏斗上沿中心，总高约 s*700
K.separate = (c, x, y, t, o = {}) => { const { s = 1, prog = 1 } = o, ny = y + 330 * s, by = y + 690 * s, xs = [-170, 0, 170].map(d => x + d * s), cols = [C.teal, C.gold, C.pink];
  K.funnel(c, x, y, { s, t, drops: false, fill: .9 });
  if (K._sil) { xs.forEach(px => K.powder(c, px, by, { s: .8 * s })); return; }
  cols.forEach((col, i) => { const q = ez(prog * 1.6 - i * .3); if (q <= 0) return; c.save(); c.strokeStyle = col; c.lineWidth = 7 * s; c.lineCap = 'round'; c.setLineDash([14 * s, 12 * s]); c.lineDashOffset = -t * 40;
    c.beginPath(); c.moveTo(x, ny); c.quadraticCurveTo(x, lerp(ny, by, .5), xs[i], lerp(ny, by - 70 * s, q)); c.stroke(); c.restore(); K.powder(c, xs[i], by, { s: .8 * s * q, col }); }); };

// ---------- 沙堆（图表柱、涨跌） ----------
// K.dune(c, x, y, w, h, {a, b, hi})：沙堆，(x,y) 底边中心，顶部圆润；用高度表示数值
K.dune = (c, x, y, w, h, o = {}) => { const { a = '#E3B56C', b = '#9A6430' } = o, p = new Path2D(); p.moveTo(x - w / 2, y); p.bezierCurveTo(x - w * .36, y - h * .1, x - w * .3, y - h, x, y - h); p.bezierCurveTo(x + w * .3, y - h, x + w * .36, y - h * .1, x + w / 2, y); p.closePath();
  K.vol(c, p, x - w / 2, y - h, x + w / 2, y, [[0, o.hi || a], [1, b]], null, 'rgba(70,35,10,.35)', 10); return p; };

// ---------- 桌 / 天平 ----------
// K.table(c, x, y, {w=420, h=210, s=1})：(x,y)＝地面中心；桌板厚 30，两条可见桌腿
K.table = (c, x, y, o = {}) => { const { w = 420, h = 210, s = 1 } = o, ww = w * s, hh = h * s, top = y - hh;
  [[-ww / 2 + 28 * s, -ww / 2 + 56 * s], [ww / 2 - 56 * s, ww / 2 - 28 * s]].forEach(([a, b]) => K.vol(c, poly([[x + a, top + 26 * s], [x + b, top + 26 * s], [x + b - 4 * s, y], [x + a + 4 * s, y]]), x + a, 0, x + b, 0, '#B27A42', '#5A3418', 'rgba(30,12,4,.5)', 6 * s));
  K.vol(c, K.round(x - ww / 2, top, ww, 30 * s, 8 * s), 0, top, 0, top + 30 * s, '#D2985A', '#7A4A24', 'rgba(30,12,4,.45)', 6 * s); K.ground(c, x, y + 2, ww * 1.05, .3); };
// K.scale(c, x, y, {s=1, tilt=0, left:(c,px,py)=>…, right:(c,px,py)=>…})：天平；(x,y)＝底座着地中心；tilt∈[-1,1]，正＝右边沉；
//  left/right 在托盘面中心 (px,py) 往上画东西（磁铁放一端、钱币矿石放另一端）
K.scale = (c, x, y, o = {}) => { const { s = 1, tilt = 0, left, right } = o, PH = 430 * s, L = 260 * s, py0 = y - PH, a = tilt * 0.26, ex = L * Math.cos(a), ey = L * Math.sin(a), CHN = 190 * s;
  K.vol(c, poly([[x - 80 * s, y], [x + 80 * s, y], [x + 22 * s, y - 70 * s], [x - 22 * s, y - 70 * s]]), x - 80 * s, 0, x + 80 * s, 0, '#B9833F', '#5A3418', 'rgba(30,12,4,.5)', 6 * s);
  K.vol(c, K.round(x - 18 * s, py0, 36 * s, PH - 60 * s, 14 * s), x - 18 * s, 0, x + 18 * s, 0, '#C99552', '#6A4020', 'rgba(30,12,4,.5)', 5 * s);
  [[x - ex, py0 - ey, left], [x + ex, py0 + ey, right]].forEach(([px, py, fn]) => { c.save(); c.strokeStyle = K._sil ? '#000' : '#5A3418'; c.lineWidth = 4 * s + 1; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 105 * s, py + CHN); c.moveTo(px, py); c.lineTo(px + 105 * s, py + CHN); c.stroke(); c.restore();
    const pan = new Path2D(); pan.moveTo(px - 125 * s, py + CHN); pan.quadraticCurveTo(px, py + CHN + 58 * s, px + 125 * s, py + CHN); pan.closePath();
    K.vol(c, pan, px - 125 * s, 0, px + 125 * s, 0, '#E3B56C', '#8A5A28', 'rgba(50,25,8,.5)', 5 * s); if (fn && !K._sil) fn(c, px, py + CHN); });
  const beam = poly([[x - ex, py0 - ey - 10 * s], [x + ex, py0 + ey - 10 * s], [x + ex, py0 + ey + 10 * s], [x - ex, py0 - ey + 10 * s]]);
  K.vol(c, beam, 0, py0 - 12 * s, 0, py0 + 12 * s, '#E0AE62', '#7A4A24', 'rgba(30,12,4,.45)', 4 * s); flat(c, K.circle(x, py0, 20 * s), '#8A5A2B'); if (!K._sil) { c.fillStyle = '#F2D08A'; c.beginPath(); c.arc(x - 4 * s, py0 - 4 * s, 7 * s, 0, TAU); c.fill(); } };

// ---------- 齿轮（钢色） ----------
// K.gear(c,x,y,r,{rot=t*.35, teeth=12, hole=true})
K.gear = (c, x, y, r, o = {}) => { const { rot = K._t * .35, teeth = 12, hole = true } = o, p = [], n = teeth;
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, w = TAU / n; [[-.3, .8], [-.2, 1], [.2, 1], [.3, .8]].forEach(([d, k]) => p.push([x + Math.cos(a + d * w * 1.6) * r * k, y + Math.sin(a + d * w * 1.6) * r * k])); }
  K.vol(c, poly(p), x - r, y - r, x + r, y + r, [[0, '#EDEDF0'], [.5, C.steel], [1, '#5E6369']], null, 'rgba(30,34,40,.5)', r * .06);
  if (K._sil || !hole) return; K.vol(c, K.circle(x, y, r * .62), x - r, y - r, x + r, y + r, '#B5B8BE', '#7C8187', 'rgba(30,34,40,.3)', r * .05); c.fillStyle = '#3A3028'; c.beginPath(); c.arc(x, y, r * .26, 0, TAU); c.fill(); };

// ---------- 关口 / 栅栏 ----------
// K.gate(c,x,y,{s=1, open=0})：关口（道闸）。(x,y)＝左立柱着地中心；横杆红白相间，长 440s，open 0 横杆放下 → 1 抬起
K.gate = (c, x, y, o = {}) => { const { s = 1, open = 0 } = o, PH = 210 * s, L = 440 * s, a = -clamp(open) * 1.25, px = x, py = y - PH + 20 * s;
  K.vol(c, K.round(x - 34 * s, y - PH, 68 * s, PH, 10 * s), x - 34 * s, 0, x + 34 * s, 0, '#D8C8A8', '#7A6A4E', 'rgba(40,25,10,.5)', 7 * s);
  const fx = x + L - 10 * s; K.vol(c, poly([[fx - 16 * s, y - 110 * s], [fx + 16 * s, y - 110 * s], [fx + 10 * s, y], [fx - 10 * s, y]]), fx - 16 * s, 0, fx + 16 * s, 0, '#B27A42', '#5A3418', 'rgba(30,12,4,.5)', 4 * s);
  c.save(); c.translate(px, py); c.rotate(a); const bar = K.round(0, -14 * s, L, 28 * s, 10 * s);
  if (K._sil) { c.fillStyle = '#000'; c.fill(bar); } else { c.fillStyle = '#F4EAD0'; c.fill(bar); c.save(); c.clip(bar); c.fillStyle = C.red; for (let i = 0; i < 9; i++) { c.beginPath(); const bx = i * 2 * L / 18; c.moveTo(bx, -16 * s); c.lineTo(bx + L / 18 + 14 * s, -16 * s); c.lineTo(bx + L / 18, 16 * s); c.lineTo(bx - 14 * s, 16 * s); c.closePath(); c.fill(); }
    const sh = c.createLinearGradient(0, -14 * s, 0, 14 * s); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,10,5,.4)'); c.fillStyle = sh; c.fillRect(0, -16 * s, L, 32 * s); c.restore(); }
  c.restore(); flat(c, K.circle(px, py, 15 * s), '#8A5A2B'); K.ground(c, x, y + 2, 120 * s, .3); };
// K.fence(c,x,y,{n=6, gap=76, h=150, s=1})：栅栏，(x,y)＝左端着地
K.fence = (c, x, y, o = {}) => { const { n = 6, gap = 76, h = 150, s = 1 } = o, w = (n - 1) * gap * s;
  [0.3, 0.68].forEach(k => K.vol(c, K.round(x - 12 * s, y - h * s * k - 9 * s, w + 24 * s, 18 * s, 6 * s), 0, y - h * s * k - 9 * s, 0, y - h * s * k + 9 * s, '#D2985A', '#7A4A24', 'rgba(30,12,4,.4)', 3 * s));
  for (let i = 0; i < n; i++) { const px = x + i * gap * s; K.vol(c, poly([[px - 13 * s, y], [px - 13 * s, y - h * s + 10 * s], [px, y - h * s - 8 * s], [px + 13 * s, y - h * s + 10 * s], [px + 13 * s, y]]), px - 13 * s, 0, px + 13 * s, 0, '#C48A50', '#5A3418', 'rgba(30,12,4,.5)', 4 * s); } };

// ---------- 箭头 ----------
// K.arrow(c,x1,y1,x2,y2,{col=red, lw=24, head=64, prog=1})：实心渐变箭头（带落影），任意方向；col 须为 #RRGGBB
K.arrow = (c, x1, y1, x2, y2, o = {}) => { const { col = C.red, lw = 24, head = 64, prog = 1 } = o, p = clamp(prog); if (p <= 0) return;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, ex = x1 + dx * p, ey = y1 + dy * p, hl = Math.min(head, L * p * .8), bx = ex - ux * hl, by = ey - uy * hl;
  const path = poly([[x1 + nx * lw / 2, y1 + ny * lw / 2], [bx + nx * lw / 2, by + ny * lw / 2], [bx + nx * head * .62, by + ny * head * .62], [ex, ey], [bx - nx * head * .62, by - ny * head * .62], [bx - nx * lw / 2, by - ny * lw / 2], [x1 - nx * lw / 2, y1 - ny * lw / 2]]);
  if (!K._sil) { c.save(); c.translate(6, 9); c.fillStyle = 'rgba(40,20,8,.3)'; c.fill(path); c.restore(); }
  K.vol(c, path, x1 + nx * head, y1 + ny * head, x1 - nx * head, y1 - ny * head, lighter(col, .25), col, 'rgba(50,8,4,.55)', 7); };

// ---------- 简易图标 ----------
// K.icon(c, name, x, y, s=1, o)：中心 (x,y)，s=1 约 200px。名：motor 电机 / wind 风机 / car 电动车 / coin 钱币 / chip 芯片 / bolt 闪电 / person 人物剪影 / battery 电池 / phone 手机 / flask 烧瓶
const I = K.icons = {};
const vv = (c, pts, a, b, x0, y0, x1, y1, bl = 5) => K.vol(c, poly(pts), x0, y0, x1, y1, a, b, 'rgba(30,12,4,.45)', bl);
I.motor = (c, x, y, s = 1) => { c.save(); c.translate(x, y); c.scale(s, s);
  vv(c, [[-100, -10], [-60, -10], [-60, 10], [-100, 10]], '#D5D6DA', '#6D7278', 0, -10, 0, 10, 3);
  K.vol(c, K.round(-60, -62, 150, 124, 22), 0, -62, 0, 62, '#B8BCC2', '#5E6369', 'rgba(20,24,30,.5)', 8);
  if (!K._sil) { for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(40,44,50,.5)'; c.fillRect(-36 + i * 24, -62, 6, 124); } c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-56, -58, 140, 8); }
  K.vol(c, K.round(90, -48, 20, 96, 6), 90, 0, 110, 0, C.red, '#6A0F10', 'rgba(40,0,0,.5)', 4); c.restore(); };
I.wind = (c, x, y, s = 1, o = {}) => { const t = o.t ?? K._t; c.save(); c.translate(x, y); c.scale(s, s);
  vv(c, [[-9, 0], [9, 0], [20, 120], [-20, 120]], '#F2F0E6', '#A8A592', -10, 0, 10, 0, 3);
  c.translate(0, -2); for (let i = 0; i < 3; i++) { c.save(); c.rotate(t * 1.4 + i * TAU / 3); vv(c, [[-9, 0], [9, 0], [4, -112], [-3, -112]], '#FFFFFF', '#B9BCB4', -9, 0, 9, 0, 3); c.restore(); }
  flat(c, K.circle(0, 0, 13), C.red); c.restore(); };
I.car = (c, x, y, s = 1, o = {}) => { const col = o.col || C.red; c.save(); c.translate(x, y); c.scale(s, s);
  K.vol(c, smooth([[-120, 28], [-124, -4], [-80, -14], [-44, -50], [30, -52], [72, -14], [118, -6], [124, 28]], true), -120, -50, 120, 30, lighter(col, .25), col, 'rgba(50,8,4,.5)', 6);
  if (!K._sil) { K.vol(c, smooth([[-60, -12], [-36, -40], [-2, -40], [-2, -12]], true), 0, -40, 0, -12, '#DDEAF2', '#7C97AA', 'rgba(20,40,60,.4)', 3); K.vol(c, smooth([[8, -12], [8, -40], [32, -40], [58, -12]], true), 0, -40, 0, -12, '#DDEAF2', '#7C97AA', 'rgba(20,40,60,.4)', 3); }
  [-68, 70].forEach(wx => { flat(c, K.circle(wx, 30, 28), '#2A2018'); if (!K._sil) flat(c, K.circle(wx, 30, 13), '#C9CACF'); }); c.restore(); };
I.coin = (c, x, y, s = 1, o = {}) => { const col = o.col || C.gold; c.save(); c.translate(x, y); c.scale(s, s); K.vol(c, K.circle(0, 0, 70), -70, -70, 70, 70, lighter(col, .35), '#A87A18', 'rgba(80,50,5,.5)', 7);
  if (!K._sil) { c.strokeStyle = 'rgba(120,80,10,.6)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 48, 0, TAU); c.stroke(); K.text(c, o.mark || '$', 0, 3, { size: 64, col: '#7A5410', lw: 0 }); } c.restore(); };
I.chip = (c, x, y, s = 1) => { c.save(); c.translate(x, y); c.scale(s, s); if (!K._sil) { c.fillStyle = '#B9BCC2'; for (let i = 0; i < 6; i++) { c.fillRect(-62 + i * 24, -88, 10, 176); c.fillRect(-88, -62 + i * 24, 176, 10); } }
  K.vol(c, K.round(-70, -70, 140, 140, 14), -70, -70, 70, 70, '#4A4E56', '#1E2026', 'rgba(0,0,0,.5)', 6); if (!K._sil) { c.strokeStyle = C.gold; c.lineWidth = 5; c.strokeRect(-36, -36, 72, 72); c.fillStyle = C.gold; c.beginPath(); c.arc(-26, -26, 6, 0, TAU); c.fill(); } c.restore(); };
I.bolt = (c, x, y, s = 1, o = {}) => { const col = o.col || C.gold; c.save(); c.translate(x, y); c.scale(s, s); vv(c, [[20, -100], [-56, 10], [-6, 10], [-24, 100], [58, -22], [8, -22]], lighter(col, .3), col, -50, -100, 50, 100, 5); c.restore(); };
I.person = (c, x, y, s = 1, o = {}) => { const col = o.col || '#2A2018'; c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = K._sil ? '#000' : col; c.beginPath(); c.arc(0, -78, 22, 0, TAU); c.fill();   // 剪影：不画脸
  c.beginPath(); c.moveTo(-34, -48); c.quadraticCurveTo(0, -60, 34, -48); c.lineTo(40, 24); c.lineTo(22, 24); c.lineTo(20, 100); c.lineTo(4, 100); c.lineTo(2, 30); c.lineTo(-2, 30); c.lineTo(-4, 100); c.lineTo(-20, 100); c.lineTo(-22, 24); c.lineTo(-40, 24); c.closePath(); c.fill(); c.restore(); };
I.battery = (c, x, y, s = 1) => { c.save(); c.translate(x, y); c.scale(s, s); K.vol(c, K.round(-30, -92, 60, 18, 5), 0, -92, 0, -74, '#D5D6DA', '#6D7278', 'rgba(0,0,0,.4)', 3);
  K.vol(c, K.round(-60, -76, 120, 170, 16), -60, 0, 60, 0, '#3E8C7C', '#1E4A42', 'rgba(0,20,15,.5)', 7); if (!K._sil) { c.fillStyle = '#F2D08A'; for (let i = 0; i < 3; i++) c.fillRect(-36, -50 + i * 46, 72, 32); } c.restore(); };
I.phone = (c, x, y, s = 1) => { c.save(); c.translate(x, y); c.scale(s, s); K.vol(c, K.round(-52, -96, 104, 192, 18), 0, -96, 0, 96, '#4A4E56', '#1E2026', 'rgba(0,0,0,.5)', 6); if (!K._sil) K.vol(c, K.round(-42, -80, 84, 150, 8), 0, -80, 0, 70, '#E8C27A', '#C9773A', 'rgba(60,20,5,.4)', 4); c.restore(); };
I.flask = (c, x, y, s = 1, o = {}) => { const col = o.col || C.gold; c.save(); c.translate(x, y); c.scale(s, s); const body = poly([[-22, -96], [22, -96], [22, -40], [76, 70], [-76, 70], [-22, -40]]);
  if (K._sil) { c.fillStyle = '#000'; c.fill(body); } else { c.fillStyle = 'rgba(200,225,240,.45)'; c.fill(body); c.save(); c.clip(body); c.fillStyle = col; c.globalAlpha = .85; c.fillRect(-90, 8, 180, 70); c.restore(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(body); } c.restore(); };
K.icon = (c, name, x, y, s = 1, o = {}) => { if (!I[name]) throw new Error('K.icon: 没有这个图标 ' + name + '（有 ' + Object.keys(I).join('/') + '）'); I[name](c, x, y, s, o); };

// ---------- 沙地图表模板 ----------
// K.chart(c, {type:'line'|'bar'|'candle'|'ecg', x=70, y=900, w=940, h=450, data, prog=1, labels:[x 轴标签], title, fmt, yfmt, col, hi:[柱序号…]（磁铁红）, marks:[{i,text,dx,dy}], ticks=3, min, max, schematic=true})
//  底＝一块沙板（浅沙底、深棕墨线），放在下三分之一：默认 y 900–1350。线/柱/K 线/心电图共用坐标轴；右上角恒有「示意」章（schematic:false 关掉）。
//  line：沙丘折线（线下填沙面，沙面高度＝涨跌），data=[v…]；bar：沙堆柱，data=[v…] 或 [{v,label,col,hi}]；candle：data=[{o,c,h,l}]，涨红跌青绿；
//  ecg：心电图，给 data=[v…] 就按数据走直线折线，不给就画一段 PQRST 式的价格心电图。返回 {tip:[x,y]} 当前笔尖
K.chart = (c, o = {}) => { const { type = 'line', x = 70, y = 900, w = 940, h = 450, prog = 1, title, fmt = v => String(v), col = C.red, hi = [], marks = [], ticks = 3, schematic = true } = o;
  const labels = o.labels || [], p = clamp(prog); let data = o.data || [];
  if (type === 'ecg' && !data.length) { const r = rng(7), base = []; for (let b = 0; b < 4; b++) { const sp = [0, 0, 0, .05, -.05, 0, 0, 0.18, 1, -.45, 0, 0, .12, .22, .12, 0, 0, 0].map(v => v + (r() - .5) * .04); base.push(...sp.map(v => v * (b === 2 ? 1.5 : 1))); } data = base; }
  const PX = x + 138, PY = y + (title ? 96 : 66), PW = w - 138 - 36, PHt = h - (title ? 96 : 66) - (labels.length || type === 'bar' ? 76 : 44);
  c.save(); c.fillStyle = 'rgba(40,20,6,.28)'; c.beginPath(); c.roundRect(x + 6, y + 12, w, h, 28); c.fill();
  const sg = c.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, '#EDD6A0'); sg.addColorStop(1, '#D9B676'); c.fillStyle = sg; c.beginPath(); c.roundRect(x, y, w, h, 28); c.fill();
  c.clip(); c.drawImage(P.grain('dl_slab', 0.08, [110, 70, 30], 0.22), 0, 0); c.restore();
  c.strokeStyle = 'rgba(110,70,30,.55)'; c.lineWidth = 4; c.beginPath(); c.roundRect(x, y, w, h, 28); c.stroke();
  if (title) K.text(c, title, x + 40, y + 52, { size: 52, fam: 'PuHui-Bold', col: C.brown, lw: 0, align: 'left' });
  if (schematic) { c.save(); c.translate(x + w - 100, y + 50); c.rotate(.06); c.fillStyle = C.red; c.beginPath(); c.roundRect(-64, -30, 128, 60, 10); c.fill(); c.strokeStyle = C.cream; c.lineWidth = 3; c.beginPath(); c.roundRect(-58, -24, 116, 48, 6); c.stroke(); c.font = '44px "PuHui-Black"'; c.fillStyle = C.cream; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('示意', 0, 3); c.restore(); }
  const vals = type === 'candle' ? data.flatMap(d => [d.h, d.l]) : data.map(d => typeof d === 'object' ? d.v : d);
  let lo = o.min ?? Math.min(type === 'bar' ? 0 : Infinity, ...vals), hi2 = o.max ?? Math.max(...vals);
  if (o.min == null && type !== 'bar') lo -= ((hi2 - lo) * 0.12 || 1); if (o.max == null) hi2 += (hi2 - lo) * .06;
  const span = (hi2 - lo) || 1, Y = v => PY + PHt * (1 - (v - lo) / span), yfmt = o.yfmt || fmt;
  c.save(); c.lineCap = 'round';
  if (type === 'ecg') { c.strokeStyle = 'rgba(192,57,43,.2)'; c.lineWidth = 2; for (let i = 0; i <= 20; i++) { c.beginPath(); c.moveTo(PX + PW * i / 20, PY); c.lineTo(PX + PW * i / 20, PY + PHt); c.stroke(); } for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(PX, PY + PHt * i / 8); c.lineTo(PX + PW, PY + PHt * i / 8); c.stroke(); } }
  else { const raw = span / (ticks + 1), mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= raw) || raw;
    for (let v = Math.ceil((lo + span * .08) / st) * st; v < hi2 - span * .08; v += st) { const yy = Y(v);
      c.setLineDash([14, 12]); c.strokeStyle = 'rgba(74,42,24,.28)'; c.lineWidth = 3; c.beginPath(); c.moveTo(PX, yy); c.lineTo(PX + PW, yy); c.stroke(); c.setLineDash([]); K.text(c, yfmt(Math.round(v * 100) / 100), PX - 16, yy, { size: 44, fam: 'PuHui-Bold', col: C.brown, lw: 0, align: 'right' }); } }
  c.strokeStyle = C.brown; c.lineWidth = 7; c.beginPath(); c.moveTo(PX, PY - 6); c.lineTo(PX, PY + PHt); c.lineTo(PX + PW + 6, PY + PHt); c.stroke(); c.restore();
  const n = data.length; let tip = [PX, PY + PHt];
  const xl = i => type === 'line' || type === 'ecg' ? PX + 24 + (PW - 48) * i / Math.max(1, n - 1) : PX + PW * (i + .5) / n;
  if (type === 'line' || type === 'ecg') {
    const pts = data.map((d, i) => [xl(i), Y(typeof d === 'object' ? d.v : d)]), dense = [];
    if (type === 'line' && pts.length > 2) { for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < 10; k++) { const u = k / 10, u2 = u * u, u3 = u2 * u; dense.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3))); } } dense.push(pts[pts.length - 1]); } else dense.push(...pts);
    const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1])); const tot = cum[cum.length - 1] || 1, tgt = p * tot, cut = [];
    for (let i = 0; i < dense.length; i++) { if (cum[i] <= tgt) { cut.push(dense[i]); tip = dense[i]; } else { const f = (tgt - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); tip = [lerp(dense[i - 1][0], dense[i][0], f), lerp(dense[i - 1][1], dense[i][1], f)]; cut.push(tip); break; } }
    if (cut.length > 1 && p > 0) { c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      if (type === 'line') { const fp = poly([[cut[0][0], PY + PHt], ...cut, [cut[cut.length - 1][0], PY + PHt]]); const fg = c.createLinearGradient(0, PY, 0, PY + PHt); fg.addColorStop(0, 'rgba(184,120,52,.7)'); fg.addColorStop(1, 'rgba(184,120,52,.12)'); c.fillStyle = fg; c.fill(fp); }
      const lp = poly(cut, false); c.strokeStyle = 'rgba(74,42,24,.95)'; c.lineWidth = type === 'ecg' ? 13 : 17; c.stroke(lp); c.strokeStyle = col; c.lineWidth = type === 'ecg' ? 7 : 10; c.stroke(lp); c.restore();
      c.fillStyle = C.cream; c.strokeStyle = C.brown; c.lineWidth = 6; c.beginPath(); c.arc(tip[0], tip[1], 14, 0, TAU); c.fill(); c.stroke(); }
    marks.forEach(m => { const q = ez((p - (m.i / Math.max(1, n - 1)) * .9) / .1); if (q <= 0 || m.i >= n) return; const mp = pts[m.i]; c.fillStyle = m.col || C.red; c.strokeStyle = C.cream; c.lineWidth = 5; c.beginPath(); c.arc(mp[0], mp[1], 12 * q, 0, TAU); c.fill(); c.stroke(); if (m.text) K.plaque(c, m.text, clamp(mp[0] + (m.dx || 0), x + 110, x + w - 110), mp[1] + (m.dy ?? -80), { size: 44, scale: q, alpha: clamp(q * 2) }); });
  } else if (type === 'bar') {
    const slot = PW / n, bw = Math.min(150, slot * .62), z = Y(0); if (lo < 0) { c.strokeStyle = C.brown; c.lineWidth = 5; c.beginPath(); c.moveTo(PX, z); c.lineTo(PX + PW, z); c.stroke(); }
    data.forEach((d, i) => { const v = typeof d === 'object' ? d.v : d, q = ez(p * (1 + .3 * (n - 1)) - .3 * i); if (q <= 0) return; const ch = Math.max(18, Math.abs(Y(v) - z) * q), cx = PX + slot * (i + .5), up = v >= 0, isHi = hi.includes(i) || (typeof d === 'object' && d.hi), cc = (typeof d === 'object' && d.col) || (isHi ? C.red : null);
      const a = cc ? lighter(cc, .3) : '#E3A85C', b = cc || '#9A5C28';
      c.save(); if (!up) { c.translate(0, z * 2); c.scale(1, -1); }
      K.dune(c, cx, z, bw, ch, { a, b }); c.restore();
      if (q > .6) K.text(c, fmt(v), cx, up ? z - ch - 34 : z - 34, { size: 48, col: C.brown, lw: 0, alpha: clamp((q - .6) * 3) });
      const lab = typeof d === 'object' ? d.label : labels[i]; if (lab != null && lab !== '') K.text(c, String(lab), cx, y + h - 38, { size: 44, fam: 'PuHui-Bold', col: C.brown, lw: 0, alpha: clamp(q * 3) }); });
    tip = [PX + PW, z];
  } else if (type === 'candle') {
    const slot = PW / n, bw = Math.min(46, slot * .56);
    data.forEach((d, i) => { const q = ez(p * (1 + .15 * (n - 1)) - .15 * i); if (q <= 0) return; const cx = PX + slot * (i + .5), up = d.c >= d.o, cc = up ? C.red : C.dn, yo = Y(d.o), yc = Y(d.c), yh = lerp(Y(d.o), Y(d.h), q), yl = lerp(Y(d.c), Y(d.l), q);
      c.strokeStyle = C.brown; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, yh); c.lineTo(cx, yl); c.stroke();
      const by0 = Math.min(yo, yc), bh = Math.max(8, Math.abs(yo - yc)) * q; K.vol(c, K.round(cx - bw / 2, by0, bw, bh, 6), cx - bw / 2, 0, cx + bw / 2, 0, lighter(cc, .22), cc, 'rgba(30,10,5,.5)', 4); c.strokeStyle = 'rgba(74,42,24,.8)'; c.lineWidth = 3; c.beginPath(); c.roundRect(cx - bw / 2, by0, bw, bh, 6); c.stroke(); tip = [cx, Y(d.c)]; });
  }
  if (type !== 'bar' && labels.length) labels.forEach((t, i) => { const lx = type === 'candle' ? PX + PW * (i + .5) / labels.length : PX + 70 + (PW - 140) * i / Math.max(1, labels.length - 1); K.text(c, String(t), lx, y + h - 36, { size: 44, fam: 'PuHui-Bold', col: C.brown, lw: 0 }); });
  return { tip }; };
K.line = (c, data, o = {}) => K.chart(c, { ...o, type: 'line', data });
K.bars = (c, data, o = {}) => K.chart(c, { ...o, type: 'bar', data });
K.candle = (c, data, o = {}) => K.chart(c, { ...o, type: 'candle', data });
K.ecg = (c, data, o = {}) => K.chart(c, { ...o, type: 'ecg', data });

// ---------- 章节卡 ----------
// 中央主物：马蹄磁铁立在沙地、拱门里刻章号；换贯穿物就在 props.js 里重写 K.cardCenter
K.cardCenter = K.cardCenter || ((c, lt, t, n) => { const q = ez(K.at(lt, 0.1, 0.7)), s = 1.3, gy = 1290, G = K.magnet.geom(s), cy = gy - G.LEG;
  if (q > 0) { K.shadow(c, g => K.magnet(g, 540, gy, { s }), gy, { kx: lerp(.6, 1.05, ez(K.at(lt, 0, 1.6))), alpha: .5 * q });
    c.save(); c.globalAlpha *= clamp(q * 2); K.magnet(c, 540, gy + (1 - q) * 160, { s, halo: .5 * q }); c.restore(); }
  if (lt > 0.3) K.text(c, String(n), 540, cy + 60, { size: 230, col: C.cream, scale: MO.slamK((lt - 0.3) / 0.17), lw: 16 }); });
K.chapterCard = (c, lt, t, n, title) => { K.bg(c, t, { mood: K.moodFor(n), mesa: n % 2 ? 'L' : 'R' });
  const N = K.CHAPTER_NAMES.length || 12, step = Math.min(72, 900 / Math.max(1, N - 1)), x0 = 540 - step * (N - 1) / 2, ly = 140;
  c.save(); c.strokeStyle = 'rgba(255,243,214,.4)'; c.lineWidth = 3; c.setLineDash([10, 10]); c.beginPath(); c.moveTo(x0, ly); c.lineTo(x0 + step * (N - 1), ly); c.stroke(); c.restore();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, done = i < n - 1, px = x0 + i * step;
    if (cur) K.magnet(c, px, ly + 40, { s: .2, grain: false }); else { c.fillStyle = done ? C.gold : 'rgba(255,243,214,.4)'; c.strokeStyle = C.brown; c.lineWidth = 3; c.beginPath(); c.arc(px, ly, 11, 0, TAU); c.fill(); c.stroke(); } }
  K.text(c, `第 ${n} 章`, 540, 270, { size: 84, col: C.gold, alpha: K.at(lt, 0.15, 0.3) });
  title = String(title || ''); const size = [...title].length > 15 ? 88 : 100, lines = []; c.save(); c.font = `${size}px "PuHui-Black"`; const per = Math.max(4, Math.floor(880 / c.measureText('国').width));
  title.split(/(?<=[，。：:？?！!,])/).forEach(seg => { const ch = [...seg], nl = Math.ceil(ch.length / per) || 1, ev = Math.ceil(ch.length / nl) || 1; for (let i = 0; i < ch.length; i += ev) lines.push(ch.slice(i, i + ev).join('')); }); c.restore();
  const tl = [...title].length, shown = Math.round(K.at(lt, 0.3, tl / 18) * tl), lh = size * 1.22, ty = 410; let used = 0;
  lines.forEach((ln, k) => { const part = [...ln].slice(0, Math.max(0, shown - used)).join(''); used += [...ln].length; if (part) K.text(c, part, 540, ty + k * lh, { size, col: C.cream }); });
  K.cardCenter(c, lt, t, n); K.finish(c); };

// ---------- 字幕 ----------
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; let size = 52; c.font = `${size}px "PuHui-Bold"`; c.textAlign = 'center'; c.textBaseline = 'middle'; while (c.measureText(text).width > 960 && size > 40) { size -= 2; c.font = `${size}px "PuHui-Bold"`; }
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480; c.fillStyle = 'rgba(52,28,14,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 16); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 2); c.restore(); };
})();
