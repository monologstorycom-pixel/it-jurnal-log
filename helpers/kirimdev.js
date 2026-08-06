const https = require('https');

const APP_URL = process.env.APP_URL || 'https://jurnal.rsby.cloud';

// ==========================================
// SEND WHATSAPP TEMPLATE VIA KIRIMDEV
// ==========================================
function sendWATemplate(to, templateName, components) {
    // Baca env SAAT dipanggil (bukan saat module load)
    const API_KEY  = process.env.KIRIMDEV_API_KEY;
    const PHONE_ID = process.env.KIRIMDEV_PHONE_ID;

    if (!API_KEY || !PHONE_ID) {
        console.warn('[KirimDev] ❌ KIRIMDEV_API_KEY atau KIRIMDEV_PHONE_ID belum diset di .env');
        console.warn('[KirimDev] API_KEY:', API_KEY ? 'ada' : 'KOSONG');
        console.warn('[KirimDev] PHONE_ID:', PHONE_ID ? 'ada' : 'KOSONG');
        return;
    }
    if (!to) { console.warn('[KirimDev] ❌ Nomor HP kosong'); return; }

    // Normalize nomor HP — hapus +, pastikan format 628xxx
    const noHp = to.toString().replace(/\D/g, '').replace(/^0/, '62');
    if (!noHp || noHp.length < 10) {
        console.warn('[KirimDev] ❌ Nomor HP tidak valid:', to);
        return;
    }

    const payload = {
        messaging_product: 'whatsapp',
        to:                noHp,
        type:              'template',
        template: {
            name:       templateName,
            language:   { code: 'id' },
            components
        }
    };

    const body = JSON.stringify(payload);
    console.log('[KirimDev] 📤 Kirim ke', noHp, '- template:', templateName);
    console.log('[KirimDev] Payload:', body);

    const options = {
        hostname: 'api.kirimdev.com',
        path:     '/v1/' + PHONE_ID + '/messages',
        method:   'POST',
        headers:  {
            'Authorization':  'Bearer ' + API_KEY,
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.error || (parsed.messages && parsed.messages[0]?.message_status === 'failed')) {
                    console.warn('[KirimDev] ❌ Error response:', JSON.stringify(parsed));
                } else {
                    console.log('[KirimDev] ✅ Berhasil terkirim ke', noHp);
                    console.log('[KirimDev] Response:', JSON.stringify(parsed));
                }
            } catch(e) {
                console.warn('[KirimDev] Parse error:', e.message, '| Raw:', data);
            }
        });
    });
    req.on('error', e => console.warn('[KirimDev] ❌ Request error:', e.message));
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
