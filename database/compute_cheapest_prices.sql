-- COMPUTE CHEAPEST PRICES WITH HOTEL DETAILS
-- This runs after data import to calculate cheapest prices per hotel

-- Clear old prices
TRUNCATE TABLE cheapest_pp;

-- Compute CITY_TRIP prices (2 nights)
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category, 
 category_tag, start_date, nights, board_code, room_code, 
 price_pp, total_price, currency, has_promotion)
SELECT 
  h.id as hotel_id,
  h.name as hotel_name,
  h.destination_code,
  h.country_code,
  h.category as hotel_category,
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
JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category;

-- Compute OTHER prices (5 nights)
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category,
 category_tag, start_date, nights, board_code, room_code, 
 price_pp, total_price, currency, has_promotion)
SELECT 
  h.id as hotel_id,
  h.name as hotel_name,
  h.destination_code,
  h.country_code,
  h.category as hotel_category,
  'OTHER' as category_tag,
  MIN(r.date_from) as start_date,
  5 as nights,
  'RO' as board_code,
  'STD' as room_code,
  ROUND(MIN(r.price) * 5 / 2, 2) as price_pp,
  ROUND(MIN(r.price) * 5, 2) as total_price,
  'EUR' as currency,
  0 as has_promotion
FROM hotel_rates r
JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category;

SELECT 
  'Cheapest prices computed' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT hotel_id) as unique_hotels
FROM cheapest_pp;
