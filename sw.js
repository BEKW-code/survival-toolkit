const CACHE_PREFIX = 'survival-toolkit-app-';
const CACHE = CACHE_PREFIX + 'v12';
const scope = new URL(self.registration.scope);
const url = path => new URL(path, scope).href;
const shell = url('index.html');
const staticFiles = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].map(url);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([shell, ...staticFiles].map(path => new Request(path, {cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const path = new URL(request.url);
  if (path.origin !== scope.origin) return;
  if (request.mode === 'navigate' && (path.pathname === scope.pathname || path.pathname === new URL(shell).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request, {cache: 'no-cache', signal: AbortSignal.timeout(5000)});
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put(shell, response.clone()).catch(() => {});
          return response;
        }
        if (response.status < 500) return response;
      } catch {}
      return await cache.match(shell) || Response.error();
    })());
  } else if (staticFiles.includes(path.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(request) || fetch(request);
    })());
  }
});

