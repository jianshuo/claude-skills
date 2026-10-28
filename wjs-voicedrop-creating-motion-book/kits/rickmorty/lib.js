// 画风套件 rickmorty（配方 huashu-art-motion 37_rick_morty「扁平描边卡通」）：竖屏 1080×1920。导出 window.K（章节代码里写 const D = K）。
// 规矩：墙/地板有斑驳平涂底；所有形状＝平涂＋深灰圆角描边 #222323（D.flat 自带描边）；人是原创成年人比例，大眼白＋小点瞳孔，表情靠眼睑/眉/嘴；
//       字＝奶油黄＋粗深灰描边；字幕＝深灰底板＋奶油字；没有渐变、没有颗粒、没有光效。D.person 有 sit（坐）/ flip（镜像）；D.sofa 是全书贯穿物（一张能坐两个人的沙发）。
// 所有随机走 U.hash / U.rng，同一 t 画同一帧。
(() => {
const W = 1080, H = 1920, TAU = Math.PI * 2, { clamp, lerp } = U, P = PAINT;
const D = window.K = { W, H, TAU };
// 兜底：pop 的回弹起步段会让「r - 线宽」之类算成负数，canvas 遇负半径直接抛错、整段渲染失败（30fps 才撞上，10fps 冒烟漏过）。负半径一律按 0 画。
for (const proto of [CanvasRenderingContext2D.prototype, Path2D.prototype]) {
  const arc = proto.arc, ell = proto.ellipse; if (typeof arc !== 'function' || typeof ell !== 'function') continue;
  proto.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, r > 0 ? r : 0, ...rest); };
  proto.ellipse = function (x, y, rx, ry, ...rest) { return ell.call(this, x, y, rx > 0 ? rx : 0, ry > 0 ? ry : 0, ...rest); };
}
{ const rg = CanvasRenderingContext2D.prototype.createRadialGradient;   // 径向渐变同理：r0/r1 为负也抛 IndexSizeError
  if (typeof rg === 'function') CanvasRenderingContext2D.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return rg.call(this, x0, y0, r0 > 0 ? r0 : 0, x1, y1, r1 > 0 ? r1 : 0); }; }
const C = D.C = {
  paper: '#C3BB9C', paper2: '#AAA285', paper3: '#684C33', white: '#F2EEDC', cream: '#F6E7A3',
  ink: '#222323', ink2: '#4A5A72', sub: '#7C8794',
  coral: '#E08D4C', coralLt: '#EBA76F', coralDk: '#C4733A', pink: '#E9B5A8', pinkDot: '#C98A7E',
  gold: '#E9C455', goldLt: '#F2DC8A', goldDk: '#C9A03A',
  green: '#6F8F5C', greenLt: '#8FB07A', greenDk: '#55704A', mint: '#B9CDB0', mintDot: '#8FA886',
  lav: '#9AA6C0', lavDot: '#7C8AAE', sky: '#6E8FA6', sofa: '#5D6F8A', tear: '#8FD0EE',
  skin: '#EFC4A0', skinDk: '#E8B48F', skin2: '#C98F66', skin2Dk: '#B27A52', blush: '#E8A08A',
  hair: '#5A4636', hair2: '#8A5A32',
};
D.tone = col => /^#[0-9a-f]{6}$/i.test(col) ? [col, D.shade(col, 0.2), D.shade(col, -0.2)] : [col, col, col];   // [本色, 深一档, 亮一档]
// 调深/调浅一个 #RRGGBB（k>0 往黑，k<0 往白）
D.mixHex = (a, b, k) => { const u = DG.arr(a), v = DG.arr(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(u[i], v[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
D.shade = (hex, k) => { const v = DG.arr(hex), m = k > 0 ? 0 : 255, a = Math.abs(k); return '#' + v.slice(0, 3).map(x => Math.round(x + (m - x) * a).toString(16).padStart(2, '0')).join(''); };

D.at = (lt, a, d) => clamp((lt - a) / d);
D.pop = (lt, a, d = 0.5) => { const q = D.at(lt, a, d); return q <= 0 ? 0 : MO.backOut(q, 1.5); };
D.cache = {}; D.once = (k, f) => D.cache[k] || (D.cache[k] = f());
D.t0 = id => { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('D.t0: 段落表里没有 ' + id); return e.t0; };   // 连续世界拆成多镜时按段落表读起点
D.round = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
D.circle = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; };
D.ellipse = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, TAU); return p; };
D.smooth = (pts, closed = true) => RIG.smooth(pts, closed);
D.world = (c, cam, fn) => CAM.with(c, cam, fn);
// 阻尼二次动作：t0 那一刻发生动作，之后按 period 秒摆、decay 秒衰减（配方：周期 26 帧/60fps≈0.43s，衰减 22 帧≈0.37s）
D.damped = (t, t0, amp, period = 0.43, decay = 0.37) => t < t0 ? 0 : amp * Math.exp(-(t - t0) / decay) * Math.sin((t - t0) / period * TAU);
// 一组时刻里最近一次已发生的（给 damped 当 t0）：D.last(lt, [1.2, 3.4])
D.last = (t, arr) => { let r = -1e9; for (const a of arr) if (a <= t) r = Math.max(r, a); return r; };

// ---------- 颗粒点彩：在 path 里撒 size px 方点，density(x,y) 0..1 决定这一处留不留点 ----------
D.stipple = (g, path, box, col, density, seed = 1, size = 3.2, rate = 0.016) => {
  const r = U.rng(seed), [x0, y0, x1, y1] = box; g.save(); if (path) g.clip(path); g.fillStyle = col;
  const n = Math.round((x1 - x0) * (y1 - y0) * rate);
  for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()); if (r() < density(x, y)) { const s = size * (0.7 + r() * 0.6); g.fillRect(x, y, s, s); } }
  g.restore();
};
// 静态颗粒贴片（暗点＋亮点），叠到角色/物件身上：D.grainIn(c, path)。贴片按屏幕像素大小画，不随缩放糊掉
D.grainTile = () => null; D.grainIn = () => {};   // 本画风没有颗粒
// 描边平涂体块：深灰圆端描边；可选一道深一档的月牙暗面（hard edge，不渐变）。o: { dx, dy 暗面偏移, lineW 线宽, outline:false 去描边 }；light/grain 参数兼容保留、忽略
D.flat = (c, path, col, o = {}) => { const [b, dk] = o.tone || D.tone(col), { dx = 14, dy = 6, lineW = 4.2, outline = true } = o;
  c.save(); c.clip(path); c.fillStyle = dk; c.fill(path); c.save(); c.translate(-dx * 0.5, -dy * 0.5); c.fillStyle = b; c.fill(path); c.restore(); c.restore();
  if (outline) { c.save(); c.lineWidth = lineW; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(path); c.restore(); } };
// 有机色块：种子决定的圆润不规则形
D.blob = (cx, cy, r, seed = 1, wob = 0.14, n = 9) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (U.hash(i, seed) - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.96]); } return D.smooth(pts); };

const DISC = { pink: [C.pink, C.pinkDot], mint: [C.mint, C.mintDot], gold: ['#F2DC8A', C.goldDk], lav: [C.lav, C.lavDot], coral: [C.coralLt, C.coralDk], paper: [C.paper2, C.paper3] };
D.discTex = (tint = 'pink', r = 380, seed = 11) => P.cached(`rmdisc_${tint}_${r}_${seed}`, 2 * r + 8, 2 * r + 8, g => { const [base] = DISC[tint] || DISC.pink; g.fillStyle = base; g.fill(D.circle(r + 4, r + 4, r)); });
D.disc = (c, x, y, r, tint = 'pink', o = {}) => { const [base] = DISC[tint] || DISC.pink; c.save(); c.globalAlpha *= o.alpha ?? 1; c.translate(x, y); if (o.scale) c.scale(o.scale, o.scale); D.flat(c, D.circle(0, 0, r), base, { dx: r * 0.12, dy: 0 }); c.restore(); };
D.blob = (cx, cy, r, seed = 1, wob = 0.14, n = 9) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (U.hash(i, seed) - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.96]); } return D.smooth(pts); };
// ---------- 底：客厅。墙（斑驳）＋墙裙＋踢脚线＋木地板；tint 选墙色（pink 暖米 / mint 灰绿 / gold 芥黄 / lav 灰蓝 / night 夜）----------
const ROOMS = { pink: ['#C3BB9C', '#AAA285', '#8D6E50', '#785A40'], mint: ['#A9B79C', '#8E9E83', '#8D6E50', '#785A40'], gold: ['#CDB97A', '#B29E60', '#8D6E50', '#785A40'], lav: ['#9BA5B4', '#818C9E', '#7C6248', '#664E38'], night: ['#6F7385', '#595D70', '#5F4A3A', '#4B392D'] };
const mottle = (g, x, y, w, h, seed, n, col, al, rmax) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); const r = U.rng(seed); g.fillStyle = col; g.globalAlpha = al;
  for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h, rr = 20 + r() * rmax; g.beginPath(); g.ellipse(px, py, rr * (1 + r()), rr * (0.6 + r() * 0.6), r() * 3, 0, TAU); g.fill(); } g.restore(); };
