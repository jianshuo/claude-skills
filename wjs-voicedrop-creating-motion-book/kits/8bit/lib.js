// 画风套件 8bit（来自《终端里到底有什么》）：竖屏 1080×1920，1985 年 8-bit 像素游戏（huashu 配方 14_8bit）。导出 window.K（章节代码里写 const K = window.K）。
// 规矩：整幅仍是 1080×1920，但所有形状都落在「1 像素块 = 8 屏幕像素」的整数网格上（坐标吸附 8px、不抗锯齿、不用渐变/辉光/圆弧）；
//       深夜蓝底＋终端绿，黄色只给强调，红色只给信号/错误，青蓝/灰白当辅色；动画一律步进（15fps 以下的「几张图交替」），
//       环境层（星点、扫描线、0/1 雨）一直轻动，主体落定即停；所有随机走 U.hash / U.rng，同一 t 画同一帧。
//       像素字（5×7 点阵，仅 ASCII）用 K.ptext/K.glyph，汉字用 PuHui-Black（引擎自带，GB2312）并带 4px 硬投影。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, B = 8, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU, B };
// 兜底：pop 的回弹会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  bg: '#0f0f2e', bg2: '#1b1b4a', dot: '#2a2a6a', white: '#fcfcfc', gray: '#bcbcbc', dgray: '#6c6c8c', ddgray: '#3c3c5c', black: '#000000',
  cap: '#e8e8f0', capSh: '#9c9cb8',
  green: '#62ee58', gDk: '#0dc405', gDD: '#06600a', gHi: '#0b8a14',
  yel: '#f8d038', yDk: '#c89010', red: '#e82704', rDk: '#9c1a02', pink: '#f8a0b0',
  blue: '#47c4f8', bDk: '#0856ef', bDD: '#0838a8', bNavy: '#061c5c', sky: '#aae9fb',
};
K.at = (lt, a, d) => clamp((lt - a) / d);
// 步进弹出：3 档（缩小→过冲→落定），不走连续缓动；返回 0 / 0.6 / 1.15 / 1
K.pop = (lt, a, d = 0.4) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : q >= 1 ? 1 : q < 0.34 ? 0.6 : q < 0.67 ? 1.15 : 1; };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];

// ================= 像素基元 =================
const snap = v => Math.round(v / B) * B;
K.snap = snap;
const fr = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };          // 屏幕像素（调用者保证是 8 的倍数）
const cl = (c, ox, oy, gx, gy, gw, gh, col) => { c.fillStyle = col; c.fillRect(ox + gx * B, oy + gy * B, gw * B, gh * B); };   // 格坐标
const org = (x, y, gw, gh) => [snap(x - gw * B / 2), snap(y - gh * B / 2)];   // 以 (x,y) 为中心的 gw×gh 格物体的左上角
const hsh = (a, b = 0) => U.hash(a, b);
// 带黑边的块（原型的 rect）：黑框＋填色＋左上高光＋右下阴影
const box = (c, ox, oy, gx, gy, gw, gh, fill, hi, sh) => { cl(c, ox, oy, gx, gy, gw, gh, C.black); cl(c, ox, oy, gx + 1, gy + 1, gw - 2, gh - 2, fill);
  if (hi) { cl(c, ox, oy, gx + 1, gy + 1, gw - 2, 1, hi); cl(c, ox, oy, gx + 1, gy + 1, 1, gh - 2, hi); }
  if (sh) { cl(c, ox, oy, gx + 1, gy + gh - 2, gw - 2, 1, sh); cl(c, ox, oy, gx + gw - 2, gy + 1, 1, gh - 2, sh); } };
// 缺角面板（对话框/字幕底）：屏幕像素坐标，自动吸附
K.panel = (c, x, y, w, h, o = {}) => { const { fill = C.black, border = C.white, bw = B, alpha = 1 } = o; x = snap(x); y = snap(y); w = snap(w); h = snap(h);
  c.save(); c.globalAlpha *= alpha;
  if (border) { fr(c, x + B, y, w - 2 * B, h, border); fr(c, x, y + B, w, h - 2 * B, border); }
  const i = border ? bw : 0; fr(c, x + B + i, y + i, w - 2 * B - 2 * i, h - 2 * i, fill); fr(c, x + i, y + B + i, w - 2 * i, h - 2 * B - 2 * i, fill); c.restore(); };
// 字符位图（'.' 透明，其余查 pal）；s = 每个位图格占几个 8px 块；返回宽高（屏幕像素）
const sprite = (c, ox, oy, rows, pal, s = 1, flip = false) => { const cs = B * s; let wmax = 0;
  rows.forEach((r, j) => { wmax = Math.max(wmax, r.length); let i = 0; while (i < r.length) { const ch = r[i]; if (ch === '.' || !pal[ch]) { i++; continue; } let k = i; while (k < r.length && r[k] === ch) k++;
    c.fillStyle = pal[ch]; const gx = flip ? wmax - k : i; c.fillRect(ox + gx * cs, oy + j * cs, (k - i) * cs, cs); i = k; } });
  return [wmax * cs, rows.length * cs]; };
K.sprite = sprite;
// 蒙版物体：f(x,y)→是否在内；自动描 1 格黑边；fill(x,y)→颜色。gw×gh 的左上角在 (ox,oy)
const maskDraw = (c, ox, oy, gw, gh, f, fill) => { for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { if (!f(x, y)) continue;
  const edge = !f(x - 1, y) || !f(x + 1, y) || !f(x, y - 1) || !f(x, y + 1); c.fillStyle = edge ? C.black : fill(x, y); c.fillRect(ox + x * B, oy + y * B, B, B); } };
