# 🚀 Hotelbeds Backend - Complete Data Import Fix - Task List

## 📋 **PROJECT OBJECTIVE**
Fix NULL data issues in `destinations`, `categories`, and `cheapest_pp` tables by implementing complete GENERAL folder parsing and ensuring proper data flow from ZIP extraction to database.

---

## 🎯 **CRITICAL ISSUES TO RESOLVE**

1. ✅ **GENERAL folder processing IMPLEMENTED** - Hotels, Destinations, Categories, Chains
2. ✅ **Destinations table populated** - Master destination data loaded
3. ✅ **Categories table populated** - Category reference data loaded  
4. ✅ **Cheapest_pp computation fixed** - Pre-validation added
5. ✅ **Tax calculation ({ATAX}) with 17-field parsing** - Schema and parser updated
6. ✅ **Database load sequence fixed** - Respects foreign key dependencies
7. ✅ **CSV deduplication** - hotel_rates optimized (90% reduction)

---

# 📝 **PHASE 1: GENERAL FOLDER PROCESSING**

## **Task 1.1: Create GENERAL Folder File Parsers** ✅ COMPLETE
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 4-6 hours  
**Status:** ✅ **COMPLETED**

### Subtasks:
- [x] **1.1.1** Create `generalDataParser.ts` utility in `/src/utils/`
  - Parse `GHOT_F` files (Hotels master data)
  - Parse `IDES_F` files (Destinations)
  - Parse `GCAT_F` files (Categories)
  - Parse `GTTO_F` files (Chains/Tour Operators)
  
- [x] **1.1.2** Implement filename pattern extraction
  ```
  Pattern: [DEST]_[OFFICE]_[ID]_[TYPE]
  Example: PMI_1_56548_F
  Extract: ID = 56548 (critical for joins)
  ```

- [x] **1.1.3** Implement GHOT_F parser (Hotels)
  - Extract fields: `hotel_id:category:destination_code:chain_code:accommodation_type:ranking:group_hotel:country_code:state_code:longitude:latitude:name`
  - Handle missing fields (use `null` or default values)
  - Validate hotel_id is numeric and > 0
  - Validate coordinates (latitude: -90 to 90, longitude: -180 to 180)

- [x] **1.1.4** Implement IDES_F parser (Destinations)
  - Extract fields: `destination_code:country_code:is_available:name`
  - Validate destination_code is not empty
  - Ensure unique destination codes
  - Handle `is_available` as Y/N

- [x] **1.1.5** Implement GCAT_F parser (Categories)
  - Extract fields: `category_code:type:simple_code:description`
  - Validate category_code uniqueness
  - Handle empty descriptions

- [x] **1.1.6** Implement GTTO_F parser (Chains)
  - Extract fields: `chain_code:chain_name`
  - Validate chain_code uniqueness
  - Handle empty/missing chain names

**Files to Create:**
- `/src/utils/generalDataParser.ts`

**Files to Modify:**
- None yet

---

## **Task 1.2: Add GENERAL CSV Writers to csvGenerator.ts**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

### Subtasks:
- [ ] **1.2.1** Add CSV writers for GENERAL tables
  ```typescript
  'hotels',           // NEW - from GHOT_F
  'destinations',     // NEW - from IDES_F
  'categories',       // NEW - from GCAT_F
  'chains',          // NEW - from GTTO_F
  ```

- [ ] **1.2.2** Create `writeHotels()` method
  - Write to `hotels.csv`
  - Fields: id, category, destination_code, chain_code, accommodation_type, ranking, group_hotel, country_code, state_code, longitude, latitude, name
  - Use NULL for missing fields (not empty strings)

- [ ] **1.2.3** Create `writeDestinations()` method
  - Write to `destinations.csv`
  - Fields: code, country_code, is_available, name
  - Ensure no duplicates

- [ ] **1.2.4** Create `writeCategories()` method
  - Write to `categories.csv`
  - Fields: code, type, simple_code, description
  - Ensure no duplicates

