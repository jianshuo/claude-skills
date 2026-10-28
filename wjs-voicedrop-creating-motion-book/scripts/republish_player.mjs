#!/usr/bin/env node
// 已发布的动画版换上当前播放器＋首开提速，不重做画面（2026-10-28）。
// 拉线上 books/<slug>/video/ 的入口页和它引用的脚本/引擎/字体 → 套 player/template.html（书名、总长、字体、带 ?v= 的脚本段从线上页里取）
// → optimize_html.mjs（合包、字体子集、预加载）→ 只传新增/变化的文件，入口页最后传（切换那一刻它引用的文件都已在线）。
// 旧文件留在 R2 不删：边缘/浏览器里还开着旧入口页的人照样能播完。口播 mp3、场景脚本原文件一律不动。
// 用法：node republish_player.mjs <slug> [--dry]（--dry 只在本地生成，打印工作目录，不上传）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { SK, pool } from './common.mjs';

const slug = process.argv[2], dry = process.argv.includes('--dry');
if (!slug) { console.error('用法：node republish_player.mjs <slug> [--dry]'); process.exit(1); }
const SITE = `https://jianshuo.dev/voicedrop/books/${slug}/video/`;   // 直连 CF，比经 EdgeOne 回源快
const W = fs.mkdtempSync(path.join(os.tmpdir(), `mb-republish-${slug}-`));
const strip = u => u.split('?')[0];
const get = async rel => { const r = await fetch(SITE + rel, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${rel} → ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

const live = (await get(`index.html?_=${Date.now()}`)).toString('utf8');
const pick = (re, name) => { const m = live.match(re); if (!m) throw new Error(`线上入口页里找不到 ${name}（是动画版吗？）`); return m[1]; };
const v = { TITLE: pick(/<title>([^<]*)<\/title>/, 'title'), TOTAL: pick(/let total = ([\d.]+)/, 'total'),
  MMSS: pick(/id="remain">-([\d:]+)</, 'remain'), FONTS: pick(/const loadFonts = Promise\.all\((\[.*?\])\.map\(/, 'fonts') };
const mid = pick(/(<script>window\.FONT_FACES[\s\S]*?)\n<script>\n\(\(\) => \{/, '脚本段');

// 要下载的：脚本段引用的 js、引擎、字体
const need = new Set([...mid.matchAll(/src="([^"]+)"/g)].map(m => strip(m[1])));
need.add('engine.js'); for (const [, u] of JSON.parse(v.FONTS)) need.add(strip(u));
await pool([...need], 8, async rel => { const f = path.join(W, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await get(rel)); });
const before = new Map([...need].map(rel => [rel, fs.readFileSync(path.join(W, rel))]));

// 套模板（和 build_html 同一套占位符；脚本段原样搬，里面的 ?v= 是 build_html 按内容算的）
let T = fs.readFileSync(path.join(SK, 'player/template.html'), 'utf8');
T = T.replace(/<script>window\.FONT_FACES[\s\S]*?(?=\n<script>\n\(\(\) => \{)/, () => mid);
for (const [k, val] of Object.entries(v)) T = T.replaceAll(`{{${k}}}`, val);
for (const f of ['narration.mp3', 'engine.js']) { const m = live.match(new RegExp(`'${f.replace('.', '\\.')}(\\?v=[0-9a-f]+)'`)); if (m) T = T.replace(`'${f}'`, `'${f}${m[1]}'`); }
const slash = live.match(/^<script>if\(.*\n/); if (slash && !T.startsWith(slash[0])) T = slash[0] + T;   // publish_video 加的补斜杠
if (/\{\{[A-Z]+\}\}/.test(T)) throw new Error('还有没填的占位符：' + T.match(/\{\{[A-Z]+\}\}/)[0]);
fs.writeFileSync(path.join(W, 'index.html'), T);
execFileSync('node', [path.join(SK, 'scripts/optimize_html.mjs'), W], { stdio: 'inherit' });

// 上传：新文件或内容变了的，入口页最后
const out = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : out.push(path.relative(W, f).split(path.sep).join('/')); } }; walk(W);
const changed = out.filter(rel => rel !== 'index.html' && (!before.has(rel) || !before.get(rel).equals(fs.readFileSync(path.join(W, rel)))));
console.log(`《${v.TITLE}》要传：${[...changed, 'index.html'].join(' ')}${dry ? `（--dry，没传；工作目录 ${W}）` : ''}`);
if (dry) process.exit(0);
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', woff: 'font/woff', woff2: 'font/woff2' };
const credF = process.env.VOICEDROP_CREDENTIALS || path.join(os.homedir(), '.config/voicedrop/credentials');
const TOKEN = JSON.parse(fs.readFileSync(credF, 'utf8')).token;
const put = async rel => { const r = await fetch(`https://jianshuo.dev/files/api/upload/books/${encodeURIComponent(slug)}/video/${rel.split('/').map(encodeURIComponent).join('/')}`,
  { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': TYPES[rel.split('.').pop()] || 'application/octet-stream' }, body: fs.readFileSync(path.join(W, rel)) });
  if (!r.ok) throw new Error(`上传 ${rel} 失败：${r.status} ${await r.text()}`); };
await pool(changed, 6, put);
await put('index.html');
console.log(`已上线 https://voicedrop.cn/books/${slug}/video/（浏览器最多 5 分钟后看到新入口页）`);
fs.rmSync(W, { recursive: true, force: true });
