// 画风套件 matisse（来自《一直跑下去》）：竖屏 1080×1920，马蒂斯《爵士》剪纸。导出 window.K（章节代码里写 const D = K）。
// 规矩：一切形状都是「剪刀折线」P.cut 剪出来的彩纸，纯色无描边；每片纸带钉纸投影；最后整幅盖水粉刷痕 overlay（K.finish）。
// 主体只放 y200–1350（字幕带 y≈1434–1526 让开视频号底栏）；黑剪影＋红头带是人，彩纸块是字、是图表。
// 所有随机走种子（U.hash / U.rng / P.cut 的 seed），同一 t 画同一帧。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT, cut = P.cut;
const K = window.K = { W, H, TAU };
// 兜底：pop 的回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  cobalt: '#1d4fb8', sky: '#4f95dc', yel: '#f7d21e', red: '#e2322a', black: '#141414', ink: '#141414', white: '#f7f3e8', paper: '#f7f3e8',
  green: '#1f9a5a', greenD: '#14744a', greenL: '#4cbd7c', pink: '#ef6f9a', org: '#f28a24', orgD: '#c8521a', grey: '#2c2c2c', sand: '#e9dcc0',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.4); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 剪纸基本件 ----------
K.shadow = (c, fn) => { c.save(); c.shadowColor = 'rgba(10,20,40,.34)'; c.shadowOffsetX = 6; c.shadowOffsetY = 8; c.shadowBlur = 4; fn(); c.restore(); };
const ring = (cx, cy, rx, ry, n, rot = 0) => Array.from({ length: n }, (_, k) => [cx + Math.cos(k / n * TAU + rot) * rx, cy + Math.sin(k / n * TAU + rot) * ry]);
const rectPts = (x0, y0, x1, y1, j = 0, seed = 1) => { const r = U.rng(seed * 13 + 7), q = () => (r() - 0.5) * j; return [[x0 + q(), y0 + q()], [x1 + q(), y0 + q()], [x1 + q(), y1 + q()], [x0 + q(), y1 + q()]]; };
K.cutRing = (cx, cy, rx, ry, seed = 1, step = 22, amp = 2.5) => cut(ring(cx, cy, rx, ry, Math.max(10, Math.round((rx + ry) * Math.PI / step))), seed, step, amp);
K.cutRect = (x0, y0, x1, y1, seed = 1, step = 22, amp = 2.5, j = 3) => cut(rectPts(x0, y0, x1, y1, j, seed), seed, step, amp);
const fillP = (c, p, col) => { c.fillStyle = col; c.fill(p); };
const place = (c, path, x, y, rot, sx, sy, col) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(sx, sy === undefined ? sx : sy); c.fillStyle = col; c.fill(path); c.restore(); };
const mixHex = (a, b, k) => { const pa = DG.arr(a), pb = DG.arr(b); return `rgb(${[0, 1, 2].map(i => Math.round(lerp(pa[i], pb[i], k))).join(',')})`; };
// 圆头胶囊（肢体）
function capsule(c, a, b, wa, wb, seed) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, d = [dx / L, dy / L], n = [-d[1], d[0]], th = Math.atan2(n[1], n[0]), pts = [];
  pts.push([a[0] + n[0] * wa / 2, a[1] + n[1] * wa / 2], [b[0] + n[0] * wb / 2, b[1] + n[1] * wb / 2]);
  for (let k = 1; k < 6; k++) { const q = th - k / 6 * Math.PI; pts.push([b[0] + Math.cos(q) * wb / 2, b[1] + Math.sin(q) * wb / 2]); }
  pts.push([b[0] - n[0] * wb / 2, b[1] - n[1] * wb / 2], [a[0] - n[0] * wa / 2, a[1] - n[1] * wa / 2]);
  for (let k = 1; k < 6; k++) { const q = th + Math.PI - k / 6 * Math.PI; pts.push([a[0] + Math.cos(q) * wa / 2, a[1] + Math.sin(q) * wa / 2]); }
  c.fill(cut(pts, seed, 20, 1.6));
}
K.capsule = capsule;

// ---------- 彩纸字块配色（底色, 字色） ----------
K.PAIRS = [[C.red, C.white], [C.yel, C.black], [C.cobalt, C.white], [C.pink, C.black], [C.green, C.white], [C.white, C.black], [C.black, C.yel], [C.org, C.black]];