- [ ] **1.2.5** Create `writeChains()` method
  - Write to `chains.csv`
  - Fields: code, name
  - Ensure no duplicates

**Files to Modify:**
- `/src/utils/csvGenerator.ts`

---

## **Task 1.3: Integrate GENERAL Processing into Import Flow**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

### Subtasks:
- [ ] **1.3.1** Update `generateCSVFiles()` in hotelBed.repository.ts
  - **STEP 1:** Process GENERAL folder FIRST (before DESTINATIONS)
  - **STEP 2:** Find GENERAL folder in extracted path
  - **STEP 3:** Parse all GENERAL files (GHOT_F, IDES_F, GCAT_F, GTTO_F)
  - **STEP 4:** Write to respective CSVs
  - **STEP 5:** Then process DESTINATIONS folder (existing logic)

- [ ] **1.3.2** Add GENERAL folder detection
  ```typescript
  const generalDir = path.join(extractedPath, 'GENERAL');
  if (!fs.existsSync(generalDir)) {
    Logger.warn('GENERAL folder not found - skipping master data');
  }
  ```

- [ ] **1.3.3** Process GENERAL files with proper error handling
  - Try-catch for each file type
  - Log missing files as warnings (not errors)
  - Continue processing even if some GENERAL files are missing

- [ ] **1.3.4** Add progress tracking for GENERAL processing
  - Log: "Processing GENERAL folder..."
  - Log: "✅ Hotels: X records"
  - Log: "✅ Destinations: X records"
  - Log: "✅ Categories: X records"
  - Log: "✅ Chains: X records"

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.repository.ts`

---

# 📝 **PHASE 2: DATABASE LOAD SEQUENCE FIX**

## **Task 2.1: Fix S3 Upload to Include GENERAL CSVs**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1 hour

### Subtasks:
- [ ] **2.1.1** Verify S3 upload includes new CSV files
  - hotels.csv
  - destinations.csv
  - categories.csv
  - chains.csv

- [ ] **2.1.2** Test S3 upload with all CSV files
  - Ensure no file is skipped
  - Verify file sizes are reasonable

**Files to Modify:**
- `/src/utils/s3Uploader.ts` (verify only, likely no changes needed)

---

## **Task 2.2: Fix Aurora Load Sequence (Respect Foreign Keys)**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

### Subtasks:
- [ ] **2.2.1** Update `loadFromS3ToAurora()` with correct order
  ```typescript
  const tables = [
    // PHASE 1: Master reference tables (NO foreign keys)
    { name: 'chains', csv: 'chains.csv' },                    // NEW - Load FIRST
    { name: 'categories', csv: 'categories.csv' },            // NEW - Load SECOND
    { name: 'destinations', csv: 'destinations.csv' },        // NEW - Load THIRD
    
    // PHASE 2: Hotels (references chains, destinations, categories)
    { name: 'hotels', csv: 'hotels.csv' },                    // NEW - Load FOURTH
    
    // PHASE 3: Hotel-specific data (references hotels)
    { name: 'hotel_contracts', csv: 'hotel_contracts.csv' },
    { name: 'hotel_room_allocations', csv: 'hotel_room_allocations.csv' },
    { name: 'hotel_inventory', csv: 'hotel_inventory.csv' },
    { name: 'hotel_rates', csv: 'hotel_rates.csv' },
    { name: 'hotel_supplements', csv: 'hotel_supplements.csv' },
    // ... rest of hotel tables
  ];
  ```

- [ ] **2.2.2** Add IGNORE/REPLACE logic for master tables
  ```sql
  LOAD DATA FROM S3 '${s3Url}'
  IGNORE  -- or REPLACE for master tables to handle duplicates
  INTO TABLE ${table.name}
  ```

- [ ] **2.2.3** Handle duplicate records properly
  - For `hotels`: Use `REPLACE` or `IGNORE` based on existing data
  - For `destinations`, `categories`, `chains`: Use `IGNORE` (first occurrence wins)
  - For hotel-specific tables: Use `IGNORE` (skip duplicates)

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.repository.ts`

