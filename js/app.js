import { $, esc, toast, avatarColor, formatCode, copyText } from './ui.js';
import { generateCode, secondsLeft } from './otp.js';
import { loadVault, saveVault, updateAccount, moveAccountOrder } from './store.js';
import { APP_VERSION } from './config.js';
import * as drive from './drive.js';
import * as sync from './sync.js';
import { openAddMenu, openScan } from './dialogs-add.js';
import { openEdit } from './dialogs-manage.js';
import { openMenu, openSync } from './dialogs-settings.js';

// ---------- state ----------
let vault = loadVault();
const SETTINGS_KEY = 'authpro.settings.v1';
const settings = {
  theme: 'auto',
  hideCodes: false,
  autoCopy: true,
  showNextCode: true,
  pinHash: '',
  bioCredId: '',
  autoLockMs: 0,
  sort: 'manual',
  group: '',
  bannerDismissed: false,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
};
let query = '';
let reorderMode = false;
let lastHiddenAt = 0;
let deferredInstallPrompt = null;
let swRegistration = null;
const revealed = new Map(); // id -> timeout for "hide codes" mode

function resolvedTheme() {
  return settings.theme === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : settings.theme;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyTheme();
  render();
}

function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  const meta = $('#themeMeta');
  if (meta) meta.setAttribute('content', t === 'light' ? '#e9eeff' : '#070a14');
  const tb = $('#themeBtn');
  if (tb) {
    tb.textContent = t === 'light' ? '🌙' : '☀️';
    tb.title = t === 'light' ? 'ডার্ক মোডে যান' : 'লাইট মোডে যান';
  }
}

async function hashPin(pin) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('authpro:' + pin));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- biometric (WebAuthn local platform authenticator) ----------
function toB64Url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registerBiometric() {
  if (!globalThis.PublicKeyCredential) throw new Error('ব্রাউজার বায়োমেট্রিক সমর্থন করে না');
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Authenticator Pro' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: drive.getUser()?.email || 'authpro-user',
        displayName: 'Authenticator Pro User',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  });
  return toB64Url(cred.rawId);
}

