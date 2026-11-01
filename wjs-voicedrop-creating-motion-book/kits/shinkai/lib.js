// 画风套件 shinkai（配方 huashu-art-motion 35_shinkai「新海诚光影」；来自《债券到底怎么投》）：竖屏 1080×1920。导出 window.K（章节代码里写 const K = window.K）。
// 规矩：天是主角——积雨云（剪影＋偏移亮球＋糊清两层）、丁达尔光柱、一个主光斑在左上；纸片/欠条/图表卡/手一律赛璐珞两调（P.cel）；
//       字一律程序渲染（PuHui 三个字重），图表不画在天上而画在「纸质图表卡」或「暗靛蓝数据舞台」上；
//       数据三色语义固定：面值=红 C.face、票息=蓝 C.coupon、期限=绿 C.term；图表卡必带「示意」角标。
//       天色 5 种：day 晴 / dusk 黄昏 / overcast 阴 / night 夜 / cloudsea 云海；图表章把 calm 调到 0.6–0.85 让天退成低对比背景。
//       性能：云团和光柱画一次缓存到离屏（K.once / PAINT.cached），每帧只做 drawImage 平移＋光晕＋光尘＋泛光。所有随机走 U.rng / U.hash，同一 t 画同一帧。
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
  sky0: '#0F55C4', sky1: '#2B7BE0', sky2: '#8EC8F5', cloud: '#F7FAFF', cloudShade: '#3A4570',
  indigo: '#1B2760', indigo2: '#0F1848', navy: '#2A3866', label: '#5A6485',
  paper: '#FBF6E6', paper2: '#DDD0B2', edge: '#C4574E', white: '#FFFFFF', gold: '#F2B33D', goldLt: '#FFE08A', goldDk: '#B9801F',
  face: '#D9534A', coupon: '#4A78C8', term: '#3A9A74',   // 数据三色语义：面值红/票息蓝/期限绿
};
const SEM = { face: C.face, coupon: C.coupon, term: C.term };
const semCol = c => SEM[c] || c || C.coupon;

K.at = (lt, a, d) => clamp((lt - a) / d);
K.pop = (lt, a, d = 0.5) => { const q = K.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.3); };
K.cache = {}; K.once = (k, f) => K.cache[k] || (K.cache[k] = f());
K.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
K.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
K.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
K.world = (c, cam, fn) => CAM.with(c, cam, fn);
K.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json

const lum = hex => { const v = DG.arr(hex); return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255; };
const hexA = (hex, a) => { const v = DG.arr(hex); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };

