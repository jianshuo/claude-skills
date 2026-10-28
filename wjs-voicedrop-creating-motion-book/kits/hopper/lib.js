// 画风套件 hopper（配方 huashu-art-motion 24_hopper「1942 霍珀美国现实主义：硬光块面」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 核心手法「双版本裁切」：同一个形状按两套色各画一遍——背光版 K.SH（冷青绿＋深褐）、受光版 K.LT（暖琥珀＋砖红）；
//   先画背光版，再用「会缓缓移动的斜光斑多边形」clip 住受光版。光影边缘天然是硬的，物体被光斑切开时自动一半冷一半暖。
//   K.bg(c,t,o) 画底并记下本帧光斑（K.beam）；K.lit(c,t,region,fnShadow,fnLit) 是通用双色助手；
//   所有道具（table/card/figure/hand/chips/window…）内部都走 K.lit，章节作者直接调用即可。
// 铁律：光斑边缘不许切标题字区——bg 的 o.title 把标题区整块放进暗里（'dark'，默认）或光里（'lit'）；标题/标签板（K.title/K.tag/K.callout）是不受光裁切的实色板。
// 人只出无脸剪影（K.figure/K.crowd）与手（K.hand）。红色（砖红）只给重点：翻开的关键牌、风险、涨跌里的红。
// 环境层全部确定性（随机走 U.hash）。字体只用引擎自带 PuHui-Black/Heavy/Bold。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：backOut 回弹起步会让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__hop) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__hop = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}

// ---------- 色板 ----------
// K.C：名字色（章节里直接用）；K.SH / K.LT：成对的背光 / 受光色（K.lit 的回调参数）
const C = D.C = {
  teal: '#4F7A68', tealD: '#3E5F53', amber: '#E9C887', amberD: '#CF9F5E', brick: '#C9473C', wine: '#6E2626',
  cream: '#F5EBD3', dark: '#2B1D16', board: '#1F2D27', sub: '#8A7A62',
  ink: '#2B1D16', paper: '#F5EBD3', red: '#C9473C',
};
const SH = D.SH = {
  wall: '#4f7566', wallD: '#3e5f53', trim: '#8fa090', floor: '#2b1c14', floorL: '#36241a', wood: '#5a3a28', woodD: '#42281a', apron: '#33200f',
  shadow: 'rgba(12,8,6,.5)', red: '#8f3631', redD: '#6d2523', redL: '#b9a778', cream: '#c9bf9f', creamT: '#4a1f1d', hot: '#8a2f29',
  skin: '#a87866', skinD: '#85584a', sleeve: '#26332d', cuff: '#b9b09c', coat: '#2b3b34', coatD: '#1f2b26', pants: '#2b1d16', shirt: '#b4ab90',
  hair: '#1f1510', brick: '#8d4331', brickD: '#6d3224', glass: '#1c2c2a', metal: '#6a6f62', lamp: '#c9a45a', sky: '#8db3a2' };
const LT = D.LT = {
  wall: '#ecc982', wallD: '#cf9f5e', trim: '#f7eed2', floor: '#6a4a2c', floorL: '#7a5834', wood: '#cf8f52', woodD: '#a76a38', apron: '#8a5a30',
  shadow: 'rgba(0,0,0,0)', red: '#c9473a', redD: '#a43426', redL: '#f6e2a8', cream: '#f8efd6', creamT: '#6E2626', hot: '#C9473C',
  skin: '#f3c9a6', skinD: '#d89c7c', sleeve: '#5f7d68', cuff: '#fbf3dc', coat: '#5f7d68', coatD: '#4a6a58', pants: '#8a5a3a', shirt: '#f5ebd3',
  hair: '#7a5232', brick: '#d06a4a', brickD: '#a8503a', glass: '#7fb0a4', metal: '#d9d2b8', lamp: '#f6dc9a', sky: '#8db3a2' };

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
D.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
D.SAFE = { top: 200, bot: 1350, sub: 1480 };   // 主体区 y200–1350；字幕带 1380–1560

// ---------- 光斑 / 双版本 ----------
// 多边形统一成顺时针（nonzero 并集不会因绕向相反而抵消）
const orient = pts => { let a = 0; pts.forEach((q, i) => { const r = pts[(i + 1) % pts.length]; a += q[0] * r[1] - r[0] * q[1]; }); return a < 0 ? pts.slice().reverse() : pts; };
// 多边形按 y 范围裁切（Sutherland–Hodgman，水平半平面两次）
const clipY = (pts, y0, y1) => { const half = (ps, keep) => { const out = []; ps.forEach((a, i) => { const b = ps[(i + 1) % ps.length], ia = keep(a), ib = keep(b);
    if (ia) out.push(a); if (ia !== ib) { const f = (keep.y - a[1]) / (b[1] - a[1]); out.push([lerp(a[0], b[0], f), keep.y]); } }); return out; };
  const k0 = p => p[1] >= y0; k0.y = y0; const k1 = p => p[1] <= y1; k1.y = y1; let r = half(pts, k0); if (r.length) r = half(r, k1); return r; };
D.polysPath = polys => { const p = new Path2D(); polys.forEach(q => { if (q.length < 3) return; orient(q).forEach((v, i) => i ? p.lineTo(v[0], v[1]) : p.moveTo(v[0], v[1])); p.closePath(); }); return p; };
D.beam = null;   // 本帧光斑 { polys, path }，bg 写入，lit 读取（坐标与 bg 同一坐标系：bg 和用到 lit 的物体请在同一个 K.world 里画）
// 通用双色助手：先用背光色回调画一遍，再 clip 进光斑用受光色回调画一遍。回调 fn(c, Pal)，Pal 是 K.SH 或 K.LT（成对的色键）。
// region：Path2D | 多边形数组 [[x,y]..] 的数组 | null（= 本帧 bg 的光斑）；fnLit 缺省 = fnShadow。
D.lit = (c, t, region, fnS, fnL) => {
  fnL = fnL || fnS; c.save(); fnS(c, SH); c.restore();
  const rg = region == null ? (D.beam && D.beam.path) : region instanceof Path2D ? region : D.polysPath(region); if (!rg) return;
  c.save(); c.clip(rg); fnL(c, LT); c.restore(); };
D.dual = (c, fn) => D.lit(c, 0, null, fn);

