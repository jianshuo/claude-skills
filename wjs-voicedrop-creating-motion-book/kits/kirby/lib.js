// 画风套件 kirby（配方 huashu-art-motion 27_kirby「1966 漫威 Kirby 四色胶印」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K 或直接用 K）。
// ================================ 规矩（章节 agent 必读） ================================
// 1. 色板纪律：全片只有五色——纸 #F2E9D8、黑 #111111、红 #D93636、蓝 #2B3FA0、黄 #F2C230（K.C）。
//    禁真灰色块、禁一切渐变：灰阶只能靠「黑排线密度」(K.hatch / K.kirbyShade) 和「本戴点密度」(K.dots / K.dotFill) 做出来。
//    红=下跌/危险/敌方，蓝=上涨/盟军/冷静信息，黄=星爆/强调/数字标签。不要发明第六种颜色（白 K.C.white 只用于标签底和墨线层留白，不作纸底）。
// 2. 套色错位：K.ink 的平涂填充自动按 K.MIS=[4,3] 偏移、黑描边不偏移——这就是四色胶印的套色不准，全片固定 3-5px、方向固定，
//    不要改 K.MIS，不要自己再叠随机偏移。精密小几何（齿孔、坐标轴、小刻度）调用时传 {reg:0} 关掉错位。
// 3. 排线纪律：排线/羽化线距 ≥ 8px（视频号二压会糊），K.hatch / K.kirbyShade 的 gap 传小了会被钳到 8 并警告一次。
// 4. 格子纪律：单屏 ≤ 4 格（K.panel），每屏有且仅有一个 3 秒信息焦点（大图或大数字）；格内副标题 ≥42px。
// 5. 数据纪律：数据图表占屏 ≥50%（K.chart 直接给 x,y,w,h，照 960×700 以上给）；数字一律用黄底黑字标签钉在曲线上（chart 的 tags 参数），不放图例。
// 6. 贯穿物「行情纸带」K.tape：每章必出现——章首从顶部吐入印时间锚点（K.chapterCard 已内置），叙事章穿行格间（越危急 o.crumple/o.tear 越大），
//    数据章当图表坐标纸（K.chart 的 base:'tape'），章尾可印金句。反例章（珍珠港）用纸带撕断 {tear:0.5} 让贯穿物失效。
// 7. 战时降档 {war:true}：真实战役伤亡场景，bg/panel/chart/caption/tag 等所有函数都认 o.war（或整章统一传）——切 K.C.war 三色降饱和（黑＋纸＋单一红或蓝），
//    拟声词 K.soundFx 在 war 下拒绝绘制并 console.warn（伤亡不用 BOOM!）；krackle 只许用于「市场/信息」层面（曲线反转），不许用于炸弹。
//    重大伤亡节点用「黑格默哀」K.mourn：全黑格＋一行小号白字（日期＋事件），比任何画面都重。
// 8. 人物纪律：不画脸。只出 K.hand（袖＋手，纸色皮肤＋红点网屏）和 K.figure（黑块剪影），需要表情就用姿势和排线密度。
// 9. 字：标题/标签 PuHui-Black、数字标签 PuHui-Heavy、字幕 PuHui-Bold（引擎自带，GB2312 子集，屏上字别超 GB2312）；英文美术字用引擎自带 Bangers-400（K.eng 自动挑）。
// 10. 收尾：每镜最后调 K.finish（纸面颗粒＋字幕带 y1380–1560 压暗，字幕带里别放关键物）；字幕走 K.subtitle（y≈1480）。
// 11. 确定性：所有随机走 U.hash / U.rng + 12fps 换种子（K.jit / K.krackle / K.speedLines 已内置），同 t 两帧逐像素一致；不要用 Math.random。
// ======================================================================================
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：回弹/outBack 起步段会把「r − 线宽」之类算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__kirby) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__kirby = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__kirby) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__kirby = 1; } }
const warns = {}; const warnOnce = (k, msg) => { if (!warns[k]) { warns[k] = 1; console.warn('[kirby] ' + msg); } };
K._warnOnce = warnOnce;

// ---------- 色板 ----------
const C = K.C = {
  paper: '#F2E9D8', ink: '#111111', red: '#D93636', blue: '#2B3FA0', yellow: '#F2C230', white: '#FBF6E8',
};
// 战时降档：黑＋纸＋单一红/蓝的三色印刷（模拟战时油墨短缺）。同键降饱和。函数里传 {war:true} 启用；war 格内只用红蓝其一。
C.war = { paper: '#DFD3B6', ink: '#111111', red: '#9E3D32', blue: '#3E4A80', yellow: '#C19A38', white: '#E9E0C8' };
K.pal = o => (o === true || (o && o.war)) ? C.war : C;
K.MIS = [4, 3];                                   // 套色错位量（规矩 2，别改）
K.LIGHT = [-0.86, -0.5];                          // 全片统一光向（左上窗光），kirbyShade/hatch 默认沿它
K.SCREEN = { blue: 15, red: 75, yellow: 0, ink: 45 };   // 四色网屏角（K.dots 的 o.angle 可引用）

// ---------- 进度 / 缓存 / 相机 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
// 12fps 抖动：K.jit(lt, seed, amp) → [-amp, amp]（同一 lt 同一值；爆炸框/拟声字用）
K.jit = (lt, seed = 1, amp = 3) => (U.hash(Math.floor(lt * 12), seed) - 0.5) * 2 * amp;

// ---------- 基础：路径 ----------
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);

