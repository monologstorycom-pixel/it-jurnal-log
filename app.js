const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const prisma = new PrismaClient();

// FIX FOTO HILANG: gunakan path.resolve untuk absolute path yang konsisten
const uploadDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// FIX FOTO HILANG: static harus pakai absolute path
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.resolve(__dirname, 'public')));

// ==========================================
// SESSION
// ==========================================
app.use(session({
    secret: 'itlog-rsby-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// ==========================================
// PERMISSION HELPERS — MURNI DARI CHECKBOX
// ==========================================
// Tidak ada default role, tidak ada auto-assign.
// Semua hak akses ditentukan HANYA dari field permissions di DB.
// Kalau permissions null/kosong (user lama), fallback ke semua false.

function getUserPerms(user) {
    if (!user) return {};
    if (user.permissions) {
        try {
            const p = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            // Pastikan semua key ada (default false kalau tidak ada)
            return {
                canView:   p.canView   === true,
                canAdd:    p.canAdd    === true,
                canEdit:   p.canEdit   === true,
                canDelete: p.canDelete === true,
                canAsset:  p.canAsset  === true,
                canExport: p.canExport === true,
                canUsers:  p.canUsers  === true,
            };
        } catch(e) {}
    }
    // User lama tanpa permissions field: semua false (aman)
    return { canView:false, canAdd:false, canEdit:false, canDelete:false, canAsset:false, canExport:false, canUsers:false };
}

function hasPerm(user, perm) {
    if (!user) return false;
    const perms = getUserPerms(user);
    return perms[perm] === true;
}

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && hasPerm(req.session.user, 'canUsers')) return next();
    res.status(403).render('403', { message: 'Halaman ini hanya untuk Admin.' });
}

function requireUser(req, res, next) {
    if (req.session && req.session.user) {
        const user = req.session.user;
        // viewer tidak bisa aksi apapun
        if (hasPerm(user, 'canAdd') || hasPerm(user, 'canEdit') || hasPerm(user, 'canAsset')) return next();
    }
    res.status(403).render('403', { message: 'Anda tidak punya izin untuk aksi ini.' });
}

// Inject user & perms ke semua views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.userPerms   = req.session.user ? getUserPerms(req.session.user) : {};
    next();
});

// ==========================================
// MULTER - FIX FOTO HILANG
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Pastikan folder ada sebelum simpan
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = file.fieldname === 'fotoAwal' ? 'IT-AWAL-' : 'IT-LOG-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan'));
    }
});
const uploadFields = upload.fields([
    { name: 'fotoAwal', maxCount: 1 },
    { name: 'foto', maxCount: 1 }
]);

// ==========================================
// HELPERS
// ==========================================
function buildDateTime(tanggal, jam) {
    if (!tanggal || tanggal.trim() === '') return null;
    const jamStr = (jam && jam.trim() !== '') ? jam.trim() : '00:00';
    const dt = new Date(tanggal.trim() + 'T' + jamStr + ':00');
    return isNaN(dt.getTime()) ? null : dt;
}

function hitungDurasiDateTime(dtMulai, dtSelesai) {
    if (!dtMulai || !dtSelesai) return null;
    const diff = Math.floor((dtSelesai - dtMulai) / 60000);
    return diff > 0 ? diff : null;
}

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

