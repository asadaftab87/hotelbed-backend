#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');

// Dynamic path resolution
const PROJECT_ROOT = path.resolve(__dirname);
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, 'downloads');

function findCacheDirectory() {
  const files = fs.readdirSync(DOWNLOADS_DIR);
  const cacheDir = files.find(f => f.startsWith('hotelbed_cache_full_'));
  if (!cacheDir) throw new Error('Cache directory not found');
  return path.join(DOWNLOADS_DIR, cacheDir);
}

const CACHE_DIR = findCacheDirectory();
const OUTPUT_DIR = path.join(DOWNLOADS_DIR, 'csv_output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🚀 Fast Contract Processor\n');
console.log('📂 Configuration:');
console.log(`   Cache: ${CACHE_DIR}`);
console.log(`   Output: ${OUTPUT_DIR}\n`);

// Extract hotel ID from filename
function extractHotelId(filename) {
  const match = filename.match(/ID_B2B_\d+#[^_]+_(\d+)_/);
  if (match) return parseInt(match[1]);
  
  const parts = filename.split('_');
  const nums = parts.filter(p => /^\d+$/.test(p)).map(n => parseInt(n));
  return nums.length >= 2 ? nums[1] : (nums[0] || null);
}

// Fast file processor - reads entire file at once
function processFileFast(filePath, hotelId) {
  const content = fs.readFileSync(filePath, 'utf8');
  const inventory = [];
  const rates = [];
  
  // Extract SIIN section (inventory)
  const siinMatch = content.match(/\{SIIN\}([\s\S]*?)\{\/SIIN\}/);
  if (siinMatch) {
    const lines = siinMatch[1].trim().split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 6) {
        inventory.push({
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
  
  // Extract SIAP section (pricing)
  const siapMatch = content.match(/\{SIAP\}([\s\S]*?)\{\/SIAP\}/);
  if (siapMatch) {
    const lines = siapMatch[1].trim().split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 10) {
        const pricesString = parts[9];
        const priceMatches = [...pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g)];
        
        for (const match of priceMatches) {
          const price = parseFloat(match[3]);
          if (price > 0) {
            rates.push({
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
  
  return { inventory, rates };
}

// Convert to CSV format
function toCSV(data, headers) {
  const lines = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      return val === null || val === undefined ? '' : val;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

async function processContracts() {
  console.log('🔍 Step 1: Scanning for contract files...');
  
  const destinationsPath = path.join(CACHE_DIR, 'DESTINATIONS');
  const destFolders = fs.readdirSync(destinationsPath).filter(f => f.startsWith('D_'));
  
  // Collect all contract files
  const allFiles = [];
  for (const destFolder of destFolders) {
    const destPath = path.join(destinationsPath, destFolder);
    const files = fs.readdirSync(destPath).filter(f => f.startsWith('ID_B2B'));
    
    for (const file of files) {
      allFiles.push({
        path: path.join(destPath, file),
        name: file,
        hotelId: extractHotelId(file)
      });
    }
  }
  
  console.log(`   ✓ Found ${allFiles.length} contract files\n`);
  
  console.log('🔍 Step 2: Processing files in batches...');
  
  const allInventory = [];
  const allRates = [];
  let processed = 0;
  const batchSize = 100;
  
  const startTime = Date.now();
  
  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    
    for (const file of batch) {
      if (!file.hotelId) continue;
      
      try {
        const stats = fs.statSync(file.path);
        if (stats.size > 50 * 1024 * 1024) continue; // Skip files > 50MB
        
        const result = processFileFast(file.path, file.hotelId);
        allInventory.push(...result.inventory);
        allRates.push(...result.rates);
        processed++;
      } catch (err) {
        // Skip failed files
      }
    }
    
    const progress = Math.round((i + batch.length) / allFiles.length * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${processed}/${allFiles.length} files, ${elapsed}s)`);
  }
  
  console.log('\n\n🔍 Step 3: Writing CSV files...');
  
  // Write inventory CSV
  if (allInventory.length > 0) {
    const inventoryCSV = toCSV(allInventory, [
      'hotel_id', 'room_code', 'board_code', 'date_from', 'date_to', 'availability_data'
    ]);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'hotel_inventory.csv'), inventoryCSV);
    console.log(`   ✓ hotel_inventory.csv: ${allInventory.length.toLocaleString()} records`);
  }
  
  // Write rates CSV
  if (allRates.length > 0) {
    const ratesCSV = toCSV(allRates, [
      'hotel_id', 'room_code', 'board_code', 'date_from', 'date_to', 
      'rate_type', 'base_price', 'tax_amount', 'adults', 'board_type', 'price'
    ]);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'hotel_rates.csv'), ratesCSV);
    console.log(`   ✓ hotel_rates.csv: ${allRates.length.toLocaleString()} records`);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n✅ Processing complete!');
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log(`📊 Files processed: ${processed}/${allFiles.length}`);
  console.log(`📈 Total records: ${(allInventory.length + allRates.length).toLocaleString()}`);
  console.log(`\n✨ CSV files ready in: ${OUTPUT_DIR}`);
}

processContracts().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
