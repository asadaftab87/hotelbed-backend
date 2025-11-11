import fs from 'fs';
import path from 'path';
import { CSVGenerator } from './src/utils/csvGenerator';

// Dynamic path resolution - works on any device
const PROJECT_ROOT = path.resolve(__dirname);
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, 'downloads');

// Find the cache directory dynamically
function findCacheDirectory(): string {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    throw new Error(`Downloads directory not found: ${DOWNLOADS_DIR}`);
  }

  const files = fs.readdirSync(DOWNLOADS_DIR);
  const cacheDir = files.find(f => f.startsWith('hotelbed_cache_full_'));
  
  if (!cacheDir) {
    throw new Error('No cache directory found. Looking for: hotelbed_cache_full_*');
  }

  return path.join(DOWNLOADS_DIR, cacheDir);
}

const CACHE_DIR = findCacheDirectory();
const OUTPUT_DIR = path.join(DOWNLOADS_DIR, 'csv_output');

console.log('📂 Configuration:');
console.log(`   Cache Dir: ${CACHE_DIR}`);
console.log(`   Output Dir: ${OUTPUT_DIR}\n`);

async function processContracts() {
  console.log('🚀 Starting contract file processing...');
  
  const csvGen = new CSVGenerator(OUTPUT_DIR);
  const writers = csvGen.createCSVWriters();
  
  const destinationsPath = path.join(CACHE_DIR, 'DESTINATIONS');
  
  if (!fs.existsSync(destinationsPath)) {
    throw new Error(`DESTINATIONS folder not found: ${destinationsPath}`);
  }
  
  const destFolders = fs.readdirSync(destinationsPath).filter(f => f.startsWith('D_'));
  
  console.log(`📍 Found ${destFolders.length} destination folders\n`);
  
  let totalFiles = 0;
  let processedFiles = 0;
  let skippedFiles = 0;
  
  for (const destFolder of destFolders) {
    const destPath = path.join(destinationsPath, destFolder);
    const files = fs.readdirSync(destPath).filter(f => f.startsWith('ID_B2B'));
    
    if (files.length === 0) continue;
    
    console.log(`📁 ${destFolder}: ${files.length} contract files`);
    
    for (const file of files) {
      totalFiles++;
      const filePath = path.join(destPath, file);
      const hotelId = csvGen.extractHotelIdFromFilename(file);
      
      if (hotelId) {
        const success = await csvGen.processHotelFile(writers, filePath, hotelId);
        if (success) {
          processedFiles++;
        } else {
          skippedFiles++;
        }
      } else {
        skippedFiles++;
      }
      
      // Progress indicator
      if (totalFiles % 100 === 0) {
        process.stdout.write(`\r   Progress: ${processedFiles}/${totalFiles} files processed...`);
      }
    }
  }
  
  console.log('\n\n⏳ Closing CSV writers...');
  await csvGen.closeWriters(writers);
  
  console.log('\n✅ Processing complete!');
  console.log(`📊 Total: ${totalFiles} files`);
  console.log(`   ✓ Processed: ${processedFiles}`);
  console.log(`   ✗ Skipped: ${skippedFiles}`);
  
  console.log('\n📈 CSV Summary:');
  const summary = csvGen.getCSVSummary(writers);
  for (const [table, stats] of Object.entries(summary)) {
    if (stats.records > 0) {
      console.log(`   ${table}: ${stats.records.toLocaleString()} records (${stats.fileSizeMB} MB)`);
    }
  }
  
  console.log('\n📊 Duplicate Detection Stats:');
  csvGen.logDuplicateSummary();
}

processContracts().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
