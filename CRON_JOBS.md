# Cron Jobs Documentation

## Overview

The hotelbed-backend includes automated cron jobs for periodic data synchronization and price computation. These jobs ensure that hotel data, availability, and pricing information stay up-to-date without manual intervention.

## Available Jobs

### 1. Daily Incremental Sync (`HotelbedsSync.run()`)

**Schedule**: Every day at 2:00 AM UTC  
**Purpose**: Downloads and imports incremental updates from Hotelbeds  
**Duration**: ~30-60 minutes (depending on update size)  
**Actions**:
- Downloads latest incremental update ZIP
- Extracts and parses data
- Generates deduplicated CSV files
- Uploads to S3
- Loads into Aurora database
- Computes cheapest prices for affected hotels

**Example Manual Trigger**:
```bash
curl -X POST http://localhost:5001/api/v1/cron/trigger/daily-sync
```

### 2. Weekly Full Cache Refresh (`HotelbedsSync.runFullSync()`)

**Schedule**: Every Sunday at 3:00 AM UTC  
**Purpose**: Complete database refresh with latest full cache  
**Duration**: ~2-4 hours (depending on cache size)  
**Actions**:
- Downloads complete Hotelbeds cache ZIP
- Cleans existing database
- Extracts and parses all data (GENERAL + ATAX folders)
- Generates deduplicated CSV files (24.5M rows → 1.1GB)
- Uploads to S3
- Loads into Aurora database
- Computes cheapest prices for all hotels

**Example Manual Trigger**:
```bash
curl -X POST http://localhost:5001/api/v1/cron/trigger/weekly-sync
```

### 3. Cheapest Price Computation (`CheapestPriceJob.run()`)

**Schedule**: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)  
**Purpose**: Recalculates cheapest prices based on latest data  
**Duration**: ~15-30 minutes  
**Actions**:
- Queries all hotels with EPP data
- Computes cheapest prices for CITY_TRIP and OTHER categories
- Updates `cheapest_pp` table
- Logs processing statistics

**Example Manual Trigger**:
```bash
curl -X POST http://localhost:5001/api/v1/cron/trigger/price-computation
```

## Configuration

### Environment Variables

```env
# Enable/disable cron scheduler
ENABLE_CRON=true

# Database credentials
DB_HOST=hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com
DB_USER=hotelbed
DB_PASSWORD=Aurora123!Secure
DB_NAME=hotelbed_db

# AWS S3 configuration
AWS_ACCESS_KEY_ID=AKIAVGISZFYUW4NB2JXI
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_S3_BUCKET=hotelbed-imports-cache-data

# Hotelbeds API
HOTELBEDS_API_KEY=f513d78a7046ca883c02bd80926aa1b7
HOTELBEDS_BASE_URL=https://aif2.hotelbeds.com/aif2-pub-ws/files
HOTELBEDS_CACHE_ENDPOINT=/full
```

### Disabling Cron Jobs

To disable all cron jobs:

```env
ENABLE_CRON=false
```

## API Endpoints

### Get Cron Status

```http
GET /api/v1/cron/status
```

**Response**:
```json
{
  "success": true,
  "data": {
    "jobs": [
      { "name": "dailySync", "running": true },
      { "name": "weeklyFullSync", "running": true },
      { "name": "priceComputation", "running": true }
    ],
    "total": 3
  }
}
```

### Trigger Daily Sync

```http
POST /api/v1/cron/trigger/daily-sync
```

**Response**:
```json
{
  "success": true,
  "message": "Daily sync job triggered",
  "note": "Job is running in background. Check logs for status."
}
```

### Trigger Weekly Full Sync

```http
POST /api/v1/cron/trigger/weekly-sync
```

**Response**:
```json
{
  "success": true,
  "message": "Weekly full sync job triggered",
  "note": "Job is running in background. This may take several hours. Check logs for status."
}
```

### Trigger Price Computation

```http
POST /api/v1/cron/trigger/price-computation
```

**Response**:
```json
{
  "success": true,
  "message": "Price computation job triggered",
  "note": "Job is running in background. Check logs for status."
}
```

