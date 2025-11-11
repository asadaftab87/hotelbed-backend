# HotelBeds Cache Processing - Complete Knowledge Transfer

## 🎯 Project Overview

Backend system to process HotelBeds cache files, extract hotel pricing/inventory data, and store in Aurora MySQL database.

## 📊 Current Status

- ✅ Hotels master data: 23,714 hotels imported
- ✅ Contract files processed: 38,178 files
- ✅ Inventory records: 331,851
- ✅ Rate records: 207,017,524 (207 million)
- ✅ Test hotel verified: Rixos Premium Belek (14126) - 43,561 rates

## 🗄️ Database Configuration

```javascript
Host: hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com
Port: 3306
User: hotelbed
Password: Aurora123!Secure
Database: hotelbed_db
```

## 📁 Project Structure

```
hotelbed-backend/
├── downloads/
│   ├── hotelbed_cache_full_1762375968657/  # Cache files
│   │   ├── GENERAL/
│   │   │   ├── GHOT_F          # Hotels master (23,714 hotels)
│   │   │   ├── IDES_F          # Destinations
│   │   │   └── GCAT_F          # Categories
│   │   └── DESTINATIONS/
│   │       ├── D_AYT/          # Antalya contracts
│   │       ├── D_DXB/          # Dubai contracts
│   │       └── D_*/            # Other destinations
│   └── csv_output/             # Generated CSVs
│       ├── hotels.csv
│       ├── hotel_inventory.csv
│       └── hotel_rates.csv
├── src/utils/
│   ├── csvGenerator.ts         # Main CSV generator (FAST)
│   ├── ghotParser.ts           # Hotel master parser
│   └── generalFilesParser.ts  # GENERAL files parser
└── process-contracts-simple.js # Contract processor (FASTEST)
```

## 🔑 Key Files Explained

### 1\. GHOT_F (Hotels Master File)

**Location**: `downloads/hotelbed_cache_full_*/GENERAL/GHOT_F`

**Format**: Colon-separated values

```
14126:5EST:AYT:76:::6:N:TR::36.8625:30.9875:Rixos Premium Belek L.O.L Theme Park Free Access
```

**Fields**:

- \[0\] Hotel ID
- \[1\] Category (5EST = 5 star)
- \[2\] Destination code (AYT = Antalya)
- \[3\] Chain code
- \[5\] Accommodation type
- \[6\] Ranking
- \[7\] Group hotel
- \[8\] Country code
- \[9\] Longitude
- \[10\] Latitude
- \[11\] Hotel name (REAL NAME - not "Property X")

**Parser**: `src/utils/ghotParser.ts`

### 2\. Contract Files (ID_B2B Format)

**Location**: `downloads/hotelbed_cache_full_*/DESTINATIONS/D_*/ID_B2B_*`

**Example**: `ID_B2B_97#APFLMRI3_14126_1_M_F`

- Contract for hotel 14126 (Rixos Premium Belek)
- Contains SIIN (inventory) and SIAP (pricing) sections

**File Structure**:

```
{CCON}
Contract metadata
{/CCON}

{SIIN}
20251107:20261031:FAM:DX-1:AI:(0,365,0)(0,365,10)...
{/SIIN}

{SIAP}
20251107:20261031:FAM:DX-1:AI:1:1::N:(,,)(0.000,0.000,425.880)...
{/SIAP}
```

### 3\. SIIN Section (Inventory)

**Format**: `date_from:date_to:room_type:room_code:board_code:availability_data`

**Example**:

```
20251107:20261031:FAM:DX-1:AI:(0,365,0)(0,365,10)(0,365,0)
```

- Date range: Nov 7, 2025 to Oct 31, 2026
- Room: FAM (Family)
- Room code: DX-1
- Board: AI (All Inclusive)
- Availability: Encoded per day (365 days)

**Parsing**: Each `(X,Y,Z)` tuple = (release, allotment, free_sale)

### 4\. SIAP Section (Pricing)

**Format**: `date_from:date_to:room_type:room_code:board_code:pax_from:pax_to::rate_type:prices`

**Example**:

