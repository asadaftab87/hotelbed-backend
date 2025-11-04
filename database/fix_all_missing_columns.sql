-- FIX ALL MISSING DATA - APPLY TO PRODUCTION

-- 1. Fix hotel_contracts - set defaults for missing columns
UPDATE hotel_contracts 
SET 
  payment_type = 'PREPAID',
  market = 'ALL',
  is_active = 'Y'
WHERE payment_type IS NULL OR market IS NULL OR is_active IS NULL;

-- 2. Ensure cheapest_pp has end_date, latitude, longitude
ALTER TABLE cheapest_pp 
ADD COLUMN IF NOT EXISTS end_date DATE AFTER start_date,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(11,8) AFTER hotel_category,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) AFTER latitude;

-- 3. Update cheapest_pp with calculated end_date and hotel coordinates
UPDATE cheapest_pp cp
JOIN hotels h ON cp.hotel_id = h.id
SET 
  cp.end_date = DATE_ADD(cp.start_date, INTERVAL cp.nights DAY),
  cp.latitude = h.latitude,
  cp.longitude = h.longitude
WHERE cp.end_date IS NULL OR cp.latitude IS NULL OR cp.longitude IS NULL;

-- 4. Create staging table for cheapest_pp
CREATE TABLE IF NOT EXISTS cheapest_pp_staging LIKE cheapest_pp;

SELECT 'All fixes applied' as status;
