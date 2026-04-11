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

// Upload config — support multiple fields (fotoAwal + foto)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'fotoAwal' ? 'IT-AWAL-' : 'IT-LOG-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const uploadFields = upload.fields([
    { name: 'fotoAwal', maxCount: 1 },
    { name: 'foto', maxCount: 1 }
]);

// ==========================================
// HELPER: Hitung durasi dari jamMulai & jamSelesai
// ==========================================
function hitungDurasi(jamMulai, jamSelesai) {
    if (!jamMulai || !jamSelesai) return null;
    const [hM, mM] = jamMulai.split(':').map(Number);
    const [hS, mS] = jamSelesai.split(':').map(Number);
    let totalMulai = hM * 60 + mM;
    let totalSelesai = hS * 60 + mS;
    // Handle lintas tengah malam
    if (totalSelesai < totalMulai) totalSelesai += 24 * 60;
    const diff = totalSelesai - totalMulai;
    return diff > 0 ? diff : null;
}

// ==========================================
// HELPER: Format durasi menit → string tampil
// ==========================================
function formatDurasi(menit) {
    if (!menit || menit <= 0) return null;
    if (menit < 60) return `${menit} menit`;
    const jam = Math.floor(menit / 60);
    const sisa = menit % 60;
    return sisa > 0 ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

// ==========================================
// HELPER: Tahun options
// ==========================================
function getYearOptions() {
    const startYear = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= startYear; y--) years.push(y);
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
        const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
        const whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        const formattedDate = selectedDate.toISOString().split('T')[0];
        const dateDisplay = selectedDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        res.render('index', {
            journals,
            filterInfo: { date: formattedDate, dateDisplay, month: currentMonth, year: currentYear },
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
            const m = parseInt(month); const y = parseInt(year);
            whereClause = { tanggalManual: { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) } };
        }
        if (status && status !== '') whereClause.status = status;
        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        res.render('admin', { journals, yearOptions: getYearOptions(), saved: saved === '1', formatDurasi });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
});

// ==========================================
// 3. SIMPAN DATA
// ==========================================
app.post('/save', uploadFields, async (req, res) => {
    try {
        const { aktivitas, divisi, deskripsi, status, pemesan, tanggalManual, jamMulai, jamSelesai } = req.body;
        const durasiMenit = hitungDurasi(jamMulai, jamSelesai);
        const fotoFile = req.files?.foto?.[0];
        const fotoAwalFile = req.files?.fotoAwal?.[0];
        await prisma.journal.create({
            data: {
                aktivitas, divisi, pemesan, deskripsi, status,
                tanggalManual: new Date(tanggalManual),
                jamMulai: jamMulai || null,
                jamSelesai: jamSelesai || null,
                durasiMenit: durasiMenit,
                fotoUrl: fotoFile ? '/uploads/' + fotoFile.filename : null,
                fotoAwalUrl: fotoAwalFile ? '/uploads/' + fotoAwalFile.filename : null
            }
        });
        res.redirect('/kerja?saved=1');
    } catch (error) { console.error(error); res.status(500).send("Gagal Simpan."); }
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
// 5. UPLOAD FOTO SUSULAN (tetap support single foto sesudah)
// ==========================================
app.post('/upload-foto/:id', upload.single('foto'), async (req, res) => {
    try {
        if (req.file) {
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl: '/uploads/' + req.file.filename } });
        }
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload Foto."); }
});

// ==========================================
// 5b. UPLOAD FOTO AWAL SUSULAN
// ==========================================
app.post('/upload-foto-awal/:id', upload.single('fotoAwal'), async (req, res) => {
    try {
        if (req.file) {
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl: '/uploads/' + req.file.filename } });
        }
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload Foto Awal."); }
});

// ==========================================
// 6. EDIT DATA
// ==========================================
app.post('/edit/:id', uploadFields, async (req, res) => {
    try {
        const { aktivitas, divisi, deskripsi, status, pemesan, tanggalManual, jamMulai, jamSelesai } = req.body;
        const durasiMenit = hitungDurasi(jamMulai, jamSelesai);
        const fotoFile = req.files?.foto?.[0];
        const fotoAwalFile = req.files?.fotoAwal?.[0];
        const updateData = {
            aktivitas, divisi, pemesan, deskripsi, status,
            tanggalManual: new Date(tanggalManual),
            jamMulai: jamMulai || null,
            jamSelesai: jamSelesai || null,
            durasiMenit: durasiMenit
        };
        if (fotoFile) updateData.fotoUrl = '/uploads/' + fotoFile.filename;
        if (fotoAwalFile) updateData.fotoAwalUrl = '/uploads/' + fotoAwalFile.filename;
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: updateData });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Edit Data."); }
});

