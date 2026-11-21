// Menu, Google sync, backup files, security settings (PIN + Biometric + Auto-lock + Next Code), Install & Update.
import { openModal, esc, toast, confirmDialog, download, GOOGLE_G_SVG } from './ui.js';
import * as drive from './drive.js';
import * as sync from './sync.js';
import { encryptJson, decryptJson } from './crypto.js';
import { mergeVaults } from './store.js';
import { buildOtpauth } from './otp.js';
import { openGroupManager, openTrash, openMigrationExport } from './dialogs-manage.js';
import { getTelegramConfig, saveTelegramConfig, isTelegramConfigured, testTelegram, sendBackupToTelegram } from './telegram.js';

export function openMenu(ctx) {
  const user = drive.getUser();
  const trashCount = (ctx.vault.trash || []).length;
  const pinnedCount = ctx.vault.accounts.filter((a) => a.pinned).length;
  const tgReady = isTelegramConfigured();
  const m = openModal(`
    <h3>মেনু <span class="badge-count">v${esc(ctx.appVersion)}</span></h3>
    <div class="stat-grid">
      <div class="stat-card"><b>${ctx.vault.accounts.length}</b><span>অ্যাকাউন্ট</span></div>
      <div class="stat-card"><b>${pinnedCount}</b><span>পিন করা</span></div>
      <div class="stat-card"><b>${user ? 'চালু' : 'বন্ধ'}</b><span>অটো-সিঙ্ক</span></div>
    </div>
    ${ctx.canInstall ? '<button class="menu-item" data-a="install"><span class="ico">📲</span><span>ফোনে অ্যাপ ইনস্টল করুন<small>আসল অ্যাপের মতো হোম স্ক্রিনে যুক্ত হবে</small></span></button>' : ''}
    <button class="menu-item" data-a="telegram"><span class="ico">✈️</span><span>টেলিগ্রাম ক্লাউড ব্যাকআপ<small>${tgReady ? '✅ বট চ্যাটে ব্যাকআপ চালু' : 'বট টোকেন ও চ্যাট আইডি যুক্ত করুন'}</small></span></button>
    <button class="menu-item" data-a="sync"><span class="ico">☁️</span><span>Google ব্যাকআপ ও সিঙ্ক<small>${user ? esc(user.email) : 'Continue with Google দিয়ে কানেক্ট করুন'}</small></span></button>
    <button class="menu-item" data-a="theme"><span class="ico">${ctx.resolvedTheme() === 'light' ? '🌙' : '☀️'}</span><span>${ctx.resolvedTheme() === 'light' ? 'ডার্ক মোডে যান' : 'লাইট মোডে যান'}</span></button>
    <button class="menu-item" data-a="privacy"><span class="ico">${ctx.settings.hideCodes ? '👁️' : '🙈'}</span><span>${ctx.settings.hideCodes ? 'কোড দেখান' : 'কোড লুকান (প্রাইভেসি মোড)'}<small>${ctx.settings.hideCodes ? 'এখন কোড লুকানো আছে' : 'ট্যাপ না করা পর্যন্ত কোড ব্লার থাকবে'}</small></span></button>
    <button class="menu-item" data-a="gaExport"><span class="ico">📤</span><span>Google Authenticator-এ এক্সপোর্ট<small>অন্য ফোনে নিতে Export QR তৈরি করুন</small></span></button>
    <button class="menu-item" data-a="reorder"><span class="ico">↕️</span><span>অ্যাকাউন্ট সাজান (রিঅর্ডার)<small>ম্যানুয়াল অর্ডারে উপরে-নিচে নিন</small></span></button>
    <button class="menu-item" data-a="groups"><span class="ico">🗂️</span><span>গ্রুপ ম্যানেজ</span></button>
    <button class="menu-item" data-a="trash"><span class="ico">🗑️</span><span>রিসাইকেল বিন (ট্র্যাশ)<small>ডিলিট করা কোড ৩০ দিন থাকে</small></span>${trashCount ? `<span class="badge-count">${trashCount}</span>` : ''}</button>
    <button class="menu-item" data-a="export"><span class="ico">💾</span><span>ব্যাকআপ ফাইল নামান (এনক্রিপ্টেড)</span></button>
    <button class="menu-item" data-a="restore"><span class="ico">📥</span><span>ব্যাকআপ ফাইল থেকে রিস্টোর</span></button>
    <button class="menu-item" data-a="plain"><span class="ico">📄</span><span>otpauth লিংক এক্সপোর্ট<small>⚠️ আনএনক্রিপ্টেড টেক্সট</small></span></button>
    <button class="menu-item" data-a="security"><span class="ico">🔒</span><span>সিকিউরিটি ও সেটিংস</span></button>
    ${ctx.settings.pinHash ? '<button class="menu-item" data-a="lockNow"><span class="ico">🛡️</span><span>এখনই অ্যাপ লক করুন</span></button>' : ''}
    <button class="menu-item" data-a="update"><span class="ico">🔄</span><span>আপডেট চেক করুন<small>বর্তমান ভার্সন v${esc(ctx.appVersion)}</small></span></button>
    <button class="menu-item" data-a="about"><span class="ico">ℹ️</span><span>অ্যাপ সম্পর্কে</span></button>
    <input type="file" id="file" accept=".json,application/json" class="hidden">`);

  m.el.querySelector('#file').onchange = (e) => { const f = e.target.files[0]; m.close(); if (f) restoreFile(ctx, f); };
  m.el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'restore') return m.el.querySelector('#file').click();
    m.close();
    ({
      install: () => ctx.promptInstall(),
      telegram: () => openTelegramDialog(ctx),
      sync: () => openSync(ctx),
      theme: () => {
        ctx.settings.theme = ctx.resolvedTheme() === 'light' ? 'dark' : 'light';
        ctx.saveSettings();
      },
      privacy: () => {
        ctx.settings.hideCodes = !ctx.settings.hideCodes;
        ctx.saveSettings();
        toast(ctx.settings.hideCodes ? 'কোড লুকানো হয়েছে 🙈' : 'কোড দেখানো হচ্ছে 👁️');
      },
      gaExport: () => openMigrationExport(ctx),
      reorder: () => ctx.startReorder(),
      groups: () => openGroupManager(ctx),
      trash: () => openTrash(ctx),
      export: () => exportFile(ctx),
      plain: () => exportPlain(ctx),
      security: () => openSecurity(ctx),
      lockNow: () => ctx.lockNow(),
      update: () => ctx.checkForUpdate(),
      about: () => openAbout(ctx),
    })[a]?.();
  }));
}

