// 画风套件 klimt（配方 huashu-art-motion 18_klimt「克里姆特金色时期」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 画法：金箔墙（逐像素缓存，一片片的贴箔接缝）＋平面装饰纹样（金螺旋、荷鲁斯眼、同心圆、黑白长方块）对写实渐变的脸与手；
//       黑白方格（约瑟夫·霍夫曼）桌面与图解面板；数据与字一律放素面信息区/纸卡，金色描边 ≥6px；
//       活感：金粉闪烁上浮、金箔碎片飘落、斜向流光、袍上纹样转与眨。
// 用色纪律（评审定的）：哑金为主、亮金只给焦点（关键数字、房卡、印章）；失败/坟场章节用 bronze 古铜降金；单镜金面积 ≤60%。
// 版式：主体 y 200–1350；y 1380–1560 字幕带；字 ≥ 44px（标签 52+）。禁蓝紫霓虹。
// 约定：除纸卡/面板外组件 (x,y) 是锚点（人=头中心给 hx,hy；桌=桌面中心；房卡=中心）。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const K = window.K = { W, H, TAU };
// 兜底：负半径直接抛错，一律按 0 画
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }

const C = K.C = {
  ink: '#1d140c', ink2: '#3a2a18', paper: '#f6ecd2', paperDk: '#e8d8ae', cream: '#f4efe2',
  gold: '#d6a845', goldHi: '#f6d880', goldLo: '#8a5f18', goldDeep: '#7a5514', bronze: '#a8783a', bronzeDk: '#6a4a22',
  red: '#a8322a', redLt: '#d0503a', blue: '#2a4a9a', green: '#2a7a5a', violet: '#6a3a8a',
  black: '#141010', skin: '#f0cfb8', skinHi: '#fbe8da',
};
const rng = U.rng, hash = U.hash;
K.hex = P.hex;
K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
K.poly = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);

