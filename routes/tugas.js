const express = require('express');
const router  = express.Router();

const prisma           = require('../services/prisma');
const { requireLogin } = require('../middleware/auth');
const { hasPerm }      = require('../helpers/permissions');
const { uploadSingle, uploadFields, saveCompressedPhoto } = require('../helpers/photo');
const { notifTugasBaru, notifStatusUpdate } = require('../helpers/telegram');
const { notifWATugasBaru, notifWAUpdateTugas } = require('../helpers/kirimdev');

// ==========================================
// HELPER
// ==========================================
function isMaintenance(user) {
    return (user.divisi || '').toUpperCase() === 'MAINTENANCE';
}
function canManageTugas(user) {
    // Admin atau user dengan canTugas
    return hasPerm(user, 'canUsers') || hasPerm(user, 'canTugas');
}
function canSeeTugas(user) {
    return canManageTugas(user) || isMaintenance(user) || hasPerm(user, 'canViewMaintenance') || hasPerm(user, 'canTugasMtc');
}

// ==========================================
// DASHBOARD TUGAS (untuk manager/admin)
// ==========================================
router.get('/tugas', requireLogin, async (req, res) => {
    const user = req.session.user;
    if (!canSeeTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });

    try {
        const { tanggal, status } = req.query;
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Tentukan filter tanggal
        const filterTanggal = tanggal || todayStr;
        const [y, m, d] = filterTanggal.split('-').map(Number);
        const tglStart = new Date(y, m - 1, d, 0, 0, 0);
        const tglEnd   = new Date(y, m - 1, d, 23, 59, 59);

        let where = { tanggal: { gte: tglStart, lte: tglEnd } };
        if (status && status !== '') where.status = status;

        const tugas = await prisma.tugas.findMany({ where, orderBy: [{ prioritas: 'desc' }, { createdAt: 'asc' }] });

        // Ambil noHp pembuat untuk tombol "Hubungi Pelapor"
        const namaPembuat = [...new Set(tugas.map(t => t.buatOleh).filter(Boolean))];
        const userList = namaPembuat.length > 0
            ? await prisma.user.findMany({ where: { nama: { in: namaPembuat } }, select: { nama: true, noHp: true } })
            : [];
        const noHpMap = {};
        userList.forEach(u => { if (u.noHp) noHpMap[u.nama] = u.noHp; });

        // Gabungkan noHp ke setiap tugas
        const tugasWithHp = tugas.map(t => ({ ...t, noHpPembuat: noHpMap[t.buatOleh] || null }));

        // Stats hari ini
        const [total, selesai, proses, belum] = await Promise.all([
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd } } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Selesai' } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Proses' } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Belum' } }),
        ]);

        res.render('tugas', {
            tugas: tugasWithHp, filterTanggal,
            filterStatus: status || '',
            canManage: canManageTugas(user),
            isMtc: isMaintenance(user),
            saved: req.query.saved === '1',
            stats: { total, selesai, proses, belum },
            todayStr
        });
    } catch (err) { console.error(err); res.status(500).send('Database Error: ' + err.message); }
});

// ==========================================
// BUAT TUGAS BARU
// ==========================================
router.post('/tugas/buat', requireLogin, uploadSingle, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const { judul, deskripsi, tanggal, prioritas } = req.body;
        if (!judul || !judul.trim()) return res.status(400).send('Judul wajib diisi.');
        if (!tanggal) return res.status(400).send('Tanggal wajib diisi.');

        let fotoTugasUrl = null;
        if (req.file) {
            fotoTugasUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
        }

        // WAJIB ada foto saat buat tugas
        if (!fotoTugasUrl) {
            return res.status(400).send('Gagal: Foto petunjuk lokasi wajib dilampirkan saat membuat tugas.');
        }

        const tugasBaru = await prisma.tugas.create({
            data: {
                judul: judul.trim(),
                deskripsi: deskripsi || '',
                buatOleh: user.nama,
                tanggal: new Date(tanggal + 'T00:00:00'),
                prioritas: prioritas || 'Normal',
                status: 'Belum',
                fotoTugasUrl
            }
        });

        // Cek apakah tanggal tugas = hari ini
        const today     = new Date();
        const todayStr  = today.toISOString().split('T')[0];
        const isToday   = tanggal === todayStr;

        if (isToday) {
            // Hari ini → kirim langsung sekarang
            notifTugasBaru(tugasBaru, process.env.APP_URL);

            const maintenanceUsers = await prisma.user.findMany({
                where: { divisi: 'MAINTENANCE', noHp: { not: null } },
                select: { noHp: true }
            });
            maintenanceUsers.forEach(u => { if (u.noHp) notifWATugasBaru(u.noHp, tugasBaru); });

            console.log('[Tugas] Notif langsung dikirim - tugas untuk hari ini');
        } else {
            // Masa depan → scheduler yang akan kirim jam 09:00 WIB di hari H
            console.log('[Tugas] Tugas dijadwalkan untuk', tanggal, '- notif akan dikirim jam 09:00 WIB');
        }

        res.redirect('/tugas?saved=1&tanggal=' + tanggal);
    } catch (err) { console.error(err); res.status(500).send('Gagal buat tugas: ' + err.message); }
});

