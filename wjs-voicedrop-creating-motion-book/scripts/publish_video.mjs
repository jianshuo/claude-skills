#!/usr/bin/env node
// 发布动画版到书架：<项目>/html/ 整个目录 → R2 books/<slug>/video/，公开地址 https://voicedrop.cn/books/<slug>/video/
// 写入走 files API（PUT /files/api/upload/books/…），要书架发布账号的令牌（和 build.mjs 发书同一份 ~/.config/voicedrop/credentials，
// 或用 VOICEDROP_CREDENTIALS 指向别的文件）。公开路由按上传时的 Content-Type 回，所以每个文件都要带对类型。
// 入口页加一行「补结尾斜杠」：/video 不带斜杠时相对路径会解析到 /books/<slug>/lib/…，全部 404。
// 用法：node publish_video.mjs <项目目录> [--dry]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { book, pool } from './common.mjs';

const P = path.resolve(process.argv[2]), dry = process.argv.includes('--dry'), H = path.join(P, 'html'), B = book(P);
const credF = process.env.VOICEDROP_CREDENTIALS || path.join(os.homedir(), '.config/voicedrop/credentials');
const TOKEN = dry ? '' : JSON.parse(fs.readFileSync(credF, 'utf8')).token;
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', woff: 'font/woff', woff2: 'font/woff2',
  ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', css: 'text/css; charset=utf-8' };
const SKIP = new Set(['_test.html', 'artifact_files.json']);
const files = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : SKIP.has(e.name) || files.push(f); } };
if (!fs.existsSync(path.join(H, 'index.html'))) { console.error('没有 html/index.html：先跑 build_html.mjs'); process.exit(1); }
walk(H);
const SLASH = `<script>if(!/\\/$/.test(location.pathname))location.replace(location.pathname+'/'+location.search+location.hash)</script>\n`;
const base = `books/${B.slug}/video/`, site = `https://voicedrop.cn/books/${B.slug}/video/`;
let bytes = 0;
await pool(files, 6, async f => {
  const rel = path.relative(H, f).split(path.sep).join('/'), ext = rel.split('.').pop().toLowerCase();
  let body = fs.readFileSync(f); if (rel === 'index.html') body = Buffer.from(SLASH + body.toString('utf8'));
  bytes += body.length; if (dry) return;
  for (let k = 0; ; k++) {
    const r = await fetch(`https://jianshuo.dev/files/api/upload/${base}${rel.split('/').map(encodeURIComponent).join('/')}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': TYPES[ext] || 'application/octet-stream' }, body, signal: AbortSignal.timeout(300000) });
    if (r.ok) return;
    if (k === 2) throw new Error(`上传失败 ${rel}：${r.status} ${(await r.text()).slice(0, 200)}`);
    await new Promise(s => setTimeout(s, 2000 * (k + 1)));
  }
});
console.log(`${dry ? '（演习）' : ''}发布 ${files.length} 个文件、${(bytes / 1e6).toFixed(1)}MB → R2 ${base}`);
if (dry) process.exit(0);
// 验证：从公网取入口页、引擎、口播，看状态和类型
for (const [rel, want] of [['', 'text/html'], ['engine.js', 'javascript'], ['narration.mp3', 'audio/mpeg']]) {
  const r = await fetch(site + rel + `?_=${Date.now()}`, { method: rel === 'narration.mp3' ? 'HEAD' : 'GET' }), ct = r.headers.get('content-type') || '';
  console.log(`${r.ok && ct.includes(want) ? '✓' : '✗'} ${site}${rel}  ${r.status} ${ct}`);
}
console.log(`公开地址：${site}`);
