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
// CEK APAKAH USER ADALAH MAINTENANCE
// ==========================================
function isMaintenance(user) {
    if (!user) return false;
    return (user.divisi || '').toUpperCase() === 'MAINTENANCE';
}

function canViewMaintenancePage(user) {
    if (!user) return false;
    // Admin, maintenance, atau user dengan canViewMaintenance
    return hasPerm(user, 'canUsers') ||
           hasPerm(user, 'canViewLog') ||
           hasPerm(user, 'canViewMaintenance');
}

function requireMaintenance(req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/login');
    const user = req.session.user;
    if (canViewMaintenancePage(user)) return next();
    return res.status(403).render('403', { message: 'Halaman ini hanya untuk tim Maintenance.' });
}

// ==========================================
// DASHBOARD MAINTENANCE
// ==========================================
router.get('/maintenance', requireLogin, requireMaintenance, async (req, res) => {
    try {
        const { dateFrom, dateTo, status, saved } = req.query;

        const today      = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,  0,  0);
        const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const todayWhere = {
            jenisJurnal: 'MAINTENANCE',
            OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: todayStart, lte: todayEnd } },
                { tipeInput: 'multihari', tanggalMulai: { lte: todayEnd }, tanggalSelesai: { gte: todayStart } }
            ]
        };

        const isFiltered   = dateFrom || dateTo || (status && status !== '');
        const isCustomRange = dateFrom || dateTo;

        let whereClause  = {};
        let filterLabel  = 'Hari Ini';

        if (isCustomRange) {
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
            const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');
            whereClause = {
                jenisJurnal: 'MAINTENANCE',
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
            whereClause = todayWhere;
            filterLabel = 'Hari Ini';
        }

        if (status && status !== '') {
            filterLabel += ' · ' + status;
            whereClause = whereClause.OR
                ? { AND: [{ jenisJurnal: 'MAINTENANCE' }, { OR: whereClause.OR }, { status }] }
                : { ...whereClause, status };
        }

        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });

        const maintenanceAll = { jenisJurnal: 'MAINTENANCE' };

        const [totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems] = await Promise.all([
            prisma.journal.count({ where: { jenisJurnal: 'MAINTENANCE', OR: todayWhere.OR } }),
            prisma.journal.count({ where: { jenisJurnal: 'MAINTENANCE', AND: [{ OR: todayWhere.OR }, { status: 'Solved' }] } }),
            prisma.journal.count({ where: { jenisJurnal: 'MAINTENANCE', AND: [{ OR: todayWhere.OR }, { status: 'Pending' }] } }),
            prisma.journal.count({ where: maintenanceAll }),
            prisma.journal.count({ where: { jenisJurnal: 'MAINTENANCE', status: 'Pending' } }),
            prisma.journal.findMany({
                where: { jenisJurnal: 'MAINTENANCE', status: 'Pending' },
                orderBy: { tanggalManual: 'asc' }, take: 10,
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

        res.render('maintenance', {
            journals,
            yearOptions: getYearOptions(),
            saved: saved === '1',
            formatDurasi,
            filterLabel,
            isFiltered,
            filterDateFrom: dateFrom || '',
            filterDateTo:   dateTo   || '',
            filterStatus:   status   || '',
            isReadOnly: !hasPerm(req.session.user, 'canAdd') && !hasPerm(req.session.user, 'canUsers'),
            stats: { totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems: pendingWithAge }
        });
    } catch (error) { console.error(error); res.status(500).send('Database Error!'); }
});

// ==========================================
// SIMPAN JURNAL MAINTENANCE
// ==========================================
router.post('/maintenance/save', requireLogin, (req, res, next) => {
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

        if (!aktivitas || !aktivitas.trim()) return res.status(400).send('Gagal: Aktivitas wajib diisi.');
        if (!divisi    || !divisi.trim())    return res.status(400).send('Gagal: Divisi wajib diisi.');
        if (!pemesan   || !pemesan.trim())   return res.status(400).send('Gagal: Pemesan wajib diisi.');

        const fotoFile     = req.files?.foto?.[0]     || null;
        const fotoAwalFile = req.files?.fotoAwal?.[0] || null;

        let dataToSave = {
            jenisJurnal: 'MAINTENANCE',
            aktivitas: aktivitas.trim(), divisi: divisi.trim(), pemesan: pemesan.trim(),
            deskripsi: deskripsi || '', status, tipeInput,
            fotoUrl:     fotoFile     ? await saveCompressedPhoto(fotoFile,     'foto',     'log') : null,
            fotoAwalUrl: fotoAwalFile ? await saveCompressedPhoto(fotoAwalFile, 'fotoAwal', 'log') : null
        };

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate,   jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);
            if (!dtMulai)             return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai)           return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');
            if (dtSelesai <= dtMulai) return res.status(400).send('Gagal: Tanggal Selesai harus lebih besar dari Tanggal Mulai.');
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
        res.redirect('/maintenance?saved=1');
    } catch (error) {
        console.error('[MAINTENANCE SAVE ERROR]', error.message);
        res.status(500).send('Gagal Simpan: ' + error.message);
    }
});

