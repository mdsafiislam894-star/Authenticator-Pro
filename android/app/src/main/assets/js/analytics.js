// Vault Analytics & Service Intelligence Engine for Authenticator Pro

const COPY_HISTORY_KEY = 'authpro.copyhistory.v1';

export function recordCopyEvent(accountId) {
  try {
    const history = JSON.parse(localStorage.getItem(COPY_HISTORY_KEY) || '{}');
    history[accountId] = {
      count: (history[accountId]?.count || 0) + 1,
      lastCopied: Date.now(),
    };
    localStorage.setItem(COPY_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function getCopyStats() {
  try {
    return JSON.parse(localStorage.getItem(COPY_HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function computeVaultAnalytics(vault) {
  const accounts = vault.accounts || [];
  const copyStats = getCopyStats();

  // 1. Category Classification
  const categories = {
    cloud: { label: 'ক্লাউড ও টেক', icon: '☁️', count: 0, color: '#3b82f6' },
    crypto: { label: 'ক্রিপ্টো ও ফাইন্যান্স', icon: '🪙', count: 0, color: '#f59e0b' },
    social: { label: 'সোশ্যাল মিডিয়া', icon: '💬', count: 0, color: '#ec4899' },
    developer: { label: 'ডেভেলপার ও কোডিং', icon: '💻', count: 0, color: '#8b5cf6' },
    other: { label: 'অন্যান্য সার্ভিস', icon: '🛡️', count: 0, color: '#10b981' },
  };

  const CLOUD_RE = /google|gmail|microsoft|outlook|aws|amazon|azure|cloudflare|apple|icloud/i;
  const CRYPTO_RE = /binance|coinbase|crypto|kucoin|bybit|kraken|trust|metamask|paypal|bank/i;
  const SOCIAL_RE = /facebook|meta|instagram|telegram|discord|twitter|x|whatsapp|reddit|tiktok/i;
  const DEV_RE = /github|gitlab|bitbucket|digitalocean|heroku|vercel|docker|npm/i;

  accounts.forEach((a) => {
    const text = `${a.issuer} ${a.name}`.toLowerCase();
    if (CLOUD_RE.test(text)) categories.cloud.count++;
    else if (CRYPTO_RE.test(text)) categories.crypto.count++;
    else if (SOCIAL_RE.test(text)) categories.social.count++;
    else if (DEV_RE.test(text)) categories.developer.count++;
    else categories.other.count++;
  });

  // 2. Algorithm breakdown
  const algos = { SHA1: 0, SHA256: 0, SHA512: 0 };
  accounts.forEach((a) => {
    const alg = (a.algorithm || 'SHA1').toUpperCase();
    if (algos[alg] !== undefined) algos[alg]++;
    else algos.SHA1++;
  });

  // 3. Most Active Accounts
  const ranked = accounts
    .map((a) => ({
      account: a,
      copies: copyStats[a.id]?.count || 0,
      lastCopied: copyStats[a.id]?.lastCopied || 0,
    }))
    .sort((a, b) => b.copies - a.copies);

  const totalCopies = Object.values(copyStats).reduce((acc, v) => acc + (v.count || 0), 0);

  return {
    totalAccounts: accounts.length,
    pinnedCount: accounts.filter((a) => a.pinned).length,
    totalCopies,
    categories,
    algos,
    mostActive: ranked.slice(0, 5),
  };
}
