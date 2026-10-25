// 画风套件 kurzgesagt（来自《一颗药的诞生》）：竖屏 1080×1920，Kurzgesagt 式扁平科普。导出 window.K（章节代码里写 const D = K）。
// 规矩：深青墨平涂底、无描边、TOON.flat 双色分面、发光体带径向辉光；环境层浮尘一直轻动，主体落定即停。
// 所有随机走种子（U.hash / U.rng），同一 t 画同一帧。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U;
const D = window.K = { W, H, TAU };
const C = D.C = {
  bg: '#10181B', bg2: '#17252B', surf: '#1D2B2F', surf2: '#26383D', surfD: '#152024',
  ink: '#F2EFE8', inkD: '#C9C4B8', sub: '#8FA3A0',
  amb: '#F2B33D', ambD: '#C4861C', ambHi: '#FFE2A0', cream: '#F6EEDC', creamD: '#D8CCB2',
  coral: '#E8604C', coralD: '#B5412F', coralHi: '#FF9A84',
  teal: '#4FB3A5', tealD: '#2E7E73', tealHi: '#9BE3D6',
  grey: '#55666A', greyD: '#3A484B', greyHi: '#76888B', skin: '#E7B48E', skinD: '#C48A64', skinHi: '#F6D2B4',
};
D.at = (lt, a, d) => clamp((lt - a) / d);
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };   // 连续世界拆成多镜时，按段落表读起点，不写死秒数
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.4); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());

// ---------- 底：深青墨平涂＋中心一团极淡的亮区＋浮尘（环境层，一直轻轻动） ----------
D.bg = (c, t, o = {}) => {
  const { cx = W / 2, cy = 760, glow = 0.55, dust = 120, seed = 1, tint = C.teal } = o;
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, 1100); g.addColorStop(0, DG.rgba(C.bg2, glow)); g.addColorStop(1, DG.rgba(C.bg2, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < dust; i++) {
    const h = U.hash(i, seed), sp = 8 + U.hash(i, seed + 1) * 18, x = (h * W + Math.sin(t * 0.4 + i) * 30) % W, y = ((U.hash(i, seed + 2) * H - t * sp) % H + H) % H;
    const a = 0.12 + 0.26 * (0.5 + 0.5 * Math.sin(t * (1 + U.hash(i, seed + 3) * 2.5) + i));   // 环境层：浮尘一直在飘、在闪，主体停住时画面也不死
    c.fillStyle = DG.rgba(tint, a); c.beginPath(); c.arc(x, y, 2 + U.hash(i, seed + 4) * 3, 0, TAU); c.fill();
  }
};
// 字幕带的压暗（字幕在 y≈1434–1526，让开视频号底栏；主体尽量不进这一带）
D.subBand = c => { const g = c.createLinearGradient(0, 1300, 0, 1920); g.addColorStop(0, 'rgba(16,24,27,0)'); g.addColorStop(0.3, 'rgba(16,24,27,.45)'); g.addColorStop(1, 'rgba(16,24,27,.8)'); c.fillStyle = g; c.fillRect(0, 1300, W, 620); };

D.flat = (c, path, base, sh, hi, s = 1) => TOON.flat(c, path, base, sh, hi, [10 * s, 12 * s], [4 * s, 5 * s]);
D.glow = (c, x, y, r, col, a = 1) => TOON.glow(c, x, y, r, col, a);
D.circle = TOON.circle;
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };

