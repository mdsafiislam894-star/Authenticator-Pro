// Google sign-in (Google Identity Services, token model) + Drive appDataFolder backup.
import { GOOGLE_CLIENT_ID, SCOPES, BACKUP_FILE_NAME } from './config.js';

const SESSION_KEY = 'authpro.google.v1';
const CLIENT_OVERRIDE_KEY = 'authpro.clientid.v1';
let tokenClient = null;
let lastClientId = '';
let session = loadSession(); // { token, expiresAt, email, name, picture }

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
function saveSession(s) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function getClientId() {
  const override = (localStorage.getItem(CLIENT_OVERRIDE_KEY) || '').trim();
  if (override && override.includes('.apps.googleusercontent.com')) return override;
  return GOOGLE_CLIENT_ID || '';
}

export function setClientIdOverride(id) {
  const clean = String(id || '').trim();
  if (clean) localStorage.setItem(CLIENT_OVERRIDE_KEY, clean);
  else localStorage.removeItem(CLIENT_OVERRIDE_KEY);
  tokenClient = null;
  lastClientId = '';
}

export const isConfigured = () => {
  const cid = getClientId();
  return !!cid && !cid.startsWith('YOUR_CLIENT_ID');
};
export const getUser = () => (session ? { email: session.email, name: session.name, picture: session.picture } : null);
export const hasValidToken = () => !!session && session.expiresAt > Date.now() + 30000;

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google লোড করা যায়নি (ইন্টারনেট চেক করুন)'));
    document.head.appendChild(s);
  });
}

async function ensureClient() {
  await loadGsi();
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
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error_description || resp.error));
      resolve(resp);
    };
    tokenClient.error_callback = (e) => reject(new Error(e.message || e.type || 'সাইন-ইন বাতিল'));
    tokenClient.requestAccessToken({ prompt, login_hint: session?.email });
  });
}

// interactive=true: shows "Continue with Google" popup. false: silent refresh.
export async function signIn(interactive = true) {
  if (!isConfigured()) throw new Error('Google Client ID এখনো সেট করা হয়নি');
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

export function signOut() {
  if (session?.token && globalThis.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(session.token, () => {});
  }
  saveSession(null);
}

async function authHeader() {
  if (!session) throw new Error('Google সাইন-ইন করা নেই');
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
