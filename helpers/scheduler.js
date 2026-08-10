const cron    = require('node-cron');
const prisma  = require('../services/prisma');
const { notifTugasBaru }    = require('./telegram');
const { notifWATugasBaru }  = require('./kirimdev');

// ==========================================
// KIRIM NOTIF TUGAS TERJADWAL
// Jalan setiap hari jam 08:30 WIB (01:30 UTC)
// ==========================================
function startScheduler() {
    // '30 1 * * *' = jam 01:30 UTC = jam 08:30 WIB
    cron.schedule('30 1 * * *', async () => {
        console.log('[Scheduler] ⏰ Cek tugas terjadwal hari ini...');
        try {
            const now   = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,  0,  0);
            const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

            // Ambil semua tugas yang tanggalnya hari ini dan status masih Belum
            const tugasHariIni = await prisma.tugas.findMany({
                where: {
                    tanggal: { gte: start, lte: end },
                    status:  'Belum'
                },
                orderBy: { prioritas: 'desc' }
            });

            if (tugasHariIni.length === 0) {
                console.log('[Scheduler] Tidak ada tugas untuk hari ini.');
                return;
            }

            console.log('[Scheduler] 📋 Ditemukan', tugasHariIni.length, 'tugas untuk hari ini');

            // Ambil semua user maintenance yang punya noHp
            const maintenanceUsers = await prisma.user.findMany({
                where: { divisi: 'MAINTENANCE', noHp: { not: null } },
                select: { noHp: true, nama: true }
            });

            if (maintenanceUsers.length === 0) {
                console.log('[Scheduler] Tidak ada user maintenance dengan noHp.');
            }

            // Kirim notif untuk setiap tugas
            for (const tugas of tugasHariIni) {
                console.log('[Scheduler] 📤 Kirim notif tugas:', tugas.judul);

                // Telegram — kirim 1 kali untuk semua (grup)
                notifTugasBaru(tugas, process.env.APP_URL);

                // WA — kirim ke tiap maintenance
                for (const user of maintenanceUsers) {
                    if (user.noHp) notifWATugasBaru(user.noHp, tugas);
                }

                // Jeda 1 detik antar tugas biar tidak flood
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log('[Scheduler] ✅ Selesai kirim notif', tugasHariIni.length, 'tugas');
        } catch (err) {
            console.error('[Scheduler] ❌ Error:', err.message);
        }
    }, {
        timezone: 'Asia/Jakarta'  // WIB — jalan jam 08:30
    });

    console.log('⏰ Scheduler aktif — notif tugas dikirim setiap hari jam 08:30 WIB');
}

module.exports = { startScheduler };
