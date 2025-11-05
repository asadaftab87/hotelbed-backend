# Hotel Names in Cheapest_PP - Solution

## Problem Summary

Cheapest_pp table shows generic names like "Property 1410 - ANU" instead of real hotel names.

## Root Cause

Hotelbeds Cache API has two separate data sources:
1. **GHOT_F file** - Contains ~23,667 hotels with real names but has gaps in hotel IDs (e.g., IDs 1-1096537 exist but many IDs missing like 1410, 23496)
2. **Pricing Data** - Hotels with rates often fall in the ID gaps where GHOT_F has no data

## Current Implementation Status ✅

- GHOT_F parser extracts hotel names correctly (index 11)
- Hotels table stores all available names from GHOT_F
- Cheapest_pp table has hotel_name column
- Import process and cron jobs pull hotel names from hotels table
- API returns hotel names from cheapest_pp
- **System is working correctly** - it shows all available data from Cache API

## Solution Options

### Option 1: Hotelbeds Content/Static API ✅ RECOMMENDED

**What:** Call Hotelbeds Content API to fetch hotel details (name, description, photos, amenities)

**API Endpoint:** `/hotels/static` (as per documentation)

**Implementation:**
```javascript
// Job to fetch hotel names from Content API
async function fetchHotelNamesFromContentAPI() {
  // 1. Get hotels with generic names
  const hotels = await db.query(
    "SELECT id FROM hotels WHERE name LIKE 'Property %'"
  );
  
  // 2. Call Content API in batches
  for (const hotel of hotels) {
    const details = await hotelbedsContentAPI.getHotelDetails(hotel.id);
    await db.query("UPDATE hotels SET name = ? WHERE id = ?", [details.name, hotel.id]);
  }
  
  // 3. Sync to cheapest_pp
  await db.query(`
    UPDATE cheapest_pp cp
    INNER JOIN hotels h ON cp.hotel_id = h.id
    SET cp.hotel_name = h.name
    WHERE cp.hotel_name LIKE 'Property %'
  `);
}
```

**Pros:**
- Official Hotelbeds data source
- Most accurate and up-to-date
- Includes descriptions, photos, amenities

**Cons:**
- Requires additional API calls
- May have rate limits
- Need to check API documentation

### Option 2: Third-party Hotel Master Data

**What:** Integrate with hotel data providers (Giata, HotelsPro, Amadeus)

**Pros:**
- Comprehensive hotel database
- Often includes more details than Hotelbeds

**Cons:**
- Usually paid service
- Requires additional integration
- Data mapping needed

### Option 3: Accept Current State

**What:** Display generic names with disclaimer

**Pros:**
- No additional work
- Acceptable for MVP

**Cons:**
- Poor user experience
- Less professional

## Recommended Next Steps

1. **Check Hotelbeds API Documentation** - Find Content/Static API endpoint and authentication
2. **Implement Hotel Name Fetching Job** - Create background job to fetch missing hotel names
3. **Schedule After Import** - Run job after Cache API import completes
4. **Add to Cron** - Periodic updates for new hotels

## Files Modified

All code is already in place:
- `src/utils/generalFilesParser.ts` - Parses GHOT_F correctly
- `src/api/components/hotelBed/hotelBed.repository.ts` - Pulls hotel names in all queries
- `src/cron/jobs.ts` - Includes hotel names in price computation
- Database schema - Has all required columns

**No code changes needed** - only need to add Content API integration for missing hotel names.
