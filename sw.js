const CACHE_NAME = 'runconquer-v36';
const PRECACHE = ['/', '/index.html', '/manifest.json'];

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

  // All other same-origin GETs → cache-first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fromNetwork = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return resp;
      });
      return cached || fromNetwork;
    })
  );
});
