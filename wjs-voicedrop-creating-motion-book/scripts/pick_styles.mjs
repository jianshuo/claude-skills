#!/usr/bin/env node
// 抽画风候选（探索期用，见 references/选画风.md）：
//   - 新画风 2 个：从 huashu-art-motion 风格总索引「材料层」「时代标本」两张表里，挑还没做成套件的（kits/*/kit.json 的 recipe 字段），
//     ★★★ 权重 3、★★ 权重 1.5、★ 不要；**不看题材**随机抽——题材贴不贴交给评委，探索期就是要把每种画风都试一遍。
//   - 已有套件 1 个：按 kits/USAGE.tsv 的用量，用得越少权重越大（1/(1+次数)）；fits 命中本书题材的另列出来，评审时可以换成它。
// 用法：node pick_styles.mjs [--n 2] [--seed 任意字符串]   输出给人看的几行 + 最后一行 JSON
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = +(opt('--n') ?? 2), seed = opt('--seed');
const SK = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), KITS = path.join(SK, 'kits');
const ENGINE = process.env.HUASHU_ENGINE ? path.resolve(process.env.HUASHU_ENGINE, '../..') : path.join(os.homedir(), '.claude/skills/huashu-art-motion');
const INDEX = path.join(ENGINE, 'references/风格配方/INDEX.md');

// 随机数：给了 --seed 就可复现
let st = seed ? crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) : crypto.randomInt(2 ** 31);
const rand = () => { st = (st * 1103515245 + 12345) % 2147483648; return st / 2147483648; };
const draw = (items, w) => { const tot = items.reduce((s, x) => s + w(x), 0); let r = rand() * tot; for (const x of items) { r -= w(x); if (r <= 0) return x; } return items.at(-1); };

// 风格总索引：只认「材料层」「时代标本」两节的表格行（研究配方那节没做完，不进）
const md = fs.readFileSync(INDEX, 'utf8'), styles = [];
let sec = '';
for (const l of md.split('\n')) {
  if (l.startsWith('## ')) { sec = l.includes('材料层') ? '材料层' : l.includes('时代标本') ? '时代标本' : ''; continue; }
  if (!sec || !/^\| \d\d_/.test(l)) continue;
  const c = l.split('|').map(s => s.trim()), q = c.at(-3) || '';
  const stars = q.startsWith('★★★') ? 3 : q.startsWith('★★') ? 2 : 1;
  styles.push({ id: c[1], name: c[2].replace(/\[([^\]]+)\]\([^)]*\)/, '$1'), how: c[3], stars, layer: sec, card: `references/风格配方/${c[1]}.md` });
}

const kits = fs.readdirSync(KITS).filter(d => fs.existsSync(path.join(KITS, d, 'kit.json')))
  .map(d => ({ name: d, ...JSON.parse(fs.readFileSync(path.join(KITS, d, 'kit.json'), 'utf8')) }));
const usage = {}; try { for (const l of fs.readFileSync(path.join(KITS, 'USAGE.tsv'), 'utf8').split('\n')) { const k = l.split('\t')[2]; if (k) usage[k] = (usage[k] || 0) + 1; } } catch {}
const tried = new Set(kits.map(k => k.recipe).filter(Boolean));

const pool = styles.filter(s => s.stars >= 2 && !tried.has(s.id)), picks = [];
for (let i = 0; i < N && pool.length; i++) { const p = draw(pool, s => s.stars === 3 ? 3 : 1.5); picks.push(p); pool.splice(pool.indexOf(p), 1); }
const kit = kits.length ? draw(kits, k => 1 / (1 + (usage[k.name] || 0))) : null;

console.log(`探索进度：${tried.size}/${styles.filter(s => s.stars >= 2).length} 种（★★ 以上）已做成套件；还没试过的 ${styles.filter(s => s.stars >= 2 && !tried.has(s.id)).length} 种`);
picks.forEach((p, i) => console.log(`新画风 ${i + 1}：${p.id} ${p.name}（${'★'.repeat(p.stars)}，${p.layer}）—— ${p.how}；卡片 huashu-art-motion/${p.card}`));
if (kit) console.log(`已有套件：${kit.name}（${kit.label.split('（')[0]}，已用 ${usage[kit.name] || 0} 次）；全部套件用量：${kits.map(k => `${k.name} ${usage[k.name] || 0}`).join('、')}`);
console.log(JSON.stringify({ new: picks.map(({ id, name, stars, layer, card }) => ({ id, name, stars, layer, card })), kit: kit?.name ?? null, usage, tried: [...tried] }));