```
20251107:20261031:FAM:DX-1:AI:1:1::N:(,,)(0.000,0.000,425.880)
```

- Date range: Nov 7, 2025 to Oct 31, 2026
- Room: DX-1
- Board: AI
- Pax: 1 adult
- Rate type: N (Net)
- Prices: `(base,tax,total)` per day (365 tuples)

**Key**: Each `(base,tax,total)` = price for that specific day

## 🚀 Processing Scripts

### Script 1: process-contracts-simple.js (FASTEST - 13 minutes)

**Purpose**: Process all 38,178 contract files and generate CSVs

**How it works**:

1. Scans `DESTINATIONS/D_*/` folders
2. Finds files starting with `ID_B2B`
3. Extracts hotel ID from filename
4. Streams file line-by-line (memory efficient)
5. Parses SIIN → hotel_inventory.csv
6. Parses SIAP → hotel_rates.csv
7. Uses 128MB buffer for speed

**Run**:

```bash
node process-contracts-simple.js
```

**Output**:

- `hotel_inventory.csv`: 331,851 records
- `hotel_rates.csv`: 207,017,524 records
- Time: \~805 seconds (13.4 minutes)

**Key Code**:

```javascript
// Extract hotel ID from filename
function extractHotelId(filename) {
  const match = filename.match(/ID_B2B_\d+#[^_]+_(\d+)_/);
  if (match) return parseInt(match[1]);
  // Fallback logic...
}

// Parse SIIN (inventory)
function writeInventory(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 6) {
      writer.stream.write({
        hotel_id: hotelId,
        room_code: parts[3],
        board_code: parts[4],
        date_from: parts[0],
        date_to: parts[1],
        availability_data: parts[5]
      });
    }
  }
}

// Parse SIAP (pricing)
function writeRates(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 10) {
      const pricesString = parts[9];
      const matches = [...pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g)];
      
      for (const match of matches) {
        const price = parseFloat(match[3]);
        if (price > 0) {
          writer.stream.write({
            hotel_id: hotelId,
            room_code: parts[3],
            board_code: parts[4],
            date_from: parts[0],
            date_to: parts[1],
            rate_type: 'N',
            adults: parseInt(parts[6]) || 0,
            price: price
          });
        }
      }
    }
  }
}
```

### Script 2: import-test-hotels-fixed.js

**Purpose**: Import only test hotel data to database (fast verification)

**Run**:

```bash
node import-test-hotels-fixed.js
```

**Key Features**:

- Disables foreign key checks
- Filters only test hotel IDs: \[14126, 87607, 96763, 371129\]
- Batch inserts (500 records at a time)
- Uses `INSERT IGNORE` to skip duplicates

### Script 3: check-pricing.js

**Purpose**: Verify pricing data in database

**Run**:

```bash
node check-pricing.js
```

**Output**:

```
🏨 Rixos Premium Belek (14126)
   Total rates: 43,561
   Top rates:
      SU-VM/AI | 4p | €3083.10 | 2025-11-05 to 2026-10-31
```

## 🌐 Process Endpoint Workflow (`GET /hotelbed/process`)

The Express endpoint orchestrates the complete ingest cycle without manual scripts. Internally it triggers the service/repository stack shown below:

1. **Step 0 – Clean slate**  
   `HotelBedFileRepository.cleanEverything()` wipes the `downloads/` directory, truncates Aurora tables (foreign keys disabled), and purges the S3 prefix (`hotelbed-csv/`). Use this endpoint with caution in shared environments.
2. **Step 1 – Download cache ZIP**  
   `downloadCacheZip()` streams the HotelBeds cache (`env.HOTELBEDS_CACHE_ENDPOINT`) to `downloads/hotelbed_cache_<type>_<timestamp>.zip`, logging progress every ~5 MB.
3. **Step 2 – Extract archive**  
   `extractZipFile()` expands the ZIP into `downloads/hotelbed_cache_full_<timestamp>/`, preserving the `GENERAL/` and `DESTINATIONS/` layout used by the parsers.