// FIX FORMAT 24 JAM
function formatTanggal(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatJamMenit(jamStr) {
    // Input sudah string "HH:MM", return langsung
    return jamStr || '';
}

function getYearOptions() {
    const years = [];
    for (let y = new Date().getFullYear(); y >= 2024; y--) years.push(y);
    return years;
}

// ==========================================
// LOGIN / LOGOUT
// ==========================================
app.get('/login', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/kerja');
    res.render('login', { error: null, username: '' });
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.render('login', { error: 'Username dan password harus diisi.', username: username || '' });
        }
        const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
        if (!user) {
            return res.render('login', { error: 'Username atau password salah.', username: username });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { error: 'Username atau password salah.', username: username });
        }
        req.session.user = {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role,
            permissions: user.permissions || null
        };
        res.redirect('/kerja');
    } catch (error) {
        console.error('[LOGIN ERROR]', error.message);
        res.render('login', { error: 'Terjadi kesalahan server. Coba lagi.', username: req.body.username || '' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.get('/403', (req, res) => {
    res.status(403).render('403', { message: 'Akses ditolak.' });
});

// ==========================================
// 1. VIEWER MODE
// ==========================================
app.get('/', async (req, res) => {
    try {
        const { date, q } = req.query;
        const now = new Date();
        let selectedDate, journals, isSearch = false;

        if (q && q.trim()) {
            // MODE SEARCH — cari semua waktu by keyword
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
            // MODE HARIAN — default
            if (date) {
                const [year, month, day] = date.split('-');
                selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
                selectedDate = now;
            }
            const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
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
// PUBLIC ASET VIEW — tanpa login, read-only
// ==========================================
app.get('/aset-public', async (req, res) => {
    try {
        const { q, kategori } = req.query;
        let where = {};
        if (q) where.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;
        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' }, take: 10 },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' }, take: 10 },
                _count: { select: { pinjaman: { where: { status: 'Dipinjam' } } } }
            }
        });
        const allKategori = await prisma.aset.findMany({ select: { kategori: true }, distinct: ['kategori'] });
        res.render('aset-public', { aset, allKategori: allKategori.map(k => k.kategori), q: q || '', kategori: kategori || '' });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// 2. DASHBOARD
// ==========================================
app.get('/kerja', requireLogin, async (req, res) => {
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

        // === STATS: data untuk hari ini ===
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const todayWhere = { OR: [
            { tipeInput: { not: 'multihari' }, tanggalManual: { gte: todayStart, lte: todayEnd } },
            { tipeInput: 'multihari', tanggalMulai: { lte: todayEnd }, tanggalSelesai: { gte: todayStart } }
        ]};
        const [totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems] = await Promise.all([
            prisma.journal.count({ where: todayWhere }),
            prisma.journal.count({ where: { AND: [todayWhere, { status: 'Solved' }] } }),
            prisma.journal.count({ where: { AND: [todayWhere, { status: 'Pending' }] } }),
            prisma.journal.count(),
            prisma.journal.count({ where: { status: 'Pending' } }),
            prisma.journal.findMany({ where: { status: 'Pending' }, orderBy: { tanggalManual: 'asc' }, take: 10,
                select: { id: true, aktivitas: true, divisi: true, pemesan: true, tanggalManual: true, durasiMenit: true,
                    deskripsi: true, status: true, tipeInput: true, jamMulai: true, jamSelesai: true,
                    tanggalMulai: true, tanggalSelesai: true }
            })
        ]);
        // Hitung berapa hari pending tiap item
        const pendingWithAge = pendingItems.map(p => {
            const tgl = p.tanggalManual ? new Date(p.tanggalManual) : new Date();
            const diffMs = Date.now() - tgl.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            return { ...p, hariPending: diffDays };
        });
        const stats = { totalHariIni, solvedHariIni, pendingHariIni, totalAllTime, pendingAllTime, pendingItems: pendingWithAge };

        res.render('admin', { journals, yearOptions: getYearOptions(), saved: saved === '1', formatDurasi, stats });
    } catch (error) { console.error(error); res.status(500).send("Database Error!"); }
});

// ==========================================
// 3. SIMPAN DATA BARU
// ==========================================
app.post('/save', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAdd')) {
        return res.status(403).render('403', { message: 'Anda tidak punya izin menambah data.' });
    }
    next();
}, uploadFields, async (req, res) => {
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

        // FIX FOTO: verifikasi file benar-benar tersimpan
        if (fotoFile) {
            const fotoPath = path.join(uploadDir, fotoFile.filename);
            if (!fs.existsSync(fotoPath)) {
                console.error('[FOTO ERROR] File tidak tersimpan:', fotoPath);
            }
        }

        let dataToSave = {
            aktivitas, divisi, pemesan, deskripsi, status, tipeInput,
            fotoUrl:     fotoFile     ? '/uploads/' + fotoFile.filename     : null,
            fotoAwalUrl: fotoAwalFile ? '/uploads/' + fotoAwalFile.filename : null
        };

        if (tipeInput === 'multihari') {
            const dtMulai   = buildDateTime(tanggalMulaiDate, jamMulaiMulti);
            const dtSelesai = buildDateTime(tanggalSelesaiDate, jamSelesaiMulti);
            if (!dtMulai)   return res.status(400).send('Gagal: Tanggal Mulai tidak valid.');
            if (!dtSelesai) return res.status(400).send('Gagal: Tanggal Selesai tidak valid.');
            if (dtSelesai <= dtMulai) return res.status(400).send('Gagal: Tanggal Selesai harus lebih besar dari Tanggal Mulai.');
            dataToSave.tanggalManual  = dtMulai;
            dataToSave.tanggalMulai   = dtMulai;
            dataToSave.tanggalSelesai = dtSelesai;
            dataToSave.jamMulai       = jamMulaiMulti   || null;
            dataToSave.jamSelesai     = jamSelesaiMulti || null;
            dataToSave.durasiMenit    = hitungDurasiDateTime(dtMulai, dtSelesai);
        } else {
            const tanggalObj = buildDateTime(tanggalManual, jamMulai);
            if (!tanggalObj) return res.status(400).send('Gagal: Tanggal tidak valid.');
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
app.post('/update-status/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.newStatus } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Update."); }
});

// ==========================================
// 5a. UPLOAD FOTO SESUDAH
// ==========================================
app.post('/upload-foto/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        if (req.file) await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl: '/uploads/' + req.file.filename } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload."); }
});

// ==========================================
// 5b. UPLOAD FOTO AWAL
// ==========================================
app.post('/upload-foto-awal/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('fotoAwal'), async (req, res) => {
    try {
        if (req.file) await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl: '/uploads/' + req.file.filename } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Upload Awal."); }
});

// ==========================================
// 6. EDIT DATA
// ==========================================
app.post('/edit/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, uploadFields, async (req, res) => {
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
app.post('/delete/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canDelete')) return res.status(403).render('403', { message: 'Akses ditolak. Hanya yang punya izin hapus.' });
    next();
}, async (req, res) => {
    try {
        const item = await prisma.journal.findUnique({ where: { id: parseInt(req.params.id) } });
        if (item) {
            [item.fotoUrl, item.fotoAwalUrl].forEach(u => {
                if (u) {
                    const p = path.join(__dirname, 'public', u);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                }
            });
        }
        await prisma.journal.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/kerja');
    } catch (error) { console.error(error); res.status(500).send("Gagal Delete."); }
});

