const express  = require('express');
const ExcelJS  = require('exceljs');
const router   = express.Router();

const prisma                    = require('../services/prisma');
const { requireLogin }          = require('../middleware/auth');
const { hasPerm }               = require('../helpers/permissions');
const { uploadFields, upload, saveCompressedPhoto } = require('../helpers/photo');
const {
    buildDateTime, hitungDurasiDateTime, hitungDurasiJam,
    formatDurasi, getYearOptions
} = require('../helpers/dateTime');

// ==========================================
// VIEWER PUBLIC (/)
// ==========================================
router.get('/', async (req, res) => {
    if (req.session && req.session.user) {
        const u = req.session.user;
        if (!hasPerm(u, 'canViewLog')) {
            if (hasPerm(u, 'canAsset')) return res.redirect('/aset');
            return res.redirect('/login');
        }
    }
    try {
        const { date, q } = req.query;
        const now = new Date();
        let selectedDate, journals, isSearch = false;

        if (q && q.trim()) {
            isSearch = true;
            const keyword = q.trim();
            journals = await prisma.journal.findMany({
                where: {
                    OR: [
                        { aktivitas: { contains: keyword } },
                        { pemesan:   { contains: keyword } },
                        { divisi:    { contains: keyword } },
                        { deskripsi: { contains: keyword } },
                    ]
                },
                orderBy: { tanggalManual: 'desc' },
                take: 100
            });
            selectedDate = now;
        } else {
            if (date) {
                const [year, month, day] = date.split('-');
                selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                selectedDate = now;
            }
            const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0,  0,  0);
            const endDate   = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            journals = await prisma.journal.findMany({
                where: {
                    OR: [
                        { tipeInput: { not: 'multihari' }, tanggalManual: { gte: startDate, lte: endDate } },
                        { tipeInput: 'multihari', tanggalMulai: { lte: endDate }, tanggalSelesai: { gte: startDate } }
                    ]
                },
                orderBy: { tanggalManual: 'desc' }
            });
        }

        res.render('index', {
            journals,
            searchQuery: q || '',
            isSearch,
            filterInfo: {
                date:        selectedDate.toISOString().split('T')[0],
                dateDisplay: selectedDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                month:       now.getMonth() + 1,
                year:        now.getFullYear()
            },
            yearOptions: getYearOptions(),
            formatDurasi
        });
    } catch (error) { console.error(error); res.status(500).send('Database Error!'); }
});