async function verifyBiometric() {
  if (!settings.bioCredId || !globalThis.PublicKeyCredential) return false;
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: fromB64Url(settings.bioCredId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true;
}

// ---------- PWA install & one-tap update ----------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

async function promptInstall() {
  if (!deferredInstallPrompt) {
    toast('ব্রাউজার মেনু (⋮ / Share) → Install app / Add to Home Screen চাপুন');
    return;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (outcome === 'accepted') toast('অ্যাপ ইনস্টল শুরু হয়েছে 📲');
}

function promptUpdateToast(worker) {
  toast('নতুন ভার্সন পাওয়া গেছে ✨', 'আপডেট করুন', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  }, 15000);
}

async function checkForUpdate() {
  if (!swRegistration) {
    return toast(`আপনার অ্যাপটি সর্বশেষ ভার্সনে আছে (v${APP_VERSION})`);
  }
  try {
    await swRegistration.update();
    if (swRegistration.waiting) {
      promptUpdateToast(swRegistration.waiting);
    } else {
      toast(`সব আপ-টু-ডেট আছে ✅ (v${APP_VERSION})`);
    }
  } catch {
    toast('আপডেট চেক করা যায়নি (ইন্টারনেট চেক করুন)');
  }
}

// ---------- sync ----------
function refreshSyncDot(state) {
  const dot = $('#syncDot');
  const user = drive.getUser();
  const signedIn = !!user && !!sync.getPassphrase();
  dot.className = 'dot ' + (state || (signedIn ? 'on' : 'off'));

  const iconEl = $('#syncIcon');
  if (iconEl) {
    iconEl.innerHTML = user?.picture
      ? `<img class="user-pic" src="${esc(user.picture)}" alt="">`
      : '☁️';
  }
  const banner = $('#syncBanner');
  if (banner) {
    banner.classList.toggle('hidden', signedIn || settings.bannerDismissed || reorderMode);
  }
}

async function doSync(manual = false) {
  if (!drive.getUser() || !sync.getPassphrase()) return;
  refreshSyncDot('busy');
  try {
    const r = await sync.syncNow(vault);
    vault = r.vault; render(); refreshSyncDot();
    if (manual) toast(r.status === 'unchanged' ? 'সব আপ-টু-ডেট ✅' : 'সিঙ্ক সম্পন্ন ✅');
    else if (r.status === 'merged') toast('অন্য ডিভাইস থেকে পরিবর্তন এসেছে ☁️');
  } catch (e) {
    refreshSyncDot('err');
    toast('সিঙ্ক ব্যর্থ: ' + e.message);
  }
}

function commit() {
  saveVault(vault);
  render();
  sync.scheduleSync(() => vault, (r) => { vault = r.vault; render(); refreshSyncDot(); },
    (e) => { refreshSyncDot('err'); toast('অটো-ব্যাকআপ ব্যর্থ: ' + e.message); });
}

function startReorder() {
  if (vault.accounts.length < 2) return toast('সাজানোর জন্য কমপক্ষে ২টি অ্যাকাউন্ট দরকার');
  settings.sort = 'manual';
  settings.group = '';
  query = '';
  $('#search').value = '';
  reorderMode = true;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  render();
  refreshSyncDot();
}

const ctx = {
  get vault() { return vault; },
  get canInstall() { return !!deferredInstallPrompt; },
  appVersion: APP_VERSION,
  commit,
  render: () => render(),
  settings,
  saveSettings,
  doSync,
  hashPin,
  refreshSyncDot,
  startReorder,
  lockNow: () => showLock(true),
  registerBiometric,
  promptInstall,
  checkForUpdate,
};

// ---------- rendering ----------
function visibleAccounts() {
  let list = vault.accounts.slice();
  if (settings.group) list = list.filter((a) => a.group === settings.group);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((a) => `${a.issuer} ${a.name} ${a.group} ${a.note}`.toLowerCase().includes(q));
  }
  const by = {
    manual: (a, b) => a.order - b.order,
    issuer: (a, b) => (a.issuer || a.name).localeCompare(b.issuer || b.name),
    recent: (a, b) => b.createdAt - a.createdAt,
  }[settings.sort] || (() => 0);
  list.sort((a, b) => (b.pinned - a.pinned) || by(a, b));
  return list;
}

function renderChips() {
  const groups = vault.groups || [];
  $('#groups').innerHTML = groups.length
    ? [''].concat(groups).map((g) =>
      `<button class="chip ${settings.group === g ? 'active' : ''}" data-g="${esc(g)}">${g ? esc(g) : 'সব'}</button>`).join('')
    : '';
  $('#groups').querySelectorAll('.chip').forEach((c) => (c.onclick = () => {
    settings.group = c.dataset.g; localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); render();
  }));
}

const R = 16, CIRC = 2 * Math.PI * R;

function cardHtml(a, idx, total) {
  const title = a.issuer || a.name || 'Unnamed';
  const sub = a.issuer ? a.name : '';
  const isHotp = a.type === 'hotp';
  return `<div class="card" data-id="${a.id}">
    <div class="avatar" style="background:${avatarColor(title)}">${esc(title[0].toUpperCase())}</div>
    <div class="info">
      <div class="issuer">${a.pinned ? '⭐ ' : ''}${esc(title)}</div>
      ${sub ? `<div class="name">${esc(sub)}</div>` : ''}
      <div class="code-row">
        <div class="code" data-code="${a.id}">······</div>
        ${!isHotp ? `<span class="next-code" data-nextcode="${a.id}"></span>` : ''}
      </div>
      <div class="meta">
        ${a.group ? `<span class="tag">${esc(a.group)}</span>` : ''}
        ${a.type !== 'totp' ? `<span class="tag">${a.type.toUpperCase()}</span>` : ''}
        <span class="tag copied-tag hidden" data-copied="${a.id}">কপিড ✓</span>
      </div>
    </div>
    ${reorderMode ? `
      <div class="card-actions">
        <button class="mini" data-move="-1" data-mid="${a.id}" ${idx === 0 ? 'disabled style="opacity:.35"' : ''} title="উপরে নিন">↑</button>
        <button class="mini" data-move="1" data-mid="${a.id}" ${idx === total - 1 ? 'disabled style="opacity:.35"' : ''} title="নিচে নিন">↓</button>
      </div>` : `
      ${isHotp
        ? `<button class="mini" data-next="${a.id}" title="পরবর্তী কোড">⟳</button>`
        : `<div class="ring" data-ring="${a.id}"><svg viewBox="0 0 38 38"><circle class="bg" cx="19" cy="19" r="${R}" fill="none" stroke-width="3"/><circle class="fg" cx="19" cy="19" r="${R}" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg><span class="sec"></span></div>`}
      <div class="card-actions"><button class="mini" data-edit="${a.id}" title="এডিট / ডিলিট / অপশন">✏️</button></div>`}
  </div>`;
}

