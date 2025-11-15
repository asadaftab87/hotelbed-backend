# Quick Start Guide

## 🚦 Current Status: Almost Ready!

**✅ Completed**: Core implementation, cron jobs, API endpoints  
**⏳ Blocked by**: S3 Integration (15 minutes to fix)  
**📊 Progress**: ~75% complete (18/26 hours done)

---

## 🔥 Critical: Fix S3 Integration First

**Problem**: Aurora cannot load CSV files from S3

**Solution** (Execute these commands):

```bash
# 1. Configure AWS CLI with main account credentials
export AWS_ACCESS_KEY_ID=AKIAVGISZFYUZBQ4ERUZ
export AWS_SECRET_ACCESS_KEY=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
export AWS_DEFAULT_REGION=us-east-1

# 2. Remove existing role
aws rds remove-role-from-db-cluster \
  --db-cluster-identifier hotelbed-aurora-cluster \
  --role-arn arn:aws:iam::357058555433:role/AuroraS3AccessRole \
  --region us-east-1

# 3. Re-add with s3Import feature (THIS IS CRITICAL!)
aws rds add-role-to-db-cluster \
  --db-cluster-identifier hotelbed-aurora-cluster \
  --role-arn arn:aws:iam::357058555433:role/AuroraS3AccessRole \
  --feature-name s3Import \
  --region us-east-1

# 4. Wait 10-15 minutes for AWS propagation
echo "Waiting for S3 integration to activate..."
sleep 900

# 5. Verify it worked
npm run check-s3-procedure
```

**Expected Output**:
```
✅ Aurora MySQL detected (version 3.08.2)
✅ Procedure exists
✅ S3 integration enabled
✅ IAM role configured
```

---

## 🚀 Start the Server

```bash
# Install dependencies (if not already done)
pnpm install

# Start the server
pnpm dev

# Or with PM2 (production)
pm2 start ecosystem.config.js
```

**Server will start on**: http://localhost:5001

**Logs will show**:
```
✅ MySQL Database connected
✅ Redis connected (or skipped if disabled)
✅ Cron scheduler initialized
🚀 Server listening on port 5001
```

---

## 🧪 Test the System

### 1. Health Check

```bash
curl http://localhost:5001/api/v1/monitoring/health
```

Expected: `{"status": "healthy", ...}`

### 2. Check Cron Status

```bash
curl http://localhost:5001/api/v1/cron/status
```

Expected: 3 jobs running (dailySync, weeklyFullSync, priceComputation)

### 3. Upload and Load CSV Files

```bash
curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load
```

This will:
- Upload all CSV files from `downloads/csv_output/` to S3
- Load them into Aurora database
- Compute cheapest prices

**Duration**: 5-10 minutes (depending on data size)

### 4. Verify Data Imported

```bash
# Check row counts
curl http://localhost:5001/api/v1/hotelbed/stats

# Or query database directly
mysql -h hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com \
  -u hotelbed -p'Aurora123!Secure' hotelbed_db \
  -e "SELECT COUNT(*) FROM hotels; SELECT COUNT(*) FROM cheapest_pp;"
```

### 5. Test Cron Job Manually

```bash
# Trigger price computation
curl -X POST http://localhost:5001/api/v1/cron/trigger/price-computation

# Check logs
tail -f logs/combined.log | grep CRON
```

---

## 📋 API Endpoints

### Data Import

```bash
# Upload and load CSVs
POST /api/v1/hotelbed/upload-and-load

# Download and process Hotelbeds cache
POST /api/v1/hotelbed/download-cache

# Download incremental update
POST /api/v1/hotelbed/download-update
```

### Cron Management

```bash
# Get cron status
GET /api/v1/cron/status

# Trigger daily sync
POST /api/v1/cron/trigger/daily-sync

# Trigger weekly sync
POST /api/v1/cron/trigger/weekly-sync

# Trigger price computation
POST /api/v1/cron/trigger/price-computation
```

### Monitoring

```bash
# Health check
GET /api/v1/monitoring/health

# Detailed health
GET /api/v1/monitoring/health/detailed

# System metrics
GET /api/v1/monitoring/metrics

# App statistics
GET /api/v1/monitoring/stats
```

---

## 🔧 Configuration

### Environment Variables

Key settings in `.env`:

```env
# Database
DB_HOST=hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com
DB_USER=hotelbed
DB_PASSWORD=Aurora123!Secure
DB_NAME=hotelbed_db

# AWS S3 (for Aurora S3 integration)
AWS_ACCESS_KEY_ID=AKIAVGISZFYUW4NB2JXI
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_S3_BUCKET=hotelbed-imports-cache-data

# Cron Jobs
ENABLE_CRON=true

# Redis (optional)
ENABLE_REDIS=false
```

### Cron Schedule

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Sync | 2:00 AM UTC | Incremental updates |
| Weekly Sync | Sunday 3:00 AM | Full refresh |
| Price Compute | Every 6 hours | Recalculate prices |

---

## 🐛 Troubleshooting

### S3 Integration Not Working

```bash
# Run diagnostic
npm run diagnose-s3

# Check IAM role
aws rds describe-db-clusters \
  --db-cluster-identifier hotelbed-aurora-cluster \
  --query 'DBClusters[0].AssociatedRoles'
```

### Cron Jobs Not Running

```bash
# Check if enabled
grep ENABLE_CRON .env

# Check logs
tail -f logs/combined.log | grep SCHEDULER

# Get status
curl http://localhost:5001/api/v1/cron/status
```

### Database Connection Issues

```bash
# Test connection
npm run check-database

# Verify credentials
mysql -h hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com \
  -u hotelbed -p'Aurora123!Secure' hotelbed_db \
  -e "SELECT 1;"
```

---

## 📖 Documentation

- **`CRON_JOBS.md`** - Detailed cron job documentation
- **`PROJECT_STATUS.md`** - Current project status
- **`S3_AURORA_SETUP_GUIDE.md`** - S3 integration troubleshooting
- **`TASKS.md`** - Complete task breakdown
- **`API_ENDPOINTS_AND_CHEAPEST_LOGIC.md`** - API reference

---

## ⏱️ What's Next

1. **Fix S3 Integration** (15 min) - Execute commands above
2. **Test Import Flow** (30 min) - Upload and load CSVs
3. **Verify Cron Jobs** (15 min) - Trigger manually and check logs
4. **Set Up Monitoring** (2 hours) - Alerts, health checks
5. **Production Deploy** (2-4 hours) - PM2, staging, rollout

**Total Time to Production**: ~6-8 hours

---

## 🎯 Success Criteria

✅ S3 integration working (Aurora can load from S3)  
✅ All CSV files imported successfully  
✅ Cheapest prices computed  
✅ Cron jobs running on schedule  
✅ API endpoints responding correctly  
✅ Monitoring and alerting configured  

---

## 💡 Tips

1. **Always check S3 integration first** - This is the most common issue
2. **Monitor logs** - Use `tail -f logs/combined.log` to watch activity
3. **Test incrementally** - Don't run full sync until incremental works
4. **Use manual triggers** - Test cron jobs via API before relying on schedule
5. **Keep backups** - Take database snapshots before full sync

---

**Need Help?** See detailed documentation in `CRON_JOBS.md` and `S3_AURORA_SETUP_GUIDE.md`
