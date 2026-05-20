/* ailatest-journal service worker
   Strategy:
   - app shell (HTML/CSS/JS): network-first, cache fallback
   - icons/manifest: stale-while-revalidate
   - data JSON: network-first, cache fallback (so updates win, offline still works)
   - everything else: network only
*/
const VERSION = 'v20260520-20';
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isData(url) {
  return url.pathname.startsWith('/data/') && url.pathname.endsWith('.json');
}
function isShell(url) {
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return true;
  if (url.pathname.startsWith('/css/')) return true;
  if (url.pathname.startsWith('/js/')) return true;
  return false;
}
function isStaticAsset(url) {
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname === '/manifest.json') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;         // skip GA / fonts / CDN
  if (req.headers.get('range')) return;               // partial requests bypass

  if (isData(url)) {
    // network-first → cache fallback
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(req).then((r) => r || Response.error()))
    );
    return;
  }

  if (isShell(url)) {
    // network-first for HTML/CSS/JS so a stale app.js cannot keep old auth endpoints alive.
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(req).then((r) => r || Response.error()))
    );
    return;
  }

  if (isStaticAsset(url)) {
    // stale-while-revalidate is fine for icons and the manifest.
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
