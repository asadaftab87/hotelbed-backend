#!/bin/bash

# S3 Integration Enable Script
# Run this script to enable S3 integration in Aurora MySQL

echo "================================================================================
🔐 ENABLING S3 INTEGRATION IN AURORA
================================================================================
"

# Database credentials (from your setup)
DB_HOST="hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com"
DB_USER="hotelbed"
DB_PASSWORD="Aurora123!Secure"
DB_NAME="hotelbed_db"
IAM_ROLE_ARN="arn:aws:iam::357058555433:role/AuroraS3AccessRole"

echo "📋 Configuration:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo "   IAM Role: $IAM_ROLE_ARN"
echo ""

# Step 1: Verify Aurora MySQL
echo "🔍 Step 1: Verifying Aurora MySQL..."
AURORA_VERSION=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -sN -e "SELECT @@aurora_version;" 2>&1)

if [ $? -eq 0 ]; then
    if [ -n "$AURORA_VERSION" ] && [ "$AURORA_VERSION" != "NULL" ]; then
        echo "✅ Aurora MySQL detected: Version $AURORA_VERSION"
    else
        echo "⚠️  Warning: This might not be Aurora MySQL"
        echo "   S3 integration may not work"
    fi
else
    echo "❌ Error connecting to database"
    echo "$AURORA_VERSION"
    exit 1
fi

echo ""

# Step 2: Enable S3 Integration
echo "🔐 Step 2: Enabling S3 Integration..."
echo "   Adding IAM role: $IAM_ROLE_ARN"

S3_RESULT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "CALL mysql.rds_add_s3_integration_role('$IAM_ROLE_ARN');" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ S3 integration role added successfully!"
else
    echo "❌ Error adding S3 integration role:"
    echo "$S3_RESULT"
    echo ""
    echo "⚠️  Possible issues:"
    echo "   1. IAM role not attached to cluster (check RDS Console)"
    echo "   2. Wait 5-10 minutes after attaching role"
    echo "   3. Wrong ARN or permissions"
    exit 1
fi

echo ""

# Step 3: Verify S3 Integration
echo "🔍 Step 3: Verifying S3 Integration..."
VERIFY_RESULT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT * FROM mysql.aws_s3_integration;" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ S3 Integration verified!"
    echo ""
    echo "Current S3 Integration Roles:"
    echo "$VERIFY_RESULT"
else
    echo "⚠️  Could not verify (table might not exist yet)"
    echo "$VERIFY_RESULT"
fi

echo ""
echo "================================================================================
✅ S3 INTEGRATION ENABLED SUCCESSFULLY!
================================================================================
"
echo "📋 Next Steps:"
echo "   1. Run verification: npm run verify-aurora"
echo "   2. Start app: npm run dev"
echo "   3. Test import: curl http://localhost:5000/api/hotelbed/process"
echo ""

