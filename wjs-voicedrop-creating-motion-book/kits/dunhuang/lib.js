// 画风套件 dunhuang（配方 huashu-art-motion 20_dunhuang「敦煌壁画·盛唐」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// ================================ 规矩（章节 agent 必读） ================================
// 1. 色板：土朱红地仗 K.C.red｜石青 K.C.up（涨/多头）｜赭红 K.C.down（跌/空头）｜石绿 K.C.green（中性）｜米白纸 K.C.paper（牌面）｜墨 K.C.ink（数字）｜赭金 K.C.gold（点缀）。
//    红底只当底色，不表示涨跌（避免和 A 股涨红混淆）。涨跌全片固定：石青=涨，赭红=跌，石绿=中性（用 K.dirCol('up'|'down'|'flat') 取色）。
// 2. 数字一律放进「幡牌」K.banner（或裂纹牌 K.crack）：牌头写类别，牌面写大数字（≥100px，K.banner 自动保证），单位/日期 ≥44px。每屏最多 3 块数字牌。
// 3. 股价曲线=山：K.mountain 把曲线画成层叠青绿山形（轮廓线就是价格线），数据点挂莲台，描绘进度 prog 从左往右。每章可换一座山，但都是一条价格线。
// 4. 动静：纸面龟裂、剥落、做旧全部静态（缓存在 K.bg）。动的只有「入场」（幡牌垂落、莲台绽开、卷轴展开、飘带描出）和「描绘」（山形/飘带的 prog）。
//    不要给云、莲、幡加循环飘动（K.banner 的 sway 默认 0，别开）。
// 5. 人不画脸：K.silhouette（供养人/乐伎/商旅剪影）、K.hand（壁画手）。
// 6. 字：全部引擎自带 PuHui-*（思源黑体 GB2312 子集）。K.text 自动给浅色字描一圈铁线描（等宽暗褐线）。屏上字别超 GB2312。
// 7. 收尾：每镜最后调 K.finish（纸面颗粒＋字幕带 y1380–1560 压暗，字幕带里别放关键物）；字幕走 K.subtitle（y≈1480）。
// 8. 确定性：所有随机走 U.rng/U.hash，种子固定，不用 Math.random。
// 约定：K.banner / K.crack / K.plaque / K.scroll 的 (x,y) 是左上角；K.lotus / K.cloud / K.silhouette / K.hand / K.marker 的 (x,y) 是中心或脚底（见各函数注释）。
// ======================================================================================
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
const warns = {}; const warnOnce = (k, m) => { if (!warns[k]) { warns[k] = 1; console.warn('[dunhuang] ' + m); } };

// ---------- 色板 ----------
const C = K.C = {
  red: '#8A3F35', redDk: '#6a2c24', redLt: '#a5523f',        // 土朱红地仗（底，不表示涨跌）
  up: '#3E6A9A', up2: '#6f98c0',                              // 石青：涨 / 多头
  down: '#C4623A', down2: '#E0925E',                          // 赭红：跌 / 空头（比地仗亮，红底上仍分得开）
  green: '#5FA183', green2: '#8fc0a4',                        // 石绿：中性
  paper: '#E8DDBB', paper2: '#d8c9a0', white: '#EFE6CC',     // 米白牌面
  ink: '#1E1A18', line: '#4a2016', gold: '#C9A35B', plaster: '#d8c6a2', dark: '#2a1812',
};
C.blue = C.up; C.ochre = C.down;
K.dirCol = d => d === 'up' ? C.up : d === 'down' ? C.down : C.green;
K.dirCol2 = d => d === 'up' ? C.up2 : d === 'down' ? C.down2 : C.green2;

// ---------- 进度 / 缓存 / 相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const prog = (o, d = 0.5) => o.p != null ? clamp(o.p) : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || d)) : 1);

// ---------- 路径 ----------
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, Math.max(0, r), 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); };
const lum = h => { const [r, g, b] = P.hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// 铁线描：等宽暗褐线。F(c, path, fill, lw, line)
const F = (c, p, fill, lw = 2.6, line = C.line) => { if (fill) { c.fillStyle = fill; c.fill(p); } if (lw) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); } };
K.F = F;

// ---------- 数据小工具 ----------
K.series = (n, seed = 1, o = {}) => { const { trend = 0.5, vol = 0.12 } = o, r = U.rng(seed * 977 + 13); let v = 0.5 - trend / 2; const a = []; for (let i = 0; i < n; i++) { a.push(v); v += trend / (n - 1) + (r() - 0.5) * vol; } const mn = Math.min(...a), mx = Math.max(...a); return a.map(x => (x - mn) / (mx - mn || 1)); };
// 数值 → 屏幕点。vals 为原始值；min/max 缺省取数据范围；点 x 等距铺在 [x, x+w]，y 上大下小。
K.mapPts = (vals, x, y, w, h, o = {}) => { const mn = o.min != null ? o.min : Math.min(...vals), mx = o.max != null ? o.max : Math.max(...vals);
  return vals.map((v, i) => [x + w * i / Math.max(1, vals.length - 1), y + h * (1 - (v - mn) / ((mx - mn) || 1))]); };
// 保形三次插值（单调、不过冲、x 严格单调）：pts [[x,y]…]（x 递增）→ 稠密折线。山形/堆叠带都靠它。
K.smooth = (pts, sub = 10) => {
  const n = pts.length; if (n < 3) return pts.slice();
  const dx = [], m = []; for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0] || 1e-6); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
  const tg = [m[0]]; for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : 2 / (1 / m[i - 1] + 1 / m[i])); tg.push(m[n - 2]);
  const out = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sub; k++) { const s = k / sub, h = dx[i], s2 = s * s, s3 = s2 * s;
    const y = (2 * s3 - 3 * s2 + 1) * pts[i][1] + (s3 - 2 * s2 + s) * h * tg[i] + (-2 * s3 + 3 * s2) * pts[i + 1][1] + (s3 - s2) * h * tg[i + 1];
    out.push([pts[i][0] + s * h, y]); }
  out.push(pts[n - 1].slice()); return out;
};
// 折线按 x 截断到 xe（线性插出末点）
const truncX = (pts, xe) => { const o = []; for (let i = 0; i < pts.length; i++) { if (pts[i][0] <= xe) o.push(pts[i]); else { if (i > 0) { const a = pts[i - 1], b = pts[i], f = (xe - a[0]) / (b[0] - a[0] || 1); o.push([xe, lerp(a[1], b[1], f)]); } break; } } return o; };
// 折线按弧长比例截断
const truncLen = (pts, f) => { if (f >= 1) return pts; const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const want = L[L.length - 1] * clamp(f), o = [pts[0]];
  for (let i = 1; i < pts.length; i++) { if (L[i] <= want) o.push(pts[i]); else { const g = (want - L[i - 1]) / (L[i] - L[i - 1] || 1); o.push([lerp(pts[i - 1][0], pts[i][0], g), lerp(pts[i - 1][1], pts[i][1], g)]); break; } } return o; };
// Catmull-Rom 平滑（x 不必单调，飘带/云尾用）
const cr = (pts, sub = 10) => { const d = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[Math.max(0, i - 1)], b = pts[i], e = pts[i + 1], f = pts[Math.min(pts.length - 1, i + 2)];
  for (let k = 0; k < sub; k++) { const t = k / sub, t2 = t * t, t3 = t2 * t, g = j => 0.5 * ((2 * b[j]) + (-a[j] + e[j]) * t + (2 * a[j] - 5 * b[j] + 4 * e[j] - f[j]) * t2 + (-a[j] + 3 * b[j] - 3 * e[j] + f[j]) * t3); d.push([g(0), g(1)]); } } d.push(pts[pts.length - 1].slice()); return d; };
