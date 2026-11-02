// 套件 nouveau（慕夏新艺术 10_nouveau）：竖屏 1080x1920。导出 window.K。
// 手法：灰绿→米→桃竖渐变＋圆点花纹＋金框；可变线宽 ribbon（鞭线）；主体深棕粗描边＋偏移投影；光环、药丸标签、地砖带；颗粒。
// 所有道具签名 (c, x, y, ...)，c 可以是主画布也可以是离屏层；动画由调用者传 lt 或 o.p(0..1)、t（连续时间）驱动，不自己计时。
// 随机一律 U.hash / U.rng 种子，确定性。底版 K.once 缓存。字体只用引擎自带 PuHui-Black/Heavy/Bold。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
const C = K.C = { paper: '#efe6ce', cream: '#f6eedb', gold: '#c9a24a', goldD: '#9c7a2e', line: '#4a2f25', ink: '#4a2f25',
  green: '#b9cba0', green2: '#cfd3a6', peach: '#ecc9a2', sand: '#e9d3a8', dot: 'rgba(120,140,100,.38)',
  banner: '#8fac80', bannerD: '#6f8f63', rose: '#e8a8a8', roseD: '#d48e8c', poppy: '#e06666',
  teal: '#2e7d6b', tealL: '#5f9a82', tealD: '#26453a', stone: '#e9dcc0', stoneD: '#cdbb98', money: '#9fc08a', moneyD: '#5f8a58', grey: '#b8ad90' };
K.SAFE = { top: 200, bot: 1350, sub: 1480 };
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.mix = (a, b, k) => { const f = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = f(a), B = f(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, '0')).join(''); };
const stroke = (c, w = 3.5) => { c.lineWidth = w; c.strokeStyle = C.line; c.lineJoin = 'round'; c.lineCap = 'round'; };
const fs = (c, fill, w = 3.5) => { c.fillStyle = fill; c.fill(); stroke(c, w); c.stroke(); };
const shadowOf = (c, fn, dx = 5, dy = 6) => { c.save(); c.translate(dx, dy); fn(C.line); c.restore(); };

// ---------- 鞭线：Catmull-Rom 加密＋可变线宽 ribbon ----------
K.dense = (pts, n = 10) => { const o = [], N = pts.length, g = i => pts[Math.max(0, Math.min(N - 1, i))];
  for (let i = 0; i < N - 1; i++) { const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3); o.push([f(0), f(1)]); } }
  o.push(pts[N - 1]); return o; };
K.ribbon = (pts, wf) => { const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wf(i / (n - 1)) / 2; L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]); }
  const p = new Path2D(); L.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]); p.closePath(); return p; };
K.swellW = wmax => q => 2 + (wmax - 2) * Math.sin(Math.PI * clamp(q));

// ---------- 底版（缓存）：o.tone = sage（默认，灰绿→米→桃）| rose（偏红，借债）| sand（暖沙）| dark（深青，偏沉/软肋） ----------
const TONES = { sage: [C.green, C.green2, C.peach, C.dot], rose: ['#e9bfae', '#f0d4b8', '#e8c39a', 'rgba(190,120,100,.34)'],
  sand: ['#e8dcb4', '#eadab4', '#e8c8a0', 'rgba(170,140,80,.34)'], dark: ['#35705f', '#3f7a64', '#4d7658', 'rgba(246,238,219,.2)'] };
K.bg = (c, t, o = {}) => {
  const tone = o.tone || 'sage', cv = K.once('bg_' + tone, () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), T = TONES[tone] || TONES.sage;
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, T[0]); gr.addColorStop(0.5, T[1]); gr.addColorStop(1, T[2]);
    g.fillStyle = gr; g.fillRect(28, 28, W - 56, H - 56);
    g.strokeStyle = T[3]; g.lineWidth = 2; g.fillStyle = T[3];
    for (let r = 0, y = 50; y < H - 40; r++, y += 54) for (let x = 50 + (r % 2) * 31; x < W - 40; x += 62) { g.beginPath(); g.arc(x, y, 10, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
    const nc = document.createElement('canvas'); nc.width = 108; nc.height = 192; const ng = nc.getContext('2d'), id = ng.createImageData(108, 192);
    for (let y = 0; y < 192; y++) for (let x = 0; x < 108; x++) { const v = P.fbm(x * 0.09 + 3, y * 0.09, 4), i = (y * 108 + x) * 4; id.data[i] = 150; id.data[i + 1] = 130; id.data[i + 2] = 90; id.data[i + 3] = Math.max(0, (v - 0.45)) * 160; }
    ng.putImageData(id, 0, 0); g.globalAlpha = tone === 'dark' ? 0.3 : 0.5; g.imageSmoothingEnabled = true; g.drawImage(nc, 0, 0, W, H); g.globalAlpha = 1;
    g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44); g.strokeRect(34, 34, W - 68, H - 68);
    g.strokeStyle = C.gold; g.lineWidth = 8; g.strokeRect(28, 28, W - 56, H - 56);
    return cv; });
  c.drawImage(cv, 0, 0);
};
// 每镜收尾：颗粒＋字幕带 y1350–1600 压成柔和暖米带（深字幕板可读，不放内容）
K.finish = (c) => {
  const b = c.createLinearGradient(0, 1350, 0, 1600); b.addColorStop(0, 'rgba(236,201,162,0)'); b.addColorStop(0.3, 'rgba(236,214,176,.86)'); b.addColorStop(0.75, 'rgba(236,214,176,.86)'); b.addColorStop(1, 'rgba(236,201,162,0)');
  c.fillStyle = b; c.fillRect(0, 1350, W, 250);
  c.drawImage(P.grain('nv', 0.05, [110, 80, 50], 0.14), 0, 0);
};

