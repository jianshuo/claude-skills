#!/usr/bin/env node
// 冒烟检查（不要 Chromium，VPS 可跑）：在 Node 的 vm 里跑真的 huashu-art-motion 引擎＋套件＋全部章节代码，DOM 和 Canvas 换成假的，
// 按 --fps（默认 10）逐帧调 renderFrame(t)。假 Canvas 不出像素，但完整跟踪变换矩阵、save/restore、clip、离屏画布贴图，所以能查：
//   ① 启动错误：场景文件缺失、语法错、没注册、转场名不存在（引擎 scenes/index.js 的同一套检查）
//   ② 运行时报错：某一镜在某一刻抛异常（HTML 播到这里会卡住/黑屏）
//   ③ 缺字形：字体子集里没有的字（会静默回退系统字体，换台机器就变样；引擎 U.missingGlyphs 的同一套 cmap 查表）
//   ④ 框景：半截字（被画面边缘切掉）、进字幕带、叠字——qa.py 同一套判据，持续 ≥0.3s 才报
// 查不到：画面好不好看、图形（非文字）出画/进字幕带、近空白、确定性。这些要 Mac 上的 qa.py / 审片。
// 字宽用估算（汉字 1em、拉丁 0.56em），离边缘差几像素的半截字判断会有出入；线索要去看那一帧再定。
// 用法：node smoke.mjs <项目目录> [--film book（章节自测用 chNN：读 eras_chNN.js）] [--out <目录，默认 <项目>/qa/smoke>] [--fps 10] [--ids c02_a,c02_b] [--sub-band 0.74]
// 产物：smoke.json、框景线索.txt（格式同 qa_batches.mjs，Mac 上可直接接 framing_sheet.mjs）。有 ①②③ 退出码 1。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const P = path.resolve(argv[0]), E = path.join(P, '代码工程'), OUT = path.resolve(opt('out', path.join(P, 'qa/smoke')));
const FILM = opt('film', 'book'), FPS = +opt('fps', 10), BAND = +opt('sub-band', 0.74), IDS = opt('ids') ? new Set(opt('ids').split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });

// ---------- 假 DOM / Canvas ----------
const NOOP = () => ANY;
const ANY = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : ANY, apply: () => ANY, construct: () => ANY });
const absorb = obj => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? NOOP : undefined)) });
class DOMMatrix {
  constructor(m) { const [a, b, c, d, e, f] = Array.isArray(m) && m.length >= 6 ? m : [1, 0, 0, 1, 0, 0]; Object.assign(this, { a, b, c, d, e, f }); }
  get m11() { return this.a; } get m12() { return this.b; } get m21() { return this.c; } get m22() { return this.d; } get m41() { return this.e; } get m42() { return this.f; }
  get is2D() { return true; } get isIdentity() { return this.a === 1 && !this.b && !this.c && this.d === 1 && !this.e && !this.f; }
  multiply(o) { const { a, b, c, d, e, f } = this; return new DOMMatrix([a * o.a + c * o.b, b * o.a + d * o.b, a * o.c + c * o.d, b * o.c + d * o.d, a * o.e + c * o.f + e, b * o.e + d * o.f + f]); }
  inverse() { const { a, b, c, d, e, f } = this, k = a * d - b * c || 1e-12; return new DOMMatrix([d / k, -b / k, -c / k, a / k, (c * f - d * e) / k, (b * e - a * f) / k]); }
  translate(x = 0, y = 0) { return this.multiply(new DOMMatrix([1, 0, 0, 1, x, y])); }
  scale(sx = 1, sy = sx) { return this.multiply(new DOMMatrix([sx, 0, 0, sy, 0, 0])); }
  rotate(deg = 0) { const r = deg * Math.PI / 180; return this.multiply(new DOMMatrix([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])); }
  transformPoint(p = {}) { const x = p.x || 0, y = p.y || 0; return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 }; }
  invertSelf() { Object.assign(this, this.inverse()); return this; } multiplySelf(o) { Object.assign(this, this.multiply(o)); return this; }
  preMultiplySelf(o) { Object.assign(this, new DOMMatrix([o.a, o.b, o.c, o.d, o.e, o.f]).multiply(this)); return this; }
  translateSelf(x, y) { return this.multiplySelf(new DOMMatrix([1, 0, 0, 1, x || 0, y || 0])); } scaleSelf(sx = 1, sy = sx) { return this.multiplySelf(new DOMMatrix([sx, 0, 0, sy, 0, 0])); }
  rotateSelf(deg = 0) { Object.assign(this, this.rotate(deg)); return this; }
}
const STATE = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin', 'miterLimit',
  'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'filter', 'imageSmoothingEnabled', 'lineDashOffset', 'direction', 'letterSpacing', 'imageSmoothingQuality', 'fontKerning', 'wordSpacing'];