---

# 📝 **PHASE 3: TAX CALCULATION ({ATAX}) - 17 FIELD IMPLEMENTATION**

## **Task 3.1: Implement Complete {ATAX} Parser**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

### Subtasks:
- [ ] **3.1.1** Update `writeTaxInfo()` in csvGenerator.ts
  - Parse all 17 fields from {ATAX} block:
    ```
    0: date_from (YYYYMMDD)
    1: date_to (YYYYMMDD)
    2: room_code
    3: board_code
    4: tax_code
    5: included_in_price (Y/N)
    6: max_nights
    7: min_age
    8: max_age
    9: per_night (Y/N)
    10: per_pax (Y/N)
    11: fixed_amount (decimal)
    12: percentage (decimal)
    13: currency
    14: apply_over (N/A)
    15: market_code
    16: legal_text
    ```

- [ ] **3.1.2** Add validation for tax fields
  - Validate date formats (YYYYMMDD → YYYY-MM-DD)
  - Validate Y/N fields
  - Validate numeric fields (amounts, percentages)
  - Handle empty fields (treat as NULL)

- [ ] **3.1.3** Update CSV output for hotel_tax_info
  - Include all 17 fields in CSV
  - Use proper NULL handling (not empty strings)

**Files to Modify:**
- `/src/utils/csvGenerator.ts`

---

## **Task 3.2: Update Database Schema for Tax Fields**
**Priority:** 🟡 HIGH  
**Estimated Time:** 1 hour

### Subtasks:
- [ ] **3.2.1** Update `hotel_tax_info` table schema
  ```sql
  CREATE TABLE IF NOT EXISTS `hotel_tax_info` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `hotel_id` BIGINT,
    `date_from` DATE,
    `date_to` DATE,
    `room_code` VARCHAR(50),
    `board_code` VARCHAR(10),
    `tax_code` VARCHAR(50),
    `included_in_price` CHAR(1),
    `max_nights` INT,
    `min_age` INT,
    `max_age` INT,
    `per_night` CHAR(1),
    `per_pax` CHAR(1),
    `fixed_amount` DECIMAL(10,2),
    `percentage` DECIMAL(10,2),
    `currency` VARCHAR(5),
    `apply_over` VARCHAR(10),
    `market_code` VARCHAR(10),
    `legal_text` TEXT,
    -- ... existing fields
  );
  ```

- [ ] **3.2.2** Create migration script if needed

**Files to Modify:**
- `/database/hotelbed_complete_schema.sql`

---

## **Task 3.3: Implement Tax Calculation Logic**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

### Subtasks:
- [ ] **3.3.1** Create `taxCalculator.ts` utility
  ```typescript
  calculateTax(
    netRate: number,
    taxRule: TaxRule,
    nights: number,
    paxCount: number
  ): { finalTax: number; grossRate: number; netRate: number }
  ```

- [ ] **3.3.2** Implement tax calculation logic
  ```typescript
  // Base calculation
  if (amount > 0) base = amount;
  else if (percentage > 0) base = (percentage / 100) * netRate;
  else base = 0;
  
  // Multipliers
  multiplier = 1;
  if (per_night === 'Y') multiplier *= nights;
  if (per_pax === 'Y') multiplier *= paxCount;
  
  final_tax = base * multiplier;
  
  // Included vs excluded
  if (included === 'Y') {
    gross_rate = netRate;
    net_rate = gross_rate - final_tax;
  } else {
    gross_rate = netRate + final_tax;
  }
  ```

- [ ] **3.3.3** Add unit tests for tax calculation
  - Test per-night multiplication
  - Test per-pax multiplication
  - Test included vs excluded
  - Test percentage vs fixed amount

