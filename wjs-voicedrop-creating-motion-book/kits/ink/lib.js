// 画风套件 ink（配方 huashu-art-motion 17_ink「中国水墨写意」，来自《一夜两份财报》）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：宣纸底（米色、纤维、暗角）上，墨分五色（焦/浓/重/淡/清），一切形体用「连续毛笔」K.brush（每根笔毛一条连续折线＋尖收，绝不拼矩形小段）
//       和「洇开的晕染」K.wash/K.blob 画；留白就是纸；朱砂红只给「涨」与钤印，花青只给「跌」，其余全是墨。
//       数据图示意级：墨柱 K.bars、墨线 K.line、天平 K.scale、铜钱 K.coin、箭 K.arrow；人只出无脸写意背影 K.figure 与手 K.hand。
// 版面：主体 y200–1350；字幕带 y1380–1560（K.finish 压墨雾、K.subtitle 画字幕）；y>1574 只放淡墨远山，不放内容。
// 数字一律走 K.num / K.fmt（符号手写成毛笔笔画，百分号、单位统一）。字体：Songti-Black / Songti-Regular（思源宋体 GB2312 子集，随套件分发）。
// 确定性：所有随机走 U.hash / U.rng / P.noise 种子。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
const ss = (a, b, x) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
// 兜底：backOut 回弹起步会让半径为负，canvas 遇负半径直接抛错。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function' || arc.__ink) continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); }; proto.arc.__ink = 1;
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}

// ---------- 色板 ----------
// 涨＝朱砂 up，跌＝花青 down（中国习惯涨红跌青）。墨五色用透明度（tone）分，不另设灰。
const C = D.C = {
  paper: '#EFE6D0', paper2: '#E4D8BC', ink: '#16120F', inkMid: '#4A4640', inkLight: '#8C877C',
  cinnabar: '#C4281E', sun: '#D8553F', cyan: '#3F5F78', cyanL: '#6F8AA0', ochre: '#C47A3C', gold: '#C9A24A',
  night: '#12161A', night2: '#1B2127',
  up: '#C4281E', down: '#3F5F78', red: '#C4281E', dark: '#16120F', cream: '#EFE6D0',
};
D.dark = false;                                           // K.bg 写入：本镜是否深底（text/num 默认色据此反白）
D.fg = () => D.dark ? '#EFE6D0' : C.ink;
D.up = () => D.dark ? '#E4503F' : C.up;
D.down = () => D.dark ? '#7FA6C4' : C.down;
D.tone = dir => dir === 'up' ? D.up() : dir === 'down' ? D.down() : D.fg();
const hex = h => Array.isArray(h) ? h : P.hex(h);

// ---------- 进度 / 缓存 / 相机 ----------
D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.2); };
D.ease = x => ss(0, 1, x);
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('K.t0: 段落表里没有 ' + id); return e.t0; };
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
D.rng = seed => U.rng(seed);
D.SAFE = { top: 200, bot: 1350, sub: 1480 };

// ---------- 毛笔 ----------
// K.brush(c, pts, {w, tone, dry, reveal, seed, col, head, tail, tailK, bristles, light})
// pts 控制点（Catmull-Rom 加密，4px 等弧长重采样）；w 最大宽；tone 墨浓（焦.9 浓.8 重.6 淡.35 清.15）；dry 飞白 0..1（越近笔尾越干）；reveal 0..1 写出比例；
// head/tail 起收笔占比；tailK 收笔缩细程度（默认 .7，画柱子用 .1）；col 'hex' 或 [r,g,b]；light:true 深底用（不 multiply）。
// 做法：湿笔芯＝一整条变宽带；笔毛＝每根一条连续折线，飞白处宽度平滑收到 0（两端是尖的，不是矩形断片）。
// 坑：不要每小段单独 stroke 或用 butt 矩形拼接——接缝会出现一节节方块断片，这是评审指出过的。
D.brush = (c, pts, o = {}) => {
  const { w = 10, tone = 0.85, dry = 0.45, seed = 1, reveal = 1, head = 0.1, tail = 0.4, tailK = 0.7, light = false } = o;
  if (reveal <= 0 || !pts || pts.length < 2) return;
  const col = hex(o.col || [16, 14, 12]);
  let Dn = KIT.resample(KIT.densify(pts, 5), 4); if (Dn.length < 3) Dn = [Dn[0], [(Dn[0][0] + Dn[Dn.length - 1][0]) / 2 + 0.01, (Dn[0][1] + Dn[Dn.length - 1][1]) / 2], Dn[Dn.length - 1]];
  const n = Dn.length, m = Math.max(3, Math.min(n, Math.ceil(n * clamp(reveal))));
  const nrm = [];
  for (let i = 0; i < n; i++) { const A = Dn[Math.max(0, i - 1)], B = Dn[Math.min(n - 1, i + 1)]; let dx = B[0] - A[0], dy = B[1] - A[1]; const d = Math.hypot(dx, dy) || 1; nrm.push([-dy / d, dx / d]); }
  // 笔迹微抖：中心线沿法线偏一点点（手的不稳）
  const Cn = Dn.map((p, i) => { const s = (P.noise(seed * 1.7, i * 0.045) * 0.5) * w * 0.07; return [p[0] + nrm[i][0] * s, p[1] + nrm[i][1] * s]; });
  const prof = q => (ss(0, head, q) * (1 - tailK * ss(1 - tail, 1, q)) * (1 - lerp(0.12, 0.035, clamp(w / 100)) * (0.5 - 0.5 * P.noise(seed * 3.3, q * 6)) * 2) + 0.06);
  const core = q => w * prof(q) * (1 - dry * 0.7 * Math.pow(q, 0.9));
  const nb = o.bristles || clamp(Math.round(w / 5), 5, 24), r = U.rng(seed * 7919 + 11);
  c.save(); c.globalCompositeOperation = light ? 'source-over' : 'multiply'; c.lineJoin = 'round';
  const rgb = a => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
  // 湿笔芯
  c.fillStyle = rgb(tone * (0.55 + 0.3 * clamp(w / 120))); c.fill(KIT.ribbon(Cn.slice(0, m), (q, i) => core(i / (n - 1))));
  if (m < n) { const q = (m - 1) / (n - 1), p = Cn[m - 1]; c.beginPath(); c.arc(p[0], p[1], core(q) / 2, 0, TAU); c.fill(); }     // 写出中的笔头圆润，不留平口
  // 笔毛
  for (let k = 0; k < nb; k++) {
    const off = (k / (nb - 1) - 0.5) * 0.92, bw = Math.max(1.2, w / nb * (1.0 + r() * 0.9)), ph = r() * 50, al = tone * lerp(0.4 + r() * 0.4, 0.3 + r() * 0.15, clamp(w / 120)), wd = new Array(m), pp = new Array(m);
    for (let i = 0; i < m; i++) {
      const q = i / (n - 1), thr = dry * Math.pow(q, 1.15) * 0.95 + 0.05, nz = P.noise(k * 1.9 + ph, i * 0.07) * 0.5 + 0.5, a = ss(thr - 0.08, thr + 0.12, nz);
      const o2 = off * w * prof(q) * (1 - dry * 0.35 * q); wd[i] = a * bw * (0.35 + 0.65 * Math.min(1, prof(q) * 1.4)); pp[i] = [Cn[i][0] + nrm[i][0] * o2, Cn[i][1] + nrm[i][1] * o2];
    }
    c.fillStyle = rgb(al);
    let s = -1;
    for (let i = 0; i <= m; i++) {
      const on = i < m && wd[i] > 0.25;
      if (on && s < 0) s = i;
      if ((!on || i === m) && s >= 0) { if (i - s >= 3) { const seg = pp.slice(s, i), ww = wd.slice(s, i); c.fill(KIT.ribbon(seg, (q, j) => ww[j])); } s = -1; }
    }
  }
  c.restore();
};
D.leaf = (c, x, y, ang, L, wmax, o = {}) => D.brush(c, [[x, y], [x + Math.cos(ang) * L * 0.5 - Math.sin(ang) * L * 0.05, y + Math.sin(ang) * L * 0.5 + Math.cos(ang) * L * 0.05], [x + Math.cos(ang) * L, y + Math.sin(ang) * L]], { w: wmax, tone: 0.85, dry: 0.2, head: 0.3, tail: 0.6, tailK: 0.9, ...o });