// ======================= 金箔底（逐像素，缓存；层比屏幕大一圈，可随相机平移）=======================
const M = 200, LW = W + 2 * M, LH = H + 2 * M;
const goldTex = () => K.once('GOLD', () => {
  const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH; const g = cv.getContext('2d');
  const img = g.createImageData(LW, LH), d = img.data, r = rng(19);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const mott = P.fbm(x * 0.004 + 3, y * 0.004, 4), brush = P.noise(x * 0.003, y * 0.08) * 0.45, gr = (r() - 0.5) * 0.1;
    const f = clamp(0.5 + mott * 0.55 + brush * 0.5 + gr);
    const col = f < 0.5 ? P.mix([120, 78, 18], [196, 148, 52], f * 2) : P.mix([196, 148, 52], [246, 216, 128], (f - 0.5) * 2);
    const i = (y * LW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(90,55,10,.16)'; g.lineWidth = 1;   // 贴箔接缝
  for (let y = 0; y < LH; y += 96) for (let x = (y / 96 % 2) * 48; x < LW; x += 96) g.strokeRect(x + 0.5, y + 0.5, 96, 96);
  return cv;
});
K.goldTex = goldTex;
// 墙：金箔 × 斑驳 multiply（《吻》的褐金底）＋ 金粉撒点；tone 决定压暗/调色
const TONE_ADJ = {
  gold:   { mul: null,                    speck: 1,    floor: 1 },
  dim:    { mul: 'rgba(88,62,24,.34)',    speck: 0.7,  floor: 1 },   // 哑金：分析/图解章
  bronze: { mul: 'rgba(96,64,30,.5)',     speck: 0.45, floor: 0.8 }, // 古铜：失败/坟场章（降金）
  night:  { mul: 'rgba(28,24,38,.55)',    speck: 0.8,  floor: 0.7 }, // 深夜金：签字/严肃时刻
};
const FY = 1500;   // 方格地板上沿
const bgLayer = (tone, withFloor) => K.once('BG|' + tone + (withFloor ? '|f' : ''), () => {
  const adj = TONE_ADJ[tone]; if (!adj) throw new Error('K.bg: 没有这个 tone：' + tone);
  const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH; const g = cv.getContext('2d');
  g.drawImage(goldTex(), 0, 0);
  g.globalCompositeOperation = 'multiply';
  const mott = K.once('MOTT', () => { const m = document.createElement('canvas'); m.width = 360; m.height = 640; const h = m.getContext('2d');
    const im = h.createImageData(360, 640), d = im.data; for (let y = 0; y < 640; y++) for (let x = 0; x < 360; x++) { const n = P.fbm(x * 0.012 + 9, y * 0.012, 4); const v = clamp(0.62 + n * 0.7); const i = (y * 360 + x) * 4; d[i] = 255 * v; d[i + 1] = 235 * v; d[i + 2] = 190 * v; d[i + 3] = 255; } h.putImageData(im, 0, 0); return m; });
  g.drawImage(mott, 0, 0, LW, LH);
  if (adj.mul) { g.fillStyle = adj.mul; g.fillRect(0, 0, LW, LH); }
  g.globalCompositeOperation = 'source-over';
  const r = rng(23); for (let i = 0; i < 7000 * adj.speck; i++) { const x = r() * LW, y = r() * LH, s = 0.6 + r() * 2.2; g.fillStyle = r() < 0.7 ? `rgba(250,226,140,${0.3 + r() * 0.5})` : `rgba(70,40,10,${0.2 + r() * 0.3})`; g.fillRect(x, y, s, s); }
  if (!withFloor) return cv;
  // 方格地板（黑白，向下变大，整体压暗）
  const gy = FY + M;
  const grd = g.createLinearGradient(0, gy, 0, LH); grd.addColorStop(0, '#3a2c16'); grd.addColorStop(1, '#241a0c'); g.fillStyle = grd; g.fillRect(0, gy, LW, LH - gy);
  let y = gy + 20, s = 44, row = 0;
  while (y < LH) { for (let x = (row % 2 ? -s : 0) - M, k = 0; x < LW; x += s, k++) { g.fillStyle = k % 2 ? '#141010' : '#f4efe2'; g.fillRect(x, y, s - 2, s - 2); } y += s; s *= 1.11; row++; }
  g.fillStyle = `rgba(36,24,8,${0.5 + (1 - adj.floor) * 0.3})`; g.fillRect(0, gy, LW, LH - gy);
  g.fillStyle = '#d6a845'; g.fillRect(0, gy - 4, LW, 6);
  return cv;
});
K.warm = (tones = Object.keys(TONE_ADJ)) => tones.forEach(tn => bgLayer(tn, true));   // 可选：开场预热（首tone约1–2秒）
// 动态母题：金粉闪烁上浮＋金箔碎片飘落（hash 固定位，永不重洗）
const DUST = (() => { const r = rng(31), o = []; for (let i = 0; i < 300; i++) o.push([r() * (W + 80) - 40, r() * H, 1.5 + r() * 3.2, r() * 6.28, 3 + r() * 6]); return o; })();
K.dust = (c, t, o = {}) => {
  const a0 = o.alpha ?? 1;
  c.save(); c.globalCompositeOperation = 'lighter';
  DUST.forEach(([x0, y0, s, ph, sp]) => { const x = x0 + Math.sin(t * 0.8 + ph) * 12, y = ((y0 - t * 24) % H + H) % H; const tw = Math.sin(t * sp + ph); if (tw < 0.55) return; const a = (tw - 0.55) / 0.45, R = s * (0.6 + a * 1.1);
    c.fillStyle = `rgba(255,236,160,${0.8 * a * a0})`; c.beginPath(); c.moveTo(x, y - R * 2); c.lineTo(x + R * 0.35, y - R * 0.35); c.lineTo(x + R * 2, y); c.lineTo(x + R * 0.35, y + R * 0.35); c.lineTo(x, y + R * 2); c.lineTo(x - R * 0.35, y + R * 0.35); c.lineTo(x - R * 2, y); c.lineTo(x - R * 0.35, y - R * 0.35); c.closePath(); c.fill(); });
  c.restore();
};
K.flakes = (c, t, o = {}) => {
  P.particles(o.n || 26, o.seed || 77, t, { x0: 0, x1: W, y0: -30, y1: H * (o.span || 0.7), speed: o.speed || 130, drift: 30, life: 3.2 }).forEach(p => {
    c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(1, Math.cos(t * 5 + p.i));
    const s2 = 6 + p.s * 7, g2 = c.createLinearGradient(-s2, -s2, s2, s2); g2.addColorStop(0, '#fbe6a0'); g2.addColorStop(1, '#a8741e'); c.fillStyle = g2;
    if (p.i % 3) c.fillRect(-s2, -s2, s2 * 2, s2 * 2); else { c.beginPath(); c.arc(0, 0, s2, 0, TAU); c.fill(); } c.restore();
  });
};
// tone: gold 亮金（叙事/高潮）｜dim 哑金（分析图解，默认）｜bronze 古铜（失败/坟场）｜night 深夜金（签字/严肃）
// o: {floor:true 画方格地板, motif:true 金粉＋碎片, flakes/dust 也可单独调}
K.bg = (c, t, o = {}) => {
  const tone = o.tone || 'dim';
  c.drawImage(bgLayer(tone, o.floor !== false), -M, -M);
  if (o.motif !== false) { K.dust(c, t, { alpha: tone === 'night' ? 0.9 : 1 }); K.flakes(c, t, { n: tone === 'bronze' ? 12 : 26 }); }
};
// 斜向流光：亮带匀速扫过（重音/开场一次）。o:{at,dur,x0,x1,alpha}
K.sweep = (c, lt, o = {}) => {
  const p = K.at(lt, o.at ?? 0, o.dur ?? 2.2); if (p <= 0 || p >= 1) return;
  const sx = lerp(o.x0 ?? -300, o.x1 ?? 1500, p);
  const gr = c.createLinearGradient(sx - 220, 0, sx + 220, 0); gr.addColorStop(0, 'rgba(255,240,180,0)'); gr.addColorStop(0.5, `rgba(255,240,180,${o.alpha ?? 0.2})`); gr.addColorStop(1, 'rgba(255,240,180,0)');
  c.save(); c.globalCompositeOperation = 'lighter'; c.transform(1, 0, -0.4, 1, 0, 0); c.fillStyle = gr; c.fillRect(sx - 800, 0, 1600, H); c.restore();
};

// ======================= 纹样 ===============================
// 金螺旋：rot 随 t 转
K.spiral = (c, x, y, R, rot, col = '#f2cf6a', lw = 2.2) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let a = 0; a < Math.PI * 5.2; a += 0.22) { const rr = R * a / (Math.PI * 5.2); const px = x + Math.cos(a + rot) * rr, py = y + Math.sin(a + rot) * rr; a ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); };
// 荷鲁斯式眼形纹：open 0..1（轮流眨：sin(t*2.2+ph)>0.86 时闭上）
K.eye = (c, x, y, L, open, iris = C.blue) => {
  const h = L * 0.42 * open;
  c.fillStyle = '#f6f0e0'; c.strokeStyle = C.ink; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(x - L / 2, y); c.quadraticCurveTo(x, y - h * 2, x + L / 2, y); c.quadraticCurveTo(x, y + h * 2, x - L / 2, y); c.closePath(); c.fill(); c.stroke();
  if (open > 0.25) { c.save(); c.clip(); c.fillStyle = iris; c.beginPath(); c.arc(x, y, L * 0.22, 0, TAU); c.fill(); c.fillStyle = C.ink; c.beginPath(); c.arc(x, y, L * 0.1, 0, TAU); c.fill(); c.restore(); }
  c.beginPath(); c.moveTo(x - L / 2 - 4, y); c.quadraticCurveTo(x, y - L * 0.42 * 2 - 3, x + L / 2 + 4, y); c.stroke();
};
// 在盒 [x0,y0,x1,y1] 里撒 n 个纹样：同心圆 30% / 深褐底金螺旋（转）32% / 眼形（眨）22% / 点簇红心 16%
K.patterns = (c, box, n, seed, t, s0 = 1) => {
  const r = rng(seed); const [x0, y0, x1, y1] = box;
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), k = r(), s = s0 * (0.7 + r() * 0.6), ph = r() * 6.28;
    if (k < 0.3) { const R = 15 * s, cols = [[C.red, '#f4efe2', C.blue], [C.blue, C.gold, C.red], [C.violet, '#f4efe2', C.gold]][i % 3]; cols.forEach((col, j) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, R * (1 - j * 0.3), 0, TAU); c.fill(); }); }
    else if (k < 0.62) { c.fillStyle = '#3a2410'; c.beginPath(); c.arc(x, y, 14 * s, 0, TAU); c.fill(); K.spiral(c, x, y, 12 * s, t * 4 * (i % 2 ? 1 : -1) + ph); }
    else if (k < 0.84) { const bl = Math.sin(t * 2.2 + ph * 3); const open = bl > 0.86 ? clamp(1 - (bl - 0.86) / 0.07) : 1; K.eye(c, x, y, 30 * s, Math.max(0.08, open), [C.blue, C.green, '#8a2a2a'][i % 3]); }
    else { c.fillStyle = '#f4efe2'; for (let j = 0; j < 5; j++) { c.beginPath(); c.arc(x + Math.cos(j * 1.26) * 8 * s, y + Math.sin(j * 1.26) * 8 * s, 3 * s, 0, TAU); c.fill(); } c.fillStyle = C.red; c.beginPath(); c.arc(x, y, 3.6 * s, 0, TAU); c.fill(); }
  }
};
// 写实皮肤渐变（与平面金袍的对比就是克里姆特）
K.skinGrad = (c, cx, cy, R) => { const g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.3); g.addColorStop(0, '#fbe8da'); g.addColorStop(0.5, '#f0cfb8'); g.addColorStop(0.85, '#d8a88c'); g.addColorStop(1, '#b88068'); return g; };