// ---------- 底：室内墙地 / 夜窗灯锥 / 户外街 / 百叶斜条 / 暗底 ----------
const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const PAINTERS = {
  room(g, Pl) { rect(g, 0, 0, W, 1300, Pl.wall); rect(g, 0, 700, W, 600, Pl.wallD); rect(g, 0, 690, W, 12, Pl.trim); rect(g, 0, 1300, W, H - 1300, Pl.floor);
    rect(g, 0, 1292, W, 10, Pl.floorL); for (let k = 1; k < 7; k++) rect(g, 0, 1300 + k * k * 14, W, 3, Pl.floorL); },
  blinds(g, Pl) { rect(g, 0, 0, W, 1300, Pl.wall); rect(g, 880, 0, 200, 1300, Pl.wallD); rect(g, 872, 0, 8, 1300, Pl.trim); rect(g, 0, 1240, W, 60, Pl.wallD); rect(g, 0, 1234, W, 8, Pl.trim); rect(g, 0, 1300, W, H - 1300, Pl.floor); rect(g, 0, 1292, W, 10, Pl.floorL); },
  night(g, Pl) { rect(g, 0, 0, W, 1300, Pl.wall); rect(g, 0, 760, W, 540, Pl.wallD); rect(g, 0, 750, W, 12, Pl.trim); rect(g, 0, 1300, W, H - 1300, Pl.floor); rect(g, 0, 1292, W, 10, Pl.floorL);
    // 夜窗（自发光，两版同色）：窗洞 + 远楼 + 零星灯窗 + 窗框
    const wx = 90, wy = 560, ww = 330, wh = 560; rect(g, wx - 16, wy - 16, ww + 32, wh + 32, Pl.trim); rect(g, wx, wy, ww, wh, '#10201f');
    for (let i = 0; i < 5; i++) { const bx = wx + i * 66 - 10, bh = 120 + U.hash(i, 7) * 160; rect(g, bx, wy + wh - bh, 62, bh, '#0c1918');
      for (let k = 0; k < 8; k++) if (U.hash(i * 9 + k, 3) > 0.55) rect(g, bx + 10 + (k % 2) * 28, wy + wh - bh + 14 + Math.floor(k / 2) * 30, 14, 16, '#E9C887'); }
    rect(g, wx + ww / 2 - 6, wy, 12, wh, Pl.trim); rect(g, wx, wy + 250, ww, 12, Pl.trim); rect(g, wx - 30, wy + wh + 16, ww + 60, 18, Pl.trim); },
  street(g, Pl) { rect(g, 0, 0, W, 800, Pl.sky);
    rect(g, 0, 560, 700, 740, Pl.brick); rect(g, 700, 760, 380, 540, Pl.brickD); rect(g, 0, 548, 700, 22, Pl.trim); rect(g, 700, 748, 380, 22, Pl.trim);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const wx = 50 + k * 160, wy = 620 + r * 190; rect(g, wx - 8, wy - 8, 116, 156, Pl.trim); rect(g, wx, wy, 100, 140, Pl.glass); rect(g, wx + 46, wy, 8, 140, Pl.trim); rect(g, wx, wy + 62, 100, 8, Pl.trim); }
    for (let k = 0; k < 2; k++) { const wx = 740 + k * 160, wy = 830; rect(g, wx - 8, wy - 8, 116, 156, Pl.trim); rect(g, wx, wy, 100, 140, Pl.glass); }
    rect(g, 0, 1010, W, 290, Pl.wallD); rect(g, 40, 1060, 560, 190, Pl.glass); rect(g, 330, 1060, 8, 190, Pl.trim); rect(g, 40, 1060, 560, 8, Pl.trim); rect(g, 660, 1050, 340, 250, Pl.floor);
    for (let k = 0; k < 14; k++) rect(g, k * 80, 1004, 80, 60, k % 2 ? Pl.cream : Pl.red);
    rect(g, 0, 1300, W, 130, Pl.floorL); rect(g, 0, 1420, W, H - 1420, Pl.floor); for (let k = 0; k < 8; k++) rect(g, k * 150 + 20, 1296, 6, 140, Pl.floor); },
  dark(g, Pl) { rect(g, 0, 0, W, H, Pl.floor); rect(g, 0, 0, W, 1300, Pl.apron); rect(g, 0, 1294, W, 8, Pl.floorL); },
};
const MAXY = 1500;
// 光斑几何（屏幕坐标多边形数组）。dx：随 t 缓移的水平位移；top：光斑最高 y（标题区以下）
const beamPolys = (kind, t, o, top) => {
  const dx = (o.drift != null ? o.drift : 90) * Math.sin(t * 0.18 + (o.phase || 0)) + (o.dx || 0), bx = o.bx || 0, polys = [];
  if (kind === 'room') { const sl = -0.16, X = (x, y) => x + sl * (y - top) + dx + bx, ym = Math.max(top + 120, 700), fy = 1260, sl2 = -0.5;
    [[360, 610], [700, 1300]].forEach(([xa, xb]) => {
      polys.push([[X(xa, top), top], [X(xb, top), top + 40], [X(xb, ym - 30), ym - 30], [X(xa, ym - 30), ym - 30]]);
      polys.push([[X(xa, ym + 22), ym + 22], [X(xb, ym + 22), ym + 22], [X(xb, fy), fy], [X(xa, fy), fy]]);
      polys.push([[X(xa, fy), fy], [X(xb, fy), fy], [X(xb, fy) + sl2 * 300, fy + 300], [X(xa, fy) + sl2 * 300, fy + 300]]); }); }
  else if (kind === 'night') { const lx = (o.lx || 540) + dx * 0.12, ly = o.ly || 640, sw = Math.sin(t * 0.9) * 6; polys.push([[lx - 86 + sw, ly + 26], [lx + 86 + sw, ly + 26], [lx + 700, MAXY], [lx - 700, MAXY]]); }
  else if (kind === 'street') { const x1 = 470 + dx + bx, x2 = 120 + dx + bx; polys.push([[x1, top], [W + 200, top], [W + 200, 1760], [x2, 1760]]);
    polys.push([[x1 - 250, top], [x1 - 160, top], [x2 - 160, 1760], [x2 - 250, 1760]]); }
  else if (kind === 'blinds') { const pitch = 190, thk = 96, sl = -0.14, ph = ((t * 14 + (o.phase || 0) * 40) % pitch + pitch) % pitch;
    for (let k = -1; k < 8; k++) { const y0 = top + k * pitch + ph - 40; polys.push([[0, y0], [W, y0 + sl * W], [W, y0 + thk + sl * W], [0, y0 + thk]]); } }
  const r = polys.map(p => clipY(p, top, MAXY)).filter(p => p.length >= 3);
  if (o.title === 'lit') r.push([[0, 0], [W, 0], [W, top + 42], [0, top + 42]]);
  return r; };
