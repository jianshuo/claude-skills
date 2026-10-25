#!/usr/bin/env node
// 做书机上的进度探针：run_book.sh 每 2 分钟 ssh 过去跑一次（skill 开机时已克隆到做书机），打印一行 JSON（只有数字和画风名，不带路径）。
// 用法：node probe.mjs <slug> [项目根目录，缺省 ~/art-films]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const P = path.join(process.argv[3] || path.join(os.homedir(), 'art-films'), process.argv[2] || '');
const count = (dir, re) => { try { return fs.readdirSync(path.join(P, dir)).filter(f => re.test(f)).length; } catch { return 0; } };
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(P, f), 'utf8')); } catch { return null; } };
const s = read('qa/smoke/smoke.json'), b = read('book.json');
console.log(JSON.stringify({
  mp3: count('音频', /^ch\d\d\.mp3$/), asr: count('音频', /^ch\d\d\.asr\.json$/), shots: count('音频', /\.shots\.json$/),
  scenes: count('代码工程/scenes/book', /^ch.*\.js$/), html: fs.existsSync(path.join(P, 'html/index.html')), result: fs.existsSync(path.join(P, 'RESULT.md')),
  kit: b?.kit || '', smoke: s ? { shots: s.shots || 0, errors: (s.errors || []).length, glyphs: (s.glyphs || []).length, framing: (s.framing || []).length, boot: !!s.boot } : null,
}));
