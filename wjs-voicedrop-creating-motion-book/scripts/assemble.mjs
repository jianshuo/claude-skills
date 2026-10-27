#!/usr/bin/env node
// 总装：各章口播（听书整章 ch01…chNN）各自计时 → 全片时间轴。纯 Node，不要 ffmpeg。
// - 音轨：各章 MP3 按帧首尾相接，章间插全零静音帧（GAP，按帧取整）→ 音频/全片口播.mp3；章偏移按帧数精确算
// - 段落表：各章 音频/chNN.shots.json（章内局部时间）加章偏移 → 代码工程/eras_book.js
// - 字幕：句时间（ASR 对齐）→ 行中标点保留、句号换空格，行尾不留标点（」』除外）→ ≤17 字合并、>18 字拆、数字量词不拆、<0.8s 并或延、空条不出 → scenes/book/subs.js（调套件 K.subtitle）、音频/全片.srt
// 用法：node assemble.mjs <项目目录> [--allow-missing]（缺章用占位镜头，先看已完成的部分）[--only ch01,ch02,ch03]（试看版：只总装这几章，章节卡仍按全书章数）
import fs from 'node:fs';
import path from 'node:path';
import { book, chapterIds, mp3Frames, silentFrames, parseRows, readJSON } from './common.mjs';

const P = path.resolve(process.argv[2]), allow = process.argv.includes('--allow-missing'), oi = process.argv.indexOf('--only');
const ONLY = oi > 0 ? new Set(process.argv[oi + 1].split(',')) : null;
const A = path.join(P, '音频'), E = path.join(P, '代码工程'), Bd = path.join(E, 'scenes/book'), B = book(P), CH = chapterIds(B).filter(c => !ONLY || ONLY.has(c));
const r3 = x => Math.round(x * 1000) / 1000;

// ---------- 音轨与时间轴 ----------
const mp3 = CH.map(ch => mp3Frames(fs.readFileSync(path.join(A, `${ch}.mp3`))));
const fmt = mp3[0], spf = fmt.spf / fmt.sr, gapN = Math.round((B.gap ?? 0.8) / spf), GAP = gapN * spf;   // 章间气口（0.4s 审片嫌赶）
for (const m of mp3) if (m.key !== fmt.key) throw new Error(`各章 MP3 格式不一致：${fmt.key} vs ${m.key}`);
const offs = {}, shots = [], libs = [], missing = []; let t = 0; const tail = [];
CH.forEach((ch, ci) => {
  const d = mp3[ci].dur; offs[ch] = r3(t); let clen = d + GAP;
  // 一章可以整章一份（chNN.js + chNN.shots.json），也可以拆成几段给不同的人做（chNN_a / chNN_b …，各自用章内局部时间，按字母顺序首尾相接）
  const parts = fs.readdirSync(A).filter(f => new RegExp(`^${ch}_[a-z]\\.shots\\.json$`).test(f)).sort().map(f => f.slice(ch.length + 1, ch.length + 2));
  const ids = parts.length ? parts.map(p => `${ch}_${p}`) : [ch];
  const sj = path.join(A, `${ch}.shots.json`);
  if (ids.every(id => fs.existsSync(path.join(A, `${id}.shots.json`)) && fs.existsSync(path.join(Bd, `${id}.js`)))) {
    const rows = ids.flatMap(id => readJSON(path.join(A, `${id}.shots.json`))), end = rows.at(-1)[2]; ids.forEach(id => libs.push(`scenes/book/${id}.js`));
    for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i][1] - rows[i - 1][2]) > 0.05) console.log(`⚠ ${ch} 第 ${i} 镜 ${rows[i][0]} 开始 ${rows[i][1]}，上一镜结束 ${rows[i - 1][2]}（几段没接上）`);
    if (Math.abs(end - (d + GAP)) > 0.6 && ci < CH.length - 1) console.log(`⚠ ${ch} 最后一镜结束 ${end.toFixed(2)}，音频+GAP=${(d + GAP).toFixed(2)}`);
    if (ci === CH.length - 1) clen = Math.max(d + GAP, end);   // 最后一章允许片尾多留（片名停留），其余章严格 = 音频＋GAP
    rows.forEach((r, i) => shots.push([r[0], r3(t + r[1]), r3(t + (i === rows.length - 1 ? clen : r[2])), ...(r[3] === 'seamless' ? ['seamless'] : [])]));
  } else {
    missing.push(ch);
    if (!allow) { console.error(`缺 ${ch}：${ch}.shots.json 或 scenes/book/${ch}.js 不存在（--allow-missing 用占位镜头）`); process.exit(1); }
    shots.push([`ph_${ch}`, r3(t), r3(t + clen)]);
  }
  tail.push(Math.max(0, Math.round((clen - d) / spf)));   // 本章音频后补几帧静音
  t += mp3[ci].frames.length * spf + tail.at(-1) * spf;
});
const total = r3(t);
for (let i = 0; i < shots.length - 1; i++) shots[i][2] = shots[i + 1][1];   // 首尾严格相接
shots.at(-1)[2] = total;
fs.writeFileSync(path.join(A, '全片口播.mp3'), Buffer.concat(CH.flatMap((_, ci) => [...mp3[ci].frames, ...silentFrames(fmt, tail[ci])])));
console.log(`全片 ${total.toFixed(1)}s = ${(total / 60).toFixed(1)} 分钟，${shots.length} 镜；缺：${missing.length ? missing.join(' ') : '无'}`);

