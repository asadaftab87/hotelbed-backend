#!/bin/bash

echo "========================================================================"
echo "⏳ MONITORING AURORA REBOOT & TESTING S3 INTEGRATION"
echo "========================================================================"
echo ""

export AWS_ACCESS_KEY_ID=AKIAVGISZFYUZBQ4ERUZ
export AWS_SECRET_ACCESS_KEY="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"
export AWS_DEFAULT_REGION=us-east-1

INSTANCE1="hotelbed-aurora-cluster-instance-1"
INSTANCE2="hotelbed-aurora-cluster-instance-1-rds"

echo "Waiting for instances to reboot..."
echo ""

MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    STATUS1=$(aws rds describe-db-instances --db-instance-identifier $INSTANCE1 --query 'DBInstances[0].DBInstanceStatus' --output text 2>&1)
    STATUS2=$(aws rds describe-db-instances --db-instance-identifier $INSTANCE2 --query 'DBInstances[0].DBInstanceStatus' --output text 2>&1)
    
    echo "[$ATTEMPT/$MAX_ATTEMPTS] Writer: $STATUS1 | Reader: $STATUS2"
    
    if [ "$STATUS1" = "available" ] && [ "$STATUS2" = "available" ]; then
        echo ""
        echo "✅ Both instances are available!"
        echo ""
        echo "Waiting 10 more seconds for full initialization..."
        sleep 10
        echo ""
        echo "========================================================================"
        echo "🧪 TESTING S3 INTEGRATION"
        echo "========================================================================"
        echo ""
        
        cd /Users/aliarain/Documents/Projects/hotelbed-backend
        npm run check-s3-procedure
        
        echo ""
        echo "========================================================================"
        echo "🎉 SETUP COMPLETE!"
        echo "========================================================================"
        echo ""
        echo "Next steps:"
        echo "1. Test the upload-and-load endpoint:"
        echo "   curl -X POST http://localhost:5001/api/v1/hotelbed/upload-and-load"
        echo ""
        echo "2. Start the server with cron jobs:"
        echo "   pnpm dev"
        echo ""
        exit 0
    fi
    
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        sleep 5
    fi
done

echo ""
echo "⚠️  Timeout waiting for instances to become available"
echo "Current status: Writer=$STATUS1, Reader=$STATUS2"