// ---------- 画法核心 ----------
// 粗黑描边平涂。fill 自动按 K.MIS 套色错位、描边不动（规矩 2）；精密几何传 o {reg:0} 关错位；lw=0 只填不描。
K.ink = (c, p, fill, lw = 7, col, o = {}) => {
  if (fill) { c.save(); if (o.reg !== 0 && o.reg !== false) c.translate(K.MIS[0], K.MIS[1]); c.fillStyle = fill; c.fill(p); c.restore(); }
  if (lw > 0) { c.strokeStyle = col || C.ink; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
};
// 本戴点 pattern：pitch 点距、r 点半径、col 点色；o {bg 底色, angle 网屏角（缺省 45，四色角见 K.SCREEN）}。图案对齐屏幕坐标。
K.dots = (c, pitch = 10, r = 2.6, col, o = {}) => {
  col = col || K.pal(o).blue; const ang = o.angle != null ? o.angle : 45;
  return P.dotPattern(c, `kb_${pitch}_${r}_${col}_${o.bg || ''}_${ang}`, pitch, r, col, o.bg || null, ang);
};
// 用点填一条路径：K.dotFill(c, path, o {pitch, r, col, bg, alpha, angle})
K.dotFill = (c, p, o = {}) => { const { pitch = 11, r = 3.2, alpha = 1 } = o;
  c.save(); c.clip(p); if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, W, H); } c.globalAlpha *= alpha; c.fillStyle = K.dots(c, pitch, r, o.col, o); c.fillRect(0, 0, W, H); c.restore(); };
// 排线（矩形区域内，沿光向）：gap 下限 8px（规矩 3）。o {a 角度（缺省沿 K.LIGHT）, col, alpha, war}
K.hatch = (c, x0, y0, x1, y1, gap = 12, lw = 3, o = {}) => {
  if (gap < 8) { warnOnce('gap', '排线线距 <8px 已钳到 8（视频号二压会糊）：K.hatch / K.kirbyShade 的 gap 最小 8'); gap = 8; }
  const a = o.a != null ? o.a : Math.atan2(K.LIGHT[1], K.LIGHT[0]), p = K.pal(o);
  c.save(); c.globalAlpha *= o.alpha != null ? o.alpha : 1;
  c.beginPath(); c.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); c.clip();
  c.translate((x0 + x1) / 2, (y0 + y1) / 2); c.rotate(a);
  const L = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  c.strokeStyle = o.col || p.ink; c.lineWidth = lw; c.lineCap = 'butt'; c.beginPath();
  for (let k = -L; k <= L; k += gap) { c.moveTo(k, -L); c.lineTo(k, L); }
  c.stroke(); c.restore();
};
// Kirby 黑块阴影＋羽化排线（spotted blacks＋feathering）：光向 o.light（缺省 K.LIGHT，全片别改），
// o {d1 黑块宽 14, d2 羽化带宽 30, gap 排线距 ≥8, lw 排线宽, war}。path 在哪个坐标系定义，光向就在哪个坐标系生效。
K.kirbyShade = (c, path, o = {}) => {
  const gap = Math.max(8, o.gap || 9); if (o.gap && o.gap < 8) warnOnce('gap', '排线线距 <8px 已钳到 8');
  P.kirbyShade(c, path, { d1: o.d1 != null ? o.d1 : 14, d2: o.d2 != null ? o.d2 : 30, gap, light: o.light || K.LIGHT, ink: K.pal(o).ink, lw: o.lw || 2.6 });
};
// Kirby krackle 能量点簇：一簇黑圆，12fps 换种子，sin 脉动。o {n 点数 22, seed, col, squash 纵向压扁 0.8, war}。只许用于市场/信息能量（规矩 7）。
K.krackle = (c, x, y, R, t, o = {}) => {
  if (R <= 0) return; const { n = 22, seed = 1, squash = 0.8 } = o, st = Math.floor(t * 12), r = U.rng(seed * 131 + st * 7);
  c.save(); c.fillStyle = o.col || K.pal(o).ink;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.pow(r(), 0.7) * R, rr = R * (0.07 + 0.26 * (1 - d / R) * r()) * (0.85 + 0.3 * Math.sin(t * 18 + i));
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * squash, Math.max(2, rr), 0, TAU); c.fill();
  }
  c.restore();
};
// 星爆框（能量/触底/强调）：n 尖锯齿，黄底黑边＋黑色错位投影。o {n 22, inner 0.56, seed, fill, s 缩放（配 K.pop）, rot, shadow, lw, war}。返回 Path2D（中心已在 x,y）。
K.starburst = (c, x, y, r, o = {}) => {
  const p = K.pal(o), { n = 22, inner = 0.56, seed = 5, s = 1, rot = 0, lw = 7, shadow = true } = o, fill = o.fill !== undefined ? o.fill : p.yellow;
  if (s <= 0 || r * s < 2) return null;
  const q = K.poly(Array.from({ length: n * 2 }, (_, i) => {
    const rr = (i % 2 ? r * inner : r) * s * (0.88 + U.hash(i, seed) * 0.24), a = rot + i / (n * 2) * TAU;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  }));
  if (shadow) { c.save(); c.translate(9, 10); K.ink(c, q, p.ink, 1, null, { reg: 0 }); c.restore(); }
  K.ink(c, q, fill, lw, p.ink, { reg: 0 }); return q;
};
// 聚焦/速度黑楔：从 (cx,cy) 向外的黑三角，12fps 换种子。o {n 14, seed, col, t（缺省用 lt）, a0,a1 限定扇区（缺省全周）, war}
K.speedLines = (c, cx, cy, r0, r1, n = 14, lt = 0, o = {}) => {
  const p = K.pal(o), st = Math.floor((o.t != null ? o.t : lt) * 12), r = U.rng((o.seed || 1) * 71 + st * 13);
  const a0 = o.a0 != null ? o.a0 : 0, a1 = o.a1 != null ? o.a1 : TAU;
  c.save(); c.fillStyle = o.col || p.ink; c.globalAlpha *= o.alpha != null ? o.alpha : 1;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) / n * (a1 - a0) + (r() - 0.5) * 0.1, w = 0.008 + r() * 0.016, rr = r0 + (r1 - r0) * (0.72 + r() * 0.42);
    c.beginPath(); c.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); c.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); c.closePath(); c.fill();
  }
  c.restore();
};

