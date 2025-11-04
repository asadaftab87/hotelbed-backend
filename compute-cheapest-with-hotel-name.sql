-- Compute cheapest prices with hotel details including hotel_name
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude, 
 category_tag, start_date, end_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
SELECT 
  r.hotel_id,
  h.name as hotel_name,
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
JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY r.hotel_id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
ON DUPLICATE KEY UPDATE 
  hotel_name = VALUES(hotel_name),
  destination_code = VALUES(destination_code),
  country_code = VALUES(country_code),
  hotel_category = VALUES(hotel_category),
  latitude = VALUES(latitude),
  longitude = VALUES(longitude),
  price_pp = VALUES(price_pp),
  total_price = VALUES(total_price),
  end_date = VALUES(end_date),
  derived_at = NOW();

SELECT 'Cheapest prices computed with hotel names!' as status;
