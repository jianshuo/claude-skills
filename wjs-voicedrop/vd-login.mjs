#!/usr/bin/env node
// vd-login — log THIS machine into a VoiceDrop account by device-pairing with the phone.
// Plays the "new device" role of the device-link protocol against the live Worker.
// Zero npm deps: Node >= 20 built-ins only (crypto / fetch / global WebSocket).
//
//   node ~/.claude/skills/wjs-voicedrop/vd-login.mjs start  <6-hex>   # phone 设置→账户 shows the 6-char code
//   node ~/.claude/skills/wjs-voicedrop/vd-login.mjs finish <4-digit> # the 4-digit code the phone then pops up
//   node ~/.claude/skills/wjs-voicedrop/vd-login.mjs status           # who am I (verifies the token is still live)
//   node ~/.claude/skills/wjs-voicedrop/vd-login.mjs logout           # forget the credential
//
// On success the account's anon_… token lands in ~/.config/voicedrop/credentials (0600);
// other skills read it to act as that user. NOTE: this is the account's FULL secret,
// copied — not a scoped/revocable sub-token. Keep the file private.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const AGENT = 'https://jianshuo.dev/agent/link';
const FILES = 'https://jianshuo.dev/files/api';
const DIR = path.join(os.homedir(), '.config', 'voicedrop');
const CRED = path.join(DIR, 'credentials');
const STATE = path.join(DIR, '.pairing.json');

// ── E2E crypto (must match the iOS DeviceLinkCrypto + the Worker contract) ──
const salt = Buffer.from('voicedrop-device-link/v1');
const info = Buffer.from('anon-token');
const SPKI = Buffer.from('302a300506032b656e032100', 'hex'); // X25519 SPKI header
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const rawPub = ko => ko.export({ format: 'der', type: 'spki' }).subarray(-32);
const impPub = raw => crypto.createPublicKey({ key: Buffer.concat([SPKI, raw]), format: 'der', type: 'spki' });
const hkdf = sh => Buffer.from(crypto.hkdfSync('sha256', sh, salt, info, 32));
const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex');
const randTok = () => 'anon_' + crypto.randomBytes(32).toString('hex');

function decrypt(blob, priv) {
  const sh = crypto.diffieHellman({ privateKey: priv, publicKey: impPub(unb64url(blob.epk)) });
  const key = hkdf(sh);
  const comb = unb64url(blob.sealed);
  const nonce = comb.subarray(0, 12), tag = comb.subarray(comb.length - 16), ct = comb.subarray(12, comb.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, nonce); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString();
}
function writePrivate(p, obj) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify(obj), { mode: 0o600 });
  fs.chmodSync(p, 0o600);
}

