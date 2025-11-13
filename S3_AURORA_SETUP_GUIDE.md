# 🔧 Aurora + S3 Integration Setup Guide

## 📋 Current Issue

You're seeing this warning:
```
⚠️  S3 Integration Issue: Make sure IAM role is attached and procedure is enabled
Run: npm run enable-s3
Loading hotel_tax_info...
🔍 Executing LOAD DATA FROM S3: s3://hotelbed-imports-cache-data/hotelbed-csv/hotel_tax_info.csv
```

**This means:** Aurora DB cannot access S3 bucket because the IAM role is not properly attached.

---

## ✅ Your Current Setup (from .env)

```
DB_HOST=hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com
DB_USER=hotelbed
DB_PASSWORD=Aurora123!Secure
DB_NAME=hotelbed_db

AWS_ACCESS_KEY_ID=AKIAVGISZFYUW4NB2JXI
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=us-east-1
AWS_S3_BUCKET=hotelbed-imports-cache-data
```

✅ Database credentials: **CONFIGURED**  
✅ AWS credentials: **CONFIGURED**  
✅ S3 bucket name: **CONFIGURED**  
❌ Aurora S3 Integration: **NOT ENABLED** ← This is the problem!

---

## 🎯 Solution: Enable Aurora S3 Integration

### Option 1: Automatic Fix (Recommended)

Run this command:

```bash
npm run enable-s3
```

This script will:
1. Connect to your Aurora cluster
2. Check if S3 integration exists
3. Create IAM role if needed
4. Attach IAM role to Aurora cluster
5. Enable `LOAD DATA FROM S3` feature

**Expected Output:**
```
✅ Aurora cluster found
✅ IAM role created/exists
✅ IAM role attached to cluster
✅ S3 integration enabled
```

### Option 2: Manual AWS Console Setup

If the automatic script doesn't work, do this in AWS Console:

#### Step 1: Create IAM Role

1. Go to **IAM Console** → **Roles** → **Create Role**
2. Select: **AWS Service** → **RDS** → **RDS - Add Role to Database**
3. Click **Next: Permissions**
4. Attach policy: **AmazonS3FullAccess** (or create custom policy below)
5. Role name: `AuroraS3AccessRole`
6. Create role

**Custom Policy (More Secure):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::hotelbed-imports-cache-data/*",
        "arn:aws:s3:::hotelbed-imports-cache-data"
      ]
    }
  ]
}
```

#### Step 2: Attach Role to Aurora Cluster

1. Go to **RDS Console** → **Databases**
2. Select cluster: `hotelbed-aurora-cluster`
3. Click **Modify**
4. Scroll to **Connectivity** → **Additional configuration**
5. Under **Associated roles**, click **Add role**
6. Select role: `AuroraS3AccessRole`
7. Feature: **s3Import**
8. Click **Continue** → **Apply immediately** → **Modify cluster**

**Wait 5-10 minutes** for the role to be attached.

#### Step 3: Verify S3 Integration

Run this command to check:

```bash
npm run diagnose-s3
```

Or manually connect to your database and run:

```sql
SELECT * FROM mysql.aws_s3_integration LIMIT 1;
```

If you see results, S3 is enabled! ✅

---

## 🚀 Alternative: Use Standard LOAD DATA (No S3 Required)

If you don't want to set up S3 integration, I can modify the code to use standard MySQL `LOAD DATA LOCAL INFILE` instead.

**Pros:**
- No AWS IAM setup needed
- Works with any MySQL database
- Simpler setup

**Cons:**
- Slower (uploads file to server first)
- Requires MySQL `local_infile` enabled

Let me know if you want me to implement this alternative!

---

## 🧪 Test Connection

After enabling S3, test with:

```bash
# Test S3 upload
npm run test-s3

# Test Aurora connection
npm run test-s3-aurora

# Full diagnostic
npm run diagnose-s3
```

---

## 📝 Quick Troubleshooting

### Error: "Access Denied" when loading from S3

**Cause:** IAM role not attached or missing permissions

**Fix:**
```bash
# Check attached roles
npm run check-roles

# Try using auto-generated role
npm run try-auto-role
```

### Error: "Table 'mysql.aws_s3_integration' doesn't exist"

**Cause:** S3 integration feature not enabled on Aurora

**Fix:**
1. Verify you're using **Aurora MySQL** (not RDS MySQL)
2. Aurora version must be **5.7.12+** or **8.0.23+**
3. Follow "Manual AWS Console Setup" above

### Error: "Unknown system variable 'aws_default_s3_region'"

**Cause:** Not using Aurora or old Aurora version

**Fix:** Upgrade Aurora cluster or use alternative method (LOAD DATA LOCAL INFILE)

---

## 🔍 Debug Commands

```bash
# Find your Aurora instances
npm run find-instances

# Check what roles are attached
npm run check-roles

# Diagnose S3 issues
npm run diagnose-s3

# Wait and check S3 (useful after modifying cluster)
npm run wait-check-s3

# Check if S3 procedure exists
npm run check-s3-procedure
```

---

## 💡 Alternative Solution: I Can Help Deploy New Aurora Cluster

Since you mentioned "i already have the aws cli config with my acc you can also create the aurora db", I can:

1. **Create a new Aurora cluster** with S3 integration pre-configured
2. **Set up all IAM roles** automatically
3. **Configure proper security groups**
4. **Test the connection**
5. **Update your .env** file

Would you like me to create a deployment script to set this up from scratch?

---

## 📞 What Should You Do Now?

**Choose ONE option:**

### Option A: Fix Current Aurora Cluster (Fastest)
```bash
npm run enable-s3
```
Then wait 5-10 minutes for AWS to apply changes.

### Option B: Manual IAM Setup (Most Control)
Follow the "Manual AWS Console Setup" steps above.

### Option C: Deploy New Aurora Cluster (Clean Start)
Tell me to create deployment scripts using your AWS credentials.

### Option D: Switch to Local File Loading (No S3)
I can modify the code to not require S3 at all.

---

## 🎯 Recommended Next Steps

1. **First, try the automatic fix:**
   ```bash
   npm run enable-s3
   ```

2. **If that fails, check your cluster:**
   ```bash
   npm run diagnose-s3
   npm run check-roles
   ```

3. **If still having issues, let me know and I can:**
   - Create a deployment script for new Aurora cluster
   - Modify code to use alternative loading method
   - Debug your specific AWS setup

---

**Let me know which option you prefer, and I'll guide you through it!** 🚀
