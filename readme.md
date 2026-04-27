# 📋 IT Support Log — Sistem Jurnal IT

Aplikasi web untuk mencatat, memantau, dan mengelola aktivitas harian tim IT Support. Dilengkapi manajemen aset, sistem role & permission, export Excel, dan tampilan publik untuk seluruh divisi.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|---|---|
| 📝 Log Harian & Multi-hari | Catat aktivitas IT harian atau rentang tanggal |
| 🔍 Search Global | Cari log by aktivitas, nama, divisi, atau deskripsi |
| 📊 Statistik Dashboard | Ringkasan solved/pending hari ini & all-time |
| 🔔 Notifikasi Pending | Alert tiket pending disertai umur & tombol aksi langsung |
| 🗂 Manajemen Aset IT | Kelola stok, penggunaan, dan peminjaman aset |
| 👥 Multi User & Role | Admin, User, Viewer dengan permission granular |
| 📤 Export Excel | Export log by bulan atau data aset ke file `.xlsx` |
| 🌓 Dark / Light Mode | Tema otomatis tersimpan di browser |
| 📱 Responsive | Tampilan mobile-friendly dengan tabel scrollable |
| 👁 Public View | Halaman log & aset bisa diakses tanpa login |

---

## 🛠 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Template Engine:** EJS
- **ORM:** Prisma
- **Database:** MySQL
- **Auth:** express-session + bcryptjs
- **Excel:** ExcelJS
- **Upload:** Multer

---

## ⚙️ Persyaratan Sistem

| Komponen | Versi Minimum |
|---|---|
| Node.js | v18 ke atas |
| npm | v8 ke atas |
| MySQL | v8.0 ke atas |

---

## 🪟 Instalasi di Windows

