-- Fix inventoryTuples column to support full 365-day tuple strings
-- Current: VARCHAR(191) - TOO SMALL, truncates data!
-- New: TEXT - Can hold 65,535 characters

ALTER TABLE `Restriction` 
MODIFY COLUMN `inventoryTuples` TEXT NULL;

-- Verify change
DESCRIBE `Restriction`;

