/*
 * Service worker de EscuchaInterna (v3 §8).
 * Estrategia conservadora: la app es local-first, así que el SW existe para
 * dar instalabilidad (PWA) y una página offline amable.
 *  - Precache mínimo de estáticos propios (offline, manifest, logo, iconos).
 *  - Navegaciones: red primero; si falla, fallback a /offline.html.
 *  - /_next/static (inmutable por hash de build): cache-first.
 *  - NUNCA se cachean respuestas de datos (server actions, /api, páginas).
 */
const CACHE_NAME = 'escuchainterna-static-v1';
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Solo estáticos inmutables o precacheados; jamás datos. */
function isCacheableStatic(url) {
  if (url.origin !== self.location.origin) return false;
  if (PRECACHE_URLS.includes(url.pathname)) return true;
  return url.pathname.startsWith('/_next/static/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red primero, fallback offline amable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then(
          (cached) =>
            cached ??
            new Response('Sin conexión', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }),
        ),
      ),
    );
    return;
  }

  // Estáticos: cache-first con relleno perezoso.
  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Cualquier otra petición (datos, API, RSC) pasa directa a la red.
});
