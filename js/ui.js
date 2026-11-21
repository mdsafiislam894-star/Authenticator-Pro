// Small UI helpers: escaping, toast, Liquid Glass modals, brand droplet colors, QR rendering.
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const GOOGLE_G_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"/>
  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.14-4.06 1.14-3.12 0-5.77-2.11-6.72-4.95H1.29v3.1A12 12 0 0 0 12 24z"/>
  <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.1z"/>
  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.1c.95-2.84 3.6-4.95 6.72-4.95z"/>
</svg>`;

let toastTimer;
export function toast(msg, actionLabel, onAction, ms = 3200) {
  const el = $('#toast');
  el.innerHTML = esc(msg) + (actionLabel ? `<button>${esc(actionLabel)}</button>` : '');
  el.classList.remove('hidden');
  if (actionLabel) el.querySelector('button').onclick = () => { el.classList.add('hidden'); onAction?.(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// Opens a Liquid Glass bottom-sheet. Returns { el, close }.
export function openModal(html, { onClose } = {}) {
  const root = $('#modalRoot');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="sheet">${html}</div>`;
  root.appendChild(overlay);
  const close = () => { overlay.remove(); onClose?.(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { el: overlay.firstElementChild, close };
}

export function confirmDialog(title, text, okLabel = 'নিশ্চিত', danger = false) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h3>${esc(title)}</h3><p class="hint">${esc(text)}</p>
      <div class="row"><button class="btn" id="no">বাতিল</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" id="yes">${esc(okLabel)}</button></div>`,
      { onClose: () => resolve(false) });
    m.el.querySelector('#no').onclick = () => m.close();
    m.el.querySelector('#yes').onclick = () => { resolve(true); m.el.closest('.overlay').remove(); };
  });
}

export function inputDialog(title, { label = '', value = '', placeholder = '', type = 'text', okLabel = 'সেভ', hint = '' } = {}) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h3>${esc(title)}</h3>
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
      <div class="field">
        ${label ? `<label>${esc(label)}</label>` : ''}
        <input id="inp" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
      </div>
      <div class="row"><button class="btn" id="no">বাতিল</button>
      <button class="btn primary" id="yes">${esc(okLabel)}</button></div>`,
      { onClose: () => resolve(null) });
    const inp = m.el.querySelector('#inp');
    setTimeout(() => { inp.focus(); inp.select?.(); }, 60);
    const submit = () => { const v = inp.value; m.el.closest('.overlay').remove(); resolve(v); };
    m.el.querySelector('#no').onclick = () => m.close();
    m.el.querySelector('#yes').onclick = submit;
    inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  });
}

const BRAND_COLORS = [
  [/google|gmail|youtube/i, 'linear-gradient(145deg, #f05a5b, #d93038)'],
  [/github/i, 'linear-gradient(145deg, #d83b98, #9c2270)'],
  [/facebook|meta/i, 'linear-gradient(145deg, #6958e8, #4434c2)'],
  [/binance/i, 'linear-gradient(145deg, #eb5255, #c92d34)'],
  [/aws|amazon/i, 'linear-gradient(145deg, #32a86b, #1d7d4d)'],
  [/discord/i, 'linear-gradient(145deg, #7484ff, #4c5be0)'],
  [/microsoft|outlook|azure/i, 'linear-gradient(145deg, #369eff, #1769d4)'],
  [/apple|icloud/i, 'linear-gradient(145deg, #6b7280, #374151)'],
  [/instagram/i, 'linear-gradient(145deg, #f45b84, #a837c7)'],
  [/telegram/i, 'linear-gradient(145deg, #38b2f0, #1c88cc)'],
  [/cloudflare/i, 'linear-gradient(145deg, #f9963b, #e06b14)'],
  [/steam/i, 'linear-gradient(145deg, #3a6ea5, #1e3b63)'],
  [/paypal/i, 'linear-gradient(145deg, #2d7ff9, #1545a8)'],
];

const COLORS = [
  'linear-gradient(145deg, #5b8cff, #3b63d9)',
  'linear-gradient(145deg, #9b6dff, #6d3de0)',
  'linear-gradient(145deg, #ee5459, #c92a34)',
  'linear-gradient(145deg, #f5a524, #d67e00)',
  'linear-gradient(145deg, #34b374, #1d8653)',
  'linear-gradient(145deg, #17b8bd, #0a828a)',
  'linear-gradient(145deg, #e04ca8, #b0287c)',
  'linear-gradient(145deg, #7c66dc, #533eb5)',
  'linear-gradient(145deg, #f06d44, #c9461d)',
];

export function avatarColor(text) {
  const str = String(text || '?');
  for (const [re, grad] of BRAND_COLORS) {
    if (re.test(str)) return grad;
  }
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function formatCode(code) {
  if (code.length === 6) return code.slice(0, 3) + ' ' + code.slice(3);
  if (code.length === 8) return code.slice(0, 4) + ' ' + code.slice(4);
  return code;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let qrLibPromise;
function loadQrLib() {
  if (globalThis.qrcode) return Promise.resolve();
  qrLibPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('QR জেনারেটর লোড হয়নি (ইন্টারনেট দরকার)'));
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

export async function qrSvg(text) {
  await loadQrLib();
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
}