export function openTelegramDialog(ctx) {
  const cfg = getTelegramConfig();
  const m = openModal(`
    <h3>✈️ টেলিগ্রাম ক্লাউড ব্যাকআপ</h3>
    <div class="telegram-card">
      <h4>🤖 ব্যক্তিগত টেলিগ্রাম বটের মাধ্যমে ব্যাকআপ</h4>
      <p class="hint" style="margin:4px 0 8px">Telegram-এ আপনার সব ২FA কোডের AES-256-GCM এনক্রিপ্টেড ব্যাকআপ সরাসরি ফাইল আকারে পাঠিয়ে রাখুন।</p>
      <ol class="telegram-steps">
        <li>টেলিগ্রামে <code>@BotFather</code>-এ গিয়ে <code>/newbot</code> লিখে ১ মিনিটে একটি ফ্রি বট বানিয়ে <b>Bot Token</b> নিন।</li>
        <li>টেলিগ্রামে <code>@userinfobot</code>-এ <code>/start</code> দিয়ে আপনার ব্যক্তিগত <b>Chat ID</b> নিন।</li>
        <li>নিচের বক্সে বসিয়ে <b>'কানেকশন টেস্ট'</b> ও <b>'ব্যাকআপ পাঠান'</b> চাপুন।</li>
      </ol>
    </div>
    
    <div class="field">
      <label>Telegram Bot Token</label>
      <input id="tgToken" type="text" placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" value="${esc(cfg.botToken || '')}">
    </div>
    <div class="field">
      <label>Chat ID</label>
      <input id="tgChatId" type="text" placeholder="যেমন: 123456789" value="${esc(cfg.chatId || '')}">
    </div>

    <div class="row">
      <button class="btn sm" id="tgTest">🧪 কানেকশন টেস্ট</button>
      <button class="btn sm primary" id="tgSave">💾 তথ্য সেভ করুন</button>
    </div>

    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">

    <button class="btn telegram-btn block" id="tgSend">🚀 টেলিগ্রামে এখনই ব্যাকআপ পাঠান</button>
    <p class="hint" style="margin-top:10px">🛡️ <b>নিরাপত্তা:</b> টেলিগ্রামে পাঠানোর আগে আপনার পাসফ্রেজ দিয়ে পুরো ভল্ট <b>AES-256-GCM</b> এনক্রিপ্ট হবে। পাসফ্রেজ ছাড়া কেউ এই ফাইল খুলতে পারবে না।</p>
  `);

  const q = (s) => m.el.querySelector(s);
  
  q('#tgSave').onclick = () => {
    const token = q('#tgToken').value.trim();
    const chat = q('#tgChatId').value.trim();
    saveTelegramConfig({ botToken: token, chatId: chat });
    toast('টেলিগ্রাম তথ্য সেভ হয়েছে ✅');
  };

  q('#tgTest').onclick = async () => {
    const token = q('#tgToken').value.trim();
    const chat = q('#tgChatId').value.trim();
    if (!token || !chat) return toast('বট টোকেন ও চ্যাট আইডি দিন');
    q('#tgTest').disabled = true;
    q('#tgTest').textContent = 'টেস্ট হচ্ছে…';
    try {
      await testTelegram(token, chat);
      saveTelegramConfig({ botToken: token, chatId: chat });
      toast('টেলিগ্রামে টেস্ট মেসেজ সফলভাবে পাঠানো হয়েছে! ✅');
    } catch (err) {
      toast('টেস্ট ব্যর্থ: ' + err.message);
    } finally {
      q('#tgTest').disabled = false;
      q('#tgTest').textContent = '🧪 কানেকশন টেস্ট';
    }
  };

  q('#tgSend').onclick = () => {
    const token = q('#tgToken').value.trim();
    const chat = q('#tgChatId').value.trim();
    if (!token || !chat) return toast('প্রথমে বট টোকেন ও চ্যাট আইডি দিন');
    if (ctx.vault.accounts.length === 0) return toast('ব্যাকআপ করার মতো কোনো অ্যাকাউন্ট নেই');
    saveTelegramConfig({ botToken: token, chatId: chat });

    const pm = openModal(`
      <h3>🔑 ব্যাকআপ এনক্রিপশন পাসফ্রেজ</h3>
      <p class="hint">ফাইলটি সুরক্ষিত রাখতে একটি শক্তিশালী পাসফ্রেজ (কমপক্ষে ৮ অক্ষর) দিন। টেলিগ্রাম থেকে ফাইল ডাউনলোড করে রিস্টোর করার সময় এটি লাগবে।</p>
      <div class="field"><input id="tgPass" type="password" placeholder="পাসফ্রেজ (৮+ অক্ষর)"></div>
      <button class="btn primary block" id="tgPassOk">এনক্রিপ্ট করে টেলিগ্রামে পাঠান</button>
    `);

    pm.el.querySelector('#tgPassOk').onclick = async () => {
      const pass = pm.el.querySelector('#tgPass').value;
      if (pass.length < 8) return toast('কমপক্ষে ৮ অক্ষর দিন');
      pm.close();
      m.close();
      toast('এনক্রিপ্ট করে টেলিগ্রামে পাঠানো হচ্ছে… ⏳');
      try {
        const encrypted = await encryptJson(ctx.vault, pass);
        await sendBackupToTelegram(encrypted, ctx.vault.accounts.length);
        toast('টেলিগ্রামে সফলভাবে ব্যাকআপ ফাইল পাঠানো হয়েছে! ✈️✅');
      } catch (err) {
        toast('টেলিগ্রাম ব্যাকআপ ব্যর্থ: ' + err.message);
      }
    };
  };
}

