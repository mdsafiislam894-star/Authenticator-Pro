// Advanced Modal Dialogs: Theme & Vibe Picker, Security Audit, Password Generator, Focus View, Single-Account QR, Emergency Print, Time Sync, Vault Analytics & Batch Actions.
import { openModal, esc, toast, copyText, confirmDialog, qrSvg, download } from './ui.js';
import { generateCode, secondsLeft, buildOtpauth } from './otp.js';
import { runSecurityAudit } from './security-audit.js';
import { generatePassword, generatePassphrase, evaluateStrength } from './password.js';
import { playDropletSound, playSuccessChime, playGlassTap, haptic } from './audio.js';
import { syncNetworkTime, getClockDriftMs } from './timesync.js';
import { computeVaultAnalytics } from './analytics.js';
import { updateAccount, deleteAccount } from './store.js';

export const THEMES = [
  {
    id: 'green-forest',
    mode: 'dark',
    name: '🌲 Green Forest (গ্রিন ফরেস্ট)',
    tagline: 'ঘন চিরহরিৎ রেইনফরেস্ট, লতা-পাতায় মোড়ানো কাঁচ ও পান্না সবুজ গ্লো',
    accent: '#10b981',
    previewGrad: 'linear-gradient(135deg, #021209, #064e3b, #047857)',
    cardBg: 'rgba(16, 185, 129, 0.16)',
    textColor: '#ecfdf5',
  },
  {
    id: 'blue-sea',
    mode: 'dark',
    name: '🌊 Blue Sea (ব্লু সি ও বিচ)',
    tagline: 'নীল সমুদ্রের তরঙ্গ, সোনালী বালুতট ও সি-গ্লাস অ্যাকুয়ামেরিন',
    accent: '#06b6d4',
    previewGrad: 'linear-gradient(135deg, #021326, #0e7490, #f59e0b)',
    cardBg: 'rgba(6, 182, 212, 0.15)',
    textColor: '#ecfeff',
  },
  {
    id: 'sakura-blossom',
    mode: 'dark',
    name: '🌸 Sakura (জাপানিজ সাকুরা)',
    tagline: 'ঝরে পড়া চেরি ব্লসম পাপড়ি, জেন কোয়ার্টজ ও সফট পিংক মিস্ট',
    accent: '#f472b6',
    previewGrad: 'linear-gradient(135deg, #180414, #831843, #f472b6)',
    cardBg: 'rgba(244, 114, 182, 0.15)',
    textColor: '#fdf2f8',
  },
  {
    id: 'vampire-blood',
    mode: 'dark',
    name: '🧛 Vampire Blood Red (ভ্যাম্পায়ার)',
    tagline: 'গথিক অন্ধকার রাজকীয়তা, অবসিডিয়ান গ্লাস ও রক্তিম রুবি আভা',
    accent: '#ef4444',
    previewGrad: 'linear-gradient(135deg, #090103, #7f1d1d, #ef4444)',
    cardBg: 'rgba(239, 68, 68, 0.15)',
    textColor: '#fff1f2',
  },
  {
    id: 'halloween-orange',
    mode: 'dark',
    name: '🎃 Halloween Orange (হ্যালোইন)',
    tagline: 'ভুতুড়ে মধ্যরাত, জ্বলন্ত জ্যাক-ও-ল্যান্টার্ন পাম্পকিন ও উইচ পার্পল',
    accent: '#f97316',
    previewGrad: 'linear-gradient(135deg, #0c0418, #581c87, #f97316)',
    cardBg: 'rgba(249, 115, 22, 0.16)',
    textColor: '#fff7ed',
  },
  {
    id: 'cyber-matrix',
    mode: 'dark',
    name: '⚡ Cyber Matrix (সাইবার ম্যাট্রিক্স)',
    tagline: 'ফিউচারিস্টিক হ্যাকার টার্মিনাল, নিয়ন গ্রিন কোড ও সাইবার গ্রিড',
    accent: '#22c55e',
    previewGrad: 'linear-gradient(135deg, #020b05, #14532d, #22c55e)',
    cardBg: 'rgba(34, 197, 94, 0.15)',
    textColor: '#f0fdf4',
  },
  {
    id: 'celestial-nebula',
    mode: 'dark',
    name: '🌌 Celestial Nebula (কসমিক নেবুলা)',
    tagline: 'মহাজাগতিক গ্যালাক্সি, নক্ষত্রের আলো ও ভায়োলেট স্টারডাস্ট',
    accent: '#a855f7',
    previewGrad: 'linear-gradient(135deg, #060214, #3b0764, #a855f7)',
    cardBg: 'rgba(168, 85, 247, 0.15)',
    textColor: '#faf5ff',
  },
  {
    id: 'crystal-pearl',
    mode: 'light',
    name: '✨ Crystal Pearl (ক্রিস্টাল পার্ল)',
    tagline: 'সূর্যালোকের মতো স্বচ্ছ ডায়মন্ড গ্লাস ও রয়েল ব্লু একসেন্ট',
    accent: '#2563eb',
    previewGrad: 'linear-gradient(135deg, #f8fafc, #e2e8f0, #93c5fd)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    textColor: '#0f172a',
  },
];