const inkLine = (g, x0, y0, x1, y1, w = 3, col = C.ink) => { g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
D.roomTex = (tint = 'pink', fl = 1196) => P.cached(`rmroom_${tint}_${fl}`, W, H, g => { const [wall, wallDk, floor, floorDk] = ROOMS[tint] || ROOMS.pink, wt = fl - 336;
  g.fillStyle = wall; g.fillRect(0, 0, W, H); mottle(g, 0, 0, W, fl, 3, 70, wallDk, 0.35, 70); mottle(g, 0, 0, W, fl, 9, 40, D.shade(wall, -0.25), 0.35, 60);
  g.fillStyle = wallDk; g.fillRect(0, wt + 14, W, 322); mottle(g, 0, wt + 14, W, 322, 5, 40, D.shade(wallDk, 0.1), 0.4, 60);
  g.fillStyle = '#E6DFC8'; g.fillRect(0, wt, W, 22); g.lineWidth = 3; g.strokeStyle = C.ink; g.strokeRect(-4, wt, W + 8, 22);
  for (let x = 20; x < W; x += 110) inkLine(g, x, wt + 24, x, fl - 26, 2.4, D.shade(wallDk, 0.15));
  g.fillStyle = '#E6DFC8'; g.fillRect(0, fl - 26, W, 26); g.strokeRect(-4, fl - 26, W + 8, 26);
  g.fillStyle = floor; g.fillRect(0, fl, W, H - fl); mottle(g, 0, fl, W, H - fl, 7, 70, floorDk, 0.5, 90);
  const r = U.rng(36); [[fl, fl + 66], [fl + 66, fl + 164], [fl + 164, fl + 304], [fl + 304, fl + 504], [fl + 504, H]].forEach(([y0, y1]) => { inkLine(g, 0, y1, W, y1, 3, D.shade(floorDk, 0.25)); let x = -r() * 200; while (x < W) { x += 240 + r() * 240; inkLine(g, x, y0, x, y1, 3, D.shade(floorDk, 0.25)); } }); });
D.bg = (c, t, o = {}) => { const { tint = 'pink', floor = 1196 } = o; c.drawImage(D.roomTex(tint, floor || 1196), 0, 0); };
// 沸腾小符号（环境层）：十字、圆点、圆环、三角、半圆、波浪、点阵；只放在四周，不进中央和字幕带
const DECO_KIND = ['plus', 'dot', 'ring', 'tri', 'half', 'squig', 'dots', 'x'];
const DECO_COL = [C.coral, C.gold, C.green, C.ink, C.lavDot, C.mintDot];
D.deco = (c, k, x, y, s, col, i = 0) => { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  if (k === 'plus' || k === 'x') { if (k === 'x') c.rotate(0.78); c.lineWidth = 9; c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.moveTo(0, -15); c.lineTo(0, 15); c.stroke(); }
  else if (k === 'dot') { c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); }
  else if (k === 'ring') { c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.stroke(); }
  else if (k === 'tri') { c.beginPath(); c.moveTo(0, -18); c.lineTo(17, 13); c.lineTo(-17, 13); c.closePath(); c.fill(); }
  else if (k === 'half') { c.beginPath(); c.arc(0, 7, 22, Math.PI, 0); c.closePath(); c.fill(); }
  else if (k === 'squig') { c.lineWidth = 6; c.beginPath(); for (let s2 = 0; s2 <= 24; s2++) { const xx = -34 + s2 * 2.85, yy = Math.sin(s2 / 24 * Math.PI * 3 + i) * 9; s2 ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
  else if (k === 'dots') { for (let a = 0; a < 3; a++) for (let d = 0; d < 4; d++) { c.beginPath(); c.arc(d * 16 - 24, a * 16 - 16, 4.2, 0, TAU); c.fill(); } }
  c.restore(); };
// 槽位只在四周、y ≤ 1130：地面一带（y≈1150–1350）常放道具和人脚，不放符号
const DECO_SLOTS = [[110, 170], [330, 120], [760, 140], [980, 230], [70, 470], [1010, 560], [90, 820], [1000, 900], [130, 1100], [1030, 1060], [520, 90], [50, 640], [600, 60], [60, 1000]];
// avoid: [[x0,y0,x1,y1], …] 这些区域里的槽位不放（大字、主体所在处）
D.decos = () => {};   // 本画风没有漂浮装饰符号

D.finish = c => {
  const g = c.createRadialGradient(W / 2, H * 0.45, 700, W / 2, H * 0.45, 1400); g.addColorStop(0, 'rgba(34,35,35,0)'); g.addColorStop(1, 'rgba(34,35,35,.16)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const b = c.createLinearGradient(0, 1380, 0, 1580); b.addColorStop(0, 'rgba(34,35,35,0)'); b.addColorStop(0.5, 'rgba(34,35,35,.22)'); b.addColorStop(1, 'rgba(34,35,35,0)'); c.fillStyle = b; c.fillRect(0, 1380, W, 200);
};

// ---------- 文字 ----------
// o: { size, fam, col, align, alpha, scale, track, maxW（超宽就整体缩小）, rot }
// 默认奶油黄＋深灰粗描边；指定深色 col（如 C.ink）时改用奶油描边。o.outline=false 关描边
const lumi = h => { const v = DG.arr(h); return (0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2]) / 255; };
D.text = (c, s, x, y, o = {}) => { const { size = 64, fam = 'PuHui-Black', col = C.cream, align = 'center', alpha = 1, scale = 1, track = 0, maxW = 0, rot = 0, outline = true } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = `${size}px "${fam}"`; if (track) c.letterSpacing = track + 'px';
  let k = scale; if (maxW) { const w = c.measureText(s).width; if (w > maxW) k *= maxW / w; } c.scale(k, k);
  c.textAlign = align; c.textBaseline = 'middle';
  if (outline) { c.lineJoin = 'round'; c.lineWidth = Math.max(6, size * 0.16); c.strokeStyle = /^#[0-9a-f]{6}$/i.test(col) && lumi(col) < 0.35 ? C.cream : C.ink; c.strokeText(s, 0, 0); }
  c.fillStyle = col; c.fillText(s, 0, 0); c.restore(); };
// 长标题拆两行：优先在标点处断，没有就从中间断
D.split2 = s => { const a = [...s]; if (a.length <= 10) return [s]; const mid = a.length / 2; let best = -1, bd = 99;
  a.forEach((ch, i) => { if ('，、：；—'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  const k = best > 2 && best < a.length - 2 ? best : Math.ceil(mid); return [a.slice(0, k).join('').replace(/[，、：；]$/, ''), a.slice(k).join('')]; };
// 标签牌：圆角牌＋正下方一块深一档的扁平「影子块」（不用模糊阴影）
D.tag = (c, s, x, y, o = {}) => { const { size = 52, fam = 'PuHui-Heavy', fill = C.white, col = C.ink, scale = 1, alpha = 1, shadow = true, rot = 0, padX = 0.8 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); c.scale(scale, scale); c.font = `${size}px "${fam}"`;
  const w = c.measureText(s).width + size * padX * 2, h = size * 1.6, r = h / 2;
  if (shadow) { c.fillStyle = 'rgba(34,35,35,.3)'; c.fill(D.round(-w / 2, -h / 2 + 9, w, h, r)); }
  c.fillStyle = fill; c.fill(D.round(-w / 2, -h / 2, w, h, r)); c.lineWidth = 5; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.stroke(D.round(-w / 2, -h / 2, w, h, r));
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 3); c.restore(); return w; };
// 弹出的大字/数字（backOut 过冲）；o.plate 时带标签牌（o.fill 牌色）
D.popText = (c, s, x, y, lt, at, o = {}) => { const p = D.pop(lt, at, o.dur || 0.5); if (p <= 0) return; const a = clamp(p * 2) * (o.alpha ?? 1);
  if (o.plate) D.tag(c, s, x, y, { ...o, scale: p, alpha: a }); else D.text(c, s, x, y, { ...o, scale: p * (o.scale || 1), alpha: a }); };
// 引线标注：藏青圆头细线先画出来，末端标签牌逐字打出（约 20 字/秒）
D.callout = (c, s, ax, ay, bx, by, lt, at, o = {}) => { const { fill = C.gold, col = C.ink, size = 50 } = o; const p1 = MO.cubicOut(D.at(lt, at, 0.35)); if (p1 <= 0) return;
  c.save(); c.strokeStyle = C.ink; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1)); c.stroke();
  c.fillStyle = C.ink; c.beginPath(); c.arc(ax, ay, 10 * Math.min(1, p1 * 3), 0, TAU); c.fill(); c.restore();
  const q = D.pop(lt, at + 0.3, 0.45); if (q <= 0) return; const shown = TY.typed(s, D.at(lt, at + 0.3, [...s].length / 20));
  c.save(); c.font = `${size}px "PuHui-Heavy"`; const w = c.measureText(s).width + size * 1.6, h = size * 1.6; c.translate(bx, by); c.scale(q, q);
  c.fillStyle = 'rgba(34,35,35,.3)'; c.fill(D.round(-w / 2, -h / 2 + 9, w, h, h / 2)); c.fillStyle = fill; c.fill(D.round(-w / 2, -h / 2, w, h, h / 2)); c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke(D.round(-w / 2, -h / 2, w, h, h / 2));
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(shown, -w / 2 + size * 0.8, 3); c.restore(); };
})();

// ---------- 人：正常比例的扁平插画人（姿势库＋混合＋阻尼二次动作） ----------
// D.person(c, x, y, s, o) —— (x,y) 是两脚中点（地面），s=1 时身高约 560px。返回屏幕坐标锚点 {head, top, handL, handR, chest}，好放情绪符号/思考泡。
// o: { pose 姿势名, to 混向的姿势, mix 0..1, mood 表情, t 全片时间（呼吸）, react 发生动作的时刻（头/发髻阻尼晃）, walk 走路相位（弧度）,
//      dir 1 朝右 -1 朝左（只影响看向）, look -1..1 眼睛偏, top/bottom/hair/skin/shoe 颜色, hairStyle 'short'|'bun'|'long'|'bob', alpha, grain }
// pose：stand 站 / think 托腮 / shrug 摊手 / cheer 举双手 / slump 垂头 / point 指向 / hug 抱臂 / wave 挥手 / heart 捂胸 / facepalm 扶额 / open 张开双臂 / walk 走
// mood：calm 平静 / happy 开心（∩眼） / sad 难过 / shock 惊 / worry 担心 / closed 闭眼安宁 / angry 生气 / none 不画五官
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
const lumi2 = 0;
const POSE = {
  stand: { L: [-80, -178], R: [80, -178], sh: 0, hd: [0, 0], tilt: 0, lean: 0 },
  walk: { L: [-74, -182], R: [74, -182], sh: 0, hd: [0, 0], tilt: 0, lean: 0.03 },
  think: { L: [30, -296], R: [34, -414], sh: 0, hd: [6, 6], tilt: 0.14, lean: 0, ew: 3 },   // ew：肘「往下」的权重（托腮要肘朝下，不然小臂横过脸）
  shrug: { L: [-182, -338], R: [182, -338], sh: -16, hd: [0, 6], tilt: -0.12, lean: 0 },
  cheer: { L: [-150, -606], R: [150, -606], sh: -8, hd: [0, -6], tilt: 0, lean: 0 },
  slump: { L: [-44, -186], R: [44, -186], sh: 18, hd: [0, 30], tilt: 0.2, lean: 0.06 },
  point: { L: [-76, -180], R: [252, -420], sh: 0, hd: [8, 0], tilt: -0.06, lean: 0 },
  hug: { L: [56, -330], R: [-56, -316], sh: 8, hd: [0, 12], tilt: 0.08, lean: 0 },
  wave: { L: [-80, -178], R: [168, -566], sh: 0, hd: [0, 0], tilt: -0.1, lean: 0 },
  heart: { L: [-16, -336], R: [16, -326], sh: 0, hd: [0, 6], tilt: 0.1, lean: 0 },
  facepalm: { L: [40, -292], R: [10, -452], sh: 8, hd: [0, 16], tilt: 0.22, lean: 0.03 },
  open: { L: [-226, -400], R: [226, -400], sh: -4, hd: [0, -4], tilt: 0, lean: 0 },
  touch: { L: [-60, -176], R: [214, -352], sh: 0, hd: [8, 8], tilt: 0.1, lean: 0.1, ew: 1.2 },   // 坐着，手伸向旁边那个人的背（配 flip 朝左）
  cup: { L: [34, -300], R: [60, -286], sh: 6, hd: [0, 6], tilt: 0.05, lean: 0.02, ew: 1 },
};
D.POSES = Object.keys(POSE);
const mixP = (a, b, k) => { const A = POSE[a] || POSE.stand, B = POSE[b] || A; const L = (u, v) => lerp(u, v, k);
  return { L: [L(A.L[0], B.L[0]), L(A.L[1], B.L[1])], R: [L(A.R[0], B.R[0]), L(A.R[1], B.R[1])], sh: L(A.sh, B.sh), hd: [L(A.hd[0], B.hd[0]), L(A.hd[1], B.hd[1])], tilt: L(A.tilt, B.tilt), lean: L(A.lean, B.lean), ew: L(A.ew ?? 0.6, B.ew ?? 0.6) }; };
// 二骨 IK，肘的方向取「更往外、更往下」那一解（不会翻到身体里）
const ik = (S, T, a, b, out, ew = 0.6) => { let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-3; d = Math.min(d, a + b - 0.5); const ang = Math.atan2(dy, dx);
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), al = Math.acos(ca);
  const E1 = [S[0] + Math.cos(ang + al) * a, S[1] + Math.sin(ang + al) * a], E2 = [S[0] + Math.cos(ang - al) * a, S[1] + Math.sin(ang - al) * a];
  const sc = E => E[0] * out + E[1] * ew; const E = sc(E1) >= sc(E2) ? E1 : E2; const k = d / Math.hypot(T[0] - S[0], T[1] - S[1]) || 1;
  return { E, Hn: [S[0] + (T[0] - S[0]) * Math.min(1, k), S[1] + (T[1] - S[1]) * Math.min(1, k)] }; };
