const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = express();
const prisma = new PrismaClient();
const uploadDir = path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// MULTER
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'fotoAwal' ? 'IT-AWAL-' : 'IT-LOG-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
const uploadFields = upload.fields([
    { name: 'fotoAwal', maxCount: 1 },
    { name: 'foto', maxCount: 1 }
]);

// ==========================================
// HELPER: Gabung tanggal (YYYY-MM-DD) + jam (HH:MM) → Date
// ==========================================
function buildDateTime(tanggal, jam) {
    if (!tanggal || tanggal.trim() === '') return null;
    const jamStr = (jam && jam.trim() !== '') ? jam.trim() : '00:00';
    const dt = new Date(tanggal.trim() + 'T' + jamStr + ':00');
    return isNaN(dt.getTime()) ? null : dt;
}

// ==========================================
// HELPER: Hitung durasi menit antara 2 Date
// ==========================================
function hitungDurasiDateTime(dtMulai, dtSelesai) {
    if (!dtMulai || !dtSelesai) return null;
    const diff = Math.floor((dtSelesai - dtMulai) / 60000);
    return diff > 0 ? diff : null;
}

// ==========================================
// HELPER: Hitung durasi harian dari string jam "HH:MM"
// ==========================================
function hitungDurasiJam(jamMulai, jamSelesai) {
    if (!jamMulai || !jamSelesai) return null;
    const [hM, mM] = jamMulai.split(':').map(Number);
    const [hS, mS] = jamSelesai.split(':').map(Number);
    let totalMulai = hM * 60 + mM;
    let totalSelesai = hS * 60 + mS;
    if (totalSelesai < totalMulai) totalSelesai += 24 * 60;
    const diff = totalSelesai - totalMulai;
    return diff > 0 ? diff : null;
}

// ==========================================
// HELPER: Format menit → "X hari Y jam Z menit"
// ==========================================
function formatDurasi(menit) {
    if (!menit || menit <= 0) return null;
    const hari = Math.floor(menit / 1440);
    const sisaSetelahHari = menit % 1440;
    const jam = Math.floor(sisaSetelahHari / 60);
    const sisa = sisaSetelahHari % 60;
    const parts = [];
    if (hari > 0) parts.push(hari + ' hari');
    if (jam > 0) parts.push(jam + ' jam');
    if (sisa > 0) parts.push(sisa + ' menit');
    return parts.length > 0 ? parts.join(' ') : '0 menit';
}

function getYearOptions() {
    const years = [];
    for (let y = new Date().getFullYear(); y >= 2024; y--) years.push(y);
    return years;
}

// ==========================================
// 1. VIEWER MODE
// ==========================================
app.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const now = new Date();
        let selectedDate;
        if (date) {
            const [year, month, day] = date.split('-');
            selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
            selectedDate = now;
        }
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
        const endDate   = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

        const journals = await prisma.journal.findMany({
            where: {
                OR: [
                    { tipeInput: { not: 'multihari' }, tanggalManual: { gte: startDate, lte: endDate } },
                    { tipeInput: 'multihari', tanggalMulai: { lte: endDate }, tanggalSelesai: { gte: startDate } }
                ]
            },
            orderBy: { tanggalManual: 'desc' }
        });

        res.render('index', {
            journals,
            filterInfo: {
                date: selectedDate.toISOString().split('T')[0],
                dateDisplay: selectedDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                month: now.getMonth() + 1,
                year: now.getFullYear()
            },
            yearOptions: getYearOptions(),
            formatDurasi
        });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
});