// ---------- 1. Theme & Vibe Picker ----------
export function openThemePicker(ctx) {
  const current = ctx.settings.theme;
  const resolved = ctx.resolvedTheme();
  const currentMode = (ctx.resolvedMode ? ctx.resolvedMode() : ctx.settings.mode) || 'dark';

  const m = openModal(`
    <h3>🎨 প্রিমিয়াম থিম ও লিকুইড স্টাইল</h3>
    <p class="hint">প্রতিটি থিমের রয়েছে সম্পূর্ণ ভিন্ন লাক্সারি ভাইব, কাঁচের স্বচ্ছতা এবং রিফ্লেক্টিভ অরবস।</p>
    
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:8px 0 14px;background:var(--card);border-radius:12px;border:1px solid var(--edge);">
      <span style="font-size:12px;font-weight:700;">মোড নির্বাচন:</span>
      <div style="display:flex;gap:6px;">
        <button id="modalDarkBtn" class="btn mini ${currentMode === 'dark' ? 'primary' : 'secondary'}" style="padding:4px 10px;font-size:11.5px;">🌙 ডার্ক মোড</button>
        <button id="modalLightBtn" class="btn mini ${currentMode === 'light' ? 'primary' : 'secondary'}" style="padding:4px 10px;font-size:11.5px;">☀️ লাইট মোড</button>
      </div>
    </div>

    <div class="theme-grid">
      ${THEMES.map((t) => {
        const isCurrent = current === t.id || (current === 'auto' && resolved === t.id) || (current === t.mode && (t.id === 'green-forest' || t.id === 'crystal-pearl'));
        return `
        <div class="theme-card ${isCurrent ? 'selected' : ''}" data-theme-id="${t.id}">
          <div class="theme-preview" style="background:${t.previewGrad};color:${t.textColor}">
            <div class="mini-glass-pill" style="background:${t.cardBg};border:1px solid ${t.accent}40">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.accent}"></span>
              <span style="font-size:11px;font-weight:700">123 456</span>
            </div>
          </div>
          <div class="theme-info">
            <b>${t.name}</b>
            <small>${t.tagline}</small>
          </div>
          ${isCurrent ? '<span class="active-badge">✓ সক্রিয়</span>' : ''}
        </div>`;
      }).join('')}
    </div>
  `);

  const darkBtn = m.el.querySelector('#modalDarkBtn');
  const lightBtn = m.el.querySelector('#modalLightBtn');
  if (darkBtn) {
    darkBtn.onclick = () => {
      ctx.settings.mode = 'dark';
      ctx.saveSettings();
      playDropletSound(ctx.settings);
      haptic('light');
      m.close();
      openThemePicker(ctx);
    };
  }
  if (lightBtn) {
    lightBtn.onclick = () => {
      ctx.settings.mode = 'light';
      ctx.saveSettings();
      playDropletSound(ctx.settings);
      haptic('light');
      m.close();
      openThemePicker(ctx);
    };
  }

  m.el.querySelectorAll('[data-theme-id]').forEach((card) => {
    card.onclick = () => {
      const id = card.dataset.themeId;
      ctx.settings.theme = id;
      ctx.saveSettings();
      playDropletSound(ctx.settings);
      haptic('light');
      m.close();
      toast('থিম পরিবর্তন সম্পন্ন হয়েছে ✨');
    };
  });
}

