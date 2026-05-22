const CACHE_NAME = 'colab-esports-cache-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/colab_esport_logo.png',
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so this SW activates immediately without waiting for old tabs to close
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      // addAll will fail if ANY request fails, so use individual adds for resilience
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    })
  );
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Take control of all open pages immediately (critical for PWA install prompt)
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      ),
      // Claim all clients so pages don't need to reload
      self.clients.claim(),
    ])
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Don't intercept requests to external origins (APIs, CDNs, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: Network-first so fresh HTML is always served
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest navigation response
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static assets: Cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});