// 格坐标线（Bresenham）：返回格点数组
const cellLine = (x0, y0, x1, y1) => { const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
  for (;;) { pts.push([x0, y0]); if ((x0 === x1 && y0 === y1) || ++n > 400) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return pts; };

// ================= 5×7 点阵字（仅 ASCII；小写按大写画） =================
const F5 = { A: 'e,11,11,1f,11,11,11', B: '1e,11,11,1e,11,11,1e', C: 'e,11,10,10,10,11,e', D: '1e,11,11,11,11,11,1e', E: '1f,10,10,1e,10,10,1f', F: '1f,10,10,1e,10,10,10', G: 'e,11,10,17,11,11,f',
  H: '11,11,11,1f,11,11,11', I: 'e,4,4,4,4,4,e', J: '7,2,2,2,2,12,c', K: '11,12,14,18,14,12,11', L: '10,10,10,10,10,10,1f', M: '11,1b,15,15,11,11,11', N: '11,19,15,13,11,11,11', O: 'e,11,11,11,11,11,e',
  P: '1e,11,11,1e,10,10,10', Q: 'e,11,11,11,15,12,d', R: '1e,11,11,1e,14,12,11', S: 'f,10,10,e,1,1,1e', T: '1f,4,4,4,4,4,4', U: '11,11,11,11,11,11,e', V: '11,11,11,11,11,a,4', W: '11,11,11,15,15,1b,11',
  X: '11,11,a,4,a,11,11', Y: '11,11,a,4,4,4,4', Z: '1f,1,2,4,8,10,1f', 0: 'e,11,13,15,19,11,e', 1: '4,c,4,4,4,4,e', 2: 'e,11,1,2,4,8,1f', 3: '1f,2,4,2,1,11,e', 4: '2,6,a,12,1f,2,2', 5: '1f,10,1e,1,1,11,e',
  6: '6,8,10,1e,11,11,e', 7: '1f,1,2,4,8,8,8', 8: 'e,11,11,e,11,11,e', 9: 'e,11,11,f,1,2,c', ' ': '0,0,0,0,0,0,0', '>': '10,8,4,2,4,8,10', '<': '1,2,4,8,4,2,1', $: '4,f,14,e,5,1e,4', _: '0,0,0,0,0,0,1f',
  '.': '0,0,0,0,0,c,c', ',': '0,0,0,0,c,4,8', ':': '0,c,c,0,c,c,0', ';': '0,c,c,0,c,4,8', '/': '1,1,2,4,8,10,10', '\\': '10,10,8,4,2,1,1', '-': '0,0,0,1f,0,0,0', '+': '0,4,4,1f,4,4,0', '=': '0,0,1f,0,1f,0,0',
  '#': 'a,a,1f,a,1f,a,a', '!': '4,4,4,4,4,0,4', '?': 'e,11,1,2,4,0,4', '*': '0,15,e,1f,e,15,0', '%': '18,19,2,4,8,13,3', '(': '2,4,8,8,8,4,2', ')': '8,4,2,2,2,4,8', '[': 'e,8,8,8,8,8,e', ']': 'e,2,2,2,2,2,e',
  '{': '2,4,8,8,8,4,2', '}': '8,4,2,2,2,4,8', '~': '0,0,8,15,2,0,0', '|': '4,4,4,4,4,4,4', '"': 'a,a,0,0,0,0,0', "'": '4,4,8,0,0,0,0', '@': 'e,11,17,15,17,10,e', '&': 'c,12,c,14,13,12,d', '^': '4,a,11,0,0,0,0', '`': '8,4,0,0,0,0,0' };
const G5 = {}; for (const k in F5) G5[k] = F5[k].split(',').map(h => parseInt(h, 16));
const gl = ch => G5[ch] || G5[String(ch).toUpperCase()] || null;
const hasGlyph = ch => !!gl(ch);
// 画一个字：(x,y) 左上角（屏幕像素），sc = 每个点占几个 8px 块；返回 false 表示字库里没有
K.glyph = (c, ch, x, y, o = {}) => { const g = gl(ch); if (!g) return false; const { sc = 1, col = C.white } = o, cs = B * sc; x = snap(x); y = snap(y); c.fillStyle = col;
  for (let j = 0; j < 7; j++) { const r = g[j]; let i = 0; while (i < 5) { if (!(r >> (4 - i) & 1)) { i++; continue; } let k = i; while (k < 5 && (r >> (4 - k) & 1)) k++; c.fillRect(x + i * cs, y + j * cs, (k - i) * cs, cs); i = k; } } return true; };
// 点阵字符串（仅 ASCII）。align: left/center/right，y 为字的垂直中心。shadow: 黑硬投影一格
K.ptext = (c, s, x, y, o = {}) => { const { sc = 1, col = C.white, align = 'center', shadow = false, alpha = 1, track = 1 } = o, cs = B * sc, adv = (5 + track) * cs; s = String(s);
  const w = s.length * adv - track * cs; let x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2; x0 = snap(x0); const y0 = snap(y - 3.5 * cs);
  c.save(); c.globalAlpha *= alpha;
  if (shadow) [...s].forEach((ch, i) => K.glyph(c, ch, x0 + i * adv + (sc > 1 ? B : 4), y0 + (sc > 1 ? B : 4), { sc, col: C.black }));
  [...s].forEach((ch, i) => K.glyph(c, ch, x0 + i * adv, y0, { sc, col })); c.restore(); return w; };
// 把 ASCII 串变成 7 行 '#'/'.' 点阵（给 K.matrix 用）
K.font5 = s => { const rows = ['', '', '', '', '', '', '']; [...String(s)].forEach((ch, i) => { const g = gl(ch) || G5[' ']; for (let j = 0; j < 7; j++) rows[j] += (i ? '.' : '') + [...Array(5)].map((_, k) => g[j] >> (4 - k) & 1 ? '#' : '.').join(''); }); return rows; };
// 步进打字：lt 时刻起每秒 rate 个字，返回已显示字数（整数）
K.nchars = (lt, at, rate = 12) => Math.max(0, Math.floor((lt - at) * rate));
// 弹出一个东西：步进缩放用不了（会破网格），改成「浮现」：先半透明低 1 格，再落定。fn(c) 里照常画
K.appear = (c, lt, at, fn, o = {}) => { const p = K.pop(lt, at, o.dur || 0.3); if (p <= 0) return; c.save(); if (p < 1) { c.globalAlpha *= p < 1 && p < 0.8 ? 0.5 : 0.85; c.translate(0, B * (o.hop ?? 1) * (p < 0.8 ? 1 : p > 1.1 ? -1 : 0)); } fn(c); c.restore(); };

// ================= 底（每章换一种 kind） =================
// kind: 'stars' 星空（默认）｜'grid' 网格｜'crt' CRT 扫描线｜'rain' 0/1 雨；tone: 'blue'(深夜蓝) | 'green'(暗绿) | 'black'
const TONE = { blue: ['#0f0f2e', '#1b1b4a', '#2a2a6a'], green: ['#04140c', '#0a2a14', '#0f3a1c'], black: ['#050510', '#0f0f2e', '#1b1b4a'] };
const tn = o => TONE[o.tone] || TONE.blue;
K.bg = (c, t, o = {}) => { const { kind = 'stars', seed = 1 } = o, [b0, b1, b2] = tn(o), tk = o.tone || 'blue';
  if (kind === 'grid') {
    c.drawImage(P.cached('k8_grid_' + tk, W, H, g => { fr(g, 0, 0, W, H, b0); for (let x = 0; x < W; x += 96) fr(g, x, 0, 8, H, b1); for (let y = 0; y < H; y += 96) fr(g, 0, y, W, 8, b1);
      for (let y = 0; y < H; y += 96) for (let x = 0; x < W; x += 96) fr(g, x, y, 8, 8, b2); }), 0, 0);
    const sy = Math.floor(t * 2) * 8 % 96; c.save(); c.globalAlpha = 0.5; for (let y = -96 + sy; y < H; y += 96) fr(c, 0, y, W, 8, b1); c.restore();   // 横线慢慢往下走
    for (let i = 0; i < 6; i++) { const x = Math.floor(hsh(i, seed) * 11) * 96, ph = Math.floor(t * 4 + hsh(i, seed + 5) * 20), y = ((ph * 8 + i * 360) % H); fr(c, x, y, 8, 24, C.dot); }   // 沿线游走的光点
  } else if (kind === 'crt') {
    c.drawImage(P.cached('k8_crt_' + tk, W, H, g => { fr(g, 0, 0, W, H, b0); for (let y = 0; y < H; y += 8) fr(g, 0, y + 4, W, 4, 'rgba(0,0,0,.28)');
      fr(g, 0, 0, W, 16, 'rgba(0,0,0,.45)'); fr(g, 0, H - 16, W, 16, 'rgba(0,0,0,.45)'); fr(g, 0, 0, 16, H, 'rgba(0,0,0,.35)'); fr(g, W - 16, 0, 16, H, 'rgba(0,0,0,.35)');
      const r = U.rng(seed * 7 + 3); for (let i = 0; i < 40; i++) fr(g, Math.floor(r() * 135) * 8, Math.floor(r() * 240) * 8, 8, 8, b1); }), 0, 0);
    const by = (Math.floor(t * 5) * 8) % (H + 400) - 200; c.save(); c.globalAlpha = 0.07; fr(c, 0, by, W, 120, C.white); c.restore();   // 一条亮带自上而下滚过（刷新线）
    if (Math.floor(t * 12) % 23 === 0) { c.save(); c.globalAlpha = 0.05; fr(c, 0, 0, W, H, C.white); c.restore(); }   // 偶尔整屏闪一下
  } else if (kind === 'rain') {
    fr(c, 0, 0, W, H, b0); const col = o.tone === 'green' ? '#145a28' : '#0b3d4a';
    for (let i = 0; i < 15; i++) { const x = i * 72 + 16, sp = 6 + Math.floor(hsh(i, seed) * 8), len = 5 + Math.floor(hsh(i, seed + 1) * 8), hd = Math.floor(t * sp + hsh(i, seed + 2) * 60) % 45;
      for (let j = 0; j < len; j++) { const gy = ((hd - j) % 45 + 45) % 45; const ch = hsh(i * 9 + j, Math.floor(t * 3) + seed) > 0.5 ? '1' : '0';
        c.save(); c.globalAlpha = j === 0 ? 0.8 : 0.5 - j * 0.45 / len; K.glyph(c, ch, x, gy * 48 - 24, { sc: 1, col: j === 0 ? '#2a8a3c' : col }); c.restore(); } }
  } else {   // stars
    c.drawImage(P.cached('k8_stars_' + tk, W, H, g => { fr(g, 0, 0, W, H, b0); for (let y = 0; y < 240; y += 6) for (let x = (y / 6 % 2) * 3; x < 135; x += 6) fr(g, x * 8, y * 8, 8, 8, b2);
      for (let i = 0; i < 26; i++) { const x = (i * 53 + 17) % 135, y = (i * 97 + 11) % 240; fr(g, x * 8, y * 8, 8, 8, i % 4 ? C.dgray : C.white); } }), 0, 0);   // 原型的十字点纹＋静态星
    const n = o.dense || 18; for (let i = 0; i < n; i++) { const ph = Math.floor(t * 2.5 + hsh(i, seed) * 8) % 4, x = Math.floor(hsh(i, seed + 3) * 135) * 8, y = (Math.floor(hsh(i, seed + 4) * 240) * 8 + Math.floor(t * 1.5) * 8) % H;
      if (ph === 0) continue; fr(c, x, y, 8, 8, ph === 2 ? C.white : C.dgray); if (ph === 2 && i % 3 === 0) { fr(c, x - 8, y, 24, 8, 'rgba(252,252,252,.35)'); fr(c, x, y - 8, 8, 24, 'rgba(252,252,252,.35)'); } }   // 闪烁星，缓慢下落
  } };
// 每镜收尾：字幕带 y1350–1620 压暗（3 档阶梯，不渐变）
K.finish = c => { c.save(); [[1350, 24, .18], [1374, 24, .32], [1398, 198, .5], [1596, 24, .32], [1620, 0, 0]].forEach(([y, h, a]) => { if (h) { c.fillStyle = `rgba(5,5,22,${a})`; c.fillRect(0, y, W, h); } }); c.restore(); };

// ================= 字 =================
// 汉字：PuHui-Black＋4px 硬投影（不抗锯齿的像素感靠投影和整格对齐）。size 下限 44；标签 ≥52，大标题 100–170
K.text = (c, s, x, y, o = {}) => { const { size = 60, fam = 'PuHui-Black', col = C.white, align = 'center', alpha = 1, scale = 1, shadow = C.black, track = 0 } = o, sz = Math.max(44, size), so = sz >= 100 ? 8 : 4;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(scale, scale); c.font = `${sz}px "${fam}"`; c.textAlign = align; c.textBaseline = 'middle'; if (track) c.letterSpacing = track + 'px';
  if (shadow) { c.fillStyle = shadow; c.fillText(s, so, so); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 带缺角框的标签；plate: 'black'(默认) | 'yel' | 'green' | 'red' | 'blue'
const PLATE = { black: [C.black, C.white, C.white], yel: [C.yel, C.black, C.black], green: [C.gDD, C.green, C.white], red: [C.rDk, C.red, C.white], blue: [C.bDD, C.blue, C.white] };
K.plate = (c, s, x, y, o = {}) => { const { size = 52, kind = 'black', scale = 1, alpha = 1, fam = 'PuHui-Black' } = o, [fill, bor, tc] = PLATE[kind] || PLATE.black, sz = Math.max(44, size);
  c.save(); c.translate(x, y); c.scale(scale, scale); c.font = `${sz}px "${fam}"`; const w = snap(c.measureText(s).width + 56), h = snap(sz * 1.45);
  K.panel(c, -w / 2, -h / 2, w, h, { fill, border: bor, alpha }); c.globalAlpha *= alpha; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = tc; c.fillText(s, 0, 4); c.restore(); };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.3); if (p <= 0) return; (o.plate ? K.plate : K.text)(c, s, x, y, { ...o, scale: p, alpha: (p < 1 ? 0.85 : 1) * (o.alpha ?? 1) }); };
// 引线标注：像素虚线从锚点一格一格伸到标签，末端弹出标签
K.pline = (c, x0, y0, x1, y1, o = {}) => { const { col = C.yel, prog = 1, dash = 2, w = 1 } = o, g = cellLine(Math.round(x0 / B), Math.round(y0 / B), Math.round(x1 / B), Math.round(y1 / B)), n = Math.ceil(g.length * clamp(prog));
  c.fillStyle = col; for (let i = 0; i < n; i++) if (!dash || i % (dash * 2) < dash) c.fillRect(g[i][0] * B, g[i][1] * B, w * B, w * B); };
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = K.at(lt, at, 0.3); if (p1 <= 0) return;
  K.pline(c, ax, ay, bx, by, { col: o.col || C.yel, prog: Math.floor(p1 * 6) / 6 }); fr(c, snap(ax) - 8, snap(ay) - 8, 24, 24, C.black); fr(c, snap(ax), snap(ay), 8, 8, o.col || C.yel);
  const q = K.pop(lt, at + 0.2, 0.3); if (q > 0) K.plate(c, s, bx, by, { size: o.size || 52, kind: o.kind || 'black', scale: q }); };
