-- FIX CHEAPEST_PP TABLE WITH COMPLETE HOTEL DETAILS
-- This script properly joins hotels table to get name, location, and all details

-- Step 1: Clear old data
TRUNCATE TABLE cheapest_pp;

-- Step 2: Compute CITY_TRIP prices (2 nights) with COMPLETE hotel details
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category, 
 latitude, longitude, category_tag, start_date, end_date, nights, 
 board_code, room_code, price_pp, total_price, currency, has_promotion)
SELECT 
  h.id as hotel_id,
  COALESCE(h.name, CONCAT('Property ', h.id)) as hotel_name,
  h.destination_code,
  h.country_code,
  h.category as hotel_category,
  h.latitude,
  h.longitude,
  'CITY_TRIP' as category_tag,
  MIN(r.date_from) as start_date,
  DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY) as end_date,
  2 as nights,
  'RO' as board_code,
  'STD' as room_code,
  ROUND(MIN(r.price) * 2 / 2, 2) as price_pp,
  ROUND(MIN(r.price) * 2, 2) as total_price,
  'EUR' as currency,
  0 as has_promotion
FROM hotel_rates r
INNER JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude;

-- Step 3: Compute OTHER prices (5 nights) with COMPLETE hotel details
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category,
 latitude, longitude, category_tag, start_date, end_date, nights, 
 board_code, room_code, price_pp, total_price, currency, has_promotion)
SELECT 
  h.id as hotel_id,
  COALESCE(h.name, CONCAT('Property ', h.id)) as hotel_name,
  h.destination_code,
  h.country_code,
  h.category as hotel_category,
  h.latitude,
  h.longitude,
  'OTHER' as category_tag,
  MIN(r.date_from) as start_date,
  DATE_ADD(MIN(r.date_from), INTERVAL 5 DAY) as end_date,
  5 as nights,
  'RO' as board_code,
  'STD' as room_code,
  ROUND(MIN(r.price) * 5 / 2, 2) as price_pp,
  ROUND(MIN(r.price) * 5, 2) as total_price,
  'EUR' as currency,
  0 as has_promotion
FROM hotel_rates r
INNER JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude;

-- Step 4: Verify results
SELECT 
  'Cheapest prices computed' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT hotel_id) as unique_hotels,
  COUNT(hotel_name) as records_with_names,
  COUNT(latitude) as records_with_latitude,
  COUNT(longitude) as records_with_longitude
FROM cheapest_pp;

-- Step 5: Show sample with real names
SELECT 
  hotel_id,
  hotel_name,
  destination_code,
  latitude,
  longitude,
  category_tag,
  price_pp,
  total_price
FROM cheapest_pp
WHERE hotel_name NOT LIKE 'Property %'
LIMIT 10;