// ==========================================
// UPDATE STATUS MAINTENANCE
// ==========================================
router.post('/maintenance/update-status/:id', requireLogin, requireMaintenance, async (req, res) => {
    try {
        if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('ID tidak valid.');
        // Pastikan item ini memang jurnal maintenance
        const item = await prisma.journal.findFirst({ where: { id, jenisJurnal: 'MAINTENANCE' } });
        if (!item) return res.status(404).send('Data tidak ditemukan.');
        await prisma.journal.update({ where: { id }, data: { status: req.body.newStatus } });
        res.redirect('/maintenance');
    } catch (error) { console.error(error); res.status(500).send('Gagal Update.'); }
});

// ==========================================
// UPLOAD FOTO SESUDAH MAINTENANCE
// ==========================================
router.post('/maintenance/upload-foto/:id', requireLogin, requireMaintenance, upload.single('foto'), async (req, res) => {
    try {
        if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
        if (req.file) {
            const fotoUrl = await saveCompressedPhoto(req.file, 'foto', 'log');
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl } });
        }
        res.redirect('/maintenance');
    } catch (error) { console.error(error); res.status(500).send('Gagal Upload.'); }
});

// ==========================================
// UPLOAD FOTO AWAL MAINTENANCE
// ==========================================
router.post('/maintenance/upload-foto-awal/:id', requireLogin, requireMaintenance, upload.single('fotoAwal'), async (req, res) => {
    try {
        if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
        if (req.file) {
            const fotoAwalUrl = await saveCompressedPhoto(req.file, 'fotoAwal', 'log');
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl } });
        }
        res.redirect('/maintenance');
    } catch (error) { console.error(error); res.status(500).send('Gagal Upload Awal.'); }
});

// ==========================================
// EDIT DATA MAINTENANCE
// ==========================================
router.post('/maintenance/edit/:id', requireLogin, requireMaintenance, (req, res, next) => {
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

        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('Gagal: ID tidak valid.');

        if (!aktivitas || !aktivitas.trim()) return res.status(400).send('Gagal: Aktivitas wajib diisi.');
        if (!divisi    || !divisi.trim())    return res.status(400).send('Gagal: Divisi wajib diisi.');
        if (!pemesan   || !pemesan.trim())   return res.status(400).send('Gagal: Pemesan wajib diisi.');

        // Pastikan item ini milik maintenance
        const existing = await prisma.journal.findFirst({ where: { id, jenisJurnal: 'MAINTENANCE' } });
        if (!existing) return res.status(404).send('Data tidak ditemukan.');

        const fotoFile     = req.files?.foto?.[0]     || null;
        const fotoAwalFile = req.files?.fotoAwal?.[0] || null;

        let updateData = {
            aktivitas: aktivitas.trim(), divisi: divisi.trim(), pemesan: pemesan.trim(),
            deskripsi: deskripsi || '', status, tipeInput
        };
        if (fotoFile)     updateData.fotoUrl     = await saveCompressedPhoto(fotoFile,     'foto',     'log');
        if (fotoAwalFile) updateData.fotoAwalUrl = await saveCompressedPhoto(fotoAwalFile, 'fotoAwal', 'log');

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate,   jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);
            if (!dtMulai)             return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai)           return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');
            if (dtSelesai <= dtMulai) return res.status(400).send('Gagal: Tanggal Selesai harus lebih besar dari Tanggal Mulai.');
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

        await prisma.journal.update({ where: { id }, data: updateData });
        res.redirect('/maintenance');
    } catch (error) {
        console.error('[MAINTENANCE EDIT ERROR]', error.message);
        res.status(500).send('Gagal Edit: ' + error.message);
    }
});

