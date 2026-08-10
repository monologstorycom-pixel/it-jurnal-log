# Changelog — IT Jurnal Log

## Session: 11 Agustus 2026

---

## ✅ SELESAI & DEPLOYED

### 1. Fix: Gambar WA tidak terkirim setelah pindah ke Cloudflare R2
**File:** `helpers/kirimdev.js`
- Root cause: `uploadMediaToMeta()` langsung return `null` kalau URL starts with `http` (URL R2)
- Fix: Tambah fungsi `downloadToBuffer(url)` yang download gambar dari R2 ke memory buffer dulu, lalu buffer di-upload ke Meta Media API
- Flow baru: `R2 URL → download ke buffer → upload ke Meta API → dapat media_id → kirim WA template ✅`

---

### 2. Fix: Build Coolify pakai nginx static bukan Node.js
**File:** `Procfile` (baru), hapus `nixpacks.toml`
- Root cause: Nixpacks salah detect sebagai static site karena ada folder `public/`
- Fix: Tambah `Procfile` dengan isi `web: node app.js` agar Nixpacks detect sebagai Node.js app

---

### 3. Feat: Tombol "Hubungi Pelapor" via WhatsApp di halaman tugas
**File:** `routes/tugas.js`, `views/tugas.ejs`
- Route GET `/tugas` sekarang query `noHp` dari tabel `User` berdasarkan nama pembuat (`buatOleh`)
- Data `noHpPembuat` digabungkan ke setiap tugas object
- Tombol hanya muncul untuk user maintenance (`isMtc`) yang punya `noHpPembuat` tidak null
- Klik langsung buka WhatsApp dengan pesan pre-filled: `"Halo pak/buk saya dari tim maintenance"`

---

### 4. Feat: Role baru "Tugas MTC" (`canTugasMtc`)
**File:** `helpers/permissions.js`, `routes/auth.js`, `routes/tugas.js`, `routes/users.js`, `views/users.ejs`
- Permission `canTugasMtc`: user hanya bisa akses halaman `/tugas`, tidak bisa akses halaman lain
- Setelah login langsung redirect ke `/tugas`
- Di halaman Users ada preset button **"📋 Tugas MTC"** (warna ungu)
- Badge "Tugas MTC Only" muncul di daftar user
- **Penting:** `canTugasMtc` harus ada di `routes/users.js` di kedua blok permissions (add & edit) agar tersimpan ke DB

---

### 5. Fix: Hapus foto dari R2 saat tugas dihapus atau foto diganti
**File:** `routes/tugas.js`
- Route `POST /tugas/hapus/:id` sekarang hapus `fotoUrl` dan `fotoTugasUrl` dari R2 (kalau URL `http`) atau dari disk (kalau path lokal)
- Route `POST /tugas/edit/:id` sekarang hapus foto lama dari R2 sebelum simpan foto baru saat foto diganti

---

### 6. Feat: Update status "Proses" 1x klik tanpa modal
**File:** `views/tugas.ejs`
- Status `Belum` → tombol **"⏳ Proses"** langsung submit form tanpa modal
- Status `Proses` → tombol **"✓ Selesai"** buka modal khusus Selesai
- Modal Selesai: catatan **wajib** + foto bukti **wajib**
- Backend tetap enforce validasi: foto wajib saat status Selesai

---

### 7. Feat: Toast popup setelah update status
**File:** `routes/tugas.js`, `views/tugas.ejs`
- Setelah klik Proses/Selesai, redirect ke `/tugas?statusDone=Proses` atau `?statusDone=Selesai`
- Toast muncul di **tengah layar** selama 4 detik
- Proses → toast biru: *"Tugas Diproses! Silakan segera dikerjakan."*
- Selesai → toast hijau: *"Tugas Selesai! Laporan berhasil disimpan."*
- Query param `statusDone` dihapus dari URL pakai `history.replaceState` setelah toast tampil
- **Fix redirect:** sebelumnya redirect ke `/maintenance`, sekarang ke `/tugas` agar maintenance tidak keluar dari halaman

---

## ❌ GAGAL / DIBATALKAN

### Icon SVG → Bootstrap Icons
- **Tujuan:** Ganti semua SVG inline dengan `<i class="bi bi-xxx">` Bootstrap Icons
- **Masalah:**
  1. Percobaan 1: Pakai emoji → encoding rusak karena PowerShell regex tidak handle multiline SVG dengan benar, semua icon jadi `??`
  2. Percobaan 2: Pakai Bootstrap Icons via `@import` di dalam `<style>` → EJS parser error karena `url(...)` dibaca sebagai EJS expression
  3. Percobaan 3: Pakai `<link rel="stylesheet">` → fix `@import` error, tapi muncul error baru "Unexpected token 'catch'" di `navbar.ejs`
  4. Percobaan 4: Tambah `async: true` di EJS config → site render `{}` karena Express tidak handle async EJS response
