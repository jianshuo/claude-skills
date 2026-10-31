// 画风套件 ghibli（配方 huashu-art-motion 25_ghibli 的水彩洗染＋赛璐璐月牙影，收敛成「水彩底 + 厚边纸偶」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：底是水彩洗染（P.watercolor：中点位移多边形 × 多层低 α multiply，K.once 缓存，每帧只贴图）；人和物是「纸偶」——硬边色块＋奶油色剪纸白边＋暖褐 2.6px 线＋
//       朝光（左上）的赛璐璐月牙影（K.cel）；不画渐变人物。人有表情（calm happy worry sad angry listen none），严肃章用 cool 底、不笑。
//       贯穿物 = 客厅里同一把/一圈椅子 K.chair（state: normal empty tipped crossed raised）。图表一律「纸板贴片」（K.board / K.bars）。
//       主体放 y200–1350，字幕带 y≈1480，K.finish 压暗字幕带。所有随机走 U.hash / U.rng，同一 t 同一帧；水彩大图走 K.once/PAINT.cached，首帧可慢（约 1 秒），之后每帧快。
// 人：头身约 1:4.5 的纸偶，s=1 站高约 450px；坐姿真画坐姿（大腿前缩、小腿垂下），坐在 K.chair/K.sofa 的坐垫上（坐垫面 y=地面 -148*s）。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__gh) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__gh = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__gh) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__gh = 1; } }

// ---------- 色板 ----------
const C = K.C = {
  cream: '#E8D2A0', creamLt: '#F6EBCB', paper: '#FBF3DC', white: '#FFF8EA',
  wood: '#B07A45', woodLt: '#C99460', woodDk: '#8A5A30', cocoa: '#5A3520', cocoaLt: '#7A5236', line: '#6a4a38',
  teapot: '#D9534A', teal: '#4F9A94', blue: '#4A6FA5', gold: '#E2B04A', leaf: '#5E9A4E', rose: '#E8A0A0', plum: '#A9457A',
  grayBlue: '#AEB7BF', slate: '#8A96A2', slateDk: '#3B3530', red: '#B8453C',
  sky: '#6FA3DC', skyLt: '#CFE6F4', helmet: '#8EC5E8', card: '#CDA774', cardDk: '#B88B55',
};
K.SKINS = ['#F3CBA4', '#DFA878', '#B5703F', '#80492A', '#5A3320', '#ECBF92'];
K.mix = (a, b, k) => { const u = P.hex(a), v = P.hex(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
const SHC = {}; K.shade = (col, k = 0.27) => SHC[col + k] || (SHC[col + k] = K.mix(col, '#4a2418', k));
K.light = (col, k = 0.3) => K.mix(col, '#FFF6E0', k);
const LINE = C.line;
const skinOf = s => typeof s === 'number' ? K.SKINS[((s % 6) + 6) % 6] : s;

// ---------- 进度 / 缓存 / 路径 / 相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.smooth = (pts, closed = true, k = 0.5) => RIG.smooth(pts, closed, k);
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
K.theme = { col: C.cocoa, halo: 'rgba(255,248,232,.92)', sub: C.cocoaLt, kind: 'cream' };   // K.bg 每帧设置；K.text/K.tag 默认色跟它走

// ---------- 纸偶基元：赛璐璐月牙影 ----------
// cel(c, path, 色, {dx,dy 月牙偏移（光从左上，影落右下）, lw 线宽, rim 奶油剪纸白边, sh 影色, line 线色})
K.cel = (c, p, col, o = {}) => { const { dx = 6, dy = 9, lw = 2.6, rim = true, sh = null, line = LINE } = o;
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (rim && K.RIM) { c.strokeStyle = 'rgba(255,248,230,.88)'; c.lineWidth = lw + 5; c.stroke(p); }
  c.fillStyle = sh || K.shade(col); c.fill(p);
  if (dx || dy) { c.save(); c.clip(p); c.translate(-dx, -dy); c.fillStyle = col; c.fill(p); c.restore(); } else { c.fillStyle = col; c.fill(p); }
  if (lw > 0) { c.strokeStyle = line; c.lineWidth = lw; c.stroke(p); } };
const cel = K.cel; K.RIM = true;
const strokeLine = (c, pts, col = LINE, lw = 3, a = 1) => { c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = c.lineJoin = 'round'; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); c.restore(); };
const tf = (c, x, y, s, rot, fn) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (s !== 1) c.scale(s, s); fn(); c.restore(); };
const softShadow = (c, x, y, rx, ry, a = 0.22) => { c.save(); c.fillStyle = `rgba(90,50,30,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore(); };
K._skin = skinOf; K._wash = (...a) => wash(...a); K._cloud = (...a) => cloud(...a); K._tf = tf; K._line = strokeLine; K._shadow = softShadow;

// ---------- 水彩底 ----------
const wash = (g, pts, col, o) => P.watercolor(g, pts, col, o), ell = P.ellipsePts, rect = P.rectPts;
const KINDS = {
  cream: { wall: ['#fbf3e0', '#f3e0b8', '#dfc596'], mid: '#efdcb4', tints: ['#f2c48a', '#e9b4a2', '#b9c9d8', '#f3dca0', '#d6ae80', '#c8d4b0'], tA: 0.028, floor: ['#e6bf86', '#dcb27a', '#eac790', '#d8ad74'], wains: ['#cf9a68', '#c48f5e', '#d6a574', '#bb8658'], rail: '#a07448', base: '#b08458', theme: { col: C.cocoa, halo: 'rgba(255,248,232,.92)', sub: C.cocoaLt } },
  dusk: { wall: ['#fae3bc', '#eeba8c', '#d69a78'], mid: '#efbf94', tints: ['#f0a070', '#e48a7a', '#c89ab0', '#f3c27a', '#b98aa0', '#f0b890'], tA: 0.032, floor: ['#dba478', '#d09a6c', '#e2ae82', '#c9925f'], wains: ['#c08c62', '#b58258', '#c8966c', '#ad7a52'], rail: '#8c5c3a', base: '#96663f', theme: { col: C.cocoa, halo: 'rgba(255,240,222,.92)', sub: C.cocoaLt } },
  cool: { wall: ['#c9d0d6', '#aeb7bf', '#98a2ac'], mid: '#aeb7bf', tints: ['#9aa8b6', '#b8c0c8', '#8e9aa6', '#a9b4bd', '#c6ccd2', '#97a3ae'], tA: 0.03, floor: ['#d3d9df', '#cbd2d9', '#dbe0e5', '#c5ccd3'], wains: ['#bdc5cd', '#b6bec7', '#c4ccd4', '#b0b8c1'], rail: '#8f99a4', base: '#8f99a4', theme: { col: C.slateDk, halo: 'rgba(232,237,241,.9)', sub: '#5d6670' } },
  night: { wall: ['#46568a', '#2f3d66', '#1f2a4a'], mid: '#2d3b62', tints: ['#55659a', '#3a4c80', '#6a5a8a', '#2d4a6a', '#4a5a8f', '#5a4a7a'], tA: 0.05, floor: ['#3a3340', '#332d3a', '#403846', '#2f2a36'], wains: ['#2c2a3c', '#272536', '#323046', '#242234'], rail: '#1c1a2a', base: '#1c1a2a', theme: { col: '#FFF1D2', halo: null, sub: '#d8c9a8' } },
  sky: { wall: ['#d8eef4', '#a9d8f2', '#6fa3dc'], mid: '#a9d8f2', tints: ['#ffffff', '#cfe6f4', '#f3dca0', '#c8d4b0'], tA: 0.04, floor: ['#6fa070', '#5e9a4e', '#7aae6a', '#4f8a4a'], wains: [], rail: '#3d7440', base: '#3d7440', theme: { col: C.cocoa, halo: 'rgba(255,255,255,.9)', sub: C.cocoaLt } },
};
K.KINDS = Object.keys(KINDS);
const cloud = (key, w, h, seed, tint = '#ffffff', shade = 'rgba(120,145,190,.7)') => P.cached('gh_cloud_' + key, w, h, g => {
  const r = U.rng(seed), puffs = [];
  for (let i = 0; i < 14; i++) { const x = w * (0.15 + r() * 0.7), yy = h * 0.68 - Math.sin((x / w) * Math.PI) * h * (0.2 + r() * 0.2); puffs.push([x, yy, 26 + r() * 40]); }
  puffs.push([w * 0.5, h * 0.62, w * 0.3]);
  puffs.forEach(([x, y, rr], i) => wash(g, ell(x, y, rr, rr * 0.82, 14), tint, { layers: 3, alpha: 0.9, amp: 6, seed: seed + i, edge: 0, blend: 'source-over' }));
  g.save(); g.globalCompositeOperation = 'source-atop'; const sh = g.createLinearGradient(0, h * 0.4, 0, h); sh.addColorStop(0, 'rgba(150,175,205,0)'); sh.addColorStop(1, shade); g.fillStyle = sh; g.fillRect(0, 0, w, h); g.restore(); });
// 水彩底图（缓存）：墙 + 色晕 + 护墙板 + 地板（sky 底是天空＋远山＋草地）
const bgTex = (kind, floorY, seed) => P.cached(`gh_bg_${kind}_${floorY}_${seed}`, W, H, g => {
  const KD = KINDS[kind]; const FY = floorY === false ? 1000 : floorY;
  if (kind === 'sky') {
    const sk = g.createLinearGradient(0, 0, 0, 1100); sk.addColorStop(0, '#5b97d8'); sk.addColorStop(0.6, '#a9d8f2'); sk.addColorStop(1, '#e4f2f0'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
    wash(g, rect(-20, -20, W + 40, 900), '#a9d8f2', { layers: 4, alpha: 0.1, amp: 30, seed: seed + 1, edge: 0 });
    wash(g, [[-40, 1010], [200, 940], [460, 990], [720, 920], [1000, 980], [1140, 950], [1140, 1300], [-40, 1300]], '#8fb4b8', { layers: 3, alpha: 0.55, amp: 18, seed: seed + 2, edge: 0.1, blend: 'source-over' });
    wash(g, [[-40, 1080], [300, 1020], [640, 1070], [900, 1010], [1140, 1050], [1140, 1400], [-40, 1400]], '#6fa070', { layers: 3, alpha: 0.8, amp: 16, seed: seed + 3, edge: 0.1, blend: 'source-over' });
    const gr = g.createLinearGradient(0, 1100, 0, H); gr.addColorStop(0, '#6aa854'); gr.addColorStop(1, '#4f8a4a'); wash(g, [[-40, 1130], [300, 1090], [700, 1120], [1140, 1090], [1140, H + 40], [-40, H + 40]], '#5e9a4e', { layers: 4, alpha: 0.5, amp: 14, seed: seed + 4, edge: 0.1, blend: 'source-over', fill: gr });
    const r = U.rng(seed + 9); for (let i = 0; i < 70; i++) { const x = r() * W, y = 1150 + r() * 700, rr = 20 + r() * 40; wash(g, ell(x, y, rr * 1.6, rr * 0.5, 10), r() < 0.5 ? '#7aae6a' : '#4f8a4a', { layers: 2, alpha: 0.12, amp: 8, seed: 700 + i, edge: 0 }); }
    return;
  }
  const wl = g.createRadialGradient(540, 520, 80, 540, 700, 1300); wl.addColorStop(0, KD.wall[0]); wl.addColorStop(0.6, KD.wall[1]); wl.addColorStop(1, KD.wall[2]);
  g.fillStyle = KD.wall[1]; g.fillRect(0, 0, W, H);
  wash(g, rect(-20, -20, W + 40, FY + 20), KD.mid, { layers: 5, alpha: 0.4, amp: 12, seed: seed + 2, edge: 0, fill: wl, blend: 'source-over' });
  { const r = U.rng(404 + seed); for (let i = 0; i < 22; i++) { const x = r() * W, y = r() * FY, rx = 90 + r() * 200, ry = 60 + r() * 140; wash(g, ell(x, y, rx, ry, 10), KD.tints[i % 6], { layers: 3, alpha: KD.tA, amp: 40, seed: 100 + i + seed, edge: 0.02 }); } }
  if (kind === 'night') { const r = U.rng(31 + seed); g.fillStyle = 'rgba(255,240,200,.5)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * W, r() * 600, 1 + r() * 1.6, 0, TAU); g.fill(); } }
  // 护墙板
  const wy = FY - 60; g.fillStyle = KD.wains[2]; g.fillRect(0, wy, W, FY - wy + 4);
  for (let x = -10; x < W; x += 60) wash(g, rect(x, wy, 58, FY - wy + 6), KD.wains[((x / 60) | 0) % 4], { layers: 3, alpha: 0.32, amp: 3, seed: 200 + x, edge: 0.12 });
  wash(g, rect(-20, wy - 10, W + 40, 14), KD.rail, { layers: 3, alpha: 0.4, amp: 2, seed: 7 + seed, edge: 0.15 });
  // 地板：行高逐渐加大（透视）
  g.fillStyle = KD.floor[2]; g.fillRect(0, FY, W, H - FY);
  { const r = U.rng(606 + seed); let y = FY, k = 0; while (y < H + 10) { const h = 40 + k * 18; wash(g, rect(-20, y, W + 40, h), KD.floor[(r() * 4) | 0], { layers: 3, alpha: 0.5, amp: 3, seed: 300 + k + seed, edge: 0.14 }); y += h; k++; } }
  wash(g, rect(-20, FY - 22, W + 40, 24), KD.base, { layers: 4, alpha: 0.25, amp: 4, seed: 6 + seed, edge: 0.1 });
  // 窗光落在地板（径向渐变，不用 blur）
  if (kind === 'cream' || kind === 'dusk') { g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(540, FY + 260, 40, 540, FY + 300, 700); lg.addColorStop(0, kind === 'dusk' ? 'rgba(255,200,140,.4)' : 'rgba(255,236,180,.42)'); lg.addColorStop(1, 'rgba(255,236,180,0)'); g.fillStyle = lg; g.fillRect(0, FY, W, H - FY); g.restore(); }
});
// K.bg(c, t, o): o = { kind: cream|dusk|cool|night|sky, floor: 地面线 y（默认 900；false = 无室内地板线）, seed, light: 窗光斑（cream/dusk 默认开）, clouds: sky 底飘云（默认开）}
K.bg = (c, t, o = {}) => { const { kind = 'cream', floor = 900, seed = 1, light = true, clouds = true } = o; const KD = KINDS[kind] || KINDS.cream; K.theme = { ...KD.theme, kind };
  c.drawImage(K.once(`bgimg_${kind}_${floor}_${seed}`, () => bgTex(kind in KINDS ? kind : 'cream', floor, seed)), 0, 0);
  if (kind === 'sky' && clouds) { [[0, 260, 520, 360, 11, 14], [1, 520, 380, 270, 23, 22], [2, 760, 450, 330, 41, 18], [3, 140, 800, 300, 52, 26]].forEach(([i, y0, cw, ch, sd, sp]) => { const x = ((i * 410 + t * sp) % (W + cw)) - cw; c.drawImage(cloud(`bg${i}`, cw, ch, sd), x, y0); }); }
  if (light && (kind === 'cream' || kind === 'dusk')) { c.save(); c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) { const x = 140 + i * 160 + Math.sin(t * 0.4 + i * 1.7) * 40, y = 250 + (i % 3) * 140 + Math.cos(t * 0.33 + i) * 30, r = 90 + (i % 3) * 30, a = 0.1 + 0.05 * Math.sin(t * 1.4 + 1.7 * i);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,240,190,${a})`); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } c.restore(); }
};

