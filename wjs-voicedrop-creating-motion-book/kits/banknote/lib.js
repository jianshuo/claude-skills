// 画风套件 banknote（来自《读懂美联储》）：竖屏 1080×1920，美元钞票凹版风。导出 window.K（章节代码里写 const F = K）。
// 规矩：米黄钞纸底＋墨绿凹版细线（排线明暗、玫瑰花纹、双线花框），印章红只给关键数字和结论；
//       不用渐变底、不用发光；所有细线 ≥2px、排线间距 ≥6px（视频号压缩后不糊成灰块、不出摩尔纹）。
//       环境层：角落一朵玫瑰花纹缓慢旋转、纸纹不动；主体落定即停。所有随机走 U.hash / U.rng。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const F = window.K = { W, H, TAU };
// 兜底：pop 的回弹起步段会让「r - 线宽」之类算成负数，canvas 遇负半径直接抛错、整段渲染失败（30fps 才撞上，10fps 冒烟漏过）。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;   // 径向渐变同理：r0/r1 为负也抛 IndexSizeError
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = F.C = {
  paper: '#EFE8D2', paper2: '#E4DABC', paper3: '#D6C9A4',
  ink: '#1F4A3A', ink2: '#2F6B52', inkL: '#8FA593', red: '#9C2E24', redL: '#C2574A',
};
F.at = (lt, a, d) => clamp((lt - a) / d);
F.pop = (lt, a, d = 0.5) => { const q = F.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
F.cache = {}; F.once = (k, f) => F.cache[k] || (F.cache[k] = f());
F.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('F.t0: 段落表里没有 ' + id); return e.t0; };
F.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
F.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
F.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 玫瑰花纹（guilloche）：n 条正弦调制闭合曲线 ----------
F.rosette = (g, cx, cy, R, r, n, k, lw = 2, a = 0.5, rot = 0, col = C.ink2) => { g.save(); g.strokeStyle = col; g.globalAlpha *= a; g.lineWidth = lw;
  for (let j = 0; j < n; j++) { g.beginPath(); for (let i = 0; i <= 360; i++) { const th = i / 360 * TAU, rr = R + r * Math.sin(k * th + j * TAU / n + rot); const x = cx + rr * Math.cos(th + rot * 0.2), y = cy + rr * Math.sin(th + rot * 0.2); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.restore(); };
// ---------- 凹版排线：在 path 里按角度画等距平行线 ----------
F.hatch = (g, path, ang = -0.6, gap = 8, lw = 2, col = C.ink2, a = 1) => { g.save(); g.clip(path); g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha *= a; g.beginPath();
  const ca = Math.cos(ang), sa = Math.sin(ang); for (let d = -2600; d < 2600; d += gap) { g.moveTo(-2600 * ca - d * sa + W / 2, -2600 * sa + d * ca + H / 2); g.lineTo(2600 * ca - d * sa + W / 2, 2600 * sa + d * ca + H / 2); } g.stroke(); g.restore(); };
// ---------- 凹版物件（相当于扁平风的 flat）：纸色底＋主排线＋暗部交叉排线＋粗墨边 ----------
// o: { fill, ang, gap, dark (0..1 交叉线强度), lw, edge, col }
F.engrave = (g, path, o = {}) => { const { fill = C.paper2, ang = -0.6, gap = 9, dark = 0.4, lw = 2, edge = 4, col = C.ink2 } = o;
  g.fillStyle = fill; g.fill(path); F.hatch(g, path, ang, gap, lw, col, 0.85);
  if (dark > 0) { g.save(); g.clip(path); g.translate(10, 12); F.hatch(g, path, ang + 1.2, gap * 1.1, lw, C.ink, dark); g.restore(); }
  if (edge) { g.lineWidth = edge; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke(path); } };
// 实心墨色物件（剪影、深色块）＋一圈细白线做雕刻高光
F.solid = (g, path, col = C.ink) => { g.fillStyle = col; g.fill(path); g.save(); g.clip(path); g.translate(-6, -6); g.lineWidth = 3; g.strokeStyle = 'rgba(239,232,210,.35)'; g.stroke(path); g.restore(); };

// ---------- 底：钞纸＋纤维＋细双线外框＋角落玫瑰（环境层，慢转） ----------
F.paperTex = () => P.cached('fed_paper', W, H, g => { g.fillStyle = C.paper; g.fillRect(0, 0, W, H); const r = U.rng(3);
  for (let i = 0; i < 12000; i++) { g.fillStyle = `rgba(110,90,50,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2 + r() * 2, 1.5); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(47,107,82,${0.05 + r() * 0.06})`; g.lineWidth = 2; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y + r() * 20, x + 60, y + 10); g.stroke(); } });   // 防伪纤维丝
F.frame = () => P.cached('fed_frame', W, H, g => { g.strokeStyle = C.ink; g.lineWidth = 5; g.strokeRect(36, 36, W - 72, H - 72); g.lineWidth = 2.5; g.strokeRect(54, 54, W - 108, H - 108);
  g.strokeStyle = C.ink2; g.lineWidth = 2; for (let i = 0; i < 70; i++) { const x = 54 + i * (W - 108) / 70; g.beginPath(); g.arc(x + (W - 108) / 140, 45, 7, 0, Math.PI); g.stroke(); } });
F.bg = (c, t, o = {}) => { const { corner = 'br', rose = true } = o; c.drawImage(F.paperTex(), 0, 0);
  if (rose) { const [x, y] = corner === 'tl' ? [150, 260] : corner === 'tr' ? [930, 260] : corner === 'bl' ? [150, 1760] : [930, 1760]; F.rosette(c, x, y, 120, 24, 14, 9, 2, 0.32, t * 0.12); }
  c.drawImage(F.frame(), 0, 0); };
// 字幕带：浅纸底上加一条淡墨绿底（字幕另画深色底板）；暗角用纸色压边
F.finish = c => { const g = c.createRadialGradient(W / 2, H * 0.42, 600, W / 2, H * 0.42, 1300); g.addColorStop(0, 'rgba(120,100,60,0)'); g.addColorStop(1, 'rgba(120,100,60,.18)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };

// ---------- 文字 ----------
F.text = (c, s, x, y, o = {}) => { const { size = 60, fam = 'Songti-Black', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px'; c.fillText(s, 0, 0); c.restore(); };
// 票面式标签（cartouche）：纸底＋双线框＋两端小花，字在里面
F.cartouche = (c, s, x, y, o = {}) => { const { size = 56, fam = 'Songti-Black', col = C.ink, scale = 1, alpha = 1, fill = C.paper } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * 1.4, h = size * 1.55;
  c.fillStyle = fill; c.fill(F.round(-w / 2, -h / 2, w, h, h * 0.18)); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke(F.round(-w / 2, -h / 2, w, h, h * 0.18)); c.lineWidth = 2; c.stroke(F.round(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, h * 0.12));
  [-1, 1].forEach(sd => { c.fillStyle = C.ink2; c.beginPath(); c.arc(sd * (w / 2 - size * 0.32), 0, size * 0.1, 0, TAU); c.fill(); });
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 2); c.restore(); };
F.popText = (c, s, x, y, lt, at, o = {}) => { const p = F.pop(lt, at, o.dur || 0.5); if (p <= 0) return; (o.plate ? F.cartouche : F.text)(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// 引线标注：细墨线从锚点画出，末端是票面标签
F.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(F.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 7, 0, TAU); c.fill(); c.restore();
  const q = F.pop(lt, at + 0.25, 0.45); if (q > 0) F.cartouche(c, s, bx, by, { size: o.size || 46, col: o.col || C.ink, scale: q }); };
// 红色印章：圆角方框＋字，按 MO.slamK 砸下，略转
F.stamp = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const { size = 80, rot = -0.12, col = C.red } = o, k = MO.slamK((lt - at) / 0.17);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.font = `${size}px "Songti-Black"`; const w = c.measureText(s).width + size * 0.9, h = size * 1.5;
  c.strokeStyle = col; c.lineWidth = size * 0.09; c.stroke(F.round(-w / 2, -h / 2, w, h, size * 0.12)); c.lineWidth = size * 0.035; c.stroke(F.round(-w / 2 + size * 0.14, -h / 2 + size * 0.14, w - size * 0.28, h - size * 0.28, size * 0.08));
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, size * 0.04);
  c.globalCompositeOperation = 'destination-out'; const r = U.rng(s.length * 31); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`; c.fillRect((r() - 0.5) * w, (r() - 0.5) * h, 3 + r() * 6, 2 + r() * 3); }   // 印泥斑驳
  c.restore(); };

// ---------- 凹版缎带：一束平行细线沿折线走（中心一根红线可选） ----------
F.ribbon = (c, pts, { n = 9, gap = 4.5, lw = 2, col = C.ink2, core = C.red, coreW = 4 } = {}) => {
  for (let k = -(n >> 1); k <= (n >> 1); k++) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y + k * gap) : c.moveTo(x, y + k * gap)); c.strokeStyle = k === 0 && core ? core : col; c.lineWidth = k === 0 && core ? coreW : lw; c.globalAlpha = k === 0 ? 1 : 0.75; c.stroke(); }
  c.globalAlpha = 1; };

// ---------- 数据图：钞票边框式标尺＋当前值吊牌 ----------
// 横轴刻度：小三角＋数值；竖向区间带：两条粗墨线＋排线
F.axis = (c, x0, x1, y, ticks, fmt = v => v) => { c.strokeStyle = C.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  ticks.forEach(([u, v]) => { const x = lerp(x0, x1, u); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 18); c.stroke(); F.text(c, String(fmt(v)), x, y + 52, { size: 40, fam: 'Songti-Regular' }); }); };
F.tag = (c, s, x, y, o = {}) => { const { size = 52, col = C.red } = o; c.save(); c.font = `${size}px "Songti-Black"`; const w = c.measureText(s).width + 40, h = size * 1.4;
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 24, y - h / 2); c.lineTo(x + 24 + w, y - h / 2); c.lineTo(x + 24 + w, y + h / 2); c.lineTo(x + 24, y + h / 2); c.closePath(); c.fill();
  c.fillStyle = C.paper; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(s, x + 44, y + 2); c.restore(); };

// ---------- 人：凹版半身像剪影（不画五官），用排线做明暗 ----------
F.bust = (c, x, y, s, o = {}) => { c.save(); c.translate(x, y); c.scale(s, s);
  const p = F.once('bust', () => { const q = new Path2D(); const h = new Path2D(); h.ellipse(0, -150, 78, 96, 0, 0, TAU); q.addPath(h); const b = new Path2D(); b.moveTo(-190, 160); b.bezierCurveTo(-180, 0, -90, -40, 0, -40); b.bezierCurveTo(90, -40, 180, 0, 190, 160); b.closePath(); q.addPath(b); return q; });
  F.engrave(c, p, { gap: 8 / s, lw: 2 / s, edge: 4 / s, dark: o.dark ?? 0.5, fill: o.fill || C.paper2 }); c.restore(); };
// 小人图标（人群/就业）：头＋肩，纯墨色
F.figure = (c, x, y, s, col = C.ink2, a = 1) => { c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.beginPath(); c.arc(0, -30, 15, 0, TAU); c.fill(); c.fill(F.round(-24, -10, 48, 46, [22, 22, 6, 6])); c.restore(); };

// ---------- 章节卡：一张票面（面额位置写章号，中央椭圆放本章主体） ----------
F.noteCard = (c, lt, t, n, title, drawCenter) => { F.bg(c, t, { rose: false });
  const x0 = 110, y0 = 520, w = 860, h = 760, p = F.round(x0, y0, w, h, 26);
  c.fillStyle = C.paper2; c.fill(p); F.hatch(c, p, 0.5, 10, 2, C.ink2, 0.35); c.lineWidth = 6; c.strokeStyle = C.ink; c.stroke(p); c.lineWidth = 2.5; c.stroke(F.round(x0 + 18, y0 + 18, w - 36, h - 36, 18));
  F.rosette(c, x0 + 120, y0 + 120, 70, 14, 10, 7, 2, 0.7, t * 0.2); F.rosette(c, x0 + w - 120, y0 + h - 120, 70, 14, 10, 7, 2, 0.7, -t * 0.2);
  const ov = new Path2D(); ov.ellipse(W / 2, y0 + h / 2 - 10, 250, 270, 0, 0, TAU); c.fillStyle = C.paper; c.fill(ov); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke(ov);
  if (drawCenter) { c.save(); c.clip(ov); drawCenter(c, lt, t); c.restore(); }
  const s = lt > 0.1 ? MO.slamK((lt - 0.1) / 0.17) : 0; if (s) { F.text(c, String(n), x0 + 120, y0 + 125, { size: 110, scale: s, col: C.red }); F.text(c, String(n), x0 + w - 120, y0 + h - 115, { size: 110, scale: s, col: C.red }); }
  F.text(c, `第 ${n} 章`, W / 2, 280, { size: 72, fam: 'Songti-Black', col: C.ink2, alpha: F.at(lt, 0.2, 0.3) });
  const shown = TY.typed(title, F.at(lt, 0.35, [...title].length / 16)); F.text(c, shown, W / 2, 420, { size: title.length > 9 ? 70 : 86, col: C.ink });
  F.finish(c); };
})();

// ---------- 贯穿物：一枚 25 美分硬币（quarter＝25 个基点＝一次加息降息的一步） ----------
// flip: 0 正面 → 1 背面（绕竖轴翻，scaleX=cos）；face(c, r) 可自定义背面图案（如 12 区地图）
(() => { const F = K, C = F.C, TAU = F.TAU, { clamp } = U;
F.coin = (c, x, y, r, o = {}) => { const { flip = 0, rot = 0, face, alpha = 1, glint = 0 } = o, sx = Math.cos(flip * Math.PI), back = sx < 0;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(Math.max(0.04, Math.abs(sx)), 1);
  c.fillStyle = C.paper3; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.strokeStyle = C.ink; c.lineWidth = Math.max(2, r * 0.02); for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }   // 滚花边
  c.lineWidth = Math.max(3, r * 0.03); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.8, 0, TAU); c.stroke();
  const inner = F.circle(0, 0, r * 0.8); F.hatch(c, inner, -0.6, Math.max(7, r * 0.06), Math.max(2, r * 0.012), C.ink2, 0.45);
  if (back && face) face(c, r); else if (back) { F.rosette(c, 0, 0, r * 0.45, r * 0.12, 8, 6, Math.max(2, r * 0.012), 0.9); }
  else { c.fillStyle = C.ink; c.font = `${r * 0.62}px "Songti-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('25', 0, -r * 0.08); c.font = `${r * 0.2}px "Songti-Black"`; c.fillText('美分', 0, r * 0.42); }
  if (glint > 0) { c.save(); c.clip(F.circle(0, 0, r)); c.globalAlpha *= glint; c.fillStyle = 'rgba(255,250,230,.6)'; c.rotate(-0.8); c.fillRect(-r * 1.2 + glint * 0, -r * 0.12, r * 2.4, r * 0.24); c.restore(); }
  c.restore(); };
// 公文纸：雕版双线边框＋标题＋若干「文字行」（灰绿横条）；hl: 要红笔划线的行号与进度
F.doc = (c, x, y, w, h, o = {}) => { const { title = '', rows = 8, hl = [], rot = 0, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); const p = F.round(-w / 2, -h / 2, w, h, 10);
  c.save(); c.shadowColor = 'rgba(60,45,20,.3)'; c.shadowBlur = 18; c.shadowOffsetY = 10; c.fillStyle = C.paper; c.fill(p); c.restore();
  c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke(p); c.lineWidth = 2; c.stroke(F.round(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 6));
  if (title) F.text(c, title, 0, -h / 2 + 70, { size: Math.min(48, w / (title.length + 2)) });
  for (let i = 0; i < rows; i++) { const yy = -h / 2 + 140 + i * 56, ww = w - 110 - (i * 53) % 140; if (yy > h / 2 - 40) break; c.fillStyle = 'rgba(47,107,82,.45)'; c.fillRect(-w / 2 + 50, yy - 7, ww, 14);
    const H = hl.find(q => q[0] === i); if (H) { c.strokeStyle = C.red; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-w / 2 + 46, yy + 16); c.lineTo(-w / 2 + 46 + ww * clamp(H[1]), yy + 16); c.stroke(); } }
  c.restore(); };
F.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json
// 通用接口：章节卡＝一张票面；中央椭圆画本书贯穿物，可在 props.js 里改 F.cardCenter = (c, lt, t) => {…}
F.cardCenter = F.cardCenter || ((c, lt, t) => F.coin(c, F.W / 2, 890, 150, { rot: Math.sin(t * 0.8) * 0.08, glint: (t * 0.25) % 1 }));
F.chapterCard = (c, lt, t, n, title) => F.noteCard(c, lt, t, n, title, F.cardCenter);
})();
// 字幕（assemble.py 生成的 subs.js 调它）：票面绿底＋内框，字幕带 y≈1480
(() => { const F = K;
F.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "Songti-Black"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480;
  c.fillStyle = 'rgba(31,74,58,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 14); c.fill();
  c.strokeStyle = 'rgba(239,232,210,.5)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 10); c.stroke();
  c.fillStyle = '#EFE8D2'; c.fillText(text, x, y + 2); c.restore();
};
})();
