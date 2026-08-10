/**
 * Script: fix buatOleh yang tidak match dengan nama user terbaru
 * Jalankan di server: node scripts/fix-buatoleh.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Update semua tugas yang buatOleh = 'general affair' → 'Pak Deni (GA)'
    const result = await prisma.tugas.updateMany({
        where: { buatOleh: 'general affair' },
        data:  { buatOleh: 'Pak Deni (GA)' }
    });
    console.log(`✅ Updated ${result.count} tugas dari "general affair" → "Pak Deni (GA)"`);

    // Kalau ada nama lama lain yang perlu difix, tambahkan di sini:
    // const result2 = await prisma.tugas.updateMany({
    //     where: { buatOleh: 'nama lama' },
    //     data:  { buatOleh: 'nama baru' }
    // });

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
