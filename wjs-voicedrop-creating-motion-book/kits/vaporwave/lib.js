// 画风套件 vaporwave（配方 huashu-art-motion 26_vaporwave「2011 蒸汽波 / 赛博霓虹」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：深紫夜空＋切缝落日＋线框山＋棕榈剪影＋透视网格地面；一切发光体都是「霓虹灯管」（shadowBlur 粗辉光＋2-3px 白芯）；
//       Win95 对话框是全片的「系统旁白」（标题栏/进度块/状态行）；「看不见的轨道」＝洋红双轨＋青色虚线＋流动光点，物被轨道带着走；
//       人和手是深色填充＋青色霓虹轮廓的线稿（不画脸）；UI 语言（鼠标指针、蚂蚁线选框、「已选定/未选中」标签）表达「选择被预设」。
//       四章一变色移：night 深夜霓虹 → mono 单色机制 → blue 蓝屏极简 → dawn 黎明暖调（K.CHAPTER_KINDS）。
//       后期 K.vhs 默认轻：RGB 分离 2-3px、扫描线 α≤0.13，别把字弄糊。环境层全部确定性（U.rng / U.hash）。
//       字：PuHui-Black/Heavy/Bold 中文（GB2312 子集），PressStart2P-400 只给英文/数字 retro 小字；最小 44px、标签 ≥52、大标题 100-170、屏上字 ≤8（K.split2）。
//       文字和关键图形只放 y200–1350；y1380–1560 是字幕带（K.finish 压暗、K.subtitle 用），什么都不放。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：回弹起步让半径算成负数，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__vw) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__vw = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function' && !rg.__vw) { CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; CanvasRenderingContext2D.prototype.createRadialGradient.__vw = 1; } }

// ---------- 色板 ----------
const C = K.C = {
  deep: '#0d0322', deep2: '#12052a', purple: '#2a0b4a', violet: '#8f7cf6',   // 底：深紫→紫
  mag: '#ff4fd8', hot: '#ff2f8f', cy: '#3ff6ff',                           // 霓虹三主色：洋红/热粉/青
  yel: '#ffd84a', ora: '#ff8a3a',                                          // 落日
  ice: '#f4f1ff', paper: '#efe9ff', line: '#0a0218',                       // 亮体/剪影
  g95: '#c3c7cb', navy95: '#000080', blue95: '#1084d0', bsod: '#0000aa',   // Win95 灰/海军蓝/标题蓝/蓝屏
  grey: '#8388a8', greyD: '#43465e',                                       // 「未选中」灰
  body: '#1c0c3a', bodyLt: '#4a2390',                                      // 人/手深紫填充
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
K.mix = (a, b, k) => { const u = hex(a), v = hex(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
K.shade = (h, k = 0.3) => K.mix(h, C.line, k);
K.rgba = (h, a) => { const u = hex(h); return `rgba(${u[0]},${u[1]},${u[2]},${a})`; };

// ---------- 节奏/缓存/路径 ----------
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.ease = q => { q = clamp(q); return q * q * (3 - 2 * q); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
const bez = (p, q) => { const u = 1 - q; return [u*u*u*p[0][0] + 3*u*u*q*p[1][0] + 3*u*q*q*p[2][0] + q*q*q*p[3][0], u*u*u*p[0][1] + 3*u*u*q*p[1][1] + 3*u*q*q*p[2][1] + q*q*q*p[3][1]]; };
// 折线 → 两侧等宽带的轮廓（沟槽衬底用）
const band = (pts, w0, w1) => { const L = [], R = [];
  pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    L.push([p[0] - dy / n * w, p[1] + dx / n * w]); R.push([p[0] + dy / n * w, p[1] - dx / n * w]); });
  const path = new Path2D(); L.forEach((p, i) => i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])); R.reverse().forEach(p => path.lineTo(p[0], p[1])); path.closePath(); return path; };
K.band = band;

// ---------- 霓虹灯管：对当前路径先描粗辉光、再描近白芯线。K.neon(c,col,w,blur,core) / 别名 K.glowLine ----------
K.neon = (c, col = C.mag, w = 6, blur = 18, core = '#ffffff') => {
  c.save(); c.strokeStyle = col; c.lineWidth = w; c.shadowColor = col; c.shadowBlur = blur; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.restore();
  c.save(); c.strokeStyle = core; c.lineWidth = Math.max(1.6, w * 0.22); c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.restore(); };
K.glowLine = K.neon;
const neonP = (c, path, col, w, blur, core) => { c.save(); c.strokeStyle = col; c.lineWidth = w; c.shadowColor = col; c.shadowBlur = blur; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(path); c.restore();
  c.save(); c.strokeStyle = core || '#fff'; c.lineWidth = Math.max(1.6, w * 0.22); c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(path); c.restore(); };
// 灭灯管（闪灯招牌用）：暗紫描边
K.neonOff = (c, w = 6) => { c.save(); c.strokeStyle = 'rgba(120,60,120,.6)'; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.restore(); };

// ---------- 文字（安全区检查：文字/关键图形只放 y200–1350；1380–1560 是字幕带） ----------
const zoneWarn = (y, what) => { if (y > 1330 && y < 1620) K.once('zone_' + what, () => console.warn(`[vaporwave] ${what} y=${Math.round(y)} 落进字幕带 1380–1560，挪走`)); if (y < 190) K.once('zoneT_' + what, () => console.warn(`[vaporwave] ${what} y=${Math.round(y)} 高出安全区 y200`)); };
// 冰白字＋深紫粗描边（网格上最稳）。o: { size≥44, fam, col, align, alpha, scale, maxW, rot, sw, stroke, neon:色|false 发光变体 }
K.text = (c, s, x, y, o = {}) => { const size = Math.max(44, o.size || 64), { fam = 'PuHui-Black', col = C.ice, align = 'center', alpha = 1, scale = 1, maxW = 0, rot = 0, sw = 0.14 } = o;
  zoneWarn(y, 'text');
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (o.track) c.letterSpacing = o.track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (o.neon) { c.shadowColor = o.neon; c.shadowBlur = size * 0.5; c.fillStyle = o.neon; c.fillText(s, 0, 0); c.shadowBlur = size * 0.18; c.fillText(s, 0, 0); }
  c.shadowBlur = 0; c.lineWidth = size * sw; c.strokeStyle = o.stroke || C.deep2; if (sw > 0 && !o.neon) c.strokeText(s, 0, 0);
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 霓虹灯管大标题：多层辉光＋粗白芯（视频号压缩后白芯保可读）。size 钳到 100–170
K.title = (c, s, x, y, o = {}) => { const size = clamp(o.size || 130, 100, 170), col = o.col || C.mag, maxW = o.maxW || 1000;
  zoneWarn(y, 'title');
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot);
  if (o.plate !== false) { const rg = c.createRadialGradient(0, 0, 20, 0, 0, size * 3.6); rg.addColorStop(0, 'rgba(8,1,22,.66)'); rg.addColorStop(1, 'rgba(8,1,22,0)'); c.fillStyle = rg; c.fillRect(-size * 4, -size * 1.6, size * 8, size * 3.2); }
  c.font = `${size}px "PuHui-Black"`; const tw = c.measureText(s).width, k = (o.scale || 1) * Math.min(1, maxW / tw); c.scale(k, k);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = col; c.shadowBlur = size * 0.46; c.fillStyle = col; c.fillText(s, 0, 0);
  c.shadowBlur = size * 0.2; c.fillStyle = K.mix(col, '#ffffff', 0.25); c.fillText(s, 0, 0);
  c.shadowBlur = size * 0.07; c.fillStyle = '#ffffff'; c.fillText(s, 0, 0);
  c.restore(); return Math.min(tw * k, maxW); };
// 标签板：深紫底＋霓虹描边（fill:'neon'），或 Win95 灰（fill:'95'，给「未选中」等失效态）。size ≥52
K.tag = (c, s, x, y, o = {}) => { const size = Math.max(52, o.size || 52), fill = o.fill || 'neon', col = o.col || (fill === '95' ? '#c8c8d2' : C.mag);
  zoneWarn(y, 'tag');
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(o.scale ?? 1, o.scale ?? 1);
  c.font = `${size}px "${o.fam || 'PuHui-Bold'}"`; const w = c.measureText(s).width + size * 1.0, h = size * 1.45;
  c.fillStyle = fill === '95' ? '#4a4a55' : 'rgba(26,6,44,.92)'; c.fill(K.round(-w / 2, -h / 2, w, h, 8));
  if (fill === '95') { c.strokeStyle = '#c8c8d2'; c.lineWidth = 2.5; c.stroke(K.round(-w / 2, -h / 2, w, h, 8)); }
  else neonP(c, K.round(-w / 2, -h / 2, w, h, 8), col, 3.5, 12);
  c.fillStyle = fill === '95' ? '#c8c8d2' : '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, size * 0.05); c.restore(); return w; };
// 「示意」小标（44px，图表示意级必带）
K.mark = (c, x, y, s = '示意') => { c.save(); c.font = '44px "PuHui-Bold"'; const w = c.measureText(s).width + 40; c.translate(x, y);
  c.fillStyle = 'rgba(10,2,24,.9)'; c.fill(K.round(-w / 2, -30, w, 60, 10)); neonP(c, K.round(-w / 2, -30, w, 60, 10), C.cy, 2.5, 8);
  c.fillStyle = C.cy; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); };