### 1. Install Node.js
- Download installer dari [nodejs.org](https://nodejs.org) pilih versi LTS
- Jalankan installer, centang semua opsi default
- Verifikasi: buka **Command Prompt** lalu ketik:
```cmd
node -v
npm -v
```

### 2. Install MySQL
- Download **MySQL Community Server** dari [mysql.com](https://dev.mysql.com/downloads/mysql/)
- Saat instalasi, catat password root yang kamu set
- Setelah selesai, buka **MySQL Workbench** atau MySQL Command Line Client

### 3. Buat Database
Buka MySQL CLI atau Workbench, jalankan:
```sql
CREATE DATABASE it_jurnal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Lalu import data awal:
```cmd
mysql -u root -p it_jurnal < it_jurnal.sql
```

### 4. Clone / Extract Project
```cmd
git clone https://github.com/monologstorycom-pixel/it-jurnal-log
cd it-jurnal-log
```

### 5. Konfigurasi Environment
Buat file `.env` di root folder project dengan isi:
```env
DATABASE_URL="mysql://root:PASSWORD_KAMU@localhost:3306/it_jurnal"
```
> Ganti `PASSWORD_KAMU` dengan password MySQL kamu.

### 6. Install Dependencies
```cmd
npm install
```
> `npx prisma generate` akan otomatis jalan setelah install selesai.

### 7. Jalankan Aplikasi
```cmd
npm start
```

Buka browser: **http://localhost:3001**

---

## 🐧 Instalasi di Linux (Ubuntu / Debian)

### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 2. Install MySQL
```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

### 3. Buat Database & User
```bash
sudo mysql -u root -p
```
Di dalam MySQL shell:
```sql
CREATE DATABASE it_jurnal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'itlog_user'@'localhost' IDENTIFIED BY 'password_aman';
GRANT ALL PRIVILEGES ON it_jurnal.* TO 'itlog_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import data awal:
```bash
mysql -u itlog_user -p it_jurnal < it_jurnal.sql
```

### 4. Clone Project
```bash
git clone https://github.com/monologstorycom-pixel/it-jurnal-log
cd it-jurnal-log
```

### 5. Konfigurasi Environment
```bash
nano .env
```
Isi file `.env`:
```env
DATABASE_URL="mysql://itlog_user:password_aman@localhost:3306/it_jurnal"
```
Simpan dengan `Ctrl+X` lalu `Y` lalu `Enter`.

### 6. Install Dependencies
```bash
npm install
```

### 7. Jalankan Aplikasi
```bash
npm start
```

Buka browser: **http://localhost:3001**

---

## 🚀 Deploy di Linux dengan PM2 (Agar Jalan Terus)

PM2 memastikan aplikasi tetap berjalan walau terminal ditutup atau server restart.

```bash
# Install PM2 secara global
sudo npm install -g pm2

# Jalankan aplikasi dengan PM2
pm2 start app.js --name "it-jurnal"

# Set PM2 auto-start saat server reboot
pm2 startup
pm2 save

# Cek status
pm2 status

# Lihat log real-time
pm2 logs it-jurnal

# Restart aplikasi setelah update
pm2 restart it-jurnal
```

---

## 🔄 Update / Redeploy

```bash
# Pull perubahan terbaru
git pull origin main

# Install ulang dependencies
npm install

# Restart aplikasi
pm2 restart it-jurnal
```

> ✅ **Tidak perlu uninstall/install ulang bcrypt** — project ini menggunakan `bcryptjs` (pure JavaScript) yang kompatibel di semua OS tanpa native compile.

---

## 🔐 Login Default

Setelah import database, gunakan akun berikut untuk pertama kali:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |

> ⚠️ **Segera ganti password setelah login pertama** melalui menu **Users → Edit**.

---

## 👥 Sistem Role & Permission

| Permission | Keterangan |
|---|---|
| `canView` | Bisa melihat data di dashboard |
| `canAdd` | Bisa tambah log baru |
| `canEdit` | Bisa edit log yang ada |
| `canDelete` | Bisa hapus log |
| `canAsset` | Bisa kelola aset IT |
| `canExport` | Bisa export data ke Excel |
| `canUsers` | Bisa kelola user (admin only) |

Role **Admin** mendapat semua permission secara otomatis.

---

## 📁 Struktur Project

```
it-jurnal-log/
├── app.js                 # Main server & semua route
├── package.json           # Dependencies
├── .env                   # Konfigurasi environment (buat sendiri)
├── it_jurnal.sql          # File import database awal
├── prisma/
│   └── schema.prisma      # Skema database
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
└── views/
    ├── index.ejs           # Halaman publik log harian + search
    ├── aset-public.ejs     # Halaman publik aset IT
    ├── admin.ejs           # Dashboard utama (login required)
    ├── aset.ejs            # Manajemen aset (login required)
    ├── users.ejs           # Manajemen user (admin only)
    ├── login.ejs           # Halaman login
    ├── navbar.ejs          # Navbar dashboard (login)
    └── navbar-public.ejs   # Navbar halaman publik
```

---

## 🌐 Struktur URL

| URL | Akses | Keterangan |
|---|---|---|
| `/` | Publik | Log harian + search global |
| `/aset-public` | Publik | Daftar aset IT |
| `/login` | Publik | Halaman login |
| `/kerja` | Login | Dashboard utama |
| `/aset` | Login | Manajemen aset |
| `/users` | Admin | Manajemen user |
| `/export` | Login + canExport | Export log ke Excel by bulan |
| `/export-aset` | Login + canExport | Export semua aset ke Excel |

---

## ❓ Troubleshooting

**Port 3001 sudah dipakai**
```bash
# Linux
sudo lsof -i :3001
sudo kill -9 <PID>
```
```cmd
rem Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Error: Cannot connect to database**
- Pastikan MySQL service berjalan
- Cek isi `DATABASE_URL` di file `.env`
- Pastikan database `it_jurnal` sudah dibuat dan `it_jurnal.sql` sudah diimport

**Error: Prisma Client not generated**
```bash
npx prisma generate
```

**Aplikasi crash setelah update**
```bash
pm2 logs it-jurnal --lines 50
```
Cek error di log lalu:
```bash
npm install && pm2 restart it-jurnal
```

---

## 📄 Lisensi

Internal use — IT Department.