const DEF = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over', font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
  lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', imageSmoothingEnabled: true,
  lineDashOffset: 0, direction: 'ltr', letterSpacing: '0px', imageSmoothingQuality: 'low', fontKerning: 'auto', wordSpacing: '0px' };
let HOOK = { glyph: null };   // 每次 fillText 查缺字（引擎 U 就绪后挂上）
const emSize = font => +(/([\d.]+)px/.exec(font) || [0, 10])[1];
const charW = ch => { const c = ch.codePointAt(0); return c >= 0x2E80 || (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x3000 && c <= 0x303F) ? 1 : ch === ' ' ? 0.3 : /[A-Z0-9]/.test(ch) ? 0.62 : 0.52; };
class Ctx2D {
  constructor(canvas) { this.canvas = canvas; Object.assign(this, DEF); this._m = [1, 0, 0, 1, 0, 0]; this._st = []; this._clip = false; this._dash = []; }
  save() { const s = { m: [...this._m], clip: this._clip, dash: this._dash }; for (const k of STATE) s[k] = this[k]; this._st.push(s); }
  restore() { const s = this._st.pop(); if (!s) return; this._m = s.m; this._clip = s.clip; this._dash = s.dash; for (const k of STATE) this[k] = s[k]; }
  reset() { Object.assign(this, DEF); this._m = [1, 0, 0, 1, 0, 0]; this._st = []; this._clip = false; this.canvas.__tb = []; }
  translate(x, y) { const m = this._m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x, y) { const m = this._m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  rotate(r) { const m = this._m, c = Math.cos(r), s = Math.sin(r), [a, b, cc, d] = m; m[0] = a * c + cc * s; m[1] = b * c + d * s; m[2] = -a * s + cc * c; m[3] = -b * s + d * c; }
  transform(a, b, c, d, e, f) { const M = new DOMMatrix(this._m).multiply(new DOMMatrix([a, b, c, d, e, f])); this._m = [M.a, M.b, M.c, M.d, M.e, M.f]; }
  setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') ({ a, b, c, d, e, f } = a); this._m = a === undefined ? [1, 0, 0, 1, 0, 0] : [a, b, c, d, e, f]; }
  resetTransform() { this._m = [1, 0, 0, 1, 0, 0]; }
  getTransform() { return new DOMMatrix(this._m); }
  clip() { this._clip = true; }
  setLineDash(d) { this._dash = d || []; } getLineDash() { return [...this._dash]; }
  createLinearGradient() { return { addColorStop() {} }; } createRadialGradient() { return { addColorStop() {} }; } createConicGradient() { return { addColorStop() {} }; }
  createPattern() { return { setTransform() {} }; }
  isPointInPath() { return false; } isPointInStroke() { return false; }
  getImageData(x, y, w, h) { return new ImageData(Math.max(1, Math.abs(w | 0)), Math.max(1, Math.abs(h | 0))); }
  createImageData(w, h) { return typeof w === 'object' ? new ImageData(w.width, w.height) : new ImageData(Math.abs(w | 0) || 1, Math.abs(h | 0) || 1); }
  _full(x, y, w, h) { const [a, b, c, d, e, f] = this._m; if (b || c) return false; const xs = [a * x + e, a * (x + w) + e], ys = [d * y + f, d * (y + h) + f];
    return Math.min(...xs) <= 0 && Math.min(...ys) <= 0 && Math.max(...xs) >= this.canvas.width && Math.max(...ys) >= this.canvas.height; }
  clearRect(x, y, w, h) { if (this._full(x, y, w, h)) this.canvas.__tb = []; }
  fillRect(x, y, w, h) { const f = this.fillStyle, m = typeof f === 'string' && /^(rgba|hsla)\(([^)]*)\)/.exec(f), opaque = typeof f === 'string' && (!m || +m[2].split(/[ ,/]+/).filter(Boolean)[3] >= 1);
    if (this.globalAlpha >= 1 && (this.globalCompositeOperation === 'copy' || (this.globalCompositeOperation === 'source-over' && opaque)) && this._full(x, y, w, h)) this.canvas.__tb = []; }
  putImageData(im, x, y) { if (x <= 0 && y <= 0 && x + im.width >= this.canvas.width && y + im.height >= this.canvas.height) this.canvas.__tb = []; }
  measureText(text) {
    const s = emSize(this.font), ls = parseFloat(this.letterSpacing) || 0, ch = [...String(text)], w = ch.reduce((a, c) => a + charW(c) * s, 0) + ls * ch.length;
    const al = this.textAlign, L = al === 'center' ? w / 2 : al === 'right' || al === 'end' ? w : 0;
    const bl = this.textBaseline, [asc, desc] = bl === 'middle' ? [0.5, 0.5] : bl === 'top' || bl === 'hanging' ? [0, 1] : bl === 'bottom' || bl === 'ideographic' ? [0.95, 0.05] : [0.84, 0.16];
    return { width: w, actualBoundingBoxLeft: L, actualBoundingBoxRight: w - L, actualBoundingBoxAscent: asc * s, actualBoundingBoxDescent: desc * s, fontBoundingBoxAscent: asc * s, fontBoundingBoxDescent: desc * s, emHeightAscent: asc * s, emHeightDescent: desc * s };
  }
  _text(text, x, y, maxW) {
    const str = String(text); if (HOOK.glyph && str.trim()) HOOK.glyph(this.font, str);
    if (!(this.globalAlpha > 0.15) || !str.trim()) return;
    const m = this.measureText(str), [a, b, c, d, e, f] = this._m; let x0 = x - m.actualBoundingBoxLeft, x1 = x + m.actualBoundingBoxRight;
    if (maxW && x1 - x0 > maxW) x1 = x0 + maxW; const y0 = y - m.actualBoundingBoxAscent, y1 = y + m.actualBoundingBoxDescent, xs = [], ys = [];
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push(a * px + c * py + e); ys.push(b * px + d * py + f); }
    const L = this.canvas.__tb || (this.canvas.__tb = []); L.push([str.slice(0, 24), xs, ys, this._clip]); if (L.length > 6000) L.splice(0, 3000);
  }
  fillText(t, x, y, w) { this._text(t, x, y, w); } strokeText(t, x, y, w) { this._text(t, x, y, w); }
  drawImage(src, ...a) {
    if (this.globalCompositeOperation === 'copy') this.canvas.__tb = [];
    const L = src && src.__tb; if (!L || !L.length || src === this.canvas || !(this.globalAlpha > 0.5)) return;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw = sw, dh = sh;
    if (a.length === 2) [dx, dy] = a; else if (a.length === 4) [dx, dy, dw, dh] = a; else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    const [A, B, C, D, Ee, F] = this._m, kx = dw / sw, ky = dh / sh, clip = this._clip || a.length === 8, out = this.canvas.__tb || (this.canvas.__tb = []);
    for (const [txt, xs, ys, c0] of L) {
      if (Math.max(...xs) < sx || Math.min(...xs) > sx + sw || Math.max(...ys) < sy || Math.min(...ys) > sy + sh) continue;
      const X = [], Y = []; for (let k = 0; k < 4; k++) { const u = dx + (xs[k] - sx) * kx, v = dy + (ys[k] - sy) * ky; X.push(A * u + C * v + Ee); Y.push(B * u + D * v + F); }
      out.push([txt, X, Y, c0 || clip]);
    }
    if (out.length > 6000) out.splice(0, 3000);
  }
}
class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }
class Canvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.__tb = []; this.style = {}; }
  get width() { return this._w; } set width(v) { this._w = +v; this.__tb = []; } get height() { return this._h; } set height(v) { this._h = +v; this.__tb = []; }
  getContext() { return this._ctx || (this._ctx = absorb(new Ctx2D(this))); }
  toDataURL() { return 'data:,'; } toBlob(cb) { cb && cb(new Blob([])); } addEventListener() {} getBoundingClientRect() { return { left: 0, top: 0, width: this._w, height: this._h }; }
}
class Path2D { constructor() { return absorb(this); } }
class Image { constructor() { this.width = 1; this.height = 1; this.complete = true; } set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); } get src() { return this._src; } decode() { return Promise.resolve(); } addEventListener() {} }
class FontFace { constructor(family) { this.family = family; } load() { return Promise.resolve(this); } }
const el = () => absorb({ value: '0', style: {}, textContent: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, setAttribute() {} });
const main = new Canvas(1920, 1080), els = {};
const readLocal = url => fs.readFileSync(path.join(E, decodeURIComponent(String(url).split('?')[0])));
const consoleErr = [];
const sandbox = {
  console: { log() {}, info() {}, warn() {}, debug() {}, error: (...a) => consoleErr.push(a.map(String).join(' ')) },
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, performance, Blob, Response, DecompressionStream, TextDecoder, TextEncoder, URL, URLSearchParams,
  location: { search: '', href: 'file:///index.html' }, navigator: { userAgent: 'node-smoke' }, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  DOMMatrix, ImageData, Path2D, Image, FontFace, OffscreenCanvas: Canvas, HTMLCanvasElement: Canvas, CanvasRenderingContext2D: Ctx2D,
  document: { getElementById: id => id === 'c' ? main : (els[id] || (els[id] = el())), createElement: t => t === 'canvas' ? new Canvas() : el(), createElementNS: (ns, t) => t === 'canvas' ? new Canvas() : el(),
    fonts: { add() {}, ready: Promise.resolve(), check: () => true, load: () => Promise.resolve([]) }, body: el(), head: el(), write() {}, addEventListener() {}, querySelector: () => el() },
  addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1,
  fetch: async url => { try { return new Response(readLocal(url)); } catch { return new Response('', { status: 404 }); } },
  XMLHttpRequest: class { open(m, url) { this.url = url; } send() { try { this.responseText = readLocal(this.url).toString('utf8'); this.status = 200; } catch { this.status = 404; this.responseText = ''; } } },
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
const G = vm.createContext(sandbox);
const run = f => vm.runInContext(fs.readFileSync(path.join(E, f), 'utf8'), G, { filename: f });

// ---------- 启动 ----------
const LIBS = ['fonts', 'util', 'paint', 'brush', 'render', 'post', 'rig', 'rig_huashu', 'kit', 'medium', 'motion', 'camera', 'diagram', 'typo', 'chart', 'ui', 'collage', 'media', 'toon'];
const report = { project: P, film: FILM, fps: FPS, boot: null, errors: [], glyphs: [], framing: [], shots: 0, frames: 0 };
const finish = code => { fs.writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify(report, null, 1)); process.exit(code); };
try { for (const n of LIBS) run(`lib/${n}.js`); run(`eras_${FILM}.js`); run('transitions.js'); run('scenes/index.js'); run('engine.js'); }
catch (e) { report.boot = String(e && e.stack || e).split('\n').slice(0, 4).join('\n'); console.log('✗ 启动失败：' + report.boot); finish(1); }
for (let k = 0; k < 600 && !sandbox.__ready && !sandbox.__bootFailed; k++) await new Promise(r => setTimeout(r, 50));
if (!sandbox.__ready) { report.boot = sandbox.__bootFailed || consoleErr.join('\n') || '引擎 30 秒内没有就绪'; console.log('✗ 启动失败：\n' + report.boot); finish(1); }
consoleErr.length = 0;

