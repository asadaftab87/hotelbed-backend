# 🚀 Deploy to r7a.xlarge - Step by Step Guide

## ✅ What's Ready

Your code is now optimized for **r7a.xlarge (32GB RAM)**:

```typescript
✅ PARSE_CHUNK = 10,000     (10k files parallel)
✅ INSERT_BATCH = 15,000    (15k records per query)
✅ PARALLEL_TABLES = 3      (3 tables in parallel)
✅ connectionLimit = 100    (100 DB connections)
✅ Heap Size = 28GB         (28GB for Node.js)
```

**Expected Performance:**
```
⏱️  Processing time: 5-6 minutes
💾 Memory usage: 12-15 GB (plenty of headroom!)
🚀 NO FREEZING!
```

---

## 📋 Deployment Steps

### **Step 1: SSH into EC2**
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### **Step 2: Navigate to project**
```bash
cd ~/hotelbed-backend
# or wherever your project is
```

### **Step 3: Pull latest code**
```bash
git status
git pull
```

### **Step 4: Install dependencies (if needed)**
```bash
npm install
```

### **Step 5: Build on server**
```bash
npm run build
```

### **Step 6: Restart PM2 with new config**
```bash
# Delete old process
pm2 delete hotelbed-backend

# Start with new ecosystem config (28GB heap)
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
```

### **Step 7: Verify it's running**
```bash
pm2 list
pm2 logs hotelbed-backend --lines 50
```

You should see:
```
✅ Server running
✅ MySQL connected
✅ No errors
```

---

## 🔍 Monitor During Import

### **Terminal 1: PM2 Real-time Monitor**
```bash
pm2 monit
```
This shows:
- Memory usage (should stay 12-15GB)
- CPU usage
- Logs

### **Terminal 2: RAM Monitor**
```bash
watch -n 2 "free -h && echo '' && ps aux --sort=-%mem | head -5"
```
Updates every 2 seconds showing:
- Total RAM usage
- Top memory processes

### **Terminal 3: API Call**
```bash
curl -X POST "http://localhost:5000/api/v1/hotelbed/full-data?mode=full"
```

---

## 📊 What to Expect

### **Timeline (154,544 files):**
```
✅ Download ZIP:        ~2-3 min
✅ Extract:             ~30-60 sec
✅ Process GENERAL:     ~30 sec (24,626 hotels)
✅ Collect files:       ~3 sec
⚡ Parse 154,544 files: ~3-4 min  (16 batches of 10k)
⚡ Insert to DB:        ~90 sec   (3 tables parallel)
⚡ Build Inventory:     ~30 sec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  TOTAL: ~5-6 minutes 🚀
```

### **Memory Pattern:**
```
Start:          ~500 MB
Parsing:        ~12-15 GB (peak)
Inserting:      ~8-10 GB
After complete: ~500 MB
```

### **CPU Pattern:**
```
Download:  20-30%
Parsing:   80-95% (good - full utilization!)
Inserting: 40-60%
```

---

## ✅ Success Indicators

**Look for these in logs:**
```
✅ Found GENERAL folder
✅ HotelMaster: 24,626 hotels loaded
✅ BoardMaster: X boards loaded
✅ Found 154544 CONTRACT files to process
✅ Parsed 154544 files in X.Xs
✅ All data inserted!
✅ Inventory table built
```

**Check database:**
```bash
mysql -h 107.21.156.43 -u asadaftab -p hotelbed
```

```sql
SELECT COUNT(*) FROM HotelMaster;      -- Should be 24,626
SELECT COUNT(*) FROM BoardMaster;      -- Should be ~40-50
SELECT COUNT(*) FROM Contract;         -- Should be 150k+
SELECT COUNT(*) FROM Cost;             -- Should be 500k+
SELECT COUNT(*) FROM Inventory;        -- Should be 300k+
```

---

## 🚨 If Something Goes Wrong

### **Memory Still High?**
```bash
# Check memory
free -h

# If stuck above 28GB, restart:
pm2 restart hotelbed-backend
```

### **Process Hanging?**
```bash
# Check logs
pm2 logs hotelbed-backend --lines 100

# Check if parsing stuck
# Should see "Parsed X/154544 files..." increasing
```

### **Connection Errors?**
```bash
# Test DB connection
mysql -h 107.21.156.43 -u asadaftab -p -e "SELECT 1"

# Check connection limit
mysql -h 107.21.156.43 -u asadaftab -p -e "SHOW VARIABLES LIKE 'max_connections'"
```

---

## 🎯 Quick Commands Reference

```bash
# Deploy
cd ~/hotelbed-backend
git pull
npm run build
pm2 delete hotelbed-backend
pm2 start ecosystem.config.js
pm2 save

# Monitor
pm2 monit                    # Real-time monitoring
pm2 logs hotelbed-backend    # Live logs
free -h                      # RAM check
htop                         # System monitor

# Test import
curl -X POST "http://localhost:5000/api/v1/hotelbed/full-data?mode=full"

# Check database
mysql -h 107.21.156.43 -u asadaftab -p hotelbed -e "SELECT COUNT(*) FROM HotelMaster"
```

---

## 💡 Pro Tips

### **1. Run in Screen/Tmux (Recommended)**
```bash
# Install screen
sudo yum install screen -y

# Start screen session
screen -S import

# Run import
curl -X POST "http://localhost:5000/api/v1/hotelbed/full-data?mode=full"

# Detach: Ctrl+A then D
# Reattach: screen -r import
```

### **2. Save Logs**
```bash
pm2 logs hotelbed-backend > import-log-$(date +%Y%m%d-%H%M).txt
```

### **3. Benchmark**
```bash
# Note start time
date

# Run import
curl -X POST "http://localhost:5000/api/v1/hotelbed/full-data?mode=full"

# Note end time
date

# Calculate duration
```

---

## 📈 Expected Results

### **Before (c7a.xlarge - 8GB):**
```
❌ Status: FREEZE
❌ Time: Never completed
❌ Memory: 7.8GB+ crash
```

### **After (r7a.xlarge - 32GB):**
```
✅ Status: SMOOTH
✅ Time: 5-6 minutes
✅ Memory: 12-15GB stable
✅ CPU: 80-95% utilized
✅ No freezing!
```

---

## 🎉 Final Checklist

Before starting:
- [ ] Code pulled from git
- [ ] npm run build completed
- [ ] PM2 restarted with new config
- [ ] pm2 list shows running
- [ ] Monitoring tools ready (pm2 monit, free -h)

After completion:
- [ ] All tables populated
- [ ] HotelMaster has 24,626 records
- [ ] No errors in logs
- [ ] Memory back to ~500MB
- [ ] APIs returning data

---

## 🚀 You're Ready!

**Your r7a.xlarge is now configured for MAXIMUM PERFORMANCE!**

Settings Summary:
```
Instance:  r7a.xlarge
RAM:       32 GB
vCPUs:     4
Heap:      28 GB
Parse:     10k parallel
Insert:    15k batch
Expected:  5-6 minutes

Status: 🟢 PRODUCTION READY
```

**Ab deploy karo aur enjoy karo fast processing!** 🎉

Agar koi issue aaye to turant batana, main help karunga! 💪