// ── Step 1: send the phone's 6-hex + our ephemeral pubkey; the phone pops a 4-digit code ──
export async function doStart(sixHex) {
  const hex = String(sixHex || '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return { ok: false, error: 'bad_code', message: '6 位代码应为十六进制（手机 设置→账户 里那串）' };
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
  const bearer = randTok(); // throwaway identity, only for rate-limit; not our final account
  const res = await fetch(`${AGENT}/start`, {
    method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: hex, pubkey: b64url(rawPub(publicKey)) }),
  }).then(r => r.json()).catch(e => ({ ok: false, error: 'network', message: String(e) }));
  if (res.reason === 'no_match') return { ok: false, error: 'no_match', message: '没找到这个账号——确认手机 设置→账户 里的 6 位码，且手机在线、已登录、装了支持配对的版本' };
  if (!res.ok || !res.pairingId) return { ok: false, error: 'start_failed', message: JSON.stringify(res) };
  writePrivate(STATE, { pairingId: res.pairingId, priv: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'), bearer });
  return { ok: true, pairingId: res.pairingId, matchCount: res.matchCount };
}

// ── Step 2: enter the 4-digit code; the phone releases its token; we decrypt + store it ──
export async function doFinish(fourDigit) {
  const code = String(fourDigit || '').trim();
  if (!/^[0-9]{4}$/.test(code)) return { ok: false, error: 'bad_code', message: '验证码应为 4 位数字' };
  if (!fs.existsSync(STATE)) return { ok: false, error: 'no_pairing', message: '请先运行 start' };
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const priv = crypto.createPrivateKey({ key: Buffer.from(st.priv, 'base64'), format: 'der', type: 'pkcs8' });

  const ws = new WebSocket(`wss://jianshuo.dev/agent/link/socket?pairingId=${st.pairingId}`);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('socket error')), { once: true });
  });
  const outcome = new Promise((resolve) => {
    ws.addEventListener('message', (ev) => {
      let o; try { o = JSON.parse(ev.data); } catch { return; }
      if (o.type === 'link_ready') resolve({ ready: o });
      else if (o.type === 'link_cancelled') resolve({ cancelled: true });
      else if (o.type === 'link_expired') resolve({ expired: true });
    });
  });

  const vr = await fetch(`${AGENT}/verify`, {
    method: 'POST', headers: { Authorization: `Bearer ${st.bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ pairingId: st.pairingId, code }),
  }).then(r => r.json()).catch(() => ({ ok: false, error: 'network' }));
  if (!vr.ok) {
    if (vr.dead) { fs.rmSync(STATE, { force: true }); ws.close(); return { ok: false, error: 'too_many_attempts', message: '验证失败次数过多，请重新 start' }; }
    if (vr.expired) { fs.rmSync(STATE, { force: true }); ws.close(); return { ok: false, error: 'expired', message: '配对已过期，请重新 start' }; }
    ws.close(); return { ok: false, error: 'wrong_code', remaining: vr.remaining, message: `验证码不对，还可试 ${vr.remaining ?? '?'} 次` };
  }

  const result = await Promise.race([outcome, new Promise(r => setTimeout(() => r({ timeout: true }), 25000))]);
  ws.close();
  if (result.timeout) return { ok: false, error: 'timeout', message: '手机没有响应——确认手机在线、app 在前台、已登录该账号' };
  if (result.cancelled) return { ok: false, error: 'cancelled', message: '对方在手机上点了「不是我」' };
  if (result.expired) return { ok: false, error: 'expired', message: '配对已过期，请重新 start' };

  let token;
  try { token = decrypt(result.ready.blob, priv); } catch (e) { return { ok: false, error: 'decrypt_failed', message: String(e) }; }
  if (!token.startsWith('anon_')) return { ok: false, error: 'bad_token', message: '收到的不是有效凭证' };
  const scope = `users/anon-${sha256hex(token).slice(0, 32)}/`;
  writePrivate(CRED, { token, scope, loginAt: Math.floor(Date.now() / 1000) });
  fs.rmSync(STATE, { force: true });
  return { ok: true, scope, credentials: CRED };
}

export function readCreds() { try { return JSON.parse(fs.readFileSync(CRED, 'utf8')); } catch { return null; } }
export function logout() { fs.rmSync(CRED, { force: true }); fs.rmSync(STATE, { force: true }); }

// ── CLI (only when run directly, not when imported) ──
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [cmd, arg] = process.argv.slice(2);
  const out = (o) => { console.log(JSON.stringify(o)); process.exit(o.ok === false ? 1 : 0); };
  (async () => {
    if (cmd === 'start') return out(await doStart(arg));
    if (cmd === 'finish') return out(await doFinish(arg));
    if (cmd === 'status') {
      const c = readCreds();
      if (!c) return out({ ok: false, error: 'not_logged_in', message: '未登录，运行 /vd-login' });
      const who = await fetch(`${FILES}/whoami`, { headers: { Authorization: `Bearer ${c.token}` } }).then(r => r.ok ? r.json() : null).catch(() => null);
      return out({ ok: true, scope: c.scope, loginAt: c.loginAt, live: who?.scope === c.scope, credentials: CRED });
    }
    if (cmd === 'logout') { logout(); return out({ ok: true, message: '已登出' }); }
    return out({ ok: false, error: 'usage', message: 'usage: vd-login.mjs start <6hex> | finish <4digit> | status | logout' });
  })();
}
