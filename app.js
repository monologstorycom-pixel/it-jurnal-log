const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const prisma = new PrismaClient();

const uploadDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
// PERMISSION HELPERS
// ==========================================
function getUserPerms(user) {
    if (!user) return {};
    if (user.permissions) {
        try {
            const p = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            return {
                canView:    p.canView    === true,
                canAdd:     p.canAdd     === true,
                canEdit:    p.canEdit    === true,
                canDelete:  p.canDelete  === true,
                canAsset:   p.canAsset   === true,
                canExport:  p.canExport  === true,
                canUsers:   p.canUsers   === true,
                canViewLog: p.canViewLog === true,
                canAudit:   p.canAudit   === true,
            };
        } catch(e) {}
    }
    return { canView:false, canAdd:false, canEdit:false, canDelete:false, canAsset:false, canExport:false, canUsers:false, canViewLog:false, canAudit:false };
}

function hasPerm(user, perm) {
    if (!user) return false;
    const perms = getUserPerms(user);
    return perms[perm] === true;
}

function canSeeAllAset(user) {
    if (!user) return false;
    if (hasPerm(user, 'canUsers')) return true;   
    if (hasPerm(user, 'canAudit')) return true;   
    return false;
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
        if (hasPerm(user, 'canAdd') || hasPerm(user, 'canEdit') || hasPerm(user, 'canAsset')) return next();
    }
    res.status(403).render('403', { message: 'Anda tidak punya izin untuk aksi ini.' });
}

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.userPerms   = req.session.user ? getUserPerms(req.session.user) : {};
    next();
});

// ==========================================
// MULTER + SHARP AUTO COMPRESS
// ==========================================
const uploadTmpDir = path.join(__dirname, 'uploads', 'tmp');
if (!fs.existsSync(uploadTmpDir)) fs.mkdirSync(uploadTmpDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadTmpDir),
        filename: (req, file, cb) => cb(null, 'tmp-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan'));
    }
});
const uploadFields = upload.fields([
    { name: 'fotoAwal', maxCount: 1 },
    { name: 'foto', maxCount: 1 }
]);

async function saveCompressedPhoto(file, fieldname) {
    if (!file) return null;
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const prefix = fieldname === 'fotoAwal' ? 'IT-AWAL-' : 'IT-LOG-';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    try {
        const source = file.path || file.buffer;
        if (!source) return null;
        const filename = prefix + uniqueSuffix + '.jpg';
        const outPath  = path.join(uploadDir, filename);
        const buffer = await sharp(source)
            .rotate()
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        fs.writeFileSync(outPath, buffer);
        if (file.path && fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch(e) {} }
        return '/uploads/' + filename;
    } catch(sharpErr) {
        console.warn('[Sharp fallback]', sharpErr.message);
        const ext = file.originalname ? require('path').extname(file.originalname) : '.jpg';
        const filename = prefix + uniqueSuffix + ext;
        const outPath  = path.join(uploadDir, filename);
        if (file.path) {
            fs.copyFileSync(file.path, outPath);
            try { fs.unlinkSync(file.path); } catch(e) {}
        } else if (file.buffer) {
            fs.writeFileSync(outPath, file.buffer);
        } else {
            return null;
        }
        return '/uploads/' + filename;
    }
}

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

function formatTanggal(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatJamMenit(jamStr) {
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
            divisi: user.divisi || 'IT',
            permissions: user.permissions || null
        };
        const permsAfterLogin = getUserPerms(req.session.user);
        if (permsAfterLogin.canAudit && !permsAfterLogin.canViewLog) {
            return res.redirect('/audit');
        }
        if (!permsAfterLogin.canViewLog && permsAfterLogin.canAsset) {
            return res.redirect('/aset');
        }
        res.redirect('/kerja');
    } catch (error) {
        console.error('[LOGIN ERROR]', error.message);
        res.render('login', { error: 'Terjadi kesalahan server. Coba lagi.', username: req.body.username || '' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/403', (req, res) => {
    res.status(403).render('403', { message: 'Akses ditolak.' });
});

// ==========================================
// 1. VIEWER MODE
// ==========================================
app.get('/', async (req, res) => {
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
// PUBLIC ASET VIEW 
// ==========================================
app.get('/aset-public', async (req, res) => {
    try {
        if (req.session && req.session.user) {
            const divisi = req.session.user.divisi || 'IT';
            return res.redirect('/aset-public/' + encodeURIComponent(divisi));
        }

        const { q, kategori } = req.query;
        // FIX: Supaya 'IT' merangkul 'IT & IC'
        let where = { divisi: { in: ['IT', 'IT & IC'] } };
        
        if (q) where.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' }, take: 10 },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' }, take: 10 },
                service:    { orderBy: { tanggal: 'desc' }, take: 10 },
            }
        });
        const allKategori = await prisma.aset.findMany({
            where: { divisi: { in: ['IT', 'IT & IC'] } },
            select: { kategori: true },
            distinct: ['kategori']
        });
        res.render('aset-public', {
            aset,
            allKategori: allKategori.map(k => k.kategori),
            allDivisi: [],
            q: q || '',
            kategori: kategori || '',
            divisi: 'IT',
            divisiLabel: 'IT & IC'
        });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

app.get('/aset-public/:divisi', requireLogin, async (req, res) => {
    try {
        const targetDivisi = decodeURIComponent(req.params.divisi).toUpperCase();
        const userDivisi   = (req.session.user.divisi || 'IT').toUpperCase();
        const seeAll       = canSeeAllAset(req.session.user);

        if (!seeAll && userDivisi !== targetDivisi) {
            return res.status(403).render('403', { message: `Anda hanya bisa melihat aset divisi ${userDivisi}.` });
        }

        const { q, kategori } = req.query;
        
        // FIX: Supaya targetDivisi mencakup 'IT' & 'IT & IC'
        let where = {};
        if (targetDivisi === 'IT' || targetDivisi === 'IT & IC') {
            where.divisi = { in: ['IT', 'IT & IC'] };
        } else {
            where.divisi = targetDivisi;
        }

        if (q) where.OR = [{ nama: { contains: q }, divisi: where.divisi }, { kategori: { contains: q }, divisi: where.divisi }];
        if (kategori && kategori !== '') where.kategori = kategori;

        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' }, take: 10 },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' }, take: 10 },
                service:    { orderBy: { tanggal: 'desc' }, take: 10 },
            }
        });
        const allKategori = await prisma.aset.findMany({
            where: { divisi: where.divisi },
            select: { kategori: true },
            distinct: ['kategori']
        });

        let allDivisiList = [];
        if (seeAll) {
            const divisiRows = await prisma.aset.findMany({ select: { divisi: true }, distinct: ['divisi'], orderBy: { divisi: 'asc' } });
            allDivisiList = divisiRows.map(d => d.divisi);
        }

        res.render('aset-public', {
            aset,
            allKategori: allKategori.map(k => k.kategori),
            allDivisi:   allDivisiList,
            q: q || '',
            kategori: kategori || '',
            divisi: targetDivisi,
            divisiLabel: targetDivisi === 'IT' ? 'IT & IC' : targetDivisi,
            seeAll
        });
    } catch (error) { console.error(error); res.status(500).send('Error: ' + error.message); }
});

