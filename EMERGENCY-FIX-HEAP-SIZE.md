# 🚨 EMERGENCY FIX - Heap Size Not Applied

## Problem
PM2 is using ~7GB heap instead of 28GB!

## Quick Fix - Run These Commands on EC2

```bash
# 1. Stop PM2
pm2 stop hotelbed-backend

# 2. Delete the process completely
pm2 delete hotelbed-backend

# 3. Verify ecosystem.config.js exists
cat ecosystem.config.js

# Should show:
# --max-old-space-size=28672

# 4. Start with ecosystem.config.js explicitly
pm2 start ecosystem.config.js

# 5. Verify heap size is applied
pm2 logs hotelbed-backend --lines 5

# 6. Save config
pm2 save

# 7. Verify running
pm2 list
```

## Verify Heap Size
```bash
pm2 show hotelbed-backend | grep "node_args"

# Should show: --max-old-space-size=28672
```

## Alternative: Start Manually with Heap Flag
```bash
# If ecosystem.config.js not working:
pm2 delete hotelbed-backend

pm2 start dist/src/app.js \
  --name hotelbed-backend \
  --node-args="--max-old-space-size=28672" \
  -i 1

pm2 save
```

## Verify It's Working
```bash
# Should see much higher memory limit in logs if it crashes again
pm2 logs hotelbed-backend --lines 20
```