// ---------- 文字 ----------
// o: { size, fam, col, align, alpha, scale, track, maxW, rot, halo（奶油描边，默认随底色；false 关） }
K.text = (c, s, x, y, o = {}) => { const th = K.theme, { size = 64, fam = 'PuHui-Black', col = th.col, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o, halo = o.halo === undefined ? th.halo : o.halo;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle';
  if (halo) { c.lineJoin = 'round'; c.strokeStyle = halo === true ? 'rgba(255,248,232,.92)' : halo; c.lineWidth = size * 0.16; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 纸标签：奶油纸牌＋暖褐细线＋正下方一块硬边影子（不用模糊）
K.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.paper, col = C.cocoa, scale = 1, alpha = 1, shadow = true, rot = 0, padX = 0.7 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.5, r = size * 0.3;
  if (shadow) { c.fillStyle = 'rgba(90,50,30,.25)'; c.fill(K.round(-w / 2 + 3, -h / 2 + 9, w, h, r)); }
  cel(c, K.round(-w / 2, -h / 2, w, h, r), fill, { dx: 0, dy: 5, lw: 2.6, rim: false });
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：暖褐线（像拉的线）＋红图钉，末端纸标签逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.paper, col = C.cocoa, size = 50 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  strokeLine(c, [[ax, ay], [lerp(ax, bx, p1), lerp(ay, by, p1)]], C.line, 4);
  c.save(); c.fillStyle = C.teapot; c.strokeStyle = LINE; c.lineWidth = 2.4; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.stroke(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.4, h = size * 1.5; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = 'rgba(90,50,30,.25)'; c.fill(K.round(-w / 2 + 3, -h / 2 + 9, w, h, size * 0.3)); cel(c, K.round(-w / 2, -h / 2, w, h, size * 0.3), fill, { dx: 0, dy: 5, rim: false });
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.7, 3); c.restore(); };

// 收尾：全幅纸纹颗粒（multiply）＋暖褐压边＋字幕带压暗（y1380–1600）
K.finish = c => { const kind = K.theme.kind;
  c.drawImage(K.once('fin_' + kind, () => P.cached('gh_fin_' + kind, W, H, g => { const cold = kind === 'cool', night = kind === 'night';
    const tile = P.cached('gh_grain', 256, 256, t2 => { const r = U.rng(2510); for (let i = 0; i < 2600; i++) { t2.fillStyle = r() < 0.7 ? `rgba(120,90,60,${0.025 + r() * 0.04})` : `rgba(255,252,240,${0.05 + r() * 0.07})`; t2.fillRect(r() * 256, r() * 256, 2, 2); } });
    g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H);
    const vc = night ? '10,14,34' : cold ? '60,70,84' : '120,80,40', v = g.createRadialGradient(W / 2, H * 0.44, 640, W / 2, H * 0.44, 1350); v.addColorStop(0, `rgba(${vc},0)`); v.addColorStop(1, `rgba(${vc},${night ? 0.34 : 0.24})`); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const bc = night ? '8,10,24' : cold ? '40,46,56' : '70,42,26', b = g.createLinearGradient(0, 1370, 0, 1610); b.addColorStop(0, `rgba(${bc},0)`); b.addColorStop(0.5, `rgba(${bc},.34)`); b.addColorStop(1, `rgba(${bc},0)`); g.fillStyle = b; g.fillRect(0, 1370, W, 240); })), 0, 0); };
// 字幕（assemble 生成的 subs.js 调它）：可可褐板＋奶油字，字幕带 y≈1480
K.subtitle = (c, text, a) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(40,22,12,.28)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2 + 7, w, h, 22); c.fill();
  c.fillStyle = 'rgba(78,46,28,.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 22); c.fill();
  c.strokeStyle = 'rgba(255,244,220,.35)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 17); c.stroke();
  c.fillStyle = '#FFF4DC'; c.fillText(text, x, y + 2, 1000); c.restore(); };
})();

// ---------- 纸偶人物 ----------
// K.person(c, x, y, s, o) —— (x,y)=两脚中点（地面），s=1 站高约 450px。返回屏幕锚点 {head, top, handL, handR, chest, feet, hold}。
// o: { pose, to, mix 0..1（姿势混合）, mood, t（全片时间：呼吸、说话口型）, flip 朝左, walk 相位, look -1..1, alpha, react（阻尼晃头的时刻）,
//      skin 0..5|#hex, hair 色, hairStyle short|long|bun|afro|braid|hijab|turban|bald, wrap 头巾色, cloth 衣色, pants 裤色, shoe, trim stripe|collar|dots|sash|suit,
//      dress 连衣裙, hat helmet|cap|straw, glasses, beard, back 背对, cut 世界坐标 y 以下不画（被桌子挡住下半身）, hand 'R'|'L'|'both'（pose raise 举哪只手）, speak 口型动, shadow 脚下影 }
// pose：stand walk sit point speak shrug raise slump hold；mood：calm happy worry sad angry listen none
(() => { const K_ = K, C = K_.C, { TAU } = K_, { clamp, lerp } = U; const strokeLine = K._line, softShadow = K._shadow, cel = K.cel, LINE = K.C.line, skinOf = K._skin, P = PAINT;
const POSE = {
  stand: { L: [-76, -136], R: [76, -136], sh: 0, hd: [0, 0], tilt: 0, lean: 0, sit: 0 },
  walk: { L: [-72, -146], R: [72, -146], sh: 0, hd: [0, 0], tilt: 0, lean: 0.03, sit: 0 },
  sit: { L: [-78, -150], R: [78, -150], sh: 0, hd: [0, 0], tilt: 0, lean: 0, sit: 1 },
  point: { L: [-72, -140], R: [250, -372], sh: 0, hd: [6, 0], tilt: -0.05, lean: 0, sit: 0 },
  speak: { L: [-72, -148], R: [146, -288], sh: 0, hd: [0, 0], tilt: -0.04, lean: 0, sit: 0 },
  shrug: { L: [-152, -300], R: [152, -300], sh: -16, hd: [0, 4], tilt: -0.1, lean: 0, sit: 0 },
  raise: { L: [-76, -138], R: [90, -518], sh: -6, hd: [0, 0], tilt: 0.04, lean: 0, sit: 0 },
  raiseL: { L: [-90, -518], R: [76, -138], sh: -6, hd: [0, 0], tilt: -0.04, lean: 0, sit: 0 },
  raiseB: { L: [-92, -514], R: [92, -514], sh: -8, hd: [0, -4], tilt: 0, lean: 0, sit: 0 },
  slump: { L: [-50, -130], R: [50, -130], sh: 20, hd: [0, 28], tilt: 0.18, lean: 0.07, sit: 0 },
  hold: { L: [-42, -252], R: [42, -252], sh: 0, hd: [0, 0], tilt: 0, lean: 0, sit: 0 },
};
K_.POSES = ['stand', 'walk', 'sit', 'point', 'speak', 'shrug', 'raise', 'slump', 'hold']; K_.MOODS = ['calm', 'happy', 'worry', 'sad', 'angry', 'listen', 'none'];
const SIT_SHIFT = 56;
const mixP = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A, L = (u, v) => lerp(u, v, k); return { L: [L(A.L[0], B.L[0]), L(A.L[1], B.L[1])], R: [L(A.R[0], B.R[0]), L(A.R[1], B.R[1])], sh: L(A.sh, B.sh), hd: [L(A.hd[0], B.hd[0]), L(A.hd[1], B.hd[1])], tilt: L(A.tilt, B.tilt), lean: L(A.lean, B.lean), sit: L(A.sit, B.sit) }; };
// 二骨 IK：肘取「更往外、更往下」那一解
const ik = (S, T, a, b, out) => { let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-3; const mx = a + b - 0.5, k = d > mx ? mx / d : 1; d = Math.min(d, mx); const ang = Math.atan2(dy, dx);
  const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)); const E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a];
  const sc = E => E[0] * out + E[1] * 0.6; return { E: sc(E1) >= sc(E2) ? E1 : E2, Hn: [S[0] + dx * k, S[1] + dy * k] }; };
const helmetPath = () => { const p = new Path2D(); p.moveTo(-47, -6); p.ellipse(0, -6, 47, 50, 0, Math.PI, TAU); p.closePath(); return p; };
const drawHelmet = (c, col = C.helmet) => { cel(c, helmetPath(), col, { dx: 6, dy: 8 }); cel(c, K_.round(-53, -10, 106, 13, 6), K_.shade(col, 0.12), { dx: 0, dy: 3, lw: 2.2 });
  c.fillStyle = '#FFF8EA'; c.beginPath(); c.arc(0, -34, 11, 0, TAU); c.fill(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke(); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, -34, 5, 0, TAU); c.stroke(); };
