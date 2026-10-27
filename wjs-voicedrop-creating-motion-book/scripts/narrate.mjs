#!/usr/bin/env node
// 口播＝书架有声书的整章朗读（不写新稿、不调 TTS）：ch01…chNN 各自
//   1. 音频/chNN.mp3 ← 听书接口 <base>/<slug>/<stem>：先 HEAD 查缓存（HEAD 不触发合成）；GET 有缓存直接回源，没缓存由听书接口合成一次并写回 R2
//      ——以后用户听书、再做动画都不再花 TTS 的钱。我们这边从不往听书缓存里写。
//   2. 音频/chNN.asr.json ← 火山大模型流式 ASR（直接推 mp3 字节，不用解码）
//   3. 稿/chNN.txt ← 听书接口 <stem>.txt 给的朗读原文（合成时实际念的那份：有脚本用脚本，没有就是章节页编排）；
//      字幕用原文，ASR 只出时间——ASR 文本会听错字（2026-10-27 用户报：字幕错字）。原文拿不到、或对齐率 < 80%
//      （修过书、缓存的 mp3 还是旧稿）才退回 ASR 文本。音频/chNN.句时间.txt ← 原文按 ASR 字时间对齐
// 已有的文件跳过（删掉 chNN.mp3 才会重取）；默认 3 章并发。凭据：VOLC_ASR_APPID/VOLC_ASR_ACCESS_TOKEN（或 VOLC_APPID/VOLC_TOKEN）。
// 用法：node narrate.mjs <项目目录> [ch03 ch07 …] [-j 3]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ensureWebSocket, loadEnv, book, chapterIds, alignPhrases, formatRows, mp3Frames, pool } from './common.mjs';
ensureWebSocket();

const args = process.argv.slice(2); let jobs = 3;
const ji = args.indexOf('-j'); if (ji >= 0) { jobs = +args[ji + 1]; args.splice(ji, 2); }
const P = path.resolve(args[0]), only = new Set(args.slice(1)), A = path.join(P, '音频'), env = loadEnv(), B = book(P);
const AB = { base: 'https://jianshuo.dev/voicedrop/books/audiobook', ...(B.audiobook || {}) };
const stemOf = ch => (AB.stems || [])[+ch.slice(2) - 1] || ch.slice(2);   // 听书章节 stem，缺省 01、02…

// ---------- 听书音频 ----------
async function audiobookMp3(ch) {
  const url = `${AB.base}/${encodeURIComponent(B.slug)}/${encodeURIComponent(stemOf(ch))}`;
  const head = () => fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 0, headers: new Headers() }));
  const h = await head(), hit = h.status === 200;
  let r = await fetch(url, { signal: AbortSignal.timeout(900000) });   // 没缓存时这一下触发合成（8 分钟音频约 1 分钟合成完）
  if (!r.ok) throw new Error(`听书接口 ${r.status}：${url}`);
  let buf = Buffer.from(await r.arrayBuffer());
  // 没缓存时拿到的是边合成边推的流，可能中途断（2026-10-25《炮声里的股市》第 8 章只拿到 72 秒）。
  // 听书接口会在后台合成完整章写进 R2，所以等缓存出现，再取缓存里那份完整的。
  if (!hit) {
    let cl = 0;
    for (let k = 0; k < 60; k++) { const hh = await head(); cl = +(hh.headers.get('content-length') || 0); if (hh.status === 200 && cl > 0) break; await new Promise(s => setTimeout(s, 10000)); }
    if (!cl) throw new Error(`听书缓存 10 分钟还没写好：${url}`);
    r = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!r.ok) throw new Error(`取听书缓存 ${r.status}：${url}`);
    buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < cl * 0.98) throw new Error(`听书缓存没取全：${buf.length}/${cl} 字节`);
  }
  return { mp3: Buffer.concat(mp3Frames(buf).frames), hit };   // 只留音频帧：多段朗读每段都带 ID3 头，夹在中间 ASR 会报 Invalid audio format
}

// 朗读原文（不触发合成；拿不到返回 null，调用方退回 ASR 文本）
async function audiobookText(ch) {
  const url = `${AB.base}/${encodeURIComponent(B.slug)}/${encodeURIComponent(stemOf(ch))}.txt`;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); return r.ok ? (await r.text()).trim() : null; } catch { return null; }
}
const MIN_RATIO = 0.8;

