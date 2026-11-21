// Add-account flows with Batch Import Preview for Google Authenticator Export.
import { openModal, esc, toast } from './ui.js';
import { parseOtpauth, isValidSecret } from './otp.js';
import { decodeMigration, isMigrationUri } from './migration.js';
import { addAccounts, sameSecret } from './store.js';
import { startCamera, scanImageFile } from './scanner.js';

export function parseTextAccounts(text) {
  text = text.trim();
  if (isMigrationUri(text)) return decodeMigration(text);
  if (/^otpauth:\/\//i.test(text)) return [parseOtpauth(text)];
  throw new Error('এটা বৈধ otpauth / Google export QR নয়');
}

// Handles any scanned/pasted text immediately (used in live multi-QR camera scan).
export function handleText(ctx, text) {
  const list = parseTextAccounts(text);
  const { added, skipped } = addAccounts(ctx.vault, list);
  ctx.commit();
  toast(`${added}টি যোগ হয়েছে` + (skipped ? `, ${skipped}টি আগে থেকেই ছিল` : ''));
  return added;
}

// Shows a Liquid Glass preview checklist before importing multiple accounts (e.g., from Google Authenticator Export).
export function openImportPreview(ctx, accounts, sourceLabel = 'ইমপোর্ট প্রিভিউ') {
  if (!accounts.length) return toast('কোনো অ্যাকাউন্ট পাওয়া যায়নি');
  if (accounts.length === 1) {
    const { added, skipped } = addAccounts(ctx.vault, accounts);
    ctx.commit();
    return toast(added ? '১টি অ্যাকাউন্ট যোগ হয়েছে ✅' : 'এই অ্যাকাউন্ট আগেই যোগ করা আছে');
  }
  const items = accounts.map((a, idx) => {
    const dup = ctx.vault.accounts.some((x) => sameSecret(x, a));
    return { a, idx, dup };
  });
  const m = openModal(`
    <h3>📥 ${esc(sourceLabel)} <span class="badge-count">${items.length}টি</span></h3>
    <p class="hint">যে অ্যাকাউন্টগুলো যোগ করতে চান সেগুলো সিলেক্ট রাখুন। আগে থেকে থাকা ডুপ্লিকেটগুলো স্বয়ংক্রিয়ভাবে বাদ পড়বে।</p>
    <div class="check-list">
      ${items.map(({ a, idx, dup }) => `
        <label class="check-item">
          <input type="checkbox" data-idx="${idx}" ${dup ? '' : 'checked'}>
          <div class="ci-info">
            <b>${esc(a.issuer || a.name || 'Unnamed')}</b>
            <small>${esc(a.issuer ? a.name : '')} ${dup ? '• আগে থেকেই আছে' : ''}</small>
          </div>
          <span class="tag">${esc((a.type || 'totp').toUpperCase())}</span>
        </label>`).join('')}
    </div>
    <div class="row">
      <button class="btn" id="cancel">বাতিল</button>
      <button class="btn primary" id="confirm">সিলেক্টেড যোগ করুন</button>
    </div>`);
  m.el.querySelector('#cancel').onclick = () => m.close();
  m.el.querySelector('#confirm').onclick = () => {
    const chosen = [];
    m.el.querySelectorAll('input[type=checkbox]:checked').forEach((cb) => {
      chosen.push(accounts[+cb.dataset.idx]);
    });
    if (!chosen.length) return toast('কমপক্ষে একটি অ্যাকাউন্ট সিলেক্ট করুন');
    const { added, skipped } = addAccounts(ctx.vault, chosen);
    ctx.commit();
    m.close();
    toast(`${added}টি অ্যাকাউন্ট যোগ হয়েছে ✅` + (skipped ? ` (${skipped}টি ডুপ্লিকেট বাদ)` : ''));
  };
}

export function openAddMenu(ctx) {
  const m = openModal(`
    <h3>অ্যাকাউন্ট যোগ করুন</h3>
    <button class="menu-item" data-a="scan"><span class="ico">📷</span><span>QR স্ক্যান করুন<small>ক্যামেরা দিয়ে — সাধারণ QR বা Google Authenticator Export QR</small></span></button>
    <button class="menu-item" data-a="image"><span class="ico">🖼️</span><span>ছবি/স্ক্রিনশট থেকে<small>গ্যালারি থেকে QR-এর ছবি দিন (একাধিক ফাইল চলবে)</small></span></button>
    <button class="menu-item" data-a="gaexport"><span class="ico">📤</span><span>Google Authenticator থেকে ইমপোর্ট<small>ধাপে ধাপে সহজ গাইড + ব্যাচ প্রিভিউ</small></span></button>
    <button class="menu-item" data-a="paste"><span class="ico">📋</span><span>লিংক পেস্ট করুন<small>otpauth:// বা otpauth-migration://</small></span></button>
    <button class="menu-item" data-a="manual"><span class="ico">⌨️</span><span>Secret key নিজে লিখুন<small>TOTP / HOTP / Steam Guard</small></span></button>
    <button class="menu-item" data-a="pwdgen"><span class="ico">🔑</span><span>পাসওয়ার্ড জেনারেটর<small>নতুন অ্যাকাউন্টের জন্য শক্তিশালী পাসওয়ার্ড তৈরি</small></span></button>
    <input type="file" id="file" accept="image/*" multiple class="hidden">`);
  const go = (a) => { m.close(); ({ scan: () => openScan(ctx), paste: () => openPaste(ctx), manual: () => openManual(ctx), gaexport: () => openGAGuide(ctx), pwdgen: () => ctx.openPasswordGenerator() })[a]?.(); };
  m.el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    if (b.dataset.a === 'image') return m.el.querySelector('#file').click();
    go(b.dataset.a);
  }));
  m.el.querySelector('#file').onchange = async (e) => {
    const collected = [];
    let fail = 0;
    for (const f of e.target.files) {
      try { collected.push(...parseTextAccounts(await scanImageFile(f))); } catch (err) { fail++; toast(err.message); }
    }
    m.close();
    if (collected.length) openImportPreview(ctx, collected, 'QR ছবি থেকে ইমপোর্ট');
    else if (fail) toast('কোনো বৈধ QR পাওয়া যায়নি');
  };
}

