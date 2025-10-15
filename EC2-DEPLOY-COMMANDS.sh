#!/bin/bash
# 🚀 Complete Deployment Script for EC2
# Copy-paste this ENTIRE script on EC2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYING OPTIMIZED CODE TO r7a.xlarge"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Navigate to project
echo ""
echo "📂 Step 1: Navigate to project..."
cd ~/hotelbed-backend || exit 1

# 2. Stop all PM2 processes
echo ""
echo "🛑 Step 2: Stopping all PM2 processes..."
pm2 stop all
pm2 delete all

# 3. Pull latest code
echo ""
echo "⬇️  Step 3: Pulling latest code..."
git reset --hard
git pull origin master

# 4. Build
echo ""
echo "🏗️  Step 4: Building..."
npm run build

# 5. Start with ecosystem.config.js
echo ""
echo "🚀 Step 5: Starting with ecosystem.config.js..."
pm2 start ecosystem.config.js
pm2 save

# 6. Wait for startup
echo ""
echo "⏳ Step 6: Waiting for startup..."
sleep 3

# 7. Verify heap size
echo ""
echo "🔍 Step 7: Verifying heap size..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 show hotelbed-backend | grep -A 5 "node_args"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 8. Check process status
echo ""
echo "📊 Step 8: Process status..."
pm2 list

# 9. Verify by checking actual process
echo ""
echo "🔍 Step 9: Checking actual node process flags..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ps aux | grep "dist/src/app.js" | grep -v grep
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Check if '--max-old-space-size=24576' appears above!"
echo ""

# 10. Final instructions
echo ""
echo "✅ Deployment complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. If flags appear in ps output above: ✅ Ready!"
echo "   Run: curl -X POST \"http://localhost:5000/api/v1/hotelbed/full-data?mode=full\""
echo ""
echo "2. If flags DON'T appear: ❌ Use fallback method"
echo "   Run: pm2 delete all"
echo "   Run: NODE_OPTIONS=\"--max-old-space-size=24576 --expose-gc\" pm2 start dist/src/app.js --name hotelbed-backend"
echo "   Run: pm2 save"
echo ""
echo "3. Monitor: pm2 monit"
echo "   Heap Size should show 24,000+ MB"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