// =====================================================================================================
// 天：K.sky(c, t, { mood, calm, dim, sun:true|false, beams:true|false, dust:true|false, bloom:true|false, drift })
//   mood: 'day' | 'dusk' | 'overcast' | 'night' | 'cloudsea'
//   calm 0..1：0＝完整光影；0.6–0.85＝图表章背景（降饱和降亮度、关光柱和星芒、云变平）
//   dim 0..1：整体压暗（给前景大字让路）
// =====================================================================================================
const MOODS = {
  day:      { g: ['#0F55C4', '#3F93EC', '#9ED6FF', '#E6F6FF'], sh: ['#B7C6E6', '#7F94C6'], lit: ['#FFFFFF', '#F8F6F4', '#E4EAFA'], sun: [190, 250], beam: '255,243,210', ba: 1, haze: '#1B3F9C', tint: ['rgba(255,220,170,.34)', 'rgba(80,120,220,.34)'] },
  dusk:     { g: ['#23245E', '#6A4AA0', '#FF8F7A', '#FFD59A'], sh: ['#8A5F9C', '#4A3472'], lit: ['#FFF0DC', '#FFD3B0', '#F0A8A8'], sun: [640, 960], beam: '255,190,140', ba: 0.8, haze: '#2A1A5A', tint: ['rgba(255,170,120,.4)', 'rgba(110,80,200,.34)'] },
  overcast: { g: ['#586A8C', '#8296B2', '#B1BED0', '#D6DDE8'], sh: ['#8896B0', '#66769A'], lit: ['#DCE2EB', '#C8D1DF', '#AEBACC'], sun: [210, 300], beam: '255,255,255', ba: 0, haze: '#34415E', tint: ['rgba(220,225,235,.16)', 'rgba(70,90,140,.2)'] },
  night:    { g: ['#050A24', '#10205A', '#22377A', '#3C4F8F'], sh: ['#1C2A5A', '#0E1740'], lit: ['#8FA6E0', '#5E78C0', '#34488C'], sun: [190, 260], beam: '170,200,255', ba: 0.55, haze: '#050A24', tint: ['rgba(150,180,255,.2)', 'rgba(20,30,100,.3)'] },
  cloudsea: { g: ['#1C64D0', '#4F9CF0', '#A8DCFF', '#F2FAFF'], sh: ['#BCCBE8', '#8499C8'], lit: ['#FFFFFF', '#F8F6F4', '#E6ECFB'], sun: [190, 250], beam: '255,243,210', ba: 0.9, haze: '#1B3F9C', tint: ['rgba(255,220,170,.3)', 'rgba(80,120,220,.3)'] },
};
K.MOODS = Object.keys(MOODS);
const mk = (seed, n, f) => { const r = U.rng(seed), out = []; for (let i = 0; i < n; i++) out.push(f(r, i)); return out; };
const BLOBS = {
  tower: () => [
    ...mk(11, 150, r => { const h = Math.pow(r(), 0.85), y = 1480 - h * 1000, w = h > 0.86 ? 420 : lerp(380, 170, h); return { x: 180 + (r() - 0.5) * w * 1.4 + h * 90, y: y + (r() - 0.5) * 40, r: lerp(110, 52, h) * (0.7 + r() * 0.6) }; }),
    ...mk(22, 50, r => { const h = Math.pow(r(), 0.9), y = 1440 - h * 620; return { x: 960 + (r() - 0.5) * lerp(260, 120, h), y: y + (r() - 0.5) * 30, r: lerp(90, 46, h) * (0.7 + r() * 0.6) }; }),
    ...mk(33, 110, r => ({ x: r() * 1300 - 100, y: 1380 + r() * 560, r: 70 + r() * 80 }))],
  sea: () => [
    ...mk(41, 230, r => ({ x: r() * 1300 - 100, y: 980 + Math.pow(r(), 0.8) * 1000, r: 70 + r() * 90 })),
    ...mk(42, 40, r => ({ x: r() * 1300 - 100, y: 860 + r() * 140, r: 50 + r() * 60 })),
    ...mk(43, 70, r => ({ x: 700 + (r() - 0.5) * 520, y: 700 + r() * 320, r: 40 + r() * 60 * (1 - r() * 0.4) }))],   // 右侧一座小云峰
  flat: () => [
    ...mk(51, 90, r => ({ x: r() * 1300 - 100, y: 160 + r() * 1300, r: 90 + r() * 120 })),
    ...mk(52, 70, r => ({ x: r() * 1300 - 100, y: 1300 + r() * 600, r: 90 + r() * 90 }))],
  night: () => [
    ...mk(61, 60, r => { const h = Math.pow(r(), 0.9), y = 1440 - h * 560; return { x: 930 + (r() - 0.5) * lerp(300, 120, h), y: y + (r() - 0.5) * 30, r: lerp(90, 46, h) * (0.7 + r() * 0.6) }; }),
    ...mk(62, 150, r => ({ x: r() * 1300 - 100, y: 1250 + r() * 700, r: 70 + r() * 90 }))],
};
const MOOD_BLOBS = { day: 'tower', dusk: 'tower', overcast: 'flat', night: 'night', cloudsea: 'sea' };
// 云层贴图（缓存，宽 W+200 供横向漂移）：①蓝灰剪影 ②每团偏向光源画白色亮球 ③整层糊 6px 再叠 55% 清晰层
const cloudTex = mood => P.cached('shk_cloud_' + mood, W + 200, H, g => {
  const M = MOODS[mood], bl = BLOBS[MOOD_BLOBS[mood]]().sort((a, b) => b.y - a.y), L = P.canvas(W + 200, H), l = L.getContext('2d');
  l.translate(100, 0);
  bl.forEach(b => { const gr = l.createLinearGradient(0, b.y - b.r, 0, b.y + b.r); gr.addColorStop(0, M.sh[0]); gr.addColorStop(1, M.sh[1]); l.fillStyle = gr; l.beginPath(); l.arc(b.x, b.y, b.r, 0, TAU); l.fill(); });
  bl.forEach(b => { const ox = b.x - b.r * 0.18, oy = b.y - b.r * 0.24, rr = b.r * 0.9;
    const gr = l.createRadialGradient(ox - rr * 0.3, oy - rr * 0.3, rr * 0.05, ox, oy, rr); gr.addColorStop(0, M.lit[0]); gr.addColorStop(0.55, M.lit[1]); gr.addColorStop(0.85, M.lit[2]); gr.addColorStop(1, hexA(M.lit[2], 0));
    l.fillStyle = gr; l.beginPath(); l.arc(ox, oy, rr, 0, TAU); l.fill(); });
  g.save(); g.filter = 'blur(10px)'; g.drawImage(L, 0, 0); g.restore(); g.globalAlpha = 0.3; g.drawImage(L, 0, 0); });
// 光柱贴图（缓存）：从光源向外的 3 个楔形，糊 26px
const beamTex = mood => P.cached('shk_beam_' + mood, W, H, g => {
  const M = MOODS[mood], S = M.sun, dusk = mood === 'dusk';
  const wedges = dusk ? [[-2.35, 0.2, 0.5], [-1.95, 0.14, 0.4], [-2.75, 0.12, 0.34]] : [[0.98, 0.2, 0.5], [1.2, 0.14, 0.4], [0.72, 0.12, 0.34]];   // [方向角, 半张角, α]
  g.filter = 'blur(26px)';
  wedges.forEach(([ang, sp, al]) => { const L = 2100, a0 = ang - sp, a1 = ang + sp;
    const lg = g.createLinearGradient(S[0], S[1], S[0] + Math.cos(ang) * 1500, S[1] + Math.sin(ang) * 1500); lg.addColorStop(0, `rgba(${M.beam},${al})`); lg.addColorStop(1, `rgba(${M.beam},0)`);
    g.fillStyle = lg; g.beginPath(); g.moveTo(S[0] - 30 * Math.sin(ang), S[1] + 30 * Math.cos(ang)); g.lineTo(S[0] + 30 * Math.sin(ang), S[1] - 30 * Math.cos(ang));
    g.lineTo(S[0] + Math.cos(a1) * L, S[1] + Math.sin(a1) * L); g.lineTo(S[0] + Math.cos(a0) * L, S[1] + Math.sin(a0) * L); g.closePath(); g.fill(); }); });
const starTex = () => P.cached('shk_stars', W, H, g => { const r = U.rng(77); for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * 1000, s = r() < 0.12 ? 4 : 2.5; g.fillStyle = `rgba(230,238,255,${0.35 + r() * 0.5})`; g.fillRect(x, y, s, s); } });
const wisps = (c, t, col, a) => { c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round';   // 高空薄云丝
  [[560, 400, 1000, 330], [620, 470, 1040, 430]].forEach(([x0, y0, x1, y1]) => { c.beginPath(); c.moveTo(x0 + t * 6, y0); c.quadraticCurveTo((x0 + x1) / 2, y0 - 30, x1 + t * 6, y1); c.stroke(); }); c.restore(); };
