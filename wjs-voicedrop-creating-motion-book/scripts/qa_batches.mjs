#!/usr/bin/env node
// qa.py 分批跑（要 Chromium，Mac 上跑）：一次跑完三百多镜，Playwright 驱动会在两百镜左右偶发断开（EPIPE，不固定在哪一镜），
// 所以每批一个进程，失败的批自动重试，最后合并成一份 qa.json / qa.md（deliver.py --qa 读它）和 框景线索.txt。
// 用法：node qa_batches.mjs <项目目录> <输出目录> [--ids 逗号分隔的镜头 id] [--size 70] [--film book]
// 可续跑：已有 qa.json 的批跳过。只验改过的几镜：--ids c02_hypo,c05_overlap
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const N = +opt('size', 70), idsOnly = opt('ids'), FILM = opt('film', 'book');
const P = path.resolve(args[0]), OUT = path.resolve(args[1]); fs.mkdirSync(OUT, { recursive: true });
const QA = path.join(os.homedir(), '.claude/skills/huashu-art-motion/scripts/qa.py');
const ids = idsOnly ? idsOnly.split(',') : [...fs.readFileSync(path.join(P, `代码工程/eras_${FILM}.js`), 'utf8').matchAll(/\["(\w+)", [\d.]+, [\d.]+/g)].map(m => m[1]);
const batches = []; for (let i = 0; i < ids.length; i += N) batches.push(ids.slice(i, i + N));
const qaJson = k => path.join(OUT, `b${k}`, 'qa.json');
batches.forEach((b, k) => {
  for (let attempt = 0; attempt < 3 && !fs.existsSync(qaJson(k)); attempt++) {
    const log = fs.openSync(path.join(OUT, `b${k}.log`), 'w');
    spawnSync('uv', ['run', QA, '--project', path.join(P, '代码工程'), '--film', FILM, '--fps', '30', '--sub-band', '0.74', '--ids', b.join(','), '--out', path.join(OUT, `b${k}`)],
      { stdio: ['ignore', log, log], env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    fs.closeSync(log);
  }
  console.log(`批 ${k + 1}/${batches.length}`, fs.existsSync(qaJson(k)) ? '✓' : `✗（重试 3 次仍断，见 b${k}.log）`);
});
const parts = batches.map((_, k) => fs.existsSync(qaJson(k)) ? JSON.parse(fs.readFileSync(qaJson(k), 'utf8')) : null).filter(Boolean);
if (!parts.length) { console.error('一批都没跑成'); process.exit(1); }
const rep = { ...parts[0], segments: parts.flatMap(p => p.segments), transitions: parts.flatMap(p => p.transitions || []), page_errors: parts.flatMap(p => p.page_errors) };
fs.writeFileSync(path.join(OUT, 'qa.json'), JSON.stringify(rep, null, 1));
fs.writeFileSync(path.join(OUT, 'qa.md'), batches.map((_, k) => path.join(OUT, `b${k}`, 'qa.md')).filter(f => fs.existsSync(f)).map((f, k) => `## 批 ${k + 1}\n\n` + fs.readFileSync(f, 'utf8')).join('\n\n'));
const fr = rep.segments.flatMap(g => g.framing.map(x => [g.id, x]));
fs.writeFileSync(path.join(OUT, '框景线索.txt'), fr.map(([i, x]) => `${((x.t[0] + x.t[1]) / 2).toFixed(2)}|${x.kind}|${i}|${x.text}\n`).join(''));
console.log(`合并：${rep.segments.length}/${ids.length} 镜，页面报错 ${rep.page_errors.length} 条，框景线索 ${fr.length} 条（${path.join(OUT, '框景线索.txt')}，逐条抽帧看）-> ${OUT}`);
