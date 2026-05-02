const path   = require('path');
const fs     = require('fs');
const prisma = require('./prisma');

// ==========================================
// GEMINI API HELPER
// ==========================================
async function callGemini(systemPrompt, userMessage, history = []) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY belum diset di .env');

    const geminiHistory = history.map(h => ({
        role:  h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [...geminiHistory, { role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            })
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ==========================================
// BUILD ASET CONTEXT FOR AI
// ==========================================
async function getAsetContext() {
    const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads');

    const asetList = await prisma.aset.findMany({
        orderBy: [{ divisi: 'asc' }, { nama: 'asc' }],
        select: {
            id: true, nama: true, divisi: true, kategori: true, satuan: true,
            stokAwal: true, stok: true, kondisi: true, keterangan: true, fotoUrl: true,
            penggunaan: {
                orderBy: { tanggal: 'desc' }, take: 10,
                select: { id: true, jumlah: true, divisi: true, lokasi: true, keterangan: true, tanggal: true, fotoUrl: true }
            },
            pinjaman: {
                orderBy: { tanggalPinjam: 'desc' }, take: 10,
                select: { id: true, peminjam: true, divisi: true, jumlah: true, tanggalPinjam: true, tanggalKembali: true, keperluan: true, status: true, fotoUrl: true }
            },
            service: {
                orderBy: { tanggal: 'desc' }, take: 5,
                select: { id: true, teknisi: true, vendor: true, keluhan: true, hasil: true, biaya: true, status: true, tanggal: true, tanggalSelesai: true, fotoUrl: true }
            }
        }
    });

    if (!asetList.length) return { text: 'Belum ada data aset.', photoMap: {} };

    const tglFmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const isValidPhoto = (url) => {
        if (!url) return false;
        if (url.includes('/tmp/') || url.includes('tmp-')) return false;
        try {
            return fs.existsSync(path.join(uploadDir, '..', url.replace(/^\/uploads\//, 'uploads/')));
        } catch(e) { return false; }
    };

    const photoMap = {};
    const grouped  = {};

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

module.exports = { callGemini, getAsetContext };