K.sky = (c, t, o = {}) => {
  const mood = MOODS[o.mood] ? o.mood : 'day', M = MOODS[mood], calm = clamp(o.calm ?? 0), dim = clamp(o.dim ?? 0), S = M.sun;
  const sg = c.createLinearGradient(0, 0, 0, 1500); [0, 0.35, 0.7, 1].forEach((s, i) => sg.addColorStop(s, M.g[i])); c.fillStyle = sg; c.fillRect(0, 0, W, H);
  if (mood === 'night') c.drawImage(starTex(), 0, 0);
  // 云：两层视差漂移（近层 x 往复 ±60，远丝带慢一点）
  const dx = -100 + Math.sin(t * 0.09) * 60;
  c.save(); c.globalAlpha = 1 - 0.35 * calm; c.drawImage(cloudTex(mood), dx, 0); c.restore();
  if (mood !== 'night') wisps(c, t, mood === 'dusk' ? '#FFE6C8' : '#FFFFFF', 0.35 * (1 - calm));
  if (mood === 'day' && calm < 0.5) for (let k = 0; k < 3; k++) { const bx = 700 + t * 40 % 400 + k * 40 - 200, by = 240 + k * 18 + Math.sin(t * 3 + k) * 5, f = Math.sin(t * 14 + k * 2) * 7;   // 远处几只鸟
    c.strokeStyle = '#2F4A78'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 12, by - f); c.lineTo(bx, by); c.lineTo(bx + 12, by - f); c.stroke(); }
  // 压暗下部：让中下部的白字站得住
  const hz = c.createLinearGradient(0, 600, 0, 1400); hz.addColorStop(0, hexA(M.haze, 0)); hz.addColorStop(0.8, hexA(M.haze, 0.3)); hz.addColorStop(1, hexA(M.haze, 0.3)); c.fillStyle = hz; c.fillRect(0, 600, W, H - 600);
  // 光柱＋光尘
  const light = 1 - clamp((calm - 0.3) / 0.4);   // calm>0.7 光完全关
  if (o.beams !== false && M.ba > 0 && light > 0) { c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = M.ba * light * (0.75 + 0.25 * Math.sin(t * 3.4)); c.drawImage(beamTex(mood), 0, 0); c.restore(); }
  if (o.dust !== false && light > 0.2) { c.save(); c.globalCompositeOperation = 'screen';
    P.particles(mood === 'night' ? 40 : 60, 91, t * 0.5, { x0: 100, x1: 1000, y0: 1350, y1: 150, speed: 30, drift: 30, life: 8 }).forEach((m, i) => { const tw = (0.5 + 0.5 * Math.sin(t * 6 + i * 1.3)) * light, rr = 2 + m.s * 3.5;
      const g2 = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr * 2.5); g2.addColorStop(0, `rgba(255,250,230,${0.85 * tw})`); g2.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = g2; c.beginPath(); c.arc(m.x, m.y, rr * 2.5, 0, TAU); c.fill(); });
    c.restore(); }
  // 主光斑（左上；黄昏在左低处；夜晚是月）
  if (o.sun !== false && M.ba >= 0) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - calm * 0.85;
    if (mood === 'night') { const mg = c.createRadialGradient(...S, 0, ...S, 170); mg.addColorStop(0, 'rgba(210,225,255,.55)'); mg.addColorStop(1, 'rgba(120,150,255,0)'); c.fillStyle = mg; c.beginPath(); c.arc(...S, 170, 0, TAU); c.fill(); }
    else if (mood !== 'overcast') {
      const warm = mood === 'dusk', sg2 = c.createRadialGradient(...S, 0, ...S, 150); sg2.addColorStop(0, 'rgba(255,255,250,.95)'); sg2.addColorStop(0.2, warm ? 'rgba(255,225,170,.6)' : 'rgba(255,248,220,.55)'); sg2.addColorStop(1, warm ? 'rgba(255,150,100,0)' : 'rgba(255,230,180,0)');
      c.fillStyle = sg2; c.beginPath(); c.arc(...S, 150, 0, TAU); c.fill();
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t * 0.25, Ln = (k % 2 ? 100 : 190) * (0.9 + 0.1 * Math.sin(t * 5 + k)); c.strokeStyle = 'rgba(255,250,235,.28)'; c.lineWidth = 3; c.beginPath(); c.moveTo(...S); c.lineTo(S[0] + Math.cos(a) * Ln, S[1] + Math.sin(a) * Ln); c.stroke(); }
      [[0.45, 34, '255,200,120', 0.1], [0.8, 20, '255,170,120', 0.12], [1.2, 58, '140,190,255', 0.07], [1.6, 26, '255,160,220', 0.09]].forEach(([k, r, col, a]) => { const x = S[0] + (540 - S[0]) * k, y = S[1] + (900 - S[1]) * k; c.fillStyle = `rgba(${col},${a})`; c.beginPath(); for (let i = 0; i < 6; i++) { const aa = i / 6 * TAU + 0.3; i ? c.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r) : c.moveTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); } c.fill(); }); }
    else { const og = c.createRadialGradient(...S, 0, ...S, 280); og.addColorStop(0, 'rgba(255,255,255,.3)'); og.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = og; c.beginPath(); c.arc(...S, 280, 0, TAU); c.fill(); }
    c.restore();
    if (mood === 'night') { c.save(); c.clip(K.circle(S[0], S[1], 64)); const mp = new Path2D(); mp.rect(-100, -100, W + 200, H + 200); mp.addPath(K.circle(S[0] + 34, S[1] - 14, 58)); c.clip(mp, 'evenodd');   // 月牙＝大圆减偏移圆
      c.fillStyle = '#EEF3FF'; c.fillRect(0, 0, W, 600); c.restore(); }
  }
  if (o.bloom !== false && calm < 0.7) P.bloom(c, { key: 'shkBloom', alpha: 0.28 * (1 - calm) });
  // 冷暖分离
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 1 - calm * 0.6; const tg = c.createLinearGradient(0, 0, W, H); tg.addColorStop(0, M.tint[0]); tg.addColorStop(1, M.tint[1]); c.fillStyle = tg; c.fillRect(0, 0, W, H); c.restore();
  if (calm > 0) { c.fillStyle = hexA(M.haze, calm * 0.32); c.fillRect(0, 0, W, H); c.fillStyle = `rgba(150,165,195,${calm * 0.3})`; c.fillRect(0, 0, W, H); }   // 降对比：罩一层灰蓝雾
  if (dim > 0) { c.fillStyle = `rgba(8,14,44,${dim * 0.7})`; c.fillRect(0, 0, W, H); }
};

