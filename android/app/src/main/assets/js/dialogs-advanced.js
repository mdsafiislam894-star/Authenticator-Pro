// Advanced Modal Dialogs: Theme & Vibe Picker, Security Audit, Password Generator, Focus View, Single-Account QR & Emergency Print.
import { openModal, esc, toast, copyText, confirmDialog, qrSvg } from './ui.js';
import { generateCode, secondsLeft, buildOtpauth } from './otp.js';
import { runSecurityAudit } from './security-audit.js';
import { generatePassword, generatePassphrase, evaluateStrength } from './password.js';
import { playDropletSound, haptic } from './audio.js';

export const THEMES = [
  {
    id: 'ocean-dew',
    mode: 'light',
    name: 'Aqua Dew (লাইট)',
    tagline: 'স্বচ্ছ সকালের শিশির ও নীল জলপ্রপাত',
    accent: '#2563eb',
    previewGrad: 'linear-gradient(135deg, #cfe0ff, #eef2ff, #c9f3ee)',
    cardBg: 'rgba(255, 255, 255, 0.75)',
    textColor: '#0d1226',
  },
  {
    id: 'midnight-obsidian',
    mode: 'dark',
    name: 'Obsidian Abyss (ডার্ক)',
    tagline: 'ডিপ ওলেড ব্ল্যাক ও সাইবার নিয়ন',
    accent: '#86a9ff',
    previewGrad: 'linear-gradient(135deg, #070a14, #1c2d78, #0b5360)',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textColor: '#f4f6ff',
  },
  {
    id: 'rose-quartz',
    mode: 'light',
    name: 'Rose Quartz (লাইট)',
    tagline: 'রোজ গোল্ড, শ্যাম্পেন ও সানসেট লাক্সারি',
    accent: '#f43f5e',
    previewGrad: 'linear-gradient(135deg, #ffe4e6, #fff1f2, #ffedd5)',
    cardBg: 'rgba(255, 245, 248, 0.75)',
    textColor: '#4c0519',
  },
  {
    id: 'cyber-matrix',
    mode: 'dark',
    name: 'Emerald Jade (ডার্ক)',
    tagline: 'ম্যাট্রিক্স বায়ো-গ্লাস ও সাইবার এমারেল্ড',
    accent: '#34d399',
    previewGrad: 'linear-gradient(135deg, #03140d, #064e3b, #022c22)',
    cardBg: 'rgba(52, 211, 153, 0.08)',
    textColor: '#ecfdf5',
  },
  {
    id: 'amethyst-royale',
    mode: 'dark',
    name: 'Amethyst Royale (ডার্ক)',
    tagline: 'রাজকীয় ভেলভেট পার্পল ও কসমিক গ্যালাক্সি',
    accent: '#c084fc',
    previewGrad: 'linear-gradient(135deg, #0b0318, #3b0764, #581c87)',
    cardBg: 'rgba(192, 132, 252, 0.09)',
    textColor: '#faf5ff',
  },
  {
    id: 'frosted-pearl',
    mode: 'light',
    name: 'Frosted Pearl (লাইট)',
    tagline: 'সুইস টাইটানিয়াম ও আইস গ্লাস মিনিমালিজম',
    accent: '#0f172a',
    previewGrad: 'linear-gradient(135deg, #f8fafc, #e2e8f0, #cbd5e1)',
    cardBg: 'rgba(255, 255, 255, 0.88)',
    textColor: '#0f172a',
  },
];

// ---------- 1. Theme & Vibe Picker ----------
export function openThemePicker(ctx) {
  const current = ctx.settings.theme;
  const resolved = ctx.resolvedTheme();

  const m = openModal(`
    <h3>🎨 প্রিমিয়াম থিম ও লিকুইড স্টাইল</h3>
    <p class="hint">প্রতিটি থিমের রয়েছে সম্পূর্ণ ভিন্ন কালার ভাইব, কাঁচের স্বচ্ছতা এবং রিফ্লেক্টিভ অরবস।</p>
    <div class="theme-grid">
      ${THEMES.map((t) => {
        const isCurrent = current === t.id || (current === 'auto' && resolved === t.mode && (t.id === 'ocean-dew' || t.id === 'midnight-obsidian'));
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
