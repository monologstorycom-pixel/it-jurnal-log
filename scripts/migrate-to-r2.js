/**
 * SCRIPT MIGRASI FOTO KE CLOUDFLARE R2
 * Jalankan SEKALI dengan: node scripts/migrate-to-r2.js
 * 
 * Yang dilakukan:
 * 1. Scan semua foto di folder public/uploads
 * 2. Upload ke R2
 * 3. Update URL di semua tabel database
 * 4. Verifikasi hasil
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// CONFIG
// ==========================================
const UPLOAD_DIR = path.resolve(__dirname, '..', 'public', 'uploads');
const APP_URL    = process.env.APP_URL    || 'https://jurnal.rsby.cloud';
const PUBLIC_URL = process.env.R2_PUBLIC_URL;
const BUCKET     = process.env.R2_BUCKET_NAME;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

// ==========================================
// R2 CLIENT
// ==========================================
const r2 = new S3Client({
    region:   'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

// ==========================================
// UPLOAD SATU FILE KE R2
// ==========================================
async function uploadFile(filePath, key) {
    const buf  = fs.readFileSync(filePath);
    const ext  = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    await r2.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        Body:        buf,
        ContentType: mime,
    }));
    return PUBLIC_URL.replace(/\/$/, '') + '/' + key;
}

// ==========================================
// SCAN SEMUA FILE DI UPLOADS (rekursif)
// ==========================================
function scanFiles(dir, base = '') {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const full = path.join(dir, item);
        const rel  = base ? base + '/' + item : item;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            results.push(...scanFiles(full, rel));
        } else if (/\.(jpg|jpeg|png|webp|PNG|JPEG|JPG)$/i.test(item)) {
            results.push({ fullPath: full, key: rel });
        }
    }
    return results;
}

// ==========================================
// MAIN MIGRATION
// ==========================================
async function migrate() {
    console.log('');
    console.log('============================================');
    console.log(' MIGRASI FOTO KE CLOUDFLARE R2');
    console.log('============================================');
    console.log('Bucket    :', BUCKET);
    console.log('Public URL:', PUBLIC_URL);
    console.log('Upload dir:', UPLOAD_DIR);
    console.log('');

    if (!ACCOUNT_ID || !BUCKET || !PUBLIC_URL) {
        console.error('❌ R2 config tidak lengkap! Cek .env');
        process.exit(1);
    }

    // 1. Scan semua file
    const files = scanFiles(UPLOAD_DIR);
    console.log(`📁 Ditemukan ${files.length} file foto\n`);

    if (files.length === 0) {
        console.log('Tidak ada file untuk dimigrasi.');
        process.exit(0);
    }

    // 2. Upload semua file ke R2
    let uploaded = 0, skipped = 0, failed = 0;
    const urlMap = {}; // old URL → new R2 URL

    for (const f of files) {
        const oldUrl  = '/uploads/' + f.key.replace(/\\/g, '/');
        const r2Key   = f.key.replace(/\\/g, '/');
        const newUrl  = PUBLIC_URL.replace(/\/$/, '') + '/' + r2Key;

        process.stdout.write(`Uploading [${++uploaded}/${files.length}] ${f.key} ... `);
        try {
            await uploadFile(f.fullPath, r2Key);
            urlMap[oldUrl] = newUrl;
            console.log('✅');
        } catch (err) {
            console.log('❌', err.message);
            failed++;
            uploaded--;
        }
    }

    console.log(`\n📤 Upload selesai: ${uploaded} berhasil, ${failed} gagal\n`);

    if (Object.keys(urlMap).length === 0) {
        console.log('Tidak ada URL untuk diupdate.');
        process.exit(0);
    }

    // 3. Update URL di database
    console.log('🗄️  Update URL di database...\n');

    let totalUpdated = 0;

    // --- Journal ---
    const journals = await prisma.journal.findMany({
        where: { OR: [{ fotoUrl: { not: null } }, { fotoAwalUrl: { not: null } }] },
        select: { id: true, fotoUrl: true, fotoAwalUrl: true }
    });
    for (const j of journals) {
        const upd = {};
        if (j.fotoUrl     && urlMap[j.fotoUrl])     upd.fotoUrl     = urlMap[j.fotoUrl];
        if (j.fotoAwalUrl && urlMap[j.fotoAwalUrl]) upd.fotoAwalUrl = urlMap[j.fotoAwalUrl];
        if (Object.keys(upd).length) {
            await prisma.journal.update({ where: { id: j.id }, data: upd });
            totalUpdated++;
        }
    }
    console.log(`  ✅ Journal: ${totalUpdated} record diupdate`);

    // --- Tugas ---
    let tugasUpdated = 0;
    const tugas = await prisma.tugas.findMany({
        where: { OR: [{ fotoUrl: { not: null } }, { fotoTugasUrl: { not: null } }] },
        select: { id: true, fotoUrl: true, fotoTugasUrl: true }
    });
    for (const t of tugas) {
        const upd = {};
        if (t.fotoUrl     && urlMap[t.fotoUrl])     upd.fotoUrl     = urlMap[t.fotoUrl];
        if (t.fotoTugasUrl && urlMap[t.fotoTugasUrl]) upd.fotoTugasUrl = urlMap[t.fotoTugasUrl];
        if (Object.keys(upd).length) {
            await prisma.tugas.update({ where: { id: t.id }, data: upd });
            tugasUpdated++;
        }
    }
    console.log(`  ✅ Tugas: ${tugasUpdated} record diupdate`);

    // --- Aset ---
    let asetUpdated = 0;
    const asets = await prisma.aset.findMany({
        where: { OR: [{ fotoUrl: { not: null } }, { foto2Url: { not: null } }, { foto3Url: { not: null } }] },
        select: { id: true, fotoUrl: true, foto2Url: true, foto3Url: true }
    });
    for (const a of asets) {
        const upd = {};
        if (a.fotoUrl  && urlMap[a.fotoUrl])  upd.fotoUrl  = urlMap[a.fotoUrl];
        if (a.foto2Url && urlMap[a.foto2Url]) upd.foto2Url = urlMap[a.foto2Url];
        if (a.foto3Url && urlMap[a.foto3Url]) upd.foto3Url = urlMap[a.foto3Url];
        if (Object.keys(upd).length) {
            await prisma.aset.update({ where: { id: a.id }, data: upd });
            asetUpdated++;
        }
    }
    console.log(`  ✅ Aset: ${asetUpdated} record diupdate`);

    // --- AsetPenggunaan, AsetPinjam, AsetService ---
    for (const model of ['asetPenggunaan', 'asetPinjam', 'asetService']) {
        let count = 0;
        const rows = await prisma[model].findMany({
            where: { fotoUrl: { not: null } },
            select: { id: true, fotoUrl: true }
        });
        for (const r of rows) {
            if (r.fotoUrl && urlMap[r.fotoUrl]) {
                await prisma[model].update({ where: { id: r.id }, data: { fotoUrl: urlMap[r.fotoUrl] } });
                count++;
            }
        }
        console.log(`  ✅ ${model}: ${count} record diupdate`);
    }

    // --- User (fotoUrl) ---
    let userUpdated = 0;
    const users = await prisma.user.findMany({
        where: { fotoUrl: { not: null } },
        select: { id: true, fotoUrl: true }
    });
    for (const u of users) {
        if (u.fotoUrl && urlMap[u.fotoUrl]) {
            await prisma.user.update({ where: { id: u.id }, data: { fotoUrl: urlMap[u.fotoUrl] } });
            userUpdated++;
        }
    }
    console.log(`  ✅ User: ${userUpdated} record diupdate`);

    console.log('\n============================================');
    console.log(` MIGRASI SELESAI`);
    console.log(`  File diupload : ${uploaded}`);
    console.log(`  DB diupdate   : ${totalUpdated + tugasUpdated + asetUpdated + userUpdated} record`);
    console.log('============================================\n');

    await prisma.$disconnect();
}

migrate().catch(err => {
    console.error('❌ Fatal error:', err);
    prisma.$disconnect();
    process.exit(1);
});
