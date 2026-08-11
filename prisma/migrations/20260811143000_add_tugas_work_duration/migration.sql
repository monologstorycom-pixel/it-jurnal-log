ALTER TABLE `Tugas`
  ADD COLUMN `mulaiDikerjakanAt` DATETIME(3) NULL,
  ADD COLUMN `selesaiDikerjakanAt` DATETIME(3) NULL,
  ADD COLUMN `dikerjakanOleh` VARCHAR(191) NULL;