const brushTex = () => P.cached('hop_brush', W, H, g => { const s = 4, w = W / s, h = H / s, sm = P.canvas(w, h), q = sm.getContext('2d'), im = q.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 128 + P.fbm(x * 0.06, y * 0.006, 4) * 110, i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  q.putImageData(im, 0, 0); g.drawImage(sm, 0, 0, W, H); });
// K.bg(c,t,o)：o { kind 'room'(默认)|'night'|'street'|'blinds'|'dark'，title 'dark'(默认，标题区整块在暗里)|'lit'(整块在光里)|false(不留标题区),
//   zone [y0,y1] 标题区（默认 [140,500]；光斑最高点 = y1+40），drift 光斑缓移幅度 px(默认 90)，phase 相位，dx/bx 光斑偏移，lx/ly 灯位（night），dust false 关浮尘 }
// 画完会设置 K.beam，之后 K.lit / 各道具自动用同一光斑。
D.bg = (c, t, o = {}) => {
  const kind = PAINTERS[o.kind] ? o.kind : 'room', zone = o.zone || [140, 500], titled = o.title !== false && kind !== 'dark', top = titled ? zone[1] + 40 : (kind === 'street' ? 560 : 220);
  const key = 'hop_bg_' + kind, mk = Pl => g => PAINTERS[kind](g, Pl), S = P.cached(key + 'S', W, H, mk(SH)), L = P.cached(key + 'L', W, H, mk(LT));
  c.drawImage(S, 0, 0);
  if (kind === 'night') { c.fillStyle = 'rgba(14,22,19,.42)'; c.fillRect(0, 0, W, H); c.fillStyle = '#10201f'; c.fillRect(90, 560, 330, 560); }   // 夜：背光版再压暗（窗洞另补）
  const polys = kind === 'dark' ? [] : beamPolys(kind, t, { ...o, title: titled ? (o.title || 'dark') : false }, top);
  D.beam = { polys, path: D.polysPath(polys), top };
  if (polys.length) { c.save(); c.clip(D.beam.path); c.drawImage(L, 0, 0); c.restore();
    if (o.dust !== false) { c.save(); c.clip(D.beam.path); c.fillStyle = 'rgba(245,235,211,.55)';
      for (let i = 0; i < 22; i++) { const px = U.hash(i, 11) * W + Math.sin(t * 0.3 + i) * 30, py = ((U.hash(i, 12) * 1100 + t * (8 + 6 * U.hash(i, 13))) % 1100) + 380, r = 3 + U.hash(i, 14) * 4; c.fillRect(px, py, r, r); } c.restore(); } }
  if (kind === 'night') { const lx = (o.lx || 540) + ((o.drift != null ? o.drift : 90) * Math.sin(t * 0.18 + (o.phase || 0)) + (o.dx || 0)) * 0.12, ly = o.ly || 640;
    c.strokeStyle = C.dark; c.lineWidth = 6; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, ly - 86); c.stroke(); D.lamp(c, lx, ly, {}); }
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.14; c.drawImage(brushTex(), 0, 0); c.restore();
};
// 吊灯罩（自发光，不受光裁切）：D.lamp(c,x,y,{s})  (x,y) = 灯罩下缘中点
D.lamp = (c, x, y, o = {}) => { const s = o.s || 1; c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#9a7a3c'; c.fill(D.poly([[-30, -86], [30, -86], [96, 0], [-96, 0]])); c.fillStyle = C.amberD; c.fill(D.poly([[-30, -86], [0, -86], [0, 0], [-96, 0]]));
  c.fillStyle = '#fbe9b0'; c.fill(D.ellipse(0, 2, 80, 12)); c.restore(); };

// 每镜收尾：纸面颗粒＋字幕带 y1380–1560 压暗（深褐渐变，不放内容）
D.finish = (c, o = {}) => {
  c.drawImage(P.grain('hopper', 0.03, [50, 36, 24], 0.1), 0, 0);
  const b = c.createLinearGradient(0, 1340, 0, 1620); b.addColorStop(0, 'rgba(43,29,22,0)'); b.addColorStop(0.28, 'rgba(43,29,22,.72)'); b.addColorStop(0.72, 'rgba(43,29,22,.72)'); b.addColorStop(1, 'rgba(43,29,22,0)');
  c.fillStyle = b; c.fillRect(0, 1340, W, 280);
};

// ---------- 文字 ----------
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot }
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
// 大字：平涂＋硬投影（无描边）。size 至少 100。o { fam, shadow(深褐硬影，默认 true), shadowCol, rot, scale, alpha, maxW, align }
D.bigText = (c, s, x, y, size = 120, fill = C.cream, o = {}) => { size = Math.max(100, size); const { fam = 'PuHui-Black', shadow = true, rot = 0, scale = 1, alpha = 1, maxW = 0, shadowCol = 'rgba(30,18,12,.85)' } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; if (shadow) { c.fillStyle = shadowCol; c.fillText(s, size * 0.045, size * 0.055); } c.fillStyle = fill; c.fillText(s, 0, 0); c.restore(); };
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标题牌（招牌）：酒红底＋奶油边＋奶油大字，不受光裁切（字永远整块可读）。返回牌的底边 y。
// D.title(c, s, x, y, o)：(x,y) 牌心；o { size(≥100), w, h, lt, at（弹入）, alpha, fill, col, rot }
D.title = (c, s, x, y, o = {}) => { const size = Math.max(100, o.size || 128), lines = D.split2(s), n = lines.length, w = o.w || 940, h = o.h || (size * 1.28 * n + 40), k = o.lt != null ? D.pop(o.lt, o.at || 0, 0.5) : 1; if (k <= 0) return y + h / 2;
  const a = clamp(k * 2) * (o.alpha ?? 1); c.save(); c.globalAlpha *= a; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(k, k);
  c.fillStyle = 'rgba(30,18,12,.55)'; c.fillRect(-w / 2 + 12, -h / 2 + 14, w, h); c.fillStyle = C.cream; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = o.fill || C.wine; c.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
  lines.forEach((ln, i) => D.text(c, ln, 0, (i - (n - 1) / 2) * size * 1.2 + 3, { size, fam: 'PuHui-Black', col: o.col || C.cream, maxW: w - 70 })); c.restore(); return y + h / 2; };
// 标签板：奶油底＋深褐字（size ≥ 52），左侧红条表重点（hot）。返回宽度。o { size, fam, fill, col, scale, alpha, rot, hot, align:'left'(板左缘对齐 x) }
D.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 56), { fam = 'PuHui-Heavy', scale = 1, alpha = 1, rot = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const tw = c.measureText(s).width, w = tw + size * 1.2, h = size * 1.5, ox = o.align === 'left' ? w / 2 : 0;
  c.fillStyle = 'rgba(30,18,12,.6)'; c.fillRect(-w / 2 + ox + 8, -h / 2 + 9, w, h); c.fillStyle = o.fill || C.cream; c.fillRect(-w / 2 + ox, -h / 2, w, h);
  c.fillStyle = o.hot ? C.brick : C.wine; c.fillRect(-w / 2 + ox, -h / 2, 12, h);
  c.fillStyle = o.col || C.dark; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, ox + 6, 3); c.restore(); return w; };
// 弹出文字（backOut 过冲）：o.plate 为 true 用标签板，否则大字。o { size, fill, dur, alpha, rot, hot }
D.popText = (c, s, x, y, lt, at, o = {}) => { const k = D.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha ?? 1);
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else D.bigText(c, s, x, y, o.size || 120, o.fill || C.cream, { ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：奶油细线从 (ax,ay) 画向 (bx,by)，末端标签板逐字打出（约 20 字/秒）。o { size(≥52), hot, fill }
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = 'rgba(30,18,12,.7)'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax + 3, ay + 4); c.lineTo(lerp(ax, bx, p1) + 3, lerp(ay, by, p1) + 4); c.stroke();
  c.strokeStyle = C.cream; c.lineWidth = 6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = o.hot ? C.brick : C.cream; c.beginPath(); c.arc(ax, ay, 13 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; D.tag(c, TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20)), bx, by, { ...o, scale: q, size: Math.max(52, o.size || 54), align: 'left' }); };

