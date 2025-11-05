-- Migration: Add hotel details columns to cheapest_pp table
-- This ensures hotel names and other details are stored directly in cheapest_pp

-- Add columns if they don't exist
ALTER TABLE cheapest_pp 
ADD COLUMN IF NOT EXISTS hotel_name VARCHAR(255) COMMENT 'Hotel name from hotels table' AFTER hotel_id,
ADD COLUMN IF NOT EXISTS destination_code VARCHAR(10) COMMENT 'Destination code' AFTER hotel_name,
ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) COMMENT 'Country code' AFTER destination_code,
ADD COLUMN IF NOT EXISTS hotel_category VARCHAR(50) COMMENT 'Hotel category' AFTER country_code,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(11, 8) COMMENT 'Hotel latitude' AFTER hotel_category,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) COMMENT 'Hotel longitude' AFTER latitude,
ADD COLUMN IF NOT EXISTS end_date DATE COMMENT 'Check-out date' AFTER start_date;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_hotel_name ON cheapest_pp(hotel_name(100));
CREATE INDEX IF NOT EXISTS idx_destination ON cheapest_pp(destination_code);

SELECT 'Migration completed: hotel details columns added to cheapest_pp' as status;
