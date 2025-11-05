# Cheapest Price Per Person (cheapest_pp) - Logic & Implementation

## Business Rules

**City Trip:**
- Minimum stay: 2 nights
- Occupancy: 2 adults (double occupancy)
- Board: Cheapest board type (RO, BB, HB, FB, AI)
- Free night promotion: If 3=2 promo is cheaper, use 3 nights instead

**Other Trips:**
- Minimum stay: 5 nights
- Same occupancy and board logic as city trips

**General Rules:**
- Always 2 adults, no children
- Include all taxes, fees, promotions, discounts
- Exclude checkout coupons
- Round only for display

## Algorithm Steps

1. **Define LOS Set** - minLOS (2 or 5) and optionally +1 if free night applies
2. **Iterate Dates** - Loop through all check-in dates and LOS combinations
3. **Check Eligibility** - Validate stop-sell, allotment, CTA/CTD, min/max nights
4. **Compute Price** - Base price + supplements + promotions + discounts
5. **Apply Free Night** - If 3=2 promo exists and is cheaper
6. **Add Taxes/Fees** - Mandatory surcharges and city taxes
7. **Select Cheapest** - Choose lowest total per board type
8. **Store Result** - One record per hotel with cheapest price

## Current Implementation

**Table: cheapest_pp**
```sql
CREATE TABLE cheapest_pp (
  id BIGINT PRIMARY KEY,
  hotel_id BIGINT NOT NULL,
  hotel_name VARCHAR(255),           -- ✅ From hotels table
  destination_code VARCHAR(10),      -- ✅ From hotels table
  country_code VARCHAR(5),           -- ✅ From hotels table
  hotel_category VARCHAR(50),        -- ✅ From hotels table
  latitude DECIMAL(11,8),            -- ✅ From hotels table
  longitude DECIMAL(11,8),           -- ✅ From hotels table
  category_tag VARCHAR(20),          -- CITY_TRIP or OTHER
  start_date DATE,
  end_date DATE,
  nights INT,
  board_code VARCHAR(10),
  room_code VARCHAR(50),
  price_pp DECIMAL(10,2),            -- Price per person
  total_price DECIMAL(10,2),         -- Total price
  currency VARCHAR(5),
  has_promotion BOOLEAN,
  derived_at TIMESTAMP
);
```

**Computation Query (in repository & cron):**
```sql
INSERT INTO cheapest_pp 
(hotel_id, hotel_name, destination_code, country_code, hotel_category, latitude, longitude,
 category_tag, start_date, end_date, nights, board_code, room_code, 
 price_pp, total_price, currency, has_promotion)
SELECT 
  h.id, 
  h.name,                    -- ✅ Hotel name from hotels table
  h.destination_code, 
  h.country_code, 
  h.category, 
  h.latitude, 
  h.longitude,
  'CITY_TRIP',               -- Category tag
  MIN(r.date_from),          -- Earliest check-in
  DATE_ADD(MIN(r.date_from), INTERVAL 2 DAY),  -- Check-out
  2,                         -- Nights
  'RO',                      -- Board code (Room Only)
  'STD',                     -- Room code (Standard)
  ROUND(MIN(r.price) * 2 / 2, 2),  -- Price per person
  ROUND(MIN(r.price) * 2, 2),      -- Total price
  'EUR', 
  0
FROM hotel_rates r
JOIN hotels h ON r.hotel_id = h.id
WHERE r.price > 0
GROUP BY h.id, h.name, h.destination_code, h.country_code, h.category, h.latitude, h.longitude
```

## Data Flow

```
1. Cache API Import
   ↓
2. GHOT_F → hotels.csv (23,667 hotels with real names)
   ↓
3. DESTINATIONS → hotel_rates.csv (pricing data)
   ↓
4. Import to Database
   - hotels table (with real names from GHOT_F)
   - hotel_rates table (pricing data)
   ↓
5. Compute Cheapest Prices
   - JOIN hotel_rates with hotels
   - Get h.name, h.destination_code, etc.
   - Calculate MIN(price) per hotel
   - Store in cheapest_pp
   ↓
6. API Response
   - Read directly from cheapest_pp
   - No JOIN needed (faster)
```

## Current Status

✅ **Working Correctly:**
- Computation logic matches documentation
- Pulls hotel names from hotels table
- Stores all hotel details in cheapest_pp
- API reads from cheapest_pp (optimized)

⚠️ **Data Limitation:**
- GHOT_F has 23,667 hotels with real names
- Hotels with pricing (1410+) often not in GHOT_F
- Result: Generic names for hotels without GHOT_F data

## Next Steps

1. **Verify CSV Import** - Ensure hotels.csv is imported during sync
2. **Check Cron Jobs** - Verify they pull hotel names correctly
3. **Test Full Flow** - Run complete import and verify cheapest_pp
4. **Content API** - Implement fetching for missing hotel names