4. **Step 3 – Generate CSVs**  
   `generateCSVFiles()` rebuilds the entire `downloads/csv_output/` folder. It parses GHOT/IDES/GCAT first, then streams every `ID_B2B*` contract in aggressive parallel batches through `CSVGenerator`. Expect `hotel_rates.csv` to be several GB (≈9 GB for 207 M rows); ensure the volume has >15 GB free before running.
5. **Step 4 – Upload to S3**  
   `uploadCSVsToS3()` sends the regenerated CSVs to the configured bucket/prefix. Failures here leave files on disk for manual retry.
6. **Step 5 – Load into Aurora**  
   `loadFromS3ToAurora()` uses `LOAD DATA FROM S3` per table, re-enabling constraints afterward. Logs surface any table skipped because a CSV is missing.
7. **Step 6 – Post-processing**  
   The import automatically refreshes hotel names (HotelBeds Content API) and recomputes `cheapest_pp`.

**How to trigger**

```bash
curl -X GET http://localhost:3000/api/hotelbed/process
```

Watch the API logs (`npm run dev`) or CloudWatch to ensure each step reports ✅. The endpoint returns a JSON summary containing download/extract/import timings plus record counts.

## 📊 CSV Generator (src/utils/csvGenerator.ts)

### Key Methods

#### 1\. createCSVWriters()

Creates streaming CSV writers for all tables with 128MB buffer.

#### 2\. processHotelFile(writers, filePath, hotelId)

**Main processing method** - streams file line-by-line:

```typescript
async processHotelFile(writers, filePath, hotelId) {
  const fileStream = createReadStream(filePath, {
    highWaterMark: 16 * 1024 * 1024  // 16MB buffer
  });
  const rl = createInterface({ input: fileStream });
  
  let currentSection = null;
  const currentLines = [];
  
  rl.on('line', (line) => {
    // Detect section start: {SIIN}
    if (line.match(/^\{([A-Z]+)\}$/)) {
      currentSection = match[1];
    }
    // Detect section end: {/SIIN}
    else if (line.match(/^\{\/([A-Z]+)\}$/)) {
      this.writeSectionToCSV(writers, hotelId, currentSection, currentLines);
      currentSection = null;
    }
    // Accumulate lines
    else if (currentSection) {
      currentLines.push(line.trim());
    }
  });
}
```

#### 3\. writeSectionToCSV()

Routes sections to appropriate writers:

```typescript
switch (section) {
  case 'SIIN':
    this.writeInventoryFromSIIN(writer, hotelId, lines);
    break;
  case 'SIAP':
    this.writeRatesFromSIAP(writer, hotelId, lines);
    break;
}
```

#### 4\. writeInventoryFromSIIN()

Parses SIIN format:

```typescript
writeInventoryFromSIIN(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 6) {
      writer.stream.write({
        hotel_id: hotelId,
        room_code: parts[3],      // DX-1
        board_code: parts[4],     // AI
        date_from: parts[0],      // 20251107
        date_to: parts[1],        // 20261031
        availability_data: parts[5] // (0,365,0)(0,365,10)...
      });
    }
  }
}
```

#### 5\. writeRatesFromSIAP()

Parses SIAP format and extracts prices:

```typescript
writeRatesFromSIAP(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 10) {
      const pricesString = parts[9];
      // Extract all (base,tax,price) tuples
      const priceMatches = pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g);
      
      for (const match of priceMatches) {
        const price = parseFloat(match[3]);
        if (price > 0) {
          writer.stream.write({
            hotel_id: hotelId,
            room_code: parts[3],
            board_code: parts[4],
            date_from: parts[0],
            date_to: parts[1],
            rate_type: 'N',
            base_price: 0,
            tax_amount: 0,
            adults: parseInt(parts[6]) || 0,
            board_type: parts[4],
            price: price
          });
        }
      }
    }
  }
}
```

## 🔄 Complete Processing Flow

### Step 1: Download Cache

```bash
# Cache files are in downloads/hotelbed_cache_full_*/
```

### Step 2: Process Contracts

```bash
node process-contracts-simple.js
```

**What happens**:

1. Scans 229 destination folders
2. Finds 38,178 contract files (ID_B2B\_\*)
3. Extracts hotel ID from filename
4. Streams each file line-by-line
5. Detects {SIIN} and {SIAP} sections
6. Parses and writes to CSV streams
7. Generates 2 CSV files

