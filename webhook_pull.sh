#!/bin/bash
cd /DATA/AppData/it-jurnal-rsby

# 1. Ambil info terbaru dari GitHub
git fetch --all

# 2. Paksa sinkronkan file kode, tapi TIDAK menyentuh .env (karena sudah di-ignore)
git checkout origin/main -- .

# 3. Pastikan library terupdate (tanpa campur tangan root)
npm install

# 4. Update skema database otomatis
npx prisma db push

# 5. Restart PM2 sesuai nama proses yang baru (it-jurnal-rsby)
pm2 restart it-jurnal-rsby