// ---------- 底：每种底都是缓存好的一整张剪纸，另叠少量环境动态（海藻摇、纸片翻飞） ----------
// kind：blue（双蓝棋盘＋绿地）| green（草地）| yellow（暖黄底）| dark / black（黑底，数据章用）| white（白纸底）
// tone：blue/green/yellow/dark/white 的第二主色：cobalt（默认）| teal | violet | rose | orange
const TONES = {
  cobalt: ['#1d4fb8', '#4f95dc'], teal: ['#0f7f86', '#3fb4bd'], violet: ['#4a2fa0', '#8a6fdc'], rose: ['#c42a5a', '#ef6f9a'], orange: ['#d9531a', '#f28a24'],
};
const bgBlue = (tone, floor, seed) => P.cached(`mat_blue_${tone}_${floor}_${seed}`, W, H, g => {
  const [A, B] = TONES[tone] || TONES.cobalt; g.fillStyle = C.white; g.fillRect(0, 0, W, H);
  const cw = 270, ch = 240, rows = 8;
  for (let j = 0; j < rows; j++) for (let i = 0; i < 4; i++) { const x = i * cw, y = j * ch, r = U.rng(i * 7 + j * 31 + 5 + seed);
    g.fillStyle = (i + j) % 2 ? A : B;
    g.fill(cut([[x - 3 + r() * 5, y - 3], [x + cw + 3, y + r() * 5 - 3], [x + cw + r() * 5, y + ch + 3], [x - 3, y + ch + r() * 5]], i * 13 + j + seed, 24, 2)); }
  if (floor) {
    g.fillStyle = C.green; g.fill(cut([[0, 1306], [W, 1298], [W, H], [0, H]], 5 + seed, 26, 3));
    g.fillStyle = C.black; g.fill(cut([[0, 1288], [W, 1282], [W, 1312], [0, 1320]], 6 + seed, 22, 2));
    K.shadow(g, () => { g.fillStyle = C.pink; g.fill(cut(ring(250, 1620, 170, 54, 26), 8 + seed, 20, 3));
      g.fillStyle = C.yel; g.fill(cut([[700, 1700], [830, 1670], [900, 1730], [780, 1760]], 9 + seed, 18, 2)); g.fill(cut([[560, 1810], [620, 1790], [640, 1850], [570, 1860]], 10 + seed, 14, 2)); });
  }
});
const bgGreen = (tone, seed) => P.cached(`mat_green_${tone}_${seed}`, W, H, g => {
  const [A, B] = TONES[tone] || TONES.cobalt; g.fillStyle = C.green; g.fillRect(0, 0, W, H); const r = U.rng(40 + seed);
  for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, rx = 120 + r() * 220, ry = 60 + r() * 120;
    g.fillStyle = i % 3 ? C.greenD : C.greenL; g.fill(cut(ring(x, y, rx, ry, 18, r() * TAU), 100 + i + seed, 26, 3)); }
  g.fillStyle = C.sand; g.fill(cut([[0, 1262], [W, 1252], [W, 1350], [0, 1362]], 44 + seed, 26, 3));          // 跑道
  g.fillStyle = C.white; for (let i = 0; i < 6; i++) g.fill(cut(rectPts(40 + i * 180, 1300, 150 + i * 180, 1316, 3, i + seed), 50 + i + seed, 14, 1.5));
  K.shadow(g, () => { // 小花：剪纸星
    for (let i = 0; i < 9; i++) { const x = 60 + r() * 960, y = 160 + r() * 1100; if (y > 1230) continue; g.save(); g.translate(x, y); g.rotate(r() * TAU); g.fillStyle = [C.yel, C.pink, C.white, B][i % 4]; g.fill(starPath(300 + i + seed, 26 + r() * 14, 5)); g.restore(); } });
});
const bgYellow = (tone, seed) => P.cached(`mat_yellow_${tone}_${seed}`, W, H, g => {
  const [A, B] = TONES[tone] || TONES.rose; g.fillStyle = C.yel; g.fillRect(0, 0, W, H); const r = U.rng(60 + seed);
  K.shadow(g, () => {
    g.fillStyle = C.org; g.fill(cut(ring(880, 330, 250, 250, 36), 61 + seed, 24, 3));
    g.fillStyle = C.red; g.fill(cut(ring(120, 1000, 230, 160, 30, 0.4), 62 + seed, 24, 3));
    g.fillStyle = B; g.fill(cut(ring(900, 1180, 260, 120, 30, -0.3), 63 + seed, 24, 3));
    g.fillStyle = C.white; g.fill(cut([[0, 560], [260, 520], [300, 600], [20, 650]], 64 + seed, 20, 2));
    g.fillStyle = A; g.fill(cut([[60, 180], [250, 150], [330, 260], [140, 310]], 65 + seed, 20, 2));
    g.fillStyle = C.org; g.fill(cut([[0, 1306], [W, 1296], [W, H], [0, H]], 66 + seed, 26, 3));
    g.fillStyle = C.black; g.fill(cut([[0, 1290], [W, 1282], [W, 1308], [0, 1318]], 67 + seed, 22, 2));
    for (let i = 0; i < 5; i++) { g.fillStyle = [C.red, C.white, A, C.pink, C.yel][i]; g.fill(cut(rectPts(120 + i * 190, 1560 + (r() - 0.5) * 90, 210 + i * 190, 1620 + (r() - 0.5) * 90, 8, i + seed), 70 + i + seed, 16, 2)); } });
});
const bgDark = (tone, seed) => P.cached(`mat_dark_${tone}_${seed}`, W, H, g => {
  const [A, B] = TONES[tone] || TONES.cobalt; g.fillStyle = '#121212'; g.fillRect(0, 0, W, H); const r = U.rng(80 + seed);
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#1d1d1d' : '#262626'; g.fill(cut(ring(r() * W, r() * H, 140 + r() * 200, 90 + r() * 140, 18, r() * TAU), 200 + i + seed, 26, 3)); }
  g.fillStyle = 'rgba(255,255,255,.07)'; for (let j = 0; j < 7; j++) g.fill(cut(rectPts(40, 240 + j * 170, W - 40, 250 + j * 170, 3, j + seed), 90 + j + seed, 30, 1.5));   // 数据网格线
  for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * H; if (y > 1380 && y < 1580) continue; g.save(); g.translate(x, y); g.rotate(r() * TAU); g.fillStyle = [C.yel, C.white, C.pink, B, C.red][i % 5]; g.fill(starPath(400 + i + seed, 7 + r() * 9, 4 + (i % 3))); g.restore(); }
});
const bgWhite = (tone, seed) => P.cached(`mat_white_${tone}_${seed}`, W, H, g => {
  const [A, B] = TONES[tone] || TONES.cobalt; g.fillStyle = C.white; g.fillRect(0, 0, W, H); const r = U.rng(120 + seed);
  const pale = [DG.rgba(B, 0.22), 'rgba(239,111,154,.16)', 'rgba(247,210,30,.2)', 'rgba(31,154,90,.14)'];
  for (let i = 0; i < 12; i++) { g.fillStyle = pale[i % 4]; g.fill(cut(ring(r() * W, r() * H, 120 + r() * 200, 80 + r() * 140, 18, r() * TAU), 300 + i + seed, 26, 3)); }
  g.fillStyle = C.black; g.fill(cut([[0, 1296], [W, 1288], [W, 1306], [0, 1314]], 130 + seed, 24, 2));
});
const algaeSet = {   // [x, y(根), 长, 宽, 叶对数, 弯, 色名索引, 相位]
  blue: [[40, 1306, 420, 150, 3.5, 0.4, C.white, 0], [1040, 1306, 330, 140, 3, -0.4, C.yel, 1.3]],
  green: [[30, 1256, 300, 120, 3, 0.4, C.yel, 0.5], [1050, 1256, 340, 130, 3, -0.4, C.pink, 1.6]],
  yellow: [[30, 1296, 360, 130, 3, 0.4, C.red, 0.7], [1050, 1296, 300, 120, 3, -0.4, C.cobalt, 2]],
  dark: [[0, 0, 0, 0, 0, 0, '#000', 0]], white: [[30, 1296, 360, 130, 3, 0.4, C.sky, 0.7], [1050, 1296, 320, 120, 3, -0.4, C.pink, 2]],
};
K.bg = (c, t, o = {}) => {
  let { kind = 'blue', tone, floor = true, deco = true, seed = 0 } = o; if (kind === 'black') kind = 'dark';
  tone = tone || (kind === 'yellow' ? 'rose' : 'cobalt');
  const img = kind === 'green' ? bgGreen(tone, seed) : kind === 'yellow' ? bgYellow(tone, seed) : kind === 'dark' ? bgDark(tone, seed) : kind === 'white' ? bgWhite(tone, seed) : bgBlue(tone, floor, seed);
  c.drawImage(img, 0, 0);
  if (!deco) return;
  const B = (TONES[tone] || TONES.cobalt)[1];
  if (kind !== 'dark') (algaeSet[kind] || algaeSet.blue).forEach(([x, y, len, wd, lb, bend, col, ph], k) => {
    K.shadow(c, () => { c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2.8 + ph) * 0.05); c.scale(0.95 + 0.05 * Math.sin(t * 3.6 + ph), 0.95 + 0.05 * Math.sin(t * 3.6 + ph)); c.fillStyle = col; c.fill(algaePath(k + 1 + seed, len, wd, lb, bend)); c.restore(); }); });
  // 翻飞的碎纸：沿两侧边缘缓缓落下，scaleX = cos（翻面）
  for (let i = 0; i < 3; i++) { const side = i % 2 ? 1 : -1, sp = 34 + U.hash(i, seed + 5) * 26, y = ((U.hash(i, seed + 6) * H + t * sp) % (H + 120)) - 60, x = (side < 0 ? 40 : W - 40) + Math.sin(t * 0.9 + i * 2) * 26;
    if (y > 1380 && y < 1580) continue;
    K.shadow(c, () => place(c, K.once('scrap' + i, () => cut([[-20, -14], [22, -18], [26, 16], [-18, 20]], 700 + i, 14, 2)), x, y, t * 0.8 + i, Math.cos(t * 2.2 + i * 1.7), 1, [C.pink, C.yel, C.white][i % 3])); }
};

