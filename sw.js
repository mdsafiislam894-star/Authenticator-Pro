// Offline-first Service Worker with clean versioned updates (supports one-tap in-app update).
const CACHE = 'authpro-v3.0.0';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/otp.js', 'js/migration.js', 'js/crypto.js', 'js/store.js', 'js/config.js',
  'js/drive.js', 'js/sync.js', 'js/scanner.js', 'js/ui.js',
  'js/dialogs-add.js', 'js/dialogs-manage.js', 'js/dialogs-settings.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !cdn) return; // Google APIs etc: never cache

  // stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fetching = fetch(e.request).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
