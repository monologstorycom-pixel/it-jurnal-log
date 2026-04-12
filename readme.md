Tentu, ini adalah draf `README.md` yang lengkap, profesional, dan "keren" untuk proyek **IT Jurnal Log** Anda. File ini disusun berdasarkan analisis kode yang Anda unggah, mencakup arsitektur, teknologi yang digunakan, hingga fitur-fitur unggulannya.

---

# 🚀 IT Jurnal Log & Asset Management

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.x-green.svg)](https://nodejs.org/)
[![Framework: Express](https://img.shields.io/badge/framework-Express-blue.svg)](https://expressjs.com/)
[![ORM: Prisma](https://img.shields.io/badge/orm-Prisma-brightgreen.svg)](https://prisma.io/)
[![PWA: Ready](https://img.shields.io/badge/PWA-Ready-orange.svg)]()

**IT Jurnal Log** adalah platform manajemen aktivitas dan inventaris IT yang dirancang untuk efisiensi operasional. Aplikasi ini memungkinkan teknisi IT untuk mencatat log kerja harian, mengelola aset infrastruktur, serta menghasilkan laporan performa secara instan.

---

## ✨ Fitur Unggulan

Berdasarkan analisis teknis pada kode sumber, berikut adalah fitur-fitur utama aplikasi ini:

### 📑 1. Jurnal Aktivitas IT (Logging System)
* **Pencatatan Real-time**: Mencatat setiap aktivitas perbaikan atau pemeliharaan dengan detail.
* **Dokumentasi Visual**: Mendukung unggah foto bukti kerja menggunakan **Multer** untuk transparansi progres.

### 💻 2. Manajemen Aset (Inventory Tracking)
* **Database Terstruktur**: Mengelola informasi detail aset (PC, Laptop, Server, Network Device).
* **Tracking Status**: Memantau kondisi aset secara berkala (Normal, Rusak, Perbaikan).
* **Detail View**: Halaman khusus untuk melihat riwayat lengkap per aset.

### 📊 3. Export & Reporting
* **Export ke Excel**: Integrasi dengan **ExcelJS** yang memungkinkan pengguna mengunduh data aset atau log ke format `.xlsx` secara rapi dan siap cetak.

### 📱 4. Progressive Web App (PWA) Support
* **Installable**: Dapat diinstal di HP atau Desktop langsung dari browser.
* **Service Worker**: Dilengkapi dengan `sw.js` dan `manifest.json` untuk performa yang lebih cepat dan aksesibilitas layaknya aplikasi native.

### 🛡️ 5. Admin Dashboard
* **Manajemen Terpusat**: Panel kontrol khusus untuk mengelola seluruh data sistem dari satu tempat.

---

## 🛠️ Analisis Teknologi (Tech Stack)

Aplikasi ini dibangun dengan arsitektur yang modern dan skalabel:

| Komponen | Teknologi |
| :--- | :--- |
| **Backend** | Node.js & Express.js |
| **Database ORM** | Prisma (Mendukung MySQL/PostgreSQL/SQLite) |
| **Template Engine** | EJS (Embedded JavaScript) |
| **File Upload** | Multer |
| **Date Handling** | Day.js |
| **PWA Features** | Service Workers & Web Manifest |
| **Reporting** | ExcelJS |

---

## 🚀 Cara Instalasi

Ikuti langkah-langkah berikut untuk menjalankan proyek di lokal Anda:

1.  **Clone Repository**
    ```bash
    git clone https://github.com/rizqisubagyo/it-jurnal-log.git
    cd it-jurnal-log
    ```

2.  **Instal Dependensi**
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment**
    Buat file `.env` di root folder dan sesuaikan kredensial database Anda:
    ```env
    DATABASE_URL="mysql://username:password@localhost:3306/it_jurnal"
    PORT=3000
    ```

4.  **Setup Database**
    Jalankan migrasi Prisma untuk membuat tabel otomatis:
    ```bash
    npx prisma migrate dev --name init
    ```
    *(Atau impor manual file `it_jurnal.sql` jika diperlukan).*

5.  **Jalankan Aplikasi**
    ```bash
    npm start
    ```
    Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## 📂 Struktur Folder

```text
it-jurnal-log/
├── prisma/             # Skema database dan migrasi
├── public/             # Static files (CSS, JS, Icons, Uploads)
│   ├── uploads/        # Tempat penyimpanan foto log
│   └── sw.js           # Service Worker PWA
├── views/              # Template tampilan (EJS)
│   ├── admin.ejs       # Dashboard Utama
│   ├── aset.ejs        # Daftar Inventaris
│   └── navbar.ejs      # Komponen navigasi
├── app.js              # Entry point aplikasi
└── package.json        # Definisi project & dependensi
```

---

## 📈 Analisis Sistem

Aplikasi ini menggunakan **Prisma ORM** yang memastikan integrasi database sangat aman dari SQL Injection dan memudahkan migrasi antar database. Penggunaan **EJS** di sisi frontend memungkinkan rendering data yang cepat di sisi server (*Server-Side Rendering*), sehingga sangat SEO-friendly dan ringan dijalankan di perangkat dengan spek rendah.

Dukungan **PWA** adalah nilai tambah besar, memudahkan tim IT di lapangan untuk mengakses aplikasi tanpa harus selalu membuka browser secara manual.

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Jika Anda ingin meningkatkan fitur atau melaporkan bug, silakan buat *Pull Request* atau *Issue*.

---

## 📝 Lisensi

Project ini dibuat oleh **Rizqi Subagyo**.

---

> **Tip:** Jangan lupa untuk memberikan ⭐ pada repository ini jika bermanfaat!

---

### Catatan Tambahan untuk Anda:
Jika Anda ingin menambahkan screenshot, buat folder `img` di repo Anda dan panggil gambarnya di bagian fitur agar terlihat lebih profesional. Semoga bermanfaat!