// ---------- 2. Security Health Audit ----------
export function openSecurityAudit(ctx) {
  const audit = runSecurityAudit(ctx.vault, ctx.settings);

  const m = openModal(`
    <h3>🛡️ সিকিউরিটি অডিট ও হেলথ স্কোর</h3>
    <div class="audit-header" style="text-align:center;padding:12px 0 16px">
      <div class="audit-score-circle" style="border-color:${audit.gradeColor};box-shadow:0 0 24px ${audit.gradeColor}40">
        <span class="audit-score-num" style="color:${audit.gradeColor}">${audit.score}</span>
        <span class="audit-score-pct">%</span>
      </div>
      <div style="font-size:16px;font-weight:700;color:${audit.gradeColor};margin-top:8px">${audit.grade}</div>
      <p class="hint" style="margin:4px 0 0">ভল্টে মোট ${audit.accountCount}টি অ্যাকাউন্ট স্ক্যান করা হয়েছে।</p>
    </div>

    ${audit.issues.length ? `
      <h4 style="margin:8px 0 6px;color:var(--text);font-size:13.5px">⚠️ উন্নতির ক্ষেত্র (${audit.issues.length}টি)</h4>
      <div class="audit-list">
        ${audit.issues.map((iss) => `
          <div class="audit-item warning">
            <b>${esc(iss.title)}</b>
            <p>${esc(iss.desc)}</p>
            ${iss.action ? `<button class="btn sm primary" data-audit-action="${iss.action}" style="margin-top:6px">${esc(iss.actionLabel)}</button>` : ''}
          </div>
        `).join('')}
      </div>` : ''}

    ${audit.strengths.length ? `
      <h4 style="margin:14px 0 6px;color:var(--text);font-size:13.5px">✅ সফল নিরাপত্তা ব্যবস্থা</h4>
      <div class="audit-list">
        ${audit.strengths.map((str) => `
          <div class="audit-item success">
            <span>✓ ${esc(str)}</span>
          </div>
        `).join('')}
      </div>` : ''}
  `);

  m.el.querySelectorAll('[data-audit-action]').forEach((btn) => {
    btn.onclick = () => {
      const act = btn.dataset.auditAction;
      m.close();
      if (act === 'openSecurity') ctx.openSecurity();
      else if (act === 'openBackup') ctx.openSync();
      else if (act === 'openTrash') ctx.openTrash();
    };
  });
}

// ---------- 3. Focus View (Tap-to-Enlarge Code Display) ----------
export function openFocusView(ctx, accountId) {
  const a = ctx.vault.accounts.find((x) => x.id === accountId);
  if (!a) return;
  const isHotp = a.type === 'hotp';
  const period = a.period || 30;

  const m = openModal(`
    <div class="focus-modal-wrap">
      <div class="focus-header">
        <span class="focus-issuer">${esc(a.issuer || a.name || 'Account')}</span>
        ${a.issuer && a.name ? `<small class="focus-name">${esc(a.name)}</small>` : ''}
      </div>

      <div class="focus-code-wrap">
        <div id="focusCode" class="focus-code">······</div>
      </div>

      ${!isHotp ? `
        <div class="focus-timer-wrap">
          <div class="focus-ring">
            <svg viewBox="0 0 44 44">
              <circle class="bg" cx="22" cy="22" r="19" fill="none" stroke-width="3"/>
              <circle id="focusRingFg" class="fg" cx="22" cy="22" r="19" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="119.38" stroke-dashoffset="0"/>
            </svg>
            <span id="focusSec" class="focus-sec">--</span>
          </div>
          <span id="focusNext" class="focus-next">পরবর্তী: ······</span>
        </div>` : `
        <button id="focusHotpNext" class="btn primary sm" style="margin-top:12px">পরবর্তী HOTP কোড ⟳</button>`}

      <div class="focus-actions" style="margin-top:20px">
        <button id="focusCopy" class="btn primary block">📋 কোড কপি করুন</button>
        <button id="focusDone" class="btn block" style="margin-top:8px">বন্ধ করুন</button>
      </div>
    </div>
  `);

  const q = (s) => m.el.querySelector(s);
  const codeEl = q('#focusCode');
  const ringFg = q('#focusRingFg');
  const secEl = q('#focusSec');
  const nextEl = q('#focusNext');

  let rawCurrent = '';
  const CIRC = 2 * Math.PI * 19; // ~119.38

  const update = async () => {
    const now = Date.now();
    try {
      const code = await generateCode(a, now);
      rawCurrent = code;
      const formatted = code.length === 6 ? `${code.slice(0, 3)}  ${code.slice(3)}` : code;
      if (codeEl) codeEl.textContent = formatted;

      if (!isHotp) {
        const left = secondsLeft(period, now);
        if (secEl) secEl.textContent = left;
        if (ringFg) {
          ringFg.style.strokeDashoffset = CIRC * (1 - left / period);
          ringFg.style.stroke = left <= 5 ? 'var(--danger)' : 'var(--accent)';
        }
        if (nextEl) {
          const next = await generateCode(a, now + period * 1000);
          nextEl.textContent = `পরবর্তী কোড: ${next}`;
        }
      }
    } catch {
      if (codeEl) codeEl.textContent = 'ERROR';
    }
  };

  update();
  const timer = setInterval(update, 1000);
  m.onClose = () => clearInterval(timer);

  q('#focusCopy').onclick = async () => {
    if (rawCurrent && (await copyText(rawCurrent))) {
      playDropletSound(ctx.settings);
      haptic('success');
      toast('কোড কপি হয়েছে ✓');
    }
  };
  q('#focusDone').onclick = () => m.close();
}

