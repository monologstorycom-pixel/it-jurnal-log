-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 172.17.0.1
-- Generation Time: Apr 16, 2026 at 06:16 AM
-- Server version: 11.4.8-MariaDB-log
-- PHP Version: 8.5.3

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `it_jurnal`
--

-- --------------------------------------------------------

--
-- Table structure for table `Aset`
--

CREATE TABLE `Aset` (
  `id` int(11) NOT NULL,
  `nama` varchar(191) NOT NULL,
  `kategori` varchar(100) NOT NULL DEFAULT 'Umum',
  `satuan` varchar(30) NOT NULL DEFAULT 'unit',
  `stokAwal` int(11) NOT NULL DEFAULT 0,
  `stok` int(11) NOT NULL DEFAULT 0,
  `kondisi` varchar(50) NOT NULL DEFAULT 'Baik',
  `keterangan` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Aset`
--

INSERT INTO `Aset` (`id`, `nama`, `kategori`, `satuan`, `stokAwal`, `stok`, `kondisi`, `keterangan`, `createdAt`) VALUES
(1, 'Kabel LAN Cromscope  ', 'jaringan', 'meter', 305, 286, 'Baik', NULL, '2026-04-12 06:23:42.417'),
(2, 'Switch Ruijie ', 'jaringan', 'pcs', 1, 1, 'Baik', '16 port', '2026-04-12 06:24:33.912'),
(3, 'Penghapus', 'ATK', 'pcs', 2, 2, 'Baik', 'permintaan indri ic', '2026-04-12 06:28:01.049'),
(4, 'RJ45', 'jaringan', 'pcs', 50, 50, 'Baik', '1 bungkus isi 50 pcs', '2026-04-12 06:31:56.748'),
(5, 'Stiky notes', 'ATK', 'pcs', 5, 5, 'Baik', NULL, '2026-04-12 06:35:00.219'),
(6, 'Flashdisk Lexar 16 gb', 'jaringan', 'pcs', 9, 9, 'Baik', NULL, '2026-04-12 06:39:43.871'),
(7, 'Flashdisk Sandisk 8gb', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:40:18.492'),
(8, 'Mouse Kabel', 'jaringan', 'pcs', 4, 3, 'Baik', NULL, '2026-04-12 06:40:52.240'),
(9, 'Switch Hikvision CCTV ', 'jaringan', 'pcs', 1, 1, 'Baik', '8 Port', '2026-04-12 06:41:36.075'),
(10, 'baterai panasonic', 'ATK', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:44:21.868'),
(11, 'Tang Crimping', 'jaringan', 'pcs', 2, 2, 'Baik', 'Merah & Hijau', '2026-04-12 06:44:47.838'),
(12, 'Switch dlink ', 'jaringan', 'pcs', 1, 1, 'Baik', '8 port', '2026-04-12 06:45:03.948'),
(13, 'Map L kuning', 'ATK', 'pcs', 2, 1, 'Baik', NULL, '2026-04-12 06:45:20.045'),
(14, 'solasi hitam 3m', 'ATK', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:46:45.131'),
(15, 'solasi kertas', 'ATK', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:46:57.937'),
(16, 'pensil', 'ATK', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:47:23.418'),
(17, 'penggaris', 'ATK', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:47:39.157'),
(18, 'kertas A4 hvs', 'ATK', 'rim', 6, 6, 'Baik', NULL, '2026-04-12 06:47:54.826'),
(19, 'stopmap transparan', 'ATK', 'pcs', 12, 12, 'Baik', NULL, '2026-04-12 06:48:31.102'),
(20, 'business file', 'ATK', 'pcs', 40, 40, 'Baik', NULL, '2026-04-12 06:48:59.785'),
(21, 'Ram 4gb hyperZ ddr3', 'jaringan', 'pcs', 3, 3, 'Baik', NULL, '2026-04-12 06:49:19.853'),
(22, 'Lan Teseter', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:49:39.716'),
(23, 'Obeng 1 set', 'jaringan', 'set', 1, 1, 'Baik', NULL, '2026-04-12 06:49:58.615'),
(24, 'Kamera cctv', 'jaringan', 'pcs', 6, 6, 'Baik', NULL, '2026-04-12 06:50:22.015'),
(25, 'Monitor 10 Inch', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:50:37.729'),
(26, 'Mouse Wireless', 'jaringan', 'pcs', 1, 1, 'Rusak', NULL, '2026-04-12 06:50:56.975'),
(27, 'Switch Tplink ', 'jaringan', 'pcs', 2, 2, 'Perlu Service', '8 port', '2026-04-12 06:51:47.024'),
(28, 'thermal pasta', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:53:09.253'),
(29, 'roset telepon', 'jaringan', 'pcs', 10, 10, 'Baik', NULL, '2026-04-12 06:53:27.333'),
(30, 'line kabel telpon 3 meter', 'jaringan', 'pcs', 10, 10, 'Baik', NULL, '2026-04-12 06:53:52.198'),
(31, 'kabel power pc & monitor', 'jaringan', 'pcs', 2, 2, 'Baik', NULL, '2026-04-12 06:54:10.295'),
(32, 'pesawat telepon', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:54:39.708'),
(33, 'Power supplay', 'jaringan', 'pcs', 1, 1, 'Baik', NULL, '2026-04-12 06:55:01.653'),
(34, 'PC Rere hrga ', 'komputer', 'pcs', 1, 1, 'Perlu Service', 'Mainboard rusak', '2026-04-12 17:24:52.028');

-- --------------------------------------------------------

--
-- Table structure for table `AsetPenggunaan`
--

CREATE TABLE `AsetPenggunaan` (
  `id` int(11) NOT NULL,
  `asetId` int(11) NOT NULL,
  `jumlah` int(11) NOT NULL DEFAULT 1,
  `divisi` varchar(191) NOT NULL,
  `lokasi` varchar(191) NOT NULL,
  `keterangan` text DEFAULT NULL,
  `tanggal` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `AsetPenggunaan`
--

INSERT INTO `AsetPenggunaan` (`id`, `asetId`, `jumlah`, `divisi`, `lokasi`, `keterangan`, `tanggal`, `createdAt`) VALUES
(1, 1, 11, 'HRGA', 'Ruangan HRGA', 'Untuk menyambung kabel yang putus karena tikus', '2026-04-09 00:00:00.000', '2026-04-12 06:25:39.556'),
(2, 13, 1, 'IT & IC', 'Indri', 'di ambil indri', '2026-04-10 00:00:00.000', '2026-04-12 06:45:54.643'),
(4, 1, 5, 'Operasional', 'Ruangan operasional', 'untuk menarik kabel dari pc ke switch pc aini', '2026-04-14 00:00:00.000', '2026-04-14 03:19:32.324'),
(5, 8, 1, 'Bahanbaku', 'bahan baku', 'pemasangan mouse baru', '2026-04-16 00:00:00.000', '2026-04-16 04:32:30.288'),
(6, 1, 3, 'HRGA', 'HRGA', 'untuk sambung kabel di ruangan HR yang termakan tikus', '2026-04-16 00:00:00.000', '2026-04-16 04:38:59.103');

-- --------------------------------------------------------

--
-- Table structure for table `AsetPinjam`
--

CREATE TABLE `AsetPinjam` (
  `id` int(11) NOT NULL,
  `asetId` int(11) NOT NULL,
  `jumlah` int(11) NOT NULL DEFAULT 1,
  `peminjam` varchar(191) NOT NULL,
  `divisi` varchar(191) NOT NULL,
  `keperluan` text DEFAULT NULL,
  `tanggalPinjam` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `tanggalKembali` datetime(3) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Dipinjam',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Journal`
--

CREATE TABLE `Journal` (
  `id` int(11) NOT NULL,
  `tipeInput` varchar(10) DEFAULT 'harian',
  `tanggalMulai` datetime(3) DEFAULT NULL,
  `tanggalSelesai` datetime(3) DEFAULT NULL,
  `tanggalManual` datetime(3) NOT NULL,
  `jamMulai` varchar(5) DEFAULT NULL,
  `jamSelesai` varchar(5) DEFAULT NULL,
  `durasiMenit` int(11) DEFAULT NULL,
  `aktivitas` varchar(191) NOT NULL,
  `divisi` varchar(191) NOT NULL,
  `pemesan` varchar(191) NOT NULL,
  `deskripsi` text NOT NULL,
  `status` varchar(191) NOT NULL,
  `fotoUrl` varchar(191) DEFAULT NULL,
  `fotoAwalUrl` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Journal`
--

INSERT INTO `Journal` (`id`, `tipeInput`, `tanggalMulai`, `tanggalSelesai`, `tanggalManual`, `jamMulai`, `jamSelesai`, `durasiMenit`, `aktivitas`, `divisi`, `pemesan`, `deskripsi`, `status`, `fotoUrl`, `fotoAwalUrl`, `createdAt`) VALUES
(11, 'harian', NULL, NULL, '2026-04-03 14:05:00.000', NULL, NULL, NULL, 'Pemindahan ruangan IT/IC ', 'IT & IC', 'IT', 'Harus pindah hari ini juga, karena ada tamu dari China sehingga divisi IT/IC pindah ke lantai 3', 'Solved', NULL, NULL, '2026-04-05 10:06:56.815'),
(12, 'harian', NULL, NULL, '2026-04-04 10:00:00.000', NULL, NULL, NULL, 'Instalasi Komputer Baru & Pemindahan Posisi', 'Exim & Pembelian', 'Mba ita', 'Merakit komputer baru untuk admin exim dan merubah layout posisi komputernya', 'Solved', NULL, NULL, '2026-04-05 10:08:57.458'),
(13, 'harian', NULL, NULL, '2026-04-04 13:09:00.000', NULL, NULL, NULL, 'Pemasangan Komputer Baru', 'HRGA', 'Nikita', 'Pemasangan komputer baru untuk divisi HRGA di siapkan untuk GA yang hari senin tgl 6 sudah berangkat', 'Solved', NULL, NULL, '2026-04-05 10:10:16.551'),
(14, 'harian', NULL, NULL, '2026-04-04 13:09:00.000', NULL, NULL, NULL, 'Pemasangan Komputer Baru', 'HRGA', 'Nikita', 'Pemasangan komputer baru untuk divisi HRGA di siapkan untuk GA yang hari senin tgl 6 sudah berangkat', 'Solved', NULL, NULL, '2026-04-05 10:10:22.266'),
(15, 'harian', NULL, NULL, '2026-04-02 10:11:00.000', NULL, NULL, NULL, 'Perbaikan Telepon', 'Operasional', 'Desy Momo', 'Permasalahan ya kalau ada nomor luar telepon ke nomor auri yang bunyi ada 2 yaitu ruangan direktur dan ruangan lobby harusnya hanya lobby saja yang bunyi', 'Pending', '/uploads/IT-LOG-1775455010975-620559654.jpg', NULL, '2026-04-05 10:13:23.488'),
(16, 'harian', NULL, NULL, '2026-04-02 14:13:00.000', NULL, NULL, NULL, 'Instalasi Meja kepala ', 'Accounting', 'Pak Arif ', 'Menyiapkan jalur internet agar konek di meja kepala accounting, dan menyiapkan kelistrikanya', 'Solved', NULL, NULL, '2026-04-05 10:15:08.552'),
(17, 'harian', NULL, NULL, '2026-03-30 09:20:00.000', NULL, NULL, NULL, 'Setting Pabx Panasonic', 'IT & IC', 'Bagyo', ' setting Pabx yang sudah di beli baru, men setting dan konfigurasi ulang agar semuanya terkoneksi', 'Solved', NULL, NULL, '2026-04-05 10:22:13.446'),
(18, 'harian', NULL, NULL, '2026-03-30 13:22:00.000', NULL, NULL, NULL, 'Krimping', 'IT & IC', 'Bagyo', 'Crimping semua jalur kabel telepon yang baru agar semua terkoneksi dengan kabel yang baru. ', 'Solved', NULL, NULL, '2026-04-05 10:23:51.099'),
(19, 'harian', NULL, NULL, '2026-03-30 14:20:00.000', NULL, NULL, NULL, 'Tarik kabel telepon', 'IT & IC', 'Bagyo', 'Menarik kabel telepon di 5 ruangan yang belum ada jalur dan di tarik keruangan server. Ruangan yang yaitu, ruangan direktur, produksi, bahan baku, lobby dan security', 'Solved', NULL, NULL, '2026-04-05 10:25:38.429'),
(20, 'harian', NULL, NULL, '2026-03-30 08:50:00.000', NULL, NULL, NULL, 'Setup Komputer', 'Produksi', 'Nikita', 'Pemasangan komputer untuk admin produksi, dan  menyiapkan jaringan internetnya juga', 'Solved', NULL, NULL, '2026-04-05 10:36:38.044'),
(21, 'harian', NULL, NULL, '2026-04-01 09:39:00.000', NULL, NULL, NULL, 'Desain Kartu Nama', 'HRGA', 'Nikita', 'Desain  kartu nama direktur dan sales executive baru', 'Pending', NULL, NULL, '2026-04-05 10:40:31.857'),
(22, 'harian', NULL, NULL, '2026-04-06 08:33:00.000', NULL, NULL, NULL, 'Desain Flayer', 'HRGA', 'HRGA', 'Membuat flayer untuk kegiatan jobfair yang akan di adakan pada tgl 9 april 2026', 'Pending', '/uploads/IT-LOG-1775440146849-85205208.jpg', NULL, '2026-04-05 11:06:57.213'),
(24, 'harian', NULL, NULL, '2026-04-06 10:21:00.000', NULL, NULL, NULL, 'Pc', 'HRGA', 'Ari', 'Memindahkan ulang komputer untuk GA di ruangan HRGA', 'Solved', NULL, NULL, '2026-04-06 03:22:16.464'),
(25, 'harian', NULL, NULL, '2026-04-06 11:40:00.000', NULL, NULL, NULL, 'aktivasi', 'Accounting', 'ragil', 'Aktivasi windows di komputer andini ', 'Solved', '/uploads/IT-LOG-1775452807586-765878888.jpg', NULL, '2026-04-06 04:40:56.571'),
(26, 'harian', NULL, NULL, '2026-04-06 13:03:00.000', NULL, NULL, NULL, 'Ganti jalur internet', 'Bahanbaku', 'Bagyo', 'Bahan baku dan ruangan maintenance sekarang jalur internet ke ruang server langsung tidak ikut sambungan ke ruang produksi lagi', 'Solved', '/uploads/IT-LOG-1775455482629-296021534.jpg', NULL, '2026-04-06 05:35:23.247'),
(27, 'harian', NULL, NULL, '2026-04-06 13:09:00.000', NULL, NULL, NULL, 'PC mati', 'Bahanbaku', 'Momo bukan baku', 'Sudah nyala kembali karena colokan kelistrikan mati sudah di perbaiki', 'Solved', '/uploads/IT-LOG-1775455809642-93341546.jpg', NULL, '2026-04-06 06:10:09.652'),
(28, 'harian', NULL, NULL, '2026-04-06 13:18:00.000', NULL, NULL, NULL, 'Installasi laptop', 'IT & IC', 'Indri', 'Setup laptop baru dan update os untuk indri', 'Solved', '/uploads/IT-LOG-1775456330392-396016645.jpg', NULL, '2026-04-06 06:18:50.395'),
(29, 'harian', NULL, NULL, '2026-04-06 16:08:00.000', NULL, NULL, NULL, 'Laptop Bahan baku Mati', 'Bahanbaku', 'Momo bahan baku', 'Laptop bahan baku mati ngak mau nyala stuck di booting, ', 'Pending', NULL, NULL, '2026-04-06 13:24:59.002'),
(37, 'harian', NULL, NULL, '2026-04-07 11:45:00.000', NULL, NULL, NULL, 'Edit website page Karir', 'HRGA', 'HR', 'update website untuk keperluan jobfair tanggal 9 april 2026', 'Solved', '/uploads/IT-LOG-1775537198136-803085365.jpg', NULL, '2026-04-07 04:46:38.172'),
(38, 'harian', NULL, NULL, '2026-04-07 13:07:00.000', NULL, NULL, NULL, 'Printer GA', 'IT & IC', 'Gardila', 'Komputer gk bisa print, sudah di perbaiki, install driver printee dan done', 'Solved', '/uploads/IT-LOG-1775542244085-425621503.jpg', NULL, '2026-04-07 06:10:44.087'),
(39, 'harian', NULL, NULL, '2026-04-08 10:06:00.000', NULL, NULL, NULL, 'Printer', 'HRGA', 'Andi GA', 'pc kalau buat ngeprint lemot. sudah di perbaiki dan install driver ', 'Solved', NULL, NULL, '2026-04-08 03:07:38.722'),
(40, 'harian', NULL, NULL, '2026-04-08 10:27:00.000', NULL, NULL, NULL, 'Internet', 'Bahanbaku', 'Momo', 'pc momo bahan baku tidak ada internet, sudah di perbaiki kabel internet tersenggol sehingga internet tidak konek', 'Solved', NULL, NULL, '2026-04-08 03:28:19.453'),
(41, 'harian', NULL, NULL, '2026-04-08 11:09:00.000', NULL, NULL, NULL, 'Install', 'HRGA', 'Nikita', 'Install ulang windows agar laptop tidak lelet, install ke windows 10', 'Solved', '/uploads/IT-LOG-1775621485358-627943184.jpg', NULL, '2026-04-08 04:11:27.004'),
(42, 'harian', NULL, NULL, '2026-04-08 11:51:00.000', NULL, NULL, NULL, 'Printer', 'HRGA', 'Rere', 'PC Rere ngak bisa print, sudah di perbaiki', 'Solved', '/uploads/IT-LOG-1775623902536-225191165.jpg', NULL, '2026-04-08 04:51:42.598'),
(43, 'harian', NULL, NULL, '2026-04-08 15:12:00.000', NULL, NULL, NULL, 'installasi laptop', 'Bahanbaku', 'Momo', 'installasi laptop pergantian laptop dari infinix yang mati ngehang ganti pakai asus lama tapi sudah di install windows 10 jadi sudah tidak lemot', 'Solved', NULL, NULL, '2026-04-08 15:13:37.800'),
(44, 'harian', NULL, NULL, '2026-04-09 09:34:00.000', NULL, NULL, NULL, 'desain', 'HRGA', 'HRD', 'desain kartu nama direktur', 'Solved', '/uploads/IT-LOG-1775709305213-578018741.jpg', NULL, '2026-04-09 04:35:05.243'),
(45, 'harian', NULL, NULL, '2026-04-09 13:22:00.000', NULL, NULL, NULL, 'laptop ngehang', 'Operasional', 'momo', 'Laptop ngehang update windows sudah di perbaiki', 'Solved', NULL, NULL, '2026-04-09 06:23:35.653'),
(46, 'harian', NULL, NULL, '2026-04-09 15:37:00.000', NULL, NULL, NULL, 'Internet', 'Exim & Pembelian', 'fEBY', 'internet feby ngak konek sudah di perbaiki kabel switch tidak tercolok sehingga internet mati', 'Solved', NULL, NULL, '2026-04-09 08:38:10.548'),
(47, 'harian', NULL, NULL, '2026-04-09 15:40:00.000', NULL, NULL, NULL, 'Desain', 'HRGA', 'Nikita', 'Desain kartu nama Sales Executive baru', 'Solved', '/uploads/IT-LOG-1775724050193-874562253.jpg', NULL, '2026-04-09 08:40:50.202'),
(48, 'harian', NULL, NULL, '2026-04-10 08:42:00.000', NULL, NULL, NULL, 'Laptop bitlocker', 'HRGA', 'Nikita', 'Laptop ketika nyala ada recovery BitLocker, belum diperbaiki tidak punya. ', 'Pending', '/uploads/IT-LOG-1775785329398-872295867.jpg', NULL, '2026-04-10 01:42:09.551'),
(49, 'harian', NULL, NULL, '2026-04-10 09:58:00.000', NULL, NULL, NULL, 'Print', 'Produksi', 'Arif', 'Tidak bisa ngeprint warna karena driver. Sudah update driver', 'Solved', '/uploads/IT-LOG-1775790003227-244354309.jpg', NULL, '2026-04-10 03:00:03.394'),
(50, 'harian', NULL, NULL, '2026-04-11 00:00:00.000', '09:25', '14:00', 275, 'sambung kabel', 'HRGA', 'Bagyo', 'Sambung kabel di switch di ruang HRD yang putus termakan tikus', 'Solved', '/uploads/IT-LOG-1775891062952-528371116.jpg', '/uploads/IT-AWAL-1775891062523-564247617.jpg', '2026-04-11 02:39:40.650'),
(51, 'harian', NULL, NULL, '2026-04-11 00:00:00.000', '10:41', '10:48', 7, 'Menyiapkan internet', 'IT & IC', 'Bagyo', 'Menyiapkan internet di ruangan kepala marketing sudah di sediakan lan adapter USB sudah siap pakai', 'Solved', '/uploads/IT-LOG-1775882112238-591276227.jpg', NULL, '2026-04-11 04:35:12.494'),
(54, 'harian', NULL, NULL, '2026-04-11 00:00:00.000', '14:08', '15:08', 60, 'Telefon', 'HRGA', 'Security', 'Telepon security kalau di telepon tidak ada sering tapi kalau buat telepon bisa, sudah di perbaiki sekarang sudah normal kembali, sambungan telepon yang mengarah ke ruangan server putus sudah di sambung dan configurasi lagi', 'Solved', '/uploads/IT-LOG-1775894973686-902765323.jpg', NULL, '2026-04-11 08:09:33.709'),
(55, 'harian', NULL, NULL, '2026-04-11 00:00:00.000', '03:20', '03:42', 22, 'redesain', 'HRGA', 'Ari', 'mendisain ulang flyer jobfair untuk di upload ke disnaker', 'Solved', '/uploads/IT-LOG-1775897033585-41888519.jpg', '/uploads/IT-AWAL-1775897033580-327349288.jpg', '2026-04-11 08:43:53.594'),
(62, 'harian', NULL, NULL, '2026-04-13 09:32:00.000', '09:32', '09:35', 3, 'Printer', 'HRGA', 'Nikita', 'Laptop belum. Bisa Print sudah di perbaiki drivernya', 'Solved', '/uploads/IT-LOG-1776047731829-197887175.jpg', '/uploads/IT-AWAL-1776047731801-737708616.jpg', '2026-04-13 02:35:31.862'),
(63, 'harian', NULL, NULL, '2026-04-13 10:16:00.000', '10:16', '10:30', 14, 'kartu nama', 'HRGA', 'nikita', 'pengajuan kartu nama untuk sales galih,sumardi sjarif dan kartu nama pak pallas', 'Solved', '/uploads/IT-LOG-1776050242747-360835940.jpg', NULL, '2026-04-13 03:17:22.753'),
(64, 'harian', NULL, NULL, '2026-04-13 10:55:00.000', '10:55', '11:06', 11, 'Printer', 'Produksi', 'Shofa', 'Sudah di perbaiki update driver. Tadinya tidak bisa warna', 'Solved', '/uploads/IT-LOG-1776053196915-741203249.jpg', '/uploads/IT-AWAL-1776053196913-918543170.jpg', '2026-04-13 04:06:36.922'),
(65, 'harian', NULL, NULL, '2026-04-13 15:46:00.000', '15:46', '15:56', 10, 'Internet', 'Exim & Pembelian', 'Fani', 'Internet tidak bisa konek karena LAN error networknya hilang', 'Solved', '/uploads/IT-LOG-1776070057528-503335405.jpg', '/uploads/IT-AWAL-1776070057522-173032895.jpg', '2026-04-13 08:47:37.550'),
(66, 'harian', NULL, NULL, '2026-04-14 09:50:00.000', '09:50', '10:11', 21, 'Pemindahan', 'Operasional', 'Asep', 'Pemindahan komputer aeni dan dea di ruang operasional', 'Solved', '/uploads/IT-LOG-1776136299725-998304099.jpg', NULL, '2026-04-14 03:11:39.792'),
(67, 'harian', NULL, NULL, '2026-04-16 08:25:00.000', '08:25', '09:07', 42, 'Rakit komputer', 'Admin Sales', 'Jojo', 'Takut komputer di meja jojo', 'Solved', '/uploads/IT-LOG-1776305296032-152921050.jpg', '/uploads/IT-AWAL-1776305295993-246814413.jpg', '2026-04-16 02:08:16.066'),
(68, 'harian', NULL, NULL, '2026-04-16 09:16:00.000', '09:16', NULL, NULL, 'Cctv', 'IT & IC', 'Baguo', 'Pemindahan CCTV yang terhalang Mabel di ruangan pantry', 'Solved', NULL, '/uploads/IT-AWAL-1776305803007-417017286.jpg', '2026-04-16 02:16:43.009');

-- --------------------------------------------------------

--
-- Table structure for table `Note`
--

CREATE TABLE `Note` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `Note`
--

INSERT INTO `Note` (`id`, `title`, `content`, `createdAt`, `updatedAt`) VALUES
(6, 'POWER POINT !', 'Buat Powerpoint untuk company profile !!', '2026-04-11 14:42:54.463', '2026-04-11 14:42:54.463'),
(8, 'PENGAJUAN SERVER', '- Unit Server\n- Caddy tempat hardisk\n- PSU Tambahan\n-Hardisk minimal 8tb', '2026-04-15 15:24:13.547', '2026-04-15 15:24:13.547');

-- --------------------------------------------------------

--
-- Table structure for table `User`
--

CREATE TABLE `User` (
  `id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nama` varchar(191) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'user',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `User`
--

INSERT INTO `User` (`id`, `username`, `password`, `nama`, `role`, `createdAt`) VALUES
(1, 'admin', '$2b$10$Ib66DfE5F2WmMJxAbz29Feo7yz1di8jXo4HgFfCkPZplc2JgSZipK', 'Administrator IT', 'admin', '2026-04-12 16:31:13.504');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Aset`
--
ALTER TABLE `Aset`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `AsetPenggunaan`
--
ALTER TABLE `AsetPenggunaan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `asetId` (`asetId`);

--
-- Indexes for table `AsetPinjam`
--
ALTER TABLE `AsetPinjam`
  ADD PRIMARY KEY (`id`),
  ADD KEY `asetId` (`asetId`);

--
-- Indexes for table `Journal`
--
ALTER TABLE `Journal`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `Note`
--
ALTER TABLE `Note`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `User`
--
ALTER TABLE `User`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `Aset`
--
ALTER TABLE `Aset`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `AsetPenggunaan`
--
ALTER TABLE `AsetPenggunaan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `AsetPinjam`
--
ALTER TABLE `AsetPinjam`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Journal`
--
ALTER TABLE `Journal`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `Note`
--
ALTER TABLE `Note`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `User`
--
ALTER TABLE `User`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `AsetPenggunaan`
--
ALTER TABLE `AsetPenggunaan`
  ADD CONSTRAINT `AsetPenggunaan_ibfk_1` FOREIGN KEY (`asetId`) REFERENCES `Aset` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `AsetPinjam`
--
ALTER TABLE `AsetPinjam`
  ADD CONSTRAINT `AsetPinjam_ibfk_1` FOREIGN KEY (`asetId`) REFERENCES `Aset` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
