const https = require('https');

const API_KEY  = process.env.KIRIMDEV_API_KEY;
const PHONE_ID = process.env.KIRIMDEV_PHONE_ID;
const APP_URL  = process.env.APP_URL || 'https://jurnal.rsby.cloud';

// ==========================================
// SEND WHATSAPP TEMPLATE VIA KIRIMDEV
// ==========================================
function sendWATemplate(to, templateName, components) {
    if (!API_KEY || !PHONE_ID) {
        console.warn('[KirimDev] KIRIMDEV_API_KEY atau KIRIMDEV_PHONE_ID belum diset di .env');
        return;
    }
    if (!to) return;

    // Normalize nomor HP — hapus +, pastikan format 628xxx
    const noHp = to.replace(/\D/g, '').replace(/^0/, '62');

    const body = JSON.stringify({
        messaging_product: 'whatsapp',
        to:                noHp,
        type:              'template',
        template: {
            name:       templateName,
            language:   { code: 'id' },
            components
        }
    });

    const options = {
        hostname: 'api.kirimdev.com',
        path:     '/v1/' + PHONE_ID + '/messages',
        method:   'POST',
        headers:  {
            'Authorization': 'Bearer ' + API_KEY,
            'Content-Type':  'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.error) console.warn('[KirimDev] Error:', parsed.error);
                else console.log('[KirimDev] Terkirim ke', noHp, '- template:', templateName);
            } catch(e) {}
        });
    });
    req.on('error', e => console.warn('[KirimDev] Request error:', e.message));
    req.write(body);
    req.end();
}

// ==========================================
// NOTIF TUGAS BARU → ke penerima (maintenance)
// Template: notif_tugas_baru
// Header: IMAGE (foto petunjuk lokasi, opsional)
// Body: {{1}}=judul, {{2}}=deskripsi, {{3}}=tanggal, {{4}}=prioritas, {{5}}=pembuat
// ==========================================
function notifWATugasBaru(noHpPenerima, tugas) {
    if (!noHpPenerima) return;

    const tgl = new Date(tugas.tanggal).toLocaleDateString('id-ID', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    const bodyParams = [
        { type: 'text', text: tugas.judul },
        { type: 'text', text: tugas.deskripsi || '-' },
        { type: 'text', text: tgl },
        { type: 'text', text: tugas.prioritas },
        { type: 'text', text: tugas.buatOleh },
    ];

    const components = [];

    // Kalau ada foto petunjuk, kirim sebagai image header
    if (tugas.fotoTugasUrl) {
        const fotoUrl = APP_URL + tugas.fotoTugasUrl;
        components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: fotoUrl } }]
        });
    }

    components.push({ type: 'body', parameters: bodyParams });

    sendWATemplate(noHpPenerima, 'notif_tugas_baru', components);
}

// ==========================================
// NOTIF UPDATE TUGAS → ke pembuat tugas (HRGA)
// Template: notif_update_tugas
// Header: IMAGE (foto bukti dari maintenance, opsional)
// Body: {{1}}=nama penerima, {{2}}=judul, {{3}}=status, {{4}}=teknisi, {{5}}=catatan
// ==========================================
function notifWAUpdateTugas(noHpPembuat, namaPembuat, tugas, newStatus, namaTeknisi, fotoUrl) {
    if (!noHpPembuat) return;

    const bodyParams = [
        { type: 'text', text: namaPembuat },
        { type: 'text', text: tugas.judul },
        { type: 'text', text: newStatus },
        { type: 'text', text: namaTeknisi },
        { type: 'text', text: tugas.catatan || '-' },
    ];

    const components = [];

    // Kalau ada foto bukti, kirim sebagai image header
    if (fotoUrl) {
        const fullFotoUrl = APP_URL + fotoUrl;
        components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: fullFotoUrl } }]
        });
    }

    components.push({ type: 'body', parameters: bodyParams });

    sendWATemplate(noHpPembuat, 'notif_update_tugas', components);
}

module.exports = { sendWATemplate, notifWATugasBaru, notifWAUpdateTugas };