// 字幕：黑底缺角白框对话框，字幕带 y≈1480
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = snap(c.measureText(text).width + 72), h = 96, x = snap(540 - w / 2), y = 1432;
  K.panel(c, x, y, w, h, { fill: '#0a0a24', border: C.white, bw: 8 }); c.fillStyle = C.white; c.fillText(text, 540, y + h / 2 + 4); c.restore(); };

// ================= 道具：箭头 / 键帽 / 字节 / 管道 =================
// 箭头：dir 'down'|'up'|'left'|'right'；len 总长（格，默认 8）；s 放大倍数；bob：随 t 上下抖（2 档步进）；col
K.arrow = (c, x, y, o = {}) => { const { dir = 'down', len = 8, s = 1, t = 0, bob = true, col = C.yel, alpha = 1 } = o, L = Math.max(5, len), ph = bob ? Math.floor(t * 4) % 2 : 0;
  const parts = [[-1, 0, 3, L - 3], [-3, L - 3, 7, 1], [-2, L - 2, 5, 1], [-1, L - 1, 3, 1]], cx = snap(x), cy = snap(y); c.save(); c.globalAlpha *= alpha; c.fillStyle = col;
  for (const [px, py, pw, ph2] of parts) { const a = px * s, b = (py - L / 2) * s + ph * 1, aw = pw * s, bh = ph2 * s; let rx, ry, rw, rh;
    if (dir === 'down') [rx, ry, rw, rh] = [a, b, aw, bh]; else if (dir === 'up') [rx, ry, rw, rh] = [a, -b - bh, aw, bh];
    else if (dir === 'right') [rx, ry, rw, rh] = [b, a, bh, aw]; else [rx, ry, rw, rh] = [-b - bh, a, bh, aw];
    c.fillRect(cx + Math.round(rx * B), cy + Math.round(ry * B), rw * B, rh * B); } c.restore(); };

// 键帽：label 按键名（ASCII，如 'A'/'ENTER'/'ESC'/'CTRL'）；w 宽（格，默认 24 = 192px）；press 0/1 按下；burst 按下时冲击线；hi 键帽主色
K.keycap = (c, x, y, o = {}) => { const { label = 'A', w = 24, press = 0, t = 0, burst = true, col = C.cap, sh = C.capSh, txt = C.black } = o, fw = w - 4, fh = Math.max(7, Math.round(w * 0.46)), total = fh + 12, [ox, oy0] = org(x, y, w + 2, total), oy = oy0 + 4 * B, dn = press ? 3 : 0, ph = Math.floor(t * 4) % 2;
  box(c, ox, oy, 0, dn, w, fh, sh, null, null); box(c, ox, oy, 2, dn - 4, fw, fh, col, C.white, sh);   // 键身（侧面）＋键面
  box(c, ox, oy, -1, fh, w + 2, 8, C.dgray, null, null); cl(c, ox, oy, 0, fh + 1, w, 1, sh);        // 键座盖在键身下沿：按下时键帽「陷进去」
  const s = String(label), maxw = fw - 4; let sc = 4; while (sc > 1 && ((s.length * 6 - 1) * sc > maxw || 7 * sc > fh - 3)) sc--; const gw = (s.length * 6 - 1) * sc, gx = 2 + Math.floor((fw - gw) / 2), gy = dn - 4 + Math.ceil((fh - 7 * sc) / 2);
  for (let i = 0; i < s.length; i++) K.glyph(c, s[i], ox + (gx + i * 6 * sc) * B, oy + gy * B, { sc, col: txt });
  if (press && burst) for (const [bx, by, bw, bh] of [[-8, 6, 4, 1], [-6, -1, 1, 4], [w + 4, 6, 4, 1], [w + 5, -1, 1, 4], [w / 2, -10, 1, 4]]) cl(c, ox, oy, Math.round(bx), by + ph, bw, bh, C.yel);
  return { x: ox, y: oy - 4 * B, w: (w + 2) * B, h: total * B }; };

