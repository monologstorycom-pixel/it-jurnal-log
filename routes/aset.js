const express  = require('express');
const ExcelJS  = require('exceljs');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const prisma                                              = require('../services/prisma');
const { requireLogin }                                    = require('../middleware/auth');
const { hasPerm, canSeeAllAset }                          = require('../helpers/permissions');
const { upload, uploadAsetFoto, saveCompressedPhoto, deleteFotoFile } = require('../helpers/photo');

// ==========================================
// ASET PUBLIK (tanpa login)
// ==========================================
router.get('/aset-public', async (req, res) => {
    try {
        if (req.session && req.session.user) {
            const divisi = req.session.user.divisi || 'IT';
            return res.redirect('/aset-public/' + encodeURIComponent(divisi));
        }
        const { q, kategori } = req.query;
        let where = { divisi: { in: ['IT', 'IT & IC'] } };
        if (q)                        where.OR       = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where, orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal:       'desc' }, take: 10 },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' }, take: 10 },
                service:    { orderBy: { tanggal:       'desc' }, take: 10 },
            }
        });
        const allKategori = await prisma.aset.findMany({
            where: { divisi: { in: ['IT', 'IT & IC'] } },
            select: { kategori: true }, distinct: ['kategori']
        });
        res.render('aset-public', {
            aset, allKategori: allKategori.map(k => k.kategori), allDivisi: [],
            q: q || '', kategori: kategori || '', divisi: 'IT', divisiLabel: 'IT & IC'
        });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

router.get('/aset-public/:divisi', requireLogin, async (req, res) => {
    try {
        const targetDivisi = decodeURIComponent(req.params.divisi).toUpperCase();
        const userDivisi   = (req.session.user.divisi || 'IT').toUpperCase();
        const seeAll       = canSeeAllAset(req.session.user);

        if (!seeAll && userDivisi !== targetDivisi) {
            return res.status(403).render('403', { message: `Anda hanya bisa melihat aset divisi ${userDivisi}.` });
        }

        const { q, kategori } = req.query;
        let where = {};
        if (targetDivisi === 'IT' || targetDivisi === 'IT & IC') {
            where.divisi = { in: ['IT', 'IT & IC'] };
        } else {
            where.divisi = targetDivisi;
        }
        if (q)                        where.OR       = [{ nama: { contains: q }, divisi: where.divisi }, { kategori: { contains: q }, divisi: where.divisi }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where, orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal:       'desc' }, take: 10 },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' }, take: 10 },
                service:    { orderBy: { tanggal:       'desc' }, take: 10 },
            }
        });
        const allKategori = await prisma.aset.findMany({
            where: { divisi: where.divisi }, select: { kategori: true }, distinct: ['kategori']
        });

        let allDivisiList = [];
        if (seeAll) {
            const rows = await prisma.aset.findMany({ select: { divisi: true }, distinct: ['divisi'], orderBy: { divisi: 'asc' } });
            allDivisiList = rows.map(d => d.divisi);
        }

        res.render('aset-public', {
            aset, allKategori: allKategori.map(k => k.kategori), allDivisi: allDivisiList,
            q: q || '', kategori: kategori || '',
            divisi: targetDivisi, divisiLabel: targetDivisi === 'IT' ? 'IT & IC' : targetDivisi,
            seeAll
        });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// EXPORT PDF ASET
