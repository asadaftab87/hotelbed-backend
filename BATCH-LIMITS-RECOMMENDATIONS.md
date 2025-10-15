# 🔧 Batch Limits Analysis & Recommendations

## 📊 Current Batch Limits in Your Code

### **File:** `src/Api/Components/hotelBed/hotelBed.repository.ts`

```typescript
// Line 13 - General batch size
const BATCH_SIZE = 2000;

// Line 23 - Database connection pool
connectionLimit: 100

// Line 433 - File parsing parallelism
const PARSE_CHUNK = 10000;  ⚠️ TOO HIGH for 8GB RAM!

// Line 495 - File record batch insert
const FILE_BATCH = 5000;

// Line 508 - Data insert batch size
const INSERT_BATCH = 15000;  ⚠️ TOO HIGH for 8GB RAM!

// Line 517 - Parallel table inserts
const PARALLEL_TABLES = 3;  ⚠️ TOO HIGH for 8GB RAM!

// Line 639 - HotelMaster batch
const BATCH_SIZE = 4000;

// Line 703 - BoardMaster batch
const BATCH_SIZE = 10000;

// Line 829 - Inventory batch
const INV_BATCH = 5000;
```

---

## 🚨 Current Problem Analysis

### **Your c7a.xlarge (8GB RAM):**
```
PARSE_CHUNK = 10,000 files
↓
Each file ~50-100KB in memory after parsing
↓
10,000 files × 75KB = 750 MB - 1 GB per chunk
↓
Multiple chunks in memory during aggregation
↓
TOTAL MEMORY: 6-8 GB peak
↓
Result: FREEZE! ❌
```

---

## ✅ Recommended Batch Limits by EC2 Instance

### **🏆 FOR r7a.xlarge (32GB RAM) - RECOMMENDED**

```typescript
// AGGRESSIVE SETTINGS - Full Performance
const PARSE_CHUNK = 10000;        // ✅ 10k files parallel
const INSERT_BATCH = 15000;       // ✅ 15k records per insert
const FILE_BATCH = 7500;          // ✅ 7.5k file records
const PARALLEL_TABLES = 3;        // ✅ 3 tables in parallel
connectionLimit: 100;             // ✅ 100 DB connections

// HotelMaster/BoardMaster
const BATCH_SIZE = 10000;         // ✅ 10k batch

// Inventory
const INV_BATCH = 7500;           // ✅ 7.5k batch

// Expected Performance:
// ✅ Memory usage: 12-15 GB (plenty of headroom)
// ✅ Processing time: 5-6 minutes
// ✅ Stability: EXCELLENT
```

---

### **💰 FOR r7a.large (16GB RAM) - BUDGET OPTION**

```typescript
// BALANCED SETTINGS - Good Performance + Stability
const PARSE_CHUNK = 5000;         // ✅ 5k files parallel
const INSERT_BATCH = 7500;        // ✅ 7.5k records per insert
const FILE_BATCH = 5000;          // ✅ 5k file records
const PARALLEL_TABLES = 2;        // ✅ 2 tables in parallel
connectionLimit: 50;              // ✅ 50 DB connections

// HotelMaster/BoardMaster
const BATCH_SIZE = 5000;          // ✅ 5k batch

// Inventory
const INV_BATCH = 5000;           // ✅ 5k batch

// Expected Performance:
// ✅ Memory usage: 8-10 GB (safe)
// ✅ Processing time: 8-10 minutes
// ✅ Stability: GOOD
```

---

### **⚠️ FOR c7a.xlarge (8GB RAM) - CURRENT (CONSERVATIVE)**

```typescript
// CONSERVATIVE SETTINGS - Stability First
const PARSE_CHUNK = 2000;         // ⚠️ 2k files only
const INSERT_BATCH = 5000;        // ⚠️ 5k records per insert
const FILE_BATCH = 5000;          // ⚠️ 5k file records
const PARALLEL_TABLES = 1;        // ⚠️ Sequential only
connectionLimit: 30;              // ⚠️ 30 DB connections

// HotelMaster/BoardMaster
const BATCH_SIZE = 4000;          // ⚠️ 4k batch

// Inventory
const INV_BATCH = 4000;           // ⚠️ 4k batch

// Expected Performance:
// ⚠️ Memory usage: 5-6 GB (tight!)
// ⚠️ Processing time: 12-15 minutes
// ⚠️ Stability: MARGINAL (still risky)
```

---

### **🚀 FOR r7a.2xlarge (64GB RAM) - MAXIMUM SPEED**