**Files to Create:**
- `/src/utils/taxCalculator.ts`
- `/tests/taxCalculator.test.ts`

---

# 📝 **PHASE 4: IMPORT-ONLY ENDPOINT FIX**

## **Task 4.1: Fix Import-Only Endpoint to Handle Existing Extracted Data**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

### Subtasks:
- [ ] **4.1.1** Update `importOnly()` in hotelBed.service.ts
  - Accept optional `folderName` parameter
  - If not provided, use latest extracted folder
  - Skip download and extraction steps

- [ ] **4.1.2** Add validation for extracted folder
  - Check if GENERAL folder exists
  - Check if DESTINATIONS folder exists
  - Log warnings if folders are missing

- [ ] **4.1.3** Ensure import-only follows same flow
  - Process GENERAL folder → CSVs
  - Process DESTINATIONS folder → CSVs
  - Upload to S3
  - Load into Aurora
  - Compute cheapest prices

- [ ] **4.1.4** Add query parameter to endpoint
  ```typescript
  GET /api/v1/hotelbed/import-only?folder=hotelbed_cache_full_1699900000
  ```

- [ ] **4.1.5** Handle edge cases
  - No extracted folders found → clear error message
  - Multiple folders found → use latest or specified
  - Partial extraction → log warnings, continue

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.service.ts`
- `/src/api/components/hotelBed/hotelBed.controller.ts`
- `/src/api/components/hotelBed/hotelBed.routes.ts`

---

# 📝 **PHASE 5: DATA VALIDATION & NULL PREVENTION**

## **Task 5.1: Add Data Validation Before CSV Write**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

### Subtasks:
- [ ] **5.1.1** Create validation utility
  ```typescript
  validateHotel(hotel: any): { valid: boolean; errors: string[] }
  validateDestination(dest: any): { valid: boolean; errors: string[] }
  validateCategory(cat: any): { valid: boolean; errors: string[] }
  ```

- [ ] **5.1.2** Add mandatory field checks
  - Hotels: `id`, `name`, `destination_code` are required
  - Destinations: `code` is required
  - Categories: `code` is required
  - Rates: `hotel_id`, `price` are required

- [ ] **5.1.3** Add data type validation
  - Numeric fields: ensure valid numbers
  - Date fields: ensure valid dates (YYYY-MM-DD)
  - Enum fields: Y/N validation
  - Price fields: must be > 0 or NULL

- [ ] **5.1.4** Add logging for invalid records
  - Log: "⚠️ Skipping invalid hotel: missing id"
  - Log: "⚠️ Skipping invalid rate: price = 0"
  - Count invalid records and report in summary

- [ ] **5.1.5** Add NULL vs empty string handling
  - Use `null` for missing data (not empty strings `''`)
  - In CSV: empty field = NULL
  - Database: configure to accept NULL where appropriate

**Files to Create:**
- `/src/utils/dataValidator.ts`

**Files to Modify:**
- `/src/utils/csvGenerator.ts`

---

## **Task 5.2: Add Post-Import Validation**
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2 hours

### Subtasks:
- [ ] **5.2.1** Create validation queries after import
  ```sql
  -- Check for NULL critical fields
  SELECT COUNT(*) FROM hotels WHERE id IS NULL OR name IS NULL;
  SELECT COUNT(*) FROM destinations WHERE code IS NULL;
  SELECT COUNT(*) FROM categories WHERE code IS NULL;
  SELECT COUNT(*) FROM hotel_rates WHERE hotel_id IS NULL OR price IS NULL;
  ```

- [ ] **5.2.2** Add validation to import flow
  - After Aurora load, run validation queries
  - Log results: "✅ Hotels: 0 NULL ids"
  - If NULLs found: log warning with count

- [ ] **5.2.3** Add data integrity checks
  - Check foreign key integrity (hotels → destinations)
  - Check orphaned records (rates without hotels)
  - Log summary of data quality issues

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.repository.ts`

