// Account management dialogs: Quick Actions + Edit/Rename, QR/Secret, Group Manager, Recycle Bin, and Google Auth Export.
import { openModal, esc, toast, confirmDialog, inputDialog, qrSvg, copyText } from './ui.js';
import { updateAccount, deleteAccount, restoreAccount, permanentlyDeleteFromTrash, emptyTrash } from './store.js';
import { buildOtpauth, generateCode, isValidSecret } from './otp.js';
import { encodeMigration } from './migration.js';

export function openEdit(ctx, id) {
  const a = ctx.vault.accounts.find((x) => x.id === id);
  if (!a) return;
  const groups = ctx.vault.groups || [];
  const m = openModal(`
    <h3>${esc(a.issuer || a.name || 'অ্যাকাউন্ট')}</h3>
    <div class="quick-grid">
      <button class="qbtn" id="qCopy"><span class="qico">📋</span>কপি</button>
      <button class="qbtn ${a.pinned ? 'active' : ''}" id="qPin"><span class="qico">⭐</span>${a.pinned ? 'আনপিন' : 'পিন'}</button>
      <button class="qbtn" id="qFocus"><span class="qico">🔍</span>ফোকাস</button>
      <button class="qbtn" id="qRecovery"><span class="qico">🔐</span>রিকভারি (${(a.recoveryCodes || []).length})</button>
      <button class="qbtn" id="qQr"><span class="qico">📱</span>QR কোড</button>
      <button class="qbtn danger" id="qDel"><span class="qico">🗑️</span>ডিলিট</button>
    </div>
    <div class="field"><label>সার্ভিসের নাম (Issuer / রিনেম)</label><input id="issuer" value="${esc(a.issuer)}"></div>
    <div class="field"><label>অ্যাকাউন্ট (ইমেইল / ইউজারনেম)</label><input id="name" value="${esc(a.name)}"></div>
    <div class="row">
      <div class="field"><label>গ্রুপ / ফোল্ডার</label><input id="group" list="gl" value="${esc(a.group)}" placeholder="যেমন: Work, Personal">
        <datalist id="gl">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div class="field"><label>ডিজিট</label><select id="digits">${[5, 6, 7, 8].map((d) => `<option ${d === a.digits ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
    </div>
    <div class="row">
      <div class="field"><label>অ্যালগরিদম</label><select id="algorithm">${['SHA1', 'SHA256', 'SHA512'].map((x) => `<option ${x === a.algorithm ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>পিরিয়ড (সে.)</label><input id="period" type="number" min="5" max="120" value="${a.period}"></div>
    </div>
    <div class="field"><label>নোট</label><textarea id="note" rows="2" placeholder="রিকভারি নোট বা তথ্য...">${esc(a.note)}</textarea></div>
    <details class="glass-details">
      <summary>🔑 Secret Key দেখুন / এডিট করুন</summary>
      <div class="field" style="margin-top:10px;margin-bottom:0">
        <input id="secret" value="${esc(a.secret)}" autocapitalize="characters" autocomplete="off">
      </div>
    </details>
    <div class="row" style="margin-top:14px">
      <button class="btn" id="cancel">বাতিল</button>
      <button class="btn primary" id="save">সেভ করুন</button>
    </div>`);

  const g = (x) => m.el.querySelector('#' + x).value.trim();

  m.el.querySelector('#qCopy').onclick = async () => {
    try {
      const code = await generateCode(a, Date.now());
      if (await copyText(code)) toast('কোড কপি হয়েছে ✅');
    } catch { toast('কোড তৈরি হয়নি'); }
  };

  m.el.querySelector('#qPin').onclick = () => {
    updateAccount(ctx.vault, id, { pinned: !a.pinned });
    ctx.commit();
    m.close();
    toast(a.pinned ? 'পিন করা হয়েছে ⭐' : 'আনপিন করা হয়েছে');
  };

  m.el.querySelector('#qFocus').onclick = () => { m.close(); ctx.openFocusView(id); };

  m.el.querySelector('#qRecovery').onclick = () => { m.close(); ctx.openRecoveryCodes(id); };

  m.el.querySelector('#qQr').onclick = () => { m.close(); openQr(ctx, id); };

  m.el.querySelector('#qDel').onclick = async () => {
    m.close();
    if (!(await confirmDialog('ট্র্যাশে পাঠাবেন?', `"${a.issuer || a.name}" মুছে ট্র্যাশে পাঠানো হবে। ৩০ দিনের মধ্যে রিসাইকেল বিন থেকে ফেরত আনতে পারবেন।`, 'ডিলিট', true))) return;
    const copy = { ...a };
    deleteAccount(ctx.vault, id);
    ctx.commit();
    toast('ট্র্যাশে পাঠানো হয়েছে', 'UNDO', () => { restoreAccount(ctx.vault, copy); ctx.commit(); }, 7000);
  };

  m.el.querySelector('#cancel').onclick = () => m.close();

  m.el.querySelector('#save').onclick = () => {
    const newSecret = g('secret').replace(/\s+/g, '').toUpperCase();
    if (!isValidSecret(newSecret)) return toast('Secret key সঠিক নয়');
    const group = g('group');
    if (group && !ctx.vault.groups.includes(group)) ctx.vault.groups.push(group);
    updateAccount(ctx.vault, id, {
      issuer: g('issuer'), name: g('name'), group, note: g('note'),
      secret: newSecret,
      digits: +g('digits'), algorithm: g('algorithm'), period: +g('period') || 30,
    });
    ctx.commit(); m.close(); toast('আপডেট সেভ হয়েছে ✅');
  };
}

export async function openQr(ctx, id) {
  const a = ctx.vault.accounts.find((x) => x.id === id);
  if (!a) return;
  const uri = buildOtpauth(a);
  let svg = '<p class="hint">QR লোড করতে ইন্টারনেট লাগবে।</p>';
  try { svg = await qrSvg(uri); } catch (e) { svg = `<p class="hint">${esc(e.message)}</p>`; }
  const m = openModal(`
    <h3>📱 ${esc(a.issuer || a.name)}</h3>
    <p class="hint">⚠️ এই QR/Secret যার কাছে যাবে সে আপনার কোড বানাতে পারবে। কাউকে দেখাবেন না।</p>
    <div class="qrbox">${svg}</div>
    <div class="secret">${esc(a.secret)}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="c1">Secret কপি</button>
      <button class="btn primary" id="c2">লিংক কপি</button>
    </div>`);
  m.el.querySelector('#c1').onclick = async () => toast((await copyText(a.secret)) ? 'Secret কপি হয়েছে ✅' : 'কপি ব্যর্থ');
  m.el.querySelector('#c2').onclick = async () => toast((await copyText(uri)) ? 'otpauth লিংক কপি হয়েছে ✅' : 'কপি ব্যর্থ');
}

export function openMigrationExport(ctx) {
  if (!ctx.vault.accounts.length) return toast('এক্সপোর্ট করার মতো কোনো অ্যাকাউন্ট নেই');
  const m = openModal(`
    <h3>📤 Google Authenticator-এ এক্সপোর্ট</h3>
    <p class="hint">যে অ্যাকাউন্টগুলো Export QR বানাতে চান সেগুলো সিলেক্ট করুন। অন্য ফোনের Google Authenticator বা Authenticator Pro দিয়ে স্ক্যান করলেই সব চলে যাবে।</p>
    <div class="check-list">
      ${ctx.vault.accounts.map((a, idx) => `
        <label class="check-item">
          <input type="checkbox" data-idx="${idx}" checked>
          <div class="ci-info">
            <b>${esc(a.issuer || a.name || 'Unnamed')}</b>
            <small>${esc(a.issuer ? a.name : '')}</small>
          </div>
          <span class="tag">${esc((a.type || 'totp').toUpperCase())}</span>
        </label>`).join('')}
    </div>
    <div class="row">
      <button class="btn" id="cancel">বাতিল</button>
      <button class="btn primary" id="gen">QR তৈরি করুন</button>
    </div>`);
  m.el.querySelector('#cancel').onclick = () => m.close();
  m.el.querySelector('#gen').onclick = () => {
    const selected = [];
    m.el.querySelectorAll('input[type=checkbox]:checked').forEach((cb) => {
      selected.push(ctx.vault.accounts[+cb.dataset.idx]);
    });
    if (!selected.length) return toast('কমপক্ষে একটি অ্যাকাউন্ট সিলেক্ট করুন');
    m.close();
    showMigrationQrBatches(selected);
  };
}

async function showMigrationQrBatches(accounts) {
  const uris = encodeMigration(accounts, { batchSize: 10 });
  let idx = 0;
  const m = openModal(`
    <h3>📤 Export QR (<span id="pg">1/${uris.length}</span>)</h3>
    <p class="hint">Google Authenticator → Transfer accounts → Import accounts দিয়ে এই QR স্ক্যান করুন।</p>
    <div class="qrbox" id="qrSlot"><p class="hint">QR তৈরি হচ্ছে…</p></div>
    <div class="row" style="margin-top:10px">
      ${uris.length > 1 ? '<button class="btn" id="prev">← আগের</button><button class="btn" id="next">পরের →</button>' : ''}
      <button class="btn primary" id="copyUri">লিংক কপি</button>
    </div>`);

  const draw = async () => {
    m.el.querySelector('#pg').textContent = `${idx + 1}/${uris.length}`;
    try {
      m.el.querySelector('#qrSlot').innerHTML = await qrSvg(uris[idx]);
    } catch (e) {
      m.el.querySelector('#qrSlot').innerHTML = `<p class="hint">${esc(e.message)}</p>`;
    }
  };
  if (uris.length > 1) {
    m.el.querySelector('#prev').onclick = () => { idx = (idx - 1 + uris.length) % uris.length; draw(); };
    m.el.querySelector('#next').onclick = () => { idx = (idx + 1) % uris.length; draw(); };
  }
  m.el.querySelector('#copyUri').onclick = async () => {
    toast((await copyText(uris[idx])) ? 'Migration লিংক কপি হয়েছে ✅' : 'কপি ব্যর্থ');
  };
  draw();
}

export function openTrash(ctx) {
  const render = () => {
    const items = ctx.vault.trash || [];
    return `
      <h3>🗑️ রিসাইকেল বিন <span class="badge-count">${items.length}</span></h3>
      <p class="hint">ডিলিট করা অ্যাকাউন্টগুলো ৩০ দিন এখানে নিরাপদ থাকে। যেকোনো সময় রিস্টোর করতে পারবেন।</p>
      ${items.length ? `<div class="check-list">
        ${items.map((a) => `
          <div class="check-item">
            <div class="ci-info">
              <b>${esc(a.issuer || a.name || 'Unnamed')}</b>
              <small>${esc(a.issuer ? a.name : '')} • ${new Date(a.deletedAt || Date.now()).toLocaleDateString('bn-BD')}</small>
            </div>
            <button class="btn sm primary" data-res="${a.id}">রিস্টোর</button>
            <button class="mini" data-perm="${a.id}" title="স্থায়ীভাবে মুছুন">✕</button>
          </div>`).join('')}
      </div>
      <button class="btn danger block" id="emptyAll">সব স্থায়ীভাবে মুছুন</button>`
        : '<p class="hint" style="text-align:center;padding:24px 0">রিসাইকেল বিন খালি ✨</p>'}`;
  };
  const m = openModal(render());
  const bind = () => {
    m.el.querySelectorAll('[data-res]').forEach((b) => (b.onclick = () => {
      const item = (ctx.vault.trash || []).find((x) => x.id === b.dataset.res);
      if (!item) return;
      restoreAccount(ctx.vault, item);
      ctx.commit();
      toast('রিস্টোর হয়েছে ✅');
      refresh();
    }));
    m.el.querySelectorAll('[data-perm]').forEach((b) => (b.onclick = async () => {
      if (!(await confirmDialog('স্থায়ীভাবে মুছবেন?', 'এটি আর ফেরত আনা যাবে না।', 'স্থায়ীভাবে মুছুন', true))) return;
      permanentlyDeleteFromTrash(ctx.vault, b.dataset.perm);
      ctx.commit();
      refresh();
    }));
    const ea = m.el.querySelector('#emptyAll');
    if (ea) ea.onclick = async () => {
      if (!(await confirmDialog('সব মুছে ফেলবেন?', 'রিসাইকেল বিনের সব অ্যাকাউন্ট স্থায়ীভাবে মুছে যাবে।', 'খালি করুন', true))) return;
      emptyTrash(ctx.vault);
      ctx.commit();
      toast('রিসাইকেল বিন খালি হয়েছে');
      refresh();
    };
  };
  const refresh = () => { m.el.innerHTML = render(); bind(); };
  bind();
}

export function openGroupManager(ctx) {
  const render = () => {
    const gs = ctx.vault.groups;
    return `<h3>🗂️ গ্রুপ ম্যানেজ</h3>
      ${gs.length ? gs.map((g, i) => `<div class="switch"><span>${esc(g)}</span><span>
        <button class="mini" data-r="${i}" title="রিনেম">✏️</button><button class="mini" data-d="${i}" title="ডিলিট">🗑️</button></span></div>`).join('') : '<p class="hint">কোনো গ্রুপ নেই। নিচে নতুন গ্রুপের নাম লিখে যোগ করুন।</p>'}
      <div class="row" style="margin-top:12px"><input id="ng" placeholder="নতুন গ্রুপ (যেমন: Work)" style="padding:12px 16px;border-radius:18px;border:1px solid var(--edge);background:var(--card);color:var(--text)"><button class="btn primary" id="add" style="flex:none">যোগ</button></div>`;
  };
  const m = openModal(render());
  const bind = () => {
    m.el.querySelector('#add').onclick = () => {
      const v = m.el.querySelector('#ng').value.trim();
      if (v && !ctx.vault.groups.includes(v)) { ctx.vault.groups.push(v); ctx.commit(); refresh(); }
    };
    m.el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
      const g = ctx.vault.groups[+b.dataset.d];
      if (!(await confirmDialog('গ্রুপ মুছবেন?', `"${g}" গ্রুপটি মুছে যাবে, তবে এর ভেতরের অ্যাকাউন্টগুলো থাকবে।`, 'মুছুন', true))) return;
      ctx.vault.groups.splice(+b.dataset.d, 1);
      ctx.vault.accounts.forEach((a) => { if (a.group === g) updateAccount(ctx.vault, a.id, { group: '' }); });
      ctx.commit(); refresh();
    }));
    m.el.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => {
      const old = ctx.vault.groups[+b.dataset.r];
      const nv = (await inputDialog('গ্রুপ রিনেম করুন', { label: 'নতুন নাম', value: old, okLabel: 'রিনেম' }))?.trim();
      if (!nv || nv === old) return;
      ctx.vault.groups[+b.dataset.r] = nv;
      ctx.vault.accounts.forEach((a) => { if (a.group === old) updateAccount(ctx.vault, a.id, { group: nv }); });
      ctx.commit(); refresh();
    }));
  };
  const refresh = () => { m.el.innerHTML = render(); bind(); };
  bind();
}

export { isValidSecret };
