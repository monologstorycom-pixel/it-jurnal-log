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

// Bikin folder uploads otomatis kalau belum ada
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- BUKA AKSES FOLDER UNTUK FOTO & PWA ---
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public'))); // Wajib biar sw.js, manifest & icon terbaca

// Konfigurasi Upload File
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'IT-LOG-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 1. VIEWER MODE (AUTO FILTER BULAN BERJALAN)
// ==========================================
app.get('/', async (req, res) => {
    try {
        const { month, year } = req.query;
        let whereClause = {};
        
        const now = new Date();
        const currentMonth = month ? parseInt(month) : now.getMonth() + 1;
        const currentYear = year ? parseInt(year) : now.getFullYear();

        const startDate = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0);
        const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        whereClause = { tanggalManual: { gte: startDate, lte: endDate } };

        const journals = await prisma.journal.findMany({ 
            where: whereClause, orderBy: { tanggalManual: 'desc' } 
        });

        res.render('index', { journals, filterInfo: { month: currentMonth, year: currentYear } });
    } catch (error) { res.status(500).send("Database Error!"); }
});

// ==========================================
// 2. ADMIN MODE (KERJA MODE)
// ==========================================
app.get('/kerja', async (req, res) => {
    try {
        const { month, year } = req.query;
        let whereClause = {};

        if (month && year) {
            const m = parseInt(month); const y = parseInt(year);
            const startDate = new Date(y, m - 1, 1, 0, 0, 0);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
        }

        const journals = await prisma.journal.findMany({ 
            where: whereClause, orderBy: { tanggalManual: 'desc' } 
        });
        res.render('admin', { journals });
    } catch (error) { res.status(500).send("Database Error!"); }
});

// ==========================================
// 3. SIMPAN DATA
// ==========================================
app.post('/save', upload.single('foto'), async (req, res) => {
    try {
        const { aktivitas, divisi, deskripsi, status, pemesan, tanggalManual } = req.body;
        await prisma.journal.create({
            data: { aktivitas, divisi, pemesan, deskripsi, status, tanggalManual: new Date(tanggalManual), fotoUrl: req.file ? '/uploads/' + req.file.filename : null }
        });
        res.redirect('/kerja');
    } catch (error) { res.status(500).send("Gagal Simpan."); }
});

// ==========================================
// 4. UPDATE STATUS (PENDING -> SOLVED)
// ==========================================
app.post('/update-status/:id', async (req, res) => {
    try {
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.newStatus } });
        res.redirect('/kerja');
    } catch (error) { res.status(500).send("Gagal Update."); }
});

// ==========================================
// 5. UPLOAD FOTO SUSULAN (KALAU KELUPAAN)
// ==========================================
app.post('/upload-foto/:id', upload.single('foto'), async (req, res) => {
    try {
        if (req.file) {
            await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl: '/uploads/' + req.file.filename } });
        }
        res.redirect('/kerja');
    } catch (error) { res.status(500).send("Gagal Upload Foto."); }
});

// ==========================================
// 6. EXPORT EXCEL AESTHETIC (STRICT FILTER)
// ==========================================
app.get('/export', async (req, res) => {
    try {
        const { month, year } = req.query;
        let whereClause = {};

        if (month && year) {
            const m = parseInt(month); const y = parseInt(year);
            const startDate = new Date(y, m - 1, 1, 0, 0, 0);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
        }

        const journals = await prisma.journal.findMany({ where: whereClause, orderBy: { tanggalManual: 'desc' } });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('IT Support Log');

        worksheet.columns = [
            { header: 'TANGGAL & JAM', key: 'waktu', width: 25 }, { header: 'DIVISI', key: 'divisi', width: 20 },
            { header: 'USER / PEMESAN', key: 'pemesan', width: 25 }, { header: 'AKTIVITAS', key: 'aktivitas', width: 30 },
            { header: 'DESKRIPSI', key: 'deskripsi', width: 45 }, { header: 'STATUS', key: 'status', width: 15 }, { header: 'DOKUMENTASI', key: 'foto', width: 15 },
        ];

        worksheet.getRow(1).eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '161B22' } }; cell.font = { color: { argb: 'FFFFFF' }, bold: true }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

        if (journals.length === 0) {
            const emptyRow = worksheet.addRow({ waktu: `TIDAK ADA DATA DI BULAN INI`, divisi: '-', pemesan: '-', aktivitas: '-', deskripsi: '-', status: '-' });
            emptyRow.font = { color: { argb: 'FF0000' }, italic: true, bold: true };
        } else {
            journals.forEach((item, index) => {
                const row = worksheet.addRow({
                    waktu: new Date(item.tanggalManual).toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace(/\./g, ':'),
                    divisi: item.divisi, pemesan: item.pemesan, aktivitas: item.aktivitas, deskripsi: item.deskripsi, status: item.status
                });
                if (index % 2 !== 0) { row.eachCell((cell) => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9F9F9' } }); }
                if (item.fotoUrl) { row.getCell('foto').value = { text: 'LIHAT FOTO', hyperlink: `http://server.rsby.cloud:3001${item.fotoUrl}` }; row.getCell('foto').font = { color: { argb: '0000FF' }, underline: true }; }
            });
        }

        worksheet.eachRow((row) => { row.eachCell((cell) => cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }); });

        const fileName = month ? `Log-IT-${month}-${year}.xlsx` : `Log-IT-All.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res); res.end();
    } catch (error) { res.status(500).send("Gagal Export."); }
});

app.listen(3001, '0.0.0.0', () => console.log('🚀 SYSTEM READY AT PORT 3001'));