import { $, esc, toast, avatarColor, formatCode, copyText, confirmDialog, openModal, GOOGLE_G_SVG } from './ui.js';
import { generateCode, secondsLeft } from './otp.js';
import { loadVault, saveVault, updateAccount, deleteAccount, moveAccountOrder } from './store.js';
import { APP_VERSION } from './config.js';
import * as drive from './drive.js';
import * as sync from './sync.js';
import { openAddMenu, openScan } from './dialogs-add.js';
import { openEdit, openTrash } from './dialogs-manage.js';
import { openMenu, openSync, openTelegramDialog, openSecurity, afterSignIn } from './dialogs-settings.js';
import { playDropletSound, playSuccessChime, haptic } from './audio.js';
import {
  openThemePicker, openSecurityAudit, openFocusView,
  openPasswordGenerator, openAccountQr, printEmergencySheet,
  openTimeSyncDialog, openVaultAnalytics, openBatchActionsModal
} from './dialogs-advanced.js';
import { initPhysics } from './physics.js';
import { syncNetworkTime, getCorrectedNow } from './timesync.js';
import { recordCopyEvent } from './analytics.js';
import { renderAccountAvatar } from './brand-icons.js';
import { openRecoveryCodesDialog, openGlobalRecoveryVault } from './recovery-codes.js';

