#!/usr/bin/env node
// 分章 MP4（要 ffmpeg，在渲过 MP4 的机器上跑）：render_chunks.mjs 留下的 <输出>_chunks/chNN.mp4 就是每章画面，
// 按段落表的章起止从全片口播切出同一段音频合上（画面只拷贝不重编码），再接 add_cover.mjs 的书封片头。
// 产物：<成片目录>/分章/NN_章名.mp4。已有的跳过（删掉重跑即可更新某章）。
// 用法：node split_chapters.mjs <项目目录> [<成片 mp4，默认 <项目>/成片/成片_v1.mp4>] [--no-cover]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { book } from './common.mjs';

const args = process.argv.slice(2), nc = args.indexOf('--no-cover'), noCover = nc >= 0; if (noCover) args.splice(nc, 1);
const P = path.resolve(args[0]), film = path.resolve(args[1] || path.join(P, '成片', '成片_v1.mp4')), B = book(P);
const eras = fs.readFileSync(path.join(P, '代码工程', 'eras_book.js'), 'utf8');
const offs = JSON.parse(eras.match(/CHAPTER_OFFSETS = (\{.*?\});/)[1]), keys = Object.keys(offs);
const total = Math.max(...[...eras.matchAll(/\["\w+", [\d.]+, ([\d.]+)/g)].map(m => +m[1]));
const cdir = path.join(path.dirname(film), `${path.basename(film, '.mp4')}_chunks`), odir = path.join(path.dirname(film), '分章');
const audio = path.join(P, '音频', '全片口播.mp3'); fs.mkdirSync(odir, { recursive: true });
const safe = s => s.replace(/[\/\\:*?"<>|]/g, '·').trim();
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();

for (const [i, k] of keys.entries()) {
  const a = offs[k], b = i + 1 < keys.length ? offs[keys[i + 1]] : total, n = +k.replace(/\D/g, '');
  const seg = path.join(cdir, `${k}.mp4`), out = path.join(odir, `${String(n).padStart(2, '0')}_${safe(B.chapters[n - 1] || k)}.mp4`);
  if (fs.existsSync(out)) { console.log(`已有，跳过：${path.basename(out)}`); continue; }
  if (!fs.existsSync(seg)) { console.error(`✗ 缺分段画面 ${seg}（先跑 render_chunks.mjs）`); process.exitCode = 1; continue; }
  const tmp = out.replace(/\.mp4$/, '.part.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', seg, '-ss', a.toFixed(4), '-t', (b - a).toFixed(4), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  if (!noCover) execFileSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'add_cover.mjs'), P, tmp], { stdio: 'inherit' });
  fs.renameSync(tmp, out); console.log(`${path.basename(out)}  ${dur(out).toFixed(1)}s（段落表 ${(b - a).toFixed(1)}s${noCover ? '' : ' + 1s 片头'}）`);
}
