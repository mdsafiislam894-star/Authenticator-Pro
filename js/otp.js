// OTP core: Base32, HOTP, TOTP, Steam Guard, otpauth:// URI parse/build.
// Pure ES module. Works in browsers and in Node 20+ (globalThis.crypto).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s=-]+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('অবৈধ Base32 secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function isValidSecret(s) {
  try {
    return base32Decode(s).length >= 10;
  } catch {
    return false;
  }
}

const ALGO = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

async function hmac(algorithm, keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: ALGO[algorithm] || 'SHA-1' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, msgBytes));
}

function counterBytes(counter) {
  const buf = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return buf;
}

function truncate(mac) {
  const off = mac[mac.length - 1] & 0x0f;
  return (
    ((mac[off] & 0x7f) << 24) |
    (mac[off + 1] << 16) |
    (mac[off + 2] << 8) |
    mac[off + 3]
  ) >>> 0;
}

export async function hotp(secret, counter, { digits = 6, algorithm = 'SHA1' } = {}) {
  const mac = await hmac(algorithm, base32Decode(secret), counterBytes(counter));
  const num = truncate(mac) % 10 ** digits;
  return String(num).padStart(digits, '0');
}

export async function totp(secret, { period = 30, digits = 6, algorithm = 'SHA1', time = Date.now() } = {}) {
  const counter = Math.floor(time / 1000 / period);
  return hotp(secret, counter, { digits, algorithm });
}

const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';

export async function steamCode(secret, { time = Date.now() } = {}) {
  const counter = Math.floor(time / 1000 / 30);
  const mac = await hmac('SHA1', base32Decode(secret), counterBytes(counter));
  let num = truncate(mac);
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += STEAM_ALPHABET[num % STEAM_ALPHABET.length];
    num = Math.floor(num / STEAM_ALPHABET.length);
  }
  return out;
}

// Generate the current code for an account object.
export async function generateCode(acc, time = Date.now()) {
  if (acc.type === 'steam') return steamCode(acc.secret, { time });
  if (acc.type === 'hotp') {
    return hotp(acc.secret, acc.counter || 0, { digits: acc.digits, algorithm: acc.algorithm });
  }
  return totp(acc.secret, { period: acc.period, digits: acc.digits, algorithm: acc.algorithm, time });
}

export function secondsLeft(period = 30, time = Date.now()) {
  return period - (Math.floor(time / 1000) % period);
}

// ---- otpauth:// URIs ----

export function parseOtpauth(uri) {
  const u = new URL(uri.trim());
  if (u.protocol !== 'otpauth:') throw new Error('এটা otpauth লিংক নয়');
  const type = u.hostname.toLowerCase();
  if (!['totp', 'hotp'].includes(type)) throw new Error('অসমর্থিত টাইপ: ' + type);
  const label = decodeURIComponent(u.pathname.replace(/^\//, ''));
  const p = u.searchParams;
  let issuer = p.get('issuer') || '';
  let name = label;
  if (label.includes(':')) {
    const i = label.indexOf(':');
    const labIssuer = label.slice(0, i).trim();
    name = label.slice(i + 1).trim();
    if (!issuer) issuer = labIssuer;
  }
  const secret = (p.get('secret') || '').replace(/\s+/g, '').toUpperCase();
  if (!isValidSecret(secret)) throw new Error('Secret অবৈধ বা খুব ছোট');
  const algorithm = (p.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  const isSteam = issuer.toLowerCase() === 'steam' || p.get('encoder') === 'steam';
  return {
    type: isSteam ? 'steam' : type,
    issuer,
    name,
    secret,
    algorithm: ALGO[algorithm] ? algorithm : 'SHA1',
    digits: isSteam ? 5 : parseInt(p.get('digits') || '6', 10),
    period: parseInt(p.get('period') || '30', 10),
    counter: parseInt(p.get('counter') || '0', 10),
  };
}

export function buildOtpauth(acc) {
  const type = acc.type === 'steam' ? 'totp' : acc.type;
  const label = acc.issuer
    ? `${encodeURIComponent(acc.issuer)}:${encodeURIComponent(acc.name)}`
    : encodeURIComponent(acc.name);
  const q = new URLSearchParams({ secret: acc.secret });
  if (acc.issuer) q.set('issuer', acc.issuer);
  if (acc.algorithm && acc.algorithm !== 'SHA1') q.set('algorithm', acc.algorithm);
  if (acc.digits && acc.digits !== 6) q.set('digits', String(acc.digits));
  if (type === 'totp' && acc.period && acc.period !== 30) q.set('period', String(acc.period));
  if (type === 'hotp') q.set('counter', String(acc.counter || 0));
  if (acc.type === 'steam') q.set('encoder', 'steam');
  return `otpauth://${type}/${label}?${q.toString()}`;
}
