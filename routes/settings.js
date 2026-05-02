const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const prisma                      = require('../services/prisma');
const { requireLogin }            = require('../middleware/auth');
const { upload, saveCompressedPhoto, deleteFotoFile } = require('../helpers/photo');

const uploadFotoProfil = upload.single('fotoProfil');

// ==========================================
// GET /settings
// ==========================================
router.get('/settings', requireLogin, (req, res) => {
    const { msg, msgType } = req.query;
    res.render('settings', {
        msg:     msg     || null,
        msgType: msgType || 'success',
        activePage: 'settings'
    });
});

// ==========================================
// POST /settings/profil  — ganti nama & username
// ==========================================
router.post('/settings/profil', requireLogin, async (req, res) => {
    try {
        const id   = req.session.user.id;
        const nama = (req.body.nama || '').trim();
        if (!nama) return res.redirect('/settings?msg=Nama+tidak+boleh+kosong&msgType=error');

        await prisma.$executeRaw`UPDATE User SET nama = ${nama} WHERE id = ${id}`;

        // update session
        req.session.user.nama = nama;
        res.redirect('/settings?msg=Nama+berhasil+diperbarui&msgType=success');
    } catch (err) {
        console.error('[SETTINGS PROFIL]', err.message);
        res.redirect('/settings?msg=Gagal+simpan+profil&msgType=error');
    }
});

// ==========================================
// POST /settings/password  — ganti password
// ==========================================
router.post('/settings/password', requireLogin, async (req, res) => {
    try {
        const id          = req.session.user.id;
        const { passwordLama, passwordBaru, passwordKonfirmasi } = req.body;

        if (!passwordLama || !passwordBaru || !passwordKonfirmasi)
            return res.redirect('/settings?msg=Semua+field+password+wajib+diisi&msgType=error');
        if (passwordBaru.length < 6)
            return res.redirect('/settings?msg=Password+baru+minimal+6+karakter&msgType=error');
        if (passwordBaru !== passwordKonfirmasi)
            return res.redirect('/settings?msg=Konfirmasi+password+tidak+cocok&msgType=error');

        const userRows = await prisma.$queryRaw`SELECT password FROM User WHERE id = ${id} LIMIT 1`;
        if (!userRows || !userRows[0]) return res.redirect('/settings?msg=User+tidak+ditemukan&msgType=error');
        const valid = await bcrypt.compare(passwordLama, userRows[0].password);
        if (!valid)
            return res.redirect('/settings?msg=Password+lama+salah&msgType=error');

        const hashed = await bcrypt.hash(passwordBaru, 10);
        await prisma.$executeRaw`UPDATE User SET password = ${hashed} WHERE id = ${id}`;

        res.redirect('/settings?msg=Password+berhasil+diperbarui&msgType=success');
    } catch (err) {
        console.error('[SETTINGS PASSWORD]', err.message);
        res.redirect('/settings?msg=Gagal+ganti+password&msgType=error');
    }
});

// ==========================================
// POST /settings/foto  — upload foto profil
// ==========================================
router.post('/settings/foto', requireLogin, (req, res) => {
    uploadFotoProfil(req, res, async (err) => {
        if (err) return res.redirect('/settings?msg=Gagal+upload:+' + encodeURIComponent(err.message) + '&msgType=error');
        try {
            const id = req.session.user.id;

            // Ambil foto lama via raw SQL (aman meski Prisma Client belum di-generate ulang)
            const userRows = await prisma.$queryRaw`SELECT fotoUrl FROM User WHERE id = ${id} LIMIT 1`;
            const oldFoto  = userRows && userRows[0] ? userRows[0].fotoUrl : null;
            if (oldFoto) deleteFotoFile(oldFoto);

            const fotoUrl = await saveCompressedPhoto(req.file, 'fotoProfil', 'profil', 'IT');
            if (!fotoUrl) return res.redirect('/settings?msg=Tidak+ada+file+yang+diupload&msgType=error');

            // Update via raw SQL
            await prisma.$executeRaw`UPDATE User SET fotoUrl = ${fotoUrl} WHERE id = ${id}`;

            // update session
            req.session.user.fotoUrl = fotoUrl;
            res.redirect('/settings?msg=Foto+profil+berhasil+diperbarui&msgType=success');
        } catch (e) {
            console.error('[SETTINGS FOTO]', e.message);
            // Hapus file tmp jika ada error agar tidak numpuk
            if (req.file && req.file.path) {
                try { require('fs').unlinkSync(req.file.path); } catch (_) {}
            }
            res.redirect('/settings?msg=Gagal+simpan+foto:+' + encodeURIComponent(e.message) + '&msgType=error');
        }
    });
});

// ==========================================
// POST /settings/hapus-foto  — hapus foto profil
// ==========================================
router.post('/settings/hapus-foto', requireLogin, async (req, res) => {
    try {
        const id = req.session.user.id;
        const userRows = await prisma.$queryRaw`SELECT fotoUrl FROM User WHERE id = ${id} LIMIT 1`;
        const oldFoto  = userRows && userRows[0] ? userRows[0].fotoUrl : null;
        if (oldFoto) deleteFotoFile(oldFoto);

        await prisma.$executeRaw`UPDATE User SET fotoUrl = NULL WHERE id = ${id}`;
        req.session.user.fotoUrl = null;
        res.redirect('/settings?msg=Foto+profil+dihapus&msgType=success');
    } catch (e) {
        console.error('[SETTINGS HAPUS FOTO]', e.message);
        res.redirect('/settings?msg=Gagal+hapus+foto&msgType=error');
    }
});

module.exports = router;