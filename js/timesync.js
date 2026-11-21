// High-Precision Network Time Sync & Clock Drift Auto-Correction Engine
// Automatically corrects TOTP calculation if device clock is skewed.

const TIME_DRIFT_KEY = 'authpro.timedrift.v1';
let cachedDriftMs = Number(localStorage.getItem(TIME_DRIFT_KEY)) || 0;
let lastSyncTimestamp = 0;

export function getClockDriftMs() {
  return cachedDriftMs;
}

export function getCorrectedNow() {
  return Date.now() + cachedDriftMs;
}

export async function syncNetworkTime() {
  const startLocal = Date.now();
  try {
    // Query high-reliability UTC time endpoint with fallback
    const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    const roundTrip = Date.now() - startLocal;
    if (!res.ok) throw new Error('সার্ভার রেসপন্স দেয়নি');

    const data = await res.json();
    const serverMs = new Date(data.utc_datetime).getTime();
    // Compensate for half round-trip network latency
    const estimatedServerNow = serverMs + Math.round(roundTrip / 2);
    const measuredDrift = estimatedServerNow - Date.now();

    cachedDriftMs = measuredDrift;
    lastSyncTimestamp = Date.now();
    localStorage.setItem(TIME_DRIFT_KEY, String(measuredDrift));

    return {
      success: true,
      driftMs: measuredDrift,
      driftSec: (measuredDrift / 1000).toFixed(2),
      roundTripMs: roundTrip,
      lastSync: lastSyncTimestamp,
    };
  } catch {
    // Fallback: check Date header from GitHub Pages origin
    try {
      const headRes = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
      const dateHeader = headRes.headers.get('date');
      if (dateHeader) {
        const serverMs = new Date(dateHeader).getTime();
        const measuredDrift = serverMs - Date.now();
        cachedDriftMs = measuredDrift;
        lastSyncTimestamp = Date.now();
        localStorage.setItem(TIME_DRIFT_KEY, String(measuredDrift));
        return {
          success: true,
          driftMs: measuredDrift,
          driftSec: (measuredDrift / 1000).toFixed(2),
          roundTripMs: Date.now() - startLocal,
          lastSync: lastSyncTimestamp,
        };
      }
    } catch {}

    return {
      success: false,
      driftMs: cachedDriftMs,
      driftSec: (cachedDriftMs / 1000).toFixed(2),
      lastSync: lastSyncTimestamp,
      error: 'ইন্টারনেট কানেকশন চেক করুন',
    };
  }
}
