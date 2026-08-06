const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

// ==========================================
// KIRIM PESAN KE TELEGRAM
// ==========================================
function sendTelegram(text) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn('[Telegram] BOT_TOKEN atau CHAT_ID belum diset di .env');
        return;
    }

    const body = JSON.stringify({
        chat_id:    CHAT_ID,
        text:       text,
        parse_mode: 'HTML'
    });

    const options = {
        hostname: 'api.telegram.org',
        path:     '/bot' + BOT_TOKEN + '/sendMessage',
        method:   'POST',
        headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const parsed = JSON.parse(data);
            if (!parsed.ok) console.warn('[Telegram] Gagal kirim:', parsed.description);
        });
    });

    req.on('error', (e) => console.warn('[Telegram] Error:', e.message));
    req.write(body);
    req.end();
}

// ==========================================
// NOTIF TUGAS BARU
// ==========================================
function notifTugasBaru(tugas, appUrl) {
    const tgl = new Date(tugas.tanggal).toLocaleDateString('id-ID', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    const prioritasEmoji = tugas.prioritas === 'Urgent' ? '🔴' : '🟡';
    const url = (appUrl || 'https://jurnal.rsby.cloud') + '/tugas';

    const text = [
        `📋 <b>TUGAS BARU - MAINTENANCE</b>`,
        ``,
        `${prioritasEmoji} <b>${tugas.judul}</b>`,
        tugas.deskripsi ? `📝 ${tugas.deskripsi}` : '',
        ``,
        `📅 Tanggal: <b>${tgl}</b>`,
        `⚡ Prioritas: <b>${tugas.prioritas}</b>`,
        `👤 Dibuat oleh: ${tugas.buatOleh}`,
        ``,
        `🔗 <a href="${url}">Lihat Tugas</a>`
    ].filter(Boolean).join('\n');

    sendTelegram(text);
}

// ==========================================
// NOTIF STATUS UPDATE
// ==========================================
function notifStatusUpdate(tugas, newStatus, updatedBy) {
    const statusEmoji = newStatus === 'Selesai' ? '✅' : '⏳';
    const text = [
        `${statusEmoji} <b>UPDATE TUGAS</b>`,
        ``,
        `📋 ${tugas.judul}`,
        ``,
        `Status: <b>${newStatus}</b>`,
        updatedBy ? `👤 Oleh: ${updatedBy}` : '',
        tugas.catatan ? `💬 Catatan: ${tugas.catatan}` : ''
    ].filter(Boolean).join('\n');

    sendTelegram(text);
}

module.exports = { sendTelegram, notifTugasBaru, notifStatusUpdate };
