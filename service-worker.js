const CACHE_VERSION = 'v3';
const STATIC_CACHE = 'static-' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([
      '/',
      '/index.html',
      '/login.html',
      '/admin/login.html',
      OFFLINE_URL,
      '/styles.css',
      '/assets/wave-poster.svg'
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if (k.startsWith('static-') && k !== STATIC_CACHE) return caches.delete(k);
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const proto = url.protocol;
  const isHttp = proto === 'http:' || proto === 'https:';
  if (!isHttp) return;
  const sameOrigin = url.origin === self.location.origin;

  const isDocument = req.mode === 'navigate';
  if (isDocument) {
    event.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.ok && sameOrigin && /^https?:/.test(req.url)) {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(cache => { try { cache.put(req, copy); } catch (e) {} });
        }
        return resp;
      }).catch(() =>
        caches.match(req).then(c => c || caches.match('/index.html').then(ix => ix || caches.match(OFFLINE_URL)))
      )
    );
    return;
  }

  const isStatic = /\.(js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(resp => {
          const copy = resp.clone();
          if (resp.ok && sameOrigin && /^https?:/.test(req.url)) {
            caches.open(STATIC_CACHE).then(cache => { try { cache.put(req, copy); } catch (e) {} });
          }
          return resp;
        }).catch(() => cached)
      )
    );
    return;
  }
});
