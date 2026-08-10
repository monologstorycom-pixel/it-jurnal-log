const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ==========================================
// DOWNLOAD FILE DARI URL (R2 / HTTP) → Buffer
// ==========================================
function downloadToBuffer(url) {
    return new Promise((resolve) => {
        try {
            const lib = url.startsWith('https') ? https : http;
            lib.get(url, (res) => {
                // Handle redirect (301/302)
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return downloadToBuffer(res.headers.location).then(resolve);
                }
                if (res.statusCode !== 200) {
                    console.warn('[KirimDev] Download gagal, status:', res.statusCode, url);
                    return resolve(null);
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', e => {
                console.warn('[KirimDev] Download error:', e.message);
                resolve(null);
            });
        } catch(e) {
            console.warn('[KirimDev] Download exception:', e.message);
            resolve(null);
        }
    });
}

// ==========================================
// UPLOAD MEDIA KE META (dapat media_id)
// Mendukung: path lokal (disk) dan URL R2/http
// ==========================================
function uploadMediaToMeta(filePath) {
    return new Promise(async (resolve) => {
        const API_KEY  = process.env.KIRIMDEV_API_KEY;
        const PHONE_ID = process.env.KIRIMDEV_PHONE_ID;
        if (!API_KEY || !PHONE_ID || !filePath) return resolve(null);

        let fileBuffer = null;
        let filename   = 'photo.jpg';

        if (filePath.startsWith('http')) {
            // URL R2 atau eksternal — download dulu ke buffer
            console.log('[KirimDev] Download dari R2/URL:', filePath);
            fileBuffer = await downloadToBuffer(filePath);
            filename   = path.basename(filePath.split('?')[0]) || 'photo.jpg';
        } else {
            // Path lokal
            let diskPath = filePath;
            if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
                diskPath = path.join(__dirname, '..', 'public', filePath);
            }
            if (!fs.existsSync(diskPath)) {
                console.warn('[KirimDev] File tidak ditemukan di disk:', diskPath);
                return resolve(null);
            }
            try {
                fileBuffer = fs.readFileSync(diskPath);
                filename   = path.basename(diskPath);
            } catch(e) {
                console.warn('[KirimDev] File read error:', e.message);
                return resolve(null);
            }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
            console.warn('[KirimDev] Buffer kosong, batal upload media');
            return resolve(null);
        }

        try {
            const boundary = '----WAboundary' + Date.now();
            const ext      = filename.toLowerCase().split('.').pop();
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

            const part1 = Buffer.from(
                '--' + boundary + '\r\n' +
                'Content-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n' +
                '--' + boundary + '\r\n' +
                'Content-Disposition: form-data; name="type"\r\n\r\n' + mimeType + '\r\n' +
                '--' + boundary + '\r\n' +
                'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
                'Content-Type: ' + mimeType + '\r\n\r\n'
            );
            const part2 = Buffer.from('\r\n--' + boundary + '--\r\n');
            const body  = Buffer.concat([part1, fileBuffer, part2]);

            const options = {
                hostname: 'api.kirimdev.com',
                path:     '/v1/' + PHONE_ID + '/media',
                method:   'POST',
                headers:  {
                    'Authorization':  'Bearer ' + API_KEY,
                    'Content-Type':   'multipart/form-data; boundary=' + boundary,
                    'Content-Length': body.length
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.id) {
                            console.log('[KirimDev] ✅ Media uploaded, id:', parsed.id);
                            resolve(parsed.id);
                        } else {
                            console.warn('[KirimDev] ❌ Media upload failed:', JSON.stringify(parsed));
                            resolve(null);
                        }
                    } catch(e) { console.warn('[KirimDev] Parse error media:', e.message); resolve(null); }
                });
            });
            req.on('error', e => { console.warn('[KirimDev] Media upload error:', e.message); resolve(null); });
            req.write(body);
            req.end();
        } catch(e) {
            console.warn('[KirimDev] Upload exception:', e.message);
            resolve(null);
        }
    });
}