// 字节/位灯条：value 数值（取低 n 位）或 bits 字符串 '01000001'；n 位数；cw 每盏灯宽（格，默认 12）；reveal 0..1 从左到右依次点亮出现；
// hi 要加黄框的位序号（数组）；scan 流动高亮位置（0..n 小数，步进）；bracket 底部黄色括号；on/off 自定色
K.byte = (c, x, y, o = {}) => { const { n = 8, cw = 12, reveal = 1, hi = [], bracket = false, scan = -1, col = C.green } = o;
  const bits = o.bits ? String(o.bits).padStart(n, '0').slice(-n) : (Math.floor(o.value || 0) >>> 0).toString(2).padStart(n, '0').slice(-n), ch = Math.round(cw * 1.3), step = cw + 1, tw = n * step - 1, [ox, oy] = org(x, y, tw, ch + (bracket ? 5 : 0)), sc = Math.max(1, Math.floor((cw - 2) / 6));
  const shown = Math.ceil(n * clamp(reveal)); for (let i = 0; i < shown; i++) { const on = bits[i] === '1', gx = i * step, lit = Math.floor(scan) === i;
    box(c, ox, oy, gx, 0, cw, ch, on ? C.gDk : C.gDD, on ? col : C.gHi, null);
    const g = (cw - (5 * sc)) >> 1; K.glyph(c, bits[i], ox + (gx + g) * B, oy + (1 + Math.floor((ch - 2 - 7 * sc) / 2)) * B, { sc, col: on ? C.white : C.gDk });
    if (lit) { cl(c, ox, oy, gx - 1, -1, cw + 2, 1, C.yel); cl(c, ox, oy, gx - 1, ch, cw + 2, 1, C.yel); cl(c, ox, oy, gx - 1, 0, 1, ch, C.yel); cl(c, ox, oy, gx + cw, 0, 1, ch, C.yel); }
    if (hi.includes(i)) { cl(c, ox, oy, gx - 1, -1, cw + 2, 1, C.yel); cl(c, ox, oy, gx - 1, ch, cw + 2, 1, C.yel); cl(c, ox, oy, gx - 1, 0, 1, ch, C.yel); cl(c, ox, oy, gx + cw, 0, 1, ch, C.yel); } }
  if (bracket) { const by = ch + 2; cl(c, ox, oy, -1, by, tw + 2, 1, C.yel); cl(c, ox, oy, -1, by - 2, 1, 3, C.yel); cl(c, ox, oy, tw, by - 2, 1, 3, C.yel); }
  return { x: ox, y: oy, w: tw * B, h: ch * B, bits }; };
K.bits = K.byte;

// 管道/传送带：w 长、h 高（格，默认 60×30）；items 流动的 0/1 串（循环）；dir 1 向右 / -1 向左；speed 格/秒；col 'blue'|'green'|'yellow'|'red'|'gray'；vertical 竖放（x,y 仍是中心）
const PIPE = { blue: [C.bDD, C.bDk, C.blue, C.bNavy], green: [C.gDD, C.gDk, C.green, '#033a06'], yellow: ['#7a5a08', C.yDk, C.yel, '#3a2a04'], red: [C.rDk, '#c01c04', C.red, '#4a0a00'], gray: [C.ddgray, C.dgray, C.gray, '#1c1c2c'] };
K.pipe = (c, x, y, o = {}) => { const { w = 60, h = 30, items = '10110111', dir = 1, speed = 30, t = 0, col = 'blue', vertical = false, flow = true } = o, [dk, md, lt, nv] = PIPE[col] || PIPE.blue;
  c.save(); if (vertical) { c.translate(snap(x), snap(y)); c.rotate(Math.PI / 2); c.translate(-snap(x), -snap(y)); }
  const [ox, oy] = org(x, y, w, h), th = Math.max(8, Math.round(h / 3)), ty = Math.floor((h - th) / 2), isz = th - 1, gap = isz + 5, nIt = Math.ceil((w - 4 + gap) / gap), sc = isz >= 16 ? 2 : 1;
  box(c, ox, oy, 0, 0, w, h, dk, md, nv); cl(c, ox, oy, 1, ty - 1, w - 2, th + 2, C.black);
  const fr15 = Math.floor(t * 15), off = flow ? (fr15 * 2 * (speed / 30)) | 0 : 0; c.save(); c.beginPath(); c.rect(ox + 2 * B, oy + ty * B, (w - 4) * B, th * B); c.clip();
  for (let i = 0; i < nIt; i++) { let gx = ((i * gap + dir * off) % (nIt * gap)); if (gx < 0) gx += nIt * gap; gx -= gap; const k = (((i % nIt) + nIt) % nIt), chr = items[k % items.length], on = chr === '1';
    cl(c, ox, oy, 2 + gx, ty, isz, th, o.itemCol || (on ? C.blue : C.green)); const gw = (5 * sc), g = Math.floor((isz - gw) / 2); K.glyph(c, chr, ox + (2 + gx + g) * B, oy + (ty + Math.floor((th - 7 * sc) / 2)) * B, { sc, col: C.black }); }
  c.restore(); cl(c, ox, oy, 0, 0, 4, h, lt); cl(c, ox, oy, w - 4, 0, 4, h, lt); cl(c, ox, oy, 0, 0, 4, 1, C.black); cl(c, ox, oy, 0, h - 1, 4, 1, C.black); cl(c, ox, oy, w - 4, 0, 4, 1, C.black); cl(c, ox, oy, w - 4, h - 1, 4, 1, C.black);
  for (let rx = 6; rx < w - 4; rx += 8) { cl(c, ox, oy, rx, 2, 2, 2, md); cl(c, ox, oy, rx, h - 4, 2, 2, md); }   // 铆钉
  c.restore(); return { x: ox, y: oy, w: w * B, h: h * B }; };

// ================= 道具：屏幕 / 终端 / 窗格 / 点阵 =================
// 窗格：w×h 格，title 标题（ASCII 走点阵字，含汉字走 PuHui 44），kind 'blue'|'gray'|'green'|'yel'|'red'，focus 黄框，fill 内底；返回内区 {x,y,w,h}（屏幕像素）
const PANE = { blue: [C.bDk, C.white], gray: [C.dgray, C.white], green: [C.gDk, C.black], yel: [C.yel, C.black], red: [C.red, C.white] };
K.pane = (c, x, y, o = {}) => { const { w = 40, h = 30, title = '', kind = 'blue', focus = false, fill = C.black, dots = true } = o, [ox, oy] = org(x, y, w, h), [tb, tc] = PANE[kind] || PANE.blue, bar = 9;
  cl(c, ox, oy, 0, 0, w, h, focus ? C.yel : C.black); cl(c, ox, oy, 1, 1, w - 2, h - 2, C.black); cl(c, ox, oy, 2, 2, w - 4, bar, tb); cl(c, ox, oy, 2, 2 + bar, w - 4, h - 4 - bar, fill);
  if (dots) [C.red, C.yel, C.green].forEach((cc, i) => { cl(c, ox, oy, 4 + i * 4, 4, 3, 3, C.black); cl(c, ox, oy, 4 + i * 4, 4, 2, 2, cc); });
  if (title) { const tx = ox + (dots ? 17 : 4) * B; if ([...title].every(hasGlyph)) K.ptext(c, title, tx, oy + (2 + bar / 2) * B, { align: 'left', col: tc }); else { c.save(); c.font = '44px "PuHui-Bold"'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = tc; c.fillText(title, tx, oy + (2 + bar / 2) * B + 2); c.restore(); } }
  return { x: ox + 2 * B, y: oy + (2 + bar) * B, w: (w - 4) * B, h: (h - 4 - bar) * B }; };
K.window = K.pane;
// 文本块：lines 每项 'str' 或 {s, col}；n 已显示字符数（Infinity=全部）；sc 点阵字号（1=字高 56px，2=112px）；汉字走 PuHui（占一个字宽）；光标步进闪
const textBlock = (c, px, py, lines, o = {}) => { const { n = Infinity, sc = 1, col = C.green, cursor = true, t = 0, maxLines = 99 } = o, adv = 6 * sc * B, lh = 9 * sc * B; let left = n, last = null; const vis = lines.slice(-maxLines);
  vis.forEach((ln, j) => { const s = typeof ln === 'string' ? ln : ln.s, cc = typeof ln === 'string' ? col : (ln.col || col); const take = Math.max(0, Math.min([...s].length, left)); left -= [...s].length;
    if (take > 0 || n === Infinity) { [...s].slice(0, take).forEach((ch, i) => { const x = px + i * adv, y = py + j * lh; if (!K.glyph(c, ch, x, y, { sc, col: cc }) && ch !== ' ') { c.save(); c.font = `${44 * sc}px "PuHui-Bold"`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = cc; c.fillText(ch, x, y + 3.5 * sc * B + 2); c.restore(); } });
      last = [px + take * adv, py + j * lh]; } if (left < 0) left = 0; });
  if (cursor && last && Math.floor(t * 2.5) % 2 === 0) fr(c, snap(last[0]), snap(last[1]), 5 * sc * B, 7 * sc * B, o.curCol || C.green); return last; };
K.textBlock = textBlock;
// 终端窗口：窗格＋文本；o 同 pane，另有 lines/n/sc/col/cursor/t。prompt 行建议写 '$ ls'
K.term = (c, x, y, o = {}) => { const { lines = [], n = Infinity, sc = 1, col = C.green, cursor = true, t = 0, w = 60, h = 40 } = o, r = K.pane(c, x, y, { kind: 'gray', ...o, w, h });
  c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); textBlock(c, r.x + 16, r.y + 16, lines, { n, sc, col, cursor, t, maxLines: Math.floor((r.h - 16) / (9 * sc * B)) }); c.restore(); return r; };
