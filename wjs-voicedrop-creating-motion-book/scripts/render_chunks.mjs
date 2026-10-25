#!/usr/bin/env node
// MP4（可选产物，要 Chromium，Mac 上跑）：按章切段，每段一个 render.py 进程（渲完退出、内存归还），已渲好的段跳过（可续跑），
// 最后 ffmpeg 无损拼接、混入全片音轨。16GB 的 Mac 上同时最多 2 个渲染进程，一次整片渲会被内存回收杀掉。
// 用法：node render_chunks.mjs <项目目录> <输出 mp4> [-j 2]
// 改了某几章：删掉 <输出>_chunks/chNN.mp4 再跑（其余段直接复用）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { book, pool } from './common.mjs';

const args = process.argv.slice(2); let jobs = 2;
const ji = args.indexOf('-j'); if (ji >= 0) { jobs = Math.min(2, +args[ji + 1]); args.splice(ji, 2); }
const P = path.resolve(args[0]), out = path.resolve(args[1]);   // 绝对路径：render.py 在 代码工程/ 下运行
const E = path.join(P, '代码工程'), eras = fs.readFileSync(path.join(E, 'eras_book.js'), 'utf8'), B = book(P);
const [W, H] = B.size || [1080, 1920], fps = String(B.fps || 30);
const offs = JSON.parse(eras.match(/CHAPTER_OFFSETS = (\{.*?\});/)[1]), keys = Object.keys(offs);
const total = Math.max(...[...eras.matchAll(/\["\w+", [\d.]+, ([\d.]+)/g)].map(m => +m[1]));
const bounds = keys.map((k, i) => [k, offs[k], i + 1 < keys.length ? offs[keys[i + 1]] : total]);
const cdir = path.join(path.dirname(out), `${path.basename(out, '.mp4')}_chunks`); fs.mkdirSync(cdir, { recursive: true });

const run = (cmd, argv, opt) => new Promise(res => { const c = spawn(cmd, argv, { ...opt, stdio: ['ignore', 'pipe', 'pipe'] }); let o = '';
  c.stdout.on('data', d => (o = (o + d).slice(-1500))); c.stderr.on('data', d => (o = (o + d).slice(-1500))); c.on('close', code => res({ code, o })); c.on('error', e => res({ code: -1, o: String(e) })); });
const res = await pool(bounds, jobs, async ([k, a, b]) => {
  const seg = path.join(cdir, `${k}.mp4`);
  if (fs.existsSync(seg) && fs.statSync(seg).size > 0) return console.log(`${k} 已有，跳过`), true;
  const tmp = path.join(cdir, `${k}.part.mp4`), st = Date.now();
  const r = await run('uv', ['run', '--with', 'playwright', 'python', 'render.py', '--film', 'book', '--width', String(W), '--height', String(H), '--fps', fps,
    '--from', a.toFixed(4), '--to', b.toFixed(4), '--out', tmp], { cwd: E });
  if (r.code || !fs.existsSync(tmp)) return console.log(`✗ ${k} 渲染失败：\n${r.o}`), false;
  fs.renameSync(tmp, seg); console.log(`${k} 完成 ${(b - a).toFixed(1)}s 用时 ${Math.round((Date.now() - st) / 1000)}s`); return true;
});
if (res.includes(false)) { console.error('有段落渲染失败，修好后重跑（已完成的段会跳过）'); process.exit(1); }
const lst = path.join(cdir, 'list.txt'); fs.writeFileSync(lst, bounds.map(([k]) => `file '${path.join(cdir, k + '.mp4')}'\n`).join(''));
const noaud = path.join(cdir, 'all.noaudio.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', noaud], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', noaud, '-i', path.join(P, '音频', '全片口播.mp3'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`完成 -> ${out}（${d}s，段落表 ${total.toFixed(1)}s）`);