// ---------- 水粉刷痕 overlay ＋ 每镜收尾 ----------
const gouache = () => P.cached('mat_gouache', W, H, g => {
  const r = U.rng(2024); g.lineCap = 'round';
  for (let i = 0; i < 1500; i++) { const x = r() * W, y = r() * H, a = -0.25 + (r() - 0.5) * 0.5, L = 60 + r() * 240;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.07})` : `rgba(0,0,0,${0.04 + r() * 0.06})`; g.lineWidth = 6 + r() * 16;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
});
// 字幕带 y≈1434–1526：压暗一条（留给 K.subtitle），主体别进来
K.subBand = c => { const g = c.createLinearGradient(0, 1350, 0, 1620); g.addColorStop(0, 'rgba(8,16,30,0)'); g.addColorStop(0.5, 'rgba(8,16,30,.5)'); g.addColorStop(1, 'rgba(8,16,30,0)'); c.fillStyle = g; c.fillRect(0, 1350, W, 270); };
K.finish = c => { c.save(); c.globalCompositeOperation = 'overlay'; c.drawImage(gouache(), 0, 0); c.restore(); K.subBand(c); };

// ---------- 文字 ----------
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Heavy', col = C.black, align = 'center', alpha = 1, scale = 1, track = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  c.font = `${size}px "${fam}"`; c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px'; c.fillText(s, 0, 0); c.restore(); };
// 彩纸字块：整句一块纸（≥52px）。o：size, pair（K.PAIRS 下标）| bg/fg, rot, seed, alpha, scale, padX
K.tag = (c, s, x, y, o = {}) => {
  const size = Math.max(52, o.size || 64), { fam = 'PuHui-Black', alpha = 1, scale = 1, padX = size * 0.45, seed = 1 } = o;
  const pr = K.PAIRS[(o.pair ?? Math.floor(U.hash([...s].length, seed) * K.PAIRS.length)) % K.PAIRS.length], bg = o.bg || pr[0], fg = o.fg || pr[1];
  const rot = o.rot ?? (U.hash(s.length, seed + 3) - 0.5) * 0.08;
  c.save(); c.font = `${size}px "${fam}"`; const tw = c.measureText(s).width; c.restore();
  const w = tw + padX * 2, h = size * 1.42, hw = w / 2, hh = h / 2;
  const path = K.once(`tag|${s}|${size}|${padX}|${seed}`, () => cut(rectPts(-hw, -hh, hw, hh, 5, seed + s.length), seed * 17 + s.length, 22, 2.6));
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  K.shadow(c, () => fillP(c, path, bg)); c.font = `${size}px "${fam}"`; c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, size * 0.05);
  c.restore(); return { w, h };
};
// 逐字大字块（≥100px）：每字一块方纸，依次砸入；字多自动分行。(x,y) 为整块中心。o：size（默认 140）, pairs, gap, step（每字间隔秒）
K.bigText = (c, s, x, y, lt, at, o = {}) => {
  const chars = [...s], size = Math.max(100, o.size || 140), tile = size * 1.3, pairs = o.pairs || K.PAIRS.slice(0, 5), step = o.step ?? 0.09, seed = o.seed || 1;
  const maxPer = Math.max(1, Math.floor(980 / (tile + 6))), rows = Math.ceil(chars.length / maxPer), per = Math.ceil(chars.length / rows);
  chars.forEach((ch, i) => { const rI = Math.floor(i / per), cI = i % per, n = Math.min(per, chars.length - rI * per);
    const q = K.pop(lt, at + i * step, 0.45); if (q <= 0) return;
    const px = x + (cI - (n - 1) / 2) * (tile + 6), py = y + (rI - (rows - 1) / 2) * (tile + 8) + (U.hash(i, seed + 9) - 0.5) * 14;
    const pr = pairs[(i + (o.shift || 0)) % pairs.length], rot = (U.hash(i, seed + 3) - 0.5) * 0.12 + Math.sin(lt * 1.6 + i) * 0.01;
    const hw = tile / 2, path = K.once(`bt|${size}|${seed}|${i}`, () => cut(rectPts(-hw, -hw, hw, hw, 6, seed + i), 80 + i + seed * 5, 22, 3));
    c.save(); c.translate(px, py); c.rotate(rot); c.scale(q, q); c.globalAlpha *= clamp(q * 2) * (o.alpha ?? 1);
    K.shadow(c, () => fillP(c, path, pr[0])); c.font = `${size}px "PuHui-Black"`; c.fillStyle = pr[1]; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, size * 0.06); c.restore(); });
  return { rows, per, tile };
};
// 弹出的字：默认带彩纸块（o.plate===false 才是裸字）
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return;
  if (o.plate === false) { K.text(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); return; }
  K.tag(c, s, x, y, { ...o, scale: p, alpha: clamp(p * 2) * (o.alpha ?? 1) }); };
// 引线标签：黑剪纸细条从锚点（带圆点）拉到标签，标签逐字打出（约 14 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => {
  const { size = 52, seed = 3 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1), dx = ex - ax, dy = ey - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 3.5, ny = dx / L * 3.5;
  K.shadow(c, () => { c.fillStyle = C.black; c.fill(cut([[ax + nx, ay + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [ax - nx, ay - ny]], seed, 24, 0.8)); c.fill(cut(ring(ax, ay, 11, 11, 10), seed + 1, 8, 1)); });
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return;
  const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 14)); K.tag(c, shown || '　', bx, by, { size, pair: o.pair ?? 1, bg: o.bg, fg: o.fg, scale: q, seed, rot: o.rot ?? -0.03 });
};

// ---------- 字幕（assemble.py 生成的 subs.js 调它）：黑剪纸条＋奶白字，带 y≈1480 ----------
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 72, h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(14,14,14,.8)'; c.fill(cut(rectPts(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 3, 5), 9, 26, 1.6));
  c.fillStyle = C.white; c.fillText(text, x, y + 3); c.restore();
};

// ---------- 小剪纸图元（x,y 为中心；海藻为根部） ----------
const heartPts = (cx, cy, s) => Array.from({ length: 28 }, (_, k) => { const a = k / 28 * TAU; return [cx + s * Math.pow(Math.sin(a), 3), cy - s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]; });
const starPath = (k, r0, n) => K.once(`star${k}_${r0 | 0}_${n}`, () => { const r = U.rng(k * 31 + 5), pts = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + (r() - 0.5) * 0.25, rr = (i % 2 ? r0 * 0.42 : r0) * (0.75 + r() * 0.45); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return cut(pts, k * 17, 14, 1.8); });
// 海藻：一根锥形茎＋左右交替的圆头胶囊手指，所有子路径并进同一个 Path2D 一次填充（并集，投影只算一次）
const algaePath = (k, len, wd, lobes, bend) => K.once(`alg${k}_${len}_${wd}_${lobes}_${bend}`, () => {
  const r = U.rng(k * 7 + 3), p = new Path2D(), sp = u => [Math.sin(u * 1.6) * bend * len * 0.25, -u * len];
  const cap = (A, th, L, w) => { const d = [Math.sin(th), -Math.cos(th)], n = [-d[1], d[0]], T = [A[0] + d[0] * (L - w / 2), A[1] + d[1] * (L - w / 2)], pts = [];
    pts.push([A[0] + n[0] * w * 0.42, A[1] + n[1] * w * 0.42], [A[0] + d[0] * L * 0.5 + n[0] * w * 0.55, A[1] + d[1] * L * 0.5 + n[1] * w * 0.55]);
    for (let q = 0; q <= 6; q++) { const a = Math.atan2(n[1], n[0]) - q / 6 * Math.PI; pts.push([T[0] + Math.cos(a) * w / 2, T[1] + Math.sin(a) * w / 2]); }
    pts.push([A[0] + d[0] * L * 0.5 - n[0] * w * 0.55, A[1] + d[1] * L * 0.5 - n[1] * w * 0.55], [A[0] - n[0] * w * 0.42, A[1] - n[1] * w * 0.42]); return pts; };
  p.addPath(cut(cap(sp(0), bend * 0.2, len, wd * 0.24), k, 16, 2));
  const n = Math.round(lobes * 2);
  for (let q = 0; q < n; q++) { const u = 0.12 + 0.78 * q / Math.max(1, n - 1), side = q % 2 ? 1 : -1, A = sp(u);
    p.addPath(cut(cap(A, side * (1.05 - 0.55 * u) + bend * 0.2 + (r() - 0.5) * 0.25, wd * (1 - 0.45 * u) * (0.8 + r() * 0.3), wd * (0.34 - 0.12 * u)), k + q * 11, 15, 1.8)); }
  return p; });
K.algae = (c, x, y, len = 300, o = {}) => { const { col = C.white, t = 0, seed = 1, rot = 0, flip = false, wd = len * 0.35, lobes = 3, bend = 0.4, sway = 1 } = o;
  c.save(); c.translate(x, y); c.rotate(rot + Math.sin(t * 2.8 + seed) * 0.05 * sway); c.scale(flip ? -1 : 1, 1);
  K.shadow(c, () => fillP(c, algaePath(seed, len, wd, lobes, bend), col)); c.restore(); };
K.heart = (c, x, y, s = 40, o = {}) => { const { col = C.red, beat = true, t = 0, seed = 41, alpha = 1, rot = 0 } = o, hb = beat ? 1 + 0.16 * Math.max(0, Math.sin(t * 7.2)) : 1;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); K.shadow(c, () => fillP(c, cut(heartPts(0, 0, s * hb), seed, 10, Math.max(0.8, s / 25)), col)); c.restore(); };
K.star = (c, x, y, r = 40, o = {}) => { const { col = C.yel, n = 6, rot = 0, t = 0, seed = 1, twinkle = true, alpha = 1 } = o, s = twinkle ? 0.85 + 0.2 * Math.sin(t * 7 + seed * 1.9) : 1;
  c.save(); c.globalAlpha *= alpha; K.shadow(c, () => place(c, starPath(seed, r, n), x, y, rot + t * (twinkle ? 0.8 : 0), s, s, col)); c.restore(); };
K.bird = (c, x, y, s = 1.2, o = {}) => { const { col = C.white, t = 0, flip = false } = o, fl = 0.55 + 0.45 * Math.cos(t * 13 + (o.seed || 0));
  K.shadow(c, () => place(c, K.once('bird', () => cut([[0, 0], [-26, -14], [-58, -10], [-34, 2], [-62, 18], [-18, 10], [0, 22], [24, 8], [50, 12], [30, -2], [44, -18]], 99, 12, 1.6)), x, y, -0.1, flip ? -s : s, s * fl, col)); };
K.sun = (c, x, y, r = 90, o = {}) => { const { col = C.yel, t = 0, rays = 12 } = o;
  K.shadow(c, () => { c.save(); c.translate(x, y); c.rotate(t * 0.3); c.fillStyle = C.org;
    for (let i = 0; i < rays; i++) { const a = i / rays * TAU, w = 0.12 + 0.02 * U.hash(i, 5); c.fill(cut([[Math.cos(a - w) * r * 1.05, Math.sin(a - w) * r * 1.05], [Math.cos(a) * r * (1.55 + 0.2 * U.hash(i, 6)), Math.sin(a) * r * (1.55 + 0.2 * U.hash(i, 6))], [Math.cos(a + w) * r * 1.05, Math.sin(a + w) * r * 1.05]], 500 + i, 14, 1.2)); }
    c.restore(); fillP(c, K.cutRing(x, y, r, r, 501), col); }); };
K.cloud = (c, x, y, w = 260, o = {}) => { const { col = C.white, seed = 1, t = 0 } = o;
  const path = K.once(`cloud${seed}`, () => { const p = new Path2D(), r = U.rng(seed * 11 + 1); const parts = [[0, 0, 1, 0.55], [-0.32, 0.04, 0.55, 0.4], [0.32, 0.05, 0.6, 0.42], [-0.1, -0.2, 0.55, 0.45], [0.16, -0.16, 0.45, 0.4]];
    parts.forEach(([px, py, sx, sy], i) => p.addPath(cut(ring(px * 100, py * 100, sx * 50, sy * 50, 16), seed * 5 + i, 12, 1.5))); return p; });
  c.save(); c.translate(x + Math.sin(t * 0.6 + seed) * 8, y); c.scale(w / 100, w / 100); K.shadow(c, () => { c.shadowOffsetX = 6 * 100 / w; c.shadowOffsetY = 8 * 100 / w; fillP(c, path, col); }); c.restore(); };
K.moon = (c, x, y, r = 100, o = {}) => { const { col = C.yel, t = 0 } = o;
  const path = K.once(`moon${r}`, () => { const d = 0.42 * r, rho = 0.82 * r, xs = (d * d + r * r - rho * rho) / (2 * d), ys = Math.sqrt(r * r - xs * xs), th = Math.atan2(ys, xs), pts = [];
    for (let i = 0; i <= 20; i++) { const a = lerp(th, TAU - th, i / 20); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const a1 = Math.atan2(-ys, xs - d), a2 = Math.atan2(ys, xs - d) - TAU; for (let i = 1; i < 20; i++) { const a = lerp(a1, a2, i / 20); pts.push([d + Math.cos(a) * rho, Math.sin(a) * rho]); } return cut(pts, 17, 16, 1.6); });
  c.save(); c.translate(x, y); c.rotate(-0.25); K.shadow(c, () => fillP(c, path, col)); c.restore();
  K.star(c, x + r * 1.1, y - r * 0.5, r * 0.22, { col: C.white, t, seed: 2, n: 5 }); K.star(c, x + r * 0.75, y + r * 0.75, r * 0.14, { col: C.pink, t, seed: 3, n: 4 }); };
K.clock = (c, x, y, r = 120, o = {}) => { const { time = 7.5, t = 0, alarm = false, col = C.white, face = C.black, sweep = false } = o;
  c.save(); c.translate(x, y);
  if (alarm) K.shadow(c, () => { [-1, 1].forEach((sd, i) => { c.save(); c.translate(sd * r * 0.72, -r * 0.82); c.rotate(sd * (0.5 + 0.12 * Math.sin(t * 22 * (o.ring ? 1 : 0)))); fillP(c, K.cutRing(0, 0, r * 0.34, r * 0.26, 610 + i, 12, 1.5), C.red); c.restore(); }); });
  K.shadow(c, () => fillP(c, K.cutRing(0, 0, r, r, 611, 22, 2.5), col));
  fillP(c, K.cutRing(0, 0, r * 0.86, r * 0.86, 612, 22, 2), DG.rgba(C.sky, 0.25));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.save(); c.rotate(a); c.fillStyle = i % 3 ? face : C.red; c.fill(cut(rectPts(-r * 0.045, -r * 0.82, r * 0.045, -r * (i % 3 ? 0.7 : 0.66), 1, i), 620 + i, 20, 0.6)); c.restore(); }
  const hr = ((time % 12) / 12) * TAU, mn = ((time % 1)) * TAU; c.fillStyle = face;
  c.save(); c.rotate(hr); c.fill(cut([[-r * 0.06, r * 0.08], [-r * 0.05, -r * 0.5], [0, -r * 0.56], [r * 0.05, -r * 0.5], [r * 0.06, r * 0.08]], 631, 20, 0.8)); c.restore();
  c.save(); c.rotate(mn + (sweep ? t * 0.5 : 0)); c.fill(cut([[-r * 0.04, r * 0.1], [-r * 0.035, -r * 0.74], [0, -r * 0.8], [r * 0.035, -r * 0.74], [r * 0.04, r * 0.1]], 632, 20, 0.8)); c.restore();
  fillP(c, K.cutRing(0, 0, r * 0.08, r * 0.08, 633, 8, 0.8), C.red); c.restore(); };
K.bed = (c, x, y, s = 1, o = {}) => { const { t = 0, zzz = true, blanket = C.cobalt } = o; // (x,y) = 床面落地线中点，床宽约 560·s
  c.save(); c.translate(x, y); c.scale(s, s);
  K.shadow(c, () => {
    c.fillStyle = C.orgD; c.fill(cut(rectPts(-290, -150, 290, -100, 3, 1), 641, 24, 2)); c.fill(cut(rectPts(-300, -190, -258, 0, 3, 2), 642, 24, 2)); c.fill(cut(rectPts(258, -130, 300, 0, 3, 3), 643, 24, 2));
    c.fillStyle = C.white; c.fill(cut(rectPts(-262, -216, 262, -146, 5, 4), 644, 22, 2.5));
    c.fillStyle = blanket; c.fill(cut([[-60, -226], [268, -230], [270, -140], [-70, -140]], 645, 22, 2.5));
    c.fillStyle = C.yel; for (let i = 0; i < 4; i++) c.fill(cut(rectPts(-40 + i * 78, -214, -4 + i * 78, -178, 2, i), 650 + i, 12, 1.2));
    c.fillStyle = C.pink; c.fill(cut(ring(-185, -250, 78, 38, 18, -0.1), 646, 16, 2)); });
  if (zzz) for (let i = 0; i < 3; i++) { const u = ((t * 0.35 + i / 3) % 1), zx = -110 + u * 110 + i * 14, zy = -300 - u * 230, a = Math.sin(u * Math.PI), sz = 34 + i * 12;
    c.save(); c.globalAlpha *= a; c.translate(zx, zy); c.rotate(0.15); c.fillStyle = C.white; c.fill(cut([[-1, -1], [1, -1], [1, -0.6], [-0.25, 0.6], [1, 0.6], [1, 1], [-1, 1], [-1, 0.6], [0.25, -0.6], [-1, -0.6]].map(p => [p[0] * sz, p[1] * sz]), 660 + i, 12, 1.2)); c.restore(); }
  c.restore(); };
// 跑鞋（侧面，朝 +x）：鞋面（col）＋白厚底＋黄色勾＋鞋带短条
K.shoe = (c, x, y, s = 1, o = {}) => { const { col = C.red, rot = 0, flip = false, alpha = 1 } = o;
  const up = K.once('shoeUp', () => cut([[-150, -10], [-150, -120], [-110, -140], [-60, -120], [-20, -150], [40, -90], [120, -62], [160, -20], [160, 0]], 671, 20, 2.2));
  const sole = K.once('shoeSole', () => cut([[-158, -10], [168, -10], [172, 26], [150, 40], [-150, 40], [-166, 20]], 672, 20, 2));
  const stripe = K.once('shoeStripe', () => cut([[-90, -40], [-20, -90], [30, -60], [-40, -30]], 673, 14, 1.4));
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(flip ? -s : s, s);
  K.shadow(c, () => { fillP(c, up, col); fillP(c, sole, C.white); });
  fillP(c, stripe, C.yel); c.fillStyle = C.white; for (let i = 0; i < 3; i++) c.fill(cut(rectPts(-10 + i * 34, -130 + i * 20, 20 + i * 34, -116 + i * 20, 1, i), 680 + i, 10, 1));
  c.fillStyle = C.black; c.fill(cut(rectPts(-150, 20, 160, 34, 2, 5), 690, 20, 1)); c.restore(); };
// 餐盘（俯视）：白盘＋几块食物纸。o.items 色名数组
K.plate = (c, x, y, r = 150, o = {}) => { const { seed = 1, items = [C.greenL, C.org, C.red, C.yel] } = o, rr = U.rng(seed * 5 + 1);
  c.save(); c.translate(x, y);
  K.shadow(c, () => fillP(c, K.cutRing(0, 0, r, r, 701 + seed, 22, 2.5), C.white));
  fillP(c, K.cutRing(0, 0, r * 0.78, r * 0.78, 702 + seed, 22, 2), '#e4ddc9');
  items.forEach((col, i) => { const a = i / items.length * TAU + 0.6, d = r * 0.3, px = Math.cos(a) * d, py = Math.sin(a) * d, sz = r * (0.22 + rr() * 0.08);
    K.shadow(c, () => { c.shadowOffsetX = 3; c.shadowOffsetY = 4; fillP(c, K.cutRing(px, py, sz * 1.2, sz, 710 + i + seed, 12, 1.6), col); }); });
  c.restore(); };
// 彩纸字块的小标签「示意」
const sketchTag = (c, x, y, a = 1) => K.tag(c, '示意', x, y, { size: 52, bg: C.white, fg: C.black, rot: 0.05, alpha: a, seed: 8 });

// ---------- 心率表盘 ----------
// (x,y) 圆心，R 半径（默认 250）；val 0..1 指针位置：0 静息(天蓝)｜.25–.5 轻松(绿)｜.5–.75 吃力(黄)｜.75–1 极限(红)；t 驱动心跳与颤动
K.dial = (c, x, y, R = 250, val = 0.36, o = {}) => { const { t = 0, bpm = 62, heart = true, star = true, alpha = 1, shake = 0.012, zones = [C.sky, C.green, C.yel, C.red] } = o;
  const a0 = Math.PI * 1.04, step = Math.PI * 0.23, hb = 1 + 0.18 * Math.max(0, Math.sin(t * bpm / 60 * TAU * 0.9)), s = R / 250;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s);
  K.shadow(c, () => fillP(c, cut(ring(0, 0, 250, 250, 40), 51, 24, 3), C.white));
  zones.forEach((col, i) => { const st = a0 + i * step + 0.012, e = st + step - 0.024, pts = [];
    for (let k = 0; k <= 8; k++) { const a = lerp(st, e, k / 8); pts.push([Math.cos(a) * 214, Math.sin(a) * 214]); }
    for (let k = 8; k >= 0; k--) { const a = lerp(st, e, k / 8); pts.push([Math.cos(a) * 112, Math.sin(a) * 112]); }
    fillP(c, cut(pts, 60 + i, 22, 2), col); });
  const na = a0 + val * 4 * step + Math.sin(t * 2.3) * shake, zi = Math.min(3, Math.floor(val * 4));
  if (star) { const ga = a0 + (zi + 0.5) * step, s1 = 0.85 + 0.2 * Math.sin(t * 7); c.save(); c.translate(Math.cos(ga) * 244, Math.sin(ga) * 244); c.rotate(t * 0.8); c.scale(s1, s1); K.shadow(c, () => fillP(c, starPath(1, 38, 6), C.yel)); c.restore(); }
  c.save(); c.rotate(na); K.shadow(c, () => fillP(c, cut([[-4, -22], [196, -9], [212, 0], [196, 9], [-4, 22], [-40, 0]], 71, 16, 1.8), C.black)); c.restore();
  K.shadow(c, () => fillP(c, K.cutRing(0, 0, 44 * hb, 44 * hb, 72, 14, 1.5), C.red));
  if (heart) K.shadow(c, () => fillP(c, cut(heartPts(0, 128, 54 * hb), 73, 12, 1.5), C.orgD));
  c.restore(); };

// ---------- 图表：改写成彩纸块（自动带「示意」小标，o.sketch===false 去掉） ----------
// data：数字数组，或 [{v, label, col}]；(x,y,w,h) 为图框，基线在 y+h；o：max, vals（显示数值）, unit, hi（强调第几根）, cols, labelSize
K.paperBars = (c, data, x, y, w, h, lt, at, o = {}) => {
  const d = data.map(q => typeof q === 'number' ? { v: q } : q), n = d.length, mx = o.max || Math.max(...d.map(q => q.v)) * 1.08, cols = o.cols || [C.red, C.yel, C.green, C.pink, C.cobalt, C.org];
  const slot = w / n, bw = Math.min(slot * 0.66, 170), ls = o.labelSize || 44;
  K.shadow(c, () => fillP(c, cut(rectPts(x - 26, y + h, x + w + 26, y + h + 16, 3, 7), 7, 24, 1.6), C.black));
  d.forEach((q, i) => { const p = K.pop(lt, at + i * 0.14, 0.6); if (p <= 0) return;
    const bh = Math.max(8, q.v / mx * h * 0.86) * Math.min(1.12, p), cx = x + slot * (i + 0.5), col = q.col || cols[i % cols.length];
    const path = K.once(`pb|${bw | 0}|${bh | 0}|${i}`, () => cut(rectPts(-bw / 2, -bh, bw / 2, 0, 6, i + 3), 900 + i * 7 + (bh | 0), 24, 2.4));
    c.save(); c.translate(cx, y + h); c.rotate((U.hash(i, 4) - 0.5) * 0.03); K.shadow(c, () => fillP(c, path, col)); c.restore();
    if (o.hi === i && p > 0.8) K.star(c, cx + bw / 2 + 8, y + h - bh + 6, 44, { col: C.yel, t: lt, seed: i + 1 });
    if (o.vals && p > 0.7) K.tag(c, `${q.v}${o.unit || ''}`, cx, y + h - bh - 52, { size: 52, bg: C.white, fg: C.black, rot: (U.hash(i, 6) - 0.5) * 0.06, seed: i + 20, scale: clamp((p - 0.7) * 4) });
    if (q.label && p > 0.3) K.tag(c, q.label, cx, y + h + 62, { size: ls, bg: C.white, fg: C.black, rot: (U.hash(i, 8) - 0.5) * 0.06, seed: i + 40, alpha: clamp((p - 0.3) * 3), fam: 'PuHui-Heavy', padX: 14 });
  });
  if (o.sketch !== false) sketchTag(c, x + w - 40, y - 110, clamp(K.at(lt, at, 0.4)));
};
// 折线 → 一条彩纸带＋圆片节点；vals 数字数组或 [[0..1,0..1]]；(x,y,w,h) 图框；o：min, max, col, area, labels（x 轴标签数组）
K.paperLine = (c, vals, x, y, w, h, lt, at, o = {}) => {
  const n = vals.length, mn = o.min ?? Math.min(...vals), mxv = o.max ?? Math.max(...vals), span = (mxv - mn) || 1, col = o.col || C.red;
  const P0 = vals.map((v, i) => [x + w * i / (n - 1), y + h - (v - mn) / span * h * 0.92 - h * 0.04]);
  const prog = MO.cubicInOut(K.at(lt, at, o.dur || 1.3)), poly = [];                       // 沿折线按固定间距取点，取前 prog 部分
  for (let i = 0; i < n - 1; i++) { const a = P0[i], b = P0[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(L / 20)); for (let k = 0; k < m; k++) poly.push([lerp(a[0], b[0], k / m), lerp(a[1], b[1], k / m)]); }
  poly.push(P0[n - 1]);
  K.shadow(c, () => { fillP(c, cut(rectPts(x - 24, y + h + 4, x + w + 24, y + h + 20, 3, 5), 5, 24, 1.6), C.black); fillP(c, cut(rectPts(x - 24, y - 20, x - 8, y + h + 20, 3, 6), 6, 24, 1.6), C.black); });
  const m = Math.max(2, Math.round(poly.length * prog)); if (prog > 0.01) {
    const q = poly.slice(0, m), L = [], R = [], hw = 14;
    q.forEach((p, i) => { const a = q[Math.max(0, i - 1)], b = q[Math.min(q.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; L.push([p[0] - dy / d * hw, p[1] + dx / d * hw]); R.push([p[0] + dy / d * hw, p[1] - dx / d * hw]); });
    if (o.area) { K.shadow(c, () => fillP(c, cut([...q.map(p => p), [q[q.length - 1][0], y + h], [x, y + h]], 11, 30, 2), DG.rgba(o.area, 0.9))); }
    K.shadow(c, () => fillP(c, cut([...L, ...R.reverse()], 12, 20, 1.6), col)); }
  P0.forEach((p, i) => { const pp = K.pop(lt, at + (o.dur || 1.3) * i / (n - 1) * 0.9, 0.35); if (pp > 0 && (o.dots !== false)) K.shadow(c, () => fillP(c, K.cutRing(p[0], p[1], 20 * pp, 20 * pp, 20 + i, 10, 1.4), C.white)); });
  if (o.labels) o.labels.forEach((s, i) => K.tag(c, s, x + w * i / (o.labels.length - 1), y + h + 62, { size: o.labelSize || 44, bg: C.white, fg: C.black, seed: 60 + i, rot: (U.hash(i, 8) - 0.5) * 0.06, padX: 14, fam: 'PuHui-Heavy' }));
  if (o.sketch !== false) sketchTag(c, x + w - 40, y - 70, clamp(K.at(lt, at, 0.4)));
};

// ---------- 黑剪纸跑者 ----------
// (x,y) = 脚底落地点（地面），scale 1 ≈ 690px 高；pose：run（慢跑）| walk | stand | sit | lie | stretch | hurt
// o：t 秒（步态相位，按 15fps 抽帧＝逐格剪纸感）, lean 额外前倾, col 身色, flip 朝左, speed 步频倍数, shadow 地面投影, seat 坐姿画长凳, heart 胸口红心, hair 头发
// 返回屏幕坐标锚点 { head, chest, hand, foot, knee, ground }，供 callout 用
const AT = (p, a, L) => [p[0] + Math.sin(a) * L, p[1] + Math.cos(a) * L];
function ik(p, target, L1, L2, dir) {
  const dx = target[0] - p[0], dy = target[1] - p[1], d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 1), a = Math.atan2(dy, dx), b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), th = a + dir * b;
  const j = [p[0] + Math.cos(th) * L1, p[1] + Math.sin(th) * L1]; return [j, [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d]]; }
const THI = 170, SHI = 170, TOR = 215, UA = 125, FA = 120, FOOT = 27;
K.runner = (c, x, y, scale = 1, o = {}) => {
  const { pose = 'run', lean: lean0 = 0, col = C.black, flip = false, speed = 1, seat = true, heart = true, hair = true } = o, shadowOn = o.shadow !== false;
  const t = MO.step(o.t || 0, o.fps || 15), far = mixHex(col, '#9a9a9a', 0.18);
  let ph = 0, lean = 0.05 + lean0, tilt = 0.15, hipX = 0, rot = 0, legs, arms, fly = 0, hurtKnee = null, extra = {};
  const J = {
    run: { rate: 7.5, la: 0.5, lb: 0.06, fb: 0.2, fa: 1.05, aa: 0.55, af: 1.6, lean: 0.17, fly: 5 },
    walk: { rate: 4.6, la: 0.3, lb: 0, fb: 0.05, fa: 0.32, aa: 0.28, af: 0.3, lean: 0.03, fly: 0 },
  }[pose];
  let hip, sh;
  const legAng = (i, a1, a2) => ({ a1, a2 });
  if (J) {
    ph = t * J.rate * speed + 1; lean = J.lean + lean0;
    legs = [0, Math.PI].map(off => { const a1 = J.la * Math.sin(ph + off) + J.lb, flex = J.fb + J.fa * Math.max(0, Math.cos(ph + off - 0.3)); return legAng(0, a1, a1 - flex); });
    arms = [Math.PI, 0].map(off => { const a1 = -J.aa * Math.sin(ph + off) - 0.05; return [a1, a1 + J.af]; }); fly = J.fly;
  } else if (pose === 'stand') { const b = Math.sin(t * 2) * 0.02; lean = 0.02 + lean0; legs = [legAng(0, 0.06, 0.04), legAng(0, -0.08, -0.06)]; arms = [[0.1 + b, 0.3 + b], [-0.1 - b, 0.05 - b]]; tilt = 0.05; ph = t * 2; }
  else if (pose === 'stretch') { const s = Math.sin(t * 1.6); lean = 0.0 + s * 0.16 + lean0; legs = [legAng(0, 0.2, 0.18), legAng(0, -0.22, -0.2)]; arms = [[Math.PI - 0.22 + s * 0.15, Math.PI - 0.16 + s * 0.15], [Math.PI - 0.42 + s * 0.15, Math.PI - 0.36 + s * 0.15]]; tilt = -0.05; ph = t; }
  else if (pose === 'lie') { lean = 0; legs = [legAng(0, 0.0, 0.0), legAng(0, 0.0, 0.0)]; arms = [[0.08, 0.1], [0.05, 0.06]]; tilt = 0.0; rot = -Math.PI / 2; ph = t * 1.4; }
  else if (pose === 'sit') { lean = 0.05 + lean0; legs = [legAng(0, Math.PI / 2, 0), legAng(0, Math.PI / 2 - 0.12, -0.05)]; arms = null; tilt = 0.18; ph = t * 1.4; }
  else if (pose === 'hurt') { lean = 0.55 + lean0; legs = [legAng(0, 0.62, 0.02), legAng(0, -0.28, -0.3)]; arms = null; tilt = 0.5; ph = t; }
  else throw new Error('K.runner: 未知 pose ' + pose);
  // 髋高：让最低的那只脚恰好落地（+ 慢跑腾空一点点）
  const ext = legs.map(l => Math.cos(l.a1) * THI + Math.cos(l.a2) * SHI), maxExt = pose === 'sit' ? THI * 0 + SHI : Math.max(...ext), up = fly * Math.max(0, Math.sin(2 * ph + 1.2));
  hip = [hipX, pose === 'lie' ? -50 : -(maxExt + FOOT) - up - (pose === 'sit' ? 0 : 0)];
  if (pose === 'sit') hip[1] = -(SHI + FOOT);
  if (pose === 'lie') hip = [0, 0];
  const breathe = pose === 'stand' || pose === 'lie' || pose === 'sit' ? Math.sin(t * 2) * 2 : 0;
  sh = [hip[0] + Math.sin(lean) * TOR, hip[1] - Math.cos(lean) * TOR + breathe];
  const L2 = legs.map(l => { const k = AT(hip, l.a1, THI), f = AT(k, l.a2, SHI); return { k, f, toe: [f[0] + 62, f[1] + 12] }; });
  if (pose === 'lie') { L2.forEach(l => { l.toe = [l.f[0] + 62, l.f[1] + 12]; }); }
  let A;
  if (arms) A = arms.map(([a1, a2]) => { const e = AT(sh, a1, UA); return { e, h: AT(e, a2, FA) }; });
  else if (pose === 'sit') { A = [ik(sh, [L2[0].k[0] - 6, L2[0].k[1] - 40], UA, FA, -1), ik(sh, [L2[1].k[0] - 50, L2[1].k[1] - 40], UA, FA, -1)].map(([e, h]) => ({ e, h })); }
  else { const fk = L2[0].k; A = [ik(sh, [fk[0] + 4, fk[1] - 36], UA, FA, -1), { e: AT(sh, 0.5, UA), h: AT(AT(sh, 0.5, UA), 0.25, FA) }].map(q => Array.isArray(q) ? { e: q[0], h: q[1] } : q); hurtKnee = [fk[0] + 10, fk[1] - 10]; }
  const ha = lean + tilt, head = [sh[0] + Math.sin(ha) * 86 + 14, sh[1] - Math.cos(ha) * 86];
  // —— 画 ——
  c.save(); c.translate(x, y); c.scale(flip ? -scale : scale, scale);
  if (shadowOn && pose !== 'lie') { c.fillStyle = 'rgba(10,20,40,.2)'; c.fill(cut(ring(pose === 'sit' ? 80 : 20, 8, pose === 'sit' ? 260 : 190, 20, 20), 3, 20, 2)); }
  if (pose === 'lie') { c.fillStyle = 'rgba(10,20,40,.2)'; c.fill(cut(ring(0, 6, 380, 16, 24), 3, 20, 2)); }
  if (pose === 'sit' && seat) K.shadow(c, () => { c.fillStyle = C.org; c.fill(cut(rectPts(-110, -SHI - FOOT + 38, 330, -SHI - FOOT + 76, 3, 4), 91, 22, 2)); c.fillStyle = C.orgD; c.fill(cut(rectPts(-70, -SHI - FOOT + 76, -40, 0, 2, 5), 92, 22, 1.5)); c.fill(cut(rectPts(260, -SHI - FOOT + 76, 290, 0, 2, 6), 93, 22, 1.5)); });
  c.save(); if (pose === 'lie') { c.translate(0, -50); c.rotate(rot); c.translate(0, 0); }
  const limb = (p, q, wa, wb, s0) => capsule(c, p, q, wa, wb, s0), leg = (l, sd) => { limb(hip, l.k, 70, 52, sd); limb(l.k, l.f, 52, 40, sd + 1); limb(l.f, l.toe, 40, 30, sd + 2); }, arm = (a, sd) => { limb(sh, a.e, 46, 36, sd); limb(a.e, a.h, 36, 30, sd + 1); };
  // 吃力/受伤时头发飘带摆幅小
  K.shadow(c, () => {
    c.fillStyle = far; arm(A[1], 10); leg(L2[1], 12);
    c.fillStyle = col; capsule(c, hip, sh, 84, 106, 20); c.fill(cut(ring(head[0], head[1], 46, 54, 22, 0.3), 21, 14, 2));
    leg(L2[0], 30); arm(A[0], 40);
  });
  const hx = head[0], hy = head[1], w = Math.sin(ph) * 10 * (pose === 'run' ? 1 : pose === 'walk' ? 0.5 : 0.25);
  if (heart !== false) { const hb = 1 + 0.16 * Math.max(0, Math.sin(t * 7.2)), cx = lerp(hip[0], sh[0], 0.55) + 6, cy = lerp(hip[1], sh[1], 0.55); c.fillStyle = C.red; c.fill(cut(heartPts(cx, cy, 30 * hb), 41, 10, 1.2)); }
  c.save(); c.translate(hx, hy); c.rotate(ha * 0.5);       // 头发＋红头带跟头一起转
  if (hair) { c.fillStyle = C.yel; c.fill(cut([[-30, -34], [-84, -50 + w], [-150, -22 + w * 1.5], [-96, 6 + w], [-36, 4]], 42, 12, 1.5)); }
  c.fillStyle = C.red; c.fill(cut([[-42, -20], [40, -38], [46, -22], [-42, -4]], 43, 10, 1.2));
  c.fill(cut([[-40, -14], [-86, -6 + w * 1.4], [-100, 16 + w], [-70, 10], [-38, 0]], 44, 8, 1)); c.restore();
  if (hurtKnee) { const s = 0.85 + 0.25 * Math.sin(t * 14); c.save(); c.translate(hurtKnee[0] + 30, hurtKnee[1] - 6); c.rotate(t * 1.2); c.scale(s, s); c.fillStyle = C.yel; c.fill(starPath(77, 62, 8)); c.scale(0.55, 0.55); c.fillStyle = C.red; c.fill(starPath(78, 62, 8)); c.restore(); }
  c.restore(); c.restore();
  const tr = (p) => { let [px, py] = p; if (pose === 'lie') { const ca = Math.cos(rot), sa = Math.sin(rot); [px, py] = [px * ca - py * sa, px * sa + py * ca - 50]; } return [x + (flip ? -px : px) * scale, y + py * scale]; };
  return { head: tr(head), chest: tr([lerp(hip[0], sh[0], 0.55), lerp(hip[1], sh[1], 0.55)]), hand: tr(A[0].h), foot: tr(L2[0].toe), knee: tr(L2[0].k), ground: [x, y] };
};

// ---------- 章节卡：「N 站」进度 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
// 贯穿物（沿站点滑动的小跑者）；换书可在 props.js 里改 K.cardToken = (c, x, y, t) => {…}（x,y 为脚底落地点）
K.cardToken = K.cardToken || ((c, x, y, t) => K.runner(c, x, y, 0.27, { pose: 'run', t, shadow: false }));
const CARD_KINDS = [['blue', 'cobalt'], ['yellow', 'rose'], ['green', 'cobalt'], ['dark', 'cobalt'], ['white', 'cobalt'], ['blue', 'teal'], ['yellow', 'violet'], ['green', 'rose'], ['dark', 'orange'], ['blue', 'violet']];
K.chapterCard = (c, lt, t, n, title) => {
  const [kind, tone] = CARD_KINDS[(n - 1) % CARD_KINDS.length];
  K.bg(c, t, { kind, tone, floor: false, seed: n });
  const NN = Math.max(K.CHAPTER_NAMES.length, n), x0 = 110, x1 = 970, Y = 1245, X = i => lerp(x0, x1, i / Math.max(1, NN - 1));
  // 章号大纸块（砸入）
  const numCol = { blue: [C.red, C.white], yellow: [C.cobalt, C.white], green: [C.pink, C.black], dark: [C.yel, C.black], white: [C.red, C.white] }[kind], s = MO.slamK(clamp((lt - 0.05) / 0.2));
  const ns = String(n), bs = 340;
  if (lt > 0.05) { c.save(); c.translate(540, 450); c.rotate(-0.05); c.scale(s, s); K.shadow(c, () => fillP(c, K.once('numBlk', () => cut(rectPts(-bs / 2 - 20, -bs / 2, bs / 2 + 20, bs / 2, 8, 3), 5, 24, 3)), numCol[0]));
    c.font = `${ns.length > 1 ? 230 : 290}px "PuHui-Black"`; c.fillStyle = numCol[1]; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ns, 0, 14); c.restore();
    K.tag(c, '第 ' + n + ' 站', 760, 640, { size: 56, pair: 1, rot: 0.06, scale: K.pop(lt, 0.3, 0.4), alpha: clamp(K.pop(lt, 0.3, 0.4) * 2), seed: 4 }); }
  // 章名逐字
  const pairs = K.PAIRS.filter(p => p[0] !== (kind === 'blue' ? C.cobalt : kind === 'green' ? C.green : kind === 'dark' ? C.black : kind === 'yellow' ? C.yel : C.white)).slice(0, 5), L = [...title].length;
  K.bigText(c, title, 540, L > 5 ? 905 : 880, lt, 0.5, { size: L > 5 ? 112 : 132, pairs, seed: n * 3, step: 0.1, shift: n });
  // 路线：白纸长条＋N 个剪纸圆点，小跑者从上一站跑到本站
  K.shadow(c, () => fillP(c, K.once('routeBar', () => cut(rectPts(40, Y - 80, 1040, Y + 90, 5, 9), 12, 28, 3)), C.white));
  fillP(c, cut(rectPts(x0 - 24, Y - 6, x1 + 24, Y + 6, 2, 13), 13, 24, 1.2), C.grey);
  for (let i = 0; i < NN; i++) { const done = i < n - 1, curr = i === n - 1, p = curr ? K.pop(lt, 0.5, 0.5) : 1, r = curr ? 24 * Math.max(0.6, p) : 15;
    K.shadow(c, () => { c.shadowOffsetX = 3; c.shadowOffsetY = 4; fillP(c, K.cutRing(X(i), Y, r, r, 100 + i, 10, 1.4), done ? C.green : curr ? C.yel : '#cfc9b8'); });
    if (curr) K.star(c, X(i), Y, 40 * clamp(p), { col: C.red, n: 6, t, seed: 3 + n, twinkle: true, alpha: clamp(p) }); }
  const q = MO.cubicInOut(K.at(lt, 0.15, 0.8)), cx = lerp(n > 1 ? X(n - 2) : x0 - 90, X(n - 1), q);
  K.cardToken(c, cx, Y - 28, t);
  K.finish(c);
};
})();
