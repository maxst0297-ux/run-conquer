const CACHE_NAME = 'runconquer-v213';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/bg-poster.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // All HTML + navigation → network-first so updates go live instantly
  const isNav = e.request.mode === 'navigate' ||
    url.pathname === '/' || url.pathname.endsWith('.html');

  if (isNav) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // All other same-origin GETs → cache-first, update in background.
  // Große Medien (Video) NICHT in den Cache legen (Quota) und Range-Requests
  // durchreichen. fromNetwork bekommt ein .catch, damit ein Offline-Fetch bei
  // vorhandenem Cache-Treffer keine unhandled rejection wirft.
  const isMedia = /\.(mp4|mov|webm|m4a|mp3)$/i.test(url.pathname);
  if (isMedia || e.request.headers.has('range')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fromNetwork = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fromNetwork;
    })
  );
});