// 暗靛蓝数据舞台（下半屏）：从云间渐变成深靛蓝，白字大数字放这里。o: { y0=720, alpha=1, grid=true }
K.stage = (c, o = {}) => { const { y0 = 720, alpha = 1, grid = true } = o;
  c.save(); c.globalAlpha = alpha;
  const g = c.createLinearGradient(0, y0, 0, H); g.addColorStop(0, 'rgba(22,32,92,0)'); g.addColorStop(0.2, 'rgba(24,36,104,.82)'); g.addColorStop(0.55, 'rgba(15,24,72,.95)'); g.addColorStop(1, 'rgba(10,16,52,.98)');
  c.fillStyle = g; c.fillRect(0, y0, W, H - y0);
  if (grid) { c.strokeStyle = 'rgba(160,185,255,.10)'; c.lineWidth = 2; for (let y = y0 + 220; y < 1360; y += 130) { c.beginPath(); c.moveTo(60, y); c.lineTo(W - 60, y); c.stroke(); }
    const r = U.rng(5); c.fillStyle = 'rgba(200,215,255,.5)'; for (let i = 0; i < 26; i++) c.fillRect(r() * W, y0 + 200 + r() * 600, 3, 3); }
  c.restore(); };

// =====================================================================================================
// 收尾：压暗字幕带（y1350–1620）并保留字幕可读，加轻暗角。每镜最后调用。
// =====================================================================================================
K.finish = c => {
  const v = c.createRadialGradient(W / 2, H * 0.42, 700, W / 2, H * 0.42, 1350); v.addColorStop(0, 'rgba(10,20,60,0)'); v.addColorStop(1, 'rgba(10,20,60,.22)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const dg = c.createLinearGradient(0, 1330, 0, 1640); dg.addColorStop(0, 'rgba(18,38,92,0)'); dg.addColorStop(0.5, 'rgba(18,38,92,.55)'); dg.addColorStop(1, 'rgba(14,28,72,.8)'); c.fillStyle = dg; c.fillRect(0, 1330, W, H - 1330);
};

// =====================================================================================================
// 文字（程序渲染，PuHui-Black/Heavy/Bold）。浅色字默认带靛蓝软影，深色字（上纸面）不带。
// o: { size, fam, col, align, alpha, scale, track, maxW, rot, shadow, stroke }
// =====================================================================================================
K.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.white, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, stroke = 0 } = o;
  const shadow = o.shadow ?? lum(col) > 0.6;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (shadow) { c.shadowColor = 'rgba(12,24,80,.55)'; c.shadowBlur = 14; c.shadowOffsetY = 5; }
  if (stroke) { c.strokeStyle = o.strokeCol || C.indigo; c.lineWidth = stroke; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
K.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标签牌（胶囊）：默认靛蓝底白字；fill 可传 'face'|'coupon'|'term' 语义色或 hex。底下一块硬影子，不用模糊。返回宽度
K.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', scale = 1, alpha = 1, rot = 0, padX = 0.7, align = 'center' } = o, fill = semCol(o.fill || C.indigo), col = o.col || C.white;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.6, r = h / 2, ox = align === 'left' ? 0 : align === 'right' ? -w : -w / 2;
  c.fillStyle = 'rgba(10,20,70,.28)'; c.fill(K.round(ox, -h / 2 + 8, w, h, r)); c.fillStyle = fill; c.fill(K.round(ox, -h / 2, w, h, r));
  c.save(); c.clip(K.round(ox, -h / 2, w, h, r)); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(ox, -h / 2, w, h * 0.34); c.restore();   // 上缘一条受光高光
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, ox + w / 2, 3); c.restore(); return w; };
K.popText = (c, s, x, y, lt, at, o = {}) => { const p = K.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) K.tag(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); else K.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：白细线＋圆点先画出来，末端标签牌逐字打出
K.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const p1 = MO.cubicOut(K.at(lt, at, 0.35)); if (p1 <= 0) return; const lc = o.line || C.white;
  c.save(); c.strokeStyle = lc; c.lineWidth = 5; c.lineCap = 'round'; c.shadowColor = 'rgba(12,24,80,.5)'; c.shadowBlur = 8; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = lc; c.beginPath(); c.arc(ax, ay, 10 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = K.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, K.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${o.size || 52}px "PuHui-Heavy"`; const full = c.measureText(s).width + (o.size || 52) * 1.4; c.restore();
  K.tag(c, shown, bx - full / 2 + (o.size || 52) * 0.7, by, { size: o.size || 52, fill: o.fill, col: o.col, scale: q, align: 'left', padX: 0.7 }); };

// 小件：箭头（p 0..1 画出进度）、圆章、金币
K.arrow = (c, x0, y0, x1, y1, o = {}) => { const { col = C.white, lw = 12, p = 1, head = 38, alpha = 1 } = o, q = clamp(p); if (q <= 0) return;
  const ex = lerp(x0, x1, q), ey = lerp(y0, y1, q), a = Math.atan2(y1 - y0, x1 - x0);
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = semCol(col); c.fillStyle = semCol(col); c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = 'rgba(12,24,80,.45)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex - Math.cos(a) * head * 0.5, ey - Math.sin(a) * head * 0.5); c.stroke();
  if (q > 0.15) { c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a - 0.45) * head, ey - Math.sin(a - 0.45) * head); c.lineTo(ex - Math.cos(a + 0.45) * head, ey - Math.sin(a + 0.45) * head); c.closePath(); c.fill(); }
  c.restore(); };
// 圆章（红）：双圈＋字（1–2 字一行，3–4 字两行）；lt>=at 时砸下
K.stamp = (c, s, x, y, lt, at, o = {}) => { if (lt < at) return; const { r = 62, rot = -0.2, col = '#C23A2E', alpha = 0.92 } = o, k = MO.slamK((lt - at) / 0.17), a = [...s];
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.globalAlpha *= alpha; c.strokeStyle = col; c.lineWidth = r * 0.1; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.lineWidth = r * 0.035; c.beginPath(); c.arc(0, 0, r * 0.82, 0, TAU); c.stroke();
  const lines = a.length > 2 ? [a.slice(0, Math.ceil(a.length / 2)).join(''), a.slice(Math.ceil(a.length / 2)).join('')] : [s], fs = lines.length > 1 ? r * 0.62 : (a.length === 1 ? r * 1.0 : r * 0.78);
  c.fillStyle = col; c.font = `${fs}px "PuHui-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach((ln, i) => c.fillText(ln, 0, (i - (lines.length - 1) / 2) * fs * 1.05 + 3));
  c.globalCompositeOperation = 'destination-out'; const rr = U.rng(s.length * 31 + 5); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${0.3 + rr() * 0.5})`; c.fillRect((rr() - 0.5) * r * 2, (rr() - 0.5) * r * 2, 2 + rr() * 5, 2 + rr() * 3); }   // 印泥斑驳
  c.restore(); };
// 金币：赛璐珞两调；flip 0..1 绕竖轴翻；label 是币面一个字（如「金」）
K.coin = (c, x, y, r, o = {}) => { const { flip = 0, rot = 0, label = '', alpha = 1, glint = 0 } = o, sx = Math.max(0.05, Math.abs(Math.cos(flip * Math.PI)));
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(sx, 1);
  const p = K.circle(0, 0, r); K.cel(c, p, C.gold, C.goldDk, C.goldLt, { sd: r * 0.2, rw: r * 0.08, line: '#7A5412', lw: Math.max(3, r * 0.04) });
  c.lineWidth = Math.max(3, r * 0.04); c.strokeStyle = '#8A5E16'; c.beginPath(); c.arc(0, 0, r * 0.76, 0, TAU); c.stroke();
  if (label) { c.fillStyle = '#8A5E16'; c.font = `${r * 0.9}px "PuHui-Black"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, r * 0.04); }
  if (glint > 0) { c.save(); c.clip(p); c.globalAlpha *= glint; c.fillStyle = 'rgba(255,255,255,.6)'; c.rotate(-0.8); c.fillRect(-r * 1.2, -r * 0.12 + (1 - glint) * r * 0.4, r * 2.4, r * 0.22); c.restore(); }
  c.restore(); };