// ---------- 4. Password & Passphrase Generator ----------
export function openPasswordGenerator(ctx) {
  let mode = 'password'; // password | passphrase
  let len = 16;
  let wordCount = 4;
  let upper = true, lower = true, numbers = true, symbols = true;

  const m = openModal(`
    <h3>🔑 শক্তিশালী পাসওয়ার্ড জেনারেটর</h3>
    <div class="pwd-tabs">
      <button class="tab-btn active" id="tabPwd">পাসওয়ার্ড</button>
      <button class="tab-btn" id="tabPassphrase">পাসফ্রেজ (শব্দ)</button>
    </div>

    <div class="pwd-output-wrap">
      <input id="pwdOutput" type="text" readonly class="pwd-output">
      <button id="pwdCopy" class="mini-copy" title="কপি করুন">📋</button>
    </div>
    <div id="pwdStrength" class="pwd-strength-bar"></div>

    <div id="pwdControls">
      <div class="field" style="margin-top:14px">
        <label>দৈর্ঘ্য: <b id="lenLabel">16</b> অক্ষর</label>
        <input id="lenSlider" type="range" min="8" max="40" value="16" style="width:100%">
      </div>
      <div class="switch"><span>বড় হাতের অক্ষর (A–Z)</span><input type="checkbox" id="chkUpper" checked></div>
      <div class="switch"><span>ছোট হাতের অক্ষর (a–z)</span><input type="checkbox" id="chkLower" checked></div>
      <div class="switch"><span>সংখ্যা (0–9)</span><input type="checkbox" id="chkNum" checked></div>
      <div class="switch"><span>স্পেশাল চিহ্ন (!@#$)</span><input type="checkbox" id="chkSym" checked></div>
    </div>

    <div id="phraseControls" class="hidden">
      <div class="field" style="margin-top:14px">
        <label>শব্দ সংখ্যা: <b id="wordsLabel">4</b>টি শব্দ</label>
        <input id="wordsSlider" type="range" min="3" max="7" value="4" style="width:100%">
      </div>
    </div>

    <div class="row" style="margin-top:16px">
      <button class="btn block" id="pwdRegen">🔄 নতুন তৈরি করুন</button>
      <button class="btn primary block" id="pwdCopyBtn">📋 কপি করুন</button>
    </div>
  `);

  const q = (s) => m.el.querySelector(s);
  const out = q('#pwdOutput');
  const strengthBar = q('#pwdStrength');

  const regenerate = () => {
    let result = '';
    if (mode === 'password') {
      result = generatePassword({ length: len, upper, lower, numbers, symbols });
    } else {
      result = generatePassphrase(wordCount);
    }
    out.value = result;
    const st = evaluateStrength(result);
    strengthBar.innerHTML = `<span style="color:${st.color}">নিরাপত্তা: <b>${st.label}</b></span>`;
  };

  q('#tabPwd').onclick = () => {
    mode = 'password';
    q('#tabPwd').classList.add('active');
    q('#tabPassphrase').classList.remove('active');
    q('#pwdControls').classList.remove('hidden');
    q('#phraseControls').classList.add('hidden');
    regenerate();
  };

  q('#tabPassphrase').onclick = () => {
    mode = 'passphrase';
    q('#tabPassphrase').classList.add('active');
    q('#tabPwd').classList.remove('active');
    q('#pwdControls').classList.add('hidden');
    q('#phraseControls').classList.remove('hidden');
    regenerate();
  };

  q('#lenSlider').oninput = (e) => {
    len = Number(e.target.value);
    q('#lenLabel').textContent = len;
    regenerate();
  };

  q('#wordsSlider').oninput = (e) => {
    wordCount = Number(e.target.value);
    q('#wordsLabel').textContent = wordCount;
    regenerate();
  };

  q('#chkUpper').onchange = (e) => { upper = e.target.checked; regenerate(); };
  q('#chkLower').onchange = (e) => { lower = e.target.checked; regenerate(); };
  q('#chkNum').onchange = (e) => { numbers = e.target.checked; regenerate(); };
  q('#chkSym').onchange = (e) => { symbols = e.target.checked; regenerate(); };

  q('#pwdRegen').onclick = () => {
    playDropletSound(ctx.settings);
    regenerate();
  };

  const doCopy = async () => {
    if (out.value && (await copyText(out.value))) {
      playDropletSound(ctx.settings);
      haptic('success');
      toast('পাসওয়ার্ড ক্লিপবোর্ডে কপি হয়েছে ✅');
    }
  };

  q('#pwdCopy').onclick = doCopy;
  q('#pwdCopyBtn').onclick = doCopy;

  regenerate();
}

