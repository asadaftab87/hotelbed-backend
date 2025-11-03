# 📝 S3 Bucket ARN Input - Modal Guide

## 🎯 Current Step:
Modal "Connect cluster to Amazon S3" open hai aur **S3 bucket ARN** maang raha hai.

---

## ✅ SOLUTION:

### **Step 1: Find Your S3 Bucket Name**

**Check karo:**
- `.env` file mein: `AWS_S3_BUCKET=???`
- Ya S3 Console → Buckets list se bucket name copy karo

**Common bucket names:**
- `hotelbed-imports-cache-data`
- `hotelbed-imports-zuhaib`
- Ya aapka custom bucket name

---

### **Step 2: Enter ARN in Modal**

**Modal mein "Add resource ARN" field:**

**Format:**
```
arn:aws:s3:::YOUR-BUCKET-NAME
```

**Examples:**
```
arn:aws:s3:::hotelbed-imports-cache-data
arn:aws:s3:::hotelbed-imports-zuhaib
```

**⚠️ Important:**
- 3 colons `:::` use karo (not 2)
- Bucket name ke baad kuch mat add karo (no `/*` or `/folder`)
- Just: `arn:aws:s3:::bucket-name`

---

### **Step 3: Connect**

```
1. ARN field mein enter karo: arn:aws:s3:::YOUR-BUCKET-NAME
2. "Connect service" button click karo
3. Wait 1-2 minutes (Status: Active ho jayega)
```

---

## 🔍 How to Find Bucket Name:

**Option 1: Check .env file**
```bash
# Terminal mein:
cat .env | grep AWS_S3_BUCKET
```

**Option 2: S3 Console**
```
1. AWS Console → S3
2. Buckets list se bucket name copy karo
```

**Option 3: Check Earlier Output**
```
From diagnosis, bucket was: hotelbed-imports-cache-data
```

---

## 📋 Quick Reference:

| Your Bucket Name | ARN Format |
|------------------|------------|
| `hotelbed-imports-cache-data` | `arn:aws:s3:::hotelbed-imports-cache-data` |
| `hotelbed-imports-zuhaib` | `arn:aws:s3:::hotelbed-imports-zuhaib` |
| `YOUR-BUCKET` | `arn:aws:s3:::YOUR-BUCKET` |

---

**Modal mein ARN enter karo aur "Connect service" click karo!** 🚀


