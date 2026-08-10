const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');

// ==========================================
// R2 CLIENT
// ==========================================
function getR2Client() {
    const accountId      = process.env.R2_ACCOUNT_ID;
    const accessKeyId    = process.env.R2_ACCESS_KEY_ID;
    const secretKey      = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretKey) return null;

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey: secretKey }
    });
}

// ==========================================
// UPLOAD FILE KE R2
// Mengembalikan public URL atau null kalau gagal
// ==========================================
async function uploadToR2(filePath, key) {
    const client    = getR2Client();
    const bucket    = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!client || !bucket || !publicUrl) {
        console.warn('[R2] Config belum lengkap — R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
        return null;
    }

    try {
        const fileBuffer  = fs.readFileSync(filePath);
        const contentType = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

        await client.send(new PutObjectCommand({
            Bucket:      bucket,
            Key:         key,
            Body:        fileBuffer,
            ContentType: contentType,
        }));

        // Hapus file lokal setelah upload sukses
        try { fs.unlinkSync(filePath); } catch(e) {}

        const url = publicUrl.replace(/\/$/, '') + '/' + key;
        console.log('[R2] ✅ Upload sukses:', url);
        return url;
    } catch (err) {
        console.error('[R2] ❌ Upload gagal:', err.message);
        return null;
    }
}

// ==========================================
// HAPUS FILE DARI R2
// ==========================================
async function deleteFromR2(fileUrl) {
    if (!fileUrl) return;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!publicUrl) return;

    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    if (!client || !bucket) return;

    try {
        // Extract key dari URL
        const base = publicUrl.replace(/\/$/, '');
        if (!fileUrl.startsWith(base)) return;
        const key = fileUrl.replace(base + '/', '');
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        console.log('[R2] ✅ Delete sukses:', key);
    } catch (err) {
        console.warn('[R2] ❌ Delete gagal:', err.message);
    }
}

// ==========================================
// CEK APAKAH R2 AKTIF
// ==========================================
function isR2Enabled() {
    const enabled = !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME &&
        process.env.R2_PUBLIC_URL
    );
    if (!enabled) {
        console.warn('[R2] isR2Enabled=false — cek env: ACCOUNT_ID=' + (process.env.R2_ACCOUNT_ID ? 'ada' : 'KOSONG') + ' PUBLIC_URL=' + (process.env.R2_PUBLIC_URL || 'KOSONG'));
    }
    return enabled;
}

module.exports = { uploadToR2, deleteFromR2, isR2Enabled };
