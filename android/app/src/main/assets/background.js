// Authenticator Pro - Background Service Worker (Manifest V3)
// Handles context menus, active tab detection, 2FA autofill, standalone window launch,
// and external Web Auth Bridge messages for zero-config Google Sync.

import { generateCode } from './js/otp.js';

chrome.runtime.onInstalled.addListener(() => {
  // Create right-click context menu options
  try {
    chrome.contextMenus.create({
      id: 'authpro-root',
      title: '🛡️ Authenticator Pro',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'authpro-fill',
      parentId: 'authpro-root',
      title: '⚡ বর্তমান সাইটের 2FA কোড পেস্ট করুন',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'authpro-open-window',
      parentId: 'authpro-root',
      title: '🪟 ফ্লোটিং উইন্ডোতে Authenticator খুলুন',
      contexts: ['all']
    });
  } catch (err) {
    console.warn('Context menu creation warning:', err);
  }
});

// Smart Domain & Brand Matching Dictionary
const BRAND_PATTERNS = {
  github: ['github'],
  google: ['google', 'gmail', 'youtube'],
  facebook: ['facebook', 'meta', 'fb'],
  binance: ['binance'],
  twitter: ['twitter', 'x.com'],
  microsoft: ['microsoft', 'live', 'outlook', 'office', 'hotmail'],
  discord: ['discord'],
  gitlab: ['gitlab'],
  amazon: ['amazon', 'aws'],
  apple: ['apple', 'icloud'],
  dropbox: ['dropbox'],
  reddit: ['reddit'],
  instagram: ['instagram'],
  linkedin: ['linkedin'],
  coinbase: ['coinbase'],
  kraken: ['kraken'],
  steam: ['steam', 'valvesoftware'],
  uber: ['uber'],
  paypal: ['paypal']
};

function getBrandKeywords(domain) {
  domain = (domain || '').toLowerCase();
  for (const [brand, keywords] of Object.entries(BRAND_PATTERNS)) {
    if (keywords.some(k => domain.includes(k))) {
      return keywords;
    }
  }
  const parts = domain.split('.');
  if (parts.length >= 2) return [parts[parts.length - 2]];
  return [domain];
}

async function handleAutofillDetect(context) {
  if (!context || !context.domain) return { matched: false };

  const data = await chrome.storage.local.get(['authpro.vault.v1']);
  const vault = data['authpro.vault.v1'];
  if (!vault || !Array.isArray(vault.accounts) || vault.accounts.length === 0) {
    return { matched: false, reason: 'no_accounts' };
  }

  const brandKeywords = getBrandKeywords(context.domain);
  const pageEmails = context.pageEmails || [];
  const pageUsernames = context.pageUsernames || [];

  // Filter accounts that match the service brand/domain
  const matchingAccounts = vault.accounts.filter(a => {
    const issuer = (a.issuer || '').toLowerCase();
    const name = (a.name || '').toLowerCase();
    const group = (a.group || '').toLowerCase();

    return brandKeywords.some(kw => 
      issuer.includes(kw) || name.includes(kw) || group.includes(kw)
    );
  });

  if (matchingAccounts.length === 0) {
    return { matched: false, reason: 'no_matching_service' };
  }

  let exactMatch = null;

  if (matchingAccounts.length === 1) {
    exactMatch = matchingAccounts[0];
  } else {
    // When multiple accounts exist (e.g. 4 Google accounts), find the EXACT email asked on the page
    for (const email of pageEmails) {
      const found = matchingAccounts.find(a => 
        (a.name || '').toLowerCase().includes(email) || 
        (a.issuer || '').toLowerCase().includes(email)
      );
      if (found) {
        exactMatch = found;
        break;
      }
    }

    if (!exactMatch) {
      for (const user of pageUsernames) {
        const found = matchingAccounts.find(a => 
          (a.name || '').toLowerCase().includes(user) || 
          (a.issuer || '').toLowerCase().includes(user)
        );
        if (found) {
          exactMatch = found;
          break;
        }
      }
    }

    if (!exactMatch) {
      exactMatch = matchingAccounts.find(a => a.pinned) || matchingAccounts[0];
    }
  }

  if (!exactMatch || !exactMatch.secret) {
    return { matched: false, reason: 'no_secret' };
  }

  try {
    const code = await generateCode(exactMatch);
    const display = exactMatch.issuer 
      ? (exactMatch.name && exactMatch.name.toLowerCase() !== exactMatch.issuer.toLowerCase() 
          ? `${exactMatch.issuer} (${exactMatch.name})` 
          : exactMatch.issuer)
      : exactMatch.name;

    return {
      matched: true,
      accountName: display,
      code: code
    };
  } catch (err) {
    console.error('Failed to generate TOTP in autofill:', err);
    return { matched: false, error: err.message };
  }
}

// Listen for 2FA Autofill requests from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AUTOFILL_DETECT') {
    handleAutofillDetect(message.context).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'authpro-open-window') {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html?mode=window'),
      type: 'popup',
      width: 400,
      height: 640
    });
    return;
  }

  if (info.menuItemId === 'authpro-fill' && tab?.id) {
    try {
      // Execute paste script into active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
              activeEl.value = clipText;
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
              activeEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (e) {
            console.warn('Autofill warning:', e);
          }
        }
      });
    } catch (e) {
      console.warn('Script execution error:', e);
    }
  }
});

// Handle External Messages from authorized Web App (Web Auth Bridge)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AUTH_BRIDGE_SUCCESS' && message?.session) {
    const toSave = {
      'authpro.google.v1': message.session
    };
    if (message.passphrase) {
      toSave['authpro.pass.v1'] = message.passphrase;
    }
    if (message.vault && message.vault.accounts && message.vault.accounts.length > 0) {
      toSave['authpro.vault.v1'] = message.vault;
    }
    chrome.storage.local.set(toSave, () => {
      sendResponse({ success: true, message: 'Extension session and vault saved successfully' });
    });
    return true; // Keep message channel open for async response
  }

  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: '3.0.0' });
    return false;
  }
});