// ---------- 牌（贯穿物：红菱形牌背） ----------
D.split2c = s => { const a = [...s]; return a.length <= 4 ? [s] : [a.slice(0, Math.ceil(a.length / 2)).join(''), a.slice(Math.ceil(a.length / 2)).join('')]; };
D.cardW = (text, size = 80) => Math.max(...D.split2c(text).map(l => [...l].length)) * size + 64;   // 容纳牌面字所需最小牌宽
const cardBack = (c, Pl, w, h) => { c.fillStyle = Pl.redL; c.fillRect(-w / 2, -h / 2, w, h); const iw = w - 22, ih = h - 22; c.fillStyle = Pl.red; c.fillRect(-iw / 2, -ih / 2, iw, ih);
  c.save(); c.beginPath(); c.rect(-iw / 2, -ih / 2, iw, ih); c.clip(); c.strokeStyle = Pl.redD; c.lineWidth = Math.max(4, w * 0.02); const st = Math.max(14, w * 0.2); c.beginPath();
  for (let k = -16; k < 16; k++) { c.moveTo(-w, k * st); c.lineTo(w, k * st + w * 2); c.moveTo(-w, k * st + w * 2); c.lineTo(w, k * st); } c.stroke(); c.restore();
  const r = Math.min(w, h) * 0.2; c.fillStyle = Pl.redL; c.fill(D.poly([[0, -r * 1.3], [r, 0], [0, r * 1.3], [-r, 0]])); c.fillStyle = Pl.red; c.fill(D.poly([[0, -r * 0.8], [r * 0.6, 0], [0, r * 0.8], [-r * 0.6, 0]])); };
const cardFace = (c, Pl, w, h, text, size, hot) => { c.fillStyle = Pl.cream; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = hot ? Pl.hot : Pl.creamT; c.lineWidth = 6; c.strokeRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
  const r = Math.min(w, h) * 0.05; [[-1, -1], [1, 1]].forEach(([sx, sy]) => { const px = sx * (w / 2 - 44), py = sy * (h / 2 - 44); c.fillStyle = Pl.hot; c.fill(D.poly([[px, py - r], [px + r * 0.8, py], [px, py + r], [px - r * 0.8, py]])); });
  if (text) { const ls = D.split2c(text); ls.forEach((ln, i) => D.text(c, ln, 0, (i - (ls.length - 1) / 2) * size * 1.18 + 4, { size, fam: 'PuHui-Black', col: hot ? Pl.hot : Pl.creamT, maxW: w - 50 })); } };
// 牌：D.card(c,x,y,w,h,o)：(x,y) 牌心；o { face 是否正面, flip 0..1（0 背→1 面，覆盖 face；翻到一半牌会抬起）, text 牌面字（≥80px，超 4 字自动两行；牌宽 ≥ K.cardW(text)）, hot 红字重点牌, rot, shadow(默认 true), alpha, scale, lift 抬起 px, size }
D.card = (c, x, y, w, h, o = {}) => { const f = o.flip != null ? clamp(o.flip) : (o.face ? 1 : 0), cs = Math.cos(f * Math.PI), sx = Math.max(0.03, Math.abs(cs)), face = f > 0.5, up = Math.sin(f * Math.PI) * h * 0.1 + (o.lift || 0), size = Math.max(80, o.size || 80);
  if ((o.scale ?? 1) <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y - up); if (o.rot) c.rotate(o.rot); if (o.scale != null) c.scale(o.scale, o.scale);
  if (o.shadow !== false) { c.fillStyle = 'rgba(12,8,6,.42)'; c.fill(D.poly([[-w / 2 * sx + 20, h / 2 + up], [w / 2 * sx + 24, h / 2 + up], [w / 2 * sx + 24 + up * 0.3, h / 2 + 26 + up * 1.2], [-w / 2 * sx + 44, h / 2 + 26 + up * 1.2]])); }
  c.scale(sx, 1); D.dual(c, (c, Pl) => { c.save(); face ? cardFace(c, Pl, w, h, o.text || '', size, o.hot) : cardBack(c, Pl, w, h); c.restore(); }); c.restore(); };
// 牌叠（背面朝上）：D.cardStack(c,x,y,n,{w,h})  (x,y) 最下面一张牌心
D.cardStack = (c, x, y, n, o = {}) => { const w = o.w || 300, h = o.h || 400; for (let i = 0; i < n; i++) D.card(c, x + U.hash(i, 5) * 8 - 4, y - i * 12, w, h, { rot: (U.hash(i, 6) - 0.5) * 0.04, shadow: i === 0 }); };

// ---------- 桌 / 窗 / 灯 / 椅 / 杯 / 屏 ----------
// 桌：D.table(c,o)：o { y 桌面后沿(默认 880), yf 前沿(1290), wb 后沿半宽(470) }。返回 { y, yf, pt(u,v) 桌面点 }（u 0..1 左右，v 0 后→1 前）
D.table = (c, o = {}) => { const y = o.y ?? 880, yf = o.yf ?? 1290, hb = o.wb ?? 470, xb0 = 540 - hb, xb1 = 540 + hb;
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.wood; c.fill(D.poly([[xb0, y], [xb1, y], [W + 70, yf], [-70, yf]]));
    c.strokeStyle = Pl.woodD; c.lineWidth = 3; for (let k = 1; k < 5; k++) { const v = k / 5, yy = lerp(y, yf, v), e = v * 70; c.beginPath(); c.moveTo(xb0 - e - (540 - hb < 0 ? 0 : 0), yy); c.lineTo(xb1 + e, yy); c.stroke(); }
    c.fillStyle = Pl.woodD; c.fillRect(-70, yf, W + 140, 22); c.fillStyle = Pl.apron; c.fillRect(-70, yf + 22, W + 140, 70); });
  return { y, yf, pt: (u, v) => [lerp(lerp(xb0, -70, v), lerp(xb1, W + 70, v), u), lerp(y, yf, v)] }; };
