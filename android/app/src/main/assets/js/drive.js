// Google sign-in (Google Identity Services + Chrome Identity + OAuth2 Web Bridge) + Drive appDataFolder backup.
import { GOOGLE_CLIENT_ID, SCOPES, BACKUP_FILE_NAME } from './config.js';

export const SESSION_KEY = 'authpro.google.v1';
export const CLIENT_OVERRIDE_KEY = 'authpro.clientid.v1';
export const EXTENSION_ID = 'kkbnfefhgpmcbkelfbchfffdagmifddl';
export const EXTENSION_REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/`;
export const WEB_APP_URL = 'https://mdsafiislam894-star.github.io/Authenticator-Pro/';

let tokenClient = null;
let lastClientId = '';
let session = loadSession(); // { token, expiresAt, email, name, picture }
let gsiPromise = null;
let gsiAvailable = true;

// Check if running inside Chrome/Edge/Brave extension
export function isExtension() {
  return typeof chrome !== 'undefined' && (
    (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') ||
    (typeof chrome.runtime !== 'undefined' && !!chrome.runtime.id)
  );
}

function loadSession() {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// Initial session hydrate from chrome.storage.local if available
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  try {
    chrome.storage.local.get([SESSION_KEY], (res) => {
      if (res?.[SESSION_KEY]) {
        session = res[SESSION_KEY];
        try { globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
      }
    });
  } catch {}
}

export function saveSession(s) {
  session = s;
  if (s) {
    try { globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try { chrome.storage.local.set({ [SESSION_KEY]: s }); } catch {}
    }
  } else {
    try { globalThis.localStorage?.removeItem(SESSION_KEY); } catch {}
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try { chrome.storage.local.remove(SESSION_KEY); } catch {}
    }
  }
}

export function getSession() {
  if (!session) session = loadSession();
  return session;
}

export function getClientId() {
  const override = (globalThis.localStorage?.getItem(CLIENT_OVERRIDE_KEY) || '').trim();
  if (override && override.includes('.apps.googleusercontent.com')) return override;
  return GOOGLE_CLIENT_ID || '';
}

export function setClientIdOverride(id) {
  const clean = String(id || '').trim();
  if (clean) {
    try { globalThis.localStorage?.setItem(CLIENT_OVERRIDE_KEY, clean); } catch {}
  } else {
    try { globalThis.localStorage?.removeItem(CLIENT_OVERRIDE_KEY); } catch {}
  }
  tokenClient = null;
  lastClientId = '';
}

export const isConfigured = () => {
  const cid = getClientId();
  return !!cid && !cid.startsWith('YOUR_CLIENT_ID');
};

export const getUser = () => {
  const s = getSession();
  return s ? { email: s.email, name: s.name, picture: s.picture } : null;
};

export const hasValidToken = () => {
  const s = getSession();
  return !!s && s.expiresAt > Date.now() + 30000;
};

// Safe GSI loader: in extension or adblocker environment, does NOT throw fatal error
function loadGsi() {
  if (isExtension()) {
    // In Manifest V3 extensions, remote scripts are blocked by CSP.
    gsiAvailable = false;
    return Promise.resolve(false);
  }
  if (globalThis.google?.accounts?.oauth2) {
    gsiAvailable = true;
    return Promise.resolve(true);
  }
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve) => {
    try {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => {
        gsiAvailable = true;
        resolve(true);
      };
      s.onerror = () => {
        console.warn('Google GSI script blocked or failed to load. Will fallback to Web Auth / OAuth2 popup.');
        gsiAvailable = false;
        resolve(false);
      };
      document.head.appendChild(s);
    } catch {
      gsiAvailable = false;
      resolve(false);
    }
  });
  return gsiPromise;
}

async function ensureClient() {
  await loadGsi();
  if (!globalThis.google?.accounts?.oauth2) return;
  const cid = getClientId();
  if (!tokenClient || lastClientId !== cid) {
    lastClientId = cid;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: SCOPES,
      callback: () => {},
    });
  }
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Google Token Client প্রস্তুত নয়'));
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error_description || resp.error));
      resolve(resp);
    };
    tokenClient.error_callback = (e) => reject(new Error(e.message || e.type || 'সাইন-ইন বাতিল'));
    tokenClient.requestAccessToken({ prompt, login_hint: session?.email });
  });
}

// Open official Web Auth Bridge in browser tab (Zero-config extension auth)
export function openWebAuthBridge() {
  const extId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : EXTENSION_ID;
  const url = `${WEB_APP_URL}?auth_bridge=1&ext_id=${encodeURIComponent(extId)}`;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

// Sign-in handler inside Chrome Extension (Manifest V3)
async function signInInExtension(interactive = true) {
  const cid = getClientId();

  // Primary: chrome.identity.launchWebAuthFlow
  if (typeof chrome !== 'undefined' && chrome.identity?.launchWebAuthFlow) {
    const redirectUri = chrome.identity.getRedirectURL(); // e.g. https://<id>.chromiumapp.org/
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(cid)}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&prompt=${interactive ? 'select_account' : 'none'}`;

    try {
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, (res) => {
          if (chrome.runtime?.lastError) {
            return reject(new Error(chrome.runtime.lastError.message || 'Auth flow failed'));
          }
          if (!res) return reject(new Error('লগইন বাতিল করা হয়েছে'));
          resolve(res);
        });
      });

      const urlObj = new URL(responseUrl);
      const hash = urlObj.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash || urlObj.search);
      const token = params.get('access_token');
      const expiresIn = Number(params.get('expires_in')) || 3600;

      if (token) {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());

        saveSession({
          token,
          expiresAt: Date.now() + expiresIn * 1000,
          email: info.email,
          name: info.name,
          picture: info.picture,
        });
        return getUser();
      }
    } catch (err) {
      console.warn('launchWebAuthFlow exception:', err);
      const msg = err.message || '';
      if (msg.includes('User cancelled') || msg.includes('লগইন বাতিল')) {
        throw new Error('সাইন-ইন বাতিল করা হয়েছে');
      }
      // If redirect_uri_mismatch or not registered, seamlessly open Web Auth Bridge
      openWebAuthBridge();
      throw new Error(`ওয়েব অথ ব্রিজ খোলা হয়েছে! ব্রাউজার ট্যাবে ১-ক্লিকে সাইন-ইন সম্পন্ন করুন 🌐`);
    }
  }

  // Fallback: Launch Web Auth Bridge
  openWebAuthBridge();
  throw new Error(`ওয়েব অথ ব্রিজ খোলা হয়েছে! ব্রাউজার ট্যাবে ১-ক্লিকে সাইন-ইন সম্পন্ন করুন 🌐`);
}