K_.drawHelmet = drawHelmet;
const hairPaths = (style, hr) => { const sm = (pts, k = 0.45) => K_.smooth(pts, true, k), o = {};
  o.fringe = sm([[-43, 4], [-42, -26], [-24, -46], [6, -52], [34, -42], [43, -16], [43, 4], [30, -20], [8, -30], [-18, -24]]);
  if (style === 'long') o.back = sm([[-48, -8], [-52, 60], [-38, 88], [38, 88], [52, 60], [48, -8], [0, -56]]);
  if (style === 'afro') { o.back = K_.ellipse(0, -10, 60, 58); }
  if (style === 'braid') { o.back = sm([[-46, 0], [-52, 100], [-34, 104], [-32, 0]]); o.back2 = sm([[46, 0], [52, 100], [34, 104], [32, 0]]); }
  if (style === 'bun') o.bun = K_.circle(0, -60, 17);
  if (style === 'hijab') { o.wrapBack = sm([[-54, -6], [-58, 70], [0, 94], [58, 70], [54, -6], [42, -50], [0, -64], [-42, -50]], 0.4); o.wrapFront = sm([[-40, -2], [-42, -28], [-22, -50], [22, -50], [42, -28], [40, -2], [30, -22], [0, -32], [-30, -22]], 0.4); }
  if (style === 'turban') o.wrapFront = sm([[-45, -2], [-46, -30], [-26, -56], [24, -60], [46, -30], [45, -2], [0, -26]], 0.4);
  return o; };