// 窗（墙上的窗框＋窗外景）：D.window(c,x,y,w,h,{view:'night'|'day'|'street'|'dark', blind 0..1 卷帘下拉})
D.window = (c, x, y, w, h, o = {}) => { const view = o.view || 'night';
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.trim; c.fillRect(x - 18, y - 18, w + 36, h + 36); });
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (view === 'day') { c.fillStyle = '#b9d2c2'; c.fillRect(x, y, w, h); c.fillStyle = '#E9C887'; c.fill(D.circle(x + w * 0.74, y + h * 0.26, w * 0.12)); c.fillStyle = '#4F7A68'; c.fillRect(x, y + h * 0.7, w, h * 0.3); }
  else if (view === 'street') { c.fillStyle = '#6f9a8b'; c.fillRect(x, y, w, h); for (let i = 0; i < 4; i++) { const bw = w / 4, bh = h * (0.4 + U.hash(i, 21) * 0.4); c.fillStyle = i % 2 ? '#8d4331' : '#6d3224'; c.fillRect(x + i * bw, y + h - bh, bw - 4, bh);
      for (let k = 0; k < 6; k++) { c.fillStyle = U.hash(i * 7 + k, 4) > 0.5 ? '#E9C887' : '#2B1D16'; c.fillRect(x + i * bw + 10 + (k % 2) * 30, y + h - bh + 16 + Math.floor(k / 2) * 34, 16, 20); } } }
  else if (view === 'night') { c.fillStyle = '#10201f'; c.fillRect(x, y, w, h); for (let i = 0; i < 5; i++) { const bw = w / 5, bh = h * (0.25 + U.hash(i, 31) * 0.45); c.fillStyle = '#0a1514'; c.fillRect(x + i * bw, y + h - bh, bw - 4, bh);
      for (let k = 0; k < 8; k++) if (U.hash(i * 9 + k, 5) > 0.5) { c.fillStyle = '#E9C887'; c.fillRect(x + i * bw + 8 + (k % 2) * 26, y + h - bh + 14 + Math.floor(k / 2) * 30, 14, 18); } } }
  else { c.fillStyle = '#10201f'; c.fillRect(x, y, w, h); }
  if (o.blind) { const bh = h * clamp(o.blind); c.fillStyle = '#c9bf9f'; c.fillRect(x, y, w, bh); c.fillStyle = '#a89c7a'; for (let k = 1; k * 26 < bh; k++) c.fillRect(x, y + k * 26 - 3, w, 3); c.fillStyle = '#7a2c2a'; c.fillRect(x + w / 2 - 6, y + bh, 12, 40); }
  c.restore();
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.trim; c.fillRect(x + w / 2 - 7, y, 14, h); c.fillRect(x, y + h * 0.45, w, 12); c.fillStyle = Pl.wallD; c.fillRect(x - 34, y + h + 18, w + 68, 18); }); };
// 台灯（桌上，自发光灯罩）：D.deskLamp(c,x,y,{s})  (x,y) 底座中点
D.deskLamp = (c, x, y, o = {}) => { const s = o.s || 1; c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#2B1D16'; c.fillRect(-60, -16, 120, 16); c.fillRect(-8, -150, 16, 140);
  c.strokeStyle = '#2B1D16'; c.lineWidth = 14; c.beginPath(); c.moveTo(0, -150); c.lineTo(70, -250); c.stroke(); c.fillStyle = '#c9a45a'; c.fill(D.poly([[30, -250], [110, -290], [140, -220], [60, -190]])); c.fillStyle = '#fbe9b0'; c.fill(D.poly([[60, -190], [140, -220], [150, -200], [66, -172]])); c.restore(); };
// 椅（正面看到的椅背，坐桌人身后）：D.chair(c,x,y,{s}) (x,y) 椅面中点
D.chair = (c, x, y, o = {}) => { const s = o.s || 1; c.save(); c.translate(x, y); c.scale(s, s);
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.woodD; c.fillRect(-110, -330, 220, 270); c.fillStyle = Pl.wood; c.fillRect(-92, -312, 184, 234); c.fillStyle = Pl.woodD; c.fillRect(-120, -60, 240, 30); c.fillRect(-100, -30, 22, 220); c.fillRect(78, -30, 22, 220); }); c.restore(); };
// 杯（带热气）：D.mug(c,x,y,t,{s,steam})  (x,y) 杯底中点
D.mug = (c, x, y, t = 0, o = {}) => { const s = o.s || 1; c.save(); c.translate(x, y); c.scale(s, s);
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.cream; c.fillRect(-46, -92, 92, 92); c.strokeStyle = Pl.cream; c.lineWidth = 16; c.beginPath(); c.arc(54, -46, 28, -1.2, 1.2); c.stroke(); c.fillStyle = Pl.redD; c.fillRect(-46, -92, 92, 14); });
  if (o.steam !== false) { c.strokeStyle = 'rgba(245,235,211,.5)'; c.lineWidth = 9; c.lineCap = 'round'; for (let i = 0; i < 2; i++) { c.beginPath(); for (let k = 0; k <= 10; k++) { const yy = -110 - k * 12, xx = (i ? 16 : -16) + Math.sin(t * 2 + k * 0.7 + i * 2) * 9; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); } } c.restore(); };
// 屏（显示器）：D.screen(c,x,y,w,h,fn)：fn(c) 在屏幕内容区里画（屏幕坐标），自发光，不受光裁切
D.screen = (c, x, y, w, h, fn) => { D.dual(c, (c, Pl) => { c.fillStyle = Pl.coatD; c.fillRect(x - 24, y - 24, w + 48, h + 48); c.fillStyle = Pl.metal; c.fillRect(x + w / 2 - 50, y + h + 24, 100, 50); c.fillRect(x + w / 2 - 120, y + h + 70, 240, 20); });
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = C.board; c.fillRect(x, y, w, h); if (fn) fn(c); c.restore(); };