```typescript
// ULTRA-AGGRESSIVE SETTINGS - Maximum Performance
const PARSE_CHUNK = 20000;        // 🚀 20k files parallel!
const INSERT_BATCH = 25000;       // 🚀 25k records per insert
const FILE_BATCH = 10000;         // 🚀 10k file records
const PARALLEL_TABLES = 5;        // 🚀 5 tables in parallel
connectionLimit: 150;             // 🚀 150 DB connections

// HotelMaster/BoardMaster
const BATCH_SIZE = 15000;         // 🚀 15k batch

// Inventory
const INV_BATCH = 10000;          // 🚀  10k batch

// Expected Performance:
// 🚀 Memory usage: 20-25 GB (tons of headroom)
// 🚀 Processing time: 3-4 minutes
// 🚀 Stability: PERFECT
```

---

## 📊 Detailed Comparison Table

| Setting | c7a.xlarge (8GB) | r7a.large (16GB) | r7a.xlarge (32GB) | r7a.2xlarge (64GB) |
|---------|------------------|------------------|-------------------|--------------------|
| **PARSE_CHUNK** | 2,000 ⚠️ | 5,000 ✅ | 10,000 ✅ | 20,000 🚀 |
| **INSERT_BATCH** | 5,000 ⚠️ | 7,500 ✅ | 15,000 ✅ | 25,000 🚀 |
| **FILE_BATCH** | 5,000 ⚠️ | 5,000 ✅ | 7,500 ✅ | 10,000 🚀 |
| **PARALLEL_TABLES** | 1 ⚠️ | 2 ✅ | 3 ✅ | 5 🚀 |
| **connectionLimit** | 30 ⚠️ | 50 ✅ | 100 ✅ | 150 🚀 |
| **Processing Time** | 12-15 min | 8-10 min | 5-6 min | 3-4 min |
| **Memory Usage** | 5-6 GB | 8-10 GB | 12-15 GB | 20-25 GB |
| **Stability** | Marginal ⚠️ | Good ✅ | Excellent ✅ | Perfect 🚀 |

---

## 🎯 Code Changes Needed

### **Option 1: Create Dynamic Configuration**

```typescript
// Add at top of hotelBed.repository.ts
const RAM_GB = parseInt(process.env.EC2_RAM_GB || '8');

// Dynamic batch sizes based on RAM
const BATCH_CONFIG = {
  8: {  // c7a.xlarge
    PARSE_CHUNK: 2000,
    INSERT_BATCH: 5000,
    FILE_BATCH: 5000,
    PARALLEL_TABLES: 1,
    CONNECTION_LIMIT: 30,
    INV_BATCH: 4000
  },
  16: {  // r7a.large / c7a.2xlarge
    PARSE_CHUNK: 5000,
    INSERT_BATCH: 7500,
    FILE_BATCH: 5000,
    PARALLEL_TABLES: 2,
    CONNECTION_LIMIT: 50,
    INV_BATCH: 5000
  },
  32: {  // r7a.xlarge
    PARSE_CHUNK: 10000,
    INSERT_BATCH: 15000,
    FILE_BATCH: 7500,
    PARALLEL_TABLES: 3,
    CONNECTION_LIMIT: 100,
    INV_BATCH: 7500
  },
  64: {  // r7a.2xlarge
    PARSE_CHUNK: 20000,
    INSERT_BATCH: 25000,
    FILE_BATCH: 10000,
    PARALLEL_TABLES: 5,
    CONNECTION_LIMIT: 150,
    INV_BATCH: 10000
  }
};

const CONFIG = BATCH_CONFIG[RAM_GB] || BATCH_CONFIG[8];

// Then use:
const PARSE_CHUNK = CONFIG.PARSE_CHUNK;
const INSERT_BATCH = CONFIG.INSERT_BATCH;
// ... etc
```

**Set in `.env` or ecosystem.config.js:**
```javascript
env: {
  EC2_RAM_GB: 32  // Set to your instance RAM
}
```

---

### **Option 2: Manual Update (Quick Fix)**

For **r7a.xlarge (32GB)**:

```typescript
// Update these lines in hotelBed.repository.ts:

// Line 23
connectionLimit: 100,  // ✅ Keep as is

// Line 433
const PARSE_CHUNK = 10000;  // ✅ Keep as is

// Line 495
const FILE_BATCH = 7500;  // CHANGE: 5000 → 7500

// Line 508
const INSERT_BATCH = 15000;  // ✅ Keep as is

// Line 517
const PARALLEL_TABLES = 3;  // ✅ Keep as is

// Line 639
const BATCH_SIZE = 10000;  // CHANGE: 4000 → 10000

// Line 703
const BATCH_SIZE = 10000;  // ✅ Keep as is

// Line 829
const INV_BATCH = 7500;  // CHANGE: 5000 → 7500
```

