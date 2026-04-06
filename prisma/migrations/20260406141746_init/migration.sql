-- CreateTable
CREATE TABLE `Journal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggalManual` DATETIME(3) NOT NULL,
    `aktivitas` VARCHAR(191) NOT NULL,
    `divisi` VARCHAR(191) NOT NULL,
    `pemesan` VARCHAR(191) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `fotoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
