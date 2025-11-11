#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { createInterface } = require('readline');
const { format } = require('fast-csv');

// Dynamic path resolution - works on any device
console.log('🔍 Step 1: Resolving paths...');
const PROJECT_ROOT = path.resolve(__dirname);
console.log(`   Project Root: ${PROJECT_ROOT}`);

const DOWNLOADS_DIR = path.join(PROJECT_ROOT, 'downloads');
console.log(`   Downloads Dir: ${DOWNLOADS_DIR}`);

// Find the cache directory dynamically
function findCacheDirectory() {
  console.log('\n🔍 Step 2: Finding cache directory...');
  
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    throw new Error(`Downloads directory not found: ${DOWNLOADS_DIR}`);
  }
  console.log('   ✓ Downloads directory exists');

  const files = fs.readdirSync(DOWNLOADS_DIR);
  console.log(`   Found ${files.length} items in downloads:`);
  files.forEach(f => console.log(`      - ${f}`));
  
  const cacheDir = files.find(f => f.startsWith('hotelbed_cache_full_'));
  
  if (!cacheDir) {
    throw new Error('No cache directory found. Looking for: hotelbed_cache_full_*');
  }
  console.log(`   ✓ Found cache directory: ${cacheDir}`);

  return path.join(DOWNLOADS_DIR, cacheDir);
}

const CACHE_DIR = findCacheDirectory();
const OUTPUT_DIR = path.join(DOWNLOADS_DIR, 'csv_output');

console.log('\n📂 Configuration:');
console.log(`   Cache Dir: ${CACHE_DIR}`);
console.log(`   Output Dir: ${OUTPUT_DIR}`);

// Ensure output directory exists
console.log('\n🔍 Step 3: Creating output directory...');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('   ✓ Output directory created');
} else {
  console.log('   ✓ Output directory already exists');
}

// Create CSV writers
function createCSVWriters() {
  console.log('\n🔍 Step 4: Creating CSV writers...');
  const tables = ['hotel_inventory', 'hotel_rates'];
  const writers = {};

  for (const table of tables) {
    const filePath = path.join(OUTPUT_DIR, `${table}.csv`);
    console.log(`   Creating writer for: ${table}`);
    const writeStream = createWriteStream(filePath, { flags: 'w' });
    const csvStream = format({ headers: true, quote: '"' });
    
    csvStream.pipe(writeStream);
    
    writers[table] = {
      stream: csvStream,
      filePath: filePath,
      count: 0,
    };
    console.log(`   ✓ Writer created: ${filePath}`);
  }

  return writers;
}

// Close all CSV writers
async function closeWriters(writers) {
  const closePromises = Object.values(writers).map((writer) => {
    return new Promise((resolve) => {
      writer.stream.end(() => resolve());
    });
  });

  await Promise.all(closePromises);
}

// Extract hotel ID from filename
function extractHotelIdFromFilename(filename) {
  const parts = filename.split('_');
  
  if (parts.length >= 4) {
    const secondPart = parts[1];
    if (/^\d+$/.test(secondPart)) {
      const hotelId = parseInt(secondPart);
      if (hotelId > 0) return hotelId;
    }
  }

  const numericParts = parts.filter(part => /^\d+$/.test(part));
  if (numericParts.length >= 2) {
    const hotelId = parseInt(numericParts[1]);
    if (hotelId > 0) return hotelId;
  }

  if (numericParts.length > 0) {
    const largestNumeric = numericParts
      .map(p => parseInt(p))
      .filter(n => n > 0)
      .sort((a, b) => b - a)[0];
    if (largestNumeric) return largestNumeric;
  }

  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Write inventory from SIIN section
function writeInventoryFromSIIN(writer, hotelId, lines) {
  if (!lines || lines.length === 0) return;

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 6) {
      writer.stream.write({
        hotel_id: hotelId,
        room_code: parts[3] || null,
        board_code: parts[4] || null,
        date_from: parts[0] || null,
        date_to: parts[1] || null,
        availability_data: parts[5] || null,
      });
      writer.count++;
    }
  }
}

// Write rates from SIAP section
function writeRatesFromSIAP(writer, hotelId, lines) {
  if (!lines || lines.length === 0) return;

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 10) {
      const pricesString = parts[9] || '';
      const priceMatches = pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g);

      for (const match of priceMatches) {
        const price = parseFloat(match[3]);
        if (price > 0) {
          writer.stream.write({
            hotel_id: hotelId,
            room_code: parts[3] || null,
            board_code: parts[4] || null,
            date_from: parts[0] || null,
            date_to: parts[1] || null,
            rate_type: 'N',
            base_price: 0,
            tax_amount: 0,
            adults: parseInt(parts[6]) || 0,
            board_type: parts[4] || null,
            price: price,
          });
          writer.count++;
        }
      }
    }
  }
}