- **Status:** Semua perubahan icon di-revert kembali ke state bersih
- **TODO besok:** Ganti icon dengan cara yang benar:
  - Load Bootstrap Icons CDN di masing-masing `<head>` setiap file EJS (bukan di navbar)
  - Ganti SVG satu file per satu, commit, test deploy dulu sebelum lanjut ke file berikutnya
  - Atau: buat file `public/bi.css` yang host Bootstrap Icons locally agar tidak tergantung CDN parse

---

## State Akhir Repository

| Commit | Keterangan |
|--------|-----------|
| `7470322` | HEAD saat ini — semua perubahan icon di-revert, semua feature baru tetap ada |
| `643e202` | State sebelum percobaan icon (reference point) |

**Yang sudah production & stabil:**
- Fix R2 WhatsApp image ✅
- Tombol Hubungi Pelapor ✅
- Role canTugasMtc ✅
- Hapus foto R2 saat tugas dihapus ✅
- Proses 1x klik + Toast popup ✅
- Procfile untuk Coolify ✅

---

## Session Lanjutan: 11 Agustus 2026 (malam)

---

## ✅ SELESAI & DEPLOYED

### 8. Fix: Tombol "Hubungi Pelapor" tidak muncul karena nama user berubah
**Root cause:** `buatOleh` di tabel `Tugas` masih menyimpan nama lama `"general affair"`, sedangkan nama user di DB sudah diubah ke `"Pak Deni (GA)"`. Query noHp lookup berdasarkan `nama` tidak ketemu.
- **Fix data:** Buat script `scripts/fix-buatoleh.js` untuk update `buatOleh` lama ke nama baru
- **Cara jalankan:** `sudo docker exec <container-id> node scripts/fix-buatoleh.js`
- **Fix kode:** `isMtc` sekarang juga `true` untuk user dengan permission `canTugasMtc` (sebelumnya hanya untuk divisi MAINTENANCE)
- **File:** `routes/tugas.js`, `scripts/fix-buatoleh.js`

---

### 9. Fix: Tombol "⏳ Proses" label ambigu
**File:** `views/tugas.ejs`
- Label diganti dari `"⏳ Proses"` → `"▶ Mulai Kerjakan"` agar jelas ini adalah action bukan status

---

### 10. Fix: Server disk penuh (100%) → MariaDB crash
**Root cause:** Docker image lama dari setiap deploy menumpuk dan memenuhi disk 94GB hingga 100%.
- **Fix:** Jalankan `sudo docker image prune -a` → disk turun dari 100% ke 67% (sisa 31GB)
- **Preventif:** Set cron job mingguan di server:
  ```
  0 3 * * 0 docker image prune -a -f >> /var/log/docker-prune.log 2>&1
  ```
- **Cara set:** `sudo crontab -e` lalu tambahkan baris di atas

---

### 11. Fix: Filter "Hari Ini" deteksi tanggal salah (masih tanggal kemarin)
**Root cause:** `new Date().toISOString()` selalu UTC. Jam 01:54 WIB = masih tanggal 10 di UTC, padahal WIB sudah tanggal 11.
- **Fix route server:** `routes/tugas.js` — `todayStr` sekarang pakai offset WIB (+7 jam)
  ```js
  const wibOffset = 7 * 60 * 60 * 1000;
  const todayWIB = new Date(today.getTime() + wibOffset);
  const todayStr = todayWIB.toISOString().split('T')[0];
  ```
- **Fix browser JS:** `setToday()` di `views/tugas.ejs` sekarang pakai `getFullYear/getMonth/getDate` yang ikut timezone browser (WIB), bukan `toISOString()` yang UTC
- **File:** `routes/tugas.js`, `views/tugas.ejs`
- **Catatan:** Timezone server juga diubah ke `Asia/Jakarta` via `sudo timedatectl set-timezone Asia/Jakarta`

---

## State Akhir Repository (Update)

| Commit | Keterangan |
|--------|-----------|
| `b5ead8e` | HEAD — fix timezone WIB untuk filter tanggal |
| `7c3f2f7` | Label tombol "Mulai Kerjakan" |
| `0e452a1` | Script fix buatOleh + isMtc fix |
| `7470322` | Revert semua percobaan icon |

**Yang sudah production & stabil:**
- Fix R2 WhatsApp image ✅
- Tombol Hubungi Pelapor ✅
- Role canTugasMtc ✅
- Hapus foto R2 saat tugas dihapus ✅
- Proses 1x klik + Toast popup ✅
- Procfile untuk Coolify ✅
- Label tombol "Mulai Kerjakan" ✅
- Fix timezone WIB filter tanggal ✅
- Cron job Docker prune mingguan ✅