K.split2 = (s, max = 8) => { const a = [...s]; if (a.length <= max) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—？'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate === 'title') K.title(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else if (o.plate) K.tag(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：青色霓虹线先拉出来，末端标签板逐字打出
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return; const col = o.col || C.cy;
  c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1));
  c.strokeStyle = col; c.lineWidth = 5; c.shadowColor = col; c.shadowBlur = 12; c.stroke(); c.restore();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(ax, ay, 8 * Math.min(1, p1 * 3), 0, TAU); c.fill();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.translate(bx, by); c.scale(q, q); c.font = `52px "PuHui-Bold"`; const w = c.measureText(s).width + 52, h = 75;
  c.fillStyle = 'rgba(26,6,44,.92)'; c.fill(K.round(-w / 2, -h / 2, w, h, 8)); neonP(c, K.round(-w / 2, -h / 2, w, h, 8), col, 3, 10);
  c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + 26, 3); c.restore(); };

// ---------- 底：kind: night 深夜霓虹 / grid 纯网格机制 / mono 单色机制 / blue 蓝屏极简 / dawn 黎明暖调 / room 室内桌面 ----------
const KIND = {
  night: { hz: 660, grid: C.cy, sky: ['#0d0322', '#2a0b4a', '#4a0f6a'], sun: 1, palms: 1, mts: 1, stars: 70 },
  grid:  { hz: 620, grid: C.cy, sky: ['#0a021c', '#1c0736', '#30104f'], sun: 0, palms: 0, mts: 1, stars: 40 },
  mono:  { hz: 620, grid: C.violet, sky: ['#0e0824', '#171030', '#241a44'], sun: 'wire', palms: 0, mts: 0, stars: 26 },
  blue:  { hz: 0, grid: null, sky: null, sun: 0, palms: 0, mts: 0, stars: 0 },
  dawn:  { hz: 660, grid: C.hot, sky: ['#160a2e', '#6a2358', '#ff8a5a'], sun: 1, palms: 1, mts: 1, stars: 24, sunCols: ['#fff3b0', C.yel, C.ora] },
  room:  { hz: 1040, grid: null, sky: ['#0d0322', '#2c0b52', '#4a0f6a'], sun: 0, palms: 0, mts: 0, stars: 0 },
};
const M = 220;   // 底纹四周多画的边（镜头拉远/横移不露边）
// 切缝落日：直接画在当前画布（bg 缓存里画静态的；章节也可单用 K.sun）
K.sun = (c, x, y, r, o = {}) => { const { t = 0, slits = 8, cols = [C.yel, C.ora, C.mag], halo = true, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha;
  if (halo) { const hg = c.createRadialGradient(x, y, r * 0.5, x, y, r * 1.8); hg.addColorStop(0, K.rgba(cols[2], 0.3)); hg.addColorStop(1, K.rgba(cols[2], 0)); c.fillStyle = hg; c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  const g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalCompositeOperation = 'destination-out';
  const ph = (t * 0.12) % 1;
  for (let k = 0; k < slits; k++) { const q = ((k + ph) / slits) % 1, yy = y + r * (0.08 + q * 0.95), hh = 4 + q * q * 22; c.fillRect(x - r, yy, r * 2, hh); }
  c.restore(); c.restore(); };
// 线框山（两排辉光折线）
const mountains = (c, hor, seed, col1 = C.mag, col2 = C.hot) => {
  const mts = (base, amp, sd, col, w) => { const pts = [[-20, hor]], r2 = U.rng(sd); let x = -20;
    while (x < W + 40) { x += 60 + r2() * 130; pts.push([x, base - r2() * amp]); pts.push([x + 50 + r2() * 90, base - r2() * amp * 0.25]); }
    pts.push([W + 20, hor]);
    c.save(); c.beginPath(); c.rect(-M, hor - 200, W + 2 * M, 200); c.clip(); c.globalAlpha = 0.85; neonP(c, K.poly(pts, false), col, w, 14, K.rgba(col, 0.9)); c.restore(); };
  mts(hor - 26, 74, seed * 2 + 7, col1, 2.5); mts(hor - 8, 40, seed * 2 + 13, col2, 2); };
// 棕榈剪影（一对）。K.palms(c,{y,s,t,col,x0,x1,flip})
K.palms = (c, o = {}) => { const { y = 660, s = 1, t = 0, col = '#0a0218', x0 = 66, x1 = W - 58 } = o;
  const one = (x, sc, sw, flip) => { c.save(); c.translate(x, y); c.scale(flip ? -sc : sc, sc); c.rotate(sw);
    c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
    c.lineWidth = 10; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -120, 4, -210); c.stroke();
    c.translate(4, -210);
    for (let k = 0; k < 6; k++) { const a = -Math.PI * (0.08 + k * 0.17); c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0);
      c.quadraticCurveTo(Math.cos(a) * 70, Math.sin(a) * 70 - 16, Math.cos(a) * 110, Math.sin(a) * 110 + 26); c.stroke(); }
    c.restore(); };
  one(x0, s, Math.sin(t * 0.8) * 0.03, false); one(x1, s * 1.15, Math.sin(t * 0.8 + 2) * 0.03, true); };
const bgTex = (kind, hz, seed) => P.cached(`vw_bg_${kind}_${hz}_${seed}`, W + 2 * M, H + 2 * M, g => {
  const d = KIND[kind], r = U.rng(36 + seed * 101), Wt = W + 2 * M, Ht = H + 2 * M;
  if (kind === 'blue') { g.fillStyle = C.bsod; g.fillRect(0, 0, Wt, Ht);
    const vg = g.createRadialGradient(M + W / 2, M + H * 0.45, 200, M + W / 2, M + H * 0.45, 1300); vg.addColorStop(0, 'rgba(40,70,220,.25)'); vg.addColorStop(1, 'rgba(0,0,60,.35)'); g.fillStyle = vg; g.fillRect(0, 0, Wt, Ht); return; }
  const g2 = g.createLinearGradient(0, 0, 0, M + hz); d.sky.forEach((col, i) => g2.addColorStop(i / (d.sky.length - 1), col));
  g.fillStyle = g2; g.fillRect(0, 0, Wt, M + hz);
  for (let i = 0; i < d.stars; i++) { g.fillStyle = `rgba(255,240,255,${0.2 + r() * 0.45})`; g.fillRect(r() * Wt, r() * (M + hz - 200), 2.5, 2.5); }
  g.save(); g.translate(M, M);
  if (d.sun === 1) K.sun(g, W / 2, hz - 80, 215, { cols: d.sunCols || [C.yel, C.ora, C.mag] });
  if (d.sun === 'wire') { g.strokeStyle = 'rgba(143,124,246,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, hz - 80, 200, 0, TAU); g.stroke();
    for (let k = 0; k < 6; k++) { const q = k / 5, yy = hz - 80 + 200 * (0.1 + q * 0.9); g.beginPath(); g.moveTo(W / 2 - 200 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - (hz - 80)) / 200, 2))), yy); g.lineTo(W / 2 + 200 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - (hz - 80)) / 200, 2))), yy); g.stroke(); } }
  if (d.mts) mountains(g, hz, seed);
  if (d.palms) K.palms(g, { y: hz + 4, t: 0 });
  if (kind === 'room') {   // 室内：墙上粉/青两束霓虹光＋墙脚灯带＋深色亮面桌
    const bl = g.createRadialGradient(300, 380, 60, 300, 380, 700); bl.addColorStop(0, 'rgba(255,79,216,.22)'); bl.addColorStop(1, 'rgba(255,79,216,0)'); g.fillStyle = bl; g.fillRect(0, 0, W, hz);
    const br = g.createRadialGradient(820, 300, 20, 820, 300, 520); br.addColorStop(0, 'rgba(63,246,255,.16)'); br.addColorStop(1, 'rgba(63,246,255,0)'); g.fillStyle = br; g.fillRect(0, 0, W, hz);
  }
  g.restore();
  // 地面
  if (kind === 'room') { g.fillStyle = '#08020f'; g.fillRect(0, M + hz, Wt, Ht - M - hz);
    const rf = g.createLinearGradient(0, M + hz, 0, M + H); rf.addColorStop(0, 'rgba(255,79,216,.12)'); rf.addColorStop(0.4, 'rgba(63,246,255,.05)'); rf.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rf; g.fillRect(0, M + hz, Wt, Ht - M - hz);
    g.save(); g.translate(M, M); g.beginPath(); g.moveTo(-M, hz); g.lineTo(W + M, hz); K.neon(g, C.cy, 4, 18); g.restore();
  } else if (d.grid) { const gf = g.createLinearGradient(0, M + hz, 0, M + H); gf.addColorStop(0, K.mix(d.sky[1], '#000000', 0.2)); gf.addColorStop(0.35, '#1c0736'); gf.addColorStop(1, '#0d0322'); g.fillStyle = gf; g.fillRect(0, M + hz, Wt, Ht - M - hz); }
});
// 透视网格地面（每帧活画：滚动）。K.grid(c,{hor,vx,col,t,n,alpha,spread,lw})
K.grid = (c, o = {}) => { const { hor = 660, vx = W / 2, col = C.cy, t = 0, n = 11, alpha = 1, spread = 300, speed = 0.35 } = o, phase = (t * speed) % 1;
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 8;
  for (let i = 0; i <= n + 1; i++) { const d = i + 1 - phase, q = d / (n + 1), y = hor + (H - hor) * q * q;
    if (y < hor + 2) continue; c.globalAlpha = alpha * clamp(q * 1.6, 0.15, 0.9); c.lineWidth = 1 + q * q * 4;
    c.beginPath(); c.moveTo(-M, y); c.lineTo(W + M, y); c.stroke(); }
  c.globalAlpha = alpha * 0.75; c.lineWidth = 2;
  for (let j = -7; j <= 7; j++) { c.beginPath(); c.moveTo(vx, hor); c.lineTo(vx + j * spread, H); c.stroke(); }
  c.restore();
  c.save(); c.globalAlpha *= alpha; c.beginPath(); c.moveTo(-M, hor); c.lineTo(W + M, hor); K.neon(c, col, 3, 22); c.restore(); };