export function openScan(ctx) {
  let cam;
  const m = openModal(`
    <h3>QR স্ক্যান</h3>
    <video class="cam" playsinline muted></video>
    <p class="hint" id="st">QR কোডটা ক্যামেরার সামনে ধরুন। Google Authenticator-এর Export-এ একাধিক QR থাকলে একটার পর একটা স্ক্যান করুন।</p>
    <div class="row"><button class="btn primary" id="done">শেষ</button></div>`, { onClose: () => cam?.stop() });
  let total = 0;
  startCamera(m.el.querySelector('video'), (text) => {
    try {
      total += handleText(ctx, text);
      m.el.querySelector('#st').textContent = `✅ এখন পর্যন্ত ${total}টি যোগ হয়েছে। আরও QR থাকলে স্ক্যান করুন।`;
      navigator.vibrate?.(60);
    } catch { /* not an OTP QR; keep scanning */ }
  }).then((c) => (cam = c)).catch((e) => {
    m.el.querySelector('#st').textContent = 'ক্যামেরা চালু হয়নি: ' + e.message + ' — "ছবি থেকে" অপশন ব্যবহার করুন।';
  });
  m.el.querySelector('#done').onclick = () => m.close();
}

export function openPaste(ctx) {
  const m = openModal(`
    <h3>লিংক পেস্ট</h3>
    <div class="field"><textarea id="t" rows="5" placeholder="otpauth://totp/...  অথবা  otpauth-migration://offline?data=..."></textarea></div>
    <p class="hint">প্রতি লাইনে একটি করে লিংক দিতে পারেন। একাধিক অ্যাকাউন্ট হলে আগে প্রিভিউ দেখাবে।</p>
    <button class="btn primary block" id="ok">পরবর্তী</button>`);
  m.el.querySelector('#ok').onclick = () => {
    const lines = m.el.querySelector('#t').value.split(/\s*\n\s*/).filter(Boolean);
    const collected = [];
    try {
      for (const l of lines) collected.push(...parseTextAccounts(l));
      m.close();
      openImportPreview(ctx, collected, 'লিংক থেকে ইমপোর্ট');
    } catch (e) { toast(e.message); }
  };
}