// ---------- 胶囊：那一颗（琥珀＋奶白两半），或灰色的「阵亡兄弟」 ----------
// (x,y) 中心，L 全长，R 半径，rot 弧度；o.dead 灰色，o.glow 辉光强度，o.crack 0..1 裂开
D.capsulePath = (L, R) => D.once(`cap${L}_${R}`, () => { const p = new Path2D(); p.roundRect(-L / 2, -R, L, 2 * R, R); return p; });
D.capsule = (c, x, y, L, R, rot = 0, o = {}) => {
  const { dead = false, glow = 0, alpha = 1, crack = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot);
  if (glow > 0) D.glow(c, 0, 0, L * 1.3, C.amb, 0.45 * glow);
  const s = L / 220;
  const halves = (dx) => {
    const p = D.capsulePath(L, R);
    c.save(); c.beginPath(); c.rect(-L / 2 - 2, -R - 2, L / 2 + 2, 2 * R + 4); c.clip(); c.translate(-dx, 0);
    dead ? D.flat(c, p, C.grey, C.greyD, C.greyHi, s) : D.flat(c, p, C.amb, C.ambD, C.ambHi, s); c.restore();
    c.save(); c.beginPath(); c.rect(0, -R - 2, L / 2 + 2, 2 * R + 4); c.clip(); c.translate(dx, 0);
    dead ? D.flat(c, p, C.greyHi, C.grey, '#93A3A6', s) : D.flat(c, p, C.cream, C.creamD, '#FFFFFF', s); c.restore();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-L * 0.2 - dx, -R * 0.45, L * 0.16, R * 0.16, 0, 0, TAU); c.fill();
  };
  halves(crack * L * 0.18);
  c.restore();
};

// ---------- 分子：3–6 个原子球＋键，按种子生成（球棍画成扁平圆＋圆头粗线） ----------
D.molShape = seed => D.once('mol' + seed, () => { const r = U.rng(seed * 97 + 11), n = 3 + Math.floor(r() * 4), at = [[0, 0, 1]];
  for (let i = 1; i < n; i++) { const p = at[Math.floor(r() * at.length)], a = r() * TAU; at.push([p[0] + Math.cos(a) * 1.3, p[1] + Math.sin(a) * 1.3, 0.6 + r() * 0.5, at.indexOf(p)]); }
  const mx = at.reduce((s, q) => s + q[0], 0) / n, my = at.reduce((s, q) => s + q[1], 0) / n; at.forEach(q => { q[0] -= mx; q[1] -= my; }); return at; });
D.mol = (c, x, y, s, seed, col = C.teal, rot = 0, o = {}) => {
  const at = D.molShape(seed), [base, sh, hi] = D.tone(col); const { alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.strokeStyle = sh; c.lineWidth = 0.32; c.lineCap = 'round';
  at.forEach(q => { if (q[3] != null) { const p = at[q[3]]; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); } });
  at.forEach(q => { c.fillStyle = sh; c.beginPath(); c.arc(q[0], q[1], 0.5 * q[2], 0, TAU); c.fill(); c.fillStyle = base; c.beginPath(); c.arc(q[0] - 0.06 * q[2], q[1] - 0.08 * q[2], 0.42 * q[2], 0, TAU); c.fill();
    c.fillStyle = hi; c.beginPath(); c.arc(q[0] - 0.2 * q[2], q[1] - 0.22 * q[2], 0.12 * q[2], 0, TAU); c.fill(); });
  c.restore();
};
D.tone = col => ({ [C.teal]: [C.teal, C.tealD, C.tealHi], [C.coral]: [C.coral, C.coralD, C.coralHi], [C.amb]: [C.amb, C.ambD, C.ambHi], [C.grey]: [C.grey, C.greyD, C.greyHi], [C.cream]: [C.cream, C.creamD, '#fff'] }[col] || [col, col, col]);

// ---------- 文字 ----------
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Heavy', col = C.ink, align = 'center', alpha = 1, scale = 1, track = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${size}px "${fam}"`; c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px'; c.fillText(s, 0, 0); c.restore(); };
// 弹出的大字/数字（backOut 过冲）
D.popText = (c, s, x, y, lt, at, o = {}) => { const p = D.pop(lt, at, o.dur || 0.5); if (p <= 0) return;
  if (o.plate) { c.save(); c.font = `${o.size || 64}px "${o.fam || 'PuHui-Heavy'}"`; const w = c.measureText(s).width + (o.size || 64) * 0.9, h = (o.size || 64) * 1.45; c.translate(x, y); c.scale(p, p); c.globalAlpha *= clamp(p * 2) * (o.alpha ?? 1); c.fillStyle = DG.rgba(C.bg, 0.88); c.fill(D.round(-w / 2, -h / 2, w, h, h / 2)); c.restore(); }
  D.text(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// Kurzgesagt 标注：细引线先画出来，再逐字打出（约 14 字/秒），标签是大圆角饱和色胶囊
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => {
  const { col = C.amb, txt = C.bg, size = 46 } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = DG.rgba(C.ink, 0.85); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 8, 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return;
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 40)), w = c.measureText(s).width + size * 1.1, h = size * 1.6;
  c.translate(bx, by); c.scale(q, q); c.fillStyle = col; c.fill(D.round(-w / 2, -h / 2, w, h, h / 2));
  c.fillStyle = txt; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(shown, 0, 2); c.restore();
};

