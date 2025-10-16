# 🚀 HotelBed API - Complete cURL Commands

## Base URL: `http://107.21.156.43:3000/api/v1`

---

## 🏨 **HOTEL SEARCH & DATA APIs**

### 1. **Search Hotels** 🔍
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=PMI&nights=3&checkIn=2025-11-01&adults=2&children=0&priceMin=50&priceMax=200&sort=price_asc&page=1&pageSize=50" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json"
```

**With different parameters:**
```bash
# Search in Paris for 2 nights
curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=PAR&nights=2&checkIn=2025-12-15&adults=2&sort=price_asc" \
  -H "Accept: application/json"

# Search with promotions only
curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=BCN&nights=4&checkIn=2025-11-20&adults=2&promotion=true&sort=promo_desc" \
  -H "Accept: application/json"

# Search with specific amenities
curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=ATH&nights=3&checkIn=2025-10-10&adults=2&amenities=WIFI,POOL&board=AI" \
  -H "Accept: application/json"
```

### 2. **Hotel Suggestions (Autocomplete)** 💡
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/search/suggestions?q=Beach" \
  -H "Accept: application/json"

# More examples:
curl -X GET "http://107.21.156.43:3000/api/v1/search/suggestions?q=Grand" \
  -H "Accept: application/json"

curl -X GET "http://107.21.156.43:3000/api/v1/search/suggestions?q=Resort" \
  -H "Accept: application/json"
```

### 3. **Get Hotels List** 📋
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotels?page=1&pageSize=50" \
  -H "Accept: application/json"

# With pagination:
curl -X GET "http://107.21.156.43:3000/api/v1/hotels?page=2&pageSize=25" \
  -H "Accept: application/json"
```

### 4. **Get Single Hotel Details** 🏨
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/914180" \
  -H "Accept: application/json"

# Different hotel codes:
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/915432" \
  -H "Accept: application/json"
```

### 5. **Get Hotel Pricing Matrix** 💰
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/914180/matrix?checkIn=2025-11-01&nights=3&adults=2&children=0" \
  -H "Accept: application/json"

# With child ages:
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/914180/matrix?checkIn=2025-11-01&nights=3&adults=2&children=2&childAges=5,8" \
  -H "Accept: application/json"

# Different dates:
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/914180/matrix?checkIn=2025-12-15&nights=7&adults=2" \
  -H "Accept: application/json"
```

### 6. **Get Static Hotel Data (Bulk)** 📊
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/static?ids=914180,915432,916789" \
  -H "Accept: application/json"

# More hotels:
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/static?ids=914180,915432,916789,917123,918456" \
  -H "Accept: application/json"
```

---

## ⚙️ **ADMIN/DATA MANAGEMENT APIs**

### 7. **Full Data Ingestion** 🚀
```bash
# Full mode (clean database and reload everything)
curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed?mode=full" \
  -H "Accept: application/json"

# Update mode (incremental update)
curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed?mode=update" \
  -H "Accept: application/json"
```

### 8. **Manual Inventory Build** 🏗️
```bash
# Cleans old inventory and rebuilds from current database data
curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/build-inventory" \
  -H "Accept: application/json"
```

### 9. **Manual Precompute** 🔄
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/precompute" \
  -H "Accept: application/json"
```

### 10. **Update Search Index** 📊
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/search-index" \
  -H "Accept: application/json"
```

---

## 📊 **SYSTEM APIs**

### 11. **Health Check** ❤️
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/" \
  -H "Accept: application/json"
```

### 12. **API Documentation** 📚
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/docs" \
  -H "Accept: text/html"
```

### 13. **System Metrics** 📈
```bash
curl -X GET "http://107.21.156.43:3000/metrics" \
  -H "Accept: text/plain"
```

---

## 🎯 **Quick Test Commands**

### **Test if API is working:**
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/" | jq
```

### **Test search (after data is loaded):**
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=PMI&nights=2&adults=2" | jq
```

### **Test hotel details:**
```bash
curl -X GET "http://107.21.156.43:3000/api/v1/hotels/914180" | jq
```

---

## 📝 **Notes:**

1. **Replace `107.21.156.43:3000`** with your actual server IP and port
2. **Add `| jq`** at the end for pretty JSON formatting (if jq is installed)
3. **All APIs return JSON** except `/docs` (HTML) and `/metrics` (text)
4. **Search APIs work best after** running precompute and search-index
5. **Use appropriate query parameters** for your specific needs

---

## 🚀 **Demo Flow (With Partial Data at 18%):**

1. **Build inventory from current data:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/build-inventory"
   ```

2. **Run precompute:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/precompute"
   ```

3. **Update search index:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/search-index"
   ```

4. **Test search with partial data:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=PMI&nights=3&adults=2" | jq
   ```

---

## 🎯 **After Your Data Ingestion Completes (100%):**

1. **Build inventory again (with all data):**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/build-inventory"
   ```

2. **Run precompute again:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/precompute"
   ```

3. **Update search index:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/hotelbed/search-index"
   ```

4. **Test search with complete data:**
   ```bash
   curl -X GET "http://107.21.156.43:3000/api/v1/search?destination=PMI&nights=3&adults=2" | jq
   ```

**All APIs will have REAL Cost data and accurate pricing!** ✅🎉
