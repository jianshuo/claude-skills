// 画风套件 raytrace（配方 huashu-art-motion 15_raytrace「早期光追 CGI」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：近黑深炭（或暖米灰）平色天＋细线框地平线网格；逐像素透视棋盘地面（奶白/石墨，缓存）；
//       物件都是「塑料/铬」：底色→径向高光→一颗硬边高光，厚度向右下挤出；齿轮/流程框/卡片/漏斗/回路/人形都是塑料块；铬球做环境映射映到棋盘。
//       红=变异、青绿=选择、黄=复制；不用蓝紫、不用渐变天、不用霓虹外发光。倒影只给物体（球、齿轮、块），文字不做镜像倒影。
//       字：PuHui-Black（标题/标签）、PuHui-Bold（字幕）、Poppins-800（数字）；立体字＝深色描边＋向右下错位厚度。标签 ≥52。
// 坐标：y 200–1350 画主体；y 1380–1560 字幕带不放东西；全部确定性（不用 Math.random）。
// 性能：舞台/地面缓存一次；K.reflect 每次调用一张 1080×≤760 的半幅层；铬球逐帧算 ≤220px 的小精灵再放大（同屏 ≤2 个）。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：pop 回弹起步段会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  red: '#dd3333', teal: '#1f9d8f', yel: '#e8b923', ink: '#16181b', char: '#202327', graphite: '#33373c', steel: '#8b9096', chrome: '#d6d9dc',
  cream: '#ece5d3', beige: '#d8cfba', white: '#f6f3ea', redDk: '#8f1f1f', tealDk: '#146a60', yelDk: '#9c7a10',
};
C.yellow = C.yel; C.green = C.teal; C.cyan = C.teal; C.grey = C.steel; C.paper = C.cream; C.black = C.ink;
const INK = C.ink, RED = C.red, TEAL = C.teal, YEL = C.yel, CREAM = C.cream, WHITE = C.white, GRAPH = C.graphite;
K.TINTS = { red: RED, teal: TEAL, green: TEAL, yellow: YEL, yel: YEL, ink: INK, cream: CREAM, graphite: GRAPH };
const tintCol = t => K.TINTS[t] || t || null;
const hx = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const isHex = s => typeof s === 'string' && s[0] === '#';
const shade = (h, k) => isHex(h) ? `rgb(${hx(h).map(x => Math.round(clamp(x * k, 0, 255))).join(',')})` : h;
const mixW = (h, k) => isHex(h) ? `rgb(${hx(h).map(x => Math.round(lerp(x, 255, k))).join(',')})` : h;
const onCol = f => { if (!isHex(f)) return WHITE; const [r, g, b] = hx(f); return (r * 0.3 + g * 0.59 + b * 0.11) > 165 ? INK : WHITE; };

K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);

