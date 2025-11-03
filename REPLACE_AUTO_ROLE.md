# 🔄 Replace Auto-Generated Role with Manual Role

## ❌ Current Issue:
- Auto-generated role: `rds-s3-hotelbed-aurora-cluster-role-1762135258692` (Active)
- Procedure still NOT loading
- S3 integration not working

**Auto-generated role se procedure load nahi ho rahi!**

---

## ✅ SOLUTION: Use Manual AuroraS3AccessRole

### **Step 1: Delete Auto-Generated Role**

**RDS Console:**
```
1. Manage IAM roles section
2. "Current IAM roles" table mein:
   → rds-s3-hotelbed-aurora-cluster-role-1762135258692
   → "Delete" button click karo
3. Confirm delete
4. Wait 2-3 minutes
```

---

### **Step 2: Add Manual AuroraS3AccessRole**

**RDS Console:**
```
1. "Select IAM roles to add to this cluster" radio button (pehla wala)
2. "Choose an IAM role to add" dropdown:
   → Select: "AuroraS3AccessRole"
3. "Add role" button click karo
4. Wait for status: Active (1-2 minutes)
```

---

### **Step 3: Instance Reboot**

**RDS Console:**
```
1. Instances tab
2. Writer instance → Actions → Reboot
3. Wait 5-10 minutes
```

---

### **Step 4: Check Procedure**

**Terminal:**
```bash
npm run check-s3-procedure
```

**Expected:** Procedure ab available ho jayegi! ✅

---

### **Step 5: Enable S3**

**Terminal:**
```bash
npm run enable-s3-terminal
```

---

### **Step 6: Test**

**Terminal:**
```bash
npm run test-s3-aurora
```

---

## 📋 Why This Works:

**Auto-generated role** (service connect se):
- ❌ Procedure load nahi karta (Aurora MySQL 3.08.2 issue)
- ❌ Variables populate nahi hote

**Manual AuroraS3AccessRole**:
- ✅ Properly configured
- ✅ Procedure load hoti hai
- ✅ S3 integration enable hota hai

---

**Ab auto-generated role delete karo, manual AuroraS3AccessRole add karo, reboot karo!** 🚀