// K.bg(c,t,{kind,hz,seed,noGrid}) —— 底缓存＋活网格
K.bg = (c, t, o = {}) => { const kind = KIND[o.kind] ? o.kind : 'night', d = KIND[kind], hz = o.hz === false ? 0 : (o.hz ?? d.hz);
  c.drawImage(bgTex(kind, hz, o.seed || 0), -M, -M);
  if (d.grid && hz && !o.noGrid) K.grid(c, { hor: hz, col: d.grid, t }); };
// 收尾：轻暗角＋字幕带（y1370–1600）压暗
K.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.45, 500, W / 2, H * 0.45, 1400); g.addColorStop(0, 'rgba(8,1,22,0)'); g.addColorStop(1, 'rgba(8,1,22,.32)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1370, 0, 1600); b.addColorStop(0, 'rgba(5,1,16,0)'); b.addColorStop(0.5, 'rgba(5,1,16,.48)'); b.addColorStop(1, 'rgba(5,1,16,0)'); c.fillStyle = b; c.fillRect(0, 1370, W, 230); };

// ---------- Win95 对话框：全片的「系统旁白」 ----------
// K.dialog(c,x,y,w,o)：o: { title:'CHOICE.EXE', label:'决定', prog 0..1, pct 文字(默认自动取整), status, button:'确定', pressed, blocks:18, s, glow:'mag'|'cy'|false, t }
// 返回 { bar:[x,y,w,h], btn:[x,y,w,h], body:[x,y,w,h] }
K.dialog = (c, x, y, w, o = {}) => { const { title = 'CHOICE.EXE', label = '决定', prog = 1, status = '', button = '确定', pressed = true, blocks = 18, s = 1, glow = 'mag', t = 0 } = o;
  const h = o.h || 316 * s; c.save(); c.translate(x, y); c.scale(s, s); const w0 = w / s, h0 = h / s;
  if (glow) { c.shadowColor = glow === 'cy' ? C.cy : C.mag; c.shadowBlur = 34; }
  c.fillStyle = C.g95; c.fillRect(0, 0, w0, h0); c.shadowBlur = 0;
  c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h0); c.lineTo(0, 0); c.lineTo(w0, 0); c.stroke();
  c.strokeStyle = '#5a5a64'; c.beginPath(); c.moveTo(w0, 0); c.lineTo(w0, h0); c.lineTo(0, h0); c.stroke();
  const tb = c.createLinearGradient(0, 0, w0, 0); tb.addColorStop(0, C.navy95); tb.addColorStop(1, C.blue95); c.fillStyle = tb; c.fillRect(6, 6, w0 - 12, 48);
  c.font = '26px "PressStart2P-400"'; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(title, 20, 32);
  for (let k = 0; k < 3; k++) { const bx = w0 - 20 - (3 - k) * 46, by = 13;
    c.fillStyle = C.g95; c.fillRect(bx, by, 38, 34);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by + 34); c.lineTo(bx, by); c.lineTo(bx + 38, by); c.stroke();
    c.strokeStyle = '#222'; c.beginPath(); c.moveTo(bx + 38, by); c.lineTo(bx + 38, by + 34); c.lineTo(bx, by + 34); c.stroke();
    c.strokeStyle = '#000'; c.lineWidth = 3;
    if (k === 0) { c.beginPath(); c.moveTo(bx + 9, by + 24); c.lineTo(bx + 29, by + 24); c.stroke(); }
    if (k === 1) c.strokeRect(bx + 9, by + 7, 20, 18);
    if (k === 2) { c.beginPath(); c.moveTo(bx + 10, by + 8); c.lineTo(bx + 28, by + 26); c.moveTo(bx + 28, by + 8); c.lineTo(bx + 10, by + 26); c.stroke(); } }
  if (label) { c.font = '46px "PuHui-Heavy"'; c.fillStyle = '#101030'; c.textBaseline = 'alphabetic'; c.fillText(label, 40, 122); }
  const pctTxt = o.pct ?? Math.round(clamp(prog) * 100) + '%';
  c.font = '30px "PressStart2P-400"'; c.fillStyle = prog >= 1 ? '#0a5c2e' : '#101030'; c.textAlign = 'right'; c.fillText(pctTxt, w0 - 40, 122); c.textAlign = 'left';
  const px = 40, py = 148, pw = w0 - 80, ph = 54;
  c.fillStyle = '#fff'; c.fillRect(px, py, pw, ph); c.strokeStyle = '#5a5a64'; c.lineWidth = 3; c.strokeRect(px, py, pw, ph);
  const bw2 = (pw - 12) / blocks - 5, nf = Math.round(clamp(prog) * blocks);
  c.fillStyle = C.navy95; for (let k = 0; k < nf; k++) c.fillRect(px + 6 + k * (bw2 + 5), py + 6, bw2, ph - 12);
  if (status) { c.font = '30px "PuHui-Medium"'; c.fillStyle = '#22222e'; c.fillText(status, 40, 250); }
  let btn = null;
  if (button) { const bbw = 140, bbh = 56, bbx = w0 - 40 - bbw, bby = 216;
    c.fillStyle = C.g95; c.fillRect(bbx, bby, bbw, bbh);
    c.strokeStyle = pressed ? '#5a5a64' : '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(bbx, bby + bbh); c.lineTo(bbx, bby); c.lineTo(bbx + bbw, bby); c.stroke();
    c.strokeStyle = pressed ? '#ffffff' : '#5a5a64'; c.beginPath(); c.moveTo(bbx + bbw, bby); c.lineTo(bbx + bbw, bby + bbh); c.lineTo(bbx, bby + bbh); c.stroke();
    c.font = '34px "PuHui-Bold"'; c.fillStyle = '#111'; c.textAlign = 'center'; c.fillText(button, bbx + bbw / 2 + (pressed ? 2 : 0), bby + 40); c.textAlign = 'left';
    btn = [x + bbx * s, y + bby * s, bbw * s, bbh * s]; }
  c.restore();
  return { bar: [x + px * s, y + py * s, pw * s, ph * s], btn, body: [x, y, w, h] }; };