// 屏幕（CRT 显示器）：w×h 格（含边框，默认 100×60），lines/n/cursor/sc/col 同 term；stand 带底座；glow 满屏发光像素 {gx,gy,col}（格坐标，相对屏内）
K.screen = (c, x, y, o = {}) => { const { w = 100, h = 60, lines = [], n = Infinity, sc = 1, col = C.green, cursor = true, t = 0, stand = true, px = [] } = o, [ox, oy] = org(x, y, w, h + (stand ? 4 : 0));
  box(c, ox, oy, 0, 0, w, h, C.dgray, C.gray, C.ddgray); cl(c, ox, oy, 4, 4, w - 8, h - 8, C.black);
  for (let j = 5; j < h - 5; j += 4) for (let i = 5; i < w - 5; i += 4) cl(c, ox, oy, i, j, 1, 1, '#0a2a0c');   // 点阵纹
  if (stand) { cl(c, ox, oy, Math.floor(w / 2) - 8, h, 16, 3, C.dgray); cl(c, ox, oy, Math.floor(w / 2) - 12, h + 3, 24, 1, C.black); }
  for (const [gx, gy, cc, sz = 1] of px) cl(c, ox, oy, 4 + gx, 4 + gy, sz, sz, cc || col);
  const ix = ox + 6 * B, iy = oy + 6 * B; c.save(); c.beginPath(); c.rect(ox + 4 * B, oy + 4 * B, (w - 8) * B, (h - 8) * B); c.clip();
  textBlock(c, ix, iy, lines, { n, sc, col, cursor, t, curCol: col, maxLines: Math.floor(((h - 12) * B) / (9 * sc * B)) }); c.restore();
  return { x: ox + 4 * B, y: oy + 4 * B, w: (w - 8) * B, h: (h - 8) * B }; };
// 点阵屏：rows 字符串数组（'#' 亮 '.' 灭），可用 K.font5('HI') 生成；cs 每点占几格（≥2，默认 3）；on 亮色；plate 黑底
K.matrix = (c, x, y, rows, o = {}) => { const { cs = 3, on = C.green, off = '#0a1a0c', plate = true, flicker = 0, t = 0 } = o, gw = Math.max(...rows.map(r => r.length)), tw = gw * cs + 1, th = rows.length * cs + 1, [ox, oy] = org(x, y, tw + 2, th + 2);
  if (plate) { cl(c, ox, oy, 0, 0, tw + 2, th + 2, C.dgray); cl(c, ox, oy, 1, 1, tw, th, C.black); }
  rows.forEach((r, j) => [...r].forEach((ch, i) => { let lit = ch === '#'; if (lit && flicker && hsh(i + j * 40, Math.floor(t * 8)) < flicker) lit = false; cl(c, ox, oy, 2 + i * cs, 2 + j * cs, cs - 1, cs - 1, lit ? on : off); }));
  return { x: ox, y: oy, w: (tw + 2) * B, h: (th + 2) * B }; };

// ================= 道具：像素小人（NES 风 20 宽×24 高精灵，脸只有两点眼） =================
const PAL = (o = {}) => ({ K: C.black, h: o.hair || '#6a3a14', s: '#f8b878', b: o.shirt || C.red, B: o.shirtD || '#9c1a02', p: o.pants || C.bDk, P: '#0838a8', o: '#e8e8f0', y: C.yel, k: C.ddgray, d: C.dgray, g: C.green, w: C.white });
const pad = r => '..' + r + '..';
const HEAD = ['....KKKKKKKK....', '...KhhhhhhhhK...', '..KhhhhhhhhhhK..', '..KhhhhhhhhhhK..', '..KhssssssssshK..'.slice(0,0) + '..Khssssssssh' + 'K..', '..KssKssssKssK..', '..KssKssssKssK..', '..KssssKKssssK..', '...KssssssssK...', '....KKKKKKKK....'].map(pad);
const TORSO = ['...KbbbbbbbbK...', '...KbbbbbbbbK...', '...KbbbbbbbbK...', '...KbbbbbbbbK...', '...KbbbbbbbbK...', '...KBBBBBBBBK...', '...KppppppppK...', '...KppppppppK...'].map(pad);
const LEGS = { stand: ['....KppKKppK....', '....KppK..KppK..', '....KppK..KppK..', '....KppK..KppK..', '...KoooK..KoooK.', '...KKKKK..KKKKK.'].map(pad),
  walkA: ['....KppKKppK....', '....KppK..KppK..', '....KppK..KppK..', '...KppK....KoK..', '...KoooK..KKK...', '...KKKKK........'].map(pad),
  walkB: ['....KppKKppK....', '....KppK..KppK..', '....KppK..KppK..', '...KoK....KppK..', '....KKK..KoooK..', '.........KKKKK..'].map(pad) };
// 手臂叠加层（20 列坐标系：左臂列 3–4，右臂列 15–16）；每项 [行, 起始列, 串]
const ARMS = {
  down: [[10, 3, 'Kb'], [11, 3, 'Kb'], [12, 3, 'Kb'], [13, 3, 'Kb'], [14, 3, 'Ks'], [15, 3, 'KK'], [10, 15, 'bK'], [11, 15, 'bK'], [12, 15, 'bK'], [13, 15, 'bK'], [14, 15, 'sK'], [15, 15, 'KK']],
  waveA: [[10, 3, 'Kb'], [11, 3, 'Kb'], [12, 3, 'Kb'], [13, 3, 'Kb'], [14, 3, 'Ks'], [15, 3, 'KK'], [3, 16, 'KKK'], [4, 16, 'KsK'], [5, 16, 'KsK'], [6, 16, 'KbK'], [7, 16, 'KbK'], [8, 15, 'KbK'], [9, 15, 'bbK'], [10, 15, 'bK']],
  waveB: [[10, 3, 'Kb'], [11, 3, 'Kb'], [12, 3, 'Kb'], [13, 3, 'Kb'], [14, 3, 'Ks'], [15, 3, 'KK'], [4, 17, 'KK'], [5, 16, 'KssK'], [6, 16, 'KssK'], [7, 16, 'KbbK'], [8, 15, 'KbbK'], [9, 15, 'bbK'], [10, 15, 'bK']],
  cheer: [[2, 2, 'KssK'], [3, 2, 'KssK'], [4, 2, 'KbK'], [5, 2, 'KbK'], [6, 2, 'KbK'], [7, 3, 'KbK'], [8, 3, 'KbK'], [9, 3, 'KbK'], [10, 3, 'Kb'], [2, 14, 'KssK'], [3, 14, 'KssK'], [4, 15, 'KbK'], [5, 15, 'KbK'], [6, 15, 'KbK'], [7, 15, 'KbK'], [8, 15, 'KbK'], [9, 15, 'KbK'], [10, 15, 'bK']] };