// Process single hotel contract file
async function processHotelFile(writers, filePath, hotelId) {
  return new Promise((resolve) => {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 50 * 1024 * 1024) {
        console.log(`   ⚠️  Skipping large file: ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(false);
        return;
      }

      const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

      let currentSection = null;
      const currentLines = [];

      rl.on('line', (line) => {
        const sectionStartMatch = line.match(/^\{([A-Z]+)\}$/);
        if (sectionStartMatch) {
          if (currentSection && currentLines.length > 0) {
            writeSectionToCSV(writers, hotelId, currentSection, currentLines);
            currentLines.length = 0;
          }
          currentSection = sectionStartMatch[1];
          return;
        }

        const sectionEndMatch = line.match(/^\{\/([A-Z]+)\}$/);
        if (sectionEndMatch && currentSection) {
          if (currentLines.length > 0) {
            writeSectionToCSV(writers, hotelId, currentSection, currentLines);
            currentLines.length = 0;
          }
          currentSection = null;
          return;
        }

        if (currentSection && line.trim()) {
          currentLines.push(line.trim());
        }
      });

      rl.on('close', () => {
        if (currentSection && currentLines.length > 0) {
          writeSectionToCSV(writers, hotelId, currentSection, currentLines);
        }
        resolve(true);
      });

      rl.on('error', () => {
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

// Write section data to CSV
function writeSectionToCSV(writers, hotelId, section, lines) {
  switch (section) {
    case 'SIIN':
      writeInventoryFromSIIN(writers.hotel_inventory, hotelId, lines);
      break;
    case 'SIAP':
      writeRatesFromSIAP(writers.hotel_rates, hotelId, lines);
      break;
  }
}

// Get CSV summary
function getCSVSummary(writers) {
  const summary = {};
  
  for (const [table, writer] of Object.entries(writers)) {
    const stats = fs.statSync(writer.filePath);
    summary[table] = {
      records: writer.count,
      fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
      filePath: writer.filePath,
    };
  }

  return summary;
}

// Main processing function
async function processContracts() {
  console.log('\n🚀 Starting contract file processing...\n');
  
  const writers = createCSVWriters();
  
  console.log('\n🔍 Step 5: Checking DESTINATIONS folder...');
  const destinationsPath = path.join(CACHE_DIR, 'DESTINATIONS');
  console.log(`   Path: ${destinationsPath}`);
  
  if (!fs.existsSync(destinationsPath)) {
    throw new Error(`DESTINATIONS folder not found: ${destinationsPath}`);
  }
  console.log('   ✓ DESTINATIONS folder exists');
  
  const destFolders = fs.readdirSync(destinationsPath).filter(f => f.startsWith('D_'));
  console.log(`   ✓ Found ${destFolders.length} destination folders`);
  
  console.log('\n🔍 Step 6: Processing contract files...');
  console.log(`   Looking for files starting with: ID_B2B\n`);
  
  let totalFiles = 0;
  let processedFiles = 0;
  let skippedFiles = 0;
  let foldersWithContracts = 0;
  
  for (const destFolder of destFolders) {
    const destPath = path.join(destinationsPath, destFolder);
    const files = fs.readdirSync(destPath).filter(f => f.startsWith('ID_B2B'));
    
    if (files.length === 0) continue;
    
    foldersWithContracts++;
    console.log(`📁 ${destFolder}: ${files.length} contract files`);
    
    for (const file of files) {
      totalFiles++;
      const filePath = path.join(destPath, file);
      const hotelId = extractHotelIdFromFilename(file);
      
      if (!hotelId) {
        console.log(`   ⚠️  Could not extract hotel ID from: ${file}`);
        skippedFiles++;
        continue;
      }
      
      if (totalFiles <= 5) {
        console.log(`   Processing: ${file} (Hotel ID: ${hotelId})`);
      }
      
      const success = await processHotelFile(writers, filePath, hotelId);
      if (success) {
        processedFiles++;
      } else {
        skippedFiles++;
      }
      
      // Progress indicator
      if (totalFiles % 100 === 0) {
        process.stdout.write(`\r   Progress: ${processedFiles}/${totalFiles} files processed...`);
      }
    }
  }
  
  console.log(`\n   ✓ Processed ${foldersWithContracts} folders with contracts`);
  
  console.log('\n\n🔍 Step 7: Closing CSV writers...');
  await closeWriters(writers);
  console.log('   ✓ All writers closed');
  
  console.log('\n✅ Processing complete!');
  console.log(`📊 Total: ${totalFiles} files`);
  console.log(`   ✓ Processed: ${processedFiles}`);
  console.log(`   ✗ Skipped: ${skippedFiles}`);
  
  console.log('\n📈 CSV Summary:');
  const summary = getCSVSummary(writers);
  for (const [table, stats] of Object.entries(summary)) {
    if (stats.records > 0) {
      console.log(`   ${table}: ${stats.records.toLocaleString()} records (${stats.fileSizeMB} MB)`);
    } else {
      console.log(`   ${table}: 0 records (no data)`);
    }
  }
  
  console.log('\n✨ Done! CSV files are ready in:', OUTPUT_DIR);
}

// Run the script
processContracts().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