// ==========================================
// 2. ADMIN MODE
// ==========================================
app.get('/kerja', async (req, res) => {
    try {
        const { month, year, status, saved } = req.query;
        let whereClause = {};
        if (month && year) {
            const m = parseInt(month), y = parseInt(year);
            const startDate = new Date(y, m - 1, 1);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            whereClause = {
                OR: [
                    { tipeInput: { not: 'multihari' }, tanggalManual: { gte: startDate, lte: endDate } },
                    { tipeInput: 'multihari', tanggalMulai: { lte: endDate }, tanggalSelesai: { gte: startDate } }
                ]
            };
        }
        if (status && status !== '') {
            if (whereClause.OR) {
                whereClause = { AND: [{ OR: whereClause.OR }, { status }] };
            } else {
                whereClause.status = status;
            }
        }
        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        res.render('admin', { journals, yearOptions: getYearOptions(), saved: saved === '1', formatDurasi });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
});

// ==========================================
// 3. SIMPAN DATA BARU
// ==========================================
app.post('/save', uploadFields, async (req, res) => {
    try {
        // Ambil semua field dengan fallback kosong
        const aktivitas          = req.body.aktivitas          || '';
        const divisi             = req.body.divisi             || '';
        const deskripsi          = req.body.deskripsi          || '';
        const status             = req.body.status             || 'Pending';
        const pemesan            = req.body.pemesan            || '';
        const tipeInput          = req.body.tipeInput          || 'harian';
        const tanggalManual      = req.body.tanggalManual      || '';
        const jamMulai           = req.body.jamMulai           || '';
        const jamSelesai         = req.body.jamSelesai         || '';
        const tanggalMulaiDate   = req.body.tanggalMulaiDate   || '';
        const jamMulaiMulti      = req.body.jamMulaiMulti      || '';
        const tanggalSelesaiDate = req.body.tanggalSelesaiDate || '';
        const jamSelesaiMulti    = req.body.jamSelesaiMulti    || '';

        const fotoFile     = req.files && req.files['foto']     ? req.files['foto'][0]     : null;
        const fotoAwalFile = req.files && req.files['fotoAwal'] ? req.files['fotoAwal'][0] : null;

        let dataToSave = {
            aktivitas, divisi, pemesan, deskripsi, status, tipeInput,
            fotoUrl:     fotoFile     ? '/uploads/' + fotoFile.filename     : null,
            fotoAwalUrl: fotoAwalFile ? '/uploads/' + fotoAwalFile.filename : null
        };

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate, jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);

            if (!dtMulai)   return res.status(400).send('Gagal: Tanggal Mulai tidak valid. Pastikan format YYYY-MM-DD.');
            if (!dtSelesai) return res.status(400).send('Gagal: Tanggal Selesai tidak valid. Pastikan format YYYY-MM-DD.');
            if (dtSelesai <= dtMulai) return res.status(400).send('Gagal: Tanggal Selesai harus lebih besar dari Tanggal Mulai.');

            dataToSave.tanggalManual  = dtMulai;
            dataToSave.tanggalMulai   = dtMulai;
            dataToSave.tanggalSelesai = dtSelesai;
            dataToSave.jamMulai       = jamMulaiMulti   || null;
            dataToSave.jamSelesai     = jamSelesaiMulti || null;
            dataToSave.durasiMenit    = hitungDurasiDateTime(dtMulai, dtSelesai);
        } else {
            const tanggalObj = buildDateTime(tanggalManual, jamMulai);
            if (!tanggalObj) return res.status(400).send('Gagal: Tanggal tidak valid. Pastikan sudah diisi.');

            dataToSave.tanggalManual = tanggalObj;
            dataToSave.jamMulai      = jamMulai   || null;
            dataToSave.jamSelesai    = jamSelesai || null;
            dataToSave.durasiMenit   = hitungDurasiJam(jamMulai, jamSelesai);
        }

        await prisma.journal.create({ data: dataToSave });
        res.redirect('/kerja?saved=1');
    } catch (error) {
        console.error('[SAVE ERROR]', error.message);
        res.status(500).send("Gagal Simpan: " + error.message);
    }
});

// ==========================================
// 4. UPDATE STATUS
// ==========================================
app.post('/update-status/:id', async (req, res) => {
    try {
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.newStatus } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Update."); }
});

