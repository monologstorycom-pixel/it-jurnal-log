/**
 * IT Support Log — Offline Sync Module v2.0
 * 
 * Cara kerja:
 * 1. Saat form submit & offline → simpan ke IndexedDB
 * 2. Saat online kembali → proses queue satu-satu ke server
 * 3. Background Sync API (kalau browser support) sebagai backup
 * 
 * GUNAKAN FILE INI: tambahkan <script src="/offline-sync.js"> di admin.ejs
 */

(function() {
    'use strict';

    const DB_NAME    = 'itlog-offline-db';
    const DB_VERSION = 1;
    const STORE_NAME = 'pendingForms';

    let db = null;
    let isSyncing = false;

    // ============================================================
    // INDEXEDDB SETUP
    // ============================================================
    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = function(event) {
                console.error('[OfflineSync] IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ============================================================
    // SIMPAN KE QUEUE
    // ============================================================
    async function saveToQueue(formData, actionUrl) {
        const database = await openDB();

        // Convert FormData ke plain object (tidak bisa store FormData langsung)
        const dataObj = {};
        for (const [key, value] of formData.entries()) {
            // Skip file fields — file tidak bisa disimpan di IndexedDB dengan mudah
            if (value instanceof File) {
                if (value.size > 0) {
                    dataObj[key] = { _isFile: true, name: value.name, size: value.size };
                }
            } else {
                dataObj[key] = value;
            }
        }

        const entry = {
            actionUrl: actionUrl,
            data: dataObj,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0
        };

        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(entry);

            req.onsuccess = function() {
                console.log('[OfflineSync] Data tersimpan ke queue, ID:', req.result);
                resolve(req.result);
                updateQueueBadge();
            };
            req.onerror = function() {
                reject(req.error);
            };
        });
    }

    // ============================================================
    // AMBIL SEMUA QUEUE
    // ============================================================
    async function getQueue() {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();

            req.onsuccess = function() {
                resolve(req.result || []);
            };
            req.onerror = function() {
                reject(req.error);
            };
        });
    }

    // ============================================================
    // HAPUS DARI QUEUE
    // ============================================================
    async function removeFromQueue(id) {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);

            req.onsuccess = function() {
                resolve();
                updateQueueBadge();
            };
            req.onerror = function() {
                reject(req.error);
            };
        });
    }

    // ============================================================
    // UPDATE RETRY COUNT
    // ============================================================
    async function updateRetry(id, retryCount) {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = function() {
                const item = getReq.result;
                if (item) {
                    item.retryCount = retryCount;
                    item.status = 'retrying';
                    const putReq = store.put(item);
                    putReq.onsuccess = () => resolve();
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve();
                }
            };
        });
    }

    // ============================================================
    // PROSES QUEUE — kirim ke server
    // ============================================================
    async function processQueue() {
        if (isSyncing) return;
        if (!navigator.onLine) return;

        const queue = await getQueue();
        if (queue.length === 0) return;

        isSyncing = true;
        showSyncToast('🔄 Menyinkronkan ' + queue.length + ' data offline...');
        console.log('[OfflineSync] Memproses', queue.length, 'item dari queue');

        let successCount = 0;
        let failCount = 0;

        for (const item of queue) {
            try {
                // Convert plain object kembali ke FormData
                const formData = new FormData();
                for (const [key, value] of Object.entries(item.data)) {
                    if (value && value._isFile) {
                        // Skip file fields yang tidak bisa disimpan
                        console.warn('[OfflineSync] Melewati file field:', key);
                    } else {
                        formData.append(key, value || '');
                    }
                }

                const response = await fetch(item.actionUrl, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok || response.redirected) {
                    await removeFromQueue(item.id);
                    successCount++;
                    console.log('[OfflineSync] Berhasil sync item ID:', item.id);
                } else {
                    console.warn('[OfflineSync] Server error untuk item', item.id, ':', response.status);
                    await updateRetry(item.id, (item.retryCount || 0) + 1);
                    failCount++;
                }
            } catch (err) {
                console.error('[OfflineSync] Gagal kirim item', item.id, ':', err.message);
                await updateRetry(item.id, (item.retryCount || 0) + 1);
                failCount++;
            }
        }

        isSyncing = false;

        if (successCount > 0) {
            showSyncToast('✅ ' + successCount + ' data berhasil disinkronkan!', 'success');
            // Reload halaman setelah sync berhasil agar data terbaru tampil
            setTimeout(() => {
                if (window.location.pathname === '/kerja') {
                    window.location.reload();
                }
            }, 2000);
        }

        if (failCount > 0 && successCount === 0) {
            showSyncToast('⚠️ ' + failCount + ' data gagal sync. Akan dicoba lagi.', 'warning');
        }

        updateQueueBadge();
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    // Badge jumlah pending di navbar
    async function updateQueueBadge() {
        try {
            const queue = await getQueue();
            const count = queue.length;

            let badge = document.getElementById('offline-queue-badge');

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.id = 'offline-queue-badge';
                    badge.style.cssText = `
                        display:inline-flex;align-items:center;justify-content:center;
                        background:#fb923c;color:#000;border-radius:50%;
                        width:18px;height:18px;font-size:0.65rem;font-weight:800;
                        position:fixed;top:12px;right:220px;z-index:9999;
                        animation:pulse-badge 1.5s infinite;
                    `;
                    // Tambah animasi
                    if (!document.getElementById('offline-badge-style')) {
                        const style = document.createElement('style');
                        style.id = 'offline-badge-style';
                        style.textContent = `
                            @keyframes pulse-badge {
                                0%,100%{transform:scale(1);opacity:1}
                                50%{transform:scale(1.2);opacity:0.8}
                            }
                        `;
                        document.head.appendChild(style);
                    }
                    document.body.appendChild(badge);
                }
                badge.textContent = count;
                badge.title = count + ' data pending — akan sync saat online';
            } else if (badge) {
                badge.remove();
            }
        } catch (e) {}
    }

    // Toast notification
    function showSyncToast(message, type) {
        type = type || 'info';

        // Hapus toast lama kalau ada
        const existing = document.getElementById('sync-toast-container');
        if (existing) existing.remove();

        const colors = {
            info:    { bg: '#0d2a18', border: '#1a5c30', text: '#4ade80' },
            success: { bg: '#0d2a18', border: '#1a5c30', text: '#4ade80' },
            warning: { bg: '#2a1a0d', border: '#5c3010', text: '#fb923c' },
            error:   { bg: '#2a0d0d', border: '#5c1a1a', text: '#f87171' }
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'sync-toast-container';
        toast.style.cssText = `
            position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
            background:${c.bg};border:1px solid ${c.border};color:${c.text};
            padding:10px 20px;border-radius:8px;font-size:0.83rem;font-weight:700;
            z-index:9999;animation:slideUp 0.3s ease;max-width:380px;text-align:center;
            box-shadow:0 8px 24px rgba(0,0,0,0.4);
        `;

        if (!document.getElementById('sync-toast-style')) {
            const style = document.createElement('style');
            style.id = 'sync-toast-style';
            style.textContent = `
                @keyframes slideUp {
                    from{opacity:0;transform:translateX(-50%) translateY(20px)}
                    to{opacity:1;transform:translateX(-50%) translateY(0)}
                }
            `;
            document.head.appendChild(style);
        }

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // Banner status offline/online
    function showOfflineBanner() {
        let banner = document.getElementById('offline-status-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'offline-status-banner';
            banner.style.cssText = `
                position:fixed;top:52px;left:0;right:0;z-index:998;
                background:#2a1a0d;border-bottom:1px solid #5c3010;
                color:#fb923c;text-align:center;padding:7px;
                font-size:0.78rem;font-weight:700;letter-spacing:0.04em;
            `;
            banner.innerHTML = '📡 OFFLINE MODE — Data form akan disimpan lokal & sync otomatis saat online';
            document.body.appendChild(banner);
        }
    }

    function hideOfflineBanner() {
        const banner = document.getElementById('offline-status-banner');
        if (banner) {
            banner.style.background = '#0d2a18';
            banner.style.borderColor = '#1a5c30';
            banner.style.color = '#4ade80';
            banner.innerHTML = '✅ ONLINE — Menyinkronkan data...';
            setTimeout(() => banner.remove(), 3000);
        }
    }

    // ============================================================
    // INTERCEPT FORM SUBMIT
    // ============================================================
    function interceptForms() {
        // Hanya intercept form /save (tambah jurnal baru)
        // Edit, hapus, upload foto tidak di-intercept karena kompleks
        document.addEventListener('submit', async function(event) {
            const form = event.target;
            const action = form.getAttribute('action') || form.action || '';

            // Hanya tangkap form /save
            if (!action.includes('/save')) return;

            // Kalau online, biarkan submit normal
            if (navigator.onLine) return;

            // OFFLINE — intercept!
            event.preventDefault();

            const formData = new FormData(form);
            const actionUrl = action.startsWith('/') ? action : '/' + action;

            try {
                await saveToQueue(formData, actionUrl);

                // Reset form
                form.reset();
                // Set tanggal default lagi
                const tglInput = document.getElementById('tanggalInput');
                if (tglInput) tglInput.value = new Date().toISOString().split('T')[0];

                showSyncToast('💾 Data tersimpan offline! Akan sync saat online.', 'warning');
                updateQueueBadge();

                // Daftarkan background sync kalau browser support
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    const sw = await navigator.serviceWorker.ready;
                    await sw.sync.register('sync-jurnal-queue');
                    console.log('[OfflineSync] Background sync terdaftar');
                }

            } catch (err) {
                console.error('[OfflineSync] Gagal simpan ke queue:', err);
                showSyncToast('❌ Gagal simpan offline: ' + err.message, 'error');
            }
        }, true); // capture phase
    }

    // ============================================================
    // EVENT LISTENERS — online/offline
    // ============================================================
    function setupNetworkListeners() {
        window.addEventListener('online', function() {
            console.log('[OfflineSync] Kembali online!');
            hideOfflineBanner();
            // Delay sedikit agar koneksi stabil
            setTimeout(() => processQueue(), 1500);
        });

        window.addEventListener('offline', function() {
            console.log('[OfflineSync] Offline!');
            showOfflineBanner();
        });

        // Terima pesan dari Service Worker untuk proses queue
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', function(event) {
                if (event.data && event.data.type === 'PROCESS_QUEUE') {
                    console.log('[OfflineSync] SW minta proses queue');
                    processQueue();
                }
            });
        }
    }

    // ============================================================
    // INIT
    // ============================================================
    async function init() {
        console.log('[OfflineSync] Inisialisasi...');

        try {
            await openDB();
            console.log('[OfflineSync] IndexedDB siap');
        } catch (e) {
            console.error('[OfflineSync] IndexedDB gagal:', e);
            return; // Berhenti kalau IndexedDB tidak tersedia
        }

        setupNetworkListeners();
        interceptForms();

        // Cek status awal
        if (!navigator.onLine) {
            showOfflineBanner();
        }

        // Update badge saat load
        await updateQueueBadge();

        // Kalau online dan ada queue, proses sekarang
        if (navigator.onLine) {
            const queue = await getQueue();
            if (queue.length > 0) {
                console.log('[OfflineSync] Ada', queue.length, 'item pending, memproses...');
                setTimeout(() => processQueue(), 2000);
            }
        }

        console.log('[OfflineSync] Siap!');
    }

    // Jalankan setelah DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose ke global untuk debugging
    window.__offlineSync = {
        getQueue,
        processQueue,
        clearQueue: async function() {
            const queue = await getQueue();
            for (const item of queue) await removeFromQueue(item.id);
            console.log('[OfflineSync] Queue dibersihkan');
        }
    };

})();