// ==========================================
// 8. EXPORT EXCEL
// ==========================================
app.get('/export', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canExport')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
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

        // FIX FORMAT 24 JAM di Excel
        const fmtDate = (dt, jam) => {
            if (!dt) return '-';
            const d = new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return jam ? d + ' ' + jam : d; // jam sudah string HH:MM, tidak perlu konversi
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
// 8b. EXPORT EXCEL ASET
// ==========================================
app.get('/export-aset', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canExport')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const asets = await prisma.aset.findMany({
            orderBy: { kategori: 'asc' },
            include: { penggunaan: true }
        });

        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Aset IT');

        worksheet.columns = [
            { header: 'NO',        key: 'no',        width: 6  },
            { header: 'NAMA ASET', key: 'nama',      width: 30 },
            { header: 'KATEGORI',  key: 'kategori',  width: 16 },
            { header: 'SATUAN',    key: 'satuan',    width: 10 },
            { header: 'STOK AWAL', key: 'stokAwal',  width: 12 },
            { header: 'STOK',      key: 'stok',      width: 10 },
            { header: 'KONDISI',   key: 'kondisi',   width: 12 },
            { header: 'DIPAKAI',   key: 'dipakai',   width: 10 },
            { header: 'KETERANGAN',key: 'keterangan',width: 30 },
        ];

        // Header style
        worksheet.getRow(1).eachCell(cell => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
            cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF4DA6FF' } } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        worksheet.getRow(1).height = 20;

        asets.forEach((a, i) => {
            const dipakaiCount = a.penggunaan ? a.penggunaan.length : 0;
            const row = worksheet.addRow({
                no:         i + 1,
                nama:       a.nama,
                kategori:   a.kategori,
                satuan:     a.satuan,
                stokAwal:   a.stokAwal,
                stok:       a.stok,
                kondisi:    a.kondisi,
                dipakai:    dipakaiCount,
                keterangan: a.keterangan || '-',
            });
            row.eachCell(cell => {
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.font = { size: 10 };
            });
            // Warna kondisi
            const kondisiCell = row.getCell('kondisi');
            if (a.kondisi === 'Rusak') kondisiCell.font = { color: { argb: 'FFDC2626' }, size: 10, bold: true };
            else if (a.kondisi === 'Baik') kondisiCell.font = { color: { argb: 'FF16A34A' }, size: 10, bold: true };
            row.height = 18;
        });

        const now = new Date();
        const tgl = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
        worksheet.addRow([]);
        const infoRow = worksheet.addRow([`Diekspor pada: ${tgl}`, '', '', '', '', '', '', '', `Total: ${asets.length} aset`]);
        infoRow.font = { italic: true, color: { argb: 'FF888888' }, size: 9 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Data-Aset-IT.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { console.error(error); res.status(500).send('Gagal export aset: ' + error.message); }
});

// ==========================================
// 9. NOTES
// ==========================================
app.get('/api/notes', requireLogin, async (req, res) => {
    try { res.json(await prisma.note.findMany({ orderBy: { createdAt: 'desc' } })); }
    catch (e) { res.status(500).json({ error: "Gagal ambil notes" }); }
});
app.post('/api/notes', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAdd') && !hasPerm(req.session.user, 'canEdit')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { res.json(await prisma.note.create({ data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: "Gagal tambah notes" }); }
});
app.put('/api/notes/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { res.json(await prisma.note.update({ where: { id: parseInt(req.params.id) }, data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: "Gagal update notes" }); }
});
app.delete('/api/notes/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canUsers')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { await prisma.note.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: "Gagal hapus notes" }); }
});

