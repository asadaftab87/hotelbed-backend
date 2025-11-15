# HotelBeds API Endpoints Guide

## Data Import Endpoints

### 1. Complete Process (Full Pipeline)
```
GET /api/v1/hotelbed/process
```
**What it does:**
1. Downloads HotelBeds cache from API
2. Extracts ZIP file
3. Generates CSV files from extracted data
4. Uploads CSVs to S3
5. Loads data to Aurora database

**Use when:** Starting fresh or doing a complete refresh

**Duration:** 30-60 minutes (depends on cache size)

---

### 2. Import Only (Development)
```
GET /api/v1/hotelbed/import-only?folder=hotelbed_cache_full_1763048503126
```
**What it does:**
1. Uses existing extracted folder in `downloads/`
2. Generates CSV files
3. Uploads CSVs to S3
4. Loads data to Aurora database

**Use when:** Cache is already downloaded and extracted

**Duration:** 20-30 minutes

---

### 3. Upload & Load (CSVs exist locally)
```
POST /api/v1/hotelbed/upload-and-load
```
**What it does:**
1. Uploads existing CSVs from `downloads/csv_output/` to S3
2. Loads data from S3 to Aurora database

**Use when:** CSVs are already generated locally

**Requirements:** CSV files must exist in `downloads/csv_output/`

**Duration:** 15-30 minutes

---

### 4. Load from S3 Only ⭐ NEW
```
POST /api/v1/hotelbed/load-from-s3
```
**What it does:**
1. Loads data directly from S3 to Aurora database
2. **Does NOT upload** - assumes files already in S3

**Use when:** 
- CSVs are already in S3
- Reloading database without re-uploading
- Testing/debugging the load process
- Database was cleared but S3 files are still there

**Requirements:** CSV files must exist in S3 bucket `hotelbed-imports-cache-data/hotelbed-csv/`

**Duration:** 10-20 minutes

**Benefits:**
- ✅ Fastest reload option
- ✅ No local files needed
- ✅ Independent connection per table (no cascading failures)
- ✅ 2-hour timeout for large tables

---

## Endpoint Comparison

| Endpoint | Downloads | Extracts | Generates CSVs | Uploads to S3 | Loads to DB | Duration |
|----------|-----------|----------|----------------|---------------|-------------|----------|
| `/process` | ✅ | ✅ | ✅ | ✅ | ✅ | 30-60 min |
| `/import-only` | ❌ | ❌ | ✅ | ✅ | ✅ | 20-30 min |
| `/upload-and-load` | ❌ | ❌ | ❌ | ✅ | ✅ | 15-30 min |
| `/load-from-s3` | ❌ | ❌ | ❌ | ❌ | ✅ | 10-20 min |

---

## Usage Examples

### Scenario 1: First Time Setup
```bash
# Download everything and import
curl -X GET http://localhost:3001/api/v1/hotelbed/process
```

### Scenario 2: Reload Database (CSVs in S3)
```bash
# Fastest: Load directly from S3
curl -X POST http://localhost:3001/api/v1/hotelbed/load-from-s3
```

### Scenario 3: CSVs Generated Locally
```bash
# Upload to S3 and load to database
curl -X POST http://localhost:3001/api/v1/hotelbed/upload-and-load
```

### Scenario 4: Cache Already Downloaded
```bash
# Use existing extracted folder
curl -X GET http://localhost:3001/api/v1/hotelbed/import-only?folder=hotelbed_cache_full_1763048503126
```

---

## Connection Timeout Fix (Applied)

### Problem Solved
Previously, loading `hotel_rates.csv` (1.1GB, 24.5M rows) caused connection timeout, which cascaded to all remaining tables.

### Solution Implemented
- ✅ **Fresh connection per table** - Each of 21 tables gets its own database connection
- ✅ **Aggressive timeouts** - 2 hours for large tables, 1 hour for others
- ✅ **Independent transactions** - Failed tables don't block others
- ✅ **Graceful error handling** - Connection always released back to pool

### Expected Load Times
- Small tables (<100MB): 10-30 seconds
- Medium tables (100-500MB): 1-3 minutes
- **hotel_rates (1.1GB)**: 5-15 minutes

---

## Query Endpoints

### Get Hotels
```
GET /api/v1/hotelbed/hotels?page=1&limit=10&destination_code=BCN
```

### Get Hotel by ID
```
GET /api/v1/hotelbed/hotels/14126
```

### Search Hotels
```
GET /api/v1/hotelbed/search?destination=BCN&category=CITY_TRIP&sort=price_asc&page=1&limit=20
```

### Get Database Stats
```
GET /api/v1/hotelbed/stats
```

### Compute Cheapest Prices
```
POST /api/v1/hotelbed/compute-prices?category=ALL
POST /api/v1/hotelbed/compute-prices?hotel_id=14126
```

---

## Environment Variables Required

```env
# Database
DB_HOST=hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=hotelbed
DB_PASSWORD=Aurora123!Secure
DB_NAME=hotelbed_db

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=hotelbed-imports-cache-data

# HotelBeds API (for /process endpoint)
HOTELBEDS_API_KEY=your_api_key
HOTELBEDS_API_SECRET=your_api_secret
```

---

## Monitoring Tips

### Check S3 Files
```bash
aws s3 ls s3://hotelbed-imports-cache-data/hotelbed-csv/
```

### Check Database Tables
```sql
SELECT 
  table_name,
  table_rows,
  ROUND(data_length / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'hotelbed_db'
ORDER BY data_length DESC;
```

### Check Load Progress (in logs)
```bash
# Look for these patterns:
✅ hotel_rates loaded in 8.5s (Rows: 24497082)
❌ hotel_rates failed: Connection lost
📊 Summary: 21 succeeded, 0 failed
```

---

## Troubleshooting

### Connection Timeout
**Fixed!** Each table now has its own connection with 2-hour timeout.

### S3 Integration Error
```bash
# Enable S3 integration
npm run enable-s3

# Or verify manually
SELECT * FROM mysql.aws_s3_integration;
```

### Empty CSV Files
Some files may be 0 bytes (tax_info, cancellation_policies, room_features) - this is **normal** if Hotelbeds didn't provide that data in the cache dump.

### Out of Memory
Processing is optimized for 32GB RAM machines. If you have less:
- Reduce `BATCH_SIZE` in repository
- Reduce `CONCURRENT_FILES` in repository