export function openSync(ctx) {
  const user = drive.getUser();
  const meta = sync.getSyncMeta();
  const configured = drive.isConfigured();
  const m = openModal(user ? `
    <h3>☁️ Google ব্যাকআপ</h3>
    <div class="profile-card">
      ${user.picture ? `<img src="${esc(user.picture)}" alt="">` : '<div class="avatar" style="width:40px;height:40px;background:linear-gradient(145deg,#0284c7,#2563eb)">G</div>'}
      <div class="pinfo">
        <b>${esc(user.name || user.email)}</b>
        <small>${esc(user.email)}</small>
      </div>
      <span class="status-pill">সিঙ্ক চালু</span>
    </div>
    <p class="hint">সর্বশেষ সিঙ্ক: <b>${meta.lastSync ? new Date(meta.lastSync).toLocaleString('bn-BD') : '—'}</b><br>
    প্রতিটি পরিবর্তনের ~২.৫ সেকেন্ডের মধ্যে AES-256-GCM এনক্রিপ্ট হয়ে অটো-ব্যাকআপ হয়। অন্য যেকোনো ফোনে একই Google + একই পাসফ্রেজ দিলেই সব কোড ফিরে আসবে।</p>
    <button class="btn primary block" id="now">🔄 এখনই সিঙ্ক করুন</button>
    <button class="btn block" id="pass">🔑 পাসফ্রেজ পরিবর্তন</button>
    <button class="btn danger block" id="out">সাইন-আউট</button>` : `
    <h3>☁️ Google দিয়ে অটো-ব্যাকআপ</h3>
    <p class="hint"><b>Continue with Google</b> চেপে আপনার Gmail সিলেক্ট করলেই Google Drive-এর <b>লুকানো appDataFolder</b>-এ সব কোড AES-256-GCM এনক্রিপ্ট হয়ে অটো-ব্যাকআপ হবে। অন্য ফোনে লগইন করলেই সব ফিরে আসবে।</p>
    <button class="btn google-btn block" id="in">${GOOGLE_G_SVG}<span>Continue with Google</span></button>
    <details class="glass-details" ${configured ? '' : 'open'}>
      <summary>⚙️ Google Client ID কনফিগারেশন</summary>
      <p class="hint" style="margin-top:8px">Google Cloud Console-এর Web OAuth Client ID:<br><b>Authorized JavaScript origins:</b> <code>https://mdsafiislam894-star.github.io</code></p>
      <div class="field"><input id="cid" value="${esc(drive.getClientId())}" placeholder="xxxx.apps.googleusercontent.com"></div>
      <button class="btn sm primary" id="saveCid">Client ID সেভ</button>
    </details>
    <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">
      <p class="hint" style="margin:0 0 8px">💡 <b>Google Cloud ছাড়াও চ্যাটে সরাসরি ব্যাকআপ সম্ভব:</b></p>
      <button class="btn telegram-btn block" id="openTgFromSync">✈️ টেলিগ্রাম ক্লাউড ব্যাকআপ খুলুন</button>
    </div>`);

  const q = (s) => m.el.querySelector(s);
  if (q('#openTgFromSync')) q('#openTgFromSync').onclick = () => { m.close(); openTelegramDialog(ctx); };
  if (q('#saveCid')) q('#saveCid').onclick = () => {
    const val = q('#cid').value.trim();
    if (!val.includes('.apps.googleusercontent.com')) return toast('সঠিক Google Client ID দিন');
    drive.setClientIdOverride(val);
    toast('Client ID সেভ হয়েছে ✅ এখন Continue with Google চাপুন');
  };
  if (q('#in')) q('#in').onclick = async () => {
    try { await drive.signIn(true); m.close(); await afterSignIn(ctx); } catch (e) { toast(e.message); }
  };
  if (q('#now')) q('#now').onclick = async () => { m.close(); await ctx.doSync(true); };
  if (q('#pass')) q('#pass').onclick = () => { m.close(); askPassphrase(ctx, 'change'); };
  if (q('#out')) q('#out').onclick = async () => {
    m.close();
    if (await confirmDialog('সাইন-আউট?', 'এই ফোনের কোডগুলো ফোনেই থাকবে, শুধু অটো-ব্যাকআপ বন্ধ হবে।', 'সাইন-আউট')) {
      drive.signOut(); sync.clearPassphrase(); ctx.refreshSyncDot(); toast('সাইন-আউট হয়েছে');
    }
  };
}

