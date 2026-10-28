#!/usr/bin/env node
// 首开提速（2026-10-28）：对 build_html 的输出目录做三件事，可重复跑（已经做过的步骤自动跳过）。
// 实测改之前冷启动 10–12 秒，是四段串行：入口页 → 50 个同步小脚本（4s，全是往返）→ 2–4MB 全量字体（3.6s）→ engine.js（1.6s）。
//  1. 合包：入口页里 FONT_FACES 到播放器主脚本之间的所有 <script>（外链＋夹在中间的内联小段）按原顺序拼成一个 bundle.js。
//     经典脚本本来就共用一个全局作用域，拼起来语义不变；唯一区别是一处抛错会停掉后面整包——冒烟检查（smoke.mjs）保证启动不报错。
//  2. 字体子集：只留这本书脚本里出现过的字（字幕、标题、计数器……）＋ASCII＋中文标点，转 woff2。GB2312 全集 2MB 一个 → 几百 KB。
//     用 uvx 跑 fonttools（云端做书机和 Mac 都有 uv）；没有 uv 或失败就保留原字体，只打印警告，不让发布失败。
//     漏掉的字浏览器会退回系统字体画，不会空白。
//  3. 预加载：<head> 里给字体（as=fetch，播放器用 fetch 取字体，写 as=font 会重复下载）和 engine.js 加 preload，
//     让它们和 bundle 同时开始下，不再排队。
// 用法：node optimize_html.mjs <html 目录>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const H = path.resolve(process.argv[2]), IDX = path.join(H, 'index.html');
let page = fs.readFileSync(IDX, 'utf8');
const hash = buf => crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
const strip = u => u.split('?')[0];
const log = [];

// ① 合包
const START = '<script>window.FONT_FACES', MAIN = '\n<script>\n(() => {';
if (!page.includes('src="bundle.js')) {
  const a = page.indexOf(START), b = page.indexOf(MAIN, a);
  if (a < 0 || b < 0) throw new Error('入口页里找不到脚本段（FONT_FACES … 播放器主脚本）');
  const seg = page.slice(a, b), parts = [];
  for (const m of seg.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = m[1].match(/src="([^"]+)"/);
    parts.push(src ? `// ── ${strip(src[1])}\n` + fs.readFileSync(path.join(H, strip(src[1])), 'utf8') : `// ── 内联\n${m[2]}`);
  }
  const bundle = Buffer.from(parts.join('\n;\n') + '\n');
  fs.writeFileSync(path.join(H, 'bundle.js'), bundle);
  page = page.slice(0, a) + `<script charset="utf-8" src="bundle.js?v=${hash(bundle)}"></script>` + page.slice(b);
  log.push(`合包 ${parts.length} 段 → bundle.js ${(bundle.length / 1024).toFixed(0)}KB`);
}

// ② 字体子集
const fm = page.match(/const loadFonts = Promise\.all\((\[.*?\])\.map\(/);
let fonts = fm ? JSON.parse(fm[1]) : [];
if (fonts.some(([, u]) => !strip(u).endsWith('.woff2'))) {
  const js = ['bundle.js', 'engine.js'].map(f => fs.existsSync(path.join(H, f)) ? fs.readFileSync(path.join(H, f), 'utf8') : '').join('\n')
    .replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (m, a, b) => String.fromCodePoint(parseInt(a || b, 16)));   // 转义写的字也算
  const chars = new Set(js.match(/[^\x00-\x7f]/gu));
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const c of '，。、！？：；“”‘’（）《》〈〉【】「」『』—…·％～　') chars.add(c);
  const tf = path.join(os.tmpdir(), `mb-chars-${process.pid}.txt`); fs.writeFileSync(tf, [...chars].join(''));
  fonts = fonts.map(([fam, url]) => {
    const src = path.join(H, strip(url)), out = src.replace(/\.(woff2?|ttf|otf)$/, '') + '.woff2';
    if (src === out) return [fam, url];
    try {
      execFileSync('uvx', ['--quiet', '--from', 'fonttools[woff]', 'pyftsubset', src, `--text-file=${tf}`, '--flavor=woff2', `--output-file=${out}`,
        '--layout-features=*', '--no-hinting', '--desubroutinize'], { stdio: ['ignore', 'ignore', 'pipe'] });
      const rel = path.relative(H, out).split(path.sep).join('/');
      log.push(`字体 ${fam}：${(fs.statSync(src).size / 1e6).toFixed(1)}MB → ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
      return [fam, `${rel}?v=${hash(fs.readFileSync(out))}`];
    } catch (e) { console.warn(`⚠ 字体 ${fam} 子集化失败，保留原文件：${String(e.stderr || e.message).slice(0, 200)}`); return [fam, url]; }
  });
  fs.rmSync(tf, { force: true });
  log.push(`字符集 ${chars.size} 个`);
  page = page.replace(fm[1], JSON.stringify(fonts));
}

// ③ 预加载（每次按当前引用重写，旧的先删）
page = page.replace(/<link rel="preload"[^>]*data-mb>\n?/g, '');
const eng = page.match(/s\.src = '(engine\.js[^']*)'/);
const pre = [...fonts.map(([, u]) => `<link rel="preload" href="${u}" as="fetch" crossorigin data-mb>`),
  ...(eng ? [`<link rel="preload" href="${eng[1]}" as="script" data-mb>`] : [])].join('\n');
page = page.replace(/(<title>[^<]*<\/title>\n?)/, `$1${pre}\n`);

fs.writeFileSync(IDX, page);
console.log(`首开提速：${log.join('；') || '已是优化过的'}；预加载 ${fonts.length} 个字体＋engine.js`);
