// Smart Recovery Codes Vault: Paste parser, 1-tap copy, used/unused tracker,
// text file importer/exporter, and multi-service recovery code management.
import { openModal, esc, toast, confirmDialog, copyText } from './ui.js';
import { updateAccount } from './store.js';
import { renderAccountAvatar } from './brand-icons.js';
import { playDropletSound, playSuccessChime, haptic } from './audio.js';

// Clean and extract recovery codes from any text block (GitHub, Google, Binance, Discord, etc.)
export function parseRecoveryText(raw) {
  if (!raw || typeof raw !== 'string') return [];
  
  const lines = raw.split(/\r?\n/);
  const found = [];
  const seen = new Set();

  // Words that indicate non-code prose/instructions
  const proseKeywords = /^(enable|download|keep|your|recovery|codes|backup|two-factor|2fa|authentication|you|can|use|as|second|factor|authenticate|in|case|lose|access|device|recommend|saving|secure|password|manager|such|1password|authy|keeper|safe|spot|if|cancel|saved|step|verify|unable|scan|generated)/i;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Remove markdown list markers, bullets, numbered lists (e.g. "• ", "1. ", "- ", "* ", "[ ]")
    line = line.replace(/^[•\*\-\+]\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^\[[ xX]\]\s*/, '').trim();

    // Line might have multiple codes side-by-side (e.g. GitHub table: "0ed6f-6d077    c8edc-934ad")
    // Split by tabs, 2+ spaces, or commas
    const segments = line.split(/\t+|\s{2,}|,\s*/);
    for (let seg of segments) {
      seg = seg.trim().replace(/^[•\*\-]\s*/, '');
      if (!seg) continue;
      if (proseKeywords.test(seg)) continue;

      // Extract code tokens:
      // Case 1: GitHub / Discord style: e.g. "0ed6f-6d077" or "bb72b-87098" (alphanumeric hyphen/underscore alphanumeric)
      // Case 2: Google 8-digit codes: e.g. "1234 5678" or "12345678"
      // Case 3: Alphanumeric block: 6 to 24 chars
      const tokenMatch = seg.match(/\b([A-Za-z0-9]{3,8}[-_][A-Za-z0-9]{3,8})\b/) ||
                         seg.match(/\b(\d{3,5}\s+\d{3,5})\b/) ||
                         seg.match(/\b([A-Za-z0-9]{6,24})\b/);

      if (tokenMatch) {
        let code = tokenMatch[1].trim();
        // Must contain at least one digit (to ignore pure English words like "Google", "Backup", "Codes")
        if (!/\d/.test(code)) continue;
        
        // Normalize: if 8 digits with space like "1234 5678", keep single space
        const normalized = code.replace(/\s+/g, ' ');
        if (!seen.has(normalized.toLowerCase())) {
          seen.add(normalized.toLowerCase());
          found.push(normalized);
        }
      }
    }
  }

  return found;
}