// ---------- 底 / 收尾 ----------
// 纸底。o {kind 'paper'|'dots'|'rays', tint 'red'|'blue'|'yellow'（dots/rays 用）, bold（dots：实底＋纸色点）, ox,oy（rays 中心）, spin, frame（外黑框宽）, war}
K.bg = (c, t, o = {}) => {
  const p = K.pal(o), { kind = 'paper', tint = 'blue', bold = false, ox = 540, oy = 760, spin = 0.15, frame = 0 } = o, col = p[tint] || p.blue;
  c.fillStyle = p.paper; c.fillRect(0, 0, W, H);
  if (kind === 'paper') { c.save(); c.globalAlpha = 0.05; c.fillStyle = K.dots(c, 26, 2.2, p.ink); c.fillRect(0, 0, W, H); c.restore(); }
  else if (kind === 'dots') {
    if (bold) { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = K.dots(c, 24, 5.2, p.paper, { angle: K.SCREEN[tint] }); c.fillRect(0, 0, W, H); }
    else { c.save(); c.globalAlpha = 0.5; c.fillStyle = K.dots(c, 24, 5.4, col, { angle: K.SCREEN[tint] }); c.fillRect(0, 0, W, H); c.restore(); } }
  else if (kind === 'rays') {
    c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = p.paper;
    const n = 22, rot = (t || 0) * spin;
    for (let i = 0; i < n; i += 2) { const a0 = rot + i / n * TAU, a1 = a0 + TAU / n; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a0) * 2600, oy + Math.sin(a0) * 2600); c.lineTo(ox + Math.cos(a1) * 2600, oy + Math.sin(a1) * 2600); c.closePath(); c.fill(); }
    c.save(); c.globalAlpha = 0.18; c.fillStyle = K.dots(c, 20, 3.4, p.ink); c.fillRect(0, 0, W, H); c.restore(); }
  if (frame) { c.strokeStyle = p.ink; c.lineWidth = frame * 2; c.strokeRect(0, 0, W, H); }
};
// 每镜收尾：纸面颗粒（multiply）＋字幕带 y1370–1570 用高密黑网点压暗（不用渐变不用真灰，规矩 1）。字幕带里别放字以外的关键物。
K.finish = (c, o = {}) => {
  const p = K.pal(o);
  c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(P.grain('kirby', 0.05, [120, 100, 60], 0.22), 0, 0); c.restore();
  c.save(); c.beginPath(); c.rect(0, 1370, W, 200); c.clip(); c.globalAlpha = 0.5; c.fillStyle = K.dots(c, 7, 2.7, p.ink); c.fillRect(0, 1370, W, 200); c.restore();
  c.save(); c.globalAlpha = 0.6; c.strokeStyle = p.ink; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, 1370); c.lineTo(W, 1370); c.moveTo(0, 1570); c.lineTo(W, 1570); c.stroke(); c.restore();
};

