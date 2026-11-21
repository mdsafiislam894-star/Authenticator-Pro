// Decoder AND Encoder for Google Authenticator "Transfer accounts" QR codes:
//   otpauth-migration://offline?data=<base64 protobuf>
// Minimal protobuf reader/writer, zero external dependencies.

import { base32Encode, base32Decode } from './otp.js';

function b64ToBytes(b64) {
  const std = decodeURIComponent(b64).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function bytesToB64(bytes) {
  if (typeof btoa === 'function') {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }
  return Buffer.from(bytes).toString('base64');
}

function readVarint(buf, pos) {
  let result = 0, shift = 0;
  for (;;) {
    if (pos >= buf.length) throw new Error('ডাটা অসম্পূর্ণ');
    const b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, pos];
}

function writeVarint(out, value) {
  let v = BigInt(value);
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
}

function writeFieldBytes(out, field, bytes) {
  if (!bytes || !bytes.length) return;
  writeVarint(out, (field << 3) | 2);
  writeVarint(out, bytes.length);
  for (const b of bytes) out.push(b);
}

function writeFieldVarint(out, field, value) {
  writeVarint(out, (field << 3) | 0);
  writeVarint(out, value);
}

// Returns list of { field, wire, value } where value is number or Uint8Array
function readFields(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    let tag;
    [tag, pos] = readVarint(buf, pos);
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (wire === 0) {
      let v;
      [v, pos] = readVarint(buf, pos);
      out.push({ field, wire, value: v });
    } else if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      out.push({ field, wire, value: buf.slice(pos, pos + len) });
      pos += len;
    } else if (wire === 1) {
      pos += 8;
    } else if (wire === 5) {
      pos += 4;
    } else {
      throw new Error('অজানা protobuf ফরম্যাট');
    }
  }
  return out;
}

const ALGOS = { 0: 'SHA1', 1: 'SHA1', 2: 'SHA256', 3: 'SHA512', 4: 'MD5' };
const ALGO_TO_NUM = { SHA1: 1, SHA256: 2, SHA512: 3 };
const DIGITS = { 0: 6, 1: 6, 2: 8 };

export function isMigrationUri(s) {
  return /^otpauth-migration:\/\//i.test(String(s).trim());
}

export function decodeMigration(uri) {
  const m = String(uri).trim().match(/[?&]data=([^&]+)/);
  if (!m) throw new Error('Migration লিংকে data নেই');
  const payload = b64ToBytes(m[1]);
  const text = new TextDecoder();
  const accounts = [];
  for (const f of readFields(payload)) {
    if (f.field !== 1 || f.wire !== 2) continue;
    const acc = { secret: '', name: '', issuer: '', algo: 1, digits: 1, type: 2, counter: 0 };
    for (const g of readFields(f.value)) {
      if (g.field === 1) acc.secret = base32Encode(g.value);
      else if (g.field === 2) acc.name = text.decode(g.value);
      else if (g.field === 3) acc.issuer = text.decode(g.value);
      else if (g.field === 4) acc.algo = g.value;
      else if (g.field === 5) acc.digits = g.value;
      else if (g.field === 6) acc.type = g.value;
      else if (g.field === 7) acc.counter = g.value;
    }
    if (!acc.secret) continue;
    let name = acc.name;
    let issuer = acc.issuer;
    if (!issuer && name.includes(':')) {
      const i = name.indexOf(':');
      issuer = name.slice(0, i).trim();
      name = name.slice(i + 1).trim();
    }
    accounts.push({
      type: acc.type === 1 ? 'hotp' : 'totp',
      issuer,
      name,
      secret: acc.secret,
      algorithm: ALGOS[acc.algo] === 'MD5' ? 'SHA1' : ALGOS[acc.algo] || 'SHA1',
      digits: DIGITS[acc.digits] || 6,
      period: 30,
      counter: acc.counter || 0,
    });
  }
  if (!accounts.length) throw new Error('কোনো অ্যাকাউন্ট পাওয়া যায়নি');
  return accounts;
}

// Encodes accounts into Google Authenticator compatible otpauth-migration:// URI(s).
// Splits into batches of batchSize (default 10) so each QR stays easy to scan.
export function encodeMigration(accounts, { batchSize = 10 } = {}) {
  if (!accounts || !accounts.length) throw new Error('এক্সপোর্ট করার মতো কোনো অ্যাকাউন্ট নেই');
  const te = new TextEncoder();
  const totalBatches = Math.ceil(accounts.length / batchSize);
  const batchId = Math.floor(Math.random() * 0x7fffffff);
  const uris = [];

  for (let b = 0; b < totalBatches; b++) {
    const slice = accounts.slice(b * batchSize, (b + 1) * batchSize);
    const payload = [];
    for (const a of slice) {
      const accBuf = [];
      writeFieldBytes(accBuf, 1, base32Decode(a.secret));
      const label = a.name || a.issuer || 'Account';
      writeFieldBytes(accBuf, 2, te.encode(label));
      if (a.issuer) writeFieldBytes(accBuf, 3, te.encode(a.issuer));
      writeFieldVarint(accBuf, 4, ALGO_TO_NUM[a.algorithm] || 1);
      writeFieldVarint(accBuf, 5, a.digits === 8 ? 2 : 1);
      writeFieldVarint(accBuf, 6, a.type === 'hotp' ? 1 : 2);
      if (a.type === 'hotp' && a.counter) writeFieldVarint(accBuf, 7, a.counter);
      writeFieldBytes(payload, 1, new Uint8Array(accBuf));
    }
    writeFieldVarint(payload, 2, 1); // version = 1
    writeFieldVarint(payload, 3, totalBatches);
    writeFieldVarint(payload, 4, b);
    writeFieldVarint(payload, 5, batchId);
    const data = encodeURIComponent(bytesToB64(new Uint8Array(payload)));
    uris.push(`otpauth-migration://offline?data=${data}`);
  }
  return uris;
}