// ============ 塑料着色 / 厚度挤出 ============
// plastic：底色→径向高光（左上）→边缘压暗（暖黑，不带紫）→一颗硬边椭圆高光。(hx_,hy_) 高光中心，R 影响半径
function plastic(c, path, base, hx_, hy_, R, { dark = 0.4, spec = 0.8, specR = 0.14 } = {}) {
  if (!(R > 0)) return;
  c.fillStyle = base; c.fill(path); c.save(); c.clip(path);
  const g = c.createRadialGradient(hx_, hy_, 0, hx_ + R * 0.25, hy_ + R * 0.3, R);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.28, 'rgba(255,255,255,.06)'); g.addColorStop(0.62, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(14,10,6,${dark})`);
  c.fillStyle = g; c.fillRect(hx_ - R * 3, hy_ - R * 3, R * 6, R * 6);
  if (spec) { c.fillStyle = `rgba(255,255,255,${spec})`; c.beginPath(); c.ellipse(hx_, hy_, R * specR, R * specR * 0.55, -0.5, 0, TAU); c.fill(); }
  c.restore();
}
// 沿 (dx,dy) 方向把 path 叠 depth 层，越深越暗
const ext = (c, p, col, depth, dx = 0.72, dy = 0.72) => { const st = depth > 34 ? 2 : 1;
  for (let i = depth; i >= 1; i -= st) { c.save(); c.translate(i * dx, i * dy); c.fillStyle = shade(col, 0.3 + 0.2 * (1 - i / depth)); c.fill(p); c.restore(); } };
const solid = (c, p, col, depth, R, o = {}) => { ext(c, p, col, depth); plastic(c, p, col, -R * 0.3, -R * 0.38, R * 1.5, { dark: 0.34, spec: 0.7, specR: 0.1, ...o }); };
// 通用 o：{ alpha, scale（绕中心）, rot }
const wrap = (c, cx, cy, o, fn) => { c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(cx, cy); if (o.rot) c.rotate(o.rot); if (o.scale != null && o.scale !== 1) c.scale(Math.max(0, o.scale), Math.max(0, o.scale)); fn(); c.restore(); };
K.plastic = plastic; K.shade = shade;

// ============ 文字 ============
// 立体字：深色描边＋向右下错位厚度，不做倒影。o: { size, fam, col(白), align, alpha, scale, track, maxW, rot, depth（默认约 size*.08）, ext（侧面色）, edge（描边色）, stroke（描边宽）}
K.text = (c, s, x, y, o = {}) => { if (K._refl) return; const { size = 64, fam = 'PuHui-Black', col = WHITE, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  const depth = o.depth ?? Math.round(clamp(size * 0.08, 2, 16)), edge = o.edge || INK, side = o.ext || '#4b5057', sw = o.stroke ?? Math.max(4, size * 0.11);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = sw;
  for (let i = depth; i >= 1; i--) { c.strokeStyle = side; c.fillStyle = side; c.strokeText(s, i * 0.8, i * 0.8); c.fillText(s, i * 0.8, i * 0.8); }
  c.strokeStyle = edge; c.strokeText(s, 0, 0); c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—（'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };

// ============ 舞台：天 + 棋盘地面（缓存） ============
// K.stage(c, t, o)：o: { hor 地平线 y（默认 560；主体放 y200–1350）, sky 'dark'|'warm', tx 方格横向宽, tz 纵深密度, floor false 只要天 }
const SKYC = { dark: '#15171a', warm: '#d8cfba' };
const paintStage = (g, hor, sky, tx, tz, withFloor) => {
  const sc = SKYC[sky] || SKYC.dark, dk = sky !== 'warm';
  g.fillStyle = sc; g.fillRect(0, 0, W, H);
  // 细线框地平线网格：单色、极淡，向上渐隐
  g.lineWidth = 1.5; const lc = dk ? '236,230,214' : '40,40,44';
  for (let j = 1; j <= 14; j++) { const y = hor - 0.55 * j * j * 0.9 - 4 * j; if (y < 0) break; g.strokeStyle = `rgba(${lc},${0.2 * (1 - j / 15)})`; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const vg = g.createLinearGradient(0, hor, 0, hor - 190); vg.addColorStop(0, `rgba(${lc},.22)`); vg.addColorStop(1, `rgba(${lc},0)`); g.strokeStyle = vg;
  for (let x = -60; x <= W + 60; x += 60) { g.beginPath(); g.moveTo(540 + (x - 540) * 1.0, hor); g.lineTo(540 + (x - 540) * 1.18, hor - 190); g.stroke(); }
  if (!withFloor) return;
  const im = g.createImageData(W, H - hor), d = im.data, A = hx(dk ? '#e6dfcc' : '#efe8d6'), B = hx(dk ? '#34383d' : '#4a4c4f'), F = hx(sc);
  for (let y = hor; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = 0; k < 4; k++) { const yy = y + (k >> 1) * 0.5 + 0.25, xx = x + (k & 1) * 0.5 + 0.25, dy = yy - hor; s += ((Math.floor((xx - 540) / dy / tx + 0.5) + Math.floor(1 / dy / tz)) & 1); }
    const q = s / 4, i = ((y - hor) * W + x) * 4, f = Math.pow(clamp(1 - (y - hor) / 240), 1.4) * 0.92;
    for (let ch = 0; ch < 3; ch++) d[i + ch] = lerp(lerp(A[ch], B[ch], q), F[ch], f);
    d[i + 3] = 255;
  }
  g.putImageData(im, 0, hor);
  g.fillStyle = `rgba(${lc},.5)`; g.fillRect(0, hor - 1, W, 2);
};
K.stage = (c, t, o = {}) => { const hor = o.hor ?? 560, sky = o.sky || 'dark', tx = o.tx ?? 0.36, tz = o.tz ?? 0.0013, fl = o.floor !== false;
  c.drawImage(P.cached(`rt_stage_${hor}_${sky}_${tx}_${tz}_${fl ? 1 : 0}`, W, H, g => paintStage(g, hor, sky, tx, tz, fl)), 0, 0); K.hor = hor; };
K.bg = (c, t, o = {}) => K.stage(c, t, o);
// 地面透视缩放：y 越靠近地平线越小，y=1100 时为 1（摆物件按它缩放，远近自然）
K.scaleAt = (y, hor = K.hor ?? 560) => Math.max(0.05, (y - hor) / (1100 - hor));
K.shadow = (c, x, y, rx, ry = rx * 0.26, a = 0.5) => { if (rx <= 0) return; c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); };

// ============ 倒影 ============
// K.reflect(c, gy, fade, draw, o)：gy 接地线 y，fade 倒影下探高度（≤760），draw(ctx) 用世界坐标把物体画进 ctx（同正画一样），o.alpha 起始不透明度（默认 .42）。文字在倒影里自动略过
let RL = null, RM = null; const RH = 760;
K.reflect = (c, gy, fade, draw, o = {}) => { fade = Math.min(fade, RH); if (fade <= 4) return; if (!RL) { RL = P.canvas(W, RH); RM = P.canvas(W, RH); }
  const l = RL.getContext('2d'), m = RM.getContext('2d');
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalAlpha = 1; l.clearRect(0, 0, W, RH); K._refl = true; try { l.save(); l.translate(0, fade - gy); draw(l); l.restore(); } finally { K._refl = false; }
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1; m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, W, RH);
  m.save(); m.translate(0, fade); m.scale(1, -1); m.drawImage(RL, 0, 0, W, fade, 0, 0, W, fade); m.restore();
  m.save(); m.globalCompositeOperation = 'destination-in'; const fg = m.createLinearGradient(0, 0, 0, fade); fg.addColorStop(0, `rgba(0,0,0,${o.alpha ?? 0.42})`); fg.addColorStop(1, 'rgba(0,0,0,0)'); m.fillStyle = fg; m.fillRect(0, 0, W, fade); m.restore();
  c.drawImage(RM, 0, 0, W, fade, 0, gy, W, fade); };

// ============ 球：铬 / 塑料 ============
// K.sphere(c, x, y, r, o)：o: { kind 'chrome'|'plastic', col（塑料色）, spin（铬球环境旋转，弧度，常传 t*2；不转球体本身）, shadow（地面 y，传了就画接触阴影）, alpha, scale }
// 铬球：每帧在 ≤220px 小精灵上逐像素环境映射（下半球映棋盘，上半球映暗天＋一块柔光箱）再放大；同屏 ≤2 个
let SP = null;
K.sphere = (c, x, y, r, o = {}) => { if (!(r > 0)) return; if (o.shadow != null) K.shadow(c, x, o.shadow, r * 1.05, r * 0.28, 0.5);
  wrap(c, x, y, { alpha: o.alpha, scale: o.scale }, () => {
    if ((o.kind || 'chrome') === 'plastic') { const col = o.col || RED; const p = K.circle(0, 0, r); plastic(c, p, col, -r * 0.35, -r * 0.4, r * 1.7, { dark: 0.5, spec: 0.85, specR: 0.13 });
      c.save(); c.clip(p); c.strokeStyle = 'rgba(236,229,211,.16)'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, r * 0.05, r * 0.98, 0.15, Math.PI - 0.15); c.stroke(); c.restore(); return; }
    const D = Math.max(8, Math.min(Math.ceil(r * 2), 220)), rot = o.spin ?? o.rot ?? 0; if (!SP) SP = P.canvas(224, 224);
    const g = SP.getContext('2d'), im = g.createImageData(D, D), d = im.data, hr = D / 2;
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const nx = (i + 0.5 - hr) / hr, ny = (j + 0.5 - hr) / hr, q = nx * nx + ny * ny, k4 = (j * D + i) * 4; if (q >= 1.02) continue;
      const nz = Math.sqrt(Math.max(0, 1 - q)), rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1; let cr, cg, cb;
      if (ry > 0.03) { const ck = (Math.floor((rx / ry * 1.5 + rot) * 2) + Math.floor(rz / ry * 1.5 * 2)) & 1, fg = clamp(ry / 0.45); const a = ck ? [48, 52, 58] : [232, 226, 210];
        cr = lerp(120, a[0], fg); cg = lerp(122, a[1], fg); cb = lerp(124, a[2], fg); }
      else if (ry > -0.06) { cr = 170; cg = 172; cb = 172; }
      else { const kk = clamp(-ry * 1.3); cr = lerp(120, 20, kk); cg = lerp(122, 22, kk); cb = lerp(124, 26, kk);
        if (rx > -0.7 && rx < 0.0 && ry < -0.42 && ry > -0.86) { cr = 246; cg = 244; cb = 238; } }
      const f = 0.82 + 0.36 * (1 - nz); d[k4] = clamp(cr * f, 0, 255); d[k4 + 1] = clamp(cg * f, 0, 255); d[k4 + 2] = clamp(cb * f, 0, 255);
      d[k4 + 3] = clamp((1 - Math.sqrt(q)) * hr / 1.1) * 255;
    }
    g.clearRect(0, 0, 224, 224); g.putImageData(im, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(SP, 0, 0, D, D, -r, -r, r * 2, r * 2);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(-r * 0.36, -r * 0.42, r * 0.13, r * 0.07, -0.6, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(20,22,26,.55)'; c.lineWidth = Math.max(1.5, r * 0.025); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  }); };

// K.tube(c, ax, ay, bx, by, w, col)：圆柱（线段），明暗三层
K.tube = (c, ax, ay, bx, by, w, col = GRAPH, o = {}) => { if (w <= 0) return; c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const ln = (dx, dy, lw, st) => { c.strokeStyle = st; c.lineWidth = lw; c.beginPath(); c.moveTo(ax + dx, ay + dy); c.lineTo(bx + dx, by + dy); c.stroke(); };
  ln(0, 0, w, shade(col, 0.5)); ln(-w * 0.06, -w * 0.06, w * 0.74, col); ln(-w * 0.2, -w * 0.2, w * 0.2, 'rgba(255,255,255,.4)'); c.restore(); };

// ============ 塑料块 / 卡片 / 药丸 ============
// K.plasticBox(c, x, y, w, h, col, o)：(x,y) 前面左上角。o: { depth 厚度(28), r 圆角, label, size(≥52), fam, tcol, alpha, scale, rot }。返回锚点 { x,y,w,h,cx,cy,l,r,t,b }
K.plasticBox = (c, x, y, w, h, col = RED, o = {}) => { if (w <= 0 || h <= 0) return null; const { depth = 28, r = Math.min(18, h / 2), label, size = 52, fam = 'PuHui-Black' } = o, cx = x + w / 2, cy = y + h / 2;
  wrap(c, cx, cy, o, () => { const p = new Path2D(); p.roundRect(-w / 2, -h / 2, w, h, r); solid(c, p, col, depth, Math.max(w, h) * 0.6, { spec: o.spec ?? 0.0 });
    c.save(); c.clip(p); c.translate(2.5, 2.5); c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 5; c.stroke(p); c.restore();
    if (label) K.text(c, label, 0, 3, { size: Math.max(52, size), fam, col: o.tcol || WHITE, maxW: w - 36, depth: 3 }); });
  return { x, y, w, h, cx, cy, l: [x, cy], r: [x + w, cy], t: [cx, y], b: [cx, y + h] }; };
// K.pill(c, x, y, w, col, o)：药丸（高 h 默认 96），标签/步骤用
K.pill = (c, x, y, w, col = TEAL, o = {}) => { const h = o.h ?? 96; return K.plasticBox(c, x, y, w, h, col, { depth: 22, ...o, r: h / 2 }); };
// K.slab(c, x, y, w, h, col, o)：薄卡片（文档/清单/流程框）。o: { label 顶部标题, lines 下面几条文字线, icon 图标名, tcol, depth(14) }。col 默认奶白
K.slab = (c, x, y, w, h, col = CREAM, o = {}) => { const light = col === CREAM || col === WHITE || col === C.beige;
  const bx = K.plasticBox(c, x, y, w, h, col, { depth: 14, r: 14, ...o, label: null }); if (!bx) return null; const cx = x + w / 2;
  wrap(c, cx, y + h / 2, o, () => { const tc = o.tcol || (light ? INK : WHITE), ly = -h / 2;
    if (o.label) K.text(c, o.label, 0, ly + (o.lines || o.icon ? 56 : h / 2) , { size: Math.max(52, o.size || 52), col: tc, edge: light ? WHITE : INK, ext: light ? '#bdb5a2' : '#4b5057', maxW: w - 40, depth: 2, stroke: 5 });
    if (o.lines) for (let i = 0; i < o.lines; i++) { const yy = ly + 118 + i * 38; if (yy > h / 2 - 22) break; const ww = (w - 80) * (i % 3 === 2 ? 0.6 : 1); c.fillStyle = light ? 'rgba(22,24,27,.30)' : 'rgba(255,255,255,.35)'; c.fillRect(-w / 2 + 40, yy, ww, 12); }
    if (o.icon) K.icon(c, o.icon, 0, o.label ? 22 : 0, Math.min(w, h) * 0.5); });
  return bx; };

// ============ 齿轮 ============
const gearPath = (R, N, rot) => { const p = new Path2D(), ro = R * 1.14, ri = R * 0.84, a = TAU / N, T = [[ri, -0.27], [ro, -0.14], [ro, 0.14], [ri, 0.27]];
  for (let i = 0; i < N; i++) T.forEach(([rr, k], j) => { const an = rot + i * a + k * a, px = Math.cos(an) * rr, py = Math.sin(an) * rr; (i === 0 && j === 0) ? p.moveTo(px, py) : p.lineTo(px, py); });
  p.closePath(); return p; };
// 咬合相位：A（齿数 NA、转角 rotA）→ B（齿数 NB，在 A 的 phi 方向，中心距=RA+RB）的转角；B 方向与 A 相反，A 的齿对 B 的槽
K.meshRot = (rotA, NA, NB, phi) => phi + Math.PI - Math.PI / NB + (NA / NB) * (phi - rotA);
// K.gear(c, x, y, R, o)：R 为节圆半径（两齿轮中心距=RA+RB 才咬合）。o: { N 齿数(12), rot, col, label, size(≥52), depth, alpha, scale }
K.gear = (c, x, y, R, o = {}) => { if (R <= 0) return; const N = o.N || 12, col = o.col || RED, depth = o.depth ?? Math.round(R * 0.2), rot = o.rot || 0;
  wrap(c, x, y, { alpha: o.alpha, scale: o.scale }, () => { const top = gearPath(R, N, rot); solid(c, top, col, depth, R * 1.2, { spec: 0.6, specR: 0.1 });
    const inn = K.circle(0, 0, R * 0.7); c.fillStyle = 'rgba(14,10,6,.28)'; c.fill(inn); const face = K.circle(0, 0, R * 0.66); plastic(c, face, col, -R * 0.26, -R * 0.32, R * 1.0, { dark: 0.3, spec: 0.4, specR: 0.14 });
    for (let i = 0; i < 3; i++) { const an = rot * 1 + i * TAU / 3 + 0.5; c.fillStyle = 'rgba(14,10,6,.55)'; c.beginPath(); c.arc(Math.cos(an) * R * 0.48, Math.sin(an) * R * 0.48, R * 0.07, 0, TAU); c.fill(); }
    if (o.label) K.text(c, o.label, 0, 2, { size: Math.max(52, o.size || 58), depth: 2, maxW: R * 1.2 });
    else { c.fillStyle = shade(col, 0.45); c.beginPath(); c.arc(0, 0, R * 0.14, 0, TAU); c.fill(); plastic(c, K.circle(0, 0, R * 0.11), '#c9ccd0', -R * 0.03, -R * 0.04, R * 0.2, { spec: 0.8 }); } });
};
// K.gearChain(c, gs, a, o)：gs = [{x,y,R,N,col,label}, …]，相邻中心距必须=Ra+Rb；a 是第 1 个齿轮的转角（常传 t*0.9，反向后面自动算）。返回各齿轮转角
K.gearChain = (c, gs, a, o = {}) => { const rots = []; gs.forEach((g, i) => { const N = g.N || 12; if (i === 0) rots.push(a);
  else { const p = gs[i - 1], phi = Math.atan2(g.y - p.y, g.x - p.x); rots.push(K.meshRot(rots[i - 1], p.N || 12, N, phi)); } });
  gs.forEach((g, i) => K.gear(c, g.x, g.y, g.R, { ...g, rot: rots[i], alpha: o.alpha, scale: g.scale })); return rots; };

// ============ 箭头 / 回路 / 漏斗 ============
// K.arrow(c, x1, y1, x2, y2, o)：塑料粗箭头（向右下挤出）。o: { col, w 杆宽(30), head 头长(70), p 画出进度 0..1, depth(12), alpha }
K.arrow = (c, x1, y1, x2, y2, o = {}) => { const { col = RED, w = 30, head = 70, p = 1, depth = 12 } = o; if (p <= 0) return; const dd = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / dd, uy = (y2 - y1) / dd, L = dd * p, hl = Math.min(head, L), nx = -uy, ny = ux, hw = Math.max(w * 1.25, 40) / 1;
  const ex = x1 + ux * L, ey = y1 + uy * L, bx = ex - ux * hl, by = ey - uy * hl; const pa = new Path2D();
  pa.moveTo(x1 + nx * w / 2, y1 + ny * w / 2); pa.lineTo(bx + nx * w / 2, by + ny * w / 2); pa.lineTo(bx + nx * hw, by + ny * hw); pa.lineTo(ex, ey); pa.lineTo(bx - nx * hw, by - ny * hw); pa.lineTo(bx - nx * w / 2, by - ny * w / 2); pa.lineTo(x1 - nx * w / 2, y1 - ny * w / 2); pa.closePath();
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; ext(c, pa, col, depth); plastic(c, pa, col, lerp(x1, ex, 0.3) - nx * w * 0.2, lerp(y1, ey, 0.3) - w * 0.3, Math.max(60, L * 0.5), { dark: 0.3, spec: 0.5, specR: 0.1 }); c.restore(); };
// K.loop(c, cx, cy, rx, ry, o)：反馈回路环（椭圆管＋箭头）。o: { col, w 管粗(34), p 画出进度, a0 起角(-π/2), span 弧长占整圈(.88), dir 1 顺/-1 逆, depth(16), beads [{u 0..1, col}] 环上的小塑料球, alpha }。返回箭头尖 [x,y]
K.loop = (c, cx, cy, rx, ry, o = {}) => { const { col = TEAL, w = 34, p = 1, a0 = -Math.PI / 2, span = 0.88, dir = 1, depth = 16 } = o; if (p <= 0) return null;
  const sw = TAU * span * p * dir, N = Math.max(8, Math.round(Math.abs(sw) / TAU * 96)), pt = th => [cx + rx * Math.cos(th), cy + ry * Math.sin(th)], path = new Path2D();
  for (let i = 0; i <= N; i++) { const q = pt(a0 + sw * i / N); i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]); }
  const te = a0 + sw, tp = pt(te), tx = -rx * Math.sin(te) * dir, ty = ry * Math.cos(te) * dir, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, hl = w * 1.9, hw = w * 1.25;
  const tip = [tp[0] + ux * hl, tp[1] + uy * hl], head = new Path2D(); head.moveTo(tip[0], tip[1]); head.lineTo(tp[0] - uy * hw, tp[1] + ux * hw); head.lineTo(tp[0] + uy * hw, tp[1] - ux * hw); head.closePath();
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = depth; i >= 1; i -= 2) { c.save(); c.translate(i * 0.7, i * 0.7); c.strokeStyle = shade(col, 0.3 + 0.2 * (1 - i / depth)); c.lineWidth = w; c.stroke(path); c.fillStyle = c.strokeStyle; c.fill(head); c.restore(); }
  c.strokeStyle = col; c.lineWidth = w; c.stroke(path); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = w * 0.26; c.save(); c.translate(-w * 0.12, -w * 0.16); c.stroke(path); c.restore();
  c.fillStyle = col; c.fill(head); c.save(); c.clip(head); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(tp[0] - hl, tp[1] - hl * 1.4, hl * 2, hl * 0.9); c.restore();
  for (const b of o.beads || []) { const q = pt(a0 + dir * TAU * span * (b.u % 1)); K.sphere(c, q[0], q[1], w * 0.62, { kind: 'plastic', col: b.col || YEL }); }
  c.restore(); return tip; };
// K.funnel(c, x, y, w, h, o)：漏斗（筛选）。(x,y) 口沿中心，w 口径，h 总高（含细管）。o: { col, alpha, scale }。返回 { mouth:[x,y], spout:[x,y] }
K.funnel = (c, x, y, w, h, o = {}) => { const col = o.col || TEAL, rx = w / 2, ry = Math.max(10, w * 0.13), sr = Math.max(10, w * 0.07), sry = sr * 0.35, tube = h * 0.22;
  wrap(c, x, y, o, () => { const body = new Path2D(); body.moveTo(-rx, 0); body.lineTo(-sr, h - tube); body.lineTo(-sr, h); body.ellipse(0, h, sr, sry, 0, Math.PI, 0, true); body.lineTo(sr, h - tube); body.lineTo(rx, 0); body.ellipse(0, 0, rx, ry, 0, 0, Math.PI, true); body.closePath();
    const gr = c.createLinearGradient(-rx, 0, rx, 0); gr.addColorStop(0, shade(col, 0.5)); gr.addColorStop(0.22, mixW(col, 0.28)); gr.addColorStop(0.4, col); gr.addColorStop(0.8, shade(col, 0.62)); gr.addColorStop(1, shade(col, 0.4));
    c.fillStyle = gr; c.fill(body);
    c.fillStyle = INK; c.beginPath(); c.ellipse(0, 0, rx * 0.94, ry * 0.86, 0, 0, TAU); c.fill(); const ig = c.createLinearGradient(0, -ry, 0, ry); ig.addColorStop(0, shade(col, 0.22)); ig.addColorStop(1, '#0c0d0f'); c.fillStyle = ig; c.beginPath(); c.ellipse(0, ry * 0.08, rx * 0.9, ry * 0.76, 0, 0, TAU); c.fill();
    c.strokeStyle = mixW(col, 0.35); c.lineWidth = Math.max(8, w * 0.025); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(4, w * 0.014); c.beginPath(); c.moveTo(-rx * 0.62, ry * 0.9); c.lineTo(-sr * 1.8, h - tube - 6); c.stroke();
    c.strokeStyle = shade(col, 0.45); c.lineWidth = 3; c.beginPath(); c.ellipse(0, h, sr, sry, 0, 0, Math.PI); c.stroke(); });
  return { mouth: [x, y], spout: [x, y + h + sry] }; };

// ============ 立体牌 / 贴地标签 ============
// K.label3d(c, s, x, y, o)：(x,y) 牌中心。o: { size(≥52), col 牌色(石墨), tcol, depth, padX, scale, alpha, rot, ground 贴地（竖向压扁，字号用 ≥96）, post 立柱高度, align 'center'|'left' }。返回牌宽
K.label3d = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 52), col = o.col || GRAPH, depth = o.depth ?? (o.ground ? 12 : 16), padX = o.padX ?? 0.6, h = size * 1.5, fam = o.fam || 'PuHui-Black';
  c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * padX * 2; c.restore(); const x0 = o.align === 'left' ? 0 : -w / 2;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); if (o.rot) c.rotate(o.rot); if (o.scale != null) c.scale(Math.max(0, o.scale), Math.max(0, o.scale)); if (o.ground) c.scale(1, 0.5);
  if (o.post) { K.tube(c, x0 + w / 2, h / 2, x0 + w / 2, h / 2 + o.post, 16, C.steel); }
  const p = new Path2D(); p.roundRect(x0, -h / 2, w, h, 14); ext(c, p, col, depth); plastic(c, p, col, x0 + w * 0.25, -h * 0.35, Math.max(w, h) * 0.7, { dark: 0.3, spec: 0, specR: 0.1 });
  c.save(); c.clip(p); c.translate(2.5, 2.5); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 5; c.stroke(p); c.restore();
  K.text(c, s, x0 + w / 2, 3, { size, fam, col: o.tcol || (isHex(col) && onCol(col) === INK ? INK : WHITE), edge: onCol(col) === INK && !o.tcol ? WHITE : INK, ext: onCol(col) === INK && !o.tcol ? '#b9b19c' : '#4b5057', depth: 3, stroke: size * 0.09 }); c.restore(); return w; };
K.tag = K.label3d;
// 弹出的大字/数字（backOut 过冲）；o.plate 时带立体牌（o.col 牌色）
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.label3d(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：细线先画出来（起点一颗小红球），再弹出立体牌逐字打出（约 20 字/秒）
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { col = YEL, size = 52 } = o; const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  const ex = lerp(ax, bx, p1), ey = lerp(ay, by, p1); c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(14,10,6,.7)'; c.lineWidth = 9; c.beginPath(); c.moveTo(ax + 2, ay + 2); c.lineTo(ex + 2, ey + 2); c.stroke();
  c.strokeStyle = CREAM; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ex, ey); c.stroke(); c.restore();
  K.sphere(c, ax, ay, 14 * Math.min(1, p1 * 3), { kind: 'plastic', col: RED });
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${Math.max(52, size)}px "PuHui-Black"`; const full = c.measureText(s).width; c.restore();
  K.label3d(c, shown, bx - full / 2 - Math.max(52, size) * 0.6, by, { size, col, align: 'left', scale: q, padX: 0.6, ...(o.rot ? { rot: o.rot } : {}), tcol: o.tcol }); };

