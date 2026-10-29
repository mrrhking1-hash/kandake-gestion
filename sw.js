/* Kandake Gestion - service worker
 * L'application est une SPA (routage par hash) servie par un shell unique.
 *
 * Stratégies :
 *   - navigations  : réseau d'abord, shell en cache en secours, page hors-ligne au pire cas
 *   - assets locaux: cache-first + revalidation en arrière-plan (stale-while-revalidate)
 *   - CDN / polices / photos : cache-first au runtime (indispensable, le Tailwind CDN
 *     et Google Fonts sont chargés à l'exécution : sans cache l'app est illisible hors-ligne)
 */

const VERSION = 'v32';
const SHELL_CACHE = `kandake-shell-${VERSION}`;
const RUNTIME_CACHE = `kandake-runtime-${VERSION}`;
const OFFLINE_URL = 'hors-ligne.html';
const SHELL_URL = 'index.html';

const SHELL_ASSETS = [
  './',
  'index.html',
  OFFLINE_URL,
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/router.js',
  'js/pull-refresh.js',
  'js/tailwind-config.js',
  'views/accueil.html',
  'views/stocks.html',
  'views/caisse.html',
  'views/ventes.html',
  'views/finances.html',
  'views/reglages.html',
  'views/connexion.html',
  'js/views/accueil.js',
  'js/views/stocks.js',
  'js/views/caisse.js',
  'js/views/ventes.js',
  'js/views/finances.js',
  'js/views/reglages.js',
  'js/views/connexion.js',
  'icons/favicon.svg',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

const RUNTIME_HOSTS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'lh3.googleusercontent.com'
];

/* ------------------------------------------------------------------ install */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll() is atomic : one 404 would void the whole cache, so add one by one.
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
              console.warn('[sw] precache ignoré :', url, err.message);
            })
          )
        )
      )
  );
});

/* ----------------------------------------------------------------- activate */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/* ------------------------------------------------------------- fetch router */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; let the browser handle POST/PUT natively.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never intercept the SW script itself or range requests (video/pdf).
  if (url.pathname.endsWith('/sw.js')) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* ------------------------------------------------- navigation: network first
 * L'app est une SPA à routage par hash : une navigation ne peut viser qu'un
 * document, le shell. Toute requête de navigation hors-ligne retombe donc sur
 * le shell en cache, et le routeur restaure le bon onglet via le fragment #.
 */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const shell = await cache.match(SHELL_URL);

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    // Hors-ligne : le shell suffit, le routeur lit le hash pour l'onglet.
    if (shell) return shell;

    const offline = await cache.match(absolute(OFFLINE_URL));
    if (offline) return offline;

    return new Response(
      '<!DOCTYPE html><meta charset="utf-8"><title>Hors-ligne</title>' +
        '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
        '<h1>Hors-ligne</h1><p>Application non install\u00e9e sur cet appareil.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function absolute(href) {
  return new URL(href, self.location.href).href;
}

/* ------------------------------------------------------------ cache helpers */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    // Opaque (no-cors) responses are storable but must be passed through as-is.
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Hors-ligne' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;

  return new Response('', { status: 504, statusText: 'Ressource indisponible hors-ligne' });
}