// ---------- 文字 ----------
// K.text(c,s,x,y,{size,fam,col,align,alpha,scale,track,maxW,rot,stroke})：默认 PuHui-Black；stroke>0 先描深棕边再填
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, stroke: sk = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k); c.textAlign = align; c.textBaseline = 'middle';
  if (sk) { c.lineJoin = 'round'; c.strokeStyle = C.line; c.lineWidth = sk; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.textW = (c, s, size, fam = 'PuHui-Black') => { c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width; c.restore(); return w; };
// K.popText(c,s,x,y,lt,at,o)：backOut 弹出。o.pill 为真用药丸标签，否则描边大字。o 其余同 K.text / K.pill
K.popText = (c, s, x, y, lt, at, o = {}) => { const k = K.pop(lt, at, o.dur || 0.5); if (k <= 0) return;
  if (o.pill) K.pill(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: clamp(k * 2) * (o.alpha ?? 1) });
  else K.text(c, s, x, y, { size: 110, stroke: 10, ...o, scale: k * (o.scale || 1), alpha: clamp(k * 2) * (o.alpha ?? 1) }); };
K.split2 = s => { const a = [...s]; return a.length <= 6 ? [s] : [a.slice(0, Math.ceil(a.length / 2)).join(''), a.slice(Math.ceil(a.length / 2)).join('')]; };

// 药丸标签 K.pill(c,s,x,y,{w,h,size=88,fill=teal,col=cream,scale,alpha,rot})：金边药丸，描边字；w 缺省按字宽。返回宽。≥52px
K.pill = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 88), h = o.h || size * 1.4, w = o.w || K.textW(c, s, size) + size * 1.1, fill = o.fill || C.teal, sc = o.scale ?? 1; if (sc <= 0) return w;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(sc, sc);
  c.fillStyle = C.line; c.beginPath(); c.roundRect(-w / 2 + 5, -h / 2 + 6, w, h, h / 2); c.fill();
  c.fillStyle = C.gold; c.beginPath(); c.roundRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, h / 2 + 6); c.fill(); stroke(c, 3); c.stroke();
  c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h / 2); c.fill(); c.stroke();
  K.text(c, s, 0, size * 0.04, { size, col: o.col || C.cream, stroke: Math.round(size / 11), maxW: w - size * 0.5 }); c.restore(); return w; };
// 小标签 K.tag(c,s,x,y,{size=54,fill=rose,col=line,align:'center'|'left',scale,alpha})：圆角矩形，深棕字，不描边（说明、图例、示意）
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 54), w = K.textW(c, s, size) + size * 0.9, h = size * 1.4, ox = o.align === 'left' ? w / 2 : 0, sc = o.scale ?? 1; if (sc <= 0) return w;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(sc, sc); c.fillStyle = C.line; c.beginPath(); c.roundRect(-w / 2 + ox + 4, -h / 2 + 5, w, h, 14); c.fill();
  c.fillStyle = o.fill || C.rose; c.beginPath(); c.roundRect(-w / 2 + ox, -h / 2, w, h, 14); c.fill(); stroke(c, 3); c.stroke();
  K.text(c, s, ox, size * 0.04, { size, col: o.col || C.line }); c.restore(); return w; };
K.shiyi = (c, x, y) => K.tag(c, '示意', x, y, { fill: C.stone, align: 'left' });
// 引线标注：金色鞭线从 (ax,ay) 画向 (bx,by)，末端药丸/标签。o { pill:true(默认)|false 用 tag, fill, size, hot }
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.lineCap = 'round'; c.strokeStyle = C.line; c.lineWidth = 12; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.strokeStyle = C.gold; c.lineWidth = 6; c.stroke(); c.fillStyle = o.hot ? C.poppy : C.gold; c.beginPath(); c.arc(ax, ay, 14 * Math.min(1, p1 * 3), 0, TAU); c.fill(); stroke(c, 3); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const sz = Math.max(52, o.size || 64), t = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  if (o.pill === false) K.tag(c, t, bx, by, { ...o, scale: q, size: sz, align: 'left' }); else K.pill(c, t, bx, by, { ...o, size: sz, scale: q, fill: o.hot ? C.poppy : (o.fill || C.teal) }); };