const yAt = (pts, x) => { for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i], f = (x - a[0]) / (b[0] - a[0] || 1); return lerp(a[1], b[1], f); } return pts[pts.length - 1][1]; };
// 渐细的带（飘带/云尾共用）：pts 中线，wf(u)→宽度
const taper = (c, pts, wf, fill, lw = 2.4, segFill) => { const n = pts.length; if (n < 2) return; const L = [], R = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), w = wf(i / (n - 1)) / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]); }
  const outline = K.poly(L.concat(R.slice().reverse()));
  if (!segFill) { F(c, outline, fill, lw); return; }
  c.save(); c.lineJoin = 'round'; for (let i = 0; i < n - 1; i++) { const q = K.poly([L[i], L[i + 1], R[i + 1], R[i]]); c.fillStyle = segFill(i / (n - 1)) || fill; c.fill(q); c.strokeStyle = c.fillStyle; c.lineWidth = 1; c.stroke(q); } c.restore();
  c.strokeStyle = C.line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(outline); };

// ---------- 底：土红地仗＋剥落＋龟裂（缓存，低对比，静态） ----------
const TONES = { red: ['#8A3F35', '#6c2d27'], dark: ['#5f2c27', '#431c19'], ochre: ['#a5683f', '#85502f'], blue: ['#34506b', '#26394f'] };
const ground = name => K.once('dh_ground_' + name, () => {
  const [bs, ds] = TONES[name] || TONES.red, cv = P.canvas(), g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data, base = P.hex(bs), dk = P.hex(ds), pl = P.mix(base, P.hex(C.plaster), 0.45), r = U.rng(31);
  const S = 6, fw = Math.ceil(W / S) + 2, fh = Math.ceil(H / S) + 2, mott = new Float32Array(fw * fh), peel = new Float32Array(fw * fh);
  for (let fy = 0; fy < fh; fy++) for (let fx = 0; fx < fw; fx++) { const x = fx * S, y = fy * S;
    mott[fy * fw + fx] = P.fbm(x * 0.0028 + 3, y * 0.0028, 4); peel[fy * fw + fx] = P.fbm(x * 0.0032 + 11, y * 0.0032 + 4, 4) + 0.12 * P.noise(x * 0.03, y * 0.03); }
  const samp = (A, x, y) => { const u = x / S, v = y / S, i = u | 0, j = v | 0, a = u - i, b = v - j, q = j * fw + i; return (A[q] * (1 - a) + A[q + 1] * a) * (1 - b) + (A[q + fw] * (1 - a) + A[q + fw + 1] * a) * b; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4, m = samp(mott, x, y), n = samp(peel, x, y), gr = (r() - 0.5) * 9;
    const cw = Math.exp(-Math.pow((x - 540) / 380, 2)) * 0.9, thr = 0.3 + 0.1 * cw;
    if (n > thr) { const v = (n - thr) * 50 + gr * 1.2; d[k] = pl[0] + v; d[k + 1] = pl[1] + v; d[k + 2] = pl[2] + v * 0.8; }
    else { const a = clamp(m * 1.1 + 0.3) * 0.55, e = n > thr - 0.02 ? 0.45 : 0; d[k] = lerp(lerp(base[0], dk[0], a), 45, e) + m * 8 + gr; d[k + 1] = lerp(lerp(base[1], dk[1], a), 25, e) + m * 8 + gr; d[k + 2] = lerp(lerp(base[2], dk[2], a), 18, e) + m * 6 + gr; }
    d[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 22; i++) { const x = 60 + r() * 960, y = 60 + r() * 1800;                               // 褪色团花
    g.save(); g.translate(x, y); g.globalAlpha = 0.13; for (let q = 0; q < 8; q++) { g.rotate(Math.PI / 4); g.fillStyle = q % 2 ? C.green2 : C.white; g.beginPath(); g.ellipse(0, -18, 8, 16, 0, 0, TAU); g.fill(); } g.fillStyle = C.up2; dot(g, 0, 0, 9); g.fill(); g.restore(); }
  g.strokeStyle = 'rgba(40,16,10,.22)'; g.lineWidth = 1;                                                       // 龟裂
  for (let k = 0; k < 320; k++) { let x = r() * W, y = r() * H, a = r() * TAU; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 5 + r() * 8; s++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * (5 + r() * 12); y += Math.sin(a) * (5 + r() * 12); g.lineTo(x, y); } g.stroke(); }
  return cv;
});
// 底：o {tone 'red'(默认)|'dark'(熏黑，看空章)|'ochre'|'blue', footer true 在字幕带下方 y1660 画一条莲花砖带压脚（画面下方太空时用）}。整面静态缓存，t 不参与。
K.bg = (c, t, o = {}) => { c.drawImage(ground(o.tone || 'red'), 0, 0); if (o.footer) K.lotusBand(c, 1660, 120); };
// 顶部垂幔（青绿白红三角＋金珠），y 为上沿；p 入场 0..1（自上垂下）
K.valance = (c, y = 90, o = {}) => { const p = prog(o, 0.7); if (p <= 0) return; c.save(); c.translate(0, (p - 1) * 140); c.globalAlpha *= clamp(p * 2);
  c.fillStyle = C.redDk; c.fillRect(0, y, W, 34); c.strokeStyle = C.green2; c.lineWidth = 4; c.beginPath(); for (let x = 0; x <= W; x += 4) { const yy = y + 17 + Math.sin(x * 0.05) * 9; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke();
  const cols = [C.up, C.green, C.white, C.red];
  for (let x = 0, k = 0; x < W; x += 60, k++) { c.fillStyle = cols[k % 4]; c.beginPath(); c.moveTo(x, y + 34); c.lineTo(x + 60, y + 34); c.lineTo(x + 30, y + 80); c.closePath(); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke(); c.fillStyle = C.gold; dot(c, x + 30, y + 86, 5); c.fill(); }
  c.fillStyle = C.redDk; c.fillRect(0, y + 34, W, 5); c.restore(); };
// 莲花砖带（山形的地面），y 为上沿，h 高
K.lotusBand = (c, y, h = 140) => { c.fillStyle = '#a95a42'; c.fillRect(0, y, W, h); c.fillStyle = C.redDk; c.fillRect(0, y - 4, W, 10);
  for (let x = 0; x < W + 100; x += 100) { c.save(); c.translate(x + 50, y + h / 2 + 2); const s = Math.min(1, (h - 20) / 120); c.scale(s, s);
    for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.fillStyle = k % 2 ? C.green2 : C.white; c.beginPath(); c.ellipse(0, -22, 8, 18, 0, 0, TAU); c.fill(); c.strokeStyle = C.line; c.lineWidth = 1.6; c.stroke(); }
    c.fillStyle = C.gold; dot(c, 0, 0, 7); c.fill(); c.restore(); } };

// ---------- 收尾 / 字幕 ----------
// 每镜收尾：颗粒＋字幕带 y1380–1560 压暗（暗褐渐变，两端羽化）。o.band=false 不压（封面）。
K.finish = (c, o = {}) => {
  c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(P.grain('dunhuang', 0.05, [110, 80, 50], 0.2), 0, 0); c.restore();
  if (o.band === false) return;
  const g = c.createLinearGradient(0, 1340, 0, 1600); g.addColorStop(0, 'rgba(28,10,8,0)'); g.addColorStop(0.16, 'rgba(28,10,8,.5)'); g.addColorStop(0.84, 'rgba(28,10,8,.5)'); g.addColorStop(1, 'rgba(28,10,8,0)');
  c.fillStyle = g; c.fillRect(0, 1340, W, 260);
};
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"';
  const w = Math.min(1040, c.measureText(text).width + 80), h = 92, x = 540, y = 1480, q = K.poly([[x - w / 2 + 12, y - h / 2], [x + w / 2 - 12, y - h / 2], [x + w / 2, y - h / 2 + 12], [x + w / 2, y + h / 2 - 12], [x + w / 2 - 12, y + h / 2], [x - w / 2 + 12, y + h / 2], [x - w / 2, y + h / 2 - 12], [x - w / 2, y - h / 2 + 12]]);
  c.fillStyle = 'rgba(34,14,10,.86)'; c.fill(q); c.strokeStyle = C.gold; c.lineWidth = 2.4; c.stroke(q);
  c.fillStyle = C.paper; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 2, 1000); c.restore();
};

