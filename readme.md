# 🛠️ IT Jurnal & Asset Management System

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.x-green.svg)](https://nodejs.org/)
[![Framework](https://img.shields.io/badge/framework-Express.js-blue.svg)](https://expressjs.com/)
[![ORM](https://img.shields.io/badge/orm-Prisma-black.svg)](https://www.prisma.io/)
[![Database](https://img.shields.io/badge/database-MySQL-orange.svg)](https://www.mysql.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)

Sistem manajemen inventaris aset IT dan pencatatan jurnal aktivitas harian (log) yang dirancang untuk efisiensi kerja tim IT Support. Aplikasi ini mendukung fitur offline (PWA) dan manajemen data yang aman.

---

## 🌟 Fitur Utama

-   **Dashboard Admin**: Ringkasan data aset dan aktivitas terbaru.
-   **Manajemen Aset**: Input, edit, hapus, dan monitoring status perangkat IT.
-   **Jurnal Aktivitas (Log)**: Pencatatan tugas harian tim IT Support secara sistematis.
-   **Export Data**: Unduh data aset ke format **Excel (.xlsx)** atau **CSV** dengan mudah.
-   **Upload Gambar**: Dukungan upload bukti fisik atau foto aset menggunakan *Multer*.
-   **PWA & Offline Support**: Dapat diakses meski koneksi internet tidak stabil dan bisa di-install di desktop/mobile.
-   **Authentication**: Sistem login yang aman untuk membedakan akses Admin dan User.

---

## 🚀 Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database & ORM**: MySQL, Prisma ORM
-   **Frontend**: EJS (Embedded JavaScript Templates), CSS, JavaScript
-   **Utilities**: 
    - `ExcelJS` & `Fast-CSV` (Export data)
    - `Multer` (Handling file uploads)
    - `Bcrypt` (Password hashing)
    - `Day.js` (Date manipulation)

---

## 📂 Struktur Folder

```text
it-jurnal-log/
├── prisma/             # Database schema & migrations
├── public/             # Static files (CSS, JS, Images, Manifest)
│   ├── uploads/        # Folder foto aset
│   └── sw.js           # Service Worker (PWA)
├── views/              # EJS Templates (UI)
├── app.js              # Main application entry point
├── package.json        # Project dependencies
└── .env                # Environment variables (Sensitive)