// ======================= 人物 ===============================
// 平面金袍（剪影 source-in 纹样）＋写实的脸与手。o: {hx,hy 头中心, hr 头半径, box:[x0,y0,x1,y1] 袍盒, seed,
//   pat 纹样数, hem:'rect' 下摆黑白长方块（《吻》男子袍）, hair:'bun' 圆髻（'cap' 或缺省＝深色发盖）, robe:'gold'|'bronze'|'ink'（ink=深褐袍；也可用 tone:'wall'|'gold'|'bronze'|'night' 别名）,
//   mood:'calm'|'stern'（stern=压低眉、抿嘴）,
//   armOnly 只画臂（复用同 seed 纹样层）, reach:[x0,y0,x1,y1,wr] 伸臂（袖口黑白格＋写实手，指尖到 x1,y1）, alpha}
K.figure = (c, t, o) => {
  const bob = Math.sin(t * 1.6 + (o.seed || 0)) * 4;
  const [x0, y0, x1, y1] = o.box;
  const alpha = o.alpha ?? 1;
  let Pt = null;
  c.save(); c.globalAlpha *= alpha;
  if (!o.armOnly) {
    const robeKind = o.robe || ({ wall: 'gold', gold: 'gold', dim: 'gold', bronze: 'bronze', night: 'ink', ink: 'ink' })[o.tone] || 'gold';
    const shY = o.hy + o.hr * 1.15 + bob;
    const robe = new Path2D();
    robe.moveTo(o.hx - o.hr * 0.9, shY);
    robe.quadraticCurveTo(o.hx, shY - o.hr * 0.5, o.hx + o.hr * 0.9, shY);
    robe.lineTo(x1, y1); robe.lineTo(x0, y1); robe.closePath();
    Pt = P.scratch('kl_pat' + (o.seed || 0)); const pt = Pt.getContext('2d'); pt.reset();
    if (robeKind === 'ink') { pt.fillStyle = '#241408'; pt.fillRect(0, 0, W, H); }
    else { pt.drawImage(goldTex(), -M, -M); if (robeKind === 'bronze') { pt.globalCompositeOperation = 'multiply'; pt.fillStyle = 'rgba(96,64,30,.5)'; pt.fillRect(0, 0, W, H); pt.globalCompositeOperation = 'source-over'; } }
    K.patterns(pt, [x0, shY, x1, y1], o.pat ?? 60, (o.seed || 1) * 31 + 7, t, o.hr / 70);
    if (o.hem === 'rect') { const r = rng((o.seed || 1) * 17); for (let i = 0; i < 26; i++) { const x = x0 + r() * (x1 - x0), y = y1 - 200 + r() * 180, w = 12 + r() * 14, h = 30 + r() * 44; pt.fillStyle = r() < 0.55 ? '#141010' : '#f4efe2'; pt.fillRect(x, y, w, h); pt.strokeStyle = '#d6a845'; pt.lineWidth = 2; pt.strokeRect(x, y, w, h); } }
    const Rl = P.scratch('kl_robe' + (o.seed || 0)), rl = Rl.getContext('2d'); rl.reset();
    rl.fillStyle = '#000'; rl.fill(robe);
    rl.globalCompositeOperation = 'source-in'; rl.drawImage(Pt, 0, 0);
    rl.globalCompositeOperation = 'source-over'; rl.strokeStyle = C.ink; rl.lineWidth = 3.5; rl.stroke(robe);
    c.drawImage(Rl, 0, 0);
    // 颈
    c.fillStyle = K.skinGrad(c, o.hx, shY, o.hr * 0.5);
    c.beginPath(); c.rect(o.hx - o.hr * 0.3, o.hy + o.hr * 0.5 + bob, o.hr * 0.6, shY - o.hy); c.fill();
    // 脸
    c.fillStyle = K.skinGrad(c, o.hx - o.hr * 0.1, o.hy + bob, o.hr);
    c.beginPath(); c.arc(o.hx, o.hy + bob, o.hr, 0, TAU); c.fill();
    // 发：深色盖；'bun' 多一个圆髻（金螺旋）
    c.fillStyle = '#2a1a0e';
    c.beginPath(); c.arc(o.hx, o.hy - o.hr * 0.18 + bob, o.hr * 1.02, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    if (o.hair === 'bun') { c.beginPath(); c.arc(o.hx + o.hr * 0.2, o.hy - o.hr * 1.05 + bob, o.hr * 0.42, 0, TAU); c.fill(); K.spiral(c, o.hx + o.hr * 0.2, o.hy - o.hr * 1.05 + bob, o.hr * 0.34, 0.6, 'rgba(200,150,60,.8)', 1.6); }
    // 五官：倦眼（半垂）、鼻、唇；stern=压低眉、抿平嘴
    const ey = o.hy + bob, stern = o.mood === 'stern';
    c.strokeStyle = '#3a2216'; c.lineWidth = 2.6;
    [-0.38, 0.38].forEach(dx => { const ex = o.hx + dx * o.hr; c.beginPath(); c.moveTo(ex - o.hr * 0.2, ey); c.quadraticCurveTo(ex, ey + o.hr * 0.1, ex + o.hr * 0.2, ey - o.hr * 0.02); c.stroke(); });
    if (stern) { c.strokeStyle = '#2a1a0e'; c.lineWidth = 3.2; [-0.38, 0.38].forEach(dx => { const ex = o.hx + dx * o.hr, sd = Math.sign(dx); c.beginPath(); c.moveTo(ex - sd * o.hr * 0.24, ey - o.hr * 0.22); c.lineTo(ex + sd * o.hr * 0.2, ey - o.hr * 0.13); c.stroke(); }); }
    c.beginPath(); c.moveTo(o.hx + o.hr * 0.04, ey + o.hr * 0.12); c.quadraticCurveTo(o.hx + o.hr * 0.14, ey + o.hr * 0.42, o.hx - o.hr * 0.02, ey + o.hr * 0.5); c.stroke();
    c.strokeStyle = '#a8322f'; c.lineWidth = 3;
    if (stern) { c.beginPath(); c.moveTo(o.hx - o.hr * 0.17, ey + o.hr * 0.68); c.lineTo(o.hx + o.hr * 0.17, ey + o.hr * 0.66); c.stroke(); }
    else { c.beginPath(); c.moveTo(o.hx - o.hr * 0.18, ey + o.hr * 0.66); c.quadraticCurveTo(o.hx, ey + o.hr * 0.74, o.hx + o.hr * 0.18, ey + o.hr * 0.64); c.stroke(); }
    // 腮红
    c.save(); c.filter = 'blur(6px)'; c.fillStyle = 'rgba(232,120,110,.3)'; [-0.42, 0.42].forEach(dx => { c.beginPath(); c.arc(o.hx + dx * o.hr, ey + o.hr * 0.36, o.hr * 0.16, 0, TAU); c.fill(); }); c.filter = 'none'; c.restore();
  } else { Pt = P.scratch('kl_pat' + (o.seed || 0)); }
  // 伸臂：纹样袖＋黑白格袖口＋写实的手（指尖落在 x1,y1）
  if (o.reach) {
    const [ax0, ay0, ax1, ay1, wr] = o.reach;
    const arm = new Path2D();
    arm.moveTo(ax0, ay0 - wr); arm.quadraticCurveTo((ax0 + ax1) / 2, (ay0 + ay1) / 2 - wr * 1.4, ax1, ay1 - wr * 0.55);
    arm.lineTo(ax1, ay1 + wr * 0.55); arm.quadraticCurveTo((ax0 + ax1) / 2, (ay0 + ay1) / 2 + wr * 1.6, ax0, ay0 + wr); arm.closePath();
    const Pa = P.scratch('kl_arm' + (o.seed || 0)), pa = Pa.getContext('2d'); pa.reset();
    pa.fillStyle = '#000'; pa.fill(arm); pa.globalCompositeOperation = 'source-in'; pa.drawImage(Pt, 0, 0);
    pa.globalCompositeOperation = 'source-over'; pa.strokeStyle = C.ink; pa.lineWidth = 3; pa.stroke(arm);
    c.drawImage(Pa, 0, 0);
    c.save(); c.fillStyle = '#141010'; c.beginPath(); c.arc(ax1, ay1, wr * 0.72, 0, TAU); c.fill();
    c.fillStyle = '#f4efe2'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.fillRect(ax1 + Math.cos(a) * wr * 0.42 - 3, ay1 + Math.sin(a) * wr * 0.42 - 3, 6, 6); } c.restore();
    c.fillStyle = K.skinGrad(c, ax1 + wr * 0.8, ay1, wr * 0.6);
    c.beginPath(); c.ellipse(ax1 + wr * 1.05, ay1, wr * 0.72, wr * 0.5, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(150,90,70,.5)'; c.lineWidth = 1.4; c.stroke();
    for (let f = 0; f < 4; f++) { c.beginPath(); c.ellipse(ax1 + wr * (1.5 + f * 0.16), ay1 - wr * 0.34 + f * wr * 0.22, wr * 0.3, wr * 0.11, 0.1, 0, TAU); c.fillStyle = K.skinGrad(c, ax1 + wr * 1.6, ay1, wr * 0.4); c.fill(); }
  }
  c.restore();
};

// ======================= 桌（霍夫曼黑白方格）=================
// K.table(c, x, y, s)：桌面中心 (x,y)。桌面椭圆 rx 420s ry 118s，桌裙到 y+380s。
K.table = (c, x = 540, y = 1215, s = 1) => {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#111'; c.beginPath(); c.moveTo(-390, 25); c.lineTo(390, 25); c.lineTo(350, 405); c.lineTo(-350, 405); c.closePath(); c.fill();
  c.fillStyle = '#f4efe2';
  for (let px = -340; px < 360; px += 26) for (let py = 45; py < 385; py += 26) if ((((px / 26) | 0) + ((py / 26) | 0)) % 2 === 0) c.fillRect(px, py, 20, 20);
  c.strokeStyle = '#d6a845'; c.lineWidth = 4; c.beginPath(); c.moveTo(-350, 401); c.lineTo(350, 401); c.stroke();
  c.save(); c.beginPath(); c.ellipse(0, 0, 420, 118, 0, 0, TAU); c.clip();
  c.fillStyle = '#141010'; c.fillRect(-420, -118, 840, 236);
  c.fillStyle = '#f4efe2';
  for (let px = -420; px < 420; px += 30) for (let py = -118; py < 118; py += 30) if ((((px / 30) | 0) + ((py / 30) | 0)) % 2 === 0) c.fillRect(px, py, 26, 26);
  c.restore();
  c.strokeStyle = '#d6a845'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, 420, 118, 0, 0, TAU); c.stroke();
  c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 414, 112, 0, 0, TAU); c.stroke();
  c.restore();
};

