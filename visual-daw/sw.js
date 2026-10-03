/* SoundPrint Visual DAW — minimal cache-first service worker */
const CACHE = 'soundprint-v2';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'audio-engine.js',
  'sequencer.js',
  'visualizer.js',
  'sign-language.js',
  'midi-follow.js',
  'session-view.js',
  'voices/house-voices.js',
  'voices/dnb-voices.js',
  'voices/downtempo-voices.js',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./'));
    })
  );
});
