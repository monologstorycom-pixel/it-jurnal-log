const express = require('express');
const router  = express.Router();

const prisma           = require('../services/prisma');
const { requireLogin } = require('../middleware/auth');
const { hasPerm }      = require('../helpers/permissions');

// ==========================================
// LIST VENDOR
// ==========================================
router.get('/vendor', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canVendor')) {
        return res.status(403).render('403', { message: 'Akses ditolak. Anda tidak memiliki izin kelola Vendor.' });
    }
    try {
        const { msg, msgType, q, kategori } = req.query;
        const isAdmin    = hasPerm(req.session.user, 'canUsers');
        const userDivisi = req.session.user.divisi || 'IT';
        const isIT       = userDivisi === 'IT' || userDivisi === 'IT & IC';

        let whereClause = {};
        if (!isAdmin && !isIT) whereClause.divisi = userDivisi;
        if (q) whereClause.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }, { alamat: { contains: q } }];
        if (kategori && kategori !== '') whereClause.kategori = kategori;

        const vendors = await prisma.vendor.findMany({ where: whereClause, orderBy: { nama: 'asc' } });
        const allKategori = await prisma.vendor.findMany({
            where: !isAdmin && !isIT ? { divisi: userDivisi } : {},
            select: { kategori: true }, distinct: ['kategori']
        });

        res.render('vendor', {
            vendors, msg: msg || null, msgType: msgType || 'success',
            q: q || '', kategori: kategori || '',
            allKategori: allKategori.map(k => k.kategori)
        });
    } catch (error) {
        console.error('[VENDOR ERROR]', error.message);
        res.status(500).send('Database Error: ' + error.message);
    }
});

// ==========================================
// TAMBAH VENDOR
// ==========================================
router.post('/vendor/tambah', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canVendor')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const { nama, kategori, alamat, noHp, keterangan } = req.body;
        if (!nama) return res.redirect('/vendor?msg=Nama+vendor+wajib+diisi&msgType=error');

        const isAdmin    = hasPerm(req.session.user, 'canUsers');
        const userDivisi = req.session.user.divisi || 'IT';
        let vendorDivisi = req.body.divisi || userDivisi;
        if (!isAdmin && userDivisi !== 'IT' && userDivisi !== 'IT & IC') vendorDivisi = userDivisi;

        await prisma.vendor.create({
            data: {
                nama:      nama.trim(),
                kategori:  (kategori || 'UMUM').trim().toUpperCase(),
                alamat:    alamat    ? alamat.trim()    : null,
                noHp:      noHp      ? noHp.trim()      : null,
                divisi:    vendorDivisi,
                keterangan: keterangan ? keterangan.trim() : null
            }
        });
        res.redirect('/vendor?msg=Vendor+berhasil+ditambahkan&msgType=success');
    } catch (error) {
        console.error('[VENDOR TAMBAH ERROR]', error.message);
        res.redirect('/vendor?msg=Gagal+tambah+vendor:+' + encodeURIComponent(error.message) + '&msgType=error');
    }
});

// ==========================================
// EDIT VENDOR
// ==========================================
router.post('/vendor/edit/:id', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canVendor')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id = parseInt(req.params.id);
        const { nama, kategori, alamat, noHp, keterangan } = req.body;
        if (!nama) return res.redirect('/vendor?msg=Nama+vendor+wajib+diisi&msgType=error');

        const vendorLama = await prisma.vendor.findUnique({ where: { id } });
        if (!vendorLama) return res.redirect('/vendor?msg=Vendor+tidak+ditemukan&msgType=error');

        const isAdmin    = hasPerm(req.session.user, 'canUsers');
        const userDivisi = req.session.user.divisi || 'IT';
        let vendorDivisi = req.body.divisi || vendorLama.divisi;

        if (!isAdmin && userDivisi !== 'IT' && userDivisi !== 'IT & IC' && vendorLama.divisi !== userDivisi) {
            return res.status(403).render('403', { message: 'Anda tidak bisa mengedit vendor milik divisi lain.' });
        }
        if (!isAdmin && userDivisi !== 'IT' && userDivisi !== 'IT & IC') vendorDivisi = userDivisi;

        await prisma.vendor.update({
            where: { id },
            data: {
                nama:      nama.trim(),
                kategori:  (kategori || 'UMUM').trim().toUpperCase(),
                alamat:    alamat    ? alamat.trim()    : null,
                noHp:      noHp      ? noHp.trim()      : null,
                divisi:    vendorDivisi,
                keterangan: keterangan ? keterangan.trim() : null
            }
        });
        res.redirect('/vendor?msg=Vendor+berhasil+diperbarui&msgType=success');
    } catch (error) {
        console.error('[VENDOR EDIT ERROR]', error.message);
        res.redirect('/vendor?msg=Gagal+edit+vendor&msgType=error');
    }
});

// ==========================================
// HAPUS VENDOR
// ==========================================
router.post('/vendor/hapus/:id', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canVendor')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    try {
        const id     = parseInt(req.params.id);
        const vendor = await prisma.vendor.findUnique({ where: { id } });

        if (!vendor) return res.redirect('/vendor?msg=Vendor+tidak+ditemukan&msgType=error');

        const isAdmin    = hasPerm(req.session.user, 'canUsers');
        const userDivisi = req.session.user.divisi || 'IT';
        if (!isAdmin && userDivisi !== 'IT' && userDivisi !== 'IT & IC' && vendor.divisi !== userDivisi) {
            return res.status(403).render('403', { message: 'Anda tidak bisa menghapus vendor milik divisi lain.' });
        }

        await prisma.vendor.delete({ where: { id } });
        res.redirect('/vendor?msg=Vendor+berhasil+dihapus&msgType=success');
    } catch (error) {
        console.error('[VENDOR HAPUS ERROR]', error.message);
        res.redirect('/vendor?msg=Gagal+hapus+vendor&msgType=error');
    }
});

module.exports = router;