// ==========================================
// 10. USER MANAGEMENT
// ==========================================
app.get('/users', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { msg, msgType } = req.query;
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
        res.render('users', { users, msg: msg || null, msgType: msgType || 'success' });
    } catch (error) {
        console.error('[USERS ERROR]', error.message);
        res.status(500).send('Database Error: ' + error.message);
    }
});

app.post('/users/tambah', requireLogin, requireAdmin, async (req, res) => {
    try {
        const { nama, username, password } = req.body;
        if (!nama || !username || !password) {
            return res.redirect('/users?msg=Nama%2C+username%2C+dan+password+wajib+diisi&msgType=error');
        }
        if (password.length < 6) {
            return res.redirect('/users?msg=Password+minimal+6+karakter&msgType=error');
        }
        const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
        if (existing) {
            return res.redirect('/users?msg=Username+sudah+dipakai%2C+pilih+yang+lain&msgType=error');
        }

        // Permissions murni dari checkbox — tidak ada auto-assign role
        const permissions = {
            canView:   req.body.canView   === 'on',
            canAdd:    req.body.canAdd    === 'on',
            canEdit:   req.body.canEdit   === 'on',
            canDelete: req.body.canDelete === 'on',
            canAsset:  req.body.canAsset  === 'on',
            canExport: req.body.canExport === 'on',
            canUsers:  req.body.canUsers  === 'on',
        };

        // role hanya label tampilan, tidak menentukan akses
        const role = req.body.role || 'user';

        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: {
                nama: nama.trim(),
                username: username.trim().toLowerCase(),
                password: hashed,
                role,
                permissions: JSON.stringify(permissions)
            }
        });
        res.redirect('/users?msg=User+berhasil+ditambahkan&msgType=success');
    } catch (error) {
        console.error('[USER TAMBAH ERROR]', error.message);
        res.redirect('/users?msg=Gagal+tambah+user:+' + encodeURIComponent(error.message) + '&msgType=error');
    }
});

