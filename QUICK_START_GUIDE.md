# 🚀 Quick Start Guide - Fixing NULL Data Issues

## 🔴 **IMMEDIATE PROBLEM**

Three critical tables are NULL/empty:
1. **destinations** table → No destination reference data
2. **categories** table → No category reference data  
3. **cheapest_pp** table → No cheapest prices computed

## 🎯 **ROOT CAUSE**

The **GENERAL folder** is not being processed during import!

```
ZIP Structure:
├── GENERAL/           ❌ NOT PROCESSED (contains master data)
│   ├── GHOT_F files   → Hotels master data
│   ├── IDES_F files   → Destinations
│   ├── GCAT_F files   → Categories
│   └── GTTO_F files   → Chains
└── DESTINATIONS/      ✅ BEING PROCESSED
    └── [country]/     → Hotel-specific rates, rooms, etc.
```

## 📋 **WHAT NEEDS TO BE BUILT**

### **1. GENERAL Folder Parser** (NEW)
- Parse GHOT_F → hotels.csv
- Parse IDES_F → destinations.csv
- Parse GCAT_F → categories.csv
- Parse GTTO_F → chains.csv

### **2. Update CSV Generator**
- Add writers for: hotels, destinations, categories, chains
- Process GENERAL folder BEFORE DESTINATIONS folder

### **3. Fix Database Load Order**
```
CORRECT ORDER:
1. chains       (no dependencies)
2. categories   (no dependencies)
3. destinations (no dependencies)
4. hotels       (references chains, destinations, categories)
5. hotel_*      (all reference hotels)
```

### **4. Fix Cheapest Price Computation**
- Ensure hotels table is populated first
- Add validation before compute
- Handle NULL values properly

### **5. Fix Import-Only Endpoint**
- Allow import from already extracted folders
- Skip download if folder exists
- Process both GENERAL and DESTINATIONS

## 🛠️ **FILES TO CREATE**

```
/src/utils/generalDataParser.ts    → Parse GENERAL folder files
/src/utils/dataValidator.ts        → Validate data before CSV write
/src/utils/taxCalculator.ts        → Tax calculation (17 fields)
/scripts/testDataImport.ts         → Test import flow
/scripts/verifyDataQuality.ts      → Verify data after import
```

## 📝 **FILES TO MODIFY**

```
/src/utils/csvGenerator.ts                             → Add GENERAL writers
/src/api/components/hotelBed/hotelBed.repository.ts   → Add GENERAL processing
/database/hotelbed_complete_schema.sql                → Update tax table schema
```

## 🎬 **DEVELOPMENT WORKFLOW**

### **Phase 1: GENERAL Parsing (CRITICAL)**
1. Create `generalDataParser.ts`
2. Add parsers for GHOT_F, IDES_F, GCAT_F, GTTO_F
3. Extract hotel_id from filename pattern: `[DEST]_[OFFICE]_[ID]_[TYPE]`

### **Phase 2: CSV Generation**
1. Update `csvGenerator.ts`
2. Add `writeHotels()`, `writeDestinations()`, `writeCategories()`, `writeChains()`
3. Process GENERAL folder first in `generateCSVFiles()`

### **Phase 3: Database Load**
1. Update load order in `loadFromS3ToAurora()`
2. Load master tables first (chains, categories, destinations, hotels)
3. Then load hotel-specific tables

### **Phase 4: Validation**
1. Add pre-import validation (data types, required fields)
2. Add post-import validation (NULL checks, counts)
3. Add foreign key integrity checks

### **Phase 5: Testing**
1. Test with full ZIP import
2. Test with import-only (existing folder)
3. Verify all tables have data
4. Test cheapest price computation

## ✅ **SUCCESS CRITERIA**

After implementation, verify:

```sql
-- All should return > 0
SELECT COUNT(*) FROM hotels;
SELECT COUNT(*) FROM destinations;
SELECT COUNT(*) FROM categories;
SELECT COUNT(*) FROM chains;
SELECT COUNT(*) FROM cheapest_pp;

-- All should return 0 (no NULLs in critical fields)
SELECT COUNT(*) FROM hotels WHERE id IS NULL OR name IS NULL;
SELECT COUNT(*) FROM destinations WHERE code IS NULL;
SELECT COUNT(*) FROM categories WHERE code IS NULL;
```

## 🐛 **DEBUGGING TIPS**

### Check if GENERAL folder exists:
```bash
ls -la downloads/[extracted_folder]/GENERAL/
```

### Check GENERAL file format:
```bash
head -20 downloads/[extracted_folder]/GENERAL/[file]
```

### Monitor import progress:
```bash
tail -f logs/[date].log
```

### Verify CSV generation:
```bash
ls -lh downloads/csv_output/
wc -l downloads/csv_output/*.csv
```

### Check S3 upload:
```bash
aws s3 ls s3://hotelbed-imports/hotelbed-csv/ --recursive
```

## 📊 **ESTIMATED EFFORT**

| Phase | Tasks | Time |
|-------|-------|------|
| GENERAL Parsing | 6 tasks | 8-12 hours |
| Database Load Fix | 3 tasks | 3-4 hours |
| Validation | 4 tasks | 5-6 hours |
| Tax Calculation | 3 tasks | 6-8 hours |
| Import-Only Fix | 5 tasks | 2-3 hours |
| Testing | 4 tasks | 5-7 hours |
| **TOTAL** | **25 tasks** | **29-40 hours** |

## 🔗 **RELATED DOCUMENTS**

- **TASKS.md** - Complete detailed task list with all subtasks
- **FilesCodes.txt** - Complete file format specification
- **ClientDocument.txt** - Project requirements and checklist
- **WhatWENEEDTODO.txt** - Current vs new requirements

## 📞 **NEXT STEPS**

1. **Read TASKS.md** for detailed task breakdown
2. **Start with Phase 1** (GENERAL parsing) - CRITICAL PATH
3. **Test incrementally** after each phase
4. **Update this guide** as you discover edge cases

---

**Created:** 2025-11-13  
**Status:** Ready to implement  
**Priority:** 🔴 CRITICAL - Data quality issue