// ---------- 人：无脸剪影 / 手 ----------
// 剪影人：D.figure(c,x,y,o)：o { pose 'stand'|'back'|'sit'|'slump'|'think', s 缩放(默认 0.8), f 朝向 ±1, coat 衣色键(默认 'coat'), hair 发色键, t 时间(呼吸), hi 红衣重点 }
//   stand/back：(x,y) 脚底中点，身高约 800·s；sit/slump/think：坐在桌后，(x,y) = 桌面中心（腹部以下被桌挡住，先画人再画桌），到头顶约 560·s。无五官。
D.figure = (c, x, y, o = {}) => { const { pose = 'stand', s = 0.8, f = 1, t = 0 } = o, br = Math.sin(t * 1.6) * 2.5, ck = o.hi ? 'red' : (o.coat || 'coat'), cdk = o.hi ? 'redD' : 'coatD', ret = { head: [x, y], handL: [x, y], handR: [x, y] };
  D.dual(c, (c, Pl) => { c.save(); c.translate(x, y); c.scale(s * f, s);
    const coat = Pl[ck], coatD = Pl[cdk], skin = Pl.skin, skinD = Pl.skinD, hair = Pl[o.hair || 'hair'], shirt = Pl.shirt;
    const head = (hx, hy, tilt, back) => { c.save(); c.translate(hx, hy); c.rotate(tilt); c.fillStyle = skin; c.fill(D.ellipse(0, 0, 50, 62));
      if (!back) { c.fillStyle = skinD; c.beginPath(); c.ellipse(0, 0, 50, 62, 0, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill(); }
      c.fillStyle = hair; if (back) c.fill(D.ellipse(0, -2, 54, 66)); else { c.beginPath(); c.ellipse(0, -6, 54, 58, 0, Math.PI, TAU); c.closePath(); c.fill(); c.fillRect(-54, -8, 22, 40); } c.restore(); };
    if (pose === 'stand' || pose === 'back') { const bk = pose === 'back';
      c.fillStyle = Pl.pants; c.fill(D.poly([[-72, -340], [-4, -340], [-6, 0], [-70, 0]])); c.fill(D.poly([[4, -340], [72, -340], [70, 0], [6, 0]])); c.fillStyle = '#1b120d'; c.fillRect(-82, -18, 80, 18); c.fillRect(2, -18, 80, 18);
      c.fillStyle = coat; c.fill(D.poly([[-118, -650 + br], [118, -650 + br], [104, -300], [-104, -300]])); c.fillStyle = coatD; c.fill(D.poly([[30, -650 + br], [118, -650 + br], [104, -300], [30, -300]]));
      if (!bk) { c.fillStyle = shirt; c.fill(D.poly([[-26, -650], [26, -650], [0, -560]])); }
      c.fillStyle = coat; c.fill(D.poly([[-148, -640 + br], [-108, -640 + br], [-110, -330], [-150, -338]])); c.fillStyle = coatD; c.fill(D.poly([[108, -640 + br], [148, -640 + br], [150, -338], [110, -330]]));
      c.fillStyle = skin; rr(c, -156, -352, 52, 62, 22); c.fill(); rr(c, 104, -352, 52, 62, 22); c.fill(); c.fillStyle = skin; c.fillRect(-20, -690 + br, 40, 48); head(0, -740 + br, 0, bk); ret.head = [x, y - 740 * s]; }
    else { const sl = pose === 'slump', th = pose === 'think', dy = sl ? 46 : 0, hx = sl ? 26 : 0;
      c.fillStyle = coat; c.fill(D.poly([[-124, -330 + dy + br], [124, -330 + dy + br], [150, 40], [-150, 40]])); c.fillStyle = coatD; c.fill(D.poly([[30, -330 + dy + br], [124, -330 + dy + br], [150, 40], [30, 40]]));
      c.fillStyle = shirt; c.fill(D.poly([[-26, -330 + dy], [26, -330 + dy], [0, -250 + dy]]));
      c.fillStyle = skin; c.fillRect(-20 + hx * 0.5, -372 + dy + br, 40, 48); head(hx, -424 + dy + br + (sl ? 14 : 0), sl ? 0.18 : 0, false);
      const arm = (sg, up) => { c.fillStyle = sg < 0 ? coat : coatD; if (up) { c.fill(D.poly([[sg * 110, -320 + dy], [sg * 150, -300 + dy], [sg * 126, -150 + dy], [sg * 70, -270 + dy]])); c.fillStyle = skin; rr(c, sg * 126 - 70, -340 + dy, 74, 70, 26); c.fill(); }
        else { c.fill(D.poly([[sg * 112, -320 + dy], [sg * 152, -300 + dy], [sg * 168, 10], [sg * 112, 20]])); c.fillStyle = skin; rr(c, sg * 150 - 40, 6, 80, 54, 24); c.fill(); } };
      arm(-1, th); arm(1, false); ret.head = [x + hx * s * f, y + (-424 + dy) * s]; ret.handL = [x - 150 * s * f, y + 30 * s]; ret.handR = [x + 150 * s * f, y + 30 * s]; }
    c.restore(); });
  return ret; };
// 人群：D.crowd(c,x,y,w,n,o)：一排 n 个背影半身（头＋肩）。(x,y) 肩线中点，w 总宽；o { s, hi 第几个穿红, seed, t }
D.crowd = (c, x, y, w, n, o = {}) => { const s = o.s || 1, seed = o.seed || 3, step = w / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) { const px = n === 1 ? x : x - w / 2 + i * step, h0 = 0.85 + U.hash(i, seed) * 0.3, hot = o.hi === i, cols = ['coat', 'pants', 'coatD'], ck = hot ? 'red' : cols[Math.floor(U.hash(i, seed + 1) * 3)], bob = Math.sin((o.t || 0) * 1.3 + i * 1.7) * 2;
    D.dual(c, (c, Pl) => { c.save(); c.translate(px, y + bob); c.scale(s * h0, s * h0); c.fillStyle = Pl[ck]; c.fill(D.poly([[-84, 0], [-70, -110], [-30, -140], [30, -140], [70, -110], [84, 0]])); c.fillStyle = Pl.skin; c.fillRect(-16, -170, 32, 36);
      c.fillStyle = Pl[hot ? 'redD' : 'hair']; c.fill(D.ellipse(0, -210, 42, 52)); c.restore(); }); } };
// 手：D.hand(c,x,y,o)：(x,y) 手腕；袖子从左（−x）伸来，手指朝 +x。o { pose 'open'|'point'|'pinch'|'fist'|'flat', rot 弧度, s 缩放(默认 1), f 镜像 ±1, sleeve 袖色键('sleeve'|'coat'|'red') }
//   体量大：掌 ≈ 130px，指粗 ≈ 32px。返回指尖点 [x,y]。
D.hand = (c, x, y, o = {}) => { const { pose = 'open', rot = 0, s = 1, f = 1, sleeve = 'sleeve' } = o, k = ({ open: 190, point: 240, pinch: 210, fist: 140, flat: 200 })[pose] || 190;
  D.dual(c, (c, Pl) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * f, s);
    const bone = (bx, by, len, th, ang, col) => { c.save(); c.translate(bx, by); c.rotate(ang); c.fillStyle = col; rr(c, 0, -th / 2, len, th, th / 2); c.fill(); c.restore(); };
    c.fillStyle = Pl[sleeve]; c.fill(D.poly([[-640, -84], [-46, -70], [-46, 76], [-640, 140]])); c.fillStyle = Pl[sleeve === 'sleeve' ? 'coatD' : sleeve]; c.fill(D.poly([[-640, 40], [-46, 24], [-46, 76], [-640, 140]]));
    c.fillStyle = Pl.cuff; c.fill(D.poly([[-66, -74], [-18, -70], [-18, 78], [-66, 84]]));
    c.fillStyle = Pl.skin; rr(c, -22, -62, 128, 124, 30); c.fill(); c.fillStyle = Pl.skinD; rr(c, -22, 24, 128, 38, 18); c.fill();
    if (pose === 'open' || pose === 'flat') { [-46, -15, 16, 47].forEach((fy, i) => { const len = 98 - Math.abs(i - 1.3) * 12; bone(96, fy, len, 31, (i - 1.5) * (pose === 'flat' ? 0.03 : 0.1), Pl.skin); bone(104, fy + 14, len - 10, 6, (i - 1.5) * 0.1, Pl.skinD); }); bone(10, -66, 96, 36, -0.78, Pl.skin); }
    else if (pose === 'point') { bone(96, -34, 140, 34, 0, Pl.skin); [-2, 28, 56].forEach(fy => { bone(88, fy, 52, 30, 0.05, Pl.skinD); bone(88, fy - 3, 48, 28, 0.05, Pl.skin); }); bone(2, -66, 86, 36, -0.5, Pl.skin); }
    else if (pose === 'pinch') { bone(96, -28, 110, 32, 0.16, Pl.skin); bone(40, -70, 100, 34, 0.5, Pl.skin); [10, 38].forEach(fy => bone(88, fy, 56, 30, 0.1, Pl.skin)); }
    else { [-44, -14, 16, 46].forEach(fy => { bone(90, fy - 4, 52, 31, 0, Pl.skin); }); bone(0, -64, 84, 36, -0.25, Pl.skin); }
    c.restore(); });
  return [x + k * s * f * Math.cos(rot), y + k * s * f * Math.sin(rot)]; };