// ==========================================
// DASHBOARD KERJA
// ==========================================
router.get('/kerja', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canViewLog')) {
        if (hasPerm(req.session.user, 'canAsset')) return res.redirect('/aset');
        return res.status(403).render('403', { message: 'Anda tidak punya izin melihat Log Jurnal.' });
    }
    try {
        const { dateFrom, dateTo, status, saved } = req.query;

        const today      = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,  0,  0);
        const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const todayWhere = { OR: [
            { tipeInput: { not: 'multihari' }, tanggalManual: { gte: todayStart, lte: todayEnd } },
            { tipeInput: 'multihari', tanggalMulai: { lte: todayEnd }, tanggalSelesai: { gte: todayStart } }
        ]};

        // Tentukan mode filter
        const isFiltered = dateFrom || dateTo || (status && status !== '');
        const isCustomRange = dateFrom || dateTo;

        let whereClause = {};
        let filterLabel = 'Hari Ini';

        if (isCustomRange) {
            // Date range filter dari user
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
            const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');
            whereClause = {
                OR: [
                    { tipeInput: { not: 'multihari' }, tanggalManual: { gte: from, lte: to } },
                    { tipeInput: 'multihari', tanggalMulai: { lte: to }, tanggalSelesai: { gte: from } }
                ]
            };
            if (dateFrom === dateTo || (!dateTo && dateFrom)) {
                filterLabel = new Date(from).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            } else {
                const fmtFrom = dateFrom ? new Date(from).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '...';
                const fmtTo   = dateTo   ? new Date(to  ).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '...';
                filterLabel = fmtFrom + ' — ' + fmtTo;
            }
        } else {
            // Default: hari ini
            whereClause = todayWhere;
            filterLabel = 'Hari Ini';
        }

        // Apply status filter
        if (status && status !== '') {
            filterLabel += ' · ' + status;
            whereClause = whereClause.OR
                ? { AND: [{ OR: whereClause.OR }, { status }] }
                : { ...whereClause, status };
        }

        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });

        const [totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems] = await Promise.all([
            prisma.journal.count({ where: todayWhere }),
            prisma.journal.count({ where: { AND: [todayWhere, { status: 'Solved' }] } }),
            prisma.journal.count({ where: { AND: [todayWhere, { status: 'Pending' }] } }),
            prisma.journal.count(),
            prisma.journal.count({ where: { status: 'Pending' } }),
            prisma.journal.findMany({
                where: { status: 'Pending' }, orderBy: { tanggalManual: 'asc' }, take: 10,
                select: { id: true, aktivitas: true, divisi: true, pemesan: true, tanggalManual: true, durasiMenit: true,
                    deskripsi: true, status: true, tipeInput: true, jamMulai: true, jamSelesai: true,
                    tanggalMulai: true, tanggalSelesai: true }
            })
        ]);

        const pendingWithAge = pendingItems.map(p => {
            const tgl      = p.tanggalManual ? new Date(p.tanggalManual) : new Date();
            const diffDays = Math.floor((Date.now() - tgl.getTime()) / (1000 * 60 * 60 * 24));
            return { ...p, hariPending: diffDays };
        });

        res.render('admin', {
            journals,
            yearOptions: getYearOptions(),
            saved: saved === '1',
            formatDurasi,
            filterLabel,
            isFiltered,
            filterDateFrom: dateFrom || '',
            filterDateTo:   dateTo   || '',
            filterStatus:   status   || '',
            stats: { totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems: pendingWithAge }
        });
    } catch (error) { console.error(error); res.status(500).send('Database Error!'); }
});

// ==========================================
// SIMPAN JURNAL BARU
// ==========================================
router.post('/save', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAdd')) {
        return res.status(403).render('403', { message: 'Anda tidak punya izin menambah data.' });
    }
    next();
}, uploadFields, async (req, res) => {
    try {
        const {
            aktivitas, divisi, deskripsi, pemesan,
            tipeInput          = 'harian',
            status             = 'Pending',
            tanggalManual      = '', jamMulai = '', jamSelesai = '',
            tanggalMulaiDate   = '', jamMulaiMulti = '',
            tanggalSelesaiDate = '', jamSelesaiMulti = ''
        } = req.body;

        const fotoFile     = req.files?.foto?.[0]     || null;
        const fotoAwalFile = req.files?.fotoAwal?.[0] || null;

        let dataToSave = {
            aktivitas, divisi, pemesan, deskripsi, status, tipeInput,
            fotoUrl:     fotoFile     ? await saveCompressedPhoto(fotoFile,     'foto',     'log') : null,
            fotoAwalUrl: fotoAwalFile ? await saveCompressedPhoto(fotoAwalFile, 'fotoAwal', 'log') : null
        };

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate,   jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);
            if (!dtMulai)              return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai)            return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');
            if (dtSelesai <= dtMulai)  return res.status(400).send('Gagal: Tanggal Selesai harus lebih besar dari Tanggal Mulai.');
            Object.assign(dataToSave, {
                tanggalManual: dtMulai, tanggalMulai: dtMulai, tanggalSelesai: dtSelesai,
                jamMulai: jamMulaiMulti || null, jamSelesai: jamSelesaiMulti || null,
                durasiMenit: hitungDurasiDateTime(dtMulai, dtSelesai)
            });
        } else {
            const tanggalObj = buildDateTime(tanggalManual, jamMulai);
            if (!tanggalObj) return res.status(400).send('Gagal: Tanggal tidak valid.');
            Object.assign(dataToSave, {
                tanggalManual: tanggalObj,
                jamMulai: jamMulai || null, jamSelesai: jamSelesai || null,
                durasiMenit: hitungDurasiJam(jamMulai, jamSelesai)
            });
        }

        await prisma.journal.create({ data: dataToSave });
        res.redirect('/kerja?saved=1');
    } catch (error) {
        console.error('[SAVE ERROR]', error.message);
        res.status(500).send('Gagal Simpan: ' + error.message);
    }
});