// ==========================================
// 5a. UPLOAD FOTO SESUDAH SUSULAN
// ==========================================
app.post('/upload-foto/:id', upload.single('foto'), async (req, res) => {
    try {
        if (req.file) await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl: '/uploads/' + req.file.filename } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload."); }
});

// ==========================================
// 5b. UPLOAD FOTO AWAL SUSULAN
// ==========================================
app.post('/upload-foto-awal/:id', upload.single('fotoAwal'), async (req, res) => {
    try {
        if (req.file) await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl: '/uploads/' + req.file.filename } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload Awal."); }
});

// ==========================================
// 6. EDIT DATA
// ==========================================
app.post('/edit/:id', uploadFields, async (req, res) => {
    try {
        const aktivitas          = req.body.aktivitas          || '';
        const divisi             = req.body.divisi             || '';
        const deskripsi          = req.body.deskripsi          || '';
        const status             = req.body.status             || 'Pending';
        const pemesan            = req.body.pemesan            || '';
        const tipeInput          = req.body.tipeInput          || 'harian';
        const tanggalManual      = req.body.tanggalManual      || '';
        const jamMulai           = req.body.jamMulai           || '';
        const jamSelesai         = req.body.jamSelesai         || '';
        const tanggalMulaiDate   = req.body.tanggalMulaiDate   || '';
        const jamMulaiMulti      = req.body.jamMulaiMulti      || '';
        const tanggalSelesaiDate = req.body.tanggalSelesaiDate || '';
        const jamSelesaiMulti    = req.body.jamSelesaiMulti    || '';

        const fotoFile     = req.files && req.files['foto']     ? req.files['foto'][0]     : null;
        const fotoAwalFile = req.files && req.files['fotoAwal'] ? req.files['fotoAwal'][0] : null;

        let updateData = { aktivitas, divisi, pemesan, deskripsi, status, tipeInput };
        if (fotoFile)     updateData.fotoUrl     = '/uploads/' + fotoFile.filename;
        if (fotoAwalFile) updateData.fotoAwalUrl = '/uploads/' + fotoAwalFile.filename;

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate, jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);

            if (!dtMulai)   return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai) return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');

            updateData.tanggalManual  = dtMulai;
            updateData.tanggalMulai   = dtMulai;
            updateData.tanggalSelesai = dtSelesai;
            updateData.jamMulai       = jamMulaiMulti   || null;
            updateData.jamSelesai     = jamSelesaiMulti || null;
            updateData.durasiMenit    = hitungDurasiDateTime(dtMulai, dtSelesai);
        } else {
            const tanggalObj = buildDateTime(tanggalManual, jamMulai);
            if (!tanggalObj) return res.status(400).send('Gagal: Tanggal tidak valid.');

            updateData.tanggalManual  = tanggalObj;
            updateData.tanggalMulai   = null;
            updateData.tanggalSelesai = null;
            updateData.jamMulai       = jamMulai   || null;
            updateData.jamSelesai     = jamSelesai || null;
            updateData.durasiMenit    = hitungDurasiJam(jamMulai, jamSelesai);
        }

        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: updateData });
        res.redirect('/kerja');
    } catch (error) {
        console.error('[EDIT ERROR]', error.message);
        res.status(500).send("Gagal Edit: " + error.message);
    }
});

// ==========================================
// 7. DELETE DATA
// ==========================================
app.post('/delete/:id', async (req, res) => {
    try {
        const item = await prisma.journal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item) {
            [item.fotoUrl, item.fotoAwalUrl].forEach(u => {
                if (u) { const p = path.join(__dirname, 'public', u); if (fs.existsSync(p)) fs.unlinkSync(p); }
            });
        }
        await prisma.journal.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Delete."); }
});