const compose = (layers) => { const g = Array.from({ length: 28 }, () => Array(20).fill('.')); layers.forEach(([y0, rows]) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') g[y0 + j][i] = ch; })));
  return g.map(r => r.join('')); };
const stamp = (rows, list) => { const g = rows.map(r => r.split('')); for (const [y, x0, s] of list) [...s].forEach((ch, i) => { if (ch !== '.' && g[y] && x0 + i < 20) g[y][x0 + i] = ch; }); return g.map(r => r.join('')); };
const SITKB = ['...KKKKKKKKKKKKKK...', '...KdkdkdkdkdkdkdK..'.slice(0, 20), '..KddddddddddddddK..', '..KkkkkkkkkkkkkkkK..', '..KkkkkkkkkkkkkkkK..'];
const personFrame = (pose, t) => {
  const fr2 = Math.floor(t * 6) % 2, fr4 = Math.floor(t * 8) % 2;
  let rows;
  if (pose === 'sit') {   // 正面坐在键盘后面：下半身被桌子挡住，两只手交替敲键
    rows = compose([[0, HEAD], [10, TORSO.slice(0, 6)]]);
    rows = stamp(rows, [[10, 3, 'Kb'], [11, 3, 'Kb'], [12, 2, 'Kbb'], [13, 2, 'Kbb'], [10, 15, 'bK'], [11, 15, 'bK'], [12, 15, 'bbK'], [13, 15, 'bbK']]);
    rows = stamp(rows, fr2 ? [[14, 2, 'KssK'], [15, 3, 'KK'], [15, 14, 'KssK'], [14, 14, 'KK']] : [[14, 2, 'KK'], [15, 2, 'KssK'], [14, 14, 'KssK'], [15, 14, 'KK']]);
    const ds = ['...KKKKKKKKKKKKKKKK.', '..KdwdwdwdwdwdwdwdwK', '..KddddddddddddddddK', '.KKKKKKKKKKKKKKKKKKK', '.KkkkkkkkkkkkkkkkkkK', '.KkkkkkkkkkkkkkkkkkK', '.KKKKKKKKKKKKKKKKKKK'];
    rows = rows.slice(0, 16).concat(ds.map(r => r.padEnd(20, '.').slice(0, 20)));
    return rows;
  }
  const bob = pose === 'walk' && fr2 ? 1 : 0, legs = pose === 'walk' ? (fr2 ? LEGS.walkA : LEGS.walkB) : LEGS.stand;
  rows = compose([[bob, HEAD], [10 + bob, TORSO], [18 + bob, legs]]);
  const arms = pose === 'wave' ? (fr4 ? ARMS.waveA : ARMS.waveB) : pose === 'cheer' ? ARMS.cheer : ARMS.down;
  rows = stamp(rows, arms.map(([y, x, s]) => [y + bob, x, s]));
  return rows.slice(0, 26);
};
// 像素小人：pose 'stand'|'wave'|'walk'|'cheer'|'sit'（坐在键盘后敲字）；s 放大倍数（整数，1=128×192px，2=256×384px）；t；dir 1/-1 朝向；
// shirt/hair/pants 换色（K.C 里的色值）。(x,y) 是脚底中心（sit 为桌沿底边中心）；返回 {x,y,w,h}
K.pixelPerson = (c, x, y, o = {}) => { const { pose = 'stand', s = 1, t = 0, dir = 1, shirt, hair, pants, alpha = 1 } = o, rows = personFrame(pose, t), pal = PAL({ shirt, hair, pants }), w = 20 * B * s, h = rows.length * B * s;
  c.save(); c.globalAlpha *= alpha; const ox = snap(x - w / 2), oy = snap(y - h); sprite(c, ox, oy, rows, pal, s, dir < 0); c.restore(); return { x: ox, y: oy, w, h }; };

// ================= 道具：服务器 / 云 / 节点 / 链路 / 数据包 =================
// 机架：units 台数（默认 4）；w 宽（格，默认 20）；alert 第 k 台亮红灯（数字，-1 无）；lit 0..1 亮灯比例；t 灯闪
K.server = (c, x, y, o = {}) => { const { units = 4, w = 20, t = 0, alert = -1, lit = 1, label = '' } = o, uh = 7, h = units * uh + 3, [ox, oy] = org(x, y, w, h);
  cl(c, ox, oy, 0, 0, w, h, C.black); cl(c, ox, oy, 1, 1, w - 2, h - 2, C.ddgray);
  for (let u = 0; u < units; u++) { const gy = 2 + u * uh; box(c, ox, oy, 2, gy, w - 4, uh - 1, C.dgray, C.gray, C.ddgray);
    for (let k = 0; k < 3; k++) { const on = hsh(u * 7 + k, Math.floor(t * 3)) < 0.6 * lit + 0.2 * lit, red = alert === u && k === 0, cc = red ? (Math.floor(t * 4) % 2 ? C.red : C.rDk) : on ? (k === 2 ? C.yel : C.green) : C.ddgray; cl(c, ox, oy, 4 + k * 3, gy + 2, 2, 2, cc); }
    for (let k = 0; k < 4; k++) cl(c, ox, oy, w - 10 + k * 2, gy + 2, 1, 3, C.black); }
  if (label) K.ptext(c, label, ox + w * B / 2, oy + h * B + 32, { sc: 1, col: C.gray });
  return { x: ox, y: oy, w: w * B, h: h * B }; };
K.rack = K.server;
// 云：w 宽（格，默认 30）；col 'white'|'blue'|'gray'；label 云里的字（汉字，PuHui 52）
const CIRC = [[-8, 3, 5], [-2, -1, 7], [6, 1, 6], [12, 4, 4], [-13, 5, 3], [2, 5, 6]];
K.cloud = (c, x, y, o = {}) => { const { w = 30, col = 'white', label = '', t = 0, alpha = 1 } = o, k = w / 30, gw = Math.round(34 * k), gh = Math.round(16 * k), [ox, oy] = org(x, y, gw, gh), cx = 17 * k, cy = 7 * k;
  const f = (gx, gy) => { if (gy < 0 || gx < 0 || gx >= gw || gy >= gh) return false; return CIRC.some(([dx, dy, r]) => Math.hypot(gx + 0.5 - cx - dx * k, gy + 0.5 - cy - dy * k) <= r * k) && gy <= cy + 9 * k; };
  const [fa, fb] = col === 'blue' ? [C.sky, C.blue] : col === 'gray' ? [C.gray, C.dgray] : [C.white, C.cap]; c.save(); c.globalAlpha *= alpha; const bob = Math.floor(t * 1.5) % 2 ? 0 : 0;
  maskDraw(c, ox, oy + bob, gw, gh, f, (gx, gy) => gy > cy + 4 * k ? fb : fa); c.restore();
  if (label) K.text(c, label, ox + gw * B / 2, oy + gh * B / 2 + 8, { size: 52, col: C.black, shadow: false }); return { x: ox, y: oy, w: gw * B, h: gh * B }; };
// 节点：r 半径（格，默认 7）；col 'blue'|'green'|'yellow'|'red'|'gray'；label 单个 ASCII 字符或短串（点阵字）；lit 发亮（外圈闪）
K.node = (c, x, y, o = {}) => { const { r = 7, col = 'blue', label = '', lit = false, t = 0 } = o, d = 2 * r + 1, [ox, oy] = org(x, y, d, d), cc = { blue: [C.blue, C.bDk], green: [C.green, C.gDk], yellow: [C.yel, C.yDk], red: [C.red, C.rDk], gray: [C.gray, C.dgray] }[col] || [C.blue, C.bDk];
  const f = (gx, gy) => Math.hypot(gx - r, gy - r) <= r + 0.35; if (lit && Math.floor(t * 4) % 2) { const d2 = d + 4, [qx, qy] = [ox - 2 * B, oy - 2 * B]; maskDraw(c, qx, qy, d2, d2, (gx, gy) => { const q = Math.hypot(gx - r - 2, gy - r - 2); return q <= r + 2.3 && q >= r + 1.1; }, () => C.yel); }
  maskDraw(c, ox, oy, d, d, f, (gx, gy) => gx + gy < r * 1.45 ? cc[0] : cc[1]);
  if (label) K.ptext(c, label, ox + d * B / 2 + (label.length > 1 ? 0 : 0), oy + d * B / 2, { sc: r >= 9 ? 2 : 1, col: col === 'red' || col === 'blue' ? C.white : C.black }); return { x: ox, y: oy, w: d * B, h: d * B, cx: ox + d * B / 2, cy: oy + d * B / 2 }; };
// 链路：两点间像素虚线＋流动小方块；packets 数量；speed 格/秒；col；prog 0..1 线伸出；down 链路断开（红叉、不流动）
K.link = (c, x0, y0, x1, y1, o = {}) => { const { t = 0, packets = 3, speed = 14, col = C.dgray, pcol = C.yel, prog = 1, down = false } = o, a = [Math.round(x0 / B), Math.round(y0 / B)], b = [Math.round(x1 / B), Math.round(y1 / B)], g = cellLine(a[0], a[1], b[0], b[1]);
  K.pline(c, x0, y0, x1, y1, { col: down ? C.rDk : col, prog, dash: 0 }); if (down) { const m = g[g.length >> 1]; K.signal(c, m[0] * B, m[1] * B, { kind: 'cross', s: 1, t }); return; }
  if (prog < 1) return; const L = g.length, off = Math.floor(t * 15) * (speed / 15);
  for (let i = 0; i < packets; i++) { const k = Math.floor(((i / packets) * L + off) % L), p = g[Math.min(L - 1, Math.max(0, o.dir === -1 ? L - 1 - k : k))]; fr(c, p[0] * B - 4 * 0, p[1] * B, 16, 16, C.black); fr(c, p[0] * B, p[1] * B, 8, 8, pcol); fr(c, p[0] * B + 8, p[1] * B + 8, 8, 8, pcol); } };
// 数据包：w×h 格（默认 16×13）；label ASCII（TCP/IP/GET，≤4 字，点阵字写在黄色包头）；seed 载荷花纹；sealed 加红封条
K.packet = (c, x, y, o = {}) => { const { w = 22, h = 16, label = '', seed = 1, sealed = false, col = C.blue, t = 0 } = o, hd = label ? 9 : 3, [ox, oy] = org(x, y, w, h);
  cl(c, ox, oy, 0, 0, w, h, C.black); cl(c, ox, oy, 1, 1, w - 2, hd, C.yel); cl(c, ox, oy, 1, 1 + hd, w - 2, h - 2 - hd, col); cl(c, ox, oy, 1, h - 2, w - 2, 1, C.bDk); cl(c, ox, oy, 1, 1, w - 2, 1, '#fce890');
  if (label) K.ptext(c, label, ox + w * B / 2, oy + (1 + hd / 2 + 0.1) * B, { sc: 1, col: C.black, track: 1 });
  const r = U.rng(seed * 13 + 1); for (let j = 0; j < h - 3 - hd; j += 2) for (let i = 0; i < w - 4; i += 2) if (r() > 0.5) cl(c, ox, oy, 2 + i, hd + 2 + j, 1, 1, C.white);
  if (sealed) { cl(c, ox, oy, w / 2 - 1, 0, 2, h, C.red); cl(c, ox, oy, 0, h / 2 - 1, w, 2, C.red); }
  return { x: ox, y: oy, w: w * B, h: h * B }; };

// ================= 道具：锁 / 钥匙 / 齿轮 / 内核 / 时钟 / 信号 =================
const LOCK = ['....KKKKKK....', '...KggggggK...', '..KggKKKKggK..', '..KgK....KgK..', '..KgK....KgK..', '..KgK....KgK..'], LBODY = ['KKKKKKKKKKKKKK', 'KyyyyyyyyyyyyK', 'KyyyyyyyyyyyyK', 'KyyyyyKKyyyyyK', 'KyyyyKKKKyyyyK', 'KyyyyyKKyyyyyK', 'KyyyyyKKyyyyyK', 'KyyyyyyyyyyyyK', 'KYYYYYYYYYYYYK', 'KKKKKKKKKKKKKK'];
// 锁：open 0/1（锁梁抬起）；s 放大倍数；col 'yel'|'red'|'green'；(x,y) 中心
K.lock = (c, x, y, o = {}) => { const { open = 0, s = 1, col = 'yel', alpha = 1 } = o, cc = { yel: [C.yel, C.yDk], red: [C.red, C.rDk], green: [C.green, C.gDk] }[col] || [C.yel, C.yDk], pal = { K: C.black, g: C.gray, y: cc[0], Y: cc[1] }, w = 14 * B * s, h = 16 * B * s, ox = snap(x - w / 2), oy = snap(y - h / 2);
  c.save(); c.globalAlpha *= alpha; const lk = open ? ['....KKKKKK....', '...KggggggK...', '..KggKKKKggK..', '..KgK....KgK..', '..KgK....KgK..', '..KgK.....KK..'] : LOCK;
  sprite(c, ox, oy - (open ? 2 : 0) * B * s, lk, pal, s); sprite(c, ox, oy + 6 * B * s, LBODY, pal, s); c.restore(); return { x: ox, y: oy, w, h }; };
const KEYS = ['.KKKK.................', 'KyyyyK................', 'KyKKyKKKKKKKKKKKKKKK..', 'KyKKyyyyyyyyyyyyyyyyK.', 'KyyyyKKKKKKKKKKKKyKKK.', '.KKKK.....KyyK.KyyK...', '..........KKKK.KKKK...'];
// 钥匙：dir 1 朝右 / -1 朝左；s 放大倍数；(x,y) 中心
K.key = (c, x, y, o = {}) => { const { dir = 1, s = 1, alpha = 1, col = C.yel } = o, w = 22 * B * s, h = 7 * B * s; c.save(); c.globalAlpha *= alpha; sprite(c, snap(x - w / 2), snap(y - h / 2), KEYS, { K: C.black, y: col }, s, dir < 0); c.restore(); return { x: snap(x - w / 2), y: snap(y - h / 2), w, h }; };
// 齿轮：r 外半径（格，默认 9）；teeth 齿数；rot 转角（弧度，自动量化到 1/4 齿）；col
K.gear = (c, x, y, o = {}) => { const { r = 9, teeth = 8, rot = 0, col = C.gray, hole = true, alpha = 1 } = o, d = 2 * r + 3, [ox, oy] = org(x, y, d, d), q = TAU / teeth / 4, rr = Math.round(rot / q) * q, cx = r + 1;
  const f = (gx, gy) => { const dx = gx + 0.5 - cx - 0.5, dy = gy + 0.5 - cx - 0.5, rd = Math.hypot(dx, dy); if (rd > r + 0.7) return false; if (hole && rd < r * 0.34) return false; if (rd <= r - 2.2) return true; const a = Math.atan2(dy, dx) - rr; return (((a / (TAU / teeth / 2)) % 2) + 2) % 2 < 1; };
  c.save(); c.globalAlpha *= alpha; const dk = { [C.gray]: C.dgray, [C.yel]: C.yDk, [C.green]: C.gDk, [C.blue]: C.bDk, [C.red]: C.rDk, [C.white]: C.gray }[col] || C.ddgray; maskDraw(c, ox, oy, d, d, f, (gx, gy) => (gx + gy) < d * 0.85 ? col : dk); c.restore(); return { x: ox, y: oy, w: d * B, h: d * B }; };
// 内核方块：蓝色芯片＋四周引脚＋中央转动的齿轮（gear:false 则是闪烁的格子）；w 宽（格，默认 28）；label ASCII 字写在上沿
K.core = (c, x, y, o = {}) => { const { w = 28, label = '', t = 0, gear = true, col = 'blue', lit = true } = o, pw = w + 8, [ox, oy] = org(x, y, pw, pw), q = ox + 4 * B, qy = oy + 4 * B, [dk, md, lt, nv] = PIPE[col] || PIPE.blue;
  for (let i = 3; i < w - 2; i += 4) { [[ox, qy + i * B], [ox + (pw - 4) * B, qy + i * B]].forEach(([px, py]) => { fr(c, px, py, 32, 16, C.black); fr(c, px + 8, py + 4 - 0, 16, 8, C.yel); }); [[q + i * B, oy], [q + i * B, oy + (pw - 4) * B]].forEach(([px, py]) => { fr(c, px, py, 16, 32, C.black); fr(c, px + 4, py + 8, 8, 16, C.yel); }); }
  box(c, q, qy, 0, 0, w, w, dk, lt, nv); cl(c, q, qy, 3, 3, w - 6, w - 6, nv);
  if (gear) K.gear(c, q + w * B / 2, qy + w * B / 2, { r: Math.floor(w / 2) - 5, rot: t * 1.2, col: C.gray }); else for (let j = 0; j < w - 8; j += 2) for (let i = 0; i < w - 8; i += 2) { const on = lit && hsh(i + j * 33, Math.floor(t * 4)) > 0.5; cl(c, q, qy, 4 + i, 4 + j, 1, 1, on ? C.green : md); }
  if (label) K.ptext(c, label, ox + pw * B / 2, oy - 32, { sc: 1, col: C.white, shadow: true }); return { x: ox, y: oy, w: pw * B, h: pw * B }; };
// 时钟：r 半径（格，默认 8）；time {h,m} 固定时间，否则指针随 t 转（speed 每秒分钟数，默认 30）
K.clock = (c, x, y, o = {}) => { const { r = 8, t = 0, time = null, speed = 30, alert = false } = o, d = 2 * r + 1, [ox, oy] = org(x, y, d, d), cx = r, mins = time ? time.h * 60 + time.m : Math.floor(t * 8) / 8 * speed;
  maskDraw(c, ox, oy, d, d, (gx, gy) => Math.hypot(gx - cx, gy - cx) <= r + 0.35, () => alert ? '#fcd0c8' : C.white);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, rx = Math.round(cx + Math.sin(a) * (r - 1.5)), ry = Math.round(cx - Math.cos(a) * (r - 1.5)); cl(c, ox, oy, rx, ry, 1, 1, k % 3 ? C.dgray : C.black); }
  const hand = (ang, len, cc) => cellLine(cx, cx, Math.round(cx + Math.sin(ang) * len), Math.round(cx - Math.cos(ang) * len)).forEach(([gx, gy]) => cl(c, ox, oy, gx, gy, 1, 1, cc));
  hand(mins / 60 / 12 * TAU, r * 0.5, C.black); hand(mins / 60 * TAU, r - 2.5, alert ? C.red : C.bDk); cl(c, ox, oy, cx, cx, 1, 1, C.red); return { x: ox, y: oy, w: d * B, h: d * B }; };
