#!/bin/bash

# Final S3 Integration Setup Script
# This script completes the S3 integration by rebooting the cluster

echo "========================================================================"
echo "🔄 FINAL S3 INTEGRATION SETUP"
echo "========================================================================"
echo ""

# Set AWS credentials
export AWS_ACCESS_KEY_ID=AKIAVGISZFYUZBQ4ERUZ
export AWS_SECRET_ACCESS_KEY="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"
export AWS_DEFAULT_REGION=us-east-1

CLUSTER_ID="hotelbed-aurora-cluster"

# Check current parameter group
echo "1️⃣  Checking current parameter group..."
PARAM_GROUP=$(aws rds describe-db-clusters \
    --db-cluster-identifier $CLUSTER_ID \
    --query 'DBClusters[0].DBClusterParameterGroup' \
    --output text)

echo "   Current parameter group: $PARAM_GROUP"
echo ""

if [ "$PARAM_GROUP" = "hotelbed-aurora-s3-params" ]; then
    echo "✅ Custom parameter group is applied!"
    echo ""
    echo "2️⃣  Now rebooting cluster to apply S3 integration..."
    echo "   ⚠️  This will cause brief downtime (1-2 minutes)"
    echo ""
    
    # Reboot the cluster
    aws rds reboot-db-cluster \
        --db-cluster-identifier $CLUSTER_ID 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Reboot initiated!"
        echo ""
        echo "3️⃣  Waiting for cluster to become available..."
        echo "   This will take 2-3 minutes..."
        echo ""
        
        # Wait for cluster to be available
        MAX_ATTEMPTS=60
        ATTEMPT=0
        
        while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            ATTEMPT=$((ATTEMPT + 1))
            STATUS=$(aws rds describe-db-clusters \
                --db-cluster-identifier $CLUSTER_ID \
                --query 'DBClusters[0].Status' \
                --output text)
            
            echo "   [$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS"
            
            if [ "$STATUS" = "available" ]; then
                echo ""
                echo "✅ Cluster is available!"
                echo ""
                echo "4️⃣  Testing S3 integration..."
                sleep 10
                cd /Users/aliarain/Documents/Projects/hotelbed-backend
                npm run check-s3-procedure
                exit 0
            fi
            
            sleep 5
        done
        
        echo "⚠️  Timeout waiting for cluster"
    else
        echo "❌ Failed to reboot cluster"
    fi
else
    echo "⚠️  Parameter group not yet applied"
    echo ""
    echo "Applying parameter group now..."
    
    aws rds modify-db-cluster \
        --db-cluster-identifier $CLUSTER_ID \
        --db-cluster-parameter-group-name hotelbed-aurora-s3-params \
        --apply-immediately
    
    echo ""
    echo "✅ Parameter group applied!"
    echo "   Now run this script again to reboot the cluster."
fi