// =====================================================================================================
// 纸：欠条 / 图表卡的纸张。K.paper(c, x, y, w, h, { rot, scale, alpha, tint:'cream'|'warm'|'cool'|'faded', frame:true, seed, shadow:true, draw(c,w,h) })
// (x,y) 是纸中心；draw 在纸中心为原点的局部坐标里画内容（已 clip 到纸内）。纸边是手抖的小曲线，不是矩形。
// =====================================================================================================
const TINTS = { cream: [C.paper, C.paper2, '#FFFFFF'], warm: ['#FFF0D8', '#E8C898', '#FFFFFF'], cool: ['#EEF3FF', '#B9C6E6', '#FFFFFF'], faded: ['#E8E2D0', '#C8BEA4', '#F4F0E4'] };
const paperPath = (w, h, seed = 1) => { const j = i => (U.hash(i, seed) - 0.5) * 2, x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, p = new Path2D(), e = Math.min(w, h) * 0.014;
  p.moveTo(x0, y0); p.bezierCurveTo(x0 + w * 0.3, y0 - e * (1 + j(1)), x0 + w * 0.65, y0 + e * (1 + j(2)), x1, y0 - e * 0.4);
  p.bezierCurveTo(x1 + e * (1 + j(3)), y0 + h * 0.3, x1 - e * (1 + j(4)), y0 + h * 0.7, x1 + e * 0.5, y1);
  p.bezierCurveTo(x0 + w * 0.65, y1 + e * (1 + j(5)), x0 + w * 0.3, y1 - e * (1 + j(6)), x0 + e * 0.5, y1 + e * 0.4);
  p.bezierCurveTo(x0 - e * (1 + j(7)), y0 + h * 0.7, x0 + e * (1 + j(8)), y0 + h * 0.3, x0, y0); p.closePath(); return p; };
K.paper = (c, x, y, w, h, o = {}) => { const { rot = 0, scale = 1, alpha = 1, tint = 'cream', frame = true, seed = 1, shadow = true } = o, [b, s, r] = TINTS[tint] || TINTS.cream, p = paperPath(w, h, seed);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  if (shadow) { c.save(); c.shadowColor = 'rgba(30,50,110,.4)'; c.shadowBlur = 44; c.shadowOffsetX = 16; c.shadowOffsetY = 26; c.fillStyle = b; c.fill(p); c.restore(); }
  K.cel(c, p, b, s, r, { sd: Math.min(34, w * 0.05), rw: 8, line: '#8A7248', lw: 2.4 });
  c.save(); c.clip(p);
  const wg = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); wg.addColorStop(0, 'rgba(255,230,180,.35)'); wg.addColorStop(0.5, 'rgba(255,255,255,0)'); wg.addColorStop(1, 'rgba(90,110,190,.25)'); c.fillStyle = wg; c.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
  if (frame) { const m = Math.min(w, h) * 0.065; c.strokeStyle = o.frameCol || C.edge; c.lineWidth = 4; c.strokeRect(-w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m); c.lineWidth = 1.5; c.strokeRect(-w / 2 + m + 12, -h / 2 + m + 12, w - 2 * m - 24, h - 2 * m - 24); }
  if (o.draw) o.draw(c, w, h);
  c.restore(); c.restore(); };