// ---------- 逐帧 ----------
const ERAS = sandbox.ERAS, [VW, VH] = sandbox.__size, U = sandbox.U, glyphSeen = new Set(); let cur = null;
HOOK.glyph = (font, text) => { const miss = U.missingGlyphs(font, text); if (!miss.length) return; const fam = U.fontFamily(font), key = fam + miss.join('') + (cur && cur.id);   // 每一镜各报一次（同一个字在别的镜头里也要改）
  if (glyphSeen.has(key)) return; glyphSeen.add(key); report.glyphs.push({ font: fam, chars: miss.join(''), text: text.slice(0, 30), id: cur && cur.id, t: cur && +cur.t.toFixed(2) }); };
function frameIssues(tb) {
  const out = [], vis = [];
  for (const [txt, cxs, cys, clipped] of tb) {
    const x0 = Math.min(...cxs), y0 = Math.min(...cys), x1 = Math.max(...cxs), y1 = Math.max(...cys), w = x1 - x0, h = y1 - y0;
    const ang = Math.atan2((cys[1] - cys[0]) * VH, (cxs[1] - cxs[0]) * VW);
    if (w <= 0 || h <= 0 || h < 0.008) continue;
    const ix0 = Math.max(x0, 0), iy0 = Math.max(y0, 0), ix1 = Math.min(x1, 1), iy1 = Math.min(y1, 1);
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    const frac = (ix1 - ix0) * (iy1 - iy0) / (w * h);
    if (frac < 0.9 && frac > 0.1) out.push(['半截字', txt]);
    if (BAND && iy1 > BAND + 0.004 && frac > 0.1) out.push(['进字幕带', txt]);
    if (!clipped) vis.push([txt, ang, cxs, cys]);
  }
  const box = (v, ang) => { const c = Math.cos(-ang), s = Math.sin(-ang), u = v[2].map((x, i) => x * c - v[3][i] * s * VH / VW), w = v[2].map((x, i) => x * s * VW / VH + v[3][i] * c); return [Math.min(...u), Math.min(...w), Math.max(...u), Math.max(...w)]; };
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j]; if (a[0] === b[0]) continue;
    const same = Math.abs(a[1] - b[1]) < 0.02, ang = same ? a[1] : 0; let A = box(a, ang), B = box(b, ang);
    if (!same) [A, B] = [A, B].map(r => [r[0] + (r[2] - r[0]) * .12, r[1] + (r[3] - r[1]) * .12, r[2] - (r[2] - r[0]) * .12, r[3] - (r[3] - r[1]) * .12]);
    const ow = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), oh = Math.min(A[3], B[3]) - Math.max(A[1], B[1]); if (ow <= 0 || oh <= 0) continue;
    if (ow * oh / Math.min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1])) > 0.3) out.push(['叠字', a[0] + '｜' + b[0]]);
  }
  return out;
}
// 字幕层（GLOBAL_OVERLAY）不进框景判定（qa.py 也是逐镜画、不画字幕）；另画在草稿画布上，只查它报不报错
const OV = sandbox.GLOBAL_OVERLAY, scratch = new Canvas(VW, VH).getContext('2d'); sandbox.GLOBAL_OVERLAY = null;
const step = 1 / FPS, runs = [];
for (const e of ERAS) {
  if (IDS && !IDS.has(e.id)) continue; report.shots++;
  const t1 = Math.min(e.t1, sandbox.__total), skip = Math.max(0.35, e.transition ? e.transition.dur + (e.transition.delay || 0) : 0), open = new Map(); let err = null;
  for (let t = e.t0 + Math.min(skip, (t1 - e.t0) / 2); t < t1 - 1e-6; t += step) {
    cur = { id: e.id, t }; main.__tb = [];
    try { sandbox.renderFrame(t); if (OV) OV(scratch, t); } catch (x) { if (!err) err = { id: e.id, t: +t.toFixed(2), error: String(x && x.stack || x).split('\n').slice(0, 3).join(' | ') }; continue; }
    report.frames++;
    const tb = (main.__tb || []).map(([s, xs, ys, c]) => [s, xs.map(v => v / main.width), ys.map(v => v / main.height), c]);
    const now = new Set(frameIssues(tb).map(x => x.join('\u0001')));
    for (const [k, [a, b]] of open) if (!now.has(k)) { if (b - a >= 0.3 - 1e-6) runs.push([k, a, b, e.id]); open.delete(k); }
    for (const k of now) open.set(k, open.has(k) ? [open.get(k)[0], t] : [t, t]);
  }
  for (const [k, [a, b]] of open) if (b - a >= 0.3 - 1e-6) runs.push([k, a, b, e.id]);
  if (err) report.errors.push(err);
  if (consoleErr.length) { report.errors.push({ id: e.id, console: [...new Set(consoleErr)].slice(0, 3).join(' | ') }); consoleErr.length = 0; }
}
// 逐字打出来的字一字一条：同类、同镜、时间相交的并成一条
runs.sort((x, y) => x[0].split('\u0001')[0].localeCompare(y[0].split('\u0001')[0]) || x[3].localeCompare(y[3]) || x[1] - y[1]);
for (const [k, a, b, id] of runs) { const [kind, txt] = k.split('\u0001'), L = report.framing.at(-1);
  if (L && L.kind === kind && L.id === id && a <= L.t[1] + 0.05) { L.t[1] = Math.max(L.t[1], b); if (!L.text.split('、').includes(txt)) L.text += '、' + txt; }
  else report.framing.push({ kind, id, t: [+a.toFixed(2), +b.toFixed(2)], text: txt }); }