D.person = (c, x, y, s = 1, o = {}) => {
  const { pose = 'stand', to = null, mix = 0, mood = 'calm', t = 0, react = -1e9, walk = null, dir = 1, look = 0, alpha = 1, sit = false, flip = false,
    top = C.coral, bottom = C.ink2, hair = C.hair, skin = C.skin, shoe = C.white, hairStyle = 'short' } = o;
  const Q = mixP(pose, to || pose, MO.cubicInOut(clamp(mix)));
  const br = Math.sin(t * 2.6) * 2.5, wob = D.damped(t, react, 0.09, 0.42, 0.36), bounce = D.damped(t, react, 10, 0.42, 0.3);
  const shY = Q.sh + br + bounce * 0.4, [skB] = D.tone(skin);
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.scale(s, s); if (flip) c.scale(-1, 1); const sitDy = sit ? 86 : 0;
  // 颗粒只叠在衣服、头发、鞋上（逐件叠：部件各自有旋转，合成一个 Path2D 再 clip 会错位）；皮肤不叠，脸保持干净
  const fill = (p, col, so = {}) => D.flat(c, p, col, { ...so });
  // 腿（走路：两腿相位相反，抬脚）
  const sw = walk == null ? 0 : Math.sin(walk), lift = walk == null ? [0, 0] : [Math.max(0, Math.cos(walk)) * 16, Math.max(0, -Math.cos(walk)) * 16];
  [[-30, -1], [30, 1]].forEach(([hx, side], i) => {
    if (sit) { const hp = [hx * 0.7, -150], kn = [hx * 0.7 + dir * (118 - i * 14), -166], ft = [kn[0] + dir * 6, -20];
      fill(RIG.taper(hp, kn, 54, 46, 2), bottom, { dx: 8, dy: 0 }); fill(RIG.taper(kn, ft, 46, 38, 2), bottom, { dx: 6, dy: 0 }); fill(D.ellipse(ft[0] + 12 * dir, ft[1] + 2, 36, 17), shoe, { dx: 0, dy: 6 }); return; }
    const fx = hx * 1.15 + (walk == null ? 0 : (i ? -sw : sw) * 44), fy = -18 - lift[i];
    fill(RIG.taper([hx, -238], [fx, fy], 54, 40, 2), bottom, { dx: 8, dy: 0 });
    fill(D.ellipse(fx + 10 * dir, fy + 4, 34, 17), shoe, { dx: 0, dy: 6 }); });
  c.translate(0, sitDy);
  // 上身绕胯点前倾
  c.translate(0, -236); c.rotate(Q.lean * dir); c.translate(0, 236);
  fill(D.round(-62, -262, 124, 52, 14), bottom, { dx: 8, dy: 0 });
  const torso = D.smooth([[-50, -398 + shY], [50, -398 + shY], [76, -372 + shY], [68, -300], [62, -236], [-62, -236], [-68, -300], [-76, -372 + shY]]);
  fill(torso, top, { dx: 16, dy: 0, light: [-30, -330], lw: 40 });
  fill(D.round(-15, -424 + shY, 30, 36, 8), D.tone(skin)[1], { dx: 0, dy: 0, skin: true });
  // 头（绕颈点倾斜＋阻尼晃）
  c.save(); c.translate(Q.hd[0] * dir, Q.hd[1] + shY); c.translate(0, -418); c.rotate((Q.tilt + wob) * dir); c.translate(0, 418);
  const hc = [0, -472];
  if (hairStyle === 'long') fill(D.round(-60, -508, 120, 132, [50, 50, 22, 22]), hair, { dx: 10, dy: 0 });
  if (hairStyle === 'bob') fill(D.round(-62, -516, 124, 96, [56, 56, 26, 26]), hair, { dx: 10, dy: 0 });
  if (hairStyle === 'bun') { c.save(); c.translate(0, -536); c.rotate(wob * 1.8); fill(D.circle(0, 0, 25), hair, { dx: 6, dy: 0 }); c.restore(); }
  fill(D.ellipse(hc[0], hc[1], 50, 57), skin, { dx: 10, dy: 0, skin: true });
  const fr = D.smooth([[-53, -462], [-57, -502], [-32, -530], [8, -536], [44, -520], [57, -486], [54, -458], [40, -484], [10, -496], [-18, -490], [-40, -474]]);
  if (hairStyle !== 'none') fill(fr, hair, { dx: 8, dy: 0 });
  // 脸：大眼白＋小点瞳孔＋眼睑/眉/嘴，圆鼻
  const lx = look * 8 + (dir < 0 ? -4 : 4), ey = -470;
  if (mood !== 'none') {
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = C.ink;
    const happy = mood === 'happy', shut = mood === 'closed', sad = mood === 'sad' || mood === 'worry', ang = mood === 'angry', shock = mood === 'shock', er = shock ? 19 : 16;
    [-21, 21].forEach(e0 => { const ex = e0 + lx;
      if (happy || shut) { c.lineWidth = 4.6; c.beginPath(); c.arc(ex, ey + (happy ? 5 : -3), 10, happy ? 1.15 * Math.PI : 0.15 * Math.PI, happy ? 1.85 * Math.PI : 0.85 * Math.PI); c.stroke(); return; }
      c.beginPath(); c.ellipse(ex, ey, er, er * 1.05, 0, 0, TAU); c.fillStyle = C.white; c.fill(); c.lineWidth = 3.6; c.stroke();
      c.fillStyle = C.ink; c.beginPath(); c.arc(ex + look * 4 + (dir < 0 ? -3 : 3), ey + (sad ? 6 : 0), shock ? 3.4 : 5.4, 0, TAU); c.fill();
      if (sad || ang) { c.save(); c.beginPath(); c.ellipse(ex, ey, er, er * 1.05, 0, 0, TAU); c.clip(); c.fillStyle = skin; c.fillRect(ex - er - 2, ey - er - 2, 2 * er + 4, er * (sad ? 0.75 : 0.9)); c.restore();
        c.lineWidth = 3.6; c.beginPath(); c.moveTo(ex - er, ey - er * 0.3); c.lineTo(ex + er, ey - er * 0.3); c.stroke(); } });
    const brow = (bx, a) => { c.save(); c.translate(bx + lx, ey - 26); c.rotate(a); c.lineWidth = 5; c.beginPath(); c.moveTo(-11, 0); c.lineTo(11, 0); c.stroke(); c.restore(); };
    if (sad) { brow(-21, -0.32); brow(21, 0.32); } else if (ang) { brow(-21, 0.4); brow(21, -0.4); } else if (shock) { brow(-21, -0.08); brow(21, 0.08); } else brow(-21, 0), brow(21, 0);
    c.fillStyle = D.tone(skin)[1]; c.lineWidth = 3.2; c.beginPath(); c.ellipse(lx, ey + 24, 6, 7, 0, 0, TAU); c.fill(); c.stroke();
    const mx = lx, my = -434; c.lineWidth = 4.2; c.beginPath();
    if (happy) { c.arc(mx, my - 8, 14, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke(); }
    else if (mood === 'calm' || shut) { c.moveTo(mx - 10, my); c.quadraticCurveTo(mx, my + 4, mx + 10, my - 1); c.stroke(); }
    else if (mood === 'sad' || ang) { c.arc(mx, my + 8, 10, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke(); }
    else if (shock) { c.fillStyle = '#7A3B2E'; c.ellipse(mx, my, 8, 11, 0, 0, TAU); c.fill(); c.stroke(); }
    else if (mood === 'worry') { c.moveTo(mx - 11, my); c.quadraticCurveTo(mx - 5, my - 6, mx, my); c.quadraticCurveTo(mx + 5, my + 6, mx + 11, my); c.stroke(); }
    if (mood === 'sad') { const k = (t * 0.7) % 1; c.fillStyle = C.tear; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-21 + lx, ey + 18 + k * 36 - 12); c.quadraticCurveTo(-21 + lx + 8, ey + 18 + k * 36 + 6, -21 + lx, ey + 18 + k * 36 + 9); c.quadraticCurveTo(-21 + lx - 8, ey + 18 + k * 36 + 6, -21 + lx, ey + 18 + k * 36 - 12); c.fill(); c.stroke(); }
  }
  c.restore();
  // 手臂（长袖，盖在身体前面）＋手
  const arms = [];
  const armT = [D.tone(top)[1], D.shade(D.tone(top)[1], 0.18), top];   // 袖子比身体深一档：手臂横过胸前也看得出来
  const mk = MO.cubicInOut(clamp(mix)), waveW = (pose === 'wave' ? 1 - (to ? mk : 0) : 0) + (to === 'wave' ? mk : 0);
  [[Q.L, -1], [Q.R, 1]].forEach(([T, side]) => { const tg = [T[0], T[1]];
    if (walk != null) tg[0] += side * Math.sin(walk) * 38;                       // 走路：手臂和同侧腿反向摆
    if (side > 0 && waveW > 0) tg[0] += Math.sin(t * 9) * 26 * waveW;            // 挥手
    const S = [side * 64, -384 + shY], { E, Hn } = ik(S, tg, 122, 120, side, side > 0 ? Q.ew : 0.6);
    fill(RIG.taper(S, E, 44, 36, 4), top, { dx: 6, dy: 4, tone: armT }); fill(RIG.taper(E, Hn, 36, 30, 2), top, { dx: 6, dy: 4, tone: armT });
    fill(D.circle(Hn[0], Hn[1], 18), skin, { dx: 4, dy: 3, skin: true }); arms.push(Hn); });
  c.restore();
  const tr = (px, py) => [x + (flip ? -px : px) * s, y + (py + sitDy) * s];
  return { head: tr(Q.hd[0] * dir, -472 + Q.hd[1] + shY), top: tr(Q.hd[0] * dir, -545 + Q.hd[1] + shY), handL: tr(...arms[0]), handR: tr(...arms[1]), chest: tr(0, -330), feet: [x, y] };
};
// 小人图标（人群、选民、统计）：圆头＋圆肩身体，纯色块＋深一档月牙；o.mood 给个点眼可选
D.mini = (c, x, y, s, col = C.coral, o = {}) => { const { alpha = 1, head = C.skin, hop = 0 } = o; c.save(); c.globalAlpha *= alpha; c.translate(x, y - hop); c.scale(s, s);
  D.flat(c, D.round(-34, -70, 68, 70, [32, 32, 6, 6]), col, { dx: 8, dy: 0, grain: 0.4 }); D.flat(c, D.circle(0, -96, 24), head, { dx: 5, dy: 0, grain: 0 });
  if (o.hair) D.flat(c, D.smooth([[-25, -100], [-22, -118], [0, -124], [22, -118], [25, -100], [12, -110], [-12, -110]]), o.hair, { dx: 3, dy: 0, grain: 0 });
  c.restore(); };
// 人群：cols×rows 网格，颜色按种子取；o.hi 高亮的序号数组（变珊瑚色并跳一下，o.hiAt 起跳时刻配 o.lt），o.dim 其余变淡
D.crowd = (c, cx, y, cols, rows, gap, s, o = {}) => { const { seed = 3, hi = [], hiCol = C.coral, lt = 0, hiAt = 0, dim = 0, pal = [C.ink2, C.green, C.gold, C.lavDot, C.greenLt, C.mintDot], appear = null } = o;
  for (let r = rows - 1; r >= 0; r--) for (let k = 0; k < cols; k++) { const i = r * cols + k, isH = hi.includes(i), x = cx + (k - (cols - 1) / 2) * gap + (r % 2) * gap * 0.25, yy = y - r * gap * 0.74;
    const a = appear == null ? 1 : D.pop(lt, appear + i * 0.03, 0.4); if (a <= 0) continue;
    const col0 = pal[Math.floor(U.hash(i, seed) * pal.length)], col = isH ? hiCol : dim ? D.mixHex(col0, C.paper2, dim * 0.6) : col0, hop = isH ? Math.max(0, -D.damped(lt, hiAt, 26, 0.5, 0.45)) + (lt >= hiAt ? 6 : 0) : 0;
    const head = [C.skin, C.skin2, '#F1C1A1'][Math.floor(U.hash(i, seed + 9) * 3)];
    D.mini(c, x, yy, s * a, col, { head: !isH && dim ? D.mixHex(head, C.paper2, dim * 0.5) : head, hop, hair: U.hash(i, seed + 5) < 0.7 ? C.hair : C.hair2 }); } };
})();

