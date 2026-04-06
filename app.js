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
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Upload File
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'IT-LOG-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Helper: generate array tahun dari 2024 sampai tahun sekarang
function getYearOptions() {
    const startYear = 2024;
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= startYear; y--) {
        years.push(y);
    }
    return years;
}

// ==========================================
// 1. VIEWER MODE (AUTO FILTER HARI INI)
// ==========================================
app.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        const now = new Date();
        
        // Default to today if no date provided
        let selectedDate;
        if (date) {
            // Parse the date string correctly as local date (not UTC)
            const [year, month, day] = date.split('-');
            selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
            selectedDate = now;
        }
        
        // Get start and end of day in local timezone
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
        const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

        const whereClause = { tanggalManual: { gte: startDate, lte: endDate } };

        const journals = await prisma.journal.findMany({ 
            where: whereClause, orderBy: { tanggalManual: 'desc' } 
        });

        // Format date for display and input
        const formattedDate = selectedDate.toISOString().split('T')[0];
        const dateDisplay = selectedDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        res.render('index', { 
            journals, 
            filterInfo: { date: formattedDate, dateDisplay: dateDisplay, month: currentMonth, year: currentYear },
            yearOptions: getYearOptions()
        });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
});

// ==========================================
// 2. ADMIN MODE (KERJA MODE)
// ==========================================
app.get('/kerja', async (req, res) => {
    try {
<<<<<<< Updated upstream
        const { month, year, status } = req.query;
=======
        const { month, year, status, saved } = req.query;
>>>>>>> Stashed changes
        let whereClause = {};

        if (month && year) {
            const m = parseInt(month); const y = parseInt(year);
            const startDate = new Date(y, m - 1, 1, 0, 0, 0);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
        }

<<<<<<< Updated upstream
        // Add status filter if specified
=======
>>>>>>> Stashed changes
        if (status && status !== '') {
            whereClause.status = status;
        }

        const journals = await prisma.journal.findMany({ 
            where: whereClause, orderBy: { tanggalManual: 'desc' } 
        });

        res.render('admin', { journals, yearOptions: getYearOptions(), saved: saved === '1' });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
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
        res.redirect('/kerja?saved=1');
    } catch (error) { console.error(error); res.status(500).send("Gagal Simpan."); }
});

// ==========================================
// 4. UPDATE STATUS (PENDING -> SOLVED)
// ==========================================
app.post('/update-status/:id', async (req, res) => {
    try {
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.newStatus } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Update."); }
});

// ==========================================
// 5. UPLOAD FOTO SUSULAN
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
// 6. EDIT DATA JURNAL
// ==========================================
app.post('/edit/:id', upload.single('foto'), async (req, res) => {
    try {
        const { aktivitas, divisi, deskripsi, status, pemesan, tanggalManual } = req.body;
        const updateData = {
            aktivitas,
            divisi,
            pemesan,
            deskripsi,
            status,
            tanggalManual: new Date(tanggalManual)
        };
        if (req.file) {
            updateData.fotoUrl = '/uploads/' + req.file.filename;
        }
        await prisma.journal.update({
            where: { id: parseInt(req.params.id) },
            data: updateData
        });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Edit Data."); }
});

// ==========================================
// 7. DELETE DATA JURNAL
// ==========================================
app.post('/delete/:id', async (req, res) => {
    try {
        // Ambil data dulu buat hapus foto fisiknya sekalian kalau ada
        const item = await prisma.journal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item && item.fotoUrl) {
            const fotoPath = path.join(__dirname, 'public', item.fotoUrl);
            if (fs.existsSync(fotoPath)) {
                fs.unlinkSync(fotoPath);
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
            // Export by specific date
            const selectedDate = new Date(date);
            const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
            const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
            fileName = `Log-IT-${date}.xlsx`;
        } else if (month && year) {
            // Backward compatibility: export by month
            const m = parseInt(month); const y = parseInt(year);
            const startDate = new Date(y, m - 1, 1, 0, 0, 0);
            const endDate = new Date(y, m, 0, 23, 59, 59);
            whereClause = { tanggalManual: { gte: startDate, lte: endDate } };
            fileName = `Log-IT-${month}-${year}.xlsx`;
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
            const emptyRow = worksheet.addRow({ waktu: `TIDAK ADA DATA`, divisi: '-', pemesan: '-', aktivitas: '-', deskripsi: '-', status: '-' });
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

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res); res.end();
    } catch (error) { console.error(error); res.status(500).send("Gagal Export."); }
});

app.listen(3001, '0.0.0.0', () => console.log('🚀 SYSTEM READY AT PORT 3001'));