// ==========================================
router.get('/aset/export-pdf', requireLogin, async (req, res) => {
    try {
        const seeAll       = canSeeAllAset(req.session.user);
        const userDivisi   = req.session.user.divisi || 'IT';
        const targetDivisi = seeAll ? (req.query.divisi || null) : userDivisi;

        let whereClause = {};
        if (targetDivisi) whereClause.divisi = (targetDivisi === 'IT & IC' || targetDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : targetDivisi;

        const aset = await prisma.aset.findMany({
            where: whereClause, orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal:       'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } },
                service:    { orderBy: { tanggal:       'desc' } }
            }
        });
        res.render('aset-export', { aset, divisiLabel: targetDivisi || 'Semua Divisi' });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// EXPORT EXCEL ASET
// ==========================================
router.get('/export-aset', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canExport') && !hasPerm(req.session.user, 'canAudit')) {
        return res.status(403).render('403', { message: 'Akses ditolak.' });
    }
    next();
}, async (req, res) => {
    try {
        const seeAll       = canSeeAllAset(req.session.user);
        const userDivisi   = req.session.user.divisi || 'IT';
        const targetDivisi = seeAll ? (req.query.divisi || null) : userDivisi;

        let whereClause = {};
        if (targetDivisi) whereClause.divisi = (targetDivisi === 'IT & IC' || targetDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : targetDivisi;

        const asets      = await prisma.aset.findMany({ where: whereClause, orderBy: { kategori: 'asc' }, include: { penggunaan: true } });
        const labelDivisi = targetDivisi || 'Semua Divisi';
        const workbook   = new ExcelJS.Workbook();
        const worksheet  = workbook.addWorksheet('Data Aset ' + labelDivisi);

        worksheet.columns = [
            { header: 'NO',         key: 'no',         width: 6  },
            { header: 'NAMA ASET',  key: 'nama',       width: 30 },
            { header: 'DIVISI',     key: 'divisi',     width: 12 },
            { header: 'KATEGORI',   key: 'kategori',   width: 16 },
            { header: 'SATUAN',     key: 'satuan',     width: 10 },
            { header: 'STOK AWAL',  key: 'stokAwal',   width: 12 },
            { header: 'STOK',       key: 'stok',       width: 10 },
            { header: 'KONDISI',    key: 'kondisi',    width: 12 },
            { header: 'DIPAKAI',    key: 'dipakai',    width: 10 },
            { header: 'KETERANGAN', key: 'keterangan', width: 30 },
        ];
        worksheet.getRow(1).eachCell(cell => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.border    = { bottom: { style: 'thin', color: { argb: 'FF4DA6FF' } } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        worksheet.getRow(1).height = 20;

        asets.forEach((a, i) => {
            const row = worksheet.addRow({
                no: i + 1, nama: a.nama, divisi: a.divisi, kategori: a.kategori,
                satuan: a.satuan, stokAwal: a.stokAwal, stok: a.stok, kondisi: a.kondisi,
                dipakai: a.penggunaan ? a.penggunaan.length : 0, keterangan: a.keterangan || '-',
            });
            row.eachCell(cell => {
                cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.font      = { size: 10 };
            });
            const kondisiCell = row.getCell('kondisi');
            if (a.kondisi === 'Rusak') kondisiCell.font = { color: { argb: 'FFDC2626' }, size: 10, bold: true };
            else if (a.kondisi === 'Baik') kondisiCell.font = { color: { argb: 'FF16A34A' }, size: 10, bold: true };
            row.height = 18;
        });

        const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        worksheet.addRow([]);
        const infoRow = worksheet.addRow([`Divisi: ${labelDivisi} | Diekspor pada: ${tgl}`, '', '', '', '', '', '', '', '', `Total: ${asets.length} aset`]);
        infoRow.font = { italic: true, color: { argb: 'FF888888' }, size: 9 };

        const safeLabel = labelDivisi.replace(/[^a-zA-Z0-9]/g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Data-Aset-${safeLabel}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { console.error(error); res.status(500).send('Gagal export aset: ' + error.message); }
});

// ==========================================
// LIST ASET
// ==========================================
router.get('/aset', requireLogin, async (req, res) => {
    try {
        const { q, kategori, divisi } = req.query;
        const userDivisi = req.session.user.divisi || 'IT';
        const seeAll     = canSeeAllAset(req.session.user);

        let where = {};
        if (!seeAll) {
            where.divisi = (userDivisi === 'IT & IC' || userDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : userDivisi;
        } else if (divisi && divisi !== '') {
            where.divisi = (divisi === 'IT & IC' || divisi === 'IT') ? { in: ['IT', 'IT & IC'] } : divisi;
        }
        if (q)                        where.OR       = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where, orderBy: { nama: 'asc' },
            include: { pinjaman: { where: { status: 'Dipinjam' }, select: { id: true } } }
        });

        const allKategori = await prisma.aset.findMany({
            where: seeAll ? (divisi && divisi !== '' ? { divisi: where.divisi } : {}) : { divisi: where.divisi },
            select: { kategori: true }, distinct: ['kategori']
        });
        const allDivisi = await prisma.aset.findMany({ select: { divisi: true }, distinct: ['divisi'], orderBy: { divisi: 'asc' } });

        let vendorWhere = {};
        if (!seeAll) {
            vendorWhere.divisi = (userDivisi === 'IT & IC' || userDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : userDivisi;
        } else if (divisi && divisi !== '') {
            vendorWhere.divisi = (divisi === 'IT & IC' || divisi === 'IT') ? { in: ['IT', 'IT & IC'] } : divisi;
        }
        const vendors = await prisma.vendor.findMany({ where: vendorWhere, orderBy: { nama: 'asc' } });

        res.render('aset', {
            aset, allKategori: allKategori.map(k => k.kategori), allDivisi: allDivisi.map(d => d.divisi),
            userDivisi, isAdmin: seeAll,
            q: q || '', kategori: kategori || '', divisi: divisi || '', vendors
        });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// DETAIL ASET
// ==========================================
router.get('/aset/:id', requireLogin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.redirect('/aset');
    try {
        const aset = await prisma.aset.findUnique({
            where: { id },
            include: {
                penggunaan: { orderBy: { tanggal:       'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } },
                service:    { orderBy: { tanggal:       'desc' } }
            }
        });
        if (!aset) return res.status(404).send('Aset tidak ditemukan');

        let vendorWhere = {};
        if (!canSeeAllAset(req.session.user)) {
            vendorWhere.divisi = (aset.divisi === 'IT & IC' || aset.divisi === 'IT') ? { in: ['IT', 'IT & IC'] } : aset.divisi;
        }
        const vendors = await prisma.vendor.findMany({ where: vendorWhere, orderBy: { nama: 'asc' } });

        res.render('aset-detail', { aset, vendors });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// TAMBAH ASET (support 3 foto)
// ==========================================
router.post('/aset/tambah', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, uploadAsetFoto, async (req, res) => {
    try {
        const nama       = (req.body.nama      || '').toString().trim();
        const kategori   = (req.body.kategori  || 'UMUM').toString().trim().toUpperCase();
        const satuan     = (req.body.satuan    || '').toString().trim();
        const kondisi    = (req.body.kondisi   || 'Baik').toString().trim();
        const keterangan = req.body.keterangan ? req.body.keterangan.toString().trim() : null;
        const stokNum    = parseInt(req.body.stok) || 0;
        const divisiAset = req.body.divisi ? req.body.divisi.toString().trim() : (req.session.user.divisi || 'IT');

        const files    = req.files || {};
        const fotoUrl  = await saveCompressedPhoto(files['foto']?.[0],  'foto', 'aset', divisiAset);
        const foto2Url = await saveCompressedPhoto(files['foto2']?.[0], 'foto', 'aset', divisiAset);
        const foto3Url = await saveCompressedPhoto(files['foto3']?.[0], 'foto', 'aset', divisiAset);

        await prisma.aset.create({
            data: { nama, divisi: divisiAset, kategori, satuan, stokAwal: stokNum, stok: stokNum, kondisi, keterangan, fotoUrl, foto2Url, foto3Url }
        });
        res.redirect('/aset?saved=1');
    } catch (error) { console.error(error); res.status(500).send('Gagal tambah aset: ' + error.message); }
});

// ==========================================
// EDIT ASET (support 3 foto)
// ==========================================
router.post('/aset/edit/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, uploadAsetFoto, async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        if (isNaN(asetId)) return res.status(400).send('ID aset tidak valid');

        const nama       = (req.body.nama     || '').toString().trim();
        const kategori   = (req.body.kategori || 'UMUM').toString().trim().toUpperCase();
        const satuan     = (req.body.satuan   || '').toString().trim();
        const kondisi    = (req.body.kondisi  || 'Baik').toString().trim();
        const keterangan = req.body.keterangan ? req.body.keterangan.toString().trim() : null;
        const stokAwalNum = parseInt(req.body.stokAwal) || 0;

        // Hitung stok otomatis
        const resPakai  = await prisma.$queryRawUnsafe('SELECT COALESCE(SUM(jumlah),0) as total FROM AsetPenggunaan WHERE asetId = ?', asetId);
        const resPinjam = await prisma.$queryRawUnsafe("SELECT COALESCE(SUM(jumlah),0) as total FROM AsetPinjam WHERE asetId = ? AND status = 'Dipinjam'", asetId);
        const totalPakai  = Number(resPakai[0].total)  || 0;
        const totalPinjam = Number(resPinjam[0].total) || 0;
        const stokBaru    = stokAwalNum - totalPakai - totalPinjam;

        const asetExisting = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!asetExisting) return res.status(404).send('Aset tidak ditemukan');

        const files = req.files || {};

        // Proses foto baru jika diupload — kalau tidak upload, pertahankan yang lama
        const fotoUrl  = files['foto']?.[0]  ? await saveCompressedPhoto(files['foto'][0],  'foto', 'aset', asetExisting.divisi)  : asetExisting.fotoUrl;
        const foto2Url = files['foto2']?.[0] ? await saveCompressedPhoto(files['foto2'][0], 'foto', 'aset', asetExisting.divisi) : asetExisting.foto2Url;
        const foto3Url = files['foto3']?.[0] ? await saveCompressedPhoto(files['foto3'][0], 'foto', 'aset', asetExisting.divisi) : asetExisting.foto3Url;

        // Hapus foto lama dari disk jika ada foto baru yang menggantikan
        if (files['foto']?.[0]  && asetExisting.fotoUrl)  deleteFotoFile(asetExisting.fotoUrl);
        if (files['foto2']?.[0] && asetExisting.foto2Url) deleteFotoFile(asetExisting.foto2Url);
        if (files['foto3']?.[0] && asetExisting.foto3Url) deleteFotoFile(asetExisting.foto3Url);

        // Hapus foto yang di-checklist "hapus" oleh user
        if (req.body.hapusFoto1 === '1') { deleteFotoFile(asetExisting.fotoUrl);  }
        if (req.body.hapusFoto2 === '1') { deleteFotoFile(asetExisting.foto2Url); }
        if (req.body.hapusFoto3 === '1') { deleteFotoFile(asetExisting.foto3Url); }

        const finalFoto1 = req.body.hapusFoto1 === '1' ? null : fotoUrl;
        const finalFoto2 = req.body.hapusFoto2 === '1' ? null : foto2Url;
        const finalFoto3 = req.body.hapusFoto3 === '1' ? null : foto3Url;

        await prisma.$executeRawUnsafe(
            'UPDATE Aset SET nama=?, kategori=?, satuan=?, stokAwal=?, stok=?, kondisi=?, keterangan=?, fotoUrl=?, foto2Url=?, foto3Url=? WHERE id=?',
            nama, kategori, satuan, stokAwalNum, stokBaru, kondisi, keterangan,
            finalFoto1, finalFoto2, finalFoto3, asetId
        );

        res.redirect('/aset');
    } catch (error) {
        console.error('[EDIT ASET ERROR]', error.message);
        res.status(500).send('Gagal edit aset: ' + error.message);
    }
});

// ==========================================
// HAPUS ASET
// ==========================================
router.post('/aset/hapus/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canDelete')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        // Hapus foto dari disk sebelum delete record
        const aset = await prisma.aset.findUnique({ where: { id: parseInt(req.params.id) } });
        if (aset) {
            deleteFotoFile(aset.fotoUrl);
            deleteFotoFile(aset.foto2Url);
            deleteFotoFile(aset.foto3Url);
        }
        await prisma.aset.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/aset');
    } catch (error) { console.error(error); res.status(500).send('Gagal hapus: ' + error.message); }
});

// ==========================================
// PAKAI ASET
// ==========================================
router.post('/aset/pakai/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, divisi, lokasi, keterangan, tanggal } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send('Aset tidak ditemukan');
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);

        const fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'aset_pakai', aset.divisi);
        await prisma.$transaction([
            prisma.asetPenggunaan.create({ data: { asetId, jumlah: jml, divisi, lokasi, keterangan: keterangan || null, fotoUrl, tanggal: tanggal ? new Date(tanggal) : new Date() } }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pakai');
    } catch (error) { console.error(error); res.status(500).send('Gagal catat penggunaan: ' + error.message); }
});

// ==========================================
// HAPUS PENGGUNAAN ASET
// ==========================================
router.post('/aset/pakai-hapus/:penggunaanId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const penggunaan = await prisma.asetPenggunaan.findUnique({ where: { id: parseInt(req.params.penggunaanId) } });
        if (!penggunaan) return res.status(404).send('Data tidak ditemukan');
        if (penggunaan.fotoUrl) { const p = path.join(__dirname, '..', 'public', penggunaan.fotoUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
        await prisma.$transaction([
            prisma.aset.update({ where: { id: penggunaan.asetId }, data: { stok: { increment: penggunaan.jumlah } } }),
            prisma.asetPenggunaan.delete({ where: { id: parseInt(req.params.penggunaanId) } })
        ]);
        res.redirect('/aset/' + penggunaan.asetId);
    } catch (error) { console.error(error); res.status(500).send('Gagal hapus penggunaan: ' + error.message); }
});

// ==========================================
// PINJAM ASET
// ==========================================
router.post('/aset/pinjam/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, peminjam, divisi, keperluan, tanggalPinjam } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send('Aset tidak ditemukan');
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);

        const fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'aset_pinjam', aset.divisi);
        await prisma.$transaction([
            prisma.asetPinjam.create({ data: { asetId, jumlah: jml, peminjam, divisi, keperluan: keperluan || null, fotoUrl, tanggalPinjam: tanggalPinjam ? new Date(tanggalPinjam) : new Date(), status: 'Dipinjam' } }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pinjam');
    } catch (error) { console.error(error); res.status(500).send('Gagal catat pinjaman: ' + error.message); }
});

// ==========================================
// KEMBALI PINJAM
// ==========================================
router.post('/aset/kembali/:pinjamId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const pinjam = await prisma.asetPinjam.findUnique({ where: { id: parseInt(req.params.pinjamId) } });
        if (!pinjam)                         return res.status(404).send('Data pinjaman tidak ditemukan');
        if (pinjam.status === 'Dikembalikan') return res.status(400).send('Sudah dikembalikan.');
        await prisma.$transaction([
            prisma.asetPinjam.update({ where: { id: parseInt(req.params.pinjamId) }, data: { status: 'Dikembalikan', tanggalKembali: new Date() } }),
            prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } })
        ]);
        res.redirect('/aset/' + pinjam.asetId + '?saved=kembali');
    } catch (error) { console.error(error); res.status(500).send('Gagal proses kembali: ' + error.message); }
});