// ---------- 筹码 / 数据图（示意） ----------
// 筹码叠：D.chips(c,x,y,n,o)：n 枚（可小数，逐枚长出），(x,y) 最底一枚底面中点；o { rx 半宽(70), th 每枚厚(24), cols 色键轮换(默认 cream/red/coat), hot 顶枚红 }。返回顶面 y
D.chips = (c, x, y, n, o = {}) => { const rx = o.rx || 70, ry = rx * 0.3, th = o.th || 24, cols = o.cols || ['cream', 'red', 'coat']; if (n <= 0.001) return y; const N = Math.ceil(n);
  D.dual(c, (c, Pl) => { c.fillStyle = Pl.shadow; c.fill(D.poly([[x - rx + 14, y], [x + rx + 40, y + 10], [x + rx + 80, y + ry + 10], [x - rx + 40, y + ry + 4]]));
    for (let k = 0; k < N; k++) { const fr = Math.min(1, n - k), yb = y - k * th, h = th * fr, col = Pl[(o.hot && k === N - 1) ? 'red' : cols[k % cols.length]];
      c.fillStyle = col; c.beginPath(); c.moveTo(x - rx, yb); c.lineTo(x - rx, yb - h); c.ellipse(x, yb - h, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, yb); c.ellipse(x, yb, rx, ry, 0, 0, Math.PI); c.closePath(); c.fill();
      c.fillStyle = 'rgba(30,18,12,.28)'; c.fillRect(x + rx * 0.35, yb - h, rx * 0.65, h); c.fillStyle = col; c.fill(D.ellipse(x, yb - h, rx, ry)); c.strokeStyle = Pl.cream; c.lineWidth = 5; c.beginPath(); c.ellipse(x, yb - h, rx * 0.62, ry * 0.62, 0, 0, TAU); c.stroke(); } });
  return y - n * th; };
// 确定性序列：D.series(n, seed, {trend 总漂移, vol 波动, start}) → 0..1 的 n 个值
D.series = (n, seed = 1, o = {}) => { const { trend = 0.4, vol = 0.1 } = o, r = U.rng(seed * 977 + 13); let v = o.start ?? (0.5 - trend / 2); const a = []; for (let i = 0; i < n; i++) { a.push(clamp(v, 0.03, 0.97)); v += trend / (n - 1) + (r() - 0.5) * vol; } return a; };
D.mapPts = (vals, x, y, w, h) => vals.map((v, i) => [x + w * i / Math.max(1, vals.length - 1), y + h * (1 - v)]);
D.shiyi = (c, x, y) => D.tag(c, '示意', x, y, { size: 52, fill: C.amber, align: 'left' });
// 面板（深青底＋奶油边的数据板，自发光）：D.board(c,x,y,w,h,o,fn)：o { alpha, scale }；fn(c) 内容（屏幕坐标）
D.board = (c, x, y, w, h, o = {}, fn) => { const k = o.scale ?? 1; if (k <= 0) return; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x + w / 2, y + h / 2); c.scale(k, k); c.translate(-x - w / 2, -y - h / 2);
  c.fillStyle = 'rgba(12,8,6,.5)'; c.fillRect(x + 14, y + 16, w, h); c.fillStyle = C.cream; c.fillRect(x, y, w, h); c.fillStyle = C.board; c.fillRect(x + 10, y + 10, w - 20, h - 20);
  c.save(); c.beginPath(); c.rect(x + 10, y + 10, w - 20, h - 20); c.clip(); if (fn) fn(c); c.restore(); c.restore(); };