// ---------- 「看不见的轨道」：物是被轨道带着走的 ----------
// K.track(c, kind:'line'|'curve'|'fork'|'loop', o)：o: { x,y 中心, w,h 范围, wd 轨宽(70), t, take 0|1 走哪条岔, deepen 0..1 越走越深越黑,
//   flow 虚线流光, pulse 行驶光点, chevrons 箭头, carry:{p 0..1(loop 可超1), s, draw(c,x,y,ang)}, col 主轨色, colDim, ends 终点环, rot, alpha }
// 返回 { pos(q, branch?) → [x,y,角度], pts }
K.track = (c, kind, o = {}) => { const { x = 540, y = 1000, w = 900, h = 360, wd = 70, t = 0, take = 0, deepen = 0, flow = true, pulse = true, chevrons = true, carry = null, col = C.mag, colDim = '#6a5a8a', ends = true, rot = 0, alpha = 1 } = o;
  const sam = (p4, n = 40) => Array.from({ length: n + 1 }, (_, i) => bez(p4, i / n));
  let segs = [], pos, loop = false;
  if (kind === 'line') { const b = o.bend ?? 0, a = sam([[x - w / 2, y], [x - w / 6, y + b], [x + w / 6, y - b], [x + w / 2, y]]); segs = [a]; pos = q => at(a, q); }
  else if (kind === 'fork') { const tr = sam([[x - w / 2, y], [x - w / 4, y], [x - w / 8, y], [x, y]], 12), b0 = sam([[x, y], [x + w / 6, y], [x + w / 3, y - h / 2], [x + w / 2, y - h / 2]]), b1 = sam([[x, y], [x + w / 6, y], [x + w / 3, y + h / 2], [x + w / 2, y + h / 2]]);
    segs = [tr, b0, b1]; const full = [tr.concat(b0), tr.concat(b1)]; pos = (q, br = take) => at(full[br], q); }
  else if (kind === 'loop') { loop = true; const a = []; for (let i = 0; i <= 72; i++) { const th = i / 72 * TAU - Math.PI / 2; a.push([x + Math.cos(th) * w / 2, y + Math.sin(th) * h / 2]); } segs = [a]; pos = q => at(a, ((q % 1) + 1) % 1); }
  else { const a = sam([[x - w / 2, y + h / 2], [x - w * 0.15, y + h * 0.55], [x - w * 0.1, y - h * 0.4], [x + w / 2, y - h / 2]], 48); segs = [a]; pos = q => at(a, q); }
  function at(a, q) { q = clamp(q); const f = q * (a.length - 1), i = Math.min(a.length - 2, Math.floor(f)), r = f - i, p = a[i], n = a[i + 1]; return [lerp(p[0], n[0], r), lerp(p[1], n[1], r), Math.atan2(n[1] - p[1], n[0] - p[0])]; }
  const wdd = wd * (1 + deepen * 0.6);
  c.save(); c.globalAlpha *= alpha; if (rot) { c.translate(x, y); c.rotate(rot); c.translate(-x, -y); }
  segs.forEach((sg, si) => { const dim = kind === 'fork' && si > 0 && (si - 1) !== take, rc = dim ? colDim : col;
    c.save(); c.globalAlpha *= dim ? 0.5 : 1;
    const bp = band(sg, wdd * 1.15, wdd * 0.9); c.fillStyle = K.mix('#0a0418', C.line, deepen * 0.7); c.fill(bp);   // 沟槽衬底（deepen 越黑越宽）
    // 双轨
    for (const sd of [-1, 1]) { const pts = sg.map((p, i) => { const pn = sg[Math.min(sg.length - 1, i + 1)], pp = sg[Math.max(0, i - 1)], dx = pn[0] - pp[0], dy = pn[1] - pp[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dy / L * wdd * 0.5 * sd, p[1] - dx / L * wdd * 0.5 * sd]; });
      neonP(c, K.poly(pts, false), rc, dim ? 4 : 7, dim ? 8 : 24, dim ? K.rgba(rc, 0.8) : '#ffd7f4'); }
    // 中央虚线（流动）
    if (flow && !dim) { c.save(); c.setLineDash([20, 34]); c.lineDashOffset = -t * 160; c.strokeStyle = C.cy; c.lineWidth = 3; c.shadowColor = C.cy; c.shadowBlur = 10; c.stroke(K.poly(sg, false)); c.restore(); }
    // 箭头（决定的方向）
    if (chevrons && !dim) for (let k = 0; k < 5; k++) { const q = (k / 5 + t * 0.22) % 1, [px, py, ang] = at(sg, q), s2 = 16;
      c.save(); c.translate(px, py); c.rotate(ang); c.globalAlpha *= 0.4 + 0.6 * Math.sin(q * Math.PI); c.strokeStyle = C.cy; c.lineWidth = 4; c.shadowColor = C.cy; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(-s2 * 0.4, -s2 * 0.7); c.lineTo(s2 * 0.5, 0); c.lineTo(-s2 * 0.4, s2 * 0.7); c.stroke(); c.restore(); }
    c.restore(); });
  // 行驶光点（「决定」正在路上）
  if (pulse) { const q = (t * 0.45) % 1, [px, py] = pos(q, take), rr = 60;
    const rg = c.createRadialGradient(px, py, 0, px, py, rr); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(0.3, K.rgba(col, 0.7)); rg.addColorStop(1, K.rgba(col, 0));
    c.fillStyle = rg; c.beginPath(); c.arc(px, py, rr, 0, TAU); c.fill(); }
  // 终点「插座」环
  if (ends && !loop) { const es = kind === 'fork' ? [pos(1, 0), pos(1, 1)] : [pos(1)]; es.forEach((e, i) => { const hot2 = kind !== 'fork' || i === take;
    c.save(); c.translate(e[0], e[1]); c.scale(1, 0.42); c.beginPath(); c.arc(0, 0, 60 * wdd / 70, 0, TAU); neonP(c, K.circle(0, 0, 60 * wdd / 70), hot2 ? C.hot : colDim, hot2 ? 8 : 4, hot2 ? 26 : 8, '#fff'); c.restore(); }); }
  if (carry) { const q = carry.p ?? 0, [px, py, ang] = pos(q, take);
    if (carry.draw) carry.draw(c, px, py, ang); else K.cup(c, px, py, { kind: 'paper', s: carry.s ?? 0.4, t, steam: 0.5 }); }
  c.restore(); return { pos, pts: segs }; };

