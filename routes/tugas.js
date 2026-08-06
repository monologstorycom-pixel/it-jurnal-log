const express = require('express');
const router  = express.Router();

const prisma           = require('../services/prisma');
const { requireLogin } = require('../middleware/auth');
const { hasPerm }      = require('../helpers/permissions');
const { uploadSingle, saveCompressedPhoto } = require('../helpers/photo');

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
    return canManageTugas(user) || isMaintenance(user);
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

        // Stats hari ini
        const [total, selesai, proses, belum] = await Promise.all([
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd } } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Selesai' } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Proses' } }),
            prisma.tugas.count({ where: { tanggal: { gte: tglStart, lte: tglEnd }, status: 'Belum' } }),
        ]);

        res.render('tugas', {
            tugas, filterTanggal,
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
router.post('/tugas/buat', requireLogin, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const { judul, deskripsi, tanggal, prioritas } = req.body;
        if (!judul || !judul.trim()) return res.status(400).send('Judul wajib diisi.');
        if (!tanggal) return res.status(400).send('Tanggal wajib diisi.');
        await prisma.tugas.create({
            data: {
                judul: judul.trim(),
                deskripsi: deskripsi || '',
                buatOleh: user.nama,
                tanggal: new Date(tanggal + 'T00:00:00'),
                prioritas: prioritas || 'Normal',
                status: 'Belum'
            }
        });
        res.redirect('/tugas?saved=1&tanggal=' + tanggal);
    } catch (err) { console.error(err); res.status(500).send('Gagal buat tugas: ' + err.message); }
});

// ==========================================
// EDIT TUGAS
// ==========================================
router.post('/tugas/edit/:id', requireLogin, async (req, res) => {
    const user = req.session.user;
    if (!canManageTugas(user)) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id = parseInt(req.params.id);
        const { judul, deskripsi, tanggal, prioritas, status } = req.body;
        if (!judul || !judul.trim()) return res.status(400).send('Judul wajib diisi.');
        await prisma.tugas.update({
            where: { id },
            data: { judul: judul.trim(), deskripsi: deskripsi || '', tanggal: new Date(tanggal + 'T00:00:00'), prioritas: prioritas || 'Normal', status: status || 'Belum' }
        });
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
        const updateData = { status: newStatus, catatan: catatan || null };
        if (req.file) {
            updateData.fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
        }
        await prisma.tugas.update({ where: { id }, data: updateData });
        res.redirect('/maintenance?tugasDone=1');
    } catch (err) { console.error(err); res.status(500).send('Gagal update status: ' + err.message); }
});

module.exports = router;
