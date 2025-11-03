# 🔄 Cluster Reboot - S3 Integration Fix

## ✅ Discovery:
Aurora MySQL mein S3 variables exist karte hain but **EMPTY** hain:
```
aurora_load_from_s3_role: '' (should have ARN)
aws_default_s3_role: '' (should have ARN)
```

**This means:** IAM role attached hai, but Aurora ne usko recognize nahi kiya hai.

---

## 🔧 SOLUTION: Instance Reboot (Aurora Cluster)

**Note:** Aurora clusters mein direct reboot button nahi hota. Individual **instances** ko reboot karna padta hai.

### **Step 1: RDS Console Mein Instance Reboot**

**Option A: Via Console**
```
1. AWS RDS Console
2. Databases (left menu)
3. Cluster: hotelbed-aurora-cluster → "Instances" tab click karo
4. Select WRITER instance (usually: hotelbed-aurora-instance-1 or similar)
5. Actions → Reboot
6. Confirm reboot
7. Wait 5-10 minutes for reboot to complete
```

**Option B: Via AWS CLI** (Terminal se)
```bash
# Pehle instance name find karo:
aws rds describe-db-clusters \
  --db-cluster-identifier hotelbed-aurora-cluster \
  --query 'DBClusterMembers[*].[DBInstanceIdentifier,IsClusterWriter]' \
  --output table

# Writer instance ko reboot karo:
aws rds reboot-db-instance \
  --db-instance-identifier <WRITER_INSTANCE_NAME>
```

**Important:** 
- ✅ **WRITER instance** reboot karo (Reader nahi)
- ⏳ Wait for status to become "Available"
- ⚠️ Writer reboot se cluster temporarily unavailable ho sakta hai (2-5 minutes)

---

### **Step 2: After Reboot - Check Procedure**

Terminal mein:
```bash
npm run check-s3-procedure
```

**Expected:** Procedure ab available honi chahiye.

---

### **Step 3: Enable S3 Integration**

Agar procedure available hai:
```bash
npm run enable-s3-terminal
```

**Expected:**
```
✅ S3 integration enabled!
```

---

### **Step 4: Verify Variables**

Check karo ke variables ab populate ho gaye:
```bash
npm run fix-s3
```

**Expected:**
```
aurora_load_from_s3_role: arn:aws:iam::... (NOT empty)
aws_default_s3_role: arn:aws:iam::... (NOT empty)
```

---

### **Step 5: Test S3 Integration**

```bash
npm run test-s3-aurora
```

**Expected:**
```
✅ LOAD DATA FROM S3 works!
```

---

## 📋 Why Reboot Works:

1. **Procedure Loading:** Aurora reboot ke baad sab procedures reload hoti hain
2. **IAM Role Recognition:** Attached IAM roles ko properly recognize karta hai
3. **Variable Population:** S3 variables automatically populate hoti hain

---

## ⚠️ Alternative (If Reboot Doesn't Work):

Agar reboot ke baad bhi procedure nahi milti:

1. **Remove & Re-attach Role:**
   - RDS Console → Delete role
   - Wait 2-3 minutes
   - Add role again
   - Reboot again

2. **Check IAM Role Permissions:**
   - IAM Console → Roles → AuroraS3AccessRole
   - Trust relationship: `rds.amazonaws.com`
   - Permissions: S3 access

3. **Contact AWS Support:**
   - Aurora MySQL 3.08.2 specific issue ho sakta hai

---

## 🚀 After Success:

Once S3 integration enabled:
```bash
# Test full import
curl http://localhost:5000/api/v1/hotelbed/process
```

**Expected:** CSV → S3 → Aurora LOAD DATA successfully! 🎉

