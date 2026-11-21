// Ultra-Secure Random Password & Passphrase Generator
// Uses crypto.getRandomValues for cryptographically strong randomness.

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O to avoid confusion
const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // Exclude l
const NUMBERS = '23456789'; // Exclude 0, 1
const SYMBOLS = '!@#$%^&*()-_=+[]{}<>?~';

const WORDLIST = [
  'aurora', 'beacon', 'breeze', 'canyon', 'cascade', 'cipher', 'comet', 'crystal',
  'delta', 'dolphin', 'echo', 'ember', 'falcon', 'feather', 'forest', 'galaxy',
  'glacier', 'harbor', 'horizon', 'island', 'jupiter', 'lagoon', 'lotus', 'lunar',
  'meadow', 'meteor', 'mirage', 'nebula', 'oasis', 'ocean', 'orbit', 'pebble',
  'phoenix', 'planet', 'prism', 'pulsar', 'quantum', 'radiant', 'ripple', 'river',
  'sapphire', 'shadow', 'silver', 'solar', 'spark', 'summit', 'thunder', 'timber',
  'tundra', 'vapor', 'velvet', 'vortex', 'whisper', 'zenith', 'zephyr'
];

export function generatePassword(options = {}) {
  const {
    length = 16,
    upper = true,
    lower = true,
    numbers = true,
    symbols = true,
  } = options;

  let pool = '';
  const guaranteed = [];

  if (upper) { pool += UPPER; guaranteed.push(getRandomChar(UPPER)); }
  if (lower) { pool += LOWER; guaranteed.push(getRandomChar(LOWER)); }
  if (numbers) { pool += NUMBERS; guaranteed.push(getRandomChar(NUMBERS)); }
  if (symbols) { pool += SYMBOLS; guaranteed.push(getRandomChar(SYMBOLS)); }

  if (!pool) pool = LOWER + NUMBERS;

  const result = [...guaranteed];
  const remaining = Math.max(0, length - guaranteed.length);
  const randomBytes = new Uint32Array(remaining);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < remaining; i++) {
    result.push(pool[randomBytes[i] % pool.length]);
  }

  // Shuffle with Fisher-Yates
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

export function generatePassphrase(wordCount = 4, separator = '-') {
  const count = Math.max(3, Math.min(8, wordCount));
  const words = [];
  const rand = new Uint32Array(count);
  crypto.getRandomValues(rand);

  for (let i = 0; i < count; i++) {
    words.push(WORDLIST[rand[i] % WORDLIST.length]);
  }
  return words.join(separator);
}

function getRandomChar(str) {
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  return str[rand[0] % str.length];
}

export function evaluateStrength(pwd) {
  if (!pwd) return { score: 0, label: 'খালি', color: '#ff7a88' };
  let score = 0;
  if (pwd.length >= 8) score += 20;
  if (pwd.length >= 14) score += 25;
  if (pwd.length >= 20) score += 15;
  if (/[A-Z]/.test(pwd)) score += 10;
  if (/[a-z]/.test(pwd)) score += 10;
  if (/[0-9]/.test(pwd)) score += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 10;

  if (score >= 80) return { score, label: 'খুব শক্তিশালী 🛡️', color: '#10b981' };
  if (score >= 60) return { score, label: 'শক্তিশালী 👍', color: '#3b82f6' };
  if (score >= 40) return { score, label: 'মাঝারি ⚠️', color: '#f59e0b' };
  return { score, label: 'দুর্বল ❌', color: '#ef4444' };
}