// ---------- 5. Single-Account QR & Transfer View ----------
export function openAccountQr(ctx, accountId) {
  const a = ctx.vault.accounts.find((x) => x.id === accountId);
  if (!a) return;
  const uri = buildOtpauth(a);

  const m = openModal(`
    <h3>📱 ট্রান্সফার QR কোড</h3>
    <p class="hint">অন্য কোনো ফোন বা Authenticator দিয়ে এই QR কোডটি স্ক্যান করলেই এই অ্যাকাউন্টটি সরাসরি চলে যাবে।</p>
    <div style="text-align:center;padding:12px 0">
      <div id="accQrWrap" style="display:inline-block;border-radius:18px;border:1px solid var(--line);background:#fff;padding:12px;min-width:200px;min-height:200px">লোড হচ্ছে…</div>
      <div style="margin-top:10px;font-weight:700;font-size:15px">${esc(a.issuer || a.name || 'Account')}</div>
      ${a.issuer && a.name ? `<small style="color:var(--muted)">${esc(a.name)}</small>` : ''}
    </div>
    <div class="field" style="margin-top:10px">
      <label>সিক্রেট কী (Secret)</label>
      <div style="display:flex;gap:6px">
        <input type="text" readonly value="${esc(a.secret)}" style="font-family:monospace;font-size:13px">
        <button class="btn sm" id="copySec">কপি</button>
      </div>
    </div>
    <button class="btn block" id="closeQr" style="margin-top:12px">বন্ধ করুন</button>
  `);

  const qrWrap = m.el.querySelector('#accQrWrap');
  qrSvg(uri).then((svg) => {
    qrWrap.innerHTML = svg;
    const svgEl = qrWrap.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '200px';
      svgEl.style.height = '200px';
      svgEl.style.display = 'block';
    }
  }).catch((err) => {
    qrWrap.textContent = 'QR তৈরি করা যায়নি: ' + err.message;
  });

  m.el.querySelector('#copySec').onclick = async () => {
    if (await copyText(a.secret)) {
      playDropletSound(ctx.settings);
      toast('সিক্রেট কপি হয়েছে ✓');
    }
  };
  m.el.querySelector('#closeQr').onclick = () => m.close();
}