// ---------- 文字 ----------
const hasCJK = s => /[一-鿿]/.test(s);
K.eng = s => hasCJK(s) ? 'PuHui-Black' : 'Bangers-400';          // 英文美术字用引擎自带 Bangers-400，中文 PuHui-Black
// o {size, fam, col, align, alpha, scale, track, maxW（超宽整体缩小）, rot}
K.text = (c, s, x, y, o = {}) => { const { size = 64, col, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0 } = o, fam = o.fam || K.eng(s);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.fillStyle = col || C.ink; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, 0, 0); c.restore(); };
// Kirby 积木描边大字：黑色挤出（o.ex 深度）＋粗描边＋平涂＋可选顶部切色带（o.hi，如 BOOM! 的黄顶）。
// o {fam, lw, ex（挤出深度，0=只要硬投影一层）, hi, rot, scale, alpha, maxW, align, stroke}
K.bigText = (c, s, x, y, size, fill, o = {}) => { const p = K.pal(o), fam = o.fam || K.eng(s), { rot = 0, scale = 1, alpha = 1, maxW = 0, stroke = p.ink } = o, ex = o.ex != null ? o.ex : size * 0.11;
  const sameFill = String(fill || p.red) === String(stroke);                    // 填描同色（黑字黑边）：描边收窄，否则糊成黑块
  const lw = o.lw != null ? o.lw : size * (sameFill ? 0.05 : 0.13);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`;
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
  for (let d = ex; d > 0; d -= 2) { c.fillStyle = stroke; c.fillText(s, d * 0.8, d); }
  c.strokeStyle = stroke; c.lineWidth = lw; c.strokeText(s, 0, 0);
  c.fillStyle = fill || p.red; c.fillText(s, 0, 0);
  if (o.hi) { c.save(); c.beginPath(); c.rect(-1600, -size * 0.62, 3200, size * 0.42); c.clip(); c.fillStyle = o.hi === true ? p.yellow : o.hi; c.fillText(s, 0, 0); c.restore(); }
  c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 黄底黑字标签（数据纪律：数字都用它钉在曲线上）。返回宽度。o {size 46, fill, col, scale, alpha, rot, padX, war}
K.tag = (c, s, x, y, o = {}) => { const p = K.pal(o), { size = 46, fam = 'PuHui-Heavy', scale = 1, alpha = 1, rot = 0, padX = 0.55 } = o, fill = o.fill || p.yellow, col = o.col || p.ink;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.45;
  const q = K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]);
  c.save(); c.translate(8, 9); K.ink(c, q, p.ink, 1, null, { reg: 0 }); c.restore();
  K.ink(c, q, fill, 6, p.ink, { reg: 0 });
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
// 弹出文字（backOut 过冲）：o.plate 为 true 用 tag 黄标签，否则 bigText 积木字。o {size, fill, dur, alpha, rot, scale, ...}
K.popText = (c, s, x, y, lt, at, o = {}) => { const k = K.pop(lt, at, o.dur || 0.5); if (k <= 0) return; const a = clamp(k * 2) * (o.alpha != null ? o.alpha : 1), p = K.pal(o);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: k * (o.scale || 1), alpha: a }); else K.bigText(c, s, x, y, o.size || 96, o.fill || p.red, { ...o, scale: k * (o.scale || 1), alpha: a }); };
// 引线标注：黑粗线圆头先画出，末端黄标签逐字打出（约 20 字/秒）。o {fill, col, size, war}
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p = K.pal(o), { size = 46 } = o, fill = o.fill || p.yellow, col = o.col || p.ink, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = p.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = p.ink; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.1, h = size * 1.45; c.translate(bx, by); c.scale(q, q);
  c.save(); c.translate(8, 9); K.ink(c, K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]), p.ink, 1, null, { reg: 0 }); c.restore();
  K.ink(c, K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]), fill, 6, p.ink, { reg: 0 });
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.55, 3); c.restore(); };

// ---------- 版面 ----------
// 漫画格：黑框＋可选歪斜/旋转＋格内剪裁。o {fill（缺省白）, dots {pitch,r,col,angle,alpha}, rot, skew, lw 10, shadow, scale/alpha（配 pop）, war}；fn(c, path) 在 clip 里画内容（仍用屏幕坐标）。返回 Path2D。
K.panel = (c, x, y, w, h, o = {}, fn) => { const p = K.pal(o), { skew = 0, rot = 0, lw = 10, scale = 1, alpha = 1, shadow = true } = o; if (scale <= 0) return null;
  const q = K.poly([[x, y + skew * 0.5], [x + w, y - skew * 0.5], [x + w, y + h - skew * 0.5], [x, y + h + skew * 0.5]]);
  c.save(); c.globalAlpha *= alpha; c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); c.scale(scale, scale); c.translate(-x - w / 2, -y - h / 2);
  if (shadow) { c.save(); c.translate(11, 13); K.ink(c, q, p.ink, 1, null, { reg: 0 }); c.restore(); }
  c.save(); c.clip(q); c.fillStyle = o.fill || p.white; c.fillRect(x - 30, y - 30, w + 60, h + 60);
  if (o.dots) { c.globalAlpha *= o.dots.alpha != null ? o.dots.alpha : 1; c.fillStyle = K.dots(c, o.dots.pitch || 22, o.dots.r || 4.6, o.dots.col || p.blue, o.dots); c.fillRect(x - 30, y - 30, w + 60, h + 60); c.globalAlpha = alpha; }
  if (fn) fn(c, q); c.restore(); K.ink(c, q, null, lw, p.ink); c.restore(); return q; };
// 黄底黑边旁白框（Kirby 标志性矩形 caption）：(x,y) 左上，w 定宽，高度按行数自动，返回高度。text 可含 \n。o {size 40, fill, col, rot, align, war}
K.caption = (c, x, y, w, text, o = {}) => { const p = K.pal(o), { size = 40, rot = 0, align = 'left' } = o, fill = o.fill || p.yellow, col = o.col || p.ink;
  const lines = String(text).split('\n'), pad = size * 0.55, h = lines.length * size * 1.3 + pad * 2;
  c.save(); c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); c.translate(-w / 2, -h / 2);
  const q = K.poly([[0, 0], [w, 0], [w, h], [0, h]]);
  c.save(); c.translate(8, 9); K.ink(c, q, p.ink, 1, null, { reg: 0 }); c.restore();
  K.ink(c, q, fill, 6, p.ink, { reg: 0 });
  lines.forEach((ln, i) => K.text(c, ln, align === 'left' ? pad : w / 2, pad + size * 0.65 + i * size * 1.3, { size, fam: o.fam || K.eng(ln), col, align, maxW: w - pad * 2 }));
  c.restore(); return h; };
// 报纸头版道具：报头色带＋报名＋英文大写头条（中文自动换 PuHui-Black）＋副标题＋网点照片区。
// o {name 报名, head 头条, sub 副标题, rot, tone 'red'|'blue'|'yellow'|null（照片区网点色）, mast 报头色, hs 头条字号（缺省按宽自适应）, war, seed}
K.newspaper = (c, x, y, w, h, o = {}) => { const p = K.pal(o), { name = 'DAILY GLOBE', head = 'WAR!', sub = '', rot = 0, tone = 'red', seed = 1 } = o, mast = o.mast || p.ink;
  c.save(); c.translate(x + w / 2, y + h / 2); if (rot) c.rotate(rot); c.translate(-w / 2, -h / 2);
  const q = K.poly([[0, 0], [w, 0], [w, h], [0, h]]);
  c.save(); c.translate(9, 10); K.ink(c, q, p.ink, 1, null, { reg: 0 }); c.restore();
  K.ink(c, q, p.paper, 7, p.ink, { reg: 0 });
  const mh = h * 0.22; K.ink(c, K.poly([[12, 12], [w - 12, 12], [w - 12, 12 + mh], [12, 12 + mh]]), mast, 5, p.ink);
  K.text(c, name, w / 2, 12 + mh / 2, { size: mh * 0.52, fam: K.eng(name), col: p.paper, maxW: w - 60, track: 2 });
  const hs = o.hs || Math.min(h * 0.34, w / Math.max(2, [...head].length) * 1.5);
  K.bigText(c, head, w / 2, 12 + mh + hs * 0.62, hs, p.red, { ex: hs * 0.07, lw: hs * 0.1, maxW: w - 40 });
  if (sub) K.text(c, sub, w / 2, 12 + mh + hs * 1.18 + 20, { size: Math.max(42, hs * 0.42), fam: K.eng(sub), col: p.ink, maxW: w - 50 });
  // 网点照片区 + 假行
  const py = 12 + mh + hs * 1.18 + (sub ? 62 : 20), ph = h - py - 16; if (ph > 40) {
    const pw = w * 0.42, pq = K.poly([[16, py], [16 + pw, py], [16 + pw, py + ph], [16, py + ph]]);
    K.ink(c, pq, p.white, 4, p.ink, { reg: 0 });
    if (tone) K.dotFill(c, pq, { pitch: 9, r: 2.6, col: p[tone] || p.red, angle: K.SCREEN[tone] || 75, alpha: 0.55 });
    c.save(); c.clip(pq); c.translate(16 + pw / 2, py + ph * 0.62); K.krackle(c, 0, 0, Math.min(pw, ph) * 0.42, 0, { n: 16, seed }); c.restore();
    K.ink(c, pq, null, 4, p.ink);
    c.save(); c.globalAlpha = 0.35; c.strokeStyle = p.ink; c.lineWidth = 3; c.beginPath();
    for (let r0 = 0; r0 < Math.floor(ph / 18); r0++) { const yy = py + 10 + r0 * 18; c.moveTo(16 + pw + 16, yy); c.lineTo(w - 16, yy); } c.stroke(); c.restore(); }
  c.restore(); };
// 拟声立体积木字：黑挤出＋红字＋黄顶切＋星爆底，12fps 抖。o {size 120, fill, hi（顶切色，缺省黄）, s（配 pop）, rot, lt（给了就抖）, at（给了就 outBack 弹入）, dur, star（星爆底，缺省 true）, seed, war}
K.soundFx = (c, x, y, text, o = {}) => {
  if (o.war) { warnOnce('warSfx', 'war 模式（真实战役伤亡）禁用拟声词 K.soundFx，已拒绝绘制——改用 K.mourn 黑格默哀'); return; }
  const p = K.pal(o), { size = 120, rot = -0.08, seed = 3 } = o;
  const k = o.at != null ? K.pop(o.lt || 0, o.at, o.dur || 0.4) : (o.s != null ? o.s : 1); if (k <= 0) return;
  const jx = o.lt != null ? K.jit(o.lt, seed, 4) : 0, jy = o.lt != null ? K.jit(o.lt, seed + 5, 4) : 0;
  c.save(); c.translate(x + jx, y + jy); c.rotate(rot); c.scale(k, k);
  if (o.star !== false) K.starburst(c, 0, 0, size * 1.45, { n: 22, seed, fill: p.yellow, lw: 7 });
  K.bigText(c, text, 0, 0, size, o.fill || p.red, { hi: o.hi !== undefined ? o.hi : p.yellow, ex: size * 0.12, lw: size * 0.1 });
  c.restore(); };
// 黑格默哀（重大伤亡节点）：全黑格＋一行小号白字（日期＋事件）。o {x,y,w,h（缺省全屏）, size 44}
K.mourn = (c, text, o = {}) => { const p = K.pal(o), x = o.x != null ? o.x : 0, y = o.y != null ? o.y : 0, w = o.w || W, h = o.h || H;
  c.save(); c.fillStyle = p.ink; c.fillRect(x, y, w, h);
  if (text) K.text(c, text, x + w / 2, y + h / 2, { size: o.size || 44, fam: 'PuHui-Bold', col: p.white, maxW: w - 80 });
  c.restore(); };

// ---------- 贯穿物：行情纸带 ----------
// 行情纸带：白带黑边、两排齿孔、价格字符沿波浪滚动、可皱可撕。(x,y) 是带身左上起点的中线顶。
// o {h 64, wave 振幅, freq 波频, crumple 皱褶幅度, speed 字滚动速度 px/s, t, text（重复印制）, tear 0..1 从右端撕掉比例, rot, seed, holes, size, war}
// 返回右端中心 [x, y]（屏幕坐标，未含 rot）。
K.tape = (c, x, y, w, o = {}) => { const p = K.pal(o), { h = 64, wave = 0, freq = 0.006, phase = 0, crumple = 0, speed = 0, t = 0, text = '', tear = 0, rot = 0, seed = 1, holes = true, size = 34 } = o;
  const wEff = Math.max(0, w * (1 - clamp(tear))); if (wEff < 8) return [x, y];
  const yy = s => wave * Math.sin(s * freq + phase) + (crumple ? (U.hash(Math.round(s / 18), seed) - 0.5) * 2 * crumple : 0);
  c.save(); c.translate(x, y); if (rot) c.rotate(rot);
  const body = new Path2D(); const step = 22;
  body.moveTo(0, yy(0)); for (let s = step; s < wEff; s += step) body.lineTo(s, yy(s)); body.lineTo(wEff, yy(wEff));
  if (tear > 0) { const r = U.rng(seed * 31 + 7), y0 = yy(wEff);                    // 撕口：锯齿斜边
    for (let k = 1; k <= 6; k++) body.lineTo(wEff - 6 - r() * 16, y0 + k / 6 * h);
  } else { body.lineTo(wEff, yy(wEff) + h); }
  for (let s = wEff - (wEff % step); s > 0; s -= step) body.lineTo(s, yy(s) + h); body.lineTo(0, yy(0) + h); body.closePath();
  c.save(); c.translate(8, 9); K.ink(c, body, p.ink, 1, null, { reg: 0 }); c.restore();
  K.ink(c, body, p.white, 5, p.ink, { reg: 0 });
  c.save(); c.clip(body);
  if (holes) { c.fillStyle = p.paper; c.strokeStyle = p.ink; c.lineWidth = 2.5;      // 齿孔（错位量太大，reg:0）
    for (let s = 14; s < wEff - 6; s += 34) { for (const hy of [8, h - 8]) { c.beginPath(); c.roundRect(s - 4.5, yy(s) + hy - 5, 9, 10, 3); c.fill(); c.stroke(); } } }
  if (text) { const rep = (text + '  '); c.font = `${size}px "${K.eng(text)}"`; const cw = Math.max(20, c.measureText(rep).width);
    const off = speed ? (t * speed) % cw : 0; c.fillStyle = p.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let s = -off; s < wEff; s += cw) { if (s < -cw) continue; const sl = Math.atan2(yy(s + 6) - yy(s - 6), 12);
      c.save(); c.translate(s + cw / 2, yy(s) + h / 2); c.rotate(sl); c.fillText(rep, 0, 2); c.restore(); } }
  c.restore(); c.restore(); return [x + wEff, y + yy(wEff) + h / 2]; };

// ---------- 数据 ----------
// 确定性序列：K.series(n, seed, {trend 总漂移(+升 -降), vol}) → 0..1 的 n 个值
K.series = (n, seed = 1, o = {}) => { const { trend = 0.5, vol = 0.12 } = o, r = U.rng(seed * 977 + 13); let v = 0.5 - trend / 2; const a = []; for (let i = 0; i < n; i++) { a.push(v); v += trend / (n - 1) + (r() - 0.5) * vol; } const mn = Math.min(...a), mx = Math.max(...a); return a.map(x => (x - mn) / (mx - mn || 1)); };
K.mapPts = (vals, x, y, w, h) => vals.map((v, i) => [x + w * i / Math.max(1, vals.length - 1), y + h * (1 - v)]);
// 粗折线：色线粗＋墨线细压正中（色线按 K.MIS 错位出四色感）。o {prog 0..1, col（缺省蓝，dir:'down' 时缺省红）, lw 24, inkW, arrow, war}。返回笔尖 [x,y,角度]。
K.line = (c, pts, o = {}) => { const p = K.pal(o), { prog = 1, lw = 24, arrow = true } = o, col = o.col || (o.dir === 'down' ? p.red : p.blue);
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const tot = L[L.length - 1], want = tot * clamp(prog); if (want <= 1) return null;
  const q = [pts[0]]; for (let i = 1; i < pts.length; i++) { if (L[i] <= want) q.push(pts[i]); else { const f = (want - L[i - 1]) / (L[i] - L[i - 1]); q.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
  const path = K.poly(q, false); c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.save(); c.translate(K.MIS[0], K.MIS[1]); c.strokeStyle = col; c.lineWidth = lw; c.stroke(path); c.restore();
  c.strokeStyle = p.ink; c.lineWidth = o.inkW || Math.max(7, lw * 0.42); c.stroke(path);
  const e = q[q.length - 1], f = q[Math.max(0, q.length - 2)], ang = Math.atan2(e[1] - f[1], e[0] - f[0]);
  if (arrow && q.length > 1) { c.translate(e[0], e[1]); c.rotate(ang); K.ink(c, K.poly([[34, 0], [-18, -28], [-6, 0], [-18, 28]]), col, 7, p.ink, { reg: 0 }); } c.restore(); return [e[0], e[1], ang]; };
// 粗箭头（块状）：o {col, w 杆宽 34, head 70, prog, war}
K.arrow = (c, x0, y0, x1, y1, o = {}) => { const p = K.pal(o), { w = 34, head = 70, prog = 1 } = o, col = o.col || p.red, a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0) * clamp(prog); if (L < 4) return;
  c.save(); c.translate(x0, y0); c.rotate(a); const hd = Math.min(head, L);
  K.ink(c, K.poly([[0, -w / 2], [L - hd, -w / 2], [L - hd, -head * 0.62], [L, 0], [L - hd, head * 0.62], [L - hd, w / 2], [0, w / 2]]), col, 7, p.ink, { reg: 0 }); c.restore(); };
// 行情图表（数据纪律：占屏 ≥50%，数字用 tags 黄标签钉在曲线上）。
// o {data [0..1 或原始值], min,max（原始值时给）, prog, col/dir, base 'paper'|'tape'（tape＝纸带坐标纸，上下齿孔）, zone 'down'|'up'（曲线到底边的网点区，缺省 down）, zoneCol,
//    tags [[f 0..1 或下标, '92.9'], …]（钉在曲线上的黄底黑字标签，自动避让上下）, label（轴题）, grid, lt/at（prog 由 lt 驱动）, war}
// 返回 { pts, tip }。
K.chart = (c, x, y, w, h, o = {}) => { const p = K.pal(o), data = o.data || K.series(14, o.seed || 1, o);
  const mn = o.min != null ? o.min : Math.min(...data), mx = o.max != null ? o.max : Math.max(...data);
  const vals = data.map(v => (v - mn) / ((mx - mn) || 1));
  const prog = o.prog != null ? o.prog : (o.lt != null && o.at != null ? K.ease(K.at(o.lt, o.at, o.dur || 1)) : 1);
  const q = K.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  K.ink(c, q, p.paper, 8, p.ink, { reg: 0 });
  c.save(); c.clip(q);
  if (o.base === 'tape') { c.fillStyle = p.paper; c.strokeStyle = p.ink; c.lineWidth = 2.5;
    for (let s = x + 20; s < x + w - 10; s += 36) for (const hy of [y + 12, y + h - 12]) { c.beginPath(); c.roundRect(s - 5, hy - 6, 10, 12, 3); c.fill(); c.stroke(); } }
  if (o.grid !== false) { c.save(); c.globalAlpha = 0.16; c.strokeStyle = p.ink; c.lineWidth = 2; c.beginPath();
    for (let gx = x + w / 8; gx < x + w - 4; gx += w / 8) { c.moveTo(gx, y); c.lineTo(gx, y + h); }
    for (let gy = y + h / 6; gy < y + h - 4; gy += h / 6) { c.moveTo(x, gy); c.lineTo(x + w, gy); } c.stroke(); c.restore(); }
  const pad = 46, pts = K.mapPts(vals, x + pad, y + pad, w - pad * 2, h - pad * 2);
  if (o.zone !== null) { const dir = o.zone === 'up' ? -1 : 1, zn = new Path2D(); zn.moveTo(pts[0][0], dir > 0 ? y + h : y);
    pts.forEach(pt => zn.lineTo(pt[0], pt[1])); zn.lineTo(pts[pts.length - 1][0], dir > 0 ? y + h : y); zn.closePath();
    K.dotFill(c, zn, { pitch: 11, r: 3.2, col: o.zoneCol || (dir > 0 ? p.red : p.blue), angle: 75, alpha: 0.45 }); }
  c.restore();
  // 轴
  c.save(); c.strokeStyle = p.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + pad - 8, y + 10); c.lineTo(x + pad - 8, y + h - pad + 8); c.lineTo(x + w - 10, y + h - pad + 8); c.stroke(); c.restore();
  if (o.label) K.text(c, o.label, x + pad + 8, y + 34, { size: 34, fam: K.eng(o.label), col: p.ink, align: 'left', maxW: w * 0.5 });
  const tip = K.line(c, pts, { prog, col: o.col, dir: o.dir, lw: o.lw || 22, arrow: o.arrow !== false, war: o.war });
  (o.tags || []).forEach(([f, s], i) => { const fi = f <= 1 ? f * (pts.length - 1) : f, i0 = clamp(Math.floor(fi), 0, pts.length - 2), fr = fi - i0;
    const px = lerp(pts[i0][0], pts[i0 + 1][0], fr), py = lerp(pts[i0][1], pts[i0 + 1][1], fr);
    if (px > x + pad + (w - pad * 2) * prog + 4) return;                            // 还没画到的点不钉
    const up = py > y + h * 0.45 ? -1 : 1, ty2 = py + up * 74;
    c.save(); c.strokeStyle = p.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(px, py); c.lineTo(px, ty2 + up * -18); c.stroke(); c.restore();
    K.tag(c, s, px, ty2, { size: o.tagSize || 44, war: o.war, rot: (U.hash(i, 17) - 0.5) * 0.05 }); });
  return { pts, tip }; };

// ---------- 人物（不画脸，规矩 8） ----------
// 手：K.hand(c, x, y, s, o)：(x,y) 手掌中心，袖子从左下伸来。o {pose 'point'|'open'|'fist', rot, sleeve 袖色, flip -1 镜像, war}
K.hand = (c, x, y, s = 1, o = {}) => { const p = K.pal(o), { pose = 'point', rot = 0, flip = 1 } = o, sleeve = o.sleeve || p.blue;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s * flip, s);
  const sleeveP = K.poly([[-330, -62], [-110, -78], [-100, 78], [-330, 96]]);
  K.ink(c, sleeveP, sleeve, 8); c.save(); c.clip(sleeveP); K.hatch(c, -330, 10, -100, 110, 10, 3, o); c.restore(); K.ink(c, sleeveP, null, 8);
  K.ink(c, K.poly([[-125, -82], [-85, -84], [-85, 84], [-125, 86]]), p.white, 7);          // 袖口
  const palm = K.round(-90, -60, 130, 120, 36);
  K.ink(c, palm, p.paper, 7); K.kirbyShade(c, palm, { d1: 10, d2: 22, gap: 9 }); K.ink(c, palm, null, 7);
  const finger = (x0, y0, len, wd, ang) => { c.save(); c.translate(x0, y0); c.rotate(ang); const f = K.round(0, -wd / 2, len, wd, wd / 2); K.ink(c, f, p.paper, 7); K.kirbyShade(c, f, { d1: 7, d2: 14, gap: 9 }); K.ink(c, f, null, 7); c.restore(); };
  if (pose === 'point') { finger(30, -34, 170, 36, 0); [[24, -2], [24, 28], [24, 54]].forEach(([fx, fy]) => finger(fx, fy - 8, 70, 30, 0)); finger(-52, -60, 90, 34, -0.7); }
  else if (pose === 'open') { [-46, -18, 10, 38].forEach((fy, i) => finger(30, fy, 150 - Math.abs(i - 1.2) * 12, 30, (i - 1.5) * 0.12)); finger(-30, -62, 100, 34, -0.9); }
  else if (pose === 'fist') { [-44, -14, 14, 42].forEach(fy => finger(24, fy - 4, 56, 30, 0)); finger(-60, -64, 84, 34, -0.3); }
  c.restore(); };
// 剪影人（Kirby 黑块）：K.figure(c, x, y, s, o)：(x,y) 脚底中点，s=1 身高约 520。o {pose 'stand'|'arms'|'slump', t（呼吸起伏）, war}。无五官，黑块＋白点网屏高光。
K.figure = (c, x, y, s = 1, o = {}) => { const p = K.pal(o), { pose = 'stand' } = o, col = o.col || p.ink, bob = o.t != null ? Math.sin(o.t * 2.2 + x) * 3 : 0;
  c.save(); c.translate(x, y + bob); c.scale(s, s);
  const slump = pose === 'slump' ? 22 : 0;
  K.ink(c, K.poly([[-40, -2], [-40, -250], [-8, -250], [-4, -2]]), col, 7); K.ink(c, K.poly([[8, -2], [4, -250], [40, -250], [40, -2]]), col, 7);
  const torso = K.poly([[-58, -250], [-72, -440 + slump], [72, -440 + slump], [58, -250]]);
  K.ink(c, torso, col, 7);
  const arm = (sg) => { const up = pose === 'arms'; K.ink(c, up ? K.poly([[sg * 66, -430], [sg * 96, -440], [sg * 130, -560], [sg * 98, -566]]) : K.poly([[sg * 66, -430 + slump], [sg * 100, -420 + slump], [sg * 92, -270], [sg * 62, -272]]), col, 7); };
  arm(-1); arm(1);
  c.save(); c.translate(0, slump * 0.6); if (pose === 'slump') c.rotate(0.18); K.ink(c, K.ellipse(0, -490 + slump * 0.4, 36, 42), col, 7); c.restore();   // 头（无五官）
  c.save(); c.clip(torso); c.globalAlpha = 0.35; c.fillStyle = K.dots(c, 12, 3, p.paper); c.fillRect(8, -440 + slump, 70, 200); c.restore();           // 受光侧白点网屏
  c.restore(); };

// ---------- 高级：整版双版印刷（英雄镜头用，普通镜头不必） ----------
// 色版＋墨线版画两遍合成：draw(g, 'color') 画平涂/网点，draw(g, 'ink') 画白填/黑块/描边；色版整层按 offset 错位后 multiply 墨线版。
// o {offset [4,3]（钳到 3-5px，规矩 2）, paper false 不铺纸底}。注意：别嵌套调用（共用 scratch）；draw 里用 K.ink 要传 {reg:0} 否则会双重错位。
K.plates = (c, draw, o = {}) => {
  let [dx, dy] = o.offset || K.MIS;
  const cl = v => { const a = Math.abs(v); if (a < 3 || a > 5) { warnOnce('mis', '套色错位量须在 3-5px（规矩 2），已钳制'); return Math.sign(v || 1) * clamp(a, 3, 5); } return v; };
  dx = cl(dx); dy = cl(dy);
  const cc = P.scratch('kb_plateC'), cg = cc.getContext('2d'), ic = P.scratch('kb_plateI'), ig = ic.getContext('2d');
  cg.reset(); ig.reset(); draw(cg, 'color'); draw(ig, 'ink');
  if (o.paper !== false) { c.fillStyle = K.pal(o).paper; c.fillRect(0, 0, W, H); }
  c.drawImage(cc, dx, dy);
  c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(ic, 0, 0); c.restore();
};
})();

// ---------- 章节卡（每章第一镜）：纸带从顶部吐入印时间锚点＋第 N 章星爆＋章名＋N 站进度轨 ----------
(() => { const { W, TAU } = K, { clamp, lerp } = U;
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
// 贯穿纸带做成进度轨上的「站牌」小车：换书时可在 props.js 改 K.cardToken
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking, arriveAt, o) => {
  K.tape(c, x - 55, y - 23, 90, { h: 46, holes: true, seed: 9, war: o && o.war }); });
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const p = K.pal(o);
  K.bg(c, t, { kind: 'paper', war: o.war });
  // 顶部吐入的纸带（印时间锚点）
  const q = MO.cubicOut(K.at(lt, 0.1, 0.8)), stripW = 360, sx = W / 2 - stripW / 2, len = lerp(-80, 560, q);
  if (len > 0) { c.save(); c.beginPath(); c.rect(0, -80, W, len + 80); c.clip();
    const body = K.poly([[sx, -80], [sx + stripW, -80], [sx + stripW, len], [sx + stripW - 14, len + 16], [sx + stripW - 30, len], [sx + 44, len + 16], [sx + 26, len], [sx + 12, len + 14], [sx, len]]);
    c.save(); c.translate(8, 9); K.ink(c, body, p.ink, 1, null, { reg: 0 }); c.restore();
    K.ink(c, body, p.white, 6, p.ink, { reg: 0 });
    c.save(); c.clip(body); c.fillStyle = p.paper; c.strokeStyle = p.ink; c.lineWidth = 2.5;
    for (let yy = -60; yy < len - 10; yy += 36) for (const hx of [sx + 14, sx + stripW - 14]) { c.beginPath(); c.roundRect(hx - 5, yy, 10, 12, 3); c.fill(); c.stroke(); }
    c.restore();
    if (o.anchor) { const shown = TY.typed(o.anchor, K.at(lt, 0.55, [...o.anchor].length / 16));
      K.text(c, shown, W / 2, Math.min(len - 70, 300), { size: 62, fam: K.eng(o.anchor), col: p.ink, maxW: stripW - 70 }); }
    c.restore(); }
  // 第 N 章 星爆砸入
  if (lt > 0.7) { const s = MO.slamK(clamp((lt - 0.7) / 0.17));
    K.starburst(c, W / 2, 830, 300, { n: 18, seed: 3 + n, s, fill: p.yellow, lw: 9, war: o.war });
    K.bigText(c, `第 ${n} 章`, W / 2, 836, 128, p.red, { lw: 17, ex: 13, scale: s, rot: -0.03, maxW: 420, war: o.war }); }
  // 章名（长的拆两行，逐字出）
  const lines = K.split2(title), all = lines.reduce((s2, l) => s2 + [...l].length, 0), shown = Math.round(K.at(lt, 1.0, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 6 ? 104 : 120;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length;
    if (kk > 0) K.bigText(c, a.slice(0, kk).join(''), W / 2, 1140 + (i - (lines.length - 1) / 2) * size * 1.25, size, p.ink, { lw: size * 0.1, ex: 0, maxW: 920, war: o.war }); });
  // N 站进度轨（按章数算）：墨线＋站点，走过的黄、本站红星爆，纸带小车从上一站跳到本站
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, ry = 1440, X = i => lerp(x0, x1, i / (N - 1));
  const rq = MO.cubicOut(K.at(lt, 1.3, 0.5));
  if (rq > 0) { c.save(); c.strokeStyle = p.ink; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 20, ry); c.lineTo(lerp(x0 - 20, x1 + 20, rq), ry); c.stroke(); c.restore(); }
  const walkEnd = 2.3, wq = MO.cubicInOut(K.at(lt, 1.45, walkEnd - 1.45)), done = X(n - 1), from = n > 1 ? X(n - 2) : x0 - 60;
  if (lt > 1.5) for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.4) : 1;
    K.ink(c, K.circle(X(i), ry, cur ? 20 * Math.max(0.6, pp) : 13), past ? p.yellow : cur ? p.red : p.white, 6, p.ink, { reg: 0 }); }
  if (lt > 1.45 && rq > 0.9) { const tx = lerp(from, done, wq), hop = lt < walkEnd ? -Math.abs(Math.sin(lt * 9)) * 24 : 0;
    K.cardToken(c, tx, ry - 58 + hop, lt, t, lt < walkEnd, walkEnd, o); }
  K.finish(c, o);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：黄错位投影＋黑板＋纸色字，字幕带 y≈1480，让开视频号底栏
(() => {
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"';
  const w = Math.min(1040, c.measureText(text).width + 72), h = 90, x = 540, y = 1480;
  const q = K.poly([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2 - 5], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2 + 5]]);
  c.save(); c.translate(8, 9); K.ink(c, q, K.C.yellow, 1, null, { reg: 0 }); c.restore();
  K.ink(c, q, '#111111', 5, '#111111', { reg: 0 });
  c.fillStyle = K.C.white; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
