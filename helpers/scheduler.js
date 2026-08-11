const cron    = require('node-cron');
const prisma  = require('../services/prisma');
const { notifTugasBaru }    = require('./telegram');
const { notifWATugasBaru }  = require('./kirimdev');

// ==========================================
// CORE: KIRIM NOTIF TUGAS HARI INI
// Bisa dipanggil dari scheduler ATAU manual trigger
// ==========================================
async function kirimNotifTugasHariIni() {
    console.log('[Scheduler] ⏰ Cek tugas terjadwal hari ini...');

    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,  0,  0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const tugasHariIni = await prisma.tugas.findMany({
        where: { tanggal: { gte: start, lte: end }, status: 'Belum' },
        orderBy: { prioritas: 'desc' }
    });

    if (tugasHariIni.length === 0) {
        console.log('[Scheduler] Tidak ada tugas untuk hari ini.');
        return { sent: 0, tugas: [] };
    }

    console.log('[Scheduler] 📋 Ditemukan', tugasHariIni.length, 'tugas untuk hari ini');

    const maintenanceUsers = await prisma.user.findMany({
        where: { divisi: 'MAINTENANCE', noHp: { not: null } },
        select: { noHp: true, nama: true }
    });

    if (maintenanceUsers.length === 0) {
        console.log('[Scheduler] Tidak ada user maintenance dengan noHp.');
    }

    for (const tugas of tugasHariIni) {
        console.log('[Scheduler] 📤 Kirim notif tugas:', tugas.judul);
        notifTugasBaru(tugas, process.env.APP_URL);
        for (const user of maintenanceUsers) {
            if (user.noHp) notifWATugasBaru(user.noHp, tugas);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('[Scheduler] ✅ Selesai kirim notif', tugasHariIni.length, 'tugas');
    return { sent: tugasHariIni.length, tugas: tugasHariIni.map(t => t.judul) };
}

// ==========================================
// CRON: jalankan otomatis jam 08:30 WIB
// ==========================================
function startScheduler() {
    cron.schedule('30 1 * * *', async () => {
        try { await kirimNotifTugasHariIni(); }
        catch (err) { console.error('[Scheduler] ❌ Error:', err.message); }
    }, { timezone: 'Asia/Jakarta' });

    console.log('⏰ Scheduler aktif — notif tugas dikirim setiap hari jam 08:30 WIB');
}

module.exports = { startScheduler, kirimNotifTugasHariIni };
