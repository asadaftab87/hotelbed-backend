-- COMPUTE CHEAPEST PRICES WITH COMPLETE FORMULA
-- Includes: Base Rate + Supplements + Promotions + Taxes
-- Per HotelBeds Cache API Specification

TRUNCATE TABLE cheapest_pp;

-- CITY_TRIP (2 nights, 2 adults)
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category, 
 category_tag, start_date, nights, board_code, room_code, 
 price_pp, total_price, currency, has_promotion)
SELECT 
  h.id,
  h.name,
  h.destination_code,
  h.country_code,
  h.category,
  'CITY_TRIP',
  r.date_from,
  2,
  r.board_code,
  r.room_code,
  ROUND((
    (r.price * 2) +                                           -- Base rate × nights
    COALESCE(s.discount_percent, 0) +                         -- Supplements
    COALESCE(p.discount_value, 0) +                           -- Promotions
    COALESCE(t.amount * 2, t.percentage * r.price * 2 / 100, 0) -- Taxes
  ) / 2, 2) as price_pp,
  ROUND(
    (r.price * 2) + 
    COALESCE(s.discount_percent, 0) + 
    COALESCE(p.discount_value, 0) + 
    COALESCE(t.amount * 2, t.percentage * r.price * 2 / 100, 0)
  , 2) as total_price,
  'EUR',
  CASE WHEN p.promo_code IS NOT NULL THEN 1 ELSE 0 END
FROM hotel_rates r
JOIN hotels h ON r.hotel_id = h.id
LEFT JOIN hotel_supplements s ON s.hotel_id = r.hotel_id 
  AND r.date_from BETWEEN s.date_from AND s.date_to
LEFT JOIN hotel_promotions p ON p.hotel_id = r.hotel_id 
  AND r.date_from BETWEEN p.date_from AND p.date_to
LEFT JOIN hotel_tax_info t ON t.hotel_id = r.hotel_id 
  AND r.room_code = t.room_code AND r.board_code = t.board_code
WHERE r.price > 0 AND r.adults = 2
GROUP BY h.id
HAVING MIN(
  (r.price * 2) + 
  COALESCE(s.discount_percent, 0) + 
  COALESCE(p.discount_value, 0) + 
  COALESCE(t.amount * 2, t.percentage * r.price * 2 / 100, 0)
);

-- OTHER (5 nights, 2 adults)
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category,
 category_tag, start_date, nights, board_code, room_code, 
 price_pp, total_price, currency, has_promotion)
SELECT 
  h.id,
  h.name,
  h.destination_code,
  h.country_code,
  h.category,
  'OTHER',
  r.date_from,
  5,
  r.board_code,
  r.room_code,
  ROUND((
    (r.price * 5) + 
    COALESCE(s.discount_percent, 0) + 
    COALESCE(p.discount_value, 0) + 
    COALESCE(t.amount * 5, t.percentage * r.price * 5 / 100, 0)
  ) / 2, 2) as price_pp,
  ROUND(
    (r.price * 5) + 
    COALESCE(s.discount_percent, 0) + 
    COALESCE(p.discount_value, 0) + 
    COALESCE(t.amount * 5, t.percentage * r.price * 5 / 100, 0)
  , 2) as total_price,
  'EUR',
  CASE WHEN p.promo_code IS NOT NULL THEN 1 ELSE 0 END
FROM hotel_rates r
JOIN hotels h ON r.hotel_id = h.id
LEFT JOIN hotel_supplements s ON s.hotel_id = r.hotel_id 
  AND r.date_from BETWEEN s.date_from AND s.date_to
LEFT JOIN hotel_promotions p ON p.hotel_id = r.hotel_id 
  AND r.date_from BETWEEN p.date_from AND p.date_to
LEFT JOIN hotel_tax_info t ON t.hotel_id = r.hotel_id 
  AND r.room_code = t.room_code AND r.board_code = t.board_code
WHERE r.price > 0 AND r.adults = 2
GROUP BY h.id
HAVING MIN(
  (r.price * 5) + 
  COALESCE(s.discount_percent, 0) + 
  COALESCE(p.discount_value, 0) + 
  COALESCE(t.amount * 5, t.percentage * r.price * 5 / 100, 0)
);

SELECT 
  'Cheapest prices computed' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT hotel_id) as unique_hotels
FROM cheapest_pp;