// ==========================================
// HAPUS PINJAM
// ==========================================
router.post('/aset/pinjam-hapus/:pinjamId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const pinjam = await prisma.asetPinjam.findUnique({ where: { id: parseInt(req.params.pinjamId) } });
        if (!pinjam) return res.status(404).send('Tidak ditemukan');
        if (pinjam.fotoUrl) { const p = path.join(__dirname, '..', 'public', pinjam.fotoUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
        const ops = [prisma.asetPinjam.delete({ where: { id: parseInt(req.params.pinjamId) } })];
        if (pinjam.status === 'Dipinjam') ops.push(prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } }));
        await prisma.$transaction(ops);
        res.redirect('/aset/' + pinjam.asetId);
    } catch (error) { console.error(error); res.status(500).send('Gagal hapus: ' + error.message); }
});

// ==========================================
// SERVICE ASET — TAMBAH
// ==========================================
router.post('/aset/service/:asetId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.asetId);
        let { teknisi, vendor, keluhan, hasil, biaya, status, tanggal, tanggalSelesai } = req.body;
        if (Array.isArray(vendor)) vendor = vendor[vendor.length - 1];

        const aset    = await prisma.aset.findUnique({ where: { id: asetId } });
        const fotoUrl = req.file ? await saveCompressedPhoto(req.file, 'foto', 'aset_service', aset ? aset.divisi : 'IT') : null;

        await prisma.asetService.create({
            data: {
                asetId,
                teknisi: teknisi || '-',
                vendor:  vendor && vendor !== 'manual' ? vendor : null,
                keluhan: keluhan || '-',
                hasil:   hasil   || null,
                biaya:   biaya   ? parseInt(biaya) : 0,
                status:  status  || 'Proses',
                tanggal: tanggal ? new Date(tanggal) : new Date(),
                tanggalSelesai: (tanggalSelesai && tanggalSelesai !== '') ? new Date(tanggalSelesai) : null,
                fotoUrl
            }
        });
        await prisma.aset.update({ where: { id: asetId }, data: { kondisi: status === 'Selesai' ? 'Baik' : 'Perlu Service' } });
        res.redirect('/aset/' + asetId);
    } catch (error) { console.error(error); res.status(500).send('Gagal catat service: ' + error.message); }
});