// 信号图标：kind 'bolt' 闪电｜'excl' 红色感叹号块｜'warn' 黄色警告三角｜'check' 绿勾｜'cross' 红叉｜'q' 问号｜'wifi' 信号弧；s 放大倍数（整数）；blink 步进闪烁；(x,y) 中心
const SIG = {
  bolt: ['...KKKKK.', '..KyyyyK.', '.KyyyyK..', 'KyyyyK...', 'KyyyyyyyK', 'KKKKyyyK.', '...KyyK..', '..KyyK...', '..KyK....', '.KyK.....', '.KK......'],
  check: ['KKKKKKKKKK', 'KggggggggK', 'KgggggggwK', 'KggggggwwK', 'KwgggwwwgK', 'KwwgwwwggK', 'KgwwwwgggK', 'KgggwggggK', 'KggggggggK', 'KKKKKKKKKK'],
  cross: ['KKKKKKKKKK', 'KrrrrrrrrK', 'KrwrrrrwrK', 'KrrwrrwrrK', 'KrrrwwrrrK', 'KrrrwwrrrK', 'KrrwrrwrrK', 'KrwrrrrwrK', 'KrrrrrrrrK', 'KKKKKKKKKK'] };
K.signal = (c, x, y, o = {}) => { const { kind = 'bolt', s = 1, blink = false, t = 0, alpha = 1 } = o; if (blink && Math.floor(t * 3) % 2) return;
  c.save(); c.globalAlpha *= alpha; const draw = (rows, pal) => { const w = rows[0].length * B * s, h = rows.length * B * s; sprite(c, snap(x - w / 2), snap(y - h / 2), rows, pal, s); };
  if (SIG[kind]) draw(SIG[kind], { K: C.black, y: C.yel, g: C.gDk, r: C.red, w: C.white });
  else if (kind === 'excl') { const n = 9 * s, [ox, oy] = org(x, y, n + 2 * s, n + 2 * s); cl(c, ox, oy, 0, 0, n + 2 * s, n + 2 * s, C.black); cl(c, ox, oy, s, s, n, n, C.red); cl(c, ox, oy, s, s, n, s, '#f86848'); K.glyph(c, '!', ox + (s + (n - 5 * s) / 2 | 0) * B, oy + (s + (n - 7 * s) / 2 | 0) * B, { sc: s, col: C.white }); }
  else if (kind === 'q') { const n = 9 * s, [ox, oy] = org(x, y, n + 2 * s, n + 2 * s); cl(c, ox, oy, 0, 0, n + 2 * s, n + 2 * s, C.black); cl(c, ox, oy, s, s, n, n, C.yel); cl(c, ox, oy, s, s, n, s, '#fce890'); K.glyph(c, '?', ox + (s + (n - 5 * s) / 2 | 0) * B, oy + (s + (n - 7 * s) / 2 | 0) * B, { sc: s, col: C.black }); }
  else if (kind === 'warn') { const hh = 13 * s, hw = Math.ceil(hh * 0.62), [ox, oy] = org(x, y, 2 * hw + 1, hh); maskDraw(c, ox, oy, 2 * hw + 1, hh, (gx, gy) => Math.abs(gx - hw) <= gy * 0.62 + 0.4, () => C.yel); K.glyph(c, '!', ox + (hw - 2 * s) * B, oy + Math.floor(hh * 0.4) * B, { sc: Math.max(1, s - 0), col: C.black }); }
  else if (kind === 'wifi') { const r0 = 3 * s, n = 2 * r0 * 3 + 1, [ox, oy] = org(x, y, n, 3 * r0 + 2 * s); for (let k = 1; k <= 3; k++) { const rr = k * 2 * s + s; for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) { const dx = gx - n / 2 + 0.5, dy = gy - (3 * r0 + 1 * s) + 0.5, d = Math.hypot(dx, dy); if (Math.abs(d - rr * 1.4) < 0.9 * s && dy < -Math.abs(dx) * 0.6) cl(c, ox, oy, gx, gy, 1, 1, C.green); } } cl(c, ox, oy, n / 2 - s | 0, 3 * r0 - s, 2 * s, 2 * s, C.green); }
  c.restore(); };
