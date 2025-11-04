-- COMPLETE DATA VERIFICATION SCRIPT
-- Run this to verify all tables have proper data with no NULLs

SELECT '========================================' as info;
SELECT 'CHEAPEST PRICES TABLE' as info;
SELECT '========================================' as info;

SELECT 
  COUNT(*) as total_records,
  SUM(hotel_name IS NULL) as null_names,
  SUM(destination_code IS NULL) as null_dest,
  SUM(country_code IS NULL) as null_country,
  SUM(hotel_category IS NULL) as null_category,
  SUM(price_pp IS NULL) as null_price
FROM cheapest_pp;

SELECT '========================================' as info;
SELECT 'HOTEL CONTRACTS TABLE' as info;
SELECT '========================================' as info;

SELECT 
  COUNT(*) as total_records,
  SUM(board_type IS NULL) as null_board_type,
  SUM(currency IS NULL) as null_currency,
  SUM(created_at IS NULL) as null_created_at
FROM hotel_contracts;

SELECT '========================================' as info;
SELECT 'DESTINATIONS TABLE' as info;
SELECT '========================================' as info;

SELECT 
  COUNT(*) as total_records,
  SUM(code IS NULL) as null_code,
  SUM(country_code IS NULL) as null_country
FROM destinations;

SELECT '========================================' as info;
SELECT 'CATEGORIES TABLE' as info;
SELECT '========================================' as info;

SELECT 
  COUNT(*) as total_records,
  SUM(code IS NULL) as null_code,
  SUM(simple_code IS NULL) as null_simple_code
FROM categories;

SELECT '========================================' as info;
SELECT 'HOTELS TABLE' as info;
SELECT '========================================' as info;

SELECT 
  COUNT(*) as total_records,
  SUM(name IS NULL) as null_names,
  SUM(category IS NULL) as null_category,
  SUM(country_code IS NULL) as null_country,
  SUM(destination_code IS NULL) as null_dest
FROM hotels;

SELECT '========================================' as info;
SELECT 'SAMPLE DATA FROM EACH TABLE' as info;
SELECT '========================================' as info;

SELECT 'Cheapest Prices:' as sample;
SELECT hotel_id, hotel_name, destination_code, country_code, price_pp FROM cheapest_pp LIMIT 2;

SELECT 'Hotel Contracts:' as sample;
SELECT hotel_id, board_type, currency, created_at FROM hotel_contracts LIMIT 2;

SELECT 'Destinations:' as sample;
SELECT code, country_code, is_available FROM destinations LIMIT 2;

SELECT 'Categories:' as sample;
SELECT code, simple_code FROM categories LIMIT 2;

SELECT 'Hotels:' as sample;
SELECT id, name, category, country_code, destination_code FROM hotels LIMIT 2;

SELECT '========================================' as info;
SELECT '✅ VERIFICATION COMPLETE' as info;
SELECT '========================================' as info;