const HAIR = {}; const hairOf = style => HAIR[style] || (HAIR[style] = hairPaths(style));
const rawPerson = (c, x, y, s = 1, o = {}) => {
  const { pose = 'stand', to = null, mix = 0, mood = 'calm', t = 0, flip = false, walk = null, look = 0, alpha = 1, react = -1e9, hairStyle = 'short', hat = null, glasses = false, beard = false, back = false, hand = 'R', speak = false, dress = false, trim = null } = o;
  const skin = skinOf(o.skin ?? 0), hair = o.hair || '#2a1d18', cloth = o.cloth || C.teal, pants = o.pants || '#6B5B4E', shoe = o.shoe || C.cocoa, wrap = o.wrap || '#E8E0F0', sk2 = K_.shade(skin, 0.2);
  const pn = n => n === 'raise' && hand !== 'R' ? (hand === 'L' ? 'raiseL' : 'raiseB') : n;
  const Q = mixP(pn(pose), pn(to || pose), MO.cubicInOut(clamp(mix))), sitK = Q.sit, sit = sitK > 0.5, fx = flip ? -1 : 1;
  const tt = o._t ?? t, br = o._br ?? Math.sin(t * 2.2 + x * 0.01) * 1.6, wob = o._wob ?? K_.damped(t, react, 0.1, 0.42, 0.36), sh = Q.sh + br, shiftY = SIT_SHIFT * sitK, bob = walk == null ? 0 : -Math.abs(Math.sin(walk)) * 7;
  c.save(); c.globalAlpha *= alpha; if (o.cut != null) { c.beginPath(); c.rect(-2000, -2000, 5000, 2000 + o.cut); c.clip(); } c.translate(x, y); c.scale(s * fx, s);
  if (o.shadow ?? !sit) softShadow(c, 0, 4, 78, 15, 0.2);
  // ---- 腿 ----
  const sw = walk == null ? 0 : Math.sin(walk);
  if (sit) {
    [-1, 1].forEach(sd => { cel(c, K_.taper([sd * 36, -92], [sd * 38, -24], 36, 31, 0), dress ? skin : pants, { dx: 5, dy: 0 }); });
    [-1, 1].forEach(sd => { cel(c, K_.ellipse(sd * 40, -12, 29, 14), shoe, { dx: 0, dy: 5, lw: 2.2 }); });
    if (dress) cel(c, K_.smooth([[-52, -142], [52, -142], [70, -108], [60, -92], [-60, -92], [-70, -108]], true, 0.35), cloth, { dx: 6, dy: 6 });
    else [-1, 1].forEach(sd => { cel(c, K_.round(sd * 35 - 31, -152, 62, 58, 24), pants, { dx: 5, dy: 7 }) });
  } else {
    [-1, 1].forEach((sd, i) => { const sl = walk == null ? 0 : (i ? -sw : sw), lift = walk == null ? 0 : Math.max(0, i ? -Math.cos(walk) : Math.cos(walk)) * 18, fx2 = sd * 30 + sl * 40, fy = -22 - lift;
      cel(c, K_.taper([sd * 24, -200], [fx2, fy], 46, 34, 1), dress ? skin : pants, { dx: 6, dy: 0 }); cel(c, K_.ellipse(fx2 + 8, fy + 10, 29, 14), shoe, { dx: 0, dy: 5, lw: 2.2 }); });
    if (dress) cel(c, K_.smooth([[-50, -210], [50, -210], [78, -96], [0, -84], [-78, -96]], true, 0.3), cloth, { dx: 8, dy: 6 });
  }
  // ---- 上身（绕胯点前倾；坐姿整体下移）----
  c.translate(0, shiftY + bob); c.translate(0, -196); c.rotate(Q.lean); c.translate(0, 196);
  const torso = K_.smooth([[-50, -338 + sh], [-22, -348 + sh], [22, -348 + sh], [50, -338 + sh], [66, -318 + sh], [61, -250], [57, -200], [0, -194], [-57, -200], [-61, -250], [-66, -318 + sh]], true, 0.4);
  if (!dress) cel(c, torso, cloth, { dx: 9, dy: 6 }); else cel(c, torso, cloth, { dx: 9, dy: 6 });
  if (trim) { c.save(); c.clip(torso);
    if (trim === 'stripe') for (let i = 0; i < 6; i++) strokeLine(c, [[-80, -318 + i * 28], [80, -318 + i * 28]], 'rgba(255,248,230,.55)', 8);
    else if (trim === 'dots') { const r = U.rng(o.dseed ?? 5); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,240,210,.7)'; c.beginPath(); c.arc((r() - 0.5) * 100, -320 + r() * 120, 6, 0, TAU); c.fill(); } }
    else if (trim === 'sash') strokeLine(c, [[-62, -330], [60, -210]], C.teapot, 16);
    c.restore();
    if (trim === 'collar') strokeLine(c, [[-26, -350 + sh], [0, -300], [26, -350 + sh]], '#fff8ea', 8);
    if (trim === 'suit') { c.fillStyle = '#FFF8EA'; c.beginPath(); c.moveTo(-20, -348 + sh); c.lineTo(0, -292); c.lineTo(20, -348 + sh); c.closePath(); c.fill(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
      c.fillStyle = C.teapot; c.beginPath(); c.moveTo(-6, -340 + sh); c.lineTo(6, -340 + sh); c.lineTo(9, -276); c.lineTo(0, -262); c.lineTo(-9, -276); c.closePath(); c.fill(); c.stroke();
      strokeLine(c, [[-22, -348 + sh], [-8, -250]], K_.shade(cloth, 0.4), 2.4, 0.8); strokeLine(c, [[22, -348 + sh], [8, -250]], K_.shade(cloth, 0.4), 2.4, 0.8); } }
  cel(c, K_.round(-14, -366 + sh * 0.5, 28, 34, 8), sk2, { dx: 0, dy: 0, lw: 2, rim: false });
  // ---- 头 ----
  c.save(); c.translate(Q.hd[0], Q.hd[1] + sh * 0.5); c.translate(0, -356); c.rotate(Q.tilt + wob + (mood === 'listen' ? 0.12 : 0)); c.translate(0, 356);
  const HC = -404, H_ = hairOf(hairStyle), hasWrap = hairStyle === 'hijab' || hairStyle === 'turban';
  c.save(); c.translate(0, HC);
  if (H_.wrapBack) cel(c, H_.wrapBack, wrap, { dx: 8, dy: 8 });
  if (H_.back) cel(c, H_.back, hair, { dx: 7, dy: 7, lw: 2.2 }); if (H_.back2) cel(c, H_.back2, hair, { dx: 7, dy: 7, lw: 2.2 });
  if (hairStyle !== 'hijab') { cel(c, K_.ellipse(-41, 4, 6, 10), skin, { dx: 2, dy: 2, lw: 2 }); cel(c, K_.ellipse(41, 4, 6, 10), skin, { dx: 2, dy: 2, lw: 2 }); }
  if (back) { cel(c, K_.ellipse(0, 0, 41, 45), hasWrap && hairStyle === 'hijab' ? wrap : hair, { dx: 8, dy: 8 }); }
  else {
    cel(c, K_.ellipse(0, 0, 40, 44), skin, { dx: 8, dy: 7 });
    if (beard) cel(c, K_.smooth([[-40, 2], [-36, 30], [0, 52], [36, 30], [40, 2], [26, 24], [0, 30], [-26, 24]], true, 0.4), hair, { dx: 4, dy: 4, lw: 2 });
    if (mood !== 'none') {
      const lk = look * 6, ex = 15, ey = -2, dk = '#2a1a12', brow = 'rgba(70,40,28,.75)';
      c.fillStyle = 'rgba(232,110,100,' + (mood === 'happy' ? 0.45 : 0.3) + ')'; [-1, 1].forEach(d => { c.beginPath(); c.ellipse(d * 25 + lk * 0.6, 15, 9, 5.5, 0, 0, TAU); c.fill(); });
      const eye = d => { const px = d * ex + lk;
        if (mood === 'happy') { c.strokeStyle = dk; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.arc(px, ey + 3, 6.5, 1.12 * Math.PI, 1.88 * Math.PI); c.stroke(); }
        else { const ry = mood === 'sad' || mood === 'worry' ? 4.6 : 5.2; c.fillStyle = dk; c.beginPath(); c.ellipse(px, ey, 3.7, ry, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(px - 1.1, ey - 2, 1.3, 0, TAU); c.fill(); } };
      eye(-1); eye(1);
      const bw = (d, a, dy = 0) => { c.save(); c.translate(d * ex + lk, -15 + dy); c.rotate(a); strokeLine(c, [[-8, 0], [8, 0]], brow, 2.8); c.restore(); };
      if (mood === 'calm') { bw(-1, -0.04); bw(1, 0.04); } else if (mood === 'happy') { bw(-1, -0.1, -1); bw(1, 0.1, -1); }
      else if (mood === 'worry') { bw(-1, -0.34, -1); bw(1, 0.34, -1); } else if (mood === 'sad') { bw(-1, -0.46, 0); bw(1, 0.46, 0); }
      else if (mood === 'angry') { bw(-1, 0.45, 1); bw(1, -0.45, 1); } else if (mood === 'listen') { bw(-1, -0.05, 0); bw(1, 0.12, -6); }
      strokeLine(c, [[lk * 0.5 + 1, 6], [lk * 0.5 + 3, 11], [lk * 0.5 - 1, 12]], sk2, 2, 0.9);
      const mx = lk * 0.6, my = 27; c.strokeStyle = '#7a3a30'; c.fillStyle = '#7a3a30'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath();
      if (speak) { const o2 = 3 + 6 * (o._sp ?? Math.abs(Math.sin(t * 9 + x))); c.ellipse(mx, my, 7, o2, 0, 0, TAU); c.fillStyle = '#8a3a30'; c.fill(); }
      else if (mood === 'happy') { c.moveTo(mx - 10, my - 3); c.quadraticCurveTo(mx, my + 12, mx + 10, my - 3); c.closePath(); c.fillStyle = '#8a3a30'; c.fill(); c.stroke(); }
      else if (mood === 'calm') { c.moveTo(mx - 8, my); c.quadraticCurveTo(mx, my + 6, mx + 8, my); c.stroke(); }
      else if (mood === 'sad') { c.moveTo(mx - 8, my + 5); c.quadraticCurveTo(mx, my - 3, mx + 8, my + 5); c.stroke(); }
      else if (mood === 'angry') { c.moveTo(mx - 8, my + 3); c.lineTo(mx + 8, my + 1); c.stroke(); }
      else if (mood === 'worry') { c.moveTo(mx - 9, my + 2); c.quadraticCurveTo(mx - 4, my - 3, mx, my + 2); c.quadraticCurveTo(mx + 4, my + 6, mx + 9, my + 1); c.stroke(); }
      else if (mood === 'listen') { c.ellipse(mx + 2, my, 4.5, 5, 0, 0, TAU); c.stroke(); }
      if (glasses) { c.strokeStyle = '#3a2a22'; c.lineWidth = 2.6; [-1, 1].forEach(d => { c.beginPath(); c.arc(d * ex + lk, ey, 11, 0, TAU); c.stroke(); }); strokeLine(c, [[-4 + lk, ey], [4 + lk, ey]], '#3a2a22', 2.6); }
    }
    if (H_.wrapFront) cel(c, H_.wrapFront, wrap, { dx: 6, dy: 6 });
    else if (hairStyle !== 'bald') cel(c, H_.fringe, hair, { dx: 5, dy: 6, lw: 2.2 });
    if (H_.bun) cel(c, H_.bun, hair, { dx: 4, dy: 4, lw: 2.2 });
  }
  if (back && H_.fringe && !hasWrap && hairStyle !== 'bald') { /* 背对：整颗头已是发色 */ }
  if (back && H_.bun) cel(c, H_.bun, hair, { dx: 4, dy: 4, lw: 2.2 });
  if (hat === 'helmet') drawHelmet(c, C.helmet);
  else if (hat === 'cap') { cel(c, K_.smooth([[-44, -6], [-44, -28], [-20, -50], [26, -50], [46, -26], [46, -6]], true, 0.4), C.blue, { dx: 5, dy: 6 }); cel(c, K_.ellipse(36, -6, 24, 7), K_.shade(C.blue, 0.2), { dx: 0, dy: 3, lw: 2 }); }
  else if (hat === 'straw') { cel(c, K_.ellipse(0, -30, 70, 11), '#e9d6a8', { dx: 0, dy: 4 }); cel(c, K_.smooth([[-40, -30], [-36, -62], [36, -62], [40, -30]], true, 0.4), '#e9d6a8', { dx: 5, dy: 5 }); }
  c.restore(); c.restore();
  // ---- 手臂（长袖，盖在身体前）＋手 ----
  const hands = [];
  [[Q.L, -1], [Q.R, 1]].forEach(([T0, sd]) => { const tg = [T0[0], T0[1]];
    if (walk != null) tg[0] += sd * Math.sin(walk) * 30;
    if (pose === 'speak' && sd > 0) { tg[0] += Math.sin(tt * 3) * 14; tg[1] += Math.sin(tt * 4.3) * 10; }
    if (pose === 'hold' || to === 'hold') { /* 手在胸前，不动 */ }
    const S = [sd * 62, -330 + sh], { E, Hn } = ik(S, tg, 104, 96, sd);
    cel(c, K_.taper(S, E, 40, 34, 3), cloth, { dx: 6, dy: 5 }); cel(c, K_.taper(E, Hn, 34, 28, 1), cloth, { dx: 5, dy: 5 });
    cel(c, K_.circle(Hn[0], Hn[1], 16), skin, { dx: 3, dy: 4, lw: 2.2 }); hands.push(Hn); });
  c.restore();
  const tr = (px, py) => [x + px * s * fx, y + (py + shiftY + bob) * s];
  const hl = tr(...hands[0]), hr = tr(...hands[1]);
  return { head: tr(Q.hd[0], -404 + Q.hd[1] + sh * 0.5), top: tr(Q.hd[0], -468 + Q.hd[1] + sh * 0.5), handL: hl[0] <= hr[0] ? hl : hr, handR: hl[0] <= hr[0] ? hr : hl, chest: tr(0, -270), feet: [x, y], hold: [(hl[0] + hr[0]) / 2, (hl[1] + hr[1]) / 2] };
};

// ---- 缓存：整个纸偶按「造型 + 量化后的呼吸/口型/步相/姿势混合」缓存成精灵（LRU 100 张），每帧只贴图（约 0.3ms/人，未缓存约 4ms/人）。o.cache:false 关 ----
const PSPR = new Map();
K_.person = (c, x, y, s = 1, o = {}) => {
  if (o.cache === false) return rawPerson(c, x, y, s, o);
  const { t = 0, react = -1e9, alpha = 1, flip = false, cut = null, shadow, cache, walk = null, mix = 0, ...rest } = o, fx = flip ? -1 : 1;
  const brQ = Math.round(Math.sin(t * 2.2 + x * 0.01) * 1.6 / 0.5) * 0.5, wobQ = Math.round(K_.damped(t, react, 0.1, 0.42, 0.36) * 100) / 100, spQ = o.speak ? Math.floor(Math.abs(Math.sin(t * 9 + x)) * 4) / 4 : 0,
    walkQ = walk == null ? null : Math.round(walk / TAU * 16) / 16 * TAU, mixQ = Math.round(clamp(mix) * 16) / 16, tQ = Math.round(t * 8) / 8, res = Math.max(0.2, Math.round(s * 10) / 10);
  const key = JSON.stringify(rest) + `|${brQ}|${wobQ}|${spQ}|${walkQ == null ? 'n' : Math.round(walkQ * 100)}|${mixQ}|${o.pose === 'speak' || o.to === 'speak' ? tQ : 0}|${res}`;
  let e = PSPR.get(key); if (e) { PSPR.delete(key); PSPR.set(key, e); }
  else { const cv = P.canvas(Math.ceil(600 * res), Math.ceil(600 * res)), g = cv.getContext('2d'), A = rawPerson(g, 300 * res, 560 * res, res, { ...rest, t: 0, _br: brQ, _wob: wobQ, _sp: spQ, _t: tQ, walk: walkQ, mix: mixQ, flip: false, shadow: false, alpha: 1, dseed: 5 });
    const L = p => [(p[0] - 300 * res) / res, (p[1] - 560 * res) / res]; e = { cv, res, A: { head: L(A.head), top: L(A.top), handL: L(A.handL), handR: L(A.handR), chest: L(A.chest), hold: L(A.hold) } }; PSPR.set(key, e);
    if (PSPR.size > 100) { const k0 = PSPR.keys().next().value; PSPR.get(k0).cv.width = 0; PSPR.delete(k0); } }
  c.save(); c.globalAlpha *= alpha; if (cut != null) { c.beginPath(); c.rect(-2000, -2000, 5000, 2000 + cut); c.clip(); }
  if (shadow ?? !(o.pose === 'sit')) softShadow(c, x, y + 4 * s, 78 * s, 15 * s, 0.2);
  c.translate(x, y); c.scale(fx, 1); c.drawImage(e.cv, -300 * s, -560 * s, 600 * s, 600 * s); c.restore();
  const M = p => [x + p[0] * s * fx, y + p[1] * s], hl = M(e.A.handL), hr = M(e.A.handR), a = hl[0] <= hr[0];
  return { head: M(e.A.head), top: M(e.A.top), handL: a ? hl : hr, handR: a ? hr : hl, chest: M(e.A.chest), feet: [x, y], hold: M(e.A.hold) }; };
K_.taper = (A, B, wA, wB, bulge = 0) => RIG.taper(A, B, wA, wB, bulge);

// ---------- 小纸偶（人群、椅上半身像）：缓存精灵，几十个也快 ----------
// K.mini(c, x, y, s, 衣色, {skin, hair, style short|long|bun|afro|hijab|bald, raise 0|1|2(双手), back, alpha, hop}) (x,y)=身体底边中点；s=1 约 130px 高
const MINI_STYLES = ['short', 'long', 'bun', 'afro', 'hijab', 'short', 'bald', 'long'];
const miniTex = (col, skin, hair, style, raise, back) => P.cached(`gh_mini_${col}_${skin}_${hair}_${style}_${raise}_${back}`, 400, 520, g => {
  g.scale(2, 2); g.translate(100, 230); const sm = (pts, k = 0.45) => K.smooth(pts, true, k);
  if (style === 'long') cel(g, sm([[-30, -100], [-32, -44], [32, -44], [30, -100], [0, -126]]), hair, { dx: 4, dy: 4, lw: 2.2 });
  if (style === 'afro') cel(g, K.ellipse(0, -100, 36, 34), hair, { dx: 4, dy: 4, lw: 2.2 });
  if (style === 'hijab') cel(g, sm([[-34, -96], [-34, -52], [0, -40], [34, -52], [34, -96], [24, -124], [-24, -124]], 0.4), '#E8E0F0', { dx: 5, dy: 5, lw: 2.2 });
  const arm = sd => { const p = K.taper([sd * 28, -58], [sd * 44, -126], 17, 14, 1); cel(g, p, col, { dx: 3, dy: 3, lw: 2.2 }); cel(g, K.circle(sd * 45, -130, 9), skin, { dx: 2, dy: 2, lw: 2 }); };
  const down = sd => cel(g, K.taper([sd * 32, -60], [sd * 40, -22], 17, 14, 0), col, { dx: 3, dy: 3, lw: 2.2 });
  if (raise === 2) { arm(-1); arm(1); } else if (raise === 1) { down(-1); arm(1); } else { down(-1); down(1); }
  cel(g, K.round(-34, -70, 68, 70, [30, 30, 5, 5]), col, { dx: 6, dy: 6, lw: 2.4 });
  if (back) { cel(g, K.circle(0, -96, 25), style === 'hijab' ? '#E8E0F0' : hair, { dx: 5, dy: 5, lw: 2.4 }); }
  else {
    cel(g, K.circle(0, -96, 25), skin, { dx: 5, dy: 5, lw: 2.4 });
    g.fillStyle = '#2a1a12'; [-9, 9].forEach(d => { g.beginPath(); g.arc(d, -98, 2.6, 0, TAU); g.fill(); }); g.fillStyle = 'rgba(232,110,100,.32)'; [-15, 15].forEach(d => { g.beginPath(); g.ellipse(d, -90, 5, 3.2, 0, 0, TAU); g.fill(); });
    g.strokeStyle = '#7a3a30'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(0, -90, 6, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
    if (style === 'hijab') cel(g, sm([[-26, -92], [-26, -112], [-10, -122], [10, -122], [26, -112], [26, -92], [18, -108], [0, -114], [-18, -108]], 0.4), '#E8E0F0', { dx: 4, dy: 4, lw: 2.2 });
    else if (style !== 'bald') cel(g, sm([[-26, -92], [-25, -112], [-12, -122], [10, -123], [24, -114], [26, -92], [18, -106], [4, -111], [-14, -106]], 0.4), hair, { dx: 3, dy: 4, lw: 2.2 });
    if (style === 'bun') cel(g, K.circle(0, -128, 9), hair, { dx: 2, dy: 2, lw: 2 });
  } });
K.MINI_COLS = [C.teal, C.teapot, C.gold, C.blue, C.plum, C.leaf, C.rose, '#8a6aa8'];
K.mini = (c, x, y, s, col = C.teal, o = {}) => { const { skin = K.SKINS[0], hair = '#2a1d18', style = 'short', raise = 0, back = false, alpha = 1, hop = 0 } = o;
  const tex = miniTex(col, skinOf(skin), hair, style, raise, back); c.save(); c.globalAlpha *= alpha; c.drawImage(tex, x - 100 * s, y - hop - 230 * s, 200 * s, 260 * s); c.restore(); };
// 人群：cols×rows 网格；o.raise 举手比例 0..1（按序号渐次举起，o.raiseAt 起、o.lt 配合）；o.hi 高亮序号、o.dim 其余变淡；o.appear 逐个弹入
K.crowd = (c, cx, y, cols, rows, gap, s, o = {}) => { const { seed = 3, hi = [], lt = 0, hiAt = 0, dim = 0, appear = null, raise = 0, raiseAt = 0, pal = K.MINI_COLS, hiCol = C.teapot } = o;
  for (let r = rows - 1; r >= 0; r--) for (let k = 0; k < cols; k++) { const i = r * cols + k, isH = hi.includes(i), x = cx + (k - (cols - 1) / 2) * gap + (r % 2) * gap * 0.25, yy = y - r * gap * 0.7, ss = s * (1 - r * 0.04);
    const a = appear == null ? 1 : K.pop(lt, appear + i * 0.03, 0.4); if (a <= 0) continue;
    const up = raise > 0 && lt >= raiseAt + (U.hash(i, seed + 4)) * 0.8 && U.hash(i, seed + 7) < raise ? 1 : 0;
    const col0 = pal[Math.floor(U.hash(i, seed) * pal.length)], hop = isH ? Math.max(0, -K.damped(lt, hiAt, 26, 0.5, 0.45)) : 0;
    K.mini(c, x, yy, ss * a, isH ? hiCol : col0, { skin: K.SKINS[Math.floor(U.hash(i, seed + 9) * 6)], hair: ['#2a1d18', '#1c120e', '#5a3a28', '#8a8278'][Math.floor(U.hash(i, seed + 5) * 4)], style: MINI_STYLES[Math.floor(U.hash(i, seed + 3) * MINI_STYLES.length)], raise: up ? (U.hash(i, seed + 8) < 0.2 ? 2 : 1) : 0, alpha: dim && !isH ? 1 - dim * 0.6 : 1, hop }); } };
})();

// ---------- 客厅家具：椅子（贯穿物）、圆茶几、茶壶、杯、窗、沙发、窗帘 ----------
(() => { const K_ = K, C = K_.C, { TAU } = K_, { clamp, lerp } = U, cel = K_.cel, tf = K._tf, strokeLine = K._line, softShadow = K._shadow, LINE = K.C.line, P = PAINT, wash = K._wash, cloud = K._cloud, ell = P.ellipsePts, rect = P.rectPts;
// K.chair(c, x, y, s, o) —— (x,y)=椅脚中点（地面）；坐垫面 y-148*s，椅背顶 y-310*s。
// o.state: normal | empty | tipped（翻倒）| crossed（背上贴红 X 纸牌）| raised（垫高，o.under 'crates'|'coins'，o.lift 默认 70）；o.cushion 坐垫色；o.col 木色；o.high 高背椅；o.lit 暖光；o.flip；o.dim 0..1 变冷淡
const rawChair = (c, x, y, s = 1, o = {}) => { const { state = 'normal', cushion = C.teal, col = C.wood, high = false, lit = false, dim = 0, alpha = 1 } = o, wood = dim ? K_.mix(col, C.grayBlue, dim * 0.6) : col, cu = dim ? K_.mix(cushion, C.grayBlue, dim * 0.6) : cushion;
  c.save(); c.globalAlpha *= alpha;
  const body = () => { const top = high ? -420 : -310;
    [-52, 42].forEach(px => cel(c, K_.round(px, -130, 10, 130, 3), K_.shade(wood, 0.25), { dx: 3, dy: 0, lw: 2, rim: false }));
    cel(c, K_.round(-62, top + 14, 124, -top - 14 - 124, 8), K_.shade(wood, 0.22), { dx: 0, dy: 6, lw: 2.2 });
    for (let i = 0; i < 4; i++) cel(c, K_.round(-48 + i * 28, top + 34, 14, -top - 34 - 140, 5), wood, { dx: 3, dy: 3, lw: 2, rim: false });
    cel(c, K_.round(-68, top, 136, 30, 12), K_.light(wood, 0.12), { dx: 4, dy: 6, lw: 2.4 });
    if (high) { cel(c, K_.circle(-56, top - 8, 12), wood, { dx: 2, dy: 3, lw: 2 }); cel(c, K_.circle(56, top - 8, 12), wood, { dx: 2, dy: 3, lw: 2 }); }
    cel(c, K_.round(-76, -128, 152, 22, 6), wood, { dx: 4, dy: 5, lw: 2.4 });
    [-60, 47].forEach(px => cel(c, K_.round(px, -108, 13, 110, 5), K_.light(wood, 0.08), { dx: 3, dy: 0, lw: 2.2 }));
    cel(c, K_.round(-76, -152, 152, 28, 13), cu, { dx: 4, dy: 7, lw: 2.4 }); };
  if (lit) { c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(x, y - 170 * s, 10, x, y - 170 * s, 230 * s); g.addColorStop(0, 'rgba(255,226,150,.65)'); g.addColorStop(1, 'rgba(255,226,150,0)'); c.fillStyle = g; c.fillRect(x - 240 * s, y - 420 * s, 480 * s, 520 * s); c.restore(); }
  if (state === 'tipped') {
    c.save(); softShadow(c, x + 4, y + 4, 160 * s, 14 * s, 0.22); c.restore();
    tf(c, x - 100 * s, y - 62 * s, s, Math.PI / 2 - 0.1, () => { c.translate(0, 0); body(); });
  } else {
    const lift = state === 'raised' ? (o.lift ?? 70) : 0;
    softShadow(c, x, y + 3, 86 * s, 14 * s, 0.2);
    if (state === 'raised') { if (o.under === 'coins') for (let i = 0; i < 6; i++) { const w = 120 - (i % 2) * 10; cel(c, K_.round(x - w / 2 * s + (i % 2) * 4 * s, y - (i + 1) * (lift / 6) * s, w * s, lift / 6 * s + 1, 5 * s), C.gold, { dx: 3, dy: 3, lw: 2, rim: false }); }
      else { cel(c, K_.round(x - 78 * s, y - lift * 0.5 * s, 156 * s, lift * 0.5 * s, 4), C.card, { dx: 5, dy: 5, lw: 2.4 }); cel(c, K_.round(x - 62 * s, y - lift * s, 124 * s, lift * 0.5 * s, 4), K_.light(C.card, 0.1), { dx: 5, dy: 5, lw: 2.4 }); strokeLine(c, [[x - 62 * s, y - lift * 0.75 * s], [x + 62 * s, y - lift * 0.75 * s]], 'rgba(255,240,210,.5)', 3); } }
    tf(c, x, y - lift * s, s, 0, () => { if (o.flip) c.scale(-1, 1); body();
      if (state === 'crossed') { c.save(); c.translate(0, -214); c.rotate(-0.07); cel(c, K_.round(-52, -52, 104, 104, 6), C.paper, { dx: 0, dy: 6, lw: 3 });
        strokeLine(c, [[-30, -30], [30, 30]], C.red, 16); strokeLine(c, [[30, -30], [-30, 30]], C.red, 16); c.fillStyle = 'rgba(255,244,210,.7)'; c.fillRect(-22, -62, 44, 16); c.restore(); } });
  }
  c.restore(); return { seat: [x, y - 148 * s], top: [x, y - 310 * s] }; };
const CSPR = new Map();   // 椅子精灵缓存（LRU 60）：静态，只有 lit 暖光每帧另画
K_.chair = (c, x, y, s = 1, o = {}) => { const { alpha = 1, lit = false, cache, ...rest } = o, res = Math.max(0.2, Math.round(s * 10) / 10);
  if (cache === false) return rawChair(c, x, y, s, o);
  if (lit) { c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(x, y - 170 * s, 10, x, y - 170 * s, 230 * s); g.addColorStop(0, 'rgba(255,226,150,.65)'); g.addColorStop(1, 'rgba(255,226,150,0)'); c.fillStyle = g; c.fillRect(x - 240 * s, y - 420 * s, 480 * s, 520 * s); c.restore(); }
  const key = JSON.stringify(rest) + '|' + res; let e = CSPR.get(key); if (e) { CSPR.delete(key); CSPR.set(key, e); }
  else { const cv = P.canvas(Math.ceil(520 * res), Math.ceil(580 * res)); rawChair(cv.getContext('2d'), 260 * res, 520 * res, res, { ...rest, lit: false }); e = { cv }; CSPR.set(key, e); if (CSPR.size > 60) { const k0 = CSPR.keys().next().value; CSPR.get(k0).cv.width = 0; CSPR.delete(k0); } }
  c.save(); c.globalAlpha *= alpha; c.drawImage(e.cv, x - 260 * s, y - 520 * s, 520 * s, 580 * s); c.restore(); return { seat: [x, y - 148 * s], top: [x, y - 310 * s] }; };
// K.table(c, x, y, s, o) —— (x,y)=桌面中心；圆茶几，桌面椭圆 rx=r*s、ry=0.3r*s。返回 {x, y, rx, ry}。o.r 半径(默认 300)，o.cloth 桌布奶油圈
K_.table = (c, x, y, s = 1, o = {}) => { const r = (o.r || 300) * s, ry = r * 0.3, th = 26 * s, col = o.col || C.wood;
  softShadow(c, x, y + 150 * s, r * 1.05, ry * 1.1, 0.24);
  [-0.55, 0.55].forEach(d => cel(c, K_.round(x + d * r - 12 * s, y + ry * 0.4, 24 * s, 150 * s, 5), K_.shade(col, 0.25), { dx: 4, dy: 0, lw: 2.2 }));
  cel(c, K_.smooth([...Array.from({ length: 13 }, (_, i) => [x + Math.cos(Math.PI * i / 12) * r, y + th + Math.sin(Math.PI * i / 12) * ry]), ...Array.from({ length: 13 }, (_, i) => [x - Math.cos(Math.PI * i / 12) * r, y + Math.sin(Math.PI * i / 12) * ry])].reverse(), true, 0.2), K_.shade(col, 0.2), { dx: 0, dy: 0, lw: 2.4, rim: false });
  cel(c, K_.ellipse(x, y, r, ry), K_.light(col, 0.28), { dx: 8 * s, dy: 8 * s, lw: 2.6 });
  cel(c, K_.ellipse(x, y - 2 * s, r * 0.82, ry * 0.8), K_.light(col, 0.4), { dx: 0, dy: 3, lw: 0, rim: false });
  if (o.cloth) { cel(c, K_.ellipse(x, y - 2 * s, r * 0.5, ry * 0.5), C.paper, { dx: 4, dy: 4, lw: 2 }); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; c.fillStyle = 'rgba(210,180,130,.7)'; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.42, y - 2 * s + Math.sin(a) * ry * 0.42, 3.5 * s, 2.5 * s, 0, 0, TAU); c.fill(); } }
  return { x, y, rx: r, ry }; };
// 圆地毯：(x,y)=中心，rx×ry 椭圆（地面透视），o.cols 由外到内的色环
K_.rug = (c, x, y, rx, ry, o = {}) => { const cols = o.cols || [C.teapot, C.cream, C.teal, C.cream, C.gold]; c.save(); c.globalAlpha *= o.alpha ?? 0.95;
  cols.forEach((col, i) => { const k = 1 - i * 0.12; cel(c, K_.ellipse(x, y, rx * k, ry * k), col, { dx: 0, dy: 0, lw: i ? 0 : 2.4, rim: false, sh: col }); });
  c.restore(); };
// 茶壶 (x,y)=壶底中心；o.t 给了就冒热气（cold:true 不冒）；o.col 壶色；o.tilt 倾壶倒茶（rad）
K_.teapot = (c, x, y, s = 1, o = {}) => { const col = o.col || C.teapot;
  if (o.t != null && !o.cold) steam(c, x + 8 * s, y - 100 * s, o.t, s, 3);
  tf(c, x, y, s, o.tilt || 0, () => {
    cel(c, K_.smooth([[36, -18], [78, -56], [92, -52], [58, -4]], true, 0.3), col, { dx: 3, dy: 4 }); cel(c, K_.smooth([[-38, -10], [-74, -36], [-62, -62], [-38, -44]], true, 0.3), col, { dx: 3, dy: 4 });
    cel(c, K_.ellipse(0, -36, 54, 42), col, { dx: 10, dy: 12 }); strokeLine(c, [[-38, -42], [38, -42]], 'rgba(255,240,210,.85)', 5);
    cel(c, K_.ellipse(0, -76, 30, 10), col, { dx: 3, dy: 4, lw: 2.2 }); cel(c, K_.circle(0, -88, 9), '#fff0d8', { dx: 2, dy: 2, lw: 2 }); }); };
const steam = (c, x, y, t, s, n = 2) => { c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4 * s; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { c.globalAlpha = 0.55; c.beginPath(); for (let k = 0; k <= 12; k++) { const yy = y - k * 6.5 * s, xx = x + (i - (n - 1) / 2) * 16 * s + Math.sin(k * 0.55 + t * 2.4 + i * 2) * 7 * s; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); } c.restore(); };
// 杯 (x,y)=杯底中心（带碟）；o.t 热气；o.cold 凉了（无热气、茶色发灰）；o.tipped 倒了（洒出一滩）；o.col 杯色
K_.cup = (c, x, y, s = 1, o = {}) => { const col = o.col || '#FBEED6', tea = o.cold ? '#8a7060' : '#B46A38';
  if (o.tipped) { softShadow(c, x, y + 2, 40 * s, 8 * s, 0.2); c.save(); c.fillStyle = tea; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(x + 40 * s, y + 3 * s, 34 * s, 7 * s, 0, 0, TAU); c.fill(); c.restore();
    tf(c, x, y - 18 * s, s, 1.35, () => { cel(c, K_.round(-22, -18, 44, 34, [4, 4, 12, 12]), col, { dx: 4, dy: 4, lw: 2.2 }); cel(c, K_.ellipse(0, -18, 22, 7), '#b79a78', { dx: 0, dy: 2, lw: 2 }); }); return; }
  if (o.t != null && !o.cold) steam(c, x, y - 30 * s, o.t, s, 2);
  tf(c, x, y, s, 0, () => { cel(c, K_.ellipse(0, 4, 36, 11), '#fff6e6', { dx: 3, dy: 3, lw: 2.2 }); cel(c, K_.smooth([[-22, -30], [22, -30], [16, 0], [-16, 0]], true, 0.2), col, { dx: 5, dy: 5, lw: 2.2 });
    strokeLine(c, [[22, -24], [34, -20], [30, -8], [18, -6]], LINE, 3); cel(c, K_.ellipse(0, -30, 22, 7), tea, { dx: 0, dy: 2, lw: 2, rim: false }); }); };
// 窗：(x,y)=窗中心，w×h；o.weather clear|cloud|rain|dusk|night|gray（gray＝严肃章冷灰窗）；o.t 云飘/雨
const WE = {
  clear: { sky: ['#3f8ad6', '#a9d8f2', '#d8eef4'], hill: ['#8fb4b8', '#6fa070', '#4f8a4a'], cl: '#ffffff', clN: 3, clS: 'rgba(120,145,190,.7)' },
  cloud: { sky: ['#9fb2c2', '#c6d3dc', '#e1e7ea'], hill: ['#9fb0b0', '#86a086', '#6f9070'], cl: '#eef1f3', clN: 4, clS: 'rgba(110,125,145,.8)' },
  rain: { sky: ['#74869a', '#97a8b6', '#b3c0ca'], hill: ['#8fa0a4', '#7a9486', '#648272'], cl: '#cfd6dc', clN: 4, clS: 'rgba(90,105,125,.85)', rain: 1 },
  dusk: { sky: ['#e59a70', '#f4c690', '#f9e0b4'], hill: ['#b98a8a', '#a07a6a', '#7a6a4a'], cl: '#ffe6cc', clN: 3, clS: 'rgba(200,120,110,.7)' },
  night: { sky: ['#16203f', '#27366a', '#3f5086'], hill: ['#2b3a5a', '#222f4a', '#1a2438'], cl: '#5a6a9a', clN: 0, stars: 1 },
  gray: { sky: ['#b9c1c8', '#c7ced4', '#d3d8dc'], hill: ['#aab3bb', '#9ea8b1', '#929ca6'], cl: '#d7dce0', clN: 0, city: 1 },
};
K_.window = (c, x, y, w = 420, h = 480, o = {}) => { const wk = WE[o.weather] ? o.weather : 'clear', E = WE[wk], t = o.t || 0, px = x - w / 2, py = y - h / 2;
  const sky = K_.once(`gh_wsky_${wk}_${w}_${h}`, () => P.cached(`gh_wsky_${wk}_${w}_${h}`, w, h, g => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, E.sky[0]); gr.addColorStop(0.7, E.sky[1]); gr.addColorStop(1, E.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (E.stars) { const r = U.rng(5); g.fillStyle = '#fff4d0'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(r() * w, r() * h * 0.6, 1 + r() * 1.5, 0, TAU); g.fill(); } g.fillStyle = '#fff1c0'; g.beginPath(); g.arc(w * 0.72, h * 0.24, 30, 0, TAU); g.fill(); g.fillStyle = E.sky[0]; g.beginPath(); g.arc(w * 0.72 + 12, h * 0.24 - 6, 27, 0, TAU); g.fill(); } }));
  const fg = K_.once(`gh_wfg_${wk}_${w}_${h}`, () => P.cached(`gh_wfg_${wk}_${w}_${h}`, w + 80, h + 80, g => { g.translate(40, 40); g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    const b = h * 0.78;
    if (E.city) { const r = U.rng(8); let bx = 0; while (bx < w) { const bw = 40 + r() * 50, bh = 50 + r() * 120; wash(g, rect(bx, h - bh, bw, bh + 4), r() < 0.5 ? E.hill[0] : E.hill[1], { layers: 2, alpha: 0.7, amp: 2, seed: 800 + bx | 0, edge: 0.1, blend: 'source-over' }); bx += bw + 4; } }
    else { wash(g, [[0, b], [w * 0.2, b - 40], [w * 0.5, b - 10], [w * 0.78, b - 52], [w * 1.1, b - 14], [w * 1.1, h + 10], [0, h + 10]], E.hill[0], { layers: 3, alpha: 0.5, amp: 12, seed: 31, edge: 0.1, blend: 'source-over' });
      wash(g, [[0, b + 40], [w * 0.3, b + 6], [w * 0.62, b + 34], [w * 1.1, b + 2], [w * 1.1, h + 10], [0, h + 10]], E.hill[1], { layers: 3, alpha: 0.8, amp: 10, seed: 32, edge: 0.1, blend: 'source-over' });
      const r = U.rng(77); for (let i = 0; i < 6; i++) wash(g, ell(30 + i * w / 5.5 + r() * 20, b + 6 + r() * 16, 20 + r() * 12, 16 + r() * 8, 12), E.hill[2], { layers: 3, alpha: 0.7, amp: 5, seed: 60 + i, edge: 0.12, blend: 'source-over' }); }
    g.restore();
    const fw = 16, fr = (xx, yy, ww, hh, sd) => wash(g, rect(xx, yy, ww, hh), '#fff8ea', { layers: 2, alpha: 0.95, amp: 2, seed: sd, edge: 0.2, blend: 'source-over' });
    fr(-fw, -fw, w + 2 * fw, fw, 5); fr(-fw - 6, h, w + 2 * fw + 12, 24, 6); fr(-fw, -fw, fw, h + fw + 8, 7); fr(w, -fw, fw, h + fw + 8, 8); fr(w / 2 - 6, 0, 12, h, 9); fr(0, h * 0.42, w, 10, 10); }));
  c.drawImage(sky, px, py);
  if (E.clN) { c.save(); c.beginPath(); c.rect(px, py, w, h); c.clip(); for (let i = 0; i < E.clN; i++) { const cw = 300 + (i % 2) * 80, ch = 200 + (i % 3) * 20, x0 = ((i * 190 + t * (14 + i * 4)) % (w + cw)) - cw; c.drawImage(cloud(`w${wk}${i}`, cw, ch, 11 + i * 12, E.cl, E.clS), px + x0, py + 20 + (i * 83) % (h * 0.45)); } c.restore(); }
  c.drawImage(fg, px - 40, py - 40);
  if (E.rain) { c.save(); c.beginPath(); c.rect(px, py, w, h); c.clip(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 46; i++) { const xx = px + U.hash(i, 3) * w, yy = py + ((t * 700 + U.hash(i, 5) * h * 2) % (h + 40)) - 20; c.moveTo(xx, yy); c.lineTo(xx - 6, yy + 22); } c.stroke(); c.restore(); } };