// ---------- 鼠标指针（早已悬停/已点击） ----------
// K.cursor(c,x,y,o)：o: { s, rot, ripple 0..1 点击涟漪进度（不传=没有）, col, glow, alpha }
K.cursor = (c, x, y, o = {}) => { const { s = 2.5, rot = -0.06, ripple = null, col = '#ffffff', glow = C.cy, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const p = new Path2D(); p.moveTo(0, 0); p.lineTo(0, 54); p.lineTo(14, 41); p.lineTo(21, 62); p.lineTo(29, 59); p.lineTo(22, 39); p.lineTo(37, 39); p.closePath();
  c.shadowColor = glow; c.shadowBlur = 16; c.fillStyle = col; c.fill(p);
  c.shadowBlur = 0; c.strokeStyle = '#0a0a14'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.stroke(p); c.restore();
  if (ripple != null && ripple > 0 && ripple < 1) { const rr = 26 + ripple * 70;
    c.save(); c.translate(x, y); c.strokeStyle = K.rgba(glow, (1 - ripple) * 0.55); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke(); c.restore(); } };
// ---------- UI 选框：蚂蚁线＋角括号＋可选「已选定/未选中」标签 ----------
// K.selectBox(c,x,y,w,h,o)：o: { t, col, tag:'已选定', tagFill:'neon'|'95', on:false 时灰框（未选中）, pad }
K.selectBox = (c, x, y, w, h, o = {}) => { const { t = 0, col = C.mag, on = true, cb = 30 } = o;
  c.save(); if (!on) c.globalAlpha *= 0.75;
  c.save(); c.setLineDash([14, 12]); c.lineDashOffset = -t * 60; c.strokeStyle = on ? 'rgba(255,255,255,.85)' : 'rgba(170,170,190,.5)'; c.lineWidth = 2.5; c.strokeRect(x, y, w, h); c.restore();
  const bc = on ? col : '#8a8a9a';
  if (on) { c.strokeStyle = bc; c.lineWidth = 6; c.shadowColor = bc; c.shadowBlur = 16; } else { c.strokeStyle = bc; c.lineWidth = 4; }
  c.lineCap = 'round';
  for (const [cx2, cy2, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.beginPath(); c.moveTo(cx2 + sx * cb, cy2); c.lineTo(cx2, cy2); c.lineTo(cx2, cy2 + sy * cb); c.stroke(); }
  c.restore();
  if (o.tag) K.tag(c, o.tag, o.tagX ?? x + w / 2, o.tagY ?? y - 46, { fill: on ? 'neon' : '95', col }); };

// ---------- 杯：paper 一次性纸杯 / ceramic 陶瓷杯；lit=1 亮（被选中）、lit=0 灰（未选中） ----------
// (x,y)=杯底中心，s=1 时纸杯高 250、陶瓷杯高 190。返回 { base, rim, top, handle }
K.cup = (c, x, y, o = {}) => { const { kind = 'paper', s = 1, lit = 1, t = 0, steam = 0, flip = false, alpha = 1, tilt = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(tilt); c.scale(s * (flip ? -1 : 1), s);
  let rimY = -250, handle = null;
  if (kind === 'paper') {
    const g = c.createLinearGradient(-118, 0, 118, 0);
    if (lit) { g.addColorStop(0, '#cfd4ff'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(1, '#ffd7f0'); } else { g.addColorStop(0, '#5b5e78'); g.addColorStop(0.5, '#8388a8'); g.addColorStop(1, '#43465e'); }
    c.fillStyle = g; c.beginPath(); c.moveTo(-118, -250); c.lineTo(118, -250); c.lineTo(84, 0); c.lineTo(-84, 0); c.closePath(); c.fill();
    // 杯套
    c.save(); c.beginPath(); c.moveTo(-107, -170); c.lineTo(107, -170); c.lineTo(94, -70); c.lineTo(-94, -70); c.closePath(); c.clip();
    c.fillStyle = lit ? '#3a1145' : '#3a3a4a'; c.fillRect(-118, -170, 236, 100);
    c.strokeStyle = lit ? C.mag : '#6a6a80'; c.lineWidth = 3; if (lit) { c.shadowColor = C.mag; c.shadowBlur = 8; }
    for (let k = -3; k < 5; k++) { c.beginPath(); c.moveTo(k * 40 - 20, -66); c.lineTo(k * 40 + 34, -174); c.stroke(); }
    c.restore();
    // 盖
    c.fillStyle = lit ? C.paper : '#6b6f8c'; c.beginPath(); c.moveTo(-128, -250); c.lineTo(128, -250); c.lineTo(120, -284); c.lineTo(-120, -284); c.closePath(); c.fill();
    c.fillStyle = '#241031'; c.beginPath(); c.ellipse(20, -272, 16, 6, 0, 0, TAU); c.fill();
    // 双侧霓虹轮廓（未选中则无）
    if (lit) { c.beginPath(); c.moveTo(-118, -250); c.lineTo(-84, 0); K.neon(c, C.cy, 4, 18);
      c.beginPath(); c.moveTo(118, -250); c.lineTo(84, 0); K.neon(c, C.mag, 4, 18); }
    else { c.strokeStyle = 'rgba(160,166,200,.5)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-118, -250); c.lineTo(-84, 0); c.lineTo(84, 0); c.lineTo(118, -250); c.stroke(); }
    rimY = -284;
  } else {
    const g = c.createLinearGradient(-75, 0, 75, 0);
    if (lit) { g.addColorStop(0, '#c9c4e8'); g.addColorStop(0.5, '#f2eeff'); g.addColorStop(1, '#b8aed8'); } else { g.addColorStop(0, '#5b5e78'); g.addColorStop(0.5, '#8388a8'); g.addColorStop(1, '#43465e'); }
    const body = new Path2D(); body.moveTo(-75, -190); body.bezierCurveTo(-83, -95, -69, -10, -61, 0); body.lineTo(61, 0); body.bezierCurveTo(69, -10, 83, -95, 75, -190); body.closePath();
    c.fillStyle = g; c.fill(body);
    c.fillStyle = '#2c2e40'; c.beginPath(); c.ellipse(0, -190, 75, 18, 0, 0, TAU); c.fill();
    handle = [-99, -96];
    c.lineCap = 'round'; c.strokeStyle = lit ? '#c9c4e8' : '#9aa0c4'; c.lineWidth = 13; c.beginPath(); c.arc(-99, -96, 40, Math.PI * 0.4, Math.PI * 1.6); c.stroke();
    c.strokeStyle = lit ? '#8a80b8' : '#43465e'; c.lineWidth = 4; c.beginPath(); c.arc(-99, -96, 40, Math.PI * 0.4, Math.PI * 1.6); c.stroke();
    if (lit) neonP(c, body, C.cy, 3.5, 14, '#eaffff'); else { c.strokeStyle = 'rgba(160,166,200,.5)'; c.lineWidth = 2.5; c.stroke(body); }
    c.strokeStyle = lit ? '#e8e4f2' : '#9aa0c4'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -190, 75, 18, 0, 0, TAU); c.stroke();
    rimY = -208;
  }
  // 热气
  if (steam > 0) { const col = lit ? C.cy : '#8a8fa8'; c.save(); c.lineCap = 'round';
    for (const dx of [-26, 14]) { c.beginPath();
      for (let k = 0; k <= 20; k++) { const yy = rimY - 6 - k * 5, xx = dx + Math.sin(k * 0.55 + t * 2.4 + dx) * 9 * (k / 20 + 0.3); k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.strokeStyle = K.rgba(col, 0.65 * steam); c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = lit ? 10 : 0; c.stroke(); }
    c.restore(); }
  c.restore();
  return { base: [x, y], rim: [x, y + rimY * s], top: [x, y + rimY * s], handle: handle ? [x + handle[0] * s * (flip ? -1 : 1), y + handle[1] * s] : null }; };

// ---------- 手：霓虹线稿（深紫填充＋青色轮廓＋内部结构线），指尖朝 o.dir 方向 ----------
// K.hand(c,x,y,o)：(x,y)=手腕。o: { pose:'reach'|'point', s, rot, dir 1 朝右 -1 朝左, from:[x,y] 前臂从画外伸入, wire, col, alpha, t }
// 返回 { tip 指尖, knuckle }
K.hand = (c, x, y, o = {}) => { const { pose = 'reach', s = 1, rot = 0, dir = -1, from = null, wire = true, col = C.cy, alpha = 1, t = 0 } = o;
  c.save(); c.globalAlpha *= alpha;
  if (from) { const dx = x - from[0], dy = y - from[1], L = Math.hypot(dx, dy) || 1, mx = (x + from[0]) / 2 - dy / L * L * 0.08, my = (y + from[1]) / 2 + dx / L * L * 0.08, pts = [];
    for (let i = 0; i <= 20; i++) { const q = i / 20, u = 1 - q; pts.push([u * u * from[0] + 2 * u * q * mx + q * q * x, u * u * from[1] + 2 * u * q * my + q * q * y]); }
    const bp = band(pts, 100 * s, 74 * s); c.fillStyle = C.body; c.fill(bp);
    neonP(c, K.poly(pts.map((p, i) => { const pn = pts[Math.min(20, i + 1)], pp = pts[Math.max(0, i - 1)], ddx = pn[0] - pp[0], ddy = pn[1] - pp[1], LL = Math.hypot(ddx, ddy) || 1, w2 = lerp(50, 37, i / 20) * s; return [p[0] - ddy / LL * w2, p[1] + ddx / LL * w2]; }), false), col, 4, 16, '#eaffff');
    neonP(c, K.poly(pts.map((p, i) => { const pn = pts[Math.min(20, i + 1)], pp = pts[Math.max(0, i - 1)], ddx = pn[0] - pp[0], ddy = pn[1] - pp[1], LL = Math.hypot(ddx, ddy) || 1, w2 = lerp(50, 37, i / 20) * s; return [p[0] + ddy / LL * w2, p[1] - ddx / LL * w2]; }), false), col, 4, 16, '#eaffff'); }
  c.translate(x, y); c.rotate(rot); c.scale(s * dir, s);
  const bob = Math.sin(t * 1.8) * 3; c.translate(0, bob);
  // 局部坐标：腕在原点、指朝 +x（原型镜像整理）
  const p = new Path2D(), th = new Path2D();
  if (pose === 'reach') {
    p.moveTo(0, -100); p.bezierCurveTo(70, -110, 120, -122, 164, -134);
    p.quadraticCurveTo(202, -148, 238, -138); p.quadraticCurveTo(254, -134, 244, -118); p.quadraticCurveTo(212, -108, 188, -102);
    p.quadraticCurveTo(218, -98, 258, -86); p.quadraticCurveTo(276, -78, 264, -62); p.quadraticCurveTo(224, -54, 194, -52);
    p.quadraticCurveTo(218, -46, 248, -32); p.quadraticCurveTo(264, -22, 250, -8); p.quadraticCurveTo(214, -4, 188, -4);
    p.quadraticCurveTo(204, 2, 220, 16); p.quadraticCurveTo(230, 26, 216, 34); p.quadraticCurveTo(188, 36, 166, 32);
    p.bezierCurveTo(120, 68, 60, 90, 0, 100); p.closePath();
    th.moveTo(152, 28); th.quadraticCurveTo(190, 46, 214, 66); th.quadraticCurveTo(224, 78, 208, 84); th.quadraticCurveTo(170, 76, 134, 56); th.quadraticCurveTo(124, 44, 152, 28); th.closePath();
  } else {   // point：食指伸直，其余收进掌
    p.moveTo(0, -95); p.bezierCurveTo(60, -105, 110, -112, 150, -116);
    p.quadraticCurveTo(220, -124, 285, -118); p.quadraticCurveTo(305, -114, 296, -98); p.quadraticCurveTo(240, -88, 180, -84);   // 食指
    p.quadraticCurveTo(200, -70, 196, -52); p.quadraticCurveTo(160, -46, 138, -50);
    p.quadraticCurveTo(160, -34, 154, -18); p.quadraticCurveTo(124, -12, 106, -18);
    p.quadraticCurveTo(124, -2, 116, 12); p.quadraticCurveTo(92, 18, 80, 10);
    p.bezierCurveTo(96, 60, 60, 92, 0, 98); p.closePath();
    th.moveTo(120, 30); th.quadraticCurveTo(150, 52, 172, 72); th.quadraticCurveTo(180, 84, 164, 88); th.quadraticCurveTo(132, 76, 104, 54); th.quadraticCurveTo(96, 40, 120, 30); th.closePath();
  }
  const g = c.createLinearGradient(80, -140, 280, 120); g.addColorStop(0, C.bodyLt); g.addColorStop(1, C.body);
  c.fillStyle = g; c.fill(p); c.fill(th);
  if (wire) { c.save(); c.clip(p); c.strokeStyle = K.rgba(col, 0.5); c.lineWidth = 2 / s;
    const wx = 62, wy = 0, tips = pose === 'reach' ? [[244, -128], [270, -70], [257, -15], [223, 30], [164, -134], [166, 32]] : [[290, -108], [180, -84], [150, -116], [110, 20]];
    for (const [fx, fy] of tips) { c.beginPath(); c.moveTo(wx, wy); c.lineTo(fx, fy); c.stroke(); }
    c.restore(); }
  neonP(c, p, col, 6 / Math.max(0.5, s), 24, '#eaffff'); neonP(c, th, col, 6 / Math.max(0.5, s), 24, '#eaffff');
  c.restore();
  const cr = Math.cos(rot), sr = Math.sin(rot), tipL = pose === 'reach' ? [270, -70] : [296, -106];
  const ux = tipL[0] * s * dir, uy = tipL[1] * s;
  return { tip: [x + ux * cr - uy * sr, y + ux * sr + uy * cr], knuckle: [x + (pose === 'reach' ? 164 : 150) * s * dir * cr - (pose === 'reach' ? -134 : -116) * s * sr, y + (pose === 'reach' ? 164 : 150) * s * dir * sr + (pose === 'reach' ? -134 : -116) * s * cr] }; };

// ---------- 人：霓虹线稿小人（不画脸），(x,y)=脚底，s=1 全高约 700 ----------
// K.person(c,x,y,s,o)：o: { pose:'stand'|'sit'|'walk'|'slump', dir, t, walk 相位, col, colDim, alpha }
// 返回 { head, hand, feet }
K.person = (c, x, y, s = 1, o = {}) => { const { pose = 'stand', dir = 1, t = 0, col = C.cy, alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s * dir, s);
  const wk = o.walk == null ? 0 : Math.sin(o.walk);
  const J = {};   // 关节
  if (pose === 'sit') { Object.assign(J, { head: [0, -640], neck: [-8, -578], sh: [-10, -555], hip: [0, -300], elbow: [60, -450], hand: [152, -420], elbowB: [-42, -448], handB: [-52, -350], knee: [160, -310], foot: [168, 0], kneeB: [138, -312], footB: [142, 0] }); }
  else if (pose === 'slump') { Object.assign(J, { head: [92, -586], neck: [74, -540], sh: [70, -520], hip: [12, -370], elbow: [96, -452], hand: [104, -360], elbowB: [-16, -450], handB: [-38, -356], knee: [48, -190], foot: [68, 0], kneeB: [-12, -188], footB: [-22, 0] }); }
  else if (pose === 'walk') { Object.assign(J, { head: [40, -640], neck: [32, -578], sh: [30, -558], hip: [16, -372], elbow: [78 - wk * 26, -456], hand: [92 - wk * 40, -356], elbowB: [-26 + wk * 26, -456], handB: [-40 + wk * 40, -356], knee: [48 + wk * 34, -192], foot: [62 + wk * 62, 0], kneeB: [-10 - wk * 34, -192], footB: [-18 - wk * 62, -Math.abs(wk) * 26] }); }
  else { Object.assign(J, { head: [40, -640], neck: [32, -578], sh: [30, -558], hip: [16, -372], elbow: [80, -458], hand: [94, -358], elbowB: [-28, -458], handB: [-44, -360], knee: [48, -192], foot: [66, 0], kneeB: [-8, -192], footB: [-18, 0] }); }
  const br = Math.sin(t * 2.2) * 3; if (pose !== 'walk') { J.head[1] += br; J.neck[1] += br * 0.6; }
  // 底：深色宽 strokes（合并成剪影）
  const dark = '#150830';
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = dark; c.fillStyle = dark;
  c.lineWidth = 92; c.beginPath(); c.moveTo(J.sh[0], J.sh[1]); c.lineTo(J.hip[0], J.hip[1]); c.stroke();
  c.lineWidth = 40; [[J.sh, J.elbow, J.hand], [J.sh, J.elbowB, J.handB], [J.hip, J.knee, J.foot], [J.hip, J.kneeB, J.footB]].forEach(([a, b, d]) => { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]); c.stroke(); });
  c.lineWidth = 34; c.beginPath(); c.moveTo(J.neck[0], J.neck[1]); c.lineTo(J.head[0], J.head[1] + 40); c.stroke();
  c.beginPath(); c.arc(J.head[0], J.head[1], 56, 0, TAU); c.fill();
  // 鞋
  c.fillRect(J.foot[0] - 12, -16, 66, 16); c.fillRect(J.footB[0] - 12, J.footB[1] - 16, 66, 16);
  c.restore();
  // 芯：霓虹骨架线
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 12;
  c.lineWidth = 5; c.beginPath(); c.moveTo(J.sh[0], J.sh[1]); c.lineTo(J.hip[0], J.hip[1]); c.stroke();
  c.lineWidth = 3.5; [[J.sh, J.elbow, J.hand], [J.sh, J.elbowB, J.handB], [J.hip, J.knee, J.foot], [J.hip, J.kneeB, J.footB]].forEach(([a, b, d]) => { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]); c.stroke(); });
  c.beginPath(); c.arc(J.head[0], J.head[1], 56, 0, TAU); c.stroke();
  // 内部结构线（线框感）
  c.globalAlpha *= 0.45; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(J.sh[0], J.sh[1]); c.lineTo(J.knee[0], J.knee[1]); c.moveTo(J.sh[0], J.sh[1]); c.lineTo(J.kneeB[0], J.kneeB[1]); c.moveTo(J.hip[0], J.hip[1]); c.lineTo(J.elbow[0], J.elbow[1]); c.stroke();
  c.restore();
  c.restore();
  return { head: [x + dir * s * J.head[0], y + s * J.head[1]], hand: [x + dir * s * J.hand[0], y + s * J.hand[1]], feet: [x, y] }; };

// ---------- 默认选项开关（Win95 复选框＋霓虹勾） ----------
// K.toggle(c,x,y,{on|k 0..1, s, label, col})
K.toggle = (c, x, y, o = {}) => { const { s = 1, k = o.on ? 1 : 0, col = C.mag, label = '' } = o, e = K.ease(k); c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#fff'; c.fillRect(-30, -30, 60, 60); c.strokeStyle = '#5a5a64'; c.lineWidth = 4; c.strokeRect(-30, -30, 60, 60);
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-33, 30); c.lineTo(-33, -33); c.lineTo(33, -33); c.stroke();
  if (e > 0.02) { c.save(); c.globalAlpha *= e; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-20, 2); c.lineTo(-4, 20 - (1 - e) * 22); c.lineTo(24, -22 * e + (1 - e) * 4);
    c.strokeStyle = col; c.lineWidth = 9; c.shadowColor = col; c.shadowBlur = 14; c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.shadowBlur = 0; c.stroke(); c.restore(); }
  if (label) K.text(c, label, 66, 2, { size: 52, align: 'left', fam: 'PuHui-Bold' });
  c.restore(); };

