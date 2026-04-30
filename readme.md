<div align="center">

# 📋 IT Jurnal Log

### Sistem Manajemen Jurnal IT Modern berbasis Web

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge)](package.json)

> 🚀 Aplikasi pencatatan dan manajemen jurnal kegiatan IT yang powerful, dilengkapi fitur AI dari Google Gemini, ekspor Excel, manajemen file gambar, dan sistem autentikasi lengkap.

[✨ Fitur](#-fitur-utama) • [⚙️ Instalasi](#%EF%B8%8F-instalasi) • [🔧 Konfigurasi](#-konfigurasi) • [📁 Struktur](#-struktur-proyek) • [🛠️ Tech Stack](#%EF%B8%8F-tech-stack)

---

</div>

## ✨ Fitur Utama

### 📝 Manajemen Jurnal
- **Pencatatan Kegiatan IT** — Catat setiap aktivitas teknis secara terstruktur dan sistematis
- **CRUD Lengkap** — Tambah, lihat, edit, dan hapus entri jurnal dengan mudah
- **Riwayat Aktivitas** — Lacak semua kegiatan berdasarkan tanggal, kategori, dan petugas
- **Status Tracking** — Monitor status penyelesaian setiap kegiatan IT

### 🤖 Integrasi AI (Google Gemini)
- **Asisten Cerdas** — Didukung Google Gemini AI untuk membantu analisis dan pencatatan
- **Auto-Suggest** — Saran otomatis berdasarkan konteks kegiatan yang dicatat
- **Smart Summary** — Ringkasan cerdas dari aktivitas harian/mingguan

### 📊 Ekspor & Laporan
- **Export ke Excel** — Ekspor data jurnal ke format `.xlsx` menggunakan ExcelJS
- **Laporan Terstruktur** — Generate laporan kegiatan IT yang siap cetak
- **Filter & Sort** — Filter data berdasarkan tanggal, kategori, atau petugas sebelum ekspor

### 🖼️ Manajemen File & Gambar
- **Upload Gambar** — Lampirkan dokumentasi foto kegiatan menggunakan Multer
- **Optimasi Otomatis** — Gambar dioptimasi otomatis menggunakan Sharp (resize, compress)
- **Penyimpanan Terkelola** — File tersimpan rapi di direktori `public/`

### 🔐 Autentikasi & Keamanan
- **Login & Logout Aman** — Sistem autentikasi dengan Express Session
- **Password Hashing** — Password dienkripsi menggunakan bcryptjs
- **Proteksi Route** — Halaman sensitif dilindungi middleware autentikasi
- **Session Management** — Manajemen sesi pengguna yang aman

### 📱 UI/UX
- **Tampilan Responsif** — Antarmuka yang nyaman di desktop maupun mobile
- **Template EJS** — Server-side rendering yang cepat dan efisien
- **Dashboard Informatif** — Ringkasan statistik kegiatan secara real-time

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js 4.x |
| **Template Engine** | EJS (Embedded JavaScript) |
| **ORM** | Prisma 5.x |
| **Database** | MySQL 8.x |
| **AI** | Google Gemini API |
| **File Upload** | Multer 1.4.5 |
| **Image Processing** | Sharp 0.33 |
| **Excel Export** | ExcelJS 4.x |
| **Auth** | Express Session + bcryptjs |
| **Environment** | dotenv |

---

## ⚙️ Instalasi

### Prasyarat

Pastikan kamu sudah menginstall:

- [Node.js](https://nodejs.org) versi **18 atau lebih baru**
- [MySQL](https://mysql.com) versi **8.x**
- [Git](https://git-scm.com)

### Langkah-langkah

**1. Clone Repository**

```bash
git clone https://github.com/monologstorycom-pixel/it-jurnal-log.git
cd it-jurnal-log
```

**2. Install Dependencies**

```bash
npm install
```

> ⚠️ `npx prisma generate` akan otomatis dijalankan setelah install selesai (via `postinstall` script).

**3. Setup Database MySQL**

Buat database baru di MySQL:

```sql
CREATE DATABASE it_jurnal;
CREATE USER 'kasir'@'localhost' IDENTIFIED BY 'passwordmu';
GRANT ALL PRIVILEGES ON it_jurnal.* TO 'kasir'@'localhost';
FLUSH PRIVILEGES;
```

Import schema database:

```bash
mysql -u kasir -p it_jurnal < "it_jurnal (1).sql"
```

**4. Konfigurasi Environment**

Salin file `.env` dan sesuaikan nilainya:

```bash
cp .env .env.local
```

Edit file `.env`:

```env
# Database
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:3306/it_jurnal"

# Google Gemini AI - Dapatkan API key gratis di: https://aistudio.google.com/apikey
GEMINI_API_KEY="api_key_kamu_di_sini"
```

**5. Sinkronisasi Prisma dengan Database**

```bash
npx prisma db push
```

atau jika menggunakan migrasi:

```bash
npx prisma migrate dev
```

**6. Jalankan Aplikasi**

```bash
npm start
```

Aplikasi akan berjalan di: **http://localhost:3000**

---

## 🔧 Konfigurasi

### Environment Variables

| Variable | Keterangan | Contoh |
|----------|-----------|--------|
| `DATABASE_URL` | URL koneksi MySQL | `mysql://user:pass@localhost:3306/it_jurnal` |
| `GEMINI_API_KEY` | API Key Google Gemini AI | `AIzaSy...` |

### Mendapatkan Google Gemini API Key

1. Kunjungi [Google AI Studio](https://aistudio.google.com/apikey)
2. Login dengan akun Google
3. Klik **"Create API Key"**
4. Salin API key dan masukkan ke file `.env`

> 💡 Google Gemini API tersedia **gratis** dengan kuota yang cukup untuk penggunaan normal.

---

## 📁 Struktur Proyek

```
it-jurnal-log/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── prisma/
│   └── schema.prisma       # Skema database Prisma
├── public/                 # Static files (CSS, JS, gambar upload)
├── status/                 # File status atau konfigurasi tambahan
├── views/                  # Template EJS
│   ├── pages/              # Halaman-halaman utama
│   └── partials/           # Komponen reusable (header, footer, navbar)
├── .env                    # Konfigurasi environment (jangan di-commit!)
├── app.js                  # Entry point aplikasi
├── it_jurnal (1).sql       # File dump/schema database MySQL
├── package.json            # Konfigurasi dan dependensi proyek
└── README.md               # Dokumentasi ini
```

---

## 🚀 Script yang Tersedia

```bash
# Menjalankan aplikasi
npm start

# Generate Prisma Client
npx prisma generate

# Membuka Prisma Studio (GUI database)
npx prisma studio

# Sinkronisasi schema ke database
npx prisma db push

# Jalankan migrasi
npx prisma migrate dev
```

---

## 🗄️ Database

Proyek ini menggunakan **MySQL** dengan **Prisma ORM**. Schema database tersedia di:
- File SQL: `it_jurnal (1).sql`
- Prisma Schema: `prisma/schema.prisma`

Untuk melihat dan mengelola data secara visual, gunakan **Prisma Studio**:

```bash
npx prisma studio
```

---

## 🤝 Kontribusi

Kontribusi selalu disambut! Berikut caranya:

1. **Fork** repository ini
2. Buat **branch** baru (`git checkout -b fitur/nama-fitur`)
3. **Commit** perubahan kamu (`git commit -m 'feat: tambah fitur keren'`)
4. **Push** ke branch (`git push origin fitur/nama-fitur`)
5. Buat **Pull Request**

### Konvensi Commit

```
feat:     Fitur baru
fix:      Perbaikan bug
docs:     Perubahan dokumentasi
style:    Perubahan formatting/style
refactor: Refactoring kode
test:     Menambah atau memperbaiki test
chore:    Update dependencies atau konfigurasi
```

---

## ⚠️ Catatan Keamanan

> **PENTING:** Jangan pernah meng-commit file `.env` ke repository publik!

- Tambahkan `.env` ke `.gitignore`
- Ganti `GEMINI_API_KEY` yang sudah terpublik dengan yang baru
- Gunakan password yang kuat untuk database di production
- Aktifkan HTTPS jika deploy ke server publik

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

---

<div align="center">

Dibuat dengan ❤️ oleh [monologstorycom-pixel](https://github.com/monologstorycom-pixel)

⭐ Jangan lupa kasih **star** kalau project ini berguna buat kamu!

</div>