// 窗帘：(x,y)=帘顶外角，w×h；o.side 'L'|'R'（外缘在哪边）；o.t 风；o.col
K_.curtain = (c, x, y, w = 130, h = 520, t = 0, o = {}) => { const col = o.col || '#FBF0DC', gust = 0.55 + 0.45 * Math.sin(5.4 * t + (o.phase || 0)), sw = (60 + 120 * gust) * 0.5;
  c.save(); if (o.side === 'R') { c.translate(x + w, 0); c.scale(-1, 1); c.translate(-(x + w), 0); } c.translate(0, 0);
  const pts = [[x - 10, y - 20], [x + w, y - 20], [x + w * 0.86 + sw * 0.3, y + h * 0.5], [x + w * 0.98 + sw, y + h]]; const hem = []; for (let i = 0; i <= 6; i++) { const u = i / 6; hem.push([lerp(x + w * 0.98 + sw, x - 10, u), y + h + Math.sin(u * 9 + t * 6) * 5 * (1 - u * 0.3)]); }
  const p = K_.smooth([...pts, ...hem.slice(1)], true, 0.3);
  c.fillStyle = 'rgba(90,60,40,.18)'; c.save(); c.translate(12, 8); c.fill(p); c.restore();
  c.fillStyle = col; c.globalAlpha = 0.95; c.fill(p); c.globalAlpha = 1; c.save(); c.clip(p); for (let i = 1; i < 5; i++) { c.fillStyle = i % 2 ? 'rgba(150,110,80,.12)' : 'rgba(255,255,255,.3)'; c.fillRect(x + i * w / 5 - 12, y - 30, w / 8, h + 80); } c.restore();
  c.strokeStyle = 'rgba(106,74,56,.55)'; c.lineWidth = 2.4; c.stroke(p); c.restore(); };
