#!/usr/bin/env node
// 取书（不要 VoiceDrop MCP，云端机器用）：读书架公开的 _src/book.json，写出章名文件，打印 new_book.mjs 要的参数。
// 要做的章没写完（status 不是 done）就报错退出——听书接口对没写完的章拿不到正文。
// 用法：node fetch_book.mjs <slug> <输出章名文件> [--only ch01,ch02,ch03]
import fs from 'node:fs';

const [slug, out] = process.argv.slice(2), oi = process.argv.indexOf('--only');
const only = oi > 0 ? new Set(process.argv[oi + 1].split(',')) : null;
if (!slug || !out) { console.error('用法：node fetch_book.mjs <slug> <输出章名文件> [--only ch01,…]'); process.exit(2); }
const r = await fetch(`https://jianshuo.dev/voicedrop/books/${encodeURIComponent(slug)}/_src/book.json?_=${Date.now()}`, { signal: AbortSignal.timeout(30000) });
if (!r.ok) { console.error(`书架上没有 ${slug}（HTTP ${r.status}）`); process.exit(1); }
const b = await r.json(), chs = (b.chapters || []).slice().sort((x, y) => x.no - y.no);
const name = t => String(t || '').split(/\s*·\s*/).slice(1).join(' · ') || String(t || '');   // 「第一章 · 一个家的操作系统」→「一个家的操作系统」
const want = chs.filter(c => !only || only.has(`ch${String(c.no).padStart(2, '0')}`));
const notDone = want.filter(c => c.status !== 'done');
if (notDone.length) { console.error(`还没写完的章：${notDone.map(c => c.no).join(' ')}（书还在写，等写完再做）`); process.exit(1); }
fs.writeFileSync(out, chs.map(c => name(c.title)).join('\n') + '\n');
const stems = chs.map(c => String(c.no).padStart(2, '0'));
console.log(JSON.stringify({ slug, title: b.title, author: b.author || '', type: b.type, chapters: chs.length, stems, briefs: chs.map(c => c.brief) }, null, 1));