// 离屏层＋整体错位深棕剪影＝粗外轮廓。只在屏幕坐标用（不要放进 K.world 里）：K.outlined(c, g => { …画到 g… })
K.outlined = (c, draw) => { const lay = K.once('outl', () => { const mk = () => { const v = document.createElement('canvas'); v.width = W; v.height = H; return v; }; return { L: mk(), S: mk() }; });
  const g = lay.L.getContext('2d'), s = lay.S.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); draw(g);
  s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, W, H); s.drawImage(lay.L, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = C.line; s.fillRect(0, 0, W, H);
  [[-2, -2], [4, 5], [2, 3]].forEach(([dx, dy]) => c.drawImage(lay.S, dx, dy)); c.drawImage(lay.L, 0, 0); };

// ---------- 光环 K.halo(c,cx,cy,R,t,{p:0..1 出现,fill,dots=24,petals=36,spin=1}) ----------
// 米色圆盘＋金环＋外圈圆钉（顺转）＋内圈花瓣（反转）。内部可画主体，半径 R 内是主体区，外圈到 R+115
K.halo = (c, cx, cy, R, t, o = {}) => { const p = o.p ?? 1; if (p <= 0) return; const sp = o.spin ?? 1, k = p >= 1 ? 1 : MO.backOut(p, 1.2);
  c.save(); c.translate(cx, cy); c.scale(k, k); c.fillStyle = o.fill || 'rgba(246,238,219,.72)'; c.beginPath(); c.arc(0, 0, R + 70, 0, TAU); c.fill();
  c.lineWidth = 8; c.strokeStyle = C.gold; c.stroke(); c.lineWidth = 2.5; c.strokeStyle = C.line; c.beginPath(); c.arc(0, 0, R + 76, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, R + 64, 0, TAU); c.stroke();
  const nd = o.dots ?? 24, np = o.petals ?? 36;
  for (let i = 0; i < nd; i++) { const a = i / nd * TAU + t * 0.5 * sp; c.fillStyle = i % 2 ? C.rose : C.cream; c.beginPath(); c.arc(Math.cos(a) * (R + 98), Math.sin(a) * (R + 98), 15, 0, TAU); c.fill(); stroke(c, 3); c.stroke(); }
  for (let i = 0; i < np; i++) { const a = i / np * TAU - t * 0.35 * sp; c.save(); c.translate(Math.cos(a) * (R - 78), Math.sin(a) * (R - 78)); c.rotate(a); c.fillStyle = i % 2 ? '#e8d9b0' : '#f1e6c8'; c.beginPath(); c.ellipse(0, 0, 16, 6, 0, 0, TAU); c.fill(); c.restore(); }
  c.restore(); };

// ---------- 鞭线箭头 ----------
// K.arrow(c,pts,{col=poppy,wmax=34,p=1,head=true})：pts=[[x,y],…] 控制点（≥2），Catmull-Rom 平滑；线宽中段粗两头细；p 0..1 画到哪（箭头跟着头走）
K.arrow = (c, pts, o = {}) => { const p = clamp(o.p ?? 1); if (p <= 0.02) return; const d = K.dense(pts, 12), n = Math.max(3, Math.round(d.length * p)), body = d.slice(0, n), col = o.col || C.poppy, wm = o.wmax || 34;
  const wf = q => wm * Math.sin(Math.PI * Math.min(1, 0.1 + q * 0.7)) + 14; c.save(); c.fillStyle = C.line; c.fill(K.ribbon(body, q => wf(q) + 6)); c.fillStyle = col; c.fill(K.ribbon(body, wf));
  if (o.head !== false) { const a = body[body.length - 1], b = body[Math.max(0, body.length - 4)], ang = Math.atan2(a[1] - b[1], a[0] - b[0]), s = wm / 34;
    c.translate(a[0], a[1]); c.rotate(ang); c.scale(s, s); c.lineWidth = 5; c.lineJoin = 'round'; c.strokeStyle = C.line; c.fillStyle = col; c.beginPath(); c.moveTo(30, 0); c.lineTo(-40, -44); c.lineTo(-28, 0); c.lineTo(-40, 44); c.closePath(); c.fill(); c.stroke(); }
  c.restore(); };
// K.arcArrow(c,cx,cy,R,a0,a1,{…K.arrow})：沿圆弧从角 a0 到 a1（画布角，弧度，顺时针为增大；a1<a0 则逆时针）
K.arcArrow = (c, cx, cy, R, a0, a1, o = {}) => { const pts = []; for (let i = 0; i <= 20; i++) { const a = lerp(a0, a1, i / 20); pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } K.arrow(c, pts, o); };