// 欠条：「债券」＋面值/票息/到期三行（三色语义）；o: { rows:[[标签,值,'face'|'coupon'|'term'|hex],…], title, stamp:{s,at,lt}, rot, scale, alpha, tint, seed }
K.iou = (c, x, y, w, h, o = {}) => { const rows = o.rows || [['面值', '1000', 'face'], ['票息', '5%', 'coupon'], ['到期', '10年', 'term']], title = o.title ?? '债券', k = Math.min(w / 660, h / 820), n = rows.length;
  K.paper(c, x, y, w, h, { ...o, draw: (g, w, h) => {
    if (title) { K.text(g, title, 0, -h / 2 + 0.145 * h, { size: 108 * k, col: C.navy, shadow: false, maxW: w * 0.7 }); g.strokeStyle = 'rgba(60,70,110,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-w * 0.38, -h / 2 + 0.22 * h); g.lineTo(w * 0.38, -h / 2 + 0.22 * h); g.stroke(); }
    const top = -h / 2 + (title ? 0.33 : 0.16) * h, step = Math.min(130 * k, (h * (title ? 0.58 : 0.72)) / n);
    rows.forEach(([a, b, col], i) => { const yy = top + i * step; g.fillStyle = 'rgba(42,56,102,.08)'; g.fillRect(-w * 0.385, yy - step * 0.4, w * 0.77, step * 0.8);
      K.text(g, a, -w * 0.31, yy, { size: Math.max(52, 60 * k), col: C.label, shadow: false, align: 'left' }); K.text(g, b, w * 0.34, yy, { size: Math.max(60, (b.length > 3 ? 96 : 104) * k), col: semCol(col), shadow: false, align: 'right', maxW: w * 0.45 });
      g.strokeStyle = 'rgba(100,90,60,.35)'; g.setLineDash([2, 9]); g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-w * 0.385, yy + step * 0.5); g.lineTo(w * 0.385, yy + step * 0.5); g.stroke(); g.setLineDash([]); });
    if (o.stamp) K.stamp(g, o.stamp.s || '债券', w * 0.17, h * 0.36, o.stamp.lt ?? 99, o.stamp.at ?? 0, { r: 58 * k + 8, rot: -0.2 }); } }); };

// 图表卡：纸质图表卡，最多两条线/两组柱，三色语义，带「示意」角标。
// o: { title, series:[{ vals:[…], col:'face'|'coupon'|'term'|hex, kind:'line'|'bar', name }], xLabels:[…], ymin, ymax, p:0..1 画出进度, marks:[{ s:序列, i:点序号, text, col }], rot, scale, alpha, demo:true, seed }
K.chartCard = (c, x, y, w, h, o = {}) => { const ser = (o.series || []).slice(0, 2), p = clamp(o.p ?? 1), marks = (o.marks || []).slice(0, 3);
  K.paper(c, x, y, w, h, { ...o, tint: o.tint || 'cream', draw: (g, w, h) => {
    const L = -w / 2 + 130, R = w / 2 - 130, T = -h / 2 + (o.title ? 190 : 120), B = h / 2 - (o.xLabels ? 190 : 120), all = ser.flatMap(s => s.vals), nPts = Math.max(...ser.map(s => s.vals.length), 2);
    let lo = o.ymin ?? Math.min(...all), hi = o.ymax ?? Math.max(...all); if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.12; if (o.ymin == null) lo -= pad; if (o.ymax == null) hi += pad;
    const isBar = ser.some(s => s.kind === 'bar'), X = i => isBar ? L + (R - L) * (i + 0.5) / nPts : L + (R - L) * (nPts > 1 ? i / (nPts - 1) : 0.5), Y = v => lerp(B, T, (v - lo) / (hi - lo));
    if (o.title) K.text(g, o.title, -w / 2 + 100, -h / 2 + 110, { size: 56, col: C.label, shadow: false, align: 'left', maxW: w - 380 });
    if (o.demo !== false) { g.save(); g.translate(w / 2 - 150, -h / 2 + 112); g.rotate(0.05); g.strokeStyle = C.edge; g.lineWidth = 4; g.stroke(K.round(-62, -34, 124, 68, 16)); K.text(g, '示意', 0, 3, { size: 44, col: C.edge, shadow: false }); g.restore(); }
    g.strokeStyle = 'rgba(90,100,133,.2)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const yy = lerp(T, B, i / 3); g.beginPath(); g.moveTo(L, yy); g.lineTo(R, yy); g.stroke(); }   // 极淡网格，不标刻度数字
    g.strokeStyle = C.label; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(L, T - 20); g.lineTo(L, B); g.lineTo(R + 10, B); g.stroke();
    if (o.xLabels) o.xLabels.forEach((s, i) => K.text(g, s, X(isBar ? i : i * (nPts - 1) / Math.max(1, o.xLabels.length - 1)), B + 62, { size: 48, col: C.label, shadow: false, maxW: (R - L) / o.xLabels.length }));
    ser.forEach((s, si) => { const col = semCol(s.col), n = s.vals.length;
      if (s.kind === 'bar') { const bw = (R - L) / n * (ser.length > 1 ? 0.34 : 0.56), off = ser.length > 1 ? (si - 0.5) * bw * 1.1 : 0;
        s.vals.forEach((v, i) => { const q = MO.cubicOut(clamp(p * 1.3 - i / n * 0.3)), x0 = X(i) + off - bw / 2, hh = (B - Y(v)) * q; const bp = K.round(x0, B - hh, bw, Math.max(0, hh), 10); K.cel(g, bp, col, hexA('#0A1448', 0.35), 'rgba(255,255,255,.35)', { sd: 14, rw: 6, line: 'rgba(0,0,0,0)', lw: 0 }); }); }
      else { const pts = s.vals.map((v, i) => [X(i), Y(v)]), tot = p * (n - 1), full = Math.floor(tot), fr = tot - full;
        const pl = [...pts.slice(0, Math.min(full + 1, n))]; if (full < n - 1) pl.push([lerp(pts[full][0], pts[full + 1][0], fr), lerp(pts[full][1], pts[full + 1][1], fr)]);
        if (pl.length > 1) { g.save(); g.lineJoin = 'round'; g.beginPath(); pl.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.strokeStyle = hexA(col, 0.25); g.lineWidth = 26; g.stroke(); g.strokeStyle = col; g.lineWidth = 11; g.stroke(); g.restore(); }
        pl.forEach(([a, b], i) => { if (i === pl.length - 1 && p < 1) { g.fillStyle = col; g.beginPath(); g.arc(a, b, 14, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); } }); }
      if (s.name && p > 0.95) K.tag(g, s.name, s.kind === 'bar' ? L + 30 : X(n - 1) - 20, s.kind === 'bar' ? T + 10 + si * 90 : Y(s.vals[n - 1]) + (ser.length > 1 && ser.every(q => q.kind !== 'bar') && Math.abs(Y(ser[0].vals[ser[0].vals.length - 1]) - Y(ser[1].vals[ser[1].vals.length - 1])) < 170 && Y(s.vals[n - 1]) > Y(ser[1 - si].vals[ser[1 - si].vals.length - 1]) ? 78 : -78), { size: 44, fill: col, align: s.kind === 'bar' ? 'left' : 'right', padX: 0.55 }); });
    marks.forEach((m, mi) => { const s = ser[m.s || 0]; if (!s) return; const i = Math.min(m.i, s.vals.length - 1), mx = X(i), my = Y(s.vals[i]), q = K.pop(p, (i / Math.max(1, s.vals.length - 1)) - 0.02, 0.2); if (q <= 0) return;
      const col = semCol(m.col || s.col); g.save(); g.translate(mx, my); g.scale(q, q); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.restore();
      if (m.text) K.tag(g, m.text, clamp(mx, L + 90, R - 90), my + (m.dy ?? -86), { size: 52, fill: col, scale: q }); });
  } }); };