// ==========================================
// EDIT TUGAS
// ==========================================
router.post('/tugas/edit/:id', requireLogin, uploadSingle, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id = parseInt(req.params.id);
        const { judul, deskripsi, tanggal, prioritas, status } = req.body;
        if (!judul || !judul.trim()) return res.status(400).send('Judul wajib diisi.');

        const updateData = {
            judul: judul.trim(), deskripsi: deskripsi || '',
            tanggal: new Date(tanggal + 'T00:00:00'),
            prioritas: prioritas || 'Normal', status: status || 'Belum'
        };
        if (req.file) {
            updateData.fotoTugasUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
        }

        await prisma.tugas.update({ where: { id }, data: updateData });
        res.redirect('/tugas?tanggal=' + tanggal);
    } catch (err) { console.error(err); res.status(500).send('Gagal edit tugas: ' + err.message); }
});

// ==========================================
// HAPUS TUGAS
// ==========================================
router.post('/tugas/hapus/:id', requireLogin, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id = parseInt(req.params.id);
        const item = await prisma.tugas.findUnique({ where: { id } });
        if (item?.fotoUrl) {
            const fs = require('fs'), path = require('path');
            const p = path.join(__dirname, '..', 'public', item.fotoUrl);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        await prisma.tugas.delete({ where: { id } });
        res.redirect('/tugas?tanggal=' + (req.body.tanggal || ''));
    } catch (err) { console.error(err); res.status(500).send('Gagal hapus: ' + err.message); }
});

// ==========================================
// UPDATE STATUS (oleh maintenance)
// ==========================================
router.post('/tugas/status/:id', requireLogin, uploadSingle, async (req, res) => {
    const user = req.session.user;
    if (!canSeeTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id      = parseInt(req.params.id);
        const { newStatus, catatan, tanggal } = req.body;

        // WAJIB foto bukti kalau status Selesai
        if (newStatus === 'Selesai' && !req.file) {
            return res.status(400).send('Gagal: Foto bukti wajib dilampirkan saat menandai tugas Selesai.');
        }

        const updateData = { status: newStatus, catatan: catatan || null };
        if (req.file) {
            updateData.fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
        }
        const tugasUpdated = await prisma.tugas.update({ where: { id }, data: updateData });

        // Kirim notif Telegram status update
        notifStatusUpdate(tugasUpdated, newStatus, user.nama);

        // Kirim notif WA ke pembuat tugas (cari noHp berdasarkan nama buatOleh)
        if (tugasUpdated.buatOleh) {
            const pembuat = await prisma.user.findFirst({
                where: { nama: tugasUpdated.buatOleh, noHp: { not: null } },
                select: { noHp: true, nama: true }
            });
            if (pembuat?.noHp) {
                const fotoUrlBukti = updateData.fotoUrl || null;
                notifWAUpdateTugas(pembuat.noHp, pembuat.nama, tugasUpdated, newStatus, user.nama, fotoUrlBukti);
            }
        }

        res.redirect('/maintenance?tugasDone=1');
    } catch (err) { console.error(err); res.status(500).send('Gagal update status: ' + err.message); }
});