// ---------- 手：扁平剪影，掌心朝上（四指并拢＋拇指），从下方伸进来 ----------
D.handPath = () => D.once('hand', () => { const p = new Path2D();
  p.moveTo(-160, 1200); p.lineTo(-140, 120); p.bezierCurveTo(-150, 40, -210, -10, -250, -40);           // 腕 → 掌根左侧 → 拇指根
  p.bezierCurveTo(-290, -70, -300, -120, -260, -130); p.bezierCurveTo(-220, -140, -170, -90, -120, -50);  // 拇指
  p.bezierCurveTo(-90, -40, -60, -60, -40, -80);                                                           // 虎口
  p.bezierCurveTo(0, -120, 120, -140, 220, -150); p.bezierCurveTo(270, -155, 285, -110, 250, -95);        // 四指上沿 → 指尖
  p.bezierCurveTo(200, -70, 170, -40, 160, 0); p.bezierCurveTo(150, 60, 150, 120, 160, 1200); p.closePath(); return p; });
D.hand = (c, x, y, s = 1, rot = 0) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); D.flat(c, D.handPath(), C.skin, C.skinD, C.skinHi, 1.4);
  c.strokeStyle = DG.rgba(C.skinD, 0.8); c.lineWidth = 6; c.lineCap = 'round'; [[60, -128, 210, -138], [50, -100, 190, -108]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + d) / 2, b - 6, d, e); c.stroke(); }); c.restore(); };

// 在相机下画世界：fn(c) 用世界坐标
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
// 环境层视差：远处浮尘随相机慢动
D.vignette = c => { const g = c.createRadialGradient(W / 2, H * 0.42, 500, W / 2, H * 0.42, 1300); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
D.finish = c => { D.vignette(c); D.subBand(c); };
})();

// ---------- 20 分钟版：章节卡（每章第一镜，配口播念章名那一句） ----------
// n 章号 1..N，title 章名；N 站进度轨，主物（D.cardToken，默认胶囊）从上一站滑到本站，本站点亮；章号砸入、章名逐字出
// 换书时可在本书 props.js 里改 D.cardToken = (c, x, y) => {…} 画本书的贯穿物
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble.py 写进 scenes/book/meta.js）
D.cardToken = D.cardToken || ((c, x, y) => D.capsule(c, x, y, 130, 40, 0, { glow: 0.8 }));
D.chapterCard = (c, lt, t, n, title) => {
  D.bg(c, t, { seed: 900 + n, cy: 900 });
  const N = Math.max(D.CHAPTER_NAMES.length, n), x0 = 120, x1 = 960, y = 1180, X = i => lerp(x0, x1, i / Math.max(1, N - 1));
  c.fillStyle = DG.rgba(C.ink, 0.18); c.fill(D.round(x0 - 30, y - 10, x1 - x0 + 60, 20, 10));
  for (let i = 0; i < N; i++) { const done = i < n - 1, cur = i === n - 1, p = cur ? D.pop(lt, 0.5, 0.5) : 1;
    c.fillStyle = done ? C.teal : cur ? C.amb : DG.rgba(C.ink, 0.3); c.beginPath(); c.arc(X(i), y, (cur ? 24 : 14) * (cur ? Math.max(0.6, p) : 1), 0, TAU); c.fill();
    if (cur) D.glow(c, X(i), y, 90, C.amb, 0.5 * clamp(p)); }
  const q = MO.cubicInOut(D.at(lt, 0.15, 0.8)), cx = lerp(n > 1 ? X(n - 2) : x0 - 80, X(n - 1), q);
  D.cardToken(c, cx, y - 90);
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); D.text(c, `第 ${n} 章`, W / 2, 640, { size: 110, fam: 'PuHui-Black', col: C.amb, scale: s }); }
  const shown = TY.typed(title, D.at(lt, 0.45, [...title].length / 16)); D.text(c, shown, W / 2, 820, { size: title.length > 9 ? 84 : 104, fam: 'PuHui-Black', col: C.ink });
  D.finish(c);
};
})();
// 字幕（assemble.py 生成的 subs.js 调它）：字幕带 y≈1480，让开视频号底栏
(() => { const D = K;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 64, h = 88, x = 540, y = 1480;
  c.fillStyle = 'rgba(10,16,18,.62)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 22); c.fill();
  c.fillStyle = '#F2EFE8'; c.fillText(text, x, y + 2); c.restore();
};
})();