// ==========================================
// UPDATE STATUS
// ==========================================
router.post('/update-status/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.newStatus } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send('Gagal Update.'); }
});

// ==========================================
// UPLOAD FOTO SESUDAH
// ==========================================
router.post('/upload-foto/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        if (req.file) {
            const fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl } });
        }
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send('Gagal Upload.'); }
});

// ==========================================
// UPLOAD FOTO AWAL
// ==========================================
router.post('/upload-foto-awal/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('fotoAwal'), async (req, res) => {
    try {
        if (req.file) {
            const fotoAwalUrl = await saveCompressedPhoto(req.file, 'fotoAwal', 'log');
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl } });
        }
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send('Gagal Upload Awal.'); }
});

// ==========================================
// EDIT DATA
// ==========================================
router.post('/edit/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, uploadFields, async (req, res) => {
    try {
        const {
            aktivitas, divisi, deskripsi, pemesan,
            tipeInput          = 'harian',
            status             = 'Pending',
            tanggalManual      = '', jamMulai = '', jamSelesai = '',
            tanggalMulaiDate   = '', jamMulaiMulti = '',
            tanggalSelesaiDate = '', jamSelesaiMulti = ''
        } = req.body;

        const fotoFile     = req.files?.foto?.[0]     || null;
        const fotoAwalFile = req.files?.fotoAwal?.[0] || null;

        let updateData = { aktivitas, divisi, pemesan, deskripsi, status, tipeInput };
        if (fotoFile)     updateData.fotoUrl     = await saveCompressedPhoto(fotoFile,     'foto',     'log');
        if (fotoAwalFile) updateData.fotoAwalUrl = await saveCompressedPhoto(fotoAwalFile, 'fotoAwal', 'log');

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate,   jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);
            if (!dtMulai)   return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai) return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');
            Object.assign(updateData, {
                tanggalManual: dtMulai, tanggalMulai: dtMulai, tanggalSelesai: dtSelesai,
                jamMulai: jamMulaiMulti || null, jamSelesai: jamSelesaiMulti || null,
                durasiMenit: hitungDurasiDateTime(dtMulai, dtSelesai)
            });
        } else {
            const tanggalObj = buildDateTime(tanggalManual, jamMulai);
            if (!tanggalObj) return res.status(400).send('Gagal: Tanggal tidak valid.');
            Object.assign(updateData, {
                tanggalManual: tanggalObj, tanggalMulai: null, tanggalSelesai: null,
                jamMulai: jamMulai || null, jamSelesai: jamSelesai || null,
                durasiMenit: hitungDurasiJam(jamMulai, jamSelesai)
            });
        }

        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: updateData });
        res.redirect('/kerja');
    } catch (error) {
        console.error('[EDIT ERROR]', error.message);
        res.status(500).send('Gagal Edit: ' + error.message);
    }
});

// ==========================================
// DELETE
// ==========================================
router.post('/delete/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canDelete')) return res.status(403).render('403', { message: 'Akses ditolak. Hanya yang punya izin hapus.' });
    next();
}, async (req, res) => {
    try {
        const fs   = require('fs');
        const path = require('path');
        const item = await prisma.journal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item) {
            [item.fotoUrl, item.fotoAwalUrl].forEach(u => {
                if (u) {
                    const p = path.join(__dirname, '..', 'public', u);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                }
            });
        }
        await prisma.journal.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send('Gagal Delete.'); }
});