async function afterSignIn(ctx) {
  let exists = false;
  try { exists = await sync.remoteExists(); } catch (e) { toast(e.message); }
  askPassphrase(ctx, exists ? 'restore' : 'create');
}

// mode: create (first time) | restore (backup exists) | change
export function askPassphrase(ctx, mode) {
  const title = { create: 'পাসফ্রেজ সেট করুন', restore: 'ব্যাকআপ পাওয়া গেছে — পাসফ্রেজ দিন', change: 'নতুন পাসফ্রেজ' }[mode];
  const hint = mode === 'restore'
    ? 'আগের ফোনে যে পাসফ্রেজ দিয়েছিলেন সেটি দিন — সব কোড ফিরে আসবে।'
    : 'এই পাসফ্রেজ দিয়ে ব্যাকআপ ডিভাইসেই এনক্রিপ্ট হবে। <b>এটা ভুলে গেলে ব্যাকআপ উদ্ধার অসম্ভব</b> — কোথাও লিখে রাখুন। কমপক্ষে ৮ অক্ষর।';
  const m = openModal(`
    <h3>🔑 ${title}</h3><p class="hint">${hint}</p>
    <div class="field"><input id="p1" type="password" autocomplete="new-password" placeholder="পাসফ্রেজ (৮+ অক্ষর)"></div>
    ${mode === 'restore' ? '' : '<div class="field"><input id="p2" type="password" autocomplete="new-password" placeholder="আবার লিখুন"></div>'}
    <button class="btn primary block" id="ok">${mode === 'restore' ? 'রিস্টোর ও সিঙ্ক' : 'সেভ ও অটো-ব্যাকআপ শুরু'}</button>`);
  m.el.querySelector('#ok').onclick = async () => {
    const p1 = m.el.querySelector('#p1').value;
    if (mode !== 'restore') {
      if (p1.length < 8) return toast('কমপক্ষে ৮ অক্ষর দিন');
      if (p1 !== m.el.querySelector('#p2').value) return toast('দুটো পাসফ্রেজ মেলেনি');
    }
    const prev = sync.getPassphrase();
    sync.setPassphrase(p1);
    try {
      if (mode === 'change') {
        const { encryptJson: enc } = await import('./crypto.js');
        await drive.uploadBackup(await enc(ctx.vault, p1));
        toast('পাসফ্রেজ বদলেছে ✅');
      } else {
        await ctx.doSync(true);
      }
      m.close();
    } catch (e) {
      if (prev) sync.setPassphrase(prev); else sync.clearPassphrase();
      toast(e.message);
    }
  };
}