// =====================================================================================================
// 手：赛璐珞递东西的手（袖口＋手背＋四指＋拇指压在纸面）。局部原点＝指尖捏住纸右缘的位置，纸画在原点左侧；手臂从右下伸来。
// K.hand(c, x, y, { rot, scale, alpha, flip, hold(c) })：hold 在手指和拇指之间被调用（坐标＝局部，纸中心放 (-w/2+22, -30)）。
// K.give(c, x, y, w, h, { …K.iou 的参数, bob })：一手递欠条的整套（x,y 是纸中心），整体轻轻浮动。
// =====================================================================================================
// 自带 cel：引擎 P.cel 的 clip 大矩形只覆盖画布坐标正象限，在局部坐标（纸/手以中心为原点）里会切出方块阴影，所以这里用超大矩形
const BIGR = new Path2D(); BIGR.rect(-6000, -6000, 12000, 12000);
const clipBeside = (c, p, dx, dy) => { const m = new Path2D(); m.addPath(BIGR); m.addPath(p, new DOMMatrix().translate(dx, dy)); c.clip(p); c.clip(m, 'evenodd'); };
K.cel = (c, p, base, shade, rim, { sd = 22, rw = 7, line = '#6a4632', lw = 2.2, lx = -1, ly = -0.55 } = {}) => {
  c.fillStyle = base; c.fill(p);
  if (shade) { c.save(); clipBeside(c, p, lx * sd, ly * sd); c.fillStyle = shade; c.fill(p); c.restore(); }
  if (rim) { c.save(); clipBeside(c, p, -lx * rw, -ly * rw); c.fillStyle = rim; c.fill(p); c.restore(); }
  if (lw) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(p); } };
const SKIN = ['#FFE2D2', '#E9A99A', '#FFF3E6'], NAVY = ['#34457A', '#1B2446', '#8FA6E0'];
const cap = (a, b, wa, wb) => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), p = new Path2D(), N = 14;
  for (let k = 0; k <= N; k++) { const q = ang - Math.PI / 2 + k / N * Math.PI; k ? p.lineTo(b[0] + Math.cos(q) * wb / 2, b[1] + Math.sin(q) * wb / 2) : p.moveTo(b[0] + Math.cos(q) * wb / 2, b[1] + Math.sin(q) * wb / 2); }
  for (let k = 0; k <= N; k++) { const q = ang + Math.PI / 2 + k / N * Math.PI; p.lineTo(a[0] + Math.cos(q) * wa / 2, a[1] + Math.sin(q) * wa / 2); }
  p.closePath(); return p; };
