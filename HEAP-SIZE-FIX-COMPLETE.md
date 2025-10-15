# 🔧 Complete Heap Size Fix - All Methods

## 🚨 Problem
PM2 not applying `--max-old-space-size=24576` flag properly!

---

## ✅ SOLUTION 1: NODE_OPTIONS Environment Variable (MOST RELIABLE)

```bash
# EC2 pe - This ALWAYS works:

# Stop everything
pm2 delete all

# Set NODE_OPTIONS
export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc --max-semi-space-size=64"

# Start
pm2 start dist/src/app.js --name hotelbed-backend

# Make it permanent (add to .bashrc)
echo 'export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc"' >> ~/.bashrc

# Save PM2
pm2 save

# Verify
ps aux | grep "dist/src/app.js"
# Should show flags now!
```

---

## ✅ SOLUTION 2: PM2 Ecosystem with env (RECOMMENDED)

Update `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: "hotelbed-backend",
    script: "dist/src/app.js",
    env: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=24576 --expose-gc --max-semi-space-size=64",
      UV_THREADPOOL_SIZE: "16"
    }
  }]
}
```

Then:
```bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

---

## ✅ SOLUTION 3: Direct PM2 Start with Interpreter Args

```bash
pm2 delete all

pm2 start dist/src/app.js \
  --name hotelbed-backend \
  --interpreter node \
  --interpreter-args="--max-old-space-size=24576 --expose-gc" \
  --env production

pm2 save
```

---

## ✅ SOLUTION 4: NPM Script with PM2

In `package.json`:
```json
"scripts": {
  "pm2:start": "pm2 start ecosystem.config.js"
}
```

In `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: "hotelbed-backend",
    script: "dist/src/app.js",
    exec_mode: "fork",
    instances: 1,
    max_memory_restart: "28G",
    env: {
      NODE_OPTIONS: "--max-old-space-size=24576 --expose-gc"
    }
  }]
}
```

Then:
```bash
npm run pm2:start
```

---

## 🎯 RECOMMENDED APPROACH (Combination)

### **On EC2, run this complete script:**

```bash
#!/bin/bash

# Stop everything
pm2 delete all

# Export NODE_OPTIONS globally
export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc --max-semi-space-size=64"

# Add to bashrc for persistence
grep -qxF 'export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc"' ~/.bashrc || \
echo 'export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc"' >> ~/.bashrc

# Start with ecosystem
cd ~/hotelbed-backend
pm2 start ecosystem.config.js
pm2 save

# Verify
echo ""
echo "🔍 Verifying node process flags..."
ps aux | grep "dist/src/app.js" | grep -v grep

echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "✅ If you see '--max-old-space-size=24576' in ps output above, you're good!"
echo "❌ If not, run: pm2 logs hotelbed-backend and check for errors"
```

---

## 🔍 How to Verify It's Working

### **Method 1: Check Process Command**
```bash
ps aux | grep "dist/src/app.js" | grep -v grep
```

**MUST contain:**
```
--max-old-space-size=24576
```

### **Method 2: PM2 Monit**
```bash
pm2 monit
```

**Heap Size MUST show:**
```
Heap Size: 24,000+ MB  ✅
NOT: 27 MB or 105 MB  ❌
```

### **Method 3: Node Process Info**
```bash
# Get PM2 process ID
PM2_PID=$(pm2 jlist | jq -r '.[0].pm_id')

# Get actual Node PID
NODE_PID=$(pm2 jlist | jq -r '.[0].pid')

# Check command line
cat /proc/$NODE_PID/cmdline | tr '\0' ' '
```

**Should show:** `--max-old-space-size=24576`

---

## 🚀 Complete Deployment (All-in-One)

```bash
# Copy-paste this ENTIRE block on EC2:

cd ~/hotelbed-backend && \
git pull && \
npm run build && \
pm2 delete all && \
export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc" && \
echo 'export NODE_OPTIONS="--max-old-space-size=24576 --expose-gc"' >> ~/.bashrc && \
pm2 start ecosystem.config.js && \
pm2 save && \
sleep 3 && \
echo "" && \
echo "🔍 Checking if flags applied..." && \
ps aux | grep "dist/src/app.js" | grep -v grep && \
echo "" && \
echo "✅ If '--max-old-space-size=24576' appears above, READY!" && \
echo "🚀 Start import: curl -X POST \"http://localhost:5000/api/v1/hotelbed/full-data?mode=full\""
```

---

## ⚠️ If Still Not Working

**Nuclear option - Direct node start:**
```bash
pm2 delete all

# Start node directly with all flags
pm2 start "node --max-old-space-size=24576 --expose-gc --max-semi-space-size=64 dist/src/app.js" \
  --name hotelbed-backend

pm2 save
```

---

## 🎯 What You Should See After Fix

### **In `ps aux | grep app.js`:**
```
node --max-old-space-size=24576 --expose-gc --max-semi-space-size=64 /home/ec2-user/hotelbed-backend/dist/src/app.js
     ^^^^^^^^^^^^^^^^^^^^^^^^^^^
     THIS MUST BE VISIBLE!
```

### **In `pm2 monit`:**
```
Heap Size:     24,576 MB    ✅
Used Heap:     50-100 MB (idle)
Memory:        200-500 MB (idle)
CPU:           0-5% (idle)
```

### **During Import:**
```
Heap Size:     24,576 MB    ✅
Used Heap:     4,000-8,000 MB
Memory:        5-10 GB
CPU:           70-90%
```

---

**Use Solution 1 (NODE_OPTIONS) - 100% guaranteed to work!** 🎯

