const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

// ==========================================
// KIRIM PESAN TEKS KE TELEGRAM
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
            try {
                const parsed = JSON.parse(data);
                if (!parsed.ok) console.warn('[Telegram] Gagal kirim pesan:', parsed.description);
            } catch(e) {}
        });
    });

    req.on('error', (e) => console.warn('[Telegram] Error:', e.message));
    req.write(body);
    req.end();
}

// ==========================================
// KIRIM FOTO KE TELEGRAM (dengan caption)
// ==========================================
function sendTelegramPhoto(filePath, caption) {
    if (!BOT_TOKEN || !CHAT_ID) return;

    try {
        const fileBuffer = fs.readFileSync(filePath);
        const filename   = path.basename(filePath);
        const boundary   = '----TelegramBoundary' + Date.now();

        // Build multipart/form-data manual
        const captionPart = Buffer.from(
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
            CHAT_ID + '\r\n' +
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n' +
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="caption"\r\n\r\n' +
            caption + '\r\n' +
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="photo"; filename="' + filename + '"\r\n' +
            'Content-Type: image/jpeg\r\n\r\n'
        );
        const closingPart = Buffer.from('\r\n--' + boundary + '--\r\n');
        const bodyBuffer  = Buffer.concat([captionPart, fileBuffer, closingPart]);

        const options = {
            hostname: 'api.telegram.org',
            path:     '/bot' + BOT_TOKEN + '/sendPhoto',
            method:   'POST',
            headers:  {
                'Content-Type':   'multipart/form-data; boundary=' + boundary,
                'Content-Length': bodyBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.ok) {
                        console.warn('[Telegram] Gagal kirim foto:', parsed.description);
                        // Fallback: kirim sebagai teks saja
                        sendTelegram(caption);
                    }
                } catch(e) {}
            });
        });

        req.on('error', (e) => {
            console.warn('[Telegram] Error kirim foto:', e.message);
            // Fallback kirim teks
            sendTelegram(caption);
        });
        req.write(bodyBuffer);
        req.end();
    } catch(e) {
        console.warn('[Telegram] Gagal baca file foto:', e.message);
        // Fallback kirim teks tanpa foto
        sendTelegram(caption);
    }
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

    const caption = [
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

    // Kalau ada foto petunjuk, kirim foto sekalian
    if (tugas.fotoTugasUrl) {
        const publicDir  = path.join(__dirname, '..', 'public');
        const filePath   = path.join(publicDir, tugas.fotoTugasUrl);
        if (fs.existsSync(filePath)) {
            sendTelegramPhoto(filePath, caption);
            return;
        }
    }

    // Tidak ada foto — kirim teks saja
    sendTelegram(caption);
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