// ---------- 文字 ----------
const FAM = { Medium: 'PuHui-Medium', Bold: 'PuHui-Bold', Heavy: 'PuHui-Heavy', Black: 'PuHui-Black' };
// 铁线描字：浅色字自动描一圈等宽暗褐线（o.line 传 null 关闭、传色覆盖）；含 \n 多行居中。
// o {size 64, col 米白, weight 'Heavy'|'Black'|'Bold'|'Medium', align, alpha, scale, track, maxW（超宽整体缩小）, rot, lh 行距 1.25, line}
K.text = (c, s, x, y, o = {}) => { const { size = 64, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, weight = 'Heavy' } = o, col = o.col || C.paper, fam = o.fam || FAM[weight] || weight;
  const line = o.line !== undefined ? o.line : (lum(col) > 0.55 ? C.line : null), lines = String(s).split('\n'), lh = size * (o.lh || 1.25);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = Math.max(...lines.map(l => c.measureText(l).width)); if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  lines.forEach((l, i) => { const yy = (i - (lines.length - 1) / 2) * lh; if (line) { c.strokeStyle = line; c.lineWidth = Math.max(2.5, size * 0.09); c.strokeText(l, 0, yy); } c.fillStyle = col; c.fillText(l, 0, yy); });
  c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 弹出文字（backOut 过冲）。参数同 K.text，另 o.dur。
K.popText = (c, s, x, y, lt, at, o = {}) => { const k = K.pop(lt, at, o.dur || 0.5); if (k <= 0) return; K.text(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: clamp(k * 2) * (o.alpha != null ? o.alpha : 1) }); };
// 米白题记牌（小标签底）：(x,y) 左上。o {fill, p 入场}
const crackLines = (c, x, y, w, h, seed, n = 9) => { const r = U.rng(seed * 53 + 7); c.save(); c.strokeStyle = 'rgba(70,32,20,.28)'; c.lineWidth = 1;
  for (let k = 0; k < n; k++) { let px = x + r() * w, py = y + r() * h, a = r() * TAU; c.beginPath(); c.moveTo(px, py); for (let s = 0; s < 4 + r() * 6; s++) { a += (r() - 0.5) * 1.4; px += Math.cos(a) * (5 + r() * 10); py += Math.sin(a) * (5 + r() * 10); c.lineTo(px, py); } c.stroke(); } c.restore(); };
K.plaque = (c, x, y, w, h, o = {}) => { const p = prog(o, 0.4); if (p <= 0) return; c.save(); c.globalAlpha *= p; c.translate(x + w / 2, y + h / 2 + (1 - p) * 24); c.translate(-w / 2, -h / 2);
  const q = K.round(0, 0, w, h, 5); c.save(); c.translate(6, 8); c.fillStyle = 'rgba(40,14,10,.28)'; c.fill(q); c.restore();
  F(c, q, o.fill || C.paper, 3.2); c.strokeStyle = C.line; c.lineWidth = 1.8; c.strokeRect(7, 7, w - 14, h - 14);
  c.save(); c.clip(q); crackLines(c, 0, 0, w, h, Math.round(x + y), 5); c.restore(); c.restore(); };
// 引线标注：悬珠线先画出，末端题记牌逐字打出。o {size 46, col 字色, fill 牌色}
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const size = o.size || 46, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.line; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.gold; dot(c, ax, ay, 9 * Math.min(1, p1 * 3)); c.fill(); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.3, h = size * 1.7; c.restore();
  c.save(); c.translate(bx, by); c.scale(q, q); K.plaque(c, -w / 2, -h / 2, w, h, { fill: o.fill });
  c.font = `${size}px "PuHui-Heavy"`; c.fillStyle = o.col || C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.65, 3); c.restore(); };

// ---------- 幡牌（数字容器） ----------
// 悬珠线：从 (x,y1) 垂到 (x,y2)，金珠。p 为描绘进度
K.hang = (c, x, y1, y2, p = 1) => { if (p <= 0) return; const ye = lerp(y1, y2, clamp(p)); c.save(); c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y1); c.lineTo(x, ye); c.stroke();
  c.fillStyle = C.gold; for (let yy = y1 + 30; yy < ye - 8; yy += 46) { dot(c, x, yy, 5); c.fill(); c.lineWidth = 1.5; c.stroke(); } c.restore(); };
// 牌面内容（幡牌/裂纹牌共用）：牌头色带＋大数字＋单位＋日期/备注。
const face = (c, x, y, w, h, o, col, edge = true) => {
  const sub = o.date || o.note, hasH = !!o.head, hasU = !!o.unit, hasD = !!sub, headH = hasH ? 64 : 0, unitH = hasU ? 52 : 0, dateH = hasD ? 52 : 0, tail = o.tail != null ? o.tail : 26, numH = h - headH - unitH - dateH - tail, cx = x + w / 2;
  if (edge) { c.fillStyle = col; c.fillRect(x, y, 18, h); c.fillRect(x + w - 18, y, 18, h); c.fillStyle = C.white; for (let k = 0; k < Math.floor(h / 36); k++) { dot(c, x + 9, y + 18 + k * 36, 3.6); c.fill(); dot(c, x + w - 9, y + 18 + k * 36, 3.6); c.fill(); } }
  if (hasH) { c.fillStyle = col; c.fillRect(x + (edge ? 18 : 0), y, w - (edge ? 36 : 0), headH); c.strokeStyle = C.line; c.lineWidth = 2.4; c.strokeRect(x + (edge ? 18 : 0), y, w - (edge ? 36 : 0), headH);
    K.text(c, o.head, cx, y + headH / 2 + 2, { size: 46, weight: 'Bold', col: C.paper, line: null, maxW: w - 70 }); }
  if (o.num != null) { const size = o.numSize || clamp(numH * 0.9, 100, 190), s = String(o.num); c.save(); c.font = `${size}px "PuHui-Black"`; const m = c.measureText(s).width, k = Math.min(1, (w - 56) / m);
    if (k < 0.62) warnOnce('num', `幡牌数字 "${s}" 太宽（压缩到 ${k.toFixed(2)}），请加宽牌或缩短数字`);
    c.translate(cx, y + headH + numH / 2 + size * 0.03); c.scale(k, 1); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.numCol || C.ink; c.strokeStyle = o.numCol || C.ink; c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeText(s, 0, 0); c.fillText(s, 0, 0); c.restore(); }
  if (hasU) K.text(c, o.unit, cx, y + headH + numH + unitH / 2, { size: Math.max(44, o.unitSize || 44), weight: 'Bold', col: C.redDk, line: null, maxW: w - 50 });
  if (hasD) K.text(c, sub, cx, y + headH + numH + unitH + dateH / 2, { size: Math.max(44, o.dateSize || 44), weight: 'Medium', col: C.line, line: null, maxW: w - 40 });
};
// 幡牌：(x,y) 牌身左上，w×h（带燕尾；四行齐全建议 w≥300,h≥300）。
// o {head 牌头类别, num 大数字（自动≥100px）, unit 单位（≥44px）, date 日期（≥44px）, col 牌头/边色（缺省石绿）| dir 'up'|'down'|'flat' 取色, numSize, numCol,
//    p 入场 0..1 | lt+at(+dur) 入场（自上垂落）, sway 摆角度（默认不摆）+t}
// 返回锚点 {cx, top, bottom, tip:[cx,bottom], x,y,w,h}（用于 K.hang 垂线接曲线上的点）。
K.banner = (c, x, y, w, h, o = {}) => {
  const col = o.col || K.dirCol(o.dir), p = prog(o, 0.5), cx = x + w / 2, res = { cx, top: y, bottom: y + h, tip: [cx, y + h], x, y, w, h };
  if (p <= 0) return res;
  const sw = o.sway && o.t != null ? Math.sin(o.t * 1.8 + x * 0.01) * o.sway : 0;
  c.save(); c.globalAlpha *= p; c.translate(cx, y + (1 - p) * -110); if (sw) c.rotate(sw * Math.PI / 180); c.translate(-cx, -y);
  F(c, K.poly([[x - 12, y - 18], [x + w + 12, y - 18], [x + w + 12, y], [x - 12, y]]), C.redDk, 2.4); c.fillStyle = C.gold; [x - 14, x + w + 14].forEach(bx => { dot(c, bx, y - 9, 9); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke(); });
  const nt = 22, body = K.poly([[x, y], [x + w, y], [x + w, y + h], [x + w * 0.75, y + h - nt], [cx, y + h], [x + w * 0.25, y + h - nt], [x, y + h]]);
  c.save(); c.translate(7, 9); c.fillStyle = 'rgba(40,14,10,.3)'; c.fill(body); c.restore();
  c.fillStyle = C.paper; c.fill(body); c.save(); c.clip(body); face(c, x, y, w, h, o, col); crackLines(c, x, y, w, h, Math.round(x * 3 + y), 9); c.restore();
  c.strokeStyle = C.line; c.lineWidth = 3.4; c.lineJoin = 'round'; c.stroke(body); c.restore(); return res; };