app.post('/users/edit/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nama, username, password } = req.body;
        if (!nama || !username) {
            return res.redirect('/users?msg=Nama+dan+username+wajib+diisi&msgType=error');
        }
        const existing = await prisma.user.findFirst({
            where: { username: username.trim().toLowerCase(), NOT: { id } }
        });
        if (existing) {
            return res.redirect('/users?msg=Username+sudah+dipakai+user+lain&msgType=error');
        }

        // Permissions murni dari checkbox — tidak ada auto-assign role
        const permissions = {
            canView:   req.body.canView   === 'on',
            canAdd:    req.body.canAdd    === 'on',
            canEdit:   req.body.canEdit   === 'on',
            canDelete: req.body.canDelete === 'on',
            canAsset:  req.body.canAsset  === 'on',
            canExport: req.body.canExport === 'on',
            canUsers:  req.body.canUsers  === 'on',
        };

        // role hanya label tampilan, tidak menentukan akses
        const role = req.body.role || 'user';

        const updateData = {
            nama: nama.trim(),
            username: username.trim().toLowerCase(),
            role,
            permissions: JSON.stringify(permissions)
        };

        if (password && password.trim().length > 0) {
            if (password.length < 6) {
                return res.redirect('/users?msg=Password+minimal+6+karakter&msgType=error');
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        await prisma.user.update({ where: { id }, data: updateData });

        // Update session jika edit diri sendiri
        if (req.session.user && req.session.user.id === id) {
            req.session.user.nama        = updateData.nama;
            req.session.user.username    = updateData.username;
            req.session.user.role        = updateData.role;
            req.session.user.permissions = updateData.permissions;
        }
        res.redirect('/users?msg=User+berhasil+diperbarui&msgType=success');
    } catch (error) {
        console.error('[USER EDIT ERROR]', error.message);
        res.redirect('/users?msg=Gagal+edit+user&msgType=error');
    }
});

app.post('/users/hapus/:id', requireLogin, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (req.session.user && req.session.user.id === id) {
            return res.redirect('/users?msg=Tidak+bisa+hapus+akun+sendiri&msgType=error');
        }
        await prisma.user.delete({ where: { id } });
        res.redirect('/users?msg=User+berhasil+dihapus&msgType=success');
    } catch (error) {
        console.error('[USER HAPUS ERROR]', error.message);
        res.redirect('/users?msg=Gagal+hapus+user&msgType=error');
    }
});

// ==========================================
// API: CEK FOTO (debugging helper)
// ==========================================
app.get('/api/check-foto/:filename', requireLogin, (req, res) => {
    const fotoPath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(fotoPath)) {
        const stat = fs.statSync(fotoPath);
        res.json({ exists: true, size: stat.size, path: fotoPath });
    } else {
        res.json({ exists: false, uploadDir, filename: req.params.filename });
    }
});

// ==========================================
// ==========================================
// AI HELPER — GEMINI API
// ==========================================

