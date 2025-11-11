import fs from 'fs';
import path from 'path';
import { CSVGenerator } from './src/utils/csvGenerator';

const PROJECT_ROOT = __dirname;
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, 'downloads');

function findCacheDir(): string {
  const files = fs.readdirSync(DOWNLOADS_DIR);
  const cache = files.find(f => f.startsWith('hotelbed_cache_full_'));
  if (!cache) throw new Error('Cache not found');
  return path.join(DOWNLOADS_DIR, cache);
}

const CACHE_DIR = findCacheDir();
const OUTPUT_DIR = path.join(DOWNLOADS_DIR, 'csv_output');

console.log('🚀 Contract Processor\n');
console.log(`Cache: ${CACHE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}\n`);

async function main() {
  const csvGen = new CSVGenerator(OUTPUT_DIR);
  const writers = csvGen.createCSVWriters();
  
  const destPath = path.join(CACHE_DIR, 'DESTINATIONS');
  const folders = fs.readdirSync(destPath).filter(f => f.startsWith('D_'));
  
  console.log(`Found ${folders.length} destination folders\n`);
  
  let total = 0, processed = 0;
  const start = Date.now();
  
  for (const folder of folders) {
    const folderPath = path.join(destPath, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.startsWith('ID_B2B'));
    
    if (files.length === 0) continue;
    
    console.log(`📁 ${folder}: ${files.length} files`);
    
    for (const file of files) {
      total++;
      const filePath = path.join(folderPath, file);
      const hotelId = csvGen.extractHotelIdFromFilename(file);
      
      if (hotelId) {
        const success = await csvGen.processHotelFile(writers, filePath, hotelId);
        if (success) processed++;
      }
      
      if (total % 50 === 0) {
        process.stdout.write(`\r   ${processed}/${total} processed...`);
      }
    }
  }
  
  console.log(`\n\nClosing writers...`);
  await csvGen.closeWriters(writers);
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`📊 Processed: ${processed}/${total}\n`);
  
  const summary = csvGen.getCSVSummary(writers);
  for (const [table, stats] of Object.entries(summary)) {
    const s = stats as any;
    if (s.records > 0) {
      console.log(`${table}: ${s.records.toLocaleString()} records`);
    }
  }
}

main().catch(console.error);