// 裂纹牌（风险/坍塌）：方牌被一道锯齿裂纹劈开，两半错位，边缘掉渣。(x,y) 左上。
// o {head, num, unit, note（小字，≥44px）, col（缺省赭红）, p 入场, split 裂开程度 0..1（缺省 1；lt+at 也可驱动入场）, seed, cut 裂纹横向位置 0.3..0.7}
K.crack = (c, x, y, w, h, o = {}) => {
  const col = o.col || C.down, p = prog(o, 0.5), sp = o.split != null ? clamp(o.split) : K.ease(K.at(o.lt != null ? o.lt - (o.at || 0) : 9, 0.35, 0.5)), r = U.rng((o.seed || 1) * 91 + 5); if (p <= 0) return;
  const fx = (o.cut || 0.5) * w, cp = [[fx + (r() - 0.5) * 20, -6]]; const segs = 7; for (let i = 1; i < segs; i++) cp.push([fx + (r() - 0.5) * w * 0.14, h * i / segs]); cp.push([fx + (r() - 0.5) * 20, h + 6]);
  const g = sp * 5;
  c.save(); c.globalAlpha *= p; c.translate(x, y + (1 - p) * 40);
  [[-1, 0], [1, 0]].forEach(([sd]) => {
    const pts = sd < 0 ? [[0, 0], [cp[0][0], -0], ...cp.slice(1), [0, h]] : [[w, 0], [cp[0][0], 0], ...cp.slice(1), [w, h]], piece = K.poly(pts);
    c.save(); c.translate(sd * g, sd > 0 ? g * 1.2 : 0); c.rotate(sd * sp * 0.006);
    c.save(); c.translate(7, 9); c.fillStyle = 'rgba(40,14,10,.3)'; c.fill(piece); c.restore();
    c.fillStyle = C.paper; c.fill(piece); c.save(); c.clip(piece); face(c, 0, 0, w, h, { ...o, tail: o.tail != null ? o.tail : 14 }, col); crackLines(c, 0, 0, w, h, Math.round(x + y) + 3, 9);
    c.strokeStyle = 'rgba(30,12,8,.5)'; c.lineWidth = 4; c.beginPath(); cp.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();    // 裂口暗影
    c.restore(); c.strokeStyle = C.line; c.lineWidth = 3.4; c.lineJoin = 'round'; c.stroke(piece); c.restore(); });
  const r2 = U.rng((o.seed || 1) * 17 + 2); c.fillStyle = C.paper2; for (let i = 0; i < 3; i++) { const q = cp[1 + ((r2() * (cp.length - 2)) | 0)], fy = q[1] + (r2() - 0.2) * 20 + sp * 16; c.save(); c.translate(q[0] + (r2() - 0.5) * 16, fy); c.rotate(r2() * TAU);
    c.beginPath(); c.moveTo(-5, -3); c.lineTo(6, -2); c.lineTo(2, 6); c.closePath(); c.fill(); c.strokeStyle = C.line; c.lineWidth = 1.4; c.stroke(); c.restore(); }
  c.restore(); };

// ---------- 莲花 / 祥云 / 飘带 / 标记 ----------
// 莲台：(x,y) 莲座中心，s 缩放（1≈宽 80、含圆光 124）。o {col 莲心色（缺省朱红）| dir, halo true, alpha, p 入场（0→1 绽开）}
K.lotus = (c, x, y, s = 1, o = {}) => { const p = prog(o, 0.4); if (p <= 0) return; const core = o.col || (o.dir ? K.dirCol(o.dir) : C.red), k = s * (0.5 + 0.5 * MO.backOut(p, 1.6));
  c.save(); c.translate(x, y); c.scale(k, k); c.globalAlpha *= clamp(p * 2) * (o.alpha != null ? o.alpha : 1);
  if (o.halo !== false) { c.fillStyle = 'rgba(216,176,90,.32)'; dot(c, 0, -8, 62); c.fill(); c.strokeStyle = C.gold; c.lineWidth = 2; c.stroke(); }
  for (let row = 0; row < 2; row++) for (let q = -3; q <= 3; q++) { c.save(); c.rotate(q * 0.34 * (row ? 0.7 : 1)); c.fillStyle = row ? C.white : C.green2; c.beginPath(); c.ellipse(0, -(row ? 30 : 24), row ? 11 : 13, row ? 26 : 22, 0, 0, TAU); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke(); c.restore(); }
  F(c, new Path2D('M-40 6 Q0 26 40 6 L28 22 Q0 34 -28 22 Z'), C.up, 2.4);
  c.fillStyle = core; dot(c, 0, -4, 11); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke(); c.fillStyle = C.gold; dot(c, 0, -4, 4.5); c.fill(); c.restore(); };
// 祥云：(x,y) 云心，s 缩放（1≈宽 220）。o {col 云色（缺省米白）| 'green'|'blue', flip, alpha, p 入场}。静态，不飘。
K.cloud = (c, x, y, s = 1, o = {}) => { const p = prog(o, 0.6); if (p <= 0) return; const col = o.col === 'green' ? C.green2 : o.col === 'blue' ? C.up2 : (o.col || C.white);
  c.save(); c.translate(x + (1 - p) * -40 * (o.flip ? -1 : 1), y); c.scale(s * (o.flip ? -1 : 1), s); c.globalAlpha *= (o.alpha != null ? o.alpha : 1) * clamp(p * 1.5);
  const hs = [[0, -8, 42], [-52, 8, 30], [48, 6, 32], [-20, -28, 26]];
  c.lineJoin = 'round'; c.strokeStyle = C.line; c.lineWidth = 6; hs.forEach(([a, b, r]) => { dot(c, a, b, r); c.stroke(); });
  taper(c, cr([[50, 14], [100, 38], [146, 24], [180, 40], [196, 68], [180, 84]], 8), u => 24 * (1 - u * 0.92), col, 2.8);
  c.fillStyle = col; hs.forEach(([a, b, r]) => { dot(c, a, b, r); c.fill(); });
  c.strokeStyle = C.line; c.lineWidth = 1.8; c.globalAlpha *= 0.7; [[0, -8, 26], [48, 6, 18], [-52, 8, 16]].forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
  c.restore(); };