// ---------- 金框卡 K.card(c,x,y,w,h,{title,fill,rot,scale,alpha,draw(c,w,h),fillTitle}) ----------
// (x,y)=中心。title 是顶部药丸条（字≥52）。draw 回调在卡内以中心为原点画内容（可用 K.big/K.bars/K.line…，画布宽高 w,h）
K.card = (c, x, y, w, h, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(sc, sc);
  c.fillStyle = C.line; c.beginPath(); c.roundRect(-w / 2 + 8, -h / 2 + 10, w, h, 26); c.fill();
  c.fillStyle = C.gold; c.beginPath(); c.roundRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 32); c.fill(); stroke(c, 4); c.stroke();
  c.fillStyle = o.fill || C.cream; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 24); c.fill(); stroke(c, 3); c.stroke();
  c.strokeStyle = C.gold; c.lineWidth = 3; c.beginPath(); c.roundRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 14); c.stroke();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { c.fillStyle = C.gold; c.beginPath(); c.arc(sx * (w / 2 - 14), sy * (h / 2 - 14), 9, 0, TAU); c.fill(); stroke(c, 2.5); c.stroke(); });
  if (o.draw) { c.save(); c.beginPath(); c.roundRect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 10); c.clip(); o.draw(c, w, h); c.restore(); }
  if (o.title) K.pill(c, o.title, 0, -h / 2 - 6, { size: 64, fill: o.fillTitle || C.teal, maxW: w - 60 });
  c.restore(); };

// ---------- 数字大字 K.big(c,s,x,y,{size=200,unit,col=cream,usize,sub,scale,alpha}) ----------
// s 是数字串（如 '35'），unit 是单位（'%'、'倍'、'亿'）；整体居中于 x。sub 在下方一行小字标签（tag）
K.big = (c, s, x, y, o = {}) => { const size = o.size || 200, us = o.usize || size * 0.45, sw = K.textW(c, s, size), uw = o.unit ? K.textW(c, o.unit, us) + 10 : 0, tot = sw + uw, sc = o.scale ?? 1; if (sc <= 0) return;
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(sc, sc);
  K.text(c, s, -tot / 2 + sw / 2, 0, { size, col: o.col || C.cream, stroke: Math.round(size / 9), align: 'center' });
  if (o.unit) K.text(c, o.unit, -tot / 2 + sw + 10 + (uw - 10) / 2, size * 0.18, { size: us, col: o.ucol || C.gold, stroke: Math.round(us / 8) });
  if (o.sub) K.tag(c, o.sub, 0, size * 0.78, { fill: o.subFill || C.cream }); c.restore(); };

// ---------- 横幅与地砖带 ----------
// K.banner(c,s,x,y,w,h,{fill=banner,size,col,scale,alpha,track})：(x,y)=中心的标题横幅，金细框，描边字
K.banner = (c, s, x, y, w, h, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(sc, sc);
  c.fillStyle = C.line; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 8, w, h, 18); c.fill(); c.fillStyle = o.fill || C.banner; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 18); c.fill(); stroke(c, 5); c.stroke();
  c.lineWidth = 3; c.strokeStyle = C.gold; c.beginPath(); c.roundRect(-w / 2 + 16, -h / 2 + 14, w - 32, h - 28, 10); c.stroke();
  K.text(c, s, 0, 5, { size: o.size || Math.min(128, h * 0.85), col: o.col || C.cream, stroke: 12, track: o.track ?? 8, maxW: w - 70 }); c.restore(); };
// K.tiles(c,y,{h=48,x0=40,x1=W-40,p=1,shift=0})：马赛克地砖带（两排 20px 方砖），可整段当进度条（p）、shift 横向流动
const MC = ['#c9a24a', '#5f9a82', '#e8a8a8', '#f6eedb', '#8fac80', '#e06666', '#2e7d6b', '#e8d9b0', '#9c7a2e'];
K.tiles = (c, y, o = {}) => { const h = o.h || 48, x0 = o.x0 ?? 40, x1 = o.x1 ?? W - 40, rows = Math.max(1, Math.round(h / 24)), sh = Math.floor((o.shift || 0) / 20), lim = x0 + (x1 - x0) * clamp(o.p ?? 1);
  for (let r = 0; r < rows; r++) for (let x = x0, k = 0; x < lim; x += 20, k++) { c.fillStyle = MC[((k + sh) * 7 + ((k + sh) >> 2) + r * 3 + 90) % 9]; c.fillRect(x, y + r * 24, Math.min(20, lim - x), 24); }
  c.lineWidth = 3; c.strokeStyle = C.line; c.strokeRect(x0, y, lim - x0, rows * 24); };

