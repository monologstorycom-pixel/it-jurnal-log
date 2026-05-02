const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const prisma                = require('../services/prisma');
const { callGemini, getAsetContext } = require('../services/gemini');
const { requireLogin }      = require('../middleware/auth');
const { hasPerm, getAiScope } = require('../helpers/permissions');
const { uploadDir }         = require('../helpers/photo');

// ==========================================
// AI DESCRIBE (auto-generate deskripsi tiket)
// ==========================================
router.post('/api/ai-describe', requireLogin, async (req, res) => {
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
// AI CHAT PUBLIC (tanpa login)
// ==========================================
router.post('/api/ai-chat-public', async (req, res) => {
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
// AI CHAT (dengan login)
// ==========================================
router.post('/api/ai-chat', requireLogin, async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

        const user  = req.session.user;
        const scope = getAiScope(user);

        const [recentLogs, asetResult] = await Promise.all([
            scope.canLog || scope.role === 'audit'
                ? prisma.journal.findMany({
                    orderBy: { tanggalManual: 'desc' }, take: 20,
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
            const filtered = sections.filter(s => s.startsWith('--- DIVISI: ' + scope.divisiFilter.toUpperCase()));
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

        let scopeDesc = '', rulePanjang = 'Jawab dalam Bahasa Indonesia, singkat dan to the point. Maksimal 3-4 kalimat kecuali diminta detail.';

        if (scope.role === 'admin') {
            scopeDesc = `Kamu diakses oleh ADMINISTRATOR (${user.nama}). Kamu bisa membahas SEMUA hal: log IT, aset semua divisi, detail lengkap.`;
        } else if (scope.role === 'audit') {
            scopeDesc = `Kamu diakses oleh tim AUDIT / INTERNAL CONTROL (${user.nama}). PERANMU ADALAH SEBAGAI AUDITOR IT SENIOR.
TUGAS UTAMAMU:
1. Analisis data dengan sangat kritis, tajam, dan mendalam.
2. Cari anomali, inefisiensi, indikasi pemborosan, atau ketidakwajaran (misal: aset ditangani berkali-kali, pending berhari-hari, stok janggal, masalah berulang pada user yang sama).
3. Cross-check data pemakaian aset dengan log jurnal IT.
4. Berikan insight, kesimpulan, dan rekomendasi audit yang berbobot berdasarkan data yang ada.`;
            rulePanjang = 'Jawab dalam Bahasa Indonesia secara profesional dan to the point layaknya Auditor. Gunakan format poin-poin singkat untuk temuan audit. Maksimal 5-6 poin utama, setiap poin 1-2 kalimat. Jangan bertele-tele.';
        } else if (scope.role === 'it') {
            scopeDesc = `Kamu diakses oleh staf IT (${user.nama}). Kamu bisa membahas log IT jurnal. Untuk data aset, kamu hanya bisa melihat aset divisi IT.\nJika ditanya aset divisi lain, tolak dengan sopan: "Maaf, informasi aset divisi lain di luar akses kamu. Hubungi Administrator untuk info lintas divisi. 🔒"`;
        } else {
            scopeDesc = `Kamu diakses oleh staf divisi ${user.divisi} (${user.nama}).
BATASAN: Kamu HANYA boleh membahas aset milik divisi ${user.divisi}.
Jika ditanya tentang LOG IT jurnal atau aset divisi lain, tolak dengan sopan:
"Maaf, informasi tersebut di luar akses divisi ${user.divisi}. Untuk info log IT atau aset divisi lain, silakan hubungi tim IT atau Administrator. 🔒"`;
        }

        const logSection  = logContext ? `\n=== LOG JURNAL IT (20 tiket terbaru) ===\n${logContext}` : '';
        const asetSection = scope.canAsetAll
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
        let replyText = rawReply.trim(), photos = [];

        try {
            const jsonMatch = replyText.match(/\{[\s\S]*?"text"[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                replyText = parsed.text || replyText;
                photos = (parsed.photos || []).map(id => filteredPhotoMap[id]).filter(Boolean);
            }
        } catch(e) {}

        res.json({ reply: replyText, photos });
    } catch (err) {
        console.error('AI Chat error:', err);
        res.status(500).json({ error: '⚠️ ' + err.message });
    }
});

// ==========================================
// API CEK FOTO
// ==========================================
router.get('/api/check-foto/:filename', requireLogin, (req, res) => {
    const fotoPath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(fotoPath)) {
        const stat = fs.statSync(fotoPath);
        res.json({ exists: true, size: stat.size, path: fotoPath });
    } else {
        res.json({ exists: false, uploadDir, filename: req.params.filename });
    }
});

// ==========================================
// API NOTES
// ==========================================
router.get('/api/notes', requireLogin, async (req, res) => {
    try { res.json(await prisma.note.findMany({ orderBy: { createdAt: 'desc' } })); }
    catch (e) { res.status(500).json({ error: 'Gagal ambil notes' }); }
});

router.post('/api/notes', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canAdd') && !hasPerm(req.session.user, 'canEdit')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { res.json(await prisma.note.create({ data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: 'Gagal tambah notes' }); }
});

router.put('/api/notes/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canEdit')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { res.json(await prisma.note.update({ where: { id: parseInt(req.params.id) }, data: { title: req.body.title, content: req.body.content } })); }
    catch (e) { res.status(500).json({ error: 'Gagal update notes' }); }
});

router.delete('/api/notes/:id', requireLogin, (req, res, next) => {
    if (!hasPerm(req.session.user, 'canUsers')) return res.status(403).json({ error: 'Akses ditolak' });
    next();
}, async (req, res) => {
    try { await prisma.note.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: 'Gagal hapus notes' }); }
});

module.exports = router;