function render() {
  const list = visibleAccounts();
  $('#sort').value = settings.sort;
  $('#reorderBar').classList.toggle('hidden', !reorderMode);
  renderChips();
  $('#empty').classList.toggle('hidden', vault.accounts.length > 0);
  $('#list').innerHTML = list.map((a, i) => cardHtml(a, i, list.length)).join('');

  const orderedIds = list.map((a) => a.id);
  $('#list').querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    card.onclick = async (e) => {
      const moveBtn = e.target.closest('[data-move]');
      if (moveBtn) {
        const dir = Number(moveBtn.dataset.move);
        if (moveAccountOrder(vault, id, dir, orderedIds)) commit();
        return;
      }
      if (reorderMode) return;
      if (e.target.closest('[data-edit]')) return openEdit(ctx, id);
      if (e.target.closest('[data-next]')) {
        const a = vault.accounts.find((x) => x.id === id);
        updateAccount(vault, id, { counter: (a.counter || 0) + 1 }); return commit();
      }
      const codeEl = card.querySelector('.code');
      if (settings.hideCodes && codeEl.classList.contains('hide')) { reveal(id); }
      if (settings.autoCopy) {
        const raw = codeEl.dataset.raw;
        if (raw && (await copyText(raw))) {
          card.classList.add('copied');
          const tag = card.querySelector(`[data-copied="${id}"]`);
          tag?.classList.remove('hidden');
          setTimeout(() => { card.classList.remove('copied'); tag?.classList.add('hidden'); }, 1400);
          toast('কোড কপি হয়েছে ✓');
        }
      }
    };
  });
  tick(true);
}

function reveal(id) {
  clearTimeout(revealed.get(id));
  revealed.set(id, setTimeout(() => { revealed.delete(id); tick(true); }, 10000));
  tick(true);
}

let lastCounters = {};
async function tick(force = false) {
  const now = Date.now();
  for (const a of vault.accounts) {
    const codeEl = document.querySelector(`[data-code="${a.id}"]`);
    if (!codeEl) continue;
    const period = a.period || 30;
    const step = a.type === 'hotp' ? a.counter : Math.floor(now / 1000 / period);
    const nextEl = document.querySelector(`[data-nextcode="${a.id}"]`);

    if (force || lastCounters[a.id] !== step || !codeEl.dataset.raw) {
      lastCounters[a.id] = step;
      try {
        const code = await generateCode(a, now);
        codeEl.dataset.raw = code;
        codeEl.textContent = formatCode(code);
        if (nextEl && a.type !== 'hotp') {
          const nextCode = await generateCode(a, now + period * 1000);
          nextEl.textContent = 'পরবর্তী: ' + formatCode(nextCode);
        }
      } catch { codeEl.textContent = 'ERROR'; }
    }
    const isHidden = settings.hideCodes && !revealed.has(a.id);
    codeEl.classList.toggle('hide', isHidden);
    if (a.type !== 'hotp') {
      const left = secondsLeft(period, now);
      const ring = document.querySelector(`[data-ring="${a.id}"]`);
      if (ring) {
        const soon = left <= 5;
        ring.classList.toggle('soon', soon);
        codeEl.classList.toggle('soon', soon);
        ring.querySelector('.sec').textContent = left;
        ring.querySelector('.fg').style.strokeDashoffset = CIRC * (1 - left / period);
      }
      if (nextEl) {
        nextEl.classList.toggle('show', settings.showNextCode !== false && !isHidden && left <= 8);
      }
    }
  }
}

