-- Add hotel details to cheapest_pp table for faster queries
ALTER TABLE cheapest_pp 
ADD COLUMN hotel_name VARCHAR(500) AFTER hotel_id,
ADD COLUMN destination_code VARCHAR(10) AFTER hotel_name,
ADD COLUMN country_code VARCHAR(5) AFTER destination_code,
ADD COLUMN hotel_category VARCHAR(10) AFTER country_code,
ADD INDEX idx_destination (destination_code),
ADD INDEX idx_country (country_code),
ADD INDEX idx_category (hotel_category);

-- Update existing records with hotel details
UPDATE cheapest_pp cp
JOIN hotels h ON cp.hotel_id = h.id
SET 
  cp.hotel_name = h.name,
  cp.destination_code = h.destination_code,
  cp.country_code = h.country_code,
  cp.hotel_category = h.category;

SELECT 'Enhanced cheapest_pp table' as status;