// ---------- 示意图表（自动带「示意」） ----------
// K.bars(c,x,y,w,h,vals,{p,hi,labels,col,note=true})：(x,y)=左上；vals 0..1；hi 某根标珊瑚红；labels 每根底下一行字（≥44px）
K.bars = (c, x, y, w, h, vals, o = {}) => { const n = vals.length, gap = Math.max(14, w / n * 0.22), bw = (w - gap * (n - 1)) / n, p = o.p ?? 1;
  c.save(); stroke(c, 4); c.beginPath(); c.moveTo(x - 14, y + h); c.lineTo(x + w + 14, y + h); c.stroke(); c.strokeStyle = C.gold; c.lineWidth = 6; c.stroke();
  vals.forEach((v, i) => { const g = K.ease(clamp(p * (1 + 0.5 * (n - 1) / n) - i * 0.5 / n)), bh = Math.max(0, h * v * g), bx = x + i * (bw + gap); if (bh < 2) return;
    const col = i === o.hi ? C.poppy : (o.col || (i % 2 ? C.rose : C.tealL)); c.fillStyle = C.line; c.beginPath(); c.roundRect(bx + 5, y + h - bh + 6, bw, bh, [bw / 2, bw / 2, 4, 4]); c.fill();
    c.fillStyle = col; c.beginPath(); c.roundRect(bx, y + h - bh, bw, bh, [bw / 2, bw / 2, 4, 4]); c.fill(); stroke(c, 3.5); c.stroke();
    c.fillStyle = 'rgba(246,238,219,.35)'; c.fillRect(bx + bw * 0.18, y + h - bh + bw * 0.5, bw * 0.12, Math.max(0, bh - bw * 0.7)); });
  if (o.labels) o.labels.forEach((s, i) => K.text(c, s, x + i * (bw + gap) + bw / 2, y + h + 44, { size: 48, col: C.line, fam: 'PuHui-Bold', maxW: bw + gap }));
  c.restore(); if (o.note !== false) K.shiyi(c, x - 6, y - 46); };
// K.line(c,x,y,w,h,vals,{p,col=poppy,fill,note=true,dot=true})：折线（鞭线粗细）＋下方淡色面积＋末端圆钉。vals 0..1，至少 2 个
K.line = (c, x, y, w, h, vals, o = {}) => { const p = clamp(o.p ?? 1), pts = vals.map((v, i) => [x + w * i / (vals.length - 1), y + h * (1 - v)]), d = K.dense(pts, 12), n = Math.max(2, Math.round(d.length * p)), body = d.slice(0, n), col = o.col || C.poppy;
  c.save(); stroke(c, 4); c.beginPath(); c.moveTo(x - 14, y + h); c.lineTo(x + w + 14, y + h); c.stroke(); c.strokeStyle = C.gold; c.lineWidth = 6; c.stroke();
  c.beginPath(); c.moveTo(body[0][0], y + h); body.forEach(q => c.lineTo(q[0], q[1])); c.lineTo(body[body.length - 1][0], y + h); c.closePath(); c.fillStyle = o.fill || 'rgba(232,168,168,.35)'; c.fill();
  c.fillStyle = C.line; c.fill(K.ribbon(body, () => 20)); c.fillStyle = col; c.fill(K.ribbon(body, () => 12));
  if (o.dot !== false) { const e = body[body.length - 1]; c.fillStyle = C.gold; c.beginPath(); c.arc(e[0], e[1], 22, 0, TAU); c.fill(); stroke(c, 4); c.stroke(); }
  c.restore(); if (o.note !== false) K.shiyi(c, x - 6, y - 46); };

// ---------- 道具：钱 ----------
// K.yen(c,x,y,size,col)：矢量「元」符号（GB2312 没有 ￥，自己画）
K.yen = (c, x, y, s, col = C.line) => { c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = Math.max(2, s * 0.13); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  c.moveTo(-s * 0.36, -s * 0.46); c.lineTo(0, 0.02 * s); c.lineTo(s * 0.36, -s * 0.46); c.moveTo(0, 0.02 * s); c.lineTo(0, s * 0.5); c.moveTo(-s * 0.3, s * 0.08); c.lineTo(s * 0.3, s * 0.08); c.moveTo(-s * 0.3, s * 0.28); c.lineTo(s * 0.3, s * 0.28); c.stroke(); c.restore(); };
// K.coin(c,x,y,r,{rot,spin,scale,alpha})：金币；spin=弧度，按 |cos| 横向压扁像在转
K.coin = (c, x, y, r, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); const sx = o.spin == null ? 1 : Math.max(0.12, Math.abs(Math.cos(o.spin))); c.scale(sx * sc, sc);
  c.fillStyle = C.gold; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); stroke(c, 3); c.stroke(); c.strokeStyle = C.goldD; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 0.68, 0, TAU); c.stroke(); K.yen(c, 0, 0, r * 0.95); c.restore(); };
// K.bill(c,x,y,w,{rot,scale,alpha})：钞票（w 宽，高 w/2）
K.bill = (c, x, y, w, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); c.scale(sc, sc); const h = w * 0.5;
  c.fillStyle = C.money; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 6); fs(c, C.money, 3.5); c.strokeStyle = C.moneyD; c.lineWidth = 2; c.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
  c.fillStyle = C.moneyD; c.beginPath(); c.arc(0, 0, h * 0.26, 0, TAU); c.fill(); K.yen(c, 0, 0, h * 0.34, C.money); c.restore(); };