// ---------- lock ----------
function showLock(force = false) {
  if (!settings.pinHash) return;
  if (!force && settings.autoLockMs > 0 && lastHiddenAt && (Date.now() - lastHiddenAt) < settings.autoLockMs) {
    return;
  }
  $('#lock').classList.remove('hidden');
  $('#lockMsg').textContent = 'PIN দিন';
  $('#lockPin').value = '';
  $('#bioBtn').classList.toggle('hidden', !settings.bioCredId);
  $('#lockPin').focus();
}

async function tryUnlock() {
  const h = await hashPin($('#lockPin').value);
  if (h === settings.pinHash) { $('#lock').classList.add('hidden'); } else {
    $('#lockMsg').textContent = 'ভুল PIN'; $('#lockPin').value = '';
  }
}

async function tryBiometricUnlock() {
  try {
    if (await verifyBiometric()) $('#lock').classList.add('hidden');
  } catch {
    $('#lockMsg').textContent = 'বায়োমেট্রিক বাতিল হয়েছে — PIN দিন';
  }
}

// ---------- boot ----------
$('#fab').onclick = () => openAddMenu(ctx);
$('#menuBtn').onclick = () => openMenu(ctx);
$('#syncBtn').onclick = () => openSync(ctx);
$('#bannerSyncBtn').onclick = () => openSync(ctx);
$('#bannerCloseBtn').onclick = () => {
  settings.bannerDismissed = true;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  refreshSyncDot();
};
$('#reorderDoneBtn').onclick = () => {
  reorderMode = false;
  render();
  refreshSyncDot();
  toast('সাজানো সেভ হয়েছে ✅');
};
$('#themeBtn').onclick = () => {
  settings.theme = resolvedTheme() === 'light' ? 'dark' : 'light';
  saveSettings();
};
$('#search').oninput = (e) => { query = e.target.value.trim(); render(); };
$('#sort').onchange = (e) => { settings.sort = e.target.value; saveSettings(); };
$('#lockBtn').onclick = tryUnlock;
$('#bioBtn').onclick = tryBiometricUnlock;
$('#lockPin').onkeydown = (e) => { if (e.key === 'Enter') tryUnlock(); };

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    lastHiddenAt = Date.now();
    if (settings.pinHash && (settings.autoLockMs ?? 0) === 0) showLock(true);
  } else {
    if (settings.pinHash && settings.autoLockMs > 0) showLock(false);
    tick(true);
    doSync(false);
    swRegistration?.update().catch(() => {});
  }
});
addEventListener('online', () => doSync(false));
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);

// Water-drop ripple on tap
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.card, .fab, .btn, .chip, .icon-btn, .menu-item, .qbtn');
  if (!t) return;
  const r = t.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 1.65;
  const s = document.createElement('span');
  s.className = 'drop';
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  t.appendChild(s);
  setTimeout(() => s.remove(), 750);
});

applyTheme();
render();
refreshSyncDot();
showLock(true);
setInterval(tick, 1000);
setInterval(() => doSync(false), 5 * 60 * 1000);
doSync(false);

// Handle home-screen app shortcuts (?action=scan / ?action=sync)
const action = new URLSearchParams(location.search).get('action');
if (action === 'scan') setTimeout(() => openScan(ctx), 300);
else if (action === 'sync') setTimeout(() => openSync(ctx), 300);

// Service Worker registration + automatic one-tap update notifications
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    swRegistration = reg;
    if (reg.waiting) promptUpdateToast(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdateToast(nw);
        }
      });
    });
  }).catch(() => {});
}