// ==========================================
// 8. EXPORT EXCEL
// ==========================================
app.get('/export', async (req, res) => {
    try {
        const { date, month, year } = req.query;
        let whereClause = {}, fileName = 'Log-IT.xlsx';
        if (date) {
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
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '161B22' } };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
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
                tglMulai:   isMulti ? fmtDate(item.tanggalMulai, item.jamMulai) : fmtDate(item.tanggalManual, item.jamMulai),
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

        worksheet.eachRow(row => row.eachCell(cell => cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        await workbook.xlsx.write(res); res.end();
    } catch (error) { console.error(error); res.status(500).send("Gagal Export."); }
});

// ==========================================
// 9. NOTES
// ==========================================
app.get('/api/notes', async (req, res) => {
    try { res.json(await prisma.note.findMany({ orderBy: { createdAt: 'desc' } })); }
    catch (e) { res.status(500).json({ error: "Gagal ambil notes" }); }
});
app.post('/api/notes', async (req, res) => {
    try { res.json(await prisma.note.create({ data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: "Gagal tambah notes" }); }
});
app.put('/api/notes/:id', async (req, res) => {
    try { res.json(await prisma.note.update({ where: { id: parseInt(req.params.id) }, data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: "Gagal update notes" }); }
});
app.delete('/api/notes/:id', async (req, res) => {
    try { await prisma.note.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: "Gagal hapus notes" }); }
});

app.listen(3001, '0.0.0.0', () => console.log('🚀 SYSTEM READY AT PORT 3001'));

// ==========================================
// ASET — MASTER LIST
// ==========================================
app.get('/aset', async (req, res) => {
    try {
        const { q, kategori } = req.query;
        let where = {};
        if (q) where.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: {
                _count: { select: { pinjaman: { where: { status: 'Dipinjam' } } } }
            }
        });

        // Ambil kategori unik untuk filter dropdown
        const allKategori = await prisma.aset.findMany({ select: { kategori: true }, distinct: ['kategori'] });

        res.render('aset', { aset, allKategori: allKategori.map(k => k.kategori), q: q || '', kategori: kategori || '' });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

// ==========================================
// ASET — DETAIL & RIWAYAT
// ==========================================
app.get('/aset/:id', async (req, res) => {
    try {
        const aset = await prisma.aset.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } }
            }
        });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        res.render('aset-detail', { aset });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

// ==========================================
// ASET — TAMBAH MASTER
// ==========================================
app.post('/aset/tambah', async (req, res) => {
    try {
        const { nama, kategori, satuan, stok, kondisi, keterangan } = req.body;
        const stokNum = parseInt(stok) || 0;
        await prisma.aset.create({
            data: { nama, kategori, satuan, stokAwal: stokNum, stok: stokNum, kondisi, keterangan: keterangan || null }
        });
        res.redirect('/aset?saved=1');
    } catch (error) { console.error(error); res.status(500).send("Gagal tambah aset: " + error.message); }
});

// ==========================================
// ASET — EDIT MASTER
// ==========================================
app.post('/aset/edit/:id', async (req, res) => {
    try {
        const { nama, kategori, satuan, stokAwal, kondisi, keterangan } = req.body;
        const stokAwalNum = parseInt(stokAwal) || 0;
        // Hitung stok sekarang: stokAwal - total_penggunaan - total_pinjaman_aktif
        const totalPakai = await prisma.asetPenggunaan.aggregate({ where: { asetId: parseInt(req.params.id) }, _sum: { jumlah: true } });
        const totalPinjam = await prisma.asetPinjam.aggregate({ where: { asetId: parseInt(req.params.id), status: 'Dipinjam' }, _sum: { jumlah: true } });
        const stokBaru = stokAwalNum - (totalPakai._sum.jumlah || 0) - (totalPinjam._sum.jumlah || 0);
        await prisma.aset.update({
            where: { id: parseInt(req.params.id) },
            data: { nama, kategori, satuan, stokAwal: stokAwalNum, stok: stokBaru, kondisi, keterangan: keterangan || null }
        });
        res.redirect('/aset');
    } catch (error) { console.error(error); res.status(500).send("Gagal edit aset: " + error.message); }
});