// ---------- 晕染 ----------
// K.wash(c, key, grow, fn(g), {blur, halo, haloA, alpha, light, box:[x,y,w,h]})：形状先画到 scratch（实色），再「外晕＋本体」两遍模糊合到纸上，grow 0→1＝洇开（之后可继续缓缓增大＝墨在纸上晕开）。
// 浅底 multiply；深底（light:true）用 screen 提亮。box 限定重绘区域（提速）。key 每处唯一。
D.wash = (c, key, grow, fn, o = {}) => {
  if (grow <= 0) return null;
  const { blur = 3, halo = 14, haloA = 0.25, alpha = 1, light = false } = o, S = P.scratch('inkk_' + key), g = S.getContext('2d'); g.reset(); fn(g);
  const bx = o.box || [0, 0, W, H], sd = (x, y, w, h) => c.drawImage(S, x, y, w, h, x, y, w, h);
  const pad = halo * 3 + blur * 3, x0 = Math.max(0, bx[0] - pad), y0 = Math.max(0, bx[1] - pad), x1 = Math.min(W, bx[0] + bx[2] + pad), y1 = Math.min(H, bx[1] + bx[3] + pad);
  c.save(); c.globalCompositeOperation = light ? 'screen' : 'multiply'; c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  c.globalAlpha = haloA * alpha * grow; c.filter = `blur(${(halo * (0.4 + grow)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
  c.globalAlpha = alpha * ss(0, 0.6, grow); c.filter = `blur(${(blur * (1.6 - grow * 0.6)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
  c.filter = 'none'; c.restore(); return S;
};
// 不规则椭圆墨团（边缘种子抖动）：K.blob(c, key, cx, cy, rx, ry, col, {grow, seed, amp, ...wash 参数})
D.blob = (c, key, cx, cy, rx, ry, col, o = {}) => {
  const { grow = 1, seed = 3, amp = 0.14 } = o, pts = D.once('blob_' + key + '_' + [cx, cy, rx, ry, seed].join(','), () => P.deform(P.ellipsePts(cx, cy, rx, ry, 14), 2, Math.min(rx, ry) * amp, U.rng(seed * 131 + 7)));
  const pad = Math.max(rx, ry) + (o.halo || 14) * 3;
  return D.wash(c, key, grow, g => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); }, { box: [cx - pad, cy - pad, pad * 2, pad * 2], ...o });
};
D.sun = (c, key, cx, cy, r, grow = 1, o = {}) => D.blob(c, key, cx, cy, r, r * 0.97, o.col || C.sun, { grow, seed: 11, halo: r * 0.22, haloA: 0.5, blur: 5, alpha: o.alpha ?? 0.85, light: o.light });
D.moon = (c, key, cx, cy, r, grow = 1) => { D.blob(c, key, cx, cy, r, r, '#E8E2CF', { grow, seed: 5, halo: r * 0.25, haloA: 0.45, blur: 4, alpha: 0.9, light: true });
  if (grow > 0.8) { c.save(); c.globalAlpha = 0.18 * grow; c.fillStyle = '#7C8590'; [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.1, 0.4, 0.12]].forEach(([a, b, s]) => { c.beginPath(); c.arc(cx + a * r, cy + b * r, s * r, 0, TAU); c.fill(); }); c.restore(); } };

