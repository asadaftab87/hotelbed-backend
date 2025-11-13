# 🚀 Upload and Load Endpoint - Implementation Complete

## ✅ Overview
Created a dedicated endpoint for uploading existing CSV files to S3 and loading them into Aurora database, skipping the CSV generation step.

## 📍 Endpoint Details

**Route:** `POST /api/v1/hotelbed/upload-and-load`

**Purpose:** Upload pre-generated CSV files from `downloads/csv_output/` to S3 and load into Aurora database

**Use Case:** When CSV files are already generated and you only need to upload to S3 and load to database

---

## 📦 Implementation Architecture

### 1. Route Layer
**File:** `/src/api/components/hotelBed/hotelBed.routes.ts`

```typescript
router.post('/upload-and-load', controller.uploadAndLoad);
```

### 2. Controller Layer
**File:** `/src/api/components/hotelBed/hotelBed.controller.ts`

```typescript
uploadAndLoad = asyncHandler(async (req, res, next) => {
  const result = await this.service.uploadAndLoadCSVs();
  new SuccessResponse(
    'CSVs uploaded to S3 and loaded to Aurora successfully', 
    result
  ).send(res);
});
```

### 3. Service Layer
**File:** `/src/api/components/hotelBed/hotelBed.service.ts`

```typescript
async uploadAndLoadCSVs() {
  const startTime = Date.now();
  
  Logger.info('=== Starting CSV Upload and Aurora Load ===');
  
  try {
    // Call repository method
    const result = await this.repository.uploadAndLoadExistingCSVs();
    
    const totalDuration = Date.now() - startTime;
    
    return {
      success: true,
      ...result,
      totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    Logger.error('❌ Upload and load failed:', error);
    throw error;
  }
}
```

### 4. Repository Layer
**File:** `/src/api/components/hotelBed/hotelBed.repository.ts`

```typescript
async uploadAndLoadExistingCSVs() {
  const startTime = Date.now();
  
  Logger.info('📂 Verifying CSV files exist...');
  
  // Step 1: Verify CSVs exist
  if (!fs.existsSync(this.csvDir)) {
    throw new Error(`CSV directory not found: ${this.csvDir}`);
  }
  
  const csvFiles = fs.readdirSync(this.csvDir).filter(f => f.endsWith('.csv'));
  
  if (csvFiles.length === 0) {
    throw new Error('No CSV files found in output directory. Generate CSVs first.');
  }
  
  Logger.info(`✅ Found ${csvFiles.length} CSV files`);
  csvFiles.forEach(file => Logger.info(`   - ${file}`));
  
  // Step 2: Upload CSVs to S3
  Logger.info('\n📤 Uploading CSV files to S3...');
  const s3Result = await this.uploadCSVsToS3();
  
  Logger.info(`✅ S3 Upload complete: ${s3Result.filesUploaded} files uploaded in ${s3Result.duration}`);
  
  // Step 3: Load data from S3 to Aurora
  Logger.info('\n📥 Loading data from S3 to Aurora...');
  const loadResult = await this.loadFromS3ToAurora(s3Result.locations);
  
  Logger.info(`✅ Aurora load complete in ${loadResult.duration}`);
  
  const totalDuration = Date.now() - startTime;
  
  return {
    success: true,
    csvFiles: csvFiles.length,
    s3: s3Result,
    load: loadResult,
    totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
  };
}
```

---

## 🔄 Process Flow

```
1. Client Request → POST /api/v1/hotelbed/upload-and-load
                 ↓
2. Controller    → uploadAndLoad()
                 ↓
3. Service       → uploadAndLoadCSVs()
                 ↓
4. Repository    → uploadAndLoadExistingCSVs()
                 ↓
5. Verify CSVs   → Check downloads/csv_output/ directory
                 ↓
6. Upload to S3  → uploadCSVsToS3() (existing method)
                 ↓
7. Load to Aurora → loadFromS3ToAurora() (existing method)
                 ↓
8. Return Results
```

---

## 📊 Response Format

```json
{
  "statusCode": "10000",
  "message": "CSVs uploaded to S3 and loaded to Aurora successfully",
  "data": {
    "success": true,
    "csvFiles": 15,
    "s3": {
      "success": true,
      "filesUploaded": 15,
      "locations": {
        "hotels": "s3://bucket/path/hotels.csv",
        "destinations": "s3://bucket/path/destinations.csv",
        // ... other files
      },
      "duration": "45.32s"
    },
    "load": {
      "success": true,
      "tablesLoaded": 15,
      "results": [
        {
          "table": "chains",
          "rowsInserted": 1500,
          "success": true
        },
        // ... other tables
      ],
      "duration": "120.45s"
    },
    "totalDuration": "165.77s",
    "timestamp": "2025-01-13T10:30:00.000Z"
  }
}
```

---

## 🎯 Use Cases

### 1. **After CSV Generation**
If you've already generated CSVs using the import-only endpoint or process-data endpoint, you can re-upload and load without re-generating:

```bash
curl -X POST http://localhost:3000/api/v1/hotelbed/upload-and-load
```

### 2. **Testing Load Process**
Test the S3 upload and Aurora load process without re-parsing source files:

```bash
# Generate CSVs once
POST /api/v1/hotelbed/import-only?folder=hotelbed_cache_full_1234

# Then re-upload/load multiple times for testing
POST /api/v1/hotelbed/upload-and-load
POST /api/v1/hotelbed/upload-and-load  # Can repeat
```

### 3. **Recovering from Load Failures**
If the Aurora load fails but CSVs are valid, you can retry without re-generating:

```bash
# First attempt failed during load
POST /api/v1/hotelbed/upload-and-load

# Fix database issue, then retry
POST /api/v1/hotelbed/upload-and-load
```

---

## ⚠️ Prerequisites

1. **CSV files must exist** in `downloads/csv_output/` directory
2. **S3 bucket must be configured** (credentials in environment variables)
3. **Aurora database must be accessible** (connection configured)
4. **S3 integration must be enabled** on Aurora cluster

---

## 🔍 Validation Checks

The endpoint performs these validations:

1. ✅ CSV output directory exists
2. ✅ At least one CSV file is present
3. ✅ S3 upload succeeds for all files
4. ✅ Aurora LOAD DATA succeeds for all tables

---

## 📝 Error Handling

### CSV Files Not Found
```json
{
  "statusCode": "10001",
  "message": "No CSV files found in output directory. Generate CSVs first."
}
```

### S3 Upload Failure
```json
{
  "statusCode": "10001",
  "message": "S3 upload failed: [specific error]"
}
```

### Aurora Load Failure
```json
{
  "statusCode": "10001",
  "message": "Aurora load failed: [specific error]"
}
```

---

## 🚀 Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /process-data` | Download ZIP → Extract → Generate CSVs → Upload to S3 → Load to Aurora |
| `POST /import-only` | Skip download → Extract existing → Generate CSVs → Upload to S3 → Load to Aurora |
| `POST /upload-and-load` | **Skip download & generation** → Upload existing CSVs to S3 → Load to Aurora |

---

## ✅ Benefits

1. **Faster Testing**: Re-upload and load without re-parsing 15GB+ of source data
2. **Error Recovery**: Retry load process if it fails partway through
3. **Debugging**: Isolate S3 upload and Aurora load steps from CSV generation
4. **Flexibility**: Manually edit CSVs and re-load without full re-import

---

**Created:** 2025-01-13  
**Status:** ✅ **Implementation Complete - Ready for Testing**

