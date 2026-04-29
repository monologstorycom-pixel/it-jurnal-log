// ============================================================
// IT Support Log — Service Worker v3.0
// Strategy: Cache-First untuk assets, Network-First untuk data
// ============================================================

const CACHE_NAME = 'itlog-rsby-v4';
const OFFLINE_URL = '/offline.html';

// Assets yang di-cache agar offline tetap bisa buka halaman
const STATIC_ASSETS = [
    '/',
    '/kerja',
    '/aset',
    '/aset-public',
    '/offline.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    '/manifest.json'
];

// ============================================================
// INSTALL — cache static assets
// ============================================================
self.addEventListener('install', event => {
    console.log('[SW] Installing v3...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache satu-satu agar gagal 1 tidak gagal semua
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(err => {
                    console.warn('[SW] Gagal cache:', url, err.message);
                }))
            );
        }).then(() => {
            console.log('[SW] Install selesai');
            return self.skipWaiting();
        })
    );
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', event => {
    console.log('[SW] Activating v3...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Hapus cache lama:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// FETCH — strategi per request
// ============================================================
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (POST/form submit) — biarkan lewat
    // Tapi kalau offline, tidak perlu handle di sini
    // IndexedDB queue dihandle di client side
    if (request.method !== 'GET') {
        return; // Biarkan network handle, gagal = client tangkap
    }

    // API notes — network first, no cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Upload files — selalu network
    if (url.pathname.startsWith('/uploads/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // CDN assets (Bootstrap) — cache first
    if (url.hostname.includes('jsdelivr') || url.hostname.includes('cdn.')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Halaman utama — network first, fallback ke cache, fallback ke offline
    event.respondWith(networkFirstWithOfflineFallback(request));
});

// ============================================================
// STRATEGI FETCH
// ============================================================

// Cache First — untuk static assets CDN
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
    } catch (err) {
        return new Response('Offline - Asset tidak tersedia', { status: 503 });
    }
}

// Network First — untuk API dan data dinamis
async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Network First + Offline Page fallback
async function networkFirstWithOfflineFallback(request) {
    try {
        const response = await fetch(request);
        // Update cache kalau berhasil
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Coba cache dulu
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fallback ke offline page kalau navigate
        if (request.mode === 'navigate') {
            const offlinePage = await caches.match('/offline.html');
            if (offlinePage) return offlinePage;
        }

        return new Response('Offline', { status: 503 });
    }
}

// ============================================================
// BACKGROUND SYNC — proses queue saat online
// ============================================================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-jurnal-queue') {
        console.log('[SW] Background sync: sync-jurnal-queue');
        event.waitUntil(processQueueFromSW());
    }
});

// Kirim pesan ke semua client untuk proses queue
async function processQueueFromSW() {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
        client.postMessage({ type: 'PROCESS_QUEUE' });
    });
}

// ============================================================
// MESSAGE dari client
// ============================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