// ---------- 6. Emergency Print Sheet ----------
export async function printEmergencySheet(ctx) {
  if (ctx.vault.accounts.length === 0) return toast('প্রিন্ট করার জন্য কোনো অ্যাকাউন্ট নেই');
  const ok = await confirmDialog(
    'ইমার্জেন্সি ভল্ট শিট প্রিন্ট',
    'আপনার অ্যাকাউন্ট ও সিক্রেট কী সম্বলিত একটি অফলাইন প্রিন্ট শিট তৈরি হবে। এটি একটি নিরাপদ স্থানে (লকার বা ফাইলে) সংরক্ষণ করুন।',
    'প্রিন্ট ভিউ তৈরি করুন'
  );
  if (!ok) return;

  const w = window.open('', '_blank');
  if (!w) return toast('পপআপ ব্লক রয়েছে — ব্রাউজার সেটিংসে পপআপ অ্যালাউ করুন');

  const rows = ctx.vault.accounts.map((a, i) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold">${i + 1}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold">${esc(a.issuer || '—')}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd">${esc(a.name || '—')}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;font-family:monospace;letter-spacing:1px">${esc(a.secret)}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd">${a.type.toUpperCase()} / ${a.period || 30}s</td>
    </tr>
  `).join('');

  w.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8">
      <title>Authenticator Pro — Emergency Vault Backup</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; max-width: 900px; margin: 0 auto; }
        h1 { margin-bottom: 4px; color: #1e3a8a; }
        .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; }
        th { background: #f1f5f9; padding: 10px; border-bottom: 2px solid #cbd5e1; }
        .notice { margin-top: 30px; padding: 12px; background: #fef2f2; border-left: 4px solid #ef4444; font-size: 12.5px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:20px">
        <button onclick="window.print()" style="padding:10px 18px;font-size:15px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">🖨️ এখনই প্রিন্ট করুন / PDF হিসেবে সেভ করুন</button>
      </div>
      <h1>🔐 Authenticator Pro — ইমার্জেন্সি ভল্ট ব্যাকআপ</h1>
      <div class="meta">তারিখ: ${new Date().toLocaleString('bn-BD')} • মোট অ্যাকাউন্ট: ${ctx.vault.accounts.length}টি</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>সার্ভিস</th>
            <th>অ্যাকাউন্ট / ইমেইল</th>
            <th>সিক্রেট কী (Secret)</th>
            <th>টাইপ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="notice">
        <b>⚠️ সর্বোচ্চ সতর্কতা:</b> এই কাগজে আপনার সমস্ত ২FA সিক্রেট রয়েছে। এটি কোনো অনিরাপদ স্থানে রাখবেন না। কাজ শেষে কাগজটি নিরাপদ লকার বা ড্রয়ারে রাখুন।
      </div>
    </body>
    </html>
  `);
  w.document.close();
}

// ---------- 7. High-Precision Network Time Sync & Clock Correction ----------
export function openTimeSyncDialog(ctx) {
  const driftMs = getClockDriftMs();
  const driftSec = (driftMs / 1000).toFixed(2);
  const isGood = Math.abs(driftMs) < 2500;

  const m = openModal(`
    <h3>⏱️ টাইম সিঙ্ক ও মোনোটোনিক টাইম লক</h3>
    <div style="text-align:center;padding:16px 0 10px">
      <div style="display:inline-block;padding:16px 24px;border-radius:24px;background:var(--card2);border:1px solid ${isGood ? 'var(--ok)' : 'var(--danger)'}">
        <span style="font-size:36px">${isGood ? '🔒' : '⚠️'}</span>
        <div style="font-size:18px;font-weight:800;color:var(--text);margin-top:6px">
          Drift Offset: <span id="tsDriftDisplay">${driftSec > 0 ? '+' : ''}${driftSec}s</span>
        </div>
        <small style="color:${isGood ? 'var(--ok)' : 'var(--danger)'};font-weight:700">
          ${isGood ? 'টাইম লক সক্রিয় ✅ (ফোন ঘড়ি পরিবর্তন সুরক্ষিত)' : 'ক্লক ব্যবধান বেশি — ওটিপি কোড ব্যর্থ হতে পারে!'}
        </small>
      </div>
    </div>
    <div style="background:var(--card);padding:12px 14px;border-radius:16px;border:1px solid var(--line);margin:10px 0;font-size:12.5px;color:var(--muted);line-height:1.5">
      💡 <b>মোনোটোনিক টাইম লক প্রযুক্তি:</b> আপনার ফোনের সময় আপনি ইচ্ছামতো পরিবর্তন করলেও (ঘণ্টা/দিন আগুপিছু করলেও) অ্যাপটির ইন্টারনাল মোনোটোনিক টাইমার আসল সময়কে লক করে রাখে, ফলে আপনার ২FA কোড কখনো ভুল হবে না।
    </div>
    
    <div class="row" style="margin-top:16px">
      <button class="btn block" id="tsClose">বন্ধ করুন</button>
      <button class="btn primary block" id="tsSyncBtn">🔄 এখনই টাইম সিঙ্ক ও লক করুন</button>
    </div>
  `);

  const q = (s) => m.el.querySelector(s);
  q('#tsClose').onclick = () => m.close();

  q('#tsSyncBtn').onclick = async () => {
    q('#tsSyncBtn').disabled = true;
    q('#tsSyncBtn').textContent = 'সিঙ্ক হচ্ছে… ⏳';
    playGlassTap(ctx.settings);
    const res = await syncNetworkTime();
    q('#tsSyncBtn').disabled = false;
    q('#tsSyncBtn').textContent = '🔄 এখনই টাইম সিঙ্ক ও লক করুন';

    if (res.success) {
      playSuccessChime(ctx.settings);
      haptic('success');
      toast(`টাইম সিঙ্ক ও লক সফল! অফসেট: ${res.driftSec}s 🔒`);
      q('#tsDriftDisplay').textContent = `${Number(res.driftSec) > 0 ? '+' : ''}${res.driftSec}s`;
      ctx.render();
    } else {
      toast('টাইম সিঙ্ক ব্যর্থ: ' + (res.error || 'ইন্টারনেট সমস্যা'));
    }
  };
}