async function exportFile(ctx) {
  const m = openModal(`
    <h3>এনক্রিপ্টেড ব্যাকআপ ফাইল</h3>
    <p class="hint">একটি পাসফ্রেজ দিন — ফাইলটি রিস্টোর করতে এটা লাগবে।</p>
    <div class="field"><input id="p" type="password" placeholder="পাসফ্রেজ (৮+ অক্ষর)"></div>
    <button class="btn primary block" id="ok">ডাউনলোড</button>`);
  m.el.querySelector('#ok').onclick = async () => {
    const p = m.el.querySelector('#p').value;
    if (p.length < 8) return toast('কমপক্ষে ৮ অক্ষর দিন');
    download(`authenticator-pro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await encryptJson(ctx.vault, p)));
    m.close(); toast('ব্যাকআপ ফাইল নামানো হয়েছে ✅');
  };
}

function restoreFile(ctx, file) {
  const m = openModal(`
    <h3>রিস্টোর</h3><p class="hint">${esc(file.name)} — পাসফ্রেজ দিন। বর্তমান কোডগুলোর সাথে মার্জ হবে, কিছু মুছবে না।</p>
    <div class="field"><input id="p" type="password" placeholder="পাসফ্রেজ"></div>
    <button class="btn primary block" id="ok">রিস্টোর</button>`);
  m.el.querySelector('#ok').onclick = async () => {
    try {
      const env = JSON.parse(await file.text());
      const remote = await decryptJson(env, m.el.querySelector('#p').value);
      const before = ctx.vault.accounts.length;
      Object.assign(ctx.vault, mergeVaults(ctx.vault, remote));
      ctx.commit(); m.close();
      toast(`রিস্টোর সম্পন্ন (+${Math.max(0, ctx.vault.accounts.length - before)}) ✅`);
    } catch (e) { toast(e.message); }
  };
}

async function exportPlain(ctx) {
  if (!(await confirmDialog('আনএনক্রিপ্টেড এক্সপোর্ট', 'ফাইলে আপনার সব secret খোলা অবস্থায় থাকবে। কাজ শেষে ফাইলটি মুছে ফেলবেন।', 'এক্সপোর্ট', true))) return;
  download('authenticator-pro-otpauth.txt', ctx.vault.accounts.map(buildOtpauth).join('\n'), 'text/plain');
}

function openPinSetup(ctx) {
  const m = openModal(`
    <h3>🔒 নতুন PIN সেট করুন</h3>
    <p class="hint">৪ থেকে ১২ সংখ্যার PIN দিন। অ্যাপ খোলার সময় এটি চাইবে।</p>
    <div class="field"><label>PIN</label><input id="p1" type="password" inputmode="numeric" maxlength="12" placeholder="••••"></div>
    <div class="field"><label>আবার PIN দিন</label><input id="p2" type="password" inputmode="numeric" maxlength="12" placeholder="••••"></div>
    <div class="row"><button class="btn" id="no">বাতিল</button><button class="btn primary" id="ok">সেভ</button></div>`);
  m.el.querySelector('#no').onclick = () => m.close();
  m.el.querySelector('#ok').onclick = async () => {
    const p1 = m.el.querySelector('#p1').value.trim();
    const p2 = m.el.querySelector('#p2').value.trim();
    if (!/^\d{4,12}$/.test(p1)) return toast('৪–১২ সংখ্যার PIN দিন');
    if (p1 !== p2) return toast('দুটো PIN মেলেনি');
    ctx.settings.pinHash = await ctx.hashPin(p1);
    ctx.saveSettings();
    m.close();
    toast('PIN লক চালু হয়েছে 🔒');
  };
}

export function openSecurity(ctx) {
  const s = ctx.settings;
  const bioSupported = !!globalThis.PublicKeyCredential;
  const m = openModal(`
    <h3>🔒 সিকিউরিটি ও সেটিংস</h3>
    <div class="switch"><span>🌗 থিম মোড</span><select id="theme" style="padding:8px 12px;border-radius:14px;background:var(--card2);color:var(--text);border:1px solid var(--edge)">
      ${['auto', 'dark', 'light'].map((t) => `<option value="${t}" ${s.theme === t ? 'selected' : ''}>${{ auto: 'অটো (সিস্টেম)', dark: 'ডার্ক', light: 'লাইট' }[t]}</option>`).join('')}</select></div>
    <div class="switch"><span>⏭️ পরবর্তী কোড প্রিভিউ (≤৮ সে.)</span><input type="checkbox" id="nextCode" ${s.showNextCode !== false ? 'checked' : ''}></div>
    <div class="switch"><span>🙈 কোড লুকানো (ট্যাপ করলে দেখাবে)</span><input type="checkbox" id="hide" ${s.hideCodes ? 'checked' : ''}></div>
    <div class="switch"><span>📋 ট্যাপ করলে অটো-কপি</span><input type="checkbox" id="copy" ${s.autoCopy ? 'checked' : ''}></div>
    <div class="switch"><span>🔒 PIN লক ${s.pinHash ? '(চালু)' : '(বন্ধ)'}</span><button class="btn sm" id="pin">${s.pinHash ? 'বন্ধ করুন' : 'সেট করুন'}</button></div>
    ${s.pinHash ? `
      <div class="switch"><span>⏱️ অটো-লক সময়</span><select id="lockDelay" style="padding:8px 12px;border-radius:14px;background:var(--card2);color:var(--text);border:1px solid var(--edge)">
        ${[[0, 'তাৎক্ষণিক'], [60000, '১ মিনিট'], [300000, '৫ মিনিট'], [900000, '১৫ মিনিট']].map(([ms, lbl]) =>
          `<option value="${ms}" ${(s.autoLockMs ?? 0) === ms ? 'selected' : ''}>${lbl}</option>`).join('')}</select></div>
      ${bioSupported ? `<div class="switch"><span>👆 বায়োমেট্রিক আনলক (Fingerprint/Face ID)</span><input type="checkbox" id="bio" ${s.bioCredId ? 'checked' : ''}></div>` : ''}
    ` : ''}
    <p class="hint">PIN ও বায়োমেট্রিক লক অ্যাপ খোলার সময় নিরাপত্তা দেয়। ফোনের স্ক্রিন লকও চালু রাখুন।</p>`);

  const q = (x) => m.el.querySelector(x);
  q('#theme').onchange = (e) => { s.theme = e.target.value; ctx.saveSettings(); };
  q('#nextCode').onchange = (e) => { s.showNextCode = e.target.checked; ctx.saveSettings(); };
  q('#hide').onchange = (e) => { s.hideCodes = e.target.checked; ctx.saveSettings(); };
  q('#copy').onchange = (e) => { s.autoCopy = e.target.checked; ctx.saveSettings(); };
  q('#pin').onclick = () => {
    m.close();
    if (s.pinHash) {
      s.pinHash = '';
      s.bioCredId = '';
      ctx.saveSettings();
      return toast('PIN লক বন্ধ হয়েছে');
    }
    openPinSetup(ctx);
  };
  if (q('#lockDelay')) q('#lockDelay').onchange = (e) => { s.autoLockMs = Number(e.target.value); ctx.saveSettings(); };
  if (q('#bio')) q('#bio').onchange = async (e) => {
    if (!e.target.checked) {
      s.bioCredId = '';
      ctx.saveSettings();
      return toast('বায়োমেট্রিক আনলক বন্ধ');
    }
    try {
      const credId = await ctx.registerBiometric();
      s.bioCredId = credId;
      ctx.saveSettings();
      toast('বায়োমেট্রিক আনলক চালু হয়েছে 👆');
    } catch (err) {
      e.target.checked = false;
      toast('বায়োমেট্রিক চালু হয়নি: ' + (err.message || 'সমর্থিত নয়'));
    }
  };
}

function openAbout(ctx) {
  openModal(`<h3>🔐 Authenticator Pro <span class="badge-count">v${esc(ctx.appVersion)}</span></h3>
    <p class="hint">iOS Liquid Glass + Water Drop ডিজাইনে তৈরি অ্যাডভান্সড 2FA অ্যাপ।<br><br>
    • <b>TOTP / HOTP / Steam Guard</b> (SHA1/256/512, ৫–৮ ডিজিট)<br>
    • <b>Continue with Google</b> → Drive appDataFolder-এ AES-256-GCM অটো-ব্যাকআপ<br>
    • <b>Google Authenticator ২-মুখী মাইগ্রেশন</b> (ইমপোর্ট ও এক্সপোর্ট QR)<br>
    • <b>রিসাইকেল বিন, পিন, গ্রুপ, ম্যানুয়াল রিঅর্ডার, পরবর্তী কোড প্রিভিউ</b><br>
    • <b>PIN + বায়োমেট্রিক লক</b>, ডার্ক ও লাইট মোড, অটো-আপডেট ও অফলাইন সাপোর্ট।</p>`);
}
