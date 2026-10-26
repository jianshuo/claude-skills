#!/usr/bin/env node
// 片头封面（要 ffmpeg，Mac 上跑）：把书封做成一段 1 秒片头（封面居中、同图放大虚化填满上下），配同规格静音，
// 与正片同参数编码后无损拼接到最前面；再把书封写进 MP4 封面元数据（attached_pic），播放器/文件预览/下载后的缩略图都是书封。
// 正片只拷贝不重编码，78 分钟的片子十几秒完成。
// 封面来源：--cover <图>，否则 <项目>/cover.jpg，再否则从书架取 https://voicedrop.cn/books/<slug>/cover.jpg 存到 <项目>/cover.jpg。
// 用法：node add_cover.mjs <项目目录> <输入 mp4> [<输出 mp4，默认原地替换>] [--cover 图] [--sec 1]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { book } from './common.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
let cover = opt('cover'); const sec = +opt('sec', 1);
const P = path.resolve(args[0]), inp = path.resolve(args[1]), out = path.resolve(args[2] || args[1]), B = book(P);
if (!cover) {
  cover = path.join(P, 'cover.jpg');
  if (!fs.existsSync(cover)) {
    const r = await fetch(`https://voicedrop.cn/books/${B.slug}/cover.jpg`);
    if (!r.ok) { console.error(`书架上没有《${B.title}》的封面（HTTP ${r.status}），用 --cover 指定`); process.exit(1); }
    fs.writeFileSync(cover, Buffer.from(await r.arrayBuffer()));
  }
}
const probe = (sel, entries) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', entries, '-of', 'default=nw=1:nk=1', inp]).toString().trim().split('\n');
const [W, H, fr, tb] = probe('v:0', 'stream=width,height,r_frame_rate,time_base'), [sr, ch] = probe('a:0', 'stream=sample_rate,channels');
const fps = fr, ts = tb.split('/')[1], dur = s => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', s]).toString();

const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.cover_')), head = path.join(tmp, 'head.mp4'), lst = path.join(tmp, 'list.txt'), dst = path.join(tmp, 'out.mp4');
const ff = a => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });
ff(['-loop', '1', '-framerate', fps, '-t', String(sec), '-i', cover, '-f', 'lavfi', '-t', String(sec), '-i', `anullsrc=r=${sr}:cl=${ch == 1 ? 'mono' : 'stereo'}`,
  '-filter_complex', `[0]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:2,eq=brightness=-0.06[bg];` +
    `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]`,
  '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', fps,
  '-c:a', 'aac', '-b:a', '256k', '-video_track_timescale', ts, '-shortest', head]);
fs.writeFileSync(lst, `file '${head}'\nfile '${inp}'\n`);
ff(['-f', 'concat', '-safe', '0', '-i', lst, '-i', cover, '-map', '0:v', '-map', '0:a', '-map', '1', '-c', 'copy', '-disposition:v:1', 'attached_pic', '-movflags', '+faststart', dst]);
const d0 = dur(inp), d1 = dur(dst);
if (Math.abs(d1 - d0 - sec) > 0.2) { console.error(`时长不对：原片 ${d0}s，加片头后 ${d1}s（应多 ${sec}s），未替换`); process.exit(1); }
fs.renameSync(dst, out); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`片头封面 -> ${out}（${d0.toFixed(1)}s + ${sec}s = ${d1.toFixed(1)}s）`);