export function openManual(ctx) {
  const groups = ctx.vault.groups || [];
  const m = openModal(`
    <h3>নতুন অ্যাকাউন্ট</h3>
    <div class="field"><label>সার্ভিসের নাম (Issuer)</label><input id="issuer" placeholder="Google, GitHub, Binance…"></div>
    <div class="field"><label>অ্যাকাউন্ট (ইমেইল/ইউজারনেম)</label><input id="name" placeholder="me@gmail.com"></div>
    <div class="field"><label>Secret key (Base32)</label><input id="secret" autocapitalize="characters" autocomplete="off" placeholder="JBSW Y3DP EHPK 3PXP"></div>
    <div class="row">
      <div class="field"><label>গ্রুপ (ঐচ্ছিক)</label><input id="group" list="mgl" placeholder="Work / Personal">
        <datalist id="mgl">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div class="field"><label>ধরন</label><select id="type"><option value="totp">TOTP (সময়ভিত্তিক)</option><option value="hotp">HOTP (কাউন্টার)</option><option value="steam">Steam Guard</option></select></div>
    </div>
    <div class="row">
      <div class="field"><label>ডিজিট</label><select id="digits"><option>6</option><option>7</option><option>8</option></select></div>
      <div class="field"><label>অ্যালগরিদম</label><select id="algorithm"><option>SHA1</option><option>SHA256</option><option>SHA512</option></select></div>
      <div class="field"><label>পিরিয়ড</label><input id="period" type="number" value="30" min="5" max="120"></div>
    </div>
    <button class="btn primary block" id="ok">সেভ করুন</button>`);
  const g = (id) => m.el.querySelector('#' + id).value.trim();
  m.el.querySelector('#ok').onclick = () => {
    const secret = g('secret').replace(/\s+/g, '').toUpperCase();
    if (!isValidSecret(secret)) return toast('Secret key সঠিক নয়');
    if (!g('issuer') && !g('name')) return toast('নাম লিখুন');
    const type = g('type');
    const group = g('group');
    if (group && !ctx.vault.groups.includes(group)) ctx.vault.groups.push(group);
    addAccounts(ctx.vault, [{
      issuer: g('issuer'), name: g('name'), secret, type, group,
      digits: type === 'steam' ? 5 : +g('digits'), algorithm: g('algorithm'), period: +g('period') || 30,
    }]);
    ctx.commit(); m.close(); toast('যোগ হয়েছে ✅');
  };
}

export function openGAGuide(ctx) {
  const m = openModal(`
    <h3>📤 Google Authenticator থেকে ইমপোর্ট</h3>
    <ol class="hint" style="padding-left:18px;line-height:1.8">
      <li>মূল <b>Google Authenticator</b> অ্যাপ খুলুন</li>
      <li>উপরে <b>☰ / প্রোফাইল → Transfer accounts → Export accounts</b></li>
      <li>সব অ্যাকাউন্ট সিলেক্ট করে <b>Export</b> চাপুন — QR কোড আসবে (বেশি হলে একাধিক QR)</li>
      <li>নিচের <b>📷 স্ক্যান</b> চেপে ক্যামেরায় ধরুন, অথবা QR-এর স্ক্রিনশট নিয়ে <b>🖼️ ছবি দিন</b></li>
    </ol>
    <p class="hint">⚠️ Export QR-এ আপনার সব secret থাকে — ইমপোর্টের পর গ্যালারি থেকে স্ক্রিনশট মুছে ফেলুন।</p>
    <div class="row"><button class="btn primary" id="s">📷 স্ক্যান করুন</button><button class="btn" id="p">🖼️ ছবি দিন</button></div>
    <input type="file" id="file" accept="image/*" multiple class="hidden">`);
  m.el.querySelector('#s').onclick = () => { m.close(); openScan(ctx); };
  m.el.querySelector('#p').onclick = () => m.el.querySelector('#file').click();
  m.el.querySelector('#file').onchange = async (e) => {
    const collected = [];
    for (const f of e.target.files) {
      try { collected.push(...parseTextAccounts(await scanImageFile(f))); } catch (err) { toast(err.message); }
    }
    m.close();
    if (collected.length) openImportPreview(ctx, collected, 'Google Authenticator ইমপোর্ট');
  };
}
