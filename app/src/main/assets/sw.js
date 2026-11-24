const APP_CACHE = 'mohammed-quran-app-v18';
const DATA_CACHE = 'mohammed-quran-data-v18';
const APP_FILES = ['./', './index.html', './app.js', './app.js?v=13', './manifest.json', './icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      ![APP_CACHE, DATA_CACHE].includes(name)
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await cache.match('./index.html')) || Response.error();
        }
        return Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