// ---------- 宣纸 / 远山 / 底 ----------
D.paper = () => P.cached('ink_paper_k', W, H, g => {
  g.drawImage(P.texture('xuan_k', C.paper, { scale: 0.0025, amt: 9, grain: 7, seed: 5 }), 0, 0);
  const r = U.rng(41); g.lineCap = 'round';
  for (let i = 0; i < 3000; i++) {            // 纸纤维：短弧，亮暗混合
    const x = r() * W, y = r() * H, a = r() * TAU, l = 6 + r() * 28;
    g.strokeStyle = r() < 0.5 ? `rgba(150,125,90,${0.05 + r() * 0.08})` : `rgba(255,252,240,${0.12 + r() * 0.15})`;
    g.lineWidth = 0.6 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 5; i++) {               // 极淡的水渍／帘纹
    const gr = g.createRadialGradient(U.hash(i, 1) * W, U.hash(i, 2) * H, 20, U.hash(i, 1) * W, U.hash(i, 2) * H, 330); gr.addColorStop(0, 'rgba(160,130,80,.05)'); gr.addColorStop(1, 'rgba(160,130,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  const vg = g.createRadialGradient(W / 2, H / 2, 600, W / 2, H / 2, 1350); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(120,90,50,.26)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
});
D.paperNight = () => P.cached('ink_night_k', W, H, g => {
  g.drawImage(P.texture('night_k', C.night, { scale: 0.0022, amt: 12, grain: 6, seed: 9 }), 0, 0);
  const r = U.rng(77); g.lineCap = 'round';
  for (let i = 0; i < 1800; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 6 + r() * 22; g.strokeStyle = `rgba(200,205,210,${0.02 + r() * 0.04})`; g.lineWidth = 0.6 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const vg = g.createRadialGradient(W / 2, H * 0.45, 500, W / 2, H / 2, 1300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
});
// 远山：只在下部（y1300 以下）与顶部一点，淡墨；缓存。lightInk 给深底用
const ridge = (g, y0, amp, f, seed, x0, col, a) => {
  g.beginPath(); g.moveTo(-20, H + 20); for (let x = -20; x <= W + 20; x += 10) g.lineTo(x, y0 - amp * (0.35 + 0.65 * (P.fbm(x * f + seed, seed, 3) * 0.5 + 0.5)) - amp * 0.9 * Math.exp(-Math.pow((x - x0) / 170, 2)));
  g.lineTo(W + 20, H + 20); g.closePath(); const gr = g.createLinearGradient(0, y0 - amp * 1.6, 0, y0 + 160); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},${a * 0.25})`); g.fillStyle = gr; g.fill();
};
const mountains = (kind) => P.cached('ink_mtn_' + kind, W, H, g => {
  const dk = kind === 'night', col = dk ? '150,160,172' : '52,54,58', k = dk ? 0.9 : 1; g.filter = 'blur(7px)';
  if (kind === 'mist') { ridge(g, 1560, 150, 0.005, 1, 220, col, 0.13); ridge(g, 1680, 130, 0.007, 4, 840, col, 0.2); ridge(g, 1790, 110, 0.009, 8, 460, col, 0.3); }
  else { ridge(g, 1640, 120, 0.006, 2, 240, col, 0.12 * k + 0.02); ridge(g, 1745, 100, 0.008, 5, 850, col, 0.2 * k + 0.02); ridge(g, 1850, 80, 0.01, 9, 420, col, 0.3 * k + 0.02); }
  g.filter = 'none';
});
const mistBands = (c, t, dark) => {
  c.save(); c.filter = 'blur(26px)'; const col = dark ? 'rgba(60,70,80,.4)' : 'rgba(244,238,220,.5)';
  [[1560, 160, 0.13, 0], [1690, 140, 0.1, 2], [1810, 120, 0.16, 4]].forEach(([y, ry, sp, ph], i) => { c.fillStyle = col; c.beginPath(); c.ellipse(W / 2 + Math.sin(t * sp + ph) * 120, y, 760, ry, 0, 0, TAU); c.fill(); });
  c.restore();
};
// K.bg(c, t, {kind:'paper'|'mist'|'night'|'dark', mountain:true|false, moon:false})
//   paper：宣纸＋下部淡墨远山；mist：山更高更多、雾带缓移（章节卡/过场）；night：深墨底反白（风险/夜/暗）；dark：纯深墨（数据镜头）
D.bg = (c, t, o = {}) => {
  const kind = ['paper', 'mist', 'night', 'dark'].includes(o.kind) ? o.kind : 'paper', mt = o.mountain !== false;
  D.dark = kind === 'night' || kind === 'dark'; D.kind = kind;
  if (kind === 'dark') { c.fillStyle = '#101214'; c.fillRect(0, 0, W, H); c.drawImage(D.paperNight(), 0, 0); c.fillStyle = 'rgba(16,18,20,.55)'; c.fillRect(0, 0, W, H); }
  else c.drawImage(kind === 'night' ? D.paperNight() : D.paper(), 0, 0);
  if (mt && kind !== 'dark') { c.drawImage(mountains(kind === 'night' ? 'night' : kind), Math.sin(t * 0.12) * 6 - 0, 0); if (kind === 'mist' || kind === 'night') mistBands(c, t, kind === 'night'); }
  if (o.moon || (kind === 'night' && o.moon !== false && o.moon !== undefined)) D.moon(c, 'bgmoon', o.mx || 800, o.my || 330, o.mr || 120, ss(0, 1.2, t + 1));
};

// ---------- 收尾 / 字幕 ----------
// 每镜收尾：纸面颗粒＋暗角＋字幕带 y1380–1560 压墨雾（浅底压暗成淡墨，深底更深）；字幕带内不要放内容
D.finish = (c, o = {}) => {
  const dk = D.dark;
  c.drawImage(P.grain('ink_k', 0.035, dk ? [200, 200, 200] : [60, 45, 30], dk ? 0.07 : 0.1), 0, 0);
  const b = c.createLinearGradient(0, 1300, 0, 1650), k = dk ? '6,8,10' : '36,30,24';
  const m = dk ? 0.62 : 0.5; b.addColorStop(0, `rgba(${k},0)`); b.addColorStop(0.12, `rgba(${k},${m * 0.12})`); b.addColorStop(0.3, `rgba(${k},${m * 0.75})`); b.addColorStop(0.42, `rgba(${k},${m})`); b.addColorStop(0.75, `rgba(${k},${m})`); b.addColorStop(0.9, `rgba(${k},${m * 0.5})`); b.addColorStop(1, `rgba(${k},0)`);
  c.fillStyle = b; c.fillRect(0, 1300, W, 350);
};
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "Songti-Black"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 76), h = 92, x = 540, y = 1480;
  c.fillStyle = 'rgba(22,18,15,.93)'; c.fillRect(x - w / 2, y - h / 2, w, h);
  c.fillStyle = C.cinnabar; c.fillRect(x - w / 2, y - h / 2, 9, h);
  c.fillStyle = '#F2EBD8'; c.fillText(text, x + 4, y + 3, 980); c.restore();
};

// ---------- 文字 ----------
// K.text(c, s, x, y, {size, fam, col, align, alpha, scale, track, maxW, rot, bleed}): 默认色随深浅底；bleed＝墨在纸上微洇（轻模糊影，默认开）
D.text = (c, s, x, y, o = {}) => {
  const { size = 64, fam = 'Songti-Black', align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, bleed = true } = o, col = o.col || D.fg();
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col;
  if (bleed) { c.shadowColor = col; c.shadowBlur = Math.max(2, size * 0.035); c.globalAlpha *= 0.55; c.fillText(s, 0, 0); c.shadowBlur = 0; c.globalAlpha /= 0.55 || 1; }
  c.fillText(s, 0, 0); c.restore();
};
// 大字（≥100）：墨字由淡洇浓。o.p 0..1 洇出进度（缺省 1）
D.bigText = (c, s, x, y, size = 128, col, o = {}) => {
  size = Math.max(100, size); const p = o.p == null ? 1 : o.p; if (p <= 0) return;
  c.save(); if (p < 1) c.filter = `blur(${(7 * (1 - p)).toFixed(1)}px)`;
  D.text(c, s, x, y, { ...o, size, col: col || D.fg(), alpha: (o.alpha ?? 1) * ss(0, 0.7, p) }); c.filter = 'none'; c.restore();
};
// 标签（≥52）：墨字＋底下一笔飞白横线；hot＝朱砂；o.line=false 不画线；align left|center|right。返回宽度
D.tag = (c, s, x, y, o = {}) => {
  const size = Math.max(52, o.size || 56), alpha = o.alpha ?? 1, align = o.align || 'center'; c.save(); c.font = `${size}px "Songti-Black"`; const tw = c.measureText(s).width * (o.scale || 1); c.restore();
  const col = o.col || (o.hot ? D.up() : D.fg()), x0 = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
  D.text(c, s, x0 + tw / 2, y, { ...o, size, col, alpha, align: 'center' });
  if (o.line !== false && alpha > 0.5) D.brush(c, [[x0 - 8, y + size * 0.62], [x0 + tw * 0.5, y + size * 0.6], [x0 + tw + 8, y + size * 0.63]], { w: 7, tone: o.hot ? 0.7 : 0.5, dry: 0.6, seed: 5 + s.length, head: 0.04, tail: 0.5, col: o.hot ? (D.dark ? '#E4503F' : C.cinnabar) : (D.dark ? '#EFE6D0' : C.ink), light: D.dark });
  return tw;
};
// 弹出文字：墨字洇入＋轻微放大。o.plate=true 用标签，否则大字
D.popText = (c, s, x, y, lt, at, o = {}) => {
  const k = D.at(lt, at, o.dur || 0.55); if (k <= 0) return; const sc = (o.scale || 1) * (0.94 + 0.06 * MO.backOut(k, 1.2));
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: sc, alpha: ss(0, 0.5, k) * (o.alpha ?? 1) }); else D.bigText(c, s, x, y, o.size || 128, o.fill || o.col, { ...o, scale: sc, p: k });
};
// 引线标注：墨线（连续笔）从 (ax,ay) 引向 (bx,by)，起点一个墨点，末端标签逐字写出。o { size(≥52), hot, align }
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => {
  const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return; const col = o.hot ? (D.dark ? '#E4503F' : C.cinnabar) : (D.dark ? '#EFE6D0' : C.ink);
  D.brush(c, [[ax, ay], [lerp(ax, bx, 0.5), lerp(ay, by, 0.5) + 6], [bx, by]], { w: 7, tone: 0.8, dry: 0.3, seed: 12, reveal: p1, head: 0.05, tail: 0.3, col, light: D.dark });
  c.save(); c.fillStyle = col; c.globalAlpha = 0.9; c.beginPath(); c.arc(ax, ay, 11 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.at(lt, at + 0.3, [...s].length / 20); if (q > 0) D.tag(c, TY.typed(s, q), bx, by - 8, { ...o, size: Math.max(52, o.size || 54), align: o.align || 'left' });
};
// 数字：统一格式。K.fmt.pct(4.5)→'+4.5%'、K.fmt.pct(-7.4)→'-7.4%'；K.fmt.n(1234.5,1)→'1,234.5'；K.fmt.dir(v)→'up'|'down'
D.fmt = {
  pct: (v, d = 1, sign = true) => (v > 0 && sign ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(d) + '%',
  n: (v, d = 0) => { const [a, b] = Math.abs(v).toFixed(d).split('.'); return (v < 0 ? '-' : '') + a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); },
  dir: v => v > 0 ? 'up' : v < 0 ? 'down' : 'ink',
};
// K.num(c, s, x, y, {size, col, align, dir, alpha, p})：首位 +/- 画成毛笔笔画（字体里的 - 太细太小），其余走宋体。dir 'up'|'down' 自动上色朱砂/花青
D.num = (c, s, x, y, o = {}) => {
  const size = Math.max(44, o.size || 120), align = o.align || 'center', col = o.col || D.tone(o.dir), p = o.p == null ? 1 : o.p; if (p <= 0) return 0;
  let sign = ''; if (/^[+\-−]/.test(s)) { sign = s[0] === '+' ? '+' : '-'; s = s.slice(1); }
  c.save(); c.font = `${size}px "Songti-Black"`; const tw = c.measureText(s).width, sw = sign ? size * 0.58 : 0; c.restore();
  const tot = tw + sw, left = align === 'left' ? x : align === 'right' ? x - tot : x - tot / 2;
  c.save(); c.globalAlpha *= (o.alpha ?? 1) * ss(0, 0.6, p); if (p < 1) c.filter = `blur(${(6 * (1 - p)).toFixed(1)}px)`;
  if (sign) { const sx = left + sw * 0.46, L = size * 0.46, bw = size * 0.1, cc = Array.isArray(col) ? col : col;
    D.brush(c, [[sx - L / 2, y + size * 0.03], [sx, y + size * 0.015], [sx + L / 2, y + size * 0.035]], { w: bw, tone: 0.92, dry: 0.12, seed: 31, head: 0.12, tail: 0.3, tailK: 0.4, col: cc, light: D.dark, bristles: 5 });
    if (sign === '+') D.brush(c, [[sx + 0.01, y - L / 2 + size * 0.03], [sx, y + size * 0.03], [sx - 0.01, y + L / 2 + size * 0.03]], { w: bw, tone: 0.92, dry: 0.12, seed: 32, head: 0.12, tail: 0.3, tailK: 0.4, col: cc, light: D.dark, bristles: 5 }); }
  D.text(c, s, left + sw + tw / 2, y, { size, col, align: 'center' }); c.filter = 'none'; c.restore(); return tot;
};

// ---------- 钤印 ----------
// K.seal(c, x, y, size, text, {rot, alpha, p, white})：朱砂方印，阴文（白字）。text 1–4 字，2×2 右起竖排；边缘与字缺角由种子侵蚀。p＝落印进度（0..1，略压下再弹起）
D.seal = (c, x, y, size, text = '财报', o = {}) => {
  const p = o.p == null ? 1 : o.p; if (p <= 0) return; const a = [...text].slice(0, 4), s = size, key = 'seal_' + text + '_' + s;
  const S = D.once(key, () => { const cv = P.canvas(s + 8, s + 8), g = cv.getContext('2d'); g.translate(4, 4);
    g.fillStyle = C.cinnabar; g.beginPath(); const N = 36, pts = []; for (let i = 0; i < N; i++) { const f = i / N * 4, side = Math.floor(f), u = f - side, j = (U.hash(i, 3) - 0.5) * s * 0.012; let X, Y;
      if (side === 0) { X = u * s; Y = j; } else if (side === 1) { X = s + j; Y = u * s; } else if (side === 2) { X = s - u * s; Y = s + j; } else { X = j; Y = s - u * s; } pts.push([X, Y]); }
    pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    const cell = s / 2, fs = a.length === 1 ? s * 0.62 : a.length === 2 ? s * 0.4 : s * 0.38; g.font = `${fs}px "Songti-Black"`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const pos = a.length === 1 ? [[0.5, 0.5]] : a.length === 2 ? [[0.5, 0.29], [0.5, 0.71]] : [[0.75, 0.25], [0.75, 0.75], [0.25, 0.25], [0.25, 0.75]];
    a.forEach((ch, i) => g.fillText(ch, pos[i][0] * s, pos[i][1] * s + fs * 0.04));
    g.strokeStyle = '#000'; g.lineWidth = Math.max(3, s * 0.035); g.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);   // 阴文边框线（挖空）
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.5 + U.hash(i, 9) * 0.5; g.beginPath(); g.arc(U.hash(i, 5) * s, U.hash(i, 6) * s, 0.8 + U.hash(i, 7) * 2.2, 0, TAU); g.fill(); }
    return cv; });
  const drop = 1 - Math.pow(1 - clamp(p), 3), k = lerp(1.25, 1, drop);
  c.save(); c.globalAlpha *= (o.alpha ?? 1) * clamp(p * 4); c.translate(x, y); c.rotate(o.rot || -0.04); c.scale(k, k); c.globalCompositeOperation = D.dark ? 'source-over' : 'multiply'; c.drawImage(S, -s / 2 - 4, -s / 2 - 4); c.restore();
};

// ---------- 数据图示意 ----------
const mapY = (v, mn, mx, y, h) => y - (v - mn) / (mx - mn || 1) * h;
// K.bars(c, data, {x,y,w,h,p,max,labelSize,valSize,unit,base})：墨柱。(x,y)=基线左端，向上长 h；data [{v,label,val,dir:'up'|'down'|'ink'}]；p 0..1 生长进度（逐柱错开）；
// val 缺省时按 v 写数值（带 unit）；柱顶数值、基线下标签（≥52）
D.bars = (c, data, o = {}) => {
  const { x = 120, y = 1000, w = 840, h = 560, p = 1, labelSize = 52, valSize = 76, unit = '', base = true } = o, n = data.length, slot = w / n, bw = Math.min(slot * 0.52, 170), mx = o.max || Math.max(...data.map(d => Math.abs(d.v))) * 1.08;
  if (base) D.brush(c, [[x - 30, y + 6], [x + w / 2, y + 2], [x + w + 30, y + 7]], { w: 12, tone: 0.7, dry: 0.5, seed: 3, head: 0.02, tail: 0.3, reveal: ss(0, 0.2, p), col: D.fg(), light: D.dark });
  data.forEach((d, i) => {
    const cx = x + slot * (i + 0.5), k = ss(0.12 + i * 0.12, 0.62 + i * 0.12, p), hh = Math.max(8, Math.abs(d.v) / mx * h), col = D.tone(d.dir);
    if (k > 0) D.brush(c, [[cx + 2, y], [cx - 3, y - hh * 0.5], [cx + 1, y - hh]], { w: bw, tone: d.dir === 'ink' || !d.dir ? 0.85 : 0.9, dry: 0.22, seed: 40 + i * 5, head: 0.015, tail: 0.1, tailK: 0.12, reveal: k, col, light: D.dark, bristles: clamp(Math.round(bw / 7), 8, 22) });
    const vp = ss(0.7 + i * 0.05, 0.95 + i * 0.05, p);
    if (vp > 0 && (d.val != null || d.v != null)) D.num(c, d.val != null ? d.val : D.fmt.n(d.v) + unit, cx, y - hh * k - valSize * 0.75, { size: valSize, dir: d.dir, p: vp });
    if (d.label) D.text(c, d.label, cx, y + 62, { size: labelSize, col: D.fg(), alpha: ss(0, 0.3, p), maxW: slot - 10 });
  });
};
// K.line(c, series, {x,y,w,h,p,min,max,dir,lw,grid,dot})：墨线折线。(x,y)=左下角；涨（末>首）朱砂、跌花青、dir:'ink' 用墨；p 0..1 画出进度；末端落一墨点
D.line = (c, series, o = {}) => {
  const { x = 100, y = 1100, w = 880, h = 560, p = 1, lw = 15, grid = true } = o, mn = o.min != null ? o.min : Math.min(...series), mx = o.max != null ? o.max : Math.max(...series), n = series.length;
  const dir = o.dir || (series[n - 1] >= series[0] ? 'up' : 'down'), col = D.tone(dir), pts = series.map((v, i) => [x + w * i / (n - 1), mapY(v, mn, mx, y, h)]);
  c.save(); if (grid) { c.strokeStyle = D.dark ? 'rgba(239,230,208,.14)' : 'rgba(22,18,15,.13)'; c.lineWidth = 2; for (let k = 0; k <= 3; k++) { const gy = y - h * k / 3; c.beginPath(); c.moveTo(x - 20, gy); c.lineTo(x + w + 20, gy); c.stroke(); } } c.restore();
  D.brush(c, [[x - 24, y + 8], [x + w / 2, y + 4], [x + w + 24, y + 9]], { w: 11, tone: 0.65, dry: 0.5, seed: 8, head: 0.02, tail: 0.3, reveal: ss(0, 0.15, p), col: D.fg(), light: D.dark });
  D.brush(c, pts, { w: lw, tone: 0.92, dry: 0.28, seed: 17, reveal: ss(0.05, 1, p), head: 0.02, tail: 0.1, tailK: 0.3, col, light: D.dark, bristles: 8 });
  if (p > 0.95) { const e = pts[n - 1], q = ss(0.95, 1, p); D.blob(c, 'linedot_' + Math.round(x + y), e[0], e[1], 26 * q, 26 * q, D.dark ? (dir === 'up' ? '#E4503F' : '#7FA6C4') : (dir === 'up' ? C.cinnabar : C.cyan), { grow: 1, seed: 8, halo: 8, haloA: 0.4, blur: 2, light: D.dark }); }
  return pts;
};
// K.arrow(c, x, y, len, dir, {p, w, col})：(x,y)=箭尾；dir 'up' 朱砂上扬／'down' 花青下坠；一笔身＋两笔羽头，全是连续笔
D.arrow = (c, x, y, len, dir = 'up', o = {}) => {
  const { p = 1, w = 84 } = o, sg = dir === 'up' ? -1 : 1, col = o.col || D.tone(dir), lean = (dir === 'up' ? 1 : -1) * len * 0.12, ex = x + lean, ey = y + sg * len;
  D.brush(c, [[x, y], [x + lean * 0.3 - sg * 6, y + sg * len * 0.4], [x + lean * 0.75, y + sg * len * 0.78], [ex, ey]], { w, tone: 0.92, dry: 0.35, seed: dir === 'up' ? 21 : 22, reveal: ss(0, 0.7, p), head: 0.1, tail: 0.3, tailK: 0.35, col, light: D.dark, bristles: 12 });
  const hp = ss(0.65, 1, p), hl = len * 0.32;
  [[-1, 0.9], [1, 0.9]].forEach(([s2, k], i) => D.brush(c, [[ex, ey], [ex + s2 * hl * 0.55 - lean * 0.1, ey - sg * hl * 0.5], [ex + s2 * hl * 0.9, ey - sg * hl * 0.95]], { w: w * 0.62, tone: 0.9, dry: 0.3, seed: 70 + i + (dir === 'up' ? 0 : 5), reveal: hp, head: 0.04, tail: 0.4, tailK: 0.4, col, light: D.dark, bristles: 8 }));
};
// K.scale(c, cx, cy, w, tilt, {left, right, p})：天平。(cx,cy)=支点；tilt 弧度（正＝右盘沉）；left/right(c,x,y) 回调在盘面中心上方画东西（币堆等）。底座 y≈cy+430
D.scale = (c, cx, cy, w, tilt = 0, o = {}) => {
  const p = o.p == null ? 1 : o.p, col = D.fg(), L = D.dark, ex = Math.cos(tilt) * w / 2, ey = Math.sin(tilt) * w / 2, base = cy + 430;
  D.brush(c, [[cx, cy + 6], [cx + 4, cy + 200], [cx - 2, base - 20]], { w: 30, tone: 0.9, dry: 0.3, seed: 4, head: 0.02, tail: 0.2, tailK: 0.2, reveal: ss(0, 0.4, p), col, light: L });
  D.brush(c, [[cx - 190, base], [cx, base - 6], [cx + 190, base]], { w: 30, tone: 0.9, dry: 0.4, seed: 6, head: 0.1, tail: 0.3, tailK: 0.5, reveal: ss(0.1, 0.5, p), col, light: L });
  D.brush(c, [[cx - ex, cy - ey], [cx, cy], [cx + ex, cy + ey]], { w: 22, tone: 0.92, dry: 0.28, seed: 9, head: 0.04, tail: 0.15, tailK: 0.4, reveal: ss(0.2, 0.7, p), col, light: L });
  const pq = ss(0.5, 1, p);
  [[-1, o.left], [1, o.right]].forEach(([s, fn], i) => {
    const px = cx + s * ex, py = cy + s * ey + 175; if (pq <= 0) return;
    D.brush(c, [[px, cy + s * ey], [px - 70, py - 6]], { w: 5, tone: 0.7, dry: 0.2, seed: 50 + i, reveal: pq, head: 0.02, tail: 0.05, col, light: L, bristles: 4 });
    D.brush(c, [[px, cy + s * ey], [px + 70, py - 6]], { w: 5, tone: 0.7, dry: 0.2, seed: 52 + i, reveal: pq, head: 0.02, tail: 0.05, col, light: L, bristles: 4 });
    D.brush(c, [[px - 108, py - 8], [px - 66, py + 22], [px, py + 34], [px + 66, py + 22], [px + 108, py - 8]], { w: 14, tone: 0.9, dry: 0.25, seed: 54 + i, reveal: pq, head: 0.08, tail: 0.1, tailK: 0.5, col, light: L, bristles: 6 });
    if (fn && pq >= 1) fn(c, px, py - 8);
  });
  D.blob(c, 'scalepin', cx, cy, 20 * ss(0, 0.3, p), 20 * ss(0, 0.3, p), L ? '#E4503F' : C.cinnabar, { grow: 1, seed: 2, halo: 5, haloA: 0.4, blur: 1.5, light: L });
};
// K.coin(c, x, y, r, {col:'gold'|'ink'|'cinnabar', p})：铜钱（圆外方孔）。淡彩晕＋墨线外圈＋方孔四笔
D.coin = (c, x, y, r, o = {}) => {
  const p = o.p == null ? 1 : o.p; if (p <= 0 || r <= 0) return; const fill = o.col === 'ink' ? '#5C5852' : o.col === 'cinnabar' ? C.sun : C.gold, L = D.dark, key = 'coin_' + Math.round(x) + '_' + Math.round(y);
  D.blob(c, key, x, y, r * p, r * p, fill, { grow: 1, seed: Math.round(x + y) % 17 + 1, halo: 4, haloA: 0.3, blur: 1.5, alpha: 0.95, amp: 0.05, light: L });
  const a0 = (U.hash(Math.round(x), Math.round(y)) * 6), ring = []; for (let i = 0; i <= 22; i++) ring.push([x + Math.cos(a0 + i / 22 * TAU * 0.97) * r * 0.96, y + Math.sin(a0 + i / 22 * TAU * 0.97) * r * 0.96]);
  const col = L ? '#EFE6D0' : C.ink; D.brush(c, ring, { w: Math.max(3, r * 0.09), tone: 0.88, dry: 0.15, seed: Math.round(x) % 90 + 1, head: 0.1, tail: 0.15, tailK: 0.3, reveal: p, col, light: L, bristles: 4 });
  const q = r * 0.26, ang = 0.05, sq = [[-q, -q], [q, -q], [q, q], [-q, q], [-q, -q]].map(([a, b]) => [x + a - b * ang, y + b + a * ang]);
  c.save(); c.globalCompositeOperation = 'source-over'; c.fillStyle = L ? C.night : C.paper; c.beginPath(); sq.slice(0, 4).forEach((v, i) => i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])); c.closePath(); c.fill(); c.restore();
  if (p >= 1) D.brush(c, sq, { w: Math.max(2.5, r * 0.06), tone: 0.85, dry: 0.1, seed: 5, head: 0.02, tail: 0.05, tailK: 0.1, col, light: L, bristles: 3 });
};

// ---------- 景物：云 楼 钟 ----------
// K.cloud(c, key, x, y, s, {p, col})：云（淡墨晕＋两笔卷）。s≈半宽
D.cloud = (c, key, x, y, s, o = {}) => {
  const p = o.p == null ? 1 : o.p; if (p <= 0) return; const col = o.col || (D.dark ? '#A9B3BE' : '#6F7782'), L = D.dark;
  [[-0.5, 0.1, 0.5, 0.36], [0.05, -0.18, 0.62, 0.46], [0.55, 0.08, 0.46, 0.33], [0, 0.2, 0.9, 0.28]].forEach(([a, b, rx, ry], i) => D.blob(c, key + i, x + a * s, y + b * s, rx * s * p, ry * s * p, col, { grow: 1, seed: i + 2, halo: s * 0.1, haloA: 0.3, blur: s * 0.05, alpha: 0.5, light: L }));
  const ink = L ? '#EFE6D0' : C.ink;
  D.brush(c, [[x - s * 0.7, y + s * 0.22], [x - s * 0.2, y + s * 0.32], [x + s * 0.5, y + s * 0.3], [x + s * 0.85, y + s * 0.2]], { w: s * 0.06, tone: 0.55, dry: 0.6, seed: 14, reveal: p, head: 0.1, tail: 0.5, col: ink, light: L, bristles: 5 });
  D.brush(c, [[x - s * 0.1, y - s * 0.38], [x + s * 0.3, y - s * 0.46], [x + s * 0.55, y - s * 0.28], [x + s * 0.4, y - s * 0.14]], { w: s * 0.05, tone: 0.6, dry: 0.4, seed: 15, reveal: p, head: 0.1, tail: 0.5, col: ink, light: L, bristles: 4 });
};
// K.tower(c, x, y, w, h, {p, floors, seed})：楼（白描写字楼＋飞檐顶）。(x,y)=底边中心；窗格用短笔点
D.tower = (c, x, y, w, h, o = {}) => {
  const p = o.p == null ? 1 : o.p, fl = o.floors || 8, L = D.dark, col = L ? '#EFE6D0' : C.ink, sd = o.seed || 1, x0 = x - w / 2, y0 = y - h, tw = (k, a) => [x0 + w * 0.5 + (k - 0.5) * 0, y];
  if (p <= 0) return;
  D.wash(c, 'tw_' + Math.round(x) + '_' + Math.round(y), 1, g => { g.fillStyle = L ? '#5B6670' : '#8C877C'; g.fillRect(x0 + 6, y - h * ss(0, 0.6, p), w - 12, h * ss(0, 0.6, p)); }, { box: [x0 - 20, y - h - 20, w + 40, h + 40], blur: 4, halo: 6, haloA: 0.2, alpha: 0.35, light: L });
  const pr = ss(0, 0.5, p);
  D.brush(c, [[x0, y], [x0 + 3, y - h * 0.5], [x0 - 1, y - h]], { w: 9, tone: 0.85, dry: 0.3, seed: sd, reveal: pr, head: 0.02, tail: 0.1, tailK: 0.3, col, light: L, bristles: 5 });
  D.brush(c, [[x0 + w, y], [x0 + w - 3, y - h * 0.5], [x0 + w + 1, y - h]], { w: 9, tone: 0.85, dry: 0.3, seed: sd + 1, reveal: pr, head: 0.02, tail: 0.1, tailK: 0.3, col, light: L, bristles: 5 });
  D.brush(c, [[x0 - 20, y + 2], [x, y - 2], [x0 + w + 20, y + 3]], { w: 11, tone: 0.8, dry: 0.4, seed: sd + 2, reveal: ss(0, 0.3, p), head: 0.03, tail: 0.2, col, light: L });
  const rp = ss(0.5, 0.85, p);   // 飞檐顶
  D.brush(c, [[x0 - 36, y - h + 8], [x0 + 6, y - h - 6], [x, y - h - 44], [x0 + w - 6, y - h - 6], [x0 + w + 36, y - h + 8]], { w: 12, tone: 0.88, dry: 0.25, seed: sd + 3, reveal: rp, head: 0.05, tail: 0.1, tailK: 0.3, col, light: L, bristles: 6 });
  const wp = ss(0.6, 1, p), cols = Math.max(2, Math.floor(w / 46));
  for (let r = 0; r < fl; r++) for (let k = 0; k < cols; k++) if (wp > (r * cols + k) / (fl * cols) * 0.9) {
    const lit = U.hash(r * 7 + k, sd) > 0.45, wx = x0 + w * (k + 0.5) / cols, wy = y - h + 30 + (h - 60) * (r + 0.5) / fl;
    c.save(); c.globalCompositeOperation = L ? 'source-over' : 'multiply'; c.fillStyle = lit ? (L ? 'rgba(230,200,120,.8)' : 'rgba(196,122,60,.7)') : (L ? 'rgba(239,230,208,.18)' : 'rgba(22,18,15,.28)'); c.beginPath(); c.roundRect(wx - 9, wy - 11, 18, 22, 3); c.fill(); c.restore();
  }
};
// K.bell(c, x, y, s, {p, swing})：钟（开盘／收盘钟）。(x,y)=悬点；s≈钟高
D.bell = (c, x, y, s, o = {}) => {
  const p = o.p == null ? 1 : o.p, L = D.dark, col = L ? '#EFE6D0' : C.ink, ang = Math.sin(o.swing || 0) * 0.12; if (p <= 0) return;
  const body = [[-s * 0.1, 0], [-s * 0.16, s * 0.3], [-s * 0.3, s * 0.58], [-s * 0.42, s * 0.78]];
  D.wash(c, 'bell_' + Math.round(x) + '_' + Math.round(y), ss(0, 0.6, p), g => { g.translate(x, y); g.rotate(ang); g.fillStyle = L ? '#B8924A' : C.ochre; g.beginPath(); g.moveTo(-s * 0.1, 0); g.bezierCurveTo(-s * 0.2, s * 0.3, -s * 0.3, s * 0.55, -s * 0.44, s * 0.8); g.lineTo(s * 0.44, s * 0.8); g.bezierCurveTo(s * 0.3, s * 0.55, s * 0.2, s * 0.3, s * 0.1, 0); g.closePath(); g.fill(); },
    { box: [x - s * 0.7, y - 30, s * 1.4, s * 1.1], blur: 2, halo: 6, haloA: 0.3, alpha: 0.85, light: L });
  c.save(); c.translate(x, y); c.rotate(ang); const q1 = ss(0.2, 0.9, p);
  D.brush(c, [[0, -s * 0.22], [0, 0]], { w: 8, tone: 0.8, dry: 0.1, seed: 3, reveal: p, col, light: L, bristles: 3 });
  D.brush(c, [[-s * 0.1, 0], [-s * 0.19, s * 0.3], [-s * 0.31, s * 0.56], [-s * 0.44, s * 0.8], [0, s * 0.83], [s * 0.44, s * 0.8], [s * 0.31, s * 0.56], [s * 0.19, s * 0.3], [s * 0.1, 0]], { w: 12, tone: 0.9, dry: 0.2, seed: 5, reveal: q1, head: 0.03, tail: 0.06, tailK: 0.3, col, light: L, bristles: 6 });
  D.brush(c, [[-s * 0.25, s * 0.46], [0, s * 0.49], [s * 0.25, s * 0.46]], { w: 7, tone: 0.7, dry: 0.3, seed: 8, reveal: q1, col, light: L, bristles: 3 });
  c.fillStyle = col; c.beginPath(); c.arc(0, s * 0.92, s * 0.06, 0, TAU); c.fill(); c.restore();
};

// ---------- 人：无脸写意背影 / 手 ----------
// 衣：一块变宽带，两头圆
const limb = (c, pts, w0, w1, col, a, L) => { const d = KIT.resample(KIT.densify(pts, 6), 3), n = d.length, p = new Path2D();   // 圆头变宽带：一串同向圆叠成一块，单次填充（不叠 alpha）
  d.forEach((q, i) => { const r = lerp(w0, w1, i / (n - 1)) / 2; p.moveTo(q[0] + r, q[1]); p.arc(q[0], q[1], r, 0, TAU); });
  c.save(); c.globalCompositeOperation = L ? 'source-over' : 'multiply'; c.fillStyle = col; c.globalAlpha *= a; c.fill(p); c.restore(); };
const POSES = {
  stand: { sh: -250, hy: -292, hem: 74, waist: 46, arms: [[-1, [-62, -120]], [1, [62, -120]]] },
  back: { sh: -250, hy: -292, hem: 74, waist: 46, arms: [[-1, [-58, -150]], [1, [58, -150]]] },
  walk: { sh: -250, hy: -292, hem: 70, waist: 46, arms: [[-1, [-50, -135]], [1, [56, -150]]], walk: true },
  point: { sh: -250, hy: -292, hem: 74, waist: 46, arms: [[-1, [-60, -125]], [1, [185, -330]]] },
  raise: { sh: -250, hy: -292, hem: 74, waist: 46, arms: [[-1, [-150, -380]], [1, [150, -380]]] },
  sit: { sh: -168, hy: -208, hem: 128, waist: 66, arms: [[-1, [-70, -70]], [1, [70, -70]]], sit: true },
  think: { sh: -250, hy: -282, hem: 74, waist: 46, arms: [[-1, [-58, -130]], [1, [30, -215]]] },
};
// K.figure(c, x, y, h, {pose:'stand'|'back'|'walk'|'point'|'raise'|'sit'|'think', t, dir:1|-1, p, col, hat})：无脸写意背影。(x,y)=脚底中心，h＝全高（站姿约 340 单位）
// 淡墨衣（晕）＋浓墨衣纹笔＋墨发髻，不画五官。col 为衣色（默认淡墨；也可传花青/朱砂做衣）；hat=true 戴幞头
D.figure = (c, x, y, h, o = {}) => {
  const ps = POSES[o.pose] || POSES.stand, p = o.p == null ? 1 : o.p, t = o.t || 0, dir = o.dir || 1, L = D.dark, k = h / 340, ink = L ? '#EFE6D0' : C.ink, robe = o.col || (L ? '#8E98A3' : '#3C3A36');
  if (p <= 0) return; const sway = ps.walk ? Math.sin(t * 4) : 0, bob = ps.walk ? Math.abs(Math.sin(t * 4)) * -6 : 0;
  c.save(); c.translate(x, y + bob * k); c.scale(dir * k, k);
  const sh = ps.sh, hm = ps.hem, wa = ps.waist, hw = 40;
  // 衣身（淡墨晕）：上窄肩、腰收、摆展；用 limb 叠几条宽带做出写意的块
  const robePath = (sc, dx) => { c.beginPath(); c.moveTo(-16 * sc, sh - 6); c.quadraticCurveTo(-hw * 0.9 * sc, sh - 2, (-hw - 10) * sc, sh + 22); c.bezierCurveTo((-wa - 14) * sc, sh * 0.6, (-wa - 10) * sc, sh * 0.38, -hm * sc + dx, -2); c.quadraticCurveTo(dx, 8, hm * sc + dx, -2); c.bezierCurveTo((wa + 10) * sc, sh * 0.38, (wa + 14) * sc, sh * 0.6, (hw + 10) * sc, sh + 22); c.quadraticCurveTo(hw * 0.9 * sc, sh - 2, 16 * sc, sh - 6); c.closePath(); };
  c.save(); c.globalCompositeOperation = L ? 'source-over' : 'multiply'; c.fillStyle = robe; c.globalAlpha *= 0.55 * ss(0, 0.5, p); robePath(1, sway * 8); c.fill(); c.globalAlpha *= 0.6; robePath(0.82, sway * 5); c.fill(); c.restore();
  // 衣纹笔
  const fp = ss(0.2, 0.9, p), tn = 0.82;
  D.brush(c, [[-hw - 4, sh + 20], [-wa - 8, sh * 0.45], [-hm + sway * 6, -4]], { w: 7, tone: 0.7, dry: 0.5, seed: 102, reveal: fp, head: 0.05, tail: 0.5, col: ink, light: L, bristles: 5 });
  D.brush(c, [[hw + 4, sh + 20], [wa + 8, sh * 0.45], [hm + sway * 6, -4]], { w: 7, tone: 0.7, dry: 0.5, seed: 103, reveal: fp, head: 0.05, tail: 0.5, col: ink, light: L, bristles: 5 });
  D.brush(c, [[-hm - 10, 0], [0, 4], [hm + 10, 0]], { w: 9, tone: 0.8, dry: 0.5, seed: 104, reveal: fp, head: 0.05, tail: 0.4, col: ink, light: L, bristles: 5 });
  if (!ps.sit) D.brush(c, [[-wa - 4, sh * 0.58], [0, sh * 0.58 + 6], [wa + 4, sh * 0.58]], { w: 12, tone: 0.9, dry: 0.2, seed: 105, reveal: fp, head: 0.06, tail: 0.1, tailK: 0.4, col: ink, light: L, bristles: 6 });   // 腰带
  [[-26, 0.9], [26, 0.8], [-8, 0.6], [10, 0.7]].forEach(([fx, fl], i) => D.brush(c, [[fx, sh * 0.35], [fx + (fx < 0 ? -5 : 5) + sway * 3, sh * 0.15 * fl], [fx * 1.4 + sway * 5, -hm * 0.12]], { w: 5, tone: 0.5, dry: 0.5, seed: 110 + i, reveal: fp, head: 0.1, tail: 0.5, col: ink, light: L, bristles: 3 }));
  // 肩与领：一笔
  D.brush(c, [[-hw - 10, sh + 26], [-hw * 0.5, sh + 4], [0, sh - 2], [hw * 0.5, sh + 4], [hw + 10, sh + 26]], { w: 14, tone: 0.9, dry: 0.15, seed: 106, reveal: fp, head: 0.1, tail: 0.1, tailK: 0.5, col: ink, light: L, bristles: 6 });
  // 臂（宽袖）
  ps.arms.forEach(([s, end], i) => { const sx = s * (hw + 4), ex = end[0], ey = end[1], mid = [(sx + ex) / 2 + s * 24, (sh + 30 + ey) / 2 - 6];
    limb(c, [[sx, sh + 26], mid, [ex, ey]], 34, 54, robe, 0.5 * ss(0.2, 0.7, p), L);
    D.brush(c, [[sx, sh + 26], mid, [ex, ey]], { w: 9, tone: 0.8, dry: 0.35, seed: 120 + i, reveal: fp, head: 0.05, tail: 0.3, tailK: 0.5, col: ink, light: L, bristles: 5 });
    if (ps.walk === undefined || true) { c.save(); c.fillStyle = L ? '#D8C6A8' : '#A88A6A'; c.globalAlpha = 0.9 * ss(0.5, 1, p); c.globalCompositeOperation = L ? 'source-over' : 'multiply'; c.beginPath(); c.arc(ex, ey, 17, 0, TAU); c.fill(); c.restore(); } });
  // 头：墨发（背面）＋发髻
  const hy = ps.hy, hp = ss(0.1, 0.7, p);
  c.save(); c.globalAlpha *= hp; c.fillStyle = L ? '#EFE6D0' : '#14110E'; c.beginPath(); c.ellipse(0, hy, 31, 35, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, hy - 36, 12, 10, 0, 0, TAU); c.fill();
  c.restore();
  if (o.hat) { D.brush(c, [[-44, hy - 14], [-18, hy - 40], [18, hy - 40], [44, hy - 14]], { w: 14, tone: 0.9, dry: 0.2, seed: 130, reveal: hp, head: 0.1, tail: 0.1, tailK: 0.4, col: ink, light: L, bristles: 6 }); D.brush(c, [[36, hy - 20], [92, hy - 28]], { w: 9, tone: 0.9, dry: 0.2, seed: 131, reveal: hp, head: 0.1, tail: 0.3, col: ink, light: L, bristles: 4 }); D.brush(c, [[-36, hy - 20], [-92, hy - 28]], { w: 9, tone: 0.9, dry: 0.2, seed: 132, reveal: hp, head: 0.1, tail: 0.3, col: ink, light: L, bristles: 4 }); }
  c.restore();
};
// K.hand(c, x, y, {pose:'point'|'open'|'fist'|'flat', rot, s, flip, p, sleeve})：写意手，(x,y)=手腕，默认指向上（rot 0），rot 度顺时针；带宽袖口。s 缩放（1≈手长 170px）
D.hand = (c, x, y, o = {}) => {
  const pose = o.pose || 'point', s = o.s || 1, p = o.p == null ? 1 : o.p, L = D.dark, ink = L ? '#EFE6D0' : C.ink, skin = L ? '#D8C6A8' : '#C49A74', fcol = L ? '#E9D3B0' : '#8A5A3A', sleeve = o.sleeveCol || (L ? '#8E98A3' : '#3C3A36'), fp = ss(0.2, 1, p);
  if (p <= 0) return; c.save(); c.translate(x, y); c.rotate((o.rot || 0) * Math.PI / 180); c.scale((o.flip ? -1 : 1) * s, s);
  const mul = L ? 'source-over' : 'multiply';
  if (o.sleeve !== false) {   // 宽袖：袖口收、向下展开，淡墨晕两层＋两侧边笔＋袖口一笔
    const sl = k => { c.beginPath(); c.moveTo(-54 * k, 28); c.bezierCurveTo(-66 * k, 150, -96 * k, 250, -128 * k, 340); c.quadraticCurveTo(0, 362, 128 * k, 340); c.bezierCurveTo(96 * k, 250, 66 * k, 150, 54 * k, 28); c.quadraticCurveTo(0, 14, -54 * k, 28); c.closePath(); };
    c.save(); c.globalCompositeOperation = mul; c.fillStyle = sleeve; c.globalAlpha *= 0.5 * ss(0, 0.4, p); sl(1); c.fill(); c.globalAlpha *= 0.7; sl(0.72); c.fill(); c.restore();
    D.brush(c, [[-56, 30], [-70, 150], [-100, 255], [-128, 340]], { w: 8, tone: 0.8, dry: 0.4, seed: 201, reveal: fp, head: 0.04, tail: 0.3, col: ink, light: L, bristles: 5 });
    D.brush(c, [[56, 30], [70, 150], [100, 255], [128, 340]], { w: 8, tone: 0.8, dry: 0.4, seed: 202, reveal: fp, head: 0.04, tail: 0.3, col: ink, light: L, bristles: 5 });
    D.brush(c, [[-58, 32], [0, 16], [58, 32]], { w: 13, tone: 0.9, dry: 0.15, seed: 203, reveal: fp, head: 0.08, tail: 0.1, tailK: 0.4, col: ink, light: L, bristles: 6 });
  }
  const fing = (pts, w, sd) => D.brush(c, pts, { w, tone: 0.85, dry: 0.12, seed: sd, reveal: fp, head: 0.1, tail: 0.3, tailK: 0.6, col: fcol, light: L, bristles: 6 });
  const palm = (rx, ry) => { c.save(); c.globalCompositeOperation = mul; c.fillStyle = skin; c.globalAlpha *= 0.9 * ss(0.2, 0.7, p); c.beginPath(); c.moveTo(-rx * 0.8, 6); c.bezierCurveTo(-rx * 1.15, -ry * 0.6, -rx * 1.0, -ry * 1.4, -rx * 0.55, -ry * 1.5); c.lineTo(rx * 0.55, -ry * 1.5); c.bezierCurveTo(rx * 1.0, -ry * 1.4, rx * 1.15, -ry * 0.6, rx * 0.8, 6); c.quadraticCurveTo(0, 20, -rx * 0.8, 6); c.closePath(); c.fill(); c.restore();
    D.brush(c, [[-rx * 0.8, 4], [-rx * 1.08, -ry * 0.7], [-rx * 0.9, -ry * 1.3]], { w: 5, tone: 0.7, dry: 0.3, seed: 211, reveal: fp, col: ink, light: L, bristles: 3 }); D.brush(c, [[rx * 0.8, 4], [rx * 1.08, -ry * 0.7], [rx * 0.9, -ry * 1.3]], { w: 5, tone: 0.7, dry: 0.3, seed: 212, reveal: fp, col: ink, light: L, bristles: 3 }); };
  if (pose === 'point') { palm(40, 40); fing([[-8, -52], [-10, -130], [-8, -228]], 24, 220); fing([[26, -52], [38, -80], [22, -92]], 20, 221); fing([[10, -54], [18, -78], [4, -86]], 19, 222); fing([[-34, -34], [-52, -62], [-46, -86]], 21, 223); }
  else if (pose === 'fist') { palm(44, 34); [[-28, 0], [-9, -4], [10, -4], [29, 0]].forEach(([fx, fy], i) => fing([[fx, -50 + fy], [fx + 2, -78 + fy], [fx - 2, -62 + fy]], 24, 230 + i)); fing([[-44, -40], [-14, -76], [20, -68]], 24, 235); }
  else if (pose === 'flat') { palm(46, 36); [[-30, 0.92], [-10, 1], [10, 1], [30, 0.86]].forEach(([fx, k], i) => fing([[fx, -50], [fx + 1, -50 - 66 * k], [fx + 2, -50 - 124 * k]], 22, 240 + i)); fing([[-42, -34], [-70, -62], [-90, -92]], 22, 245); }
  else { palm(46, 38); [[-33, -22], [-11, 0], [11, 0], [33, -22]].forEach(([fx, a], i) => { const L2 = [96, 118, 114, 90][i]; fing([[fx, -50], [fx + a * 0.4, -50 - L2 * 0.55], [fx + a, -50 - L2]], 21, 250 + i); }); fing([[-44, -30], [-84, -60], [-106, -98]], 22, 255); }
  c.restore();
};

// ---------- 章节卡 / 章名 ----------
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.split2 = s => { const a = [...s]; if (a.length <= 8) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
// K.chapterCard(c, lt, t, n, title, {kind})：圆相（一笔墨圈写出）里是汉字章序，下面是章名，底部一线 N 站（已过＝墨点，本章＝朱砂印点，未到＝淡点）
D.chapterCard = (c, lt, t, n, title = '', o = {}) => {
  D.bg(c, t, { kind: o.kind || 'mist' });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), cx = 540, cy = 560, R = 250, grow = D.ease(D.at(lt, 0.0, 1.4)) + 0.12 * Math.min(1, Math.max(0, lt - 1.4));
  D.sun(c, 'ccsun', cx + 150, cy - 150, 96, Math.min(1, grow) * 0.9, { alpha: 0.55 });
  // 圆相
  const ring = []; for (let i = 0; i <= 40; i++) { const a = -2.2 + i / 40 * (TAU * 0.96); ring.push([cx + Math.cos(a) * R * (1 + 0.012 * Math.sin(a * 3)), cy + Math.sin(a) * R]); }
  D.brush(c, ring, { w: 38, tone: 0.9, dry: 0.5, seed: 61, reveal: D.ease(D.at(lt, 0.1, 1.1)), head: 0.04, tail: 0.3, tailK: 0.75, col: C.ink, bristles: 18 });
  const kp = D.at(lt, 0.2, 0.2); if (kp > 0) D.text(c, '第', cx, 245, { size: 64, col: C.inkMid, alpha: kp }), D.text(c, '章', cx, 875, { size: 64, col: C.inkMid, alpha: kp });
  const num = CN[Math.min(n, 20)] || String(n), nsz = num.length > 1 ? 230 : 330; D.bigText(c, num, cx, cy + 12, nsz, C.ink, { p: D.at(lt, 0.45, 0.6), maxW: 380 });
  // 章名：≤8 字一行 112，否则 split2 两行；整体 maxW 防出界，字号不低于 100
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), size = lines.length > 1 ? 108 : [...title].length > 7 ? 112 : 124, shown = Math.round(D.at(lt, 0.7, Math.max(0.3, all / 12)) * all);
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], kk = clamp(shown - used, 0, a.length); used += a.length;
    if (kk > 0) D.text(c, a.slice(0, kk).join(''), cx, 1030 + i * size * 1.22, { size, col: C.ink, maxW: 960 }); });
  // N 站
  const x0 = 130, x1 = 950, y = 1250 + (lines.length > 1 ? 80 : 0) - 0, X = i => lerp(x0, x1, i / (N - 1)), wp = D.ease(D.at(lt, 0.3, 0.9));
  D.brush(c, [[x0 - 24, y + 2], [540, y - 2], [x1 + 24, y + 3]], { w: 7, tone: 0.5, dry: 0.5, seed: 70, reveal: wp, head: 0.03, tail: 0.3, col: C.ink });
  for (let i = 0; i < N; i++) { const cur = i === n - 1, past = i < n - 1, pp = cur ? D.pop(lt, 1.0, 0.5) : 1, r = cur ? 22 * Math.max(0.5, pp) : 10;
    if (wp * (N - 1) < i) continue; D.blob(c, 'ccd' + i, X(i), y, r, r, cur ? C.cinnabar : past ? C.ink : '#A39E92', { grow: 1, seed: i + 2, halo: 3, haloA: 0.3, blur: 1.4, alpha: cur ? 0.95 : past ? 0.8 : 0.55, amp: 0.06 }); }
  D.seal(c, 880, 255, 112, '财报', { p: D.at(lt, 1.15, 0.4), rot: 0.05 });
  D.finish(c, o);
};
})();