// ---------- 情绪与思绪：思考泡、对话泡、情绪符号 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
// 思考泡：一串小圆从 (fx,fy) 冒到 (x,y)，再弹出一朵白云；o.text 字，o.draw(c) 在云中心坐标画内容
D.thought = (c, x, y, w, h, lt, at, o = {}) => { const { fx = x - w * 0.4, fy = y + h * 0.9, fill = C.white, text = '', size = 56, col = C.ink } = o;
  [0, 1, 2].forEach(i => { const p = D.pop(lt, at + i * 0.12, 0.35); if (p <= 0) return; const k = (i + 1) / 4, r = (10 + i * 8) * p;
    c.fillStyle = fill; c.beginPath(); c.arc(lerp(fx, x - w * 0.25, k), lerp(fy, y + h * 0.45, k), r, 0, TAU); c.fill(); });
  const p = D.pop(lt, at + 0.36, 0.5); if (p <= 0) return;
  c.save(); c.translate(x, y); c.scale(p, p);
  const cloud = D.once(`f26cloud${w}_${h}`, () => { const q = new Path2D(), n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU, e = new Path2D(); e.arc(Math.cos(a) * w * 0.4, Math.sin(a) * h * 0.36, Math.min(w, h) * (0.26 + 0.06 * U.hash(i, 4)), 0, TAU); q.addPath(e); } const m = new Path2D(); m.ellipse(0, 0, w * 0.42, h * 0.38, 0, 0, TAU); q.addPath(m); return q; });
  c.fillStyle = 'rgba(38,42,92,.12)'; c.save(); c.translate(0, 10); c.fill(cloud); c.restore(); c.fillStyle = fill; c.fill(cloud);
  if (text) D.text(c, TY.typed(text, D.at(lt, at + 0.5, [...text].length / 18)), 0, 2, { size, fam: 'PuHui-Heavy', col, maxW: w * 0.85 });
  if (o.draw) o.draw(c, lt, p);
  c.restore(); };