K.wave = (x0, y0, x1, y1, amp = 60, waves = 1.5, n = 20) => { const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), out = []; for (let i = 0; i <= n; i++) { const u = i / n, off = Math.sin(u * waves * TAU) * amp * Math.sin(Math.PI * u) ** 0.6;
  out.push([x0 + Math.cos(a) * L * u - Math.sin(a) * off, y0 + Math.sin(a) * L * u + Math.cos(a) * off]); } return out; };
// 飞天飘带：沿控制点 pts（≥3 个，x 不必单调，可用 K.wave 生成）飘出渐细的带，中线白虚线描花，带身有翻折。
// o {w 最大带宽 52, col 带色（缺省石青）, col2 描边内条色, twist 翻折次数（半周期数）3.5, prog 0..1 描绘进度 | lt+at(+dur 缺省 1.2)}
K.ribbon = (c, pts, o = {}) => { const pr = o.prog != null ? clamp(o.prog) : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || 1.2)) : 1); if (pr <= 0.01) return null;
  const ctr = cr(pts, 10);
  const q = truncLen(ctr, pr), w = o.w || 52, tw = o.twist != null ? o.twist : 3.5, col = o.col || C.up;
  c.save(); c.globalAlpha *= o.alpha != null ? o.alpha : 1;
  const wf = u => w * Math.pow(Math.sin(Math.PI * clamp(u * pr * 0.92 + 0.04)), 0.8) * (0.12 + 0.88 * Math.abs(Math.cos(u * pr * tw * Math.PI)));
  taper(c, q, wf, col, 2.6, u => Math.cos(u * pr * tw * Math.PI) >= 0 ? col : (o.col2b || K.dirCol2(col === C.up ? 'up' : col === C.down ? 'down' : 'flat')));
  c.strokeStyle = o.col2 || C.white; c.globalAlpha *= 0.7; c.lineWidth = 3; c.lineCap = 'round'; c.setLineDash([12, 14]); c.beginPath(); q.forEach((a, i) => i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1])); c.stroke(); c.restore();
  return q[q.length - 1]; };
// 飞天飘带结（当前时点指示）：(x,y) 结心，s 缩放。o {col, p 入场}。静态，位置由调用者随时间移动。
K.marker = (c, x, y, s = 1, o = {}) => { const p = prog(o, 0.4); if (p <= 0) return; const col = o.col || C.gold;
  c.save(); c.translate(x, y); c.scale(s * p, s * p); taper(c, cr([[0, 0], [14, 26], [8, 52], [22, 78]], 8), u => 22 * (1 - u * 0.75), C.green2, 2.2); taper(c, cr([[0, 0], [-16, 24], [-8, 50], [-26, 70]], 8), u => 20 * (1 - u * 0.75), C.up2, 2.2);
  c.save(); c.rotate(-0.55); F(c, K.ellipse(-24, 0, 28, 15), C.white, 2.4); c.restore(); c.save(); c.rotate(0.55); F(c, K.ellipse(24, 0, 28, 15), C.white, 2.4); c.restore();
  c.fillStyle = col; dot(c, 0, 0, 11); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2.4; c.stroke(); c.restore(); };

// ---------- 山形曲线（股价=层叠青绿山） ----------
// pts：价格点 [[x,y]…]（x 递增，用 K.mapPts 生成）。轮廓线就是价格线；山体层叠石青/石绿色带沿山形平行下移；数据点挂莲台。
// o {base 地平线 y（缺省 1330，山体到此截断）, dir 'up'|'down'|'flat' 决定主色（山脊带色）, prog 0..1 从左往右描绘 | lt+at(+dur 缺省 1.2),
//    bands 7, step（色带间距，缺省按山高自适应 28..70）, ridge 'slope'（山脊按涨跌分段上色：升石青/降赭红）, floor true 画莲花砖带, floorH 140,
//    nodes [{i 点下标 | f 0..1, dir, lot 莲台缩放 0.8}], marker true 在笔尖画飞天飘带结, p 整体升起 0..1}
// 返回 {pts 稠密轮廓, tip [x,y] 笔尖, nodes [{x,y,q 绽开度}], at(f)->[x,y]（f 为 0..1 的 x 位置，按当前稠密线）}。
K.mountain = (c, pts, o = {}) => {
  const base = o.base != null ? o.base : 1330, pr = o.prog != null ? clamp(o.prog) : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || 1.2)) : 1), dense = K.smooth(pts, 10), x0 = dense[0][0], x1 = dense[dense.length - 1][0], xe = lerp(x0, x1, pr);
  const dir = o.dir || 'flat', main = K.dirCol(dir), nb = o.bands != null ? o.bands : 7, ymin = Math.min(...dense.map(a => a[1])), step = o.step || clamp((base - ymin) / (nb + 1), 28, 70);
  const pal = dir === 'up' ? [C.up, C.green, C.up2, C.green2, C.up, C.green, C.redDk, C.green2] : dir === 'down' ? [C.down, C.green, C.down2, C.green2, C.down, C.green, C.redDk, C.green2] : [C.green, C.up2, C.green2, C.up, C.green, C.up2, C.redDk, C.green2];
  const line = truncX(dense, xe), tip = line[line.length - 1], res = { pts: dense, tip, nodes: [], at: f => { const x = lerp(x0, x1, f); return [x, yAt(dense, x)]; } };
  const up = o.p != null ? K.ease(o.p) : 1;
  const area = off => { const q = new Path2D(); q.moveTo(line[0][0], line[0][1] + off); line.forEach(a => q.lineTo(a[0], a[1] + off)); q.lineTo(tip[0], base + 80); q.lineTo(line[0][0], base + 80); q.closePath(); return q; };
  const ridge = () => { const q = new Path2D(); line.forEach((a, i) => i ? q.lineTo(a[0], a[1]) : q.moveTo(a[0], a[1])); return q; };
  c.save(); c.translate(0, (1 - up) * 200); c.globalAlpha *= clamp(up * 2);
  if (line.length > 1) {
    c.save(); c.beginPath(); c.rect(x0 - 40, 0, W + 120, base); c.clip();
    F(c, area(0), pal[0], 0); for (let i = 1; i <= nb; i++) { const a = area(step * i); F(c, a, pal[i % pal.length], 0); c.save(); c.translate(0, 0); c.strokeStyle = C.line; c.lineWidth = 2.4; c.stroke(ridgeAt(line, step * i)); c.restore(); }
    c.restore();
    if (o.floor !== false && pr > 0) { c.save(); c.beginPath(); c.rect(0, base - 6, W, 400); c.clip(); K.lotusBand(c, base, o.floorH || 140); c.restore(); }
    c.lineJoin = 'round'; c.strokeStyle = C.line; c.lineWidth = o.ridge === 'slope' ? 10 : 7; c.stroke(ridge());
    if (o.ridge === 'slope') { c.lineWidth = 5.5; c.lineCap = 'round'; for (let i = 1; i < line.length; i++) { const d = line[i][1] - line[i - 1][1], hi = Math.abs(d) > 0.2 ? d < 0 : null; c.strokeStyle = hi == null ? C.gold : hi ? C.up2 : C.down2; c.beginPath(); c.moveTo(line[i - 1][0], line[i - 1][1] - 0.5); c.lineTo(line[i][0], line[i][1] - 0.5); c.stroke(); } }
    else { c.strokeStyle = C.gold; c.lineWidth = 2; c.save(); c.translate(0, -7); c.stroke(ridge()); c.restore(); }
  }
  (o.nodes || []).forEach(n => { const nx = n.f != null ? lerp(x0, x1, n.f) : pts[n.i][0], ny = yAt(dense, nx), q = K.ease(clamp((xe - nx) / 90 + (pr >= 1 ? 1 : 0))); res.nodes.push({ x: nx, y: ny, q });
    if (q > 0) K.lotus(c, nx, ny, n.lot || 0.8, { p: q, dir: n.dir || (o.dir || null) }); });
  if (o.marker && pr > 0.01) K.marker(c, tip[0], tip[1] - 56, 0.8, { p: 1 });
  c.restore(); return res; };
