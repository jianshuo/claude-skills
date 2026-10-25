#!/usr/bin/env node
// run_book.sh / reaper.sh 的小工具（以前内嵌在 shell 里的 python 片段都收到这里）。只依赖 Node ≥20。
//   node mb.mjs state <state.json> <state> <step> <url> <logTail> <startedSec> <only> <instance>   写进度（logTail 只内部用，接口不往外给）
//   node mb.mjs event <events.json> <text>      对外日志追加一条（同一句不连着重复记，最多留 300 条）
//   node mb.mjs get <js 表达式，d 是 stdin 的 JSON>   例：… | node mb.mjs get 'd.instance.id'
//   node mb.mjs summary <probe JSON> <章数> <kits 目录>   把探针结果翻成对外日志的几句话，一行一句
//   node mb.mjs stale <小时>                    stdin 是 Vultr 实例列表 JSON，打印超时实例「id 小时数 label」
import fs from 'node:fs';
import path from 'node:path';

const [cmd, ...a] = process.argv.slice(2);
const writeJSON = (f, o) => { fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); };
const stdin = () => fs.readFileSync(0, 'utf8');

if (cmd === 'state') {
  const [f, state, step, url, tail, started, only, inst] = a;
  const d = { state, step, startedAt: Number(started) * 1000, updatedAt: Date.now(), only, instance: inst };
  if (url) d.url = url;
  if (tail) d.logTail = tail;
  writeJSON(f, d);
} else if (cmd === 'event') {
  const [f, text] = a; let L = [];
  try { L = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  if (!L.length || L.at(-1).text !== text) L.push({ t: Date.now(), text });
  writeJSON(f, L.slice(-300));
} else if (cmd === 'get') {
  const d = JSON.parse(stdin());
  console.log(new Function('d', `return (${a[0]})`)(d));
} else if (cmd === 'summary') {
  const [pj, nch, kits] = a, p = JSON.parse(pj), out = [];
  const kitName = k => { try { return JSON.parse(fs.readFileSync(path.join(kits, k, 'kit.json'), 'utf8')).label.split('（')[0]; } catch { return k; } };
  if (p.mp3) out.push(`取口播（书架听书）：${p.mp3}/${nch} 章`);
  if (p.asr) out.push(`识别口播、对齐句子：${p.asr}/${nch} 章`);
  if (p.kit) out.push(`选定画风：${kitName(p.kit)}`);
  if (p.shots) out.push(`分章制作：已交稿 ${p.shots} 段`);
  if (p.smoke) out.push(`整本冒烟检查：${p.smoke.shots} 个镜头，报错 ${p.smoke.errors}，缺字 ${p.smoke.glyphs}，框景线索 ${p.smoke.framing}`);
  if (p.html) out.push('打包网页版完成');
  if (p.result) out.push('写好制作说明');
  console.log(out.join('\n'));
} else if (cmd === 'stale') {
  const maxh = Number(a[0]);
  for (const i of JSON.parse(stdin()).instances || []) {
    const age = (Date.now() - Date.parse(i.date_created)) / 3600e3;
    if (age > maxh) console.log(`${i.id} ${age.toFixed(2)} ${i.label}`);
  }
} else { console.error('用法见文件头'); process.exit(2); }