// 沙发：(x,y)=脚底中点，o.w 宽（默认 560），o.col；o.part 'back'|'front'|'all'（人坐沙发：back → 人 → front）。坐垫面 y-148*s，与 K.person 坐姿对齐
K_.sofa = (c, x, y, s = 1, o = {}) => { const w = (o.w || 560), col = o.col || C.teal, part = o.part || 'all', hw = w / 2;
  tf(c, x, y, s, 0, () => {
    if (part !== 'front') { softShadow(c, 0, 4, hw + 20, 16, 0.22);
      cel(c, K_.round(-hw, -330, w, 240, [44, 44, 10, 10]), K_.shade(col, 0.1), { dx: 8, dy: 10 }); cel(c, K_.round(-hw - 20, -230, 64, 160, 28), col, { dx: 6, dy: 8 }); cel(c, K_.round(hw - 44, -230, 64, 160, 28), col, { dx: 6, dy: 8 }); }
    if (part !== 'back') { cel(c, K_.round(-hw + 40, -130, w - 80, 70, 14), K_.shade(col, 0.15), { dx: 6, dy: 8 }); cel(c, K_.round(-hw + 30, -164, w - 60, 44, 20), K_.light(col, 0.12), { dx: 6, dy: 8 });
      [-1, 1].forEach(sd => cel(c, K_.round(sd * (hw - 8) - 8, -90, 16, 92, 4), C.woodDk, { dx: 3, dy: 0, lw: 2, rim: false })); } }); return { seat: [x, y - 164 * s] }; };
})();