// ==========================================
// DELETE MAINTENANCE
// ==========================================
router.post('/maintenance/delete/:id', requireLogin, requireMaintenance, async (req, res) => {
    try {
        if (!hasPerm(req.session.user, 'canDelete')) return res.status(403).render('403', { message: 'Akses ditolak.' });
        const fs   = require('fs');
        const path = require('path');
        const id   = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('ID tidak valid.');
        const item = await prisma.journal.findFirst({ where: { id, jenisJurnal: 'MAINTENANCE' } });
        if (item) {
            [item.fotoUrl, item.fotoAwalUrl].forEach(u => {
                if (u) {
                    const p = path.join(__dirname, '..', 'public', u);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                }
            });
            await prisma.journal.delete({ where: { id } });
        }
        res.redirect('/maintenance');
    } catch (error) { console.error(error); res.status(500).send('Gagal Delete.'); }
});

// ==========================================
// EXPORT EXCEL MAINTENANCE
// ==========================================
router.get('/maintenance/export', requireLogin, requireMaintenance, async (req, res) => {
    try {
        if (!hasPerm(req.session.user, 'canExport') && !hasPerm(req.session.user, 'canAudit') && !hasPerm(req.session.user, 'canUsers')) {
            return res.status(403).render('403', { message: 'Akses ditolak.' });
        }
        const { date, month, year, dateFrom, dateTo } = req.query;
        let whereClause = { jenisJurnal: 'MAINTENANCE' };
        let fileName = 'Log-Maintenance.xlsx';

        if (dateFrom || dateTo) {
            const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01');
            const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : new Date('2099-12-31');
            whereClause = { jenisJurnal: 'MAINTENANCE', OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: from, lte: to } },
                { tipeInput: 'multihari', tanggalMulai: { lte: to }, tanggalSelesai: { gte: from } }
            ]};
            fileName = 'Log-Maintenance-' + (dateFrom || '') + (dateTo && dateTo !== dateFrom ? '_sd_' + dateTo : '') + '.xlsx';
        } else if (month && year) {
            const m = parseInt(month), y = parseInt(year);
            const s = new Date(y, m - 1, 1), e = new Date(y, m, 0, 23, 59, 59);
            whereClause = { jenisJurnal: 'MAINTENANCE', OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: s, lte: e } },
                { tipeInput: 'multihari', tanggalMulai: { lte: e }, tanggalSelesai: { gte: s } }
            ]};
            fileName = 'Log-Maintenance-' + month + '-' + year + '.xlsx';
        }

        const journals  = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Maintenance Log');

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
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1a3a2a' } };
            cell.font      = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const fmtDate = (dt, jam) => {
            if (!dt) return '-';
            const d = new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return jam ? d + ' ' + jam : d;
        };

        const base = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        const buildUrl = (url) => (!url ? null : (url.startsWith('http') ? url : base + url));
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
            if (i % 2 !== 0) row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FFF9' } });
            if (item.fotoAwalUrl) { row.getCell('fotoAwal').value = { text: 'LIHAT FOTO AWAL',    hyperlink: buildUrl(item.fotoAwalUrl) }; row.getCell('fotoAwal').font = { color: { argb: '0000FF' }, underline: true }; }
            if (item.fotoUrl)     { row.getCell('foto').value     = { text: 'LIHAT FOTO SESUDAH', hyperlink: buildUrl(item.fotoUrl) };    row.getCell('foto').font     = { color: { argb: '0000FF' }, underline: true }; }
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
