-- CreateTable: Tugas untuk maintenance
CREATE TABLE `Tugas` (
    `id`        INT NOT NULL AUTO_INCREMENT,
    `judul`     VARCHAR(191) NOT NULL,
    `deskripsi` TEXT NULL,
    `buatOleh`  VARCHAR(191) NOT NULL,
    `tanggal`   DATETIME(3) NOT NULL,
    `prioritas` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `status`    VARCHAR(191) NOT NULL DEFAULT 'Belum',
    `catatan`   TEXT NULL,
    `fotoUrl`   VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
