-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 172.17.0.1
-- Generation Time: Apr 11, 2026 at 08:54 AM
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
-- Table structure for table `Journal`
--

CREATE TABLE `Journal` (
  `id` int(11) NOT NULL,
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

INSERT INTO `Journal` (`id`, `tanggalManual`, `jamMulai`, `jamSelesai`, `durasiMenit`, `aktivitas`, `divisi`, `pemesan`, `deskripsi`, `status`, `fotoUrl`, `fotoAwalUrl`, `createdAt`) VALUES
(11, '2026-04-03 14:05:00.000', NULL, NULL, NULL, 'Pemindahan ruangan IT/IC ', 'IT & IC', 'IT', 'Harus pindah hari ini juga, karena ada tamu dari China sehingga divisi IT/IC pindah ke lantai 3', 'Solved', NULL, NULL, '2026-04-05 10:06:56.815'),
(12, '2026-04-04 10:00:00.000', NULL, NULL, NULL, 'Instalasi Komputer Baru & Pemindahan Posisi', 'Exim & Pembelian', 'Mba ita', 'Merakit komputer baru untuk admin exim dan merubah layout posisi komputernya', 'Solved', NULL, NULL, '2026-04-05 10:08:57.458'),
(13, '2026-04-04 13:09:00.000', NULL, NULL, NULL, 'Pemasangan Komputer Baru', 'HRGA', 'Nikita', 'Pemasangan komputer baru untuk divisi HRGA di siapkan untuk GA yang hari senin tgl 6 sudah berangkat', 'Solved', NULL, NULL, '2026-04-05 10:10:16.551'),
(14, '2026-04-04 13:09:00.000', NULL, NULL, NULL, 'Pemasangan Komputer Baru', 'HRGA', 'Nikita', 'Pemasangan komputer baru untuk divisi HRGA di siapkan untuk GA yang hari senin tgl 6 sudah berangkat', 'Solved', NULL, NULL, '2026-04-05 10:10:22.266'),
(15, '2026-04-02 10:11:00.000', NULL, NULL, NULL, 'Perbaikan Telepon', 'Operasional', 'Desy Momo', 'Permasalahan ya kalau ada nomor luar telepon ke nomor auri yang bunyi ada 2 yaitu ruangan direktur dan ruangan lobby harusnya hanya lobby saja yang bunyi', 'Pending', '/uploads/IT-LOG-1775455010975-620559654.jpg', NULL, '2026-04-05 10:13:23.488'),
(16, '2026-04-02 14:13:00.000', NULL, NULL, NULL, 'Instalasi Meja kepala ', 'Accounting', 'Pak Arif ', 'Menyiapkan jalur internet agar konek di meja kepala accounting, dan menyiapkan kelistrikanya', 'Solved', NULL, NULL, '2026-04-05 10:15:08.552'),
(17, '2026-03-30 09:20:00.000', NULL, NULL, NULL, 'Setting Pabx Panasonic', 'IT & IC', 'Bagyo', ' setting Pabx yang sudah di beli baru, men setting dan konfigurasi ulang agar semuanya terkoneksi', 'Solved', NULL, NULL, '2026-04-05 10:22:13.446'),
(18, '2026-03-30 13:22:00.000', NULL, NULL, NULL, 'Krimping', 'IT & IC', 'Bagyo', 'Crimping semua jalur kabel telepon yang baru agar semua terkoneksi dengan kabel yang baru. ', 'Solved', NULL, NULL, '2026-04-05 10:23:51.099'),
(19, '2026-03-30 14:20:00.000', NULL, NULL, NULL, 'Tarik kabel telepon', 'IT & IC', 'Bagyo', 'Menarik kabel telepon di 5 ruangan yang belum ada jalur dan di tarik keruangan server. Ruangan yang yaitu, ruangan direktur, produksi, bahan baku, lobby dan security', 'Solved', NULL, NULL, '2026-04-05 10:25:38.429'),
(20, '2026-03-30 08:50:00.000', NULL, NULL, NULL, 'Setup Komputer', 'Produksi', 'Nikita', 'Pemasangan komputer untuk admin produksi, dan  menyiapkan jaringan internetnya juga', 'Solved', NULL, NULL, '2026-04-05 10:36:38.044'),
(21, '2026-04-01 09:39:00.000', NULL, NULL, NULL, 'Desain Kartu Nama', 'HRGA', 'Nikita', 'Desain  kartu nama direktur dan sales executive baru', 'Pending', NULL, NULL, '2026-04-05 10:40:31.857'),
(22, '2026-04-06 08:33:00.000', NULL, NULL, NULL, 'Desain Flayer', 'HRGA', 'HRGA', 'Membuat flayer untuk kegiatan jobfair yang akan di adakan pada tgl 9 april 2026', 'Pending', '/uploads/IT-LOG-1775440146849-85205208.jpg', NULL, '2026-04-05 11:06:57.213'),
(24, '2026-04-06 10:21:00.000', NULL, NULL, NULL, 'Pc', 'HRGA', 'Ari', 'Memindahkan ulang komputer untuk GA di ruangan HRGA', 'Solved', NULL, NULL, '2026-04-06 03:22:16.464'),
(25, '2026-04-06 11:40:00.000', NULL, NULL, NULL, 'aktivasi', 'Accounting', 'ragil', 'Aktivasi windows di komputer andini ', 'Solved', '/uploads/IT-LOG-1775452807586-765878888.jpg', NULL, '2026-04-06 04:40:56.571'),
(26, '2026-04-06 13:03:00.000', NULL, NULL, NULL, 'Ganti jalur internet', 'Bahanbaku', 'Bagyo', 'Bahan baku dan ruangan maintenance sekarang jalur internet ke ruang server langsung tidak ikut sambungan ke ruang produksi lagi', 'Solved', '/uploads/IT-LOG-1775455482629-296021534.jpg', NULL, '2026-04-06 05:35:23.247'),
(27, '2026-04-06 13:09:00.000', NULL, NULL, NULL, 'PC mati', 'Bahanbaku', 'Momo bukan baku', 'Sudah nyala kembali karena colokan kelistrikan mati sudah di perbaiki', 'Solved', '/uploads/IT-LOG-1775455809642-93341546.jpg', NULL, '2026-04-06 06:10:09.652'),
(28, '2026-04-06 13:18:00.000', NULL, NULL, NULL, 'Installasi laptop', 'IT & IC', 'Indri', 'Setup laptop baru dan update os untuk indri', 'Solved', '/uploads/IT-LOG-1775456330392-396016645.jpg', NULL, '2026-04-06 06:18:50.395'),
(29, '2026-04-06 16:08:00.000', NULL, NULL, NULL, 'Laptop Bahan baku Mati', 'Bahanbaku', 'Momo bahan baku', 'Laptop bahan baku mati ngak mau nyala stuck di booting, ', 'Pending', NULL, NULL, '2026-04-06 13:24:59.002'),
(37, '2026-04-07 11:45:00.000', NULL, NULL, NULL, 'Edit website page Karir', 'HRGA', 'HR', 'update website untuk keperluan jobfair tanggal 9 april 2026', 'Solved', '/uploads/IT-LOG-1775537198136-803085365.jpg', NULL, '2026-04-07 04:46:38.172'),
(38, '2026-04-07 13:07:00.000', NULL, NULL, NULL, 'Printer GA', 'IT & IC', 'Gardila', 'Komputer gk bisa print, sudah di perbaiki, install driver printee dan done', 'Solved', '/uploads/IT-LOG-1775542244085-425621503.jpg', NULL, '2026-04-07 06:10:44.087'),
(39, '2026-04-08 10:06:00.000', NULL, NULL, NULL, 'Printer', 'HRGA', 'Andi GA', 'pc kalau buat ngeprint lemot. sudah di perbaiki dan install driver ', 'Solved', NULL, NULL, '2026-04-08 03:07:38.722'),
(40, '2026-04-08 10:27:00.000', NULL, NULL, NULL, 'Internet', 'Bahanbaku', 'Momo', 'pc momo bahan baku tidak ada internet, sudah di perbaiki kabel internet tersenggol sehingga internet tidak konek', 'Solved', NULL, NULL, '2026-04-08 03:28:19.453'),
(41, '2026-04-08 11:09:00.000', NULL, NULL, NULL, 'Install', 'HRGA', 'Nikita', 'Install ulang windows agar laptop tidak lelet, install ke windows 10', 'Solved', '/uploads/IT-LOG-1775621485358-627943184.jpg', NULL, '2026-04-08 04:11:27.004'),
(42, '2026-04-08 11:51:00.000', NULL, NULL, NULL, 'Printer', 'HRGA', 'Rere', 'PC Rere ngak bisa print, sudah di perbaiki', 'Solved', '/uploads/IT-LOG-1775623902536-225191165.jpg', NULL, '2026-04-08 04:51:42.598'),
(43, '2026-04-08 15:12:00.000', NULL, NULL, NULL, 'installasi laptop', 'Bahanbaku', 'Momo', 'installasi laptop pergantian laptop dari infinix yang mati ngehang ganti pakai asus lama tapi sudah di install windows 10 jadi sudah tidak lemot', 'Solved', NULL, NULL, '2026-04-08 15:13:37.800'),
(44, '2026-04-09 09:34:00.000', NULL, NULL, NULL, 'desain', 'HRGA', 'HRD', 'desain kartu nama direktur', 'Solved', '/uploads/IT-LOG-1775709305213-578018741.jpg', NULL, '2026-04-09 04:35:05.243'),
(45, '2026-04-09 13:22:00.000', NULL, NULL, NULL, 'laptop ngehang', 'Operasional', 'momo', 'Laptop ngehang update windows sudah di perbaiki', 'Solved', NULL, NULL, '2026-04-09 06:23:35.653'),
(46, '2026-04-09 15:37:00.000', NULL, NULL, NULL, 'Internet', 'Exim & Pembelian', 'fEBY', 'internet feby ngak konek sudah di perbaiki kabel switch tidak tercolok sehingga internet mati', 'Solved', NULL, NULL, '2026-04-09 08:38:10.548'),
(47, '2026-04-09 15:40:00.000', NULL, NULL, NULL, 'Desain', 'HRGA', 'Nikita', 'Desain kartu nama Sales Executive baru', 'Solved', '/uploads/IT-LOG-1775724050193-874562253.jpg', NULL, '2026-04-09 08:40:50.202'),
(48, '2026-04-10 08:42:00.000', NULL, NULL, NULL, 'Laptop bitlocker', 'HRGA', 'Nikita', 'Laptop ketika nyala ada recovery BitLocker, belum diperbaiki tidak punya. ', 'Pending', '/uploads/IT-LOG-1775785329398-872295867.jpg', NULL, '2026-04-10 01:42:09.551'),
(49, '2026-04-10 09:58:00.000', NULL, NULL, NULL, 'Print', 'Produksi', 'Arif', 'Tidak bisa ngeprint warna karena driver. Sudah update driver', 'Solved', '/uploads/IT-LOG-1775790003227-244354309.jpg', NULL, '2026-04-10 03:00:03.394'),
(50, '2026-04-11 00:00:00.000', '09:25', '14:00', 275, 'sambung kabel', 'HRGA', 'Bagyo', 'Sambung kabel di switch di ruang HRD yang putus termakan tikus', 'Solved', '/uploads/IT-LOG-1775891062952-528371116.jpg', '/uploads/IT-AWAL-1775891062523-564247617.jpg', '2026-04-11 02:39:40.650'),
(51, '2026-04-11 00:00:00.000', '10:41', '10:48', 7, 'Menyiapkan internet', 'IT & IC', 'Bagyo', 'Menyiapkan internet di ruangan kepala marketing sudah di sediakan lan adapter USB sudah siap pakai', 'Solved', '/uploads/IT-LOG-1775882112238-591276227.jpg', NULL, '2026-04-11 04:35:12.494'),
(54, '2026-04-11 00:00:00.000', '14:08', '15:08', 60, 'Telefon', 'HRGA', 'Security', 'Telepon security kalau di telepon tidak ada sering tapi kalau buat telepon bisa, sudah di perbaiki sekarang sudah normal kembali, sambungan telepon yang mengarah ke ruangan server putus sudah di sambung dan configurasi lagi', 'Solved', '/uploads/IT-LOG-1775894973686-902765323.jpg', NULL, '2026-04-11 08:09:33.709'),
(55, '2026-04-11 00:00:00.000', '03:20', '03:42', 22, 'redesain', 'HRGA', 'Ari', 'mendisain ulang flyer jobfair untuk di upload ke disnaker', 'Solved', '/uploads/IT-LOG-1775897033585-41888519.jpg', '/uploads/IT-AWAL-1775897033580-327349288.jpg', '2026-04-11 08:43:53.594');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Journal`
--
ALTER TABLE `Journal`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `Journal`
--
ALTER TABLE `Journal`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