const ridgeAt = (line, off) => { const q = new Path2D(); line.forEach((a, i) => i ? q.lineTo(a[0], a[1] + off) : q.moveTo(a[0], a[1] + off)); return q; };
// 单条价格线「铁线描」（叠在山上或另起一条判断线）：o {col, w 8, prog | lt+at, dash [a,b], gold true 金边, nodes 同 K.mountain 的 [{i|f, dir}]（画莲台）, dir}
// pts [[x,y]…] 同 K.mountain 的点；返回 {tip, pts}。
K.curve = (c, pts, o = {}) => { const pr = o.prog != null ? clamp(o.prog) : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || 1.2)) : 1), dense = K.smooth(pts, 10), x0 = dense[0][0], x1 = dense[dense.length - 1][0], line = truncX(dense, lerp(x0, x1, pr)); if (line.length < 2) return null;
  const col = o.col || K.dirCol2(o.dir), w = o.w || 8, path = K.poly(line, false);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; if (o.dash) c.setLineDash(o.dash);
  c.strokeStyle = C.line; c.lineWidth = w + 5; c.stroke(path); c.strokeStyle = col; c.lineWidth = w; c.stroke(path);
  if (o.gold !== false) { c.setLineDash([]); c.strokeStyle = C.gold; c.lineWidth = 2; c.save(); c.translate(0, -w / 2 - 1); c.stroke(path); c.restore(); } c.restore();
  (o.nodes || []).forEach(n => { const nx = n.f != null ? lerp(x0, x1, n.f) : pts[n.i][0]; if (nx <= line[line.length - 1][0]) K.lotus(c, nx, yAt(dense, nx), n.lot || 0.7, { dir: n.dir || o.dir || null, p: 1 }); });
  return { tip: line[line.length - 1], pts: dense }; };

// ---------- 横卷轴（手卷） ----------
// (x,y) 左上，w×h 为整幅卷的外框。open 0..1 展开（也可 lt+at(+dur 缺省 1.4)）；from 'left'(默认，左轴不动、右轴向右拉开)|'right'。
// fn(c, inner) 在剪裁里画内容，inner={x,y,w,h}（始终是完全展开时的纸面矩形，屏幕坐标，所以内容位置不随 open 变动）。返回 inner。
// 纸面上下是石青绫边，两端木轴＋金帽。内容文字请自己用 K.text（col:K.C.ink）。
K.scroll = (c, x, y, w, h, o = {}, fn) => {
  const op = o.open != null ? clamp(o.open) : prog({ lt: o.lt, at: o.at, dur: o.dur || 1.4 }, 1.4), inner = { x: x + 40, y: y + 26, w: w - 80, h: h - 52 }, res = inner;
  if (op <= 0.01) return res;
  const vw = (w - 52) * op, left = o.from === 'right' ? x + w - 26 - vw : x + 26, rx0 = left, rx1 = left + vw;
  // 纸面（可见部分）
  const paper = K.poly([[rx0, y + 6], [rx1, y + 6], [rx1, y + h - 6], [rx0, y + h - 6]]);
  c.save(); c.translate(6, 8); c.fillStyle = 'rgba(40,14,10,.28)'; c.fill(paper); c.restore();
  c.fillStyle = '#ecdcb4'; c.fill(paper);
  c.save(); c.clip(paper); crackLines(c, rx0, y, vw, h, Math.round(x + y) + 5, 14);
  c.fillStyle = C.up; c.fillRect(rx0, y + 6, vw, 20); c.fillRect(rx0, y + h - 26, vw, 20); c.strokeStyle = C.gold; c.lineWidth = 2; c.strokeRect(rx0, y + 29, vw, h - 58);
  c.fillStyle = C.white; for (let px = rx0 + 14; px < rx1; px += 28) { dot(c, px, y + 16, 3); c.fill(); dot(c, px, y + h - 16, 3); c.fill(); }
  if (fn) { c.save(); c.beginPath(); c.rect(rx0, y + 26, vw, h - 52); c.clip(); fn(c, inner); c.restore(); }
  c.restore(); c.strokeStyle = C.line; c.lineWidth = 3; c.stroke(paper);
  // 木轴
  const rod = (rx, ex) => { const q = K.round(rx - 13, y - 14, 26, h + 28, 8); c.save(); c.translate(5, 6); c.fillStyle = 'rgba(40,14,10,.3)'; c.fill(q); c.restore(); F(c, q, C.redDk, 3);
    c.fillStyle = C.gold; [y - 16, y + h + 16].forEach(yy => { c.beginPath(); c.ellipse(rx, yy, 17, 9, 0, 0, TAU); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke(); }); };
  rod(o.from === 'right' ? rx0 : x + 26); rod(o.from === 'right' ? x + w - 26 : rx1);
  return res; };

