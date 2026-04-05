const CACHE_NAME = 'jurnal-it-rsby-v1';

// Install Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activated');
});

// Fetching (Online First - karena ini aplikasi internal server)
self.addEventListener('fetch', event => {
    // Biarkan request lewat tanpa cache biar data selalu real-time
    event.respondWith(fetch(event.request));
});