# 🔧 RDS Console se Role Re-attach (Final Fix)

## 📋 Current Issue:
- ✅ Role attached (AuroraS3AccessRole)
- ✅ Status: Active
- ❌ Feature dropdown nahi aya
- ❌ Procedure load nahi hui (even after reboot)

---

## 🔧 SOLUTION: Remove & Re-attach Role

### **Step 1: Remove Current Role**

**RDS Console:**
```
1. Go to: hotelbed-aurora-cluster (CLUSTER)
2. Connectivity & security tab
3. Manage IAM roles section
4. AuroraS3AccessRole → "Delete" button
5. Wait 2-3 minutes for removal to complete
```

---

### **Step 2: Re-add Role**

**RDS Console:**
```
1. Same location: Manage IAM roles section
2. "Add role" button click karo
3. Role: AuroraS3AccessRole select karo
4. IMPORTANT: Agar "Feature" ya "Service" dropdown aye:
   → Select: "s3Import" (ya "S3_INTEGRATION")
   → Agar dropdown nahi aya, to skip (some versions don't show it)
5. "Add role" button click karo
6. Wait for status to become "Active" (1-2 minutes)
```

---

### **Step 3: Instance Reboot Again**

**RDS Console:**
```
1. Cluster → Instances tab
2. WRITER instance select karo
3. Actions → Reboot
4. Wait 5-10 minutes
```

---

### **Step 4: Check Procedure**

```bash
npm run check-s3-procedure
```

**Expected:** Procedure ab available ho jayegi.

---

### **Step 5: Enable S3**

```bash
npm run enable-s3-terminal
```

---

### **Step 6: Test**

```bash
npm run test-s3-aurora
```

---

## 🔍 Alternative: Check IAM Role Permissions

**Agar still kaam nahi kare, to IAM role check karo:**

**IAM Console:**
```
1. IAM → Roles → AuroraS3AccessRole
2. Trust relationship tab:
   → Principal: rds.amazonaws.com (must be there)
3. Permissions tab:
   → Must have S3 access policy:
      - s3:GetObject
      - s3:ListBucket
```

---

## ⚠️ Last Resort: AWS Support

**Agar still issue rahe:**
1. AWS Support ticket open karo
2. Mention: Aurora MySQL 3.08.2, S3 integration procedure not loading
3. Share: Cluster ID, IAM role ARN, error messages

---

**Ab pehle role remove karo, phir re-add karo, phir instance reboot karo!** 🚀


