# 🚀 AWS S3 Setup Guide - Complete Step by Step

## Overview
Aapko 3 cheezein setup karni hain:
1. **S3 Bucket** - CSV files store karne ke liye
2. **IAM User** - Node.js app ke liye access keys
3. **IAM Role** - Aurora database ke liye S3 access

---

## 📦 Step 1: S3 Bucket Setup

### 1.1 Login to AWS Console
```
https://console.aws.amazon.com/
```

### 1.2 S3 Service Open Karo
1. Services → Storage → **S3**
2. Ya search mein type karo: **S3**

### 1.3 Create Bucket
**Click:** `Create bucket` button

**Configure:**
```
Bucket name: hotelbed-imports-YOUR-NAME
  Example: hotelbed-imports-zuhaib
  Note: Bucket name globally unique hona chahiye

AWS Region: us-east-1 (or your Aurora region)
  ⚠️ IMPORTANT: Same region as your Aurora database!

Object Ownership:
  ✓ ACLs disabled (recommended)

Block Public Access:
  ✓ Block all public access (checked)
  Note: Bucket private rahega, only Aurora access

Bucket Versioning:
  ○ Disable (not needed)

Tags (Optional):
  Key: Project
  Value: HotelBed

Default encryption:
  ✓ Server-side encryption with Amazon S3 managed keys (SSE-S3)

Advanced settings:
  ○ Object Lock: Disable
```

**Click:** `Create bucket` button (bottom)

✅ **Bucket Created!**

---

## 🔑 Step 2: IAM User Setup (For Node.js App)

### 2.1 Open IAM Service
1. Services → Security, Identity, & Compliance → **IAM**
2. Ya search: **IAM**

### 2.2 Create User
**Left Menu:** Users → **Add users** button

**Step 1: User Details**
```
User name: hotelbed-app-user

AWS credential type:
  ✓ Access key - Programmatic access
```
**Click:** `Next: Permissions`

**Step 2: Set Permissions**
```
Option: Attach existing policies directly

Search & Select:
  ✓ AmazonS3FullAccess
  
  Or (Better - Custom Policy):
  Click "Create policy" → JSON tab
```