// ==========================================
// EXPORT EXCEL LOG
// ==========================================
router.get('/export', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canExport') && !hasPerm(req.session.user, 'canAudit')) {
        return res.status(403).render('403', { message: 'Akses ditolak.' });
    }
    next();
}, async (req, res) => {
    try {
        const { date, month, year, dateFrom, dateTo } = req.query;
        let whereClause = {}, fileName = 'Log-IT.xlsx';

        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
            const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');
            whereClause = { OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: from, lte: to } },
                { tipeInput: 'multihari', tanggalMulai: { lte: to }, tanggalSelesai: { gte: from } }
            ]};
            fileName = 'Log-IT-' + (dateFrom || '') + (dateTo && dateTo !== dateFrom ? '_sd_' + dateTo : '') + '.xlsx';
        } else if (date) {
            const d = new Date(date);
            const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
            whereClause = { OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: s, lte: e } },
                { tipeInput: 'multihari', tanggalMulai: { lte: e }, tanggalSelesai: { gte: s } }
            ]};
            fileName = 'Log-IT-' + date + '.xlsx';
        } else if (month && year) {
            const m = parseInt(month), y = parseInt(year);
            const s = new Date(y, m - 1, 1), e = new Date(y, m, 0, 23, 59, 59);
            whereClause = { OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: s, lte: e } },
                { tipeInput: 'multihari', tanggalMulai: { lte: e }, tanggalSelesai: { gte: s } }
            ]};
            fileName = 'Log-IT-' + month + '-' + year + '.xlsx';
        }

        const journals  = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('IT Support Log');

        worksheet.columns = [
            { header: 'TIPE',         key: 'tipe',       width: 10 },
            { header: 'TGL MULAI',    key: 'tglMulai',   width: 20 },
            { header: 'TGL SELESAI',  key: 'tglSelesai', width: 20 },
            { header: 'DURASI',       key: 'durasi',     width: 18 },
            { header: 'DIVISI',       key: 'divisi',     width: 20 },
            { header: 'USER/PEMESAN', key: 'pemesan',    width: 22 },
            { header: 'AKTIVITAS',    key: 'aktivitas',  width: 28 },
            { header: 'DESKRIPSI',    key: 'deskripsi',  width: 42 },
            { header: 'STATUS',       key: 'status',     width: 11 },
            { header: 'FOTO AWAL',    key: 'fotoAwal',   width: 15 },
            { header: 'FOTO SESUDAH', key: 'foto',       width: 15 },
        ];

        worksheet.getRow(1).eachCell(cell => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '161B22' } };
            cell.font      = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const fmtDate = (dt, jam) => {
            if (!dt) return '-';
            const d = new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return jam ? d + ' ' + jam : d;
        };

        const base = 'http://server.rsby.cloud:3001';
        journals.forEach((item, i) => {
            const isMulti = item.tipeInput === 'multihari';
            const row = worksheet.addRow({
                tipe:       isMulti ? 'MULTI-HARI' : 'HARIAN',
                tglMulai:   isMulti ? fmtDate(item.tanggalMulai,  item.jamMulai)   : fmtDate(item.tanggalManual, item.jamMulai),
                tglSelesai: isMulti ? fmtDate(item.tanggalSelesai, item.jamSelesai) : (item.jamSelesai || '-'),
                durasi:     item.durasiMenit ? formatDurasi(item.durasiMenit) : '-',
                divisi:     item.divisi,
                pemesan:    item.pemesan,
                aktivitas:  item.aktivitas,
                deskripsi:  item.deskripsi,
                status:     item.status
            });
            if (i % 2 !== 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9F9F9' } });
            if (item.fotoAwalUrl) { row.getCell('fotoAwal').value = { text: 'LIHAT FOTO AWAL',    hyperlink: base + item.fotoAwalUrl }; row.getCell('fotoAwal').font = { color: { argb: '0000FF' }, underline: true }; }
            if (item.fotoUrl)     { row.getCell('foto').value     = { text: 'LIHAT FOTO SESUDAH', hyperlink: base + item.fotoUrl };    row.getCell('foto').font     = { color: { argb: '0000FF' }, underline: true }; }
        });

        worksheet.eachRow(row => row.eachCell(cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { console.error(error); res.status(500).send('Gagal Export.'); }
});

module.exports = router;
