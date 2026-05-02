// ============================================================
// IT Support Log — Service Worker v4.0
// Strategy: Cache-First assets, Network-First data, Offline Queue
// ============================================================

const CACHE_NAME = 'itlog-rsby-v5';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
    '/',
    '/kerja',
    '/aset',
    '/aset-public',
    '/offline.html',
    '/manifest.json',
    '/favicon.ico',
    '/favicon.svg',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                STATIC_ASSETS.map(url =>
                    cache.add(url).catch(err =>
                        console.warn('[SW] Gagal cache:', url, err.message)
                    )
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET — biarkan network handle langsung
    if (request.method !== 'GET') return;

    // API — network first, fallback JSON offline
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Upload/foto — selalu network
    if (url.pathname.startsWith('/uploads/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // CDN (Bootstrap dll) — cache first
    if (url.hostname.includes('jsdelivr') || url.hostname.includes('cdn.')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Icon/favicon — cache first
    if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/favicon')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Semua halaman — network first, fallback cache, fallback offline
    event.respondWith(networkFirstWithOfflineFallback(request));
});

// ============================================================
// STRATEGI FETCH
// ============================================================

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type !== 'opaque') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline - asset tidak tersedia', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ error: 'Offline', offline: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

async function networkFirstWithOfflineFallback(request) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
            const offlinePage = await caches.match(OFFLINE_URL);
            if (offlinePage) return offlinePage;
        }

        return new Response('Offline', { status: 503 });
    }
}

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-jurnal-queue') {
        event.waitUntil(notifyClientsToSync());
    }
});

async function notifyClientsToSync() {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'PROCESS_QUEUE' }));
}

// ============================================================
// ONLINE/OFFLINE NOTIFICATION ke client
// ============================================================
self.addEventListener('message', event => {
    if (!event.data) return;

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Client minta SW update cache halaman tertentu
    if (event.data.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
        caches.open(CACHE_NAME).then(cache => {
            event.data.urls.forEach(url => cache.add(url).catch(() => {}));
        });
    }
});