// ==========================================
// ASET — HAPUS MASTER
// ==========================================
app.post('/aset/hapus/:id', async (req, res) => {
    try {
        await prisma.aset.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/aset');
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus: " + error.message); }
});

// ==========================================
// ASET — CATAT PENGGUNAAN (potong stok)
// ==========================================
app.post('/aset/pakai/:id', async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, divisi, lokasi, keterangan, tanggal } = req.body;
        const jml = parseInt(jumlah) || 1;

        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);

        await prisma.$transaction([
            prisma.asetPenggunaan.create({
                data: {
                    asetId, jumlah: jml, divisi, lokasi,
                    keterangan: keterangan || null,
                    tanggal: tanggal ? new Date(tanggal) : new Date()
                }
            }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pakai');
    } catch (error) { console.error(error); res.status(500).send("Gagal catat penggunaan: " + error.message); }
});

// ==========================================
// ASET — HAPUS PENGGUNAAN (kembalikan stok)
// ==========================================
app.post('/aset/pakai-hapus/:penggunaanId', async (req, res) => {
    try {
        const penggunaan = await prisma.asetPenggunaan.findUnique({ where: { id: parseInt(req.params.penggunaanId) } });
        if (!penggunaan) return res.status(404).send("Data tidak ditemukan");
        await prisma.$transaction([
            prisma.aset.update({ where: { id: penggunaan.asetId }, data: { stok: { increment: penggunaan.jumlah } } }),
            prisma.asetPenggunaan.delete({ where: { id: parseInt(req.params.penggunaanId) } })
        ]);
        res.redirect('/aset/' + penggunaan.asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus penggunaan: " + error.message); }
});

// ==========================================
// ASET — CATAT PINJAMAN (potong stok)
// ==========================================
app.post('/aset/pinjam/:id', async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, peminjam, divisi, keperluan, tanggalPinjam } = req.body;
        const jml = parseInt(jumlah) || 1;

        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);

        await prisma.$transaction([
            prisma.asetPinjam.create({
                data: {
                    asetId, jumlah: jml, peminjam, divisi,
                    keperluan: keperluan || null,
                    tanggalPinjam: tanggalPinjam ? new Date(tanggalPinjam) : new Date(),
                    status: 'Dipinjam'
                }
            }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pinjam');
    } catch (error) { console.error(error); res.status(500).send("Gagal catat pinjaman: " + error.message); }
});

// ==========================================
// ASET — KEMBALIKAN PINJAMAN (naikkan stok)
// ==========================================
app.post('/aset/kembali/:pinjamId', async (req, res) => {
    try {
        const pinjam = await prisma.asetPinjam.findUnique({ where: { id: parseInt(req.params.pinjamId) } });
        if (!pinjam) return res.status(404).send("Data pinjaman tidak ditemukan");
        if (pinjam.status === 'Dikembalikan') return res.status(400).send("Sudah dikembalikan.");

        await prisma.$transaction([
            prisma.asetPinjam.update({
                where: { id: parseInt(req.params.pinjamId) },
                data: { status: 'Dikembalikan', tanggalKembali: new Date() }
            }),
            prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } })
        ]);
        res.redirect('/aset/' + pinjam.asetId + '?saved=kembali');
    } catch (error) { console.error(error); res.status(500).send("Gagal proses kembali: " + error.message); }
});

// ==========================================
// ASET — HAPUS PINJAMAN (batalkan, kembalikan stok)
// ==========================================
app.post('/aset/pinjam-hapus/:pinjamId', async (req, res) => {
    try {
        const pinjam = await prisma.asetPinjam.findUnique({ where: { id: parseInt(req.params.pinjamId) } });
        if (!pinjam) return res.status(404).send("Tidak ditemukan");
        const ops = [prisma.asetPinjam.delete({ where: { id: parseInt(req.params.pinjamId) } })];
        if (pinjam.status === 'Dipinjam') {
            ops.push(prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } }));
        }
        await prisma.$transaction(ops);
        res.redirect('/aset/' + pinjam.asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus: " + error.message); }
});