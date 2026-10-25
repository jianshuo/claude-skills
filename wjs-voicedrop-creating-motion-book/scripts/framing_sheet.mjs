#!/usr/bin/env node
// 框景线索拼图（要 Chromium，Mac 上跑）：qa / 冒烟检查的「半截字/进字幕带/叠字」逐条出两帧（线索中点、0.8 秒后），拼成几张总图一次看完。
// 两帧都切边＝真出画（多半是长镜头里推近中心偏了、或开场初始状态在画外），要改；只有前一帧有＝转场或动画中途，不改。
// 不需要 MP4：直接用 render.py --stills 按全片时间出帧。
// 用法：node framing_sheet.mjs <项目目录> <qa 输出目录> [片名，缺省 book]   → <qa 目录>/框景/sheet_N.png ＋ 序号表
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const P = path.resolve(process.argv[2]), Q = path.resolve(process.argv[3]), FILM = process.argv[4] || 'book';
const rows = fs.readFileSync(path.join(Q, '框景线索.txt'), 'utf8').split('\n').filter(l => l.trim()).map(l => l.split('|'));
if (!rows.length) { console.error('没有框景线索'); process.exit(1); }
const D = path.join(Q, '框景'); fs.mkdirSync(D, { recursive: true });
const r2 = t => Math.round(t * 100) / 100, name = t => `t${r2(t).toFixed(2).padStart(6, '0')}.png`;   // 和 render.py 的 t{:06.2f}.png 一致
const ts = [...new Set(rows.flatMap(r => [r2(+r[0]), r2(+r[0] + 0.8)]))].sort((a, b) => a - b);
execFileSync('uv', ['run', '--with', 'playwright', 'python', 'render.py', '--film', FILM, '--width', '1080', '--height', '1920', '--stills', ts.join(','), '--out', path.join(D, 'raw')],
  { cwd: path.join(P, '代码工程'), stdio: ['ignore', 'ignore', 'inherit'] });
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });
const pairs = rows.map((r, i) => {
  const o = path.join(D, `p${String(i).padStart(3, '0')}.png`);
  ff('-i', path.join(D, 'raw', name(+r[0])), '-i', path.join(D, 'raw', name(+r[0] + 0.8)), '-filter_complex', '[0]scale=200:-1[x];[1]scale=200:-1[y];[x][y]hstack', o);
  return o;
});
const per = 12, cols = 6;   // 每张 6 列 × 2 行，一格 = 一条线索的两帧
for (let s = 0; s < pairs.length; s += per) {
  const g = pairs.slice(s, s + per), n = g.length, lay = g.map((_, k) => `${(k % cols) * 400}_${Math.floor(k / cols) * 356}`).join('|');
  ff(...g.flatMap(p => ['-i', p]), '-filter_complex', n > 1 ? `${g.map((_, k) => `[${k}]`).join('')}xstack=inputs=${n}:layout=${lay}:fill=black` : 'null', path.join(D, `sheet_${s / per + 1}.png`));
}
rows.forEach((r, i) => console.log(`图${Math.floor(i / per) + 1} 格${String(i % per + 1).padStart(2)}  ${(+r[0]).toFixed(2).padStart(7)}s  ${r[1]}  ${r[2]}  ${r[3]}`));
console.log('->', D);
