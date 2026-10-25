#!/usr/bin/env node
// 口播：稿/chNN.txt → 音频/chNN.mp3（火山豆包 seed-tts-2.0，HTTP 流式）→ chNN.asr.json（火山流式 ASR，直接推 mp3）→ chNN.句时间.txt（按字对齐）
// 句时间默认用 ASR：TTS 自带的字级时间戳在停顿后的句首常晚 0.5–1s（实测 16–18% 的句子差 >0.3s）；ASR 失败时退回 TTS 时间戳并在输出里标出。
// 只重做稿子比 mp3 新的章；默认 3 章并发。凭据：VOLC_TTS_APPID/VOLC_TTS_ACCESS_TOKEN（或 VOLC_TTS_API_KEY）、VOLC_ASR_APPID/VOLC_ASR_ACCESS_TOKEN（或 VOLC_APPID/VOLC_TOKEN）。
// 用法：node narrate.mjs <项目目录> [ch03 ch07 …] [-j 3]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ensureWebSocket, loadEnv, book, alignPhrases, formatRows, ttsWordsAsAsr, mp3Frames, pool } from './common.mjs';
ensureWebSocket();

const args = process.argv.slice(2); let jobs = 3;
const ji = args.indexOf('-j'); if (ji >= 0) { jobs = +args[ji + 1]; args.splice(ji, 2); }
const P = path.resolve(args[0]), only = new Set(args.slice(1)), A = path.join(P, '音频'), env = loadEnv(), B = book(P), V = B.voice || {};

// ---------- TTS ----------
const TTS_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const ANNOT = /【([^】]*)】|\[([^\]\[]{1,60})\]/g;   // 【表演描述】不念，转成该段的语音指令
function segments(text) {
  const out = []; let pos = 0, instr = null;
  for (const m of text.matchAll(ANNOT)) { const c = text.slice(pos, m.index).trim(); if (c) out.push([instr, c]); instr = (m[1] || m[2]).trim() || null; pos = m.index + m[0].length; }
  const t = text.slice(pos).trim(); if (t) out.push([instr, t]); return out;
}
function ttsHeaders() {
  const base = { 'Content-Type': 'application/json', 'X-Api-Resource-Id': 'seed-tts-2.0' }, c = [];
  if (env.VOLC_TTS_API_KEY) c.push({ ...base, 'X-Api-Key': env.VOLC_TTS_API_KEY });
  if (env.VOLC_TTS_APPID && env.VOLC_TTS_ACCESS_TOKEN) c.push({ ...base, 'X-Api-App-Id': env.VOLC_TTS_APPID, 'X-Api-Access-Key': env.VOLC_TTS_ACCESS_TOKEN }, { ...base, 'X-Api-App-Key': env.VOLC_TTS_APPID, 'X-Api-Access-Key': env.VOLC_TTS_ACCESS_TOKEN });
  if (!c.length) throw new Error('没有 TTS 凭据（VOLC_TTS_APPID + VOLC_TTS_ACCESS_TOKEN，或 VOLC_TTS_API_KEY）');
  return c;
}
// 响应是一串首尾相接的 JSON 对象：按花括号深度切（跳过字符串里的括号）
function* jsonObjects(state, chunk) {
  state.buf += chunk;
  for (;;) {
    const s = state.buf, st = s.indexOf('{'); if (st < 0) { state.buf = ''; return; }
    let d = 0, inStr = false, esc = false, end = -1;
    for (let i = st; i < s.length; i++) { const c = s[i];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') d++; else if (c === '}' && --d === 0) { end = i; break; } }
    if (end < 0) { state.buf = s.slice(st); return; }
    yield JSON.parse(s.slice(st, end + 1)); state.buf = s.slice(end + 1);
  }
}
async function tts(text) {
  const section = crypto.randomUUID(), audio = [], words = []; let hdrs = null;
  for (const [instr, seg] of segments(text)) {
    const additions = { section_id: section }, ins = instr ? [instr] : (V.instruction ? [V.instruction] : []);
    if (ins.length) additions.context_texts = ins;   // 实测多条只有第一条生效；段内标注独占
    const body = JSON.stringify({ req_params: { text: seg, speaker: V.speaker || 'zh_female_vv_uranus_bigtts', audio_params: { format: 'mp3', sample_rate: 24000, enable_subtitle: true }, additions: JSON.stringify(additions) } });
    let err = null, ok = false;
    for (const h of hdrs ? [hdrs] : ttsHeaders()) {
      const r = await fetch(TTS_URL, { method: 'POST', headers: { ...h, 'X-Api-Request-Id': crypto.randomUUID() }, body, signal: AbortSignal.timeout(300000) });
      if (!r.ok) { err = `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`; continue; }
      const st = { buf: '' }, dec = new TextDecoder(), got = []; let fail = null;
      for await (const chunk of r.body) for (const o of jsonObjects(st, dec.decode(chunk, { stream: true }))) {
        if (o.code && o.code !== 20000000) { fail = `服务端错误 code=${o.code}: ${o.message}`; break; }
        if (o.data) got.push(Buffer.from(o.data, 'base64'));
        if (o.sentence?.words) words.push(...o.sentence.words.map(w => ({ ...w, startTime: w.startTime + audio.reduce((s, b) => s + b.dur, 0), endTime: w.endTime + audio.reduce((s, b) => s + b.dur, 0) })));
      }
      if (fail || !got.length) { err = fail || '流结束但没有音频'; continue; }
      const buf = Buffer.concat(got); audio.push({ buf, dur: mp3Frames(buf).dur }); hdrs = h; ok = true; break;
    }
    if (!ok) throw new Error('合成失败：' + err);
  }
  return { mp3: Buffer.concat(audio.flatMap(a => mp3Frames(a.buf).frames)), words };   // 只留音频帧：分段合成的每段都带 ID3 头，夹在中间 ASR 会报 Invalid audio format
}