report.framing.sort((x, y) => x.t[0] - y.t[0]);
fs.writeFileSync(path.join(OUT, '框景线索.txt'), report.framing.map(f => `${((f.t[0] + f.t[1]) / 2).toFixed(2)}|${f.kind}|${f.id}|${f.text}\n`).join(''));
const cnt = k => report.framing.filter(f => f.kind === k).length;
console.log(`冒烟：${report.shots} 镜、${report.frames} 帧（${FPS}fps）｜运行时报错 ${report.errors.length}｜缺字形 ${report.glyphs.length}｜框景线索 ${report.framing.length}（半截字 ${cnt('半截字')}、进字幕带 ${cnt('进字幕带')}、叠字 ${cnt('叠字')}）-> ${OUT}`);
for (const x of report.errors.slice(0, 10)) console.log(`  ✗ ${x.id}${x.t != null ? ' @' + x.t + 's' : ''}：${x.error || x.console}`);
for (const g of report.glyphs.slice(0, 10)) console.log(`  ✗ 缺字 ${g.font}「${g.chars}」 ${g.id} @${g.t}s（${g.text}）`);
for (const f of report.framing.slice(0, 60)) console.log(`  · ${f.kind} ${f.t[0].toFixed(2)}–${f.t[1].toFixed(2)}s ${f.id} ${f.text}`);
finish(report.errors.length || report.glyphs.length ? 1 : 0);
