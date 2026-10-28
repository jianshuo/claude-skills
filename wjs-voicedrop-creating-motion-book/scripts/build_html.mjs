#!/usr/bin/env node
// 把整本书打包成浏览器里直接播放的网页（默认交付物，不经 MP4）：画面实时绘制，时间取口播 <audio> 的 currentTime。纯 Node＋（可选）uvx 跑字体子集，不要 ffmpeg。
// - 脚本：引擎库 + eras_book.js 的 SCENE_LIBS，全部 <script charset="utf-8"> 直接引入（不写 charset 中文会乱码）
// - 字体：场景代码里用到的 family，按 lib/fonts.js 拷原文件（GB2312 全集，每个 1.4–2.2MB）；播放器先 fetch 成 ArrayBuffer 再注册 FontFace
// - 音频：音频/全片口播.mp3 原样拷（豆包 24kHz 单声道 64kbps，20 分钟约 11MB）
// 播放器是公用组件 player/template.html，改样式改那一份，所有书一起变。
// 用法：node build_html.mjs <项目目录> [输出目录，默认 <项目>/html]
// 本地自测：输出目录里的 _test.html（补了 <meta charset>）用任意静态服务器打开。发布：Artifact 的 files 用 artifact_files.json；或整个目录传到 R2 / 静态站。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SK, book } from './common.mjs';

const P0 = path.resolve(process.argv[2]), smokeF = path.join(P0, 'qa/smoke/smoke.json');
if (!fs.existsSync(smokeF)) console.log('⚠ 还没跑冒烟检查：node smoke.mjs <项目>（运行时报错会让 HTML 播到那一镜卡住）');
else { const r = JSON.parse(fs.readFileSync(smokeF, 'utf8')); if (r.boot || r.errors.length || r.glyphs.length) console.log(`⚠ 冒烟检查有问题没修：启动 ${r.boot ? '失败' : '正常'}、运行时报错 ${r.errors.length}、缺字形 ${r.glyphs.length}（qa/smoke/smoke.json）`);
  else if (fs.statSync(smokeF).mtimeMs < fs.statSync(path.join(P0, '代码工程/eras_book.js')).mtimeMs) console.log('⚠ 冒烟检查比最近一次总装旧，重跑 node smoke.mjs <项目>'); }
const P = P0, OUT = path.resolve(process.argv[3] || path.join(P, 'html')), E = path.join(P, '代码工程'), B = book(P);
const LIBS = ['util', 'paint', 'brush', 'render', 'post', 'rig', 'rig_huashu', 'kit', 'medium', 'motion', 'camera', 'diagram', 'typo', 'chart', 'ui', 'collage', 'media', 'toon'];
const eras = fs.readFileSync(path.join(E, 'eras_book.js'), 'utf8');
const sceneLibs = JSON.parse(eras.match(/window\.SCENE_LIBS = (\[.*?\]);/)[1]);
const cp = (src, rel) => { const d = path.join(OUT, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(src, d); };
fs.mkdirSync(OUT, { recursive: true });
for (const f of [...LIBS.map(n => `lib/${n}.js`), 'transitions.js', 'engine.js', 'eras_book.js', 'scenes/index.js', ...sceneLibs]) cp(path.join(E, f), f);
const faces = Object.fromEntries([...fs.readFileSync(path.join(E, 'lib/fonts.js'), 'utf8').matchAll(/\{family:'([^']+)', url:'([^']+)'/g)].map(m => [m[1], m[2]]));
const code = sceneLibs.map(f => fs.readFileSync(path.join(E, f), 'utf8')).join('\n');
const used = Object.keys(faces).filter(fam => new RegExp(`["']${fam.replace(/[-]/g, '\\-')}["']`).test(code)).sort();
for (const fam of used) cp(path.join(E, faces[fam]), `fonts/${fam}${path.extname(faces[fam])}`);
cp(path.join(P, '音频/全片口播.mp3'), 'narration.mp3');
const total = Math.max(...[...eras.matchAll(/\["\w+", [\d.]+, ([\d.]+)/g)].map(m => +m[1]));
const mmss = `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`;
const fonts = JSON.stringify(used.map(fam => [fam, `fonts/${fam}${path.extname(faces[fam])}`]));
let page = fs.readFileSync(path.join(SK, 'player/template.html'), 'utf8');
for (const [k, v] of Object.entries({ TITLE: B.title, TOTAL: total.toFixed(2), MMSS: mmss, ERAS: 'eras_book.js', FONTS: fonts,
  LIBTAGS: LIBS.slice(1).map(n => `<script charset="utf-8" src="lib/${n}.js"></script>`).join('\n'),
  SCENETAGS: sceneLibs.map(f => `<script charset="utf-8" src="${f}"></script>`).join('\n') })) page = page.replaceAll(`{{${k}}}`, v);
// 指纹：入口页里每个引用（脚本、字体、口播）带 ?v=<内容哈希>。voicedrop.cn 的 EdgeOne 把 js/字体/mp3 缓存在国内边缘（mp3 30 天），
// 改镜重发后入口页（不缓存）指向新地址，边缘的旧文件自然不再被请求，不会出现新画面配旧口播。
const hash = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
page = page.replace(/(["'])((?:lib|scenes|fonts)\/[^"'?]+|transitions\.js|engine\.js|eras_book\.js|narration\.mp3)\1/g,
  (m, q, f) => fs.existsSync(path.join(OUT, f)) ? `${q}${f}?v=${hash(path.join(OUT, f))}${q}` : m);
fs.writeFileSync(path.join(OUT, 'index.html'), page);
// 首开提速：合包、字体子集（woff2）、预加载。失败不拦发布，退回未优化的入口页照样能播。
try { execFileSync('node', [path.join(SK, 'scripts/optimize_html.mjs'), OUT], { stdio: 'inherit' }); page = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'); }
catch (e) { console.warn('⚠ 首开提速没做成，发未优化版：' + e.message); fs.writeFileSync(path.join(OUT, 'index.html'), page); }
fs.writeFileSync(path.join(OUT, '_test.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + page + '</body></html>');
const files = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : files.push(f); } }; walk(OUT);
const pub = Object.fromEntries(files.filter(f => !['index.html', '_test.html', 'artifact_files.json'].includes(path.basename(f))).sort().map(f => [path.relative(OUT, f), f]));
fs.writeFileSync(path.join(OUT, 'artifact_files.json'), JSON.stringify(pub, null, 0));   // Artifact 发布时原样传给 files
const size = files.filter(f => path.basename(f) !== '_test.html').reduce((s, f) => s + fs.statSync(f).size, 0), big = files.filter(f => fs.statSync(f).size > 15e6);
console.log(`《${B.title}》：${sceneLibs.length} 个场景文件，字体 ${used.join(' ')}，时长 ${mmss}，总大小 ${(size / 1e6).toFixed(1)}MB -> ${OUT}` + (big.length ? `\n⚠ 超过 Artifact 单文件 15MB：${big.join(' ')}` : ''));