// ---------- 道具：显卡 ----------
// K.gpu(c,x,y,w=172,h=104,t,{ph,spin=3,tint:'teal'|'rose'|'gold',fade:0..1 褪色,crack:0..1 裂纹,seal:'字' 红封条,scale,alpha})：横放显卡，双风扇随 t 转
K.gpu = (c, x, y, w = 172, h = 104, t = 0, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; const fd = o.fade || 0, base = { teal: C.teal, rose: C.rose, gold: C.gold }[o.tint || 'teal'], bd = K.mix(base, C.grey, fd), hi = K.mix(o.tint === 'rose' ? '#f2c4c0' : o.tint === 'gold' ? '#e0c57a' : C.tealL, C.grey, fd);
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(sc, sc); stroke(c, 3);
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 9); fs(c, bd, 3); c.fillStyle = hi; c.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, 8);
  c.fillStyle = C.gold; c.fillRect(-w / 2 + 14, h / 2 - 2, w - 28, 9); c.strokeRect(-w / 2 + 14, h / 2 - 2, w - 28, 9);
  c.fillStyle = C.cream; c.fillRect(-w / 2 - 6, -h / 2 + 4, 12, h - 8); c.strokeRect(-w / 2 - 6, -h / 2 + 4, 12, h - 8);
  [-1, 1].forEach(s => { const fx = s * w * 0.22, fr = h * 0.36, sp = (o.spin ?? 3) * (1 - fd * 0.8); c.fillStyle = K.mix('#26453a', C.grey, fd * 0.7); c.beginPath(); c.arc(fx, 2, fr + 3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = C.cream; c.beginPath(); c.arc(fx, 2, fr - 3, 0, TAU); c.fill();
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t * sp * s + (o.ph || 0); c.fillStyle = i % 2 ? K.mix(C.rose, C.grey, fd) : K.mix(C.roseD, C.grey, fd); c.beginPath(); c.moveTo(fx, 2); c.arc(fx, 2, fr - 4, a, a + 0.62); c.closePath(); c.fill(); }
    c.fillStyle = C.gold; c.beginPath(); c.arc(fx, 2, 5, 0, TAU); c.fill(); c.stroke(); });
  if (o.crack) { const k = clamp(o.crack), r = U.rng(7 + Math.round((o.ph || 0) * 10)); c.strokeStyle = C.poppy; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); let px = -w * 0.1, py = -h / 2 - 4; c.moveTo(px, py);
    const n = Math.round(6 * k) + 1; for (let i = 0; i < n; i++) { px += (r() - 0.4) * 30; py += h / 6.2; c.lineTo(px, Math.min(py, h / 2 + 4)); } c.stroke(); }
  if (o.seal) K.pill(c, o.seal, w * 0.28, -h * 0.5, { size: 52, h: 66, fill: C.poppy, rot: -0.2 });
  c.restore(); };

// ---------- 道具：银行 ----------
// K.bank(c,x,y,s=1,{cols=5,coin=true,fade,scale,alpha})：(x,y)=底边中点，高约 300s、宽 300s；柱廊＋粉红三角楣＋金币
K.bank = (c, x, y, s = 1, o = {}) => { const sc = (o.scale ?? 1); if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(s * sc, s * sc); stroke(c, 3);
  c.fillStyle = C.stoneD; c.fillRect(-150, -26, 300, 26); c.strokeRect(-150, -26, 300, 26); c.fillStyle = C.stone; c.fillRect(-130, -50, 260, 24); c.strokeRect(-130, -50, 260, 24);
  const n = o.cols || 5, gap = 200 / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) { const cx = -100 + i * gap; c.fillStyle = C.stone; c.fillRect(cx - 14, -190, 28, 140); c.strokeRect(cx - 14, -190, 28, 140); c.strokeStyle = C.stoneD; c.beginPath(); c.moveTo(cx - 4, -180); c.lineTo(cx - 4, -60); c.moveTo(cx + 5, -180); c.lineTo(cx + 5, -60); c.stroke(); stroke(c, 3);
    c.fillStyle = C.gold; c.fillRect(cx - 19, -202, 38, 14); c.strokeRect(cx - 19, -202, 38, 14); }
  c.fillStyle = C.cream; c.fillRect(-135, -214, 270, 14); c.strokeRect(-135, -214, 270, 14);
  c.beginPath(); c.moveTo(-145, -214); c.lineTo(0, -300); c.lineTo(145, -214); c.closePath(); fs(c, C.rose, 3);
  if (o.coin !== false) { c.fillStyle = C.gold; c.beginPath(); c.arc(0, -246, 28, 0, TAU); c.fill(); stroke(c, 3); c.stroke(); K.yen(c, 0, -246, 30); }
  c.restore(); };

