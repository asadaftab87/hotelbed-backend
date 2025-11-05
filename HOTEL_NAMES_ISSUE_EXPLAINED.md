# Hotel Names Issue - Root Cause Analysis

## Problem Statement
The `cheapest_pp` table shows placeholder names like "Property 23492 - AB" instead of real hotel names.

## Root Cause Analysis

### Data Structure in HotelBeds Cache API

1. **GHOT_F File (General/Hotels)**
   - Location: `GENERAL/GHOT_F`
   - Contains: 23,667 hotels with REAL names
   - Format: `id:category:destination:chain:...:name`
   - Example: `1:3EST:SAL:OHTEL::10:N:ES::1.153:41.068:Ohtels Villa Dorada`
   - ID Range: 1 to 1,096,537 (with gaps)

2. **Destination-Specific Files**
   - Location: `DESTINATIONS/D_{CODE}/{hotel_id}_M_F`
   - Contains: Pricing, rates, inventory, contracts
   - **DOES NOT CONTAIN**: Hotel names
   - Example: `257_23492_M_F` has rates but NO name field

### The Mismatch

```
Hotels in GHOT_F (with real names):     23,667 hotels
Hotels with pricing data:                6,129 hotels  
Hotels with BOTH names AND pricing:          0 hotels ❌
```

### Why This Happens

1. GHOT_F contains hotel metadata (names, locations, categories)
2. Destination files contain pricing data
3. **These two datasets have ZERO overlap** in hotel IDs
4. When pricing data is imported for hotel 23492:
   - System checks if hotel 23492 exists in `hotels` table
   - It doesn't exist (not in GHOT_F)
   - System creates placeholder: "Property 23492 - AB"

## Current Database State

```sql
-- Hotels table
Total hotels: 29,797
Hotels with real names: 23,667 (from GHOT_F)
Hotels with placeholder names: 6,130 (auto-generated)

-- Hotel_rates table  
Hotels with pricing: 6,129
ID range: 1410 to 465936

-- Cheapest_pp table
Total records: 12,258 (6,129 hotels × 2 categories)
Records with real names: 0
Records with placeholder names: 12,258
```

## Why JOIN Doesn't Work

The current SQL correctly joins `hotels` and `hotel_rates`:

```sql
SELECT 
  h.id,
  h.name,  -- This IS being selected
  h.destination_code,
  ...
FROM hotel_rates r
INNER JOIN hotels h ON r.hotel_id = h.id
```

**The JOIN works perfectly!** The problem is that `h.name` contains "Property 23492 - AB" because that's what was stored when the hotel was auto-created during rate import.

## Solutions

### Option 1: Use HotelBeds Content API (RECOMMENDED)
```javascript
// For each hotel with placeholder name
const hotelDetails = await hotelbedsContentAPI.getHotel(hotelId);
await db.query(
  'UPDATE hotels SET name = ? WHERE id = ?',
  [hotelDetails.name, hotelId]
);
```

### Option 2: Check if GHOT_F is incomplete
- Verify if you're using the correct Cache API endpoint
- Check if there's a "full" vs "partial" download option
- The GHOT_F file might be filtered by market/region

### Option 3: Manual mapping (NOT RECOMMENDED)
- Create a mapping file from another source
- This is not sustainable

## Verification Queries

```sql
-- Check hotels with rates but placeholder names
SELECT 
  h.id,
  h.name,
  h.destination_code,
  COUNT(r.id) as rate_count
FROM hotels h
INNER JOIN hotel_rates r ON h.id = r.hotel_id
WHERE h.name LIKE 'Property %'
GROUP BY h.id
LIMIT 20;

-- Check if any hotels from GHOT_F have rates
SELECT COUNT(*)
FROM hotels h
INNER JOIN hotel_rates r ON h.id = r.hotel_id
WHERE h.name NOT LIKE 'Property %';
-- Result: 0

-- Check cheapest_pp names
SELECT hotel_id, hotel_name, price_pp
FROM cheapest_pp
WHERE hotel_name NOT LIKE 'Property %'
LIMIT 10;
-- Result: 0 rows
```

## Conclusion

**The database logic is CORRECT.** The issue is that the source data (GHOT_F) doesn't contain names for hotels that have pricing. The only way to get real names is:

1. ✅ Use Content API (recommended by HotelBeds documentation)
2. ⚠️ Verify Cache API download is complete
3. ❌ Manual mapping (not sustainable)

The `cheapest_pp` table IS correctly joining with `hotels` table and getting the `name` field. The problem is upstream - the names don't exist in the source data.