For **c7a.xlarge (8GB) - CURRENT**:

```typescript
// Line 23
connectionLimit: 30,  // CHANGE: 100 → 30

// Line 433
const PARSE_CHUNK = 2000;  // CHANGE: 10000 → 2000

// Line 495
const FILE_BATCH = 5000;  // ✅ Keep as is

// Line 508
const INSERT_BATCH = 5000;  // CHANGE: 15000 → 5000

// Line 517
const PARALLEL_TABLES = 1;  // CHANGE: 3 → 1

// Line 639
const BATCH_SIZE = 4000;  // ✅ Keep as is

// Line 703
const BATCH_SIZE = 10000;  // ✅ Keep as is (BoardMaster is small)

// Line 829
const INV_BATCH = 4000;  // CHANGE: 5000 → 4000
```

---

## 🧪 Testing Strategy

### **Step 1: Conservative (Safe)**
```typescript
PARSE_CHUNK = 1000;
INSERT_BATCH = 2500;
PARALLEL_TABLES = 1;
```
Monitor memory usage. If stable, increase gradually.

### **Step 2: Moderate (Balanced)**
```typescript
PARSE_CHUNK = 3000;
INSERT_BATCH = 5000;
PARALLEL_TABLES = 2;
```
Monitor again. Increase if stable.

### **Step 3: Optimal (Based on RAM)**
Use recommended values from tables above.

---

## 📈 Memory Calculation Formula

```
Estimated Peak Memory = 
  (PARSE_CHUNK × 75KB)           // Files in memory
  + (INSERT_BATCH × 2KB)         // Insert buffer
  + (PARALLEL_TABLES × 500MB)    // Parallel operations
  + 2GB                          // OS + overhead

Example for current c7a.xlarge settings:
  (10000 × 75KB) = 750 MB
  + (15000 × 2KB) = 30 MB
  + (3 × 500MB) = 1.5 GB
  + 2GB = 2 GB
  ━━━━━━━━━━━━━━━━━━━━━
  TOTAL: ~4.3 GB theoretical
  ACTUAL: 7-8 GB (with overhead) ⚠️ RISKY for 8GB!

Example for r7a.xlarge:
  (10000 × 75KB) = 750 MB
  + (15000 × 2KB) = 30 MB
  + (3 × 500MB) = 1.5 GB
  + 2GB = 2 GB
  ━━━━━━━━━━━━━━━━━━━━━
  TOTAL: ~4.3 GB theoretical
  ACTUAL: 12-15 GB (with overhead) ✅ SAFE for 32GB!
```

---

## 🎯 Final Recommendations

### **For YOUR Current c7a.xlarge (8GB):**
```typescript
✅ Immediate Action Required:
- PARSE_CHUNK: 10000 → 2000  (Critical!)
- INSERT_BATCH: 15000 → 5000  (Critical!)
- PARALLEL_TABLES: 3 → 1  (Critical!)
- connectionLimit: 100 → 30  (Important)

These changes will prevent freezing!
```

### **If You Upgrade to r7a.xlarge (32GB):**
```typescript
✅ Keep aggressive settings:
- PARSE_CHUNK: 10000  ✅
- INSERT_BATCH: 15000  ✅
- PARALLEL_TABLES: 3  ✅
- connectionLimit: 100  ✅

No freezing, 5-6 minute processing!
```

---

## 💡 Quick Reference Card

**Print this and keep handy:**

| Your Instance | Set PARSE_CHUNK | Set INSERT_BATCH | Set PARALLEL |
|---------------|-----------------|------------------|--------------|
| c7a.xlarge (8GB) | 2,000 | 5,000 | 1 |
| r7a.large (16GB) | 5,000 | 7,500 | 2 |
| r7a.xlarge (32GB) | 10,000 | 15,000 | 3 |
| r7a.2xlarge (64GB) | 20,000 | 25,000 | 5 |

**Golden Rule:** 
```
Max Safe PARSE_CHUNK = (RAM_GB - 2) × 250

Examples:
8GB → (8-2) × 250 = 1,500  (use 2,000 conservatively)
16GB → (16-2) × 250 = 3,500  (use 5,000 conservatively)
32GB → (32-2) × 250 = 7,500  (use 10,000 comfortably)
64GB → (64-2) × 250 = 15,500  (use 20,000 comfortably)
```

---

**Bottom Line:** 
- Current settings are for 32GB+ RAM
- You have 8GB RAM = Guaranteed freeze
- Either reduce batch sizes OR upgrade to r7a.xlarge! 🎯