// ---------- state ----------
let vault = loadVault();
const SETTINGS_KEY = 'authpro.settings.v1';
const settings = {
  theme: 'green-forest',
  mode: 'dark',
  hideCodes: false,
  autoCopy: true,
  showNextCode: true,
  sound: true,
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
let batchMode = false;
const selectedBatchIds = new Set();
let lastHiddenAt = 0;
let deferredInstallPrompt = null;
let swRegistration = null;
const revealed = new Map(); // id -> timeout for "hide codes" mode

function resolvedTheme() {
  if (settings.theme === 'light') return 'crystal-pearl';
  if (settings.theme === 'dark' || settings.theme === 'auto') return 'green-forest';
  return settings.theme || 'green-forest';
}

function resolvedMode() {
  if (settings.mode === 'light' || settings.mode === 'dark') return settings.mode;
  if (settings.theme === 'light' || settings.theme === 'crystal-pearl') return 'light';
  return 'dark';
}

function isLightTheme(t) {
  return resolvedMode() === 'light';
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyTheme();
  render();
}

function applyTheme() {
  const t = resolvedTheme();
  const m = resolvedMode();
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.mode = m;
  const isLight = m === 'light';
  const meta = $('#themeMeta');
  if (meta) meta.setAttribute('content', isLight ? '#f8fafc' : '#021209');

  const toggleBtn = $('#themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = isLight ? '🌙' : '☀️';
    toggleBtn.title = isLight ? 'ডার্ক মোড চালু করুন (🌙)' : 'লাইট মোড চালু করুন (☀️)';
  }

  const tb = $('#themeBtn');
  if (tb) {
    tb.textContent = '🎨';
    tb.title = '🎨 প্রিমিয়াম থিম প্যালেট নির্বাচন';
  }

  const pb = $('#privacyBtn');
  if (pb) {
    pb.textContent = settings.hideCodes ? '🙈' : '👁️';
    pb.title = settings.hideCodes ? 'কোড দেখান' : 'কোড লুকান';
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
  const hasPass = !!sync.getPassphrase();
  const signedIn = !!user && hasPass;
  if (dot) dot.className = 'dot ' + (state || (signedIn ? 'on' : (user ? 'busy' : 'off')));

  const iconEl = $('#syncIcon');
  if (iconEl) {
    iconEl.innerHTML = user?.picture
      ? `<img class="user-pic" src="${esc(user.picture)}" alt="">`
      : '☁️';
  }
  const banner = $('#syncBanner');
  if (banner) {
    if (user && !hasPass) {
      banner.classList.remove('hidden');
      const textEl = banner.querySelector('.sync-banner-text');
      if (textEl) {
        textEl.innerHTML = '<b>🔑 ব্যাকআপ পাসফ্রেজ দিন</b><span>Google ড্রাইভ থেকে সব কোড রিস্টোর করতে পাসফ্রেজ দিন</span>';
      }
      const btnEl = banner.querySelector('#bannerSyncBtn');
      if (btnEl) btnEl.textContent = 'পাসফ্রেজ দিন';
    } else {
      banner.classList.toggle('hidden', signedIn || settings.bannerDismissed || reorderMode);
      const textEl = banner.querySelector('.sync-banner-text');
      if (textEl) {
        textEl.innerHTML = '<b>☁️ অটো-ব্যাকআপ চালু করুন</b><span>Google-এ কানেক্ট করলে নতুন ফোনেই সব কোড ফেরত পাবেন</span>';
      }
      const btnEl = banner.querySelector('#bannerSyncBtn');
      if (btnEl) btnEl.textContent = 'কানেক্ট';
    }
  }
}

async function doSync(manual = false) {
  const user = drive.getUser();
  const pass = sync.getPassphrase();
  if (!user) {
    if (manual) openSync(ctx);
    return;
  }
  if (!pass) {
    if (manual) afterSignIn(ctx);
    return;
  }
  refreshSyncDot('busy');
  try {
    const r = await sync.syncNow(vault);
    vault = r.vault; render(); refreshSyncDot();
    playSuccessChime(settings);
    haptic('success');
    // Lock monotonic time to true network time on every sync
    syncNetworkTime().catch(() => {});
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
  syncNetworkTime().catch(() => {});
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

function startBatchMode() {
  if (vault.accounts.length === 0) return toast('কোনো অ্যাকাউন্ট নেই');
  batchMode = true;
  selectedBatchIds.clear();
  reorderMode = false;
  $('#reorderBar')?.classList.add('hidden');
  updateBatchUi();
  render();
  toast('ব্যাচ মোড চালু: অ্যাকাউন্ট সিলেক্ট করুন');
}

function exitBatchMode() {
  batchMode = false;
  selectedBatchIds.clear();
  updateBatchUi();
  render();
}

function updateBatchUi() {
  const bar = $('#batchBar');
  if (bar) bar.classList.toggle('hidden', !batchMode);
  const cnt = $('#batchCount');
  if (cnt) cnt.textContent = `${selectedBatchIds.size}টি নির্বাচিত`;
}

const ctx = {
  get vault() { return vault; },
  get canInstall() { return !!deferredInstallPrompt; },
  appVersion: APP_VERSION,
  commit,
  render: () => render(),
  settings,
  saveSettings,
  resolvedTheme: () => resolvedTheme(),
  resolvedMode: () => resolvedMode(),
  doSync,
  hashPin,
  refreshSyncDot,
  startReorder,
  startBatchMode,
  exitBatchMode,
  lockNow: () => showLock(true),
  registerBiometric,
  promptInstall,
  checkForUpdate,
  openThemePicker: () => openThemePicker(ctx),
  openSecurityAudit: () => openSecurityAudit(ctx),
  openPasswordGenerator: () => openPasswordGenerator(ctx),
  openTimeSyncDialog: () => openTimeSyncDialog(ctx),
  openVaultAnalytics: () => openVaultAnalytics(ctx),
  openBatchActionsModal: (ids, done) => openBatchActionsModal(ctx, ids, done),
  openFocusView: (id) => openFocusView(ctx, id),
  openAccountQr: (id) => openAccountQr(ctx, id),
  printEmergencySheet: () => printEmergencySheet(ctx),
  openSecurity: () => openSecurity(ctx),
  openRecoveryCodes: (id) => openRecoveryCodesDialog(ctx, id),
  openRecoveryVault: () => openGlobalRecoveryVault(ctx),
  openSync: () => openSync(ctx),
  openTrash: () => openTrash(ctx),
  refreshVault: () => {
    vault = loadVault();
    render();
    refreshSyncDot();
  },
};
window.authProCtx = ctx;

// ---------- rendering ----------
function visibleAccounts() {
  let list = vault.accounts.slice();
  if (settings.group === '__pinned__') {
    list = list.filter((a) => a.pinned);
  } else if (settings.group) {
    list = list.filter((a) => a.group === settings.group);
  }
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
  const groupsEl = $('#groups') || $('#chips');
  if (!groupsEl) return;
  const groups = vault.groups || [];
  const hasPinned = vault.accounts.some((a) => a.pinned);
  const items = [{ id: '', label: 'সব' }];
  if (hasPinned) items.push({ id: '__pinned__', label: '⭐ প্রিয়' });
  groups.forEach((g) => items.push({ id: g, label: g }));

  groupsEl.innerHTML = items.length > 1
    ? items.map((it) =>
        `<button class="chip ${settings.group === it.id ? 'active' : ''}" data-g="${esc(it.id)}">${esc(it.label)}</button>`
      ).join('')
    : '';

  groupsEl.querySelectorAll('.chip').forEach((c) => (c.onclick = () => {
    playDropletSound(settings);
    haptic('light');
    settings.group = c.dataset.g;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    render();
  }));
}

const R = 15, CIRC = 2 * Math.PI * R;
let openSwipeCard = null;

function resetOpenSwipe() {
  if (openSwipeCard) {
    openSwipeCard.style.transform = 'translateX(0px)';
    openSwipeCard = null;
  }
}

function cardHtml(a, idx, total) {
  const mainTitle = a.issuer || a.name || 'Unnamed';
  const subTitle = (a.issuer && a.name && a.name.toLowerCase() !== a.issuer.toLowerCase()) ? a.name : '';
  const isHotp = a.type === 'hotp';
  const recUnused = a.recoveryCodes?.filter((c) => !c.used).length || 0;
  const recTotal = a.recoveryCodes?.length || 0;
  return `
  <div class="card-wrap" data-wrap-id="${a.id}">
    <div class="swipe-action swipe-right-action">
      <span>📋 কোড কপি করুন</span>
    </div>
    <div class="swipe-action swipe-left-action">
      <button class="swipe-btn rec-btn" data-swipe-rec="${a.id}" title="রিকভারি কোড">🔐</button>
      <button class="swipe-btn focus-btn" data-swipe-focus="${a.id}" title="বড় পর্দায় ফোকাস ভিউ">🔍</button>
      <button class="swipe-btn edit-btn" data-swipe-edit="${a.id}" title="এডিট">✏️</button>
      <button class="swipe-btn pin-btn" data-swipe-pin="${a.id}" title="${a.pinned ? 'আনপিন' : 'পিন'}">${a.pinned ? '⭐' : '☆'}</button>
      <button class="swipe-btn del-btn" data-swipe-del="${a.id}" title="মুছুন">🗑️</button>
    </div>
    <div class="card ${batchMode && selectedBatchIds.has(a.id) ? 'selected-for-batch' : ''}" data-id="${a.id}">
      ${renderAccountAvatar(a)}
      <div class="info">
        <div class="info-top">
          <span class="issuer" title="${esc(mainTitle)}">${a.pinned ? '⭐ ' : ''}${esc(mainTitle)}</span>
          ${subTitle ? `<span class="name" title="${esc(subTitle)}">(${esc(subTitle)})</span>` : ''}
          ${a.group ? `<span class="tag group-tag">${esc(a.group)}</span>` : ''}
          ${recTotal > 0 ? `<button class="tag recovery-pill-tag" data-recovery="${a.id}" title="রিকভারি কোড দেখুন">🔐 ${recUnused}/${recTotal}</button>` : ''}
        </div>
        <div class="code-row">
          <div class="code" data-code="${a.id}">······</div>
          ${!isHotp ? `<span class="next-code" data-nextcode="${a.id}"></span>` : ''}
          <span class="tag copied-tag hidden" data-copied="${a.id}">কপিড ✓</span>
        </div>
      </div>
      <div class="card-side">
        ${reorderMode ? `
          <div class="reorder-actions">
            <button class="mini" data-move="-1" data-mid="${a.id}" ${idx === 0 ? 'disabled style="opacity:.35"' : ''} title="উপরে নিন">↑</button>
            <button class="mini" data-move="1" data-mid="${a.id}" ${idx === total - 1 ? 'disabled style="opacity:.35"' : ''} title="নিচে নিন">↓</button>
          </div>` : `
          ${isHotp
            ? `<button class="mini" data-next="${a.id}" title="পরবর্তী কোড">⟳</button>`
            : `<div class="ring" data-ring="${a.id}"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="${R}" fill="none" stroke-width="2.5"/><circle class="fg" cx="18" cy="18" r="${R}" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg><span class="sec"></span></div>`}
          <button class="mini edit-icon-btn" data-edit="${a.id}" title="এডিট">✏️</button>`}
      </div>
    </div>
  </div>`;
}

function attachSwipeListeners(card, a) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontal = null;
  const id = a.id;

  const onTouchStart = (e) => {
    if (reorderMode || batchMode) return;
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    currentX = startX;
    isDragging = false;
    isHorizontal = null;
    if (openSwipeCard && openSwipeCard !== card) {
      resetOpenSwipe();
    }
  };

  const onTouchMove = (e) => {
    if (reorderMode || batchMode) return;
    const touch = e.touches ? e.touches[0] : e;
    currentX = touch.clientX;
    const diffX = currentX - startX;
    const diffY = touch.clientY - startY;

    if (isHorizontal === null) {
      if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
        isHorizontal = true;
      } else if (Math.abs(diffY) > 8) {
        isHorizontal = false;
      }
    }

    if (isHorizontal) {
      if (e.cancelable) e.preventDefault();
      isDragging = true;
      card.classList.add('swiping');
      let offset = diffX;
      if (openSwipeCard === card) {
        offset = diffX - 120;
      }
      if (offset > 0) {
        offset = Math.min(offset, 90);
      } else {
        offset = Math.max(offset, -140);
      }
      card.style.transform = `translateX(${offset}px)`;
    }
  };

  const onTouchEnd = async () => {
    if (reorderMode || batchMode) return;
    card.classList.remove('swiping');
    if (!isDragging) return;

    const diffX = currentX - startX;
    if (diffX > 60) {
      card.style.transform = 'translateX(0px)';
      openSwipeCard = null;
      navigator.vibrate?.(30);
      const codeEl = card.querySelector('.code');
      const raw = codeEl?.dataset.raw;
      if (raw && (await copyText(raw))) {
        recordCopyEvent(id);
        card.classList.add('copied');
        const tag = card.querySelector(`[data-copied="${id}"]`);
        tag?.classList.remove('hidden');
        setTimeout(() => { card.classList.remove('copied'); tag?.classList.add('hidden'); }, 1400);
        toast('কোড কপি হয়েছে ✓');
      }
    } else if (diffX < -50) {
      card.style.transform = 'translateX(-120px)';
      openSwipeCard = card;
      navigator.vibrate?.(20);
    } else {
      card.style.transform = 'translateX(0px)';
      openSwipeCard = null;
    }
  };

  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchmove', onTouchMove, { passive: false });
  card.addEventListener('touchend', onTouchEnd);
  card.addEventListener('touchcancel', onTouchEnd);
}

function render() {
  const list = visibleAccounts();
  const sortEl = $('#sort');
  if (sortEl) sortEl.value = settings.sort;
  $('#reorderBar')?.classList.toggle('hidden', !reorderMode);
  renderChips();
  $('#empty')?.classList.toggle('hidden', vault.accounts.length > 0);
  const badge = $('#countBadge');
  if (badge) badge.textContent = vault.accounts.length;

  const listEl = $('#list');
  if (!listEl) return;
  listEl.innerHTML = list.map((a, i) => cardHtml(a, i, list.length)).join('');

  const orderedIds = list.map((a) => a.id);
  listEl.querySelectorAll('.card-wrap').forEach((wrap) => {
    const id = wrap.dataset.wrapId;
    const a = vault.accounts.find((x) => x.id === id);
    if (!a) return;
    const card = wrap.querySelector('.card');

    attachSwipeListeners(card, a);

    const recSwipeBtn = wrap.querySelector('[data-swipe-rec]');
    if (recSwipeBtn) recSwipeBtn.onclick = (e) => { e.stopPropagation(); resetOpenSwipe(); openRecoveryCodesDialog(ctx, id); };

    const focusBtn = wrap.querySelector('[data-swipe-focus]');
    if (focusBtn) focusBtn.onclick = (e) => { e.stopPropagation(); resetOpenSwipe(); openFocusView(ctx, id); };

    const editBtn = wrap.querySelector('[data-swipe-edit]');
    if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); resetOpenSwipe(); openEdit(ctx, id); };

    const pinBtn = wrap.querySelector('[data-swipe-pin]');
    if (pinBtn) pinBtn.onclick = (e) => {
      e.stopPropagation(); resetOpenSwipe();
      updateAccount(vault, id, { pinned: !a.pinned });
      commit();
      playDropletSound(settings);
      haptic('light');
      toast(a.pinned ? 'আনপিন করা হয়েছে' : 'পিন করা হয়েছে ⭐');
    };

    const delBtn = wrap.querySelector('[data-swipe-del]');
    if (delBtn) delBtn.onclick = async (e) => {
      e.stopPropagation(); resetOpenSwipe();
      const ok = await confirmDialog('অ্যাকাউন্ট মুছবেন?', `${a.issuer || a.name || 'এই অ্যাকাউন্ট'} মুছে ফেললে ৩০ দিন রিসাইকেল বিনে থাকবে।`, 'মুছুন', true);
      if (ok) {
        deleteAccount(vault, id);
        commit();
        playDropletSound(settings);
        haptic('warning');
        toast('রিসাইকেল বিনে সরানো হয়েছে 🗑️');
      }
    };

    card.onclick = async (e) => {
      if (openSwipeCard) {
        resetOpenSwipe();
        return;
      }
      if (batchMode) {
        if (selectedBatchIds.has(id)) {
          selectedBatchIds.delete(id);
          card.classList.remove('selected-for-batch');
        } else {
          selectedBatchIds.add(id);
          card.classList.add('selected-for-batch');
          playDropletSound(settings);
          haptic('light');
        }
        updateBatchUi();
        return;
      }
      const moveBtn = e.target.closest('[data-move]');
      if (moveBtn) {
        const dir = Number(moveBtn.dataset.move);
        if (moveAccountOrder(vault, id, dir, orderedIds)) commit();
        return;
      }
      if (reorderMode) return;
      if (e.target.closest('[data-recovery]')) return openRecoveryCodesDialog(ctx, id);
      if (e.target.closest('[data-ring]')) return openFocusView(ctx, id);
      if (e.target.closest('[data-edit]')) return openEdit(ctx, id);
      if (e.target.closest('[data-next]')) {
        updateAccount(vault, id, { counter: (a.counter || 0) + 1 });
        return commit();
      }
      const codeEl = card.querySelector('.code');
      if (settings.hideCodes && codeEl.classList.contains('hide')) { reveal(id); }
      if (settings.autoCopy) {
        const raw = codeEl.dataset.raw;
        if (raw && (await copyText(raw))) {
          recordCopyEvent(id);
          playDropletSound(settings);
          haptic('light');
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
  const now = getCorrectedNow();
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
        codeEl.classList.remove('fresh');
        void codeEl.offsetWidth;
        codeEl.classList.add('fresh');
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
  $('#lock')?.classList.remove('hidden');
  const lockMsg = $('#lockMsg');
  if (lockMsg) lockMsg.textContent = 'PIN দিন';
  const lockPin = $('#lockPin');
  if (lockPin) { lockPin.value = ''; lockPin.focus(); }
  $('#bioBtn')?.classList.toggle('hidden', !settings.bioCredId);
}

async function tryUnlock() {
  const pinVal = $('#lockPin')?.value || '';
  const h = await hashPin(pinVal);
  if (h === settings.pinHash) {
    $('#lock')?.classList.add('hidden');
  } else {
    const lockMsg = $('#lockMsg');
    if (lockMsg) lockMsg.textContent = 'ভুল PIN';
    const lockPin = $('#lockPin');
    if (lockPin) lockPin.value = '';
  }
}

async function tryBiometricUnlock() {
  try {
    if (await verifyBiometric()) $('#lock')?.classList.add('hidden');
  } catch {
    const lockMsg = $('#lockMsg');
    if (lockMsg) lockMsg.textContent = 'বায়োমেট্রিক বাতিল হয়েছে — PIN দিন';
  }
}

// ---------- boot ----------
const fab = $('#fab');
if (fab) fab.onclick = () => openAddMenu(ctx);
const menuBtn = $('#menuBtn');
if (menuBtn) menuBtn.onclick = () => openMenu(ctx);

// Quick Dark / Light mode toggle button
const themeToggleBtn = $('#themeToggleBtn');
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const cur = resolvedMode();
    settings.mode = cur === 'light' ? 'dark' : 'light';
    playDropletSound(settings);
    haptic('light');
    saveSettings();
    toast(settings.mode === 'light' ? '☀️ লাইট মোড চালু হয়েছে' : '🌙 ডার্ক মোড চালু হয়েছে');
  };
}

// Theme palette modal button
const themeBtn = $('#themeBtn');
if (themeBtn) {
  themeBtn.onclick = (e) => {
    e.preventDefault();
    openThemePicker(ctx);
  };
}
const syncBtn = $('#syncBtn');
if (syncBtn) syncBtn.onclick = () => openSync(ctx);
const bannerSyncBtn = $('#bannerSyncBtn');
if (bannerSyncBtn) bannerSyncBtn.onclick = () => {
  const user = drive.getUser();
  const hasPass = !!sync.getPassphrase();
  if (user && !hasPass) {
    afterSignIn(ctx);
  } else {
    openSync(ctx);
  }
};
const bannerCloseBtn = $('#bannerCloseBtn');
if (bannerCloseBtn) bannerCloseBtn.onclick = () => {
  settings.bannerDismissed = true;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  refreshSyncDot();
};
const reorderDoneBtn = $('#reorderDoneBtn');
if (reorderDoneBtn) reorderDoneBtn.onclick = () => {
  reorderMode = false;
  render();
  refreshSyncDot();
  toast('সাজানো সেভ হয়েছে ✅');
};

// Batch Action Bar Handlers
const batchActionBtn = $('#batchActionBtn');
if (batchActionBtn) {
  batchActionBtn.onclick = () => {
    openBatchActionsModal(ctx, Array.from(selectedBatchIds), () => {
      exitBatchMode();
    });
  };
}
const batchCloseBtn = $('#batchCloseBtn');
if (batchCloseBtn) {
  batchCloseBtn.onclick = () => exitBatchMode();
}

// Panic Quick-Lock: Triple tap header brand logo/title to immediately lock vault
let brandTapCount = 0;
let brandTapTimer = null;
const brandEl = document.querySelector('.brand');
if (brandEl) {
  brandEl.addEventListener('click', () => {
    brandTapCount++;
    clearTimeout(brandTapTimer);
    if (brandTapCount >= 3) {
      brandTapCount = 0;
      haptic('warning');
      showLock(true);
      toast('🔒 প্যানিক কুইক-লক সক্রিয় করা হয়েছে');
    } else {
      brandTapTimer = setTimeout(() => { brandTapCount = 0; }, 800);
    }
  });
}

// Search toggle & inputs
const searchToggleBtn = $('#searchToggleBtn');
const searchBarWrap = $('#searchBarWrap');
const searchInput = $('#search');
const searchCloseBtn = $('#searchCloseBtn');

if (searchToggleBtn && searchBarWrap) {
  searchToggleBtn.onclick = () => {
    searchBarWrap.classList.toggle('hidden');
    if (!searchBarWrap.classList.contains('hidden')) {
      searchInput?.focus();
    } else {
      query = '';
      if (searchInput) searchInput.value = '';
      render();
    }
  };
}
if (searchCloseBtn && searchBarWrap) {
  searchCloseBtn.onclick = () => {
    searchBarWrap.classList.add('hidden');
    query = '';
    if (searchInput) searchInput.value = '';
    render();
  };
}
if (searchInput) {
  searchInput.oninput = (e) => {
    query = e.target.value.trim();
    render();
  };
}

const sortSelect = $('#sort');
if (sortSelect) sortSelect.onchange = (e) => { settings.sort = e.target.value; saveSettings(); };

const lockBtn = $('#lockBtn');
if (lockBtn) lockBtn.onclick = tryUnlock;
const bioBtn = $('#bioBtn');
if (bioBtn) bioBtn.onclick = tryBiometricUnlock;
const lockPin = $('#lockPin');
if (lockPin) lockPin.onkeydown = (e) => { if (e.key === 'Enter') tryUnlock(); };

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

// Water-drop ripple & physical pop sound on tap
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.card, .fab, .btn, .chip, .icon-btn, .menu-item, .qbtn, .tab-btn');
  if (!t) return;
  playDropletSound(settings);
  const r = t.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 1.65;
  const s = document.createElement('span');
  s.className = 'drop';
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  t.appendChild(s);
  setTimeout(() => s.remove(), 750);
});

initPhysics();
syncNetworkTime().catch(() => {});
applyTheme();
render();
refreshSyncDot();
showLock(true);
setInterval(tick, 1000);
setInterval(() => doSync(false), 5 * 60 * 1000);
doSync(false);

// Handle home-screen app shortcuts (?action=scan / ?action=sync / ?auth_bridge=1)
const urlParams = new URLSearchParams(location.search);
const action = urlParams.get('action');
if (action === 'scan') setTimeout(() => openScan(ctx), 300);
else if (action === 'sync') setTimeout(() => openSync(ctx), 300);

if (urlParams.get('auth_bridge') === '1') {
  const targetExtId = urlParams.get('ext_id') || 'kkbnfefhgpmcbkelfbchfffdagmifddl';
  setTimeout(() => handleWebAuthBridge(targetExtId), 400);
}

// Handle OAuth2 Implicit Flow hash redirect (#access_token=...)
if (location.hash && location.hash.includes('access_token=')) {
  handleOAuthHash();
}

async function handleWebAuthBridge(extId) {
  const m = openModal(`
    <div style="text-align:center;padding:10px 4px">
      <div style="font-size:38px;margin-bottom:8px">🛡️ ⇄ 🌐</div>
      <h3 style="margin:0 0 6px;font-size:18px">এক্সটেনশন ক্লাউড সিঙ্ক ব্রিজ</h3>
      <p class="hint" style="margin-bottom:16px;line-height:1.5">
        <b>Continue with Google</b> চেপে আপনার গুগল অ্যাকাউন্টে সাইন-ইন করলেই
        ব্রাউজার এক্সটেনশনে স্বয়ংক্রিয়ভাবে ক্লাউড ব্যাকআপ সিঙ্ক সক্রিয় হয়ে যাবে।
      </p>
      <button class="btn google-btn block" id="bridgeGoogleBtn">
        ${GOOGLE_G_SVG}<span>Continue with Google</span>
      </button>
      <div id="bridgeStatus" style="margin-top:14px;font-size:12.5px;color:var(--muted)"></div>
    </div>
  `);

  const btn = m.el.querySelector('#bridgeGoogleBtn');
  const statusEl = m.el.querySelector('#bridgeStatus');

  btn.onclick = async () => {
    btn.disabled = true;
    statusEl.innerHTML = 'গুগল সাইন-ইন লোড হচ্ছে...';
    try {
      const user = await drive.signIn(true);
      const session = drive.getSession();
      statusEl.innerHTML = `<span style="color:var(--ok)">✅ সাইন-ইন সফল: ${esc(user.email)}</span><br>এক্সটেনশনে তথ্য পাঠানো হচ্ছে...`;

      let delivered = false;
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          const pass = sync.getPassphrase();
          const currentVault = loadVault();
          chrome.runtime.sendMessage(extId, {
            type: 'AUTH_BRIDGE_SUCCESS',
            session,
            passphrase: pass || '',
            vault: currentVault
          }, (resp) => {
            if (resp?.success || !chrome.runtime?.lastError) {
              delivered = true;
              statusEl.innerHTML = `<span style="color:var(--ok)">🎉 এক্সটেনশনে সিঙ্ক সফলভাবে চালু হয়েছে!</span><br><small>এই ট্যাবটি ৩ সেকেন্ডে বন্ধ হয়ে যাবে...</small>`;
              setTimeout(() => {
                m.close();
                try { window.close(); } catch {}
              }, 2500);
            }
          });
        } catch (e) {
          console.warn('Direct sendMessage note:', e);
        }
      }

      setTimeout(() => {
        if (!delivered) {
          statusEl.innerHTML = `
            <div style="margin-top:10px;padding:12px;background:var(--card2);border-radius:14px;font-size:12px;text-align:left;border:1px solid var(--line)">
              <b style="color:var(--ok)">✅ গুগল সাইন-ইন সফল হয়েছে!</b><br>
              এক্সটেনশনে টোকেন যুক্ত করতে নিচের বাটনে চাপ দিন:<br>
              <button class="btn sm primary block" id="copyTokenBtn" style="margin-top:8px">📋 ১-ক্লিকে টোকেন কপি করুন</button>
            </div>
          `;
          const copyBtn = statusEl.querySelector('#copyTokenBtn');
          if (copyBtn) {
            copyBtn.onclick = () => {
              copyText(session.token);
              toast('টোকেন কপি হয়েছে! এক্সটেনশনে পেস্ট করুন ✅');
            };
          }
        }
      }, 1500);
    } catch (err) {
      btn.disabled = false;
      statusEl.innerHTML = `<span style="color:var(--danger)">সাইন-ইন সমস্যা: ${esc(err.message)}</span>`;
      toast(err.message);
    }
  };
}

async function handleOAuthHash() {
  try {
    const hash = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = Number(params.get('expires_in')) || 3600;

    if (!token) return;

    // Clear hash from address bar immediately
    history.replaceState(null, '', location.pathname + location.search);

    // If opened as popup window by opener:
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({ authpro_token: true, token, expiresIn }, location.origin);
        window.close();
        return;
      } catch {}
    }

    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    drive.saveSession({
      token,
      expiresAt: Date.now() + expiresIn * 1000,
      email: info.email,
      name: info.name,
      picture: info.picture,
    });

    toast(`Google ব্যাকআপ সংযুক্ত: ${info.email} ✅`);
    refreshSyncDot();
    doSync(true);
  } catch (e) {
    console.error('OAuth hash error:', e);
  }
}

// Service Worker registration + automatic one-tap update notifications
if (location.protocol !== 'chrome-extension:' && 'serviceWorker' in navigator) {
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
