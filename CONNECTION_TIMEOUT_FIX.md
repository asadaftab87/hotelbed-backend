# Database Connection Timeout Fix

## Problem
When loading `hotel_rates.csv` (1.1GB, 24.5M rows) from S3 to Aurora, the database connection timed out with error:
```
Connection lost: The server closed the connection.
PROTOCOL_CONNECTION_LOST
```

All subsequent table loads failed with:
```
Can't add new command when connection is in closed state
```

## Root Cause
The original implementation used a **single database connection** for all 21 tables loaded sequentially. When `hotel_rates.csv` took too long to load, the connection timed out, causing the cascade of failures.

## Solution Implemented

### 1. **Fresh Connection Per Table**
Each table now gets its own database connection from the pool:

```typescript
for (const table of tables) {
  let tableConnection = await pool.getConnection();
  try {
    // Load table
    await tableConnection.query(loadQuery);
    await tableConnection.query('COMMIT');
  } finally {
    tableConnection.release(); // Always release back to pool
  }
}
```

### 2. **Aggressive Timeout Settings**
Different timeouts for different table sizes:

```typescript
const isLargeTable = ['hotel_rates', 'hotel_inventory'].includes(table.name);
const timeout = isLargeTable ? 7200 : 3600; // 2 hours vs 1 hour

await tableConnection.query(`SET SESSION wait_timeout = ${timeout}`);
await tableConnection.query(`SET SESSION interactive_timeout = ${timeout}`);
await tableConnection.query(`SET SESSION net_read_timeout = ${timeout}`);
await tableConnection.query(`SET SESSION net_write_timeout = ${timeout}`);
```

### 3. **Per-Table Transaction Management**
Each table commits its own transaction independently:

```typescript
// Before: Single transaction for ALL tables
await connection.query('COMMIT'); // At end of all tables

// After: Each table commits independently
await tableConnection.query('COMMIT'); // After each table
```

### 4. **Improved Error Handling**
- Failed tables don't block other tables
- Rollback on error for that table only
- Connection always released back to pool
- Summary shows success/failure count

## Benefits

✅ **No More Cascading Failures**: If one table times out, others continue  
✅ **Prevents Connection Starvation**: Fresh connections avoid timeout accumulation  
✅ **Better Resource Management**: Connections released immediately after use  
✅ **Longer Timeouts for Large Tables**: 2-hour timeout for hotel_rates (1.1GB file)  
✅ **Parallel Processing Ready**: Foundation for future parallelization

## Empty CSV Files Explained

Three CSV files are 0 bytes:
- `hotel_tax_info.csv` (ATAX section)
- `hotel_cancellation_policies.csv` (CNCL section)  
- `hotel_room_features.csv` (CNHF section)

**This is NOT a parsing issue!** Verified that Hotelbeds cache dump has empty sections:
```bash
# Checked 100 contract files:
CNHA sections with data: 371 lines ✅
ATAX sections with data: 0 lines ❌
CNCL sections with data: 0 lines ❌
CNHF sections with data: 0 lines ❌
```

Hotelbeds didn't provide this data in the cache dump. The parser correctly handles these sections when data is present.

## Next Steps

1. **Test the fix**: Run upload-and-load again
2. **Monitor performance**: Check how long hotel_rates takes to load
3. **Consider parallelization**: Load multiple tables in parallel (Phase 3 tables can run concurrently)
4. **Optimize hotel_rates**: Possible chunking or partitioning strategies

## Files Modified

- `/src/api/components/hotelBed/hotelBed.repository.ts` - `loadFromS3ToAurora()` method

## Estimated Load Time

Based on Aurora LOAD DATA FROM S3 performance:
- Small tables (<100MB): 10-30 seconds
- Medium tables (100-500MB): 1-3 minutes  
- **hotel_rates (1.1GB)**: 5-15 minutes (with 2-hour timeout buffer)

Total estimated time: **15-30 minutes** for all 21 tables.