// ---------- 习惯回路：线索→行为→奖赏 循环 ----------
// K.cycle(c,x,y,r,labels,o)：o: { p 0..1(可超1) 流动光点, hot 高亮节点, t, nodeR, col, hotCol, arrow 画方向箭头 }
K.cycle = (c, x, y, r, labels, o = {}) => { const n = labels.length, { p = null, hot = -1, nodeR = 84, col = C.cy, hotCol = C.mag, t = 0, arrow = true } = o;
  const P0 = i => [x + Math.cos(i / n * TAU - Math.PI / 2) * r, y + Math.sin(i / n * TAU - Math.PI / 2) * r];
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU - Math.PI / 2 + (nodeR + 26) / r, a1 = (i + 1) / n * TAU - Math.PI / 2 - (nodeR + 26) / r, pts = [];
    for (let k = 0; k <= 18; k++) { const a = lerp(a0, a1, k / 18); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    neonP(c, K.poly(pts, false), col, 5, 14, '#eaffff');
    if (arrow) { const e = pts[18], pr = pts[15], ang = Math.atan2(e[1] - pr[1], e[0] - pr[0]); c.save(); c.translate(e[0], e[1]); c.rotate(ang);
      c.fillStyle = '#fff'; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.moveTo(20, 0); c.lineTo(-14, -20); c.lineTo(-14, 20); c.closePath(); c.fill(); c.restore(); } }
  labels.forEach((lb, i) => { const [px, py] = P0(i), on = hot === i, cc = on ? hotCol : col;
    c.fillStyle = on ? K.mix(C.body, hotCol, 0.35) : C.body; c.beginPath(); c.arc(px, py, nodeR, 0, TAU); c.fill();
    neonP(c, K.circle(px, py, nodeR), cc, on ? 7 : 4, on ? 26 : 12, '#fff');
    K.text(c, lb, px, py + 2, { size: Math.min(64, nodeR * 0.72), maxW: nodeR * 1.7, col: '#fff', sw: 0 }); });
  if (p != null) { const a = (((p % 1) + 1) % 1) * TAU - Math.PI / 2, q = [x + Math.cos(a) * r, y + Math.sin(a) * r];
    const rg = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 46); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(0.35, K.rgba(hotCol, 0.8)); rg.addColorStop(1, K.rgba(hotCol, 0));
    c.fillStyle = rg; c.beginPath(); c.arc(q[0], q[1], 46, 0, TAU); c.fill(); } };