// 对话泡：圆角牌＋小尾巴指向 (tx,ty)，字逐字打出
D.speech = (c, s, x, y, lt, at, o = {}) => { const { tx = x - 80, ty = y + 120, size = 52, fill = C.white, col = C.ink, fam = 'PuHui-Heavy' } = o; const p = D.pop(lt, at, 0.45); if (p <= 0) return;
  c.save(); c.font = `${size}px "${fam}"`; const w = c.measureText(s).width + size * 1.4, h = size * 1.9; c.translate(x, y); c.scale(p, p);
  const tail = new Path2D(); tail.moveTo(-w * 0.12, h * 0.3); tail.lineTo((tx - x) / p, (ty - y) / p); tail.lineTo(w * 0.1, h * 0.3); tail.closePath();
  c.fillStyle = 'rgba(34,35,35,.3)'; c.save(); c.translate(0, 9); c.fill(D.round(-w / 2, -h / 2, w, h, size * 0.6)); c.restore();
  c.fillStyle = fill; c.fill(D.round(-w / 2, -h / 2, w, h, size * 0.6)); c.fill(tail); c.lineWidth = 5; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.stroke(D.round(-w / 2, -h / 2, w, h, size * 0.6));
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(TY.typed(s, D.at(lt, at + 0.15, [...s].length / 18)), 0, 3); c.restore(); };
// 情绪符号：kind = spark 紧张线 | heart 心 | sweat 汗滴 | question 问号 | exclaim 叹号 | zzz 困 | scribble 乱线团（焦虑） | rain 头顶小雨云 | sparkle 闪星 | bulb 灵光
// (x,y) 一般放在 person 返回的 top 旁边；s 大小；lt/at 出现时刻；o.t 全片时间（循环小动）
D.emote = (c, kind, x, y, s, lt, at, o = {}) => { const p = D.pop(lt, at, 0.4); if (p <= 0) return; const { col, t = lt } = o, L = lt - at;
  c.save(); c.translate(x, y); c.scale(s * p, s * p); c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'spark') { const jit = (U.hash(Math.floor(t * 15), 3) - 0.5) * 4; c.strokeStyle = col || C.coral; c.lineWidth = 9;
    [-0.75, -0.25, 0.25].forEach((a, i) => { const r0 = 26, r1 = 26 + 40 * MO.backOut(clamp(L / 0.25 - i * 0.2), 2); c.beginPath(); c.moveTo(Math.sin(a) * r0 + jit, -Math.cos(a) * r0); c.lineTo(Math.sin(a) * r1 + jit, -Math.cos(a) * r1); c.stroke(); }); }
  else if (kind === 'heart') { const b = 1 + 0.08 * Math.max(0, Math.sin(t * 7)); c.translate(0, -Math.min(30, L * 20)); c.scale(b, b); D.flat(c, D.heartPath(), col || C.coral, { dx: 8, dy: 4, grain: 0.4 }); }
  else if (kind === 'sweat') { c.translate(0, Math.min(16, L * 18)); const q = new Path2D(); q.moveTo(0, -30); q.bezierCurveTo(16, -8, 20, 6, 0, 18); q.bezierCurveTo(-20, 6, -16, -8, 0, -30); D.flat(c, q, col || C.sky, { dx: 5, dy: 3, grain: 0 }); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-6, 2, 4, 0, TAU); c.fill(); }
  else if (kind === 'question' || kind === 'exclaim') { const r = Math.sin(t * 3) * 0.12; c.rotate(r); D.text(c, kind === 'question' ? '?' : '!', 0, 0, { size: 110, fam: 'PuHui-Black', col: col || C.gold }); }
  else if (kind === 'zzz') { [0, 1, 2].forEach(i => { const k = ((t * 0.6 + i / 3) % 1); D.text(c, 'Z', i * 26 + k * 20, -k * 70, { size: 40 + i * 12, fam: 'PuHui-Black', col: col || C.ink2, alpha: 1 - k * 0.6 }); }); }
  else if (kind === 'scribble') { const n = Math.floor(clamp(L / 0.6) * 60); c.strokeStyle = col || C.ink; c.lineWidth = 6; c.beginPath();
    for (let i = 0; i <= n; i++) { const a = i * 0.55, r = 22 + 14 * Math.sin(i * 0.37) + (U.hash(i, 8) - 0.5) * 8, xx = Math.cos(a) * r * 1.3 + Math.sin(i * 0.11) * 14, yy = Math.sin(a) * r * 0.8; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
  else if (kind === 'rain') { c.fillStyle = col || C.ink2; [[-26, 0, 24], [0, -14, 30], [28, 0, 22]].forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r, 0, TAU); c.fill(); }); c.fill(D.round(-48, -4, 96, 26, 13));
    c.strokeStyle = C.sky; c.lineWidth = 6; for (let i = 0; i < 4; i++) { const k = (t * 1.6 + i * 0.27) % 1, xx = -33 + i * 22; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(xx, 34 + k * 60); c.lineTo(xx - 5, 50 + k * 60); c.stroke(); } c.globalAlpha = 1; }
  else if (kind === 'sparkle') { c.fillStyle = col || C.gold; [[0, 0, 1], [46, -30, 0.55], [-40, -36, 0.45]].forEach(([a, b, k], i) => { const tw = 0.75 + 0.25 * Math.sin(t * 6 + i * 2); c.save(); c.translate(a, b); c.scale(k * tw, k * tw); c.beginPath(); for (let j = 0; j < 8; j++) { const r = j % 2 ? 9 : 34, an = j / 8 * TAU; c.lineTo(Math.sin(an) * r, -Math.cos(an) * r); } c.closePath(); c.fill(); c.restore(); }); }
  else if (kind === 'bulb') { D.bulb(c, 0, 0, 1, { on: 1, t }); }
  c.restore(); };
D.heartPath = () => D.once('f26heart', () => { const q = new Path2D(); q.moveTo(0, 30); q.bezierCurveTo(-60, -6, -40, -52, 0, -26); q.bezierCurveTo(40, -52, 60, -6, 0, 30); q.closePath(); return q; });
// 三色同心环（配方签名，也当强调光圈）：从中心一圈圈弹开
D.rings = (c, x, y, r, lt, at, o = {}) => { const cols = o.cols || [C.gold, C.coral, C.mint]; c.save(); c.lineWidth = o.lw || 18;
  cols.forEach((col, i) => { const p = MO.cubicOut(D.at(lt, at + i * 0.1, 0.6)); if (p <= 0) return; c.strokeStyle = col; c.globalAlpha = (o.alpha ?? 1) * (o.fade ? 1 - D.at(lt, at + 0.8, 0.6) : 1); c.beginPath(); c.arc(x, y, r * (0.55 + 0.45 * p) + i * (c.lineWidth + 8), 0, TAU); c.stroke(); });
  c.restore(); };
})();