**Custom Policy (Recommended):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::hotelbed-imports-zuhaib/*",
        "arn:aws:s3:::hotelbed-imports-zuhaib"
      ]
    }
  ]
}
```
**Save policy with name:** `HotelBedS3Access`

**Click:** `Next: Tags` → `Next: Review` → `Create user`

### 2.3 Save Credentials ⚠️ IMPORTANT!
```
Access key ID: AKIA.....................
Secret access key: wJalrXUtn.....................

⚠️ Download .csv file OR copy both values
⚠️ Secret key sirf ek baar dikhega!
```

**Save these in `.env` file:**
```bash
AWS_ACCESS_KEY_ID=AKIA.....................
AWS_SECRET_ACCESS_KEY=wJalrXUtn.....................
```

✅ **IAM User Created!**

---

## 🔐 Step 3: IAM Role Setup (For Aurora Database)

### 3.1 Create Role for RDS
**IAM Dashboard → Left Menu:** Roles → **Create role**

**Step 1: Select Trusted Entity**
```
Trusted entity type: AWS service
Use case: RDS
  ✓ RDS - Add Role to Database
```
**Click:** `Next`

**Step 2: Add Permissions**
```
Search & Select:
  ✓ AmazonS3ReadOnlyAccess
  
  Or (Better - Custom Policy):
```

**Custom Policy (Recommended):**
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
        "arn:aws:s3:::hotelbed-imports-zuhaib/*",
        "arn:aws:s3:::hotelbed-imports-zuhaib"
      ]
    }
  ]
}
```

**Click:** `Next`

**Step 3: Name and Review**
```
Role name: AuroraS3AccessRole
Description: Allow Aurora to read CSV files from S3 for data import

Tags (Optional):
  Key: Project
  Value: HotelBed
```

**Click:** `Create role`

### 3.2 Copy Role ARN
**After creation, click on role name:**
```
Role ARN: arn:aws:iam::123456789012:role/AuroraS3AccessRole

⚠️ Copy this ARN - Aurora mein use hoga!
```

✅ **IAM Role Created!**

---

## 🗄️ Step 4: Attach Role to Aurora Cluster

> ⚠️ **IMPORTANT:** Ye step **ZAROORI HAI**, chahe aapka database public accessible ho ya na ho!
> 
> **Public Accessibility vs IAM Role:**
> - **Public Access** = Internet se database connect karne ke liye (security setting)
> - **IAM Role** = Aurora ko S3 se data load karne ke liye (required for LOAD DATA FROM S3)
> 
> **Do alag cheezein hain** - even agar database public hai, S3 integration ke liye IAM role attach karna **MUST** hai!

### 4.1 Open RDS Console
1. Services → Database → **RDS**
2. Ya search: **RDS**

### 4.2 Select Your Aurora Cluster
**Left Menu:** Databases → Click on **your Aurora cluster**

### 4.3 Modify Cluster
**Click:** `Modify` button (top right)

**⚠️ Important:** IAM roles section alag hoga!

**Option 1: Connectivity page mein scroll karo**
- Page ko scroll karo neeche
- **"Manage IAM roles"** section dikhega
- Ya **"Additional configuration"** expand karo
- IAM roles wahan hoga

**Option 2: Connectivity & security tab**
- Agar alag tab hai `Connectivity & security` → click karo
- Wahan **"Manage IAM roles"** section milega

**IAM roles section mein:**
```
Feature: s3Import (or S3_INTEGRATION)

Click: "Add role" or "Edit" button

Select: AuroraS3AccessRole
  (The role you created in Step 3)
  
Status: Should show "Available" or your role name
```

**Note:** Agar section nahi dikh raha, to:
1. Page refresh karo
2. Ya browser cache clear karo
3. Ya directly "Connectivity & security" tab check karo

**Scroll to bottom:**
```
☐ Apply immediately (check this if you want immediate effect)
   Otherwise it will apply during maintenance window
```

**Click:** `Continue` → `Modify cluster`

⏳ **Wait:** 5-10 minutes for role to be associated

### 4.4 Verify Role Association
**In RDS Console:**
```
Cluster → Connectivity & security tab
→ Manage IAM roles section
→ Status should be: "Active"
```

✅ **Role Attached to Aurora!**

---

## 🔗 Step 5: Enable S3 Integration in Aurora

### 5.1 Connect to Aurora
```bash
mysql -h your-aurora-cluster.cluster-xxxxx.region.rds.amazonaws.com \
      -u admin -p your_database_name
```

### 5.2 Add S3 Integration Role
```sql
-- Add the IAM role to Aurora
CALL mysql.rds_add_s3_integration_role(
  'arn:aws:iam::123456789012:role/AuroraS3AccessRole'
);

-- Verify role added
SELECT * FROM mysql.aws_s3_integration;
```

**Expected Output:**
```
+--------------------------------------+
| arn                                  |
+--------------------------------------+
| arn:aws:iam::123456789:role/Aurora.. |
+--------------------------------------+
```

✅ **S3 Integration Enabled!**

---

## 📝 Step 6: Configure Your Application

### 6.1 Update `.env` File
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA.....................
AWS_SECRET_ACCESS_KEY=wJalrXUtn.....................
AWS_S3_BUCKET=hotelbed-imports-zuhaib

# Database (Aurora)
DB_HOST=your-aurora-cluster.cluster-xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your_password
DB_NAME=hotelbed_db

# HotelBeds API
HOTELBEDS_API_KEY=your_hotelbed_api_key
HOTELBEDS_BASE_URL=https://api.hotelbeds.com/
HOTELBEDS_CACHE_ENDPOINT=cache/download
HOTELBEDS_UPDATE_ENDPOINT=cache/update
HOTELBEDS_CACHE_TYPE=full
```

### 6.2 Test S3 Connection
```bash
# Install dependencies
npm install

# Start application
npm run dev

# Test S3 upload (will be tested during import)
curl http://localhost:3000/hotelbed/import-only
```

---

## ✅ Step 7: Test Complete Flow

### 7.1 Test S3 Upload
**Node.js test:**
```typescript
import { S3Uploader } from './src/utils/s3Uploader';

const uploader = new S3Uploader('hotelbed-imports-zuhaib');
const canConnect = await uploader.testConnection();
console.log('S3 Connection:', canConnect); // Should be true
```

### 7.2 Test Aurora LOAD DATA FROM S3
**MySQL test:**
```sql
-- Create test table
CREATE TABLE test_import (
  id INT,
  name VARCHAR(100)
);

-- Upload a test CSV to S3 first
-- Then try loading:
LOAD DATA FROM S3 's3://hotelbed-imports-zuhaib/test.csv'
INTO TABLE test_import
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';

-- Check if data loaded
SELECT * FROM test_import;

-- Clean up
DROP TABLE test_import;
```

---

## 🎯 Final Checklist

```
✅ S3 Bucket created (same region as Aurora)
✅ IAM User created with access keys
✅ IAM Role created for Aurora
✅ Role attached to Aurora cluster
✅ S3 integration enabled in Aurora
✅ .env file configured
✅ Application can connect to S3
✅ Aurora can load from S3
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Access Denied" when uploading to S3
**Solution:**
```bash
# Check IAM user has correct permissions
# Verify AWS credentials in .env
# Check bucket name is correct
```

### Issue 2: Aurora can't load from S3
**Solution:**
```sql
-- Check role is active
SELECT * FROM mysql.aws_s3_integration;

-- If empty, add role again:
CALL mysql.rds_add_s3_integration_role(
  'arn:aws:iam::ACCOUNT_ID:role/AuroraS3AccessRole'
);

-- Verify role is attached in RDS console
```

### Issue 3: "LOAD DATA FROM S3 not supported"
**Solution:**
```
⚠️ You need Aurora MySQL, not regular RDS!

Check:
SELECT @@aurora_version;

If NULL = Regular RDS (not supported)
If value = Aurora (supported)
```

### Issue 4: Different region error
**Solution:**
```
S3 bucket and Aurora MUST be in same region!

Change bucket region:
1. Create new bucket in Aurora's region
2. Update bucket name in .env
```

---

## 💰 Cost Estimation

### S3 Storage
```
50GB CSV files (temporary):
- Storage: $0.023/GB/month = $1.15/month
- After import: Delete files = $0
```

### S3 Requests
```
Upload 17 files: ~$0.01
Download by Aurora: Free (same region)
Delete files: Free
```

### Data Transfer
```
Node.js → S3: Free
S3 → Aurora: Free (same region)
```

**Total Cost: ~$0-1 per month** (negligible)

---

## 📞 Support & Troubleshooting

### AWS Documentation
- [S3 User Guide](https://docs.aws.amazon.com/s3/)
- [Aurora S3 Integration](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Integrating.LoadFromS3.html)
- [IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

### Test Commands
```bash
# Test AWS CLI (if installed)
aws s3 ls s3://hotelbed-imports-zuhaib/

# Test upload
aws s3 cp test.csv s3://hotelbed-imports-zuhaib/

# Test download
aws s3 cp s3://hotelbed-imports-zuhaib/test.csv .
```

---

## 🎉 Done!

Your AWS S3 setup is complete! 

**Next Steps:**
1. Run your application: `npm run dev`
2. Test import: `curl http://localhost:3000/hotelbed/import-only`
3. Monitor S3 bucket for CSV uploads
4. Check Aurora for data load

**Target:** 30 minutes for complete import! 🚀

---

**Important Notes:**
- ⚠️ Keep AWS credentials secure
- ⚠️ Never commit `.env` to git
- ⚠️ Use same region for S3 and Aurora
- ⚠️ Delete CSV files from S3 after import (optional)
- ⚠️ Aurora MySQL required (not regular RDS)

Good luck! 🍀

