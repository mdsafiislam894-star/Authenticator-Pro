// Client-side encryption for backups: PBKDF2-SHA256 (600k) -> AES-256-GCM.
// The passphrase never leaves the device; Google Drive only ever sees ciphertext.

const ITER = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(obj, passphrase, iterations = ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  );
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: iterations,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(ct),
  };
}

export async function decryptJson(envelope, passphrase) {
  if (!envelope || envelope.v !== 1) throw new Error('অজানা ব্যাকআপ ফরম্যাট');
  const key = await deriveKey(passphrase, fromB64(envelope.salt), envelope.iter);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(envelope.iv) },
      key,
      fromB64(envelope.data)
    );
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error('পাসফ্রেজ ভুল অথবা ফাইল নষ্ট');
  }
}