// ---------- 国际政治道具 ----------
(() => { const K_ = K, C = K_.C, { TAU } = K_, { clamp, lerp } = U, cel = K_.cel;
const tf = K._tf, softShadow = K._shadow, LINE = K.C.line;
const line = (c, pts, col, lw, a = 1) => { c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = c.lineJoin = 'round'; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); c.restore(); };
// 地球仪：(x,y)=球心，r 球半径；o.t 自转；o.stand 带铜环底座（默认 true）。陆块是示意块，不对应真实国界
const LAND = [[[-70, 30], [-60, 55], [-100, 60], [-130, 40], [-100, 15], [-80, 10]], [[-70, -5], [-40, -10], [-35, -30], [-60, -55], [-72, -35]], [[-10, 35], [30, 38], [50, 25], [40, 0], [30, -34], [10, -30], [10, 10], [-15, 15]], [[60, 40], [100, 55], [140, 48], [130, 20], [100, 10], [80, 22]], [[115, -15], [150, -20], [145, -38], [118, -34]]];
K_.globe = (c, x, y, r = 150, o = {}) => { const t = o.t || 0, spin = o.spin ?? t * 0.35, tilt = o.tilt ?? 0.38, ct = Math.cos(tilt), st = Math.sin(tilt), stand = o.stand !== false;
  const proj = (lon, lat) => { const L = (lon * Math.PI / 180) + spin, B = lat * Math.PI / 180, X = Math.cos(B) * Math.sin(L), Y0 = Math.sin(B), Z0 = Math.cos(B) * Math.cos(L); return [X, Y0 * ct - Z0 * st, Z0 * ct + Y0 * st]; };
  if (stand) { softShadow(c, x, y + r * 1.42, r * 0.8, r * 0.1, 0.22); cel(c, K_.round(x - 8, y + r * 0.9, 16, r * 0.5, 4), C.woodDk, { dx: 3, dy: 0, lw: 2, rim: false }); cel(c, K_.ellipse(x, y + r * 1.42, r * 0.5, r * 0.1), C.wood, { dx: 4, dy: 5, lw: 2.4 });
    c.save(); c.strokeStyle = C.gold; c.lineWidth = 7; c.beginPath(); c.ellipse(x, y, r * 1.1, r * 1.1, 0.2, 0.55 * Math.PI, 2.45 * Math.PI); c.stroke(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke(); c.restore(); }
  const ball = K_.circle(x, y, r); cel(c, ball, o.ocean || C.blue, { dx: r * 0.1, dy: r * 0.12, lw: 3 });
  c.save(); c.clip(ball);
  c.strokeStyle = 'rgba(255,248,230,.28)'; c.lineWidth = 2; [-60, -30, 0, 30, 60].forEach(la => { c.beginPath(); let on = false; for (let lo = -180; lo <= 180; lo += 10) { const [X, Y, Z] = proj(lo, la); if (Z > 0) { on ? c.lineTo(x + X * r, y - Y * r) : c.moveTo(x + X * r, y - Y * r); on = true; } else on = false; } c.stroke(); });
  LAND.forEach((pts, i) => { const q = pts.map(([lo, la]) => { const [X, Y, Z] = proj(lo, la), m = Math.hypot(X, Y) || 1; return Z > 0 ? [x + X * r, y - Y * r] : [x + X / m * r * 1.02, y - Y / m * r * 1.02]; });
    const vis = pts.some(([lo, la]) => proj(lo, la)[2] > 0); if (!vis) return; const p = K_.smooth(q, true, 0.4); c.fillStyle = K_.shade(i % 2 ? C.leaf : C.teal, 0.2); c.fill(p); c.save(); c.clip(p); c.translate(-r * 0.05, -r * 0.06); c.fillStyle = i % 2 ? C.leaf : C.teal; c.fill(p); c.restore(); c.strokeStyle = 'rgba(90,53,32,.55)'; c.lineWidth = 2; c.stroke(p); });
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.45, 4, x - r * 0.4, y - r * 0.45, r * 0.8); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  c.strokeStyle = LINE; c.lineWidth = 3; c.stroke(ball); };
// 彩旗串（无真实国旗，抽象色块＋条纹/圆点）：(x0,y0)→(x1,y1)，o.n 面数，o.sag 下垂，o.t 摆，o.cols
K_.pennant = (c, x0, y0, x1, y1, o = {}) => { const { n = 9, sag = 40, t = 0, cols = [C.teapot, C.teal, C.gold, C.blue, C.leaf, C.rose, C.plum], p = 1, size = 56 } = o, pt = u => [lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * Math.PI) * sag];
  const q = []; for (let i = 0; i <= 28; i++) q.push(pt(i / 28 * Math.min(1, p))); line(c, q, C.cocoaLt, 3.4);
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; if (u > p) break; const [px, py] = pt(u), sw = Math.sin(t * 2.6 + i * 1.3) * 0.08, col = cols[i % cols.length], f = K_.poly([[-size * 0.5, 0], [size * 0.5, 0], [0, size * 1.25]]);
    tf(c, px, py, 1, sw, () => { cel(c, f, col, { dx: 4, dy: 5, lw: 2.2 }); c.save(); c.clip(f); const m = i % 3; if (m === 0) { line(c, [[-30, size * 0.3], [30, size * 0.3]], 'rgba(255,248,230,.8)', 6); } else if (m === 1) { c.fillStyle = 'rgba(255,248,230,.8)'; c.beginPath(); c.arc(0, size * 0.32, 7, 0, TAU); c.fill(); } else line(c, [[-20, 0], [0, size * 0.9]], 'rgba(255,248,230,.55)', 6); c.restore(); }); } };
// 法槌：(x,y)=底座块中心；o.k 0..1 敲下进度（0 举起，1 敲实）；o.impact 冲击线
K_.gavel = (c, x, y, s = 1, o = {}) => { const k = o.k ?? 1, rot = lerp(-0.95, 0.04, MO.cubicIn ? MO.cubicIn(clamp(k)) : clamp(k) ** 2);
  tf(c, x, y, s, 0, () => { cel(c, K_.ellipse(0, 8, 70, 16), C.woodDk, { dx: 3, dy: 5, lw: 2.4 }); cel(c, K_.round(-52, -20, 104, 30, 10), C.wood, { dx: 5, dy: 6, lw: 2.4 });
    c.save(); c.translate(-40, -26); c.rotate(rot - 0.1); cel(c, K_.round(0, -7, 190, 14, 6), C.woodLt, { dx: 3, dy: 4, lw: 2.2 }); cel(c, K_.round(150, -34, 64, 68, 14), C.woodDk, { dx: 6, dy: 8, lw: 2.6 }); cel(c, K_.round(146, -20, 8, 40, 3), C.gold, { dx: 2, dy: 2, lw: 1.6, rim: false }); cel(c, K_.round(208, -20, 8, 40, 3), C.gold, { dx: 2, dy: 2, lw: 1.6, rim: false }); c.restore();
    if (o.impact && k >= 1) { c.strokeStyle = C.red; c.lineWidth = 6; c.lineCap = 'round'; [-0.9, -0.45, 0, 0.45, 0.9].forEach(a => { c.beginPath(); c.moveTo(Math.sin(a) * 70, -50 - Math.cos(a) * 50); c.lineTo(Math.sin(a) * 100, -50 - Math.cos(a) * 80); c.stroke(); }); } }); };