// ---------- ASR（大模型流式识别；直接推 mp3 字节，不用解码）----------
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
    ws.binaryType = 'arraybuffer'; let last = null; const timer = setTimeout(() => { ws.close(); reject(new Error('ASR 超时')); }, 300000);
    ws.onopen = async () => {
      ws.send(pkt(hdr(1, 1), 1, Buffer.from(JSON.stringify({ user: { uid: 'wjs-motion-book' }, audio: { format: 'mp3', rate: fmt.sr, channel: 1 }, request: { model_name: 'bigmodel', enable_punc: true, enable_itn: true, show_utterances: true } }))));
      const CH = 6400; let seq = 1;
      for (let i = 0; i < mp3.length; i += CH) { seq++; const end = i + CH >= mp3.length; ws.send(pkt(hdr(2, end ? 3 : 1, 0), end ? -seq : seq, mp3.subarray(i, i + CH))); await new Promise(r => setTimeout(r, 20)); }
    };
    ws.onmessage = e => { const r = parse(e.data); if (r._error) { clearTimeout(timer); ws.close(); return reject(new Error(`ASR 错误 ${r._error}: ${r._msg}`)); }
      if (r.result) last = r; if (r._last) { clearTimeout(timer); ws.close(); last ? resolve({ result: last.result }) : reject(new Error('ASR 没有结果')); } };
    ws.onerror = e => { clearTimeout(timer); reject(new Error('ASR 连接失败：' + (e.message || e.type))); };
  });
}
async function asr(mp3) {
  for (let k = 0; k < 3; k++) { try { return await asrOnce(mp3); } catch (e) { if (k === 2) throw e; await new Promise(r => setTimeout(r, 2000 * (k + 1))); } }
}

// ---------- 每章 ----------
async function one(ch) {
  const txt = path.join(P, '稿', `${ch}.txt`), mp3f = path.join(A, `${ch}.mp3`), asrf = path.join(A, `${ch}.asr.json`), text = fs.readFileSync(txt, 'utf8').trim();
  try {
    if (!fs.existsSync(mp3f) || fs.statSync(mp3f).mtimeMs < fs.statSync(txt).mtimeMs) {
      const { mp3, words } = await tts(text); fs.writeFileSync(mp3f, mp3); fs.writeFileSync(mp3f + '.words.json', JSON.stringify(words, null, 1)); fs.rmSync(asrf, { force: true });
    }
    const mp3 = fs.readFileSync(mp3f); let src = 'ASR', res;
    if (!fs.existsSync(asrf) || !fs.statSync(asrf).size) {
      try { fs.writeFileSync(asrf, JSON.stringify(await asr(mp3), null, 1)); } catch (e) { src = `TTS 时间戳（ASR 失败：${e.message}）`; }
    }
    const spoken = text.replace(ANNOT, '');   // 【表演标注】不念，也不进句时间和字幕
    res = alignPhrases(src === 'ASR' ? JSON.parse(fs.readFileSync(asrf, 'utf8')) : ttsWordsAsAsr(JSON.parse(fs.readFileSync(mp3f + '.words.json', 'utf8'))), spoken);
    fs.writeFileSync(path.join(A, `${ch}.句时间.txt`), formatRows(res.rows));
    return `${ch} ${mp3Frames(mp3).dur.toFixed(1).padStart(6)}s  句时间来自 ${src}，对上 ${Math.round(res.ratio * 100)}% 的字`;
  } catch (e) { return `✗ ${ch} ${e.message}`; }
}
fs.mkdirSync(A, { recursive: true });
const chs = fs.readdirSync(path.join(P, '稿')).filter(f => /^ch\d\d\.txt$/.test(f)).map(f => f.slice(0, 4)).filter(c => !only.size || only.has(c)).sort();
if (!chs.length) { console.error('稿/ 下没有 chNN.txt'); process.exit(1); }
const out = await pool(chs, jobs, async ch => { const s = await one(ch); console.log(s); return s; });
if (out.some(s => s.startsWith('✗'))) process.exit(1);