// Open Smart Recovery Codes Vault for a specific account
export function openRecoveryCodesDialog(ctx, accountId) {
  const getAccount = () => ctx.vault.accounts.find((a) => a.id === accountId);
  const initialAccount = getAccount();
  if (!initialAccount) return;

  if (!Array.isArray(initialAccount.recoveryCodes)) {
    initialAccount.recoveryCodes = [];
  }

  let hideCodes = false;

  const render = () => {
    const account = getAccount() || initialAccount;
    const codes = Array.isArray(account.recoveryCodes) ? account.recoveryCodes : [];
    const total = codes.length;
    const unused = codes.filter((c) => !c.used).length;
    const used = total - unused;
    const pct = total > 0 ? Math.round((unused / total) * 100) : 0;
    const title = account.issuer || account.name || 'অ্যাকাউন্ট';

    // Find next available unused code
    const nextUnusedIdx = codes.findIndex((c) => !c.used);
    const nextCode = nextUnusedIdx !== -1 ? codes[nextUnusedIdx] : null;

    // Color tier for progress bar
    const barColor = pct > 50 ? 'var(--ok, #10b981)' : pct > 20 ? 'var(--warn, #f59e0b)' : 'var(--danger, #ef4444)';

    return `
      <div class="recovery-dialog-header">
        <div class="rd-brand-row">
          ${renderAccountAvatar(account)}
          <div class="rd-title-box">
            <h3 style="margin:0;font-size:18px">${esc(title)}</h3>
            <span class="rd-subtitle">${esc(account.name || '')} • 🔐 রিকভারি কোড ভল্ট</span>
          </div>
        </div>
      </div>

      <!-- Stats & Progress -->
      <div class="recovery-status-card">
        <div class="rs-info">
          <div>
            <b style="font-size:18px;color:${barColor}">${unused}টি বাকি</b>
            <span style="font-size:12px;opacity:.7;margin-left:6px">(মোট ${total}টির মধ্যে)</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:${barColor}">${pct}% অবশিষ্ট</div>
        </div>
        <div class="rs-bar-bg">
          <div class="rs-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        ${unused <= 2 && total > 0 ? `
          <div class="rs-alert">
            ⚠️ আপনার রিকভারি কোড শেষ হয়ে আসছে! ${unused === 0 ? 'সব কোড ব্যবহৃত হয়ে গেছে। সাইটে লগইন করে নতুন কোড জেনারেট করুন।' : 'জরুরি ভিত্তিতে নতুন কোড সংগ্রহ করুন।'}
          </div>` : ''}
      </div>

      <!-- Quick Action Buttons -->
      <div class="recovery-actions-bar">
        <button class="btn mini-action-btn primary" id="btnCopyNext" ${!nextCode ? 'disabled style="opacity:.4"' : ''} title="পরবর্তী অব্যবহৃত কোডটি এক ক্লিকে নিন">
          📋 ${nextCode ? `পরবর্তী কোড কপি (#${nextUnusedIdx + 1})` : 'কোনো কোড বাকি নেই'}
        </button>
        <button class="btn mini-action-btn" id="btnAddCodes">
          ➕ কোড যোগ / পেস্ট
        </button>
        <button class="btn mini-action-btn" id="btnToggleMask" title="কোড লুকান বা দেখান">
          ${hideCodes ? '👁️ দেখান' : '🙈 লুকান'}
        </button>
        <button class="btn mini-action-btn" id="btnDownload" ${total === 0 ? 'disabled style="opacity:.4"' : ''} title="টেক্সট ফাইলে ব্যাকআপ নামান">
          📥 ডাউনলোড
        </button>
      </div>

      <!-- Codes Grid -->
      <div class="recovery-codes-scroll">
        ${total === 0 ? `
          <div class="empty-recovery-state">
            <span style="font-size:42px;display:block;margin-bottom:10px">🔐</span>
            <b style="font-size:16px">কোনো রিকভারি কোড সেভ করা নেই</b>
            <p style="font-size:13px;color:var(--muted);max-width:340px;margin:8px auto;line-height:1.5">
              GitHub, Google, Binance বা যেকোনো সাইটের 2FA ব্যাকআপ কোডগুলো এখানে সুরক্ষিত রাখুন।
            </p>
            <button class="btn primary" id="btnEmptyAdd" style="margin-top:12px;padding:10px 20px">
              📋 স্মার্ট পেস্ট দিয়ে কোড যোগ করুন
            </button>
          </div>` : `
          <div class="recovery-codes-grid">
            ${codes.map((item, idx) => `
              <div class="recovery-code-card ${item.used ? 'is-used' : ''}" data-card-idx="${idx}">
                <div class="rcc-top">
                  <span class="rcc-num">#${String(idx + 1).padStart(2, '0')}</span>
                  <label class="rcc-used-toggle" title="${item.used ? 'ব্যবহৃত মার্ক তোলা হবে' : 'ব্যবহৃত হিসেবে চিহ্নিত করুন'}">
                    <input type="checkbox" class="cb-used" data-idx="${idx}" ${item.used ? 'checked' : ''}>
                    <span>${item.used ? 'ব্যবহৃত ✓' : 'ব্যবহারযোগ্য'}</span>
                  </label>
                </div>
                <div class="rcc-code-box">
                  <code class="rcc-code ${hideCodes ? 'masked' : ''}">
                    ${hideCodes ? '•••••-•••••' : esc(item.code)}
                  </code>
                </div>
                <div class="rcc-footer">
                  <button class="rcc-btn rcc-copy" data-copy-idx="${idx}" title="এই কোডটি কপি করুন">
                    📋 কপি করুন
                  </button>
                  <button class="rcc-btn rcc-del" data-del-idx="${idx}" title="এই কোডটি মুছুন">
                    🗑️
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="row" style="margin-top:14px;border-top:1px solid var(--edge);padding-top:12px">
        <button class="btn" id="btnClose">বন্ধ করুন</button>
        ${total > 0 ? `<button class="btn danger" id="btnClearAll" style="margin-left:auto">সব মুছুন</button>` : ''}
      </div>
    `;
  };

  const m = openModal(render());

  const refresh = () => {
    // Note: m.el is the .sheet element returned by openModal
    m.el.innerHTML = render();
    bindEvents();
  };

  const bindEvents = () => {
    const account = getAccount() || initialAccount;
    const codes = account.recoveryCodes || [];

    // Copy Next Unused Code ("সুন্দর মতো একটা একটা করে দিবে")
    const copyNextBtn = m.el.querySelector('#btnCopyNext');
    if (copyNextBtn) {
      copyNextBtn.onclick = async () => {
        const nextIdx = codes.findIndex((c) => !c.used);
        if (nextIdx === -1) return toast('কোনো অব্যবহৃত কোড নেই');
        const next = codes[nextIdx];
        if (await copyText(next.code)) {
          playSuccessChime(ctx.settings || {});
          haptic('success');
          // Automatically mark it used
          next.used = true;
          next.usedAt = Date.now();
          updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
          ctx.commit();
          refresh();
          toast(`কোড #${nextIdx + 1} (${next.code}) কপি ও ব্যবহৃত চিহ্নিত হয়েছে ✅`, 'UNDO', () => {
            next.used = false;
            next.usedAt = null;
            updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
            ctx.commit();
            refresh();
          }, 7000);
        }
      };
    }

    // Add / Paste codes
    const addBtn = m.el.querySelector('#btnAddCodes');
    if (addBtn) addBtn.onclick = () => openSmartPasteDialog(ctx, account.id, () => refresh());

    const emptyAddBtn = m.el.querySelector('#btnEmptyAdd');
    if (emptyAddBtn) emptyAddBtn.onclick = () => openSmartPasteDialog(ctx, account.id, () => refresh());

    // Toggle Masking
    const maskBtn = m.el.querySelector('#btnToggleMask');
    if (maskBtn) {
      maskBtn.onclick = () => {
        hideCodes = !hideCodes;
        refresh();
      };
    }

    // Download as .txt file
    const dlBtn = m.el.querySelector('#btnDownload');
    if (dlBtn) {
      dlBtn.onclick = () => {
        downloadRecoveryCodesFile(account);
      };
    }

    // Used checkboxes
    m.el.querySelectorAll('.cb-used').forEach((cb) => {
      cb.onchange = (e) => {
        const idx = +e.target.dataset.idx;
        if (codes[idx]) {
          codes[idx].used = e.target.checked;
          codes[idx].usedAt = e.target.checked ? Date.now() : null;
          updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
          ctx.commit();
          refresh();
          toast(e.target.checked ? `কোড #${idx + 1} ব্যবহৃত হিসেবে চিহ্নিত ✓` : `কোড #${idx + 1} ব্যবহারযোগ্য করা হয়েছে`);
        }
      };
    });

    // 1-Tap Copy buttons for specific code card
    m.el.querySelectorAll('[data-copy-idx]').forEach((b) => {
      b.onclick = async () => {
        const idx = +b.dataset.copyIdx;
        const item = codes[idx];
        if (!item) return;
        if (await copyText(item.code)) {
          playDropletSound(ctx.settings || {});
          haptic('light');
          const wasUsed = item.used;
          if (!wasUsed) {
            item.used = true;
            item.usedAt = Date.now();
            updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
            ctx.commit();
            refresh();
          }
          toast(`কোড #${idx + 1} (${item.code}) কপি হয়েছে ✅` + (!wasUsed ? ' (ব্যবহৃত চিহ্নিত)' : ''), !wasUsed ? 'UNDO' : undefined, () => {
            item.used = false;
            item.usedAt = null;
            updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
            ctx.commit();
            refresh();
          }, 6000);
        }
      };
    });

    // Delete single code
    m.el.querySelectorAll('[data-del-idx]').forEach((b) => {
      b.onclick = () => {
        const idx = +b.dataset.delIdx;
        codes.splice(idx, 1);
        updateAccount(ctx.vault, account.id, { recoveryCodes: codes });
        ctx.commit();
        refresh();
        toast('কোডটি মুছে ফেলা হয়েছে');
      };
    });

    // Clear all
    const clearBtn = m.el.querySelector('#btnClearAll');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!(await confirmDialog('সব রিকভারি কোড মুছবেন?', `"${account.issuer || account.name}" এর সংরক্ষিত সকল রিকভারি কোড মুছে যাবে।`, 'মুছুন', true))) return;
        account.recoveryCodes = [];
        updateAccount(ctx.vault, account.id, { recoveryCodes: [] });
        ctx.commit();
        refresh();
        toast('সকল রিকভারি কোড মোছা হয়েছে');
      };
    }

    // Close
    const closeBtn = m.el.querySelector('#btnClose');
    if (closeBtn) closeBtn.onclick = () => m.close();
  };

  bindEvents();
}

