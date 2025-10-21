-- HotelBeds Data Schema
-- Auto-generated on 2025-10-21

-- ============================================
-- HOTELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `hotels` (
  `id` BIGINT PRIMARY KEY,
  `category` VARCHAR(10),
  `destination_code` VARCHAR(10),
  `chain_code` VARCHAR(50),
  `accommodation_type` VARCHAR(10),
  `ranking` INT,
  `group_hotel` VARCHAR(5),
  `country_code` VARCHAR(5),
  `state_code` VARCHAR(10),
  `longitude` DECIMAL(11, 8),
  `latitude` DECIMAL(11, 8),
  `name` VARCHAR(500),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_destination` (`destination_code`),
  INDEX `idx_country` (`country_code`),
  INDEX `idx_chain` (`chain_code`),
  INDEX `idx_name` (`name`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE,
  `type` VARCHAR(50),
  `simple_code` VARCHAR(10),
  `description` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DESTINATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `destinations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(10) UNIQUE,
  `name` VARCHAR(255),
  `country_code` VARCHAR(5),
  `zone_code` VARCHAR(10),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`),
  INDEX `idx_country` (`country_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `chains` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE,
  `name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- IMPORT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `import_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `file_name` VARCHAR(255),
  `file_type` VARCHAR(50),
  `total_records` INT DEFAULT 0,
  `imported_records` INT DEFAULT 0,
  `failed_records` INT DEFAULT 0,
  `status` ENUM('started', 'completed', 'failed') DEFAULT 'started',
  `duration` VARCHAR(20),
  `error_message` TEXT,
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  INDEX `idx_file` (`file_name`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