// ---------- 剪影人（不画脸） ----------
// (x,y) 脚底中点，s=1 身高约 400。o.kind: 'donor'供养人(立，合袖，幞头)｜'musician'乐伎(坐，抱琵琶，披帛)｜'merchant'商旅(行，斗笠，背包，手杖)。
// o {col 剪影色（缺省暗褐 C.dark）, flip, p 入场（从下方升起）, edge 轮廓金线色}
K.silhouette = (c, x, y, s = 1, o = {}) => { const kind = o.kind || 'donor'; const p = prog(o, 0.5); if (p <= 0) return; const col = o.col || C.dark, edge = o.edge || 'rgba(201,163,91,.7)';
  c.save(); c.translate(x, y + (1 - p) * 30); c.scale(s * (o.flip ? -1 : 1), s); c.globalAlpha *= clamp(p * 1.6); c.lineJoin = 'round'; c.lineCap = 'round';
  const union = (parts) => { c.strokeStyle = edge; c.lineWidth = 5; parts.forEach(q => c.stroke(q)); c.fillStyle = col; parts.forEach(q => c.fill(q)); };
  const limb = (pts, w) => { const q = new Path2D(); pts.forEach((a, i) => i ? q.lineTo(a[0], a[1]) : q.moveTo(a[0], a[1])); c.save(); c.strokeStyle = edge; c.lineWidth = w + 5; c.stroke(q); c.strokeStyle = col; c.lineWidth = w; c.stroke(q); c.restore(); };
  const gold = (d, w = 5) => { c.save(); c.strokeStyle = C.gold; c.lineWidth = w; c.stroke(new Path2D(d)); c.restore(); };
  if (kind === 'donor') {
    union([new Path2D('M-50 -318 C-56 -250 -78 -120 -88 -6 L88 -6 C78 -120 56 -250 50 -318 Z'), new Path2D('M-52 -312 C-104 -292 -116 -246 -98 -212 L-40 -238 Z'), new Path2D('M52 -312 C104 -292 116 -246 98 -212 L40 -238 Z'),
      K.ellipse(0, -246, 24, 16), K.ellipse(0, -366, 27, 32), new Path2D('M-31 -378 C-34 -424 34 -424 31 -378 Z'), new Path2D('M26 -394 L70 -380 L62 -364 Z'), K.ellipse(-26, -4, 26, 9), K.ellipse(26, -4, 26, 9), K.round(-9, -340, 18, 26, 6)]);
    gold('M-56 -236 L56 -236'); gold('M-70 -18 L70 -18', 4); gold('M-14 -318 L0 -284 L14 -318', 4); gold('M-34 -380 C-20 -396 20 -396 34 -380', 3);
  } else if (kind === 'musician') {
    union([K.ellipse(0, -8, 128, 18), new Path2D('M-122 -14 C-134 -72 -82 -112 -46 -132 L46 -132 C82 -112 134 -72 122 -14 Z'), new Path2D('M-44 -128 C-54 -190 -48 -240 -40 -264 L40 -264 C48 -240 54 -190 44 -128 Z'), K.ellipse(0, -298, 25, 29), K.circle(0, -340, 17), K.round(-9, -272, 18, 20, 6)]);
    limb([[-36, -250], [-84, -204], [-52, -226]], 22);
    c.save(); c.translate(22, -150); c.rotate(0.9); c.fillStyle = '#b77b3a'; c.strokeStyle = edge; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, 46, 34, 0, 0, TAU); c.fill(); c.stroke(); c.fillRect(-176, -7, 134, 14); c.strokeRect(-176, -7, 134, 14);
    c.fillStyle = C.gold; dot(c, 8, 0, 8); c.fill(); c.restore();
    limb([[36, -250], [76, -194], [38, -164]], 22);
    taper(c, cr([[30, -262], [92, -300], [146, -262], [182, -308], [214, -290]], 8), u => 22 * (1 - u * 0.7), C.green2, 2.2);
    gold('M-122 -22 C-60 -6 60 -6 122 -22', 4);
  } else {   // merchant
    c.save(); c.translate(-62, -246); c.rotate(0.25); F(c, K.ellipse(0, 0, 40, 54), '#8a6a3a', 3, edge); c.strokeStyle = C.gold; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, -14); c.lineTo(34, 14); c.stroke(); c.restore();
    limb([[-8, -150], [-34, -74], [-46, -8]], 28); limb([[8, -150], [32, -82], [56, -8]], 28);
    union([new Path2D('M-44 -300 L44 -300 L60 -140 L-60 -150 Z'), K.ellipse(0, -338, 24, 28), K.ellipse(0, -362, 66, 12), new Path2D('M-30 -364 C-30 -394 30 -394 30 -364 Z')]);
    limb([[40, -290], [66, -246]], 22);
    c.strokeStyle = '#a07a3c'; c.lineWidth = 8; c.beginPath(); c.moveTo(70, -300); c.lineTo(80, 0); c.stroke(); c.strokeStyle = edge; c.lineWidth = 1.5; c.stroke();
    gold('M-58 -196 L58 -190'); gold('M-36 -366 L36 -366', 3);
  }
  c.restore(); };

// ---------- 手（壁画手印，不画脸） ----------
// (x,y) 掌心，袖子从左下伸来，s 缩放。o {pose 'point'(指点)|'open'(莲花掌)|'pinch'(说法印), rot, flip -1, sleeve 袖色（缺省石青）, p 入场（从袖口方向滑入）}
K.hand = (c, x, y, s = 1, o = {}) => { const { pose = 'point', rot = 0, flip = 1 } = o, p = prog(o, 0.5); if (p <= 0) return; const sleeve = o.sleeve || C.up, skin = '#d8a578';
  c.save(); c.translate(x - (1 - p) * 140 * flip, y + (1 - p) * 60); c.rotate(rot); c.scale(s * flip, s); c.globalAlpha *= clamp(p * 2);
  const sl = K.poly([[-330, -62], [-110, -78], [-100, 78], [-330, 96]]); F(c, sl, sleeve, 3.4);
  c.save(); c.clip(sl); c.strokeStyle = C.white; c.lineWidth = 8; for (let k = -330; k < -100; k += 46) { c.beginPath(); c.moveTo(k, -120); c.lineTo(k + 60, 140); c.stroke(); } c.restore(); c.strokeStyle = C.line; c.lineWidth = 3.4; c.stroke(sl);
  F(c, K.poly([[-125, -82], [-85, -84], [-85, 84], [-125, 86]]), C.gold, 3);
  const fing = (x0, y0, len, wd, ang) => { c.save(); c.translate(x0, y0); c.rotate(ang); F(c, K.round(0, -wd / 2, len, wd, wd / 2), skin, 3); c.restore(); };
  if (pose === 'point') { fing(-52, -60, 90, 34, -0.7); [[24, -2], [24, 28], [24, 54]].forEach(([fx, fy]) => fing(fx, fy - 8, 66, 30, 0)); F(c, K.round(-90, -60, 130, 120, 36), skin, 3); fing(30, -34, 170, 36, 0); }
  else if (pose === 'open') { F(c, K.round(-90, -60, 130, 120, 36), skin, 3); [-46, -18, 10, 38].forEach((fy, i) => fing(30, fy, 150 - Math.abs(i - 1.2) * 12, 30, (i - 1.5) * 0.14)); fing(-30, -62, 100, 34, -0.9); c.strokeStyle = C.down; c.lineWidth = 3; c.beginPath(); c.arc(-20, 0, 14, 0, TAU); c.stroke(); }
  else { [[30, 0, 140, 0.1], [30, 26, 126, 0.22], [30, 50, 98, 0.36]].forEach(([fx, fy, L, an]) => fing(fx, fy, L, 28, an)); F(c, K.round(-90, -60, 130, 120, 36), skin, 3); fing(10, -58, 122, 30, 0.23); fing(30, -30, 100, 30, 0); }
  c.restore(); };