// ==========================================
// EXPORT EXCEL TUGAS
// ==========================================
router.get('/tugas/export', requireLogin, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const ExcelJS = require('exceljs');
        const { dateFrom, dateTo, tanggal } = req.query;
        let where = {}, fileName = 'Laporan-Tugas-Maintenance.xlsx';

        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
            const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');
            where = { tanggal: { gte: from, lte: to } };
            fileName = 'Tugas-MTC-' + (dateFrom || '') + (dateTo && dateTo !== dateFrom ? '_sd_' + dateTo : '') + '.xlsx';
        } else if (tanggal) {
            const [y, m, d] = tanggal.split('-').map(Number);
            where = { tanggal: { gte: new Date(y, m-1, d, 0,0,0), lte: new Date(y, m-1, d, 23,59,59) } };
            fileName = 'Tugas-MTC-' + tanggal + '.xlsx';
        }

        const data = await prisma.tugas.findMany({ where, orderBy: [{ tanggal: 'asc' }, { prioritas: 'desc' }] });

        const workbook  = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Tugas Maintenance');

        ws.columns = [
            { header: 'NO',           key: 'no',           width: 5  },
            { header: 'TANGGAL',      key: 'tanggal',      width: 18 },
            { header: 'JUDUL TUGAS',  key: 'judul',        width: 35 },
            { header: 'DESKRIPSI',    key: 'deskripsi',    width: 40 },
            { header: 'PRIORITAS',    key: 'prioritas',    width: 12 },
            { header: 'STATUS',       key: 'status',       width: 12 },
            { header: 'CATATAN',      key: 'catatan',      width: 30 },
            { header: 'DIBUAT OLEH',  key: 'buatOleh',     width: 20 },
            { header: 'FOTO PETUNJUK',key: 'fotoTugas',    width: 16 },
            { header: 'FOTO BUKTI',   key: 'foto',         width: 14 },
        ];

        // Header style
        ws.getRow(1).eachCell(cell => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1a3a2a' } };
            cell.font      = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const base = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        data.forEach((t, i) => {
            const row = ws.addRow({
                no:        i + 1,
                tanggal:   new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                judul:     t.judul,
                deskripsi: t.deskripsi || '-',
                prioritas: t.prioritas,
                status:    t.status,
                catatan:   t.catatan || '-',
                buatOleh:  t.buatOleh,
            });
            // Warna status
            const statusCell = row.getCell('status');
            if (t.status === 'Selesai')     { statusCell.font = { color: { argb: '16a34a' }, bold: true }; }
            else if (t.status === 'Proses') { statusCell.font = { color: { argb: '2563eb' }, bold: true }; }
            else                            { statusCell.font = { color: { argb: 'ea580c' }, bold: true }; }
            // Warna prioritas
            if (t.prioritas === 'Urgent') row.getCell('prioritas').font = { color: { argb: 'dc2626' }, bold: true };
            // Foto link
            if (t.fotoTugasUrl) { const u = t.fotoTugasUrl.startsWith('http') ? t.fotoTugasUrl : base + t.fotoTugasUrl; row.getCell('fotoTugas').value = { text: 'LIHAT PETUNJUK', hyperlink: u }; row.getCell('fotoTugas').font = { color: { argb: 'ea580c' }, underline: true }; }
            if (t.fotoUrl)      { const u = t.fotoUrl.startsWith('http')      ? t.fotoUrl      : base + t.fotoUrl;      row.getCell('foto').value      = { text: 'LIHAT FOTO',     hyperlink: u }; row.getCell('foto').font      = { color: { argb: '0000FF' }, underline: true }; }
            // Zebra
            if (i % 2 !== 0) row.eachCell(c => { if (!c.font?.color) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FFF9' } }; });
        });

        // Border semua
        ws.eachRow(row => row.eachCell(cell => {
            cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        }));

        // Summary row
        ws.addRow([]);
        const summaryRow = ws.addRow(['', '', '', '', '', `Total: ${data.length}`, `Selesai: ${data.filter(t=>t.status==='Selesai').length}`, `Belum/Proses: ${data.filter(t=>t.status!=='Selesai').length}`]);
        summaryRow.font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { console.error(err); res.status(500).send('Gagal export: ' + err.message); }
});

module.exports = router;
