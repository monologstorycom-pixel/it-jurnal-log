/**
 * IT Support Log — Offline Sync Module v3.0
 * - IndexedDB queue untuk form data
 * - Foto support via base64 (FileReader)
 * - Retry limit 5x, hapus otomatis kalau gagal terus
 * - Queue viewer built-in
 * - UI indicator offline yang proper
 */

(function () {
    'use strict';

    const DB_NAME    = 'itlog-offline-db';
    const DB_VERSION = 2; // naik versi karena schema berubah (support foto)
    const STORE_NAME = 'pendingForms';
    const MAX_RETRY  = 5;

    let db        = null;
    let isSyncing = false;

    // ============================================================
    // INDEXEDDB
    // ============================================================
    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) return resolve(db);
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (e) {
                const database = e.target.result;
                // Hapus store lama kalau ada (upgrade dari v1)
                if (database.objectStoreNames.contains(STORE_NAME)) {
                    database.deleteObjectStore(STORE_NAME);
                }
                const store = database.createObjectStore(STORE_NAME, {
                    keyPath: 'id', autoIncrement: true
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('status',    'status',    { unique: false });
            };

            request.onsuccess = e => { db = e.target.result; resolve(db); };
            request.onerror   = e => reject(e.target.error);
        });
    }

    // ============================================================
    // FILE → BASE64
    // ============================================================
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size === 0) return resolve(null);
            const reader = new FileReader();
            reader.onload  = e => resolve({
                _isBase64: true,
                data:      e.target.result, // data:image/...;base64,...
                name:      file.name,
                type:      file.type,
                size:      file.size
            });
            reader.onerror = () => reject(new Error('Gagal baca file'));
            reader.readAsDataURL(file);
        });
    }

    // BASE64 → Blob → File
    function base64ToFile(b64obj) {
        const arr    = b64obj.data.split(',');
        const mime   = arr[0].match(/:(.*?);/)[1];
        const bstr   = atob(arr[1]);
        const n      = bstr.length;
        const u8arr  = new Uint8Array(n);
        for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
        return new File([u8arr], b64obj.name, { type: mime });
    }

    // ============================================================
    // CRUD QUEUE
    // ============================================================
    async function saveToQueue(formData, actionUrl) {
        const database = await openDB();
        const dataObj  = {};

        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                if (value.size > 0) {
                    try {
                        dataObj[key] = await fileToBase64(value);
                        console.log('[OfflineSync] Foto', key, 'tersimpan base64 (', Math.round(value.size/1024), 'KB)');
                    } catch {
                        console.warn('[OfflineSync] Gagal konversi foto:', key);
                    }
                }
            } else {
                dataObj[key] = value;
            }
        }

        const entry = {
            actionUrl,
            data:       dataObj,
            timestamp:  Date.now(),
            status:     'pending',
            retryCount: 0,
            hasPhoto:   Object.values(dataObj).some(v => v && v._isBase64)
        };

        return new Promise((resolve, reject) => {
            const tx    = database.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req   = store.add(entry);
            req.onsuccess = () => { resolve(req.result); updateQueueBadge(); };
            req.onerror   = () => reject(req.error);
        });
    }

    async function getQueue() {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx  = database.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => reject(req.error);
        });
    }

    async function removeFromQueue(id) {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx  = database.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(id);
            req.onsuccess = () => { resolve(); updateQueueBadge(); };
            req.onerror   = () => reject(req.error);
        });
    }

    async function updateItem(id, changes) {
        const database = await openDB();
        return new Promise((resolve, reject) => {
            const tx       = database.transaction(STORE_NAME, 'readwrite');
            const store    = tx.objectStore(STORE_NAME);
            const getReq   = store.get(id);
            getReq.onsuccess = () => {
                const item = getReq.result;
                if (!item) return resolve();
                Object.assign(item, changes);
                const putReq = store.put(item);
                putReq.onsuccess = () => resolve();
                putReq.onerror   = () => reject(putReq.error);
            };
        });
    }

    // ============================================================
    // PROSES QUEUE
    // ============================================================
    async function processQueue() {
        if (isSyncing)         return;
        if (!navigator.onLine) return;

        const queue = await getQueue();
        if (queue.length === 0) return;

        isSyncing = true;
        showToast('🔄 Menyinkronkan ' + queue.length + ' data offline...', 'info');

        let ok = 0, fail = 0;

        for (const item of queue) {
            // Buang item yang sudah melewati batas retry
            if (item.retryCount >= MAX_RETRY) {
                console.warn('[OfflineSync] Item', item.id, 'melewati batas retry, dihapus');
                await removeFromQueue(item.id);
                continue;
            }

            try {
                const formData = new FormData();
                for (const [key, value] of Object.entries(item.data)) {
                    if (value && value._isBase64) {
                        // Konversi base64 kembali ke File
                        formData.append(key, base64ToFile(value), value.name);
                    } else {
                        formData.append(key, value || '');
                    }
                }

                const response = await fetch(item.actionUrl, {
                    method: 'POST',
                    body:   formData
                });

                if (response.ok || response.redirected) {
                    await removeFromQueue(item.id);
                    ok++;
                } else {
                    await updateItem(item.id, {
                        retryCount: item.retryCount + 1,
                        status:     'retrying',
                        lastError:  'HTTP ' + response.status
                    });
                    fail++;
                }
            } catch (err) {
                await updateItem(item.id, {
                    retryCount: item.retryCount + 1,
                    status:     'retrying',
                    lastError:  err.message
                });
                fail++;
            }
        }

        isSyncing = false;

        if (ok > 0) {
            showToast('✅ ' + ok + ' data berhasil disinkronkan!', 'success');
            setTimeout(() => {
                if (window.location.pathname === '/kerja') window.location.reload();
            }, 2000);
        }
        if (fail > 0 && ok === 0) {
            showToast('⚠️ ' + fail + ' data gagal sync, akan dicoba lagi.', 'warning');
        }

        updateQueueBadge();
    }

    // ============================================================
    // UI — BADGE
    // ============================================================
    async function updateQueueBadge() {
        try {
            const queue = await getQueue();
            const count = queue.length;
            let badge   = document.getElementById('offline-queue-badge');

            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.id = 'offline-queue-badge';
                    badge.style.cssText = [
                        'position:fixed',
                        'bottom:72px',
                        'right:16px',
                        'z-index:9998',
                        'background:#fb923c',
                        'color:#000',
                        'border-radius:20px',
                        'padding:6px 12px',
                        'font-size:12px',
                        'font-weight:700',
                        'cursor:pointer',
                        'box-shadow:0 4px 12px rgba(0,0,0,0.4)',
                        'display:flex',
                        'align-items:center',
                        'gap:6px',
                        'font-family:monospace'
                    ].join(';');
                    badge.onclick = showQueueViewer;
                    document.body.appendChild(badge);
                }
                const hasPhoto = queue.some(q => q.hasPhoto);
                badge.innerHTML = '📦 ' + count + ' pending' + (hasPhoto ? ' 📷' : '');
                badge.title     = count + ' data belum tersync — klik untuk lihat';
            } else if (badge) {
                badge.remove();
            }
        } catch (e) {}
    }

    // ============================================================
    // UI — TOAST
    // ============================================================
    function showToast(message, type) {
        type = type || 'info';
        const existing = document.getElementById('sync-toast');
        if (existing) existing.remove();

        const colors = {
            info:    { bg: '#0d2a18', border: '#1a5c30', color: '#4ade80' },
            success: { bg: '#0d2a18', border: '#22c55e', color: '#4ade80' },
            warning: { bg: '#2a1a0d', border: '#f97316', color: '#fb923c' },
            error:   { bg: '#2a0d0d', border: '#ef4444', color: '#f87171' }
        };
        const c     = colors[type] || colors.info;
        const toast = document.createElement('div');
        toast.id    = 'sync-toast';
        toast.style.cssText = [
            'position:fixed',
            'bottom:24px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:' + c.bg,
            'border:1px solid ' + c.border,
            'color:' + c.color,
            'padding:10px 20px',
            'border-radius:8px',
            'font-size:13px',
            'font-weight:700',
            'z-index:9999',
            'max-width:360px',
            'text-align:center',
            'font-family:monospace',
            'box-shadow:0 8px 24px rgba(0,0,0,0.5)'
        ].join(';');
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity    = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // ============================================================
    // UI — OFFLINE BANNER
    // ============================================================
    function showOfflineBanner() {
        let banner = document.getElementById('offline-banner');
        if (banner) return;
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = [
            'position:fixed',
            'top:52px',
            'left:0',
            'right:0',
            'z-index:997',
            'background:#2a1a0d',
            'border-bottom:1px solid #f97316',
            'color:#fb923c',
            'text-align:center',
            'padding:6px',
            'font-size:12px',
            'font-weight:700',
            'letter-spacing:0.05em',
            'font-family:monospace'
        ].join(';');
        banner.innerHTML = '📡 OFFLINE MODE — input tetap bisa, sync otomatis saat online';
        document.body.appendChild(banner);
    }

    function hideOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (!banner) return;
        banner.style.background   = '#0d2a18';
        banner.style.borderColor  = '#22c55e';
        banner.style.color        = '#4ade80';
        banner.innerHTML          = '✅ ONLINE — menyinkronkan data...';
        setTimeout(() => banner.remove(), 3000);
    }

    // ============================================================
    // UI — QUEUE VIEWER
    // ============================================================
    async function showQueueViewer() {
        const existing = document.getElementById('queue-viewer-overlay');
        if (existing) { existing.remove(); return; }

        const queue = await getQueue();

        const overlay = document.createElement('div');
        overlay.id    = 'queue-viewer-overlay';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'background:rgba(0,0,0,0.7)',
            'z-index:10000',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:1rem'
        ].join(';');

        const panel = document.createElement('div');
        panel.style.cssText = [
            'background:#111',
            'border:1px solid #1a3a1a',
            'border-radius:12px',
            'padding:1.5rem',
            'max-width:480px',
            'width:100%',
            'max-height:80vh',
            'overflow-y:auto',
            'font-family:monospace'
        ].join(';');

        const title = document.createElement('div');
        title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;';
        title.innerHTML = [
            '<span style="color:#39ff14;font-weight:700;font-size:14px;">📦 Queue Offline (' + queue.length + ')</span>',
            '<button onclick="document.getElementById(\'queue-viewer-overlay\').remove()" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;">✕</button>'
        ].join('');

        panel.appendChild(title);

        if (queue.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#444;font-size:13px;text-align:center;padding:2rem 0;';
            empty.textContent   = 'Queue kosong — semua data tersync ✅';
            panel.appendChild(empty);
        } else {
            queue.forEach(item => {
                const el = document.createElement('div');
                el.style.cssText = [
                    'background:#0d0d0d',
                    'border:0.5px solid #1a3a1a',
                    'border-radius:8px',
                    'padding:10px 12px',
                    'margin-bottom:8px',
                    'font-size:12px'
                ].join(';');

                const time   = new Date(item.timestamp).toLocaleString('id-ID');
                const fields = Object.keys(item.data).filter(k => !['_token'].includes(k));
                const photos = Object.values(item.data).filter(v => v && v._isBase64);

                el.innerHTML = [
                    '<div style="color:#39ff14;margin-bottom:4px;">ID: ' + item.id + ' &nbsp;|&nbsp; ' + time + '</div>',
                    '<div style="color:#666;margin-bottom:4px;">URL: ' + item.actionUrl + '</div>',
                    '<div style="color:#888;margin-bottom:4px;">Fields: ' + fields.join(', ') + '</div>',
                    photos.length > 0 ? '<div style="color:#fb923c;margin-bottom:4px;">📷 ' + photos.length + ' foto tersimpan (' + photos.map(p => Math.round(p.size/1024) + 'KB').join(', ') + ')</div>' : '',
                    item.retryCount > 0 ? '<div style="color:#f87171;">Retry: ' + item.retryCount + '/' + MAX_RETRY + (item.lastError ? ' — ' + item.lastError : '') + '</div>' : '',
                    '<div style="margin-top:6px;">',
                    '<button onclick="window.__offlineSync.removeItem(' + item.id + ')" style="background:#3a1a1a;border:0.5px solid #ef4444;color:#f87171;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:monospace;">✕ Hapus</button>',
                    '</div>'
                ].join('');

                panel.appendChild(el);
            });

            // Tombol aksi bawah
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:8px;margin-top:1rem;';
            actions.innerHTML = [
                '<button onclick="window.__offlineSync.processQueue();document.getElementById(\'queue-viewer-overlay\').remove();" style="flex:1;background:#0d2a18;border:1px solid #39ff14;color:#39ff14;border-radius:6px;padding:8px;font-size:12px;cursor:pointer;font-family:monospace;">🔄 Sync Sekarang</button>',
                '<button onclick="window.__offlineSync.clearQueue();document.getElementById(\'queue-viewer-overlay\').remove();" style="background:#2a0d0d;border:1px solid #ef4444;color:#f87171;border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer;font-family:monospace;">🗑 Clear All</button>'
            ].join('');
            panel.appendChild(actions);
        }

        overlay.appendChild(panel);
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    // ============================================================
    // INTERCEPT FORM SUBMIT
    // ============================================================
    function interceptForms() {
        document.addEventListener('submit', async function (event) {
            const form      = event.target;
            const action    = form.getAttribute('action') || form.action || '';
            if (!action.includes('/save')) return;
            if (navigator.onLine) return;

            event.preventDefault();

            const actionUrl = action.startsWith('/') ? action : '/' + action;

            try {
                // Buat FormData manual — baca file LANGSUNG dari input element
                // karena FormData(form) kadang tidak baca file yang di-replace via DataTransfer
                const formData = new FormData();

                // Ambil semua field text/select/textarea
                const elements = form.querySelectorAll('input:not([type=file]), select, textarea');
                elements.forEach(el => {
                    if (el.name && el.type !== 'submit' && el.type !== 'button') {
                        if (el.type === 'checkbox' || el.type === 'radio') {
                            if (el.checked) formData.append(el.name, el.value);
                        } else {
                            formData.append(el.name, el.value || '');
                        }
                    }
                });

                // Ambil file LANGSUNG dari input[type=file]
                const fileInputs = form.querySelectorAll('input[type=file]');
                fileInputs.forEach(input => {
                    if (input.name && input.files && input.files[0]) {
                        formData.append(input.name, input.files[0], input.files[0].name);
                        console.log('[OfflineSync] File dari input', input.name, ':', input.files[0].name, Math.round(input.files[0].size/1024) + 'KB');
                    }
                });

                await saveToQueue(formData, actionUrl);
                form.reset();

                // Reset preview compress msg
                form.querySelectorAll('.compress-msg').forEach(el => el.classList.add('d-none'));

                const tglInput = document.getElementById('tanggalInput');
                if (tglInput) tglInput.value = new Date().toISOString().split('T')[0];

                // Cek apakah ada foto yang tersimpan
                const fileCount = [...form.querySelectorAll('input[type=file]')].filter(
                    i => i.files && i.files[0]
                ).length;

                showToast(
                    fileCount > 0
                        ? '💾 Data + ' + fileCount + ' foto tersimpan offline! Sync saat online.'
                        : '💾 Data tersimpan offline! Sync saat online.',
                    'warning'
                );
                updateQueueBadge();

                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    const sw = await navigator.serviceWorker.ready;
                    await sw.sync.register('sync-jurnal-queue');
                }
            } catch (err) {
                console.error('[OfflineSync] Gagal simpan:', err);
                showToast('❌ Gagal simpan offline: ' + err.message, 'error');
            }
        }, true);
    }

    // ============================================================
    // NETWORK LISTENERS
    // ============================================================
    function setupNetworkListeners() {
        window.addEventListener('online', () => {
            hideOfflineBanner();
            setTimeout(() => processQueue(), 1500);
        });
        window.addEventListener('offline', () => {
            showOfflineBanner();
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', e => {
                if (e.data && e.data.type === 'PROCESS_QUEUE') processQueue();
            });
        }
    }

    // ============================================================
    // INIT
    // ============================================================
    async function init() {
        try {
            await openDB();
        } catch (e) {
            console.error('[OfflineSync] IndexedDB gagal:', e);
            return;
        }

        setupNetworkListeners();
        interceptForms();

        if (!navigator.onLine) showOfflineBanner();

        await updateQueueBadge();

        if (navigator.onLine) {
            const queue = await getQueue();
            if (queue.length > 0) {
                console.log('[OfflineSync]', queue.length, 'item pending, memproses...');
                setTimeout(() => processQueue(), 2000);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Global API
    window.__offlineSync = {
        getQueue,
        processQueue,
        showQueueViewer,
        removeItem: async (id) => {
            await removeFromQueue(id);
            const overlay = document.getElementById('queue-viewer-overlay');
            if (overlay) overlay.remove();
            await showQueueViewer();
        },
        clearQueue: async () => {
            const queue = await getQueue();
            for (const item of queue) await removeFromQueue(item.id);
            showToast('🗑 Queue dibersihkan', 'info');
        }
    };

})();