// ============ 图标（塑料小件，size≈包围盒边长，默认 120） ============
const ICONS = {
  eye: (c, o) => { const s = K.circle(0, 0, 44); solid(c, s, o.col || WHITE, 8, 56, { spec: 0.6 }); const ir = K.circle(4, 3, 23); plastic(c, ir, TEAL, -4, -6, 36, { spec: 0 }); c.fillStyle = INK; c.beginPath(); c.arc(4, 3, 9, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(-4, -8, 6, 4, -0.5, 0, TAU); c.fill(); },
  wing: (c, o) => { const px = -22, py = 26, fe = [[-2.55, 78, 17], [-2.2, 98, 19], [-1.85, 108, 19], [-1.5, 104, 18], [-1.15, 92, 17], [-0.8, 74, 15]];
    for (let i = fe.length - 1; i >= 0; i--) { const [an, L, w] = fe[i], ca = Math.cos(an), sa = Math.sin(an), nx = -sa, ny = ca, p = new Path2D(); p.moveTo(px, py); p.quadraticCurveTo(px + ca * L * 0.5 + nx * w, py + sa * L * 0.5 + ny * w, px + ca * L, py + sa * L); p.quadraticCurveTo(px + ca * L * 0.5 - nx * w, py + sa * L * 0.5 - ny * w, px, py); p.closePath();
      const cc = o.col || (i % 2 ? C.beige : WHITE); ext(c, p, cc, 4); plastic(c, p, cc, px + ca * L * 0.55 - 6, py + sa * L * 0.55 - 8, L * 0.7, { spec: 0.5, specR: 0.1, dark: 0.3 }); }
    plastic(c, K.circle(px, py, 11), C.steel, px - 3, py - 4, 16, { spec: 0.8 }); },
  shield: (c, o) => { const p = new Path2D(); p.moveTo(-38, -42); p.quadraticCurveTo(0, -30, 38, -42); p.lineTo(38, -8); p.quadraticCurveTo(32, 30, 0, 50); p.quadraticCurveTo(-32, 30, -38, -8); p.closePath(); solid(c, p, o.col || TEAL, 9, 60);
    c.strokeStyle = WHITE; c.lineWidth = 11; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-16, -2); c.lineTo(-3, 13); c.lineTo(19, -17); c.stroke(); },
  doc: (c, o) => { const p = new Path2D(); p.moveTo(-34, -46); p.lineTo(12, -46); p.lineTo(34, -24); p.lineTo(34, 46); p.lineTo(-34, 46); p.closePath(); solid(c, p, o.col || CREAM, 7, 70, { spec: 0 });
    c.fillStyle = 'rgba(22,24,27,.38)'; for (let i = 0; i < 4; i++) c.fillRect(-22, -10 + i * 15, i === 3 ? 28 : 44, 7); c.fillStyle = C.steel; c.beginPath(); c.moveTo(12, -46); c.lineTo(34, -24); c.lineTo(12, -24); c.closePath(); c.fill(); },
  check: (c, o) => { solid(c, K.circle(0, 0, 44), o.col || TEAL, 8, 56); c.strokeStyle = WHITE; c.lineWidth = 13; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-21, 2); c.lineTo(-6, 18); c.lineTo(23, -16); c.stroke(); },
  cross: (c, o) => { solid(c, K.circle(0, 0, 44), o.col || RED, 8, 56); c.strokeStyle = WHITE; c.lineWidth = 13; c.lineCap = 'round'; c.beginPath(); c.moveTo(-17, -17); c.lineTo(17, 17); c.moveTo(17, -17); c.lineTo(-17, 17); c.stroke(); },
  key: (c, o) => { const col = o.col || YEL, p = new Path2D(); p.arc(-20, 0, 22, 0, TAU); p.rect(-2, -7, 50, 14); p.rect(30, 7, 9, 15); p.rect(14, 7, 8, 11); solid(c, p, col, 7, 60); c.fillStyle = INK; c.beginPath(); c.arc(-20, 0, 9, 0, TAU); c.fill(); },
  bulb: (c, o) => { const col = o.col || YEL; const nk = new Path2D(); nk.roundRect(-16, 20, 32, 26, 6); solid(c, nk, C.steel, 6, 40, { spec: 0 }); c.fillStyle = 'rgba(22,24,27,.5)'; c.fillRect(-16, 30, 32, 4); c.fillRect(-16, 38, 32, 4);
    const g = new Path2D(); g.arc(0, -10, 32, 0, TAU); g.rect(-14, 10, 28, 14); solid(c, g, col, 8, 50, { spec: 0.75 }); },
  lock: (c, o) => { c.strokeStyle = C.steel; c.lineWidth = 12; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-18, -4); c.lineTo(-18, -22); c.arc(0, -22, 18, Math.PI, 0); c.lineTo(18, -4); c.stroke();
    const b = new Path2D(); b.roundRect(-34, -6, 68, 54, 8); solid(c, b, o.col || YEL, 8, 70); c.fillStyle = INK; c.beginPath(); c.arc(0, 16, 7, 0, TAU); c.fill(); c.fillRect(-3, 16, 6, 16); },
  lens: (c, o) => { K.tube(c, 14, 14, 40, 40, 14, o.col || RED); c.fillStyle = 'rgba(236,229,211,.22)'; c.beginPath(); c.arc(-8, -8, 28, 0, TAU); c.fill(); c.strokeStyle = C.steel; c.lineWidth = 11; c.beginPath(); c.arc(-8, -8, 28, 0, TAU); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.beginPath(); c.arc(-8, -8, 18, 3.4, 4.5); c.stroke(); },
  flag: (c, o) => { K.tube(c, -30, 48, -30, -46, 9, C.steel); const p = new Path2D(); p.moveTo(-26, -44); p.lineTo(38, -26); p.lineTo(-26, -6); p.closePath(); solid(c, p, o.col || RED, 7, 50); },
};
const ICON_ALIAS = { 眼睛: 'eye', 眼: 'eye', 翅膀: 'wing', 翅: 'wing', 盾: 'shield', 免疫: 'shield', 文档: 'doc', 文件: 'doc', 对勾: 'check', 叉: 'cross', 钥匙: 'key', 灯泡: 'bulb', 锁: 'lock', 放大镜: 'lens', 旗: 'flag' };
K.ICON_NAMES = Object.keys(ICONS);
K.icon = (c, name, x, y, size = 120, o = {}) => { const f = ICONS[ICON_ALIAS[name] || name]; if (!f) throw new Error('K.icon: 没有这个图标 ' + name + '（可用：' + K.ICON_NAMES.join(' ') + '）'); if (size <= 0) return;
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(size / 100, size / 100); f(c, o); c.restore(); };