// ---------- 数据章：堆叠带 / 立柱条形，数字挂幡牌 ----------
// 堆叠带 kind 'stack'：series [{name, vals[], col}]（自下而上叠）、cats ['2023','2024',…] 横轴标签（≥44px，至多 5 个）；每层是一条山带，层宽=数值。
// 条形 kind 'bars'：items [{name, val, col|dir}]，画成经幢立柱（顶端莲台），max 缺省取最大值，vals:true 在柱身印数值。
// 数字挂幡牌：o.banners [{ …K.banner 参数(head,num,unit,date,dir/col,w,h,at,lt), layer（stack：挂第几层）+f（0..1 横向位置）| i（bars：挂第几根）}]，
//   幡牌自动排在图上方 o.bannerY（缺省 y-bh-70）一排，垂线接到锚点（莲台）；每屏最多 3 块。
// 其余 o {prog 0..1 描绘/升起 | lt+at(+dur 缺省 1.4), floor true 底部莲花砖带}。返回 {anchors:[{x,y}], rects}。
K.chart = (c, x, y, w, h, o = {}) => {
  const kind = o.kind || 'stack', pr = o.prog != null ? clamp(o.prog) : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || 1.4)) : 1), base = y + h, anchors = [], pad = 20;
  const lab = (s, lx, ly, mw) => K.text(c, s, lx, ly, { size: 44, weight: 'Bold', maxW: mw });
  if (kind === 'stack') {
    const S = o.series, n = S[0].vals.length; let cum = Array(n).fill(0); const tot = Array.from({ length: n }, (_, i) => S.reduce((a, q) => a + q.vals[i], 0)), mx = o.max || Math.max(...tot) * 1.04, X = i => x + pad + (w - pad * 2) * i / Math.max(1, n - 1), lo = Array.from({ length: n }, () => base - 6);
    const xe = lerp(X(0), X(n - 1), pr), layers = [];
    S.forEach((q, k) => { cum = cum.map((v, i) => v + q.vals[i]); const hi = cum.map((v, i) => [X(i), base - 6 - (h - 20) * v / mx]), up = K.smooth(hi, 12), dn = K.smooth(lo.map((v, i) => [X(i), v]), 12); layers.push({ up, dn, col: q.col || [C.up, C.green, C.up2, C.green2, C.down][k % 5], name: q.name }); lo.splice(0, n, ...hi.map(a => a[1])); });
    c.save(); layers.forEach((L, k) => { const u = truncX(L.up, xe), d = truncX(L.dn, xe); if (u.length < 2) return; const q = K.poly(u.concat(d.slice().reverse())); F(c, q, L.col, 2.8);
      c.save(); c.clip(q); c.strokeStyle = 'rgba(239,230,204,.32)'; c.lineWidth = 2; for (let t = 1; t < 4; t++) { c.beginPath(); u.forEach((a, i) => i ? c.lineTo(a[0], a[1] + t * 12) : c.moveTo(a[0], a[1] + t * 12)); c.stroke(); } c.restore();
      c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); u.forEach((a, i) => i ? c.lineTo(a[0], a[1] - 5) : c.moveTo(a[0], a[1] - 5)); c.stroke(); });
    layers.forEach((L, k) => { if (pr < 0.5 || !L.name) return; const lx = X(0) + 20, ly = (yAt(L.up, lx) + yAt(L.dn, lx)) / 2; if (Math.abs(yAt(L.up, lx) - yAt(L.dn, lx)) > 56) K.text(c, L.name, lx, ly, { size: 44, align: 'left', weight: 'Bold', maxW: w * 0.3 }); });
    c.restore();
    (o.banners || []).forEach(b => { const L = layers[b.layer || 0], ax = lerp(X(0), X(n - 1), b.f != null ? b.f : 0.5); anchors.push({ x: ax, y: (yAt(L.up, ax) + yAt(L.dn, ax)) / 2, ok: ax <= xe }); });
    if (o.cats) o.cats.forEach((s, i) => lab(s, lerp(X(0), X(n - 1), i / Math.max(1, o.cats.length - 1)), base + 40, (w) / o.cats.length));
  } else {
    const it = o.items, n = it.length, mx = o.max || Math.max(...it.map(a => a.val)), slot = (w - pad * 2) / n, bw = Math.min(150, slot * 0.58);
    it.forEach((a, i) => { const cx = x + pad + slot * (i + 0.5), q = K.ease(clamp(pr * (n + 1) - i * 0.6 + 0.0) ), bh = (h - 70) * a.val / mx * q, col = a.col || K.dirCol(a.dir), top = base - bh;
      if (bh > 4) { const body = K.poly([[cx - bw / 2, base], [cx - bw / 2, top + 20], [cx, top], [cx + bw / 2, top + 20], [cx + bw / 2, base]]); F(c, body, col, 3);
        c.save(); c.clip(body); c.strokeStyle = 'rgba(239,230,204,.35)'; c.lineWidth = 3; for (let yy = top + 44; yy < base; yy += 44) { c.beginPath(); c.moveTo(cx - bw / 2, yy); c.lineTo(cx + bw / 2, yy); c.stroke(); } c.restore();
        F(c, K.poly([[cx - bw / 2 - 12, base], [cx + bw / 2 + 12, base], [cx + bw / 2 + 6, base - 18], [cx - bw / 2 - 6, base - 18]]), C.redDk, 3);
        if (o.vals && bh > 90) K.text(c, String(a.val), cx, base - 60 - Math.min(bh - 100, 0), { size: 44, weight: 'Black', col: C.paper, maxW: bw - 8 });
        K.lotus(c, cx, top - 24, 0.55, { p: q, col: C.gold }); }
      lab(a.name, cx, base + 44, slot - 6); anchors.push({ x: cx, y: top - 74, ok: q > 0.98 }); });
  }
  if (o.floor) K.lotusBand(c, base + 8, 100);
  const rects = [], bl = (o.banners || []).map((b, j) => ({ b, j, bw: b.w || 300, bh: b.h || 330, a: kind === 'bars' ? anchors[b.i || 0] : anchors[j] })).filter(q => q.a);
  bl.sort((p, q) => p.a.x - q.a.x); let px = 24 - 14; bl.forEach(q => { q.bx = Math.max(clamp(q.a.x - q.bw / 2, 24, W - 24 - q.bw), px + 14); px = q.bx + q.bw; });   // 自左而右排，互不重叠
  const over = px - (W - 24); if (over > 0) { let right = W - 24; for (let i = bl.length - 1; i >= 0; i--) { bl[i].bx = Math.min(bl[i].bx, right - bl[i].bw); right = bl[i].bx - 14; } }
  bl.forEach(q => { const { b, bw, bh, a, bx } = q, by = o.bannerY != null ? o.bannerY : y - bh - 70, at = b.at != null ? b.at : 0, bp = o.lt != null ? K.ease(K.at(o.lt, at, 0.5)) : (b.p != null ? b.p : 1);
    rects.push(K.banner(c, bx, by, bw, bh, { ...b, p: bp }));
    if (bp > 0 && a.ok) { K.hang(c, a.x, by + bh - 6, a.y - 20, K.ease(K.at(o.lt != null ? o.lt : 9, at + 0.3, 0.5))); if (kind === 'stack') K.lotus(c, a.x, a.y + 8, 0.7, { p: bp, dir: b.dir }); } });
  return { anchors, rects }; };

// ---------- 章节卡 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
// 章节卡（每章第一镜）：垂幔＋大幡牌（第 N 章）＋章名＋N 站莲台进度轨（过站金莲、本站红莲、飘带结从上一站移到本站）。
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  K.bg(c, t, { tone: o.tone, footer: true });
  K.valance(c, 100, { lt, at: 0.05, dur: 0.7 });
  K.banner(c, 330, 280, 420, 470, { head: '第', num: n, numSize: 230, unit: `章 · 共 ${Math.max(K.CHAPTER_NAMES.length, n)} 章`, col: o.col || C.green, lt, at: 0.25 });
  K.ribbon(c, K.wave(-60, 880, 1140, 860, 46, 1.2, 14), { w: 44, col: o.col2 || C.up, lt, at: 0.7, dur: 1.2 });
  const lines = K.split2(title), all = lines.reduce((s2, l) => s2 + [...l].length, 0), shown = Math.round(K.at(lt, 1.0, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 92 : all > 6 ? 104 : 120;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) K.text(c, a.slice(0, kk).join(''), W / 2, 1040 + (i - (lines.length - 1) / 2) * size * 1.28, { size, weight: 'Black', maxW: 940 }); });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 150, x1 = 930, ry = 1250, X = i => lerp(x0, x1, i / (N - 1)), rq = MO.cubicOut(K.at(lt, 1.3, 0.5));
  if (rq > 0) { c.save(); c.strokeStyle = C.gold; c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([2, 14]); c.beginPath(); c.moveTo(x0 - 30, ry + 30); c.lineTo(lerp(x0 - 30, x1 + 30, rq), ry + 30); c.stroke(); c.restore(); }
  const walkEnd = 2.3, wq = MO.cubicInOut(K.at(lt, 1.45, walkEnd - 1.45)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  if (lt > 1.5) for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1;
    K.lotus(c, X(i), ry, cur ? 0.85 : 0.52, { halo: cur || past, alpha: past || cur ? 1 : 0.42, p: cur ? K.at(lt, walkEnd, 0.4) : 1, col: past ? C.gold : cur ? C.red : C.paper2 }); }
  if (lt > 1.45 && rq > 0.9) { const tx = lerp(from, done, wq), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 22 : 0; K.marker(c, tx, ry - 92 + hop, 0.7, { p: 1 }); }
  K.finish(c, o);
};
})();