// ==========================================
// 2. DASHBOARD KERJA (ADMIN/IT)
// ==========================================
app.get('/kerja', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canViewLog')) {
        if (hasPerm(req.session.user, 'canAsset')) return res.redirect('/aset');
        return res.status(403).render('403', { message: 'Anda tidak punya izin melihat Log Jurnal.' });
    }
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
// 2b. DASHBOARD AUDIT / INTERNAL CONTROL
// ==========================================
app.get('/audit', requireLogin, async (req, res) => {
    if (!hasPerm(req.session.user, 'canAudit')) {
        return res.status(403).render('403', { message: 'Akses ditolak. Halaman ini hanya untuk Tim Audit / Internal Control.' });
    }
    try {
        const { date, status, divisi, asetDivisi, chartPeriod } = req.query;
        const now = new Date();

        // 1. FILTER UNTUK TABEL LOG HARIAN (STRICT BY DAY)
        let filterDateStr = date || '';
        let selectedDate = date ? new Date(date) : now;
        const tStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
        const tEnd   = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

        let tableWhere = {
            OR: [
                { tipeInput: { not: 'multihari' }, tanggalManual: { gte: tStart, lte: tEnd } },
                { tipeInput: 'multihari', tanggalMulai: { lte: tEnd }, tanggalSelesai: { gte: tStart } }
            ]
        };

        if (status && status !== '') tableWhere.status = status;
        if (divisi && divisi !== '') tableWhere.divisi = divisi;

        const journals = await prisma.journal.findMany({
            where: tableWhere,
            orderBy: { tanggalManual: 'desc' }
        });

        // 2. FILTER UNTUK ANALITIK & CHART (Rata-rata Durasi, dll)
        let chartWhere = {};
        let period = chartPeriod || '30'; 
        
        if (period !== 'all') {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - parseInt(period));
            chartWhere.tanggalManual = { gte: pastDate };
        }

        const chartLogs = await prisma.journal.findMany({
            where: chartWhere,
            select: { divisi: true, status: true, aktivitas: true, durasiMenit: true, pemesan: true }
        });

        let totalDurasi = 0;
        let durasiCount = 0;
        const divisiMap = {};
        const masalahMap = {};
        const pemesanMap = {};

        chartLogs.forEach(j => {
            if (!divisiMap[j.divisi]) divisiMap[j.divisi] = { divisi: j.divisi, total: 0, pending: 0 };
            divisiMap[j.divisi].total++;
            if (j.status === 'Pending') divisiMap[j.divisi].pending++;

            const act = (j.aktivitas || 'Lainnya').trim();
            masalahMap[act] = (masalahMap[act] || 0) + 1;

            const pms = (j.pemesan || 'Tanpa Nama').trim();
            pemesanMap[pms] = (pemesanMap[pms] || 0) + 1;

            if (j.durasiMenit && j.durasiMenit > 0) {
                totalDurasi += j.durasiMenit;
                durasiCount++;
            }
        });

        const divisiBreakdown = Object.values(divisiMap).sort((a, b) => b.total - a.total);
        const divisiList = divisiBreakdown.map(d => d.divisi);

        const masalahSering = Object.entries(masalahMap)
            .map(([nama, total]) => ({ nama, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
            
        const pemesanSering = Object.entries(pemesanMap)
            .map(([nama, total]) => ({ nama, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        const rataRataMenit = durasiCount > 0 ? Math.floor(totalDurasi / durasiCount) : 0;

        // 3. STATS KARTU GLOBAL (Semua Waktu & Bulan Ini)
        const bulanStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const bulanEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [totalAllTime, totalSolved, totalPending, bulanIni] = await Promise.all([
            prisma.journal.count(),
            prisma.journal.count({ where: { status: 'Solved' } }),
            prisma.journal.count({ where: { status: 'Pending' } }),
            prisma.journal.count({
                where: { OR: [
                    { tipeInput: { not: 'multihari' }, tanggalManual: { gte: bulanStart, lte: bulanEnd } },
                    { tipeInput: 'multihari', tanggalMulai: { lte: bulanEnd }, tanggalSelesai: { gte: bulanStart } }
                ]}
            })
        ]);

        const pendingItems = await prisma.journal.findMany({
            where: { status: 'Pending' },
            orderBy: { tanggalManual: 'asc' },
            take: 10,
            select: { id: true, aktivitas: true, divisi: true, pemesan: true, tanggalManual: true, durasiMenit: true, tipeInput: true }
        });
        const pendingWithAge = pendingItems.map(p => {
            const diffMs   = Date.now() - new Date(p.tanggalManual).getTime();
            const hariPending = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            return { ...p, hariPending };
        });

        // 4. DATA ASET
        let auditAsets = [];
        if (asetDivisi && asetDivisi !== '') {
            // FIX: Map "IT & IC" biar merangkul data "IT"
            let divWhereAset = asetDivisi;
            if (asetDivisi === 'IT & IC' || asetDivisi === 'IT') {
                divWhereAset = { in: ['IT', 'IT & IC'] };
            }

            auditAsets = await prisma.aset.findMany({
                where: { divisi: divWhereAset },
                orderBy: { nama: 'asc' },
                include: {
                    penggunaan: true,
                    pinjaman: { where: { status: 'Dipinjam' } }
                }
            });
        }

        const stats = {
            totalAllTime, totalSolved, totalPending, bulanIni,
            divisiCount: divisiList.length,
            divisiList, divisiBreakdown,
            masalahSering, rataRataMenit, rataRataFormat: formatDurasi(rataRataMenit),
            pemesanSering,
            pendingItems: pendingWithAge
        };

        res.render('audit', {
            journals,
            auditAsets,
            yearOptions: getYearOptions(),
            formatDurasi,
            stats,
            filterDate: filterDateStr,
            filterStatus: status  || '',
            filterDivisi: divisi  || '',
            filterAsetDivisi: asetDivisi || '',
            chartPeriod: period
        });
    } catch (error) { console.error(error); res.status(500).send('Database Error: ' + error.message); }
});

// ==========================================
// 2c. EXPORT EXCEL AUDIT DASHBOARD (LOG JURNAL BULANAN)
// ==========================================
app.get('/audit/export', requireLogin, async (req, res) => {
    // Kita arahkan form export Excel Audit langsung ke "/export" bawaan Admin
    // karena user maunya export Log Jurnal biasa berdasarkan Bulan.
    res.redirect('/export?' + new URLSearchParams(req.query).toString());
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
        if (req.file) { const fotoUrl = await saveCompressedPhoto(req.file, 'foto'); await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoUrl } }); }
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
        if (req.file) { const fotoAwalUrl = await saveCompressedPhoto(req.file, 'fotoAwal'); await prisma.journal.update({ where: { id: parseInt(req.params.id) }, data: { fotoAwalUrl } }); }
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
// 8b. EXPORT EXCEL ASET
// ==========================================
app.get('/export-aset', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canExport')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const seeAll     = canSeeAllAset(req.session.user);
        const userDivisi = req.session.user.divisi || 'IT';
        const targetDivisi = seeAll ? (req.query.divisi || null) : userDivisi;

        // FIX: Supaya export aset "IT & IC" juga narik data "IT"
        let whereClause = {};
        if (targetDivisi) {
            whereClause.divisi = (targetDivisi === 'IT & IC' || targetDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : targetDivisi;
        }

        const asets = await prisma.aset.findMany({
            where: whereClause,
            orderBy: { kategori: 'asc' },
            include: { penggunaan: true }
        });

        const labelDivisi = targetDivisi || 'Semua Divisi';
        const workbook    = new ExcelJS.Workbook();
        const worksheet   = workbook.addWorksheet('Data Aset ' + labelDivisi);

        worksheet.columns = [
            { header: 'NO',        key: 'no',        width: 6  },
            { header: 'NAMA ASET', key: 'nama',      width: 30 },
            { header: 'DIVISI',    key: 'divisi',    width: 12 },
            { header: 'KATEGORI',  key: 'kategori',  width: 16 },
            { header: 'SATUAN',    key: 'satuan',    width: 10 },
            { header: 'STOK AWAL', key: 'stokAwal',  width: 12 },
            { header: 'STOK',      key: 'stok',      width: 10 },
            { header: 'KONDISI',   key: 'kondisi',   width: 12 },
            { header: 'DIPAKAI',   key: 'dipakai',   width: 10 },
            { header: 'KETERANGAN',key: 'keterangan',width: 30 },
        ];

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
                divisi:     a.divisi,
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
            const kondisiCell = row.getCell('kondisi');
            if (a.kondisi === 'Rusak') kondisiCell.font = { color: { argb: 'FFDC2626' }, size: 10, bold: true };
            else if (a.kondisi === 'Baik') kondisiCell.font = { color: { argb: 'FF16A34A' }, size: 10, bold: true };
            row.height = 18;
        });

        const now = new Date();
        const tgl = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
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

        const permissions = {
            canView:    req.body.canView    === 'on',
            canAdd:     req.body.canAdd     === 'on',
            canEdit:    req.body.canEdit    === 'on',
            canDelete:  req.body.canDelete  === 'on',
            canAsset:   req.body.canAsset   === 'on',
            canExport:  req.body.canExport  === 'on',
            canUsers:   req.body.canUsers   === 'on',
            canViewLog: req.body.canViewLog === 'on',
            canAudit:   req.body.canAudit   === 'on',
        };

        const role   = req.body.role || 'user';
        const divisi = (req.body.divisi || 'IT').toString().trim().toUpperCase();
        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: {
                nama: nama.trim(),
                username: username.trim().toLowerCase(),
                password: hashed,
                role,
                divisi,
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

        const permissions = {
            canView:    req.body.canView    === 'on',
            canAdd:     req.body.canAdd     === 'on',
            canEdit:    req.body.canEdit    === 'on',
            canDelete:  req.body.canDelete  === 'on',
            canAsset:   req.body.canAsset   === 'on',
            canExport:  req.body.canExport  === 'on',
            canUsers:   req.body.canUsers   === 'on',
            canViewLog: req.body.canViewLog === 'on',
            canAudit:   req.body.canAudit   === 'on',
        };

        const role = req.body.role || 'user';
        const divisi = (req.body.divisi || 'IT').toString().trim().toUpperCase();

        const updateData = {
            nama: nama.trim(),
            username: username.trim().toLowerCase(),
            role,
            divisi,
            permissions: JSON.stringify(permissions)
        };

        if (password && password.trim().length > 0) {
            if (password.length < 6) {
                return res.redirect('/users?msg=Password+minimal+6+karakter&msgType=error');
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        await prisma.user.update({ where: { id }, data: updateData });

        if (req.session.user && req.session.user.id === id) {
            req.session.user.nama        = updateData.nama;
            req.session.user.username    = updateData.username;
            req.session.user.role        = updateData.role;
            req.session.user.divisi      = updateData.divisi;
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
// API: CEK FOTO
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

app.get('/api/debug-photomap', requireLogin, async (req, res) => {
    try {
        const { photoMap } = await getAsetContext();
        const result = Object.entries(photoMap).map(([id, url]) => {
            const absPath = path.join(__dirname, 'public', url);
            return { id, url, exists: fs.existsSync(absPath) };
        });
        res.json({ total: result.length, photos: result });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// AI HELPER — GEMINI API
// ==========================================
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
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
            })
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function getAsetContext() {
    const asetList = await prisma.aset.findMany({
        orderBy: [{ divisi: 'asc' }, { nama: 'asc' }],
        select: {
            id: true, nama: true, divisi: true, kategori: true, satuan: true,
            stokAwal: true, stok: true, kondisi: true, keterangan: true, fotoUrl: true,
            penggunaan: {
                orderBy: { tanggal: 'desc' },
                take: 10,
                select: { id: true, jumlah: true, divisi: true, lokasi: true, keterangan: true, tanggal: true, fotoUrl: true }
            },
            pinjaman: {
                orderBy: { tanggalPinjam: 'desc' },
                take: 10,
                select: { id: true, peminjam: true, divisi: true, jumlah: true, tanggalPinjam: true, tanggalKembali: true, keperluan: true, status: true, fotoUrl: true }
            },
            service: {
                orderBy: { tanggal: 'desc' },
                take: 5,
                select: { id: true, teknisi: true, vendor: true, keluhan: true, hasil: true, biaya: true, status: true, tanggal: true, tanggalSelesai: true, fotoUrl: true }
            }
        }
    });

    if (!asetList.length) return { text: 'Belum ada data aset.', photoMap: {} };

    const tglFmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) : '-';

    const isValidPhoto = (url) => {
        if (!url) return false;
        if (url.includes('/tmp/') || url.includes('tmp-')) return false;
        try {
            const absPath = path.join(__dirname, 'public', url);
            return fs.existsSync(absPath);
        } catch(e) { return false; }
    };

    const photoMap = {};

    const grouped = {};
    asetList.forEach(a => {
        const div = a.divisi || 'UNKNOWN';
        if (!grouped[div]) grouped[div] = [];
        grouped[div].push(a);
    });

    const sections = Object.keys(grouped).sort().map(divName => {
        const items = grouped[divName];
        const itemLines = items.map(a => {
            let lines = [];

            const asetFotoOk = isValidPhoto(a.fotoUrl);
            if (asetFotoOk) photoMap[`aset-${a.id}`] = a.fotoUrl;

            lines.push(`  [ASET] ${a.nama} | Divisi: ${a.divisi} | Kategori: ${a.kategori} | Stok: ${a.stok}/${a.stokAwal} ${a.satuan} | Kondisi: ${a.kondisi}${a.keterangan ? ' | Ket: ' + a.keterangan.substring(0, 80) : ''}${asetFotoOk ? ` [FOTO:aset-${a.id}]` : ''}`);

            if (a.penggunaan.length > 0) {
                const info = a.penggunaan.map(p => {
                    const ok = isValidPhoto(p.fotoUrl);
                    if (ok) photoMap[`pasang-${p.id}`] = p.fotoUrl;
                    return `    • ${tglFmt(p.tanggal)}: ${p.jumlah} ${a.satuan} dipasang di "${p.lokasi || '-'}" oleh divisi ${p.divisi || '-'}${p.keterangan ? ' — ' + p.keterangan.substring(0, 60) : ''}${ok ? ` [FOTO:pasang-${p.id}]` : ''}`;
                }).join('\n');
                lines.push(`    Pemasangan:\n${info}`);
            }

            const pinjamanAktif   = a.pinjaman.filter(p => p.status === 'Dipinjam');
            const pinjamanSelesai = a.pinjaman.filter(p => p.status !== 'Dipinjam');
            if (pinjamanAktif.length > 0) {
                const info = pinjamanAktif.map(p => {
                    const ok = isValidPhoto(p.fotoUrl);
                    if (ok) photoMap[`pinjam-${p.id}`] = p.fotoUrl;
                    return `    • ⚠️ SEDANG DIPINJAM: ${p.jumlah} ${a.satuan} oleh ${p.peminjam} (${p.divisi || '-'}) sejak ${tglFmt(p.tanggalPinjam)}${p.keperluan ? ', keperluan: ' + p.keperluan.substring(0, 60) : ''}${ok ? ` [FOTO:pinjam-${p.id}]` : ''}`;
                }).join('\n');
                lines.push(`    Pinjaman aktif:\n${info}`);
            }
            if (pinjamanSelesai.length > 0) {
                const info = pinjamanSelesai.map(p => {
                    const ok = isValidPhoto(p.fotoUrl);
                    if (ok) photoMap[`pinjam-${p.id}`] = p.fotoUrl;
                    return `    • ${p.jumlah} ${a.satuan} dipinjam ${p.peminjam} (${p.divisi || '-'}), dikembalikan ${tglFmt(p.tanggalKembali)}${ok ? ` [FOTO:pinjam-${p.id}]` : ''}`;
                }).join('\n');
                lines.push(`    Riwayat pinjaman selesai:\n${info}`);
            }

            if (a.service && a.service.length > 0) {
                const serviceAktif   = a.service.filter(sv => sv.status !== 'Selesai');
                const serviceSelesai = a.service.filter(sv => sv.status === 'Selesai');
                if (serviceAktif.length > 0) {
                    const info = serviceAktif.map(sv => {
                        const ok = isValidPhoto(sv.fotoUrl);
                        if (ok) photoMap[`service-${sv.id}`] = sv.fotoUrl;
                        return `    • 🔧 SEDANG SERVICE (${sv.status}): mulai ${tglFmt(sv.tanggal)}, teknisi: ${sv.teknisi}${sv.vendor ? ' / vendor: ' + sv.vendor : ''}, keluhan: ${sv.keluhan.substring(0, 80)}${sv.hasil ? ', progress: ' + sv.hasil.substring(0, 60) : ''}${sv.biaya > 0 ? ', biaya: Rp ' + sv.biaya.toLocaleString('id-ID') : ''}${ok ? ` [FOTO:service-${sv.id}]` : ''}`;
                    }).join('\n');
                    lines.push(`    Service berjalan:\n${info}`);
                }
                if (serviceSelesai.length > 0) {
                    const info = serviceSelesai.map(sv => {
                        const ok = isValidPhoto(sv.fotoUrl);
                        if (ok) photoMap[`service-${sv.id}`] = sv.fotoUrl;
                        return `    • Selesai ${tglFmt(sv.tanggalSelesai)}: ${sv.keluhan.substring(0, 60)} — teknisi: ${sv.teknisi}${sv.vendor ? '/'+sv.vendor : ''}${sv.hasil ? ', hasil: ' + sv.hasil.substring(0, 60) : ''}${sv.biaya > 0 ? ', biaya: Rp ' + sv.biaya.toLocaleString('id-ID') : ''}${ok ? ` [FOTO:service-${sv.id}]` : ''}`;
                    }).join('\n');
                    lines.push(`    Riwayat service selesai:\n${info}`);
                }
            }

            return lines.join('\n');
        });

        return `--- DIVISI: ${divName} (${items.length} aset) ---\n${itemLines.join('\n\n')}`;
    });

    return { text: sections.join('\n\n'), photoMap };
}

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

// ==========================================
// AI SCOPE HELPER
// ==========================================
function getAiScope(user) {
    if (!user) {
        return { role: 'public', canLog: false, canAsetAll: false, divisiFilter: null };
    }

    const isAdmin  = hasPerm(user, 'canUsers');
    const isAudit  = hasPerm(user, 'canAudit');
    const divisi   = (user.divisi || '').trim().toLowerCase();
    const isIT     = divisi === 'it';

    if (isAdmin) {
        return { role: 'admin', canLog: true, canAsetAll: true, divisiFilter: null };
    }
    if (isAudit) {
        return { role: 'audit', canLog: false, canAsetAll: true, divisiFilter: null };
    }
    if (isIT) {
        return { role: 'it', canLog: true, canAsetAll: false, divisiFilter: user.divisi };
    }
    return { role: 'user', canLog: false, canAsetAll: false, divisiFilter: user.divisi };
}

app.post('/api/ai-chat-public', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

        const { text: asetContext } = await getAsetContext();

        const publicContext = asetContext.split('\n').map(line => {
            if (/(SEDANG DIPINJAM|SEDANG SERVICE|Pinjaman aktif|Service berjalan|Pemasangan:|Riwayat pinjaman|Riwayat service|\[FOTO:)/i.test(line)) {
                return null;
            }
            return line.replace(/\[FOTO:[^\]]+\]/g, ''); 
        }).filter(l => l !== null).join('\n');

        const systemPrompt = `Kamu adalah AI asisten bernama "RSBY-AI" untuk sistem manajemen aset PT. Auri Steel Metalindo.
Kamu diakses oleh pengguna PUBLIK (belum login).

BATASAN KETAT untuk public:
- Hanya boleh jawab info UMUM: nama aset, kategori, jumlah stok, kondisi per divisi
- Jika ditanya detail (siapa yang pinjam, foto, lokasi pemasangan, riwayat service, nama orang): jawab singkat bahwa info detail hanya untuk pengguna yang sudah login, lalu sarankan login
- Jangan sebutkan nama orang, vendor, atau detail transaksi apapun
- Jangan tampilkan foto
- Tetap ramah dan helpful dalam batas di atas

Contoh respons yang benar untuk pertanyaan detail:
"Info tersebut tersedia, tapi hanya bisa diakses oleh pengguna yang sudah login. Silakan login di https://log.rsby.my.id untuk melihat detail lengkapnya. 🔐"

=== DATA ASET (ringkasan umum per divisi) ===
${publicContext}`;

        const rawReply = await callGemini(systemPrompt, message, history || []);
        res.json({ reply: rawReply.trim(), photos: [] });

    } catch (err) {
        console.error('AI Public Chat error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

// ==========================================
app.post('/api/ai-chat', requireLogin, async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

        const user  = req.session.user;
        const scope = getAiScope(user);

        const [recentLogs, asetResult] = await Promise.all([
            scope.canLog || scope.role === 'audit'
                ? prisma.journal.findMany({
                    orderBy: { tanggalManual: 'desc' },
                    take: 20,
                    select: { id: true, tanggalManual: true, pemesan: true, divisi: true, aktivitas: true, deskripsi: true, status: true, durasiMenit: true }
                  })
                : Promise.resolve([]),
            getAsetContext()
        ]);

        const { text: asetContextFull, photoMap } = asetResult;

        let asetContext = asetContextFull;
        let filteredPhotoMap = photoMap;
        if (!scope.canAsetAll && scope.divisiFilter) {
            const sections = asetContextFull.split(/\n(?=--- DIVISI:)/);
            const filtered = sections.filter(s =>
                s.includes(`--- DIVISI: ${scope.divisiFilter.toUpperCase()}`) ||
                s.startsWith('--- DIVISI: ' + scope.divisiFilter.toUpperCase())
            );
            asetContext = filtered.join('\n') || `Tidak ada data aset untuk divisi ${scope.divisiFilter}.`;

            filteredPhotoMap = {};
            Object.entries(photoMap).forEach(([id, url]) => {
                if (asetContext.includes(`[FOTO:${id}]`)) filteredPhotoMap[id] = url;
            });
        }

        const logContext = recentLogs.length
            ? recentLogs.map(l =>
                `[ID:${l.id}] ${new Date(l.tanggalManual).toLocaleDateString('id-ID')} | ${l.pemesan} (${l.divisi}) | ${l.aktivitas} | ${l.status} | Durasi: ${l.durasiMenit ? l.durasiMenit + ' mnt' : '-'}${l.deskripsi ? ' | ' + l.deskripsi.substring(0, 80) : ''}`
              ).join('\n')
            : null;

        let scopeDesc = '';
        let logSection = '';
        let asetSection = '';
        let rulePanjang = 'Jawab dalam Bahasa Indonesia, singkat dan to the point. Maksimal 3-4 kalimat kecuali diminta detail.';

        if (scope.role === 'admin') {
            scopeDesc = `Kamu diakses oleh ADMINISTRATOR (${user.nama}). Kamu bisa membahas SEMUA hal: log IT, aset semua divisi, detail lengkap.`;
        } else if (scope.role === 'audit') {
            scopeDesc = `Kamu diakses oleh tim AUDIT / INTERNAL CONTROL (${user.nama}). PERANMU ADALAH SEBAGAI AUDITOR IT SENIOR.
TUGAS UTAMAMU:
1. Analisis data dengan sangat kritis, tajam, dan mendalam.
2. Cari anomali, inefisiensi, indikasi pemborosan, atau ketidakwajaran (misal: aset ditangani berkali-kali, pending berhari-hari, stok janggal, masalah berulang pada user yang sama).
3. Cross-check data pemakaian aset dengan log jurnal IT.
4. Berikan insight, kesimpulan, dan rekomendasi audit yang berbobot berdasarkan data yang ada.`;
            rulePanjang = 'Jawab dalam Bahasa Indonesia dengan SANGAT DETAIL, komprehensif, dan profesional layaknya Auditor. Gunakan format poin-poin/list untuk menjabarkan temuan audit agar mudah dibaca. JANGAN batasi panjang kalimatmu.';
        } else if (scope.role === 'it') {
            scopeDesc = `Kamu diakses oleh staf IT (${user.nama}). Kamu bisa membahas log IT jurnal. Untuk data aset, kamu hanya bisa melihat aset divisi IT.\nJika ditanya aset divisi lain, tolak dengan sopan: "Maaf, informasi aset divisi lain di luar akses kamu. Hubungi Administrator untuk info lintas divisi. 🔒"`;
        } else {
            scopeDesc = `Kamu diakses oleh staf divisi ${user.divisi} (${user.nama}).
BATASAN: Kamu HANYA boleh membahas aset milik divisi ${user.divisi}. 
Jika ditanya tentang LOG IT jurnal atau aset divisi lain, tolak dengan sopan:
"Maaf, informasi tersebut di luar akses divisi ${user.divisi}. Untuk info log IT atau aset divisi lain, silakan hubungi tim IT atau Administrator. 🔒"`;
        }

        if (logContext) {
            logSection = `\n=== LOG JURNAL IT (20 tiket terbaru) ===\n${logContext}`;
        }

        asetSection = scope.canAsetAll
            ? `\n=== DATA ASET SEMUA DIVISI (lengkap: stok, kondisi, pemasangan, pinjaman, service. Tag [FOTO:id] = ada foto) ===\n${asetContext}`
            : `\n=== DATA ASET DIVISI ${(scope.divisiFilter||'').toUpperCase()} (lengkap: stok, kondisi, pemasangan, pinjaman, service. Tag [FOTO:id] = ada foto) ===\n${asetContext}`;

        const systemPrompt = `Kamu adalah AI asisten bernama "RSBY-AI" untuk sistem manajemen aset & IT Support Log PT. Auri Steel Metalindo.
${scopeDesc}
${rulePanjang}

FORMAT RESPONS DENGAN FOTO:
Jika pertanyaan menyebut foto/gambar/bukti/dokumentasi ATAU data relevan punya tag [FOTO:xxx], return JSON:
{"text":"jawaban kamu","photos":["pasang-12","service-3"]}
ID foto diambil persis dari tag [FOTO:id] di konteks. Jika tidak ada foto relevan, return teks biasa.
${logSection}${asetSection}

Panduan tambahan:
- Untuk aset SERVICE: sebutkan keluhan, teknisi/vendor, tanggal, status
- Untuk aset DIPINJAM: sebutkan peminjam, divisi, tanggal, keperluan
- Jangan buat data fiktif di luar konteks
- Berikan tips troubleshooting IT praktis jika diminta (khusus scope IT/admin)`;

        const rawReply = await callGemini(systemPrompt, message, history || []);

        let replyText = rawReply.trim();
        let photos = [];
        try {
            const jsonMatch = replyText.match(/\{[\s\S]*?"text"[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                replyText = parsed.text || replyText;
                const ids = parsed.photos || [];
                photos = ids.map(id => filteredPhotoMap[id]).filter(Boolean);
            }
        } catch(e) { }

        res.json({ reply: replyText, photos });

    } catch (err) {
        console.error('AI Chat error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

app.listen(3001, '0.0.0.0', () => {
    console.log('🚀 SYSTEM READY AT PORT 3001');
    console.log('📁 Upload directory:', uploadDir);
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
        const seeAll       = canSeeAllAset(req.session.user);
        const userDivisi   = req.session.user.divisi || 'IT';
        const targetDivisi = seeAll ? (req.query.divisi || null) : userDivisi;
        
        let whereClause = {};
        if (targetDivisi) {
            whereClause.divisi = (targetDivisi === 'IT & IC' || targetDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : targetDivisi;
        }

        const aset = await prisma.aset.findMany({
            where: whereClause,
            orderBy: { nama: 'asc' },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } },
                service:    { orderBy: { tanggal: 'desc' } }
            }
        });
        res.render('aset-export', { aset, divisiLabel: targetDivisi || 'Semua Divisi' });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.get('/aset', requireLogin, async (req, res) => {
    try {
        const { q, kategori, divisi } = req.query;
        const userDivisi  = req.session.user.divisi || 'IT';
        const seeAll      = canSeeAllAset(req.session.user);
        const isAdmin     = hasPerm(req.session.user, 'canUsers');
        
        let where = {};
        if (!seeAll) {
            where.divisi = (userDivisi === 'IT & IC' || userDivisi === 'IT') ? { in: ['IT', 'IT & IC'] } : userDivisi;
        } else if (divisi && divisi !== '') {
            where.divisi = (divisi === 'IT & IC' || divisi === 'IT') ? { in: ['IT', 'IT & IC'] } : divisi;
        }
        
        if (q) where.OR = [{ nama: { contains: q } }, { kategori: { contains: q } }];
        if (kategori && kategori !== '') where.kategori = kategori;
        
        const aset = await prisma.aset.findMany({
            where,
            orderBy: { nama: 'asc' },
            include: { pinjaman: { where: { status: 'Dipinjam' }, select: { id: true } } }
        });
        
        const allKategori = await prisma.aset.findMany({
            where: seeAll ? (divisi && divisi !== '' ? { divisi: where.divisi } : {}) : { divisi: where.divisi },
            select: { kategori: true },
            distinct: ['kategori']
        });
        const allDivisi = await prisma.aset.findMany({ select: { divisi: true }, distinct: ['divisi'], orderBy: { divisi: 'asc' } });
        res.render('aset', {
            aset,
            allKategori: allKategori.map(k => k.kategori),
            allDivisi: allDivisi.map(d => d.divisi),
            userDivisi,
            isAdmin: seeAll, 
            q: q || '',
            kategori: kategori || '',
            divisi: divisi || ''
        });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.get('/aset/:id', requireLogin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.redirect('/aset');
    try {
        const aset = await prisma.aset.findUnique({
            where: { id },
            include: {
                penggunaan: { orderBy: { tanggal: 'desc' } },
                pinjaman:   { orderBy: { tanggalPinjam: 'desc' } },
                service:    { orderBy: { tanggal: 'desc' } }
            }
        });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        res.render('aset-detail', { aset });
    } catch (error) { console.error(error); res.status(500).send("Error: " + error.message); }
});

app.post('/aset/tambah', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const nama      = (req.body.nama      || '').toString().trim();
        const kategori  = (req.body.kategori  || '').toString().trim();
        const satuan    = (req.body.satuan    || '').toString().trim();
        const kondisi   = (req.body.kondisi   || 'Baik').toString().trim();
        const keterangan = req.body.keterangan ? req.body.keterangan.toString().trim() : null;
        const stokNum   = parseInt(req.body.stok) || 0;
        const divisiAset = req.body.divisi ? req.body.divisi.toString().trim() : (req.session.user.divisi || 'IT');
        const fotoUrl   = await saveCompressedPhoto(req.file, 'foto');
        await prisma.aset.create({ data: { nama, divisi: divisiAset, kategori, satuan, stokAwal: stokNum, stok: stokNum, kondisi, keterangan, fotoUrl } });
        res.redirect('/aset?saved=1');
    } catch (error) { console.error(error); res.status(500).send("Gagal tambah aset: " + error.message); }
});

app.post('/aset/edit/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        if (isNaN(asetId)) return res.status(400).send("ID aset tidak valid");

        const nama      = (req.body.nama      || '').toString().trim();
        const kategori  = (req.body.kategori  || '').toString().trim();
        const satuan    = (req.body.satuan    || '').toString().trim();
        const kondisi   = (req.body.kondisi   || 'Baik').toString().trim();
        const keterangan = req.body.keterangan ? req.body.keterangan.toString().trim() : null;
        const stokAwalNum = parseInt(req.body.stokAwal) || 0;

        const resPakai  = await prisma.$queryRawUnsafe('SELECT COALESCE(SUM(jumlah),0) as total FROM AsetPenggunaan WHERE asetId = ?', asetId);
        const resPinjam = await prisma.$queryRawUnsafe("SELECT COALESCE(SUM(jumlah),0) as total FROM AsetPinjam WHERE asetId = ? AND status = 'Dipinjam'", asetId);
        const totalPakai  = Number(resPakai[0].total)  || 0;
        const totalPinjam = Number(resPinjam[0].total) || 0;
        const stokBaru    = stokAwalNum - totalPakai - totalPinjam;

        let fotoUrl = null;
        if (req.file) fotoUrl = await saveCompressedPhoto(req.file, 'foto');

        if (fotoUrl) {
            await prisma.$executeRawUnsafe('UPDATE Aset SET nama=?, kategori=?, satuan=?, stokAwal=?, stok=?, kondisi=?, keterangan=?, fotoUrl=? WHERE id=?',
                nama, kategori, satuan, stokAwalNum, stokBaru, kondisi, keterangan, fotoUrl, asetId);
        } else {
            await prisma.$executeRawUnsafe('UPDATE Aset SET nama=?, kategori=?, satuan=?, stokAwal=?, stok=?, kondisi=?, keterangan=? WHERE id=?',
                nama, kategori, satuan, stokAwalNum, stokBaru, kondisi, keterangan, asetId);
        }

        res.redirect('/aset');
    } catch (error) {
        console.error('[EDIT ASET ERROR]', error.message);
        res.status(500).send("Gagal edit aset: " + error.message + " | body: " + JSON.stringify(req.body));
    }
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
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, divisi, lokasi, keterangan, tanggal } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);
        const fotoUrl = await saveCompressedPhoto(req.file, 'foto');
        await prisma.$transaction([
            prisma.asetPenggunaan.create({ data: { asetId, jumlah: jml, divisi, lokasi, keterangan: keterangan || null, fotoUrl, tanggal: tanggal ? new Date(tanggal) : new Date() } }),
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
        if (penggunaan.fotoUrl) {
            const p = path.join(__dirname, 'public', penggunaan.fotoUrl);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
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
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.id);
        const { jumlah, peminjam, divisi, keperluan, tanggalPinjam } = req.body;
        const jml  = parseInt(jumlah) || 1;
        const aset = await prisma.aset.findUnique({ where: { id: asetId } });
        if (!aset) return res.status(404).send("Aset tidak ditemukan");
        if (aset.stok < jml) return res.status(400).send(`Stok tidak cukup! Stok tersedia: ${aset.stok} ${aset.satuan}`);
        const fotoUrl = await saveCompressedPhoto(req.file, 'foto');
        await prisma.$transaction([
            prisma.asetPinjam.create({ data: { asetId, jumlah: jml, peminjam, divisi, keperluan: keperluan || null, fotoUrl, tanggalPinjam: tanggalPinjam ? new Date(tanggalPinjam) : new Date(), status: 'Dipinjam' } }),
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
        if (pinjam.fotoUrl) {
            const p = path.join(__dirname, 'public', pinjam.fotoUrl);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        const ops = [prisma.asetPinjam.delete({ where: { id: parseInt(req.params.pinjamId) } })];
        if (pinjam.status === 'Dipinjam') {
            ops.push(prisma.aset.update({ where: { id: pinjam.asetId }, data: { stok: { increment: pinjam.jumlah } } }));
        }
        await prisma.$transaction(ops);
        res.redirect('/aset/' + pinjam.asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus: " + error.message); }
});

// ==========================================
// SERVICE ASET
// ==========================================
app.post('/aset/service/:asetId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, upload.single('foto'), async (req, res) => {
    try {
        const asetId = parseInt(req.params.asetId);
        const { teknisi, vendor, keluhan, hasil, biaya, status, tanggal, tanggalSelesai } = req.body;
        let fotoUrl = null;
        if (req.file) fotoUrl = '/uploads/' + req.file.filename;
        await prisma.asetService.create({
            data: {
                asetId,
                teknisi: teknisi || '-',
                vendor:  vendor  || null,
                keluhan: keluhan || '-',
                hasil:   hasil   || null,
                biaya:   biaya   ? parseInt(biaya) : 0,
                status:  status  || 'Proses',
                tanggal: tanggal ? new Date(tanggal) : new Date(),
                tanggalSelesai: (tanggalSelesai && tanggalSelesai !== '') ? new Date(tanggalSelesai) : null,
                fotoUrl
            }
        });
        await prisma.aset.update({
            where: { id: asetId },
            data:  { kondisi: status === 'Selesai' ? 'Baik' : 'Perlu Service' }
        });
        res.redirect('/aset/' + asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal catat service: " + error.message); }
});

app.post('/aset/service-edit/:serviceId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);
        const { teknisi, vendor, keluhan, hasil, biaya, status, tanggal, tanggalSelesai } = req.body;
        const sv = await prisma.asetService.findUnique({ where: { id: serviceId } });
        if (!sv) return res.status(404).send("Tidak ditemukan");
        await prisma.asetService.update({
            where: { id: serviceId },
            data: {
                teknisi: teknisi || sv.teknisi,
                vendor:  vendor  || null,
                keluhan: keluhan || sv.keluhan,
                hasil:   hasil   || null,
                biaya:   biaya   ? parseInt(biaya) : 0,
                status:  status  || sv.status,
                tanggal: tanggal ? new Date(tanggal) : sv.tanggal,
                tanggalSelesai: (tanggalSelesai && tanggalSelesai !== '') ? new Date(tanggalSelesai) : null,
            }
        });
        await prisma.aset.update({
            where: { id: sv.asetId },
            data:  { kondisi: status === 'Selesai' ? 'Baik' : 'Perlu Service' }
        });
        res.redirect('/aset/' + sv.asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal edit service: " + error.message); }
});

app.post('/aset/service-hapus/:serviceId', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAsset')) return res.status(403).render('403', { message: 'Akses ditolak.' });
    next();
}, async (req, res) => {
    try {
        const sv = await prisma.asetService.findUnique({ where: { id: parseInt(req.params.serviceId) } });
        if (!sv) return res.status(404).send("Tidak ditemukan");
        if (sv.fotoUrl) {
            const p = path.join(__dirname, 'public', sv.fotoUrl);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        await prisma.asetService.delete({ where: { id: sv.id } });
        res.redirect('/aset/' + sv.asetId);
    } catch (error) { console.error(error); res.status(500).send("Gagal hapus: " + error.message); }
});