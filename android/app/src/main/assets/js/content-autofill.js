// Authenticator Pro - Smart 2FA Auto-Detection & Auto-Fill Content Script
// Automatically scans web pages for 2FA/OTP challenge fields, identifies the target account
// via domain and page text/email analysis, and seamlessly fills the verified code.

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__authProAutofillInjected) return;
  window.__authProAutofillInjected = true;

  let lastFilledTime = 0;
  let lastFilledField = null;

  // Common OTP field selector patterns
  const OTP_INPUT_SELECTORS = [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[name*="totp" i]',
    'input[name*="2fa" i]',
    'input[name*="two_factor" i]',
    'input[name*="twofactor" i]',
    'input[name*="passcode" i]',
    'input[name*="auth_code" i]',
    'input[name*="verification_code" i]',
    'input[name*="security_code" i]',
    'input[name*="pin" i]',
    'input[id*="otp" i]',
    'input[id*="totp" i]',
    'input[id*="2fa" i]',
    'input[id*="two-factor" i]',
    'input[id*="passcode" i]',
    'input[id*="verification-code" i]',
    'input[id*="app_totp" i]',
    'input[id*="idvPin" i]',
    'input[data-testid*="otp" i]',
    'input[data-testid*="totp" i]',
    'input[placeholder*="6-digit" i]',
    'input[placeholder*="verification code" i]',
    'input[placeholder*="authenticator" i]',
    'input[placeholder*="কোড" i]'
  ];

  // Helper: Find 2FA OTP input field(s) on the current page
  function findOtpFields() {
    // 1. Direct selector match
    for (const sel of OTP_INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !el.disabled && !el.readOnly) {
        return { type: 'single', input: el };
      }
    }

    // 2. Check for modern 6-box individual digit inputs (Binance, Google, etc.)
    const singleDigitInputs = Array.from(document.querySelectorAll('input[maxlength="1"], input[size="1"]'))
      .filter(el => isVisible(el) && !el.disabled && !el.readOnly);
    if (singleDigitInputs.length >= 6) {
      // Find a group of 6 consecutive inputs in the same parent/container
      for (let i = 0; i <= singleDigitInputs.length - 6; i++) {
        const slice = singleDigitInputs.slice(i, i + 6);
        const parent = slice[0].parentElement;
        if (slice.every(inp => inp.parentElement === parent || inp.closest('form') === slice[0].closest('form'))) {
          return { type: 'split6', inputs: slice };
        }
      }
    }

    // 3. Fallback: Search for numeric text input inside a 2FA-related form
    const forms = Array.from(document.querySelectorAll('form, [role="form"], [data-testid*="challenge" i], [class*="challenge" i]'));
    for (const form of forms) {
      const text = form.innerText.toLowerCase();
      if (text.includes('two-factor') || text.includes('2fa') || text.includes('authenticator') || text.includes('verification code') || text.includes('security code')) {
        const textInputs = Array.from(form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], input:not([type])'))
          .filter(el => isVisible(el) && !el.disabled && !el.readOnly && el.type !== 'hidden');
        if (textInputs.length === 1) {
          return { type: 'single', input: textInputs[0] };
        }
      }
    }

    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  // Extract page context: found emails, usernames, and domain
  function extractPageContext() {
    const hostname = window.location.hostname.toLowerCase();
    const bodyText = (document.body ? document.body.innerText : '') || '';

    // Extract all email addresses visible on the page
    const emailMatches = Array.from(new Set(bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))
      .map(e => e.toLowerCase());

    // Extract common username elements (GitHub user-login, Google profile email, etc.)
    const userSnippets = [];
    const metaLogin = document.querySelector('meta[name="user-login"]')?.getAttribute('content');
    if (metaLogin) userSnippets.push(metaLogin.toLowerCase());

    const googleIdentifier = document.querySelector('#profileIdentifier, [data-email], [data-identifier]')?.innerText;
    if (googleIdentifier) userSnippets.push(googleIdentifier.trim().toLowerCase());

    const githubUser = document.querySelector('.header-nav-current-user strong, [data-login]')?.innerText;
    if (githubUser) userSnippets.push(githubUser.trim().toLowerCase());

    return {
      domain: hostname,
      url: window.location.href,
      pageEmails: emailMatches,
      pageUsernames: userSnippets,
      title: document.title
    };
  }

  // Trigger input, change, and key events so reactive frameworks (React, Vue, Angular) register the fill
  function simulateUserInput(element, text) {
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }

  // Display floating Luxury Glass badge to notify the user
  function showFloatingBadge(accountName, code) {
    const existing = document.getElementById('authpro-autofill-pill');
    if (existing) existing.remove();

    const pill = document.createElement('div');
    pill.id = 'authpro-autofill-pill';
    pill.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: linear-gradient(135deg, rgba(6, 18, 38, 0.94), rgba(2, 28, 20, 0.94));
      color: #ffffff;
      border: 1px solid rgba(16, 185, 129, 0.55);
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 0 16px rgba(16, 185, 129, 0.35);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      cursor: pointer;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      animation: authProSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transition: opacity 0.3s, transform 0.3s;
    `;

    pill.innerHTML = `
      <style>
        @keyframes authProSlideIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      </style>
      <div style="width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.2);display:grid;place-items:center;font-size:16px;">🛡️</div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="font-weight:700;font-size:12.5px;color:#34d399;display:flex;align-items:center;gap:6px;">
          <span>Authenticator Pro</span>
          <span style="font-size:10px;padding:1px 5px;background:rgba(16,185,129,0.25);border-radius:4px;color:#a7f3d0;">অটোফিল্ড ✓</span>
        </div>
        <div style="font-size:11.5px;color:#e2e8f0;">
          <b>${escapeHtml(accountName)}</b> কোড স্বয়ংক্রিয়ভাবে বসানো হয়েছে!
        </div>
      </div>
      <button style="background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;padding:0 4px;margin-left:4px;" title="বন্ধ করুন">✕</button>
    `;

    pill.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      pill.style.opacity = '0';
      pill.style.transform = 'translateY(-10px)';
      setTimeout(() => pill.remove(), 300);
    };

    document.body.appendChild(pill);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      if (pill.parentElement) {
        pill.style.opacity = '0';
        pill.style.transform = 'translateY(-10px)';
        setTimeout(() => pill.remove(), 300);
      }
    }, 4000);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Attempt autofill
  async function attemptAutofill() {
    const now = Date.now();
    if (now - lastFilledTime < 5000) return; // Prevent loop

    const target = findOtpFields();
    if (!target) return;

    // Check if input is already filled
    if (target.type === 'single' && target.input.value && target.input.value.length >= 6) {
      return;
    }
    if (target.type === 'split6' && target.inputs.every(i => i.value)) {
      return;
    }

    const context = extractPageContext();

    try {
      chrome.runtime.sendMessage({
        type: 'AUTOFILL_DETECT',
        context: context
      }, (response) => {
        if (!response || !response.matched || !response.code) return;

        lastFilledTime = Date.now();

        // Perform the fill
        if (target.type === 'single') {
          simulateUserInput(target.input, response.code);
          lastFilledField = target.input;
          highlightInput(target.input);
        } else if (target.type === 'split6') {
          for (let i = 0; i < Math.min(target.inputs.length, response.code.length); i++) {
            simulateUserInput(target.inputs[i], response.code[i]);
          }
          lastFilledField = target.inputs[0];
          highlightInput(target.inputs[0].parentElement || target.inputs[0]);
        }

        showFloatingBadge(response.accountName || '2FA', response.code);
      });
    } catch (e) {
      // Chrome runtime disconnected or page unloading
    }
  }

  function highlightInput(el) {
    if (!el) return;
    const oldTransition = el.style.transition;
    const oldBoxShadow = el.style.boxShadow;
    el.style.transition = 'box-shadow 0.3s ease-out';
    el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.6), 0 0 16px rgba(16, 185, 129, 0.4)';
    setTimeout(() => {
      el.style.boxShadow = oldBoxShadow;
      el.style.transition = oldTransition;
    }, 2000);
  }

  // Initial check on page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(attemptAutofill, 400);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(attemptAutofill, 400));
  }

  // Observe dynamically loaded challenge forms (SPAs: Google, GitHub, etc.)
  let mutationTimeout = null;
  const observer = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(attemptAutofill, 600);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();