// 通用道具（来自原片场景文件）：ISOTYPE 人、剪影（不画五官）、开关、注射器
(() => { const D = K, C = D.C, { W, H, TAU } = D, { clamp, lerp } = U;
D.person = (c, x, y, s, col, a = 1) => { const [b, sh, hi] = D.tone(col); c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s);
  D.flat(c, D.circle(0, -34, 18), b, sh, hi, 0.25); D.flat(c, D.round(-26, -12, 52, 52, [24, 24, 8, 8]), b, sh, hi, 0.25); c.restore(); };
D.personSprite = col => PAINT.cached('person' + col, 80, 100, g => D.person(g, 40, 64, 1, col));
D.humanSil = (c, x, y, s, col, a = 1) => { c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s); const p = D.once('hsil', () => { const q = new Path2D(); const h = new Path2D(); h.arc(0, -260, 90, 0, TAU); q.addPath(h); const b = new Path2D(); b.roundRect(-150, -150, 300, 420, [140, 140, 40, 40]); q.addPath(b); return q; }); c.fillStyle = col; c.fill(p); c.restore(); };
D.mouseSil = (c, x, y, s, col, a = 1) => { c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s); const p = D.once('msil', () => { const q = new Path2D(); const e1 = new Path2D(); e1.ellipse(0, 0, 220, 120, 0, 0, TAU); q.addPath(e1); const e2 = new Path2D(); e2.ellipse(220, -40, 100, 80, -0.2, 0, TAU); q.addPath(e2); const e3 = new Path2D(); e3.arc(200, -130, 50, 0, TAU); q.addPath(e3); return q; }); c.fillStyle = col; c.fill(p); c.strokeStyle = col; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(-210, 20); c.bezierCurveTo(-330, 0, -360, -80, -420, -50); c.stroke(); c.restore(); };
D.monkeySil = (c, x, y, s, col) => { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.beginPath(); c.arc(0, -230, 90, 0, TAU); c.fill(); [[-90, -260], [90, -260]].forEach(([ex, ey]) => { c.beginPath(); c.arc(ex, ey, 40, 0, TAU); c.fill(); });
  c.beginPath(); c.ellipse(0, 20, 150, 200, 0, 0, TAU); c.fill(); c.strokeStyle = col; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(120, 160); c.bezierCurveTo(300, 200, 320, 0, 260, -60); c.stroke(); c.restore(); };
D.switch = (c, x, y, s, on) => { c.save(); c.translate(x, y); c.scale(s, s); D.flat(c, D.round(-90, 0, 180, 70, 35), C.surf2, C.surfD, '#3E555B', 0.8);
  c.save(); c.translate(0, 18); c.rotate(lerp(0.6, -0.6, on)); D.flat(c, D.round(-12, -130, 24, 136, 12), C.coral, C.coralD, C.coralHi, 0.6); D.flat(c, D.circle(0, -130, 26), C.coral, C.coralD, C.coralHi, 0.6); c.restore(); c.restore(); };
D.syringe = (c, x, y, s, rot, push = 0) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.fillStyle = C.inkD; c.fillRect(-6, 90, 12, 70); D.flat(c, D.round(-34, -120, 68, 210, 14), C.cream, C.creamD, '#fff', 0.6);
  c.fillStyle = DG.rgba(C.amb, 0.85); c.fillRect(-26, -120 + 200 * push * 0.9 + 6, 52, 200 * (1 - push * 0.9) - 12);
  c.fillStyle = C.sub; c.fillRect(-46, -140 - 60 * (1 - push), 92, 20); c.fillRect(-8, -140 - 60 * (1 - push), 16, 60 * (1 - push) + 20); c.restore(); };
})();
