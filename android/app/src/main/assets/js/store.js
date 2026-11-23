// Local vault: accounts + tombstones (for deletes) + recycle bin (trash) + groups.
// Merge is per-account "last write wins" using updatedAt, so edits/deletes
// made on different phones converge after sync.

const KEY = 'authpro.vault.v1';

export function uid() {
  const a = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

export function emptyVault() {
  return { v: 1, accounts: [], deleted: {}, trash: [], groups: [], updatedAt: 0 };
}

export function loadVault(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyVault();
    const parsed = JSON.parse(raw);
    return { ...emptyVault(), ...parsed, trash: Array.isArray(parsed.trash) ? parsed.trash : [] };
  } catch {
    return emptyVault();
  }
}

export function saveVault(vault, storage = globalThis.localStorage) {
  vault.updatedAt = Date.now();
  storage.setItem(KEY, JSON.stringify(vault));
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      chrome.storage.local.set({ [KEY]: vault });
    } catch {}
  }
}

export function newAccount(fields) {
  const now = Date.now();
  return {
    id: uid(),
    type: 'totp',
    issuer: '',
    name: '',
    secret: '',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    counter: 0,
    group: '',
    pinned: false,
    note: '',
    order: now,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

export function sameSecret(a, b) {
  return a.secret.replace(/=/g, '') === b.secret.replace(/=/g, '') &&
    (a.issuer || '').toLowerCase() === (b.issuer || '').toLowerCase() &&
    (a.name || '').toLowerCase() === (b.name || '').toLowerCase();
}

// Add many accounts, skipping duplicates. Returns { added, skipped }.
export function addAccounts(vault, list) {
  let added = 0, skipped = 0;
  let baseOrder = Date.now();
  for (const f of list) {
    const acc = newAccount({ ...f, order: f.order ?? baseOrder++ });
    if (vault.accounts.some((x) => sameSecret(x, acc))) { skipped++; continue; }
    vault.accounts.push(acc);
    added++;
  }
  return { added, skipped };
}

export function updateAccount(vault, id, patch) {
  const a = vault.accounts.find((x) => x.id === id);
  if (!a) return null;
  Object.assign(a, patch, { updatedAt: Date.now() });
  return a;
}

export function deleteAccount(vault, id) {
  const i = vault.accounts.findIndex((x) => x.id === id);
  if (i === -1) return null;
  const [removed] = vault.accounts.splice(i, 1);
  const now = Date.now();
  vault.deleted[id] = now;
  vault.trash = (vault.trash || []).filter((x) => x.id !== id);
  vault.trash.unshift({ ...removed, deletedAt: now });
  return removed;
}

export function restoreAccount(vault, acc) {
  delete vault.deleted[acc.id];
  vault.trash = (vault.trash || []).filter((x) => x.id !== acc.id);
  const { deletedAt, ...clean } = acc;
  if (!vault.accounts.some((x) => x.id === clean.id)) {
    vault.accounts.push({ ...clean, updatedAt: Date.now() });
  }
}

export function permanentlyDeleteFromTrash(vault, id) {
  vault.trash = (vault.trash || []).filter((x) => x.id !== id);
  vault.deleted[id] = Math.max(vault.deleted[id] || 0, Date.now());
}

export function emptyTrash(vault) {
  const now = Date.now();
  for (const item of vault.trash || []) {
    vault.deleted[item.id] = Math.max(vault.deleted[item.id] || 0, now);
  }
  vault.trash = [];
}

// Move account up (-1) or down (+1) in manual order within the given ordered list of IDs.
export function moveAccountOrder(vault, id, direction, orderedIds = null) {
  const ids = orderedIds || [...vault.accounts]
    .sort((a, b) => (b.pinned - a.pinned) || (a.order - b.order))
    .map((a) => a.id);
  const idx = ids.indexOf(id);
  const targetIdx = idx + direction;
  if (idx === -1 || targetIdx < 0 || targetIdx >= ids.length) return false;

  // Normalize orders cleanly so swaps always stick
  const byId = new Map(vault.accounts.map((a) => [a.id, a]));
  const a = byId.get(ids[idx]);
  const b = byId.get(ids[targetIdx]);
  if (!a || !b || a.pinned !== b.pinned) return false;

  const now = Date.now();
  ids.forEach((cid, i) => {
    const item = byId.get(cid);
    if (item) item.order = (i + 1) * 1000;
  });
  const tmp = a.order;
  a.order = b.order;
  b.order = tmp;
  a.updatedAt = now;
  b.updatedAt = now;
  return true;
}

// Merge remote vault into local. Pure: returns a new vault.
export function mergeVaults(local, remote) {
  const out = emptyVault();
  const deleted = { ...(remote.deleted || {}) };
  for (const [id, t] of Object.entries(local.deleted || {})) {
    deleted[id] = Math.max(deleted[id] || 0, t);
  }
  const map = new Map();
  for (const a of [...(remote.accounts || []), ...(local.accounts || [])]) {
    const cur = map.get(a.id);
    if (!cur || a.updatedAt > cur.updatedAt) map.set(a.id, a);
  }
  for (const [id, a] of map) {
    if (deleted[id] && deleted[id] >= a.updatedAt) continue; // deletion wins if newer
    out.accounts.push(a);
    delete deleted[id];
  }
  // Merge recycle bin items that are still deleted (not restored to accounts)
  const activeIds = new Set(out.accounts.map((a) => a.id));
  const trashMap = new Map();
  for (const item of [...(remote.trash || []), ...(local.trash || [])]) {
    if (activeIds.has(item.id)) continue;
    const cur = trashMap.get(item.id);
    if (!cur || (item.deletedAt || 0) > (cur.deletedAt || 0)) trashMap.set(item.id, item);
  }
  out.trash = Array.from(trashMap.values()).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  out.deleted = deleted;
  out.groups = Array.from(new Set([...(remote.groups || []), ...(local.groups || [])]));
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}

// Drop tombstones older than 90 days and trash items older than 30 days.
export function pruneTombstones(vault, maxAgeMs = 90 * 864e5, trashAgeMs = 30 * 864e5) {
  const now = Date.now();
  const cutoff = now - maxAgeMs;
  for (const [id, t] of Object.entries(vault.deleted)) {
    if (t < cutoff) delete vault.deleted[id];
  }
  if (Array.isArray(vault.trash)) {
    const trashCutoff = now - trashAgeMs;
    vault.trash = vault.trash.filter((item) => (item.deletedAt || now) >= trashCutoff);
  }
}