// ---------- 道具：机架 ----------
// K.rack(c,x,y,w=170,h=300,t=0,{n=6,lit:亮几格(默认全亮),ph,scale,alpha})：(x,y)=中心；服务器机架，指示灯按 t 闪（确定性）
K.rack = (c, x, y, w = 170, h = 300, t = 0, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; const n = o.n || 6, lit = o.lit ?? n; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(sc, sc);
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 10); fs(c, C.tealD, 4); c.fillStyle = C.gold; c.fillRect(-w / 2 - 6, -h / 2 - 12, w + 12, 16); c.strokeRect(-w / 2 - 6, -h / 2 - 12, w + 12, 16);
  const sh = (h - 36) / n; for (let i = 0; i < n; i++) { const sy = -h / 2 + 18 + i * sh; c.beginPath(); c.roundRect(-w / 2 + 12, sy + 3, w - 24, sh - 7, 6); fs(c, i < lit ? C.teal : K.mix(C.teal, C.grey, 0.6), 3);
    c.fillStyle = 'rgba(246,238,219,.5)'; for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + 24, sy + 10 + k * ((sh - 22) / 4), w * 0.42, 3);
    const on = i < lit && U.hash(i + Math.round((o.ph || 0) * 7), Math.floor(t * 3)) > 0.3; c.fillStyle = i >= lit ? C.grey : on ? C.poppy : C.rose; c.beginPath(); c.arc(w / 2 - 34, sy + sh / 2 - 2, 7, 0, TAU); c.fill(); c.fillStyle = on ? C.cream : C.gold; c.beginPath(); c.arc(w / 2 - 54, sy + sh / 2 - 2, 5, 0, TAU); c.fill(); }
  c.restore(); };

// ---------- 道具：闪电 ----------
// K.bolt(c,x,y,s=1,{col=gold,rot,scale,alpha})：(x,y)=中心，高约 220s
K.bolt = (c, x, y, s = 1, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); c.scale(s * sc, s * sc);
  c.beginPath(); [[20, -110], [-50, 10], [-6, 10], [-26, 110], [50, -20], [6, -20]].forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); fs(c, o.col || C.gold, 5); c.restore(); };

// ---------- 道具：合同卷轴 ----------
// K.scroll(c,x,y,w=300,h=400,{p:展开0..1,lines=6,seal:'约',scale,alpha,rot})：(x,y)=中心；上下卷轴，字行用色条表示，右下朱红印
K.scroll = (c, x, y, w = 300, h = 400, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; const hh = h * lerp(0.35, 1, K.ease(o.p ?? 1)); c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(sc, sc);
  c.beginPath(); c.rect(-w / 2 + 12, -hh / 2, w - 24, hh); fs(c, C.cream, 4);
  const nl = o.lines || 6; if (hh > h * 0.6) for (let i = 0; i < nl; i++) { const ly = -hh / 2 + 56 + i * ((hh - 130) / nl), lw = (w - 90) * (i === nl - 1 ? 0.5 : 0.95 - (i % 3) * 0.12); c.fillStyle = i === 0 ? C.teal : C.stoneD; c.beginPath(); c.roundRect(-w / 2 + 40, ly, lw, i === 0 ? 14 : 10, 5); c.fill(); }
  [-1, 1].forEach(s => { c.beginPath(); c.roundRect(-w / 2 - 4, s * hh / 2 - 15 + (s > 0 ? 0 : 0), w + 8, 30, 15); fs(c, C.gold, 4); c.fillStyle = C.goldD; c.beginPath(); c.arc(-w / 2 - 4, s * hh / 2, 11, 0, TAU); c.fill(); c.beginPath(); c.arc(w / 2 + 4, s * hh / 2, 11, 0, TAU); c.fill(); });
  if (o.seal !== false && hh > h * 0.8) { c.save(); c.translate(w * 0.22, hh / 2 - 82); c.rotate(-0.2); c.fillStyle = C.poppy; c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.fill(); stroke(c, 3.5); c.stroke(); K.text(c, o.seal || '约', 0, 3, { size: 54, col: C.cream }); c.restore(); }
  c.restore(); };

// ---------- 人物：只出剪影与手，不画脸 ----------
// K.silhouette(c,x,y,s=1,{pose:'stand'|'bust'|'bow',hat,col,scale,alpha})：(x,y)=脚底（bust 为胸口截断线）中点，stand 高约 320s；深棕块面＋金色边光。hat=礼帽
K.silhouette = (c, x, y, s = 1, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; const pose = o.pose || 'stand'; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.scale(s * sc, s * sc);
  if (pose === 'bust') { c.beginPath(); c.rect(-200, -400, 400, 400); c.clip(); c.translate(0, 170); }
  if (pose === 'bow') c.transform(1, 0, -0.22, 1, 0, 0);
  const body = new Path2D('M-34,-258 C-84,-250 -80,-196 -78,-150 L-90,0 L90,0 L78,-150 C80,-196 84,-250 34,-258 Z'), col = o.col || C.line, hy = pose === 'bow' ? -258 : -292;
  c.fillStyle = col; c.fill(body); c.beginPath(); c.arc(0, hy, 31, 0, TAU); c.fill(); c.fillRect(-12, hy + 20, 24, 30);
  if (o.hat) { c.fillRect(-46, hy - 24, 92, 9); c.fillRect(-27, hy - 70, 54, 50); c.fillStyle = C.gold; c.fillRect(-27, hy - 38, 54, 8); c.fillStyle = col; }
  c.strokeStyle = C.gold; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-34, -258); c.bezierCurveTo(-84, -250, -80, -196, -78, -150); c.stroke(); c.beginPath(); c.arc(0, hy, 31, Math.PI * 0.62, Math.PI * 1.15); c.stroke(); c.restore(); };
