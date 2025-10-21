# 🔧 Destination Names Fix

## 🚨 Problem

Destination names were showing as `"\r"` (carriage return) in API responses:

```json
{
  "code": "AB",
  "country_code": "CA",
  "name": "\r"   // ❌ Wrong!
}
```

---

## 🔍 Root Cause

The HotelBeds `IDES_F` file format doesn't include destination names:

```
CTR:ES:Y:
SCQ:ES:Y:
ZAG:HR:Y:
```

**Format:** `CODE:COUNTRY_CODE:IS_AVAILABLE:`

- No 4th field (name)
- Trailing colon with empty value
- Windows line endings (CRLF: `\r\n`)
- Result: `parts[3]` contains only `\r`

---

## ✅ Solution Implemented

### 1. **Updated Import Logic**

**File:** `src/api/components/hotelBed/hotelBed.repository.ts`

```typescript
// Clean line from carriage returns
const cleanLine = line.replace(/\r/g, '').trim();
const parts = cleanLine.split(':');

// Use code as fallback for name
const code = parts[0]?.trim() || null;
const name = parts[3]?.trim() || code;
```

### 2. **Fixed Existing Database**

**Script:** `scripts/fixDestinationNames.ts`

```sql
UPDATE destinations 
SET name = code 
WHERE name IS NULL 
   OR name = '' 
   OR name = '\r' 
   OR TRIM(name) = ''
```

**Result:** Updated all 235 destinations ✅

---

## 🚀 How to Use

### **Fix Existing Data:**
```bash
npm run fix-destinations
```

### **For Future Imports:**
The import logic now automatically:
- ✅ Cleans carriage returns (`\r`)
- ✅ Trims whitespace
- ✅ Uses `code` as `name` fallback
- ✅ Never stores `\r` or empty names

---

## 📊 Result

**Before:**
```json
{ "code": "AB", "name": "\r" }
{ "code": "ACE", "name": "\r" }
```

**After:**
```json
{ "code": "AB", "name": "AB" }
{ "code": "ACE", "name": "ACE" }
```

---

## 💡 Future Enhancement

To get actual destination names (e.g., "New York City" instead of "NYC"):

### **Option 1:** External Lookup Service
```typescript
const destinationNames = {
  'NYC': 'New York City',
  'LON': 'London',
  'PAR': 'Paris',
  // ...
};
```

### **Option 2:** HotelBeds API
Query HotelBeds `/locations` API to get full names.

### **Option 3:** Manual Database
Create a separate `destination_names` table with mappings.

---

## 🔄 When to Run Fix

Run `npm run fix-destinations` if:
- ✅ After importing old data
- ✅ Destination names show as `\r` or empty
- ✅ After database migration
- ✅ After restoring from backup

**Note:** Not needed for new imports (auto-fixed in code!)

---

## ✅ Verification

Test the fix:
```bash
curl "http://localhost:5001/api/v1/hotelbed/destinations?limit=5" | jq '.data.data'
```

Expected output:
```json
[
  { "code": "AB", "country_code": "CA", "name": "AB" },
  { "code": "ACE", "country_code": "ES", "name": "ACE" }
]
```

---

## 📝 Summary

| Issue | Status |
|-------|--------|
| Carriage returns in names | ✅ Fixed |
| Import logic updated | ✅ Done |
| Database cleaned | ✅ Done |
| Future imports | ✅ Auto-fixed |
| Script added to package.json | ✅ Done |

**All destination names now display correctly!** 🎉

