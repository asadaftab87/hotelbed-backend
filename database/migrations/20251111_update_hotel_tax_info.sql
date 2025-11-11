-- Migration script to update hotel_tax_info table.
-- This script is designed to be idempotent and compatible with older MySQL versions.

DELIMITER $$

CREATE PROCEDURE MigrateHotelTaxInfo()
BEGIN
    -- Rename existing columns if they exist
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'is_included') THEN
        ALTER TABLE `hotel_tax_info` CHANGE COLUMN `is_included` `included_flag` CHAR(1) NULL;
    END IF;

    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'tax_amount') THEN
        ALTER TABLE `hotel_tax_info` CHANGE COLUMN `tax_amount` `amount` DECIMAL(10, 2) NULL;
    END IF;

    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'tax_rate') THEN
        ALTER TABLE `hotel_tax_info` CHANGE COLUMN `tax_rate` `percentage` DECIMAL(10, 4) NULL;
    END IF;

    -- Drop deprecated columns if they exist
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'tax_type') THEN
        ALTER TABLE `hotel_tax_info` DROP COLUMN `tax_type`;
    END IF;

    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'tax_data') THEN
        ALTER TABLE `hotel_tax_info` DROP COLUMN `tax_data`;
    END IF;

    -- Modify existing columns if they exist
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'tax_code') THEN
        ALTER TABLE `hotel_tax_info` MODIFY COLUMN `tax_code` VARCHAR(50) NULL;
    END IF;
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'date_from') THEN
        ALTER TABLE `hotel_tax_info` MODIFY COLUMN `date_from` DATE NULL;
    END IF;
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'date_to') THEN
        ALTER TABLE `hotel_tax_info` MODIFY COLUMN `date_to` DATE NULL;
    END IF;

    -- Add new columns if they do not exist
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'room_code') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `room_code` VARCHAR(50) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'board_code') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `board_code` VARCHAR(10) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'max_nights') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `max_nights` INT NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'min_age') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `min_age` INT NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'max_age') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `max_age` INT NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'per_night') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `per_night` CHAR(1) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'per_pax') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `per_pax` CHAR(1) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'currency') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `currency` VARCHAR(5) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'apply_over') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `apply_over` CHAR(1) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'market_code') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `market_code` VARCHAR(10) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'legal_text') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `legal_text` VARCHAR(255) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'amount') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `amount` DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND COLUMN_NAME = 'percentage') THEN
        ALTER TABLE `hotel_tax_info` ADD COLUMN `percentage` DECIMAL(10, 4) NULL;
    END IF;

    -- Add indexes if they do not exist
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND INDEX_NAME = 'idx_hotel_tax_info_tax') THEN
        ALTER TABLE `hotel_tax_info` ADD INDEX `idx_hotel_tax_info_tax` (`tax_code`);
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND INDEX_NAME = 'idx_hotel_tax_info_room_board') THEN
        ALTER TABLE `hotel_tax_info` ADD INDEX `idx_hotel_tax_info_room_board` (`room_code`, `board_code`);
    END IF;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_tax_info' AND INDEX_NAME = 'idx_hotel_tax_info_dates') THEN
        ALTER TABLE `hotel_tax_info` ADD INDEX `idx_hotel_tax_info_dates` (`date_from`, `date_to`);
    END IF;

END$$

DELIMITER ;

-- Execute the migration procedure
CALL MigrateHotelTaxInfo();

-- Drop the procedure
DROP PROCEDURE IF EXISTS MigrateHotelTaxInfo;

