-- AlterTable: tambah kolom jenisJurnal untuk memisahkan jurnal IT dan Maintenance
ALTER TABLE `Journal` ADD COLUMN `jenisJurnal` VARCHAR(191) NOT NULL DEFAULT 'IT';
