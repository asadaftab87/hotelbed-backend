# 🖥️ Mac Terminal Se S3 Enable - Commands

## ❌ Current Status:
**Procedure `mysql.rds_add_s3_integration_role` abhi available nahi hai.**

---

## 📋 Mac Terminal Commands:

### **Command 1: Check Procedure Status**
```bash
npm run check-s3-procedure
```

**Ye check karega:**
- Procedure exists ya nahi
- Available S3/RDS procedures
- Aurora version

---

### **Command 2: Enable S3 (When Procedure Available)**
```bash
npm run enable-s3-terminal
```

**Ye karega:**
- Procedure enable karega (agar available ho)
- Verify karega
- Error handling

---

### **Command 3: Test S3 Connection**
```bash
npm run test-s3-aurora
```

**Ye test karega:**
- S3 integration enabled hai ya nahi
- LOAD DATA FROM S3 kaam kar raha ya nahi

---

## 🔧 Issue & Solution:

### **Problem:**
Procedure `mysql.rds_add_s3_integration_role` abhi available nahi hai.

### **Reason:**
IAM role attached hai, but procedure load hone ke liye 10-15 minutes lagte hain.

### **Solution:**

**Option 1: Wait & Retry**
```bash
# Wait 10-15 minutes, then:
npm run check-s3-procedure
npm run enable-s3-terminal
npm run test-s3-aurora
```

**Option 2: RDS Console Check**
- RDS Console → Aurora cluster
- Connectivity & security → Manage IAM roles
- Verify: Status "Active" hai (not "Inactive")

---

## 🚀 Quick Workflow:

```bash
# Step 1: Check procedure
npm run check-s3-procedure

# Step 2: If procedure exists, enable
npm run enable-s3-terminal

# Step 3: Test connection
npm run test-s3-aurora
```

---

## ⏰ Timeline:

```
Role attached in RDS: ✅ Done
Procedure loads: ⏳ 10-15 minutes
Then enable: npm run enable-s3-terminal
Then test: npm run test-s3-aurora
```

---

**Ab 10-15 minutes wait karo, phir `npm run check-s3-procedure` run karo. Agar procedure dikh rahi hai, phir `npm run enable-s3-terminal` run karo!** 🚀