// ---------- 8. Vault Intelligence & Analytics Dashboard ----------
export function openVaultAnalytics(ctx) {
  const data = computeVaultAnalytics(ctx.vault);

  const m = openModal(`
    <h3>📊 ভল্ট ইনসাইটস ও অ্যানালিটিক্স</h3>
    <div class="stat-grid" style="margin-top:12px">
      <div class="stat-card"><b>${data.totalAccounts}</b><span>মোট ২FA অ্যাকাউন্ট</span></div>
      <div class="stat-card"><b>${data.pinnedCount}</b><span>পিন্ড অ্যাকাউন্ট</span></div>
      <div class="stat-card"><b>${data.totalCopies}</b><span>মোট কোড কপি</span></div>
    </div>

    <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text)">🏷️ সার্ভিস ক্যাটাগরি বিশ্লেষণ</h4>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${Object.values(data.categories).map((cat) => {
        const pct = data.totalAccounts ? Math.round((cat.count / data.totalAccounts) * 100) : 0;
        return `
        <div style="background:var(--card);padding:10px 14px;border-radius:16px;border:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;font-weight:600">${cat.icon} ${cat.label}</span>
            <span style="font-size:12px;font-weight:700;color:var(--muted)">${cat.count}টি (${pct}%)</span>
          </div>
          <div style="height:6px;border-radius:999px;background:var(--card2);overflow:hidden">
            <div style="width:${pct}%;height:100%;border-radius:999px;background:${cat.color}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text)">🛡️ এনক্রিপশন অ্যালগরিদম অনুপাত</h4>
    <div style="display:flex;gap:8px">
      ${Object.entries(data.algos).map(([alg, count]) => `
        <div class="stat-card" style="flex:1">
          <b>${count}</b><span>${alg}</span>
        </div>
      `).join('')}
    </div>

    ${data.mostActive.length ? `
      <h4 style="margin:16px 0 8px;font-size:14px;color:var(--text)">🔥 সর্বাধিক ব্যবহৃত অ্যাকাউন্ট</h4>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${data.mostActive.map(({ account, copies }) => `
          <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--card2);border-radius:14px;font-size:13px">
            <span style="font-weight:600">${esc(account.issuer || account.name || 'Account')}</span>
            <span style="color:var(--accent);font-weight:700">${copies} বার কপি</span>
          </div>
        `).join('')}
      </div>` : ''}

    <button class="btn block" id="closeAnalytics" style="margin-top:20px">বন্ধ করুন</button>
  `);

  m.el.querySelector('#closeAnalytics').onclick = () => m.close();
}

// ---------- 9. Multi-Select Batch Actions Dialog ----------
export function openBatchActionsModal(ctx, selectedIds, onDone) {
  if (!selectedIds.length) return toast('কোনো অ্যাকাউন্ট নির্বাচিত নেই');
  const count = selectedIds.length;
  const groups = ctx.vault.groups || [];

  const m = openModal(`
    <h3>☑️ ব্যাচ অ্যাকশন (${count}টি নির্বাচিত)</h3>
    <p class="hint">নির্বাচিত সমস্ত অ্যাকাউন্টে একসাথে নিচের অ্যাকশনগুলো প্রয়োগ করতে পারেন।</p>
    
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="menu-item" id="bPin">
        <span class="ico">⭐</span>
        <span>সবগুলো পিন / আনপিন করুন<small>তালিকার শীর্ষে নিয়ে আসুন বা সরান</small></span>
      </button>
      
      <div style="padding:12px;background:var(--card2);border-radius:18px;border:1px solid var(--line)">
        <span style="font-size:13px;font-weight:700;display:block;margin-bottom:6px">🗂️ গ্রুপ পরিবর্তন করুন:</span>
        <div style="display:flex;gap:6px">
          <input id="bGroupInput" list="bGroupList" placeholder="নতুন বা বিদ্যমান গ্রুপ..." style="flex:1;padding:8px 12px;border-radius:12px;background:var(--card);border:1px solid var(--edge);color:var(--text)">
          <datalist id="bGroupList">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
          <button class="btn sm primary" id="bGroupSave">সেভ</button>
        </div>
      </div>

      <button class="menu-item" id="bExport">
        <span class="ico">💾</span>
        <span>নির্বাচিত কোডগুলো এক্সপোর্ট করুন<small>শুধুমাত্র নির্বাচিতগুলোর এনক্রিপ্টেড ব্যাকআপ</small></span>
      </button>

      <button class="menu-item" id="bDelete" style="color:var(--danger)">
        <span class="ico">🗑️</span>
        <span>সবগুলো রিসাইকেল বিনে পাঠান<small>ভুল হলে ৩০ দিনের মধ্যে রিস্টোর সম্ভব</small></span>
      </button>
    </div>
  `);

  const q = (s) => m.el.querySelector(s);

  q('#bPin').onclick = () => {
    selectedIds.forEach((id) => {
      const a = ctx.vault.accounts.find((x) => x.id === id);
      if (a) updateAccount(ctx.vault, id, { pinned: !a.pinned });
    });
    ctx.commit();
    playDropletSound(ctx.settings);
    m.close();
    onDone?.();
    toast(`${count}টি অ্যাকাউন্টের পিন স্ট্যাটাস বদলানো হয়েছে ⭐`);
  };

  q('#bGroupSave').onclick = () => {
    const grp = q('#bGroupInput').value.trim();
    selectedIds.forEach((id) => {
      updateAccount(ctx.vault, id, { group: grp });
    });
    if (grp && !ctx.vault.groups.includes(grp)) ctx.vault.groups.push(grp);
    ctx.commit();
    playDropletSound(ctx.settings);
    m.close();
    onDone?.();
    toast(`${count}টি অ্যাকাউন্টে গ্রুপ '${grp || 'কোনো গ্রুপ নয়'}' সেভ হয়েছে ✅`);
  };

  q('#bExport').onclick = async () => {
    const subset = {
      ...ctx.vault,
      accounts: ctx.vault.accounts.filter((a) => selectedIds.includes(a.id)),
    };
    const { encryptJson } = await import('./crypto.js');
    const pwd = prompt('ব্যাকআপ ফাইলের জন্য একটি পাসফ্রেজ দিন (৮+ অক্ষর):');
    if (!pwd || pwd.length < 8) return toast('কমপক্ষে ৮ অক্ষর দিতে হবে');
    const enc = await encryptJson(subset, pwd);
    download(`authpro-batch-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(enc));
    m.close();
    onDone?.();
    toast(`${count}টি অ্যাকাউন্ট এক্সপোর্ট করা হয়েছে 💾`);
  };

  q('#bDelete').onclick = async () => {
    m.close();
    const ok = await confirmDialog(
      'ব্যাচ ডিলিট?',
      `নির্বাচিত ${count}টি অ্যাকাউন্ট মুছে রিসাইকেল বিনে পাঠানো হবে।`,
      'সব মুছুন',
      true
    );
    if (!ok) return;
    selectedIds.forEach((id) => deleteAccount(ctx.vault, id));
    ctx.commit();
    playDropletSound(ctx.settings);
    haptic('warning');
    onDone?.();
    toast(`${count}টি অ্যাকাউন্ট রিসাইকেল বিনে পাঠানো হয়েছে 🗑️`);
  };
}