// ---------- 图示：箭头、柱状、比例条、时间轴 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
// 粗圆头弯箭头，p 0..1 画出进度；bend 弯曲（正数往左手边鼓）
D.arrow = (c, x0, y0, x1, y1, p = 1, o = {}) => { const { col = C.ink, w = 14, bend = 0.18, head = 36, dash = null } = o; if (p <= 0) return;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -(y1 - y0), ny = x1 - x0, cx = mx + nx * bend, cy = my + ny * bend;
  const pt = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
  const n = 40, end = Math.max(0.02, p); c.beginPath(); for (let i = 0; i <= n; i++) { const [a, b] = pt(end * i / n * 0.97); i ? c.lineTo(a, b) : c.moveTo(a, b); } c.stroke(); c.setLineDash([]);
  const [ex, ey] = pt(end), [px, py] = pt(Math.max(0, end - 0.04)), an = Math.atan2(ey - py, ex - px);
  c.translate(ex, ey); c.rotate(an); c.beginPath(); c.moveTo(4, 0); c.lineTo(-head, -head * 0.62); c.quadraticCurveTo(-head * 0.7, 0, -head, head * 0.62); c.closePath(); c.fill(); c.restore(); };
// 柱状图（示意）：vals 0..1，labels 下方字，p 长高进度；柱子带点彩、顶端圆角；o.hi 高亮第几根
D.bars = (c, x, y, w, h, vals, p, o = {}) => { const { labels = [], cols = null, hi = -1, gapK = 0.35, note = '示意', seed = 5 } = o, n = vals.length, bw = w / (n + (n - 1) * gapK);
  c.fillStyle = C.ink; c.fill(D.round(x - 16, y, w + 32, 8, 4));
  vals.forEach((v, i) => { const q = MO.cubicOut(clamp(p * 1.3 - i * 0.12)), bh = h * v * q, bx = x + i * bw * (1 + gapK); if (bh > 2) {
    const col = cols ? cols[i] : i === hi ? C.coral : [C.gold, C.green, C.ink2, C.lavDot][i % 4], path = D.round(bx, y - bh, bw, bh, [Math.min(18, bw / 3), Math.min(18, bw / 3), 0, 0]);
    D.flat(c, path, col, { dx: 10, dy: 0, grain: 0.5 }); }
    if (labels[i]) D.text(c, labels[i], bx + bw / 2, y + 50, { size: 44, fam: 'PuHui-Heavy', maxW: bw * 1.3, alpha: clamp(p * 3) }); });
  if (note) D.tag(c, note, x + w - 40, y - h - 10, { size: 34, fill: C.paper2, shadow: false, alpha: clamp(p * 3) }); };
// 比例条（分成几段的一根横条）：parts [[份额, 色, 标签]]，p 进度
D.split = (c, x, y, w, h, parts, p, o = {}) => { let acc = 0; const tot = parts.reduce((a, q) => a + q[0], 0);
  c.save(); c.clip(D.round(x, y - h / 2, w * MO.cubicOut(clamp(p)), h, h / 2));
  parts.forEach(([v, col, lab]) => { const ww = w * v / tot; c.fillStyle = col; c.fillRect(x + acc, y - h / 2, ww + 1, h); acc += ww; }); c.restore();
  acc = 0; parts.forEach(([v, col, lab]) => { const ww = w * v / tot; if (lab && p > 0.6) D.text(c, lab, x + acc + ww / 2, y + h / 2 + 46, { size: 44, fam: 'PuHui-Heavy', alpha: D.at(p, 0.6, 0.3), maxW: Math.max(ww, 120) }); acc += ww; }); };
// 时间轴：横线＋圆点站，cur 当前站高亮；labels 站名（年份/事件）
D.timeline = (c, x0, x1, y, labels, cur = -1, p = 1, o = {}) => { const n = labels.length, X = i => lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5);
  c.strokeStyle = C.ink; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y); c.lineTo(lerp(x0, x1, MO.cubicOut(clamp(p))), y); c.stroke();
  labels.forEach((s, i) => { const q = clamp(p * n - i); if (q <= 0) return; const on = i === cur;
    D.flat(c, D.circle(X(i), y, (on ? 26 : 16) * MO.backOut(q, 1.6)), on ? C.coral : C.gold, { dx: 5, dy: 0, grain: 0 });
    D.text(c, s, X(i), y + (i % 2 ? -66 : 70), { size: on ? 50 : 44, fam: 'PuHui-Heavy', col: on ? C.coralDk : C.ink, alpha: q, maxW: (x1 - x0) / Math.max(1, n - 1) * 1.6 }); }); };
})();

// ---------- 道具：植物、选票箱、书、手机、杯子、灯泡、天平、时钟、太阳、大脑、心、窗 ----------
(() => { const D = K, C = D.C, { TAU } = D, { clamp, lerp } = U;
const tf = (c, x, y, s, rot, fn) => { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s, s); fn(); c.restore(); };
// 盆栽：ang 让叶子绕盆口摆（配 D.damped 做「被碰了一下」）；(x,y) 盆底中心
D.plant = (c, x, y, s = 1, ang = 0, o = {}) => tf(c, x, y, s, 0, () => { const pot = o.pot || C.coral;
  c.save(); c.translate(0, -110); c.rotate(ang);
  [[-46, -190, 22, C.green], [52, -170, 20, C.greenLt], [-10, -250, 24, C.greenDk], [20, -215, 20, C.green], [-70, -110, 16, C.greenLt]].forEach(([tx, ty, w, col], i) => {
    const sw = Math.sin(i * 1.7) * 0.02 + ang * (0.5 + i * 0.3), q = new Path2D(); q.moveTo(-w, 0); q.quadraticCurveTo(-w * 0.6 + tx * 0.3, ty / 2, tx, ty); q.quadraticCurveTo(w * 0.8 + tx * 0.3, ty / 2, w, 0); q.closePath();
    c.save(); c.rotate(sw); D.flat(c, q, col, { dx: 6, dy: 0, grain: 0.35 }); c.restore(); });
  c.restore();
  const p = new Path2D(); p.moveTo(-72, -112); p.lineTo(72, -112); p.lineTo(62, -16); p.quadraticCurveTo(60, 0, 40, 0); p.lineTo(-40, 0); p.quadraticCurveTo(-60, 0, -62, -16); p.closePath();
  D.flat(c, p, pot, { dx: 12, dy: 0, grain: 0.5 }); c.fillStyle = C.white; c.fillRect(-70, -92, 140, 16); });
// 选票箱：slip 0..1 选票从上方滑进投票口；mark 选票上打勾进度
D.ballotBox = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const { slip = 0, col = C.ink, mark = 1 } = o;
  if (slip < 1) { const yy = lerp(-430, -230, slip * slip); c.save(); c.beginPath(); c.rect(-200, -700, 400, 470); c.clip(); c.translate(0, yy); c.rotate(-0.06 * (1 - slip));
    D.flat(c, D.round(-70, -100, 140, 170, 10), C.white, { dx: 0, dy: 8, grain: 0.3 }); c.strokeStyle = C.coral; c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round';
    if (mark > 0) { c.beginPath(); c.moveTo(-30, -14); c.lineTo(-6, 14); c.lineTo(lerp(-6, 36, clamp(mark)), lerp(14, -36, clamp(mark))); c.stroke(); } c.restore(); }
  D.flat(c, D.round(-190, -230, 380, 230, 18), col, { dx: 18, dy: 0, light: [-130, -150], lw: 30, grain: 0.5 });
  c.fillStyle = C.gold; c.fill(D.round(-150, -262, 300, 40, 12)); c.fillStyle = '#1A1D45'; c.fill(D.round(-90, -248, 180, 14, 7));
  D.flat(c, D.circle(0, -120, 40), C.white, { dx: 0, dy: 0, grain: 0 }); c.fillStyle = C.coral; c.beginPath(); c.moveTo(0, -96); c.bezierCurveTo(-36, -118, -24, -146, 0, -130); c.bezierCurveTo(24, -146, 36, -118, 0, -96); c.fill(); });
// 书：open 0 合上（封面）→ 1 摊开；col 封面色；(x,y) 书底中心
D.book = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const { open = 0, col = C.green, title = '' } = o, k = MO.cubicInOut(clamp(open));
  if (k < 0.5) { const sx = 1 - k * 2; c.save(); c.scale(Math.max(0.05, sx), 1); D.flat(c, D.round(-110, -300, 220, 300, [6, 16, 16, 6]), col, { dx: 14, dy: 0, light: [-40, -200], lw: 26, grain: 0.5 });
    c.fillStyle = C.white; c.fillRect(-110, -300, 16, 300); if (title) D.text(c, title, 10, -170, { size: 44, fam: 'PuHui-Black', col: C.white, maxW: 170 }); c.restore(); }
  else { const q = (k - 0.5) * 2; D.flat(c, D.round(-250 * q - 12, -296, 500 * q + 24, 300, 14), col, { dx: 0, dy: 8, grain: 0.3 });
    [-1, 1].forEach(sd => { const pg = new Path2D(); pg.moveTo(0, -270); pg.quadraticCurveTo(sd * 120 * q, -300, sd * 236 * q, -282); pg.lineTo(sd * 236 * q, -12); pg.quadraticCurveTo(sd * 120 * q, -30, 0, -6); pg.closePath(); D.flat(c, pg, C.white, { dx: -sd * 8, dy: 0, grain: 0.25 });
      c.fillStyle = 'rgba(38,42,92,.22)'; for (let i = 0; i < 6; i++) { const yy = -236 + i * 34, x0 = sd * 34 * q, x1 = sd * (200 - (i * 37) % 60) * q; c.fillRect(Math.min(x0, x1), yy, Math.abs(x1 - x0), 9); } }); } });