// ---------- ASR（大模型流式识别）----------
async function asrOnce(mp3) {
  const fmt = mp3Frames(mp3);
  const hdr = (t, f, ser = 1) => Buffer.from([0x11, (t << 4) | f, (ser << 4) | 1, 0]);
  const i32 = n => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; }, u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const pkt = (h, seq, body) => { const z = zlib.gzipSync(body); return Buffer.concat([h, i32(seq), u32(z.length), z]); };
  const parse = d => { d = Buffer.from(d); const mt = d[1] >> 4, fl = d[1] & 15, comp = d[2] & 15; let p = d.subarray(4); if (fl & 3) p = p.subarray(4);
    if (mt === 15) { const sz = p.readUInt32BE(4); let b = p.subarray(8, 8 + sz); if (comp === 1) b = zlib.gunzipSync(b); return { _error: p.readUInt32BE(0), _msg: b.toString() }; }
    const sz = p.readUInt32BE(0); let b = p.subarray(4, 4 + sz); if (comp === 1 && b.length) b = zlib.gunzipSync(b); const o = b.length ? JSON.parse(b) : {}; o._last = !!(fl & 2); return o; };
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://openspeech.bytedance.com/api/v3/sauc/bigmodel', { headers: { 'X-Api-App-Key': env.VOLC_ASR_APPID || env.VOLC_APPID, 'X-Api-Access-Key': env.VOLC_ASR_ACCESS_TOKEN || env.VOLC_TOKEN, 'X-Api-Resource-Id': 'volc.bigasr.sauc.duration', 'X-Api-Connect-Id': crypto.randomUUID() } });
    ws.binaryType = 'arraybuffer'; let last = null; const timer = setTimeout(() => { ws.close(); reject(new Error('ASR 超时')); }, 900000);
    ws.onopen = async () => {
      ws.send(pkt(hdr(1, 1), 1, Buffer.from(JSON.stringify({ user: { uid: 'wjs-motion-book' }, audio: { format: 'mp3', rate: fmt.sr, channel: 1 }, request: { model_name: 'bigmodel', enable_punc: true, enable_itn: true, show_utterances: true } }))));
      const CH = 6400; let seq = 1;   // 64kbps 的 mp3 这样推约 40 倍速
      for (let i = 0; i < mp3.length; i += CH) { seq++; const end = i + CH >= mp3.length; ws.send(pkt(hdr(2, end ? 3 : 1, 0), end ? -seq : seq, mp3.subarray(i, i + CH))); await new Promise(r => setTimeout(r, 20)); }
    };
    ws.onmessage = e => { const r = parse(e.data); if (r._error) { clearTimeout(timer); ws.close(); return reject(new Error(`ASR 错误 ${r._error}: ${r._msg}`)); }
      if (r.result) last = r; if (r._last) { clearTimeout(timer); ws.close(); last ? resolve({ result: last.result }) : reject(new Error('ASR 没有结果')); } };
    ws.onerror = e => { clearTimeout(timer); reject(new Error('ASR 连接失败：' + (e.message || e.type))); };
  });
}
async function asr(mp3) {
  for (let k = 0; ; k++) { try { return await asrOnce(mp3); } catch (e) { if (k === 2) throw e; await new Promise(r => setTimeout(r, 2000 * (k + 1))); } }
}

// ---------- 每章 ----------
async function one(ch) {
  const mp3f = path.join(A, `${ch}.mp3`), asrf = path.join(A, `${ch}.asr.json`), txt = path.join(P, '稿', `${ch}.txt`); let note = '';
  try {
    if (!fs.existsSync(mp3f)) {
      const { mp3, hit } = await audiobookMp3(ch); fs.writeFileSync(mp3f, mp3); fs.rmSync(asrf, { force: true }); fs.rmSync(txt, { force: true });
      note = hit ? '，听书缓存命中' : '，听书缓存没有→经听书接口合成一次（已写回 R2）';
    }
    const mp3 = fs.readFileSync(mp3f);
    if (!fs.existsSync(asrf) || !fs.statSync(asrf).size) fs.writeFileSync(asrf, JSON.stringify(await asr(mp3), null, 1));
    const res = JSON.parse(fs.readFileSync(asrf, 'utf8')), asrText = res.result.text + '\n';
    // 稿 = ASR 原样的是老流程留下的，当作没有，换成原文；手改过的稿不动。
    if (!fs.existsSync(txt) || fs.readFileSync(txt, 'utf8') === asrText) {
      const orig = await audiobookText(ch);
      const ok = orig && alignPhrases(res, orig).ratio >= MIN_RATIO;
      fs.writeFileSync(txt, ok ? orig + '\n' : asrText);
      note += ok ? '，字幕用原文' : `，⚠ 原文${orig ? `对不上（<${MIN_RATIO * 100}%）` : '拿不到'}→字幕退回 ASR 文本`;
    }
    const al = alignPhrases(res, fs.readFileSync(txt, 'utf8'));
    fs.writeFileSync(path.join(A, `${ch}.句时间.txt`), formatRows(al.rows));
    return `${ch} ${mp3Frames(mp3).dur.toFixed(1).padStart(6)}s  ${al.rows.length} 句，对上 ${Math.round(al.ratio * 100)}% 的字${note}`;
  } catch (e) { return `✗ ${ch} ${e.message}`; }
}
for (const d of [A, path.join(P, '稿')]) fs.mkdirSync(d, { recursive: true });
const chs = chapterIds(B).filter(c => !only.size || only.has(c));
const out = await pool(chs, jobs, async ch => { const s = await one(ch); console.log(s); return s; });
if (out.some(s => s.startsWith('✗'))) process.exit(1);
