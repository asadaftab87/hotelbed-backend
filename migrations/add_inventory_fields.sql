-- Add missing fields to Inventory table

-- First check if table exists, if not create it
CREATE TABLE IF NOT EXISTS `Inventory` (
  `id` VARCHAR(191) NOT NULL,
  `hotelBedId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `contractId` VARCHAR(191) NULL,
  `hotelCode` VARCHAR(191) NULL,
  `roomCode` VARCHAR(191) NULL,
  `characteristic` VARCHAR(191) NULL,
  `rateCode` VARCHAR(191) NULL,
  `boardCode` VARCHAR(191) NULL,
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `calendarDate` DATETIME(3) NULL,
  `allotment` INT NULL,
  `stopSale` BOOLEAN NULL,
  `releaseDays` INT NULL,
  `cta` INT NULL,
  `ctd` INT NULL,
  `minNights` INT NULL,
  `maxNights` INT NULL,
  `netPrice` DOUBLE NULL,
  `publicPrice` DOUBLE NULL,
  `marketPrice` DOUBLE NULL,
  PRIMARY KEY (`id`),
  INDEX `Inventory_contractId_idx`(`contractId`),
  INDEX `Inventory_hotelCode_idx`(`hotelCode`),
  INDEX `Inventory_roomCode_characteristic_idx`(`roomCode`, `characteristic`),
  INDEX `Inventory_calendarDate_hotelCode_idx`(`calendarDate`, `hotelCode`),
  INDEX `Inventory_hotelCode_roomCode_calendarDate_idx`(`hotelCode`, `roomCode`, `calendarDate`),
  INDEX `Inventory_startDate_endDate_idx`(`startDate`, `endDate`),
  INDEX `Inventory_rateCode_idx`(`rateCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key if not exists
ALTER TABLE `Inventory` 
ADD CONSTRAINT `Inventory_hotelBedId_fkey` 
FOREIGN KEY (`hotelBedId`) REFERENCES `HotelBedFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- If table already exists, add missing columns (will fail silently if column exists)
ALTER TABLE `Inventory` ADD COLUMN `contractId` VARCHAR(191) NULL;
ALTER TABLE `Inventory` ADD COLUMN `boardCode` VARCHAR(191) NULL;
ALTER TABLE `Inventory` ADD COLUMN `startDate` DATETIME(3) NULL;
ALTER TABLE `Inventory` ADD COLUMN `endDate` DATETIME(3) NULL;
ALTER TABLE `Inventory` ADD COLUMN `cta` INT NULL;
ALTER TABLE `Inventory` ADD COLUMN `ctd` INT NULL;
ALTER TABLE `Inventory` ADD COLUMN `netPrice` DOUBLE NULL;
ALTER TABLE `Inventory` ADD COLUMN `publicPrice` DOUBLE NULL;
ALTER TABLE `Inventory` ADD COLUMN `marketPrice` DOUBLE NULL;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS `Inventory_contractId_idx` ON `Inventory`(`contractId`);
CREATE INDEX IF NOT EXISTS `Inventory_rateCode_idx` ON `Inventory`(`rateCode`);

