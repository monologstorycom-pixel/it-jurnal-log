-- AddColumn mulaiDikerjakanAt, selesaiDikerjakanAt, dikerjakanOleh to Tugas
ALTER TABLE `Tugas` ADD COLUMN `mulaiDikerjakanAt` DATETIME(3) NULL;
ALTER TABLE `Tugas` ADD COLUMN `selesaiDikerjakanAt` DATETIME(3) NULL;
ALTER TABLE `Tugas` ADD COLUMN `dikerjakanOleh` VARCHAR(191) NULL;