// ==========================================
// SEND WHATSAPP TEMPLATE VIA KIRIMDEV
// ==========================================
function sendWATemplate(to, templateName, components) {
    const API_KEY  = process.env.KIRIMDEV_API_KEY;
    const PHONE_ID = process.env.KIRIMDEV_PHONE_ID;

    if (!API_KEY || !PHONE_ID) {
        console.warn('[KirimDev] ❌ API_KEY atau PHONE_ID kosong');
        return;
    }
    if (!to) return;

    const noHp = to.toString().replace(/\D/g, '').replace(/^0/, '62');
    if (!noHp || noHp.length < 10) {
        console.warn('[KirimDev] ❌ Nomor HP tidak valid:', to);
        return;
    }

    const payload = {
        messaging_product: 'whatsapp',
        to:   noHp,
        type: 'template',
        template: { name: templateName, language: { code: 'id' }, components }
    };

    const body = JSON.stringify(payload);
    console.log('[KirimDev] 📤 Kirim ke', noHp, '- template:', templateName);

    const options = {
        hostname: 'api.kirimdev.com',
        path:     '/v1/' + PHONE_ID + '/messages',
        method:   'POST',
        headers:  { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const p = JSON.parse(data);
                if (p.error) console.warn('[KirimDev] ❌ Error:', JSON.stringify(p));
                else console.log('[KirimDev] ✅ Terkirim ke', noHp);
            } catch(e) { console.warn('[KirimDev] Parse error:', e.message, data); }
        });
    });
    req.on('error', e => console.warn('[KirimDev] Request error:', e.message));
    req.write(body);
    req.end();
}

// ==========================================
// BUILD IMAGE HEADER COMPONENT
// Upload ke Meta dulu → pakai media_id
// Fallback ke link kalau upload gagal
// ==========================================
async function buildImageHeader(fotoUrl) {
    if (!fotoUrl) return null;

    // Upload ke Meta Media API
    const mediaId = await uploadMediaToMeta(fotoUrl);
    if (mediaId) {
        return { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] };
    }

    // Fallback: pakai link langsung (kalau R2 bisa diakses)
    const fullUrl = fotoUrl.startsWith('http') ? fotoUrl : (process.env.APP_URL || 'https://jurnal.rsby.cloud') + fotoUrl;
    console.warn('[KirimDev] Fallback ke link:', fullUrl);
    return { type: 'header', parameters: [{ type: 'image', image: { link: fullUrl } }] };
}

// ==========================================
// NOTIF TUGAS BARU → ke maintenance
// ==========================================
async function notifWATugasBaru(noHpPenerima, tugas) {
    if (!noHpPenerima) return;

    const tgl = new Date(tugas.tanggal).toLocaleDateString('id-ID', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const components = [];

    if (tugas.fotoTugasUrl) {
        const header = await buildImageHeader(tugas.fotoTugasUrl);
        if (header) components.push(header);
    }

    components.push({ type: 'body', parameters: [
        { type: 'text', text: tugas.judul },
        { type: 'text', text: tugas.deskripsi || '-' },
        { type: 'text', text: tgl },
        { type: 'text', text: tugas.prioritas },
        { type: 'text', text: tugas.buatOleh },
    ]});

    sendWATemplate(noHpPenerima, 'notif_tugas_baru', components);
}

// ==========================================
// NOTIF UPDATE TUGAS → ke pembuat tugas
// ==========================================
async function notifWAUpdateTugas(noHpPembuat, namaPembuat, tugas, newStatus, namaTeknisi, fotoUrl) {
    if (!noHpPembuat) return;

    const components = [];

    if (newStatus === 'Proses') {
        components.push({ type: 'body', parameters: [
            { type: 'text', text: namaPembuat },
            { type: 'text', text: tugas.judul },
            { type: 'text', text: namaTeknisi },
            { type: 'text', text: tugas.catatan || 'Segera dikerjakan' },
        ]});
        sendWATemplate(noHpPembuat, 'notif_tugas_prosess', components);
    } else {
        // Selesai — upload foto bukti ke Meta dulu
        if (fotoUrl) {
            const header = await buildImageHeader(fotoUrl);
            if (header) components.push(header);
        }
        components.push({ type: 'body', parameters: [
            { type: 'text', text: namaPembuat },
            { type: 'text', text: tugas.judul },
            { type: 'text', text: newStatus },
            { type: 'text', text: namaTeknisi },
            { type: 'text', text: tugas.catatan || '-' },
        ]});
        sendWATemplate(noHpPembuat, 'notif_update_tugas', components);
    }
}

module.exports = { sendWATemplate, notifWATugasBaru, notifWAUpdateTugas };
