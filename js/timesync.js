// High-Precision Network Time Sync & Hardware Monotonic Time Lock Engine
// Protects TOTP code generation against manual phone clock adjustments/manipulation.

const TIME_LOCK_KEY = 'authpro.timelock.v2';

let anchorUtcMs = 0;
let anchorPerfMs = 0;
let isLocked = false;
let lastSyncTimestamp = 0;
let cachedDriftMs = 0;

// Initialize from storage
try {
  const saved = JSON.parse(localStorage.getItem(TIME_LOCK_KEY) || '{}');
  if (saved.cachedDriftMs) cachedDriftMs = Number(saved.cachedDriftMs) || 0;
  if (saved.lastSyncTimestamp) lastSyncTimestamp = Number(saved.lastSyncTimestamp) || 0;
} catch {}

export function isTimeLockActive() {
  return isLocked;
}

export function getClockDriftMs() {
  return cachedDriftMs;
}

export function getTimeLockInfo() {
  return {
    isLocked,
    cachedDriftMs,
    driftSec: (cachedDriftMs / 1000).toFixed(2),
    lastSyncTimestamp,
    realNowIso: new Date(getCorrectedNow()).toISOString(),
  };
}

// Lock time to true UTC using monotonic performance.now()
// Changing phone system clock will have ZERO effect on TOTP while locked.
export function lockTimeToUtc(utcMs) {
  if (!utcMs || typeof utcMs !== 'number') return;
  anchorUtcMs = utcMs;
  anchorPerfMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  cachedDriftMs = utcMs - Date.now();
  isLocked = true;
  lastSyncTimestamp = Date.now();

  try {
    localStorage.setItem(TIME_LOCK_KEY, JSON.stringify({
      cachedDriftMs,
      lastSyncTimestamp,
      lockedAtUtc: utcMs,
    }));
  } catch {}
}

export function getCorrectedNow() {
  if (isLocked && anchorUtcMs && typeof performance !== 'undefined' && performance.now) {
    const elapsed = performance.now() - anchorPerfMs;
    return anchorUtcMs + elapsed;
  }
  return Date.now() + cachedDriftMs;
}

// Fetch real network UTC time and lock the monotonic anchor
export async function syncNetworkTime() {
  const startLocal = Date.now();
  try {
    // 1. Query high-precision UTC time API
    const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    const roundTrip = Date.now() - startLocal;
    if (!res.ok) throw new Error('API রেসপন্স দেয়নি');

    const data = await res.json();
    const serverMs = new Date(data.utc_datetime).getTime();
    // Compensate for half round-trip latency
    const estimatedServerNow = serverMs + Math.round(roundTrip / 2);

    lockTimeToUtc(estimatedServerNow);

    return {
      success: true,
      driftMs: cachedDriftMs,
      driftSec: (cachedDriftMs / 1000).toFixed(2),
      roundTripMs: roundTrip,
      lastSync: lastSyncTimestamp,
      isLocked: true,
    };
  } catch {
    // 2. Fallback: inspect HTTP response Date header from current host
    try {
      const headRes = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
      const dateHeader = headRes.headers.get('date');
      if (dateHeader) {
        const serverMs = new Date(dateHeader).getTime();
        const roundTrip = Date.now() - startLocal;
        const estimatedServerNow = serverMs + Math.round(roundTrip / 2);

        lockTimeToUtc(estimatedServerNow);

        return {
          success: true,
          driftMs: cachedDriftMs,
          driftSec: (cachedDriftMs / 1000).toFixed(2),
          roundTripMs: roundTrip,
          lastSync: lastSyncTimestamp,
          isLocked: true,
        };
      }
    } catch {}

    return {
      success: false,
      driftMs: cachedDriftMs,
      driftSec: (cachedDriftMs / 1000).toFixed(2),
      lastSync: lastSyncTimestamp,
      isLocked,
      error: 'ইন্টারনেট কানেকশন চেক করুন',
    };
  }
}