// Smart Paste Dialog: Paste text or drop text file
export function openSmartPasteDialog(ctx, accountId, onDone) {
  const getAccount = () => ctx.vault.accounts.find((a) => a.id === accountId);
  const account = getAccount();
  if (!account) return;

  const m = openModal(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      ${renderAccountAvatar(account)}
      <div>
        <h3 style="margin:0;font-size:17px">স্মার্ট রিকভারি কোড পেস্ট</h3>
        <span style="font-size:12px;opacity:.7">${esc(account.issuer || account.name || '')}</span>
      </div>
    </div>
    
    <p class="hint" style="margin-bottom:12px">
      GitHub, Google, Binance বা যেকোনো সাইটের রিকভারি কোডগুলো হুবহু কপি করে এখানে পেস্ট করুন, অথবা ডাউনলোড করা টেক্সট (.txt) ফাইল সিলেক্ট করুন। আমাদের স্মার্ট সিস্টেম নিজে থেকেই সবগুলো কোড সাজিয়ে নেবে।
    </p>

    <div class="field">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <label style="margin:0;font-weight:600">রিকভারি কোড টেক্সট পেস্ট করুন</label>
        <button class="btn mini-action-btn" id="btnUploadTxt">📁 .txt ফাইল আনুন</button>
        <input type="file" id="txtFileInput" accept=".txt,text/plain" style="display:none">
      </div>
      <textarea id="rawInput" rows="7" placeholder="উদাহরণ:&#10;• 0ed6f-6d077&#10;• 68b0b-4490b&#10;• c8edc-934ad&#10;• 62be6-05f8e" style="font-family:monospace;font-size:13px;line-height:1.5"></textarea>
    </div>

    <!-- Live Preview Detection Pill -->
    <div id="detectionBox" class="detection-pill hidden">
      <span class="det-icon">✨</span>
      <span id="detText">০টি কোড সনাক্ত হয়েছে</span>
    </div>

    <div class="row" style="margin-top:16px">
      <button class="btn" id="btnCancel">বাতিল</button>
      <button class="btn primary" id="btnSaveCodes" disabled>সেভ করুন (০টি কোড)</button>
    </div>
  `);

  const rawArea = m.el.querySelector('#rawInput');
  const detBox = m.el.querySelector('#detectionBox');
  const detText = m.el.querySelector('#detText');
  const saveBtn = m.el.querySelector('#btnSaveCodes');
  const uploadBtn = m.el.querySelector('#btnUploadTxt');
  const fileInput = m.el.querySelector('#txtFileInput');

  let currentDetected = [];

  const updateDetection = () => {
    const val = rawArea.value;
    currentDetected = parseRecoveryText(val);
    if (currentDetected.length > 0) {
      detBox.classList.remove('hidden');
      detText.textContent = `${currentDetected.length}টি বৈধ রিকভারি কোড সনাক্ত হয়েছে!`;
      saveBtn.disabled = false;
      saveBtn.textContent = `সেভ করুন (${currentDetected.length}টি কোড)`;
    } else {
      detBox.classList.add('hidden');
      saveBtn.disabled = true;
      saveBtn.textContent = 'সেভ করুন (০টি কোড)';
    }
  };

  rawArea.oninput = updateDetection;

  // File upload handler
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      rawArea.value = ev.target.result;
      updateDetection();
      toast(`${file.name} লোড হয়েছে ✅`);
    };
    reader.readAsText(file);
  };

  m.el.querySelector('#btnCancel').onclick = () => m.close();

  saveBtn.onclick = () => {
    if (!currentDetected.length) return toast('কোনো কোড পাওয়া যায়নি');

    const targetAccount = getAccount();
    if (!targetAccount) return toast('অ্যাকাউন্ট খুঁজে পাওয়া যায়নি');

    // Create a map of existing codes so we preserve already used status
    const existingMap = new Map();
    if (Array.isArray(targetAccount.recoveryCodes)) {
      for (const item of targetAccount.recoveryCodes) {
        if (item && item.code) existingMap.set(item.code.toLowerCase().trim(), item);
      }
    }

    // Preserve the user's EXACT order of codes
    const finalCodes = currentDetected.map((codeStr, idx) => {
      const clean = codeStr.trim();
      const existing = existingMap.get(clean.toLowerCase());
      return {
        id: existing?.id || Math.random().toString(36).slice(2, 10),
        code: clean,
        used: existing ? Boolean(existing.used) : false,
        usedAt: existing ? existing.usedAt : null,
        addedAt: existing ? existing.addedAt : Date.now(),
        order: idx,
      };
    });

    targetAccount.recoveryCodes = finalCodes;
    updateAccount(ctx.vault, targetAccount.id, { recoveryCodes: finalCodes });
    ctx.commit();
    m.close();
    toast(`${finalCodes.length}টি রিকভারি কোড সফলভাবে সংরক্ষিত হয়েছে! 🎉`);
    if (onDone) onDone();
  };
}

// Download recovery codes as clean text file
function downloadRecoveryCodesFile(account) {
  const codes = account.recoveryCodes || [];
  if (!codes.length) return toast('ডাউনলোড করার মতো কোড নেই');

  const title = account.issuer || account.name || 'Account';
  const unusedCodes = codes.filter((c) => !c.used);

  let text = `=======================================================\n`;
  text += `   AUTHENTICATOR PRO - RECOVERY CODES BACKUP\n`;
  text += `   Account : ${title} (${account.name || ''})\n`;
  text += `   Date    : ${new Date().toLocaleString()}\n`;
  text += `   Total   : ${codes.length} | Remaining Unused: ${unusedCodes.length}\n`;
  text += `=======================================================\n\n`;

  text += `RECOVERY CODES:\n`;
  codes.forEach((c, i) => {
    text += `  [${i + 1 < 10 ? '0' + (i + 1) : i + 1}]  ${c.code.padEnd(20)} ${c.used ? '(ALREADY USED)' : '[AVAILABLE]'}\n`;
  });

  text += `\n-------------------------------------------------------\n`;
  text += `Keep these recovery codes confidential and stored safely.\n`;
  text += `Generated with Authenticator Pro.\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (title + '-' + (account.name || '')).replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${safeName}-recovery-codes.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('রিকভারি কোড ফাইল ডাউনলোড হয়েছে 📥');
}

// Global Recovery Codes Vault Overview (All Accounts)
export function openGlobalRecoveryVault(ctx) {
  const accountsWithCodes = ctx.vault.accounts.filter(
    (a) => Array.isArray(a.recoveryCodes) && a.recoveryCodes.length > 0
  );

  const m = openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <h3 style="margin:0;font-size:18px">🔐 স্মার্ট রিকভারি কোড ভল্ট</h3>
        <span style="font-size:12px;opacity:.7">সকল সার্ভিসের ব্যাকআপ কোড এক নজরে</span>
      </div>
      <span class="badge-count">${accountsWithCodes.length}টি অ্যাকাউন্ট</span>
    </div>

    <p class="hint" style="margin-bottom:14px">
      2-Step ভেরিফিকেশনে ফোন হারিয়ে গেলে বা কোড না আসলে অ্যাকাউন্ট রিকভার করার একমাত্র উপায় হলো এই রিকভারি কোড।
    </p>

    <div class="recovery-vault-list">
      ${accountsWithCodes.length === 0 ? `
        <div class="empty-recovery-state" style="padding:28px 14px">
          <span style="font-size:42px;display:block;margin-bottom:10px">🛡️</span>
          <b>কোনো অ্যাকাউন্টে রিকভারি কোড যুক্ত নেই</b>
          <p style="font-size:13px;color:var(--muted);max-width:320px;margin:8px auto">
            যেকোনো অ্যাকাউন্টের কার্ডে ক্লিক করে বা নিচে থেকে অ্যাকাউন্ট সিলেক্ট করে রিকভারি কোড যোগ করুন।
          </p>
        </div>` : `
        <div class="vault-account-grid">
          ${accountsWithCodes.map((a) => {
            const total = a.recoveryCodes.length;
            const unused = a.recoveryCodes.filter((c) => !c.used).length;
            const pct = Math.round((unused / total) * 100);
            const barColor = pct > 50 ? 'var(--ok, #10b981)' : pct > 20 ? 'var(--warn, #f59e0b)' : 'var(--danger, #ef4444)';
            return `
              <div class="vault-acc-card" data-open-rec="${a.id}">
                ${renderAccountAvatar(a)}
                <div class="vac-info">
                  <b class="vac-title">${esc(a.issuer || a.name || 'Unnamed')}</b>
                  <span class="vac-name">${esc(a.name || '')}</span>
                  <div class="vac-bar-wrap">
                    <div class="vac-bar" style="width:${pct}%;background:${barColor}"></div>
                  </div>
                </div>
                <div class="vac-badge" style="color:${barColor}">
                  <b>${unused}/${total}</b>
                  <small>বাকি</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- Quick Add to Existing Accounts -->
    <div style="margin-top:16px;border-top:1px solid var(--edge);padding-top:14px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px">➕ অ্যাকাউন্টে রিকভারি কোড যোগ করুন:</label>
      <div style="display:flex;gap:8px">
        <select id="accSelect" style="flex:1;padding:10px 14px;border-radius:14px;background:var(--card);color:var(--text);border:1px solid var(--edge)">
          <option value="">অ্যাকাউন্ট নির্বাচন করুন...</option>
          ${ctx.vault.accounts.map((a) => `<option value="${a.id}">${esc(a.issuer || a.name)} (${esc(a.name || a.issuer)})</option>`).join('')}
        </select>
        <button class="btn primary" id="btnGoAdd" style="white-space:nowrap">কোড যোগ</button>
      </div>
    </div>

    <div class="row" style="margin-top:16px">
      <button class="btn" id="btnCloseVault">বন্ধ করুন</button>
    </div>
  `);

  m.el.querySelectorAll('[data-open-rec]').forEach((card) => {
    card.onclick = () => {
      const id = card.dataset.openRec;
      m.close();
      openRecoveryCodesDialog(ctx, id);
    };
  });

  const goAddBtn = m.el.querySelector('#btnGoAdd');
  const accSel = m.el.querySelector('#accSelect');
  goAddBtn.onclick = () => {
    const id = accSel.value;
    if (!id) return toast('একটি অ্যাকাউন্ট নির্বাচন করুন');
    m.close();
    openRecoveryCodesDialog(ctx, id);
  };

  m.el.querySelector('#btnCloseVault').onclick = () => m.close();
}
