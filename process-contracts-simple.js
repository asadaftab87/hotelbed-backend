#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');
const { format } = require('fast-csv');

const PROJECT_ROOT = __dirname;
const DOWNLOADS_DIR = path.join(PROJECT_ROOT, 'downloads');

function findCacheDir() {
  const files = fs.readdirSync(DOWNLOADS_DIR);
  const cache = files.find(f => f.startsWith('hotelbed_cache_full_'));
  if (!cache) throw new Error('Cache not found');
  return path.join(DOWNLOADS_DIR, cache);
}

const CACHE_DIR = findCacheDir();
const OUTPUT_DIR = path.join(DOWNLOADS_DIR, 'csv_output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('🚀 Contract Processor\n');
console.log(`Cache: ${CACHE_DIR}`);
console.log(`Output: ${OUTPUT_DIR}\n`);

function createWriters() {
  const writers = {};
  const tables = ['hotel_inventory', 'hotel_rates'];
  
  for (const table of tables) {
    const filePath = path.join(OUTPUT_DIR, `${table}.csv`);
    const writeStream = fs.createWriteStream(filePath, {
      highWaterMark: 128 * 1024 * 1024,
      flags: 'w'
    });
    const csvStream = format({ headers: true, quote: '"' });
    csvStream.pipe(writeStream);
    
    writers[table] = { stream: csvStream, count: 0 };
  }
  
  return writers;
}

async function closeWriters(writers) {
  await Promise.all(Object.values(writers).map(w => 
    new Promise(resolve => w.stream.end(() => resolve()))
  ));
}

function extractHotelId(filename) {
  const match = filename.match(/ID_B2B_\d+#[^_]+_(\d+)_/);
  if (match) return parseInt(match[1]);
  
  const parts = filename.split('_');
  const nums = parts.filter(p => /^\d+$/.test(p)).map(n => parseInt(n));
  return nums.length >= 2 ? nums[1] : (nums[0] || null);
}

function writeInventory(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 6) {
      writer.stream.write({
        hotel_id: hotelId,
        room_code: parts[3] || null,
        board_code: parts[4] || null,
        date_from: parts[0] || null,
        date_to: parts[1] || null,
        availability_data: parts[5] || null
      });
      writer.count++;
    }
  }
}

function writeRates(writer, hotelId, lines) {
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 10) {
      const pricesString = parts[9] || '';
      const matches = [...pricesString.matchAll(/\(([^,]*),([^,]*),([^)]+)\)/g)];
      
      for (const match of matches) {
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
            price: price
          });
          writer.count++;
        }
      }
    }
  }
}

async function processFile(writers, filePath, hotelId) {
  return new Promise((resolve) => {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 50 * 1024 * 1024) {
        resolve(false);
        return;
      }

      const fileStream = createReadStream(filePath, {
        encoding: 'utf-8',
        highWaterMark: 16 * 1024 * 1024
      });
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

      let currentSection = null;
      const currentLines = [];

      rl.on('line', (line) => {
        const startMatch = line.match(/^\{([A-Z]+)\}$/);
        if (startMatch) {
          if (currentSection && currentLines.length > 0) {
            if (currentSection === 'SIIN') writeInventory(writers.hotel_inventory, hotelId, currentLines);
            if (currentSection === 'SIAP') writeRates(writers.hotel_rates, hotelId, currentLines);
            currentLines.length = 0;
          }
          currentSection = startMatch[1];
          return;
        }

        const endMatch = line.match(/^\{\/([A-Z]+)\}$/);
        if (endMatch && currentSection) {
          if (currentLines.length > 0) {
            if (currentSection === 'SIIN') writeInventory(writers.hotel_inventory, hotelId, currentLines);
            if (currentSection === 'SIAP') writeRates(writers.hotel_rates, hotelId, currentLines);
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
          if (currentSection === 'SIIN') writeInventory(writers.hotel_inventory, hotelId, currentLines);
          if (currentSection === 'SIAP') writeRates(writers.hotel_rates, hotelId, currentLines);
        }
        resolve(true);
      });

      rl.on('error', () => resolve(false));
    } catch (error) {
      resolve(false);
    }
  });
}

async function main() {
  const writers = createWriters();
  
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
      const hotelId = extractHotelId(file);
      
      if (hotelId) {
        const success = await processFile(writers, filePath, hotelId);
        if (success) processed++;
      }
      
      if (total % 50 === 0) {
        process.stdout.write(`\r   ${processed}/${total} processed...`);
      }
    }
  }
  
  console.log(`\n\nClosing writers...`);
  await closeWriters(writers);
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`📊 Processed: ${processed}/${total}\n`);
  console.log(`hotel_inventory: ${writers.hotel_inventory.count.toLocaleString()} records`);
  console.log(`hotel_rates: ${writers.hotel_rates.count.toLocaleString()} records`);
}

main().catch(console.error);