// ======================= 纸、房卡、印 =========================
// 素面纸卡：奶白纸＋墨描边，可选顶边黑白方格条（check:true）或色带（band:'#…'）。fn(c,w,h) 画内容（原点在中心）。
// 不传 fn 时用内建版式：o.title 标题、o.lines 示意条款行数（默认 0）、o.red 红圈大字（如 '51%'）、o.seal 朱砂印单字。
K.paper = (c, x, y, w, h, o = {}, fn) => {
  if (!fn && (o.title || o.red || o.seal || o.lines)) fn = (c2, w2, h2) => {
    if (o.title) K.text(c2, o.title, 0, -h2 / 2 + 62, { size: Math.min(48, w2 * 0.9 / Math.max([...o.title].length, 1) * 1.15), fam: 'LXGWWenKai-500', col: C.ink, stroke: null });
    c2.strokeStyle = 'rgba(60,40,20,.5)'; c2.lineWidth = 2;
    for (let i = 0; i < (o.lines || 0); i++) { const dy = -20 + i * 30; c2.beginPath(); c2.moveTo(-w2 / 2 + 26, dy + 60); for (let x = -w2 / 2 + 26; x < w2 / 2 - 26; x += 8) c2.lineTo(x, dy + 60 + Math.sin(x * 0.3 + dy) * 2.5); c2.stroke(); }
    if (o.red) { K.text(c2, o.red, 0, h2 / 2 - 88, { size: 74, col: C.red, stroke: null });
      c2.strokeStyle = C.red; c2.lineWidth = 5; c2.beginPath(); c2.ellipse(0, h2 / 2 - 92, 96, 58, -0.08, 0, TAU); c2.stroke(); }
    if (o.seal) K.seal(c2, w2 / 2 - 42, h2 / 2 - 40, 24, { text: o.seal });
  };
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
  c.fillStyle = 'rgba(20,10,4,.35)'; c.beginPath(); c.roundRect(-w / 2 + 8, -h / 2 + 14, w, h, 8); c.fill();
  const pg = c.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#fbf3da'); pg.addColorStop(1, '#efe0b8');
  c.fillStyle = pg; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 8); c.fill();
  c.strokeStyle = C.ink; c.lineWidth = 3; c.stroke();
  if (o.check) { c.save(); c.clip(); for (let px = -w / 2 + 8, k = 0; px < w / 2 - 8; px += 16, k++) { c.fillStyle = k % 2 ? '#141010' : '#d6a845'; c.fillRect(px, -h / 2 + 10, 14, 10); } c.restore(); }
  if (o.band) { c.save(); c.clip(); c.fillStyle = o.band; c.fillRect(-w / 2, -h / 2, w, 18); c.restore(); }
  if (fn) fn(c, w, h);
  c.restore();
};
// 贯穿物：酒店房卡。o:{rot, scale, label='房卡', split:0..1（劈开两半）, case:true（玻璃柜）, glow:0..1, tone}
K.keycard = (c, x, y, o = {}) => {
  const kw = 176, kh = 108, s = o.scale || 1;
  c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s);
  if (o.glow) { const g = c.createRadialGradient(0, 0, 10, 0, 0, 180); g.addColorStop(0, `rgba(255,236,160,${0.55 * o.glow})`); g.addColorStop(1, 'rgba(255,236,160,0)'); c.fillStyle = g; c.fillRect(-180, -180, 360, 360); }
  const half = (dx, clipSign) => {
    c.save(); c.translate(dx, 0);
    if (clipSign) { c.beginPath(); c.rect(clipSign < 0 ? -kw : 0, -kh, kw, kh * 2); c.clip(); }
    c.fillStyle = 'rgba(20,10,4,.3)'; c.beginPath(); c.roundRect(-kw / 2 + 6, -kh / 2 + 10, kw, kh, 12); c.fill();
    const g = c.createLinearGradient(-kw / 2, 0, kw / 2, 0); g.addColorStop(0, '#f6d880'); g.addColorStop(0.5, '#c8962e'); g.addColorStop(1, '#8a5a14');
    c.fillStyle = g; c.beginPath(); c.roundRect(-kw / 2, -kh / 2, kw, kh, 12); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#141010'; c.fillRect(-kw / 2 + 10, -kh / 2 + 14, kw - 20, 18);
    K.spiral(c, -kw / 2 + 40, 18, 17, (o.t || 0) * 1.5, '#3a2410', 2);
    const label = o.text !== undefined ? o.text : (o.label ?? '房卡');
    if (label) { c.fillStyle = '#3a2410'; c.font = '30px "LXGWWenKai-500"'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, -kw / 2 + 66, 20); }
    c.restore();
  };
  if (o.split) { const g2 = 26 * o.split; half(-g2, -1); half(g2, 1); } else half(0, 0);
  if (o.case) { c.fillStyle = 'rgba(240,248,255,.16)'; c.beginPath(); c.roundRect(-kw / 2 - 26, -kh / 2 - 30, kw + 52, kh + 60, 18); c.fill(); c.strokeStyle = 'rgba(250,252,255,.55)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4; c.beginPath(); c.moveTo(-kw / 2 + 6, -kh / 2 - 14); c.lineTo(-kw / 2 + 44, -kh / 2 - 24); c.stroke(); }
  c.restore();
};
// 朱砂印：圆印（「合」「密」「退」…）或方印（shape:'sq'）
K.seal = (c, x, y, r = 26, o = {}) => {
  c.save(); c.translate(x, y); c.rotate(o.rot ?? 0.1); c.globalAlpha *= o.alpha ?? 0.88;
  c.fillStyle = o.col || C.red;
  if (o.shape === 'sq') c.fillRect(-r, -r, r * 2, r * 2); else { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }
  c.fillStyle = C.paper; c.font = `${r * 1.15}px "LXGWWenKai-500"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.text || '合', 0, r * 0.06);
  c.restore();
};

// ======================= 图解组件 ===========================
// 信息面板：素面信息区＋金框＋黑白方格外沿（图解章强制用这个放字和图）。返回内框 {x,y,w,h}。
K.panel = (c, x, y, w, h, o = {}) => {
  c.save();
  const pad = 26;
  c.fillStyle = 'rgba(20,10,4,.4)'; c.beginPath(); c.roundRect(x - w / 2 + 10, y - h / 2 + 16, w, h, 10); c.fill();
  c.fillStyle = o.fill || C.paper; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 10); c.fill();
  c.strokeStyle = C.gold; c.lineWidth = o.lw || 7; c.stroke();
  c.strokeStyle = C.ink; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x - w / 2 + 9, y - h / 2 + 9, w - 18, h - 18, 6); c.stroke();
  if (o.check !== false) {   // 顶底两条黑白方格
    for (let px = x - w / 2 + 12, k = 0; px < x + w / 2 - 12; px += 16, k++) { c.fillStyle = k % 2 ? '#141010' : '#d6a845'; c.fillRect(px, y - h / 2 + 14, 13, 9); c.fillRect(px, y + h / 2 - 23, 13, 9); }
  }
  if (o.title) { K.tag(c, o.title, x, y - h / 2 + 8, { size: o.tsize || 46 }); }
  c.restore();
  return { x: x - w / 2 + pad, y: y - h / 2 + pad + (o.title ? 34 : 0), w: w - pad * 2, h: h - pad * 2 - (o.title ? 34 : 0) };
};
// 小卡：金框素面，pop 进场。o:{fill, lw, at, lt（给了才 pop）}
K.card = (c, x, y, w, h, o = {}) => {
  let sc = 1, al = o.alpha ?? 1;
  if (o.lt !== undefined) { const p = K.pop(o.lt, o.at ?? 0, o.dur || 0.4); if (p <= 0) return 0; sc = p; al *= clamp(p * 2); }
  c.save(); c.translate(x, y); c.scale(sc, sc); c.globalAlpha *= al;
  c.fillStyle = 'rgba(20,10,4,.35)'; c.beginPath(); c.roundRect(-w / 2 + 7, -h / 2 + 11, w, h, 10); c.fill();
  c.fillStyle = o.fill || C.paper; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 10); c.fill();
  c.strokeStyle = o.frame || C.gold; c.lineWidth = o.lw || 6; c.stroke();
  c.restore(); return 1;
};
// 连线：金线（可虚线），prog 0..1 画出一截
K.link = (c, x0, y0, x1, y1, o = {}) => {
  const p = o.prog ?? 1; if (p <= 0) return;
  c.save(); c.strokeStyle = o.col || C.gold; c.lineWidth = o.w || 5; c.lineCap = 'round';
  if (o.dash) c.setLineDash(o.dash);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(x0, x1, p), lerp(y0, y1, p)); c.stroke(); c.setLineDash([]);
  if (o.arrow && p > 0.95) { const a = Math.atan2(y1 - y0, x1 - x0); c.fillStyle = o.col || C.gold; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 22 * Math.cos(a - 0.42), y1 - 22 * Math.sin(a - 0.42)); c.lineTo(x1 - 22 * Math.cos(a + 0.42), y1 - 22 * Math.sin(a + 0.42)); c.closePath(); c.fill(); }
  c.restore();
};
// 层叠结构（四层栈这类）：layers=[{label, sub?, fill?}]，从下到上 pop。o:{h, gap, w, at, lt, size}
K.stack = (c, x, yTop, w, layers, lt, at, o = {}) => {
  const lh = o.h || 108, gap = o.gap || 18, n = layers.length;
  layers.forEach((L, i) => {
    const y = yTop + i * (lh + gap) + lh / 2;
    if (!K.card(c, x, y, w, lh, { lt, at: at + i * (o.stagger ?? 0.22), fill: L.fill, frame: L.frame || C.gold })) return;
    K.text(c, L.label, x, y - (L.sub ? 18 : 0), { size: o.size || 50, col: C.ink, stroke: null });
    if (L.sub) K.text(c, L.sub, x, y + 30, { size: (o.size || 50) * 0.62, fam: 'PuHui-Bold', col: C.ink2, stroke: null });
  });
  return n * (lh + gap) - gap;
};
// 决策清单：黑白方格勾选项逐行 pop。items=[「问句」或 {t, mark:'✓'|'✗'|'?'|''}]。o:{size, gap, at, lt, w}
K.checklist = (c, x, y, items, lt, at, o = {}) => {
  const size = o.size || 46, gap = o.gap || size * 1.9, bw = o.w || 900;
  items.forEach((it, i) => {
    const p = K.pop(lt, at + i * (o.stagger ?? 0.18), 0.35); if (p <= 0) return;
    const itm = typeof it === 'string' ? { t: it } : it, yy = y + i * gap;
    c.save(); c.globalAlpha *= clamp(p * 2); c.translate(x, yy); c.scale(p, p);
    c.fillStyle = C.paper; c.fillRect(-bw / 2, -size * 0.8, bw, size * 1.6); c.strokeStyle = C.gold; c.lineWidth = 4; c.strokeRect(-bw / 2, -size * 0.8, bw, size * 1.6);
    // 黑白格小方块＋标记
    c.fillStyle = '#f4efe2'; c.fillRect(-bw / 2 + 12, -size * 0.55, size * 1.1, size * 1.1); c.strokeStyle = C.ink; c.lineWidth = 3; c.strokeRect(-bw / 2 + 12, -size * 0.55, size * 1.1, size * 1.1);
    if (itm.mark) {   // 手画标记（✓✗ 字形不在 GB2312 子集字体里，画线不用字）
      const mx = -bw / 2 + 12 + size * 0.55, mk = itm.mark, col = mk === '✗' ? C.red : mk === '✓' ? C.green : C.gold;
      c.save(); c.strokeStyle = col; c.lineWidth = size * 0.16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
      if (mk === '✓') { c.moveTo(mx - size * 0.32, 0); c.lineTo(mx - size * 0.08, size * 0.26); c.lineTo(mx + size * 0.36, -size * 0.3); }
      else if (mk === '✗') { c.moveTo(mx - size * 0.28, -size * 0.28); c.lineTo(mx + size * 0.28, size * 0.28); c.moveTo(mx + size * 0.28, -size * 0.28); c.lineTo(mx - size * 0.28, size * 0.28); }
      else { c.moveTo(mx - size * 0.2, -size * 0.28); c.quadraticCurveTo(mx + size * 0.3, -size * 0.34, mx + size * 0.12, size * 0.02); c.lineTo(mx, size * 0.16); c.stroke(); c.beginPath(); c.arc(mx, size * 0.34, size * 0.06, 0, TAU); c.fillStyle = col; c.fill(); }
      c.stroke(); c.restore(); }
    K.text(c, itm.t, -bw / 2 + 24 + size * 1.2, 2, { size, col: C.ink, stroke: null, align: 'left', maxW: bw - size * 1.2 - 52 });
    c.restore();
  });
  return items.length * gap;
};

// ======================= 文字 ===============================
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, stroke = C.ink, sw: swd = size * 0.16 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px'; let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round'; if (stroke && swd > 0) { c.lineWidth = swd; c.strokeStyle = stroke; c.strokeText(s, 0, 0); } c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 金字标题（金渐变＋深墨描边）：主标题专用
K.goldText = (c, s, x, y, o = {}) => { const size = o.size || 96;
  c.save(); c.font = `${size}px "${o.fam || 'LXGWWenKai-500'}"`; let k = 1; if (o.maxW) { const w = c.measureText(s).width; if (w > o.maxW) k = o.maxW / w; }
  c.translate(x, y); c.scale(k, k); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = size * 0.13; c.strokeStyle = 'rgba(29,20,12,.92)'; c.strokeText(s, 0, 0);
  const g = c.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fbe6a0'); g.addColorStop(0.5, '#d6a845'); g.addColorStop(1, '#9a6a1c');
  c.fillStyle = g; c.fillText(s, 0, 0); c.restore(); };
K.textW = (c, s, size, fam = 'PuHui-Black') => { c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width; c.restore(); return w; };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99; a.forEach((ch, i) => { if (/[，、：； ·]/.test(ch) && Math.abs(i - mid) < bd) { bd = Math.abs(i - mid); best = i; } }); const cut = best >= 0 && bd < a.length * 0.3 ? best + 1 : Math.ceil(mid); return [a.slice(0, cut).join(''), a.slice(cut).join('')]; };
// 标签纸：奶白小纸牌＋墨字＋金边；返回宽度
K.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.paper, col = C.ink, scale = 1, alpha = 1, rot = 0, padX = 0.7 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * padX * 2, h = size * 1.55;
  c.fillStyle = 'rgba(20,10,4,.3)'; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 10, w, h, 14); c.fill();
  c.fillStyle = fill; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 14); c.fill(); c.strokeStyle = C.gold; c.lineWidth = 4; c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 2); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else if (o.gold) K.goldText(c, s, x, y, { ...o, size: (o.size || 96) * p * (o.scale || 1) }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：金线画出来，末端标签纸逐字打出。(ax,ay) 指向物，(bx,by) 标签中心
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => {
  const { size = 50 } = o, p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.gold; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke(); c.fillStyle = C.gold; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.stroke(); c.restore();
  const chars = [...s], shown = Math.round(K.at(lt, at + 0.3, Math.max(0.25, chars.length / 18)) * chars.length);
  if (shown > 0) K.tag(c, chars.slice(0, shown).join(''), bx, by, { size, fill: o.fill || C.paper, col: o.col || C.ink });
};
// 每镜收尾：暗角＋字幕带压暗
K.finish = c => { c.drawImage(K.once('FIN', () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const v = g.createRadialGradient(540, 900, 600, 540, 960, 1350); v.addColorStop(0, 'rgba(30,20,8,0)'); v.addColorStop(1, 'rgba(30,20,8,.22)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const b = g.createLinearGradient(0, 1330, 0, 1580); b.addColorStop(0, 'rgba(25,15,5,0)'); b.addColorStop(1, 'rgba(25,15,5,.4)'); g.fillStyle = b; g.fillRect(0, 1330, W, H - 1330); return cv; }), 0, 0); };

// ======================= 章节卡 / 字幕 =======================
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];
K.CARD_TONES = ['gold', 'dim', 'gold', 'night'];   // 按章号轮换的底；失败案例章可在章节内自己用 bronze
K.chapterCard = (c, lt, t, n, title = '') => {
  const tone = K.CARD_TONES[(n - 1) % K.CARD_TONES.length];
  K.bg(c, t, { tone, floor: false });
  // 中央：黑白方格环＋章号
  const rise = MO.cubicOut(K.at(lt, 0, 0.9)), cy0 = lerp(1180, 830, rise);
  c.save(); c.globalAlpha = rise;
  c.fillStyle = C.ink; c.beginPath(); c.arc(540, cy0, 150, 0, TAU); c.fill();
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + t * 0.1; c.fillStyle = k % 2 ? '#f4efe2' : '#d6a845'; c.save(); c.translate(540 + Math.cos(a) * 150, cy0 + Math.sin(a) * 150); c.rotate(a); c.fillRect(-13, -13, 26, 26); c.restore(); }
  c.strokeStyle = C.gold; c.lineWidth = 6; c.beginPath(); c.arc(540, cy0, 172, 0, TAU); c.stroke();
  K.goldText(c, String(n).padStart(2, '0'), 540, cy0 + 4, { size: 110, fam: 'PuHui-Black' });
  c.restore();
  // N 站进度：黑白格串，当前章金底放大；房卡骑在当前站
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 140, x1 = 940, y = 1130, X = i => lerp(x0, x1, i / (N - 1));
  c.save();
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1; c.fillStyle = cur ? C.gold : past ? C.cream : 'rgba(244,239,226,.35)'; const s = cur ? 22 : 14; c.save(); c.translate(X(i), y); c.rotate(Math.PI / 4); c.fillRect(-s, -s, s * 2, s * 2); c.restore(); if (cur) { c.strokeStyle = C.cream; c.lineWidth = 4; c.beginPath(); c.arc(X(i), y, 34, 0, TAU); c.stroke(); } }
  c.restore();
  const q = MO.cubicInOut(K.at(lt, 0.15, 0.9));
  K.keycard(c, lerp(n > 1 ? X(n - 2) : x0 - 80, X(n - 1), q), y - 74, { rot: -0.08, scale: 0.62, t });
  if (lt > 0.1) { const s2 = MO.slamK((lt - 0.1) / 0.17); K.tag(c, `第 ${n} 章`, 540, 300, { size: 62, fam: 'PuHui-Black', scale: s2 }); }
  const lines = K.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(K.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 7 ? 102 : 120;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length; if (k > 0) K.goldText(c, a.slice(0, k).join(''), 540, (lines.length > 1 ? 480 : 520) + i * size * 1.3, { size, maxW: 940 }); });
  K.finish(c);
};
// 字幕：深墨底＋金框细线＋奶白字，字幕带 y≈1480
K.subtitle = (c, text, a = 1) => { c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(24,16,6,.85)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.strokeStyle = 'rgba(214,168,69,.5)'; c.lineWidth = 2.5; c.stroke();
  c.fillStyle = '#f6ecd2'; c.fillText(text, x, y + 2, 1000); c.restore(); };
})();
