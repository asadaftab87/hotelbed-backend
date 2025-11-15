#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "================================================"
echo "🔄 Waiting for S3 Integration to Activate"
echo "================================================"
echo ""

# Set AWS credentials
export AWS_ACCESS_KEY_ID=AKIAVGISZFYUZBQ4ERUZ
export AWS_SECRET_ACCESS_KEY="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"
export AWS_DEFAULT_REGION=us-east-1

CLUSTER_ID="hotelbed-aurora-cluster"
MAX_ATTEMPTS=30
ATTEMPT=0

echo -e "${YELLOW}⏳ Waiting for cluster to become available...${NC}"
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    STATUS=$(aws rds describe-db-clusters \
        --db-cluster-identifier $CLUSTER_ID \
        --query 'DBClusters[0].Status' \
        --output text 2>&1)
    
    echo "[$ATTEMPT/$MAX_ATTEMPTS] Cluster status: $STATUS"
    
    if [ "$STATUS" = "available" ]; then
        echo ""
        echo -e "${GREEN}✅ Cluster is available!${NC}"
        echo ""
        
        # Check if role has feature name
        echo "Checking if role has s3Import feature..."
        FEATURE=$(aws rds describe-db-clusters \
            --db-cluster-identifier $CLUSTER_ID \
            --query 'DBClusters[0].AssociatedRoles[0].FeatureName' \
            --output text 2>&1)
        
        if [ "$FEATURE" = "s3Import" ] || [ "$FEATURE" = "S3_INTEGRATION" ]; then
            echo -e "${GREEN}✅ Role has feature name: $FEATURE${NC}"
            echo ""
            echo "Now trying to add role with s3Import feature..."
            
            # Try to add role with feature name
            aws rds add-role-to-db-cluster \
                --db-cluster-identifier $CLUSTER_ID \
                --role-arn arn:aws:iam::357058555433:role/AuroraS3AccessRole \
                --feature-name s3Import \
                --region us-east-1 2>&1
            
            RESULT=$?
            if [ $RESULT -eq 0 ]; then
                echo -e "${GREEN}✅ Role added successfully!${NC}"
                echo ""
                echo "Waiting 60 seconds for AWS to propagate changes..."
                sleep 60
                echo ""
                echo "Testing S3 integration..."
                cd /Users/aliarain/Documents/Projects/hotelbed-backend
                npm run check-s3-procedure
                exit 0
            else
                echo -e "${RED}❌ Failed to add role${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Role has no feature name (or different feature)${NC}"
            echo "Feature value: $FEATURE"
            echo ""
            echo "Trying to add role with s3Import feature..."
            
            # Try to add role with feature name
            aws rds add-role-to-db-cluster \
                --db-cluster-identifier $CLUSTER_ID \
                --role-arn arn:aws:iam::357058555433:role/AuroraS3AccessRole \
                --feature-name s3Import \
                --region us-east-1 2>&1
            
            RESULT=$?
            if [ $RESULT -eq 0 ]; then
                echo -e "${GREEN}✅ Role added successfully!${NC}"
                echo ""
                echo "Waiting 60 seconds for AWS to propagate changes..."
                sleep 60
                echo ""
                echo "Testing S3 integration..."
                cd /Users/aliarain/Documents/Projects/hotelbed-backend
                npm run check-s3-procedure
                exit 0
            else
                echo -e "${YELLOW}⚠️  Role might already be attached${NC}"
                echo "Waiting 60 seconds and testing anyway..."
                sleep 60
                echo ""
                cd /Users/aliarain/Documents/Projects/hotelbed-backend
                npm run check-s3-procedure
                exit 0
            fi
        fi
        
        break
    fi
    
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        echo "   Waiting 10 seconds..."
        echo ""
        sleep 10
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo ""
    echo -e "${RED}❌ Timeout waiting for cluster to become available${NC}"
    echo "Current status: $STATUS"
    exit 1
fi
