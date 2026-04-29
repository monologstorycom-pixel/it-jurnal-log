-- AlterTable: tambah kolom divisi ke tabel Aset
ALTER TABLE `Aset` ADD COLUMN `divisi` VARCHAR(191) NOT NULL DEFAULT 'IT';

-- AlterTable: tambah kolom divisi ke tabel User
ALTER TABLE `User` ADD COLUMN `divisi` VARCHAR(191) NOT NULL DEFAULT 'IT';
