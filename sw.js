const CACHE_NAME = 'chord-practice-v21';
const BASE = '/chord_practice';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/style.css',
  BASE + '/js/app.js',
  BASE + '/js/audio.js',
  BASE + '/js/chord.js',
  BASE + '/js/notation.js',
  BASE + '/js/staff.js',
  BASE + '/js/vendor/vexflow-bravura.js',
  BASE + '/js/piano-wide.js',
  BASE + '/js/tabs.js',
  BASE + '/js/lookup.js',
  BASE + '/js/knowledge.js',
  BASE + '/js/ios-pwa.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/icons/icon-180.png',
  BASE + '/icons/icon-152.png',
  BASE + '/icons/icon-120.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 只快取 GET 請求；cache.put() 對 POST 等其他方法的請求會直接丟例外
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