// K.hand(c,x,y,{kind:'open'|'point'|'fist'|'flat'|'pinch',rot,s=1,scale,alpha})：(x,y)=袖口中点，手向上伸；rot 绕袖口旋转（弧度，0=向上，PI/2=向右）。袖口深青＋金边，手桃色深棕描边
K.hand = (c, x, y, o = {}) => { const sc = o.scale ?? 1; if (sc <= 0) return; const s = o.s ?? 1, kind = o.kind || 'open'; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); c.rotate(o.rot || 0); c.scale(s * sc, s * sc);
  const fing = (x0, y0, x1, y1, wd = 30) => { c.lineCap = 'round'; c.strokeStyle = C.line; c.lineWidth = wd + 8; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = '#f0d3b0'; c.lineWidth = wd; c.stroke(); };
  c.beginPath(); c.roundRect(-52, -10, 104, 110, 8); fs(c, C.teal, 4); c.fillStyle = C.gold; c.fillRect(-52, 14, 104, 14); c.strokeRect(-52, 14, 104, 14);
  c.beginPath(); c.roundRect(-44, -96, 88, 96, 22); fs(c, '#f0d3b0', 4);
  const F = { open: [[-34, -90, -48, -178], [-12, -94, -14, -196], [12, -94, 22, -192], [34, -88, 54, -166]], flat: [[-33, -90, -33, -190], [-11, -94, -11, -198], [11, -94, 11, -194], [33, -88, 33, -180]],
    point: [[-33, -90, -33, -126], [11, -94, 8, -240], [11, -94, 33, -124], [33, -88, 36, -116]], fist: [[-33, -90, -33, -122], [-11, -94, -11, -128], [11, -94, 11, -126], [33, -88, 33, -118]], pinch: [[-33, -90, -33, -128], [-11, -94, -11, -132], [11, -94, 4, -190], [33, -88, 36, -120]] }[kind] || [];
  F.forEach(f => fing(...f, 26)); fing(-40, -48, kind === 'pinch' ? -6 : kind === 'fist' ? -4 : -74, kind === 'pinch' ? -170 : kind === 'fist' ? -96 : -110, 28);
  c.restore(); };

// ---------- 章节卡（每章第一镜） ----------
// 四种底调轮换；金光环里大数字，药丸「第 N 章」，横幅逐字打出章名，下方 N 站金链进度，贯穿物（小显卡）跳到本站。换书可改 K.cardToken
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters;
K.CARD_TONES = ['sage', 'rose', 'sand', 'dark'];
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking) => K.gpu(c, x, y, 96, 58, t, { spin: walking ? 8 : 3 }));
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  K.bg(c, t, { tone: K.CARD_TONES[(n - 1) % K.CARD_TONES.length] });
  const N = Math.max((K.CHAPTER_NAMES || []).length, n, 2), x0 = 110, x1 = 970, y = 1290, X = i => lerp(x0, x1, i / (N - 1));
  K.halo(c, 540, 470, 200, t, { p: K.at(lt, 0, 0.5) });
  K.text(c, String(n), 540, 490, { size: 320, col: C.cream, stroke: 26, scale: K.pop(lt, 0.2, 0.5) });
  K.popText(c, `第${n}章`, 540, 765, lt, 0.35, { pill: true, size: 84, fill: C.poppy });
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.6, Math.max(0.3, all / 14)) * all), sz = lines.length > 1 ? 112 : all > 5 ? 118 : 140, bh = lines.length > 1 ? 330 : 220, by = lines.length > 1 ? 1030 : 985;
  const kb = K.pop(lt, 0.45, 0.5); if (kb > 0) { K.banner(c, '', 540, by, 920, bh, { scale: kb });
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) K.text(c, a.slice(0, kk).join(''), 540, by + (i - (lines.length - 1) / 2) * sz * 1.18 + 5, { size: sz, col: C.cream, stroke: 12, track: 6, maxW: 840 }); }); }
  const walkEnd = 1.15, q = MO.cubicInOut(K.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  c.strokeStyle = C.line; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y); c.stroke(); c.strokeStyle = C.cream; c.lineWidth = 8; c.stroke();
  c.strokeStyle = C.gold; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(Math.max(x0 - 20, lerp(from, done, q)), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.45) : 1, r = cur ? 19 * Math.max(0.6, pp) : 11; c.fillStyle = past ? C.gold : cur ? C.poppy : C.cream; c.beginPath(); c.arc(X(i), y, r, 0, TAU); c.fill(); stroke(c, 3); c.stroke(); }
  const tx = lerp(from, done, q), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 36 : -Math.max(0, 1 - (lt - walkEnd) * 4) * 14; K.cardToken(c, tx, y - 62 + hop, lt, t, lt < walkEnd);
  K.finish(c);
};

// ---------- 字幕：深棕底板＋奶油字＋金色偏移边，字幕带 y≈1480 ----------
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = C.gold; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 7, w, h, 22); c.fill();
  c.fillStyle = 'rgba(58,36,28,.95)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 22); c.fill();
  c.fillStyle = C.cream; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