## Monitoring

### Logs

All cron job activity is logged with the `[CRON]` or `[SCHEDULER]` prefix:

```
[SCHEDULER] 🚀 Starting cron scheduler...
[SCHEDULER] ✅ All cron jobs started
[CRON] ⏰ Triggering daily incremental sync...
[CRON] 📥 Downloading incremental update...
[CRON] ✅ Sync completed in 45.23s
```

### Health Check

Check if cron jobs are running:

```bash
curl http://localhost:5001/api/v1/cron/status
```

### Manual Testing

Test individual jobs before deployment:

```bash
# Test daily sync
curl -X POST http://localhost:5001/api/v1/cron/trigger/daily-sync

# Check logs
tail -f logs/combined.log | grep CRON
```

## Implementation Details

### Job Classes

- **`HotelbedsSync`** (`src/jobs/hotelbedsSync.job.ts`)
  - Handles data synchronization from Hotelbeds
  - Mutex lock prevents concurrent execution
  - Auto-computes prices after import
  
- **`CheapestPriceJob`** (`src/jobs/cheapestPrice.job.ts`)
  - Recalculates cheapest prices for all hotels
  - Supports full or per-hotel computation
  
- **`CronScheduler`** (`src/jobs/scheduler.ts`)
  - Manages all scheduled tasks
  - Supports graceful shutdown
  - Allows manual job triggering

### Schedule Format

Cron uses standard cron syntax:

```
 ┌────────────── minute (0-59)
 │ ┌──────────── hour (0-23)
 │ │ ┌────────── day of month (1-31)
 │ │ │ ┌──────── month (1-12)
 │ │ │ │ ┌────── day of week (0-6, Sunday=0)
 │ │ │ │ │
 * * * * *
```

Examples:
- `0 2 * * *` - Every day at 2:00 AM
- `0 3 * * 0` - Every Sunday at 3:00 AM
- `0 */6 * * *` - Every 6 hours

## Troubleshooting

### Jobs Not Running

1. Check if cron is enabled:
   ```bash
   grep ENABLE_CRON .env
   # Should show: ENABLE_CRON=true
   ```

2. Check logs for errors:
   ```bash
   tail -f logs/combined.log | grep SCHEDULER
   ```

3. Verify scheduler status:
   ```bash
   curl http://localhost:5001/api/v1/cron/status
   ```

### S3 Integration Issues

If jobs fail with S3 errors:

1. Verify IAM role is attached with `s3Import` feature:
   ```bash
   npm run check-s3-procedure
   ```

2. Check AWS credentials:
   ```bash
   aws s3 ls s3://hotelbed-imports-cache-data/
   ```

3. See `S3_AURORA_SETUP_GUIDE.md` for detailed troubleshooting

### Database Connection Issues

If jobs fail with database errors:

1. Test connection:
   ```bash
   npm run check-database
   ```

2. Verify Aurora cluster is available:
   ```bash
   aws rds describe-db-clusters \
     --db-cluster-identifier hotelbed-aurora-cluster
   ```

3. Check database credentials in `.env`

## Production Deployment

### PM2 Configuration

The project includes PM2 configuration for production:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'hotelbed-backend',
    script: './dist/app.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      ENABLE_CRON: 'true',
    },
  }],
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 logs hotelbed-backend
```

### Recommendations

1. **Monitoring**: Set up alerts for job failures (email, Slack, PagerDuty)
2. **Backups**: Take database snapshots before full sync
3. **Testing**: Test jobs in staging before enabling in production
4. **Logging**: Monitor logs regularly for warnings/errors
5. **Scaling**: Adjust schedules based on data volume and server load

## Next Steps

1. ✅ Enable S3 integration (attach IAM role with `s3Import` feature)
2. ✅ Test import flow with `/api/v1/hotelbed/upload-and-load`
3. ✅ Verify cron jobs start on server boot
4. 🔲 Set up monitoring/alerting
5. 🔲 Configure production PM2 deployment
6. 🔲 Test full sync in staging environment
7. 🔲 Schedule production rollout