K.bolt = (c, x, y, o = {}) => K.signal(c, x, y, { ...o, kind: 'bolt' });
K.excl = (c, x, y, o = {}) => K.signal(c, x, y, { ...o, kind: 'excl' });
// 星芒闪烁（强调）与冲击线
K.sparkle = (c, x, y, o = {}) => { const { t = 0, col = C.yel, s = 1 } = o, ph = Math.floor(t * 4 + hsh(Math.floor(x), Math.floor(y)) * 4) % 4, X = snap(x), Y = snap(y), a = [0, 1, 2, 1][ph] * s; fr(c, X, Y, 8, 8, col); if (a) { fr(c, X - a * 8, Y, a * 8, 8, col); fr(c, X + 8, Y, a * 8, 8, col); fr(c, X, Y - a * 8, 8, a * 8, col); fr(c, X, Y + 8, 8, a * 8, col); } };
K.burst = (c, x, y, o = {}) => { const { r = 8, t = 0, col = C.yel } = o, ph = Math.floor(t * 6) % 2, X = snap(x), Y = snap(y);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, d = (r + ph) * B, dx = snap(Math.cos(a) * d), dy = snap(Math.sin(a) * d); fr(c, X + dx, Y + dy, 8, 8, col); fr(c, X + dx + snap(Math.cos(a) * 16), Y + dy + snap(Math.sin(a) * 16), 8, 8, col); } };
// 血条/进度条（HUD）：w 格宽；v 0..1；col；label ASCII
K.hpbar = (c, x, y, o = {}) => { const { w = 40, v = 1, col = C.green, label = '', h = 4 } = o, [ox, oy] = org(x, y, w, h + 2), n = Math.round((w - 2) * clamp(v));
  cl(c, ox, oy, 0, 0, w, h + 2, C.white); cl(c, ox, oy, 1, 1, w - 2, h, C.black); cl(c, ox, oy, 1, 1, n, h, col); cl(c, ox, oy, 1, 1, n, 1, C.white);
  if (label) K.ptext(c, label, ox, oy - 40, { align: 'left', col: C.white, shadow: true }); return { x: ox, y: oy, w: w * B, h: (h + 2) * B }; };

// ================= 章节卡 =================
// 关卡选择画面：STAGE 编号＋大号像素数字＋章名（打字机）＋N 站进度条，小人走到第 n 站。底 kind 按章号轮换
K.chapterCard = (c, lt, t, n, title) => { const N = K.CHAPTER_NAMES.length || 12, kinds = ['stars', 'grid', 'crt', 'rain'];
  K.bg(c, t, { kind: kinds[(n - 1) % 4], seed: n, tone: n % 2 ? 'blue' : 'blue' });
  const pad2 = String(n).padStart(2, '0'), s1 = lt > 0.1 ? 1 : 0;
  if (s1) { fr(c, 296, 200, 488, 8, C.yel); fr(c, 296, 312, 488, 8, C.yel); c.save(); c.font = '56px "PressStart2P-400"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.black; c.fillText('STAGE ' + pad2, 544, 260 + 4); c.fillStyle = C.yel; c.fillText('STAGE ' + pad2, 540, 260); c.restore(); }
  const dp = K.at(lt, 0.2, 0.3), sh = Math.floor(dp * 4) / 4; if (sh > 0) { const sc = 5, adv = 6 * sc * B, tx = 540 - (2 * adv - sc * B) / 2; for (let i = 0; i < 2; i++) { K.glyph(c, pad2[i], tx + i * adv + 16, 400 + 16, { sc, col: C.black }); K.glyph(c, pad2[i], tx + i * adv, 400, { sc, col: sh >= 1 ? C.green : C.gDk }); }
    if (sh >= 1) { fr(c, tx - 8, 400 - 8, 8, 8, C.white); } }
  const s = String(title || ''), L = [...s], two = L.length > 8, mid = Math.ceil(L.length / 2), lines = two ? [L.slice(0, mid).join(''), L.slice(mid).join('')] : [s], mx = Math.max(...lines.map(l => [...l].length)), size = clamp(Math.floor(960 / mx), 76, two ? 120 : 150), p = K.at(lt, 0.5, Math.max(0.5, L.length / 14));
  const shown = TY.typed(s, Math.floor(p * L.length) / L.length); let cnt = [...shown].length;
  lines.forEach((l, i) => { const part = [...l].slice(0, Math.max(0, cnt)).join(''); cnt -= [...l].length; K.text(c, part, 540, (two ? 880 : 830) + i * (size + 16) - (two ? (size + 16) / 2 : 0), { size, col: C.white }); });
  const bx = 112, bw = 856, by = 1250, seg = Math.floor(bw / N / 8) * 8, tw = seg * N, x0 = 540 - tw / 2, pp = K.at(lt, 0.9, 0.5);
  fr(c, x0 - 8, by - 8, tw + 16, 40, C.black); for (let i = 0; i < N; i++) { const done = i < n, cur = i === n - 1; fr(c, x0 + i * seg + 4, by, seg - 8, 24, done ? (cur ? C.yel : C.gDk) : C.dot); }
  c.save(); c.globalAlpha = pp; K.pixelPerson(c, x0 + (n - 1) * seg + seg / 2, by - 8, { pose: lt > 1.4 ? 'wave' : 'walk', s: 1, t, shirt: C.red }); c.restore();
  if (pp > 0) { c.save(); c.font = '40px "PressStart2P-400"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.gray; c.fillText(`${n}/${N}`, 540, by + 80); c.restore(); }
  K.finish(c); };
})();