// ============ 人形（塑料球头＋圆柱身，不画五官；「专家/验证者」用） ============
// K.figure(c, x, y, o)：(x,y) 两脚中点。s=1 约 700px 高，常用 0.5–0.8。返回 { hand, handB, head, top, chest, feet, prop }
// o: { s, dir 1 朝右/-1 朝左, pose: stand|point|reach|cheer|hold|walk, t（呼吸/走路时钟）, target [x,y]（point/reach 的手指向哪里）, col 躯干色(青), head 'plastic'|'chrome', headCol, badge 图标名, prop(c,{x,y,s,dir}) 手里的东西, alpha }
const POSE = {
  stand: () => ({ A: [112, -330], B: [-112, -330] }),
  point: () => ({ A: [300, -560], B: [-112, -330], tgt: 1, lean: 8 }),
  reach: () => ({ A: [262, -440], B: [-104, -340], tgt: 1, lean: 22 }),
  cheer: () => ({ A: [150, -740], B: [-150, -740] }),
  hold: () => ({ A: [128, -400], B: [52, -392], lean: 6 }),
  walk: ph => { const sw = Math.sin(ph); return { A: [60 - sw * 70, -360], B: [-60 + sw * 70, -360], fA: [sw * 80, -Math.max(0, Math.cos(ph)) * 34], fB: [-sw * 80, -Math.max(0, -Math.cos(ph)) * 34], bob: -Math.abs(Math.cos(ph)) * 6 }; },
};
K.POSES = Object.keys(POSE);
K.figure = (c, x, y, o = {}) => { const s = o.s ?? 0.6, dir = o.dir || 1, t = o.t ?? 0, ph = o.walk ?? t * 6, pn = o.pose || 'stand', f = POSE[pn]; if (!f) throw new Error('K.figure: 没有这个姿势 ' + pn + '（可用：' + K.POSES.join(' ') + '）');
  const pz = f(ph), col = o.col || TEAL, br = Math.sin(t * 2.4) * 2.5, bob = pz.bob || 0, lean = pz.lean || 0, LL = 124, S2 = (lx, ly) => [x + lx * s * dir, y + ly * s], toL = (sx, sy) => [(sx - x) / (s * dir), (sy - y) / s];
  let hA = pz.A, hB = pz.B; if (o.target && pz.tgt) hA = toL(o.target[0], o.target[1]);
  const shA = [78 + lean, -470 + br + bob], shB = [-78 + lean, -470 + br + bob];
  const ik = (Sh, Hd) => { let dx = Hd[0] - Sh[0], dy = Hd[1] - Sh[1], d = Math.hypot(dx, dy) || 1; if (d > 2 * LL - 2) { Hd = [Sh[0] + dx / d * (2 * LL - 2), Sh[1] + dy / d * (2 * LL - 2)]; dx = Hd[0] - Sh[0]; dy = Hd[1] - Sh[1]; d = 2 * LL - 2; }
    const h = Math.sqrt(Math.max(0, LL * LL - d * d / 4)), e1 = [Sh[0] + dx / 2 + dy / d * h, Sh[1] + dy / 2 - dx / d * h], e2 = [Sh[0] + dx / 2 - dy / d * h, Sh[1] + dy / 2 + dx / d * h]; return [e2[1] > e1[1] ? e2 : e1, Hd]; };
  const arm = (Sh, Hd) => { const [E, Hn] = ik(Sh, Hd); K.tube(c, Sh[0], Sh[1], E[0], E[1], 38, col); K.tube(c, E[0], E[1], Hn[0], Hn[1], 34, col); plastic(c, K.circle(Hn[0], Hn[1], 24), C.beige, Hn[0] - 8, Hn[1] - 9, 36, { spec: 0.7 }); return Hn; };
  if (o.shadow !== false) K.shadow(c, x, y, 120 * s, 30 * s, 0.5);
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; c.translate(x, y); c.scale(s * dir, s);
  const hbT = arm(shB, hB), fA = pz.fA || [0, 0], fB = pz.fB || [0, 0];
  for (const [hxx, ff] of [[-34, fB], [34, fA]]) { K.tube(c, hxx, -300 + bob, hxx * 1.05 + ff[0], -22 + ff[1], 50, GRAPH); plastic(c, (() => { const p = new Path2D(); p.ellipse(hxx * 1.05 + ff[0] + 14, -14 + ff[1], 40, 18, 0, 0, TAU); return p; })(), '#25282c', hxx + ff[0], -22 + ff[1], 46, { spec: 0.5, specR: 0.18 }); }
  K.tube(c, lean * 0.5, -290 + bob, lean * 0.5, -470 + br + bob, 168, col);
  if (o.badge) K.icon(c, o.badge, lean * 0.5 + 6, -385 + bob, 104);
  const hxp = lean * 0.4 + 4, hyp = -590 + br * 1.3 + bob; K.tube(c, hxp, hyp + 40, hxp, hyp + 70, 36, C.beige);
  K.sphere(c, hxp, hyp, 64, (o.head || 'plastic') === 'chrome' ? { kind: 'chrome', spin: t * 1.6 } : { kind: 'plastic', col: o.headCol || C.beige });
  const hAn = ik(shA, hA)[1]; arm(shA, hA); c.restore();
  const hd = S2(hxp, hyp);
  if (o.prop) { const m = pn === 'hold' ? S2((hAn[0] + hbT[0]) / 2, (hAn[1] + hbT[1]) / 2) : S2(hAn[0], hAn[1]); o.prop(c, { x: m[0], y: m[1], s, dir }); }
  return { hand: S2(hAn[0], hAn[1]), handB: S2(hbT[0], hbT[1]), head: hd, top: [hd[0], hd[1] - 64 * s], chest: S2(lean * 0.5, -385 + bob), feet: [x, y], prop: S2(hAn[0], hAn[1]) }; };