// 折线图：D.line(c,x,y,w,h,vals,o)：vals 0..1；o { p 画到哪(0..1), down 下跌(砖红)/默认琥珀, col, lw(10), area 面积, grid, dot 笔尖点, note 画「示意」(默认 true) }。返回笔尖 [x,y]
D.line = (c, x, y, w, h, vals, o = {}) => { const pts = D.mapPts(vals, x, y, w, h), p = clamp(o.p ?? 1), col = o.col || (o.down ? C.brick : C.amber);
  if (o.grid !== false) { c.strokeStyle = 'rgba(245,235,211,.16)'; c.lineWidth = 3; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y + h * k / 3); c.lineTo(x + w, y + h * k / 3); c.stroke(); } }
  c.strokeStyle = C.cream; c.lineWidth = 6; c.lineCap = 'square'; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x, y + h + 3); c.lineTo(x + w + 10, y + h + 3); c.stroke();
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const want = L[L.length - 1] * p, q = [pts[0]];
  for (let i = 1; i < pts.length; i++) { if (L[i] <= want) q.push(pts[i]); else { const f = (want - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); q.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
  if (o.area && q.length > 1) { c.save(); c.globalAlpha *= 0.2; c.fillStyle = col; c.fill(D.poly([...q, [q[q.length - 1][0], y + h], [q[0][0], y + h]])); c.restore(); }
  c.strokeStyle = col; c.lineWidth = o.lw || 10; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(D.poly(q, false)); const e = q[q.length - 1];
  if (o.dot !== false && q.length > 1) { c.fillStyle = C.cream; c.fill(D.circle(e[0], e[1], 15)); c.strokeStyle = col; c.lineWidth = 7; c.stroke(D.circle(e[0], e[1], 15)); }
  if (o.note !== false) D.shiyi(c, x + 10, y + h + 56); return e; };
// 柱状图：D.bars(c,x,y,w,h,vals,o)：(x,y) 左上角，vals 0..1；o { p 生长进度, hi 红柱序号(重点), gap, labels[]（底部，≥52px，字少用）, note }
D.bars = (c, x, y, w, h, vals, o = {}) => { const n = vals.length, gap = o.gap ?? 22, bw = (w - gap * (n - 1)) / n, p = o.p ?? 1, tops = [];
  vals.forEach((v, i) => { const g = D.ease(clamp(p * (1 + 0.5 * (n - 1) / n) - i * 0.5 / n)), bh = Math.max(0, h * v * g), bx = x + i * (bw + gap); c.fillStyle = i === o.hi ? C.brick : (i % 2 ? C.amber : C.cream); c.fillRect(bx, y + h - bh, bw, bh);
    c.fillStyle = 'rgba(30,18,12,.22)'; c.fillRect(bx + bw * 0.62, y + h - bh, bw * 0.38, bh); if (o.labels && o.labels[i]) D.text(c, o.labels[i], bx + bw / 2, y + h + 50, { size: 52, fam: 'PuHui-Heavy', col: C.cream, maxW: bw + gap }); tops.push([bx + bw / 2, y + h - bh]); });
  c.fillStyle = C.cream; c.fillRect(x - 12, y + h, w + 24, 6); if (o.note !== false) D.shiyi(c, x + 6, y - 40); return tops; };
// 仓位条：D.posBar(c,x,y,w,h,pct,o)：pct 0..1；o { p 0..1 填充动画, hot 超高仓位变红, label(默认 'NN%'), note 画「示意」(默认 false) }
D.posBar = (c, x, y, w, h, pct, o = {}) => { const v = pct * D.ease(o.p ?? 1), hot = o.hot ?? pct > 0.8; c.fillStyle = 'rgba(12,8,6,.5)'; c.fillRect(x + 10, y + 12, w, h); c.fillStyle = C.cream; c.fillRect(x - 8, y - 8, w + 16, h + 16); c.fillStyle = C.board; c.fillRect(x, y, w, h);
  c.fillStyle = hot ? C.brick : C.amber; c.fillRect(x, y, w * v, h); c.fillStyle = 'rgba(30,18,12,.25)'; c.fillRect(x, y + h * 0.62, w * v, h * 0.38);
  c.fillStyle = C.dark; [0.25, 0.5, 0.75].forEach(f => c.fillRect(x + w * f - 3, y, 6, h * 0.28)); const lb = o.label ?? Math.round(v * 100) + '%';
  c.font = '96px "PuHui-Black"'; const lw = c.measureText(lb).width + 70; c.fillStyle = 'rgba(12,8,6,.5)'; c.fillRect(x + w / 2 - lw / 2 + 8, y - 146 + 9, lw, 124); c.fillStyle = C.board; c.fillRect(x + w / 2 - lw / 2, y - 146, lw, 124); c.strokeStyle = C.cream; c.lineWidth = 6; c.strokeRect(x + w / 2 - lw / 2, y - 146, lw, 124);
  D.text(c, lb, x + w / 2, y - 82, { size: 96, fam: 'PuHui-Black', col: hot ? C.brick : C.cream, align: 'center' }); if (o.note) D.shiyi(c, x + 6, y + h + 64); };
// K 线（示意）：D.candles(n,seed,o) 生成 [[开,收,高,低]…]（0..1）；D.kline(c,x,y,w,h,candles,{p 画到哪})（A 股习惯：涨红跌青）
D.candles = (n, seed = 1, o = {}) => { const s = D.series(n + 1, seed, o), r = U.rng(seed * 31 + 7); return Array.from({ length: n }, (_, i) => { const a = s[i], b = s[i + 1]; return [a, b, Math.max(a, b) + r() * 0.05, Math.min(a, b) - r() * 0.05]; }); };
D.kline = (c, x, y, w, h, cs, o = {}) => { const n = cs.length, bw = w / n * 0.62, k = Math.ceil(n * clamp(o.p ?? 1)); c.fillStyle = 'rgba(245,235,211,.14)'; for (let i = 0; i < 4; i++) c.fillRect(x, y + h * i / 3, w, 3);
  for (let i = 0; i < k; i++) { const [a, b, hi, lo] = cs[i], cx = x + w * (i + 0.5) / n, up = b >= a, col = up ? C.brick : '#6FA58E', Y = v => y + h * (1 - v);
    c.fillStyle = col; c.fillRect(cx - 3, Y(hi), 6, Y(lo) - Y(hi)); c.fillRect(cx - bw / 2, Math.min(Y(a), Y(b)), bw, Math.max(6, Math.abs(Y(a) - Y(b)))); }
  if (o.note !== false) D.shiyi(c, x + 6, y + h + 56); };
})();

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 四种底轮换（室内/百叶/街/夜窗）。标题区整块在暗里（光斑从标题区以下起）；酒红招牌「第 N 章」＋章名逐字打出；
// 桌沿上 N 站进度：贯穿物（一张红菱形牌背）跳到本站。换书可改 D.cardToken。
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.CARD_KINDS = [{ kind: 'room' }, { kind: 'blinds' }, { kind: 'street' }, { kind: 'night' }];
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking, arriveAt, o) => D.card(c, x, y, 112, 152, { rot: walking ? Math.sin(lt * 9) * 0.25 : 0, shadow: false }));
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const k = D.CARD_KINDS[(n - 1) % D.CARD_KINDS.length];
  D.bg(c, t, { ...k, title: 'dark', zone: [150, 800], phase: n, ly: 930 });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 110, x1 = 970, y = 1180, X = i => lerp(x0, x1, i / (N - 1));
  D.table(c, { y: 1020, yf: 1310, wb: 520 });
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  c.strokeStyle = 'rgba(30,18,12,.55)'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, y + 6); c.lineTo(x1 + 20, y + 6); c.stroke(); c.strokeStyle = C.cream; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 20, y); c.stroke();
  c.strokeStyle = C.amber; c.lineWidth = 8; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(Math.max(x0 - 20, lerp(from, done, q)), y); c.stroke();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? D.pop(lt, walkEnd, 0.45) : 1, r = cur ? 20 * Math.max(0.6, pp) : 11; c.fillStyle = past ? C.amber : cur ? C.brick : C.cream; c.fill(D.poly([[X(i), y - r], [X(i) + r * 0.8, y], [X(i), y + r], [X(i) - r * 0.8, y]])); }
  const tx = lerp(from, done, q), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 40 : -Math.max(0, 1 - (lt - walkEnd) * 4) * 14; D.cardToken(c, tx, y - 100 + hop, lt, t, lt < walkEnd, walkEnd, o);
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 108 : all > 6 ? 104 : 128;
  const s1 = D.ease(D.at(lt, 0.08, 0.4)); if (s1 > 0) { c.save(); c.globalAlpha *= s1; c.translate(-(1 - s1) * 160, 0); D.title(c, `第 ${n} 章`, 540, 270, { size: 132, w: 620, h: 190, fill: C.brick }); c.restore(); }
  const s2 = D.ease(D.at(lt, 0.4, 0.4)); if (s2 > 0) { const bh = lines.length > 1 ? 330 : 220, by = 410; c.save(); c.globalAlpha *= s2; c.translate((1 - s2) * 160, 0);
    c.fillStyle = 'rgba(30,18,12,.55)'; c.fillRect(70 + 12, by + 14, 940, bh); c.fillStyle = C.cream; c.fillRect(70, by, 940, bh); c.fillStyle = C.wine; c.fillRect(80, by + 10, 920, bh - 20);
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length; if (kk > 0) D.text(c, a.slice(0, kk).join(''), 540, by + bh / 2 + (i - (lines.length - 1) / 2) * size * 1.2 + 3, { size, fam: 'PuHui-Black', maxW: 860, col: C.cream }); }); c.restore(); }
  D.finish(c, o);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：深褐底板＋奶油字＋琥珀硬投影，字幕带 y≈1480，让开视频号底栏
(() => { const D = K, C = D.C;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = C.amber; c.fillRect(x - w / 2 + 7, y - h / 2 + 8, w, h);
  c.fillStyle = 'rgba(32,20,14,.95)'; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = C.cream; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