// Fallback OAuth2 popup for Web when GSI script is blocked by ad-blocker
function signInWithOAuthPopup(interactive = true) {
  const cid = getClientId();
  const redirectUri = location.origin + location.pathname;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(cid)}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&prompt=${interactive ? 'select_account' : 'none'}`;

  return new Promise((resolve, reject) => {
    const width = 500, height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(authUrl, 'authpro_google_auth', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      return reject(new Error('পপআপ উইন্ডো ব্লক করা হয়েছে। ব্রাউজারে পপআপ অনুমোদন করুন।'));
    }

    const handler = async (event) => {
      if (event.origin !== location.origin && !event.data?.authpro_token) return;
      if (event.data?.authpro_token) {
        window.removeEventListener('message', handler);
        clearInterval(checkClosed);
        const { token, expiresIn } = event.data;
        try {
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json());
          saveSession({
            token,
            expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000,
            email: info.email,
            name: info.name,
            picture: info.picture,
          });
          resolve(getUser());
        } catch (e) {
          reject(e);
        }
      }
    };
    window.addEventListener('message', handler);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handler);
        const s = loadSession();
        if (s && hasValidToken()) resolve(getUser());
        else reject(new Error('Google সাইন-ইন সম্পন্ন হয়নি'));
      }
    }, 1000);
  });
}

// Main sign-in entry point
export async function signIn(interactive = true) {
  if (!isConfigured()) throw new Error('Google Client ID এখনো সেট করা হয়নি');

  // Case 1: Browser Extension (MV3)
  if (isExtension()) {
    return await signInInExtension(interactive);
  }

  // Case 2: Web with GSI available
  await loadGsi();
  if (gsiAvailable && globalThis.google?.accounts?.oauth2) {
    await ensureClient();
    const resp = await requestToken(interactive ? 'select_account' : '');
    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${resp.access_token}` },
    }).then((r) => r.json());
    saveSession({
      token: resp.access_token,
      expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
      email: info.email,
      name: info.name,
      picture: info.picture,
    });
    return getUser();
  }

  // Case 3: Web fallback (Adblocker / GSI script blocked)
  return await signInWithOAuthPopup(interactive);
}

export function signOut() {
  const s = getSession();
  if (s?.token && globalThis.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(s.token, () => {}); } catch {}
  }
  saveSession(null);
}

async function authHeader() {
  const s = getSession();
  if (!s) throw new Error('Google সাইন-ইন করা নেই');
  if (!hasValidToken()) {
    try { await signIn(false); } catch { throw new Error('সেশন শেষ — আবার Google দিয়ে সাইন-ইন করুন'); }
  }
  return { Authorization: `Bearer ${session.token}` };
}

async function findBackup() {
  const q = encodeURIComponent(`name='${BACKUP_FILE_NAME}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`;
  const r = await fetch(url, { headers: await authHeader() });
  if (!r.ok) throw new Error('Drive অ্যাক্সেস ব্যর্থ (' + r.status + ')');
  const { files } = await r.json();
  return files?.[0] || null;
}

export async function downloadBackup() {
  const f = await findBackup();
  if (!f) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, { headers: await authHeader() });
  if (!r.ok) throw new Error('ব্যাকআপ ডাউনলোড ব্যর্থ (' + r.status + ')');
  return { envelope: await r.json(), modifiedTime: f.modifiedTime };
}

export async function uploadBackup(envelope) {
  const existing = await findBackup();
  const boundary = 'authpro' + Math.random().toString(36).slice(2);
  const meta = existing ? {} : { name: BACKUP_FILE_NAME, parents: ['appDataFolder'] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(envelope)}\r\n--${boundary}--`;
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const r = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { ...(await authHeader()), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error('ব্যাকআপ আপলোড ব্যর্থ (' + r.status + ')');
  return r.json();
}
