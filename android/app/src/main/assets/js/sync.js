// Auto-sync orchestration: pull -> merge -> push, encrypted with the vault passphrase.
import * as drive from './drive.js';
import { encryptJson, decryptJson } from './crypto.js';
import { mergeVaults, pruneTombstones, saveVault } from './store.js';

const PASS_KEY = 'authpro.pass.v1';
const META_KEY = 'authpro.syncmeta.v1';

export const getPassphrase = () => localStorage.getItem(PASS_KEY) || '';
export const setPassphrase = (p) => localStorage.setItem(PASS_KEY, p);
export const clearPassphrase = () => localStorage.removeItem(PASS_KEY);

export function getSyncMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function setSyncMeta(m) { localStorage.setItem(META_KEY, JSON.stringify(m)); }

export async function remoteExists() {
  const r = await drive.downloadBackup();
  return !!r;
}

// Returns { vault, status } where status is 'uploaded' | 'merged' | 'unchanged'.
export async function syncNow(vault) {
  const pass = getPassphrase();
  if (!pass) throw new Error('ব্যাকআপ পাসফ্রেজ সেট করা নেই');
  const remote = await drive.downloadBackup();
  let merged = vault;
  let status = 'uploaded';
  if (remote) {
    const remoteVault = await decryptJson(remote.envelope, pass);
    merged = mergeVaults(vault, remoteVault);
    const same = JSON.stringify(sortKeys(merged)) === JSON.stringify(sortKeys(remoteVault));
    status = same ? 'unchanged' : 'merged';
  }
  pruneTombstones(merged);
  if (status !== 'unchanged') {
    const envelope = await encryptJson(merged, pass);
    await drive.uploadBackup(envelope);
  }
  saveVault(merged);
  setSyncMeta({ lastSync: Date.now(), email: drive.getUser()?.email });
  return { vault: merged, status };
}

function sortKeys(v) {
  return {
    a: [...v.accounts].sort((x, y) => x.id.localeCompare(y.id)),
    d: Object.entries(v.deleted || {}).sort(([x], [y]) => x.localeCompare(y)),
  };
}

// Debounced auto-sync trigger used after every local change.
let timer = null;
export function scheduleSync(getVault, onResult, onError, delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!drive.getUser() || !getPassphrase()) return;
    try { onResult(await syncNow(getVault())); } catch (e) { onError(e); }
  }, delay);
}
