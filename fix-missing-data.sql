-- Fix hotel_contracts NULL values
UPDATE hotel_contracts 
SET 
  board_type = COALESCE(board_type, 'RO'),
  created_at = NOW()
WHERE board_type IS NULL OR created_at IS NULL;

-- Import destinations from IDES_F
LOAD DATA LOCAL INFILE '/tmp/destinations.csv'
REPLACE INTO TABLE destinations
FIELDS TERMINATED BY ':'
LINES TERMINATED BY '\n'
(code, country_code, is_available);

-- Import categories from GCAT_F  
LOAD DATA LOCAL INFILE '/tmp/categories.csv'
REPLACE INTO TABLE categories
FIELDS TERMINATED BY ':'
LINES TERMINATED BY '\n'
(code, @dummy, simple_code);

-- Compute cheapest prices
INSERT INTO cheapest_pp 
(hotel_id, category_tag, start_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
SELECT 
  r.hotel_id,
  'CITY_TRIP' as category_tag,
  MIN(r.date_from) as start_date,
  2 as nights,
  'RO' as board_code,
  'STD' as room_code,
  ROUND(MIN(r.price) * 2 / 2, 2) as price_pp,
  ROUND(MIN(r.price) * 2, 2) as total_price,
  'EUR' as currency,
  0 as has_promotion
FROM hotel_rates r
WHERE r.price > 0
GROUP BY r.hotel_id
ON DUPLICATE KEY UPDATE 
  price_pp = VALUES(price_pp),
  total_price = VALUES(total_price),
  derived_at = NOW();

SELECT 'Fixed!' as status;
