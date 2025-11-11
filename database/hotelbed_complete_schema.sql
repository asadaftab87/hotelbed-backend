-- HotelBeds Complete Data Schema
-- All tables for complete cache import

-- ============================================
-- HOTELS TABLE (Basic Info - GHOT_F)
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
  INDEX `idx_name` (`name`(255)),
  INDEX `idx_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATEGORIES TABLE (GCAT_F)
-- ============================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE,
  `type` VARCHAR(50),
  `simple_code` VARCHAR(10),
  `description` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAINS TABLE (GTTO_F)
-- ============================================
CREATE TABLE IF NOT EXISTS `chains` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE,
  `name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DESTINATIONS TABLE (IDES_F) - UPDATED WITH NAME
-- ============================================
CREATE TABLE IF NOT EXISTS `destinations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(10) UNIQUE,
  `country_code` VARCHAR(5),
  `is_available` CHAR(1),
  `name` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`),
  INDEX `idx_country` (`country_code`),
  INDEX `idx_available` (`is_available`),
  INDEX `idx_name` (`name`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL CONTRACTS (CCON - Contract Config)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_contracts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `destination_code` VARCHAR(10),
  `contract_code` VARCHAR(50),
  `rate_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `contract_type` VARCHAR(10),
  `date_from` DATE,
  `date_to` DATE,
  `currency` VARCHAR(5),
  `board_type` VARCHAR(10),
  `payment_type` VARCHAR(10),
  `market` VARCHAR(5),
  `is_active` CHAR(1),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_destination` (`destination_code`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_contract` (`contract_code`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL ROOM ALLOCATIONS (CNHA)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_room_allocations` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `room_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `min_adults` INT,
  `max_adults` INT,
  `min_children` INT,
  `max_children` INT,
  `min_pax` INT,
  `max_pax` INT,
  `allocation` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_room` (`room_code`),
  INDEX `idx_pax` (`min_adults`, `max_adults`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL INVENTORY (CNIN - Daily Availability)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_inventory` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `room_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `date_from` DATE,
  `date_to` DATE,
  `availability_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_room` (`room_code`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL RATES (CNCT - Pricing Data)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_rates` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `room_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `date_from` DATE,
  `date_to` DATE,
  `rate_type` VARCHAR(10),
  `base_price` DECIMAL(10, 3),
  `tax_amount` DECIMAL(10, 3),
  `commission` DECIMAL(10, 3),
  `adults` INT,
  `board_type` VARCHAR(10),
  `price` DECIMAL(10, 3),
  `currency` VARCHAR(5),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_room` (`room_code`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_price` (`price`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL SUPPLEMENTS (CNSU - Offers/Discounts)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_supplements` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `date_from` DATE,
  `date_to` DATE,
  `supplement_code` VARCHAR(50),
  `supplement_type` VARCHAR(10),
  `discount_percent` DECIMAL(5, 2),
  `min_nights` INT,
  `applies_to` VARCHAR(20),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_code` (`supplement_code`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL OCCUPANCY RULES (CNOE)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_occupancy_rules` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `rule_from` VARCHAR(50),
  `rule_to` VARCHAR(50),
  `is_allowed` CHAR(1),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL EMAIL SETTINGS (CNEM)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_email_settings` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `date_from` DATE,
  `date_to` DATE,
  `notification_type` VARCHAR(10),
  `room_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `min_pax` INT,
  `max_pax` INT,
  `settings_flags` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL RATE TAGS (CNTA)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_rate_tags` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `tag_id` INT,
  `tag_name` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_tag` (`tag_name`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL SPECIAL REQUESTS (CNSR)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_special_requests` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `request_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL PROMOTIONS (CNPV)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_promotions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `promotion_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL GROUPS (CNGR)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_groups` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `group_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- IMPORT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS `import_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `file_name` VARCHAR(255),
  `file_type` VARCHAR(50),
  `total_records` INT DEFAULT 0,
  `imported_records` INT DEFAULT 0,
  `failed_records` INT DEFAULT 0,
  `status` ENUM('started', 'in_progress', 'completed', 'failed') DEFAULT 'started',
  `duration` VARCHAR(20),
  `error_message` TEXT,
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  INDEX `idx_file` (`file_name`(100)),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`file_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PROCESSING QUEUE (for tracking 150k+ files)
-- ============================================
CREATE TABLE IF NOT EXISTS `processing_queue` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `file_path` VARCHAR(500),
  `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  `attempts` INT DEFAULT 0,
  `error_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `processed_at` TIMESTAMP NULL,
  INDEX `idx_status` (`status`),
  INDEX `idx_hotel` (`hotel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- API METADATA TABLE (AIF2_F)
-- ============================================
CREATE TABLE IF NOT EXISTS `api_metadata` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `api_version` VARCHAR(10),
  `total_hotels` INT,
  `environment` VARCHAR(10),
  `region` VARCHAR(10),
  `country` VARCHAR(5),
  `api_type` VARCHAR(10),
  `is_active` CHAR(1),
  `timestamp` BIGINT,
  `next_api_version` VARCHAR(10),
  `features` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_version` (`api_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL CONFIGURATIONS (CNCF)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_configurations` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `date_from` DATE,
  `date_to` DATE,
  `criteria_id` INT,
  `flag1` INT,
  `value1` DECIMAL(10, 3),
  `value2` DECIMAL(10, 3),
  `value3` DECIMAL(10, 3),
  `value4` DECIMAL(10, 3),
  `language` VARCHAR(5),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_criteria` (`criteria_id`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL CANCELLATION POLICIES (CNCL)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_cancellation_policies` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `policy_code` VARCHAR(50),
  `date_from` DATE,
  `date_to` DATE,
  `penalty_type` VARCHAR(20),
  `penalty_amount` DECIMAL(10, 2),
  `cancellation_hours` INT,
  `policy_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_policy` (`policy_code`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL SPECIAL CONDITIONS (CNES)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_special_conditions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `condition_type` VARCHAR(50),
  `condition_code` VARCHAR(50),
  `condition_text` TEXT,
  `date_from` DATE,
  `date_to` DATE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_type` (`condition_type`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL ROOM FEATURES (CNHF)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_room_features` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `room_code` VARCHAR(50),
  `feature_code` VARCHAR(50),
  `feature_type` VARCHAR(50),
  `feature_value` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_room` (`room_code`),
  INDEX `idx_feature` (`feature_code`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HOTEL PRICING RULES (CNPR)
-- ============================================
CREATE TABLE IF NOT EXISTS `hotel_pricing_rules` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `rule_code` VARCHAR(50),
  `rule_type` VARCHAR(50),
  `modifier_type` VARCHAR(20),
  `modifier_value` DECIMAL(10, 3),
  `date_from` DATE,
  `date_to` DATE,
  `rule_data` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  INDEX `idx_rule` (`rule_code`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hotel_tax_info` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT,
  `date_from` DATE,
  `date_to` DATE,
  `room_code` VARCHAR(50),
  `board_code` VARCHAR(10),
  `tax_code` VARCHAR(50),
  `included_flag` CHAR(1),
  `max_nights` INT,
  `min_age` INT,
  `max_age` INT,
  `per_night` CHAR(1),
  `per_pax` CHAR(1),
  `amount` DECIMAL(10, 2),
  `percentage` DECIMAL(10, 4),
  `currency` VARCHAR(5),
  `apply_over` CHAR(1),
  `market_code` VARCHAR(10),
  `legal_text` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_hotel` (`hotel_id`),
  INDEX `idx_tax` (`tax_code`),
  INDEX `idx_room_board` (`room_code`, `board_code`),
  INDEX `idx_dates` (`date_from`, `date_to`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHEAPEST PRICE PER PERSON TABLE (Precomputed)
-- ============================================
CREATE TABLE IF NOT EXISTS `cheapest_pp` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT NOT NULL,
  `hotel_name` VARCHAR(255) COMMENT 'Hotel name from hotels table',
  `destination_code` VARCHAR(10) COMMENT 'Destination code',
  `country_code` VARCHAR(5) COMMENT 'Country code',
  `hotel_category` VARCHAR(50) COMMENT 'Hotel category',
  `latitude` DECIMAL(11, 8) COMMENT 'Hotel latitude',
  `longitude` DECIMAL(11, 8) COMMENT 'Hotel longitude',
  `category_tag` VARCHAR(20) DEFAULT 'CITY_TRIP' COMMENT 'CITY_TRIP or OTHER',
  `start_date` DATE NOT NULL COMMENT 'Earliest bookable date',
  `end_date` DATE COMMENT 'Check-out date',
  `nights` INT NOT NULL COMMENT 'Number of nights',
  `board_code` VARCHAR(10) COMMENT 'Board type: RO, BB, HB, FB, AI',
  `room_code` VARCHAR(50) COMMENT 'Room code',
  `price_pp` DECIMAL(10, 2) NOT NULL COMMENT 'Price per person (double occupancy)',
  `total_price` DECIMAL(10, 2) NOT NULL COMMENT 'Total price for the stay',
  `currency` VARCHAR(5) DEFAULT 'EUR',
  `has_promotion` BOOLEAN DEFAULT FALSE COMMENT 'If promotion was applied',
  `derived_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this was computed',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_hotel_category` (`hotel_id`, `category_tag`),
  INDEX `idx_category_price` (`category_tag`, `price_pp`),
  INDEX `idx_start_date` (`start_date`),
  INDEX `idx_hotel_price` (`hotel_id`, `price_pp`),
  INDEX `idx_hotel_name` (`hotel_name`(100)),
  INDEX `idx_destination` (`destination_code`),
  UNIQUE KEY `uk_hotel_category` (`hotel_id`, `category_tag`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SEARCH INDEX TABLE (For filters & sorting)
-- ============================================
CREATE TABLE IF NOT EXISTS `search_index` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `hotel_id` BIGINT NOT NULL UNIQUE,
  `destination_code` VARCHAR(10),
  `category` VARCHAR(10),
  `rating` DECIMAL(3, 1),
  `min_price_pp` DECIMAL(10, 2) COMMENT 'Minimum price per person',
  `max_price_pp` DECIMAL(10, 2) COMMENT 'Maximum price per person',
  `has_promotions` BOOLEAN DEFAULT FALSE,
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_destination` (`destination_code`),
  INDEX `idx_category` (`category`),
  INDEX `idx_price_range` (`min_price_pp`, `max_price_pp`),
  INDEX `idx_rating` (`rating`),
  INDEX `idx_promotions` (`has_promotions`),
  FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