// 手机：screen(c) 在屏幕坐标（-80..80, -160..160）画内容；buzz 震动时刻配 o.t
D.phone = (c, x, y, s = 1, o = {}) => { const jit = o.buzz != null && o.t != null && o.t - o.buzz > 0 && o.t - o.buzz < 0.6 ? Math.sin((o.t - o.buzz) * 80) * 6 : 0;
  tf(c, x + jit, y, s, o.rot || 0, () => { D.flat(c, D.round(-96, -190, 192, 380, 30), C.ink, { dx: 12, dy: 0, grain: 0.4 }); c.fillStyle = o.lit ? C.white : '#3B3F72'; c.fill(D.round(-80, -168, 160, 336, 18));
    if (o.screen) { c.save(); c.clip(D.round(-80, -168, 160, 336, 18)); o.screen(c); c.restore(); } c.fillStyle = '#1A1D45'; c.fill(D.round(-26, -182, 52, 8, 4)); }); };
// 马克杯：steam 用全片时间让热气飘
D.cup = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, o.rot || 0, () => { const col = o.col || C.coral;
  if (o.t != null) { c.strokeStyle = 'rgba(138,130,153,.55)'; c.lineWidth = 7; c.lineCap = 'round'; [-24, 10].forEach((sx, i) => { c.beginPath(); for (let k = 0; k <= 12; k++) { const yy = -150 - k * 8, xx = sx + Math.sin(k * 0.6 + o.t * 3 + i * 2) * 8; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }); }
  c.strokeStyle = D.tone(col)[1]; c.lineWidth = 16; c.beginPath(); c.arc(62, -76, 30, -1.4, 1.4); c.stroke();
  D.flat(c, D.round(-62, -140, 124, 140, [10, 10, 26, 26]), col, { dx: 12, dy: 0, light: [-30, -90], lw: 18, grain: 0.5 }); c.fillStyle = C.coffee || '#B8782F'; c.fill(D.ellipse(0, -134, 52, 8)); });
// 灯泡：on 0..1 亮起（光芒弹出）
D.bulb = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const on = clamp(o.on ?? 1), t = o.t || 0;
  if (on > 0) { c.strokeStyle = C.gold; c.lineWidth = 9; c.lineCap = 'round'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42, r0 = 66, r1 = 66 + 30 * on + Math.sin(t * 5 + k) * 3; c.beginPath(); c.moveTo(Math.cos(a) * r0, -20 + Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, -20 + Math.sin(a) * r1); c.stroke(); } }
  D.flat(c, D.circle(0, -20, 46), on > 0.5 ? C.gold : C.paper3, { dx: 8, dy: 0, grain: 0.4 }); c.fillStyle = C.ink2; c.fill(D.round(-24, 24, 48, 34, 8)); c.fillStyle = C.ink; c.fill(D.round(-16, 56, 32, 10, 5)); });
// 天平：tilt -1..1（正＝右边沉）；left/right(c) 在托盘上画东西
D.scales = (c, x, y, s = 1, o = {}) => tf(c, x, y, s, 0, () => { const a = (o.tilt || 0) * 0.32;
  D.flat(c, D.round(-12, -300, 24, 300, 12), C.ink, { dx: 6, dy: 0, grain: 0 }); D.flat(c, D.round(-90, -20, 180, 24, 12), C.ink, { dx: 0, dy: 6, grain: 0 });
  c.save(); c.translate(0, -300); c.rotate(a); c.fillStyle = C.ink; c.fill(D.round(-230, -10, 460, 20, 10));
  [-1, 1].forEach(sd => { c.save(); c.translate(sd * 220, 0); c.rotate(-a); c.strokeStyle = C.ink2; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(-70, 120); c.moveTo(0, 0); c.lineTo(70, 120); c.stroke();
    D.flat(c, D.smooth([[-90, 120], [90, 120], [60, 150], [-60, 150]]), C.gold, { dx: 0, dy: 6, grain: 0.3 }); const f = sd < 0 ? o.left : o.right; if (f) { c.translate(0, 118); f(c); } c.restore(); });
  c.restore(); D.flat(c, D.circle(0, -300, 22), C.gold, { dx: 4, dy: 0, grain: 0 }); });
// 时钟：h 小时（可带小数，走针）、spin 让分针快转（时间流逝）
D.clock = (c, x, y, r = 120, o = {}) => tf(c, x, y, 1, 0, () => { const h = o.h ?? 10.1;
  D.flat(c, D.circle(0, 0, r), o.col || C.gold, { dx: r * 0.1, dy: 0, grain: 0.5 }); c.fillStyle = C.white; c.fill(D.circle(0, 0, r * 0.8));
  c.fillStyle = C.ink; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.arc(Math.sin(a) * r * 0.66, -Math.cos(a) * r * 0.66, i % 3 ? r * 0.03 : r * 0.055, 0, TAU); c.fill(); }
  c.strokeStyle = C.ink; c.lineCap = 'round'; [[h / 12 * TAU, 0.38, 0.09], [(h % 1) * TAU, 0.58, 0.06]].forEach(([a, L, w]) => { c.lineWidth = r * w; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * r * L, -Math.cos(a) * r * L); c.stroke(); });
  c.fillStyle = C.coral; c.fill(D.circle(0, 0, r * 0.07)); });
// 太阳：点彩圆＋慢转的光芒（环境层）
D.sun = (c, x, y, r = 110, t = 0) => { c.save(); c.strokeStyle = C.gold; c.lineWidth = r * 0.08; c.lineCap = 'round';
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.35, r0 = r * 1.2, r1 = r * (1.42 + (k % 2 ? 0 : 0.1)) + Math.sin(t * 5 + k) * 3; c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); }
  c.restore(); D.disc(c, x, y, r, 'gold', { seed: 31 }); };
// 大脑（心理/认知）：粉色圆块＋几道深一档的回纹；glow 0..1 某一区亮起（金色斑）
D.brain = (c, x, y, r = 160, o = {}) => tf(c, x, y, r / 160, 0, () => { const p = D.once('f26brain', () => D.smooth([[-150, 10], [-140, -70], [-90, -125], [-10, -140], [70, -128], [135, -80], [155, 0], [130, 70], [60, 100], [-30, 105], [-110, 80]]));
  D.flat(c, p, o.col || C.pink, { dx: 18, dy: 6, grain: 0.5 });
  if (o.glow) { c.save(); c.clip(p); c.globalAlpha *= clamp(o.glow); c.drawImage(D.discTex('gold', 70, 41), (o.gx ?? 40) - 74, (o.gy ?? -40) - 74); c.restore(); }
  c.strokeStyle = '#E39A90'; c.lineWidth = 9; c.lineCap = 'round';
  [[[-110, -40], [-70, -80], [-30, -50]], [[-20, -100], [20, -70], [70, -95]], [[-90, 40], [-40, 10], [10, 50]], [[30, 0], [80, -30], [120, 20]], [[0, -10], [0, -10], [0, 80]]].forEach(([a, b, d]) => { c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(...b, ...d); c.stroke(); }); });