// ---------- 字幕 ----------
const NUM = new Set('零一二三四五六七八九十百千万亿两几0123456789.%'), MW = new Set('倍个年人种次岁天位颗元块条');
const TRAIL = /[\s，、。：；？！,.;:?!—…·~～-]+$/;   // 行尾一律不留标点（」』等收尾引号除外）
const endP = s => /[，、：；？！。]$/.test(s), join = (x, y) => x + (endP(x) ? '' : '，') + y;   // 本身带标点就不再补逗号
function chapterSubs(ch, off) {
  const rows = parseRows(fs.readFileSync(path.join(A, `${ch}.句时间.txt`), 'utf8')), cues = [];
  for (const [a, b, tx] of rows) {
    const t2 = tx, L = cues.at(-1);
    if (L && [...L[2]].length + [...t2].length <= 17 && a - L[1] < 0.6 && !/[。：；？！]$/.test(L[3])) { L[1] = b; L[2] = join(L[2], t2); L[3] = tx; }
    else cues.push([a, b, t2, tx]);
  }
  const split = (a, b, tx) => {
    const c = [...tx]; if (c.length <= 18) return [[a, b, tx]];
    const mid = c.length / 2, rng = []; for (let i = 5; i < c.length - 4; i++) rng.push(i);
    const ok = rng.filter(i => !(NUM.has(c[i - 1]) && (NUM.has(c[i]) || MW.has(c[i])))), cand = ok.length ? ok : rng;
    const pref = cand.filter(i => '、，'.includes(c[i - 1]) || c[i] === ' '), k = (pref.length ? pref : cand).reduce((x, y) => Math.abs(y - mid) < Math.abs(x - mid) ? y : x);
    const l = c.slice(0, k).join('').replace(/ +$/, ''), r = c.slice(k).join('').replace(/^[、， ]+/, ''), m = a + (b - a) * [...l].length / ([...l].length + [...r].length);
    return [...split(a, m - 0.02, l), ...split(m, b, r)];
  };
  const out = []; cues.forEach(([a, b, tx], i) => out.push(...split(a, Math.min(b + 0.4, (i + 1 < cues.length ? cues[i + 1][0] : b + 0.6) - 0.02), tx)));
  const merged = [];
  for (const [a, b, tx] of out) { const L = merged.at(-1);
    if (L && (b - a < 0.8 || L[1] - L[0] < 0.8) && [...L[2]].length + [...tx].length + 1 <= 18 && a - L[1] < 0.6) { L[1] = b; L[2] = join(L[2], tx); }
    else merged.push([a, b, tx]); }
  // 拆行落在开引号/开括号/箭头后面时，把它挪到下一行行首（「系统里根本不存在「⏎当前股价」」→ 「…不存在⏎「当前股价」」）
  for (let i = 0; i + 1 < merged.length; i++) { const m = /\s*([「（《“『(→≥≤=]+)\s*$/.exec(merged[i][2]); if (m) { merged[i][2] = merged[i][2].slice(0, m.index); merged[i + 1][2] = m[1] + (/[→≥≤=]/.test(m[1]) ? ' ' : '') + merged[i + 1][2]; } }
  merged.forEach((m, i) => { if (m[1] - m[0] < 0.8) m[1] = Math.min(i + 1 < merged.length ? merged[i + 1][0] - 0.02 : m[1] + 0.8, m[0] + 0.8); });
  return merged.filter(m => m[2].replace(/[ ，、。？！：；]/g, '')).map(([a, b, tx]) => [r3(off + a), r3(off + b), tx.replace(/。/g, ' ').replace(TRAIL, '').trim()]);
}
const subs = CH.flatMap(ch => chapterSubs(ch, offs[ch]));
const ts = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')},${String(Math.round(s % 1 * 1000) % 1000).padStart(3, '0')}`;
fs.writeFileSync(path.join(A, '全片.srt'), subs.map(([a, b, tx], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${tx}\n`).join('\n'));
fs.writeFileSync(path.join(Bd, 'subs.js'), `// 字幕（assemble.mjs 生成）：画在画布最上层，样式由套件 K.subtitle 决定
window.SUBS = ${JSON.stringify(subs)};
window.GLOBAL_OVERLAY = (c, t) => {
  const s = SUBS.find(q => t >= q[0] && t < q[1]); if (!s) return;
  K.subtitle(c, s[2], Math.min(1, (t - s[0]) / 0.08, (s[1] - t) / 0.08));
};
`);

// ---------- 段落表 ----------
fs.writeFileSync(path.join(Bd, 'meta.js'), `window.BOOK_META = ${JSON.stringify({ title: B.title, chapters: B.chapters })};\n`);
const extra = (B.extra_libs || []).map(f => `scenes/book/${f}`);   // 本书另有的共用场景文件
const ph = missing.length ? 'window.SCENES = window.SCENES || {};   // 占位镜头比场景文件先加载\n' + missing.map(ch => `SCENES['ph_${ch}'] = { draw(c, lt, t) { K.bg(c, t, {}); K.text(c, '${ch} 待制作', 540, 900, { size: 90 }); } };\n`).join('') : '';
const lines = []; for (let k = 0; k < shots.length; k += 4) lines.push('  ' + shots.slice(k, k + 4).map(s => JSON.stringify(s).replace(/,/g, ', ')).join(', '));
const [W, H] = B.size || [1080, 1920];
fs.writeFileSync(path.join(E, 'eras_book.js'), `// 《${B.title}》：assemble.mjs 生成，别手改（改各章 音频/chNN.shots.json 后重跑）
window.FILM_SIZE = [${W}, ${H}];
window.PUNCH = 0;
window.SCENE_LIBS = ${JSON.stringify(['scenes/book/meta.js', 'scenes/book/lib.js', 'scenes/book/props.js', ...extra, ...libs, 'scenes/book/subs.js'])};
${ph}window.CHAPTER_OFFSETS = ${JSON.stringify(offs)};
const SHOTS = [
${lines.join(',\n')},
];
// 同一个连续世界拆成多镜时，后几镜在 chNN.shots.json 里带第四列 "seamless"，镜间不加转场
window.ERAS = SHOTS.map(([id, a, b, sm], i) => ({ id, dur: +(b - a).toFixed(3), ...(i && sm !== 'seamless' ? { transition: { type: 'crossfade', dur: 0.15 } } : {}) }));
`);
console.log(`音轨、字幕、段落表已写好；字幕 ${subs.length} 条，最长 ${Math.max(0, ...subs.map(s => [...s[2]].length))} 字`);
