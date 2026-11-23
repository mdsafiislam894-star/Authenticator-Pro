// Authenticator Pro - Extension Popup Controller
// Extends the core Liquid Glass UI with desktop browser features:
// - Detached floating pop-out window
// - Active tab domain detection & 1-tap 2FA autofill
// - Chrome storage synchronization & Web Auth Bridge listener

import './app.js';
import { generateCode } from './otp.js';
import { toast, copyText } from './ui.js';
import { loadVault } from './store.js';

document.addEventListener('DOMContentLoaded', () => {
  // Check if opened as a detached popup window
  const params = new URLSearchParams(window.location.search);
  const isDetached = params.get('mode') === 'window';
  if (isDetached) {
    document.body.classList.add('mode-window');
    const popoutBtn = document.getElementById('popoutBtn');
    if (popoutBtn) popoutBtn.style.display = 'none';
  }

  // Web App button handler (Open full live app)
  const webAppBtn = document.getElementById('webAppBtn');
  if (webAppBtn) {
    webAppBtn.onclick = () => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: 'https://mdsafiislam894-star.github.io/Authenticator-Pro/' });
      } else {
        window.open('https://mdsafiislam894-star.github.io/Authenticator-Pro/', '_blank');
      }
    };
  }

  // Pop-out button click handler
  const popoutBtn = document.getElementById('popoutBtn');
  if (popoutBtn) {
    popoutBtn.onclick = () => {
      if (typeof chrome !== 'undefined' && chrome.windows?.create) {
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html?mode=window'),
          type: 'popup',
          width: 410,
          height: 650
        });
        window.close();
      } else {
        window.open('popup.html?mode=window', 'authpro_window', 'width=410,height=650');
      }
    };
  }

  // Initial sync & hydrate from chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['authpro.google.v1', 'authpro.pass.v1', 'authpro.vault.v1', 'authpro.settings.v1'], (items) => {
      let updated = false;
      if (items['authpro.settings.v1']) {
        try {
          const savedSettings = items['authpro.settings.v1'];
          const curSettings = JSON.parse(localStorage.getItem('authpro.settings.v1') || '{}');
          const merged = { ...curSettings, ...savedSettings };
          localStorage.setItem('authpro.settings.v1', JSON.stringify(merged));
          if (window.authProCtx?.applyTheme) window.authProCtx.applyTheme();
        } catch {}
      }
      if (items['authpro.google.v1'] && !localStorage.getItem('authpro.google.v1')) {
        try {
          localStorage.setItem('authpro.google.v1', JSON.stringify(items['authpro.google.v1']));
          updated = true;
        } catch {}
      }
      if (items['authpro.pass.v1'] && !localStorage.getItem('authpro.pass.v1')) {
        try {
          localStorage.setItem('authpro.pass.v1', items['authpro.pass.v1']);
          updated = true;
        } catch {}
      }
      if (items['authpro.vault.v1']?.accounts?.length) {
        try {
          const currentVault = loadVault();
          if (!currentVault.accounts || currentVault.accounts.length === 0) {
            localStorage.setItem('authpro.vault.v1', JSON.stringify(items['authpro.vault.v1']));
            updated = true;
          }
        } catch {}
      }
      if (updated) {
        if (typeof window.authProCtx?.refreshVault === 'function') {
          window.authProCtx.refreshVault();
        }
        if (typeof window.authProCtx?.refreshSyncDot === 'function') {
          window.authProCtx.refreshSyncDot();
        }
        if (typeof window.authProCtx?.doSync === 'function') {
          window.authProCtx.doSync(false);
        }
      }
    });
  }

  // Storage listener for cross-context Google sign-in & vault sync (Web Auth Bridge -> Extension)
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        let shouldRefresh = false;
        if (changes['authpro.google.v1']?.newValue) {
          try {
            localStorage.setItem('authpro.google.v1', JSON.stringify(changes['authpro.google.v1'].newValue));
            shouldRefresh = true;
          } catch {}
        }
        if (changes['authpro.pass.v1']?.newValue) {
          try {
            localStorage.setItem('authpro.pass.v1', changes['authpro.pass.v1'].newValue);
            shouldRefresh = true;
          } catch {}
        }
        if (changes['authpro.vault.v1']?.newValue?.accounts?.length) {
          try {
            const currentVault = loadVault();
            if (!currentVault.accounts || currentVault.accounts.length === 0) {
              localStorage.setItem('authpro.vault.v1', JSON.stringify(changes['authpro.vault.v1'].newValue));
              shouldRefresh = true;
            }
          } catch {}
        }
        if (shouldRefresh) {
          toast('ক্লাউড সিঙ্ক ডাটা আপডেট হয়েছে ☁️');
          if (typeof window.authProCtx?.refreshVault === 'function') {
            window.authProCtx.refreshVault();
          }
          if (typeof window.authProCtx?.refreshSyncDot === 'function') {
            window.authProCtx.refreshSyncDot();
          }
          if (typeof window.authProCtx?.doSync === 'function') {
            window.authProCtx.doSync(false);
          }
        }
      }
    });
  }

  // Detect active tab and offer 1-tap 2FA autofill
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) return;
      try {
        const url = new URL(tab.url);
        const host = url.hostname.toLowerCase();

        // Skip internal chrome/edge pages
        if (host.startsWith('chrome') || host.startsWith('edge') || host === 'newtab') return;

        const vault = loadVault();
        if (!vault.accounts || !vault.accounts.length) return;

        // Domain matching dictionary for common 2FA platforms
        const domainMap = {
          'github.com': 'github',
          'google.com': 'google',
          'accounts.google.com': 'google',
          'binance.com': 'binance',
          'microsoft.com': 'microsoft',
          'live.com': 'microsoft',
          'discord.com': 'discord',
          'telegram.org': 'telegram',
          'web.telegram.org': 'telegram',
          'facebook.com': 'facebook',
          'meta.com': 'meta',
          'x.com': 'x',
          'twitter.com': 'twitter',
          'amazon.com': 'amazon',
          'aws.amazon.com': 'aws',
          'steampowered.com': 'steam',
        };

        const targetKey = Object.keys(domainMap).find((k) => host.includes(k));
        const matchedBrand = targetKey ? domainMap[targetKey] : null;

        const matched = vault.accounts.find((a) => {
          const iss = (a.issuer || '').toLowerCase();
          const name = (a.name || '').toLowerCase();
          if (matchedBrand && (iss.includes(matchedBrand) || name.includes(matchedBrand))) return true;
          return host.includes(iss) || (iss && host.includes(iss.replace(/\s+/g, '')));
        });

        if (matched) {
          const banner = document.getElementById('activeTabBanner');
          const title = document.getElementById('atbTitle');
          const sub = document.getElementById('atbSub');
          const fillBtn = document.getElementById('atbFillBtn');

          if (banner && title && fillBtn) {
            banner.classList.remove('hidden');
            const accName = matched.issuer || matched.name;
            title.textContent = `🎯 ${accName} সনাক্ত হয়েছে!`;
            sub.textContent = matched.name && matched.name !== accName ? `${matched.name} (কোড প্রস্তুত)` : '1-ক্লিকে কোড পেস্ট করুন';

            fillBtn.onclick = async () => {
              const code = await generateCode(matched, Date.now());
              await copyText(code);
              if (chrome.scripting && tab.id) {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (c) => {
                    const el = document.activeElement;
                    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                      el.value = c;
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  },
                  args: [code]
                }).catch(() => {});
              }
              toast(`কোড ${code} পেস্ট ও কপি হয়েছে! ⚡`);
            };
          }
        }
      } catch (err) {
        console.warn('Active tab detection note:', err);
      }
    });
  }
});