// ============ 收尾 / 章节卡 / 字幕 ============
// 收尾：四角压暗＋字幕带压暗一档（让字幕和画面分开）
K.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.42, 650, W / 2, H * 0.42, 1350); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1350, 0, 1600); b.addColorStop(0, 'rgba(8,9,11,0)'); b.addColorStop(0.5, 'rgba(8,9,11,.34)'); b.addColorStop(1, 'rgba(8,9,11,0)'); c.fillStyle = b; c.fillRect(0, 1350, W, 250);
};
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
K.CARD_TINTS = K.CARD_TINTS || ['red', 'teal', 'yellow'];    // 章节卡数字色每章轮换；换书可在 props.js 里改
// 章节卡：暗舞台＋大塑料数字 N、「第 N 章」红药丸、章名放在石墨立体牌上（长的拆两行）、N 站进度＝地面一排小球（走过的青绿、当前铬球放大、没到的石墨），带倒影
K.chapterCard = (c, lt, t, n, title = '') => {
  const tint = K.CARD_TINTS[(n - 1) % K.CARD_TINTS.length], col = tintCol(tint) || RED, hor = 520; K.stage(c, t, { hor });
  const nd = { [RED]: C.redDk, [TEAL]: C.tealDk, [YEL]: C.yelDk }[col] || '#4b5057';
  // 大数字 N：压在地平线上，不做倒影；右侧一颗铬球落在地面
  const ns = String(n); c.save(); c.font = '520px "Poppins-800"'; const nw = c.measureText(ns).width; c.restore(); const nk = Math.min(1, 700 / nw), q = lt > 0.08 ? MO.slamK((lt - 0.08) / 0.2) : 0;
  if (q > 0) K.text(c, ns, 60, 470, { size: 520, fam: 'Poppins-800', col, edge: INK, ext: nd, depth: 30, stroke: 18, align: 'left', scale: q * nk });
  const sp = K.pop(lt, 0.15, 0.5), by = 575 + Math.abs(Math.sin(t * 1.6)) * 0; if (sp > 0) { K.sphere(c, 850, by - 120 * sp, 120 * sp, { kind: 'chrome', spin: t * 1.4, shadow: 600 }); }
  if (lt > 0.2) { const k = MO.slamK((lt - 0.2) / 0.17); K.label3d(c, `第 ${n} 章`, 70, 175, { size: 60, col: RED, align: 'left', scale: k, tcol: WHITE }); }
  // 章名牌
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 92 : all > 7 ? 108 : 124;
  const ph = lines.length * size * 1.22 + 70, py = 780, pp = K.pop(lt, 0.45, 0.45);
  if (pp > 0) { c.save(); c.translate(540, py + ph / 2); c.scale(pp, pp); const p = new Path2D(); p.roundRect(-480, -ph / 2, 960, ph, 18); ext(c, p, GRAPH, 24); plastic(c, p, GRAPH, -200, -ph * 0.4, 700, { dark: 0.3, spec: 0 }); c.save(); c.clip(p); c.translate(2.5, 2.5); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 5; c.stroke(p); c.restore(); c.restore(); }
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0 && pp > 0.6) K.text(c, a.slice(0, k).join(''), 540, py + 35 + size * 0.61 + i * size * 1.22, { size, fam: 'PuHui-Black', maxW: 880, depth: 4 }); });
  // 进度：N 站小球站在地面上
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 70, x1 = 1010, gy = 1200, rr = Math.min(30, (x1 - x0) / (N - 1) * 0.36), X = i => lerp(x0 + rr, x1 - rr, i / (N - 1));
  const balls = (l, fromRefl) => { for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, p = cur ? K.pop(lt, 1.0, 0.45) : K.pop(lt, 0.7 + i * 0.03, 0.3), r = (cur ? rr * 1.8 : rr) * Math.max(0, p);
      if (r <= 0) continue; if (cur && !fromRefl) K.sphere(l, X(i), gy - r, r, { kind: 'chrome', spin: t * 1.4, shadow: gy }); else K.sphere(l, X(i), gy - r, r, { kind: 'plastic', col: cur ? (fromRefl ? C.steel : col) : past ? TEAL : GRAPH, shadow: fromRefl ? null : gy }); } };
  K.reflect(c, gy, 160, l => balls(l, true), { alpha: 0.4 }); balls(c, false);
  K.finish(c);
};
// 字幕（assemble 生成的 subs.js 调它）：暗条＋白字＋深描边，字幕带 y≈1480，让开视频号底栏
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 90), h = 92, x = 540, y = 1480;
  c.fillStyle = 'rgba(8,9,11,.74)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 16); c.fill();
  c.fillStyle = RED; c.fillRect(x - w / 2, y - h / 2 + 14, 8, h - 28);
  c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = INK; c.strokeText(text, x + 4, y + 2, 950); c.fillStyle = WHITE; c.fillText(text, x + 4, y + 2, 950); c.restore();
};
})();
