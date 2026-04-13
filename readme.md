<div align="center">

```
 _____ _____   ____  _   _ ____  ____   ___  ____  _____   _     ___   ____ 
|_   _|_   _| / ___|| | | |  _ \|  _ \ / _ \|  _ \|_   _| | |   / _ \ / ___|
  | |   | |   \___ \| | | | |_) | |_) | | | | |_) | | |   | |  | | | | |  _ 
  | |   | |    ___) | |_| |  __/|  __/| |_| |  _ <  | |   | |__| |_| | |_| |
  |_|   |_|   |____/ \___/|_|   |_|    \___/|_| \_\ |_|   |_____\___/ \____|
```

# IT Support Log — RSBY

**Sistem pencatatan aktivitas IT Support internal berbasis web**

[![Node.js](https://img.shields.io/badge/Node.js-v22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://mysql.com)
[![License](https://img.shields.io/badge/License-Internal-red?style=flat-square)](LICENSE)

</div>

---

## 📋 Tentang Aplikasi

IT Support Log adalah aplikasi web internal untuk mencatat, mengelola, dan melaporkan seluruh aktivitas IT Support di PT. Auri Steel Metalindo. Dibangun untuk kebutuhan audit, monitoring SLA, dan manajemen aset IT secara real-time.

> **Diakses oleh:** Tim IT Support & Management  
> **Tujuan:** Transparansi kerja, kemudahan audit, tracking aset

---

## ✨ Fitur Utama

### 📝 Jurnal Aktivitas IT
- **Input harian** — Catat aktivitas dengan jam mulai & selesai, durasi otomatis dihitung
- **Input multi-hari** — Untuk pekerjaan panjang seperti instalasi vendor/CCTV yang berlangsung berhari-hari
- **Durasi otomatis** — Format cerdas: `7 menit`, `1 jam 30 menit`, `2 hari 4 jam`
- **Status tracking** — Pending / Solved dengan tombol update langsung dari tabel
- **Foto dokumentasi** — Upload 2 foto: kondisi **AWAL** (sebelum) dan **SESUDAH** perbaikan
- **Filter & pencarian** — Filter per bulan, tahun, status
- **Export Excel** — Laporan bulanan/harian siap cetak dengan hyperlink foto

### 📦 Manajemen Aset IT
- **Master inventaris** — Daftar lengkap aset dengan satuan fleksibel (pcs, meter, unit, bungkus, dll)
- **Stok real-time** — Bar indikator stok (hijau/kuning/merah) otomatis update
- **Catat penggunaan** — Setiap pemasangan potong stok + catat divisi & lokasi
- **Peminjaman** — Catat peminjam, divisi, keperluan — stok otomatis berkurang
- **Pengembalian** — Konfirmasi kembali → stok naik otomatis + catat tanggal kembali
- **Riwayat lengkap** — Per aset: semua catatan penggunaan + pinjaman
- **Export PDF** — Laporan audit lengkap: master stok + riwayat pakai + riwayat pinjam + tanda tangan

### 🔐 Autentikasi
- Login page dengan session 8 jam
- Semua halaman diprotect — redirect ke login kalau belum auth
- Dark mode / Light mode toggle — tersimpan per browser

### 📝 Notes / Catatan
- Catatan cepat di dashboard — reminder untuk tim
- Tampil di viewer mode sebagai floating panel

---

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js v22 |
| Framework | Express.js 4.x |
| Template | EJS |
| ORM | Prisma 5.x |
| Database | MySQL / MariaDB |
| Auth | express-session + bcryptjs |
| Upload | Multer |
| Excel | ExcelJS |
| CSS | Bootstrap 5.3 + Custom |
| PWA | Service Worker + Web Manifest |

---

## 📁 Struktur Project

```
it-jurnal-rsby/
├── app.js                  # Entry point — semua routes
├── package.json
├── .env                    # Konfigurasi database
│
├── prisma/
│   ├── schema.prisma       # Model database
│   └── migrations/         # History migration SQL
│
├── public/
│   ├── uploads/            # Foto dokumentasi (auto-created)
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
│
└── views/
    ├── navbar.ejs          # Shared navbar (include di semua halaman)
    ├── login.ejs           # Halaman login
    ├── admin.ejs           # Dashboard input & tabel jurnal
    ├── index.ejs           # Viewer harian (read-only)
    ├── aset.ejs            # Daftar master aset
    ├── aset-detail.ejs     # Riwayat per aset
    └── aset-export.ejs     # Template export PDF aset
```

---

## 🚀 Instalasi

### Prasyarat
- Node.js v18+
- MySQL / MariaDB
- npm

### 1. Clone & Install

```bash
git clone https://github.com/username/it-jurnal-rsby.git
cd it-jurnal-rsby
npm install
```

### 2. Setup Environment

Buat file `.env` di root project:

```env
DATABASE_URL="mysql://USERNAME:PASSWORD@127.0.0.1:3306/it_jurnal"
```

### 3. Setup Database

```bash
# Buat database
mysql -u root -p -e "CREATE DATABASE it_jurnal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Jalankan migrations
mysql -u root -p it_jurnal < prisma/migrations/20260406141746_init/migration.sql
mysql -u root -p it_jurnal < prisma/migrations/20260406162559_add_notes_model/migration.sql
mysql -u root -p it_jurnal < migration_add_waktu_durasi_foto2.sql
mysql -u root -p it_jurnal < migration_multihari.sql
mysql -u root -p it_jurnal < migration_aset.sql
mysql -u root -p it_jurnal < migration_users.sql

# Generate Prisma client
npx prisma generate
```

### 4. Jalankan

```bash
# Development
npm start

# Production (dengan PM2)
pm2 start app.js --name "it-jurnal-rsby"
pm2 save
pm2 startup
```

Akses di: `http://localhost:3001`

---

## 🔑 Login Default

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **Ganti password segera setelah login pertama kali!**

---

## 📊 Skema Database

```
User          — Akun login
Journal       — Log aktivitas IT (harian & multi-hari)
Note          — Catatan/reminder
Aset          — Master inventaris aset IT
AsetPenggunaan — Riwayat penggunaan/pemasangan (potong stok)
AsetPinjam    — Riwayat peminjaman (potong stok, kembalikan stok)
```

---

## 🌐 URL Routes

| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/login` | Halaman login |
| POST | `/login` | Proses login |
| GET | `/logout` | Logout + destroy session |
| GET | `/` | Viewer harian (read-only) |
| GET | `/kerja` | Dashboard admin |
| POST | `/save` | Simpan jurnal baru |
| POST | `/edit/:id` | Edit jurnal |
| POST | `/delete/:id` | Hapus jurnal |
| POST | `/update-status/:id` | Update status Pending→Solved |
| GET | `/export` | Export Excel |
| GET | `/aset` | Daftar master aset |
| GET | `/aset/:id` | Riwayat aset |
| POST | `/aset/tambah` | Tambah aset baru |
| POST | `/aset/pakai/:id` | Catat penggunaan (potong stok) |
| POST | `/aset/pinjam/:id` | Catat pinjaman (potong stok) |
| POST | `/aset/kembali/:id` | Konfirmasi pengembalian |
| GET | `/aset/export-pdf` | Export PDF laporan aset |
| GET/POST/PUT/DELETE | `/api/notes` | CRUD catatan |

---

## 📱 PWA Support

Aplikasi ini mendukung **Progressive Web App** — bisa diinstal di Android/iOS sebagai aplikasi shortcut dari browser. Tombol install muncul otomatis di navbar saat kondisi terpenuhi.

---

## 🖨 Export Laporan

### Excel (Jurnal)
- Filter per tanggal atau per bulan
- Kolom: Tanggal, Jam Mulai, Jam Selesai, Durasi, Divisi, User, Aktivitas, Deskripsi, Status, Link Foto Awal, Link Foto Sesudah

### PDF (Aset IT)
- Akses: `/aset/export-pdf`
- Isi: Ringkasan stok + Tabel master aset + Riwayat penggunaan + Riwayat pinjaman + Kolom tanda tangan
- Print dari browser → Save as PDF

---

## ⚙️ Konfigurasi PM2 (Production)

```bash
# Start
pm2 start app.js --name "it-jurnal"

# Auto restart saat crash
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs it-jurnal
```

---

## 🔧 Troubleshooting

**`Cannot find module 'bcrypt'`**
```bash
npm uninstall bcrypt
npm install bcryptjs
# Pastikan app.js menggunakan require('bcryptjs')
```

**`invalid ELF header` (pindah OS Windows→Linux)**
```bash
rm -rf node_modules
npm install
```

**Prisma error setelah update schema**
```bash
npx prisma generate
pm2 restart app
```

**Upload foto gagal**
```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

---

## 👤 Author

**Rizqi Subagyo**  
IT Support — PT. Auri Steel Metalindo

---

<div align="center">

*Dibuat untuk kebutuhan internal PT. Auri Steel Metalindo*  
*Internal use only — not for public distribution*

</div>
