<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=28&pause=1000&color=00B4D8&center=true&vCenter=true&width=600&lines=📋+IT+Jurnal+Log;Sistem+Manajemen+Jurnal+IT;Powered+by+Node.js+%2B+Gemini+AI" alt="Typing SVG" />

<br/>

### 🚀 Sistem Manajemen Jurnal IT Modern — Web-Based, AI-Powered

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![EJS](https://img.shields.io/badge/EJS-3.x-B4CA65?style=for-the-badge&logo=ejs&logoColor=black)](https://ejs.co)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-Powered-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> Aplikasi web full-stack untuk pencatatan dan manajemen jurnal kegiatan IT secara digital.
> Dilengkapi **AI Google Gemini**, ekspor **Excel**, upload gambar, dan sistem autentikasi yang aman.

<br/>

[🌟 Fitur](#-fitur-lengkap) · [🏗️ Arsitektur](#%EF%B8%8F-arsitektur-sistem) · [💻 Install Windows](#-instalasi-di-windows) · [🐧 Install Linux](#-instalasi-di-linux) · [⚙️ Konfigurasi](#%EF%B8%8F-konfigurasi) · [📁 Struktur](#-struktur-proyek)

---

</div>

## 🌟 Fitur Lengkap

### 📝 Manajemen Jurnal Kegiatan IT
- **Pencatatan Digital** — Catat setiap aktivitas teknis IT secara terstruktur, menggantikan pencatatan manual di kertas
- **CRUD Penuh** — Create, Read, Update, Delete entri jurnal dengan antarmuka yang intuitif
- **Kategori Kegiatan** — Klasifikasikan jenis pekerjaan (hardware, software, jaringan, maintenance, dll.)
- **Riwayat Kegiatan** — Lihat semua histori kegiatan berdasarkan tanggal, kategori, dan petugas
- **Status Penyelesaian** — Tandai pekerjaan sebagai *Selesai*, *Dalam Proses*, atau *Pending*
- **Pencarian & Filter** — Cari jurnal berdasarkan kata kunci, tanggal, status, atau kategori
- **Detail Kegiatan** — Deskripsi lengkap, waktu mulai-selesai, lokasi, dan keterangan tambahan

### 🤖 Integrasi AI — Google Gemini
- **Asisten Pencatatan** — Gemini AI membantu menyusun laporan dari deskripsi singkat
- **Auto-Generate Laporan** — Ubah catatan kasar menjadi laporan teknis yang profesional
- **Analisis Kegiatan** — AI menganalisis pola kegiatan dan memberikan insight
- **Smart Suggestion** — Saran otomatis untuk pengisian kolom berdasarkan konteks
- **API Gratis** — Menggunakan Google Gemini API yang tersedia gratis via [AI Studio](https://aistudio.google.com)

### 📊 Ekspor & Pelaporan (ExcelJS)
- **Export ke Excel (.xlsx)** — Ekspor seluruh data jurnal ke spreadsheet Excel dengan format rapi
- **Laporan Per Periode** — Filter dan ekspor laporan mingguan, bulanan, atau custom range tanggal
- **Format Profesional** — Laporan Excel siap cetak dengan header, styling, dan kolom yang terstruktur
- **Multi-sheet** — Data dapat dipisahkan per sheet berdasarkan kategori atau bulan

### 🖼️ Upload & Manajemen Gambar (Multer + Sharp)
- **Upload Foto Dokumentasi** — Lampirkan foto kondisi perangkat, hasil pekerjaan, atau bukti kegiatan
- **Optimasi Otomatis (Sharp)** — Gambar dikompres dan di-resize otomatis agar tidak memenuhi storage
- **Format Didukung** — JPEG, PNG, WebP
- **Pratinjau Gambar** — Lihat thumbnail gambar langsung di halaman detail jurnal
- **Manajemen File** — Gambar tersimpan terorganisir di direktori `public/uploads/`

### 🔐 Autentikasi & Keamanan
- **Login/Logout Aman** — Sistem autentikasi berbasis Express Session
- **Enkripsi Password** — Password user di-hash menggunakan bcryptjs (tidak disimpan plain text)
- **Proteksi Route** — Halaman-halaman sensitif hanya bisa diakses setelah login
- **Session Management** — Sesi user dikelola server-side dengan expire time
- **Role-based Access** — Pembatasan akses berdasarkan peran pengguna

### 🗄️ Database (Prisma ORM + MySQL)
- **Prisma ORM** — Query database modern dan type-safe tanpa menulis SQL mentah
- **Prisma Studio** — GUI visual untuk melihat dan mengelola isi database langsung dari browser
- **Auto-migrate** — Perubahan schema database dikelola melalui Prisma migrations
- **Relasi Data** — Model data yang terstruktur dengan relasi antar tabel (user, jurnal, kategori, dll.)
- **MySQL 8.x** — Database relasional yang stabil dan banyak digunakan di production

### 🎨 Antarmuka Pengguna (Frontend)
- **Server-Side Rendering** — Halaman di-render di server menggunakan EJS, loading cepat
- **Desain Responsif** — Tampilan optimal di desktop, tablet, dan mobile
- **Dashboard Statistik** — Ringkasan total jurnal, kegiatan aktif, dan grafik aktivitas
- **Navigasi Intuitif** — Sidebar dan navbar yang mudah digunakan
- **Notifikasi** — Feedback visual untuk setiap aksi (sukses, error, warning)

### ⚙️ DevOps & Deployment
- **GitHub Actions** — CI/CD pipeline tersedia di `.github/workflows/`
- **Environment Config** — Konfigurasi via `.env` untuk memisahkan development dan production
- **Postinstall Script** — `npx prisma generate` otomatis dijalankan setelah `npm install`

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                   │
│                HTML + CSS + JavaScript                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP Request
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (Node.js)                     │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Express.js │  │  Middleware  │  │  EJS Template │  │
│  │  (Router)   │  │  (Auth/Log)  │  │  (View Layer) │  │
│  └──────┬──────┘  └──────────────┘  └───────────────┘  │
│         │                                               │
│  ┌──────▼──────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Prisma ORM │  │  Multer      │  │  ExcelJS      │  │
│  │  (Database) │  │  (Upload)    │  │  (Export)     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────┘  │
│         │                │                              │
└─────────┼────────────────┼──────────────────────────────┘
          │                │
┌─────────▼──────┐  ┌──────▼────────┐  ┌─────────────────┐
│   MySQL DB     │  │  File System  │  │  Gemini AI API  │
│   (Data Store) │  │  (Gambar)     │  │  (Google Cloud) │
└────────────────┘  └───────────────┘  └─────────────────┘
```

### 🔧 Stack Backend

| Komponen | Teknologi | Versi | Fungsi |
|----------|-----------|-------|--------|
| Runtime | **Node.js** | 18+ | JavaScript runtime untuk server |
| Framework | **Express.js** | ^4.22.1 | HTTP server, routing, middleware |
| ORM | **Prisma** | ^5.22.0 | Akses database type-safe |
| Template | **EJS** | ^3.1.10 | Server-side HTML rendering |
| Auth Sesi | **express-session** | ^1.19.0 | Manajemen sesi login user |
| Enkripsi | **bcryptjs** | ^3.0.3 | Hash password sebelum disimpan |
| Upload | **Multer** | 1.4.5-lts.1 | Handling upload file/gambar |
| Gambar | **Sharp** | ^0.33.5 | Resize, compress, konversi gambar |
| Excel | **ExcelJS** | ^4.4.0 | Generate & ekspor file .xlsx |
| AI | **Google Gemini API** | — | Fitur kecerdasan buatan |
| Config | **dotenv** | ^17.4.2 | Baca environment variable |
| Parse | **body-parser** | ^2.2.2 | Parsing request body POST |

### 🎨 Stack Frontend

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Template Engine | **EJS** | Render HTML dinamis dari sisi server |
| Markup | **HTML5** | Struktur dan semantik halaman |
| Styling | **CSS3** | Desain tampilan dan responsivitas |
| Scripting | **JavaScript** | Interaksi & logika sisi klien |
| Aset Statis | **Public folder** | CSS, JS, gambar yang diakses langsung |
| Pendekatan | **Server-Side Rendering (SSR)** | Tidak ada framework SPA seperti React |

### 🗄️ Stack Database

| Komponen | Detail |
|----------|--------|
| DBMS | **MySQL 8.x** |
| ORM | **Prisma 5.x** |
| Schema | `prisma/schema.prisma` |
| Dump/Import | `it_jurnal (1).sql` |

---

## 💻 Instalasi di Windows

### Prasyarat Windows

Pastikan sudah terinstall ketiga tool berikut:

**1. Node.js**
- Download di [nodejs.org](https://nodejs.org) → pilih versi **LTS**
- Jalankan installer `.msi`, ikuti langkah default
- Cek di Command Prompt / PowerShell:
  ```cmd
  node --version
  npm --version
  ```

**2. MySQL**
- Download [MySQL Installer](https://dev.mysql.com/downloads/installer/)
- Pilih **Full** atau minimal **MySQL Server** + **MySQL Workbench**
- Saat instalasi, buat password untuk user `root`
- Cek:
  ```cmd
  mysql --version
  ```

**3. Git**
- Download di [git-scm.com](https://git-scm.com/download/win)
- Install dengan pengaturan default

---

### Langkah Instalasi Windows

Buka **Command Prompt** atau **PowerShell**, jalankan satu per satu:

**Step 1 — Clone Repo**
```cmd
git clone https://github.com/monologstorycom-pixel/it-jurnal-log.git
cd it-jurnal-log
```

**Step 2 — Install Dependencies**
```cmd
npm install
```
> Script `postinstall` akan otomatis menjalankan `npx prisma generate`

**Step 3 — Buat Database di MySQL**

Buka MySQL Workbench atau jalankan via CMD:
```cmd
mysql -u root -p
```
Lalu ketik di shell MySQL:
```sql
CREATE DATABASE it_jurnal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kasir'@'localhost' IDENTIFIED BY 'password_kamu';
GRANT ALL PRIVILEGES ON it_jurnal.* TO 'kasir'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Step 4 — Import Schema Database**
```cmd
mysql -u kasir -p it_jurnal < "it_jurnal (1).sql"
```

**Step 5 — Konfigurasi File `.env`**

Buka file `.env` dengan Notepad:
```cmd
notepad .env
```
Edit isinya menjadi:
```env
DATABASE_URL="mysql://kasir:password_kamu@localhost:3306/it_jurnal"
GEMINI_API_KEY="masukkan_api_key_gemini_kamu"
```
Simpan dan tutup.

**Step 6 — Sinkronisasi Prisma**
```cmd
npx prisma generate
npx prisma db push
```

**Step 7 — Jalankan Aplikasi**
```cmd
npm start
```

✅ Buka browser: **http://localhost:3000**

---

### Troubleshooting Windows

| Masalah | Solusi |
|---------|--------|
| `'node' is not recognized` | Restart CMD setelah install Node.js, atau tambahkan ke PATH |
| `Access denied for user 'kasir'` | Periksa username/password di `.env`, pastikan user MySQL sudah dibuat |
| `Cannot find module '@prisma/client'` | Jalankan `npx prisma generate` |
| Port 3000 sudah terpakai | Tambah `PORT=3001` di `.env` |
| MySQL service tidak jalan | Buka **Services** → cari **MySQL** → klik Start |
| `ENOENT: no such file or directory, uploads` | Buat folder: `mkdir public\uploads` |

---

## 🐧 Instalasi di Linux

> Panduan untuk **Ubuntu / Debian**. Untuk Fedora/CentOS gunakan `dnf`, untuk Arch gunakan `pacman`.

### Prasyarat Linux

**Install Node.js via NodeSource (direkomendasikan):**
```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install curl
sudo apt install -y curl

# Tambah NodeSource repo untuk Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verifikasi
node --version
npm --version
```

**Install MySQL:**
```bash
# Install MySQL Server
sudo apt install -y mysql-server

# Start & enable otomatis saat boot
sudo systemctl start mysql
sudo systemctl enable mysql

# Amankan instalasi (set root password, hapus test db, dll.)
sudo mysql_secure_installation

# Verifikasi
mysql --version
```

**Install Git:**
```bash
sudo apt install -y git
```

---

### Langkah Instalasi Linux

**Step 1 — Clone Repo**
```bash
git clone https://github.com/monologstorycom-pixel/it-jurnal-log.git
cd it-jurnal-log
```

**Step 2 — Install Dependencies**
```bash
npm install
```

**Step 3 — Buat Database di MySQL**
```bash
sudo mysql -u root -p
```
Di dalam shell MySQL:
```sql
CREATE DATABASE it_jurnal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kasir'@'localhost' IDENTIFIED BY 'password_kamu';
GRANT ALL PRIVILEGES ON it_jurnal.* TO 'kasir'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Step 4 — Import Schema Database**
```bash
mysql -u kasir -p it_jurnal < "it_jurnal (1).sql"
```

**Step 5 — Konfigurasi File `.env`**
```bash
nano .env
```
Edit isinya:
```env
DATABASE_URL="mysql://kasir:password_kamu@localhost:3306/it_jurnal"
GEMINI_API_KEY="masukkan_api_key_gemini_kamu"
```
Simpan: `Ctrl+O` → Enter → `Ctrl+X`

**Step 6 — Sinkronisasi Prisma**
```bash
npx prisma generate
npx prisma db push
```

**Step 7 — Jalankan Aplikasi**
```bash
npm start
```

✅ Buka browser: **http://localhost:3000**

---

### Jalankan di Background dengan PM2 (Linux Production)

Agar app tetap jalan meski terminal ditutup atau server restart:

```bash
# Install PM2 secara global
sudo npm install -g pm2

# Jalankan app dengan PM2
pm2 start app.js --name "it-jurnal-log"

# Set PM2 otomatis start saat server boot
pm2 startup
pm2 save

# Perintah PM2 lainnya
pm2 status                      # cek status semua proses
pm2 logs it-jurnal-log          # lihat log real-time
pm2 restart it-jurnal-log       # restart app
pm2 stop it-jurnal-log          # stop app
pm2 delete it-jurnal-log        # hapus dari PM2
```

---

### Troubleshooting Linux

| Masalah | Solusi |
|---------|--------|
| `EACCES: permission denied` pada port < 1024 | Gunakan port >= 1024, atau jalankan dengan `sudo` |
| `ERROR 1045: Access denied for user` | Cek ulang username & password di `.env` |
| `Cannot connect to MySQL server` | Jalankan `sudo systemctl start mysql` |
| `sharp` gagal install | `sudo apt install -y libvips-dev` lalu `npm install` ulang |
| `ENOENT: uploads/` | `mkdir -p public/uploads && chmod 755 public/uploads` |
| Prisma error `Environment variable not found` | Pastikan `.env` ada di root folder project |

---

## ⚙️ Konfigurasi

### File `.env` Lengkap

```env
# ==========================================
#  DATABASE CONFIGURATION
# ==========================================
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
DATABASE_URL="mysql://kasir:password_kamu@localhost:3306/it_jurnal"

# ==========================================
#  GOOGLE GEMINI AI
# ==========================================
# Dapatkan API key GRATIS di: https://aistudio.google.com/apikey
GEMINI_API_KEY="masukkan_api_key_kamu_di_sini"

# ==========================================
#  APP (Opsional — bisa disesuaikan)
# ==========================================
PORT=3000
NODE_ENV=development
SESSION_SECRET="ganti_dengan_string_acak_yang_panjang"
```

### Cara Mendapatkan Google Gemini API Key (Gratis)

1. Buka 👉 [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Login dengan akun Google
3. Klik **"Create API Key"**
4. Pilih atau buat project Google Cloud
5. Salin API key yang muncul
6. Tempel ke `.env`: `GEMINI_API_KEY="hasil_copy_kamu"`

> 💡 Google Gemini API **gratis** dengan kuota generous untuk penggunaan personal dan development.

---

## 📁 Struktur Proyek

```
it-jurnal-log/
│
├── .github/
│   └── workflows/              # GitHub Actions — CI/CD pipeline
│
├── prisma/
│   └── schema.prisma           # Definisi model & relasi database
│
├── public/                     # Aset statis (diakses langsung oleh browser)
│   ├── css/                    # File stylesheet
│   ├── js/                     # JavaScript sisi klien
│   ├── images/                 # Gambar statis (logo, icon, dll.)
│   └── uploads/                # Hasil upload gambar dari pengguna
│
├── status/                     # File helper atau status konfigurasi
│
├── views/                      # Template EJS — Server-Side Rendering
│   ├── pages/                  # Halaman-halaman utama
│   │   ├── dashboard.ejs       # Dashboard utama
│   │   ├── login.ejs           # Halaman login
│   │   └── jurnal/             # Halaman CRUD jurnal
│   └── partials/               # Komponen yang dipakai ulang
│       ├── header.ejs
│       ├── navbar.ejs
│       ├── sidebar.ejs
│       └── footer.ejs
│
├── node_modules/               # Instalasi package (JANGAN di-commit)
│
├── .env                        # Variabel rahasia (JANGAN di-commit!)
├── app.js                      # Entry point — konfigurasi Express & routes
├── it_jurnal (1).sql           # Dump database MySQL (schema + data awal)
├── package.json                # Metadata proyek & daftar dependencies
├── package-lock.json           # Lock file versi dependencies
└── README.md                   # Dokumentasi ini
```

---

## 🚀 Script yang Tersedia

```bash
# Jalankan aplikasi
npm start

# Buka GUI visual database di browser (port 5555)
npx prisma studio

# Generate ulang Prisma Client (wajib setelah ubah schema)
npx prisma generate

# Push perubahan schema ke DB tanpa membuat file migrasi
npx prisma db push

# Buat file migrasi baru & terapkan ke database
npx prisma migrate dev --name nama_migrasi

# Reset database (HAPUS SEMUA DATA! Hati-hati)
npx prisma migrate reset

# Lihat status migrasi
npx prisma migrate status
```

---

## 📦 Daftar Lengkap Dependencies

| Package | Versi | Fungsi |
|---------|-------|--------|
| `express` | ^4.22.1 | Framework HTTP server & routing |
| `ejs` | ^3.1.10 | Template engine server-side |
| `@prisma/client` | ^5.22.0 | Prisma database client |
| `prisma` | ^5.22.0 | Prisma CLI & migrations |
| `bcryptjs` | ^3.0.3 | Hash & verifikasi password |
| `express-session` | ^1.19.0 | Manajemen sesi login |
| `multer` | 1.4.5-lts.1 | Upload file multipart/form-data |
| `sharp` | ^0.33.5 | Resize, compress, konversi gambar |
| `exceljs` | ^4.4.0 | Buat & ekspor file Excel .xlsx |
| `dotenv` | ^17.4.2 | Load variabel dari file .env |
| `body-parser` | ^2.2.2 | Parse body dari request POST/PUT |

---

## 🔒 Catatan Keamanan Penting

> ⚠️ **File `.env` dan API key sudah terekspos di repo publik — segera ambil tindakan!**

```bash
# Langkah 1: Tambahkan .env ke .gitignore
echo ".env" >> .gitignore

# Langkah 2: Hapus .env dari tracking Git
git rm --cached .env
git commit -m "security: remove .env from version control"
git push
```

Kemudian:
- Buka [Google AI Studio](https://aistudio.google.com/apikey) → **Revoke** API key lama → Buat yang baru
- Ganti password database jika dipakai di production
- Gunakan password yang kuat & tidak mudah ditebak
- Aktifkan **HTTPS** jika deploy ke server publik

---

## 🤝 Kontribusi

Pull Request sangat diterima! Ikuti langkah ini:

```bash
# Fork repo via GitHub, lalu clone fork kamu
git clone https://github.com/USERNAME_KAMU/it-jurnal-log.git
cd it-jurnal-log

# Buat branch baru
git checkout -b feat/nama-fitur

# Kerjakan perubahan, lalu commit
git add .
git commit -m "feat: tambah fitur nama-fitur"

# Push & buat Pull Request di GitHub
git push origin feat/nama-fitur
```

**Konvensi Commit:**

| Prefix | Kapan Dipakai |
|--------|---------------|
| `feat:` | Fitur baru |
| `fix:` | Perbaikan bug |
| `docs:` | Update dokumentasi |
| `style:` | Perubahan styling/formatting |
| `refactor:` | Refactoring tanpa fitur baru |
| `perf:` | Optimasi performa |
| `chore:` | Update dependency / konfigurasi |

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License** — bebas digunakan, dimodifikasi, dan didistribusikan dengan tetap mencantumkan atribusi.

---

<div align="center">

Dibuat dengan ❤️ oleh [monologstorycom-pixel](https://github.com/monologstorycom-pixel)

<br/>

**⭐ Kalau project ini berguna, kasih star ya! ⭐**

<br/>

[![GitHub stars](https://img.shields.io/github/stars/monologstorycom-pixel/it-jurnal-log?style=social)](https://github.com/monologstorycom-pixel/it-jurnal-log/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/monologstorycom-pixel/it-jurnal-log?style=social)](https://github.com/monologstorycom-pixel/it-jurnal-log/network/members)

</div>