// 心（器官意义上的、情绪意义上的都可）：beat 跳动
D.heart = (c, x, y, r = 120, o = {}) => tf(c, x, y, r / 40 * (1 + 0.07 * Math.max(0, Math.sin((o.t || 0) * (o.bpm || 70) / 60 * TAU))), 0, () => D.flat(c, D.heartPath(), o.col || C.coral, { dx: 7, dy: 3, light: [-18, -16], lw: 8, grain: 0.5 }));
D.window = (c, x, y, w = 340, h = 400, o = {}) => { const t = o.t || 0, fr = D.round(x - w / 2 - 28, y - h / 2 - 28, w + 56, h + 56, 8);
  c.save(); c.fillStyle = '#E6DFC8'; c.fill(fr); c.lineWidth = 4.2; c.strokeStyle = C.ink; c.stroke(fr);
  c.save(); c.beginPath(); c.rect(x - w / 2, y - h / 2, w, h); c.clip(); c.translate(x - w / 2, y - h / 2);
  c.fillStyle = o.day ? '#A7D6EA' : C.sky; c.fillRect(0, 0, w, h); c.fillStyle = o.day ? '#8CC2D8' : '#587A91'; c.fillRect(0, h * 0.45, w, h * 0.6);
  if (!o.day) { c.fillStyle = '#DCD9C4'; c.beginPath(); c.arc(w * 0.78, h * 0.15, 30, 0, TAU); c.fill(); c.fillStyle = C.sky; c.beginPath(); c.arc(w * 0.78 + 12, h * 0.15 - 8, 30, 0, TAU); c.fill(); }
  c.fillStyle = '#8AA2B2'; c.fill(D.smooth([[w * 0.1, h * 0.28], [w * 0.3, h * 0.2], [w * 0.55, h * 0.24], [w * 0.65, h * 0.32], [w * 0.4, h * 0.36], [w * 0.15, h * 0.35]]));
  if (o.rain !== false) { c.strokeStyle = '#B8D3E2'; c.lineWidth = 3; c.lineCap = 'round'; for (let i = 0; i < 26; i++) { const k = (t * 1.2 + U.hash(i, 5)) % 1, px = U.hash(i, 6) * w, py = k * (h + 40) - 20; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 8, py + 26); c.stroke(); } }
  c.restore(); c.lineWidth = 4.2; c.strokeStyle = C.ink; c.strokeRect(x - w / 2, y - h / 2, w, h); c.beginPath(); c.moveTo(x, y - h / 2); c.lineTo(x, y + h / 2); c.moveTo(x - w / 2, y - h * 0.08); c.lineTo(x + w / 2, y - h * 0.08); c.stroke(); c.restore(); };
// 沙发（贯穿物）：(x,y)＝沙发底中心（地面），默认约 940 宽；人坐在上面用 D.person({sit:true}) 脚落在 y；seat 坐垫顶＝y-160
D.sofa = (c, x, y, s = 1, o = {}) => { const col = o.col || C.sofa; c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(34,35,35,.22)'; c.beginPath(); c.ellipse(0, 4, 500, 32, 0, 0, TAU); c.fill();
  D.flat(c, D.round(-470, -470, 940, 330, 70), col, { dx: 18, dy: 0 }); c.strokeStyle = D.shade(col, 0.3); c.lineWidth = 3; c.beginPath(); c.moveTo(0, -440); c.lineTo(0, -160); c.stroke();
  D.flat(c, D.round(-430, -190, 860, 130, 44), D.shade(col, -0.12), { dx: 10, dy: 0 });
  [-1, 1].forEach(sd => { D.flat(c, D.round(sd * 440 - 60, -300, 120, 260, 52), col, { dx: 14, dy: 0 }); D.flat(c, D.round(sd * 410 - 16, -50, 32, 50, 8), '#4B3A2A', { dx: 0, dy: 0, lineW: 3.6 }); });
  c.restore(); };
D.lamp = (c, x, y, s = 1) => { c.save(); c.translate(x, y); c.scale(s, s); D.flat(c, D.ellipse(0, -6, 44, 12), '#6A5A46', { dx: 0, dy: 4, lineW: 3.6 }); D.flat(c, D.round(-5, -350, 10, 346, 5), '#6A5A46', { dx: 0, dy: 0, lineW: 3.2 });
  D.flat(c, D.smooth([[-50, -340], [-33, -420], [33, -420], [50, -340]]), '#F0D98A', { dx: 8, dy: 0, lineW: 3.6 }); c.restore(); };
D.picture = (c, x, y, w = 230, h = 290) => { c.save(); c.translate(x, y); D.flat(c, D.round(-w / 2, -h / 2, w, h, 6), '#E6DFC8', { dx: 0, dy: 0 }); D.flat(c, D.round(-w / 2 + 22, -h / 2 + 22, w - 44, h - 44, 3), '#B9B08C', { dx: 0, dy: 0, lineW: 3 });
  D.flat(c, D.circle(0, -h * 0.1, 36), '#D9A24E', { dx: 6, dy: 0, lineW: 3 }); D.flat(c, D.smooth([[-w * 0.38, h * 0.36], [-w * 0.12, -h * 0.02], [w * 0.1, h * 0.2], [w * 0.25, -h * 0.06], [w * 0.4, h * 0.36]]), '#6F8F5C', { dx: 8, dy: 0, lineW: 3 }); c.restore(); };
C.coffee = '#B8782F';
})();

// ---------- 章节卡（每章第一镜，配口播念章名那一句） ----------
// 大色圆上砸入「第 N 章」，章名逐字出（长的拆两行）；下方 N 站进度轨，一个小人（D.cardToken）从上一站走到本站，站定时头和发髻阻尼晃一下。
// 换书时可在本书 props.js 里改 D.cardToken = (c, x, y, lt, t, walking) => {…} 画本书的贯穿物；D.CARD_TINTS 是每章轮换的色圆。
(() => { const D = K, C = D.C, { W, TAU } = D, { clamp, lerp } = U;
D.CHAPTER_NAMES = (window.BOOK_META || {}).chapters || [];   // 章名来自 book.json（assemble 写进 scenes/book/meta.js）
D.CARD_TINTS = D.CARD_TINTS || ['pink', 'mint', 'gold', 'lav'];
D.cardToken = D.cardToken || ((c, x, y, lt, t, walking, arriveAt) => D.person(c, x, y, 0.34, { pose: walking ? 'walk' : 'stand', to: walking ? null : 'wave', mix: D.at(lt, arriveAt + 0.15, 0.4), walk: walking ? lt * 11 : null, t, react: arriveAt, mood: 'happy', top: C.coral, hairStyle: 'bun', grain: 0.4 }));
D.chapterCard = (c, lt, t, n, title = '') => {
  const tint = D.CARD_TINTS[(n - 1) % D.CARD_TINTS.length];
  D.bg(c, t, { tint, cy: 700, r: 330, blob: tint === 'mint' ? 'pink' : 'mint', bx: 880, by: 1240, br: 120, seed: 900 + n, decos: 10, avoid: [[0, 500, W, 960]] });
  const N = Math.max(D.CHAPTER_NAMES.length, n, 2), x0 = 130, x1 = 950, y = 1250, X = i => lerp(x0, x1, i / (N - 1));
  c.fillStyle = C.paper3; c.fill(D.round(x0 - 30, y - 9, x1 - x0 + 60, 18, 9));
  const walkEnd = 1.15, q = MO.cubicInOut(D.at(lt, 0.15, walkEnd - 0.15)), done = X(n - 1);
  c.fillStyle = C.gold; c.fill(D.round(x0 - 30, y - 9, Math.max(18, lerp(n > 1 ? X(n - 2) : x0 - 30, done, q) - x0 + 30), 18, 9));
  for (let i = 0; i < N; i++) { const cur = i === n - 1, p = cur ? D.pop(lt, walkEnd, 0.45) : 1, past = i < n - 1;
    D.flat(c, D.circle(X(i), y, cur ? 22 * Math.max(0.6, p) : 13), past ? C.gold : cur ? C.coral : C.paper3, { dx: 4, dy: 0, grain: 0 }); }
  if (lt > walkEnd) D.rings(c, done, y, 30, lt, walkEnd, { lw: 7, fade: true, alpha: 0.8 });
  const tx = lerp(n > 1 ? X(n - 2) : x0 - 60, done, q); D.cardToken(c, tx, y - 14, lt, t, lt < walkEnd, walkEnd);
  if (lt > 0.1) { const s = MO.slamK((lt - 0.1) / 0.17); D.tag(c, `第 ${n} 章`, W / 2, 560, { size: 62, fam: 'PuHui-Black', fill: C.ink, col: C.white, scale: s }); }
  const lines = D.split2(title), all = lines.reduce((s, l) => s + [...l].length, 0), shown = Math.round(D.at(lt, 0.45, Math.max(0.3, all / 14)) * all), size = lines.length > 1 ? 88 : all > 7 ? 104 : 124;
  let used = 0; lines.forEach((ln, i) => { const a = [...ln], k = clamp(shown - used, 0, a.length); used += a.length;
    if (k > 0) D.text(c, a.slice(0, k).join(''), W / 2, (lines.length > 1 ? 730 : 790) + i * size * 1.25, { size, fam: 'PuHui-Black', maxW: 900 }); });
  D.finish(c);
};
})();
// 字幕（assemble 生成的 subs.js 调它）：藏青底板＋米白字，字幕带 y≈1480，让开视频号底栏
(() => { const D = K;
D.subtitle = (c, text, a) => {
  c.save(); c.globalAlpha = a; c.font = '52px "PuHui-Bold"'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = Math.min(1040, c.measureText(text).width + 68), h = 90, x = 540, y = 1480;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2 + 7, w, h, 24); c.fill();
  c.fillStyle = 'rgba(34,35,35,.94)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 24); c.fill();
  c.fillStyle = '#F6E7A3'; c.fillText(text, x, y + 2, 1000); c.restore();
};
})();