// ---------- 快/慢两系统：两台复古终端 ----------
// K.twoSys(c,x,y,o)：o: { gap, s, a:{label:'快', sub:'自动', col}, b:{label:'慢', sub:'费力', col}, active:'a'|'b'|null, t }
// 返回 { a:[x,y], b:[x,y] }
K.twoSys = (c, x, y, o = {}) => { const { gap = 500, s = 1, active = null, t = 0 } = o;
  const A = { label: '快', sub: '自动', col: C.cy, ...(o.a || {}) }, B = { label: '慢', sub: '费力', col: C.mag, ...(o.b || {}) };
  const mon = (cx, it, key) => { const on = active === key, dim = active && !on, w = 360, h = 300, pu = on ? 1 + Math.sin(t * 4) * 0.02 : 1;
    c.save(); c.translate(cx, y); c.scale(s * pu, s * pu); if (dim) c.globalAlpha *= 0.55;
    // 机身
    c.fillStyle = C.body; c.fill(K.round(-w / 2, -h / 2, w, h, 22));
    neonP(c, K.round(-w / 2, -h / 2, w, h, 22), it.col, on ? 6 : 3.5, on ? 26 : 10);
    // 屏
    const sc = K.round(-w / 2 + 28, -h / 2 + 28, w - 56, h - 110, 10); c.fillStyle = '#070313'; c.fill(sc);
    c.save(); c.clip(sc); c.fillStyle = 'rgba(63,246,255,.06)'; for (let yy = -h / 2 + 30; yy < h / 2 - 84; yy += 6) c.fillRect(-w / 2 + 28, yy, w - 56, 2);
    if (on) { const sg = c.createRadialGradient(0, -30, 10, 0, -30, 200); sg.addColorStop(0, K.rgba(it.col, 0.22)); sg.addColorStop(1, K.rgba(it.col, 0)); c.fillStyle = sg; c.fillRect(-w / 2, -h / 2, w, h); }
    c.restore();
    K.text(c, it.label, 0, -58, { size: 92, col: '#fff', neon: it.col, sw: 0 });
    c.font = '40px "PuHui-Bold"'; c.fillStyle = K.rgba(it.col, 0.9); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.sub, 0, 22);
    // 底座＋电源灯
    c.fillStyle = C.body; c.beginPath(); c.moveTo(-60, h / 2); c.lineTo(60, h / 2); c.lineTo(84, h / 2 + 40); c.lineTo(-84, h / 2 + 40); c.closePath(); c.fill();
    neonP(c, K.round(-110, h / 2 + 40, 220, 18, 8), it.col, 3, 8);
    c.fillStyle = on ? '#7cff9a' : '#3a4a3f'; c.beginPath(); c.arc(w / 2 - 40, h / 2 - 34, 7, 0, TAU); c.fill();
    // 光标闪烁（快）或转圈等待（慢）
    if (key === 'a') { if (Math.floor(t * 2.4) % 2 === 0) { c.fillStyle = it.col; c.fillRect(-24, 52, 34, 12); } }
    else { c.save(); c.translate(0, 58); c.rotate(t * (on ? 1.2 : 0.4)); c.strokeStyle = it.col; c.lineWidth = 5; c.lineCap = 'round'; c.shadowColor = it.col; c.shadowBlur = 8;
      c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 1.4); c.stroke(); c.restore(); }
    c.restore(); };
  mon(x - gap / 2, A, 'a'); mon(x + gap / 2, B, 'b');
  return { a: [x - gap / 2, y], b: [x + gap / 2, y] }; };

// ---------- 脑：侧视脑轮廓＋预测弧（向前射出的虚线弧=提前做好的预测） ----------
// K.brain(c,x,y,o)：o: { s, col, zones:[{x,y,r,col}], pulse, rays 0..1, t, seed }
// 外轮廓＝圆瓣并集：从中心按角度射线求最远交点，得到一条合并边界（描边不会一颗一颗）
K.brain = (c, x, y, o = {}) => { const { s = 1, col = C.cy, zones = [], pulse = 0, rays = 0, t = 0 } = o; c.save(); c.translate(x, y); c.scale(s, s);
  const R = U.rng(o.seed || 7), lobes = [{ x: 0, y: -10, r: 150 }, { x: -60, y: -8, r: 120 }, { x: 60, y: -8, r: 120 },
    { x: 150, y: 120, r: 48 }, { x: 112, y: 148, r: 44 }, { x: 188, y: 148, r: 40 }, { x: 52, y: 140, r: 44 }, { x: 62, y: 212, r: 46 }];
  for (let i = 0; i < 13; i++) { const a = i / 13 * TAU; lobes.push({ x: Math.cos(a) * 168, y: Math.sin(a) * 112 - 10, r: 62 + R() * 16 }); }
  // 并集边界（星形域近似：每条射线取所有圆瓣的最远出射点）
  const bnd = [];
  for (let k = 0; k < 180; k++) { const a = k / 180 * TAU, dx = Math.cos(a), dy = Math.sin(a); let best = 0;
    for (const L of lobes) { const t0 = L.x * dx + L.y * dy, ca2 = L.x * L.x + L.y * L.y - t0 * t0; if (ca2 > L.r * L.r) continue; const out = t0 + Math.sqrt(L.r * L.r - ca2); if (out > best) best = out; }
    bnd.push([dx * best, dy * best]); }
  const outline = K.poly(bnd, true);
  c.fillStyle = K.rgba(C.body, 0.92); c.fill(outline);
  // 轮廓：先描一道同色粗边收缝，再描霓虹（全脑一条合并轮廓）
  c.save(); c.strokeStyle = C.body; c.lineWidth = 14; c.lineJoin = 'round'; c.stroke(outline); c.restore();
  neonP(c, outline, col, 5, 16, '#eaffff');
  // 沟回
  c.save(); c.clip(outline);
  c.strokeStyle = K.rgba(col, 0.4); c.lineWidth = 4; c.lineCap = 'round';
  [[[-170, -20], [-120, -80], [-60, -40], [-10, -90], [50, -60]], [[-150, 40], [-100, 0], [-50, 50], [0, 10], [60, 40]], [[20, -100], [70, -50], [120, -90], [170, -40]], [[-60, 100], [-10, 60], [50, 100], [110, 60], [160, 80]]].forEach(pts => { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); });
  zones.forEach(z => { const pu = 1 + pulse * Math.sin(t * 5 + z.x) * 0.12, g = c.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r * pu); g.addColorStop(0, K.rgba(z.col || '#ffffff', 0.85)); g.addColorStop(1, K.rgba(z.col || '#ffffff', 0)); c.fillStyle = g; c.beginPath(); c.arc(z.x, z.y, z.r * pu, 0, TAU); c.fill(); });
  c.restore();
  // 预测弧：从脑前方向右前方射出的虚线弧（决定先于意识）
  if (rays > 0) for (let i = 0; i < 3; i++) { const q = clamp(rays * 1.3 - i * 0.2); if (q <= 0) continue;
    const x0 = 230, y0 = -70 + i * 50, x1 = x0 + 170 + i * 30, y1 = y0 - 60 + i * 40, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 40, pts = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16, v = 1 - u; pts.push([v * v * x0 + 2 * v * u * mx + u * u * x1, v * v * y0 + 2 * v * u * my + u * u * y1]); }
    c.save(); c.setLineDash([14, 12]); c.lineDashOffset = -t * 90; c.globalAlpha *= q;
    neonP(c, K.poly(pts.slice(0, Math.max(2, Math.round(16 * q))), false), C.mag, 4, 12, '#ffd7f4'); c.restore(); }
  c.restore(); };

