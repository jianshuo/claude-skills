// 公用：路径、凭据、book.json、MP3 帧操作、口播稿与 ASR 按字对齐。只依赖 Node（≥20），不要 ffmpeg / Python / Chromium。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE = process.env.HUASHU_ENGINE || path.join(os.homedir(), '.claude/skills/huashu-art-motion/scripts/engine');
export const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');
export const book = P => readJSON(path.join(P, 'book.json'));
export const chapterIds = b => b.chapters.map((_, i) => `ch${String(i + 1).padStart(2, '0')}`);   // ch01…chNN（口播是听书整章，没有另写的开场段）

// 凭据：环境变量优先，其次 ~/code/.env（Mac）或 $BOOK_ENV 指定的文件（VPS）
export function loadEnv() {
  const f = process.env.BOOK_ENV || path.join(os.homedir(), 'code/.env'), env = { ...process.env };
  if (fs.existsSync(f)) for (let l of fs.readFileSync(f, 'utf8').split('\n')) {
    l = l.trim().replace(/^export /, ''); const i = l.indexOf('=');
    if (!l || l.startsWith('#') || i < 0) continue;
    const k = l.slice(0, i).trim(); if (!(k in env)) env[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// Node 20 的 WebSocket 要 --experimental-websocket（22 起默认有）：没有就带上开关重启自己
export function ensureWebSocket() {
  if (typeof WebSocket !== 'undefined') return;
  const r = spawnSync(process.execPath, ['--experimental-websocket', '--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// ---------- MP3：按帧解析（跳过 ID3 和 Xing/Info 帧），帧级拼接，全零静音帧 ----------
const BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
export function mp3Frames(buf) {
  const frames = []; let i = 0, fmt = null;
  while (i + 4 <= buf.length) {
    if (buf[i] === 0x49 && buf[i + 1] === 0x44 && buf[i + 2] === 0x33) { i += 10 + ((buf[i + 6] & 127) << 21 | (buf[i + 7] & 127) << 14 | (buf[i + 8] & 127) << 7 | (buf[i + 9] & 127)); continue; }
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0 || ((buf[i + 1] >> 1) & 3) !== 1) { i++; continue; }   // 只认 Layer III
    const ver = (buf[i + 1] >> 3) & 3, br = BR[ver === 3 ? 1 : 2][buf[i + 2] >> 4], sr = (SR[ver] || [])[(buf[i + 2] >> 2) & 3];
    if (!br || !sr || ver === 1) { i++; continue; }
    const len = Math.floor((ver === 3 ? 144 : 72) * br * 1000 / sr) + ((buf[i + 2] >> 1) & 1);
    const mono = (buf[i + 3] >> 6) === 3, side = mono ? (ver === 3 ? 17 : 9) : (ver === 3 ? 32 : 17);
    const tag = buf.subarray(i + 4 + side, i + 8 + side).toString('latin1');
    const f = buf.subarray(i, i + len);
    if (tag !== 'Xing' && tag !== 'Info') {
      const k = `${ver}/${sr}/${buf[i + 3] >> 6}`;
      if (fmt && fmt.key !== k) throw new Error(`MP3 格式中途变了：${fmt.key} → ${k}`);
      fmt ||= { key: k, ver, sr, spf: ver === 3 ? 1152 : 576, header: Buffer.from(f.subarray(0, 4)), side, len };
      frames.push(f);
    }
    i += len;
  }
  if (!fmt) throw new Error('不是 MP3（找不到 Layer III 帧）');
  return { frames, ...fmt, dur: frames.length * (ver3(fmt) ? 1152 : 576) / fmt.sr };
}
const ver3 = f => f.ver === 3;
export const mp3Duration = file => mp3Frames(fs.readFileSync(file)).dur;
// 全零侧信息＝没有频谱数据＝解出来是数字静音；码率与第一帧相同、去掉 padding 位
export function silentFrames(fmt, n) {
  const h = Buffer.from(fmt.header); h[2] &= ~0x02;
  const len = Math.floor((fmt.ver === 3 ? 144 : 72) * BR[fmt.ver === 3 ? 1 : 2][h[2] >> 4] * 1000 / fmt.sr);
  const f = Buffer.alloc(len); h.copy(f, 0); return Array(n).fill(f);
}

// ---------- 按字对齐（difflib.SequenceMatcher(autojunk=False) 的逐行移植）----------
const PUN = new Set('，、：？。；！ ,.~～“”"\'（）()《》·—-');
function matchingBlocks(a, b) {
  const b2j = new Map(); b.forEach((c, j) => { if (!b2j.has(c)) b2j.set(c, []); b2j.get(c).push(j); });
  const longest = (alo, ahi, blo, bhi) => {
    let bi = alo, bj = blo, bs = 0, j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const nj = new Map();
      for (const j of b2j.get(a[i]) || []) { if (j < blo) continue; if (j >= bhi) break; const k = (j2len.get(j - 1) || 0) + 1; nj.set(j, k); if (k > bs) { bi = i - k + 1; bj = j - k + 1; bs = k; } }
      j2len = nj;
    }
    while (bi > alo && bj > blo && a[bi - 1] === b[bj - 1]) { bi--; bj--; bs++; }
    while (bi + bs < ahi && bj + bs < bhi && a[bi + bs] === b[bj + bs]) bs++;
    return [bi, bj, bs];
  };
  const q = [[0, a.length, 0, b.length]], out = [];
  while (q.length) {
    const [alo, ahi, blo, bhi] = q.pop(), [i, j, k] = longest(alo, ahi, blo, bhi);
    if (k) { out.push([i, j, k]); if (alo < i && blo < j) q.push([alo, i, blo, j]); if (i + k < ahi && j + k < bhi) q.push([i + k, ahi, j + k, bhi]); }
  }
  out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged = []; for (const m of out) { const l = merged.at(-1); if (l && l[0] + l[2] === m[0] && l[1] + l[2] === m[1]) l[2] += m[2]; else merged.push([...m]); }
  return merged;
}
// asr: 火山 ASR 结果（result.utterances[].words[]，毫秒）；返回 { rows: [[开始, 结束, 短句]], ratio }
export function alignPhrases(asr, text) {
  const phrases = text.split(/(?<=[，。：；？])|\n/).filter(p => p && p.trim()).map(p => p.trim());
  const sc = []; phrases.forEach((p, k) => { for (const ch of p) if (!PUN.has(ch)) sc.push([ch, k]); });
  const ac = [];
  for (const u of asr.result?.utterances || []) for (const w of u.words || []) {
    const t = [...w.text].filter(ch => !PUN.has(ch)); if (!t.length) continue;
    const a = w.start_time / 1000, b = w.end_time / 1000;
    t.forEach((ch, i) => ac.push([ch, a + (b - a) * i / t.length, a + (b - a) * (i + 1) / t.length]));
  }
  const blocks = matchingBlocks(sc.map(x => x[0]), ac.map(x => x[0]));
  const st = Array(sc.length).fill(null), en = Array(sc.length).fill(null);
  for (const [ai, bj, k] of blocks) for (let i = 0; i < k; i++) { st[ai + i] = ac[bj + i][1]; en[ai + i] = ac[bj + i][2]; }
  const known = st.map((v, i) => v === null ? -1 : i).filter(i => i >= 0);
  if (!known.length) throw new Error('ASR 与稿子完全对不上');
  for (let i = 0; i < sc.length; i++) {
    if (st[i] !== null) continue;
    const L = known.filter(k => k < i).at(-1), R = known.find(k => k > i);
    if (L === undefined) { st[i] = en[i] = st[R]; continue; }
    if (R === undefined) { st[i] = en[i] = en[L]; continue; }
    st[i] = en[L] + (st[R] - en[L]) * (i - L) / (R - L); en[i] = en[L] + (st[R] - en[L]) * (i - L + 1) / (R - L);
  }
  const rows = [];
  phrases.forEach((p, k) => { const idx = sc.map((x, i) => x[1] === k ? i : -1).filter(i => i >= 0); if (idx.length) rows.push([st[idx[0]], en[idx.at(-1)], p]); });
  return { rows, ratio: blocks.reduce((s, m) => s + m[2], 0) / Math.max(1, sc.length) };
}
export const formatRows = rows => rows.map(([a, b, p]) => `${a.toFixed(2).padStart(6)}-${b.toFixed(2).padStart(6)}  ${p}`).join('\n') + '\n';
export const parseRows = s => s.split('\n').map(l => l.match(/^\s*([\d.]+)-\s*([\d.]+)\s+(.*)$/)).filter(Boolean).map(m => [+m[1], +m[2], m[3].trim()]);

// 简单并发池
export async function pool(items, n, fn) {
  const out = []; let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } }));
  return out;
}
