#!/usr/bin/env node
// 开一本新书的动画工程：复制 huashu-art-motion 引擎、装上画风套件（含套件自带字体）、写 book.json、meta.js 和章节制作规范。纯 Node。
// 用法：node new_book.mjs <项目目录> --slug <书 slug> --title <书名> --kit <套件名> --chapters <章名文件，一行一个> [--author 作者] [--stems 01,02,…（听书章节 stem，缺省 01…NN）]
// 已存在的东西不覆盖（可重复跑来补齐）；套件 lib.js 每次刷新成 skill 里的最新版。引擎位置：$HUASHU_ENGINE 或 ~/.claude/skills/huashu-art-motion/scripts/engine
import fs from 'node:fs';
import path from 'node:path';
import { SK, ENGINE, readJSON, writeJSON } from './common.mjs';

const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const P = path.resolve(argv[0]), slug = opt('slug'), title = opt('title'), kitName = opt('kit'), chf = opt('chapters');
if (!argv[0] || !slug || !title || !kitName || !chf) { console.error('用法：node new_book.mjs <项目目录> --slug … --title … --kit … --chapters 章名.txt'); process.exit(1); }
const KIT = path.join(SK, 'kits', kitName);
if (!fs.existsSync(path.join(KIT, 'lib.js'))) { console.error(`没有套件 ${kitName}；现有：${fs.readdirSync(path.join(SK, 'kits')).join(' ')}`); process.exit(1); }
if (!fs.existsSync(path.join(ENGINE, 'engine.js'))) { console.error(`找不到 huashu-art-motion 引擎：${ENGINE}（git clone https://github.com/alchaincyf/huashu-art-motion 到 ~/.claude/skills/，或设 HUASHU_ENGINE）`); process.exit(1); }
const kit = readJSON(path.join(KIT, 'kit.json'));
const names = fs.readFileSync(chf, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const E = path.join(P, '代码工程'), Bd = path.join(E, 'scenes/book');

for (const d of ['稿', '音频', '镜头表', '静帧', '审片', 'qa', 'output', 'html']) fs.mkdirSync(path.join(P, d), { recursive: true });
if (!fs.existsSync(E)) { fs.cpSync(ENGINE, E, { recursive: true, filter: s => !s.includes('__pycache__') }); console.log('引擎 ->', E); }
fs.mkdirSync(Bd, { recursive: true });
fs.copyFileSync(path.join(KIT, 'lib.js'), path.join(Bd, 'lib.js'));
if (!fs.existsSync(path.join(Bd, 'props.js'))) fs.writeFileSync(path.join(Bd, 'props.js'),
  `// 《${title}》专属道具（贯穿物、反复出现的物件）。挂在 K 上，名字别和套件撞；章节卡上的主物在这里改 cardToken / cardCenter。\n(() => { const D = K, C = D.C, { W, H, TAU } = D, { clamp, lerp } = U;\n})();\n`);
fs.writeFileSync(path.join(Bd, 'meta.js'), `window.BOOK_META = ${JSON.stringify({ title, chapters: names })};\n`);

// 套件自带字体（开源许可、GB2312 全集）→ lib/fonts/，并注册进 lib/fonts.js
const fj = path.join(E, 'lib/fonts.js'); let reg = fs.readFileSync(fj, 'utf8');
for (const f of kit.fonts || []) {
  fs.copyFileSync(path.join(KIT, 'fonts', f.file), path.join(E, 'lib/fonts', f.file));
  if (!reg.includes(`'${f.family}'`)) reg = reg.replace('window.FONT_FACES = [\n', `window.FONT_FACES = [\n  {family:'${f.family}', url:'lib/fonts/${f.file}'},   // 套件 ${kitName}：${kit.fonts_note || ''}\n`);
}
fs.writeFileSync(fj, reg);

if (!fs.existsSync(path.join(P, 'book.json'))) writeJSON(path.join(P, 'book.json'), { slug, title, author: opt('author') || '', kit: kitName, chapters: names, size: [1080, 1920], fps: 30, gap: 0.8,
  audiobook: { base: 'https://jianshuo.dev/voicedrop/books/audiobook', ...(opt('stems') ? { stems: opt('stems').split(',') } : {}) } });
let spec = fs.readFileSync(path.join(SK, 'references/章节制作规范.md'), 'utf8');
for (const [k, v] of Object.entries({ TITLE: title, KIT: kitName, KIT_LABEL: kit.label, GRAMMAR: kit.grammar, PALETTE: kit.palette, API: kit.api, N: String(names.length), DIR: P })) spec = spec.replaceAll(`{{${k}}}`, v);
fs.writeFileSync(path.join(P, '制作规范.md'), spec);
console.log(`《${title}》：${names.length} 章，套件 ${kitName} -> ${P}\n下一步：node narrate.mjs ${P}（取听书音频＋ASR）`);