const cel = (c, p, col, o) => K.cel(c, p, col[0], col[1], col[2], o);
K.hand = (c, x, y, o = {}) => { const { rot = 0, scale = 1, alpha = 1, flip = false } = o, sh = ([a, b]) => [a - 830, b - 980];
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(flip ? -scale : scale, scale);
  c.save(); c.shadowColor = 'rgba(20,40,100,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 18; cel(c, cap(sh([1260, 1480]), sh([1040, 1190]), 230, 200), NAVY, { sd: 30, rw: 8, line: '#1B2446' }); c.restore();   // 袖子
  cel(c, cap(sh([1040, 1190]), sh([985, 1118]), 205, 176), ['#F4F6FF', '#B9C3DC', '#FFFFFF'], { sd: 18, rw: 6, line: '#7886B0' });   // 袖口
  cel(c, cap(sh([985, 1090]), sh([915, 1010]), 130, 150), SKIN, { sd: 22, rw: 7 });   // 手背
  for (let i = 0; i < 4; i++) cel(c, cap(sh([915, 985 + i * 34]), sh([800, 960 + i * 42]), 50, 46), SKIN, { sd: 10, rw: 4 });   // 四指（伸到纸后）
  if (o.hold) o.hold(c);
  cel(c, cap(sh([950, 985]), sh([770, 905]), 74, 54), SKIN, { sd: 14, rw: 5 });   // 拇指压在纸面
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(...sh([778, 898]), 14, 9, 0.4, 0, TAU); c.fill();
  c.restore(); };
K.give = (c, x, y, w, h, o = {}) => { const t = o.t ?? 0, bob = (o.bob ?? 1) * Math.sin(t * 1.6) * 8, rot = (o.rot ?? -0.07) + Math.sin(t * 1.1) * 0.012 * (o.bob ?? 1);
  c.save(); c.translate(x, y + bob); c.rotate(rot); c.scale(o.scale ?? 1, o.scale ?? 1); c.globalAlpha *= o.alpha ?? 1;
  K.hand(c, w / 2 - 30, 30, { hold: g => K.iou(g, -w / 2 + 22, -30, w, h, { ...o, rot: 0, scale: 1, alpha: 1 }) }); c.restore(); };

// =====================================================================================================
// 底：K.bg(c, t, o) = K.sky（章节里要整片背景时用）；o 同 K.sky。占位：K.bg(c, t, {})
// =====================================================================================================
K.bg = (c, t, o = {}) => K.sky(c, t, o);

// 字幕（assemble 生成的 subs.js 调它）：靛蓝底板＋白字，字幕带 y≈1480
K.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(8,14,50,.3)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2 + 7, w, h, 24); c.fill();
  c.fillStyle = 'rgba(22,34,96,.92)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.strokeStyle = 'rgba(190,210,255,.35)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 19); c.stroke();
  c.fillStyle = '#FFFFFF'; c.fillText(text, x, y + 2, 1000); c.restore();
};

// =====================================================================================================
// 章节卡：天色按章轮换（K.CARD_MOODS）；一张欠条纸从下方浮入，上面「第 N 章」＋章名（逐字出，≥100px）；下方 N 站进度轨，当前站亮起并有光环。
// 换书可改 K.cardToken = (c, x, y, lt, t) => {…}（站点上方的小件，默认一张缩小的欠条）。
// =====================================================================================================
K.CARD_MOODS = K.CARD_MOODS || ['day', 'dusk', 'cloudsea', 'overcast', 'night'];
K.cardToken = K.cardToken || ((c, x, y, lt, t) => K.iou(c, x, y, 110, 140, { rows: [['', '', 'face'], ['', '', 'coupon'], ['', '', 'term']], title: '', rot: Math.sin(t * 1.6) * 0.06, shadow: false, frame: false }));
K.chapterCard = (c, lt, t, n, title = '') => {
  K.sky(c, t, { mood: K.CARD_MOODS[(n - 1) % K.CARD_MOODS.length], calm: 0.1 });
  const N = Math.max(K.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, ty = 1230, X = i => lerp(x0, x1, i / (N - 1));
  const rise = MO.cubicOut(K.at(lt, 0, 0.7)), pw = 900, ph = 680, py = 700 + (1 - rise) * 260;
  K.paper(c, W / 2, py, pw, ph, { rot: -0.018 + Math.sin(t * 1.1) * 0.006, alpha: clamp(rise * 2), seed: n + 3, draw: (g, w, h) => {
    const s = lt > 0.15 ? MO.slamK((lt - 0.15) / 0.17) : 0;
    if (s) K.text(g, `第 ${n} 章`, 0, -h / 2 + 130, { size: 76, col: C.edge, shadow: false, scale: s });
    g.strokeStyle = 'rgba(60,70,110,.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-w * 0.36, -h / 2 + 200); g.lineTo(w * 0.36, -h / 2 + 200); g.stroke();
    const lines = K.split2(title), all = lines.reduce((a, l) => a + [...l].length, 0), shown = Math.round(K.at(lt, 0.5, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 104 : all > 7 ? 112 : 132;
    let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
      if (k > 0) K.text(g, a.slice(0, k).join(''), 0, (lines.length > 1 ? 20 : 50) + i * size * 1.22, { size, col: C.navy, shadow: false, maxW: w - 230 }); }); } });
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(K.round(x0 - 30, ty - 6, x1 - x0 + 60, 12, 6));
  const q = MO.cubicInOut(K.at(lt, 0.3, 0.9)); c.fillStyle = C.gold; c.fill(K.round(x0 - 30, ty - 6, Math.max(12, lerp(n > 1 ? X(n - 2) : x0 - 30, X(n - 1), q) - x0 + 30), 12, 6));
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? K.pop(lt, 1.1, 0.45) : 1;
    c.fillStyle = past ? C.gold : cur ? '#FFFFFF' : 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(X(i), ty, cur ? 22 * Math.max(0.6, pp) : 12, 0, TAU); c.fill(); }
  if (lt > 1.1) { const g = c.createRadialGradient(X(n - 1), ty, 0, X(n - 1), ty, 70); g.addColorStop(0, 'rgba(255,240,190,.8)'); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.beginPath(); c.arc(X(n - 1), ty, 70, 0, TAU); c.fill(); }
  K.cardToken(c, lerp(n > 1 ? X(n - 2) : x0 - 60, X(n - 1), q), ty - 110 + Math.sin(t * 2) * 6, lt, t);
  K.finish(c);
};
})();
