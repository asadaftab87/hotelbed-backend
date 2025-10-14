# 📘 Manual Process Guide - Step by Step

## ✅ Aap ne pehle se kiya hai:
1. ZIP download kar liya ✓
2. Database mein data store kar diya ✓

---

## 🚀 Ab aage ka complete manual process:

### **Architecture Overview:**
```
┌──────────────────────┐
│ 1. CONTRACT Data in  │ ✅ (Already Done)
│    DB (Cost, Inv.)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Process GENERAL   │ ⏳ (REQUIRED FIRST!)
│    folder (Hotels)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. Precompute        │ ⏳ (After GENERAL)
│    Service           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Search Index      │ ⏳ (Final Step)
│    Update            │
└──────────────────────┘
```

---

## 📋 Step-by-Step Manual Process:

### **STEP 1: Server Start Karein**
```bash
npm run dev
```

**Expected Output:**
```
✅ Database connected
✅ Redis connected
⏭️ Queue system disabled
⏭️ Cron scheduler disabled
🚀 Server listening on port 5000
```

---

### **STEP 2: Process GENERAL Folder (IMPORTANT!)**

**Endpoint:**
```http
GET http://localhost:5000/api/v1/hotelbed/process-general
```

**Ye kya karega:**
- ✅ HotelMaster table populate karega (15,000+ hotels)
- ✅ BoardMaster table populate karega (meal plans)
- ✅ GENERAL folder se data read karega

**Expected Duration:** 30-60 seconds

**Success Response:**
```json
{
  "statusCode": "10000",
  "message": "✅ GENERAL folder processed successfully!",
  "data": {
    "success": true,
    "hotelMasterCount": 15234,
    "boardMasterCount": 45
  }
}
```

---

### **STEP 3: Precompute Service Run Karein**

**Endpoint:**
```http
GET http://localhost:5000/api/v1/hotelbed/precompute
```

**Ye kya karega:**
- ✅ Sabhi hotels ke liye cheapest "From € p.p." prices calculate karega
- ✅ Different travel categories ke liye:
  - City Trip (2 nights minimum)
  - Beach (5 nights minimum)
  - Other (5 nights minimum)
- ✅ `CheapestPricePerPerson` table mein data store karega

**Expected Duration:** 2-5 minutes (hotels ki tadat pe depend karta hai)

**Success Response:**
```json
{
  "statusCode": "10000",
  "message": "✅ Precompute completed successfully!",
  "data": {
    "processed": 15000,
    "updated": 45000,
    "failed": 0,
    "duration": 180
  }
}
```

**Progress Monitor:**
- Server logs check karein
- Har 100 hotels ke baad progress dikhai dega

---

### **STEP 4: Search Index Update Karein**

**Endpoint:**
```http
GET http://localhost:5000/api/v1/hotelbed/search-index
```

**Ye kya karega:**
- ✅ `SearchIndex` table update karega
- ✅ Aggregated data store karega (fast search ke liye)
- ✅ Min/Max/Average prices calculate karega
- ✅ Availability flags set karega

**Expected Duration:** 30-60 seconds

**Success Response:**
```json
{
  "statusCode": "10000",
  "message": "✅ Search Index updated successfully!",
  "data": {
    "hotelsUpdated": 15000
  }
}
```

---

## 🎯 Complete Flow Summary:

```bash
# 1️⃣ Server start
npm run dev

# 2️⃣ Process GENERAL folder (30-60 sec) ← NEW STEP!
GET http://localhost:5000/api/v1/hotelbed/process-general

# 3️⃣ Precompute run (2-5 minutes)
GET http://localhost:5000/api/v1/hotelbed/precompute

# 4️⃣ Search index update (30-60 seconds)
GET http://localhost:5000/api/v1/hotelbed/search-index

# ✅ DONE! Ab search API use kar sakte hain
GET http://localhost:5000/api/v1/search?destination=MAD&checkIn=2025-11-01&checkOut=2025-11-03
```

---

## 🧪 Testing - APIs Ready hain:

### **1. Search API:**
```http
GET http://localhost:5000/api/v1/search
  ?destination=MAD
  &checkIn=2025-11-01
  &checkOut=2025-11-03
  &adults=2
  &children=0
```

### **2. Hotels List:**
```http
GET http://localhost:5000/api/v1/hotels
  ?page=1
  &limit=20
```

### **3. Hotel Details:**
```http
GET http://localhost:5000/api/v1/hotels/:hotelCode
```

---

## 📊 Database Tables Status:

### **After Data Import (Already Done):**
✅ `HotelMaster` - Hotel basic info
✅ `Cost` - Pricing data
✅ `Inventory` - Room availability
✅ `Contract` - Hotel contracts
✅ `Promotion` - Promotional offers
✅ `Room` - Room details
✅ `BoardMaster` - Meal plans

### **After Precompute (Step 2):**
🔄 `CheapestPricePerPerson` - Calculated cheapest prices

### **After Search Index (Step 3):**
🔄 `SearchIndex` - Aggregated search data

---

## ⚠️ Troubleshooting:

### **Problem: Precompute slow hai**
**Solution:**
```env
# .env file mein ye settings adjust karein:
PRECOMPUTE_CONCURRENCY=20    # Default: 10
PRECOMPUTE_HORIZON_DAYS=180  # Default: 365
```

### **Problem: Errors aa rahi hain**
**Solution:**
- Server logs check karein: `logs/2025-10-14.log`
- Database connection verify karein
- Redis running hai check karein

### **Problem: No data returned**
**Solution:**
- Check if HotelMaster table has data
- Check if Inventory table has data
- Verify Cost table has pricing data

---

## 🔍 Monitor Progress:

### **Server Logs:**
```bash
# Real-time logs dekhen
tail -f logs/2025-10-14.log

# Windows PowerShell
Get-Content logs/2025-10-14.log -Wait
```

### **Database Check:**
```sql
-- Check hotels count
SELECT COUNT(*) FROM HotelMaster;

-- Check cheapest prices
SELECT COUNT(*) FROM CheapestPricePerPerson;

-- Check search index
SELECT COUNT(*) FROM SearchIndex;
```

---

## 💡 Quick Tips:

1. **Har step complete hone ka wait karein** - parallel na chalayein
2. **Logs monitor karein** - errors spot karne ke liye
3. **Postman/Thunder Client use karein** - API testing ke liye
4. **Database backup le lein** - process start karne se pehle

---

## 📞 Support:

Agar koi issue aaye toh:
1. Server logs check karein
2. Error message copy karein
3. Database state verify karein
4. Redis connection check karein

---

## 🎉 Success Indicators:

✅ Precompute completed without errors
✅ Search index updated successfully  
✅ Search API returns results
✅ Hotels have "From € p.p." prices
✅ Fast query response times

---

**Good Luck! 🚀**