**Output**:

- `hotel_inventory.csv` (331K records)
- `hotel_rates.csv` (207M records)

### Step 3: Import to Database

```bash
node import-test-hotels-fixed.js
```

**What happens**:

1. Connects to Aurora MySQL
2. Disables foreign key checks
3. Reads CSV files line-by-line
4. Filters test hotel IDs
5. Batch inserts (500 at a time)
6. Re-enables foreign key checks

### Step 4: Verify Pricing

```bash
node check-pricing.js
```

## 🎯 Test Hotels

| ID | Name | Destination | Rates Found | Notes |
| --- | --- | --- | --- | --- |
| 14126 | Rixos Premium Belek | AYT (Antalya) | ✅ 43,561 | Multiple `ID_B2B_*_14126_*` contracts present under `DESTINATIONS/D_AYT/` |
| 87607 | Royal Dragon Hotel | AYT (Antalya) | ❌ 0 | No `ID_B2B` contract files matching `_87607_` in the current cache drop |
| 96763 | Long Beach Resort & Spa Deluxe | HRG (Hurghada) | ❌ 0 | Listed in GHOT as HRG, no Antalya contract files ⇒ no SIAP/SIIN sections |
| 371129 | Alan Xafira Deluxe Resort & Spa | AYT (Antalya) | ❌ 0 | Hotel master exists but no matching `ID_B2B` contracts in `DESTINATIONS/D_AYT` |
| — | Limak Atlantis Deluxe Resort & Hotel | AYT (Antalya) | ❌ N/A | Not present in GHOT_F / hotels.csv for this cache snapshot; confirm availability with HotelBeds |

Stakeholders expect six Antalya 5★ hotels with rates (list above + one additional TBD). Update this table once the sixth ID/name pair is confirmed.

**Why only Rixos has data today?**

- Only Rixos ships contract files (`ID_B2B_*`) in the delivered cache bundle.
- The remaining target hotels either rely on real-time API pricing or the relevant contracts are not part of this cache download.
- Limak Atlantis is missing entirely from the master file, so no downstream data is generated.

### 🔍 How to verify rates after running `/hotelbed/process`

1. **Confirm contract coverage**  
   ```bash
   find downloads/hotelbed_cache_full_*/DESTINATIONS -name 'ID_B2B_*_14126_*'
   find downloads/hotelbed_cache_full_*/DESTINATIONS -name 'ID_B2B_*_87607_*'
   ```
   A non-empty result means the cache includes that hotel's contracts.
2. **Spot-check CSV output**  
   ```bash
   awk -F',' '$1==14126 {print; exit}' downloads/csv_output/hotel_rates.csv
   ```
   Replace the ID to verify other hotels. Expect rows only when contracts were present.
3. **Validate DB import**  
   ```sql
   SELECT COUNT(*) FROM hotel_rates WHERE hotel_id = 14126;
   ```
   Counts >0 confirm that the LOAD step populated Aurora.
4. **Escalate missing data**  
   If steps 1–3 fail for a target hotel, request the relevant `ID_B2B` contracts from HotelBeds or switch to the Availability API for that property.

## 🔧 Key Technical Details

### 1\. Filename Pattern Matching

```javascript
// Contract files: ID_B2B_97#APFLMRI3_14126_1_M_F
//                        ^contract  ^hotel ^version
const match = filename.match(/ID_B2B_\d+#[^_]+_(\d+)_/);
const hotelId = match[1]; // 14126
```

### 2\. Section Detection

```javascript
// Start: {SIIN}
const startMatch = line.match(/^\{([A-Z]+)\}$/);

// End: {/SIIN}
const endMatch = line.match(/^\{\/([A-Z]+)\}$/);
```

### 3\. Price Extraction

```javascript
// Input: (0.000,0.000,425.880)(,,)(0.000,0.000,450.00)
const regex = /\(([^,]*),([^,]*),([^)]+)\)/g;
const matches = [...pricesString.matchAll(regex)];

// Output: [425.880, 450.00]
const prices = matches.map(m => parseFloat(m[3])).filter(p => p > 0);
```

