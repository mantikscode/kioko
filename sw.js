const CACHE_NAME = 'kioko-shell-v1';
const APP_SHELL = [
    './',
    './index.html',
    './search-results.html',
    './style.css',
    './main.js',
    './search-results.js',
    './manifest.webmanifest',
    './images/favicon.svg'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(key) {
                return key !== CACHE_NAME;
            }).map(function(key) {
                return caches.delete(key);
            }));
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })
    );
});