// ==========================================
// SERVICE ASET — EDIT
// ==========================================
router.post('/aset/service-edit/:serviceId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);
        let { teknisi, vendor, keluhan, hasil, biaya, status, tanggal, tanggalSelesai } = req.body;
        if (Array.isArray(vendor)) vendor = vendor[vendor.length - 1];

        const sv = await prisma.asetService.findUnique({ where: { id: serviceId } });
        if (!sv) return res.status(404).send('Tidak ditemukan');

        await prisma.asetService.update({
            where: { id: serviceId },
            data: {
                teknisi: teknisi || sv.teknisi,
                vendor:  vendor && vendor !== 'manual' ? vendor : null,
                keluhan: keluhan || sv.keluhan,
                hasil:   hasil   || null,
                biaya:   biaya   ? parseInt(biaya) : 0,
                status:  status  || sv.status,
                tanggal: tanggal ? new Date(tanggal) : sv.tanggal,
                tanggalSelesai: (tanggalSelesai && tanggalSelesai !== '') ? new Date(tanggalSelesai) : null,
            }
        });
        await prisma.aset.update({ where: { id: sv.asetId }, data: { kondisi: status === 'Selesai' ? 'Baik' : 'Perlu Service' } });
        res.redirect('/aset/' + sv.asetId);
    } catch (error) { console.error(error); res.status(500).send('Gagal edit service: ' + error.message); }
});

// ==========================================
// SERVICE ASET — HAPUS
// ==========================================
router.post('/aset/service-hapus/:serviceId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const sv = await prisma.asetService.findUnique({ where: { id: parseInt(req.params.serviceId) } });
        if (!sv) return res.status(404).send('Tidak ditemukan');
        if (sv.fotoUrl) { const p = path.join(__dirname, '..', 'public', sv.fotoUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
        await prisma.asetService.delete({ where: { id: sv.id } });
        res.redirect('/aset/' + sv.asetId);
    } catch (error) { console.error(error); res.status(500).send('Gagal hapus: ' + error.message); }
});

module.exports = router;