// ==========================================
// 7. DELETE DATA
// ==========================================
app.post('/delete/:id', async (req, res) => {
    try {
        const item = await prisma.journal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item) {
            // Hapus foto sesudah
            if (item.fotoUrl) {
                const p = path.join(__dirname, 'public', item.fotoUrl);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            // Hapus foto awal
            if (item.fotoAwalUrl) {
                const p = path.join(__dirname, 'public', item.fotoAwalUrl);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
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
        let whereClause = {};
        let fileName = 'Log-IT.xlsx';

        if (date) {
            const selectedDate = new Date(date);
            const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
            const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
            fileName = `Log-IT-${date}.xlsx`;
        } else if (month && year) {
            const m = parseInt(month); const y = parseInt(year);
            whereClause = { tanggalManual: { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) } };
            fileName = `Log-IT-${month}-${year}.xlsx`;
        }

        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('IT Support Log');

        worksheet.columns = [
            { header: 'TANGGAL', key: 'tanggal', width: 18 },
            { header: 'JAM MULAI', key: 'jamMulai', width: 12 },
            { header: 'JAM SELESAI', key: 'jamSelesai', width: 12 },
            { header: 'DURASI', key: 'durasi', width: 16 },
            { header: 'DIVISI', key: 'divisi', width: 20 },
            { header: 'USER / PEMESAN', key: 'pemesan', width: 25 },
            { header: 'AKTIVITAS', key: 'aktivitas', width: 30 },
            { header: 'DESKRIPSI', key: 'deskripsi', width: 45 },
            { header: 'STATUS', key: 'status', width: 12 },
            { header: 'FOTO AWAL', key: 'fotoAwal', width: 15 },
            { header: 'FOTO SESUDAH', key: 'foto', width: 15 },
        ];

        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '161B22' } };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        if (journals.length === 0) {
            const emptyRow = worksheet.addRow({ tanggal: 'TIDAK ADA DATA', jamMulai: '-', jamSelesai: '-', durasi: '-', divisi: '-', pemesan: '-', aktivitas: '-', deskripsi: '-', status: '-' });
            emptyRow.font = { color: { argb: 'FF0000' }, italic: true, bold: true };
        } else {
            journals.forEach((item, index) => {
                const row = worksheet.addRow({
                    tanggal: new Date(item.tanggalManual).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                    jamMulai: item.jamMulai || '-',
                    jamSelesai: item.jamSelesai || '-',
                    durasi: item.durasiMenit ? formatDurasi(item.durasiMenit) : '-',
                    divisi: item.divisi,
                    pemesan: item.pemesan,
                    aktivitas: item.aktivitas,
                    deskripsi: item.deskripsi,
                    status: item.status
                });
                if (index % 2 !== 0) {
                    row.eachCell((cell) => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9F9F9' } });
                }
                const base = 'http://server.rsby.cloud:3001';
                if (item.fotoAwalUrl) {
                    row.getCell('fotoAwal').value = { text: 'LIHAT FOTO AWAL', hyperlink: `${base}${item.fotoAwalUrl}` };
                    row.getCell('fotoAwal').font = { color: { argb: '0000FF' }, underline: true };
                }
                if (item.fotoUrl) {
                    row.getCell('foto').value = { text: 'LIHAT FOTO SESUDAH', hyperlink: `${base}${item.fotoUrl}` };
                    row.getCell('foto').font = { color: { argb: '0000FF' }, underline: true };
                }
            });
        }

        worksheet.eachRow((row) => {
            row.eachCell((cell) => cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { console.error(error); res.status(500).send("Gagal Export."); }
});

// ==========================================
// 9. NOTES MANAGEMENT
// ==========================================
app.get('/api/notes', async (req, res) => {
    try {
        const notes = await prisma.note.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(notes);
    } catch (error) { res.status(500).json({ error: "Gagal ambil notes" }); }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { title, content } = req.body;
        const note = await prisma.note.create({ data: { title, content } });
        res.json(note);
    } catch (error) { res.status(500).json({ error: "Gagal tambah notes" }); }
});

app.put('/api/notes/:id', async (req, res) => {
    try {
        const { title, content } = req.body;
        const note = await prisma.note.update({ where: { id: parseInt(req.params.id) }, data: { title, content } });
        res.json(note);
    } catch (error) { res.status(500).json({ error: "Gagal update notes" }); }
});

app.delete('/api/notes/:id', async (req, res) => {
    try {
        await prisma.note.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Gagal hapus notes" }); }
});

app.listen(3001, '0.0.0.0', () => console.log('🚀 SYSTEM READY AT PORT 3001'));
