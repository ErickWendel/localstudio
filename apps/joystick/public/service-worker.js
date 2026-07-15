const joystickShellCacheName = 'localstudio-joystick-shell-v1';
const joystickShellPaths = [
  '',
  'manifest.webmanifest',
  'icon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'maskable-icon-512.png',
];

function getScopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(joystickShellCacheName)
      .then((cache) => cache.addAll(joystickShellPaths.map(getScopedUrl)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== joystickShellCacheName)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetchAndCache(request, getScopedUrl('')));
    return;
  }

  if (!isStaticJoystickAsset(request)) return;
  event.respondWith(cacheFirst(request));
});

function isStaticJoystickAsset(request) {
  const destination = request.destination;
  return (
    destination === 'font' ||
    destination === 'image' ||
    destination === 'manifest' ||
    destination === 'script' ||
    destination === 'style' ||
    destination === 'worker'
  );
}

async function fetchAndCache(request, fallbackUrl) {
  const cache = await caches.open(joystickShellCacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(fallbackUrl)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(joystickShellCacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
