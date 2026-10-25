#!/usr/bin/env node
// 口播＝书架有声书的整章朗读（不写新稿、不调 TTS）：ch01…chNN 各自
//   1. 音频/chNN.mp3 ← 听书接口 <base>/<slug>/<stem>：先 HEAD 查缓存（HEAD 不触发合成）；GET 有缓存直接回源，没缓存由听书接口合成一次并写回 R2
//      ——以后用户听书、再做动画都不再花 TTS 的钱。我们这边从不往听书缓存里写。
//   2. 音频/chNN.asr.json ← 火山大模型流式 ASR（直接推 mp3 字节，不用解码）
//   3. 稿/chNN.txt ← ASR 文本（听书是从章节页自动编排朗读的，以听到的为准）；音频/chNN.句时间.txt ← 按字对齐
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
  const h = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  const r = await fetch(url, { signal: AbortSignal.timeout(900000) });   // 没缓存时 8 分钟音频约 1 分钟合成完
  if (!r.ok) throw new Error(`听书接口 ${r.status}：${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { mp3: Buffer.concat(mp3Frames(buf).frames), hit: h.status === 200 };   // 只留音频帧：多段朗读每段都带 ID3 头，夹在中间 ASR 会报 Invalid audio format
}

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
    const res = JSON.parse(fs.readFileSync(asrf, 'utf8'));
    if (!fs.existsSync(txt)) fs.writeFileSync(txt, res.result.text + '\n');
    const al = alignPhrases(res, fs.readFileSync(txt, 'utf8'));
    fs.writeFileSync(path.join(A, `${ch}.句时间.txt`), formatRows(al.rows));
    return `${ch} ${mp3Frames(mp3).dur.toFixed(1).padStart(6)}s  ${al.rows.length} 句，对上 ${Math.round(al.ratio * 100)}% 的字${note}`;
  } catch (e) { return `✗ ${ch} ${e.message}`; }
}
for (const d of [A, path.join(P, '稿')]) fs.mkdirSync(d, { recursive: true });
const chs = chapterIds(B).filter(c => !only.size || only.has(c));
const out = await pool(chs, jobs, async ch => { const s = await one(ch); console.log(s); return s; });
if (out.some(s => s.startsWith('✗'))) process.exit(1);
