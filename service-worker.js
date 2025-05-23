// service-worker.js
const CACHE_NAME = 'gocyberchef-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css', // Added style.css
  '/script.js', // Added script.js
  '/wasm_exec.js',
  '/js_worker.js',
  '/main.wasm',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
  // Add other static assets like CSS files or images if you have them
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
