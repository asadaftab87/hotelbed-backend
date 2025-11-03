# 🔧 S3 Integration Manual Enable Steps

## ❌ Current Error:
```
S3 API returned error: Both aurora_load_from_s3_role and aws_default_s3_role are not specified
```

**Issue:** Procedure `mysql.rds_add_s3_integration_role` abhi available nahi hai.

---

## ✅ Solution: DBeaver Se Manual Enable

### **Step 1: DBeaver Mein Connect**

**DBeaver:**
- Connection: hotelbed-aurora-cluster
- Database: hotelbed_db

---

### **Step 2: Check Available Procedures**

**DBeaver SQL Editor mein ye run karo:**

```sql
-- Check if procedure exists:
SHOW PROCEDURE STATUS WHERE Db = 'mysql' AND Name LIKE '%s3%';

-- Or check all mysql procedures:
SHOW PROCEDURE STATUS WHERE Db = 'mysql';
```

**Expected:** 
- Agar procedure dikh rahi hai → Step 3
- Agar nahi dikh rahi → Step 4 (Wait or RDS check)

---

### **Step 3: Enable S3 Integration (If Procedure Exists)**

**Agar procedure dikh rahi hai:**

```sql
-- Enable S3 integration:
CALL mysql.rds_add_s3_integration_role(
  'arn:aws:iam::357058555433:role/AuroraS3AccessRole'
);

-- Verify:
SELECT * FROM mysql.aws_s3_integration;
```

**Expected Output:**
```
┌──────────────────────────────────────────────────┐
│  arn                                             │
├──────────────────────────────────────────────────┤
│  arn:aws:iam::357058555433:role/AuroraS3...    │
└──────────────────────────────────────────────────┘
```

---

### **Step 4: Agar Procedure Nahi Hai**

**Option A: Wait (If Role Just Attached)**
```
⏳ Wait: 10-15 minutes after role attachment
🔄 Retry: npm run enable-s3
```

**Option B: RDS Console Check**
```
1. RDS Console → Aurora cluster
2. Connectivity & security tab
3. Manage IAM roles section
4. Check:
   - Role: AuroraS3AccessRole
   - Status: Active ✅ (not Inactive)
   - Feature: s3Import selected
```

**Agar Status "Inactive" ya "Modifying":**
- Wait till "Active"
- Phir procedure enable karo

---

## 🧪 After Enabling: Re-test

**Terminal mein:**
```bash
npm run test-s3-aurora
```

**Expected:**
```
✅ S3 Integration Enabled
✅ LOAD DATA FROM S3 SUCCESSFUL!
✅ S3 → AURORA CONNECTION TEST PASSED!
```

---

## 📋 Quick Commands (DBeaver):

```sql
-- 1. Check procedure:
SHOW PROCEDURE STATUS WHERE Db = 'mysql' AND Name LIKE '%s3%';

-- 2. Enable (if exists):
CALL mysql.rds_add_s3_integration_role(
  'arn:aws:iam::357058555433:role/AuroraS3AccessRole'
);

-- 3. Verify:
SELECT * FROM mysql.aws_s3_integration;

-- 4. Test (after enable):
LOAD DATA FROM S3 's3://hotelbed-imports-cache-data/hotelbed-csv/test_aurora_s3.csv'
INTO TABLE test_s3_import
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

---

**DBeaver se ye steps follow karo aur batao - procedure dikh rahi hai ya nahi?** 🚀


