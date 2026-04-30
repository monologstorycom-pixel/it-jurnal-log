const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const sharp  = require('sharp');

const uploadDir    = path.resolve(__dirname, '..', 'public', 'uploads');
const uploadTmpDir = path.join(__dirname, '..', 'uploads', 'tmp');

// Pastikan direktori ada
if (!fs.existsSync(uploadDir))    fs.mkdirSync(uploadDir,    { recursive: true });
if (!fs.existsSync(uploadTmpDir)) fs.mkdirSync(uploadTmpDir, { recursive: true });

// ==========================================
// MULTER CONFIG
// ==========================================
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadTmpDir),
        filename:    (req, file, cb) => cb(null, 'tmp-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan'));
    }
});

// Upload single (untuk route lain yg masih pakai upload.single)
const uploadSingle = upload.single('foto');

// Upload fields — mendukung fotoAwal (journal), foto, foto2, foto3 (aset)
const uploadFields = upload.fields([
    { name: 'fotoAwal', maxCount: 1 },
    { name: 'foto',     maxCount: 1 },
    { name: 'foto2',    maxCount: 1 },
    { name: 'foto3',    maxCount: 1 },
]);

// Upload multi foto aset (tambah & edit aset)
const uploadAsetFoto = upload.fields([
    { name: 'foto',  maxCount: 1 },
    { name: 'foto2', maxCount: 1 },
    { name: 'foto3', maxCount: 1 },
]);

// ==========================================
// SAVE + COMPRESS PHOTO
// ==========================================
async function saveCompressedPhoto(file, fieldname, tipe = 'log', divisi = 'IT') {
    if (!file) return null;

    let targetDir = uploadDir;
    let subFolder = '';

    // Logika sub-folder untuk divisi non-IT
    if (tipe.startsWith('aset') && divisi !== 'IT' && divisi !== 'IT & IC') {
        const safeDivisi = divisi.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        targetDir = path.join(uploadDir, safeDivisi);
        subFolder = safeDivisi + '/';
    }

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Prefix nama file
    let prefix = 'FILE-';
    if (tipe === 'log') {
        prefix = fieldname === 'fotoAwal' ? 'IT-AWAL-' : 'IT-LOG-';
    } else if (tipe.startsWith('aset')) {
        const safePrefixDiv = divisi.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (tipe === 'aset')         prefix = `ASET-${safePrefixDiv}-`;
        if (tipe === 'aset_pakai')   prefix = `PASANG-${safePrefixDiv}-`;
        if (tipe === 'aset_pinjam')  prefix = `PINJAM-${safePrefixDiv}-`;
        if (tipe === 'aset_service') prefix = `SVC-${safePrefixDiv}-`;
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = prefix + uniqueSuffix + '.jpg';
    const outPath  = path.join(targetDir, filename);

    try {
        const source = file.path || file.buffer;
        if (!source) return null;
        const buffer = await sharp(source)
            .rotate()
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        fs.writeFileSync(outPath, buffer);
        if (file.path && fs.existsSync(file.path)) { try { fs.unlinkSync(file.path); } catch(e) {} }
        return '/uploads/' + subFolder + filename;
    } catch(sharpErr) {
        console.warn('[Sharp fallback]', sharpErr.message);
        const ext = file.originalname ? path.extname(file.originalname) : '.jpg';
        const rawFilename = prefix + uniqueSuffix + ext;
        const rawOutPath  = path.join(targetDir, rawFilename);
        if (file.path) {
            fs.copyFileSync(file.path, rawOutPath);
            try { fs.unlinkSync(file.path); } catch(e) {}
        } else if (file.buffer) {
            fs.writeFileSync(rawOutPath, file.buffer);
        } else {
            return null;
        }
        return '/uploads/' + subFolder + rawFilename;
    }
}

// ==========================================
// HAPUS FILE FOTO DARI DISK
// ==========================================
function deleteFotoFile(fotoUrl) {
    if (!fotoUrl) return;
    try {
        const filePath = path.join(uploadDir, '..', fotoUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch(e) {
        console.warn('[deleteFotoFile]', e.message);
    }
}

module.exports = { upload, uploadSingle, uploadFields, uploadAsetFoto, saveCompressedPhoto, deleteFotoFile, uploadDir };