// Helper: call Gemini
async function callGemini(systemPrompt, userMessage, history = []) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY belum diset di .env');

    const geminiHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [...geminiHistory, { role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
            })
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Route: Auto-generate deskripsi (login required)
app.post('/api/ai-describe', requireLogin, async (req, res) => {
    try {
        const { aktivitas, divisi, pemesan } = req.body;
        if (!aktivitas) return res.status(400).json({ error: 'Aktivitas tidak boleh kosong.' });

        const systemPrompt = `Kamu adalah asisten IT Support. Tugasmu membuat deskripsi singkat dan profesional untuk log tiket IT.
Deskripsi harus: 1-3 kalimat, padat, dalam Bahasa Indonesia, menjelaskan apa yang dikerjakan/terjadi.
Jangan tambahkan poin-poin atau format markdown. Langsung tulis deskripsinya saja, tanpa kalimat pembuka.`;

        const userMessage = `Buat deskripsi untuk tiket IT berikut:
Aktivitas: ${aktivitas}
Divisi: ${divisi || '-'}
Pemesan: ${pemesan || '-'}`;

        const reply = await callGemini(systemPrompt, userMessage);
        res.json({ deskripsi: reply.trim() });
    } catch (err) {
        console.error('AI Describe error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

// Route: Public AI Chat (tanpa login)
app.post('/api/ai-chat-public', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

        // Ambil log publik terbaru sebagai konteks
        const recentLogs = await prisma.journal.findMany({
            orderBy: { tanggalManual: 'desc' },
            take: 15,
            select: { id: true, tanggalManual: true, pemesan: true, divisi: true, aktivitas: true, status: true }
        });

        const logContext = recentLogs.map(l =>
            `[ID:${l.id}] ${new Date(l.tanggalManual).toLocaleDateString('id-ID')} | ${l.pemesan} (${l.divisi}) | ${l.aktivitas} | ${l.status}`
        ).join('\n');

        const systemPrompt = `Kamu adalah AI asisten IT Support publik bernama "RSBY-AI" untuk sistem IT Jurnal Log RSBY.
Jawab pertanyaan seputar log aktivitas IT, status tiket, dan troubleshooting umum.
Jawab singkat dalam Bahasa Indonesia. Jangan reveal data sensitif seperti password atau konfigurasi sistem.

Data log IT terbaru:
${logContext || 'Belum ada data.'}`;

        const reply = await callGemini(systemPrompt, message, history || []);
        res.json({ reply });
    } catch (err) {
        console.error('AI Public Chat error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

// Route: AI Chat (login required — dashboard)
// AI CHATBOT — GEMINI API
// ==========================================
app.post('/api/ai-chat', requireLogin, async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

        const recentLogs = await prisma.journal.findMany({
            orderBy: { tanggalManual: 'desc' },
            take: 20,
            select: { id: true, tanggalManual: true, pemesan: true, divisi: true, aktivitas: true, deskripsi: true, status: true }
        });

        const logContext = recentLogs.map(l =>
            `[ID:${l.id}] ${new Date(l.tanggalManual).toLocaleDateString('id-ID')} | ${l.pemesan} (${l.divisi}) | ${l.aktivitas} | ${l.status}${l.deskripsi ? ' | ' + l.deskripsi.substring(0, 80) : ''}`
        ).join('\n');

        const systemPrompt = `Kamu adalah AI asisten IT Support bernama "RSBY-AI" untuk sistem IT Jurnal Log.
Jawab dalam Bahasa Indonesia, singkat dan to the point.
Data log terbaru:\n${logContext || 'Belum ada data log.'}
Panduan: jawab soal tiket dari data di atas, tips troubleshooting praktis, jangan buat data fiktif, max 3-4 kalimat.`;

        const reply = await callGemini(systemPrompt, message, history || []);
        res.json({ reply });

    } catch (err) {
        console.error('AI Chat error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

app.listen(3001, '0.0.0.0', () => {
    console.log('🚀 SYSTEM READY AT PORT 3001');
    console.log('📁 Upload directory:', uploadDir);
    // Verifikasi folder upload saat startup
    if (!fs.existsSync(uploadDir)) {
        console.warn('⚠️ Upload directory tidak ditemukan, membuat...');
        fs.mkdirSync(uploadDir, { recursive: true });
    }
});

// ==========================================
// ASET ROUTES
// ==========================================
app.get('/aset/export-pdf', requireLogin, async (req, res) => {
    try {
        const aset = await prisma.aset.findMany({
            orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } }
            }
        });
        res.render('aset-export', { aset });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.get('/aset', requireLogin, async (req, res) => {
    try {
        const { q, kategori } = req.query;
        let where = {};
        if (q) where.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;
        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: { _count: { select: { pinjaman: { where: { status: 'Dipinjam' } } } } }
        });
        const allKategori = await prisma.aset.findMany({ select: { kategori: true }, distinct: ['kategori'] });
        res.render('aset', { aset, allKategori: allKategori.map(k => k.kategori), q: q || '', kategori: kategori || '' });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.get('/aset/:id', requireLogin, async (req, res) => {
    try {
        const aset = await prisma.aset.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { penggunaan: { orderBy: { tanggal: 'desc' } }, pinjaman: { orderBy: { tanggalPinjam: 'desc' } } }
        });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        res.render('aset-detail', { aset });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.post('/aset/tambah', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const { nama, kategori, satuan, stok, kondisi, keterangan } = req.body;
        const stokNum = parseInt(stok) || 0;
        await prisma.aset.create({ data: { nama, kategori, satuan, stokAwal: stokNum, stok: stokNum, kondisi, keterangan: keterangan || null } });
        res.redirect('/aset?saved=1');
    } catch (error) { console.error(error); res.status(500).send("Gagal tambah aset: " + error.message); }
});

app.post('/aset/edit/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const { nama, kategori, satuan, stokAwal, kondisi, keterangan } = req.body;
        const stokAwalNum = parseInt(stokAwal) || 0;
        const totalPakai  = await prisma.asetPenggunaan.aggregate({ where: { asetId: parseInt(req.params.id) }, _sum: { jumlah: true } });
        const totalPinjam = await prisma.asetPinjam.aggregate({ where: { asetId: parseInt(req.params.id), status: 'Dipinjam' }, _sum: { jumlah: true } });
        const stokBaru    = stokAwalNum - (totalPakai._sum.jumlah || 0) - (totalPinjam._sum.jumlah || 0);
        await prisma.aset.update({ where: { id: parseInt(req.params.id) }, data: { nama, kategori, satuan, stokAwal: stokAwalNum, stok: stokBaru, kondisi, keterangan: keterangan || null } });
        res.redirect('/aset');
    } catch (error) { console.error(error); res.status(500).send("Gagal edit aset: " + error.message); }
});

app.post('/aset/hapus/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canDelete')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        await prisma.aset.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/aset');
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus: " + error.message); }
});

app.post('/aset/pakai/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, divisi, lokasi, keterangan, tanggal } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);
        await prisma.$transaction([
            prisma.asetPenggunaan.create({ data: { asetId, jumlah: jml, divisi, lokasi, keterangan: keterangan || null, tanggal: tanggal ? new Date(tanggal) : new Date() } }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pakai');
    } catch (error) { console.error(error); res.status(500).send("Gagal catat penggunaan: " + error.message); }
});

app.post('/aset/pakai-hapus/:penggunaanId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
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

app.post('/aset/pinjam/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, peminjam, divisi, keperluan, tanggalPinjam } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);
        await prisma.$transaction([
            prisma.asetPinjam.create({ data: { asetId, jumlah: jml, peminjam, divisi, keperluan: keperluan || null, tanggalPinjam: tanggalPinjam ? new Date(tanggalPinjam) : new Date(), status: 'Dipinjam' } }),
            prisma.aset.update({ where: { id: asetId }, data: { stok: { decrement: jml } } })
        ]);
        res.redirect('/aset/' + asetId + '?saved=pinjam');
    } catch (error) { console.error(error); res.status(500).send("Gagal catat pinjaman: " + error.message); }
});

app.post('/aset/kembali/:pinjamId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const pinjam = await prisma.asetPinjam.findUnique({ where: { id: parseInt(req.params.pinjamId) } });
        if (!pinjam) return res.status(404).send("Data pinjaman tidak ditemukan");
        if (pinjam.status === 'Dikembalikan') return res.status(400).send("Sudah dikembalikan.");
        await prisma.$transaction([
            prisma.asetPinjam.update({ where: { id: parseInt(req.params.pinjamId) }, data: { status: 'Dikembalikan', tanggalKembali: new Date() } }),
            prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } })
        ]);
        res.redirect('/aset/' + pinjam.asetId + '?saved=kembali');
    } catch (error) { console.error(error); res.status(500).send("Gagal proses kembali: " + error.message); }
});

app.post('/aset/pinjam-hapus/:pinjamId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
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