### 4\. Streaming for Performance

```javascript
// DON'T: Load entire file
const content = fs.readFileSync(filePath); // ❌ Memory issue

// DO: Stream line-by-line
const stream = createReadStream(filePath, {
  highWaterMark: 16 * 1024 * 1024  // 16MB buffer
});
const rl = createInterface({ input: stream });
```

### 5\. Batch Inserts

```javascript
// DON'T: Insert one by one
for (const row of rows) {
  await connection.query('INSERT INTO...', row); // ❌ Slow
}

// DO: Batch insert
const placeholders = batch.map(() => '(?,?,?,?,?,?)').join(',');
await connection.query(
  `INSERT INTO table VALUES ${placeholders}`,
  batch.flat()
);
```

## 🐛 Common Issues & Solutions

### Issue 1: Foreign Key Constraint

**Error**: `Cannot add or update a child row: a foreign key constraint fails`

**Solution**:

```javascript
await connection.query('SET FOREIGN_KEY_CHECKS=0');
// ... do imports
await connection.query('SET FOREIGN_KEY_CHECKS=1');
```

### Issue 2: CSV Parsing Quotes

**Problem**: CSV values with commas break parsing

**Solution**:

```javascript
// Use regex to handle quoted values
const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)
  .map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
```

### Issue 3: Memory Issues with Large Files

**Problem**: 207M records crash Node.js

**Solution**: Stream processing + batch writes

```javascript
// Stream read
const rl = readline.createInterface({ input: fileStream });

// Batch write
if (batch.length >= 1000) {
  await connection.query(sql, batch.flat());
  batch = [];
}
```

## 📈 Performance Metrics

| Task | Records | Time | Speed |
| --- | --- | --- | --- |
| Process contracts | 38,178 files | 805s | 47 files/sec |
| Generate inventory CSV | 331,851 | \~100s | 3,318/sec |
| Generate rates CSV | 207M | \~700s | 295K/sec |
| Import test hotels | 43,561 | \~90s | 484/sec |

## 🔮 Next Steps

### 1\. Full Database Import

For 207M records, use:

- AWS Data Pipeline
- Or split CSV into chunks
- Or use Aurora parallel load

### 2\. Missing Hotels

For hotels without contract files:

- Use HotelBeds Availability API
- Real-time pricing lookup
- Cache responses

### 3\. Optimization

- Add indexes on hotel_id, date_from, date_to
- Partition tables by date
- Use Aurora read replicas

## 📝 Quick Reference Commands

```bash
# Process all contracts
node process-contracts-simple.js

# Import test hotels only
node import-test-hotels-fixed.js

# Check pricing
node check-pricing.js

# Query database
mysql -h hotelbed-aurora-cluster.cluster-c2hokug86b13.us-east-1.rds.amazonaws.com \
  -P 3306 -u hotelbed -p'Aurora123!Secure' hotelbed_db

# Count records
SELECT COUNT(*) FROM hotel_rates WHERE hotel_id = 14126;

# Sample rates
SELECT * FROM hotel_rates WHERE hotel_id = 14126 LIMIT 10;
```

## 🎓 Key Learnings

1. **GHOT_F has real hotel names** - Not "Property X"
2. **Contract files (ID_B2B) contain pricing** - SIAP section
3. **Streaming is essential** - 207M records can't fit in memory
4. **Batch inserts are 100x faster** - Than individual inserts
5. **Not all hotels have contracts** - Some use real-time API
6. **Foreign keys can block imports** - Disable temporarily
7. **CSV parsing needs regex** - For quoted values with commas

## 🚨 Critical Files to Keep

1. `process-contracts-simple.js` - Main processor (FASTEST)
2. `src/utils/csvGenerator.ts` - Has all parsing logic
3. `import-test-hotels-fixed.js` - Database import
4. `check-pricing.js` - Verification
5. This document - Complete knowledge transfer

---

**Last Updated**: January 2025 **Status**: ✅ Working - Rixos Premium Belek verified with 43,561 rates **Next AI**: You have everything needed to conti