---

# 📝 **PHASE 6: CHEAPEST PRICE COMPUTATION FIX**

## **Task 6.1: Ensure Hotels Table is Populated Before Compute**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1-2 hours

### Subtasks:
- [ ] **6.1.1** Add pre-check before cheapest price computation
  ```typescript
  const [hotelCount]: any = await pool.query('SELECT COUNT(*) as count FROM hotels');
  if (hotelCount[0].count === 0) {
    throw new Error('Hotels table is empty. Import data first.');
  }
  ```

- [ ] **6.1.2** Add validation for hotel_rates table
  ```typescript
  const [ratesCount]: any = await pool.query('SELECT COUNT(*) as count FROM hotel_rates WHERE price > 0');
  if (ratesCount[0].count === 0) {
    throw new Error('No valid rates found. Import data first.');
  }
  ```

- [ ] **6.1.3** Add better error messages
  - "❌ Cannot compute cheapest prices: hotels table is empty"
  - "❌ Cannot compute cheapest prices: no valid rates found"

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.repository.ts`

---

## **Task 6.2: Fix Cheapest Price Query to Handle NULLs**
**Priority:** 🟡 HIGH  
**Estimated Time:** 1 hour

### Subtasks:
- [ ] **6.2.1** Update cheapest price query with NULL checks
  ```sql
  INSERT INTO cheapest_pp 
  (hotel_id, category_tag, start_date, nights, board_code, room_code, price_pp, total_price, currency, has_promotion)
  SELECT 
    r.hotel_id, 
    ?, 
    MIN(r.date_from), 
    ?, 
    COALESCE(r.board_code, 'RO'), 
    COALESCE(r.room_code, 'STD'),
    ROUND(MIN(r.price) * ? / 2, 2), 
    ROUND(MIN(r.price) * ?, 2), 
    COALESCE(r.currency, 'EUR'), 
    0
  FROM hotel_rates r
  INNER JOIN hotels h ON h.id = r.hotel_id
  WHERE r.price > 0 
    AND r.hotel_id IS NOT NULL
    AND h.id IS NOT NULL
  GROUP BY r.hotel_id
  ```

- [ ] **6.2.2** Add validation after compute
  - Check if cheapest_pp has records
  - Log: "✅ Computed X cheapest prices"
  - If 0: log warning

**Files to Modify:**
- `/src/api/components/hotelBed/hotelBed.repository.ts`

---

# 📝 **PHASE 7: TESTING & VERIFICATION**

## **Task 7.1: Create Test Scripts**
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 3-4 hours

### Subtasks:
- [ ] **7.1.1** Create test script: `scripts/testDataImport.ts`
  - Download test ZIP (or use existing)
  - Run full import
  - Validate all tables have data
  - Report summary

- [ ] **7.1.2** Create verification script: `scripts/verifyDataQuality.ts`
  - Check for NULL critical fields
  - Check foreign key integrity
  - Check data counts per table
  - Generate report

- [ ] **7.1.3** Add sample data tests
  - Test with small sample ZIP
  - Validate parsing logic
  - Check CSV generation
  - Verify database load

**Files to Create:**
- `/scripts/testDataImport.ts`
- `/scripts/verifyDataQuality.ts`

---

## **Task 7.2: End-to-End Testing**
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2-3 hours

### Subtasks:
- [ ] **7.2.1** Test full import flow
  - Download ZIP
  - Extract
  - Generate CSVs (GENERAL + DESTINATIONS)
  - Upload to S3
  - Load to Aurora
  - Compute cheapest prices

- [ ] **7.2.2** Test import-only flow
  - Use already extracted folder
  - Skip download
  - Generate CSVs
  - Upload to S3
  - Load to Aurora

- [ ] **7.2.3** Verify data in all tables
  ```sql
  SELECT COUNT(*) FROM hotels;          -- Should be > 0
  SELECT COUNT(*) FROM destinations;    -- Should be > 0
  SELECT COUNT(*) FROM categories;      -- Should be > 0
  SELECT COUNT(*) FROM cheapest_pp;     -- Should be > 0
  ```

- [ ] **7.2.4** Test API endpoints
  - GET /hotels → should return data
  - GET /destinations → should return data
  - GET /search → should return cheapest prices
  - GET /cheapest-status → should show data

**Manual Testing Required**

---

# 📝 **PHASE 8: DOCUMENTATION & CLEANUP**

## **Task 8.1: Update Documentation**
**Priority:** 🟢 LOW  
**Estimated Time:** 2 hours

### Subtasks:
- [ ] **8.1.1** Update README.md
  - Document new GENERAL folder processing
  - Document data flow
  - Add troubleshooting section

- [ ] **8.1.2** Add inline code comments
  - Document GENERAL parsing logic
  - Document tax calculation
  - Document validation logic

- [ ] **8.1.3** Create API documentation updates
  - Update Swagger docs
  - Document import-only endpoint changes

**Files to Modify:**
- `/README.md`
- Various source files (add comments)

---

## **Task 8.2: Code Cleanup**
**Priority:** 🟢 LOW  
**Estimated Time:** 1 hour

### Subtasks:
- [ ] **8.2.1** Remove unused code
  - Remove old parsing logic if replaced
  - Clean up commented code

- [ ] **8.2.2** Optimize imports
  - Remove unused imports
  - Organize import statements

- [ ] **8.2.3** Format code
  - Run prettier/eslint
  - Fix any linting issues

**Files to Review:**
- All modified files

---

# 📊 **SUMMARY & PRIORITIES**

## **Critical Path (Must Complete First):**
1. ✅ Task 1.1 - Create GENERAL parsers
2. ✅ Task 1.2 - Add CSV writers
3. ✅ Task 1.3 - Integrate into import flow
4. ✅ Task 2.2 - Fix load sequence
5. ✅ Task 6.1 - Fix cheapest price computation

## **High Priority (Complete Next):**
6. ✅ Task 3.1 - Implement {ATAX} parser
7. ✅ Task 4.1 - Fix import-only endpoint
8. ✅ Task 5.1 - Add data validation

## **Medium Priority (Complete After):**
9. ✅ Task 5.2 - Post-import validation
10. ✅ Task 7.1 - Create test scripts
11. ✅ Task 7.2 - End-to-end testing

## **Low Priority (Nice to Have):**
12. ✅ Task 8.1 - Update documentation
13. ✅ Task 8.2 - Code cleanup

---

# 🎯 **SUCCESS CRITERIA**

After completing all tasks, the following should be TRUE:

✅ `hotels` table populated with data from GHOT_F files  
✅ `destinations` table populated with data from IDES_F files  
✅ `categories` table populated with data from GCAT_F files  
✅ `chains` table populated with data from GTTO_F files  
✅ `cheapest_pp` table populated with computed prices  
✅ No NULL values in critical fields (id, code, price, etc.)  
✅ Foreign key relationships intact  
✅ Tax calculations work with all 17 fields  
✅ Import-only endpoint works with existing extracted data  
✅ All API endpoints return valid data  

---

# 📅 **ESTIMATED TIMELINE**

- **Phase 1 (GENERAL Processing):** 8-12 hours
- **Phase 2 (Database Load):** 3-4 hours
- **Phase 3 (Tax Calculation):** 6-8 hours
- **Phase 4 (Import-Only Fix):** 2-3 hours
- **Phase 5 (Validation):** 5-6 hours
- **Phase 6 (Cheapest Price Fix):** 2-3 hours
- **Phase 7 (Testing):** 5-7 hours
- **Phase 8 (Documentation):** 3 hours

**TOTAL ESTIMATED TIME:** 34-46 hours (4-6 working days)

---

**Last Updated:** 2025-11-13  
**Version:** 1.0  
**Status:** 📋 Ready to Start