// ---------- 示意柱（默认带「示意」小标） ----------
// K.bars(c,x,y,w,h,vals,o)：(x,y)=左下角。o: { hot, labels, p 生长, mark, col, hotCol }
K.bars = (c, x, y, w, h, vals, o = {}) => { const n = vals.length, bw = w / n * 0.62, gap = w / n, { hot = -1, labels = null, p = 1, mark = true, col = C.cy, hotCol = C.mag } = o;
  c.save(); c.beginPath(); c.moveTo(x - 24, y); c.lineTo(x + w + 24, y); K.neon(c, col, 4, 12);
  vals.forEach((v, i) => { const bh = Math.max(6, h * v * K.ease(clamp(p * 1.3 - i * 0.08))), bx = x + i * gap + (gap - bw) / 2, on = hot === i, cc = on ? hotCol : col;
    c.fillStyle = on ? K.mix(C.body, hotCol, 0.4) : C.body; c.fill(K.round(bx, y - bh, bw, bh, 10));
    neonP(c, K.round(bx, y - bh, bw, bh, 10), cc, on ? 5 : 3, on ? 20 : 10);
    if (labels && labels[i]) K.text(c, labels[i], bx + bw / 2, y + 48, { size: 44, maxW: gap * 0.95, fam: 'PuHui-Bold' }); });
  if (mark) K.mark(c, x + w - 60, y - h - 40); c.restore(); };

// ---------- 时间轴：K.timeline(c,x0,x1,y,{events:[{p,label,hot}],prog,t}) → X(p) ----------
K.timeline = (c, x0, x1, y, o = {}) => { const { events = [], prog = 1, t = 0 } = o, X = q => lerp(x0, x1, q);
  c.save(); c.lineCap = 'round'; c.strokeStyle = K.rgba(C.violet, 0.5); c.lineWidth = 6; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 30, y); c.stroke();
  c.save(); c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(X(prog), y); K.neon(c, C.cy, 6, 14); c.restore();
  const ang = 0; c.save(); c.translate(x1 + 44, y); c.fillStyle = '#fff'; c.shadowColor = C.cy; c.shadowBlur = 10; c.beginPath(); c.moveTo(22, 0); c.lineTo(-14, -18); c.lineTo(-14, 18); c.closePath(); c.fill(); c.restore();
  events.forEach((e, i) => { const px = X(e.p), up = i % 2 === 0, on = e.p <= prog + 1e-6; c.save(); c.globalAlpha *= on ? 1 : 0.5;
    c.fillStyle = e.hot ? C.mag : C.body; c.beginPath(); c.arc(px, y, e.hot ? 22 : 15, 0, TAU); c.fill();
    neonP(c, K.circle(px, y, e.hot ? 22 : 15), e.hot ? C.mag : C.cy, 3.5, 10);
    if (e.label) { c.strokeStyle = K.rgba(C.cy, 0.6); c.lineWidth = 3; c.beginPath(); c.moveTo(px, y + (up ? -30 : 30)); c.lineTo(px, y + (up ? -66 : 66)); c.stroke();
      K.tag(c, e.label, px, y + (up ? -104 : 104), { col: e.hot ? C.mag : C.cy, fill: 'neon' }); }
    c.restore(); });
  c.restore(); return X; };

// ---------- VHS 后期（可选挂载，默认轻：扫描线 α≤0.13、RGB 分离 2-3px，别糊字） ----------
// K.vhs(c,S,t,lt,o)：先把整幅画进离屏 S，再调它输出到 c。o: { split 错位px, scan:[a1,a2], band 跟踪噪声带, osd:{label,clock}|false, vignette }
K.vhs = (c, S, t, lt, o = {}) => { const { split = 2.5, scan = [0.13, 0.05], band: bandOn = false, osd = false, vignette = 'rgba(10,0,25,.5)' } = o;
  const f = Math.floor(t * 60), jit = U.hash(f >> 2, 9) < 0.1 ? 2 : 0, ca = split + jit + Math.sin(t * 7) * 0.8;
  P.rgbSplit(c, S, { r: [-ca, 0], g: [0, 0], b: [ca, 0.6], key: 'vwKitSplit' });
  if (bandOn) { const by = ((lt * 460 + 200) % (H + 160)) - 80, bh = 60, r = U.rng(f * 7 + 1);
    for (let yy = by; yy < by + bh; yy += 6) { const dx = (r() - 0.5) * 44 * Math.sin((yy - by) / bh * Math.PI); c.drawImage(S, 0, yy, W, 6, dx, yy, W, 6); } }
  P.scanlines(c, Math.min(0.13, scan[0]), Math.min(0.08, scan[1]));
  if (osd) { c.save(); c.globalAlpha = 0.8; c.font = '28px "PressStart2P-400"'; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowOffsetX = 3; c.shadowOffsetY = 3;
    if (Math.floor(lt) % 2 === 0) { c.fillText(osd.label || 'PLAY', 42, 68); c.beginPath(); c.moveTo(196, 44); c.lineTo(226, 61); c.lineTo(196, 78); c.closePath(); c.fill(); }
    c.textAlign = 'right'; c.fillText(osd.clock || 'AM 07:00', W - 42, 68); c.restore(); }
  if (vignette) P.vignette(c, { cx: W / 2, cy: H * 0.52, inner: H * 0.34, outer: H * 0.72, col: vignette }); };
// 建离屏（配 K.vhs 用）：const S = K.stage(); 每帧 S.getContext('2d') 清屏重画
K.stage = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };

// ---------- 章节卡：复古窗口＋霓虹站牌，进度按章数 ----------
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
K.CHAPTER_KINDS = ['night', 'mono', 'blue', 'dawn'];          // 四章一变色移：深夜霓虹→单色机制→蓝屏极简→黎明暖调
// 章节卡贯穿物：纸杯走到本站；章作者可在 props.js 里覆盖 K.cardToken
K.cardToken = K.cardToken || ((c, x, y, lt, t, walking, arriveAt, o = {}) => { const hop = walking ? -Math.abs(Math.sin(lt * 9)) * 20 : 0;
  K.cup(c, x, y + hop, { kind: 'paper', s: 0.42, t, steam: 0.5 }); });
K.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), kind = o.kind || K.CHAPTER_KINDS[(n - 1) % K.CHAPTER_KINDS.length];
  K.bg(c, t, { kind, seed: n });
  const pop = MO.cubicOut(K.at(lt, 0.05, 0.45)); if (pop <= 0) { K.finish(c); return; }
  // 窗口
  const wx = 90, wy = 240, ww = 900, wh = 800, cx = wx + ww / 2, cy = wy + wh / 2;
  c.save(); c.translate(cx, cy); c.scale(pop, pop); c.translate(-cx, -cy);
  const d = K.dialog(c, wx, wy, ww, { title: `CHAPTER_${String(n).padStart(2, '0')}.EXE`, label: '', prog: (n - 1 + MO.cubicOut(K.at(lt, 0.5, 0.9))) / N, status: '', button: null, blocks: Math.max(N * 2, 12), h: wh, glow: kind === 'blue' ? false : 'mag', t });
  // 章号霓虹牌（让开对话框自带的加载条：条在 wy+148..202）
  const s0 = K.pop(lt, 0.2, 0.4); if (s0 > 0) K.tag(c, `第 ${n} 章`, cx, wy + 256, { size: 64, fam: 'PuHui-Black', col: C.cy, scale: s0 });
  // 章名（≤8 字，超了 K.split2 拆两行）
  const lines = K.split2(title), all = lines.reduce((a, l) => a + [...l].length, 0), shown = Math.round(K.at(lt, 0.5, Math.max(0.3, all / 14)) * all);
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
    if (k > 0) K.title(c, a.slice(0, k).join(''), cx, wy + (lines.length > 1 ? 400 + i * 160 : 480), { size: lines.length > 1 ? 104 : 124, col: i ? C.cy : C.mag, plate: false }); });
  // 进度站牌：N 站，纸杯走到本站
  const x0 = wx + 120, x1 = wx + ww - 120, sy = wy + wh - 130, X = i => lerp(x0, x1, N > 1 ? i / (N - 1) : 0);
  c.strokeStyle = K.rgba(C.violet, 0.55); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 16, sy); c.lineTo(x1 + 16, sy); c.stroke();
  const walkEnd = 1.3, q = MO.cubicInOut(K.at(lt, 0.35, walkEnd - 0.35)), from = n > 1 ? X(n - 2) : x0 - 60, tx = lerp(from, X(n - 1), q);
  c.beginPath(); c.moveTo(x0 - 16, sy); c.lineTo(Math.max(x0 - 16, tx), sy); K.neon(c, C.cy, 5, 14);
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, walkEnd, 0.45) : 1, rr = cur ? 18 * Math.max(0.6, pp) : 10;
    c.fillStyle = cur ? C.mag : past ? C.cy : C.body; c.beginPath(); c.arc(X(i), sy, rr, 0, TAU); c.fill();
    if (cur || past) neonP(c, K.circle(X(i), sy, rr), cur ? C.mag : C.cy, 3.5, 12); }
  K.cardToken(c, tx, sy - 24, lt, t, lt < walkEnd, walkEnd, {});
  c.restore();
  K.finish(c);
};

// ---------- 字幕（assemble 生成的 subs.js 调它）：深底板＋白字，y≈1480，让开视频号底栏 ----------
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 72), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(8,2,20,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 20); c.fill();
  c.strokeStyle = K.rgba(C.cy, 0.55); c.lineWidth = 2.5; c.stroke();
  c.fillStyle = '#f4f1ff'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