// 文件：(x,y)=纸中心；o.w,h,rot,lines 行数,title 小标题（GB2312），o.seal 红印圈，o.col 纸色，o.seed
K_.paper = (c, x, y, s = 1, o = {}) => { const { w = 240, h = 320, rot = 0, lines = 7, title = '', col = C.paper, seed = 3, seal = false, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; tf(c, x, y, s, rot, () => { c.fillStyle = 'rgba(90,50,30,.22)'; c.fill(K_.round(-w / 2 + 6, -h / 2 + 12, w, h, 6));
    const fold = 40, p = K_.poly([[-w / 2, -h / 2], [w / 2 - fold, -h / 2], [w / 2, -h / 2 + fold], [w / 2, h / 2], [-w / 2, h / 2]]); cel(c, p, col, { dx: 4, dy: 6, lw: 2.6 });
    cel(c, K_.poly([[w / 2 - fold, -h / 2], [w / 2, -h / 2 + fold], [w / 2 - fold, -h / 2 + fold]]), K_.shade(col, 0.12), { dx: 0, dy: 0, lw: 2, rim: false });
    let yy = -h / 2 + 34; if (title) { K_.text(c, title, -w / 2 + 28, yy + 4, { size: 34, fam: 'PuHui-Heavy', align: 'left', halo: false, maxW: w - 60 }); yy += 46; }
    for (let i = 0; i < lines; i++) { const L = (w - 56) * (i === lines - 1 ? 0.5 : 0.7 + 0.3 * U.hash(i, seed)); c.fillStyle = 'rgba(106,74,56,.5)'; c.fillRect(-w / 2 + 28, yy + i * ((h / 2 - 20 - yy) / lines), L, 8); }
    if (seal) { c.save(); c.translate(w * 0.22, h * 0.3); c.rotate(-0.2); c.strokeStyle = C.red; c.fillStyle = 'rgba(184,69,60,.12)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.fill(); c.stroke(); c.restore(); } }); c.restore(); };
// 盖章：(x,y)=印迹中心；o.text（≤4 字 GB2312），o.p 0..1 盖下进度（砸入后落定），o.col，o.rot，o.size
K_.stamp = (c, x, y, s = 1, o = {}) => { const { text = '批准', col = C.red, rot = -0.12, size = 62, p = 1 } = o; if (p <= 0) return; const k = MO.slamK(clamp(p), 1.5, 0.94);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * k, s * k); c.globalAlpha *= clamp(p * 4) * 0.92; const a = [...text], w = a.length * size + 46, h = size + 40;
  c.strokeStyle = col; c.lineWidth = 8; c.strokeRect(-w / 2, -h / 2, w, h); c.lineWidth = 3; c.strokeRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
  c.fillStyle = col; c.font = `${size}px "PuHui-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 4);
  c.globalCompositeOperation = 'destination-out'; const r = U.rng(41); for (let i = 0; i < 22; i++) { c.globalAlpha = 0.35; c.fillRect((r() - 0.5) * w, (r() - 0.5) * h, 3 + r() * 5, 2 + r() * 3); } c.restore(); };
// 选票：(x,y)=票中心；o.mark 'yes'|'no'|'abs'|null，o.p 画出进度，o.rot；K.ballotBox 选票箱（o.slip 0..1 票滑进口）
K_.ballot = (c, x, y, s = 1, o = {}) => { const { mark = 'yes', p = 1, rot = 0 } = o; tf(c, x, y, s, rot, () => { c.fillStyle = 'rgba(90,50,30,.22)'; c.fill(K_.round(-52, -64, 110, 140, 6)); cel(c, K_.round(-55, -70, 110, 140, 6), C.paper, { dx: 4, dy: 6, lw: 2.6 });
  for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(106,74,56,.4)'; c.fillRect(-38, -48 + i * 18, 76 - i * 10, 6); }
  c.strokeStyle = LINE; c.lineWidth = 2.4; c.strokeRect(-20, 10, 40, 40);
  if (mark && p > 0) { c.lineCap = c.lineJoin = 'round'; c.lineWidth = 9; if (mark === 'yes') { c.strokeStyle = C.teal; c.beginPath(); c.moveTo(-18, 30); c.lineTo(-4, 46); c.lineTo(lerp(-4, 30, clamp(p)), lerp(46, 0, clamp(p))); c.stroke(); } else if (mark === 'no') { c.strokeStyle = C.red; line(c, [[-18, 14], [lerp(-18, 18, clamp(p * 2)), lerp(14, 46, clamp(p * 2))]], C.red, 9); if (p > 0.5) line(c, [[18, 14], [lerp(18, -18, clamp(p * 2 - 1)), lerp(14, 46, clamp(p * 2 - 1))]], C.red, 9); } else { c.strokeStyle = C.slate; c.beginPath(); c.arc(0, 30, 14, 0, TAU * clamp(p)); c.stroke(); } } }); };
K_.ballotBox = (c, x, y, s = 1, o = {}) => { const slip = o.slip ?? 1; tf(c, x, y, s, 0, () => { softShadow(c, 0, 4, 120, 14, 0.2);
  if (slip < 1) { c.save(); c.beginPath(); c.rect(-200, -500, 400, 420); c.clip(); c.translate(0, lerp(-250, -120, slip * slip)); c.rotate(-0.08 * (1 - slip)); c.scale(0.9, 0.9); cel(c, K_.round(-50, -50, 100, 100, 5), C.paper, { dx: 3, dy: 5, lw: 2.4 }); line(c, [[-20, 0], [-6, 16], [22, -22]], C.teal, 8); c.restore(); }
  cel(c, K_.round(-110, -150, 220, 150, 10), o.col || C.blue, { dx: 9, dy: 8, lw: 2.8 }); cel(c, K_.round(-120, -174, 240, 30, 8), C.woodLt, { dx: 4, dy: 5, lw: 2.6 }); c.fillStyle = C.cocoa; c.fill(K_.round(-62, -163, 124, 10, 5)); cel(c, K_.circle(0, -74, 30), C.paper, { dx: 3, dy: 4, lw: 2.2 }); }); };
// 硬币 (x,y)=中心，r 半径；o.rot 绕竖轴翻转角（压扁）；K.coinStack 一摞（n 枚）；K.moneybag 钱袋（o.label ≤2 字）
K_.coin = (c, x, y, r = 40, o = {}) => { const k = Math.abs(Math.cos(o.rot || 0)) * 0.96 + 0.04; tf(c, x, y, 1, o.tilt || 0, () => { c.scale(k, 1); cel(c, K_.circle(0, 0, r), C.gold, { dx: r * 0.12, dy: r * 0.14, lw: 2.8 }); c.strokeStyle = 'rgba(106,74,56,.55)'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, r * 0.7, 0, TAU); c.stroke();
  if (k > 0.5) { c.fillStyle = 'rgba(106,74,56,.55)'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r * 0.16 : r * 0.38; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); } }); };
K_.coinStack = (c, x, y, r = 40, n = 5, o = {}) => { for (let i = 0; i < n; i++) { const yy = y - i * r * 0.28, xx = x + (U.hash(i, 7) - 0.5) * r * 0.16; cel(c, K_.smooth([[xx - r, yy - r * 0.34], [xx + r, yy - r * 0.34], [xx + r, yy], [xx - r, yy]].map((q, j) => q), true, 0.1), C.gold, { dx: 3, dy: 3, lw: 2.2, rim: false }); cel(c, K_.ellipse(xx, yy - r * 0.34, r, r * 0.3), K_.light(C.gold, 0.2), { dx: 3, dy: 3, lw: 2.2, rim: false }); } };
K_.moneybag = (c, x, y, s = 1, o = {}) => { tf(c, x, y, s, o.rot || 0, () => { const col = o.col || '#CFA46A'; softShadow(c, 0, 4, 86, 12, 0.2);
  cel(c, K_.smooth([[-30, -190], [30, -190], [44, -150], [96, -80], [90, -24], [50, 0], [-50, 0], [-90, -24], [-96, -80], [-44, -150]], true, 0.4), col, { dx: 10, dy: 10, lw: 2.8 });
  cel(c, K_.smooth([[-42, -196], [-30, -222], [-8, -204], [0, -226], [8, -204], [30, -222], [42, -196], [30, -176], [-30, -176]], true, 0.3), K_.light(col, 0.1), { dx: 3, dy: 4, lw: 2.4 }); line(c, [[-34, -178], [34, -178]], C.teapot, 9);
  if (o.label) K_.text(c, o.label, 0, -80, { size: 58, fam: 'PuHui-Black', halo: false, col: C.cocoa, maxW: 110 }); else { c.fillStyle = 'rgba(90,53,32,.6)'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? 12 : 30; c.lineTo(Math.cos(a) * rr, -80 + Math.sin(a) * rr); } c.closePath(); c.fill(); } }); };
// 蓝盔：(x,y)=头盔底沿中点；s=1 宽约 106px；o.rot；o.glow 淡蓝光晕
K_.helmet = (c, x, y, s = 1, o = {}) => { tf(c, x, y, s, o.rot || 0, () => { if (o.glow) { c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(0, -30, 5, 0, -30, 110); g.addColorStop(0, 'rgba(180,220,250,.6)'); g.addColorStop(1, 'rgba(180,220,250,0)'); c.fillStyle = g; c.fillRect(-120, -150, 240, 240); c.restore(); } K_.drawHelmet(c, o.col || C.helmet); }); };
// 纸板贴片：(x,y)=左上，w×h；o.rot，o.col 纸板色（默认牛皮纸），o.title，o.tape 两条胶带（默认 true）
K_.board = (c, x, y, w, h, o = {}) => { const { rot = 0, col = C.card, title = '', tape = true, alpha = 1, shadow = true } = o; c.save(); c.globalAlpha *= alpha; c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot);
  if (shadow) { c.fillStyle = 'rgba(70,40,24,.26)'; c.fill(K_.round(-w / 2 + 6, -h / 2 + 12, w, h, 6)); }
  cel(c, K_.round(-w / 2, -h / 2, w, h, 6), col, { dx: 5, dy: 7, lw: 3, rim: false });
  if (tape) [-1, 1].forEach(sd => { c.save(); c.translate(sd * (w / 2 - 36), -h / 2 + 4); c.rotate(sd * 0.5); c.fillStyle = 'rgba(255,244,205,.7)'; c.fillRect(-34, -12, 68, 24); c.strokeStyle = 'rgba(160,130,90,.5)'; c.lineWidth = 1.6; c.strokeRect(-34, -12, 68, 24); c.restore(); });
  if (title) K_.text(c, title, 0, -h / 2 + 52, { size: 46, fam: 'PuHui-Heavy', halo: false, col: C.cocoa, maxW: w - 80 }); c.restore(); };
// 纸板柱状图（示意）：(x,y)=基线左端，w 总宽，h 最高柱高；vals 0..1；p 长高进度；o.labels 下方字，o.show 柱顶数字（字符串数组），o.cols，o.hi 高亮第几根，o.card 底板（默认 true），o.title，o.note
K_.bars = (c, x, y, w, h, vals, p, o = {}) => { const { labels = [], show = [], cols = [C.teal, C.teapot, C.gold, C.blue, C.plum], hi = -1, card = true, title = '', note = '示意', gapK = 0.45 } = o, n = vals.length, bw = w / (n + (n - 1) * gapK);
  if (card) K_.board(c, x - 56, y - h - (title ? 120 : 70), w + 112, h + (title ? 120 : 70) + 110, { title, rot: o.rot || 0, alpha: clamp(p * 6 + 0.001) });
  line(c, [[x - 20, y], [x + w + 20, y]], C.cocoa, 5);
  vals.forEach((v, i) => { const q = MO.cubicOut(clamp(p * 1.3 - i * 0.12)), bh = h * v * q, bx = x + i * bw * (1 + gapK); if (bh > 2) { cel(c, K_.round(bx, y - bh, bw, bh, [8, 8, 0, 0]), i === hi ? C.red : cols[i % cols.length], { dx: 6, dy: 0, lw: 2.8, rim: false });
    if (show[i] && q > 0.95) K_.text(c, show[i], bx + bw / 2, y - bh - 34, { size: 40, fam: 'PuHui-Heavy', halo: false, col: C.cocoa, maxW: bw * 1.4 }); }
    if (labels[i]) K_.text(c, labels[i], bx + bw / 2, y + 44, { size: 38, fam: 'PuHui-Heavy', halo: false, col: C.cocoa, maxW: bw * 1.35, alpha: clamp(p * 3) }); });
  if (note) K_.tag(c, note, x + w - 30, y - h - (title ? 76 : 26), { size: 30, fill: C.creamLt, shadow: false, alpha: clamp(p * 3) }); };
// 纸板比例条：parts [[份额, 色, 标签]]，p 进度；(x,y)=条左端中线
K_.split = (c, x, y, w, h, parts, p, o = {}) => { let acc = 0; const tot = parts.reduce((a, q) => a + q[0], 0); c.save(); c.beginPath(); c.rect(x - 4, y - h, w * MO.cubicOut(clamp(p)) + 8, 2 * h); c.clip();
  parts.forEach(([v, col]) => { const ww = w * v / tot; cel(c, K_.round(x + acc, y - h / 2, ww, h, 4), col, { dx: 4, dy: 5, lw: 2.8, rim: false }); acc += ww; }); c.restore();
  acc = 0; parts.forEach(([v, col, lab]) => { const ww = w * v / tot; if (lab && p > 0.6) K_.text(c, lab, x + acc + ww / 2, y + h / 2 + 44, { size: 40, fam: 'PuHui-Heavy', alpha: K_.at(p, 0.6, 0.3), maxW: Math.max(ww, 120) }); acc += ww; }); };
// 纸箭头：p 画出进度；bend 弯曲
K_.arrow = (c, x0, y0, x1, y1, p = 1, o = {}) => { const { col = C.teapot, w = 20, bend = 0.18, head = 46 } = o; if (p <= 0) return;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, cx = mx - (y1 - y0) * bend, cy = my + (x1 - x0) * bend, pt = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
  const end = Math.max(0.03, p), pts = []; for (let i = 0; i <= 36; i++) pts.push(pt(end * i / 36 * 0.95)); const [ex, ey] = pt(end), [qx, qy] = pt(Math.max(0, end - 0.04)), an = Math.atan2(ey - qy, ex - qx);
  c.save(); line(c, pts, LINE, w + 7); line(c, pts, col, w); c.translate(ex, ey); c.rotate(an); const hp = K_.smooth([[6, 0], [-head, -head * 0.66], [-head * 0.7, 0], [-head, head * 0.66]], true, 0.12); cel(c, hp, col, { dx: 3, dy: 4, lw: 3, rim: false }); c.restore(); };
// 时间轴：棉线＋纸牌站；cur 当前站高亮
K_.timeline = (c, x0, x1, y, labels, cur = -1, p = 1, o = {}) => { const n = labels.length, X = i => lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5); line(c, [[x0, y], [lerp(x0, x1, MO.cubicOut(clamp(p))), y]], C.cocoaLt, 7);
  labels.forEach((s, i) => { const q = clamp(p * n - i); if (q <= 0) return; const on = i === cur; cel(c, K_.circle(X(i), y, (on ? 24 : 15) * MO.backOut(q, 1.6)), on ? C.teapot : C.gold, { dx: 4, dy: 4, lw: 2.6, rim: false });
    K_.text(c, s, X(i), y + (i % 2 ? -64 : 66), { size: on ? 48 : 42, fam: 'PuHui-Heavy', col: on ? C.red : C.cocoa, alpha: q, maxW: (x1 - x0) / Math.max(1, n - 1) * 1.6 }); }); };
})();

// ---------- 章节卡：一圈椅子逐把被坐满，当前章椅子点亮 ----------
// 上方「第 N 章」纸标签＋章名逐字出；下方 N 把椅子围成一圈（章数来自 BOOK_META.chapters），前 n-1 把已坐满小纸偶，第 n 把点亮、纸偶在 ~0.8s 弹入，其余空着。
// 每章底色：K.CARD_KINDS = { 10: 'cool' }（章号 → kind，在本书 props.js 里设）；默认 cream。
(() => { const K_ = K, C = K_.C, { W, TAU } = K_, { clamp, lerp } = U;
K_.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K_.CARD_KINDS = K_.CARD_KINDS || {};
K_.chapterCard = (c, lt, t, n, title = '') => {
  const kind = K_.CARD_KINDS[n] || 'cream', cold = kind === 'cool', N = Math.max(K_.CHAPTER_NAMES.length, n, 2);
  K_.bg(c, t, { kind, seed: 900 + (kind === 'cool' ? 1 : 0), light: !cold });
  if (!cold) K_.pennant(c, -20, 150, W + 20, 150, { n: 11, sag: 54, t, p: K_.at(lt, 0, 0.6) });
  const cx = 540, cy = 1190, rx = 420, ry = 150, order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.sin(Math.PI + a / N * TAU) - Math.sin(Math.PI + b / N * TAU));
  const pos = i => { const a = Math.PI + i / N * TAU, sn = Math.sin(a); return { x: cx + Math.cos(a) * rx, y: cy + sn * ry, sn, s: 0.44 + 0.2 * (sn + 1) / 2 }; };
  const seat = (i, p0) => { const p = pos(i), done = i < n - 1, cur = i === n - 1, back = p.sn > 0.2, a = cur ? K_.pop(lt, 0.8, 0.5) : 1;
    const col = K_.MINI_COLS[i % K_.MINI_COLS.length], sk = K_.SKINS[Math.floor(U.hash(i, 77) * 6)], hr = ['#2a1d18', '#1c120e', '#5a3a28', '#8a8278'][Math.floor(U.hash(i, 78) * 4)], st = ['short', 'long', 'bun', 'afro', 'hijab', 'short', 'bald'][Math.floor(U.hash(i, 79) * 7)];
    const mini = () => { if ((done || cur) && a > 0) K_.mini(c, p.x, p.y - 136 * p.s, p.s * 1.25 * a, col, { skin: sk, hair: hr, style: st, back, raise: 0 }); };
    if (!back) { K_.chair(c, p.x, p.y, p.s, { lit: cur && lt > 0.5, cushion: done || cur ? C.teapot : C.cream, dim: done || cur ? 0 : (cold ? 0.4 : 0.15) }); mini(); } else { mini(); K_.chair(c, p.x, p.y, p.s, { lit: cur && lt > 0.5, cushion: done || cur ? C.teapot : C.cream, dim: done || cur ? 0 : 0.15 }); } };
  K_.rug(c, cx, cy + 20, 520, 215, cold ? { cols: ['#8f9ba6', '#d3d9df', '#73838f', '#d3d9df', '#a2adb7'] } : {});
  const mid = order.findIndex(i => pos(i).sn > -0.05);
  order.slice(0, mid < 0 ? N : mid).forEach(i => seat(i));
  K_.table(c, cx, cy - 6, 0.55, { r: 300, cloth: true }); K_.teapot(c, cx, cy - 12, 0.6, { t });
  order.slice(mid < 0 ? N : mid).forEach(i => seat(i));
  if (lt > 0.8) { const p = pos(n - 1); c.save(); c.strokeStyle = 'rgba(217,83,74,.8)'; c.lineWidth = 5; const k = MO.cubicOut(K_.at(lt, 0.85, 0.7)); c.globalAlpha = 1 - k; c.beginPath(); c.ellipse(p.x, p.y - 150 * p.s, 70 * p.s + k * 70, 90 * p.s + k * 70, 0, 0, TAU); c.stroke(); c.restore(); }
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); K_.tag(c, `第 ${n} 章`, W / 2, 440, { size: 62, fam: 'PuHui-Black', fill: C.teapot, col: '#FFF8EA', scale: s }); }
  const lines = K_.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K_.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 7 ? 104 : 124;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K_.text(c, a.slice(0, k).join(''), W / 2, (lines.length > 1 ? 585 : 640) + i * size * 1.25, { size, fam: 'PuHui-Black', maxW: 940 }); });
  K_.finish(c);
};
})();
